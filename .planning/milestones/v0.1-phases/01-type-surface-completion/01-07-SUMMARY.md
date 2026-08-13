---
phase: 01-type-surface-completion
plan: 07
subsystem: types
tags: [typescript, readback, dependency-injection, scheduler, session, variance, type-testing, mutation-testing]

# Dependency graph
requires:
  - phase: 01-01
    provides: "tsconfig.test-d.json (the src + test-d program) and test-d/_assert.ts (Expect / Equals / Assignable / Not)"
  - phase: 01-02
    provides: "the measured one-line-predicate rule — all five new assertions sit on one line so tsc echoes the alias name"
  - phase: 01-04
    provides: "ReadbackSink and DigestLike, the two seams this plan gives an arrival point; the app-supplied/core-called direction resolution; the DigestLike/snapshotEquality variance asymmetry"
  - phase: 01-06
    provides: "actions.test-d.ts, the ConciergeConfig erasure positive this appends beside, and the commit-before-mutating discipline"
provides:
  - "Scheduler — (fn, delayMs) => cancel; the third structural stand-in, alongside AbortSignalLike and DigestLike"
  - "ConciergeConfig.presentReadback / .digest / .scheduler — the injected-capability group, beside normalizeSnapshot"
  - "Session.stage (getter) and Session.onStageChange (subscribe-returns-unsubscriber)"
  - "Five named assertions, every one observed firing; the ReadbackSink -> readbackHash chain now has a producer AND a route in"
  - "The measured finding that a field->alias Equals pin does not guard the alias's own shape — and which seam that leaves unguarded"
