---
phase: 06-dispatcher
reviewed: 2026-08-06T16:19:53Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - packages/concierge/src/bridge.ts
  - packages/concierge/src/catalog.ts
  - packages/concierge/src/concierge.ts
  - packages/concierge/src/dispatch.ts
  - packages/concierge/src/host.ts
  - packages/concierge/src/index.ts
  - packages/concierge/src/message.ts
  - packages/concierge/src/types.ts
  - packages/concierge/test-d/dispatcher.test-d.ts
  - packages/concierge/test/concierge.test.ts
  - packages/concierge/test/diagnostic-safety.test.ts
  - packages/concierge/test/dispatcher-batch.test.ts
  - packages/concierge/test/dispatcher.test.ts
  - scripts/check-no-telemetry.mjs
  - scripts/phase-06-mutation-battery.mjs
findings:
  critical: 10
  warning: 1
  info: 0
  total: 11
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-08-06T16:19:53Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The dispatcher still has six directly reproducible runtime defects and both proof
scripts retain false-certification paths. In a runtime probe against the built
package, post-construction validator replacement bypassed argument validation, a
synchronously reentrant validator executed a handler twice for one `callId`, a
mutated result poisoned the retry cache, a declared `constructor` action was
advertised but could not dispatch, a mutation permitted by the public handler
type became `handler_error`, and a hostile catalog name forged a second line in
`CatalogValidationError.message`.

The repository's advertised checks remain green: the no-telemetry audit and its
self-test passed, and the mutation battery self-test plus `verify all` reported
54 green mutants. Those results do not cover the proof gaps below.

## Narrative Findings (AI reviewer)

### Prior finding verification

| Prior finding | Current disposition |
| --- | --- |
| CR-01 | Fixed: construction snapshots the stage array and action records. |
| CR-02 | Fixed for the reported authorization replay: authorization precedes cache lookup and fallback keys include stage scope. |
| CR-03 | Fixed: batch envelopes and calls are detached and their public types are readonly. |
| CR-04 | The reported caller/validator alias is detached; current CR-04 records the new public-type/runtime immutability mismatch. |
| CR-05 | Fixed: effects and scheduler capabilities are captured at construction. |
| CR-06 | Fixed: abort is checked after bridge resolution and before handler invocation. |
| CR-07 | Fixed: cross-realm thenables are assimilated. |
| CR-08 | Fixed: host warning lookup and invocation are guarded. |
| CR-09 | Partially fixed: host warnings encode subjects, but build-failing catalog diagnostics remain injectable (current CR-06). |
| CR-10 | Partially fixed: revisions hash the target and intended detector, but omit transitive production/test inputs (current CR-09). |
| CR-11 | Partially fixed: assertion fingerprints are exact, but suite/hook errors can still be discarded (current CR-10). |
| CR-12 | Partially fixed: several computed names are resolved, but unresolved computed reads and external callable assignments fail open (current CR-08). |
| CR-13 | Partially fixed: named rejection parameters are rejected, but zero-parameter classic functions can read `arguments[0]` (current CR-07). |
| WR-01 | Fixed: invalid timing windows are rejected at construction. |

### Critical Issues

#### CR-01: A post-construction schema mutation bypasses argument validation

**Classification:** BLOCKER
**File:** `packages/concierge/src/dispatch.ts:155-164`
**Related:** `packages/concierge/src/concierge.ts:149-163`,
`packages/concierge/src/catalog.ts:671-693`,
`packages/concierge/src/catalog.ts:973-985`
**Issue:** Action records are shallow-copied, while each schema object is
deliberately excluded from the catalog freeze. Dispatch then reads
`entry.action.schema["~standard"].validate` live on every call. Replacing that
method after `createConcierge()` therefore changes the security boundary. A
direct probe first returned `invalid_args`, replaced the validator with an
accept-all implementation, and then ran the handler successfully with the same
invalid input.
**Fix:** Capture a private validation capability during construction and store it
on the internal catalog entry; do not re-read the public schema during dispatch.
Read the Standard Schema member and `validate` once under a guarded boundary,
bind the receiver when needed, and invoke only that captured closure. Add a
regression that mutates both `schema["~standard"]` and its `validate` property
after construction and verifies behavior cannot change.

#### CR-02: A reentrant validator escapes the deduplication cache and double-fires

