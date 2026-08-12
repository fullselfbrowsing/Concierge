import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it as vitestIt } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const ACTIVE_CONTEXT = { pathname: "/batch" };

let createConcierge;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the dispatcher batch suite.",
    );
  }

  const artifact = await import(DIST_URL.href);
  createConcierge = artifact.createConcierge;
});

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

// Vitest reports ordinary name-filter exclusions as pending. Register only the cases selected
// by a focused RED gate so the JSON report proves an exact collected set; an unfiltered run still
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
      vendor: "concierge-dispatcher-batch-test",
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
        id: "batch",
        match: (ctx) => ctx.pathname === ACTIVE_CONTEXT.pathname,
        actions,
      },
    ],
    ...config,
  });
}

function toolCall(callId, name, rawArguments, outputIndex) {
  return { callId, name, arguments: rawArguments, outputIndex };
}

function toolBatch(calls, extra = {}) {
  return { responseId: "response-batch", calls, ...extra };
}

function successful(message = "Done.") {
  return { ok: true, message };
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

function createManualScheduler() {
  const delays = [];
  const pending = [];
  let cancelCalls = 0;

  function scheduler(fn, delayMs) {
    const task = { cancelled: false, fn };
    delays.push(delayMs);
    pending.push(task);
    return () => {
      cancelCalls += 1;
      task.cancelled = true;
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
    get pendingCount() {
      return pending.length;
    },
    scheduler,
  };
}

async function flushMicrotasks() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

// These top-level cases are the logical describe("DSP-07 — transport-independent batch execution")
// suite. They intentionally remain top-level because the mandated focused selectors are anchored
// at each `[Qxx]` token; a describe prefix would make those selectors miss every case.

it("[Q01] copies a frozen caller array before ordering it", async () => {
  const entries = [];
  const concierge = conciergeFor([
    action("ordered", ({ meta }) => {
      entries.push(meta.callId);
      return successful(meta.callId);
    }),
  ]);
  const calls = Object.freeze([
    Object.freeze(toolCall("late", "ordered", JSON.stringify({ value: "late" }), 2)),
    Object.freeze(toolCall("early", "ordered", JSON.stringify({ value: "early" }), 0)),
  ]);
  const batch = toolBatch(calls);
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const rows = await concierge.dispatchBatch(ACTIVE_CONTEXT, batch);
      observed = {
        available: true,
        callerFrozen: Object.isFrozen(calls),
        callerOrder: calls.map((call) => call.callId),
        entries,
        outputOrder: rows.map((row) => row.callId),
        rejected: false,
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q01:copied-frozen-input]").toEqual({
    available: true,
    callerFrozen: true,
    callerOrder: ["late", "early"],
    entries: ["early", "late"],
    outputOrder: ["early", "late"],
    rejected: false,
  });
});

it("[Q02] orders by outputIndex and preserves caller order for ties", async () => {
  const entries = [];
  const concierge = conciergeFor([
    action("stable", ({ meta }) => {
      entries.push(meta.callId);
      return successful(meta.callId);
    }),
  ]);
  const calls = [
    toolCall("last", "stable", "{}", 3),
    toolCall("tie-a", "stable", "{}", 1),
    toolCall("first", "stable", "{}", 0),
    toolCall("tie-b", "stable", "{}", 1),
  ];
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const rows = await concierge.dispatchBatch(ACTIVE_CONTEXT, toolBatch(calls));
      observed = {
        available: true,
        callerOrder: calls.map((call) => call.callId),
        entries,
        outputOrder: rows.map((row) => row.callId),
        rejected: false,
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q02:stable-order]").toEqual({
    available: true,
    callerOrder: ["last", "tie-a", "first", "tie-b"],
    entries: ["first", "tie-a", "tie-b", "last"],
    outputOrder: ["first", "tie-a", "tie-b", "last"],
    rejected: false,
  });
});

it("[Q03] never has more than one handler active", async () => {
  let active = 0;
  let maximum = 0;
  const entries = [];
  const concierge = conciergeFor([
    action("serial", async ({ meta }) => {
      entries.push(meta.callId);
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active -= 1;
      return successful(meta.callId);
    }),
  ]);
  const calls = [
    toolCall("third", "serial", "{}", 2),
    toolCall("first", "serial", "{}", 0),
    toolCall("second", "serial", "{}", 1),
  ];
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const rows = await concierge.dispatchBatch(ACTIVE_CONTEXT, toolBatch(calls));
      observed = {
        active,
        available: true,
        entries,
        maximum,
        outputOrder: rows.map((row) => row.callId),
        rejected: false,
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q03:serial-concurrency]").toEqual({
    active: 0,
    available: true,
    entries: ["first", "second", "third"],
    maximum: 1,
    outputOrder: ["first", "second", "third"],
    rejected: false,
  });
});

