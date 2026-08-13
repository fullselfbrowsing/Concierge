---
phase: 07-session-and-the-transport-seam
plan: 04
subsystem: runtime
tags: [typescript, session, fifo, cancellation, lazy-descriptors, hostile-input, tdd]

requires:
  - phase: 07-session-and-the-transport-seam
    provides: Hot publication-gated Session, provisional catalog epochs, and one guarded FIFO from Plan 07-03
  - phase: 06-dispatcher
    provides: Total dispatchBatch metadata snapshots, stable rows, cancellation authorship, and hostile-getter containment
provides:
  - Complete-batch FIFO with one dispatch per accepted occurrence and one non-retried response attempt per returned row
  - Arrival-time context and catalog-epoch capture for active and queued transport work
  - Admission-time structural cancellation composition across transport, epoch, and stop authority
  - Frozen null-prototype ToolBatch facade with lazy evidence getters and signal-only replacement
  - Built-artifact parity coverage for all four hostile ToolBatch evidence getters
affects: [07-05-session-lifecycle, 07-06-session-verification, 08-consent-kernel, 09-framework-adapters]

tech-stack:
  added: []
  patterns:
    - Attach and validate hostile upstream cancellation at occurrence admission, then dispose its captured listener exactly once
    - Preserve the raw transport envelope and defer evidence reads through a null-prototype descriptor facade
    - Compare Session routing against direct Phase 6 dispatch to prove totality without duplicating dispatcher policy

key-files:
  created:
    - packages/concierge/test/session-routing.test.ts
  modified:
    - packages/concierge/src/session.ts

key-decisions:
  - "The only source ToolBatch field Session reads at admission is signal; responseId, userTurnId, calls, and deferUntilDelivered remain raw until Phase 6 reads the dispatch facade."
  - "One owned structural signal composes transport, catalog-epoch, and stop cancellation, while finalization attempts the captured upstream removal function at most once."
  - "Hostile evidence behavior is judged by exact row parity with direct Concierge.dispatchBatch, keeping result authorship and totality in Phase 6."

patterns-established:
  - "Lazy transport envelope: store sourceBatch by reference and construct one frozen null-prototype accessor facade immediately before dispatchBatch."
  - "Admission cancellation scope: independently guard source signal access, structural member reads, listener attachment, race-closing aborted read, and listener removal."
  - "Occurrence cardinality: each callback occurrence crosses one FIFO independently, even when the same object or identifier is delivered repeatedly."

requirements-completed: [SES-01, SES-02, SES-03]

duration: 22m 12s
completed: 2026-08-08
---

# Phase 7 Plan 4: Session Routing and Lazy Transport Envelope Summary

**Transport batches now cross one complete-work FIFO through an admission-linked composite signal and a lazy null-prototype envelope that preserves Phase 6 metadata totality exactly.**

## Performance

- **Duration:** 22m 12s
- **Started:** 2026-08-08T22:47:31Z
- **Completed:** 2026-08-08T23:09:43Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Pinned complete-batch FIFO across dispatch, every response attempt, and finalization, including repeated delivery of the same batch object and contained response/dispatch failures.
- Captured exact context and catalog epoch at arrival, retained authority across same-catalog updates, and aborted active plus queued old-epoch work before replacement catalog publication.
- Moved structural upstream-signal validation and attachment to admission, composed transport/epoch/stop cancellation into one owned signal, and made listener removal once-only and independently contained.
- Replaced the eager ordinary-object envelope with one frozen null-prototype facade whose five enumerable accessor descriptors preserve evidence values/references and replace only signal.
- Proved real-handler metadata identity and direct Phase 6 parity for throwing responseId, userTurnId, calls, and deferUntilDelivered getters, with FIFO continuation and no sentinel disclosure.

## Task Commits

1. **Task 1: Characterize complete-work FIFO and response cardinality** — `43ed8c2` (`test`)
2. **Task 2 RED: Specify arrival epochs, cancellation composition, lazy descriptors, and hostile parity** — `25ca563` (`test`)
3. **Task 2 GREEN: Implement admission cancellation and lazy evidence forwarding** — `93ef14f` (`feat`)

## Files Created/Modified

- `packages/concierge/test/session-routing.test.ts` — J01-J18 built-artifact coverage for FIFO/cardinality, arrival authority, three-source cancellation, exact facade descriptors, real metadata, hostile signals, and direct-dispatch parity.
- `packages/concierge/src/session.ts` — admission-time structural cancellation scope, raw `sourceBatch` work records, once-only upstream cleanup, and the lazy frozen null-prototype facade.

## Decisions Made

- Read and structurally validate only `sourceBatch.signal` during admission. Each evidence getter remains untouched until the existing dispatcher asks the facade for it.
- Capture the upstream removal method with its signal and listener after structural validation, so finalization does not re-read a hostile member and still makes at most one guarded removal attempt.
- Keep epoch-aborted queued work in the original FIFO. It still enters `dispatchBatch` exactly once, allowing Phase 6 to author normal aborted rows and Session to respond while active.
- Use direct dispatch as the oracle for hostile evidence fields, so Session tests assert exact row/cardinality/order parity instead of reproducing dispatcher expectations.

