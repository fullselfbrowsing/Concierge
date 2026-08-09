---
phase: 07-session-and-the-transport-seam
reviewed: 2026-08-09T02:26:57Z
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
  warning: 1
  info: 0
  total: 4
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-09T02:26:57Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

All 20 scoped files were re-reviewed after the three iteration-two fixes. Those fixes close the previously reported FIFO reservation, response-getter cutoff, and untracked-manifest cases, and the build, typecheck, 55 focused runtime tests, and mutation-battery self-test pass. The implementation is still not shippable: a `setTools` accessor can republish privileged tools after synchronous stop cleanup, reentrant resolver/capability reads can let a superseded context stop or strand the winning transition, and the release record still does not bind all shipped bytes or ensure that one immutable tree was exercised. The updated response-cutoff mutant is also mapped only to tests that cannot detect it.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A `setTools` accessor can republish tools after stop cleanup

**Classification:** BLOCKER
**File:** `packages/concierge/src/session.ts:750-755, 781-785`
**Issue:** Both active publication paths evaluate and invoke `transport.setTools(...)` as one member-call expression. A structural transport may implement `setTools` as an accessor. If that accessor synchronously calls `session.stop()`, cleanup first publishes the frozen empty catalog, but JavaScript then continues the original expression and invokes the function returned by the accessor with the stale non-empty catalog. The publication token check happens only after that invocation. A built-artifact reproduction observed catalog history `['a', 'EMPTY', 'b']`: the Session was stopped and its cleanup completed, yet catalog B was the transport's final authority. The reconnect path has the same ordering defect. This violates the locked no-post-stop-output and stale-authority guarantees.

**Fix:** Resolve the callable separately, revalidate lifecycle/publication authority after the getter returns, and only then invoke it with the transport receiver. Handle a getter that throws after reentrant stop as an invalidated attempt rather than calling `failPublication` again. Apply the same boundary to context publication and connected replay, for example:

```ts
let setTools: typeof transport.setTools;
try {
  setTools = transport.setTools;
} catch {
  if (!isCurrent(record)) return;
  failPublication(resolved.stage);
}
if (!isCurrent(record) || !publicationIsCurrent(attemptToken)) return;
Reflect.apply(setTools, transport, [resolved.catalog]);
```

Add set-context and reconnect regressions whose `setTools` getter calls `stop()`; the only final publication must be the frozen empty catalog and the stale returned function must never run.

### CR-02: Reentrant resolver and capability reads can apply a superseded transition

**Classification:** BLOCKER
**File:** `packages/concierge/src/session.ts:705-713, 726-733`
**Issue:** `processContext` calls `catalogFor` and `stageFor` back-to-back and later reads `transport.capabilities.dynamicCatalog` without rechecking the record between these outside boundaries. A `dynamicCatalog` getter can synchronously enqueue newer context C and return `false`; the code then executes the fixed-transport branch for stale context B, records B's stage, stops the Session, and throws instead of processing winning C. A built-artifact reproduction with `catalog(C) === catalog(A)` returned `This transport does not support catalog changes.`, stopped with stage B, and cleared the transport even though the latest request required no catalog change. Separately, if `catalogFor(B)` enqueues C, stale `stageFor(B)` is still invoked; if it throws, C remains queued with the transition drain unwound and is not processed until some unrelated future event. This contradicts the serialized latest-generation-wins contract.

**Fix:** Split every reentrant outside read/call and check `isCurrent(record)` immediately afterward, before starting the next read or taking any state-changing branch:

```ts
const catalog = concierge.catalogFor(record.context as StageContext);
if (!isCurrent(record)) return;
const stage = concierge.stageFor(record.context as StageContext);
if (!isCurrent(record)) return;
const dynamicCatalog = transport.capabilities.dynamicCatalog;
if (!isCurrent(record)) return;
```

Then branch only on captured values. Add regressions where `catalogFor` and the capability getter each enqueue a newer context, including a stale resolver that would throw and a fixed-capability value that would otherwise stop the Session.

### CR-03: Release evidence still does not bind the bytes exercised by every gate

**Classification:** BLOCKER
**File:** `scripts/phase-07-mutation-battery.mjs:92-108, 843-866, 1747-1803, 2401-2457`
**Issue:** The new digest manifest omits `packages/concierge/README.md` and `packages/concierge/LICENSE`, although both are tracked and explicitly shipped by the package `files` allow-list. Changing either shipped file leaves `releaseRevisionDigest()` unchanged, so previously recorded green release evidence remains valid for a different tarball. The pre/post source hashes also do not prove that the commands ran against one tree: `withExclusiveRepositoryLock` only locks a private `phase-07-mutation-battery.lock` file, and Git, editors, builds, and other agents do not acquire it. A scoped file can therefore change and be restored between the endpoint hashes, causing different gates to exercise different bytes while the recorded pre/post digest remains equal. The self-test checks only unequal endpoint digests and cannot detect an A-to-B-to-A change.

**Fix:** Include every non-derived packed input, including the package README and license, in the release manifest. Materialize the complete manifest into an immutable temporary snapshot and run all seven release commands from that snapshot; record the snapshot digest. Do not describe the battery-only advisory lock as repository-exclusive. Add negative controls proving that a packaged-document change invalidates evidence and that a mutate-then-restore operation cannot mix inputs across simulated gates.

## Warnings

### WR-01: The updated response-cutoff mutant is wired to tests that cannot kill it

**Classification:** WARNING
**File:** `scripts/phase-07-mutation-battery.mjs:585-599`; `packages/concierge/test/session-lifecycle.test.ts:389-436, 767-854, 856-929`
**Issue:** Embedded M-07-L03 now removes the final lifecycle check after the `respond`, `callId`, and `result` getters, but its selected cases remain L03 and L05. L03 stops before row iteration and is caught by the earlier loop check; L05 stops inside the first response invocation and is caught by that same earlier check before row two. Neither test observes the removed final check, so the mutant escapes. The two tests that do exercise row/respond getter stop are unlabelled and therefore excluded by `casePattern`. The on-disk register/evidence still contain the old M-07-L03 literal, which is why `verify lifecycle` currently fails closed with `on-disk register differs from the embedded immutable register`; refreshing the artifacts will expose the detector escape rather than fix it.

**Fix:** Give the getter-stop regressions stable case IDs/RED markers (or fold them into an existing selected case), point M-07-L03 only at cases that fail when the final check is removed, refresh the immutable register, and rerun the mutant before recording green evidence. Add a self-test assertion that each mutant's selected cases are behaviorally sensitive to its current replacement, not merely syntactically present.

---

_Reviewed: 2026-08-09T02:26:57Z_
_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
