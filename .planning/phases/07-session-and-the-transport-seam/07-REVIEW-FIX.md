---
phase: 07-session-and-the-transport-seam
fixed_at: 2026-08-09T02:57:59Z
review_path: .planning/phases/07-session-and-the-transport-seam/07-REVIEW.md
iteration: 3
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-08-09T02:57:59Z
**Source review:** `.planning/phases/07-session-and-the-transport-seam/07-REVIEW.md`
**Iteration:** 3

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: A `setTools` accessor can republish tools after stop cleanup

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`
**Commit:** d7e1b0e
**Applied fix:** Resolved each active or reconnect `setTools` accessor separately, revalidated transition/publication authority after the accessor returns, and invoked the captured function with the transport receiver only while current. Getter throws after reentrant stop are treated as invalidated attempts. Added separate set-context and reconnect regressions proving the frozen empty cleanup catalog is final and the stale returned function is never invoked.
**Verification:** Package build passed; both hostile-accessor regressions passed; the final snapshot release suite passed.

### CR-02: Reentrant resolver and capability reads can apply a superseded transition

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`
**Commit:** e5cd4c7
**Applied fix:** Split `catalogFor`, `stageFor`, transport capabilities, and `dynamicCatalog` into distinct outside boundaries with an immediate `isCurrent(record)` check after each. Added a stale resolver regression where B enqueues C before a throwing `stageFor(B)`, plus a fixed-capability getter regression where B enqueues C before returning `false`; both finish active on C without publishing B.
**Verification:** Package build passed; both focused latest-generation regressions passed; the final snapshot release suite passed.

### CR-03: Release evidence still does not bind the bytes exercised by every gate

**Status:** fixed: requires human verification
**Files modified:** `scripts/phase-07-mutation-battery.mjs`
**Commits:** f17a0ec, 039a23a, 8e95fd7
**Applied fix:** Added the shipped README and license to the required release manifest; copied every manifest file read-only into one temporary snapshot; performed a frozen offline dependency install from the copied lockfile; and ran all seven release commands from that snapshot with digest checks around every command. Renamed the battery-only lock so it no longer claims repository exclusivity. Added packaged-document, A-to-B-to-A, installed-dependency-path, offline-install, and real snapshot-build self-tests.
**Verification:** Node syntax check and the expanded self-test passed. The final ledger run executed build, typecheck, test, artifact, dependency, pack/install, and Node-floor gates from the snapshot with seven zero exits and recorded 16 runtime files / 321 passed / 321 total / 0 pending / 0 todo.

### WR-01: The updated response-cutoff mutant is wired to tests that cannot kill it

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/test/session-lifecycle.test.ts`, `scripts/phase-07-mutation-battery.mjs`
**Commit:** d1eb054
**Applied fix:** Promoted the row-getter and response-getter stop regressions to L17 and L18 with unique RED markers, mapped M-07-L03 exclusively to those cases, and extended named lifecycle case verification through L18. Added a behavioral self-test that proves the current replacement changes each selected case from zero post-stop response invocations to one.
**Verification:** Restored L17/L18 passed 2/2. The real M-07-L03 mutant compiled and failed exactly L17/L18 with their exact markers; the definitive mutation battery passed 30/30.

## Aggregate Verification

- `node scripts/phase-07-mutation-battery.mjs self-test` — passed, including a real offline snapshot install and build.
- Focused catalog regressions — 4/4 passed.
- Focused lifecycle regressions — L17/L18 passed 2/2; M-07-L03 killed both exactly.
- `node scripts/phase-07-mutation-battery.mjs verify all` — 30/30 green.
- `node scripts/phase-07-mutation-battery.mjs verify inputs` — 3/3 byte-identical.
- `node scripts/phase-07-mutation-battery.mjs verify ledgers` — passed with all seven snapshot release gates green.
- Regenerated register, evidence, and validation ledgers committed in 7b73637.

## Residual Uncertainty

The runtime fixes alter reentrant state-machine logic, so this report retains the required human-verification flag despite focused regressions, full-suite coverage, and mutation proof. Snapshot dependency setup is deliberately offline and fails closed if the pnpm store is not populated; this affects reproducibility on a fresh machine but cannot produce green release evidence from fallback workspace bytes.

---

_Fixed: 2026-08-09T02:57:59Z_
_Fixer: Codex (gsd-code-fixer)_
_Iteration: 3_
