/**
 * Concierge action declaration — `defineAction` and the CAT-07 literal-description
 * guard.
 *
 * This is the one requirement in the phase that a runtime check cannot satisfy at
 * all. A description assembled from i18n, a CMS, or a per-tenant store is
 * byte-identical at runtime to a hand-written one, so the compiler is the only
 * place the two are distinguishable and the conditional type below is the entire
 * enforcement. Two constraints on it are load-bearing enough that breaking either
 * leaves a guard which reports success while doing nothing.
 *
 * **1. `D` occupies the `description` position and NOWHERE else.** A type
 * parameter reaching two properties collects a candidate from each and widens to
 * their union. That is not hypothetical here: `types.ts:478-487` records the
 * identical defect being hit in Phase 1 with `Name`, where
 * `{name: "confirmBooking", consent: {requires: "reviewBooking"}}` widened `Name`
 * to the union of both and "silently corrupt[ed] the name-union derivation the
 * whole catalog depends on". Do not reuse `D` for a title, an id, or an argument
 * to the message template. A widened `D` does not fail loudly — it yields a
 * correct-looking rejection that names `string` and no action.
 *
 * **2. The rejection branch is an INLINE template literal type, never a named
 * alias.** `tsc` prints that branch verbatim inside "Type X is not assignable to
 * type Y", and that print is the only route by which the sentence reaches a
 * developer at all. Two alternatives were measured and both fail DX-03 while the
 * guard still rejects: hoisting the branch into `type ErrObj = …` prints `ErrObj`,
 * which names no action and states no fix; a rest-tuple formulation prints only
 * `TS2554: Expected 2 arguments, but got 1`, which is worse again. The sentence
 * has to *be* the type.
 *
 * Like `./types.ts` and `./contract.ts`, this file carries no runtime dependency,
 * no framework reference, and no DOM access — it must construct on a server under
 * Next App Router, Nuxt, or SvelteKit without guards. Its runtime cost is one
 * identity call; every type below is erased.
 */

import type { ActionDefinition, StandardSchemaV1 } from "./types.js";

// ---------------------------------------------------------------------------
// The literal-description guard (CAT-07)
// ---------------------------------------------------------------------------

/**
 * True when `D` is the widened `string` OR a template-literal PATTERN carrying a
 * `${…}` hole, rather than one concrete literal.
 *
 * **Do NOT "simplify" this to the single-branch `string extends D`.** That is the
 * form the literature reaches for and it is open at its centre. Measured under
 * this repo's exact flags: a template literal *expression* interpolating a
 * `string`-typed value, contextually typed by a parameter constrained to
 * `string`, infers the **pattern type** `` `Tenant ${string} filter.` `` — not
 * `string`. `string` is not assignable to that pattern, so the naive condition
 * never fires and `` `Tenant ${tenant} filter.` `` compiles. That expression is
 * precisely the per-tenant content vector CAT-07 exists to block: attacker-authored
 * prose arriving in the agent's tool list, on a catalog that is otherwise
 * code-reviewed. The tell for the broken form is a CAT-07 suite whose only negative
 * case is `i18n(k)` — the naive guard passes that one too, and passes nothing else.
 *
 * SIX branches. Reading the chain below in order:
 *
 *     1. `string` on the left  — fully widened: `i18n(k)`, `let`, `as string`, `"a" + "b"`
 *     2. prefix `~`            — LEADING hole:  `` `${tenant} filter.` ``
 *     3. suffix `~`            — TRAILING hole: `` `Filter for ${tenant}` ``
 *     4. suffix `0`            — trailing numeric-ish edge
 *     5. prefix `0`            — leading numeric-ish edge
 *     6. self-concatenation    — INTERIOR hole: `` `Tenant ${tenant} filter.` ``
 *
 * A concrete literal fails all six, because prefixing, suffixing or doubling a
 * concrete string always yields a longer — therefore unassignable — string.
 *
 * **Branches 2-5 are redundant under the measured matrix, and saying so is safer
 * than the claim this comment first made.** The original wording — "each catches a
 * hole position the others miss" — is false, and it was falsified here rather than
 * inherited: branch 6 subsumes all four, because doubling a pattern whose hole sits
 * at either end also lands inside that pattern. Mutation-measured against
 * `test-d/description-literal.test-d.ts`, one branch disabled at a time:
 *
 *     branch 1  disabled -> suite goes red   (detected)
 *     branch 2  disabled -> suite stays green (ESCAPES)
 *     branch 3  disabled -> suite stays green (ESCAPES)
 *     branch 4  disabled -> suite stays green (ESCAPES)
 *     branch 5  disabled -> suite stays green (ESCAPES)
 *     branch 6  disabled -> suite goes red   (detected)
 *
 * **Do not read those four escapes as permission to delete them.** An escaping
 * mutant here means the suite has no case that *discriminates* the branch, and in
 * the `${string}` universe no such case exists — anything branch 2 catches, branch 6
 * catches as well. The shapes that would discriminate them are `${number}` and
 * `${bigint}`, and those are the accepted gap documented on {@link defineAction},
 * which no branch closes. So the four are kept as O(1) defence against pattern
 * shapes outside the measured matrix, at zero runtime cost and one conditional at
 * compile time. Deleting a branch because a mutant escaped it is the exact move
 * that reopens this guard, and the numeric edges are the cheapest-looking lines in
 * the file to lose.
 *
 * Verified NOT to be false positives: a description containing the `~` sentinel
 * ("Approximately ~10 results.") and a description containing a digit.
 *
 * O(1), and deliberately so. The rejected alternative is a recursive per-character
 * walk. It catches the identical set and nothing more, and it additionally hits
 * `TS2589: Type instantiation is excessively deep` between an 800- and a
 * 1000-character description (measured: 800 fine, 1000 fails). TS2589 names no
 * action, so the recursive form buys nothing and pays for it with a DX-03 violation
 * on long descriptions.
 */
