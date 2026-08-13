---
phase: 03-action-declaration-and-build-time-validation
plan: 01
subsystem: core-types
tags: [cat-07, dx-03, sec-01, type-level-guard, tool-poisoning]
requires:
  - packages/concierge/src/types.ts (ActionDefinition, StandardSchemaV1, RedactionPolicy)
  - packages/concierge/test-d/_assert.ts (Expect, Equals, Assignable, Not)
  - scripts/mutate-and-prove.sh
provides:
  - defineAction
  - LiteralDescription
  - IsNotConcrete
  - HoleProbe
affects:
  - 03-04 (owns src/index.ts barrel; nothing here is exported through it yet)
  - 03-08 (owns src/types.ts:505-506, the third stale M9 claim)
tech-stack:
  added: []
  patterns:
    - "Conditional type whose rejection branch IS the error sentence, inline"
    - "Distributed union probe testing against `false` to fail closed"
    - "Two-family type assertions: guard type vs. guard wiring"
key-files:
  created:
    - packages/concierge/src/define-action.ts
    - packages/concierge/test-d/description-literal.test-d.ts
  modified:
    - packages/concierge/test-d/actions.test-d.ts
decisions:
  - "The `Omit<ActionDefinition<…>, \"description\"> & { description: LiteralDescription<N, D> }` parameter form SHIPS. Name/Snapshot inference through it was measured green; the intersection-form fallback was not needed."
  - "`defineAction`'s body needed only the single `as` assertion. No TS2352, no `as unknown as`."
  - "All six HoleProbe branches retained despite branches 2-5 being measurably redundant under the current suite."
metrics:
  duration: ~35 min active (session interrupted by a rate limit and resumed)
  completed: 2026-07-29
  tasks: 3
  commits: 4
  files_changed: 3
---

# Phase 3 Plan 01: CAT-07 Literal-Description Guard Summary

Six-branch type-level guard that refuses any `defineAction` description which is not a static
string literal, with the rejection branch written inline so `tsc` prints the action's name and
the fix verbatim in terse CI output.

## What Shipped

| File | Role |
|---|---|
| `packages/concierge/src/define-action.ts` (233 lines) | `defineAction`, `LiteralDescription`, `IsNotConcrete`, `HoleProbe` |
| `packages/concierge/test-d/description-literal.test-d.ts` (210 lines) | Both assertion families, 9 accept cases, 6 reject predicates, 2 known-gap pins |
| `packages/concierge/test-d/actions.test-d.ts` (modified) | Real `defineAction` wired in, SEC-01 type half, two stale claims corrected |

Nothing is exported through `src/index.ts` — plan 03-04 owns the barrel. Confirmed: `pnpm build`
runs clean with `attw` and `publint` green, and the export-surface suite still pins its existing
counts.

## Measurements Requested by the Plan

**Which cast form `defineAction`'s body needed.** The **single** assertion,
`return def as ActionDefinition<N, S, B, Snap, Ack>;`. TS2352 did not fire, so `as unknown as` was
not needed and is not present.

**Which parameter form shipped.** The **`Omit`** form, unchanged from the plan:
`Omit<ActionDefinition<N, S, B, Snap, Ack>, "description"> & { description: LiteralDescription<N, D> }`.
The intersection fallback was never reached.

**The canary, for all three `actions.test-d.ts` call sites and for `_snapshotInferred`.**
**GREEN on the first run, with no edits to any call site.**

| Subject | Result |
|---|---|
| `confirm` (`"Confirm the booking."`) | compiles |
| `cancelShipment` (`"Cancel the shipment before it leaves the warehouse."`) | compiles |
| `signOut` (`"Sign the user out."`) | compiles |
| `_nameNotWidened` (`:199`) | green — `N` inferred as `"confirmBooking"`, not widened |
| `_snapshotInferred` (`:202`) | green — `Snapshot` inferred as `Booking` through the `Omit` |

This closes the plan's explicitly UNMEASURED risk: `Snapshot` inference through the
`Omit<…> & {…}` parameter works. Independently corroborated by the DX-03 proof below, whose error
text reads `action \"applyFilter\"` rather than `action \"string\"` — inference of `N` at a real
call site, not just at an explicit instantiation.

