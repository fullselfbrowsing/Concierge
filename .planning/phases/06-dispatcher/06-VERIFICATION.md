---
phase: 06-dispatcher
verified: 2026-08-06T18:18:24Z
status: gaps_found
score: 14/18 must-haves verified
overrides_applied: 0
gaps:
  - truth: "A malformed invocation still produces one honest result, and retry-key derivation never throws."
    status: failed
    reason: "An untyped JavaScript caller can supply Symbol() as InvocationMeta.callId. snapshotInvocationMeta preserves it, then deriveDispatchKey interpolates it into a template literal and throws TypeError synchronously. The same value in a ToolBatch rejects dispatchBatch before a correlated result row is appended."
    artifacts:
      - path: "packages/concierge/src/concierge.ts"
        issue: "snapshotInvocationMeta copies callId without validating its runtime type, then calls deriveDispatchKey outside a containment catch."
      - path: "packages/concierge/src/dispatch.ts"
        issue: "deriveDispatchKey claims never to throw, but `id:${callId}` throws for Symbol values; batch execution does not contain a rejecting dispatch per row."
      - path: "packages/concierge/test/dispatcher.test.ts"
        issue: "No runtime regression covers malformed metadata primitive types."
      - path: "packages/concierge/test/dispatcher-batch.test.ts"
        issue: "No batch regression proves malformed call metadata still returns one row."
    missing:
      - "Validate/snapshot InvocationMeta primitive fields before key derivation and return a frozen sanitized failure for invalid metadata."
      - "Contain each batch call so malformed metadata cannot reject the whole batch or omit correlation rows."
      - "Add built-artifact single and batch tests for Symbol/invalid callId and other malformed metadata types."
  - truth: "Fallback retry keys follow the locked Phase 6 degradation contract for cyclic and BigInt arguments."
    status: failed
    reason: "The locked CONTEXT and Plan 06-01 say both cyclic and BigInt arguments run without fallback deduplication. The review fix introduced a tagged encoder that safely deduplicates BigInt; R06 now expects one call and Promise identity. The alternative is reasonable but no verification override accepts the contract change."
    artifacts:
      - path: "packages/concierge/src/dispatch.ts"
        issue: "Tagged canonical encoding supports bigint instead of using the locked JSON.stringify failure/no-dedup behavior."
      - path: "packages/concierge/test/dispatcher.test.ts"
        issue: "R06 was changed from the planned no-dedup assertion to require BigInt deduplication."
      - path: ".planning/phases/06-dispatcher/06-CONTEXT.md"
        issue: "Still locks BigInt to the no-dedup path."
    missing:
      - "Either restore the locked BigInt no-dedup behavior or record an explicit accepted override for the injective canonical encoder."
      - "Make the test, context, and requirements evidence describe the same accepted behavior."
  - truth: "Malformed batch JSON degrades to an empty object and is rejected by ordinary action validation before any effect."
    status: failed
    reason: "executeDispatchBatch now authors invalid_args immediately on JSON.parse failure and never calls dispatch or the action validator. This is fail-closed and safer for defaulting validators, but it contradicts roadmap success criterion 3, DSP-06, Plan 06-05, and the current requirements trace. No override accepts the deviation."
    artifacts:
      - path: "packages/concierge/src/dispatch.ts"
        issue: "The parse catch appends invalid_args and continues at lines 581-588, bypassing schema validation."
      - path: "packages/concierge/test/dispatcher-batch.test.ts"
        issue: "Q04 explicitly expects the malformed call not to reach the validator."
      - path: ".planning/REQUIREMENTS.md"
        issue: "DSP-06 still requires `{}` followed by validation and claims Q04 proves validation ran."
    missing:
      - "Reconcile the security fix with the roadmap contract: either restore a safe validation-mediated path or accept an explicit override for direct fail-closed rejection."
      - "Update DSP-06 and its evidence text after the behavior decision is accepted."
  - truth: "Phase 6 requirements and validation records contain only current measured evidence."
    status: failed
    reason: "06-VALIDATION.md records the obsolete mutation digest 01013d... and 211 tests across 11 files, while independent execution produced digest 2fa78c... and 242 tests across 12 files. REQUIREMENTS.md also claims BigInt degradation and malformed-JSON validation that current tests disprove."
    artifacts:
      - path: ".planning/phases/06-dispatcher/06-VALIDATION.md"
        issue: "Mutation digest and full-suite counts are stale after the review fixes."
      - path: ".planning/REQUIREMENTS.md"
        issue: "DSP-02/DSP-06 traceability prose does not match current R06/Q04 behavior."
      - path: "scripts/phase-06-mutation-register.json"
        issue: "Current measured register digest is 2fa78c31beaaacf85383e28832fca2a01e0526ed17169ad9ec1deb2d3fc58a2a, not the digest recorded in validation."
    missing:
      - "Regenerate 06-VALIDATION.md from the current restored source and mutation register."
      - "Correct REQUIREMENTS.md traceability after the BigInt and malformed-JSON contracts are resolved."
