import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it as vitestIt } from "vitest";

import { CONVERSATIONAL_CAPABILITIES } from "./fixtures/stub-transport.js";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const CONTEXT = Object.freeze({ page: "routing" });
const CATALOG = Object.freeze([]);

let createConcierge;
let createSession;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the session routing suite.",
    );
  }

  const artifact = await import(DIST_URL.href);
  createConcierge = artifact.createConcierge;
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

function controlledTransport({ respond, setTools } = {}) {
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
      setTools?.(tools, publications.length);
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

function testSchema(validate = (value) => ({ value })) {
  return {
    "~standard": {
      version: 1,
      vendor: "concierge-session-routing-test",
      validate,
    },
  };
}

function action(name, handler) {
  return {
    name,
    description: `the ${name} action`,
    schema: testSchema(),
    jsonSchema: { type: "object" },
    redact: "drop",
    effects: { readOnly: true },
    handler,
  };
}

function realConciergeFor(actions, stages) {
  return createConcierge({
    stages:
      stages ??
      [
        {
          id: "routing",
          match: (context) => context.page === CONTEXT.page,
          actions,
        },
      ],
  });
}

function countedSignal({ initiallyAborted = false, removeThrows = false } = {}) {
  let aborted = initiallyAborted;
  let additions = 0;
  let removals = 0;
  const listeners = new Set();
  const signal = Object.freeze({
    get aborted() {
      return aborted;
    },
    addEventListener(type, listener) {
      if (type !== "abort") return;
      additions += 1;
      listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type !== "abort") return;
      removals += 1;
      listeners.delete(listener);
      if (removeThrows) throw new Error("PRIVATE-REMOVE-SENTINEL");
    },
  });

  return Object.freeze({
    signal,
    abort() {
      if (aborted) return;
      aborted = true;
      for (const listener of [...listeners]) listener();
    },
    counts() {
      return Object.freeze({
        additions,
        listeners: listeners.size,
        removals,
      });
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

it("[J07] captures the exact context reference when each batch arrives", async () => {
  const marker = "[RED:J07:arrival-context]";
  const contextA = Object.freeze({ page: "routing", revision: "A" });
  const contextB = Object.freeze({ page: "routing", revision: "B" });
  const contextC = Object.freeze({ page: "routing", revision: "C" });
  const releaseA = deferred();
  const finished = deferred();
  const observedContexts = [];
  const concierge = {
    ...conciergeDouble(() => Promise.resolve(Object.freeze([]))),
    catalogFor: () => CATALOG,
    stageFor: () => "routing",
    async dispatchBatch(context, batch) {
      observedContexts.push(context);
      if (observedContexts.length === 1) await releaseA.promise;
      return Object.freeze([row(batch.responseId)]);
    },
  };
  const harness = controlledTransport({
    respond: ({ callId }) => {
      if (callId === "C") finished.resolve();
    },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: contextA,
  });

  harness.emitBatch(toolBatch("A"));
  session.setContext(contextB);
  harness.emitBatch(toolBatch("B"));
  session.setContext(contextC);
  harness.emitBatch(toolBatch("C"));
  await flushMicrotasks();

  expect(observedContexts, marker).toEqual([contextA]);
  releaseA.resolve();
  await finished.promise;

  expect(
    {
      contexts: observedContexts.map((context) => context.revision),
      exactReferences: [
        observedContexts[0] === contextA,
        observedContexts[1] === contextB,
        observedContexts[2] === contextC,
      ],
    },
    marker,
  ).toEqual({
    contexts: ["A", "B", "C"],
    exactReferences: [true, true, true],
  });
  await session.stop();
});

it("[J08] keeps same-catalog active and queued work live across context updates", async () => {
  const marker = "[RED:J08:same-catalog-no-abort]";
  const contextA = Object.freeze({ page: "routing", revision: "A" });
  const contextB = Object.freeze({ page: "routing", revision: "B" });
  const contextC = Object.freeze({ page: "routing", revision: "C" });
  const signalA = countedSignal();
  const signalB = countedSignal();
  const signalC = countedSignal();
  const releaseA = deferred();
  const finished = deferred();
  const entries = [];
  const concierge = {
    ...conciergeDouble(() => Promise.resolve(Object.freeze([]))),
    catalogFor: () => CATALOG,
    stageFor: () => "routing",
    async dispatchBatch(context, batch) {
      entries.push({
        aborted: batch.signal.aborted,
        context,
        responseId: batch.responseId,
      });
      if (entries.length === 1) await releaseA.promise;
      return Object.freeze([row(batch.responseId)]);
    },
  };
  const harness = controlledTransport({
    respond: ({ callId }) => {
      if (callId === "C") finished.resolve();
    },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: contextA,
  });

  harness.emitBatch(toolBatch("A", ["A"], { signal: signalA.signal }));
  session.setContext(contextB);
  harness.emitBatch(toolBatch("B", ["B"], { signal: signalB.signal }));
  session.setContext(contextC);
  harness.emitBatch(toolBatch("C", ["C"], { signal: signalC.signal }));
  await flushMicrotasks();

  expect(
    {
      activeAborted: entries[0]?.aborted,
      sourceListeners: [
        signalA.counts().listeners,
        signalB.counts().listeners,
        signalC.counts().listeners,
      ],
    },
    marker,
  ).toEqual({ activeAborted: false, sourceListeners: [1, 1, 1] });

  releaseA.resolve();
  await finished.promise;

  expect(
    {
      aborted: entries.map(({ aborted }) => aborted),
      contexts: entries.map(({ context }) => context.revision),
      exactNewest: entries[2]?.context === contextC,
      remainingListeners: [
        signalA.counts().listeners,
        signalB.counts().listeners,
        signalC.counts().listeners,
      ],
    },
    marker,
  ).toEqual({
    aborted: [false, false, false],
    contexts: ["A", "B", "C"],
    exactNewest: true,
    remainingListeners: [0, 0, 0],
  });
  await session.stop();
});

it("[J09] aborts active old-epoch work before publishing a new catalog", async () => {
  const marker = "[RED:J09:active-epoch-abort]";
  const catalogA = Object.freeze([{ name: "A" }]);
  const catalogB = Object.freeze([{ name: "B" }]);
  const contextA = Object.freeze({ page: "routing", revision: "A" });
  const contextB = Object.freeze({ page: "routing", revision: "B" });
  const release = deferred();
  const started = deferred();
  let activeSignal;
  let abortedAtPublication;
  const concierge = {
    ...conciergeDouble(() => Promise.resolve(Object.freeze([]))),
    catalogFor: (context) => (context === contextA ? catalogA : catalogB),
    stageFor: (context) => context.revision,
    async dispatchBatch(_context, batch) {
      activeSignal = batch.signal;
      started.resolve();
      await release.promise;
      return Object.freeze([]);
    },
  };
  const harness = controlledTransport({
    setTools(tools) {
      if (tools === catalogB) abortedAtPublication = activeSignal?.aborted;
    },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: contextA,
  });

  harness.emitBatch(toolBatch("active"));
  await started.promise;
  session.setContext(contextB);

  expect(
    { abortedAtPublication, activeAborted: activeSignal.aborted },
    marker,
  ).toEqual({ abortedAtPublication: true, activeAborted: true });
  release.resolve();
  await flushMicrotasks();
  await session.stop();
});

it("[J10] dispatches queued old-epoch work once with ordinary aborted rows", async () => {
  const marker = "[RED:J10:queued-epoch-abort]";
  const contextA = Object.freeze({ page: "old" });
  const contextB = Object.freeze({ page: "new" });
  const releaseA = deferred();
  const finished = deferred();
  const handlerEntries = [];
  const run = action("run", async ({ meta }) => {
    handlerEntries.push(meta.callId);
    if (meta.callId === "active") await releaseA.promise;
    return result(`handled:${meta.callId}`);
  });
  const real = realConciergeFor([], [
    {
      id: "old",
      match: (context) => context.page === "old",
      actions: [run],
    },
    {
      id: "new",
      match: (context) => context.page === "new",
      actions: [],
    },
  ]);
  const dispatchEntries = [];
  const concierge = {
    ...real,
    dispatchBatch(context, batch) {
      dispatchEntries.push({ aborted: batch.signal.aborted, responseId: batch.responseId });
      return real.dispatchBatch(context, batch);
    },
  };
  const harness = controlledTransport({
    respond: ({ callId }) => {
      if (callId === "queued") finished.resolve();
    },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: contextA,
  });

  harness.emitBatch(toolBatch("active", ["active"]));
  harness.emitBatch(toolBatch("queued", ["queued"]));
  await flushMicrotasks();
  session.setContext(contextB);
  releaseA.resolve();
  await finished.promise;

  const queuedAttempt = harness.responses.find(({ callId }) => callId === "queued");
  expect(
    {
      dispatchEntries,
      handlerEntries,
      queuedAttempt,
    },
    marker,
  ).toEqual({
    dispatchEntries: [
      { aborted: false, responseId: "active" },
      { aborted: true, responseId: "queued" },
    ],
    handlerEntries: ["active"],
    queuedAttempt: {
      callId: "queued",
      result: {
        ok: false,
        message: "The action was cancelled before it ran.",
        reason: "aborted",
      },
    },
  });
  await session.stop();
});

it("[J11] composes transport, epoch, and stop cancellation into one signal", async () => {
  const marker = "[RED:J11:three-source-signal]";
  const observations = [];

  async function runScenario(cause) {
    const catalogA = Object.freeze([{ name: `${cause}:A` }]);
    const catalogB = Object.freeze([{ name: `${cause}:B` }]);
    const contextA = Object.freeze({ page: `${cause}:A` });
    const contextB = Object.freeze({ page: `${cause}:B` });
    const upstream = countedSignal({ initiallyAborted: cause === "transport-before" });
    const started = deferred();
    const release = deferred();
    const responded = deferred();
    let composed;
    const concierge = {
      ...conciergeDouble(() => Promise.resolve(Object.freeze([]))),
      catalogFor: (context) => (context === contextA ? catalogA : catalogB),
      stageFor: (context) => context.page,
      async dispatchBatch(_context, batch) {
        composed = batch.signal;
        started.resolve();
        await release.promise;
        return Object.freeze([row(cause)]);
      },
    };
    const harness = controlledTransport({ respond: () => responded.resolve() });
    const session = createSession({
      concierge,
      transport: harness.transport,
      initialContext: contextA,
    });

    harness.emitBatch(toolBatch(cause, [cause], { signal: upstream.signal }));
    await started.promise;

    let stopping;
    if (cause === "transport-after") upstream.abort();
    if (cause === "epoch") session.setContext(contextB);
    if (cause === "stop") stopping = session.stop();
    const aborted = composed.aborted;
    release.resolve();
    if (stopping !== undefined) await stopping;
    else await responded.promise;
    if (cause !== "stop") await session.stop();

    observations.push({
      aborted,
      cause,
      counts: upstream.counts(),
    });
  }

  await runScenario("transport-before");
  await runScenario("transport-after");
  await runScenario("epoch");
  await runScenario("stop");

  expect(observations, marker).toEqual([
    {
      aborted: true,
      cause: "transport-before",
      counts: { additions: 0, listeners: 0, removals: 0 },
    },
    {
      aborted: true,
      cause: "transport-after",
      counts: { additions: 1, listeners: 0, removals: 1 },
    },
    {
      aborted: true,
      cause: "epoch",
      counts: { additions: 1, listeners: 0, removals: 1 },
    },
    {
      aborted: true,
      cause: "stop",
      counts: { additions: 1, listeners: 0, removals: 1 },
    },
  ]);
});

it("[J12] forwards evidence lazily through a frozen null-prototype facade", async () => {
  const marker = "[RED:J12:lazy-envelope-identity]";
  const releaseBlocker = deferred();
  const finished = deferred();
  const calls = Object.freeze([toolCall("lazy")]);
  const deferUntilDelivered = () => {};
  const upstream = countedSignal();
  const reads = {
    calls: 0,
    deferUntilDelivered: 0,
    responseId: 0,
    signal: 0,
    userTurnId: 0,
  };
  const sourceBatch = Object.defineProperties({}, {
    calls: {
      enumerable: true,
      get() {
        reads.calls += 1;
        return calls;
      },
    },
    deferUntilDelivered: {
      enumerable: true,
      get() {
        reads.deferUntilDelivered += 1;
        return deferUntilDelivered;
      },
    },
    responseId: {
      enumerable: true,
      get() {
        reads.responseId += 1;
        return "lazy-response";
      },
    },
    signal: {
      enumerable: true,
      get() {
        reads.signal += 1;
        return upstream.signal;
      },
    },
    userTurnId: {
      enumerable: true,
      get() {
        reads.userTurnId += 1;
        return "lazy-turn";
      },
    },
  });
  let dispatchCount = 0;
  let facadeObservation;
  const concierge = conciergeDouble(async (_context, batch) => {
    dispatchCount += 1;
    if (dispatchCount === 1) {
      await releaseBlocker.promise;
      return Object.freeze([]);
    }

    const readsAtEntry = { ...reads };
    const descriptors = Object.getOwnPropertyDescriptors(batch);
    facadeObservation = {
      callsSame: batch.calls === calls,
      compositeDistinct: batch.signal !== upstream.signal,
      descriptorShape: Object.fromEntries(
        Object.entries(descriptors).map(([key, descriptor]) => [
          key,
          {
            configurable: descriptor.configurable,
            enumerable: descriptor.enumerable,
            getter: typeof descriptor.get,
            setter: typeof descriptor.set,
            valuePresent: Object.hasOwn(descriptor, "value"),
          },
        ]),
      ),
      deferSame: batch.deferUntilDelivered === deferUntilDelivered,
      frozen: Object.isFrozen(batch),
      keys: Object.keys(batch),
      prototype: Object.getPrototypeOf(batch),
      readsAtEntry,
      responseId: batch.responseId,
      userTurnId: batch.userTurnId,
    };
    return Object.freeze([row("lazy")]);
  });
  const harness = controlledTransport({ respond: () => finished.resolve() });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: CONTEXT,
  });

  harness.emitBatch(toolBatch("blocker"));
  harness.emitBatch(sourceBatch);
  await flushMicrotasks();

  expect({ ...reads }, marker).toEqual({
    calls: 0,
    deferUntilDelivered: 0,
    responseId: 0,
    signal: 1,
    userTurnId: 0,
  });

  releaseBlocker.resolve();
  await finished.promise;

  const descriptor = {
    configurable: false,
    enumerable: true,
    getter: "function",
    setter: "undefined",
    valuePresent: false,
  };
  expect(
    { facadeObservation, reads },
    marker,
  ).toEqual({
    facadeObservation: {
      callsSame: true,
      compositeDistinct: true,
      descriptorShape: {
        responseId: descriptor,
        userTurnId: descriptor,
        calls: descriptor,
        signal: descriptor,
        deferUntilDelivered: descriptor,
      },
      deferSame: true,
      frozen: true,
      keys: [
        "responseId",
        "userTurnId",
        "calls",
        "signal",
        "deferUntilDelivered",
      ],
      prototype: null,
      readsAtEntry: {
        calls: 0,
        deferUntilDelivered: 0,
        responseId: 0,
        signal: 1,
        userTurnId: 0,
      },
      responseId: "lazy-response",
      userTurnId: "lazy-turn",
    },
    reads: {
      calls: 1,
      deferUntilDelivered: 1,
      responseId: 1,
      signal: 1,
      userTurnId: 1,
    },
  });
  await session.stop();
});

it("[J13] preserves exact batch metadata through a real Concierge handler", async () => {
  const marker = "[RED:J13:real-handler-meta]";
  const finished = deferred();
  let receivedMeta;
  let hookInvocations = 0;
  const deferUntilDelivered = () => {
    hookInvocations += 1;
  };
  const real = realConciergeFor([
    action("metadata", ({ meta }) => {
      receivedMeta = meta;
      return result("metadata handled");
    }),
  ]);
  const harness = controlledTransport({ respond: () => finished.resolve() });
  const session = createSession({
    concierge: real,
    transport: harness.transport,
    initialContext: CONTEXT,
  });

  harness.emitBatch({
    responseId: "exact-response",
    userTurnId: "exact-turn",
    calls: Object.freeze([
      Object.freeze({
        callId: "exact-call",
        name: "metadata",
        arguments: "{}",
        outputIndex: 4,
      }),
    ]),
    deferUntilDelivered,
  });
  await finished.promise;

  expect(
    {
      callId: receivedMeta?.callId,
      deferSame: receivedMeta?.deferUntilDelivered === deferUntilDelivered,
      hookInvocations,
      outputIndex: receivedMeta?.outputIndex,
      responseId: receivedMeta?.responseId,
      userTurnId: receivedMeta?.userTurnId,
    },
    marker,
  ).toEqual({
    callId: "exact-call",
    deferSame: true,
    hookInvocations: 0,
    outputIndex: 4,
    responseId: "exact-response",
    userTurnId: "exact-turn",
  });
  await session.stop();
});

it("[J14] fails closed for hostile structural cancellation signals", async () => {
  const marker = "[RED:J14:hostile-signal-fails-closed]";
  const diagnostics = [];
  const observations = [];

  async function runHostile(name, batch) {
    const finished = deferred();
    const concierge = conciergeDouble(async (_context, facade) => {
      observations.push({ aborted: facade.signal.aborted, name });
      return Object.freeze([row(name)]);
    });
    const harness = controlledTransport({ respond: () => finished.resolve() });
    const session = createSession({
      concierge,
      transport: harness.transport,
      initialContext: CONTEXT,
      onDiagnostic: (diagnostic) => diagnostics.push({ diagnostic, name }),
    });

    harness.emitBatch(batch);
    await finished.promise;
    await session.stop();
  }

  await runHostile("signal-getter", {
    responseId: "signal-getter",
    calls: Object.freeze([toolCall("signal-getter")]),
    get signal() {
      throw new Error("PRIVATE-SIGNAL-GETTER-SENTINEL");
    },
  });
  await runHostile(
    "malformed",
    toolBatch("malformed", ["malformed"], { signal: Object.freeze({}) }),
  );
  await runHostile("aborted-getter", {
    responseId: "aborted-getter",
    calls: Object.freeze([toolCall("aborted-getter")]),
    signal: Object.freeze({
      get aborted() {
        throw new Error("PRIVATE-ABORTED-GETTER-SENTINEL");
      },
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  await runHostile("add-throw", {
    responseId: "add-throw",
    calls: Object.freeze([toolCall("add-throw")]),
    signal: Object.freeze({
      aborted: false,
      addEventListener() {
        throw new Error("PRIVATE-ADD-SENTINEL");
      },
      removeEventListener() {},
    }),
  });

  const cleanupDiagnostics = [];
  const cleanupSignal = countedSignal({ removeThrows: true });
  const cleanupFinished = deferred();
  const cleanupHarness = controlledTransport({ respond: () => cleanupFinished.resolve() });
  const cleanupSession = createSession({
    concierge: conciergeDouble(async (_context, facade) => {
      observations.push({ aborted: facade.signal.aborted, name: "remove-throw" });
      return Object.freeze([row("remove-throw")]);
    }),
    transport: cleanupHarness.transport,
    initialContext: CONTEXT,
    onDiagnostic: (diagnostic) => cleanupDiagnostics.push(diagnostic),
  });
  cleanupHarness.emitBatch(
    toolBatch("remove-throw", ["remove-throw"], { signal: cleanupSignal.signal }),
  );
  await cleanupFinished.promise;
  await flushMicrotasks();
  await cleanupSession.stop();

  expect(
    {
      cleanupCounts: cleanupSignal.counts(),
      cleanupDiagnostics,
      diagnostics: diagnostics.map(({ diagnostic, name }) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        name,
      })),
      leaked: JSON.stringify({ cleanupDiagnostics, diagnostics, observations }).includes(
        "PRIVATE-",
      ),
      observations,
    },
    marker,
  ).toEqual({
    cleanupCounts: { additions: 1, listeners: 0, removals: 1 },
    cleanupDiagnostics: [
      {
        code: "abort_signal_failed",
        message: "A batch cancellation signal failed; the batch was treated as cancelled.",
      },
    ],
    diagnostics: [
      {
        code: "abort_signal_failed",
        message: "A batch cancellation signal failed; the batch was treated as cancelled.",
        name: "signal-getter",
      },
      {
        code: "abort_signal_failed",
        message: "A batch cancellation signal failed; the batch was treated as cancelled.",
        name: "malformed",
      },
      {
        code: "abort_signal_failed",
        message: "A batch cancellation signal failed; the batch was treated as cancelled.",
        name: "aborted-getter",
      },
      {
        code: "abort_signal_failed",
        message: "A batch cancellation signal failed; the batch was treated as cancelled.",
        name: "add-throw",
      },
    ],
    leaked: false,
    observations: [
      { aborted: true, name: "signal-getter" },
      { aborted: true, name: "malformed" },
      { aborted: true, name: "aborted-getter" },
      { aborted: true, name: "add-throw" },
      { aborted: false, name: "remove-throw" },
    ],
  });
});

function hostileBatch(field, secretPrefix) {
  let reads = 0;
  const definitions = {
    responseId: { enumerable: true, value: "parity-response" },
    userTurnId: { enumerable: true, value: "parity-turn" },
    calls: {
      enumerable: true,
      value: Object.freeze([
        Object.freeze({
          callId: "parity-call",
          name: "parity",
          arguments: "{}",
          outputIndex: 0,
        }),
      ]),
    },
    signal: { enumerable: true, value: undefined },
    deferUntilDelivered: { enumerable: true, value: () => {} },
  };
  definitions[field] = {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error(`${secretPrefix}:${reads}`);
    },
  };
  return Object.freeze({
    batch: Object.freeze(Object.defineProperties({}, definitions)),
    readCount: () => reads,
  });
}

function registerHostileParityTest(number, field, label) {
  it(`[J${number}] preserves Phase 6 totality for a throwing ${label} getter`, async () => {
    const marker = `[RED:J${number}:throwing-${label}-totality]`;
    const direct = hostileBatch(field, `PRIVATE-J${number}-DIRECT`);
    const routed = hostileBatch(field, `PRIVATE-J${number}-ROUTED`);
    const real = realConciergeFor([
      action("parity", ({ meta }) => result(`handled:${meta.callId}`)),
    ]);
    let directRows;
    let directThrown = null;
    try {
      directRows = await real.dispatchBatch(CONTEXT, direct.batch);
    } catch (error) {
      directThrown = error instanceof Error ? error.message : String(error);
    }

    const releaseBlocker = deferred();
    const successorFinished = deferred();
    const diagnostics = [];
    let dispatchEntries = 0;
    let routedReadsAtEntry;
    let routedRows;
    const concierge = {
      dispatch: real.dispatch,
      catalogFor: real.catalogFor,
      stageFor: real.stageFor,
      explain: real.explain,
      async dispatchBatch(context, batch) {
        dispatchEntries += 1;
        if (dispatchEntries === 1) {
          await releaseBlocker.promise;
          return Object.freeze([]);
        }
        if (dispatchEntries === 2) {
          routedReadsAtEntry = routed.readCount();
          routedRows = await real.dispatchBatch(context, batch);
          return routedRows;
        }
        return Object.freeze([row("successor")]);
      },
    };
    const harness = controlledTransport({
      respond: ({ callId }) => {
        if (callId === "successor") successorFinished.resolve();
      },
    });
    const session = createSession({
      concierge,
      transport: harness.transport,
      initialContext: CONTEXT,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    harness.emitBatch(toolBatch("blocker"));
    harness.emitBatch(routed.batch);
    harness.emitBatch(toolBatch("successor"));
    await flushMicrotasks();

    expect(
      { dispatchEntries, routedReadsBeforeDispatch: routed.readCount() },
      marker,
    ).toEqual({ dispatchEntries: 1, routedReadsBeforeDispatch: 0 });

    releaseBlocker.resolve();
    await successorFinished.promise;

    const routedAttempts = harness.responses.slice(0, -1);
    const leakedPayload = JSON.stringify({
      diagnostics,
      directRows,
      directThrown,
      routedAttempts,
      routedRows,
    });
    expect(
      {
        directReadCount: direct.readCount(),
        directRows,
        directThrown,
        dispatchEntries,
        leaked: leakedPayload.includes(`PRIVATE-J${number}`),
        routedAttempts,
        routedReadCount: routed.readCount(),
        routedReadsAtEntry,
        routedRows,
        successor: harness.responses.at(-1),
      },
      marker,
    ).toEqual({
      directReadCount: 1,
      directRows,
      directThrown: null,
      dispatchEntries: 3,
      leaked: false,
      routedAttempts: directRows.map(({ callId, result: actionResult }) => ({
        callId,
        result: actionResult,
      })),
      routedReadCount: 1,
      routedReadsAtEntry: 0,
      routedRows: directRows,
      successor: { callId: "successor", result: result("handled:successor") },
    });
    await session.stop();
  });
}

registerHostileParityTest("15", "responseId", "responseid");
registerHostileParityTest("16", "userTurnId", "userturnid");
registerHostileParityTest("17", "calls", "calls");
registerHostileParityTest("18", "deferUntilDelivered", "delivery-hook");
