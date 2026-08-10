import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it as vitestIt } from "vitest";

import {
  CONVERSATIONAL_CAPABILITIES,
  createStubTransport,
} from "./fixtures/stub-transport.js";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const START_ERROR = "The session could not start.";
const STOPPED_ERROR = "This session has stopped.";
const PRIVATE_SENTINEL = "PRIVATE-SESSION-LIFECYCLE-SENTINEL";
const COMPLETED_OUTCOME = Object.freeze({ outcome: "completed" });

const DIAGNOSTIC_MESSAGES = Object.freeze({
  catalog_publish_failed:
    "The transport rejected a catalog publication, so the session was stopped.",
  batch_dispatch_failed:
    "The dispatcher could not complete an accepted batch; later batches will continue.",
  response_failed: "The transport rejected a result; it was not retried.",
  stage_listener_failed:
    "A stage subscriber threw; remaining subscribers will continue.",
  transport_subscribe_failed:
    "The transport could not register a session subscription; construction was rolled back.",
  transport_unsubscribe_failed:
    "The transport could not remove a session subscription; remaining cleanup continued.",
  catalog_clear_failed:
    "The transport could not clear its catalog; remaining cleanup continued.",
  abort_signal_failed:
    "A batch cancellation signal failed; the batch was treated as cancelled.",
  batch_without_context:
    "A batch arrived before session context was set and was ignored.",
  outcome_presentation_failed:
    "The application could not present the failed outcome; no result was released.",
});

const CONTEXT_A = Object.freeze({ page: "alpha" });
const CONTEXT_B = Object.freeze({ page: "beta" });
const CONTEXT_C = Object.freeze({ page: "gamma" });
const CATALOG_A = Object.freeze([]);
const CATALOG_B = Object.freeze([]);
const CATALOG_C = Object.freeze([]);

let createRuntimeSession;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the session lifecycle suite.",
    );
  }

  const artifact = await import(DIST_URL.href);
  createRuntimeSession = artifact.createSession;
});

function createSession(config) {
  return createRuntimeSession({
    presentOutcome: () => Promise.resolve(COMPLETED_OUTCOME),
    ...config,
  });
}

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

function row(callId) {
  return Object.freeze({ callId, result: result(`handled:${callId}`) });
}

function toolCall(callId, outputIndex = 0) {
  return Object.freeze({
    callId,
    name: "run",
    arguments: "{}",
    outputIndex,
  });
}

function toolBatch(responseId, callIds = [responseId]) {
  return Object.freeze({
    responseId,
    calls: Object.freeze(
      callIds.map((callId, index) => toolCall(callId, index)),
    ),
  });
}

function thrownMessage(run) {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return null;
}

async function withCapturedWarnings(run) {
  const realConsole = globalThis.console;
  const captured = [];
  const sink = (message) => captured.push(String(message));
  globalThis.console = { ...realConsole, warn: sink, error: sink, log: sink };
  try {
    await run();
  } finally {
    globalThis.console = realConsole;
  }
  return captured;
}

function conciergeDouble({
  dispatchBatch,
  entries = [
    { context: CONTEXT_A, catalog: CATALOG_A, stage: "alpha" },
    { context: CONTEXT_B, catalog: CATALOG_B, stage: "beta" },
    { context: CONTEXT_C, catalog: CATALOG_C, stage: "gamma" },
  ],
  onCatalogFor = () => {},
} = {}) {
  const byContext = new Map(
    entries.map(({ context, catalog, stage }) => [context, { catalog, stage }]),
  );
  return {
    catalogFor(context) {
      onCatalogFor(context);
      const entry = byContext.get(context);
      if (entry === undefined) throw new Error("unknown context");
      return entry.catalog;
    },
    stageFor(context) {
      const entry = byContext.get(context);
      if (entry === undefined) throw new Error("unknown context");
      return entry.stage;
    },
    dispatchBatch:
      dispatchBatch ??
      ((context, batch) => Promise.resolve([row(batch.responseId)])),
    dispatch: () => Promise.resolve(result("unused")),
    explain: () => ({ stage: null, stages: [], catalog: [] }),
  };
}

function controlledTransport(options = {}) {
  let status = options.initialStatus ?? "idle";
  let nextToken = 0;
  const statusSubscribers = new Map();
  const batchSubscribers = new Map();
  const retainedStatusSubscribers = [];
  const retainedBatchSubscribers = [];
  const publications = [];
  const responses = [];
  const attempts = {
    statusSubscribe: 0,
    batchSubscribe: 0,
    statusUnsubscribe: 0,
    batchUnsubscribe: 0,
  };

  const transport = Object.freeze({
    capabilities: CONVERSATIONAL_CAPABILITIES,
    get status() {
      return status;
    },
    setTools(tools) {
      publications.push(tools);
      options.setTools?.(tools, publications.length);
    },
    onStatusChange(callback) {
      attempts.statusSubscribe += 1;
      retainedStatusSubscribers.push(callback);
      options.onStatusSubscribe?.(callback, attempts.statusSubscribe);
      const token = ++nextToken;
      statusSubscribers.set(token, callback);
      const cleanup = () => {
        attempts.statusUnsubscribe += 1;
        statusSubscribers.delete(token);
        options.onStatusUnsubscribe?.(attempts.statusUnsubscribe);
      };
      if (Object.prototype.hasOwnProperty.call(options, "statusReturn")) {
        return options.statusReturn;
      }
      return cleanup;
    },
    onToolBatch(callback) {
      attempts.batchSubscribe += 1;
      retainedBatchSubscribers.push(callback);
      options.onBatchSubscribe?.(callback, attempts.batchSubscribe);
      const token = ++nextToken;
      batchSubscribers.set(token, callback);
      const cleanup = () => {
        attempts.batchUnsubscribe += 1;
        batchSubscribers.delete(token);
        options.onBatchUnsubscribe?.(attempts.batchUnsubscribe);
      };
      if (Object.prototype.hasOwnProperty.call(options, "batchReturn")) {
        return options.batchReturn;
      }
      return cleanup;
    },
    respond(callId, actionResult) {
      const attempt = Object.freeze({ callId, result: actionResult });
      responses.push(attempt);
      options.respond?.(attempt, responses.length);
    },
  });

  return Object.freeze({
    transport,
    publications,
    responses,
    attempts,
    emitBatch(batch) {
      for (const callback of [...batchSubscribers.values()]) callback(batch);
    },
    emitStatus(nextStatus) {
      if (nextStatus === status) return;
      status = nextStatus;
      for (const callback of [...statusSubscribers.values()]) callback(nextStatus);
    },
    invokeRetainedBatch(batch) {
      for (const callback of [...retainedBatchSubscribers]) callback(batch);
    },
    invokeRetainedStatus(nextStatus) {
      status = nextStatus;
      for (const callback of [...retainedStatusSubscribers]) callback(nextStatus);
    },
    subscriberCounts() {
      return Object.freeze({
        status: statusSubscribers.size,
        batch: batchSubscribers.size,
      });
    },
  });
}

