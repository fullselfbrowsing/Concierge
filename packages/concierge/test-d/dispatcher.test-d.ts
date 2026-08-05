// Phase 6's public dispatcher contract. These predicates intentionally land before the
// implementation so the compiler records the exact three missing API seams and nothing else.

import type { Equals, Expect } from "./_assert.js";
import type {
  ActionResult,
  Concierge,
  InvocationMeta,
  Scheduler,
  StageContext,
  ToolBatch,
} from "../src/types.js";

type _dispatchSignature = Expect<Equals<Concierge["dispatch"], (ctx: StageContext, name: string, args: unknown, meta?: InvocationMeta) => Promise<ActionResult>>>;
type _dispatchBatchSignature = Expect<Equals<Concierge["dispatchBatch"], (ctx: StageContext, batch: ToolBatch) => Promise<ReadonlyArray<Readonly<{ callId: string; result: ActionResult }>>>>>;
type _schedulerSignature = Expect<Equals<Scheduler, (fn: () => void, delayMs: number) => () => void>>;
type _conciergeKeys = Expect<Equals<keyof Concierge, "dispatch" | "dispatchBatch" | "catalogFor" | "stageFor" | "explain">>;

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
