import { createOpenAIRealtimeCodec } from "@full-self-browsing/concierge/openai-realtime";
import type {
  BatchDispatchOutcome,
  EmittedTool,
  ToolBatch,
} from "@full-self-browsing/concierge";
import { asRecord, ownData, validIdentifier } from "../host.js";
import type {
  RealtimeBatchSource,
  RealtimeCatalogPublication,
  RealtimeForeignTool,
  RealtimePlaybackEvent,
  RealtimeProvider,
  RealtimeSignal,
  RealtimeWireEvent,
} from "../types.js";

export interface OpenAIRealtimeProviderOptions {
  /** `session.type`. Omitting it makes the provider reject every update. */
  readonly sessionType?: string | undefined;
  /** Prefix for `event_id` echo attribution. Default `"concierge-su-"`. */
  readonly correlationIdPrefix?: string | undefined;
  readonly toolChoice?: "auto" | "none" | "required" | undefined;
  /**
   * Strip `$schema`/`$id` from emitted tool parameters on the way to the wire.
   * Default `true`. Done here, not in core's emitter, so `explain()` and the
   * wire never disagree about what the agent was shown.
   */
  readonly stripSchemaDialectKeys?: boolean | undefined;
}

const DEFAULT_CORRELATION_PREFIX: string = "concierge-su-";
const FOLLOW_UP: RealtimeWireEvent = Object.freeze({ type: "response.create" });
const INTERRUPT: RealtimeWireEvent = Object.freeze({ type: "response.cancel" });

function stripDialectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(stripDialectKeys));
  }
  if (typeof value !== "object" || value === null) return value;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === "$schema" || key === "$id") continue;
    result[key] = stripDialectKeys(entry);
  }
  return Object.freeze(result);
}

function readString(record: object, key: string): string | null {
  const value: unknown = ownData(record, key);
  return validIdentifier(value) ? value : null;
}

function readNested(record: object, key: string): object | null {
  return asRecord(ownData(record, key));
}

function playbackEvent(
  kind: RealtimePlaybackEvent["kind"],
  responseId: string,
): RealtimeSignal {
  return Object.freeze({
    kind: "playback",
    event: Object.freeze({ kind, responseId }),
  });
}

function isToolsParam(param: unknown): boolean {
  return typeof param === "string" && param.startsWith("session.tools[");
}

/**
 * OpenAI Realtime provider. The three encode/decode primitives that touch
 * catalog tools and completed batches are the shipped core codec.
 */
