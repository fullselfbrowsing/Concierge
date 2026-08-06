// SC-2 — `ActionResult.reason` is a closed twelve-code union — and SC-7d —
// `MESSAGE_MAX_CHARS` keeps its literal type.
//
// This file declares nothing to the outside world. The imports below already
// give it module status, which is what keeps `isolatedDeclarations` from
// treating every top-level `const` here as declaration-emitting (TS9010).
//
// Assertions are predicates, not directives. An error-suppression directive
// asserts only that *some* error occurred on the following line, so one written
// to prove a bad reason is rejected passes green when that line instead holds a
// typo. Exactly one such directive appears below — the sole occurrence of that
// token anywhere in this file — and it guards the one thing a predicate
// provably cannot model: object-literal freshness.
//
// Every alias is named after the invariant it guards. `tsc` prints only
// `Type 'false' does not satisfy the constraint 'true'`; the entire signal is
// the echoed source line, so the alias name is the diagnostic.

import type { Assignable, Equals, Expect, Not } from "./_assert.js";
import type { ActionResult } from "../src/types.js";
import { MESSAGE_MAX_CHARS, USER_CANCELLED, USER_DECLINED } from "../src/types.js";

// --------------------------------------------------------------------------
// SC-2 — the union is closed, and both halves of it reach the field
// --------------------------------------------------------------------------

// Each predicate below is deliberately ONE line, however long. `tsc` echoes only
// the line the failing type argument sits on, so wrapping `Expect<` onto its own
// line puts the alias name on a line the diagnostic never prints — leaving
// `Type 'false' does not satisfy the constraint 'true'` above an anonymous
// `Not<Assignable<…>>` body. Measured, not assumed: see this plan's SUMMARY.
// Do not let a formatter wrap these.

/** An arbitrary failure string is not a reason code. This is the whole of SC-2. */
type _reasonClosed = Expect<Not<Assignable<{ ok: false; reason: "whoops"; message: "x" }, ActionResult>>>;

/** The human-caused half (`AbandonReason`) still reaches the field after D-01 reused it as a subset. */
type _reasonAdmitsAbandon = Expect<Assignable<{ ok: false; reason: "declined"; message: "x" }, ActionResult>>;

/** The machine-caused half reaches it too — `invalid_result` is the code added 2026-07-27. */
type _reasonAdmitsInvalidResult = Expect<Assignable<{ ok: false; reason: "invalid_result"; message: "x" }, ActionResult>>;

/**
 * An explicit `reason: undefined` is accepted. This is precisely what D-01's
 * `| undefined` exists to permit: under `exactOptionalPropertyTypes` a bare
 * `reason?: ReasonCode` rejects it (TS2375).
 */
type _reasonAdmitsUndefined = Expect<Assignable<{ ok: true; reason: undefined; message: "x" }, ActionResult>>;

// Object-literal freshness — the one case predicates cannot model, because
// `Assignable<{...; reason: "whoops"}, ActionResult>` is judged on assignability
// and a fresh literal is judged more strictly. Kept to a single line so the
// directive and the reported error land on the same line: an excess or mistyped
// property is reported on the property line, not the declaration line.
// @ts-expect-error - an arbitrary reason string must not typecheck
const _badReason: ActionResult = { ok: false, reason: "whoops", message: "x" };

// --------------------------------------------------------------------------
// SC-2 — exhaustiveness: a thirteenth code must break every mapper, loudly
// --------------------------------------------------------------------------

// Twelve arms, one per code: three from `AbandonReason`, nine from
// `FailureReason`. The `never` default is the point of the whole exercise — a
// code added in Phase 6 or 8 fails to compile here rather than falling into a
// silent default that reports a new failure mode as an old one. Removing a code
// breaks it from the other side (TS2678, an arm not comparable to the union).
declare const r: ActionResult;

function _reasonExhaustive(): string {
  switch (r.reason) {
    case "declined":
    case "cancelled":
    case "superseded":
    case "invalid_args":
    case "invalid_result":
    case "unknown_action":
    case "no_bridge":
    case "handler_error":
    case "aborted":
    case "consent_required":
    case "consent_stale":
    case "grade_unavailable":
      return r.reason;
    case undefined:
      return "";
    default: {
      const _never: never = r.reason;
      return _never;
    }
  }
}

// The computed-reason idiom D-01's `| undefined` exists to permit. Without the
// explicit `| undefined` on the field this is TS2375, and every real mapper in
// Phases 6 and 8 is written this way.
declare function computeReason(): ActionResult["reason"];
const _computedReasonAssigns: ActionResult = {
  ok: false,
  reason: computeReason(),
  message: "x",
};