it("[L01] returns one stop Promise and marks stopped before outside cleanup", async () => {
  const marker = "[RED:L01:stable-stop-promise]";
  let session;
  const recursivePromises = [];
  const stoppedMessages = [];
  const transport = controlledTransport({
    onStatusUnsubscribe() {
      stoppedMessages.push(thrownMessage(() => session.setContext(CONTEXT_A)));
      recursivePromises.push(session.stop());
    },
    onBatchUnsubscribe() {
      stoppedMessages.push(
        thrownMessage(() => session.onStageChange(() => {})),
      );
      recursivePromises.push(session.stop());
    },
    setTools(_tools, occurrence) {
      if (occurrence !== 2) return;
      stoppedMessages.push(thrownMessage(() => session.setContext(CONTEXT_B)));
      recursivePromises.push(session.stop());
    },
  });
  session = createSession({
    concierge: conciergeDouble(),
    transport: transport.transport,
    initialContext: CONTEXT_A,
  });

  const first = session.stop();
  const second = session.stop();
  await first;
  const afterResolution = session.stop();

  expect(
    {
      allRecursiveSame: recursivePromises.every((value) => value === first),
      cleanupAttempts: transport.attempts,
      firstSecondSame: first === second,
      laterSame: first === afterResolution,
      stage: session.stage(),
      stoppedMessages,
    },
    marker,
  ).toEqual({
    allRecursiveSame: true,
    cleanupAttempts: {
      statusSubscribe: 1,
      batchSubscribe: 1,
      statusUnsubscribe: 1,
      batchUnsubscribe: 1,
    },
    firstSecondSame: true,
    laterSame: true,
    stage: "alpha",
    stoppedMessages: [STOPPED_ERROR, STOPPED_ERROR, STOPPED_ERROR],
  });
});

it("[L02] unregisters, aborts, detaches, clears listeners, and clears tools once", async () => {
  const marker = "[RED:L02:complete-cleanup]";
  const activeGate = deferred();
  const dispatches = [];
  const signals = [];
  const concierge = conciergeDouble({
    async dispatchBatch(_context, batch) {
      dispatches.push(batch.responseId);
      signals.push(batch.signal);
      if (batch.responseId === "active") await activeGate.promise;
      return [row(batch.responseId)];
    },
  });
  const transport = controlledTransport();
  const session = createSession({
    concierge,
    transport: transport.transport,
    initialContext: CONTEXT_A,
  });
  let stageCalls = 0;
  const staleStageUnsubscribe = session.onStageChange(() => {
    stageCalls += 1;
  });

  transport.emitBatch(toolBatch("active"));
  transport.emitBatch(toolBatch("queued"));
  await flushMicrotasks();

  const drain = session.stop();
  const synchronous = {
    activeAborted: signals[0]?.aborted,
    cleanupAttempts: { ...transport.attempts },
    counts: transport.subscriberCounts(),
    clearFrozen: Object.isFrozen(transport.publications.at(-1)),
    clearLength: transport.publications.at(-1)?.length,
    dispatches: [...dispatches],
  };
  staleStageUnsubscribe();
  transport.invokeRetainedStatus("connected");
  transport.invokeRetainedBatch(toolBatch("stale"));
  activeGate.resolve();
  await drain;

  expect(
    {
      dispatches,
      responses: transport.responses.length,
      signalsAborted: signals.map((signal) => signal.aborted),
      stageCalls,
      synchronous,
    },
    marker,
  ).toEqual({
    dispatches: ["active", "queued"],
    responses: 0,
    signalsAborted: [true, true],
    stageCalls: 0,
    synchronous: {
      activeAborted: true,
      cleanupAttempts: {
        statusSubscribe: 1,
        batchSubscribe: 1,
        statusUnsubscribe: 1,
        batchUnsubscribe: 1,
      },
      counts: { status: 0, batch: 0 },
      clearFrozen: true,
      clearLength: 0,
      dispatches: ["active"],
    },
  });
});

it("[L03] waits for an entered abort-ignoring handler and suppresses its rows", async () => {
  const marker = "[RED:L03:active-handler-drain]";
  const handlerGate = deferred();
  let enteredSignal;
  const concierge = conciergeDouble({
    async dispatchBatch(_context, batch) {
      enteredSignal = batch.signal;
      await handlerGate.promise;
      return [row("active-row")];
    },
  });
  const stub = createStubTransport({
    capabilities: CONVERSATIONAL_CAPABILITIES,
  });
  const session = createSession({
    concierge,
    transport: stub.transport,
    initialContext: CONTEXT_A,
  });
  stub.emitBatch(toolBatch("active"));
  await flushMicrotasks();

  let settled = false;
  const drain = session.stop();
  void drain.then(() => {
    settled = true;
  });
  await flushMicrotasks();
  const beforeRelease = {
    aborted: enteredSignal?.aborted,
    responses: stub.responseHistory().length,
    settled,
  };
  handlerGate.resolve();
  await drain;

  expect(
    {
      beforeRelease,
      responsesAfterDrain: stub.responseHistory().length,
      settled,
    },
    marker,
  ).toEqual({
    beforeRelease: { aborted: true, responses: 0, settled: false },
    responsesAfterDrain: 0,
    settled: true,
  });
});

