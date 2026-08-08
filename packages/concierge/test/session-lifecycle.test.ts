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

const CONTEXT_A = Object.freeze({ page: "alpha" });
const CONTEXT_B = Object.freeze({ page: "beta" });
const CONTEXT_C = Object.freeze({ page: "gamma" });
const CATALOG_A = Object.freeze([]);
const CATALOG_B = Object.freeze([]);
const CATALOG_C = Object.freeze([]);

let createSession;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the session lifecycle suite.",
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

it("[L05] cuts off output when stop occurs at dispatch, response, and stage boundaries", async () => {
  const marker = "[RED:L05:stop-at-every-boundary]";
  let responseSession;
  let responseDrain;
  const responseTransport = controlledTransport({
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
