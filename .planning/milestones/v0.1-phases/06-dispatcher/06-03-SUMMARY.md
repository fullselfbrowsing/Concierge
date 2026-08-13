---
phase: 06-dispatcher
plan: 03
subsystem: runtime
tags: [typescript, message-sanitization, scheduler, globalthis, security]

# Dependency graph
requires:
  - phase: 05-bridge-registry-and-the-no-bridge-path
    provides: "The surrogate-safe `offPageResult` bound and the sanctioned structural-host warning seam"
  - phase: 06-dispatcher
    plan: 01
    provides: "The exact Scheduler type pin and fingerprinted sanitizer/timer RED contracts"
provides:
  - "One internal surrogate-safe message bound shared by bridge output and dispatcher sanitization"
  - "Ordered C0/C1 removal, whitespace normalization, trimming, and shared message capping"
  - "A structural host Scheduler fallback with paired capability detection and idempotent cancellation"
affects: [06-04, 06-05, 06-06, 08-consent-kernel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Internal safety primitives stay off the public barrel and share the exported policy constant"
    - "Platform capabilities are read through minimal function-local globalThis views without DOM or Node types"

key-files:
  created:
    - packages/concierge/src/message.ts
  modified:
    - packages/concierge/src/bridge.ts
    - packages/concierge/src/host.ts

key-decisions:
  - "Message bounding stays distinct from dispatcher sanitization: both use one internal surrogate-safe bound, while only the outbound boundary removes controls and normalizes whitespace."
  - "The host Scheduler fallback requires both timer functions, preserves the host receiver and opaque handle, and returns an at-most-once canceller."

patterns-established:
  - "Message boundary: controls -> whitespace collapse -> trim -> surrogate-safe shared cap."
  - "Host adapter: detect a complete capability pair, capture both functions, preserve their receiver, and expose only an idempotent canceller."

requirements-completed: [DSP-08, SEC-06]

# Metrics
duration: 9min
completed: 2026-08-06
---

# Phase 6 Plan 03: Dispatcher Safety Primitives Summary

**A shared surrogate-safe message boundary and cancellable structural host timer now supply the two safety primitives required by the dispatcher without widening the public API or platform type surface.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-06T03:31:17Z
- **Completed:** 2026-08-06T03:40:47Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Extracted `boundedMessage` from the bridge byte-for-behavior, retaining the high-surrogate cut adjustment and the single `MESSAGE_MAX_CHARS` policy source.
- Added `sanitizeMessage` with the locked SEC-06 ordering: C0/C1 runs become spaces, whitespace collapses, edges trim, and the shared bound runs last.
- Added `readHostScheduler`, which detects complete timer capability, preserves host receivers and opaque handles, and returns an idempotent canceller without DOM or Node timer types.
- Kept both message helpers and the timer adapter internal; the public barrel and dependency graph did not widen.

## Task Commits

Each task was committed atomically:

1. **Task 1 (06-03-T1): Extract the shared bound and add the dispatcher sanitizer** — `6bf3f92` (feat)
2. **Task 2 (06-03-T2): Add the cancellable structural host Scheduler fallback** — `a6e3701` (feat)

## Files Created/Modified

- `packages/concierge/src/message.ts` — internal shared bound plus ordered dispatcher sanitizer.
- `packages/concierge/src/bridge.ts` — imports the shared bound while preserving `offPageResult` wording and result shape.
- `packages/concierge/src/host.ts` — structural timer view and cancellable host Scheduler fallback beside `warnHost`.

## Decisions Made

- Bounding remains a non-destructive length policy distinct from dispatcher sanitization. This preserves direct `offPageResult` behavior while giving every future dispatcher exit one stronger outbound boundary.
- A partial timer host is treated as absent. Requiring both scheduling and cancellation prevents a host from exposing a commit window that cannot honor abort.
- Cancellation is marked before calling the host so even a throwing `clearTimeout` is attempted at most once.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification Evidence

| Gate | Result |
|---|---|
| `pnpm build` | PASS; tsdown, attw, and publint completed cleanly |
| Bridge runtime regression | PASS; 53 tests across `bridge.test.ts` and `bridge-snapshot.test.ts` |
| Task 2 type allowlist | PASS; exactly `_dispatchSignature`/TS2344, `_dispatchBatchSignature`/TS2339, and `_conciergeKeys`/TS2344 remain; `_schedulerSignature` is green |
| Message source audits | PASS; one `boundedMessage`, shared constant import, ordered sanitizer, retained surrogate guard, and no public barrel export |
| Timer source audits | PASS; one function-local `globalThis` timer view, paired capability guard, no platform handle type, and no unsanctioned source timer call |
| Host Scheduler runtime probe | PASS; same-host receivers, opaque handle round-trip, one clear across two cancels, and partial capability rejection |
| Full Vitest integrity gate | PASS; 212 total = 144 passing + exactly the intentional R01-R54/Q01-Q14 RED cases, with 0 pending/todo or incidental failures |
| `git diff --check` | PASS |

## Known Stubs

None. The dispatcher itself remains intentionally RED for plans 06-04 and 06-05, but both primitives delivered by this plan are complete and wired at their designated internal seams.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-04 can import `sanitizeMessage` and `readHostScheduler` into the single-call pipeline without inventing a second policy or host access path.
- Plan 06-05 can delegate batch calls to that pipeline and inherit the same message and timing guarantees.
- Plan 06-06 retains exactly 68 intentional RED dispatcher cases for implementation and mutation closure; no unrelated failure was introduced.
- No package, authentication, external service, or architectural blocker remains.

## Self-Check: PASSED

- `packages/concierge/src/message.ts` — FOUND
- `packages/concierge/src/bridge.ts` — FOUND
- `packages/concierge/src/host.ts` — FOUND
- `.planning/phases/06-dispatcher/06-03-SUMMARY.md` — FOUND
- Commit `6bf3f92` — FOUND in git history
- Commit `a6e3701` — FOUND in git history
- One internal bound, no public helper export, no stub marker, and a clean production tree — CONFIRMED

---
*Phase: 06-dispatcher*
*Completed: 2026-08-06*
