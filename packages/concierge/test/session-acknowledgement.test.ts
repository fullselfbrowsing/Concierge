import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it } from "vitest";

import { action, conciergeFor, transportHarness } from "./fixtures/v2-session.js";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const CONTRACT_KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const ACTIVE = Object.freeze({ page: "active" });

let createConcierge;
let createSession;

beforeAll(async () => {
  if (!existsSync(fileURLToPath(DIST_URL))) {
    throw new Error("Build concierge before testing.");
  }
  ({ createConcierge, createSession } = await import(DIST_URL.href));
});

beforeEach(() => {
  delete globalThis[CONTRACT_KEY];
});

it("throws at construction when a v3 transport omits acknowledgesCatalog", () => {
  const concierge = conciergeFor(createConcierge, [
    action("run", () => ({ ok: true, message: "Done." })),
  ]);
  const harness = transportHarness();
  const capabilities = {
    consentGrade: "none",
    userTurnIdentity: "none",
    parallelCalls: true,
    dynamicCatalog: true,
  };
  Object.defineProperty(harness.transport, "capabilities", {
    value: capabilities,
    enumerable: true,
  });

  expect(() =>
    createSession({
      concierge,
      transport: harness.transport,
      presentOutcome: async () => ({ outcome: "completed" }),
    }),
  ).toThrow("The session could not start.");
});

it("throws when acknowledgesCatalog is true without onCatalogAcknowledged", () => {
  const concierge = conciergeFor(createConcierge, [
    action("run", () => ({ ok: true, message: "Done." })),
  ]);
  const harness = transportHarness({
    capabilities: { acknowledgesCatalog: true },
  });
  delete harness.transport.onCatalogAcknowledged;

  expect(() =>
    createSession({
      concierge,
      transport: harness.transport,
      presentOutcome: async () => ({ outcome: "completed" }),
    }),
  ).toThrow("The session could not start.");
});

it("defers catalog promotion until the transport acknowledges the revision", async () => {
  const concierge = conciergeFor(createConcierge, [
    action("run", () => ({ ok: true, message: "Done." })),
  ]);
  const harness = transportHarness({
    capabilities: { acknowledgesCatalog: true },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
  });

  expect(session.catalog()).toBeNull();
  expect(harness.publications).toHaveLength(1);
  const published = harness.publications[0];
  harness.acknowledge({ revision: published.revision, accepted: true });
  expect(session.catalog()).toBe(published);
  await session.stop();
});