affects: [01-08, 01-09, phase-06-dispatcher, phase-07-session, phase-08-consent-kernel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Group injected capabilities together on a config interface and say so at the interface level, so the next reader can tell a capability from a policy number"
    - "Assert the FIELD against the alias, and let a separate file assert the alias's SHAPE — then record which regressions each one cannot see"
    - "Prove the ergonomic path at the position the app actually writes it: contextual typing at a field is a different question from contextual typing at a const annotation"
    - "Re-run any battery mutant whose mutated type your new block references, and check the COUNT, not the exit code"
    - "When a threat register claims a mitigation, measure the counterfactual — run the weaker assertion and watch it stay green"

key-files:
  created: []
  modified:
    - packages/concierge/src/types.ts
    - packages/concierge/test-d/actions.test-d.ts

key-decisions:
  - "Scheduler is a structural stand-in, not just a testability seam — setTimeout is TS2304 under lib: [\"ES2022\"], measured, so core has no timer to hard-wire in the first place"
  - "The cancel-returning signature (RESEARCH A3, its one MEDIUM-risk assumption) was kept: a commit window's whole purpose is 'a human interrupted, do not land the effect', which a void-returning scheduler cannot express"
  - "Phase 6 is explicitly handed the open question of what an OMITTED scheduler means, because there is no setTimeout in scope to default to"
  - "Session.stage returns string | null to match Concierge.stageFor exactly, rather than inventing a second spelling of 'no stage'"
  - "onStageChange's callback takes string | null, not string — entering 'no matching stage' is itself a change subscribers must see, because that is when the catalog empties"
  - "Ran three extra mutants beyond the two mandated, so all five named aliases were observed firing rather than two observed and three assumed"

patterns-established:
  - "Measure the counterfactual behind a threat-register mitigation, not just the mitigation"
  - "State at the interface level which members are injected capabilities and which are policy numbers, so a cut field has a documented reason not to be re-added at the site where it would belong"

requirements-completed: [SC-3]

# Metrics
duration: ~35 min
completed: 2026-07-28
---

# Phase 01 Plan 07: The ConciergeConfig Injection Seams and the Session Stage Summary

**`readbackHash` now has a route in as well as a producer — the sink, the digest, and the clock all arrive through one declared group of injected capabilities, and every one of the five new pins was watched failing before it was trusted.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2
- **Files modified:** 2 (0 created, 2 modified) — `+245 / -2`

## Accomplishments

- **SC-3's producer story is closed end to end.** Plan 04 declared `ReadbackSink` and `DigestLike` and nothing consumed them; the sink existed as a type with no seam to arrive through. The chain now runs `ConciergeConfig.presentReadback → ReadbackSink → ReadbackReceipt.hash → DeliveryReport.readbackHash → ConsentAck.readbackHash`, with every link named in a doc comment.
- **`Scheduler` turned out to be structural, not ergonomic.** The plan framed it as testability plus non-standard clocks. Both are true, but a measurement found a third and stronger reason: `setTimeout` is **TS2304** under `lib: ["ES2022"]`. Core has no timer to hard-wire. That puts `Scheduler` in the same class as `AbortSignalLike` and `DigestLike`, and it is now documented that way.
- **All five named aliases were observed firing.** The plan mandates two defect-first proofs; running only those would have left `_configDigest`, `_configScheduler`, and `_sessionOnStageChange` asserted-but-unproven, while Task 2's own `<done>` claims *each* new seam is pinned by an assertion "that has been observed to fire". Three extra mutants closed that gap, each producing **exactly one** diagnostic — so each of those three assertions is provably the sole detector for its seam.
- **T-01-24's mitigation is now measured rather than argued.** The register says `Equals` catches a widening that `Assignable` would not. That was tested directly: under a widened `digest`, an `Assignable` probe produced **zero** diagnostics on the same line where `_configDigest` fired.
- **M5's pinned battery count was re-confirmed and did not drift** — still exactly 2 errors, both in `consent.test-d.ts`, **zero** in `actions.test-d.ts`.
- **A misreadable doc comment was corrected at the exact site where it would have been misread.** See Deviation 1.

## Task Commits

1. **Task 1: `ConciergeConfig` seams, the `Scheduler` type, and the `Session` stage members (D-03 config half, D-08)** — `33c7b33` (feat)
2. **Task 2: The config and session assertions appended to `actions.test-d.ts`** — `72eeec4` (test)

## Files Modified

- `packages/concierge/src/types.ts` — `+150 / -2`, now **1242** lines. `Scheduler` at **1073**; `ConciergeConfig` at **1094** with `presentReadback` at **1135**, `digest` at **1150**, `scheduler` at **1156**; `Session` at **1194** with `stage` at **1213** and `onStageChange` at **1234**. Four hunks; the only two deleted lines are the reworded `maxPerTurn` clause.
- `packages/concierge/test-d/actions.test-d.ts` — `+95 / -0`, now **354** lines. Still exports nothing; still exactly **2** suppression directives.

No file outside the plan's `files_modified` was touched. `README.md`, `STATE.md`, and `ROADMAP.md` are absent from the diff. `pnpm-lock.yaml` unchanged.

## What was declared

| Name | Line | Shape |
|---|---|---|
| `Scheduler` | 1073 | `(fn: () => void, delayMs: number) => () => void` |
| `ConciergeConfig.presentReadback` | 1135 | `?: ReadbackSink` |
| `ConciergeConfig.digest` | 1150 | `?: DigestLike` |
| `ConciergeConfig.scheduler` | 1156 | `?: Scheduler` |
| `Session.stage` | 1213 | `() => string \| null` |
| `Session.onStageChange` | 1234 | `(cb: (stage: string \| null) => void) => () => void` |

`Concierge.dispatch` is byte-identical to base — `git diff` against `0d7e8ec` shows **zero** `+`/`-` lines touching it. It is still non-`async`, per the dedup-by-reference-identity non-negotiable (T-01-25).

## `Scheduler` is a stand-in, not a convenience — and that changes what Phase 6 inherits

RESEARCH flags A3 (the scheduler signature) as its one MEDIUM-risk assumption. The signature was kept as specified, and the cancel-returning form is not arbitrary: a commit window exists so a human can interrupt before an effect lands, and "do not land it" *is* a cancellation. A `=> void` scheduler cannot express the feature the window exists for.

The finding that was **not** in the plan is why the seam is not optional-in-spirit:

```
probe.ts(1,27): error TS2304: Cannot find name 'setTimeout'.
```

under `target: ES2022, lib: ["ES2022"], types: []`. `setTimeout` lives in the DOM lib and in `@types/node`, and this package imports neither — deliberately, because `@types/node` pulls DOM-adjacent globals and defeats the no-DOM guarantee.

The consequence is handed forward rather than papered over: **`scheduler?` is optional, but there is no `setTimeout` in scope for core to fall back to.** Phase 6 must either reach a platform timer through a structural access or make the seam required. Phase 1 declares the shape and says plainly that it is not deciding that, because writing `@default setTimeout` would have been a claim the compiler contradicts.

## The honest limit of the three config assertions

`_configPresentReadback`, `_configDigest`, and `_configScheduler` pin **the field to the alias**. They do not pin the alias's own shape, and this is measured, not inferred: under **M5** — `ReadbackSink` regressed to a defaulted generic alias — `_configPresentReadback` produced **no diagnostic**, because the field and the alias mutate in lockstep. `ConciergeConfig["presentReadback"]` is `ReadbackSink | undefined` under both forms.

That is correct division of labour rather than a hole, but it must be stated so nobody reads these three lines as broader coverage than they are:

| Seam | Field pinned by | Alias shape pinned by |
|---|---|---|
| `presentReadback` | `_configPresentReadback` (this plan) | `_sinkShape` + `_sinkTakesNoTypeArgs`, `consent.test-d.ts` (01-04) |
| `digest` | `_configDigest` (this plan) | **Nothing — and nothing can.** Method syntax has no mutant by design (01-04); grep + doc comment + review only |
| `scheduler` | `_configScheduler` (this plan) | **Nothing.** `Scheduler`'s own shape has no assertion anywhere |

`Scheduler`'s unguarded shape is a **new** entry in that column and is flagged deliberately rather than quietly closed — see *Considered and Deliberately Not Done*.

## Defect-First Proof — six mutants, all observed

Every mutation was applied to `packages/concierge/src/types.ts`, typechecked, and restored with `git checkout --` **inside a single tool call**, with `git diff --exit-code` and `git status --porcelain` asserted clean before the next began. Both source files were committed *before* the battery started, so an empty `git status` is a complete statement that no mutation is applied — 01-06's practice, adopted after 01-05's near-miss. **6/6 restored clean.**

### Mutant A (mandatory) — `presentReadback` retyped to `((rb: unknown) => Promise<unknown>) | undefined`

**Exit 2, 2 errors.**

```
test-d/actions.test-d.ts(285,38): error TS2344: Type 'false' does not satisfy the constraint 'true'.
test-d/actions.test-d.ts(315,10): error TS18046: 'rb' is of type 'unknown'.
```

Line 285 is **`_configPresentReadback`** — the required TS2344. Line 315 is `void rb.payload` inside the contextually-typed sink in `_configWithSeams`, reporting the same defect independently: once the field stops being a generic-function seam, the parameter degrades to `unknown` and the ergonomic path stops compiling. That second diagnostic is the entire reason the fixture is written without a parameter annotation.

### Mutant B (mandatory) — `stage` removed from `Session`

**Exit 2, 2 errors.**

```
test-d/actions.test-d.ts(331,44): error TS2339: Property 'stage' does not exist on type 'Session'.
test-d/actions.test-d.ts(348,3): error TS2353: Object literal may only specify known properties, and 'stage' does not exist in type 'Session'.
```

Line 331 is **`_sessionStage`**; 348 is the `_session` fixture. Both carry the member name on the echoed line.

### M-x (extra) — `digest` widened to `unknown`

**Exit 2, exactly 1 error.** `_configDigest` is the sole detector.

```
test-d/actions.test-d.ts(288,29): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```

### M-y (extra) — the `scheduler` field drops the canceller

**Exit 2, exactly 1 error.** `_configScheduler` is the sole detector.

```
test-d/actions.test-d.ts(291,32): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```

### M-z (extra) — `onStageChange` returns `void` instead of an unsubscriber

**Exit 2, exactly 1 error.** `_sessionOnStageChange` is the sole detector.

```
test-d/actions.test-d.ts(334,37): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```

Worth noting why M-y and M-z each produce exactly one: the fixtures stay green under both, because TypeScript lets a function returning something be assigned where `void` is expected. The fixtures prove constructibility; only the predicates see these regressions.

### M5 re-run — `ReadbackSink` as a defaulted generic alias

Not a proof of this plan's work but of its **non-interference**. 01-04 carried forward the rule: check the diagnostic count against VALIDATION's battery after adding any assertion. This plan adds two new references to `ReadbackSink`, so M5 was re-run.

**Exit 2, exactly 2 errors — VALIDATION's pinned row, unchanged. Zero errors in `actions.test-d.ts`.**

```
test-d/consent.test-d.ts(129,26): error TS2344: Type 'false' does not satisfy the constraint 'true'.
test-d/consent.test-d.ts(134,1): error TS2578: Unused '@ts-expect-error' directive.
```

**Plan 09's battery needs no adjustment for this plan.**

### The T-01-24 counterfactual, measured

The threat register justifies `Equals` over `Assignable` for the three config seams. That justification was tested rather than asserted: under M-x, a throwaway `Expect<Assignable<DigestLike, ConciergeConfig["digest"]>>` was added at line 288, directly above the real assertion.

**Exit 2, exactly 1 error — at line 289, `_configDigest`. The `Assignable` probe at 288 produced nothing.**

`Assignable<DigestLike, unknown>` is `true`, so an `Assignable`-based suite would have been green over a seam widened to the top type. Both files were restored in the same tool call and the probe was deleted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A doc comment told the reader `maxPerTurn` "belongs" on `ConciergeConfig` — read at the exact moment someone is editing `ConciergeConfig`**

- **Found during:** Task 1, while reading `readsUntrusted`'s doc comment for the plan's "do not add `maxPerTurn`" instruction.
- **Issue:** the comment read "`maxPerTurn` is runner-level in every framework checked and belongs beside `commitWindowMs` on `ConciergeConfig`". The planning record is more careful: CONTEXT line 646 says "*if it ever ships*", RESEARCH line 103 says "**not scheduled**", and this plan's own instruction says CONTEXT records it as "unscheduled, not merely relocated". The comment had dropped the qualifier, leaving a bare relocation directive — and the only reader who encounters it while it matters is one editing `ConciergeConfig`, which is this plan. The plan spends a paragraph pre-empting this exact mistake, which suggests the planner saw the risk without seeing its source.
- **Fix:** the clause now reads "so `ConciergeConfig` — beside `commitWindowMs` — is where it *would* belong **if it ever shipped, which is not scheduled**". Two deleted lines; the only deletions in this plan.
- **Verification:** `grep -v '^[[:space:]]*[*/]' src/types.ts | grep -c maxPerTurn` still **0**, so 01-06's comment-filtered acceptance grep is undisturbed.
- **Committed in:** `33c7b33`

**2. [Rule 2 - Missing Critical] Three of the five named assertions would have shipped unproven**

- **Found during:** Task 2, after the two mandated proofs.
- **Issue:** the plan mandates defect-first proofs for `_configPresentReadback` and `_sessionStage` only, but Task 2's `<done>` reads "**each** new seam is pinned by a named assertion that has been observed to fire", and T-01-24 names all three config assertions as verified-defect-first in this plan. As written, `_configDigest`, `_configScheduler`, and `_sessionOnStageChange` would have been asserted-but-unobserved — the precise condition 01-04 discovered on `ReadbackReceipt`'s two literal fields, where two mutants produced **zero** diagnostics against a suite that looked complete.
- **Fix:** three extra mutants (M-x, M-y, M-z), each producing exactly one diagnostic, plus the T-01-24 `Assignable` counterfactual.
- **Verification:** above. All restored clean.
- **Committed in:** no source change — the assertions were already correct; this deviation is the *evidence*, recorded here.

**3. [Rule 3 - Blocking] The worktree had no `node_modules`**

- **Found during:** pre-Task-1 baseline.
- **Issue:** `tsc` absent, and `pnpm --filter @fullselfbrowsing/concierge typecheck` is the sole verification mechanism for both tasks. Fifth consecutive Phase 1 worktree to hit this.
- **Fix:** `pnpm install --frozen-lockfile --prefer-offline` (198 ms). `--frozen-lockfile` forbids resolution, so nothing beyond the committed lockfile can enter. Workspace bootstrap, **not** a package addition — T-01-SC's "no packages installed" disposition holds.
- **Verification:** `git diff --exit-code pnpm-lock.yaml` clean before and after.

**4. [Rule 1 - Bug] The test file's header described a file that no longer matched it**

- **Found during:** Task 2, before appending.
- **Issue:** `actions.test-d.ts`'s header enumerates the file's contents (SC-7a, SC-7b, SC-7g, escapee 3, the erasure positives). Appending 95 lines covering a different decision would have left the header silently incomplete — the self-invalidating-prose class this phase has now logged four times.
- **Fix:** one sentence added naming the final block and recording *why* it lives in this file rather than a fifth one (the `ConciergeConfig` erasure positive is already here, and one interface asserted from two files drifts).
- **Committed in:** `72eeec4`

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 missing critical, 1 blocking)
**Impact on plan:** no scope creep. No file outside `files_modified` touched, no dependency added, no export removed, `src/index.ts` untouched, `README.md` untouched.

