---
phase: 09-react-and-svelte-adapters
reviewed: 2026-08-11T09:16:08Z
depth: deep
iteration: 2
files_reviewed: 48
files_reviewed_list:
  - .changeset/bright-guides-connect.md
  - .changeset/config.json
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - .gitignore
  - CONTRIBUTING.md
  - README.md
  - RELEASING.md
  - examples/adapter-ssr/astro.config.mjs
  - examples/adapter-ssr/package.json
  - examples/adapter-ssr/src/components/ReactIsland.tsx
  - examples/adapter-ssr/src/components/SvelteIsland.svelte
  - examples/adapter-ssr/src/pages/index.astro
  - examples/adapter-ssr/src/shared/catalog.ts
  - examples/adapter-ssr/test/ssr.test.ts
  - examples/adapter-ssr/tsconfig.json
  - package.json
  - packages/concierge/package.json
  - packages/concierge-react/README.md
  - packages/concierge-react/package.json
  - packages/concierge-react/src/client.tsx
  - packages/concierge-react/src/index.ts
  - packages/concierge-react/test-d/public.test-d.ts
  - packages/concierge-react/test/artifact.test.ts
  - packages/concierge-react/test/lifecycle.test.tsx
  - packages/concierge-react/tsconfig.json
  - packages/concierge-react/tsdown.config.ts
  - packages/concierge-svelte/README.md
  - packages/concierge-svelte/package.json
  - packages/concierge-svelte/src/client.svelte.ts
  - packages/concierge-svelte/src/index.ts
  - packages/concierge-svelte/svelte.config.js
  - packages/concierge-svelte/test/Harness.svelte
  - packages/concierge-svelte/test/artifact.test.ts
  - packages/concierge-svelte/test/lifecycle.test.ts
  - packages/concierge-svelte/tsconfig.json
  - pnpm-workspace.yaml
  - scripts/fixtures/phase-09-foreign-consumer/package-lock.json
  - scripts/fixtures/phase-09-foreign-consumer/package.json
  - scripts/phase-09-adapter-budget.mjs
  - scripts/phase-09-contract-check.mjs
  - scripts/phase-09-mutation-battery.mjs
  - scripts/phase-09-package-check.mjs
  - scripts/phase-09-publish-archives.mjs
  - scripts/phase-09-test-check.mjs
  - scripts/phase-09-version.mjs
  - scripts/phase-09-workflow-check.mjs
  - vitest.config.ts
findings:
  critical: 4
  warning: 1
  info: 0
  total: 5
status: fixed
fixed_at: 2026-08-11T09:50:38Z
fix_report: .planning/phases/09-react-and-svelte-adapters/09-REVIEW-FIX-2.md
---

# Phase 09: Code Review Report — Iteration 2

**Reviewed:** 2026-08-11T09:16:08Z  
**Depth:** deep  
**Files Reviewed:** 48  
**Status:** fixed

## Summary

The implementation directly fixes all seven findings from `09-REVIEW.md`: Svelte setup now reads reactive getters inside the effect, the adapter budget uses TypeScript trivia ranges, every test file must report a non-empty passing suite, the foreign-consumer install is lockfile-backed and offline, and the release workflow now splits verification from OIDC publication while publishing the three exact archives in dependency order.

Those fixes are not sufficient to authorize release. Four newly proven release-integrity/security defects remain, plus one partial-publication recovery defect. In particular, the repository still exposes an unchecked package-directory publish command; the Changesets action executes the entire dependency/evidence battery with a repository-write token; ordinary `0.0.0` evidence is accepted as release evidence; and the publish job trusts an archive manifest that can be rewritten alongside compromised archive bytes. Another fix and review iteration is required.

The checked-in Phase 09 evidence is intentionally stale relative to the fixes, so `node scripts/phase-09-mutation-battery.mjs verify all` currently fails closed. Do not regenerate terminal or release evidence merely to make this review pass: the release boundary findings below must be fixed first.

## Iteration 2 Fix Disposition

All five findings were fixed on 2026-08-11. The four Phase 09 terminal ledgers remain intentionally stale and were not regenerated; that is now a fail-closed publication condition rather than release authorization.

| Finding | Disposition | Fix commits |
|---|---|---|
| CR-01 | Fixed — root release and the exact folded workflow command reach only the sealed archive publisher; configured directory publishers and appended commands are rejected. | `f294df0`, `d903258` |
| CR-02 | Fixed — credential-free preparation owns version calculation/evidence; the minimal write-authorized Changesets job only verifies and copies the exact prepared artifact. | `79b2db6`, `d903258` |
| CR-03 | Fixed — feature evidence is non-authorizing; versioned evidence seals a nonzero shared version and consumed changeset digests, with a publish-specific archive verifier. | `79b2db6`, `adce802` |
| CR-04 | Fixed — a clean read-only job independently seals tracked release evidence and untrusted archives at `github.sha`; publication consumes only that seal plus pinned tooling. | `d903258` |
| WR-01 | Fixed — ordered publication queries exact registry versions, accepts only matching integrity plus provenance, and safely resumes partial/ambiguous publication. | `f294df0` |

