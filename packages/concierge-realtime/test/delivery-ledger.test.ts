import { describe, expect, it } from "vitest";

import { createRealtimeDeliveryLedger } from "../src/delivery-ledger.js";

describe("createRealtimeDeliveryLedger", () => {
  it("reports the originating response N when voicer M drains — reporting M is the required-failing mutant", () => {
    const reports = [];
    const ledger = createRealtimeDeliveryLedger({
      deliveryEvidence: "buffer-drain",
    });
    ledger.deferFor("response-N")((report) => {
      reports.push(report);
    });
    ledger.bindResponse("response-M");
    ledger.playbackStarted("response-M");
    ledger.playbackDrained("response-M");

    expect(reports).toHaveLength(1);
    expect(reports[0]?.responseId).toBe("response-N");
    expect(reports[0]?.responseId).not.toBe("response-M");
    expect(reports[0]?.outcome).toBe("completed");
  });

  it("fails closed under buffer-drain when generation ends with no output", () => {
    const reports = [];
    const ledger = createRealtimeDeliveryLedger({
      deliveryEvidence: "buffer-drain",
    });
    ledger.deferFor("origin")((report) => {
      reports.push(report);
    });
    ledger.bindResponse("voicer");
    ledger.generationCompleted("voicer");
    expect(reports).toEqual([
      expect.objectContaining({ responseId: "origin", outcome: "interrupted" }),
    ]);
  });

  it("treats generation completion as delivery under generation-complete", () => {
    const reports = [];
    const ledger = createRealtimeDeliveryLedger({
      deliveryEvidence: "generation-complete",
    });
    ledger.deferFor("origin")((report) => {
      reports.push(report);
    });
    ledger.bindResponse("voicer");
    ledger.generationCompleted("voicer");
    expect(reports).toEqual([
      expect.objectContaining({ responseId: "origin", outcome: "completed" }),
    ]);
  });

  it("does not complete a live rendition when generation ends", () => {
    const reports = [];
    const ledger = createRealtimeDeliveryLedger({
      deliveryEvidence: "buffer-drain",
    });
    ledger.deferFor("origin")((report) => {
      reports.push(report);
    });
    ledger.bindResponse("voicer");
    ledger.playbackStarted("voicer");
    ledger.generationCompleted("voicer");
    expect(reports).toEqual([]);
    ledger.playbackDrained("voicer");
    expect(reports[0]?.outcome).toBe("completed");
  });

  it("revokes an unbound group under its origin id and never mints a placeholder", () => {
    const reports = [];
    const ledger = createRealtimeDeliveryLedger({
      deliveryEvidence: "buffer-drain",
    });
    ledger.deferFor("origin-unbound")((report) => {
      reports.push(report);
    });
    ledger.reset();
    expect(reports).toEqual([
      expect.objectContaining({
        responseId: "origin-unbound",
        outcome: "interrupted",
      }),
    ]);
    expect(reports[0]?.responseId).not.toBe("unbound-response");
  });

  it("holds a drained report for attestation and settles on a later human turn", () => {
    const reports = [];
    const armed = [];
    const ledger = createRealtimeDeliveryLedger({
      deliveryEvidence: "buffer-drain",
      attestationWindowMs: 1_000,
      scheduler: (fn) => {
        armed.push(fn);
        return () => {};
      },
    });
    ledger.rememberOriginTurn("origin", "turn-review");
    ledger.attachReadbackHash("origin", "hash-1");
    ledger.deferFor("origin")((report) => {
      reports.push(report);
    });
    ledger.bindResponse("voicer");
    ledger.playbackDrained("voicer");
    expect(reports).toEqual([]);

    ledger.observeAttestation({
      act: "confirmed",
      actId: "act-1",
      readbackHash: "hash-1",
      userTurnId: "turn-review",
    });
    expect(reports).toEqual([]);

    ledger.observeAttestation({
      act: "confirmed",
      actId: "act-2",
      readbackHash: "hash-1",
      userTurnId: "turn-confirm",
    });
    expect(reports).toEqual([
      expect.objectContaining({
        responseId: "origin",
        outcome: "completed",
        readbackHash: "hash-1",
        attestation: expect.objectContaining({ actId: "act-2" }),
      }),
    ]);
  });

  it("emits a completed report without attestation when the window elapses", () => {
    const reports = [];
    const armed = [];
    const ledger = createRealtimeDeliveryLedger({
      deliveryEvidence: "buffer-drain",
      attestationWindowMs: 40,
      scheduler: (fn) => {
        armed.push(fn);
        return () => {};
      },
    });
    ledger.attachReadbackHash("origin", "hash-1");
    ledger.deferFor("origin")((report) => {
      reports.push(report);
    });
    ledger.bindResponse("voicer");
    ledger.playbackDrained("voicer");
    expect(armed).toHaveLength(1);
    armed[0]?.();
    expect(reports).toEqual([
      expect.objectContaining({
        responseId: "origin",
        outcome: "completed",
        readbackHash: "hash-1",
      }),
    ]);
    expect(reports[0]?.attestation).toBeUndefined();
  });

  it("settles interruption immediately and keeps playing groups when asked", () => {
    const reports = [];
    const ledger = createRealtimeDeliveryLedger({
      deliveryEvidence: "buffer-drain",
    });
    ledger.deferFor("quiet")((report) => {
      reports.push(report);
    });
    ledger.deferFor("loud")((report) => {
      reports.push(report);
    });
    ledger.bindResponse("voice-quiet");
    ledger.bindResponse("voice-loud");
    ledger.playbackStarted("voice-loud");
    ledger.revokeAll({ retainPlaying: true });
    expect(reports).toEqual([
      expect.objectContaining({ responseId: "quiet", outcome: "interrupted" }),
    ]);
    ledger.playbackDrained("voice-loud");
    expect(reports).toHaveLength(2);
    expect(reports[1]?.responseId).toBe("loud");
    expect(reports[1]?.outcome).toBe("completed");
  });
});

