import { beforeEach, describe, expect, it } from "vitest";

import { createBridge, createConcierge, offPageResult } from "../dist/index.js";
import type { DeliveryReport } from "../dist/index.js";

const CONTRACT_KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const CONTEXT = Object.freeze({ page: "active" });

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[CONTRACT_KEY];
});

function schema() {
  return {
    "~standard": {
      version: 1,
      vendor: "action-bridges-test",
      validate: (value: unknown) => ({ value }),
    },
  };
}

function action(
  name: string,
  handler: (context: Record<string, unknown>) => unknown,
  options: Record<string, unknown> = {},
) {
  return {
    name,
    description: `Run ${name}.`,
    schema: schema(),
    jsonSchema: { type: "object" },
    redact: "drop",
    effects: { readOnly: true },
    handler,
    ...options,
  };
}

function bridge(marker: string) {
  return {
    marker,
    actions: {},
    snapshot: { marker: () => marker },
  };
}

function request(
  catalog: { revision: symbol },
  name: string,
  callId = name,
  responseId = "response-1",
) {
  return {
    name,
    input: {},
    catalogRevision: catalog.revision,
    identity: {
      sessionId: "session-1",
      responseId,
      callId,
      userTurnId: "turn-1",
      outputIndex: 0,
    },
  };
}

