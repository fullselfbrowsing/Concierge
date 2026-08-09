---
phase: 07-session-and-the-transport-seam
fixed_at: 2026-08-09T21:29:41Z
review_path: .planning/phases/07-session-and-the-transport-seam/07-REVIEW.md
iteration: 4
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-08-09T21:29:41Z
**Source review:** `.planning/phases/07-session-and-the-transport-seam/07-REVIEW.md`
**Iteration:** 4 (authorized bounded fix after report commit `6733e79`)

**Summary:**

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

Every finding closed before this iteration remains closed. The single occurrence queue, confirmed-replay A authority, exact stop drain, unpublished-attempt abort/clear split, stale resolver/capability return/throw behavior, setTools reentry, cancellation-signal identity, and endpoint-only mutation wording retained their built-artifact regressions and revision-bound mutation coverage.

## Fixed Issues

### CR-01: A current boundary exception can strand a reentrant connected transition and all later work

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`
**Commit:** `48e943d`
**Applied fix:** The outermost transition drain now retains the first exact thrown value, continues processing every queued transition while the session remains active, completes occurrence binding and pump scheduling, and only then rethrows that same value. A queued connected replay therefore runs synchronously before the caller regains control. If a later queued control fails through normal publication stop semantics, the session still fails closed without replacing, inspecting, interpolating, diagnosing, or logging the original boundary value.
**Regression:** C19 exercises `catalogFor` property/call, `stageFor` property/call, `transport.capabilities`, and `dynamicCatalog`. Every built-distribution variant queues connected replay and throws a unique non-Error sentinel while the operation remains current. Before `stop()`, each proves exact thrown identity, one boundary entry, no sentinel diagnostic leak, publication history A→A, stage A, an active subscription pair, exactly one later A dispatch/response, stable cancellation identity, and dispatch→response→finalizer order.

### CR-02: Work admitted after C is requested can execute with stale A authority

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`
**Commit:** `0e8551d`
**Applied fix:** Added a distinct `requested-transition` arrival authority and confirmed-generation tracking. When a boundary queues `setContext(C)` and then emits a batch before C drains, the occurrence is admitted unresolved with the exact requested C context and generation rather than bound to confirmed A. Exact C confirmation binds it in place; a later generation aborts it while retaining its C dispatch authority; stop detaches and dispatches it once under C with responses suppressed. Existing `unpublished-attempt` handling remains separate, so C17 setTools reentry and genuinely pre-C confirmed/replay A authority keep their prior behavior.
**Regression:** C20 runs 24 built-artifact variants across all six resolver/capability boundaries, return/throw, and distinct/same-catalog C. Each variant proves pre-C A authority, post-request C authority, correct distinct-catalog A cancellation, live same-catalog A replay, one global FIFO, exact dispatch/response/finalizer counts and order, final C stage/publication, zero stale continuation, and no sentinel leak. Additional cases prove same-object C generation supersession aborts the first generation while retaining exact C authority, and return/throw stop reentry detaches/dispatches C exactly once with an aborted stable signal, one finalizer, zero responses, and the cached stop promise.

### WR-01: C18 and M-07-C12 cannot detect exceptional queue progress or boundary-time admission authority

**Status:** fixed
**Files modified:** `packages/concierge/test/session-catalog.test.ts`, `scripts/phase-07-mutation-battery.mjs`, `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-REGISTER.json`, `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-EVIDENCE.json`, `.planning/phases/07-session-and-the-transport-seam/07-VALIDATION.md`
**Commits:** `48e943d`, `0e8551d`, `c192deb`, `7a102b3`, `71f9b0c`
**Applied fix:** Added uniquely marked built-distribution cases C19 and C20 plus two separate exact compiled mutants. M-07-C13 adds only the exceptional-drain `break` and runs only C19; M-07-C14 disables only requested-transition admission selection and runs only C20. Both mutants compile, fail exclusively on their own exact marker, restore byte-identically inside disposable snapshots, leave live scoped endpoints unchanged, and return restored build/catalog/typecheck gates green. Harness self-tests now reject missing C19/C20 markers, factory/export false positives, no-op or duplicated source literals, a stale 33-row ledger, and neighboring detector fingerprints.
**Evidence correction:** The unchanged broad M-07-C08 latest-generation mutant no longer changes C15 because confirmed-generation binding makes that scenario invariant. Its required fourth detector was therefore moved from C15 to the directly sensitive C20; it now fails exactly C10, C11, C16, and C20. C15 remains green and M-07-C06 still independently kills its published-epoch promotion branch.

