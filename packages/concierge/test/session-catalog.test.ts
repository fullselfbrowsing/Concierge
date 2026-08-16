import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it } from "vitest";

import {
  action,
  conciergeFor,
  transportHarness,
} from "./fixtures/v2-session.js";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const CONTRACT_KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const ACTIVE = Object.freeze({ page: "active" });

let createConcierge;
let createSession;

beforeAll(async () => {
  if (!existsSync(fileURLToPath(DIST_URL))) throw new Error("Build concierge before testing.");
  ({ createConcierge, createSession } = await import(DIST_URL.href));
});

beforeEach(() => {
  delete globalThis[CONTRACT_KEY];
});

it("publishes one atomic initial catalog and reuses its memoized snapshot", async () => {
  let enabled = true;
  const concierge = conciergeFor(createConcierge, [
    action("conditional", () => ({ ok: true, message: "Done." }), {
      availableWhen: () => enabled,
    }),
  ]);
  const harness = transportHarness();
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
  });

  const first = session.catalog();
  expect(harness.publications).toEqual([first]);
  expect(first.tools.map((tool) => tool.name)).toEqual(["conditional"]);
  session.setContext({ page: "active", unrelated: true });
  expect(session.catalog()).toBe(first);
  expect(harness.publications).toHaveLength(1);

  enabled = false;
  session.setContext(ACTIVE);
  const hidden = session.catalog();
  expect(hidden.revision).not.toBe(first.revision);
  expect(hidden.tools).toEqual([]);

  enabled = true;
  session.setContext(ACTIVE);
  expect(session.catalog()).toBe(first);
  expect(harness.publications).toEqual([first, hidden, first]);
  await session.stop();
});

it("publishes an empty no-stage catalog without splitting stage from tools", async () => {
  const concierge = conciergeFor(createConcierge, [
    action("active-only", () => ({ ok: true, message: "Done." })),
  ]);
  const harness = transportHarness();
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: { page: "elsewhere" },
    presentOutcome: async () => ({ outcome: "completed" }),
  });

  expect(session.catalog()).toMatchObject({ stage: null, tools: [] });
  expect(harness.publications[0]).toBe(session.catalog());
  await session.stop();
});

it("rejects a catalog transition on a fixed-catalog transport and stops", async () => {
  let enabled = true;
  const concierge = conciergeFor(createConcierge, [
    action("conditional", () => ({ ok: true, message: "Done." }), {
      availableWhen: () => enabled,
    }),
  ]);
  const harness = transportHarness({ capabilities: { dynamicCatalog: false } });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
  });

  enabled = false;
  expect(() => session.setContext(ACTIVE)).toThrow("does not support catalog changes");
  await session.stop();
  expect(harness.batchUnsubscribes).toBe(1);
  expect(harness.statusUnsubscribes).toBe(1);
});

it("replays only the current atomic catalog on reconnect transitions", async () => {
  const concierge = conciergeFor(createConcierge, [
    action("run", () => ({ ok: true, message: "Done." })),
  ]);
  const harness = transportHarness({ status: "idle" });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
  });
  const catalog = session.catalog();

  harness.setStatus("connected");
  harness.setStatus("connected");
  harness.setStatus("idle");
  harness.setStatus("connected");
  expect(harness.publications).toEqual([catalog, catalog, catalog]);
  await session.stop();
});

it("snapshots catalog listeners and contains listener failures", async () => {
  let enabled = true;
  const diagnostics = [];
  const seen = [];
  const concierge = conciergeFor(createConcierge, [
    action("conditional", () => ({ ok: true, message: "Done." }), {
      availableWhen: () => enabled,
    }),
  ]);
  const harness = transportHarness();
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  const remove = session.onCatalogChange((catalog) => seen.push(catalog));
  session.onCatalogChange(() => {
    throw new Error("listener detail");
  });

  enabled = false;
  session.setContext(ACTIVE);
  remove();
  enabled = true;
  session.setContext(ACTIVE);

  expect(seen).toHaveLength(1);
  expect(diagnostics.map((item) => item.code)).toEqual([
    "catalog_listener_failed",
    "catalog_listener_failed",
  ]);
  expect(Object.isFrozen(diagnostics[0])).toBe(true);
  await session.stop();
});

it("fails closed and diagnoses a later catalog publication failure", async () => {
  let enabled = true;
  let publications = 0;
  const diagnostics = [];
  const concierge = conciergeFor(createConcierge, [
    action("conditional", () => ({ ok: true, message: "Done." }), {
      availableWhen: () => enabled,
    }),
  ]);
  const harness = transportHarness({
    setCatalog() {
      publications += 1;
      if (publications > 1) throw new Error("private publication failure");
    },
  });
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: async () => ({ outcome: "completed" }),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });

  enabled = false;
  expect(() => session.setContext(ACTIVE)).toThrow("could not publish");
  expect(diagnostics.map((item) => item.code)).toEqual(["catalog_publish_failed"]);
  await session.stop();
});
