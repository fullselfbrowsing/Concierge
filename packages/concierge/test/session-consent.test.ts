import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it } from "vitest";

import {
  action,
  batch,
  call,
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

function create(actions, presenter, diagnostics = []) {
  const concierge = conciergeFor(createConcierge, actions);
  const harness = transportHarness();
  const session = createSession({
    concierge,
    transport: harness.transport,
    initialContext: ACTIVE,
    presentOutcome: presenter,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  return { harness, session };
}

it("bypasses outcome presentation for an all-success batch", async () => {
  let presentations = 0;
  const { harness, session } = create([
    action("ok", () => ({ ok: true, message: "Done." })),
  ], async () => {
    presentations += 1;
    return { outcome: "completed" };
  });
  const outcome = await harness.dispatch(batch(session.catalog(), [call("ok", "ok")]));

  expect(outcome.rows[0].result.ok).toBe(true);
  expect(presentations).toBe(0);
  await session.stop();
});

it("presents one minimal deeply frozen failure outcome before release", async () => {
  const seen = [];
  const { harness, session } = create([
    action("fail", () => ({ ok: false, reason: "handler_error", message: "Failed." })),
  ], async (outcome) => {
    seen.push(outcome);
    expect(Object.isFrozen(outcome)).toBe(true);
    expect(Object.isFrozen(outcome.failures)).toBe(true);
    expect(Object.isFrozen(outcome.failures[0])).toBe(true);
    return { outcome: "completed" };
  });
  const outcome = await harness.dispatch(batch(session.catalog(), [call("fail", "fail")]));

  expect(seen).toEqual([{
    failures: [{ callId: "fail", reason: "handler_error", message: "Failed." }],
  }]);
  expect(outcome.rows[0].result.reason).toBe("handler_error");
  await session.stop();
});

it("withholds failed outcomes when presentation throws, rejects, or is interrupted", async () => {
  for (const presenter of [
    async () => {
      throw new Error("private presenter failure");
    },
    async () => Promise.reject(new Error("private presenter rejection")),
    async () => ({ outcome: "interrupted" }),
  ]) {
    delete globalThis[CONTRACT_KEY];
    const diagnostics = [];
    const { harness, session } = create([
      action("fail", () => ({ ok: false, reason: "cancelled", message: "Failed." })),
    ], presenter, diagnostics);

    await expect(harness.dispatch(batch(
      session.catalog(),
      [call("fail", "fail")],
    ))).rejects.toThrow("withheld");
    expect(diagnostics.map((item) => item.code)).toEqual(["outcome_presentation_failed"]);
    await session.stop();
  }
});

it("orders a completed failure presentation before the FIFO successor", async () => {
  const order = [];
  let release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  const { harness, session } = create([
    action("fail", ({ args }) => {
      order.push(`handler:${args.value}`);
      return args.value === 1
        ? { ok: false, reason: "handler_error", message: "Failed." }
        : { ok: true, message: "Done." };
    }),
  ], async () => {
    order.push("present:start");
    await barrier;
    order.push("present:end");
    return { outcome: "completed" };
  });
  const catalog = session.catalog();
  const first = harness.dispatch(batch(catalog, [
    call("first", "fail", 0, JSON.stringify({ value: 1 })),
  ], { responseId: "first" }));
  const second = harness.dispatch(batch(catalog, [
    call("second", "fail", 0, JSON.stringify({ value: 2 })),
  ], { responseId: "second" }));
  await Promise.resolve();
  await Promise.resolve();
  expect(order).not.toContain("handler:2");
  release();
  await Promise.all([first, second]);
  expect(order).toEqual(["handler:1", "present:start", "present:end", "handler:2"]);
  await session.stop();
});

it("settles terminal failures only after completed presentation", async () => {
  const order = [];
  const { harness, session } = create([
    action("finish", () => ({ ok: false, reason: "cancelled", message: "Stopped." }), {
      terminal: true,
    }),
  ], async () => {
    order.push("present");
    return { outcome: "completed" };
  });
  const outcome = await harness.dispatch(batch(
    session.catalog(),
    [call("finish", "finish")],
  ));

  expect(outcome.kind).toBe("terminal");
  expect(order).toEqual(["present"]);
  await session.stop();
});

it("rejects missing and malformed outcome sinks before transport effects", () => {
  for (const presentOutcome of [undefined, null, {}, "present"]) {
    delete globalThis[CONTRACT_KEY];
    const concierge = conciergeFor(createConcierge, []);
    const harness = transportHarness();
    expect(() => createSession({
      concierge,
      transport: harness.transport,
      initialContext: ACTIVE,
      presentOutcome,
    })).toThrow("could not start");
    expect(harness.publications).toEqual([]);
  }
});
