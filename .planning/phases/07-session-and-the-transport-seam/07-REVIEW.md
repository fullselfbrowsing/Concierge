---
phase: 07-session-and-the-transport-seam
reviewed: 2026-08-09T20:35:34Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - packages/concierge/src/session.ts
  - packages/concierge/test/session-catalog.test.ts
  - scripts/phase-07-mutation-battery.mjs
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-09T20:35:34Z

**Depth:** standard

**Files Reviewed:** 3

**Status:** issues_found

## Summary

The prior CR-01 and WR-01 are closed in their reported scope. `captureCurrent` performs each property/call boundary once, suppresses a thrown value only after the record becomes stale, and preserves the exact thrown value when the record is still current. Resolver methods are captured separately and invoked with `concierge` as the receiver. C18 exercises six boundaries across return/throw and distinct/same-catalog C (24 variants), and M-07-C12 removes exactly the shared freshness guard and is killed only by C18. The findings predating that iteration also remain closed by the submitted regressions and mutation evidence.

| Reviewed closure | Disposition | Independent evidence |
|---|---|---|
| Prior CR-01 — stale resolver/capability boundaries | Closed as reported | Built-distribution probes covered all six boundaries, exact current-throw identity, single evaluation, correct proxy receiver, and repeated stale structural return/throw. C18 passed all 24 variants with final C authority and one later response. |
| Prior WR-01 — M-07-C12 evidence | Closed as reported | The mutant has one exact source occurrence, changes only the freshness guard, compiles, fails only C18 on its exact marker, restores byte-identically, and leaves build/catalog/typecheck green. |
| Earlier Phase 7 findings | Closed as reported | The single FIFO queue, confirmed-replay A authority, exact stop drain, C17 abort/clear separation, snapshot-only mutation, and endpoint-only evidence claims remain covered by their regressions and evidence. |

The re-review nevertheless found two new transition-edge failures. First, an exception from a still-current resolver/capability operation can leave a reentrantly queued connected transition permanently at the queue head, which also prevents accepted work from dispatching. Second, a batch emitted after a reentrant `setContext(C)` but before that queued transition drains is bound immediately to confirmed A whenever no publication is pending; if C reuses A's catalog, that stale A authority remains live and handles the batch.

The package build, package typecheck, catalog 26/26, routing 18/18, lifecycle 21/21, mutation-battery syntax, mutation self-test, `verify all` 33/33, and `verify inputs` 3/3 all passed. The committed 33-row register and evidence were also inspected, including M-07-C12. `verify ledgers` was not rerun because that command rewrites evidence and this review was authorized to overwrite only this report; its committed seven-command, 327-test ledger was checked read-only. Passing submitted gates does not contradict the built-distribution counterexamples below. Security re-audit and formal verification must not proceed until both blockers and their evidence gap are repaired and independently re-reviewed.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A current boundary exception can strand a reentrant connected transition and all later work

**Classification:** BLOCKER

**File:** `packages/concierge/src/session.ts:529-581, 759-769, 1067-1093`

**Issue:** `captureCurrent` correctly rethrows when its operation fails while the transition record is still current. However, an outside resolver/capability operation can synchronously publish a connected status before throwing. `handleStatus` appends that connected transition, but its nested `drainTransitions()` returns because the outer drain is active. The throw then exits the outer drain. Its `finally` clears `transitionDraining` and calls `bindQueuedOccurrences()` and `maybeStartPump()`, but neither resumes the non-empty transition queue; in fact, both refuse work while that queue is non-empty. The session remains active with confirmed A, the connected transition stuck, and every subsequently accepted batch unanswered.

A built-distribution probe at the `catalogFor` property boundary observed the exact sentinel rethrown once. Before `stop()`, the session remained at stage A with no dispatch and no response for the later batch. `stop()` merely detached the blocked batch and dispatched it with an already-aborted signal, still without a response. Equivalent queue stranding was reproduced for the `catalogFor` call, `stageFor` property/call, `transport.capabilities`, and `dynamicCatalog` boundaries. This violates reconnect replay, FIFO progress, and the one-response-per-call lifecycle contract.

