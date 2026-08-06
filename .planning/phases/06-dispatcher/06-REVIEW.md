---
phase: 06-dispatcher
reviewed: 2026-08-06T05:23:22Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - packages/concierge/src/bridge.ts
  - packages/concierge/src/concierge.ts
  - packages/concierge/src/dispatch.ts
  - packages/concierge/src/host.ts
  - packages/concierge/src/index.ts
  - packages/concierge/src/message.ts
  - packages/concierge/src/types.ts
  - packages/concierge/test-d/dispatcher.test-d.ts
  - packages/concierge/test/concierge.test.ts
  - packages/concierge/test/dispatcher-batch.test.ts
  - packages/concierge/test/dispatcher.test.ts
  - scripts/check-no-telemetry.mjs
  - scripts/phase-06-mutation-battery.mjs
findings:
  critical: 13
  warning: 1
  info: 0
  total: 14
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-08-06T05:23:22Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The production build, 93 scoped Vitest cases, package typecheck, 54-row mutation verification, and no-telemetry audit all pass. Those gates do not cover the adversarial cases below. Direct runtime probes reproduced authorization replay across stages, mutation of queued calls and validated arguments, commit-window bypass, a cancellation race, cross-realm Promise rejection, and diagnostic failures escaping the result boundary. The two audit scripts also contain fail-open paths that can certify stale or incorrectly killed mutants and forbidden dynamic channels.

## Narrative Findings (AI reviewer)

The findings below come from direct per-file review and call-chain tracing. No structural pre-pass was supplied.

## Critical Issues

### CR-01: Mutating the supplied stage array desynchronizes routing from authorization

**Classification:** BLOCKER
**File:** `packages/concierge/src/concierge.ts:331-335,426,593-599,635-639,688-705`
**Issue:** `createConcierge` keeps `config.stages` by reference. `namesByStage` is snapshotted once, but `resolveIndex` and bridge resolution continue reading the live array. Reordering the caller's array after construction therefore makes an index refer to one stage's live matcher and another stage's snapshotted allowlist. A runtime probe that reversed `[stageA, stageB]` after construction reported stage B while offering and successfully dispatching stage A's action; stage B's own action was rejected as `unknown_action`. This is an authorization-boundary failure, not merely stale presentation state.

**Fix:** Build one private stage snapshot before constructing the catalog or any parallel indexes, and use only that snapshot thereafter. Copy each stage's `id`, `match`, action references/names, and bridge into an internal record; do not retain the caller's collection. Add a regression test that mutates both the source array and stage objects after `createConcierge` and verifies routing, catalog projection, bridge selection, and dispatch remain aligned.

### CR-02: Deduplication replays an authorized result in a stage where the action is forbidden

**Classification:** BLOCKER
**File:** `packages/concierge/src/dispatch.ts:37-50`; `packages/concierge/src/concierge.ts:688-705,848-867`
**Issue:** The cache key contains only `callId`, or action name plus serialized arguments, and the cache is consulted before resolving or authorizing the current stage. Dispatching an action successfully in stage A and then dispatching the same name/arguments in stage B returns the exact cached Promise and success even though stage B does not allow the action. The reproduced handler ran once and both calls returned its success; without the cache, the second call correctly returned `unknown_action`. An earlier off-stage failure can likewise poison a later valid dispatch during the dedupe window.

**Fix:** Resolve the stage exactly once at dispatch entry and perform the current-stage allowlist check before honoring any cache hit. Namespace fallback keys by the resolved stage/authorization domain. If `callId` must remain globally authoritative, still authorize the requested action in the current context before returning its cached Promise, and pass the already-resolved index into the pipeline so matcher side effects cannot change the decision.

### CR-03: A queued batch executes caller rewrites made after dispatch starts

**Classification:** BLOCKER
**File:** `packages/concierge/src/dispatch.ts:354-392`; `packages/concierge/src/types.ts:1151-1157,1178-1211`
**Issue:** `dispatchToolBatch` copies wrapper objects but retains each original mutable `ToolCall`, then reads its name, arguments, output index, ID, and batch metadata after earlier serial calls have awaited. A caller can modify a later call while the first handler is pending. A runtime probe changed an originally safe second call into `danger`, rewrote its arguments to `999`, and replaced its call ID; the dispatcher executed `danger:999` and emitted the rewritten ID. The writable interface fields make this easy even in typed consumers.

**Fix:** Before the first `await`, synchronously snapshot every call into a plain internal record containing `callId`, `name`, `arguments`, and `outputIndex`, and snapshot all batch metadata used for every row. Sort, parse, dispatch, and correlate only those snapshots. Mark `ToolCall` and `ToolBatch` envelope fields `readonly` as compile-time defense, but keep the runtime copy because JavaScript callers and casts bypass the type system.

### CR-04: Validated arguments and invocation metadata remain caller-owned across the commit wait

