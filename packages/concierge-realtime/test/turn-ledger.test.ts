import { describe, expect, it } from "vitest";

import { createRealtimeTurnLedger } from "../src/turn-ledger.js";

describe("createRealtimeTurnLedger", () => {
  it("is latest-wins and binds many responses to one turn without minting ids", () => {
    const ledger = createRealtimeTurnLedger({
      provenance: "human-attested",
    });
    expect(ledger.bindResponse("r1")).toBeNull();
    expect(ledger.currentTurnId()).toBeNull();

    ledger.openTurn("turn-a");
    ledger.openTurn("turn-b");
    expect(ledger.currentTurnId()).toBe("turn-b");
    expect(ledger.bindResponse("r1")).toBe("turn-b");
    expect(ledger.bindResponse("r2")).toBe("turn-b");
    expect(ledger.turnOf("r1")).toBe("turn-b");
    expect(ledger.turnOf("r2")).toBe("turn-b");

    ledger.openTurn("turn-c");
    expect(ledger.bindResponse("r3")).toBe("turn-c");
    expect(ledger.turnOf("r1")).toBe("turn-b");
  });

  it("evicts the oldest response binding when the retention bound is exceeded", () => {
    const ledger = createRealtimeTurnLedger({
      provenance: "agent-forgeable",
      maxTrackedResponses: 2,
    });
    ledger.openTurn("turn-1");
    ledger.bindResponse("r1");
    ledger.bindResponse("r2");
    ledger.bindResponse("r3");
    expect(ledger.turnOf("r1")).toBeNull();
    expect(ledger.turnOf("r2")).toBe("turn-1");
    expect(ledger.turnOf("r3")).toBe("turn-1");
  });

  it("releases a response and clears all state on reset", () => {
    const ledger = createRealtimeTurnLedger({ provenance: "none" });
    ledger.openTurn("turn-1");
    ledger.bindResponse("r1");
    ledger.releaseResponse("r1");
    expect(ledger.turnOf("r1")).toBeNull();
    ledger.bindResponse("r2");
    ledger.reset();
    expect(ledger.currentTurnId()).toBeNull();
    expect(ledger.turnOf("r2")).toBeNull();
    expect(ledger.provenance).toBe("none");
  });
});