## Aggregate Verification

- `pnpm --filter @fullselfbrowsing/concierge build` — passed against final source.
- Focused C17-C20 built-artifact run — 4/4 passed; C19 contains six current-throw boundary variants and C20 contains 24 return/throw/catalog variants plus generation-supersession and stop-detach cases.
- Catalog, routing, and lifecycle suites — 67/67 passed (28 catalog, 18 routing, 21 lifecycle).
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — passed.
- `node --check scripts/phase-07-mutation-battery.mjs` — passed.
- `node scripts/phase-07-mutation-battery.mjs self-test` — passed every negative control.
- Mutation evidence — 35/35 green: 14 catalog, 9 routing, 8 lifecycle, 2 diagnostics, 2 package (`14/9/8/2/2`) across eleven bounded shards.
- Register digest — `dbf851cb1e0c0cbfcf9de2502be6b156df42d78d9666cd95db075a85a21563ca`.
- M-07-C08 revision digest — `4fe3b788820d7acb393a339699d23a6241038ca70410e1a01103bab06f1aee84`; exactly C10, C11, C16, and C20 killed the unchanged latest-generation mutant.
- M-07-C10 revision digest — `bf361f3af48d600f168ee7b19c01910c9d0b1205a80d731c34071efae800ff73`; exactly C17 and `[RED:C17:abandoned-publication-cleanup]` killed the abort-only mutant.
- M-07-C11 revision digest — `99312771b5ad0fdcf1a9b343028fd688c0539505e9f3440b8992147565266492`; exactly C17 and `[RED:C17:abandoned-publication-cleanup]` killed the clear-only mutant.
- M-07-C12 revision digest — `b3d5c3788507cfb69ecff01b0859e5e923147d260fe72cba79f3bac31bf76bb3`; exactly C18 and `[RED:C18:stale-boundary-progress]` killed the stale-boundary mutant.
- M-07-C13 revision digest — `5c1ba3e6d9b3e2c336a63167d8e186f7ef51c2eaccd4c3272c1bf183a142a386`; it compiled, ran one test, failed only C19 on `[RED:C19:current-exception-drain-progress]`, and restored green.
- M-07-C14 revision digest — `910648b336bbfdf4698b423d722ad212b22f1e2acb1ef74af52102d84c4c7ae0`; it compiled, ran one test, failed only C20 on `[RED:C20:post-request-admission-authority]`, and restored green.
- `node scripts/phase-07-mutation-battery.mjs verify all` — 35/35 passed.
- `node scripts/phase-07-mutation-battery.mjs verify inputs` — 3/3 protected files byte-identical.
- `node scripts/phase-07-mutation-battery.mjs verify ledgers` — passed against final validation bytes; all seven immutable release commands exited 0.
- Release evidence — revision digest `5998ef70c9d3904d6eb4fd27cb049360b8236383da3d444765e2a8ff46457646`; executed `2026-08-09T21:29:19.773Z`; 16 runtime files, 329 passed, 329 total, zero failed/pending/todo.

## Generated Artifact Commit and Handoff

**Commit:** `71f9b0c`

The final `07-MUTATION-REGISTER.json`, `07-MUTATION-EVIDENCE.json`, and `07-VALIDATION.md` were committed together after the final mutation and release runs. This `07-REVIEW-FIX.md` remains uncommitted for the central orchestrator's documentation commit.

`07-REVIEW.md`, `07-SECURITY.md`, and `07-VERIFICATION.md` were intentionally left unchanged for independent re-review, security re-audit, and goal verification.

## Skipped Issues

None.

## Residual Uncertainty

CR-01 and CR-02 change reentrant runtime logic and therefore retain the required human-verification flag. The fixer found no unresolved in-scope issue. Independent re-review must confirm exact first-failure propagation, queued-control progress, immutable requested-generation authority, and the C08 detector remap before security and formal verification artifacts are refreshed.

---

_Fixed: 2026-08-09T21:29:41Z_
_Fixer: Codex (gsd-code-fixer)_
_Iteration: 4_