export type HoleProbe<D extends string> =
  string extends D ? true // 1. fully widened
  : `~${D}` extends D ? true // 2. leading hole
  : `${D}~` extends D ? true // 3. trailing hole
  : `${D}0` extends D ? true // 4. trailing numeric-ish edge
  : `0${D}` extends D ? true // 5. leading numeric-ish edge
  : `${D}${D}` extends D ? true // 6. interior hole
  : false;

/**
 * {@link HoleProbe}, distributed over a union.
 *
 * A description written as a ternary over two literals — `flag ? "A." : "B."` —
 * infers the union `"A." | "B."`, which is finite and reviewable and must be
 * accepted. A union containing a *pattern* — `` `A${string}` | "plain" `` — must
 * not be, and only the distributed form tells the two apart. Measured: the
 * undistributed `HoleProbe<D> extends false ? false : true` accepts the second,
 * because a probe applied to the whole union answers for the union rather than for
 * each member.
 *
 * The naked `D extends string ?` is the distribution trigger and is not redundant
 * with the constraint on the parameter, which is why it survives a reading that
 * calls it a tautology. Removing it — or tupling the operand as
 * `[D] extends [string]` — turns distribution off and reopens the union hole.
 *
 * `extends false ? false : true` rather than the more obvious
 * `extends true ? true : false`: distribution yields `boolean` when the members
 * disagree, and `boolean extends true` is `false`, which would *accept* a mixed
 * union. Testing against `false` fails closed instead.
 */
export type IsNotConcrete<D extends string> =
  (D extends string ? HoleProbe<D> : never) extends false ? false : true;

/**
 * The `description` slot's type: `D` unchanged, or the CAT-07 error sentence —
 * which `tsc` then prints verbatim as the type it expected.
 *
 * The rejection branch is written inline, at full length, on purpose. See
 * constraint 2 in this file's header: the printed type *is* the error message, so
 * a named alias here would name no action and DX-03 would fail while every
 * accept/reject assertion stayed green. The wording is fixed by measurement rather
 * than taste — `test-d/description-literal.test-d.ts` asserts that the message
 * carries the action's name, and `03-01-SUMMARY.md` records the message text being
 * grepped out of real terse non-TTY `tsc` output. Terse output carries the full
 * "not assignable" text including a template-literal type; it does **not** carry
 * the echoed source line, the caret, the related-information line, or any alias
 * name. Assert on this text, never on a symbol.
 *
 * **The false branch must stay a naked `D`.** That is the inference site
 * TypeScript reads to bind `D` at all. Wrapping it — `D & string`,
 * `Extract<D, string>` — makes the position non-inferable, `D` falls back to its
 * constraint `string`, and *every* declaration then fails with a message naming
 * `string` instead of the action. The guard would look stricter and be useless.
 */
