---
phase: 09-react-and-svelte-adapters
fixed_at: 2026-08-11T10:54:00Z
review_path: .planning/phases/09-react-and-svelte-adapters/09-REVIEW-3.md
iteration: 3
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 09: Code Review Fix Report

**Fixed at:** 2026-08-11T10:54:00Z
**Source review:** `.planning/phases/09-react-and-svelte-adapters/09-REVIEW-3.md`
**Iteration:** 3

**Summary:**

- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Rerun attempts collide and are not part of release identity

**Status:** fixed: requires human verification
**Files modified:** `.github/workflows/release.yml`, `scripts/phase-09-version.mjs`, `scripts/phase-09-mutation-battery.mjs`, `scripts/phase-09-publish-archives.mjs`, `scripts/phase-09-workflow-check.mjs`, `scripts/phase-09-contract-check.mjs`, `RELEASING.md`, `CONTRIBUTING.md`
**Commit:** 5402534
**Applied fix:** Required a positive run attempt in version artifacts, apply-derived receipts, versioned evidence, seals, and publisher bindings. Every release artifact name now includes the attempt, and missing, mismatched, and cross-attempt identities fail closed. Documentation requires a full workflow rerun instead of a failed-jobs-only rerun.

### CR-02: Dependency-produced evidence is laundered through privileged apply

**Status:** fixed: requires human verification
**Files modified:** `.github/workflows/release.yml`, `scripts/phase-09-version.mjs`, `scripts/phase-09-mutation-battery.mjs`, `scripts/phase-09-workflow-check.mjs`, `scripts/phase-09-contract-check.mjs`, `RELEASING.md`, `CONTRIBUTING.md`
**Commit:** 5402534
**Applied fix:** Restricted the privileged artifact to exact manifest version transitions, deterministic bounded changelogs, optional exact peer-only lock normalization, and digest-matched changeset deletions. Apply now derives a tracked receipt and never transports generated ledgers. Versioned evidence requires a separate credential-free human finalization ceremony from the clean committed Version Packages PR head and must bind the tracked receipt exactly.

### CR-03: Tarball metadata can redirect npm OIDC and publication

**Status:** fixed: requires human verification
**Files modified:** `.github/workflows/release.yml`, `scripts/phase-09-publish-archives.mjs`, `scripts/phase-09-workflow-check.mjs`, `scripts/phase-09-contract-check.mjs`, `RELEASING.md`, `CONTRIBUTING.md`
**Commit:** 5402534
**Applied fix:** Pinned every npm query and publish to `https://registry.npmjs.org/` with publisher-owned empty user/global configs, rejected ambient registry/auth/token/config overrides case-insensitively, and required exact public `publishConfig` plus repository metadata before any registry client call.

### WR-01: Resume trusts provenance-shaped metadata without source identity

**Status:** fixed: requires human verification
**Files modified:** `scripts/phase-09-publish-archives.mjs`, `.github/workflows/release.yml`, `scripts/phase-09-workflow-check.mjs`, `scripts/phase-09-contract-check.mjs`, `RELEASING.md`
**Commit:** 5402534
**Applied fix:** Resume now requires the exact npmjs attestation URL, fetches the registry bundle, decodes the DSSE statement, and binds its subject name/integrity and GitHub repository/ref/commit/workflow/builder to the seal. Foreign source claims and fabricated URLs fail closed. The runbook explicitly states that this is semantic inspection, not local signature or transparency-log verification. Ambiguous publication requires a new full-run seal.

## Verification

- `node --check` passed for all five modified release/checker scripts.
- Version self-test: 23 controls passed; simulation produced the coherent `0.1.0` transition.
- Mutation self-test: 26 controls passed.
- Publisher self-test: 20 controls passed.
- Package checker self-test: 7 controls passed.
- Adapter budget self-test passed.
- Workflow checker: 2 workflows, 7 jobs, 16 controls passed.
- Contract checker self-test and final contract passed with 0 missing IDs.
- Release workflow YAML parsed successfully.
- `pnpm typecheck`, `pnpm build`, and all 439 tests passed.
- `git diff --check` passed.

No production prepare/apply, versioned finalization, terminal mutation run, release battery, real publish, or npm publication was executed. A read-only npmjs lookup was used only to confirm the current attestation response shape. The unrelated `.planning/config.json` modification and untracked `examples/adapter-ssr/.astro/` directory were not staged or committed.

---

_Fixed: 2026-08-11T10:54:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 3_
