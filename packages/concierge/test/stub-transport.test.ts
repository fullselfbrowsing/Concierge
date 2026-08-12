import { readFileSync, readdirSync } from "node:fs";

import { expect, it as vitestIt } from "vitest";

import {
  COMMAND_PALETTE_CAPABILITIES,
  CONVERSATIONAL_CAPABILITIES,
  createStubTransport,
} from "./fixtures/stub-transport.js";

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

function batch(responseId) {
  return Object.freeze({ responseId, calls: Object.freeze([]) });
}

function emittedTool(name) {
  return Object.freeze({
    type: "function",
    name,
    description: `${name} fixture`,
    parameters: Object.freeze({ type: "object" }),
  });
}

function readSourceTree(directory) {
  let source = "";
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) source += readSourceTree(child);
    else if (entry.name.endsWith(".ts")) source += readFileSync(child, "utf8");
  }
  return source;
}

it("[U01] exposes exact deeply frozen capability profiles and a frozen six-key transport", () => {
  expect(
    CONVERSATIONAL_CAPABILITIES,
    "[RED:U01:stub-profiles]",
  ).toEqual({
    consentGrade: "relayed",
    userTurnIdentity: "agent-forgeable",
    parallelCalls: true,
    dynamicCatalog: true,
  });
  expect(COMMAND_PALETTE_CAPABILITIES).toEqual({
    consentGrade: "attested",
    userTurnIdentity: "human-attested",
    parallelCalls: false,
    dynamicCatalog: false,
  });

  expect(Object.isFrozen(CONVERSATIONAL_CAPABILITIES)).toBe(true);
  expect(Object.isFrozen(COMMAND_PALETTE_CAPABILITIES)).toBe(true);

  const stub = createStubTransport({
    capabilities: CONVERSATIONAL_CAPABILITIES,
    initialStatus: "idle",
  });

  expect(Object.keys(stub.transport)).toEqual([
    "capabilities",
    "status",
    "setTools",
    "onStatusChange",
    "onToolBatch",
    "respond",
  ]);
  expect("emitStatus" in stub.transport).toBe(false);
  expect("emitBatch" in stub.transport).toBe(false);
  expect("catalogHistory" in stub.transport).toBe(false);
  expect("responseHistory" in stub.transport).toBe(false);

  expect(Object.isFrozen(stub)).toBe(true);
  expect(Object.isFrozen(stub.transport)).toBe(true);
  expect(Object.isFrozen(stub.transport.capabilities)).toBe(true);
  expect(Object.isFrozen(stub.catalogHistory())).toBe(true);
  expect(Object.isFrozen(stub.responseHistory())).toBe(true);
  expect(Object.isFrozen(stub.subscriberCounts())).toBe(true);

  expect(() => {
    CONVERSATIONAL_CAPABILITIES.dynamicCatalog = false;
  }).toThrow(TypeError);
  expect(() => {
    stub.transport.status = "closed";
  }).toThrow(TypeError);
  expect(() => {
    stub.emitStatus = () => {};
  }).toThrow(TypeError);

  expect(CONVERSATIONAL_CAPABILITIES.dynamicCatalog).toBe(true);
  expect(stub.transport.status).toBe("idle");
});

it("[U02] updates status before synchronously delivering one subscriber snapshot per real transition", () => {
  const stub = createStubTransport({
    capabilities: CONVERSATIONAL_CAPABILITIES,
    initialStatus: "idle",
  });
  const events = [];
  let unsubscribeSecond = () => {};

  stub.transport.onStatusChange((status) => {
    events.push(`first:${status}:${stub.transport.status}`);
    unsubscribeSecond();
    stub.transport.onStatusChange((nestedStatus) => {
      events.push(`late:${nestedStatus}:${stub.transport.status}`);
    });
  });
  unsubscribeSecond = stub.transport.onStatusChange((status) => {
    events.push(`second:${status}:${stub.transport.status}`);
  });

  stub.emitStatus("connected");
  expect(events, "[RED:U02:status-transitions]").toEqual([
    "first:connected:connected",
    "second:connected:connected",
  ]);

  stub.emitStatus("connected");
  expect(events).toHaveLength(2);

  stub.emitStatus("closed");
  expect(events).toEqual([
    "first:connected:connected",
    "second:connected:connected",
    "first:closed:closed",
    "late:closed:closed",
  ]);
});

