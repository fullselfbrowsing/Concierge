// CAT-07 — a description must be a static string literal written at the declaration,
// and DX-03 — the refusal must name the offending action and state the fix.
//
// WHAT ESCAPES WITHOUT THIS FILE
//
// The naive guard, `string extends D ? Error : D`, passes every test a first-draft
// suite would write. Its only negative case would be `i18n(k)` — and the broken form
// rejects that one too, so the suite is green, the guard looks proven, and
// `` `Tenant ${tenant} filter.` `` compiles. That expression is the whole attack:
// a template literal *expression* interpolating a `string`-typed value, contextually
// typed by a parameter constrained to `string`, infers the **pattern type**
// `` `Tenant ${string} filter.` `` rather than `string`, so `string extends <pattern>`
// is false and the condition never fires. Per-tenant prose then reaches the agent's
// tool list on a catalog that is otherwise entirely code-reviewed. Everything below
// the two family-1 lines about widening exists because of that one case.
//
// TWO FAMILIES, AND WHY THEY ARE SPLIT
//
// Family 1 asserts the guard TYPE is right, reading `LiteralDescription` directly.
// Family 2 asserts `defineAction` actually WIRES it, reading the `description` slot
// back out of the function's own parameter list. The split is not tidiness: measured
// under mutation, replacing `description: LiteralDescription<N, D>` with
// `description: D` in `defineAction`'s parameter turns exactly the family-2 rejection
// predicates red and leaves every family-1 line green. A single-family suite would
// certify a guard that had been unplugged from the only function that applies it.
//
// THE TERSE-OUTPUT ASYMMETRY, AND WHAT IT MEANS FOR ASSERTING ON THIS FILE
//
// Measured, non-TTY, which is what CI sees. A failing `Expect<…>` prints
// `Type 'false' does not satisfy the constraint 'true'.` and NO alias name — the
// echoed source line and caret are TTY-only, so the name that carries all the meaning
// never appears. A mutant aimed at this file is therefore asserted on exit code
// (`tsc` exits **1**, not 2, under typescript 7.0.2) plus `file:line`, never on a
// symbol. The CAT-07 *message* is the opposite case: the full "Type X is not
// assignable to type Y" text, including a template-literal type printed in full,
// DOES survive terse output. That is why the DX-03 proof greps the message text.
// Grep the sentence; never grep a name.
//
// This file exports nothing — the imports below already give it module status, which
// is what keeps `isolatedDeclarations` from treating an alias as declaration-emitting
// (TS9010). It uses ZERO suppression directives: every rejection here is expressible
// as `Not<Assignable<…>>`, so the escape hatch `_assert.ts` reserves for object-literal
// freshness is not needed and must not be reached for. Every predicate is on ONE line
// however long; `tsc` echoes only the line the failing type argument sits on. Do not
// let a formatter wrap them.
//
// Every accept-case description below is a DISTINCT literal, deliberately. The DX-03
// proof in plan 03-01 Task 3 mutates one of them by exact-literal match, and
// `scripts/mutate-and-prove.sh` replaces exactly one occurrence — a repeated sentence
// would either mutate the wrong site or abort the harness.

import type { Assignable, Equals, Expect, Not } from "./_assert.js";
import type { StandardSchemaV1 } from "../src/types.js";
import { defineAction } from "../src/define-action.js";
import type { LiteralDescription } from "../src/define-action.js";

// --------------------------------------------------------------------------
// Fixtures — every one local, none exported
// --------------------------------------------------------------------------

/** A schema whose output shape is irrelevant here; only `description` is under test. */
declare const probeSchema: StandardSchemaV1<unknown, { key: string; value: string }>;

/** The widened case in value form, because Task 3's DX-03 mutant substitutes this identifier for an accept-case literal and needs something to substitute. */
declare const widenedDescription: string;

/** Attacker-controlled prose: an i18n key's return, a CMS field, a per-tenant string. */
declare const tenant: string;

/** The vector, captured as the type an interpolation actually produces rather than hand-written — a pattern, not `string`, which is the entire reason the naive guard misses it. */
type TenantInterpolated = `Tenant ${typeof tenant} filter.`;

