---
phase: 09-react-and-svelte-adapters
fixed_at: 2026-08-11T09:50:38Z
review_path: .planning/phases/09-react-and-svelte-adapters/09-REVIEW-2.md
iteration: 2
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 09: Code Review Fix Report — Iteration 2

**Fixed at:** 2026-08-11T09:50:38Z
**Source review:** `.planning/phases/09-react-and-svelte-adapters/09-REVIEW-2.md`
**Iteration:** 2

**Summary:**

- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: A configured package-directory publish path bypasses archive verification

**Status:** fixed
**Files modified:** `package.json`, `.github/workflows/release.yml`, `scripts/phase-09-publish-archives.mjs`, `scripts/phase-09-workflow-check.mjs`
**Commits:** `f294df0`, `d903258`
**Applied fix:** Root `release` now enters only `phase-09-publish-archives.mjs` and fails closed without the required seal/archive arguments. The workflow uses one exact folded publisher command. The checker scans every tracked package script plus executable workflow/script sources for Changesets or npm/pnpm directory publication, requires the one reviewed command byte-for-byte, and proves an appended `&& npm publish /tmp/unchecked-package` command fails.

### CR-02: The Changesets action exposes repository-write credentials to the full dependency battery

**Status:** fixed: requires human verification
**Files modified:** `.github/workflows/release.yml`, `scripts/phase-09-version.mjs`, `scripts/phase-09-workflow-check.mjs`
**Commits:** `79b2db6`, `d903258`
**Applied fix:** A `contents: read` preparation job checks out exact `github.sha` with credentials unpersisted, asserts no GitHub/npm token or netrc, installs dependencies, calculates the version transition, runs the complete versioned evidence battery, and uploads an exact SHA-256-manifested blob allowlist bound to base SHA, repository, run ID, and artifact name. The contents/PR-write job contains only pinned checkout, artifact download, and Changesets action. Its custom command is the stdlib-only `node scripts/phase-09-version.mjs apply <artifact-dir>` path, which invokes no child command and verifies base hashes, artifact identity/content, semantic package-manifest-only changes, evidence authorization, and exact write/delete paths before copying. No changesets produce an exact no-op artifact; apply rejects that no-op safely if invoked.

### CR-03: Ordinary `0.0.0` evidence can authorize an automated release

**Status:** fixed: requires human verification
**Files modified:** `scripts/phase-09-mutation-battery.mjs`, `scripts/phase-09-version.mjs`, `scripts/phase-09-publish-archives.mjs`, `scripts/phase-09-contract-check.mjs`, `CONTRIBUTING.md`, `RELEASING.md`
**Commits:** `79b2db6`, `f294df0`, `adce802`
**Applied fix:** Ordinary `run all` evidence is now explicitly `mode: "feature"`, `releaseAuthorization: false`, with null shared version and no consumed changesets. Only `run versioned` seals a non-`0.0.0` `sharedVersion`, true authorization, and each consumed changeset path/SHA-256. The read-only `verify publish <archive-dir>` path requires versioned authorization and exact tracked archive digest/version matches. The independent seal and publisher repeat the mode/version/archive checks; feature evidence, `0.0.0`, removed changesets, and archive version drift all fail focused negatives.

### CR-04: The archive manifest is self-authenticating and can be rewritten with compromised bytes

**Status:** fixed: requires human verification
**Files modified:** `.github/workflows/release.yml`, `scripts/phase-09-publish-archives.mjs`, `scripts/phase-09-workflow-check.mjs`, `RELEASING.md`
**Commits:** `f294df0`, `d903258`, `adce802`
**Applied fix:** The dependency-running verifier uploads an explicitly untrusted archive export. A new clean `seal` job has only `contents: read`, checks out exact `github.sha` with credentials unpersisted, installs nothing, and executes no workspace code. Inline stdlib logic reads tracked versioned release evidence from that checkout, independently validates archive identities/SHA-256/shared version, computes SHA-512, and binds repository, run ID, commit, exact input/output artifact names, consumed changeset digests, and evidence digest into `phase09-sealed-release-<seal-id>`. The OIDC job consumes only that immutable seal plus the twice-rehashed pinned publisher/npm toolchain. Coordinated archive-plus-manifest substitution fails because it cannot reproduce the separately tracked/content-addressed seal.

