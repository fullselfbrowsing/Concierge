---
phase: 08-consent-kernel
plan: 05
subsystem: consent
tags: [consent, session, transport-capabilities, outcome-barrier, fail-closed]
requires:
  - phase: 08-01
    provides: required SessionConfig outcome sink, failure outcome types, and fixed session diagnostic vocabulary
  - phase: 08-02
    provides: branded declared consent-profile reader, detached profile snapshot, and dominance comparator
  - phase: 07-session
    provides: hot Session construction, single FIFO occurrence pump, response path, and deterministic teardown
provides:
  - effect-free validation that actual transport capability dominates the declared catalog profile
  - captured application-owned outcome presentation before any mixed-batch response release
  - deeply frozen minimal failure outcomes with stable failed-row ordering
  - occurrence-local fail-closed handling for thrown, rejected, interrupted, or malformed presentations
affects: [08-07, 08-08, session-runtime, consent-security, mutation-verification]
tech-stack:
  added: []
  patterns:
    - descriptor-aware caller boundary snapshots precede transport and application effects
    - failed-batch presentation is an awaited occurrence-level release barrier
    - hostile presentation reports collapse to one fixed diagnostic without retry or caught-value echo
key-files:
  created:
    - packages/concierge/test/session-consent.test.ts
  modified:
    - packages/concierge/src/session.ts
    - packages/concierge/test/session-catalog.test.ts
    - packages/concierge/test/session-routing.test.ts
    - packages/concierge/test/session-lifecycle.test.ts
    - packages/concierge/test/single-instance.test.ts
key-decisions:
  - "Capture actual transport capabilities and the outcome sink once at the first effect-free Session boundary, then use the detached capability snapshot for later catalog decisions."
  - "Treat outcome presentation failure as local to the accepted occurrence so cleanup and genuinely later FIFO work continue without replay."
  - "Accept completion only from a plain or null-prototype report with an own data outcome field equal to completed; never invoke report outcome accessors."
patterns-established:
  - Actual transport capability is authoritative and must dominate the Concierge declaration before status reads, subscriptions, catalog publication, or app callbacks.
  - A failed result anywhere in an occurrence withholds every row until one minimal frozen app outcome completes.
requirements-completed: [CON-10, TRN-03, TRN-05]
duration: 32m
completed: 2026-08-10
---

# Phase 8 Plan 5: Session Consent Boundary Summary

**Session startup now proves actual transport capability before effects, while mixed-batch results remain behind one immutable app-authored outcome presentation that fails closed without poisoning later FIFO work.**

## Performance

- **Duration:** 32m
- **Started:** 2026-08-10T10:58:01Z
- **Completed:** 2026-08-10T11:30:13Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Captured the required outcome presenter and a descriptor-aware detached snapshot of all four actual transport capability fields before status reads, subscriptions, publication, diagnostics, or other observable effects.
- Compared actual consent grade and user-turn provenance against the internally branded Concierge declaration, rejecting weak, malformed, accessor-backed, exotic, throwing, or incomplete claims through the fixed Session start error.
- Collected failed dispatch rows in original order into one deeply frozen outcome containing only exact `callId`, `reason`, and `message` data, while all-success occurrences retain the original direct response path.
- Awaited exactly one application presentation before releasing any row from a mixed occurrence, then preserved every original correlated result and stable response order after completion.
- Collapsed throw, rejection, interruption, malformed values, accessor reports, and hostile proxies into one fixed `outcome_presentation_failed` diagnostic, zero responses for the affected occurrence, no retry, normal cleanup, and a runnable FIFO successor.

## Task Commits

Each task used a discriminating RED/GREEN sequence:

1. **Task 1 RED: Pin pre-effect actual capability dominance** - `071d06b` (test)
2. **Task 1 GREEN: Enforce and capture the Session trust boundary** - `637e3a6` (feat)
3. **Task 2 RED: Pin immutable awaited outcome release behavior** - `2096846` (test)
4. **Task 2 GREEN: Gate responses on completed app presentation** - `2ef1cd3` (feat)

