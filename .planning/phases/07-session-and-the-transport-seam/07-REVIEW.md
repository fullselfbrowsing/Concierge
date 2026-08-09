---
phase: 07-session-and-the-transport-seam
reviewed: 2026-08-09T01:27:08Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - packages/concierge/src/contract.ts
  - packages/concierge/src/index.ts
  - packages/concierge/src/session.ts
  - packages/concierge/src/types.ts
  - packages/concierge/test-d/actions.test-d.ts
  - packages/concierge/test-d/exports.test-d.ts
  - packages/concierge/test-d/session.test-d.ts
  - packages/concierge/test-d/stub-transport.test-d.ts
  - packages/concierge/test-d/transport.test-d.ts
  - packages/concierge/test/artifact.test.ts
  - packages/concierge/test/export-surface.test.ts
  - packages/concierge/test/fixtures/probe.ts
  - packages/concierge/test/fixtures/stub-transport.ts
  - packages/concierge/test/session-catalog.test.ts
  - packages/concierge/test/session-lifecycle.test.ts
  - packages/concierge/test/session-routing.test.ts
  - packages/concierge/test/single-instance.test.ts
  - packages/concierge/test/stub-transport.test.ts
  - scripts/pack-install-check.sh
  - scripts/phase-07-mutation-battery.mjs
findings:
  critical: 3
  warning: 2
  info: 0
  total: 5
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-09T01:27:08Z  
**Depth:** standard  
**Files Reviewed:** 20  
**Status:** issues_found

## Summary

The public contracts, package boundary, test fixture, built-artifact suites, and mutation/release harness were reviewed. The build, typecheck, 50 focused Session tests, mutation self-test, input verifier, and ledger verifier all pass. Those green gates do not establish correctness: two reentrant runtime boundaries violate the locked Session behavior, and the ledger verifier reports release-evidence agreement even though generated evidence contains no release facts. Two additional detector paths can fail open.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Stop during cancellation normalization drops an accepted batch

**Classification:** BLOCKER  
**File:** `packages/concierge/src/session.ts:497-532`  
**Issue:** `acceptBatch` establishes that the callback arrived while the Session has live context and epoch authority, but it calls `createCancellationScope(batch)` before registering a `WorkRecord`. That call executes transport-controlled property getters, signal methods, and potentially the diagnostic hook. If any of those callbacks calls `session.stop()`, `startStopDrain()` snapshots the queue before this occurrence exists; lines 518-521 then dispose the scope and return without ever invoking `dispatchBatch`. This violates the once-per-accepted-occurrence and complete-stop-drain contracts. A built-artifact reproduction with a `batch.signal` getter that calls `session.stop()` observed zero dispatches.

**Fix:** Track acceptance before invoking any batch-controlled code and keep the stop drain from taking its one-time snapshot until all in-progress acceptance frames finish. If stop wins during normalization, add the newly built record to the detached FIFO, abort it, and dispatch it once with responses disabled. For example, pair an `acceptingBatchCount` guard with logic equivalent to:

```ts
acceptingBatchCount += 1;
try {
  const cancellation = createCancellationScope(batch);
  const work = { context, sourceBatch: batch, epoch, cancellation };
  epoch.work.add(work);
  if (hasStopped()) {
    cancellation.abort();
    detachedWork.push(work);
  } else {
    workQueue.push(work);
    maybeStartPump();
  }
} finally {
  acceptingBatchCount -= 1;
  if (hasStopped() && acceptingBatchCount === 0) startStopDrain();
}
```

Add a regression in which both a signal accessor and a diagnostic hook stop reentrantly, then assert one aborted dispatch, zero responses, and stop resolution only after that dispatch settles.

### CR-02: Reentrant stop suppresses a synchronous catalog-publication failure

**Classification:** BLOCKER  
**File:** `packages/concierge/src/session.ts:734-740, 766-771`  
**Issue:** Both publication catch blocks return when `publicationIsCurrent(attemptToken)` is false. `enterStopped()` invalidates that token, so a transport implementation that calls `session.stop()` from inside `setTools()` and then throws has its throw silently discarded. The triggering `setContext`/status callback returns normally and no `catalog_publish_failed` diagnostic is emitted. This contradicts the explicit “on any `setTools` throw” contract and hides a failed catalog publication from the caller. A built-artifact reproduction observed `{ outcome: "returned", diagnostics: [] }` after the second `setTools` stopped and threw.

