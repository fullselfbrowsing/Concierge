---
phase: 07-session-and-the-transport-seam
fixed_at: 2026-08-09T20:19:42Z
review_path: .planning/phases/07-session-and-the-transport-seam/07-REVIEW.md
iteration: 3
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-08-09T20:19:42Z
**Source review:** `.planning/phases/07-session-and-the-transport-seam/07-REVIEW.md`
**Iteration:** 3 (authorized additional post-gap cycle)

**Summary:**

- Findings in scope: 2
- Fixed: 2
- Skipped: 0

All nine findings closed before this iteration remain closed. The single occurrence queue, confirmed-replay authority, exact stop drain, unpublished-attempt abort/clear split, connected-replay getter containment, and endpoint-only mutation wording all retained their existing regression and independent mutation coverage.

## Fixed Issues

### CR-01: A stale resolver or capability exception strands the winning transition and accepted work

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`
**Commit:** `85bd9d7`
**Applied fix:** Added one shared `captureCurrent` try/finally boundary. `catalogFor` and `stageFor` property capture are now separate from `Reflect.apply`, and freshness is revalidated after each property read and each invocation. `transport.capabilities` and `capabilities.dynamicCatalog` use the same guarded boundary. A superseded return or throw exits only stale B processing, so the outer transition loop continues draining queued C; a callable returned by a stale structural getter is never invoked. A current-record throw retains its prior behavior because the helper does not catch, bind, inspect, or interpolate the thrown value.
**Regression:** C18 runs 24 built-artifact variants: catalogFor property/call, stageFor property/call, capabilities, and dynamicCatalog; each queues C immediately before return or throw and runs with both distinct- and same-catalog C. Every variant proves no stale callable/structural read, no leaked private value, no stale diagnostic/failure, no B publication or dispatch authority, final C stage/authority, stable cancellation-signal identity, and exactly one later C dispatch and response.

### WR-01: The catalog suite and mutation register cannot detect stale-boundary exception handling

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/test/session-catalog.test.ts`, `scripts/phase-07-mutation-battery.mjs`, `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-REGISTER.json`, `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-EVIDENCE.json`, `.planning/phases/07-session-and-the-transport-seam/07-VALIDATION.md`
**Commits:** `85bd9d7`, `6a73bcc`
**Applied fix:** Added uniquely marked built-artifact case C18 and compiled exact mutant M-07-C12. The mutant removes only the shared post-operation freshness/stale-exception guard, builds successfully, runs only C18, and fails exclusively on `[RED:C18:stale-boundary-progress]`. The disposable snapshot restores the target byte-identically and its restored build, full catalog suite, and typecheck all return green. Harness self-tests reject a missing C18 marker, factory/export false positives, a no-op mutant, duplicate source-literal occurrences, stale 32-row ledgers, and wrong neighboring detector fingerprints.
**Evidence:** The regenerated register contains 33 ordered rows with distribution `12/9/8/2/2`; every row is revision-bound, compiled, killed by its exact named detector, restored, and green. Protected package inputs remain byte-identical.

## Aggregate Verification

- `pnpm --filter @fullselfbrowsing/concierge build` — passed against final source.
- Focused C17+C18 built-artifact run — 2/2 passed; C18 contains 24 stale-boundary variants.
- Catalog, routing, and lifecycle suites — 65/65 passed (26 catalog, 18 routing, 21 lifecycle).
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — passed.
- `pnpm build && pnpm typecheck && pnpm test` — passed; 16 runtime files, 327/327 tests, zero failed/pending/todo.
- `node --check scripts/phase-07-mutation-battery.mjs` — passed.
- `node scripts/phase-07-mutation-battery.mjs self-test` — passed every negative control.
- Mutation evidence — 33/33 green: 12 catalog, 9 routing, 8 lifecycle, 2 diagnostics, 2 package (`12/9/8/2/2`).
- Register digest — `b57d8a91933bf0884dd821047e6304def8138dd7a58d6759b38b1aadef813088`.
- M-07-C10 revision digest — `2bcdeb29f553089207d61e66cc1542bd0652296c972e82311c7b500587ac2554`; exactly C17 and `[RED:C17:abandoned-publication-cleanup]` killed the abort-only mutant.
- M-07-C11 revision digest — `37771d67807a4b68ae884b41566c46109857ec7415cf216f86167316291ee355`; exactly C17 and `[RED:C17:abandoned-publication-cleanup]` killed the clear-only mutant.
- M-07-C12 revision digest — `aa162feb6f15fc404ddb2b09dec039abbe96c2e13efe98ad7cd642f17fa92a6e`; it compiled, ran one test, failed only C18 on `[RED:C18:stale-boundary-progress]`, restored byte-identically, and returned restored gates green.
- `node scripts/phase-07-mutation-battery.mjs verify all` — 33/33 passed.
- `node scripts/phase-07-mutation-battery.mjs verify inputs` — 3/3 protected files byte-identical.
- `node scripts/phase-07-mutation-battery.mjs verify ledgers` — passed against final validation bytes; all seven immutable release commands exited 0.
- Release evidence — revision digest `0c2fe699ade17c54cda98d9e0cab7d1d17dd3cb9b70988ab1e8aeb4abcb5ef13`; executed `2026-08-09T20:19:15.780Z`; 16 runtime files, 327 passed, 327 total, zero failed/pending/todo.

## Generated Artifact Commit and Handoff

**Commit:** `6a73bcc`

The final `07-MUTATION-REGISTER.json`, `07-MUTATION-EVIDENCE.json`, and `07-VALIDATION.md` were committed together after the final mutation and release runs. This `07-REVIEW-FIX.md` remains uncommitted for the central orchestrator's documentation commit.

`07-REVIEW.md`, `07-SECURITY.md`, and `07-VERIFICATION.md` were intentionally left unchanged for independent re-review, security re-audit, and goal verification.

## Skipped Issues

None.

## Residual Uncertainty

Both iteration-3 findings change reentrant runtime or evidence logic and therefore retain the required human-verification flag. The fixer found no unresolved in-scope issue, but independent re-review must confirm closure before the security and phase-verification artifacts are refreshed. In particular, C18 mechanically proves the requested stale return/throw matrix and later C progress; it does not replace independent reasoning about every possible consumer-defined proxy or callback composition.

---

_Fixed: 2026-08-09T20:19:42Z_
_Fixer: Codex (gsd-code-fixer)_
_Iteration: 3_
