import type {
  AbortSignalLike,
  BatchDispatchOutcome,
  CatalogRevision,
  EmittedTool,
  InvocationMeta,
  ResolvedCatalog,
  ToolBatch,
  ToolCall,
} from "../types.js";

/** A function tool in the shape accepted by Realtime `session.update`. */
export interface OpenAIRealtimeSessionTool {
  readonly type: "function";
  readonly name: string;
  readonly description: string;
  readonly parameters: EmittedTool["parameters"];
}

/** One caller-sendable Realtime function result event. */
export interface OpenAIRealtimeFunctionCallOutputEvent {
  readonly type: "conversation.item.create";
  readonly item: Readonly<{
    type: "function_call_output";
    call_id: string;
    output: string;
  }>;
}

export interface ExtractOpenAIRealtimeBatchInput {
  /** A `response.done` server event, or its completed `response` member. */
  readonly response: unknown;
  readonly sessionId: string;
  readonly userTurnId: string;
  /** The revision whose `session.update` publication was acknowledged. */
  readonly catalogRevision: CatalogRevision;
  readonly signal?: AbortSignalLike | undefined;
  readonly deferUntilDelivered?: InvocationMeta["deferUntilDelivered"];
}

/**
 * Pure protocol translation for an app-owned OpenAI Realtime connection.
 *
 * The caller publishes `toSessionTools()` in `session.update` and must wait for
 * the corresponding successful `session.updated` event before binding that
 * catalog revision to a response. The codec never sends events, starts a
 * response, or treats model generation as proof of audio delivery.
 */
export interface OpenAIRealtimeCodec {
  toSessionTools(
    catalog: ResolvedCatalog,
  ): ReadonlyArray<OpenAIRealtimeSessionTool>;
  extractCompletedBatch(input: ExtractOpenAIRealtimeBatchInput): ToolBatch | null;
  toFunctionCallOutputEvents(
    outcome: BatchDispatchOutcome,
  ): ReadonlyArray<OpenAIRealtimeFunctionCallOutputEvent>;
}

interface DataProperty {
  readonly found: boolean;
  readonly value: unknown;
}

const ABSENT_PROPERTY: DataProperty = Object.freeze({
  found: false,
  value: undefined,
});

const EMPTY_EVENTS: ReadonlyArray<OpenAIRealtimeFunctionCallOutputEvent> =
  Object.freeze([]);

function asRecord(value: unknown): object | null {
  if (typeof value !== "object" || value === null) return null;
  try {
    if (Array.isArray(value)) return null;
    const prototype: object | null = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
  } catch {
    return null;
  }
  return value;
}

function dataProperty(record: object, key: string): DataProperty | null {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, key);
  } catch {
    return null;
  }
  if (descriptor === undefined) return ABSENT_PROPERTY;
  if (!("value" in descriptor) || descriptor.enumerable !== true) return null;
  return Object.freeze({ found: true, value: descriptor.value });
}

function requiredData(record: object, key: string): unknown {
  const property: DataProperty | null = dataProperty(record, key);
  if (property === null || property.found === false) {
    throw new TypeError("Malformed OpenAI Realtime event.");
  }
  return property.value;
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1_024;
}

function completedResponse(value: unknown): object | null {
  let record: object | null = asRecord(value);
  if (record === null) return null;
  const type: DataProperty | null = dataProperty(record, "type");
  if (type === null) return null;
  if (type.found) {
    if (type.value !== "response.done") return null;
    try {
      record = asRecord(requiredData(record, "response"));
    } catch {
      return null;
    }
    if (record === null) return null;
  }
  try {
    if (requiredData(record, "status") !== "completed") return null;
  } catch {
    return null;
  }
  return record;
}

function denseArrayValue(values: unknown[], index: number): unknown {
  const descriptor: PropertyDescriptor | undefined =
    Object.getOwnPropertyDescriptor(values, String(index));
  if (
    descriptor === undefined ||
    !("value" in descriptor) ||
    descriptor.enumerable !== true
  ) {
    throw new TypeError("Malformed OpenAI Realtime response output.");
  }
  return descriptor.value;
}

