import type { DeliveryReport, ReadbackAttestation } from "@full-self-browsing/concierge";
import {
  asRecord,
  createBoundedStore,
  createDiagnostic,
  notifyDiagnostic,
  ownData,
  resolveScheduler,
  validIdentifier,
} from "./host.js";
import type {
  RealtimeDeliveryLedger,
  RealtimeDeliveryLedgerConfig,
} from "./types.js";

const DEFAULT_MAX_TRACKED_ORIGINS: number = 256;

interface DeliveryGroup {
  readonly originResponseId: string;
  originTurnId: string | null;
  readonly effects: Array<(report: DeliveryReport) => void>;
  readbackHash: string | undefined;
  voicerId: string | undefined;
  playing: boolean;
  settled: boolean;
  holding: boolean;
  cancelHold: (() => void) | undefined;
}

/**
 * Detach an attestation into frozen own data before anything is validated.
 *
 * **Every field is read exactly once, through `ownData`.** An earlier draft
 * read `act`, `actId` and `readbackHash` once to validate and again to build
 * the copy, so an accessor-backed attestation could pass `validIdentifier`
 * and then hand a different `actId` to the frozen record. Reading each key's
 * own data descriptor — never the property — is the same discipline core
 * applies in `turn-ledger.ts` and `consent-evidence.ts`, and it also means a
 * getter never runs at all.
 */
function snapshotAttestation(
  attestation: ReadbackAttestation,
): ReadbackAttestation | null {
  const record: object | null = asRecord(attestation);
  if (record === null) {
    return null;
  }
  const act: unknown = ownData(record, "act");
  const actId: unknown = ownData(record, "actId");
  const readbackHash: unknown = ownData(record, "readbackHash");
  const userTurnId: unknown = ownData(record, "userTurnId");
  if (
    (act !== "confirmed" && act !== "declined" && act !== "dismissed") ||
    !validIdentifier(actId) ||
    typeof readbackHash !== "string" ||
    (userTurnId !== undefined && typeof userTurnId !== "string")
  ) {
    return null;
  }
  return Object.freeze(
    userTurnId === undefined
      ? { act, actId, readbackHash }
      : { act, actId, readbackHash, userTurnId },
  );
}

export interface RealtimeDeliveryLedgerInternal extends RealtimeDeliveryLedger {
  rememberOriginTurn(originResponseId: string, userTurnId: string): void;
}

/**
 * Create a FIFO delivery ledger. `deferFor(N)` reports under N even when
 * response M voices the results.
 */