it("[L04] drains queued, publishing, and published-unconfirmed records once in FIFO", async () => {
  const marker = "[RED:L04:detached-queued-drain]";

  const publishingGate = deferred();
  const publishingDispatches = [];
  const publishingSignals = [];
  let publishingSession;
  let publishingDrain;
  let publishingTransport;
  const publishingConcierge = conciergeDouble({
    async dispatchBatch(_context, batch) {
      publishingDispatches.push(batch.responseId);
      publishingSignals.push(batch.signal);
      if (batch.responseId === "publishing-active") {
        await publishingGate.promise;
      }
      return [row(batch.responseId)];
    },
  });
  publishingTransport = controlledTransport({
    setTools(_tools, occurrence) {
      if (occurrence !== 2) return;
      publishingTransport.emitBatch(toolBatch("publishing-held"));
      publishingDrain = publishingSession.stop();
    },
  });
  publishingSession = createSession({
    concierge: publishingConcierge,
    transport: publishingTransport.transport,
    initialContext: CONTEXT_A,
  });
  publishingTransport.emitBatch(toolBatch("publishing-active"));
  publishingTransport.emitBatch(toolBatch("ordinary-queued"));
  await flushMicrotasks();
  publishingSession.setContext(CONTEXT_B);
  publishingGate.resolve();
  await publishingDrain;

  const publishedGate = deferred();
  const publishedDispatches = [];
  const publishedSignals = [];
  let publishedSession;
  let publishedDrain;
  let publishedTransport;
  let stopOnGamma = false;
  const publishedConcierge = conciergeDouble({
    onCatalogFor(context) {
      if (context === CONTEXT_C && stopOnGamma) {
        publishedDrain = publishedSession.stop();
      }
    },
    async dispatchBatch(_context, batch) {
      publishedDispatches.push(batch.responseId);
      publishedSignals.push(batch.signal);
      if (batch.responseId === "published-active") await publishedGate.promise;
      return [row(batch.responseId)];
    },
  });
  publishedTransport = controlledTransport({
    setTools(_tools, occurrence) {
      if (occurrence !== 2) return;
      publishedTransport.emitBatch(toolBatch("published-held"));
      stopOnGamma = true;
      publishedSession.setContext(CONTEXT_C);
    },
  });
  publishedSession = createSession({
    concierge: publishedConcierge,
    transport: publishedTransport.transport,
    initialContext: CONTEXT_A,
  });
  publishedTransport.emitBatch(toolBatch("published-active"));
  await flushMicrotasks();
  publishedSession.setContext(CONTEXT_B);
  publishedGate.resolve();
  await publishedDrain;

  expect(
    {
      published: {
        dispatches: publishedDispatches,
        responses: publishedTransport.responses.length,
        signals: publishedSignals.map((signal) => signal.aborted),
        stage: publishedSession.stage(),
      },
      publishing: {
        dispatches: publishingDispatches,
        responses: publishingTransport.responses.length,
        signals: publishingSignals.map((signal) => signal.aborted),
        stage: publishingSession.stage(),
      },
    },
    marker,
  ).toEqual({
    published: {
      dispatches: ["published-active", "published-held"],
      responses: 0,
      signals: [true, true],
      stage: "alpha",
    },
    publishing: {
      dispatches: [
        "publishing-active",
        "ordinary-queued",
        "publishing-held",
      ],
      responses: 0,
      signals: [true, true, true],
      stage: "alpha",
    },
  });
});

it("drains accepted work when cancellation normalization stops reentrantly", async () => {
  const observations = [];

  for (const stopSource of ["signal-accessor", "diagnostic-hook"]) {
    const dispatchGate = deferred();
    const dispatches = [];
    const signalStates = [];
    const diagnostics = [];
    let drain;
    let session;
    const transport = controlledTransport();
    session = createSession({
      concierge: conciergeDouble({
        async dispatchBatch(_context, batch) {
          dispatches.push(batch.responseId);
          signalStates.push(batch.signal.aborted);
          await dispatchGate.promise;
          return [row(batch.responseId)];
        },
      }),
      transport: transport.transport,
      initialContext: CONTEXT_A,
      onDiagnostic(diagnostic) {
        diagnostics.push(diagnostic.code);
        if (
          stopSource === "diagnostic-hook" &&
          diagnostic.code === "abort_signal_failed"
        ) {
          drain = session.stop();
        }
      },
    });

    transport.emitBatch(
      Object.freeze({
        responseId: stopSource,
        calls: Object.freeze([toolCall(stopSource)]),
        get signal() {
          if (stopSource === "signal-accessor") {
            drain = session.stop();
            return undefined;
          }
          throw new Error("PRIVATE-NORMALIZATION-SIGNAL");
        },
      }),
    );

    if (drain === undefined) throw new Error("reentrant stop was not observed");
    let settled = false;
    void drain.then(() => {
      settled = true;
    });
    await flushMicrotasks();
    const beforeDispatchSettles = {
      dispatches: [...dispatches],
      responses: transport.responses.length,
      settled,
      signalStates: [...signalStates],
    };
    dispatchGate.resolve();
    await drain;

    observations.push({
      beforeDispatchSettles,
      diagnostics,
      responses: transport.responses.length,
      settled,
      stopSource,
    });
  }

  expect(observations, "[REGRESSION:accepted-normalization-stop-drain]").toEqual([
    {
      beforeDispatchSettles: {
        dispatches: ["signal-accessor"],
        responses: 0,
        settled: false,
        signalStates: [true],
      },
      diagnostics: [],
      responses: 0,
      settled: true,
      stopSource: "signal-accessor",
    },
    {
      beforeDispatchSettles: {
        dispatches: ["diagnostic-hook"],
        responses: 0,
        settled: false,
        signalStates: [true],
      },
      diagnostics: ["abort_signal_failed"],
      responses: 0,
      settled: true,
      stopSource: "diagnostic-hook",
    },
  ]);
});

