import type { Assignable, Equals, Expect, Not } from "./_assert.js";
import type {
  ActionData,
  ActionHandler,
  ActionResult,
  AnyActionDefinition,
  Bridge,
  BridgeRegistry,
  ConciergeConfig,
  DeepReadonly,
  StandardSchemaV1,
} from "../src/types.js";
import { defineAction } from "../src/define-action.js";

type Input = { query: string };
type RichData = {
  kind: "visible-results";
  hotels: Array<{ id: string; price: number }>;
};

declare const inputSchema: StandardSchemaV1<unknown, Input>;
declare const outputSchema: StandardSchemaV1<unknown, RichData>;

const rich = defineAction({
  name: "getVisibleResults",
  description: "Read the visible hotel results.",
  schema: inputSchema,
  redact: "drop",
  output: { schema: outputSchema, redact: "drop" },
  handler: ({ args }) => ({
    ok: true,
    message: `Found results for ${args.query}.`,
    data: {
      kind: "visible-results",
      hotels: [{ id: "hotel-1", price: 125 }],
    },
  }),
});

type RichHandlerResult = Awaited<ReturnType<(typeof rich)["handler"]>>;
type _richDataInferred = Expect<Equals<RichHandlerResult["data"], DeepReadonly<RichData> | undefined>>;
type _richResultIsBroadResult = Expect<Assignable<RichHandlerResult, ActionResult>>;
type _richOutputIsActionData = Expect<Assignable<DeepReadonly<RichData>, ActionData>>;

const failureWithData = defineAction({
  name: "findHotel",
  description: "Find one hotel by its name.",
  schema: inputSchema,
  redact: "drop",
  output: { schema: outputSchema, redact: "passthrough" },
  handler: () => ({
    ok: false,
    reason: "precondition_failed",
    message: "More than one hotel matched.",
    data: { kind: "visible-results" as const, hotels: [] },
  }),
});

const legacy = defineAction({
  name: "legacyAction",
  description: "Run the legacy action.",
  schema: inputSchema,
  redact: "drop",
  handler: () => ({ ok: true, message: "Done." }),
});

defineAction({
  name: "undeclaredData",
  description: "Try to return undeclared data.",
  schema: inputSchema,
  redact: "drop",
  // @ts-expect-error - an action without output.schema cannot return data
  handler: () => ({ ok: true, message: "Invalid.", data: { hidden: true } }),
});

type ResultsBridge = Bridge<
  { select: (id: string) => void },
  { selectedId: () => string | null }
>;
declare const resultsRegistry: BridgeRegistry<ResultsBridge>;
type CartBridge = Bridge<
  { remove: (id: string) => void },
  { total: () => number }
>;
declare const cartRegistry: BridgeRegistry<CartBridge>;

const bridged = defineAction({
  name: "selectResult",
  description: "Select one visible result.",
  schema: inputSchema,
  redact: "drop",
  bridge: resultsRegistry,
  handler: ({ args, bridge }) => {
    bridge?.actions.select(args.query);
    return { ok: true, message: "Selected." };
  },
});

type BridgedContext = Parameters<(typeof bridged)["handler"]>[0];
type _actionBridgeInferred = Expect<Equals<BridgedContext["bridge"], ResultsBridge | null>>;

defineAction<"wrongBridge", "Reject a mismatched action bridge.", typeof inputSchema, ResultsBridge>({
  name: "wrongBridge",
  description: "Reject a mismatched action bridge.",
  schema: inputSchema,
  redact: "drop",
  // @ts-expect-error - a concrete action bridge must match the handler bridge
  bridge: cartRegistry,
  handler: () => ({ ok: true, message: "Done." }),
});

const erased: ReadonlyArray<AnyActionDefinition<any>> = [
  legacy,
  rich,
  failureWithData,
  bridged,
];
const config: ConciergeConfig = {
  stages: [{ id: "results", match: () => true, actions: erased }],
  crossStage: [rich, bridged],
};
void config;

type LegacyHandler = ActionHandler<Input, unknown>;
type LegacyReturn = Awaited<ReturnType<LegacyHandler>>;
type _legacyHandlerCannotReturnData = Expect<Not<Assignable<{ ok: true; message: "Done."; data: { hidden: true } }, LegacyReturn>>>;
