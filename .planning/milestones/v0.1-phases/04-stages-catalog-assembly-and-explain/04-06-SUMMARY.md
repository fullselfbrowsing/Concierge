---
phase: 04-stages-catalog-assembly-and-explain
plan: 06
subsystem: testing
tags: [type-level, test-d, readonly, sensitivity-probe, PKG-04, STG-03, STG-04, SEC-03, DX-01]

# Dependency graph
requires:
  - plan: 04-01
    provides: "`Explanation`, `StageExplanation`, `Concierge.explain`, readonly `EmittedTool`, and the `_emittedToolMembersAreReadonly` identifier its doc comment names"
  - plan: 04-03
    provides: "`createConcierge(config: ConciergeConfig): Concierge` exported from the barrel, and the transitive reach to `assertSingleInstance` through `buildCatalog`"
provides:
  - "`test-d/concierge.test-d.ts` — nine `Equals` predicates plus four compile-or-fail STG-03 declarations"
  - "M-04-14's expected red, measured: exit 1, TS2339 at `test-d/concierge.test-d.ts(148,59)` AND TS2353 at `src/concierge.ts(698,44)`"
  - "F5 in `test/single-instance.test.ts` — the contract guard's second production call site"
  - "The route Phase 4 took to the guard, written into the suite header rather than left to inference"
affects: [04-07, 04-08, 05-bridges, 06-dispatch, 07-session-and-transport]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A type pin never observed red is indistinguishable from one that cannot fail — every predicate that guards a modifier was proved by deliberate regression, asserted on exit code plus `file:line`"
    - "Record the measured diagnostic CODE when it is not the file's usual one: M-04-14 fires as TS2339 at the indexed access, never as TS2344 at the assertion"
    - "Restoration of a transient source probe is verified by SHA-256, not by eye"

key-files:
  created:
    - packages/concierge/test-d/concierge.test-d.ts
  modified:
    - packages/concierge/test/single-instance.test.ts

key-decisions:
  - "Every modifier and signature pin is `Equals`, never `Assignable` — an `Assignable` spelling stays green under precisely the regression worth guarding, measured one level down at `catalog.test-d.ts:300-301`"
  - "`_createConciergeIsNotGeneric` was NOT written as a second predicate — `Equals` against the non-generic signature was measured `true` today and `false` against a `<const C extends ConciergeConfig>` form, so one predicate covers both claims"
  - "The header's annotate-nothing rule was adapted rather than copied verbatim, because one const below IS annotated and the annotation IS its assertion (`actions.test-d.ts:442`'s shape)"
  - "F5's header paragraph refers to the case as `F5,` rather than `F5 ` so the plan's instruction and its `grep -c 'F5 '` arithmetic both hold"

requirements-completed: [STG-03, STG-04, SEC-03, DX-01]

# Metrics
duration: ~25min
completed: 2026-07-30
---

# Phase 4 Plan 06: Type-Level Pins and the Guard's Second Call Site Summary

**Nine `Equals` predicates that go red on widening rather than green on it, four STG-03 shapes whose compilation is the assertion, and F5 — with the two central pins observed RED under deliberate regression before being accepted green.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files:** 1 created, 1 modified — exactly the two the plan names

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1 | `test-d/concierge.test-d.ts` — the readonly pin, the signature pins, STG-03's shapes | `e786094` | test |
| 2 | F5 in `test/single-instance.test.ts` — `createConcierge`'s reach to the contract guard | `2e935aa` | test |

---

## Required Output — the predicate list, the sensitivity observations, F5's query string

### 1. Every predicate, its spelling, and what it guards

All line numbers are against the committed `packages/concierge/test-d/concierge.test-d.ts`.

