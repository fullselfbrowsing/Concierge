// SC-7a, from the other side — the *named* detector for the `snapshotEquality`
// method-syntax regression (battery mutant M9). This is the first of the two
// test-coverage items Phase 1 deferred into Phase 2 (`STATE.md` § Deferred
// Items, deferred at plan 01-09). It landed here rather than there because
// adding it changes the diagnostic set of the type-test program, and Phase 1's
// own gate battery had pinned that set.
//
// WHY THE NEGATIVE IS THE GUARD
//
// There is no positive form of this invariant. `ConsentPolicy<Booking>` fitting
// `ConsentPolicy<Booking>` is true under both syntaxes and proves nothing; what
// distinguishes the correct declaration from the regressed one is the *refusal*.
// Function-property syntax — `snapshotEquality?: (a, b) => boolean` — keeps the
// parameters contravariant under `strictFunctionTypes`, so a comparator over a
// concrete snapshot cannot stand in for a comparator over `unknown`. Method
// syntax — `snapshotEquality?(a, b): boolean` — makes them bivariant and the
// stand-in becomes legal. The assignability that must stay *false* is therefore
// the entire signal, exactly as `_provenanceNotBoolean` in `transport.test-d.ts`
// is written.
//
// This is not a style preference. `ConsentPolicy.snapshotEquality` is how the
// consent kernel decides whether the payload the human confirmed is still the
// payload about to run. A bivariant comparator lets a comparator written for a
// different snapshot type satisfy the field, so the "is this the same payload"
// question gets answered by code that was never about this payload.
//
// WHAT THIS ADDS OVER `actions.test-d.ts`'s `_policyDegraded`
//
// M9 already had a detector, and it is a good one — but its failure mode is the
// problem. `_policyDegraded` proves the regression by asserting that a real
// assignment is rejected, using a suppression directive on the property. Under
// the method-syntax regression that assignment starts *succeeding*, so the
// directive goes unused and the only symptom anywhere in this repository is a
// lone **TS2578** — an unused-suppression error on a line that looks, to a
// reviewer skimming a red build, like a stale test to delete. Deleting it is
// the exact "fix" that removes the last guard on the seam.
//
// The predicate below makes the same regression fail with **TS2344**, `Type
// 'false' does not satisfy the constraint 'true'`, on a line whose echoed source
// text carries the name `_policyNotBivariant`. The diagnostic then names the
// invariant instead of pointing at an unused directive. Measured under mutation,
// not assumed: `02-RESEARCH.md:673-688`, and observed again as mutant P9.
//
// **Both detectors are kept, and neither is redundant.** This one names the
// invariant; `_policyDegraded` proves a real assignment is genuinely rejected,
// which a predicate over two instantiations does not show. Under P9 they fire
// together — TS2344 here, TS2578 there — and seeing both in one run is what the
// deferral was for. Do not consolidate them, and do not delete the directive in
// `actions.test-d.ts`: that file's header states that exactly two suppression
// directives appear in it and no more, and that count is still correct.
//
// This file declares nothing to the outside world. The import below already
// gives it module status, which is what keeps `isolatedDeclarations` from
// treating the alias as declaration-emitting (TS9010). The predicate is on ONE
// line however long — `tsc` echoes only the line the failing type argument sits
// on, so the alias name is the entire carrier of meaning. Do not let a formatter
// wrap it.
//
// `Booking` is re-declared locally rather than imported. `actions.test-d.ts` has
// its own, and a shared fixture would couple two files whose blast radii are
// deliberately separate. Only `id` is needed: the variance is decided by the
// parameter positions, not by the snapshot's members.

import type { Assignable, Expect, Not } from "./_assert.js";
import type { ConsentPolicy } from "../src/types.js";

interface Booking {
  readonly id: string;
}

// --------------------------------------------------------------------------
// SC-7a / M9 — the comparator's parameters stay contravariant
// --------------------------------------------------------------------------

/** Function-property syntax keeps `snapshotEquality`'s parameters contravariant. Method syntax would make them bivariant, and a comparator for the wrong snapshot type would satisfy the field. */
type _policyNotBivariant = Expect<Not<Assignable<ConsentPolicy<Booking>, ConsentPolicy<unknown>>>>;