it("[Q04] validates malformed JSON as an empty object and continues", async () => {
  const validated = [];
  const defaultedValidated = [];
  const handled = [];
  let defaultedHandlerEntries = 0;
  const concierge = conciergeFor([
    action(
      "parse",
      ({ args, meta }) => {
        handled.push({ args, callId: meta.callId });
        return successful(meta.callId);
      },
      {
        validate: (value) => {
          validated.push(value);
          if (
            typeof value !== "object" ||
            value === null ||
            !("value" in value)
          ) {
            return { issues: [{ message: "value is required" }] };
          }
          return { value };
        },
      },
    ),
    action(
      "parse-default",
      () => {
        defaultedHandlerEntries += 1;
        return successful("defaulted handler entered");
      },
      {
        validate: (value) => {
          defaultedValidated.push(value);
          return { value: { amount: 100 } };
        },
      },
    ),
  ]);
  const calls = [
    toolCall("malformed", "parse", "{", 0),
    toolCall("malformed-default", "parse-default", "{", 1),
    toolCall("later", "parse", JSON.stringify({ value: "later" }), 2),
  ];
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const rows = await concierge.dispatchBatch(ACTIVE_CONTEXT, toolBatch(calls));
      observed = {
        available: true,
        defaultedHandlerEntries,
        defaultedValidated,
        frozen: rows.map((row) => [Object.isFrozen(row), Object.isFrozen(row.result)]),
        handled,
        rejected: false,
        rows: rows.map((row) => ({
          callId: row.callId,
          ok: row.result.ok,
          reason: row.result.reason,
        })),
        validated,
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q04:malformed-json-validation]").toEqual({
    available: true,
    defaultedHandlerEntries: 0,
    defaultedValidated: [{}],
    frozen: [[true, true], [true, true], [true, true]],
    handled: [{ args: { value: "later" }, callId: "later" }],
    rejected: false,
    rows: [
      { callId: "malformed", ok: false, reason: "invalid_args" },
      { callId: "malformed-default", ok: false, reason: "invalid_args" },
      { callId: "later", ok: true, reason: undefined },
    ],
    validated: [{}, { value: "later" }],
  });
});

it("[Q05] preserves a valid JSON primitive for schema validation", async () => {
  const validated = [];
  let handlerEntries = 0;
  const concierge = conciergeFor([
    action(
      "primitive",
      () => {
        handlerEntries += 1;
        return successful();
      },
      {
        validate: (value) => {
          validated.push(value);
          return { issues: [{ message: "object required" }] };
        },
      },
    ),
  ]);
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const rows = await concierge.dispatchBatch(
        ACTIVE_CONTEXT,
        toolBatch([toolCall("primitive", "primitive", "7", 0)]),
      );
      observed = {
        available: true,
        handlerEntries,
        rejected: false,
        result: {
          callId: rows[0]?.callId,
          ok: rows[0]?.result.ok,
          reason: rows[0]?.result.reason,
        },
        validated,
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q05:primitive-validation]").toEqual({
    available: true,
    handlerEntries: 0,
    rejected: false,
    result: { callId: "primitive", ok: false, reason: "invalid_args" },
    validated: [7],
  });
});

it("[Q06] forwards every batch and call metadata field by exact value and reference", async () => {
  const signal = {
    aborted: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const deferUntilDelivered = () => {};
  let receivedMeta;
  const concierge = conciergeFor([
    action("metadata", ({ meta }) => {
      receivedMeta = meta;
      return successful();
    }),
  ]);
  const batch = toolBatch(
    [toolCall("metadata-call", "metadata", "{}", 7)],
    {
      responseId: "response-exact",
      userTurnId: "turn-exact",
      signal,
      deferUntilDelivered,
    },
  );
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      await concierge.dispatchBatch(ACTIVE_CONTEXT, batch);
      observed = {
        available: true,
        metadata: {
          callId: receivedMeta?.callId,
          deferSame: receivedMeta?.deferUntilDelivered === deferUntilDelivered,
          keys: receivedMeta === undefined ? [] : Object.keys(receivedMeta).sort(),
          outputIndex: receivedMeta?.outputIndex,
          responseId: receivedMeta?.responseId,
          signalSame: receivedMeta?.signal === signal,
          userTurnId: receivedMeta?.userTurnId,
        },
        rejected: false,
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q06:metadata-forwarding]").toEqual({
    available: true,
    metadata: {
      callId: "metadata-call",
      deferSame: true,
      keys: [
        "callId",
        "deferUntilDelivered",
        "outputIndex",
        "responseId",
        "signal",
        "userTurnId",
      ],
      outputIndex: 7,
      responseId: "response-exact",
      signalSame: true,
      userTurnId: "turn-exact",
    },
    rejected: false,
  });
});

it("[Q07] correlates sorted callIds to results and exposes exactly two row keys", async () => {
  const concierge = conciergeFor([
    action("correlate", ({ meta }) => successful(`result:${meta.callId}`)),
  ]);
  const calls = [
    toolCall("later", "correlate", "{}", 9),
    toolCall("earlier", "correlate", "{}", 2),
  ];
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const rows = await concierge.dispatchBatch(ACTIVE_CONTEXT, toolBatch(calls));
      observed = {
        available: true,
        callIds: rows.map((row) => row.callId),
        messages: rows.map((row) => row.result.message),
        rejected: false,
        rowKeys: rows.map((row) => Object.keys(row).sort()),
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q07:callid-correlation]").toEqual({
    available: true,
    callIds: ["earlier", "later"],
    messages: ["result:earlier", "result:later"],
    rejected: false,
    rowKeys: [
      ["callId", "result"],
      ["callId", "result"],
    ],
  });
});

