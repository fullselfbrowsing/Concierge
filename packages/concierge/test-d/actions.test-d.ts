// SC-7a — `snapshotEquality` on a declared action is typed against that action's real
// snapshot rather than `unknown`. SC-7b — a `consent.requires` target naming a *different*
// action does not widen the action's own `Name`. SC-7g — `readsUntrusted` is a member of
// the declaration and is absent from `SideEffects`.
//
// Plus the two things every obvious assertion here misses. First, **escapee 3**: that
// `ActionDefinition.handler` forwards BOTH `Snapshot` and `AckPayload` through to
// `ctx.ack`. Reverting the forward escapes every consent assertion above it, because
// `consent?: ConsentPolicy<Snapshot>` still infers `Snapshot` correctly on its own and
// `ctx.ack` still typechecks — as `ConsentAck<unknown, unknown>`. Second, the *positive*
// half of the erasure: heterogeneous actions actually assembling into a stage and into
// `crossStage`, which is what proves `AnyActionDefinition` does its job rather than
// merely compiling in isolation.
//
// The final block covers D-03's config half and D-08: the three injected `ConciergeConfig`
// seams (`presentReadback`, `digest`, `scheduler`) and the two new `Session` members. They
// live here rather than in a fifth file because the `ConciergeConfig` erasure positive is
// already here, and one interface asserted from two files drifts.
//
// **The bridge block (CR-02, added in plan 01-11) is here for the same reason and is the
// one section whose absence was itself the defect.** Until it existed, nothing in this
// suite instantiated `Bridge` with a member, so its two type parameters were exercised
// only at their defaults — and the defaults were the bottom of each constraint rather than
// the top, meaning no bridge carrying a real action or snapshot satisfied `B extends
// Bridge`. Nine plans and a 19-mutation battery went past it. The block sits beside the
// `ConciergeConfig` erasure positive on purpose: the second half of CR-02 is that same
// erasure, applied to `Bridge` at the `stages` collection site, and reading the two apart
// makes neither legible. `_handlerBridge` and `_registryReadIsNullable` (WR-03) pin the
// `| null` on both sides of the no-bridge contract; the note on `_handlerBridge` records
// how the old form managed to assert nothing at all while looking correct.
//
// **This file exports nothing, and that is a phase-wide rule, not a style preference.**
// The imports below already give it module status. `isolatedDeclarations` demands an
// explicit annotation on anything reaching the declaration surface, and
// `const confirm = defineAction({…})` is deliberately *un*annotated because its inferred
// type is the thing under test — annotating it would hand the test the answer it exists
// to derive. Non-exported locals are exempt from that demand. **The exemption ends the
// instant anything exported reads one**, which was demonstrated here rather than assumed:
// temporarily adding `export type _ConfirmProbe = typeof confirm;` produced exit 2 and
// exactly one error —
//
//   error TS9010: Variable must have an explicit type annotation with
//   --isolatedDeclarations.
//
// — reported at column 7 of the **`const confirm` declaration**, not on the exported
// alias seven lines below that reached for it. (The exact line number is left out on
// purpose; pinning one here would go stale on the next edit to this comment, and the
// verbatim diagnostic is recorded in `01-06-SUMMARY.md`.) That asymmetry is precisely
// why the rule is "export nothing" rather than "annotate your exports": the diagnostic
// lands on the innocent line, so the first fix a developer reaches for is to annotate
// `confirm` — which silently disables `_nameNotWidened` and `_snapshotInferred`, since
// both exist only to read an inferred type. The probe was deleted and the program
// returned to exit 0.
//
// Every predicate is on ONE line however long. `tsc` echoes only the line the failing
// type argument sits on, so wrapping `Expect<` onto its own line leaves the alias name on
// a line the diagnostic never prints and `Type 'false' does not satisfy the constraint
// 'true'` becomes the whole of the message. Measured in plan 01-02, where wrapping
// silently disabled four of five assertions. The corresponding examples in
// `01-RESEARCH.md` are wrapped and are wrong on this point. Do not let a formatter touch
// these lines.
//
// Exactly two suppression directives appear below and no more — a count a grep for the
// token can confirm, which is why the token itself is not repeated in this prose. Both
// guard something a predicate cannot express: an object-literal property that must fail
// to accept a value, and a property reference that must fail to resolve.