it("[U03] synchronously delivers each batch to the subscriber snapshot captured at arrival", () => {
  const stub = createStubTransport({
    capabilities: COMMAND_PALETTE_CAPABILITIES,
    initialStatus: "connected",
  });
  const firstBatch = batch("first-batch");
  const secondBatch = batch("second-batch");
  const events = [];
  let unsubscribeSecond = () => {};

  stub.transport.onToolBatch((received) => {
    events.push(["first", received]);
    unsubscribeSecond();
    stub.transport.onToolBatch((lateBatch) => {
      events.push(["late", lateBatch]);
    });
  });
  unsubscribeSecond = stub.transport.onToolBatch((received) => {
    events.push(["second", received]);
  });

  stub.emitBatch(firstBatch);
  expect(events, "[RED:U03:batch-snapshot]").toHaveLength(2);
  expect(events[0]).toEqual(["first", firstBatch]);
  expect(events[0][1]).toBe(firstBatch);
  expect(events[1]).toEqual(["second", firstBatch]);
  expect(events[1][1]).toBe(firstBatch);

  stub.emitBatch(secondBatch);
  expect(events).toHaveLength(4);
  expect(events[2]).toEqual(["first", secondBatch]);
  expect(events[3]).toEqual(["late", secondBatch]);
});

it("[U04] reports immutable subscriber-count snapshots with identity-safe unsubscription", () => {
  const stub = createStubTransport({
    capabilities: CONVERSATIONAL_CAPABILITIES,
    initialStatus: "connecting",
  });
  const sameStatusCallback = () => {};
  const sameBatchCallback = () => {};

  const empty = stub.subscriberCounts();
  const unsubscribeStatusOne = stub.transport.onStatusChange(sameStatusCallback);
  const unsubscribeStatusTwo = stub.transport.onStatusChange(sameStatusCallback);
  const unsubscribeBatch = stub.transport.onToolBatch(sameBatchCallback);
  const populated = stub.subscriberCounts();

  expect(empty, "[RED:U04:subscriber-counts]").toEqual({
    status: 0,
    batch: 0,
  });
  expect(populated).toEqual({ status: 2, batch: 1 });
  expect(populated).not.toBe(stub.subscriberCounts());
  expect(Object.isFrozen(empty)).toBe(true);
  expect(Object.isFrozen(populated)).toBe(true);

  expect(() => {
    populated.status = 99;
  }).toThrow(TypeError);

  unsubscribeStatusOne();
  unsubscribeStatusOne();
  expect(stub.subscriberCounts()).toEqual({ status: 1, batch: 1 });

  unsubscribeStatusTwo();
  unsubscribeBatch();
  expect(stub.subscriberCounts()).toEqual({ status: 0, batch: 0 });
});

