---
phase: 06-dispatcher
reviewed: 2026-08-06T17:24:41Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - packages/concierge/src/bridge.ts
  - packages/concierge/src/catalog.ts
  - packages/concierge/src/concierge.ts
  - packages/concierge/src/dispatch.ts
  - packages/concierge/src/host.ts
  - packages/concierge/src/index.ts
  - packages/concierge/src/message.ts
  - packages/concierge/src/types.ts
  - packages/concierge/test-d/actions.test-d.ts
  - packages/concierge/test-d/dispatcher.test-d.ts
  - packages/concierge/test-d/results.test-d.ts
  - packages/concierge/test/concierge.test.ts
  - packages/concierge/test/diagnostic-safety.test.ts
  - packages/concierge/test/dispatcher-batch.test.ts
  - packages/concierge/test/dispatcher.test.ts
  - scripts/check-no-telemetry.mjs
  - scripts/phase-06-mutation-battery.mjs
findings:
  critical: 7
  warning: 0
  info: 0
  total: 7
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-08-06T17:24:41Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Ten of the eleven iteration-2 findings are fixed. The computed-channel audit
fix is incomplete: two new forms still pass with zero findings. This review also
reproduced six independent runtime defects at dispatcher, schema, and
deduplication boundaries. The most consequential paths can suppress a distinct
action call, execute a batch action from malformed JSON, or expose mutable
agent-facing schema content after construction.

The normal gates remain green despite these defects. Independently rerun at this
revision: `pnpm build`, `pnpm test` (235/235), `pnpm typecheck`, both
no-telemetry audit modes, the mutation-battery self-test, and `verify all`
(54 green, 0 pending). These are coverage gaps, not baseline gate regressions.

## Narrative Findings (AI reviewer)

### Iteration-2 finding disposition

| Prior finding | Current disposition |
| --- | --- |
| CR-01: mutable validator capability | **Resolved.** `captureValidator()` stores a guarded, receiver-preserving capability in `validatorByEntry`; dispatch no longer reads the public validator method live. |
| CR-02: validator reentrancy before cache publication | **Resolved.** The pipeline now starts in a microtask after the Promise is published at `concierge.ts:1018-1034`. |
| CR-03: mutable cached `ActionResult` | **Resolved.** Core freezes normalized results and the exported fields are readonly. |
| CR-04: writable handler input types | **Resolved.** `ActionHandler` now exposes deep-readonly arguments and readonly metadata. |
| CR-05: advertised reserved names rejected by dispatch | **Resolved.** Authorization and null-prototype catalog lookup now treat `constructor` and `__proto__` as ordinary declared names. |
| CR-06: catalog diagnostic line injection | **Resolved.** Display-only subject and line encoders bound and encode dynamic diagnostic text. |
| CR-07: zero-parameter rejection callback reads `arguments[0]` | **Resolved.** Classic callbacks are traversed for callback-local `arguments`. |
| CR-08: unresolved computed telemetry channels | **Not resolved.** The checker handles the fixtures added by the fix, but current CR-05 demonstrates two remaining zero-finding bypasses. |
| CR-09: stale mutation evidence after transitive input changes | **Resolved.** The revision digest now hashes a sorted tracked-file manifest across production, tests, proof scripts, lockfile, manifests, and configs. |
| CR-10: assertion failures hide suite/hook failures | **Resolved.** Suite-level messages are retained unless they exactly duplicate an assertion message, and the self-test covers an adjacent hook failure. |
| WR-01: obsolete bridge security comments | **Resolved.** The comments now describe the implemented structural encoder. |

### Critical Issues

#### CR-01: Valid transformed schema outputs can never reach their typed handler

**Classification:** BLOCKER
**File:** `packages/concierge/src/concierge.ts:799-808`
**Related:** `packages/concierge/src/dispatch.ts:29-60`,
`packages/concierge/src/types.ts:19-20`,
`packages/concierge/src/types.ts:938-970`
**Issue:** The public contract accepts every `StandardSchemaV1` output type and
types the handler from `InferOutput<Schema>`. Standard Schema transformations
can legitimately produce `Date`, class instances, or nested non-plain objects.
After validation, however, `snapshotInvocationValue()` rejects every object
whose prototype is not plain. A probe using a valid schema result
`{ value: new Date(...) }` returned `invalid_args` and never entered the handler,
even though a handler for that output is accepted by the published type. This
also contradicts `validateArguments()`'s stated contract that transformed
values reach the handler.

**Fix:** Make the type and runtime boundary identical. Either constrain schema
outputs to an exported recursive invocation-data type in `ActionDefinition` and
`defineAction`, with negative type tests for `Date`/class outputs, or support the
full advertised output population with a clone/freeze strategy that preserves
those values. Add a runtime case for a transformed non-plain output and a type
test for the chosen policy.

#### CR-02: Fallback deduplication aliases semantically different arguments

**Classification:** BLOCKER
**File:** `packages/concierge/src/dispatch.ts:112-136`
**Related:** `packages/concierge/src/concierge.ts:970-1015`,
`packages/concierge/src/types.ts:693-702`
**Issue:** With no `callId`, the cache key is raw `JSON.stringify(args)`, which
is not injective over values accepted by `snapshotInvocationValue()`. For
example, `{}` and `{ omitted: undefined }` serialize identically; so do `NaN`
and `null`, and sparse/undefined array slots and `null`. A direct probe dispatched
`{}` and `{ omitted: undefined }` concurrently and observed the same Promise,
one handler call, and the first result for both requests. The second action is
silently suppressed even though a validator or handler can distinguish the two
inputs.

