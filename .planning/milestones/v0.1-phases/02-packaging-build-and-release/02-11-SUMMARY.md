---
phase: 02-packaging-build-and-release
plan: 11
subsystem: packaging
tags: [pkg-01, type-tests, verbatim-module-syntax, ts1485, ts2344, ts2578, variance, bivariance, mutation-testing, deferred-items]

# Dependency graph
requires:
  - phase: 02-packaging-build-and-release
    plan: "02-02"
    provides: "scripts/mutate-and-prove.sh, including the perl-via-environment fix that lets a pattern containing `/` be substituted"
  - phase: 02-packaging-build-and-release
    plan: "02-06"
    provides: "src/index.ts's third export block (CONTRACT_VERSION, assertSingleInstance) and the 45-name surface P8 is measured against"
  - phase: 02-packaging-build-and-release
    plan: "02-07"
    provides: "artifact.test.ts — the runtime half of the MESSAGE_MAX_CHARS pair — and the measured `pnpm test -- <name>` filtering defect"
provides:
  - "packages/concierge/test-d/exports.test-d.ts — the export-placement guard, importing MESSAGE_MAX_CHARS as a VALUE from ../src/index.js"
  - "packages/concierge/test-d/consent-variance.test-d.ts — _policyNotBivariant, M9's second and *named* detector"
  - "consent.test-d.ts's M9 cross-reference corrected in the same plan that makes it false"
  - "Mutant P8 observed: BUILD_EXIT=0, ARTIFACT_EXIT=1, TS1485 at exports.test-d.ts(52,10), results.test-d.ts NOT named"
  - "Mutant P9 observed: TS2344 on _policyNotBivariant AND TS2578 on _policyDegraded in the same run"
  - "A measured finding: the 45-name export-surface count guard does NOT see P8 — only the 39/6 split and the by-name guard do"
  - "A measured plan defect: tsc echoes source text only under --pretty, so a grep for an alias name in piped typecheck output is TTY-conditioned"
  - "Both Phase 1 test-coverage deferrals closed"
affects:
  - "02-12 — the two remaining stale M9 claims (actions.test-d.ts:147/153-155, src/types.ts:505) are recorded here, not fixed; both files were forbidden to this plan"
  - "02-12 — 02-VALIDATION.md's P8/P9 rows can now be marked observed, and its `42/43` figures are stale by the same −1 delta 02-07 recorded"
  - "Any future plan enabling Vitest typecheck mode — typecheck.include's default now matches SIX test-d files, not four"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A guard must import from the module the regression happens in, not the module the declaration lives in — the two are different for anything re-exported through a barrel"
    - "A negative predicate paired with an existing suppression directive: the directive proves a real assignment is rejected, the predicate makes the diagnostic name the invariant"
    - "When a plan's verify block greps for echoed source text, run the whole harness invocation under `script -q /dev/null` — tsc's `pretty` is TTY-conditioned and terse output carries file:line only"
    - "Prose in a test-d file may name the token an acceptance grep counts, provided the grep is anchored (`^import`) or the token is deliberately not spelled (suppression directives)"

key-files:
  created:
    - packages/concierge/test-d/exports.test-d.ts
    - packages/concierge/test-d/consent-variance.test-d.ts
  modified:
    - packages/concierge/test-d/consent.test-d.ts

key-decisions:
  - "actions.test-d.ts and src/types.ts were NOT edited, despite both still carrying a stale single-detector claim: the plan forbids editing them in prose and backs it with a `git diff --exit-code` acceptance criterion in two separate tasks. Recorded as deferred items with exact file:line and replacement wording"
  - "The two MESSAGE_MAX_CHARS guards were kept separate, as instructed, and P8 measured *why*: the typecheck output under the mutation names exactly one file, and it is not results.test-d.ts"
  - "P8 was run twice — once with the plan's verbatim `pnpm test -- artifact` gate, once with the corrected `pnpm test artifact` — because 02-07 measured that the `--` form does not filter and the plan's own prose claims specificity the verbatim form cannot deliver"
  - "P9's verify block was run verbatim under a pty rather than weakened: the third grep asserts on source text tsc prints only in pretty mode"

