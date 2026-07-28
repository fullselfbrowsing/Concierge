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

/**
 * What the transport knows about *this* call, as distinct from its arguments.
 *
 * **Every optional member below carries an explicit `| undefined`.** Under this
 * repo's `exactOptionalPropertyTypes` a bare `x?: T` rejects `{ x: maybeX }`, and
 * a transport builds this object out of values that may be absent — so the
 * natural object literal is TS2375 without the widening. {@link ActionResult.reason}
 * carries the full reasoning; it is the same rule, applied here rather than once.
 *
 * Do not tidy the `| undefined` away. Removing it narrows the *write* type and
 * breaks every real constructor, while the *read* type stays identical:
 * `Equals<{x?: T}, {x?: T | undefined}>` is `true` under this flag — measured, not
 * assumed — so nothing goes red at the declaration site, and no read-shaped
 * assertion anywhere in the suite would notice. The detectors are the construction
 * positives in `test-d/transport.test-d.ts`, and they are the whole of the alarm.
 */
export interface InvocationMeta {
  /** Agent response this call belongs to. Metadata only — never a consent key. */
  responseId?: string | undefined;
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
  userTurnId?: string | undefined;
  /** Primary deduplication key. */
  callId?: string | undefined;
  /** Position within the batch. Execution is serial in this order. */
  outputIndex?: number | undefined;
  signal?: AbortSignalLike | undefined;
  /**
   * Defer a side effect until the agent's response has reached the human.
   *
   * Absent when the transport cannot promise delivery, in which case consent
   * never arms and gated actions cannot proceed. That is the intended failure
   * mode: closed.
   *
   * The function type is parenthesised before the union deliberately. Without the
   * parentheses the `| undefined` binds inside the return position, silently
   * changing the member from "an optional hook" to "a hook returning
   * `void | undefined`" — a different type that still compiles.
   */
  deferUntilDelivered?: ((effect: (report: DeliveryReport) => void) => void) | undefined;
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
  readonly responseId: string;
  /**
   * Anything but `completed` means consent must not arm.
   *
   * Read-only, so a truncated readback cannot be relabelled as a completed one.
   * While this was writable, `report.outcome = "completed"` compiled with no cast
   * and no diagnostic, which turned the refusal this field exists to make possible
   * into a suggestion. The whole reason `outcome` replaced a bare
   * `deliveredResponseId: string` was to make partial delivery *representable*; a
   * consumer that can overwrite the representation is back where it started.
   */
  readonly outcome: "completed" | "interrupted";
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
   *
   * The explicit `| undefined` is what lets that prescribed idiom compile.
   * `receipt?.hash` is `string | undefined`, and under this repo's
   * `exactOptionalPropertyTypes` a bare `readbackHash?: string` rejects
   * `{ …, readbackHash: receipt?.hash }` with TS2375 — the type refusing the exact
   * line the paragraph above instructs the author to write. A type that rejects
   * its own documented idiom does not stop the author; it teaches them to cast,
   * on the one field that is the sole route to an `attested` grade.
   */
  readonly readbackHash?: string | undefined;
}

/**
 * A handler's entire view of the world: validated args, the live bridge, the
 * invocation metadata, and — for gated actions — the ack that armed.
 *
 * **`AckPayload` sits at position 4, not position 3.** It moved when `Snapshot`
 * was threaded through the declaration chain (D-07), which is a positional change
 * to an exported type and therefore breaking for anyone who passed a third type
 * argument positionally. Nothing has published yet, so the cost is zero today; it
 * is recorded because it will not be zero again.
 *
 * **Both parameters must reach `ack`.** `Snapshot` is what
 * {@link ConsentPolicy.snapshotEquality} compares; `AckPayload` is what the human
 * actually reviewed. Forwarding only one produces a half-typed ack that still
 * compiles everywhere and is wrong only where it matters — which is why
 * `test-d/actions.test-d.ts` asserts `ack`, `args`, and `bridge` directly instead
 * of trusting the consent assertions to notice. They do not: a `consent?:
 * ConsentPolicy<Snapshot>` field still infers `Snapshot` correctly on its own
 * even when the handler has stopped receiving it.
 *
 * **`ack` admits an explicit `undefined`.** The dispatcher builds one context shape
 * for gated and non-gated actions alike, so it writes `{ args, bridge, meta, ack }`
 * with an `ack` of `ConsentAck<…> | undefined`. Against a bare
 * `ack?: ConsentAck<…>` that is TS2375 under `exactOptionalPropertyTypes`, and the
 * only ways out are two divergent context shapes or a cast — on the consent path,
 * which is the one place in this library a cast must never be the path of least
 * resistance. See {@link ActionResult.reason} for the general rule.
 */
