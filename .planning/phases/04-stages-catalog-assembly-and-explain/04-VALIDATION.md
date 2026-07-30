---
phase: 4
slug: stages-catalog-assembly-and-explain
status: planned
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-30
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Infrastructure, sampling, Wave 0 and mutant obligations seeded from `04-RESEARCH.md`
> `## Validation Architecture`. The Per-Task Verification Map is filled by the planner; its
> **Status** column is filled by plan 04-08 from observed evidence, never predicted.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Runtime framework** | Vitest 4.1.10 — `packages/*/test/**/*.test.ts`, `environment: node`, one shared project |
| **Type-level framework** | `tsc -p packages/concierge/tsconfig.test-d.json`. **Not** Vitest typecheck mode, which `vitest.config.ts` records as deliberately off |
| **Config files** | `vitest.config.ts` (root), `packages/concierge/tsconfig.test-d.json` |
| **Quick run command** | `pnpm test <fragment>` — **BARE, no `--`** |
| **Type-level command** | `pnpm typecheck` |
| **Full suite command** | `pnpm build && pnpm typecheck && pnpm test` |
| **Phase gate command** | the above plus `pnpm check:artifact`, `check:deps`, `check:pack`, `check:node-floor` |
| **Mutation harness** | `scripts/mutate-and-prove.sh <file> <literal> <replacement> -- <gate>`; gate exits **1**, not 2 |
| **Measured baseline** | `pnpm test` → 6 files / 55 tests green in 328 ms; `pnpm typecheck` → exit 0; `dist/index.d.ts` → 59 names / 49 types / 10 values |
| **Expected at phase exit** | `pnpm test` → 7 files; `dist/index.d.ts` → 62 names / 51 types / 11 values |

### Four command traps that will otherwise waste executor time

1. **`pnpm test -- <fragment>` does NOT filter.** Vitest's cac CLI discards everything after `--`.
   Tenth reproduction across Phases 2–4. Every command in this document uses the bare form.
2. **`pnpm build` must precede `pnpm test`.** Every runtime test imports `../dist/index.js`, and
   `artifact.test.ts` / `export-surface.test.ts` read `../dist/index.d.ts` from disk. Runtime tests
   import `dist/`, **never** `../src/`.
3. **The mutation harness reports a vacuous PASS on a mutant that breaks the build.** A build failure
   prints `PASS: gate fired (exit 1), tree clean` having run zero tests. After every PASS, confirm
   from the gate's *output* that the mutant compiled and the tests actually ran.
4. **`pnpm test concierge` does NOT filter either — it runs the whole suite.** Measured on the
   pre-phase tree: `pnpm test concierge` → 6 files / 55 tests; `pnpm test catalog` → 1 file /
   22 tests. The positional argument is matched as a substring of the **full path**, and every test
   file in the repo lives under `packages/concierge/`, so `concierge` matches all of them. Use
   **`pnpm test test/concierge`**, which matches only `packages/concierge/test/concierge.test.ts` —
   no sibling's path contains `test/concierge`. On the pre-phase tree it reports *"No test files
   found", exit 1*, which is the correct red-before-green state for a file 04-05 creates. Every
   scoped command in this document and in the plans now uses `pnpm test test/concierge`; the bare
   `pnpm test` form is used where the full suite is genuinely the claim.

---

## Sampling Rate

- **After every task commit:** `pnpm typecheck` (~0.1 s under TS 7) plus the one `pnpm test <fragment>`
  the task touches. Any task touching `src/` also needs `pnpm build` first, because the runtime suite
  reads `dist/`.
- **After every plan wave:** `pnpm build && pnpm typecheck && pnpm test`
- **Before `/gsd-verify-work`:** full suite green, plus the mutant battery below, plus
  `git status --porcelain` empty
- **Max feedback latency:** ~2 s (build 0.5 s + typecheck 0.7 s + tests 0.33 s)

---

## Per-Task Verification Map