**Observed `tsc` exit code.** **1**, on every one of the seven gate runs. `scripts/mutate-and-prove.sh:32`
still says "tsc exits 2 on diagnostics" and remains stale prose under typescript 7.0.2. Not edited —
that file is not in this plan's `files_modified`.

**Exact mutant patterns used** (each verified to occur exactly once before running):

| ID | File | Pattern | Replacement |
|---|---|---|---|
| M-03-1 | `src/define-action.ts` | `description: LiteralDescription<N, D>` | `description: D` |
| M-03-2 | `src/define-action.ts` | `` `${D}${D}` extends D ? true `` | `` `${D}${D}` extends never ? true `` |
| SEC-01 | `src/types.ts` | `  redact: RedactionPolicy<InferOutput<Schema>>;` | `  redact?: RedactionPolicy<InferOutput<Schema>>;` |
| DX-03 | `test-d/description-literal.test-d.ts` | `"Narrow the visible results to one facet value."` | `widenedDescription` |

## Gate Results

All re-run against the final committed tree, after the doc-correction commit.

| Gate | Harness | Gate exit | Predicates reddened |
|---|---|---|---|
| M-03-1 (guard unplugged from parameter) | PASS (0) | 1 | 8 — both family-2 rejections + all 6 reject cases; **family 1 stayed green**, which is the whole point of the split |
| M-03-2 (interior-hole probe disabled) | PASS (0) | 1 | 4 |
| SEC-01 (`redact` made optional) | PASS (0) | 1 | 1 — only `_redactIsRequired` |
| DX-03 message proof | PASS (0) | 1 | — |
| `pnpm typecheck` | — | 0 | — |
| `pnpm test` (bare form) | — | 0 | 4 files / 15 tests, matching the pre-existing baseline |
| `git status --porcelain` | empty | — | — |

### DX-03: the captured terse, non-TTY `tsc` output

```
test-d/description-literal.test-d.ts(165,66): error TS2322: Type 'string' is not assignable to type
'"concierge CAT-07 — action \"applyFilter\": description must be a static string literal written at
this declaration. Fix: replace the expression with the finished sentence in quotes. A description
assembled from i18n, CMS, per-tenant text, or any runtime value is a tool-poisoning vector and is
rejected here."'.
```

Both required assertions succeeded against that capture: `grep -q 'concierge CAT-07 — action'` and
`grep -q 'Fix: '`. Asserted on message TEXT only — no symbol or alias name was grepped, per the
measured terse-output asymmetry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] A doc-comment claim in shipped source was falsified by my own measurement**

- **Found during:** Task 2 verification.
- **Issue:** `HoleProbe`'s doc comment (carried over from RESEARCH *Pattern 1*) claimed the six
  branches "each catch a hole position the others miss." I ran a one-branch-at-a-time mutation
  battery — four mutants beyond the two the plan requires — and the claim is **false**:

  | Branch disabled | Suite result |
  |---|---|
  | 1 `string extends D` | RED (detected) |
  | 2 `` `~${D}` `` | **green — mutant escapes** |
  | 3 `` `${D}~` `` | **green — mutant escapes** |
  | 4 `` `${D}0` `` | **green — mutant escapes** |
  | 5 `` `0${D}` `` | **green — mutant escapes** |
  | 6 `` `${D}${D}` `` | RED (detected) |

  Branch 6 subsumes branches 2-5 for every `${string}`-hole pattern, because doubling a pattern
  whose hole sits at either end also lands inside that pattern. Only branches 1 and 6 are
  individually load-bearing under this suite.
- **Fix:** Corrected the comment to the measurement, including the escape table, plus an explicit
  instruction not to read the escapes as permission to delete the branches. **All six branches
  retained.** No discriminating case exists in the `${string}` universe; the shapes that would
  discriminate branches 2-5 are `${number}` / `${bigint}`, which are the accepted gap that no
  branch closes.
- **Why not delete them:** this is precisely the trap the plan warned about. An escaping mutant
  here means the *suite* lacks a discriminating case, not that the branch is dead code. The four
  are cheap O(1) defence against pattern shapes outside the measured matrix.
- **Files modified:** `packages/concierge/src/define-action.ts` (comment only; the chain is byte-identical)
- **Commit:** `a768978`

