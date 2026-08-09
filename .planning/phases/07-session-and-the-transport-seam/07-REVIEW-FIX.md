---
phase: 07-session-and-the-transport-seam
fixed_at: 2026-08-09T07:05:12Z
review_path: .planning/phases/07-session-and-the-transport-seam/07-REVIEW.md
iteration: 2
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-08-09T07:05:12Z
**Source review:** `.planning/phases/07-session-and-the-transport-seam/07-REVIEW.md`
**Iteration:** 2 (post-gap review)

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

The preceding review's five fixes remain closed. This iteration replaces the repair's split bound/unbound queues with one global occurrence queue, preserves confirmed replay authority separately from unpublished publication attempts, drains every accepted unresolved occurrence through stop, and narrows mutation evidence wording to the endpoint property the harness actually measures.

## Fixed Issues

### CR-01: The separate unbound queue reverses accessor-time FIFO

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`
**Commits:** `1903edb`, `d4598e4`
**Applied fix:** Replaced `workQueue` plus `unboundBatches` with one arrival-ordered `occurrenceQueue`. Every accepted record receives a monotonic sequence and remains at its original queue position; its private binding is resolved in place. The live pump reads only the head and returns while that head is unresolved, so a later bound callable occurrence cannot pass an earlier getter occurrence. Attempt clearing unlinks the unresolved record in place after the dedicated abort, preserving C17's independent abort-versus-clear observability.
**Regression:** A built-artifact getter emits `getter-first`, its returned callable emits `callable-second`, and the test proves exact `getter-first → callable-second` dispatch, response, composed-signal reuse, and upstream-finalization order.

### CR-02: A replay occurrence admitted under confirmed A executes live under C

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`
**Commit:** `1903edb`
**Applied fix:** Publication state now distinguishes `confirmed-replay` from `context-attempt`. An occurrence arriving during the replay getter before C is requested binds immediately and immutably to confirmed A and A's epoch. A distinct-catalog C transition therefore aborts and dispatches it once under A; a same-catalog C transition leaves it live under A. An occurrence arriving after C is requested captures C as its precise admission context and binds to confirmed C. Unpublished accessor attempt B is never promoted to dispatch authority, preserving C17's zero-B contract.
**Regression:** Return and throw getters are covered for both distinct- and same-catalog C. All four built-artifact cases assert exact A/C identity, cancellation state, handler count, FIFO responses, zero stale callable invocation, zero diagnostics, and final C stage.

### CR-03: Stop silently drops a deferred post-reentry occurrence

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`
**Commit:** `1903edb`
**Applied fix:** Stop now splices every queued record from the single occurrence queue in arrival order. Any unresolved record is bound to its immutable arrival context for detached routing, using its existing epoch link when present and nullable detached epoch state otherwise. The original cancellation scope is aborted, then every record crosses `dispatchBatch` and finalization exactly once with responses disabled; no unresolved record is disposed as a substitute for dispatch.
**Regression:** SetContext and connected-replay publication are each exercised with direct stop and reentrant stop from the second source signal's `addEventListener`. All four built-artifact cases prove two FIFO dispatches, stable per-occurrence composed signals, both aborted, zero handler entries, zero responses, ordered upstream removal, one cached drain Promise, and drain settlement only after both records finalize.

### WR-01: Endpoint equality is reported as proof that the live tree stayed untouched

**Status:** fixed: requires human verification
**Files modified:** `scripts/phase-07-mutation-battery.mjs`, `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-REGISTER.json`, `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-EVIDENCE.json`, `.planning/phases/07-session-and-the-transport-seam/07-VALIDATION.md`
**Commits:** `068179a`, `f908d08`
**Applied fix:** Renamed the evidence property from `scopedTreeClean` to `liveScopeEndpointsMatch` throughout pending, executed, synthetic, and validated rows. The validation ledger now says the disposable snapshot stayed revision-stable and the live scoped endpoints matched before and after, while explicitly disclaiming uninterrupted live-history stability. The A→B→A self-test now proves both that snapshot gate reads remain isolated and that endpoint equality can coexist with detected live-history drift.
**Verification:** Mutation-battery syntax and self-test passed. Every regenerated evidence row contains `liveScopeEndpointsMatch: true`, contains no legacy `scopedTreeClean` property, and remains bound to its unique final revision digest.

## Aggregate Verification

- `pnpm --filter @fullselfbrowsing/concierge build` — passed against final source.
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — passed.
- Focused C17 plus FIFO, replay-authority, and stop-drain regressions — 4/4 passed against built `dist`.
- `pnpm exec vitest run packages/concierge/test/session-catalog.test.ts` — 25/25 passed.
- Catalog, routing, and lifecycle suites together — 64/64 passed.
- `pnpm build && pnpm typecheck && pnpm test` — passed; 16 runtime files, 326/326 tests.
- `node --check scripts/phase-07-mutation-battery.mjs` — passed.
- `node scripts/phase-07-mutation-battery.mjs self-test` — passed, including explicit snapshot-isolation/endpoint-limit and fingerprint negative controls.
- Mutation evidence — 32/32 green: 11 catalog, 9 routing, 8 lifecycle, 2 diagnostics, 2 package (`11/9/8/2/2`).
- Register digest — `5cccf0824bec93c2702d1ab712797dc23b477d3209db943c4d0f22846e177182`.
- M-07-C10 revision digest — `ab273cfbee2ac8c84650ed054eac071e2dc899f1773fd7d9bc449f7696a76c1a`; exactly C17 and its RED marker killed the abort-only mutant.
- M-07-C11 revision digest — `959e9c086c314121ff859d6f668b9b2de23ff91f6e322819c1688c0096dc39de`; exactly C17 and its RED marker killed the clear-only mutant.
- `node scripts/phase-07-mutation-battery.mjs verify inputs` — 3/3 protected files byte-identical.
- `node scripts/phase-07-mutation-battery.mjs verify ledgers` — passed; all seven immutable release commands exited 0.
- Release evidence — digest `2b98a50b8abbaabb66e4b0bdd8de82a3269598ed3d803b95ab1c517ff9127c77`; generated `2026-08-09T07:04:42.939Z`; 16 runtime files, 326 passed, 326 total, 0 failed/pending/todo.

## Generated Artifact Commit and Handoff

**Commit:** `f908d08`

The regenerated `07-MUTATION-REGISTER.json`, `07-MUTATION-EVIDENCE.json`, and `07-VALIDATION.md` were committed together after the final verification run. This `07-REVIEW-FIX.md` remains uncommitted for the central orchestrator's documentation commit, as required by the fixer workflow.

## Skipped Issues

None.

## Residual Uncertainty

All four iteration-2 findings change reentrant runtime or evidence logic, so they retain the required human-verification flag. There are no unresolved fixer-scope findings. `07-REVIEW.md` intentionally remains `issues_found`; `07-SECURITY.md` and `07-VERIFICATION.md` were not changed because closure requires independent re-review, security re-audit, and phase verification.

---

_Fixed: 2026-08-09T07:05:12Z_
_Fixer: Codex (gsd-code-fixer)_
_Iteration: 2_