### Considered and Deliberately Not Done

**A shape assertion for `Scheduler` was designed and not added.**

`type _schedulerShape = Expect<Equals<Scheduler, (fn: () => void, delayMs: number) => () => void>>;` would close the one genuinely new gap this plan opens: `Scheduler`'s own shape is pinned by nothing, so an edit to the alias — dropping the canceller, reordering the parameters — is invisible to the entire suite. `_configScheduler` cannot see it, because field and alias mutate together (measured under M5 for the equivalent `ReadbackSink` case).

It was not added for one reason, and it is a weaker reason than 01-06's, so it is recorded as a live option rather than a closed decision: **RESEARCH A3 marks this signature MEDIUM-risk and explicitly expects Phase 6 to refine it.** An `Equals` pin on a shape the project has already announced it may change would fire as a *false alarm* on a sanctioned edit, and the failure mode of a false alarm is that the next person deletes the assertion — which is how a suite loses the pins that were load-bearing. The behaviour that actually matters (the field carries the alias; the alias returns a canceller) is covered by `_configScheduler` plus the doc comment.

**Plan 09 is the right place to decide this**, with the whole battery in view — the same disposition 01-06 gave its rejected M9 second detector. If Phase 6 settles the signature, the pin becomes free and should be added then. Unlike 01-06's case, adding it now would **not** drift any pinned expectation: VALIDATION's 01-07 rows are marked *mechanics* and pin no diagnostic set, and M1–M10 contains no mutant touching this plan's artifacts.

