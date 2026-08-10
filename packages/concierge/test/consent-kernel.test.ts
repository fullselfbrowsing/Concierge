import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  COMMAND_PALETTE_CAPABILITIES,
  createStubTransport,
} from "./fixtures/stub-transport.js";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const CONTRACT_KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const ACTIVE_CONTEXT = Object.freeze({ pathname: "/active" });
const RELAYED_PROFILE = Object.freeze({
  consentGrade: "relayed",
  userTurnIdentity: "human-attested",
});

let USER_CANCELLED;
let USER_DECLINED;
let createConcierge;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the consent-kernel suite.",
    );
  }
  ({ USER_CANCELLED, USER_DECLINED, createConcierge } = await import(
    DIST_URL.href
  ));
});

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[CONTRACT_KEY];
});

function schema(validate = (value) => ({ value })) {
  return {
    "~standard": {
      version: 1,
      vendor: "concierge-consent-kernel-test",
      validate,
    },
  };
}

function action(name, handler, extra = {}) {
  return {
    name,
    description: `the ${name} action`,
    schema: schema(),
    jsonSchema: { type: "object" },
    redact: "drop",
    handler,
    effects: { readOnly: true },
    ...extra,
  };
}

function successful(message = "Done.") {
  return { ok: true, message };
}

function createKernel({
  bridge,
  build = createConcierge,
  config = {},
  gates = [{ name: "confirm" }],
  profile = RELAYED_PROFILE,
  reviewHandler = () => successful("Reviewed."),
  reviewName = "review",
  reviewSchema,
} = {}) {
  const reviewEntries = [];
  const gatedEntries = new Map();
  const review = action(
    reviewName,
    (ctx) => {
      reviewEntries.push(ctx);
      return reviewHandler(ctx);
    },
    reviewSchema === undefined ? {} : { schema: reviewSchema },
  );
  const gated = gates.map((gate) => {
    const entries = [];
    gatedEntries.set(gate.name, entries);
    return action(
      gate.name,
      (ctx) => {
        entries.push(ctx);
        return gate.handler?.(ctx) ?? successful(`${gate.name} ran.`);
      },
      {
        ...gate.extra,
        consent: {
          requires: reviewName,
          bindTo: "response",
          ...gate.policy,
        },
      },
    );
  });

  const stage = {
    id: "active",
    match: (ctx) => ctx.pathname === ACTIVE_CONTEXT.pathname,
    actions: [review, ...gated],
  };
  if (bridge !== undefined) stage.bridge = bridge;

  const concierge = build({
    stages: [stage],
    consentProfile: profile,
    ...config,
  });

  return { concierge, gatedEntries, reviewEntries };
}

function dispatchReview(
  concierge,
  {
    args = { amount: 41 },
    callId = "review-call",
    deferUntilDelivered,
    responseId = "review-response",
    userTurnId = "review-turn",
  } = {},
) {
  const meta = { callId, responseId, userTurnId };
  if (deferUntilDelivered !== undefined) {
    meta.deferUntilDelivered = deferUntilDelivered;
  }
  return concierge.dispatch(ACTIVE_CONTEXT, "review", args, meta);
}

function dispatchGate(
  concierge,
  name = "confirm",
  {
    args = {},
    callId = `${name}-call`,
    responseId = `${name}-response`,
    signal,
    userTurnId = `${name}-turn`,
  } = {},
) {
  const meta = { callId, responseId, userTurnId };
  if (signal !== undefined) meta.signal = signal;
  return concierge.dispatch(ACTIVE_CONTEXT, name, args, meta);
}

function deliveryHarness() {
  const callbacks = [];
  const stub = createStubTransport({
    capabilities: COMMAND_PALETTE_CAPABILITIES,
    initialStatus: "connected",
  });

  return {
    callbacks,
    stub,
    get registrations() {
      return stub.deliveryCallbackCount();
    },
    hook(effect) {
      callbacks.push(effect);
      stub.deferUntilDelivered(effect);
    },
    emit(index, report) {
      stub.emitDelivery(index, report);
    },
    report(index, responseId, outcome = "completed", evidence = {}) {
      stub.emitDelivery(index, { responseId, outcome, ...evidence });
    },
  };
}

function createManualScheduler() {
  const pending = [];

  function scheduler(effect) {
    const task = { cancelled: false, effect };
    pending.push(task);
    return () => {
      task.cancelled = true;
    };
  }

  return {
    pending,
    scheduler,
    fireAll() {
      const tasks = pending.splice(0);
      for (const task of tasks) {
        if (!task.cancelled) task.effect();
      }
    },
  };
}

function createAbortSignal(aborted = true) {
  return Object.freeze({
    aborted,
    addEventListener() {},
    removeEventListener() {},
  });
}

function createSnapshotBridge(snapshot) {
  const mounted = { actions: {}, snapshot };
  return Object.freeze({
    id: "consent-test-bridge",
    read: () => mounted,
    register: () => () => {},
  });
}

async function flushMicrotasks() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

function evidenceUtf8(value) {
  return new Uint8Array(Buffer.from(value, "utf8"));
}