| Line | Predicate | Spelling | What it guards |
|---|---|---|---|
| 122 | `_emittedToolMembersAreReadonly` | **`Equals`** | The four `EmittedTool` modifiers. `ReadonlyArray<EmittedTool>` protects the array and says nothing about the elements; this is the only detector, because the runtime freeze throws either way. |
| 125 | `_explanationMembersAreReadonly` | **`Equals`** | `Explanation`'s three modifiers — the type-level half of `explain()`'s deep freeze. |
| 128 | `_stageExplanationMembersAreReadonly` | **`Equals`** | The rows inside `Explanation.stages`, which line 125 does not reach — the identical array-vs-element gap `EmittedTool` had. |
| 135 | `_explanationHasExactlyThreeFields` | **`Equals`** on `keyof` | The field count. A fourth field goes red here, so it must be a decision rather than a drive-by (D-04). |
| 138 | `_explanationStageIsNullableString` | **`Equals`** | One spelling of "no stage" across `Concierge.stageFor`, `Session.stage()` and here. |
| 141 | `_stageExplanationBridgeShape` | **`Equals`** | `{readonly id; readonly registered} \| null` — the shape Phase 5 must not have to change. |
| 148 | `_conciergeExplainSignature` | **`Equals`** | `Concierge["explain"]` against silent widening. **M-04-14's detector in this file.** |
| 151 | `_createConciergeSignature` | **`Equals`** | `createConcierge`'s signature **and** its non-genericity, in one line — see §3. |
| 154 | `_catalogForReturnsReadonlyArray` | **`Equals`** | STG-04's compile-time companion; widening to `EmittedTool[]` would offer `push` on a frozen array. |

**Every one is `Equals`, and not one is `Assignable`.** For the three modifier pins the reason is
`catalog.test-d.ts:300-301`'s measured argument transferred one level down: readonly property
modifiers do not affect assignability, so an `Assignable` spelling stays green with **every**
modifier deleted. For the three signature/shape pins it is `actions.test-d.ts:469-476`'s: an
`Assignable` spelling stays true when a field is widened to `unknown`, to a bare function type, or
to a union that swallows the declared type.

**STG-03's four shapes** (lines 175, 178, 181, 184/187) are declarations, not predicates — they go
red by failing to compile, which is the correct mechanism for an admits-this-shape claim. `_m1` is
the URL-only contrast; `_m2` (bracket access) and `_m3` (**dot** access on the index signature)
mention no `pathname` at all and are the requirement. `_plainStageLiteral.match({pathname, tenantId,
role})` is the extra-keys call, made from an object-literal position so excess-property checking
applies.

### 2. Sensitivity observation A — the readonly pin, OBSERVED RED

Probe: delete the `readonly` from `EmittedTool.name` in `src/types.ts`. Run against the final
committed file (re-run after the header edit shifted line numbers, so the values below are true of
the committed tree).

```
EXIT=1
test-d/concierge.test-d.ts(122,46): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```

- **Exit code: 1** (not 2), as the terse-output caveat predicts for `tsc` diagnostics under 7.0.2.
- **`file:line`: `test-d/concierge.test-d.ts:122`** — exactly `_emittedToolMembersAreReadonly`'s line.
- **It was the ONLY diagnostic in the repository.** Nothing in `src/`, nothing in any other
  `test-d/` file, nothing in the build. That is the "only detector" claim, measured rather than
  asserted.
- **No alias name appears in the output**, confirming the caveat: assert on exit code plus
  `file:line`, never on a name grep.

Restored; `pnpm typecheck` back to exit 0 and `src/types.ts` verified byte-identical by SHA-256.

### 3. Sensitivity observation B — M-04-14, and YES, this file appears

Probe: delete `explain: (ctx: StageContext) => Explanation;` from `src/types.ts` (the literal 04-01
records, occurrence count 1). Also run against the final committed file.

```
EXIT=1
src/concierge.ts(698,44):           error TS2353: Object literal may only specify known properties, and 'explain' does not exist in type 'Concierge'.
test-d/concierge.test-d.ts(148,59): error TS2339: Property 'explain' does not exist on type 'Concierge'.
```

