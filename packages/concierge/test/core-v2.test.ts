import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const CONTRACT_KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const CONTEXT = Object.freeze({ page: "active", enabled: true });

let createConcierge;
let createSession;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error("Build packages/concierge before running core-v2.test.ts.");
  }
  const artifact = await import(DIST_URL.href);
  createConcierge = artifact.createConcierge;
  createSession = artifact.createSession;
});

beforeEach(() => {
  delete globalThis[CONTRACT_KEY];
});

function schema(validate = (value) => ({ value })) {
  return {
    "~standard": {
      version: 1,
      vendor: "core-v2-test",
      validate,
    },
  };
}

function action(name, handler, options = {}) {
  return {
    name,
    description: `Run ${name}.`,
    schema: schema(),
    jsonSchema: { type: "object" },
    redact: "drop",
    effects: { readOnly: true },
    handler,
    ...options,
  };
}

function conciergeFor(actions, extra = {}) {
  return createConcierge({
    stages: [{ id: "active", match: (ctx) => ctx.page === "active", actions }],
    ...extra,
  });
}

function identity(overrides = {}) {
  return {
    sessionId: "session-1",
    responseId: "response-1",
    callId: "call-1",
    userTurnId: "turn-1",
    outputIndex: 0,
    ...overrides,
  };
}

function request(catalog, name, input = {}, overrides = {}) {
  return {
    name,
    input,
    catalogRevision: catalog.revision,
    identity: identity(),
    ...overrides,
  };
}