patterns-established:
  - "Run-it-verbatim-then-run-it-correctly: when a plan's gate command is known-defective from a prior plan's measurement, run the verbatim form for the acceptance record and a corrected form for the evidence, and report both"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-07-29
tasks: 3
commits: 2
files_changed: 3
---

# Phase 2 Plan 11: Both Phase 1 deferrals, closed and proven Summary

**The regression that erases a runtime binding from the published artifact with no diagnostic
anywhere now has a guard that reads the module it happens in — and the guard that could never have
seen it was observed staying silent in the same run — while M9's failure mode stopped being a lone
deletable unused-directive and became a TS2344 that echoes `_policyNotBivariant`.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3
- **Files changed:** 3 (2 created, 1 modified)

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | The `MESSAGE_MAX_CHARS` export-placement guard, reading the public entrypoint | `0d9a9e8` | `packages/concierge/test-d/exports.test-d.ts` |
| 2 | The named M9 detector, and the cross-reference it makes false | `feb1b8a` | `packages/concierge/test-d/consent-variance.test-d.ts`, `packages/concierge/test-d/consent.test-d.ts` |
| 3 | Mutants P8 and P9 | *(no net file change — see below)* | `src/index.ts`, `src/types.ts` mutated and restored |

**Task 3 has no commit, and that is correct rather than an omission** — the same reasoning 02-07
recorded. Every mutation is applied and restored inside a single `mutate-and-prove.sh` invocation,
so the task's output is evidence, not source. `git diff --exit-code` is clean after every invocation
and `git status --porcelain` is empty at the end.

`git diff --name-status 71d680b..HEAD` before this SUMMARY commit:
`A test-d/consent-variance.test-d.ts`, `M test-d/consent.test-d.ts`, `A test-d/exports.test-d.ts`.
Nothing else. `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `scripts/`, `src/` and
`tsconfig*.json` are all byte-unchanged — which also means plans 02-08 and 02-09, running
concurrently in sibling worktrees, share no file with this one.

## What shipped

### `test-d/exports.test-d.ts` — 59 lines, one predicate, one load-bearing import

```ts
import type { Equals, Expect } from "./_assert.js";
import { MESSAGE_MAX_CHARS } from "../src/index.js";   // ← index.js. NOT types.js. This is the whole point.

