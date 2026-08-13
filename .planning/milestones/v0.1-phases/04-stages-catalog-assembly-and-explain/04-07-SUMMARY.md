---
phase: 04-stages-catalog-assembly-and-explain
plan: 07
subsystem: testing
tags: [mutation-testing, CAT-03, STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01, harness]

# Dependency graph
requires:
  - plan: 04-02
    provides: "the CAT-03 post-pass and its four trap literals in `src/catalog.ts`"
  - plan: 04-03
    provides: "`src/concierge.ts`, its single-occurrence literal inventory, and the two verbatim `warnStage` statements"
  - plan: 04-04
    provides: "the C-series (C23…C26) and the measurement that branch-swapping is not a viable mutation target"
  - plan: 04-05
    provides: "the S-series (S1…S26) and the finding that S13 does not detect the element freeze"
  - plan: 04-06
    provides: "`test-d/concierge.test-d.ts`, and M-04-14's measured TS2339-not-TS2344 diagnostic shape"
provides:
  - "Sixteen observed mutants — every rule this phase added now has a test observed to go red when the rule is removed"
  - "Every PASS confirmed from the gate's own output to have COMPILED and RUN tests; zero vacuous PASSes recorded as proofs"
  - "The working-literal record for the six rows whose obvious spelling does not work, written into `test/concierge.test.ts`"
  - "A NEWLY OBSERVED second face of the vacuous-PASS hazard: a gate wrapper that reports the wrong status inverts the result the OTHER way"
  - "M-04-9's measurement that `pnpm test catalog` selects exactly 1 file / 26 tests — the fact that makes M-04-11's full-suite gate necessary"