function evidenceView(value) {
  return value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

function evidenceHash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function evidenceDigest(bytes) {
  const digest = createHash("sha256").update(bytes).digest();
  return digest.buffer.slice(
    digest.byteOffset,
    digest.byteOffset + digest.byteLength,
  );
}

function immediateEvidenceDigest() {
  const calls = [];
  return {
    calls,
    async digest(algorithm, data) {
      const bytes = new Uint8Array(evidenceView(data));
      calls.push({ algorithm, bytes });
      return evidenceDigest(bytes);
    },
  };
}

function deferredValue() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

async function flushEvidence() {
  for (let index = 0; index < 12; index += 1) {
    await Promise.resolve();
  }
}

function createAttestedKernel({
  digest = immediateEvidenceDigest(),
  policy = {},
  presentReadback,
  reviewHandler,
} = {}) {
  const canonical = evidenceUtf8('{"payload":{"amount":41}}');
  const hash = evidenceHash(canonical);
  const readbacks = [];
  const presenter = presentReadback ?? (async () => ({
    alg: "SHA-256",
    canonical,
    canonicalization: "JCS",
    hash,
  }));
  const built = createKernel({
    config: {
      digest,
      async presentReadback(readback) {
        readbacks.push(readback);
        return presenter(readback);
      },
    },
    gates: [
      {
        name: "confirm",
        policy: { minGrade: "attested", ...policy },
      },
    ],
    profile: {
      consentGrade: "attested",
      userTurnIdentity: "human-attested",
    },
    reviewHandler,
  });
  const delivery = deliveryHarness();

  return {
    ...built,
    canonical,
    delivery,
    digest,
    hash,
    readbacks,
    confirm(options = {}) {
      return dispatchGate(built.concierge, "confirm", options);
    },
    review(options = {}) {
      return dispatchReview(built.concierge, {
        deferUntilDelivered: delivery.hook,
        ...options,
      });
    },
  };
}

function confirmedEvidence(hash, overrides = {}) {
  return {
    readbackHash: hash,
    attestation: {
      act: "confirmed",
      readbackHash: hash,
      userTurnId: "confirm-turn",
    },
    ...overrides,
  };
}

async function armReview(concierge, options = {}) {
  const delivery = deliveryHarness();
  const responseId = options.responseId ?? "review-response";
  await dispatchReview(concierge, {
    ...options,
    responseId,
    deferUntilDelivered: delivery.hook,
  });
  delivery.report(0, responseId);
  return delivery;
}

async function loadCatalogFloorBypass(id, catalogGrade = "delivered") {
  const source = readFileSync(DIST_PATH, "utf8");
  const catalogNeedle = "consentProfile: capturedConsent.profile,";
  const minimumNeedle = [
    "function effectiveConsentMinimum(requested) {",
    '\tconst declared = requested ?? "delivered";',
    '\treturn consentGradeRank(declared) < consentGradeRank("delivered") ? "delivered" : declared;',
    "}",
  ].join("\n");
  expect(source.split(catalogNeedle)).toHaveLength(2);
  expect(source.split(minimumNeedle)).toHaveLength(2);
  const catalogBypassed = source.replace(
    catalogNeedle,
    `consentProfile: Object.freeze({ consentGrade: "${catalogGrade}", userTurnIdentity: "human-attested" }),`,
  );
  const bypassed = catalogBypassed.replace(
    minimumNeedle,
    [
      "function effectiveConsentMinimum(requested) {",
      '\treturn requested ?? "none";',
      "}",
    ].join("\n"),
  );
  const encoded = Buffer.from(`${bypassed}\n// ${id}\n`, "utf8").toString(
    "base64",
  );
  return import(`data:text/javascript;base64,${encoded}`);
}

describe("CON-01/03/05/06/08 — delivery-owned review authority is generation guarded and one-shot", () => {
  it("[T-08-01] K01 — no review returns consent_required and never enters the gated handler", async () => {
    const { concierge, gatedEntries } = createKernel();

    const result = await dispatchGate(concierge);

    expect(result).toMatchObject({ ok: false, reason: "consent_required" });
    expect(gatedEntries.get("confirm")).toHaveLength(0);
  });

  it("K02 — a pending delivery returns the declared onMissing result without entering", async () => {
    const delivery = deliveryHarness();
    const { concierge, gatedEntries } = createKernel({
      gates: [
        {
          name: "confirm",
          policy: {
            onMissing: {
              reason: "consent_required",
              message: "Wait for the review to finish.",
            },
          },
        },
      ],
    });

    await dispatchReview(concierge, { deferUntilDelivered: delivery.hook });
    const result = await dispatchGate(concierge);

    expect(result).toEqual({
      ok: false,
      reason: "consent_required",
      message: "Wait for the review to finish.",
    });
    expect(delivery.registrations).toBe(1);
    expect(gatedEntries.get("confirm")).toHaveLength(0);
  });

  it("K03 — pending is installed before a synchronous completed callback and then arms", async () => {
    let callbackReturned = false;
    const synchronousDelivery = (effect) => {
      effect({ responseId: "review-response", outcome: "completed" });
      callbackReturned = true;
    };
    const { concierge, gatedEntries } = createKernel();

    const review = await dispatchReview(concierge, {
      deferUntilDelivered: synchronousDelivery,
    });
    const confirm = await dispatchGate(concierge);

    expect(review).toMatchObject({ ok: true });
    expect(callbackReturned).toBe(true);
    expect(confirm).toMatchObject({ ok: true });
    expect(gatedEntries.get("confirm")).toHaveLength(1);
  });

  it("K04 — interrupted delivery never arms", async () => {
    const delivery = deliveryHarness();
    const { concierge, gatedEntries } = createKernel();

    await dispatchReview(concierge, { deferUntilDelivered: delivery.hook });
    delivery.report(0, "review-response", "interrupted");
    const result = await dispatchGate(concierge);

    expect(result).toMatchObject({ ok: false, reason: "consent_required" });
    expect(gatedEntries.get("confirm")).toHaveLength(0);
  });

  it("[T-08-02 flagship] interrupted delivery stays closed after a genuine new human turn and late completion", async () => {
    const delivery = deliveryHarness();
    const { concierge, gatedEntries } = createKernel({
      gates: [
        {
          name: "confirm",
          policy: { bindTo: "userTurn" },
        },
      ],
    });

    expect(
      await dispatchReview(concierge, {
        callId: "flagship-review",
        responseId: "flagship-review-response",
        userTurnId: "flagship-human-turn-one",
        deferUntilDelivered: delivery.hook,
      }),
    ).toEqual({ ok: true, message: "Reviewed." });
    expect(delivery.registrations).toBe(1);

    delivery.report(0, "flagship-review-response", "interrupted");
    const afterGenuineTurn = await dispatchGate(concierge, "confirm", {
      callId: "flagship-confirm-after-interruption",
      responseId: "flagship-confirm-response",
      userTurnId: "flagship-human-turn-two",
    });
    expect(afterGenuineTurn).toEqual({
      ok: false,
      reason: "consent_required",
      message: "Review this action before confirming it.",
    });

    delivery.report(0, "flagship-review-response", "completed");
    const afterLateCompletion = await dispatchGate(concierge, "confirm", {
      callId: "flagship-confirm-after-late-completion",
      responseId: "flagship-later-response",
      userTurnId: "flagship-human-turn-three",
    });
    expect(afterLateCompletion).toEqual({
      ok: false,
      reason: "consent_required",
      message: "Review this action before confirming it.",
    });
    expect(Object.isFrozen(afterGenuineTurn)).toBe(true);
    expect(Object.isFrozen(afterLateCompletion)).toBe(true);
    expect(gatedEntries.get("confirm")).toHaveLength(0);
    expect(delivery.stub.responseHistory()).toEqual([]);
    expect(
      delivery.stub.deliveryHistory().map(({ report, sequence }) => ({
        outcome: report.outcome,
        responseId: report.responseId,
        sequence,
      })),
    ).toEqual([
      {
        outcome: "interrupted",
        responseId: "flagship-review-response",
        sequence: 1,
      },
      {
        outcome: "completed",
        responseId: "flagship-review-response",
        sequence: 2,
      },
    ]);
  });

  it("K05 — a successful review with no delivery hook stays closed", async () => {
    const { concierge, gatedEntries } = createKernel();

    expect(await dispatchReview(concierge)).toMatchObject({ ok: true });
    const result = await dispatchGate(concierge);

    expect(result).toMatchObject({ ok: false, reason: "consent_required" });
    expect(gatedEntries.get("confirm")).toHaveLength(0);
  });

  it("K06 — a throwing delivery hook closes authority without leaking its sentinel", async () => {
    const secret = "DELIVERY_SECRET_MUST_NOT_ESCAPE";
    const { concierge, gatedEntries } = createKernel();

    const review = await dispatchReview(concierge, {
      deferUntilDelivered() {
        throw new Error(secret);
      },
    });
    const confirm = await dispatchGate(concierge);

    expect(review).toMatchObject({ ok: true });
    expect(confirm).toMatchObject({ ok: false, reason: "consent_required" });
    expect(JSON.stringify([review, confirm])).not.toContain(secret);
    expect(gatedEntries.get("confirm")).toHaveLength(0);
  });

  it("K07 — a completed report for a different response cannot arm", async () => {
    const delivery = deliveryHarness();
    const { concierge, gatedEntries } = createKernel();

    await dispatchReview(concierge, { deferUntilDelivered: delivery.hook });
    delivery.report(0, "different-response");
    const result = await dispatchGate(concierge);

    expect(result).toMatchObject({ ok: false, reason: "consent_required" });
    expect(gatedEntries.get("confirm")).toHaveLength(0);
  });

  it("K08 — late and repeated callbacks after interruption remain inert", async () => {
    const delivery = deliveryHarness();
    const { concierge, gatedEntries } = createKernel();

    await dispatchReview(concierge, { deferUntilDelivered: delivery.hook });
    delivery.report(0, "review-response", "interrupted");
    delivery.report(0, "review-response", "completed");
    delivery.report(0, "review-response", "completed");
    const result = await dispatchGate(concierge);

    expect(result).toMatchObject({ ok: false, reason: "consent_required" });
    expect(gatedEntries.get("confirm")).toHaveLength(0);
  });

  it("K09 — a fresh validated review immediately replaces an armed generation", async () => {
    const first = deliveryHarness();
    const second = deliveryHarness();
    const { concierge, gatedEntries } = createKernel();

    await dispatchReview(concierge, {
      callId: "review-one",
      responseId: "response-one",
      deferUntilDelivered: first.hook,
    });
    first.report(0, "response-one");
    await dispatchReview(concierge, {
      callId: "review-two",
      responseId: "response-two",
      deferUntilDelivered: second.hook,
    });
    first.report(0, "response-one");

    const result = await dispatchGate(concierge);
    expect(result).toMatchObject({ ok: false, reason: "consent_required" });
    expect(second.registrations).toBe(1);
    expect(gatedEntries.get("confirm")).toHaveLength(0);
  });

  it("[T-08-07] K10 — an exact duplicate review callId returns one Promise and creates one generation", async () => {
    const delivery = deliveryHarness();
    const { concierge, reviewEntries } = createKernel();
    const options = {
      callId: "same-review-call",
      responseId: "same-review-response",
      deferUntilDelivered: delivery.hook,
    };

    const first = dispatchReview(concierge, options);
    const second = dispatchReview(concierge, options);

    expect(first).toBe(second);
    await first;
    expect(reviewEntries).toHaveLength(1);
    expect(delivery.registrations).toBe(1);
    expect(delivery.callbacks).toHaveLength(1);
  });

  it("K11 — review names and Concierge factories keep independent authority", async () => {
    const aDelivery = deliveryHarness();
    const first = createKernel({
      gates: [{ name: "confirmA" }],
    });
    const reviewB = action("reviewB", () => successful("Reviewed B."));
    const second = createKernel();

    // Add the second review name through a separate factory so the assertion
    // covers both key and instance isolation without exposing private state.
    const keyed = createConcierge({
      stages: [
        {
          id: "active",
          match: () => true,
          actions: [
            action("reviewA", () => successful("Reviewed A.")),
            reviewB,
            action("confirmA", () => successful("A ran."), {
              consent: { requires: "reviewA", bindTo: "response" },
            }),
            action("confirmB", () => successful("B ran."), {
              consent: { requires: "reviewB", bindTo: "response" },
            }),
          ],
        },
      ],
      consentProfile: RELAYED_PROFILE,
    });

    await dispatchReview(first.concierge, {
      responseId: "factory-one-review",
      deferUntilDelivered: aDelivery.hook,
    });
    aDelivery.report(0, "factory-one-review");

    expect(await dispatchGate(first.concierge, "confirmA")).toMatchObject({
      ok: true,
    });
    expect(await dispatchGate(second.concierge)).toMatchObject({
      ok: false,
      reason: "consent_required",
    });

    await keyed.dispatch(ACTIVE_CONTEXT, "reviewA", { amount: 1 }, {
      callId: "keyed-review-a",
      responseId: "keyed-review-response",
      deferUntilDelivered(effect) {
        effect({
          responseId: "keyed-review-response",
          outcome: "completed",
        });
      },
    });
    expect(
      await keyed.dispatch(ACTIVE_CONTEXT, "confirmA", {}, {
        callId: "keyed-a",
        responseId: "keyed-response",
      }),
    ).toMatchObject({ ok: true });
    expect(
      await keyed.dispatch(ACTIVE_CONTEXT, "confirmB", {}, {
        callId: "keyed-b",
        responseId: "keyed-response-two",
      }),
    ).toMatchObject({ ok: false, reason: "consent_required" });
  });

  it("K12 — two gated actions sharing one review cannot fan one grant into two effects", async () => {
    const delivery = deliveryHarness();
    const { concierge, gatedEntries } = createKernel({
      gates: [{ name: "confirmA" }, { name: "confirmB" }],
    });

    await dispatchReview(concierge, { deferUntilDelivered: delivery.hook });
    delivery.report(0, "review-response");

    expect(await dispatchGate(concierge, "confirmA")).toMatchObject({ ok: true });
    expect(await dispatchGate(concierge, "confirmB")).toMatchObject({
      ok: false,
      reason: "consent_required",
    });
    expect(gatedEntries.get("confirmA")).toHaveLength(1);
    expect(gatedEntries.get("confirmB")).toHaveLength(0);
  });
});

describe("CON-02/04/05/06/08 — authority binds late, compares detached state, and consumes before entry", () => {
  it("K13 — empty response ids fail closed and a confirm-side omission preserves an armed review", async () => {
    const emptyReviewDelivery = deliveryHarness();
    const { concierge, gatedEntries } = createKernel();

    await dispatchReview(concierge, {
      callId: "empty-review-id",
      responseId: "",
      deferUntilDelivered: emptyReviewDelivery.hook,
    });
    expect(emptyReviewDelivery.registrations).toBe(0);
    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "after-empty-review",
      }),
    ).toMatchObject({ ok: false, reason: "consent_required" });

    await armReview(concierge, {
      callId: "valid-review-after-empty",
      responseId: "valid-review-response",
    });
    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "empty-confirm-id",
        responseId: "",
      }),
    ).toMatchObject({ ok: false, reason: "consent_required" });
    expect(gatedEntries.get("confirm")).toHaveLength(0);
    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "valid-confirm-after-empty",
        responseId: "different-response",
      }),
    ).toMatchObject({ ok: true });
  });

  it("K14 — user-turn binding requires nonempty human-attested ids and preserves a same-turn review", async () => {
    const missingTurnDelivery = deliveryHarness();
    const { concierge, gatedEntries } = createKernel({
      gates: [
        {
          name: "confirm",
          policy: { bindTo: "userTurn" },
        },
      ],
    });

    await dispatchReview(concierge, {
      callId: "missing-review-turn",
      deferUntilDelivered: missingTurnDelivery.hook,
      userTurnId: "",
    });
    missingTurnDelivery.report(0, "review-response");
    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "after-missing-turn",
        userTurnId: "new-turn",
      }),
    ).toMatchObject({ ok: false, reason: "consent_required" });

    await armReview(concierge, {
      callId: "turn-bound-review",
      responseId: "turn-bound-response",
      userTurnId: "turn-one",
    });
    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "same-turn-confirm",
        responseId: "later-response",
        userTurnId: "turn-one",
      }),
    ).toMatchObject({ ok: false, reason: "consent_required" });
    expect(gatedEntries.get("confirm")).toHaveLength(0);
    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "new-turn-confirm",
        responseId: "later-response-two",
        userTurnId: "turn-two",
      }),
    ).toMatchObject({ ok: true });
  });

  it("K15 — response binding rejects the review response without consuming it", async () => {
    const { concierge, gatedEntries } = createKernel();
    await armReview(concierge, {
      callId: "response-bound-review",
      responseId: "shared-response",
    });

    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "same-response-confirm",
        responseId: "shared-response",
      }),
    ).toMatchObject({ ok: false, reason: "consent_required" });
    expect(gatedEntries.get("confirm")).toHaveLength(0);
    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "different-response-confirm",
        responseId: "next-response",
      }),
    ).toMatchObject({ ok: true });
  });

  it("K16 — a pre-entry abort leaves the armed generation available", async () => {
    const { concierge, gatedEntries } = createKernel();
    await armReview(concierge);

    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "aborted-confirm",
        signal: createAbortSignal(),
      }),
    ).toMatchObject({ ok: false, reason: "aborted" });
    expect(gatedEntries.get("confirm")).toHaveLength(0);
    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "confirm-after-abort",
      }),
    ).toMatchObject({ ok: true });
  });

  it("[T-08-03] K17 — drift introduced during the commit window is detected late and destroys authority", async () => {
    const scheduler = createManualScheduler();
    const state = { amount: 41 };
    const { concierge, gatedEntries } = createKernel({
      bridge: createSnapshotBridge({ booking: () => state }),
      config: { scheduler: scheduler.scheduler },
      gates: [
        {
          name: "confirm",
          extra: { effects: { readOnly: false } },
        },
      ],
    });
    await armReview(concierge);

    const pending = dispatchGate(concierge, "confirm", {
      callId: "late-drift-confirm",
    });
    await flushMicrotasks();
    expect(scheduler.pending).toHaveLength(1);
    state.amount = 42;
    scheduler.fireAll();
    expect(await pending).toMatchObject({ ok: false, reason: "consent_stale" });
    expect(gatedEntries.get("confirm")).toHaveLength(0);

    state.amount = 41;
    const afterDrift = dispatchGate(concierge, "confirm", {
      callId: "after-late-drift",
    });
    await flushMicrotasks();
    scheduler.fireAll();
    expect(await afterDrift).toMatchObject({
      ok: false,
      reason: "consent_required",
    });
  });

  it("K18 — a throwing snapshot comparator is contained, stale, and terminal", async () => {
    const secret = "SNAPSHOT_COMPARATOR_SECRET";
    const state = { amount: 41 };
    const { concierge, gatedEntries } = createKernel({
      bridge: createSnapshotBridge({ booking: () => state }),
      gates: [
        {
          name: "confirm",
          policy: {
            snapshotEquality() {
              throw new Error(secret);
            },
          },
        },
      ],
    });
    await armReview(concierge);

    const stale = await dispatchGate(concierge, "confirm", {
      callId: "throwing-comparator",
    });
    const after = await dispatchGate(concierge, "confirm", {
      callId: "after-throwing-comparator",
    });

    expect(stale).toMatchObject({ ok: false, reason: "consent_stale" });
    expect(after).toMatchObject({ ok: false, reason: "consent_required" });
    expect(JSON.stringify([stale, after])).not.toContain(secret);
    expect(gatedEntries.get("confirm")).toHaveLength(0);
  });

  it("K19 — every supported detached structure independently participates in default equality", async () => {
    function freshState() {
      return {
        array: [1, { two: 2 }],
        date: new Date("2026-08-10T00:00:00.000Z"),
        map: new Map([["amount", { cents: 4100 }]]),
        record: { active: true, note: null },
        set: new Set(["reviewed", 41]),
      };
    }

    let state = freshState();
    const { concierge, gatedEntries } = createKernel({
      bridge: createSnapshotBridge({ booking: () => state }),
    });

    await armReview(concierge, {
      callId: "structural-review-one",
      responseId: "structural-response-one",
    });
    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "structural-confirm-one",
      }),
    ).toMatchObject({ ok: true });

    const mutations = [
      ["array", (value) => {
        value.array[1].two = 3;
      }],
      ["record", (value) => {
        value.record.active = false;
      }],
      ["date", (value) => {
        value.date.setUTCDate(11);
      }],
      ["map", (value) => {
        value.map.get("amount").cents = 4200;
      }],
      ["set", (value) => {
        value.set.add("changed");
      }],
    ];

    for (const [kind, mutate] of mutations) {
      state = freshState();
      await armReview(concierge, {
        callId: `structural-${kind}-review`,
        responseId: `structural-${kind}-response`,
      });
      mutate(state);
      expect(
        await dispatchGate(concierge, "confirm", {
          callId: `structural-${kind}-confirm`,
          responseId: `structural-${kind}-confirm-response`,
        }),
      ).toMatchObject({ ok: false, reason: "consent_stale" });
    }

    expect(gatedEntries.get("confirm")).toHaveLength(1);
  });

  it("K20 — the custom comparator runs once per attempt and false destroys authority", async () => {
    const state = { amount: 41 };
    const comparisons = [];
    let matches = true;
    const { concierge, gatedEntries } = createKernel({
      bridge: createSnapshotBridge({ booking: () => state }),
      gates: [
        {
          name: "confirm",
          policy: {
            snapshotEquality(reviewed, current) {
              comparisons.push([reviewed, current]);
              return matches && reviewed.booking.amount === current.booking.amount;
            },
          },
        },
      ],
    });
    await armReview(concierge);

    expect(await dispatchGate(concierge)).toMatchObject({ ok: true });
    expect(comparisons).toHaveLength(1);
    expect(comparisons[0][0]).not.toBe(comparisons[0][1]);
    expect(Object.isFrozen(comparisons[0][0])).toBe(true);
    expect(Object.isFrozen(comparisons[0][1])).toBe(true);
    expect(gatedEntries.get("confirm")).toHaveLength(1);

    await armReview(concierge, {
      callId: "comparator-false-review",
      responseId: "comparator-false-response",
    });
    matches = false;
    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "comparator-false-confirm",
      }),
    ).toMatchObject({ ok: false, reason: "consent_stale" });
    expect(comparisons).toHaveLength(2);
    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "after-comparator-false",
      }),
    ).toMatchObject({ ok: false, reason: "consent_required" });
    expect(gatedEntries.get("confirm")).toHaveLength(1);
  });

  it("K21 — the frozen ack reuses the exact reviewed payload and stored snapshot references", async () => {
    const state = { amount: 41 };
    let comparedSnapshot;
    let observedAck;
    const { concierge, reviewEntries } = createKernel({
      bridge: createSnapshotBridge({ booking: () => state }),
      gates: [
        {
          name: "confirm",
          handler(ctx) {
            observedAck = ctx.ack;
            return successful("Confirmed.");
          },
          policy: {
            snapshotEquality(reviewed, current) {
              comparedSnapshot = reviewed;
              return reviewed.booking.amount === current.booking.amount;
            },
          },
        },
      ],
    });
    await armReview(concierge);

    expect(await dispatchGate(concierge)).toMatchObject({ ok: true });
    expect(observedAck.payload).toBe(reviewEntries[0].args);
    expect(observedAck.snapshot).toBe(comparedSnapshot);
    expect(observedAck).toMatchObject({
      grade: "relayed",
      responseId: "review-response",
      userTurnId: "review-turn",
    });
    expect(Object.isFrozen(observedAck)).toBe(true);
    expect(Object.isFrozen(observedAck.payload)).toBe(true);
    expect(Object.isFrozen(observedAck.snapshot)).toBe(true);
  });

  it("K22 — authority is consumed before a gated handler can reenter", async () => {
    let concierge;
    let reentrant;
    const built = createKernel({
      gates: [
        {
          name: "confirm",
          handler() {
            reentrant = dispatchGate(concierge, "confirm", {
              callId: "reentrant-confirm",
              responseId: "reentrant-response",
            });
            return successful("Outer confirm ran.");
          },
        },
      ],
    });
    concierge = built.concierge;
    await armReview(concierge);

    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "outer-confirm",
      }),
    ).toMatchObject({ ok: true });
    expect(await reentrant).toMatchObject({
      ok: false,
      reason: "consent_required",
    });
    expect(built.gatedEntries.get("confirm")).toHaveLength(1);
  });

  it("K23 — handler throw, invalid return, and a second confirm never restore consent", async () => {
    for (const scenario of [
      {
        expected: "handler_error",
        handler() {
          throw new Error("HANDLER_SECRET");
        },
      },
      {
        expected: "invalid_result",
        handler() {
          return { unexpected: true };
        },
      },
    ]) {
      const { concierge, gatedEntries } = createKernel({
        gates: [{ name: "confirm", handler: scenario.handler }],
      });
      await armReview(concierge);

      expect(
        await dispatchGate(concierge, "confirm", { callId: "first-confirm" }),
      ).toMatchObject({ ok: false, reason: scenario.expected });
      expect(
        await dispatchGate(concierge, "confirm", { callId: "second-confirm" }),
      ).toMatchObject({ ok: false, reason: "consent_required" });
      expect(gatedEntries.get("confirm")).toHaveLength(1);
    }
  });

  it("K24 — decline and dismissal surface exact terminal results once and require a fresh review", async () => {
    for (const terminal of [
      {
        act: "declined",
        constant: USER_DECLINED,
        expected: {
          ok: false,
          reason: "declined",
          message: "Okay, I won't do that.",
        },
      },
      {
        act: "dismissed",
        constant: USER_CANCELLED,
        expected: { ok: false, reason: "cancelled", message: "Cancelled." },
      },
    ]) {
      const delivery = deliveryHarness();
      const { concierge, gatedEntries } = createKernel();
      await dispatchReview(concierge, {
        callId: `${terminal.act}-review`,
        deferUntilDelivered: delivery.hook,
      });
      const hash = `${terminal.act}-hash`;
      delivery.report(0, "review-response", "completed", {
        readbackHash: hash,
        attestation: {
          act: terminal.act,
          userTurnId: `${terminal.act}-turn`,
          readbackHash: hash,
        },
      });

      const first = await dispatchGate(concierge, "confirm", {
        callId: `${terminal.act}-first-confirm`,
      });
      expect(first).toBe(terminal.constant);
      expect(first).toEqual(terminal.expected);
      expect(Object.isFrozen(first)).toBe(true);
      expect(
        await dispatchGate(concierge, "confirm", {
          callId: `${terminal.act}-second-confirm`,
        }),
      ).toMatchObject({ ok: false, reason: "consent_required" });
      expect(gatedEntries.get("confirm")).toHaveLength(0);

      await armReview(concierge, {
        callId: `${terminal.act}-fresh-review`,
        responseId: `${terminal.act}-fresh-response`,
      });
      expect(
        await dispatchGate(concierge, "confirm", {
          callId: `${terminal.act}-fresh-confirm`,
          responseId: `${terminal.act}-confirm-response`,
        }),
      ).toMatchObject({ ok: true });
    }
  });

  it("K25 — accessor-backed consent configuration is captured before runtime dispatch", async () => {
    let requires = "reviewA";
    let bindTo = "response";
    let comparator = () => true;
    let minGrade = "none";
    let onMissing = {
      reason: "consent_required",
      message: "Use the captured review first.",
    };
    const policy = {};
    Object.defineProperties(policy, {
      bindTo: { enumerable: true, get: () => bindTo },
      minGrade: { enumerable: true, get: () => minGrade },
      onMissing: { enumerable: true, get: () => onMissing },
      requires: { enumerable: true, get: () => requires },
      snapshotEquality: { enumerable: true, get: () => comparator },
    });

    const entries = [];
    const concierge = createConcierge({
      stages: [
        {
          id: "active",
          match: () => true,
          actions: [
            action("reviewA", () => successful("Reviewed A.")),
            action("reviewB", () => successful("Reviewed B.")),
            action(
              "confirm",
              (ctx) => {
                entries.push(ctx);
                return successful("Confirmed.");
              },
              { consent: policy },
            ),
          ],
        },
      ],
      consentProfile: RELAYED_PROFILE,
    });

    requires = "reviewB";
    bindTo = "userTurn";
    comparator = () => false;
    minGrade = "attested";
    onMissing = {
      reason: "consent_required",
      message: "MUTATED POLICY MUST NOT BE OBSERVED",
    };

    await concierge.dispatch(ACTIVE_CONTEXT, "reviewA", { amount: 41 }, {
      callId: "captured-policy-review",
      responseId: "captured-policy-review-response",
      userTurnId: "captured-policy-review-turn",
      deferUntilDelivered(effect) {
        effect({
          responseId: "captured-policy-review-response",
          outcome: "completed",
        });
      },
    });
    expect(
      await concierge.dispatch(ACTIVE_CONTEXT, "confirm", {}, {
        callId: "captured-policy-confirm",
        responseId: "captured-policy-confirm-response",
        userTurnId: "captured-policy-review-turn",
      }),
    ).toMatchObject({ ok: true });
    expect(entries).toHaveLength(1);

    expect(
      await concierge.dispatch(ACTIVE_CONTEXT, "confirm", {}, {
        callId: "captured-policy-second-confirm",
        responseId: "captured-policy-second-response",
        userTurnId: "captured-policy-review-turn",
      }),
    ).toEqual({
      ok: false,
      reason: "consent_required",
      message: "Use the captured review first.",
    });
  });

  it("K26 — validated-output detachment failure still invalidates an older armed review", async () => {
    const hostileOutput = {};
    Object.defineProperty(hostileOutput, "amount", {
      enumerable: true,
      get() {
        throw new Error("VALIDATED_OUTPUT_SECRET");
      },
    });
    const reviewSchema = schema((value) => ({
      value: value.failDetachment === true ? hostileOutput : value,
    }));
    const { concierge, gatedEntries } = createKernel({ reviewSchema });
    await armReview(concierge, {
      callId: "older-valid-review",
      responseId: "older-valid-response",
    });

    expect(
      await dispatchReview(concierge, {
        args: { failDetachment: true },
        callId: "replacement-detachment-failure",
        responseId: "replacement-response",
      }),
    ).toMatchObject({ ok: false, reason: "invalid_args" });
    expect(
      await dispatchGate(concierge, "confirm", {
        callId: "confirm-after-detachment-failure",
      }),
    ).toMatchObject({ ok: false, reason: "consent_required" });
    expect(gatedEntries.get("confirm")).toHaveLength(0);
  });
});

