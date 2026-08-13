---
phase: 09-react-and-svelte-adapters
fixed_at: 2026-08-11T08:54:24Z
review_path: .planning/phases/09-react-and-svelte-adapters/09-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 09: Code Review Fix Report

**Fixed at:** 2026-08-11T08:54:24Z
**Source review:** `.planning/phases/09-react-and-svelte-adapters/09-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: The workflow uploads the checked tarballs but publishes fresh repacks

**Status:** fixed
**Files modified:** `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `RELEASING.md`, `scripts/phase-09-publish-archives.mjs`, `scripts/phase-09-workflow-check.mjs`
**Commit:** `1c51634`
**Applied fix:** Replaced opaque `changeset publish` with a checked publisher that accepts only the absolute digest-manifest/core/React/Svelte archive paths, validates exact package identity and one shared version, and rehashes the manifest and all archives before every publication. It invokes only content-addressed npm 11.11.0 as `npm publish --access public <exact-tgz>` in core → React → Svelte order. Its stubbed self-test proves exact path/order and detects a between-call archive mutation. The workflow checker rejects Changesets publication, broad upload paths, and any package repack after same-revision verification.

### CR-02: Changesets versioning is outside the evidence seal and deadlocks the publish transition

**Status:** fixed: requires human verification
**Files modified:** `.changeset/bright-guides-connect.md`, `.changeset/config.json`, `CONTRIBUTING.md`, `package.json`, `packages/concierge-react/package.json`, `packages/concierge-svelte/package.json`, `packages/concierge-svelte/test/artifact.test.ts`, `scripts/phase-09-contract-check.mjs`, `scripts/phase-09-mutation-battery.mjs`, `scripts/phase-09-package-check.mjs`, `scripts/phase-09-version.mjs`
**Commits:** `b4e3a6f`, `68e0e13`
**Applied fix:** Added the public fixed release group, one synchronized minor changeset, the complete `.changeset/` input prefix, and a versioned mutation mode. The feature source peer is the fail-closed transition `workspace:^0.0.0 || ^0.1.0`, so raw Changesets status reports all three public packages as minor 0.1.0 without admitting a future major. The version command runs Changesets against a private `HEAD` snapshot, requires the transition target to equal the shared output, restores canonical `workspace:^`, discards only byte-formatting changes to semantically identical private fixture manifests, copies/stages an exact allowlist, then regenerates and stages the four Phase 09 terminal evidence files into the Version Packages PR. A committed simulation produced version 0.1.0, consumed one changeset, and retained no live-tree mutation.

### CR-03: The OIDC publish capability is available to all install, build, and test code

**Status:** fixed
**Files modified:** `.github/workflows/release.yml`, `scripts/phase-09-workflow-check.mjs`
**Commits:** `1c51634`, `8c6283a`
**Applied fix:** Split release into a no-OIDC contents/PR version job, a no-OIDC read-only verification/export job conditioned on `hasChangesets == 'false'`, and a dependent publisher with only `id-token: write`. The publisher has an explicit successful-verification condition, a ten-minute limit, two pinned artifact downloads, two closed reverification programs, and the exact publisher invocation—no checkout, setup action, dependency install, build, test, pack, VCS, or network-fetch command. Every action uses a reviewed full commit SHA. The npm tarball URL/SRI and publisher SHA-256 are verified before upload and again under OIDC.

### CR-04: The Svelte bridge effect captures initial props and cannot replace a bridge in-place

**Status:** fixed: requires human verification
**Files modified:** `README.md`, `examples/adapter-ssr/src/components/SvelteIsland.svelte`, `packages/concierge-svelte/README.md`, `packages/concierge-svelte/src/client.svelte.ts`, `packages/concierge-svelte/test/Harness.svelte`, `packages/concierge-svelte/test/artifact.test.ts`, `packages/concierge-svelte/test/lifecycle.test.ts`, `scripts/phase-09-contract-check.mjs`, `scripts/phase-09-package-check.mjs`
**Commit:** `af73f16`
**Applied fix:** Changed the Svelte bridge API to accept caller-owned registry/bridge getters and perform both reads inside `$effect`. The same mounted component now rerenders through old cleanup, new registration, stale-cleanup resistance, and final null; warning suppressions were removed and public/Astro examples use rune-aware getters.

### WR-01: The “frozen offline” package proof resolves and executes a fresh transitive graph