affects: [04-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Re-take every occurrence count unfiltered against the tree being mutated — counts recorded at plan time are from a different tree"
    - "A harness PASS is not a proof until the gate's own output has been read for a build line and a test count"
    - "Capture a gate's exit status immediately and never through a pipe — an intervening `echo` inverts the result the other way"

key-files:
  created: []
  modified:
    - packages/concierge/test/concierge.test.ts

key-decisions:
  - "M-04-14 was run twice — once with `tsc` invoked directly (the phase's mandated form) and once with the plan's stated `pnpm typecheck` gate — because whether the plan's own gate is safe is a fact the next reader needs"
  - "Task 1 produces no tracked-file change by design and is committed with `--allow-empty`, its evidence in the message, rather than silently having no commit"
  - "The newly-observed exit-code-inversion is written into the test file alongside the vacuous-PASS note — it is the same hazard's other face and was observed here, not theorised"

requirements-completed: [CAT-03, STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01]

# Metrics
duration: ~40min
completed: 2026-07-30
---

# Phase 4 Plan 07: The Sixteen-Mutant Battery Summary

**Sixteen mutants run against the final tree with every occurrence count re-taken unfiltered here, every PASS confirmed from the gate's own output to have compiled and run tests, and the six literals that do not work as research wrote them recorded where the next person will look.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2
- **Files:** 0 created, 1 modified — comment-only, no assertion touched
- **Source files mutated and restored:** 3 (`concierge.ts` 12×, `catalog.ts` 3×, `types.ts` 2×), all verified by SHA-256

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1 | The twelve `src/concierge.ts` mutants | `13614a0` | test (`--allow-empty` — see Deviation 1) |
| 2 | The four `src/catalog.ts` / `src/types.ts` mutants, plus the respelling block | `e8ad91a` | test |

Neither commit deleted a tracked file (`git diff --diff-filter=D` empty on both).

---

## The sixteen rows, as one table

Every count in the "count" column was taken **on this tree**, with `grep -F -o -- '<literal>' <file> | wc -l`, **comments included**. Not one was inherited. Every count printed exactly **1**; no row was run with a non-unique literal, and no grep was narrowed to make a count come out right.

Every gate command is recorded verbatim. **No row uses the `pnpm test -- <fragment>` form.**

| # | File | Literal | Count | Replacement | Gate | Harness exit | Case(s) that went red | Compiled & ran tests |
|---|---|---|---|---|---|---|---|---|
| M-04-1 | `src/concierge.ts` | `Object.freeze(projected)` | **1** | `projected` | `pnpm build && pnpm test test/concierge` | **0 (PASS)** | S11 (1 failed / 24 passed, 25 ran) | **YES** — `Build complete in 54ms`, attw + publint clean |
| M-04-16 | `src/concierge.ts` | `Object.freeze(tool)` | **1** | `(tool)` | `pnpm build && pnpm test test/concierge` | **0 (PASS)** | S12 **and** S14 (2 failed / 23 passed, 25 ran) | **YES** — `Build complete in 55ms` |
| M-04-2 | `src/concierge.ts` | `memo ??= new Map` | **1** | `memo = new Map` | `pnpm build && pnpm test test/concierge` | **0 (PASS)** | S7, S8, S9 (3 failed / 22 passed, 25 ran) | **YES** — `Build complete in 52ms` |
| M-04-3 | `src/concierge.ts` | `memo.set(index, built);` | **1** | `;` | `pnpm build && pnpm test test/concierge` | **0 (PASS)** | S7, S8, S9 (3 failed / 22 passed, 25 ran) | **YES** — `Build complete in 53ms` |
| M-04-4 | `src/concierge.ts` | `for (const [index, stage] of stages.entries())` | **1** | `for (const [index, stage] of [...stages.entries()].reverse())` | `pnpm build && pnpm test test/concierge` | **0 (PASS)** | S4, S5, S24, S25 (4 failed / 21 passed, 25 ran) | **YES** — `Build complete in 53ms` |
| M-04-5 | `src/concierge.ts` | `result === true` | **1** | `result !== false` | `pnpm build && pnpm test test/concierge` | **0 (PASS)** | S25 (1 failed / 24 passed, 25 ran) | **YES** — `Build complete in 73ms` |
| M-04-6 | `src/concierge.ts` | the complete `catch`-branch `return warnStage(…);` statement (see below) | **1** | `      throw new Error(stage.id);` | `pnpm build && pnpm test test/concierge` | **0 (PASS)** | S17, S24 (2 failed / 23 passed, 25 ran) | **YES** — `Build complete in 53ms` |
| M-04-7 | `src/concierge.ts` | `index === null ? crossNames` | **1** | `index === null ? []` | `pnpm build && pnpm test test/concierge` | **0 (PASS)** | S2, S8 (2 failed / 23 passed, 25 ran) | **YES** — `Build complete in 53ms` |
| M-04-8 | `src/concierge.ts` | `...crossNames]` | **1** | `]` | `pnpm build && pnpm test test/concierge` | **0 (PASS)** | S1, S6, S10, S11, S18, S24 (6 failed / 19 passed, 25 ran) | **YES** — `Build complete in 59ms` |
| M-04-12 | `src/concierge.ts` | `const firstMatch: number = rows.findIndex((row) => row.matched);` | **1** | `const firstMatch: number = rows.map((row) => row.matched).lastIndexOf(true);` | `pnpm build && pnpm test test/concierge` | **0 (PASS)** | S19 (1 failed / 24 passed, 25 ran) | **YES** — `Build complete in 54ms` |
| M-04-13 | `src/concierge.ts` | `deepFreeze(` | **1** | `Object.freeze(` | `pnpm build && pnpm test test/concierge` | **0 (PASS)** | S21 (1 failed / 24 passed, 25 ran) | **YES** — `Build complete in 55ms` |
| M-04-15 | `src/concierge.ts` | `warnHost(duplicateStageIdMessage(stage.id));` | **1** | `void duplicateStageIdMessage(stage.id);` | `pnpm build && pnpm test test/concierge` | **0 (PASS)** | S26 (1 failed / 24 passed, 25 ran) | **YES** — `Build complete in 53ms` |
| M-04-9 | `src/catalog.ts` | `!seenNames.has(requires)` | **1** | `false` | `pnpm build && pnpm test catalog` | **0 (PASS)** | C23, C26 (2 failed / 24 passed, **26 ran**) | **YES** — `Build complete in 56ms` |
| M-04-10 | `src/catalog.ts` | `requires === action.name` | **1** | `false` | `pnpm build && pnpm test catalog` | **0 (PASS)** | C24 (1 failed / 25 passed, 26 ran) | **YES** — `Build complete in 54ms` |
| M-04-11 | `src/catalog.ts` | `!seenNames.has(requires)` | **1** | `!new Set<string>().has(requires)` | `pnpm build && pnpm test` (**FULL**) | **0 (PASS)** | **C25 AND S10** (2 files failed / 5 passed; 2 failed / 84 passed, **86 ran**) | **YES** — `Build complete in 54ms` |
| M-04-14 | `src/types.ts` | `explain: (ctx: StageContext) => Explanation;` | **1** | *(empty — line deleted)* | `tsc -p tsconfig.test-d.json` (invoked directly) | **0 (PASS)** | `tsc` **exit 1**, two diagnostics — see §M-04-14 | **YES** — `tsc` ran and emitted diagnostics; this row is typecheck-gated, so "tests ran" reads as "the compiler ran and produced the expected diagnostics" |

**Sixteen rows. Sixteen PASSes. Zero vacuous PASSes. Zero unrunnable rows.**

Every one of the twelve `test/concierge` rows ran the full 25-case file, and every one of the two `catalog` rows ran the full 26-case file — so no PASS is a build failure wearing a pass. The build line was read out of every gate's own output, not assumed.

### Trap literals — re-measured on this tree, and confirmed as traps

| Literal | File | Count | Consequence if used bare |
|---|---|---|---|
| `Object.freeze(` | `src/concierge.ts` | **4** | Mutates whichever occurrence comes first (the tool seal), silently proving something other than the intended claim |
| `return warnStage(` | `src/concierge.ts` | **2** | Mutates the `catch` branch when the non-boolean branch was meant, or vice versa |
| `duplicate_action_name` | `src/catalog.ts` | **2** | — |
| `action.consent` | `src/catalog.ts` | **2** | — |
| `consent_target_missing` | `src/catalog.ts` | **2** | — |
| `consent_self_reference` | `src/catalog.ts` | **2** | — |

`Object.freeze(` occurs exactly **1** time in `src/catalog.ts` — measured, not assumed — which is why the trap is new to `src/concierge.ts` and why nothing in the Phase 3 battery warns about it.

---

## The respelling rationales, verbatim

Four were named by the plan; two more (M-04-16, M-04-6) belong to the same family and are recorded identically. All six are now in `test/concierge.test.ts`.

**M-04-1** was written as the bare `Object.freeze(`, which occurs **four** times in the shipped file: `Object.freeze(tool)`, `Object.freeze(toolByName)`, `Object.freeze(projected)`, and `DISPATCH_NOT_IMPLEMENTED`'s `/* @__PURE__ */ Object.freeze({ … })` at module scope. `src/catalog.ts` has exactly one, so the trap is new to this file. 04-03 was required to write the three assembly freezes as three textually distinct single-occurrence statements precisely so M-04-1 and M-04-16 each have a unique literal — `Object.freeze(tool)` is not a substring of `Object.freeze(toolByName)`, so neither is invalidated by the fourth occurrence. If a later refactor inlines them, both mutants become unrunnable. **Re-measured here: `grep -F -o -- 'Object.freeze(' packages/concierge/src/concierge.ts | wc -l` prints 4.**

**M-04-16** is the element-level seal, split out of M-04-1's original single claim because the two seals are separate statements and each needs its own proof. Measured here and matching 04-05 exactly: under `Object.freeze(tool)` → `(tool)`, **S12 and S14 go red and S13 stays GREEN.** That is correct and is easy to misread — `parameters` is deep-frozen by `buildCatalog` independently of the tool's own seal, so S13 detects the freeze *beneath* `parameters`, S12 detects the seal itself, and S14 detects that elements are shared rather than rebuilt. Three cases, three distinct claims. S11 also stays green, because the projection's own seal is a separate statement (M-04-1's).

**M-04-4** requires `resolveIndex` and `explain` to use **distinct loop spellings**. That is a constraint on the SOURCE, not on the test. 04-03 shipped `for (const [index, stage] of stages.entries())` in `resolveIndex` and `stages.map(...)` in `explain`; unifying them is a mutation regression, not a tidy-up. A third spelling, `for (const stage of stages)` (the duplicate-id scan, count **1**), is textually distinct from both.

**M-04-6** was written as the bare `return warnStage(`, which occurs **twice** in `runMatch` — the `catch` branch and the non-boolean branch. The literal is therefore the complete one-line `return` statement from the `catch` branch, recorded verbatim in `04-03-SUMMARY.md` §2 and re-measured here at count **1**. The non-boolean branch's statement also counts **1** and was confirmed textually distinct by string comparison, not by eye. Rewording either to match the other makes this row unrunnable.

**M-04-7** was written as `id === null ? crossNames`, against the **superseded id-keyed memo**. The shipped memo is keyed by the resolved stage's array index, so the literal is `index === null ? crossNames`.

**M-04-12** was written as `matched && active === null`, against a `for…of` accumulation `explain` does not use. The shipped `explain` maps every stage to a row and derives the active index from the recorded rows, so the mutatable literal is the `firstMatch` derivation.

---

## M-04-11 — the row whose whole value is the full-suite gate

**Both** halves went red, which is the claim the row exists to make:

```
 × S10 — a review action requiring a cross-stage confirm action builds clean
 × C25 — a FORWARD reference builds clean, so the check reads the COMPLETE name set
 Test Files  2 failed | 5 passed (7)
      Tests  2 failed | 84 passed (86)
```

- **C25** (`test/catalog.test.ts`) — the forward-reference clean-build case.
- **S10** (`test/concierge.test.ts`) — the cross-stage-target clean-build case.

**A `pnpm test catalog` gate would have missed exactly half of it, and that is measured rather than inferred:** M-04-9 and M-04-10 both ran under `pnpm test catalog` and each selected **1 file / 26 tests**. `test/concierge.test.ts` is not in that selection, so S10 could not have fired there. The full-suite gate is load-bearing.

M-04-9, which mutates the *same literal* to a constant `false`, kills C23 and C26 but **not** C25 — so it proves the branch exists, not that it reads the complete set. The two rows are not redundant.

---

## M-04-14 — the diagnostics, in full

Gate (the phase-mandated form, `tsc` invoked directly so no wrapper can swallow the status):

```
cd packages/concierge && node_modules/.bin/tsc -p tsconfig.test-d.json
```

Full output:

```
src/concierge.ts(698,44): error TS2353: Object literal may only specify known properties, and 'explain' does not exist in type 'Concierge'.
test-d/concierge.test-d.ts(148,59): error TS2339: Property 'explain' does not exist on type 'Concierge'.
=== tsc EXIT CODE: 1 ===
PASS: gate fired (exit 1), tree clean
```

- **`tsc` exit code: 1**, not 2 — the seventh re-derivation of this in the repository.
- **Files named in the diagnostics:** `src/concierge.ts` **and** `test-d/concierge.test-d.ts`.
- **`packages/concierge/test-d/concierge.test-d.ts` IS among them — stated explicitly, because the plan requires it either way.** The row therefore proves the type-level pin (`_conciergeExplainSignature`, at line 148) and not only that the source stopped compiling. No predicate needs to change.
- **The string `Type 'false' does not satisfy the constraint 'true'` appears 0 times**, exactly as 04-06 measured. The diagnostic is **TS2339 at the indexed access**, not the TS2344-at-the-assertion form every other predicate in that file fails with. A run that greps for TS2344 would conclude the pin did not fire when it did.

**Supplementary measurement — the plan's stated `pnpm typecheck` gate also works, provided it is not piped.** Run as a second harness invocation of the same mutant:

```
packages/concierge typecheck: src/concierge.ts(698,44): error TS2353: …
packages/concierge typecheck: test-d/concierge.test-d.ts(148,59): error TS2339: …
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @fullselfbrowsing/concierge@0.0.0 typecheck
Exit status 1
[ELIFECYCLE] Command failed with exit code 1.
PASS: gate fired (exit 1), tree clean
```

Harness exit **0**, both diagnostics preserved through `pnpm -r`. 04-06's warning is about **piping** `pnpm -r typecheck`, and the harness does not pipe — it runs the gate as a direct child. Recorded so 04-08 does not have to re-derive which of the two forms is safe: **both are, unpiped; neither is, piped.**

---

## The behaviours with no single-literal mutant — confirmed present, not added

The plan says not to re-add 04-05's header note, and to confirm it is there. **It is present**, at `test/concierge.test.ts:74-95`, under the divider *"Two behaviours have no single-literal mutant — stated rather than faked"*:

- **(a) rename-independence** (STG-02, S5) — a property of the data structure, not of a branch. Producing it needs a multi-line rewrite to key by id.
- **(b) the element-sharing invariant** (SEC-03, S13 + S14) — building fresh elements per projection is a restructuring, not a literal swap.

`grep -c 'no single-literal mutant'` returns **2** (the divider and one in-body cross-reference at line 390 of the pre-edit file). Nothing was added for this; nothing was needed.

**No third such behaviour was found.** All sixteen rows ran. Every rule this phase added has an observed mutant.

---

## What the file now records

One comment block, added at the end of the header's mutation material (immediately after the existing M-04-4 block), in `catalog.test.ts:473-484`'s register. Comment-only — **no assertion was touched, and the file still holds 25 `it` blocks.**

| Check | Value | Required |
|---|---|---|
| `grep -c 'M-04-'` | **11** (was 5) | ≥ 4 |
| `grep -c 'no single-literal mutant'` | **2** | ≥ 1 |
| `grep -rn 'vi\.' packages/concierge/test/` | **0** | 0 |
| `grep -ci 'sideEffects\|tree-shak\|treeshake'` | **0** | 0 |
| non-comment lines containing `../src/` | **0** | 0 |
| `grep -c 'pnpm test -- '` | **0** | 0 |
| `wc -l` | **1249** (was 1158, +91) | — |
| `it` blocks | **25** (unchanged) | unchanged |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Task 1 produces no tracked-file change, so it has no ordinary commit**

- **Found during:** Task 1 close.
- **Issue:** Task 1's `<files>` names `test/concierge.test.ts`, but its action text only writes to that file *"if any row cannot be made to run"* — and all twelve ran. The comment block is explicitly Task 2's Part two. The harness restores its target on every row, so Task 1's tree delta is provably zero. `git commit` with nothing staged fails, and silently skipping the commit would erase the task boundary from history.
- **Fix:** committed with `--allow-empty`, with the twelve rows' literals, replacements, exit codes and red cases in the message body, and the message stating plainly that no file changed and why. The evidence is in git rather than only in this summary.
- **Files:** none · **Commit:** `13614a0`

**2. [Rule 2 — Missing Critical] A second face of the vacuous-PASS hazard, observed here rather than theorised**

- **Found during:** Task 2, the first M-04-14 run.
- **Issue:** The gate wrapper read its exit status through `${PIPESTATUS[0]}` **after an intervening `echo`**, so it reported the echo's status (0) rather than `tsc`'s (1). The harness read 0 and printed **`FAIL: gate did NOT fire — mutant escaped`** — while the output directly above it showed both expected diagnostics. This is the vacuous-PASS hazard's mirror image: the harness reporting the inverse of the truth in the *other* direction, and it is arguably more dangerous, because a FAIL reads as "this rule has no test" and invites someone to weaken or delete the assertion.
- **Fix:** the wrapper captures `$?` immediately; the row was re-run and reported PASS with `tsc` exit 1. Because this is a real, observed defect of the same family the plan asks to be written down, it is recorded in the test file's block next to the vacuous-PASS note — a battery runner who knows only about vacuous PASSes will still be caught by this one. **No result was recorded from the bad run.**
- **Files:** `packages/concierge/test/concierge.test.ts` · **Commit:** `e8ad91a`

**3. [Rule 2 — Missing Critical] M-04-14 was run under both gate forms, not just one**

- **Issue:** The plan's table names `pnpm typecheck` as M-04-14's gate; the phase's critical constraints mandate invoking `tsc` directly because `pnpm -r typecheck` was measured to swallow the exit code. Running only one leaves the next reader unable to tell whether the plan's own gate is safe.
- **Fix:** both were run. Direct `tsc` is the recorded row; `pnpm typecheck` is recorded as a supplementary measurement and also passes. The distinction — piped versus unpiped — is now written down instead of being a folk rule.
- **Files:** none (measurement only)

### Recorded, not fixed — a numbering discrepancy between plans

`04-04-SUMMARY.md` records **M-04-09** as `declared.push(action);` in `src/catalog.ts`. `04-07-PLAN.md`'s table assigns M-04-9 to `!seenNames.has(requires)` → `false`. **This plan's table is what was executed**, since it is the plan under execution. The literal `declared.push(action);` still counts **1** in `src/catalog.ts` and remains available; it was not run, because the plan does not name it. Recorded so 04-08 does not read the mismatch as a missing row — the count is sixteen either way, and the rule `declared.push(action);` would test (that the post-pass iterates the declared set at all) is already covered from the other side by M-04-9 and M-04-11.

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing-critical), 1 cross-plan discrepancy recorded. No architectural change, no dependency, no package install, no assertion weakened, no source change.

