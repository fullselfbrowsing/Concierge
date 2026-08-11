---
phase: 09-react-and-svelte-adapters
phase_number: 9
phase_name: React and Svelte adapters
audited_at: 2026-08-11T12:14:40Z
revision: 0c68c49307ed6c4b950930456141f55da3bf0295
remediation_commits:
  - b48fea4258ef12f882c7f927b5c28e6d427d211c
  - f29d0a236e0868c707eb1e37f8be4b2c05bab856
ceremony_store_fix_commits:
  - 0bf6254bc4142b15553816902fbd6ce05e673910
  - d1d230cad34b9b4b9d6e0cf313deb7c4714ec715
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

**Revision:** `0c68c49307ed6c4b950930456141f55da3bf0295`

**Threats Closed:** 9/9

**ASVS Level:** 1

**Verdict:** **PASS**

The focused re-audit confirms that commits `b48fea4` and `f29d0a2` remediate `SEC09-B01`, and that commits `0bf6254` and `d1d230c` safely make that boundary functional with a fresh pnpm store. The versioned finalizer now prewarms its owned store from each frozen snapshot before the corresponding offline install, without using ambient store state or adding acquisition-time lifecycle execution. No High or open declared threat remains.

This verdict verifies the implementation controls; it does not authorize a live publish or the still-pending versioned-finalization ceremony. The current `.planning/config.json` does not declare `asvs_level` or `block_on`, so this report retains the conservative project baseline of ASVS Level 1 with High findings blocking.

## SEC09-B01 Remediation Disposition

### CLOSED — credential-free versioned finalization is executable, not merely documented

| Required property | Result | Code evidence |
|---|---|---|
| Preflight precedes all authority-ceremony work | PASS | `main()` wraps the complete versioned `execute` closure in `runAfterCredentialFreeFinalizationPreflight` (`scripts/phase-09-mutation-battery.mjs:2874-2904`). Only that closure calls `withOwnedChildEnvironment`, which creates the owned temporary root, and then `withMutationLock` (`scripts/phase-09-mutation-battery.mjs:2886-2901`). The preflight invokes its operation only after all environment and path checks complete (`scripts/phase-09-secure-environment.mjs:183-240`). Fetch therefore cannot precede credential/config preflight. |
| Case-insensitive recognized authority/config rejection | PASS | Environment names are de-duplicated and normalized case-insensitively (`scripts/phase-09-secure-environment.mjs:121-152`); repository/npm/CI tokens, tool prefixes, proxy/trust/preload/temp overrides, and dynamic-loader controls are rejected (`scripts/phase-09-secure-environment.mjs:26-61,154-170`). HOME, USERPROFILE, XDG, and known repository config/credential paths are checked before execution (`scripts/phase-09-secure-environment.mjs:63-99,173-231`). |
| No ambient environment inheritance in finalization children | PASS | Mutation `git`, generic command, copy, tar, and historical Git reads all receive `childEnvironment()` (`scripts/phase-09-mutation-battery.mjs:516-527,984-1004,1087-1100,2266-2272,2430-2438`). The package checker has one child gateway and always supplies the secure environment (`scripts/phase-09-package-check.mjs:207-237`). Static inspection found no `...process.env`, `env: process.env`, or equivalent child assignment in either execution tree. |
| Small inherited allowlist | PASS | Only PATH/PATHEXT, Windows runtime paths, locale, and timezone may cross from the parent (`scripts/phase-09-secure-environment.mjs:6-16,316-324`). Child overrides are limited to the five reviewed mutation/package variables (`scripts/phase-09-secure-environment.mjs:18-24,366-380`); ambient `NODE_OPTIONS` is rejected and never composed. |
| Owned empty tool configuration | PASS | A unique child tree contains isolated HOME/USERPROFILE, XDG, temp, npm cache, private pnpm store, GitHub CLI config, and GnuPG home plus empty mode-0600 npm user/global and Git-global files (`scripts/phase-09-secure-environment.mjs:243-367`). Npm is fixed to `https://registry.npmjs.org/`; Git system config, credential helpers, extra headers, and prompting are disabled (`scripts/phase-09-secure-environment.mjs:327-361`). |
| Nested package descendants reconstruct the boundary | PASS | The package checker creates a new owned secure environment from its received process environment before any substantive child and removes it afterward (`scripts/phase-09-package-check.mjs:150-200,1662-1668`). All nested pnpm/npm/tar/TypeScript/Vitest commands use its single secure `runChild` path. |
| Hostile inputs fail before children | PASS | Mutation self-tests exercise mixed-case repository/npm credentials, hostile npm/pnpm/Git/GitHub CLI/temp overrides, and ambient npm config with zero callbacks (`scripts/phase-09-mutation-battery.mjs:1651-1729`). Independent real-path probing also rejected an actual `.npmrc`, mixed-case GitHub token, npm userconfig, and SSH-agent sentinel with callback count zero. |
| Sentinels cannot reach real children | PASS | Mutation and package self-tests execute real Node child probes and require absent sentinels plus exact owned paths/config/store (`scripts/phase-09-mutation-battery.mjs:1963-2007`; `scripts/phase-09-package-check.mjs:1519-1578`). The independent probe likewise observed no repository sentinel or hostile registry and observed the exact npmjs registry and owned pnpm store. |
| Runbook matches the executable boundary | PASS | The canonical command starts with `env -i`, the preflight/child/store controls are described, and the lack of OS sandboxing is explicit (`RELEASING.md:75-109,307-312`; `CONTRIBUTING.md:94-114`). |

