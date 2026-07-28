/**
 * Concierge core type surface.
 *
 * This file is the design contract. No runtime dependencies, no framework
 * imports, no top-level DOM access — it must construct on a server under Next
 * App Router, Nuxt, or SvelteKit without guards. The no-DOM guarantee is
 * enforced mechanically by `lib: ["ES2022"]`: referencing `document` here is a
 * compile error (TS2584), not a code-review question.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

export type { StandardSchemaV1 };

// ---------------------------------------------------------------------------
// Schema interop
// ---------------------------------------------------------------------------

export type InferOutput<S> =
  S extends StandardSchemaV1<unknown, infer O> ? O : never;

/**
 * JSON Schema handed to the agent.
 *
 * The root MUST be `type: "object"`. A discriminated union emits `{oneOf: []}`
 * with no root type; OpenAI Realtime then rejects the *entire* session update
 * and the agent silently loses every action in that stage, apologizing that it
 * cannot do that here. `buildCatalog` throws on violation, naming the action.
 */
export interface JsonSchemaObject {
  type: "object";
  properties?: Record<string, unknown>;
  required?: readonly string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

/**
 * Structural stand-in for the platform `AbortSignal`.
 *
 * Declared locally rather than pulling the `DOM` lib into core, which would
 * make `document` and `window` type-visible and erode the guarantee above. A
 * real `AbortSignal` is assignable to this.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: "abort", listener: () => void): void;
  removeEventListener(type: "abort", listener: () => void): void;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/**
 * The universal return type of every action.
 *
 * `message` is not log output. It is relayed to a human — rendered in a
 * transcript, or voiced. One complete sentence; failures carry a recovery hint.
 *
 * Note what this type cannot promise: on a conversational transport the agent
 * *reauthors* this text before the human sees it. See {@link ConsentGrade}.
 */
export interface ActionResult {
  ok: boolean;
  /**
   * Stable machine-readable failure code. Closed on purpose — see
   * {@link ReasonCode}. An open `string` would let a handler place arbitrary
   * text into a field the agent reads and reasons over, and would destroy the
   * exhaustiveness every dispatcher and consent mapper depends on.
   *
   * The explicit `| undefined` is load-bearing under this repo's
   * `exactOptionalPropertyTypes`, not decoration. A bare `reason?: ReasonCode`
   * rejects an explicit `reason: undefined` *and* the natural
   * `{ reason: computeReason(), … }` idiom whenever the computed value is
   * `ReasonCode | undefined` — which is every real mapper. Do not remove it.
   */
  reason?: ReasonCode | undefined;
  /**
   * One sentence, safe to show or speak. Never a stack trace.
   *
   * Policy: `message` is a best-effort human-facing sentence and is **never a
   * consent artifact**. Nothing may be gated on it having been read. The
   * {@link ConsentGrade} ladder exists precisely because a conversational
   * agent reauthors this text before a human ever sees it, and `attested`
   * routes around it entirely by hashing app-rendered bytes.
   *
   * Bound: at most {@link MESSAGE_MAX_CHARS} characters. The type system
   * cannot express a length constraint, which is why the bound is a constant
   * rather than a branded type — branding `string` would reject
   * `` `Filtered to ${x}.` ``, the single most-written line in the library.
   * Enforcement is therefore a runtime obligation: Phase 6 (SEC-06) truncates
   * to the bound and strips C0/C1 control characters at the dispatcher
   * boundary. The constant is the shared contract between the two phases.
   */
  message: string;
}

/**
 * Why an action did not run, when the cause was the human rather than an error.
 *
 * The distinction is load-bearing for what the agent says next. MCP's
 * elicitation flow separates these for the same reason: an explicit refusal is
 * a decision, a dismissal is not, and conflating them makes the agent either
 * nag or give up wrongly.
 */
export type AbandonReason =
  /** The human explicitly refused. Do not re-offer without new information. */
  | "declined"
  /** The human interrupted or dismissed. Re-offering is reasonable. */
  | "cancelled"
  /** A newer turn superseded this call before it ran. */
  | "superseded";

/**
 * Why an action did not run, when the cause was the machine rather than the
 * human. Nine codes — with {@link AbandonReason}'s three, that is the twelve
 * {@link ReasonCode} admits.
 *
 * Adding a member here is a breaking change *by design*, and the breakage is
 * the feature. Phase 6 will add codes; every exhaustive mapper stops compiling
 * until it handles the new one. The alternative is a silent `default:` arm
 * reporting a new failure mode as an old one — a repudiation risk, and exactly
 * what a closed union exists to remove. Do not add a `default` that swallows.
 *
 * `batch_aborted` deliberately collapses into `aborted`: the agent has nothing
 * usefully different to say about "your call was killed" versus "the batch was
 * killed". Split it only if Phase 6 finds it needs the distinction.
 *
 * `grade_unavailable` is a *runtime* code, for capability degradation after a
 * reconnect. A build-time grade mismatch never reaches this field — CAT-04
 * throws from `buildCatalog` instead.
 */
export type FailureReason =
  /** Arguments failed the action's schema. */
  | "invalid_args"
  /**
   * The handler returned something that is not a valid {@link ActionResult}.
   * The return type enforces the shape at compile time, but the dispatcher
   * receives whatever actually arrives — a JavaScript consumer, a handler that
   * falls off the end returning `undefined`, a promise resolving to a string.
   * Phase 6 (DSP-09) owns the runtime half.
   */
  | "invalid_result"
  /** No action by that name is registered in the current stage. */
  | "unknown_action"
  /** The action needs a bridge that no mounted component has registered. */
  | "no_bridge"
  /**
   * The handler threw. The thrown message never reaches the model or
   * telemetry: it echoes user input and would become a covert PII channel, so
   * this code plus a generic sentence is the entire externally-visible surface
   * of a crash.
   */
  | "handler_error"
  /** The call was aborted before or during execution. */
  | "aborted"
  /** A consent gate applies and no ack has armed for this payload. */
  | "consent_required"
  /** An ack existed but no longer covers this payload — the snapshot drifted. */
  | "consent_stale"
  /**
   * The transport cannot currently meet the action's `minGrade`. Runtime only,
   * for degradation after reconnect.
   */
  | "grade_unavailable";

/**
 * Every code {@link ActionResult.reason} admits: **twelve** — three
 * human-caused ({@link AbandonReason}) and nine machine-caused
 * ({@link FailureReason}).
 *
 * Deliberately a pure closed union. A `` `app.${string}` `` escape hatch was
 * rejected because a template member never narrows away, so no `switch` would
 * ever fail to compile when a core code lands — it would silently destroy the
 * exhaustiveness this type exists to provide. Making `ActionResult` generic
 * over its reason type was rejected as verifiably dead: the specialization is
 * not assignable to `Transport.respond`.
 */
export type ReasonCode = AbandonReason | FailureReason;

export const USER_CANCELLED: Readonly<ActionResult> = Object.freeze({
  ok: false,
  reason: "cancelled",
  message: "Cancelled.",
});

export const USER_DECLINED: Readonly<ActionResult> = Object.freeze({
  ok: false,
  reason: "declined",
  message: "Okay, I won't do that.",
});

/**
 * Maximum length of an {@link ActionResult.message}, in characters.
 *
 * Deliberately unannotated: under `isolatedDeclarations` the literal type
 * `180` survives into the emitted `.d.ts`, so a consumer — and this package's
 * own type tests — can guard against a silent widening to `number` or a
 * changed bound. Annotating it `: number` would discard exactly that signal.
 *
 * A constant, not a branded type, because a length constraint is not
 * expressible in the type system. Phase 6 (SEC-06) enforces it at the
 * dispatcher boundary.
 */
export const MESSAGE_MAX_CHARS = 180;

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
   * cannot create a new user turn. An automatic follow-up inherits this value
   * and therefore cannot satisfy a `bindTo: "userTurn"` gate.
   *
   * Supplied by the transport. A transport that cannot derive one is limited
   * to the weaker `bindTo: "response"`.
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
   * Absent when the transport cannot promise delivery, in which case consent
   * never arms and gated actions cannot proceed. That is the intended failure
   * mode: closed.
   */
  deferUntilDelivered?: (effect: (report: DeliveryReport) => void) => void;
}

