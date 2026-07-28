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
   *
   * Presence is not the whole story: see {@link TurnIdentityProvenance}, which
   * a transport declares so the kernel can tell an id the agent could have
   * minted from one it could not.
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
   *
   * Produced by {@link ReadbackSink}, which returns a {@link ReadbackReceipt};
   * this field carries that receipt's `hash`. It is in turn the producer for
   * {@link ConsentAck.readbackHash}, and therefore the only route to an
   * `attested` grade.
   *
   * Take the value from the receipt rather than hashing the payload yourself.
   * The receipt is what fixes the canonicalization rule, and an app-derived hash
   * reintroduces exactly the collision the receipt exists to prevent.
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
   *
   * **The function-property syntax is deliberate. Do not rewrite this as a
   * method** — that is, do not move the parameter list onto the member name and
   * turn the arrow into a return-type colon. Method parameters are bivariant, so
   * under that form a `(a: Booking, b: Booking)` comparator would silently
   * assign to a `ConsentPolicy<unknown>` and this guard would stop guarding. Its
   * only symptom is one unused suppression directive in the type-test suite —
   * the kind of thing a reviewer "fixes" by deleting the test.
   *
   * **This is the deliberate opposite of {@link DigestLike}, which must use
   * method syntax**, because bivariance is the only thing that lets one
   * declaration accept both the browser's and Node's `SubtleCrypto`. Two
   * adjacent seams, two opposite syntaxes, both load-bearing: a reviewer who
   * normalizes them breaks one of them.
   *
   * Enforcement is asymmetric too, and in this seam's favour — the phase's
   * mutation battery reproduces this defect (M9) and the suite goes red.
   * `DigestLike`'s syntax has no mutant at all and is guarded by review only.
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

/**
 * The members every {@link ConsentAck} carries, whatever grade it reached.
 *
 * **Not exported, on purpose.** It exists so the two branches below can share five
 * declarations without duplicating them, and a consumer who reached for this name
 * directly would be routing around the very discrimination the split exists to
 * create — writing against the common shape is writing against a value whose grade
 * has not been checked.
 */
interface ConsentAckBase<Snapshot, Payload> {
  userTurnId: string;
  responseId: string;
  /** Normalized and structurally frozen at arm time. Never a live reference. */
  snapshot: Snapshot;
  /** Captured at review time and replayed verbatim at confirm time. */
  payload: Payload;
  /**
   * A server-issued, client-echoed, opaque token. See {@link ServerChallenge}.
   *
   * **Nothing in v0.1 produces one.** The seam is reserved *inbound* so that
   * nothing this library emits can be mistaken for proof, and the brand on
   * `ServerChallenge` makes that a compile error rather than a promise — minting
   * one requires an explicit cast a reviewer can see. Minting authority belongs
   * somewhere page JavaScript cannot reach: an echoed-but-unstored challenge
   * provides no replay protection at all (GHSA-gjjc-pcwp-c74m).
   *
   * **Omit this property when you do not have one — do not set it to nothing.**
   * Under `exactOptionalPropertyTypes` an absent key and a present key holding
   * `undefined` are different types, so spreading the key in with an explicitly
   * empty value is rejected with TS2375. Build the object without the key.
   */
  challenge?: ServerChallenge;
}

/**
 * The consent artifact: what the app observed, bound to the payload it observed it
 * about.
 *
 * **A union of two branches rather than one flat declaration, deliberately.** The
 * cost is real and was accepted: consumers lose `extends` and declaration merging on
 * this name. What it buys is that *`attested` implies `readbackHash`* is a compile
 * error to violate rather than a doc comment — the strongest grade cannot be
 * constructed at all without the evidence binding it to a payload. That trade was
 * taken because an `attested` ack carrying no hash is a gate failing while appearing
 * to work, and prose has never once stopped one from being built. A future tidy-up
 * that flattens these two branches back together silently reopens it; the type-test
 * suite has two independent detectors for exactly that edit.
 *
 * Narrowing behaves the way a flat declaration would. Inside `ack.grade ===
 * "attested"` the hash is a plain `string` needing no fallback; outside it, it may be
 * absent; and the common members read with no narrowing at all. Both type parameters
 * survive the split — `Snapshot` reaches `snapshot` and `Payload` reaches `payload`
 * through either branch.
 *
 * **What this is not, stated plainly.** It is a client-side assertion and nothing
 * more. Serializing an ack and having a server read its `grade` off the wire is the
 * path of least resistance and is worth nothing — a server cannot verify a grade the
 * client minted, and treating one as proof is the exact shape of
 * GHSA-gjjc-pcwp-c74m. Phase 1 cannot fix that; what it does is remove the
 * affordance one level down, so the strongest shape a client can even build is
 * internally consistent. Anything stronger needs a server-issued counterpart, which
 * is what `challenge` reserves the seam for.
 */
