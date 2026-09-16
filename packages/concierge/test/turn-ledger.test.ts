import { describe, expect, it } from "vitest";

import { createTurnLedger } from "../src/turn-ledger.js";

describe("createTurnLedger", () => {
  it("binds many responses to one turn and never mints an id", () => {
    const ledger = createTurnLedger();
    expect(ledger.recordUserTurn({
      turnId: "turn-1",
      provenance: "human-attested",
    })?.turnId).toBe("turn-1");
    expect(ledger.openResponse("r1")?.turnId).toBe("turn-1");
    expect(ledger.openResponse("r2")?.turnId).toBe("turn-1");
    expect(ledger.turnFor("r1")?.turnId).toBe("turn-1");
  });

  it("keeps the weaker provenance when a turn is re-recorded", () => {
    const ledger = createTurnLedger();
    ledger.recordUserTurn({ turnId: "t", provenance: "agent-forgeable" });
    const again = ledger.recordUserTurn({
      turnId: "t",
      provenance: "human-attested",
    });
    expect(again?.provenance).toBe("agent-forgeable");
  });

  it("clamps provenance to maxProvenance", () => {
    const ledger = createTurnLedger({ maxProvenance: "agent-forgeable" });
    const turn = ledger.recordUserTurn({
      turnId: "speech",
      provenance: "human-attested",
    });
    expect(turn?.provenance).toBe("agent-forgeable");
  });

  it("first-binding-wins and records a permanent null before any turn", () => {
    const ledger = createTurnLedger();
    expect(ledger.openResponse("early")).toBeNull();
    ledger.recordUserTurn({ turnId: "later", provenance: "human-attested" });
    expect(ledger.turnFor("early")).toBeNull();
    expect(ledger.openResponse("early")).toBeNull();
  });

  it("returns a later human-attested turn for attestation", () => {
    const ledger = createTurnLedger();
    ledger.recordUserTurn({ turnId: "review", provenance: "agent-forgeable" });
    ledger.recordUserTurn({ turnId: "noise", provenance: "agent-forgeable" });
    ledger.recordUserTurn({ turnId: "confirm", provenance: "human-attested" });
    expect(ledger.attestationTurnAfter("review")?.turnId).toBe("confirm");
    expect(ledger.attestationTurnAfter("missing")).toBeNull();
  });

  it("returns the first attested turn after the review, not the last", () => {
    const ledger = createTurnLedger();
    ledger.recordUserTurn({ turnId: "review", provenance: "agent-forgeable" });
    ledger.recordUserTurn({ turnId: "confirm", provenance: "human-attested" });
    ledger.recordUserTurn({ turnId: "much-later", provenance: "human-attested" });
    // A confirmation arbitrarily far in the future must not stand in for the
    // turn the person actually took in answer to this review.
    expect(ledger.attestationTurnAfter("review")?.turnId).toBe("confirm");
    expect(ledger.attestationTurnAfter("confirm")?.turnId).toBe("much-later");
  });

  it("reports no attestation when only weaker turns follow", () => {
    const ledger = createTurnLedger();
    ledger.recordUserTurn({ turnId: "review", provenance: "human-attested" });
    ledger.recordUserTurn({ turnId: "after", provenance: "agent-forgeable" });
    expect(ledger.attestationTurnAfter("review")).toBeNull();
  });

  it("rejects empty or overlong turn ids and hostile accessors", () => {
    const ledger = createTurnLedger();
    expect(ledger.recordUserTurn({ turnId: "", provenance: "none" })).toBeNull();
    expect(
      ledger.recordUserTurn({
        turnId: "x".repeat(1025),
        provenance: "none",
      }),
    ).toBeNull();
    let reads = 0;
    const hostile = {
      get turnId() {
        reads += 1;
        return "hostile";
      },
      get provenance() {
        reads += 1;
        return "human-attested";
      },
    };
    expect(ledger.recordUserTurn(hostile as never)).toBeNull();
    expect(reads).toBe(0);
  });
});
