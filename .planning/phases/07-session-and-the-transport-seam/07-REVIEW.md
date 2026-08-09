---
phase: 07-session-and-the-transport-seam
reviewed: 2026-08-09T07:25:24Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - packages/concierge/src/session.ts
  - packages/concierge/test/session-catalog.test.ts
  - scripts/phase-07-mutation-battery.mjs
findings:
  critical: 1
  warning: 1
  info: 0
  total: 2
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-09T07:25:24Z

**Depth:** standard

**Files Reviewed:** 3

**Status:** issues_found

## Summary

The four iteration-2 findings are closed in their reported forms. The single occurrence queue preserves accessor/callable FIFO and blocks at an unresolved head; confirmed-replay work retains immutable A authority while post-reentry work binds to the winning context; stop detaches and dispatches every unresolved record once in arrival order with the original composed cancellation signal; and mutation evidence now makes only the endpoint claim it measures. The five findings that preceded iteration 2 also remain closed: unpublished B is not live dispatch authority, superseded replay getters neither invoke stale callables nor fail the Session, mutation execution stays inside a disposable snapshot, C17 independently detects abort and clear removal, and its RED marker is isolated from the factory smoke check.

| Finding set | Disposition | Independent evidence |
|---|---|---|
| Iteration-2 CR-01 — one-queue FIFO | Closed as reported | The getter/callable regression passed, and an additional built-artifact B→C→D probe dispatched, responded, and finalized `before-c`, `after-c`, `after-d` in exact arrival order. Only the final D occurrence was live. |
| Iteration-2 CR-02 — confirmed-A replay authority | Closed as reported | The four distinct/same-catalog × getter-return/throw cases passed with pre-C authority A, post-C authority C, exact cancellation state, zero stale invocation, and final C stage. |
| Iteration-2 CR-03 — stop exact-once drain | Closed as reported | Direct stop and stop from the second source signal passed for setContext and replay: two FIFO dispatches, two exact composed signals, both aborted, zero handlers/responses, ordered finalizers, and one cached drain Promise. |
| Iteration-2 WR-01 — endpoint-only wording | Closed | The harness, every evidence row, and validation use `liveScopeEndpointsMatch`; the self-test explicitly proves endpoint equality can coexist with detected A→B→A history drift. No legacy `scopedTreeClean` claim remains in current executable/generated artifacts. |
| Preceding five findings | Closed as reported | C17 covers accessor work on both sides of C and separately killed M-07-C10/M-07-C11; connected replay covers stale getter return/throw; mutation gates and restoration use `snapshot.root`; the two mutants have distinct revision digests; and `[SMOKE:C17:create-session-factory]` is separate from the exact RED fingerprint. |

The final pass nevertheless found a distinct outside-boundary exception ordering. `catalogFor`, `stageFor`, `transport.capabilities`, and `dynamicCatalog` are checked for supersession only after a successful return. If one of those consumer-controlled computations queues C and then throws, the stale B exception exits the outer transition drain, leaves C queued, and permanently gates subsequently accepted work until another control happens to restart the drain. A structural `catalogFor` accessor can likewise queue C yet have its returned stale B callable invoked because property capture and invocation are one expression. These failures contradict latest-wins publication, no-stale-authority, FIFO progress, and one-response-per-call claims.

All gates represented by the submitted suite/evidence passed: package build, package typecheck, catalog 25/25, routing 18/18, lifecycle 21/21, mutation-battery syntax, mutation self-test, `verify all` 32/32, and `verify inputs` 3/3. `verify ledgers` was not rerun because it rewrites release evidence and cannot override the built-artifact counterexamples; the committed release object remains present with seven zero exits and 326/326 tests. Security re-audit and formal phase verification must not proceed until both findings below are repaired, regenerated into evidence, and independently re-reviewed.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A stale resolver or capability exception strands the winning transition and accepted work

**Classification:** BLOCKER

**File:** `packages/concierge/src/session.ts:899-906, 921-926, 1035-1044`