---

## Issues Encountered

- **Worktree base correction at startup.** `git merge-base HEAD 10458c3` returned `e4e353f`, which *was* HEAD — the worktree was checked out **behind** the expected wave-4 base rather than diverged from it. Reset to `10458c3` per the startup protocol before any read; the reset discarded nothing, since HEAD was an ancestor. **This is the fifth consecutive plan in this phase to record the same shape** (04-01, 04-03, 04-05 and 04-06 all did), so it is a property of how these worktrees are created rather than an accident.
- **`pnpm install` was required first** — the worktree is a fresh checkout with no `node_modules`. Run without `--frozen-lockfile` and without `CI=true`; `pnpm-lock.yaml` came back byte-identical. Installed **before** the first mutant so that no gate could trigger an install mid-battery. `pnpm config get verify-deps-before-run` reads `undefined` on this tree and no gate triggered an install — `git status --porcelain` was checked empty after every one of the seventeen harness runs.
- **`packages/concierge/node_modules/.bin/tsc` does not exist** — pnpm's workspace layout puts the binary at the repo root, so the phase's mandated direct invocation is `<repo-root>/node_modules/.bin/tsc -p tsconfig.test-d.json` run from `packages/concierge`. A literal reading of "invoke `node_modules/.bin/tsc`" from the package directory exits **127**, which is neither of the harness's meaningful codes.
- **The exit-code inversion described in Deviation 2.** Worth repeating outside the deviation list: the harness printed `FAIL: gate did NOT fire — mutant escaped` for a mutant that had visibly produced two compiler diagnostics on the lines immediately above. Reading the gate's output is what caught it; the exit code alone would have produced a false negative in the summary.

