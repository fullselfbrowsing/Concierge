---
phase: 05-bridge-registry-and-the-no-bridge-path
plan: 04
subsystem: core-runtime-tests
tags: [vitest, bridge-registry, mutation-testing, contract-pins, console-capture, esm]

# Dependency graph
requires:
  - phase: 05-bridge-registry-and-the-no-bridge-path
    plan: 01
    provides: "`createBridge` in `src/bridge.ts` — the monotonic-token registry, its frozen return, and the rendered `bridge_overwrite` text this file pins"
  - phase: 05-bridge-registry-and-the-no-bridge-path
    plan: 03
    provides: "`createBridge` reachable from `dist/index.js`, the artifact every case here imports"
  - phase: 04-stages-catalog-assembly-and-explain
    provides: "`test/concierge.test.ts` — the numbered-header pattern, the artifact guard, the contract-registry reset, the console-capture idiom and the warn-once assertion triad"
provides:
  - "`packages/concierge/test/bridge.test.ts` — 21 cases (B1-B21) proving BRG-01, BRG-02, BRG-04, the frozen-capability guarantee and both warn policies against the built artifact"
  - "all thirteen mount/unmount orderings, with the five non-discriminating ones labelled CONTRACT PIN in both the `it` title and an inline comment"
  - "a measured case-id-to-mutant map: which of B1-B21 each of six mutants turns red, run end to end this session"
  - "the re-measured object-guard agreement figure — NINE of thirteen, not the ten recorded in `src/bridge.ts` and in the plan"
affects: [05-05, 05-06, 05-07, 06-dispatch, 09-adapters]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Console capture as a MUFFLER, not only as an assertion subject — the ordering cases that displace a live registration wrap in the capture helper so the suite keeps emitting zero diagnostic lines"
    - "Anti-vacuity by asserting the setup: B20 asserts its setup capture is exactly 1 before asserting the refusal capture is 0, so a stand-in console that never fired cannot make the real claim pass"
    - "A contract-pin label is scoped to a NAMED set of implementations, not to 'no mutant reddens it' — measured, two pins go red under an unrelated register-time mutant while staying green under both guard defects"

key-files:
  created:
    - packages/concierge/test/bridge.test.ts
  modified: []

key-decisions:
  - "B20's console capture is scoped to the refusal alone, because O2b as a whole emits `bridge_overwrite` by design — the plan's literal 'run O2b under capture and assert zero' would have failed"
  - "The object-guard agreement figure is written as NINE, measured this session, against the ten recorded in `src/bridge.ts:245` and in the plan"
  - "The `bridge_overwrite` rendering is pinned by exact text AND by the three semantic claims, a deliberately different judgement from the off-page sentence's rejected vocabulary regex — the rendering is a recorded handoff artifact, so drift should go red"
  - "Requirements were NOT marked complete in REQUIREMENTS.md — see Deviations"

patterns-established:
  - "Prove the pin labelling rather than assert it: the M-05-1 and M-05-2 probes are run and the five contract pins are shown to stay GREEN under both, which is the only evidence that the CONTRACT PIN label is honest"

requirements-completed: []

# Metrics
duration: 18min
completed: 2026-07-31
---

# Phase 5 Plan 04: The bridge registry's runtime proof Summary

**One new 810-line test file, `packages/concierge/test/bridge.test.ts`, taking the suite from 90 to 111: all thirteen mount/unmount orderings with the five non-discriminating ones labelled CONTRACT PIN in title and comment, plus BRG-02 liveness, the frozen capability and both warn policies — and six mutants run end to end this session showing exactly which cases each one reddens, including the measurement that the five pins stay green under both guard defects.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-31T22:08Z
- **Completed:** 2026-07-31T22:26Z
- **Tasks:** 3
- **Files modified:** 1 (created)

## Accomplishments

