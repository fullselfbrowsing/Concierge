---
phase: 07-session-and-the-transport-seam
fixed_at: 2026-08-09T06:09:05Z
review_path: .planning/phases/07-session-and-the-transport-seam/07-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-08-09T06:09:05Z
**Source review:** `.planning/phases/07-session-and-the-transport-seam/07-REVIEW.md`
**Iteration:** 1 (post-gap review)

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Accessor-time work is dispatched and answered under unpublished context B

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`
**Commits:** 20f2da6, b8cdcf6
**Applied fix:** Added an explicit captured-callable admission phase and an unbound accessor-time queue. Getter-time occurrences cannot bind to publishing context B. The transition drain binds them only after final authority is selected, while a pre-supersession occurrence retains B's provisional cancellation and is dispatched under C with the exact aborted result. C17 now emits one batch before queuing C and one after, for both getter-return and getter-throw paths, and proves zero B authority, exact cancellation, one live C handler, and exact responses.
**Verification:** Built package artifact, package typecheck, focused C17 regression, complete 23-test catalog suite, M-07-C10 abort-only kill, and M-07-C11 clear-only kill all passed.

### CR-02: Connected replay still invokes or fails on a callable superseded by context reentry

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`
**Commit:** 20f2da6
**Applied fix:** Connected replay now snapshots requested generation/context as well as the publication token. It revalidates all three after the `setTools` getter returns and in the getter catch. Superseded return and throw paths clear only the matching replay attempt, never invoke the stale callable, never fail the Session, and let queued C drain to final authority. A built-artifact regression proves zero stale invocation, no fatal error or diagnostic, exact A→C publication, final C stage, and one later C dispatch/response for both paths.
**Verification:** Focused built-artifact regression passed for return and throw, followed by the complete catalog suite and final release suite.

### CR-03: Mutation runs can overwrite concurrent edits and certify mixed revision bytes

**Status:** fixed: requires human verification
**Files modified:** `scripts/phase-07-mutation-battery.mjs`
**Commits:** d53c99d, 8fa87f7, 52b4725
**Applied fix:** Every mutant now runs in a disposable mutable snapshot copied from the measured revision inputs. Dependency installation, literal replacement, build, exact detector, source restoration, restored build/test/type/package gate, and digest checks all run inside that snapshot. No live ROOT target is mutated or restored. Evidence records the snapshot revision digest and is green only if the live scoped revision remains stable. The top-level Git lock is resolved lazily so snapshot gate processes need no repository metadata.
**Negative control:** The self-test performs an A→B→A live-target sequence while a snapshot mutant remains pinned, proves the concurrent B writer survives snapshot restoration, rejects B as the measured digest, and proves gate reads never mix live bytes.
**Verification:** Node syntax check and battery self-test passed. All 32 final-revision rows report byte-identical snapshot restoration, restored-green gates, stable live scope, and no infrastructure errors.

### WR-01: M-07-C10 cannot detect loss of the helper's abort operation

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`, `scripts/phase-07-mutation-battery.mjs`
**Commits:** b8cdcf6, d53c99d
**Applied fix:** Clearing an accessor attempt now detaches its unbound occurrences from the abandoned epoch only after the helper has had the opportunity to abort them. C17's pre-C occurrence therefore preserves cancellation only when the helper abort is present. M-07-C10 removes abort only; M-07-C11 removes clear only. Each compiles, runs exactly C17, and is independently killed by the exact load-bearing marker.
**Verification:** M-07-C10 and M-07-C11 are separately green with one detector test each, exact C17-only failure fingerprints, distinct revision digests, restored snapshots, and restored green gates.

### WR-02: The exact C17 mutation marker is shared with an unrelated smoke assertion

**Status:** fixed
**Files modified:** `packages/concierge/test/session-catalog.test.ts`, `scripts/phase-07-mutation-battery.mjs`
**Commits:** 20f2da6, d53c99d
**Applied fix:** `[RED:C17:abandoned-publication-cleanup]` is now used only by C17's load-bearing state assertion. The factory smoke check uses `[SMOKE:C17:create-session-factory]`. Battery self-tests synthesize both a factory assertion failure and a missing-export suite failure and prove neither can satisfy the expected fingerprint for M-07-C10 or M-07-C11.
**Verification:** Named-marker validation, factory/export negative controls, C17 focused execution, and both exact mutants passed.

## Aggregate Verification

- `pnpm --filter @fullselfbrowsing/concierge build` — passed.
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — passed.
- Focused C17 plus connected-replay getter regression — 2/2 passed against `dist`.
- `pnpm exec vitest run packages/concierge/test/session-catalog.test.ts` — 23/23 passed.
- `node --check scripts/phase-07-mutation-battery.mjs` — passed.
- `node scripts/phase-07-mutation-battery.mjs self-test` — passed, including snapshot/concurrent-writer and factory/export fingerprint negative controls.
- Mutation evidence — 32/32 green: 11 catalog, 9 routing, 8 lifecycle, 2 diagnostics, 2 package (`11/9/8/2/2`).
- Register digest — `9104978e646b4d6a949562f485a28cdc46f76034f06cb0e0cc836845c976fc03`.
- `node scripts/phase-07-mutation-battery.mjs verify inputs` — 3/3 protected files byte-identical.
- `node scripts/phase-07-mutation-battery.mjs verify ledgers` — passed; all seven immutable release commands exited 0.
- Release evidence — digest `d08573270b89af7dd3c7fd4cec401ecf7c085825509bf963645315b872afb771`; 16 runtime files, 324 passed, 324 total, 0 failed/pending/todo.

## Generated Artifact Commit and Handoff

**Commit:** 3cb79fa

The regenerated `07-MUTATION-REGISTER.json`, `07-MUTATION-EVIDENCE.json`, and `07-VALIDATION.md` were committed together after the final verification rerun. This `07-REVIEW-FIX.md` report remains uncommitted for the central orchestrator's documentation commit, as required by the fixer workflow.

## Skipped Issues

None.

## Residual Uncertainty

CR-01, CR-02, CR-03, and WR-01 change reentrant or evidence-execution logic, so they retain the required human-verification flag despite exact built-artifact regressions, independently killed mutants, full-suite coverage, and immutable release proof. `07-REVIEW.md` remains `issues_found`; SECURITY.md and VERIFICATION.md were intentionally not changed because they require independent re-review/re-audit.

---

_Fixed: 2026-08-09T06:09:05Z_
_Fixer: Codex (gsd-code-fixer)_
_Iteration: 1_