it("preserves FIFO when cancellation normalization delivers a nested batch", async () => {
  const dispatches = [];
  const responses = [];
  const finalizations = [];
  const transport = controlledTransport({
    respond(attempt) {
      responses.push(attempt.callId);
    },
  });
  const session = createSession({
    concierge: conciergeDouble({
      dispatchBatch(_context, batch) {
        dispatches.push(batch.responseId);
        return Promise.resolve([row(batch.responseId)]);
      },
    }),
    transport: transport.transport,
    initialContext: CONTEXT_A,
  });

  const signalFor = (responseId) =>
    Object.freeze({
      aborted: false,
      addEventListener() {},
      removeEventListener() {
        finalizations.push(responseId);
      },
    });
  const innerBatch = Object.freeze({
    ...toolBatch("inner"),
    signal: signalFor("inner"),
  });
  const outerSignal = signalFor("outer");
  transport.emitBatch(
    Object.freeze({
      ...toolBatch("outer"),
      get signal() {
        transport.emitBatch(innerBatch);
        return outerSignal;
      },
    }),
  );

  await flushMicrotasks();
  expect(
    { dispatches, responses, finalizations },
    "[REGRESSION:nested-normalization-live-fifo]",
  ).toEqual({
    dispatches: ["outer", "inner"],
    responses: ["outer", "inner"],
    finalizations: ["outer", "inner"],
  });
  await session.stop();
});

it("preserves FIFO through stop drain when normalization delivers nested work", async () => {
  const dispatches = [];
  const responses = [];
  const finalizations = [];
  let drain;
  let session;
  const transport = controlledTransport({
    respond(attempt) {
      responses.push(attempt.callId);
    },
  });
  session = createSession({
    concierge: conciergeDouble({
      dispatchBatch(_context, batch) {
        dispatches.push(batch.responseId);
        return Promise.resolve([row(batch.responseId)]);
      },
    }),
    transport: transport.transport,
    initialContext: CONTEXT_A,
  });

  const signalFor = (responseId, onAdd = () => {}) =>
    Object.freeze({
      aborted: false,
      addEventListener() {
        onAdd();
      },
      removeEventListener() {
        finalizations.push(responseId);
      },
    });
  const innerBatch = Object.freeze({
    ...toolBatch("inner"),
    signal: signalFor("inner"),
  });
  const outerSignal = signalFor("outer", () => {
    drain = session.stop();
  });
  transport.emitBatch(
    Object.freeze({
      ...toolBatch("outer"),
      get signal() {
        transport.emitBatch(innerBatch);
        return outerSignal;
      },
    }),
  );

  if (drain === undefined) throw new Error("reentrant stop was not observed");
  await drain;
  expect(
    { dispatches, responses, finalizations },
    "[REGRESSION:nested-normalization-stop-drain-fifo]",
  ).toEqual({
    dispatches: ["outer", "inner"],
    responses: [],
    finalizations: ["outer", "inner"],
  });
});

it("[L17] does not begin a response after a row getter stops the session", async () => {
  const marker = "[RED:L17:row-getter-stop-response-cutoff]";
  let drain;
  let session;
  const transport = controlledTransport();
  const stoppingRow = Object.freeze({
    get callId() {
      drain = session.stop();
      return "late-row";
    },
    result: result("late-row"),
  });
  session = createSession({
    concierge: conciergeDouble({
      dispatchBatch: () => Promise.resolve([stoppingRow]),
    }),
    transport: transport.transport,
    initialContext: CONTEXT_A,
  });

  transport.emitBatch(toolBatch("row-getter"));
  await flushMicrotasks();
  if (drain === undefined) throw new Error("row getter did not stop the session");
  await drain;

  expect(
    {
      responses: transport.responses,
      sameDrain: session.stop() === drain,
      subscribers: transport.subscriberCounts(),
    },
    marker,
  ).toEqual({
    responses: [],
    sameDrain: true,
    subscribers: { status: 0, batch: 0 },
  });
});

it("[L18] does not begin a response after the respond getter stops the session", async () => {
  const marker = "[RED:L18:respond-getter-stop-response-cutoff]";
  let drain;
  let session;
  let responseInvocations = 0;
  const base = controlledTransport();
  const transport = Object.freeze({
    capabilities: base.transport.capabilities,
    get status() {
      return base.transport.status;
    },
    setTools(tools) {
      base.transport.setTools(tools);
    },
    onStatusChange(callback) {
      return base.transport.onStatusChange(callback);
    },
    onToolBatch(callback) {
      return base.transport.onToolBatch(callback);
    },
    get respond() {
      drain = session.stop();
      return () => {
        responseInvocations += 1;
      };
    },
  });
  session = createSession({
    concierge: conciergeDouble(),
    transport,
    initialContext: CONTEXT_A,
  });

  base.emitBatch(toolBatch("respond-getter"));
  await flushMicrotasks();
  if (drain === undefined) throw new Error("respond getter did not stop the session");
  await drain;

  expect(
    {
      responseInvocations,
      sameDrain: session.stop() === drain,
      subscribers: base.subscriberCounts(),
    },
    marker,
  ).toEqual({
    responseInvocations: 0,
    sameDrain: true,
    subscribers: { status: 0, batch: 0 },
  });
});

it("[L05] cuts off output when stop occurs at dispatch, response, and stage boundaries", async () => {
  const marker = "[RED:L05:stop-at-every-boundary]";
  let responseSession;
  let responseDrain;
  const responseCleanupMessages = [];
  const responseCleanupStops = [];
  const responseTransport = controlledTransport({
    onStatusUnsubscribe() {
      responseCleanupMessages.push(
        thrownMessage(() => responseSession.setContext(CONTEXT_B)),
      );
      responseCleanupStops.push(responseSession.stop());
    },
    respond(_attempt, occurrence) {
      if (occurrence === 1) responseDrain = responseSession.stop();
    },
  });
  responseSession = createSession({
    concierge: conciergeDouble({
      dispatchBatch: () => Promise.resolve([row("first"), row("second")]),
    }),
    transport: responseTransport.transport,
    initialContext: CONTEXT_A,
  });
  responseTransport.emitBatch(toolBatch("response-boundary"));
  await flushMicrotasks();
  await responseDrain;

  let stageSession;
  let stageDrain;
  const stageEvents = [];
  const stageTransport = controlledTransport();
  stageSession = createSession({
    concierge: conciergeDouble(),
    transport: stageTransport.transport,
    initialContext: CONTEXT_A,
  });
  stageSession.onStageChange((stage) => {
    stageEvents.push(`first:${stage}`);
    stageDrain = stageSession.stop();
  });
  stageSession.onStageChange((stage) => {
    stageEvents.push(`second:${stage}`);
  });
  stageSession.setContext(CONTEXT_B);
  await stageDrain;

  expect(
    {
      responseAttempts: responseTransport.responses.map((entry) => entry.callId),
      responseCleanup: responseTransport.attempts,
      responseCleanupMessages,
      responseCleanupRecursiveSame: responseCleanupStops.every(
        (promise) => promise === responseDrain,
      ),
      stage: stageSession.stage(),
      stageEvents,
      stagePublications: stageTransport.publications.length,
    },
    marker,
  ).toEqual({
    responseAttempts: ["first"],
    responseCleanup: {
      statusSubscribe: 1,
      batchSubscribe: 1,
      statusUnsubscribe: 1,
      batchUnsubscribe: 1,
    },
    responseCleanupMessages: [STOPPED_ERROR],
    responseCleanupRecursiveSame: true,
    stage: "beta",
    stageEvents: ["first:beta"],
    stagePublications: 3,
  });
});