it("[U05] records each setTools and respond attempt before deterministic occurrence failures", () => {
  const setToolsAt = [1, 3];
  const respondAt = [2];
  const failures = { setToolsAt, respondAt };
  const stub = createStubTransport({
    capabilities: CONVERSATIONAL_CAPABILITIES,
    initialStatus: "connected",
    failures,
  });
  const catalogs = [
    Object.freeze([emittedTool("one")]),
    Object.freeze([emittedTool("two")]),
    Object.freeze([emittedTool("three")]),
    Object.freeze([emittedTool("four")]),
  ];
  const results = [
    Object.freeze({ ok: true, message: "Result one." }),
    Object.freeze({ ok: false, reason: "unavailable", message: "Result two." }),
    Object.freeze({ ok: true, message: "Result three." }),
  ];

  setToolsAt.push(2);
  respondAt.length = 0;
  failures.subscribeStatus = true;

  expect(
    () => stub.transport.setTools(catalogs[0]),
    "[RED:U05:attempt-before-throw]",
  ).toThrowError("Stub transport injected setTools failure.");
  expect(() => stub.transport.setTools(catalogs[1])).not.toThrow();
  expect(() => stub.transport.setTools(catalogs[2])).toThrowError(
    "Stub transport injected setTools failure.",
  );
  expect(() => stub.transport.setTools(catalogs[3])).not.toThrow();

  expect(() => stub.transport.respond("call-one", results[0])).not.toThrow();
  expect(() => stub.transport.respond("call-two", results[1])).toThrowError(
    "Stub transport injected respond failure.",
  );
  expect(() => stub.transport.respond("call-three", results[2])).not.toThrow();

  const catalogHistory = stub.catalogHistory();
  expect(catalogHistory).toHaveLength(4);
  for (const [index, catalog] of catalogs.entries()) {
    expect(catalogHistory[index]).toBe(catalog);
  }
  expect(stub.responseHistory()).toEqual([
    { callId: "call-one", result: results[0] },
    { callId: "call-two", result: results[1] },
    { callId: "call-three", result: results[2] },
  ]);
});

it("[U06] injects each subscription failure independently without corrupting the other set", () => {
  const statusSubscribeFailure = createStubTransport({
    capabilities: CONVERSATIONAL_CAPABILITIES,
    failures: { subscribeStatus: true },
  });
  expect(
    () => statusSubscribeFailure.transport.onStatusChange(() => {}),
    "[RED:U06:subscription-failures]",
  ).toThrowError("Stub transport injected status subscription failure.");
  const removeUnaffectedBatch = statusSubscribeFailure.transport.onToolBatch(() => {});
  expect(statusSubscribeFailure.subscriberCounts()).toEqual({ status: 0, batch: 1 });
  removeUnaffectedBatch();

  const batchSubscribeFailure = createStubTransport({
    capabilities: CONVERSATIONAL_CAPABILITIES,
    failures: { subscribeBatch: true },
  });
  const removeUnaffectedStatus = batchSubscribeFailure.transport.onStatusChange(() => {});
  expect(() => batchSubscribeFailure.transport.onToolBatch(() => {})).toThrowError(
    "Stub transport injected batch subscription failure.",
  );
  expect(batchSubscribeFailure.subscriberCounts()).toEqual({ status: 1, batch: 0 });
  removeUnaffectedStatus();

  let retainedStatusCalls = 0;
  const statusUnsubscribeFailure = createStubTransport({
    capabilities: CONVERSATIONAL_CAPABILITIES,
    failures: { unsubscribeStatus: true },
  });
  const failingStatusRemoval = statusUnsubscribeFailure.transport.onStatusChange(() => {
    retainedStatusCalls += 1;
  });
  const workingBatchRemoval = statusUnsubscribeFailure.transport.onToolBatch(() => {});
  expect(failingStatusRemoval).toThrowError(
    "Stub transport injected status unsubscription failure.",
  );
  expect(statusUnsubscribeFailure.subscriberCounts()).toEqual({ status: 1, batch: 1 });
  workingBatchRemoval();
  statusUnsubscribeFailure.emitStatus("connected");
  expect(retainedStatusCalls).toBe(1);
  expect(statusUnsubscribeFailure.subscriberCounts()).toEqual({ status: 1, batch: 0 });

  let retainedBatchCalls = 0;
  const batchUnsubscribeFailure = createStubTransport({
    capabilities: CONVERSATIONAL_CAPABILITIES,
    failures: { unsubscribeBatch: true },
  });
  const workingStatusRemoval = batchUnsubscribeFailure.transport.onStatusChange(() => {});
  const failingBatchRemoval = batchUnsubscribeFailure.transport.onToolBatch(() => {
    retainedBatchCalls += 1;
  });
  expect(failingBatchRemoval).toThrowError(
    "Stub transport injected batch unsubscription failure.",
  );
  expect(batchUnsubscribeFailure.subscriberCounts()).toEqual({ status: 1, batch: 1 });
  workingStatusRemoval();
  batchUnsubscribeFailure.emitBatch(batch("retained-batch"));
  expect(retainedBatchCalls).toBe(1);
  expect(batchUnsubscribeFailure.subscriberCounts()).toEqual({ status: 0, batch: 1 });
});

