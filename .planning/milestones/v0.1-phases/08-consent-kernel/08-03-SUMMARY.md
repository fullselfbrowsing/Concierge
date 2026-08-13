---
phase: 08-consent-kernel
plan: 03
subsystem: consent
tags: [consent, state-machine, delivery, snapshot, one-shot-authority]
requires:
  - phase: 08-02
    provides: captured per-Concierge consent profile and construction capability gates
  - phase: 05-bridge-registry-and-the-no-bridge-path
    provides: detached bridge snapshot capture and normalization
  - phase: 06-dispatcher
    provides: exact-Promise dispatch dedupe, commit window, cancellation, and one handler entry
provides:
  - factory-local review-keyed generation ledger armed only by owned completed delivery
  - fresh response or human-attested user-turn binding with a delivered runtime grade floor
  - late detached snapshot comparison and atomic one-shot authority consumption
  - exact frozen ConsentAck injection with stored payload and snapshot references
affects: [08-04, 08-05, 08-07, consent-evidence, mutation-verification]
tech-stack:
  added: []
  patterns:
    - state transitions remain behind the existing non-async exact-Promise dispatch cache
    - hostile callbacks mutate only the generation and response they still own
    - supported snapshot containers compare structurally while unsupported exotic leaves require identity
key-files:
  created:
    - packages/concierge/test/consent-kernel.test.ts
  modified:
    - packages/concierge/src/concierge.ts
key-decisions:
  - "Default consent snapshot equality is cycle-safe for arrays/plain records/Map/Set, compares Date values by timestamp, and compares unsupported exotic leaves by identity."
patterns-established:
  - A validated fresh review invalidates earlier authority before any later detachment, commit, handler, or delivery failure.
  - Consent policy fields and authored onMissing results are captured into fixed construction-time data.
requirements-completed: [CON-01, CON-02, CON-03, CON-04, CON-05, CON-06, CON-08, CON-09]
duration: 46m
completed: 2026-08-10
---

# Phase 8 Plan 3: Delivery-Armed Consent Kernel Summary

**A factory-local, generation-owned consent ledger now arms only on matching completed delivery, verifies a fresh boundary and late detached state, then consumes once before injecting the exact reviewed payload and snapshot into a frozen acknowledgement.**

## Performance

- **Duration:** 46m
- **Started:** 2026-08-10T10:05:30Z
- **Completed:** 2026-08-10T10:51:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added a lazy per-Concierge ledger keyed by globally unique review action name, with monotonic generations that make stale, repeated, mismatched, interrupted, or superseded delivery callbacks inert.
- Preserved exact retry identity through the existing non-async dispatch cache while enforcing one grant across every gated action sharing a review.
- Required non-empty distinct response ids or human-attested distinct user-turn ids, clamped runtime policy minimums to delivered, and independently rejected achieved `none` before arming and before entry.
- Captured the review handler's exact frozen validated args and detached bridge snapshot, compared current detached state after the commit window, and destroyed authority on drift or comparator failure.
- Deleted owned authority before application code, then supplied one frozen `ConsentAck` carrying the stored review ids, achieved grade, payload reference, and snapshot reference.
- Preserved exact exported decline and dismissal results as one-attempt terminal observations that never arm or rearm a gated effect.

## Task Commits

Each task used a discriminating RED/GREEN sequence:

1. **Task 1 RED: Pin delivery-owned generation authority** - `3fd4131` (test)
2. **Task 1 GREEN: Implement delivery-armed authority** - `9eb60dd` (feat)
3. **Task 2 RED: Pin binding, drift, identity, and terminal behavior** - `78a9b05` (test)
4. **Task 2 GREEN: Bind, compare, consume, and inject the exact ack** - `f29785a` (feat)

## Files Created/Modified

