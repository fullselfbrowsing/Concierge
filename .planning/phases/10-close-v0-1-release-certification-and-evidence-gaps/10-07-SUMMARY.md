---
phase: 10-close-v0-1-release-certification-and-evidence-gaps
plan: 07
subsystem: release-certification
tags: [versioned-evidence, independent-verification, clean-clone, exact-sha, github-actions]
requires:
  - phase: 10-close-v0-1-release-certification-and-evidence-gaps
    plan: 06
    provides: settled REQUIREMENTS bytes, complete ownership metadata, and registered Phase 9/10 state
  - phase: 09-react-and-svelte-adapters
    provides: versioning workflow, transactional evidence generator, package consumer, and release gates
provides:
  - final versioned Phase 9 mutation, release, validation, and security seal after the last release-input write
  - independent passing Phase 9 verification for ADP-01 through ADP-04 and carried PKG-04
  - exact fourteen-row Phase 10 local validation record and green disposable clean-clone release chain
  - run-ID-free post-GSD handoff for exact-SHA hosted certification without a successor repository write
affects: [phase-10-verification, milestone-audit, exact-sha-hosted-certification, version-packages-pr]
tech-stack:
  added: []
  patterns: [credential-free-versioned-finalization, independent-verifier-ownership, two-stage-no-write-certification]
key-files:
  created:
    - .planning/phases/09-react-and-svelte-adapters/09-VERSION-RECEIPT.json
    - .planning/phases/09-react-and-svelte-adapters/09-VERIFICATION.md
    - .planning/phases/10-close-v0-1-release-certification-and-evidence-gaps/10-CERTIFICATION.md
    - .planning/phases/10-close-v0-1-release-certification-and-evidence-gaps/10-07-SUMMARY.md
  modified:
    - scripts/phase-09-mutation-battery.mjs
    - scripts/phase-09-secure-environment.mjs
    - .planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json
    - .planning/phases/09-react-and-svelte-adapters/09-RELEASE-EVIDENCE.json
    - .planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md
    - .planning/phases/09-react-and-svelte-adapters/09-SECURITY.md
    - .planning/phases/10-close-v0-1-release-certification-and-evidence-gaps/10-VALIDATION.md
key-decisions:
  - Bind the final seal to the hosted Version Packages receipt and run the authoritative generator only in its credential-free versioned mode after REQUIREMENTS is settled.
  - Provision the inherited Phase 8 search command from an owned executable directory validated by the secure-environment constructor, never by ambient environment spreading.
  - Keep Phase 9 verification outside generator ownership and accept closure only from a separate registered verifier with resolved evidence references.
  - Finish every tracked GSD record before certification, then treat the external exact-SHA run receipt as authoritative without writing a tracked pass claim afterward.
patterns-established:
  - "Versioned evidence installation is one fail-closed transaction: inherited proof, 17 mutants, release gates, prospective validation, then four-file atomic installation."
  - "External terminal facts are certified against the final clean handoff commit and remain external when recording them would change the certified SHA."
requirements-completed: [CAT-02, CAT-03, CAT-05, CAT-06, CAT-07, SEC-01, SEC-03, SEC-05, PKG-02, PKG-03, PKG-04, DX-01, DX-03, ADP-01, ADP-02, ADP-03, ADP-04]
metrics:
  duration: 52m
  completed: 2026-08-12
---

# Phase 10 Plan 07: Final Seal and Exact-SHA Handoff Summary

The versioned Phase 9 candidate is transactionally sealed and independently passed, while Phase 10 now has a green clean-clone proof and an executable no-write handoff for the one remaining hosted exact-SHA fact.

## Performance

- **Started:** 2026-08-12T19:52:00Z
- **Completed:** 2026-08-12T20:44:00Z
- **Duration:** 52 minutes
- **Tasks:** 2
- **Files changed:** 22

## Accomplishments