/** MESSAGE_MAX_CHARS reaches the public entrypoint as a VALUE, not only as a type. */
type _messageBoundExportedAsValue = Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>;
```

Research's skeleton verbatim, under a 49-line prose header. The header states the three things a
reader has to know and could not derive: that `verbatimModuleSyntax` is **one-directional**, that
`results.test-d.ts`'s `_messageBound` reads `../src/types.js` and is **structurally blind**, and that
the diagnostic which fires is **TS1485 at the import line**, not TS2344 at the assertion.

The last of those is the one worth the paragraph it got. Every other predicate in this directory
fails as `Type 'false' does not satisfy the constraint 'true'` on the aliased line. This one does
not, because the program stops resolving the value before the assertion is evaluated — so a reader
who greps for TS2344 concludes the file is fine.

### `test-d/consent-variance.test-d.ts` — 76 lines, one predicate

```ts
/** Function-property syntax keeps `snapshotEquality`'s parameters contravariant. Method syntax would make them bivariant, and a comparator for the wrong snapshot type would satisfy the field. */
type _policyNotBivariant = Expect<Not<Assignable<ConsentPolicy<Booking>, ConsentPolicy<unknown>>>>;
```

A new file rather than four lines added to `actions.test-d.ts` — the placement the plan locked. The
cost was a ~65-line header and a re-declared local `interface Booking { readonly id: string }`; the
purchase was that `actions.test-d.ts`, whose header enumerates its own coverage and asserts a
suppression-directive count a grep can confirm, is **byte-unchanged**.

Both files obey the four house rules: prose header, **export nothing** (`grep -c '^[[:space:]]*export'`
is 0 in each), one line per predicate however long, alias named after the invariant with a `/** … */`
doc comment. Neither contains a suppression directive (`grep -c '@ts-expect-error'` is 0 in each) —
and `consent-variance.test-d.ts` discusses directives at length without ever spelling the token,
following `actions.test-d.ts:63-64`'s own idiom for exactly this reason.

### The corrected cross-reference

`consent.test-d.ts`, one paragraph, +7/−4 lines. Before:

> mutant M9 reproduces, and its **single symptom** is an unused directive on `_policyDegraded` in
> `actions.test-d.ts` (plan 01-06).

After:

> mutant M9 reproduces, and since plan 02-11 it has **two** detectors. The first is an unused
> directive on `_policyDegraded` in `actions.test-d.ts` (plan 01-06) — a bare TS2578, which is the
> failure mode a reviewer deletes. The second is `_policyNotBivariant` in
> `consent-variance.test-d.ts`, which fails with TS2344 on a line whose echoed source text names the
> invariant.

The surrounding paragraph is intact, including its point — `DigestLike`'s method syntax still has
**no** mutant and one must not be invented — and its closing sentence. `grep -rn "single symptom"
packages/` now returns nothing.

## Mutant P8 — `MESSAGE_MAX_CHARS` moved into `index.ts`'s type-export block

Pattern: the contiguous 9-line span from `  SessionConfig,` through the closing
`} from "./types.js";` of the **value** block, read verbatim from the file and verified to occur
**exactly once** before mutating. Replacement: the same span with `  MESSAGE_MAX_CHARS,` moved up
into the type block immediately after `  SessionConfig,` — one substitution performing the whole
move, so the diagnostic is TS1485 and not a duplicate-export error. Both halves contain `/`, so this
re-exercises plan 02-02's perl-via-environment fix.

Gate, verbatim from the plan:
`bash -c 'pnpm build; echo BUILD_EXIT=$?; pnpm test -- artifact; echo ARTIFACT_EXIT=$?; pnpm typecheck'`

| | |
|---|---|
| harness stdout | `PASS: gate fired (exit 1), tree clean` |
| harness exit | **0** |

**All four required observations, measured:**

**1. `BUILD_EXIT=0`.** The emit build is completely silent on a change that erases a runtime binding
from the published artifact. tsdown succeeded, and **attw and publint both reported no problems** —
the two gates PKG-01 rests on cannot see this either. `dist/index.js` fell from 9.74 kB to
**9.14 kB**; the missing 0.6 kB is the binding and its doc comment.

**2. `ARTIFACT_EXIT=1`.** `artifact.test.ts` catches the erasure where it actually harms a consumer:

```
FAIL packages/concierge/test/artifact.test.ts > MESSAGE_MAX_CHARS reaches dist/index.js as a value, at 180
AssertionError: expected undefined to be 180 // Object.is equality
  ❯ packages/concierge/test/artifact.test.ts:46:33
