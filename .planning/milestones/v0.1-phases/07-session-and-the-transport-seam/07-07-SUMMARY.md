---
phase: 07-session-and-the-transport-seam
plan: 07
subsystem: runtime-testing-security
tags: [session, reentrancy, mutation-testing, immutable-release, security-handoff]

requires:
  - phase: 07-session-and-the-transport-seam
    provides: Plans 07-01 through 07-06 supplied the Session/Transport seam, exact lifecycle/routing suites, mutation harness, and verifier-discovered accessor-reentry counterexample
provides:
  - Token-owned cleanup for a publication superseded during a hostile setTools accessor read or throw
  - C17 built-artifact proof that the winning context C retains authority and a later batch dispatches and responds exactly once
  - Compiled C17-only M-07-C10 discrimination and 31-row immutable mutation evidence
  - Seven-command immutable release evidence with 16 files and 323/323 tests
  - Re-signed SES-01/SES-02 ledgers and an explicit T-07-01/T-07-02 independent security re-audit gate
affects: [phase-07-security-re-audit, phase-verification, 08-consent-kernel]

tech-stack:
  added: []
  patterns:
    - Clear an abandoned publication only while its exact publication token remains current
    - Treat accessor return and throw as symmetric reentrant authority boundaries
    - Invalidate prior security closure when a later verifier exposes a threat-relevant ordering

key-files:
  created: []
  modified:
    - packages/concierge/src/session.ts
    - packages/concierge/test/session-catalog.test.ts
    - scripts/phase-07-mutation-battery.mjs
    - .planning/phases/07-session-and-the-transport-seam/07-MUTATION-REGISTER.json
    - .planning/phases/07-session-and-the-transport-seam/07-MUTATION-EVIDENCE.json
    - .planning/phases/07-session-and-the-transport-seam/07-VALIDATION.md
    - .planning/phases/07-session-and-the-transport-seam/07-SECURITY.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "An accessor-superseded publication aborts and clears only when its attempt token is still current, so stale cleanup cannot erase a newer publication."
  - "A setTools getter that queues a newer context and then throws is an abandoned attempt, not a publication failure; the same cleanup helper handles returned and thrown accessors."
  - "Technical gap closure does not self-renew an earlier security audit: T-07-01/T-07-02 remain open until an independent Phase 7 security re-audit reviews C17/M-07-C10."
  - "TRN-02 remains unchecked and Partial until Phase 8 reuses the exact no-network fixture against the consent kernel."

patterns-established:
  - "Publication-token ownership: abort/clear a superseded provisional epoch only when the abandoned attempt still owns publication state."
  - "Composed regression proof: catalog authority repair must be observed through a later exact-context dispatch and one response attempt."
  - "Gap-closure evidence: rerun every revision-bound mutant and immutable release gate before re-signing requirements or handing security back for audit."

requirements-completed: [SES-01, SES-02]

duration: 42m 45s
completed: 2026-08-09
---

# Phase 7 Plan 7: Abandoned Publication Gap Closure Summary

**Token-owned abandoned-publication cleanup with C17/M-07-C10 proof restores latest-context routing, 31/31 mutation coverage, and a fail-closed security re-audit boundary.**

## Performance

- **Duration:** 42m 45s
- **Started:** 2026-08-09T04:07:34Z
- **Completed:** 2026-08-09T04:50:19Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Repaired the reentrant `setTools` accessor ordering so a superseded unpublished B attempt aborts and clears its own provisional epoch/token before context C reconciles against the already-published A catalog.
- Added C17 plus an adjacent thrown-getter regression: returned stale functions are never invoked, getter throws after supersession remain inert, final stage/context authority is C, and one later batch dispatches/responds exactly once.
- Added exact compiled M-07-C10 coverage, regenerated all ten bounded shards, and certified 31/31 green rows at 10 catalog / 9 routing / 8 lifecycle / 2 diagnostics / 2 package-guard.
- Recorded immutable release digest `4efea16561defaf73e924b5dd855df2619af2186c58c00f92eab5855751c3252` with seven zero exits, 16 runtime files, and 323/323 tests.
- Re-signed SES-01/SES-02 while preserving the exact unchecked/Partial TRN-02 handoff, and changed security to `re_audit_required` with only T-07-01/T-07-02 open.

## Task Commits

Task work was committed atomically, with Task 2 intentionally split between its clean pending baseline and executed evidence:

1. **Task 1: Clear accessor-abandoned publication and add return/throw regressions** — `4478f62` (`fix`)
2. **Task 2 baseline: Register the C17-only cleanup mutant and 31-row schema** — `f567c72` (`test`)
3. **Task 2 evidence: Execute and record all 31 exact mutation kills** — `e396d2d` (`test`)
4. **Task 3: Record immutable release facts and security re-audit handoff** — `2860945` (`docs`)

## Files Created/Modified

- `packages/concierge/src/session.ts` — Adds token-owned `abandonSupersededPublication` handling before invocation, after accessor return, and from the accessor catch path.
- `packages/concierge/test/session-catalog.test.ts` — Adds C17's accessor→C→published-A routing proof and the strengthened accessor-throws-after-supersession regression.
- `scripts/phase-07-mutation-battery.mjs` — Adds M-07-C10, 31-row/10-catalog schemas, C17 markers, 17 task IDs, current ledger invariants, and stale-state negative controls.
- `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-REGISTER.json` — Records the ordered C01-C10 register and digest `a55444ba593e9d4f80dfb3664267d015dbb5740a8c6fe1c2f08ccf0585945492`.
- `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-EVIDENCE.json` — Records 31 green revision-bound rows, unchanged protected hashes, and the immutable 323-test release result.
- `.planning/phases/07-session-and-the-transport-seam/07-VALIDATION.md` — Records 17 green task rows, C01-C17/M-07-C01..C10, 31/31, current release facts, and approved technical ledgers.
- `.planning/phases/07-session-and-the-transport-seam/07-SECURITY.md` — Reopens only T-07-01/T-07-02 and identifies the evidence required by the mandatory independent audit.
- `.planning/REQUIREMENTS.md` — Re-signs only SES-01/SES-02 and leaves TRN-02's exact Phase 8 Partial boundary unchanged.

