---
phase: 06-dispatcher
plan: 06
subsystem: testing
tags: [typescript, mutation-testing, vitest, ast-audit, security, validation]

# Dependency graph
requires:
  - phase: 06-dispatcher
    plan: 01
    provides: "R01-R54 single-call, security, timing, normalization, sanitization, and bridge contracts"
  - phase: 06-dispatcher
    plan: 02
    provides: "Q01-Q14 batch parsing, ordering, seriality, abort, correlation, and direct-loop contracts"
  - phase: 06-dispatcher
    plans: [04, 05]
    provides: "Completed single-call and batch dispatcher implementations"
provides:
  - "Immutable 54-row dispatcher mutation register with machine-readable execution evidence"
  - "Fail-closed TypeScript AST audit for telemetry channels and exception forwarding"
  - "Measured Phase 6 validation, requirement traceability, and Nyquist sign-off"
affects: [07-session-and-transport-seam, 08-consent-kernel, security-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mutation credit requires a compiled build, non-zero named detector, harness kill, restored green gates, and scoped-tree restoration"
    - "Source-boundary security audits parse production TypeScript ASTs and ignore comments by construction"

key-files:
  created:
    - scripts/phase-06-mutation-battery.mjs
    - scripts/check-no-telemetry.mjs
    - .planning/phases/06-dispatcher/06-MUTATION-REGISTER.json
    - .planning/phases/06-dispatcher/06-MUTATION-EVIDENCE.json
  modified:
    - .planning/phases/06-dispatcher/06-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "A Phase 6 mutant is green only when it compiles, runs more than zero intended tests, fires the exact named case or type diagnostic, restores its target byte-for-byte, and leaves restored gates and scoped source green."
  - "SEC-02 is satisfied structurally for Phase 6: production defines no telemetry channel at all, while runtime R34-R36 prove exception text reaches neither results nor console."
  - "SEC-03 remains mapped to Phase 4 and pending under its recorded jsonSchema-getter carve-out; Phase 6 adds only the completed prototype-safe dispatch lookup evidence."

patterns-established:
  - "Evidence register: hard-coded ordered IDs -> digest-matched JSON register -> runner-owned evidence rows -> strict group/all verification."
  - "AST audit: recursive non-empty scan -> required-file assertion -> parse-diagnostic gate -> exhaustive child traversal -> fail-closed findings."

requirements-completed: [DSP-01, DSP-02, DSP-03, DSP-04, DSP-05, DSP-06, DSP-07, DSP-08, DSP-09, SEC-02, SEC-06, TRN-04]

# Metrics
duration: 35min
completed: 2026-08-06
---

# Phase 6 Plan 06: Dispatcher Mutation and Gate Evidence Summary

**Fifty-four compiled dispatcher mutants are killed by exact named detectors, an AST audit proves the production tree has no telemetry or bound exception-forwarding path, and every runtime, type, artifact, dependency, pack, and Node-floor gate is green.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-06T04:24:22Z
- **Completed:** 2026-08-06T04:59:39Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Created the complete immutable M-06 register at digest `01013d0fafab25c58a2a030f606ac4633a78c5b65b02393c69a42a2d54b2d1ba` and recorded 54/54 green evidence rows with zero unexecuted or escaped mutants.
- Proved every mutant compiled, ran its exact intended runtime case or type diagnostic, fired the harness, restored its source, passed restored build/test/type gates, and left scoped source clean.
- Added a TypeScript AST audit over all 11 production files that ignores comments while rejecting executable telemetry/onTelemetry/onError channels, emissions, ambiguous name shapes, and any bound exception value in the dispatcher result path.
- Ran the exact phase gate: 211/211 tests across 11 files, clean typecheck/build/artifact/dependency checks, a foreign pack-install/typecheck/import, and a pinned Node v22.12.0 import.
- Replaced placeholder validation cells with measured evidence and added exact R/Q/M references for all Phase 6 requirements, BRG-03's real-dispatch join, and SEC-03's dispatch-side lookup proof.

## Task Commits

Each task was committed atomically:

1. **Task 1 (06-06-T1): Run and record the single-call and security mutation battery** — `36b355c` (test)
2. **Task 2 (06-06-T2): Run and record the batch mutation battery** — `5527b9e` (test)
3. **Task 3 (06-06-T3): Run the phase gate and record requirement evidence** — `033deac` (test)

## Files Created/Modified

- `scripts/phase-06-mutation-battery.mjs` — immutable 54-mutant definition set, mutation harness orchestration, Vitest/type diagnostic extraction, restoration gates, evidence writer, and strict verifiers.
- `scripts/check-no-telemetry.mjs` — recursive TypeScript AST audit for forbidden channels, imports/exports, properties, calls, emissions, and caught-value forwarding.
- `.planning/phases/06-dispatcher/06-MUTATION-REGISTER.json` — exact ordered mutant definitions and digest.
- `.planning/phases/06-dispatcher/06-MUTATION-EVIDENCE.json` — 54 measured green rows with build, detector, target hash, restoration, and clean-tree predicates.
- `.planning/phases/06-dispatcher/06-VALIDATION.md` — completed task map, mutation counts, full gate evidence, and Nyquist sign-off.
- `.planning/REQUIREMENTS.md` — named dispatcher evidence for DSP-01…DSP-09, SEC-02, SEC-06, TRN-04, BRG-03, and the SEC-03 dispatch-side proof.

## Decisions Made

- Kept the register and evidence independently digest-bound, so missing, duplicated, reordered, extra, or hand-substituted rows cannot satisfy verification.
- Required S34 to run R31 green before invoking its exact type-level detector; a build-only or zero-runtime-test failure cannot receive mutation credit.
- Treated the absence of a telemetry channel as SEC-02's Phase 6 structural guarantee. Runtime exception tests separately prove the generic result and console boundary.
- Preserved SEC-03's original Phase 4 ownership and open getter carve-out while recording that `__proto__` and `constructor` cannot enter a dispatch handler.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced an identity-preserving cache-hit mutant**
- **Found during:** Task 1, M-06-S02.
- **Issue:** `Promise.resolve(hit)` returns the same native Promise and therefore did not mutate the promised identity boundary.
- **Fix:** Replaced it with `hit.then((result) => result)`, regenerated the register before accepted evidence, and reran the subgroup.
- **Files modified:** `scripts/phase-06-mutation-battery.mjs`, mutation register and evidence.
- **Verification:** M-06-S02 compiled, fired R01, restored clean, and verifies green.
- **Committed in:** `36b355c`.

**2. [Rule 1 - Bug] Pointed malformed-field removal at its discriminating case**
- **Found during:** Task 1, M-06-S27.
- **Issue:** R37's scalar/null values are rejected by the earlier object guard, so removing the later field guard did not affect that case.
- **Fix:** Registered R39, whose non-string message reaches the removed field guard, then regenerated and reran the final register.
- **Files modified:** `scripts/phase-06-mutation-battery.mjs`, mutation register and evidence.
- **Verification:** M-06-S27 compiled, failed exactly R39, and restored green.
- **Committed in:** `36b355c`.

**3. [Rule 1 - Bug] Corrected the exact emitted S34 diagnostic location**
- **Found during:** Task 1, M-06-S34.
- **Issue:** The registered location used a repository-relative path and line 15, while the package typecheck emits `test-d/dispatcher.test-d.ts(16,35)`.
- **Fix:** Recorded the exact emitted diagnostic and reran S34 without discarding the unchanged measured runtime rows.
- **Files modified:** `scripts/phase-06-mutation-battery.mjs`, mutation register and evidence.
- **Verification:** R31 ran green first, then the exact TS2344 diagnostic killed S34; restored gates stayed green.
- **Committed in:** `36b355c`.

**4. [Rule 3 - Blocking] Resolved the installed stable compiler API without a dependency change**
- **Found during:** Task 3, AST audit implementation.
- **Issue:** The workspace's TypeScript 7 package root exposes the native-preview surface and has no `createSourceFile`, although the locked ATTW toolchain already installs the stable compiler API.
- **Fix:** Capability-check the root package, then resolve the locked stable compiler through `@arethetypeswrong/cli` and `@arethetypeswrong/core` package metadata rather than a package-manager store path.
- **Files modified:** `scripts/check-no-telemetry.mjs`.
- **Verification:** The audit parsed 11/11 files with 0 findings; executable-telemetry and catch-binding positive controls each fired and restored clean.
- **Committed in:** `033deac`.

---

**Total deviations:** 4 auto-fixed (3 Rule 1 bugs, 1 Rule 3 blocking issue).
**Impact on plan:** Corrections made the planned evidence exact and discriminating without changing production code, dependencies, public API, or scope.

## Issues Encountered

No unresolved issues. All detector-design mismatches were corrected before phase sign-off, and no mutation remained applied.

## Verification Evidence

| Gate | Result |
|------|--------|
| `node scripts/phase-06-mutation-battery.mjs verify all` | PASS; 54 green, 0 unexecuted, digest matched |
| `node scripts/check-no-telemetry.mjs` | PASS; 11 production files parsed, 0 findings |
| AST positive controls | PASS; executable `telemetry` identifier and dispatcher catch binding each rejected, source restored |
| `pnpm build` | PASS; 4 artifacts / 615.21 kB, embedded ATTW and publint clean |
| `pnpm typecheck` | PASS; package type surface green |
| `pnpm test` | PASS; 211/211 across 11 files |
| `pnpm check:artifact` | PASS; publint strict and ATTW profiles green |
| `pnpm check:deps` | PASS; one-module artifact, no runtime imports, dependency entries contribute 0 bytes |
| `pnpm check:pack` | PASS; foreign install, TypeScript 7.0.2 declaration check, and runtime import |
| `pnpm check:node-floor` | PASS; package installed and imported on Node v22.12.0 |
| Source/dependency isolation | PASS; no mocking API, source/test/type/manifests/lockfile clean after mutations |

## Known Stubs

None. The register contains no unexecuted evidence rows, and the validation ledger contains no placeholders or unsigned gates.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 6 is complete and ready for verification.
- Phase 7 can route Session batches through the proven serial dispatcher and preserve call correlation without recreating parsing or policy.
- Phase 8 can rely on the proven commit-window, abort, metadata, and generic-error boundaries when adding consent.
- No package, authentication, dependency, external service, or architectural blocker remains.

## Self-Check: PASSED

- All six planned files and this summary exist on disk.
- Task commits `36b355c`, `5527b9e`, and `033deac` exist in git history.
- Register/evidence digest, 54-row counts, test totals, AST file count, and package-gate claims match executed command output.
- Production source, dispatcher tests, type tests, manifests, and lockfile are clean.

---
*Phase: 06-dispatcher*
*Completed: 2026-08-06*