---

# Phase 6: Dispatcher Verification Report

**Phase Goal:** A retried, malformed, aborted, or crashing call produces exactly one honest result, and no effect ever fires twice.
**Verified:** 2026-08-06T18:18:24Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The dispatcher implementation is substantive, wired through the built package, mutation-tested, and release-gate clean. Those facts do not establish the complete phase goal. A malformed runtime `callId` can still escape as a `TypeError`, omitting the required honest result and, in a batch, the correlated row. Two post-review hardening changes also diverge from locked roadmap/plan contracts without an accepted override, and the evidence ledgers were not regenerated after those changes.

### Roadmap Success Criteria

| # | Roadmap contract | Status | Evidence |
|---|---|---|---|
| 1 | Same `callId` returns the exact Promise; fallback key uses name+args and unkeyable values degrade without throwing. | ✓ VERIFIED for supported calls | R01/R02 and the independent identity probe prove exact Promise reuse. Cyclic/aliased args return `null`. The stricter locked BigInt decision is separately failed below, and malformed `callId` totality is a phase-goal blocker. |
| 2 | Handler throws and malformed returns become generic sanitized results with no caught-detail telemetry. | ✓ VERIFIED | R34-R45 pass against `dist`; catches do not bind handler errors; the AST audit reports 0 executable telemetry/caught-value findings. |
| 3 | Arguments are revalidated; malformed JSON becomes `{}` and is rejected by validation; missing handlers settle honestly. | ✗ FAILED | Validation and missing-handler behavior pass, but `dispatch.ts:581-588` bypasses the validator for malformed JSON. Q04 confirms `validated` contains only the later valid call. |
| 4 | Batches run serially in stable `outputIndex` order and aborted batches return every row. | ✓ VERIFIED | Q01-Q13 pass; implementation copies/sorts with original-index tie-breaking, awaits each call, freezes rows/container, and fills remaining aborted rows. |
| 5 | Non-read-only effects wait through the commit window, abort cancels them, and dispatch works without Transport. | ✓ VERIFIED | R19, R25-R33, Q10-Q14 pass; source wires validation → cancellable wait → handler, with `effects.readOnly === true` as the only bypass. |

### Observable Truths

