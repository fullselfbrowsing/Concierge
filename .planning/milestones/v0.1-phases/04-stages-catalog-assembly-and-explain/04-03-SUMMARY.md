---
phase: 04-stages-catalog-assembly-and-explain
plan: 03
subsystem: concierge
tags: [STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01, CAT-01, CAT-03, memoization, freeze, explain]

# Dependency graph
requires:
  - phase: 03-action-declaration-and-build-time-validation
    provides: "`buildCatalog`, `CatalogEntry.parameters` (already deep-frozen), `warnHost`, `assertSingleInstance`"
  - plan: 04-01
    provides: "`Explanation`, `StageExplanation`, `Concierge.explain`, readonly `EmittedTool`, `ConciergeConfig.stages` REQUIRED"
  - plan: 04-02
    provides: "`export function deepFreeze`, CAT-03's post-pass over the complete declared-name set"
provides:
  - "`createConcierge(config: ConciergeConfig): Concierge` — the package's first factory, exported from the barrel"
  - "`catalogFor(ctx)` — stage-scoped, frozen, reference-stable per resolved stage"
  - "`stageFor(ctx)` — first-match-wins over declaration order, not memoized"
  - "`explain(ctx)` — one pass, every matcher, deep-frozen, deliberately not identity-stable"
  - "`dispatch` — a stub returning `{ok:false, message}` with `reason` DELIBERATELY omitted"
  - "`Explanation` and `StageExplanation` reach the public entrypoint as type exports"
  - "export surface moved 59/49/10 -> 62/51/11, both pins and the artifact probe in one commit"
affects: [04-04, 04-05, 04-06, 04-07, 04-08, 05-bridges, 06-dispatch, 07-session-and-transport]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Memoize by the RESOLVED position, never by the caller's input — `projectFor` never sees a `ctx`, so the rule is mechanical rather than a discipline"
    - "A shallow seal over shared, already-deep-frozen elements — 510x cheaper than a recursive walk, and complete only because the two decisions are coupled"
    - "A guarded call into consumer code whose `catch` takes NO binding, inverting `json-schema.ts`'s build-time exemption for a runtime path"
    - "Anchor-then-expand: Task 1 writes every statement plus one-line `ANCHOR(T2)` markers, Task 2 expands them; `grep -c` reads 0 -> 19 -> 0, so neither half can be silently skipped"

key-files:
  created:
    - packages/concierge/src/concierge.ts
  modified:
    - packages/concierge/src/contract.ts
    - packages/concierge/src/index.ts
    - packages/concierge/test/export-surface.test.ts
    - packages/concierge/test-d/exports.test-d.ts
    - packages/concierge/test/artifact.test.ts

key-decisions:
  - "The memo and the name lookup are keyed by the resolved stage's ARRAY INDEX (`number | null`), never by id — the id-keyed form was measured to collapse and serve the wrong stage's actions"
  - "`Map` and not a null-prototype record, because the key type is `number | null`: a record cannot hold `null`, every sentinel is a legal stage id, and `String(null)` collides with a stage named `\"null\"`"
  - "One `EmittedTool` per action built at assembly and shared by reference; each projection gets a plain shallow seal, which is complete ONLY because of that sharing"
  - "`explain` evaluates every matcher in ONE pass via `stages.map`, and derives the active position from the recorded rows rather than from a second evaluation"
  - "`runMatch`'s `catch` takes no binding — the decision inverted relative to `json-schema.ts`'s two build-time catches, with the covert-channel reason written into the source"
  - "`dispatch` omits `reason` rather than picking one of the closed twelve; Phase 6's DSP-09 normalizer must REPLACE this shape, not normalize it"
  - "The returned `Concierge` object is deliberately NOT frozen, and the reason carries no seal count — the earlier count-based justification was arithmetically wrong"
  - "`contract.ts` takes the sentence correction, not a second `assertSingleInstance` call — `createConcierge` reaches the guard transitively on `buildCatalog`'s first line"
  - "ADD a `createConcierge` case to `test/artifact.test.ts` rather than record-why-not — closes the open item at `04-PATTERNS.md:1627-1652`"