async function flush() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe("contract v3 catalog and dispatch", () => {
  it("exports only the v2 Concierge runtime surface and resolves availability atomically", () => {
    let availabilityReads = 0;
    const concierge = conciergeFor([
      action("visible", () => ({ ok: true, message: "Visible." })),
      action("conditional", () => ({ ok: true, message: "Conditional." }), {
        availableWhen(ctx) {
          availabilityReads += 1;
          return ctx.enabled;
        },
      }),
    ]);

    const enabled = concierge.resolveCatalog(CONTEXT);
    const disabled = concierge.resolveCatalog({ ...CONTEXT, enabled: false });

    expect(Object.keys(concierge).sort()).toEqual([
      "dispatch",
      "dispatchBatch",
      "explain",
      "onDispatch",
      "resolveCatalog",
    ]);
    expect("catalogFor" in concierge).toBe(false);
    expect("stageFor" in concierge).toBe(false);
    expect(enabled.tools.map((tool) => tool.name)).toEqual(["visible", "conditional"]);
    expect(disabled.tools.map((tool) => tool.name)).toEqual(["visible"]);
    expect(enabled.revision).not.toBe(disabled.revision);
    expect(availabilityReads).toBe(2);
    expect(concierge.explain(CONTEXT).catalog).toEqual(["visible", "conditional"]);

    const repeated = concierge.resolveCatalog(CONTEXT);
    expect(repeated).toBe(enabled);
    expect(typeof enabled.revision).toBe("symbol");
    expect(Object.isFrozen(enabled)).toBe(true);
    expect(Object.isFrozen(enabled.tools)).toBe(true);
    expect(Object.isFrozen(enabled.tools[0])).toBe(true);
    expect(Object.isFrozen(enabled.tools[0].parameters)).toBe(true);
    expect(JSON.stringify(enabled)).not.toContain("revision");

    const secondConcierge = conciergeFor([
      action("visible", () => ({ ok: true, message: "Visible." })),
    ]);
    expect(secondConcierge.resolveCatalog(CONTEXT).revision).not.toBe(
      enabled.revision,
    );
  });

  it("fails closed on throwing and nonboolean availability without leaking values", async () => {
    const realConsole = globalThis.console;
    const warnings = [];
    let handlerCalls = 0;
    globalThis.console = { ...realConsole, warn: (message) => warnings.push(String(message)) };
    try {
      const concierge = conciergeFor([
        action("throws", () => {
          handlerCalls += 1;
          return { ok: true, message: "Unused." };
        }, {
          availableWhen() {
            throw new Error("AVAILABILITY-SECRET");
          },
        }),
        action("truthy", () => {
          handlerCalls += 1;
          return { ok: true, message: "Unused." };
        }, { availableWhen: () => ({ secret: "NONBOOLEAN-SECRET" }) }),
      ]);
      const catalog = concierge.resolveCatalog(CONTEXT);
      expect(catalog.tools).toEqual([]);
      expect(await concierge.dispatch(CONTEXT, request(catalog, "throws"))).toMatchObject({
        ok: false,
        reason: "unknown_action",
      });
      expect(handlerCalls).toBe(0);
      expect(warnings).toHaveLength(2);
      expect(warnings.join(" ")).not.toContain("AVAILABILITY-SECRET");
      expect(warnings.join(" ")).not.toContain("NONBOOLEAN-SECRET");
      concierge.resolveCatalog(CONTEXT);
      expect(warnings).toHaveLength(2);
    } finally {
      globalThis.console = realConsole;
    }
  });

  it("deduplicates before current-catalog admission and conflicts changed descriptors", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action("run", () => {
        calls += 1;
        return { ok: true, message: "Done." };
      }),
    ]);
    const oldCatalog = concierge.resolveCatalog(CONTEXT);
    const firstRequest = request(oldCatalog, "run", { value: 1 });
    const first = concierge.dispatch(CONTEXT, firstRequest);
    const exact = concierge.dispatch(CONTEXT, firstRequest);
    expect(exact).toBe(first);
    await first;

    const advanced = concierge.resolveCatalog({ ...CONTEXT, enabled: false });
    expect(advanced.revision).toBe(oldCatalog.revision);
    const exactAfterResolution = concierge.dispatch(CONTEXT, firstRequest);
    expect(exactAfterResolution).toBe(first);

    const cyclic = {};
    cyclic.self = cyclic;
    const conflict = await concierge.dispatch(CONTEXT, {
      ...firstRequest,
      input: cyclic,
    });
    expect(conflict).toMatchObject({ ok: false, reason: "identity_conflict" });
    expect(calls).toBe(1);
  });

  it("returns catalog_stale for a new tuple and identity_conflict for changed revision reuse", async () => {
    let enabled = true;
    const concierge = conciergeFor([
      action("run", () => ({ ok: true, message: "Done." }), {
        availableWhen: () => enabled,
      }),
    ]);
    const oldCatalog = concierge.resolveCatalog(CONTEXT);
    const firstRequest = request(oldCatalog, "run");
    await concierge.dispatch(CONTEXT, firstRequest);

    enabled = false;
    const current = concierge.resolveCatalog(CONTEXT);
    expect(current.revision).not.toBe(oldCatalog.revision);

    const stale = await concierge.dispatch(CONTEXT, {
      ...firstRequest,
      identity: identity({ callId: "call-new" }),
    });
    expect(stale).toMatchObject({ ok: false, reason: "catalog_stale" });

    const conflict = await concierge.dispatch(CONTEXT, {
      ...firstRequest,
      catalogRevision: current.revision,
    });
    expect(conflict).toMatchObject({ ok: false, reason: "identity_conflict" });
  });

  it("correlates every malformed batch occurrence and rejects malformed JSON as invalid_args", async () => {
    const concierge = conciergeFor([
      action("run", () => ({ ok: true, message: "Done." })),
    ]);
    const catalog = concierge.resolveCatalog(CONTEXT);
    const unreadable = {
      get callId() {
        throw new Error("private");
      },
      name: "run",
      arguments: "{}",
      outputIndex: 1,
    };
    const outcome = await concierge.dispatchBatch(CONTEXT, {
      sessionId: "session-1",
      responseId: "response-1",
      userTurnId: "turn-1",
      catalogRevision: catalog.revision,
      calls: [
        { callId: "json", name: "run", arguments: "{", outputIndex: 0 },
        unreadable,
        { callId: "valid", name: "run", arguments: "{}", outputIndex: 2 },
      ],
    });

    expect(outcome.kind).toBe("completed");
    expect(outcome.rows).toHaveLength(3);
    expect(outcome.rows.map((row) => [row.callId, row.name, row.result.reason])).toEqual([
      ["json", "run", "invalid_args"],
      ["[concierge:unobservable-call-id:1]", "run", "invalid_invocation"],
      ["valid", "run", undefined],
    ]);
  });

  it("reports terminal control explicitly and blocks terminal descendants", async () => {
    let childCalls = 0;
    const concierge = conciergeFor([
      action("child", () => {
        childCalls += 1;
        return { ok: true, message: "Child." };
      }),
      action("finish", async ({ workflow }) => {
        const child = await workflow.run({ stepId: "too-late", name: "child", input: {} });
        return child;
      }, { terminal: true }),
    ]);
    const catalog = concierge.resolveCatalog(CONTEXT);
    const outcome = await concierge.dispatchBatch(CONTEXT, {
      sessionId: "session-1",
      responseId: "response-1",
      userTurnId: "turn-1",
      catalogRevision: catalog.revision,
      calls: [
        { callId: "terminal", name: "finish", arguments: "{}", outputIndex: 0 },
        { callId: "after", name: "child", arguments: "{}", outputIndex: 1 },
      ],
    });

    expect(outcome.kind).toBe("terminal");
    expect(outcome.rows).toHaveLength(1);
    expect(outcome.enteredBy.name).toBe("finish");
    expect(childCalls).toBe(0);
  });

  it("runs child steps FIFO, deduplicates a step Promise, and unwinds cleanup LIFO", async () => {
    const order = [];
    const concierge = conciergeFor([
      action("child", ({ args }) => {
        order.push(`child:${args.value}`);
        return { ok: true, message: "Child." };
      }),
      action("parent", async ({ workflow }) => {
        workflow.cleanup(() => order.push("cleanup:first"));
        workflow.cleanup(() => order.push("cleanup:second"));
        const first = workflow.run({ stepId: "first", name: "child", input: { value: 1 } });
        const duplicate = workflow.run({ stepId: "first", name: "child", input: { value: 1 } });
        const second = workflow.run({ stepId: "second", name: "child", input: { value: 2 } });
        expect(duplicate).toBe(first);
        await Promise.all([first, second]);
        order.push("parent:done");
        return { ok: true, message: "Parent." };
      }),
    ]);
    const catalog = concierge.resolveCatalog(CONTEXT);
    const result = await concierge.dispatch(CONTEXT, request(catalog, "parent"));

    expect(result.ok).toBe(true);
    expect(order).toEqual([
      "child:1",
      "child:2",
      "parent:done",
      "cleanup:second",
      "cleanup:first",
    ]);
  });

  it("resolves queued child availability at FIFO execution time", async () => {
    let enabled = true;
    let guardedCalls = 0;
    let childResults;
    const concierge = conciergeFor([
      action("disable", () => {
        enabled = false;
        return { ok: true, message: "Disabled." };
      }),
      action("guarded", () => {
        guardedCalls += 1;
        return { ok: true, message: "Guarded." };
      }, { availableWhen: () => enabled }),
      action("parent", async ({ workflow }) => {
        const first = workflow.run({ stepId: "first", name: "disable", input: {} });
        const second = workflow.run({ stepId: "second", name: "guarded", input: {} });
        childResults = await Promise.all([first, second]);
        return { ok: true, message: "Parent." };
      }),
    ]);
    const result = await concierge.dispatch(
      CONTEXT,
      request(concierge.resolveCatalog(CONTEXT), "parent"),
    );

    expect(childResults[0].ok).toBe(true);
    expect(childResults[1]).toMatchObject({ ok: false, reason: "unknown_action" });
    expect(result).toMatchObject({ ok: false, reason: "unknown_action" });
    expect(guardedCalls).toBe(0);
  });

  it("orders invalid child failure behind earlier valid FIFO work", async () => {
    let childCalls = 0;
    let childResults;
    const concierge = conciergeFor([
      action("child", () => {
        childCalls += 1;
        return { ok: true, message: "Child." };
      }),
      action("parent", async ({ workflow }) => {
        const first = workflow.run({ stepId: "first", name: "child", input: {} });
        const cyclic = {};
        cyclic.self = cyclic;
        const second = workflow.run({ stepId: "later", name: "child", input: cyclic });
        childResults = await Promise.all([first, second]);
        return { ok: true, message: "Parent." };
      }),
    ]);
    const result = await concierge.dispatch(
      CONTEXT,
      request(concierge.resolveCatalog(CONTEXT), "parent"),
    );

    expect(childCalls).toBe(1);
    expect(childResults[0].ok).toBe(true);
    expect(childResults[1]).toMatchObject({ ok: false, reason: "invalid_args" });
    expect(result).toMatchObject({ ok: false, reason: "invalid_args" });
  });

  it("deduplicates exact rejected tuples and malformed batch occurrences", async () => {
    const concierge = conciergeFor([]);
    const catalog = concierge.resolveCatalog(CONTEXT);
    const events = [];
    concierge.onDispatch((event) => events.push(event));
    const missing = request(catalog, "missing");
    const first = concierge.dispatch(CONTEXT, missing);
    const exact = concierge.dispatch(CONTEXT, missing);
    expect(exact).toBe(first);
    await first;

    const malformed = {
      sessionId: "session-1",
      responseId: "response-json",
      userTurnId: "turn-1",
      catalogRevision: catalog.revision,
      calls: [{ callId: "json", name: "missing", arguments: "{", outputIndex: 0 }],
    };
    const batchOne = await concierge.dispatchBatch(CONTEXT, malformed);
    const batchTwo = await concierge.dispatchBatch(CONTEXT, malformed);
    await flush();

    expect(batchTwo.rows[0].dispatchId).toBe(batchOne.rows[0].dispatchId);
    expect(events.filter((event) => event.phase === "failed")).toHaveLength(2);
  });

  it("deduplicates first invalid input with full lifecycle correlation", async () => {
    const concierge = conciergeFor([
      action("known", () => ({ ok: true, message: "Unused." })),
    ]);
    const catalog = concierge.resolveCatalog(CONTEXT);
    const cyclic = {};
    cyclic.self = cyclic;
    const invocation = request(catalog, "known", cyclic);
    const events = [];
    concierge.onDispatch((event) => events.push(event));

    const first = concierge.dispatch(CONTEXT, invocation);
    const exact = concierge.dispatch(CONTEXT, invocation);
    expect(exact).toBe(first);
    await first;
    const changed = {};
    changed.self = changed;
    const conflict = await concierge.dispatch(CONTEXT, {
      ...invocation,
      input: changed,
    });
    await flush();

    expect(conflict).toMatchObject({ ok: false, reason: "identity_conflict" });
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      phase: "failed",
      name: "known",
      identity: identity(),
      result: { ok: false, reason: "invalid_args" },
    });
  });

  it("fingerprints hostile rejected inputs without descriptor collapse", async () => {
    const concierge = conciergeFor([
      action("known", () => ({ ok: true, message: "Unused." })),
    ]);
    const catalog = concierge.resolveCatalog(CONTEXT);
    const firstSymbol = Symbol("same");
    const secondSymbol = Symbol("same");
    const symbolRequest = request(catalog, "known", firstSymbol);
    const first = concierge.dispatch(CONTEXT, symbolRequest);
    expect(concierge.dispatch(CONTEXT, symbolRequest)).toBe(first);
    await first;
    await expect(concierge.dispatch(CONTEXT, {
      ...symbolRequest,
      input: secondSymbol,
    })).resolves.toMatchObject({ ok: false, reason: "identity_conflict" });

    const cyclic = { value: 1 };
    cyclic.self = cyclic;
    const cyclicRequest = request(catalog, "known", cyclic, {
      identity: identity({ callId: "cyclic" }),
    });
    const rejected = concierge.dispatch(CONTEXT, cyclicRequest);
    await rejected;
    cyclic.value = 2;
    await expect(concierge.dispatch(CONTEXT, cyclicRequest)).resolves.toMatchObject({
      ok: false,
      reason: "identity_conflict",
    });
  });

  it("conflicts changed malformed batch rows and invalid envelopes", async () => {
    const concierge = conciergeFor([]);
    const catalog = concierge.resolveCatalog(CONTEXT);
    const base = {
      sessionId: "session-1",
      responseId: "response-malformed",
      userTurnId: "turn-1",
      catalogRevision: catalog.revision,
    };
    const malformed = {
      ...base,
      calls: [{ callId: "row", name: "missing", arguments: null, outputIndex: 0 }],
    };
    await concierge.dispatchBatch(CONTEXT, malformed);
    const changedRow = await concierge.dispatchBatch(CONTEXT, {
      ...malformed,
      calls: [{ ...malformed.calls[0], arguments: 42 }],
    });
    expect(changedRow.rows[0].result).toMatchObject({
      ok: false,
      reason: "identity_conflict",
    });

    const invalidEnvelope = {
      ...base,
      responseId: "response-envelope",
      calls: [
        { callId: "first", name: "missing", arguments: "{\"v\":1}", outputIndex: 0 },
        { callId: "second", name: "missing", arguments: "{}", outputIndex: 0 },
      ],
    };
    await concierge.dispatchBatch(CONTEXT, invalidEnvelope);
    const changedEnvelope = await concierge.dispatchBatch(CONTEXT, {
      ...invalidEnvelope,
      calls: [
        { ...invalidEnvelope.calls[0], arguments: "{\"v\":2}" },
        invalidEnvelope.calls[1],
      ],
    });
    expect(changedEnvelope.rows[0].result).toMatchObject({
      ok: false,
      reason: "identity_conflict",
    });
  });

  it("distinguishes a malformed calls container from a valid empty batch", async () => {
    const concierge = conciergeFor([]);
    const catalog = concierge.resolveCatalog(CONTEXT);
    const base = {
      sessionId: "session-1",
      responseId: "response-1",
      userTurnId: "turn-1",
      catalogRevision: catalog.revision,
    };
    const malformed = await concierge.dispatchBatch(CONTEXT, {
      ...base,
      calls: {},
    });
    const empty = await concierge.dispatchBatch(CONTEXT, {
      ...base,
      calls: [],
    });

    expect(malformed.rows).toHaveLength(1);
    expect(malformed.rows[0].result).toMatchObject({
      ok: false,
      reason: "invalid_invocation",
    });
    expect(empty).toEqual({ kind: "completed", rows: [] });
  });

  it("uses collision-free identities for child occurrences in distinct lineages", async () => {
    let childCalls = 0;
    const concierge = conciergeFor([
      action("child", () => {
        childCalls += 1;
        return { ok: true, message: "Child." };
      }),
      action("parent-short", async ({ workflow }) => {
        await workflow.run({ stepId: "b/c", name: "child", input: {} });
        return { ok: true, message: "Parent." };
      }),
      action("parent-long", async ({ workflow }) => {
        await workflow.run({ stepId: "c", name: "child", input: {} });
        return { ok: true, message: "Parent." };
      }),
    ]);
    const catalog = concierge.resolveCatalog(CONTEXT);
    await concierge.dispatchBatch(CONTEXT, {
      sessionId: "session-1",
      responseId: "response-1",
      userTurnId: "turn-1",
      catalogRevision: catalog.revision,
      calls: [
        { callId: "a", name: "parent-short", arguments: "{}", outputIndex: 0 },
        { callId: "a/b", name: "parent-long", arguments: "{}", outputIndex: 1 },
      ],
    });
    expect(childCalls).toBe(2);
  });

  it("supersedes queued successors after a terminal child without fabricating success", async () => {
    let normalCalls = 0;
    let childResults;
    let rejectedPromises;
    const concierge = conciergeFor([
      action("finish", () => ({ ok: true, message: "Finished." }), { terminal: true }),
      action("normal", () => {
        normalCalls += 1;
        return { ok: true, message: "Normal." };
      }),
      action("parent", async ({ workflow }) => {
        const terminal = workflow.run({ stepId: "terminal", name: "finish", input: {} });
        const successor = workflow.run({ stepId: "successor", name: "normal", input: {} });
        const cyclic = {};
        cyclic.self = cyclic;
        const malformed = workflow.run({ stepId: "malformed", name: "normal", input: cyclic });
        const exactMalformed = workflow.run({
          stepId: "malformed",
          name: "normal",
          input: cyclic,
        });
        rejectedPromises = [malformed, exactMalformed];
        childResults = await Promise.all([terminal, successor, malformed]);
        return { ok: true, message: "Parent." };
      }),
    ]);
    const events = [];
    concierge.onDispatch((event) => events.push(event));
    const outcome = await concierge.dispatchBatch(CONTEXT, {
      sessionId: "session-1",
      responseId: "response-1",
      userTurnId: "turn-1",
      catalogRevision: concierge.resolveCatalog(CONTEXT).revision,
      calls: [{ callId: "parent", name: "parent", arguments: "{}", outputIndex: 0 }],
    });

    expect(outcome.kind).toBe("terminal");
    expect(outcome.enteredBy.name).toBe("finish");
    expect(childResults[0].ok).toBe(true);
    expect(childResults[1]).toMatchObject({ ok: false, reason: "superseded" });
    expect(childResults[2]).toMatchObject({ ok: false, reason: "superseded" });
    expect(rejectedPromises[1]).toBe(rejectedPromises[0]);
    expect(normalCalls).toBe(0);
    await flush();
    const childFinals = events.filter((event) =>
      ["successor", "malformed"].includes(event.lineage.stepId) &&
      ["succeeded", "failed", "cancelled"].includes(event.phase)
    );
    expect(childFinals.map((event) => event.lineage.stepId).sort()).toEqual([
      "malformed",
      "successor",
    ]);
    expect(childFinals.every((event) =>
      event.phase === "cancelled" && event.terminalEntered === true
    )).toBe(true);
  });

  it("emits redacted lifecycle events asynchronously and contains observer failures", async () => {
    const concierge = conciergeFor([
      action("run", () => ({ ok: true, message: "Done." }), {
        redact: ({ safe }) => ({ safe }),
      }),
    ]);
    const catalog = concierge.resolveCatalog(CONTEXT);
    const events = [];
    concierge.onDispatch((event) => {
      events.push(event);
      throw new Error("observer failure");
    });

    const promise = concierge.dispatch(
      CONTEXT,
      request(catalog, "run", { safe: "yes", secret: "no" }),
    );
    expect(events).toEqual([]);
    await promise;
    await flush();

    expect(events.map((event) => event.phase)).toEqual([
      "accepted",
      "executing",
      "succeeded",
    ]);
    expect(events[0].input).toEqual({ kind: "included", value: { safe: "yes" } });
    expect(events.map((event) => event.terminalEntered)).toEqual([false, false, false]);
    expect(JSON.stringify(events)).not.toContain("secret");
  });

  it("emits waiting, cancelled, and failed lifecycle phases with frozen correlation", async () => {
    const scheduled = [];
    const concierge = conciergeFor([
      action("write", () => ({ ok: true, message: "Written." }), {
        effects: { readOnly: false },
        redact: ({ safe }) => ({ safe }),
      }),
      action("fail", () => ({ ok: false, reason: "handler_error", message: "Failed." })),
    ], {
      commitWindowMs: 25,
      scheduler(fn, delay) {
        scheduled.push({ fn, delay });
        return () => {};
      },
    });
    const events = [];
    concierge.onDispatch((event) => events.push(event));
    const catalog = concierge.resolveCatalog(CONTEXT);
    const pending = concierge.dispatch(
      CONTEXT,
      request(catalog, "write", { safe: "yes", secret: "no" }),
    );
    await flush();
    expect(events.map((event) => event.phase)).toEqual(["accepted", "waiting"]);
    expect(scheduled[0].delay).toBe(25);
    scheduled[0].fn();
    await pending;
    await concierge.dispatch(CONTEXT, request(catalog, "fail", {}, {
      identity: identity({ callId: "failure" }),
    }));
    const aborted = new AbortController();
    aborted.abort();
    await concierge.dispatch(CONTEXT, request(catalog, "write", {}, {
      identity: identity({ callId: "cancelled" }),
      signal: aborted.signal,
    }));
    await flush();

    expect(events.some((event) => event.phase === "failed")).toBe(true);
    expect(events.some((event) => event.phase === "cancelled")).toBe(true);
    for (const event of events) {
      expect(Object.isFrozen(event)).toBe(true);
      expect(Object.isFrozen(event.lineage)).toBe(true);
      expect(event.stage).toBe("active");
      expect(event.catalogRevision).toBe(catalog.revision);
      expect(event.lineage.depth).toBe(0);
    }
  });

  it("drops hostile redaction output and snapshots listener add/remove per event", async () => {
    const concierge = conciergeFor([
      action("run", () => ({ ok: true, message: "Done." }), {
        redact() {
          throw new Error("private projection");
        },
      }),
    ]);
    const catalog = concierge.resolveCatalog(CONTEXT);
    const firstEvents = [];
    const secondEvents = [];
    let removeFirst;
    removeFirst = concierge.onDispatch((event) => {
      firstEvents.push(event);
      if (event.phase === "accepted") {
        removeFirst();
        concierge.onDispatch((next) => secondEvents.push(next));
      }
    });

    await concierge.dispatch(CONTEXT, request(catalog, "run", { secret: true }));
    await flush();
    expect(firstEvents.map((event) => event.phase)).toEqual(["accepted", "executing"]);
    expect(firstEvents[0].input).toEqual({ kind: "dropped" });
    expect(secondEvents.map((event) => event.phase)).toEqual(["succeeded"]);
  });
});