The 5 roadmap criteria and 21 PLAN-frontmatter truths were merged and deduplicated into the following 18 observable must-haves. Roadmap wording was retained where a plan restated it.

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | The public single-call API is context-first, non-`async`, and does not infer mutable current-stage state. | ✓ VERIFIED | `types.ts` and `concierge.ts:936-941`; declaration/type gates pass; implementation resolves the stage from `ctx` on every call. |
| 2 | The public batch API is transport-independent and returns frozen inline `callId`/result rows. | ✓ VERIFIED | `concierge.ts:1039-1045`, `dispatch.ts:524-605`, Q08/Q14, and built declaration inspection. |
| 3 | Retries share the exact final Promise while pending and in the settled window, including failures, with exact 600 ms defaults. | ✓ VERIFIED | R01/R02/R20-R24/R22a pass; cache insertion precedes async work and settlement-time `>=` eviction is implemented. |
| 4 | Fallback retry-key degradation follows the locked cyclic/BigInt contract. | ✗ FAILED | Cycles do not dedup, but `dispatcher.test.ts:289-312` now requires BigInt calls to dedup, contrary to `06-CONTEXT.md:88-90` and Plan 06-01. |
| 5 | Off-stage, absent, non-callable, and prototype-key names never enter a handler and settle honestly. | ✓ VERIFIED | Authorization precedes catalog access/cache; null-prototype `catalog.byName` is used; R08-R12 pass. |
| 6 | Action arguments are independently revalidated, transformed values reach handlers, and hostile validator output fails closed. | ✓ VERIFIED | `runStandardValidation` guards sync/async throws, requires a data result with `value`, freezes plain invocation data, and R13-R18/R18a pass. |
| 7 | Validation and a cancellable 600 ms commit window precede every non-read-only effect; scheduler fallback is cancellable. | ✓ VERIFIED | R25-R33 pass; the handler is called only after validation and `waitForCommitWindow`; host structural timer fallback returns a canceller. |
| 8 | Crashes, hostile thenables/getters/proxies, and malformed handler results become fresh sanitized honest results without leaking caught details. | ✓ VERIFIED | R34-R45 pass; allowlist normalization reads only `ok`, `reason`, and `message` under guards; catches contain details. |
| 9 | Every dispatcher-bound message uses one shared sanitizer that strips controls, normalizes whitespace, caps length, and preserves surrogate pairs. | ✓ VERIFIED | `dispatch.ts` imports `sanitizeMessage` from `message.ts`; R47-R51 and sanitizer source checks pass. |
| 10 | The active bridge is resolved through the existing resolver and absence/throwing reads produce `null`. | ✓ VERIFIED | `concierge.ts:863` invokes `resolveBridge(stage)` and passes the result into handler context; R52-R54 pass. |
| 11 | Batch calls execute serially in stable output order with one immutable correlated row and complete metadata forwarding. | ✓ VERIFIED | `dispatch.ts:553-605`; Q01-Q08/Q13/Q15 pass; repeated call IDs reuse single-call cache. |
| 12 | Malformed JSON becomes `{}` and reaches schema validation before rejection while later calls settle. | ✗ FAILED | The parse catch authors `invalid_args` directly. Q04 expects the malformed call never to appear in `validated`; later continuation does pass. |
| 13 | Abort before/during the batch leaves no call unanswered and suppresses later handler entries. | ✓ VERIFIED | Q09-Q12 pass; authored frozen `aborted` results are appended for every remaining call. |
| 14 | Single and batch dispatch work directly from an application loop with no Transport. | ✓ VERIFIED | R19/Q14 pass and neither public method references or constructs a Transport. |
| 15 | Malformed untrusted metadata cannot escape the result boundary or make a batch omit a row. | ✗ FAILED | Independent built-package probes show `callId: Symbol()` throws synchronously from `dispatch` and rejects `dispatchBatch` with no row. |
| 16 | Every named Phase 6 mutation detector demonstrably kills its compiled mutant and the no-telemetry audit has positive controls. | ✓ VERIFIED | Independent `self-test` and `verify all` runs: digest `2fa78c31...`, 54 green, 0 pending; telemetry self-test found all 26 malicious fixtures and live audit found 0. |
| 17 | Build, type, runtime, artifact, dependency, pack, and Node-floor gates pass on restored source. | ✓ VERIFIED | All independently rerun gates exited 0; full suite was 12 files / 242 tests. |
| 18 | Requirements and validation records contain only current measured evidence. | ✗ FAILED | `06-VALIDATION.md:75,93,97` has the prior digest/counts; REQUIREMENTS DSP-02/DSP-06 evidence contradicts current R06/Q04. |

**Score:** 14/18 truths verified