```

**3. `pnpm typecheck` non-zero, `TS1485`, at the import line.** Verbatim, and this is the entire
typecheck output:

```
test-d/exports.test-d.ts(52,10): error TS1485: 'MESSAGE_MAX_CHARS' resolves to a type-only
declaration and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
```

Line 52 of `exports.test-d.ts` **is** the import line. Column 10 is the identifier inside the braces.

**4. `results.test-d.ts` is NOT named.** The full list of files named in the typecheck output is:

| Files named in P8's typecheck diagnostics |
|---|
| `test-d/exports.test-d.ts` |

That is the whole list — **one** file, one diagnostic (`grep -c 'results.test-d.ts'` over the
typecheck section returns **0**). The blindness that justifies a second file was *observed*, not
asserted: the old guard compiled clean against a `src/` whose public entrypoint had lost the binding.

### The second P8 run, and why it was needed

02-07 measured that `pnpm test -- <name>` does **not** filter — Vitest's cac CLI discards everything
after `--`. Run verbatim, P8's `ARTIFACT_EXIT=1` is therefore the exit code of the **whole** suite,
which cannot support the plan's own prose claim that *`artifact.test.ts` catches the erasure*. So P8
was run a second time through the harness with the one-character correction, `pnpm test artifact`:

| Run | Gate form | Test files run | Failures | `ARTIFACT_EXIT` |
|---|---|---|---|---|
| P8a (plan verbatim) | `pnpm test -- artifact` | **3** | 4 | 1 |
| P8b (corrected) | `pnpm test artifact` | **1** | 1 | **1** |

P8b's single failure is `artifact.test.ts > MESSAGE_MAX_CHARS reaches dist/index.js as a value, at
180`. Both runs produced `PASS: gate fired`, `BUILD_EXIT=0`, the identical TS1485 at
`exports.test-d.ts(52,10)`, and a clean tree.

### P8a's four failures — and the guard that did *not* fire

Worth recording, because it distinguishes P8 from P11 and nobody has written it down yet:

| Failing test (P8a, whole suite) | Message |
|---|---|
| `artifact > MESSAGE_MAX_CHARS reaches dist/index.js as a value, at 180` | `expected undefined to be 180` |
| `export-surface > splits 39 types to 6 values` | `expected […] to have a length of 39 but got 40` |
| `export-surface > carries all six runtime value exports by name` | `expected […] to include 'MESSAGE_MAX_CHARS'` |
| `single-instance > F1b` | rolldown `[MISSING_EXPORT] "MESSAGE_MAX_CHARS" is not exported by "packages/concierge/dist/index.js"` — a hard bundle error |

**The 45-name count guard passed.** P8 *moves* a name between blocks, so the total is preserved: the
surface stays at 45 while the split goes 39/6 → **40/5**. P11 (a *dropped* name) is the regression
the count sees, 45 → 44. The two mutants are not interchangeable, and the count assertion alone would
have let P8 through. `export-surface.test.ts` catches P8 only because it *also* pins the split and
the six value names individually — the "different sampling rates, same defect" pairing earning its
keep in a direction 02-07 did not test.

## Mutant P9 — `snapshotEquality` regressed to method syntax

Pattern `  snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean;` → replacement
`  snapshotEquality?(a: Snapshot, b: Snapshot): boolean;`, gate `pnpm typecheck`.

| | |
|---|---|
| harness stdout | `PASS: gate fired (exit 1), tree clean` |
| harness exit | **0** |
| plan's Task 3 `<verify>` block, run verbatim | **`P9_PROVEN`** |

**Both diagnostics, in the same run, with locations:**

```
test-d/actions.test-d.ts:162:3 - error TS2578: Unused '@ts-expect-error' directive.

162   // @ts-expect-error - a Booking comparator must NOT fit ConsentPolicy<unknown> (SC-7a)
      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

test-d/consent-variance.test-d.ts:76:35 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

76 type _policyNotBivariant = Expect<Not<Assignable<ConsentPolicy<Booking>, ConsentPolicy<unknown>>>>;
                                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 2 errors in 2 files.
