---
phase: 4
slug: stages-catalog-assembly-and-explain
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-30
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Infrastructure, sampling, Wave 0 and mutant obligations seeded from `04-RESEARCH.md`
> `## Validation Architecture`. The Per-Task Verification Map is filled by the planner.

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
| **Measured baseline** | `pnpm test` → 6 files / 55 tests green in 328 ms; `pnpm typecheck` → exit 0 |

### Three command traps that will otherwise waste executor time

1. **`pnpm test -- <fragment>` does NOT filter.** Vitest's cac CLI discards everything after `--`.
   Tenth reproduction across Phases 2–4. Every command in this document uses the bare form.
2. **`pnpm build` must precede `pnpm test`.** Every runtime test imports `../dist/index.js`, and
   `artifact.test.ts` / `export-surface.test.ts` read `../dist/index.d.ts` from disk. Runtime tests
   import `dist/`, **never** `../src/`.
3. **The mutation harness reports a vacuous PASS on a mutant that breaks the build.** A build failure
   prints `PASS: gate fired (exit 1), tree clean` having run zero tests. After every PASS, confirm
   from the gate's *output* that the mutant compiled and the tests actually ran.

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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(filled by planner)* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement → Evidence Map

Seeded from `04-RESEARCH.md`. Every row is an observable assertion, not a description.

| Req | Observable evidence | Layer | Command |
|-----|---------------------|-------|---------|
| **STG-01** | `catalogFor({pathname:"/results"}).map(t=>t.name)` equals `["applyFilter","sortResults","signOut"]` — checkout actions **absent from the array**, not rejected | runtime | `pnpm test concierge` |
| **STG-01** | unrouted path → cross-stage only; `stageFor` returns `null` | runtime | `pnpm test concierge` |
| **STG-01** | every element is an `EmittedTool` — has `type:"function"`, carries **no** `handler` and **no** `schema` key | runtime | `pnpm test concierge` |
| **STG-02** | two stages both `match: () => true` → `stageFor` is the **first** | runtime | `pnpm test concierge` |
| **STG-02** | renaming a later stage to the integer-like id `"2"` leaves resolution unchanged | runtime | `pnpm test concierge` |
| **STG-03** | a stage matching on `{modalOpen:true, cartCount:3}` with **no `pathname` anywhere** resolves correctly | runtime | `pnpm test concierge` |
| **STG-03** | `StageContext` admits dot- and bracket-access on non-`pathname` keys | type | `pnpm typecheck` |
| **STG-04** | `catalogFor(ctxA)` `toBe` `catalogFor(ctxB)` for distinct objects resolving to one stage | runtime | `pnpm test concierge` |
| **STG-04** | two no-stage contexts share one reference under the `null` key | runtime | `pnpm test concierge` |
| **STG-04** | two separate `createConcierge` instances do **not** share an array (cache is instance-local) | runtime | `pnpm test concierge` |
| **SEC-03** | `catalogFor(ctx).push(evilTool)` throws **and** `length` is unchanged | runtime | `pnpm test concierge` |
| **SEC-03** | `catalogFor(ctx)[0].name = "evil"` throws **and** the name is unchanged | runtime | `pnpm test concierge` |
| **SEC-03** | `catalogFor(ctx)[0].parameters.properties.key.type = "number"` throws — elements are *deep*-frozen, which is what makes the shallow projection freeze sufficient | runtime | `pnpm test concierge` |
| **SEC-03** | the same `EmittedTool` object appears in two stage arrays (`toBe`) — pins the element-sharing invariant | runtime | `pnpm test concierge` |
| **SEC-03** | `entries[0].action.schema` is still **not** frozen and still validates (03-06 C22 must stay green) | runtime | `pnpm test catalog` |
| **CAT-03** | a typo'd `requires` throws; `issues[0].code === "consent_target_missing"`; `issues[0].action` is the **referrer**; `problem` contains the **target** | runtime | `pnpm test catalog` |
| **CAT-03** | `requires` naming the action itself yields `consent_self_reference`, **not** `consent_target_missing` | runtime | `pnpm test catalog` |
| **CAT-03** | a **forward** reference builds **clean** — the false positive an in-loop placement produces | runtime | `pnpm test catalog` |
| **CAT-03** | `requires` naming a **cross-stage** action builds clean | runtime | `pnpm test concierge` |
| **CAT-03** | a consent typo **plus** three other faults throws once with four issues — aggregation survives the post-pass | runtime | `pnpm test catalog` |
| **CAT-03** | `CatalogIssueCode` includes both new members | type | `pnpm typecheck` |
| **DX-01** | `explain(ctx)` returns `{stage, stages, catalog}` and nothing else (`Object.keys` length 3) | runtime | `pnpm test concierge` |
| **DX-01** | `explain(ctx).stage` equals `stageFor(ctx)` for matched, unmatched, and throwing-matcher configs | runtime | `pnpm test concierge` |
| **DX-01** | `explain(ctx).catalog` equals `catalogFor(ctx).map(t => t.name)` | runtime | `pnpm test concierge` |
| **DX-01** | with two overlapping matchers, both rows report `matched: true` while `stage` is the first — the shadowed-stage case | runtime | `pnpm test concierge` |
| **DX-01** | a `BridgeRegistry` whose `read()` returns `null` reports `bridge: {id, registered:false}`; a bridge reports `true`; no `bridge` field reports `null` | runtime | `pnpm test concierge` |
| **DX-01** | deep-frozen: `explain(ctx).stages.push(...)` throws, and `explain(ctx).stages[0].matched = true` throws | runtime | `pnpm test concierge` |
| **DX-01** | `explain(ctx) !== explain(ctx)` — the deliberate **non**-identity, asserted as a positive claim | runtime | `pnpm test concierge` |
| **DX-01** | `explain` writes nothing to the console (plain global assignment restored in a `finally`) | runtime | `pnpm test concierge` |
| matcher policy | a throwing `match()` is skipped, warns **once** naming the stage across three `catalogFor` calls | runtime | `pnpm test concierge` |
| matcher policy | a matcher returning a truthy non-boolean does **not** match and warns naming the stage | runtime | `pnpm test concierge` |
| stage-id policy | two stages sharing an `id` warn once, and the index-keyed memo serves each its **own** actions | runtime | `pnpm test concierge` |
| PKG-04 | `createConcierge` reaches `assertSingleInstance` transitively via `buildCatalog` | runtime | `pnpm test single-instance` |
| export surface | counts and names move in the same commit; `createConcierge` in `VALUE_EXPORTS` | runtime | `pnpm build && pnpm test export-surface` |
| type pin | `_inlineDefineActionLosesTheUnion` stays **red-as-pinned** (if it flips, delete it — do not relax it) | type | `pnpm typecheck` |

