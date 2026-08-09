import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it as vitestIt } from "vitest";

import {
  COMMAND_PALETTE_CAPABILITIES,
  CONVERSATIONAL_CAPABILITIES,
  createStubTransport,
} from "./fixtures/stub-transport.js";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");

let createConcierge;
let createSession;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the session catalog suite.",
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

function requireFactory(marker) {
  expect(typeof createSession, marker).toBe("function");
}

function testSchema() {
  return {
    "~standard": {
      version: 1,
      vendor: "concierge-session-catalog-test",
      validate: (value) => ({ value }),
    },
  };
}

function action(name, handler = () => ({ ok: true, message: "Done." })) {
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

function realConcierge() {
  return createConcierge({
    stages: [
      {
        id: "alpha",
        match: (ctx) => ctx.page === "alpha",
        actions: [action("alphaAction")],
      },
      {
        id: "beta",
        match: (ctx) => ctx.page === "beta",
        actions: [action("betaAction")],
      },
    ],
    crossStage: [action("globalAction")],
  });
}

function toolCall(callId, name = "run", outputIndex = 0) {
  return { callId, name, arguments: "{}", outputIndex };
}

function toolBatch(callIds) {
  return {
    responseId: "response-session-catalog",
    calls: callIds.map((callId, index) => toolCall(callId, "run", index)),
  };
}

function resultRow(callId, result = { ok: true, message: `handled:${callId}` }) {
  return Object.freeze({ callId, result: Object.freeze(result) });
}

async function flushMicrotasks() {
  for (let index = 0; index < 16; index += 1) await Promise.resolve();
}

function conciergeDouble(entries, dispatchBatch) {
  const byContext = new Map(entries.map(({ context, catalog, stage }) => [context, { catalog, stage }]));
  return {
    catalogFor(context) {
      const entry = byContext.get(context);
      if (entry === undefined) throw new Error("unknown context");
      return entry.catalog;
    },
    stageFor(context) {
      const entry = byContext.get(context);
      if (entry === undefined) throw new Error("unknown context");
      return entry.stage;
    },
    dispatchBatch,
    dispatch: () => Promise.resolve({ ok: false, message: "unused" }),
    explain: () => ({ stage: null, stages: [], catalog: [] }),
  };
}

function controlledTransport({
  capabilities = CONVERSATIONAL_CAPABILITIES,
  initialStatus = "idle",
} = {}) {
  let status = initialStatus;
  let nextToken = 0;
  const statusSubscribers = new Map();
  const batchSubscribers = new Map();
  const publications = [];
  const responses = [];
  const cleanup = [];
  let setToolsHook = () => {};
  let unsubscribeHook = () => {};

  const transport = Object.freeze({
    capabilities,
    get status() {
      return status;
    },
    setTools(tools) {
      publications.push(tools);
      setToolsHook(tools, publications.length);
    },
    onStatusChange(callback) {
      const token = ++nextToken;
      statusSubscribers.set(token, callback);
      return () => {
        statusSubscribers.delete(token);
        cleanup.push("status");
        unsubscribeHook("status");
      };
    },
    onToolBatch(callback) {
      const token = ++nextToken;
      batchSubscribers.set(token, callback);
      return () => {
        batchSubscribers.delete(token);
        cleanup.push("batch");
        unsubscribeHook("batch");
      };
    },
    respond(callId, result) {
      responses.push(Object.freeze({ callId, result }));
    },
  });

  return Object.freeze({
    transport,
    publications,
    responses,
    cleanup,
    emitBatch(batch) {
      for (const callback of [...batchSubscribers.values()]) callback(batch);
    },
    emitStatus(nextStatus) {
      if (nextStatus === status) return;
      status = nextStatus;
      for (const callback of [...statusSubscribers.values()]) callback(nextStatus);
    },
    subscriberCounts() {
      return Object.freeze({
        status: statusSubscribers.size,
        batch: batchSubscribers.size,
      });
    },
    setSetToolsHook(hook) {
      setToolsHook = hook;
    },
    setUnsubscribeHook(hook) {
      unsubscribeHook = hook;
    },
  });
}

it("[C01] publishes the exact initial catalog synchronously", async () => {
  const marker = "[RED:C01:initial-publication]";
  requireFactory(marker);
  const concierge = realConcierge();
  const initialContext = { page: "alpha" };
  const expected = concierge.catalogFor(initialContext);
  const stub = createStubTransport({ capabilities: CONVERSATIONAL_CAPABILITIES });

  const session = createSession({ concierge, transport: stub.transport, initialContext });

  expect(
    {
      frozenHandle: Object.isFrozen(session),
      historyLength: stub.catalogHistory().length,
      sameReference: stub.catalogHistory()[0] === expected,
      stage: session.stage(),
    },
    marker,
  ).toEqual({
    frozenHandle: true,
    historyLength: 1,
    sameReference: true,
    stage: "alpha",
  });
  await session.stop();
});

it("[C02] publishes one frozen empty catalog when context is absent", async () => {
  const marker = "[RED:C02:no-context-empty]";
  requireFactory(marker);
  const diagnostics = [];
  const concierge = realConcierge();
  const stub = createStubTransport({ capabilities: CONVERSATIONAL_CAPABILITIES });

  const session = createSession({
    concierge,
    transport: stub.transport,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  const initial = stub.catalogHistory()[0];
  stub.emitBatch({
    responseId: "no-context",
    calls: [toolCall("global", "globalAction")],
  });
  await flushMicrotasks();

  expect(
    {
      diagnosticCodes: diagnostics.map((entry) => entry.code),
      empty: initial?.length,
      frozen: Object.isFrozen(initial),
      noCrossStageLeak: initial !== concierge.catalogFor({}),
      responses: stub.responseHistory().length,
      stage: session.stage(),
    },
    marker,
  ).toEqual({
    diagnosticCodes: ["batch_without_context"],
    empty: 0,
    frozen: true,
    noCrossStageLeak: true,
    responses: 0,
    stage: null,
  });
  await session.stop();
});

it("[C03] keys catalog epochs by exact published reference", async () => {
  const marker = "[RED:C03:catalog-reference-epoch]";
  requireFactory(marker);
  const a = { name: "a" };
  const sameA = { name: "same-a" };
  const b = { name: "b" };
  const returnA = { name: "return-a" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  const concierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "same" },
      { context: sameA, catalog: catalogA, stage: "same" },
      { context: b, catalog: catalogB, stage: "same" },
      { context: returnA, catalog: catalogA, stage: "same" },
    ],
    async () => Object.freeze([]),
  );
  const stub = createStubTransport({ capabilities: CONVERSATIONAL_CAPABILITIES });
  const session = createSession({ concierge, transport: stub.transport, initialContext: a });

  session.setContext(sameA);
  session.setContext(b);
  session.setContext(returnA);

  expect(stub.catalogHistory(), marker).toEqual([catalogA, catalogB, catalogA]);
  expect(stub.catalogHistory()[0]).toBe(catalogA);
  expect(stub.catalogHistory()[1]).toBe(catalogB);
  expect(stub.catalogHistory()[2]).toBe(catalogA);
  await session.stop();
});

it("[C04] replays only on actual transitions into connected", async () => {
  const marker = "[RED:C04:connected-replay]";
  requireFactory(marker);
  const concierge = realConcierge();
  const context = { page: "alpha" };
  const catalog = concierge.catalogFor(context);
  const stub = createStubTransport({
    capabilities: CONVERSATIONAL_CAPABILITIES,
    initialStatus: "idle",
  });
  const session = createSession({ concierge, transport: stub.transport, initialContext: context });

  stub.emitStatus("connecting");
  stub.emitStatus("connected");
  stub.emitStatus("connected");
  stub.emitStatus("closed");
  stub.emitStatus("idle");
  stub.emitStatus("connected");

  expect(
    stub.catalogHistory().map((entry) => entry === catalog),
    marker,
  ).toEqual([true, true, true]);
  await session.stop();
});

it("[C05] notifies stage listeners only for string or null value changes", async () => {
  const marker = "[RED:C05:stage-value-change]";
  requireFactory(marker);
  const a = { name: "a" };
  const duplicate = { name: "duplicate" };
  const other = { name: "other" };
  const none = { name: "none" };
  const catalogA = Object.freeze([]);
  const catalogDuplicate = Object.freeze([]);
  const catalogOther = Object.freeze([]);
  const catalogNone = Object.freeze([]);
  const concierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "same-id" },
      { context: duplicate, catalog: catalogDuplicate, stage: "same-id" },
      { context: other, catalog: catalogOther, stage: "other" },
      { context: none, catalog: catalogNone, stage: null },
    ],
    async () => Object.freeze([]),
  );
  const stub = createStubTransport({ capabilities: CONVERSATIONAL_CAPABILITIES });
  const session = createSession({ concierge, transport: stub.transport, initialContext: a });
  const stages = [];
  session.onStageChange((stage) => stages.push(stage));

  session.setContext(duplicate);
  stub.emitStatus("connected");
  session.setContext(other);
  session.setContext(none);

  expect(
    {
      history: stub.catalogHistory().slice(0, 5),
      stages,
    },
    marker,
  ).toEqual({
    history: [catalogA, catalogDuplicate, catalogDuplicate, catalogOther, catalogNone],
    stages: ["other", null],
  });
  await session.stop();
});

it("[C06] stops a fixed transport before exposing a catalog-change error", async () => {
  const marker = "[RED:C06:fixed-catalog-stop-first]";
  requireFactory(marker);
  const a = { name: "a" };
  const b = { name: "b" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  let dispatchEntries = 0;
  const concierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "a" },
      { context: b, catalog: catalogB, stage: "b" },
    ],
    async () => {
      dispatchEntries += 1;
      return Object.freeze([]);
    },
  );
  const harness = controlledTransport({ capabilities: COMMAND_PALETTE_CAPABILITIES });
  let session;
  const reentry = [];
  harness.setUnsubscribeHook(() => {
    try {
      session.setContext(a);
    } catch (error) {
      reentry.push(error.message);
    }
    harness.emitBatch(toolBatch(["stale"]));
  });
  session = createSession({ concierge, transport: harness.transport, initialContext: a });
  harness.emitStatus("connected");

  let message;
  try {
    session.setContext(b);
  } catch (error) {
    message = error.message;
  }
  await session.stop();

  expect(
    {
      dispatchEntries,
      historyHasB: harness.publications.includes(catalogB),
      message,
      reentry,
      stage: session.stage(),
      subscribers: harness.subscriberCounts(),
    },
    marker,
  ).toEqual({
    dispatchEntries: 0,
    historyHasB: false,
    message: "This transport does not support catalog changes.",
    reentry: ["This session has stopped.", "This session has stopped."],
    stage: "b",
    subscribers: { status: 0, batch: 0 },
  });
});