**`packages/concierge/test-d/concierge.test-d.ts` DOES appear among the diagnostics — not only
`src/concierge.ts`.** 04-07 can assert on both files. No predicate needs to change.

**One finding 04-07 must not trip over: the diagnostic is TS2339, at the indexed access — NOT the
TS2344-at-the-assertion form every other predicate in this file fails with.** The program stops
resolving `Concierge["explain"]` before the `Expect<…>` constraint is ever evaluated, so the failure
never reaches `Type 'false' does not satisfy the constraint 'true'`. This is the same trap
`exports.test-d.ts:32-42` records for its own TS1485 case, where it warns that "a reader expecting
TS2344 will read the wrong line and conclude the file is fine". It is now written into
`concierge.test-d.ts`'s own header with both diagnostics quoted verbatim.

Restored; `pnpm typecheck` back to exit 0, `src/types.ts` verified byte-identical by SHA-256.

### 4. F5 — query string and sensitivity observation

**Query string: `?sc6=1`.** Verified unused before the edit (count 0) and appearing exactly once
after (`grep -F -o -- '?sc6=1' … | wc -l` → 1). The literal is written nowhere else, including in
comments, so the count is unambiguous. F4 uses `?sc5=1`, F1a `?dup=1`, F2 `?mismatch=1`.

**Sensitivity, both directions observed:**

| State | Result |
|---|---|
| `createConcierge` stubbed to return without reaching `buildCatalog` | **F5 half two RED** — `single-instance.test.ts:267`, `expected {version: 1}`, `received undefined`. **1 failed \| 4 passed.** |
| Restored | **5 passed** |

The other four cases stayed green under the stub, which is the point: F1a/F1b/F2 call
`assertSingleInstance` themselves and F4 drives `buildCatalog` directly, so none of them can see a
`createConcierge` that stopped reaching the guard. F5 is the only case that can.

`src/concierge.ts` verified byte-identical by SHA-256 after restoration.

### 5. The header extension — which route Phase 4 actually took

`test/single-instance.test.ts`'s header block now records that the guard has **two** production call
sites, and states plainly that F5 passes whether `createConcierge` invokes `assertSingleInstance`
itself or reaches it transitively through `buildCatalog` on its first line. Either route satisfies
PKG-04; Phase 4 took the transitive one, because a second direct call is a documented no-op through
`contract.ts`'s same-version adopt path (04-03 §6 took the sentence correction rather than the second
call). This is written down so a reader does not infer a direct call that does not exist — and so
nobody "restores" one when they go looking and cannot find it.

---

## Measurements Taken In This Worktree

Every claim above was probed here before it was written. Two scratch probe files were created, run
and deleted; `git status --porcelain` was verified empty before each commit.

### The nine predicates, measured before the real file was written

A scratch `test-d/` file declared each predicate as a raw boolean and read it into a `const … : false`,
so the compiler names the TRUE ones. All nine errored — i.e. **all nine are `true`** against the
shipped declarations — and the four STG-03 shapes produced no diagnostics at all. The real file was
then written against a measured-green set rather than a hoped-for one.

### `_createConciergeIsNotGeneric` — measured, and deliberately NOT written

The plan asks for a predicate pinning that `createConcierge` did not silently gain a `const` type
parameter, and adds: *"If a plain `Equals` against the non-generic signature already fails for a
generic form, that single predicate is enough — say so rather than adding a second."* Measured:

| Subject | `Equals<…, (config: ConciergeConfig) => Concierge>` |
|---|---|
| the shipped `createConcierge` | **`true`** |
| `declare function g<const C extends ConciergeConfig>(config: C): Concierge` | **`false`** |

So `_createConciergeSignature` already fails for the generic form and **no second predicate was
added**. The measurement and the reason are recorded in that predicate's own doc comment, not only
here, so the next reader does not add the redundant line.

