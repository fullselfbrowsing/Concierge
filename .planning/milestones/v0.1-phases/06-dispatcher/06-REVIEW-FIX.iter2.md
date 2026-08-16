---
phase: 06-dispatcher
fixed_at: 2026-08-07T19:22:17Z
review_path: .planning/phases/06-dispatcher/06-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-08-07T19:22:17Z
**Source review:** `.planning/phases/06-dispatcher/06-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 10
- Fixed: 10
- Skipped: 0

## Fixed Issues

### CR-01: Malformed batch metadata can reject the entire batch before containment

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/dispatch.ts`, `packages/concierge/src/types.ts`, `packages/concierge/test/dispatcher-batch.test.ts`
**Commits:** `b8f6d23`, `db336c8`
**Applied fix:** Guarded and snapshotted every untrusted batch/call field, made ordering total for malformed indexes, preserved observable correlation values, and added Q18/Q19 mixed-call containment regressions. The statically named guarded reads also satisfy the no-telemetry AST policy.

### CR-02: Malformed JSON can execute an action through a defaulting schema

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/dispatch.ts`, `packages/concierge/src/concierge.ts`, `packages/concierge/test/dispatcher-batch.test.ts`
**Commit:** `069226d`
**Applied fix:** Preserved malformed-JSON provenance through dispatch, still passed `{}` through ordinary validation, prevented handler entry even for permissive/defaulting validators, and isolated malformed calls from valid cache entries.

### CR-03: Inherited `toJSON` hooks collapse distinct fallback deduplication keys

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/dispatch.ts`, `packages/concierge/test/dispatcher.test.ts`, `scripts/phase-06-mutation-battery.mjs`
**Commits:** `4039df2`, `17ba2b8`
**Applied fix:** Replaced dynamic JSON serialization with a fixed-tag, length-prefixed canonical encoder; added prototype-pollution regressions; and realigned the namespace-collision mutant with the new encoding contract.

### CR-04: The ledger release gate accepts false green claims and skips required gates

**Status:** fixed: requires human verification
**Files modified:** `scripts/phase-06-mutation-battery.mjs`, `.planning/phases/06-dispatcher/06-VALIDATION.md`
**Commits:** `a6bcdc1`, `db336c8`
**Applied fix:** Made ledger parsing fail closed on exact columns, phases, threats, commands, statuses, detector markers, and live counts; added counterexamples; and made `verify ledgers` execute telemetry, build, typecheck, full tests, packaging, dependency, Node-floor, mocking, and clean-tree gates.

### WR-01: Metadata validation accepts invalid containers and capabilities

**Status:** fixed: requires human verification
**Files modified:** `packages/concierge/src/concierge.ts`, `packages/concierge/test/dispatcher.test.ts`
**Commit:** `2b82c1a`
**Applied fix:** Rejected non-object/null metadata, structurally invalid abort signals, and non-callable delivery hooks before the dispatch pipeline can enter application code.

### WR-02: Q16 and Q17 mutation claims do not discriminate their advertised contracts

**Status:** fixed
**Files modified:** `scripts/phase-06-mutation-battery.mjs`, `.planning/phases/06-dispatcher/06-MUTATION-REGISTER.json`, `.planning/phases/06-dispatcher/06-MUTATION-EVIDENCE.json`
**Commits:** `71fc2e3`, `5cbcf7f`, `00f96c3`
**Applied fix:** Added B22 for nested-result identity, B23 for callId coercion, and B24 for dropped malformed rows; bound their exact Q16/Q17 mappings in definition validation and a negative self-test.

### WR-03: Aliased-graph no-dedup behavior is claimed without a regression detector

**Status:** fixed
**Files modified:** `packages/concierge/test/dispatcher.test.ts`, `scripts/phase-06-mutation-battery.mjs`, `.planning/phases/06-dispatcher/06-MUTATION-REGISTER.json`, `.planning/phases/06-dispatcher/06-MUTATION-EVIDENCE.json`
**Commits:** `175170e`, `bc3689a`
**Applied fix:** Added R69 proving equal aliased graphs neither throw nor deduplicate and S37 proving that an alias-collapsing fallback key fires exactly that detector.

### WR-04: The clean-tree proof omits paths included in revision freshness

**Status:** fixed
**Files modified:** `scripts/phase-06-mutation-battery.mjs`
**Commit:** `54d7f30`
**Applied fix:** Derived the clean-tree scope from the same source, test, fixture, script, manifest, and lockfile inputs used by revision freshness.

### WR-05: Concurrent bounded-range runs can lose or corrupt evidence

**Status:** fixed: requires human verification
**Files modified:** `scripts/phase-06-mutation-battery.mjs`
**Commit:** `559d867`
**Applied fix:** Serialized evidence operations with a Git-common-directory exclusive lock, stale-PID recovery, and unique atomic temporary files.

### WR-06: Evidence shape validation is not bound to its declared schema metadata

**Status:** fixed: requires human verification
**Files modified:** `scripts/phase-06-mutation-battery.mjs`
**Commit:** `1f444fa`
**Applied fix:** Bound evidence schema version, phase, target, detector kind, intended cases, fingerprints, and type diagnostics to the immutable register and added negative self-tests for each field.

## Final Verification

- Immutable register: `af67056a6f683327a252986155c28be5a944d53e17866cc8d4e65ca3481152b3`
- Mutation evidence: 37/37 single, 24/24 batch, 61/61 total, 0 pending
- Full runtime suite: 12 files, 248/248 tests, 0 pending, 0 todo
- `verify ledgers`: green across telemetry, build, typecheck, tests, artifact, dependencies, pack install, Node floor, mocking audit, restoration, and live ledger totals
- Final evidence/ledger commit: `d29505e`

---

_Fixed: 2026-08-07T19:22:17Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