- Consumed the hosted Version Packages result at version `0.1.0`, including its exact base SHA, changeset digest, manifest/lock digests, and tracked version receipt.
- Ran the final credential-free versioned transaction after Plan 06's last REQUIREMENTS write: all five inherited Phase 8 records verified, all 17 mutants compiled and died for positive exact detectors, 15 release commands passed, and three exact archives were sealed.
- Atomically installed the four Phase 9 generator outputs with release-input digest `797d2739d011b19735e9d30bc035acb9aebbf470ea9c637f2ba48a19c6c2f0f4`; the manifest contains REQUIREMENTS SHA-256 `c75244549d68532f13980cc91bdbf67afc498bc3eacbaa265dd899f6561a3035`, no `.astro` path, and no later closeout artifact.
- Invoked a separate registered verifier that authored `09-VERIFICATION.md` with `status: passed`, 5/5 must-haves, ADP-01–04 and PKG-04 satisfied, and 21/21 references valid.
- Replaced the projected Phase 10 map with exactly fourteen observed task rows and created the supported two-stage certification runbook.
- Proved the committed candidate in a disposable clone through frozen install → build → typecheck → 25 files/455 tests → Phase 9 verify-all → Astro/package/budget/static/evidence/workflow release gates.

## Task Commits

1. **Task 10-07-01: Seal final Phase 9 inputs and invoke its independent verifier** — `af4707d` (fix), `1b65257` (version), `baff704` (fix), `01a3d95` (fix), `594dd1f` (test), `d8ab5d4` (docs)
2. **Task 10-07-02: Finalize local validation and the supported post-GSD certification handoff** — `af6457d` (docs)
3. **Hosted certification retry repair: retain sealed receipt ancestry and reseal the changed inputs** — `840a302` (fix), `72645cb` (test)

## Final Evidence Identity

- Shared package version: `0.1.0`.
- Release-input digest: `797d2739d011b19735e9d30bc035acb9aebbf470ea9c637f2ba48a19c6c2f0f4`.
- REQUIREMENTS digest: `c75244549d68532f13980cc91bdbf67afc498bc3eacbaa265dd899f6561a3035`.
- Mutation evidence: 17/17 green with byte-identical restoration.
- Release evidence: 15 commands, three archives, five inherited Phase 8 hashes.
- Independent Phase 9 verifier: passed, 5/5 must-haves, no human checks or remaining gaps.
- Clean clone: build-first chain green with 455/455 tests and the exact public release gate.

## Files Created or Modified

- `.planning/phases/09-react-and-svelte-adapters/09-VERSION-RECEIPT.json` — hosted version-preparation identity and exact versioned-input receipt.
- `.planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json` — final 17-row versioned mutation ledger.
- `.planning/phases/09-react-and-svelte-adapters/09-RELEASE-EVIDENCE.json` — final archive, package, SSR, workflow, and inherited-evidence ledger.
- `.planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md` — canonical Nyquist-compliant final validation record.
- `.planning/phases/09-react-and-svelte-adapters/09-SECURITY.md` — current threat disposition bound to the final release inputs.
- `.planning/phases/09-react-and-svelte-adapters/09-VERIFICATION.md` — independently authored Phase 9 pass report.
- `scripts/phase-09-mutation-battery.mjs` — supplies the inherited search tool on every secure finalization path.
- `scripts/phase-09-secure-environment.mjs` — validates and prepends one owned executable directory without ambient expansion.
- `.planning/phases/10-close-v0-1-release-certification-and-evidence-gaps/10-VALIDATION.md` — exact fourteen-task local validation map.
- `.planning/phases/10-close-v0-1-release-certification-and-evidence-gaps/10-CERTIFICATION.md` — ordinary-closeout and external-certification handoff.
- Package manifests/changelogs and release workflow/docs — version `0.1.0` candidate and canonical GitHub repository binding.

## Decisions Made

- Used the Version Packages receipt as version authorization and retained the consumed changeset hash even though the version commit deletes the changeset file.
- Installed one repository-independent `rg` compatibility shim inside each owned secure child root so inherited Phase 8 verification is deterministic on hosts without ripgrep.
- Extended the secure-environment constructor with a validated direct-child executable directory instead of weakening its override allowlist or copying ambient variables.
- Kept the Phase 9 verifier independent from both the plan executor and generator; the executor only checked its schema, verdict, requirements, and references.
- Kept hosted success out of every tracked Phase 10 claim. The final external run and receipt will be authoritative because a tracked post-run update would certify different bytes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected the canonical GitHub repository case before version preparation**