requirements-completed: [STG-01, STG-02, STG-03, STG-04, DX-01, CAT-01]

# Metrics
duration: ~35min
completed: 2026-07-30
---

# Phase 4 Plan 03: `createConcierge` — Assembly, Stage Scoping, Memoized Projection and `explain` Summary

**The package's first factory: one flat catalog assembled from every stage, projected per stage behind an index-keyed instance-local memo whose arrays are frozen and reference-stable, with a single guarded matcher call that degrades honestly and echoes nothing it caught.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files:** 1 created, 5 modified — exactly the six the plan names, no more

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1 | Write `src/concierge.ts` — every statement, the file header, nineteen anchors | `af8e42e` | feat |
| 2 | Expand the nineteen anchors; correct `contract.ts`'s now-false claim | `458dae6` | docs |
| 3 | Reach `concierge.ts` from the barrel; move the surface to 62/51/11 | `7c1c11c` | feat |

---

## Required Output — everything 04-05, 04-07 and 04-08 must read from here

### 1. Mutant literals, with unfiltered occurrence counts

Measured on the final tree with `grep -F -o -- '<literal>' packages/concierge/src/concierge.ts | wc -l`,
**comments included**, per `mutate-and-prove.sh` Known Limitation 3.

| Literal | Count |
|---|---|
| `Object.freeze(projected)` | **1** |
| `Object.freeze(tool)` | **1** |
| `Object.freeze(toolByName)` | **1** |
| `memo ??= new Map` | **1** |
| `memo.set(index, built);` | **1** |
| `for (const [index, stage] of stages.entries())` | **1** |
| `result === true` | **1** |
| `index === null ? crossNames` | **1** |
| `...crossNames]` | **1** |
| `deepFreeze(` | **1** |
| `const firstMatch: number = rows.findIndex((row) => row.matched);` | **1** (M-04-12) |
| `warnHost(duplicateStageIdMessage(stage.id));` | **1** (M-04-15) |
| `for (const stage of stages)` | **1** — the duplicate-id scan, textually distinct from the resolution loop (M-04-4) |

**Counted literals, not single-occurrence:**

| Literal | Count | Note |
|---|---|---|
| `Object.freeze(` | **4** | three assembly seals plus `DISPATCH_NOT_IMPLEMENTED`'s. **Never usable bare as a mutant literal.** |
| `return warnStage(` | **2** | **Never usable bare.** Both complete statements are below. |
| `warnHost(` | **2** | `warnStage`'s composed template, and the duplicate-id call. |

### 2. The two `return warnStage(…)` statements, VERBATIM

Both are on ONE line each, deliberately, so each is a single greppable literal. `perl -0` in
`mutate-and-prove.sh` slurps, so a multi-line pattern would also match — but the acceptance
criterion is a line-based `grep -F`, and the one-line spelling satisfies both.

**M-04-6 — the `catch` branch's complete statement.** Count: **1**.

```
      return warnStage(stage.id, "its `match(ctx)` threw, so the stage was skipped and its actions are absent from the catalog for this context.", "make `match` total — it runs on every navigation, so it must not assume any field of `ctx` is present.");
```

**The non-boolean branch's complete statement** — a distinctness constraint, not a mutant target.
Count: **1**, and textually distinct from the above (verified by string comparison, not by eye).

```
      return warnStage(stage.id, "its `match(ctx)` returned a value that is neither `true` nor `false`, and a non-boolean is treated here as no match at all.", "return a real boolean — a truthy object does not match, deliberately, so compare explicitly rather than returning the value you tested.");
```

