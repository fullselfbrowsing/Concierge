---
phase: 4
slug: stages-catalog-assembly-and-explain
status: executed
sign_off: withheld
nyquist_compliant: false
wave_0_complete: true
created: 2026-07-30
statuses_observed: 2026-07-30
criteria_backfill: 2026-07-30
criteria_backfill_result: 3-non-discriminating-found
---

> **Sign-off is WITHHELD, deliberately, and the phase is otherwise complete.**
> All seven gates are green, all seventeen map rows carry an OBSERVED status, and all sixteen
> mutants have recorded outcomes. Exactly one Validation Sign-Off box is false — the
> acceptance-criteria-provenance box at the end of this document — and `nyquist_compliant`
> stays `false` because of it. The reason, the measurement behind it, and what closing it
> would take are written into that box. Nothing else in this document is blocked by it.
>
> **Update 2026-07-30 — the box was reworded to its intent, the labels were back-filled by
> measurement across the five plans that lacked them, and the box is STILL false.** The reword and
> the rejected wording are annotated in place. The back-fill labelled 57 count-bearing greps —
> 31 `DISCRIMINATING`, 23 `MUST-STAY GUARD` — and surfaced **three criteria that are neither**:
> `04-05-PLAN.md:460`, `04-05-PLAN.md:445` and `04-07-PLAN.md:281` each sat at or above their PASS
> value before the task they gate, so none could distinguish "done" from "never started". This is a
> criteria-provenance defect, not a correctness one — the work those three were meant to gate is
> independently evidenced — but it is the same defect class the phase spent three review rounds
> closing, so it is recorded rather than waved through. See `### The three criteria that measured
> non-discriminating`.

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Infrastructure, sampling, Wave 0 and mutant obligations seeded from `04-RESEARCH.md`
> `## Validation Architecture`. The Per-Task Verification Map is filled by the planner; its
> **Status** column is filled by plan 04-08 from observed evidence, never predicted.
>
> **Status column filled 2026-07-30 by plan 04-08 Task 2.** Every one of the seventeen values
> below was taken from a plan summary that names the command which produced it, cross-checked
> against the seven-gate run recorded in `## Phase Gate Results`. No value was predicted, and
> no row was marked green on the strength of a plan saying it would be.

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
| 04-01-T1 | 04-01 | 1 | SEC-03, DX-01 | T-04-08 | `EmittedTool` members are `readonly`; `Explanation` and `StageExplanation` are named exported interfaces; `Concierge.explain` is declared | type | `pnpm typecheck` | ✅ `src/types.ts` | ✅ green — `pnpm typecheck` exit 0 (04-01). Sensitivity later OBSERVED by 04-06: deleting one `readonly` gives `tsc` exit 1, sole diagnostic `test-d/concierge.test-d.ts(122,46)` |
| 04-01-T2 | 04-01 | 1 | STG-03 | T-04-19 | The inline-declaration widening, and the spelling that works, are recorded where a developer configuring stages meets them | type | `pnpm typecheck` | ✅ `src/types.ts` | ✅ green — `pnpm typecheck` exit 0; `crossStage` named 4× in prose after the Rule-1 fix (floor 2). Five widening probes run in-worktree, one of which changed the shipped text |
| 04-02-T1 | 04-02 | 1 | CAT-03 | T-04-16, T-04-15, T-04-17 | A missing or self-referential consent target fails the build with an actionable fix; every `consent` read is `Object.hasOwn`-guarded, never `in` | runtime | `pnpm build && pnpm test catalog` | ✅ `src/catalog.ts` | ✅ green — build + `pnpm test catalog` exit 0. Seven-scenario probe against the artifact: typo→`consent_target_missing`, self→`consent_self_reference`, forward + cross-stage + `consent:null` + `consent:{}` + `requires:42` all clean. Prototype-pollution probe run with a positive control |
| 04-02-T2 | 04-02 | 1 | CAT-03 | T-04-19 | `deepFreeze` is reachable without a second, weaker freeze walk; three stale-prose sites corrected in place | runtime | `pnpm build && pnpm test && pnpm check:artifact` | ✅ `src/catalog.ts` | ✅ green — all three exit 0, 6 files / 55 tests. `Hand-forward to Phase 4` 1→0 and the second stale site 1→0, both measured at 1 pre-edit. Eight array-method freeze results measured before the claim shipped |
| 04-03-T1 | 04-03 | 2 | STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01, CAT-01 | T-04-01, T-04-02, T-04-03, T-04-04, T-04-05, T-04-06, T-04-11, T-04-13 | Every statement of `src/concierge.ts`: index-keyed instance-local lazily-allocated memo; shallow projection freeze over shared deep-frozen elements; one guarded matcher call whose warning echoes nothing it caught; the file header's three numbered constraints; nineteen `ANCHOR(T2)` markers | runtime | `pnpm build && pnpm test && pnpm check:deps` | ✅ `src/concierge.ts` (699 lines, created) | ✅ green — all three exit 0; `check:deps` delta zero. 26-scenario behavioural probe against `dist/index.js`, all PASS, including the shadowing case and the three-stages-one-id case |
| 04-03-T2 | 04-03 | 2 | SEC-03, DX-01 | T-04-19, T-04-10 | Nineteen anchors expanded into doc comments with their measurements — including the SSR-not-tree-shaking and coupled-shallow-freeze corrections and the DSP-09 hand-off — and `contract.ts`'s now-false claim corrected. Comment-only diff | runtime | `pnpm build && pnpm test && pnpm test single-instance` | ✅ `src/concierge.ts`, `src/contract.ts` | ✅ green — all exit 0. `ANCHOR(T2)` handshake observed 0→19→0; file 272→699 lines (+427 against a 372 floor). `contract.ts`: `future work and should be added` 1→0, `reaches this guard transitively` 0→1, confirmed reaching `dist/index.d.ts` |
| 04-03-T3 | 04-03 | 2 | SEC-03 | T-04-19 | The published surface, both its pins, the artifact probe and the module doc comment all describe the same package | runtime | `pnpm build && pnpm test export-surface` | ✅ `src/index.ts`, `test/export-surface.test.ts`, `test-d/exports.test-d.ts`, `test/artifact.test.ts` | ✅ green — exit 0. Surface moved 59/49/10 → **62/51/11** with both pins and the artifact probe in one commit; re-derived independently by 04-08 T1(b) against `dist/index.d.ts`: `blocks 1 names 62 values 11 types 51` |
| 04-04-T1 | 04-04 | 2 | CAT-03 | T-04-16, T-04-20, T-04-14 | Typo, self-reference, forward reference and aggregation asserted on structured fields, not on formatted substrings | runtime | `pnpm build && pnpm test catalog` | ✅ `test/catalog.test.ts` | ✅ green — exit 0, `pnpm test catalog` 26 tests (22+4). C25 OBSERVED RED twice, independently: under a genuinely missing target, and under a reconstructed in-loop placement where it was **the only** case of 26 to fail |
| 04-04-T2 | 04-04 | 2 | CAT-03 | T-04-22 | `CatalogIssueCode` pinned as a closed six-member union, in an `Equals` spelling that goes red on widening to `string` | type | `pnpm typecheck` | ✅ `test-d/catalog.test-d.ts` | ✅ green — exit 0. OBSERVED RED under `CatalogIssueCode = string`: `tsc` exit 1 naming both predicates, `catalog.test-d.ts(323,52)` and `(326,41)` |
| 04-05-T1 | 04-05 | 3 | STG-01, STG-02, STG-03, STG-04, CAT-03 | T-04-02, T-04-06, T-04-21 | Stage scoping by omission, first-match-wins, rename-independence (the *sensitive* shape), referential identity across distinct contexts, instance-local memo | runtime | `pnpm build && pnpm test test/concierge` | ✅ `test/concierge.test.ts` (created, 1249 lines) | ✅ green — S1…S10 pass; scoped run 1 file / 25 tests, and it read *"No test files found", exit 1* before the file existed, so the criterion could not be met by inaction. S7 and S10 each OBSERVED RED under a deliberate regression |
| 04-05-T2 | 04-05 | 3 | SEC-03, DX-01 | T-04-01, T-04-03, T-04-04, T-04-05, T-04-07, T-04-12 | Array, element and nested-schema tamper vectors with both halves each; `explain`'s three fields, deep freeze and deliberate non-identity; matcher policy including the covert-channel assertion; stage-id policy | runtime | `pnpm build && pnpm test test/concierge` | ✅ `test/concierge.test.ts` | ✅ green — S11…S26 pass (S15 is prose, deliberately). S12 and S19 OBSERVED RED under regression. **Finding recorded:** S13 does *not* detect the element freeze — S12, S13 and S14 detect three different things |
| 04-06-T1 | 04-06 | 3 | SEC-03, DX-01, STG-03 | T-04-08, T-04-22, T-04-23, T-04-20 | `EmittedTool` readonly, `Explanation`/`StageExplanation` shapes, `Concierge.explain` and `createConcierge` signatures, and `StageContext`'s access shapes — all in `Equals` spellings | type | `pnpm typecheck` | ✅ `test-d/concierge.test-d.ts` (created, 190 lines) | ✅ green — exit 0; all nine predicates measured true against the shipped declarations *before* the real file was written. Readonly pin OBSERVED RED as the sole diagnostic in the repository |
| 04-06-T2 | 04-06 | 3 | SEC-03 | T-04-10 | `createConcierge` reaches `assertSingleInstance`, asserted through the existing global-registry observable in both directions | runtime | `pnpm build && pnpm test single-instance` | ✅ `test/single-instance.test.ts` | ✅ green — exit 0, 1 file / 5 tests. F5 OBSERVED RED when `createConcierge` is stubbed short of `buildCatalog`, and it is the **only** one of the five that can see it |
| 04-07-T1 | 04-07 | 4 | STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01 | T-04-20, T-04-24, T-04-25, T-04-26 | Twelve `src/concierge.ts` mutants observed, each with an unfiltered pre-flight count of 1 and each confirmed from the gate output to have compiled and run tests | mutation | `scripts/mutate-and-prove.sh … -- pnpm build && pnpm test test/concierge` | ✅ `scripts/mutate-and-prove.sh` | ✅ green — twelve rows, twelve harness exit 0 (PASS), every one showing a `Build complete` line **and** all 25 cases run. Zero vacuous PASSes. All twelve counts re-taken unfiltered on the tree that was mutated |
| 04-07-T2 | 04-07 | 4 | CAT-03, DX-01 | T-04-20, T-04-24, T-04-25 | Four `src/catalog.ts` and `src/types.ts` mutants observed; M-04-11 gated on the FULL suite because it is the only mutant proving the check reads the complete name set | mutation | `scripts/mutate-and-prove.sh … -- pnpm build && pnpm test` | ✅ `scripts/mutate-and-prove.sh` | ✅ green — four rows, four harness exit 0 (PASS). M-04-11 killed **C25 and S10** across two files on the full-suite gate (86 ran), which a `pnpm test catalog` gate would have half-missed — measured, not inferred |
| 04-08-T1 | 04-08 | 5 | CAT-03, STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01 | T-04-19, T-04-07, T-04-26, T-04-SC | Seven gates green against the final tree; no prose in `dist/index.d.ts`, `dist/index.js`, `src/index.ts`, `src/contract.ts` or `src/catalog.ts` claims something this phase made false, asserted with eight literals each shown ≥1 on the pre-correction tree; `pnpm-lock.yaml` byte-identical | gate | `pnpm typecheck && pnpm build && pnpm test && pnpm check:artifact && pnpm check:deps && pnpm check:pack && pnpm check:node-floor` | ✅ | ✅ green — all seven exit 0, each run UNPIPED with the code captured immediately. 7 files / 86 tests / 304 ms. Eight literals audited across six files, each measured on the pre-correction tree first; three corrected 1→0, one logged **no-coverage**. Lockfile byte-identical. See `## Phase Gate Results` |
| 04-08-T2 | 04-08 | 5 | CAT-03, STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01, CAT-01 | T-04-20 | Every map row carries an observed status; CAT-01's closure, the SEC-03 carve-out and the DSP-09 hand-off are recorded where the next planner reads them | gate | `pnpm typecheck && pnpm build && pnpm test` | ✅ this file | ✅ green — all three exit 0. Seventeen of seventeen rows carry an observed status; the pending marker falls 18→1, the survivor being the legend line (this cell deliberately does not spell the marker, or it would inflate the count it reports). CAT-01's closure, the SEC-03 carve-out and the DSP-09 hand-off are all recorded below. **Sign-off itself is withheld** on one false box — see `## Validation Sign-Off` |

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
| export surface | counts and names move in the same commit; `createConcierge` in `VALUE_EXPORTS`; 62 / 51 / 11 | runtime | `pnpm build && pnpm test export-surface` | 04-03 T3 |
| export surface | `createConcierge` reaches `dist/index.js` as a callable function | runtime | `pnpm build && pnpm test artifact` | 04-03 T3 |
| export surface | `createConcierge` reaches the public entrypoint as a **value**, not only a type | type | `pnpm typecheck` | 04-03 T3 |
| type pin | `_inlineDefineActionLosesTheUnion` stays **red-as-pinned** (if it flips, delete it — do not relax it) | type | `pnpm typecheck` | pre-existing |

