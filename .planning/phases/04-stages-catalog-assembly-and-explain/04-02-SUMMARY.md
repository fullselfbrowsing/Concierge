---
phase: 04-stages-catalog-assembly-and-explain
plan: 02
subsystem: catalog
tags: [CAT-03, consent, validation, freeze, build-time-errors]
requires:
  - "packages/concierge/src/catalog.ts — buildCatalog's per-action loop, seenNames, and the single aggregated throw"
  - "packages/concierge/src/json-schema.ts — PropertyBag idiom precedent"
provides:
  - "CatalogIssueCode: consent_target_missing"
  - "CatalogIssueCode: consent_self_reference"
  - "consentRequiresOf — Object.hasOwn-guarded two-hop read of consent.requires"
  - "the CAT-03 post-pass over the complete declared-name set"
  - "export function deepFreeze — module-internal, for 04-03's explain()"
affects:
  - "04-03 (consumes exported deepFreeze; export counts unchanged by this plan)"
  - "04-04 (asserts on the verbatim problem/fix prose recorded below)"
  - "04-07 (mutants M-04-09 / M-04-10 / M-04-11 use the literals recorded below)"
tech-stack:
  added: []
  patterns:
    - "post-pass over a complete set, placed between the validation loop and the single throw"
    - "two-hop Object.hasOwn read for any value core did not author"
key-files:
  created: []
  modified:
    - "packages/concierge/src/catalog.ts"
decisions:
  - "CAT-03 is a post-pass, not an in-loop check — measured, not argued"
  - "iterate `declared`, check against `seenNames`"
  - "self-reference is a second code, not a reuse: identical consequence, completely different fix"
  - "an absent or non-string consent.requires is skipped silently; recorded as a residual, scheduled against Phase 8"
  - "the stale-prose rewrite avoids present-tense claims about src/concierge.ts, which does not exist until wave 2"
metrics:
  duration: ~13 min
  completed: 2026-07-30
---

# Phase 4 Plan 02: CAT-03 and the Catalog Freeze Export — Summary

CAT-03 lands as a post-pass over the complete declared-name set, so a typo'd `consent.requires` fails
the build while a forward reference and a cross-stage target build clean — plus `deepFreeze` gains a
module-internal `export` so `explain()` never needs a second, weaker freeze walk.

## What Was Built

**Task 1 (`ff8ac26`) — the two codes and the post-pass.**

- `CatalogIssueCode` widened with `"consent_target_missing"` and `"consent_self_reference"`. The doc
  comment cites the existing `not_emittable`/`threw` collapse as the precedent, applied and answered
  the other way: identical consequence, completely different `fix`. It states plainly that collapsing
  them would force one `fix` to cover both, so a developer who merely mistyped a name would be advised
  to consider deleting their consent policy — advice that, if taken, removes the gate CAT-03 protects.
- `consentRequiresOf(action)` — a module-private `PropertyBag` view reading **both** hops through
  `Object.hasOwn`, never `in`.
- `const declared: AnyActionDefinition[]` alongside the existing locals, pushed on exactly one line
  immediately after `seenNames.add(action.name);`.
- The post-pass loop, placed strictly between the per-action loop's closing brace and the existing
  `if (issues.length > 0) {`. Self-reference tested first, the two branches joined by `else if`.

**Task 2 (`c469ef7`) — the export and three prose corrections.**

- `deepFreeze` gains `export` (module-internal only; not re-exported from `src/index.ts`).
- `duplicate_action_name`'s `fix` enriched to state the scope rule.
- The two stale-prose sites corrected in place.

## Verbatim Prose (for 04-04 to assert on)

`consent_target_missing` — `problem` (target interpolated):

```
its consent policy requires "reveiw", and no action by that name is declared in this catalog — so the gate can never arm and the action is permanently blocked.
```

`consent_target_missing` — `fix`:

```
declare an action named "reveiw", or correct the spelling in `consent.requires`. The target may live in any stage, or in `crossStage`.
```

`consent_self_reference` — `problem`:

```
its consent policy requires "confirmBooking", which is the action itself — arming the gate would mean running the very action the gate blocks, so it can never be satisfied.
```

`consent_self_reference` — `fix`:

```
point `consent.requires` at the review action that should run first, or remove the `consent` policy if this action needs no gate.
```

Enriched `duplicate_action_name` `fix` (one constant string literal, exact-matchable):

```
rename one of them. An action name is global across every stage and across `crossStage` — the same name may not be declared twice even in different stages.
```

Rendered, in the existing message format:

```
concierge: 1 problem(s) in the action catalog.
  [consent_target_missing] action "confirmBooking": its consent policy requires "reveiw", and no action by that name is declared in this catalog — so the gate can never arm and the action is permanently blocked. Fix: declare an action named "reveiw", or correct the spelling in `consent.requires`. The target may live in any stage, or in `crossStage`.
```