## Ceremony Store Re-audit

The earlier credential-free ceremony failure was availability-safe: the empty isolated store caused the inherited Phase 8 offline install to fail before any ledger write. The new prewarm restores reproducibility without reopening ambient credential or package-store authority.

| Store/fetch property | Result | Verification evidence |
|---|---|---|
| Owned, private, outside-repository store | PASS | `createSecureChildEnvironment` creates `pnpm-store` inside its unique child root using the same private-directory constructor as HOME/temp (`scripts/phase-09-secure-environment.mjs:281-309`) and exports its absolute path as `PNPM_CONFIG_STORE_DIR` (`scripts/phase-09-secure-environment.mjs:327-361`). Before use, the helper requires the exact basename, the same secure parent as HOME, an existing real directory, and a realpath outside the repository (`scripts/phase-09-mutation-battery.mjs:1058-1075`). |
| No ambient or child redirection | PASS | Ambient names beginning `pnpm_` are rejected case-insensitively before versioned execution; `PNPM_CONFIG_STORE_DIR` is not one of the five allowed child overrides (`scripts/phase-09-secure-environment.mjs:18-24,154-170,369-382`). The mutation negative control rejects an exact store override (`scripts/phase-09-mutation-battery.mjs:1924-1929`). An independent hostile ambient/project-config probe confirmed pnpm's effective store remained the owned path. |
| Exact fetch then exact offline install | PASS | Immutable argument arrays are exactly `fetch --frozen-lockfile --ignore-scripts` and `install --offline --frozen-lockfile` (`scripts/phase-09-mutation-battery.mjs:355-364`). The helper awaits and validates fetch before invoking install (`scripts/phase-09-mutation-battery.mjs:1058-1085`). Its only production call sites are the Phase 09 baseline (`scripts/phase-09-mutation-battery.mjs:1107-1127`) and inherited Phase 8 snapshot (`scripts/phase-09-mutation-battery.mjs:2459-2485`). No other pnpm fetch/install call exists in the battery. |
| Fail closed before install/evidence | PASS | `assertSuccessfulCommand` rejects spawn error, timeout, output overflow, signal, or nonzero exit before the next statement (`scripts/phase-09-mutation-battery.mjs:1047-1056`). Synthetic controls inject all four fetch-failure classes and require exactly one runner call, proving install suppression (`scripts/phase-09-mutation-battery.mjs:1900-1922`). Both prewarms precede mutation/release evidence construction and the sole transactional ledger installation at the end of `runAll`. |
| Exact registry and credential-free fetch | PASS | Fetch uses `runCommand`, whose child receives only `childEnvironment()` (`scripts/phase-09-mutation-battery.mjs:984-1004,1076-1084`). The secure environment fixes npmjs, empty npm configs, isolated HOME/XDG/temp, no proxy/trust/preload variables, and no tokens. Live pnpm probes require the owned store and exact registry (`scripts/phase-09-mutation-battery.mjs:1931-1961`). Current and immutable Phase 8 snapshots contain no root/project npm/pnpm config file and neither frozen lock contains an explicit HTTP, Git, or tarball resolution that could bypass registry selection. |
| No acquisition-time lifecycle execution | PASS | Fetch includes `--ignore-scripts`; the exact combination is accepted by the pinned pnpm CLI. The following offline install retains the pre-existing install policy and may run only its already-reviewed lifecycle policy (for example the committed `allowBuilds` entry); this audit does not claim the full install/build/test battery is script-free. |
| No ambient store reuse | PASS | The store starts empty inside the current ceremony's owned root. Both snapshots use that owned store, never a user/global pnpm store. A real probe supplied a hostile ambient store and hostile project store configuration; pnpm still reported the owned path. |
| Deterministic cleanup | PASS | `withOwnedChildEnvironment` removes the entire marked owned root in `finally`, including fetch/install failure paths (`scripts/phase-09-mutation-battery.mjs:910-950`). The independent probe confirmed the store/root no longer existed after cleanup. Same-user hostile code can attempt to sabotage host files or cleanup only within the documented lack of an OS filesystem sandbox. |
| Documentation accuracy | PASS | The runbook states the empty-store reason, both exact commands, exact npmjs network access, failure behavior, lack of acquisition scripts, and absence of OS network/filesystem sandboxing (`RELEASING.md:97-109,356-365`; `CONTRIBUTING.md:105-114`). |

### Platform-path assessment