Note the em dashes and the backticks — both statements contain `—` and `` ` ``. Copy them from this
file rather than retyping.

### 3. Rendered warning messages (for 04-04 / 04-05 to assert on)

Captured from a probe against the built artifact, not transcribed from source:

```
concierge: [duplicate_stage_id] stage "same": two stages declare this id, and `stageFor()`, `Session.stage()` and `explain()` all report it, so the two are indistinguishable to a developer reading any of them. Catalog scoping is unaffected — the per-stage catalog is keyed by declaration order, not by id. Fix: give each stage a distinct id.
```

```
concierge: [stage_match] stage "boom": its `match(ctx)` threw, so the stage was skipped and its actions are absent from the catalog for this context. Fix: make `match` total — it runs on every navigation, so it must not assume any field of `ctx` is present.
```

```
concierge: [stage_match] stage "truthy": its `match(ctx)` returned a value that is neither `true` nor `false`, and a non-boolean is treated here as no match at all. Fix: return a real boolean — a truthy object does not match, deliberately, so compare explicitly rather than returning the value you tested.
```

### 4. `DISPATCH_NOT_IMPLEMENTED.message` against `MESSAGE_MAX_CHARS`

```
concierge: dispatch is not implemented in this build, which ships catalog assembly and stage scoping only.
```

Measured length **106**; `MESSAGE_MAX_CHARS` is **180**. Under the bound with 74 characters of
headroom, so SEC-06's truncation will never reach it. `"reason" in result` is **false** against the
built artifact — the key is absent, not present-and-undefined.

### 5. The `ANCHOR(T2)` handshake, and the line counts at each boundary

| Boundary | `grep -c 'ANCHOR(T2)'` | `wc -l` |
|---|---|---|
| before Task 1 | **0** (the file did not exist) | — |
| close of Task 1 | **19** | **272** — recorded as `post-T1 line count: 272` |
| close of Task 2 | **0** | **699** |

Delta across Task 2: **+427**, against a required floor of N+100 = 372 and an absolute floor of 300.
`post-T1 DSP-09 count: 0` (must-stay-0 guard, satisfied by construction — Task 1 was forbidden from
writing the literal); post-Task-2 count is **2**.

### 6. `contract.ts`, both counts

| Literal | Pre-edit | Post-edit |
|---|---|---|
| `future work and should be added` | **1** (`contract.ts:147`) | **0** |
| `reaches this guard transitively` | **0** | **1** |
| `export const CONTRACT_VERSION = 1;` | **1** | **1** (must-not-change guard) |
| `createConcierge` | **2** | **3** — all three inside the block comment; none describes the call site as pending |

`git diff -U0` for this file shows a single hunk at `@@ -145,3 +145,19 @@`, entirely inside the
block comment. No non-comment line moved, verified by filtering the diff rather than by reading it.

**The corrected sentence reaches the shipped declarations** — `grep -c 'reaches this guard
transitively' dist/index.d.ts` is **1** (line 2051) and `grep -c 'future work and should be added'
dist/index.d.ts` is **0**.

### 7. Export surface, independently re-derived

Not trusting the test — the suite's own regex re-run over `dist/index.d.ts` in a standalone script:

```
blocks 1 names 62 values 11 types 51
values: CONSENT_GRADE_ORDER, CONTRACT_VERSION, CatalogValidationError, JSON_SCHEMA_TARGET, MESSAGE_MAX_CHARS, USER_CANCELLED, USER_DECLINED, assertSingleInstance, buildCatalog, createConcierge, defineAction
createConcierge in values: true
Explanation in types: true | StageExplanation in types: true
```

The three `it` titles, read from `--reporter=verbose` output rather than from the source:

```
✓ is exactly 62 names — an export added or dropped by a build-config change lands here
✓ splits 51 types to 11 values
✓ carries all eleven runtime value exports by name
```

`git diff -U0 -- test/export-surface.test.ts` hunks are at `121, 134, 136, 139, 141, 145` — every one
above line 120, so the parser at `:74-99` is untouched.

### 8. `check:deps` byte count and delta

```
Assertion A (PKG-05a) — modules in graph: 1 | unbundled external imports: [] | PASS
Assertion B (PKG-05b) — @standard-schema/spec  0 bytes | PASS
```

**Delta: zero.** Identical to the pre-plan measurement. This plan installed nothing;
`pnpm-lock.yaml` is byte-identical (`git diff --stat -- pnpm-lock.yaml` empty).

Artifact size for the record: `dist/index.js` 61.09 kB → 83.9 kB (the new module), `dist/index.d.ts`
122.04 kB → 125.4 kB (the new doc comments, which ship).

### 9. CAT-01's fifth derived artifact now ships

`REQUIREMENTS.md:157` records CAT-01 as *Partial — 4/5 derived artifacts ship*. The fifth,
**per-stage catalogs**, arrives here as `createConcierge().catalogFor(ctx)`. 04-05 S1/S2 are its
evidence; **04-08 Task 2(c) should record the closure**.

One carve-out that must travel with it: the union of literal action names **stops at the config
boundary**, and that is correct rather than a gap. Measured three ways —
`buildCatalog([alpha, beta])` derives `"alpha" | "beta"`, and the flat assembly this function
performs derives `string`. The cause is `ConciergeConfig.stages: ReadonlyArray<StageDefinition<any>>`
(D-07's deliberate erasure), not `flatMap`. Nothing downstream consumes the union today. Recorded in
`createConcierge`'s shipped doc comment so Phase 8 inherits the measurement rather than re-deriving
it.

### 10. Hand-forward to Phase 6

**The DSP-09 normalizer must REPLACE the `{ok:false, message}` dispatch stub, not normalize it.**
The stub deliberately omits `reason`, because `ReasonCode` is a closed union of twelve and none of
them means "this runtime is not built yet". DSP-09 exists to reject a *handler* return that is not a
valid `ActionResult`; this value is not a handler return at all, so routing it through the normalizer
would produce a well-formed report about a call that never happened. Phase 6 deletes
`DISPATCH_NOT_IMPLEMENTED` and the `dispatch` function that returns it together. This is written into
`src/concierge.ts` itself (`grep -c 'DSP-09'` = 2), not only here.

### 11. `04-PATTERNS.md:1627-1652`'s open item — CLOSED, decision recorded

**Decision: ADD a `createConcierge` case to `test/artifact.test.ts`.** Reasons, in order of force:
the established convention is that every value export gets an artifact-level case and all four of
Phase 3's have one; the cost is one `it`; and the failure it catches is invisible everywhere else —
`createConcierge` lost to the `export type { … }` block gives a consumer
`TypeError: createConcierge is not a function` at their module scope, which reads as "the package is
broken" rather than "one export moved". The consequence sentence is in the test's own comment, per
`:107-115`'s shape.

---

## Measurements Taken In This Worktree

Every claim written into shipped prose was probed here first. Scratch probe files were created,
run, and deleted; `git status --porcelain` was verified empty before each commit.

### The behavioural probe — 26 scenarios against the built artifact

| # | Scenario | Result |
|---|---|---|
| 1–2 | STG-01 — results stage is offered `[applyFilter, sortBy, signOut]`; `pay` **absent**, not refused | PASS |
| 3 | STG-04 — two distinct `ctx` objects resolving to one stage return the identical array (`Object.is` true) | PASS |
| 5 | SEC-03 — `push`, element `description` write, and nested `parameters.type` write all `TypeError`; length unchanged | PASS |
| 6–7 | No stage matches → cross-stage actions only, memoized under one reference | PASS |
| 8–10 | `explain` reports stage, per-stage matched flags and the live catalog; deep-frozen at three levels; **not** identity-stable | PASS |
| 11 | Three stages sharing one id produce **exactly one** warning naming that id | PASS |
| 12 | Each of those three stages serves its **own** actions — the id-collapse is structurally impossible | PASS |
| 13–16 | A throwing matcher and a truthy-returning matcher are both skipped, resolution continues to the next stage, two warnings, and the latch holds across repeated `catalogFor`/`explain` calls | PASS |
| 15 | The thrown message `SECRET-user@example.com` appears in **no** warning | PASS |
| 17 | One-pass consistency under a counter-driven matcher: `{"stage":"flaky","matched":true}` — no self-contradiction | PASS |
| 18 | Bridge states: `null` / `{registered:false}` / `{registered:true}` / a **throwing** `read()` → `{registered:false}` | PASS |
| 19 | `dispatch` returns `{ok:false, message}`; `"reason" in result` is **false** | PASS |
| 20–21 | `__proto__` is an ordinary absent key; the `signOut` tool is the **identical object** in both stage arrays and is frozen | PASS |
| 22 | A duplicate action name **across two stages** still throws `CatalogValidationError: duplicate_action_name` with no new code | PASS |
| 23 | **The shadowing case DX-01 exists for** — two stages both match; `explain` reports `["broad:true","specific:true"]` and `stage:"broad"`. A short-circuiting implementation would report `specific:false`. | PASS |
| 24–25 | No-stage and zero-stage configs both produce coherent `explain` output rather than throwing | PASS |
| 26 | A stage whose id is literally `"null"` does **not** collide with the `null` memo key: `/n` → `['x','cross']`, no-stage → `['cross']` | PASS |

### Typecheck coverage, proved rather than assumed

`tsc --listFiles` prints nothing under TypeScript 7.0.2 (the native port does not implement it), so
"is `src/concierge.ts` in the typecheck program?" could not be answered by inspection. Proved by
mutation instead: a deliberate `const _typecheckReachProbe: number = "not a number";` appended to the
file produced `src/concierge.ts(274,7): error TS2322` and `pnpm typecheck` exit 1. Restored
immediately. This matters — `tsdown` does not typecheck, so an unreferenced module could otherwise
have compiled nowhere.

### Which comments actually ship — measured before any claim about shipping was written

| Comment kind | Reaches `dist/index.d.ts`? |
|---|---|
| A **file header** block (e.g. `catalog.ts`'s "Three constraints…", `host.ts`'s "The host seam") | **NO** — 0 occurrences |
| A doc comment on a **barrel-exported** declaration (`buildCatalog`, `Catalog.byName`, `assertSingleInstance`) | **YES** — verbatim |
| A doc comment on a **module-internal** export (`deepFreeze`) | **NO** — 0 occurrences |

This changed what was written. The plan's Task 2(b) note cites `dist/index.d.ts:1837` for the
`assertSingleInstance` comment; it is at **line 2050** on this tree (line numbers shifted since the
plan was authored — the sentence is the same one). And `concierge.ts`'s **file header** does not
ship, so no claim about "this comment ships verbatim" was written into it; that claim was written
only where it was measured true, in `contract.ts`.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Correctness] The plan's own instructions make its `exports.test-d.ts` count of 2 unreachable**

- **Found during:** Task 3, running the plan's acceptance greps.
- **Issue:** The criterion reads *"`grep -c 'createConcierge' packages/concierge/test-d/exports.test-d.ts` returns 2 (the shared import line and the predicate)."* The measured value is **4**. This is not an error in the edit — the plan's own action text mandates three of the four occurrences: the shared import line, a doc comment `/** createConcierge reaches the public entrypoint as a callable VALUE… */`, and the predicate line (whose alias `_createConciergeExportedAsValue` and `typeof createConcierge` both sit on it). The header count update to "six predicates" contributes the fourth. The criterion was derived without counting the doc comment or the header mention it also requires.
- **Verified house-consistent rather than assumed:** the same grep over the four names already in the file returns `buildCatalog 5`, `defineAction 4`, `CatalogValidationError 3`, `JSON_SCHEMA_TARGET 3`. A count of 4 for `createConcierge` sits inside that range; a count of 2 would mean the predicate had no doc comment, breaking the shape every sibling follows.
- **Fix:** the edit follows the plan's *instructions* rather than its arithmetic. Recorded here with the measurement so 04-08's audit does not read the mismatch as a defect. The discriminating half of the criterion holds regardless: **pre-edit 0, post-edit 4**.
- **Files:** `packages/concierge/test-d/exports.test-d.ts` · **Commit:** `7c1c11c`

**2. [Rule 2 — Missing Critical] The file header could not state the corrected justification the way the plan words it**

- **Found during:** Task 1, writing the header.
- **Issue:** The plan's action text for header constraint 1 instructs writing that *"the `sideEffects: false` / tree-shaking justification … was measured under rolldown 1.2.0 and does NOT reproduce"*. Its own acceptance criterion requires `grep -ci 'sideEffects\|tree-shak\|treeshake'` to return **0**. The two cannot both hold: naming the false claim in order to retract it is still an occurrence.
- **Fix:** the correction is stated without the forbidden vocabulary — *"An earlier draft justified the same rule on bundler grounds instead — that a module-scope structure is elided from a consumer build. Re-measured under rolldown 1.2.0, it does **not** reproduce…"*. The retraction survives, the measured-false phrasing appears nowhere, and both the criterion (0) and the required positive (`SSR|cross-request` ≥ 1) hold.
- **Files:** `packages/concierge/src/concierge.ts` · **Commit:** `af8e42e`

**3. [Rule 3 — Blocking] One type import beyond the plan's named list**

- **Issue:** The plan names exactly three imports and the house rule requires an explicit annotation on every `const`. `const catalog: Catalog = buildCatalog(…)` needs the `Catalog` type in scope; without it the annotation cannot be written and the house rule would have to be broken instead.
- **Fix:** added `import type { Catalog } from "./catalog.js";`, in the plan's stated order (values first, then types), matching `catalog.ts:59-63`'s own split of `./json-schema.js` across a value import and a type import. Adds nothing to the export surface — verified, the count moved by exactly the three names this plan intends.
- **Files:** `packages/concierge/src/concierge.ts` · **Commit:** `af8e42e`

**4. [Rule 2 — Missing Critical] `bridgeStatus`'s local annotation would have re-spelled `any`**

- **Issue:** RESEARCH's sketch annotates the registry local as `BridgeRegistry<any>`, which needs a fourth type import and puts a second, unargued `any` in the source. The plan explicitly forbids the second erasure for the *parameter* but leaves the local unaddressed.
- **Fix:** the local is annotated `ConciergeConfig["stages"][number]["bridge"]` — the same indexed-access spelling the plan mandates one line up, so the erasure is referenced where it was argued rather than restated.
- **Files:** `packages/concierge/src/concierge.ts` · **Commit:** `af8e42e`

**Total deviations:** 4 auto-fixed (1 correctness, 2 missing-critical, 1 blocking). No architectural
changes, no new dependencies, no package installs. None expands scope: six files touched, exactly the
six the plan names.

---

## Issues Encountered

- **Worktree base correction at startup.** `git merge-base HEAD 48dbc40` returned `e4e353f`, so the worktree was checked out on an unrelated older tip rather than diverged from the wave-1 base. Reset to `48dbc40` per the startup protocol before any read.
- **`tsc --listFiles` is silently unimplemented in TS 7.0.2.** It exits 0 and prints nothing. Anything in this repo that reaches for it to prove program membership will get a vacuous answer; use a deliberate mutation instead (see *Measurements*).
- **Line-number drift in the plan's citations.** `04-RESEARCH.md` cites the `assertSingleInstance` comment at `dist/index.d.ts:1837`; it is at 2050 on this tree. The sentence is unambiguous, so the drift cost nothing, but line-number citations into a built artifact go stale between waves.

## Known Stubs

**One, deliberate and documented in the source: `dispatch`.** It returns
`DISPATCH_NOT_IMPLEMENTED` and runs no handler. This is not an incomplete implementation of this
plan's goal — `Concierge.dispatch` is a required interface member that Phase 6 owns, and CONTEXT
locks the stub's exact shape. The `src/index.ts` module doc comment states plainly that nothing
dispatches, so a consumer meets the limitation before they meet the API. See §10 for the Phase 6
hand-off.

No other stub. `catalogFor`, `stageFor` and `explain` are complete and behaviourally probed.

## Threat Flags

None. This plan opens no network endpoint, no auth path and no file access pattern, and changes no
schema at a trust boundary. Every `mitigate` disposition in the plan's register was probed:

| Threat | Verification |
|---|---|
| T-04-01 (tool injection through the returned array) | `push`, element write and nested-schema write all `TypeError`; array length unchanged |
| T-04-02 (capability leakage across stages) | `pay` is **absent** from the results catalog, not refused at call time |
| T-04-03 (wrong-stage catalog via colliding ids) | Three stages sharing one id each serve their own actions; exactly one warning |
| T-04-04 (a matcher that throws inside the render) | Skipped, warned once, resolution continues; nothing propagates |
| T-04-05 (the matcher warning as a disclosure channel) | The thrown `SECRET-user@example.com` appears in no warning; `catch` has no binding, so it is not in scope to echo |
| T-04-06 (cross-request pollution under SSR) | Both mutable structures are instance-local `let`s, `null` until first use; module scope holds two immutable constants |
| T-04-13 (prototype pollution through `toolByName`) | `Object.create(null)` plus a seal; `__proto__` lookup returns `undefined` |
| T-04-10 (two copies of core) | `createConcierge` reaches `assertSingleInstance` transitively; `test/single-instance.test.ts` green |
| T-04-SC (supply chain) | Nothing installed; `pnpm-lock.yaml` byte-identical; `check:deps` delta zero |

`T-04-11` (the returned object is not frozen) and `T-04-07` (a getter inside a consumer-supplied
`jsonSchema`) remain **accept**, both recorded in the source. **No plan in this phase may record
"SEC-03 closed" without T-04-07's carve-out**: the consumer-supplied `jsonSchema` getter channel is
measured open and is out of scope, because `deepFreeze` deliberately skips accessors so that walking
the catalog never invokes application code.

## Verification

| Gate | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm build` | exit 0 (attw + publint clean) |
| `pnpm test` | exit 0 — **56 tests / 6 files** (55 after Tasks 1 and 2; +1 in Task 3) |
| `pnpm check:artifact` | exit 0 |
| `pnpm check:deps` | exit 0 — zero-byte delta |
| `pnpm check:pack` | exit 0 — a foreign project installed the tarball, typechecked the shipped `.d.ts` with `skipLibCheck: false`, and imported the runtime |
| `git status --porcelain` | empty |
| `git diff --stat -- pnpm-lock.yaml` | empty |