## Files Created/Modified

- `packages/concierge/src/session.ts` - Captures and validates the startup boundary, builds frozen minimal failure outcomes, validates presentation reports without invoking accessors, and gates the existing response loop.
- `packages/concierge/test/session-consent.test.ts` - Covers capability dominance, zero-effect rejection, captured sink behavior, immutable stable outcomes, awaited ordering, hostile presentation containment, and FIFO recovery.
- `packages/concierge/test/session-catalog.test.ts` - Supplies the required completed outcome sink and reconciles legacy capability-accessor cases with the new descriptor-only construction contract.
- `packages/concierge/test/session-routing.test.ts` - Supplies an app-owned completed outcome default while preserving all Phase 7 routing assertions.
- `packages/concierge/test/session-lifecycle.test.ts` - Supplies an outcome default and proves interrupted presentation finalizes locally before its genuine successor runs.
- `packages/concierge/test/single-instance.test.ts` - Supplies the required sink without weakening the exact single-instance construction assertion.

## Decisions Made

- Outcome interruption is occurrence-local rather than session-fatal: the affected occurrence releases nothing, finalizes once, and allows the established single FIFO pump to advance.
- Presentation completion is accepted only from an own data `outcome: "completed"` field on a plain or null-prototype report. Accessor-backed, malformed, exotic, or throwing reports fail closed.
- The captured actual capability snapshot remains the Session's later `dynamicCatalog` authority; caller mutation after construction cannot retarget publication behavior.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- Task 1 RED kept 38 established/positive assertions green while S02-S04 failed on the missing weaker-profile, hostile-capability, and required-sink boundaries; Task 1 GREEN made all 41 focused assertions pass.
- Task 2 RED kept 44 established/positive assertions green while S06, S07, and L19 failed on the missing awaited barrier, full-occurrence withholding, hostile-report containment, and FIFO recovery; Task 2 GREEN made all 47 pass.
- Both required `test(08-05)` RED commits precede their corresponding `feat(08-05)` GREEN commits.

## Verification

- Package build passed with attw and publint clean.
- All five touched Session suites passed together: 5 files, 84 tests.
- Workspace typecheck passed under the declaration/type-test configuration.
- Full workspace runtime suite passed: 19 files, 389 tests.
- `git diff --check` passed for each task boundary.
- `pnpm-lock.yaml` remained byte-identical to the plan-start commit: blob `55856e9e2c8a691f17f47e199ccdd3f922a0cfe6` before and after execution.

## Known Stubs

None. Empty arrays, objects, and nullable variables in the focused tests are observation fixtures; production has no placeholder outcome, mock data source, or unwired presentation path.

## Issues Encountered

- The new descriptor-only capability contract made legacy tests that invoked `capabilities` or `dynamicCatalog` getters invalid construction fixtures. Those matrices retained their original resolver/reentrancy assertions with valid captured data capabilities, while a dedicated test now proves post-construction caller mutation cannot alter the snapshot.
- Central RED review strengthened the outcome gate to hold a deferred presentation Promise and to put a successful row before a failed row in the same blocked occurrence, distinguishing invocation from completion and whole-occurrence withholding from failure-only filtering.
- A first lockfile comparison against `origin/main` crossed earlier milestone tooling commits; comparison against the actual plan-start commit confirmed the lockfile blob never changed during this plan.

## User Setup Required

None - no external service, secret, package, or environment configuration is required.

## Next Phase Readiness

- The reusable Phase 7 transport fixture can now expose explicit outcome controls and shared ordering history against the real Session barrier.
- The Phase 8 mutation battery can target weakened capability dominance, validation-after-effect, response-before-presentation, presentation retry, partial mixed-batch release, and caught-value echo.
- No blockers remain.

## Self-Check: PASSED

- Summary and all six implementation/test files exist.
- All four RED/GREEN task commits exist in repository history.
- No tracked file was deleted by a task commit.

---
*Phase: 08-consent-kernel*
*Completed: 2026-08-10*