describe("CON-07 — achieved none cannot arm after an isolated catalog-floor bypass", () => {
  async function runNoneFloorProbe(id, minGrade) {
    delete (globalThis as Record<symbol, unknown>)[CONTRACT_KEY];
    const artifact = await loadCatalogFloorBypass(id);
    const entries = [];
    const policy = { requires: "review", bindTo: "response" };
    if (minGrade !== undefined) policy.minGrade = minGrade;
    const concierge = artifact.createConcierge({
      stages: [
        {
          id: "active",
          match: () => true,
          actions: [
            action("review", () => successful("Reviewed.")),
            action(
              "confirm",
              (ctx) => {
                entries.push(ctx);
                return successful("Confirmed.");
              },
              { consent: policy },
            ),
          ],
        },
      ],
      consentProfile: {
        consentGrade: "none",
        userTurnIdentity: "none",
      },
    });

    await dispatchReview(concierge, {
      deferUntilDelivered(effect) {
        effect({ responseId: "review-response", outcome: "completed" });
      },
    });
    const result = await dispatchGate(concierge);
    return { entries, result };
  }

  it("N01 — an omitted minGrade still cannot arm or enter at achieved none", async () => {
    const { entries, result } = await runNoneFloorProbe("N01", undefined);

    expect(result).toMatchObject({ ok: false, reason: "grade_unavailable" });
    expect(entries).toHaveLength(0);
  });

  it("N02 — an explicit-none minGrade still cannot arm or enter at achieved none", async () => {
    const { entries, result } = await runNoneFloorProbe("N02", "none");

    expect(result).toMatchObject({ ok: false, reason: "grade_unavailable" });
    expect(entries).toHaveLength(0);
  });

  it("N03 — evidence below the policy minimum is destroyed at the runtime entry gate", async () => {
    delete (globalThis as Record<symbol, unknown>)[CONTRACT_KEY];
    const artifact = await loadCatalogFloorBypass("N03", "relayed");
    const entries = [];
    const concierge = artifact.createConcierge({
      stages: [
        {
          id: "active",
          match: () => true,
          actions: [
            action("review", () => successful("Reviewed.")),
            action(
              "confirm",
              (ctx) => {
                entries.push(ctx);
                return successful("Confirmed.");
              },
              {
                consent: {
                  requires: "review",
                  bindTo: "response",
                  minGrade: "relayed",
                },
              },
            ),
          ],
        },
      ],
      consentProfile: {
        consentGrade: "delivered",
        userTurnIdentity: "human-attested",
      },
    });

    await dispatchReview(concierge, {
      deferUntilDelivered(effect) {
        effect({ responseId: "review-response", outcome: "completed" });
      },
    });
    const result = await dispatchGate(concierge);

    expect(result).toMatchObject({ ok: false, reason: "grade_unavailable" });
    expect(entries).toHaveLength(0);
  });

  it("N04 — explicit-none policy minimum is clamped to delivered, not treated as no evidence", async () => {
    const { concierge, gatedEntries } = createKernel({
      profile: {
        consentGrade: "delivered",
        userTurnIdentity: "human-attested",
      },
      gates: [
        {
          name: "confirm",
          policy: { minGrade: "none" },
        },
      ],
    });
    await armReview(concierge);

    expect(await dispatchGate(concierge)).toMatchObject({ ok: true });
    expect(gatedEntries.get("confirm")).toHaveLength(1);
  });
});

