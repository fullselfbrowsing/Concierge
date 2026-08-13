---
phase: 09-react-and-svelte-adapters
plan: 12
subsystem: testing
tags: [mutation-testing, react, svelte, astro, immutable-snapshots, evidence]

# Dependency graph
requires:
  - phase: 09-react-and-svelte-adapters
    provides: React/Svelte lifecycle seams, Astro SSR proof, exact package checks, and adapter budget gate from Plans 09-08 and 09-09
  - phase: 08-consent-kernel
    provides: Immutable mutation architecture and five inherited evidence records
provides:
  - Exact seven-mutant R1/R2/S1/SSR1/B1/P1/C1 register
  - Disposable compile-first mutation runner with semantic kill validation
  - Run-all-only terminal evidence generation and read-only drift verification
affects: [09-13-terminal-evidence, phase-09-release, mutation-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [single immutable baseline, fresh copy-on-write mutant trees, positive-count semantic kill credit, sealed evidence digests]

key-files:
  created:
    - .planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json
    - scripts/phase-09-mutation-battery.mjs
  modified: []

key-decisions:
  - "Treat register commands as immutable declarations checked against hard-coded argv arrays; never execute register text through a shell."
  - "Prepare one frozen offline installed/built baseline, then clone and discard an independent tree for every mutant."
  - "Reconstruct Phase 8 from its evidence-producing revision and overlay exactly the five live records before the three prescribed disposable verifications."
  - "Count only active named Vitest assertions for mutation credit while separately requiring exactly one aggregate failed test."

patterns-established:
  - "Semantic kill pattern: successful compile plus nonzero detector plus positive file/test/assertion counts plus exact registered fingerprint."
  - "Evidence ordering pattern: only run all may transactionally install the four terminal outputs; self-test, preflight, and verify remain non-generating."

requirements-completed: [ADP-01, ADP-02, ADP-03, ADP-04, PKG-04]

# Metrics
duration: 34min
completed: 2026-08-11
---

# Phase 09 Plan 12: Immutable Adapter Mutation Battery Summary

**Seven compiled adapter defects with exact semantic killers, disposable copy-on-write execution, and revision-bound terminal evidence machinery**

## Performance

- **Duration:** 34 min
- **Started:** 2026-08-11T05:01:41Z
- **Completed:** 2026-08-11T05:35:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Registered exactly R1, R2, S1, SSR1, B1, P1, and C1 with one-occurrence compiling replacements and canonical T01/T02/T03/T04/T05/T07 mappings.
- Implemented a strict six-form CLI whose self-test rejects 15 failure controls and whose real R1 preflight proves one file, one active test, one assertion, restoration, and zero live-tree writes.
- Bound future terminal mutation/release evidence to exact source, tests, register, workflows, archives, and the five actual Phase 8 records without generating early Phase 09 evidence.

## Task Commits

Each task was committed atomically with explicit TDD gates:

1. **Task 09-12-01 RED: failing mutation register specification** - `3420636` (test)
2. **Task 09-12-01 GREEN: seven compiled adapter mutants** - `eeddae3` (feat)
3. **Task 09-12-02 RED: failing mutation runner contract** - `0efec29` (test)
4. **Task 09-12-02 GREEN: immutable mutation battery** - `b34508d` (feat)

## Files Created/Modified

- `.planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json` - Strict schema-versioned seven-mutant register with exact replacements, commands, fingerprints, counts, and requirement/threat/decision mappings.
- `scripts/phase-09-mutation-battery.mjs` - Snapshot preparation, bounded compilation and semantic killers, negative-control self-test, real preflight, terminal generation, inherited Phase 8 verification, and read-only drift checks.

## Decisions Made

- Register command strings are validated against fixed argv arrays and are never evaluated as dynamic shell code.
- A frozen offline install and green workspace build prepare one baseline; every mutant receives a fresh clone and the baseline/live inputs are rehashed after execution.
- Package-backed S1/C1 failures retain positive assertion proof through an external Node import hook that copies only the generated Vitest report before the package checker deletes its owned scratch root.
- Phase 8 verification finds the revision matching the live mutation evidence and its recorded input hashes, overlays the exact five live records, then runs only `verify all`, `verify inputs`, and `verify ledgers` in the disposable repository.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept synthetic stale-input verification independent of Git discovery**

- **Found during:** Task 09-12-02 self-test
- **Issue:** The synthetic manifest fixture correctly used a non-repository temporary directory, but the verifier attempted repository path discovery before checking its changed byte.
- **Fix:** Added a fixture-only path-discovery switch while retaining mandatory exact tracked-path discovery for every real baseline and live verifier.
- **Files modified:** `scripts/phase-09-mutation-battery.mjs`
- **Verification:** All 15 self-test controls pass, including `stale-input-digest`.
- **Committed in:** `b34508d`

**2. [Rule 1 - Bug] Excluded name-filtered skipped tests from exact mutation counts**

- **Found during:** Task 09-12-02 R1 preflight
- **Issue:** Vitest's aggregate total included the two lifecycle tests skipped by `--testNamePattern`, producing three collected tests even though exactly one named test executed and failed.
- **Fix:** Count active named assertions for test/assertion credit and independently require Vitest's aggregate failed-test count to equal one.
- **Files modified:** `scripts/phase-09-mutation-battery.mjs`
- **Verification:** R1 preflight reports `files=1 tests=1 assertions=1 restored=true liveTreeUnchanged=true`.
- **Committed in:** `b34508d`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes strengthened the planned fail-closed evidence semantics without expanding scope.

## Issues Encountered

The two data-shape mismatches discovered by self-test and preflight were corrected and are documented above. No unresolved issues remain.

## User Setup Required

None - no dependencies, credentials, or external service configuration were added.

## TDD Gate Compliance

- RED register gate: `3420636`
- GREEN register gate: `eeddae3`
- RED runner gate: `0efec29`
- GREEN runner gate: `b34508d`

## Next Phase Readiness

- The runner is ready for terminal `node scripts/phase-09-mutation-battery.mjs run all --jobs 4` after Plan 09-11 has supplied the final root scripts and workflows.
- `09-MUTATION-EVIDENCE.json`, `09-RELEASE-EVIDENCE.json`, and `09-SECURITY.md` remain absent, and the existing `09-VALIDATION.md` remains unchanged as required before Plan 09-13.
- All five inherited Phase 8 record hashes remain byte-identical.

## Self-Check: PASSED

- All two task artifacts and this summary exist.
- All four TDD task commits (`3420636`, `eeddae3`, `0efec29`, `b34508d`) exist in repository history.

---
*Phase: 09-react-and-svelte-adapters*
*Completed: 2026-08-11*
