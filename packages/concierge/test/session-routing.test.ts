import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it as vitestIt } from "vitest";

import { CONVERSATIONAL_CAPABILITIES } from "./fixtures/stub-transport.js";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const CONTEXT = Object.freeze({ page: "routing" });
const CATALOG = Object.freeze([]);

let createSession;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the session routing suite.",
    );
  }

  const artifact = await import(DIST_URL.href);
  createSession = artifact.createSession;
});

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

function it(title, run) {
  const pattern = globalThis.__vitest_worker__?.config?.testNamePattern;
  if (pattern instanceof RegExp) {
    pattern.lastIndex = 0;
    const selected = pattern.test(title);
    pattern.lastIndex = 0;
    if (!selected) return;
  }
  vitestIt(title, run);
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return Object.freeze({ promise, resolve });
}

async function flushMicrotasks() {
  for (let index = 0; index < 24; index += 1) await Promise.resolve();
}

function result(message) {
  return Object.freeze({ ok: true, message });
}

function row(callId, actionResult = result(`handled:${callId}`)) {
  return Object.freeze({ callId, result: actionResult });
}

function toolCall(callId, outputIndex = 0) {
  return Object.freeze({
    callId,
    name: "run",
    arguments: "{}",
    outputIndex,
  });
}

function toolBatch(responseId, callIds = [responseId], extra = {}) {
  return Object.freeze({
    responseId,
    calls: Object.freeze(
      callIds.map((callId, index) => toolCall(callId, index)),
    ),
    ...extra,
  });
}

function conciergeDouble(dispatchBatch) {
  return {
    catalogFor(context) {
      if (context !== CONTEXT) throw new Error("unexpected context");
      return CATALOG;
    },
    stageFor(context) {
      if (context !== CONTEXT) throw new Error("unexpected context");
      return "routing";
    },
    dispatchBatch,
    dispatch: () => Promise.resolve(result("unused")),
    explain: () => ({ stage: "routing", stages: [], catalog: [] }),
  };
}

function controlledTransport({ respond } = {}) {
  let status = "idle";
  let nextToken = 0;
  const statusSubscribers = new Map();
  const batchSubscribers = new Map();
  const publications = [];
  const responses = [];

  const transport = Object.freeze({
    capabilities: CONVERSATIONAL_CAPABILITIES,
    get status() {
      return status;
    },
    setTools(tools) {
      publications.push(tools);
    },
    onStatusChange(callback) {
      const token = ++nextToken;
      statusSubscribers.set(token, callback);
      return () => statusSubscribers.delete(token);
    },
    onToolBatch(callback) {
      const token = ++nextToken;
      batchSubscribers.set(token, callback);
      return () => batchSubscribers.delete(token);
    },
    respond(callId, actionResult) {
      const attempt = Object.freeze({ callId, result: actionResult });
      responses.push(attempt);
      respond?.(attempt, responses.length);
    },
  });

  return Object.freeze({
    transport,
    publications,
    responses,
    emitBatch(batch) {
      for (const callback of [...batchSubscribers.values()]) callback(batch);
    },
    emitStatus(nextStatus) {
      if (nextStatus === status) return;
      status = nextStatus;
      for (const callback of [...statusSubscribers.values()]) {
        callback(nextStatus);
      }
    },
  });
}

function trackedSignal(onRemove = () => {}) {
  let aborted = false;
  const listeners = new Set();
  return Object.freeze({
    signal: Object.freeze({
      get aborted() {
        return aborted;
      },
      addEventListener(type, listener) {
        if (type === "abort") listeners.add(listener);
      },
      removeEventListener(type, listener) {
        if (type !== "abort") return;
        listeners.delete(listener);
        onRemove();
      },
    }),
    abort() {
      if (aborted) return;
      aborted = true;
      for (const listener of [...listeners]) listener();
    },
    listenerCount() {
      return listeners.size;
    },
  });
}

