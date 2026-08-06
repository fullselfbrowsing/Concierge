// Phase 6's public dispatcher contract. These predicates intentionally land before the
// implementation so the compiler records the exact three missing API seams and nothing else.

import type { Equals, Expect } from "./_assert.js";
import type {
  ActionHandler,
  ActionResult,
  Concierge,
  DeepReadonly,
  InvocationMeta,
  Scheduler,
  StageContext,
  ToolBatch,
  ToolCall,
} from "../src/types.js";

type _dispatchSignature = Expect<Equals<Concierge["dispatch"], (ctx: StageContext, name: string, args: unknown, meta?: InvocationMeta) => Promise<ActionResult>>>;
type _dispatchBatchSignature = Expect<Equals<Concierge["dispatchBatch"], (ctx: StageContext, batch: ToolBatch) => Promise<ReadonlyArray<Readonly<{ callId: string; result: ActionResult }>>>>>;
type _schedulerSignature = Expect<Equals<Scheduler, (fn: () => void, delayMs: number) => () => void>>;
type _conciergeKeys = Expect<Equals<keyof Concierge, "dispatch" | "dispatchBatch" | "catalogFor" | "stageFor" | "explain">>;
type _toolCallEnvelopeIsReadonly = Expect<Equals<Pick<ToolCall, "callId" | "name" | "arguments" | "outputIndex">, { readonly callId: string; readonly name: string; readonly arguments: string; readonly outputIndex: number }>>;
type _toolBatchEnvelopeIsReadonly = Expect<Equals<Pick<ToolBatch, "responseId" | "userTurnId" | "calls" | "signal" | "deferUntilDelivered">, { readonly responseId: string; readonly userTurnId?: string | undefined; readonly calls: ReadonlyArray<ToolCall>; readonly signal?: import("../src/types.js").AbortSignalLike | undefined; readonly deferUntilDelivered?: InvocationMeta["deferUntilDelivered"] }>>;
type _deepReadonlyInvocationData = Expect<Equals<DeepReadonly<{ amount: number; nested: { currency: string }; tags: string[] }>, { readonly amount: number; readonly nested: { readonly currency: string }; readonly tags: readonly string[] }>>;
type _handlerContext = Parameters<ActionHandler<{ amount: number; nested: { currency: string } }, null>>[0];
type _handlerArgsAreDeepReadonly = Expect<Equals<_handlerContext["args"], { readonly amount: number; readonly nested: { readonly currency: string } }>>;
type _handlerMetaIsReadonly = Expect<Equals<_handlerContext["meta"], Readonly<InvocationMeta>>>;

const _metaAcceptsExplicitUndefined: InvocationMeta = {
  responseId: undefined,
  userTurnId: undefined,
  callId: undefined,
  outputIndex: undefined,
  signal: undefined,
  deferUntilDelivered: undefined,
};

const _batchAcceptsExplicitUndefined: ToolBatch = {
  responseId: "response",
  calls: [],
  userTurnId: undefined,
  signal: undefined,
  deferUntilDelivered: undefined,
};

void _metaAcceptsExplicitUndefined;
void _batchAcceptsExplicitUndefined;
