import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { beforeAll, beforeEach, expect, it as vitestIt } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const ACTIVE_CONTEXT = { pathname: "/active" };

let createConcierge;
let createBridge;
let offPageResult;
let USER_CANCELLED;
let USER_DECLINED;
let MESSAGE_MAX_CHARS;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the dispatcher suite.",
    );
  }

  const artifact = await import(DIST_URL.href);
  createConcierge = artifact.createConcierge;
  createBridge = artifact.createBridge;
  offPageResult = artifact.offPageResult;
  USER_CANCELLED = artifact.USER_CANCELLED;
  USER_DECLINED = artifact.USER_DECLINED;
  MESSAGE_MAX_CHARS = artifact.MESSAGE_MAX_CHARS;
});

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

// Vitest's JSON reporter counts name-filtered tests as pending. Register only cases selected
// by a focused RED gate so each gate can prove an exact collected set; an unfiltered run still
// registers every case.
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

function testSchema(validate = (value) => ({ value })) {
  return {
    "~standard": {
      version: 1,
      vendor: "concierge-dispatcher-test",
      validate,
    },
  };
}

function action(name, handler, options = {}) {
  const {
    effects = { readOnly: true },
    validate = (value) => ({ value }),
    ...extra
  } = options;

  return {
    name,
    description: `the ${name} action`,
    schema: testSchema(validate),
    jsonSchema: { type: "object" },
    redact: "drop",
    handler,
    effects,
    ...extra,
  };
}

function conciergeFor(actions, config = {}) {
  const { bridge, ...conciergeConfig } = config;
  const activeStage = {
    id: "active",
    match: (ctx) => ctx.pathname === ACTIVE_CONTEXT.pathname,
    actions,
  };
  if (bridge !== undefined) activeStage.bridge = bridge;

  return createConcierge({
    stages: [activeStage],
    ...conciergeConfig,
  });
}

function successful(message = "Done.") {
  return { ok: true, message };
}

function createManualScheduler() {
  const delays = [];
  const pending = [];
  let cancelCalls = 0;

  function scheduler(fn, delayMs) {
    const task = { cancelled: false, fn };
    delays.push(delayMs);
    pending.push(task);
    return () => {
      if (task.cancelled) return;
      task.cancelled = true;
      cancelCalls += 1;
    };
  }

  function fireAll() {
    const tasks = pending.splice(0);
    for (const task of tasks) {
      if (!task.cancelled) task.fn();
    }
  }

  return {
    get cancelCalls() {
      return cancelCalls;
    },
    delays,
    fireAll,
    pending,
    scheduler,
  };
}

function createAbortController(initiallyAborted = false) {
  let aborted = initiallyAborted;
  const listeners = new Set();

  const signal = {
    get aborted() {
      return aborted;
    },
    addEventListener(type, listener) {
      if (type === "abort") listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "abort") listeners.delete(listener);
    },
  };

  return {
    abort() {
      if (aborted) return;
      aborted = true;
      for (const listener of [...listeners]) listener.call(signal);
    },
    listenerCount() {
      return listeners.size;
    },
    signal,
  };
}

async function flushMicrotasks() {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

async function withFakeNow(initial, run) {
  const realNow = Date.now;
  let now = initial;
  Date.now = () => now;

  try {
    return await run((next) => {
      now = next;
    });
  } finally {
    Date.now = realNow;
  }
}

// The cases stay top-level because the mandated anchored Vitest selector reads each full
// test name. A `describe("DSP-01 …")` prefix would make every `[Rxx]` selector miss.
  it("[R01] returns the same Promise and invokes the handler once for one callId", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action("charge", () => {
        calls += 1;
        return successful();
      }),
    ]);

    const first = concierge.dispatch(ACTIVE_CONTEXT, "charge", { amount: 10 }, { callId: "call-1" });
    const second = concierge.dispatch(ACTIVE_CONTEXT, "charge", { amount: 10 }, { callId: "call-1" });

    expect(first, "[RED:R01:promise-identity]").toBe(second);
    await first;
    expect(calls).toBe(1);
  });

  it("[R02] caches a failed result with the same Promise identity", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action("fail", () => {
        calls += 1;
        return { ok: false, reason: "no_bridge", message: "Not available." };
      }),
    ]);

    const first = concierge.dispatch(ACTIVE_CONTEXT, "fail", {}, { callId: "failed-call" });
    const second = concierge.dispatch(ACTIVE_CONTEXT, "fail", {}, { callId: "failed-call" });

    expect(first, "[RED:R02:cached-failure]").toBe(second);
    expect((await first).reason).toBe("no_bridge");
    expect(calls).toBe(1);
  });

  it("[R03] uses the action name and serializable arguments when callId is absent", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action("search", () => {
        calls += 1;
        return successful();
      }),
    ]);

    const first = concierge.dispatch(ACTIVE_CONTEXT, "search", { query: "hotel" });
    const second = concierge.dispatch(ACTIVE_CONTEXT, "search", { query: "hotel" });

    expect(first, "[RED:R03:fallback-key]").toBe(second);
    await first;
    expect(calls).toBe(1);
  });

  it("[R04] namespaces callId keys separately from fallback keys", async () => {
    let calls = 0;
    const args = { amount: 10 };
    const concierge = conciergeFor([
      action("charge", () => {
        calls += 1;
        return successful();
      }),
    ]);

    const first = concierge.dispatch(
      ACTIVE_CONTEXT,
      "charge",
      args,
      { callId: `charge:${JSON.stringify(args)}` },
    );
    const second = concierge.dispatch(ACTIVE_CONTEXT, "charge", args);
    await Promise.all([first, second]);

    expect({ calls, same: first === second }, "[RED:R04:key-namespace-separation]").toEqual({
      calls: 2,
      same: false,
    });
  });

  it("[R05] runs cyclic arguments without a synchronous throw or deduplication", async () => {
    let calls = 0;
    let threw = false;
    let first;
    let second;
    const args = {};
    args.self = args;
    const concierge = conciergeFor([
      action("cycle", () => {
        calls += 1;
        return successful();
      }),
    ]);

    try {
      first = concierge.dispatch(ACTIVE_CONTEXT, "cycle", args);
      second = concierge.dispatch(ACTIVE_CONTEXT, "cycle", args);
    } catch {
      threw = true;
    }
    await Promise.all([first, second].filter(Boolean));

    expect({ calls, same: first === second, threw }, "[RED:R05:cyclic-args]").toEqual({
      calls: 2,
      same: false,
      threw: false,
    });
  });

  it("[R06] runs BigInt arguments without a synchronous throw or deduplication", async () => {
    let calls = 0;
    let threw = false;
    let first;
    let second;
    const concierge = conciergeFor([
      action("bigint", () => {
        calls += 1;
        return successful();
      }),
    ]);

    try {
      first = concierge.dispatch(ACTIVE_CONTEXT, "bigint", { value: 10n });
      second = concierge.dispatch(ACTIVE_CONTEXT, "bigint", { value: 10n });
    } catch {
      threw = true;
    }
    await Promise.all([first, second].filter(Boolean));

    expect({ calls, same: first === second, threw }, "[RED:R06:bigint-args]").toEqual({
      calls: 2,
      same: false,
      threw: false,
    });
  });

  it("[R07] keeps deduplication state isolated per Concierge instance", async () => {
    let firstCalls = 0;
    let secondCalls = 0;
    const firstConcierge = conciergeFor([
      action("charge", () => {
        firstCalls += 1;
        return successful();
      }),
    ]);
    const secondConcierge = conciergeFor([
      action("charge", () => {
        secondCalls += 1;
        return successful();
      }),
    ]);

    const first = firstConcierge.dispatch(ACTIVE_CONTEXT, "charge", {}, { callId: "shared" });
    const second = secondConcierge.dispatch(ACTIVE_CONTEXT, "charge", {}, { callId: "shared" });
    await Promise.all([first, second]);

    expect(
      { firstCalls, same: first === second, secondCalls },
      "[RED:R07:instance-isolation]",
    ).toEqual({ firstCalls: 1, same: false, secondCalls: 1 });
  });