## Deviations from Plan

### Approved Baseline Drift

**1. Task 1's planned RED behavior already existed in the Plan 07-03 baseline**
- **Found during:** Task 1 RED gate
- **Issue:** J01-J06 passed immediately because commit `37929d6` had necessarily established the single admission-gated pump, once-only dispatch, stable response loop, and failure continuation required by Plan 07-03.
- **Resolution:** After reporting the exact source and commit evidence, the orchestrator approved treating J01-J06 as regression characterization. No artificial source churn or false failing assertion was introduced.
- **Files modified:** `packages/concierge/test/session-routing.test.ts`
- **Committed in:** `43ed8c2`

### Auto-fixed Issues

**2. [Rule 3 - Blocking] Corrected strict TypeScript narrowing in the new cancellation scope**
- **Found during:** Task 2 GREEN typecheck
- **Issue:** Runtime `typeof value === "function"` validation narrowed structural listener methods to `Function`, and TypeScript retained a stale pre-callback lifecycle narrowing even though the hostile signal getter may reenter Session.
- **Fix:** Narrowed the validated methods to their exact `AbortSignalLike` signatures and used the existing `hasStopped()` read barrier after admission-time outside code.
- **Files modified:** `packages/concierge/src/session.ts`
- **Verification:** Package typecheck, J01-J18, all Session tests, and the full repository suite passed.
- **Committed in:** `93ef14f`

---

**Total deviations:** 1 approved baseline-drift exception, 1 auto-fixed blocking issue
**Impact on plan:** No scope expansion or public API change. The exception preserved honest TDD history; the blocking fix made the planned hostile-callback boundary type-safe and reentrancy-aware.

## Issues Encountered

None beyond the baseline drift and strict-narrowing correction documented above.

## TDD Gate Compliance

- Task 1's attempted RED gate built and ran all J01-J06 cases, but all six passed against the existing Plan 07-03 implementation. The approved characterization exception is recorded above and in commit `43ed8c2`.
- Task 2 RED ran all 18 cases: 16 passed and the intended J08/J12 invariants failed because queued upstream signals were not linked at admission and source signal access was deferred until dispatch.
- Task 2 GREEN follows its RED commit in git history and passes J01-J18, package typecheck, both static source gates, all Session tests, and the full repository suite.

## Verification

- `pnpm --filter @fullselfbrowsing/concierge build` — passed with publint and attw clean.
- `pnpm exec vitest run packages/concierge/test/session-routing.test.ts --reporter=verbose` — passed all 18 named J01-J18 cases.
- `pnpm test` — passed 15 files and 296 tests.
- `pnpm typecheck` — passed all three workspace package checks.
- Forbidden primitive scan — no AbortController, timer, Promise.race, or Session invocation of deferUntilDelivered appears in `session.ts`.
- Descriptor gate — exactly one `Object.defineProperties` site and no `sourceBatch` spread, Object.assign, or evidence destructuring.
- The plan diff contains exactly `session.ts` and `session-routing.test.ts`; no manifest, lockfile, dependency, dispatcher implementation, or public type changed.

## Known Stubs

None. Empty collections and nullable bindings in `session.ts` are intentional queue, listener, catalog, and lifecycle state; both planned runtime seams are fully wired.

## Threat Model Evidence

- **T-07-01:** J07-J10 prove exact arrival context/epoch capture, same-catalog retention, and active/queued abort before replacement publication.
- **T-07-02:** J01-J05 prove one complete-work FIFO, one dispatch per accepted occurrence, stable one-attempt responses, and failure continuation without retry.
- **T-07-03:** J12-J18 prove lazy evidence reads, signal-only replacement, exact real-handler metadata, and direct Phase 6 parity under four throwing getters.
- **T-07-04:** J09-J11 prove transition and stop cancellation converge on the same composed signal while old queued work remains deterministically drainable.
- **T-07-05:** J04, J05, and J14 prove fixed diagnostics, caught-detail suppression, hostile-signal fail-close, and cleanup continuation after removal failure.

No new endpoint, authentication path, file-access boundary, schema, or other threat surface was introduced beyond the plan's registered Session transport seam.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 07-05 can exercise cached stop-drain and post-stop suppression against a FIFO whose work records already own arrival context, epoch, and cancellation cleanup.
- Plan 07-06 can mutate the lazy facade, admission listener, epoch abort, and response cardinality boundaries with exact J01-J18 evidence in place.
- Phase 8 receives exact response/turn identity and delivery-hook references through the existing InvocationMeta seam without a Session API change.
- No blockers remain.

## Self-Check: PASSED

Both declared source/test files and this summary exist; task commits `43ed8c2`, `25ca563`, and `93ef14f` are present in git history; the plan diff is exactly scoped; and no manifest, lockfile, or generated artifact remains changed.

---
*Phase: 07-session-and-the-transport-seam*
*Completed: 2026-08-08*
