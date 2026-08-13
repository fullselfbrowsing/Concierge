---
phase: 09-react-and-svelte-adapters
plan: 04
subsystem: adapters
tags: [react, strictmode, context, ssr, typescript]

requires:
  - phase: 09-react-and-svelte-adapters
    provides: React package skeleton, immutable RED baseline, and explicit React lifecycle/artifact test routing from Plans 09-01 through 09-03
  - phase: 05-bridge-registry-and-the-no-bridge-path
    provides: Token-safe last-registration-wins BridgeRegistry semantics and exact registration unsubscriber
provides:
  - Canonical React provider and consumer over the exact supplied Concierge reference
  - Adapter-owned late-value getter and effect-only guarded BridgeRegistry registration
  - Real StrictMode, rerender, final-cleanup, type-surface, built-directive, and SSR-zero-registration proofs
affects: [09-react-and-svelte-adapters, react-adapter, adapter-ssr, package-evidence]

tech-stack:
  added: []
  patterns: [effect-owned registration, post-commit late-value ref, server-safe root and explicit client subpath]

key-files:
  created:
    - packages/concierge-react/src/index.ts
    - packages/concierge-react/src/client.tsx
    - packages/concierge-react/test/lifecycle.test.tsx
    - packages/concierge-react/test/artifact.test.ts
    - packages/concierge-react/test-d/public.test-d.ts
  modified:
    - packages/concierge-react/tsdown.config.ts

key-decisions:
  - "Keep the root entry inert and expose all runtime React bindings only from the canonical client subpath."
  - "Strip the source directive during bundling and re-add it with the client-only banner so the built client has exactly one directive while source remains correctly marked."

patterns-established:
  - "React late reads: applications pass plain current values; the adapter updates its own ref after commit and returns one stable getter."
  - "React registration: one effect runs singleton/version guards, registers once, and returns the exact core unsubscriber."

requirements-completed: [ADP-01, PKG-04]

duration: 15min
completed: 2026-08-10
---

# Phase 09 Plan 04: React Adapter Summary

**A thin React client binding now preserves exact core identity, survives real StrictMode cleanup ordering, reads the latest committed application value, and remains silent during server rendering.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-10T19:51:51Z
- **Completed:** 2026-08-10T20:06:54Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added the canonical `ConciergeProvider`, `useConcierge`, `useConciergeValue`, and `useConciergeBridge` client surface without constructing or mirroring core runtime behavior.
- Proved real StrictMode setup/cleanup/setup, retained stale cleanup immunity, same-object replacement, latest committed rerender reads, actionable missing-provider failure, and final null registry state in three lifecycle tests.
- Enforced reachable `assertSingleInstance()` plus an adapter-owned contract literal immediately before registration, returning the exact core unsubscriber from the effect.
- Built and typechecked the package, pinned public generic signatures, retained exactly one directive in the built client and none in the server-safe root, and proved server rendering performs zero registrations.
- Recorded positive collection evidence: React lifecycle 3/3 and React artifact 1/1.

## Task Commits

Each TDD task was committed as a RED/GREEN pair:

1. **Task 09-04-01: Implement exact Context, latest-commit getters, and StrictMode cleanup** — RED `8b81b57`, GREEN `bd43d1d`
2. **Task 09-04-02: Pin React public types, packed directive shape, guards, and server silence** — RED `ff7070b`, GREEN `3f2a3c7`

## Files Created/Modified

- `packages/concierge-react/src/client.tsx` — Client-only context, late-value, and guarded registration hooks.
- `packages/concierge-react/src/index.ts` — Inert server-safe root metadata/types entry.
- `packages/concierge-react/test/lifecycle.test.tsx` — Real provider, StrictMode, late-value, and cleanup lifecycle proof.
- `packages/concierge-react/test/artifact.test.ts` — Built directive, guard ordering, server import, and zero-registration assertions.
- `packages/concierge-react/test-d/public.test-d.ts` — Positive and negative public generic type contract.
- `packages/concierge-react/tsdown.config.ts` — Source-directive deduplication plus the existing client-only output banner.

## Decisions Made

- Kept the provider free of registration side effects so nested context lookup and registry mutation remain separate responsibilities.
- Used post-commit `useEffect` ref mirroring, not render-time assignment, so a getter exposes only committed state.
- Preserved the required source directive while making the build transform deterministically emit one client directive rather than relying on incidental bundler behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. Built client initially contained both the retained source directive and configured banner**
- **Found during:** Task 09-04-02 artifact GREEN
- **Issue:** The skeleton's explicit output banner combined with normal source preservation, producing two client directives instead of the required one.
- **Fix:** Added a minimal MagicString transform that removes only the source prologue before the existing filename-sensitive banner is applied.
- **Files modified:** `packages/concierge-react/tsdown.config.ts`
- **Verification:** Package build succeeds; built client directive count is exactly one; artifact suite passes 1/1; root entry contains none.
- **Committed in:** `3f2a3c7`

---

**Total deviations:** 1 auto-fixed blocking transform issue.
**Impact on plan:** The fix preserves the locked client-only directive contract without changing the public API or adapter responsibility.

## Issues Encountered

- The executor stream disconnected after both task GREEN commits but before SUMMARY/tracking closeout. The orchestrator reran every plan-close command successfully and created this summary from the committed work.
- tsdown still reports its pre-existing `external` option deprecation warning; the build, ATTW, and publint gates are green and dependency externalization remains correct.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- React runtime and artifact seams are ready for the shared Astro and exact-tarball proofs.
- Plan 09-05 can implement the Svelte half; the full recursive workspace build becomes authoritative once that intentionally absent source lands.

---
*Phase: 09-react-and-svelte-adapters*
*Completed: 2026-08-10*