export type ConsentAck<Snapshot = unknown, Payload = unknown> =
  | (ConsentAckBase<Snapshot, Payload> & {
      /** The grade actually achieved when this ack armed. */
      grade: Exclude<ConsentGrade, "attested">;
      /**
       * Optional below the strongest grade — and their not requiring it is
       * precisely what makes them lower. A readback may well have occurred; what
       * is missing is any binding between it and this payload. See the attested
       * branch for where the value comes from.
       */
      readbackHash?: string | undefined;
    })
  | (ConsentAckBase<Snapshot, Payload> & {
      /** The grade actually achieved when this ack armed. */
      grade: "attested";
      /**
       * Hash of the exact bytes presented to the human. **Required here, and that
       * requirement is the whole point of this branch existing separately.**
       *
       * Without it the ack proves only that *a* readback occurred — not that it
       * described *this* payload. At `attested` the app renders the raw payload
       * itself and can therefore hash what it actually showed, which is the one
       * route that survives the agent reauthoring the rendition on the way to the
       * human (OWASP ASI09).
       *
       * **Where the value comes from.** {@link ReadbackSink} returns a
       * {@link ReadbackReceipt}; that receipt's `hash` is carried on
       * {@link DeliveryReport} and lands here. Take it from the receipt rather
       * than hashing the payload yourself — the receipt is what fixes the
       * canonicalization rule, and an app-derived hash reintroduces exactly the
       * collision the receipt exists to prevent.
       */
      readbackHash: string;
    });

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

/**
 * What the app rendered, handed to the readback sink.
 *
 * `payload` is the structured value core snapshot-compares at confirm time.
 * `presented` optionally carries the literal string shown to the human.
 *
 * Canonicalization runs over `{payload, presented?}` as a whole, so the two are
 * hashed together and neither can drift from the other. This follows Secure
 * Payment Confirmation, which hashes the *structured values that were
 * displayed* rather than pixels — a screenshot proves nothing about what the app
 * will later act on, and a payload alone proves nothing about what the human
 * actually saw.
 */
export interface Readback<Payload = unknown> {
  payload: Payload;
  /** The literal text shown to the human, when there is one. */
  presented?: string;
}

/**
 * What a readback presentation produced: a self-describing hash artifact.
 *
 * Deliberately not a bare hash string. A bare `=> Promise<string>` makes
 * canonicalization the app's problem, and the app gets it wrong in a way nothing
 * detects: `JSON.stringify({amount: 4180, coupon: undefined})` is byte-identical
 * to `JSON.stringify({amount: 4180})`, so two semantically different payloads
 * hash the same. A payload-level `toJSON` silently rehashes something other than
 * what was shown. That is the gate failing while appearing to work, which is the
 * one failure class this whole design exists to prevent.
 *
 * `alg` and `canonicalization` are literals rather than open strings so the
 * receipt describes itself and a type test can pin both. Widening either later
 * is additive.
 *
 * The canonicalization rule is JCS (RFC 8785) and it belongs to **core**, not to
 * the app — that is the entire point of returning a receipt rather than a hash.
 * The literal above admits exactly one answer, and Phase 8 ships the encoder
 * that produces it, so a sink never has to reach for `JSON.stringify`. Phase 1
 * declares the rule; it does not implement it.
 */
export interface ReadbackReceipt {
  /** Feeds {@link DeliveryReport.readbackHash} and {@link ConsentAck.readbackHash}. */
  hash: string;
  alg: "SHA-256";
  canonicalization: "JCS";
  /**
   * The exact bytes that were hashed. Re-read, never re-derived.
   *
   * Carried alongside `hash` on purpose. It is WebAuthn's own reason for making
   * `clientDataJSON` an opaque byte array rather than a string: intermediaries
   * must not parse-and-reserialize. Phase 8's confirm step, and any future
   * server-side verification, read these bytes instead of canonicalizing
   * `payload` a second time and hoping they agree.
   */
  canonical: Uint8Array;
}

