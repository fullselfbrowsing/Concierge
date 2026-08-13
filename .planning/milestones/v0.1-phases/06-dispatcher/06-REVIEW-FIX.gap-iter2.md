---
phase: 06-dispatcher
fixed_at: 2026-08-07T20:18:06Z
review_path: .planning/phases/06-dispatcher/06-REVIEW.md
iteration: 2
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-08-07T20:18:06Z
**Source review:** `.planning/phases/06-dispatcher/06-REVIEW.md`
**Iteration:** 2

**Summary:**

- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Untrusted arrays are neither total nor prototype-safe at the dispatch boundary

**Status:** Fixed — requires human verification
**Files modified:** `packages/concierge/src/dispatch.ts`, `packages/concierge/test/dispatcher.test.ts`, `packages/concierge/test/dispatcher-batch.test.ts`
**Commit:** `52423fc`
**Applied fix:** Added one guarded, bounded length snapshot for hostile invocation and batch arrays, capped accepted arrays at 10,000 entries, and snapshot only own data/accessor slots through guarded descriptors. Sparse or inherited batch entries now become malformed correlated rows instead of executing prototype values. R70 and Q20 cover symbol/stateful/oversized lengths plus sparse inherited entries.

### CR-02: A conforming Standard Schema success result is rejected

**Status:** Fixed — requires human verification
**Files modified:** `packages/concierge/src/dispatch.ts`, `packages/concierge/test/dispatcher.test.ts`
**Commit:** `4e87cbf`
**Applied fix:** Treats `issues: undefined` as the Standard Schema success branch while still requiring a present `value` property and guarding both discriminator and value reads. R18a proves transformed output reaches the handler, while missing-value and throwing-accessor shapes still fail closed.

### CR-03: Stale-lock takeover can admit two mutation writers simultaneously

**Status:** Fixed — requires human verification
**Files modified:** `scripts/phase-06-mutation-battery.mjs`, `package.json`, `pnpm-lock.yaml`
**Commit:** `c45ceae`
**Applied fix:** Replaced PID-file check-and-unlink takeover with an OS-backed advisory lock owned by an open descriptor. The persistent lock path is never deleted, ownership releases automatically on process death, and unreadable legacy bytes are ignored. A barrier-synchronized child-process self-test proves exactly one of two simultaneous stale-file contenders enters, SIGKILL releases the lock, and a successor safely acquires. `fs-native-extensions@1.5.0` is pinned as a root-only development dependency and excluded from the published concierge package.

### WR-01: Ledger validation ignores four advertised detector rows

**Status:** Fixed — requires human verification
**Files modified:** `scripts/phase-06-mutation-battery.mjs`
**Commit:** `e0ec5be`
**Applied fix:** Centralized exact IDs, markers, contract text, and named test sources for R68, R06b, R69, Q17, Q16, Q18, and Q19. Live ledger validation now requires every row and exactly one marker in its named source; self-test counterexamples remove every required row and every source marker in turn.

## Verification

- Mutation evidence refresh: `c04180f`; immutable register `af67056a6f683327a252986155c28be5a944d53e17866cc8d4e65ca3481152b3`, 37/37 single, 24/24 batch, 61/61 total, 0 pending.
- Measured ledger update: `acbbee6`; 4 build artifacts totaling 692.66 kB and 12 test files with 250/250 tests passed.
- `node scripts/phase-06-mutation-battery.mjs self-test` passed OS-lock exclusion/crash release, exact detector, range, revision, evidence, and ledger counterexamples.
- `node scripts/phase-06-mutation-battery.mjs verify ledgers` passed live mutation completeness plus telemetry, build, typecheck, full Vitest, artifact, dependency, pack-install, Node-floor, isolation, and restoration gates.
- `node scripts/check-no-telemetry.mjs --self-test` detected 26 malicious controls; the live audit scanned 11 production files with 0 findings.
- `pnpm check:deps` confirmed one built core module, no vendored/external runtime modules, and 0 dependency bytes in the consumer bundle.

---

_Fixed: 2026-08-07T20:18:06Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 2_
