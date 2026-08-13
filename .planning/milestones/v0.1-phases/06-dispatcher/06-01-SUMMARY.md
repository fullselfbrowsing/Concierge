---
phase: 06-dispatcher
plan: 01
subsystem: testing
tags: [typescript, vitest, dispatcher, standard-schema, abort-signal, security]

# Dependency graph
requires:
  - phase: 01-type-surface-completion
    provides: "`ActionResult`, `InvocationMeta`, `Scheduler`, `ToolBatch`, the closed `ReasonCode` vocabulary, and `MESSAGE_MAX_CHARS`"
  - phase: 04-stages-catalog-assembly-and-explain
    provides: "`createConcierge`, immutable stage-scoped catalog projections, and the initial public `dispatch` stub"
  - phase: 05-bridge-registry-and-the-no-bridge-path
    provides: "`createBridge`, live bridge resolution contracts, `offPageResult`, `USER_CANCELLED`, and `USER_DECLINED`"
provides:
  - "Exact RED type contracts for context-first `dispatch`, inline-envelope `dispatchBatch`, `Scheduler`, and the five-key `Concierge` API"
  - "R01-R24 RED runtime coverage for deduplication, authorization, validation, and direct invocation"
  - "R25-R54 RED runtime/security coverage for commit waits, abort races, error containment, result normalization, sanitization, and bridge hand-forward"