/**
 * What actually happened when the agent's response was delivered.
 *
 * Carries an outcome rather than a bare id because *partial* delivery has to be
 * representable. An earlier draft passed only `deliveredResponseId: string`,
 * which made truncation unfixable — and truncation is not a voice problem. A
 * readback can be cut short by an interruption, a dismissed toast, a closed
 * modal, a navigation, or a disconnect. In every case the human received part
 * of a payload and the app must not treat that as consent. A consumer that
 * cannot see `outcome` cannot refuse it.
 */
export interface DeliveryReport {
  responseId: string;
  /** Anything but `completed` means consent must not arm. */
  outcome: "completed" | "interrupted";
  /**
   * Hash of the exact payload the app rendered.
   * The producer for {@link ConsentAck.readbackHash}, and therefore the only
   * route to an `attested` grade.
   */
  readbackHash?: string;
}

export type ActionHandler<Args, Bridge, AckPayload = unknown> = (ctx: {
  args: Args;
  /** `null` when the owning stage's bridge is not mounted. Always check it. */
  bridge: Bridge | null;
  meta: InvocationMeta;
  /** Present only for actions declaring `consent.requires`. */
  ack?: ConsentAck<unknown, AckPayload>;
}) => ActionResult | Promise<ActionResult>;

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

/**
 * What a transport can honestly promise about a readback reaching the human.
 *
 * Deliberately modality-free. Nothing here distinguishes speech from text —
 * that axis never mattered. Two things do:
 *
 *   1. **Content provenance** — did the human receive the agent's paraphrase,
 *      or the payload the app itself rendered?
 *   2. **Confirmation provenance** — did the app observe a human act bound to
 *      *that specific payload*, or is consent being inferred?
 *
 * Ordered weakest to strongest. Names describe what is measured, not what is
 * hoped for. An earlier draft had a `"perceived"` grade that conflated
 * "delivery finished" with "the human learned the facts." Those are different
 * claims, because on a conversational transport the agent reauthors
 * `ActionResult.message` before the human ever receives it — trusting the
 * agent's own summary as the consent artifact is OWASP ASI09.
 */
