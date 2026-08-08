import { expect, it } from "vitest";

import {
  COMMAND_PALETTE_CAPABILITIES,
  CONVERSATIONAL_CAPABILITIES,
  createStubTransport,
} from "./fixtures/stub-transport.js";

function batch(responseId) {
  return Object.freeze({ responseId, calls: Object.freeze([]) });
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
