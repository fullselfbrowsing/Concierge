---
phase: 09-react-and-svelte-adapters
reviewed: 2026-08-11T07:18:36Z
depth: standard
files_reviewed: 40
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - .gitignore
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
  - scripts/phase-09-adapter-budget.mjs
  - scripts/phase-09-contract-check.mjs
  - scripts/phase-09-mutation-battery.mjs
  - scripts/phase-09-package-check.mjs
  - scripts/phase-09-test-check.mjs
  - scripts/phase-09-workflow-check.mjs
  - vitest.config.ts
findings:
  critical: 4
  warning: 3
  info: 0
  total: 7
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-08-11T07:18:36Z  
**Depth:** standard  
**Files Reviewed:** 40  
**Status:** issues_found

## Summary

The adapters and their current positive tests are compact, but the submitted phase is not release-ready. Four blocking defects break the claimed publication provenance, make the Changesets/version transition incompatible with the sealed evidence, expose npm publication authority to dependency code, and leave the Svelte bridge bound to stale initial props. Three additional defects weaken supply-chain reproducibility, the adapter line-budget gate, and positive-test-count enforcement.

Read-only validation commands currently pass despite these defects:

```text
Phase 09 final contract: PASS
adapter budget check/self-test: PASS
workflow checker: PASS
sealed mutation/release/ledger verification: PASS
changeset status: FAIL (changed packages but no changeset)
```

This demonstrates that the existing green evidence does not discriminate the release-path findings below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The workflow uploads the checked tarballs but publishes fresh repacks

**Classification:** BLOCKER  
**Files:**

- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/.github/workflows/release.yml:200-233`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-workflow-check.mjs:281-293`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-workflow-check.mjs:480-571`

**Issue:** The exact archives resolved from `phase-09-archive-digests.json` are only passed to `actions/upload-artifact`. Publication is delegated afterward to `changesets/action` with `publish: pnpm changeset publish`. As the workflow's own comments record, that command invokes `pnpm publish` in package directories, which packs those directories again; none of the three checked `.tgz` paths is supplied to the publish command. npm can therefore receive bytes different from the archives covered by the SHA-256 manifest, package tests, and release evidence. The workflow checker misses the defect because it scans only explicit `run:` steps for `pack` and then positively requires the opaque Changesets publish command.

**Fix:** Separate Changesets version preparation from publication. After versions are final and the exact archives have been exported, publish the resolved archive paths themselves in core-first order from a checked script:

```yaml
- name: Publish the exact checked archives
  run: >-
    node scripts/publish-checked-archives.mjs
    "${{ steps.phase09-archives.outputs.manifest }}"
    "${{ steps.phase09-archives.outputs.core }}"
    "${{ steps.phase09-archives.outputs.react }}"
    "${{ steps.phase09-archives.outputs.svelte }}"