// --------------------------------------------------------------------------
// SC-7d — D-02's bound is a literal, not `number`
// --------------------------------------------------------------------------

/** Guards against a silent widening to `number` (an added `: number`) or a changed bound. */
type _messageBound = Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>;

// --------------------------------------------------------------------------
// IN-03 — the two frozen constants keep their literal types too
// --------------------------------------------------------------------------

// These four detect two distinct regressions, and nothing else in the suite sees
// either one.
//
// The annotation widening back to `Readonly<ActionResult>` — which is what both
// constants carried until 2026-07-28 — compiles, freezes the same value, emits a
// valid `.d.ts`, and leaves every other assertion in this file green. Its only
// symptom is that `ok` becomes `boolean` and `reason` becomes
// `ReasonCode | undefined`, so a consumer can no longer narrow on either.
//
// The constants' *values* changing is the second, and it is the one a consumer
// would never see coming: `declined` and `cancelled` are shape-identical, and the
// distinction between them is exactly what `AbandonReason` exists to carry — an
// explicit refusal is a decision, a dismissal is not.
//
// One line each, for the reason stated at the top of this file: `tsc` echoes only
// the line the failing type argument sits on, so the alias name has to be on it.

/** `USER_CANCELLED.ok` is `false`, not `boolean`. Red if the annotation widens. */
type _cancelledOkIsLiteral = Expect<Equals<(typeof USER_CANCELLED)["ok"], false>>;

/** `USER_CANCELLED.reason` is `"cancelled"`. Red if the annotation widens or the value changes. */
type _cancelledReasonIsLiteral = Expect<Equals<(typeof USER_CANCELLED)["reason"], "cancelled">>;

/** `USER_DECLINED.ok` is `false`, not `boolean`. Red if the annotation widens. */
type _declinedOkIsLiteral = Expect<Equals<(typeof USER_DECLINED)["ok"], false>>;

/** `USER_DECLINED.reason` is `"declined"`. Red if the annotation widens or the value changes. */
type _declinedReasonIsLiteral = Expect<Equals<(typeof USER_DECLINED)["reason"], "declined">>;

// A narrower annotation must not overshoot: both constants are still what an
// action returns, so both must still satisfy `ActionResult` itself. Without these
// two, narrowing `reason` to a literal that is not a `ReasonCode` member — or
// dropping `message` — would pass the four pins above and break every consumer.
type _cancelledIsActionResult = Expect<Assignable<typeof USER_CANCELLED, ActionResult>>;
type _declinedIsActionResult = Expect<Assignable<typeof USER_DECLINED, ActionResult>>;

// --------------------------------------------------------------------------
// WR-07 — the two members that are required, and had no assertion anywhere
// --------------------------------------------------------------------------

// Everything above this line is about `reason` — a member that is *deliberately*
// optional — and about the two frozen constants. Neither of the two members an
// action can never omit was pinned at all, in this file or any other: making `ok`
// optional and making `message` optional were both measured to exit **0** against
// the full four-file suite.
//
// Written for the **flat `ActionResult`** that plan 01-13 recorded and kept
// (WR-06, option-b). Under a discriminated union an indexed access still resolves
// — `ActionResult["ok"]` would be `boolean`, the union of the branches — so these
// two lines would survive that change silently. Say so here rather than let the
// next reader infer a guarantee they do not have: if the shape ever moves, re-read
// the declaration and re-derive these, do not assume they still mean what they
// mean today.
//
// The mechanism is the indexed access, not the annotation. An optional member's
// indexed access carries `| undefined` regardless of `exactOptionalPropertyTypes`,
// which is what makes a one-line predicate able to see optionality at all.

/** The flag every dispatcher branches on. Optional, `result.ok` is `boolean | undefined` and a handler that returns neither outcome reads as a failure to some callers and a success to others. */
type _resultOkRequired = Expect<Equals<ActionResult["ok"], boolean>>;

/** The field `MESSAGE_MAX_CHARS` and the whole `ConsentGrade` ladder are written about. Optional, the one sentence a human might actually be shown becomes something a handler may simply not supply. */
type _resultMessageRequired = Expect<Equals<ActionResult["message"], string>>;

/** Dispatcher results are immutable through every public field. */
type _resultOkIsReadonly = Expect<Equals<Pick<ActionResult, "ok">, { readonly ok: boolean }>>;
type _resultReasonIsReadonly = Expect<Equals<Pick<ActionResult, "reason">, { readonly reason?: ActionResult["reason"] }>>;
type _resultMessageIsReadonly = Expect<Equals<Pick<ActionResult, "message">, { readonly message: string }>>;
