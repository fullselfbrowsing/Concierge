---
phase: 07-session-and-the-transport-seam
plan: 01
subsystem: api
tags: [typescript, transport, session, diagnostics, type-tests]

requires:
  - phase: 01-type-surface-completion
    provides: Structural Transport and Session contracts plus exact type-test conventions
  - phase: 06-dispatcher
    provides: Stable batch envelope and result contracts consumed by the Session seam
provides:
  - Closed four-state neutral Transport lifecycle with a required readonly status and subscription
  - Promise-returning four-member Session handle contract
  - Exact-optional SessionConfig initial context and diagnostic hook
  - Closed immutable two-field Session diagnostics with nine operational codes
affects: [07-02-stub-transport, 07-03-session-runtime, 08-consent-kernel]

tech-stack:
  added: []
  patterns:
    - Exact public key and callback contracts use one-line Expect/Equals predicates
    - Computed optional construction sites prove exactOptionalPropertyTypes write compatibility

key-files:
  created:
    - packages/concierge/test-d/session.test-d.ts
  modified:
    - packages/concierge/src/types.ts
    - packages/concierge/test-d/transport.test-d.ts
    - packages/concierge/test-d/actions.test-d.ts

key-decisions:
  - "Transport lifecycle stays vendor-neutral through one closed four-state union and a required status subscription."
  - "Session diagnostics expose only immutable code and message fields; optional config inputs explicitly admit undefined."

patterns-established:
  - "Transport lifecycle pins: two unrelated structural fixtures plus exact union, callback, key-set, and readonly predicates."
  - "Session contract pins: semantic RED gates for Promise stop and EOPT writes, followed by exact diagnostic negatives."

requirements-completed: [SES-01, SES-03, SES-04, TRN-02]

duration: 9m 20s
completed: 2026-08-08
---

# Phase 7 Plan 1: Session and Transport Contracts Summary

**A neutral six-member Transport lifecycle, awaitable four-member Session, EOPT-safe configuration, and closed immutable diagnostics now define the seam that later runtime plans implement.**

## Performance

- **Duration:** 9m 20s
- **Started:** 2026-08-08T21:41:22Z
- **Completed:** 2026-08-08T21:50:42Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added the exact `idle | connecting | connected | closed` lifecycle and required readonly `Transport.status`/`onStatusChange` members without introducing vendor event vocabulary.
- Changed `Session.stop` to `Promise<void>` while preserving the exact four-key handle and adapting the existing structural fixture.
- Added computed-optional-safe `SessionConfig.initialContext` and `onDiagnostic` properties.
- Defined a nine-code `SessionDiagnosticCode` union and an immutable `{ code, message }` diagnostic surface with negative type tests for arbitrary codes, mutation, and extra detail.

## Task Commits

Each TDD task was committed as a RED/GREEN pair:

1. **Task 1 RED: Pin the neutral Transport lifecycle** — `21dde5e` (`test`)
2. **Task 1 GREEN: Implement the neutral Transport lifecycle** — `bfd4fee` (`feat`)
3. **Task 2 RED: Pin awaitable Session and safe diagnostics** — `bdb6edb` (`test`)
4. **Task 2 GREEN: Implement awaitable Session and safe diagnostics** — `31c24a6` (`feat`)

## Files Created/Modified

- `packages/concierge/src/types.ts` — exports Transport lifecycle, Promise stop, EOPT config, and diagnostic contracts.
- `packages/concierge/test-d/transport.test-d.ts` — implements two unrelated six-member transports and pins lifecycle union, callback, keys, and readonly status.
- `packages/concierge/test-d/session.test-d.ts` — pins Session, SessionConfig, and diagnostics with computed optional positives and discriminating negatives.
- `packages/concierge/test-d/actions.test-d.ts` — updates the existing Session fixture to return a resolved stop Promise.

## Decisions Made

- Kept connection state in a closed vendor-neutral union and modeled replay eligibility through status transitions rather than adding a vendor-shaped reconnect member.
- Kept runtime diagnostics deliberately narrow: nine closed codes and two readonly fields, with no caught value, context, arguments, result, identifier, or metadata channel.
- Used construction positives—not read-shaped equality alone—to protect explicit `| undefined` writes under `exactOptionalPropertyTypes`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## TDD Gate Compliance

- Task 1 RED failed only on missing `status`/`onStatusChange`, the six-key predicate, and readonly lifecycle pins; GREEN passed package typecheck and the scoped lifecycle mutant gate.
- Task 2 RED failed only on Promise stop, absent diagnostics, and exact-optional writes; GREEN passed all Session/config/diagnostic predicates and negative directives.
- Git history contains each `test(07-01)` commit before its corresponding `feat(07-01)` commit.

## Verification

- `pnpm --filter @fullselfbrowsing/concierge typecheck` — passed after each GREEN implementation.
- Scoped non-comment Transport lifecycle gate — passed on the final block and detected its in-memory `onReconnect` mutant.
- `pnpm build && pnpm typecheck && pnpm test` — passed with 12 files and 252 tests.
- Plan diff contains exactly the four declared files; root/package manifests and `pnpm-lock.yaml` retained their baseline SHA-1 values.
- No dependency, DOM type, cast, runtime export, package manifest, or lockfile change was introduced.

## Known Stubs

None. No placeholder or unwired production behavior was introduced; this plan intentionally defines pre-runtime public contracts for Plan 07-03.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 07-02 can implement the reusable no-I/O stub against the exact six-member Transport contract.
- Plan 07-03 can implement the hot Session runtime against one fixed Promise-stop and diagnostic interface.
- No blockers remain.

## Self-Check: PASSED

All four plan files and this summary exist, and task commits `21dde5e`, `bfd4fee`, `bdb6edb`, and `31c24a6` are present in git history.

---
*Phase: 07-session-and-the-transport-seam*
*Completed: 2026-08-08*
