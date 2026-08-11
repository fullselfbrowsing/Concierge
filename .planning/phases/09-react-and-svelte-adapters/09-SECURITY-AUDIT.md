---
phase: 09-react-and-svelte-adapters
phase_number: 9
phase_name: React and Svelte adapters
audited_at: 2026-08-11T11:48:27Z
revision: 8e6df36b9827fd992c3737b52f0cb6be6b79c3a1
remediation_commits:
  - b48fea4258ef12f882c7f927b5c28e6d427d211c
  - f29d0a236e0868c707eb1e37f8be4b2c05bab856
verdict: SECURED
status: passed
asvs_level: 1
block_on: high
threats_total: 9
threats_closed: 9
threats_open: 0
unregistered_flags: 0
---

# Phase 09 Security Re-audit

## SECURED

**Phase:** 09 — React and Svelte adapters

**Revision:** `8e6df36b9827fd992c3737b52f0cb6be6b79c3a1`

**Threats Closed:** 9/9

**ASVS Level:** 1

**Verdict:** **PASS**

The focused re-audit confirms that commits `b48fea4` and `f29d0a2` remediate `SEC09-B01`. The versioned finalization boundary now rejects recognized ambient authority/config before any temporary root, mutation lock, child, or evidence work and supplies every mutation/package descendant an explicit credential-free environment. No High or open declared threat remains.

This verdict verifies the implementation controls; it does not authorize a live publish or the still-pending versioned-finalization ceremony. The current `.planning/config.json` does not declare `asvs_level` or `block_on`, so this report retains the conservative project baseline of ASVS Level 1 with High findings blocking.

## SEC09-B01 Remediation Disposition

### CLOSED — credential-free versioned finalization is executable, not merely documented

| Required property | Result | Code evidence |
|---|---|---|
| Preflight precedes all authority-ceremony work | PASS | `main()` wraps the complete versioned `execute` closure in `runAfterCredentialFreeFinalizationPreflight` (`scripts/phase-09-mutation-battery.mjs:2756-2786`). Only that closure calls `withOwnedChildEnvironment`, which creates the owned temporary root, and then `withMutationLock` (`scripts/phase-09-mutation-battery.mjs:2768-2777`). The preflight invokes its operation only after all environment and path checks complete (`scripts/phase-09-secure-environment.mjs:183-240`). |
| Case-insensitive recognized authority/config rejection | PASS | Environment names are de-duplicated and normalized case-insensitively (`scripts/phase-09-secure-environment.mjs:121-152`); repository/npm/CI tokens, tool prefixes, proxy/trust/preload/temp overrides, and dynamic-loader controls are rejected (`scripts/phase-09-secure-environment.mjs:26-61,154-170`). HOME, USERPROFILE, XDG, and known repository config/credential paths are checked before execution (`scripts/phase-09-secure-environment.mjs:63-99,173-231`). |
| No ambient environment inheritance in finalization children | PASS | Mutation `git`, generic command, copy, tar, and historical Git reads all receive `childEnvironment()` (`scripts/phase-09-mutation-battery.mjs:506-517,974-994,1048-1060,2144-2150,2308-2316`). The package checker has one child gateway and always supplies the secure environment (`scripts/phase-09-package-check.mjs:207-237`). Static inspection found no `...process.env`, `env: process.env`, or equivalent child assignment in either execution tree. |
| Small inherited allowlist | PASS | Only PATH/PATHEXT, Windows runtime paths, locale, and timezone may cross from the parent (`scripts/phase-09-secure-environment.mjs:6-16,316-324`). Child overrides are limited to the five reviewed mutation/package variables (`scripts/phase-09-secure-environment.mjs:18-24,366-380`); ambient `NODE_OPTIONS` is rejected and never composed. |
| Owned empty tool configuration | PASS | A unique child tree contains isolated HOME/USERPROFILE, XDG, temp, npm cache, GitHub CLI config, and GnuPG home plus empty mode-0600 npm user/global and Git-global files (`scripts/phase-09-secure-environment.mjs:243-364`). Npm is fixed to `https://registry.npmjs.org/`; Git system config, credential helpers, extra headers, and prompting are disabled (`scripts/phase-09-secure-environment.mjs:325-358`). |
| Nested package descendants reconstruct the boundary | PASS | The package checker creates a new owned secure environment from its received process environment before any substantive child and removes it afterward (`scripts/phase-09-package-check.mjs:150-200,1662-1668`). All nested pnpm/npm/tar/TypeScript/Vitest commands use its single secure `runChild` path. |
| Hostile inputs fail before children | PASS | Mutation self-tests exercise mixed-case repository/npm credentials, hostile npm/pnpm/Git/GitHub CLI/temp overrides, and ambient npm config with zero callbacks (`scripts/phase-09-mutation-battery.mjs:1617-1695`). Independent real-path probing also rejected an actual `.npmrc`, mixed-case GitHub token, npm userconfig, and SSH-agent sentinel with callback count zero. |
| Sentinels cannot reach real children | PASS | Mutation and package self-tests execute real Node child probes and require absent sentinels plus exact owned paths/config (`scripts/phase-09-mutation-battery.mjs:1844-1885`; `scripts/phase-09-package-check.mjs:1519-1575`). The independent probe likewise observed no repository sentinel or hostile registry and observed the exact npmjs registry. |
| Runbook matches the executable boundary | PASS | The canonical command starts with `env -i`, the preflight/child controls are described, and the lack of OS sandboxing is explicit (`RELEASING.md:75-101,299-304`; `CONTRIBUTING.md:94-110`). |