export type ConsentGrade =
  /** No human in the loop. Gated actions cannot run. */
  | "none"
  /** The agent's rendition was emitted. Receipt is unconfirmed. */
  | "delivered"
  /** The agent's rendition demonstrably reached the human, in full. */
  | "relayed"
  /**
   * The app rendered the raw payload itself, and observed a human act bound to
   * that payload's hash. The only grade that survives ASI09, and the only one
   * an irreversible action should accept.
   *
   * Reachable by any app that has a surface of its own to render into, which
   * is every app — a voice-only product qualifies by rendering the payload
   * visually, or not at all.
   */
  | "attested";

export const CONSENT_GRADE_ORDER: readonly ConsentGrade[] = Object.freeze([
  "none",
  "delivered",
  "relayed",
  "attested",
]);

export interface ConsentPolicy<Snapshot = unknown> {
  /**
   * The action that must run first and arm consent.
   *
   * Deliberately `string`, and deliberately checked at `buildCatalog` rather
   * than here. An earlier draft typed this as the action's own `Name` param to
   * catch typos — but because `Name` is inferred from *both* `name` and this
   * field, `{name: "confirmBooking", consent: {requires: "reviewBooking"}}`
   * widened `Name` to the union of the two, silently corrupting the name-union
   * derivation the whole catalog depends on. The cross-reference genuinely
   * cannot be checked at declaration time, because the catalog does not exist
   * yet. CAT-03 throws at build time instead — a real check, later, rather than
   * an apparent check that does nothing.
   */
  requires: string;
  /**
   * `"userTurn"` requires a genuinely new human turn between review and
   * confirm. `"response"` only distinguishes agent responses and is weaker.
   */
  bindTo: "userTurn" | "response";
  /**
   * Field-by-field equality over what was reviewed. Any drift between review
   * and confirm destroys the consent.
   *
   * Compared against a *normalized* snapshot — see {@link SnapshotNormalizer}.
   */
  snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean;
  /**
   * Minimum transport guarantee. `buildCatalog` throws when the configured
   * transport cannot meet it. An action that needs consent must not degrade
   * quietly onto a transport that cannot deliver it.
   */
  minGrade?: ConsentGrade;
  onMissing?: Pick<ActionResult, "reason" | "message">;
}

