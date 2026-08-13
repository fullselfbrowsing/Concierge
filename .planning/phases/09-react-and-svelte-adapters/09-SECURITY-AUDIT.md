---
phase: 09-react-and-svelte-adapters
phase_number: 9
phase_name: React and Svelte adapters
audited_at: 2026-08-11T13:26:03Z
revision: 006df275d54257c45225b9782e9134ecef5adbfe
remediation_commits:
  - b48fea4258ef12f882c7f927b5c28e6d427d211c
  - f29d0a236e0868c707eb1e37f8be4b2c05bab856
ceremony_store_fix_commits:
  - 0bf6254bc4142b15553816902fbd6ce05e673910
  - d1d230cad34b9b4b9d6e0cf313deb7c4714ec715
nested_policy_fix_commits:
  - ee470570e16de42690c7b093f1bd263b68110398
  - d62c6f9e062c2b289e4e5e101b62d7244c97651a
ceremony_report_commit: fc27969de2e4aabfe6bbc30e62ed584b9d550268
release_aware_version_fix_commit: d267ad2ccf47ebe8aab1ae7350e0bc11f13fdc6f
ceremony_fix_3_report_commit: fc7c89f6d36d8652afa1d86520e8701ec0322b75
receipt_ancestry_fix_commit: cee13c08b1a2cfce0f41171302385d2a5fd1f27d
ceremony_fix_4_report_commit: 006df275d54257c45225b9782e9134ecef5adbfe
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

**Revision:** `006df275d54257c45225b9782e9134ecef5adbfe`

**Threats Closed:** 9/9

**ASVS Level:** 1

**Verdict:** **PASS**

The focused re-audit confirms that commits `b48fea4` and `f29d0a2` remediate `SEC09-B01`, commits `0bf6254` and `d1d230c` safely make that boundary functional with a fresh pnpm store, commits `ee47057` and `d62c6f9` close the nested package-check policy gap, commit `d267ad2` makes the versioner's security self-test independent of the live `0.0.0`/`0.1.0` release state, and commit `cee13c0` preserves receipt ancestry in the versioned disposable snapshot without changing its measured release-input tree. Commit `006df27` records that fourth ceremony failure and remediation. The history binding is versioned-only, uses the exact local source HEAD under the credential-free child environment, performs no checkout, configures no remote, and atomically replaces only the disposable snapshot HEAD. The receipt reader now resolves both ancestry and consumed changeset bytes against its passed repository root. No High or open declared threat remains.

This verdict verifies the implementation controls; it does not authorize a live publish or the still-pending versioned-finalization ceremony. The current `.planning/config.json` does not declare `asvs_level` or `block_on`, so this report retains the conservative project baseline of ASVS Level 1 with High findings blocking.

## SEC09-B01 Remediation Disposition

### CLOSED — credential-free versioned finalization is executable, not merely documented