## Prior Finding Disposition

| Prior finding | Disposition | Review evidence |
|---|---|---|
| CR-01: workflow did not publish the verified archives | Fixed directly, but superseded by CR-01 below | `.github/workflows/release.yml:378-418` invokes the archive publisher with the downloaded core, React, and Svelte tarballs; publisher order is fixed at `scripts/phase-09-publish-archives.mjs:225-231`. |
| CR-02: Changesets versioning invalidated its own evidence | Fixed directly, but superseded by CR-03 below | `node scripts/phase-09-version.mjs simulate` consumed exactly one changeset and produced a coherent `0.1.0` plan without modifying the worktree. |
| CR-03: verification had OIDC publication authority | Fixed directly, but superseded by CR-02 below | Only the `publish` job grants `id-token: write`; `verify` and `version` do not. |
| CR-04: Svelte setup captured non-reactive values | Fixed | `packages/concierge-svelte/src/client.svelte.ts:37-56` reads both getters inside `$effect`; the lifecycle test rerenders the same mounted component through replacement and cleanup. Svelte typecheck passed. |
| WR-01: foreign-consumer install was not offline/locked | Fixed | The committed foreign lockfile is used by `npm ci --ignore-scripts --offline`, and the lockfile digest is asserted unchanged. |
| WR-02: LOC scanner miscounted regex literals | Fixed | `scripts/phase-09-adapter-budget.mjs:407-439` uses TypeScript scanner trivia ranges; its regex-literal negative control passes. |
| WR-03: aggregate Vitest success hid skipped files | Fixed | `scripts/phase-09-test-check.mjs:97-217` requires every expected file to contain a non-empty, fully passing suite; all-skipped and mixed-result negatives pass. |

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A configured package-directory publish path bypasses archive verification

**Classification:** BLOCKER  
**File:** `package.json:49`; `scripts/phase-09-workflow-check.mjs:28-50,316-345,657-682,733-791`  
**Issue:** The root `release` script remains `changeset publish`, which publishes package directories rather than the exact tarballs sealed by Phase 09. The workflow checker actively requires this unsafe command. It validates that the expected archive-publisher invocation appears in the release workflow, but it does not reject additional publish commands or require the folded run block to equal the approved command. In an isolated copy of `HEAD`, appending `&& npm publish /tmp/unchecked-package` to the final publish step still produced `PHASE09_WORKFLOW_CHECK_OK`. Thus both a real configured bypass (`pnpm release`) and an undetected workflow bypass remain. The repository cannot claim that all configured release paths publish only checked bytes.

**Fix:** Replace or remove the package-directory `changeset publish` script and route every configured release entry point through the exact-archive publisher. Make the workflow checker reject every `npm publish`, `pnpm publish`, and `changeset publish` occurrence except the single allowlisted publisher implementation, require the final publish command to match exactly, and add a negative test that appends a second publish command.

### CR-02: The Changesets action exposes repository-write credentials to the full dependency battery

**Classification:** BLOCKER  
**File:** `.github/workflows/release.yml:19-21,46-56`; `scripts/phase-09-version.mjs:60-65,445-449`  
**Issue:** The `version` job grants `contents: write` and `pull-requests: write`, then the pinned Changesets action invokes `pnpm phase09:version`. The pinned action passes `GITHUB_TOKEN` to the custom version command and writes that token to `$HOME/.netrc`. The wrapper in turn spreads the complete process environment to child commands and runs the two-hour mutation/build/test/package battery. Consequently, any compromised lifecycle script, compiler plugin, test dependency, or package tooling executed during version preparation receives credentials capable of changing repository contents or the release PR. Removing OIDC from this job limits registry impact but does not isolate repository-write authority.