describe("contract v3 Session", () => {
  function transportHarness() {
    let batchHandler;
    const publications = [];
    const transport = {
      capabilities: Object.freeze({
        consentGrade: "none",
        userTurnIdentity: "none",
        parallelCalls: true,
        dynamicCatalog: true,
      }),
      status: "connected",
      setCatalog(catalog) {
        publications.push(catalog);
      },
      onStatusChange() {
        return () => {};
      },
      onToolBatch(handler) {
        batchHandler = handler;
        return () => {};
      },
    };
    return { transport, publications, dispatch: (batch) => batchHandler(batch) };
  }

  it("withholds failed outcomes when app presentation is interrupted", async () => {
    const concierge = conciergeFor([
      action("fail", () => ({ ok: false, reason: "handler_error", message: "Failed." })),
    ]);
    const harness = transportHarness();
    const session = createSession({
      concierge,
      transport: harness.transport,
      initialContext: CONTEXT,
      presentOutcome: async () => ({ outcome: "interrupted" }),
    });
    const catalog = session.catalog();

    await expect(harness.dispatch({
      sessionId: "session-1",
      responseId: "response-1",
      userTurnId: "turn-1",
      catalogRevision: catalog.revision,
      calls: [{ callId: "fail", name: "fail", arguments: "{}", outputIndex: 0 }],
    })).rejects.toThrow("withheld");
    await session.stop();
  });

  it("settles a terminal batch after completed failure presentation without deadlock", async () => {
    const concierge = conciergeFor([
      action("finish", () => ({ ok: false, reason: "cancelled", message: "Stopped." }), {
        terminal: true,
      }),
    ]);
    const harness = transportHarness();
    const session = createSession({
      concierge,
      transport: harness.transport,
      initialContext: CONTEXT,
      presentOutcome: async () => ({ outcome: "completed" }),
    });
    const catalog = session.catalog();
    const outcome = await Promise.race([
      harness.dispatch({
        sessionId: "session-1",
        responseId: "response-1",
        userTurnId: "turn-1",
        catalogRevision: catalog.revision,
        calls: [{ callId: "finish", name: "finish", arguments: "{}", outputIndex: 0 }],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("terminal timeout")), 250)),
    ]);

    expect(outcome.kind).toBe("terminal");
    await session.stop();
  });
});