No potential gap matched a later milestone phase goal or success criterion closely enough to defer it. These are Phase 6 boundary and evidence-contract issues.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/concierge/src/types.ts` | Exact dispatcher, batch, scheduler, handler, and result contracts | ✓ VERIFIED | Substantive and exported through the package declaration surface; typecheck and pack declaration consumer pass. |
| `packages/concierge/src/concierge.ts` | Per-instance dispatch/cache implementation and public method wiring | ⚠ PARTIAL | Substantive and wired, but malformed `callId` types are copied and passed to unguarded key derivation. |
| `packages/concierge/src/dispatch.ts` | Keying, validation, wait, normalization, sanitization, and batch execution helpers | ⚠ PARTIAL | Substantive and wired. BigInt/JSON behavior diverges from locked contracts, and Symbol call IDs can throw. |
| `packages/concierge/src/message.ts` | Shared message sanitizer | ✓ VERIFIED | Imported and used by `dispatch.ts`; behavior covered by R47-R51. |
| `packages/concierge/src/host.ts` | Structural cancellable timer fallback | ✓ VERIFIED | Imported through dispatch configuration path; R33 and source checks prove fallback behavior. |
| `packages/concierge/src/json-schema.ts` | Detached safe JSON schema data | ✓ VERIFIED | Descriptor-based detachment rejects accessors/non-data and avoids aliasing; review regressions pass. |
| `packages/concierge/src/index.ts` | Public package surface | ✓ VERIFIED | Build, publint, ATTW, pack install/typecheck, and runtime import pass. |
| `packages/concierge/test-d/dispatcher.test-d.ts` | Exact public type pins and invalid transformed-output rejection | ✓ VERIFIED | Substantive and exercised by `pnpm --filter @fullselfbrowsing/concierge typecheck`. |
| `packages/concierge/test/dispatcher.test.ts` | Built-artifact single-call runtime proof | ⚠ PARTIAL | 68 cases pass, but R06 contradicts the locked BigInt decision and no malformed-metadata case exists. |
| `packages/concierge/test/dispatcher-batch.test.ts` | Built-artifact batch runtime proof | ⚠ PARTIAL | 16 cases pass, but Q04 now proves validator bypass rather than the roadmap requirement; no malformed-callId completeness case exists. |
| `scripts/check-no-telemetry.mjs` | Structural no-telemetry/caught-detail audit with positive controls | ✓ VERIFIED | Self-test and live audit independently pass. |
| `scripts/phase-06-mutation-battery.mjs` | Immutable-register mutation executor | ✓ VERIFIED | Self-test and `verify all` independently pass with 54/54 green. |
| `scripts/phase-06-mutation-register.json` | Complete named mutation register | ✓ VERIFIED | 54 rows; current digest `2fa78c31beaaacf85383e28832fca2a01e0526ed17169ad9ec1deb2d3fc58a2a`. |
| `scripts/phase-06-mutation-evidence.json` | Measured mutation evidence | ✓ VERIFIED | 54 green, 0 pending after independent execution. |
| `.planning/phases/06-dispatcher/06-VALIDATION.md` | Current measured Phase 6 evidence | ✗ STALE | Still records digest `01013d...` and 211/211 tests across 11 files. |
| `.planning/REQUIREMENTS.md` | Accurate Phase 6 requirement and traceability state | ✗ STALE | DSP-06 is not implemented as written; DSP-02/DSP-06 evidence text misstates current R06/Q04. |

### Key Link Verification

Automated PLAN link queries produced several path/regex false negatives (dynamic `DIST_URL` imports, `resolveBridge(stage)`, and the internal helper name `executeDispatchBatch`). Each was checked manually rather than accepted from the heuristic.

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `test-d/dispatcher.test-d.ts` | `src/types.ts` | exact public signatures and negative type cases | ✓ WIRED | Typecheck passes. |
| `test/dispatcher.test.ts` | `dist/index.js` | built-artifact dynamic import | ✓ WIRED | 68 dispatcher cases pass in the 124-test focused run. |
| `test/dispatcher-batch.test.ts` | `dist/index.js` | built-artifact dynamic import | ✓ WIRED | 16 batch cases pass in the focused run. |
| `concierge.ts` | `catalog.namesByStage` / `catalog.byName` | authorization then frozen lookup | ✓ WIRED | Lines 943-960; prototype/off-stage tests pass. |
| `concierge.ts` | `deriveDispatchKey` | post-snapshot retry identity | ⚠ PARTIAL | Normal typed inputs work; malformed Symbol call IDs escape. |
| `concierge.ts` | `resolveBridge` | active-stage bridge resolution | ✓ WIRED | Line 863 and R52-R54. |
| `concierge.ts` | `executeDispatchBatch` | `dispatchBatch` delegation | ✓ WIRED | Lines 1039-1045. |
| `executeDispatchBatch` | public `dispatch` | serial per-call await | ✓ WIRED | Line 599 and Q03/Q13. |
| `dispatch.ts` | `message.ts` | `sanitizeMessage` for authored/handler results | ✓ WIRED | Import at line 12; call at line 434. |
| `dispatch` | validator → commit wait → bridge → handler → normalizer | single result pipeline | ✓ WIRED | R13-R54 cover the chain; malformed metadata fails before this pipeline. |
| `06-VALIDATION.md` | mutation register/evidence | recorded digest and gate counts | ✗ NOT CURRENT | Recorded digest/counts do not match current measured artifacts. |
| `REQUIREMENTS.md` | Q04/R06 evidence | named test assertions | ✗ CONTRADICTED | The named tests assert the opposite of two traceability claims. |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| `Concierge.dispatch` | `ctx`, `name`, invocation args/meta | Application caller → stage catalog → schema validator | Yes | ✓ FLOWING for typed/ordinary inputs; malformed Symbol metadata escapes before the pipeline. |
| `runDispatchPipeline` | validated args, bridge, handler result | Standard Schema validator → commit window → resolver → registered handler | Yes | ✓ FLOWING; transformed data reaches handler and normalized output reaches caller. |
| `executeDispatchBatch` | sorted calls and result rows | Caller `ToolBatch` → copied/sorted snapshots → serial dispatch | Yes | ✓ FLOWING for ordinary calls; malformed JSON is static fail-closed, while malformed call ID can disconnect the row. |
| `sanitizeMessage` | authored/handler message | Dispatcher result normalizer | Yes | ✓ FLOWING; every authored and normalized handler result is frozen after sanitization. |
| mutation evidence | per-mutant result | Immutable register → runner → actual compile/test/restore commands | Yes | ✓ FLOWING; 54 measured green rows. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Exact retry identity and one invocation | inline Node ESM probe against `packages/concierge/dist/index.js` | `retryIdentity:true`, `retryCalls:1` | ✓ PASS |
| Current BigInt behavior | same single-call probe | `bigintIdentity:true`, `bigintCalls:1` | ✗ FAIL against locked Context/Plan; implementation is internally consistent |
| Malformed JSON validation path | same built-package probe with a counting validator | `malformedValidated:0`, `malformedHandled:0`, result `invalid_args` | ✗ FAIL against DSP-06/roadmap |
| Malformed single-call metadata containment | same probe with `callId: Symbol()` | `returnedPromise:false`, `errorClass:"TypeError"` | ✗ FAIL |
| Malformed batch metadata completeness | inline Node ESM batch probe with `callId: Symbol()` | `resolved:false`, `errorClass:"TypeError"`; no result rows | ✗ FAIL |
| Focused Phase 6 runtime suites | `pnpm exec vitest run packages/concierge/test/dispatcher.test.ts packages/concierge/test/dispatcher-batch.test.ts packages/concierge/test/concierge.test.ts packages/concierge/test/diagnostic-safety.test.ts` | 4 files, 124/124 passed | ✓ PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` files or missing documented probe paths were found. The phase's declared executable proof scripts were run directly as required.

