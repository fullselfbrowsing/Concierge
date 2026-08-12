---
phase: 06-dispatcher
plan: 05
subsystem: runtime
tags: [typescript, dispatcher, toolbatch, serial-execution, abort-signal, immutability]

# Dependency graph
requires:
  - phase: 06-dispatcher
    plan: 02
    provides: "Q01-Q14 batch contracts for parsing, ordering, metadata, abort completeness, dedup reuse, and immutable rows"
  - phase: 06-dispatcher
    plan: 04
    provides: "Stage-authorized single-call dispatch with validation, commit timing, bridge resolution, deduplication, and sanitization"
provides:
  - "Transport-independent dispatchBatch over the exact existing single-call dispatcher"
  - "Stable serial ToolBatch parsing with complete immutable callId/result correlation rows"
  - "Truthful public documentation for direct application-owned single and batch loops"
affects: [06-06, 07-session-and-transport-seam]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decorated-copy stable ordering by outputIndex and original caller position"
    - "Serial batch delegation through the exact cached single-call dispatch function"
    - "Frozen batch container and frozen inline correlation rows without a new public type"

key-files:
  created: []
  modified:
    - packages/concierge/src/dispatch.ts
    - packages/concierge/src/concierge.ts
    - packages/concierge/src/types.ts
    - packages/concierge/src/index.ts

key-decisions:
  - "Batch execution delegates every live call to the existing cached dispatch function; it duplicates none of the stage, validation, timing, bridge, handler, normalization, or sanitization pipeline."
  - "Calls are ordered from a decorated copy by outputIndex and original position, making tie stability explicit without mutating caller input."
  - "After abort, only calls that have not started receive fresh authored aborted results; the loop still emits one frozen correlated row per input."

patterns-established:
  - "Batch boundary: copied stable sort -> per-call abort check -> narrow JSON parse -> explicit InvocationMeta -> serial await dispatch -> frozen row."
  - "Public batch output remains an inline readonly shape, so one method is added without adding an exported name."

requirements-completed: [DSP-06, DSP-07, DSP-08, SEC-06, TRN-04]

# Metrics
duration: 6min
completed: 2026-08-06
---

# Phase 6 Plan 05: Stable Serial ToolBatch Execution Summary

**Transport-independent ToolBatch execution now parses and orders calls safely, delegates them serially through the exact single-call boundary, and returns complete frozen correlation rows even after abort.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-06T04:13:24Z
- **Completed:** 2026-08-06T04:19:51Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Turned Q01-Q14 green with copied stable ordering, maximum handler concurrency of one, narrow JSON parse fallback, and exact metadata forwarding.
- Reused the existing single-call cache for every live batch call, preserving repeated-callId deduplication and all completed stage, validation, timing, bridge, handler, normalization, and sanitizer behavior.
- Returned one frozen `{ callId, result }` row per sorted input, including authored `aborted` rows for every unstarted call after cancellation, inside a frozen final array.
- Added the exact context-first `dispatchBatch` member without exporting a row alias or helper and documented direct application-loop use without a Transport.
- Preserved the complete single-call contract and the package's exact 65-name public surface.

## Task Commits

Each task was committed atomically:

1. **Task 1 (06-05-T1): Implement stable serial ToolBatch execution and immutable correlation rows** — `60321fd` (feat)
2. **Task 2 (06-05-T2): Document the final direct-loop and batch boundary without widening exports** — `2addeb5` (docs)

## Files Created/Modified

- `packages/concierge/src/dispatch.ts` — stable copied ordering, narrow raw-argument parsing, serial single-dispatch delegation, abort completion, and frozen result assembly.
- `packages/concierge/src/concierge.ts` — instance-owned async `dispatchBatch` method wired to the exact non-async single-call `dispatch` function.
- `packages/concierge/src/types.ts` — exact inline readonly batch signature plus direct-loop, ordering, immutability, and boundary documentation.
- `packages/concierge/src/index.ts` — shipped entrypoint prose for direct single/batch use and the still-unimplemented Session, transport-routing, telemetry, and consent layers.

## Decisions Made

- Kept all live-call policy in the completed single-call dispatcher. Batch owns only parsing, ordering, metadata projection, serial orchestration, correlation, and remaining-call abort settlement.
- Made tie stability independent of host sort details by decorating the copied call list with original positions and using those positions as the secondary key.
- Synthesized `aborted` only before an unstarted call; an abort during the current call remains the single dispatcher’s responsibility, preserving the current call's truthful result.
- Kept the correlation row inline and internal helpers off the package barrel, so `Concierge` gains one method while the public name count remains unchanged.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Verification Evidence

| Gate | Result |
|---|---|
| `pnpm build && pnpm exec vitest run packages/concierge/test/dispatcher-batch.test.ts packages/concierge/test/dispatcher.test.ts` | PASS; 68/68 batch and single-call tests |
| `pnpm --filter @fullselfbrowsing/concierge typecheck` | PASS; no remaining Phase 6 diagnostics |
| `pnpm build && pnpm typecheck && pnpm test` | PASS; 211/211 tests across 11 files |
| Export-surface and artifact suites | PASS; 17/17 tests and exactly 65 names = 51 types + 14 values |
| Batch source fences | PASS; no `Promise.all`, loop `break`, `batch_aborted`, named batch-result type, or metadata cast |
| `git diff --check` | PASS |

## Known Stubs

None. The batch API, parser, executor, correlation envelope, abort completion, and direct-loop documentation are fully wired.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-06 can run the completed batch mutation register and close Phase 6 validation evidence.
- Phase 7 can route `Transport.onToolBatch` through this method and respond by `callId` without recreating parsing, ordering, dispatch, or abort logic.
- No package, authentication, external service, or architectural blocker remains.

## Self-Check: PASSED

- All four key implementation/documentation files and this summary exist on disk.
- Task commits `60321fd` and `2addeb5` exist in git history.
- The copied requirement list, test totals, export counts, and verification claims match the executed gates.

---
*Phase: 06-dispatcher*
*Completed: 2026-08-06*