export function createRealtimeDeliveryLedger(
  config: RealtimeDeliveryLedgerConfig,
): RealtimeDeliveryLedger {
  const scheduler = resolveScheduler(config.scheduler);
  // Per-origin facts outlive the group that consumed them, because a later
  // `deferFor` for the same origin opens a fresh group that must still see
  // them. Bounded rather than cleared, so the lookup survives that case
  // without growing for the length of the session.
  const hashesByOrigin = createBoundedStore<string>(
    DEFAULT_MAX_TRACKED_ORIGINS,
    DEFAULT_MAX_TRACKED_ORIGINS,
  );
  const turnsByOrigin = createBoundedStore<string>(
    DEFAULT_MAX_TRACKED_ORIGINS,
    DEFAULT_MAX_TRACKED_ORIGINS,
  );
  // `groups` holds only OPEN groups. Every reader already skipped settled
  // ones, so dropping them on settle is behaviour-neutral — and it is what
  // keeps `findOpenGroup`, `observeAttestation` and `revokeAll` scanning the
  // live set rather than the whole session's history.
  const groups: DeliveryGroup[] = [];
  const unbound: DeliveryGroup[] = [];
  const byVoicer: Map<string, DeliveryGroup> = new Map();

  const diagnose = (code: "delivery_revoked" | "delivery_unbound", responseId?: string): void => {
    notifyDiagnostic(config.onDiagnostic, createDiagnostic(code, responseId));
  };

  const findOpenGroup = (originResponseId: string): DeliveryGroup | undefined => {
    for (let index: number = groups.length - 1; index >= 0; index -= 1) {
      const group: DeliveryGroup | undefined = groups[index];
      if (group !== undefined && group.originResponseId === originResponseId && !group.settled) {
        return group;
      }
    }
    return undefined;
  };

  const createGroup = (originResponseId: string): DeliveryGroup => {
    const group: DeliveryGroup = {
      originResponseId,
      originTurnId: turnsByOrigin.get(originResponseId) ?? null,
      effects: [],
      readbackHash: hashesByOrigin.get(originResponseId),
      voicerId: undefined,
      playing: false,
      settled: false,
      holding: false,
      cancelHold: undefined,
    };
    groups.push(group);
    unbound.push(group);
    return group;
  };

  const runEffects = (group: DeliveryGroup, report: DeliveryReport): void => {
    for (const effect of group.effects) {
      try {
        effect(report);
      } catch {
        // Delivery effects are host-owned; one throw cannot strand the rest.
      }
    }
  };

  const settle = (
    group: DeliveryGroup,
    outcome: DeliveryReport["outcome"],
    attestation?: ReadbackAttestation,
  ): void => {
    if (group.settled) return;
    group.settled = true;
    group.holding = false;
    group.playing = false;
    group.cancelHold?.();
    group.cancelHold = undefined;
    if (group.voicerId !== undefined) byVoicer.delete(group.voicerId);
    const unboundIndex: number = unbound.indexOf(group);
    if (unboundIndex >= 0) unbound.splice(unboundIndex, 1);
    const openIndex: number = groups.indexOf(group);
    if (openIndex >= 0) groups.splice(openIndex, 1);
    // **The hash rides with the attestation or it does not ride at all.**
    // Core reads `DeliveryReport.readbackHash` in exactly one place: to
    // substantiate a claim to `attested`. A hash arriving with no confirming
    // attestation is therefore read as a claim that failed to substantiate,
    // and the kernel closes the consent generation outright — the
    // `missing-attestation` variant of E02 pins that.
    //
    // An attestation hold that expires unanswered has not failed a claim. It
    // has delivered a readback the person has not responded to yet, which is
    // `relayed` and nothing more. Sending the bare hash turned that silence
    // into a revocation: the generation closed, and a person who confirmed a
    // moment after the hold elapsed got `unknown_readback` from
    // `attestReadback` and `consent_required` from the gate. Since `attested`
    // is unreachable without `attestationWindowMs`, that was the whole
    // attested realtime path.
    const report: DeliveryReport = Object.freeze({
      responseId: group.originResponseId,
      outcome,
      ...(attestation === undefined || group.readbackHash === undefined
        ? {}
        : { readbackHash: group.readbackHash }),
      ...(attestation === undefined ? {} : { attestation }),
    });
    runEffects(group, report);
  };

  const completeGroup = (group: DeliveryGroup): void => {
    if (config.attestationWindowMs !== undefined && group.readbackHash !== undefined) {
      if (scheduler === undefined) {
        settle(group, "completed");
        return;
      }
      group.holding = true;
      group.cancelHold = scheduler(() => {
        group.cancelHold = undefined;
        if (!group.settled) settle(group, "completed");
      }, config.attestationWindowMs);
      return;
    }
    settle(group, "completed");
  };

  const ledger: RealtimeDeliveryLedgerInternal = {
    deferFor(
      originResponseId: string,
    ): (effect: (report: DeliveryReport) => void) => void {
      return (effect: (report: DeliveryReport) => void): void => {
        const existing: DeliveryGroup | undefined = findOpenGroup(originResponseId);
        const group: DeliveryGroup =
          existing !== undefined && !existing.settled
            ? existing
            : createGroup(originResponseId);
        group.effects.push(effect);
      };
    },
    attachReadbackHash(originResponseId: string, readbackHash: string): void {
      hashesByOrigin.set(originResponseId, readbackHash);
      const group: DeliveryGroup | undefined = findOpenGroup(originResponseId);
      if (group !== undefined) group.readbackHash = readbackHash;
    },
    rememberOriginTurn(originResponseId: string, userTurnId: string): void {
      turnsByOrigin.set(originResponseId, userTurnId);
      const group: DeliveryGroup | undefined = findOpenGroup(originResponseId);
      if (group !== undefined) group.originTurnId = userTurnId;
    },
    observeAttestation(attestation: ReadbackAttestation): void {
      const frozen: ReadbackAttestation | null = snapshotAttestation(attestation);
      if (frozen === null || frozen.userTurnId === undefined) return;
      for (const group of groups) {
        if (!group.holding || group.settled) continue;
        if (group.readbackHash !== frozen.readbackHash) continue;
        if (group.originTurnId !== null && frozen.userTurnId === group.originTurnId) {
          continue;
        }
        settle(group, "completed", frozen);
        return;
      }
    },
    bindResponse(responseId: string): void {
      if (!validIdentifier(responseId) || byVoicer.has(responseId)) return;
      const group: DeliveryGroup | undefined = unbound.shift();
      if (group === undefined) return;
      group.voicerId = responseId;
      byVoicer.set(responseId, group);
    },
    playbackStarted(responseId: string): void {
      const group: DeliveryGroup | undefined = byVoicer.get(responseId);
      if (group === undefined || group.settled) return;
      group.playing = true;
    },
    playbackDrained(responseId: string): void {
      const group: DeliveryGroup | undefined = byVoicer.get(responseId);
      if (group === undefined || group.settled) return;
      group.playing = false;
      completeGroup(group);
    },
    playbackCleared(responseId: string): void {
      const group: DeliveryGroup | undefined = byVoicer.get(responseId);
      if (group === undefined || group.settled) return;
      diagnose("delivery_revoked", group.originResponseId);
      settle(group, "interrupted");
    },
    generationCompleted(responseId: string): void {
      const group: DeliveryGroup | undefined = byVoicer.get(responseId);
      if (group === undefined || group.settled || group.playing) return;
      if (config.deliveryEvidence === "buffer-drain") {
        diagnose("delivery_revoked", group.originResponseId);
        settle(group, "interrupted");
        return;
      }
      completeGroup(group);
    },
    revokeAll(
      options?: Readonly<{ retainPlaying?: boolean | undefined }> | undefined,
    ): void {
      const retainPlaying: boolean = options?.retainPlaying === true;
      for (const group of [...groups]) {
        if (group.settled) continue;
        if (retainPlaying && group.playing) continue;
        if (group.voicerId === undefined) diagnose("delivery_unbound", group.originResponseId);
        else diagnose("delivery_revoked", group.originResponseId);
        settle(group, "interrupted");
      }
    },
    reset(): void {
      for (const group of [...groups]) {
        if (group.settled) continue;
        if (group.voicerId === undefined) diagnose("delivery_unbound", group.originResponseId);
        else diagnose("delivery_revoked", group.originResponseId);
        settle(group, "interrupted");
      }
      groups.length = 0;
      unbound.length = 0;
      byVoicer.clear();
      hashesByOrigin.clear();
      turnsByOrigin.clear();
    },
  };
  return Object.freeze(ledger);
}