import type { Assignable, Equals, Expect } from "./_assert.js";
import type {
  ActionDefinition,
  Bridge,
  BridgeRegistry,
  ConciergeConfig,
  ConsentAck,
  ConsentGrade,
  ConsentPolicy,
  DigestLike,
  InvocationMeta,
  ReadbackReceipt,
  ReadbackSink,
  ReasonCode,
  Scheduler,
  Session,
  StageDefinition,
  StandardSchemaV1,
} from "../src/types.js";
import { defineAction } from "../src/define-action.js";

// --------------------------------------------------------------------------
// Fixtures — every one local, none exported
// --------------------------------------------------------------------------

/** A payload with a consequential field on it. Test fixture only. */
type Booking = { id: string; amount: number };

/**
 * A second snapshot type whose only job is to be unrelated to `Booking`. Two actions
 * with genuinely different snapshots are what make the erasure assertion mean anything;
 * two actions sharing one snapshot type would assemble even under the broken form.
 */
type Shipment = { id: string; weight: number };

/**
 * What the human reviewed. Deliberately not `Booking` — if the ack payload and the
 * snapshot were the same type, `_handlerAck` could pass with the two forwarded arguments
 * swapped, which is exactly the half-broken forward it exists to catch.
 */
type AckShape = { quotedTotal: number };

declare const schema: StandardSchemaV1<unknown, { q: string }>;

// A `declare function` stand-in for the real `defineAction` stood here for two phases.
// **Phase 3 owns the real function**, and plan 03-01 swapped it for the value imported
// above. Its ambient spelling is deliberately not reproduced in this prose, so that a
// grep for it confirms the placeholder is gone.
//
// The real signature has SIX type parameters, not five: `D` — the description — sits at
// position 2, ahead of the schema, and carries the CAT-07 literal guard. The parameter
// is `Omit<ActionDefinition<…>, "description"> & { description: LiteralDescription<N, D> }`
// rather than a plain `ActionDefinition<…>`, so inference now runs through a mapped type
// and an intersection instead of a bare generic reference.
//
// All three call sites in this file survived the swap unchanged and none is annotated.
// They rely on pure inference and their descriptions are inline literals — valid CAT-07
// accept cases — which is exactly why they are the canary: if the guard ever
// over-rejects, or if `Name`/`Snapshot` stop being inferable through the `Omit`,
// `_nameNotWidened` and `_snapshotInferred` below go red. Do not repair that by
// annotating a call site; both predicates exist only to read an inferred type, and
// annotating one hands it the answer. Fix `src/define-action.ts` instead.

// --------------------------------------------------------------------------
// SC-7a — `snapshotEquality` must not degrade to `(a: unknown, b: unknown)`
// --------------------------------------------------------------------------

const eq = (a: Booking, b: Booking): boolean => a.amount === b.amount;

/** The positive: a comparator over the real snapshot fits a policy over that snapshot. */
const _policyTyped: ConsentPolicy<Booking> = {
  requires: "reviewBooking",
  bindTo: "userTurn",
  snapshotEquality: eq,
};

/**
 * The negative — and **M9's *first* detector; the second is `_policyNotBivariant` in
 * `consent-variance.test-d.ts`**.
 *
 * A `Booking` comparator must not fit a `ConsentPolicy<unknown>`. The directive sits
 * directly above the *property*, not above the declaration, because that is where the
 * error is reported: TS2322 on `snapshotEquality`, not on `_policyDegraded`.
 *
 * Switching `snapshotEquality` to method syntax makes its parameters bivariant, the
 * assignment above starts succeeding, and this directive goes unused — a lone TS2578 is
 * then this file's only symptom that the guard has stopped guarding; since plan 02-11
 * `_policyNotBivariant` fails with TS2344 in the same run. That is the shape of "fix" a
 * reviewer applies by deleting a test, which is why
 * {@link ConsentPolicy.snapshotEquality}'s own doc comment points here.
 */