**Issue:** The freshness checks after `catalogFor`, `stageFor`, `transport.capabilities`, and `capabilities.dynamicCatalog` run only when the preceding property/call returns normally. If an outside computation synchronously calls `session.setContext(C)` and then throws while B is being processed, its now-stale exception escapes `processContext` and exits the `while` loop in `drainTransitions`. The `finally` block clears `transitionDraining`, but it does not resume the non-empty queue; `bindQueuedOccurrences` and `maybeStartPump` both refuse progress while C remains queued. A later batch is accepted but receives no dispatch and no response.

Two independent built-artifact probes observed:

```json
{
  "catalogForThrow": {
    "error": "STALE-B",
    "events": ["catalog:a", "stage:a", "catalog:b"],
    "publications": ["a"],
    "stage": "a",
    "responses": []
  },
  "capabilitiesThrow": {
    "error": "STALE-CAPS",
    "events": ["catalog:a", "stage:a", "catalog:b", "stage:b", "capabilities"],
    "publications": ["a"],
    "stage": "a",
    "responses": []
  }
}
```

The same boundary is unsafe even without a throw: because `concierge.catalogFor(record.context)` combines property lookup and invocation, a `catalogFor` getter that queues C can return a B callable that is still invoked before line 902 checks freshness. The probe observed `staleCalls: 1` even though only A→C was published. This is the same stale-callable class already fixed for `transport.setTools`, now exposed at the resolver seam.

**Fix:** Split property capture from invocation for `catalogFor` and `stageFor`, and place an `isCurrent(record)` guard after each property read and after each call. Use `try/finally` around every resolver/capability boundary so a `return` in the `finally` suppresses only a superseded throw while a current throw retains its existing behavior without binding or exposing the caught value. Apply the same pattern to `transport.capabilities` and `dynamicCatalog`. Ensure the outer drain always continues with queued C after a stale B return or throw, and never invokes a callable captured by a getter that already superseded B. For example:

```ts
let catalogFor: typeof concierge.catalogFor;
try {
  catalogFor = concierge.catalogFor;
} finally {
  if (!isCurrent(record)) return;
}

let catalog: ReadonlyArray<EmittedTool>;
try {
  catalog = Reflect.apply(catalogFor, concierge, [record.context]);
} finally {
  if (!isCurrent(record)) return;
}
```

Add built-artifact variants for `catalogFor`, `stageFor`, `capabilities`, and `dynamicCatalog` that queue C immediately before both return and throw. Assert zero stale callable invocation/error/diagnostic, final C authority, and exactly one later C dispatch/response. Include distinct- and same-catalog C where identity changes the epoch result.

## Warnings

### WR-01: The catalog suite and mutation register cannot detect stale-boundary exception handling

**Classification:** WARNING

**File:** `packages/concierge/test/session-catalog.test.ts:787-912`; `scripts/phase-07-mutation-battery.mjs:1005-1018, 2628-2644`

**Issue:** The resolver and capability regressions exercise only the successful-return side of reentry. C17 and the connected-replay regression cover return/throw only for `setTools`; no named case makes `catalogFor`, `stageFor`, `capabilities`, or `dynamicCatalog` queue C and then throw, and no case checks a stale callable returned by a resolver property getter. M-07-C07/C08 therefore remain green while the built artifact is stuck with C queued and a later accepted batch unanswered. `verify all` reporting 32/32 does not discriminate this load-bearing latest-wins branch.

**Fix:** Add a uniquely marked built-artifact case for the resolver/capability return-and-throw matrix and a compiled exact mutant that removes the new stale-exception/freshness guard. Require a successful build, only the intended named case, its exact marker, byte-identical snapshot restoration, and restored-green gates; then regenerate the register, evidence, release facts, and validation counts. The detector must assert later dispatch/response progress so an incidental thrown error cannot receive credit.

---

_Reviewed: 2026-08-09T07:25:24Z_

_Reviewer: the agent (gsd-code-reviewer)_

_Depth: standard_
