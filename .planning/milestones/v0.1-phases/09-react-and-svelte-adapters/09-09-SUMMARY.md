---
phase: 09-react-and-svelte-adapters
plan: 09
subsystem: testing
tags: [typescript-ast, adapter-boundary, line-budget, mutation-controls]

requires:
  - phase: 09-react-and-svelte-adapters
    provides: Canonical two-file React adapter production surface
  - phase: 09-react-and-svelte-adapters
    provides: Canonical two-file Svelte adapter production surface with rune-aware source
provides:
  - Exact recursive production inventory equality for both adapter packages
  - Independent authored-line budgets of at most 150 lines per adapter
  - TypeScript 7 AST rejection of every loop form and forbidden core-owned responsibility
  - Assertion-specific scratch controls for inventory, budget, parser, loop, and responsibility failures
affects: [09-react-and-svelte-adapters, ADP-03, mutation-proof, release-evidence]

tech-stack:
  added: []
  patterns: [closed recursive inventory, lexical authored-line counting, TypeScript 7 AST traversal, isolated negative controls]

key-files:
  created:
    - scripts/phase-09-adapter-budget.mjs
  modified: []

key-decisions:
  - "Treat the four canonical adapter files as closed inventories and discover broad production-source suffixes recursively so moving code cannot escape either independent 150-line budget."
  - "Use the pinned TypeScript 7 unstable sync and AST exports with explicit TS/TSX ScriptKinds, and reject syntactic diagnostics before responsibility traversal."
  - "Require every scratch mutant to fail with its own GateError code and identifying message so a generic parser failure cannot count as a successful loop or responsibility kill."

patterns-established:
  - "Closed budget boundary: expected nonempty regular files must exactly equal recursive production discovery before any line total is accepted."
  - "Syntax-aware ownership boundary: inspect imports, calls, constructors, and identifiers while leaving forbidden prose inside comments and strings inert."
  - "Discriminating self-test: restore a known-valid tree around isolated mutations and assert the exact diagnostic for each killed mutant."

requirements-completed: [ADP-03]

duration: 20m 11s
completed: 2026-08-10
---

# Phase 09 Plan 09: Adapter Budget and Responsibility Gate Summary

**A deterministic local gate now proves both adapter packages remain exact two-file shells under independent 150-line budgets and contain no loop statements or core-owned control-flow responsibilities.**

## Performance

- **Duration:** 20m 11s
- **Started:** 2026-08-11T03:24:46Z
- **Completed:** 2026-08-11T03:44:57Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added exact recursive discovery for the two React and two Svelte production files, with missing, empty, symlinked, or unlisted source rejected before measurement.
- Added a stateful lexical scanner that excludes blank/comment-only lines while preserving comment-like content inside single, double, and template strings.
- Enforced separate integer budgets and detailed file subtotals: React measures 74/150 authored lines and Svelte measures 56/150.
- Parsed all four canonical TypeScript, TSX, and rune-aware Svelte TypeScript files through the pinned TypeScript 7 AST API.
- Rejected `ForStatement`, `ForInStatement`, `ForOfStatement`, `WhileStatement`, and `DoStatement`, plus core construction, catalog/stage matching, session/consent ownership, transport routing, scheduling, retry/cache/queue state, result sanitation, and state containers.
- Added isolated scratch mutants for all five loop kinds and twelve responsibility cases, with distinct inventory, threshold, parser, CLI, and valid false-positive controls.

## Task Commits

1. **Task 09-09-01 RED: Specify exact inventory and budget failures** - `2c03f5c` (`test`)
2. **Task 09-09-01 GREEN: Enforce exact adapter line budgets** - `b7d3742` (`feat`)
3. **Task 09-09-02 RED: Specify AST responsibility failures** - `af4f43e` (`test`)
4. **Task 09-09-02 GREEN: Enforce the AST responsibility boundary** - `58bb2b5` (`feat`)

## Files Created/Modified

- `scripts/phase-09-adapter-budget.mjs` - Fixed-mode CLI, exact inventories, lexical line counter, TypeScript 7 AST policy, reports, and validated temporary-tree self-tests.

The four canonical adapter production files were read and measured but not modified.

## Decisions Made

- Discovered `.ts`, `.tsx`, `.svelte.ts`, `.svelte`, and other JavaScript/TypeScript production suffixes under each `src` tree while ignoring only generated declarations/maps and dedicated test/fixture directories. This keeps the explicit four-file inventories closed against extension-based hiding.
- Used TypeScript 7's installed `typescript/unstable/sync` project API and `typescript/unstable/ast` enums because the pinned native compiler package no longer exposes the legacy compiler surface from its root entry point.
- Checked syntactic diagnostics before traversing nodes, then required exact `FORBIDDEN_LOOP` or `FORBIDDEN_RESPONSIBILITY` diagnostics from each mutant. The malformed-source control proves a generic `AST_PARSE` failure cannot satisfy those assertions.
- Classified only syntax nodes and symbol names, not raw source text, so forbidden words in comments and string/template content remain a valid negative control.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Context7 and its CLI fallback were unavailable. Version-sensitive compiler behavior was validated against the exact installed `typescript@7.0.2` package exports and runtime API before implementation.
- The Conductor checkout uses a `.git` file despite sequential mode. The configured `workflow.use_worktrees=false` exception and intended shared branch were honored; no refs, branches, or worktrees were changed.

## TDD Gate Compliance

- Task 09-09-01 has a failing RED specification commit (`2c03f5c`) before its passing GREEN implementation (`b7d3742`).
- Task 09-09-02 has a failing RED AST/control commit (`af4f43e`) before its passing GREEN implementation (`58bb2b5`).
- Both RED failures used dedicated unimplemented-gate diagnostics, and neither task advanced to GREEN until the expected failure was observed.

## Verification

- `node --check scripts/phase-09-adapter-budget.mjs` - passed.
- `node scripts/phase-09-adapter-budget.mjs check` - passed with exactly four files: React 74/150 and Svelte 56/150.
- `node scripts/phase-09-adapter-budget.mjs self-test` - passed all CLI, lexical, vacuity, missing-file, unlisted-file, over-limit, parser, five loop-kind, twelve responsibility, and restored-tree controls.
- Malformed TypeScript failed specifically with `AST_PARSE`; each loop mutant failed with its exact `SyntaxKind`; each responsibility mutant failed with its expected category and symbol.
- `git diff --name-status 1f4d304..58bb2b5` - only the budget gate was added; no adapter production file changed.
- Stub scan - the only empty arrays are internal accumulators and the intentionally forbidden queue fixture; no production stub or unwired data path exists.
- Threat-surface scan - no network endpoint, authentication path, schema boundary, or unplanned trust boundary was introduced; filesystem discovery and syntax parsing are covered by the plan threat model.

## User Setup Required

None - the gate uses the repository's already-pinned TypeScript dependency and local temporary storage.

## Next Phase Readiness

- Plans 09-12 and 09-13 can invoke this fixed-mode gate and mutate its exact B1 boundary without relying on self-reported adapter counts.
- ADP-03 now has a deterministic local ownership and size gate; no blockers remain.

## Self-Check: PASSED

The implementation and summary are nonempty, all four TDD commits exist in repository history, the canonical adapters pass the completed gate, and no planned artifact is missing.

---
*Phase: 09-react-and-svelte-adapters*
*Completed: 2026-08-10*