it("[U07] returns immutable history snapshots and rows while retaining catalog identity", () => {
  const stub = createStubTransport({
    capabilities: CONVERSATIONAL_CAPABILITIES,
    initialStatus: "connected",
  });
  const catalog = Object.freeze([emittedTool("identity")]);
  const result = Object.freeze({ ok: true, message: "Recorded once." });

  stub.transport.setTools(catalog);
  stub.transport.respond("immutable-call", result);

  const catalogs = stub.catalogHistory();
  const responses = stub.responseHistory();
  expect(catalogs, "[RED:U07:immutable-histories]").toHaveLength(1);
  expect(catalogs[0]).toBe(catalog);
  expect(Object.isFrozen(catalogs)).toBe(true);
  expect(() => catalogs.push(Object.freeze([]))).toThrow(TypeError);
  expect(() => {
    catalogs[0] = Object.freeze([]);
  }).toThrow(TypeError);

  expect(responses).toHaveLength(1);
  expect(responses[0]).toEqual({ callId: "immutable-call", result });
  expect(responses[0].result).toBe(result);
  expect(Object.isFrozen(responses)).toBe(true);
  expect(Object.isFrozen(responses[0])).toBe(true);
  expect(() => {
    responses[0].callId = "rewritten";
  }).toThrow(TypeError);
  expect(() => responses.pop()).toThrow(TypeError);

  const removeStatus = stub.transport.onStatusChange(() => {});
  const counts = stub.subscriberCounts();
  expect(() => {
    counts.status = 0;
  }).toThrow(TypeError);
  removeStatus();
  expect(counts).toEqual({ status: 1, batch: 0 });
  expect(stub.subscriberCounts()).toEqual({ status: 0, batch: 0 });
});

it("[U08] keeps the no-I/O fixture outside production source and package exports", () => {
  const fixtureSource = readFileSync(
    new URL("./fixtures/stub-transport.ts", import.meta.url),
    "utf8",
  );
  const productionSource = readSourceTree(new URL("../src/", import.meta.url));
  const packageSource = readFileSync(new URL("../package.json", import.meta.url), "utf8");

  expect(
    productionSource,
    "[RED:U08:test-only-boundary]",
  ).not.toContain("createStubTransport");
  expect(productionSource).not.toContain("stub-transport");
  expect(packageSource).not.toContain("createStubTransport");
  expect(packageSource).not.toContain("stub-transport");
  expect(JSON.parse(packageSource).files).not.toContain("test");

  const forbiddenTokens = [
    ["set", "Timeout"].join(""),
    ["set", "Interval"].join(""),
    ["Web", "Socket"].join(""),
    ["RTC", "PeerConnection"].join(""),
    ["Open", "AI"].join(""),
    ["Anth", "ropic"].join(""),
    ["Real", "time"].join(""),
    ["navig", "ator"].join(""),
    ["docu", "ment"].join(""),
    ["win", "dow"].join(""),
  ];
  for (const token of forbiddenTokens) expect(fixtureSource).not.toContain(token);
  expect(fixtureSource).not.toMatch(new RegExp("fetch\\s*\\("));
});