it("[L06] rolls back every setup failure and rejects invalid unsubscribers", async () => {
  const marker = "[RED:L06:setup-rollback-matrix]";
  const scenarios = [
    {
      name: "first-subscribe-throws",
      options: {
        onStatusSubscribe() {
          throw new Error("PRIVATE-STATUS-SUBSCRIBE");
        },
      },
    },
    {
      name: "second-subscribe-throws",
      options: {
        onBatchSubscribe() {
          throw new Error("PRIVATE-BATCH-SUBSCRIBE");
        },
      },
    },
    { name: "invalid-status-unsubscriber", options: { statusReturn: null } },
    { name: "invalid-batch-unsubscriber", options: { batchReturn: {} } },
    {
      name: "initial-publication-and-cleanup-throw",
      options: {
        onStatusUnsubscribe() {
          throw new Error("PRIVATE-STATUS-CLEANUP");
        },
        onBatchUnsubscribe() {
          throw new Error("PRIVATE-BATCH-CLEANUP");
        },
        setTools() {
          throw new Error("PRIVATE-PUBLICATION");
        },
      },
      diagnosticThrows: true,
    },
  ];
  const observations = [];

  for (const scenario of scenarios) {
    let dispatches = 0;
    const diagnostics = [];
    const transport = controlledTransport(scenario.options);
    let returnedSession = null;
    let errorMessage = null;
    try {
      returnedSession = createSession({
        concierge: conciergeDouble({
          dispatchBatch() {
            dispatches += 1;
            return Promise.resolve([row("unexpected")]);
          },
        }),
        transport: transport.transport,
        initialContext: CONTEXT_A,
        onDiagnostic(diagnostic) {
          diagnostics.push(diagnostic.code);
          if (scenario.diagnosticThrows) {
            throw new Error("PRIVATE-DIAGNOSTIC");
          }
        },
      });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    if (returnedSession !== null) await returnedSession.stop();
    const historyBeforeStale = {
      diagnostics: diagnostics.length,
      publications: transport.publications.length,
      responses: transport.responses.length,
    };
    transport.invokeRetainedStatus("connected");
    transport.invokeRetainedBatch(toolBatch(`stale-${scenario.name}`));
    await flushMicrotasks();
    observations.push({
      name: scenario.name,
      errorMessage,
      returned: returnedSession !== null,
      dispatches,
      historyBeforeStale,
      historyAfterStale: {
        diagnostics: diagnostics.length,
        publications: transport.publications.length,
        responses: transport.responses.length,
      },
      lastCatalogEmpty: transport.publications.at(-1)?.length === 0,
    });
  }

  expect(observations, marker).toEqual(
    scenarios.map((scenario) => ({
      name: scenario.name,
      errorMessage: START_ERROR,
      returned: false,
      dispatches: 0,
      historyBeforeStale: expect.any(Object),
      historyAfterStale: expect.any(Object),
      lastCatalogEmpty: true,
    })).map((expected, index) => ({
      ...expected,
      historyAfterStale: observations[index]?.historyBeforeStale,
    })),
  );
});

it("[L07] contains every cleanup failure and resolves the drain", async () => {
  const marker = "[RED:L07:cleanup-continues]";
  const handlerGate = deferred();
  const abortOrder = [];
  const diagnostics = [];
  const concierge = conciergeDouble({
    async dispatchBatch(_context, batch) {
      batch.signal.addEventListener("abort", () => {
        abortOrder.push("throwing");
        throw new Error("PRIVATE-ABORT-LISTENER");
      });
      batch.signal.addEventListener("abort", () => {
        abortOrder.push("later");
      });
      await handlerGate.promise;
      return [row("cleanup")];
    },
  });
  const transport = controlledTransport({
    onStatusUnsubscribe() {
      throw new Error("PRIVATE-STATUS-UNSUBSCRIBE");
    },
    onBatchUnsubscribe() {
      throw new Error("PRIVATE-BATCH-UNSUBSCRIBE");
    },
    setTools(_tools, occurrence) {
      if (occurrence === 2) throw new Error("PRIVATE-CATALOG-CLEAR");
    },
  });
  const session = createSession({
    concierge,
    transport: transport.transport,
    initialContext: CONTEXT_A,
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic.code);
      throw new Error("PRIVATE-DIAGNOSTIC-HOOK");
    },
  });
  transport.emitBatch(toolBatch("cleanup"));
  await flushMicrotasks();

  let rejected = false;
  const drain = session.stop();
  handlerGate.resolve();
  try {
    await drain;
  } catch {
    rejected = true;
  }

  expect(
    {
      abortOrder,
      cleanupAttempts: transport.attempts,
      diagnosticCodes: diagnostics,
      publicationAttempts: transport.publications.length,
      rejected,
      responses: transport.responses.length,
    },
    marker,
  ).toEqual({
    abortOrder: ["throwing", "later"],
    cleanupAttempts: {
      statusSubscribe: 1,
      batchSubscribe: 1,
      statusUnsubscribe: 1,
      batchUnsubscribe: 1,
    },
    diagnosticCodes: [
      "abort_signal_failed",
      "transport_unsubscribe_failed",
      "transport_unsubscribe_failed",
      "catalog_clear_failed",
    ],
    publicationAttempts: 2,
    rejected: false,
    responses: 0,
  });
});

