---
phase: 09-react-and-svelte-adapters
phase_number: 9
phase_name: React and Svelte adapters
audited_at: 2026-08-11T11:11:50Z
revision: 0516abea95c90f07165d95e9fa3caa836b14d8fe
verdict: OPEN_THREATS
status: blocked
asvs_level: 1
block_on: high
threats_total: 9
threats_closed: 8
threats_open: 1
unregistered_flags: 0
---

# Phase 09 Security Audit

## OPEN_THREATS

**Phase:** 09 — React and Svelte adapters
**Revision:** `0516abea95c90f07165d95e9fa3caa836b14d8fe`
**Closed:** 8/9 | **Open:** 1/9
**ASVS Level:** 1
**Verdict:** **BLOCKED — do not authorize publication**

The adapter/runtime controls and the three rounds of review fixes are present at the audited revision. One high-severity supply-chain mitigation is not: the documented credential-free versioned-finalization ceremony does not enforce a credential-free process or child environment. Because the finalizer executes workspace and dependency code while producing release-authorizing ledgers, `T-09-SC` remains open.

The current `.planning/config.json` does not declare `asvs_level` or `block_on`; this audit applies the conservative project baseline of ASVS Level 1 and blocks on High findings. The sealed `09-SECURITY.md` was not modified. It describes the earlier feature-evidence snapshot and is not evidence that the later release architecture is secure.

## Blocking Finding

### SEC09-B01 — Versioned finalization forwards ambient credentials to dependency-controlled processes

**Severity:** High / BLOCKER
**Threat:** `T-09-SC` — dependency supply-chain tampering
**Affected assurance:** `T-09-08` release-evidence integrity
**Disposition:** OPEN

The runbook calls `finalize versioned` a credential-free human ceremony and instructs the operator to run it without repository or npm credentials (`RELEASING.md:75-87`, `RELEASING.md:285-289`). The implementation does not enforce that boundary:

- `scripts/phase-09-mutation-battery.mjs:426-461` accepts the versioned-finalization command without checking the parent environment, npm configuration, or credential files.
- `scripts/phase-09-mutation-battery.mjs:935-960` creates every child environment by spreading all of `process.env`.
- `scripts/phase-09-package-check.mjs:189-199` repeats the same unrestricted environment inheritance for nested package/consumer commands.
- `scripts/phase-09-mutation-battery.mjs:2500-2597` executes the mutation and release gates, then generates and installs the four release-authorizing ledgers.

A maintainer who runs the documented command from a shell containing `GITHUB_TOKEN`, `GH_TOKEN`, `NPM_TOKEN`, `NODE_AUTH_TOKEN`, npm auth/config overrides, or credentials reachable through user configuration exposes those credentials to compromised workspace/dependency code. That code can exfiltrate them or perform repository/registry side effects during the authority ceremony. Receipt binding, clean-input checks, and the later clean sealer can validate the resulting files, but cannot undo a credential disclosure or side effect that occurred while the ledgers were generated.

This is distinct from review-3 CR-02. That fix correctly prevents dependency-produced evidence from crossing into the write-authorized Changesets `apply` job; it relocates final evidence generation to the human ceremony. The relocated ceremony itself still lacks the declared credential boundary.

**Required remediation:** Before any `finalize versioned` work, fail closed on credential/auth/registry/config environment variables case-insensitively and on ambient credential files/config that can affect invoked tools. Construct an explicit scrubbed or allowlisted child environment for every subprocess, including package-check descendants. Add regression tests that inject sentinel repository/npm credentials and hostile npm config, prove finalization aborts before executing a child, and prove no sentinel reaches a child process. Prefer network isolation for the finalization battery where practical.

## Threat Verification