export interface ConsentAck<Snapshot = unknown, Payload = unknown> {
  userTurnId: string;
  responseId: string;
  /** Normalized and structurally frozen at arm time. Never a live reference. */
  snapshot: Snapshot;
  /** Captured at review time and replayed verbatim at confirm time. */
  payload: Payload;
  /** The grade actually achieved when this ack armed. */
  grade: ConsentGrade;
  /**
   * Hash of the exact bytes presented to the human.
   *
   * Without this, the ack proves only that *a* readback occurred — not that it
   * described *this* payload. Required at `attested`, where the app renders the
   * raw payload itself and can therefore hash what it actually showed. Absent
   * at lower grades, which is precisely why they are lower.
   */
  readbackHash?: string;
}

/**
 * Detaches a snapshot from the app's reactivity system before it is stored.
 *
 * Required, not optional. Svelte's `$state` returns a Proxy, so a snapshot
 * captured at review time would otherwise be a *live view* that mutates with
 * the app — turning "any drift destroys consent" into "there is never any
 * drift," a gate that passes unconditionally while appearing to work.
 * `structuredClone` is not a fix; it throws `DataCloneError` on proxies.
 *
 * The Svelte adapter fills this with `$state.snapshot`. Frameworks without
 * proxy-based reactivity supply a deep freeze.
 */
export type SnapshotNormalizer = <T>(value: T) => T;

// ---------------------------------------------------------------------------
// Side-effect annotations
// ---------------------------------------------------------------------------

/**
 * What this action does to the world.
 *
 * Mirrors MCP's tool hints so `concierge-mcp` has something to derive
 * annotations from, and so developers arriving from MCP can declare what they
 * already expect to declare. Unlike MCP — where the spec requires clients to
 * treat annotations as untrusted, because the server is a third party — here
 * the catalog author is the app author, so these are trustworthy.
 *
 * `buildCatalog` warns when `destructive: true` carries no `consent` policy.
 */
export interface SideEffects {
  /** Does not modify state. Mutually exclusive with the other two. */
  readOnly?: boolean;
  /** Irreversible or costly to undo. Should carry a consent policy. */
  destructive?: boolean;
  /** Repeating with identical arguments has no additional effect. */
  idempotent?: boolean;
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

/**
 * Required for any action with a non-empty schema. Defaults to `"drop"` —
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
   * Agent-facing. Describes *when* to reach for this action; the schema
   * already covers what it accepts.
   *
   * Must be a static string. Building descriptions from i18n, CMS, or
   * per-tenant content reintroduces MCP-style tool poisoning on a catalog
   * that is otherwise code-reviewed.
   */
  description: string;
  schema: Schema;
  /**
   * Explicit JSON Schema, when the validator cannot emit its own.
   *
   * Still required in practice: Standard JSON Schema is implemented by Zod and
   * ArkType but *not* by Valibot as published, despite documentation claiming
   * otherwise. Verify against the installed package, not the docs site.
   */
  jsonSchema?: JsonSchemaObject;
  redact: RedactionPolicy<InferOutput<Schema>>;
  handler: ActionHandler<InferOutput<Schema>, Bridge>;
  effects?: SideEffects;
  consent?: ConsentPolicy;
  /**
   * Terminal actions tear down the session. They short-circuit their batch and
   * emit no result envelope, because nothing remains to receive it.
   */
  terminal?: boolean;
}

// ---------------------------------------------------------------------------
// Bridges
// ---------------------------------------------------------------------------