it("[L08] keeps the last stage readable and makes every stale closure inert", async () => {
  const marker = "[RED:L08:post-stop-contract]";
  const diagnostics = [];
  let dispatches = 0;
  const transport = controlledTransport();
  const session = createSession({
    concierge: conciergeDouble({
      dispatchBatch() {
        dispatches += 1;
        return Promise.resolve([row("stale")]);
      },
    }),
    transport: transport.transport,
    initialContext: CONTEXT_A,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic.code),
  });
  let listenerCalls = 0;
  const staleUnsubscribe = session.onStageChange(() => {
    listenerCalls += 1;
  });
  session.setContext(CONTEXT_B);
  expect(listenerCalls).toBe(1);
  const drain = session.stop();
  await drain;
  const baseline = {
    diagnostics: diagnostics.length,
    publications: transport.publications.length,
    responses: transport.responses.length,
  };

  staleUnsubscribe();
  staleUnsubscribe();
  transport.invokeRetainedStatus("connected");
  transport.invokeRetainedBatch(toolBatch("stale"));
  await flushMicrotasks();

  expect(
    {
      baseline,
      dispatches,
      historiesAfterStale: {
        diagnostics: diagnostics.length,
        publications: transport.publications.length,
        responses: transport.responses.length,
      },
      listenerCalls,
      newSubscriptionError: thrownMessage(() =>
        session.onStageChange(() => {}),
      ),
      setContextError: thrownMessage(() => session.setContext(CONTEXT_C)),
      stage: session.stage(),
    },
    marker,
  ).toEqual({
    baseline: { diagnostics: 0, publications: 3, responses: 0 },
    dispatches: 0,
    historiesAfterStale: baseline,
    listenerCalls: 1,
    newSubscriptionError: STOPPED_ERROR,
    setContextError: STOPPED_ERROR,
    stage: "beta",
  });
});

it("[L09] tokenizes duplicate stage listeners and keeps stale cleanup local", async () => {
  const marker = "[RED:L09:listener-token]";
  const transport = controlledTransport();
  const session = createSession({
    concierge: conciergeDouble(),
    transport: transport.transport,
    initialContext: CONTEXT_A,
  });
  const observed = [];
  const callback = (stage) => observed.push(stage);

  const removeFirst = session.onStageChange(callback);
  const removeSecond = session.onStageChange(callback);
  removeFirst();
  removeFirst();
  session.setContext(CONTEXT_B);

  const removeReplacement = session.onStageChange(callback);
  removeFirst();
  session.setContext(CONTEXT_C);
  removeSecond();
  session.setContext(CONTEXT_A);
  removeReplacement();
  session.setContext(CONTEXT_B);
  await session.stop();

  expect(observed, marker).toEqual(["beta", "gamma", "gamma", "alpha"]);
});

it("[L10] snapshots stage listeners across add and remove reentrancy", async () => {
  const marker = "[RED:L10:listener-snapshot]";
  const transport = controlledTransport();
  const session = createSession({
    concierge: conciergeDouble(),
    transport: transport.transport,
    initialContext: CONTEXT_A,
  });
  const observed = [];
  let removeSecond = () => {};
  let added = false;

  session.onStageChange((stage) => {
    observed.push(`first:${stage}`);
    if (stage === "beta" && !added) {
      added = true;
      removeSecond();
      session.onStageChange((laterStage) => {
        observed.push(`added:${laterStage}`);
      });
    }
  });
  removeSecond = session.onStageChange((stage) => {
    observed.push(`second:${stage}`);
  });

  session.setContext(CONTEXT_B);
  session.setContext(CONTEXT_C);
  await session.stop();

  expect(observed, marker).toEqual([
    "first:beta",
    "second:beta",
    "first:gamma",
    "added:gamma",
  ]);
});

it("[L11] queues nested stage changes behind the current listener snapshot", async () => {
  const marker = "[RED:L11:nested-stage-order]";
  const transport = controlledTransport();
  const session = createSession({
    concierge: conciergeDouble(),
    transport: transport.transport,
    initialContext: CONTEXT_A,
  });
  const observed = [];

  session.onStageChange((stage) => {
    observed.push(`first:${stage}`);
    if (stage === "beta") session.setContext(CONTEXT_C);
  });
  session.onStageChange((stage) => {
    observed.push(`second:${stage}`);
  });

  session.setContext(CONTEXT_B);
  await session.stop();

  expect(observed, marker).toEqual([
    "first:beta",
    "second:beta",
    "first:gamma",
    "second:gamma",
  ]);
});

it("[L12] contains a throwing stage listener and continues its snapshot", async () => {
  const marker = "[RED:L12:listener-throw-continues]";
  const diagnostics = [];
  const observed = [];
  const transport = controlledTransport();
  const session = createSession({
    concierge: conciergeDouble(),
    transport: transport.transport,
    initialContext: CONTEXT_A,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });

  session.onStageChange(() => {
    throw new Error(PRIVATE_SENTINEL);
  });
  session.onStageChange((stage) => {
    observed.push(stage);
  });
  session.setContext(CONTEXT_B);
  await session.stop();

  expect(
    {
      diagnostic: diagnostics[0],
      frozen: Object.isFrozen(diagnostics[0]),
      observed,
      secretPresent: JSON.stringify(diagnostics).includes(PRIVATE_SENTINEL),
    },
    marker,
  ).toEqual({
    diagnostic: {
      code: "stage_listener_failed",
      message: DIAGNOSTIC_MESSAGES.stage_listener_failed,
    },
    frozen: true,
    observed: ["beta"],
    secretPresent: false,
  });
});

