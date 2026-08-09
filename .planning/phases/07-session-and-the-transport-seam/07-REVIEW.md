---
phase: 07-session-and-the-transport-seam
reviewed: 2026-08-09T06:28:06Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - packages/concierge/src/session.ts
  - packages/concierge/test/session-catalog.test.ts
  - scripts/phase-07-mutation-battery.mjs
findings:
  critical: 3
  warning: 1
  info: 0
  total: 4
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-09T06:28:06Z

**Depth:** standard

**Files Reviewed:** 3

**Status:** issues_found

## Summary

The five findings from the preceding review are closed in their exact reported forms. C17 now prevents unpublished B authority for getter-time work and independently observes the abort and clear operations; connected replay getters that queue C no longer invoke a returned stale callable or fail the Session for a superseded getter throw; mutation execution no longer writes or restores the live target; M-07-C10 and M-07-C11 are distinct one-test mutants with separate revision digests; and the C17 RED marker is no longer shared with its factory smoke check.

| Prior finding | Disposition | Independent evidence |
|---|---|---|
| CR-01 | Closed as reported | C17 covers batches before and after C is queued in both getter-return and getter-throw modes, with zero B invocation/authority, one aborted pre-C result, and one live post-C result. |
| CR-02 | Closed as reported | The connected-replay regression covers superseded getter return and throw, with zero stale invocation, no fatal error/diagnostic, A to C publication, and later C routing. |
| CR-03 | Closed as reported | `executeMutant` mutates, gates, restores, and rechecks only `snapshot.root`; no production mutation path writes `join(ROOT, mutant.target)`. The snapshot/concurrent-writer self-test passed. |
| WR-01 | Closed | M-07-C10 removes abort only; M-07-C11 removes clear only. Both current rows ran exactly C17, matched its exact marker, have distinct revision digests, and restored green. |
| WR-02 | Closed | C17 uses `[SMOKE:C17:create-session-factory]` for the factory check, reserves its RED marker for the load-bearing assertion, and the self-test rejects both factory and suite/export failures. |

The repair nevertheless introduced a second queue for accessor-time occurrences without preserving their global arrival position or complete admission identity. Three built-artifact probes show that this reverses FIFO, executes a confirmed-A replay occurrence live under C, and drops an accepted post-reentry occurrence during stop. The mutation script also overstates an endpoint comparison as proof that the live tree was untouched throughout a run. Security re-audit and formal phase verification must not proceed until the three blockers are fixed and independently re-reviewed.

Verification passed for the behaviors represented by the current suite: package build, package typecheck, the focused C17 plus connected-replay regression (2/2), the complete catalog suite (23/23), mutation-battery syntax, mutation self-test, `verify all` (32/32), and `verify inputs` (3/3). These green gates do not exercise the three hostile orderings below. `verify ledgers` was not rerun because it rewrites release evidence; the committed release object remains present and structurally valid, but another ledger run cannot override the reproduced runtime failures.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The separate unbound queue reverses accessor-time FIFO

**Classification:** BLOCKER

**File:** `packages/concierge/src/session.ts:148-150, 545-569, 659-671`

**Issue:** A batch emitted while the `setTools` accessor is being read is appended to `unboundBatches`. Once the callable is captured, a later batch emitted by that callable is appended directly to `workQueue`. `bindUnboundBatches` runs only after publication confirmation and appends the earlier accessor occurrence to the end of `workQueue`, behind the later callable occurrence. A built-artifact probe emitted `getter-first` in the getter and `callable-second` in the returned function and observed:

```json
{
  "dispatches": ["callable-second", "getter-first"],
  "responses": ["callable-second", "getter-first"]
}
```

Both occurrences used B and were non-aborted, so the reversal is caused solely by queue placement. This violates the locked session-wide complete-batch FIFO and can reorder stateful action execution and correlated results even on a successful, non-reentrant publication.

**Fix:** Store every accepted occurrence in one arrival-ordered queue. Represent binding as mutable private state on the queued occurrence, and bind accessor-time records in place rather than splicing them into a second array and appending them later. The pump must stop at an unresolved head record rather than allow a later bound record to pass it. Stop must detach from that same queue in order. Add a built-artifact regression where the getter emits occurrence 1 and its returned callable emits occurrence 2; assert dispatch, response, and finalization remain `1, 2`.

```ts
interface QueuedOccurrence {
  readonly sequence: number;
  readonly sourceBatch: ToolBatch;
  readonly cancellation: CancellationScope;
  binding: { context: StageContext; epoch: CatalogEpoch } | null;
}

// One queue owns both bound and not-yet-bound occurrences.
const occurrenceQueue: QueuedOccurrence[] = [];
```

### CR-02: A replay occurrence admitted under confirmed A executes live under C

**Classification:** BLOCKER

**File:** `packages/concierge/src/session.ts:395-400, 545-569, 596-619, 934-980`