## Known Stubs

None. This plan adds no runtime code and no assertion — one comment block and nothing else. The only stub in this phase's surface remains 04-03's deliberate `dispatch`, unchanged and out of scope here.

## Threat Flags

None. This plan opens no network endpoint, no auth path and no file access pattern, and changes no schema at a trust boundary. Every `mitigate` disposition in the plan's register was discharged:

| Threat | Verification |
|---|---|
| T-04-20 (a validation rule with no observed mutant) | Sixteen rows, all PASS, each with a named red case. The two behaviours with no single-literal mutant are in the file's header, confirmed present. **No third was found.** |
| T-04-24 (a vacuous PASS from a mutant that did not compile) | Every one of the fifteen test-gated rows shows a `Build complete` line **and** a full test count (25, 26 or 86) in its own output. Zero rows ran zero tests. M-04-14 is typecheck-gated and shows `tsc` running and emitting its two expected diagnostics. |
| T-04-25 (a mutant that silently edits a doc comment) | All twenty pre-flight counts re-taken unfiltered **on this tree**, comments included. Six trap literals measured at their non-unique counts and none used bare. |
| T-04-26 (an unrestored source file leaking into the phase gate) | `git status --porcelain` checked empty after every harness run; `git diff -- packages/concierge/src/` empty; all three source checksums identical before and after — and `concierge.ts`'s matches the value 04-05 independently recorded. |
| T-04-SC (supply chain) | Nothing installed beyond restoring the lockfile's own contents; `pnpm-lock.yaml` byte-identical; no new dependency. |