it("keeps the last acknowledged catalog when a later publication is rejected", async () => {
  const diagnostics = [];
  let enabled = true;
  const concierge = conciergeFor(createConcierge, [
    action("conditional", () => ({ ok: true, message: "Done." }), {
      availableWhen: () => enabled,
    }),
  ]);
  const harness = transportHarness({
    capabilities: { acknowledgesCatalog: true },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  const first = harness.publications[0];
  harness.acknowledge({ revision: first.revision, accepted: true });
  expect(session.catalog()).toBe(first);

  enabled = false;
  session.setContext(ACTIVE);
  expect(session.catalog()).toBe(first);
  const second = harness.publications[1];
  harness.acknowledge({ revision: second.revision, accepted: false });
  expect(session.catalog()).toBe(first);
  expect(diagnostics.map((row) => row.code)).toContain(
    "catalog_acknowledgement_failed",
  );
  await session.stop();
});

it("ignores an acknowledgement for a revision that was never published", async () => {
  const diagnostics = [];
  const concierge = conciergeFor(createConcierge, [
    action("run", () => ({ ok: true, message: "Done." })),
  ]);
  const harness = transportHarness({
    capabilities: { acknowledgesCatalog: true },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  harness.acknowledge({
    revision: Symbol("never-published"),
    accepted: true,
  });
  expect(session.catalog()).toBeNull();
  expect(diagnostics.map((row) => row.code)).toContain(
    "catalog_acknowledgement_failed",
  );
  await session.stop();
});

it("ignores acknowledgements after stop and a second ack for one publication", async () => {
  const diagnostics = [];
  const concierge = conciergeFor(createConcierge, [
    action("run", () => ({ ok: true, message: "Done." })),
  ]);
  const harness = transportHarness({
    capabilities: { acknowledgesCatalog: true },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  const published = harness.publications[0];
  harness.acknowledge({ revision: published.revision, accepted: true });
  expect(session.catalog()).toBe(published);
  harness.acknowledge({ revision: published.revision, accepted: true });
  expect(session.catalog()).toBe(published);
  await session.stop();
  harness.acknowledge({ revision: published.revision, accepted: true });
  expect(diagnostics).toEqual([]);
  expect(harness.ackUnsubscribes).toBe(1);
});

it("subscribes through a method that reads its receiver", async () => {
  const concierge = conciergeFor(createConcierge, [
    action("run", () => ({ ok: true, message: "Done." })),
  ]);
  const harness = transportHarness({
    capabilities: { acknowledgesCatalog: true },
  });

  // Core reads `onCatalogAcknowledged` off the transport before calling it,
  // so the call has to put the receiver back. A transport whose subscriber is
  // a method touching `this` — the shape `test/fixtures/v2-session.js` and
  // `concierge-realtime` both use — must work exactly as `onStatusChange` and
  // `onToolBatch` do.
  let receiver;
  Object.defineProperty(harness.transport, "onCatalogAcknowledged", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: function onCatalogAcknowledged(handler) {
      receiver = this;
      if (this === undefined) throw new TypeError("called without a receiver");
      return this.__subscribeAck(handler);
    },
  });
  Object.defineProperty(harness.transport, "__subscribeAck", {
    configurable: true,
    enumerable: false,
    value: (handler) => harness.subscribeAck(handler),
  });

  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
  });

  expect(receiver).toBe(harness.transport);
  const published = harness.publications[0];
  harness.acknowledge({ revision: published.revision, accepted: true });
  expect(session.catalog()).toBe(published);
  await session.stop();
});

it("republishes the unacknowledged revision when the transport reconnects", async () => {
  // `currentCatalog` is null until the first acknowledgement lands, so a gap
  // that swallows the first publication used to leave nothing to re-send —
  // and the session stayed catalogless for the rest of its life.
  const concierge = conciergeFor(createConcierge, [
    action("run", () => ({ ok: true, message: "Done." })),
  ]);
  const harness = transportHarness({
    capabilities: { acknowledgesCatalog: true },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
  });
  expect(harness.publications).toHaveLength(1);
  expect(session.catalog()).toBeNull();

  harness.setStatus("disconnected");
  harness.setStatus("connected");

  expect(harness.publications).toHaveLength(2);
  const republished = harness.publications[1];
  expect(republished).toBe(harness.publications[0]);
  harness.acknowledge({ revision: republished.revision, accepted: true });
  expect(session.catalog()).toBe(republished);
  await session.stop();
});

it("reconnects onto the pending revision rather than the promoted one", async () => {
  // Re-sending the already-acknowledged revision invited an acknowledgement
  // for it, which `handleAcknowledgement` measures against the pending head,
  // fails, and reports — a spurious failure for a revision the transport had.
  const diagnostics = [];
  let enabled = true;
  const concierge = conciergeFor(createConcierge, [
    action("conditional", () => ({ ok: true, message: "Done." }), {
      availableWhen: () => enabled,
    }),
  ]);
  const harness = transportHarness({
    capabilities: { acknowledgesCatalog: true },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  const first = harness.publications[0];
  harness.acknowledge({ revision: first.revision, accepted: true });

  enabled = false;
  session.setContext(ACTIVE);
  const second = harness.publications[1];
  expect(second).not.toBe(first);

  harness.setStatus("disconnected");
  harness.setStatus("connected");

  expect(harness.publications[2]).toBe(second);
  harness.acknowledge({ revision: second.revision, accepted: true });
  expect(session.catalog()).toBe(second);
  expect(diagnostics).toEqual([]);
  await session.stop();
});