- **Found during:** Task 10-07-01 hosted version preparation.
- **Issue:** GitHub supplied `fullselfbrowsing/Concierge`, while release validators expected a lowercase repository string; the preparation job failed before creating the receipt.
- **Fix:** Updated all six workflow/version/publisher bindings and their static hash/checker expectations to the canonical GitHub identity.
- **Verification:** Version, publisher, mutation, workflow, and contract self-tests passed; the retried release workflow created the Version Packages candidate and receipt.
- **Committed in:** `af4707d`.

**2. [Rule 3 - Blocking] Supplied the inherited Phase 8 search tool to direct finalization**

- **Found during:** Task 10-07-01 first authoritative finalizer attempt.
- **Issue:** The host had no `rg`; the existing owned compatibility shim was reachable only from nested prospective preflight, so direct inherited Phase 8 verification exited 255.
- **Fix:** Installed the shim for every owned child environment and added it to the existing 45-control secure-environment self-test.
- **Verification:** The original four evidence outputs remained byte-identical after failure; the retry passed inherited Phase 8 verification and all 17 mutants.
- **Committed in:** `baff704`.

**3. [Rule 1 - Bug] Preserved the no-ambient-environment contract while provisioning the tool**

- **Found during:** Task 10-07-01 late prospective final-contract check.
- **Issue:** The first generalized implementation spread `process.env`; the Phase 9 security contract correctly rejected it after all earlier gates and prevented output installation.
- **Fix:** Added a normalized, existing, direct-child `executableDirectory` option to the secure constructor and passed the original environment without a spread.
- **Verification:** Both secure-environment self-test suites and the complete 57-artifact contract passed; the four prior outputs again remained unchanged before the successful retry.
- **Committed in:** `01a3d95`.

**4. [Rule 3 - Blocking] Retained the sealed Version Packages ancestry in hosted CI**

- **Found during:** The first Stage B hosted certification attempt, run `31642179232`.
- **Issue:** The build job passed install, build, typecheck, 455 tests, artifact, dependency, pack, package, budget, and contract gates, then failed when `verify all` could not name the sealed Version Packages base SHA in a shallow checkout.
- **Fix:** Required `fetch-depth: 0` for the read-only exact-SHA build checkout, pinned that requirement in the workflow checker, and reran the full credential-free versioned evidence transaction.
- **Verification:** The guard failed on the shallow workflow, passed after the fix, and the retry produced 17/17 green mutants, 15/15 release commands, three archives, and a matching 136-entry digest in both ledgers.
- **Committed in:** `840a302`, `72645cb`.

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking prerequisites). All were required for deterministic, fail-closed finalization; none broadened product scope.

## Issues Encountered

- The Version Packages manifest update made the existing local `node_modules` store metadata stale. A frozen `CI=true` install refreshed only ignored dependencies; the public release alias then passed unchanged.
- The verifier's first reference scan interpreted command snippets and a shortened artifact path as missing files. The same verifier normalized those references and produced a 21/21 valid report without changing its verdict.
- The registered ROADMAP counter correctly derived 7/7 and checked Plan 10-07, but its generic terminal state is `Complete`. The certification contract requires the locally complete plan set to remain `In Progress` until hosted truth exists, so the derived count/checkbox were retained while the phase row and certification sentence were narrowed to the explicit pending external state.

## User Setup Required

None. GitHub authentication was already available for version preparation; npm publication, provenance inspection, and tagging remain explicitly deferred.

## Next Phase Readiness

- All seven ordinary Phase 10 plans now have SUMMARYs and the sealed REQUIREMENTS bytes remain unchanged.
- The registered Phase 10 verifier can now evaluate the complete local phase and must report only `EXT-HOSTED-10` with supported `status: gaps_found`.
- The milestone audit can then rescore 62/62 requirements, 9/9 original phases, 10/10 current directories, 12/12 integrations, 10/10 flows, and Phase 9 Nyquist compliance, retaining that same sole external gap.
- After final registered bookkeeping and one clean handoff commit, `node scripts/phase-10-certify-candidate.mjs certify` is the only remaining gate; success permits no later repository write.

## Self-Check: PASSED

All task commits resolve; Phase 9 completeness is 13/13; the independent report is passed and reference-valid; final seal digests agree; exactly fourteen Phase 10 task rows exist; the certification self-test has 29 controls; and the disposable clean-clone release chain is green. The unrelated milestone-audit edit and Phase 10 `.gitkeep` remain unstaged.

---
*Phase: 10-close-v0-1-release-certification-and-evidence-gaps*
*Completed: 2026-08-12*