it("[Q08] freezes the result container and every correlation row", async () => {
  const concierge = conciergeFor([
    action("freeze", ({ meta }) => successful(meta.callId)),
  ]);
  const calls = [
    toolCall("one", "freeze", "{}", 0),
    toolCall("two", "freeze", "{}", 1),
  ];
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const rows = await concierge.dispatchBatch(ACTIVE_CONTEXT, toolBatch(calls));
      const first = rows[0];
      let containerWriteThrew = false;
      let rowWriteThrew = false;

      try {
        rows.push({ callId: "injected", result: successful() });
      } catch {
        containerWriteThrew = true;
      }

      if (first !== undefined) {
        try {
          first.callId = "rewritten";
        } catch {
          rowWriteThrew = true;
        }
      }

      observed = {
        available: true,
        containerFrozen: Object.isFrozen(rows),
        containerWriteThrew,
        ids: rows.map((row) => row.callId),
        rejected: false,
        rowWriteThrew,
        rowsFrozen: rows.map((row) => Object.isFrozen(row)),
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q08:frozen-results]").toEqual({
    available: true,
    containerFrozen: true,
    containerWriteThrew: true,
    ids: ["one", "two"],
    rejected: false,
    rowWriteThrew: true,
    rowsFrozen: [true, true],
  });
});

it("[Q09] settles every sorted call when the batch is already aborted", async () => {
  const controller = createAbortController(true);
  const entries = [];
  const concierge = conciergeFor([
    action("preaborted", ({ meta }) => {
      entries.push(meta.callId);
      return successful();
    }),
  ]);
  const calls = [
    toolCall("third", "preaborted", "{}", 2),
    toolCall("first", "preaborted", "{}", 0),
    toolCall("second", "preaborted", "{}", 1),
  ];
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const rows = await concierge.dispatchBatch(
        ACTIVE_CONTEXT,
        toolBatch(calls, { signal: controller.signal }),
      );
      observed = {
        available: true,
        entries,
        rejected: false,
        rows: rows.map((row) => ({
          callId: row.callId,
          ok: row.result.ok,
          reason: row.result.reason,
        })),
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q09:preaborted-completeness]").toEqual({
    available: true,
    entries: [],
    rejected: false,
    rows: [
      { callId: "first", ok: false, reason: "aborted" },
      { callId: "second", ok: false, reason: "aborted" },
      { callId: "third", ok: false, reason: "aborted" },
    ],
  });
});

it("[Q10] aborts the first commit window and still settles every call", async () => {
  const controller = createAbortController();
  const manual = createManualScheduler();
  const entries = [];
  const concierge = conciergeFor(
    [
      action(
        "commitWindow",
        ({ meta }) => {
          entries.push(meta.callId);
          return successful();
        },
        { effects: {} },
      ),
    ],
    { scheduler: manual.scheduler },
  );
  const calls = [
    toolCall("later", "commitWindow", "{}", 1),
    toolCall("first", "commitWindow", "{}", 0),
  ];
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const pending = concierge.dispatchBatch(
        ACTIVE_CONTEXT,
        toolBatch(calls, { signal: controller.signal }),
      );
      await flushMicrotasks();
      const pendingBeforeAbort = manual.pendingCount;
      controller.abort();
      manual.fireAll();
      const rows = await pending;
      observed = {
        available: true,
        delays: manual.delays,
        entries,
        pendingBeforeAbort,
        rejected: false,
        rows: rows.map((row) => ({
          callId: row.callId,
          ok: row.result.ok,
          reason: row.result.reason,
        })),
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q10:abort-commit-window]").toEqual({
    available: true,
    delays: [600],
    entries: [],
    pendingBeforeAbort: 1,
    rejected: false,
    rows: [
      { callId: "first", ok: false, reason: "aborted" },
      { callId: "later", ok: false, reason: "aborted" },
    ],
  });
});

it("[Q11] keeps the first result and aborts every call remaining after its handler", async () => {
  const controller = createAbortController();
  const entries = [];
  const concierge = conciergeFor([
    action("abortAfterHandler", ({ meta }) => {
      entries.push(meta.callId);
      if (meta.callId === "first") controller.abort();
      return successful(`handled:${meta.callId}`);
    }),
  ]);
  const calls = [
    toolCall("third", "abortAfterHandler", "{}", 2),
    toolCall("first", "abortAfterHandler", "{}", 0),
    toolCall("second", "abortAfterHandler", "{}", 1),
  ];
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const rows = await concierge.dispatchBatch(
        ACTIVE_CONTEXT,
        toolBatch(calls, { signal: controller.signal }),
      );
      observed = {
        available: true,
        entries,
        firstMessage: rows[0]?.result.message,
        rejected: false,
        rows: rows.map((row) => ({
          callId: row.callId,
          ok: row.result.ok,
          reason: row.result.reason,
        })),
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q11:abort-after-handler]").toEqual({
    available: true,
    entries: ["first"],
    firstMessage: "handled:first",
    rejected: false,
    rows: [
      { callId: "first", ok: true, reason: undefined },
      { callId: "second", ok: false, reason: "aborted" },
      { callId: "third", ok: false, reason: "aborted" },
    ],
  });
});

