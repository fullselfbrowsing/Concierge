import { beforeEach, describe, expect, it } from "vitest";

import { createConcierge } from "../dist/index.js";
import { createOpenAIRealtimeCodec } from "../dist/openai-realtime/index.js";

const CONTRACT_KEY = Symbol.for("@fullselfbrowsing/concierge.contract");

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[CONTRACT_KEY];
});

function completedResponse(output: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    type: "response.done",
    response: {
      id: "response-1",
      status: "completed",
      output,
      ...overrides,
    },
  };
}

function functionCall(callId: string, name: string, argumentsText: string) {
  return {
    type: "function_call",
    status: "completed",
    call_id: callId,
    name,
    arguments: argumentsText,
  };
}

function schema() {
  return {
    "~standard": {
      version: 1,
      vendor: "openai-realtime-test",
      validate: (value: unknown) => ({ value }),
    },
  };
}

describe("OpenAI Realtime protocol codec", () => {
  it("publishes catalog tools and extracts every completed function call in response order", () => {
    const codec = createOpenAIRealtimeCodec();
    const revision = Symbol("acknowledged-catalog");
    const tools = Object.freeze([Object.freeze({
      type: "function",
      name: "searchHotels",
      description: "Search for hotels.",
      parameters: Object.freeze({ type: "object", properties: Object.freeze({}) }),
    })]);
    const catalog = Object.freeze({ stage: "results", revision, tools });

    const sessionTools = codec.toSessionTools(catalog);
    expect(sessionTools).toEqual(tools);
    expect(sessionTools).toBe(codec.toSessionTools(catalog));
    expect(Object.isFrozen(sessionTools)).toBe(true);
    expect(Object.isFrozen(sessionTools[0])).toBe(true);

    const event = completedResponse([
      { type: "message", status: "completed", content: [] },
      functionCall("call-search", "searchHotels", "{\"city\":\"Oslo\"}"),
      { type: "message", status: "completed", content: [] },
      functionCall("call-map", "showMap", "{\"hotelId\":\"h-1\"}"),
    ]);
    const batch = codec.extractCompletedBatch({
      response: event,
      sessionId: "session-1",
      userTurnId: "turn-1",
      catalogRevision: revision,
    });

    expect(batch).toEqual({
      sessionId: "session-1",
      responseId: "response-1",
      userTurnId: "turn-1",
      catalogRevision: revision,
      calls: [
        {
          callId: "call-search",
          name: "searchHotels",
          arguments: "{\"city\":\"Oslo\"}",
          outputIndex: 1,
        },
        {
          callId: "call-map",
          name: "showMap",
          arguments: "{\"hotelId\":\"h-1\"}",
          outputIndex: 3,
        },
      ],
    });
    expect(Object.isFrozen(batch)).toBe(true);
    expect(Object.isFrozen(batch?.calls)).toBe(true);
  });

  it("fails closed for duplicates, malformed call records, and non-completed responses", () => {
    const codec = createOpenAIRealtimeCodec();
    const base = {
      sessionId: "session-1",
      userTurnId: "turn-1",
      catalogRevision: Symbol("catalog"),
    };
    expect(codec.extractCompletedBatch({
      ...base,
      response: completedResponse([
        functionCall("duplicate", "first", "{}"),
        functionCall("duplicate", "second", "{}"),
      ]),
    })).toBeNull();
    expect(codec.extractCompletedBatch({
      ...base,
      response: completedResponse([
        { ...functionCall("incomplete", "first", "{}"), status: "in_progress" },
      ]),
    })).toBeNull();
    expect(codec.extractCompletedBatch({
      ...base,
      response: completedResponse(
        [functionCall("cancelled", "first", "{}")],
        { status: "cancelled" },
      ),
    })).toBeNull();
    expect(codec.extractCompletedBatch({
      ...base,
      response: {
        type: "response.output_item.done",
        response: completedResponse([]).response,
      },
    })).toBeNull();

    let accessorReads = 0;
    const hostile: Record<string, unknown> = {
      type: "function_call",
      status: "completed",
      call_id: "call-hostile",
      name: "hostile",
    };
    Object.defineProperty(hostile, "arguments", {
      enumerable: true,
      get() {
        accessorReads += 1;
        return "{}";
      },
    });
    expect(codec.extractCompletedBatch({
      ...base,
      response: completedResponse([hostile]),
    })).toBeNull();
    expect(accessorReads).toBe(0);
  });

  it("lets core classify malformed argument JSON and rejects a stale catalog revision", async () => {
    let activePage = "old";
    const action = {
      name: "search",
      description: "Search for hotels.",
      schema: schema(),
      jsonSchema: { type: "object" },
      redact: "drop",
      effects: { readOnly: true },
      handler: () => ({ ok: true, message: "Searched." }),
      availableWhen: () => activePage === "old",
    };
    const concierge = createConcierge({
      stages: [{ id: "active", match: () => true, actions: [action] }],
    });
    const oldCatalog = concierge.resolveCatalog({ page: "old" });
    const codec = createOpenAIRealtimeCodec();
    const malformed = codec.extractCompletedBatch({
      response: completedResponse([functionCall("bad-json", "search", "{")]),
      sessionId: "session-1",
      userTurnId: "turn-1",
      catalogRevision: oldCatalog.revision,
    });
    if (malformed === null) throw new Error("Expected a raw completed batch.");
    const malformedOutcome = await concierge.dispatchBatch({ page: "old" }, malformed);
    expect(malformedOutcome.rows[0]?.result).toMatchObject({
      ok: false,
      reason: "invalid_args",
    });

    activePage = "new";
    const currentCatalog = concierge.resolveCatalog({ page: "new" });
    expect(currentCatalog.revision).not.toBe(oldCatalog.revision);
    const stale = codec.extractCompletedBatch({
      response: completedResponse([functionCall("stale", "search", "{}")]),
      sessionId: "session-1",
      userTurnId: "turn-2",
      catalogRevision: oldCatalog.revision,
    });
    if (stale === null) throw new Error("Expected a raw completed batch.");
    const staleOutcome = await concierge.dispatchBatch({ page: "new" }, stale);
    expect(staleOutcome.rows[0]?.result).toMatchObject({
      ok: false,
      reason: "catalog_stale",
    });
  });

  it("encodes structured results once with exact call ids and emits nothing for terminal outcomes", () => {
    const codec = createOpenAIRealtimeCodec();
    const completed = {
      kind: "completed",
      rows: [
        {
          dispatchId: "dispatch-1",
          callId: "original-call-id",
          name: "search",
          outputIndex: 4,
          result: {
            ok: true,
            message: "Found hotels.",
            data: { kind: "visible-results", hotels: [] },
          },
        },
      ],
    } as const;
    const events = codec.toFunctionCallOutputEvents(completed);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: "original-call-id",
      },
    });
    expect(JSON.parse(events[0]?.item.output ?? "null")).toEqual(completed.rows[0].result);
    expect(JSON.parse(events[0]?.item.output ?? "null").data).not.toBeTypeOf("string");
    expect(events.some((event) => event.type === ("response.create" as never))).toBe(false);

    expect(codec.toFunctionCallOutputEvents({
      kind: "terminal",
      rows: completed.rows,
      enteredBy: {
        dispatchId: "dispatch-1",
        callId: "original-call-id",
        name: "search",
        outputIndex: 4,
        lineage: { rootDispatchId: "dispatch-1", depth: 0 },
      },
    })).toEqual([]);
  });
});