---

## Wave 0 Requirements

- [x] `packages/concierge/src/concierge.ts` — the module under test does not exist yet (04-03 T1)
- [x] `packages/concierge/test/concierge.test.ts` — STG-01/02/03/04, SEC-03 projection half, DX-01,
      matcher policy, stage-id policy, CAT-03's cross-stage half. Opens with a "What escapes without
      this file" header. (04-05)
- [x] `packages/concierge/test-d/concierge.test-d.ts` — `StageContext` access shapes,
      `Explanation`/`StageExplanation` shapes, `createConcierge` signature, `EmittedTool` readonly pin
      (04-06 T1)
- [x] `packages/concierge/test/catalog.test.ts` — new describe block for CAT-03, C23…C26 (04-04 T1)
- [x] `packages/concierge/test-d/catalog.test-d.ts` — `CatalogIssueCode` union assertion (04-04 T2)
- [x] `packages/concierge/test-d/exports.test-d.ts` — new predicate + shared import line (04-03 T3)
- [x] `packages/concierge/test/export-surface.test.ts` — updated counts, `it` titles, array entry
      (04-03 T3)
- [x] `packages/concierge/test/artifact.test.ts` — the `createConcierge` value-export case (04-03 T3)
- [x] `packages/concierge/test/single-instance.test.ts` — `createConcierge` call-site case (04-06 T2)