it("[Q12] suppresses every handler after an abort and invokes one scheduler canceller", async () => {
  const controller = createAbortController();
  const manual = createManualScheduler();
  const entries = { first: 0, second: 0, third: 0 };
  const concierge = conciergeFor(
    [
      action(
        "suppress",
        ({ meta }) => {
          entries[meta.callId] += 1;
          return successful();
        },
        { effects: {} },
      ),
    ],
    { scheduler: manual.scheduler },
  );
  const calls = [
    toolCall("third", "suppress", "{}", 2),
    toolCall("second", "suppress", "{}", 1),
    toolCall("first", "suppress", "{}", 0),
  ];
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const pending = concierge.dispatchBatch(
        ACTIVE_CONTEXT,
        toolBatch(calls, { signal: controller.signal }),
      );
      await flushMicrotasks();
      controller.abort();
      manual.fireAll();
      const rows = await pending;
      observed = {
        available: true,
        cancelCalls: manual.cancelCalls,
        entries,
        listeners: controller.listenerCount(),
        rejected: false,
        rows: rows.map((row) => ({ callId: row.callId, reason: row.result.reason })),
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q12:suppress-later-handlers]").toEqual({
    available: true,
    cancelCalls: 1,
    entries: { first: 0, second: 0, third: 0 },
    listeners: 0,
    rejected: false,
    rows: [
      { callId: "first", reason: "aborted" },
      { callId: "second", reason: "aborted" },
      { callId: "third", reason: "aborted" },
    ],
  });
});

it("[Q13] reuses the single-call cache for a repeated callId within one batch", async () => {
  const handled = [];
  const concierge = conciergeFor([
    action("dedup", ({ args }) => {
      handled.push(args.value);
      return successful(`handled:${args.value}`);
    }),
  ]);
  const calls = [
    toolCall("repeated", "dedup", JSON.stringify({ value: "first" }), 0),
    toolCall("repeated", "dedup", JSON.stringify({ value: "second" }), 1),
  ];
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const rows = await concierge.dispatchBatch(ACTIVE_CONTEXT, toolBatch(calls));
      observed = {
        available: true,
        handled,
        rejected: false,
        rows: rows.map((row) => ({
          callId: row.callId,
          message: row.result.message,
        })),
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q13:repeated-callid-dedup]").toEqual({
    available: true,
    handled: ["first"],
    rejected: false,
    rows: [
      { callId: "repeated", message: "handled:first" },
      { callId: "repeated", message: "handled:first" },
    ],
  });
});

it("[Q14] drives a direct application batch loop without constructing a Transport", async () => {
  const handlerEntries = [];
  const applicationResults = [];
  const concierge = conciergeFor([
    action("directBatch", ({ args, meta }) => {
      handlerEntries.push(meta.callId);
      return successful(`applied:${args.value}`);
    }),
  ]);
  const incoming = toolBatch([
    toolCall("second", "directBatch", JSON.stringify({ value: "two" }), 1),
    toolCall("first", "directBatch", JSON.stringify({ value: "one" }), 0),
  ]);
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const rows = await concierge.dispatchBatch(ACTIVE_CONTEXT, incoming);
      for (const row of rows) {
        applicationResults.push(`${row.callId}:${row.result.message}`);
      }
      observed = {
        applicationResults,
        available: true,
        handlerEntries,
        rejected: false,
      };
    } catch {
      observed = { available: true, rejected: true };
    }
  }

  expect(observed, "[RED:Q14:direct-no-transport]").toEqual({
    applicationResults: ["first:applied:one", "second:applied:two"],
    available: true,
    handlerEntries: ["first", "second"],
    rejected: false,
  });
});

