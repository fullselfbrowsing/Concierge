---
phase: 06-dispatcher
plan: 04
subsystem: runtime
tags: [typescript, dispatcher, deduplication, standard-schema, abort-signal, security]

# Dependency graph
requires:
  - phase: 04-stage-resolution-and-per-stage-catalogs
    provides: "Ordered stage resolution, frozen name projections, and the null-prototype catalog lookup"
  - phase: 05-bridge-registry-and-the-no-bridge-path
    provides: "The single live bridge resolver and honest null bridge path"
  - phase: 06-dispatcher
    plans: [01, 03]
    provides: "Fingerprint-registered single-call contracts plus the message sanitizer and structural host Scheduler fallback"
provides:
  - "Context-aware single-call dispatch with stage authorization before handler lookup"
  - "Exact-Promise retry deduplication across pending and post-settlement windows"
  - "Standard Schema revalidation, cancellable commit delay, bridge hand-forward, and defensive result normalization"
  - "One sanitized outbound ActionResult boundary with fixed exception-safe authored failures"
affects: [06-05, 06-06, 07-session-and-transports, 08-consent-kernel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A non-async public method stores and returns the exact final Promise before any asynchronous work can race a retry"
    - "Untrusted boundaries are ordered and caught independently: key, stage, validation, wait, bridge, handler, normalization"
    - "Pending dedup entries do not expire; settled timestamps begin the timer-free access-eviction window"

key-files:
  created:
    - packages/concierge/src/dispatch.ts
  modified:
    - packages/concierge/src/concierge.ts
    - packages/concierge/src/types.ts
    - packages/concierge/src/index.ts
    - packages/concierge/test/dispatcher.test.ts
    - packages/concierge/test/concierge.test.ts

key-decisions:
  - "The final dispatch Promise is cached synchronously; pending entries never expire, and each settled window starts at settlement and is swept on later access without a timer."
  - "The active stage's frozen name projection authorizes a call before the null-prototype catalog lookup, and the existing resolveBridge function remains the only bridge resolution seam."
  - "A registered action without a callable handler returns the exact reasonless unavailable result and warns once rather than inventing an inaccurate ReasonCode."

patterns-established:
  - "Dispatch order: derive key -> authorize stage/name -> validate -> wait/abort -> resolve bridge -> invoke -> normalize/sanitize."
  - "Result boundary: read only ok/reason/message under one guard, strip extras, repair documented contradictions, sanitize every exit."

requirements-completed: [DSP-01, DSP-02, DSP-03, DSP-04, DSP-05, DSP-08, DSP-09, SEC-02, SEC-06, TRN-04]

# Metrics
duration: 24min
completed: 2026-08-06
---

# Phase 6 Plan 04: Context-Aware Single-Call Dispatcher Summary

**A stage-authorized direct dispatcher now deduplicates the exact final Promise, revalidates arguments, honors cancellable commit timing, resolves the live bridge, and converts every handler outcome into a fresh sanitized result.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-06T03:45:09Z
- **Completed:** 2026-08-06T04:08:48Z
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- Added the complete single-call pipeline with namespaced retry keys, sync/async Standard Schema validation, transformed-value forwarding, abort-safe commit timing, and one bridge hand-forward.
- Added instance-local Promise, pending-key, and settlement-time stores so repeated calls reuse the exact final Promise without allowing a long-running pending call to age out.
- Enforced the stage projection before catalog lookup, including explicit `__proto__` and `constructor` refusal, while retaining the frozen null-prototype `byName` registry.
- Normalized hostile or malformed handler returns into fresh allowlisted results, sanitized all authored and handler messages, and kept caught details out of results, warnings, and telemetry.
- Deleted the obsolete dispatcher stub and S27 contract, corrected the measured three-seal prose, and documented the shipped direct-dispatch boundary without claiming Session, Transport, or consent orchestration.
- Preserved the package's exact 65-name public surface split into 51 types and 14 runtime values; dispatcher helpers remain internal.

## Task Commits

Each task was committed atomically:

1. **Task 1 (06-04-T1): Implement stage-scoped orchestration and exact-Promise deduplication** — `154bd04` (feat)
2. **Task 2 (06-04-T2): Remove the obsolete stub contract and make shipped prose truthful** — `7ef8774` (refactor)

## Files Created/Modified

- `packages/concierge/src/dispatch.ts` — stateless key, validation, commit-wait, reason-check, authored-result, and defensive normalization helpers.
- `packages/concierge/src/concierge.ts` — stage-scoped non-async dispatch, per-instance retry stores and warning latches, bridge resolution, handler invocation, and stub removal.
- `packages/concierge/src/types.ts` — final context-first dispatch signature plus settled Scheduler, commit-window, dedupe-window, and result-boundary documentation.
- `packages/concierge/src/index.ts` — truthful package overview for direct dispatch and the still-absent Session/Transport/consent layers.
- `packages/concierge/test/dispatcher.test.ts` — R01-R54 single-call behavior contract, including corrected registered-handler absence expectations.
- `packages/concierge/test/concierge.test.ts` — removed S27 and its coupled stub/count history while preserving the 25 stage/catalog cases.

## Decisions Made

- Retry identity is the final pipeline Promise itself. The method remains non-async, stores that Promise before returning, protects pending entries indefinitely, and starts each 600 ms settled window only when the Promise settles.
- Deduplication uses `Date.now()` only at settlement and access. It does not consume the Scheduler seam, so an unavailable host timer can skip only the commit delay and cannot weaken retry suppression.
- Stage authorization comes from the already-frozen `namesByStage` projection and happens before `catalog.byName`; no second handler registry was introduced.
- Missing or non-callable registered handlers remain honest: the dispatcher warns once and returns `{ ok: false, message: "This action is unavailable because no handler is registered." }` without fabricating a failure code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected stale R11/R12 expectations for registered actions without callable handlers**
- **Found during:** Task 1
- **Issue:** Wave 0 expected `unknown_action`, but the authoritative 06-04 contract requires an exact reasonless unavailable result because the action is registered and no declared ReasonCode truthfully means “handler missing.”
- **Fix:** Updated R11 and R12 to assert the exact reasonless result on both calls plus one warn-once diagnostic, then implemented that contract.
- **Files modified:** `packages/concierge/test/dispatcher.test.ts`
- **Commit:** `154bd04`

## Issues Encountered

- JavaScript `await` performs a `then` lookup even on a hostile Proxy returned synchronously by a handler. That initially mislabeled R41 as `handler_error`; synchronous invocation is now caught separately and only native Promise returns are awaited, allowing the normalizer to classify hostile result objects as `invalid_result`.

## Verification Evidence

| Gate | Result |
|---|---|
| `pnpm build` | PASS; tsdown, attw, and publint completed cleanly |
| Single-call dispatcher suite | PASS; R01-R54 all green (54/54) |
| Dispatcher plus stage/catalog regression | PASS; 79/79 tests (54 dispatcher + 25 concierge) |
| Exact dispatcher type gate | PASS; only planned `_dispatchBatchSignature`/TS2339 and `_conciergeKeys`/TS2344 diagnostics remain |
| Public artifact/export gate | PASS; 17/17 tests and exactly 65 names = 51 types + 14 values |
| Full Vitest integrity gate | PASS; 211 total = 197 passing + exactly intentional Q01-Q14 batch RED, with 0 pending/todo or incidental failures |
| Stub and seal source audits | PASS; prohibited stub strings absent, three measured assembly freezes, no public dispatch/helper export |
| Threat surface audit | PASS; every new dispatch boundary is covered by T-06-01 through T-06-07 and no unplanned endpoint, auth, file, or schema surface was introduced |
| `git diff --check` | PASS |

## Known Stubs

None. `dispatchBatch` remains deliberately absent for plan 06-05 and is represented by the exact Q01-Q14 RED contract rather than a runtime stub.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-05 can serialize batch rows through this single-call dispatcher and inherit its validation, timing, bridge, dedupe, and normalization guarantees.
- Q01-Q14 are the only intentional runtime failures and the only planned type gap is `dispatchBatch`; the single-call R01-R54 contract is fully green.
- Plan 06-06 can close the dispatcher mutation and integration evidence against an implemented single-call boundary.
- No package, authentication, external service, or architectural blocker remains.

## Self-Check: PASSED

- `packages/concierge/src/dispatch.ts` — FOUND
- `packages/concierge/src/concierge.ts` — FOUND
- `packages/concierge/src/types.ts` — FOUND
- `packages/concierge/src/index.ts` — FOUND
- `packages/concierge/test/dispatcher.test.ts` — FOUND
- `packages/concierge/test/concierge.test.ts` — FOUND
- `.planning/phases/06-dispatcher/06-04-SUMMARY.md` — FOUND
- Commit `154bd04` — FOUND in git history
- Commit `7ef8774` — FOUND in git history
- Six changed implementation/contract files, exact requirement list, and a clean production tree — CONFIRMED

---
*Phase: 06-dispatcher*
*Completed: 2026-08-06*
