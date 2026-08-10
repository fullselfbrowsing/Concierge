---
phase: 07-session-and-the-transport-seam
fixed_at: 2026-08-10T02:16:42Z
review_path: .planning/phases/07-session-and-the-transport-seam/07-REVIEW.md
iteration: 5
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-08-10T02:16:42Z
**Source review:** `.planning/phases/07-session-and-the-transport-seam/07-REVIEW.md`
**Iteration:** 5 (authorized bounded fix after report commit `0e8d839`)

**Summary:**

- Findings in scope: 2
- Fixed: 2
- Skipped: 0

Every finding closed before this iteration remains closed. The single occurrence FIFO, confirmed-replay authority, queued requested-transition authority, exact first-error propagation with connected-transition draining, C17-C20 behaviors, cancellation-signal identity, and stop finalization all remain covered by built-distribution regressions and revision-bound mutation evidence.

## Fixed Issues

### CR-01: The active requested transition loses its authority after the queue shift

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`
**Commit:** `44343d3`
**Applied fix:** Added an explicit active requested-context authority record containing the exact context identity and generation. The transition drain installs it when the current context record becomes active after `transitionQueue.shift()`. Queue-backed latest-request authority remains higher priority while a newer request is still queued; when the queue is empty, `acceptBatch()` selects the active record before confirmed authority. Work emitted from active C's resolver or capability boundary is therefore admitted unresolved under exact C, binds live only after exact C confirmation, and never falls back to confirmed A. Exact confirmation clears the record after committing C; a superseding `setContext`, coherent current-boundary failure, or stop invalidation clears it before later admission. Already accepted pre-transition A work retains its immutable A binding.
**Regression:** C21 uses the built distribution and exercises 20 reachable direct active-C resolver/capability variants: all six boundary shapes, return and exact non-Error throw, same/distinct catalogs where reachable, and exact sentinel identity with no diagnostic leak. Successful same-catalog work executes live under exact C without publication; successful distinct-catalog work publishes and executes under exact C. Current C failures cancel and dispatch once under exact C, followed by later live A work, never A fallback for the C occurrence. Four reentrant queued-then-active C variants prove the original post-shift gap for success/failure and same/distinct catalogs. Additional cases cover C→D supersession, repeated C generations, mixed connected/status replay on return/throw, direct stop, and signal-accessor stop with global FIFO, exact context identity, stable cancellation signal identity, dispatch/response/finalizer order, and exact cardinality.

### WR-01: C20 and M-07-C14 permit a false-green active-C authority regression

**Status:** fixed
**Files modified:** `packages/concierge/test/session-catalog.test.ts`, `scripts/phase-07-mutation-battery.mjs`, `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-REGISTER.json`, `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-EVIDENCE.json`, `.planning/phases/07-session-and-the-transport-seam/07-VALIDATION.md`
**Commits:** `44343d3`, `4b7c703`, `b892d3e`
**Applied fix:** Added uniquely marked built-distribution case C21 and separate compiled mutant M-07-C15. M-07-C15 substitutes only the queue-empty active requested-generation authority condition, compiles, runs exactly C21, and fails only `[RED:C21:active-request-generation-authority]`. Its disposable snapshot restores the source byte-for-byte, returns the catalog suite and typecheck green, and leaves live scoped endpoints unchanged. C20 now accepts its genuinely pre-C A occurrence before requesting B, then continues to prove the distinct queued-C path. M-07-C14 still mutates only the queue-length requested-transition condition, runs only C20, and fails only `[RED:C20:post-request-admission-authority]`; C20/M-C14 and C21/M-C15 remain distinct detectors.
**Evidence update:** The immutable register now contains 36 rows with distribution 15 catalog, 9 routing, 8 lifecycle, 2 diagnostics, and 2 package/guard (`15/9/8/2/2`). All rows were regenerated against the final source/test/harness revision in eleven bounded shards. Harness self-tests now require C21/M-07-C15, reject missing/reordered/no-op/duplicated exact rows and missing C21 markers, and reject neighboring/factory/export false positives.

## Aggregate Verification

- `pnpm --filter @fullselfbrowsing/concierge build` — passed against final source.
- Focused C17-C21 built-artifact run — 5/5 passed.
- Catalog, routing, and lifecycle suites — 68/68 passed (29 catalog, 18 routing, 21 lifecycle).
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — passed.
- `pnpm test` — 16 runtime files, 330/330 passed, zero failed/pending/todo.
- `node --check scripts/phase-07-mutation-battery.mjs` — passed.
- `node scripts/phase-07-mutation-battery.mjs self-test` — passed every negative control.
- Mutation evidence — 36/36 green: 15 catalog, 9 routing, 8 lifecycle, 2 diagnostics, 2 package (`15/9/8/2/2`) across eleven bounded shards.
- Register digest — `5d9d5b6dc291ab65e99b386c6edd568c16dfdd61cd29c569dabc9a8187761262`.
- Artifact SHA-256 digests — register file `843f19ed96f851d9ba182d839fb670b77e3b1a7d44ff56498d1af2bfc278e3ce`; evidence file `cbd3fd0115f8069679a470c05394194b40206413c897c73a78621d25e4bb72de`; validation file `180a028f4f96793b29e2efa5264b8dd4173302b0efe39af20d51bc251373023f`.
- M-07-C13 revision digest — `d6020f8963f7d0b3bd28c21a8977c51e01e0a5068bf3fddcca38ea8002be6be0`; it compiled, ran one test, failed only C19 on `[RED:C19:current-exception-drain-progress]`, and restored green.
- M-07-C14 revision digest — `6fe8d83453c5fd9e71845b13f2cb35baea29af284a1d86391285b7dae90f06ca`; it compiled, ran one test, failed only C20 on `[RED:C20:post-request-admission-authority]`, and restored green.
- M-07-C15 revision digest — `7dddaefb5ca26bdecbacada3ed9a91b02db1e58fa489f565bfe71d8269e64d91`; it compiled, ran one test, failed only C21 on `[RED:C21:active-request-generation-authority]`, and restored green.
- `node scripts/phase-07-mutation-battery.mjs verify all` — 36/36 passed.
- `node scripts/phase-07-mutation-battery.mjs verify inputs` — 3/3 protected files byte-identical.
- `node scripts/phase-07-mutation-battery.mjs verify ledgers` — passed against final validation bytes; all seven immutable release commands exited 0.
- Release evidence — revision digest `727775bf23ed7364d08ecd248fbc23a6b57fc11fa707b384a4ed7bfe48416e0e`; executed `2026-08-10T02:16:17.481Z`; 16 runtime files, 330 passed, 330 total, zero failed/pending/todo.

## Generated Artifact Commit and Handoff

**Commit:** `b892d3e`

The final `07-MUTATION-REGISTER.json`, `07-MUTATION-EVIDENCE.json`, and `07-VALIDATION.md` were committed together after the final mutation and immutable release runs. This `07-REVIEW-FIX.md` remains uncommitted for the central orchestrator's documentation commit.

`07-REVIEW.md`, `07-SECURITY.md`, and `07-VERIFICATION.md` were intentionally left unchanged for independent re-review, security re-audit, and goal verification.

## Skipped Issues

None.

## Residual Uncertainty

CR-01 changes reentrant runtime authority logic and therefore retains the required human-verification flag. The fixer found no unresolved in-scope issue. Independent re-review must confirm queue-versus-active authority priority, exact generation clearing on confirmation/supersession/failure/stop, no A fallback for failed or superseded C, and the independence of M-07-C14/C20 from M-07-C15/C21. Security and formal verification artifacts remain intentionally stale until that independent review succeeds.

---

_Fixed: 2026-08-10T02:16:42Z_
_Fixer: Codex (gsd-code-fixer)_
_Iteration: 5_
