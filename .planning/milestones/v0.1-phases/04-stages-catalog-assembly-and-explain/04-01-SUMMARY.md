---
phase: 04-stages-catalog-assembly-and-explain
plan: 01
subsystem: types
tags: [typescript, isolatedDeclarations, readonly, dx, explain, stages]

# Dependency graph
requires:
  - phase: 01-type-contract-and-repo-shape
    provides: "`Concierge`, `EmittedTool`, `Transport.setTools`, `BridgeRegistry`, `StageContext`, `Session.stage()`, and the `Transport.capabilities` readonly precedent this plan cites"
  - phase: 03-action-declaration-and-build-time-validation
    provides: "hand-off #2 — the inline-`defineAction` widening mechanism and its pinned-red predicate in `test-d/catalog.test-d.ts`"
provides:
  - "`Explanation` and `StageExplanation` as named exported interfaces in `types.ts` (NOT yet re-exported from `src/index.ts`)"
  - "`Concierge.explain: (ctx: StageContext) => Explanation` as the interface's fourth member"
  - "`EmittedTool`'s four fields are `readonly` — the type surface no longer looser than the runtime freeze"
  - "The inline-`defineAction` required spelling, documented on `ConciergeConfig.stages` and `.crossStage`"
  - "`createConcierge<const C extends ConciergeConfig>` recorded as measured-and-declined"
affects: [04-02, 04-03, 04-04, 04-06, 05-bridges, 06-dispatch, 07-session-and-transport]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A `readonly` must go all the way down or not be claimed — `Transport.capabilities`'s argument, now applied one level down to `EmittedTool`"
    - "A doc-comment claim ships verbatim in `dist/index.d.ts`, so its code spelling must be one that actually compiles under the repo's own flags"

key-files:
  created: []
  modified:
    - packages/concierge/src/types.ts

key-decisions:
  - "`Explanation.stage` is `string | null` and nothing else, matching `Concierge.stageFor` and `Session.stage()` — a third spelling of 'no stage' would be the defect that note exists to prevent"
  - "`StageExplanation.bridge` is `{readonly id; readonly registered} | null`; rejected `string | null` (loses `registered`, must widen in Phase 5) and a `\"unknown\"` third state (unreachable once Phase 5 lands, then dead prose in a shipped `.d.ts`)"
  - "`Explanation.catalog` is the action-NAME list, not the `EmittedTool` array — the full array is one `catalogFor(ctx)` call away and D-04's 'prefer fewer, better-justified fields' governs"
  - "`Concierge.explain` is documented as deliberately NOT identity-stable, the exact inverse of `catalogFor`'s memo rule, so nobody wires it into `useSyncExternalStore`"
  - "The doc comment records the measured spelling `catalogFor(ctx)[0]!.name = \"evil\"` with the non-null assertion, because the bare form fails at the index access (TS2532) under `noUncheckedIndexedAccess` and would have shipped a claim that does not compile"
  - "The inline-`defineAction` widening is documented, not fixed — fixing means re-narrowing collections D-07 erased to `any` for a measured contravariance reason (TS2375). Phase 8 / D-12.2 owns the revisit"

patterns-established:
  - "Re-measure every inherited claim in your own worktree before it ships as prose — five probes were run and one changed the text that shipped"
  - "Corrections annotated in place with the rejected alternative and its reason, never silently rewritten"

requirements-completed: [DX-01, SEC-03, STG-03, STG-04]

# Metrics
duration: 8min
completed: 2026-07-30
---

# Phase 4 Plan 01: Type Contract for Stages, `explain`, and a Non-Lying `EmittedTool` Summary

**`Explanation`/`StageExplanation` as named exported interfaces, `Concierge.explain` as a fourth member, and `EmittedTool`'s four fields tightened to `readonly` — closing the gap where the runtime freeze was doing work the type system was not.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-30T22:12:40Z
- **Completed:** 2026-07-30T22:20:32Z
- **Tasks:** 2
- **Files modified:** 1 (`packages/concierge/src/types.ts`, +199/−5)

## Accomplishments

