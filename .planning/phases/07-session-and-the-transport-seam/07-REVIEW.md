---
phase: 07-session-and-the-transport-seam
reviewed: 2026-08-10T02:44:26Z
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

**Reviewed:** 2026-08-10T02:44:26Z

**Depth:** standard

**Files Reviewed:** 3

**Status:** issues_found

## Summary

The submitted active-authority repair closes both findings from the preceding review in their reported scope. `activeRequestedAuthority` now survives the queue shift, C21 exercises the active C generation across direct/reentrant, supersession, repeated-generation, connected-replay, and stop variants, and M-07-C15 disables only that new branch. C20/M-07-C14 remain separately exact for work admitted while a later request is still queued. Independent reruns killed M-07-C13, M-07-C14, and M-07-C15 with exactly C19, C20, and C21 respectively, each with its sole declared RED marker and a clean restored target.

The wider failure-recovery trace exposes a new authority defect. If the current requested transition C throws after queuing a connected replay, the catch clears `activeRequestedAuthority` but leaves the raw requested state at failed C. `processConnected()` then publishes confirmed A while using failed C as the freshness baseline. Work emitted by that replay is initially recorded as unlinked C work. Ordinary completion masks the defect by generically rebinding it to A, so C21 passes; a same-catalog D request or stop inside that replay exposes the wrong identity and cancellation behavior.

| Review item | Disposition | Independent evidence |
|---|---|---|
| Prior CR-01 — active request loses authority after the queue shift | Closed in submitted scope | The explicit active record at `session.ts:1131-1134` feeds the admission branch at `session.ts:719-722`; the expanded C21 matrix and exact M-07-C15 rerun detect removal of that branch. |
| Prior WR-01 — missing detector for active C authority | Closed in submitted scope | C21 and M-07-C15 are separate from C20/M-07-C14 and preserve the intended 36-row catalog. |
| New CR-01 — failed C poisons confirmed-A replay authority | Open | Independent built-artifact same-catalog-D and direct-stop probes reproduce the incorrect C/D ownership described below. |
| New WR-01 — no detector interrupts the post-failure replay before generic binding | Open | C21 observes an uninterrupted replay; M-07-C15 mutates only the active-request branch and cannot expose stale failed requested state. |

All mechanical gates passed: the seven-command release gate, 16 test files/330 tests, package build and typecheck, catalog 29/29, routing 18/18, lifecycle 21/21, focused C17-C21 5/5, mutation syntax/self-test, `verify all` 36/36, `verify inputs` for all three protected files, and `verify ledgers` in a disposable detached worktree. The evidence retains register digest `5d9d5b6dc291ab65e99b386c6edd568c16dfdd61cd29c569dabc9a8187761262` and immutable release revision digest `727775bf23ed7364d08ecd248fbc23a6b57fc11fa707b384a4ed7bfe48416e0e`. These green gates are internally consistent but do not exercise the counterexample.

**Advance verdict:** No advance. Security re-audit and formal verification must not proceed until CR-01 and WR-01 are fixed, the mutation/release evidence is regenerated, and an independent re-review passes.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A failed requested context poisons queued confirmed-replay authority

**Classification:** BLOCKER

**File:** `packages/concierge/src/session.ts:675-713, 1064-1113, 1140-1148`

**Issue:** Consider confirmed A followed by `setContext(C)`. C synchronously queues a `connected` control and then throws. The catch at lines 1140-1148 clears only the active authority record; `requestedContext` and `requestedGeneration` still identify failed C. The queued connected transition then enters `processConnected()`, where the catalog, context, and epoch come from confirmed A, but `authorityGeneration` and `authorityContext` come from failed C. As a result, `publishingContext` is A while the freshness baseline remains C. A batch emitted by `setTools(A)` makes `publicationMatchesRequest` false and falls through at lines 698-706 to an unlinked `unpublished-attempt` stamped with requested C rather than confirmed A.

If nothing reenters, `bindQueuedOccurrences()` later binds this non-`requested-transition` occurrence to confirmed A and conceals the bad admission state. Two built-distribution probes exposed it before that fallback:

- With a same-catalog `setContext(D)` inside the replay hook, the exact C sentinel was preserved and the session reached D, but the batch that arrived before D was requested dispatched under D with an already-aborted signal. Publications were `[A, A]`; the occurrence should have remained live under A.
- With direct `stop()` inside the replay hook, the exact C sentinel was preserved and the stage remained A, but the detached occurrence dispatched under failed C with an aborted signal and no response. Publications were `[A, A, empty]`; stop should preserve its true arrival context A while cancelling it.

This violates coherent failure rollback, confirmed-replay arrival authority, same-catalog identity, and stop-time detachment identity. In less synthetic transports, a call associated with a confirmed catalog can therefore execute against the wrong stage context after a failed context change.

**Fix:** Reconcile the effective requested authority when the exact current context transition fails. If the failed record still matches `requestedContext` and `requestedGeneration`, restore the authority context to `confirmedContext` while preserving a monotonic generation, or model that rollback with a dedicated effective-authority record. Do not overwrite a genuinely newer queued request. `processConnected()` must then use one coherent confirmed-replay authority tuple so work emitted before a nested D request is bound to A immediately; work emitted after the exact D request must follow D. Preserve exact first-error identity, FIFO order, and stop cancellation semantics.

## Warnings

### WR-01: C21 and M-07-C15 allow the post-failure replay defect to remain green

**Classification:** WARNING

**File:** `packages/concierge/test/session-catalog.test.ts:3363-3511, 3513-3613`; `scripts/phase-07-mutation-battery.mjs:447-454`

**Issue:** C21's throw-mode connected case does emit `connected-replay` after C fails and correctly expects its eventual dispatch under A. However, nothing supersedes or stops during that replay, so the generic binding pass masks the incorrect C-stamped admission. C21's stop matrix stops during active C, not during the confirmed-A replay queued by a failed C transition. M-07-C15 only disables the queue-empty `activeRequestedAuthority` branch, so it cannot detect stale raw requested state after the catch has cleared that record. The existing case and mutant are exact for the prior repair but leave the new failure-recovery seam unprotected.

**Fix:** Add a separately marked regression case for `current C failure -> queued confirmed-A replay -> replay-time batch -> reentrant action before binding`. At minimum, cover same-catalog D supersession and direct/signal stop, asserting exact thrown identity, A arrival context, generation ownership, cancellation state, FIFO dispatch/finalization, response cardinality, publications, and terminal stage. Add a distinct compiled mutant that removes the new failure-reconciliation/effective-authority logic, require only the new case's exact RED marker, and regenerate the register, immutable evidence, release facts, validation ledger, and security handoff.

---

_Reviewed: 2026-08-10T02:44:26Z_

_Reviewer: the agent (gsd-code-reviewer)_

_Depth: standard_
