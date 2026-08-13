---
phase: 08-consent-kernel
plan: 06
subsystem: testing
tags: [consent, transport-fixture, delivery-lifecycle, outcome-barrier, public-api]
requires:
  - phase: 07-session
    provides: exact six-key test transport, hot Session lifecycle, FIFO occurrence pump, and deterministic cleanup
  - phase: 08-04
    provides: generation-owned delivery and attestation evidence with canonical retained-byte verification
  - phase: 08-05
    provides: actual-capability dominance and the app-owned failed-batch outcome barrier
provides:
  - sibling-only delivery, outcome, response-failure, immutable-history, and shared-ordering controls on the exact Phase 7 fixture
  - public-flow proof that interrupted delivery plus a genuine new human turn remains closed despite a late completion
  - fixture-driven positive acknowledgement and outcome-ordering proofs through the built package
  - test-only export and packed-tarball boundary evidence without a dependency or lockfile change
affects: [08-07, consent-mutation-battery, security-audit, trn-02-closure]
tech-stack:
  added: []
  patterns:
    - transport-driving controls remain siblings of the exact production Transport object
    - histories record attempted boundary crossings before injected failure and expose frozen detached snapshots
    - shared monotonic fixture events prove cross-boundary delivery, outcome, and response order
key-files:
  created: []
  modified:
    - packages/concierge/test/fixtures/stub-transport.ts
    - packages/concierge/test-d/stub-transport.test-d.ts
    - packages/concierge/test/stub-transport.test.ts
    - packages/concierge/test/consent-kernel.test.ts
    - packages/concierge/test/session-consent.test.ts
key-decisions:
  - "Keep every Phase 8 test-driving API on the sibling fixture controls so the production Transport retains exactly its six enumerable keys."
  - "Record all delivery, outcome, and response attempts in one monotonic event log while retaining separate successful histories for release assertions."
  - "Snapshot delivery reports from own data descriptors for history safety, but pass the raw report to production so hostile accessors remain a real kernel test."
patterns-established:
  - The reusable no-network fixture distinguishes attempts from successful boundary crossings and snapshots caller-owned mutable input without changing production semantics.
  - Public integration tests import the built package and use only createConcierge, createSession, and the exact test-only transport fixture.
requirements-completed: [CON-01, CON-02, CON-03, CON-04, CON-05, CON-06, CON-07, CON-08, CON-09, CON-10, CAT-04, TRN-02, TRN-03, TRN-05]
duration: 38m
completed: 2026-08-10
---

# Phase 8 Plan 6: Consent Fixture and Public-Flow Proof Summary

**The exact six-key Phase 7 transport now drives deterministic delivery, attestation, outcome, and failure histories that prove the full consent kernel through built public APIs without network, timers, or production exports.**

## Performance

- **Duration:** 38m
- **Started:** 2026-08-10T13:01:42Z
- **Completed:** 2026-08-10T13:40:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Extended the one established transport fixture with sibling-only delivery callbacks, manual completed/interrupted reports, capability profiles, app outcome presentation, synchronous/asynchronous failure injection, immutable focused histories, and a monotonic shared event log while preserving the exact six enumerable `Transport` keys.
- Added runtime and type contracts that distinguish attempts from successes, prove each event is recorded before injected failure, reject controls on the production transport, and preserve legacy Phase 7 construction and defaults.
- Proved the flagship public flow: interrupted review delivery stays closed after a genuine distinct human turn, executes neither handler nor response, and cannot be armed by a later completion attempt.
- Proved the positive public path releases the exact frozen reviewed payload once, and the Session path presents mixed failures before response, bypasses all-success presentation, withholds an interrupted occurrence, contains throw/reject behavior, and advances a genuine FIFO successor.
- Bound every in-scope T-08 detector to at least one passing named test and verified that the fixture is absent from both the production module namespace and a freshly packed tarball.

## Task Commits

Task 1 used a discriminating RED/GREEN sequence; Task 2 added proof-only integration coverage against the runtime delivered by prerequisite plans:

1. **Task 1 RED: Add failing stub consent control contracts** - `408744c` (test)
2. **Task 1 GREEN: Extend stub transport consent controls** - `1a54543` (feat)
3. **Task 2: Prove public consent and outcome flows** - `f29e93a` (test)

## Files Created/Modified

