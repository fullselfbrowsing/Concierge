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

it("[Q04] routes malformed JSON through validation and continues with the later call", async () => {
  const validated = [];
  const handled = [];
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
  ]);
  const calls = [
    toolCall("malformed", "parse", "{", 0),
    toolCall("later", "parse", JSON.stringify({ value: "later" }), 1),
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
    handled: [{ args: { value: "later" }, callId: "later" }],
    rejected: false,
    rows: [
      { callId: "malformed", ok: false, reason: "invalid_args" },
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