- `EmittedTool`'s four fields are `readonly`. The mutation `catalogFor(ctx)[0]!.name = "evil"` no longer typechecks — measured green before the edit and red after, in this worktree.
- `Explanation` and `StageExplanation` are named exported interfaces, so `isolatedDeclarations` has something to name and 04-03 has a real shape to write against.
- `Concierge` has a fourth member, `explain`, whose doc comment carries the one mandatory sentence: the returned object is deliberately not identity-stable.
- The most natural way to declare an action — inline, inside `StageDefinition.actions` or `ConciergeConfig.crossStage` — is now documented as lossy at the exact site a developer meets it, with the working spelling named and the declined `const`-type-parameter fix recorded as measured.

## Task Commits

1. **Task 1: Add `Explanation`, `StageExplanation`, `Concierge.explain`, and readonly `EmittedTool`** — `c68f508` (feat)
2. **Task 2: Record the inline-`defineAction` spelling on `ConciergeConfig.stages` and `.crossStage`** — `22746a1` (docs)

**Plan metadata:** see the final `docs(04-01)` commit in this worktree.

## Files Created/Modified

- `packages/concierge/src/types.ts` — four hunks. `EmittedTool` gains a doc comment and four `readonly` modifiers; `StageExplanation` and `Explanation` are declared between `Scheduler` and `ConciergeConfig`; `Concierge` gains `explain`; `ConciergeConfig.stages` and `.crossStage` gain the inline-declaration paragraphs.

## Required Output — the four things 04-02, 04-03 and 04-06 must write against

### 1. The M-04-14 mutant literal, and its unfiltered count

```
explain: (ctx: StageContext) => Explanation;
```

```console
$ grep -F -o -- 'explain: (ctx: StageContext) => Explanation;' packages/concierge/src/types.ts | wc -l
1
```

Counted **unfiltered** (comments included), per `mutate-and-prove.sh` Known Limitation 3. It occurs exactly once, on one line, and no formatter split it. It also occurs exactly once in the built `dist/index.d.ts` (line 1503).

### 2. `Explanation` and `StageExplanation`, verbatim

Field lines exactly as they stand in `packages/concierge/src/types.ts` — write against these, not against any plan's prose:

```ts
export interface StageExplanation {
  readonly id: string;
  readonly matched: boolean;
  readonly bridge: { readonly id: string; readonly registered: boolean } | null;
}

export interface Explanation {
  readonly stage: string | null;
  readonly stages: ReadonlyArray<StageExplanation>;
  readonly catalog: ReadonlyArray<string>;
}
```

Note for 04-03: `StageExplanation.bridge` is an **inline object type**, not a named interface. That was deliberate — it is used at exactly one site and naming it would add a fourth type to a surface D-04 asks to keep small. If 04-03 finds it needs a name in an implementation signature, adding one is additive and non-breaking.

### 3. `test/export-surface.test.ts` was NOT touched, and still reads 59 / 49 / 10

```console
$ git diff --name-only 1bada85..HEAD | grep -c export-surface
0
```

The file is unmodified. Its three assertions — `toHaveLength(59)`, `types 49`, `values 10` — are green, verified by a full `pnpm test` run after each task.

`Explanation` and `StageExplanation` **do** appear in `dist/index.d.ts` (as non-exported `interface` declarations at lines 1219 and 1267, pulled in because `Concierge.explain` references them) but appear in **zero** `export` statements, which is why the count did not move. **04-02 / 04-04 must add both names to `src/index.ts` and move all three export-surface pins together** — 59 → 61, 49 → 51 types, values unchanged at 10.

### 4. The `EmittedTool` readonly pin, for 04-06

The pin must be `Expect<Equals<EmittedTool, Readonly<EmittedTool>>>`. `Assignable` is not a substitute and this was verified one level down at `test-d/catalog.test-d.ts:300-301`, whose comment records the measurement: a mutable-shaped object IS assignable to a readonly-shaped one, so an `Assignable` spelling stays green with every modifier deleted. The `EmittedTool` doc comment now names `_emittedToolMembersAreReadonly` by the identifier 04-06 is planned to use — if 04-06 picks a different name, update the doc comment with it.

## Measurements Taken In This Worktree

Every claim this plan added to shipped prose was re-measured here before it was written, per the standing rule. Five probes, all run through `pnpm typecheck` against `src/types.ts` in a scratch `test-d/` file that was deleted before any commit (`git status` verified clean after each).