- On the audited macOS host, independent probes confirmed case-insensitive `Path` → `PATH` reconstruction, owned HOME/USERPROFILE/TMPDIR/store paths, mode-0700 environment/store directories, mode-0600 config files, pnpm's effective store path, and the exact `https://registry.npmjs.org/` registry.
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
| `T-09-SC` | Tampering — dependency supply chain | mitigate, with plan-09-10 documentation-only accept | **CLOSED** | Exact pins/locks/archives and split workflow authority remain; SEC09-B01 supplies pre-child authority rejection and strict allowlisted descendant environments. The ceremony now uses only its owned store, fetching the frozen graph with scripts disabled before each offline install; exact order, failure suppression, registry, and non-redirection are enforced. |

### Accepted risks log

| ID | Scope | Accepted residual | Boundary |
|---|---|---|---|
| `T-09-SC/09-10` | Documentation-only plan | Plan 09-10 installed no package and accepted no new dependency-install surface in that task. | This bounded acceptance does not waive phase-wide supply-chain controls. |
| `AR-09-ENV-NAMES` | Parent-process preflight | A denylist cannot classify arbitrary user-chosen secret variable names. The independent boundary probe confirmed that custom aliases such as `GITHUB_PAT` are not guaranteed to trigger preflight. | The canonical `env -i` command removes them before Node starts, and the child allowlist drops every nonallowlisted name even if one reaches the trusted parent process. No arbitrary alias reached a child probe. |
| `AR-09-HOST` | Finalization children | Environment/config/store isolation is not an OS network or filesystem sandbox. Frozen fetch intentionally reaches npmjs, and code executed by the later install/build/test battery retains the operator's filesystem permissions and may make arbitrary network calls. The fetch itself uses `--ignore-scripts`; this is not a claim that later approved install/build lifecycle code is absent. | `RELEASING.md:97-109` requires a reviewed ephemeral/restricted host or prewarmed offline cache when stronger isolation is required. Inherited PATH/toolchain binaries, DNS/TLS, npmjs availability, and same-user cleanup sabotage remain host trust boundaries. |
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
| `node scripts/phase-09-mutation-battery.mjs self-test` | PASS — 33 controls, including preflight-before-child, exact fetch/install order, four fetch-failure classes suppressing install, store-redirect rejection, effective store/registry, and real child probes |
| `node scripts/phase-09-package-check.mjs self-test` | PASS — 9 controls, including nested environment/store reconstruction and real child probe |
| Contract checker self-test and `final` | PASS — adversarial checker controls; 0 missing IDs across 56 required nonempty artifacts |
| `node scripts/phase-09-version.mjs self-test` | PASS — 23 controls |
| `node scripts/phase-09-publish-archives.mjs self-test` | PASS — 20 controls |
| Workflow checker | PASS — 2 workflows, 7 jobs, 16 controls, 19 CI steps, 40 release steps |
| Exact Phase 09 test checker | PASS — 3 projects, 5 files, 10 suites, 11 tests; 3 checker negative controls |
| Independent actual-path preflight probe | PASS — real hostile `.npmrc` plus mixed-case GitHub/npm/SSH sentinels all rejected; callback count 0 |
| Exact pnpm fetch flag parser probe | PASS — `pnpm fetch --frozen-lockfile --ignore-scripts --help` accepted the exact combination without fetching |
| Independent actual-child/config probe | PASS — sentinels absent; pnpm effective owned store and npmjs registry exact; PATH casing normalized; HOME/config/temp/store owned; files empty; observed POSIX modes 0700/0600 |
| Independent store redirection/cleanup probe | PASS — mixed-case ambient store rejected, child override rejected, hostile ambient and project store settings ineffective, owned store outside repository and mode 0700, root absent after cleanup |
| Frozen-input destination scan | PASS — current and immutable Phase 8 snapshots contain no npm/pnpm project config and neither lockfile contains explicit HTTP, Git, GitHub, or tarball resolution |
| Child-process inventory | PASS — all six mutation spawn sites and the package gateway explicitly supply `childEnvironment`; no ambient environment spread/inheritance assignment found |
| Protected release state | PASS — sealed `09-SECURITY.md`, mutation evidence, release evidence, and validation ledger had no diff and retained SHA-256 values `ee0fa751…`, `cf4a003b…`, `d27a444a…`, and `55813181…`; only the pre-existing `.planning/config.json` modification and `examples/adapter-ssr/.astro/` untracked directory were present before this report update |

No production `prepare`, `apply`, `finalize versioned`, mutation `run all`, release battery, Changesets version, live publish, npm publication, or evidence regeneration command was executed.

## Threat Flags and Release State

The thirteen Phase 09 summaries contain no formal `## Threat Flags` entries. Current implementation surfaces map to the registered threats above. **Unregistered flags: none.**

The root and public package versions remain `0.0.0`, the intended changeset remains pending, and the sealed feature-era ledgers were not regenerated. Publication therefore remains fail-closed until the separately reviewed receipt-backed versioned ceremony is deliberately authorized and completed.

`SECURITY.md`: `.planning/phases/09-react-and-svelte-adapters/09-SECURITY-AUDIT.md`
