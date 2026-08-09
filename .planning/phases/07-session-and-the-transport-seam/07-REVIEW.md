---
phase: 07-session-and-the-transport-seam
reviewed: 2026-08-09T21:46:56Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - packages/concierge/src/session.ts
  - packages/concierge/test/session-catalog.test.ts
  - scripts/phase-07-mutation-battery.mjs
findings:
  critical: 1
  warning: 1
  info: 0
  total: 2
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-09T21:46:56Z

**Depth:** standard

**Files Reviewed:** 3

**Status:** issues_found

## Summary

The exception-drain repair closes the prior CR-01 in its reported scope. `drainTransitions()` now retains the first exact thrown value, continues draining every reentrant transition, performs binding and pump cleanup once, and only then rethrows. Independent built-distribution probes covered multiple queued connected/context transitions, connected-replay getter and callable reentry, secondary replay failures, stop during replay, exact first-error identity, cached stop, dispatch/response cardinality, and diagnostic secrecy. No stranded transition, duplicate drain, or secondary-error replacement was observed.

The requested-authority repair is incomplete. C20 proves the case where C remains in `transitionQueue` while B's boundary emits work. It does not cover work emitted from C's own resolver or capability boundary after C has been shifted out of the queue but before C is confirmed. In that state, `acceptBatch()` still binds the occurrence to confirmed A. This is an authority-isolation defect and remains a release blocker.

| Reviewed closure | Disposition | Independent evidence |
|---|---|---|
| Prior CR-01 — current exception strands queued transition | Closed | Expanded return/throw and replay-reentry probes preserved the first exact failure while every queued transition reached a coherent terminal state. C19 and M-07-C13 are exact for the submitted drain-progress branch. |
| Prior CR-02 — post-request admission authority | Not closed | The submitted B-boundary/C-queued scenario is repaired, but active C with an empty queue still admits its own boundary-time work as A. |
| Prior WR-01 — regression and mutation coverage | Partially closed | The register now has exact C19/C20 mutants and internally consistent evidence, but C20/M-07-C14 cannot observe the active-C queue-shift state. |

All submitted gates passed: build, package typecheck, catalog 28/28, routing 18/18, lifecycle 21/21, focused C17-C20 4/4, mutation syntax, mutation self-test, `verify all` 35/35, and `verify inputs` 3/3. The 35-row register digest and 68-path release digest recomputed exactly. `verify ledgers` also passed in a disposable detached worktree; its evidence rewrite never touched the live workspace. Those green results do not exercise the counterexample below.

**Advance verdict:** No advance. Security re-audit and formal verification must wait until CR-01 below and its detector gap are fixed, regenerated, and independently re-reviewed.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The active requested transition loses its authority after the queue shift

**Classification:** BLOCKER

**File:** `packages/concierge/src/session.ts:708-719, 1098-1117`

**Issue:** `acceptBatch()` treats a request as C-owned only while `transitionQueue.length !== 0`. `drainTransitions()` removes C with `shift()` before calling `processContext(C)`. Consequently, while C's own `catalogFor`, `stageFor`, `transport.capabilities`, or `dynamicCatalog` boundary is executing, the queue can be empty and `publicationPending` can still be false. A synchronous batch emitted at that boundary falls through to the confirmed branch and is immediately bound to A's context and epoch, even though the exact active request is C.

Built-distribution probes reproduced the defect across all six boundary shapes and return/throw outcomes. Resolver boundaries failed with both same and distinct C catalogs; capability boundaries failed with distinct catalogs, where those reads are reachable. On a successful same-catalog transition, the final stage was C and publications remained `[A]`, yet `inside-c` dispatched live under A and received a response. On a successful distinct-catalog transition, publications were `[A, C]`, but `inside-c` still dispatched under A with an aborted signal rather than under C. When the current C boundary threw, the exact sentinel was rethrown and the session remained at A, but `inside-c` nevertheless dispatched live under A and received a response. C-to-D supersession, repeated C generations, direct stop, and signal-driven stop likewise retained A as the occurrence context instead of the exact C generation.

This violates latest-request authority, same-catalog context capture, supersession cancellation, and stop-time context identity. A request can therefore execute against the wrong stage context while every submitted test and mutation row remains green.

**Fix:** Preserve an explicit generation-scoped requested-authority record when a reentrant `setContext(C)` establishes C as the owner. Do not infer that ownership solely from whether C is still physically present in `transitionQueue`. The record must survive the `shift()` and remain available during C's resolver/capability boundaries, then be cleared only when that exact generation confirms, is superseded, fails, or stops. `acceptBatch()` should stamp the stored C context/generation in this interval; later binding should make it live only on exact C confirmation and otherwise cancel it under C without falling back to A. Preserve the existing `before-c` behavior for work admitted before C is requested, the single FIFO queue, exact thrown values, and one-time stop detachment.

## Warnings

### WR-01: C20 and M-07-C14 permit a false-green active-C authority regression

**Classification:** WARNING

**File:** `packages/concierge/test/session-catalog.test.ts:2191-2201, 2467-2481, 2590-2604`; `scripts/phase-07-mutation-battery.mjs:443-461, 1050-1066`

**Issue:** C20 emits `after-c`, `first-c-generation`, and `stop-c` synchronously from B's boundary, immediately after requesting C. At each observation point C is still queued, so the test exercises only the new `transitionQueue.length !== 0` branch. It never emits a batch from C's own boundary after the drain has shifted C out of the queue. M-07-C14 merely disables that same queue-length branch and maps it exclusively to C20. It is therefore exact for the submitted branch but incapable of detecting the missing authority state identified in CR-01. This is why all 35 mutation rows and the release ledger pass despite a built-artifact authority failure.

**Fix:** Add uniquely marked built-distribution regressions that emit from active C after its queue shift. Cover all reachable resolver/capability boundaries, return and exact-throw paths, same/distinct catalogs, C-to-D supersession, repeated C generations, direct/signal stop, FIFO order, stable cancellation identity, finalization count, and response cardinality. Add a separate compiled mutant that removes or substitutes the repaired active-generation authority branch, require only the new case's exact RED marker, then regenerate the mutation register, evidence, release facts, and validation snapshot.

---

_Reviewed: 2026-08-09T21:46:56Z_

_Reviewer: the agent (gsd-code-reviewer)_

_Depth: standard_
