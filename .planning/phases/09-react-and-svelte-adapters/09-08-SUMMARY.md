---
phase: 09-react-and-svelte-adapters
plan: 08
subsystem: testing
tags: [packaging, publint, attw, typescript-7, react, svelte, vitest, consent]

requires:
  - phase: 09-react-and-svelte-adapters
    provides: Public React and Svelte adapter entries, lifecycle guards, and server-safe package surfaces
  - phase: 02-core-public-surface
    provides: Core package declarations, bridge registry, consent kernel, and single-instance contract
provides:
  - One self-cleaning exact-triplet package harness with five strict modes and six destructive controls
  - Direct tar, publint, ATTW, TypeScript 7, topology, and positive-count SSR proof over packed archives
  - Genuine compiler-transformed Svelte rune consent drift proof with completed delivery and zero handler entry
  - Literal-only disposable React and Svelte mismatch proofs through public lifecycle registration paths
affects: [09-12, 09-13, ADP-02, PKG-04, release-evidence]

tech-stack:
  added: []
  patterns: [single-pack shared-archive pipeline, foreign-consumer verification, literal-only disposable mutation, positive-count JSON test gates]

key-files:
  created: []
  modified:
    - scripts/phase-09-package-check.mjs

key-decisions:
  - "Thread one immutable archive map through every `all` stage so tar, lint, install, declarations, SSR, consent, and mismatch checks share the same initial SHA-256 identities."
  - "Resolve adapter dependencies from installed adapter manifests and compare physical core realpaths, rather than trusting workspace metadata or npm graph text alone."
  - "Patch and repack only each disposable adapter's unique built expected-version literal, then verify the original core digest before and after the public lifecycle failure."
  - "Compare the exact Svelte adapter error first line because the Svelte runtime appends a component trace to the thrown Error message."

patterns-established:
  - "Exact archive pipeline: pack each live package once, enumerate exactly three identities, hash them, and pass those exact paths to every authoritative stage."
  - "Foreign consumer proof: install exact file archives with scripts disabled, reject repository-entering links, and test only installed public exports."
  - "Destructive harness controls: synthetic missing/extra archives, workspace links, duplicate core copies, zero-test reports, and child failures must each trip their named assertion."

requirements-completed: [ADP-02, PKG-04]

duration: 29m
completed: 2026-08-10
---

# Phase 09 Plan 08: Exact Packed Adapter Triplet Summary

**One SHA-256-identified core/React/Svelte archive triplet now passes direct package linting, foreign TypeScript and SSR consumption, genuine-rune consent drift, and literal-only public lifecycle mismatch proofs without workspace resolution or repacking the authoritative inputs.**

## Performance

- **Duration:** 29m
- **Started:** 2026-08-11T04:13:29Z
- **Completed:** 2026-08-11T04:42:06Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Replaced the legacy package checker with a strict five-mode Node harness that owns and validates its temporary root, bounds every child process and captured stream, builds the three packages, packs each live directory once, and enumerates exactly one archive per package identity.
- Inspected the exact tar entries and manifests, rejected private/bundled content, ran direct strict publint and ATTW checks, and installed the archives into a foreign npm consumer with scripts disabled and pinned consumer-only tools.
- Proved TypeScript 7.0.2 declarations with `skipLibCheck: false`, public root/client imports, one physical core realpath for both adapters, no nested core, absent server browser globals, zero SSR registrations, and positive test counts.
- Compiled a real `.svelte.ts` rune module, completed public review delivery, mutated nested live state, observed the moved registry getter, received the exact `consent_stale` result, and kept the destructive handler count at zero; the identity-normalizer control deliberately allows the handler once.
- Unpacked and changed exactly one built expected-version literal per disposable adapter, repacked only that adapter, retained the byte-identical original core archive, and exercised the public React hook and compiled Svelte effect until both failed actionably before registration.
- Added six destructive self-controls for missing and extra archives, repository-entering links, duplicate core copies, zero-test JSON, and failed child processes, plus post-success-only optional archive export validation.

## Task Commits

1. **Task 09-08-01 RED: Specify the exact-triplet package harness** - `091b617` (`test`)
2. **Task 09-08-01 GREEN: Validate the exact package archive triplet** - `790c90f` (`feat`)
3. **Task 09-08-02 RED: Specify packed consent and mismatch probes** - `390e82f` (`test`)
4. **Task 09-08-02 GREEN: Prove packed consent drift and adapter mismatches** - `3d84470` (`feat`)

## Files Created/Modified

- `scripts/phase-09-package-check.mjs` - Strict CLI, owned temporary-root lifecycle, exact archive enumeration and hashing, direct package-quality checks, foreign consumer topology/declaration/SSR gates, real-rune consent oracle, disposable mismatch probes, optional export, and destructive self-tests.

## Decisions Made