- 21 cases, `B1`–`B21`, all against `dist/index.js` behind an `existsSync` guard. Suite **90 → 111**, `pnpm build`, `pnpm test` and `pnpm typecheck` all green.
- All thirteen orderings present and asserted with `toBe`. **Zero `toEqual` in the file.**
- The five non-discriminating orderings are labelled `CONTRACT PIN` in the `it` title *and* in an inline comment, and the labelling is **proven** rather than claimed: under M-05-1 and M-05-2 all five stay green while the eight discriminating cases go red exactly as the matrix predicts.
- **Six mutants run end to end**, each via `scripts/mutate-and-prove.sh`, each reporting `PASS: gate fired (exit 1), tree clean`. The plan defers this to 05-07; running it here means 05-07 inherits a measured map instead of a prediction.
- The suite's zero-diagnostic-output invariant is preserved: `pnpm test | grep -c "concierge: \["` was **0** before this file and is **0** after, despite five orderings that displace a live registration.

## Task Commits

1. **Task 1 (05-04-T1): File scaffold, header, and the guards** — `a2d2897` (test)
2. **Task 2 (05-04-T2): The thirteen orderings — BRG-01 and BRG-04** — `eb7dbe0` (test)
3. **Task 3 (05-04-T3): BRG-02 liveness, the frozen capability, the warn policies** — `d5c5d88` (test)

## Files Created/Modified

- `packages/concierge/test/bridge.test.ts` (created, 810 lines, 21 `it` cases).

**Not modified, deliberately:** `src/bridge.ts` and every other source file (this plan writes tests only — the mutation probes restore and prove restoration), `test/bridge-snapshot.test.ts` (05-05), `test-d/bridge.test-d.ts` and `test/single-instance.test.ts` (05-06), `test/fixtures/` (nothing added — `git status --porcelain` on it is empty), and the shared orchestrator artifacts `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md`.

---

## Handoff data — read this section, 05-07 depends on it

### The case-id-to-ordering map

| Case | Ordering | `read()` | Discriminates | `describe` |
|---|---|---|---|---|
| B1 | O6 — never registered | `null` | **nothing — CONTRACT PIN** | BRG-01 |
| B2 | O1 `reg A(u1); u1(); reg A(u2)` | `A` | **nothing — CONTRACT PIN** | BRG-01 |
| B3 | O3 `reg A(u1); u1(); u1(); reg B` | `B` | **nothing — CONTRACT PIN** | BRG-01 |
| B4 | O5 `reg A; reg B(u2); u2()` | `null` | **nothing — CONTRACT PIN** | BRG-01 |
| B5 | O7 `reg A(u1); u1()` | `null` | **nothing — CONTRACT PIN** | BRG-01 |
| B6 | O2 `reg A(u1); reg B; u1()` | `B` | M-05-2 | BRG-01 |
| B7 | O3b `reg A(u1); u1(); reg B; u1()` | `B` | M-05-2 | BRG-01 |
| B8 | O4 `reg A; reg B(u2); reg A; u2()` | `A` | M-05-2 | BRG-01 |
| B9 | O8 `reg A(u1); reg B(u2); reg A(u3); u2()` | `A` | M-05-2 | BRG-01 |
| B10 | O1b — O1 then the stale `u1` again | `A` | **M-05-1** + M-05-2 | BRG-04 |
| B11 | O2b `reg A(u1); reg A(u2); u1()` | `A` | **M-05-1** + M-05-2 | BRG-04 |
| B12 | O4b `reg A(u1); reg B; reg A(u3); u1()` | `A` | **M-05-1** + M-05-2 | BRG-04 |
| B13 | O4c `reg A(u1); reg A; reg A(u3); u1()` | `A` | **M-05-1** + M-05-2 | BRG-04 |
| B14 | `read()` is the registered object by reference | — | register-time normalizer | BRG-02 |
| B15 | app moves, same `read()` result reports the new value | — | register-time normalizer | BRG-02 |
| B16 | `Object.isFrozen(registry)` | — | M-05-7 | SEC-03 class |
| B17 | `registry.read = fn` and `registry.extra = 1` both throw | — | M-05-7 | SEC-03 class |
| B18 | `register()` still works after the freeze | — | M-05-7 | SEC-03 class |
| B19 | overwrite warns exactly once, names the id, echoes nothing | — | M-05-10 | warn policies |
| B20 | a refused unsubscriber warns never | — | **M-05-11** + M-05-1 + M-05-2 | warn policies |
| B21 | the ordinary first registration warns not at all | — | register-time normalizer | warn policies |

### The mutation battery, run this session — measured, not predicted