/**
 * The app's readback presentation seam. Core calls it with the payload under
 * review; the app renders that payload itself and returns a
 * {@link ReadbackReceipt} binding the bytes that were shown. It is the only
 * route to an `attested` grade, because it is the only point at which the raw
 * payload — rather than the agent's rendition of it — reaches the human.
 *
 * **Write your sink generically — it is called with every payload type your app
 * reviews.** A sink narrowed to one payload (`(rb: Readback<Booking>) => …`) is
 * rejected here, because the parameter position is contravariant and this seam
 * is called with `Readback<X>` for every `X` the app ever puts through review.
 * The diagnostic is an unhelpful chain about `P` not being assignable to
 * `Booking`; this sentence exists so that costs a reader seconds rather than an
 * afternoon.
 *
 * A **generic function**, following {@link SnapshotNormalizer} exactly — not a
 * *defaulted generic alias*, meaning an alias that itself takes the payload as a
 * `<Payload = unknown>` parameter. The two look interchangeable and are not: at
 * a field position, such as the `ConciergeConfig` seam that carries this sink, a
 * defaulted alias instantiates its parameter to `unknown` once, so core loses
 * the payload type at every call site. A generic function infers it per call.
 *
 * That difference is invisible to the obvious test, because every app-sink shape
 * — generic, `unknown`-typed, contextually typed, and payload-specific — behaves
 * identically under both forms. The observable, testable difference is that a
 * generic function accepts no type argument: `ReadbackSink<Booking>` is TS2315.
 */
export type ReadbackSink = <P>(readback: Readback<P>) => Promise<ReadbackReceipt>;

/**
 * Structural stand-in for the platform `SubtleCrypto`, injected by the app.
 *
 * Core hashes nothing itself. Under `lib: ["ES2022"]` there is no `crypto` and
 * nothing to encode UTF-8 with — both are TS2304 — and that is the design rather
 * than an obstacle: owning unaudited crypto in the security-critical path buys
 * nothing, because consent arms on delivery through an already callback-shaped
 * hook, so an async digest costs no synchronous invariant. Follows
 * {@link AbortSignalLike} verbatim, so no DOM or Node typing enters core.
 *
 * **Declared as a METHOD, not a function-valued property, and that is
 * load-bearing.** Method parameters are bivariant, and bivariance is the only
 * thing that lets one declaration accept both the browser's `crypto.subtle` and
 * Node's `webcrypto.subtle`: the two define `BufferSource` differently — the DOM
 * lib as `ArrayBufferView<ArrayBuffer> | ArrayBuffer`, the Node typings as a
 * union of concrete typed-array types — and every function-property form was
 * measured to fail against at least one of them with TS2322.
 *
 * **This is the deliberate opposite of {@link ConsentPolicy.snapshotEquality},
 * which must stay function-property syntax**, because there bivariance would
 * silently un-break the very defect its guard exists to catch. Two adjacent
 * seams, two opposite syntaxes, both load-bearing: a reviewer who normalizes
 * them breaks one of them.
 *
 * **Read this before changing the line below.** The enforcement here is
 * asymmetric and not in this seam's favour. `snapshotEquality`'s syntax is
 * caught by a mutant in the phase battery (M9); this one **has no mutant and
 * cannot get one** — the discriminator is the DOM-vs-Node `BufferSource`
 * difference, and neither typing may be installed in this repo, so no in-repo
 * edit can make a wrong `DigestLike` fail to compile. The positive in
 * `test-d/consent.test-d.ts` stays green under the wrong syntax and is not a
 * guard. The only defences are code review, this comment, and a grep asserting
 * method syntax. Treat them as the last line of defence, because they are.
 */