| Required property | Result | Code evidence |
|---|---|---|
| Preflight precedes all authority-ceremony work | PASS | `main()` wraps the complete versioned `execute` closure in `runAfterCredentialFreeFinalizationPreflight` (`scripts/phase-09-mutation-battery.mjs:2874-2904`). Only that closure calls `withOwnedChildEnvironment`, which creates the owned temporary root, and then `withMutationLock` (`scripts/phase-09-mutation-battery.mjs:2886-2901`). The preflight invokes its operation only after all environment and path checks complete (`scripts/phase-09-secure-environment.mjs:183-240`). Fetch therefore cannot precede credential/config preflight. |
| Case-insensitive recognized authority/config rejection | PASS | Environment names are de-duplicated and normalized case-insensitively (`scripts/phase-09-secure-environment.mjs:121-152`); repository/npm/CI tokens, tool prefixes, proxy/trust/preload/temp overrides, and dynamic-loader controls are rejected (`scripts/phase-09-secure-environment.mjs:26-61,154-170`). HOME, USERPROFILE, XDG, and known repository config/credential paths are checked before execution (`scripts/phase-09-secure-environment.mjs:63-99,173-231`). |
| No ambient environment inheritance in finalization children | PASS | Mutation `git`, generic command, copy, tar, and historical Git reads all receive `childEnvironment()` (`scripts/phase-09-mutation-battery.mjs:516-527,984-1004,1087-1100,2266-2272,2430-2438`). The package checker has one child gateway and always supplies the secure environment (`scripts/phase-09-package-check.mjs:279-321`). Static inspection found no `...process.env`, `env: process.env`, or equivalent child assignment in either execution tree. |
| Small inherited allowlist | PASS | Only PATH/PATHEXT, Windows runtime paths, locale, and timezone may cross from the parent (`scripts/phase-09-secure-environment.mjs:6-16,316-324`). Child overrides are limited to the five reviewed mutation/package variables (`scripts/phase-09-secure-environment.mjs:18-24,366-380`); ambient `NODE_OPTIONS` is rejected and never composed. |
| Owned empty tool configuration | PASS | A unique child tree contains isolated HOME/USERPROFILE, XDG, temp, npm cache, private pnpm store, GitHub CLI config, and GnuPG home plus empty mode-0600 npm user/global and Git-global files (`scripts/phase-09-secure-environment.mjs:243-367`). Npm is fixed to `https://registry.npmjs.org/`; Git system config, credential helpers, extra headers, and prompting are disabled (`scripts/phase-09-secure-environment.mjs:327-361`). |
| Nested package descendants reconstruct the boundary | PASS | The package checker creates a new owned secure environment from its received process environment before any substantive child and removes it afterward (`scripts/phase-09-package-check.mjs:180-205,1946-1952`). All nested pnpm/npm/tar/TypeScript/Vitest commands use its single secure `runChild` path. |
| Hostile inputs fail before children | PASS | Mutation self-tests exercise mixed-case repository/npm credentials, hostile npm/pnpm/Git/GitHub CLI/temp overrides, and ambient npm config with zero callbacks (`scripts/phase-09-mutation-battery.mjs:1651-1729`). Independent real-path probing also rejected an actual `.npmrc`, mixed-case GitHub token, npm userconfig, and SSH-agent sentinel with callback count zero. |
| Sentinels cannot reach real children | PASS | Mutation and package self-tests execute real Node child probes and require absent sentinels plus exact owned paths/config/store (`scripts/phase-09-mutation-battery.mjs:1963-2007`; `scripts/phase-09-package-check.mjs:1698-1817`). The authenticated package probe additionally requires that only the fixed pnpm policy crosses. The independent probe likewise observed no repository sentinel or hostile registry and observed the exact npmjs registry and owned pnpm store. |
| Runbook matches the executable boundary | PASS | The canonical command starts with `env -i`; the preflight, child, store, and mutation-only nested policy controls are described; normal gates retain the default; and the lack of OS sandboxing is explicit (`RELEASING.md:75-121,319-324`; `CONTRIBUTING.md:94-119`). |

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
| Documentation accuracy | PASS | The runbook states the empty-store reason, both exact commands, exact npmjs network access, failure behavior, lack of acquisition scripts, and absence of OS network/filesystem sandboxing (`RELEASING.md:97-121`; `CONTRIBUTING.md:105-119`). |

## Authenticated Nested pnpm Policy Re-audit

The second disposable versioned-finalization retry remained fail-closed: its owned-store prewarm and the first five mutants succeeded, but M-09-P1 stopped on `ERR_PNPM_OUTDATED_LOCKFILE` before the registered semantic fingerprint and before any ledger write. The remediation preserves the mutation runner's already-reviewed policy across the package checker's independently reconstructed environment. The protocol marker is an internal call-graph control, not cryptographic caller authentication; in the reviewed finalization path the parent preflight rejects ambient pnpm variables before the runner creates either fixed value.