/**
 * The CAT-07 sentence, spelled out rather than derived from `LiteralDescription`.
 *
 * Deriving it — `type Cat07Message<N> = LiteralDescription<N, string>` — would put both
 * sides of every family-1 equality through the same declaration, after which any change
 * inside the guard changes both sides identically and the lines stay true forever. That
 * is the failure `_onMissingShape` in `actions.test-d.ts` documents at length. Spelling
 * it out makes these lines a pin on the message text, which is what DX-03 actually
 * requires; if the wording in `src/define-action.ts` changes, these go red on purpose
 * and are re-derived from the new sentence rather than relaxed.
 */
type Cat07Message<N extends string> = `concierge CAT-07 — action "${N}": description must be a static string literal written at this declaration. Fix: replace the expression with the finished sentence in quotes. A description assembled from i18n, CMS, per-tenant text, or any runtime value is a tool-poisoning vector and is rejected here.`;

/** The `description` slot read back out of `defineAction`'s own parameter — family 2's entire subject. An instantiation expression pins it without needing a call. */
type DescriptionSlot<N extends string, D extends string> = Parameters<typeof defineAction<N, D, typeof probeSchema>>[0]["description"];

// --------------------------------------------------------------------------
// Family 1 — the guard TYPE is correct, read from `LiteralDescription` directly
// --------------------------------------------------------------------------

/** The obvious case, and the only one the naive `string extends D` form also catches: `i18n(k)`, a `let`, `as string`, or string concatenation all arrive here as the widened type. */
type _cat07WidenedStringBecomesTheMessage = Expect<Equals<LiteralDescription<"applyFilter", string>, Cat07Message<"applyFilter">>>;

/** The case the naive form MISSES, and the reason this file exists. An interior hole infers a pattern, not `string`, and only the self-concatenation probe sees it. */
type _cat07InteriorHoleBecomesTheMessage = Expect<Equals<LiteralDescription<"applyFilter", TenantInterpolated>, Cat07Message<"applyFilter">>>;

/** A hole at the very start — `` `${tenant} filter.` ``. Caught by the leading-`~` probe and by nothing else in the chain. */
type _cat07LeadingHoleBecomesTheMessage = Expect<Equals<LiteralDescription<"applyFilter", `${string} filter.`>, Cat07Message<"applyFilter">>>;

/** A hole at the very end — `` `Filter for ${tenant}` ``. Caught by the trailing-`~` probe and by nothing else in the chain. */
type _cat07TrailingHoleBecomesTheMessage = Expect<Equals<LiteralDescription<"applyFilter", `Filter for ${string}`>, Cat07Message<"applyFilter">>>;

/** Two holes at once — `` `${a} and ${b}` ``. Nothing here should depend on a hole being alone. */
type _cat07MultiHoleBecomesTheMessage = Expect<Equals<LiteralDescription<"applyFilter", `${string} and ${string}`>, Cat07Message<"applyFilter">>>;

/** The accept half, at type level: a concrete literal comes back out untouched, so the guard is a narrowing and not a rewrite. */
type _cat07ConcreteLiteralPassesThrough = Expect<Equals<LiteralDescription<"applyFilter", "Real reviewed text.">, "Real reviewed text.">>;

/** A ternary over two literals infers a finite union, which is still fully reviewable and must survive. Only the distributed form in `IsNotConcrete` gets this right. */
type _cat07UnionOfConcreteLiteralsPassesThrough = Expect<Equals<LiteralDescription<"applyFilter", "Branch A." | "Branch B.">, "Branch A." | "Branch B.">>;

/** The union case that must NOT survive: one pattern hiding among concrete members. Measured — the undistributed guard accepts this, which is why `IsNotConcrete` distributes and tests against `false` rather than `true`. */
type _cat07UnionContainingAPatternBecomesTheMessage = Expect<Equals<LiteralDescription<"applyFilter", `A${string}` | "plain">, Cat07Message<"applyFilter">>>;