const _policyDegraded: ConsentPolicy = {
  requires: "reviewBooking",
  bindTo: "userTurn",
  // @ts-expect-error - a Booking comparator must NOT fit ConsentPolicy<unknown> (SC-7a)
  snapshotEquality: eq,
};

// --------------------------------------------------------------------------
// SC-7b — a `requires` target must not widen the action's own `Name`
// --------------------------------------------------------------------------

/**
 * A **static pin** against `requires` being silently retyped, and nothing more.
 *
 * It is explicitly *not* M10's detector, and must not be repurposed into one. Under M10
 * — `ConsentPolicy<Snapshot, Name extends string = string>` with `requires: Name` —
 * `ConsentPolicy<Booking>["requires"]` is still `string`, because `Name` falls back to
 * its own default when only one argument is supplied. This line stays silent by
 * construction. The mutant is caught below, so its silence is not a hole; altering this
 * line to make it fire would be remediating a suite that already works.
 */
type _requiresIsString = Expect<Equals<ConsentPolicy<Booking>["requires"], string>>;

/**
 * The declaration both guards below read. `name` is one literal and `consent.requires`
 * is a *different* one, which is the entire point: `Name` is inferred from `name` alone
 * and must not pick up the union of the two.
 *
 * Deliberately unannotated — see the TS9010 note in this file's header.
 */
const confirm = defineAction({
  name: "confirmBooking",
  description: "Confirm the booking.",
  schema,
  redact: "drop",
  handler: () => ({ ok: true, message: "Done." }),
  consent: { requires: "reviewBooking", bindTo: "userTurn", snapshotEquality: eq },
});

/** M10 detector 1: `Name` stayed the action's own name and did not absorb `requires`. */
type _nameNotWidened = Expect<Equals<(typeof confirm)["name"], "confirmBooking">>;

/** M10 detector 2, and M3's: `Snapshot` was inferred from the comparator, not defaulted. */
type _snapshotInferred = Expect<Equals<NonNullable<(typeof confirm)["consent"]>, ConsentPolicy<Booking>>>;

// --------------------------------------------------------------------------
// WR-04 — `ConsentPolicy`'s members, pinned against their literal spellings
// --------------------------------------------------------------------------

// **`_snapshotInferred` directly above guards none of what follows, and saying
// why plainly is the point of this block.** It expresses *both* sides in terms
// of `ConsentPolicy`, so any change made *inside* `ConsentPolicy` changes both
// sides identically and the assertion stays true. It pins the `Snapshot` type
// argument and nothing else — which is exactly what it was written to do, and it
// stays exactly as it is: it is M3's and M10's detector, and the fault found here
// is that it is insufficient, not that it is wrong. The pins below name the
// literal spellings instead, and naming them is the whole of what makes a pin
// able to see a widening.
//
// Measured before these four existed, against the full four-file suite:
// `bindTo: "userTurn" | "response"` → `bindTo: string` exits **0**. So does
// `minGrade?: string`, so does dropping `reason` from `onMissing`, and so does a
// sixth member appearing beside `minGrade`. `ConsentPolicy` — the consent gate's
// own declaration — had no member-level assertion anywhere in the suite.

/** The selector between the strong gate and the weak one. Widened to `string`, `bindTo: "usreTurn"` typechecks; whether the Phase 8 runtime then falls back to `"response"` or gates nothing at all, the compiler said nothing either way. */
type _bindToIsClosed = Expect<Equals<ConsentPolicy["bindTo"], "userTurn" | "response">>;

/** The dial `buildCatalog` enforces at build time (CAT-04), and the reason D-04 cut `impact` rather than shipping a second, weaker severity axis beside it. Widened to `string`, every word is a grade and the throw never fires. */
type _minGradeIsGrade = Expect<Equals<ConsentPolicy["minGrade"], ConsentGrade | undefined>>;