| Nested-policy property | Result | Verification evidence |
|---|---|---|
| Sole production producer and bounded uses | PASS | The mutation runner defines one frozen `MUTANT_EXECUTION_ENV` containing only `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: "false"` (`scripts/phase-09-mutation-battery.mjs:315-317`). It supplies that object only to disposable mutant compile and killer children (`scripts/phase-09-mutation-battery.mjs:1245-1275,1324-1335`); the package checker is the only production consumer that interprets the policy. Repository-wide inspection found no workflow or normal-gate producer. Shared-environment and contract occurrences are transport allowlisting or static assertions, while package/mutation self-test occurrences are negative and real-child probes. |
| Exact marker and exact value | PASS | The package constructor resolves the policy and marker case-insensitively while rejecting duplicate case variants, then requires marker value exactly `1` and policy value exactly lowercase `false`; it constructs a new canonical one-field override instead of copying caller entries (`scripts/phase-09-package-check.mjs:222-277`). Missing marker, wrong marker, missing authentication, `true`, `False`, duplicate policy casing, and duplicate marker casing all failed closed with `CHILD_ENVIRONMENT` in focused runtime probes. |
| Normal gates retain the default | PASS | When the policy is absent, the constructor returns an empty override before rebuilding the child environment (`scripts/phase-09-package-check.mjs:243-277`). The normal nested real-child probe requires the policy to remain absent (`scripts/phase-09-package-check.mjs:1698-1768`), and the ordinary release package gate supplies only its archive export override (`scripts/phase-09-mutation-battery.mjs:2653-2661`). Normal, secure-marker-only, and authenticated entrypoint self-tests each passed 14 controls; the normal fixture required omission while the authenticated child fixture required `false`. |
| No ambient authority crosses with the exception | PASS | The shared constructor still inherits only the small platform allowlist and constructs fixed owned HOME, config, temp, registry, cache, and store values (`scripts/phase-09-secure-environment.mjs:6-24,318-366`). The package layer derives only the canonical pnpm exception before merging it (`scripts/phase-09-package-check.mjs:243-277`). A real authenticated child probe required the fixed policy and owned store while requiring absent repository/npm tokens, caller npm config, caller store redirect, `NODE_OPTIONS`, mutation capture path, and sentinel bytes (`scripts/phase-09-package-check.mjs:1770-1817`). No arbitrary source field is spread into a child. |
| Unauthenticated, wrong, and ambiguous cases fail closed | PASS | Committed controls reject policy-without-marker, a wrong policy value, and duplicate policy casing (`scripts/phase-09-package-check.mjs:1819-1856`). Independent entrypoint probes additionally rejected marker `0`, value `False`, and duplicate case variants of both protocol names before a substantive child. The case-insensitive cardinality assertion is shared by both lookups (`scripts/phase-09-package-check.mjs:222-241`). |
| Versioned P1 reaches the semantic detector | PASS | The regression first runs a real pnpm child in the reconstructed authenticated environment and requires `verify-deps-before-run` to report `false`. It then reads M-09-P1's registered exact replacement and exact fingerprint, constructs the valid nonzero versioned adapter shape, applies the mutation once, and invokes the same `validateArchiveContents` function used by the substantive archive triplet (`scripts/phase-09-package-check.mjs:455-554,1523-1630`; `09-MUTATION-REGISTER.json:111-127`). It requires exact `ADAPTER_MANIFEST` failure text and rejects any result containing `ERR_PNPM_OUTDATED_LOCKFILE`. Both normal and externally authenticated package self-tests passed this control. This is a faithful two-seam regression, not a claim that the prohibited production finalizer ran. |
| Contracts and runbook pin the boundary | PASS | The final contract requires the consumer functions, exact two names/values, canonical override, missing-policy omission, real authenticated/normal child probes, P1 detector, producer constant, and runbook text (`scripts/phase-09-contract-check.mjs:715-830,981-1037`). The runbook accurately limits the exception to disposable mutation execution and explicitly says normal package/release gates retain pnpm's default (`RELEASING.md:105-115`; `CONTRIBUTING.md:113-119`). |

## Release-aware Version Self-test Re-audit

The third disposable versioned-finalization attempt killed all seven mutants and then failed closed before ledger installation because the workflow checker ran the version self-test from a legitimate `0.1.0` tree. The old test incorrectly used those live manifests as the base of a hard-coded `0.0.0` → `0.1.0` fixture. Commit `d267ad2` changes only that self-test fixture and one contract token; it does not change a production prepare, apply, validation, receipt, or child-execution function.