| Probe | Command | Result | Status |
|---|---|---|---|
| Telemetry audit positive controls | `node scripts/check-no-telemetry.mjs --self-test` | 26 malicious fixtures detected | ✓ PASS |
| Live no-telemetry audit | `node scripts/check-no-telemetry.mjs` | 11 production files parsed; 0 findings | ✓ PASS |
| Mutation runner self-test | `node scripts/phase-06-mutation-battery.mjs self-test` | self-test passed | ✓ PASS |
| Complete Phase 6 mutation proof | `node scripts/phase-06-mutation-battery.mjs verify all` | digest `2fa78c31...`; 54 green, 0 pending | ✓ PASS |

### Release Gate Execution

| Gate | Result | Status |
|---|---|---|
| `pnpm build` | 4 artifacts, 662.49 kB; embedded ATTW/publint clean | ✓ PASS |
| `pnpm --filter @fullselfbrowsing/concierge typecheck` | exit 0 | ✓ PASS |
| `pnpm test` | 12 files, 242/242 tests passed | ✓ PASS |
| `pnpm check:artifact` | publint strict and ATTW profiles green | ✓ PASS |
| `pnpm check:deps` | one chunk/module, zero runtime dependency bytes | ✓ PASS |
| `pnpm check:pack` | foreign install, declaration consumer, and runtime import pass | ✓ PASS |
| `pnpm check:node-floor` | packed artifact imports on Node 22.12.0 | ✓ PASS |