| Threat ID | Category | Declared disposition | Result | Executable evidence |
|---|---|---|---|---|
| `T-09-01` | Tampering — React cleanup | mitigate | CLOSED | Registration occurs only in `useEffect` and returns the exact unregister function (`packages/concierge-react/src/client.tsx:63-80`); lifecycle tests and compiled R1 mutation evidence exercise stale cleanup and StrictMode behavior. |
| `T-09-02` | Tampering — stale React values | mitigate | CLOSED | The adapter-owned ref is updated post-commit and exposed through a stable callback (`packages/concierge-react/src/client.tsx:53-60`); lifecycle tests and compiled R2 mutation evidence distinguish the stale-closure defect. |
| `T-09-03` | Tampering/Spoofing — Svelte snapshot seam | mitigate | CLOSED | The public normalizer calls the compiler intrinsic `$state.snapshot` (`packages/concierge-svelte/src/client.svelte.ts:59-64`); packed lifecycle/artifact tests and S1 mutation coverage reject identity normalization. Documentation describes the client-integrity boundary rather than server authorization. |
| `T-09-04` | Information Disclosure — SSR registration/leak | mitigate | CLOSED | React registration is effect-only (`packages/concierge-react/src/client.tsx:63-80`), Svelte registration is effect-only (`packages/concierge-svelte/src/client.svelte.ts:37-56`), and the exact Node artifact/SSR project owns both adapter artifact tests and the Astro SSR test (`vitest.config.ts:103-111`). T04/SSR1 tests require absent DOM globals and zero registration. |
| `T-09-05` | Elevation of Privilege — duplicate core/version skew | mitigate | CLOSED | Both adapters call `assertSingleInstance` and compare the imported contract version immediately before registration (`packages/concierge-react/src/client.tsx:67-78`, `packages/concierge-svelte/src/client.svelte.ts:41-55`). Adapter manifests use core as peer+dev, not a runtime dependency (`packages/concierge-react/package.json:51-67`, `packages/concierge-svelte/package.json:56-72`); the exact archive/foreign-consumer gate proves one physical core. |
| `T-09-06` | Tampering — compiler/package transforms | mitigate | CLOSED | React has one first-statement client directive (`packages/concierge-react/src/client.tsx:1`), Svelte uses the Svelte compiler condition and `svelte-package` (`packages/concierge-svelte/package.json:28-40,60-72`), Vitest routes framework suites through their real plugins (`vitest.config.ts:113-128`), and the package gate checks the exact archive triplet rather than repacking. |
| `T-09-07` | Tampering — adapter budget/boundary | mitigate | CLOSED | The budget gate discovers production candidates, marks TypeScript comment trivia, counts authored lines, and performs AST responsibility checks (`scripts/phase-09-adapter-budget.mjs:395-465`). Its positive and negative self-tests cover unlisted files, limits, loop forms, and the former regex bypass. |
| `T-09-08` | Repudiation/DoS — evidence and output identity | mitigate | CLOSED | Version artifacts require repository/run/run-attempt/base-SHA/artifact identity (`scripts/phase-09-version.mjs:448-469`) and semantic-only operations (`scripts/phase-09-version.mjs:725-780`). Apply derives the receipt (`scripts/phase-09-version.mjs:1190-1221`). Versioned evidence requires nonzero authorization and exact receipt/run-attempt binding (`scripts/phase-09-mutation-battery.mjs:1794-1867`); the clean seal and publisher bind the same attempt and exact archive set. Atomic installation occurs only after prospective verification (`scripts/phase-09-mutation-battery.mjs:2465-2497,2580-2597`). |
| `T-09-SC` | Tampering — dependency supply chain | mitigate, with a plan-09-10 documentation-only accept | **OPEN** | Exact pins, frozen locks, offline foreign-consumer install, full-SHA Actions, split workflow permissions, exact npmjs registry, owned empty npm configs, and a credential-scrubbed *version prepare* are present. The versioned finalizer nevertheless forwards the full ambient environment to dependency-controlled children (`scripts/phase-09-mutation-battery.mjs:935-960`; `scripts/phase-09-package-check.mjs:189-199`). |

### Accepted risks log

| ID | Scope | Accepted risk | Status |
|---|---|---|---|
| `T-09-SC/09-10` | Documentation-only plan | Plan 09-10 installed no package and therefore accepted no new dependency-install exposure in that task. This bounded acceptance does not waive the phase-wide finalizer mitigation. | DOCUMENTED |
| `AR-09-DSSE` | Existing-version resume provenance | The publisher performs strict semantic DSSE binding but does not locally verify the DSSE signature or transparency log (`scripts/phase-09-publish-archives.mjs:455-569`). Trust remains with npm trusted-publisher ingestion/TLS plus the required human npmjs attestation check (`RELEASING.md:299-320`). | ACCEPTED RESIDUAL; not a cryptographic closure claim |

## Prior Review Regression Matrix