```

| Code | File:line | What it is |
|---|---|---|
| **TS2344** | `test-d/consent-variance.test-d.ts:76:35` | the new detector. The echoed source line carries `_policyNotBivariant`, so the diagnostic **names the invariant** |
| **TS2578** | `test-d/actions.test-d.ts:162:3` | M9's old, lone, deletable symptom — the directive on `_policyDegraded` going unused because the assignment it guards started succeeding |

**Seeing both in one run is the evidence the deferral was for.** Before this plan the second row was
the *entire* signal: an unused-directive error on a comment line, in a file about action definitions,
which reads to a reviewer as a stale test. It is still there, still wanted, and now it arrives beside
a diagnostic that says which guarantee broke.

### The one thing the plan's verify block got wrong, recorded rather than adjusted

The block's third gate is `grep -q "_policyNotBivariant" /tmp/p9.log`. `tsc` echoes source text only
when `pretty` is on, and `pretty` defaults to **on for a TTY and off for a pipe** — and the block
pipes through `tee`. Measured, in this order:

| Invocation | `PASS: gate fired` | `TS2344` | `_policyNotBivariant` echoed |
|---|---|---|---|
| plan's block, piped (no TTY) | yes | yes | **no** — output is terse `file(line,col): error TS2344: …` |
| same mutation, gate `… tsc … --pretty` | yes | yes | **yes** |
| **plan's block verbatim, under `script -q /dev/null`** | yes | yes | **yes** → **`P9_PROVEN`** |

The assertion was **not** weakened and the predicate was **not** renamed to appear in terse output.
The third row is the plan's block byte-for-byte — same harness call, same gate `pnpm typecheck`, same
three greps — with a pty allocated around it, which is the condition its author was writing under. It
prints `P9_PROVEN`.

Carried forward because it will bite again: **any acceptance criterion that greps typecheck output
for an alias name is TTY-conditioned.** In CI it will be false. A criterion that greps for the
`file:line` instead is not.

## Deviations from Plan

### Recorded, not fixed

**1. [Recorded] Two stale single-detector claims survive, in the two files this plan is forbidden to
edit.**

The plan's `must_haves.truths` includes *"No cross-reference in the type-test suite still claims M9
has a single symptom"*. The literal phrase is gone — `grep -rn "single symptom" packages/` returns
nothing. Two semantically identical claims remain:

| File:line | Text | Replacement it needs |
|---|---|---|
| `packages/concierge/test-d/actions.test-d.ts:147` | "The negative — and **mutant M9's sole detector**." | "…and M9's *first* detector; the second is `_policyNotBivariant` in `consent-variance.test-d.ts`." |
| `packages/concierge/test-d/actions.test-d.ts:153-155` | "this directive goes unused — a lone TS2578 is then the *only* symptom … Nothing else in this repository notices." | "…a lone TS2578 is then this file's only symptom; since plan 02-11 `_policyNotBivariant` fails with TS2344 in the same run." |
| `packages/concierge/src/types.ts:505-506` | "Its only symptom is one unused suppression directive in the type-test suite — the kind of thing a reviewer 'fixes' by deleting the test." | "Its symptoms are one unused suppression directive and, since plan 02-11, a TS2344 on `_policyNotBivariant`." |

**They were deliberately left alone.** The plan forbids editing both files in prose (*"Do not edit
`actions.test-d.ts`. Do not edit `src/types.ts`."*) and backs that with
`git diff --exit-code packages/concierge/test-d/actions.test-d.ts packages/concierge/src/types.ts`
as an acceptance criterion in **two** separate tasks, plus a repo-wide `git diff --exit-code` in
Task 3. `files_modified` lists three files and none of these is one of them. Editing them would trade
a documented staleness for three failed gates, and `src/types.ts`'s doc comment ships in
`dist/index.d.ts`, so touching it would perturb the artifact two concurrent worktrees are measuring.

This is the plan's own instruction — *record the measurement and flag the divergence rather than
adjusting to fit* — applied to a must-have rather than a number. Filed below for 02-12, which is a
three-sentence edit in a plan that may legitimately open both files.

**2. [Recorded] P8's gate command cannot support the specificity the plan's prose claims.** Full
treatment above. The verbatim form was run for the acceptance record; a corrected form was run for
the evidence; both are reported. No file was changed — `scripts.test` belongs to plan 02-09's scope
this wave, and `02-VALIDATION.md` to 02-12's.

**3. [Recorded] P9's verify block asserts on TTY-conditioned output.** Full treatment above. Run
verbatim under a pty rather than modified. No file was changed.

Nothing else deviated. Three tasks, three files, the prescribed placement, the prescribed skeleton,
the prescribed import path, the prescribed patterns.

## Verification

Both `<verify><automated>` blocks and the Task 3 block were run verbatim.

| Block | Result |
|---|---|
| Task 1 — `typecheck && grep index.js && grep -cE '^import .*types.js' == 0 && grep results.test-d.ts && no exports` | **`EXPORTS_GUARD_OK`** |
| Task 2 — `typecheck && grep _policyNotBivariant && directives == 2 && no 'single symptom' && git diff --exit-code` | **`M9_DETECTOR_OK`** |
| Task 3 — P9 harness + `PASS` + `TS2344` + `_policyNotBivariant` + `git diff --exit-code` | **`P9_PROVEN`** (under a pty — see above) |

Plan-level `<verification>` block on the final tree:

| Check | Result |
|---|---|
| `pnpm --filter @fullselfbrowsing/concierge typecheck` with both new files | **0** (0.45 s wall) |
| `exports.test-d.ts` has `import … from "../src/index.js"` | **1** occurrence |
| `grep -cE '^import .*\.\./src/types\.js' exports.test-d.ts` | **0** |
| header still names `results.test-d.ts` as the blind guard | **yes** |
| `grep -c '@ts-expect-error' actions.test-d.ts` | **2**, unchanged |
| `git diff --exit-code actions.test-d.ts src/types.ts` | **0** |
| `consent.test-d.ts` contains `single symptom` | **no** (repo-wide: 0) |
| `consent.test-d.ts` names `_policyNotBivariant` / `consent-variance.test-d.ts` / "be invented" | **1 / 1 / 1** |
| `git diff --stat consent.test-d.ts` | **+7 / −4**, one paragraph |
| P8: `BUILD_EXIT=0`, `ARTIFACT_EXIT` non-zero, TS1485 in `exports.test-d.ts`, `results.test-d.ts` absent | **all four** |
| P9: TS2344 naming `_policyNotBivariant` + TS2578 on `_policyDegraded` | **both, one run** |
| `pnpm typecheck` | **0** |
| `pnpm build` (attw + publint clean, `dist/index.js` back to 9.74 kB) | **0** |
| `pnpm test` | **0** — `Test Files 3 passed (3)`, `Tests 12 passed (12)` |
| `pnpm run check:deps` | **0** |
| `pnpm run check:artifact` | **0** |
| `git diff --exit-code` | **0** |
| `git status --porcelain` | **empty** |

Acceptance-criteria spot checks:

| Criterion | Measured |
|---|---|
| `grep -c '^[[:space:]]*export'` in each new file | **0 / 0** |
| `grep -c '@ts-expect-error'` in each new file | **0 / 0** |
| `_messageBoundExportedAsValue` on a single line, with a `/** … */` comment | **line 59**, yes |
| `_policyNotBivariant` on a single line, with a `/** … */` comment | **line 76**, yes |
| predicate is exactly `Expect<Not<Assignable<ConsentPolicy<Booking>, ConsentPolicy<unknown>>>>` | **yes** |
| `tsconfig.test-d.json` unchanged | `git diff --exit-code` **0** |
| `results.test-d.ts` unchanged | `git diff --exit-code` **0** |
| `pnpm test` reports the same number of test **files** as before | **3 before, 3 after** (Vitest's default `test.include` does not match `*.test-d.ts`) |
| export surface, re-measured on this tree | **45 names, 39 types + 6 values, 1 block** |

### The export-surface number, measured rather than copied

Parsed from the freshly built `dist/index.d.ts`: **1** trailing `export { … }` block, **45** names,
**39** type-prefixed and **6** plain. Identical to 02-06's and 02-07's 45, and it confirms
02-VALIDATION.md's `42/43` figures are stale by exactly the −1 delta 02-07 recorded. Nothing in this
plan changes the surface.

## Tree hygiene

`git status --porcelain` immediately before writing this SUMMARY is **empty** and `git diff` is
clean. Every mutation was applied and restored inside a single `mutate-and-prove.sh` invocation —
four invocations in total (P8a, P8b, P9 terse, P9 pretty, plus the pty re-run of the plan's verbatim
block), each ending `PASS: gate fired (exit 1), tree clean` with the harness's own post-condition
assertion. The P8 pattern and replacement were staged in a `mktemp -d` **outside the repo** and
`rm -rf`'d afterwards; nothing was written under `packages/`. `dist/` was rebuilt after the mutants
because the harness restores sources, not build output, and is back to 9.74 kB.

No `git clean`, `git stash`, or blanket checkout was run at any point. `git reset --hard` was run
exactly once, at agent start, as the mandated worktree-base correction to `71d680b`. The one install
was `CI=true pnpm install --frozen-lockfile --prefer-offline` to bootstrap the fresh worktree;
`pnpm-lock.yaml` is byte-unchanged. No `concierge-treeshake-*` directory remains under `/tmp` or
`TMPDIR`.

## Requirements status

`requirements-completed` is deliberately **empty** and `.planning/REQUIREMENTS.md` was not touched,
following 02-05's, 02-06's and 02-07's precedent.

The plan's frontmatter names **PKG-01** — *"Published packages pass `publint` and
`are-the-types-wrong` with no errors."* This plan neither delivers nor advances it; it adds two
type-test guards. Both gates were re-run green here (`pnpm build` runs attw and publint inline,
`pnpm run check:artifact` runs `publint --strict` and `attw --profile esm-only`), and P8 produced a
finding relevant to PKG-01's *scope*: **attw and publint are both silent on a value export erased
from the artifact.** They validate the manifest and the types-resolution graph, not the runtime
export list. PKG-01 remains correctly worded; the gap it does not cover is now covered by
`artifact.test.ts` and `exports.test-d.ts` together.

Closing PKG-01 belongs to 02-12, alongside PKG-04 and PKG-05.

## Issues Encountered

**1. Two stale M9 claims remain in forbidden files.** Diagnosed by a repo-wide grep for three
phrasings rather than the one the acceptance criterion names, recorded above with exact file:line and
replacement wording, deliberately not fixed. This is the only gap between the plan's must-haves and
what shipped, and it is a documentation gap in two files, not a coverage gap — both detectors exist
and both were observed firing.

**2. The plan's P9 verify block is TTY-conditioned.** Diagnosed rather than accommodated: the same
mutation was re-run through the harness with `--pretty` to establish that the echoed source text is
real, then the plan's block was run byte-for-byte under `script -q /dev/null` and printed
`P9_PROVEN`. No assertion was weakened and no identifier was renamed.

**3. P8's verbatim gate measures the whole suite.** 02-07's `--` finding, hit again exactly where it
predicted. Both forms run, both reported.

## Deferred Items

| Item | Detail | Suggested owner |
|---|---|---|
| Correct M9's "sole detector" / "only symptom" claims | `actions.test-d.ts:147` and `:153-155`, and `src/types.ts:505-506`. Exact replacement wording is in *Deviations* above. Both files were forbidden to this plan by prose **and** by a `git diff --exit-code` acceptance criterion in two tasks. | 02-12, or any Phase 3+ plan that legitimately opens both |
| Mark P8 and P9 observed in `02-VALIDATION.md`, and correct its `42/43` figures | Both rows now have measured diagnostics with file:line. The `42/43` pair predates `contract.ts`; the invariant is the −1 delta, `45 → 44` today. | 02-12 |
| `pnpm test -- <name>` in `02-VALIDATION.md` and `ci.yml` | 02-07's item, re-confirmed here: the `--` form ran 3 files where 1 was intended. One character each. | 02-10 / 02-12 |
| `/* @__PURE__ */` on `types.ts`'s three `Object.freeze` initializers | 02-06's and 02-07's item. **Not done here** — `src/types.ts` is forbidden to this plan and is not in `files_modified`, notwithstanding 02-06's suggestion that 02-11 might own it. | a Phase 3 plan that opens `types.ts` |
| Vitest `typecheck.include`'s default now matches **six** `test-d/*.test-d.ts` files, not four | Harmless while typecheck mode is off, which `vitest.config.ts` documents and enforces. Any future plan enabling it must narrow `typecheck.include` away from `test-d/`. | not scheduled — accepted |

## Known Stubs

None. Both new files contain a real predicate that was observed **green on the correct tree and red
under a deliberate regression**, with the exact diagnostic measured in research. There is no
placeholder, no `TODO`, no vacuous assertion, and no skipped check. Neither file exports anything, so
neither can drift into being imported and quietly relied upon.

## Threat Model Outcomes

| Threat | Disposition | Evidence |
|---|---|---|
| T-02-55 a value export silently erased from the published artifact | **mitigated, and the silence measured** | `exports.test-d.ts` reads `../src/index.js`. P8: TS1485 at `exports.test-d.ts(52,10)` while `BUILD_EXIT=0` — tsdown, **attw and publint all reported no problems** on a build that shipped `dist/index.js` without the binding. The `types.js`-based guard stayed green in the same run and is named in exactly zero diagnostics. |
| T-02-56 `snapshotEquality` regressed to bivariant parameters | **mitigated** | `_policyNotBivariant` fails with TS2344 at `consent-variance.test-d.ts:76:35`, echoed source carrying the alias name. The seam is how the consent kernel decides the payload the human confirmed is the payload about to run; a bivariant comparator admits one written for a different snapshot type. |
| T-02-57 a guard whose only symptom is an unused directive | **mitigated** | The named predicate was added **alongside** the directive, not instead of it. P9 produced `Found 2 errors in 2 files` — TS2344 on `_policyNotBivariant` **and** TS2578 on `_policyDegraded` — in one run. `actions.test-d.ts` is byte-unchanged at two directives. |
| T-02-58 a stale cross-reference asserting single-symptom coverage | **partially mitigated — see Deferred Items** | `consent.test-d.ts`'s claim was corrected in the same plan that made it false; `grep -rn "single symptom" packages/` returns nothing. Two equivalent claims survive in `actions.test-d.ts` and `src/types.ts`, both files forbidden to this plan by an explicit acceptance criterion. Recorded with file:line and replacement wording rather than silently left. |
| T-02-SC npm/pnpm installs | **accepted, and held** | This plan installed nothing, added no dependency edge, and touched no manifest or lockfile. `pnpm-lock.yaml` byte-unchanged; `check:deps` re-run green. |

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access and no schema at a trust
boundary. It adds two compile-time-only files that emit nothing, export nothing, and are excluded
from the package's `files` array (`dist`, `src`, `README.md`, `LICENSE`).

## User Setup Required

None.

## Next Phase Readiness

1. **Both Phase 1 test-coverage deferrals are closed**, each with its diagnostic observed rather than
   asserted. `STATE.md` § Deferred Items rows 1 and 2 can be marked done by the orchestrator.
2. **`actions.test-d.ts:147/153-155` and `src/types.ts:505-506` still tell the old story.** Three
   sentences, wording supplied above. This plan was forbidden to touch either file.
3. **P8 and P9 have measured signatures for `02-VALIDATION.md`:** TS1485 at
   `exports.test-d.ts(52,10)` with `BUILD_EXIT=0`; TS2344 at `consent-variance.test-d.ts:76:35` plus
   TS2578 at `actions.test-d.ts:162:3`.
4. **Do not grep typecheck output for an alias name in CI.** `tsc`'s `pretty` is off without a TTY.
   Grep the `file:line` instead — it is present in both modes.
5. **The 45-name count guard does not see P8.** A *moved* export preserves the total (split goes
   39/6 → 40/5); only a *dropped* one changes it. Do not consolidate `export-surface.test.ts`'s four
   assertions into the count.
6. **attw and publint are silent on an erased runtime export.** Worth stating in any PKG-01 write-up:
   they validate the manifest and the types graph, not the runtime export list.
7. **The export surface is 45 names in 1 block**, re-measured on this tree. `dist/index.js` is
   9.74 kB, unchanged — this plan added no source code.

## Self-Check: PASSED

Files claimed created/modified, verified present on disk:

- `packages/concierge/test-d/exports.test-d.ts` — FOUND, 59 lines; `from "../src/index.js"` ×1;
  `^import .*\.\./src/types\.js` ×0; `^[[:space:]]*export` ×0; `@ts-expect-error` ×0;
  `_messageBoundExportedAsValue` on line 59
- `packages/concierge/test-d/consent-variance.test-d.ts` — FOUND, 76 lines;
  `Not<Assignable<ConsentPolicy<Booking>, ConsentPolicy<unknown>>>` ×1 on line 76;
  `^[[:space:]]*export` ×0; `@ts-expect-error` ×0
- `packages/concierge/test-d/consent.test-d.ts` — FOUND, 408 lines; `single symptom` ×0;
  `_policyNotBivariant` ×1; `consent-variance.test-d.ts` ×1; "be invented" ×1
- `.planning/phases/02-packaging-build-and-release/02-11-SUMMARY.md` — FOUND

Commits claimed, verified in `git log`:

- `0d9a9e8` — FOUND (`test(02-11): MESSAGE_MAX_CHARS export-placement guard reading the entrypoint`)
- `feb1b8a` — FOUND (`test(02-11): the named M9 detector, and the cross-reference it makes false`)

`git diff --name-status 71d680b..HEAD` lists **exactly three** files before this SUMMARY commit —
`A test-d/consent-variance.test-d.ts`, `M test-d/consent.test-d.ts`, `A test-d/exports.test-d.ts` —
all three inside this plan's declared `files_modified`. No `src/`, no `package.json`, no
`pnpm-lock.yaml`, no `pnpm-workspace.yaml`, no `scripts/`, no `tsconfig*.json`, and no `STATE.md`,
`ROADMAP.md` or `REQUIREMENTS.md` appears. No commit in this plan contains a deletion
(`git diff --diff-filter=D` empty across the range).

---
*Phase: 02-packaging-build-and-release*
*Completed: 2026-07-29*
