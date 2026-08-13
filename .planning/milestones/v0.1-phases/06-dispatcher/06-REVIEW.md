---
phase: 06-dispatcher
reviewed: 2026-08-07T20:42:10Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - packages/concierge/src/dispatch.ts
  - packages/concierge/src/concierge.ts
  - packages/concierge/src/types.ts
  - packages/concierge/test/dispatcher.test.ts
  - packages/concierge/test/dispatcher-batch.test.ts
  - scripts/phase-06-mutation-battery.mjs
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-08-07T20:42:10Z

**Depth:** standard

**Files Reviewed:** 6

**Status:** issues_found

## Summary

The iteration-2 fixes close all four previously reported findings. Invocation arrays now use bounded, single-read lengths and own-slot snapshots; conforming Standard Schema successes with `issues: undefined` reach handlers; the mutation battery uses an OS-owned advisory lock with a root-only development dependency and process-death release; and ledger validation enforces all seven named detector rows and exact test markers.

One warning remains in the cumulative dispatcher code: a scheduler can invoke its callback synchronously and thereby settle the commit wait as `ready` before its return value or a subsequent throw is validated. This suppresses the promised unavailable-scheduler diagnostic for a runtime-malformed scheduler.

Verification passed: the focused dispatcher suites ran 95/95 tests, the full suite ran 250/250 tests, package typecheck and the dependency-boundary audit passed, the no-telemetry audit scanned 11 files with zero findings, the mutation self-test passed its lock and ledger counterexamples, and `verify all` reported 61/61 green mutations with zero pending.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: A synchronous callback masks a malformed or throwing scheduler

**Classification:** WARNING

**File:** `packages/concierge/src/dispatch.ts:572-590`

**Issue:** `waitForCommit` lets the scheduler callback call `settle("ready")` before the scheduler invocation returns. Settlement is irreversible, so if that scheduler then returns a non-function or throws, the later `settle("unavailable")` call is ignored. A public-API probe with `scheduler: (fn) => { fn(); return undefined; }` ran the handler but emitted zero warnings, even though this function's contract says a runtime-malformed scheduler reports `unavailable` and `concierge.ts:869-873` owns the corresponding warn-once diagnostic. R31 covers a synchronous scheduler only when it returns a valid canceller, leaving both malformed post-callback paths untested. The locked fallback still proceeds immediately, so this is a diagnostics and robustness failure rather than a release-blocking side-effect error.

**Fix:** Buffer a callback that fires during scheduler registration until the returned canceller has been validated. Only settle `ready` after a callable canceller is installed; a non-function return or a throw must settle `unavailable`. Add public dispatch regressions for both `fn(); return undefined` and `fn(); throw ...`, asserting one warn-once diagnostic and normal fallback execution.

```ts
let firedDuringRegistration = false;
let registrationComplete = false;

try {
  const scheduledCancel = scheduler(() => {
    if (!registrationComplete) {
      firedDuringRegistration = true;
      return;
    }
    settle("ready", false);
  }, delayMs);

  if (typeof scheduledCancel !== "function") {
    settle("unavailable", false);
    return;
  }

  cancel = scheduledCancel;
  registrationComplete = true;
  if (cancelWhenAvailable) cancelScheduledWork();
  if (firedDuringRegistration && !settled) settle("ready", false);
} catch {
  settle("unavailable", false);
}
```

---

_Reviewed: 2026-08-07T20:42:10Z_

_Reviewer: the agent (gsd-code-reviewer)_

_Depth: standard_
