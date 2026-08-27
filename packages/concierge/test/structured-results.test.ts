import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

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

  it("keeps propagated observer data within child and parent redaction policies", async () => {
    const events: Array<Record<string, unknown>> = [];
    const parentProjectionInputs: unknown[] = [];
    const concierge = conciergeFor([
      richAction(
        "dropChild",
        () => ({
          ok: false,
          reason: "precondition_failed",
          message: "Child failed.",
          data: { safe: "visible", secret: "child-only" },
        }),
      ),
      richAction(
        "dropParentPassthrough",
        async ({ workflow }: { workflow: { run(input: unknown): Promise<unknown> } }) => {
          await workflow.run({ stepId: "child", name: "dropChild", input: {} });
          return { ok: true, message: "Parent complete." };
        },
        undefined,
        "passthrough",
      ),
      richAction(
        "passChild",
        () => ({
          ok: false,
          reason: "precondition_failed",
          message: "Child failed.",
          data: { safe: "visible", secret: "child-only" },
        }),
        undefined,
        "passthrough",
      ),
      richAction(
        "passParentDrop",
        async ({ workflow }: { workflow: { run(input: unknown): Promise<unknown> } }) => {
          await workflow.run({ stepId: "child", name: "passChild", input: {} });
          return { ok: true, message: "Parent complete." };
        },
      ),
      richAction(
        "projectChild",
        () => ({
          ok: false,
          reason: "precondition_failed",
          message: "Child failed.",
          data: { safe: "visible", secret: "child-only" },
        }),
        undefined,
        (data: { safe: string }) => ({ safe: data.safe }),
      ),
      richAction(
        "projectParent",
        async ({ workflow }: { workflow: { run(input: unknown): Promise<unknown> } }) => {
          await workflow.run({ stepId: "child", name: "projectChild", input: {} });
          return { ok: true, message: "Parent complete." };
        },
        undefined,
        (data: { safe: string }) => {
          parentProjectionInputs.push(data);
          return { safe: data.safe, parent: true };
        },
      ),
      richAction(
        "throwingParent",
        async ({ workflow }: { workflow: { run(input: unknown): Promise<unknown> } }) => {
          await workflow.run({ stepId: "child", name: "projectChild", input: {} });
          return { ok: true, message: "Parent complete." };
        },
        undefined,
        () => {
          throw new Error("RAW-PARENT-PROJECTION-THROW");
        },
      ),
    ]);
    concierge.onDispatch((event) => events.push(event as unknown as Record<string, unknown>));

    const realConsole = globalThis.console;
    const warnings: string[] = [];
    globalThis.console = { ...realConsole, warn: (message) => warnings.push(String(message)) };
    try {
      for (const name of [
        "dropParentPassthrough",
        "passParentDrop",
        "projectParent",
        "throwingParent",
      ]) {
        await expect(dispatch(concierge, name)).resolves.toMatchObject({
          ok: false,
          data: { safe: "visible", secret: "child-only" },
        });
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
    expect(terminal.get("dropChild")?.resultData).toEqual({ kind: "dropped" });
    expect(terminal.get("dropParentPassthrough")?.resultData).toEqual({ kind: "dropped" });
    expect(terminal.get("passChild")?.resultData).toEqual({
      kind: "included",
      value: { safe: "visible", secret: "child-only" },
    });
    expect(terminal.get("passParentDrop")?.resultData).toEqual({ kind: "dropped" });
    expect(terminal.get("projectChild")?.resultData).toEqual({
      kind: "included",
      value: { safe: "visible" },
    });
    expect(terminal.get("projectParent")?.resultData).toEqual({
      kind: "included",
      value: { safe: "visible", parent: true },
    });
    expect(terminal.get("throwingParent")?.resultData).toEqual({ kind: "dropped" });
    expect(parentProjectionInputs).toEqual([{ safe: "visible" }]);
    expect(warnings.join("\n")).toContain('action "throwingParent"');
    expect(warnings.join("\n")).not.toContain("RAW-PARENT-PROJECTION-THROW");
  });

  it("enforces every enclosing output contract without resurrecting child data", async () => {
    const events: Array<Record<string, unknown>> = [];
    let directValidations = 0;
    let ignoredValidations = 0;
    const transform = (value: { count: string }) => ({
      value: { count: Number(value.count) },
    });
    const concierge = conciergeFor([
      richAction(
        "contractChild",
        () => ({
          ok: false,
          reason: "precondition_failed",
          message: "Child failed.",
          data: { count: "2", secret: "RAW-CHILD-DATA-SECRET" },
        }),
        undefined,
        "passthrough",
      ),
      richAction(
        "directParent",
        async ({ workflow }: { workflow: { run(input: unknown): Promise<unknown> } }) =>
          workflow.run({ stepId: "child", name: "contractChild", input: {} }),
        (value: { count: string }) => {
          directValidations += 1;
          return transform(value);
        },
        "passthrough",
      ),
      richAction(
        "ignoredParent",
        async ({ workflow }: { workflow: { run(input: unknown): Promise<unknown> } }) => {
          await workflow.run({ stepId: "child", name: "contractChild", input: {} });
          return { ok: true, message: "Parent complete." };
        },
        (value: { count: string }) => {
          ignoredValidations += 1;
          return transform(value);
        },
        "passthrough",
      ),
      action(
        "undeclaredInner",
        async ({ workflow }: { workflow: { run(input: unknown): Promise<unknown> } }) => {
          await workflow.run({ stepId: "child", name: "contractChild", input: {} });
          return { ok: true, message: "Inner complete." };
        },
      ),
      richAction(
        "outerParent",
        async ({ workflow }: { workflow: { run(input: unknown): Promise<unknown> } }) => {
          await workflow.run({ stepId: "inner", name: "undeclaredInner", input: {} });
          return { ok: true, message: "Outer complete." };
        },
        undefined,
        "passthrough",
      ),
      richAction(
        "rejectingParent",
        async ({ workflow }: { workflow: { run(input: unknown): Promise<unknown> } }) => {
          await workflow.run({ stepId: "child", name: "contractChild", input: {} });
          return { ok: true, message: "Parent complete." };
        },
        () => ({ issues: [{ message: "RAW-PARENT-SCHEMA-ISSUE" }] }),
        "passthrough",
      ),
    ]);
    concierge.onDispatch((event) => events.push(event as unknown as Record<string, unknown>));

    const realConsole = globalThis.console;
    const warnings: string[] = [];
    globalThis.console = { ...realConsole, warn: (message) => warnings.push(String(message)) };
    try {
      await expect(dispatch(concierge, "directParent")).resolves.toEqual({
        ok: false,
        reason: "precondition_failed",
        message: "Child failed.",
        data: { count: 2 },
      });
      await expect(dispatch(concierge, "ignoredParent")).resolves.toEqual({
        ok: false,
        reason: "precondition_failed",
        message: "Child failed.",
        data: { count: 2 },
      });
      for (const name of ["outerParent", "rejectingParent"]) {
        await expect(dispatch(concierge, name, {}, `${name}-one`)).resolves.toEqual({
          ok: false,
          reason: "invalid_result",
          message: "The action returned an invalid result.",
        });
        await expect(dispatch(concierge, name, {}, `${name}-two`)).resolves.toEqual({
          ok: false,
          reason: "invalid_result",
          message: "The action returned an invalid result.",
        });
      }
      await flushEvents();
    } finally {
      globalThis.console = realConsole;
    }

    expect(directValidations).toBe(1);
    expect(ignoredValidations).toBe(1);
    const parentEvents = events.filter((event) =>
      ["directParent", "ignoredParent", "undeclaredInner", "outerParent", "rejectingParent"]
        .includes(String(event.name)) &&
      ["succeeded", "failed", "cancelled"].includes(String(event.phase))
    );
    expect(parentEvents.filter((event) => event.name === "directParent")[0]?.resultData)
      .toEqual({ kind: "included", value: { count: 2 } });
    expect(parentEvents.filter((event) => event.name === "ignoredParent")[0]?.resultData)
      .toEqual({ kind: "included", value: { count: 2 } });
    expect(parentEvents
      .filter((event) => ["undeclaredInner", "outerParent", "rejectingParent"].includes(String(event.name)))
      .every((event) => JSON.stringify(event.resultData) === JSON.stringify({ kind: "absent" })))
      .toBe(true);

    const warningText = warnings.join("\n");
    expect(warnings.filter((warning) => warning.includes('action "undeclaredInner"'))).toHaveLength(1);
    expect(warnings.filter((warning) => warning.includes('action "rejectingParent"'))).toHaveLength(1);
    expect(warningText).not.toContain("RAW-CHILD-DATA-SECRET");
    expect(warningText).not.toContain("RAW-PARENT-SCHEMA-ISSUE");
  });

  it("preserves terminal child results without weakening their observer policy", async () => {
    const events: Array<Record<string, unknown>> = [];
    const terminalChild = richAction(
      "terminalChild",
      () => ({
        ok: true,
        message: "Terminal child complete.",
        data: { secret: "terminal-child-only" },
      }),
    );
    const concierge = conciergeFor([
      { ...terminalChild, terminal: true },
      richAction(
        "terminalParent",
        async ({ workflow }: { workflow: { run(input: unknown): Promise<unknown> } }) => {
          await workflow.run({ stepId: "terminal", name: "terminalChild", input: {} });
          return { ok: true, message: "Parent complete." };
        },
        undefined,
        "passthrough",
      ),
    ]);
    concierge.onDispatch((event) => events.push(event as unknown as Record<string, unknown>));

    const catalog = concierge.resolveCatalog(CONTEXT);
    const outcome = await concierge.dispatchBatch(CONTEXT, {
      sessionId: "session-terminal",
      responseId: "response-terminal",
      userTurnId: "turn-terminal",
      catalogRevision: catalog.revision,
      calls: [{
        callId: "terminal-parent",
        name: "terminalParent",
        arguments: "{}",
        outputIndex: 0,
      }],
    });
    await flushEvents();

    expect(outcome.kind).toBe("terminal");
    if (outcome.kind !== "terminal") throw new Error("expected terminal outcome");
    expect(outcome.enteredBy.name).toBe("terminalChild");
    expect(outcome.rows[0]?.result).toEqual({
      ok: true,
      message: "Terminal child complete.",
      data: { secret: "terminal-child-only" },
    });
    const terminal = new Map(
      events
        .filter((event) => ["succeeded", "failed", "cancelled"].includes(String(event.phase)))
        .map((event) => [event.name, event]),
    );
    expect(terminal.get("terminalChild")?.resultData).toEqual({ kind: "dropped" });
    expect(terminal.get("terminalParent")?.resultData).toEqual({ kind: "dropped" });
  });

  it("treats explicit undefined data as absent and omits undefined object fields", async () => {
    const concierge = conciergeFor([
      richAction(
        "successWithoutData",
        () => ({ ok: true, message: "Nothing to return.", data: undefined }),
      ),
      richAction(
        "failureWithoutData",
        () => ({
          ok: false,
          reason: "precondition_failed",
          message: "Nothing was available.",
          data: undefined,
        }),
      ),
      action(
        "optionalField",
        () => ({
          ok: true,
          message: "Optional field omitted.",
          data: { id: "x", note: undefined },
        }),
        {
          output: {
            schema: z.object({
              id: z.string(),
              note: z.string().optional(),
            }),
            redact: "drop",
          },
        },
      ),
    ]);

    await expect(dispatch(concierge, "successWithoutData")).resolves.toEqual({
      ok: true,
      message: "Nothing to return.",
    });
    await expect(dispatch(concierge, "failureWithoutData")).resolves.toEqual({
      ok: false,
      reason: "precondition_failed",
      message: "Nothing was available.",
    });
    await expect(dispatch(concierge, "optionalField")).resolves.toEqual({
      ok: true,
      message: "Optional field omitted.",
      data: { id: "x" },
    });
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

  it("governs arrays above 10,000 entries only by their exact JSON byte size", async () => {
    const data = { ids: Array.from({ length: 10_001 }, (_, index) => index) };
    const exactBytes = Buffer.byteLength(JSON.stringify(data), "utf8");
    const accepted = conciergeFor([
      richAction("acceptedLargeArray", () => ({
        ok: true,
        message: "Large array accepted.",
        data,
      })),
    ], { maxActionDataBytes: exactBytes });
    const rejected = conciergeFor([
      richAction("rejectedLargeArray", () => ({
        ok: true,
        message: "Large array rejected.",
        data,
      })),
    ], { maxActionDataBytes: exactBytes - 1 });

    const acceptedResult = await dispatch(accepted, "acceptedLargeArray");
    expect(acceptedResult).toMatchObject({
      ok: true,
      data: { ids: expect.any(Array) },
    });
    const ids = (acceptedResult.data as { ids: number[] }).ids;
    expect(ids).toHaveLength(10_001);
    expect([ids[0], ids.at(-1)]).toEqual([0, 10_000]);
    expect(Object.isFrozen(ids)).toBe(true);

    await expect(dispatch(rejected, "rejectedLargeArray")).resolves.toEqual({
      ok: false,
      reason: "invalid_result",
      message: "The action returned an invalid result.",
    });
  });

  it("fails closed and warns once without exposing rejected structured data", async () => {
    const shared = { value: "RAW-ALIAS-SECRET" };
    const cycle: Record<string, unknown> = {
      secret: "RAW-CYCLE-SECRET",
    };
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
      { value: 1n },
      { value: Symbol("secret") },
      { value: () => "secret" },
      { value: Number.NaN },
      { value: Number.POSITIVE_INFINITY },
    ];
    const warningActions: string[] = [];
    const realConsole = globalThis.console;
    const warnings: string[] = [];
    globalThis.console = {
      ...realConsole,
      warn: (message) => warnings.push(String(message)),
    };

    async function expectRejectedTwice(
      concierge: ReturnType<typeof createConcierge>,
      name: string,
    ) {
      warningActions.push(name);
      const first = await dispatch(concierge, name, {}, `${name}-first`);
      const second = await dispatch(concierge, name, {}, `${name}-second`);
      expect(first).toEqual({
        ok: false,
        reason: "invalid_result",
        message: "The action returned an invalid result.",
      });
      expect(second).toEqual(first);
    }

    try {
      for (const [index, invalidData] of invalidValues.entries()) {
        const name = `invalid${index}`;
        await expectRejectedTwice(conciergeFor([
          richAction(name, () => ({
            ok: true,
            message: "Unsafe.",
            data: invalidData,
          })),
        ]), name);
      }

      await expectRejectedTwice(conciergeFor([
        richAction(
          "rejected",
          () => ({
            ok: true,
            message: "Rejected.",
            data: { raw: "RAW-SCHEMA-SECRET" },
          }),
          () => ({ issues: [{ message: "RAW-SCHEMA-ISSUE-SECRET" }] }),
        ),
      ]), "rejected");

      await expectRejectedTwice(conciergeFor([
        richAction(
          "schemaThrows",
          () => ({
            ok: true,
            message: "Rejected.",
            data: { raw: "RAW-SCHEMA-THROW-DATA-SECRET" },
          }),
          () => {
            throw new Error("RAW-SCHEMA-THROW-SECRET");
          },
        ),
      ]), "schemaThrows");

      await expectRejectedTwice(conciergeFor([
        action("undeclared", () => ({
          ok: true,
          message: "Extra.",
          data: { hidden: "RAW-UNDECLARED-SECRET" },
        })),
      ]), "undeclared");

      await expectRejectedTwice(conciergeFor([
        richAction("oversized", () => ({
          ok: true,
          message: "Large.",
          data: "RAW-OVERSIZED-SECRET",
        })),
      ], { maxActionDataBytes: 5 }), "oversized");
    } finally {
      globalThis.console = realConsole;
    }

    expect(accessorReads).toBe(0);
    expect(warnings).toHaveLength(warningActions.length);
    for (const name of warningActions) {
      expect(warnings.some((warning) =>
        warning.includes(`action "${name}"`) &&
        warning.includes("[invalid_result]") &&
        warning.includes("maxActionDataBytes")
      )).toBe(true);
    }
    const warningText = warnings.join("\n");
    for (const secret of [
      "RAW-ACCESSOR-SECRET",
      "RAW-ALIAS-SECRET",
      "RAW-CYCLE-SECRET",
      "RAW-SCHEMA-SECRET",
      "RAW-SCHEMA-ISSUE-SECRET",
      "RAW-SCHEMA-THROW-DATA-SECRET",
      "RAW-SCHEMA-THROW-SECRET",
      "RAW-UNDECLARED-SECRET",
      "RAW-OVERSIZED-SECRET",
    ]) {
      expect(warningText).not.toContain(secret);
    }
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