Seventeen tasks across eight plans in five waves. **Status is filled by 04-08 from observed
evidence** — a row whose evidence was never run stays ⬜ and blocks sign-off.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 04-01 | 1 | SEC-03, DX-01 | T-04-08 | `EmittedTool` members are `readonly`; `Explanation` and `StageExplanation` are named exported interfaces; `Concierge.explain` is declared | type | `pnpm typecheck` | ✅ `src/types.ts` | ⬜ pending |
| 04-01-T2 | 04-01 | 1 | STG-03 | T-04-19 | The inline-declaration widening, and the spelling that works, are recorded where a developer configuring stages meets them | type | `pnpm typecheck` | ✅ `src/types.ts` | ⬜ pending |
| 04-02-T1 | 04-02 | 1 | CAT-03 | T-04-16, T-04-15, T-04-17 | A missing or self-referential consent target fails the build with an actionable fix; every `consent` read is `Object.hasOwn`-guarded, never `in` | runtime | `pnpm build && pnpm test catalog` | ✅ `src/catalog.ts` | ⬜ pending |
| 04-02-T2 | 04-02 | 1 | CAT-03 | T-04-19 | `deepFreeze` is reachable without a second, weaker freeze walk; three stale-prose sites corrected in place | runtime | `pnpm build && pnpm test && pnpm check:artifact` | ✅ `src/catalog.ts` | ⬜ pending |
| 04-03-T1 | 04-03 | 2 | STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01, CAT-01 | T-04-01, T-04-02, T-04-03, T-04-04, T-04-05, T-04-06, T-04-11, T-04-13 | Every statement of `src/concierge.ts`: index-keyed instance-local lazily-allocated memo; shallow projection freeze over shared deep-frozen elements; one guarded matcher call whose warning echoes nothing it caught; the file header's three numbered constraints; nineteen `ANCHOR(T2)` markers | runtime | `pnpm build && pnpm test && pnpm check:deps` | ❌ Wave 0 — `src/concierge.ts` | ⬜ pending |
| 04-03-T2 | 04-03 | 2 | SEC-03, DX-01 | T-04-19, T-04-10 | Nineteen anchors expanded into doc comments with their measurements — including the SSR-not-tree-shaking and coupled-shallow-freeze corrections and the DSP-09 hand-off — and `contract.ts`'s now-false claim corrected. Comment-only diff | runtime | `pnpm build && pnpm test && pnpm test single-instance` | ❌ depends on 04-03-T1 | ⬜ pending |
| 04-03-T3 | 04-03 | 2 | SEC-03 | T-04-19 | The published surface, both its pins, the artifact probe and the module doc comment all describe the same package | runtime | `pnpm build && pnpm test export-surface` | ✅ `src/index.ts`, `test/export-surface.test.ts`, `test-d/exports.test-d.ts`, `test/artifact.test.ts` | ⬜ pending |
| 04-04-T1 | 04-04 | 2 | CAT-03 | T-04-16, T-04-20, T-04-14 | Typo, self-reference, forward reference and aggregation asserted on structured fields, not on formatted substrings | runtime | `pnpm build && pnpm test catalog` | ✅ `test/catalog.test.ts` | ⬜ pending |
| 04-04-T2 | 04-04 | 2 | CAT-03 | T-04-22 | `CatalogIssueCode` pinned as a closed six-member union, in an `Equals` spelling that goes red on widening to `string` | type | `pnpm typecheck` | ✅ `test-d/catalog.test-d.ts` | ⬜ pending |
| 04-05-T1 | 04-05 | 3 | STG-01, STG-02, STG-03, STG-04, CAT-03 | T-04-02, T-04-06, T-04-21 | Stage scoping by omission, first-match-wins, rename-independence (the *sensitive* shape), referential identity across distinct contexts, instance-local memo | runtime | `pnpm build && pnpm test test/concierge` | ❌ Wave 0 — `test/concierge.test.ts` | ⬜ pending |
| 04-05-T2 | 04-05 | 3 | SEC-03, DX-01 | T-04-01, T-04-03, T-04-04, T-04-05, T-04-07, T-04-12 | Array, element and nested-schema tamper vectors with both halves each; `explain`'s three fields, deep freeze and deliberate non-identity; matcher policy including the covert-channel assertion; stage-id policy | runtime | `pnpm build && pnpm test test/concierge` | ❌ Wave 0 — `test/concierge.test.ts` | ⬜ pending |
| 04-06-T1 | 04-06 | 3 | SEC-03, DX-01, STG-03 | T-04-08, T-04-22, T-04-23, T-04-20 | `EmittedTool` readonly, `Explanation`/`StageExplanation` shapes, `Concierge.explain` and `createConcierge` signatures, and `StageContext`'s access shapes — all in `Equals` spellings | type | `pnpm typecheck` | ❌ Wave 0 — `test-d/concierge.test-d.ts` | ⬜ pending |
| 04-06-T2 | 04-06 | 3 | SEC-03 | T-04-10 | `createConcierge` reaches `assertSingleInstance`, asserted through the existing global-registry observable in both directions | runtime | `pnpm build && pnpm test single-instance` | ✅ `test/single-instance.test.ts` | ⬜ pending |
| 04-07-T1 | 04-07 | 4 | STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01 | T-04-20, T-04-24, T-04-25, T-04-26 | Twelve `src/concierge.ts` mutants observed, each with an unfiltered pre-flight count of 1 and each confirmed from the gate output to have compiled and run tests | mutation | `scripts/mutate-and-prove.sh … -- pnpm build && pnpm test test/concierge` | ✅ `scripts/mutate-and-prove.sh` | ⬜ pending |
| 04-07-T2 | 04-07 | 4 | CAT-03, DX-01 | T-04-20, T-04-24, T-04-25 | Four `src/catalog.ts` and `src/types.ts` mutants observed; M-04-11 gated on the FULL suite because it is the only mutant proving the check reads the complete name set | mutation | `scripts/mutate-and-prove.sh … -- pnpm build && pnpm test` | ✅ `scripts/mutate-and-prove.sh` | ⬜ pending |
| 04-08-T1 | 04-08 | 5 | CAT-03, STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01 | T-04-19, T-04-07, T-04-26, T-04-SC | Seven gates green against the final tree; no prose in `dist/index.d.ts`, `dist/index.js`, `src/index.ts`, `src/contract.ts` or `src/catalog.ts` claims something this phase made false, asserted with eight literals each shown ≥1 on the pre-correction tree; `pnpm-lock.yaml` byte-identical | gate | `pnpm typecheck && pnpm build && pnpm test && pnpm check:artifact && pnpm check:deps && pnpm check:pack && pnpm check:node-floor` | ✅ | ⬜ pending |
| 04-08-T2 | 04-08 | 5 | CAT-03, STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01, CAT-01 | T-04-20 | Every map row carries an observed status; CAT-01's closure, the SEC-03 carve-out and the DSP-09 hand-off are recorded where the next planner reads them | gate | `pnpm typecheck && pnpm build && pnpm test` | ✅ this file | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check:** no three consecutive tasks lack an automated verify — every one of
the seventeen rows carries a command. 04-08-T2's is the weakest (it verifies the document rather
than behaviour) and it is the last task in the phase, so continuity holds.

