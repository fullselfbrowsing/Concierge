---
phase: 06-dispatcher
fixed_at: 2026-08-06T18:01:07Z
review_path: .planning/phases/06-dispatcher/06-REVIEW.md
iteration: 3
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-08-06T18:01:07Z  
**Source review:** `.planning/phases/06-dispatcher/06-REVIEW.md`  
**Iteration:** 3

**Summary:**

- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Valid transformed schema outputs can never reach their typed handler

**Status:** Fixed — requires human verification  
**Files modified:** `packages/concierge/src/types.ts`, `packages/concierge/test-d/dispatcher.test-d.ts`, `packages/concierge/test/dispatcher.test.ts`  
**Commit:** `7ca1d6f`  
**Applied fix:** Added a recursive invocation-data contract at the source-module type boundary and made concrete schema outputs outside that contract unable to declare a handler. Type regressions reject `Date` and class-instance outputs while retaining supported plain output types; a runtime transform regression proves a non-plain output fails closed without entering the handler. The helper remains outside the package barrel, preserving the established 65-name public export surface.

### CR-02: Fallback deduplication aliases semantically different arguments

**Status:** Fixed — requires human verification  
**Files modified:** `packages/concierge/src/dispatch.ts`, `packages/concierge/test/dispatcher.test.ts`  
**Commit:** `68bdb5d`  
**Applied fix:** Replaced lossy raw JSON keying with a tagged canonical encoder that distinguishes supported primitives, object keys and prototypes, array holes, non-finite numbers, negative zero, and `bigint`. Cyclic or aliased graphs now return no fallback key instead of sharing a potentially incorrect Promise. Collision regressions cover undefined properties, non-finite numbers, negative zero, and sparse arrays.

### CR-03: A zero or exactly elapsed deduplication window does not expire

**Status:** Fixed — requires human verification  
**Files modified:** `packages/concierge/src/concierge.ts`, `packages/concierge/test/dispatcher.test.ts`  
**Commit:** `e26f857`  
**Applied fix:** Changed settled-entry expiration to include equality at the configured boundary. Regressions cover an exact 600 ms elapsed window and a zero-length window while confirming that an in-flight Promise remains protected by the separate pending-state guard.

### CR-04: Explicit JSON Schema accessors remain a live agent-facing mutation channel

**Status:** Fixed — requires human verification  
**Files modified:** `packages/concierge/src/catalog.ts`, `packages/concierge/src/json-schema.ts`, `packages/concierge/test/concierge.test.ts`  
**Commit:** `f988bfc`  
**Applied fix:** Added descriptor-based, data-only JSON Schema detachment before root validation and publication. Enumerable accessors and unsupported function, symbol, `bigint`, undefined, non-finite, exotic, and cyclic nodes produce a structured catalog issue without invoking hostile getters; accepted explicit and derived schemas are private detached graphs before freezing. Root and nested accessor regressions prove construction never invokes the getters, and an alias regression proves later mutation of the caller's schema cannot change the emitted tool.

### CR-05: The no-telemetry gate still accepts dynamic callable channels

**Status:** Fixed — requires human verification  
**Files modified:** `scripts/check-no-telemetry.mjs`  
**Commit:** `c900a47`  
**Applied fix:** Made unresolved computed elements fail closed when used as a property or call receiver unless checker-backed analysis proves inert data. Descriptor shorthand is now inspected, and `Reflect.defineProperty` is audited beside the existing installation APIs. The malicious self-test includes the dynamic nested callable, shorthand descriptor, and Reflect installation forms while retaining accepted inert-data cases.

### CR-06: Malformed batch JSON can execute an action with defaulted arguments

**Status:** Fixed — requires human verification  
**Files modified:** `packages/concierge/src/dispatch.ts`, `packages/concierge/src/types.ts`, `packages/concierge/test/dispatcher-batch.test.ts`  
**Commit:** `7f5b751`  
**Applied fix:** A batch parse failure now appends a frozen correlated `invalid_args` result and continues without calling the dispatcher, validator, or handler. The public wire-format comment documents the fail-closed behavior, and the batch regression uses a defaulting validator to prove malformed JSON cannot execute while subsequent calls still proceed serially.

### CR-07: A malformed validator success shape is accepted as valid arguments

**Status:** Fixed — requires human verification  
**Files modified:** `packages/concierge/src/dispatch.ts`, `packages/concierge/test/dispatcher.test.ts`  
**Commit:** `e65ec12`  
**Applied fix:** Validation results must now be non-null objects, any present `issues` branch fails, and a success must own or inherit a `value` key. The guarded boundary also converts throwing discriminator and value accessors into `invalid_args`. Regressions cover `{}`, `{ issues: undefined }`, valid `{ value: undefined }`, and a throwing `value` accessor.

## Verification

- Mutation evidence refresh commit: `7f53957` (`test(06): refresh strict mutation evidence`).
- `pnpm build` — passed; ATTW and publint were clean.
- `pnpm typecheck` — passed.
- `pnpm test` — 12 test files and 242 tests passed.
- `node scripts/check-no-telemetry.mjs --self-test` — 26 malicious findings detected across computed names, channel access, and rejection callbacks.
- `node scripts/check-no-telemetry.mjs` — 11 production files scanned with 0 findings.
- `node scripts/phase-06-mutation-battery.mjs self-test` — full-tree revision invalidation and exact runtime/type fingerprints passed.
- `node scripts/phase-06-mutation-battery.mjs run single` — all 34 single-dispatch mutants compiled, fired their intended detector, and restored green.
- `node scripts/phase-06-mutation-battery.mjs run batch` — all 20 batch mutants compiled, fired their intended detector, and restored green.
- `node scripts/phase-06-mutation-battery.mjs verify all` — register `2fa78c31beaaacf85383e28832fca2a01e0526ed17169ad9ec1deb2d3fc58a2a`; 54 green, 0 pending.
- `pnpm check:artifact` — strict publint and ATTW checks passed.
- `pnpm check:deps` — the built runtime graph contains one core module and dependencies contribute 0 bytes.
- `pnpm check:pack` — a foreign project installed the tarball, typechecked the shipped declarations with `skipLibCheck: false`, and imported the runtime.
- `pnpm check:node-floor` — the packed artifact installed and imported under pinned Node v22.12.0.

---

_Fixed: 2026-08-06T18:01:07Z_  
_Fixer: the agent (gsd-code-fixer)_  
_Iteration: 3_