## Mutant Literals (for 04-07: M-04-09, M-04-10, M-04-11)

Unfiltered occurrence counts, comments included, measured on the final tree:

| Literal | Occurrences |
|---|---|
| `!seenNames.has(requires)` | **1** |
| `requires === action.name` | **1** |
| `declared.push(action);` | **1** |

Each is unique, so each works as a mutation target directly. The prose was written to keep them
unique: neither expression appears in any doc comment.

**TRAP literals — do not use bare.** `grep -c 'consent_target_missing'` and
`grep -c 'consent_self_reference'` each return **2** (the union member and the issue push). The doc
comments deliberately describe both codes without naming them, which is what keeps these at 2.

## Export Surface

`CatalogIssueCode` gained two union members. That is a **widening of an already-exported type and adds
ZERO names to the export surface.** Re-derived with `export-surface.test.ts`'s own regex over
`dist/index.d.ts`:

```
blocks 1 names 59 values 10 types 49
```

Unchanged from the baseline. `deepFreeze` occurrences in `dist/index.d.ts`: **0** — it is not
re-exported from the barrel, and nothing in the public surface references its type, so it does not
appear in the bundled declarations at all. 04-03 should treat this plan as contributing **+0** to the
export counts.

`check:deps` byte count: `@standard-schema/spec  0 bytes` (its 754-byte `require` entry is
unreachable through core, which is ESM-only). Assertion B: PASS.

## Verification

All five gates exit 0 on the final tree:

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS (attw + publint clean) |
| `pnpm test` | PASS — **6 files / 55 tests**, unchanged |
| `pnpm check:deps` | PASS |
| `pnpm check:artifact` | PASS |

`test/catalog.test.ts` C4 still asserts four issues in declaration order. Verified by reading the
fixture before running: none of `fourBadDeclarations()`'s five declarations carries a `consent`
policy, so the post-pass appends nothing and the array is unchanged.

Acceptance criteria, re-measured on the final tree after both commits:

| Criterion | Expected | Actual |
|---|---|---|
| `consent_target_missing` | 2 | 2 |
| `consent_self_reference` | 2 | 2 |
| `!seenNames.has(requires)` | 1 | 1 |
| `requires === action.name` | 1 | 1 |
| `declared.push(action);` | 1 | 1 |
| non-comment ` in action` | 0 | 0 |
| non-comment `for (const … in …)` | 0 | 0 |
| `if (issues.length > 0) {` | 1 | 1 |
| `export function deepFreeze` | 1 | 1 |
| `deepFreeze` in `src/index.ts` | 0 | 0 |
| `Hand-forward to Phase 4` | 0 (pre-edit 1) | 0 |
| `this plan.s .files_modified. does not include it` | 0 (pre-edit 1) | 0 |
| `rename one of them.` | 1 | 1 |
| `An action name is global across every stage` | 1 (pre-edit 0) | 1 |

The two must-become-0 criteria were both measured at **1** on the unmodified tree before editing, and
the positive pair for the enriched `fix` was measured at **0**, so all four discriminate rather than
sitting pre-satisfied. `git diff -U0` for Task 2 was read line by line: the only non-comment changes
are the single `export` keyword and the single `fix:` string.

## Probes Run (discarded after recording)

**CAT-03 behaviour, against the built artifact.** Seven scenarios, all as designed:

```
typo                              -> consent_target_missing on "confirmBooking", "reveiw" in problem
forward reference                 -> BUILT CLEAN
cross-stage target appended last  -> BUILT CLEAN
self reference                    -> consent_self_reference
consent: null                     -> BUILT CLEAN (no throw)
consent: {}                       -> BUILT CLEAN (no throw)
requires: 42                      -> BUILT CLEAN (no throw)
aggregate (typo + 3 other faults) -> threw ONCE with 4 issues
```

The last row is the one that matters for the aggregation invariant: a consent typo alongside three
other faults still throws exactly once, carrying four issues.