---

## Requirement → Evidence Map

Seeded from `04-RESEARCH.md`. Every row is an observable assertion, not a description. The **Owner**
column names the plan that produces the evidence.

| Req | Observable evidence | Layer | Command | Owner |
|-----|---------------------|-------|---------|-------|
| **STG-01** | `catalogFor({pathname:"/results"}).map(t=>t.name)` equals `["applyFilter","sortResults","signOut"]` — checkout actions **absent from the array**, not rejected | runtime | `pnpm test test/concierge` | 04-05 S1 |
| **STG-01** | unrouted path → cross-stage only; `stageFor` returns `null` | runtime | `pnpm test test/concierge` | 04-05 S2 |
| **STG-01** | every element is an `EmittedTool` — has `type:"function"`, carries **no** `handler` and **no** `schema` key | runtime | `pnpm test test/concierge` | 04-05 S3 |
| **STG-02** | two stages both `match: () => true` → `stageFor` is the **first** | runtime | `pnpm test test/concierge` | 04-05 S4 |
| **STG-02** | renaming a **later** stage to the integer-like id `"2"` leaves resolution unchanged | runtime | `pnpm test test/concierge` | 04-05 S5 |
| **STG-03** | a stage matching on `{modalOpen:true, cartCount:3}` with **no `pathname` anywhere** resolves correctly | runtime | `pnpm test test/concierge` | 04-05 S6 |
| **STG-03** | `StageContext` admits dot- and bracket-access on non-`pathname` keys, and `match` accepts extra keys | type | `pnpm typecheck` | 04-06 T1 |
| **STG-04** | `catalogFor(ctxA)` `toBe` `catalogFor(ctxB)` for **distinct objects with different extra keys** resolving to one stage | runtime | `pnpm test test/concierge` | 04-05 S7 |
| **STG-04** | two no-stage contexts share one reference under the `null` key | runtime | `pnpm test test/concierge` | 04-05 S8 |
| **STG-04** | two separate `createConcierge` instances do **not** share an array (the cache is instance-local) | runtime | `pnpm test test/concierge` | 04-05 S9 |
| **SEC-03** | `catalogFor(ctx).push(evilTool)` throws **and** `length` is unchanged | runtime | `pnpm test test/concierge` | 04-05 S11 |
| **SEC-03** | `catalogFor(ctx)[0].name = "evil"` throws **and** the name is unchanged | runtime | `pnpm test test/concierge` | 04-05 S12 |
| **SEC-03** | `catalogFor(ctx)[0].parameters.properties.<key>.type = "number"` throws — elements are *deep*-frozen, which is what makes the shallow projection freeze sufficient | runtime | `pnpm test test/concierge` | 04-05 S13 |
| **SEC-03** | the same `EmittedTool` object appears in two stage arrays (`toBe`) — the element-sharing invariant | runtime | `pnpm test test/concierge` | 04-05 S14 |
| **SEC-03** | `catalogFor(ctx)[0].name = "evil"` stops **typechecking** — the type is no longer looser than the freeze | type | `pnpm typecheck` | 04-06 T1 |
| **SEC-03** | a handler cannot be replaced after build — the built registry is frozen; C17/C18 in `test/catalog.test.ts` | runtime | `pnpm test catalog` | pre-existing |
| **SEC-03** | `entries[0].action.schema` is still **not** frozen and still validates (03-06 C22 must stay green) | runtime | `pnpm test catalog` | pre-existing |
| **CAT-03** | a typo'd `requires` throws; `issues[0].code === "consent_target_missing"`; `issues[0].action` is the **referrer**; `problem` contains the **target** | runtime | `pnpm test catalog` | 04-04 C23 |
| **CAT-03** | `requires` naming the action itself yields `consent_self_reference`, **not** `consent_target_missing` | runtime | `pnpm test catalog` | 04-04 C24 |
| **CAT-03** | a **forward** reference builds **clean** — the false positive an in-loop placement produces | runtime | `pnpm test catalog` | 04-04 C25 |
| **CAT-03** | `requires` naming a **cross-stage** action builds clean | runtime | `pnpm test test/concierge` | 04-05 S10 |
| **CAT-03** | a consent typo **plus** three other faults throws once with four issues — aggregation survives the post-pass | runtime | `pnpm test catalog` | 04-04 C26 |
| **CAT-03** | `CatalogIssueCode` is exactly six members, pinned with `Equals` | type | `pnpm typecheck` | 04-04 T2 |
| **DX-01** | `explain(ctx)` returns `{stage, stages, catalog}` and nothing else (`Object.keys` length 3) | runtime | `pnpm test test/concierge` | 04-05 S16 |
| **DX-01** | `explain(ctx).stage` equals `stageFor(ctx)` for matched, unmatched, and throwing-matcher configs | runtime | `pnpm test test/concierge` | 04-05 S17 |
| **DX-01** | `explain(ctx).catalog` equals `catalogFor(ctx).map(t => t.name)` | runtime | `pnpm test test/concierge` | 04-05 S18 |
| **DX-01** | with two overlapping matchers, both rows report `matched: true` while `stage` is the first — the shadowed-stage case | runtime | `pnpm test test/concierge` | 04-05 S19 |
| **DX-01** | a hand-rolled `BridgeRegistry` whose `read()` returns `null` reports `bridge: {id, registered:false}`; a bridge reports `true`; no `bridge` field reports `null` | runtime | `pnpm test test/concierge` | 04-05 S20 |
| **DX-01** | deep-frozen: `explain(ctx).stages.push(...)` throws, and `explain(ctx).stages[0].matched = true` throws | runtime | `pnpm test test/concierge` | 04-05 S21 |
| **DX-01** | `explain(ctx) !== explain(ctx)` — the deliberate **non**-identity, asserted as a positive claim | runtime | `pnpm test test/concierge` | 04-05 S22 |
| **DX-01** | `explain` writes nothing to the console (plain global assignment restored in a `finally`) | runtime | `pnpm test test/concierge` | 04-05 S23 |
| **DX-01** | `Concierge["explain"]` cannot be silently widened to `unknown`, a bare function type, or a swallowing union | type | `pnpm typecheck` | 04-06 T1 |
| matcher policy | a throwing `match()` is skipped, warns **once** naming the stage across three `catalogFor` calls, and `explain` shows `matched:false` for it | runtime | `pnpm test test/concierge` | 04-05 S24 |
| matcher policy | the warning does **not** contain the thrown error's message — the covert-channel assertion | runtime | `pnpm test test/concierge` | 04-05 S24 |
| matcher policy | a matcher returning a truthy non-boolean does **not** match and warns naming the stage | runtime | `pnpm test test/concierge` | 04-05 S25 |
| stage-id policy | two stages sharing an `id` warn once, and the index-keyed memo serves each its **own** actions | runtime | `pnpm test test/concierge` | 04-05 S26 |
| **CAT-01** | the fifth derived artifact — **per-stage catalogs** — ships as `createConcierge().catalogFor`, closing the `Partial` that `REQUIREMENTS.md:157` records against Phase 3 | runtime | `pnpm test test/concierge` | 04-03; evidence 04-05 S1/S2; recorded by 04-08 T2(c) |
| PKG-04 | `createConcierge` reaches `assertSingleInstance` transitively via `buildCatalog` | runtime | `pnpm test single-instance` | 04-06 T2 |
| export surface | counts and names move in the same commit; `createConcierge` in `VALUE_EXPORTS`; 62 / 51 / 11 | runtime | `pnpm build && pnpm test export-surface` | 04-03 T2 |
| export surface | `createConcierge` reaches `dist/index.js` as a callable function | runtime | `pnpm build && pnpm test artifact` | 04-03 T2 |
| export surface | `createConcierge` reaches the public entrypoint as a **value**, not only a type | type | `pnpm typecheck` | 04-03 T2 |
| type pin | `_inlineDefineActionLosesTheUnion` stays **red-as-pinned** (if it flips, delete it — do not relax it) | type | `pnpm typecheck` | pre-existing |