| Review | Prior issue | Current status | Evidence |
|---|---|---|---|
| 1 | Checked tarball differed from published/repacked bytes | CLOSED | Verify exports one exact archive triplet; seal and publisher consume those exact named, hashed bytes. |
| 1 | Version/evidence sequencing admitted stale evidence | CLOSED | Semantic prepare/apply receipt, versioned-only finalization, and receipt-bound clean seal are enforced. |
| 1 | OIDC existed in a dependency-running job | CLOSED | Workflow default permissions are empty; only `publish` has `id-token: write` and it has no checkout/install/build (`.github/workflows/release.yml:11-18,631-649`). |
| 1 | Svelte bridge inputs became stale | CLOSED | Getter inputs are read inside `$effect` (`packages/concierge-svelte/src/client.svelte.ts:37-56`). |
| 1 | Foreign consumer graph was unlocked | CLOSED | Committed consumer lock and offline `npm ci` are required by the package checker. |
| 1 | Logical LOC could be bypassed by regex/comment tricks | CLOSED | TypeScript trivia and AST-based analysis (`scripts/phase-09-adapter-budget.mjs:407-465`). |
| 1 | Skipped/empty test files could satisfy aggregate status | CLOSED | Exact nonempty file equality and positive per-file suite/test/assertion counts are required. |
| 2 | Package-directory publish bypassed checked archives | CLOSED | The publisher accepts only the independently sealed archive paths. |
| 2 | Write token reached the Changesets dependency battery | CLOSED | The write-authorized job runs only semantic `apply`; checkout credentials are not persisted (`.github/workflows/release.yml:80-114`). |
| 2 | Feature/`0.0.0` evidence could authorize publication | CLOSED | Publishing requires versioned, nonzero evidence with a consumed changeset and receipt (`scripts/phase-09-mutation-battery.mjs:1794-1867`). |
| 2 | Archive manifest self-authorized its own bytes | CLOSED | A separate read-only clean job recomputes and seals tracked evidence and archive bytes (`.github/workflows/release.yml:306-335`). |
| 2 | Partial publication had no safe recovery | CLOSED | Exact existing integrity/provenance can be skipped; ambiguous publish fails and requires a full rerun/new seal (`scripts/phase-09-publish-archives.mjs:807-857`). |
| 3 | Release identity omitted `runAttempt` | CLOSED | Attempt is required in version artifact, receipt, evidence, seal, publisher bindings, and every release artifact name. |
| 3 | Dependency evidence was laundered through privileged apply | CLOSED | The artifact is semantic-only and apply derives the receipt; generated ledgers do not cross the write-authorized job. SEC09-B01 covers the separate finalizer-environment gap. |
| 3 | Package metadata/config could redirect OIDC or publication | CLOSED | Exact npmjs registry, exact publish/repository metadata, owned empty configs, and case-insensitive publisher environment rejection (`scripts/phase-09-publish-archives.mjs:722-780`). |
| 3 | Resume trusted provenance-shaped metadata | CLOSED within documented boundary | Exact npmjs attestation retrieval and strict subject/source semantic binding are present (`scripts/phase-09-publish-archives.mjs:455-569`); local signature/transparency verification remains `AR-09-DSSE`. |

## Requirement Coverage

| Requirement | Security-relevant implementation status | Audit result |
|---|---|---|
| `ADP-01` — React scope, registration, StrictMode cleanup | Post-commit latest-value ref, effect-only register, exact cleanup, R1/R2 mutation killers | COVERED |
| `ADP-02` — Svelte lifecycle and `$state.snapshot` | Getter reads inside `$effect`, exact cleanup, native snapshot intrinsic, S1 killer | COVERED |
| `ADP-03` — independent adapter budgets | Exact inventory, TypeScript lexical/AST gate, B1 killer | COVERED |
| `ADP-04` — server-safe imports/render | Disjoint Node artifact/SSR project, fresh Astro SSR, zero globals/registration, SSR1 killer | COVERED |
| `PKG-04` — ESM and one shared core | Peer+dev topology, exact archive checks, isolated locked consumer, P1/C1 killers | COVERED |

Functional requirement coverage does not override the open release supply-chain threat.

## Verification Executed

| Check | Result |
|---|---|
| Syntax check of all five release/checker scripts | PASS |
| `phase-09-version.mjs self-test` | PASS — 23 controls |
| `phase-09-version.mjs simulate` | PASS — coherent `0.1.0`, one consumed changeset, bounded source peer and normalized final peer |
| `phase-09-publish-archives.mjs self-test` | PASS — 20 controls |
| `phase-09-mutation-battery.mjs self-test` | PASS — 26 controls |
| `phase-09-package-check.mjs selftest` | PASS — 7 controls |
| Adapter budget check and self-test | PASS — React 74/150 across 2 files; Svelte 58/150 across 2 files |
| Workflow checker | PASS — 2 workflows, 7 jobs, 16 controls, 19 CI steps, 40 release steps |
| Contract checker self-test/final | PASS — 0 missing IDs across 55 required nonempty artifacts |
| Test checker | PASS — 3 checker controls; 3 projects, 5 files, 10 suites, 11 tests |
| `node scripts/phase-09-mutation-battery.mjs verify all` | Expected fail-closed: current sealed evidence predates the required `feature`/`versioned` authorization mode |

No production `prepare`, `apply`, `finalize versioned`, terminal mutation `run all`, release battery, live publish, or npm publication command was executed.

## Threat Flags and Release State

The thirteen Phase 09 summaries contain no formal `## Threat Flags` entries. Their implementation-surface notes map to the registered threats above; no unregistered endpoint, authentication boundary, schema boundary, or publication route was found. **Unregistered flags: none.**

The checked-in public package versions remain `0.0.0`, the changeset remains pending, and the sealed feature-era evidence correctly fails the new versioned authorization checks. That is expected pre-ceremony state, not publication authorization.

## Release Gate

Phase 09 must not ship until SEC09-B01 is fixed and independently retested. At minimum, the retest must demonstrate:

1. `finalize versioned` rejects ambient repository/npm credentials and hostile npm config before any child process executes.
2. Every child process receives a scrubbed/allowlisted environment, including children launched by the package checker.
3. Sentinel credentials cannot be observed by a test child.
4. All 23 version, 26 mutation, 20 publisher, 7 package, budget, workflow, contract, and exact test-count controls still pass.
5. The normal clean, receipt-bound versioned ceremony is reviewed after the fix; only then may the release workflow be considered for publication.

`SECURITY.md`: `.planning/phases/09-react-and-svelte-adapters/09-SECURITY-AUDIT.md`
