---
phase: 07-session-and-the-transport-seam
reviewed: 2026-08-10T05:06:50Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - packages/concierge/src/session.ts
  - packages/concierge/test/session-catalog.test.ts
  - scripts/phase-07-mutation-battery.mjs
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-10T05:06:50Z

**Depth:** standard

**Files Reviewed:** 3

**Status:** clean

## Narrative Findings (AI reviewer)

### Summary

No BLOCKER, WARNING, or INFO finding remains in the reviewed scope. The submitted failure-reconciliation repair closes the prior CR-01 and WR-01 without reopening active/queued requested authority, current-exception draining, confirmed replay, FIFO routing, cancellation, response cutoff, stop drainage, or snapshot-integrity behavior.

The catch at packages/concierge/src/session.ts:1140-1155 clears active authority only for the exact failing record and restores requestedContext to confirmedContext only while that same record still owns both requestedGeneration and requestedContext. It does not decrement requestedGeneration; confirmedGeneration remains the generation of the last successfully confirmed context. This is a coherent split: a failed generation stays consumed, confirmed-replay work binds immediately to the confirmed context/epoch, stale requested-transition work cannot match confirmedGeneration, and every later D/E request receives a strictly newer generation. No public reentrant path can install a newer request between a current boundary throw and this synchronous catch; at every publicly reachable resolver/capability/accessor boundary, a newer request makes the old record stale before its exception can reach reconciliation. Actual setTools invocation failure remains the existing fail-closed stop path.

processConnected() at session.ts:1064-1113 now receives a coherent confirmed-context/current-generation authority tuple after failed C. Work admitted before nested D retains confirmed A as its arrival context; work admitted after D is requested retains D. A distinct D aborts the prior A epoch, a same-catalog D preserves it, direct and signal-accessor stop detach each occurrence under its true arrival context, and failed unpublished C is never rebound or resurrected.

### Prior Finding Closure

| Review item | Disposition | Independent evidence |
|---|---|---|
| Prior CR-01 — failed C poisons confirmed-A replay authority | **Closed** | Exact context-and-generation reconciliation is present at session.ts:1148-1154. C22, focused built-artifact runs, and independent replay-getter probes all preserve A-before-D/D-after-D authority, monotonic generations, exact first failure, and stop-time identity. |
| Prior WR-01 — no detector interrupts post-failure replay before generic binding | **Closed** | C22 at session-catalog.test.ts:3616-4407 covers same/distinct D, direct/signal stop, same-object later generation, sequential C/D failures then E, multiple connected/disconnected replays, failure without work, and no initial context. M-07-C16 at phase-07-mutation-battery.mjs:457-479 is distinct from M-07-C14/C15 and selects only C22. |

### Independent Adversarial Probes

- Focused C17-C22 passed 6/6 against the rebuilt distribution. This preserves abandoned-publication cleanup, stale-boundary suppression, exact first-error draining, queued authority, active authority, and failed-request reconciliation together.
- A separate built-distribution failed-C → confirmed-A replay getter probe exercised accessor return and accessor throw after nested D for both same and distinct catalogs. In every branch the exact C sentinel escaped, the replay sentinel did not, the stale replay callable was never invoked, before-D dispatched under A, after-D dispatched under D, FIFO response/finalizer counts were exactly one per occurrence, and terminal stage was D. Distinct D cancelled the A occurrence; same-catalog D kept it live.
- A current replay-getter throw with no D preserved the original C failure, stopped synchronously, published only A then the empty cleanup catalog, drained one aborted A occurrence, produced zero responses, finalized once, and removed both subscribers.
- A no-initial-context failure followed by successful D produced [empty, empty, D], dispatched/responded once under D, emitted no diagnostic, and reached stage D. This confirms that null confirmed authority can recover without resurrecting C.
- C22's existing matrix additionally passed chained C then D failures followed by E, same-object later generations, two confirmed-A replays across connected/disconnected/connected status changes, no-work recovery, and direct/signal stop. Dispatch, response, finalizer, publication, stage, cancellation, subscriber, and exact-sentinel assertions all matched.

### Mutation and Integrity Evidence

- The register and evidence contain exactly 37 ordered rows with distribution 16 catalog / 9 routing / 8 lifecycle / 2 diagnostics / 2 package-guard. The embedded, register, and evidence digest all equal 58e8e7d6f15a61156d4f9cc8acad2a86af7840b860f4d2107c6fda261bbd004f; all 37 rows are green with 37 unique revision digests.
- In a freshly pending disposable clone, M-07-C14, M-07-C15, and M-07-C16 each compiled and ran exactly one test. They failed only C20, C21, and C22 respectively on their unique RED markers. Each literal occurred once, each target restored byte-identically, each restored catalog/type gate passed, each live endpoint check passed, and the three revision digests remained distinct.
- M-07-C16 disables only the exact reconciliation branch and cannot receive credit from C20, C21, a factory/export failure, a build failure, a zero-test run, or a neighboring marker. Harness self-tests reject missing/reordered/duplicated/no-op/multi-occurrence/wrong-marker variants.
- The mutation snapshot self-test and validation ledger use the accurate endpoint claim: disposable snapshot bytes stay stable and restored while live scoped endpoints match before/after; endpoint equality is explicitly not claimed to prove uninterrupted live-history stability.
- Recomputed artifact SHA-256 values match the fix report: register file a062b3141d97eec5dcc2918130b73ae8559567d79ad04dda363c6404d2025792, evidence file 1b5e31a086faf9bc48811e90471bd0680669caa0ebab6f9087f516406fc24059, and validation file 415d11173ada9a71c1e272496a070d181a4574e226c2b9e2483973973fc03250.

### Verification Gates

- Package build passed; focused C17-C22 passed 6/6.
- Catalog, routing, and lifecycle suites passed 30/30, 18/18, and 21/21 respectively.
- Package typecheck passed.
- Mutation harness syntax and self-test passed.
- verify all passed 37/37; verify inputs passed all three protected inputs byte-identically.
- A fresh disposable verify ledgers run passed and reproduced release revision digest b6dd1789125cc1f5b1a5cfdd3f22ac4f057decadeccb8fa7d817ef70c681a1cb. All seven release commands exited 0, with 16 runtime files and 331/331 tests, zero failed/pending/todo.
- The live workspace remained clean throughout review until this report was overwritten; no reviewed source, test, harness, fix report, mutation artifact, validation artifact, or security artifact was modified.

### Advance Verdict

The code-review gate is clean. Security re-audit may proceed on the repaired 37-row revision, followed by formal Phase 7 verification under the workflow's required ordering. The existing 07-SECURITY.md predates C22/M-07-C16 and must be refreshed by that independent security step; this expected stale handoff is not a defect in the three-file review scope.

All reviewed files meet quality standards. No issues found.

---

_Reviewed: 2026-08-10T05:06:50Z_

_Reviewer: the agent (gsd-code-reviewer)_

_Depth: standard_