export type ActionHandler<
  Args,
  B,
  Snapshot = unknown,
  AckPayload = unknown,
> = (ctx: {
  args: Args;
  /** `null` when the owning stage's bridge is not mounted. Always check it. */
  bridge: B | null;
  meta: InvocationMeta;
  /** Present only for actions declaring `consent.requires`. */
  ack?: ConsentAck<Snapshot, AckPayload> | undefined;
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
  readonly userTurnId: string;
  readonly responseId: string;
  /**
   * Normalized and structurally frozen at arm time. Never a live reference.
   *
   * The `readonly` is what *backs* that sentence. It was prose alone until now, in
   * the one file whose stated thesis is that prose has never once stopped a defect
   * from being built — and the ack is handed by reference into app-authored handler
   * code through {@link ActionHandler}'s `ctx.ack`, so an ordinary aliasing bug was
   * enough to rewrite what the human reviewed.
   *
   * The two halves are not interchangeable and neither is sufficient alone. The
   * modifier stops a write *through this reference* at compile time; `Object.freeze`
   * at the producer remains the runtime half and stops a write through an alias
   * obtained before arming, which the type cannot see at all.
   */
  readonly snapshot: Snapshot;
  /** Captured at review time and replayed verbatim at confirm time. */
  readonly payload: Payload;
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
  readonly challenge?: ServerChallenge;
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
 * **The union constrains construction; only `readonly` constrains mutation, and both
 * halves are load-bearing.** Removing either one reopens the hole, so they must be
 * read as a single mechanism rather than a rule and a decoration. Concretely: the
 * *write* type of a property on a union-typed value is the union of the branches'
 * write types, so with a writable discriminant `ack.grade = "attested"` compiled on
 * any ack at all — no cast, no `any`, no suppression, zero diagnostics — and forged
 * the attested branch. What made that critical rather than merely lax is what
 * happens next: narrowing on the forged discriminant types an *absent*
 * `readbackHash` as a plain `string`. So the escape did not merely fail to block a
 * forgery; it made the compiler issue a **false guarantee** to whatever compares
 * that hash, at precisely the narrowing idiom this file's own type tests teach as
 * correct (`test-d/consent.test-d.ts`, `narrowsThroughTheUnion`). A guarantee the
 * runtime does not back is worse than no guarantee, because the consumer stops
 * writing the fallback.
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
      /** The grade actually achieved when this ack armed. Read-only: see the note on the union above — a written discriminant forges the branch below. */
      readonly grade: Exclude<ConsentGrade, "attested">;
      /**
       * Optional below the strongest grade — and their not requiring it is
       * precisely what makes them lower. A readback may well have occurred; what
       * is missing is any binding between it and this payload. See the attested
       * branch for where the value comes from.
       */
      readonly readbackHash?: string | undefined;
    })
  | (ConsentAckBase<Snapshot, Payload> & {
      /** The grade actually achieved when this ack armed. Read-only: this is the branch a written discriminant forges its way into. */
      readonly grade: "attested";
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
      readonly readbackHash: string;
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
  /** Feeds {@link DeliveryReport.readbackHash} and {@link ConsentAck.readbackHash}. Read-only: the receipt's binding to the bytes below is the artifact, and severing it must not be a plain assignment. */
  readonly hash: string;
  readonly alg: "SHA-256";
  readonly canonicalization: "JCS";
  /**
   * The exact bytes that were hashed. Re-read, never re-derived.
   *
   * Carried alongside `hash` on purpose. It is WebAuthn's own reason for making
   * `clientDataJSON` an opaque byte array rather than a string: intermediaries
   * must not parse-and-reserialize. Phase 8's confirm step, and any future
   * server-side verification, read these bytes instead of canonicalizing
   * `payload` a second time and hoping they agree.
   *
   * **`Readonly<Uint8Array>`, not a bare `Uint8Array`, and the difference is the
   * whole point.** The property modifier and the element type are two different
   * mechanisms: `readonly canonical: Uint8Array` stops rebinding the reference and
   * was measured to leave `receipt.canonical[0] = 0` compiling — the bytes rewritten
   * in place, under a field whose name promises they are the exact ones that were
   * hashed. The element-level `Readonly<>` makes that TS2542. It costs nothing that
   * matters: `.length`, indexed reads, `for…of`, `new Uint8Array(receipt.canonical)`,
   * and the `ArrayBufferView` parameter position of {@link DigestLike.digest} all
   * still typecheck.
   *
   * A by-convention freeze at the producer was the alternative and was rejected,
   * because a convention is exactly what the paragraph above says WebAuthn refused
   * to rely on when it made `clientDataJSON` opaque rather than merely asking
   * intermediaries not to reserialize it.
   */
  readonly canonical: Readonly<Uint8Array>;
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

/**
 * One declared verb: its name, its schema, its redaction policy, its handler,
 * and — for consequential actions — the consent policy that gates it.
 *
 * **Naming convention, and it is load-bearing rather than cosmetic: `B` is a
 * type parameter standing for *some* bridge; `Bridge` is the exported interface.
 * A type parameter must never be named after the interface it would shadow.**
 * This declaration, {@link ActionHandler}, and {@link AnyActionDefinition} all
 * bound a parameter literally named `Bridge`, which shadowed
 * {@link Bridge} inside their own bodies while {@link BridgeRegistry} and
 * {@link StageDefinition} used `B` and meant the real interface — two spellings
 * for two different things in one file. That collision is very likely how CR-02
 * survived a whole phase: a reader scanning the unconstrained `B = unknown`
 * below sees a parameter that accepts anything and never connects it to the
 * `B extends Bridge` constraint hundreds of lines away, which was the broken
 * one. Thread a new type through this file and keep the convention.
 *
 * **`B` here is deliberately unconstrained and deliberately defaults to
 * `unknown`, and that is not an oversight left over from the rename.** An action
 * may be handed a plain object, `null`, or a real {@link Bridge}; constraining
 * this position to `B extends Bridge` would be a behavioural change wearing a
 * rename's clothes. The constrained spelling lives on {@link BridgeRegistry} and
 * {@link StageDefinition}, which is where a bridge is actually registered.
 */
export interface ActionDefinition<
  Name extends string = string,
  Schema extends StandardSchemaV1 = StandardSchemaV1,
  B = unknown,
  Snapshot = unknown,
  AckPayload = unknown,
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
  /**
   * Both `Snapshot` and `AckPayload` are forwarded, deliberately and together.
   * Dropping either is invisible to every consent-shaped assertion — see
   * {@link ActionHandler}.
   */
  handler: ActionHandler<InferOutput<Schema>, B, Snapshot, AckPayload>;
  effects?: SideEffects;
  /**
   * This action reads attacker-controllable content — third-party pages, user
   * submissions, inbound mail, scraped text, anything the app itself did not
   * author.
   *
   * **Why this is the only taint marker on the declaration.** Of the four fields
   * originally proposed (D-04), three were cut: `maxPerTurn` is runner-level in
   * every framework checked, so {@link ConciergeConfig} — beside
   * `commitWindowMs` — is where it *would* belong **if it ever shipped, which is
   * not scheduled**; `impact?:` would be a second, weaker severity dial
   * next to `consent.minGrade`, which `buildCatalog` already enforces, and the two
   * could silently disagree; `conflictsWith` has no prior art as declaration
   * metadata and overlaps stage scoping, `consent.requires`, and serial batch
   * execution. Reinstating any of them because it is "cheap while we're in here"
   * is the specific anti-pattern D-04 names. This one survived because two of the
   * three lethal-trifecta legs are *structurally always on* here: an action runs
   * inside the app the user is already logged into, and {@link ActionResult.message}
   * returns to the model by design. Untrusted ingress is the single variable leg,
   * so it is the only one worth declaring.
   *
   * **A sibling of `effects`, not a member of {@link SideEffects}, and the
   * placement is load-bearing.** `SideEffects` is the MCP tool-hint mirror and its
   * entire value is 1:1 fidelity. The hint this resembles is `openWorldHint`,
   * which MCP is actively reconsidering precisely because it conflates ingress
   * with egress; importing a defective name into a mirror block would corrupt it.
   * A future `concierge-mcp` can still derive `openWorldHint: true` from this
   * field — a safe over-approximation, since that hint already defaults to `true`.
   *
   * **Phase 1 ships this field and its type test, and nothing else reads it.**
   * The build-time gate is **SEC-05, in Phase 3**: a predicate in CAT-05's exact
   * shape, reporting a `readsUntrusted` action that carries no consent policy.
   * Until that lands, setting this to `true` changes no behaviour. Saying so
   * plainly is not a caveat but a requirement — an unenforced safety marker
   * sitting beside a redaction policy that genuinely fails closed is this
   * project's named failure mode, and a reader who mistakes this for a control
   * has been misled by us rather than by their own optimism.
   */
  readsUntrusted?: boolean;
  consent?: ConsentPolicy<Snapshot>;
  /**
   * Terminal actions tear down the session. They short-circuit their batch and
   * emit no result envelope, because nothing remains to receive it.
   */
  terminal?: boolean;
}

/**
 * The erased collection view: an action of *some* shape, for the two places that
 * hold many of them at once.
 *
 * **The `any` in the `Snapshot` and `AckPayload` positions is deliberate and
 * load-bearing rather than laziness.** Threading `Snapshot` puts it in two
 * contravariant positions — `snapshotEquality`'s parameters and the handler's
 * `ctx.ack` — so `ActionDefinition<…, Booking, …>` is simply *not* assignable to
 * `ActionDefinition<…, unknown, unknown>` (TS2375, verified). A collection cannot
 * be typed at `unknown` at all; heterogeneous actions have to be admitted some
 * other way, and omitting the erasure is not an option — `types.ts` does not
 * compile without it.
 *
 * `never`-erasure also works and was verified. It was rejected because it types
 * `snapshotEquality` as `(a: never, b: never) => boolean`, so the consent kernel —
 * the one place that must actually *call* the comparator — needs a cast at the
 * call site. Forcing a cast into the security-critical path is worse than one
 * documented `any` in a collection type, and a cast there is far easier to get
 * quietly wrong. Settled by D-12 item 2.
 *
 * What is **not** given up: the concrete `Snapshot` still lives on every
 * individual declaration, which is where `snapshotEquality` is written and
 * typechecked. Only the collection is erased, and a declaration that never enters
 * one keeps full typing throughout.
 *
 * The cost surfaces in Phases 4, 6, and 8, where the catalog and the kernel read
 * this type. **Revisit it in Phase 8 against a real kernel** — that is the first
 * point at which the alternative's cost is measurable rather than predicted.
 */
export type AnyActionDefinition<B = unknown> = ActionDefinition<
  string,
  StandardSchemaV1,
  B,
  any,
  any
>;

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
 *
 * **Each type parameter defaults to the top of its own constraint, and the rule
 * behind that is worth stating because the wrong form looks reasonable:** a
 * default that is the *bottom* of its own constraint admits nothing; the *top*
 * admits everything the constraint admits.
 *
 * These two parameters used to default to a record whose value type was `never`
 * — which reads like "no members yet" and is in fact the bottom of each
 * constraint, since such a record requires every property it has to be `never`.
 * A bridge carrying any real member was therefore not assignable to it, and that
 * default is precisely what {@link BridgeRegistry} and {@link StageDefinition}
 * constrain against. Measured before the fix:
 * `Bridge<{applyFilter: (k: string) => void}, {count: () => number}> extends Bridge`
 * evaluated to **false**, so `BridgeRegistry<ResultsBridge>` was TS2344 and this
 * project's own canonical example — an app exposing `applyFilter({key, value})`
 * — did not compile. Do not "restore" the empty-looking form; it is the defect.
 *
 * Consequently the bare spelling `Bridge`, as it appears in
 * `BridgeRegistry<B extends Bridge = Bridge>` and
 * `StageDefinition<B extends Bridge = Bridge>`, means **the widest bridge, not
 * the empty one**. A `BridgeRegistry` written with no type argument accepts any
 * bridge rather than none; it is a permissive supertype, not a placeholder
 * waiting to be filled in.
 *
 * Guarded by `_realBridgeSatisfiesConstraint` and the two-bridge assembly in
 * `test-d/actions.test-d.ts`, both observed red under a mutation that puts the
 * old defaults back.
 */
export interface Bridge<
  Actions extends Record<string, (...args: never[]) => unknown> = Record<
    string,
    (...args: never[]) => unknown
  >,
  Snapshot extends Record<string, () => unknown> = Record<string, () => unknown>,
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
  /**
   * Erased in `Snapshot` and `AckPayload` — see {@link AnyActionDefinition}. A
   * stage holds actions whose snapshots have nothing to do with each other, and
   * the erased-to-`unknown` form this used to carry stopped accepting any of them
   * the moment `Snapshot` became real.
   */
  actions: ReadonlyArray<AnyActionDefinition<B>>;
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
 *
 * **Every optional member below carries an explicit `| undefined`**, the same rule
 * recorded on {@link InvocationMeta} and, in full, on {@link ActionResult.reason}.
 * A transport assembles this envelope out of values that may be absent, and
 * `{ responseId, calls, userTurnId: maybeId }` is TS2375 against a bare
 * `userTurnId?: string` under `exactOptionalPropertyTypes`.
 *
 * Do not tidy it away. Narrowing the write type back leaves the read type
 * identical, so the declaration site stays quiet and no read-shaped assertion
 * moves; the construction positives in `test-d/transport.test-d.ts` are the only
 * thing that goes red.
 */
export interface ToolBatch {
  responseId: string;
  /**
   * Absent on transports that cannot derive turn identity. Present does not
   * mean trustworthy — {@link TurnIdentityProvenance} is what says whether the
   * agent's own output could have minted it.
   */
  userTurnId?: string | undefined;
  calls: ReadonlyArray<ToolCall>;
  signal?: AbortSignalLike | undefined;
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
   *
   * Parenthesised before the union for the reason recorded on the
   * {@link InvocationMeta} twin: unparenthesised, the `| undefined` binds inside
   * the return position and the two signatures stop agreeing while both compile.
   */
  deferUntilDelivered?: ((effect: (report: DeliveryReport) => void) => void) | undefined;
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
  /** What this transport can honestly promise. See {@link ConsentGrade}. Read-only: a grade raised after declaration is a capability nothing ever verified. */
  readonly consentGrade: ConsentGrade;
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
   *
   * **Fixed at declaration and not upgradable in place.** This whole member exists
   * so the kernel can tell an id the agent could have minted from one it could not.
   * A value that can be raised from `agent-forgeable` to `human-attested` after the
   * fact carries none of that distinction — it converts a value the kernel is told
   * not to trust into one it is told to trust, which is the exact substitution the
   * type was introduced to make impossible. The `readonly` is what closes it; with
   * the member writable, `t.capabilities.userTurnIdentity = "human-attested"`
   * compiled with no cast.
   */
  readonly userTurnIdentity: TurnIdentityProvenance;
  /** Whether a single response may contain several calls. */
  readonly parallelCalls: boolean;
  /** Whether the catalog can be swapped mid-session on stage change. */
  readonly dynamicCatalog: boolean;
}

/**
 * The only vendor-shaped seam. Core has no opinion about whether the agent
 * arrives over WebRTC, SSE, MCP stdio, WebMCP, or a command palette.
 */
export interface Transport {
  /**
   * What this transport can honestly promise. See {@link TransportCapabilities}.
   *
   * **This `readonly` is now genuinely protective, and it was not before.** A
   * `readonly` property stops the *reference* being rebound and says nothing about
   * the members it points at, so while `TransportCapabilities` was writable this
   * modifier read as protection while `t.capabilities.consentGrade = "attested"`
   * compiled cleanly — worse than no modifier, because a reader stopped looking.
   * The two levels must stay in step: dropping `readonly` from any member of
   * `TransportCapabilities` restores the misleading state rather than merely
   * loosening this one.
   */
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

/**
 * Injectable timing seam: run `fn` after `delayMs`, and return a function that
 * cancels it if it has not run yet.
 *
 * It exists so the two windows on {@link ConciergeConfig} —
 * {@link ConciergeConfig.commitWindowMs} and
 * {@link ConciergeConfig.dedupeWindowMs} — are driven through a seam the app
 * injects rather than a hard-wired global timer. Three things follow, and the
 * third is the one that makes this structural rather than merely tidy:
 *
 * 1. **Testable without fake timers.** A test passes a scheduler that records
 *    the callback and fires it on demand, so a 600 ms commit window costs no
 *    wall-clock time. Timer mocking is global, process-wide state; a seam is
 *    local to the instance under test and cannot leak into a neighbouring one.
 * 2. **Controllable where the clock is not standard.** A throttled background
 *    tab, a virtualized runtime, or a server rendering pass can supply a timer
 *    that matches its own notion of elapsed time instead of inheriting the
 *    platform's.
 * 3. **Core has no timer to hard-wire in the first place.** `setTimeout` is
 *    declared by the DOM lib and by the Node typings, and this package imports
 *    neither — under `lib: ["ES2022"]` the identifier is TS2304, measured, not
 *    assumed. So this joins {@link AbortSignalLike} and {@link DigestLike} as a
 *    structural stand-in for a platform capability, and injection is the only
 *    route by which core gets a clock at all.
 *
 * **The returned canceller is load-bearing, not a convenience.** "A human
 * interrupted — do not land the effect" is a cancellation, and it is the entire
 * purpose of the commit window; a scheduler returning `void` cannot express it.
 * Returning a plain function rather than a platform handle keeps core free of a
 * timer-id type, whose spelling differs between the DOM (`number`) and Node
 * (`Timeout`) — the same `BufferSource` split that shapes {@link DigestLike}.
 *
 * **Phase 6 (DSP-08) implements both windows against this and may refine this
 * signature.** Nothing publishes until v0.1 completes, so that change is free
 * now and will not be free later. Phase 6 also owns what an *omitted* scheduler
 * means: because of point 3 there is no `setTimeout` in scope to fall back to,
 * so a default has to reach a platform timer through a structural access or the
 * seam has to become required. Phase 1 declares the shape and does not decide
 * that.
 */
export type Scheduler = (fn: () => void, delayMs: number) => () => void;

/**
 * Everything core needs to build a catalog and run a dispatch, and nothing it
 * can reach for on its own.
 *
 * The optional members below fall into two groups, and the split is worth
 * reading before adding a member here. `normalizeSnapshot`, `presentReadback`,
 * `digest`, and `scheduler` are **injected capabilities**: each is something
 * core structurally cannot do — detach a framework proxy, render a payload to a
 * human, hash bytes, read a clock — and every one of them is unreachable under
 * `lib: ["ES2022"]` or unknowable without the app. `commitWindowMs` and
 * `dedupeWindowMs` are **policy numbers**. Keep the two groups apart.
 *
 * **`maxPerTurn` is deliberately absent, and it is not merely misplaced — it is
 * unscheduled.** D-04 cut it along with `impact` and `conflictsWith`; the note
 * on {@link ActionDefinition.readsUntrusted} explains why. `ConciergeConfig` is
 * where it would belong *if it ever shipped*, which is exactly why the
 * temptation to add it lands on this interface. Reinstating a cut field because
 * it is "cheap while we're in here" is the specific anti-pattern D-04 names.
 */
export interface ConciergeConfig {
  /**
   * Ordered — first match wins.
   *
   * An array rather than a keyed object because object key iteration puts
   * integer-like keys first, which would make match order depend on whether a
   * stage happened to be named `"2"`.
   *
   * **`B` is erased with `any` here, and {@link AnyActionDefinition} is the
   * precedent rather than a coincidence** — this is the same erasure that alias
   * already applies to `Snapshot` and `AckPayload`, applied to the third
   * variance-affected parameter at the one site that collects many stages at
   * once. The mechanism: `B` reaches contravariant positions through
   * `AnyActionDefinition<B>`'s handler — `ctx.bridge` — so a
   * `StageDefinition<ResultsBridge>` is simply *not* assignable to a
   * `StageDefinition<Bridge>` (TS2375, verified), and widening the default does
   * not help, because widening a parameter never repairs a contravariant
   * position. A real app has one bridge per stage sharing nothing with the next,
   * so the collection cannot be typed at any single concrete `B`, and
   * `unknown`-erasure does not compile here for the identical reason it does not
   * compile in {@link AnyActionDefinition}, whose doc comment records the
   * measurement.
   *
   * What is **not** given up: the concrete `B` still lives on every individual
   * {@link StageDefinition}, which is where its registry and its actions are
   * written and typechecked. Only the collection is erased.
   *
   * **Revisit in Phase 8 against a real kernel**, together with
   * {@link AnyActionDefinition}'s erasure — that is the first point at which the
   * alternative's cost is measurable rather than predicted.
   *
   * Guarded by `_multiBridgeConfig` in `test-d/actions.test-d.ts`, observed red
   * under a mutation that collects at the defaulted `B` again.
   */
  stages: ReadonlyArray<StageDefinition<any>>;
  /** Available in every stage. Erased like `StageDefinition.actions`. */
  crossStage?: ReadonlyArray<AnyActionDefinition>;
  /**
   * Detaches snapshots from framework reactivity before storage. Supplied by
   * the framework adapter; defaults to a deep freeze.
   */
  normalizeSnapshot?: SnapshotNormalizer;
  /**
   * The app's readback presentation seam. See {@link ReadbackSink}.
   *
   * App-supplied and core-called: core hands it the payload under review, the
   * app renders that payload itself, and the {@link ReadbackReceipt} it returns
   * binds the bytes that were shown. This field is what gives
   * {@link DeliveryReport.readbackHash} a producer — declaring the sink without
   * a seam to arrive through left the hash with a consumer and no source.
   *
   * It is also the only route to an `attested` grade, because that grade is
   * defined by the raw payload — rather than the agent's rendition of it —
   * reaching the human, and this is the only point at which it does.
   *
   * **Write your sink generically — it is called with every payload type your
   * app reviews.** A sink narrowed to one payload
   * (`(rb: Readback<Booking>) => …`) is rejected *at this field*, because the
   * parameter position is contravariant and core calls the seam with
   * `Readback<X>` for every `X` that goes through review. The diagnostic is an
   * unhelpful chain about `P` not being assignable to `Booking`; this sentence
   * exists so that costs a reader seconds rather than an afternoon.
   *
   * Optional here because an app whose actions need no readback never calls it.
   * Whether a *missing* sink downgrades an `attested` action or fails its build
   * is Phase 8's decision, not Phase 1's.
   */
  presentReadback?: ReadbackSink;
  /**
   * The platform digest, injected. See {@link DigestLike}.
   *
   * Injected rather than bundled because `crypto` does not exist under
   * `lib: ["ES2022"]` — it is TS2304, as is anything to encode UTF-8 with — and
   * because owning unaudited crypto in the security-critical path buys nothing.
   * Core hashes nothing itself.
   *
   * A browser app passes `crypto.subtle`. A server app passes
   * `webcrypto.subtle` from `node:crypto`. **Both are accepted unmodified** — no
   * wrapper, no adapter, no cast. That is exactly what {@link DigestLike}'s
   * method syntax buys, and why normalizing it to a function-valued property
   * would break one of the two.
   */
  digest?: DigestLike;
  /**
   * Timer seam for the two windows below. See {@link Scheduler}, which records
   * why core cannot simply call `setTimeout` and what an omitted scheduler is
   * left for Phase 6 to decide.
   */
  scheduler?: Scheduler;
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
  /**
   * The stage the session is currently in, or `null` when no stage matches.
   *
   * **A getter function, never a value, and that is the file's standing rule
   * rather than a preference here.** Bridge snapshots are getters for the same
   * reason ({@link BridgeRegistry.read}): a value captured at registration goes
   * stale inside every closure that captured it, and a stale *stage* is worse
   * than a stale snapshot — it is what a devtools panel renders and what an
   * adapter compares against to decide whether to republish the catalog. A field
   * would read correct at the moment of destructuring and be wrong forever after.
   *
   * Returns `string | null`, matching {@link Concierge.stageFor} exactly. The
   * session's stage *is* `stageFor` applied to the current context, so two
   * different spellings of "no stage" would be a defect waiting to be written.
   *
   * Phase 7 implements this.
   */
  stage: () => string | null;
  /**
   * Subscribe to stage changes; returns an unsubscriber. The shape follows
   * {@link Transport.onToolBatch}, which is the file's subscription convention.
   *
   * **The implementation MUST identity-guard the unsubscriber** — remove the
   * subscription only if the entry is still the one this call created — for
   * precisely the reason {@link BridgeRegistry.register} does. React StrictMode
   * double-mount, Vue HMR, and Svelte remount all run a cleanup *after* its
   * replacement has already subscribed; an unguarded unsubscriber then detaches
   * the live listener instead of the dead one, and the session silently stops
   * republishing the catalog on stage change. The symptom is an agent holding a
   * stale action set on a page that has plainly moved on, which is
   * indistinguishable from a stage-matching bug and will be debugged as one.
   *
   * The callback takes `string | null` rather than `string` because entering "no
   * matching stage" is itself a change subscribers must see — that is when the
   * catalog empties.
   *
   * Phase 7 implements this.
   */
  onStageChange: (cb: (stage: string | null) => void) => () => void;
  stop: () => void;
}

export interface SessionConfig {
  concierge: Concierge;
  transport: Transport;
  initialContext?: StageContext;
}