| # | Claim | Result |
|---|---|---|
| 1 | `c.catalogFor(ctx)[0]!.name = "evil"` typechecks with mutable `EmittedTool` | **Compiles clean** — confirmed the gap |
| 2 | The same line with `readonly` members | **Errors** — `@ts-expect-error` satisfied; confirms the fix is load-bearing |
| 3 | Inline `defineAction` in a contextually-typed `StageDefinition.actions` | `name` accepts `"not-alpha"` — **literal lost** |
| 3b | Inline `defineAction` in a contextually-typed `ConciergeConfig.crossStage` | `name` accepts `"not-signOut"` — **literal lost**, measured at that site rather than inferred from the sibling |
| 3c | The `const`-first spelling | `name` is `"alpha"` and rejects `"not-alpha"` — **literal kept** |
| 4 | `as const` on the actions array repairs it | **No** — still wide |
| 5 | `createConcierge<const C extends ConciergeConfig>(config: C)` recovers the literal | **Yes** — `"not-alpha"` rejected through the returned `C` |

Baseline before any edit: `pnpm typecheck`, `pnpm build`, `pnpm test` all exit 0 at 6 files / 55 tests. Same after each task. `pnpm check:artifact` and `pnpm check:deps` also re-run green after Task 1 (attw/publint clean, zero runtime bytes).

## Decisions Made

- **`StageExplanation` and `Explanation` are declared after `Scheduler` and before `ConciergeConfig`**, not immediately before `Concierge`. Both positions satisfy the plan's instruction ("after `Scheduler`, before `Concierge`"); this one keeps `ConciergeConfig` and `Concierge` adjacent, which mirrors `createConcierge(config: ConciergeConfig): Concierge`. Both are inside the existing `// Concierge` section banner.
- **`StageExplanation.id` carries a note that ids are not unique.** CONTEXT locks 04-03 to keying the memo by declaration **array index** precisely because two stages can share an id, and `explain()` reports the id. A reader of this row needs to know its position — not its `id` — is the unambiguous identifier, or they will write a lookup that collapses the same way the id-keyed memo would have.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] The plan's `[0].name` spelling does not compile under the repo's own flags**

- **Found during:** Task 1, while measuring the claim rather than transcribing it.
- **Issue:** The plan, CONTEXT, PATTERNS and RESEARCH all spell the motivating mutation as `catalogFor(ctx)[0].name = "evil"`. Under this repo's `noUncheckedIndexedAccess: true`, that exact line fails at the **index access** with `TS2532: Object is possibly 'undefined'` — *before* it ever reaches the assignment the sentence is about. Writing it into the doc comment would have shipped a code claim that does not compile, in a file that ships verbatim inside `dist/index.d.ts`. This is precisely the repudiation threat the plan's own register books as `T-04-19 | mitigate`, and precisely the class of false claim 03-08 spent a plan removing from the published declarations.
- **Fix:** The doc comment uses `concierge.catalogFor(ctx)[0]!.name = "evil"` — the spelling actually measured — and carries a short annotated note explaining why the `!` is there and that the bare form fails at a different site. Annotated in place rather than silently corrected, per house style.
- **Files modified:** `packages/concierge/src/types.ts`
- **Verification:** Probes 1 and 2 above. The bare form was observed failing with TS2532; the `!` form was observed compiling with mutable members and failing with `readonly` ones.
- **Committed in:** `c68f508`

**2. [Rule 1 — Bug] The first draft of the Task 2 prose never named `crossStage` in text**

- **Found during:** Task 2, running the plan's own acceptance greps.
- **Issue:** `grep -c 'crossStage' packages/concierge/src/types.ts` returned **1** against a required floor of 2. Not a grep artifact — the note attached to `crossStage` said "this array" and `{@link ConciergeConfig.stages}`, so the only line in the whole file containing the string `crossStage` was the field declaration. A developer grepping for the field name would find the declaration and none of the guidance about it, and the paragraph on `stages` named only `StageDefinition.actions` as the affected surface when the plan requires both be named.
- **Fix:** The `stages` paragraph now names `{@link ConciergeConfig.crossStage}` as the sibling affected site; the `crossStage` note names `crossStage` three times in prose, including in the imperative ("then reference it in `crossStage`"). Count is now 4.
- **Files modified:** `packages/concierge/src/types.ts`
- **Verification:** All four Task 2 acceptance greps re-run and pass; `pnpm typecheck`/`build`/`test` re-run green.
- **Committed in:** `22746a1` (fixed before the commit, so the defect never landed)

