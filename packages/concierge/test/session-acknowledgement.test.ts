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