export type LiteralDescription<N extends string, D extends string> =
  IsNotConcrete<D> extends true
    ? `concierge CAT-07 — action "${N}": description must be a static string literal written at this declaration. Fix: replace the expression with the finished sentence in quotes. A description assembled from i18n, CMS, per-tenant text, or any runtime value is a tool-poisoning vector and is rejected here.`
    : D;

// ---------------------------------------------------------------------------
// The declaration entry point
// ---------------------------------------------------------------------------

/**
 * Declare an action. Identity at runtime; the whole of its value is the types.
 *
 * `description` is the only slot that differs from {@link ActionDefinition}: it is
 * narrowed to {@link LiteralDescription}, so a description that is not a static
 * string literal written at this call fails to compile with a sentence naming this
 * action and the fix. Everything else passes through unchanged, and the return type
 * is the plain `ActionDefinition` so a declaration composes into a stage and into
 * `buildCatalog` exactly as a hand-written object would.
 *
 * **Accepted residual gap: `${number}` and `${bigint}` holes.**
 * `` `Show ${count} results.` `` with `count: number` infers
 * `` `Show ${number} results.` ``, and every one of the six probes above classifies
 * that as concrete, so it is **accepted**. Six candidate predicates were measured
 * against it and all six missed; a targeted
 * `` D extends `${infer A}${number}${infer B}` `` decomposition does not match at
 * all — it returns no-match for the pattern *and* for a concrete
 * `"Show 10 results."`, so it cannot even be used as a detector.
 *
 * This is accepted rather than open: a numeric hole can carry only digits, `-`,
 * `.`, `e`, `+`, `Infinity` and `NaN`. It cannot carry prose, and CAT-07's threat
 * is prose-borne agent steering — an instruction smuggled into the tool list. The
 * residual risk, stated honestly rather than argued away: an attacker who controls
 * a numeric value can still shift the *numbers* in a sentence, so a description
 * that states a limit ("Refunds up to ${cap} dollars.") can be made to state a
 * different limit. Do not put a policy number in a description. `${boolean}` is not
 * affected — it infers a finite two-member union of concrete literals and is
 * accepted for the same reason a ternary over two literals is.
 *
 * `test-d/description-literal.test-d.ts` pins this gap with a predicate asserting
 * the pattern passes through unchanged. If a future compiler closes the hole that
 * predicate goes red, and the correct response is to delete it and this paragraph —
 * not to relax the predicate.
 *
 * **`isolatedDeclarations` bites at the call site, not here.** Measured:
 * `export const a = defineAction({…})` is
 * `TS9010: Variable must have an explicit type annotation with
 * --isolatedDeclarations`. The annotation is writable —
 * `ActionDefinition<"applyFilter", typeof filterSchema>` — but it is verbose, and
 * annotating is also what silently disables any assertion that exists to read an
 * inferred type. A non-exported `const` is unaffected, which is the shape this
 * repo's own type tests use and the shape to recommend.
 *
 * **Rejected alternative: guarding `buildCatalog` as well.** It would close the
 * remaining bypass — a raw object literal assembled without this function — but it
 * was measured to false-positive on every `defineAction` result, since by then the
 * description has already been narrowed to a value the catalog-side predicate reads
 * as opaque. It is also the only version of this guard that would force an
 * amendment to `ActionDefinition.description` in `types.ts`. `defineAction` alone is
 * the decision; the raw-literal path stays reachable and stays unguarded.
 */
export function defineAction<
  N extends string,
  D extends string,
  S extends StandardSchemaV1,
  B = unknown,
  Snap = unknown,
  Ack = unknown,
>(
  def: Omit<ActionDefinition<N, S, B, Snap, Ack>, "description"> & {
    description: LiteralDescription<N, D>;
  },
): ActionDefinition<N, S, B, Snap, Ack> {
  return def as ActionDefinition<N, S, B, Snap, Ack>;
}
