/**
 * Concierge core type surface.
 *
 * This file is the design contract. It has no runtime dependencies, no
 * framework imports, and no top-level DOM access — it must be constructible
 * on a server under Next App Router, Nuxt, or SvelteKit without guards.
 */

// ---------------------------------------------------------------------------
// Schema interop
// ---------------------------------------------------------------------------

/**
 * Minimal local copy of the Standard Schema v1 interface.
 *
 * Inlined rather than depended upon so core stays dependency-free. Zod 4,
 * Valibot, and ArkType all implement this, so Concierge is not welded to any
 * one validation library's release cadence.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) =>
      | { readonly value: Output; readonly issues?: undefined }
      | { readonly issues: ReadonlyArray<{ readonly message: string }> }
      | Promise<
          | { readonly value: Output; readonly issues?: undefined }
          | { readonly issues: ReadonlyArray<{ readonly message: string }> }
        >;
    readonly types?: { readonly input: Input; readonly output: Output };
  };
}

export type InferOutput<S> = S extends StandardSchemaV1<unknown, infer O> ? O : never;

/**
 * Structural stand-in for the platform `AbortSignal`.
 *
 * Declared locally rather than pulling the `DOM` lib into core, which would
 * make `document` and `window` type-visible here and quietly erode the
 * no-DOM guarantee. A real `AbortSignal` is assignable to this.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: "abort", listener: () => void): void;
  removeEventListener(type: "abort", listener: () => void): void;
}

/**
 * JSON Schema handed to the model.
 *
 * The root MUST be `type: "object"`. A discriminated union emits `{oneOf: []}`
 * with no root type, which OpenAI Realtime rejects for the entire session —
 * the agent silently loses every action in that stage. `buildCatalog` throws
 * on violation rather than letting it fail in production.
 */