**Classification:** BLOCKER
**File:** `packages/concierge/src/concierge.ts:790`
**Related:** `packages/concierge/src/concierge.ts:1013-1037`,
`packages/concierge/src/dispatch.ts:155-164`
**Issue:** `runDispatchPipeline()` is called before its Promise is inserted into
`dispatchPromises`. An async function runs synchronously until its first
suspension, and `validateArguments()` invokes the consumer validator before that
suspension. A validator that synchronously calls `dispatch()` again with the same
`callId` observes an empty cache. The probe produced two distinct Promises and
two handler executions.
**Fix:** Create a deferred pipeline Promise, publish it in all cache maps, and
only then enter consumer code. For example:

```ts
const promise = Promise.resolve().then(() =>
  runDispatchPipeline(index, entry, name, argsSnapshot.value, metaSnapshot.value),
);
dispatchPromises.set(key, promise);
```

Install the pending/settlement bookkeeping before the microtask can run and add
a validator-reentrancy regression asserting Promise identity and one handler
call.

#### CR-03: Mutable cached results let one consumer poison every retry

**Classification:** BLOCKER
**File:** `packages/concierge/src/dispatch.ts:335-345`
**Related:** `packages/concierge/src/concierge.ts:1017-1039`,
`packages/concierge/src/dispatch.ts:473-504`,
`packages/concierge/src/types.ts:98-130`
**Issue:** Core-authored and normalized `ActionResult` objects are fresh but
mutable. The deduplication cache returns the same Promise and therefore the same
fulfillment object on every retry. Mutating the first result's `ok`, `reason`,
or `message` changes all later results without passing through
`sanitizeMessage()`. The probe changed a successful result into
`handler_error` with an ANSI control sequence; the retry returned that poisoned
object. Batch rows freeze only the outer row, not the nested result.
**Fix:** Make `ActionResult` fields readonly and have `authoredResult()` freeze
the complete result object after sanitization. Ensure every normalization path
uses that constructor and add direct and batch regressions that attempt mutation
before retrying.

#### CR-04: The runtime freezes handler inputs that the public type says are writable

**Classification:** BLOCKER
**File:** `packages/concierge/src/types.ts:294-330`
**Related:** `packages/concierge/src/types.ts:406-418`,
`packages/concierge/src/concierge.ts:125-143`,
`packages/concierge/src/concierge.ts:799-802`,
`packages/concierge/src/concierge.ts:871-884`
**Issue:** `ActionHandler` exposes `args: Args` and `meta: InvocationMeta`, with
writable properties. At runtime, the validated argument graph and metadata
object are recursively/shallowly frozen before invocation. A handler that
assigns to `args.amount` is valid TypeScript under the published API but throws
in ESM strict mode and is converted to `handler_error`; the direct probe
reproduced that result.
**Fix:** Align the public contract and runtime. Either expose a documented
deep-readonly argument type plus `Readonly<InvocationMeta>` in
`ActionHandler`, or stop freezing the already-detached private copies. Add
type-level mutation negatives and a runtime test for the selected contract.

#### CR-05: Reserved actions are published in the tool catalog but can never run

**Classification:** BLOCKER
**File:** `packages/concierge/src/concierge.ts:946-961`
**Related:** `packages/concierge/src/concierge.ts:470-480`,
`packages/concierge/src/catalog.ts:1060-1069`
**Issue:** Catalog construction accepts `constructor` and `__proto__`; the
null-prototype map stores them safely and `catalogFor()` advertises them.
Dispatch nevertheless rejects both names before reading the catalog. The probe
showed `constructor` in the published tool list, followed by
`unknown_action` and zero handler calls.
**Fix:** Reject both reserved names during catalog validation with a structured
`CatalogIssue` and never publish them. Alternatively, if null-prototype lookup
is the intended complete defense, remove the contradictory dispatch refusal.
Whichever policy is chosen must be identical at declaration, projection, and
dispatch boundaries.

#### CR-06: Catalog build errors still permit terminal and log-line injection

**Classification:** BLOCKER
**File:** `packages/concierge/src/catalog.ts:187-198`
**Related:** `packages/concierge/src/catalog.ts:1033-1045`
**Issue:** `formatIssues()` interpolates `issue.action` verbatim, and some
`problem`/`fix` strings interpolate the raw consent target. Unlike host warning
subjects, these values are not encoded or stripped of C0/C1 characters. A
duplicate action named with a newline produced a
`CatalogValidationError.message` containing a forged
`concierge: [forged]` line. Applications conventionally log construction
errors, making this an injection surface.
**Fix:** Preserve raw values only in structured issue fields. Encode every
dynamic subject used in display text and apply a final bounded control-character
encoding pass to each formatted line. Add newline, carriage-return, ANSI, quote,
and overlength cases for both action names and `consent.requires`.