**2. [Rule 1 — Bug] My own replacement comment defeated an acceptance grep**

- **Found during:** Task 3 verification.
- **Issue:** The comment I left at the old placeholder site read "A `declare function
  defineAction<…>` stand-in stood here", which reproduced the exact token
  `grep -c 'declare function defineAction'` is supposed to return **0** for. Measured 1.
- **Fix:** Reworded to split the token, and stated in the comment itself why the ambient spelling
  is not reproduced — the same convention this file already uses for the suppression-directive
  token at `:63-66`. Re-measured: 0.
- **Files modified:** `packages/concierge/test-d/actions.test-d.ts`
- **Commit:** `780b3a7` (folded into the task commit; caught before it)

### Non-deviation notes

- **`pnpm test` initially failed 4/4** on a fresh worktree with "dist/index.js is missing… run
  `pnpm build` first". That is the suite's own guard, not a regression: `dist/` is gitignored and
  had never been built in this worktree. After `pnpm build`, 4 files / 15 tests pass. No source
  change was involved.
- **Two acceptance greps needed `-F`.** `grep -c 'concierge CAT-07 — action "${N}"'` and
  `grep -c '${number}'` both returned 0 as written, because `{N}` / `{number}` parse as regex
  interval quantifiers. With `grep -F` they return 1 and 3. The criteria are satisfied; only the
  grep invocation in the plan was underspecified. Recording it so the verifier does not read a
  false negative.
- **Branch-count criterion measured 6 under both greps.** `grep -v '^\s*[/*]' … | grep -c 'extends D'`
  returns **6** under the shell's `grep` (ugrep 7.5.0) *and* under BSD `command grep` with a
  POSIX-class equivalent. No divergence to flag. Achieved without putting `extends D` in any
  comment: the six-branch listing in the doc comment names each probe by its prefix/suffix rather
  than reproducing the expression.

## Known Stubs

None. Every type and every predicate in this plan is fully wired and mutation-proved.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access, and no schema change at a
trust boundary. It installs nothing — no package-manager operation occurred (T-03-SC).

The accepted `${number}` / `${bigint}` residual (T-03-02) is unchanged from the plan's disposition
and is now recorded in three places: the doc comment on `defineAction`, two pinned predicates in
`description-literal.test-d.ts`, and this summary.

## Requirements Satisfied

- **CAT-07** — enforced at the type level with **no `types.ts` amendment**, as designed.
- **DX-03** (compile half) — proved against real terse `tsc` output, not asserted.
- **SEC-01** (type half) — `_redactIsRequired` added and mutation-proved. Runtime half belongs to
  `buildCatalog`.

## Notes for Later Plans

- **03-04** owns `src/index.ts`. Four names are waiting to be exported: `defineAction`,
  `LiteralDescription`, `IsNotConcrete`, `HoleProbe`. `attw` and `publint` are blind to a moved
  export; only `typecheck` catches it.
- **03-08** owns `src/types.ts:505-506`, which still carries the third stale M9 claim
  ("Its only symptom is one unused suppression directive…"). Untouched here — `types.ts` is not in
  this plan's `files_modified`, and it was left byte-identical (verified via
  `git diff --exit-code` after the SEC-01 mutant).
- The raw-object-literal bypass stays open by design: an action assembled without `defineAction`
  is unguarded. Guarding `buildCatalog` was measured to false-positive on every `defineAction`
  result and is the only variant that would force a `types.ts` amendment. Reasoning is recorded in
  the shipped doc comment.

## Self-Check: PASSED

Files verified present:
- FOUND: `packages/concierge/src/define-action.ts`
- FOUND: `packages/concierge/test-d/description-literal.test-d.ts`
- FOUND: `packages/concierge/test-d/actions.test-d.ts`

Commits verified in `git log`:
- FOUND: `db7812e` — feat(03-01): add defineAction and the CAT-07 literal-description guard
- FOUND: `9942d09` — test(03-01): pin the CAT-07 accept/reject matrix, both assertion families, the known gap
- FOUND: `a768978` — docs(03-01): correct a falsified redundancy claim on the HoleProbe chain
- FOUND: `780b3a7` — test(03-01): wire the real defineAction into the Phase-1 suite, add SEC-01's type half