| Version-control property | Result | Verification evidence |
|---|---|---|
| Synthetic base is release-state independent | PASS | The self-test clones each live public manifest, overwrites the synthetic base version to exactly `0.0.0`, restores each adapter's reviewed bounded peer, derives a `0.1.0` output with canonical `workspace:^`, and passes those bytes to the real validator (`scripts/phase-09-version.mjs:1300-1324`). A normal run passed 23 controls on the live `0.0.0` tree. A separate read-only preload probe presented the same script with live-like `0.1.0` manifests and canonical adapter peers; all 23 controls still passed without modifying the workspace. |
| Production manifest semantics remain exact | PASS | `validateManifestTransition` still requires the exact public package identity, exact shared next version, and release-type arithmetic. For adapters it still accepts only the bounded source peer or canonical peer, requires canonical output, normalizes only that peer for comparison, and rejects every other manifest delta by stable whole-object equality (`scripts/phase-09-version.mjs:549-658`). This function is outside the fix diff. |
| Peer and lock normalization remain bounded | PASS | Source peers still require either exact `workspace:^` or the exact two-version same-major form beginning at the current core version (`scripts/phase-09-version.mjs:232-267`). Snapshot normalization requires unchanged source peers and a matching transition target, and lock normalization permits only one-for-one replacement with an occurrence bound of two (`scripts/phase-09-version.mjs:269-308,708-723`). The positive normalization and dependency-smuggling negative both passed. |
| Semantic-only operation allowlists remain closed | PASS | Writes remain limited to the six package/changelog paths plus optional `pnpm-lock.yaml`; deletes remain limited to digest-bound consumed changesets. Every operation has exact keys, unique path, verified base digest, exact action/blob digest, required path cardinality, and no unreferenced blob (`scripts/phase-09-version.mjs:63-68,725-977`). The malicious evidence-write and consumed-digest mismatch negatives passed. |
| Injection controls remain substantive | PASS | The command-injection negative now derives from the stored synthetic core base and adds `scripts.postinstall`; the unchanged full-object validator rejects it as `VERSION_ARTIFACT_SEMANTICS` (`scripts/phase-09-version.mjs:1326-1344`). Arbitrary changelog content and lock dependency smuggling also retained their exact semantic failures. |
| Artifact and receipt identity remain bound | PASS | Artifact identity still binds exact base SHA, repository, run ID, run attempt, and derived artifact name (`scripts/phase-09-version.mjs:448-470`). Artifact schema/content digest, consumed changeset digests, base bytes, operation/blob digests, nonzero shared version, and exact path sets remain enforced (`scripts/phase-09-version.mjs:746-977`). The apply-derived receipt still binds that verified artifact and current final manifest/lock digests (`scripts/phase-09-version.mjs:984-1090`). Run/attempt/missing-attempt/content-tamper controls passed. |
| Child credential boundary is unchanged | PASS | The fix does not touch `unprivilegedEnvironment` or the single subprocess gateway. Prepare/simulation children still receive that environment with repository/npm token names removed (`scripts/phase-09-version.mjs:116-150`), and the real self-test retained its synthetic `GITHUB_TOKEN` stripping control (`scripts/phase-09-version.mjs:1547-1561`). Workflow permissions remain unchanged and the workflow checker passed all 16 controls. This is a no-regression finding, not an expansion of the previously reviewed credential-boundary claim. |
| Contract pin is present and non-vacuously backed | PASS | The contract now requires `syntheticManifestBases` alongside the existing semantic, injection, binding, and credential-control tokens (`scripts/phase-09-contract-check.mjs:891-910`). Contract self-test passed and final reported 0 missing across 56 artifacts. The presence token is not accepted alone as semantic proof; direct source inspection and both live-shape runtime probes above establish the behavior. |
| Failure and release state remain fail-closed | PASS | The failed disposable version commit/receipt is not present in the shared tree, all public versions remain `0.0.0`, the changeset remains pending, and none of the four sealed Phase 09 ledgers changed. No production prepare/apply/finalize, mutation run-all, release battery, or publisher was invoked during this audit. |

## Receipt-Ancestry Snapshot Re-audit

The fourth disposable versioned-finalization attempt reached the prospective receipt verifier and failed closed because its isolated one-commit baseline did not contain the receipt base commit. It stopped before the sole transactional ledger installation. Commit `cee13c0` repairs that ancestry boundary; it does not authorize or perform a live finalization.

