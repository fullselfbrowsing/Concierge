import type { DeliveryReport, ReadbackAttestation } from "@full-self-browsing/concierge";
import {
  createDiagnostic,
  notifyDiagnostic,
  resolveScheduler,
  validIdentifier,
} from "./host.js";
import type {
  RealtimeDeliveryLedger,
  RealtimeDeliveryLedgerConfig,
} from "./types.js";

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

function snapshotAttestation(
  attestation: ReadbackAttestation,
): ReadbackAttestation | null {
  if (
    (attestation.act !== "confirmed" &&
      attestation.act !== "declined" &&
      attestation.act !== "dismissed") ||
    !validIdentifier(attestation.actId) ||
    typeof attestation.readbackHash !== "string"
  ) {
    return null;
  }
  const userTurnId: string | undefined = attestation.userTurnId;
  return Object.freeze(
    userTurnId === undefined
      ? {
          act: attestation.act,
          actId: attestation.actId,
          readbackHash: attestation.readbackHash,
        }
      : {
          act: attestation.act,
          actId: attestation.actId,
          readbackHash: attestation.readbackHash,
          userTurnId,
        },
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
  const hashesByOrigin: Map<string, string> = new Map();
  const turnsByOrigin: Map<string, string> = new Map();
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
    const report: DeliveryReport = Object.freeze({
      responseId: group.originResponseId,
      outcome,
      ...(group.readbackHash === undefined ? {} : { readbackHash: group.readbackHash }),
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
