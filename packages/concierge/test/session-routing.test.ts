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

function sessionFor(actions, options = {}) {
  const concierge = conciergeFor(createConcierge, actions, options.concierge);
  const harness = transportHarness(options.transport);
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: options.initialContext ?? ACTIVE,
    presentOutcome: options.presentOutcome ?? (async () => ({ outcome: "completed" })),
    onDiagnostic: options.onDiagnostic,
  });
  return { concierge, harness, session };
}

it("routes accepted batches through one FIFO", async () => {
  const order = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const { harness, session } = sessionFor([
    action("run", async ({ args }) => {
      order.push(`start:${args.value}`);
      if (args.value === 1) await firstGate;
      order.push(`end:${args.value}`);
      return { ok: true, message: `Done ${args.value}.` };
    }),
  ]);
  const catalog = session.catalog();
  const first = harness.dispatch(batch(catalog, [
    call("first", "run", 0, JSON.stringify({ value: 1 })),
  ], { responseId: "response-1" }));
  const second = harness.dispatch(batch(catalog, [
    call("second", "run", 0, JSON.stringify({ value: 2 })),
  ], { responseId: "response-2" }));

  await flush();
  expect(order).toEqual(["start:1"]);
  releaseFirst();
  const [firstOutcome, secondOutcome] = await Promise.all([first, second]);
  expect(order).toEqual(["start:1", "end:1", "start:2", "end:2"]);
  expect(firstOutcome.rows[0].callId).toBe("first");
  expect(secondOutcome.rows[0].callId).toBe("second");
  await session.stop();
});

it("cancels active and queued old-epoch work before publishing a new availability epoch", async () => {
  let enabled = true;
  let entries = 0;
  const { harness, session } = sessionFor([
    action("run", ({ meta }) => {
      entries += 1;
      return new Promise((resolve) => {
        meta.signal.addEventListener("abort", () => {
          resolve({ ok: false, reason: "aborted", message: "Old epoch cancelled." });
        });
      });
    }, { availableWhen: () => enabled }),
  ]);
  const oldCatalog = session.catalog();
  const first = harness.dispatch(batch(oldCatalog, [call("first", "run")], {
    responseId: "response-1",
  }));
  const queued = harness.dispatch(batch(oldCatalog, [call("queued", "run")], {
    responseId: "response-2",
  }));
  await flush();
  expect(entries).toBe(1);

  enabled = false;
  session.setContext(ACTIVE);
  const [firstOutcome, queuedOutcome] = await Promise.all([first, queued]);
  expect(firstOutcome.rows[0].result.reason).toBe("aborted");
  expect(queuedOutcome.rows[0].result.reason).toBe("catalog_stale");
  expect(entries).toBe(1);
  expect(session.catalog().tools).toEqual([]);
  await session.stop();
});

it("composes a transport cancellation signal with the catalog epoch", async () => {
  const controller = new AbortController();
  controller.abort();
  let entries = 0;
  const { harness, session } = sessionFor([
    action("run", () => {
      entries += 1;
      return { ok: true, message: "Done." };
    }),
  ]);
  const outcome = await harness.dispatch(batch(
    session.catalog(),
    [call("cancelled", "run")],
    { signal: controller.signal },
  ));

  expect(outcome.rows[0].result.reason).toBe("aborted");
  expect(entries).toBe(0);
  await session.stop();
});

