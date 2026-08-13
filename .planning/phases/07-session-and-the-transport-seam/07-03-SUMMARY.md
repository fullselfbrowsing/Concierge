---
phase: 07-session-and-the-transport-seam
plan: 03
subsystem: runtime
tags: [typescript, session, transport, catalog-epochs, fifo, cancellation, tdd]

requires:
  - phase: 07-session-and-the-transport-seam
    provides: Six-key Transport lifecycle, awaitable Session contract, safe diagnostics, and deterministic stub from Plans 07-01 and 07-02
  - phase: 06-dispatcher
    provides: Stable dispatchBatch ordering, cancellation rows, and normalized ActionResult boundaries
provides:
  - Hot createSession factory with synchronous initial catalog publication and frozen handle
  - Serialized latest-wins context and connected-status transition drain
  - Catalog-reference epochs with provisional admission and published-versus-confirmed authority
  - Fail-closed fixed and rejected publication paths with stopped-state batch draining
  - Exact public createSession value and Session-related type exports with direct guard evidence
affects: [07-04-session-routing, 07-05-session-lifecycle, 08-consent-kernel, 09-framework-adapters]

tech-stack:
  added: []
  patterns:
    - Separate transport-published catalog identity from confirmed application authority
    - Gate accepted batch FIFO behind publication and transition reconciliation
    - Cache stopped state and drain Promise before diagnostics, cancellation listeners, or cleanup callbacks

key-files:
  created:
    - packages/concierge/src/session.ts
    - packages/concierge/test/session-catalog.test.ts
  modified:
    - packages/concierge/src/index.ts
    - packages/concierge/src/contract.ts
    - packages/concierge/test-d/session.test-d.ts
    - packages/concierge/test-d/exports.test-d.ts
    - packages/concierge/test/artifact.test.ts
    - packages/concierge/test/export-surface.test.ts
    - packages/concierge/test/single-instance.test.ts

key-decisions:
  - "A successfully published but superseded catalog retains its provisional epoch until the newest context either promotes that exact reference or aborts it before a different publication."
  - "Publication failure establishes stopped state and detaches accepted work before diagnostics and independent transport cleanup, then drains every accepted occurrence exactly once without responses."
  - "The package barrel exposes createSession as one callable value and keeps the reusable stub transport strictly test-only."

patterns-established:
  - "Published-versus-confirmed reconciliation: catalog identity follows the last successful setTools call while stage authority changes only after the latest generation confirms."
  - "Publication admission gate: synchronous setTools batches capture provisional context and epoch but cannot enter dispatch until the transition queue is empty."
  - "Detached stop drain: accepted queued work is aborted, removed from the live FIFO, dispatched once in arrival order, and never responded after stop."

requirements-completed: [SES-01, SES-02, SES-04, TRN-02]

duration: 31m 40s
completed: 2026-08-08
---

# Phase 7 Plan 3: Hot Session Catalog Loop Summary

**A directly guarded hot Session now serializes context and reconnect publication, reconciles transport-held catalog epochs against confirmed authority, and gates every accepted batch until the winning catalog is safe to dispatch.**

## Performance

- **Duration:** 31m 40s
- **Started:** 2026-08-08T22:11:39Z
- **Completed:** 2026-08-08T22:43:19Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added `createSession`, which synchronously publishes the exact initial catalog reference—or one dedicated frozen empty catalog—before returning a frozen four-method handle.
- Added one generation-aware transition drain for context changes and connected edges, with distinct publishing, successfully published, and confirmed catalog state.
- Added provisional catalog epochs and a publication admission gate so nested context changes can promote shared published authority or abort superseded work without early handler entry.
- Added synchronous fail-closed behavior for fixed catalogs, startup rollback, later publication failure, independent cleanup, and response-suppressed draining of accepted work.
- Published the exact 69-name / 54-type / 15-value declaration surface and proved `createSession` invokes the package-instance guard directly.

## Task Commits

Each TDD task was committed with its RED gate before GREEN implementation:

1. **Task 1 RED: Specify serialized catalog and admission behavior** — `42b5795` (`test`)
2. **Task 1 GREEN: Implement the hot Session publication loop** — `37929d6` (`feat`)
3. **Task 2 RED: Specify public factory and Session type placement** — `4103c6f` (`test`)
4. **Task 2 GREEN: Publish the factory contract and truthful prose** — `181d6b9` (`feat`)
5. **Task 3: Pin artifact surface and direct guard evidence** — `15e09f9` (`test`)

## Files Created/Modified