### Requirements Coverage

All 12 Phase 6 requirement IDs declared by the plans are present in REQUIREMENTS.md. No Phase 6 requirement is orphaned from plan frontmatter.

| Requirement | Source plan | Description | Status | Evidence |
|---|---|---|---|---|
| DSP-01 | 06-01, 06-04, 06-06 | Same-callId exact Promise identity | ✓ SATISFIED | R01/R02 and independent identity probe. |
| DSP-02 | 06-01, 06-04, 06-06 | Fallback name+args key; unkeyable input does not throw | ✓ SATISFIED at requirement level | Canonical encoder is injective for supported data and cycles/aliases return no key. Locked BigInt no-dedup detail remains an unaccepted plan deviation. |
| DSP-03 | 06-01, 06-04, 06-06 | Handler crash returns generic result without detail leakage | ✓ SATISFIED | R34-R36; telemetry audit clean. |
| DSP-04 | 06-01, 06-04, 06-06 | Missing handler settles honestly | ✓ SATISFIED | R11/R12 and source branches. |
| DSP-05 | 06-01, 06-04, 06-06 | Independent schema revalidation | ✓ SATISFIED | R13-R18/R18a. |
| DSP-06 | 06-02, 06-05, 06-06 | Malformed JSON becomes `{}` and is then rejected by validation | ✗ BLOCKED | Current code/test deliberately bypass the validator. |
| DSP-07 | 06-02, 06-05, 06-06 | Serial ordered complete batch results | ✓ SATISFIED | Q01-Q13 for typed/ordinary batch inputs. |
| DSP-08 | 06-01, 06-04, 06-06 | Commit window and abort cancellation | ✓ SATISFIED | R20-R33 and Q10-Q12. |
| DSP-09 | 06-01, 06-04, 06-06 | Malformed handler return normalization | ✓ SATISFIED | R37-R45. |
| SEC-02 | 06-01, 06-04, 06-06 | No thrown error messages in telemetry | ✓ SATISFIED structurally | No telemetry surface exists; AST audit finds no emission/caught-value path. |
| SEC-06 | 06-01, 06-03, 06-04, 06-06 | Sanitize every outgoing ActionResult message | ✓ SATISFIED | R47-R51 and shared sanitizer wiring. |
| TRN-04 | 06-01, 06-02, 06-05, 06-06 | Direct operation with no transport | ✓ SATISFIED | R19/Q14 and source dependency trace. |

### Review Finding Disposition

SUMMARY and REVIEW-FIX claims were not treated as evidence. Each iteration-3 finding was checked against source and independent gates.