/** DX-03, the type half: the message NAMES the offending action. A named-alias rejection branch prints as `ErrObj` and would satisfy every line above while failing this one. */
type _cat07MessageNamesTheOffendingAction = Expect<Assignable<LiteralDescription<"cancelBooking", string>, `${string}"cancelBooking"${string}`>>;

// --------------------------------------------------------------------------
// Family 2 — `defineAction` actually WIRES the guard into its parameter
// --------------------------------------------------------------------------

/** Deleting the guard from the parameter leaves every family-1 line green and turns this one red. That mutant (M-03-1) is the reason the two families are separate. */
type _cat07WiredRejectsWidenedString = Expect<Not<Assignable<typeof widenedDescription, DescriptionSlot<"applyFilter", typeof widenedDescription>>>>;

/** The slot must still admit an ordinary description; a guard that rejects everything is not a guard, it is an outage. */
type _cat07WiredAcceptsAConcreteLiteral = Expect<Assignable<"Real reviewed text.", DescriptionSlot<"applyFilter", "Real reviewed text.">>>;

/** The vector, at the slot rather than at the type: `` `Tenant ${tenant} filter.` `` must not be assignable to what `defineAction` asks for. */
type _cat07WiredRejectsAnInterpolatedTemplate = Expect<Not<Assignable<TenantInterpolated, DescriptionSlot<"applyFilter", TenantInterpolated>>>>;

// --------------------------------------------------------------------------
// Reject cases — the measured matrix, one predicate per hole position
// --------------------------------------------------------------------------

/** `i18n("k")`, `cms.copy`, a `let`, `const annotated: string`, `"…" as string`, `"a" + "b"`, `String(…)` — every one of them arrives as this. */
type _rejectWidenedString = Expect<Not<Assignable<string, DescriptionSlot<"applyFilter", string>>>>;

/** Leading hole. */
type _rejectLeadingHole = Expect<Not<Assignable<`${string} filter.`, DescriptionSlot<"applyFilter", `${string} filter.`>>>>;

/** Trailing hole. */
type _rejectTrailingHole = Expect<Not<Assignable<`Filter for ${string}`, DescriptionSlot<"applyFilter", `Filter for ${string}`>>>>;

/** Interior hole — the one the naive guard admits, stated one more time at the slot because this is the case that decides whether CAT-07 works at all. */
type _rejectInteriorHole = Expect<Not<Assignable<`Tenant ${string} filter.`, DescriptionSlot<"applyFilter", `Tenant ${string} filter.`>>>>;

/** Two holes. */
type _rejectMultiHole = Expect<Not<Assignable<`${string} and ${string}`, DescriptionSlot<"applyFilter", `${string} and ${string}`>>>>;

/** The empty description, which is invalid on its own terms and is caught here as a side effect of the self-concatenation probe — `""` doubled is still `""`. Deleting that probe silently un-rejects this too. */
type _rejectEmptyDescription = Expect<Not<Assignable<"", DescriptionSlot<"applyFilter", "">>>>;

// --------------------------------------------------------------------------
// Accept cases — every one a real call that must compile, not a predicate
// --------------------------------------------------------------------------

const CONST_BOUND_DESCRIPTION = "Remove every applied filter and show all results.";
const FACET = "facet";
const COPY = { detail: "Open the detail panel for one result." } as const;
declare const preferPrice: boolean;

/** An inline literal — the path essentially every declaration takes, and the one that must cost no ceremony at all. */
const _acceptInlineLiteral = defineAction({ name: "applyFilter", description: "Narrow the visible results to one facet value.", schema: probeSchema, redact: "drop", handler: () => ({ ok: true, message: "Filtered." }) });

/** A `const`-bound literal: still one concrete literal, still statically reviewable at the declaration. */
const _acceptConstBoundLiteral = defineAction({ name: "clearFilters", description: CONST_BOUND_DESCRIPTION, schema: probeSchema, redact: "drop", handler: () => ({ ok: true, message: "Cleared." }) });

