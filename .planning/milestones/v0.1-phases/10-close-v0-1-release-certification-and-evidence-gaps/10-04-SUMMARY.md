---
phase: 10-close-v0-1-release-certification-and-evidence-gaps
plan: 04
subsystem: hosted-certification
tags: [github-actions, build-order, astro, exact-sha, receipt, oidc-isolation]
requires:
  - phase: 10-close-v0-1-release-certification-and-evidence-gaps
    plan: 03
    provides: committed untracked Astro state and clean-clone regeneration entry point
provides:
  - clean-checkout install/build/typecheck/test/release ordering for CI and release verification
  - successful exact-HEAD Astro regeneration proof with zero tracked or sealed generated paths
  - read-only run-scoped candidate certification receipt job
  - no-repository-write exact-SHA push/run/attempt/receipt certification CLI
  - discriminating workflow-order, receipt, OIDC, publication, and handoff controls
affects: [phase-10-mutation-evidence, phase-10-final-handoff, hosted-release-certification]
tech-stack:
  added: []
  patterns: [build-before-typecheck, attempt-scoped-external-receipt, supported-gaps-handoff, pre-post-sha-reassertion]
key-files:
  created:
    - scripts/phase-10-certify-candidate.mjs
    - .planning/phases/10-close-v0-1-release-certification-and-evidence-gaps/10-04-SUMMARY.md
  modified:
    - .github/workflows/ci.yml
    - .github/workflows/release.yml
    - scripts/phase-09-workflow-check.mjs
    - scripts/phase-09-mutation-battery.mjs
key-decisions:
  - Build core, React, and Svelte prerequisites without touching the Astro harness before the pinned Astro check/build regeneration proof.
  - Emit certification truth as an attempt-scoped Actions artifact instead of a tracked post-run receipt.
  - Permit exact-SHA push or workflow-dispatch runs while rejecting ambiguous selection and binding one explicit run attempt through the API.
requirements-completed: [ADP-01, ADP-02, ADP-03, ADP-04, PKG-04]
metrics:
  duration: 24m
  completed: 2026-08-12
---

# Phase 10 Plan 04: Hosted Verification and Exact-SHA Receipt Summary

Clean Ubuntu verification now builds before aggregate typechecking, the committed Astro harness regenerates from no generated state, and one exact clean candidate can later be pushed and certified against a run/attempt-scoped external receipt without a successor commit.

## Performance

- **Started:** 2026-08-12T17:43:00Z
- **Completed:** 2026-08-12T18:06:56Z
- **Duration:** 24 minutes
- **Tasks:** 2
- **Files changed:** 5

## Accomplishments

- Reordered CI and release verification to frozen install → build → aggregate typecheck → test, with CI invoking the complete `check:phase09:release` chain.
- Added separate full-command wrong-order fixtures for CI and release, so command presence cannot mask the original hosted dependency-order defect.
- Ran the first honest committed-snapshot Astro proof, found and repaired its missing built-declaration prerequisite, and proved pinned package-local `check` then `build` regenerates local state with zero tracked or sealed paths.
- Added `workflow_dispatch` and a final read-only `candidate-certification` job depending on build and Node-floor success.
- Added an attempt-scoped JSON receipt containing exact repository, workflow name/path, ref, SHA, run ID, attempt, `overall_conclusion`, required job conclusions, and digests of the verifier, audit, validation, and certification runbook.
- Added dependency-free `self-test`, `handoff-check`, `certify`, and `verify-run` modes with explicit push, remote equality, exact run-attempt API validation, unique artifact download, evidence rehashing, temporary cleanup, and pre/post HEAD/status assertions.
- Expanded static policy to reject CI OIDC, publication, secrets, tagging/provenance inspection, omitted or false overall conclusions, and checkout or dependency authority in the release publish job.

## Task Commits

1. **Task 10-04-01: Prove committed Astro regeneration and make hosted verification build first** — `ee517fe` (fix)
2. **Task 10-04-02: Emit and verify an exact-SHA run-scoped certification receipt** — `e6ea393` (test), `3f398b6` (feat)

