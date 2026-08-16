---
phase: 09-react-and-svelte-adapters
plan: 06
subsystem: tooling
tags: [astro, react, svelte, typescript, pnpm, ssr]

requires:
  - phase: 09-react-and-svelte-adapters
    provides: Canonical React adapter package and server-safe client artifact
  - phase: 09-react-and-svelte-adapters
    provides: Canonical Svelte adapter package with package-local TypeScript 6 compiler domain
provides:
  - Private Astro 7 dual-framework integration harness with no premature source or UI
  - Validated fresh-output injection restricted to owned direct children of the OS temporary directory
  - Exact React, Svelte, Astro, workspace-adapter, and package-local TypeScript 6 lock importer
  - Reproducible pnpm approval for Astro's exact official esbuild postinstall
affects: [09-react-and-svelte-adapters, adapter-ssr, release-evidence]

tech-stack:
  added: ["astro@7.2.0", "@astrojs/react@6.0.2", "@astrojs/svelte@9.0.1", "@astrojs/check@0.9.10"]
  patterns: [private dual-integration harness, validated injectable output root, exact workspace importer, scoped build-script approval]

key-files:
  created:
    - examples/adapter-ssr/package.json
    - examples/adapter-ssr/astro.config.mjs
    - examples/adapter-ssr/tsconfig.json
  modified:
    - pnpm-workspace.yaml
    - pnpm-lock.yaml

key-decisions:
  - "Accept only normalized direct mkdtemp-style output roots with the concierge-adapter-ssr- prefix; otherwise use the local ./dist default."
  - "Approve only esbuild's required build script because Astro 7.2.0 directly depends on esbuild 0.28.2; retain pnpm strictDepBuilds and the exact Svelte TypeScript 6 package extension."

patterns-established:
  - "Harness sequencing: configure and lock the private Astro package before any source, page, UI, check, build, or SSR evidence exists."
  - "Compiler ownership: the Astro/Svelte harness resolves TypeScript 6.0.3 locally while the workspace root remains on TypeScript 7.0.2."
  - "Temporary-output boundary: environment-provided build roots must be absolute, normalized, direct OS-temp children with an owned prefix and nonempty suffix."

requirements-completed: [ADP-04]

duration: 20m 15s
completed: 2026-08-10
---

# Phase 09 Plan 06: Astro Toolchain Skeleton Summary

**A private Astro 7 harness now resolves both official framework integrations and all three live workspace packages through an exact TypeScript 6 lock graph, with fresh build outputs constrained to owned temporary roots.**

## Performance

- **Duration:** 20m 15s
- **Started:** 2026-08-11T03:00:14Z
- **Completed:** 2026-08-11T03:20:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created one private, ESM-only Astro example with official React and Svelte integrations, exact researched versions, and workspace development links to core plus both adapters.
- Kept the harness configuration-first: no `src/`, page, UI, test, check, build, or SSR claim was introduced before Plan 09-07.
- Added a guarded `ADAPTER_SSR_OUT_DIR` seam that accepts only normalized, direct mkdtemp-style children of the operating-system temporary directory and otherwise defaults to local `./dist`.
- Locked all 13 example importer edges exactly, including package-local TypeScript 6.0.3 without altering root TypeScript 7.0.2 or the Svelte package's compiler domain.
- Preserved pnpm's strict build-script policy while allowing only Astro's required official `esbuild@0.28.2` installer.

## Task Commits

1. **Task 09-06-01: Scaffold the dual-framework Astro harness** - `269be81` (`chore`)
2. **Task 09-06-02: Reconcile and verify the Astro integration lock importer** - `4a0a8f0` (`chore`)

## Files Created/Modified

- `examples/adapter-ssr/package.json` - Private harness scripts and exact Astro, framework, workspace, runtime, type, and local compiler dependencies.
- `examples/adapter-ssr/astro.config.mjs` - Official integrations, static output, and validated fresh-output selection.
- `examples/adapter-ssr/tsconfig.json` - Astro strict baseline with React JSX ownership and generated-type coverage.
- `pnpm-workspace.yaml` - Exact `esbuild` build approval while preserving workspace globs, catalog pins, and the Svelte TypeScript package extension.
- `pnpm-lock.yaml` - Reproducible 13-edge example importer and Astro integration graph.