---

## Wave 0 Requirements

- [ ] `packages/concierge/src/concierge.ts` — the module under test does not exist yet (04-03 T1)
- [ ] `packages/concierge/test/concierge.test.ts` — STG-01/02/03/04, SEC-03 projection half, DX-01,
      matcher policy, stage-id policy, CAT-03's cross-stage half. Opens with a "What escapes without
      this file" header. (04-05)
- [ ] `packages/concierge/test-d/concierge.test-d.ts` — `StageContext` access shapes,
      `Explanation`/`StageExplanation` shapes, `createConcierge` signature, `EmittedTool` readonly pin
      (04-06 T1)
- [ ] `packages/concierge/test/catalog.test.ts` — new describe block for CAT-03, C23…C26 (04-04 T1)
- [ ] `packages/concierge/test-d/catalog.test-d.ts` — `CatalogIssueCode` union assertion (04-04 T2)
- [ ] `packages/concierge/test-d/exports.test-d.ts` — new predicate + shared import line (04-03 T2)
- [ ] `packages/concierge/test/export-surface.test.ts` — updated counts, `it` titles, array entry
      (04-03 T2)
- [ ] `packages/concierge/test/artifact.test.ts` — the `createConcierge` value-export case (04-03 T2)
- [ ] `packages/concierge/test/single-instance.test.ts` — `createConcierge` call-site case (04-06 T2)