/**
 * A page component's contribution: imperative mutations plus a live view of
 * state.
 *
 * Snapshot fields MUST be getter functions, never values — a value captured at
 * registration goes stale inside the handler closure. The `() => T` contract is
 * convergent across the ecosystem: TanStack's Svelte adapter exports the
 * identical `Accessor<T> = () => T`, Solid's is verbatim the same, Angular
 * signals *are* getters, and Vue's `toValue` accepts them.
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
   * Vue HMR, and Svelte remount all produce stale cleanups otherwise.
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
  /** Stable identifier, used in catalog keys and devtools. */
  id: string;
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

/**
 * A complete, ordered batch of calls plus the turn identity they belong to.
 *
 * The envelope exists because consent cannot be implemented without it: an
 * earlier draft delivered a bare `ToolCall[]`, which carries no `responseId`,
 * no `userTurnId`, and no delivery hook — so `bindTo: "userTurn"`, the gate the
 * whole design rests on, had no data to read.
 */
export interface ToolBatch {
  responseId: string;
  /** Absent on transports that cannot derive turn identity. */
  userTurnId?: string;
  calls: ReadonlyArray<ToolCall>;
  signal?: AbortSignalLike;
  deferUntilDelivered?: (effect: (deliveredResponseId: string) => void) => void;
}

export interface TransportCapabilities {
  /** What this transport can honestly promise. See {@link ConsentGrade}. */
  consentGrade: ConsentGrade;
  /** Whether turn identity is derivable — required for `bindTo: "userTurn"`. */
  userTurnIdentity: boolean;
  /** Whether a single response may contain several calls. */
  parallelCalls: boolean;
  /** Whether the catalog can be swapped mid-session on stage change. */
  dynamicCatalog: boolean;
}

/**
 * The only vendor-shaped seam. Core has no opinion about whether the agent
 * arrives over WebRTC, SSE, MCP stdio, WebMCP, or a command palette.
 */
export interface Transport {
  readonly capabilities: TransportCapabilities;
  /** Publish the catalog for the current stage. */
  setTools: (tools: ReadonlyArray<EmittedTool>) => void;
  /** Deliver a completed, ordered batch. */
  onToolBatch: (cb: (batch: ToolBatch) => void) => () => void;
  /**
   * Return one result per call. Takes the result, not a string — serializing
   * at the boundary is the transport's job, not the dispatcher's.
   */
  respond: (callId: string, result: ActionResult) => void;
}

export interface EmittedTool {
  type: "function";
  name: string;
  description: string;
  parameters: JsonSchemaObject;
}

// ---------------------------------------------------------------------------
// Concierge
// ---------------------------------------------------------------------------

export interface ConciergeConfig {
  /**
   * Ordered — first match wins.
   *
   * An array rather than a keyed object because object key iteration puts
   * integer-like keys first, which would make match order depend on whether a
   * stage happened to be named `"2"`.
   */
  stages: ReadonlyArray<StageDefinition>;
  /** Available in every stage. */
  crossStage?: ReadonlyArray<ActionDefinition>;
  /**
   * Detaches snapshots from framework reactivity before storage. Supplied by
   * the framework adapter; defaults to a deep freeze.
   */
  normalizeSnapshot?: SnapshotNormalizer;
  /**
   * Grace period before any side effect lands, so a human can interrupt.
   * @default 600
   */
  commitWindowMs?: number;
  /**
   * Window in which a repeated call returns the *same Promise by reference*,
   * so a retrying agent cannot double-fire an effect.
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
  /**
   * Catalog for the stage matching `ctx`.
   *
   * Returns a memoized frozen array — a fresh array per call makes React's
   * `useSyncExternalStore` loop forever once devtools subscribe.
   */
  catalogFor: (ctx: StageContext) => ReadonlyArray<EmittedTool>;
  stageFor: (ctx: StageContext) => string | null;
}

/**
 * Owns the loop nothing else does: pushes the catalog on stage change and
 * reconnect, routes `onToolBatch → dispatch → respond`, and enforces the
 * commit window.
 *
 * Without this, `catalogFor` produces tools and `setTools` consumes them with
 * nothing in between.
 */
export interface Session {
  setContext: (ctx: StageContext) => void;
  stop: () => void;
}

export interface SessionConfig {
  concierge: Concierge;
  transport: Transport;
  initialContext?: StageContext;
}
