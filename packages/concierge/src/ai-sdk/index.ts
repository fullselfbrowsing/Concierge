import {
  assertSingleInstance,
  CONTRACT_VERSION,
} from "@full-self-browsing/concierge";
import type {
  ActionResult,
  CatalogRevision,
  Concierge,
  EmittedTool,
  ResolvedCatalog,
  StageContext,
  ToolCall,
} from "@full-self-browsing/concierge";
import { jsonSchema, tool } from "ai";
import type { JSONSchema7, JSONValue, ToolResultPart, ToolSet } from "ai";

import {
  canonicalizeBytes,
  canonicalizeString,
} from "./canonical.js";
import { encodeBase64Url, webCryptoBytes } from "./encoding.js";
import { exactRecord, validIdentifier } from "./shape.js";
import {
  ConciergeAISDKConfigurationError,
  ConciergeAISDKCorrelationError,
  EXPECTED_CORE_CONTRACT_VERSION,
} from "./wire.js";
import type { CompletedBrowserBatchReport } from "./wire.js";

export type {
  BrowserBatchReport,
  CompletedBrowserBatchReport,
  DeliveryHook,
  ES256PrivateKeySource,
  ES256PublicKeySource,
  PresentFailureOutcome,
  ProtectedHeaderV1,
  ReplayStore,
  SignedBridgeDiagnostic,
  SignedBridgeRejectionCode,
  SignedToolBatchEnvelopeV1,
  ToolBatchClaimsV1,
  VerifiedEnvelopeIdentity,
  WebCryptoSource,
} from "./wire.js";
export {
  ConciergeAISDKConfigurationError,
  ConciergeAISDKCorrelationError,
  EXPECTED_CORE_CONTRACT_VERSION,
  SIGNED_ENVELOPE_VERSION,
} from "./wire.js";

const MAX_CALLS = 128;

export interface AISDKCompletedToolCall {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly dynamic?: boolean | undefined;
  readonly invalid?: boolean | undefined;
  readonly providerExecuted?: boolean | undefined;
}

export interface AISDKCatalogSnapshot {
  readonly stage: string | null;
  readonly revision: CatalogRevision;
  readonly digest: string;
  readonly emittedTools: ReadonlyArray<EmittedTool>;
  readonly aiTools: ToolSet;
}

export interface SerializableToolBatch {
  readonly responseId: string;
  readonly userTurnId: string;
  readonly calls: ReadonlyArray<ToolCall>;
}

export interface PreparedAISDKStep {
  readonly catalog: AISDKCatalogSnapshot;
  readonly batch: SerializableToolBatch;
  readonly correlation: ReadonlyArray<Readonly<{
    toolCallId: string;
    toolName: string;
    outputIndex: number;
  }>>;
}

export type PrepareAISDKStepResult =
  | Readonly<{ kind: "no-tool-calls" }>
  | Readonly<{ kind: "ready"; value: PreparedAISDKStep }>
  | Readonly<{
      kind: "invalid";
      code:
        | "too_many_calls"
        | "invalid_call"
        | "invalid_input"
        | "unsupported_call"
        | "duplicate_call_id"
        | "unknown_tool";
      callIndex?: number | undefined;
    }>;

export interface ConciergeAISDKAdapter {
  resolveCatalog(context: StageContext): Promise<AISDKCatalogSnapshot>;
  prepareStep(input: Readonly<{
    catalog: AISDKCatalogSnapshot;
    responseId: string;
    userTurnId: string;
    toolCalls: ReadonlyArray<AISDKCompletedToolCall>;
  }>): PrepareAISDKStepResult;
  toToolResultParts(
    prepared: PreparedAISDKStep,
    report: CompletedBrowserBatchReport,
  ): ReadonlyArray<ToolResultPart>;
  toToolOutputUpdates(
    prepared: PreparedAISDKStep,
    report: CompletedBrowserBatchReport,
  ): ReadonlyArray<Readonly<{
    tool: string;
    toolCallId: string;
    output: Readonly<ActionResult>;
  }>>;
}

interface ConciergeWithResolution extends Concierge {
  resolveCatalog(context: StageContext): ResolvedCatalog;
}

function assertContract(): void {
  assertSingleInstance();
  const actual: number = CONTRACT_VERSION;
  if (actual !== EXPECTED_CORE_CONTRACT_VERSION) {
    throw new ConciergeAISDKConfigurationError(
      `@full-self-browsing/concierge/ai-sdk expected core contract v${EXPECTED_CORE_CONTRACT_VERSION} ` +
        `but found v${actual}; upgrade or reinstall both packages together.`,
    );
  }
}