### Not Done, Deliberately

- **No `maxPerTurn` member.** D-04 cut it; CONTEXT records it as unscheduled. It is now named in two comments — `readsUntrusted`'s and `ConciergeConfig`'s new interface-level note — for the sole purpose of explaining why it is absent at the site where someone would add it. Comment-filtered grep: **0**.
- **`Concierge.dispatch` untouched.** Still `(name, args, meta?) => Promise<ActionResult>`, still not `async`. Zero diff lines against base.
- **`src/index.ts` untouched.** `Scheduler` is a new export that this plan does not wire into the public surface; **01-08 owns the export debt**, which now stands at ten symbols including 01-06's `AnyActionDefinition`.
- **`ReadbackAttestation` still not declared.** D-12 item 1, Phase 8. Nothing here grants `attested`; it only declares the seam through which the raw payload reaches the human.
- **No `@default` on `scheduler`.** Deliberate — see the `Scheduler` section. Core cannot name `setTimeout`.
- **`.planning/STATE.md` and `.planning/ROADMAP.md` untouched.** The orchestrator owns those writes after the wave.

## Issues Encountered

**The mutation-hygiene protocol held under a two-file mutation.** The T-01-24 counterfactual required mutating `types.ts` *and* temporarily editing `actions.test-d.ts` in the same measurement. Both were restored inside the same tool call and `git diff --exit-code` asserted immediately after. This is the first Phase 1 measurement that touched two files at once, and it is worth flagging that the discipline scales only because both files were already committed — an untracked file has no `git checkout --` restore, which is 01-05's near-miss in one sentence.