## Verification

| Gate | Result |
|---|---|
| `pnpm build` | exit 0 (attw + publint clean) |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0 — **7 files / 86 tests** (baseline unchanged; this plan adds no case) |
| `tsc -p tsconfig.test-d.json` (direct) | exit 0 |
| `git status --porcelain` | empty |
| `git diff -- packages/concierge/src/` | **empty** |
| `git diff --stat -- pnpm-lock.yaml` | **empty** — byte-identical |
| `shasum -a 256 src/concierge.ts` | `56c24f88…438deb` — identical to 04-05's recorded value |
| `shasum -a 256 src/catalog.ts` | `0cd4a768…d67298` — identical before and after the battery |
| `shasum -a 256 src/types.ts` | `a134478e…31e03d` — identical before and after the battery |
| `git diff --name-only 10458c3..HEAD` | one file: `packages/concierge/test/concierge.test.ts` (plus this summary) |
| `.planning/STATE.md`, `.planning/ROADMAP.md` | **NOT** modified — the orchestrator owns them |

## Notes for Later Plans

- **04-08 (the phase gate).** Every mutant literal in this phase is now verified runnable **on the tree 04-08 will gate**. If 04-08 re-runs any row, re-take the count first: the counts above are true of commit `e8ad91a` and of nothing else. Two facts that will save a re-derivation: `pnpm test catalog` selects **1 file / 26 tests** (so it cannot see S10), and both `tsc` directly and `pnpm typecheck` propagate exit 1 **when unpiped**.
- **04-08, on SEC-03.** This battery does not change 04-03's T-04-07 carve-out. M-04-16 proves the element seal fires; it says nothing about a getter inside a consumer-supplied `jsonSchema`, which remains measured-open and out of scope. Any "SEC-03 closed" statement must still carry S15's carve-out.
- **Anyone re-running the battery.** Read `test/concierge.test.ts`'s header block *"The battery's WORKING literals"* before typing a literal from `04-RESEARCH.md`. Six of the sixteen do not work as research wrote them, and two of the six fail by mutating the wrong occurrence rather than by failing loudly.
- **A standing rule this plan re-confirmed.** A harness exit code is not a result. Both of its failure modes were seen in this phase — a PASS that ran zero tests (Phase 3, twice) and a FAIL that ran a gate which really did fire (here, once). Read the output.

## User Setup Required

None.

## Self-Check: PASSED

- `packages/concierge/test/concierge.test.ts` — FOUND (modified, 1249 lines, +91, comment-only)
- `.planning/phases/04-stages-catalog-assembly-and-explain/04-07-SUMMARY.md` — FOUND (this file)
- Commit `13614a0` — FOUND in `git log`
- Commit `e8ad91a` — FOUND in `git log`
- `git diff -- packages/concierge/src/` — empty; all three source checksums verified identical
- `pnpm-lock.yaml` — byte-identical to the base commit
- `.planning/STATE.md`, `.planning/ROADMAP.md` — NOT modified
- No file deleted by either commit (`git diff --diff-filter=D` empty on both)
- Sixteen rows recorded in one table; zero rows reported as passed that were not run

---
*Phase: 04-stages-catalog-assembly-and-explain*
*Completed: 2026-07-30*