function cryptoFor(source: Crypto | undefined): Crypto {
  const value: Crypto | undefined = source ?? globalThis.crypto;
  if (
    value === undefined ||
    typeof value.subtle?.digest !== "function"
  ) {
    throw new ConciergeAISDKConfigurationError(
      "A WebCrypto SHA-256 implementation is required.",
    );
  }
  return value;
}

function defineTool(
  record: Record<string, unknown>,
  emitted: EmittedTool,
): void {
  const converted = Object.freeze(tool({
    description: emitted.description,
    inputSchema: jsonSchema(emitted.parameters as unknown as JSONSchema7),
  }));
  Object.defineProperty(record, emitted.name, {
    configurable: false,
    enumerable: true,
    value: converted,
    writable: false,
  });
}

export function toAISDKTools(
  catalog: ReadonlyArray<EmittedTool>,
): ToolSet {
  const converted: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const emitted of catalog) defineTool(converted, emitted);
  return Object.freeze(converted) as ToolSet;
}

async function digestCatalog(
  crypto: Crypto,
  resolution: ResolvedCatalog,
): Promise<string> {
  const tools = resolution.tools.map((entry) => Object.freeze({
    type: entry.type,
    name: entry.name,
    description: entry.description,
    parameters: entry.parameters,
  }));
  const bytes: Uint8Array = canonicalizeBytes(Object.freeze({
    contractVersion: EXPECTED_CORE_CONTRACT_VERSION,
    stage: resolution.stage,
    tools,
  }));
  const digest: ArrayBuffer = await crypto.subtle.digest(
    "SHA-256",
    webCryptoBytes(bytes),
  );
  return encodeBase64Url(new Uint8Array(digest));
}

function invalid(
  code: Extract<PrepareAISDKStepResult, { kind: "invalid" }>["code"],
  callIndex?: number,
): PrepareAISDKStepResult {
  return Object.freeze({ kind: "invalid", code, callIndex });
}

function jsonResult(result: Readonly<ActionResult>): JSONValue {
  const output: {
    ok: boolean;
    message: string;
    reason?: string;
    data?: JSONValue;
  } = {
    ok: result.ok,
    message: result.message,
  };
  if (result.reason !== undefined) output.reason = result.reason;
  if (result.data !== undefined) output.data = result.data as JSONValue;
  return output;
}

function correlate(
  prepared: PreparedAISDKStep,
  report: CompletedBrowserBatchReport,
): void {
  if (
    report.identity.responseId !== prepared.batch.responseId ||
    report.rows.length !== prepared.correlation.length
  ) {
    throw new ConciergeAISDKCorrelationError();
  }
  for (let index: number = 0; index < report.rows.length; index += 1) {
    const row = report.rows[index];
    const expected = prepared.correlation[index];
    if (
      row === undefined ||
      expected === undefined ||
      row.callId !== expected.toolCallId ||
      row.name !== expected.toolName ||
      row.outputIndex !== expected.outputIndex
    ) {
      throw new ConciergeAISDKCorrelationError();
    }
  }
}