- Kept the authoritative archive map immutable and shared. Focused modes may run selected stages, but `all` packs exactly once and never substitutes a separately generated validation input.
- Required both npm graph evidence and `createRequire` resolution from each installed adapter manifest. This proves the adapters actually load the consumer's one physical core, not merely that their manifests declare a peer.
- Used the installed Svelte Vite and Testing Library plugins for the public mismatch component. The adapter error text is asserted exactly before Svelte's runtime-added component trace, and the registry spy independently proves no registration occurred.
- Treated positive files, suites, and tests as data, not process-exit proxies. Every Vitest JSON report is parsed and rejected if its expected file is absent or any count is zero.
- Limited the optional release-CI export to an already existing empty directory outside the repository and perform it only after all `all` assertions pass; normal runs persist no evidence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the public root runtime assertion**
- **Found during:** Task 09-08-01 GREEN
- **Issue:** The first SSR fixture expected a runtime package-name export from adapter root entries, but the roots intentionally expose type-only contracts and therefore have no runtime keys.
- **Fix:** Asserted the exact empty runtime key set while retaining public root imports in both the TypeScript and server fixtures.
- **Files modified:** `scripts/phase-09-package-check.mjs`
- **Verification:** The foreign TypeScript program and two-file React/Svelte server JSON suite both pass from the exact archives.
- **Committed in:** `790c90f`

**2. [Rule 3 - Blocking] Selected Svelte's browser lifecycle in the disposable consumer**
- **Found during:** Task 09-08-02 GREEN
- **Issue:** The first generated Svelte mismatch configuration resolved the server-only lifecycle, so Testing Library failed at unavailable `mount` before the adapter's public effect could execute.
- **Fix:** Mirrored the repository lifecycle configuration by loading `svelteTesting()` beside the Svelte Vite plugin; compared the exact adapter message before Svelte's appended component trace.
- **Files modified:** `scripts/phase-09-package-check.mjs`
- **Verification:** The compiled public Svelte component reaches the v999/v1 guard, preserves `registerCount === 0`, and the focused and authoritative mismatch stages pass.
- **Committed in:** `3d84470`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking issue)
**Impact on plan:** Both fixes stayed inside the planned harness and were required to test the intended public package behavior; no product source or package contract changed.

## Issues Encountered

- Svelte appends a component/effect trace to errors thrown during mounted effects. The harness proves the complete actionable adapter error as the exact first line and does not mistake framework-added diagnostic context for adapter output.
- The Conductor checkout uses a `.git` file despite sequential mode. The configured shared-branch exception was honored; no refs, branches, or worktrees were created or changed.

## TDD Gate Compliance

- Task 09-08-01 has a dedicated failing exact-triplet sentinel commit (`091b617`) before its passing implementation commit (`790c90f`).
- Task 09-08-02 has independently collected failing consent and mismatch sentinels (`390e82f`) before its passing implementation commit (`3d84470`).
- Both RED runs failed only at their named unimplemented sentinels; both GREEN implementations passed their focused commands before commit.

## Verification

- `node --check scripts/phase-09-package-check.mjs` - passed.
- `node scripts/phase-09-package-check.mjs self-test` - passed all six destructive controls.
- `node scripts/phase-09-package-check.mjs artifacts` - passed direct tar/publint/ATTW, TypeScript 7.0.2, one-core topology, and two positive server files.
- `node scripts/phase-09-package-check.mjs svelte-consent` - passed with 1 file, 2 suites, and 1 test.
- `node scripts/phase-09-package-check.mjs mismatch` - passed both public lifecycle probes, each with 1 file, 2 suites, and 1 test, against unchanged core SHA-256 `e6f3d3299059976f1dbaf277befe8a554ff179014bdd254db6abe5b79a85b011`.
- The one authoritative `node scripts/phase-09-package-check.mjs all` closeout passed with core `e6f3d3299059976f1dbaf277befe8a554ff179014bdd254db6abe5b79a85b011`, React `26eed87e5730bc80da4594e6e25f8f678e1f8ac85bc83657f5bbf1f066d05452`, and Svelte `ccfb669afaba4afee30ea67323ac97e32ef890ad2bf0b53cc889b1be71c39f4e` shared throughout all stages.
- `node scripts/phase-09-contract-check.mjs baseline-verify` - passed all 11 immutable assertion-observed IDs at digest `e47452c174621433d2e5a4d56e6225ad42b010cc1518b5e15771be25047d6f50`.
- Stub scan - no RED sentinel, TODO, FIXME, placeholder text, empty UI data, or unwired component remains; empty objects and nulls found by the lexical scan are initialized accumulators, explicit optional-state checks, or deliberate zero-registration fixtures.
- Threat-surface scan - no network endpoint, authentication path, or schema trust boundary was added. Temporary file access, child execution, archive tampering, isolated installs, consent snapshots, and singleton/version topology are all within the plan's registered threat model.

## User Setup Required

None - the harness uses pinned repository tools, local package archives, and owned temporary storage.

## Next Phase Readiness

- Plans 09-12 and 09-13 can consume one deterministic package oracle for D-09-12 and D-09-16 instead of workspace-link, source-import, or separately repacked evidence.
- ADP-02 and PKG-04 now have exact packed public-entry, singleton-topology, real-rune consent, and mismatch coverage; no blockers remain.

## Self-Check: PASSED

The modified harness and this summary are present and nonempty; all four TDD commits exist, each contains only `scripts/phase-09-package-check.mjs`, the six destructive controls pass, and the one authoritative shared-triplet `all` run completed successfully.

---
*Phase: 09-react-and-svelte-adapters*
*Completed: 2026-08-10*