export interface JsonSchemaObject {
  type: "object";
  properties?: Record<string, unknown>;
  required?: readonly string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/**
 * The universal return type of every action.
 *
 * `message` is not log output. It is relayed to a human verbatim — shown in a
 * transcript or spoken aloud. One complete sentence; failures carry a recovery
 * hint.
 */
export interface ActionResult {
  ok: boolean;
  /** Stable machine-readable failure code. Absent on success unless meaningful. */
  reason?: string;
  /** One sentence, safe to show or speak verbatim. Never a stack trace. */
  message: string;
}

export const USER_STOPPED: Readonly<ActionResult> = Object.freeze({
  ok: false,
  reason: "user-stopped",
  message: "Cancelled.",
});

// ---------------------------------------------------------------------------
// Invocation
// ---------------------------------------------------------------------------

export interface InvocationMeta {
  /** Agent response this call belongs to. Metadata only — never a consent key. */
  responseId?: string;
  /**
   * Identity of the human turn that caused this call.
   *
   * Load-bearing for consent: an agent can create a new response by itself, it
   * cannot create a new user turn. An automatic follow-up inherits the same
   * `userTurnId` and therefore cannot satisfy a `bindTo: "userTurn"` gate.
   */
  userTurnId?: string;
  /** Primary deduplication key. */
  callId?: string;
  /** Position within the batch. Execution is serial in this order. */
  outputIndex?: number;
  signal?: AbortSignalLike;
  /**
   * Defer a side effect until the agent's response has reached the human.
   *
   * Voice: audio playback stopped. Text: message finished rendering. Headless:
   * unavailable, so the effect never runs — which is why consent fails closed
   * on transports that cannot promise delivery.
   */
  deferUntilDelivered?: (effect: (deliveredResponseId: string) => void) => void;
}

export type ActionHandler<Args, Bridge> = (ctx: {
  args: Args;
  /** `null` when the owning stage's bridge is not mounted. Always check it. */
  bridge: Bridge | null;
  meta: InvocationMeta;
  /** Present only for actions declaring `consent.requires`. */
  ack?: ConsentAck;
}) => ActionResult | Promise<ActionResult>;

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

/**
 * What a transport can promise about the human having received a readback.
 *
 * - `perceived` — the human unavoidably received it (audio finished playing).
 * - `delivered` — the UI rendered it; the human may not have read it.
 * - `none`      — no human in the loop.
 */
export type ConsentGrade = "perceived" | "delivered" | "none";

export interface ConsentPolicy<Snapshot = unknown> {
  /** Name of the action that must run first and arm consent. */
  requires: string;
  /**
   * `"userTurn"` requires a genuinely new human turn between review and
   * confirm. `"response"` is weaker and only distinguishes agent responses.
   */
  bindTo: "userTurn" | "response";
  /**
   * Field-by-field equality over what was reviewed. Any drift between review
   * and confirm destroys the consent.
   */
  snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean;
  /**
   * Minimum transport guarantee. `buildCatalog` throws if the configured
   * transport cannot meet it — an action that needs consent does not degrade
   * quietly onto a transport that cannot deliver it.
   */
  minGrade?: ConsentGrade;
  onMissing?: Pick<ActionResult, "reason" | "message">;
}

export interface ConsentAck<Snapshot = unknown, Payload = unknown> {
  userTurnId: string;
  responseId: string;
  snapshot: Snapshot;
  /** Data captured at review time and replayed verbatim at confirm time. */
  payload: Payload;
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

/**
 * Required for any action with a non-empty schema. Defaults to `"drop"`;
 * telemetry leaks are opt-in, never accidental.
 */
export type RedactionPolicy<Args> =
  | "drop"
  | "passthrough"
  | ((args: Args) => unknown);

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface ActionDefinition<
  Name extends string = string,
  Schema extends StandardSchemaV1 = StandardSchemaV1,
  Bridge = unknown,
> {
  name: Name;
  /**
   * Model-facing. Describes *when* to reach for this action, not just what it
   * accepts — the schema already covers what.
   */
  description: string;
  schema: Schema;
  /** Supply when the validator cannot emit JSON Schema itself. */
  jsonSchema?: JsonSchemaObject;
  redact: RedactionPolicy<InferOutput<Schema>>;
  handler: ActionHandler<InferOutput<Schema>, Bridge>;
  consent?: ConsentPolicy;
  /**
   * Terminal actions tear down the session. They short-circuit their batch and
   * emit no result envelope, because nothing is left to receive it.
   */
  terminal?: boolean;
}

// ---------------------------------------------------------------------------
// Bridges
// ---------------------------------------------------------------------------

/**
 * A page component's contribution to the catalog: imperative mutations plus a
 * live view of state.
 *
 * Snapshot fields MUST be getter functions, never values. A value captured at
 * registration time goes stale inside the handler closure. The getter contract
 * `() => T` is identical across React refs, Vue refs, Svelte runes, and
 * Angular signals — which is what makes this pattern portable.
 */
export interface Bridge<
  Actions extends Record<string, (...args: never[]) => unknown> = Record<string, never>,
  Snapshot extends Record<string, () => unknown> = Record<string, never>,
> {
  actions: Actions;
  snapshot: Snapshot;
}

export interface BridgeRegistry<B extends Bridge = Bridge> {
  readonly id: string;
  /** `null` when no component has registered. Handlers treat this as off-page. */
  read: () => B | null;
  /**
   * Returns an identity-guarded unsubscriber: it removes the entry only if the
   * registration is still the one it created. React StrictMode double-mount,
   * Vue HMR, and Svelte remounts all produce a stale cleanup otherwise.
   */
  register: (bridge: B) => () => void;
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

/** Whatever the app knows about where the user is. Not limited to a URL. */
export interface StageContext {
  pathname?: string;
  [key: string]: unknown;
}

export interface StageDefinition<B extends Bridge = Bridge> {
  match: (ctx: StageContext) => boolean;
  actions: ReadonlyArray<ActionDefinition<string, StandardSchemaV1, B>>;
  bridge?: BridgeRegistry<B>;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export interface ToolCall {
  callId: string;
  name: string;
  /** Raw string as received. Malformed JSON degrades to `{}`, never throws. */
  arguments: string;
  outputIndex: number;
}

export interface TransportCapabilities {
  /** What this transport can promise about the human receiving a readback. */
  consentGrade: ConsentGrade;
  /** Whether a single response may contain several calls. */
  parallelCalls: boolean;
  /** Whether the catalog can be swapped mid-session on stage change. */
  dynamicCatalog: boolean;
}

/**
 * Transport is the only vendor-shaped seam. Core has no opinion about whether
 * the agent arrives over WebRTC, SSE, MCP stdio, or a command palette.
 */
export interface Transport {
  readonly capabilities: TransportCapabilities;
  /** Publish the catalog for the current stage. */
  setTools: (tools: ReadonlyArray<EmittedTool>) => void;
  /** Deliver a completed, ordered batch of calls. */
  onToolBatch: (cb: (batch: ReadonlyArray<ToolCall>) => void) => () => void;
  /** Return one result envelope per call. */
  respond: (callId: string, output: string) => void;
}

export interface EmittedTool {
  type: "function";
  name: string;
  description: string;
  parameters: JsonSchemaObject;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export interface ConciergeConfig {
  stages: Record<string, StageDefinition>;
  /** Available in every stage. */
  crossStage?: ReadonlyArray<ActionDefinition>;
  transport?: Transport;
  /**
   * Grace period before any side effect lands, so a human can interrupt.
   * @default 600
   */
  commitWindowMs?: number;
  /**
   * Window in which a repeated call returns the *same Promise by reference*,
   * so an agent retrying cannot double-fire an effect.
   * @default 500
   */
  dedupeWindowMs?: number;
}

export interface Concierge {
  /**
   * NOT `async`. An async wrapper allocates a fresh Promise per invocation,
   * which breaks deduplication by reference identity.
   */
  dispatch: (name: string, args: unknown, meta?: InvocationMeta) => Promise<ActionResult>;
  registerHandler: (name: string, handler: ActionHandler<never, never>) => () => void;
  /** Catalog for the stage matching `ctx`, ready to hand to a transport. */
  catalogFor: (ctx: StageContext) => ReadonlyArray<EmittedTool>;
  stageFor: (ctx: StageContext) => string | null;
}
