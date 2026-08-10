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

let createConcierge;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the consent-kernel suite.",
    );
  }
  ({ createConcierge } = await import(DIST_URL.href));
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
  build = createConcierge,
  gates = [{ name: "confirm" }],
  profile = RELAYED_PROFILE,
  reviewHandler = () => successful("Reviewed."),
  reviewName = "review",
} = {}) {
  const reviewEntries = [];
  const gatedEntries = new Map();
  const review = action(reviewName, (ctx) => {
    reviewEntries.push(ctx);
    return reviewHandler(ctx);
  });
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
        consent: {
          requires: reviewName,
          bindTo: "response",
          ...gate.policy,
        },
      },
    );
  });

  const concierge = build({
    stages: [
      {
        id: "active",
        match: (ctx) => ctx.pathname === ACTIVE_CONTEXT.pathname,
        actions: [review, ...gated],
      },
    ],
    consentProfile: profile,
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
    report(index, responseId, outcome = "completed") {
      const callback = callbacks[index];
      if (callback === undefined) {
        throw new Error(`No delivery callback at index ${index}.`);
      }
      callback({ responseId, outcome });
    },
  };
}

async function loadCatalogFloorBypass(id) {
  const source = readFileSync(DIST_PATH, "utf8");
  const needle = "consentProfile: capturedConsent.profile,";
  expect(source.split(needle)).toHaveLength(2);
  const bypassed = source.replace(
    needle,
    'consentProfile: Object.freeze({ consentGrade: "delivered", userTurnIdentity: "none" }),',
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
});
