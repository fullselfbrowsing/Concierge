---
phase: 06-dispatcher
plan: 07
subsystem: runtime
tags: [typescript, dispatcher, validation, deduplication, toolbatch, security]

requires:
  - phase: 06-dispatcher
    provides: Dispatcher runtime, batch execution, fallback-key encoding, and verification gaps from Plans 04-06
provides:
  - Total, reasonless handling of malformed invocation metadata with raw callId correlation preserved
  - Deliberately unkeyable BigInt arguments without weakening tagged fallback-key encoding
  - Malformed batch JSON routed through ordinary action validation as an empty object
affects: [06-08, 07-session, 08-consent]

tech-stack:
  added: []
  patterns:
    - Snapshot and validate invocation metadata primitives before deriving retry keys
    - Treat unsupported fallback-key values as deliberately unkeyable instead of coercing them
    - Substitute parse failures and delegate them to the same validator used by ordinary dispatch

key-files:
  created: []
  modified:
    - packages/concierge/src/concierge.ts
    - packages/concierge/src/dispatch.ts
    - packages/concierge/src/types.ts
    - packages/concierge/test/dispatcher-batch.test.ts
    - packages/concierge/test/dispatcher.test.ts

key-decisions:
  - "Invocation metadata primitive validation precedes retry-key derivation; invalid metadata returns a fixed, reasonless authored failure."
  - "BigInt deliberately produces no fallback key while the tagged encoder remains unchanged for supported values."
  - "Malformed ToolCall JSON becomes an empty object and proceeds through ordinary single-call validation."

requirements-completed: [DSP-01, DSP-02, DSP-05, DSP-06, DSP-07, SEC-06, TRN-04]

duration: 11m 23s
completed: 2026-08-07
---

# Phase 6 Plan 07: Dispatcher Contract Gap Closure Summary

Malformed metadata is now total and correlation-safe, BigInt arguments degrade to an unkeyed dispatch, and malformed batch JSON reaches the action validator without bypassing the established dispatcher contracts.

## Performance

- **Duration:** 11m 23s
- **Started:** 2026-08-07T17:30:12Z
- **Completed:** 2026-08-07T17:41:35Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Hardened invocation metadata snapshotting against invalid primitive values, symbols, and throwing getters while preserving raw `callId` correlation in batch results.
- Restored the intended BigInt no-key degradation path without changing supported tagged fallback-key encoding or Promise identity behavior.
- Routed malformed `ToolCall.arguments` JSON through ordinary action validation as `{}`, keeping later batch calls independent and executable.

## Task Commits

Each task was completed with a RED test commit followed by a GREEN implementation commit:

1. **Task 1: Make malformed invocation metadata total without weakening correlation**
   - `051e318` — `test(06-07): add failing malformed metadata regressions`
   - `ac628e6` — `fix(06-07): contain malformed invocation metadata`
2. **Task 2: Restore BigInt no-key degradation while retaining tagged fallback keys**
   - `e27bde3` — `test(06-07): restore failing BigInt no-dedup contract`
   - `8f274da` — `fix(06-07): restore BigInt fallback-key degradation`
3. **Task 3: Route malformed batch JSON through ordinary validation**
   - `afec757` — `test(06-07): restore failing malformed JSON validation contract`
   - `0137700` — `fix(06-07): route malformed batch JSON through validation`

## Files Created/Modified

- `packages/concierge/src/concierge.ts` — validates snapshotted invocation metadata primitives before dispatcher keying.
- `packages/concierge/src/dispatch.ts` — makes non-string `callId` unkeyable and BigInt unsupported by fallback-key canonicalization.
- `packages/concierge/src/types.ts` — documents malformed batch JSON validation behavior and BigInt no-key degradation.
- `packages/concierge/test/dispatcher.test.ts` — adds R68 and updates R06 contract coverage.
- `packages/concierge/test/dispatcher-batch.test.ts` — adds Q17 and updates Q04 malformed-JSON coverage while retaining Q16.

## Decisions Made

- Validate metadata fields after a single guarded snapshot so getters are read once and no malformed primitive reaches retry-key derivation.
- Keep invalid metadata failures reasonless and authored, matching the dispatcher security contract instead of exposing internal failure detail.
- Preserve the tagged fallback-key encoder for supported values; only BigInt, cyclic, and aliased shapes deliberately fall back to no key.
- Treat malformed JSON as `{}` and let the registered action validator decide the public failure, rather than synthesizing a parallel batch-only error path.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None in the runtime implementation or verification suite.

## Verification

- Task 1 RED reproduced both failures: malformed metadata could reject or throw, and symbol `callId` key derivation was unsafe.
- Task 2 RED proved BigInt arguments were incorrectly deduplicated under a fallback key.
- Task 3 RED proved malformed JSON bypassed the action validator.
- Final dispatcher verification passed: 2 test files, 89 tests.
- `pnpm build` and `pnpm --filter @fullselfbrowsing/concierge typecheck` passed.
- Static scope checks confirmed exactly the five declared files changed, no new public exports or `ReasonCode` members, and no telemetry or error-hook surface was introduced.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-08 can regenerate mutation and evidence ledgers against the closed dispatcher contracts.
- No blockers remain for the Phase 6 verification refresh.

## Self-Check: PASSED

All five implementation/test files and this summary exist, and all six task commit hashes are present in git history.