- `packages/concierge/test/fixtures/stub-transport.ts` - Adds sibling delivery, outcome, response-failure, capability, immutable-history, and shared-event controls without changing the production transport shape.
- `packages/concierge/test-d/stub-transport.test-d.ts` - Pins readonly sibling control types and rejects every attempted production `Transport` expansion.
- `packages/concierge/test/stub-transport.test.ts` - Proves exact runtime keys, lifecycle control ownership, deep snapshots, attempt-before-failure ordering, success histories, and packaging boundaries.
- `packages/concierge/test/consent-kernel.test.ts` - Adapts the delivery harness to the exact fixture, labels canonical detectors, and adds the interrupted-delivery flagship plus hostile-accessor containment.
- `packages/concierge/test/session-consent.test.ts` - Drives built public Concierge/Session flows through the exact fixture for positive acknowledgement, outcome ordering, interruption, throw/reject containment, cleanup, and FIFO recovery.

## Decisions Made

- New controls remain sibling-only. Runtime and type tests independently pin the six production transport keys, preventing a reusable test seam from becoming a public contract.
- Delivery history uses descriptor-first snapshots so recording cannot execute hostile getters; the original report still reaches the production callback so the fixture cannot sanitize away the behavior under test.
- Attempt histories and the shared event log record before configured throws or rejections, while successful histories include only completed boundary crossings. This makes ordering and failure assertions independent rather than inferred from one ambiguous list.
- Already-frozen `ActionResult` values retain identity in response history, preserving the Phase 7 acknowledgement identity proof; mutable caller inputs are detached and frozen before external exposure.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- Task 1 RED kept all eight established fixture tests green while the two new runtime contracts failed and the type contract rejected the missing sibling API. Commit `408744c` precedes the GREEN fixture implementation in `1a54543`; the restored suite passes 10/10 and typecheck is green.
- Task 2's new proof tests passed immediately because prerequisite Plans 08-03 through 08-05 already implemented the runtime. No artificial GREEN implementation was created. Instead, an exact temporary `concierge.ts` mutant that accepted interrupted delivery was killed 1/1 by `[T-08-02 flagship]`, and an exact temporary `session.ts` mutant that released results after interrupted outcome presentation was killed 1/1 by `[T-08-08]`.
- Both proof-only mutants were applied and reversed with exact patches before commit. Restored SHA-256 values matched the pre-mutant sources: `concierge.ts` `dc8cc43015ea81c22aa5ec018df77813c5918a7598607202f805c3fb79c79a64`; `session.ts` `50ce9c5e3774a95fd0ac66967d479f0c4f7c40894e3bf8d0aafb5d13dff2a470`.

## Verification

- Exact Plan 08-06 gate passed: build plus attw/publint, 3 runtime files / 66 tests, and declaration/type-test typecheck.
- Each named in-scope detector T-08-01 through T-08-08 and T-08-10 selected at least one passing integration test.
- Unchanged Phase 7 fixture/session compatibility gate passed: 4 files / 80 tests across stub, catalog, routing, and lifecycle suites.
- Full workspace gate passed: build, typecheck, and 20 runtime files / 427 tests.
- Artifact, zero-runtime-dependency, foreign tarball install/typecheck/import, and pinned Node 22.12 floor checks all passed.
- The production module namespace contains no `createStubTransport`; a fresh tarball contains no `test`, `test-d`, `fixtures`, or `stub-transport` path.
- `pnpm-lock.yaml` and `packages/concierge/package.json` remained byte-identical at SHA-256 `0e29065f823200f9bdb2284bdef721003f525f68fa60a2810046b1a7f720e0d4` and `5ed9d24829c2ac5bdcf69b57d4f4b503c226cee33f474ad07536521fec4112e4`; production `src/index.ts` retained git blob `44bf07158930b9dbc1c0f58ac09eeff6fc795223`.

## Known Stubs

None. Empty collections and nullable callback slots in the modified files are live fixture state or test observation buffers; no placeholder data, unwired UI source, TODO, FIXME, or mock production path remains.

## Issues Encountered

- Task 2's intended RED assertions were already satisfied by prerequisite runtime work. The two exact, restored temporary mutants supplied non-vacuous proof that the flagship and outcome-order detectors fail on the intended defects without manufacturing a production change.
- Vitest treats a name-filtered file containing zero matching tests as a failed empty suite. Detector selection therefore used the two integration files that contain all in-scope tags; the complete three-file suite was still run independently and passed 66/66.

## User Setup Required

None - the fixture is deterministic, network-free, and requires no service, secret, package, or environment configuration.

## Next Phase Readiness

- Plan 08-07 can reuse the exact detector names and fixture histories for the revision-bound mutation register, ASVS audit, and final requirement closure.
- TRN-02 now has the required full-kernel evidence through the exact Phase 7 fixture, with production export, tarball, dependency, and lockfile boundaries intact.
- No blockers remain.

## Self-Check: PASSED

- Summary and all five implementation/test files exist.
- Task commits `408744c`, `1a54543`, and `f29e93a` exist in repository history.
- No task commit deleted a tracked file, and the complete planning diff passes `git diff --check`.

---
*Phase: 08-consent-kernel*
*Completed: 2026-08-10*