---

**Total deviations:** 2 auto-fixed (1 missing-critical, 1 bug)
**Impact on plan:** Both are corrections to prose that would have shipped inside `dist/index.d.ts`. Neither expands scope — one file touched, comment-and-modifier changes only, no runtime code. No scope creep.

## Issues Encountered

- **`crossStage`'s one-line comment became a block comment.** The plan says its existing text ("Available in every stage. Erased like `StageDefinition.actions`.") "stays and the new paragraph goes beneath it". It does stay — verbatim, as the block's first line — but `git diff` records the single-line `/** … */` form as removed. That one removed line is the **only** deletion in Task 2, it is a comment line, and its text is preserved character-for-character. No non-comment line was touched in either task; the only non-comment deletions in the whole plan are `EmittedTool`'s four field lines, which the plan explicitly changes.
- **Worktree base correction at startup.** `git merge-base HEAD 1bada85` returned HEAD (`e4e353f`), meaning the worktree was checked out *behind* the expected base rather than diverged from it. Reset to `1bada85` per the startup protocol; the reset discarded nothing, since HEAD was an ancestor.

## Known Stubs

None in the code sense — this plan adds no runtime. `Explanation`, `StageExplanation` and `Concierge.explain` are **declared and not yet implemented**, which is the plan's stated purpose ("a `types.ts` that Phase 4's runtime can be written against"). 04-03 implements them; nothing in `src/` implements `Concierge` today, so there is no partial implementation to mistake for a finished one.

## Threat Flags

None. This plan opens no network endpoint, no auth path, no file access, and changes no schema at a trust boundary. Its one security-relevant change, `EmittedTool`'s `readonly` modifiers, is `T-04-08`'s planned `mitigate` disposition and is already in the register. `T-04-SC` holds: nothing was installed, and `pnpm-lock.yaml` is byte-identical to the base commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready.** `types.ts` now carries everything Phase 4's runtime is written against, and it went in with no runtime change at all.

Three hand-offs, in the order they will bite:

1. **04-02 / 04-04 own the export surface.** `Explanation` and `StageExplanation` are declared but **not** re-exported. Adding them to `src/index.ts` moves the pins to **61 total / 51 types / 10 values**. Both pins — `test/export-surface.test.ts` and `test-d/exports.test-d.ts` — must move in that same commit.
2. **04-03 writes against §2 above, not against any plan's prose.** In particular `Explanation.catalog` is `ReadonlyArray<string>` (names), and `StageExplanation.bridge`'s object is inline and unnamed.
3. **04-06's readonly pin must use `Equals`.** See §4. The `EmittedTool` doc comment already names `_emittedToolMembersAreReadonly`; keep the identifier in step or update the comment.

One standing instruction inherited and now written into `types.ts` where a configuring developer will read it: if `_inlineDefineActionLosesTheUnion` ever flips green, the gap has **closed** — delete the predicate *and* the paragraphs added here. Do not relax either.

## Self-Check: PASSED

- `packages/concierge/src/types.ts` — FOUND (modified, 199 insertions / 5 deletions vs base `1bada85`)
- Commit `c68f508` — FOUND in `git log`
- Commit `22746a1` — FOUND in `git log`
- `git status --porcelain` — empty (only `packages/concierge/src/types.ts` was ever modified; all scratch probe files deleted)
- `git diff --stat -- pnpm-lock.yaml` vs base — empty
- `pnpm typecheck` / `pnpm build` / `pnpm test` — exit 0, 6 files / 55 tests
- `test/export-surface.test.ts` — unmodified, 59/49/10 green
- STATE.md / ROADMAP.md — NOT modified (orchestrator owns them)

---
*Phase: 04-stages-catalog-assembly-and-explain*
*Completed: 2026-07-30*