describe("attestation snapshotting", () => {
  it("rejects an accessor-backed attestation and never invokes its getters", () => {
    const ledger = createRealtimeDeliveryLedger({ attestationWindowMs: 50 });
    let reads = 0;
    const hostile = {
      get act() {
        reads += 1;
        return "confirmed";
      },
      get actId() {
        reads += 1;
        return reads > 2 ? "swapped" : "act-1";
      },
      get readbackHash() {
        reads += 1;
        return "hash-1";
      },
      get userTurnId() {
        reads += 1;
        return "turn-2";
      },
    };

    const reports = [];
    ledger.deferFor("origin-1")((report) => reports.push(report));
    ledger.attachReadbackHash("origin-1", "hash-1");
    ledger.bindResponse("voice-1");
    ledger.playbackStarted("voice-1");
    ledger.playbackDrained("voice-1");

    ledger.observeAttestation(hostile);

    // Every field is read through its own-data descriptor, so no getter runs
    // and the attestation cannot settle the held group.
    expect(reads).toBe(0);
    expect(reports).toEqual([]);
  });

  it("carries a plain-data attestation through to the report", () => {
    const ledger = createRealtimeDeliveryLedger({ attestationWindowMs: 50 });
    const reports = [];
    ledger.deferFor("origin-1")((report) => reports.push(report));
    ledger.attachReadbackHash("origin-1", "hash-1");
    ledger.rememberOriginTurn("origin-1", "turn-1");
    ledger.bindResponse("voice-1");
    ledger.playbackStarted("voice-1");
    ledger.playbackDrained("voice-1");

    ledger.observeAttestation({
      act: "confirmed",
      actId: "act-1",
      readbackHash: "hash-1",
      userTurnId: "turn-2",
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].attestation).toMatchObject({
      act: "confirmed",
      actId: "act-1",
      readbackHash: "hash-1",
      userTurnId: "turn-2",
    });
    expect(Object.isFrozen(reports[0].attestation)).toBe(true);
  });
});
