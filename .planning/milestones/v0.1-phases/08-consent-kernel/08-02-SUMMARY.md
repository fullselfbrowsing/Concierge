---
phase: 08-consent-kernel
plan: 02
subsystem: consent
tags: [consent, catalog-validation, capability-gates, provenance, immutability]
requires:
  - phase: 08-01
    provides: immutable ConsentProfile, readback presenter, and digest contracts
  - phase: 04-catalog-assembly
    provides: single flat aggregated catalog validation boundary
provides:
  - inherent delivered minimum for every consent-bearing action
  - aggregated grade, provenance, presenter, and digest construction issues
  - descriptor-safe frozen per-Concierge consent profile
  - private non-enumerable profile handoff for Session
affects: [08-03, 08-05, 08-06, consent-kernel, session]
tech-stack:
  added: []
  patterns:
    - construction capabilities are captured once before the flat catalog build
    - private immutable authority rides on an unexported unique-symbol marker
key-files:
  created:
    - packages/concierge/src/consent-profile.ts
  modified:
    - packages/concierge/src/catalog.ts
    - packages/concierge/src/concierge.ts
    - packages/concierge/test-d/catalog.test-d.ts
    - packages/concierge/test/catalog.test.ts
    - packages/concierge/test/concierge.test.ts
    - packages/concierge/test/diagnostic-safety.test.ts
key-decisions: []
patterns-established:
  - Consent policies are clamped to at least delivered before capability comparison.
  - Structural Concierge handles without the private marker resolve to the weakest profile.
requirements-completed: [CAT-04, CON-07, TRN-03, TRN-05]
duration: 17m
completed: 2026-08-10
---

# Phase 8 Plan 2: Consent Capability Gates Summary

**A single flat catalog build now rejects impossible consent grades, forgeable user-turn bindings, and missing attested evidence seams while each Concierge privately owns a detached frozen capability ceiling.**

## Performance

- **Duration:** 17m
- **Started:** 2026-08-10T09:20:09Z
- **Completed:** 2026-08-10T09:37:05Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Enforced `max(delivered, policy.minGrade ?? delivered)`, so omitted and explicit `none` policies cannot weaken a gated action below a human-in-loop floor.
- Added deterministic per-action grade, provenance, presenter, and digest issues to the existing aggregate catalog error without introducing a second build.
- Captured consent profile and evidence seams once, rejected hostile profile shapes with fixed prose, and froze a detached per-factory profile.
- Carried the profile on a private non-enumerable, non-writable, non-configurable unique-symbol marker while preserving exactly five public Concierge keys.

## Task Commits

Each task used a discriminating RED/GREEN sequence:

1. **Task 1 RED: Pin consent capability catalog failures** - `5810878` (test)
2. **Task 1 GREEN: Enforce catalog capability gates** - `cc60608` (feat)
3. **Task 2 RED: Pin profile capture and ownership** - `ece995a` (test)
4. **Task 2 GREEN: Capture private per-Concierge profiles** - `6f620a8` (feat)

## Files Created/Modified

- `packages/concierge/src/consent-profile.ts` - Validates and freezes profiles, compares capability order, and owns the private Concierge marker.
- `packages/concierge/src/catalog.ts` - Aggregates four consent capability issue codes with structured required and declared values.
- `packages/concierge/src/concierge.ts` - Captures profile and evidence seams once, performs one profile-aware catalog build, and attaches the private marker.
- `packages/concierge/test-d/catalog.test-d.ts` - Pins the expanded issue union, option types, and structured capability fields.
- `packages/concierge/test/catalog.test.ts` - Proves the delivered floor, every-offender aggregation, provenance enforcement, and attested seams.
- `packages/concierge/test/concierge.test.ts` - Proves factory isolation, one-read capture, private descriptor flags, caller-mutation safety, and one flat build.
- `packages/concierge/test/diagnostic-safety.test.ts` - Proves hostile profile accessors and proxy traps cannot echo secrets.

## Decisions Made

None - execution followed the locked Phase 8 profile, floor, aggregation, and private-handoff decisions.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- Task 1 RED produced six named CAT-04/TRN-03/seam failures while all 27 prior catalog cases remained green.
- Task 2 RED produced eight named profile-capture/ownership failures across the Concierge and diagnostic suites.
- Both RED commits precede their corresponding GREEN implementation commits.

## Verification

- Package build passed with attw and publint clean.
- Focused catalog, Concierge, and diagnostic suites passed: 3 files, 78 tests.
- Full runtime suite passed: 16 files, 348 tests.
- Typecheck passed under `tsconfig.test-d.json`.
- Negative source scan found no Concierge WeakMap registry or duplicate catalog build.
- `pnpm-lock.yaml` and package manifests remained unchanged.

## Known Stubs

None. Test-only readback and digest fakes are construction fixtures; production capability validation is fully wired.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 08-03 can store review authority against the captured factory-local profile and consume it at handler entry.
- Plan 08-05 can read the private profile to validate the real Session transport before side effects.
- No blockers remain.

## Self-Check: PASSED

- Summary and private profile module exist.
- All four RED/GREEN task commits exist in repository history.
- All seven implementation and test files listed above exist.

---
*Phase: 08-consent-kernel*
*Completed: 2026-08-10*