| History/receipt property | Result | Verification evidence |
|---|---|---|
| Exact local source revision under the credential-free child environment | PASS | The versioned entrypoint completes `runAfterCredentialFreeFinalizationPreflight` before creating the owned child environment or entering `runAll` (`scripts/phase-09-mutation-battery.mjs:2972-2989`). Every Git child, including the history import, receives only `childEnvironment()` (`scripts/phase-09-mutation-battery.mjs:516-527`). The helper reads the exact live source `HEAD`, fetches the explicit local `sourceRoot` with that full SHA and `--no-tags`, and rejects a different `FETCH_HEAD` (`scripts/phase-09-mutation-battery.mjs:984-998`). No credential/config inheritance path was added. |
| No remote, checkout, or additional worktree file | PASS | The only import command is `git fetch --no-tags --quiet <local-source-root> <exact-source-head>`; the helper contains no checkout and requires `git remote` plus porcelain status to be empty after binding (`scripts/phase-09-mutation-battery.mjs:991-1020`). The captured self-test snapshot had no remote, clean status, and exactly one tracked/worktree file, `input.txt`. Fetch necessarily adds the requested commit's reachable objects and `FETCH_HEAD` inside the disposable `.git`; those are ancestry metadata, not added release-input files or a configured remote. |
| Exact measured tree and exact live source parent | PASS | Before fetch, the helper records `HEAD^{tree}`. It creates the new commit with `git commit-tree <that-tree> -p <exact-source-head>` and then requires the installed HEAD tree to equal the recorded tree and the source HEAD to be its ancestor (`scripts/phase-09-mutation-battery.mjs:986-1016`). Independent capture found both the old snapshot and new history commit at tree `9e8a461198e2bb0f724262ae77f6497a6bc138dc`; the new commit's sole parent and `FETCH_HEAD` were the same synthetic source HEAD. |
| Atomic compare-and-swap of only disposable HEAD | PASS | `git update-ref HEAD <history-head> <snapshot-head>` supplies the previously measured old value, so a concurrent or unexpected ref change fails instead of being overwritten (`scripts/phase-09-mutation-battery.mjs:986,1010-1011`). The captured repository contained only its one `refs/heads/master` ref and no remote refs. |
| Tree, input manifest, and status remain identical | PASS | The baseline already proves its copied manifest digest, installs/builds, and reverifies the original manifest before attachment. Versioned mode attaches history and immediately runs the same exact path-set and per-file digest verification again (`scripts/phase-09-mutation-battery.mjs:1148-1172`). The helper separately proves unchanged tree identity and clean index/worktree status (`scripts/phase-09-mutation-battery.mjs:1012-1020`). The 34th self-test constructs a two-commit source and one-file snapshot and proves the exact file scope/content after attachment (`scripts/phase-09-mutation-battery.mjs:1662-1699`). |
| Receipt ancestry and consumed bytes use the passed root | PASS | `readVersionReceipt(root)` checks `merge-base --is-ancestor <baseSha> HEAD` in `root` and now calls `gitShowBuffer(baseSha, path, root)` for every consumed changeset before accepting its digest/deletion (`scripts/phase-09-mutation-battery.mjs:768-830`). The self-test proves the base is an ancestor of the attached snapshot and the base's consumed changeset bytes equal the saved bytes when read from that snapshot root (`scripts/phase-09-mutation-battery.mjs:1674-1694`). |
| Feature mode cannot attach source history | PASS | `run all` parses with `versioned: false`, while only `finalize versioned` parses with `versioned: true` (`scripts/phase-09-mutation-battery.mjs:462-497`). `runAll` is the sole production caller that passes `preserveHistory: versioned`, and `materializeBaseline` defaults the option to false and calls the helper only inside that guard (`scripts/phase-09-mutation-battery.mjs:1148-1171,2858-2867`). Repository-wide inspection found no other production attachment call. |
| Live worktree and shared refs are not mutation targets | PASS | The production snapshot is `baseline`, a child of the marker-validated owned temporary root outside the live repository (`scripts/phase-09-mutation-battery.mjs:910-960,1148-1156,2858-2867`). The source repository is used only for `rev-parse` and as the local fetch source; fetch, `commit-tree`, and `update-ref` all run with the snapshot as `cwd` (`scripts/phase-09-mutation-battery.mjs:984-1011`). Audit completion retained shared HEAD `006df275…`; only the pre-existing protected config/Astro dirt and this report were present. |
| Contract and operator text match the executable control | PASS | The contract pins the self-test name, helper, `commit-tree`, and `update-ref` tokens (`scripts/phase-09-contract-check.mjs:998`), but those tokens were not accepted alone: the source and runtime fixture above establish the behavior. `RELEASING.md:105-110` and `CONTRIBUTING.md:113-117` accurately limit the history import to versioned/receipt-authorized execution, state the exact-parent/unchanged-tree behavior, and make no checkout/remote claim beyond what the code proves. |
| Failure and release state remain fail-closed | PASS | `09-CEREMONY-FIX-4.md:13-23` records that the attempt stopped during prospective receipt verification after mutants/release gates but before ledger installation, and invalidates the disposable version commit and receipt. Independent hashes confirm all four sealed ledgers remain unchanged. No production prepare/apply/finalize, mutation run-all, publisher, or ledger-regeneration command ran during this audit. |

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
| `T-09-08` | Repudiation/DoS — evidence/output identity | mitigate | CLOSED | Semantic-only version artifact, apply-derived receipt, nonzero versioned authorization, run-attempt binding, clean seal, exact archives, and transactional ledgers remain intact. Versioned baselines now attach the exact local source HEAD as the sole parent of a new commit over the already-measured snapshot tree, using an old-value-guarded `update-ref`; unchanged tree/status/input-manifest checks follow. `readVersionReceipt(root)` proves base ancestry and consumed changeset bytes in that same passed root. Feature mode never attaches history. The 34-control mutation self-test and independent captured-fixture inspection substantiate the boundary. |
| `T-09-SC` | Tampering — dependency supply chain | mitigate, with plan-09-10 documentation-only accept | **CLOSED** | Exact pins/locks/archives and split workflow authority remain; SEC09-B01 supplies pre-child authority rejection and strict allowlisted descendant environments. The ceremony uses only its owned store, fetching the frozen graph with scripts disabled before each offline install; exact order, failure suppression, registry, and non-redirection are enforced. The receipt-ancestry import is an exact-SHA local fetch under the same child environment, uses `--no-tags`, configures no remote, and does not check out source-history files. The package checker preserves only the runner's exact mutation policy under the fixed parent marker, rejects malformed/ambiguous variants, and otherwise leaves pnpm dependency verification at its default. |