**Classification:** BLOCKER
**File:** `packages/concierge/src/concierge.ts:728-767,797-806,848-856`
**Issue:** Validation happens before the commit-window await, and a conforming Standard Schema validator may return the original object as `validation.value`. The handler later receives that same mutable object. `meta` is also read once to derive the cache key and later passed by reference to the handler. In a runtime probe, the caller changed `{amount: 10}` to `{amount: 999}` and `callId: "original"` to `"rewritten"` while the scheduler was pending; the handler observed both rewritten values even though validation and dedupe had already used the originals. This permits unvalidated values to reach side-effecting handlers and makes handler identity disagree with cache identity.

**Fix:** Establish an invocation snapshot at the synchronous dispatch boundary. Detach the JSON-shaped arguments (or detach and freeze the successful validated output) and copy every known metadata field into a new internal object; use the same snapshot for key derivation, cancellation, commit waiting, and handler invocation. If detachment fails, return a stable authored failure. Add a test with a validator that deliberately returns its input by reference and mutate the input/meta while the commit scheduler is pending.

### CR-05: Mutable getters and a live scheduler can bypass the commit window

**Classification:** BLOCKER
**File:** `packages/concierge/src/concierge.ts:331-335,756-764`
**Issue:** The side-effect decision reads `entry.action.effects?.readOnly` at invocation time, and `config.scheduler` is also re-read from the caller-owned config at invocation time. Freezing an effects object does not freeze an accessor's closed-over state. A reproduced `readOnly` getter changed from `false` to `true` after construction; the non-readonly handler then ran immediately and the configured scheduler was never called. A throwing getter also rejects the dispatch instead of returning an `ActionResult`. Separately, replacing `config.scheduler` after construction caused the replacement scheduler—not the one used to create the Concierge—to control the gate.

**Fix:** During construction, copy `readOnly` into a fixed boolean data property in an internal action record and capture `const scheduler = config.scheduler` once. Treat accessor failures as invalid configuration at construction, or convert them to a fail-closed authored result before execution. Never make the commit decision by reading consumer-owned configuration after creation.

### CR-06: Aborting during bridge resolution still permits the handler to run

**Classification:** BLOCKER
**File:** `packages/concierge/src/concierge.ts:784-806`
**Issue:** The last abort check occurs before `resolveBridge(stage)`, which invokes a consumer-supplied registry read. That call can synchronously abort the signal and return a bridge, after which the handler runs without another check. A runtime probe used a registry whose `read()` aborted the signal; `signal.aborted` became true, yet the side-effecting handler ran and returned success. This leaves a cancellation gap immediately before the effect boundary.

**Fix:** Re-check the captured signal immediately after bridge resolution and before calling the handler, returning the authored `aborted` result if it changed. Keep all remaining consumer-controlled pre-handler operations before that final check, and add a test whose bridge registry aborts during `read()`.

### CR-07: Cross-realm Promises are treated as invalid synchronous results

**Classification:** BLOCKER
**File:** `packages/concierge/src/concierge.ts:799-825`
**Issue:** The dispatcher awaits only values satisfying `handlerReturn instanceof Promise`. A genuine Promise created in another realm (for example an iframe or Node `vm` context) fails that identity check and is passed directly to result normalization. A reproduced cross-realm handler returned a fulfilled valid `ActionResult`, but dispatch returned `invalid_result`. Promise-compatible thenables declared by interoperating libraries fail the same way.

**Fix:** Assimilate the handler result through normal Promise semantics inside the existing error boundary, for example `handlerResult = await handlerReturn`, regardless of realm. Catch both synchronous handler throws and asynchronous rejection and map them to `handler_error`. Add a cross-realm Promise regression case.

### CR-08: The diagnostic sink can reject dispatches and leak host exceptions

**Classification:** BLOCKER
**File:** `packages/concierge/src/host.ts:136-138`; `packages/concierge/src/concierge.ts:428-434,497-504,718-720,777-780,828-839`
**Issue:** `warnHost` optional-chains only `console`, then invokes `warn` without checking that it is callable or catching a getter/call failure. Diagnostics are invoked from matcher recovery and the dispatch pipeline without a protective boundary. With `console.warn` set to a function that throws `"broken console"`, a throwing stage matcher made `dispatch()` reject with that host message instead of resolving exactly one authored failure. Missing/noncallable `warn` and throwing accessors have the same effect.

**Fix:** Make `warnHost` total: read `globalThis.console` and `warn` in guarded `try` blocks, check `typeof warn === "function"`, invoke it with the console receiver, and swallow sink failures. Add tests for absent console, missing/noncallable/throwing `warn`, and a throwing `warn` getter. Keep an explicitly supplied build diagnostic hook's fatal behavior separate if that is the documented contract.

### CR-09: Unescaped diagnostic subjects permit terminal and log injection

**Classification:** BLOCKER
**File:** `packages/concierge/src/bridge.ts:153-160,780-839`; `packages/concierge/src/concierge.ts:151-158,497-504,718-720,828-839`
**Issue:** Bridge IDs, snapshot keys, stage IDs, and action names are interpolated directly into log lines. These values are not constrained to single-line printable text; snapshot keys in particular may originate from data. A bridge ID containing a newline produced a second forged `concierge:` log line, and ANSI/control sequences can manipulate terminal output. The ActionResult sanitizer does not cover diagnostics. This is log injection and can misattribute or hide security-relevant warnings.

