import { describe, expect, it } from "vitest";

import { snapshotDeliveryEvidence } from "../src/consent-evidence.js";

const BASE = {
  responseId: "response-1",
  outcome: "completed",
  readbackHash: "hash-1",
} as const;

describe("snapshotDeliveryEvidence", () => {
  it("accepts an attestation that omits the optional userTurnId", () => {
    // `ReadbackAttestation.userTurnId` is declared optional, so a report
    // carrying `{ act, actId, readbackHash }` typechecks. Rejecting it here
    // made the whole snapshot fail, which `observeReviewDelivery` cannot tell
    // apart from a hostile report and answers by closing the generation.
    const result = snapshotDeliveryEvidence({
      ...BASE,
      attestation: { act: "confirmed", actId: "act-1", readbackHash: "hash-1" },
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.attestation).toMatchObject({
      act: "confirmed",
      readbackHash: "hash-1",
    });
    expect(result.ok && result.value.attestation?.userTurnId).toBeUndefined();
  });

  it("still carries a present userTurnId through", () => {
    const result = snapshotDeliveryEvidence({
      ...BASE,
      attestation: {
        act: "confirmed",
        actId: "act-1",
        readbackHash: "hash-1",
        userTurnId: "turn-2",
      },
    });

    expect(result.ok && result.value.attestation?.userTurnId).toBe("turn-2");
  });

  it("refuses an accessor-backed userTurnId rather than treating it as absent", () => {
    // Absent is fine; present-but-not-own-data is the TOCTOU shape and must
    // still fail, or the relaxation above would become a way past the check.
    const attestation = { act: "confirmed", actId: "act-1", readbackHash: "hash-1" };
    Object.defineProperty(attestation, "userTurnId", {
      configurable: true,
      enumerable: true,
      get: () => "turn-2",
    });

    expect(snapshotDeliveryEvidence({ ...BASE, attestation }).ok).toBe(false);
  });

  it("refuses an attestation missing a required field", () => {
    expect(
      snapshotDeliveryEvidence({
        ...BASE,
        attestation: { actId: "act-1", readbackHash: "hash-1" },
      }).ok,
    ).toBe(false);
    expect(
      snapshotDeliveryEvidence({
        ...BASE,
        attestation: { act: "confirmed", actId: "act-1" },
      }).ok,
    ).toBe(false);
  });
});