affects: [06-02, 06-03, 06-04, 06-05, 06-06, dispatcher-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Built-artifact RED tests with exact per-case failure fingerprints"
    - "Locally injected Scheduler and AbortSignalLike fixtures with explicit global restoration"
    - "Selector-aware test registration for exact Vitest JSON collection counts"

key-files:
  created:
    - packages/concierge/test-d/dispatcher.test-d.ts
    - packages/concierge/test/dispatcher.test.ts
  modified: []

key-decisions:
  - "The public contract is pinned as context-first `dispatch`, inline-envelope `dispatchBatch`, and exactly five `Concierge` members."
  - "Focused RED gates register only matching R-cases because Vitest reports ordinary name-filter exclusions as pending, which would invalidate the plan's exact-zero-pending evidence."
  - "Security cases use direct global replacement restored in `finally`; no Vitest mocking APIs or telemetry seams were introduced."

patterns-established:
  - "Every Wave 0 runtime case reaches one intentional assertion carrying one unique `[RED:Rxx:fingerprint]` marker."
  - "Intentional RED evidence rejects hook failures, incidental runtime error classes, foreign markers, skipped tests, and duplicate failures."

requirements-completed: [DSP-01, DSP-02, DSP-03, DSP-04, DSP-05, DSP-08, DSP-09, SEC-02, SEC-06, TRN-04]

# Metrics
duration: 24min
completed: 2026-08-05
---

# Phase 6 Plan 01: Dispatcher Wave 0 RED Contracts Summary

**Exact type seams plus 54 fingerprinted built-artifact RED cases now define dispatcher identity, authorization, validation, timing, containment, normalization, sanitization, and bridge behavior before implementation.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-05T21:06:59Z
- **Completed:** 2026-08-05T21:31:22Z
- **Tasks:** 3
- **Files modified:** 2 (created)

## Accomplishments

- Pinned the context-first single-call signature, immutable inline batch envelope, Scheduler shape, explicit-undefined construction conventions, and exact five-member `Concierge` key set.
- Added R01-R24 to prove Promise identity, cache lifetime, instance isolation, fail-closed stage lookup, prototype-key rejection, Standard Schema handling, and direct operation without a transport.
- Added R25-R54 to prove the 600 ms commit wait, read-only bypass, abort cleanup/races, scheduler fallback, exception non-disclosure, hostile result normalization, all twelve reason codes, message sanitization, and live/null bridge hand-forward.
- Preserved Wave 0 integrity: the shipped dispatcher stub causes exactly the intended 3 type diagnostics and 54 uniquely fingerprinted runtime failures, with no incidental failures or skipped cases.

## Task Commits

Each task was committed atomically:

1. **Task 1 (06-01-T1): Pin dispatcher public contracts** — `581d01d` (test)
2. **Task 2 (06-01-T2): Prove stage authorization, dedup identity, validation, and direct-loop operation** — `5982906` (test)
3. **Task 3 (06-01-T3): Prove commit-window races, exception containment, result normalization, sanitization, and bridge hand-forward** — `2f82542` (test)

## Files Created/Modified

- `packages/concierge/test-d/dispatcher.test-d.ts` (created, 37 lines) — exact public dispatch, batch, Scheduler, explicit-undefined, and API-key type contracts.
- `packages/concierge/test/dispatcher.test.ts` (created, 1,472 lines) — built-artifact harness, local scheduler/abort fixtures, and R01-R54 runtime RED registry.

## Decisions Made

- The tests encode the already-ratified five-member public surface without introducing a named batch-result export.
- Each runtime case aggregates its observations into one marked assertion, so Wave 0 failure evidence cannot be mistaken for a fixture, hook, or shared-helper crash.
- Timer, clock, and console substitutions are local and restored in `finally`; `vi.spyOn`, `vi.fn`, and `vi.mock` remain absent across the runtime test tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Registered only selector-matching cases in focused RED runs**

- **Found during:** Task 2 (exact R01-R24 JSON gate)
- **Issue:** Vitest's JSON reporter counted ordinary `--testNamePattern` exclusions as pending tests, contradicting the plan's required exact counts of 24 or 30 collected and zero pending. A `describe` prefix also made the plan's anchored `^\[Rxx\]` selectors miss every case.
- **Fix:** Kept R-cases top-level and routed their registration through a small selector-aware `it` wrapper. Focused gates now register exactly their intended range; an unfiltered run still registers all 54 cases.
- **Files modified:** `packages/concierge/test/dispatcher.test.ts`
- **Verification:** Task 2 reports 24 total/24 failed/0 pending; Task 3 reports 30 total/30 failed/0 pending, each with one exact fingerprint.
- **Committed in:** `2f82542` (the wrapper was finalized with Task 3)

---

**Total deviations:** 1 auto-fixed (1 blocking issue).
**Impact on plan:** The adjustment makes the plan's exact evidence executable without changing any dispatcher contract or test subject.

## Issues Encountered

- The exact JSON gates needed collection-time selection rather than Vitest's default post-registration filtering. Once the selector-aware registration wrapper was in place, both ranges met the plan's zero-pending requirement.

## Verification Evidence

| Gate | Result |
|---|---|
| `pnpm build` | PASS; package build, attw, and publint completed cleanly |
| Dispatcher type RED gate | PASS; exactly 3 diagnostics: `_dispatchSignature`/TS2344, `_dispatchBatchSignature`/TS2339, `_conciergeKeys`/TS2344 |
| R01-R24 exact JSON gate | PASS; 24 total, 24 failed, 0 passed/pending/todo, one exact registered marker per case |
| R25-R54 exact JSON gate | PASS; 30 total, 30 failed, 0 passed/pending/todo, one exact registered marker per case |
| Incidental failure scan | PASS; no unhandled, hook, fixture, load, transform, or runtime error-class failures |
| Mocking API fence | PASS; zero `vi.spyOn`, `vi.fn`, or `vi.mock` occurrences in `packages/concierge/test/**/*.ts` |
| `git diff --check` | PASS |

## Known Stubs

- The production `dispatch` implementation remains the pre-existing `DISPATCH_NOT_IMPLEMENTED` stub by design. This Wave 0 plan only creates RED contracts; plans 06-02 through 06-05 implement them, and plan 06-06 closes the proof battery.

## User Setup Required

None.

## Next Phase Readiness

- Plans 06-02 through 06-05 can implement against stable type and runtime evidence without selecting new public seams.
- The red suites distinguish missing implementation from incidental test failures and are ready to turn green incrementally.
- No package, external service, authentication, or architectural blocker remains.

## Self-Check: PASSED

- `packages/concierge/test-d/dispatcher.test-d.ts` — FOUND (37 lines)
- `packages/concierge/test/dispatcher.test.ts` — FOUND (1,472 lines)
- `.planning/phases/06-dispatcher/06-01-SUMMARY.md` — FOUND
- `581d01d` — FOUND in git history
- `5982906` — FOUND in git history
- `2f82542` — FOUND in git history

---
*Phase: 06-dispatcher*
*Completed: 2026-08-05*