// `_onMissingShape`'s right-hand side spells its members out on purpose, and the
// spelling is the assertion rather than a style choice. `onMissing` is *declared*
// as a `Pick` over {@link ActionResult}, so writing the right-hand side that same
// way would put both sides through `ActionResult` — after which any change inside
// `ActionResult` changes both sides identically and the line stays true forever.
// That is the exact mechanism described for `_snapshotInferred` twenty lines up,
// and reproducing it in the block that exists to close it would be this suite
// failing on its own terms. Written for the flat `ActionResult` that plan 01-13
// recorded and kept; if that shape ever moves, this line is expected to go red and
// be re-derived from the new declaration rather than relaxed.

/** The result an action returns when its consent policy was never armed. Drop `reason` and the dispatcher loses the machine-readable half of "why nothing happened". */
type _onMissingShape = Expect<Equals<ConsentPolicy["onMissing"], { readonly reason?: ReasonCode | undefined; readonly message: string } | undefined>>;

/** Modelled on `_transportKeys` in `transport.test-d.ts`, and for the same reason: the member set is closed, so a second severity dial cannot appear beside `minGrade` unnoticed — which is the failure D-04 spent four entries preventing. */
type _policyKeys = Expect<Equals<keyof ConsentPolicy, "requires" | "bindTo" | "snapshotEquality" | "minGrade" | "onMissing">>;

// --------------------------------------------------------------------------
// Escapee 3 — the handler forward. The assertion nothing else catches.
// --------------------------------------------------------------------------

/**
 * The bridge type `Ctx` is instantiated at.
 *
 * A **plain structural object**, deliberately not the `Bridge<…>` instantiation
 * `ResultsBridge` further down, because `ActionDefinition`'s third parameter is
 * deliberately *unconstrained* — an action may be handed a plain object, `null`, or a
 * real bridge — and the assertion below has to keep exercising it that way. Using
 * `ResultsBridge` here would quietly turn a test of the unconstrained position into a
 * test of the constrained one.
 *
 * What matters about it is only that it is **not itself `null`**. See `_handlerBridge`.
 */
type PlainBridge = { actions: { applyFilter: (k: string) => void }; snapshot: { count: () => number } };

/**
 * The handler's context, extracted from a fully explicit declaration so that a dropped
 * forward has nowhere to hide behind inference.
 *
 * Reverting `handler` to `ActionHandler<InferOutput<Schema>, B>` leaves every assertion
 * above green: the consent policy still infers `Booking`, `ctx.ack` still exists, and it
 * still typechecks — as `ConsentAck<unknown, unknown>`. The gate would be reading a
 * snapshot it cannot see the shape of, and only these three lines would say so.
 */
type Ctx = Parameters<ActionDefinition<"x", typeof schema, PlainBridge, Booking, AckShape>["handler"]>[0];

/** Both type arguments reach the ack, in the right order. M8's detector. */
type _handlerAck = Expect<Equals<Ctx["ack"], ConsentAck<Booking, AckShape> | undefined>>;

/** The schema's output still reaches `args` — the forward did not displace it. */
type _handlerArgs = Expect<Equals<Ctx["args"], { readonly q: string }>>;

/**
 * The bridge reaches `bridge` **and arrives nullable** — WR-03's detector, and the `| null`
 * half is the part that only started being observed here in plan 01-11.
 *
 * This line used to read `Equals<Ctx["bridge"], null>`, because `Ctx` instantiated the
 * bridge parameter as `null` — the single argument for which `B | null` collapses to
 * `null` and the union becomes unobservable. The assertion was therefore blind to exactly
 * the `| null` its own doc comment claimed it guarded, and the measured consequence was
 * that `bridge: B | null` → `bridge: B` **escaped the entire four-file suite at exit 0**.
 *
 * That contract is load-bearing rather than decorative: `ActionHandler` tells handlers
 * "Always check it", and `FailureReason` carries `no_bridge` as the code for precisely
 * this state. Deleting the `| null` deletes the represented state the code exists to
 * report. Never instantiate this parameter as `null` again.
 */
type _handlerBridge = Expect<Equals<Ctx["bridge"], PlainBridge | null>>;

