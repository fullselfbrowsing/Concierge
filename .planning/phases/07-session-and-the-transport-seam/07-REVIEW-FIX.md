---
phase: 07-session-and-the-transport-seam
fixed_at: 2026-08-10T04:51:47Z
review_path: .planning/phases/07-session-and-the-transport-seam/07-REVIEW.md
iteration: 6
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-08-10T04:51:47Z
**Source review:** `.planning/phases/07-session-and-the-transport-seam/07-REVIEW.md`
**Iteration:** 6 (authorized bounded fix after report commit `15d3561`)

**Summary:**

- Findings in scope: 2
- Fixed: 2
- Skipped: 0

Every finding closed before this iteration remains closed. C17-C21, confirmed replay, the single occurrence FIFO, exact first-error draining, active and queued requested authority, queue/active/confirmed priority, cancellation-signal identity, stop-time detachment, and snapshot isolation remain green.

## Fixed Issues

### CR-01: A failed requested context poisons queued confirmed-replay authority

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`
**Commit:** `63d46eb`
**Applied fix:** The transition catch now reconciles effective requested authority only when the failed record still owns both the exact `requestedContext` identity and `requestedGeneration`. It restores the requested context to `confirmedContext` without decrementing the generation. A queued connected replay therefore begins with coherent confirmed-A context/epoch authority at the current monotonic generation. If a genuinely newer D request owns either requested field, the guard does not overwrite it. During replay, work emitted before nested D is bound immediately to confirmed A; after `setContext(D)` changes exact requested authority, later work follows D. The existing active-authority record is still cleared only for the exact failed record, and the first caught value remains unchanged until the synchronous control drain completes.
**Regression:** Built-distribution C22 exercises same/distinct D requested during the failed-C replay, direct and signal-accessor stop before generic binding, exact C sentinel identity, A authority before D, D authority afterward, publications/stage, FIFO dispatch, cancellation, responses, and finalizers. Additional cases cover a newer generation queued before the first failure escapes, same-object generations, C failure followed by D failure/replay and E success, connected/disconnected/connected mixtures, failure with no accepted work, and the public no-initial-context edge. Stop cases detach and dispatch each accepted occurrence once under its true arrival context with one stable aborted signal and zero response.

### WR-01: C21 and M-07-C15 allow the post-failure replay defect to remain green

**Status:** fixed
**Files modified:** `packages/concierge/test/session-catalog.test.ts`, `scripts/phase-07-mutation-battery.mjs`, `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-REGISTER.json`, `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-EVIDENCE.json`, `.planning/phases/07-session-and-the-transport-seam/07-VALIDATION.md`
**Commits:** `63d46eb`, `def2eaf`, `26320aa`
**Applied fix:** Added uniquely marked C22 and exact compiled mutant M-07-C16. M-07-C16 substitutes only the exact context-and-generation failure-reconciliation branch, compiles, runs only C22, and fails only `[RED:C22:failed-request-authority-reconciliation]`. Its disposable snapshot restores the source byte-for-byte, returns the 30-test catalog target, typecheck, and package gate green, and leaves live scoped endpoints unchanged. M-07-C14/C20 and M-07-C15/C21 remain separately exact and independent.
**Evidence update:** The immutable register now contains 37 rows with distribution 16 catalog, 9 routing, 8 lifecycle, 2 diagnostics, and 2 package/guard (`16/9/8/2/2`). All rows were regenerated against the final source/test/harness revision in eleven bounded shards. Harness self-tests require C22/M-07-C16 and reject missing, reordered, duplicated, no-op, multi-occurrence, wrong-marker, factory, and export false positives.

## Aggregate Verification

- `pnpm --filter @fullselfbrowsing/concierge build` — passed against the restored final source.
- Focused C17-C22 built-artifact run — 6/6 passed.
- Catalog, routing, and lifecycle suites — 69/69 passed (30 catalog, 18 routing, 21 lifecycle).
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — passed.
- `pnpm test` — 16 runtime files, 331/331 passed, zero failed/pending/todo.
- `node --check scripts/phase-07-mutation-battery.mjs` — passed.
- `node scripts/phase-07-mutation-battery.mjs self-test` — passed every negative control.
- Mutation evidence — 37/37 green: 16 catalog, 9 routing, 8 lifecycle, 2 diagnostics, 2 package (`16/9/8/2/2`) across eleven bounded shards.
- Register digest — `58e8e7d6f15a61156d4f9cc8acad2a86af7840b860f4d2107c6fda261bbd004f`.
- Artifact SHA-256 digests — register file `a062b3141d97eec5dcc2918130b73ae8559567d79ad04dda363c6404d2025792`; evidence file `1b5e31a086faf9bc48811e90471bd0680669caa0ebab6f9087f516406fc24059`; validation file `415d11173ada9a71c1e272496a070d181a4574e226c2b9e2483973973fc03250`.
- M-07-C13 revision digest — `0cb2f390576d956b9e71e4301b20b2dbcebac0d7e2edafb407590eba555e9f43`; it compiled, ran one test, failed only C19 on `[RED:C19:current-exception-drain-progress]`, and restored green.
- M-07-C14 revision digest — `d0dfa4db4ccc1b319646076f9c0dbb2926ffc128d9f022b9d6629cf58f90a3e2`; it compiled, ran one test, failed only C20 on `[RED:C20:post-request-admission-authority]`, and restored green.
- M-07-C15 revision digest — `e0961f0da35da6b790936801482fe0cae12a4b13ea1b5a4aff3564e71f817e54`; it compiled, ran one test, failed only C21 on `[RED:C21:active-request-generation-authority]`, and restored green.
- M-07-C16 revision digest — `9f748329c9d83d5c0f25c682c98a7febd1ec0ffbfcd3837b4d707e24626015e3`; it compiled, ran one test, failed only C22 on `[RED:C22:failed-request-authority-reconciliation]`, and restored green.
- `node scripts/phase-07-mutation-battery.mjs verify all` — 37/37 passed.
- `node scripts/phase-07-mutation-battery.mjs verify inputs` — 3/3 protected files byte-identical.
- `node scripts/phase-07-mutation-battery.mjs verify ledgers` — passed against final validation bytes; all seven immutable release commands exited 0.
- Release evidence — revision digest `b6dd1789125cc1f5b1a5cfdd3f22ac4f057decadeccb8fa7d817ef70c681a1cb`; executed `2026-08-10T04:51:16.701Z`; 16 runtime files, 331 passed, 331 total, zero failed/pending/todo.

## Generated Artifact Commit and Handoff

**Commit:** `26320aa`

The final `07-MUTATION-REGISTER.json`, `07-MUTATION-EVIDENCE.json`, and `07-VALIDATION.md` were committed together after the final mutation and immutable release runs. This `07-REVIEW-FIX.md` remains uncommitted for the central orchestrator's documentation commit.

`07-REVIEW.md`, `07-SECURITY.md`, and `07-VERIFICATION.md` were intentionally left unchanged for independent re-review, security re-audit, and goal verification.

## Skipped Issues

None.

## Residual Uncertainty

CR-01 changes synchronous reentrant authority reconciliation and therefore retains the required human-verification flag. The fixer found no unresolved in-scope issue. A context request made inside an already-stale resolver remains governed by the pre-existing C18 freshness rule, which suppresses the stale continuation and thrown value; C22 instead proves that a newer request queued during failed-C recovery before the first failure escapes is not overwritten, including an exact same-object later generation. Independent re-review must confirm that distinction, exact context-and-generation ownership of rollback, coherent A-before-D/D-after-D replay authority, no failed-C resurrection, stop-time true-arrival detachment, and M-07-C14/C15/C16 independence. Security and formal verification artifacts remain intentionally stale until that independent review succeeds.

---

_Fixed: 2026-08-10T04:51:47Z_
_Fixer: Codex (gsd-code-fixer)_
_Iteration: 6_