it("[C07] rolls back every partial construction step", async () => {
  const marker = "[RED:C07:transactional-start]";
  requireFactory(marker);
  const concierge = realConcierge();
  const context = { page: "alpha" };
  const observations = [];

  for (const failures of [
    { subscribeBatch: true },
    { setToolsAt: [1] },
  ]) {
    const diagnostics = [];
    const stub = createStubTransport({
      capabilities: CONVERSATIONAL_CAPABILITIES,
      failures,
    });
    let message;
    let handle;
    try {
      handle = createSession({
        concierge,
        transport: stub.transport,
        initialContext: context,
        onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      });
    } catch (error) {
      message = error.message;
    }
    await flushMicrotasks();
    observations.push({
      diagnostics: diagnostics.map((entry) => ({
        frozen: Object.isFrozen(entry),
        keys: Object.keys(entry).sort(),
      })),
      handle,
      historyLengths: stub.catalogHistory().map((entry) => entry.length),
      message,
      subscribers: stub.subscriberCounts(),
    });
  }

  expect(observations, marker).toEqual([
    {
      diagnostics: [{ frozen: true, keys: ["code", "message"] }],
      handle: undefined,
      historyLengths: [0],
      message: "The session could not start.",
      subscribers: { status: 0, batch: 0 },
    },
    {
      diagnostics: [{ frozen: true, keys: ["code", "message"] }],
      handle: undefined,
      historyLengths: [2, 0],
      message: "The session could not start.",
      subscribers: { status: 0, batch: 0 },
    },
  ]);
});

function assertSafePublicationFailure({ diagnostic, errorMessage, sentinel }) {
  expect(Object.isFrozen(diagnostic)).toBe(true);
  expect(Object.keys(diagnostic).sort()).toEqual(["code", "message"]);
  expect(diagnostic).toEqual({
    code: "catalog_publish_failed",
    message: "The transport rejected a catalog publication, so the session was stopped.",
  });
  expect(JSON.stringify({ diagnostic, errorMessage })).not.toContain(sentinel);
}

it("[C08] fails closed when a later setContext publication throws", async () => {
  const marker = "[RED:C08:setcontext-publication-fail-closed]";
  requireFactory(marker);
  const sentinel = "PRIVATE-C08-CATALOG";
  const a = { private: "ctx-a" };
  const b = { private: "ctx-b" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  let dispatchEntries = 0;
  const concierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "a" },
      { context: b, catalog: catalogB, stage: "b" },
    ],
    async () => {
      dispatchEntries += 1;
      return Object.freeze([]);
    },
  );
  const harness = controlledTransport();
  const diagnostics = [];
  const reentry = [];
  let session;
  harness.setSetToolsHook((_tools, occurrence) => {
    if (occurrence !== 2) return;
    session.stop();
    throw new Error(sentinel);
  });
  const exerciseReentry = (source) => {
    try {
      session.setContext(a);
    } catch (error) {
      reentry.push(`${source}:${error.message}`);
    }
    harness.emitStatus("connected");
    harness.emitBatch(toolBatch([`${source}-batch`]));
  };
  harness.setUnsubscribeHook((kind) => exerciseReentry(kind));
  session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: a,
    onDiagnostic: (diagnostic) => {
      diagnostics.push(diagnostic);
      exerciseReentry("diagnostic");
    },
  });

  let errorMessage;
  try {
    session.setContext(b);
  } catch (error) {
    errorMessage = error.message;
  }
  await session.stop();

  assertSafePublicationFailure({ diagnostic: diagnostics[0], errorMessage, sentinel });
  expect(
    {
      cleanup: harness.cleanup,
      dispatchEntries,
      errorMessage,
      reentry,
      stage: session.stage(),
      subscribers: harness.subscriberCounts(),
    },
    marker,
  ).toEqual({
    cleanup: ["status", "batch"],
    dispatchEntries: 0,
    errorMessage: "The session could not publish the current catalog.",
    reentry: [
      "status:This session has stopped.",
      "batch:This session has stopped.",
      "diagnostic:This session has stopped.",
    ],
    stage: "b",
    subscribers: { status: 0, batch: 0 },
  });
});

it("[C09] fails closed when a connected replay publication throws", async () => {
  const marker = "[RED:C09:replay-publication-fail-closed]";
  requireFactory(marker);
  const sentinel = "PRIVATE-C09-REPLAY";
  const a = { private: "ctx-a" };
  const catalogA = Object.freeze([]);
  let dispatchEntries = 0;
  const concierge = conciergeDouble(
    [{ context: a, catalog: catalogA, stage: "a" }],
    async () => {
      dispatchEntries += 1;
      return Object.freeze([]);
    },
  );
  const harness = controlledTransport();
  const diagnostics = [];
  const reentry = [];
  let session;
  harness.setSetToolsHook((_tools, occurrence) => {
    if (occurrence !== 2) return;
    session.stop();
    throw new Error(sentinel);
  });
  const exerciseReentry = (source) => {
    try {
      session.setContext(a);
    } catch (error) {
      reentry.push(`${source}:${error.message}`);
    }
    harness.emitBatch(toolBatch([`${source}-batch`]));
  };
  harness.setUnsubscribeHook((kind) => exerciseReentry(kind));
  session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: a,
    onDiagnostic: (diagnostic) => {
      diagnostics.push(diagnostic);
      exerciseReentry("diagnostic");
    },
  });

  let errorMessage;
  try {
    harness.emitStatus("connected");
  } catch (error) {
    errorMessage = error.message;
  }
  await session.stop();

  assertSafePublicationFailure({ diagnostic: diagnostics[0], errorMessage, sentinel });
  expect(
    {
      cleanup: harness.cleanup,
      dispatchEntries,
      errorMessage,
      reentry,
      subscribers: harness.subscriberCounts(),
    },
    marker,
  ).toEqual({
    cleanup: ["status", "batch"],
    dispatchEntries: 0,
    errorMessage: "The session could not publish the current catalog.",
    reentry: [
      "status:This session has stopped.",
      "batch:This session has stopped.",
      "diagnostic:This session has stopped.",
    ],
    subscribers: { status: 0, batch: 0 },
  });
});

function accessorTransport(base, onSetToolsRead, onRespond = () => {}) {
  return Object.freeze({
    capabilities: base.transport.capabilities,
    get status() {
      return base.transport.status;
    },
    get setTools() {
      return onSetToolsRead();
    },
    onStatusChange(callback) {
      return base.transport.onStatusChange(callback);
    },
    onToolBatch(callback) {
      return base.transport.onToolBatch(callback);
    },
    respond(callId, result) {
      base.transport.respond(callId, result);
      onRespond(callId, result);
    },
  });
}

it("keeps the empty catalog authoritative when the setContext setTools getter stops", async () => {
  const marker = "[REGRESSION:setcontext-settools-getter-stop-cutoff]";
  const a = { name: "a" };
  const b = { name: "b" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  const concierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "a" },
      { context: b, catalog: catalogB, stage: "b" },
    ],
    async () => Object.freeze([]),
  );
  const base = controlledTransport();
  const publications = [];
  let accessorReads = 0;
  let drain;
  let session;
  let staleInvocations = 0;
  const transport = accessorTransport(base, () => {
    accessorReads += 1;
    if (accessorReads === 2) {
      drain = session.stop();
      return () => {
        staleInvocations += 1;
      };
    }
    return (tools) => {
      publications.push(tools);
    };
  });
  session = createSession({ concierge, transport, initialContext: a });

  session.setContext(b);
  if (drain === undefined) throw new Error("setTools getter did not stop the session");
  await drain;

  expect(
    {
      accessorReads,
      finalCatalogFrozen: Object.isFrozen(publications.at(-1)),
      finalCatalogSize: publications.at(-1)?.length,
      history: publications,
      sameDrain: session.stop() === drain,
      staleInvocations,
    },
    marker,
  ).toEqual({
    accessorReads: 3,
    finalCatalogFrozen: true,
    finalCatalogSize: 0,
    history: [catalogA, publications.at(-1)],
    sameDrain: true,
    staleInvocations: 0,
  });
  expect(publications.at(-1)).not.toBe(catalogA);
  expect(publications.at(-1)).not.toBe(catalogB);
});

it("keeps the empty catalog authoritative when the replay setTools getter stops", async () => {
  const marker = "[REGRESSION:replay-settools-getter-stop-cutoff]";
  const a = { name: "a" };
  const catalogA = Object.freeze([]);
  const concierge = conciergeDouble(
    [{ context: a, catalog: catalogA, stage: "a" }],
    async () => Object.freeze([]),
  );
  const base = controlledTransport({ initialStatus: "idle" });
  const publications = [];
  let accessorReads = 0;
  let drain;
  let session;
  let staleInvocations = 0;
  const transport = accessorTransport(base, () => {
    accessorReads += 1;
    if (accessorReads === 2) {
      drain = session.stop();
      return () => {
        staleInvocations += 1;
      };
    }
    return (tools) => {
      publications.push(tools);
    };
  });
  session = createSession({ concierge, transport, initialContext: a });

  base.emitStatus("connected");
  if (drain === undefined) throw new Error("setTools getter did not stop the session");
  await drain;

  expect(
    {
      accessorReads,
      finalCatalogFrozen: Object.isFrozen(publications.at(-1)),
      finalCatalogSize: publications.at(-1)?.length,
      history: publications,
      sameDrain: session.stop() === drain,
      staleInvocations,
    },
    marker,
  ).toEqual({
    accessorReads: 3,
    finalCatalogFrozen: true,
    finalCatalogSize: 0,
    history: [catalogA, publications.at(-1)],
    sameDrain: true,
    staleInvocations: 0,
  });
  expect(publications.at(-1)).not.toBe(catalogA);
});