**Fix:** Preserve the exact current-operation throw, but leave the state machine in a terminally coherent state. Before propagating it, either synchronously drain/schedule every reentrantly queued transition, or fail closed through the normal stopped-state drain so accepted work cannot remain permanently gated. Do not log, interpolate, or replace the thrown value. Add built-distribution cases for all six current-throw boundaries that enqueue a connected status during the boundary and then assert, before `stop()`, either successful replay plus exactly one later dispatch/response or a documented stopped fail-close with exact cancellation behavior.

### CR-02: Work admitted after C is requested can execute with stale A authority

**Classification:** BLOCKER

**File:** `packages/concierge/src/session.ts:634-715, 907-969, 1096-1107`

**Issue:** During resolver and capability evaluation, `publicationPending` is still false. If such a boundary synchronously calls `session.setContext(C)`, the nested drain defers C while updating `requestedContext` and `requestedGeneration`. If the boundary then emits a batch before returning or throwing, `acceptBatch()` ignores both that pending transition and the requested C authority: its active/no-publication branch binds the occurrence immediately to `confirmedContext` and `confirmedEpoch`, which still belong to A. When C uses the same catalog object as A, the A epoch is retained, so the occurrence is neither aborted nor rebound and executes live under A after C was requested.

The built-distribution probe made `catalogFor(B)` call `setContext(C)`, emit `inside-after-c`, and then throw stale. With C sharing A's catalog, the final stage was C, yet dispatches were:

```json
[
  { "callId": "inside-after-c", "authority": "a", "aborted": false },
  { "callId": "later-c", "authority": "c", "aborted": false }
]
```

Both calls received responses. Thus the first call was not merely detached cleanup: stale A handled live work that arrived after the C update. This violates latest-request authority and the same-catalog context-capture rule.

**Fix:** Treat an occurrence accepted while a transition is draining or queued as unresolved work tied to the exact requested context/generation, even before `publicationPending` starts. Bind it only when the matching authority is confirmed; if that request is superseded, abort it under the existing cancellation rules. Preserve the one global FIFO queue, confirmed-replay semantics for genuinely pre-C work, and exact stop draining. Add resolver/capability boundary cases for return/throw and distinct/same-catalog C that emit a batch immediately after nested `setContext(C)` and assert its exact context, cancellation state, dispatch/response cardinality, and finalizer order.

## Warnings

### WR-01: C18 and M-07-C12 cannot detect exceptional queue progress or boundary-time admission authority

**Classification:** WARNING

**File:** `packages/concierge/test/session-catalog.test.ts:1723-1727, 1836-1845`; `scripts/phase-07-mutation-battery.mjs:418-425, 1013-1049, 2624-2665`

**Issue:** C18's `supersede()` only requests C and returns or throws. It neither queues a connected status while a still-current boundary throws nor emits a batch after requesting C and before the outer transition drains. Its later batch is emitted only after `setContext(B)` and a microtask flush have completed, so it cannot expose either blocker above. M-07-C12 is exact and non-vacuous for the stale-boundary freshness behavior it names, but the register has no distinct mutant/detector for exceptional outer-drain progress or pre-publication admission selection. Consequently, all 33 submitted mutation rows can be green while both defects remain in the built artifact.

**Fix:** Add uniquely marked built-distribution cases for (1) a current boundary throw with a reentrantly queued connected transition and (2) an admission emitted immediately after boundary-time `setContext(C)`. Add exact compiled mutants for the repaired drain-progress and admission-authority branches, require each intended case and exact RED marker, and regenerate the register, mutation evidence, release facts, and validation. The cases must assert progress before `stop()`, exact authority, one dispatch/response, cancellation identity, and absence of sentinel diagnostics—not merely eventual stop drain.

---

_Reviewed: 2026-08-09T20:35:34Z_

_Reviewer: the agent (gsd-code-reviewer)_

_Depth: standard_