// DSP-04 and stage authorization — lookup fails closed before handler entry.
  it("[R08] refuses an action that is present globally but absent from the supplied stage", async () => {
    let calls = 0;
    const checkout = action("confirm", () => {
      calls += 1;
      return successful();
    });
    const concierge = createConcierge({
      stages: [
        { id: "active", match: (ctx) => ctx.pathname === "/active", actions: [] },
        { id: "checkout", match: (ctx) => ctx.pathname === "/checkout", actions: [checkout] },
      ],
    });

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "confirm", {});

    expect({ calls, reason: result.reason }, "[RED:R08:off-stage-refusal]").toEqual({
      calls: 0,
      reason: "unknown_action",
    });
  });

  it("[R09] treats __proto__ as an unknown action without entering a handler", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action("safe", () => {
        calls += 1;
        return successful();
      }),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "__proto__", {});

    expect({ calls, reason: result.reason }, "[RED:R09:proto-key]").toEqual({
      calls: 0,
      reason: "unknown_action",
    });
  });

  it("[R10] treats constructor as an unknown action without entering a handler", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action("safe", () => {
        calls += 1;
        return successful();
      }),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "constructor", {});

    expect({ calls, reason: result.reason }, "[RED:R10:constructor-key]").toEqual({
      calls: 0,
      reason: "unknown_action",
    });
  });

  it("[R11] settles honestly when a catalog entry has no handler", async () => {
    const warnings = [];
    const realWarn = console.warn;
    console.warn = (...args) => warnings.push(args.map(String).join(" "));
    const missing = action("missing", () => successful());
    delete missing.handler;
    let first;
    let second;
    try {
      const concierge = conciergeFor([missing]);
      first = await concierge.dispatch(ACTIVE_CONTEXT, "missing", { call: 1 });
      second = await concierge.dispatch(ACTIVE_CONTEXT, "missing", { call: 2 });
    } finally {
      console.warn = realWarn;
    }

    expect({ first, second, warnings: warnings.length }, "[RED:R11:missing-handler]").toEqual({
      first: {
        ok: false,
        message: "This action is unavailable because no handler is registered.",
      },
      second: {
        ok: false,
        message: "This action is unavailable because no handler is registered.",
      },
      warnings: 1,
    });
  });

  it("[R12] settles honestly when a catalog entry's handler is not callable", async () => {
    const warnings = [];
    const realWarn = console.warn;
    console.warn = (...args) => warnings.push(args.map(String).join(" "));
    let first;
    let second;
    try {
      const concierge = conciergeFor([action("broken", 42)]);
      first = await concierge.dispatch(ACTIVE_CONTEXT, "broken", { call: 1 });
      second = await concierge.dispatch(ACTIVE_CONTEXT, "broken", { call: 2 });
    } finally {
      console.warn = realWarn;
    }

    expect({ first, second, warnings: warnings.length }, "[RED:R12:noncallable-handler]").toEqual({
      first: {
        ok: false,
        message: "This action is unavailable because no handler is registered.",
      },
      second: {
        ok: false,
        message: "This action is unavailable because no handler is registered.",
      },
      warnings: 1,
    });
  });

// DSP-05 — Standard Schema validation runs before handler entry.
  it("[R13] rejects synchronous validation issues before the handler", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action(
        "validateSync",
        () => {
          calls += 1;
          return successful();
        },
        { validate: () => ({ issues: [{ message: "invalid" }] }) },
      ),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "validateSync", { bad: true });

    expect({ calls, reason: result.reason }, "[RED:R13:sync-validation]").toEqual({
      calls: 0,
      reason: "invalid_args",
    });
  });

  it("[R14] awaits asynchronous validation issues before the handler", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action(
        "validateAsync",
        () => {
          calls += 1;
          return successful();
        },
        { validate: async () => ({ issues: [{ message: "invalid" }] }) },
      ),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "validateAsync", { bad: true });

    expect({ calls, reason: result.reason }, "[RED:R14:async-validation]").toEqual({
      calls: 0,
      reason: "invalid_args",
    });
  });

  it("[R15] passes the validator's transformed value to the handler", async () => {
    let received;
    const concierge = conciergeFor([
      action(
        "transform",
        ({ args }) => {
          received = args;
          return successful();
        },
        { validate: () => ({ value: { normalized: "yes" } }) },
      ),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "transform", { normalized: "no" });

    expect({ ok: result.ok, received }, "[RED:R15:transformed-value]").toEqual({
      ok: true,
      received: { normalized: "yes" },
    });
  });

  it("[R16] contains validation issues and returns only invalid_args", async () => {
    let calls = 0;
    const issueMarker = "PRIVATE-VALIDATION-DETAIL";
    const concierge = conciergeFor([
      action(
        "issues",
        () => {
          calls += 1;
          return successful();
        },
        { validate: () => ({ issues: [{ message: issueMarker }] }) },
      ),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "issues", {});

    expect(
      { calls, leaked: result.message.includes(issueMarker), reason: result.reason },
      "[RED:R16:validation-issues]",
    ).toEqual({ calls: 0, leaked: false, reason: "invalid_args" });
  });

  it("[R17] contains a synchronous validator throw as invalid_args", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action(
        "validatorThrow",
        () => {
          calls += 1;
          return successful();
        },
        {
          validate: () => {
            throw new Error("PRIVATE-VALIDATOR-THROW");
          },
        },
      ),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "validatorThrow", {});

    expect({ calls, reason: result.reason }, "[RED:R17:validator-throw]").toEqual({
      calls: 0,
      reason: "invalid_args",
    });
  });

  it("[R18] contains a validator rejection as invalid_args", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action(
        "validatorReject",
        () => {
          calls += 1;
          return successful();
        },
        { validate: () => Promise.reject(new Error("PRIVATE-VALIDATOR-REJECTION")) },
      ),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "validatorReject", {});

    expect({ calls, reason: result.reason }, "[RED:R18:validator-rejection]").toEqual({
      calls: 0,
      reason: "invalid_args",
    });
  });