it("[L13] cuts off nested work when a stage listener stops the session", async () => {
  const marker = "[RED:L13:listener-stop-cuts-off]";
  const diagnostics = [];
  const observed = [];
  let dispatches = 0;
  let drain;
  let nestedError = null;
  const transport = controlledTransport();
  const session = createSession({
    concierge: conciergeDouble({
      dispatchBatch() {
        dispatches += 1;
        return Promise.resolve([row(PRIVATE_SENTINEL)]);
      },
    }),
    transport: transport.transport,
    initialContext: CONTEXT_A,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });

  session.onStageChange((stage) => {
    observed.push(`first:${stage}`);
    drain = session.stop();
    nestedError = thrownMessage(() => session.setContext(CONTEXT_C));
    transport.invokeRetainedStatus("connected");
    transport.invokeRetainedBatch(toolBatch(PRIVATE_SENTINEL));
  });
  session.onStageChange((stage) => {
    observed.push(`second:${stage}`);
  });

  session.setContext(CONTEXT_B);
  await drain;
  await flushMicrotasks();

  expect(
    {
      diagnostics: diagnostics.length,
      dispatches,
      nestedError,
      observed,
      publications: transport.publications.length,
      responses: transport.responses.length,
      stage: session.stage(),
    },
    marker,
  ).toEqual({
    diagnostics: 0,
    dispatches: 0,
    nestedError: STOPPED_ERROR,
    observed: ["first:beta"],
    publications: 3,
    responses: 0,
    stage: "beta",
  });
});

it("[L14] emits only fresh frozen exact diagnostics with fixed safe messages", async () => {
  const marker = "[RED:L14:immutable-safe-diagnostic]";
  const diagnostics = [];
  const collect = (diagnostic) => diagnostics.push(diagnostic);

  const listenerTransport = controlledTransport();
  const listenerSession = createSession({
    concierge: conciergeDouble(),
    transport: listenerTransport.transport,
    initialContext: CONTEXT_A,
    onDiagnostic: collect,
  });
  listenerSession.onStageChange(() => {
    throw new Error(PRIVATE_SENTINEL);
  });
  listenerSession.setContext(CONTEXT_B);
  await listenerSession.stop();

  const secretContext = Object.freeze({ page: PRIVATE_SENTINEL });
  const dispatchTransport = controlledTransport();
  const dispatchSession = createSession({
    concierge: conciergeDouble({
      entries: [
        {
          context: secretContext,
          catalog: CATALOG_A,
          stage: PRIVATE_SENTINEL,
        },
      ],
      dispatchBatch: () => Promise.reject(new Error(PRIVATE_SENTINEL)),
    }),
    transport: dispatchTransport.transport,
    initialContext: secretContext,
    onDiagnostic: collect,
  });
  dispatchTransport.emitBatch(
    Object.freeze({
      responseId: PRIVATE_SENTINEL,
      calls: Object.freeze([
        Object.freeze({
          callId: PRIVATE_SENTINEL,
          name: "run",
          arguments: PRIVATE_SENTINEL,
          outputIndex: 0,
        }),
      ]),
      privateValue: PRIVATE_SENTINEL,
    }),
  );
  await flushMicrotasks();
  await dispatchSession.stop();

  const responseTransport = controlledTransport({
    respond() {
      throw new Error(PRIVATE_SENTINEL);
    },
  });
  const responseSession = createSession({
    concierge: conciergeDouble(),
    transport: responseTransport.transport,
    initialContext: CONTEXT_A,
    onDiagnostic: collect,
  });
  responseTransport.emitBatch(toolBatch(PRIVATE_SENTINEL));
  await flushMicrotasks();
  await responseSession.stop();

  const abortTransport = controlledTransport();
  const abortSession = createSession({
    concierge: conciergeDouble(),
    transport: abortTransport.transport,
    initialContext: CONTEXT_A,
    onDiagnostic: collect,
  });
  abortTransport.emitBatch(
    Object.freeze({
      responseId: PRIVATE_SENTINEL,
      calls: Object.freeze([toolCall(PRIVATE_SENTINEL)]),
      get signal() {
        throw new Error(PRIVATE_SENTINEL);
      },
    }),
  );
  await flushMicrotasks();
  await abortSession.stop();

  const noContextTransport = controlledTransport();
  const noContextSession = createSession({
    concierge: conciergeDouble(),
    transport: noContextTransport.transport,
    onDiagnostic: collect,
  });
  noContextTransport.emitBatch(toolBatch(PRIVATE_SENTINEL));
  await noContextSession.stop();

  const cleanupTransport = controlledTransport({
    onStatusUnsubscribe() {
      throw new Error(PRIVATE_SENTINEL);
    },
    setTools(_tools, occurrence) {
      if (occurrence === 2) throw new Error(PRIVATE_SENTINEL);
    },
  });
  const cleanupSession = createSession({
    concierge: conciergeDouble(),
    transport: cleanupTransport.transport,
    initialContext: CONTEXT_A,
    onDiagnostic: collect,
  });
  await cleanupSession.stop();

  const publishTransport = controlledTransport({
    setTools(_tools, occurrence) {
      if (occurrence === 2) throw new Error(PRIVATE_SENTINEL);
    },
  });
  const publishSession = createSession({
    concierge: conciergeDouble(),
    transport: publishTransport.transport,
    initialContext: CONTEXT_A,
    onDiagnostic: collect,
  });
  thrownMessage(() => publishSession.setContext(CONTEXT_B));
  await publishSession.stop();

  const subscribeTransport = controlledTransport({
    onStatusSubscribe() {
      throw new Error(PRIVATE_SENTINEL);
    },
  });
  thrownMessage(() =>
    createSession({
      concierge: conciergeDouble(),
      transport: subscribeTransport.transport,
      initialContext: CONTEXT_A,
      onDiagnostic: collect,
    }),
  );

  const codes = diagnostics.map((diagnostic) => diagnostic.code);
  expect(
    {
      codes,
      exactKeys: diagnostics.every(
        (diagnostic) =>
          JSON.stringify(Object.keys(diagnostic).sort()) ===
          JSON.stringify(["code", "message"]),
      ),
      fixedMessages: diagnostics.every(
        (diagnostic) =>
          diagnostic.message === DIAGNOSTIC_MESSAGES[diagnostic.code],
      ),
      fresh: new Set(diagnostics).size === diagnostics.length,
      frozen: diagnostics.every((diagnostic) => Object.isFrozen(diagnostic)),
      secretPresent: JSON.stringify(diagnostics).includes(PRIVATE_SENTINEL),
    },
    marker,
  ).toEqual({
    codes: [
      "stage_listener_failed",
      "batch_dispatch_failed",
      "response_failed",
      "abort_signal_failed",
      "batch_without_context",
      "transport_unsubscribe_failed",
      "catalog_clear_failed",
      "catalog_publish_failed",
      "transport_subscribe_failed",
    ],
    exactKeys: true,
    fixedMessages: true,
    fresh: true,
    frozen: true,
    secretPresent: false,
  });
});