| Finding | Claimed fix | Verification disposition |
|---|---|---|
| CR-01 | Constrain non-invocation-data schema outputs | ✓ VERIFIED — recursive type boundary is present; negative type cases and runtime fail-closed regression pass. |
| CR-02 | Replace lossy JSON fallback key with tagged canonical encoder | ⚠ IMPLEMENTED, CONTRACT UNRESOLVED — collision fix works, but it changes locked BigInt behavior without override. |
| CR-03 | Expire settled dedup entries at exact boundary | ✓ VERIFIED — `>=` boundary and zero/exact-window regressions pass. |
| CR-04 | Detach JSON schema data without invoking accessors/retaining aliases | ✓ VERIFIED — descriptor-based clone and hostile/alias regressions pass. |
| CR-05 | Strengthen no-telemetry AST audit | ✓ VERIFIED — 26 positive controls fire and live scan is clean. |
| CR-06 | Reject malformed batch JSON before a defaulting validator | ⚠ IMPLEMENTED, CONTRACT UNRESOLVED — security fix works but contradicts roadmap/DSP-06 without override. |
| CR-07 | Reject malformed Standard Schema results structurally | ✓ VERIFIED — `issues` presence and missing-`value` cases fail closed. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `packages/concierge/src/dispatch.ts` | 215 | Unchecked Symbol coercion inside a function documented as never throwing | 🛑 BLOCKER | Malformed single call throws; batch rejects and omits the correlated row. |
| `packages/concierge/src/dispatch.ts` | 581 | Parse catch returns before schema validation | 🛑 BLOCKER against contract | Safe fail-closed behavior, but Roadmap SC3/DSP-06 are not achieved as written. |
| `.planning/phases/06-dispatcher/06-VALIDATION.md` | 75 | Stale immutable-register digest | ⚠ WARNING | Evidence is no longer reproducible from the documented digest. |
| `.planning/phases/06-dispatcher/06-VALIDATION.md` | 97 | Stale 211/211, 11-file test count | ⚠ WARNING | Current measured suite is 242/242 across 12 files. |

No unreferenced `TBD`, `FIXME`, or `XXX` debt markers were found in Phase 6 source/review files. No Vitest/Jest mocking APIs were found in the dispatcher suites. Apparent empty-value matches were initialization/test fixtures with real population paths, not user-visible stubs.

### Human Verification Required

None. This is a library/API phase; visual, real-time, external-service, and subjective UX checks are not part of its goal. The review report's generic “requires human verification” labels were resolved by source inspection, built-artifact probes, and independent gate execution. The status remains `gaps_found` because automated evidence proves blockers, not because evidence is uncertain.

### Override Suggestions for Intentional Deviations

The BigInt canonical key and direct malformed-JSON rejection appear intentional and defensible. They cannot count as passing until a developer explicitly accepts them. Suggested entries:

```yaml
overrides:
  - must_have: "Fallback retry keys use name plus JSON.stringify(args), and BigInt degrades to no dedup."
    reason: "The tagged canonical encoder represents BigInt injectively and avoids unsafe collisions, so exact retry identity is safe for BigInt while cycles/aliases still degrade to no dedup."
    accepted_by: "{name}"
    accepted_at: "{ISO timestamp}"
  - must_have: "Malformed JSON degrades to {} and is then rejected by validation."
    reason: "Direct invalid_args rejection is fail-closed and prevents a defaulting validator from turning malformed wire input into an effectful valid call."
    accepted_by: "{name}"
    accepted_at: "{ISO timestamp}"
```

These overrides would resolve the intentional contract deviations only. They would not resolve the malformed metadata exception or the stale evidence ledgers.

### Gaps Summary

The runtime core satisfies most safety properties and all standard gates, but the phase goal is not fully achieved. The highest-risk gap is result totality: malformed `callId` metadata can escape the synchronous API and reject a whole batch. Separately, two security-motivated review fixes changed locked behavior without accepted overrides, and the requirements/validation records still claim the pre-fix semantics and measurements. No later phase clearly owns these issues.

---

_Verified: 2026-08-06T18:18:24Z_
_Verifier: the agent (gsd-verifier)_