## Files Created or Modified

- `.github/workflows/ci.yml` — runs the complete build-first candidate chain and emits the exact run-scoped receipt under read-only authority.
- `.github/workflows/release.yml` — splits the nonpublishing verify chain into the required build-first sequence while retaining publish-only OIDC isolation.
- `scripts/phase-09-workflow-check.mjs` — pins eight workflow jobs, build order, receipt schema/identity, permissions, no-publication policy, and 22 discriminating controls.
- `scripts/phase-09-mutation-battery.mjs` — builds only the three declaration-producing prerequisites before the pinned Astro check/build proof and pins that order in self-test control 37.
- `scripts/phase-10-certify-candidate.mjs` — validates the supported final handoff and performs or re-verifies one exact-SHA hosted certification without changing worktree or HEAD.

## Decisions Made

- Built core, React, and Svelte explicitly before the Astro harness check rather than running the root build, preserving the required observable Astro `check → build` regeneration order.
- Let the final receipt job run for the ordinary push that creates the candidate, while retaining manual dispatch and complete-run rerun fallbacks; this avoids depending on a new dispatch trigger already existing on the default branch.
- Used snake-case receipt fields, including exact `overall_conclusion`, and a canonical content digest over the receipt body.
- Required the configured push remote to resolve to the same GitHub repository used for run APIs before any certification push.
- Kept the tracked verifier and audit truthfully at supported `gaps_found`; the external receipt is the post-GSD fact and never becomes a tracked run-ID commit.

## Deviations from Plan

### Auto-fixed Issues

**1. Clean Astro check required built workspace declarations**

- **Found during:** Task 10-04-01's first committed-snapshot proof.
- **Issue:** Frozen install correctly left `.astro` absent, but `astro check` could not resolve unbuilt core/React/Svelte declaration exports.
- **Fix:** Added an exact ordered prerequisite build of the three public packages, reasserted `.astro` remained absent, then ran the planned Astro check/build pair.
- **Files modified:** `scripts/phase-09-mutation-battery.mjs`.
- **Verification:** Current committed HEAD reports `check=passed build=passed tracked=0 sealed=0`.

---

**Total deviations:** 1 auto-fixed blocking correctness issue.
**Impact:** The correction supplies the missing clean-checkout dependency without making generated Astro bytes authoritative or weakening the planned proof.

## Issues Encountered

- The first exact committed-snapshot proof failed usefully on unresolved workspace declarations; the deviation above records the complete repair.
- A shell verification probe initially used zsh's read-only `status` parameter name. It was immediately rerun with a task-specific variable and did not affect repository files.

## Verification

- Exact current-HEAD Astro regeneration: passed at `3f398b6615331076e65f0322d3a84f9db76d8329`, with check/build passed and tracked/sealed counts zero.
- Certification CLI self-test: 29 controls passed.
- Workflow checker: 2 workflows, 8 jobs, 22 controls, 22 CI steps, and 42 release steps passed.
- Mutation harness self-test: 37 controls passed.
- Package checker self-test: 17 controls passed.
- Contract checker final: 0 missing IDs across 56 required nonempty artifacts.
- CI/release command-index probe: build precedes typecheck in both files.
- Workflow YAML parse and embedded Node syntax: passed.
- Full diff checks: passed.
- Hosted `certify` mode and publication: intentionally not run; they remain reserved for the final clean post-GSD handoff.

## User Setup Required

None for local plan completion. Final external certification relies on the already configured GitHub remote and authenticated GitHub access, which `certify` revalidates before use.

## Next Phase Readiness

- Plan 10-05 can register the build-order, environment, generated-state, catalog, and terminal mutants against the now-correct workflow and receipt boundaries.
- The post-GSD handoff has executable exact-SHA machinery but cannot run until all seven summaries, both independent verification/audit records, and final registered bookkeeping are committed.

## Self-Check: PASSED

All three task commits resolve, all five claimed implementation files exist at their committed dispositions, the current-HEAD clean proof and all local/static controls pass, and the unrelated milestone-audit edit plus `.gitkeep` remain unstaged.