it("returns an empty completed outcome for a pre-context batch", async () => {
  const diagnostics = [];
  const concierge = conciergeFor(createConcierge, [
    action("run", () => ({ ok: true, message: "Done." })),
  ]);
  const harness = transportHarness();
  const session = createSession({
    concierge,
    transport: harness.transport,
    presentOutcome: async () => ({ outcome: "completed" }),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  const catalog = concierge.resolveCatalog(ACTIVE);
  const outcome = await harness.dispatch(batch(catalog, [call("early", "run")]));

  expect(outcome).toEqual({ kind: "completed", rows: [] });
  expect(diagnostics.map((item) => item.code)).toEqual(["batch_without_context"]);
  session.setContext(ACTIVE);
  await session.stop();
});

it("preserves complete batch identity through Session into the handler", async () => {
  let observed;
  const { harness, session } = sessionFor([
    action("run", ({ meta }) => {
      observed = meta;
      return { ok: true, message: "Done." };
    }),
  ]);
  const catalog = session.catalog();
  const outcome = await harness.dispatch(batch(catalog, [call("call-7", "run", 7)], {
    sessionId: "session-7",
    responseId: "response-7",
    userTurnId: "turn-7",
  }));

  expect(observed).toMatchObject({
    callId: "call-7",
    responseId: "response-7",
    userTurnId: "turn-7",
    outputIndex: 7,
  });
  expect(outcome.rows[0]).toMatchObject({ callId: "call-7", name: "run", outputIndex: 7 });
  await session.stop();
});

it("contains malformed batch metadata as correlated invalid rows", async () => {
  let entries = 0;
  const { harness, session } = sessionFor([
    action("run", () => {
      entries += 1;
      return { ok: true, message: "Done." };
    }),
  ]);
  const malformed = batch(session.catalog(), [call("one", "run")]);
  Object.defineProperty(malformed, "responseId", {
    get() {
      throw new Error("private response getter");
    },
  });
  const outcome = await harness.dispatch(malformed);

  expect(outcome.rows).toHaveLength(1);
  expect(outcome.rows[0]).toMatchObject({
    callId: "one",
    name: "run",
    result: { ok: false, reason: "invalid_invocation" },
  });
  expect(entries).toBe(0);
  await session.stop();
});

it("snapshots an accepted queued batch before caller mutation", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const observed = [];
  const { harness, session } = sessionFor([
    action("run", async ({ args }) => {
      observed.push(args.value);
      if (args.value === 1) await gate;
      return { ok: true, message: "Done." };
    }),
  ]);
  const catalog = session.catalog();
  const first = harness.dispatch(batch(catalog, [
    call("first", "run", 0, JSON.stringify({ value: 1 })),
  ], { responseId: "first" }));
  const queuedCall = call("second", "run", 0, JSON.stringify({ value: 2 }));
  const queuedCalls = [queuedCall];
  const second = harness.dispatch(batch(catalog, queuedCalls, { responseId: "second" }));
  queuedCall.callId = "mutated-call";
  queuedCall.name = "mutated-action";
  queuedCall.arguments = JSON.stringify({ value: 998 });
  queuedCall.outputIndex = 99;
  queuedCalls[0] = call("mutated", "run", 0, JSON.stringify({ value: 999 }));
  await flush();
  release();
  const [, outcome] = await Promise.all([first, second]);

  expect(observed).toEqual([1, 2]);
  expect(outcome.rows[0].callId).toBe("second");
  await session.stop();
});

it("neutralizes queued accessors and malformed calls containers at acceptance", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const observed = [];
  const { harness, session } = sessionFor([
    action("run", async ({ args }) => {
      observed.push(args.value);
      if (args.value === 1) await gate;
      return { ok: true, message: "Done." };
    }),
  ]);
  const catalog = session.catalog();
  const first = harness.dispatch(batch(catalog, [
    call("first", "run", 0, JSON.stringify({ value: 1 })),
  ], { responseId: "first-accessor" }));

  let accessorValue = JSON.stringify({ value: 2 });
  const accessorCall = {
    callId: "accessor",
    name: "run",
    outputIndex: 0,
    get arguments() {
      return accessorValue;
    },
  };
  const queued = harness.dispatch(batch(catalog, [accessorCall], {
    responseId: "queued-accessor",
  }));
  accessorValue = JSON.stringify({ value: 999 });
  await flush();
  release();
  const [, rejected] = await Promise.all([first, queued]);

  expect(observed).toEqual([1]);
  expect(rejected.rows).toHaveLength(1);
  expect(rejected.rows[0].result).toMatchObject({
    ok: false,
    reason: "invalid_invocation",
  });

  const malformed = batch(catalog, []);
  Object.defineProperty(malformed, "calls", {
    get() {
      throw new Error("private calls getter");
    },
  });
  const malformedOutcome = await harness.dispatch(malformed);
  expect(malformedOutcome.rows).toHaveLength(1);
  expect(malformedOutcome.rows[0].result).toMatchObject({
    ok: false,
    reason: "invalid_invocation",
  });
  await session.stop();
});
