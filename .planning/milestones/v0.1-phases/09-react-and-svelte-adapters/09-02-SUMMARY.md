---
phase: 09-react-and-svelte-adapters
plan: 02
subsystem: packaging
tags: [react, tsdown, typescript, esm, pnpm]

requires:
  - phase: 09-react-and-svelte-adapters
    provides: Immutable eleven-ID RED baseline and routed React lifecycle project from Plan 09-01
  - phase: 08-consent-kernel
    provides: Publish-ready core package and canonical singleton contracts
provides:
  - Publish-ready React adapter package skeleton with root and client export maps
  - Neutral ESM build contract whose banner targets only the client artifact
  - Reproducible React 19 development graph with core held peer-and-dev only
affects: [09-react-and-svelte-adapters, react-adapter, adapter-artifacts, release-evidence]

tech-stack:
  added: [react@19.2.8, react-dom@19.2.8, "@types/react@19.2.18", "@types/react-dom@19.2.4", "@testing-library/react@16.3.2"]
  patterns: [peer-and-dev singleton topology, subpath-specific client directive banner, package-local adapter build]

key-files:
  created:
    - packages/concierge-react/package.json
    - packages/concierge-react/tsconfig.json
    - packages/concierge-react/tsdown.config.ts
    - packages/concierge-react/LICENSE
  modified:
    - pnpm-lock.yaml

key-decisions:
  - "Keep core external and declare it as workspace:^ peer plus workspace:* development link, never as a runtime dependency."
  - "Apply the use-client directive through tsdown's fileName banner callback only for dist/client.js, leaving the package root server-safe."

patterns-established:
  - "React package boundary: inert root and client-only subpath are distinct ESM entries from the first publishable manifest."
  - "Singleton topology: adapters consume the canonical core through peerDependencies while using the workspace link only for development."

requirements-completed: [ADP-01, PKG-04]

duration: 12min
completed: 2026-08-10
---

# Phase 09 Plan 02: React Package Skeleton Summary

**A publish-ready React adapter boundary now exposes server-safe root and client subpath contracts, with exact peer/dev singleton topology and a frozen React 19 toolchain.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-10T19:07:01Z
- **Completed:** 2026-08-10T19:18:33Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added the exact `@fullselfbrowsing/concierge-react` public manifest with root and `./client` ESM exports, a bounded publish allowlist, and no runtime dependency on core.
- Established strict TypeScript 7 TSX/type-test inputs and a neutral two-entry tsdown build whose callback banners only `client.js` with `"use client";`.
- Locked React 19.2.8, React DOM 19.2.8, researched type pins, and Testing Library React 16.3.2 while resolving core through the local development link.
- Preserved the immutable Phase 09 RED ledger at exactly eleven IDs and artifact SHA-256 `eb70c55e7f2030d71d442b32d43f2a18906b46a1623a9e5eb350eadda9bc3c6c`.

## Task Commits

Each task was committed atomically:

1. **Task 09-02-01: Create the bounded React package and client-subpath build contract** - `e113e31` (`chore`)
2. **Task 09-02-02: Reconcile and freeze the React skeleton dependency graph** - `28e0e26` (`chore`)

## Files Created/Modified

- `packages/concierge-react/package.json` - Public package metadata, export map, exact peer/dev topology, scripts, and verified React development pins.
- `packages/concierge-react/tsconfig.json` - Strict root TypeScript 7 extension with React JSX, source, and public type-test inputs.
- `packages/concierge-react/tsdown.config.ts` - Neutral ESM/dts build with external framework/core packages and client-only directive injection.
- `packages/concierge-react/LICENSE` - Byte-identical copy of the core package MIT license.
- `pnpm-lock.yaml` - React workspace importer and exact transitive development graph.

## Decisions Made

- Kept core out of `dependencies` and the bundle; the peer range supplies consumer identity while `workspace:*` supplies the local development link.
- Used tsdown 0.22.14's typed `fileName` banner callback instead of relying on incidental directive preservation, returning `undefined` for the root entry.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Context7 and its CLI fallback were unavailable. The banner callback signature was confirmed against the installed tsdown 0.22.14 declarations and the locked Phase 09 research.
- The Conductor checkout uses a `.git` file despite GSD sequential mode. `workflow.use_worktrees=false` was confirmed before committing on the existing unprotected branch; no refs or worktrees were changed.

## Verification

- `pnpm install --frozen-lockfile` - passed with no lockfile drift.
- Both plan-specified manifest/config/license assertions - passed.
- Exact dependency topology checks - passed with core as `workspace:^` peer, `workspace:*` development dependency, and `link:../concierge` lock resolution; no core registry package exists.
- Root TypeScript remained pinned at 7.0.2 and all exact React/type/testing development pins were present.
- `node scripts/phase-09-contract-check.mjs baseline-verify` - passed with exactly eleven persisted IDs and unchanged baseline artifact hash.
- `gsd-sdk query verify.artifacts .../09-02-PLAN.md` - passed all 3 declared artifacts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-03 can add the Svelte package skeleton against the same immutable baseline and package-boundary conventions.
- React lifecycle source and tests remain intentionally absent until Plan 09-04; there are no throwing or placeholder runtime stubs.
- No blockers remain.

## Self-Check: PASSED

All six referenced files exist, both task commits are present in repository history, and the immutable eleven-ID baseline was revalidated after the frozen install.

---
*Phase: 09-react-and-svelte-adapters*
*Completed: 2026-08-10*
