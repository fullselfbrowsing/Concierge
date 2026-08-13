import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it } from "vitest";

import {
  action,
  batch,
  call,
  conciergeFor,
  flush,
  transportHarness,
} from "./fixtures/v2-session.js";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const CONTRACT_KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const ACTIVE = Object.freeze({ page: "active" });

let createConcierge;
let createSession;

beforeAll(async () => {
  if (!existsSync(fileURLToPath(DIST_URL))) throw new Error("Build concierge before testing.");
  ({ createConcierge, createSession } = await import(DIST_URL.href));
});

beforeEach(() => {
  delete globalThis[CONTRACT_KEY];
});

function create(actions, options = {}) {
  const concierge = conciergeFor(createConcierge, actions);
  const harness = transportHarness(options.transport);
  const diagnostics = [];
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: options.presentOutcome ?? (async () => ({ outcome: "completed" })),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  return { diagnostics, harness, session };
}

it("returns one stop Promise and unregisters subscriptions exactly once", async () => {
  const { harness, session } = create([]);
  const first = session.stop();
  const second = session.stop();

  expect(second).toBe(first);
  await first;
  expect(harness.batchUnsubscribes).toBe(1);
  expect(harness.statusUnsubscribes).toBe(1);
  expect(() => session.setContext(ACTIVE)).toThrow("stopped");
});

it("aborts entered work and waits for an abort-ignoring handler to settle", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let observedSignal;
  const { harness, session } = create([
    action("slow", async ({ meta }) => {
      observedSignal = meta.signal;
      await gate;
      return { ok: true, message: "Done." };
    }),
  ]);
  const pending = harness.dispatch(batch(session.catalog(), [call("slow", "slow")]));
  await flush();
  const stopped = session.stop();
  let settled = false;
  stopped.then(() => {
    settled = true;
  });
  await flush();

  expect(observedSignal.aborted).toBe(true);
  expect(settled).toBe(false);
  release();
  await Promise.allSettled([pending, stopped]);
  expect(settled).toBe(true);
});

it("makes stale batch and status closures inert after stop", async () => {
  const { harness, session } = create([
    action("run", () => ({ ok: true, message: "Done." })),
  ]);
  const catalog = session.catalog();
  await session.stop();

  expect(() => harness.dispatch(batch(catalog, [call("late", "run")]))).toThrow(
    "No batch handler",
  );
  harness.setStatus("idle");
  harness.setStatus("connected");
  expect(harness.publications).toEqual([catalog]);
});

it("contains unsubscribe failures and resolves teardown", async () => {
  const concierge = conciergeFor(createConcierge, []);
  let statusHandler;
  let batchHandler;
  const diagnostics = [];
  const transport = {
    capabilities: Object.freeze({
      consentGrade: "none",
      userTurnIdentity: "none",
      parallelCalls: true,
      dynamicCatalog: true,
    }),
    status: "connected",
    setCatalog() {},
    onStatusChange(handler) {
      statusHandler = handler;
      return () => {
        throw new Error("private status cleanup");
      };
    },
    onToolBatch(handler) {
      batchHandler = handler;
      return () => {
        throw new Error("private batch cleanup");
      };
    },
  };
  const session = createSession({
    concierge,
    transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  expect(statusHandler).toBeTypeOf("function");
  expect(batchHandler).toBeTypeOf("function");

  await expect(session.stop()).resolves.toBeUndefined();
  expect(diagnostics.map((item) => item.code)).toEqual([
    "transport_unsubscribe_failed",
    "transport_unsubscribe_failed",
  ]);
});

it("rolls back partial construction when a subscription is malformed", () => {
  const concierge = conciergeFor(createConcierge, []);
  let statusCleanups = 0;
  let batchSubscriptions = 0;
  const transport = {
    capabilities: Object.freeze({
      consentGrade: "none",
      userTurnIdentity: "none",
      parallelCalls: true,
      dynamicCatalog: true,
    }),
    status: "connected",
    setCatalog() {},
    onStatusChange() {
      return () => {
        statusCleanups += 1;
      };
    },
    onToolBatch() {
      batchSubscriptions += 1;
      return null;
    },
  };

  expect(() => createSession({
    concierge,
    transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
  })).toThrow("could not start");
  expect(batchSubscriptions).toBe(1);
  expect(statusCleanups).toBe(1);
});

it("rolls back the status subscription when batch registration throws", () => {
  const concierge = conciergeFor(createConcierge, []);
  let statusCleanups = 0;
  const transport = {
    capabilities: Object.freeze({
      consentGrade: "none",
      userTurnIdentity: "none",
      parallelCalls: true,
      dynamicCatalog: true,
    }),
    status: "connected",
    setCatalog() {},
    onStatusChange() {
      return () => {
        statusCleanups += 1;
      };
    },
    onToolBatch() {
      throw new Error("private registration failure");
    },
  };

  expect(() => createSession({
    concierge,
    transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
  })).toThrow("could not start");
  expect(statusCleanups).toBe(1);
});

it("does not register batches after a malformed status subscription", () => {
  const concierge = conciergeFor(createConcierge, []);
  let batchSubscriptions = 0;
  const transport = {
    capabilities: Object.freeze({
      consentGrade: "none",
      userTurnIdentity: "none",
      parallelCalls: true,
      dynamicCatalog: true,
    }),
    status: "connected",
    setCatalog() {},
    onStatusChange() {
      return null;
    },
    onToolBatch() {
      batchSubscriptions += 1;
      return () => undefined;
    },
  };

  expect(() => createSession({
    concierge,
    transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
  })).toThrow("could not start");
  expect(batchSubscriptions).toBe(0);
});

it("stops automatically after terminal entry and rejects later context changes", async () => {
  const { harness, session } = create([
    action("finish", () => ({ ok: true, message: "Finished." }), { terminal: true }),
  ]);
  const outcome = await harness.dispatch(batch(
    session.catalog(),
    [call("finish", "finish")],
  ));
  expect(outcome.kind).toBe("terminal");
  expect(() => session.setContext(ACTIVE)).toThrow("stopped");
  await session.stop();
});

it("queues nested catalog notifications without emitting stale snapshots", async () => {
  let enabled = true;
  const { session } = create([
    action("conditional", () => ({ ok: true, message: "Done." }), {
      availableWhen: () => enabled,
    }),
  ]);
  const seen = [];
  session.onCatalogChange((catalog) => {
    seen.push(`first:${catalog.tools.length}`);
    if (catalog.tools.length === 0) {
      enabled = true;
      session.setContext(ACTIVE);
    }
  });
  session.onCatalogChange((catalog) => seen.push(`second:${catalog.tools.length}`));

  enabled = false;
  session.setContext(ACTIVE);
  expect(seen).toEqual(["first:0", "first:1", "second:1"]);
  await session.stop();
});