## Decisions Made

- Cleanup authority belongs to the still-current publication attempt token, not merely the superseded context record. This prevents an obsolete callback from clearing publication state installed by a newer attempt.
- An accessor that first queues a winning context and then throws has already lost authority. Its exception cannot convert ordinary supersession into a fatal publication failure or leave the abandoned attempt pending.
- C17 must observe routing after reconciliation, not only final stage/catalog state: the formerly disconnected flow is closed only when the later call reaches `dispatchBatch` under the exact C object and produces one response attempt.
- Generated technical evidence may re-sign SES-01/SES-02, but it cannot self-certify an independent security audit authored before the new ordering was known.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Covered a superseding accessor that throws after enqueuing C**

- **Found during:** Task 1 (accessor-abandoned publication repair)
- **Issue:** The planned C17 path returned a stale callable, but the same reentrant getter could enqueue C and then throw; treating that catch as a publication failure or returning without cleanup could preserve obsolete authority.
- **Fix:** Applied `abandonSupersededPublication` from the catch path as well as after accessor return, and added an adjacent unnumbered regression that proves the thrown value is inert after supersession.
- **Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`
- **Verification:** Both focused accessor regressions passed; the restored catalog suite passed 22/22 and the full runtime suite passed 323/323.
- **Committed in:** `4478f62`

**2. [Rule 3 - Blocking] Split Task 2 at the clean-revision mutation boundary**

- **Found during:** Task 2 before the first C01-C03 shard
- **Issue:** The mutation runner correctly refuses a dirty scoped revision, and its own modified harness is a scoped input, so no mutant could execute until the new definitions and pending artifacts were part of HEAD.
- **Fix:** Committed the coherent 31-row pending baseline first, then executed all ten shards and committed only the generated green evidence.
- **Files modified:** `scripts/phase-07-mutation-battery.mjs`, `07-MUTATION-REGISTER.json`, `07-MUTATION-EVIDENCE.json`
- **Verification:** Every group verifier passed and aggregate evidence is 31/31 with 31 unique revision digests.
- **Committed in:** `f567c72`, `e396d2d`

**3. [Rule 1 - Bug] Made the SES-02 mutation citation literal rather than shorthand**

- **Found during:** Task 3 exact shape verification
- **Issue:** The first trace-row wording grouped the new mutant as `/C10`, which was readable but failed the required literal `M-07-C10` citation gate.
- **Fix:** Named `M-07-C10` explicitly in SES-02 and reran the fresh immutable-snapshot ledger verifier.
- **Files modified:** `.planning/REQUIREMENTS.md`
- **Verification:** The exact plan grep, `verify ledgers`, `verify all`, and `verify inputs` all passed.
- **Committed in:** `2860945`

**4. [Rule 3 - Blocking] Centralized commits through the authorized Conductor branch**

- **Found during:** Every delegated task boundary
- **Issue:** The GSD temporary-worktree guard rejects Conductor's linked branch because it is not named `worktree-agent-*`.
- **Fix:** Preserved each verified diff unstaged; the orchestrator independently reverified and committed it without switching branches, bypassing checks, or mutating worktrees.
- **Files modified:** No additional project files
- **Verification:** Commits `4478f62`, `f567c72`, `e396d2d`, and `2860945` exist on the current branch and HEAD was clean before summary creation.

---

**Total deviations:** 4 auto-fixed (1 missing critical regression, 1 ledger citation bug, 2 execution blockers)
**Impact on plan:** The changes strengthened reentrant correctness, exact evidence attribution, and revision integrity without changing public contracts, dependencies, protected inputs, or unrelated requirements/security dispositions.

## Issues Encountered

- The first Task 3 `verify ledgers` run intentionally materialized release evidence and then failed closed on the stale missing `07-07-01` row. After human ledgers were updated, two fresh immutable-snapshot runs passed.
- No authentication, package installation, network, vendor SDK, timer, manifest, lockfile, or public API issue occurred.

## Known Stubs

None. Empty arrays/nulls found by the required scan are live Session state, test observation buffers, or generated evidence fields; none flows to a placeholder UI or leaves the plan goal unwired.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The verifier-discovered Session gap is technically closed with exact runtime, mutation, input, and immutable-release proof.
- Phase 7 must not be marked verified or advanced yet: `$gsd-secure-phase 7` must independently review T-07-01/T-07-02 and restore `status: secured` with `threats_open: 0` on the current C17/M-07-C10 evidence.
- After that audit, Phase 7 re-verification can run; TRN-02 remains unchecked/Partial for Phase 8's consent-kernel exercise.

## Self-Check: PASSED

- All eight task-modified files and this summary exist.
- Commits `4478f62`, `f567c72`, `e396d2d`, and `2860945` exist on the current branch.
- Register/evidence agree at `a55444ba593e9d4f80dfb3664267d015dbb5740a8c6fe1c2f08ccf0585945492`; all 31 rows are green.
- Immutable release evidence remains `4efea16561defaf73e924b5dd855df2619af2186c58c00f92eab5855751c3252` with seven zero exits and 323/323 tests.
- SECURITY remains `re_audit_required` with two open threats, and the thrown-getter strengthening is documented.

---
*Phase: 07-session-and-the-transport-seam*
*Completed: 2026-08-09*
