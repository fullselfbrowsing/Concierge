import type {
  BatchDispatchOutcome,
  ToolBatch,
} from "@full-self-browsing/concierge";
import type {
  RealtimeChannel,
  RealtimeChannelState,
  RealtimeProvider,
  RealtimeSignal,
  RealtimeWireEvent,
} from "../src/types.js";

const CONTRACT_KEY = Symbol.for("@fullselfbrowsing/concierge.contract");

export function resetContract(): void {
  delete (globalThis as Record<symbol, unknown>)[CONTRACT_KEY];
}

export function schema() {
  return {
    "~standard": {
      version: 1,
      vendor: "concierge-realtime-test",
      validate: (value: unknown) => ({ value }),
    },
  };
}

export function action(
  name: string,
  handler: () => { ok: boolean; message: string },
) {
  return {
    name,
    description: `Run ${name}.`,
    schema: schema(),
    jsonSchema: { type: "object" },
    redact: "drop",
    effects: { readOnly: true },
    handler,
  };
}

export interface FakeChannel {
  readonly channel: RealtimeChannel;
  readonly sent: RealtimeWireEvent[];
  emit(event: unknown): void;
  setSendResult(next: boolean): void;
  setAutoAck(next: boolean): void;
}

export function createFakeChannel(autoAck = true): FakeChannel {
  let state: RealtimeChannelState = "idle";
  let sendResult = true;
  let shouldAck = autoAck;
  const sent: RealtimeWireEvent[] = [];
  const eventListeners = new Set<(event: unknown) => void>();
  const stateListeners = new Set<
    (state: RealtimeChannelState) => void
  >();

  const emit = (event: unknown): void => {
    for (const listener of [...eventListeners]) listener(event);
  };

  const channel: RealtimeChannel = {
    get state() {
      return state;
    },
    async open() {
      state = "opening";
      state = "open";
      for (const listener of [...stateListeners]) listener(state);
    },
    send(event) {
      sent.push(event);
      if (
        shouldAck &&
        event.type === "session.update" &&
        typeof event.event_id === "string"
      ) {
        queueMicrotask(() => {
          emit({
            kind: "session.configured",
            correlationId: event.event_id,
          });
        });
      }
      return sendResult;
    },
    onEvent(cb) {
      eventListeners.add(cb);
      return () => {
        eventListeners.delete(cb);
      };
    },
    onStateChange(cb) {
      stateListeners.add(cb);
      return () => {
        stateListeners.delete(cb);
      };
    },
    close() {
      state = "closed";
      for (const listener of [...stateListeners]) listener(state);
    },
  };

  return {
    channel,
    sent,
    emit,
    setSendResult(next) {
      sendResult = next;
    },
    setAutoAck(next) {
      shouldAck = next;
    },
  };
}

export function createTestProvider(
  overrides: Partial<RealtimeProvider> = {},
): RealtimeProvider {
  return {
    id: "test",
    playback: "provider-signalled",
    echoesCorrelationId: true,
    decode(event: unknown): RealtimeSignal {
      if (typeof event !== "object" || event === null) {
        return { kind: "ignored" };
      }
      const record = event as { kind?: string; [key: string]: unknown };
      if (record.kind === "session.ready") return { kind: "session.ready" };
      if (record.kind === "session.configured") {
        return {
          kind: "session.configured",
          correlationId:
            typeof record.correlationId === "string"
              ? record.correlationId
              : null,
        };
      }
      if (record.kind === "session.rejected") {
        return {
          kind: "session.rejected",
          correlationId:
            typeof record.correlationId === "string"
              ? record.correlationId
              : null,
          recoverable: record.recoverable === true,
          message: "rejected",
        };
      }
      if (record.kind === "turn.started" && typeof record.turnId === "string") {
        return { kind: "turn.started", turnId: record.turnId };
      }
      if (
        record.kind === "turn.transcribed" &&
        typeof record.turnId === "string" &&
        typeof record.text === "string"
      ) {
        return {
          kind: "turn.transcribed",
          turnId: record.turnId,
          text: record.text,
        };
      }
      if (
        record.kind === "response.created" &&
        typeof record.responseId === "string"
      ) {
        return { kind: "response.created", responseId: record.responseId };
      }
      if (
        record.kind === "response.transcript" &&
        typeof record.responseId === "string" &&
        typeof record.text === "string"
      ) {
        return {
          kind: "response.transcript",
          responseId: record.responseId,
          text: record.text,
        };
      }
      if (
        record.kind === "response.completed" &&
        typeof record.responseId === "string"
      ) {
        return {
          kind: "response.completed",
          responseId: record.responseId,
          raw: record.raw,
        };
      }
      if (record.kind === "playback" && typeof record.responseId === "string") {
        const playbackKind = record.playbackKind;
        if (
          playbackKind === "started" ||
          playbackKind === "drained" ||
          playbackKind === "cleared"
        ) {
          return {
            kind: "playback",
            event: { kind: playbackKind, responseId: record.responseId },
          };
        }
      }
      return { kind: "ignored" };
    },
    encodeCatalog(publication) {
      return {
        type: "session.update",
        event_id: publication.correlationId,
        tools: publication.foreignTools?.length ?? 0,
      };
    },
    extractBatch(source): ToolBatch | null {
      const raw = source.raw;
      if (typeof raw !== "object" || raw === null) return null;
      const calls = (raw as { calls?: unknown }).calls;
      if (!Array.isArray(calls) || calls.length === 0) return null;
      return {
        sessionId: source.sessionId,
        responseId: (raw as { responseId?: string }).responseId ?? "response-N",
        catalogRevision: source.catalogRevision,
        userTurnId: source.userTurnId,
        calls: calls as ToolBatch["calls"],
        signal: source.signal,
        deferUntilDelivered: source.deferUntilDelivered,
      };
    },
    encodeToolResults(outcome: BatchDispatchOutcome) {
      if (outcome.kind === "terminal") return [];
      return outcome.rows.map((row) =>
        Object.freeze({
          type: "conversation.item.create",
          call_id: row.callId,
        }),
      );
    },
    encodeFollowUp() {
      return { type: "response.create" };
    },
    encodeUserText(text) {
      return [{ type: "user", text }];
    },
    encodeInterrupt() {
      return { type: "response.cancel" };
    },
    ...overrides,
  };
}

export function presentOutcome() {
  return Promise.resolve({ outcome: "completed" as const });
}