// TRN-04 and dispatcher timing — direct calls need no transport.
  it("[R19] invokes a direct action loop without constructing a Transport", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action("direct", () => {
        calls += 1;
        return successful("Direct call completed.");
      }),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "direct", {});

    expect({ calls, result }, "[RED:R19:direct-no-transport]").toEqual({
      calls: 1,
      result: { ok: true, message: "Direct call completed." },
    });
  });

  it("[R20] defaults both commit and settled deduplication windows to 600 ms", async () => {
    await withFakeNow(0, async (setNow) => {
      const manual = createManualScheduler();
      const concierge = conciergeFor(
        [action("window", () => successful(), { effects: { readOnly: false } })],
        { scheduler: manual.scheduler },
      );

      const first = concierge.dispatch(ACTIVE_CONTEXT, "window", {}, { callId: "window" });
      const pendingHit = concierge.dispatch(ACTIVE_CONTEXT, "window", {}, { callId: "window" });
      await flushMicrotasks();
      manual.fireAll();
      await first;

      setNow(599);
      const settledHit = concierge.dispatch(ACTIVE_CONTEXT, "window", {}, { callId: "window" });
      setNow(601);
      const expired = concierge.dispatch(ACTIVE_CONTEXT, "window", {}, { callId: "window" });
      await flushMicrotasks();

      expect(
        {
          delays: manual.delays,
          expired: expired !== first,
          pendingHit: pendingHit === first,
          settledHit: settledHit === first,
        },
        "[RED:R20:default-windows]",
      ).toEqual({ delays: [600, 600], expired: true, pendingHit: true, settledHit: true });
    });
  });

  it("[R21] retains an in-flight Promise beyond the deduplication window", async () => {
    await withFakeNow(0, async (setNow) => {
      const manual = createManualScheduler();
      const concierge = conciergeFor(
        [action("pending", () => successful(), { effects: { readOnly: false } })],
        { scheduler: manual.scheduler },
      );

      const first = concierge.dispatch(ACTIVE_CONTEXT, "pending", {}, { callId: "pending" });
      await flushMicrotasks();
      setNow(1_200);
      const retry = concierge.dispatch(ACTIVE_CONTEXT, "pending", {}, { callId: "pending" });

      expect(retry, "[RED:R21:pending-beyond-window]").toBe(first);
      manual.fireAll();
      await first;
    });
  });

  it("[R22] starts the full deduplication window when the Promise settles", async () => {
    await withFakeNow(0, async (setNow) => {
      const manual = createManualScheduler();
      const concierge = conciergeFor(
        [action("settlement", () => successful(), { effects: { readOnly: false } })],
        { scheduler: manual.scheduler },
      );

      const first = concierge.dispatch(ACTIVE_CONTEXT, "settlement", {}, { callId: "settlement" });
      await flushMicrotasks();
      setNow(1_000);
      manual.fireAll();
      await first;

      setNow(1_599);
      const inside = concierge.dispatch(ACTIVE_CONTEXT, "settlement", {}, { callId: "settlement" });
      setNow(1_601);
      const outside = concierge.dispatch(ACTIVE_CONTEXT, "settlement", {}, { callId: "settlement" });

      expect(
        { inside: inside === first, outside: outside !== first },
        "[RED:R22:settlement-window]",
      ).toEqual({ inside: true, outside: true });
    });
  });

  it("[R23] does not extend a settled entry's lifetime when it is read", async () => {
    await withFakeNow(0, async (setNow) => {
      const manual = createManualScheduler();
      const concierge = conciergeFor(
        [action("eviction", () => successful(), { effects: { readOnly: false } })],
        { scheduler: manual.scheduler },
      );

      const first = concierge.dispatch(ACTIVE_CONTEXT, "eviction", {}, { callId: "eviction" });
      await flushMicrotasks();
      manual.fireAll();
      await first;

      setNow(500);
      const accessed = concierge.dispatch(ACTIVE_CONTEXT, "eviction", {}, { callId: "eviction" });
      setNow(601);
      const expired = concierge.dispatch(ACTIVE_CONTEXT, "eviction", {}, { callId: "eviction" });

      expect(
        { accessed: accessed === first, expired: expired !== first },
        "[RED:R23:access-eviction]",
      ).toEqual({ accessed: true, expired: true });
    });
  });

  it("[R24] sweeps every expired key instead of only the key being accessed", async () => {
    await withFakeNow(0, async (setNow) => {
      let calls = 0;
      const count = () => {
        calls += 1;
        return successful();
      };
      const concierge = conciergeFor([
        action("a", count),
        action("b", count),
        action("c", count),
      ]);

      const firstA = concierge.dispatch(ACTIVE_CONTEXT, "a", {}, { callId: "a" });
      await firstA;
      await concierge.dispatch(ACTIVE_CONTEXT, "b", {}, { callId: "b" });

      setNow(601);
      await concierge.dispatch(ACTIVE_CONTEXT, "c", {}, { callId: "c" });

      setNow(1);
      const secondA = concierge.dispatch(ACTIVE_CONTEXT, "a", {}, { callId: "a" });
      await secondA;

      expect({ calls, resurrected: secondA === firstA }, "[RED:R24:all-key-sweep]").toEqual({
        calls: 4,
        resurrected: false,
      });
    });
  });

  it("[R25] waits for the commit window before a non-read-only handler", async () => {
    let calls = 0;
    const manual = createManualScheduler();
    const concierge = conciergeFor(
      [
        action(
          "write",
          () => {
            calls += 1;
            return successful();
          },
          { effects: { readOnly: false } },
        ),
      ],
      { scheduler: manual.scheduler },
    );

    const pending = concierge.dispatch(ACTIVE_CONTEXT, "write", {});
    await flushMicrotasks();
    const callsBeforeWindow = calls;
    manual.fireAll();
    const result = await pending;

    expect(
      { calls, callsBeforeWindow, delays: manual.delays, ok: result.ok },
      "[RED:R25:non-readonly-wait]",
    ).toEqual({ calls: 1, callsBeforeWindow: 0, delays: [600], ok: true });
  });

  it("[R26] waits when an action omits effects", async () => {
    let calls = 0;
    const manual = createManualScheduler();
    const declaration = action("implicit-write", () => {
      calls += 1;
      return successful();
    });
    delete declaration.effects;
    const concierge = conciergeFor([declaration], { scheduler: manual.scheduler });

    const pending = concierge.dispatch(ACTIVE_CONTEXT, "implicit-write", {});
    await flushMicrotasks();
    const callsBeforeWindow = calls;
    manual.fireAll();
    const result = await pending;

    expect(
      { calls, callsBeforeWindow, delays: manual.delays, ok: result.ok },
      "[RED:R26:omitted-effects-wait]",
    ).toEqual({ calls: 1, callsBeforeWindow: 0, delays: [600], ok: true });
  });

  it("[R27] lets an explicitly read-only action bypass the commit window", async () => {
    let calls = 0;
    const manual = createManualScheduler();
    const concierge = conciergeFor(
      [
        action("read", () => {
          calls += 1;
          return successful();
        }),
      ],
      { scheduler: manual.scheduler },
    );

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "read", {});

    expect(
      { calls, delays: manual.delays, ok: result.ok },
      "[RED:R27:readonly-bypass]",
    ).toEqual({ calls: 1, delays: [], ok: true });
  });

  it("[R28] refuses an already-aborted action before scheduling the wait", async () => {
    let calls = 0;
    const controller = createAbortController(true);
    const manual = createManualScheduler();
    const concierge = conciergeFor(
      [
        action(
          "abort-before",
          () => {
            calls += 1;
            return successful();
          },
          { effects: { readOnly: false } },
        ),
      ],
      { scheduler: manual.scheduler },
    );

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "abort-before", {}, {
      signal: controller.signal,
    });

    expect(
      { calls, delays: manual.delays, listeners: controller.listenerCount(), result },
      "[RED:R28:abort-before-wait]",
    ).toEqual({
      calls: 0,
      delays: [],
      listeners: 0,
      result: {
        ok: false,
        reason: "aborted",
        message: "The action was cancelled before it ran.",
      },
    });
  });

  it("[R29] aborts during the commit window without running the handler", async () => {
    let calls = 0;
    const controller = createAbortController();
    const manual = createManualScheduler();
    const concierge = conciergeFor(
      [
        action(
          "abort-during",
          () => {
            calls += 1;
            return successful();
          },
          { effects: { readOnly: false } },
        ),
      ],
      { scheduler: manual.scheduler },
    );

    const pending = concierge.dispatch(ACTIVE_CONTEXT, "abort-during", {}, {
      signal: controller.signal,
    });
    await flushMicrotasks();
    controller.abort();
    manual.fireAll();
    const result = await pending;

    expect(
      { calls, result },
      "[RED:R29:abort-during-wait]",
    ).toEqual({
      calls: 0,
      result: {
        ok: false,
        reason: "aborted",
        message: "The action was cancelled before it ran.",
      },
    });
  });

  it("[R30] cleans up the scheduler canceller and abort listener exactly once", async () => {
    let calls = 0;
    const controller = createAbortController();
    const manual = createManualScheduler();
    const concierge = conciergeFor(
      [
        action(
          "cleanup",
          () => {
            calls += 1;
            return successful();
          },
          { effects: { readOnly: false } },
        ),
      ],
      { scheduler: manual.scheduler },
    );

    const pending = concierge.dispatch(ACTIVE_CONTEXT, "cleanup", {}, {
      signal: controller.signal,
    });
    await flushMicrotasks();
    controller.abort();
    controller.abort();
    manual.fireAll();
    const result = await pending;

    expect(
      {
        calls,
        cancelCalls: manual.cancelCalls,
        listeners: controller.listenerCount(),
        reason: result.reason,
      },
      "[RED:R30:cleanup]",
    ).toEqual({ calls: 0, cancelCalls: 1, listeners: 0, reason: "aborted" });
  });

  it("[R31] handles a scheduler that fires synchronously during registration", async () => {
    let calls = 0;
    let cancelCalls = 0;
    const delays = [];
    const controller = createAbortController();
    const scheduler = (fn, delayMs) => {
      delays.push(delayMs);
      fn();
      return () => {
        cancelCalls += 1;
      };
    };
    const concierge = conciergeFor(
      [
        action(
          "synchronous-scheduler",
          () => {
            calls += 1;
            return successful();
          },
          { effects: { readOnly: false } },
        ),
      ],
      { scheduler },
    );

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "synchronous-scheduler", {}, {
      signal: controller.signal,
    });

    expect(
      { calls, cancelCalls, delays, listeners: controller.listenerCount(), ok: result.ok },
      "[RED:R31:sync-registration-race]",
    ).toEqual({ calls: 1, cancelCalls: 0, delays: [600], listeners: 0, ok: true });
  });

  it("[R32] gives an injected scheduler precedence over the host timer", async () => {
    let calls = 0;
    let hostSchedules = 0;
    let hostCancels = 0;
    const manual = createManualScheduler();
    const realSetTimeout = globalThis.setTimeout;
    const realClearTimeout = globalThis.clearTimeout;
    globalThis.setTimeout = (() => {
      hostSchedules += 1;
      return 1;
    });
    globalThis.clearTimeout = (() => {
      hostCancels += 1;
    });

    let result;
    try {
      const concierge = conciergeFor(
        [
          action(
            "injected",
            () => {
              calls += 1;
              return successful();
            },
            { effects: { readOnly: false } },
          ),
        ],
        { scheduler: manual.scheduler },
      );
      const pending = concierge.dispatch(ACTIVE_CONTEXT, "injected", {});
      await flushMicrotasks();
      manual.fireAll();
      result = await pending;
    } finally {
      globalThis.setTimeout = realSetTimeout;
      globalThis.clearTimeout = realClearTimeout;
    }

    expect(
      { calls, hostCancels, hostSchedules, injectedDelays: manual.delays, ok: result.ok },
      "[RED:R32:injected-scheduler]",
    ).toEqual({ calls: 1, hostCancels: 0, hostSchedules: 0, injectedDelays: [600], ok: true });
  });

  it("[R33] warns once and runs immediately when no timer capability exists", async () => {
    let calls = 0;
    const warnings = [];
    const realSetTimeout = globalThis.setTimeout;
    const realClearTimeout = globalThis.clearTimeout;
    const realWarn = console.warn;
    globalThis.setTimeout = undefined;
    globalThis.clearTimeout = undefined;
    console.warn = (...args) => {
      warnings.push(args.map(String).join(" "));
    };

    let first;
    let second;
    try {
      const concierge = conciergeFor([
        action(
          "timerless",
          () => {
            calls += 1;
            return successful();
          },
          { effects: { readOnly: false } },
        ),
      ]);
      first = await concierge.dispatch(ACTIVE_CONTEXT, "timerless", { call: 1 });
      second = await concierge.dispatch(ACTIVE_CONTEXT, "timerless", { call: 2 });
    } finally {
      globalThis.setTimeout = realSetTimeout;
      globalThis.clearTimeout = realClearTimeout;
      console.warn = realWarn;
    }

    expect(
      { calls, firstOk: first.ok, secondOk: second.ok, warnings: warnings.length },
      "[RED:R33:timer-fallback]",
    ).toEqual({ calls: 2, firstOk: true, secondOk: true, warnings: 1 });
  });

  it("[R34] contains a synchronous handler throw behind a generic result", async () => {
    const concierge = conciergeFor([
      action("sync-throw", () => {
        throw new Error("private sync detail");
      }),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "sync-throw", {});

    expect(result, "[RED:R34:sync-handler-throw]").toEqual({
      ok: false,
      reason: "handler_error",
      message: "Something went wrong.",
    });
  });

  it("[R35] contains a rejected handler Promise behind a generic result", async () => {
    const concierge = conciergeFor([
      action("reject", () => Promise.reject(new Error("private async detail"))),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "reject", {});

    expect(result, "[RED:R35:handler-rejection]").toEqual({
      ok: false,
      reason: "handler_error",
      message: "Something went wrong.",
    });
  });

  it("[R36] keeps an exception marker out of results and diagnostic channels", async () => {
    const secret = "DISPATCH_SECRET_7f14b31a";
    const channels = [];
    const realWarn = console.warn;
    const realError = console.error;
    const realLog = console.log;
    console.warn = (...args) => channels.push(args.map(String).join(" "));
    console.error = (...args) => channels.push(args.map(String).join(" "));
    console.log = (...args) => channels.push(args.map(String).join(" "));

    let result;
    try {
      const concierge = conciergeFor([
        action("secret-throw", () => {
          throw new Error(secret);
        }),
      ]);
      result = await concierge.dispatch(ACTIVE_CONTEXT, "secret-throw", {});
    } finally {
      console.warn = realWarn;
      console.error = realError;
      console.log = realLog;
    }

    expect(
      {
        channelsContainSecret: channels.join("\n").includes(secret),
        message: result.message,
        reason: result.reason,
        resultContainsSecret: JSON.stringify(result).includes(secret),
      },
      "[RED:R36:exception-marker-absence]",
    ).toEqual({
      channelsContainSecret: false,
      message: "Something went wrong.",
      reason: "handler_error",
      resultContainsSecret: false,
    });
  });

  it("[R37] normalizes malformed scalar and null handler returns", async () => {
    const concierge = conciergeFor([
      action("scalar", () => 42),
      action("null", () => null),
    ]);

    const results = await Promise.all([
      concierge.dispatch(ACTIVE_CONTEXT, "scalar", {}),
      concierge.dispatch(ACTIVE_CONTEXT, "null", {}),
    ]);

    expect(results, "[RED:R37:malformed-result]").toEqual([
      {
        ok: false,
        reason: "invalid_result",
        message: "The action returned an invalid result.",
      },
      {
        ok: false,
        reason: "invalid_result",
        message: "The action returned an invalid result.",
      },
    ]);
  });

  it("[R38] normalizes an unknown reason code", async () => {
    const concierge = conciergeFor([
      action("unknown-reason", () => ({ ok: false, reason: "other", message: "No." })),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "unknown-reason", {});

    expect(result, "[RED:R38:unknown-reason]").toEqual({
      ok: false,
      reason: "invalid_result",
      message: "The action returned an invalid result.",
    });
  });

  it("[R39] normalizes a result whose message is not a string", async () => {
    const concierge = conciergeFor([
      action("numeric-message", () => ({ ok: true, message: 17 })),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "numeric-message", {});

    expect(result, "[RED:R39:nonstring-message]").toEqual({
      ok: false,
      reason: "invalid_result",
      message: "The action returned an invalid result.",
    });
  });

  it("[R40] contains a throwing result getter as an invalid result", async () => {
    const hostile = {};
    Object.defineProperty(hostile, "ok", {
      enumerable: true,
      get() {
        throw new Error("getter detail must stay private");
      },
    });
    const concierge = conciergeFor([action("throwing-getter", () => hostile)]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "throwing-getter", {});

    expect(result, "[RED:R40:throwing-getter]").toEqual({
      ok: false,
      reason: "invalid_result",
      message: "The action returned an invalid result.",
    });
  });

  it("[R41] contains a throwing result proxy as an invalid result", async () => {
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error("proxy detail must stay private");
        },
      },
    );
    const concierge = conciergeFor([action("throwing-proxy", () => hostile)]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "throwing-proxy", {});

    expect(result, "[RED:R41:throwing-proxy]").toEqual({
      ok: false,
      reason: "invalid_result",
      message: "The action returned an invalid result.",
    });
  });

  it("[R42] strips extra fields from a valid handler result", async () => {
    const concierge = conciergeFor([
      action("extra-field", () => ({ ok: true, message: "Done.", privateToken: "do-not-forward" })),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "extra-field", {});

    expect(
      { keys: Object.keys(result).sort(), result },
      "[RED:R42:extra-field-stripping]",
    ).toEqual({ keys: ["message", "ok"], result: { ok: true, message: "Done." } });
  });

  it("[R43] strips a contradictory reason from success and warns once", async () => {
    const warnings = [];
    const realWarn = console.warn;
    console.warn = (...args) => warnings.push(args.map(String).join(" "));

    let first;
    let second;
    try {
      const concierge = conciergeFor([
        action("success-contradiction", () => ({
          ok: true,
          reason: "handler_error",
          message: "Completed.",
        })),
      ]);
      first = await concierge.dispatch(ACTIVE_CONTEXT, "success-contradiction", { call: 1 });
      second = await concierge.dispatch(ACTIVE_CONTEXT, "success-contradiction", { call: 2 });
    } finally {
      console.warn = realWarn;
    }

    expect(
      { first, second, warnings: warnings.length },
      "[RED:R43:success-contradiction]",
    ).toEqual({
      first: { ok: true, message: "Completed." },
      second: { ok: true, message: "Completed." },
      warnings: 1,
    });
  });

  it("[R44] preserves a reasonless failure and warns once", async () => {
    const warnings = [];
    const realWarn = console.warn;
    console.warn = (...args) => warnings.push(args.map(String).join(" "));

    let first;
    let second;
    try {
      const concierge = conciergeFor([
        action("failure-contradiction", () => ({ ok: false, message: "Could not finish." })),
      ]);
      first = await concierge.dispatch(ACTIVE_CONTEXT, "failure-contradiction", { call: 1 });
      second = await concierge.dispatch(ACTIVE_CONTEXT, "failure-contradiction", { call: 2 });
    } finally {
      console.warn = realWarn;
    }

    expect(
      { first, second, warnings: warnings.length },
      "[RED:R44:failure-contradiction]",
    ).toEqual({
      first: { ok: false, message: "Could not finish." },
      second: { ok: false, message: "Could not finish." },
      warnings: 1,
    });
  });

  it("[R45] accepts every member of the closed twelve-reason vocabulary", async () => {
    const reasons = [
      "declined",
      "cancelled",
      "superseded",
      "invalid_args",
      "invalid_result",
      "unknown_action",
      "no_bridge",
      "handler_error",
      "aborted",
      "consent_required",
      "consent_stale",
      "grade_unavailable",
    ];
    const concierge = conciergeFor(
      reasons.map((reason) =>
        action(`reason-${reason}`, () => ({ ok: false, reason, message: `Result: ${reason}` })),
      ),
    );

    const results = await Promise.all(
      reasons.map((reason) => concierge.dispatch(ACTIVE_CONTEXT, `reason-${reason}`, {})),
    );

    expect(
      results.map((result) => result.reason),
      "[RED:R45:all-reasons]",
    ).toEqual(reasons);
  });

  it("[R46] passes one handler context with ack explicitly undefined", async () => {
    let contextShape;
    const concierge = conciergeFor([
      action("context-shape", (ctx) => {
        contextShape = {
          ack: ctx.ack,
          args: ctx.args,
          hasAck: Object.hasOwn(ctx, "ack"),
          meta: ctx.meta,
        };
        return successful();
      }),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "context-shape", { value: 7 }, {
      responseId: "response-1",
    });

    expect(
      { contextShape, ok: result.ok },
      "[RED:R46:ack-undefined]",
    ).toEqual({
      contextShape: {
        ack: undefined,
        args: { value: 7 },
        hasAck: true,
        meta: { responseId: "response-1" },
      },
      ok: true,
    });
  });

  it("[R47] replaces C0 and C1 controls in handler messages", async () => {
    const concierge = conciergeFor([
      action("controls", () => successful("  Hello\u0000\tworld\u001f\nfrom\u007f concierge  ")),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "controls", {});

    expect(result, "[RED:R47:control-stripping]").toEqual({
      ok: true,
      message: "Hello world from concierge",
    });
  });

  it("[R48] collapses and trims whitespace in handler messages", async () => {
    const concierge = conciergeFor([
      action("whitespace", () => successful("  one\t\t two \n three \r\n  ")),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "whitespace", {});

    expect(result, "[RED:R48:whitespace-collapse]").toEqual({
      ok: true,
      message: "one two three",
    });
  });

  it("[R49] applies the shared MESSAGE_MAX_CHARS bound", async () => {
    const original = "x".repeat(MESSAGE_MAX_CHARS + 50);
    const concierge = conciergeFor([action("bounded", () => successful(original))]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "bounded", {});

    expect(
      { bound: MESSAGE_MAX_CHARS, length: result.message.length, message: result.message },
      "[RED:R49:shared-bound]",
    ).toEqual({
      bound: MESSAGE_MAX_CHARS,
      length: MESSAGE_MAX_CHARS,
      message: original.slice(0, MESSAGE_MAX_CHARS),
    });
  });

  it("[R50] cuts before a surrogate pair that crosses the message bound", async () => {
    const prefix = "a".repeat(MESSAGE_MAX_CHARS - 1);
    const concierge = conciergeFor([
      action("surrogate", () => successful(`${prefix}😀trailing`)),
    ]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "surrogate", {});
    const lastCodeUnit = result.message.charCodeAt(result.message.length - 1);

    expect(
      {
        length: result.message.length,
        message: result.message,
        wellFormedTail: !(lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff),
      },
      "[RED:R50:surrogate-cut]",
    ).toEqual({ length: MESSAGE_MAX_CHARS - 1, message: prefix, wellFormedTail: true });
  });

  it("[R51] returns sanitized fresh copies of cancelled and declined constants", async () => {
    const concierge = conciergeFor([
      action("cancelled", () => USER_CANCELLED),
      action("declined", () => USER_DECLINED),
    ]);

    const cancelled = await concierge.dispatch(ACTIVE_CONTEXT, "cancelled", {});
    const declined = await concierge.dispatch(ACTIVE_CONTEXT, "declined", {});

    expect(
      {
        cancelled,
        cancelledFresh: cancelled !== USER_CANCELLED,
        declined,
        declinedFresh: declined !== USER_DECLINED,
        separateResults: cancelled !== declined,
      },
      "[RED:R51:cancelled-declined-copy]",
    ).toEqual({
      cancelled: { ok: false, reason: "cancelled", message: "Cancelled." },
      cancelledFresh: true,
      declined: { ok: false, reason: "declined", message: "Okay, I won't do that." },
      declinedFresh: true,
      separateResults: true,
    });
  });

  it("[R52] hands the handler the mounted live bridge object", async () => {
    const backing = { value: "first" };
    const liveBridge = {
      actions: {},
      get value() {
        return backing.value;
      },
    };
    const registry = createBridge("active");
    registry.register(liveBridge);
    backing.value = "latest";
    let received;
    const concierge = conciergeFor(
      [
        action("live-bridge", ({ bridge }) => {
          received = bridge;
          return successful(bridge.value);
        }),
      ],
      { bridge: registry },
    );

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "live-bridge", {});

    expect(
      { message: result.message, receivedExactObject: received === liveBridge },
      "[RED:R52:live-bridge]",
    ).toEqual({ message: "latest", receivedExactObject: true });
  });

  it("[R53] hands null to a handler when its bridge is absent", async () => {
    let received = "not-called";
    const registry = createBridge("active");
    const concierge = conciergeFor(
      [
        action("absent-bridge", ({ bridge }) => {
          received = bridge;
          return offPageResult("The selected rows", "results page");
        }),
      ],
      { bridge: registry },
    );

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "absent-bridge", {});

    expect(
      { received, result },
      "[RED:R53:absent-bridge]",
    ).toEqual({
      received: null,
      result: offPageResult("The selected rows", "results page"),
    });
  });

  it("[R54] treats a throwing bridge read as an absent bridge", async () => {
    let received = "not-called";
    const registry = {
      id: "active",
      read() {
        throw new Error("private bridge detail");
      },
      register() {
        return () => {};
      },
    };
    const concierge = conciergeFor(
      [
        action("throwing-bridge", ({ bridge }) => {
          received = bridge;
          return offPageResult("The selected rows", "results page");
        }),
      ],
      { bridge: registry },
    );

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "throwing-bridge", {});

    expect(
      { received, result },
      "[RED:R54:throwing-bridge-read]",
    ).toEqual({
      received: null,
      result: offPageResult("The selected rows", "results page"),
    });
  });

  it("[R55] snapshots stage routing, authorization, and bridge selection at construction", async () => {
    const originalBridge = createBridge("original");
    const replacementBridge = createBridge("replacement");
    const mounted = { actions: {}, snapshot: {} };
    originalBridge.register(mounted);

    let receivedBridge;
    let safeCalls = 0;
    let otherCalls = 0;
    const safe = action("safe-stage-action", ({ bridge }) => {
      safeCalls += 1;
      receivedBridge = bridge;
      return successful();
    });
    const other = action("other-stage-action", () => {
      otherCalls += 1;
      return successful();
    });
    const firstStage = {
      id: "first",
      match: (ctx) => ctx.pathname === "/first",
      actions: [safe],
      bridge: originalBridge,
    };
    const secondStage = {
      id: "second",
      match: (ctx) => ctx.pathname === "/second",
      actions: [other],
    };
    const sourceStages = [firstStage, secondStage];
    const concierge = createConcierge({ stages: sourceStages });

    sourceStages.reverse();
    firstStage.id = "rewritten";
    firstStage.match = () => false;
    firstStage.actions = [other];
    firstStage.bridge = replacementBridge;
    secondStage.match = () => true;

    const ctx = { pathname: "/first" };
    const safeResult = await concierge.dispatch(ctx, "safe-stage-action", {});
    const otherResult = await concierge.dispatch(ctx, "other-stage-action", {});

    expect(
      {
        bridge: receivedBridge,
        catalog: concierge.catalogFor(ctx).map((tool) => tool.name),
        explanation: concierge.explain(ctx),
        otherCalls,
        otherReason: otherResult.reason,
        safeCalls,
        safeOk: safeResult.ok,
        stage: concierge.stageFor(ctx),
      },
      "[RED:R55:stage-snapshot]",
    ).toEqual({
      bridge: mounted,
      catalog: ["safe-stage-action"],
      explanation: {
        stage: "first",
        stages: [
          { id: "first", matched: true, bridge: { id: "original", registered: true } },
          { id: "second", matched: false, bridge: null },
        ],
        catalog: ["safe-stage-action"],
      },
      otherCalls: 0,
      otherReason: "unknown_action",
      safeCalls: 1,
      safeOk: true,
      stage: "first",
    });
  });

  it("[R56] authorizes every retry before consulting a stage-scoped cache", async () => {
    let localCalls = 0;
    let sharedCalls = 0;
    let matcherCalls = 0;
    const local = action("local", () => {
      localCalls += 1;
      return successful("local");
    });
    const shared = action("shared", () => {
      sharedCalls += 1;
      return successful("shared");
    });
    const concierge = createConcierge({
      stages: [
        {
          id: "a",
          match: (ctx) => {
            matcherCalls += 1;
            return ctx.pathname === "/a";
          },
          actions: [local],
        },
        { id: "b", match: (ctx) => ctx.pathname === "/b", actions: [] },
      ],
      crossStage: [shared],
    });

    const allowed = concierge.dispatch({ pathname: "/a" }, "local", {}, { callId: "replay" });
    const cachedAllowed = concierge.dispatch(
      { pathname: "/a" },
      "local",
      {},
      { callId: "replay" },
    );
    const forbidden = await concierge.dispatch(
      { pathname: "/b" },
      "local",
      {},
      { callId: "replay" },
    );
    const poisoned = await concierge.dispatch(
      { pathname: "/b" },
      "local",
      {},
      { callId: "later-valid" },
    );
    const laterValid = await concierge.dispatch(
      { pathname: "/a" },
      "local",
      {},
      { callId: "later-valid" },
    );
    await concierge.dispatch({ pathname: "/a" }, "shared", { value: 1 });
    await concierge.dispatch({ pathname: "/b" }, "shared", { value: 1 });

    expect(
      {
        allowed: await allowed,
        cachedIdentity: allowed === cachedAllowed,
        forbiddenReason: forbidden.reason,
        laterValid,
        localCalls,
        matcherCalls,
        poisonedReason: poisoned.reason,
        sharedCalls,
      },
      "[RED:R56:authorize-before-cache]",
    ).toEqual({
      allowed: { ok: true, message: "local" },
      cachedIdentity: true,
      forbiddenReason: "unknown_action",
      laterValid: { ok: true, message: "local" },
      localCalls: 2,
      matcherCalls: 7,
      poisonedReason: "unknown_action",
      sharedCalls: 2,
    });
  });

  it("[R57] detaches validated arguments and metadata before the commit wait", async () => {
    const manual = createManualScheduler();
    const originalSignal = createAbortController().signal;
    const replacementSignal = createAbortController(true).signal;
    const originalHook = () => {};
    const replacementHook = () => {};
    const args = { amount: 10, nested: { currency: "USD" } };
    const meta = {
      responseId: "original-response",
      userTurnId: "original-turn",
      callId: "original-call",
      outputIndex: 3,
      signal: originalSignal,
      deferUntilDelivered: originalHook,
    };
    let validatedInput;
    let received;
    const concierge = conciergeFor(
      [
        action(
          "snapshot-invocation",
          (context) => {
            received = context;
            return successful();
          },
          {
            effects: { readOnly: false },
            validate: (value) => {
              validatedInput = value;
              return { value };
            },
          },
        ),
      ],
      { scheduler: manual.scheduler },
    );

    const pending = concierge.dispatch(ACTIVE_CONTEXT, "snapshot-invocation", args, meta);
    args.amount = 999;
    args.nested.currency = "REWRITTEN";
    meta.responseId = "rewritten-response";
    meta.userTurnId = "rewritten-turn";
    meta.callId = "rewritten-call";
    meta.outputIndex = 99;
    meta.signal = replacementSignal;
    meta.deferUntilDelivered = replacementHook;
    const retry = concierge.dispatch(
      ACTIVE_CONTEXT,
      "snapshot-invocation",
      { amount: 10, nested: { currency: "USD" } },
      { callId: "original-call" },
    );

    await flushMicrotasks();
    manual.fireAll();
    const result = await pending;

    expect(
      {
        args: received.args,
        argsDetachedBeforeValidation: validatedInput !== args,
        argsFrozen: Object.isFrozen(received.args) && Object.isFrozen(received.args.nested),
        meta: received.meta,
        metaFrozen: Object.isFrozen(received.meta),
        result,
        retryIdentity: retry === pending,
      },
      "[RED:R57:invocation-snapshot]",
    ).toEqual({
      args: { amount: 10, nested: { currency: "USD" } },
      argsDetachedBeforeValidation: true,
      argsFrozen: true,
      meta: {
        responseId: "original-response",
        userTurnId: "original-turn",
        callId: "original-call",
        outputIndex: 3,
        signal: originalSignal,
        deferUntilDelivered: originalHook,
      },
      metaFrozen: true,
      result: { ok: true, message: "Done." },
      retryIdentity: true,
    });
  });

  it("[R58] snapshots effect hints and the injected scheduler at construction", async () => {
    const original = createManualScheduler();
    const replacement = createManualScheduler();
    let readOnly = false;
    let handlerCalls = 0;
    const effects = {
      get readOnly() {
        return readOnly;
      },
    };
    const config = {
      stages: [
        {
          id: "active",
          match: (ctx) => ctx.pathname === ACTIVE_CONTEXT.pathname,
          actions: [
            action(
              "fixed-effects",
              () => {
                handlerCalls += 1;
                return successful();
              },
              { effects },
            ),
          ],
        },
      ],
      scheduler: original.scheduler,
    };
    const concierge = createConcierge(config);

    readOnly = true;
    config.scheduler = replacement.scheduler;
    const pending = concierge.dispatch(ACTIVE_CONTEXT, "fixed-effects", {});
    await flushMicrotasks();

    expect(
      {
        handlerCalls,
        originalDelays: original.delays,
        replacementDelays: replacement.delays,
      },
      "[RED:R58:fixed-effects-and-scheduler-before-release]",
    ).toEqual({
      handlerCalls: 0,
      originalDelays: [600],
      replacementDelays: [],
    });

    original.fireAll();
    expect(await pending).toEqual({ ok: true, message: "Done." });
    expect(handlerCalls).toBe(1);

    const unreadableEffects = {};
    Object.defineProperty(unreadableEffects, "readOnly", {
      enumerable: true,
      get() {
        throw new Error("PRIVATE-EFFECT-DETAIL");
      },
    });
    expect(
      () => conciergeFor([action("unreadable-effects", () => successful(), {
        effects: unreadableEffects,
      })]),
      "[RED:R58:throwing-effects-configuration]",
    ).toThrow("Invalid Concierge configuration: an action's effects could not be read.");
  });

  it("[R59] aborts after bridge resolution and before handler entry", async () => {
    const controller = createAbortController();
    let handlerCalls = 0;
    const registry = {
      id: "aborting-bridge",
      read() {
        controller.abort();
        return { actions: {}, snapshot: {} };
      },
      register() {
        return () => {};
      },
    };
    const concierge = conciergeFor(
      [
        action("bridge-abort", () => {
          handlerCalls += 1;
          return successful();
        }),
      ],
      { bridge: registry },
    );

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "bridge-abort", {}, {
      signal: controller.signal,
    });

    expect(
      { handlerCalls, listenerCount: controller.listenerCount(), result },
      "[RED:R59:abort-during-bridge-read]",
    ).toEqual({
      handlerCalls: 0,
      listenerCount: 0,
      result: {
        ok: false,
        reason: "aborted",
        message: "The action was cancelled before it ran.",
      },
    });
  });

  it("[R60] assimilates cross-realm Promises and interoperable thenables", async () => {
    const crossRealmPromise = runInNewContext(
      'Promise.resolve({ ok: true, message: "cross realm" })',
    );
    const thenable = {
      then(resolve) {
        resolve({ ok: true, message: "thenable" });
      },
    };
    const concierge = conciergeFor([
      action("cross-realm", () => crossRealmPromise),
      action("thenable", () => thenable),
    ]);

    const [crossRealmResult, thenableResult] = await Promise.all([
      concierge.dispatch(ACTIVE_CONTEXT, "cross-realm", {}),
      concierge.dispatch(ACTIVE_CONTEXT, "thenable", {}),
    ]);

    expect(
      { crossRealmResult, thenableResult },
      "[RED:R60:promise-assimilation]",
    ).toEqual({
      crossRealmResult: { ok: true, message: "cross realm" },
      thenableResult: { ok: true, message: "thenable" },
    });
  });

  it("[R61] accepts zero windows and rejects invalid timing configuration", async () => {
    const manual = createManualScheduler();
    const zeroWindow = conciergeFor(
      [action("zero-window", () => successful(), { effects: { readOnly: false } })],
      { commitWindowMs: 0, dedupeWindowMs: 0, scheduler: manual.scheduler },
    );
    const pending = zeroWindow.dispatch(ACTIVE_CONTEXT, "zero-window", {});
    await flushMicrotasks();

    expect(manual.delays, "[RED:R61:zero-window]").toEqual([0]);
    manual.fireAll();
    expect(await pending).toEqual({ ok: true, message: "Done." });

    for (const field of ["commitWindowMs", "dedupeWindowMs"]) {
      for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        expect(
          () => conciergeFor([], { [field]: value }),
          `[RED:R61:${field}:${String(value)}]`,
        ).toThrow(
          `Invalid Concierge configuration: ${field} must be a finite, non-negative number.`,
        );
      }
    }
  });

  it("[R62] contains absent and hostile console warning sinks", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "console");
    if (originalDescriptor === undefined) {
      throw new Error("The test host must expose a restorable console descriptor.");
    }

    const throwingWarnGetter = {};
    Object.defineProperty(throwingWarnGetter, "warn", {
      get() {
        throw new Error("broken warn getter");
      },
    });
    const scenarios = [
      { name: "absent", descriptor: { value: undefined } },
      { name: "missing", descriptor: { value: {} } },
      { name: "noncallable", descriptor: { value: { warn: 42 } } },
      {
        name: "throwing-call",
        descriptor: {
          value: {
            warn() {
              throw new Error("broken console");
            },
          },
        },
      },
      { name: "throwing-warn-getter", descriptor: { value: throwingWarnGetter } },
      {
        name: "throwing-console-getter",
        descriptor: {
          get() {
            throw new Error("broken console getter");
          },
        },
      },
    ];
    const outcomes = [];

    for (const scenario of scenarios) {
      const concierge = createConcierge({
        stages: [
          {
            id: `hostile-${scenario.name}`,
            match() {
              throw new Error("private matcher detail");
            },
            actions: [action("diagnostic", () => successful())],
          },
        ],
      });
      Object.defineProperty(globalThis, "console", {
        configurable: true,
        ...scenario.descriptor,
      });
      try {
        const result = await concierge.dispatch(ACTIVE_CONTEXT, "diagnostic", {});
        outcomes.push({ name: scenario.name, reason: result.reason });
      } catch {
        outcomes.push({ name: scenario.name, reason: "escaped" });
      } finally {
        Object.defineProperty(globalThis, "console", originalDescriptor);
      }
    }

    expect(outcomes, "[RED:R62:total-warning-sink]").toEqual(
      scenarios.map((scenario) => ({
        name: scenario.name,
        reason: "unknown_action",
      })),
    );
  });

  it("[R63] retains the construction-time validator after schema capability replacement", async () => {
    let handlerCalls = 0;
    const standard = {
      version: 1,
      vendor: "concierge-captured-validator-test",
      expected: "allowed",
      validate(value) {
        return value?.token === this.expected
          ? { value }
          : { issues: [{ message: "invalid token" }] };
      },
    };
    const schema = { "~standard": standard };
    const declared = action("captured-validator", () => {
      handlerCalls += 1;
      return successful();
    });
    declared.schema = schema;
    const concierge = conciergeFor([declared]);

    const valid = await concierge.dispatch(
      ACTIVE_CONTEXT,
      "captured-validator",
      { token: "allowed" },
      { callId: "captured-valid" },
    );
    standard.validate = (value) => ({ value });
    const afterValidateReplacement = await concierge.dispatch(
      ACTIVE_CONTEXT,
      "captured-validator",
      { token: "denied" },
      { callId: "captured-validate-replaced" },
    );
    schema["~standard"] = {
      version: 1,
      vendor: "replacement",
      validate: (value) => ({ value }),
    };
    const afterStandardReplacement = await concierge.dispatch(
      ACTIVE_CONTEXT,
      "captured-validator",
      { token: "denied" },
      { callId: "captured-standard-replaced" },
    );

    expect(
      {
        afterStandardReplacement,
        afterValidateReplacement,
        handlerCalls,
        valid,
      },
      "[RED:R63:captured-validator-capability]",
    ).toEqual({
      afterStandardReplacement: {
        ok: false,
        reason: "invalid_args",
        message: "The action arguments are invalid.",
      },
      afterValidateReplacement: {
        ok: false,
        reason: "invalid_args",
        message: "The action arguments are invalid.",
      },
      handlerCalls: 1,
      valid: { ok: true, message: "Done." },
    });
  });

  it("[R64] publishes a pending retry before a validator can reenter dispatch", async () => {
    let concierge;
    let reentrantPromise;
    let handlerCalls = 0;
    let validatorCalls = 0;
    const meta = { callId: "validator-reentry" };
    const declared = action(
      "validator-reentry",
      () => {
        handlerCalls += 1;
        return successful();
      },
      {
        validate: (value) => {
          validatorCalls += 1;
          reentrantPromise ??= concierge.dispatch(
            ACTIVE_CONTEXT,
            "validator-reentry",
            value,
            meta,
          );
          return { value };
        },
      },
    );
    concierge = conciergeFor([declared]);

    const first = concierge.dispatch(
      ACTIVE_CONTEXT,
      "validator-reentry",
      { value: 1 },
      meta,
    );
    const result = await first;

    expect(
      {
        handlerCalls,
        promiseIdentity: first === reentrantPromise,
        result,
        validatorCalls,
      },
      "[RED:R64:validator-reentrancy-dedup]",
    ).toEqual({
      handlerCalls: 1,
      promiseIdentity: true,
      result: { ok: true, message: "Done." },
      validatorCalls: 1,
    });
  });

  it("[R65] freezes a cached result so one caller cannot poison a retry", async () => {
    let handlerCalls = 0;
    const concierge = conciergeFor([
      action("immutable-result", () => {
        handlerCalls += 1;
        return successful("original result");
      }),
    ]);
    const meta = { callId: "immutable-result-call" };

    const firstPromise = concierge.dispatch(
      ACTIVE_CONTEXT,
      "immutable-result",
      {},
      meta,
    );
    const first = await firstPromise;
    let rejectedWrites = 0;
    for (const write of [
      () => {
        first.ok = false;
      },
      () => {
        first.reason = "handler_error";
      },
      () => {
        first.message = "\u001b[31mpoisoned";
      },
    ]) {
      try {
        write();
      } catch {
        rejectedWrites += 1;
      }
    }

    const retryPromise = concierge.dispatch(
      ACTIVE_CONTEXT,
      "immutable-result",
      {},
      meta,
    );
    const retry = await retryPromise;

    expect(
      {
        frozen: Object.isFrozen(first),
        handlerCalls,
        promiseIdentity: firstPromise === retryPromise,
        rejectedWrites,
        resultIdentity: first === retry,
        retry,
      },
      "[RED:R65:immutable-cached-result]",
    ).toEqual({
      frozen: true,
      handlerCalls: 1,
      promiseIdentity: true,
      rejectedWrites: 3,
      resultIdentity: true,
      retry: { ok: true, message: "original result" },
    });
  });