/**
 * WR-02, the consent-path half. A **positive, not a predicate**, and it has to be: the
 * three assertions above read `Ctx` and read `x?: T` and `x?: T | undefined` identically
 * under `exactOptionalPropertyTypes`, so `_handlerAck` stays green when `ack` loses its
 * `| undefined`. Only building the object moves.
 *
 * This is the dispatcher's own construction. One context shape serves gated and non-gated
 * actions alike — `ack` is simply absent for the latter — so the dispatcher holds a
 * `ConsentAck<…> | undefined` and spreads it in. Against a bare `ack?: ConsentAck<…>`
 * that is TS2375, leaving two ways out: build two divergent context shapes, or cast. A
 * cast here is a cast into the consent path, at the one boundary where the library's
 * whole claim is that nothing may be asserted past the compiler.
 */
declare const maybeAck: ConsentAck<Booking, AckShape> | undefined;
declare const plainBridge: PlainBridge;
declare const meta: InvocationMeta;
const _ctxWithMaybeAck: Ctx = { args: { q: "x" }, bridge: plainBridge, meta, ack: maybeAck };
void _ctxWithMaybeAck;

// --------------------------------------------------------------------------
// SC-7g — `readsUntrusted` is on the declaration, not inside `SideEffects`
// --------------------------------------------------------------------------

/** The field exists on the declaration itself, optional and boolean. */
type _readsUntrustedOnDefinition = Expect<Equals<ActionDefinition["readsUntrusted"], boolean | undefined>>;

/**
 * The companion negative: the field must be **absent** from `SideEffects`, which is the
 * MCP tool-hint mirror and whose entire value is 1:1 fidelity (D-04).
 *
 * TS2339 under the correct placement. Move the field into `SideEffects` and this
 * resolves, leaving an unused directive as the symptom — mutant M7.
 */
// @ts-expect-error - readsUntrusted must NOT be a SideEffects member (D-04, SC-7g)
type _notInSideEffects = NonNullable<ActionDefinition["effects"]>["readsUntrusted"];

// --------------------------------------------------------------------------
// SEC-01 — `redact` is required, and the declaration is where that is decided
// --------------------------------------------------------------------------

/** SEC-01's declaration-time half: redaction defaults to nothing because it cannot be omitted at all. `{} extends Pick<…>` is `true` exactly when the member is optional, so this goes red the moment a `?` appears on `redact` — the one edit that would turn a fail-closed policy into an opt-in one. `buildCatalog` owns the runtime half. */
type _redactIsRequired = Expect<Equals<{} extends Pick<ActionDefinition, "redact"> ? true : false, false>>;

// --------------------------------------------------------------------------
// The erasure positives — heterogeneous actions must still assemble
// --------------------------------------------------------------------------

const shipmentEq = (a: Shipment, b: Shipment): boolean => a.weight === b.weight;

/** A second action whose `Snapshot` is `Shipment`, sharing nothing with `confirm`'s. */
const cancelShipment = defineAction({
  name: "cancelShipment",
  description: "Cancel the shipment before it leaves the warehouse.",
  schema,
  redact: "drop",
  handler: () => ({ ok: true, message: "Cancelled." }),
  consent: { requires: "reviewShipment", bindTo: "userTurn", snapshotEquality: shipmentEq },
  readsUntrusted: true,
});

/**
 * The positive half of Pitfall 1, and the reason {@link AnyActionDefinition} exists.
 *
 * `Snapshot` sits in two contravariant positions, so once it is real, a
 * `ConsentPolicy<Booking>` action stops being assignable to the erased-to-`unknown` form
 * this array used to carry (TS2375). These two actions have deliberately unrelated
 * snapshots, and **no `as` cast appears anywhere below** — if one were needed, the
 * erasure would have failed and the whole collection story with it.
 */
const _stage: StageDefinition = {
  id: "checkout",
  match: () => true,
  actions: [confirm, cancelShipment],
};

/** A third action, for the other erased collection site. */
const signOut = defineAction({
  name: "signOut",
  description: "Sign the user out.",
  schema,
  redact: "drop",
  handler: () => ({ ok: true, message: "Signed out." }),
  terminal: true,
});

/** `crossStage` is erased the same way, and must accept an action alongside the stages. */
const _config: ConciergeConfig = {
  stages: [_stage],
  crossStage: [signOut],
};