export interface DigestLike {
  digest(algorithm: "SHA-256", data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
}

declare const serverChallengeBrand: unique symbol;

/**
 * An opaque challenge: issued by a server, echoed by the client.
 *
 * **Inbound only. Nothing in v0.1 produces one.** The brand is the mechanism,
 * not decoration: `const forged: ServerChallenge = "i-made-this-up"` is TS2322,
 * so "typed but never minted here" is compiler-enforced rather than merely
 * documented. A value received from a server and echoed back assigns fine; a
 * string an app invents does not, without an explicit cast a reviewer can see.
 *
 * Page JavaScript has no minting authority worth trusting, and every prior art
 * puts the authority out of its reach. WebAuthn's challenge is server-generated
 * *and server-stored*, because an echoed-but-unstored challenge provides no
 * replay protection at all (GHSA-gjjc-pcwp-c74m). Secure Payment Confirmation
 * has the browser, not the merchant, write the amount into the signed data. A
 * token minted in the same page context as every analytics tag and transitive
 * dependency would read far stronger than it is.
 *
 * The brand symbol is module-private on purpose and is not exported;
 * `isolatedDeclarations` emits it as a module-private `declare const`.
 */
export type ServerChallenge = string & { readonly [serverChallengeBrand]: true };

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
  /**
   * Absent on transports that cannot derive turn identity. Present does not
   * mean trustworthy — {@link TurnIdentityProvenance} is what says whether the
   * agent's own output could have minted it.
   */
  userTurnId?: string;
  calls: ReadonlyArray<ToolCall>;
  signal?: AbortSignalLike;
  /**
   * Defer a side effect until the agent's response has reached the human.
   *
   * The transport-side twin of {@link InvocationMeta.deferUntilDelivered}. The
   * two signatures must stay in agreement — this is the hook a transport author
   * actually implements, and the one the dispatcher forwards. They are asserted
   * equal in `test-d/transport.test-d.ts` precisely because nothing else reads
   * this interface: a regression here is invisible to every consent-shaped test.
   *
   * The effect receives a {@link DeliveryReport}, not a bare response id,
   * because a consumer that cannot see `outcome` cannot refuse a readback that
   * was cut off partway. Interruption, dismissal, navigation, and disconnect all
   * leave the human holding part of a payload, and part of a payload is not
   * consent.
   *
   * Absent when the transport cannot promise delivery, in which case consent
   * never arms and gated actions cannot proceed. That is the intended failure
   * mode: closed.
   */
  deferUntilDelivered?: (effect: (report: DeliveryReport) => void) => void;
}

/**
 * Where a transport's turn identity comes from — not merely whether it has one.
 *
 * The axis is **forgeability by the agent's own output**, and nothing else. It
 * is not speech versus text: no member below names a modality, because grades
 * and provenances in this file are modality-free and must stay so.
 *
 * **The failure this exists to make representable.** Where turn boundaries are
 * derived by a recognizer, the agent's own readback can re-enter through the
 * same input channel and be transcribed as though the human had produced it —
 * the agent's own output mints a fresh {@link InvocationMeta.userTurnId}. That
 * id is exactly what `bindTo: "userTurn"` accepts as proof that a human acted,
 * so the gate the whole design rests on is satisfied by the agent talking to
 * itself, with no human involved at any point.
 *
 * This is **not** the barge-in case, and turn classification does not catch it.
 * Barge-in is a human interrupting: their turn carries content like `stop` /
 * `wait` / `no` and classifies as non-affirmative. An echoed readback carries
 * the readback's own content — *"confirm the booking for four thousand
 * dollars"* — which reads as affirmative and passes classification cleanly.
 *
 * Phase 1's obligation is representability plus a type test. **The runtime gate
 * that refuses `bindTo: "userTurn"` on an `"agent-forgeable"` transport is
 * Phase 8** and must not be assumed present.
 */
export type TurnIdentityProvenance =
  /**
   * No turn identity at all. `bindTo: "userTurn"` is unavailable; such a
   * transport is limited to the weaker `bindTo: "response"`.
   */
  | "none"
  /**
   * Derived from a channel the agent's own output feeds back into. The
   * motivating case is a recognizer on an acoustic path, where a microphone
   * hears the agent's own synthesized speech — but the property, not the
   * medium, is what this member names. The identity is real and ordered; it is
   * simply not evidence, because the agent can mint one.
   */
  | "agent-forgeable"
  /**
   * Derived from an explicit human act the agent cannot itself perform — a
   * button, a click, a keypress. The only provenance under which a
   * `userTurnId` is evidence rather than merely a value.
   */
  | "human-attested";

export interface TransportCapabilities {
  /** What this transport can honestly promise. See {@link ConsentGrade}. */
  consentGrade: ConsentGrade;
  /**
   * Where turn identity comes from. See {@link TurnIdentityProvenance}.
   *
   * This replaced a `boolean`, which could record only *whether* turn identity
   * was derivable. Presence is the wrong question: a recognizer-derived id and
   * a keypress-derived id are both present, and only one of them is proof that
   * a human acted.
   *
   * Self-declared, and the kernel has no independent way to verify it. A
   * transport that overstates this defeats the gate; understating it only costs
   * capability. Understate when unsure.
   */
  userTurnIdentity: TurnIdentityProvenance;
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