Every row: `scripts/mutate-and-prove.sh packages/concierge/src/bridge.ts <pattern> <replacement> -- bash -c 'pnpm build > … && pnpm test > …'`. Every row returned **`PASS: gate fired (exit 1), tree clean`**, and `git status` was empty after all six.

| Mutant | Pattern → replacement | Cases reddened | Count |
|---|---|---|---|
| **M-05-1** | `if (slot?.token === token)` → `if (slot?.bridge === bridge)` | **B10, B11, B12, B13**, B20 | 5 failed / 106 passed |
| **M-05-2** | `if (slot?.token === token)` → `if (true)` | B6, B7, B8, B9, B10, B11, B12, B13, B20 | 9 failed / 102 passed |
| **M-05-7** | `return Object.freeze(registry);` → `return registry;` | B16, B17, B18 | 3 failed |
| **M-05-10** | `warnedOverwrite = true;` → `warnedOverwrite = false;` | B19 | 1 failed |
| **M-05-11** | `if (slot?.token === token) {` → `if (slot?.token !== token) { warnHost(bridgeOverwriteMessage(id)); } if (slot?.token === token) {` | B20 | 1 failed |
| register-time normalizer (M-05-9's register-time spelling) | `slot = { token, bridge };` → a shallow copy whose snapshot thunks are re-bound to values read at mount time | B2, B3, B6–B15, B18, B20, B21 | 15 failed |

**Three things in that table are worth reading carefully.**

1. **M-05-1 reddens exactly the four predicted orderings.** Not three, not five. The four are the whole of BRG-04's block, so deleting that block leaves BRG-04 unvalidated with nine green orderings still in the file.
2. **The five contract pins (B1–B5) stay GREEN under both M-05-1 and M-05-2.** This is the measurement that makes the `CONTRACT PIN` label honest rather than decorative — it is the one thing the label asserts, and it is now observed rather than inherited from RESEARCH.
3. **B2 and B3 DO go red under the register-time normalizer.** That is not a contradiction. The contract-pin label is scoped to a named set of three implementations — the token guard, the object-identity defect, and the unconditional clear — and says those three cannot be told apart by that ordering. It has never claimed that no mutant anywhere can redden the case. A later reader who finds B2 red under some future mutant should not conclude the label was wrong; they should check which implementation the mutant produces. Stated here because the inverse mistake — quietly promoting a pin to "validated" because it once went red — is the same false-coverage failure the label exists to prevent.

### The `bridge_overwrite` rendering — captured vs. recorded

Captured by B19 from `dist/index.js` and asserted with `toBe` against the literal in the test file:

```
concierge: [bridge_overwrite] bridge "results": a second component registered over a still-live registration, so the first component's snapshot and actions are no longer reachable through this registry. Fix: make sure exactly one mounted component registers this bridge. This warning fires once per registry, so a later overwrite is silent.
```

**`length` is 340.** This matches `05-01-SUMMARY.md` § "The three warn messages, rendered" **character for character** — compared by executing the artifact, not by reading the two documents side by side. B19 pins it four ways: `toContain("[bridge_overwrite]")` (the machine-readable code), `toContain("results")` (the registry's identity, which appears in the message exactly once and only in the id slot), `not.toContain("SECRET-FROM-THE-APP")` (the security claim), and `toBe(BRIDGE_OVERWRITE_RENDERED)` plus `length === 340` (the handoff record).

The exact-text pin is a **deliberately different judgement** from the one this phase made about the off-page sentence, and the file says so at the literal. There, a regex over message vocabulary was rejected because it pins wording rather than meaning and goes red on a legitimate rewording. Here the full rendering is a recorded handoff artifact that later plans read, so drift between the record and the code **should** go red. If the message is legitimately reworded, update the literal and `05-01-SUMMARY.md`'s record in the same change.

### The off-page sentence is NOT asserted in this file

The phase-wide constraints name the 108-character off-page message and its `MESSAGE_MAX_CHARS` bound. **That assertion belongs to `test/bridge-snapshot.test.ts` (plan 05-05)**, which owns `captureSnapshot` and `offPageResult`; this plan's `<interfaces>` block says so explicitly. Nothing about `offPageResult` is asserted here, and its absence is a scope boundary rather than an omission.

**Review obligation discharged** (VALIDATION.md § Manual-Only Verifications, BRG-03): the shipped sentence reads *"The result count is not available because the results page is not open. Open the results page and try again."* The second sentence names a concrete next action — open the named page, then retry — rather than only restating the fault. **Verdict: passes the DX-03 standard.** No regex over `/open|go to|navigate/i` was written, in either file; it would pin vocabulary rather than meaning.

### Two measurement traps for 05-07

1. **`pnpm test -- bridge` does NOT filter.** Measured: it runs **8 files / 111 tests** — the whole suite. `pnpm test bridge` (no `--`) runs **1 file / 21 tests**. The plan's and VALIDATION's gate command is the former. The gate is still *sound*, because a superset run that goes red on a bridge case is still a red gate, but a reader expecting a 21-test run will be confused, and anyone tuning the battery for speed should use the bare form.
2. **Do not pipe a `mutate-and-prove.sh` gate command** — carried forward from `05-03-SUMMARY.md`, and honoured here: every one of the six gates above redirects to a file (`> /tmp/….txt 2>&1`) and never pipes, so the script reads the gate's own exit status.

---

## Decisions Made

- **B20's console capture is scoped to the refusal, not to the whole ordering.** The plan says "Run O2b under console capture and assert `expect(captured).toHaveLength(0)`". Measured against the artifact, O2b as a whole emits **exactly one** warning — its second `register` displaces a still-live registration, which is `bridge_overwrite` firing by design — so the instruction as literally written fails. The case now captures the two registrations and the refusal separately, asserts the setup produced `1`, and asserts the refusal produced `0`. Asserting the setup rather than discarding it is load-bearing twice over: it names the overwrite as expected rather than incidental, and it proves the stand-in console is live, so the real `toHaveLength(0)` cannot pass vacuously on a capture that never fired.
- **The object-guard agreement is written as NINE of thirteen.** `src/bridge.ts:245` and `05-04-PLAN.md` both say ten. Re-measured this session by running three implementations of the registry over all thirteen orderings and counting agreement with the token guard: `object-guarded agrees with token on: 9 of 13`. The arithmetic corroborates it — the object guard differs on exactly O1b, O2b, O4b and O4c, and 13 − 4 = 9. The test file's header carries the measured figure **and** records that the source comment says otherwise, so the discrepancy is visible rather than silently resolved in either direction. Source was not touched; see Deviations.
- **A shared `withCapturedWarnings` helper, used in two registers.** The warn-policy cases use its return value as the assertion subject. The ordering cases use it as a muffler. The idiom inside it is exactly the house one — plain global assignment, real console spread, restoration in a `finally`, all four notes carried — written once rather than twelve times.
- **All three sinks are stood in, not just `warn`**, following `concierge.test.ts:1074-1076`: a "warns never" claim that captured only `warn` is satisfied by a diagnostic that reached for `console.log`.
- **The mutation battery was run here rather than deferred entirely to 05-07.** The plan's Task 2 acceptance criterion says discrimination "is proven, not assumed, in plan 05-07". Running it now costs six commands and converts every "discriminates M-05-1" comment in the file from a claim into a measurement — and it found the B20-also-reddens and B2/B3-under-an-unrelated-mutant facts, neither of which was predicted. 05-07 still owns the formal battery; this is evidence for it, not a replacement.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] B20's assertion as specified would have failed**

- **Found during:** Task 3
- **Issue:** The plan directs "Run O2b under console capture and assert `expect(captured).toHaveLength(0)`". O2b's second `register` call displaces a still-live registration and therefore emits `bridge_overwrite`; measured, the whole ordering under capture yields **1**, not 0.
- **Fix:** Split into two captures — setup (asserted `toHaveLength(1)`) and the refusal alone (asserted `toHaveLength(0)`) — which is what the claim "a refused unsubscriber warns never" actually says. The setup assertion doubles as an anti-vacuity guard.
- **Files modified:** `packages/concierge/test/bridge.test.ts`
- **Commit:** `d5c5d88`

**2. [Rule 2 — Missing critical functionality] The ordering cases had to muffle their own diagnostics**

- **Found during:** Task 2
- **Issue:** Five of the thirteen orderings displace a live registration and so print a real 340-character warning. Measured on the untouched tree, `pnpm test` emitted **zero** `concierge: [` lines across the whole suite — every prior case that provokes a diagnostic captures it. Letting these print would have spent that invariant, and a suite whose output is full of expected warnings is one where an unexpected warning is invisible.
- **Fix:** Added the shared `withCapturedWarnings` helper and wrapped the affected orderings. Re-measured after: still **0** leaked lines.
- **Files modified:** `packages/concierge/test/bridge.test.ts`
- **Commit:** `eb7dbe0`

### Corrections to the plan's stated numbers (not work changed)

**"Ten of thirteen" is nine of thirteen.** Recorded in Decisions above and in the test file's header. **The source comment at `src/bridge.ts:245` still says ten and was NOT corrected** — this plan's constraints forbid modifying any source file, and 05-05/05-06 were editing adjacent territory in the same wave. **Action for the phase boundary: correct that sentence, or record the count as intentionally approximate.** The defect it describes is real and the guard is correct either way; only the count is off by one.

**O4c has three `register(` calls, not two.** Task 2's acceptance criterion reads "each of those two cases contains exactly one bridge-object construction and two `register(` calls on the same identifier". B11 (O2b) has exactly two. B13 (O4c) has **three**, because that is what the ordering `reg A(u1); reg A; reg A(u3); u1()` is — collapsing it to two would make it a duplicate of B11 and lose the three-registration shape. The load-bearing half of the criterion, **one construction and the same identifier throughout**, holds in both cases, and Pitfall 1 (two structurally identical objects silently converting the case to the distinct-object shape) is closed in both.

### Deliberate scope refusals

**REQUIREMENTS.md was not touched, and no requirement was marked complete**, following 05-01 and 05-03's precedent in this phase for the same two reasons: this plan runs as a worktree agent in a parallel wave and REQUIREMENTS.md is a shared orchestrator artifact, and BRG-01/BRG-02/BRG-04 are not fully closed at this plan's boundary — 05-05 owns detachment and the no-bridge path, and 05-07 owns the formal battery. The orchestrator should mark them at the phase boundary.

**`STATE.md` and `ROADMAP.md` were not touched**, per this execution's instructions.

**Nothing was added to `test/fixtures/`.** Both local factories are inline, because `scripts/pack-install-check.sh` copies that directory into a foreign scratch project and a sibling module gets pulled into that program by accident.

### Environment step

This worktree had no `node_modules`, so `pnpm install --frozen-lockfile` was run before any gate — the same step 05-02 and 05-03 recorded. It resolved and downloaded nothing ("Lockfile is up to date, resolution step is skipped"; 234 packages, all reused from the store), and `pnpm-lock.yaml` is unmodified — `git status` was clean immediately afterwards. **No package was added**, so the package-legitimacy checkpoint does not apply.

---

**Total deviations:** 2 auto-fixed (1 × Rule 1, 1 × Rule 2).
**Impact on plan:** None to scope. Three tasks, three commits, one file, every acceptance criterion met except the O4c register-count wording, which is explained above.

## Issues Encountered

- **`pnpm test -- bridge` is not a filter.** It runs the whole suite; `pnpm test bridge` is the filtering form. Recorded above as a trap for 05-07 rather than worked around, because the gate is sound either way and changing VALIDATION's documented command is not this plan's call.
- **A contract pin can go red under a mutant it was never claimed to catch.** The register-time-normalizer probe reddened B2 and B3, two of the five pins, because it breaks reference identity for every `toBe` in the file. Worth writing down before someone reads that as evidence the pins were validation after all.

## Verification Evidence

| Gate | Result |
|---|---|
| `pnpm build` | exit 0; `attw` **No problems found**, `publint --strict` **No issues found** |
| `pnpm test` | `Test Files 8 passed (8)` / `Tests 111 passed (111)` (baseline 90, +21) |
| `pnpm typecheck` | exit 0 |
| `pnpm test bridge` | `Test Files 1 passed (1)` / `Tests 21 passed (21)` |
| `pnpm test -- bridge` | `Test Files 8 passed (8)` / `Tests 111 passed (111)` — does not filter |
| `node scripts/pkg05-zero-runtime-deps.mjs` | Assertion B PASS — `core's dependencies contribute zero bytes to a consumer bundle` |
| `git diff --exit-code` at repo root | exit **0**, tree clean after all commits and all six mutation probes |
| `git diff --name-status <base>..HEAD` | `A packages/concierge/test/bridge.test.ts` and nothing else |
| Suite diagnostic leakage | `pnpm test \| grep -c "concierge: \["` → **0** before and **0** after |
| All thirteen orderings | every one of `O1 O1b O2 O2b O3 O3b O4 O4b O4c O5 O6 O7 O8` present in an `it` title |
| `CONTRACT PIN` labels | 10 occurrences across 5 cases (title + inline comment each) plus the header block; the 5 cases are exactly O6, O1, O3, O5, O7 |
| `describe` titles | `describe("BRG-01`, `describe("BRG-04`, `describe("BRG-02`, `describe("SEC-03 class`, `describe("the two warn policies` |
| `grep -c "toEqual"` | **0** in the whole file |
| `grep -c "__resetForTest"` | **0** |
| Artifact guard | `existsSync(DIST_PATH)` present; error message names `pnpm build`; `createBridge` bound via `await import(DIST_URL.href)` in `beforeAll`, not statically imported |
| Contract registry reset | `Symbol.for("@fullselfbrowsing/concierge.contract")` hard-coded; `delete (globalThis` present; `grep -cF "[KEY] = undefined"` → **0** |
| Vitest mocking API | `grep -rn "vi\.spyOn\|vi\.fn\|vi\.mock" packages/concierge/test/` → **zero hits across every file** |
| Console-capture idiom | `globalThis.console = { ...realConsole` present; `} finally {` present |
| Freeze + warn literals | `Object.isFrozen`, `[bridge_overwrite]`, `toHaveLength(1)`, `toHaveLength(0)`, `SECRET-FROM-THE-APP` all present |
| `test/fixtures/` | `git status --porcelain packages/concierge/test/fixtures/` → empty |
| Case-id prefix | `B1`–`B21`; `S`, `C` and `F` not reused |
| File size | 810 lines, 21 `it` cases (plan's `min_lines` was 260) |
| Mutation battery | six mutants, six × `PASS: gate fired (exit 1), tree clean` |

## Known Stubs

**None.** This plan adds no placeholder, no hardcoded empty value and no unwired data path. Every case asserts a real behaviour of `dist/index.js`, and the five that assert nothing about the guard say so in their own titles.

## User Setup Required

None.

## Next Phase Readiness

**Ready.**

- **05-07** inherits a measured case-id-to-mutant map rather than a prediction, for five of its named mutants (M-05-1, M-05-2, M-05-7, M-05-10, M-05-11) plus the register-time normalizer. Three things it should carry forward: the `pnpm test -- bridge` non-filtering finding; the standing "do not pipe a gate command" rule, honoured here; and the fact that **B20 is reddened by three different mutants**, so a battery that treats one red case as identifying one mutant will misattribute it.
- **05-05** owns `offPageResult`, `captureSnapshot` and the Shape F fixture. No collision: this file touches neither, and `test/fixtures/` is untouched. The `withCapturedWarnings` helper is deliberately local to this file rather than shared, so the two suites cannot couple.
- **05-06** owns `test-d/bridge.test-d.ts` and `test/single-instance.test.ts`. Untouched here. This file hard-codes the contract-registry symbol rather than importing it, matching `single-instance.test.ts`'s own reasoning, so the two do not have to agree via the artifact.
- **Phase 6** gets an executable statement of what the dispatcher may assume: `read()` returns the registered object by reference and its getters stay live, so a handler may hold the result across an app state change without re-reading the registry.

**Carried forward, not a blocker:** the "ten of thirteen" sentence in `src/bridge.ts:245`. One clause, no behavioural consequence, and it should be corrected at the phase boundary rather than by a parallel worktree agent mid-wave.

## Self-Check: PASSED

- `packages/concierge/test/bridge.test.ts` — FOUND (810 lines, 21 `it` cases)
- `.planning/phases/05-bridge-registry-and-the-no-bridge-path/05-04-SUMMARY.md` — FOUND
- Commit `a2d2897` — FOUND in git log
- Commit `eb7dbe0` — FOUND in git log
- Commit `d5c5d88` — FOUND in git log
- Working tree clean; no shared orchestrator artifacts (`STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`) modified; no source file modified.

---
*Phase: 05-bridge-registry-and-the-no-bridge-path*
*Completed: 2026-07-31*