// --------------------------------------------------------------------------
// CR-02 — a bridge with real members, which nothing in this suite ever had
// --------------------------------------------------------------------------
//
// What the block below proves, and why its absence hid a critical defect for a whole
// phase: **nothing in this suite had ever instantiated `Bridge` with a member.** Every
// use went through the bare spelling, so both of its type parameters were exercised only
// at their defaults — and the defaults were the broken values. `Bridge` defaulted each
// parameter to the *bottom* of its own constraint (a record whose value type is `never`,
// which requires every property it has to be `never`) rather than the top, and that
// default is exactly what `BridgeRegistry<B extends Bridge = Bridge>` and
// `StageDefinition<B extends Bridge = Bridge>` constrain against. The consequence was
// that **no bridge carrying an actual action or snapshot satisfied its own constraint**:
// `BridgeRegistry<ResultsBridge>` was TS2344, and this project's own headline example —
// an app exposing `applyFilter({key, value})` — did not compile. A 19-mutation battery
// and nine plans went past it, because a parameter never instantiated is a parameter
// never tested.
//
// The two bridges are deliberately unrelated, for the same reason `Booking` and
// `Shipment` are unrelated in the erasure positives above: two bridges sharing one shape
// would assemble even under the broken form and prove nothing.
//
// This is also where the project's headline claim stops being a sentence in a README and
// becomes a compiled assertion.

/** The canonical example, verbatim in shape from the project's own description. */
type ResultsBridge = Bridge<{ applyFilter: (key: string, value: string) => void }, { visibleCount: () => number }>;

/** A second bridge sharing nothing with the first — different verbs, different snapshot. */
type CartBridge = Bridge<{ removeItem: (id: string) => void }, { total: () => number }>;

/** CR-02's direct detector: a bridge with real members satisfies its own constraint. Under the old defaults this is `false`. */
type _realBridgeSatisfiesConstraint = Expect<Assignable<ResultsBridge, Bridge>>;

/** The object-argument spelling of the same verb — `applyFilter({key, value})`, literally as the project describes it — satisfies the constraint too. */
type _canonicalObjectArgBridge = Expect<Assignable<Bridge<{ applyFilter: (filter: { key: string; value: string }) => void }, { visibleCount: () => number }>, Bridge>>;

/**
 * The registry half of WR-03, which had no assertion anywhere in this suite.
 *
 * `read` returns `ResultsBridge | null`, and the `| null` is the entire representation of
 * "no component has registered" — the state `FailureReason`'s `no_bridge` code exists to
 * report, and the reason `ActionHandler`'s own doc comment instructs handlers to always
 * check. Measured before this line existed: `read: () => B | null` → `() => B` escaped the
 * full four-file suite at exit 0.
 */
type _registryReadIsNullable = Expect<Equals<BridgeRegistry<ResultsBridge>["read"], () => ResultsBridge | null>>;

declare const resultsRegistry: BridgeRegistry<ResultsBridge>;
declare const cartRegistry: BridgeRegistry<CartBridge>;

/** A stage at a concrete bridge type, carrying its own registry. TS2344 under the old defaults. */
const _resultsStage: StageDefinition<ResultsBridge> = { id: "results", match: () => true, actions: [], bridge: resultsRegistry };

/** The second one, at an unrelated concrete bridge type. */
const _cartStage: StageDefinition<CartBridge> = { id: "cart", match: () => true, actions: [], bridge: cartRegistry };

/**
 * The second, independent half of CR-02: two unrelated concrete-bridge stages collecting
 * into one config, **with no cast anywhere.**
 *
 * Fixing the defaults alone does not get here. `B` reaches contravariant positions through
 * `AnyActionDefinition<B>`'s handler, so a `StageDefinition<ResultsBridge>` is not
 * assignable to a `StageDefinition<Bridge>` however wide `Bridge` is made — widening a
 * parameter never repairs a contravariant position. `ConciergeConfig.stages` therefore
 * erases `B` with `any`, the same erasure `AnyActionDefinition` already applies to
 * `Snapshot` and `AckPayload`, and this literal is what proves it works rather than merely
 * compiling in isolation.
 *
 * If a cast were ever needed here the erasure would have failed and the whole collection
 * story with it — and worse, a constraint nothing satisfies does not stop a developer, it
 * teaches them to write `as` in the stage path the consent kernel later reads.
 */