- `packages/concierge/src/session.ts` — hot factory, transition serialization, catalog epochs, admission-gated FIFO, diagnostics, and teardown drain.
- `packages/concierge/src/index.ts` — callable factory export, three Session-related public types, and current runtime-boundary prose.
- `packages/concierge/src/contract.ts` — direct `createSession` guard call-site documentation.
- `packages/concierge/test/session-catalog.test.ts` — C01-C16 built-artifact coverage for initial state, replay, reentrancy, publication failures, and fixed catalogs.
- `packages/concierge/test-d/session.test-d.ts` — exact public factory signature and Session transport/diagnostic type placement.
- `packages/concierge/test-d/exports.test-d.ts` — callable value-placement predicate through the public barrel.
- `packages/concierge/test/artifact.test.ts` — callable `createSession` proof against `dist/index.js`.
- `packages/concierge/test/export-surface.test.ts` — exact 69-name / 54-type / 15-value declaration gate.
- `packages/concierge/test/single-instance.test.ts` — F7 direct factory guard and subscriber cleanup proof.

## Decisions Made

- Reconciled each context against `publishedCatalog`, not only the last confirmed catalog. A nested context sharing the successfully published reference promotes its epoch without republishing; a different reference aborts it and publishes once.
- Kept stage notification authority separate from catalog identity. Equal stage strings suppress events even when different catalog references must publish, while a superseded publication never emits its stage.
- Installed the cached stop Promise and stopped lifecycle before invoking abort listeners, diagnostics, unsubscribers, or catalog clearing so every reentrant path observes an inert Session.
- Preserved transport envelope ownership: Session replaces only the cancellation signal and leaves parsing, stable call ordering, result authorship, and deduplication in the existing dispatcher.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the minimal factory barrel export during Task 1 GREEN**
- **Found during:** Task 1 (Implement serialized latest-wins publication and gated batch admission)
- **Issue:** The mandatory runtime suite imports `dist/index.js`, while tsdown has only `src/index.ts` as an entry; an unexported `session.ts` cannot reach the built artifact for Task 1 verification.
- **Fix:** Added only `export { createSession } from "./session.js"` in Task 1 GREEN, then completed its public type placement and prose in Task 2 as planned.
- **Files modified:** `packages/concierge/src/index.ts`
- **Verification:** The rebuilt C01-C16 suite passed against `dist/index.js`; Task 2's RED gate still failed on the three intentionally missing public types.
- **Committed in:** `37929d6`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The change was the minimum required to execute the mandated built-artifact RED/GREEN gate and introduced no additional public value beyond the plan's final surface.

## Issues Encountered

None beyond the built-entry sequencing issue documented above.

## TDD Gate Compliance

- Task 1 RED built successfully and all 16 C01-C16 cases failed only because `createSession` was absent; GREEN passed all 16 cases plus package typecheck and the forbidden-primitive scan.
- Task 2 RED failed on missing public `TransportStatus`, `SessionDiagnosticCode`, and `SessionDiagnostic` exports; GREEN passed the exact factory/type predicates, package typecheck, build, and fixture-leak scan.
- Git history contains each `test(07-03)` RED commit before its corresponding `feat(07-03)` GREEN commit.

## Verification

- `pnpm build` — passed with publint and attw clean.
- Plan-specific built suites — passed 4 files and 41 tests, including all C01-C16 cases and F7.
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — passed.
- `pnpm test` — passed 14 files and 278 tests.
- F7 mutation proof — build exited 0 after removing only Session's direct guard; the selected test exited non-zero because the registry remained empty. The guard was restored and the suite passed again.
- Static scans found no `catalogFor({})`, timer, network, WebRTC, vendor reconnect, or test-fixture import in production Session/barrel source.
- The plan diff contains exactly the nine declared files; no manifest, dependency, or lockfile changed.

## Known Stubs

None. The dedicated frozen empty catalog and nullable factory-local lifecycle bindings are intentional runtime state, not placeholder data; every required publication, routing, diagnostic, and teardown path is wired.

## Threat Model Evidence

- **T-07-01:** C03 and C10-C16 prove exact-reference epochs, latest-generation checks, promotion of shared published authority, and abort-before-dispatch for distinct authority.
- **T-07-04:** C06-C16 prove nested callbacks enqueue behind one drain and that stopped state precedes cancellation, diagnostics, and cleanup reentrancy.
- **T-07-05:** C08, C09, C13, and C14 prove fixed safe publication errors/diagnostics, independent cleanup, one-dispatch detached drains, and zero post-stop responses or stage output.
- **T-07-06:** The artifact surface is exactly 69/54/15, the stub is absent from production exports, and F7 detects removal of Session's direct guard call.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 07-04 can extend the established FIFO and composed-signal seam with detailed routing/envelope proofs.
- Plan 07-05 can extend lifecycle/teardown coverage against the cached stop drain and safe diagnostic boundary.
- Phase 8 can add consent at the preserved metadata seam without changing Session's catalog authority model.
- No blockers remain.

## Self-Check: PASSED

All nine declared source/test files and this summary exist; task commits `42b5795`, `37929d6`, `4103c6f`, `181d6b9`, and `15e09f9` are present in git history; the plan diff is exactly scoped; and manifests plus `pnpm-lock.yaml` remain unchanged.

---
*Phase: 07-session-and-the-transport-seam*
*Completed: 2026-08-08*
