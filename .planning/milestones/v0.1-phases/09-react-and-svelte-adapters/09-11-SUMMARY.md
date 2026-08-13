---
phase: 09-react-and-svelte-adapters
plan: 11
subsystem: ci
tags: [vitest, github-actions, release, provenance, adapters, archives]

# Dependency graph
requires:
  - phase: 09-react-and-svelte-adapters
    provides: Live adapter lifecycle, artifact SSR, package, budget, and mutation infrastructure from Plans 09-08, 09-09, and 09-12
  - phase: 02-packaging-build-and-release
    provides: Inherited core CI, Node-floor, and OIDC trusted-publishing workflow
provides:
  - Exact positive-count five-file Phase 09 Vitest gate
  - Additive blocking CI and release gates that preserve inherited proof
  - Digest-manifest-resolved archive upload with no post-verification repack
  - Dependency-free static workflow invariant checker with negative controls
affects: [09-13, phase-09-release, ci, trusted-publishing]

# Tech tracking
tech-stack:
  added: []
  patterns: [exact test-result set equality, additive blocking workflow gates, manifest-resolved archive upload, structured dependency-free workflow checks]

key-files:
  created:
    - scripts/phase-09-test-check.mjs
    - scripts/phase-09-workflow-check.mjs
  modified:
    - package.json
    - .github/workflows/ci.yml
    - .github/workflows/release.yml

key-decisions:
  - "Spawn the local Vitest executable directly so the strict JSON result parser receives no package-manager workspace prelude."
  - "Resolve release upload paths from the package-check digest manifest and rehash every archive before upload."
  - "Enforce workflow actions, commands, and ordering through dependency-free structured parsing backed by six negative controls."

patterns-established:
  - "Exact suite ownership: a single runner validates the requested project set and exact normalized five-file result set with positive suite and test counts."
  - "Verify once, ship once: release archives are exported during the complete gate, resolved from its digest manifest, and uploaded without repacking."
  - "Additive workflow proof: Phase-specific gates are inserted without weakening inherited checks, permissions, runtime floors, or trusted publishing."

requirements-completed: [ADP-01, ADP-02, ADP-03, ADP-04, PKG-04]

# Metrics
duration: 24min
completed: 2026-08-11
---

# Phase 09 Plan 11: Adapter CI and Release Gates Summary

**Exact positive-count adapter tests and statically enforced CI/release gates now verify, hash, and upload the same three publishable archives without repacking.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-11T05:38:00Z
- **Completed:** 2026-08-11T06:01:41Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added one bounded Vitest orchestrator that owns exactly the five Phase 09 test files across the React lifecycle, Svelte lifecycle, and Node artifact SSR projects, rejects malformed or incomplete JSON results, and requires positive suite and test counts.
- Added the complete root Phase 09 command graph while preserving all inherited scripts and requiring package, budget, static contract, and evidence verification in the aggregate gate.
- Made Phase 09 verification blocking in CI and release, then resolved and rehashed the exact core, React, and Svelte archives from the checked digest manifest before an explicit four-file artifact upload.
- Added a dependency-free workflow invariant checker covering action pins, gate order, Node floor, OIDC permissions, exact archive upload, failure propagation, and six mutation-style negative controls.

## Task Commits

Each TDD task was committed with separate RED and GREEN gates:

1. **Task 09-11-01: Add exact positive-count Phase 09 test and gate commands**
   - `841b70f` — RED: failing Phase 09 test orchestrator contract
   - `9300e43` — GREEN: exact positive-count Phase 09 test gate
2. **Task 09-11-02: Make inherited and Phase 09 CI/release gates blocking and statically provable**
   - `4a5a342` — RED: failing workflow invariant contract
   - `e406970` — GREEN: blocking Phase 09 CI and release gates

## Files Created/Modified

- `scripts/phase-09-test-check.mjs` — Runs the exact three Vitest projects and proves exact five-file ownership plus positive result counts.
- `scripts/phase-09-workflow-check.mjs` — Statically validates CI/release invariants and proves the checker with six internal negative controls.
- `package.json` — Declares the focused Phase 09 test, package, budget, static, evidence, aggregate, and release gates without changing inherited commands.
- `.github/workflows/ci.yml` — Adds the blocking complete Phase 09 gate after inherited CI checks.
- `.github/workflows/release.yml` — Adds inherited package checks, complete Phase 09 release verification, digest-manifest archive resolution, and exact archive upload before publication.

## Decisions Made

- Invoked the repository-local Vitest executable directly because `pnpm exec` emits a workspace-selection prelude on stdout, which conflicts with strict JSON-only result parsing.
- Treated the digest manifest as the release archive authority: the resolver requires exact package identities, canonical regular files, matching SHA-256 digests, and exactly three archives plus the manifest.
- Parsed workflow step structure with Node built-ins rather than adding a YAML dependency, keeping the checker deterministic and usable before dependency changes while still proving ordering and failure-propagation invariants.

## Verification

- `node scripts/phase-09-test-check.mjs` reported `PHASE09_TEST_CHECK_OK projects=3 files=5 suites=10 tests=11`.
- `node scripts/phase-09-workflow-check.mjs` reported `PHASE09_WORKFLOW_CHECK_OK workflows=2 controls=6 ciSteps=19 releaseSteps=15`.
- The plan's package-script and workflow static assertions both exited successfully.
- Terminal aggregate, evidence, mutation-all, package-all, and final contract commands were intentionally not run; Plan 09-13 owns terminal evidence creation.

## TDD Gate Compliance

- Task 09-11-01 has a failing `test(09-11)` commit followed by its passing `feat(09-11)` commit.
- Task 09-11-02 has a failing `test(09-11)` commit followed by its passing `feat(09-11)` commit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `pnpm exec vitest` prepended workspace-selection text to stdout. The implementation switched to the existing local Vitest executable so the bounded child process emits only the JSON reporter result.
- The Conductor checkout uses a `.git` indirection file while worktree automation is disabled. Execution followed the orchestrator's explicit instruction to commit sequentially on the current branch without creating, switching, or rewriting refs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-13 can run the terminal aggregate and release evidence flow against the complete, statically proven gate graph.
- The mutation, release, and security evidence endpoints remain intentionally absent until that terminal evidence plan runs.
- No blockers remain for terminal Phase 09 verification.

## Self-Check: PASSED

- All five implementation files and this summary exist.
- All four RED/GREEN task commits are present in repository history.

---
*Phase: 09-react-and-svelte-adapters*
*Completed: 2026-08-11*