**T-04-15, prototype pollution — the first form of this probe was inconclusive and was redone.**
Polluting `Object.prototype.requires` globally broke *zod's own emitter* first (`TypeError: Cannot
read properties of undefined (reading 'def')`), so the build failed for an unrelated reason before the
consent rule was ever reached — the probe proved nothing. Redone by putting `requires` on the
*consent object's* prototype instead, which isolates the read under test:

```
inherited requires (consent prototype)  -> BUILT CLEAN (inherited value correctly not read)
inherited consent (action prototype)    -> BUILT CLEAN (inherited value correctly not read)
own requires, same value                -> consent_target_missing   <- positive control
```

The third row is the control that makes the first two meaningful: the identical value as an *own*
property is caught, so the two clean rows are the `Object.hasOwn` guard working rather than the rule
being dead.

**The widened freeze measurement** (used to justify the Task 2 prose rather than asserting it).
Against a frozen source array, `Object.isFrozen` on the result:

```
filter(...) false   map(...) false   slice() false   [...spread] false
concat() false      flat() false     toReversed() false   Array.from() false
```

And against a genuinely deep-frozen source: projected elements are shared by reference (`true`) and
are still frozen through the projection (`true`), so a plain `Object.freeze` on the projection's own
array is sufficient. The first version of this probe froze only the array and reported "elements
frozen: false" — an artifact of the probe, not a property of the projection; it was re-run correctly
before anything was written into the doc comment.

## Deviations from Plan

**1. [Rule 1 - Correctness] The stale-prose rewrite avoids a present-tense claim about a file that does not exist yet**

- **Found during:** Task 2, edit (c)
- **Issue:** The plan instructs the `catalog.ts:554-558` rewrite to be "a statement of what
  `src/concierge.ts` now does: `catalogFor`'s stage-scoped result is a projection built from shared,
  already-deep-frozen elements and sealed with a plain `Object.freeze`". But this plan is **wave 1**
  and `src/concierge.ts` is created by **04-03 in wave 2** — verified: the file does not exist in this
  tree, and every phase plan's wave was checked. Writing that sentence in the present tense would ship
  a factually false claim into `dist/index.d.ts` describing a file that does not exist at the moment
  the commit lands. That is precisely the defect class `04-PATTERNS.md:36` names and that 03-08 spent
  a whole plan removing.
- **Fix:** Phrased the paragraph as the **obligation binding whatever builds a projection** rather than
  as a report of what an absent file already does — "whatever builds that projection has to freeze what
  it returns". This is true both before and after 04-03 lands, and it satisfies the plan's actual
  requirement exactly: the hand-forward framing (the thing that goes false) is gone, and the
  measurement (the thing that had to survive) is kept verbatim and widened. The plan's own acceptance
  criterion, `grep -c 'Hand-forward to Phase 4'` returning 0, passes.
- **Files modified:** `packages/concierge/src/catalog.ts`
- **Commit:** `c469ef7`

**2. [Rule 2 - Verification] The widened array-method claim was measured before being written**

- **Found during:** Task 2, edit (c)
- **Issue:** The plan supplies the claim "`map`, `slice`, spread and `concat` behave identically" as
  text to write into a shipped doc comment. Under the repo's standing rule a claim without a probe
  behind it does not ship, and this claim would ship into `dist/index.d.ts`.
- **Fix:** Measured all four, plus `flat`, `toReversed` and `Array.from` — all eight return an unfrozen
  array. Also measured the element-identity half that makes a cheap `Object.freeze` sufficient. The
  doc comment now records what was measured, and names the wider set rather than the plan's four.
- **Files modified:** `packages/concierge/src/catalog.ts`
- **Commit:** `c469ef7`

No other deviations. No architectural changes, no new dependencies, no package installs.
`pnpm-lock.yaml` is byte-identical.

## Known Stubs

None. Both tasks landed complete behaviour; nothing is placeholdered.

## Threat Flags

None. This plan introduces no new network endpoint, auth path, file access pattern, or schema change
at a trust boundary. The threat register's four `mitigate` dispositions were each verified:

| Threat | Verification |
|---|---|
| T-04-14 (info disclosure via the two messages) | Both `problem` strings carry only the referring action's name, the developer-authored `requires` identifier, and fixed prose. No argument values, no environment, no paths. |
| T-04-15 (prototype pollution) | Measured at both hops with a positive control — see Probes Run. |
| T-04-16 (silently-dead consent gate) | The typo and self-reference rows of the CAT-03 probe both fail the build with an actionable `fix`; the forward-reference and cross-stage rows both build clean. |
| T-04-17 (malformed `consent` crashing the build) | `consent: null`, `consent: {}` and `requires: 42` all build clean with no throw. |

T-04-18 (a missing `requires`) remains **accept**, recorded as a residual in `consentRequiresOf`'s doc
comment in the established paragraph style and scheduled against Phase 8's consent kernel.

## Notes for Later Plans

- **04-03:** `deepFreeze` is importable from `./catalog.js`. Do **not** re-export it from
  `src/index.ts` — the export-surface count depends on it staying out of the barrel. This plan
  contributes **+0** names to the surface; the baseline is still 59/49/10.
- **04-04:** the CAT-03 issue array **appends after** every per-action issue rather than interleaving
  in declaration order. A test must not assume interleaving.
- **04-07:** the three mutant literals are each unique with comments included; see the table above.

## Self-Check: PASSED

- `packages/concierge/src/catalog.ts` — FOUND (modified, committed)
- `.planning/phases/04-stages-catalog-assembly-and-explain/04-02-SUMMARY.md` — FOUND
- Commit `ff8ac26` — FOUND
- Commit `c469ef7` — FOUND
- `git status --porcelain` clean apart from this summary; `git diff --stat -- pnpm-lock.yaml` empty
