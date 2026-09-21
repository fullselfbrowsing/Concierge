import type { TurnIdentityProvenance } from "@full-self-browsing/concierge";
import { validIdentifier } from "./host.js";
import type { RealtimeTurnLedger, RealtimeTurnLedgerConfig } from "./types.js";

const DEFAULT_MAX_TRACKED_RESPONSES: number = 64;

/**
 * Latest-wins turn identity. Many responses may bind to one turn; no id is
 * minted when no turn is open.
 */
export function createRealtimeTurnLedger(
  config: RealtimeTurnLedgerConfig,
): RealtimeTurnLedger {
  const maxTracked: number =
    typeof config.maxTrackedResponses === "number" &&
    Number.isSafeInteger(config.maxTrackedResponses) &&
    config.maxTrackedResponses > 0
      ? config.maxTrackedResponses
      : DEFAULT_MAX_TRACKED_RESPONSES;
  const provenance: TurnIdentityProvenance = config.provenance;
  let current: string | null = null;
  const byResponse: Map<string, string> = new Map();
  const order: string[] = [];

  const evictIfNeeded = (): void => {
    while (order.length > maxTracked) {
      const oldest: string | undefined = order.shift();
      if (oldest !== undefined) byResponse.delete(oldest);
    }
  };

  return Object.freeze({
    provenance,
    openTurn(turnId: string): void {
      if (!validIdentifier(turnId)) return;
      current = turnId;
    },
    currentTurnId(): string | null {
      return current;
    },
    bindResponse(responseId: string): string | null {
      if (!validIdentifier(responseId) || current === null) return null;
      if (!byResponse.has(responseId)) order.push(responseId);
      byResponse.set(responseId, current);
      evictIfNeeded();
      return current;
    },
    turnOf(responseId: string): string | null {
      return byResponse.get(responseId) ?? null;
    },
    releaseResponse(responseId: string): void {
      if (!byResponse.delete(responseId)) return;
      const index: number = order.indexOf(responseId);
      if (index >= 0) order.splice(index, 1);
    },
    reset(): void {
      current = null;
      byResponse.clear();
      order.length = 0;
    },
  });
}