it("skips a stale stage resolver after catalog resolution enqueues newer context", async () => {
  const marker = "[REGRESSION:catalog-resolver-reentry-latest-wins]";
  const a = { name: "a" };
  const b = { name: "b" };
  const c = { name: "c" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  const events = [];
  let session;
  const concierge = {
    catalogFor(context) {
      events.push(`catalog:${context.name}`);
      if (context === b) {
        session.setContext(c);
        return catalogB;
      }
      return catalogA;
    },
    stageFor(context) {
      events.push(`stage:${context.name}`);
      if (context === b) throw new Error("STALE-B-STAGE");
      return context.name;
    },
    dispatchBatch: async () => Object.freeze([]),
    dispatch: () => Promise.resolve({ ok: false, message: "unused" }),
    explain: () => ({ stage: null, stages: [], catalog: [] }),
  };
  const harness = controlledTransport();
  session = createSession({ concierge, transport: harness.transport, initialContext: a });

  let errorMessage;
  try {
    session.setContext(b);
  } catch (error) {
    errorMessage = error.message;
  }

  expect(
    {
      errorMessage,
      events,
      history: harness.publications,
      stage: session.stage(),
      subscribers: harness.subscriberCounts(),
    },
    marker,
  ).toEqual({
    errorMessage: undefined,
    events: ["catalog:a", "stage:a", "catalog:b", "catalog:c", "stage:c"],
    history: [catalogA],
    stage: "c",
    subscribers: { status: 1, batch: 1 },
  });
  await session.stop();
});

it("skips a stale fixed-capability branch after its getter enqueues newer context", async () => {
  const marker = "[REGRESSION:capability-getter-reentry-latest-wins]";
  const a = { name: "a" };
  const b = { name: "b" };
  const c = { name: "c" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  const concierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "a" },
      { context: b, catalog: catalogB, stage: "b" },
      { context: c, catalog: catalogA, stage: "c" },
    ],
    async () => Object.freeze([]),
  );
  const base = controlledTransport();
  let capabilityReads = 0;
  let session;
  const capabilities = Object.freeze({
    ...CONVERSATIONAL_CAPABILITIES,
    get dynamicCatalog() {
      capabilityReads += 1;
      session.setContext(c);
      return false;
    },
  });
  const transport = Object.freeze({
    capabilities,
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
    respond(callId, result) {
      base.transport.respond(callId, result);
    },
  });
  session = createSession({ concierge, transport, initialContext: a });

  let errorMessage;
  try {
    session.setContext(b);
  } catch (error) {
    errorMessage = error.message;
  }

  expect(
    {
      capabilityReads,
      errorMessage,
      history: base.publications,
      stage: session.stage(),
      subscribers: base.subscriberCounts(),
    },
    marker,
  ).toEqual({
    capabilityReads: 1,
    errorMessage: undefined,
    history: [catalogA],
    stage: "c",
    subscribers: { status: 1, batch: 1 },
  });
  await session.stop();
});

it("[C10] serializes abort-listener context reentry with latest-wins publication", async () => {
  const marker = "[RED:C10:abort-reentry-latest-wins]";
  requireFactory(marker);
  const a = { name: "a" };
  const b = { name: "b" };
  const c = { name: "c" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  const catalogC = Object.freeze([]);
  const harness = controlledTransport();
  const nestedSnapshots = [];
  const stageEvents = [];
  let dispatchEntries = 0;
  let session;
  const concierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "a" },
      { context: b, catalog: catalogB, stage: "b" },
      { context: c, catalog: catalogC, stage: "c" },
    ],
    async (_context, batch) => {
      dispatchEntries += 1;
      batch.signal.addEventListener("abort", () => {
        session.setContext(c);
        nestedSnapshots.push({
          history: [...harness.publications],
          stage: session.stage(),
        });
      });
      return Object.freeze([]);
    },
  );
  session = createSession({ concierge, transport: harness.transport, initialContext: a });
  session.onStageChange((stage) => stageEvents.push(stage));
  harness.emitBatch(toolBatch(["held-a"]));

  session.setContext(b);
  await flushMicrotasks();

  expect(
    {
      dispatchEntries,
      history: harness.publications.slice(0, 2),
      nestedSnapshots,
      stage: session.stage(),
      stageEvents,
    },
    marker,
  ).toEqual({
    dispatchEntries: 1,
    history: [catalogA, catalogC],
    nestedSnapshots: [{ history: [catalogA], stage: "a" }],
    stage: "c",
    stageEvents: ["c"],
  });
  await session.stop();
});

it("[C11] reconciles a distinct nested context after successful setTools", async () => {
  const marker = "[RED:C11:settools-reentry-latest-wins]";
  requireFactory(marker);
  const a = { name: "a" };
  const b = { name: "b" };
  const c = { name: "c" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  const catalogC = Object.freeze([]);
  const harness = controlledTransport();
  const nestedSnapshots = [];
  const stageEvents = [];
  let dispatchEntries = 0;
  let handlerEntries = 0;
  let session;
  const concierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "a" },
      { context: b, catalog: catalogB, stage: "b" },
      { context: c, catalog: catalogC, stage: "c" },
    ],
    async (_context, batch) => {
      dispatchEntries += 1;
      if (!batch.signal.aborted) handlerEntries += 1;
      return Object.freeze(
        batch.calls.map((call) =>
          resultRow(
            call.callId,
            batch.signal.aborted
              ? { ok: false, reason: "aborted", message: "The action was cancelled before it ran." }
              : undefined,
          ),
        ),
      );
    },
  );
  harness.setSetToolsHook((tools, occurrence) => {
    if (occurrence !== 2 || tools !== catalogB) return;
    harness.emitBatch(toolBatch(["b-2", "b-1"]));
    session.setContext(c);
    nestedSnapshots.push({
      dispatchEntries,
      handlerEntries,
      history: [...harness.publications],
      responses: harness.responses.length,
      stageEvents: [...stageEvents],
    });
  });
  session = createSession({ concierge, transport: harness.transport, initialContext: a });
  session.onStageChange((stage) => stageEvents.push(stage));

  session.setContext(b);
  await flushMicrotasks();

  expect(
    {
      dispatchEntries,
      handlerEntries,
      history: harness.publications.slice(0, 3),
      nestedSnapshots,
      responseIds: harness.responses.map((entry) => entry.callId),
      stage: session.stage(),
      stageEvents,
    },
    marker,
  ).toEqual({
    dispatchEntries: 1,
    handlerEntries: 0,
    history: [catalogA, catalogB, catalogC],
    nestedSnapshots: [{
      dispatchEntries: 0,
      handlerEntries: 0,
      history: [catalogA, catalogB],
      responses: 0,
      stageEvents: [],
    }],
    responseIds: ["b-2", "b-1"],
    stage: "c",
    stageEvents: ["c"],
  });
  await session.stop();
});

it("[C12] admits publication-time batches only after confirmation", async () => {
  const marker = "[RED:C12:publication-admission-gate]";
  requireFactory(marker);
  const a = { name: "a" };
  const b = { name: "b" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  const harness = controlledTransport();
  const inside = [];
  const stageEvents = [];
  let dispatchEntries = 0;
  let handlerEntries = 0;
  let session;
  const concierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "a" },
      { context: b, catalog: catalogB, stage: "b" },
    ],
    async (_context, batch) => {
      dispatchEntries += 1;
      if (!batch.signal.aborted) handlerEntries += 1;
      return Object.freeze([resultRow(batch.calls[0].callId)]);
    },
  );
  harness.setSetToolsHook((tools, occurrence) => {
    if (occurrence !== 2 || tools !== catalogB) return;
    harness.emitBatch(toolBatch(["inside-b"]));
    inside.push({
      dispatchEntries,
      handlerEntries,
      responses: harness.responses.length,
      stageEvents: [...stageEvents],
    });
  });
  session = createSession({ concierge, transport: harness.transport, initialContext: a });
  session.onStageChange((stage) => stageEvents.push(stage));

  session.setContext(b);
  await flushMicrotasks();

  expect(
    {
      dispatchEntries,
      handlerEntries,
      inside,
      responses: harness.responses.length,
      stageEvents,
    },
    marker,
  ).toEqual({
    dispatchEntries: 1,
    handlerEntries: 1,
    inside: [{ dispatchEntries: 0, handlerEntries: 0, responses: 0, stageEvents: [] }],
    responses: 1,
    stageEvents: ["b"],
  });
  await session.stop();
});

async function runFailingPublicationBatchCase({ replay }) {
  const a = { name: "a" };
  const b = { name: "b" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  const harness = controlledTransport();
  const diagnostics = [];
  const stageEvents = [];
  let dispatchEntries = 0;
  let handlerEntries = 0;
  let session;
  const concierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "a" },
      { context: b, catalog: catalogB, stage: "b" },
    ],
    async (_context, batch) => {
      dispatchEntries += 1;
      if (!batch.signal.aborted) handlerEntries += 1;
      return Object.freeze([resultRow(batch.calls[0].callId)]);
    },
  );
  harness.setSetToolsHook((_tools, occurrence) => {
    if (occurrence !== 2) return;
    harness.emitBatch(toolBatch([replay ? "replay-failed" : "context-failed"]));
    throw new Error(replay ? "PRIVATE-C14" : "PRIVATE-C13");
  });
  const reentry = [];
  const tryReentry = () => {
    try {
      session.setContext(a);
    } catch (error) {
      reentry.push(error.message);
    }
    harness.emitStatus("idle");
    harness.emitBatch(toolBatch(["late"]));
  };
  harness.setUnsubscribeHook(tryReentry);
  session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: a,
    onDiagnostic: (diagnostic) => {
      diagnostics.push(diagnostic);
      tryReentry();
    },
  });
  session.onStageChange((stage) => stageEvents.push(stage));

  let errorMessage;
  try {
    if (replay) harness.emitStatus("connected");
    else session.setContext(b);
  } catch (error) {
    errorMessage = error.message;
  }
  await session.stop();

  return {
    cleanup: harness.cleanup,
    diagnostics,
    dispatchEntries,
    errorMessage,
    handlerEntries,
    history: harness.publications,
    reentry,
    responses: harness.responses.length,
    stageEvents,
    catalogA,
    catalogB,
  };
}

it("[C13] drains a batch emitted inside a failing setContext publication", async () => {
  const marker = "[RED:C13:setcontext-failure-batch-drain]";
  requireFactory(marker);
  const observed = await runFailingPublicationBatchCase({ replay: false });

  expect(
    {
      cleanup: observed.cleanup,
      diagnostic: observed.diagnostics[0],
      dispatchEntries: observed.dispatchEntries,
      errorMessage: observed.errorMessage,
      handlerEntries: observed.handlerEntries,
      historyPrefix: observed.history.slice(0, 2),
      reentry: observed.reentry,
      responses: observed.responses,
      stageEvents: observed.stageEvents,
    },
    marker,
  ).toEqual({
    cleanup: ["status", "batch"],
    diagnostic: {
      code: "catalog_publish_failed",
      message: "The transport rejected a catalog publication, so the session was stopped.",
    },
    dispatchEntries: 1,
    errorMessage: "The session could not publish the current catalog.",
    handlerEntries: 0,
    historyPrefix: [observed.catalogA, observed.catalogB],
    reentry: [
      "This session has stopped.",
      "This session has stopped.",
      "This session has stopped.",
    ],
    responses: 0,
    stageEvents: [],
  });
});