### Accepted risks log

| ID | Scope | Accepted residual | Boundary |
|---|---|---|---|
| `T-09-SC/09-10` | Documentation-only plan | Plan 09-10 installed no package and accepted no new dependency-install surface in that task. | This bounded acceptance does not waive phase-wide supply-chain controls. |
| `AR-09-ENV-NAMES` | Parent-process preflight | A denylist cannot classify arbitrary user-chosen secret variable names. The independent boundary probe confirmed that custom aliases such as `GITHUB_PAT` are not guaranteed to trigger preflight. | The canonical `env -i` command removes them before Node starts, and the child allowlist drops every nonallowlisted name even if one reaches the trusted parent process. No arbitrary alias reached a child probe. |
| `AR-09-HOST` | Finalization children | Environment/config/store isolation is not an OS network or filesystem sandbox. Frozen fetch intentionally reaches npmjs, and code executed by the later install/build/test battery retains the operator's filesystem permissions and may make arbitrary network calls. The fetch itself uses `--ignore-scripts`; this is not a claim that later approved install/build lifecycle code is absent. | `RELEASING.md:117-121` requires a reviewed ephemeral/restricted host or prewarmed offline cache when stronger isolation is required. Inherited PATH/toolchain binaries, DNS/TLS, npmjs availability, and same-user cleanup sabotage remain host trust boundaries. |
| `AR-09-DSSE` | Existing-version resume provenance | The publisher strictly decodes and semantically binds the DSSE subject/source, but does not locally verify the signature or transparency log (`scripts/phase-09-publish-archives.mjs:455-569`). | Trust remains with npm trusted-publisher ingestion/TLS plus the mandatory human npmjs attestation check (`RELEASING.md:330-351`). This report makes no cryptographic-verification claim. |

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
| Syntax: secure-environment, mutation battery, package checker, versioner, contract checker | PASS — current delta explicitly rechecked mutation battery and contract checker |
| `node scripts/phase-09-mutation-battery.mjs self-test` | PASS — 34 controls, including `history-backed-version-receipt-snapshot`, preflight-before-child, exact fetch/install order, fetch-failure suppression, store non-redirection, and real child probes |
| Independent disposable history-fixture capture | PASS — old and new snapshot trees were identical; the new commit's sole parent and `FETCH_HEAD` equaled the exact source HEAD; only one local branch ref existed; remote/status were empty; the worktree contained only `input.txt`. The capture root was moved to Trash after inspection. |
| Package checker self-test: normal entrypoint | PASS — 14 controls, including normal-policy omission, authenticated one-field propagation, real child isolation, negative protocol cases, and exact versioned P1 semantic failure |
| Package checker self-test: `env -i` with secure marker only | PASS — 14 controls; normal nested policy remained omitted |
| Package checker self-test: `env -i` with exact marker plus `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` | PASS — 14 controls; the authenticated entrypoint and real pnpm child retained `false` |
| Independent package-policy negative entrypoints | PASS — missing/wrong marker, `true`, `False`, duplicate-case policy names, and duplicate-case marker names each exited 1 with `CHILD_ENVIRONMENT` before substantive work |
| Contract checker self-test and `final` | PASS — adversarial checker controls; 0 missing IDs across 56 required nonempty artifacts |
| `node scripts/phase-09-version.mjs self-test` on the live `0.0.0` tree | PASS — 23 controls, including semantic manifest transition, command injection, exact lock normalization, dependency smuggling, semantic write allowlist, run/attempt/content binding, and token stripping |
| Version self-test with read-only live-like `0.1.0` manifest preload | PASS — the same 23 controls passed with canonical adapter peers; no repository file changed |
| `node scripts/phase-09-publish-archives.mjs self-test` | PASS — 20 controls |
| Workflow checker | PASS — 2 workflows, 7 jobs, 16 controls, 19 CI steps, 40 release steps |
| Exact Phase 09 test checker | PASS — 3 projects, 5 files, 10 suites, 11 tests; 3 checker negative controls |
| Independent actual-path preflight probe | PASS — real hostile `.npmrc` plus mixed-case GitHub/npm/SSH sentinels all rejected; callback count 0 |
| Exact pnpm fetch flag parser probe | PASS — `pnpm fetch --frozen-lockfile --ignore-scripts --help` accepted the exact combination without fetching |
| Independent actual-child/config probe | PASS — sentinels absent; pnpm effective owned store and npmjs registry exact; PATH casing normalized; HOME/config/temp/store owned; files empty; observed POSIX modes 0700/0600 |
| Independent store redirection/cleanup probe | PASS — mixed-case ambient store rejected, child override rejected, hostile ambient and project store settings ineffective, owned store outside repository and mode 0700, root absent after cleanup |
| Frozen-input destination scan | PASS — current and immutable Phase 8 snapshots contain no npm/pnpm project config and neither lockfile contains explicit HTTP, Git, GitHub, or tarball resolution |
| Child-process inventory | PASS — all six mutation spawn sites and the package gateway explicitly supply `childEnvironment`; no ambient environment spread/inheritance assignment found |
| Policy producer/consumer inventory | PASS — the one production value originates in `MUTANT_EXECUTION_ENV`; only disposable compile/killer calls supply it; the package constructor is the only production interpreter; normal release/workflow paths do not set it |
| Protected release state | PASS — sealed `09-SECURITY.md`, mutation evidence, release evidence, and validation ledger had no diff and retained SHA-256 values `ee0fa751…`, `cf4a003b…`, `d27a444a…`, and `55813181…`; the prior audit input was `ae814055…`; only this report was edited, while the pre-existing `.planning/config.json` modification and `examples/adapter-ssr/.astro/` untracked directory were preserved |

No production `prepare`, `apply`, `finalize versioned`, mutation `run all`, release battery, Changesets version, live publish, npm publication, or evidence regeneration command was executed.

## Threat Flags and Release State

The thirteen Phase 09 summaries contain no formal `## Threat Flags` entries. Current implementation surfaces map to the registered threats above. **Unregistered flags: none.**

The root and public package versions remain `0.0.0`, the intended changeset remains pending, and the sealed feature-era ledgers were not regenerated. The retained mutation evidence binds 125 release inputs at digest `8dd58a6b…`; an independent read-only reconstruction found 132 current inputs at `6f4334fa…`. That deliberate staleness remains fail-closed and is not treated as fresh authorization. Publication remains blocked until the separately reviewed receipt-backed versioned ceremony is deliberately authorized, completes, and regenerates the four ledgers.

`SECURITY.md`: `.planning/phases/09-react-and-svelte-adapters/09-SECURITY-AUDIT.md`