**Fix:** Token invalidation may prevent stale publication state from committing, but it must not erase the fact that the invoked `setTools` threw. In each catch, preserve construction handling, then emit the fixed diagnostic and throw `PUBLICATION_ERROR` even if stop is already established; `enterStopped`, cleanup, and drain are already idempotent:

```ts
} catch {
  if (lifecycle === "starting") throw new Error(START_ERROR);
  failPublication(resolved.stage);
}
```

Apply the equivalent correction to connected replay and add context-change and replay tests where `setTools` stops first and throws second.

### CR-03: The verifier certifies release evidence that the evidence artifact never records

**Classification:** BLOCKER  
**File:** `scripts/phase-07-mutation-battery.mjs:1088-1097, 1986-2059, 2107-2156`  
**Issue:** `makeInitialEvidence` defines only mutation rows and input hashes, and no later path adds a release record. `runReleaseGates` discards every successful command result, while `validateFinalLedgers` searches human-authored Markdown for loose text tokens instead of comparing it with generated release facts. The current `07-MUTATION-EVIDENCE.json` consequently has no `release` key, no Vitest file/pass/total/pending/todo counts, and no seven-command exit map. Nevertheless, `node scripts/phase-07-mutation-battery.mjs verify ledgers` exits 0 and prints that release and ledgers agree. This makes the signed validation claim non-reproducible and permits stale or fabricated release facts to be certified.

**Fix:** Extend the evidence schema with a revision-bound, atomically written release object containing the fresh full-test exit/counts and exact exits for `build`, `typecheck`, `test`, `check:artifact`, `check:deps`, `check:pack`, and `check:node-floor`. Make `validateEvidenceShape` require its exact keys and value types after release execution, and make `verify ledgers` compare each ledger fact to those generated values rather than accepting tokens found anywhere in the document. Add self-test negatives for a missing release object, each missing/nonzero command exit, and altered test counts.

## Warnings

### WR-01: The production-source package scan treats scanner failure as “no matches”

**Classification:** WARNING  
**File:** `scripts/phase-07-mutation-battery.mjs:1932-1951`  
**Issue:** `rg` exit 1 means no match, while exit 2 or the wrapper's 255 means the scan failed. The current check rejects only exit 0 with nonempty output, so a missing executable, I/O error, or invalid invocation is accepted as proof that no stub reached production source. The self-test exercises exit 1 but has no scanner-error negative control.

**Fix:** Accept only exit 1 as the clean no-match result, reject nonempty exit-0 results as leakage, and fail on every other exit:

```js
if (sourceFiles.exitCode === 0 && sourceFiles.output.trim() !== "") {
  throw new Error("stub transport reached production source");
}
if (sourceFiles.exitCode !== 1) {
  throw new Error(`production source scan failed with exit ${sourceFiles.exitCode}`);
}
```

Add explicit exit-2 and exit-255 self-test cases.

### WR-02: Any F7 assertion failure is credited as the direct-guard detector

**Classification:** WARNING  
**Files:** `scripts/phase-07-mutation-battery.mjs:1386-1399`; `packages/concierge/test/single-instance.test.ts:353-411`  
**Issue:** The special F7 branch requires only that the test failed and had at least one failure message, then synthesizes the expected direct-guard fingerprint from the test title. F7 also asserts imports, construction, and teardown, so an unrelated failure in any of those steps can kill M-07-P02 and be recorded as proof that removal of `assertSingleInstance()` was detected. This is weaker than the exact RED-marker rule enforced for every C/J/L detector.

**Fix:** Give the registry assertion at line 406 a unique marker such as `[RED:F7:direct-create-session-guard]`, extract that marker from the actual failure message, and require exactly one matching message/marker. Do not synthesize a marker from the case title. Add a negative control whose F7 failure comes from a neighboring assertion and require the detector to reject it.

---

_Reviewed: 2026-08-09T01:27:08Z_  
_Reviewer: Codex (gsd-code-reviewer)_  
_Depth: standard_