---

## Wave 0 Requirements

- [ ] `packages/concierge/test/concierge.test.ts` — STG-01/02/03/04, SEC-03 projection half, DX-01,
      matcher policy, stage-id policy. Opens with a "What escapes without this file" header.
- [ ] `packages/concierge/test-d/concierge.test-d.ts` — `StageContext` access shapes,
      `Explanation`/`StageExplanation` shapes, `createConcierge` signature, `EmittedTool` readonly pin
- [ ] `packages/concierge/test/catalog.test.ts` — new describe block for CAT-03 (five cases)
- [ ] `packages/concierge/test-d/catalog.test-d.ts` — `CatalogIssueCode` union assertion
- [ ] `packages/concierge/test-d/exports.test-d.ts` — new predicate + shared import line
- [ ] `packages/concierge/test/export-surface.test.ts` — updated counts, `it` titles, array entry
- [ ] `packages/concierge/test/single-instance.test.ts` — `createConcierge` call-site case

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

Every literal count below was taken at research time and **must be re-taken at implementation time**.

| # | File | Literal → replacement | Gate | Expected red |
|---|------|----------------------|------|--------------|
| M-04-1 | `src/concierge.ts` | `Object.freeze(` (projection call) → `(` | `pnpm build && pnpm test concierge` | `push` and element-write SEC-03 cases fail |
| M-04-2 | `src/concierge.ts` | `memo ??= new Map` → `memo = new Map` | `pnpm build && pnpm test concierge` | STG-04 identity case fails |
| M-04-3 | `src/concierge.ts` | `memo.set(` line → deleted | `pnpm build && pnpm test concierge` | STG-04 identity case fails from the other direction |
| M-04-4 | `src/concierge.ts` | `for (const stage of stages)` in `stageFor` → reversed iteration | `pnpm build && pnpm test concierge` | first-match-wins fails. **Requires distinct loop spellings in `stageFor` and `explain`** or the literal is not unique |
| M-04-5 | `src/concierge.ts` | `result === true` → `result !== false` | `pnpm build && pnpm test concierge` | truthy-non-boolean case fails |
| M-04-6 | `src/concierge.ts` | `catch` body's `return false` → `throw` | `pnpm build && pnpm test concierge` | throwing-matcher case fails |
| M-04-7 | `src/concierge.ts` | no-stage branch → `[]` | `pnpm build && pnpm test concierge` | no-stage-returns-cross-stage case fails |
| M-04-8 | `src/concierge.ts` | `...crossNames]` → `]` | `pnpm build && pnpm test concierge` | STG-01 — `signOut` missing from the results catalog |
| M-04-9 | `src/catalog.ts` | `!seenNames.has(requires)` → `false` | `pnpm build && pnpm test catalog` | CAT-03 typo case fails |
| M-04-10 | `src/catalog.ts` | `requires === action.name` → `false` | `pnpm build && pnpm test catalog` | `consent_self_reference` case fails |
| M-04-11 | `src/catalog.ts` | `!seenNames.has(requires)` → `!new Set<string>().has(requires)` | `pnpm build && pnpm test catalog` | forward-reference and cross-stage-target clean-build cases fail. **The only mutant proving the check reads the complete name set** |
| M-04-12 | `src/concierge.ts` | in `explain`, `matched && active === null` → `matched` | `pnpm build && pnpm test concierge` | two-overlapping-matchers case fails |
| M-04-13 | `src/concierge.ts` | `deepFreeze(` in `explain` → `Object.freeze(` | `pnpm build && pnpm test concierge` | `explain(ctx).stages[0].matched = true` no longer throws |
| M-04-14 | `src/types.ts` | `explain: (ctx: StageContext) => Explanation;` → deleted | `pnpm typecheck` | `test-d/concierge.test-d.ts` goes red |
| M-04-15 | `src/concierge.ts` | the duplicate-stage-id warn call → deleted | `pnpm build && pnpm test concierge` | stage-id policy warn case fails |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Whether `explain()`'s three fields actually answer "why didn't my action fire" for a developer who did not write the library | DX-01 | Prose quality is a human judgment; the verifier can assert the fields exist but not that they are legible | Read the `explain()` output for a shadowed-stage config and a no-bridge config; judge whether the next debugging step is obvious without opening the source |
| Whether the two new CAT-03 issue messages state an actionable fix | CAT-03, DX-03 | Same — the mechanical half (action named, `fix` non-empty) is automated | Read both `problem`/`fix` pairs; confirm each names the referring action *and* the missing target |

