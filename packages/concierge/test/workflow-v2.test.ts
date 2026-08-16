import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const CONTRACT_KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const ACTIVE = Object.freeze({ page: "active" });

let createConcierge;

beforeAll(async () => {
  if (!existsSync(fileURLToPath(DIST_URL))) throw new Error("Build concierge before testing.");
  ({ createConcierge } = await import(DIST_URL.href));
});

beforeEach(() => {
  delete globalThis[CONTRACT_KEY];
});

function schema() {
  return {
    "~standard": { version: 1, vendor: "workflow-v2", validate: (value) => ({ value }) },
  };
}

function action(name, handler, options = {}) {
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

function create(actions, options = {}) {
  const { alternateActions = [], ...config } = options;
  return createConcierge({
    stages: [
      {
        id: "active",
        match: (context) => context.page === "active",
        actions,
      },
      {
        id: "alternate",
        match: (context) => context.page === "alternate",
        actions: alternateActions,
      },
    ],
    ...config,
  });
}

function request(concierge, name, identity = "root") {
  return {
    name,
    input: {},
    catalogRevision: concierge.resolveCatalog(ACTIVE).revision,
    identity: {
      sessionId: "session",
      responseId: "response",
      callId: identity,
      userTurnId: "turn",
      outputIndex: 0,
    },
  };
}

it("runs unawaited children before parent cleanup and honors context overrides", async () => {
  const order = [];
  const seenStages = [];
  const actions = [];
  actions.push(action("child", ({ args }) => {
    order.push(`child:${args.value}`);
    return { ok: true, message: "Child." };
  }));
  actions.push(action("parent", ({ workflow }) => {
    workflow.cleanup(() => order.push("cleanup"));
    void workflow.run({ stepId: "unawaited", name: "child", input: { value: 1 } });
    void workflow.run({
      stepId: "alternate",
      name: "observe-stage",
      input: {},
      context: { page: "alternate" },
    });
    order.push("parent:return");
    return { ok: true, message: "Parent." };
  }));
  const observeStage = action("observe-stage", ({ meta }) => {
    seenStages.push(meta.callId);
    return { ok: true, message: "Observed." };
  });
  const concierge = create(actions, { alternateActions: [observeStage] });
  const events = [];
  concierge.onDispatch((event) => events.push(event));

  await concierge.dispatch(ACTIVE, request(concierge, "parent"));
  await Promise.resolve();
  expect(order).toEqual(["parent:return", "child:1", "cleanup"]);
  expect(seenStages).toHaveLength(1);
  const alternate = events.find((event) => event.lineage.stepId === "alternate");
  expect(alternate.stage).toBe("alternate");
});

it("uses the injected scheduler for delay and propagates cancellation", async () => {
  const tasks = [];
  const concierge = create([
    action("parent", async ({ workflow }) => {
      try {
        await workflow.delay(50);
        return { ok: true, message: "Delayed." };
      } catch {
        return { ok: false, reason: "aborted", message: "Cancelled." };
      }
    }),
  ], {
    scheduler(fn, delay) {
      const task = { fn, delay, cancelled: false };
      tasks.push(task);
      return () => {
        task.cancelled = true;
      };
    },
  });
  const controller = new AbortController();
  const invocation = request(concierge, "parent");
  invocation.signal = controller.signal;
  const pending = concierge.dispatch(ACTIVE, invocation);
  for (let index = 0; index < 12 && tasks.length === 0; index += 1) {
    await Promise.resolve();
  }
  expect(tasks[0].delay).toBe(50);
  controller.abort();
  const result = await pending;
  expect(result).toMatchObject({ ok: false, reason: "aborted" });
  expect(tasks[0].cancelled).toBe(true);
});

it("closes the same-tick timer-ready cancellation race", async () => {
  const tasks = [];
  const concierge = create([
    action("parent", async ({ workflow }) => {
      try {
        await workflow.delay(1);
        return { ok: true, message: "Delayed." };
      } catch {
        return { ok: false, reason: "aborted", message: "Cancelled." };
      }
    }),
  ], {
    scheduler(fn) {
      const task = { fn };
      tasks.push(task);
      return () => {};
    },
  });
  const controller = new AbortController();
  const invocation = request(concierge, "parent", "same-tick");
  invocation.signal = controller.signal;
  const pending = concierge.dispatch(ACTIVE, invocation);
  for (let index = 0; index < 12 && tasks.length === 0; index += 1) {
    await Promise.resolve();
  }
  tasks[0].fn();
  controller.abort();
  await expect(pending).resolves.toMatchObject({ ok: false, reason: "aborted" });
});

it("contains scheduler failure", async () => {
  let schedulerCalls = 0;
  const concierge = create([
    action("parent", async ({ workflow }) => {
      await workflow.delay(1);
      return { ok: true, message: "Parent." };
    }),
  ], {
    scheduler() {
      schedulerCalls += 1;
      throw new Error("private scheduler failure");
    },
  });
  const result = await concierge.dispatch(ACTIVE, request(concierge, "parent"));
  expect(result).toMatchObject({ ok: false, reason: "handler_error" });
  expect(schedulerCalls).toBe(1);
});

it("runs cleanup LIFO while preserving an earlier child failure", async () => {
  const order = [];
  const concierge = create([
    action("fail", () => ({ ok: false, reason: "handler_error", message: "Failed." })),
    action("parent", async ({ workflow }) => {
      workflow.cleanup(() => order.push("first"));
      workflow.cleanup(() => order.push("second"));
      await workflow.run({ stepId: "fail", name: "fail", input: {} });
      return { ok: true, message: "Parent." };
    }),
  ]);
  const result = await concierge.dispatch(ACTIVE, request(concierge, "parent"));
  expect(result).toMatchObject({ ok: false, reason: "handler_error" });
  expect(order).toEqual(["second", "first"]);
});

it("enforces workflow depth and step limits", async () => {
  let concierge;
  const recurse = action("recurse", async ({ args, workflow }) => {
    if (args.remaining === 0) return { ok: true, message: "Leaf." };
    return workflow.run({
      stepId: `depth-${args.remaining}`,
      name: "recurse",
      input: { remaining: args.remaining - 1 },
    });
  });
  const fanout = action("fanout", async ({ workflow }) => {
    const results = await Promise.all([
      workflow.run({ stepId: "one", name: "leaf", input: {} }),
      workflow.run({ stepId: "two", name: "leaf", input: {} }),
    ]);
    return results[1];
  });
  concierge = create([
    recurse,
    fanout,
    action("leaf", () => ({ ok: true, message: "Leaf." })),
  ], { maxWorkflowDepth: 1, maxWorkflowSteps: 1 });
  const catalog = concierge.resolveCatalog(ACTIVE);
  const depth = await concierge.dispatch(ACTIVE, {
    ...request(concierge, "recurse", "depth"),
    input: { remaining: 2 },
    catalogRevision: catalog.revision,
  });
  const steps = await concierge.dispatch(ACTIVE, request(concierge, "fanout", "steps"));
  expect(depth).toMatchObject({ ok: false, reason: "handler_error" });
  expect(steps).toMatchObject({ ok: false, reason: "handler_error" });
});

it("does not let pre-parent consent authority flow into a gated child", async () => {
  let gatedCalls = 0;
  const delivery = [];
  const concierge = create([
    action("review", () => ({ ok: true, message: "Review." })),
    action("gated", () => {
      gatedCalls += 1;
      return { ok: true, message: "Gated." };
    }, { consent: { requires: "review", bindTo: "response" } }),
    action("parent", async ({ workflow }) => workflow.run({
      stepId: "gated",
      name: "gated",
      input: {},
    })),
  ], {
    consentProfile: { consentGrade: "relayed", userTurnIdentity: "human-attested" },
  });
  const catalog = concierge.resolveCatalog(ACTIVE);
  const review = request(concierge, "review", "review-call");
  review.identity.responseId = "review-response";
  review.identity.userTurnId = "review-turn";
  review.deferUntilDelivered = (effect) => delivery.push(effect);
  await concierge.dispatch(ACTIVE, review);
  expect(delivery).toHaveLength(1);
  delivery[0]({ responseId: "review-response", outcome: "completed" });
  await Promise.resolve();
  await Promise.resolve();

  const parent = request(concierge, "parent", "parent-call");
  parent.catalogRevision = catalog.revision;
  parent.identity.responseId = "parent-response";
  parent.identity.userTurnId = "parent-turn";
  const result = await concierge.dispatch(ACTIVE, parent);
  expect(result).toMatchObject({ ok: false, reason: "consent_required" });
  expect(gatedCalls).toBe(0);
});

it("does not let a concurrent root review arm consent for a paused child", async () => {
  let releaseParent;
  let parentReady;
  const ready = new Promise((resolve) => {
    parentReady = resolve;
  });
  const gate = new Promise((resolve) => {
    releaseParent = resolve;
  });
  let gatedCalls = 0;
  const delivery = [];
  const concierge = create([
    action("review", () => ({ ok: true, message: "Review." })),
    action("gated", () => {
      gatedCalls += 1;
      return { ok: true, message: "Gated." };
    }, { consent: { requires: "review", bindTo: "response" } }),
    action("parent", async ({ workflow }) => {
      parentReady();
      await gate;
      return workflow.run({ stepId: "gated", name: "gated", input: {} });
    }),
  ], {
    consentProfile: { consentGrade: "relayed", userTurnIdentity: "human-attested" },
  });
  const parent = concierge.dispatch(ACTIVE, request(concierge, "parent", "parent"));
  await ready;
  const review = request(concierge, "review", "review");
  review.identity.responseId = "review-response";
  review.identity.userTurnId = "review-turn";
  review.deferUntilDelivered = (effect) => delivery.push(effect);
  await concierge.dispatch(ACTIVE, review);
  delivery[0]({ responseId: "review-response", outcome: "completed" });
  await Promise.resolve();
  releaseParent();

  await expect(parent).resolves.toMatchObject({
    ok: false,
    reason: "consent_required",
  });
  expect(gatedCalls).toBe(0);
});
