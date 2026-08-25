import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { beforeAll, beforeEach, expect, it as vitestIt } from "vitest";

import { dispatchV2 } from "./fixtures/v2-dispatch.js";

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

    const first = dispatchV2(concierge, ACTIVE_CONTEXT, "charge", { amount: 10 }, { callId: "call-1" });
    const second = dispatchV2(concierge, ACTIVE_CONTEXT, "charge", { amount: 10 }, { callId: "call-1" });

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

    const first = dispatchV2(concierge, ACTIVE_CONTEXT, "fail", {}, { callId: "failed-call" });
    const second = dispatchV2(concierge, ACTIVE_CONTEXT, "fail", {}, { callId: "failed-call" });

    expect(first, "[RED:R02:cached-failure]").toBe(second);
    expect((await first).reason).toBe("no_bridge");
    expect(calls).toBe(1);
  });

  it("[R03] does not invent fallback retry identity when identity is absent", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action("search", () => {
        calls += 1;
        return successful();
      }),
    ]);

    const first = dispatchV2(concierge, ACTIVE_CONTEXT, "search", { query: "hotel" });
    const second = dispatchV2(concierge, ACTIVE_CONTEXT, "search", { query: "hotel" });

    expect(first).not.toBe(second);
    await Promise.all([first, second]);
    expect(calls).toBe(2);
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

    const first = dispatchV2(concierge,
      ACTIVE_CONTEXT,
      "charge",
      args,
      { callId: `charge:${JSON.stringify(args)}` },
    );
    const second = dispatchV2(concierge, ACTIVE_CONTEXT, "charge", args);
    await Promise.all([first, second]);

    expect({ calls, same: first === second }, "[RED:R04:key-namespace-separation]").toEqual({
      calls: 2,
      same: false,
    });
  });

  it("[R05] contains cyclic arguments as invalid_args", async () => {
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
      first = dispatchV2(concierge, ACTIVE_CONTEXT, "cycle", args);
      second = dispatchV2(concierge, ACTIVE_CONTEXT, "cycle", args);
    } catch {
      threw = true;
    }
    const results = await Promise.all([first, second].filter(Boolean));

    expect({ calls, same: first === second, threw }).toEqual({
      calls: 0,
      same: false,
      threw: false,
    });
    expect(results.map((result) => result.reason)).toEqual(["invalid_args", "invalid_args"]);
  });

  it("[R06] contains BigInt arguments as invalid_args", async () => {
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
      first = dispatchV2(concierge, ACTIVE_CONTEXT, "bigint", { value: 10n });
      second = dispatchV2(concierge, ACTIVE_CONTEXT, "bigint", { value: 10n });
    } catch {
      threw = true;
    }
    const results = await Promise.all([first, second].filter(Boolean));

    expect({ calls, same: first === second, threw }).toEqual({
      calls: 0,
      same: false,
      threw: false,
    });
    expect(results.map((result) => result.reason)).toEqual(["invalid_args", "invalid_args"]);
  });

  it("[R06a] never aliases fallback keys across lossy JSON argument shapes", async () => {
    const scenarios = [
      [{}, { omitted: undefined }],
      [{ value: NaN }, { value: Number.POSITIVE_INFINITY }, { value: Number.NEGATIVE_INFINITY }, { value: null }],
      [{ value: -0 }, { value: 0 }],
      [{ values: [, "kept"] }, { values: [undefined, "kept"] }, { values: [null, "kept"] }],
    ];
    const observations = [];

    for (const [scenarioIndex, args] of scenarios.entries()) {
      let calls = 0;
      const concierge = conciergeFor([
        action(`collision-${scenarioIndex}`, () => {
          calls += 1;
          return successful();
        }),
      ]);
      const promises = args.map((value) =>
        dispatchV2(concierge, ACTIVE_CONTEXT, `collision-${scenarioIndex}`, value),
      );
      await Promise.all(promises);
      observations.push({
        calls,
        distinctPromises: new Set(promises).size,
        variants: args.length,
      });
    }

    expect(observations, "[RED:R06a:injective-fallback-keys]").toEqual([
      { calls: 2, distinctPromises: 2, variants: 2 },
      { calls: 4, distinctPromises: 4, variants: 4 },
      { calls: 2, distinctPromises: 2, variants: 2 },
      { calls: 3, distinctPromises: 3, variants: 3 },
    ]);
  });

  it("[R06b] ignores inherited toJSON hooks when deriving fallback keys", async () => {
    const observations = [];
    const prototypes = [Array.prototype, Object.prototype];

    for (const prototype of prototypes) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "toJSON");
      let calls = 0;
      try {
        Object.defineProperty(prototype, "toJSON", {
          configurable: true,
          value() {
            return "polluted";
          },
          writable: true,
        });
        const concierge = conciergeFor([
          action("pollution-safe", () => {
            calls += 1;
            return successful();
          }),
        ]);
        const first = dispatchV2(concierge,
          ACTIVE_CONTEXT,
          "pollution-safe",
          { value: 1 },
        );
        const distinct = dispatchV2(concierge,
          ACTIVE_CONTEXT,
          "pollution-safe",
          { value: 2 },
        );
        const equal = dispatchV2(concierge,
          ACTIVE_CONTEXT,
          "pollution-safe",
          { value: 1 },
        );
        await Promise.all([first, distinct, equal]);
        observations.push({
          calls,
          distinctSeparated: first !== distinct,
          equalDeduplicated: first === equal,
        });
      } finally {
        if (descriptor === undefined) {
          delete prototype.toJSON;
        } else {
          Object.defineProperty(prototype, "toJSON", descriptor);
        }
      }
    }

    expect(observations).toEqual([
      { calls: 3, distinctSeparated: true, equalDeduplicated: false },
      { calls: 3, distinctSeparated: true, equalDeduplicated: false },
    ]);
  });

  it("[R69] contains aliased graphs as invalid_args", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action("aliased", () => {
        calls += 1;
        return successful();
      }),
    ]);
    const firstShared = { value: 1 };
    const secondShared = { value: 1 };
    let first;
    let second;
    let threw = false;

    try {
      first = dispatchV2(concierge, ACTIVE_CONTEXT, "aliased", {
        left: firstShared,
        right: firstShared,
      });
      second = dispatchV2(concierge, ACTIVE_CONTEXT, "aliased", {
        left: secondShared,
        right: secondShared,
      });
    } catch {
      threw = true;
    }
    const results = await Promise.all([first, second].filter(Boolean));

    expect(
      { calls, same: first === second, threw },
      "[RED:R69:aliased-graph-no-dedup]",
    ).toEqual({ calls: 0, same: false, threw: false });
    expect(results.map((result) => result.reason)).toEqual(["invalid_args", "invalid_args"]);
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

    const first = dispatchV2(firstConcierge, ACTIVE_CONTEXT, "charge", {}, { callId: "shared" });
    const second = dispatchV2(secondConcierge, ACTIVE_CONTEXT, "charge", {}, { callId: "shared" });
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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "confirm", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "__proto__", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "constructor", {});

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
      first = await dispatchV2(concierge, ACTIVE_CONTEXT, "missing", { call: 1 });
      second = await dispatchV2(concierge, ACTIVE_CONTEXT, "missing", { call: 2 });
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
      first = await dispatchV2(concierge, ACTIVE_CONTEXT, "broken", { call: 1 });
      second = await dispatchV2(concierge, ACTIVE_CONTEXT, "broken", { call: 2 });
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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "validateSync", { bad: true });

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "validateAsync", { bad: true });

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "transform", { normalized: "no" });

    expect({ ok: result.ok, received }, "[RED:R15:transformed-value]").toEqual({
      ok: true,
      received: { normalized: "yes" },
    });
  });

  it("[R15a] rejects a transformed non-invocation-data value before the handler", async () => {
    let calls = 0;
    const concierge = conciergeFor([
      action(
        "transform-date",
        () => {
          calls += 1;
          return successful();
        },
        { validate: () => ({ value: { at: new Date("2026-08-06T00:00:00.000Z") } }) },
      ),
    ]);

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "transform-date", {});

    expect(
      { calls, reason: result.reason },
      "[RED:R15a:transformed-output-boundary]",
    ).toEqual({ calls: 0, reason: "invalid_args" });
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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "issues", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "validatorThrow", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "validatorReject", {});

    expect({ calls, reason: result.reason }, "[RED:R18:validator-rejection]").toEqual({
      calls: 0,
      reason: "invalid_args",
    });
  });

  it("[R18a] accepts only structurally valid Standard Schema result branches", async () => {
    const calls = {
      empty: 0,
      issuesUndefined: 0,
      standardSuccess: 0,
      valueUndefined: 0,
      valueAccessor: 0,
    };
    const received = { standardSuccess: "not-called", valueUndefined: "not-called" };
    let valueAccessorReads = 0;
    const throwingValue = {};
    Object.defineProperty(throwingValue, "value", {
      enumerable: true,
      get() {
        valueAccessorReads += 1;
        throw new Error("PRIVATE-VALIDATOR-VALUE-GETTER");
      },
    });
    const concierge = conciergeFor([
      action("empty-result", () => { calls.empty += 1; return successful(); }, { validate: () => ({}) }),
      action("issues-undefined", () => { calls.issuesUndefined += 1; return successful(); }, { validate: () => ({ issues: undefined }) }),
      action("standard-success", ({ args }) => {
        calls.standardSuccess += 1;
        received.standardSuccess = args;
        return successful();
      }, {
        validate: () => ({
          value: { normalized: "from-standard-schema" },
          issues: undefined,
        }),
      }),
      action("value-undefined", ({ args }) => {
        calls.valueUndefined += 1;
        received.valueUndefined = args;
        return successful();
      }, { validate: () => ({ value: undefined }) }),
      action("throwing-value", () => { calls.valueAccessor += 1; return successful(); }, { validate: () => throwingValue }),
    ]);

    const [empty, issuesUndefined, standardSuccess, valueUndefined, valueAccessor] = await Promise.all([
      dispatchV2(concierge, ACTIVE_CONTEXT, "empty-result", {}),
      dispatchV2(concierge, ACTIVE_CONTEXT, "issues-undefined", {}),
      dispatchV2(concierge, ACTIVE_CONTEXT, "standard-success", {}),
      dispatchV2(concierge, ACTIVE_CONTEXT, "value-undefined", {}),
      dispatchV2(concierge, ACTIVE_CONTEXT, "throwing-value", {}),
    ]);

    expect(
      {
        calls,
        reasons: [
          empty.reason,
          issuesUndefined.reason,
          standardSuccess.reason,
          valueUndefined.reason,
          valueAccessor.reason,
        ],
        received,
        valueAccessorReads,
      },
      "[RED:R18a:validator-result-discriminator]",
    ).toEqual({
      calls: {
        empty: 0,
        issuesUndefined: 0,
        standardSuccess: 1,
        valueUndefined: 1,
        valueAccessor: 0,
      },
      reasons: [
        "invalid_args",
        "invalid_args",
        undefined,
        undefined,
        "invalid_args",
      ],
      received: {
        standardSuccess: { normalized: "from-standard-schema" },
        valueUndefined: undefined,
      },
      valueAccessorReads: 1,
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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "direct", {});

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

      const first = dispatchV2(concierge, ACTIVE_CONTEXT, "window", {}, { callId: "window" });
      const pendingHit = dispatchV2(concierge, ACTIVE_CONTEXT, "window", {}, { callId: "window" });
      await flushMicrotasks();
      manual.fireAll();
      await first;

      setNow(599);
      const settledHit = dispatchV2(concierge, ACTIVE_CONTEXT, "window", {}, { callId: "window" });
      setNow(600);
      const expired = dispatchV2(concierge, ACTIVE_CONTEXT, "window", {}, { callId: "window" });
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

      const first = dispatchV2(concierge, ACTIVE_CONTEXT, "pending", {}, { callId: "pending" });
      await flushMicrotasks();
      setNow(1_200);
      const retry = dispatchV2(concierge, ACTIVE_CONTEXT, "pending", {}, { callId: "pending" });

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

      const first = dispatchV2(concierge, ACTIVE_CONTEXT, "settlement", {}, { callId: "settlement" });
      await flushMicrotasks();
      setNow(1_000);
      manual.fireAll();
      await first;

      setNow(1_599);
      const inside = dispatchV2(concierge, ACTIVE_CONTEXT, "settlement", {}, { callId: "settlement" });
      setNow(1_600);
      const outside = dispatchV2(concierge, ACTIVE_CONTEXT, "settlement", {}, { callId: "settlement" });

      expect(
        { inside: inside === first, outside: outside !== first },
        "[RED:R22:settlement-window]",
      ).toEqual({ inside: true, outside: true });
    });
  });

  it("[R22a] expires a settled retry immediately when the deduplication window is zero", async () => {
    await withFakeNow(0, async () => {
      let calls = 0;
      const concierge = conciergeFor(
        [action("zero-window", () => {
          calls += 1;
          return successful();
        })],
        { dedupeWindowMs: 0 },
      );

      const first = dispatchV2(concierge, ACTIVE_CONTEXT, "zero-window", {}, { callId: "zero" });
      const pendingHit = dispatchV2(concierge, ACTIVE_CONTEXT, "zero-window", {}, { callId: "zero" });
      await first;
      const settledRetry = dispatchV2(concierge, ACTIVE_CONTEXT, "zero-window", {}, { callId: "zero" });
      await settledRetry;

      expect(
        { calls, pendingHit: pendingHit === first, settledRetry: settledRetry !== first },
        "[RED:R22a:zero-window-expiry]",
      ).toEqual({ calls: 2, pendingHit: true, settledRetry: true });
    });
  });

  it("[R23] does not extend a settled entry's lifetime when it is read", async () => {
    await withFakeNow(0, async (setNow) => {
      const manual = createManualScheduler();
      const concierge = conciergeFor(
        [action("eviction", () => successful(), { effects: { readOnly: false } })],
        { scheduler: manual.scheduler },
      );

      const first = dispatchV2(concierge, ACTIVE_CONTEXT, "eviction", {}, { callId: "eviction" });
      await flushMicrotasks();
      manual.fireAll();
      await first;

      setNow(500);
      const accessed = dispatchV2(concierge, ACTIVE_CONTEXT, "eviction", {}, { callId: "eviction" });
      setNow(601);
      const expired = dispatchV2(concierge, ACTIVE_CONTEXT, "eviction", {}, { callId: "eviction" });

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

      const firstA = dispatchV2(concierge, ACTIVE_CONTEXT, "a", {}, { callId: "a" });
      await firstA;
      await dispatchV2(concierge, ACTIVE_CONTEXT, "b", {}, { callId: "b" });

      setNow(601);
      await dispatchV2(concierge, ACTIVE_CONTEXT, "c", {}, { callId: "c" });

      setNow(1);
      const secondA = dispatchV2(concierge, ACTIVE_CONTEXT, "a", {}, { callId: "a" });
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

    const pending = dispatchV2(concierge, ACTIVE_CONTEXT, "write", {});
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

    const pending = dispatchV2(concierge, ACTIVE_CONTEXT, "implicit-write", {});
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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "read", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "abort-before", {}, {
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

    const pending = dispatchV2(concierge, ACTIVE_CONTEXT, "abort-during", {}, {
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

    const pending = dispatchV2(concierge, ACTIVE_CONTEXT, "cleanup", {}, {
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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "synchronous-scheduler", {}, {
      signal: controller.signal,
    });

    expect(
      { calls, cancelCalls, delays, listeners: controller.listenerCount(), ok: result.ok },
      "[RED:R31:sync-registration-race]",
    ).toEqual({ calls: 1, cancelCalls: 0, delays: [600], listeners: 0, ok: true });
  });

  it("[R71] warns once when a synchronous scheduler callback precedes a malformed return", async () => {
    let calls = 0;
    const warnings = [];
    const realWarn = console.warn;
    console.warn = (...args) => warnings.push(args.map(String).join(" "));
    const scheduler = (fn) => {
      fn();
      return undefined;
    };

    let results;
    try {
      const concierge = conciergeFor(
        [
          action(
            "malformed-sync-scheduler",
            () => {
              calls += 1;
              return successful();
            },
            { effects: { readOnly: false } },
          ),
        ],
        { scheduler },
      );
      results = await Promise.all([
        dispatchV2(concierge, ACTIVE_CONTEXT, "malformed-sync-scheduler", { attempt: 1 }),
        dispatchV2(concierge, ACTIVE_CONTEXT, "malformed-sync-scheduler", { attempt: 2 }),
      ]);
    } finally {
      console.warn = realWarn;
    }

    expect(
      { calls, results, warnings },
      "[RED:R71:malformed-sync-scheduler-return]",
    ).toEqual({
      calls: 2,
      results: [
        { ok: true, message: "Done." },
        { ok: true, message: "Done." },
      ],
      warnings: [
        "concierge: [commit_window_unavailable] config \"scheduler\": no cancellable timer is available, so the commit window was skipped. Fix: provide `ConciergeConfig.scheduler` in this host.",
      ],
    });
  });

  it("[R72] warns once when a synchronous scheduler callback precedes a throw", async () => {
    let calls = 0;
    const warnings = [];
    const realWarn = console.warn;
    console.warn = (...args) => warnings.push(args.map(String).join(" "));
    const scheduler = (fn) => {
      fn();
      throw new Error("PRIVATE-SCHEDULER-REGISTRATION-THROW");
    };

    let results;
    try {
      const concierge = conciergeFor(
        [
          action(
            "throwing-sync-scheduler",
            () => {
              calls += 1;
              return successful();
            },
            { effects: { readOnly: false } },
          ),
        ],
        { scheduler },
      );
      results = await Promise.all([
        dispatchV2(concierge, ACTIVE_CONTEXT, "throwing-sync-scheduler", { attempt: 1 }),
        dispatchV2(concierge, ACTIVE_CONTEXT, "throwing-sync-scheduler", { attempt: 2 }),
      ]);
    } finally {
      console.warn = realWarn;
    }

    expect(
      { calls, results, warnings },
      "[RED:R72:throwing-sync-scheduler-registration]",
    ).toEqual({
      calls: 2,
      results: [
        { ok: true, message: "Done." },
        { ok: true, message: "Done." },
      ],
      warnings: [
        "concierge: [commit_window_unavailable] config \"scheduler\": no cancellable timer is available, so the commit window was skipped. Fix: provide `ConciergeConfig.scheduler` in this host.",
      ],
    });
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
      const pending = dispatchV2(concierge, ACTIVE_CONTEXT, "injected", {});
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
      first = await dispatchV2(concierge, ACTIVE_CONTEXT, "timerless", { call: 1 });
      second = await dispatchV2(concierge, ACTIVE_CONTEXT, "timerless", { call: 2 });
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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "sync-throw", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "reject", {});

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
      result = await dispatchV2(concierge, ACTIVE_CONTEXT, "secret-throw", {});
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
      dispatchV2(concierge, ACTIVE_CONTEXT, "scalar", {}),
      dispatchV2(concierge, ACTIVE_CONTEXT, "null", {}),
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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "unknown-reason", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "numeric-message", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "throwing-getter", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "throwing-proxy", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "extra-field", {});

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
      first = await dispatchV2(concierge, ACTIVE_CONTEXT, "success-contradiction", { call: 1 });
      second = await dispatchV2(concierge, ACTIVE_CONTEXT, "success-contradiction", { call: 2 });
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
      first = await dispatchV2(concierge, ACTIVE_CONTEXT, "failure-contradiction", { call: 1 });
      second = await dispatchV2(concierge, ACTIVE_CONTEXT, "failure-contradiction", { call: 2 });
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

  it("[R45] accepts every member of the closed sixteen-reason vocabulary", async () => {
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
      "catalog_stale",
      "invalid_invocation",
      "identity_conflict",
      "precondition_failed",
    ];
    const concierge = conciergeFor(
      reasons.map((reason) =>
        action(`reason-${reason}`, () => ({ ok: false, reason, message: `Result: ${reason}` })),
      ),
    );

    const results = await Promise.all(
      reasons.map((reason) => dispatchV2(concierge, ACTIVE_CONTEXT, `reason-${reason}`, {})),
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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "context-shape", { value: 7 }, {
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
        meta: {
          responseId: undefined,
          userTurnId: undefined,
          callId: undefined,
          outputIndex: undefined,
          signal: undefined,
          deferUntilDelivered: undefined,
        },
      },
      ok: true,
    });
  });

  it("[R47] replaces C0 and C1 controls in handler messages", async () => {
    const concierge = conciergeFor([
      action("controls", () => successful("  Hello\u0000\tworld\u001f\nfrom\u007f concierge  ")),
    ]);

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "controls", {});

    expect(result, "[RED:R47:control-stripping]").toEqual({
      ok: true,
      message: "Hello world from concierge",
    });
  });

  it("[R48] collapses and trims whitespace in handler messages", async () => {
    const concierge = conciergeFor([
      action("whitespace", () => successful("  one\t\t two \n three \r\n  ")),
    ]);

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "whitespace", {});

    expect(result, "[RED:R48:whitespace-collapse]").toEqual({
      ok: true,
      message: "one two three",
    });
  });

  it("[R49] applies the shared MESSAGE_MAX_CHARS bound", async () => {
    const original = "x".repeat(MESSAGE_MAX_CHARS + 50);
    const concierge = conciergeFor([action("bounded", () => successful(original))]);

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "bounded", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "surrogate", {});
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

    const cancelled = await dispatchV2(concierge, ACTIVE_CONTEXT, "cancelled", {});
    const declined = await dispatchV2(concierge, ACTIVE_CONTEXT, "declined", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "live-bridge", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "absent-bridge", {});

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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "throwing-bridge", {});

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
    const safeResult = await dispatchV2(concierge, ctx, "safe-stage-action", {});
    const otherResult = await dispatchV2(concierge, ctx, "other-stage-action", {});

    expect(
      {
        bridge: receivedBridge,
        catalog: concierge.resolveCatalog(ctx).tools.map((tool) => tool.name),
        explanation: concierge.explain(ctx),
        otherCalls,
        otherReason: otherResult.reason,
        safeCalls,
        safeOk: safeResult.ok,
        stage: concierge.resolveCatalog(ctx).stage,
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
        actions: [
          { name: "safe-stage-action", bridge: { id: "original", registered: true } },
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

    const allowed = dispatchV2(concierge, { pathname: "/a" }, "local", {}, { callId: "replay" });
    const cachedAllowed = dispatchV2(concierge,
      { pathname: "/a" },
      "local",
      {},
      { callId: "replay" },
    );
    const forbidden = await dispatchV2(concierge,
      { pathname: "/b" },
      "local",
      {},
      { callId: "replay" },
    );
    const poisoned = await dispatchV2(concierge,
      { pathname: "/b" },
      "local",
      {},
      { callId: "later-valid" },
    );
    const laterValid = await dispatchV2(concierge,
      { pathname: "/a" },
      "local",
      {},
      { callId: "later-valid" },
    );
    await dispatchV2(concierge, { pathname: "/a" }, "shared", { value: 1 });
    await dispatchV2(concierge, { pathname: "/b" }, "shared", { value: 1 });

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
      forbiddenReason: "identity_conflict",
      laterValid: {
        ok: false,
        reason: "identity_conflict",
        message: "The invocation identity was reused for a different call.",
      },
      localCalls: 1,
      matcherCalls: 14,
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

    const pending = dispatchV2(concierge, ACTIVE_CONTEXT, "snapshot-invocation", args, meta);
    args.amount = 999;
    args.nested.currency = "REWRITTEN";
    meta.responseId = "rewritten-response";
    meta.userTurnId = "rewritten-turn";
    meta.callId = "rewritten-call";
    meta.outputIndex = 99;
    meta.signal = replacementSignal;
    meta.deferUntilDelivered = replacementHook;
    const retry = dispatchV2(concierge,
      ACTIVE_CONTEXT,
      "snapshot-invocation",
      { amount: 10, nested: { currency: "USD" } },
      {
        callId: "original-call",
        responseId: "original-response",
        userTurnId: "original-turn",
        outputIndex: 3,
      },
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
    const pending = dispatchV2(concierge, ACTIVE_CONTEXT, "fixed-effects", {});
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

    const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "bridge-abort", {}, {
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
      dispatchV2(concierge, ACTIVE_CONTEXT, "cross-realm", {}),
      dispatchV2(concierge, ACTIVE_CONTEXT, "thenable", {}),
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
    const pending = dispatchV2(zeroWindow, ACTIVE_CONTEXT, "zero-window", {});
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
        const result = await dispatchV2(concierge, ACTIVE_CONTEXT, "diagnostic", {});
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

    const valid = await dispatchV2(concierge,
      ACTIVE_CONTEXT,
      "captured-validator",
      { token: "allowed" },
      { callId: "captured-valid" },
    );
    standard.validate = (value) => ({ value });
    const afterValidateReplacement = await dispatchV2(concierge,
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
    const afterStandardReplacement = await dispatchV2(concierge,
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
          reentrantPromise ??= dispatchV2(concierge,
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

    const first = dispatchV2(concierge,
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

    const firstPromise = dispatchV2(concierge,
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

    const retryPromise = dispatchV2(concierge,
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

  it("[R66] exposes handler arguments and metadata as immutable values", async () => {
    let observed;
    const concierge = conciergeFor([
      action(
        "readonly-handler-inputs",
        ({ args, meta }) => {
          let rejectedWrites = 0;
          for (const write of [
            () => {
              args.amount = 99;
            },
            () => {
              args.nested.currency = "rewritten";
            },
            () => {
              meta.callId = "rewritten";
            },
          ]) {
            try {
              write();
            } catch {
              rejectedWrites += 1;
            }
          }
          observed = {
            args,
            argsFrozen: Object.isFrozen(args),
            metaCallId: meta.callId,
            metaFrozen: Object.isFrozen(meta),
            nestedFrozen: Object.isFrozen(args.nested),
            rejectedWrites,
          };
          return successful();
        },
        {
          validate: () => ({
            value: { amount: 10, nested: { currency: "USD" } },
          }),
        },
      ),
    ]);

    const result = await dispatchV2(concierge,
      ACTIVE_CONTEXT,
      "readonly-handler-inputs",
      { amount: 0 },
      { callId: "readonly-handler-call" },
    );

    expect(
      { observed, result },
      "[RED:R66:readonly-handler-inputs]",
    ).toEqual({
      observed: {
        args: { amount: 10, nested: { currency: "USD" } },
        argsFrozen: true,
        metaCallId: "readonly-handler-call",
        metaFrozen: true,
        nestedFrozen: true,
        rejectedWrites: 3,
      },
      result: { ok: true, message: "Done." },
    });
  });

  it("[R67] advertises and dispatches declared prototype-spelled actions", async () => {
    const handlerCalls = [];
    const concierge = conciergeFor([
      action("constructor", () => {
        handlerCalls.push("constructor");
        return successful("constructor ran");
      }),
      action("__proto__", () => {
        handlerCalls.push("__proto__");
        return successful("__proto__ ran");
      }),
    ]);

    const publishedNames = concierge
      .resolveCatalog(ACTIVE_CONTEXT)
      .tools.map((tool) => tool.name);
    const constructorResult = await dispatchV2(concierge,
      ACTIVE_CONTEXT,
      "constructor",
      {},
      { callId: "reserved-constructor" },
    );
    const protoResult = await dispatchV2(concierge,
      ACTIVE_CONTEXT,
      "__proto__",
      {},
      { callId: "reserved-proto" },
    );

    expect(
      { constructorResult, handlerCalls, protoResult, publishedNames },
      "[RED:R67:reserved-name-consistency]",
    ).toEqual({
      constructorResult: { ok: true, message: "constructor ran" },
      handlerCalls: ["constructor", "__proto__"],
      protoResult: { ok: true, message: "__proto__ ran" },
      publishedNames: ["constructor", "__proto__"],
    });
  });

  it("[R68] contains malformed invocation metadata as one honest result", async () => {
    let handlerCalls = 0;
    const concierge = conciergeFor([
      action("malformed-metadata", () => {
        handlerCalls += 1;
        return successful();
      }),
    ]);
    const throwingMeta = {};
    Object.defineProperty(throwingMeta, "responseId", {
      enumerable: true,
      get() {
        throw new Error("PRIVATE-METADATA-GETTER");
      },
    });
    const throwingSignal = {};
    Object.defineProperty(throwingSignal, "aborted", {
      enumerable: true,
      get() {
        throw new Error("PRIVATE-SIGNAL-GETTER");
      },
    });
    const cases = [
      { name: "null-container", meta: null },
      { name: "number-container", meta: 42 },
      { name: "string-container", meta: "metadata" },
      { name: "boolean-container", meta: true },
      { name: "symbol-container", meta: Symbol("metadata") },
      { name: "symbol-callId", meta: { callId: Symbol("malformed-call") } },
      { name: "number-callId", meta: { callId: 7 } },
      { name: "number-responseId", meta: { responseId: 7 } },
      { name: "boolean-userTurnId", meta: { userTurnId: false } },
      { name: "string-outputIndex", meta: { outputIndex: "0" } },
      { name: "nan-outputIndex", meta: { outputIndex: Number.NaN } },
      { name: "infinite-outputIndex", meta: { outputIndex: Number.POSITIVE_INFINITY } },
      { name: "negative-infinite-outputIndex", meta: { outputIndex: Number.NEGATIVE_INFINITY } },
      { name: "numeric-signal", meta: { signal: 42 } },
      { name: "incomplete-signal", meta: { signal: { aborted: false } } },
      {
        name: "nonboolean-signal-state",
        meta: {
          signal: {
            aborted: "false",
            addEventListener() {},
            removeEventListener() {},
          },
        },
      },
      { name: "throwing-signal", meta: { signal: throwingSignal } },
      { name: "noncallable-delivery-hook", meta: { deferUntilDelivered: "later" } },
      { name: "throwing-getter", meta: throwingMeta },
    ];
    const observations = [];

    for (const scenario of cases) {
      let returned;
      let result;
      let rejected = false;
      let threw = false;
      try {
        returned = dispatchV2(concierge,
          ACTIVE_CONTEXT,
          "malformed-metadata",
          { scenario: scenario.name },
          scenario.meta,
        );
      } catch {
        threw = true;
      }

      if (returned !== undefined) {
        try {
          result = await returned;
        } catch {
          rejected = true;
        }
      }

      observations.push({
        frozen: result === undefined ? false : Object.isFrozen(result),
        keys: result === undefined ? [] : Object.keys(result).sort(),
        name: scenario.name,
        promise: returned instanceof Promise,
        rejected,
        result,
        threw,
      });
    }

    expect(
      { handlerCalls, observations },
      "[RED:R68:malformed-metadata-totality]",
    ).toEqual({
      handlerCalls: 0,
      observations: cases.map((scenario) => ({
        frozen: true,
        keys: ["message", "ok", "reason"],
        name: scenario.name,
        promise: true,
        rejected: false,
        result: {
          ok: false,
          reason: "invalid_invocation",
          message: "The invocation identity is invalid.",
        },
        threw: false,
      })),
    });
  });

  it("[R70] bounds invocation arrays and reads hostile length exactly once", async () => {
    const observations = [];
    let handlerCalls = 0;
    const concierge = conciergeFor([
      action("array-boundary", ({ args }) => {
        handlerCalls += 1;
        observations.push({
          length: args.items.length,
          ownZero: Object.prototype.hasOwnProperty.call(args.items, 0),
          zero: args.items[0],
        });
        return successful();
      }),
    ]);

    const symbolLength = new Proxy([], {
      get(target, property, receiver) {
        if (property === "length") return Symbol("malformed-length");
        return Reflect.get(target, property, receiver);
      },
    });
    let statefulLengthReads = 0;
    const statefulLength = new Proxy([], {
      get(target, property, receiver) {
        if (property === "length") {
          statefulLengthReads += 1;
          return statefulLengthReads === 1
            ? 0
            : Symbol("length-was-read-again");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const oversizedLength = new Proxy([], {
      get(target, property, receiver) {
        // One above dispatch.ts's documented 10,000-entry resource bound.
        if (property === "length") return 10_001;
        return Reflect.get(target, property, receiver);
      },
    });
    const inheritedEntry = new Array(1);
    const inheritedPrototype = Object.create(Array.prototype);
    Object.defineProperty(inheritedPrototype, "0", {
      configurable: true,
      value: "prototype-data",
    });
    Object.setPrototypeOf(inheritedEntry, inheritedPrototype);

    let symbolPromise;
    let symbolThrew = false;
    try {
      symbolPromise = dispatchV2(concierge,
        ACTIVE_CONTEXT,
        "array-boundary",
        { items: symbolLength },
        { callId: "symbol-array-length" },
      );
    } catch {
      symbolThrew = true;
    }

    const [symbolResult, statefulResult, oversizedResult, inheritedResult] =
      await Promise.all([
        symbolPromise,
        dispatchV2(concierge,
          ACTIVE_CONTEXT,
          "array-boundary",
          { items: statefulLength },
          { callId: "stateful-array-length" },
        ),
        dispatchV2(concierge,
          ACTIVE_CONTEXT,
          "array-boundary",
          { items: oversizedLength },
          { callId: "oversized-array-length" },
        ),
        dispatchV2(concierge,
          ACTIVE_CONTEXT,
          "array-boundary",
          { items: inheritedEntry },
          { callId: "inherited-array-entry" },
        ),
      ]);

    expect(
      {
        handlerCalls,
        inheritedResult,
        observations,
        oversizedReason: oversizedResult.reason,
        statefulLengthReads,
        statefulResult,
        symbolPromise: symbolPromise instanceof Promise,
        symbolReason: symbolResult.reason,
        symbolThrew,
      },
      "[RED:R70:bounded-prototype-safe-invocation-arrays]",
    ).toEqual({
      handlerCalls: 2,
      inheritedResult: { ok: true, message: "Done." },
      observations: [
        { length: 0, ownZero: false, zero: undefined },
        { length: 1, ownZero: false, zero: undefined },
      ],
      oversizedReason: "invalid_args",
      statefulLengthReads: 1,
      statefulResult: { ok: true, message: "Done." },
      symbolPromise: true,
      symbolReason: "invalid_args",
      symbolThrew: false,
    });
  });
