/**
 * Many-responses-to-one-turn identity. The producer for ToolBatch.userTurnId
 * and for a ReadbackAttestation's later userTurnId.
 *
 * Not a queue and not a one-shot binder. An agent may open any number of
 * responses inside one human turn; every one of them must read back the same
 * turn id. First binding wins. No identifier is minted here.
 */

import type { TurnIdentityProvenance } from "./types.js";

const TURN_ID_MAX_CHARS: number = 1024;
const DEFAULT_RETAIN_TURNS: number = 64;
const DEFAULT_RETAIN_RESPONSES: number = 256;

const PROVENANCE_RANK: Readonly<Record<TurnIdentityProvenance, number>> =
  Object.freeze({
    none: 0,
    "agent-forgeable": 1,
    "human-attested": 2,
  });

export interface RecordedTurn {
  readonly turnId: string;
  readonly provenance: TurnIdentityProvenance;
}

export interface TurnLedgerConfig {
  readonly maxProvenance?: TurnIdentityProvenance | undefined;
  readonly retainTurns?: number | undefined;
  readonly retainResponses?: number | undefined;
}

export interface TurnLedger {
  recordUserTurn(turn: RecordedTurn): RecordedTurn | null;
  latestTurn(): RecordedTurn | null;
  openResponse(responseId: string): RecordedTurn | null;
  turnFor(responseId: string): RecordedTurn | null;
  attestationTurnAfter(turnId: string): RecordedTurn | null;
  reset(): void;
}

function ownDataString(value: unknown, key: string): string | undefined {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return undefined;
  }
  try {
    const descriptor: PropertyDescriptor | undefined =
      Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor &&
      typeof descriptor.value === "string"
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function isProvenance(value: unknown): value is TurnIdentityProvenance {
  return value === "none" ||
    value === "agent-forgeable" ||
    value === "human-attested";
}

function ownDataProvenance(
  value: unknown,
): TurnIdentityProvenance | undefined {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return undefined;
  }
  try {
    const descriptor: PropertyDescriptor | undefined =
      Object.getOwnPropertyDescriptor(value, "provenance");
    return descriptor !== undefined &&
      "value" in descriptor &&
      isProvenance(descriptor.value)
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function usableId(value: unknown): string | null {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= TURN_ID_MAX_CHARS
    ? value
    : null;
}

function retainCount(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isSafeInteger(value) || value < 1
    ? fallback
    : value;
}

function weaker(
  left: TurnIdentityProvenance,
  right: TurnIdentityProvenance,
): TurnIdentityProvenance {
  return PROVENANCE_RANK[left] <= PROVENANCE_RANK[right] ? left : right;
}

function clampProvenance(
  incoming: TurnIdentityProvenance,
  ceiling: TurnIdentityProvenance,
): TurnIdentityProvenance {
  return weaker(incoming, ceiling);
}

export function createTurnLedger(config: TurnLedgerConfig = {}): TurnLedger {
  const maxProvenance: TurnIdentityProvenance = isProvenance(config.maxProvenance)
    ? config.maxProvenance
    : "human-attested";
  const retainTurns: number = retainCount(config.retainTurns, DEFAULT_RETAIN_TURNS);
  const retainResponses: number = retainCount(
    config.retainResponses,
    DEFAULT_RETAIN_RESPONSES,
  );

  const turns: Map<string, RecordedTurn> = new Map();
  const turnOrder: string[] = [];
  const responses: Map<string, RecordedTurn | null> = new Map();
  const responseOrder: string[] = [];
  let latest: RecordedTurn | null = null;

  function evictTurns(): void {
    while (turnOrder.length > retainTurns) {
      const oldest: string | undefined = turnOrder.shift();
      if (oldest === undefined) {
        break;
      }
      turns.delete(oldest);
    }
  }

  function evictResponses(): void {
    while (responseOrder.length > retainResponses) {
      const oldest: string | undefined = responseOrder.shift();
      if (oldest === undefined) {
        break;
      }
      responses.delete(oldest);
    }
  }

  const ledger: TurnLedger = {
    recordUserTurn(turn: RecordedTurn): RecordedTurn | null {
      const turnId: string | undefined = ownDataString(turn, "turnId");
      const provenance: TurnIdentityProvenance | undefined =
        ownDataProvenance(turn);
      if (turnId === undefined || !usableId(turnId) || provenance === undefined) {
        return null;
      }
      const clamped: TurnIdentityProvenance = clampProvenance(
        provenance,
        maxProvenance,
      );
      const existing: RecordedTurn | undefined = turns.get(turnId);
      if (existing !== undefined) {
        const reduced: TurnIdentityProvenance = weaker(
          existing.provenance,
          clamped,
        );
        if (reduced !== existing.provenance) {
          const stored: RecordedTurn = Object.freeze({
            turnId,
            provenance: reduced,
          });
          turns.set(turnId, stored);
          if (latest?.turnId === turnId) {
            latest = stored;
          }
          return stored;
        }
        return existing;
      }
      const stored: RecordedTurn = Object.freeze({
        turnId,
        provenance: clamped,
      });
      turns.set(turnId, stored);
      turnOrder.push(turnId);
      latest = stored;
      evictTurns();
      return stored;
    },

    latestTurn(): RecordedTurn | null {
      return latest;
    },

    openResponse(responseId: string): RecordedTurn | null {
      const id: string | null = usableId(responseId);
      if (id === null) {
        return null;
      }
      if (responses.has(id)) {
        return responses.get(id) ?? null;
      }
      const bound: RecordedTurn | null = latest;
      responses.set(id, bound);
      responseOrder.push(id);
      evictResponses();
      return bound;
    },

    turnFor(responseId: string): RecordedTurn | null {
      if (!responses.has(responseId)) {
        return null;
      }
      return responses.get(responseId) ?? null;
    },

    attestationTurnAfter(turnId: string): RecordedTurn | null {
      const index: number = turnOrder.indexOf(turnId);
      if (index < 0) {
        return null;
      }
      let found: RecordedTurn | null = null;
      for (let i: number = index + 1; i < turnOrder.length; i += 1) {
        const id: string | undefined = turnOrder[i];
        if (id === undefined) {
          continue;
        }
        const turn: RecordedTurn | undefined = turns.get(id);
        if (turn?.provenance === "human-attested") {
          found = turn;
        }
      }
      return found;
    },

    reset(): void {
      turns.clear();
      turnOrder.length = 0;
      responses.clear();
      responseOrder.length = 0;
      latest = null;
    },
  };

  return Object.freeze(ledger);
}
