---
phase: 10-close-v0-1-release-certification-and-evidence-gaps
plan: 02
subsystem: catalog-validation
tags: [catalog, diagnostics, json-schema, explain, verification-history]
requires:
  - phase: 03-action-declaration-and-build-time-validation
    provides: aggregate catalog validation and stable CatalogIssue diagnostics
  - phase: 04-stages-catalog-assembly-and-explain
    provides: frozen emitted catalogs and structured explain output
  - phase: 06-dispatcher
    provides: real result normalization and complete mutation evidence
provides:
  - indexed aggregate diagnostics for unreadable action declarations
  - current built-byte evidence for detached data-only JSON Schema publication
  - mechanical explain and CAT-03 actionability evidence
  - append-only correction of superseded Phase 3 and Phase 4 conclusions
affects: [phase-10-mutation-evidence, release-certification, milestone-audit]
tech-stack:
  added: []
  patterns: [pre-property-runtime-classification, indexed-aggregate-diagnostics, append-only-verifier-corrections]
key-files:
  created:
    - .planning/phases/10-close-v0-1-release-certification-and-evidence-gaps/10-02-SUMMARY.md
  modified:
    - packages/concierge/src/catalog.ts
    - packages/concierge/src/contract.ts
    - packages/concierge/test/catalog.test.ts
    - packages/concierge/test-d/catalog.test-d.ts
    - .planning/phases/03-action-declaration-and-build-time-validation/03-VERIFICATION.md
    - .planning/phases/04-stages-catalog-assembly-and-explain/04-VERIFICATION.md
key-decisions:
  - Identify unreadable declarations by zero-based input index instead of inventing an action name.
  - Treat exact structured fields, stable codes, truthful subjects, and actionable fixes as sufficient diagnostic legibility evidence.
  - Preserve historical verifier findings verbatim and append dated current-byte corrections.
requirements-completed: [CAT-02, CAT-03, CAT-06, SEC-03, DX-01, DX-03]
metrics:
  duration: 7m
  completed: 2026-08-12
---

# Phase 10 Plan 02: Catalog Diagnostics and Current-Byte Evidence Summary

Every unreadable action declaration now reaches the ordinary aggregate diagnostic channel by input index, and the milestone has current built-byte proof for schema detachment, explain structure, and actionable consent diagnostics.

## Performance

- **Started:** 2026-08-12T17:22:23Z
- **Completed:** 2026-08-12T17:29:26Z
- **Duration:** 7 minutes
- **Tasks:** 2
- **Files changed:** 6

## Accomplishments

- Added exact built-artifact and type regressions for null, undefined, primitive, and hostile callable declarations, ordered aggregation after malformed input, and the closed eleven-member issue-code union.
- Added the stable `invalid_declaration` diagnostic with a truthful zero-based declaration subject, fixed problem text, and actionable repair without reading candidate properties.
- Reconfirmed that explicit JSON Schema accessors execute zero times and emitted parameters are detached and frozen on current built bytes.
- Mechanically closed explain/CAT-03 legibility with exact structured-field, bridge-tristate, stable-code, referrer/target, and distinct-fix assertions.
- Corrected over-broad live tree-shaking prose and appended dated corrections to the Phase 3 and Phase 4 verifier records without rewriting their historical findings.

## Task Commits

1. **Task 10-02-01: Aggregate unreadable declarations and pin actionable diagnostics** — `0d7b366` (test), `ee0f185` (fix)
2. **Task 10-02-02: Re-verify SEC-03 on current bytes and append historical corrections** — `edc7495` (docs)

## Files Created or Modified

- `packages/concierge/src/catalog.ts` — classifies every non-object declaration before property access, aggregates an indexed issue, and states the qualified retained-runtime-reference rule.
- `packages/concierge/src/contract.ts` — qualifies module-evaluation elision claims around retained runtime references.
- `packages/concierge/test/catalog.test.ts` — pins exact invalid-declaration, CAT-03 code/subject/fix, aggregation, and zero-accessor behavior.
- `packages/concierge/test-d/catalog.test-d.ts` — pins both directions of the exact eleven-member `CatalogIssueCode` equality.
- `.planning/phases/03-action-declaration-and-build-time-validation/03-VERIFICATION.md` — appends the current proof that supersedes the historical raw-null-TypeError exception.
- `.planning/phases/04-stages-catalog-assembly-and-explain/04-VERIFICATION.md` — appends current SEC-03, explain/CAT-03, and Phase 6 dispatcher evidence.

## Decisions Made

- Used `declaration at index N` as the structured subject for values that cannot truthfully supply an action name.
- Rejected callable declarations before any property access; callable validator support remains inside the `schema` field of an otherwise readable action object.
- Left `json-schema.ts` and `concierge.test.ts` unchanged after the focused S15 probe passed, avoiding a duplicate clone or snapshot implementation.
- Closed the obsolete Phase 4 dispatch-stub warning by citing Phase 6 R37-R45/Q-series normalization and 57/57 mutation evidence rather than recreating a test for removed code.

## Deviations from Plan

None — the plan executed as written.

## Issues Encountered

- The preferred fast text-search binary was unavailable in this environment, so equivalent scoped searches used the repository's available shell tools. This did not change implementation or verification scope.

## Verification

- Core build: passed, including publint and attw.
- Complete catalog suite: 35 tests passed.
- Core typecheck: passed.
- Focused SEC-03/explain selector: 8 tests passed.
- Focused CAT-03/invalid-declaration selector: 3 tests passed.
- `json-schema.ts` and `concierge.test.ts`: zero diff.
- Source and documentation diff check: passed.

## User Setup Required

None.

## Next Phase Readiness

- Indexed catalog diagnostics and current-byte SEC-03/explain evidence are ready for the canonical Phase 10 mutation register in Plan 10-05.
- Wave 1 continues with Plan 10-03's package-check authority classification and generated Astro-state cleanup.

## Self-Check: PASSED

All three task commits resolve, all six claimed modified files exist, both verifier addenda follow their original footers, and the two source files forbidden from repair remain byte-identical.

---
*Phase: 10-close-v0-1-release-certification-and-evidence-gaps*
*Completed: 2026-08-12*
