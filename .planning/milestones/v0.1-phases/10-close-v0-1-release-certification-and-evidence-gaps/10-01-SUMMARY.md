---
phase: 10-close-v0-1-release-certification-and-evidence-gaps
plan: 01
subsystem: core-runtime
tags: [terminal-actions, dispatcher, session, consent-outcomes, teardown]
requires:
  - phase: 06-dispatcher
    provides: serial batch dispatch, exact Promise deduplication, and handler normalization
  - phase: 07-session-and-the-transport-seam
    provides: FIFO occurrence routing and cached asynchronous teardown
  - phase: 08-consent-kernel
    provides: immutable app-authored failure outcome barrier
provides:
  - private handler-entry terminal commitment across every settlement mode
  - whole-occurrence public and transport response silence after terminal entry
  - outcome-before-stop terminal failure handling without active-pump self-deadlock
affects: [phase-10-mutation-evidence, release-certification, session-runtime]
tech-stack:
  added: []
  patterns: [promise-associated-private-state, internal-batch-projection, nonblocking-terminal-stop]
key-files:
  created:
    - .planning/phases/10-close-v0-1-release-certification-and-evidence-gaps/10-01-SUMMARY.md
  modified:
    - packages/concierge/src/concierge.ts
    - packages/concierge/src/dispatch.ts
    - packages/concierge/src/session.ts
    - packages/concierge/test/dispatcher-batch.test.ts
    - packages/concierge/test/session-consent.test.ts
    - packages/concierge/test/session-lifecycle.test.ts
    - packages/concierge/test-d/actions.test-d.ts
    - packages/concierge/test-d/dispatcher.test-d.ts
key-decisions:
  - Associate mutable terminal-entry state with the exact dispatch Promise so cache hits retain both Promise identity and terminal control state.
  - Keep completed terminal rows only in a frozen internal outcome; public batch callers receive one shared frozen empty array.
  - Initiate cached Session teardown after failure presentation without awaiting the active pump's own drain.
patterns-established:
  - "Private execution metadata follows the exact cached Promise rather than widening ActionResult or public batch rows."
  - "Session consumes an internal occurrence outcome, completes the app-owned failure barrier, then branches before transport response."
requirements-completed: [DSP-07, SES-02, SES-04, CON-10]
metrics:
  duration: 16m
  completed: 2026-08-12
---

# Phase 10 Plan 01: Terminal Runtime Boundary Summary

Terminal handler entry now silences the complete occurrence, preserves app-authored failure presentation, cancels later work, and stops Session without leaking private control state or deadlocking teardown.

## Performance

- **Started:** 2026-08-12T17:05:00Z
- **Completed:** 2026-08-12T17:21:02Z
- **Duration:** 16 minutes
- **Tasks:** 2
- **Files changed:** 8

## Accomplishments

- Added built-artifact and type regressions for terminal success, returned failure, synchronous throw, asynchronous rejection, pre-entry failures, cache identity, whole-batch silence, queued occurrence cancellation, immutable failure presentation, and stop Promise identity.
- Associated a private `terminalEntered` state with every dispatch Promise, including cache hits, and committed the marker immediately before terminal handler invocation.
- Split internal batch completion from public projection so Session can present a terminal failure while direct callers and transports receive no row from the occurrence.
- Preserved the single FIFO pump and cached stop contract by starting teardown after the outcome barrier without awaiting the pump from inside itself.

## Task Commits

1. **Task 10-01-01: Pin the private terminal boundary and all response-silence invariants** — `04e571f` (test)
2. **Task 10-01-02: Implement internal terminal execution and nonblocking Session stop** — `ddc2734` (feat)

## Files Created or Modified

- `packages/concierge/src/concierge.ts` — tracks terminal-entry state by exact dispatch Promise, owns the private internal batch lookup, and projects terminal public batches to frozen `[]`.
- `packages/concierge/src/dispatch.ts` — returns a frozen internal batch outcome and stops serial entry after the settled terminal call.
- `packages/concierge/src/session.ts` — consumes internal rows for app-owned failure presentation, starts teardown in a finally-equivalent path, and returns before transport response.
- `packages/concierge/test/dispatcher-batch.test.ts` — covers the settlement matrix, pre-entry boundary, batch silence, serial cutoff, and cached Promise reuse.
- `packages/concierge/test/session-consent.test.ts` — proves zero response attempts and outcome-before-cleanup ordering for terminal occurrences.
- `packages/concierge/test/session-lifecycle.test.ts` — proves queued-work cancellation, one cleanup, stop identity, and eventual drain settlement.
- `packages/concierge/test-d/actions.test-d.ts` — pins `terminal` as an optional boolean action policy.
- `packages/concierge/test-d/dispatcher.test-d.ts` — rejects terminal control members from public results, rows, and Concierge keys.

## Decisions Made

- Used a factory-local weak association from dispatch Promises to mutable execution state so the existing non-async direct dispatch and exact retry identity remain unchanged.
- Used one module-private weak association from real Concierge handles to richer batch executors; structural test doubles retain the pre-existing public nonterminal path.
- Kept the terminal call's normalized result in internal rows long enough to construct the existing immutable failure outcome, but never exposed those rows through public batch or transport output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved historical test identifiers while adding terminal coverage**

- **Found during:** Task 10-01-01
- **Issue:** `Q20` and `L06`–`L09` were already active Phase 6/7 evidence identifiers, despite the Phase 10 plan assigning the same labels to new terminal cases.
- **Fix:** Retained the historical tests and their immutable evidence references, then added disambiguated terminal titles that still match the mandated focused selectors.
- **Files modified:** `packages/concierge/test/dispatcher-batch.test.ts`, `packages/concierge/test/session-lifecycle.test.ts`
- **Verification:** The focused selector collected both historical and terminal cases; 19 selected tests passed after implementation.
- **Committed in:** `04e571f`

**Total deviations:** 1 auto-fixed (1 Rule 3 blocker).

## Issues Encountered

- The first local pnpm invocation attempted dependency verification without a TTY. Re-running repository commands with `CI=true` used the installed lockfile state and completed normally.
- The initial consent-refusal fixture declared the weakest capability profile and was rejected during catalog construction. The fixture was corrected to declare the required delivered ceiling before the RED evidence commit; the refusal remains a runtime pre-entry failure.

## Verification

- Core build: passed, including publint and attw.
- Core typecheck: passed.
- Focused terminal selector: 19 passed.
- Complete affected suites: 66 passed.
- Dispatcher/session regression suites: 125 passed.
- Full Vitest suite: 25 files, 453 tests passed.

## User Setup Required

None.

## Next Phase Readiness

- Terminal control is ready for the Phase 10 mutation register and evidence battery.
- Catalog invalid-declaration aggregation and generated Astro state remain independent Wave 1 work in Plans 10-02 and 10-03.

## Self-Check: PASSED

Both task commits resolve, all eight claimed implementation/test files exist, and the public built export surface remains unchanged.

---
*Phase: 10-close-v0-1-release-certification-and-evidence-gaps*
*Completed: 2026-08-12*