## Decisions Made

- Kept both adapters as live workspace development dependencies so the eventual SSR harness exercises the exact packages under development rather than registry aliases or copies.
- Used official `react()` and `svelte()` integrations in one `output: "static"` configuration, leaving actual dual-build evidence to the next plan.
- Rejected repository paths, nested temporary paths, unnormalized paths, NUL-containing values, and unowned temporary-directory names at the output environment boundary.
- Allowed only the exact `esbuild` lifecycle script required by Astro's direct dependency graph; no wildcard approval, ignored-script mode, or disabled strict policy was introduced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Approved Astro's exact esbuild postinstall under pnpm strictDepBuilds**
- **Found during:** Task 09-06-02
- **Issue:** Astro 7.2.0 directly depends on `esbuild`, whose platform binary is installed by a required postinstall. pnpm 11 rejected normal and frozen installs while the script was unlisted, so the committed lock graph would not be reproducibly installable.
- **Fix:** Added the narrow `allowBuilds: { esbuild: true }` policy, preserved strict build enforcement and all existing workspace/package-extension configuration, then reconciled the lockfile with a plain install.
- **Files modified:** `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- **Commit:** `4a0a8f0`

## Issues Encountered

- Context7 and its CLI fallback were unavailable. Version-sensitive configuration behavior was checked against the official Astro and pnpm documentation plus the exact installed package graph.
- The first plain install surfaced pnpm's generated unapproved-build placeholder. That unstaged placeholder was restored immediately and replaced only after the exact Astro-to-esbuild dependency and official pnpm approval semantics were verified.
- The Conductor checkout uses a `.git` file despite sequential mode. The configured `workflow.use_worktrees=false` exception and intended shared branch were honored; no refs, branches, or worktrees were changed.

## Verification

- `pnpm install` - passed across all seven workspace projects; `esbuild@0.28.2` completed its required installer.
- `pnpm install --frozen-lockfile` - passed with the committed exact lock graph.
- Plan manifest/config assertions - passed for private status, exact local TypeScript, six required package edges, both official integrations, static output, and the Astro strict configuration.
- Astro CLI - resolved from the example as exactly `astro v7.2.0` before and after the frozen reinstall.
- Integration import gate - imported both official modules as callable integrations from the example package.
- Compiler split - example and Svelte package resolved TypeScript 6.0.3; root resolved TypeScript 7.0.2.
- Lock importer gate - verified exactly 13 dependency edges, exact specifiers, three `workspace:*` links, and no registry aliases for local packages.
- esbuild runtime gate - resolved Astro's exact `esbuild@0.28.2` dependency and executed a TypeScript transform through its installed binary.
- Output-root gate - accepted an owned direct mkdtemp root and rejected the repository root.
- Sequencing gate - confirmed `examples/adapter-ssr/src` does not exist; no Astro check or build was run out of order.
- Workspace policy gate - preserved exact package globs and the Svelte package's TypeScript 6 extension while allowing only `esbuild` builds.
- `node scripts/phase-09-contract-check.mjs baseline-verify` - passed with 11 immutable IDs and digest `e47452c174621433d2e5a4d56e6225ad42b010cc1518b5e15771be25047d6f50`.
- SDK artifact verification - passed all three declared plan artifacts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-07 can add the real React and Svelte source islands, build twice into isolated fresh roots, and collect SSR behavior without changing toolchain ownership.
- The absence of source and SSR evidence is intentional at this boundary; root recursive build/check remains deferred until the real harness exists.
- No blockers remain.

## Self-Check: PASSED

All five implementation/configuration files and the summary are nonempty, both task commits exist in repository history, and all three declared plan artifacts pass SDK verification.

---
*Phase: 09-react-and-svelte-adapters*
*Completed: 2026-08-10*
