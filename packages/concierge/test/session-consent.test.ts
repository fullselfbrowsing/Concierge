import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const COMPLETED_OUTCOME = Object.freeze({ outcome: "completed" });

let createConcierge;
let createSession;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the session consent suite.",
    );
  }

  const artifact = await import(DIST_URL.href);
  createConcierge = artifact.createConcierge;
  createSession = artifact.createSession;
});

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

function completedOutcome() {
  return Promise.resolve(COMPLETED_OUTCOME);
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

function conciergeFor(consentProfile) {
  return createConcierge({ stages: [], consentProfile });
}

function runtimeBatch(responseId) {
  return Object.freeze({ responseId, calls: Object.freeze([]) });
}

function runtimeSession({ dispatchBatch, onDiagnostic, presentOutcome, respond }) {
  let batchSubscriber = null;
  const responses = [];
  const transport = Object.freeze({
    capabilities: Object.freeze({
      consentGrade: "none",
      userTurnIdentity: "none",
      parallelCalls: false,
      dynamicCatalog: true,
    }),
    get status() {
      return "idle";
    },
    setTools() {},
    onStatusChange() {
      return () => {};
    },
    onToolBatch(callback) {
      batchSubscriber = callback;
      return () => {
        if (batchSubscriber === callback) batchSubscriber = null;
      };
    },
    respond(callId, result) {
      const attempt = Object.freeze({ callId, result });
      responses.push(attempt);
      respond?.(attempt, responses.length);
    },
  });
  const concierge = {
    catalogFor: () => Object.freeze([]),
    stageFor: () => "consent",
    dispatchBatch,
    dispatch: () => Promise.resolve(Object.freeze({ ok: true, message: "unused" })),
    explain: () => ({ stage: "consent", stages: [], catalog: [] }),
  };
  const session = createSession({
    concierge,
    transport,
    initialContext: Object.freeze({ page: "consent" }),
    onDiagnostic,
    presentOutcome,
  });

  return Object.freeze({
    responses,
    session,
    emitBatch(batch) {
      if (batchSubscriber === null) throw new Error("batch subscriber missing");
      batchSubscriber(batch);
    },
  });
}

function observedTransport(capabilities) {
  const events = [];
  const transport = {
    capabilities,
    get status() {
      events.push("status");
      return "idle";
    },
    setTools() {
      events.push("setTools");
    },
    onStatusChange() {
      events.push("subscribe:status");
      return () => {
        events.push("unsubscribe:status");
      };
    },
    onToolBatch() {
      events.push("subscribe:batch");
      return () => {
        events.push("unsubscribe:batch");
      };
    },
    respond() {
      events.push("respond");
    },
  };
  return { events, transport };
}

function observedAccessorTransport(descriptor) {
  const observed = observedTransport(undefined);
  Object.defineProperty(observed.transport, "capabilities", descriptor);
  return observed;
}

async function attemptStart(config) {
  let message;
  let session;
  try {
    session = createSession(config);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  const constructionEvents = [...config.transportEvents];
  if (session !== undefined) await session.stop();
  return { constructionEvents, message, session };
}

it("[S01] accepts equal, stronger, and absent-declaration capability profiles", async () => {
  const cases = [
    {
      declared: { consentGrade: "relayed", userTurnIdentity: "agent-forgeable" },
      actual: {
        consentGrade: "relayed",
        userTurnIdentity: "agent-forgeable",
        parallelCalls: false,
        dynamicCatalog: true,
      },
    },
    {
      declared: { consentGrade: "delivered", userTurnIdentity: "agent-forgeable" },
      actual: {
        consentGrade: "attested",
        userTurnIdentity: "human-attested",
        parallelCalls: false,
        dynamicCatalog: true,
      },
    },
    {
      declared: undefined,
      actual: {
        consentGrade: "attested",
        userTurnIdentity: "human-attested",
        parallelCalls: false,
        dynamicCatalog: true,
      },
    },
  ];

  const observations = [];
  for (const entry of cases) {
    const { events, transport } = observedTransport(entry.actual);
    const session = createSession({
      concierge: conciergeFor(entry.declared),
      transport,
      presentOutcome: completedOutcome,
    });
    observations.push({ frozen: Object.isFrozen(session), started: events.length > 0 });
    await session.stop();
  }

  expect(observations, "[RED:S01:capability-dominance-positive]").toEqual([
    { frozen: true, started: true },
    { frozen: true, started: true },
    { frozen: true, started: true },
  ]);
});

it("[S02] rejects every weaker capability dimension before transport or app effects", async () => {
  const cases = [
    {
      declared: { consentGrade: "relayed", userTurnIdentity: "agent-forgeable" },
      actual: {
        consentGrade: "delivered",
        userTurnIdentity: "human-attested",
        parallelCalls: false,
        dynamicCatalog: true,
      },
    },
    {
      declared: { consentGrade: "delivered", userTurnIdentity: "human-attested" },
      actual: {
        consentGrade: "attested",
        userTurnIdentity: "agent-forgeable",
        parallelCalls: false,
        dynamicCatalog: true,
      },
    },
    {
      declared: { consentGrade: "attested", userTurnIdentity: "human-attested" },
      actual: {
        consentGrade: "none",
        userTurnIdentity: "none",
        parallelCalls: false,
        dynamicCatalog: true,
      },
    },
  ];

  const observations = [];
  for (const entry of cases) {
    const { events, transport } = observedTransport(entry.actual);
    const observed = await attemptStart({
      concierge: conciergeFor(entry.declared),
      transport,
      transportEvents: events,
      onDiagnostic: () => {
        events.push("diagnostic");
      },
      presentOutcome: async () => {
        events.push("outcome");
        return COMPLETED_OUTCOME;
      },
    });
    observations.push({
      constructionEvents: observed.constructionEvents,
      message: observed.message,
      returnedHandle: observed.session !== undefined,
    });
  }

  expect(observations, "[RED:S02:weaker-profile-pre-effect]").toEqual(
    cases.map(() => ({
      constructionEvents: [],
      message: "The session could not start.",
      returnedHandle: false,
    })),
  );
});

it("[S03] contains malformed, accessor-backed, throwing, and forged capability claims", async () => {
  const sentinel = "PRIVATE-S03-CAPABILITY";
  let topAccessorReads = 0;
  let fieldAccessorReads = 0;
  let nonConsentAccessorReads = 0;
  const accessorProfile = {
    get consentGrade() {
      fieldAccessorReads += 1;
      return "attested";
    },
    userTurnIdentity: "human-attested",
    parallelCalls: false,
    dynamicCatalog: true,
  };
  const throwingProxy = new Proxy({}, {
    getPrototypeOf() {
      throw new Error(sentinel);
    },
  });
  const exoticProfile = Object.assign(Object.create({ inherited: true }), {
    consentGrade: "attested",
    userTurnIdentity: "human-attested",
    parallelCalls: false,
    dynamicCatalog: true,
  });
  const accessorNonConsentCapability = {
    consentGrade: "attested",
    userTurnIdentity: "human-attested",
    get parallelCalls() {
      nonConsentAccessorReads += 1;
      return false;
    },
    dynamicCatalog: true,
  };

  const cases = [
    observedTransport(null),
    observedTransport({
      consentGrade: "invented",
      userTurnIdentity: "human-attested",
      parallelCalls: false,
      dynamicCatalog: true,
    }),
    observedTransport(accessorProfile),
    observedTransport(throwingProxy),
    observedTransport(exoticProfile),
    observedTransport({
      consentGrade: "attested",
      userTurnIdentity: "human-attested",
      dynamicCatalog: true,
    }),
    observedTransport({
      consentGrade: "attested",
      userTurnIdentity: "human-attested",
      parallelCalls: false,
    }),
    observedTransport({
      consentGrade: "attested",
      userTurnIdentity: "human-attested",
      parallelCalls: 0,
      dynamicCatalog: true,
    }),
    observedTransport({
      consentGrade: "attested",
      userTurnIdentity: "human-attested",
      parallelCalls: false,
      dynamicCatalog: "yes",
    }),
    observedTransport(accessorNonConsentCapability),
    observedAccessorTransport({
      enumerable: true,
      configurable: true,
      get() {
        topAccessorReads += 1;
        throw new Error(sentinel);
      },
    }),
  ];

  const observations = [];
  for (const { events, transport } of cases) {
    const observed = await attemptStart({
      concierge: conciergeFor({
        consentGrade: "delivered",
        userTurnIdentity: "human-attested",
      }),
      transport,
      transportEvents: events,
      onDiagnostic: () => {
        events.push("diagnostic");
      },
      presentOutcome: completedOutcome,
    });
    observations.push({
      constructionEvents: observed.constructionEvents,
      leaked: observed.message?.includes(sentinel) ?? false,
      message: observed.message,
      returnedHandle: observed.session !== undefined,
    });
  }

  expect(
    {
      fieldAccessorReads,
      nonConsentAccessorReads,
      observations,
      topAccessorReads,
    },
    "[RED:S03:hostile-capability-containment]",
  ).toEqual({
    fieldAccessorReads: 0,
    nonConsentAccessorReads: 0,
    observations: cases.map(() => ({
      constructionEvents: [],
      leaked: false,
      message: "The session could not start.",
      returnedHandle: false,
    })),
    topAccessorReads: 0,
  });
});

it("[S04] requires and captures one callable outcome sink before session effects", async () => {
  const sentinel = "PRIVATE-S04-OUTCOME-SINK";
  const invalidValues = [undefined, null, "not-a-function"];
  const invalidObservations = [];
  for (const presentOutcome of invalidValues) {
    const { events, transport } = observedTransport({
      consentGrade: "none",
      userTurnIdentity: "none",
      parallelCalls: false,
      dynamicCatalog: true,
    });
    const observed = await attemptStart({
      concierge: conciergeFor(undefined),
      transport,
      transportEvents: events,
      onDiagnostic: () => {
        events.push("diagnostic");
      },
      presentOutcome,
    });
    invalidObservations.push({
      constructionEvents: observed.constructionEvents,
      message: observed.message,
      returnedHandle: observed.session !== undefined,
    });
  }

  let throwingSinkReads = 0;
  const throwingObserved = observedTransport({
    consentGrade: "none",
    userTurnIdentity: "none",
    parallelCalls: false,
    dynamicCatalog: true,
  });
  const throwingConfig = {
    concierge: conciergeFor(undefined),
    transport: throwingObserved.transport,
    transportEvents: throwingObserved.events,
    onDiagnostic: () => {
      throwingObserved.events.push("diagnostic");
    },
    get presentOutcome() {
      throwingSinkReads += 1;
      throw new Error(sentinel);
    },
  };
  const throwingResult = await attemptStart(throwingConfig);

  let sinkReads = 0;
  const { events, transport } = observedTransport({
    consentGrade: "none",
    userTurnIdentity: "none",
    parallelCalls: false,
    dynamicCatalog: true,
  });
  const config = {
    concierge: conciergeFor(undefined),
    transport,
    get presentOutcome() {
      sinkReads += 1;
      return completedOutcome;
    },
  };
  const session = createSession(config);
  const constructionSinkReads = sinkReads;
  await session.stop();

  expect(
    {
      constructionSinkReads,
      invalidObservations,
      throwingSink: {
        constructionEvents: throwingResult.constructionEvents,
        leaked: throwingResult.message?.includes(sentinel) ?? false,
        message: throwingResult.message,
        reads: throwingSinkReads,
        returnedHandle: throwingResult.session !== undefined,
      },
    },
    "[RED:S04:required-captured-outcome-sink]",
  ).toEqual({
    constructionSinkReads: 1,
    invalidObservations: invalidValues.map(() => ({
      constructionEvents: [],
      message: "The session could not start.",
      returnedHandle: false,
    })),
    throwingSink: {
      constructionEvents: [],
      leaked: false,
      message: "The session could not start.",
      reads: 1,
      returnedHandle: false,
    },
  });
  expect(events.length).toBeGreaterThan(0);
});

it("[S05] bypasses outcome presentation for an all-success occurrence", async () => {
  const marker = "[RED:S05:all-success-bypass]";
  const events = [];
  const finished = deferred();
  const results = [
    Object.freeze({ ok: true, message: "first succeeded" }),
    Object.freeze({ ok: true, message: "second succeeded" }),
  ];
  const rows = Object.freeze([
    Object.freeze({ callId: "success-1", result: results[0] }),
    Object.freeze({ callId: "success-2", result: results[1] }),
  ]);
  let outcomeCalls = 0;
  const harness = runtimeSession({
    async dispatchBatch() {
      events.push("dispatch");
      return rows;
    },
    presentOutcome() {
      outcomeCalls += 1;
      events.push("outcome");
      return completedOutcome();
    },
    respond({ callId }, occurrence) {
      events.push(`respond:${callId}`);
      if (occurrence === rows.length) finished.resolve();
    },
  });

  harness.emitBatch(runtimeBatch("all-success"));
  await finished.promise;

  expect(
    {
      events,
      outcomeCalls,
      responseIds: harness.responses.map(({ callId }) => callId),
      resultIdentity: harness.responses.map(
        ({ result }, index) => result === results[index],
      ),
    },
    marker,
  ).toEqual({
    events: ["dispatch", "respond:success-1", "respond:success-2"],
    outcomeCalls: 0,
    responseIds: ["success-1", "success-2"],
    resultIdentity: [true, true],
  });
  await harness.session.stop();
});

it("[S06] presents one stable deeply frozen minimal failure outcome before any response", async () => {
  const marker = "[RED:S06:frozen-outcome-before-response]";
  const events = [];
  const finished = deferred();
  const outcomeGate = deferred();
  const successA = Object.freeze({ ok: true, message: "first succeeded" });
  const failureA = {
    ok: false,
    reason: "cancelled",
    message: "The first action was cancelled.",
    privatePayload: "PRIVATE-S06-A",
  };
  const successB = Object.freeze({ ok: true, message: "second succeeded" });
  const failureB = {
    ok: false,
    reason: undefined,
    message: "The second action failed.",
    modelText: "PRIVATE-S06-B",
  };
  const rows = [
    { callId: "success-a", result: successA },
    { callId: "failure-a", result: failureA, arguments: "PRIVATE-S06-ARGS" },
    { callId: "success-b", result: successB },
    { callId: "failure-b", result: failureB },
  ];
  let observedOutcome;
  let outcomeCalls = 0;
  let mutationAttempts;
  const harness = runtimeSession({
    async dispatchBatch() {
      events.push("dispatch");
      return rows;
    },
    presentOutcome(outcome) {
      outcomeCalls += 1;
      events.push("outcome");
      observedOutcome = outcome;
      mutationAttempts = {
        container: Reflect.set(outcome, "failures", []),
        array: Reflect.set(outcome.failures, 0, Object.freeze({})),
        row: Reflect.set(outcome.failures[0], "message", "tampered"),
      };
      failureA.message = "MUTATED-SOURCE-A";
      failureB.reason = "aborted";
      return outcomeGate.promise;
    },
    respond({ callId }, occurrence) {
      events.push(`respond:${callId}`);
      if (occurrence === rows.length) finished.resolve();
    },
  });

  harness.emitBatch(runtimeBatch("mixed"));
  await flushMicrotasks();
  expect(
    {
      events: [...events],
      responses: harness.responses.length,
    },
    `${marker}:await-completion`,
  ).toEqual({ events: ["dispatch", "outcome"], responses: 0 });
  outcomeGate.resolve(COMPLETED_OUTCOME);
  await finished.promise;

  const observedFailures = observedOutcome?.failures ?? [];

  expect(
    {
      events,
      exactContainerKeys:
        observedOutcome === undefined ? [] : Object.keys(observedOutcome).sort(),
      exactRowKeys: observedFailures.map((failure) =>
        Object.keys(failure).sort()
      ),
      frozen: {
        container:
          observedOutcome !== undefined && Object.isFrozen(observedOutcome),
        failures: Object.isFrozen(observedFailures),
        rows: observedFailures.map((failure) => Object.isFrozen(failure)),
      },
      mutationAttempts,
      outcomeCalls,
      presented: observedOutcome,
      responseIds: harness.responses.map(({ callId }) => callId),
      resultIdentity: harness.responses.map(
        ({ result }, index) => result === rows[index].result,
      ),
    },
    marker,
  ).toEqual({
    events: [
      "dispatch",
      "outcome",
      "respond:success-a",
      "respond:failure-a",
      "respond:success-b",
      "respond:failure-b",
    ],
    exactContainerKeys: ["failures"],
    exactRowKeys: [
      ["callId", "message", "reason"],
      ["callId", "message", "reason"],
    ],
    frozen: { container: true, failures: true, rows: [true, true] },
    mutationAttempts: { array: false, container: false, row: false },
    outcomeCalls: 1,
    presented: {
      failures: [
        {
          callId: "failure-a",
          reason: "cancelled",
          message: "The first action was cancelled.",
        },
        {
          callId: "failure-b",
          reason: undefined,
          message: "The second action failed.",
        },
      ],
    },
    responseIds: ["success-a", "failure-a", "success-b", "failure-b"],
    resultIdentity: [true, true, true, true],
  });
  expect(JSON.stringify(observedOutcome), marker).not.toContain("PRIVATE-S06");
  await harness.session.stop();
});

it("[S07] fails closed once for hostile outcome presentation and keeps FIFO live", async () => {
  const marker = "[RED:S07:outcome-failure-matrix]";
  const sentinel = "PRIVATE-S07-OUTCOME";
  let accessorReads = 0;
  const accessorReport = Object.defineProperty({}, "outcome", {
    enumerable: true,
    get() {
      accessorReads += 1;
      throw new Error(sentinel);
    },
  });
  const hostileReport = new Proxy({}, {
    getPrototypeOf() {
      throw new Error(sentinel);
    },
  });
  const cases = [
    {
      name: "throw",
      invoke() {
        throw new Error(sentinel);
      },
    },
    {
      name: "reject",
      invoke: () => Promise.reject(new Error(sentinel)),
    },
    {
      name: "interrupted",
      invoke: () => Promise.resolve(Object.freeze({ outcome: "interrupted" })),
    },
    { name: "null-report", invoke: () => Promise.resolve(null) },
    {
      name: "unknown-outcome",
      invoke: () => Promise.resolve(Object.freeze({ outcome: "unknown" })),
    },
    { name: "accessor-report", invoke: () => Promise.resolve(accessorReport) },
    { name: "hostile-report", invoke: () => Promise.resolve(hostileReport) },
  ];
  const observations = [];

  for (const entry of cases) {
    const events = [];
    const diagnostics = [];
    const laterFinished = deferred();
    let outcomeCalls = 0;
    const harness = runtimeSession({
      async dispatchBatch(_context, batch) {
        const responseId = batch.responseId;
        events.push(`dispatch:${responseId}`);
        return responseId === "blocked"
          ? [
              {
                callId: `${entry.name}:blocked-success`,
                result: {
                  ok: true,
                  message: "This row must wait behind the failed outcome.",
                },
              },
              {
                callId: `${entry.name}:blocked-failure`,
                result: {
                  ok: false,
                  reason: "cancelled",
                  message: "The application authored this failure.",
                },
              },
            ]
          : [{
              callId: `${entry.name}:later`,
              result: { ok: true, message: "The later action succeeded." },
            }];
      },
      onDiagnostic(diagnostic) {
        diagnostics.push(diagnostic);
        events.push(`diagnostic:${diagnostic.code}`);
      },
      presentOutcome() {
        outcomeCalls += 1;
        events.push("outcome:blocked");
        return entry.invoke();
      },
      respond({ callId }) {
        events.push(`respond:${callId}`);
        if (callId === `${entry.name}:later`) laterFinished.resolve();
      },
    });

    harness.emitBatch(runtimeBatch("blocked"));
    harness.emitBatch(runtimeBatch("later"));
    await laterFinished.promise;
    observations.push({
      diagnostics,
      events,
      leaked: JSON.stringify({ diagnostics, events, responses: harness.responses }).includes(
        sentinel,
      ),
      name: entry.name,
      outcomeCalls,
      responseIds: harness.responses.map(({ callId }) => callId),
    });
    await harness.session.stop();
  }

  expect(
    { accessorReads, observations },
    marker,
  ).toEqual({
    accessorReads: 0,
    observations: cases.map(({ name }) => ({
      diagnostics: [
        {
          code: "outcome_presentation_failed",
          message:
            "The application could not present the failed outcome; no result was released.",
        },
      ],
      events: [
        "dispatch:blocked",
        "outcome:blocked",
        "diagnostic:outcome_presentation_failed",
        "dispatch:later",
        `respond:${name}:later`,
      ],
      leaked: false,
      name,
      outcomeCalls: 1,
      responseIds: [`${name}:later`],
    })),
  });
});