### WR-01: A partial three-package publish cannot be safely resumed

**Status:** fixed: requires human verification
**Files modified:** `scripts/phase-09-publish-archives.mjs`, `RELEASING.md`, `scripts/phase-09-contract-check.mjs`
**Commits:** `f294df0`, `adce802`
**Applied fix:** Before each package, pinned npm queries exact `name@version`. An existing version is skipped only when `dist.integrity` equals the sealed local SHA-512 and registry attestation metadata contains the SLSA provenance predicate. Missing versions publish the exact tgz with public access and provenance, then are requeried. An ambiguous publish failure is accepted only if the requery proves exact integrity and provenance. Stubbed, network-free controls cover initial success, core success/React failure, safe exact rerun completing both adapters, mismatched existing bytes, and missing provenance.

## Aggregate Verification

- Syntax: `node --check` passed for the version, mutation, publisher, workflow-checker, and contract-check scripts.
- `node scripts/phase-09-version.mjs self-test` — 13 controls passed, including semantic manifest injection, exact no-op artifact, run binding, content tamper, and token stripping.
- `node scripts/phase-09-mutation-battery.mjs self-test` — 22 controls passed, including feature non-authorization and ordinary/`0.0.0`/removed-changeset publication rejection.
- `node scripts/phase-09-publish-archives.mjs self-test` — 9 network-free controls passed, including partial failure/rerun, registry integrity/provenance, coordinated substitution, ordinary mode, zero version, and version drift.
- `node scripts/phase-09-package-check.mjs self-test` — 7 controls passed.
- `node scripts/phase-09-workflow-check.mjs` — `workflows=2 jobs=7 controls=15 ciSteps=19 releaseSteps=40`.
- `node scripts/phase-09-contract-check.mjs final` — 55 required nonempty artifacts and zero missing IDs.
- `node scripts/phase-09-version.mjs simulate` — planned shared `0.1.0`, consumed one changeset, restored canonical `workspace:^`, and left the worktree unchanged.
- Release YAML parsed successfully with Ruby Psych.
- `pnpm release` without the exact runtime seal/archive arguments failed closed with `CLI` before npm invocation.
- `verify publish` against the current checked-in evidence failed closed because the intentionally stale evidence has no feature/versioned mode.
- `git diff --check` passed.

No real npm publication, terminal mutation `run all`, production `prepare`/`apply`, full release battery, or evidence regeneration ran in this fix pass.

## Generated Evidence and Publication Boundary

These four Phase 09 artifacts were deliberately not modified or regenerated:

- `.planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json`
- `.planning/phases/09-react-and-svelte-adapters/09-RELEASE-EVIDENCE.json`
- `.planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md`
- `.planning/phases/09-react-and-svelte-adapters/09-SECURITY.md`

They remain stale `0.0.0` feature-era records and fail the new publication contract. No Phase 8 record was modified.

## Skipped Issues

None.

## Residual Uncertainty and Prerequisites

- The five-job GitHub Actions/OIDC path has never run. Static checks cannot prove artifact upload/download flattening, Changesets action behavior around a downloaded no-op artifact, or npm trusted-publisher configuration.
- Artifact names bind `github.run_id` and commit but not `github.run_attempt`; an iteration-3 review should confirm GitHub artifact behavior on a rerun and add attempt binding if v4 name immutability spans attempts.
- No live registry query or publish occurred. The npm 11.11.0 `dist.attestations` shape was checked against current public registry metadata, but first-release OIDC/provenance behavior still requires observation.
- Iteration 3 must adversarially review the exact prepare/apply allowlist, no-changeset gating, inline independent sealer, content-addressed artifact bindings, exact folded publisher command, and partial-release retry semantics.
- Only after iteration 3 clears the boundary should the actual local/Version Packages `0.1.0` transition be finalized. Run credential-free version preparation from a clean exact commit, consume `.changeset/bright-guides-connect.md`, inspect the prepared artifact/PR, preserve all five Phase 8 records, and require fresh `mode: "versioned"`, `sharedVersion: "0.1.0"` evidence before publication verification or sealing.

---

_Fixed: 2026-08-11T09:50:38Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 2_