it("[T-08-02/T-08-06] keeps delivery lifecycle controls beside the exact six-key transport", () => {
  const stub = createStubTransport({
    capabilities: COMMAND_PALETTE_CAPABILITIES,
    initialStatus: "connected",
  });
  const observedReports = [];
  const firstReport = {
    responseId: "review-response",
    outcome: "completed",
    readbackHash: "a".repeat(64),
    attestation: {
      act: "confirmed",
      userTurnId: "human-turn-two",
      readbackHash: "a".repeat(64),
    },
  };

  stub.deferUntilDelivered((report) => {
    observedReports.push(report);
  });
  expect(stub.deliveryCallbackCount()).toBe(1);

  stub.emitDelivery(0, firstReport);
  firstReport.outcome = "interrupted";
  firstReport.attestation.act = "declined";
  stub.emitDelivery(0, {
    responseId: "review-response",
    outcome: "interrupted",
  });

  expect(Object.keys(stub.transport)).toEqual([
    "capabilities",
    "status",
    "setTools",
    "onStatusChange",
    "onToolBatch",
    "respond",
  ]);
  expect(Object.keys(stub).sort()).toEqual([
    "catalogHistory",
    "deferUntilDelivered",
    "deliveryCallbackCount",
    "deliveryHistory",
    "emitBatch",
    "emitDelivery",
    "emitStatus",
    "eventHistory",
    "outcomeHistory",
    "presentOutcome",
    "responseHistory",
    "subscriberCounts",
    "successfulOutcomeHistory",
    "successfulResponseHistory",
    "transport",
  ]);
  expect("deferUntilDelivered" in stub.transport).toBe(false);
  expect("emitDelivery" in stub.transport).toBe(false);
  expect("presentOutcome" in stub.transport).toBe(false);
  expect(observedReports).toHaveLength(2);
  expect(observedReports[0]).toBe(firstReport);

  const deliveries = stub.deliveryHistory();
  expect(deliveries).toEqual([
    {
      sequence: 1,
      deliveryIndex: 0,
      report: {
        responseId: "review-response",
        outcome: "completed",
        readbackHash: "a".repeat(64),
        attestation: {
          act: "confirmed",
          userTurnId: "human-turn-two",
          readbackHash: "a".repeat(64),
        },
      },
    },
    {
      sequence: 2,
      deliveryIndex: 0,
      report: {
        responseId: "review-response",
        outcome: "interrupted",
      },
    },
  ]);
  expect(Object.isFrozen(deliveries)).toBe(true);
  expect(Object.isFrozen(deliveries[0])).toBe(true);
  expect(Object.isFrozen(deliveries[0].report)).toBe(true);
  expect(Object.isFrozen(deliveries[0].report.attestation)).toBe(true);
  expect(() => deliveries.push({})).toThrow(TypeError);
  expect(() => {
    deliveries[0].report.attestation.act = "dismissed";
  }).toThrow(TypeError);
});