it("[C14] drains a batch emitted inside a failing connected replay", async () => {
  const marker = "[RED:C14:replay-failure-batch-drain]";
  requireFactory(marker);
  const observed = await runFailingPublicationBatchCase({ replay: true });

  expect(
    {
      cleanup: observed.cleanup,
      diagnostic: observed.diagnostics[0],
      dispatchEntries: observed.dispatchEntries,
      errorMessage: observed.errorMessage,
      handlerEntries: observed.handlerEntries,
      historyPrefix: observed.history.slice(0, 2),
      reentry: observed.reentry,
      responses: observed.responses,
      stageEvents: observed.stageEvents,
    },
    marker,
  ).toEqual({
    cleanup: ["status", "batch"],
    diagnostic: {
      code: "catalog_publish_failed",
      message: "The transport rejected a catalog publication, so the session was stopped.",
    },
    dispatchEntries: 1,
    errorMessage: "The session could not publish the current catalog.",
    handlerEntries: 0,
    historyPrefix: [observed.catalogA, observed.catalogA],
    reentry: [
      "This session has stopped.",
      "This session has stopped.",
      "This session has stopped.",
    ],
    responses: 0,
    stageEvents: [],
  });
});

it("[C15] promotes a published epoch when nested context shares its catalog", async () => {
  const marker = "[RED:C15:reentrant-same-published-catalog]";
  requireFactory(marker);
  const a = { name: "a" };
  const b = { name: "b" };
  const c = { name: "c" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  const harness = controlledTransport();
  const nestedSnapshots = [];
  const stageEvents = [];
  const contexts = [];
  const signals = [];
  let dispatchEntries = 0;
  let handlerEntries = 0;
  let session;
  const concierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "a" },
      { context: b, catalog: catalogB, stage: "next" },
      { context: c, catalog: catalogB, stage: "next" },
    ],
    async (context, batch) => {
      dispatchEntries += 1;
      contexts.push(context);
      signals.push(batch.signal);
      if (!batch.signal.aborted) handlerEntries += 1;
      return Object.freeze([resultRow(batch.calls[0].callId)]);
    },
  );
  harness.setSetToolsHook((tools, occurrence) => {
    if (occurrence !== 2 || tools !== catalogB) return;
    harness.emitBatch(toolBatch(["held-b"]));
    session.setContext(c);
    nestedSnapshots.push({
      dispatchEntries,
      handlerEntries,
      history: [...harness.publications],
      responses: harness.responses.length,
      stageEvents: [...stageEvents],
    });
  });
  session = createSession({ concierge, transport: harness.transport, initialContext: a });
  session.onStageChange((stage) => {
    stageEvents.push(stage);
    if (stage === "next") harness.emitBatch(toolBatch(["stage-confirmed"]));
  });

  session.setContext(b);
  await flushMicrotasks();
  harness.emitBatch(toolBatch(["later-c"]));
  await flushMicrotasks();

  expect(
    {
      contexts,
      dispatchEntries,
      handlerEntries,
      history: harness.publications.slice(0, 2),
      nestedSnapshots,
      responses: harness.responses.map((entry) => entry.callId),
      signalStates: signals.map((signal) => signal.aborted),
      stage: session.stage(),
      stageEvents,
    },
    marker,
  ).toEqual({
    contexts: [b, c, c],
    dispatchEntries: 3,
    handlerEntries: 3,
    history: [catalogA, catalogB],
    nestedSnapshots: [{
      dispatchEntries: 0,
      handlerEntries: 0,
      history: [catalogA, catalogB],
      responses: 0,
      stageEvents: [],
    }],
    responses: ["held-b", "stage-confirmed", "later-c"],
    signalStates: [false, false, false],
    stage: "next",
    stageEvents: ["next"],
  });
  await session.stop();
});

it("[C16] republishes an older confirmed catalog after nested publication", async () => {
  const marker = "[RED:C16:reentrant-return-to-confirmed-catalog]";
  requireFactory(marker);
  const a = { name: "a" };
  const b = { name: "b" };
  const c = { name: "c" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  const harness = controlledTransport();
  const nestedSnapshots = [];
  const stageEvents = [];
  const contexts = [];
  const signals = [];
  let dispatchEntries = 0;
  let handlerEntries = 0;
  let session;
  const concierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "same" },
      { context: b, catalog: catalogB, stage: "other" },
      { context: c, catalog: catalogA, stage: "same" },
    ],
    async (context, batch) => {
      dispatchEntries += 1;
      contexts.push(context);
      signals.push(batch.signal);
      const aborted = batch.signal.aborted;
      if (!aborted) handlerEntries += 1;
      return Object.freeze([
        resultRow(
          batch.calls[0].callId,
          aborted
            ? { ok: false, reason: "aborted", message: "The action was cancelled before it ran." }
            : undefined,
        ),
      ]);
    },
  );
  harness.setSetToolsHook((tools, occurrence) => {
    if (occurrence !== 2 || tools !== catalogB) return;
    harness.emitBatch(toolBatch(["held-b"]));
    session.setContext(c);
    nestedSnapshots.push({
      dispatchEntries,
      handlerEntries,
      history: [...harness.publications],
      responses: harness.responses.length,
      stageEvents: [...stageEvents],
    });
  });
  session = createSession({ concierge, transport: harness.transport, initialContext: a });
  session.onStageChange((stage) => stageEvents.push(stage));

  session.setContext(b);
  await flushMicrotasks();
  harness.emitBatch(toolBatch(["later-c"]));
  await flushMicrotasks();

  expect(
    {
      contexts,
      dispatchEntries,
      handlerEntries,
      history: harness.publications.slice(0, 3),
      nestedSnapshots,
      responses: harness.responses.map((entry) => entry.callId),
      signalStates: signals.map((signal) => signal.aborted),
      stage: session.stage(),
      stageEvents,
    },
    marker,
  ).toEqual({
    contexts: [b, c],
    dispatchEntries: 2,
    handlerEntries: 1,
    history: [catalogA, catalogB, catalogA],
    nestedSnapshots: [{
      dispatchEntries: 0,
      handlerEntries: 0,
      history: [catalogA, catalogB],
      responses: 0,
      stageEvents: [],
    }],
    responses: ["held-b", "later-c"],
    signalStates: [true, false],
    stage: "same",
    stageEvents: [],
  });
  await session.stop();
});

it("preserves accessor and callable occurrence FIFO in one queue", async () => {
  const marker = "[REGRESSION:accessor-callable-global-fifo]";
  const a = { name: "a" };
  const b = { name: "b" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  const base = controlledTransport();
  const dispatches = [];
  const dispatchSignalsAreStable = [];
  const finalizations = [];
  const responseAttempts = [];
  let session;
  const concierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "a" },
      { context: b, catalog: catalogB, stage: "b" },
    ],
    async (context, batch) => {
      const callId = batch.calls[0].callId;
      const signal = batch.signal;
      dispatches.push({ callId, context });
      dispatchSignalsAreStable.push(signal === batch.signal);
      return Object.freeze([resultRow(callId)]);
    },
  );
  const batch = (callId) => {
    const listeners = new Set();
    const signal = Object.freeze({
      aborted: false,
      addEventListener(type, listener) {
        if (type === "abort") listeners.add(listener);
      },
      removeEventListener(type, listener) {
        if (type === "abort" && listeners.delete(listener)) {
          finalizations.push(callId);
        }
      },
    });
    return Object.freeze({ ...toolBatch([callId]), signal });
  };
  let accessorReads = 0;
  const transport = accessorTransport(
    base,
    () => {
      accessorReads += 1;
      if (accessorReads === 2) {
        base.emitBatch(batch("getter-first"));
        return (tools) => {
          base.transport.setTools(tools);
          base.emitBatch(batch("callable-second"));
        };
      }
      return (tools) => base.transport.setTools(tools);
    },
    (callId) => responseAttempts.push(callId),
  );
  session = createSession({ concierge, transport, initialContext: a });

  session.setContext(b);
  await flushMicrotasks();

  expect(
    {
      accessorReads,
      dispatchAuthoritiesAreB: dispatches.map((entry) => entry.context === b),
      dispatchOrder: dispatches.map((entry) => entry.callId),
      dispatchSignalsAreStable,
      finalizations,
      responseAttempts,
    },
    marker,
  ).toEqual({
    accessorReads: 2,
    dispatchAuthoritiesAreB: [true, true],
    dispatchOrder: ["getter-first", "callable-second"],
    dispatchSignalsAreStable: [true, true],
    finalizations: ["getter-first", "callable-second"],
    responseAttempts: ["getter-first", "callable-second"],
  });
  await session.stop();
});