**Fix:** Route every interpolated diagnostic subject through one encoder that escapes quotes, backslashes, line separators, C0/C1 controls, ANSI escape bytes, and other format controls, while imposing a per-subject length bound. JSON-style quoted encoding with explicit control-character handling is suitable. Add newline, carriage-return, ANSI, bidi-control, and oversized-subject tests for each warning family.

### CR-10: Mutation verification accepts evidence from an older source or test revision

**Classification:** BLOCKER
**File:** `scripts/phase-06-mutation-battery.mjs:1395-1405,1420-1458`
**Issue:** `runGroup` skips every row already marked green. `verify` checks only that the row's historical `targetHashBefore` equals its historical `targetHashAfter`; it never compares either value with the current target file, test file, mutant definition, build configuration, or lockfile. Consequently, a later production or test change can preserve the mutation literal while invalidating the claimed detector, yet `verify all` continues to report the old row as green. This makes the required mutation gate replayable rather than evidence about the reviewed revision.

**Fix:** Store a revision digest per row covering the target source, intended tests, mutant definition, package/build/typecheck configuration, and dependency lock inputs. Recompute it in both `runGroup` and `verify`; stale rows must be rerun or rejected. At minimum, compare the current target hash with `row.targetHashBefore`, but that alone does not protect against weakened tests.

### CR-11: Any failure in the named test is credited as killing a runtime mutant

**Classification:** BLOCKER
**File:** `scripts/phase-06-mutation-battery.mjs:911-955,979-991,1196-1229`
**Issue:** Runtime detection checks only that the selected case IDs have status `failed`; it does not verify the expected assertion, error class, or failure fingerprint. A mutant that causes an unrelated `TypeError`, setup failure inside the same named test, or a different assertion to fail is therefore credited as proving the intended invariant. The type detector similarly searches for expected substrings while permitting arbitrary additional diagnostics. The report summarizer also omits suite-level errors and unhandled-error state. These false positives undermine the central evidence claim even when every row is green.

**Fix:** Give each mutant an exact expected failure fingerprint (prefer a dedicated marker/assertion message), parse all assertion and suite/unhandled failures, and require the exact expected failure set with no infrastructure errors. For type mutants, parse diagnostic codes and source locations and require the exact expected diagnostic multiset, rejecting extra diagnostics. Record those normalized fingerprints in evidence and revalidate them in `verify`.

### CR-12: The no-telemetry audit explicitly accepts dynamic computed channel names

**Classification:** BLOCKER
**File:** `scripts/check-no-telemetry.mjs:173-199,297-343`
**Issue:** `inspectNamedShape` treats every `ComputedPropertyName` as handled but does not evaluate or reject its expression. The recursive token scan catches literal forbidden tokens, but `const key = "tele" + "metry"; const channel = { [key]: sink }` creates the prohibited channel without any single forbidden identifier or string token. Equivalent computed assignments also pass. This contradicts the audit's fail-closed purpose and lets the gate report zero findings for a real telemetry surface.

**Fix:** Reject nonliteral computed declaration/property/element names as ambiguous, or constant-fold only a deliberately small safe expression subset and inspect the resolved string. Apply the same rule to computed reads/writes and destructuring. Add self-tests containing concatenated, template-composed, and aliased forbidden names and require the audit to fail.

### CR-13: Rejection callbacks can forward caught exceptions outside the audit's catch-clause model

**Classification:** BLOCKER
**File:** `scripts/check-no-telemetry.mjs:260-295,297-343`
**Issue:** Caught-value enforcement runs only for TypeScript `CatchClause` nodes. Promise rejection handlers such as `operation.catch(error => authoredResult(false, String(error)))` and the second callback to `.then(...)` bind and forward an exception without creating a `CatchClause`, so they pass unless a coincidental forbidden token is present. Helper-based rejection forwarding has the same gap. This allows exactly the exception-to-result leak the audit claims to prevent.

**Fix:** Inspect `.catch` callbacks and second `.then` callbacks in result-path files, rejecting bound rejection parameters or tracking every use with the same forwarding rule. For robust coverage, build a TypeScript program and perform symbol/data-flow analysis through local helper calls. Add audit fixtures for Promise callbacks, aliased parameters, destructuring, and helper forwarding.

## Warnings

### WR-01: Invalid timing windows silently disable or corrupt gate semantics

**Classification:** WARNING
**File:** `packages/concierge/src/concierge.ts:331-335,645-663,764-768`
**Issue:** `commitWindowMs` and `dedupeWindowMs` accept any JavaScript number. Negative, `NaN`, and infinite values reach timer and expiry arithmetic. Host timers commonly clamp invalid or overflowing delays to an almost immediate callback, while comparisons against `NaN`/`Infinity` can retain settled dedupe entries indefinitely. The result is a silently skipped commit grace period or a cache lifetime that does not match configuration.

**Fix:** Validate both values once during construction with `Number.isFinite(value) && value >= 0` and either throw a clear configuration error or apply one documented clamp. Add boundary tests for zero, negative values, `NaN`, and both infinities.

---

_Reviewed: 2026-08-06T05:23:22Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