**A recurring class showed up for the fourth time in this phase:** prose that asserts something no check can falsify goes stale silently. Deviations 1 and 4 are both instances. Deviation 1 is the more interesting one, because the stale prose was not merely inaccurate — it was an *instruction*, positioned to be read by the one agent who could act on it.

## Verification Results

| Check | Result |
|---|---|
| `pnpm --filter @fullselfbrowsing/concierge typecheck` | exit **0** |
| `pnpm typecheck` (repo root) | exit **0** |
| Mutant A non-zero with TS2344 on `_configPresentReadback` | **yes** — 2 errors |
| Mutant B non-zero naming `_sessionStage` | **yes** — 2 errors (TS2339 + TS2353) |
| M-x non-zero, `_configDigest` sole detector | **yes** — exactly 1 error |
| M-y non-zero, `_configScheduler` sole detector | **yes** — exactly 1 error |
| M-z non-zero, `_sessionOnStageChange` sole detector | **yes** — exactly 1 error |
| M5 re-run still exactly 2 errors, both in `consent.test-d.ts` | **yes** — 0 in `actions.test-d.ts` |
| T-01-24 counterfactual: `Assignable` probe silent, `Equals` fires | **yes** — probe 0, `_configDigest` 1 |
| `types.ts` restored clean after every mutant | **yes**, 6/6 (`git diff --exit-code`) |
| Every mutant diagnostic carried its alias on the echoed line | **yes**, 6/6 |
| `export type Scheduler` present | line **1073** |
| `presentReadback?: ReadbackSink` / `digest?: DigestLike` / `scheduler?: Scheduler` | **1135** / **1150** / **1156** |
| All three seams grouped beside `normalizeSnapshot` | **yes** (1129–1156) |
| `Session.stage` returns `string \| null` | line **1213** |
| `Session.onStageChange` returns an unsubscriber | line **1234** |
| `Concierge.dispatch` unchanged (diff lines vs base) | **0** |
| `maxPerTurn` outside comments | **0** |
| `digest` doc names both `crypto.subtle` and `webcrypto.subtle` | **yes** |
| `presentReadback` doc tells the app to write its sink generically | **yes** |
| `DigestLike` method-syntax grep still `1` / `digest:` still `0` | **yes** |
| Five named aliases present, one occurrence each | **yes** |
| One `ConciergeConfig` value populating all three seams | **yes** (`_configWithSeams`) |
| One `Session` value implementing all four members | **yes** (`_session`) |
| `grep -c "type Booking"` in `actions.test-d.ts` | **1** |
| `@ts-expect-error` count in `actions.test-d.ts` | **2** |
| `test -z "$(grep -l '^[[:space:]]*export' test-d/*.test-d.ts)"` | exit **0** |
| `setTimeout` under `lib: ["ES2022"]` | **TS2304**, measured |
| `git diff --exit-code pnpm-lock.yaml` | exit **0** |
| `README.md` in diff vs base | **no** |
| `.planning/STATE.md`, `.planning/ROADMAP.md` in diff vs base | **no** |
| Files changed vs base | exactly **2** |
| File deletions across both commits | **none** |
| Untracked files left behind | **none** |
| Working tree clean before SUMMARY | **yes** |