const _multiBridgeConfig: ConciergeConfig = { stages: [_resultsStage, _cartStage] };

// --------------------------------------------------------------------------
// D-03 config half / D-08 — the three injected `ConciergeConfig` seams
// --------------------------------------------------------------------------

// `Equals`, not `Assignable`, and the choice is the whole value of these three lines.
// `Assignable<ReadbackSink, ConciergeConfig["presentReadback"]>` stays true when the field
// is widened to `unknown`, to a bare function type, or to a union that swallows the
// declared type — which is exactly the silent-widening regression worth guarding, since a
// widened seam accepts an unrelated function and nothing else in the repository notices.
// Each is pinned against the declared type unioned with `undefined`, because that is what
// an indexed access on an optional member yields; asserting the bare type instead would
// fail today and, worse, would keep passing if a seam were later made *required*.

/** The sink's arrival point. `consent.test-d.ts` guards the seam's own shape; this guards the field. */
type _configPresentReadback = Expect<Equals<ConciergeConfig["presentReadback"], ReadbackSink | undefined>>;

/** The digest is injected because core owns no crypto — there is no `crypto` under `lib: ["ES2022"]`. */
type _configDigest = Expect<Equals<ConciergeConfig["digest"], DigestLike | undefined>>;

/** The clock is injected for the same structural reason: no `setTimeout` under `lib: ["ES2022"]` either. */
type _configScheduler = Expect<Equals<ConciergeConfig["scheduler"], Scheduler | undefined>>;

declare const receipt: ReadbackReceipt;
declare const subtleish: DigestLike;

/**
 * All three seams populated at once, alongside `stages`.
 *
 * This proves two things the predicates above cannot. First, the group is
 * *constructible together* — three optional members can each pin correctly in isolation
 * and still conflict at a single object literal.
 *
 * Second, and the reason `presentReadback` is written with no parameter annotation: this
 * is the ergonomic path an app actually writes, and contextual typing of a generic-function
 * seam at a **field** position is a genuinely different question from contextual typing at
 * a `const` annotation, which is what `consent.test-d.ts` covers. A defaulted-alias
 * regression instantiates the payload parameter to `unknown` once at exactly this kind of
 * position. If this literal stopped compiling the seam would be unusable in practice
 * regardless of what the predicates say about its shape — so do not "simplify" it by
 * annotating `rb`, which would supply the answer contextual typing is here to derive.
 */
const _configWithSeams: ConciergeConfig = {
  stages: [_stage],
  presentReadback: async (rb) => {
    void rb.payload;
    return receipt;
  },
  digest: subtleish,
  scheduler: (fn, delayMs) => {
    void fn;
    void delayMs;
    return () => {};
  },
};

// --------------------------------------------------------------------------
// D-08 — the session exposes its current stage and a change subscription
// --------------------------------------------------------------------------

/** A getter, never a value. A stage read once and stored is stale for the rest of the session. */
type _sessionStage = Expect<Equals<Session["stage"], () => string | null>>;

/** Subscribe-returns-unsubscriber, the shape `Transport.onToolBatch` established. */
type _sessionOnStageChange = Expect<Equals<Session["onStageChange"], (cb: (stage: string | null) => void) => () => void>>;

/**
 * All four members implemented at once, proving the interface is satisfiable rather than
 * merely describable — an interface can hold two individually-valid members that no single
 * object can implement together.
 *
 * `stage` returns a literal here on purpose: `() => "checkout"` is accepted by
 * `() => string | null` through return-type covariance, so this fixture would still compile
 * if `stage` were narrowed, and it is the predicate above — not this literal — that pins the
 * `| null`. The two are doing different jobs and neither substitutes for the other.
 */
const _session: Session = {
  setContext: () => {},
  stage: () => "checkout",
  onStageChange: (cb) => {
    void cb;
    return () => {};
  },
  stop: () => {},
};