it("[Q15] snapshots queued calls and batch metadata before the first handler awaits", async () => {
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const safeEntries = [];
  const dangerEntries = [];
  const originalHook = () => {};
  const concierge = conciergeFor([
    action("safe", async ({ args, meta }) => {
      safeEntries.push({ args, meta });
      if (meta.callId === "first") await firstGate;
      return successful(meta.callId);
    }),
    action("danger", ({ args, meta }) => {
      dangerEntries.push({ args, meta });
      return successful("danger");
    }),
  ]);
  const later = toolCall("second", "safe", JSON.stringify({ value: 2 }), 1);
  const calls = [
    toolCall("first", "safe", JSON.stringify({ value: 1 }), 0),
    later,
  ];
  const batch = toolBatch(calls, {
    responseId: "original-response",
    userTurnId: "original-turn",
    deferUntilDelivered: originalHook,
  });

  const pending = concierge.dispatchBatch(ACTIVE_CONTEXT, batch);
  await flushMicrotasks();

  later.callId = "rewritten";
  later.name = "danger";
  later.arguments = JSON.stringify({ value: 999 });
  later.outputIndex = -1;
  batch.responseId = "rewritten-response";
  batch.userTurnId = "rewritten-turn";
  batch.signal = createAbortController(true).signal;
  batch.deferUntilDelivered = () => {
    throw new Error("replacement hook must not escape");
  };

  releaseFirst();
  const rows = await pending;

  expect(
    {
      dangerEntries,
      rows: rows.map((row) => ({ callId: row.callId, message: row.result.message })),
      safeEntries: safeEntries.map(({ args, meta }) => ({
        args,
        callId: meta.callId,
        deferIsOriginal: meta.deferUntilDelivered === originalHook,
        outputIndex: meta.outputIndex,
        responseId: meta.responseId,
        userTurnId: meta.userTurnId,
      })),
    },
    "[RED:Q15:queued-call-snapshot]",
  ).toEqual({
    dangerEntries: [],
    rows: [
      { callId: "first", message: "first" },
      { callId: "second", message: "second" },
    ],
    safeEntries: [
      {
        args: { value: 1 },
        callId: "first",
        deferIsOriginal: true,
        outputIndex: 0,
        responseId: "original-response",
        userTurnId: "original-turn",
      },
      {
        args: { value: 2 },
        callId: "second",
        deferIsOriginal: true,
        outputIndex: 1,
        responseId: "original-response",
        userTurnId: "original-turn",
      },
    ],
  });
});

it("[Q16] keeps nested batch results immutable across cached retries", async () => {
  let handlerCalls = 0;
  const concierge = conciergeFor([
    action("batch-result", () => {
      handlerCalls += 1;
      return successful("batch original");
    }),
  ]);
  const batch = toolBatch([
    toolCall("batch-result-call", "batch-result", "{}", 0),
  ]);

  const firstRows = await concierge.dispatchBatch(ACTIVE_CONTEXT, batch);
  const firstResult = firstRows[0].result;
  let mutationThrew = false;
  try {
    firstResult.message = "\u001b[31mpoisoned";
  } catch {
    mutationThrew = true;
  }
  const retryRows = await concierge.dispatchBatch(ACTIVE_CONTEXT, batch);
  const retryResult = retryRows[0].result;

  expect(
    {
      frozen: Object.isFrozen(firstResult),
      handlerCalls,
      mutationThrew,
      resultIdentity: firstResult === retryResult,
      retryResult,
    },
    "[RED:Q16:immutable-nested-result]",
  ).toEqual({
    frozen: true,
    handlerCalls: 1,
    mutationThrew: true,
    resultIdentity: true,
    retryResult: { ok: true, message: "batch original" },
  });
});

it("[Q17] preserves malformed callId correlation in one frozen result row", async () => {
  const malformedCallId = Symbol("malformed-batch-call");
  let handlerCalls = 0;
  const concierge = conciergeFor([
    action("malformed-call", () => {
      handlerCalls += 1;
      return successful();
    }),
  ]);
  let observed = { available: false };

  if (typeof concierge.dispatchBatch === "function") {
    try {
      const rows = await concierge.dispatchBatch(
        ACTIVE_CONTEXT,
        toolBatch([toolCall(malformedCallId, "malformed-call", "{}", 0)]),
      );
      const row = rows[0];
      observed = {
        available: true,
        callIdSame: row?.callId === malformedCallId,
        containerFrozen: Object.isFrozen(rows),
        handlerCalls,
        rejected: false,
        result: row?.result,
        resultFrozen: row === undefined ? false : Object.isFrozen(row.result),
        resultKeys: row === undefined ? [] : Object.keys(row.result).sort(),
        rowCount: rows.length,
        rowFrozen: row === undefined ? false : Object.isFrozen(row),
      };
    } catch (error) {
      observed = {
        available: true,
        errorName: error?.constructor?.name,
        handlerCalls,
        rejected: true,
      };
    }
  }

  expect(observed, "[RED:Q17:malformed-callid-correlation]").toEqual({
    available: true,
    callIdSame: true,
    containerFrozen: true,
    handlerCalls: 0,
    rejected: false,
    result: {
      ok: false,
      message: "The invocation metadata is invalid.",
    },
    resultFrozen: true,
    resultKeys: ["message", "ok"],
    rowCount: 1,
    rowFrozen: true,
  });
});