**Fix:** Use a tagged canonical encoding that distinguishes every supported
primitive, own key, and array slot. If a value cannot be encoded injectively,
return `null` and disable fallback deduplication for that call. Add collision
regressions for undefined properties, non-finite numbers, negative zero, and
sparse arrays.

#### CR-03: A zero or exactly elapsed deduplication window does not expire

**Classification:** BLOCKER
**File:** `packages/concierge/src/concierge.ts:734-751`
**Related:** `packages/concierge/src/types.ts:1705-1713`,
`packages/concierge/test/dispatcher.test.ts:604-633`
**Issue:** Settled entries are evicted only when
`now - settledAt > dedupeWindowMs`. At the documented boundary the window has
already elapsed, so the comparison must include equality. With a fixed clock, a
600 ms entry remained cached at exactly 600 ms. More seriously, the explicitly
supported `dedupeWindowMs: 0` retained a settled Promise indefinitely until the
clock advanced; an immediate retry returned the same Promise and the handler
remained at one call. Existing tests skip from 599 to 601 and do not exercise
the boundary.

**Fix:** Change the eviction comparison to `>=` and add exact-boundary plus
zero-window regressions. Pending Promises should remain protected by the
separate `dispatchPending` check.

#### CR-04: Explicit JSON Schema accessors remain a live agent-facing mutation channel

**Classification:** BLOCKER
**File:** `packages/concierge/src/catalog.ts:711-715`
**Related:** `packages/concierge/src/catalog.ts:732-754`,
`packages/concierge/test/concierge.test.ts:790-823`
**Issue:** Explicit `jsonSchema` is retained by reference. `deepFreeze()` skips
accessors, so freezing the catalog does not stabilize what an accessor returns.
This is acknowledged in the test file but deliberately has no assertion. A
probe supplied a getter-backed root `type`: construction accepted its first
`"object"` value, while consecutive reads from the frozen emitted tool returned
`"poisoned-2"` and `"poisoned-3"`; `parameters === explicit` was still true.
The same channel can vary descriptions or other schema content shown to the
agent after review/construction.

**Fix:** Detach explicit and derived JSON Schema into a private data-only graph
before root validation and publication. Inspect property descriptors without
invoking accessors and reject accessor/function/symbol nodes with a structured
catalog issue; then freeze the detached copy. Replace the prose-only test with
malicious root and nested accessor regressions.

#### CR-05: The no-telemetry gate still accepts dynamic callable channels

**Classification:** BLOCKER
**File:** `scripts/check-no-telemetry.mjs:514-635`
**Related:** `scripts/check-no-telemetry.mjs:928-1009`
**Issue:** The iteration-2 CR-08 fix only rejects an unresolved element read
when the element's type itself may be callable. It therefore misses a callable
member reached through a dynamically selected object. The current checker
reported no finding for:

```ts
declare const channels: Record<string, { send: (input: unknown) => void }>;
channels[runtimeName].send(secret);
```

The dynamic installer logic has a second hole: `objectLiteralMember()` ignores
`ShorthandPropertyAssignment`, so this also produced no finding:

```ts
const value = externalForwarder;
Object.defineProperty(channel, runtimeName, { value });
```

At runtime either `runtimeName` can select a forbidden telemetry/error channel,
so the zero-finding audit can still certify prohibited forwarding.

**Fix:** Treat an unresolved element used as a property/call receiver as a
channel-capable read unless checker-backed analysis proves it is inert data.
Handle shorthand descriptor members, and audit `Reflect.defineProperty` beside
`Object.defineProperty`/`Reflect.set`. Add both exact fixtures to the malicious
self-test and assert the expected rule at their lines.

#### CR-06: Malformed batch JSON can execute an action with defaulted arguments

**Classification:** BLOCKER
**File:** `packages/concierge/src/dispatch.ts:479-505`
**Related:** `packages/concierge/src/types.ts:1158-1163`,
`packages/concierge/test/dispatcher-batch.test.ts:296-355`
**Issue:** A `JSON.parse()` failure is converted to `{}` and passed through the
normal dispatcher. Any schema accepting an empty object or adding defaults can
therefore run a handler even though the agent supplied malformed wire data. A
probe dispatched the raw argument `"{"` to a validator defaulting
`amount = 100`; the handler executed once and returned success
`"charged:100"`. The existing batch test locks in the `{}` substitution but only
uses a validator that happens to reject it. For a side effect, this is fail-open
input handling.

**Fix:** On parse failure, append a correlated frozen `invalid_args` row and
continue to the next call without invoking `dispatch()` or the validator. Update
the public `ToolCall.arguments` comment and add a permissive/defaulting schema
regression proving the handler remains untouched.

#### CR-07: A malformed validator success shape is accepted as valid arguments

**Classification:** BLOCKER
**File:** `packages/concierge/src/dispatch.ts:147-170`
**Issue:** `validateArguments()` treats every result whose `issues` value is
`undefined` as success, without requiring a `value` member. A malformed
validator returning `{}` therefore enters the handler with `ctx.args ===
undefined`; a direct probe observed a successful handler invocation. This
violates the function's own fail-closed promise for malformed results and can
activate handler defaults or side effects after validation failed to produce a
Standard Schema success.

**Fix:** Guard that the awaited result is an object and validate the Standard
Schema result discriminator structurally: any present `issues` branch is a
failure, a success must contain a `value` key (including the valid explicit
`value: undefined` case), and every other shape returns `ok: false`. Add cases
for `{}`, `{ issues: undefined }`, `{ value: undefined }`, and throwing accessors.

---

_Reviewed: 2026-08-06T17:24:41Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