it("[C17] clears a publication abandoned by setTools accessor reentry", async () => {
  const marker = "[RED:C17:abandoned-publication-cleanup]";
  requireFactory("[SMOKE:C17:create-session-factory]");

  function exercise(accessorThrows) {
    const a = { name: "a" };
    const b = { name: "b" };
    const c = { name: "c" };
    const catalogA = Object.freeze([]);
    const catalogB = Object.freeze([]);
    const base = controlledTransport();
    const dispatches = [];
    const stageEvents = [];
    let handlerEntries = 0;
    const concierge = conciergeDouble(
      [
        { context: a, catalog: catalogA, stage: "a" },
        { context: b, catalog: catalogB, stage: "b" },
        { context: c, catalog: catalogA, stage: "c" },
      ],
      async (context, batch) => {
        const callId = batch.calls[0].callId;
        const aborted = batch.signal.aborted;
        dispatches.push({ aborted, callId, context });
        if (!aborted) handlerEntries += 1;
        return Object.freeze([
          resultRow(
            callId,
            aborted
              ? {
                  ok: false,
                  reason: "aborted",
                  message: "The action was cancelled before it ran.",
                }
              : undefined,
          ),
        ]);
      },
    );
    let accessorReads = 0;
    let bSetToolsInvocations = 0;
    let session;
    const transport = accessorTransport(
      base,
      () => {
        accessorReads += 1;
        if (accessorReads === 2) {
          base.emitBatch(toolBatch(["before-c"]));
          session.setContext(c);
          base.emitBatch(toolBatch(["after-c"]));
          if (accessorThrows) throw new Error("PRIVATE-C17-STALE-GETTER");
          return () => {
            bSetToolsInvocations += 1;
          };
        }
        return (tools) => {
          base.transport.setTools(tools);
        };
      },
    );
    session = createSession({ concierge, transport, initialContext: a });
    session.onStageChange((stage) => stageEvents.push(stage));

    let errorMessage;
    try {
      session.setContext(b);
    } catch (error) {
      errorMessage = error.message;
    }
    return {
      observation: {
        accessorReads,
        bSetToolsInvocations,
        errorMessage,
        publications: [...base.publications],
        stage: session.stage(),
        stageEvents: [...stageEvents],
      },
      catalogA,
      session,
      contextC: c,
      dispatches,
      get handlerEntries() {
        return handlerEntries;
      },
      responses: base.responses,
    };
  }

  const returned = exercise(false);
  const thrown = exercise(true);
  await flushMicrotasks();

  const expectedObservation = (catalogA) => ({
    accessorReads: 2,
    bSetToolsInvocations: 0,
    errorMessage: undefined,
    publications: [catalogA],
    stage: "c",
    stageEvents: ["c"],
  });
  expect(
    {
      returned: returned.observation,
      thrown: thrown.observation,
      returnedDispatches: returned.dispatches.map((entry) => ({
        aborted: entry.aborted,
        authorityIsC: entry.context === returned.contextC,
        callId: entry.callId,
      })),
      returnedHandlerEntries: returned.handlerEntries,
      returnedResponses: returned.responses,
      thrownDispatches: thrown.dispatches.map((entry) => ({
        aborted: entry.aborted,
        authorityIsC: entry.context === thrown.contextC,
        callId: entry.callId,
      })),
      thrownHandlerEntries: thrown.handlerEntries,
      thrownResponses: thrown.responses,
    },
    marker,
  ).toEqual({
    returned: expectedObservation(returned.catalogA),
    thrown: expectedObservation(thrown.catalogA),
    returnedDispatches: [
      { aborted: true, authorityIsC: true, callId: "before-c" },
      { aborted: false, authorityIsC: true, callId: "after-c" },
    ],
    returnedHandlerEntries: 1,
    returnedResponses: [
      resultRow("before-c", {
        ok: false,
        reason: "aborted",
        message: "The action was cancelled before it ran.",
      }),
      resultRow("after-c"),
    ],
    thrownDispatches: [
      { aborted: true, authorityIsC: true, callId: "before-c" },
      { aborted: false, authorityIsC: true, callId: "after-c" },
    ],
    thrownHandlerEntries: 1,
    thrownResponses: [
      resultRow("before-c", {
        ok: false,
        reason: "aborted",
        message: "The action was cancelled before it ran.",
      }),
      resultRow("after-c"),
    ],
  });

  for (const observed of [returned, thrown]) {
    await observed.session.stop();
  }
});

it("[C18] suppresses stale resolver and capability boundaries while C progresses", async () => {
  const marker = "[RED:C18:stale-boundary-progress]";
  requireFactory("[SMOKE:C18:create-session-factory]");
  const boundaries = [
    "catalogFor-property",
    "catalogFor-call",
    "stageFor-property",
    "stageFor-call",
    "capabilities",
    "dynamicCatalog",
  ];
  const observations = [];

  for (const boundary of boundaries) {
    for (const mode of ["return", "throw"]) {
      for (const catalogMode of ["distinct", "same"]) {
        const a = { name: "a" };
        const b = { name: "b" };
        const c = { name: "c" };
        const catalogA = Object.freeze([]);
        const catalogB = Object.freeze([]);
        const catalogC =
          catalogMode === "same" ? catalogA : Object.freeze([]);
        const catalogs = new Map([
          [a, catalogA],
          [b, catalogB],
          [c, catalogC],
        ]);
        const base = controlledTransport();
        const diagnostics = [];
        const dispatches = [];
        const stageEvents = [];
        let catalogForReads = 0;
        let dynamicCatalogReads = 0;
        let handlerEntries = 0;
        let session;
        let stageForReads = 0;
        let staleCallableInvocations = 0;
        let staleContinuationEffects = 0;
        let staleStructuralReads = 0;
        let transportCapabilityReads = 0;
        const sentinel = `PRIVATE-C18-${boundary}-${mode}-${catalogMode}`;

        const supersede = (value) => {
          session.setContext(c);
          if (mode === "throw") throw new Error(sentinel);
          return value;
        };
        const catalogFor = (context) => {
          if (boundary === "catalogFor-call" && context === b) {
            return supersede(catalogB);
          }
          const catalog = catalogs.get(context);
          if (catalog === undefined) throw new Error("unknown context");
          return catalog;
        };
        const stageFor = (context) => {
          if (boundary === "catalogFor-call" && context === b) {
            staleContinuationEffects += 1;
          }
          if (boundary === "stageFor-call" && context === b) {
            return supersede("b");
          }
          return context.name;
        };
        const concierge = {
          get catalogFor() {
            catalogForReads += 1;
            if (
              boundary === "catalogFor-property" &&
              catalogForReads === 2
            ) {
              return supersede(() => {
                staleCallableInvocations += 1;
                return catalogB;
              });
            }
            return catalogFor;
          },
          get stageFor() {
            stageForReads += 1;
            if (boundary === "stageFor-property" && stageForReads === 2) {
              return supersede(() => {
                staleCallableInvocations += 1;
                return "b";
              });
            }
            return stageFor;
          },
          async dispatchBatch(context, batch) {
            const callId = batch.calls[0].callId;
            const signal = batch.signal;
            dispatches.push({
              aborted: signal.aborted,
              callId,
              context,
              stableSignal: signal === batch.signal,
            });
            if (!signal.aborted) handlerEntries += 1;
            return Object.freeze([resultRow(callId)]);
          },
          dispatch: () => Promise.resolve({ ok: false, message: "unused" }),
          explain: () => ({ stage: null, stages: [], catalog: [] }),
        };
        const liveCapabilities = Object.freeze({
          ...CONVERSATIONAL_CAPABILITIES,
          get dynamicCatalog() {
            dynamicCatalogReads += 1;
            if (boundary === "dynamicCatalog" && dynamicCatalogReads === 1) {
              return supersede(false);
            }
            return true;
          },
        });
        const staleCapabilities = Object.freeze({
          ...CONVERSATIONAL_CAPABILITIES,
          get dynamicCatalog() {
            staleStructuralReads += 1;
            return false;
          },
        });
        const transport = Object.freeze({
          get capabilities() {
            transportCapabilityReads += 1;
            if (
              boundary === "capabilities" &&
              transportCapabilityReads === 1
            ) {
              return supersede(staleCapabilities);
            }
            return liveCapabilities;
          },
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
          respond(callId, result) {
            base.transport.respond(callId, result);
          },
        });
        session = createSession({
          concierge,
          transport,
          initialContext: a,
          onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
        });
        session.onStageChange((stage) => stageEvents.push(stage));

        let errorMessage;
        try {
          session.setContext(b);
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : String(error);
        }
        await flushMicrotasks();
        const callId = `later-${boundary}-${mode}-${catalogMode}`;
        base.emitBatch(toolBatch([callId]));
        await flushMicrotasks();

        observations.push({
          boundary,
          catalogMode,
          diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
          dispatches: dispatches.map((entry) => ({
            aborted: entry.aborted,
            authorityIsC: entry.context === c,
            callId: entry.callId,
            stableSignal: entry.stableSignal,
          })),
          errorMessage,
          handlerEntries,
          mode,
          privateValueLeaked: JSON.stringify({ diagnostics, errorMessage }).includes(
            sentinel,
          ),
          publications: base.publications.map((catalog) =>
            catalog === catalogA
              ? "a"
              : catalog === catalogB
                ? "b"
                : catalog === catalogC
                  ? "c"
                  : "other",
          ),
          responseIds: base.responses.map((response) => response.callId),
          stage: session.stage(),
          stageEvents,
          staleCallableInvocations,
          staleContinuationEffects,
          staleStructuralReads,
        });
        await session.stop();
      }
    }
  }

  const expected = boundaries.flatMap((boundary) =>
    ["return", "throw"].flatMap((mode) =>
      ["distinct", "same"].map((catalogMode) => {
        const callId = `later-${boundary}-${mode}-${catalogMode}`;
        return {
          boundary,
          catalogMode,
          diagnosticCodes: [],
          dispatches: [
            {
              aborted: false,
              authorityIsC: true,
              callId,
              stableSignal: true,
            },
          ],
          errorMessage: undefined,
          handlerEntries: 1,
          mode,
          privateValueLeaked: false,
          publications:
            catalogMode === "same" ? ["a"] : ["a", "c"],
          responseIds: [callId],
          stage: "c",
          stageEvents: ["c"],
          staleCallableInvocations: 0,
          staleContinuationEffects: 0,
          staleStructuralReads: 0,
        };
      }),
    ),
  );
  expect(observations, marker).toEqual(expected);
});

