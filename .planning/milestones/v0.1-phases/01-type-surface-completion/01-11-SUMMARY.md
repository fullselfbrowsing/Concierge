---
phase: 01-type-surface-completion
plan: 11
subsystem: types
tags: [typescript, generics, type-defaults, variance, bridge, type-tests, mutation-testing]

# Dependency graph
requires:
  - phase: 01-10
    provides: the readonly consent surface this plan sits on top of and must not disturb
  - phase: 01-09
    provides: the four-file type-test suite the bridge coverage is added to
provides:
  - Bridge's two type parameters defaulted to the top of their own constraints, so a bridge with real members satisfies B extends Bridge
  - ConciergeConfig.stages erased to ReadonlyArray<StageDefinition<any>>, letting unrelated concrete-bridge stages collect into one config with no cast
  - one spelling per meaning across types.ts — B is a type parameter, Bridge is the exported interface
  - seven new named predicates and fixtures covering the bridge surface the suite had never instantiated
affects: [phase-5-bridge-registry, phase-8-consent-kernel, phase-4-catalog, phase-2-mutation-harness, 01-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A generic default must be the top of its own constraint; the bottom admits nothing and is the defect, not the placeholder"
    - "Variance-affected type parameters are erased with `any` at collection sites only, never on the individual declaration — AnyActionDefinition is the precedent and stages now follows it"
    - "A nullability assertion must never instantiate the parameter as `null`, the one argument that makes the union unobservable"

key-files:
  created:
    - .planning/phases/01-type-surface-completion/01-11-SUMMARY.md
  modified:
    - packages/concierge/src/types.ts
    - packages/concierge/test-d/actions.test-d.ts

key-decisions:
  - "The Bridge doc comment states the rule without ever spelling the defective literal, because `grep -c 'Record<string, never>' == 0` is an acceptance criterion and a doc comment quoting the old form would fail it while looking harmless"
  - "defineAction's type parameter in actions.test-d.ts renamed Bridge -> B, not in the plan's three-declaration list, because Task 3 imports the Bridge interface into that file and would otherwise recreate IN-02's shadow in the very file that proves it gone"
  - "_canonicalObjectArgBridge added beyond the plan's required aliases so the literal `applyFilter({key, value})` spelling from CLAUDE.md is pinned, not only the review's positional transcription of it"
  - "Ctx re-pointed at a locally-declared PlainBridge rather than ResultsBridge, keeping ActionDefinition's deliberately unconstrained third parameter exercised as unconstrained"

patterns-established:
  - "Before/after proof of a critical finding: compile the identical program against the base commit's src and the fixed src in two throwaway sandboxes, and report both exit codes"

requirements-completed: [SC-7]

# Metrics
duration: 35min
completed: 2026-07-28
---

# Phase 01 Plan 11: Bridge Type-Parameter Defaults and the Coverage That Was Missing Summary

**`Bridge`'s two type parameters now default to the top of each constraint instead of the bottom, so a bridge carrying a real action and a real snapshot getter satisfies `B extends Bridge` for the first time — the project's own canonical `applyFilter({key, value})` example goes from 4 × TS2344 + 2 × TS2375 to exit 0 on the identical program — with the collection site erased, the shadowing parameter renamed, and seven new predicates each observed red.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-28T21:12Z
- **Completed:** 2026-07-28T21:47Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- **CR-02 closed on both halves.** The defaults were the *bottom* of each constraint — a record whose value type is `never`, which requires every property it has to be `never` — so no bridge with a real member was assignable to the bare `Bridge` that `BridgeRegistry<B extends Bridge = Bridge>` and `StageDefinition<B extends Bridge = Bridge>` constrain against. Both defaults are now the top. The second, independent half — `ConciergeConfig.stages` collecting at the defaulted `B`, which no default width can repair because `B` reaches a contravariant position through `AnyActionDefinition<B>`'s handler — is closed by the same `any`-erasure D-07 already settled for `Snapshot` and `AckPayload`.
- **The headline claim is now a compiled program, measured both ways.** The identical canonical example compiles at **exit 0, zero diagnostics** against the fixed `src/`, and at **exit 2 with 4 × TS2344 + 2 × TS2375** against the base commit's `src/`. Both runs are reproduced verbatim below.
- **IN-02 closed.** `ActionHandler`, `ActionDefinition`, and `AnyActionDefinition` no longer bind a type parameter named `Bridge`. `grep -cE '^\s*Bridge(,| =)'` on `types.ts` returns **0**.
- **WR-03 closed on both sides.** `_handlerBridge` was instantiated at `null` — the single type argument for which `B | null` collapses to `null` — so it asserted `Equals<Ctx["bridge"], null>` and was blind to the union its own doc comment claimed to guard. It is now pinned against a bridge type that is not itself `null`, and `_registryReadIsNullable` adds the registry half, which had no assertion anywhere in the suite.
- **Four mutations, all observed red, none guessed.** MUT-K and MUT-L each produced **exactly one** diagnostic, confirming their guards are the sole detectors.
- **Zero edits to any pre-existing assertion.** `_handlerArgs` and `_handlerAck` are byte-identical and green; the only test line rewritten is `_handlerBridge`, which the plan required.
- **Plan 01-10's work is intact.** The `readonly` count on non-comment lines of `types.ts` is **26**, exactly the figure `01-10-SUMMARY.md` recorded.

## Task Commits

1. **Task 1: Default each Bridge parameter to the top of its constraint and erase B at the collection site (CR-02)** — `bedff00` (fix)
2. **Task 2: Rename the shadowing type parameter Bridge to B (IN-02)** — `30fbdcf` (refactor)
3. **Task 3: Add the bridge coverage the suite never had, defect-first (CR-02 coverage, WR-03)** — `be92a55` (test)

## Files Created/Modified

- `packages/concierge/src/types.ts` — `Bridge`'s two defaults changed from the bottom to the top of their constraints; `ConciergeConfig.stages` retyped `ReadonlyArray<StageDefinition<any>>`; type parameter `Bridge` renamed `B` in `ActionHandler`, `ActionDefinition`, and `AnyActionDefinition`; three doc comments written or extended (the defaults rule, the erasure rationale, the naming convention). **+94 / −6.**
- `packages/concierge/test-d/actions.test-d.ts` — 354 → **476 lines**. Adds `ResultsBridge`, `CartBridge`, `_realBridgeSatisfiesConstraint`, `_canonicalObjectArgBridge`, `_registryReadIsNullable`, `resultsRegistry`, `cartRegistry`, `_resultsStage`, `_cartStage`, `_multiBridgeConfig`, `PlainBridge`; re-points `Ctx`; rewrites `_handlerBridge`; renames `defineAction`'s `Bridge` parameter to `B`; extends the file header.

`crossStage` was not touched — it is already erased in `Bridge` by `AnyActionDefinition`'s own default, and `git diff` contains no hunk reaching it.

## Mutation Battery — four mutations, all observed red

Every row was applied, observed, and restored **inside a single Bash tool call**, with an explicit no-op assertion (`git diff --quiet … && FATAL`) before trusting any result, and `git diff --exit-code -- packages/concierge/src/types.ts` after. `TREE_CLEAN` printed on all four.

| Mutation | Exit | Observed codes | Guard aliases echoed on the offending source lines |
|---|---|---|---|
| **MUT-C-SRC** — revert both `Bridge` defaults to the bottom of each constraint | 2 | **7 × TS2344** | `:350` `_realBridgeSatisfiesConstraint`, `:353` `_canonicalObjectArgBridge`, `:364` `_registryReadIsNullable`, `:366` `resultsRegistry`, `:367` `cartRegistry`, `:370` `_resultsStage`, `:373` `_cartStage` |
| **MUT-C2-SRC** — revert only `ConciergeConfig.stages` to the defaulted `B`, defaults left fixed | 2 | **2 × TS2375** | `:391` `_multiBridgeConfig` (twice — one per array element, cols 56 and 71) |
| **MUT-K** — `ActionHandler` `bridge: B \| null` → `bridge: B` | 2 | **exactly 1 × TS2344** | `:251` `_handlerBridge` |
| **MUT-L** — `BridgeRegistry` `read: () => B \| null` → `() => B` | 2 | **exactly 1 × TS2344** | `:364` `_registryReadIsNullable` |

`MUT-C-SRC` and `MUT-C2-SRC` are **reversions** — they put the defect back and must go red. They are deliberately *not* the unsuffixed `MUT-C` of `01-REVIEW.md`, which is a positive that must **compile** and which plan 01-15 re-runs at exit 0.

### Verbatim diagnostics

`MUT-C-SRC`, the two `Expect` predicates (`tsc --pretty`, ANSI stripped):

```
test-d/actions.test-d.ts:350:46 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
350 type _realBridgeSatisfiesConstraint = Expect<Assignable<ResultsBridge, Bridge>>;
```

`MUT-C-SRC`, the constraint failures that follow from it:

```
test-d/actions.test-d.ts:366:47 - error TS2344: Type 'ResultsBridge' does not satisfy the constraint
  'Bridge<Record<string, never>, Record<string, never>>'.
  Type '{ applyFilter: (key: string, value: string) => void; }' is not assignable to type 'Record<string, never>'.
    Property 'applyFilter' is incompatible with index signature.
      Type '(key: string, value: string) => void' is not assignable to type 'never'.
366 declare const resultsRegistry: BridgeRegistry<ResultsBridge>;
```

`MUT-C2-SRC` — note the defaults are *correct* in this run, which is the point: widening a parameter never repairs a contravariant position.

```
test-d/actions.test-d.ts(391,56): error TS2375: Type 'StageDefinition<ResultsBridge>' is not assignable to type
  'StageDefinition<Bridge<Record<string, (...args: never[]) => unknown>, Record<string, () => unknown>>>'
  with 'exactOptionalPropertyTypes: true'.
```

`MUT-K` and `MUT-L`, each the sole diagnostic in its run:

```
test-d/actions.test-d.ts(251,30): error TS2344: Type 'false' does not satisfy the constraint 'true'.
251 type _handlerBridge = Expect<Equals<Ctx["bridge"], PlainBridge | null>>;

test-d/actions.test-d.ts(364,39): error TS2344: Type 'false' does not satisfy the constraint 'true'.
364 type _registryReadIsNullable = Expect<Equals<BridgeRegistry<ResultsBridge>["read"], () => ResultsBridge | null>>;
```

### Guard → mutation mapping

| Guard | Covered by |
|---|---|
| `_realBridgeSatisfiesConstraint` | MUT-C-SRC |
| `_canonicalObjectArgBridge` | MUT-C-SRC |
| `_resultsStage` / `_cartStage` / `resultsRegistry` / `cartRegistry` | MUT-C-SRC |
| `_multiBridgeConfig` | MUT-C2-SRC |
| `_handlerBridge` | MUT-K |
| `_registryReadIsNullable` | MUT-L **and** MUT-C-SRC |

All four guards named in the plan's success criteria — `_realBridgeSatisfiesConstraint`, `_multiBridgeConfig`, `_handlerBridge`, `_registryReadIsNullable` — appear in a row with an observed diagnostic. `_registryReadIsNullable` is covered twice, and the pair is informative rather than redundant: MUT-C-SRC trips it on the *constraint* (`ResultsBridge` no longer satisfies `Bridge`) and MUT-L trips it on the *union* (`| null` removed), so the single predicate is shown to see both axes.

**Working tree after the battery** — `git status --porcelain` output, reproduced in full:

```
```

(empty — no mutation left applied, no untracked file created)

## The canonical example, measured before and after

Two throwaway sandboxes under `/tmp` (`gsd-0111-canonical`, seeded by `cp -RL` from the fixed `src/`; `gsd-0111-canonical-pre`, seeded by `git show 11ae210:packages/concierge/src/*.ts`), both removed afterward. The worktree was asserted clean with `git status --porcelain` before, between, and after; neither sandbox ever wrote into it. Both carry the **identical** probe file and the **identical** tsconfig — the repo's exact flags including `isolatedDeclarations` and `exactOptionalPropertyTypes` — so the only variable is `src/types.ts`.

The probe is the project's own description compiled end to end: a `ResultsBridge` exposing `applyFilter` and `visibleCount`, the object-argument spelling `applyFilter({key, value})` beside it, a registry per bridge, a component *actually registering* a bridge object, a handler reading `registry.read()` through a `null` check, a stage per bridge, and both stages collected into one `ConciergeConfig`. **No `as` anywhere.**

| Against | Exit | Diagnostics |
|---|---|---|
| Base commit `11ae210` (pre-fix) | **2** | **4 × TS2344 + 2 × TS2375** |
| This plan's `src/` (post-fix) | **0** | **none** |

The pre-fix failures, verbatim and complete:

```
canonical.ts(32,40): error TS2344: Type 'ResultsBridge' does not satisfy the constraint 'Bridge<Record<string, never>, Record<string, never>>'.
canonical.ts(33,43): error TS2344: Type 'ResultsBridgeObjectArg' does not satisfy the constraint 'Bridge<Record<string, never>, Record<string, never>>'.
canonical.ts(60,30): error TS2344: Type 'ResultsBridge' does not satisfy the constraint 'Bridge<Record<string, never>, Record<string, never>>'.
canonical.ts(67,33): error TS2344: Type 'ResultsBridgeObjectArg' does not satisfy the constraint 'Bridge<Record<string, never>, Record<string, never>>'.
canonical.ts(76,48): error TS2375: Type 'StageDefinition<ResultsBridge>' is not assignable to type 'StageDefinition<Bridge<Record<string, never>, Record<string, never>>>' with 'exactOptionalPropertyTypes: true'.
canonical.ts(76,55): error TS2375: Type 'StageDefinition<ResultsBridgeObjectArg>' is not assignable to type 'StageDefinition<Bridge<Record<string, never>, Record<string, never>>>' with 'exactOptionalPropertyTypes: true'.
```

Post-fix the same file produces **`CANONICAL_EXAMPLE_EXIT=0` and no output at all**. The four TS2344s are the defaults defect and the two TS2375s are the collection-site defect, which is the clearest available evidence that CR-02 really was two independent halves rather than one bug reported twice.

## Decisions Made

- **The `Bridge` doc comment describes the defective form without ever spelling it.** `grep -c 'Record<string, never>' packages/concierge/src/types.ts == 0` is an acceptance criterion, and it does not distinguish a live default from a doc comment quoting one. Writing "these parameters used to default to a record whose value type was `never`" keeps the warning legible and the criterion honest. Worth flagging for the next author: the natural, careful thing to write here is the thing that fails the gate.
- **`defineAction`'s type parameter in the test file was renamed `Bridge` → `B`, and that is outside the plan's three-declaration list.** Task 3 imports the `Bridge` *interface* into `actions.test-d.ts` for the first time, and `defineAction` binds a parameter of that exact name — so leaving it would have recreated IN-02's shadow inside the one file whose job is to prove the shadow is gone, directly contradicting the plan's own must-have ("the exported interface `Bridge` is never shadowed by a type parameter of the same name"). Mechanical, zero assignability change, three call sites unaffected. Recorded as a deviation below.
- **`_canonicalObjectArgBridge` added beyond the required aliases.** The plan gives two spellings of the canonical example: `applyFilter(key: string, value: string): void` in its fixture spec, and "verbatim from `CLAUDE.md`", which is `applyFilter({key, value})` — an object argument. `01-REVIEW.md` transcribes the canonical example positionally, so the plan's fixture spec is followed exactly for `ResultsBridge`; the one extra line pins the object-argument form so the literal claim in `CLAUDE.md` is covered too rather than only its transcription. It went red under MUT-C-SRC alongside the required guard.
- **`Ctx` re-pointed at a locally-declared `PlainBridge`, not `ResultsBridge`.** Per the plan: `ActionDefinition`'s third parameter is deliberately *unconstrained*, and instantiating it with a `Bridge<…>` would quietly convert a test of the unconstrained position into a test of the constrained one. The review's own snippet names its structural type `ResultsBridge`; a different name is required here because this file now has a real `Bridge<…>` alias by that name.
- **`ActionDefinition` had no doc comment at all; one was written rather than a sentence appended.** The plan asks for "one sentence added to `ActionDefinition`'s doc comment" — there was none to add to. The new block records the naming convention and, separately, that the third parameter's unconstrained `unknown` default is deliberate and not rename debris, which is the misreading most likely to produce a "tidying" follow-up that changes behaviour.

## Deviations from Plan

### Auto-fixed / plan-mandated additions

**1. [Rule 2 — missing critical consistency] Renamed `defineAction`'s `Bridge` type parameter to `B` in `actions.test-d.ts`**

- **Found during:** Task 3
- **Issue:** Task 3 adds `import type { Bridge, BridgeRegistry } from "../src/types.js"`. `declare function defineAction<Name, Schema, Bridge = unknown, …>` binds a parameter of the same name, so the import would have been shadowed inside that declaration — reintroducing IN-02 in the file that exists to prove IN-02 is closed, and violating the plan's own must-have truth.
- **Fix:** renamed the parameter and both references in its own signature to `B`, and added a doc sentence saying why.
- **Files modified:** `packages/concierge/test-d/actions.test-d.ts`
- **Commit:** `be92a55`
- **Assignability impact:** none. The three call sites pass no explicit type arguments.

**2. [Additive coverage] `_canonicalObjectArgBridge`**

- **Found during:** Task 3, reconciling the plan's two spellings of the canonical example.
- **Rationale and result:** see "Decisions Made". One predicate, one line, observed red under MUT-C-SRC.

No other deviation. The plan's line references (`Bridge` at `:841-847`, `stages` at `:1102`, and so on) are pre-01-10 and were resolved by pattern rather than by number; see the drift report.

## Issues Encountered

- **The plan's line numbers are stale by roughly 50–80 lines**, because `01-10` added ten doc-comment blocks between them and the bridge section. Every target was located by pattern instead. No effect on the outcome; recorded so 01-15 does not re-derive it.
- **`pnpm --filter … exec tsc` reports exit 1 where the `typecheck` script reports 2.** The `--pretty` runs were therefore paired with a plain script run in the same tool call, and the exit codes in the battery table are the script's. The diagnostics are identical in both.
- Bootstrap (`pnpm install --frozen-lockfile --prefer-offline`) left `pnpm-lock.yaml` byte-identical, and the pre-edit baseline typecheck exited 0.

## Line-number drift report

Per the standing instruction to report drift rather than compensate for it. Base is `11ae210`.

| Pattern | Base | Now | Drift |
|---|---|---|---|
| `export const MESSAGE_MAX_CHARS = 180;` | 206 | 206 | **0** |
| `snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean;` | 408 | 408 | **0** |
| `export type ActionHandler<` | 303 | 303 | **0** |
| `export interface ActionDefinition<` | 762 | 786 | **+24** |
| `export type AnyActionDefinition<` | 871 | 895 | **+24** |
| `export interface Bridge<` | 893 | 944 | **+51** |
| `export interface BridgeRegistry<` | 901 | 955 | **+54** |
| `export interface StageDefinition<` | 923 | 977 | **+54** |
| `export interface ConciergeConfig {` | 1167 | 1221 | **+54** |
| `stages: ReadonlyArray<StageDefinition…>` | 1175 | 1255 | **+80** |

Both figures `01-10-SUMMARY.md` asked 01-15 to collect are **unmoved** by this plan: `MESSAGE_MAX_CHARS` sits above every edit, and the `ActionHandler` rename is net-zero lines. `+24` is `ActionDefinition`'s new doc comment, `+51 → +54` adds `Bridge`'s, and `+80` adds the `stages` erasure comment. Phase 2's harness matches by pattern and is unaffected.

## Threat Model Coverage

| Threat ID | Disposition | Status |
|---|---|---|
| T-01-42 | mitigate | **Closed.** Both defaults are the top of their constraints. Guarded by `_realBridgeSatisfiesConstraint`, `_canonicalObjectArgBridge`, and the registry/stage declarations — 7 × TS2344 observed under MUT-C-SRC. The canonical example goes exit 2 → exit 0 on the identical program. |
| T-01-43 | mitigate | **Closed.** The two-bridge assembly compiles with **zero** `as` in the file — comment-filtered check returns 0, on a file where the naive `grep ' as '` returns 4 English-prose hits. The workaround has no reason to be written. |
| T-01-49 | mitigate | **Closed.** `_handlerBridge` re-pointed off `null`; `_registryReadIsNullable` added for the registry half that had no assertion anywhere. Both previously-escaping mutations now produce **exactly one** diagnostic each. |
| T-01-59 | mitigate | **Closed.** No declaration in `types.ts` binds a type parameter named `Bridge` (`grep -cE '^\s*Bridge(,| =)'` = 0), and the convention is recorded in `ActionDefinition`'s doc comment. Sequenced after Task 1, so the file was never made to read clean over a broken constraint. Extended to `defineAction` in the test file — see Deviations. |
| T-01-51 | mitigate | **Held.** `git diff --exit-code 11ae210 HEAD -- packages/concierge/src/index.ts` exits 0. Export surface byte-identical across all three commits. |
| T-01-58 | mitigate | **Held.** Four mutations, four single-call apply/observe/restore cycles, each with a no-op assertion before it and `TREE_CLEAN` after. `git status --porcelain` empty following the battery. |
| T-01-SC | accept | **Held.** No package installed. `git diff --exit-code pnpm-lock.yaml` exits 0. |

## Known Stubs

None. This plan changes type-parameter defaults, one field's type argument, three identifiers, and adds type tests. No runtime code and no placeholder values.

## Next Phase Readiness

- **Phase 5 (bridge registry) is unblocked.** `BridgeRegistry<ResultsBridge>` and `StageDefinition<ResultsBridge>` can now be instantiated at all, which they could not before this plan. `register` / `read` / the identity-guarded unsubscriber are typed against a real bridge for the first time.
- **`01-REVIEW.md`'s unsuffixed `MUT-C` — the positive recorded as "BROKEN TODAY" — should now compile.** Plan 01-15 re-runs it and should expect **exit 0**; the sandbox run above is the same program and does. Do not conflate it with this plan's `MUT-C-SRC`, which is the reversion and must stay red.
- **Carried into Phase 8 with `AnyActionDefinition`:** `stages: ReadonlyArray<StageDefinition<any>>` is the third `any`-erasure in the file and shares the others' revisit note. Phase 8 is the first point at which the alternative's cost is measurable against a real kernel rather than predicted; revisit all three together or none.
- **WR-02 remains open** and is out of scope here — eight optional members still lack the `| undefined` widening. Non-breaking after publish, which is why it is a warning rather than a critical.

## Self-Check: PASSED

Verified after writing:

- `pnpm --filter @fullselfbrowsing/concierge typecheck` exits **0**
- `git status --porcelain` **empty** after the mutation battery and after both sandbox runs
- `git diff --exit-code pnpm-lock.yaml` exits 0 — lockfile byte-identical after `pnpm install --frozen-lockfile --prefer-offline`
- `git diff --exit-code 11ae210 HEAD -- packages/concierge/src/index.ts` exits 0
- `grep -c 'Record<string, never>' packages/concierge/src/types.ts` returns **0**
- `packages/concierge/src/types.ts` contains `stages: ReadonlyArray<StageDefinition<any>>` (line 1255); `crossStage` absent from the diff
- `grep -cE '^\s*Bridge(,| =)'` on `types.ts` returns **0**; `grep -c 'AnyActionDefinition<Bridge'` returns **0**
- `ActionDefinition`'s third parameter is still `B = unknown`, unconstrained
- No-cast check, comment-filtered form: `grep -v '^[[:space:]]*[*/]' … | grep -v '^[[:space:]]*//' | grep -cE '\bas\b'` returns **0**
- `actions.test-d.ts` is **476 lines** (min 390), exports **nothing**, and carries exactly **2** suppression directives, matching its own prose
- All five required aliases present, plus `_handlerBridge` rewritten and `_handlerArgs` / `_handlerAck` byte-identical and green
- All four mutations observed red with the diagnostic codes and counts recorded above; MUT-K and MUT-L each produced exactly one
- `readonly` count on non-comment lines of `types.ts` is **26** — identical to `01-10-SUMMARY.md`'s figure, so no `readonly` was stripped
- `git diff --name-only 11ae210 HEAD` lists exactly **two** files, both in `files_modified` — **no** change to `README.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, or `src/index.ts`

---
*Phase: 01-type-surface-completion*
*Completed: 2026-07-28*