it("[Q18] contains malformed sortable metadata and still runs valid calls", async () => {
  const scenarios = [
    { callId: "symbol-index", outputIndex: Symbol("bad-index") },
    { callId: "bigint-index", outputIndex: 1n },
    { callId: "nan-index", outputIndex: Number.NaN },
    { callId: "infinite-index", outputIndex: Number.POSITIVE_INFINITY },
  ];
  const observations = [];

  for (const [scenarioIndex, scenario] of scenarios.entries()) {
    const handled = [];
    const concierge = conciergeFor([
      action("mixed-metadata", ({ meta }) => {
        handled.push(meta.callId);
        return successful(meta.callId);
      }),
    ]);
    const validId = `valid-${scenarioIndex}`;
    const rows = await concierge.dispatchBatch(
      ACTIVE_CONTEXT,
      toolBatch([
        toolCall(
          scenario.callId,
          "mixed-metadata",
          "{}",
          scenario.outputIndex,
        ),
        toolCall(validId, "mixed-metadata", "{}", 0),
      ]),
    );
    observations.push({
      handled,
      rows: rows.map((row) => ({
        callId: row.callId,
        frozen: Object.isFrozen(row) && Object.isFrozen(row.result),
        ok: row.result.ok,
      })),
    });
  }

  const throwingIndexCall = toolCall(
    "throwing-index",
    "mixed-metadata",
    "{}",
    1,
  );
  Object.defineProperty(throwingIndexCall, "outputIndex", {
    enumerable: true,
    get() {
      throw new Error("PRIVATE-OUTPUT-INDEX-GETTER");
    },
  });
  const unreadableCallId = toolCall(
    "placeholder",
    "mixed-metadata",
    "{}",
    1,
  );
  Object.defineProperty(unreadableCallId, "callId", {
    enumerable: true,
    get() {
      throw new Error("PRIVATE-CALL-ID-GETTER");
    },
  });
  const getterHandled = [];
  const getterConcierge = conciergeFor([
    action("mixed-metadata", ({ meta }) => {
      getterHandled.push(meta.callId);
      return successful(meta.callId);
    }),
  ]);
  const getterRows = await getterConcierge.dispatchBatch(
    ACTIVE_CONTEXT,
    toolBatch([
      throwingIndexCall,
      unreadableCallId,
      toolCall("getter-valid", "mixed-metadata", "{}", 0),
    ]),
  );

  expect(
    {
      getterHandled,
      getterRows: getterRows.map((row) => ({
        callId: row.callId,
        frozen: Object.isFrozen(row) && Object.isFrozen(row.result),
        ok: row.result.ok,
      })),
      observations,
    },
    "[RED:Q18:malformed-sort-totality]",
  ).toEqual({
    getterHandled: ["getter-valid"],
    getterRows: [
      { callId: "getter-valid", frozen: true, ok: true },
      {
        callId: "[concierge:unobservable-call-id:1]",
        frozen: true,
        ok: false,
      },
      { callId: "throwing-index", frozen: true, ok: false },
    ],
    observations: scenarios.map((scenario, scenarioIndex) => ({
      handled: [`valid-${scenarioIndex}`],
      rows: [
        { callId: `valid-${scenarioIndex}`, frozen: true, ok: true },
        { callId: scenario.callId, frozen: true, ok: false },
      ],
    })),
  });
});

it("[Q19] contains throwing batch metadata as one row per observable call", async () => {
  let handlerCalls = 0;
  const concierge = conciergeFor([
    action("batch-metadata", () => {
      handlerCalls += 1;
      return successful();
    }),
  ]);
  const batch = toolBatch([
    toolCall("second", "batch-metadata", "{}", 1),
    toolCall("first", "batch-metadata", "{}", 0),
  ]);
  Object.defineProperty(batch, "responseId", {
    enumerable: true,
    get() {
      throw new Error("PRIVATE-BATCH-RESPONSE-ID-GETTER");
    },
  });

  const rows = await concierge.dispatchBatch(ACTIVE_CONTEXT, batch);

  expect(
    {
      containerFrozen: Object.isFrozen(rows),
      handlerCalls,
      rows: rows.map((row) => ({
        callId: row.callId,
        frozen: Object.isFrozen(row) && Object.isFrozen(row.result),
        result: row.result,
      })),
    },
    "[RED:Q19:throwing-batch-metadata-totality]",
  ).toEqual({
    containerFrozen: true,
    handlerCalls: 0,
    rows: [
      {
        callId: "first",
        frozen: true,
        result: {
          ok: false,
          message: "The invocation metadata is invalid.",
        },
      },
      {
        callId: "second",
        frozen: true,
        result: {
          ok: false,
          message: "The invocation metadata is invalid.",
        },
      },
    ],
  });
});