---

## Two behaviours with no single-literal mutant — stated rather than faked

1. **Rename-independence (STG-02).** A property of the data structure (an ordered `ReadonlyArray`,
   not a keyed object), not of a branch. Producing it requires rewriting resolution to key by id — a
   multi-line change no `<literal> <replacement>` swap expresses. The test is a regression detector
   against a future rewrite. M-04-4 covers the adjacent, mutatable property.
2. **The element-sharing invariant (SEC-03).** "The shallow projection freeze is sufficient *because*
   elements are shared and already deep-frozen" cannot be mutated into existence — building fresh
   elements per projection is a restructuring. M-04-1 proves the array freeze fires; the `toBe`
   sharing assertion and the nested-schema-write assertion together pin the invariant. **The test
   header must say that removing either one leaves the shallow freeze silently insufficient.**

Both must be written into the test file as comments, per the house convention.

---

## Explicitly NOT closed by this phase

- **SEC-03 is not fully closed.** The handler-replacement and tool-array halves close here. The
  consumer-supplied-`jsonSchema` getter channel (04-RESEARCH Pitfall 9) is measured open and is not
  this phase's to fix. Do not write "SEC-03 closed" without that carve-out.
- **CAT-04** (transport grade ceiling) — Phase 8.
- **A non-string / missing `consent.requires`** — skipped deliberately, recorded as a residual in the
  doc comment in the style of `catalog.ts:348-359`. Revisit with Phase 8's kernel.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] Every mutant literal count re-taken unfiltered at implementation time
- [ ] Every mutant PASS confirmed to have COMPILED and RUN TESTS (not a vacuous build-failure PASS)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