it("[C19] drains queued connected replay before rethrowing a current boundary value", async () => {
  const marker = "[RED:C19:current-exception-drain-progress]";
  requireFactory("[SMOKE:C19:create-session-factory]");
  const boundaries = [
    "catalogFor-property",
    "catalogFor-call",
    "stageFor-property",
    "stageFor-call",
    "capabilities",
    "dynamicCatalog",
  ];
  const observations = [];

  for (const boundary of boundaries) {
    const a = { name: "a" };
    const b = { name: "b" };
    const catalogA = Object.freeze([]);
    const catalogB = Object.freeze([]);
    const catalogs = new Map([
      [a, catalogA],
      [b, catalogB],
    ]);
    const base = controlledTransport();
    const diagnostics = [];
    const dispatches = [];
    const events = [];
    const finalizations = [];
    const sourceCounts = { additions: 0, removals: 0 };
    const stageEvents = [];
    const secret = `PRIVATE-C19-${boundary}`;
    const sentinel = Object.freeze({ secret });
    let boundaryEntries = 0;
    let catalogForReads = 0;
    let dynamicCatalogReads = 0;
    let session;
    let stageForReads = 0;
    let transportCapabilityReads = 0;

    const queueConnectedAndThrow = () => {
      boundaryEntries += 1;
      base.emitStatus("connected");
      throw sentinel;
    };
    const catalogFor = (context) => {
      if (boundary === "catalogFor-call" && context === b) {
        queueConnectedAndThrow();
      }
      const catalog = catalogs.get(context);
      if (catalog === undefined) throw new Error("unknown context");
      return catalog;
    };
    const stageFor = (context) => {
      if (boundary === "stageFor-call" && context === b) {
        queueConnectedAndThrow();
      }
      return context.name;
    };
    const concierge = {
      get catalogFor() {
        catalogForReads += 1;
        if (boundary === "catalogFor-property" && catalogForReads === 2) {
          queueConnectedAndThrow();
        }
        return catalogFor;
      },
      get stageFor() {
        stageForReads += 1;
        if (boundary === "stageFor-property" && stageForReads === 2) {
          queueConnectedAndThrow();
        }
        return stageFor;
      },
      async dispatchBatch(context, batch) {
        const callId = batch.calls[0].callId;
        const signal = batch.signal;
        dispatches.push({
          aborted: signal.aborted,
          authorityIsA: context === a,
          callId,
          stableSignal: signal === batch.signal,
        });
        events.push(`dispatch:${callId}`);
        return Object.freeze([resultRow(callId)]);
      },
      dispatch: () => Promise.resolve({ ok: false, message: "unused" }),
      explain: () => ({ stage: null, stages: [], catalog: [] }),
    };
    const liveCapabilities = Object.freeze({
      ...CONVERSATIONAL_CAPABILITIES,
      get dynamicCatalog() {
        dynamicCatalogReads += 1;
        if (boundary === "dynamicCatalog" && dynamicCatalogReads === 1) {
          queueConnectedAndThrow();
        }
        return true;
      },
    });
    const transport = Object.freeze({
      get capabilities() {
        transportCapabilityReads += 1;
        if (boundary === "capabilities" && transportCapabilityReads === 1) {
          queueConnectedAndThrow();
        }
        return liveCapabilities;
      },
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
      respond(callId, result) {
        events.push(`respond:${callId}`);
        base.transport.respond(callId, result);
      },
    });
    session = createSession({
      concierge,
      transport,
      initialContext: a,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    session.onStageChange((stage) => stageEvents.push(stage));

    let thrownValue;
    try {
      session.setContext(b);
    } catch (failure) {
      thrownValue = failure;
    }

    const listeners = new Set();
    const signal = Object.freeze({
      aborted: false,
      addEventListener(type, listener) {
        if (type !== "abort") return;
        sourceCounts.additions += 1;
        listeners.add(listener);
      },
      removeEventListener(type, listener) {
        if (type !== "abort" || !listeners.delete(listener)) return;
        sourceCounts.removals += 1;
        finalizations.push("later");
        events.push("finalize:later");
      },
    });
    base.emitBatch(Object.freeze({ ...toolBatch(["later"]), signal }));
    await flushMicrotasks();

    observations.push({
      boundary,
      boundaryEntries,
      diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
      dispatches,
      events,
      finalizations,
      publications: base.publications.map((catalog) =>
        catalog === catalogA ? "a" : catalog === catalogB ? "b" : "other",
      ),
      responseIds: base.responses.map((response) => response.callId),
      sentinelDiagnosticLeak: JSON.stringify(diagnostics).includes(secret),
      sourceCounts,
      stage: session.stage(),
      stageEvents,
      subscribers: base.subscriberCounts(),
      thrownIdentityPreserved: thrownValue === sentinel,
    });
    await session.stop();
  }

  expect(observations, marker).toEqual(
    boundaries.map((boundary) => ({
      boundary,
      boundaryEntries: 1,
      diagnosticCodes: [],
      dispatches: [
        {
          aborted: false,
          authorityIsA: true,
          callId: "later",
          stableSignal: true,
        },
      ],
      events: ["dispatch:later", "respond:later", "finalize:later"],
      finalizations: ["later"],
      publications: ["a", "a"],
      responseIds: ["later"],
      sentinelDiagnosticLeak: false,
      sourceCounts: { additions: 1, removals: 1 },
      stage: "a",
      stageEvents: [],
      subscribers: { status: 1, batch: 1 },
      thrownIdentityPreserved: true,
    })),
  );
});

it("[C20] binds boundary-time admissions to the exact requested authority", async () => {
  const marker = "[RED:C20:post-request-admission-authority]";
  requireFactory("[SMOKE:C20:create-session-factory]");
  const boundaries = [
    "catalogFor-property",
    "catalogFor-call",
    "stageFor-property",
    "stageFor-call",
    "capabilities",
    "dynamicCatalog",
  ];

  const trackedBatch = (callId, finalizations, sourceCounts, events) => {
    const listeners = new Set();
    const counts = { additions: 0, callId, removals: 0 };
    sourceCounts.push(counts);
    const signal = Object.freeze({
      aborted: false,
      addEventListener(type, listener) {
        if (type !== "abort") return;
        counts.additions += 1;
        listeners.add(listener);
      },
      removeEventListener(type, listener) {
        if (type !== "abort" || !listeners.delete(listener)) return;
        counts.removals += 1;
        finalizations.push(callId);
        events.push(`finalize:${callId}`);
      },
    });
    return Object.freeze({ ...toolBatch([callId]), signal });
  };

  const observations = [];
  for (const boundary of boundaries) {
    for (const mode of ["return", "throw"]) {
      for (const catalogMode of ["distinct", "same"]) {
        const a = { name: "a" };
        const b = { name: "b" };
        const c = { name: "c" };
        const catalogA = Object.freeze([]);
        const catalogB = Object.freeze([]);
        const catalogC =
          catalogMode === "same" ? catalogA : Object.freeze([]);
        const catalogs = new Map([
          [a, catalogA],
          [b, catalogB],
          [c, catalogC],
        ]);
        const base = controlledTransport();
        const diagnostics = [];
        const dispatches = [];
        const events = [];
        const finalizations = [];
        const sourceCounts = [];
        const stageEvents = [];
        const secret = `PRIVATE-C20-${boundary}-${mode}-${catalogMode}`;
        const sentinel = Object.freeze({ secret });
        let boundaryEntries = 0;
        let catalogForReads = 0;
        let dynamicCatalogReads = 0;
        let handlerEntries = 0;
        let session;
        let stageForReads = 0;
        let staleCallableInvocations = 0;
        let staleContinuationEffects = 0;
        let staleStructuralReads = 0;
        let transportCapabilityReads = 0;

        const requestC = (value) => {
          boundaryEntries += 1;
          base.emitBatch(
            trackedBatch("before-c", finalizations, sourceCounts, events),
          );
          session.setContext(c);
          base.emitBatch(
            trackedBatch("after-c", finalizations, sourceCounts, events),
          );
          if (mode === "throw") throw sentinel;
          return value;
        };
        const catalogFor = (context) => {
          if (boundary === "catalogFor-call" && context === b) {
            return requestC(catalogB);
          }
          const catalog = catalogs.get(context);
          if (catalog === undefined) throw new Error("unknown context");
          return catalog;
        };
        const stageFor = (context) => {
          if (boundary === "catalogFor-call" && context === b) {
            staleContinuationEffects += 1;
          }
          if (boundary === "stageFor-call" && context === b) {
            return requestC("b");
          }
          return context.name;
        };
        const concierge = {
          get catalogFor() {
            catalogForReads += 1;
            if (
              boundary === "catalogFor-property" &&
              catalogForReads === 2
            ) {
              return requestC(() => {
                staleCallableInvocations += 1;
                return catalogB;
              });
            }
            return catalogFor;
          },
          get stageFor() {
            stageForReads += 1;
            if (boundary === "stageFor-property" && stageForReads === 2) {
              return requestC(() => {
                staleCallableInvocations += 1;
                return "b";
              });
            }
            return stageFor;
          },
          async dispatchBatch(context, batch) {
            const callId = batch.calls[0].callId;
            const signal = batch.signal;
            const aborted = signal.aborted;
            dispatches.push({
              aborted,
              authority:
                context === a ? "a" : context === c ? "c" : "other",
              callId,
              stableSignal: signal === batch.signal,
            });
            events.push(`dispatch:${callId}`);
            if (!aborted) handlerEntries += 1;
            return Object.freeze([
              resultRow(
                callId,
                aborted
                  ? {
                      ok: false,
                      reason: "aborted",
                      message: "The action was cancelled before it ran.",
                    }
                  : undefined,
              ),
            ]);
          },
          dispatch: () => Promise.resolve({ ok: false, message: "unused" }),
          explain: () => ({ stage: null, stages: [], catalog: [] }),
        };
        const liveCapabilities = Object.freeze({
          ...CONVERSATIONAL_CAPABILITIES,
          get dynamicCatalog() {
            dynamicCatalogReads += 1;
            if (boundary === "dynamicCatalog" && dynamicCatalogReads === 1) {
              return requestC(false);
            }
            return true;
          },
        });
        const staleCapabilities = Object.freeze({
          ...CONVERSATIONAL_CAPABILITIES,
          get dynamicCatalog() {
            staleStructuralReads += 1;
            return false;
          },
        });
        const transport = Object.freeze({
          get capabilities() {
            transportCapabilityReads += 1;
            if (
              boundary === "capabilities" &&
              transportCapabilityReads === 1
            ) {
              return requestC(staleCapabilities);
            }
            return liveCapabilities;
          },
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
          respond(callId, result) {
            events.push(`respond:${callId}`);
            base.transport.respond(callId, result);
          },
        });
        session = createSession({
          concierge,
          transport,
          initialContext: a,
          onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
        });
        session.onStageChange((stage) => stageEvents.push(stage));

        let callerCaught = false;
        try {
          session.setContext(b);
        } catch {
          callerCaught = true;
        }
        base.emitBatch(
          trackedBatch("later-c", finalizations, sourceCounts, events),
        );
        await flushMicrotasks();

        observations.push({
          boundary,
          boundaryEntries,
          callerCaught,
          catalogMode,
          diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
          dispatches,
          events,
          finalizations,
          handlerEntries,
          mode,
          publications: base.publications.map((catalog) =>
            catalog === catalogA
              ? "a"
              : catalog === catalogB
                ? "b"
                : catalog === catalogC
                  ? "c"
                  : "other",
          ),
          responses: base.responses.map((response) => ({
            cancelled: response.result.reason === "aborted",
            callId: response.callId,
          })),
          sentinelDiagnosticLeak: JSON.stringify(diagnostics).includes(secret),
          sourceCounts,
          stage: session.stage(),
          stageEvents,
          staleCallableInvocations,
          staleContinuationEffects,
          staleStructuralReads,
        });
        await session.stop();
      }
    }
  }

  const expectedEvents = ["before-c", "after-c", "later-c"].flatMap(
    (callId) => [
      `dispatch:${callId}`,
      `respond:${callId}`,
      `finalize:${callId}`,
    ],
  );
  const expected = boundaries.flatMap((boundary) =>
    ["return", "throw"].flatMap((mode) =>
      ["distinct", "same"].map((catalogMode) => ({
        boundary,
        boundaryEntries: 1,
        callerCaught: false,
        catalogMode,
        diagnosticCodes: [],
        dispatches: [
          {
            aborted: catalogMode === "distinct",
            authority: "a",
            callId: "before-c",
            stableSignal: true,
          },
          {
            aborted: false,
            authority: "c",
            callId: "after-c",
            stableSignal: true,
          },
          {
            aborted: false,
            authority: "c",
            callId: "later-c",
            stableSignal: true,
          },
        ],
        events: expectedEvents,
        finalizations: ["before-c", "after-c", "later-c"],
        handlerEntries: catalogMode === "distinct" ? 2 : 3,
        mode,
        publications: catalogMode === "same" ? ["a"] : ["a", "c"],
        responses: [
          { cancelled: catalogMode === "distinct", callId: "before-c" },
          { cancelled: false, callId: "after-c" },
          { cancelled: false, callId: "later-c" },
        ],
        sentinelDiagnosticLeak: false,
        sourceCounts: [
          { additions: 1, callId: "before-c", removals: 1 },
          { additions: 1, callId: "after-c", removals: 1 },
          { additions: 1, callId: "later-c", removals: 1 },
        ],
        stage: "c",
        stageEvents: ["c"],
        staleCallableInvocations: 0,
        staleContinuationEffects: 0,
        staleStructuralReads: 0,
      })),
    ),
  );
  expect(observations, marker).toEqual(expected);

  const a = { name: "a" };
  const b = { name: "b" };
  const c = { name: "c" };
  const catalogA = Object.freeze([]);
  const catalogB = Object.freeze([]);
  const catalogC = Object.freeze([]);
  const repeatedBase = controlledTransport();
  const repeatedDispatches = [];
  const repeatedEvents = [];
  const repeatedFinalizations = [];
  const repeatedSourceCounts = [];
  let repeatedSession;
  const repeatedConcierge = conciergeDouble(
    [
      { context: a, catalog: catalogA, stage: "a" },
      { context: b, catalog: catalogB, stage: "b" },
      { context: c, catalog: catalogC, stage: "c" },
    ],
    async (context, batch) => {
      const callId = batch.calls[0].callId;
      const signal = batch.signal;
      repeatedDispatches.push({
        aborted: signal.aborted,
        authority: context === c ? "c" : "other",
        callId,
        stableSignal: signal === batch.signal,
      });
      repeatedEvents.push(`dispatch:${callId}`);
      return Object.freeze([resultRow(callId)]);
    },
  );
  const repeatedCatalogFor = repeatedConcierge.catalogFor;
  const repeatedBoundaryConcierge = {
    ...repeatedConcierge,
    catalogFor(context) {
      if (context === b) {
        repeatedSession.setContext(c);
        repeatedBase.emitBatch(
          trackedBatch(
            "first-c-generation",
            repeatedFinalizations,
            repeatedSourceCounts,
            repeatedEvents,
          ),
        );
        repeatedSession.setContext(c);
      }
      return Reflect.apply(repeatedCatalogFor, repeatedConcierge, [context]);
    },
  };
  const repeatedTransport = Object.freeze({
    ...repeatedBase.transport,
    respond(callId, result) {
      repeatedEvents.push(`respond:${callId}`);
      repeatedBase.transport.respond(callId, result);
    },
  });
  repeatedSession = createSession({
    concierge: repeatedBoundaryConcierge,
    transport: repeatedTransport,
    initialContext: a,
  });
  repeatedSession.setContext(b);
  repeatedBase.emitBatch(
    trackedBatch(
      "later-c-generation",
      repeatedFinalizations,
      repeatedSourceCounts,
      repeatedEvents,
    ),
  );
  await flushMicrotasks();

  expect(
    {
      dispatches: repeatedDispatches,
      events: repeatedEvents,
      finalizations: repeatedFinalizations,
      publications: repeatedBase.publications.map((catalog) =>
        catalog === catalogA ? "a" : catalog === catalogC ? "c" : "other",
      ),
      responses: repeatedBase.responses.map((response) => response.callId),
      sourceCounts: repeatedSourceCounts,
      stage: repeatedSession.stage(),
    },
    marker,
  ).toEqual({
    dispatches: [
      {
        aborted: true,
        authority: "c",
        callId: "first-c-generation",
        stableSignal: true,
      },
      {
        aborted: false,
        authority: "c",
        callId: "later-c-generation",
        stableSignal: true,
      },
    ],
    events: [
      "dispatch:first-c-generation",
      "respond:first-c-generation",
      "finalize:first-c-generation",
      "dispatch:later-c-generation",
      "respond:later-c-generation",
      "finalize:later-c-generation",
    ],
    finalizations: ["first-c-generation", "later-c-generation"],
    publications: ["a", "c"],
    responses: ["first-c-generation", "later-c-generation"],
    sourceCounts: [
      { additions: 1, callId: "first-c-generation", removals: 1 },
      { additions: 1, callId: "later-c-generation", removals: 1 },
    ],
    stage: "c",
  });
  await repeatedSession.stop();

  for (const mode of ["return", "throw"]) {
    const stopA = { name: "a" };
    const stopB = { name: "b" };
    const stopC = { name: "c" };
    const stopCatalogA = Object.freeze([]);
    const stopCatalogB = Object.freeze([]);
    const stopCatalogC = Object.freeze([]);
    const stopBase = controlledTransport();
    const stopDispatches = [];
    const stopEvents = [];
    const stopFinalizations = [];
    const stopSourceCounts = [];
    const stopSentinel = Object.freeze({ secret: `PRIVATE-C20-STOP-${mode}` });
    let drain;
    let stopSession;
    const stopConcierge = conciergeDouble(
      [
        { context: stopA, catalog: stopCatalogA, stage: "a" },
        { context: stopB, catalog: stopCatalogB, stage: "b" },
        { context: stopC, catalog: stopCatalogC, stage: "c" },
      ],
      async (context, batch) => {
        const callId = batch.calls[0].callId;
        const signal = batch.signal;
        stopDispatches.push({
          aborted: signal.aborted,
          authorityIsC: context === stopC,
          callId,
          stableSignal: signal === batch.signal,
        });
        stopEvents.push(`dispatch:${callId}`);
        return Object.freeze([resultRow(callId)]);
      },
    );
    const stopCatalogFor = stopConcierge.catalogFor;
    const stopBoundaryConcierge = {
      ...stopConcierge,
      catalogFor(context) {
        if (context === stopB) {
          stopSession.setContext(stopC);
          stopBase.emitBatch(
            trackedBatch(
              "stop-c",
              stopFinalizations,
              stopSourceCounts,
              stopEvents,
            ),
          );
          drain = stopSession.stop();
          if (mode === "throw") throw stopSentinel;
        }
        return Reflect.apply(stopCatalogFor, stopConcierge, [context]);
      },
    };
    const stopTransport = Object.freeze({
      ...stopBase.transport,
      respond(callId, result) {
        stopEvents.push(`respond:${callId}`);
        stopBase.transport.respond(callId, result);
      },
    });
    stopSession = createSession({
      concierge: stopBoundaryConcierge,
      transport: stopTransport,
      initialContext: stopA,
    });

    let callerCaught = false;
    try {
      stopSession.setContext(stopB);
    } catch {
      callerCaught = true;
    }
    await drain;

    expect(
      {
        callerCaught,
        dispatches: stopDispatches,
        events: stopEvents,
        finalizations: stopFinalizations,
        mode,
        publicationCount: stopBase.publications.length,
        responses: stopBase.responses.length,
        sameDrain: stopSession.stop() === drain,
        sourceCounts: stopSourceCounts,
        stage: stopSession.stage(),
        subscribers: stopBase.subscriberCounts(),
      },
      marker,
    ).toEqual({
      callerCaught: false,
      dispatches: [
        {
          aborted: true,
          authorityIsC: true,
          callId: "stop-c",
          stableSignal: true,
        },
      ],
      events: ["dispatch:stop-c", "finalize:stop-c"],
      finalizations: ["stop-c"],
      mode,
      publicationCount: 2,
      responses: 0,
      sameDrain: true,
      sourceCounts: [{ additions: 1, callId: "stop-c", removals: 1 }],
      stage: "a",
      subscribers: { status: 0, batch: 0 },
    });
  }
});

it("preserves connected replay occurrence authority across getter reentry", async () => {
  const marker = "[REGRESSION:connected-replay-getter-authority]";
  const observations = [];

  for (const catalogMode of ["distinct", "same"]) {
    for (const accessorThrows of [false, true]) {
      const a = { name: "a" };
      const c = { name: "c" };
      const catalogA = Object.freeze([]);
      const catalogC =
        catalogMode === "same" ? catalogA : Object.freeze([]);
      const base = controlledTransport();
      const diagnostics = [];
      const dispatches = [];
      const stageEvents = [];
      let accessorReads = 0;
      let handlerEntries = 0;
      let staleReplayInvocations = 0;
      let session;
      const concierge = conciergeDouble(
        [
          { context: a, catalog: catalogA, stage: "a" },
          { context: c, catalog: catalogC, stage: "c" },
        ],
        async (context, batch) => {
          const callId = batch.calls[0].callId;
          const aborted = batch.signal.aborted;
          dispatches.push({ aborted, callId, context });
          if (!aborted) handlerEntries += 1;
          return Object.freeze([
            resultRow(
              callId,
              aborted
                ? {
                    ok: false,
                    reason: "aborted",
                    message: "The action was cancelled before it ran.",
                  }
                : undefined,
            ),
          ]);
        },
      );
      const transport = accessorTransport(base, () => {
        accessorReads += 1;
        if (accessorReads === 2) {
          base.emitBatch(toolBatch(["before-c"]));
          session.setContext(c);
          base.emitBatch(toolBatch(["after-c"]));
          if (accessorThrows) throw new Error("PRIVATE-STALE-REPLAY-GETTER");
          return () => {
            staleReplayInvocations += 1;
          };
        }
        return (tools) => {
          base.transport.setTools(tools);
        };
      });
      session = createSession({
        concierge,
        transport,
        initialContext: a,
        onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      });
      session.onStageChange((stage) => stageEvents.push(stage));

      let errorMessage;
      try {
        base.emitStatus("connected");
      } catch (error) {
        errorMessage = error.message;
      }
      await flushMicrotasks();

      observations.push({
        accessorReads,
        catalogMode,
        diagnostics: diagnostics.map((entry) => entry.code),
        dispatches: dispatches.map((entry) => ({
          aborted: entry.aborted,
          authority:
            entry.context === a ? "a" : entry.context === c ? "c" : "other",
          callId: entry.callId,
        })),
        errorMessage,
        handlerEntries,
        mode: accessorThrows ? "throw" : "return",
        publications: base.publications.map((catalog) =>
          catalog === catalogA ? "a" : catalog === catalogC ? "c" : "other",
        ),
        responses: base.responses.map((entry) => entry.callId),
        stage: session.stage(),
        stageEvents,
        staleReplayInvocations,
      });
      await session.stop();
    }
  }

  expect(observations, marker).toEqual([
    {
      accessorReads: 3,
      catalogMode: "distinct",
      diagnostics: [],
      dispatches: [
        { aborted: true, authority: "a", callId: "before-c" },
        { aborted: false, authority: "c", callId: "after-c" },
      ],
      errorMessage: undefined,
      handlerEntries: 1,
      mode: "return",
      publications: ["a", "c"],
      responses: ["before-c", "after-c"],
      stage: "c",
      stageEvents: ["c"],
      staleReplayInvocations: 0,
    },
    {
      accessorReads: 3,
      catalogMode: "distinct",
      diagnostics: [],
      dispatches: [
        { aborted: true, authority: "a", callId: "before-c" },
        { aborted: false, authority: "c", callId: "after-c" },
      ],
      errorMessage: undefined,
      handlerEntries: 1,
      mode: "throw",
      publications: ["a", "c"],
      responses: ["before-c", "after-c"],
      stage: "c",
      stageEvents: ["c"],
      staleReplayInvocations: 0,
    },
    {
      accessorReads: 2,
      catalogMode: "same",
      diagnostics: [],
      dispatches: [
        { aborted: false, authority: "a", callId: "before-c" },
        { aborted: false, authority: "c", callId: "after-c" },
      ],
      errorMessage: undefined,
      handlerEntries: 2,
      mode: "return",
      publications: ["a"],
      responses: ["before-c", "after-c"],
      stage: "c",
      stageEvents: ["c"],
      staleReplayInvocations: 0,
    },
    {
      accessorReads: 2,
      catalogMode: "same",
      diagnostics: [],
      dispatches: [
        { aborted: false, authority: "a", callId: "before-c" },
        { aborted: false, authority: "c", callId: "after-c" },
      ],
      errorMessage: undefined,
      handlerEntries: 2,
      mode: "throw",
      publications: ["a"],
      responses: ["before-c", "after-c"],
      stage: "c",
      stageEvents: ["c"],
      staleReplayInvocations: 0,
    },
  ]);
});

it("drains every accessor-time occurrence on direct and signal-accessor stop", async () => {
  const marker = "[REGRESSION:accessor-occurrence-stop-drain]";
  const observations = [];

  for (const publication of ["setContext", "replay"]) {
    for (const stopMode of ["direct", "signal-accessor"]) {
      const a = { name: "a" };
      const b = { name: "b" };
      const c = { name: "c" };
      const catalogA = Object.freeze([]);
      const catalogB = Object.freeze([]);
      const catalogC = Object.freeze([]);
      const base = controlledTransport();
      const dispatches = [];
      const finalizations = [];
      const signals = [];
      const sourceCounts = [];
      let accessorReads = 0;
      let drain;
      let handlerEntries = 0;
      let releaseFirst;
      let session;
      let staleInvocations = 0;
      const firstDispatchGate = new Promise((resolve) => {
        releaseFirst = resolve;
      });
      const concierge = conciergeDouble(
        [
          { context: a, catalog: catalogA, stage: "a" },
          { context: b, catalog: catalogB, stage: "b" },
          { context: c, catalog: catalogC, stage: "c" },
        ],
        async (context, batch) => {
          const callId = batch.calls[0].callId;
          const signal = batch.signal;
          dispatches.push({
            aborted: signal.aborted,
            authority:
              context === a ? "a" : context === b ? "b" : context === c ? "c" : "other",
            callId,
            stableSignal: signal === batch.signal,
          });
          signals.push(signal);
          if (!signal.aborted) handlerEntries += 1;
          if (callId === "before-c") await firstDispatchGate;
          return Object.freeze([resultRow(callId)]);
        },
      );
      const batch = (callId, stopFromSignal) => {
        const listeners = new Set();
        const counts = { additions: 0, removals: 0 };
        sourceCounts.push({ callId, counts });
        const signal = Object.freeze({
          aborted: false,
          addEventListener(type, listener) {
            if (type !== "abort") return;
            counts.additions += 1;
            listeners.add(listener);
            if (stopFromSignal) drain = session.stop();
          },
          removeEventListener(type, listener) {
            if (type !== "abort" || !listeners.delete(listener)) return;
            counts.removals += 1;
            finalizations.push(callId);
          },
        });
        return Object.freeze({ ...toolBatch([callId]), signal });
      };
      const transport = accessorTransport(base, () => {
        accessorReads += 1;
        if (accessorReads === 2) {
          base.emitBatch(batch("before-c", false));
          session.setContext(c);
          base.emitBatch(batch("after-c", stopMode === "signal-accessor"));
          if (stopMode === "direct") drain = session.stop();
          return () => {
            staleInvocations += 1;
          };
        }
        return (tools) => base.transport.setTools(tools);
      });
      session = createSession({ concierge, transport, initialContext: a });

      if (publication === "setContext") session.setContext(b);
      else base.emitStatus("connected");
      if (drain === undefined) throw new Error("accessor did not stop the session");

      let settled = false;
      void drain.then(() => {
        settled = true;
      });
      await flushMicrotasks();
      const beforeRelease = {
        dispatches: dispatches.map((entry) => entry.callId),
        finalizations: [...finalizations],
        responses: base.responses.length,
        settled,
      };
      releaseFirst();
      await drain;

      observations.push({
        accessorReads,
        beforeRelease,
        dispatches,
        finalizations,
        handlerEntries,
        publication,
        responses: base.responses.length,
        sameDrain: session.stop() === drain,
        signalsDistinctByOccurrence: new Set(signals).size === 2,
        sourceCounts: sourceCounts.map((entry) => ({
          additions: entry.counts.additions,
          callId: entry.callId,
          removals: entry.counts.removals,
        })),
        staleInvocations,
        stopMode,
      });
    }
  }

  const expected = (publication, stopMode, beforeAuthority) => ({
    accessorReads: 3,
    beforeRelease: {
      dispatches: ["before-c"],
      finalizations: [],
      responses: 0,
      settled: false,
    },
    dispatches: [
      {
        aborted: true,
        authority: beforeAuthority,
        callId: "before-c",
        stableSignal: true,
      },
      {
        aborted: true,
        authority: "c",
        callId: "after-c",
        stableSignal: true,
      },
    ],
    finalizations: ["before-c", "after-c"],
    handlerEntries: 0,
    publication,
    responses: 0,
    sameDrain: true,
    signalsDistinctByOccurrence: true,
    sourceCounts: [
      { additions: 1, callId: "before-c", removals: 1 },
      { additions: 1, callId: "after-c", removals: 1 },
    ],
    staleInvocations: 0,
    stopMode,
  });
  expect(observations, marker).toEqual([
    expected("setContext", "direct", "b"),
    expected("setContext", "signal-accessor", "b"),
    expected("replay", "direct", "a"),
    expected("replay", "signal-accessor", "a"),
  ]);
});

it("preserves current and stopped setTools getter failure semantics", async () => {
  const marker = "[REGRESSION:settools-getter-failure-semantics]";
  const observations = [];

  for (const mode of ["starting", "active", "stopped"]) {
    const sentinel = `PRIVATE-SETTOOLS-GETTER-${mode}`;
    const a = { name: "a" };
    const b = { name: "b" };
    const catalogA = Object.freeze([]);
    const catalogB = Object.freeze([]);
    const base = controlledTransport();
    const diagnostics = [];
    let accessorReads = 0;
    let drain;
    let session;
    const concierge = conciergeDouble(
      [
        { context: a, catalog: catalogA, stage: "a" },
        { context: b, catalog: catalogB, stage: "b" },
      ],
      async () => Object.freeze([]),
    );
    const transport = accessorTransport(base, () => {
      accessorReads += 1;
      if (mode === "starting" && accessorReads === 1) {
        throw new Error(sentinel);
      }
      if (accessorReads === 2 && mode === "active") {
        throw new Error(sentinel);
      }
      if (accessorReads === 2 && mode === "stopped") {
        drain = session.stop();
        throw new Error(sentinel);
      }
      return (tools) => {
        base.transport.setTools(tools);
      };
    });

    let errorMessage;
    try {
      session = createSession({
        concierge,
        transport,
        initialContext: a,
        onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      });
      session.setContext(b);
    } catch (error) {
      errorMessage = error.message;
    }
    if (drain !== undefined) await drain;
    if (session !== undefined) await session.stop();
    await flushMicrotasks();

    observations.push({
      accessorReads,
      catalogBPublished: base.publications.includes(catalogB),
      diagnosticCodes: diagnostics.map((diagnostic) => diagnostic.code),
      errorMessage,
      finalCatalogFrozen: Object.isFrozen(base.publications.at(-1)),
      finalCatalogSize: base.publications.at(-1)?.length,
      firstCatalogIsA: base.publications[0] === catalogA,
      historyLength: base.publications.length,
      mode,
      stage: session?.stage(),
      subscribers: base.subscriberCounts(),
    });
    expect(JSON.stringify({ diagnostics, errorMessage })).not.toContain(sentinel);
  }

  expect(observations, marker).toEqual([
    {
      accessorReads: 2,
      catalogBPublished: false,
      diagnosticCodes: ["catalog_publish_failed"],
      errorMessage: "The session could not start.",
      finalCatalogFrozen: true,
      finalCatalogSize: 0,
      firstCatalogIsA: false,
      historyLength: 1,
      mode: "starting",
      stage: undefined,
      subscribers: { status: 0, batch: 0 },
    },
    {
      accessorReads: 3,
      catalogBPublished: false,
      diagnosticCodes: ["catalog_publish_failed"],
      errorMessage: "The session could not publish the current catalog.",
      finalCatalogFrozen: true,
      finalCatalogSize: 0,
      firstCatalogIsA: true,
      historyLength: 2,
      mode: "active",
      stage: "b",
      subscribers: { status: 0, batch: 0 },
    },
    {
      accessorReads: 3,
      catalogBPublished: false,
      diagnosticCodes: [],
      errorMessage: undefined,
      finalCatalogFrozen: true,
      finalCatalogSize: 0,
      firstCatalogIsA: true,
      historyLength: 2,
      mode: "stopped",
      stage: "a",
      subscribers: { status: 0, batch: 0 },
    },
  ]);
});