## Threat Model Compliance

| Threat ID | Disposition | Status |
|---|---|---|
| T-01-23 | accept | **Unchanged and correct.** `digest?` is app-supplied; the catalog author is the app author. Injection is chosen so core owns no unaudited crypto (ASVS V6 by delegation), and the doc comment states that a browser passes `crypto.subtle` and a server passes `webcrypto.subtle`, both unmodified. An app supplying a broken digest remains out of scope. |
| T-01-24 | mitigate | **Closed, and the mitigation itself is now measured.** All three config seams are `Equals`, not `Assignable`. Each was observed firing — `_configPresentReadback` (Mutant A), `_configDigest` (M-x), `_configScheduler` (M-y), the latter two as sole detectors. The counterfactual was run: an `Assignable` probe stayed **green** against a `digest` widened to `unknown`. **Scope note:** these guard the *field*, not the alias's shape — see the table above, which records `Scheduler`'s shape as newly unguarded. |
| T-01-25 | mitigate | **Closed.** `Concierge.dispatch` is byte-identical to base — zero diff lines — and remains non-`async`. It was not "tidied" while the interface directly below it was edited. |
| T-01-SC | accept | **No packages installed.** The only pnpm invocation was `install --frozen-lockfile --prefer-offline`, which forbids resolution; `pnpm-lock.yaml` byte-identical. |

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or trust-boundary schema change. The three new seams *narrow* the app→core boundary already in the register (T-01-23) by declaring exactly which capabilities cross it; none can be constructed or invoked by anything that runs today.