it("[J01] keeps complete batch work FIFO through responses and finalization", async () => {
  const marker = "[RED:J01:cross-batch-fifo]";
  const releaseA = deferred();
  const finished = deferred();
  const events = [];
  let active = 0;
  let maximum = 0;

  const signalA = trackedSignal(() => {
    events.push("finalize:A");
    active -= 1;
  });
  const signalB = trackedSignal(() => {
    events.push("finalize:B");
    active -= 1;
    finished.resolve();
  });
  const concierge = conciergeDouble(async (_context, batch) => {
    active += 1;
    maximum = Math.max(maximum, active);
    events.push(`dispatch:${batch.responseId}`);
    if (batch.responseId === "A") {
      await releaseA.promise;
      return Object.freeze([row("a-1"), row("a-2")]);
    }
    return Object.freeze([row("b-1")]);
  });
  const harness = controlledTransport({
    respond: ({ callId }) => events.push(`respond:${callId}`),
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: CONTEXT,
  });

  harness.emitBatch(toolBatch("A", ["a-1", "a-2"], { signal: signalA.signal }));
  harness.emitBatch(toolBatch("B", ["b-1"], { signal: signalB.signal }));
  await flushMicrotasks();

  expect(events, marker).toEqual(["dispatch:A"]);
  expect(maximum, marker).toBe(1);

  releaseA.resolve();
  await finished.promise;

  expect(
    {
      active,
      events,
      maximum,
      signalAListeners: signalA.listenerCount(),
      signalBListeners: signalB.listenerCount(),
    },
    marker,
  ).toEqual({
    active: 0,
    events: [
      "dispatch:A",
      "respond:a-1",
      "respond:a-2",
      "finalize:A",
      "dispatch:B",
      "respond:b-1",
      "finalize:B",
    ],
    maximum: 1,
    signalAListeners: 0,
    signalBListeners: 0,
  });
  await session.stop();
});

it("[J02] treats repeated delivery of one batch object as distinct accepted occurrences", async () => {
  const marker = "[RED:J02:accepted-occurrence-once]";
  const finished = deferred();
  let dispatchEntries = 0;
  const observed = [];
  const shared = toolBatch("shared", ["same-call"]);
  const concierge = conciergeDouble(async (_context, batch) => {
    dispatchEntries += 1;
    observed.push(batch);
    return Object.freeze([row("same-call")]);
  });
  const harness = controlledTransport({
    respond: (_attempt, occurrence) => {
      if (occurrence === 2) finished.resolve();
    },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: CONTEXT,
  });

  harness.emitBatch(shared);
  harness.emitBatch(shared);
  await finished.promise;

  expect(
    {
      dispatchEntries,
      facadeCount: observed.length,
      facadeDistinct: observed[0] !== observed[1],
      responses: harness.responses.map(({ callId }) => callId),
    },
    marker,
  ).toEqual({
    dispatchEntries: 2,
    facadeCount: 2,
    facadeDistinct: true,
    responses: ["same-call", "same-call"],
  });
  await session.stop();
});

it("[J03] attempts every returned row once in dispatcher order without rewriting it", async () => {
  const marker = "[RED:J03:row-response-cardinality]";
  const finished = deferred();
  const results = [result("third"), result("first"), result("second")];
  const returnedRows = Object.freeze([
    row("third", results[0]),
    row("first", results[1]),
    row("second", results[2]),
  ]);
  const concierge = conciergeDouble(async () => returnedRows);
  const harness = controlledTransport({
    respond: (_attempt, occurrence) => {
      if (occurrence === returnedRows.length) finished.resolve();
    },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: CONTEXT,
  });

  harness.emitBatch(toolBatch("rows"));
  await finished.promise;

  expect(
    {
      attempts: harness.responses.map(({ callId }) => callId),
      resultIdentity: harness.responses.map(
        ({ result: attempted }, index) => attempted === results[index],
      ),
    },
    marker,
  ).toEqual({
    attempts: ["third", "first", "second"],
    resultIdentity: [true, true, true],
  });
  await session.stop();
});

