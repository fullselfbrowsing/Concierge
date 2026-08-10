---
phase: 09-react-and-svelte-adapters
plan: 01
subsystem: testing
tags: [vitest, vite, react, svelte, jsdom, contract-testing, tdd]

requires:
  - phase: 08-consent-kernel
    provides: Core package, executable tests, and immutable evidence patterns
provides:
  - Immutable eleven-ID Phase 09 RED baseline with assertion-observed failures and SHA-256 input evidence
  - Five-mode Phase 09 contract checker with non-vacuity and missing-path self-tests
  - Four exact, pairwise-disjoint Vitest projects for core, artifacts/SSR, React lifecycle, and Svelte lifecycle tests
affects: [09-react-and-svelte-adapters, react-adapter, svelte-adapter, adapter-ssr, release-evidence]

tech-stack:
  added: [vite@8.1.5, "@vitejs/plugin-react@5.2.0", "@sveltejs/vite-plugin-svelte@7.2.0", svelte@5.56.8, jsdom@29.1.1]
  patterns: [immutable RED ledger, exact Vitest project routing, positive JSON collection gates]

key-files:
  created:
    - scripts/phase-09-contract-check.mjs
    - .planning/phases/09-react-and-svelte-adapters/09-RED-BASELINE.json
  modified:
    - package.json
    - pnpm-lock.yaml
    - vitest.config.ts

key-decisions:
  - "Verify the initial RED state from its persisted hashes after the live tree begins changing."
  - "Translate the locked Svelte hot:false test configuration to vite-plugin-svelte 7.2's supported compilerOptions.hmr setting."

patterns-established:
  - "Contract transitions: baseline-record captures exactly eleven failures once; baseline-verify never reevaluates the changing tree."
  - "Test routing: every runtime class has an explicit environment and exact include list, with positive suite/test/file counts required for evidence."

requirements-completed: [ADP-01, ADP-02, ADP-03, ADP-04, PKG-04]

duration: 19min
completed: 2026-08-10
---

# Phase 09 Plan 01: RED Baseline and Test Routing Summary

**An immutable, assertion-observed eleven-contract RED ledger now anchors Phase 09, while four exact Vitest projects isolate core Node tests from framework lifecycle transforms.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-08-10T18:42:29Z
- **Completed:** 2026-08-10T19:01:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Captured exactly eleven ordered missing-contract IDs, 38 inspected input states, their individual hashes, and source digest `e47452c174621433d2e5a4d56e6225ad42b010cc1518b5e15771be25047d6f50` before adapter scaffolding began.
- Implemented all five checker modes up front, including synthetic controls that reject unknown modes, duplicate or wrong cardinality, missing paths, zero-match assertions, and vacuous probes.
- Routed core, adapter artifacts/Astro SSR, React lifecycle, and Svelte lifecycle tests into four pairwise-disjoint projects with the required Node or jsdom environment and framework plugin.
- Proved the core route is non-vacuous after a frozen-lockfile reinstall: 6 suites and 21 tests passed through the JSON evidence gate.

## Task Commits

Each task was committed atomically:

1. **Task 09-01-01 (RED): Add failing contract checker specification** - `3116095` (`test`)
2. **Task 09-01-01 (GREEN): Persist exact Phase 09 RED baseline** - `2d8d24c` (`feat`)
3. **Task 09-01-02: Route explicit framework test projects** - `b2012c9` (`chore`)

_Task 1 followed the required TDD split: RED was committed before GREEN._

## Files Created/Modified

- `scripts/phase-09-contract-check.mjs` - Five-mode contract state machine with exact ID sets, assertion-level observations, immutable baseline validation, final path guards, and synthetic self-tests.
- `.planning/phases/09-react-and-svelte-adapters/09-RED-BASELINE.json` - Initial eleven-failure ledger with sorted input metadata, per-input SHA-256 hashes, and a stable source digest.
- `package.json` - Exact shared Vite, framework plugin, Svelte, and jsdom development pins.
- `pnpm-lock.yaml` - Reproducible dependency graph for the new root test tooling.
- `vitest.config.ts` - Four non-overlapping projects with exact includes and environment-specific plugins.

## Decisions Made

- Baseline verification reads and validates the persisted record rather than reevaluating a tree that is expected to turn green over subsequent plans.
- The configured `svelte({ hot: false })` surface is retained, but a local adapter maps it to vite-plugin-svelte 7.2's supported `compilerOptions.hmr` option and disables irrelevant root config discovery.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevented Svelte plugin diagnostics from corrupting Vitest JSON evidence**

- **Found during:** Task 09-01-02 (Route core, artifact/SSR, React, and Svelte tests into explicit projects)
- **Issue:** vite-plugin-svelte 7.2 rejects the plan's legacy top-level `hot` option and logs config diagnostics before Vitest's JSON reporter, so the required positive-count command could not parse its output.
- **Fix:** Preserved the locked `svelte({ hot: false })` project call through a typed local adapter that passes `compilerOptions: { hmr: false }` and `configFile: false` to the installed plugin API.
- **Files modified:** `vitest.config.ts`
- **Verification:** The exact JSON-reporter command parsed successfully and reported 6 suites and 21 tests; the static routing gate also passed.
- **Committed in:** `b2012c9`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix preserves the planned routing semantics and exact visible configuration while making its machine-readable evidence reliable; no production or adapter scope was added.

## Issues Encountered

- Context7 and its CLI fallback were unavailable in the environment. Version-specific package details were confirmed against the locked Phase 09 research and installed 7.2.0 package declarations/source.

## TDD Gate Compliance

- RED gate: `3116095` introduced the deliberately failing self-test specification and was observed failing before implementation.
- GREEN gate: `2d8d24c` implemented the checker and immutable ledger after RED.
- Refactor gate: not needed.

## Verification

- `pnpm install --frozen-lockfile` - passed with no lockfile drift.
- `node scripts/phase-09-contract-check.mjs baseline-verify` - passed with exactly 11 persisted IDs.
- `node scripts/phase-09-contract-check.mjs self-test` - passed all negative controls.
- Positive JSON core run - passed with 6 suites and 21 tests.
- Exact routing static gate - passed; no broad package glob or `passWithNoTests` is present.
- Baseline artifact SHA-256 remained `eb70c55e7f2030d71d442b32d43f2a18906b46a1623a9e5eb350eadda9bc3c6c`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 09-02 and 09-03 can add the React and Svelte package skeletons against a fixed initial ledger and already-routed test environments.
- `post-skeleton` is intentionally not run until both skeleton plans exist; the immutable baseline remains independently verifiable throughout.
- No blockers remain.

## Self-Check: PASSED

All six referenced files exist, all three task commits are present in repository history, and the persisted baseline cardinality, input count, and digest were revalidated.

---
*Phase: 09-react-and-svelte-adapters*
*Completed: 2026-08-10*
