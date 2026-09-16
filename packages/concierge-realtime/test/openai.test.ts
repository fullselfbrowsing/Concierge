import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createOpenAIRealtimeProvider } from "../src/openai/index.js";
import { resetContract } from "./fixtures.js";

const CORE_URL = new URL("../../concierge/dist/index.js", import.meta.url);

let createConcierge;

beforeAll(async () => {
  if (!existsSync(fileURLToPath(CORE_URL))) {
    throw new Error("Build @full-self-browsing/concierge before testing openai.");
  }
  ({ createConcierge } = await import(CORE_URL.href));
});

beforeEach(() => {
  resetContract();
});

function catalogFor(create) {
  const concierge = create({
    stages: [
      {
        id: "active",
        match: () => true,
        actions: [
          {
            name: "lookup",
            description: "Look up an item.",
            schema: {
              "~standard": {
                version: 1,
                vendor: "realtime-openai-test",
                validate: (value) => ({ value }),
              },
            },
            jsonSchema: {
              type: "object",
              $schema: "https://json-schema.org/draft/2020-12/schema",
              $id: "lookup",
              properties: {},
            },
            redact: "drop",
            effects: { readOnly: true },
            handler: () => ({ ok: true, message: "Done." }),
          },
        ],
      },
    ],
  });
  return concierge.resolveCatalog({ page: "active" });
}

describe("createOpenAIRealtimeProvider", () => {
  it("consumes all three core codec methods on the catalog, batch, and result path", () => {
    const provider = createOpenAIRealtimeProvider({ sessionType: "realtime" });
    const catalog = catalogFor(createConcierge);
    const encoded = provider.encodeCatalog({
      catalog,
      foreignTools: [{ type: "function", name: "serverLookup" }],
      correlationId: "concierge-su-1",
    });
    expect(encoded).toMatchObject({
      type: "session.update",
      event_id: "concierge-su-1",
      session: { type: "realtime" },
    });
    const tools = encoded.session.tools;
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.some((tool) => tool.name === "lookup")).toBe(true);
    expect(tools.some((tool) => tool.name === "serverLookup")).toBe(true);
    const lookup = tools.find((tool) => tool.name === "lookup");
    expect(lookup?.parameters).not.toHaveProperty("$schema");
    expect(lookup?.parameters).not.toHaveProperty("$id");

    const batch = provider.extractBatch({
      raw: {
        type: "response.done",
        response: {
          id: "resp-1",
          status: "completed",
          output: [
            {
              type: "function_call",
              status: "completed",
              call_id: "call-1",
              name: "lookup",
              arguments: "{}",
            },
          ],
        },
      },
      sessionId: "session-1",
      userTurnId: "turn-1",
      catalogRevision: catalog.revision,
      signal: { aborted: false, addEventListener() {}, removeEventListener() {} },
      deferUntilDelivered: undefined,
    });
    expect(batch).toMatchObject({
      responseId: "resp-1",
      userTurnId: "turn-1",
      calls: [{ callId: "call-1", name: "lookup" }],
    });

    const results = provider.encodeToolResults({
      kind: "completed",
      rows: [
        {
          dispatchId: "d1",
          callId: "call-1",
          name: "lookup",
          outputIndex: 0,
          result: { ok: true, message: "Done." },
        },
      ],
    });
    expect(results).toEqual([
      expect.objectContaining({
        type: "conversation.item.create",
        item: expect.objectContaining({
          type: "function_call_output",
          call_id: "call-1",
        }),
      }),
    ]);
    expect(provider.encodeFollowUp()).toEqual({ type: "response.create" });
    expect(provider.encodeInterrupt()).toEqual({ type: "response.cancel" });
  });

  it("rejects every session.updated when sessionType is omitted", () => {
    const provider = createOpenAIRealtimeProvider();
    expect(provider.decode({ type: "session.updated", event_id: "evt-1" })).toEqual({
      kind: "session.rejected",
      correlationId: "evt-1",
      recoverable: true,
      message: "Session type was not declared.",
    });
  });

  it("decodes the OpenAI event taxonomy into the neutral signal set", () => {
    const provider = createOpenAIRealtimeProvider({
      sessionType: "realtime",
      correlationIdPrefix: "concierge-su-",
    });
    expect(provider.decode({ type: "session.created" })).toEqual({
      kind: "session.ready",
    });
    expect(provider.decode({ type: "session.updated", event_id: "srv-1" })).toEqual({
      kind: "session.configured",
      correlationId: "srv-1",
    });
    expect(
      provider.decode({
        type: "error",
        error: {
          message: "bad tool",
          param: "session.tools[0].parameters",
          event_id: "concierge-su-9",
        },
      }),
    ).toEqual({
      kind: "session.rejected",
      correlationId: "concierge-su-9",
      recoverable: true,
      message: "bad tool",
    });
    expect(
      provider.decode({
        type: "error",
        error: { message: "fatal", event_id: "other" },
      }),
    ).toEqual({ kind: "error", recoverable: false, message: "fatal" });
    expect(
      provider.decode({
        type: "input_audio_buffer.speech_started",
        item_id: "item-1",
      }),
    ).toEqual({ kind: "turn.started", turnId: "item-1" });
    expect(
      provider.decode({
        type: "conversation.item.input_audio_transcription.completed",
        item_id: "item-1",
        transcript: "hello",
      }),
    ).toEqual({ kind: "turn.transcribed", turnId: "item-1", text: "hello" });
    expect(
      provider.decode({
        type: "response.created",
        response: { id: "resp-1" },
      }),
    ).toEqual({ kind: "response.created", responseId: "resp-1" });
    expect(
      provider.decode({
        type: "response.output_audio_transcript.done",
        response_id: "resp-1",
        transcript: "Hi.",
      }),
    ).toEqual({
      kind: "response.transcript",
      responseId: "resp-1",
      text: "Hi.",
    });
    expect(
      provider.decode({
        type: "output_audio_buffer.stopped",
        response_id: "resp-1",
      }),
    ).toEqual({
      kind: "playback",
      event: { kind: "drained", responseId: "resp-1" },
    });
    expect(
      provider.decode({
        type: "response.done",
        response: { id: "resp-1", status: "cancelled" },
      }),
    ).toEqual({ kind: "response.aborted", responseId: "resp-1" });
    expect(provider.decode({ type: "response.function_call_arguments.delta" })).toEqual({
      kind: "ignored",
    });
  });

  it("does not inspect accessors on hostile event records", () => {
    const provider = createOpenAIRealtimeProvider({ sessionType: "realtime" });
    let reads = 0;
    const hostile = { type: "input_audio_buffer.speech_started" };
    Object.defineProperty(hostile, "item_id", {
      enumerable: true,
      get() {
        reads += 1;
        return "item-1";
      },
    });
    expect(provider.decode(hostile)).toEqual({ kind: "ignored" });
    expect(reads).toBe(0);
  });
});