### Restoration verified mechanically

`shasum -a 256` of `src/types.ts` and `src/concierge.ts` was captured before the first probe and
re-checked after every restore. All three probes (two in `types.ts`, one in `concierge.ts`) came back
`OK`. `git diff -- packages/concierge/src/` is empty against both the working tree and the base
commit — checked both ways, because an empty working-tree diff alone would not catch a probe that had
been accidentally committed.

### Baseline and final

| Gate | Baseline (base `c358c77`) | Final |
|---|---|---|
| `pnpm typecheck` | exit 0 | exit 0 |
| `pnpm build` | exit 0, attw + publint clean | exit 0, attw + publint clean |
| `pnpm test` | 6 files / **60** tests | 6 files / **61** tests |
| `pnpm test single-instance` | 1 file / 4 tests | 1 file / **5** tests |
| export surface | 62 / 51 / 11 | 62 / 51 / 11 (unchanged — this plan exports nothing) |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] The header would have shipped a misleading account of M-04-14's diagnostic**

- **Found during:** Task 1, running the M-04-14 sensitivity probe rather than assuming its shape.
- **Issue:** The first draft of the header said only that `_conciergeExplainSignature`'s "indexed
  access `Concierge["explain"]` stops resolving". Measured, the diagnostic is **TS2339 at the
  indexed access**, not the **TS2344 at the assertion** that the file's own terse-output block
  teaches a reader to expect from every other predicate in it. `exports.test-d.ts:32-42` spends ten
  lines on exactly this hazard for its own TS1485 case and states the consequence outright: *"A
  reader expecting TS2344 will read the wrong line and conclude the file is fine."* This file had
  the same trap and did not say so, and 04-07 runs this mutant through the harness — a plan that
  greps for TS2344, or reads for the `Type 'false'` string, would conclude the pin did not fire when
  it did.
- **Fix:** the header now quotes **both** diagnostics verbatim with their `file:line` and codes, and
  states in bold that the code is TS2339 and why. Recorded as a hand-off in §3 above as well.
- **Files:** `packages/concierge/test-d/concierge.test-d.ts` · **Commit:** `e786094`
- **Verification:** both probes re-run against the final file after the header edit shifted line
  numbers, so the `(148,59)` written into the header is the number the compiler actually prints.

**2. [Rule 1 — Correctness] The header's "annotate-nothing" rule would have been false as written**

- **Found during:** Task 1, composing the house-rules block.
- **Issue:** The plan says to copy `catalog.test-d.ts`'s **export-nothing / annotate-nothing** block.
  The export-nothing half transfers unconditionally. The annotate-nothing half does not: this file
  necessarily annotates `_plainStageLiteral: StageDefinition`, because "a plain object literal is
  accepted at this type" is the whole claim — exactly as `actions.test-d.ts:442` annotates its two
  stage literals for the same reason. Copying the block verbatim would have put a statement in a
  header that the code fourteen lines below contradicts, which is the class of defect 03-08 spent a
  plan removing from this repository.
- **Fix:** the export-nothing half is copied with its full TS9010 argument. The annotate-nothing half
  is stated accurately — annotations appear **only where the annotation IS the assertion** — with
  the distinction spelled out (`catalog.test-d.ts` protects *inferred* types, this file's predicates
  read declared types by name, so there is no inference to protect) and `actions.test-d.ts:442`
  cited as the precedent. Annotated in place rather than silently dropped, per house style.
- **Files:** `packages/concierge/test-d/concierge.test-d.ts` · **Commit:** `e786094`

**3. [Rule 3 — Blocking] Two STG-03 matchers would have been unread locals**

- **Issue:** `_m2` and `_m3` exist to prove `StageContext` admits bracket and dot access on
  non-`pathname` keys. Nothing reads them, and `noUnusedLocals` is not enabled, so they would have
  compiled silently as dead code — one refactor away from being deleted by someone tidying up, which
  would remove STG-03's two load-bearing shapes while leaving the file green.
