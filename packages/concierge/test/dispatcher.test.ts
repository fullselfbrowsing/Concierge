import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const ACTIVE_CONTEXT = { pathname: "/active" };

let createConcierge;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the dispatcher suite.",
    );
  }

  const artifact = await import(DIST_URL.href);
  createConcierge = artifact.createConcierge;
});

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

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
  return createConcierge({
    stages: [
      {
        id: "active",
        match: (ctx) => ctx.pathname === ACTIVE_CONTEXT.pathname,
        actions,
      },
    ],
    ...config,
  });
}

function successful(message = "Done.") {
  return { ok: true, message };
}

function createManualScheduler() {
  const delays = [];
  const pending = [];

  function scheduler(fn, delayMs) {
    const task = { cancelled: false, fn };
    delays.push(delayMs);
    pending.push(task);
    return () => {
      task.cancelled = true;
    };
  }

  function fireAll() {
    const tasks = pending.splice(0);
    for (const task of tasks) {
      if (!task.cancelled) task.fn();
    }
  }

  return { delays, fireAll, pending, scheduler };
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
    const missing = action("missing", () => successful());
    delete missing.handler;
    const concierge = conciergeFor([missing]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "missing", {});

    expect(result.reason, "[RED:R11:missing-handler]").toBe("unknown_action");
  });

  it("[R12] settles honestly when a catalog entry's handler is not callable", async () => {
    const concierge = conciergeFor([action("broken", 42)]);

    const result = await concierge.dispatch(ACTIVE_CONTEXT, "broken", {});

    expect(result.reason, "[RED:R12:noncallable-handler]").toBe("unknown_action");
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
