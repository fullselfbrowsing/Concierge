import { beforeEach, describe, expect, it } from "vitest";

import { createConcierge } from "../dist/index.js";

const CONTRACT_KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const CONTEXT = Object.freeze({ page: "active" });

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[CONTRACT_KEY];
});

function schema(validate = (value: unknown) => ({ value })) {
  return {
    "~standard": {
      version: 1,
      vendor: "structured-results-test",
      validate,
    },
  };
}

function action(
  name: string,
  handler: (context: Record<string, unknown>) => unknown,
  options: Record<string, unknown> = {},
) {
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

function richAction(
  name: string,
  handler: (context: Record<string, unknown>) => unknown,
  outputValidate = (value: unknown) => ({ value }),
  redact: unknown = "drop",
) {
  return action(name, handler, {
    output: { schema: schema(outputValidate), redact },
  });
}

function conciergeFor(
  actions: ReadonlyArray<Record<string, unknown>>,
  extra: Record<string, unknown> = {},
) {
  return createConcierge({
    stages: [{ id: "active", match: (ctx: { page?: string }) => ctx.page === "active", actions }],
    ...extra,
  });
}

function identity(callId: string, outputIndex = 0) {
  return {
    sessionId: "session-1",
    responseId: "response-1",
    callId,
    userTurnId: "turn-1",
    outputIndex,
  };
}

async function dispatch(
  concierge: ReturnType<typeof createConcierge>,
  name: string,
  input: unknown = {},
  callId = name,
) {
  const catalog = concierge.resolveCatalog(CONTEXT);
  return concierge.dispatch(CONTEXT, {
    name,
    input,
    catalogRevision: catalog.revision,
    identity: identity(callId),
  });
}

async function flushEvents() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe("declared structured action results", () => {
  it("rejects incomplete structured-output declarations while legacy actions remain valid", () => {
    expect(() => conciergeFor([
      action("missingRedaction", () => ({ ok: true, message: "Done." }), {
        output: { schema: schema() },
      }),
    ])).toThrow(/output_redaction_missing/u);

    expect(() => conciergeFor([
      action("invalidSchema", () => ({ ok: true, message: "Done." }), {
        output: { schema: {}, redact: "drop" },
      }),
    ])).toThrow(/output_schema_invalid/u);

    expect(() => conciergeFor([
      action("legacy", () => ({ ok: true, message: "Still valid." })),
    ])).not.toThrow();
  });

  it("preserves transformed data on success, failure, direct, batch, and workflow paths", async () => {
    const concierge = conciergeFor([
      richAction(
        "success",
        () => ({ ok: true, message: "Found results.", data: { count: "2" } }),
        (value: { count: string }) => ({ value: { kind: "results", count: Number(value.count) } }),
      ),
      richAction(
        "failure",
        () => ({
          ok: false,
          reason: "precondition_failed",
          message: "The current state prevents this action.",
          data: { kind: "domain-failure", code: "hotel-ambiguous" },
        }),
      ),
      richAction(
        "child",
        () => ({ ok: true, message: "Child complete.", data: { value: 7 } }),
      ),
      richAction(
        "parent",
        async ({ workflow }: { workflow: { run(input: unknown): Promise<{ data?: unknown }> } }) => {
          const child = await workflow.run({ stepId: "read", name: "child", input: {} });
          return { ok: true, message: "Parent complete.", data: child.data };
        },
      ),
    ]);

    await expect(dispatch(concierge, "success")).resolves.toEqual({
      ok: true,
      message: "Found results.",
      data: { kind: "results", count: 2 },
    });
    await expect(dispatch(concierge, "failure")).resolves.toEqual({
      ok: false,
      reason: "precondition_failed",
      message: "The current state prevents this action.",
      data: { kind: "domain-failure", code: "hotel-ambiguous" },
    });
    await expect(dispatch(concierge, "parent")).resolves.toMatchObject({
      ok: true,
      data: { value: 7 },
    });

    const catalog = concierge.resolveCatalog(CONTEXT);
    const outcome = await concierge.dispatchBatch(CONTEXT, {
      sessionId: "session-1",
      responseId: "response-batch",
      userTurnId: "turn-batch",
      catalogRevision: catalog.revision,
      calls: [
        { callId: "batch-success", name: "success", arguments: "{}", outputIndex: 0 },
        { callId: "batch-failure", name: "failure", arguments: "{}", outputIndex: 1 },
      ],
    });
    expect(outcome.kind).toBe("completed");
    expect(outcome.rows.map((row) => row.result.data)).toEqual([
      { kind: "results", count: 2 },
      { kind: "domain-failure", code: "hotel-ambiguous" },
    ]);
  });

  it("detaches and recursively freezes data while preserving dedupe Promise identity", async () => {
    const original = { nested: { values: ["first"] } };
    let handlerCalls = 0;
    const concierge = conciergeFor([
      richAction("read", () => {
        handlerCalls += 1;
        return { ok: true, message: "Read state.", data: original };
      }),
    ]);
    const catalog = concierge.resolveCatalog(CONTEXT);
    const request = {
      name: "read",
      input: {},
      catalogRevision: catalog.revision,
      identity: identity("same-call"),
    };
    const first = concierge.dispatch(CONTEXT, request);
    const second = concierge.dispatch(CONTEXT, request);
    expect(second).toBe(first);
    const result = await first;

    original.nested.values[0] = "mutated";
    original.nested.values.push("later");
    expect(result.data).toEqual({ nested: { values: ["first"] } });
    expect(result.data).not.toBe(original);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.data)).toBe(true);
    expect(Object.isFrozen(result.data.nested)).toBe(true);
    expect(Object.isFrozen(result.data.nested.values)).toBe(true);
    expect(handlerCalls).toBe(1);
  });

  it("fails closed for undeclared, rejected, unsafe, aliased, and oversized data", async () => {
    const shared = { value: "shared" };
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const accessor: Record<string, unknown> = {};
    let accessorReads = 0;
    Object.defineProperty(accessor, "secret", {
      enumerable: true,
      get() {
        accessorReads += 1;
        throw new Error("RAW-ACCESSOR-SECRET");
      },
    });
    class Exotic {
      value = "private";
    }
    const sparse = new Array(2);
    sparse[1] = "present";
    const disguisedExotic = Object.create(
      Object.create(null),
    ) as Record<string, unknown>;
    disguisedExotic.value = "private";
    const invalidValues: unknown[] = [
      cycle,
      { first: shared, second: shared },
      accessor,
      new Exotic(),
      disguisedExotic,
      new Date(0),
      new Map(),
      new Set(),
      sparse,
      { value: undefined },
      { value: 1n },
      { value: Symbol("secret") },
      { value: () => "secret" },
      { value: Number.NaN },
      { value: Number.POSITIVE_INFINITY },
    ];

    for (const [index, data] of invalidValues.entries()) {
      const concierge = conciergeFor([
        richAction(`invalid${index}`, () => ({ ok: true, message: "Unsafe.", data })),
      ]);
      await expect(dispatch(concierge, `invalid${index}`)).resolves.toEqual({
        ok: false,
        reason: "invalid_result",
        message: "The action returned an invalid result.",
      });
    }
    expect(accessorReads).toBe(0);

    const rejected = conciergeFor([
      richAction(
        "rejected",
        () => ({ ok: true, message: "Rejected.", data: { raw: "RAW-SCHEMA-SECRET" } }),
        () => ({ issues: [{ message: "do not expose this" }] }),
      ),
    ]);
    await expect(dispatch(rejected, "rejected")).resolves.toMatchObject({
      ok: false,
      reason: "invalid_result",
    });

    const undeclared = conciergeFor([
      action("undeclared", () => ({ ok: true, message: "Extra.", data: { hidden: true } })),
    ]);
    await expect(dispatch(undeclared, "undeclared")).resolves.toMatchObject({
      ok: false,
      reason: "invalid_result",
    });

    const oversized = conciergeFor([
      richAction("oversized", () => ({ ok: true, message: "Large.", data: "0123456789" })),
    ], { maxActionDataBytes: 5 });
    await expect(dispatch(oversized, "oversized")).resolves.toMatchObject({
      ok: false,
      reason: "invalid_result",
    });
  });

  it("keeps legacy result shape and isolates observer output through explicit redaction", async () => {
    const events: Array<Record<string, unknown>> = [];
    const projectionSource = { id: "hotel-1", privateEmail: "private@example.test" };
    const sharedProjection = { safe: true };
    const concierge = conciergeFor([
      action("legacy", () => ({ ok: true, message: "Legacy complete.", ignored: "extra" })),
      richAction("drop", () => ({ ok: true, message: "Drop.", data: projectionSource })),
      richAction(
        "passthrough",
        () => ({ ok: true, message: "Pass.", data: projectionSource }),
        undefined,
        "passthrough",
      ),
      richAction(
        "project",
        () => ({ ok: true, message: "Project.", data: projectionSource }),
        undefined,
        (data: { id: string }) => ({ id: data.id }),
      ),
      richAction(
        "throwingProjection",
        () => ({ ok: true, message: "Throw.", data: projectionSource }),
        undefined,
        () => {
          throw new Error("RAW-PROJECTION-SECRET");
        },
      ),
      richAction(
        "invalidProjection",
        () => ({ ok: true, message: "Alias.", data: projectionSource }),
        undefined,
        () => ({ first: sharedProjection, second: sharedProjection }),
      ),
    ]);
    concierge.onDispatch((event) => events.push(event as unknown as Record<string, unknown>));

    const realConsole = globalThis.console;
    const warnings: string[] = [];
    globalThis.console = { ...realConsole, warn: (message) => warnings.push(String(message)) };
    try {
      const legacy = await dispatch(concierge, "legacy");
      expect(legacy).toEqual({ ok: true, message: "Legacy complete." });
      expect(Object.keys(legacy)).toEqual(["ok", "message"]);
      for (const name of ["drop", "passthrough", "project", "throwingProjection", "invalidProjection"]) {
        await dispatch(concierge, name);
      }
      await flushEvents();
    } finally {
      globalThis.console = realConsole;
    }

    const terminal = new Map(
      events
        .filter((event) => ["succeeded", "failed", "cancelled"].includes(String(event.phase)))
        .map((event) => [event.name, event]),
    );
    expect(terminal.get("legacy")?.resultData).toEqual({ kind: "absent" });
    expect(terminal.get("drop")?.resultData).toEqual({ kind: "dropped" });
    expect(terminal.get("passthrough")?.resultData).toEqual({
      kind: "included",
      value: projectionSource,
    });
    expect(terminal.get("project")?.resultData).toEqual({
      kind: "included",
      value: { id: "hotel-1" },
    });
    expect(terminal.get("throwingProjection")?.resultData).toEqual({ kind: "dropped" });
    expect(terminal.get("invalidProjection")?.resultData).toEqual({ kind: "dropped" });
    expect(terminal.get("passthrough")?.result).not.toHaveProperty("data");
    const included = terminal.get("passthrough")?.resultData as { value: unknown };
    expect(included.value).not.toBe(projectionSource);
    expect(Object.isFrozen(included.value)).toBe(true);
    expect(warnings.join(" ")).not.toContain("RAW-PROJECTION-SECRET");
    expect(warnings.join(" ")).not.toContain("private@example.test");
  });
});