it("[T-08-08/T-08-10] records outcome and response attempts before sync and async failures", async () => {
  const stub = createStubTransport({
    capabilities: CONVERSATIONAL_CAPABILITIES,
    outcomeBehaviors: ["completed", "interrupted", "throw", "reject"],
    failures: {
      respondAt: [2],
      respondRejectAt: [3],
    },
  });
  const outcomes = [
    {
      failures: [{ callId: "failure-one", reason: "declined", message: "No." }],
    },
    {
      failures: [{ callId: "failure-two", reason: "cancelled", message: "Later." }],
    },
    {
      failures: [{ callId: "failure-three", reason: "aborted", message: "Stopped." }],
    },
    {
      failures: [{ callId: "failure-four", reason: undefined, message: "Failed." }],
    },
  ];
  const results = [
    { ok: true, message: "Response one." },
    { ok: false, reason: "declined", message: "Response two." },
    { ok: false, reason: "cancelled", message: "Response three." },
  ];

  await expect(stub.presentOutcome(outcomes[0])).resolves.toEqual({
    outcome: "completed",
  });
  stub.transport.respond("response-one", results[0]);
  await expect(stub.presentOutcome(outcomes[1])).resolves.toEqual({
    outcome: "interrupted",
  });
  expect(() => stub.transport.respond("response-two", results[1])).toThrowError(
    "Stub transport injected respond failure.",
  );
  expect(() => stub.presentOutcome(outcomes[2])).toThrowError(
    "Stub transport injected outcome failure.",
  );
  await expect(stub.transport.respond("response-three", results[2])).rejects.toThrowError(
    "Stub transport injected respond rejection.",
  );
  await expect(stub.presentOutcome(outcomes[3])).rejects.toThrowError(
    "Stub transport injected outcome rejection.",
  );

  outcomes[0].failures[0].message = "MUTATED OUTCOME";
  results[0].message = "MUTATED RESPONSE";

  expect(stub.outcomeHistory().map(({ behavior, sequence }) => ({ behavior, sequence }))).toEqual([
    { behavior: "completed", sequence: 1 },
    { behavior: "interrupted", sequence: 3 },
    { behavior: "throw", sequence: 5 },
    { behavior: "reject", sequence: 7 },
  ]);
  const responses = stub.responseHistory();
  expect(responses).toEqual([
    { callId: "response-one", result: { ok: true, message: "Response one." } },
    {
      callId: "response-two",
      result: { ok: false, reason: "declined", message: "Response two." },
    },
    {
      callId: "response-three",
      result: { ok: false, reason: "cancelled", message: "Response three." },
    },
  ]);
  expect(stub.successfulOutcomeHistory()).toEqual([
    {
      failures: [{ callId: "failure-one", reason: "declined", message: "No." }],
    },
  ]);
  const successfulResponses = stub.successfulResponseHistory();
  expect(successfulResponses).toEqual([
    { callId: "response-one", result: { ok: true, message: "Response one." } },
  ]);
  expect(responses[0].result).not.toBe(results[0]);
  expect(successfulResponses[0].result).not.toBe(results[0]);
  expect(Object.isFrozen(responses)).toBe(true);
  expect(responses.every((response) => Object.isFrozen(response))).toBe(true);
  expect(responses.every(({ result }) => Object.isFrozen(result))).toBe(true);
  expect(Object.isFrozen(successfulResponses)).toBe(true);
  expect(successfulResponses.every((response) => Object.isFrozen(response))).toBe(true);
  expect(successfulResponses.every(({ result }) => Object.isFrozen(result))).toBe(true);
  expect(() => responses.push({})).toThrow(TypeError);
  expect(() => {
    responses[0].result.message = "REWRITTEN HISTORY";
  }).toThrow(TypeError);
  expect(() => {
    successfulResponses[0].callId = "rewritten-call";
  }).toThrow(TypeError);

  const events = stub.eventHistory();
  expect(events.map(({ sequence, type, behavior }) => ({
    sequence,
    type,
    ...(behavior === undefined ? {} : { behavior }),
  }))).toEqual([
    { sequence: 1, type: "outcome", behavior: "completed" },
    { sequence: 2, type: "response", behavior: "completed" },
    { sequence: 3, type: "outcome", behavior: "interrupted" },
    { sequence: 4, type: "response", behavior: "throw" },
    { sequence: 5, type: "outcome", behavior: "throw" },
    { sequence: 6, type: "response", behavior: "reject" },
    { sequence: 7, type: "outcome", behavior: "reject" },
  ]);
  expect(events[0].outcome.failures[0].message).toBe("No.");
  expect(events[1].result.message).toBe("Response one.");
  expect(Object.isFrozen(events)).toBe(true);
  expect(events.every((event) => Object.isFrozen(event))).toBe(true);
  expect(Object.isFrozen(events[0].outcome)).toBe(true);
  expect(Object.isFrozen(events[0].outcome.failures)).toBe(true);
  expect(Object.isFrozen(events[0].outcome.failures[0])).toBe(true);
  expect(Object.isFrozen(events[1].result)).toBe(true);
  expect(() => {
    events[0].sequence = 99;
  }).toThrow(TypeError);
});