function extractCalls(response: object): ReadonlyArray<ToolCall> | null {
  let outputValue: unknown;
  try {
    outputValue = requiredData(response, "output");
  } catch {
    return null;
  }
  if (!Array.isArray(outputValue)) return null;

  const calls: ToolCall[] = [];
  const callIds: Set<string> = new Set<string>();
  try {
    for (let index: number = 0; index < outputValue.length; index += 1) {
      const item: object | null = asRecord(denseArrayValue(outputValue, index));
      if (item === null) return null;
      const type: unknown = requiredData(item, "type");
      if (type !== "function_call") continue;

      if (requiredData(item, "status") !== "completed") return null;
      const callId: unknown = requiredData(item, "call_id");
      const name: unknown = requiredData(item, "name");
      const argumentsText: unknown = requiredData(item, "arguments");
      if (
        !validIdentifier(callId) ||
        !validIdentifier(name) ||
        typeof argumentsText !== "string" ||
        callIds.has(callId)
      ) {
        return null;
      }
      callIds.add(callId);
      calls.push(Object.freeze({
        callId,
        name,
        arguments: argumentsText,
        outputIndex: index,
      }));
    }
  } catch {
    return null;
  }
  return calls.length === 0 ? null : Object.freeze(calls);
}

function sessionTool(tool: EmittedTool): OpenAIRealtimeSessionTool {
  return Object.freeze({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  });
}

/** Create a stateless codec for an app-owned OpenAI Realtime connection. */
export function createOpenAIRealtimeCodec(): OpenAIRealtimeCodec {
  const toolsCache: WeakMap<
    ReadonlyArray<EmittedTool>,
    ReadonlyArray<OpenAIRealtimeSessionTool>
  > = new WeakMap<
    ReadonlyArray<EmittedTool>,
    ReadonlyArray<OpenAIRealtimeSessionTool>
  >();

  function toSessionTools(
    catalog: ResolvedCatalog,
  ): ReadonlyArray<OpenAIRealtimeSessionTool> {
    let tools: ReadonlyArray<OpenAIRealtimeSessionTool> | undefined =
      toolsCache.get(catalog.tools);
    if (tools === undefined) {
      tools = Object.freeze(catalog.tools.map(sessionTool));
      toolsCache.set(catalog.tools, tools);
    }
    return tools;
  }

  function extractCompletedBatch(
    input: ExtractOpenAIRealtimeBatchInput,
  ): ToolBatch | null {
    const response: object | null = completedResponse(input.response);
    if (
      response === null ||
      !validIdentifier(input.sessionId) ||
      !validIdentifier(input.userTurnId) ||
      typeof input.catalogRevision !== "symbol"
    ) {
      return null;
    }
    let responseId: unknown;
    try {
      responseId = requiredData(response, "id");
    } catch {
      return null;
    }
    if (!validIdentifier(responseId)) return null;
    const calls: ReadonlyArray<ToolCall> | null = extractCalls(response);
    if (calls === null) return null;

    const batch: {
      sessionId: string;
      responseId: string;
      catalogRevision: CatalogRevision;
      userTurnId: string;
      calls: ReadonlyArray<ToolCall>;
      signal?: AbortSignalLike;
      deferUntilDelivered?: InvocationMeta["deferUntilDelivered"];
    } = {
      sessionId: input.sessionId,
      responseId,
      catalogRevision: input.catalogRevision,
      userTurnId: input.userTurnId,
      calls,
    };
    if (input.signal !== undefined) batch.signal = input.signal;
    if (input.deferUntilDelivered !== undefined) {
      batch.deferUntilDelivered = input.deferUntilDelivered;
    }
    return Object.freeze(batch);
  }

  function toFunctionCallOutputEvents(
    outcome: BatchDispatchOutcome,
  ): ReadonlyArray<OpenAIRealtimeFunctionCallOutputEvent> {
    if (outcome.kind === "terminal") return EMPTY_EVENTS;
    const serialized: string[] = [];
    try {
      for (const row of outcome.rows) {
        const output: string | undefined = JSON.stringify(row.result);
        if (output === undefined) return EMPTY_EVENTS;
        serialized.push(output);
      }
    } catch {
      return EMPTY_EVENTS;
    }
    return Object.freeze(outcome.rows.map((row, index) => Object.freeze({
      type: "conversation.item.create" as const,
      item: Object.freeze({
        type: "function_call_output" as const,
        call_id: row.callId,
        output: serialized[index] as string,
      }),
    })));
  }

  return Object.freeze({
    toSessionTools,
    extractCompletedBatch,
    toFunctionCallOutputEvents,
  });
}