### Platform-path assessment

- On the audited macOS host, the independent probe confirmed case-insensitive `Path` → `PATH` reconstruction, owned HOME/USERPROFILE/TMPDIR paths, mode-0700 environment directories, mode-0600 config files, and npm's effective registry value of exactly `https://registry.npmjs.org/`.
- Linux follows the same POSIX HOME/XDG/TMPDIR and permission path. The release workflow runs on Ubuntu; no platform-specific bypass was found statically.
- Windows-aware construction preserves only `PATHEXT`, `SYSTEMROOT`, `WINDIR`, and `COMSPEC`, normalizes a case-varied PATH lookup, sets both HOME and USERPROFILE, sets TEMP/TMP/TMPDIR, and selects `.cmd` tools in the package checker (`scripts/phase-09-secure-environment.mjs:6-16,316-358`; `scripts/phase-09-package-check.mjs:54-55,802,953,1080,1303`). Windows was statically inspected, not runtime-tested, and the POSIX `env -i` launch is not presented as a Windows command.

## Threat Verification

| Threat ID | Category | Disposition | Result | Executable evidence |
|---|---|---|---|---|
| `T-09-01` | Tampering — React cleanup | mitigate | CLOSED | Effect-only registration returns the exact unregister function (`packages/concierge-react/src/client.tsx:63-80`); lifecycle and compiled R1 controls remain present. |
| `T-09-02` | Tampering — stale React values | mitigate | CLOSED | Post-commit ref update and stable getter (`packages/concierge-react/src/client.tsx:53-60`), with lifecycle/R2 coverage. |
| `T-09-03` | Tampering/Spoofing — Svelte snapshot seam | mitigate | CLOSED | `$state.snapshot` is the public normalizer (`packages/concierge-svelte/src/client.svelte.ts:59-64`), with packed S1 and consent-drift coverage. |
| `T-09-04` | Information Disclosure — SSR registration/leak | mitigate | CLOSED | React and Svelte registration remain effect-only; exact Node artifact/Astro routing remains disjoint (`vitest.config.ts:103-128`) with T04/SSR1 zero-registration checks. |
| `T-09-05` | Elevation of Privilege — duplicate core/version skew | mitigate | CLOSED | Both adapters guard singleton and literal contract version immediately before registration; peer+dev topology and exact foreign-consumer graph checks remain. |
| `T-09-06` | Tampering — compiler/package transforms | mitigate | CLOSED | The React directive, Svelte compiler condition, real framework plugins, and exact independently sealed archive path remain unchanged. |
| `T-09-07` | Tampering — adapter budget/boundary | mitigate | CLOSED | Exact discovery, TypeScript comment-trivia LOC counting, AST responsibility checks, negative controls, and B1 remain intact (`scripts/phase-09-adapter-budget.mjs:395-465`). |
| `T-09-08` | Repudiation/DoS — evidence/output identity | mitigate | CLOSED | Semantic-only version artifact, apply-derived receipt, nonzero versioned authorization, run-attempt binding, clean seal, exact archives, and transactional ledgers remain intact. Version and publisher regression suites passed 23 and 20 controls respectively. |
| `T-09-SC` | Tampering — dependency supply chain | mitigate, with plan-09-10 documentation-only accept | **CLOSED** | Exact pins/locks/archives and split workflow authority remain; SEC09-B01 now adds pre-child recognized-authority rejection and a strict allowlisted environment with independently owned config for every mutation and package descendant. |

### Accepted risks log