`pnpm test` read **6 files / 55 tests** at the close of Task 1 and again at the close of Task 2 —
`concierge.ts` was unreachable from the barrel until Task 3, exactly as planned, so the surface pins
stayed at 59/49/10 across both.

## Notes for Later Plans

- **04-04:** `src/types.ts`, `src/catalog.ts`, `test/catalog.test.ts` and `test-d/catalog.test-d.ts` were **not touched** by this plan.
- **04-05:** every rendered message is in §3 above, captured from the artifact. Scoped runs need `pnpm test test/concierge` — `pnpm test concierge` matches every path in the repo, and `pnpm test -- <fragment>` does not filter at all. `pnpm build` must precede `pnpm test`.
- **04-06:** `createConcierge` is non-generic — `createConcierge(config: ConciergeConfig): Concierge`, one occurrence, exact. `_createConciergeExportedAsValue` is now taken as an identifier in `test-d/exports.test-d.ts`; pick a different one for the signature pin.
- **04-07:** §1 and §2 are the battery's raw material. Two literals are **traps**: `Object.freeze(` occurs 4× and `return warnStage(` occurs 2× — neither is usable bare. M-04-6 must use the complete `catch`-branch statement in §2.
- **04-08:** the only freeze-count claim in `concierge.ts` prose says **four**, and it is at `src/concierge.ts:326`. `grep -ci 'sideEffects\|tree-shak\|treeshake'` on that file is **0** and must stay 0. §9 is CAT-01's closure evidence; §10 is the Phase 6 hand-off.

## User Setup Required

None.

## Self-Check: PASSED

- `packages/concierge/src/concierge.ts` — FOUND (created, 699 lines)
- `packages/concierge/src/contract.ts` — FOUND (modified, comment-only)
- `packages/concierge/src/index.ts` — FOUND (modified)
- `packages/concierge/test/export-surface.test.ts` — FOUND (modified)
- `packages/concierge/test-d/exports.test-d.ts` — FOUND (modified)
- `packages/concierge/test/artifact.test.ts` — FOUND (modified)
- Commit `af8e42e` — FOUND in `git log`
- Commit `458dae6` — FOUND in `git log`
- Commit `7c1c11c` — FOUND in `git log`
- `git diff --name-only 48dbc40..HEAD` — exactly the six files above, no more
- `STATE.md` / `ROADMAP.md` — **NOT** modified (orchestrator owns them)
- `pnpm-lock.yaml` — byte-identical to the base commit

---
*Phase: 04-stages-catalog-assembly-and-explain*
*Completed: 2026-07-30*
