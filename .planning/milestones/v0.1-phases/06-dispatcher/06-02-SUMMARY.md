---
phase: 06-dispatcher
plan: 02
subsystem: testing
tags: [typescript, vitest, dispatcher, toolbatch, abort-signal, serial-execution]

# Dependency graph
requires:
  - phase: 01-type-surface-completion
    provides: "`ToolBatch`, `ToolCall`, `InvocationMeta`, `AbortSignalLike`, and the closed `ReasonCode` vocabulary"
  - phase: 04-stages-catalog-assembly-and-explain
    provides: "`createConcierge` and immutable stage-scoped action catalogs"
  - phase: 06-dispatcher
    provides: "Plan 06-01's context-first `dispatch` and transport-independent `dispatchBatch` RED contracts"
provides:
  - "Q01-Q08 RED coverage for copied stable ordering, seriality, parsing, metadata, correlation, and immutability"
  - "Q09-Q14 RED coverage for abort completeness, handler suppression, scheduler cancellation, dedup reuse, and direct batch use"
  - "Exact selector-isolated Vitest JSON evidence that all 14 failures come only from the absent `dispatchBatch` capability"
affects: [06-03, 06-04, 06-05, 06-06, 07-session-and-transport-seam]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Built-artifact batch RED tests with one exact fingerprinted assertion per case"
    - "Local structural AbortSignalLike and Scheduler fixtures without global timer or mocking APIs"
    - "Selector-aware top-level test registration for exact Vitest JSON collection counts"

key-files:
  created:
    - packages/concierge/test/dispatcher-batch.test.ts
  modified: []

key-decisions:
  - "Each case guards the absent `dispatchBatch` member and folds capability presence into its single fingerprinted observation, preventing incidental TypeErrors."
  - "Batch ordering is tested independently through handler-entry order, correlated row order, and preservation of the caller's frozen input order."
  - "Abort coverage uses application-local structural fixtures and asserts complete sorted rows, zero later actuation, one canceller call, and listener cleanup."

patterns-established:
  - "Every batch Wave 0 case reaches one intentional assertion carrying one unique `[RED:Qxx:fingerprint]` marker."
  - "Focused RED gates register only their Q-range; an unfiltered run registers all 14 cases with zero pending tests."

requirements-completed: [DSP-06, DSP-07, DSP-08, TRN-04]

# Metrics
duration: 13min
completed: 2026-08-05
---

# Phase 6 Plan 02: ToolBatch Wave 0 RED Suite Summary

**Fourteen fingerprinted built-artifact RED cases now define transport-independent ToolBatch parsing, stable serial execution, metadata propagation, correlation, cancellation, dedup reuse, and immutable results before the batch method exists.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-05T21:36:58Z
- **Completed:** 2026-08-05T21:49:30Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- Added Q01-Q08 to prove a frozen caller array is copied, output indices are stably ordered, handler concurrency never exceeds one, malformed and primitive JSON reach validation, metadata forwards exactly, call IDs remain correlated, and returned rows/containers are frozen.
- Added Q09-Q14 to prove pre-abort and in-flight abort completeness, suppression of later handlers, exactly one scheduler cancellation, repeated-call cache reuse, and direct application-loop use without a transport object.
- Preserved Wave 0 integrity: the missing `dispatchBatch` member produces exactly 14 uniquely fingerprinted failures, with no passing, pending, todo, suite-level, unhandled, transform, load, or incidental runtime-error failures.

## Task Commits

Each task was committed atomically:

1. **Task 1 (06-02-T1): Prove parsing, metadata forwarding, stable ordering, and strict seriality** — `7ea14a9` (test)
2. **Task 2 (06-02-T2): Prove abort completeness, dedup reuse, and transport-free batch use** — `e46d724` (test)

## Files Created/Modified

- `packages/concierge/test/dispatcher-batch.test.ts` (created, 876 lines) — built-artifact harness plus Q01-Q14 batch behavior, abort, and direct-loop RED cases.

## Decisions Made

- Kept Q-cases top-level and selector-aware so anchored focused gates collect only the requested range instead of reporting excluded cases as pending.
- Observed the missing public method as data inside every case rather than calling `undefined`; each current failure therefore comes from its registered assertion and not a TypeError.
- Tested stable ordering through both execution and response correlation while separately proving the caller's array remains frozen and in its original order.
- Used a local AbortSignalLike and manual Scheduler so abort position, handler entry, canceller count, and listener cleanup remain deterministic without framework mocks or wall-clock waits.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The command runner rejected the plan's `rm -f` cleanup of two explicit `/tmp` report files. The same focused gates were rerun after truncating those exact files, preserving fresh-report semantics without changing the test or evidence contract.

## Verification Evidence

| Gate | Result |
|---|---|
| `pnpm build` | PASS; package build, attw, and publint completed cleanly |
| Q01-Q08 exact JSON RED gate | PASS; 8 total/8 failed/0 passed/pending/todo, one exact registered fingerprint per case |
| Q09-Q14 exact JSON RED gate | PASS; 6 total/6 failed/0 passed/pending/todo, one exact registered fingerprint per case |
| Unfiltered Q01-Q14 JSON gate | PASS; exactly Q01 through Q14 failed, zero passed/pending/todo, no incidental error classes |
| `batch_aborted` vocabulary fence | PASS; zero occurrences in the batch suite |
| Direct-dispatch harness fence | PASS; zero `concierge.dispatch(...)` calls in the batch suite |
| `git diff --check` | PASS |

## Known Stubs

- The production `dispatchBatch` capability is intentionally absent. This Wave 0 plan proves that absence through controlled RED assertions; plan 06-05 implements the method and turns these cases green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-03 can add the shared sanitizer and host Scheduler fallback without changing the batch contract.
- Plan 06-05 has complete behavioral evidence for stable serial execution, metadata forwarding, abort settlement, dedup delegation, and immutable correlation rows.
- No package, external service, authentication, or architectural blocker remains.

## Self-Check: PASSED

- `packages/concierge/test/dispatcher-batch.test.ts` — FOUND (876 lines)
- `.planning/phases/06-dispatcher/06-02-SUMMARY.md` — FOUND
- `7ea14a9` — FOUND in git history
- `e46d724` — FOUND in git history
- Q01-Q14 aggregate RED evidence — PASSED (14 exact fingerprinted failures, zero pending/passed/todo)

---
*Phase: 06-dispatcher*
*Completed: 2026-08-05*