it("[L15] contains a throwing replacement diagnostic hook without console fallback", async () => {
  const marker = "[RED:L15:replacement-hook]";
  const diagnostics = [];
  const observed = [];
  let dispatches = 0;
  let snapshot;

  const warnings = await withCapturedWarnings(async () => {
    const transport = controlledTransport({
      respond() {
        throw new Error(PRIVATE_SENTINEL);
      },
    });
    const session = createSession({
      concierge: conciergeDouble({
        dispatchBatch(_context, batch) {
          dispatches += 1;
          return Promise.resolve([row(batch.responseId)]);
        },
      }),
      transport: transport.transport,
      initialContext: CONTEXT_A,
      onDiagnostic(diagnostic) {
        diagnostics.push(diagnostic.code);
        throw new Error(PRIVATE_SENTINEL);
      },
    });
    session.onStageChange(() => {
      throw new Error(PRIVATE_SENTINEL);
    });
    session.onStageChange((stage) => observed.push(stage));
    session.setContext(CONTEXT_B);
    transport.emitBatch(toolBatch("after-diagnostic"));
    await flushMicrotasks();
    await session.stop();
    snapshot = {
      dispatches,
      observed,
      responses: transport.responses.length,
    };
  });

  expect({ diagnostics, snapshot, warnings }, marker).toEqual({
    diagnostics: ["stage_listener_failed", "response_failed"],
    snapshot: { dispatches: 1, observed: ["beta"], responses: 1 },
    warnings: [],
  });
});

it("[L16] uses the exact default warning and survives missing or throwing consoles", async () => {
  const marker = "[RED:L16:default-sink]";
  const exactWarnings = await withCapturedWarnings(async () => {
    const transport = controlledTransport();
    const session = createSession({
      concierge: conciergeDouble(),
      transport: transport.transport,
      initialContext: CONTEXT_A,
    });
    session.onStageChange(() => {
      throw new Error(PRIVATE_SENTINEL);
    });
    session.setContext(CONTEXT_B);
    await session.stop();
  });

  const realConsole = globalThis.console;
  const continued = [];
  try {
    Reflect.deleteProperty(globalThis, "console");
    const missingTransport = controlledTransport();
    const missingSession = createSession({
      concierge: conciergeDouble(),
      transport: missingTransport.transport,
      initialContext: CONTEXT_A,
    });
    missingSession.onStageChange(() => {
      throw new Error(PRIVATE_SENTINEL);
    });
    missingSession.onStageChange((stage) => continued.push(`missing:${stage}`));
    missingSession.setContext(CONTEXT_B);
    await missingSession.stop();

    globalThis.console = {
      ...realConsole,
      warn() {
        throw new Error(PRIVATE_SENTINEL);
      },
    };
    const throwingTransport = controlledTransport();
    const throwingSession = createSession({
      concierge: conciergeDouble(),
      transport: throwingTransport.transport,
      initialContext: CONTEXT_A,
    });
    throwingSession.onStageChange(() => {
      throw new Error(PRIVATE_SENTINEL);
    });
    throwingSession.onStageChange((stage) =>
      continued.push(`throwing:${stage}`),
    );
    throwingSession.setContext(CONTEXT_B);
    await throwingSession.stop();
  } finally {
    globalThis.console = realConsole;
  }

  expect({ continued, exactWarnings }, marker).toEqual({
    continued: ["missing:beta", "throwing:beta"],
    exactWarnings: [
      `concierge: [stage_listener_failed] ${DIAGNOSTIC_MESSAGES.stage_listener_failed}`,
    ],
  });
});

it("[L19] finalizes an interrupted outcome occurrence and runs its FIFO successor", async () => {
  const marker = "[RED:L19:interrupted-outcome-local-failure]";
  const events = [];
  const diagnostics = [];
  const successorFinished = deferred();
  let outcomeCalls = 0;
  const transport = controlledTransport({
    respond({ callId }) {
      events.push(`respond:${callId}`);
      if (callId === "successor") successorFinished.resolve();
    },
  });
  const session = createSession({
    concierge: conciergeDouble({
      async dispatchBatch(_context, batch) {
        events.push(`dispatch:${batch.responseId}`);
        return batch.responseId === "interrupted"
          ? [
              Object.freeze({
                callId: "interrupted",
                result: Object.freeze({
                  ok: false,
                  reason: "cancelled",
                  message: "The application authored this failure.",
                }),
              }),
            ]
          : [row("successor")];
      },
    }),
    transport: transport.transport,
    initialContext: CONTEXT_A,
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
      events.push(`diagnostic:${diagnostic.code}`);
    },
    presentOutcome() {
      outcomeCalls += 1;
      events.push("outcome:interrupted");
      return Promise.resolve(Object.freeze({ outcome: "interrupted" }));
    },
  });

  transport.emitBatch(toolBatch("interrupted"));
  transport.emitBatch(toolBatch("successor"));
  await successorFinished.promise;

  expect(
    {
      diagnostics,
      events,
      outcomeCalls,
      responseIds: transport.responses.map(({ callId }) => callId),
      subscribers: transport.subscriberCounts(),
    },
    marker,
  ).toEqual({
    diagnostics: [
      {
        code: "outcome_presentation_failed",
        message: DIAGNOSTIC_MESSAGES.outcome_presentation_failed,
      },
    ],
    events: [
      "dispatch:interrupted",
      "outcome:interrupted",
      "diagnostic:outcome_presentation_failed",
      "dispatch:successor",
      "respond:successor",
    ],
    outcomeCalls: 1,
    responseIds: ["successor"],
    subscribers: { status: 1, batch: 1 },
  });
  await session.stop();
});
