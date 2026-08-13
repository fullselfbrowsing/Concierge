---
phase: 04-stages-catalog-assembly-and-explain
plan: 05
subsystem: concierge
tags: [STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01, CAT-03, testing, freeze, memoization, explain]

# Dependency graph
requires:
  - plan: 04-01
    provides: "`Explanation` / `StageExplanation` field shapes, readonly `EmittedTool`"
  - plan: 04-03
    provides: "`createConcierge` in the barrel, the rendered warning texts, the mutant-literal inventory, and the `pnpm test test/concierge` scoping note"
  - phase: 03-action-declaration-and-build-time-validation
    provides: "`test/catalog.test.ts` as the exact analog, `test/fixtures/schemas.ts`, the C12 console-capture form"
provides:
  - "`packages/concierge/test/concierge.test.ts` — 25 behavioural cases (S1…S26, S15 is prose) against `dist/index.js`"
  - "Executable evidence for STG-01, STG-02, STG-03, STG-04, SEC-03's projection half, DX-01, CAT-03's cross-stage row, the matcher policy and the stage-id policy"
  - "Five sensitivity observations, each a case watched go red under a deliberate regression"
  - "The measured finding that S13 does NOT detect the element-freeze removal — only S12 and S14 do"
affects: [04-06, 04-07, 04-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A pin in two halves, stated in the header: S13 + S14 together, neither alone, because the behaviour has no single-literal mutant"
    - "Observe the case red under a deliberate regression BEFORE accepting it green — five times, restoring by checksum rather than by eye"
    - "A deliberate non-claim written as prose (S15), never as a vacuously-passing check"

key-files:
  created:
    - packages/concierge/test/concierge.test.ts
  modified: []

key-decisions:
  - "A fresh S-series rather than a continuation of catalog.test.ts's C-series — C-numbers are cited by ID across 03-*-SUMMARY.md and a silent collision is a citation defect"
  - "S26 uses THREE stages sharing one id, not the plan's two — three is what proves the scan keeps two sets rather than one, and it strictly contains the two-stage claim"
  - "S15 is a comment block, not an `it`, so the file has 25 cases across an S1…S26 range; a vacuously-passing SEC-03-carve-out check would be worse than prose"
  - "`declare()` defaults `redact: \"drop\"` here — the INVERSE of catalog.test.ts's decision, because this file builds through `createConcierge`, which must succeed"
  - "S23 captures `warn`, `error` AND `log` — a diagnostic reaching for `console.log` would satisfy a warn-only capture while printing on every call"

requirements-completed: [STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01, CAT-03]

# Metrics
duration: ~50min
completed: 2026-07-30
---

# Phase 4 Plan 05: The Behavioural Suite for `createConcierge` Summary

**Twenty-five cases against the built artifact, five of which were watched go red under a deliberate regression before being accepted green — and a header that names, with its measurement, each of the five defects that would otherwise ship green.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 2
- **Files:** 1 created, 0 modified. `packages/concierge/src/concierge.ts` was edited transiently three times and restored by SHA-256 each time.

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1 | Header, harness, and the STG-01/02/03/04 + CAT-03 blocks — S1…S10 | `4da7cae` | test |
| 2 | SEC-03, DX-01, matcher policy and stage-id policy — S11…S26 | `2533163` | test |

Neither commit deleted a tracked file (`git diff --diff-filter=D` empty on both).

---

## Required Output

### 1. The final S-series range, and one line per case

**Range: S1…S26. 25 `it` blocks — S15 is a comment block, not a case, which is not an off-by-one and is stated in the file's own header.**

| ID | Claim |
|---|---|
| S1 | The results stage is offered `[applyFilter, sortResults, signOut]`; `confirmBooking` is **absent** (its own expectation, not implied by `toEqual`); checkout is `[confirmBooking, signOut]`. |
| S2 | An unrouted context gets the cross-stage actions **only**, and `stageFor` is `null` — not an empty array, with the fail-closed rejection argued in place. |
| S3 | Every element is `{type:"function", name, description, parameters}` and `"handler" in tool` / `"schema" in tool` are both `false`. |
| S4 | Two stages both matching: the **first declared** wins, in `stageFor` and in `catalogFor`. |
| S5 | Renaming the **LATER** stage to the integer-like id `"2"` changes nothing; the naive first-stage shape is written into the comment as measured-unable-to-discriminate. |
| S6 | A stage matching on `{modalOpen, cartCount}` with **no `pathname` anywhere** resolves, and the near-miss does not. |
| S7 | Two **distinct context objects with different keys** resolving to one stage return the identical array (`toBe` and `Object.is`, both spelled out). |
| S8 | Two distinct no-stage contexts share one array under the `null` key. |
| S9 | Two instances from equivalent configs do **not** share an array; contents equal; each instance still internally stable. |
| S10 | A consent policy naming a **cross-stage** action builds clean; the same shape with a target declared nowhere throws `CatalogValidationError`. |
| S11 | `push` onto the returned array throws **and** the length is unchanged **and** the injected name is absent. |
| S12 | An element's `name` write throws **and** the name is unchanged **and** is not `"evil"`. |
| S13 | A **nested** schema write (`parameters.properties.key.type`) throws **and** the value is unchanged. |
| S14 | The `signOut` tool object in the results array **is** the one in the checkout array; it is frozen; the two arrays are different objects. |
| S15 | *(prose)* SEC-03 is **not fully closed** — the consumer-supplied `jsonSchema` getter channel is recorded, not fixed. |
| S16 | `Object.keys(explain(ctx))` is exactly `["stage","stages","catalog"]`, length 3. |
| S17 | `explain().stage` equals `stageFor()` across a matching config, a non-matching one (both `null`), and one whose only matcher throws. |
| S18 | `explain().catalog` equals `catalogFor().map(t => t.name)` for a matched and an unmatched context, and equals the literal name list. |
| S19 | Two overlapping matchers: **both** rows `matched: true` while `stage` is the first, and `catalog` is the first's. |
| S20 | Bridge states via a hand-rolled registry: `{id, registered:false}`, `{id, registered:true}`, and `null` for a stage declaring none. |
| S21 | `explain().stages.push({})` throws **and** the length is unchanged; `stages[0].matched = true` throws **and** the value stays `false`. |
| S22 | `explain(ctx) !== explain(ctx)`, asserted as a positive claim, and the two fresh objects still carry the same answer. |
| S23 | `explain` writes nothing to `warn`, `error` **or** `log` — captured length 0. |
| S24 | A throwing matcher: the stage is skipped, the other stage's catalog is served, **three** calls produce **exactly one** warning, it names `boom`, and it does **not** contain `SECRET-FROM-THE-APP`; `explain` row is `{id:"boom", matched:false, bridge:null}`. |
| S25 | A matcher returning `"yes"` does not match, resolution continues to the next stage, and exactly one warning names `truthy`. |
| S26 | **Three** stages sharing one id each serve their **own** actions, with **exactly one** warning naming the id; all three contexts report the same id through `stageFor`. |

### 2. File and test totals — two different commands, two different measurements

```
$ pnpm build && pnpm test test/concierge
 Test Files  1 passed (1)
      Tests  25 passed (25)

$ pnpm build && pnpm test
 Test Files  7 passed (7)
      Tests  85 passed (85)
```

Baseline on this worktree before the plan: **6 files / 60 tests**, and `pnpm test test/concierge` measured **"No test files found", exit 1** — so the scoped criterion could not have been satisfied by inaction. `pnpm test concierge` still does not filter (every test path contains the substring); `pnpm test -- <x>` still discards the fragment.

### 3. The five sensitivity observations

Every one was run in this worktree. The three that touch `src/` restored by SHA-256 comparison, not by eye.

| # | Case | What was mutated | Observed |
|---|---|---|---|
| 1 | **S5** | The **test**: rename the FIRST stage instead of the later one (the naive shape) | **Still green, 10/10.** This is the point, not a reassurance: the naive shape cannot tell an array-ordered implementation from a keyed one, because the first stage is first under both. Executable evidence for header defect 4. |
| 2 | **S7** | `src/concierge.ts`: `memo.set(index, built);` commented out (M-04-3), rebuilt | **RED — 3 failed / 7 passed.** S7, S8 **and** S9 all fired; S9's internal-stability half is what caught it there. Restored, rebuilt, 10/10 green. |
| 3 | **S10** | The **test**: `consent: { requires: "signOut" }` → `"signOutTypo"` | **RED — 1 failed / 9 passed**, `CatalogValidationError: concierge: 1 problem(s) in the action catalog.` So S10 measures the CAT-03 rule rather than measuring that nothing checks anything. Restored. |
| 4 | **S12** | `src/concierge.ts`: `Object.freeze(tool)` → `(tool)` (M-04-16), rebuilt | **RED — 2 failed / 23 passed: S12 and S14.** **S11 stayed green** (the projection's own seal is a separate statement) and **S13 stayed green** — see §5, this is a finding. Restored, rebuilt, 25/25 green. |
| 5 | **S19** | `src/concierge.ts`: `rows.findIndex((row) => row.matched)` → `rows.map((row) => row.matched).lastIndexOf(true)` (M-04-12), rebuilt | **RED — 1 failed / 24 passed**, S19 alone. Restored, rebuilt, 25/25 green. |

### 4. S13's exact property path, taken from the real emitted `parameters`

Probed against `dist/index.js` with the `zodObject` fixture before the assertion was written:

```
parameters keys:    [ '$schema', 'type', 'properties', 'required' ]
properties keys:    [ 'key', 'value' ]
properties.key:     {"type":"string"}
nested write:       TypeError
```

**The path is `parameters.properties.key.type`, and S13 reads the property name out of the object rather than hard-coding it** — `Object.keys(tools[0].parameters.properties)[0]`, then pinned with `expect(propertyName).toBe("key")`. The emitted shape is the vendor's, not ours: `emission.test.ts`'s table records that zod spells "no members" as `properties: {}` while arktype omits the key entirely, so a hard-coded path would be a claim about a converter rather than about the freeze.

### 5. The finding that sharpens the header's own claim — S13 does **not** detect the element freeze

Under the M-04-16 mutant (`Object.freeze(tool)` → `(tool)`), **S13 stayed green.** That is correct and worth recording precisely, because it is easy to read S13 as the element-freeze detector:

- `parameters` is deep-frozen by `buildCatalog`, **independently** of the tool's own seal, and is assigned into the tool by reference. So the nested write throws whether or not the tool is sealed.
- S13 therefore detects "elements are deep-frozen **beneath** `parameters`". **S12** detects the tool's own seal. **S14** detects that the elements are shared rather than rebuilt.

This is the header's "one pin in two halves" claim measured rather than asserted, and it is stronger than the plan's wording: the three cases detect three different things, and the invariant that makes the cheap projection seal sufficient is only expressed by S13 **and** S14 together. S14 also fired under the mutant, on its `Object.isFrozen(signOutInResults)` half — so the element seal has two detectors and the shallow-projection argument has one pin.

### 6. `git diff -- packages/concierge/src/` at close

```
$ git diff -- packages/concierge/src/
(empty)

$ shasum -a 256 packages/concierge/src/concierge.ts
56c24f883e8e228f84013a6754d3047078c38cdd56955976350b44d7b7438deb
```

Identical to the pre-probe checksum recorded before the first transient edit. Each of the three probes was restored from a byte copy and re-verified by checksum, not by reading the diff.

### 7. Acceptance greps, final values

| Check | Value | Required |
|---|---|---|
| `grep -c 'What escapes without this file:'` | 1 | 1 |
| `grep -F -c 'The result of getSnapshot should be cached to avoid an infinite loop'` | 1 | 1 (the SOURCE string, not react.dev's abbreviation) |
| `grep -rn 'vi\.' packages/concierge/test/` | 0 matches | 0 |
| non-comment lines containing `../src/` | 0 | 0 |
| `grep -ci 'sideEffects\|tree-shak\|treeshake'` | 0 | 0 |
| `grep -c 'existsSync'` | 2, guard message contains `` pnpm build `` | ≥1 |
| `grep -c 'finally'` | 5 | ≥2 |
| `grep -c 'SECRET-FROM-THE-APP'` | 2 (the throw and the negative assertion) | ≥2 |
| `grep -c 'not.toBe'` | 5 | ≥2 |
| `grep -c 'SEC-03 is not fully closed'` | 1 | ≥1 |
| `wc -l` | **1158** | ≥300 after T1 (was 586), ≥480 at close |
| `it` blocks | 25 | the full S-series |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] S26 uses THREE stages sharing one id, not the plan's two**

- **Found during:** Task 2, writing the stage-id block.
- **Issue:** The plan's S26 text says "two stages sharing one `id`". The phase's critical-constraints brief says three, and three is the discriminating number: `createConcierge` keeps **two** sets (`seenStageIds` and `reportedStageIds`) precisely so that a **third** stage sharing the id does not produce a second warning. With two stages, a single-set implementation and the shipped two-set one are indistinguishable.
- **Fix:** three stages, each matching a different context, each asserted to serve its own actions, with `toHaveLength(1)` on the capture. Strictly contains the plan's two-stage claim.
- **Files:** `packages/concierge/test/concierge.test.ts` · **Commit:** `2533163`

**2. [Rule 1 — Correctness] S17's comment claimed console output a passing run does not actually show**

- **Found during:** Task 2 verification.
- **Issue:** The first draft carried `catalog.test.ts` C11's sentence verbatim — "a warning is printed to this test run's own console. That output is expected, not a failure". Measured: the default reporter surfaces **nothing** in a passing run. `pnpm test test/concierge | grep -c 'concierge: \['` is 0, and `catalog.test.ts`'s own C11 warning is equally invisible (`grep -c destructive_without_consent` on a `pnpm test test/catalog` run is also 0).
- **Fix:** the comment now states what was measured — the default sink runs and reaches the host console, the reporter does not surface it in a passing run, so no capture is installed and the suite output stays clean either way. The C11 cross-reference survives; the unverified half of its sentence does not.
- **Files:** `packages/concierge/test/concierge.test.ts` · **Commit:** `2533163`

**3. [Rule 2 — Missing Critical] S23 captures three console sinks, not one**

- **Issue:** The plan says "assert `captured` has length 0" using the C12 form, which captures `warn` only. The claim is "`explain` writes **nothing** to the console" — an implementation reaching for `console.log` or `console.error` would satisfy a `warn`-only capture while printing on every call.
- **Fix:** one `sink` function installed on `warn`, `error` and `log`, restored in the same `finally`. The C12 form is otherwise unchanged, and all four of its load-bearing notes are carried forward verbatim.
- **Files:** `packages/concierge/test/concierge.test.ts` · **Commit:** `2533163`

**Total deviations:** 3 auto-fixed (2 missing-critical, 1 correctness). No architectural changes, no new dependencies, no package installs, no new fixture file. One file created; nothing else in the repository modified.

---

## Issues Encountered

- **Worktree base correction at startup.** `git merge-base HEAD c358c77` returned `e4e353f`, so the worktree was checked out on an older tip rather than diverged from the wave-2 base. Reset to `c358c77` per the startup protocol before any read. (04-03's summary records the same shape one wave earlier; it appears to be systematic rather than incidental.)
- **`pnpm install` was required first** — the worktree is a fresh checkout with no `node_modules`. Run without `--frozen-lockfile`; `pnpm-lock.yaml` came back byte-identical.
- **The default reporter hides console output on a passing run**, which invalidated a sentence inherited from `catalog.test.ts` (deviation 2). Worth knowing before writing any comment that promises visible console output.

## Known Stubs

None. Every case in this file asserts against the shipped artifact. The one thing deliberately **not** asserted is recorded as prose in S15 and is a carve-out, not a stub: a getter inside a consumer-supplied `jsonSchema` survives the freeze, is measured open, and is out of this phase's scope.

## Threat Flags

None — this plan adds a test file and opens no network endpoint, no auth path and no file access pattern. Every `mitigate` disposition in the plan's register now has an executable assertion:

| Threat | Evidence |
|---|---|
| T-04-01 (tampering with the tool array) | S11, S12, S13 — write-throws **and** value-unchanged at three levels; S14 pins the invariant the shallow seal depends on |
| T-04-05 (the matcher warning as a covert channel) | S24's `expect(captured[0]).not.toContain("SECRET-FROM-THE-APP")` |
| T-04-03 (wrong-stage catalog via colliding ids) | S26, both halves, on three stages |
| T-04-04 (a matcher that throws inside the render) | S24 — skipped rather than propagated, one warning across three calls |
| T-04-06 (cross-request pollution under SSR) | S9; the comment states the SSR reason and the measured-false bundler reason appears nowhere (grep = 0) |
| T-04-07 (a consumer `jsonSchema` getter) | **accept** — S15 records it as prose so no reader concludes SEC-03 is fully closed |
| T-04-12 (`explain()`'s output) | S16 pins the field set at exactly three |
| T-04-21 (a test that cannot discriminate) | Five cases observed red under a deliberate regression — S5, S7, S10, S12, S19 |
| T-04-SC (supply chain) | Nothing installed, no new fixture, no React or Svelte; `pnpm-lock.yaml` byte-identical |

## Verification

| Gate | Result |
|---|---|
| `pnpm build` | exit 0 (attw + publint clean) |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0 — **7 files / 85 tests** |
| `pnpm test test/concierge` | exit 0 — **1 file / 25 tests** |
| `git diff -- packages/concierge/src/` | empty; checksum identical to pre-probe |
| `git diff --stat -- pnpm-lock.yaml` | empty |
| `git diff --name-only c358c77..HEAD` | one file: `packages/concierge/test/concierge.test.ts` |
| `STATE.md` / `ROADMAP.md` | **not** modified — the orchestrator owns them |
| Files owned by 04-06 (`test-d/concierge.test-d.ts`, `test/single-instance.test.ts`) | **not** touched |

## Notes for Later Plans

- **04-06:** this plan touched only `test/concierge.test.ts`. `test-d/` and `test/single-instance.test.ts` are untouched. The three transient `src/concierge.ts` probes were each restored and checksum-verified before the next step, so nothing of this plan's is in flight.
- **04-07:** four of the battery's mutants were run **by hand** here and each is confirmed to produce a red case with the build **green** — which is Pitfall 11's requirement that the harness's `PASS: gate fired` be attributable to a test rather than to a compile error. M-04-3 → S7/S8/S9. M-04-16 (`Object.freeze(tool)` → `(tool)`) → S12 **and** S14; **not** S13, and not S11. M-04-12 (`findIndex` → last match) → S19 alone. The M-04-12 replacement that compiles cleanly under `isolatedDeclarations` is `rows.map((row) => row.matched).lastIndexOf(true)`.
- **04-08:** §5 above is the honest accounting of what each SEC-03 case detects, and it is finer-grained than the plan's prose. Any phase-close statement about SEC-03 must carry S15's carve-out verbatim. The file's header is the canonical statement of the two behaviours with no single-literal mutant.
- **Scoped runs:** `pnpm test test/concierge`. `pnpm test concierge` runs all 7 files; `pnpm test -- <x>` filters nothing. `pnpm build` must precede `pnpm test`.

## User Setup Required

None.

## Self-Check: PASSED

- `packages/concierge/test/concierge.test.ts` — FOUND (created, 1158 lines, 25 `it` blocks)
- Commit `4da7cae` — FOUND in `git log`
- Commit `2533163` — FOUND in `git log`
- `packages/concierge/src/concierge.ts` — unmodified, SHA-256 `56c24f88…438deb`, identical to the pre-probe value
- `pnpm-lock.yaml` — byte-identical to the base commit
- `.planning/STATE.md`, `.planning/ROADMAP.md` — NOT modified
- No file deleted by either commit (`git diff --diff-filter=D` empty on both)

---
*Phase: 04-stages-catalog-assembly-and-explain*
*Completed: 2026-07-30*