describe("CON-07/09 — attested authority requires one complete owned evidence occurrence", () => {
  it("E01 — presents one frozen Readback whose payload is the stored handler argument", async () => {
    const flow = createAttestedKernel();
    const original = { amount: 41 };

    expect(await flow.review({ args: original })).toMatchObject({ ok: true });
    expect(flow.readbacks).toHaveLength(1);
    expect(flow.reviewEntries).toHaveLength(1);
    const readback = flow.readbacks[0];
    expect(Object.isFrozen(readback)).toBe(true);
    expect(Object.isFrozen(readback.payload)).toBe(true);
    expect(readback.payload).toBe(flow.reviewEntries[0].args);
    expect(readback.payload).not.toBe(original);

    flow.delivery.report(
      0,
      "review-response",
      "completed",
      confirmedEvidence(flow.hash),
    );
    await flushEvidence();
    expect(await flow.confirm()).toMatchObject({ ok: true });
    const entries = flow.gatedEntries.get("confirm");
    expect(entries).toHaveLength(1);
    expect(entries[0].ack).toMatchObject({
      grade: "attested",
      readbackHash: flow.hash,
    });
    expect(entries[0].ack.payload).toBe(readback.payload);
    expect(await flow.confirm({ callId: "second-confirm" })).toMatchObject({
      ok: false,
      reason: "consent_required",
    });
    expect(flow.readbacks).toHaveLength(1);
  });

  it("[T-08-05/T-08-06] E02 — removing or changing any delivery proof component cannot release attested", async () => {
    const variants = [
      {
        label: "missing-attestation",
        expectedReason: "grade_unavailable",
        evidence: (hash) => ({ readbackHash: hash }),
      },
      {
        label: "missing-report-hash",
        expectedReason: "grade_unavailable",
        evidence: (hash) => ({
          attestation: confirmedEvidence(hash).attestation,
        }),
      },
      {
        label: "wrong-report-hash",
        expectedReason: "grade_unavailable",
        evidence: (hash) => confirmedEvidence(hash, {
          readbackHash: "0".repeat(64),
        }),
      },
      {
        label: "wrong-attestation-hash",
        expectedReason: "grade_unavailable",
        evidence: (hash) => confirmedEvidence(hash, {
          attestation: {
            ...confirmedEvidence(hash).attestation,
            readbackHash: "0".repeat(64),
          },
        }),
      },
      {
        label: "empty-confirming-turn",
        expectedReason: "grade_unavailable",
        evidence: (hash) => confirmedEvidence(hash, {
          attestation: {
            ...confirmedEvidence(hash).attestation,
            userTurnId: "",
          },
        }),
      },
      {
        label: "review-turn-reused",
        expectedReason: "grade_unavailable",
        evidence: (hash) => confirmedEvidence(hash, {
          attestation: {
            ...confirmedEvidence(hash).attestation,
            userTurnId: "review-turn",
          },
        }),
      },
      {
        label: "unknown-act",
        expectedReason: "consent_required",
        evidence: (hash) => confirmedEvidence(hash, {
          attestation: {
            ...confirmedEvidence(hash).attestation,
            act: "approved",
          },
        }),
      },
      {
        label: "interrupted",
        expectedReason: "consent_required",
        outcome: "interrupted",
        evidence: (hash) => confirmedEvidence(hash),
      },
      {
        label: "wrong-response",
        expectedReason: "consent_required",
        responseId: "other-response",
        evidence: (hash) => confirmedEvidence(hash),
      },
    ];

    for (const variant of variants) {
      const flow = createAttestedKernel();
      expect(await flow.review(), variant.label).toMatchObject({ ok: true });
      flow.delivery.report(
        0,
        variant.responseId ?? "review-response",
        variant.outcome ?? "completed",
        variant.evidence(flow.hash),
      );
      await flushEvidence();
      const result = await flow.confirm({ callId: `confirm-${variant.label}` });
      expect(result, variant.label).toMatchObject({
        ok: false,
        reason: variant.expectedReason,
      });
      expect(flow.gatedEntries.get("confirm"), variant.label).toHaveLength(0);
    }
  });

  it("[T-08-10] hostile delivery accessors reach the public kernel without executing or leaking", async () => {
    const secret = "HOSTILE_DELIVERY_GETTER_SECRET";
    let getterReads = 0;
    const flow = createAttestedKernel();
    await flow.review({ callId: "hostile-delivery-review" });
    const report = {
      responseId: "review-response",
      outcome: "completed",
      attestation: confirmedEvidence(flow.hash).attestation,
    };
    Object.defineProperty(report, "readbackHash", {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error(secret);
      },
    });

    flow.delivery.emit(0, report);
    await flushEvidence();
    const closed = await flow.confirm({ callId: "hostile-delivery-confirm" });

    expect(closed).toEqual({
      ok: false,
      reason: "consent_required",
      message: "Review this action before confirming it.",
    });
    expect(getterReads).toBe(0);
    expect(JSON.stringify({ closed, history: flow.delivery.stub.deliveryHistory() }))
      .not.toContain(secret);
    expect(flow.gatedEntries.get("confirm")).toHaveLength(0);
  });

  it("E03 — presenter throw, rejection, and malformed receipt close without leaking", async () => {
    const canonical = evidenceUtf8('{"payload":{"amount":41}}');
    const cases = [
      () => {
        throw new Error("PRESENTER_THROW_SECRET");
      },
      () => Promise.reject(new Error("PRESENTER_REJECT_SECRET")),
      async () => ({
        alg: "SHA-256",
        canonical,
        canonicalization: "JCS",
      }),
    ];

    for (const [index, presentReadback] of cases.entries()) {
      const flow = createAttestedKernel({ presentReadback });
      const review = await flow.review({ callId: `failed-presenter-${index}` });
      expect(review).toMatchObject({ ok: true });
      expect(JSON.stringify(review)).not.toContain("PRESENTER_");
      expect(flow.readbacks).toHaveLength(1);
      expect(flow.delivery.registrations).toBe(0);
      expect(await flow.confirm({ callId: `closed-${index}` })).toMatchObject({
        ok: false,
        reason: "consent_required",
      });
    }
  });

  it("E04 — verified decline and dismissal remain exact terminal one-shot outcomes", async () => {
    for (const terminal of [
      { act: "declined", expected: USER_DECLINED },
      { act: "dismissed", expected: USER_CANCELLED },
    ]) {
      const flow = createAttestedKernel();
      await flow.review({ callId: `${terminal.act}-review` });
      flow.delivery.report(0, "review-response", "completed", {
        readbackHash: flow.hash,
        attestation: {
          act: terminal.act,
          readbackHash: flow.hash,
          userTurnId: `${terminal.act}-turn`,
        },
      });
      expect(
        await flow.confirm({ callId: `${terminal.act}-confirm` }),
      ).toBe(terminal.expected);
      expect(
        await flow.confirm({ callId: `${terminal.act}-again` }),
      ).toMatchObject({ ok: false, reason: "consent_required" });
      expect(flow.gatedEntries.get("confirm")).toHaveLength(0);
    }
  });

  it("E04b — initial digest throw and rejection close without delivery or leakage", async () => {
    const cases = [
      {
        label: "throw",
        digest() {
          throw new Error("INITIAL_DIGEST_THROW_SECRET");
        },
      },
      {
        label: "reject",
        digest() {
          return Promise.reject(new Error("INITIAL_DIGEST_REJECT_SECRET"));
        },
      },
    ];

    for (const candidate of cases) {
      const flow = createAttestedKernel({ digest: candidate });
      const review = await flow.review({ callId: `initial-${candidate.label}` });
      expect(review).toMatchObject({ ok: true });
      expect(JSON.stringify(review)).not.toContain("INITIAL_DIGEST_");
      expect(flow.delivery.registrations).toBe(0);
      const closed = await flow.confirm({ callId: `closed-${candidate.label}` });
      expect(closed).toMatchObject({
        ok: false,
        reason: "consent_required",
      });
      expect(JSON.stringify(closed)).not.toContain("INITIAL_DIGEST_");
    }
  });

  it("E05 — supersession during presenter await discards late completion", async () => {
    const canonical = evidenceUtf8('{"payload":{"amount":41}}');
    const hash = evidenceHash(canonical);
    const firstReceipt = deferredValue();
    let presenterCalls = 0;
    const flow = createAttestedKernel({
      presentReadback() {
        presenterCalls += 1;
        return presenterCalls === 1
          ? firstReceipt.promise
          : Promise.resolve({
              alg: "SHA-256",
              canonical,
              canonicalization: "JCS",
              hash,
            });
      },
    });

    const first = flow.review({
      callId: "presenter-first",
      responseId: "presenter-first-response",
    });
    await flushEvidence();
    expect(presenterCalls).toBe(1);
    expect(
      await flow.review({
        callId: "presenter-second",
        responseId: "presenter-second-response",
      }),
    ).toMatchObject({ ok: true });
    expect(flow.delivery.registrations).toBe(1);

    firstReceipt.resolve({
      alg: "SHA-256",
      canonical,
      canonicalization: "JCS",
      hash,
    });
    expect(await first).toMatchObject({ ok: true });
    expect(flow.delivery.registrations).toBe(1);
    flow.delivery.report(
      0,
      "presenter-second-response",
      "completed",
      confirmedEvidence(hash),
    );
    await flushEvidence();
    expect(await flow.confirm()).toMatchObject({ ok: true });
  });

  it("E06 — supersession during presentation digest discards late verification", async () => {
    const blockedDigest = deferredValue();
    const calls = [];
    const digest = {
      digest(algorithm, data) {
        const bytes = new Uint8Array(evidenceView(data));
        calls.push({ algorithm, bytes });
        return calls.length === 1
          ? blockedDigest.promise
          : Promise.resolve(evidenceDigest(bytes));
      },
    };
    const flow = createAttestedKernel({ digest });

    const first = flow.review({
      callId: "digest-first",
      responseId: "digest-first-response",
    });
    await flushEvidence();
    expect(calls).toHaveLength(1);
    await flow.review({
      callId: "digest-second",
      responseId: "digest-second-response",
    });
    expect(flow.delivery.registrations).toBe(1);

    blockedDigest.resolve(evidenceDigest(calls[0].bytes));
    expect(await first).toMatchObject({ ok: true });
    expect(flow.delivery.registrations).toBe(1);
    flow.delivery.report(
      0,
      "digest-second-response",
      "completed",
      confirmedEvidence(flow.hash),
    );
    await flushEvidence();
    expect(await flow.confirm()).toMatchObject({ ok: true });
  });

  it("E07 — supersession during delivery digest cannot overwrite the new generation", async () => {
    const blockedDeliveryDigest = deferredValue();
    const calls = [];
    const digest = {
      digest(algorithm, data) {
        const bytes = new Uint8Array(evidenceView(data));
        calls.push({ algorithm, bytes });
        return calls.length === 2
          ? blockedDeliveryDigest.promise
          : Promise.resolve(evidenceDigest(bytes));
      },
    };
    const flow = createAttestedKernel({ digest });
    await flow.review({
      callId: "delivery-first",
      responseId: "delivery-first-response",
    });
    flow.delivery.report(
      0,
      "delivery-first-response",
      "completed",
      confirmedEvidence(flow.hash),
    );
    await flushEvidence();
    expect(calls).toHaveLength(2);

    await flow.review({
      callId: "delivery-second",
      responseId: "delivery-second-response",
    });
    expect(flow.delivery.registrations).toBe(2);
    blockedDeliveryDigest.resolve(evidenceDigest(calls[1].bytes));
    await flushEvidence();
    expect(await flow.confirm({ callId: "new-still-pending" })).toMatchObject({
      ok: false,
      reason: "consent_required",
    });

    flow.delivery.report(
      1,
      "delivery-second-response",
      "completed",
      confirmedEvidence(flow.hash),
    );
    await flushEvidence();
    expect(await flow.confirm()).toMatchObject({ ok: true });
  });

  it("E08 — a delivery re-digest failure destroys rather than downgrades authority", async () => {
    let digestCalls = 0;
    const digest = {
      digest(_algorithm, data) {
        digestCalls += 1;
        return digestCalls === 1
          ? Promise.resolve(evidenceDigest(evidenceView(data)))
          : Promise.reject(new Error("DELIVERY_DIGEST_SECRET"));
      },
    };
    const flow = createAttestedKernel({ digest });
    await flow.review();
    flow.delivery.report(
      0,
      "review-response",
      "completed",
      confirmedEvidence(flow.hash),
    );
    await flushEvidence();

    const result = await flow.confirm();
    expect(result).toMatchObject({
      ok: false,
      reason: "consent_required",
    });
    expect(JSON.stringify(result)).not.toContain("DELIVERY_DIGEST_SECRET");
    expect(flow.gatedEntries.get("confirm")).toHaveLength(0);
  });

  it("E09 — one callback claims delivery verification before its digest await", async () => {
    const firstDigest = deferredValue();
    const firstCalls = [];
    const duplicateDigest = {
      digest(algorithm, data) {
        const bytes = new Uint8Array(evidenceView(data));
        firstCalls.push({ algorithm, bytes });
        return firstCalls.length === 2
          ? firstDigest.promise
          : Promise.resolve(evidenceDigest(bytes));
      },
    };
    const duplicateFlow = createAttestedKernel({ digest: duplicateDigest });
    await duplicateFlow.review();
    const confirmed = {
      responseId: "review-response",
      outcome: "completed",
      ...confirmedEvidence(duplicateFlow.hash),
    };
    duplicateFlow.delivery.callbacks[0](confirmed);
    duplicateFlow.delivery.callbacks[0](confirmed);
    await flushEvidence();
    expect(firstCalls).toHaveLength(2);
    firstDigest.resolve(evidenceDigest(firstCalls[1].bytes));
    await flushEvidence();
    expect(await duplicateFlow.confirm()).toMatchObject({ ok: true });

    const racedDigest = deferredValue();
    const racedCalls = [];
    const racedFlow = createAttestedKernel({
      digest: {
        digest(algorithm, data) {
          const bytes = new Uint8Array(evidenceView(data));
          racedCalls.push({ algorithm, bytes });
          return racedCalls.length === 2
            ? racedDigest.promise
            : Promise.resolve(evidenceDigest(bytes));
        },
      },
    });
    await racedFlow.review();
    racedFlow.delivery.callbacks[0]({
      responseId: "review-response",
      outcome: "completed",
      ...confirmedEvidence(racedFlow.hash),
    });
    racedFlow.delivery.callbacks[0]({
      responseId: "review-response",
      outcome: "completed",
      readbackHash: racedFlow.hash,
      attestation: {
        act: "declined",
        readbackHash: racedFlow.hash,
        userTurnId: "decline-race-turn",
      },
    });
    racedDigest.resolve(evidenceDigest(racedCalls[1].bytes));
    await flushEvidence();
    expect(await racedFlow.confirm()).toMatchObject({ ok: true });
    expect(racedCalls).toHaveLength(2);
  });

  it("E10 — a late old delivery callback stays inert after fresh-review supersession", async () => {
    const flow = createAttestedKernel();
    await flow.review({
      callId: "late-first",
      responseId: "late-first-response",
    });
    await flow.review({
      callId: "late-second",
      responseId: "late-second-response",
    });
    expect(flow.delivery.registrations).toBe(2);
    expect(flow.digest.calls).toHaveLength(2);
    flow.delivery.report(
      0,
      "late-first-response",
      "completed",
      confirmedEvidence(flow.hash),
    );
    await flushEvidence();
    expect(flow.digest.calls).toHaveLength(2);
    expect(await flow.confirm({ callId: "late-old-confirm" })).toMatchObject({
      ok: false,
      reason: "consent_required",
    });
    flow.delivery.report(
      1,
      "late-second-response",
      "completed",
      confirmedEvidence(flow.hash),
    );
    await flushEvidence();
    expect(flow.digest.calls).toHaveLength(3);
    expect(await flow.confirm()).toMatchObject({ ok: true });
  });

  it("E11 — delivery claims are snapshotted before the re-digest await", async () => {
    const blocked = deferredValue();
    const calls = [];
    const flow = createAttestedKernel({
      digest: {
        digest(algorithm, data) {
          const bytes = new Uint8Array(evidenceView(data));
          calls.push({ algorithm, bytes });
          return calls.length === 2
            ? blocked.promise
            : Promise.resolve(evidenceDigest(bytes));
        },
      },
    });
    await flow.review();
    const attestation = {
      act: "confirmed",
      readbackHash: flow.hash,
      userTurnId: "confirm-turn",
    };
    const report = {
      responseId: "review-response",
      outcome: "completed",
      readbackHash: flow.hash,
      attestation,
    };
    flow.delivery.callbacks[0](report);
    await flushEvidence();
    report.responseId = "mutated-response";
    report.outcome = "interrupted";
    report.readbackHash = "0".repeat(64);
    attestation.act = "declined";
    attestation.readbackHash = "0".repeat(64);
    attestation.userTurnId = "mutated-turn";
    blocked.resolve(evidenceDigest(calls[1].bytes));
    await flushEvidence();
    expect(await flow.confirm()).toMatchObject({ ok: true });
  });

  it("[T-08-04] E12 — an attested ceiling alone produces only relayed evidence", async () => {
    let presenterCalls = 0;
    const digest = immediateEvidenceDigest();
    const delivery = deliveryHarness();
    const built = createKernel({
      config: {
        digest,
        async presentReadback() {
          presenterCalls += 1;
          throw new Error("CAPABILITY_MUST_NOT_RUN");
        },
      },
      gates: [
        {
          name: "confirm",
          policy: { minGrade: "relayed" },
        },
      ],
      profile: {
        consentGrade: "attested",
        userTurnIdentity: "human-attested",
      },
    });
    await dispatchReview(built.concierge, {
      deferUntilDelivered: delivery.hook,
    });
    delivery.report(0, "review-response", "completed", confirmedEvidence("claim"));
    const result = await dispatchGate(built.concierge);
    expect(result).toMatchObject({ ok: true });
    expect(presenterCalls).toBe(0);
    expect(digest.calls).toHaveLength(0);
    const ack = built.gatedEntries.get("confirm")[0].ack;
    expect(ack.grade).toBe("relayed");
    expect(ack).not.toHaveProperty("readbackHash");
  });

  it("E13 — a wrong confirming turn fails without consuming the valid attested ack", async () => {
    const flow = createAttestedKernel();
    await flow.review();
    flow.delivery.report(
      0,
      "review-response",
      "completed",
      confirmedEvidence(flow.hash),
    );
    await flushEvidence();
    expect(
      await flow.confirm({
        callId: "wrong-turn-confirm",
        userTurnId: "other-human-turn",
      }),
    ).toMatchObject({ ok: false, reason: "consent_required" });
    expect(await flow.confirm()).toMatchObject({ ok: true });
  });
});