/** `as const` on the literal — redundant here, but developers write it and it must not be punished. */
const _acceptAsConstLiteral = defineAction({ name: "sortResults", description: "Reorder the result list without changing what it contains." as const, schema: probeSchema, redact: "drop", handler: () => ({ ok: true, message: "Sorted." }) });

/** A backtick with no interpolation. Same type as a quoted literal; a guard that keyed on the *syntax* rather than the inferred type would fail here. */
const _acceptBacktickNoInterpolation = defineAction({ name: "refreshResults", description: `Re-run the current query and replace the result list.`, schema: probeSchema, redact: "drop", handler: () => ({ ok: true, message: "Refreshed." }) });

/** A template interpolating a `const`-bound LITERAL. This is the near-miss: it is a template literal expression, exactly like the attack, and it infers one concrete literal because what it interpolates is not widened. Rejecting it would make the guard useless in practice. */
const _acceptTemplateOverConstLiteral = defineAction({ name: "describeFacet", description: `Explain what the ${FACET} filter does.`, schema: probeSchema, redact: "drop", handler: () => ({ ok: true, message: "Explained." }) });

/** A property of an `as const` object. Without `as const` the property widens to `string` and this becomes a reject case — which is correct, and worth knowing. */
const _acceptAsConstObjectProperty = defineAction({ name: "openDetail", description: COPY.detail, schema: probeSchema, redact: "drop", handler: () => ({ ok: true, message: "Opened." }) });

/** A ternary over two literals: a finite, reviewable union. `IsNotConcrete` distributes precisely so that this compiles while a union containing a pattern does not. */
const _acceptTernaryOverTwoLiterals = defineAction({ name: "chooseSort", description: preferPrice ? "Sort the results by price." : "Sort the results by relevance.", schema: probeSchema, redact: "drop", handler: () => ({ ok: true, message: "Chose." }) });

/** A `~` in the prose. The probes prefix and suffix that exact character, so this is the false positive the chain would produce if the branches were written the obvious way; measured clean. */
const _acceptTildeSentinelInProse = defineAction({ name: "estimateCount", description: "Report the approximate result count, written as ~10.", schema: probeSchema, redact: "drop", handler: () => ({ ok: true, message: "Estimated." }) });

/** A digit in the prose, for the same reason: two probes suffix and prefix `0`. Also measured clean. */
const _acceptDigitInProse = defineAction({ name: "limitResults", description: "Cap the result list at 20 entries.", schema: probeSchema, redact: "drop", handler: () => ({ ok: true, message: "Limited." }) });

// --------------------------------------------------------------------------
// The known gap — pinned so that closing it is a visible event, not a surprise
// --------------------------------------------------------------------------

// `` `Show ${count} results.` `` with `count: number` infers `` `Show ${number} results.` ``,
// and all six probes classify that as concrete. It is ACCEPTED, with the reasoning and the
// residual risk recorded in `src/define-action.ts`'s doc comment on `defineAction`: a numeric
// hole can carry digits, `-`, `.`, `e`, `+`, `Infinity` and `NaN` and nothing else, so it
// cannot carry prose, and CAT-07's threat is prose-borne steering. It is not zero risk — an
// attacker holding the number can still shift a stated limit.
//
// The predicate below asserts the pattern currently passes through UNCHANGED. If it ever goes
// red, the gap has closed: delete this pin and the acceptance paragraph in `define-action.ts`.
// It is not a break, and it must not be "fixed" by relaxing the assertion.

/** ACCEPTED GAP, pinned: a `${number}` hole passes through. Red here means a future compiler closed the hole and the doc comment in `src/define-action.ts` is now stale. */
type _knownGapNumericHolePassesThrough = Expect<Equals<LiteralDescription<"applyFilter", `Show ${number} results.`>, `Show ${number} results.`>>;

/** The same gap in its `${bigint}` form, pinned separately because the two are distinct pattern types and a compiler could plausibly close one without the other. */
type _knownGapBigintHolePassesThrough = Expect<Equals<LiteralDescription<"applyFilter", `Show ${bigint} results.`>, `Show ${bigint} results.`>>;