export function createOpenAIRealtimeProvider(
  options?: OpenAIRealtimeProviderOptions,
): RealtimeProvider {
  const codec = createOpenAIRealtimeCodec();
  const sessionType: string | undefined = options?.sessionType;
  const correlationIdPrefix: string =
    options?.correlationIdPrefix ?? DEFAULT_CORRELATION_PREFIX;
  const toolChoice: "auto" | "none" | "required" | undefined =
    options?.toolChoice;
  const stripSchemaDialectKeys: boolean =
    options?.stripSchemaDialectKeys !== false;
  const strippedCache: WeakMap<
    ReadonlyArray<EmittedTool>,
    ReadonlyArray<RealtimeForeignTool>
  > = new WeakMap();

  const toWireTools = (
    publication: RealtimeCatalogPublication,
  ): ReadonlyArray<RealtimeForeignTool> => {
    const sessionTools = codec.toSessionTools(publication.catalog);
    let catalogTools: ReadonlyArray<RealtimeForeignTool>;
    if (stripSchemaDialectKeys) {
      const cached: ReadonlyArray<RealtimeForeignTool> | undefined =
        strippedCache.get(publication.catalog.tools);
      if (cached !== undefined) {
        catalogTools = cached;
      } else {
        catalogTools = Object.freeze(
          sessionTools.map((tool) =>
            Object.freeze({
              type: tool.type,
              name: tool.name,
              description: tool.description,
              parameters: stripDialectKeys(tool.parameters),
            }),
          ),
        );
        strippedCache.set(publication.catalog.tools, catalogTools);
      }
    } else {
      catalogTools = Object.freeze(
        sessionTools.map((tool) =>
          Object.freeze({
            type: tool.type,
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          }),
        ),
      );
    }
    const foreign: ReadonlyArray<RealtimeForeignTool> =
      publication.foreignTools ?? [];
    return Object.freeze([...catalogTools, ...foreign]);
  };

  return Object.freeze({
    id: "openai",
    playback: "provider-signalled",
    echoesCorrelationId: false,
    decode(event: unknown): RealtimeSignal {
      const record: object | null = asRecord(event);
      if (record === null) return Object.freeze({ kind: "ignored" });
      const type: unknown = ownData(record, "type");
      if (typeof type !== "string") return Object.freeze({ kind: "ignored" });

      switch (type) {
        case "session.created":
          return Object.freeze({ kind: "session.ready" });
        case "session.updated":
          if (sessionType === undefined) {
            return Object.freeze({
              kind: "session.rejected",
              correlationId: readString(record, "event_id"),
              recoverable: true,
              message: "Session type was not declared.",
            });
          }
          return Object.freeze({
            kind: "session.configured",
            correlationId: readString(record, "event_id"),
          });
        case "error": {
          const error: object | null = readNested(record, "error");
          const param: unknown = error === null ? undefined : ownData(error, "param");
          const echoed: string | null =
            error === null ? null : readString(error, "event_id");
          const message: string =
            error !== null && typeof ownData(error, "message") === "string"
              ? (ownData(error, "message") as string)
              : "The realtime provider reported an error.";
          const catalogRejection: boolean =
            isToolsParam(param) ||
            (echoed !== null && echoed.startsWith(correlationIdPrefix));
          if (catalogRejection) {
            return Object.freeze({
              kind: "session.rejected",
              correlationId: echoed,
              recoverable: true,
              message,
            });
          }
          return Object.freeze({
            kind: "error",
            recoverable: false,
            message,
          });
        }
        case "input_audio_buffer.speech_started": {
          const turnId: string | null = readString(record, "item_id");
          return turnId === null
            ? Object.freeze({ kind: "ignored" })
            : Object.freeze({ kind: "turn.started", turnId });
        }
        case "input_audio_buffer.committed": {
          const turnId: string | null = readString(record, "item_id");
          return turnId === null
            ? Object.freeze({ kind: "ignored" })
            : Object.freeze({ kind: "turn.committed", turnId });
        }
        case "conversation.item.input_audio_transcription.completed": {
          const turnId: string | null = readString(record, "item_id");
          const text: unknown = ownData(record, "transcript");
          return turnId === null || typeof text !== "string"
            ? Object.freeze({ kind: "ignored" })
            : Object.freeze({ kind: "turn.transcribed", turnId, text });
        }
        case "conversation.item.input_audio_transcription.failed": {
          const turnId: string | null = readString(record, "item_id");
          return turnId === null
            ? Object.freeze({ kind: "ignored" })
            : Object.freeze({ kind: "turn.transcription_failed", turnId });
        }
        case "response.created": {
          const response: object | null = readNested(record, "response");
          const responseId: string | null =
            response === null ? null : readString(response, "id");
          return responseId === null
            ? Object.freeze({ kind: "ignored" })
            : Object.freeze({ kind: "response.created", responseId });
        }
        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done": {
          const responseId: string | null = readString(record, "response_id");
          const text: unknown = ownData(record, "transcript");
          return responseId === null || typeof text !== "string"
            ? Object.freeze({ kind: "ignored" })
            : Object.freeze({ kind: "response.transcript", responseId, text });
        }
        case "response.done": {
          const response: object | null = readNested(record, "response");
          const responseId: string | null =
            response === null ? null : readString(response, "id");
          if (responseId === null) return Object.freeze({ kind: "ignored" });
          const status: unknown =
            response === null ? undefined : ownData(response, "status");
          return status === "completed"
            ? Object.freeze({
                kind: "response.completed",
                responseId,
                raw: event,
              })
            : Object.freeze({ kind: "response.aborted", responseId });
        }
        case "output_audio_buffer.started": {
          const responseId: string | null = readString(record, "response_id");
          return responseId === null
            ? Object.freeze({ kind: "ignored" })
            : playbackEvent("started", responseId);
        }
        case "output_audio_buffer.stopped": {
          const responseId: string | null = readString(record, "response_id");
          return responseId === null
            ? Object.freeze({ kind: "ignored" })
            : playbackEvent("drained", responseId);
        }
        case "output_audio_buffer.cleared": {
          const responseId: string | null = readString(record, "response_id");
          return responseId === null
            ? Object.freeze({ kind: "ignored" })
            : playbackEvent("cleared", responseId);
        }
        default:
          return Object.freeze({ kind: "ignored" });
      }
    },
    encodeCatalog(publication: RealtimeCatalogPublication): RealtimeWireEvent {
      const session: Record<string, unknown> = {
        tools: toWireTools(publication),
      };
      if (sessionType !== undefined) session.type = sessionType;
      if (toolChoice !== undefined) session.tool_choice = toolChoice;
      return Object.freeze({
        type: "session.update",
        event_id: publication.correlationId,
        session: Object.freeze(session),
      });
    },
    extractBatch(source: RealtimeBatchSource): ToolBatch | null {
      return codec.extractCompletedBatch({
        response: source.raw,
        sessionId: source.sessionId,
        userTurnId: source.userTurnId,
        catalogRevision: source.catalogRevision,
        signal: source.signal,
        deferUntilDelivered: source.deferUntilDelivered,
      });
    },
    encodeToolResults(
      outcome: BatchDispatchOutcome,
    ): ReadonlyArray<RealtimeWireEvent> {
      return Object.freeze(
        codec.toFunctionCallOutputEvents(outcome).map((event) =>
          Object.freeze({
            type: event.type,
            item: event.item,
          }),
        ),
      );
    },
    encodeFollowUp(): RealtimeWireEvent | null {
      return FOLLOW_UP;
    },
    encodeUserText(text: string): ReadonlyArray<RealtimeWireEvent> {
      return Object.freeze([
        Object.freeze({
          type: "conversation.item.create",
          item: Object.freeze({
            type: "message",
            role: "user",
            content: Object.freeze([
              Object.freeze({ type: "input_text", text }),
            ]),
          }),
        }),
        FOLLOW_UP,
      ]);
    },
    encodeInterrupt(): RealtimeWireEvent | null {
      return INTERRUPT;
    },
  });
}
