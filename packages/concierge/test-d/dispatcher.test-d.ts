// Contract-v2 dispatcher shape and exact readonly envelopes.

import type { Assignable, Equals, Expect, Not } from "./_assert.js";
import type {
  ActionDefinition,
  ActionHandler,
  ActionResult,
  BatchDispatchOutcome,
  Concierge,
  DeepReadonly,
  DispatchRequest,
  InvocationIdentity,
  InvocationData,
  InvocationMeta,
  Scheduler,
  StageContext,
  StandardSchemaV1,
  ToolBatch,
  ToolCall,
} from "../src/types.js";

type _dispatchSignature = Expect<Equals<Concierge["dispatch"], (ctx: StageContext, request: DispatchRequest) => Promise<ActionResult>>>;
type _dispatchBatchSignature = Expect<Equals<Concierge["dispatchBatch"], (ctx: StageContext, batch: ToolBatch) => Promise<BatchDispatchOutcome>>>;
type _schedulerSignature = Expect<Equals<Scheduler, (fn: () => void, delayMs: number) => () => void>>;
type _conciergeKeys = Expect<Equals<keyof Concierge, "dispatch" | "dispatchBatch" | "resolveCatalog" | "onDispatch" | "explain">>;
type _actionResultKeysExcludeTerminalControl = Expect<Equals<keyof ActionResult, "ok" | "reason" | "message">>;
type _publicBatchRow = Awaited<ReturnType<Concierge["dispatchBatch"]>>["rows"][number];
type _publicBatchRowKeysExcludeTerminalControl = Expect<Equals<keyof _publicBatchRow, "dispatchId" | "callId" | "name" | "outputIndex" | "result">>;
type _toolCallEnvelopeIsReadonly = Expect<Equals<Pick<ToolCall, "callId" | "name" | "arguments" | "outputIndex">, { readonly callId: string; readonly name: string; readonly arguments: string; readonly outputIndex: number }>>;
type _toolBatchEnvelopeIsReadonly = Expect<Equals<Pick<ToolBatch, "sessionId" | "responseId" | "catalogRevision" | "userTurnId" | "calls" | "signal" | "deferUntilDelivered">, { readonly sessionId: string; readonly responseId: string; readonly catalogRevision: import("../src/types.js").CatalogRevision; readonly userTurnId: string; readonly calls: ReadonlyArray<ToolCall>; readonly signal?: import("../src/types.js").AbortSignalLike | undefined; readonly deferUntilDelivered?: InvocationMeta["deferUntilDelivered"] }>>;
type _identityIsComplete = Expect<Equals<InvocationIdentity, { readonly sessionId: string; readonly responseId: string; readonly callId: string; readonly userTurnId: string; readonly outputIndex: number }>>;
type _identityRejectsMissingTurn = Expect<Not<Assignable<{ sessionId: string; responseId: string; callId: string; outputIndex: number }, InvocationIdentity>>>;
type _identityRejectsMissingIndex = Expect<Not<Assignable<{ sessionId: string; responseId: string; callId: string; userTurnId: string }, InvocationIdentity>>>;
type _batchRejectsMissingTurn = Expect<Not<Assignable<{ sessionId: string; responseId: string; catalogRevision: import("../src/types.js").CatalogRevision; calls: readonly [] }, ToolBatch>>>;
type _deepReadonlyInvocationData = Expect<Equals<DeepReadonly<{ amount: number; nested: { currency: string }; tags: string[] }>, { readonly amount: number; readonly nested: { readonly currency: string }; readonly tags: readonly string[] }>>;
type _handlerContext = Parameters<ActionHandler<{ amount: number; nested: { currency: string } }, null>>[0];
type _handlerArgsAreDeepReadonly = Expect<Equals<_handlerContext["args"], { readonly amount: number; readonly nested: { readonly currency: string } }>>;
type _handlerMetaIsReadonly = Expect<Equals<_handlerContext["meta"], Readonly<InvocationMeta>>>;
type PlainOutputSchema = StandardSchemaV1<unknown, { amount: number; nested: { currency: string }; optional?: undefined }>;
type DateOutputSchema = StandardSchemaV1<unknown, { at: Date }>;
type ClassOutputSchema = StandardSchemaV1<unknown, { value: string; mutate(): void }>;
type _plainSchemaRetainsAHandler = Expect<Assignable<ActionDefinition<"plain", PlainOutputSchema>["handler"], ActionHandler<{ amount: number; nested: { currency: string }; optional?: undefined }, unknown>>>;
type _dateSchemaCannotDeclareAHandler = Expect<Equals<ActionDefinition<"date", DateOutputSchema>["handler"], never>>;
type _classSchemaCannotDeclareAHandler = Expect<Equals<ActionDefinition<"class", ClassOutputSchema>["handler"], never>>;
type _invocationDataIncludesSupportedPrimitives = Expect<Assignable<{ values: readonly [number, undefined, bigint] }, InvocationData>>;

const _metaAcceptsExplicitUndefined: InvocationMeta = {
  responseId: undefined,
  userTurnId: undefined,
  callId: undefined,
  outputIndex: undefined,
  signal: undefined,
  deferUntilDelivered: undefined,
};

const _batchAcceptsOptionalExplicitUndefined: ToolBatch = {
  sessionId: "session",
  responseId: "response",
  catalogRevision: Symbol("catalog") as import("../src/types.js").CatalogRevision,
  calls: [],
  userTurnId: "turn",
  signal: undefined,
  deferUntilDelivered: undefined,
};

void _metaAcceptsExplicitUndefined;
void _batchAcceptsOptionalExplicitUndefined;
