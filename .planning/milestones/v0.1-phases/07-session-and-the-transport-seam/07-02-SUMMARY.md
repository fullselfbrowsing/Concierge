---
phase: 07-session-and-the-transport-seam
plan: 02
subsystem: testing
tags: [typescript, transport, vitest, tdd, immutable-fixtures]

requires:
  - phase: 07-session-and-the-transport-seam
    provides: Exact six-key Transport lifecycle and capability contracts from Plan 07-01
provides:
  - Reusable test-only no-I/O Transport harness with synchronous lifecycle and batch controls
  - Frozen conversational and command-palette capability profiles
  - Deterministic occurrence failures with immutable catalog, response, and subscriber evidence
affects: [07-03-session-runtime, 07-04-session-routing, 07-05-session-lifecycle, 08-consent-kernel]

tech-stack:
  added: []
  patterns:
    - Frozen test harness keeps controls beside, never on, the exact production Transport object
    - One-based failure injection records every attempt before throwing fixed fixture-authored errors

key-files:
  created:
    - packages/concierge/test/fixtures/stub-transport.ts
    - packages/concierge/test/stub-transport.test.ts
    - packages/concierge/test-d/stub-transport.test-d.ts
  modified: []

key-decisions:
  - "Subscription registrations use monotonic tokens so duplicate callback identities retain independent cleanup authority."
  - "Catalog histories preserve the exact caller array reference while history containers and response rows are frozen snapshots."
  - "Failure options are copied and frozen at construction so later caller mutation cannot alter deterministic occurrences."

patterns-established:
  - "Controlled transport boundary: production receives one frozen six-key Transport while tests retain explicit frozen sibling controls."
  - "Attempt evidence: setTools and respond append immutable observations before applying one-based injected failure decisions."

requirements-completed: [TRN-02]

duration: 11m 49s
completed: 2026-08-08
---

# Phase 7 Plan 2: Deterministic Stub Transport Summary

**A frozen no-I/O Transport harness now drives synchronous lifecycle and batch events, deterministic failures, and immutable attempt evidence through two exact capability profiles.**

## Performance

- **Duration:** 11m 49s
- **Started:** 2026-08-08T21:55:10Z
- **Completed:** 2026-08-08T22:06:59Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added exact frozen conversational and command-palette profiles plus a frozen six-key Transport whose status is backed by live closure state.
- Added synchronous snapshot delivery for status transitions and ToolBatch arrivals with identity-safe subscriber bookkeeping and immutable count snapshots.
- Added copied one-based failure configuration for catalog publication, response delivery, and each independent subscription/unsubscription path.
- Added immutable history snapshots that record every attempt before failure while retaining the original catalog array reference for reconnect assertions.
- Brought the otherwise test-only fixture into the strict package TypeScript program and pinned its Transport key set exactly.

## Task Commits

Each TDD task was committed as a RED/GREEN pair:

1. **Task 1 RED: Specify profiles and synchronous controls** — `2267f8d` (`test`)
2. **Task 1 GREEN: Implement frozen profiles and controls** — `89828c5` (`feat`)
3. **Task 2 RED: Specify failures and attempt histories** — `dea33a1` (`test`)
4. **Task 2 GREEN: Implement deterministic failures and histories** — `41149f3` (`feat`)

## Files Created/Modified

- `packages/concierge/test/fixtures/stub-transport.ts` — reusable frozen Transport fixture with profiles, controls, failures, histories, and counts.
- `packages/concierge/test/stub-transport.test.ts` — U01-U08 runtime contract and package-boundary proof.
- `packages/concierge/test-d/stub-transport.test-d.ts` — strict compiler inclusion and exact six-key Transport conformance gate.

## Decisions Made

- Kept all test authority on the outer harness; the object supplied to production has only `capabilities`, `status`, `setTools`, `onStatusChange`, `onToolBatch`, and `respond`.
- Used monotonic subscription tokens instead of callback identity so the same callback may be registered more than once without a stale unsubscriber removing a newer registration.
- Preserved catalog references rather than cloning them because later reconnect tests need reference-identity evidence; only returned history containers and response rows are frozen snapshots.
- Copied and froze failure options when constructing the fixture, making occurrence decisions independent of later caller mutation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Task 2's U08 package-boundary precondition was already green during RED because Task 1 correctly placed the fixture under `test/`; the RED suite still failed only on the three unimplemented failure/history behaviors.

## TDD Gate Compliance

- Task 1 RED failed on the missing runtime and type-level fixture imports; GREEN passed U01-U04 and package typecheck.
- Task 2 RED kept U01-U04 green and failed U05-U07 on missing occurrence failures, subscription faults, and attempt histories; GREEN passed all U01-U08.
- Git history contains each `test(07-02)` commit before its corresponding `feat(07-02)` commit.

## Verification

- `pnpm exec vitest run packages/concierge/test/stub-transport.test.ts` — passed 8/8 U-cases.
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — passed with the fixture transitively included through `stub-transport.test-d.ts`.
- `pnpm build && pnpm typecheck && pnpm test` — passed with 13 files and 260 tests.
- Production-boundary scans found no fixture import/export under `src/` or `packages/concierge/package.json`.
- No timer, network, WebRTC, platform DOM, vendor, or mocking primitive appears in the fixture implementation.
- The plan diff contains exactly the three declared test files; root/package manifests and `pnpm-lock.yaml` are unchanged.

## Known Stubs

None. The empty history arrays are intentional live fixture state before attempts occur, and all required controls and observations are wired.

## Threat Model Evidence

- **T-07-02:** Every `setTools` and `respond` attempt is recorded before a configured failure; histories and rows are immutable snapshots.
- **T-07-05:** All six injected paths throw fixed fixture-authored text without batch, result, identifier, or caught-value detail.
- **T-07-06:** The controls remain outside the six-key Transport, and static gates keep the fixture out of production source and package configuration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 07-03 through 07-05 can reuse one deterministic Transport fixture for catalog, routing, lifecycle, and hostile-callback proofs.
- Phase 8 can reuse the exact same fixture for the literal consent-kernel portion of TRN-02 without exposing it as package API.
- No blockers remain.

## Self-Check: PASSED

All three implementation/test files and this summary exist, task commits `2267f8d`, `89828c5`, `dea33a1`, and `41149f3` are present in git history, the plan diff is exactly scoped, and manifests plus `pnpm-lock.yaml` remain unchanged.

---
*Phase: 07-session-and-the-transport-seam*
*Completed: 2026-08-08*
