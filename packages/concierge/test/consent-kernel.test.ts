import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

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
  let registrations = 0;

  return {
    callbacks,
    get registrations() {
      return registrations;
    },
    hook(effect) {
      registrations += 1;
      callbacks.push(effect);
    },
    report(index, responseId, outcome = "completed", evidence = {}) {
      const callback = callbacks[index];
      if (callback === undefined) {
        throw new Error(`No delivery callback at index ${index}.`);
      }
      callback({ responseId, outcome, ...evidence });
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
  const needle = "consentProfile: capturedConsent.profile,";
  expect(source.split(needle)).toHaveLength(2);
  const bypassed = source.replace(
    needle,
    `consentProfile: Object.freeze({ consentGrade: "${catalogGrade}", userTurnIdentity: "human-attested" }),`,
  );
  const encoded = Buffer.from(`${bypassed}\n// ${id}\n`, "utf8").toString(
    "base64",
  );
  return import(`data:text/javascript;base64,${encoded}`);
}

describe("CON-01/03/05/06/08 — delivery-owned review authority is generation guarded and one-shot", () => {
  it("K01 — no review returns consent_required and never enters the gated handler", async () => {
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

  it("K10 — an exact duplicate review callId returns one Promise and creates one generation", async () => {
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

  it("K17 — drift introduced during the commit window is detected late and destroys authority", async () => {
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