**Status:** fixed
**Files modified:** `RELEASING.md`, `scripts/fixtures/phase-09-foreign-consumer/package.json`, `scripts/fixtures/phase-09-foreign-consumer/package-lock.json`, `scripts/phase-09-contract-check.mjs`, `scripts/phase-09-mutation-battery.mjs`, `scripts/phase-09-package-check.mjs`
**Commit:** `dc92327`
**Applied fix:** Committed an npm-11.11.0 foreign-consumer manifest/lock, validates its exact dependency set and SHA-256, primes an owned cache from that lock, and runs every proof consumer with `npm ci --ignore-scripts --offline`. Only the exact three local archives are added afterward, still offline, and the tooling lock must remain byte-identical. The npm version, lock path/digest, and offline-CI disposition flow into release/security evidence.

### WR-02: Legal regular-expression literals can make the LOC gate undercount arbitrary code

**Status:** fixed: requires human verification
**Files modified:** `scripts/phase-09-adapter-budget.mjs`
**Commit:** `5a86188`
**Applied fix:** Replaced the partial handwritten comment lexer with TypeScript parser trivia ranges. The negative self-test places more than 150 executable lines between legal `/[/*]/` and `/[*/]/` literals and now fails with `LINE_BUDGET`.

### WR-03: The aggregate test checker permits an expected file with no active tests

**Status:** fixed
**Files modified:** `scripts/phase-09-test-check.mjs`
**Commit:** `720ebcc`
**Applied fix:** Requires every exact expected file to have a nonempty assertion list, every assertion to be passed, and aggregate passed/total/failure/pending/todo counts to agree. Synthetic all-skipped and mixed passed/skipped reports fail closed; the real report contains five files, ten suites, and eleven passed tests.

## Aggregate Verification

- `pnpm exec changeset status` — exited 0; core, React, and Svelte each report `minor 0.0.0 -> 0.1.0`; private/example packages report `none`.
- `node scripts/phase-09-version.mjs simulate` — passed from committed `HEAD`: `version=0.1.0`, bounded source peer, canonical final `workspace:^`, one consumed changeset.
- Feature-state pnpm pack/npm 11.11.0 install — passed for the exact 0.0.0 triplet; packed peers are `^0.0.0 || ^0.1.0`.
- Simulated version-state pnpm pack/npm install — passed for the exact 0.1.0 triplet; both packed core peers are `^0.1.0`.
- `pnpm typecheck` — passed; Svelte reported 0 errors and 0 warnings.
- `pnpm build` — passed, including publint/ATTW and normal Astro build.
- `pnpm test` — 25 files and 439 tests passed.
- `node scripts/phase-09-test-check.mjs` — five files, ten suites, eleven tests; both skip negatives passed.
- Adapter budget check/self-test — React 74 lines, Svelte 58 lines; regex-delimiter and all existing negatives passed.
- `node scripts/phase-09-contract-check.mjs final` — 53 required nonempty artifacts, zero missing IDs.
- `node scripts/phase-09-package-check.mjs all` — passed exact tarballs, offline consumers, one physical core, SSR, consent, and React/Svelte contract-mismatch probes with npm 11.11.0 and the committed lock digest.
- Version/publisher/mutation self-tests — passed 7/2/17 controls respectively.
- Workflow checker — `workflows=2 jobs=5 controls=10 ciSteps=19 releaseSteps=28`.
- CI and release YAML parse — passed; `git diff --check` passed.

## Generated Evidence and Publication Boundary

The four sealed Phase 09 terminal artifacts were intentionally not edited in this feature-state fix run:

- `.planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json`
- `.planning/phases/09-react-and-svelte-adapters/09-RELEASE-EVIDENCE.json`
- `.planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md`
- `.planning/phases/09-react-and-svelte-adapters/09-SECURITY.md`

They describe the pre-fix 0.0.0 revision and are not release authorization for these commits. The version-only Changesets job now regenerates all four from the final 0.1.0 package state and stages them into the Version Packages PR before verification can reach the OIDC publisher. No real npm publication command was run during this fix.

## Skipped Issues

None.

## Residual Uncertainty

CR-02 and CR-04 change state/lifecycle logic and retain the required human-verification flag despite passing structural, type, test, package, and simulation checks. The GitHub Actions/OIDC path has never executed; the first release must confirm npm trusted-publisher configuration and provenance on npmjs.com as documented in `RELEASING.md`.

---

_Fixed: 2026-08-11T08:54:24Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