```

The script should rehash the manifest and all three paths immediately before invoking `npm publish --access public <exact-tgz>` for core, React, then Svelte; it must never call `pack` or publish a package directory. Update the workflow checker to reject `changeset publish`, require these exact archive arguments/order, and add a stub-`npm` dry-run proving no repack occurs.

### CR-02: Changesets versioning is outside the evidence seal and deadlocks the publish transition

**Classification:** BLOCKER  
**Files:**

- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-mutation-battery.mjs:104-182`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-mutation-battery.mjs:552-602`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/.github/workflows/release.yml:103-106`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/.github/workflows/release.yml:230-233`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/packages/concierge-react/package.json:3`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/packages/concierge-svelte/package.json:3`

**Issue:** `releaseInputPaths()` includes selected root files and directory prefixes but omits the entire `.changeset/` control plane, including `.changeset/config.json` and future release entries. A Changesets ignore/access/version-plan change can therefore leave `verify all` green. The current tree has no `.changeset/*.md`, both adapters remain `0.0.0`, the sealed archives are `0.0.0`, and `pnpm exec changeset status` exits 1 with “changed packages but no changesets.” More importantly, the normal Version Packages PR will change the package manifests and lockfile after the current terminal evidence was produced. On the next `main` run, `check:phase09:release` verifies the old sealed input digest before `changesets/action` runs, so it fails on version drift and never reaches publication. The submitted workflow has no path that both finalizes versions and produces evidence for those same versioned bytes.

**Fix:** Add `.changeset/` to the exact tracked input set and enforce a release-preparation sequence in which versions are final before terminal evidence is generated. A version PR must contain the consumed Changeset/version updates and newly generated Phase 09 evidence in the same commit set; the publish job must be verify-only and must not mutate versions. Add controls for a missing/ignored Changeset and for manifest-version drift:

```js
const INPUT_DIRECTORY_PREFIXES = Object.freeze([
  ".changeset/",
  // existing prefixes...
]);
```

Document and automate the version-then-evidence sequence; do not rely on the current post-verification `changesets/action` invocation to perform both roles.

### CR-03: The OIDC publish capability is available to all install, build, and test code

**Classification:** BLOCKER  
**File:** `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/.github/workflows/release.yml:21-104`

**Issue:** `id-token: write` is granted at workflow scope to the single release job. Before the intended publication step, that same job installs `npm@latest`, installs the workspace, builds, tests, runs package tooling, and executes scratch-consumer dependencies. Any compromised dependency or build plugin executed by those steps can request the job's GitHub OIDC token and invoke npm trusted publishing itself, bypassing the checked-archive resolver and intended ordering. Locking the root dependency graph does not constrain the token to the final step, and the scratch consumer is not locked at all (WR-01).

**Fix:** Split the workflow into least-privilege jobs. The verification job should have only `contents: read`, build and upload the checked archive set, and have no `id-token: write`. A dependent minimal publish job should grant `id-token: write`, download/re-hash the exact artifact, and execute only the checked archive publisher. Put Changesets PR/version permissions in a separate no-OIDC job. Pin actions and the npm CLI used in the minimal publish job rather than installing a floating `npm@latest` under publication authority.

### CR-04: The Svelte bridge effect captures initial props and cannot replace a bridge in-place

**Classification:** BLOCKER  
**Files:**

- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/packages/concierge-svelte/src/client.svelte.ts:37-53`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/packages/concierge-svelte/test/Harness.svelte:37-60`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/packages/concierge-svelte/test/lifecycle.test.ts:142-178`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/packages/concierge-svelte/README.md:153-162`

**Issue:** `useConciergeBridge` receives `registry` and `bridge` as ordinary function values and closes over them inside `$effect`. The effect performs no reactive read that can change, so it runs once and retains the initial objects until destroy. The harness suppresses Svelte's `state_referenced_locally` warnings at the call; removing the suppressions produces compiler diagnostics that `registry` and `bridge` only capture their initial values, and compiled output calls `useConciergeBridge($$props.registry, $$props.bridge)`. The lifecycle test avoids the missing behavior by mounting a second component instead of rerendering the first one. If a parent replaces either prop on the existing component, the old bridge stays registered and the new registry/bridge never becomes live, contrary to the documented effect re-execution/teardown guarantee.

**Fix:** Make reactive reads occur inside the effect, for example by accepting caller-owned getters:

```ts
export function useConciergeBridge<B extends Bridge>(
  getRegistry: () => BridgeRegistry<B>,
  getBridge: () => B,
): void {
  $effect(() => {
    const registry = getRegistry();
    const bridge = getBridge();
    assertSingleInstance();
    // contract-version guard...
    return registry.register(bridge);
  });
}
```

Call it from rune-aware component source as `useConciergeBridge(() => registry, () => bridge)`. Replace the suppressed warning with a same-component `rerender` test that asserts old cleanup, new registration, stale-cleanup resistance, and final null. Update the public README/API examples accordingly.

## Warnings

### WR-01: The “frozen offline” package proof resolves and executes a fresh transitive graph

**Classification:** WARNING  
**Files:**

- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-package-check.mjs:73-87`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-package-check.mjs:497-536`
- `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-mutation-battery.mjs:1778-1805`

**Issue:** Each scratch consumer runs a networked `npm install` without a pre-existing lockfile. Exact top-level versions do not pin their transitive ranges; the generated lock is created only after resolution, discarded with the temp directory, and absent from release evidence. `--ignore-scripts` blocks lifecycle hooks but the subsequently invoked TypeScript, Vite, Vitest, React, and Svelte code still executes. Results can change without any repository byte changing, while the generated security ledger labels dependency supply-chain tampering “mitigated” by a frozen offline install.

**Fix:** Commit and hash a foreign-consumer tooling lock, populate a controlled cache from that lock, use `npm ci --ignore-scripts --offline` for tooling, and install only the three local tarballs without network resolution. Record the npm version and consumer-lock digest in release evidence. If a fully offline foreign install is intentionally deferred, change the security disposition from “mitigated” to an explicit accepted residual risk.

### WR-02: Legal regular-expression literals can make the LOC gate undercount arbitrary code

**Classification:** WARNING  
**File:** `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-adapter-budget.mjs:406-478`

**Issue:** The handwritten line scanner recognizes strings and comments but has no regular-expression state. In valid TypeScript, `/[/*]/` contains the raw characters `/*`, so the scanner enters block-comment state; a later valid `/[*/]/` contains `*/` and exits it. Every authored line between those expressions is treated as a comment even though TypeScript parses and executes it. An adapter can therefore exceed the independent 150-line requirement while `check` remains green. The self-test covers comment-looking strings/templates but no regex literal.

**Fix:** Derive comment trivia and line coverage from the TypeScript scanner/parser already loaded by this gate instead of maintaining a partial JavaScript lexer. Add a negative self-test with the two legal regex literals surrounding more than 150 executable lines and require `LINE_BUDGET`.

### WR-03: The aggregate test checker permits an expected file with no active tests

**Classification:** WARNING  
**File:** `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-09-test-check.mjs:97-151`

**Issue:** The checker validates global `success`, positive aggregate totals, and the five file paths, but never inspects each file's `assertionResults` or rejects `skipped`, `pending`, and `todo` statuses. One expected artifact/lifecycle/SSR file can contain only skipped tests while another file supplies the positive aggregate counts, and the checker still reports all five files as proven. This weakens the phase's positive-count evidence contract.

**Fix:** For every expected `testResults` entry, require a nonempty assertion list and require every assertion status to be `passed`; also require aggregate `numPassedTests === numTotalTests` and zero failed/pending/todo tests. Add synthetic JSON self-tests for an all-skipped expected file and a mixed passed/skipped report.

## Remediation and Evidence Impact

Code/workflow fixes are required before shipment. Existing Phase 09 terminal artifacts cannot be treated as release authorization because the workflow checker and sealed evidence both pass while CR-01 through CR-03 remain present.

Finalize Changesets versions first, apply all fixes, update affected tests/docs/checkers, then regenerate the complete terminal evidence set (mutation evidence, release evidence, validation ledger, and security ledger) from the final versioned revision. The exact archive triplet produced by that regeneration must be the triplet passed to npm. Do not merely rerun verify-only commands against the current ledgers.

---

_Reviewed: 2026-08-11T07:18:36Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: standard_