it("[Q20] bounds the calls array and never executes inherited numeric entries", async () => {
  const handled = [];
  const concierge = conciergeFor([
    action("array-boundary", ({ meta }) => {
      handled.push(meta.callId);
      return successful(meta.callId);
    }),
  ]);

  const symbolLengthCalls = new Proxy([], {
    get(target, property, receiver) {
      if (property === "length") return Symbol("malformed-length");
      return Reflect.get(target, property, receiver);
    },
  });
  const oversizedCalls = new Proxy([], {
    get(target, property, receiver) {
      // One above dispatch.ts's documented 10,000-entry resource bound.
      if (property === "length") return 10_001;
      return Reflect.get(target, property, receiver);
    },
  });
  let statefulLengthReads = 0;
  const statefulCalls = new Proxy(
    [toolCall("stateful-own", "array-boundary", "{}", 0)],
    {
      get(target, property, receiver) {
        if (property === "length") {
          statefulLengthReads += 1;
          return statefulLengthReads === 1
            ? 1
            : Symbol("length-was-read-again");
        }
        return Reflect.get(target, property, receiver);
      },
    },
  );

  const inheritedCalls = new Array(2);
  const inheritedPrototype = Object.create(Array.prototype);
  Object.defineProperty(inheritedPrototype, "0", {
    configurable: true,
    value: toolCall("inherited", "array-boundary", "{}", -1),
  });
  Object.setPrototypeOf(inheritedCalls, inheritedPrototype);
  inheritedCalls[1] = toolCall("sparse-own", "array-boundary", "{}", 0);

  const [symbolRows, oversizedRows, statefulRows, sparseRows] =
    await Promise.all([
      concierge.dispatchBatch(ACTIVE_CONTEXT, toolBatch(symbolLengthCalls)),
      concierge.dispatchBatch(ACTIVE_CONTEXT, toolBatch(oversizedCalls)),
      concierge.dispatchBatch(ACTIVE_CONTEXT, toolBatch(statefulCalls)),
      concierge.dispatchBatch(ACTIVE_CONTEXT, toolBatch(inheritedCalls)),
    ]);

  expect(
    {
      handled,
      oversizedRows,
      sparseRows,
      statefulLengthReads,
      statefulRows,
      symbolRows,
    },
    "[RED:Q20:bounded-prototype-safe-batch-array]",
  ).toEqual({
    handled: ["stateful-own", "sparse-own"],
    oversizedRows: [],
    sparseRows: [
      {
        callId: "sparse-own",
        result: { ok: true, message: "sparse-own" },
      },
      {
        callId: "[concierge:unobservable-call-id:0]",
        result: {
          ok: false,
          message: "The invocation metadata is invalid.",
        },
      },
    ],
    statefulLengthReads: 1,
    statefulRows: [
      {
        callId: "stateful-own",
        result: { ok: true, message: "stateful-own" },
      },
    ],
    symbolRows: [],
  });
});

it("[Q20 terminal] silences an earlier result after terminal success", async () => {
  const entries = [];
  const concierge = conciergeFor([
    action("before-terminal", ({ meta }) => {
      entries.push(meta.callId);
      return successful("earlier effect completed");
    }),
    action(
      "terminal-success",
      ({ meta }) => {
        entries.push(meta.callId);
        return successful("terminal effect completed");
      },
      { terminal: true },
    ),
    action("after-terminal", ({ meta }) => {
      entries.push(meta.callId);
      return successful("must not run");
    }),
  ]);

  const rows = await concierge.dispatchBatch(
    ACTIVE_CONTEXT,
    toolBatch([
      toolCall("before", "before-terminal", "{}", 0),
      toolCall("terminal", "terminal-success", "{}", 1),
      toolCall("after", "after-terminal", "{}", 2),
    ]),
  );

  expect(
    { entries, frozen: Object.isFrozen(rows), rows },
    "[RED:Q20:terminal-success-whole-batch-silence]",
  ).toEqual({ entries: ["before", "terminal"], frozen: true, rows: [] });
});

it("[Q21] commits terminality for an app-authored failure", async () => {
  const entries = [];
  const concierge = conciergeFor([
    action(
      "terminal-failure",
      ({ meta }) => {
        entries.push(meta.callId);
        return {
          ok: false,
          reason: "declined",
          message: "The application declined the terminal operation.",
        };
      },
      { terminal: true },
    ),
    action("after-failure", ({ meta }) => {
      entries.push(meta.callId);
      return successful("must not run");
    }),
  ]);

  const rows = await concierge.dispatchBatch(
    ACTIVE_CONTEXT,
    toolBatch([
      toolCall("terminal-failure", "terminal-failure", "{}", 0),
      toolCall("after-failure", "after-failure", "{}", 1),
    ]),
  );

  expect({ entries, rows }, "[RED:Q21:terminal-returned-failure]").toEqual({
    entries: ["terminal-failure"],
    rows: [],
  });
});

it("[Q22] commits terminality before a synchronous handler throw", async () => {
  const entries = [];
  const concierge = conciergeFor([
    action(
      "terminal-throw",
      ({ meta }) => {
        entries.push(meta.callId);
        throw new Error("PRIVATE-Q22-TERMINAL-THROW");
      },
      { terminal: true },
    ),
    action("after-throw", ({ meta }) => {
      entries.push(meta.callId);
      return successful("must not run");
    }),
  ]);

  const rows = await concierge.dispatchBatch(
    ACTIVE_CONTEXT,
    toolBatch([
      toolCall("terminal-throw", "terminal-throw", "{}", 0),
      toolCall("after-throw", "after-throw", "{}", 1),
    ]),
  );

  expect({ entries, rows }, "[RED:Q22:terminal-marker-before-throw]").toEqual({
    entries: ["terminal-throw"],
    rows: [],
  });
});

it("[Q23] commits terminality before an asynchronous handler rejection", async () => {
  const entries = [];
  const concierge = conciergeFor([
    action(
      "terminal-reject",
      ({ meta }) => {
        entries.push(meta.callId);
        return Promise.reject(new Error("PRIVATE-Q23-TERMINAL-REJECTION"));
      },
      { terminal: true },
    ),
    action("after-reject", ({ meta }) => {
      entries.push(meta.callId);
      return successful("must not run");
    }),
  ]);

  const rows = await concierge.dispatchBatch(
    ACTIVE_CONTEXT,
    toolBatch([
      toolCall("terminal-reject", "terminal-reject", "{}", 0),
      toolCall("after-reject", "after-reject", "{}", 1),
    ]),
  );

  expect({ entries, rows }, "[RED:Q23:terminal-marker-before-reject]").toEqual({
    entries: ["terminal-reject"],
    rows: [],
  });
});