- **Fix:** one line, `_stg03ShapesAreLive`, calls both with contexts carrying no `pathname` and ties
  them to a value. The doc comment says why. This is additive and asserts nothing new; it only stops
  the two shapes from reading as dead.
- **Files:** `packages/concierge/test-d/concierge.test-d.ts` · **Commit:** `e786094`

### Plan arithmetic that was checked rather than assumed

The plan requires `grep -c 'F5 '` to return **1** while also mandating a header paragraph naming F5
and its route. Those two are in tension by default — `catalog.test-d.ts`'s sibling case, F4, appears
with a trailing space on four separate lines. **Both were satisfied**, without contorting the prose,
by referring to the case as `F5,` in the header ("the last case in this file, F5, is what makes ITS
removal fail something") and reserving the `F5 ` form for the `it` title. Measured: **1**. No
deviation was needed; recorded because 04-08's audit would otherwise have to re-derive why the
header reads the way it does.

**Total deviations:** 3 auto-fixed (1 missing-critical, 1 correctness, 1 blocking). No architectural
changes, no new dependencies, no package installs, no scope expansion — two files touched, exactly
the two the plan names.

---

## Issues Encountered

- **Worktree base correction at startup.** `git merge-base HEAD c358c77` returned `e4e353f`, which
  was HEAD — the worktree was checked out *behind* the expected wave-3 base rather than diverged from
  it. Reset to `c358c77` per the startup protocol before any read; the reset discarded nothing, since
  HEAD was an ancestor. This is the third consecutive plan in this phase to hit it (04-01 and 04-03
  both record the same shape), so it is a property of how these worktrees are created, not an
  accident.
- **`pnpm typecheck` swallows the exit code.** `pnpm -r typecheck` runs through the workspace
  recursion, and piping it (`| grep`) reports the pipe's status, not `tsc`'s. Every sensitivity
  observation in §2 and §3 was therefore taken by invoking `node_modules/.bin/tsc -p
  tsconfig.test-d.json` directly from `packages/concierge`, which is the binary the script wraps.
  04-07's harness should do the same, or it will read exit 0 from a red typecheck.
- **The header edit moved the line numbers the header itself cites.** Correcting the M-04-14 account
  added 13 lines above `_conciergeExplainSignature`, invalidating the `(134,59)` first measured. Both
  probes were re-run against the final file and the header corrected to `(148,59)`. A `file:line`
  written into the same file it describes needs one confirming re-run after the last edit, or it
  ships stale.

## Known Stubs

None. This plan adds no runtime code and no `src/` change of any kind — it adds assertions only. The
only stub in this phase's surface remains 04-03's deliberate `dispatch`, which is unchanged and out
of scope here.

## Threat Flags

None. This plan opens no network endpoint, no auth path and no file access pattern, and changes no
schema at a trust boundary. Every `mitigate` disposition in the plan's register was discharged:

| Threat | Verification |
|---|---|
| T-04-08 (tampering with `EmittedTool` element fields) | `_emittedToolMembersAreReadonly` in the `Equals` spelling, **observed red** under one deleted modifier: exit 1, `test-d/concierge.test-d.ts(122,46)`, sole diagnostic in the repo |
| T-04-22 (silent widening of `Concierge["explain"]` / `createConcierge`) | Both `Equals`, never `Assignable`; the non-genericity claim measured true-then-false rather than assumed |
| T-04-23 (`StageContext` narrowed to pathname-only) | Four shapes compile-or-fail; the two that matter carry no `pathname` |
| T-04-10 (two independently-resolved copies of core) | F5 asserts both directions through the existing global-registry observable; proved sensitive by stubbing the factory |
| T-04-20 (a type pin that cannot go red) | Both central pins observed under deliberate regression, asserted on exit code plus `file:line`, never on a name grep |
| T-04-SC (supply chain) | Nothing installed; `pnpm-lock.yaml` byte-identical; `pnpm install` run without `--frozen-lockfile` and left the file untouched |

## Verification

| Gate | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm build` | exit 0 (attw + publint clean) |
| `pnpm test` | exit 0 — **6 files / 61 tests** (baseline 60, +1 for F5) |
| `pnpm test single-instance` | exit 0 — 1 file / 5 tests |
| `grep -rn 'vi\.' packages/concierge/test/` | **0 matches** — the observable is the global registry record, not a spy |
| `git diff -- packages/concierge/src/` | **empty**, against both the working tree and base `c358c77` |
| `git diff --stat -- pnpm-lock.yaml` | empty |
| `git status --porcelain` | empty |

Task 1's acceptance greps, all met: `@ts-expect-error` **0**; `^export ` **0**; `from "../src/index.js"`
**1**; `from "../dist/` **0**; `Equals<EmittedTool, Readonly<EmittedTool>>` **1**; `wc -l` **190**
(floor 90); no `type _` or `const _` declaration wraps to a second line.

Task 2's acceptance greps, all met: `F5 ` **1**; `createConcierge` **7** (floor 3); `?sc6=1` **1**;
`vi\.` **0**.

## Notes for Later Plans

- **04-07 (the mutation battery).** M-04-14 fires in **two** files — `src/concierge.ts(698,44)`
  TS2353 and `test-d/concierge.test-d.ts(148,59)` **TS2339**. Assert on exit code plus `file:line`.
  Do **not** grep for `Type 'false' does not satisfy the constraint 'true'` for this mutant; that
  string does not appear, because the indexed access fails before the constraint is evaluated. Also:
  invoke `tsc` directly rather than through `pnpm -r typecheck` if the exit code is being read
  through a pipe.
- **04-08 (the phase gate).** This plan changed no `src/` file and moved no export count; the surface
  is still 62/51/11. SEC-03's type half is now closed at the `EmittedTool` element level, but
  04-03's T-04-07 carve-out still stands and must travel with any "SEC-03 closed" claim — the
  consumer-supplied `jsonSchema` getter channel is measured open and out of scope.
- **Phase 5 (bridges).** `_stageExplanationBridgeShape` pins
  `{readonly id: string; readonly registered: boolean} | null`. It is pinned with `Equals`, so
  changing that shape goes red at `concierge.test-d.ts:141` rather than passing quietly. 04-01 chose
  it precisely so Phase 5 would not have to change it; if Phase 5 finds it must, that is a signal to
  re-read 04-01's rejected alternatives before editing the line.
- **Phase 6 (dispatch).** `_explanationHasExactlyThreeFields` will go red on any fourth
  `Explanation` field. That is deliberate — it forces a decision rather than a drive-by. Move the
  line; do not relax the predicate to `Assignable`.

## User Setup Required

None — no external service configuration required.

## Self-Check: PASSED

- `packages/concierge/test-d/concierge.test-d.ts` — FOUND (created, 190 lines)
- `packages/concierge/test/single-instance.test.ts` — FOUND (modified, +47 lines)
- Commit `e786094` — FOUND in `git log`
- Commit `2e935aa` — FOUND in `git log`
- `git diff --name-only c358c77..HEAD` — exactly the two files above, no more
- `git diff -- packages/concierge/src/` — empty (all three transient probes restored, SHA-256 verified)
- `packages/concierge/test/concierge.test.ts` (04-05's file) — NOT modified
- `packages/concierge/test-d/catalog.test-d.ts` (04-04's file, holds the pinned-red `_inlineDefineActionLosesTheUnion`) — NOT modified
- `STATE.md` / `ROADMAP.md` — **NOT** modified (orchestrator owns them for this wave)
- `pnpm-lock.yaml` — byte-identical to the base commit

---
*Phase: 04-stages-catalog-assembly-and-explain*
*Completed: 2026-07-30*