| ID | Scope | Accepted residual | Boundary |
|---|---|---|---|
| `T-09-SC/09-10` | Documentation-only plan | Plan 09-10 installed no package and accepted no new dependency-install surface in that task. | This bounded acceptance does not waive phase-wide supply-chain controls. |
| `AR-09-ENV-NAMES` | Parent-process preflight | A denylist cannot classify arbitrary user-chosen secret variable names. The independent boundary probe confirmed that custom aliases such as `GITHUB_PAT` are not guaranteed to trigger preflight. | The canonical `env -i` command removes them before Node starts, and the child allowlist drops every nonallowlisted name even if one reaches the trusted parent process. No arbitrary alias reached a child probe. |
| `AR-09-HOST` | Finalization children | Environment/config isolation is not an OS network or filesystem sandbox. Dependency code retains the operator's filesystem permissions and may make arbitrary network calls; fixed npm config constrains package-manager acquisition, not all child networking. | `RELEASING.md:97-101` requires a reviewed ephemeral/restricted host or prewarmed offline cache when stronger isolation is required. Inherited PATH/toolchain binaries remain an operator trust boundary. |
| `AR-09-DSSE` | Existing-version resume provenance | The publisher strictly decodes and semantically binds the DSSE subject/source, but does not locally verify the signature or transparency log (`scripts/phase-09-publish-archives.mjs:455-569`). | Trust remains with npm trusted-publisher ingestion/TLS plus the mandatory human npmjs attestation check (`RELEASING.md:314-335`). This report makes no cryptographic-verification claim. |

## Prior Review Regression Coverage

| Review | Controls rechecked | Result |
|---|---|---|
| Iteration 1 | Exact checked/published tarballs; evidence ordering; OIDC isolation; live Svelte getters; locked offline consumer; AST/LOC gate; exact positive test counts | CLOSED — no regression |
| Iteration 2 | No package-directory publish; no dependency battery in write-authorized apply; feature/`0.0.0` evidence non-authorizing; independent clean seal; ordered safe-resume behavior | CLOSED — no regression |
| Iteration 3 | Run-attempt identity; semantic-only privileged artifact and apply-derived receipt; exact npmjs/config boundary; source-bound provenance resume | CLOSED — no regression |

Workflow default permissions remain empty; only the checkout-free/install-free publisher has `id-token: write` (`.github/workflows/release.yml:11-18,631-649`). Publisher environment rejection, owned npm configs, exact registry, and ambiguous-result failure remain at `scripts/phase-09-publish-archives.mjs:722-857`.

## Requirement Coverage

| Requirement | Security-relevant coverage | Result |
|---|---|---|
| `ADP-01` | React scope, post-commit values, effect registration, exact StrictMode cleanup, R1/R2 | COVERED |
| `ADP-02` | Svelte getter inputs inside `$effect`, exact cleanup, real `$state.snapshot`, S1 | COVERED |
| `ADP-03` | Independent 150-line inventories, lexical/AST gate, B1 | COVERED |
| `ADP-04` | Disjoint server project, fresh Astro SSR, absent DOM globals and zero registration, SSR1 | COVERED |
| `PKG-04` | ESM exports, core peer+dev topology, one physical core, P1/C1 | COVERED |

## Safe Verification Executed

| Check | Result |
|---|---|
| Syntax: secure-environment, mutation battery, package checker, contract checker | PASS |
| `node scripts/phase-09-mutation-battery.mjs self-test` | PASS — 29 controls, including both preflight-before-child controls and a real secure-child probe |
| `node scripts/phase-09-package-check.mjs self-test` | PASS — 9 controls, including nested environment reconstruction and real child probe |
| Contract checker self-test and `final` | PASS — adversarial checker controls; 0 missing IDs across 56 required nonempty artifacts |
| `node scripts/phase-09-version.mjs self-test` | PASS — 23 controls |
| `node scripts/phase-09-publish-archives.mjs self-test` | PASS — 20 controls |
| Workflow checker | PASS — 2 workflows, 7 jobs, 16 controls, 19 CI steps, 40 release steps |
| Exact Phase 09 test checker | PASS — 3 projects, 5 files, 10 suites, 11 tests; 3 checker negative controls |
| Independent actual-path preflight probe | PASS — real hostile `.npmrc` plus mixed-case GitHub/npm/SSH sentinels all rejected; callback count 0 |
| Independent actual-child/config probe | PASS — sentinel absent; hostile registry absent; npm effective registry exact; PATH casing normalized; HOME/config/temp owned; files empty; observed POSIX modes 0700/0600 |
| Child-process inventory | PASS — all six mutation spawn sites and the package gateway explicitly supply `childEnvironment`; no ambient environment spread/inheritance assignment found |
| Protected release state | PASS — sealed `09-SECURITY.md`, mutation evidence, release evidence, and validation ledger had no diff; only the pre-existing `.planning/config.json` modification and `examples/adapter-ssr/.astro/` untracked directory were present before this report update |

No production `prepare`, `apply`, `finalize versioned`, mutation `run all`, release battery, Changesets version, live publish, npm publication, or evidence regeneration command was executed.

## Threat Flags and Release State

The thirteen Phase 09 summaries contain no formal `## Threat Flags` entries. Current implementation surfaces map to the registered threats above. **Unregistered flags: none.**

The root and public package versions remain `0.0.0`, the intended changeset remains pending, and the sealed feature-era ledgers were not regenerated. Publication therefore remains fail-closed until the separately reviewed receipt-backed versioned ceremony is deliberately authorized and completed.

`SECURITY.md`: `.planning/phases/09-react-and-svelte-adapters/09-SECURITY-AUDIT.md`