async function flushMicrotasks() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe("action-scoped bridge resolution", () => {
  it("supports heterogeneous action bridges with action precedence and stage fallback", async () => {
    const stageRegistry = createBridge("stage");
    const resultsRegistry = createBridge("results");
    const galleryRegistry = createBridge("gallery");
    stageRegistry.register(bridge("stage"));
    resultsRegistry.register(bridge("results"));
    galleryRegistry.register(bridge("gallery"));

    const actions = [
      action("results", ({ bridge: live }) => ({ ok: true, message: live?.marker ?? "missing" }), {
        bridge: resultsRegistry,
      }),
      action("gallery", ({ bridge: live }) => ({ ok: true, message: live?.marker ?? "missing" }), {
        bridge: galleryRegistry,
      }),
      action("fallback", ({ bridge: live }) => ({ ok: true, message: live?.marker ?? "missing" })),
    ];
    const concierge = createConcierge({
      stages: [{
        id: "active",
        match: (ctx: { page?: string }) => ctx.page === "active",
        bridge: stageRegistry,
        actions,
      }],
    });
    const catalog = concierge.resolveCatalog(CONTEXT);

    await expect(concierge.dispatch(CONTEXT, request(catalog, "results"))).resolves.toMatchObject({ message: "results" });
    await expect(concierge.dispatch(CONTEXT, request(catalog, "gallery"))).resolves.toMatchObject({ message: "gallery" });
    await expect(concierge.dispatch(CONTEXT, request(catalog, "fallback"))).resolves.toMatchObject({ message: "stage" });

    expect(concierge.explain(CONTEXT).actions).toEqual([
      { name: "results", bridge: { id: "results", registered: true } },
      { name: "gallery", bridge: { id: "gallery", registered: true } },
      { name: "fallback", bridge: { id: "stage", registered: true } },
    ]);
  });

  it("uses an action bridge for a cross-stage action and returns null when it is unmounted", async () => {
    const stageRegistry = createBridge("stage");
    const crossRegistry = createBridge("cross");
    stageRegistry.register(bridge("stage"));
    const unregister = crossRegistry.register(bridge("cross"));
    const cross = action("navigate", ({ bridge: live }) => ({
      ok: true,
      message: live?.marker ?? "missing",
    }), { bridge: crossRegistry });
    const concierge = createConcierge({
      stages: [{
        id: "active",
        match: (ctx: { page?: string }) => ctx.page === "active",
        bridge: stageRegistry,
        actions: [],
      }],
      crossStage: [cross],
    });
    const catalog = concierge.resolveCatalog(CONTEXT);

    await expect(concierge.dispatch(CONTEXT, request(catalog, "navigate", "mounted"))).resolves.toMatchObject({ message: "cross" });
    unregister();
    await expect(concierge.dispatch(CONTEXT, request(catalog, "navigate", "unmounted"))).resolves.toMatchObject({ message: "missing" });
    expect(concierge.explain(CONTEXT).actions).toEqual([
      { name: "navigate", bridge: { id: "cross", registered: false } },
    ]);
  });

  it("resolves the effective bridge after the commit window", async () => {
    const stageRegistry = createBridge("stage");
    const unregister = stageRegistry.register(bridge("mounted"));
    const scheduled: Array<() => void> = [];
    let handlerBridge: unknown = "not-called";
    const destructive = action("destructive", ({ bridge: live }) => {
      handlerBridge = live;
      return live === null
        ? offPageResult("The selected result", "results page")
        : { ok: true, message: live.marker };
    }, {
      effects: { readOnly: false, destructive: true, idempotent: false },
    });
    const concierge = createConcierge({
      stages: [{
        id: "active",
        match: () => true,
        bridge: stageRegistry,
        actions: [destructive],
      }],
      commitWindowMs: 25,
      scheduler(callback) {
        scheduled.push(callback);
        return () => undefined;
      },
    });
    const catalog = concierge.resolveCatalog(CONTEXT);

    const result = concierge.dispatch(
      CONTEXT,
      request(catalog, "destructive"),
    );
    await flushMicrotasks();
    expect(scheduled).toHaveLength(1);

    unregister();
    expect(concierge.explain(CONTEXT).actions).toEqual([
      { name: "destructive", bridge: { id: "stage", registered: false } },
    ]);
    scheduled.shift()?.();

    await expect(result).resolves.toEqual(
      offPageResult("The selected result", "results page"),
    );
    expect(handlerBridge).toBe(null);
  });

  it("reads one effective bridge once and reuses it for consent capture and the handler", async () => {
    const first = bridge("first");
    const second = bridge("second");
    let reads = 0;
    let handlerBridge: unknown;
    const alternatingRegistry = Object.freeze({
      id: "alternating",
      register: () => () => undefined,
      read: () => {
        reads += 1;
        return reads === 1 ? first : second;
      },
    });
    const review = action("review", ({ bridge: live }) => {
      handlerBridge = live;
      return { ok: true, message: live?.marker ?? "missing" };
    }, { bridge: alternatingRegistry });
    const confirm = action("confirm", () => ({ ok: true, message: "Confirmed." }), {
      consent: { requires: "review", bindTo: "response" },
      effects: { readOnly: false, destructive: true, idempotent: false },
    });
    const concierge = createConcierge({
      stages: [{ id: "active", match: () => true, actions: [review, confirm] }],
      consentProfile: {
        consentGrade: "delivered",
        userTurnIdentity: "agent-forgeable",
      },
    });
    const catalog = concierge.resolveCatalog(CONTEXT);

    await expect(concierge.dispatch(CONTEXT, request(catalog, "review"))).resolves.toMatchObject({
      ok: true,
      message: "first",
    });
    expect(reads).toBe(1);
    expect(handlerBridge).toBe(first);
  });

  it("compares consent against the review bridge when the gated action uses the stage bridge", async () => {
    const stageRegistry = createBridge("stage");
    const reviewRegistry = createBridge("review");
    const reviewedState = { selected: "hotel-1" };
    stageRegistry.register({
      marker: "stage",
      actions: {},
      snapshot: { cart: () => ({ total: 125 }) },
    });
    reviewRegistry.register({
      marker: "review",
      actions: {},
      snapshot: { results: () => reviewedState },
    });

    const review = action("review", ({ bridge: live }) => ({
      ok: true,
      message: live?.marker ?? "missing",
    }), { bridge: reviewRegistry });
    const confirm = action("confirm", ({ bridge: live }) => ({
      ok: true,
      message: live?.marker ?? "missing",
    }), {
      consent: { requires: "review", bindTo: "response" },
      effects: { readOnly: false, destructive: true, idempotent: false },
    });
    const concierge = createConcierge({
      stages: [{
        id: "active",
        match: () => true,
        bridge: stageRegistry,
        actions: [review, confirm],
      }],
      consentProfile: {
        consentGrade: "relayed",
        userTurnIdentity: "human-attested",
      },
    });
    const catalog = concierge.resolveCatalog(CONTEXT);

    async function armReview(callId: string, responseId: string) {
      let observeDelivery: ((report: DeliveryReport) => void) | undefined;
      await concierge.dispatch(CONTEXT, {
        ...request(catalog, "review", callId, responseId),
        deferUntilDelivered(effect) {
          observeDelivery = effect;
        },
      });
      expect(observeDelivery).toBeTypeOf("function");
      observeDelivery?.({ responseId, outcome: "completed" });
    }

    await armReview("review-one", "review-response-one");
    await expect(concierge.dispatch(CONTEXT, {
      ...request(catalog, "confirm", "confirm-one", "confirm-response-one"),
    })).resolves.toEqual({ ok: true, message: "stage" });

    await armReview("review-two", "review-response-two");
    reviewedState.selected = "hotel-2";
    await expect(concierge.dispatch(CONTEXT, {
      ...request(catalog, "confirm", "confirm-two", "confirm-response-two"),
    })).resolves.toMatchObject({ ok: false, reason: "consent_stale" });
  });

  it("refreshes the consent snapshot after a gated action's commit window", async () => {
    const stageRegistry = createBridge("stage");
    const unregister = stageRegistry.register({
      marker: "stage",
      actions: {},
      snapshot: { selection: () => ({ id: "hotel-1" }) },
    });
    const scheduled: Array<() => void> = [];
    let confirmCalls = 0;
    const review = action("review", () => ({
      ok: true,
      message: "Reviewed.",
    }));
    const confirm = action("confirm", () => {
      confirmCalls += 1;
      return { ok: true, message: "Confirmed." };
    }, {
      consent: { requires: "review", bindTo: "response" },
      effects: { readOnly: false, destructive: true, idempotent: false },
    });
    const concierge = createConcierge({
      stages: [{
        id: "active",
        match: () => true,
        bridge: stageRegistry,
        actions: [review, confirm],
      }],
      commitWindowMs: 25,
      scheduler(callback) {
        scheduled.push(callback);
        return () => undefined;
      },
      consentProfile: {
        consentGrade: "relayed",
        userTurnIdentity: "human-attested",
      },
    });
    const catalog = concierge.resolveCatalog(CONTEXT);
    let observeDelivery: ((report: DeliveryReport) => void) | undefined;
    await concierge.dispatch(CONTEXT, {
      ...request(catalog, "review", "review", "review-response"),
      deferUntilDelivered(effect) {
        observeDelivery = effect;
      },
    });
    observeDelivery?.({ responseId: "review-response", outcome: "completed" });

    const result = concierge.dispatch(
      CONTEXT,
      request(catalog, "confirm", "confirm", "confirm-response"),
    );
    await flushMicrotasks();
    expect(scheduled).toHaveLength(1);

    unregister();
    scheduled.shift()?.();

    await expect(result).resolves.toMatchObject({
      ok: false,
      reason: "consent_stale",
    });
    expect(confirmCalls).toBe(0);
  });
});