- `packages/concierge/src/concierge.ts` - Owns the generation ledger, delivery callback guard, boundary and grade enforcement, structural snapshot comparison, terminal observations, atomic consumption, and ack injection.
- `packages/concierge/test/consent-kernel.test.ts` - Exercises K01-K26 and N01-N04 against the built artifact, including catalog-floor fault injection, exact reference identity, hostile callbacks, every supported snapshot container, and construction-time policy capture.

## Decisions Made

- Default snapshot equality is cycle-safe across arrays, plain records, Maps, and Sets; Dates compare by timestamp; unsupported exotic leaves require identity.
- Map and Set iteration order remains part of their strict detached structure rather than being normalized into unordered collections.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Captured consent policy accessors at construction**
- **Found during:** Task 2
- **Issue:** The action shell was copied, but a nested accessor-backed consent policy could still change `requires`, `bindTo`, `minGrade`, the comparator, or `onMissing` after catalog validation and retarget the runtime gate.
- **Fix:** Copied every later-read policy field and the authored fallback into frozen data during `createConcierge`; K25 mutates every backing accessor after construction and proves runtime behavior remains fixed.
- **Files modified:** `packages/concierge/src/concierge.ts`, `packages/concierge/test/consent-kernel.test.ts`
- **Commit:** `f29785a`

**2. [Rule 1 - Bug] Moved fresh-review invalidation ahead of validated-output detachment**
- **Found during:** Task 2 final diff review
- **Issue:** Schema validation could succeed and then output detachment could fail before the previous armed generation was invalidated, leaving stale authority usable.
- **Fix:** Made successful ordinary validation the immediate invalidation boundary, before `snapshotInvocationValue`; K26 proves a detachment failure returns `invalid_args` while the older grant stays closed.
- **Files modified:** `packages/concierge/src/concierge.ts`, `packages/concierge/test/consent-kernel.test.ts`
- **Commit:** `f29785a`

## TDD Gate Compliance

- Task 1 RED passed the package build while all 14 K01-K12/N01-N02 cases failed on the absent authority state machine; Task 1 GREEN made all 14 pass.
- Task 2 RED retained 18 established cases green while 10 binding, late-comparison, ack, terminal, and runtime-floor cases failed for their intended missing behavior.
- Task 2 GREEN made the final focused suite pass at 30/30; K25 and K26 were added during Rules 2 and 1 hardening in the GREEN review cycle.
- Both required RED commits precede their corresponding GREEN commits.

## Verification

- Package and workspace builds passed with attw and publint clean.
- Focused consent suite passed: 1 file, 30 tests.
- Related catalog, dispatcher, batch, and bridge snapshot suites passed: 4 files, 162 tests.
- Full runtime suite passed: 18 files, 381 tests.
- Workspace typecheck passed under the package's declaration/type-test configuration.
- Source checks confirm `dispatch` remains non-async and the same measured-grade predicate is called at both arming and handler-entry boundaries.
- `git diff --check` passed; package manifests and `pnpm-lock.yaml` remained unchanged.

## Known Stubs

None. Empty arrays, maps, and objects in the focused test file are mutable observation fixtures; lazy `null` maps in production are intentional per-factory state allocation, not unwired UI or runtime data.

## Issues Encountered

- Central diff review strengthened K19 so array, record, Date, Map, and Set drift are independently observable and pinned K24 to the exported frozen terminal constants by identity.
- Central final review found and closed the validated-output detachment ordering edge captured by K26 before the implementation commit.

## User Setup Required

None - no external service, secret, package, or environment configuration is required.

## Next Phase Readiness

- The non-attested state machine is ready for attested receipt/hash evidence to extend achieved grades without changing the review/generation/consumption boundary.
- The Phase 8 mutation battery can target review-return arming, callback ownership, early/live snapshot comparison, payload reconstruction, late consumption, and the two independent `none` guards.
- No blockers remain.

## Self-Check: PASSED

- Summary, implementation, and focused test files exist.
- All four RED/GREEN task commits exist in repository history.
- No tracked file was deleted by the task commits.

---
*Phase: 08-consent-kernel*
*Completed: 2026-08-10*