it("[J04] diagnoses one thrown response without retrying or blocking later work", async () => {
  const marker = "[RED:J04:response-throw-no-retry]";
  const finished = deferred();
  const diagnostics = [];
  const dispatches = [];
  const concierge = conciergeDouble(async (_context, batch) => {
    dispatches.push(batch.responseId);
    return batch.responseId === "A"
      ? Object.freeze([row("a-first"), row("a-later")])
      : Object.freeze([row("b-only")]);
  });
  const harness = controlledTransport({
    respond: ({ callId }, occurrence) => {
      if (occurrence === 1) throw new Error("PRIVATE-RESPONSE-SENTINEL");
      if (callId === "b-only") finished.resolve();
    },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: CONTEXT,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });

  harness.emitBatch(toolBatch("A"));
  harness.emitBatch(toolBatch("B"));
  await finished.promise;

  expect(
    {
      attempts: harness.responses.map(({ callId }) => callId),
      diagnostics,
      dispatches,
      leaked: JSON.stringify({ diagnostics, responses: harness.responses }).includes(
        "PRIVATE-RESPONSE-SENTINEL",
      ),
    },
    marker,
  ).toEqual({
    attempts: ["a-first", "a-later", "b-only"],
    diagnostics: [
      {
        code: "response_failed",
        message: "The transport rejected a result; it was not retried.",
      },
    ],
    dispatches: ["A", "B"],
    leaked: false,
  });
  await session.stop();
});

it("[J05] contains a structural dispatchBatch throw and advances the pump", async () => {
  const marker = "[RED:J05:dispatch-throw-contained]";
  const finished = deferred();
  const diagnostics = [];
  const dispatches = [];
  const concierge = conciergeDouble(async (_context, batch) => {
    dispatches.push(batch.responseId);
    if (batch.responseId === "A") {
      throw new Error("PRIVATE-DISPATCH-SENTINEL");
    }
    return Object.freeze([row("b-only")]);
  });
  const harness = controlledTransport({
    respond: ({ callId }) => {
      if (callId === "b-only") finished.resolve();
    },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: CONTEXT,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });

  harness.emitBatch(toolBatch("A"));
  harness.emitBatch(toolBatch("B"));
  await finished.promise;

  expect(
    {
      attempts: harness.responses.map(({ callId }) => callId),
      diagnostics,
      dispatches,
      leaked: JSON.stringify(diagnostics).includes("PRIVATE-DISPATCH-SENTINEL"),
    },
    marker,
  ).toEqual({
    attempts: ["b-only"],
    diagnostics: [
      {
        code: "batch_dispatch_failed",
        message:
          "The dispatcher could not complete an accepted batch; later batches will continue.",
      },
    ],
    dispatches: ["A", "B"],
    leaked: false,
  });
  await session.stop();
});

it("[J06] rejects a pre-context batch instead of queuing it for later", async () => {
  const marker = "[RED:J06:without-context-rejected]";
  const finished = deferred();
  const diagnostics = [];
  const dispatches = [];
  const concierge = conciergeDouble(async (_context, batch) => {
    dispatches.push(batch.responseId);
    return Object.freeze([row(batch.responseId)]);
  });
  const harness = controlledTransport({
    respond: ({ callId }) => {
      if (callId === "after") finished.resolve();
    },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });

  harness.emitBatch(toolBatch("before"));
  await flushMicrotasks();
  session.setContext(CONTEXT);
  harness.emitBatch(toolBatch("after"));
  await finished.promise;

  expect(
    {
      attempts: harness.responses.map(({ callId }) => callId),
      diagnostics,
      dispatches,
    },
    marker,
  ).toEqual({
    attempts: ["after"],
    diagnostics: [
      {
        code: "batch_without_context",
        message: "A batch arrived before session context was set and was ignored.",
      },
    ],
    dispatches: ["after"],
  });
  await session.stop();
});