The credential behavior is confirmed by the pinned upstream action implementation: [`src/run.ts`](https://github.com/changesets/action/blob/a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d/src/run.ts#L274-L276) injects the token, and [`src/index.ts`](https://github.com/changesets/action/blob/a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d/src/index.ts#L43-L47) writes `.netrc` before the version command.

**Fix:** Run version calculation and the complete evidence battery in a job with no write-capable token or persisted credentials. Pass only an exact, validated, allowlisted patch/artifact into a minimal pinned PR-writing job; that job must not install workspace dependencies or run project code. Merely deleting `GITHUB_TOKEN` from the wrapper's child environment is insufficient because the action has already written `.netrc` and the parent package invocation already executes under the token.

### CR-03: Ordinary `0.0.0` evidence can authorize an automated release

**Classification:** BLOCKER  
**File:** `.github/workflows/release.yml:54-56`; `scripts/phase-09-mutation-battery.mjs:415-438,686-737,1545-1634,2051-2077`; `scripts/phase-09-publish-archives.mjs:151-165`  
**Issue:** `run all` and the versioned Changesets path write the same evidence schema. Only the versioned path proves that one changeset was consumed and that all package versions equal the planned nonzero shared version. Neither release-evidence verification nor the publisher requires a `versioned` provenance marker, a sealed shared version, or a version other than `0.0.0`. The release workflow enters publication whenever no changeset remains. Therefore, if a changeset is removed or consumed outside the guarded wrapper and ordinary evidence is regenerated on the current `0.0.0` tree, the workflow accepts that internally consistent evidence and the publisher accepts the `0.0.0` archives. Static call-chain review is sufficient to prove this path; the destructive terminal battery was not run.

**Fix:** Give evidence an explicit non-forgeable release contract such as `mode: "versioned"`, the consumed changeset identity, and `sharedVersion`. Generate release-authorizing evidence only after the staged Changesets transition is validated. Require release verification and the publisher to reject ordinary evidence, reject `0.0.0`, and verify that every archive version exactly equals the sealed shared version. Keep ordinary `run all` evidence explicitly non-authorizing and cover the `0.0.0` path with a negative control.

### CR-04: The archive manifest is self-authenticating and can be rewritten with compromised bytes

**Classification:** BLOCKER  
**File:** `.github/workflows/release.yml:89-168,226-244,345-419`; `scripts/phase-09-package-check.mjs:1363-1389`; `scripts/phase-09-mutation-battery.mjs:1598-1626`; `scripts/phase-09-publish-archives.mjs:114-178`  
**Issue:** The dependency-running `verify` job creates each archive and a colocated JSON file containing that archive's digest, then uploads both. The isolated publisher checks only that the downloaded bytes agree with those downloaded JSON records. It never compares the current export to hashes sealed in a separately trusted release record. A compromised dependency running in `verify` can therefore wait until the checks finish, replace a tarball, recompute its adjacent manifest, and leave a pair that the publisher accepts. The publisher self-test mutates archive bytes without updating the manifest, so it does not exercise coordinated archive-plus-manifest substitution. This violates the stated compromised-dependency boundary even though the publish job itself does not run workspace code.

**Fix:** Bind archive hashes and the shared version to a trust root that the dependency-running job cannot rewrite. For example, have a clean, no-workspace-code sealing job at the exact `github.sha` validate deterministic archive hashes against versioned release evidence and emit a content-addressed artifact; make the publisher require those independently sealed hashes and exact artifact provenance. Add a negative control that changes both an archive and its local manifest, plus checks for the exact repository, run ID, commit, and artifact name.

## Warnings

### WR-01: A partial three-package publish cannot be safely resumed

**Classification:** WARNING  
**File:** `scripts/phase-09-publish-archives.mjs:48-60,225-231`  
**Issue:** Publication is sequential and aborts on the first nonzero npm result. If core publishes successfully but React fails—or if the client loses the response after the registry accepted core—a rerun starts with core again. The pinned npm client will reject an already-existing version, so the approved path cannot finish the remaining packages without manual bypass or modification. This turns a normal partial failure into a stranded, inconsistent release.

**Fix:** Add an explicit resume protocol. Before each publish, query the exact registry/version with pinned tooling and skip only when the existing artifact's integrity and provenance match the sealed local tarball; otherwise fail closed. Add a stubbed publisher test covering first-package success, second-package failure, and an exact safe rerun.

## Verification Performed

- `node scripts/phase-09-version.mjs self-test` — all 7 controls passed.
- `node scripts/phase-09-version.mjs simulate` — planned `0.1.0`, consumed exactly one changeset, and left the worktree unchanged.
- `node scripts/phase-09-publish-archives.mjs selftest` — both current archive-integrity controls passed.
- `node scripts/phase-09-workflow-check.mjs` — 2 workflows, 5 jobs, and all 10 current controls passed.
- Isolated workflow-checker negative — appending a second unchecked `npm publish` still passed, proving CR-01 without executing publication.
- `node scripts/phase-09-adapter-budget.mjs check` and `selftest` — React 74 logical LOC, Svelte 58 logical LOC; all scanner controls passed.
- `node scripts/phase-09-test-check.mjs` — 5 files, 10 suites, and 11 tests passed; skipped/mixed controls passed.
- `pnpm --filter @fullselfbrowsing/concierge-svelte typecheck` — 0 errors and 0 warnings.
- `node scripts/phase-09-contract-check.mjs final` — 53 final-contract checks passed.
- `pnpm exec changeset status` — three packages currently plan a minor release.
- `node scripts/phase-09-mutation-battery.mjs verify all` — failed closed because the checked-in feature/release evidence is stale, as expected before authorized regeneration.
- `git diff --check` — passed.

No real publish, terminal mutation `run all`, or release battery was executed. Existing unrelated changes to `.planning/config.json` and `examples/adapter-ssr/.astro/` were not touched.

## Post-fix Release Authorization Verdict

The iteration-2 findings are fixed, but release remains **not yet authorized**. A third adversarial review must clear the new prepare/apply/seal/resume boundary. After that review, ordinary feature evidence may be regenerated for CI if needed; the local checked-in `0.0.0` ledgers still cannot authorize publication. The first Version Packages run must prepare the actual `0.1.0` transition, consume `.changeset/bright-guides-connect.md`, generate fresh `mode: "versioned"` evidence for shared version `0.1.0`, and pass the exact publish verifier and independent seal before OIDC publication can become eligible.

---

_Reviewed: 2026-08-11T09:16:08Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: deep_