## Known Stubs

None in this plan's artifacts — every declaration is a complete type and no placeholder value was introduced.

Four **deliberate** gaps the verifier should not mistake for incompleteness:

1. **Nothing calls `presentReadback`, `digest`, or `scheduler`.** Phase 1 ships types only. The dispatcher that drives the two windows is **Phase 6 (DSP-08)**; the kernel that calls the sink and the digest is **Phase 8**.
2. **`Session.stage` and `Session.onStageChange` have no implementation.** **Phase 7** owns the session loop, and both doc comments say so on the member.
3. **`Scheduler` is exported from `types.ts` but not from `src/index.ts`.** That is **01-08's** export-debt task; every new type from 01-02 onward is in the same state.
4. **An omitted `scheduler` has no defined meaning yet,** because core has no `setTimeout` to fall back to. Flagged for Phase 6 on the declaration rather than silently defaulted.

## Next Phase Readiness

Three things to carry forward:

1. **`Scheduler` joins 01-08's export list.** `StageDefinition` and `ConciergeConfig` were already unusable by name without `AnyActionDefinition`; `ConciergeConfig` is now additionally unusable without `Scheduler`, since `scheduler?` references it in the public surface. `ReadbackSink` and `DigestLike` were already on that list from 01-04.
2. **Plan 09 has a decision to make about `Scheduler`'s shape pin**, described in *Considered and Deliberately Not Done*. Unlike 01-06's deferred M9 detector, adding it drifts no pinned expectation — VALIDATION's 01-07 rows are *mechanics* and M1–M10 contains no mutant for this plan's artifacts. The argument against is that Phase 6 is expected to change the signature, so the pin would fire on a sanctioned edit.
3. **Phase 6 inherits an explicit open question**, not a silent gap: what an omitted `scheduler` means, given `setTimeout` is TS2304 in this program. The answer is either a structural global access or making the seam required, and both are cheap while nothing has published.

## Self-Check: PASSED

- `packages/concierge/src/types.ts` — FOUND
- `packages/concierge/test-d/actions.test-d.ts` — FOUND
- `.planning/phases/01-type-surface-completion/01-07-SUMMARY.md` — FOUND
- Commit `33c7b33` (Task 1) — FOUND in git log
- Commit `72eeec4` (Task 2) — FOUND in git log
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — exit 0
- `pnpm typecheck` (root) — exit 0
- `git status --porcelain` clean of unintended source modifications
- `README.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` absent from the diff against base `0d7e8ec`

---
*Phase: 01-type-surface-completion*
*Completed: 2026-07-28*
