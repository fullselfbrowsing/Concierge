---
phase: 07-session-and-the-transport-seam
reviewed: 2026-08-09T05:28:48Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - packages/concierge/src/session.ts
  - packages/concierge/test/session-catalog.test.ts
  - scripts/phase-07-mutation-battery.mjs
findings:
  critical: 3
  warning: 2
  info: 0
  total: 5
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-09T05:28:48Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The post-gap build, focused C17 run, complete 22-test catalog suite, package typecheck, mutation-battery syntax check, self-test, `verify all`, and `verify inputs` all pass. The submitted revision is nevertheless not ready for verification. A hostile `setTools` accessor can still admit and answer work under the unpublished losing context B after it has queued winning context C; connected replay has the same missing context-supersession guard; and mutation execution still edits and restores the shared live worktree, so concurrent activity can both falsify evidence and lose another writer's changes. C17/M-07-C10 also prove only the clear half of the new abort-and-clear helper, and the supposedly exact C17 marker is reused by an unrelated factory smoke assertion.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Accessor-time work is dispatched and answered under unpublished context B

**Classification:** BLOCKER
**File:** `packages/concierge/src/session.ts:509-519, 757-776`
**Issue:** `processContext` installs `publicationPending`, `publishingContext = B`, and B's provisional epoch before it reads the consumer-controlled `setTools` accessor. `acceptBatch` then binds every accessor-time callback to B without checking whether B is still the requested context or whether the callable has even been captured. If the getter first calls `session.setContext(C)` and then emits a batch before returning, C is already the newest context and B is never published, yet the batch is recorded against B. The new helper aborts B's epoch, but `runWork` still dispatches accepted aborted records and an active Session still responds to returned rows. A built-artifact probe produced `{"stage":"c","publicationCount":1,"dispatches":[{"context":"b","aborted":true}],"responseCount":1}`: only catalog A reached the transport, C won, but unpublished B received a dispatch and a response. This violates the Plan 07-07 requirement that C become the sole admission authority and creates a stale-authority path across the transport boundary.
**Fix:** Do not make an accessor-read attempt eligible for publishing-context admission. Track an explicit invocation phase, or defer unbound batches while the accessor/transition is reentrant, and bind them only after the transition drain selects the winning context/epoch. At minimum, `acceptBatch` must never select `publishingContext` when it differs from `requestedContext` or before the captured callable has been revalidated. Extend C17 so the getter queues C and emits a batch before returning/throwing; assert that no dispatch ever observes B and that the accepted occurrence is handled under the contractually chosen winning authority.

### CR-02: Connected replay still invokes or fails on a callable superseded by context reentry

**Classification:** BLOCKER
**File:** `packages/concierge/src/session.ts:798-827`
**Issue:** The new `abandonSupersededPublication` guard is used only by `processContext`. `processConnected` snapshots no context generation and checks only the publication token, which does not change when a `setTools` getter queues a context during the outer transition drain. A replay getter that calls `setContext(C)` and returns a sentinel is therefore still invoked with stale catalog A; a probe observed `staleCalls: 1` and publication history `A, A, C`. If the getter queues C and then throws, the catch treats the replay as current, calls `failPublication`, stops the Session, and discards C; the built artifact exposed the fixed publication error, remained at stage A, and never published C. This is the same return/throw reentrancy class C17 closes for context publication, left open on the reconnect path.
**Fix:** Snapshot the requested generation/context when the replay attempt starts and revalidate both that snapshot and the publication token after the getter returns and in its catch. If context authority changed, clear only the replay attempt and let the queued context drain; do not invoke the returned function and do not fail the Session for a superseded getter throw. Add connected-replay return and throw regressions that queue C from the accessor and prove zero stale invocation, no fatal error, and final C authority.

### CR-03: Mutation runs can overwrite concurrent edits and certify mixed revision bytes

**Classification:** BLOCKER
**File:** `scripts/phase-07-mutation-battery.mjs:869-892, 1915-1951`
**Issue:** The lock is private to this mutation battery, but `executeMutant` still passes a target in the shared `ROOT` worktree to the mutation/restore wrapper and runs build/tests there. Editors, Git commands, and other agents do not acquire this lock. The before/after status and hash checks observe only endpoints, so an A-to-B-to-A change in any scoped source or test during the gate can make a mutant fail for transient unrelated bytes and still record `scopedTreeClean`, `targetRestored`, and the pre-run revision digest as green. Worse, the wrapper restores the live target from Git, so a concurrent edit to that target after the initial clean check is discarded. This is both a data-loss risk and a false-positive/false-negative evidence path; the immutable snapshot repair applies only to release gates, not to the 31 mutation rows or M-07-C10.
**Fix:** Execute every mutant in a disposable mutable snapshot or isolated temporary worktree pinned to the measured clean revision. Apply the literal, build, run the exact detector, restore, and run restored gates entirely there; never mutate or `git checkout` a file in the user's live worktree. Bind the evidence row to that snapshot digest and add an A-to-B-to-A/concurrent-writer negative control for mutation execution, parallel to the existing release-snapshot control.

## Warnings

### WR-01: M-07-C10 cannot detect loss of the helper's abort operation

**Classification:** WARNING
**File:** `packages/concierge/test/session-catalog.test.ts:1445-1506`; `scripts/phase-07-mutation-battery.mjs:391-409`
**Issue:** C17 emits its only batch after `session.setContext(B)` has completely returned. B's provisional epoch is therefore empty when `abandonSupersededPublication` runs, so `abortEpoch(epoch)` has no observable effect in the test. M-07-C10 removes both `abortEpoch` and `clearPublication`; C17 kills it because the missing clear leaves admission stuck, not because the abort disappeared. Removing only the helper's `abortEpoch(epoch)` call would leave C17 green, even though an accessor-time B occurrence would remain un-aborted and could execute stale handler work. The current 31/31 claim therefore does not discriminate both load-bearing operations named by the plan and security report.
**Fix:** Add a provisional-B occurrence before the getter queues C and assert that its composed signal is aborted, no live handler path runs, and its required cancellation result behavior is exact. Split the mutation so abort removal and clear removal are independently compiled and killed (or otherwise demonstrate an abort-only replacement fails the named case), then regenerate the register/evidence totals.

### WR-02: The exact C17 mutation marker is shared with an unrelated smoke assertion

**Classification:** WARNING
**File:** `packages/concierge/test/session-catalog.test.ts:1441-1444, 1543-1549`; `scripts/phase-07-mutation-battery.mjs:1553-1597`
**Issue:** C17 passes the same `[RED:C17:abandoned-publication-cleanup]` marker to both `requireFactory` and the load-bearing state assertion. The mutation harness accepts a failure by case id plus marker and does not verify the assertion location. A missing/broken `createSession` export can therefore produce the exact M-07-C10 fingerprint even though the abandoned-publication assertion never ran. This contradicts the plan's explicit requirement that C17 credit not come from a missing artifact or unrelated assertion, and the live-worktree race in CR-03 makes that scenario practical during a mutation run.
**Fix:** Reserve the RED marker exclusively for the load-bearing cleanup assertion. Give the factory smoke check a distinct non-RED message (or no custom marker), and add a self-test showing a factory/export failure cannot satisfy M-07-C10's expected fingerprint.

---

_Reviewed: 2026-08-09T05:28:48Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