No new fixture file needed — `test/fixtures/schemas.ts` already provides every validator shape this
phase uses. **No new devDependency**; `pnpm-lock.yaml` must be byte-identical at phase exit.

---

## Mutant Obligations

**Mandatory pre-flight for every row.** The harness replaces exactly one occurrence, does not skip
comments, and slurps the file — so a literal appearing earlier in a doc comment mutates the comment
and reports the inverse of the truth.

```bash
grep -F -o -- '<literal>' <file> | wc -l     # must print exactly 1, comments INCLUDED
```

Every literal below **must be re-taken unfiltered at implementation time**; the plan summaries
(04-02, 04-03) record the counts observed when the source was written, and the file changes after.
After every PASS, confirm from the gate's **output** that the mutant compiled and the tests ran —
a build failure prints `PASS: gate fired (exit 1), tree clean` having run zero tests.

Sixteen rows. Four are repairs or respellings of `04-RESEARCH.md`'s battery; the reason is in the
Notes column and must be carried into `test/concierge.test.ts` as a comment (04-07 T2).

| # | File | Literal → replacement | Gate | Expected red | Notes |
|---|------|----------------------|------|--------------|-------|
| M-04-1 | `src/concierge.ts` | `Object.freeze(projected)` → `projected` | `pnpm build && pnpm test test/concierge` | the array-level SEC-03 case (`push` throws, length unchanged) | **REPAIRED.** RESEARCH wrote the bare `Object.freeze(`, which occurs **4×** in this file: `Object.freeze(tool)`, `Object.freeze(toolByName)`, `Object.freeze(projected)`, and `DISPATCH_NOT_IMPLEMENTED`'s module-scope `/* @__PURE__ */ Object.freeze({ … })`. 04-03 writes the three assembly freezes as three textually distinct single-occurrence statements, and `Object.freeze(tool)` is not a substring of `Object.freeze(toolByName)`, so the fourth occurrence invalidates neither M-04-1 nor M-04-16. |
| M-04-16 | `src/concierge.ts` | `Object.freeze(tool)` → `(tool)` | `pnpm build && pnpm test test/concierge` | the element-level SEC-03 case (`[0].name = "evil"`) | **ADDED.** Splits M-04-1's original claim into its two real halves; the array freeze and the element freeze are separate rules. |
| M-04-2 | `src/concierge.ts` | `memo ??= new Map` → `memo = new Map` | `pnpm build && pnpm test test/concierge` | the STG-04 identity cases | — |
| M-04-3 | `src/concierge.ts` | `memo.set(index, built);` → `;` | `pnpm build && pnpm test test/concierge` | the STG-04 identity cases, from the other direction | — |
| M-04-4 | `src/concierge.ts` | `for (const [index, stage] of stages.entries())` → `for (const [index, stage] of [...stages.entries()].reverse())` | `pnpm build && pnpm test test/concierge` | the first-match-wins case | **REPAIRED.** Requires **distinct loop spellings** in `resolveIndex` and `explain` — a constraint on the SOURCE, not the test. 04-03 ships `for…of stages.entries()` in `resolveIndex` and `stages.map(...)` in `explain`. |
| M-04-5 | `src/concierge.ts` | `result === true` → `result !== false` | `pnpm build && pnpm test test/concierge` | the truthy-non-boolean matcher case | — |
| M-04-6 | `src/concierge.ts` | the catch-body `return warnStage(…);` statement **including its full argument list** (exact literal in `04-03-SUMMARY.md`) → `throw new Error(stage.id);` | `pnpm build && pnpm test test/concierge` | the throwing-matcher case | `warnStage` returns the literal type `false` so the catch body is ONE statement, which is what makes this a single-literal swap. **The bare prefix `return warnStage(` occurs 2× in `runMatch`** — the `catch` branch and the non-boolean branch — so it is a trap literal and must never be used. 04-03 requires the two argument lists to stay textually distinct. |
| M-04-7 | `src/concierge.ts` | `index === null ? crossNames` → `index === null ? []` | `pnpm build && pnpm test test/concierge` | the no-stage-returns-cross-stage case | **RESPELLED.** RESEARCH wrote `id === null ? crossNames`, against the superseded **id-keyed** memo. The shipped key is the resolved stage's array index. |
| M-04-8 | `src/concierge.ts` | `...crossNames]` → `]` | `pnpm build && pnpm test test/concierge` | STG-01 — `signOut` missing from the results catalog | — |
| M-04-12 | `src/concierge.ts` | `const firstMatch: number = rows.findIndex((row) => row.matched);` → `const firstMatch: number = rows.map((row) => row.matched).lastIndexOf(true);` | `pnpm build && pnpm test test/concierge` | the two-overlapping-matchers case — `stage` becomes the last match | **RESPELLED.** RESEARCH wrote `matched && active === null`, against a `for…of` accumulation `explain` does not use (a `let` assigned inside a callback loses its narrowing anyway — TS #9998). |
| M-04-13 | `src/concierge.ts` | `deepFreeze(` → `Object.freeze(` | `pnpm build && pnpm test test/concierge` | `explain(ctx).stages[0].matched = true` no longer throws | Unique in `concierge.ts` (2× in `catalog.ts` — do not run it there). |
| M-04-15 | `src/concierge.ts` | `warnHost(duplicateStageIdMessage(stage.id));` → `void duplicateStageIdMessage(stage.id);` | `pnpm build && pnpm test test/concierge` | the duplicate-stage-id warn case | `warnHost(` occurs 2× in this file; the message is behind a named function precisely so this row has a unique literal. |
| M-04-9 | `src/catalog.ts` | `!seenNames.has(requires)` → `false` | `pnpm build && pnpm test catalog` | the CAT-03 typo case | — |
| M-04-10 | `src/catalog.ts` | `requires === action.name` → `false` | `pnpm build && pnpm test catalog` | the `consent_self_reference` case | — |
| M-04-11 | `src/catalog.ts` | `!seenNames.has(requires)` → `!new Set<string>().has(requires)` | **`pnpm build && pnpm test`** (full suite) | the forward-reference clean-build case **and** the cross-stage-target clean-build case | The **only** mutant proving the check reads the COMPLETE name set. M-04-9 does not. The full-suite gate is required because the two red cases live in two different files. |
| M-04-14 | `src/types.ts` | `explain: (ctx: StageContext) => Explanation;` → deleted | `pnpm typecheck` | `tsc` exits **1** and the diagnostics name `test-d/concierge.test-d.ts` | Read the OUTPUT, not just the exit code — deleting the member also breaks `src/concierge.ts`'s return literal, so the gate would fire even if the type suite pinned nothing. |

**Trap literals — do not use bare.** In `src/catalog.ts`: `duplicate_action_name` (2×),
`action.consent` (2×), `deepFreeze(` (2×), and after 04-02 both `consent_target_missing` and
`consent_self_reference` (2× each — the union member and the issue push). In `src/concierge.ts`:
`Object.freeze(` (**4×**) and `return warnStage(` (**2×**).

**Every mutant literal must be re-measured unfiltered before its row is run** —
`grep -F -o -- '<literal>' <file> | wc -l` must print exactly 1. The same discipline applies to every
acceptance-criteria grep in every plan in this phase: **a literal already sitting at its PASS value on
the pre-edit tree is no-coverage, not a pass.** Six criteria in the first draft of these plans were
satisfied by doing nothing, four of them because the literal did not exist in the file at all. Each
surviving criterion now carries its measured pre-edit count.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Whether `explain()`'s three fields actually answer "why didn't my action fire" for a developer who did not write the library | DX-01 | Prose quality is a human judgment; the verifier can assert the fields exist but not that they are legible | Read the `explain()` output for a shadowed-stage config and a no-bridge config; judge whether the next debugging step is obvious without opening the source. Owner: 04-08 T1(e). |
| Whether the two new CAT-03 issue messages state an actionable fix | CAT-03, DX-03 | Same — the mechanical half (action named, `fix` non-empty) is automated | Read both `problem`/`fix` pairs; confirm each names the referring action *and* the missing target, and that the `fix` says what to do. Owner: 04-08 T1(e). |

---

## Two behaviours with no single-literal mutant — stated rather than faked

1. **Rename-independence (STG-02).** A property of the data structure (an ordered `ReadonlyArray`,
   not a keyed object), not of a branch. Producing it requires rewriting resolution to key by id — a
   multi-line change no `<literal> <replacement>` swap expresses. The test is a regression detector
   against a future rewrite; its sensitivity is demonstrated by the measured key-ordering table
   rather than by a mutant. M-04-4 covers the adjacent, mutatable property (first-match-wins).
2. **The element-sharing invariant (SEC-03).** "The shallow projection freeze is sufficient *because*
   elements are shared and already deep-frozen" cannot be mutated into existence — building fresh
   elements per projection is a restructuring. M-04-1 proves the array freeze fires; S13 (the
   nested-schema write) and S14 (the `toBe` sharing assertion) together pin the invariant. **The test
   header must say that removing either one leaves the shallow freeze silently insufficient.**

Both are written into `test/concierge.test.ts`'s header by 04-05 T1, per the house convention.

---

## Explicitly NOT closed by this phase

- **SEC-03 is not fully closed.** The handler-replacement and tool-array halves close here. The
  consumer-supplied-`jsonSchema` getter channel (04-RESEARCH *Pitfall 9*) is measured open and is not
  this phase's to fix: `deepFreeze` deliberately skips accessors so that walking the catalog never
  invokes application code, and for `emission.source === "explicit"` the `parameters` object *is* the
  consumer's own object by reference. Re-freezing the projection changes nothing. **Do not write
  "SEC-03 closed" without that carve-out.**
- **CAT-04** (transport grade ceiling) — Phase 8; it needs a transport, which is Phase 7.
- **CAT-01 IS closed here**, and is listed in this section only to say so explicitly: Phase 3 shipped
  four of its five derived artifacts and `REQUIREMENTS.md:157` records the fifth, per-stage catalogs,
  as Phase 4's. It ships as `createConcierge().catalogFor`. 04-08 T2(c) updates
  `REQUIREMENTS.md:157` from `Partial` to `Complete`.
- **A non-string or missing `consent.requires`** — skipped deliberately, recorded as a residual in
  `catalog.ts`'s doc comment in the style of `catalog.ts:348-359`. Revisit with Phase 8's kernel,
  which is the first code that reads `requires` at runtime.
- **The inline-`defineAction` contextual widening** — documented, not fixed. Revisit in Phase 8 per
  D-12.2. `_inlineDefineActionLosesTheUnion` stays red-as-pinned; if it ever flips green, delete it,
  do not relax it.
- **`defineStage` and `createBridge`** — Phase 5. `defineStage` is now recorded as **not shipping at
  all**: stage matching needs no identity mechanism, and unforgeable bridge identity belongs with the
  registry.

## Hand-off to Phase 6 — read before planning DSP-09

The Phase 4 `dispatch` stub returns `{ ok: false, message }` with **`reason` deliberately omitted**
(escalated during discussion and confirmed by the user). `ReasonCode` is a closed union of twelve and
none of them means "this runtime is not built yet"; omitting `reason` asserts nothing false.
**DSP-09's normalizer must REPLACE this shape, not normalize it.** It is not a contradictory
`ActionResult` to be repaired — it is a placeholder to be deleted.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] Every mutant literal count re-taken unfiltered at implementation time
- [ ] Every mutant PASS confirmed to have COMPILED and RUN TESTS (not a vacuous build-failure PASS)
- [ ] Every one of CAT-03, STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01 has at least one green row
- [ ] SEC-03's **second** clause from ROADMAP SC-5 — the built registry is frozen, so page script
      cannot swap a handler after build — has its own green row (C17/C18, pre-existing regression
      coverage), not only the tool-array half
- [ ] **CAT-01 is recorded closed** and `REQUIREMENTS.md:157` no longer reads `Partial`
- [ ] Every acceptance-criteria grep in every plan carries a measured pre-edit count, and none of
      them already sat at its PASS value before the edit it checks
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — filled by plan 04-08 Task 2.
