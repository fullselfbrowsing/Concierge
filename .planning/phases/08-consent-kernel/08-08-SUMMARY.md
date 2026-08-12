---
phase: 08-consent-kernel
plan: 08
subsystem: security-documentation
tags: [consent, authorization, challenge, replay-protection, documentation-testing]
requires:
  - phase: 08-01
    provides: immutable client-side ConsentAck and inbound ServerChallenge contracts
  - phase: 04-catalog-assembly
    provides: exact-action catalog vocabulary used by the relying-server example
provides:
  - explicit warning that client consent evidence is untrusted and grants no server authority
  - server-issued challenge lifecycle with exact binding, freshness, single-use, and current-policy checks
  - section-scoped structural regression tests for authorization order and README ownership
affects: [08-verification, security-contract, integrator-guidance]
tech-stack:
  added: []
  patterns:
    - public security prose is protected by named-section semantic assertions
    - current-policy authorization immediately precedes the guarded effect
key-files:
  created:
    - packages/concierge/test/readme-security.test.ts
  modified:
    - README.md
key-decisions: []
patterns-established:
  - ConsentAck and all other client consent artifacts remain untrusted input at a relying-server boundary.
  - Server redemption orders authentication, stored-record checks, current-policy authorization, effect, burn, and commit inside one serialized operation.
requirements-completed: [SEC-04]
duration: 17m
completed: 2026-08-10
---

# Phase 8 Plan 8: Server Consent Boundary Summary

**A mechanically guarded root README contract now separates client consent from server authority and demonstrates replay-safe, exact-action reauthorization immediately before a protected effect.**

## Performance

- **Duration:** 17m
- **Started:** 2026-08-10T09:43:40Z
- **Completed:** 2026-08-10T10:00:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Named every client-originated consent artifact—including grades, receipts, attestations, callbacks, and `ConsentAck`—as untrusted evidence that neither authenticates nor authorizes.
- Documented a server-issued, server-stored high-entropy challenge bound to the authenticated principal/session, exact action, canonical payload digest, expiry, and unused state.
- Made current-policy authorization of the authenticated principal for the exact action immediately adjacent to the guarded effect, followed by challenge burn and atomic commit.
- Added dependency-free, root-section-scoped tests that reject missing security claims, package-README duplication, lifecycle reordering, and removed, bypassed, or substituted reauthorization.

## Task Commits

Each task used a discriminating RED/GREEN sequence:

1. **Task 1 RED: Pin the client-consent trust boundary** - `331bc14` (test)
2. **Task 1 GREEN: State the client-consent trust boundary** - `2e78a96` (feat)
3. **Task 2 RED: Pin the ordered server challenge lifecycle** - `215a348` (test)
4. **Task 2 GREEN: Document the server challenge lifecycle** - `6474e80` (feat)

## Files Created/Modified

- `README.md` - Defines the consent-versus-authorization boundary and an illustrative server challenge issuance/redemption pattern.
- `packages/concierge/test/readme-security.test.ts` - Reads only the root security section and structurally enforces every security claim and lifecycle transition.

## Decisions Made

None - execution followed the locked D-08-23 trust-boundary and server-verification lifecycle.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- Task 1 RED failed only because the named root security section did not yet exist; its GREEN commit made the trust-boundary assertion pass.
- Task 2 RED preserved Task 1 green while two lifecycle tests failed only on the missing server example; its GREEN commit made all three tests pass.
- Both RED commits precede their corresponding GREEN commits.

## Verification

- `pnpm --filter @fullselfbrowsing/concierge build` passed with attw and publint clean.
- `pnpm exec vitest run packages/concierge/test/readme-security.test.ts` passed: 1 file, 3 tests.
- `pnpm --filter @fullselfbrowsing/concierge typecheck` passed.
- Manual Markdown inspection confirmed the warning appears before the example and the ordered lifecycle is readable.
- `packages/concierge/README.md`, package manifests, lockfile, and production source remained unchanged.

## Known Stubs

None. The pseudocode is intentionally labeled illustrative and non-production-complete because this plan documents the relying-server contract without adding server implementation to the client package.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SEC-04 is ready for the Phase 8 security and mutation verifier.
- Runtime consent plans can rely on an explicit public boundary that never elevates client evidence to server authorization.
- No blockers remain.

## Self-Check: PASSED

- Root README, structural test, and summary all exist.
- All four RED/GREEN task commits exist in repository history.

---
*Phase: 08-consent-kernel*
*Completed: 2026-08-10*