No new fixture file needed — `test/fixtures/schemas.ts` already provides every validator shape this
phase uses. **No new devDependency**; `pnpm-lock.yaml` must be byte-identical at phase exit.

**All nine verified present by 04-08 T2, by `[ -f ]` plus a line count, not by a plan saying so:**
`src/concierge.ts` 699 · `test/concierge.test.ts` 1249 · `test-d/concierge.test-d.ts` 190 ·
`test/catalog.test.ts` 921 · `test-d/catalog.test-d.ts` 326 · `test-d/exports.test-d.ts` 102 ·
`test/export-surface.test.ts` 161 · `test/artifact.test.ts` 150 · `test/single-instance.test.ts` 269.
No fixture file was added and `pnpm-lock.yaml` is byte-identical against the phase merge base
(`git diff --stat fd8c295..HEAD -- pnpm-lock.yaml` → empty). `wave_0_complete: true` is set on that
evidence, and it is deliberately **not** coupled to the withheld sign-off: Wave 0 completeness is a
claim about files existing, which is observably true, and it is independent of the one false
Nyquist box below.

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

**Outcomes filled 2026-07-30 by plan 04-08 Task 2(b), from 04-07's execution record.** All sixteen
counts were re-taken unfiltered a second time by 04-08 against the tree being gated: **16/16 printed
exactly 1**, and every trap literal printed its documented non-unique count (`Object.freeze(` 4 in
`concierge.ts` and 1 in `catalog.ts`; `return warnStage(` 2; `warnHost(` 2; `duplicate_action_name`,
`action.consent`, `consent_target_missing`, `consent_self_reference` and `deepFreeze(` 2 each in
`catalog.ts`). The **Compiled & ran** column is the anti-vacuous-PASS check and was read out of each
gate's own output, never inferred from the exit code.

