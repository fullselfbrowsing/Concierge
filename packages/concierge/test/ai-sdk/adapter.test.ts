import { beforeEach, describe, expect, it } from "vitest";

import {
  ConciergeAISDKCorrelationError,
  createAISDKAdapter,
  toAISDKTools,
} from "../../dist/ai-sdk/index.js";
import {
  emittedTool,
  fakeConcierge,
  resetContract,
} from "./helpers.js";

beforeEach(resetContract);

describe("AI SDK-neutral tool and step adapter", () => {
  it("emits frozen definition-only tools without execute authority", () => {
    const tools = toAISDKTools([emittedTool("setTheme")]);

    expect(Object.getPrototypeOf(tools)).toBeNull();
    expect(Object.isFrozen(tools)).toBe(true);
    expect(Object.keys(tools)).toEqual(["setTheme"]);
    expect(tools.setTheme).not.toHaveProperty("execute");
    expect(tools.setTheme).toMatchObject({ description: "Run setTheme." });
  });

  it("memoizes one tool set and digest for an identical core resolution", async () => {
    const revision = Symbol("catalog");
    const emitted = Object.freeze([emittedTool("setTheme")]);
    const concierge = fakeConcierge(() => ({
      stage: "settings",
      revision,
      tools: emitted,
    }));
    const adapter = createAISDKAdapter({ concierge });

    const first = await adapter.resolveCatalog({ pathname: "/settings" });
    const second = await adapter.resolveCatalog({ pathname: "/settings?tab=1" });

    expect(first.aiTools).toBe(second.aiTools);
    expect(first.digest).toBe(second.digest);
    expect(first.digest).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(first.revision).toBe(revision);
  });

  it("strictly canonicalizes inputs and rejects unsupported AI SDK call variants", async () => {
    const revision = Symbol("catalog");
    const emitted = Object.freeze([emittedTool("setTheme")]);
    const adapter = createAISDKAdapter({
      concierge: fakeConcierge(() => ({
        stage: "settings",
        revision,
        tools: emitted,
      })),
    });
    const catalog = await adapter.resolveCatalog({});
    const prepared = adapter.prepareStep({
      catalog,
      responseId: "response-1",
      userTurnId: "turn-1",
      toolCalls: [{
        toolCallId: "call-1",
        toolName: "setTheme",
        input: {
          z: -0,
          b: 1e+30,
          a: 0.002,
        },
      }],
    });

    expect(prepared.kind).toBe("ready");
    if (prepared.kind !== "ready") throw new Error("Expected a prepared step.");
    expect(prepared.value.batch.calls[0]?.arguments).toBe(
      '{"a":0.002,"b":1e+30,"z":0}',
    );
    expect(Object.isFrozen(prepared.value.batch.calls)).toBe(true);
    expect(adapter.prepareStep({
      catalog,
      responseId: "response-2",
      userTurnId: "turn-2",
      toolCalls: [{
        toolCallId: "call-2",
        toolName: "setTheme",
        input: {},
        providerExecuted: true,
      }],
    })).toMatchObject({ kind: "invalid", code: "unsupported_call" });
    for (const flags of [
      { dynamic: "yes" },
      { invalid: 1 },
      { providerExecuted: {} },
    ]) {
      expect(adapter.prepareStep({
        catalog,
        responseId: "hostile-flags",
        userTurnId: "turn-hostile-flags",
        toolCalls: [{
          toolCallId: "call-hostile-flags",
          toolName: "setTheme",
          input: {},
          ...flags,
        } as never],
      })).toMatchObject({ kind: "invalid", code: "unsupported_call" });
    }
  });

  it("matches RFC 8785 number, escaping, and UTF-16 property ordering vectors", async () => {
    const emitted = Object.freeze([emittedTool("record")]);
    const adapter = createAISDKAdapter({
      concierge: fakeConcierge(() => ({
        stage: null,
        revision: Symbol("catalog"),
        tools: emitted,
      })),
    });
    const catalog = await adapter.resolveCatalog({});
    const prepared = adapter.prepareStep({
      catalog,
      responseId: "rfc-8785",
      userTurnId: "turn-rfc-8785",
      toolCalls: [{
        toolCallId: "call-rfc-8785",
        toolName: "record",
        input: {
          "\ufb33": "Hebrew",
          "😀": "Emoji",
          "€": "Euro",
          "ö": "Latin",
          "\u0080": "Control",
          "1": "One",
          "\r": "Carriage Return",
          numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 1e-27],
          escaped: "€$\u000f\nA'B\"\\\"/",
        },
      }],
    });
    if (prepared.kind !== "ready") throw new Error("Expected ready.");

    expect(prepared.value.batch.calls[0]?.arguments).toBe(
      '{"\\r":"Carriage Return","1":"One",' +
      '"escaped":"€$\\u000f\\nA\'B\\\"\\\\\\\"/","numbers":' +
      '[333333333.3333333,1e+30,4.5,0.002,1e-27],"":"Control",' +
      '"ö":"Latin","€":"Euro",' +
      '"😀":"Emoji","דּ":"Hebrew"}',
    );
  });

  it("never invokes getters and rejects cycles, sparse arrays, and lone surrogates", async () => {
    const emitted = Object.freeze([emittedTool("setTheme")]);
    const adapter = createAISDKAdapter({
      concierge: fakeConcierge(() => ({
        stage: null,
        revision: Symbol("catalog"),
        tools: emitted,
      })),
    });
    const catalog = await adapter.resolveCatalog({});
    let getterCalls = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, "value", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return "secret";
      },
    });
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    const withToJSON = { value: "x", toJSON: () => ({ value: "other" }) };
    const withSymbolKey: Record<PropertyKey, unknown> = { value: "x" };
    withSymbolKey[Symbol("hidden")] = "secret";
    const invalidInputs: unknown[] = [
      accessor,
      cycle,
      new Array(1),
      "\ud800",
      { value: undefined },
      1n,
      Number.POSITIVE_INFINITY,
      withToJSON,
      withSymbolKey,
      Symbol("value"),
    ];

    for (const [index, input] of invalidInputs.entries()) {
      expect(adapter.prepareStep({
        catalog,
        responseId: `response-${index}`,
        userTurnId: `turn-${index}`,
        toolCalls: [{
          toolCallId: `call-${index}`,
          toolName: "setTheme",
          input,
        }],
      }), `invalid input ${index}`).toMatchObject({
        kind: "invalid",
        code: "invalid_input",
      });
    }
    expect(getterCalls).toBe(0);
    const shared: Record<string, unknown> = { value: "x" };
    expect(adapter.prepareStep({
      catalog,
      responseId: "alias-response",
      userTurnId: "alias-turn",
      toolCalls: [{
        toolCallId: "alias-call",
        toolName: "setTheme",
        input: { first: shared, second: shared },
      }],
    }).kind).toBe("ready");
  });

  it("never invokes completed-call accessors or accepts extra call fields", async () => {
    const emitted = Object.freeze([emittedTool("setTheme")]);
    const adapter = createAISDKAdapter({
      concierge: fakeConcierge(() => ({
        stage: null,
        revision: Symbol("catalog"),
        tools: emitted,
      })),
    });
    const catalog = await adapter.resolveCatalog({});
    let getterCalls = 0;
    const accessorCall: Record<string, unknown> = {
      toolCallId: "call-accessor",
      toolName: "setTheme",
    };
    Object.defineProperty(accessorCall, "input", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return {};
      },
    });

    expect(adapter.prepareStep({
      catalog,
      responseId: "response-accessor",
      userTurnId: "turn-accessor",
      toolCalls: [accessorCall as never],
    })).toMatchObject({ kind: "invalid", code: "invalid_call" });
    expect(adapter.prepareStep({
      catalog,
      responseId: "response-extra-field",
      userTurnId: "turn-extra-field",
      toolCalls: [{
        toolCallId: "call-extra-field",
        toolName: "setTheme",
        input: {},
        execute: () => undefined,
      } as never],
    })).toMatchObject({ kind: "invalid", code: "invalid_call" });
    expect(getterCalls).toBe(0);
  });

  it("correlates completed reports exactly before releasing AI SDK results", async () => {
    const revision = Symbol("catalog");
    const emitted = Object.freeze([emittedTool("setTheme")]);
    const adapter = createAISDKAdapter({
      concierge: fakeConcierge(() => ({ stage: null, revision, tools: emitted })),
    });
    const catalog = await adapter.resolveCatalog({});
    const preparedResult = adapter.prepareStep({
      catalog,
      responseId: "response-1",
      userTurnId: "turn-1",
      toolCalls: [{
        toolCallId: "call-1",
        toolName: "setTheme",
        input: { value: "dark" },
      }],
    });
    if (preparedResult.kind !== "ready") throw new Error("Expected ready.");
    const identity = {
      keyId: "key-1",
      audience: "example.test",
      sessionId: "session-1",
      catalogStage: null,
      catalogDigest: catalog.digest,
      issuedAt: 1,
      expiresAt: 2,
      nonce: "nonce",
      responseId: "response-1",
    };
    const report = {
      kind: "completed",
      identity,
      rows: [{
        callId: "call-1",
        name: "setTheme",
        outputIndex: 0,
        result: {
          ok: true,
          message: "Theme changed.",
          data: { theme: "dark", applied: true },
        },
      }],
    };

    expect(adapter.toToolResultParts(preparedResult.value, report)).toEqual([{
      type: "tool-result",
      toolCallId: "call-1",
      toolName: "setTheme",
      output: {
        type: "json",
        value: {
          ok: true,
          message: "Theme changed.",
          data: { theme: "dark", applied: true },
        },
      },
    }]);
    expect(adapter.toToolOutputUpdates(preparedResult.value, report)).toEqual([{
      tool: "setTheme",
      toolCallId: "call-1",
      output: {
        ok: true,
        message: "Theme changed.",
        data: { theme: "dark", applied: true },
      },
    }]);
    expect(() => adapter.toToolResultParts(preparedResult.value, {
      ...report,
      rows: [{ ...report.rows[0], callId: "attacker-call" }],
    })).toThrow(ConciergeAISDKCorrelationError);
  });

  it("rejects unknown tools and duplicate call ids without dispatch authority", async () => {
    let dispatches = 0;
    const emitted = Object.freeze([emittedTool("setTheme")]);
    const adapter = createAISDKAdapter({
      concierge: fakeConcierge(
        () => ({
          stage: null,
          revision: Symbol("catalog"),
          tools: emitted,
        }),
        async () => {
          dispatches += 1;
          return { kind: "completed", rows: [] };
        },
      ),
    });
    const catalog = await adapter.resolveCatalog({});
    expect(adapter.prepareStep({
      catalog,
      responseId: "unknown",
      userTurnId: "turn-unknown",
      toolCalls: [{
        toolCallId: "call-unknown",
        toolName: "notExposed",
        input: {},
      }],
    })).toMatchObject({ kind: "invalid", code: "unknown_tool" });
    expect(adapter.prepareStep({
      catalog,
      responseId: "duplicates",
      userTurnId: "turn-duplicates",
      toolCalls: [
        { toolCallId: "same", toolName: "setTheme", input: {} },
        { toolCallId: "same", toolName: "setTheme", input: {} },
      ],
    })).toMatchObject({ kind: "invalid", code: "duplicate_call_id" });
    expect(dispatches).toBe(0);
  });
});