it("[Q24] does not commit terminality for pre-entry argument, handler, or consent failures", async () => {
  const entries = [];
  const missingHandler = action("terminal-missing-handler", () => successful(), {
    terminal: true,
  });
  delete missingHandler.handler;
  const concierge = conciergeFor(
    [
      action("review-terminal", () => successful("unused review")),
      action(
        "terminal-invalid-args",
        () => {
          entries.push("invalid-entered");
          return successful("must not run");
        },
        {
          terminal: true,
          validate: () => ({ issues: [{ message: "invalid" }] }),
        },
      ),
      missingHandler,
      action(
        "terminal-consent-refused",
        () => {
          entries.push("consent-entered");
          return successful("must not run");
        },
        {
          terminal: true,
          consent: { requires: "review-terminal", bindTo: "response" },
        },
      ),
      action("after-pre-entry-failures", ({ meta }) => {
        entries.push(meta.callId);
        return successful("later handler ran");
      }),
    ],
    {
      consentProfile: {
        consentGrade: "delivered",
        userTurnIdentity: "agent-forgeable",
      },
    },
  );

  const rows = await concierge.dispatchBatch(
    ACTIVE_CONTEXT,
    toolBatch([
      toolCall("invalid", "terminal-invalid-args", "{}", 0),
      toolCall("missing", "terminal-missing-handler", "{}", 1),
      toolCall("consent", "terminal-consent-refused", "{}", 2),
      toolCall("later", "after-pre-entry-failures", "{}", 3),
    ]),
  );

  expect(
    {
      entries,
      reasons: rows.map(({ result }) => result.reason),
      rowIds: rows.map(({ callId }) => callId),
    },
    "[RED:Q24:pre-entry-failures-remain-nonterminal]",
  ).toEqual({
    entries: ["later"],
    reasons: ["invalid_args", undefined, "consent_required", undefined],
    rowIds: ["invalid", "missing", "consent", "later"],
  });
});

it("[Q25] keeps a pre-aborted terminal call nonterminal for later work", async () => {
  const entries = [];
  const controller = createAbortController(true);
  const concierge = conciergeFor([
    action(
      "terminal-preaborted",
      ({ meta }) => {
        entries.push(meta.callId);
        return successful("must not run");
      },
      { terminal: true },
    ),
    action("after-preabort", ({ meta }) => {
      entries.push(meta.callId);
      return successful("later batch ran");
    }),
  ]);

  const abortedRows = await concierge.dispatchBatch(
    ACTIVE_CONTEXT,
    toolBatch(
      [toolCall("preaborted", "terminal-preaborted", "{}", 0)],
      { signal: controller.signal },
    ),
  );
  const laterRows = await concierge.dispatchBatch(
    ACTIVE_CONTEXT,
    toolBatch([toolCall("later", "after-preabort", "{}", 0)]),
  );

  expect(
    {
      abortedReason: abortedRows[0]?.result.reason,
      entries,
      laterRows,
    },
    "[RED:Q25:preabort-before-terminal-entry]",
  ).toEqual({
    abortedReason: "aborted",
    entries: ["later"],
    laterRows: [{ callId: "later", result: { ok: true, message: "later batch ran" } }],
  });
});

it("[Q26] preserves cached dispatch Promise identity when a batch reuses terminal work", async () => {
  const entries = [];
  const concierge = conciergeFor([
    action(
      "cached-terminal",
      ({ meta }) => {
        entries.push(meta.callId);
        return successful("terminal cache result");
      },
      { terminal: true },
    ),
    action("after-cached-terminal", ({ meta }) => {
      entries.push(meta.callId);
      return successful("must not run");
    }),
  ]);
  const meta = {
    responseId: "response-batch",
    userTurnId: undefined,
    callId: "cached-terminal",
    outputIndex: 0,
    signal: undefined,
    deferUntilDelivered: undefined,
  };

  const first = concierge.dispatch(ACTIVE_CONTEXT, "cached-terminal", {}, meta);
  const retry = concierge.dispatch(ACTIVE_CONTEXT, "cached-terminal", {}, meta);
  const directResult = await first;
  const rows = await concierge.dispatchBatch(
    ACTIVE_CONTEXT,
    toolBatch([
      toolCall("cached-terminal", "cached-terminal", "{}", 0),
      toolCall("after", "after-cached-terminal", "{}", 1),
    ]),
  );

  expect(
    {
      directResult,
      entries,
      frozen: Object.isFrozen(rows),
      promiseIdentity: first === retry,
      rows,
    },
    "[RED:Q26:terminal-cache-state-and-promise-identity]",
  ).toEqual({
    directResult: { ok: true, message: "terminal cache result" },
    entries: ["cached-terminal"],
    frozen: true,
    promiseIdentity: true,
    rows: [],
  });
});
