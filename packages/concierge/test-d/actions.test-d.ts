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

import type { Equals, Expect } from "./_assert.js";
import type {
  ActionDefinition,
  ConciergeConfig,
  ConsentAck,
  ConsentPolicy,
  StageDefinition,
  StandardSchemaV1,
} from "../src/types.js";

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

/**
 * Stand-in for the real `defineAction`, which **Phase 3 owns**. A `declare function`
 * with no runtime body, never exported, existing for one reason: the assertions below
 * must read an *inferred* `ActionDefinition`. An explicitly annotated one would supply
 * the very answer — `Name`, `Snapshot` — that the test is supposed to derive, and would
 * pass just as happily over a broken declaration chain.
 */
declare function defineAction<
  Name extends string,
  Schema extends StandardSchemaV1,
  Bridge = unknown,
  Snapshot = unknown,
  AckPayload = unknown,
>(
  def: ActionDefinition<Name, Schema, Bridge, Snapshot, AckPayload>,
): ActionDefinition<Name, Schema, Bridge, Snapshot, AckPayload>;

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
 * The negative — and **mutant M9's sole detector**.
 *
 * A `Booking` comparator must not fit a `ConsentPolicy<unknown>`. The directive sits
 * directly above the *property*, not above the declaration, because that is where the
 * error is reported: TS2322 on `snapshotEquality`, not on `_policyDegraded`.
 *
 * Switching `snapshotEquality` to method syntax makes its parameters bivariant, the
 * assignment above starts succeeding, and this directive goes unused — a lone TS2578 is
 * then the *only* symptom that the guard has stopped guarding. Nothing else in this
 * repository notices. That is the shape of "fix" a reviewer applies by deleting a test,
 * which is why {@link ConsentPolicy.snapshotEquality}'s own doc comment points here.
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
// Escapee 3 — the handler forward. The assertion nothing else catches.
// --------------------------------------------------------------------------

/**
 * The handler's context, extracted from a fully explicit declaration so that a dropped
 * forward has nowhere to hide behind inference.
 *
 * Reverting `handler` to `ActionHandler<InferOutput<Schema>, Bridge>` leaves every
 * assertion above green: the consent policy still infers `Booking`, `ctx.ack` still
 * exists, and it still typechecks — as `ConsentAck<unknown, unknown>`. The gate would be
 * reading a snapshot it cannot see the shape of, and only these three lines would say so.
 */
type Ctx = Parameters<ActionDefinition<"x", typeof schema, null, Booking, AckShape>["handler"]>[0];

/** Both type arguments reach the ack, in the right order. M8's detector. */
type _handlerAck = Expect<Equals<Ctx["ack"], ConsentAck<Booking, AckShape> | undefined>>;

/** The schema's output still reaches `args` — the forward did not displace it. */
type _handlerArgs = Expect<Equals<Ctx["args"], { q: string }>>;

/** And `Bridge` still reaches `bridge`, nullable because the component may be unmounted. */
type _handlerBridge = Expect<Equals<Ctx["bridge"], null>>;

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