**Issue:** During a connected replay, A is already the confirmed and published authority. A batch emitted by the replay getter before it calls `setContext(C)` is initially recorded with provisional context/epoch A. Once C is requested, `abandonSupersededReplay` calls `clearPublication`, which erases that provisional binding. After C confirms, `bindUnboundBatches` binds every deferred record to C and does not preserve or abort the earlier A arrival. Built-artifact probes for both a returned sentinel and a thrown getter observed the same result:

```json
{
  "stage": "c",
  "dispatches": [
    { "context": "c", "callId": "before-c", "aborted": false },
    { "context": "c", "callId": "after-c", "aborted": false }
  ],
  "responses": ["before-c", "after-c"]
}
```

`before-c` arrived while the transport and Session both held A, yet it ran successfully under C. If C exposes a different action set or context-sensitive authority, a transport occurrence admitted under A can execute functionality that was not published when it arrived. The current connected-replay regression emits only after the getter completes, so it proves stale-callable suppression but misses this authority transfer.

**Fix:** Distinguish an accessor attempt for an unpublished context from an accessor read that merely replays an already-confirmed epoch. Preserve immutable arrival context/epoch A for a pre-C replay occurrence; when C uses a different catalog, the normal epoch transition must abort that A record before it dispatches once under its captured A context. An occurrence emitted after C is requested can be deferred for C. Do not weaken C17's rule that unpublished B is never dispatch authority. Add return and throw regressions with batches on both sides of the C reentry, for both distinct-catalog and same-catalog C, and assert exact context identity, cancellation state, handler count, and responses.

```ts
interface UnboundBatch {
  readonly sourceBatch: ToolBatch;
  readonly cancellation: CancellationScope;
  readonly arrivalAuthority: "confirmed-replay" | "unpublished-attempt";
  readonly arrivalContext: StageContext | null;
  readonly arrivalEpoch: CatalogEpoch | null;
}
```

### CR-03: Stop silently drops a deferred post-reentry occurrence

**Classification:** BLOCKER

**File:** `packages/concierge/src/session.ts:573-619, 720-745`

**Issue:** If a getter queues C and then emits a batch, `acceptUnboundBatch` sees that the still-publishing B generation is no longer current and records the occurrence with null provisional context/epoch. It nevertheless pushes the occurrence into `unboundBatches` and connects its cancellation scope. If `stop()` reenters before the transition drain selects C, `detachUnboundBatches` aborts and disposes this record without creating detached work. A built-artifact probe emitted `before-c`, queued C, emitted `after-c`, and stopped from the B getter. After the cached stop Promise resolved, it observed only:

```json
{
  "dispatches": [
    { "context": "b", "callId": "before-c", "aborted": true }
  ],
  "responses": [],
  "sameDrain": true
}
```

The accepted `after-c` occurrence never crossed `dispatchBatch`. This violates the locked stop guarantee that queued and publication-in-progress accepted records detach and dispatch exactly once with their original cancellation object, and it creates an unobservable queue drop during a hostile but synchronous lifecycle ordering.

**Fix:** Retain an immutable admission context for every unbound occurrence, including one accepted after a newer requested generation supersedes the active accessor. On stop, convert every queued occurrence into detached work in global arrival order, abort the same cancellation scope, dispatch it once, and suppress responses; never use `dispose()` as a substitute for the required dispatch/finalizer path. If an epoch has not yet been created for the requested context, use a private detached/holding epoch or make detached work explicitly support that state. Add setContext and connected-replay tests that emit before C, emit after C, then stop/stop-from-signal, and assert two FIFO dispatches, identical cancellation-signal objects, zero handlers/responses, and drain completion.

## Warnings

### WR-01: Endpoint equality is reported as proof that the live tree stayed untouched

**Classification:** WARNING

**File:** `scripts/phase-07-mutation-battery.mjs:2051-2057, 2407-2413, 2931-3003`

**Issue:** The snapshot repair correctly prevents gates and restoration from reading or writing a concurrent live edit. However, `liveRevisionStable` compares only post-run paths/digest with the pre-run values, folds that into `scopedTreeClean`, and the validation ledger then claims the live worktree remained “untouched and stable.” The new self-test itself performs A to B to A, confirms mixed direct reads, restores A, and asserts the final digest equals the baseline. That exact history is therefore invisible to the production endpoint check and can still be recorded as `scopedTreeClean: true`. This no longer corrupts mutant evidence because all gate reads are snapshot-pinned, but the recorded field and ledger statement claim a stronger historical property than the harness proves.

**Fix:** Rename the measurement to an endpoint claim such as `liveScopeEndpointsMatch` and change the ledger wording to state that the disposable snapshot stayed revision-stable while live scoped endpoints matched before and after. If uninterrupted live-tree stability is genuinely required, require all writers to share the lock or add a trustworthy change journal/watch mechanism; an A to B to A history cannot be proven absent by two hashes. Update the negative control to distinguish snapshot isolation (which it proves) from live-history detection (which it does not).

---

_Reviewed: 2026-08-09T06:28:06Z_

_Reviewer: the agent (gsd-code-reviewer)_

_Depth: standard_