#### CR-07: The no-telemetry audit allows rejected values through arguments[0]

**Classification:** BLOCKER
**File:** `scripts/check-no-telemetry.mjs:512-545`
**Related:** `scripts/check-no-telemetry.mjs:680-692`
**Issue:** The rejection-callback audit returns immediately whenever a callback
declares zero parameters. A classic zero-parameter function still has its own
`arguments` object, so
`promise.catch(function () { return { message: String(arguments[0]) }; })`
forwards the rejection while the audit reports zero findings. The self-test
explicitly requires a locally resolved zero-parameter callback to be accepted,
so it certifies this bypass.
**Fix:** Permit zero-parameter arrows, which have no callback-local
`arguments`, but audit or reject zero-parameter function expressions and
declarations when they reference `arguments`. Add malicious self-test fixtures
for `.catch()` and the rejection arm of `.then()`.

#### CR-08: Unresolved computed channel access fails open in the no-telemetry audit

**Classification:** BLOCKER
**File:** `scripts/check-no-telemetry.mjs:339-371`
**Issue:** A computed access whose property cannot be resolved is ignored unless
it is the left side of a simple assignment and the right side resolves to a
locally declared callback. Dynamic reads/calls such as `channel[runtimeName](x)`
therefore pass, as do dynamic assignments of imported or otherwise external
callables. At runtime `runtimeName` can be any forbidden telemetry channel, so
the advertised zero-telemetry proof is not fail-closed.
**Fix:** Use the TypeScript checker/dataflow to classify indexed data operations
that are safe, and reject every unresolved property access that can call, read,
or install a channel. At minimum, cover call targets, value reads, compound
assignments, `Object.defineProperty`, `Reflect.set`, and non-local callable
values. Add a self-test for each bypass form.

#### CR-09: Mutation evidence does not track transitive production or test inputs

**Classification:** BLOCKER
**File:** `scripts/phase-06-mutation-battery.mjs:1333-1353`
**Issue:** A mutant revision hashes only its target, its one intended detector,
the optional type test, and shared config paths. Other production modules and
test fixtures that the detector imports are omitted. Changing such a transitive
input can make the recorded mutant survive while `verify all` still accepts the
old evidence as current. The reported green register is therefore not tied to
the implementation/test tree it purports to certify.
**Fix:** Build each revision from a deterministic manifest of all tracked Phase
6 production sources, runtime tests, type tests, proof scripts, manifests,
lockfile, and relevant configs, or hash an equivalent scoped Git tree. Include
both path and content in sorted order. Extend the self-test by changing a
non-target transitive source and a non-intended test fixture and requiring
verification to fail.

#### CR-10: Mutation reports discard suite and hook failures when a file has assertions

**Classification:** BLOCKER
**File:** `scripts/phase-06-mutation-battery.mjs:1037-1043`
**Issue:** `summarizeVitestReport()` records `suite.message` and
`suite.failureMessage` only when `assertionResults.length === 0`. An expected
mutation assertion can fail exactly as fingerprinted while `afterAll`,
`afterEach`, or another suite-level path also fails; because the mutant already
expects a nonzero test exit, the extra failure does not change the outcome and
is silently credited as a clean kill.
**Fix:** Parse suite/hook failures regardless of assertion count and distinguish
them from the already-recorded assertion messages instead of gating on count.
Reject every unrecognized suite/hook error. Add a synthetic reporter fixture
containing the exact expected assertion failure plus an `afterAll` failure and
require fingerprint verification to reject it.

### Warnings

#### WR-01: Bridge security comments contradict the implemented encoder

**Classification:** WARNING
**File:** `packages/concierge/src/bridge.ts:135-151`
**Related:** `packages/concierge/src/bridge.ts:772-778`,
`packages/concierge/src/bridge.ts:805-830`
**Issue:** Multiple security-boundary comments state that bridge IDs and keys
reach `warnHost` “unescaped” or are not sanitized. The builders now pass those
values through `encodeDiagnosticSubject()` at lines 155, 782, 815, and 834.
This is not cosmetic: the comments document the opposite terminal-injection
guarantee from the code and can misdirect later security maintenance.
**Fix:** Rewrite the shared provenance comment and its references to describe
the current bounded encoder, then keep only the separate claim that caught
values never enter the diagnostic.

---

_Reviewed: 2026-08-06T16:19:53Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