| # | File | Literal → replacement | Gate | Expected red | Harness exit | Observed red | Compiled & ran | Notes |
|---|------|----------------------|------|--------------|--------------|--------------|----------------|-------|
| M-04-1 | `src/concierge.ts` | `Object.freeze(projected)` → `projected` | `pnpm build && pnpm test test/concierge` | the array-level SEC-03 case (`push` throws, length unchanged) | exit 0 (PASS) | S11 — 1 failed / 24 passed, **25 ran** | YES — `Build complete in 54ms`, attw + publint clean | **REPAIRED.** RESEARCH wrote the bare `Object.freeze(`, which occurs **4×** in this file: `Object.freeze(tool)`, `Object.freeze(toolByName)`, `Object.freeze(projected)`, and `DISPATCH_NOT_IMPLEMENTED`'s module-scope `/* @__PURE__ */ Object.freeze({ … })`. 04-03 writes the three assembly freezes as three textually distinct single-occurrence statements, and `Object.freeze(tool)` is not a substring of `Object.freeze(toolByName)`, so the fourth occurrence invalidates neither M-04-1 nor M-04-16. |
| M-04-16 | `src/concierge.ts` | `Object.freeze(tool)` → `(tool)` | `pnpm build && pnpm test test/concierge` | the element-level SEC-03 case (`[0].name = "evil"`) | exit 0 (PASS) | S12 **and** S14 — 2 failed / 23 passed, **25 ran** | YES — `Build complete in 55ms` | **ADDED.** Splits M-04-1's original claim into its two real halves; the array freeze and the element freeze are separate rules. |
| M-04-2 | `src/concierge.ts` | `memo ??= new Map` → `memo = new Map` | `pnpm build && pnpm test test/concierge` | the STG-04 identity cases | exit 0 (PASS) | S7, S8, S9 — 3 failed / 22 passed, **25 ran** | YES — `Build complete in 52ms` | — |
| M-04-3 | `src/concierge.ts` | `memo.set(index, built);` → `;` | `pnpm build && pnpm test test/concierge` | the STG-04 identity cases, from the other direction | exit 0 (PASS) | S7, S8, S9 — 3 failed / 22 passed, **25 ran** | YES — `Build complete in 53ms` | — |
| M-04-4 | `src/concierge.ts` | `for (const [index, stage] of stages.entries())` → `for (const [index, stage] of [...stages.entries()].reverse())` | `pnpm build && pnpm test test/concierge` | the first-match-wins case | exit 0 (PASS) | S4, S5, S24, S25 — 4 failed / 21 passed, **25 ran** | YES — `Build complete in 53ms` | **REPAIRED.** Requires **distinct loop spellings** in `resolveIndex` and `explain` — a constraint on the SOURCE, not the test. 04-03 ships `for…of stages.entries()` in `resolveIndex` and `stages.map(...)` in `explain`. |
| M-04-5 | `src/concierge.ts` | `result === true` → `result !== false` | `pnpm build && pnpm test test/concierge` | the truthy-non-boolean matcher case | exit 0 (PASS) | S25 — 1 failed / 24 passed, **25 ran** | YES — `Build complete in 73ms` | — |
| M-04-6 | `src/concierge.ts` | the catch-body `return warnStage(…);` statement **including its full argument list** (exact literal in `04-03-SUMMARY.md`) → `throw new Error(stage.id);` | `pnpm build && pnpm test test/concierge` | the throwing-matcher case | exit 0 (PASS) | S17, S24 — 2 failed / 23 passed, **25 ran** | YES — `Build complete in 53ms` | `warnStage` returns the literal type `false` so the catch body is ONE statement, which is what makes this a single-literal swap. **The bare prefix `return warnStage(` occurs 2× in `runMatch`** — the `catch` branch and the non-boolean branch — so it is a trap literal and must never be used. 04-03 requires the two argument lists to stay textually distinct. |
| M-04-7 | `src/concierge.ts` | `index === null ? crossNames` → `index === null ? []` | `pnpm build && pnpm test test/concierge` | the no-stage-returns-cross-stage case | exit 0 (PASS) | S2, S8 — 2 failed / 23 passed, **25 ran** | YES — `Build complete in 53ms` | **RESPELLED.** RESEARCH wrote `id === null ? crossNames`, against the superseded **id-keyed** memo. The shipped key is the resolved stage's array index. |
| M-04-8 | `src/concierge.ts` | `...crossNames]` → `]` | `pnpm build && pnpm test test/concierge` | STG-01 — `signOut` missing from the results catalog | exit 0 (PASS) | S1, S6, S10, S11, S18, S24 — 6 failed / 19 passed, **25 ran** | YES — `Build complete in 59ms` | — |
| M-04-12 | `src/concierge.ts` | `const firstMatch: number = rows.findIndex((row) => row.matched);` → `const firstMatch: number = rows.map((row) => row.matched).lastIndexOf(true);` | `pnpm build && pnpm test test/concierge` | the two-overlapping-matchers case — `stage` becomes the last match | exit 0 (PASS) | S19 — 1 failed / 24 passed, **25 ran** | YES — `Build complete in 54ms` | **RESPELLED.** RESEARCH wrote `matched && active === null`, against a `for…of` accumulation `explain` does not use (a `let` assigned inside a callback loses its narrowing anyway — TS #9998). |
| M-04-13 | `src/concierge.ts` | `deepFreeze(` → `Object.freeze(` | `pnpm build && pnpm test test/concierge` | `explain(ctx).stages[0].matched = true` no longer throws | exit 0 (PASS) | S21 — 1 failed / 24 passed, **25 ran** | YES — `Build complete in 55ms` | Unique in `concierge.ts` (2× in `catalog.ts` — do not run it there). |
| M-04-15 | `src/concierge.ts` | `warnHost(duplicateStageIdMessage(stage.id));` → `void duplicateStageIdMessage(stage.id);` | `pnpm build && pnpm test test/concierge` | the duplicate-stage-id warn case | exit 0 (PASS) | S26 — 1 failed / 24 passed, **25 ran** | YES — `Build complete in 53ms` | `warnHost(` occurs 2× in this file; the message is behind a named function precisely so this row has a unique literal. |
| M-04-9 | `src/catalog.ts` | `!seenNames.has(requires)` → `false` | `pnpm build && pnpm test catalog` | the CAT-03 typo case | exit 0 (PASS) | C23, C26 — 2 failed / 24 passed, **26 ran** | YES — `Build complete in 56ms` | — |
| M-04-10 | `src/catalog.ts` | `requires === action.name` → `false` | `pnpm build && pnpm test catalog` | the `consent_self_reference` case | exit 0 (PASS) | C24 — 1 failed / 25 passed, **26 ran** | YES — `Build complete in 54ms` | — |
| M-04-11 | `src/catalog.ts` | `!seenNames.has(requires)` → `!new Set<string>().has(requires)` | **`pnpm build && pnpm test`** (full suite) | the forward-reference clean-build case **and** the cross-stage-target clean-build case | exit 0 (PASS) | **C25 AND S10** — 2 files failed / 5 passed; 2 failed / 84 passed, **86 ran** | YES — `Build complete in 54ms` | The **only** mutant proving the check reads the COMPLETE name set. M-04-9 does not. The full-suite gate is required because the two red cases live in two different files. |
| M-04-14 | `src/types.ts` | `explain: (ctx: StageContext) => Explanation;` → deleted | `pnpm typecheck` | `tsc` exits **1** and the diagnostics name `test-d/concierge.test-d.ts` | exit 0 (PASS) | `tsc` **exit 1**: `src/concierge.ts(698,44)` TS2353 and `test-d/concierge.test-d.ts(148,59)` **TS2339** | YES — the compiler ran and emitted both expected diagnostics; typecheck-gated, so this reads as "the compiler ran". Note the string `Type 'false' does not satisfy the constraint 'true'` appears **0** times here — the failure is TS2339 at the indexed access, so a run grepping for the usual TS2344 form would wrongly conclude the pin never fired | Read the OUTPUT, not just the exit code — deleting the member also breaks `src/concierge.ts`'s return literal, so the gate would fire even if the type suite pinned nothing. |

### The M-04-09 numbering discrepancy — adjudicated, not carried forward

`04-04-SUMMARY.md:248` labels `declared.push(action);` as **M-04-09**. This table, `04-07-PLAN.md:230`
and `04-07`'s execution all assign M-04-09 to `!seenNames.has(requires)` → `false`. **This table is
correct and `04-04-SUMMARY.md:248` is mislabelled.** Four pieces of evidence, in order of force:

1. **M-04-11's own Notes cell only parses under this table's assignment.** It reads *"The **only**
   mutant proving the check reads the COMPLETE name set. **M-04-9 does not.**"* That contrast is
   meaningful only if M-04-9 mutates the *same* expression — `!seenNames.has(requires)` — to a
   constant. Against `declared.push(action);` the sentence would be incoherent: deleting the push
   does not test the name set, it empties the set being read.
2. **`declared.push(action);` appears in ZERO rows of this table.** Measured on the untouched
   document: `grep -c 'declared.push' 04-VALIDATION.md` → **0**. It was never a seeded mutant.
3. **04-07 executed M-04-09 as `!seenNames.has(requires)` → `false` and observed C23 + C26 red with
   26 tests run.** That matches this table's seeded *Expected red* ("the CAT-03 typo case" = C23).
   The row has an observed outcome; the alternative reading has none.
4. **The error's origin is traceable and benign.** `04-02-SUMMARY.md:106` heads a three-row table
   *"Mutant Literals (for 04-07: M-04-09, M-04-10, M-04-11)"* listing `!seenNames.has(requires)`,
   `requires === action.name` and `declared.push(action);` — three literals under three IDs with **no
   stated one-to-one mapping**. 04-04 read it as a mapping, and because two IDs were already taken by
   the first two literals, the leftover ID landed on the third.

**The count is sixteen either way.** `declared.push(action);` still measures **1** in `src/catalog.ts`
(re-measured by 04-08) and remains available as a future mutation target, but the rule it would test —
that the post-pass iterates the declared set at all — is already covered from the other side by
M-04-9 and M-04-11. No row is missing and none was skipped. `04-04-SUMMARY.md` is left as the
historical record of what that executor observed; this is the authoritative assignment.

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

  **Phase-close statement, in the wording the next phase's planner should inherit:**

  > **CAT-01's fifth derived artifact, per-stage catalogs, now ships via
  > `createConcierge().catalogFor`; evidence 04-05 S1 and S2, plan 04-03.**

  Done, and verified on 2026-07-30: `REQUIREMENTS.md:157` was rewritten in place. The literal
  `Partial — 4/5 derived artifacts ship` measured **1** before and **0** after; the positive half,
  `closed by Phase 4`, measured **0** before and **1** after. Both halves are recorded because the
  negative alone cannot distinguish *rewritten* from *deleted*.

  The five pre-existing CAT-01 references in this document (`:79`, `:91`, `:144`, `:261`, `:298` on
  the untouched file, count re-measured at **5**) were **seeded by the previous revision of these
  plans, not written by 04-08**. Task 2(c) read all five, confirmed each still says what it claims —
  `:144` already names `createConcierge().catalogFor` and already cites 04-05 S1/S2 — and added only
  the block above. That count is a guard against losing one, never evidence that this task ran.
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

**Confirmed by 04-08 T2(c), not authored by it.** This section was already present and already
correct; the task's job was to check it against what 04-03 T2 actually wrote rather than to re-add
it. It matches `src/concierge.ts:118-124` in substance — *"the DSP-09 normalizer must REPLACE this
shape, not normalize it … Phase 6 deletes this constant and the function that returns it together"*
— and the runtime was probed to confirm the claim is true of the artifact and not only of the prose:
`await dispatch(...)` returns `{"ok":false,"message":"…"}` with `Object.keys` exactly
`['ok','message']` and `"reason" in result` **false**. The key is absent, not present-and-undefined,
which is the distinction the whole hand-off rests on.

---

## Phase Gate Results

Run by plan 04-08 Task 1 against the final tree on 2026-07-30. **Each gate was run UNPIPED with its
exit code captured immediately** — 04-06 measured that piping `pnpm -r typecheck` reports the pipe's
status rather than `tsc`'s, and 04-07 observed the mirror failure, a `${PIPESTATUS[0]}` read after an
intervening command reporting "mutant escaped" directly beneath the diagnostics proving it had not.

| Gate | Exit | Salient output |
|------|------|----------------|
| `pnpm typecheck` | **0** | `tsc -p tsconfig.test-d.json` → `Done` |
| `pnpm build` | **0** | `Build complete in 54ms`; attw and publint both clean |
| `pnpm test` | **0** | **7 files / 86 tests / 304 ms** |
| `pnpm check:artifact` | **0** | node16-from-ESM 🟢, bundler 🟢 |
| `pnpm check:deps` | **0** | Assertion A: 1 module, no unbundled externals. Assertion B: `@standard-schema/spec` **0 bytes** |
| `pnpm check:pack` | **0** | a foreign project installed the tarball (228 823 B), typechecked the shipped `.d.ts` with `skipLibCheck: false`, imported the runtime |
| `pnpm check:node-floor` | **0** | installed with npm and imported on a pinned **v22.12.0** |

**Re-confirmed 2026-07-30 by the acceptance-criteria back-fill pass**, on the main working tree
rather than a worktree, against a tree whose only difference from the above is `.planning/` prose.
All seven gates re-run **unpiped**, each exit code captured immediately into a shell variable with no
intervening command: `typecheck` **0**, `build` **0**, `test` **0**, `check:artifact` **0**,
`check:deps` **0**, `check:pack` **0**, `check:node-floor` **0**. `pnpm test` reported **7 files /
86 tests**, `pnpm build` `Build complete in 80ms`, `tsc` `Done`. Afterwards
`git diff --name-only -- packages/` was **empty**, `git diff --name-only -- pnpm-lock.yaml` was
**empty**, and there were **zero** untracked files — the back-fill touched only `.planning/`, as it
is required to. **These gates are recorded as evidence that the phase is still green; they are
explicitly NOT offered as grounds for sign-off**, which turns on the checklist box below and not on
the gates.

**Against the recorded baseline** of 6 files / 55 tests / 328 ms: **+1 file, +31 tests, −24 ms.**
The test count reconciles exactly — 55 (entry) +1 (04-03 T3 `artifact.test.ts`) +4 (04-04 C23…C26)
+25 (04-05 S-series, the seventh file) +1 (04-06 F5) = **86**. `check:deps` byte count **0**, delta
**zero** across the whole phase.

**Export surface, re-derived independently of the test** by running `export-surface.test.ts`'s own
regex over `dist/index.d.ts` in a standalone script — a test agreeing with itself is not the check:

```
blocks 1 names 62 values 11 types 51
values: CONSENT_GRADE_ORDER, CONTRACT_VERSION, CatalogValidationError, JSON_SCHEMA_TARGET,
        MESSAGE_MAX_CHARS, USER_CANCELLED, USER_DECLINED, assertSingleInstance, buildCatalog,
        createConcierge, defineAction
createConcierge in values: true
Explanation in types: true | StageExplanation in types: true
```

**Shipped-prose audit.** Eight literals across **six** files (`dist/index.d.ts`, `dist/index.js`,
`src/index.ts`, `src/contract.ts`, `src/catalog.ts`, `src/concierge.ts`). Every literal was measured
on the **pre-correction** tree first — the phase merge base `fd8c295` for source, and a build of that
base for `dist/` — so a literal that could never fire is reported as no-coverage rather than as a
pass. Every hit was read, not counted.

| Literal | Pre-correction | Final | Verdict |
|---|---|---|---|
| `sideEffects` (-i) | 24 | 24 | **guard held.** All hits are package-metadata prose about the contract registry, plus the unrelated `SideEffects` MCP tool-hint interface. **0 in `src/concierge.ts`** |
| `tree-shak` (-i) | 3 | 3 | **guard held.** The single source hit is `contract.ts`'s `sideEffects: ["./dist/contract.js"]` carve-out argument. **0 in `src/concierge.ts`** |
| `future work and should be added` | 3 | **0** | CORRECTED by 04-03 in `contract.ts`; gone from both built files |
| `remain future work` | 0 | 0 | **NO-COVERAGE, struck.** The phrase wraps across `contract.ts:146`/`:147` and was never greppable. Recorded as auditing nothing — never as a pass |
| `Hand-forward to Phase 4` | 2 | **0** | CORRECTED by 04-02 in `catalog.ts`; gone from `dist/index.js`. It was never in `.d.ts`, so a `.d.ts`-only check would have proved nothing |
| `defineStage` | 1 | 1 | **passes on the second clause** — the sole hit now reads *"`defineStage` is **not planned**"* with the reason |
| `is still being implemented` | 1 | **0** | CORRECTED by 04-03. The old sentence listed `createConcierge`, which now ships |
| `SEC-03` | 15 | 18 | **all scope/mechanism statements.** No closure claim anywhere |

**Seven of the eight literals fire on the pre-correction tree**, so seven of the eight greps are
demonstrably capable of detecting the thing they check. The eighth is logged as no-coverage above.

Stated explicitly, because these are the claims the audit exists to make: **no surviving hit
justifies the memo with tree-shaking** — both literals measure 0 in `src/concierge.ts`, the memo is
justified on SSR cross-request pollution, and the bundler justification is explicitly retracted as
measured-false under rolldown 1.2.0 without using the retracted vocabulary; **none describes Phase 4
as future work**; **none lists `defineStage` as pending**; and **none claims SEC-03 is closed**,
with or without the carve-out.

**Tree and lockfile.** `git status --porcelain` empty · `git diff --stat -- pnpm-lock.yaml` empty ·
`git diff --stat fd8c295..HEAD -- pnpm-lock.yaml` empty (**byte-identical across the whole phase**) ·
`grep -rn 'vi\.' packages/concierge/test/` **no matches** · non-comment `../src/` **0** in all seven
runtime test files · no probe residue in `src/` · and the three source checksums match the values
04-05 and 04-07 independently recorded (`concierge.ts` `56c24f88…438deb`, `catalog.ts`
`0cd4a768…d67298`, `types.ts` `a134478e…31e03d`), which is what proves every mutation and
sensitivity probe in this phase was restored exactly.

### Manual-only verifications — judgments, not checkmarks

**1. Does `explain()` answer "why didn't my action fire"? (DX-01)** — **Yes for the case it exists
for; no for one adjacent case, and that limit is a design boundary rather than a defect.**

Read for a shadowed-stage config, `explain({pathname:"/shop/cart"})` returns `stage: "broad"` with
**both** rows reporting `matched: true`, and `catalog` confirming only the first stage's actions are
offered. A developer asking why `checkout` did not fire reads the answer directly: two stages
matched, the earlier one won. The next step — reorder, or narrow the broad matcher — follows without
opening the source. This is the case the field set was designed for, and a short-circuiting
implementation would have reported `specific: false` and sent the developer to debug the wrong thing.

For a no-bridge config, `bridge: {id:"results-bridge", registered:false}` is legibly different from
`bridge: null`, and the two imply different fixes — mount the component, versus add a `bridge` to the
stage definition. Also derivable without the source.

**The honest limit, measured rather than assumed:** `explain()` does **not** distinguish a matcher
that *threw* from one that returned `false` — both render `matched: false`. Probed directly: a
throwing matcher and a plain `() => false` matcher produce identical rows. The reason travels on a
separate channel, a one-time `console.warn` naming the stage and stating the fix. A developer reading
only the returned object does not learn that their matcher threw. This is **not** filed as a defect:
`match` is arbitrary consumer code that `explain` cannot introspect, 04-01 deliberately chose three
fields over more, and `_explanationHasExactlyThreeFields` pins the shape so that a fourth field is a
decision rather than a drive-by. It is recorded here so Phase 5's planner meets the gap knowingly.

**2. Do the two new CAT-03 messages state an actionable fix? (CAT-03, DX-03)** — **Yes, both, and
their `fix` sentences are genuinely different, which is the whole argument for two codes.** Read off
the built artifact, not transcribed from source:

- `consent_target_missing` names the **referrer** in the structured `action` field (`confirmBooking`)
  and the **missing target** interpolated into `problem` (`reveiw`) — two different channels, which
  is what stops a reworded message from silently passing. The `fix` gives two concrete moves
  ("declare an action named `reveiw`, or correct the spelling") plus the scope rule ("may live in any
  stage, or in `crossStage`"). That last clause is load-bearing: without it a developer whose target
  lives in another stage would "fix" it by duplicating the action and trip `duplicate_action_name`.
- `consent_self_reference` names the referrer and the target — the same string — and the `problem`
  says so explicitly ("which is the action itself"), without which the sentence would read as a
  tautology. The `fix` states the corrective move ("point `consent.requires` at the review action
  that should run first") and the legitimate alternative ("remove the `consent` policy"). Collapsing
  these two codes into one would force a single `fix` to cover both, and a developer who merely
  mistyped a name would be advised to consider deleting their consent policy.

---

## Validation Sign-Off

Eleven of twelve boxes are true and are ticked with the measurement that made each true. **One is
false. It is not ticked, and `nyquist_compliant` therefore stays `false`.**

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all **17** map rows carry an
      Automated Command; zero rows rely on a Wave 0 dependency alone.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — the longest run without
      one is **0**, since every row has one.
- [x] Wave 0 covers all MISSING references — all **9** Wave 0 files verified present by `[ -f ]` plus
      a line count; the four rows that read `❌ Wave 0` / `❌ depends on` at plan time now read `✅`.
- [x] No watch-mode flags — `grep -rn -- '--watch\|watch: true\|vitest watch'` over `package.json`,
      `vitest.config.ts`, `packages/concierge/package.json`, `scripts/` and every plan in this phase
      returns **no matches**. The root script is `"test": "vitest run"`.
- [x] Feedback latency < 5s — **measured on this tree, not inherited**: `pnpm build` 1227 ms +
      `pnpm typecheck` 712 ms + `pnpm test` 814 ms = **2754 ms** wall, against a 5000 ms budget.
- [x] Every mutant literal count re-taken unfiltered at implementation time — 04-07 re-took all
      twenty on the tree it mutated, and 04-08 re-took all **16/16 again** on the tree being gated.
      Every one printed exactly **1**; every trap literal printed its documented non-unique count.
- [x] Every mutant PASS confirmed to have COMPILED and RUN TESTS (not a vacuous build-failure PASS) —
      all 16 rows carry a `Build complete` line **and** a full test count (25, 26 or 86) read out of
      the gate's own output. **Zero vacuous PASSes.** M-04-14 is typecheck-gated and shows `tsc`
      running and emitting both expected diagnostics.
- [x] Every one of CAT-03, STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01 has at least one green row —
      all seven do; the map is 17 green of 17.
- [x] SEC-03's **second** clause from ROADMAP SC-5 — the built registry is frozen, so page script
      cannot swap a handler after build — has its own green row (C17/C18, pre-existing regression
      coverage), not only the tool-array half. Both observed green in the verbose run: *"C17 — the
      catalog, its entries array, each entry and each action are all frozen"* and *"C18 — replacing a
      built handler fails, and the original handler is still there"*.
- [x] **CAT-01 is recorded closed** and `REQUIREMENTS.md:157` no longer reads `Partial` — flipped;
      `Partial — 4/5 derived artifacts ship` **1→0** and `closed by Phase 4` **0→1**.
- [ ] **Every acceptance-criteria grep in every plan is labelled — either `DISCRIMINATING`, carrying
      a measured pre-edit count that differs from the value the criterion passes at, or
      `MUST-STAY GUARD`, which protects an existing property and is never counted as progress.**
      — **STILL FALSE. This remains the box that withholds sign-off, now on narrower and worse
      evidence.** *(This box was reworded on 2026-07-30; the wording it replaces, and why it was
      rejected, are preserved immediately below — the reword is annotated, not silent.)*
      The labels were back-filled **by measurement** on 2026-07-30 across `04-01-PLAN.md`,
      `04-04-PLAN.md`, `04-05-PLAN.md`, `04-06-PLAN.md` and `04-07-PLAN.md`; the three plans that
      already carried the convention (`04-02`, `04-03`, `04-08`) were left untouched. **57
      count-bearing greps were labelled: 31 `DISCRIMINATING`, 23 `MUST-STAY GUARD` — and 3 that
      are neither.** Those three are discriminating in intent, each meant to prove its own task's
      work landed, yet each sat **at or above its PASS value before that task ran** and so could
      not tell "done" from "never started". They are named at `### The three criteria that measured
      non-discriminating` below. The box is false until they are dispositioned, and
      `nyquist_compliant` stays `false`.
- [ ] `nyquist_compliant: true` set in frontmatter — **deliberately NOT set.** Frontmatter line 6
      reads `nyquist_compliant: false`. Setting it true would require the box above to be true, and
      it is not. (Reader beware: this checklist line *quotes* the key, so an unanchored
      `grep -c 'nyquist_compliant: true'` matches this document at **1** whatever the frontmatter
      says. The load-bearing measurement is the line-anchored `grep -c '^nyquist_compliant: true$'`,
      which is **0** — before this task and after it.)

### The reword — annotated in place, with the rejected form preserved

**Reworded 2026-07-30.** The wording this box replaces, verbatim:

> Every acceptance-criteria grep in every plan carries a measured pre-edit count, and none of them
> already sat at its PASS value before the edit it checks

**Why that wording was rejected — two reasons, the second fatal.**

1. **It was measurably false, and plan 04-08 refused to sign over it.** The strings `pre-edit` and
   `must-stay guard` appeared **0 times** in the five plans named above; only `04-08-PLAN.md`
   (16 counts, 8 guard labels, 9 `DISCRIMINATING` labels), `04-03-PLAN.md` (10 counts, 3 guard
   labels) and `04-02-PLAN.md` (5 counts) carried the provenance it asserted. That refusal was
   correct and is not being overturned here.
2. **Its second clause was unsatisfiable by construction for any plan that uses guards** — including
   `04-08-PLAN.md` itself, whose eight must-stay guards sit at their PASS value **by design and
   correctly**. A guard is *defined* by sitting at its PASS value; a box demanding that no criterion
   do so outlaws the very mechanism the phase adopted to prevent the defect. No amount of
   back-filling could have made it true, so a box left permanently red would have stopped carrying
   information.

**Root cause, and it is the orchestrator's rather than the executors'.** The box was introduced by a
plan-review round that revised only `04-02`, `04-03` and `04-08`. The labelling convention was
applied to those three; the box asserted a property of all eight. The five unrevised plans were
never non-compliant with an instruction they were given — they were measured against one written
after they closed.

**The reword is to intent, not a relaxation — and it is strictly harder to satisfy in the way that
matters.** The old wording banned a criterion from sitting at its PASS value. The new wording
permits it **only under an explicit `MUST-STAY GUARD` label**, which is the substantive requirement:
the defect was never that guards exist, it was that a guard could be silently counted as evidence of
work. The new box additionally requires the discriminating half to carry *a measured pre-value that
differs from the PASS value* — a clause the old wording did not state and which is what caught the
three criteria below. Measured consequence: under the old wording this box was permanently red and
said nothing; under the new one it is red for three specific, named, line-numbered reasons.

### The three criteria that measured non-discriminating

These are the reason the box above is still false. Each is **discriminating in intent** — each is
meant to prove that the task it is attached to did its work — but each **already sat at or above its
PASS value on the tree its own task started from**, so none could distinguish "done" from "never
started". None is a guard: a line-count floor and a growth count are progress checks by
construction, and no plan labels them otherwise.

Baselines are the tree each *task* actually started from, which is the only baseline the box's phrase
"before the edit it checks" can mean: wave bases `1bada85` (04-01), `48dbc40` (04-04), `c358c77`
(04-05 / 04-06) and `10458c3` (04-07), and for a Task 2 the tree left by its own Task 1.

| Criterion | Plan | Baseline | Pre-value | PASS at | Final | Verdict |
|---|---|---|---|---|---|---|
| `wc -l …/test/concierge.test.ts` | `04-05-PLAN.md:460` | post-T1 (`4da7cae`) | **586** | ≥ 480 | 1249 | **non-discriminating — floor below the pre-value** |
| `grep -c 'not.toBe' …/test/concierge.test.ts` | `04-05-PLAN.md:445` | post-T1 (`4da7cae`) | **2** | ≥ 2 | 5 | **non-discriminating — floor equals the pre-value** |
| `grep -c 'M-04-' …/test/concierge.test.ts` | `04-07-PLAN.md:281` | wave-4 (`10458c3`) | **5** | ≥ 4 | 11 | **non-discriminating — floor below the pre-value** |

**1. `04-05-PLAN.md:460` — `wc -l packages/concierge/test/concierge.test.ts` is at least 480.**
Task 1's own floor was ≥ 300 and Task 1 landed at **586**. Task 2's floor of 480 was therefore
already met by Task 1's commit (`4da7cae`), before a single S11…S26 case existed. **What it should
have been:** the form `04-03-PLAN.md:747-755` uses for the identical defect one plan earlier —
*"baseline against Task 1's recorded `post-T1 line count: N`, not against a fixed number … the count
at the close of THIS task is at least N + 100"*. 04-03's planner diagnosed this exact trap in prose
(*"a bare 'at least 300' is satisfiable by a Task 1 that happened to land at 320"*) and fixed it
there; 04-05 was not revised in that round and kept the fixed floor. Note that `04-05-SUMMARY.md:179`
records the numbers — *"≥300 after T1 (was 586), ≥480 at close"* — without drawing the conclusion.
The data was captured honestly; only the label is missing.

**2. `04-05-PLAN.md:445` — `grep -c 'not.toBe'` returns at least 2.** The criterion's own text says
the two are *"S9's instance-locality and S22's deliberate non-identity"* — one Task 1 case and one
Task 2 case. But Task 1 had already produced **two** hits: S9's `expect(a).not.toBe(b)` **and** an
unrelated S5 assertion, `expect(after.stageFor({pathname:"/x"})).not.toBe("2")`. The floor was met by
S9 + S5, so S22 — the case the criterion exists to prove — could have been absent with the criterion
still green. **What it should have been:** a floor of ≥ 3 against the measured pre-value of 2, or
better, a literal unique to S22 (its `explain(ctx) !== explain(ctx)` non-identity assertion, which
measured **0** pre-edit and 1 after) — the house preference for a distinctive literal over an
aggregate count.

**3. `04-07-PLAN.md:281` — `grep -c 'M-04-' packages/concierge/test/concierge.test.ts` returns at
least 4.** Its stated purpose is *"the respelling block names its rows"*, so it is the one mechanical
check that 04-07 Task 2's respelling block reached the file — its sibling criteria are record-keeping
obligations and tree guards. On the wave-4 base the file already measured **5**, carried in by
04-05's header, which names M-04-1 once and M-04-4 four times. **This is the most serious of the
three**, because unlike the two above it has no discriminating sibling covering the same work.
**What it should have been:** a floor of ≥ 6 against the measured pre-value of 5, or — better and in
the phase's own idiom — a count of the row IDs the block actually introduces, each of which measured
**0** on the wave-4 base and 1 after: `M-04-16`, `M-04-12`, `M-04-6`, `M-04-7`.
`04-07-SUMMARY.md:212` records *"`grep -c 'M-04-'` | **11** (was 5) | ≥ 4"* — again, the pre-value is
captured and the conclusion is not drawn.

**What this does and does not impugn.** It does **not** impugn the delivered artifact. All three
criteria pass comfortably at a corrected threshold on the final tree (1249 against any sane floor;
5 against ≥ 3; 11 against ≥ 6), and each task's work is independently established by evidence
recorded elsewhere in this document — S11…S26 by the mutant battery (M-04-16, M-04-13, M-04-12 and
M-04-15 each name an S-case in the S11…S26 range as observed red) and by 04-05's own sensitivity
probes on S12 and S19; 04-07 Task 2's block by the four mutant rows it accompanies, all four run with
recorded outcomes. **The defect is in the criteria's power to have detected an absence, not in the
presence of the work.** That is precisely the distinction this box exists to keep, which is why the
finding is recorded rather than waved through.

**Deliberately not fixed here.** Repairing these three means editing acceptance criteria inside
closed, already-executed plans. A back-fill pass is authorised to add provenance and forbidden to
alter any criterion's substance, threshold or command — re-thresholding them would be the executor
grading its own paper, and would erase the evidence that the review round missed them. They are
handed up as a decision.

---

**Approval: WITHHELD** by plan 04-08 Task 2, 2026-07-30. **Withholding sustained** by the
acceptance-criteria back-fill of 2026-07-30, on new evidence.

This is a deliberate outcome recorded on evidence, not an incomplete run. Everything the phase was
asked to prove is proved: seven gates green, 17/17 map rows observed, 16/16 mutants with outcomes
and zero vacuous PASSes, CAT-01 closed, the SEC-03 carve-out and the DSP-09 hand-off intact, the
lockfile byte-identical. The single false box is about the **provenance of acceptance criteria in
five already-closed plans**, not about the correctness of anything this phase shipped.

What changed on 2026-07-30 is the *quality* of that falseness, and it changed for the worse before it
can get better. The box was previously false for a reason no plan could have fixed — it forbade
guards while the phase's own convention requires them. It is now false for three specific criteria at
three named lines, each with a measured pre-value, a stated correct form, and a disposition owed. The
back-fill was undertaken expecting to close this box; it closed 54 of 57 criteria and opened three
findings instead. Signing off over them would be exactly the defect this phase spent seven plans
removing — a check reported as passing because nobody measured it — and it would be worse the second
time, having been measured and then discounted. The phase is complete; its Nyquist compliance is not
yet established, and the two are recorded separately on purpose.