export function createAISDKAdapter(input: Readonly<{
  concierge: Concierge;
  crypto?: Crypto | undefined;
}>): ConciergeAISDKAdapter {
  assertContract();
  const concierge: ConciergeWithResolution =
    input.concierge as ConciergeWithResolution;
  if (typeof concierge.resolveCatalog !== "function") {
    throw new ConciergeAISDKConfigurationError(
      "Core contract v3 must provide resolveCatalog().",
    );
  }
  const crypto: Crypto = cryptoFor(input.crypto);
  const toolCache: WeakMap<object, ToolSet> = new WeakMap<object, ToolSet>();
  const digestCache: WeakMap<object, Map<string, Promise<string>>> =
    new WeakMap<object, Map<string, Promise<string>>>();

  async function resolveCatalog(
    context: StageContext,
  ): Promise<AISDKCatalogSnapshot> {
    const resolution: ResolvedCatalog = concierge.resolveCatalog(context);
    let aiTools: ToolSet | undefined = toolCache.get(resolution.tools);
    if (aiTools === undefined) {
      aiTools = toAISDKTools(resolution.tools);
      toolCache.set(resolution.tools, aiTools);
    }
    let byStage: Map<string, Promise<string>> | undefined =
      digestCache.get(resolution.tools);
    if (byStage === undefined) {
      byStage = new Map<string, Promise<string>>();
      digestCache.set(resolution.tools, byStage);
    }
    const stageKey: string = resolution.stage === null
      ? "\u0000"
      : `\u0001${resolution.stage}`;
    let digestPromise: Promise<string> | undefined = byStage.get(stageKey);
    if (digestPromise === undefined) {
      digestPromise = digestCatalog(crypto, resolution);
      byStage.set(stageKey, digestPromise);
    }
    const digest: string = await digestPromise;
    return Object.freeze({
      stage: resolution.stage,
      revision: resolution.revision,
      digest,
      emittedTools: resolution.tools,
      aiTools,
    });
  }

  function prepareStep(inputValue: Readonly<{
    catalog: AISDKCatalogSnapshot;
    responseId: string;
    userTurnId: string;
    toolCalls: ReadonlyArray<AISDKCompletedToolCall>;
  }>): PrepareAISDKStepResult {
    if (!validIdentifier(inputValue.responseId)) return invalid("invalid_call");
    if (!validIdentifier(inputValue.userTurnId)) {
      return invalid("invalid_call");
    }
    if (!Array.isArray(inputValue.toolCalls)) return invalid("invalid_call");
    if (inputValue.toolCalls.length === 0) {
      return Object.freeze({ kind: "no-tool-calls" });
    }
    if (inputValue.toolCalls.length > MAX_CALLS) {
      return invalid("too_many_calls");
    }
    const names: Set<string> = new Set<string>(
      inputValue.catalog.emittedTools.map((entry) => entry.name),
    );
    const ids: Set<string> = new Set<string>();
    const calls: ToolCall[] = [];
    const correlation: Array<{
      toolCallId: string;
      toolName: string;
      outputIndex: number;
    }> = [];
    for (let index: number = 0; index < inputValue.toolCalls.length; index += 1) {
      const call: Readonly<Record<string, unknown>> | null = exactRecord(
        inputValue.toolCalls[index],
        ["toolCallId", "toolName", "input"],
        ["dynamic", "invalid", "providerExecuted"],
      );
      if (
        call === null ||
        !validIdentifier(call.toolCallId) ||
        !validIdentifier(call.toolName)
      ) {
        return invalid("invalid_call", index);
      }
      if (
        (call.dynamic !== undefined && call.dynamic !== false) ||
        (call.invalid !== undefined && call.invalid !== false) ||
        (call.providerExecuted !== undefined && call.providerExecuted !== false)
      ) {
        return invalid("unsupported_call", index);
      }
      if (!names.has(call.toolName)) return invalid("unknown_tool", index);
      if (ids.has(call.toolCallId)) return invalid("duplicate_call_id", index);
      ids.add(call.toolCallId);
      let argumentsText: string;
      try {
        argumentsText = canonicalizeString(call.input);
      } catch {
        return invalid("invalid_input", index);
      }
      calls.push(Object.freeze({
        callId: call.toolCallId,
        name: call.toolName,
        arguments: argumentsText,
        outputIndex: index,
      }));
      correlation.push(Object.freeze({
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        outputIndex: index,
      }));
    }
    const batch: SerializableToolBatch = Object.freeze({
      responseId: inputValue.responseId,
      userTurnId: inputValue.userTurnId,
      calls: Object.freeze(calls),
    });
    return Object.freeze({
      kind: "ready",
      value: Object.freeze({
        catalog: inputValue.catalog,
        batch,
        correlation: Object.freeze(correlation),
      }),
    });
  }

  function toToolResultParts(
    prepared: PreparedAISDKStep,
    report: CompletedBrowserBatchReport,
  ): ReadonlyArray<ToolResultPart> {
    correlate(prepared, report);
    return Object.freeze(report.rows.map((row, index) => {
      const call = prepared.correlation[index];
      if (call === undefined) throw new ConciergeAISDKCorrelationError();
      return Object.freeze({
        type: "tool-result" as const,
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        output: Object.freeze({
          type: "json" as const,
          value: jsonResult(row.result),
        }),
      });
    }));
  }

  function toToolOutputUpdates(
    prepared: PreparedAISDKStep,
    report: CompletedBrowserBatchReport,
  ): ReadonlyArray<Readonly<{
    tool: string;
    toolCallId: string;
    output: Readonly<ActionResult>;
  }>> {
    correlate(prepared, report);
    return Object.freeze(report.rows.map((row, index) => {
      const call = prepared.correlation[index];
      if (call === undefined) throw new ConciergeAISDKCorrelationError();
      return Object.freeze({
        tool: call.toolName,
        toolCallId: call.toolCallId,
        output: row.result,
      });
    }));
  }

  return Object.freeze({
    resolveCatalog,
    prepareStep,
    toToolResultParts,
    toToolOutputUpdates,
  });
}
