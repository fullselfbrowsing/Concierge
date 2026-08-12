---
phase: 06-dispatcher
fixed_at: 2026-08-06T17:06:52Z
review_path: .planning/phases/06-dispatcher/06-REVIEW.md
iteration: 2
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-08-06T17:06:52Z  
**Source review:** `.planning/phases/06-dispatcher/06-REVIEW.md`  
**Iteration:** 2

**Summary:**

- Findings in scope: 11
- Fixed: 11
- Skipped: 0

## Fixed Issues

### CR-01: A post-construction schema mutation bypasses argument validation

**Status:** Fixed — requires human verification  
**Files modified:** `packages/concierge/src/catalog.ts`, `packages/concierge/src/dispatch.ts`, `packages/concierge/test/dispatcher.test.ts`  
**Commit:** `6f35fb1`  
**Applied fix:** Captured and bound each Standard Schema validator during catalog construction in a private capability map, then dispatched only through that snapshot. The regression replaces both the live `validate` member and the public `~standard` object after construction and proves neither mutation changes validation.

### CR-02: A reentrant validator escapes the deduplication cache and double-fires

**Status:** Fixed — requires human verification  
**Files modified:** `packages/concierge/src/concierge.ts`, `packages/concierge/test/dispatcher.test.ts`  
**Commit:** `c0a5bcd`  
**Applied fix:** Created and cached the exact dispatch Promise before validation begins by deferring the pipeline to a microtask. A reentrant validator now observes the same Promise and validation and handler execution each occur once.

### CR-03: Mutable cached results let one consumer poison every retry

**Status:** Fixed — requires human verification  
**Files modified:** `packages/concierge/src/dispatch.ts`, `packages/concierge/src/types.ts`, `packages/concierge/test-d/actions.test-d.ts`, `packages/concierge/test-d/results.test-d.ts`, `packages/concierge/test/dispatcher-batch.test.ts`, `packages/concierge/test/dispatcher.test.ts`  
**Commit:** `f1bdf3b`  
**Applied fix:** Made `ActionResult` fields readonly and froze every normalized authored result before it can enter the cache or a batch row. Direct and nested batch regressions prove a consumer cannot poison a later retry.

### CR-04: The runtime freezes handler inputs that the public type says are writable

**Status:** Fixed — requires human verification  
**Files modified:** `packages/concierge/src/index.ts`, `packages/concierge/src/types.ts`, `packages/concierge/test-d/actions.test-d.ts`, `packages/concierge/test-d/dispatcher.test-d.ts`, `packages/concierge/test/dispatcher.test.ts`  
**Commits:** `066a37e`, `b183a26`  
**Applied fix:** Typed handler arguments as recursively readonly and metadata as readonly, with compile-time and runtime coverage for nested values. Kept the recursive helper out of the package entry point so the established 65-name published export surface remains unchanged.

### CR-05: Reserved actions are published in the tool catalog but can never run

**Status:** Fixed — requires human verification  
**Files modified:** `packages/concierge/src/concierge.ts`, `packages/concierge/test/dispatcher.test.ts`  
**Commit:** `37dc16d`  
**Applied fix:** Removed the contradictory reserved-name refusal while retaining authorization-first dispatch and the frozen null-prototype catalog lookup. Declared `constructor` and `__proto__` actions now advertise and dispatch normally; undeclared spellings remain unknown.

### CR-06: Catalog build errors still permit terminal and log-line injection

**Status:** Fixed — requires human verification  
**Files modified:** `packages/concierge/src/catalog.ts`, `packages/concierge/src/host.ts`, `packages/concierge/test/diagnostic-safety.test.ts`  
**Commit:** `ccbf8d3`  
**Applied fix:** Routed catalog diagnostic subjects through a bounded control/format-character encoder while preserving raw structured issue fields separately from display text. Hostile duplicate names and consent targets can no longer inject terminal controls or extra log lines.

### CR-07: The no-telemetry audit allows rejected values through arguments[0]

**Status:** Fixed — requires human verification  
**Files modified:** `scripts/check-no-telemetry.mjs`  
**Commit:** `6939b44`  
**Applied fix:** Rejected zero-parameter classic rejection callbacks and local function declarations that read callback-local `arguments`; arrow callbacks remain valid because they do not bind `arguments`. Self-tests cover `.catch`, second-argument `.then`, and local helper forms.

### CR-08: Unresolved computed channel access fails open in the no-telemetry audit

**Status:** Fixed — requires human verification  
**Files modified:** `scripts/check-no-telemetry.mjs`  
**Commit:** `da1fadd`  
**Applied fix:** Added checker-backed classification for unresolved element access and fail-closed handling of callable reads, calls, installs, compound assignments, `Object.defineProperty`, `Reflect.set`, and external callable assignments. Safe numeric, symbol, and non-callable data operations remain accepted.

### CR-09: Mutation evidence does not track transitive production or test inputs

**Status:** Fixed — requires human verification  
**Files modified:** `scripts/phase-06-mutation-battery.mjs`, `.planning/phases/06-dispatcher/06-MUTATION-REGISTER.json`, `.planning/phases/06-dispatcher/06-MUTATION-EVIDENCE.json`  
**Commits:** `84e9081`, `e79d066`  
**Applied fix:** Built every revision digest from a sorted Git manifest covering all tracked production sources, runtime tests and fixtures, type tests, proof scripts, package manifests, lockfile, and relevant configs, hashing both path and content. Self-tests now invalidate a recorded revision for a non-target source and a non-intended fixture; all 54 mutants were remeasured after the final source change.

### CR-10: Mutation reports discard suite and hook failures when a file has assertions

**Status:** Fixed — requires human verification  
**Files modified:** `scripts/phase-06-mutation-battery.mjs`  
**Commit:** `69b5324`  
**Applied fix:** Retained suite and hook failures regardless of assertion count while filtering only exact assertion-message duplicates. The synthetic reporter self-test rejects an exact expected mutation assertion accompanied by an `afterAll` failure.

### WR-01: Bridge security comments contradict the implemented encoder

**Status:** Fixed  
**Files modified:** `packages/concierge/src/bridge.ts`  
**Commit:** `68d6393`  
**Applied fix:** Replaced the obsolete “never interpolated” claim with durable documentation of bounded encoded diagnostic subjects and the separate rule that caught values are never included.

## Verification

- `pnpm build` — passed; build completed with ATTW and publint clean.
- `pnpm typecheck` — passed.
- `pnpm test` — 12 test files and 235 tests passed.
- `node scripts/check-no-telemetry.mjs --self-test` — 23 malicious findings detected across rejection callbacks, computed names, and channel access.
- `node scripts/check-no-telemetry.mjs` — 11 production files scanned with 0 findings.
- `node scripts/phase-06-mutation-battery.mjs self-test` — full-tree revision invalidation and exact runtime/type fingerprints passed.
- `node scripts/phase-06-mutation-battery.mjs verify all` — register `345318dd1fb2fb5594a05603e6b000333e4e04e60bfb9e0aba468edd21217dd4`; 54 green, 0 pending.
- `pnpm check:artifact` — strict publint and ATTW checks passed.
- `pnpm check:deps` — built runtime graph contains one core module and dependencies contribute 0 bytes.
- `pnpm check:pack` — foreign project installed the tarball, typechecked shipped declarations with `skipLibCheck: false`, and imported the runtime.
- `pnpm check:node-floor` — packed artifact installed and imported under pinned Node v22.12.0.

---

_Fixed: 2026-08-06T17:06:52Z_  
_Fixer: the agent (gsd-code-fixer)_  
_Iteration: 2_
