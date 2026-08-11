# Releasing Concierge

Concierge publishes to npm from `.github/workflows/release.yml` using **npm trusted
publishing over OIDC**. There is no long-lived publish token anywhere in this
repository or in the org secrets this workflow reads.

## Read this first

> **`.github/workflows/release.yml` has never been executed.**
>
> Nothing publishes until v0.1 completes (see `.planning/ROADMAP.md`), so the workflow
> ships unrun. Its verification to date is **static review only**. The executable
> `scripts/phase-09-workflow-check.mjs` checks job boundaries, exact action commits,
> blocking order, artifact identity, and the publisher toolchain, with negative controls
> for repacking, broad uploads, appended publication, credential leakage, workspace
> code under write authority, and OIDC privilege drift:
>
> 1. `prepare` has only `contents: read`, persists no checkout credential, receives no
>    write token or netrc, and produces a semantic-only version artifact;
> 2. `version` has contents/PR write solely for the pinned Changesets action, whose
>    custom command is the stdlib-only prepared-artifact verifier/copier;
> 3. `verify` can only read contents and owns install/build/test/archive export;
> 4. `seal` can only read contents, runs no workspace code, and independently compares
>    the untrusted export with tracked release evidence at the exact commit;
> 5. only the dependent `publish` job has `id-token: write`, and it has no checkout,
>    setup, install, build, test, or pack step;
> 6. all actions are pinned to reviewed 40-hex commits;
> 7. every configured publish entry rejects package directories and reaches the one
>    exact archive publisher; and
> 8. every artifact is scoped to repository run, run attempt, and commit; the downloaded
>    publisher, npm CLI, content-addressed seal, and three archives are rehashed and
>    rebound to that identity before use.
>
> None of those is a substitute for a run. The first real release is the first genuine
> test of this file, and the checklist below is what turns that release into a checked
> claim rather than a hopeful one.

## Version floors, and where each one comes from

These are hard requirements, not preferences. Each has a specific failure attached.

| Tool | Floor | Where it comes from | What happens below it |
|---|---|---|---|
| **pnpm** | **11.17.0** | root `packageManager` pin | Runs install/build/test and produces the checked archives in no-OIDC jobs. It never holds publication authority. |
| **npm CLI** | **11.11.0** | exact registry tarball URL and committed SHA-512 SRI in `release.yml` | Publishes the three checked `.tgz` paths. The OIDC job downloads this exact tarball, rechecks its SRI, extracts it without installation, and asserts `--version` before use. A runner-bundled or floating npm is never trusted for publication. |
| **Node** | **≥ 22.14.0** | npm trusted-publishing docs | The no-OIDC jobs pin Node 24. The minimal publisher deliberately has no setup action under OIDC, so its first built-in check rejects a hosted-runner Node below 22.14.0 before invoking npm. |

`ci.yml` also installs and asserts npm 11.11.0 before the offline foreign-consumer
package proof. The OIDC publisher does not run either package-manager setup action.

**Do not confuse these with `engines.node`.** `packages/concierge`'s
`engines.node: ">=22.12.0"` is a promise to *consumers* about where the published
artifact runs. The numbers above are *release-machinery* requirements. They are
different numbers for different audiences and must never be harmonized.

## Automated version, evidence, and publication sequence

The workflow has five jobs and two distinct pushes to `main`:

1. Credential-free `prepare` checks out the exact `github.sha` with
   `persist-credentials: false`. If a changeset exists, it versions a private snapshot
   and uploads a SHA-256-manifested **semantic-only** allowlist: the three public
   manifests, bounded deterministic changelogs, an optional lockfile containing only
   the exact adapter-peer normalization, and matching changeset deletions. Arbitrary
   Markdown, dependency changes, evidence/ledger files, and unrelated paths are
   rejected. If no changeset exists it uploads an exact no-op manifest. Neither path
   receives a write token or netrc.
2. Minimal `version` downloads that run/commit-bound artifact and invokes the pinned
   Changesets action. Its only custom version command is
   `node scripts/phase-09-version.mjs apply <artifact-dir>`: a stdlib-only path that
   checks base hashes, every semantic transition, and the exact blob/path set before
   copying it. Apply then derives `09-VERSION-RECEIPT.json` from the accepted artifact
   and final bytes. This job never installs dependencies, runs build/test/package/
   mutation code, or copies generated evidence.
3. While a changeset remains, `hasChangesets` is true and later jobs are skipped. A
   human checks out the Version Packages PR, reviews the semantic diff and receipt,
   then runs the credential-free finalization ceremony:

   ```sh
   node scripts/phase-09-mutation-battery.mjs finalize versioned --jobs 2
   ```

   Run it only from the clean committed PR head. Review the four regenerated Phase 09
   ledgers, commit them, and push that commit to the same PR. CI and publication reject
   missing or stale versioned evidence, and the evidence must bind the tracked receipt's
   repository, base SHA, run ID, run attempt, artifact name, and digest. Automation
   cannot make this semantic release decision on the repository-writing path.
4. Merge the fully reviewed PR. On the merged version commit, `hasChangesets` is false;
   `verify` runs the dependency battery and exports an explicitly untrusted exact
   archive triplet.
5. Clean `seal` checks out the exact commit read-only, downloads the untrusted export,
   runs inline Node stdlib plus `git`/`tar` only, and compares archive identity, version,
   publish metadata, and SHA-256 with tracked receipt-bound versioned release evidence.
   It binds repository, source ref, workflow path, run ID, run attempt, commit, input
   artifact name, output artifact name, consumed changeset digests, receipt digest, and
   SHA-512 integrities into `phase09-sealed-release-<attempt>-<seal-id>`.
6. Only after that seal succeeds does `publish` receive `id-token: write`. It consumes
   only the independently sealed artifact and content-addressed pinned npm tooling,
   revalidates every binding, forces all npm queries and publishes to
   `https://registry.npmjs.org/` with owned empty config files, and publishes or safely
   resumes core → React → Svelte.

Before v0.1 is versioned, the source adapter peer is deliberately the bounded
transition `workspace:^0.0.0 || ^0.1.0`. That makes raw `changeset status` report
the honest synchronized 0.1.0 minor plan without admitting a future major. The
version wrapper requires the second arm to equal the version Changesets actually
produced, then restores canonical `workspace:^` before any versioned output is copied.
pnpm therefore writes `^<shared-version>` into each final packed adapter (for v0.1,
`^0.1.0`); a broad `>=0.0.0` peer is never committed or published. Future pre-1.0
minor transitions use the same bounded old/new form in their release changeset and
are normalized by the Version Packages PR. The fixed triplet and
`onlyUpdatePeerDependentsWhenOutOfRange` option in `.changeset/config.json` are both
load-bearing and are checked by the workflow gate.

## Release evidence for the three-package set

v0.1 is one ordered package set, not three independent releases. Publish the
core first, then the two peer adapters in this order:

1. `@fullselfbrowsing/concierge`
2. `@fullselfbrowsing/concierge-react`
3. `@fullselfbrowsing/concierge-svelte`

Both adapters declare core as a peer, never as an ordinary runtime dependency,
so the core version must be available before either adapter is published.

The authoritative package gate is:

```sh
PHASE09_ARCHIVE_EXPORT_DIR=/absolute/path/to/an/existing-empty-directory \
  node scripts/phase-09-package-check.mjs all
```

The export directory must be an absolute, normalized, existing empty directory
outside the repository. A successful run exports exactly these three archive
identities plus one digest manifest:

| Package | Exact archive path in the export directory | Exact digest record |
|---|---|---|
| `@fullselfbrowsing/concierge` | `fullselfbrowsing-concierge-<version>.tgz` | `phase-09-archive-digests.json` → `archives["@fullselfbrowsing/concierge"]` |
| `@fullselfbrowsing/concierge-react` | `fullselfbrowsing-concierge-react-<version>.tgz` | `phase-09-archive-digests.json` → `archives["@fullselfbrowsing/concierge-react"]` |
| `@fullselfbrowsing/concierge-svelte` | `fullselfbrowsing-concierge-svelte-<version>.tgz` | `phase-09-archive-digests.json` → `archives["@fullselfbrowsing/concierge-svelte"]` |

Each digest record contains the archive's exact filename and lowercase SHA-256.
Publish only those three byte-identical files, in the order above. Repacking,
renaming, or substituting an archive invalidates the shared evidence even when
its manifest version is unchanged.

Ordinary `node scripts/phase-09-mutation-battery.mjs run all --jobs <n>` creates
feature evidence only: it is sealed with `mode: "feature"`,
`releaseAuthorization: false`, no shared release version, and no consumed changeset.
It remains valid for feature CI but can never authorize npm. Only the manual
receipt-backed `finalize versioned` ceremony creates evidence with `mode: "versioned"`,
`releaseAuthorization: true`, the non-`0.0.0` shared version, the tracked version
receipt binding, and each consumed changeset path plus SHA-256. Before export upload,
the workflow runs:

```sh
node scripts/phase-09-mutation-battery.mjs verify publish /absolute/archive/export
```

That read-only verifier requires the versioned fields and exact evidence/archive
version and digest match. The later clean sealer independently repeats the critical
comparison from tracked evidence; the archive-producing dependency job cannot bless
coordinated replacement bytes by rewriting their adjacent manifest.

The `all` run builds each live package and packs it exactly once. It then runs
`publint --strict` and ATTW with the `esm-only` profile directly against each
of those exact archives, inspects every tar entry and export target, and
installs the same paths in a consumer outside workspace resolution with install
scripts disabled. The installed adapter manifests and resolver realpaths must
both converge on one physical core, with no adapter-local core copy; package
manager graph text by itself is not sufficient evidence.

The consumer tooling graph is committed at
`scripts/fixtures/phase-09-foreign-consumer/package-lock.json`. The package gate
requires the exact npm version named by the adjacent manifest, records the lock
SHA-256, populates an owned cache once from that lock, and runs every proof
consumer through `npm ci --ignore-scripts --offline`. It then adds only the
three exact local archives with npm still offline and verifies that the copied
tooling lock remains byte-identical. The lock digest and npm version are part of
the generated release evidence; changing either invalidates the evidence.

Declaration checking uses TypeScript 7.0.2 with `skipLibCheck: false` over all
three installed packages. Svelte packaging/checking and the normal Astro
`examples/adapter-ssr` domain stay on their package-local TypeScript 6.0.3.
Those are deliberately separate compiler domains, and neither may be replaced
by forcing the other's version.

Before terminal evidence is sealed, the package set must also prove all of the
following:

- the exact archives import through their public server-safe roots;
- React server rendering and compiled Svelte server rendering register no
  bridge;
- the normal `examples/adapter-ssr` Astro check/build and repeated fresh-process
  SSR proof use both adapters, one immutable catalog declaration, absent browser
  globals, and request-local mutable objects;
- a genuine compiled `$state` value remains live through its bridge getter but
  detaches at review through `svelteSnapshotNormalizer`, so nested drift returns
  exactly `consent_stale` and enters no consequential handler;
- React and Svelte contract-version mismatch probes fail through their public
  client lifecycle before registration while the original core archive digest
  stays unchanged;
- `node scripts/phase-09-adapter-budget.mjs check` enforces independent
  `<=150` production-source budgets and the forbidden-responsibility boundary,
  with `self-test` proving the inventory, line, parser, loop, and responsibility
  negatives;
- the Phase 09 compiled mutation register kills R1, R2, S1, SSR1, B1, P1, and C1
  from one immutable revision for their named semantic assertions.

### Preserve Phase 8 exactly

Phase 09 inherits these five Phase 8 records and no substitutes:

- `.planning/phases/08-consent-kernel/08-MUTATION-REGISTER.json`
- `.planning/phases/08-consent-kernel/08-MUTATION-EVIDENCE.json`
- `.planning/phases/08-consent-kernel/08-VALIDATION.md`
- `.planning/phases/08-consent-kernel/08-SECURITY.md`
- `.planning/phases/08-consent-kernel/08-VERIFICATION.md`

Phase 8 release evidence is the nested `release` member of
`08-MUTATION-EVIDENCE.json`. That nested record binds its seven release-command
exits, runtime counts, public artifact surface, zero-byte dependency result,
foreign package consumer, Node floor, and immutable revision digest.

The Phase 09 terminal runner hashes all five live records, copies the repository
to a disposable snapshot, and runs these three real commands there, in order:

```sh
node scripts/phase-08-mutation-battery.mjs verify all
node scripts/phase-08-mutation-battery.mjs verify inputs
node scripts/phase-08-mutation-battery.mjs verify ledgers
```

All three must exit zero in the disposable snapshot, after which the five live
hashes must still be byte-identical. Do not run the ledger-refreshing path as a
way to rewrite the live Phase 8 record during Phase 09.

### Terminal ordering and drift

Plan 09-13 is terminal. It runs only after every adapter/example source,
manifest, config, lockfile, README, root script, workflow, harness, and mutation
register edit is complete. It binds the exact archive triplet, positive test
counts, normal Astro SSR, real-rune consent drift, source budgets, workflow
checks, immutable mutations, and the five unchanged Phase 8 hashes to one final
revision.

After Plan 09-13, any source, manifest, documentation, workflow, test, mutation
register, ledger, archive, receipt, or Phase 8 drift invalidates verify-only evidence.
Feature work uses the ordinary terminal regeneration path. A Version Packages PR uses
the explicit `finalize versioned` ceremony above; a later `verify all` pass cannot
bless bytes different from the terminal snapshot it was created to verify.

## One-time setup on the npm side

Trusted publishing must be configured on npmjs.com before the first release; the
workflow cannot create it.

1. Sign in to npmjs.com as a maintainer of the `@fullselfbrowsing` scope.
2. On each of the three public packages' **Settings → Trusted publishers**, add a GitHub Actions publisher
   bound to:
   - **Repository:** `fullselfbrowsing/concierge`
   - **Workflow file:** `release.yml`
3. Confirm there is **no** `NPM_TOKEN` in this repository's secrets, in any environment
   this workflow uses, or in an org-level secret inherited by it. A stray token is not
   an inert leftover — see the next section.

The binding is to a repo *and* a workflow file, which is the point: publish rights are
not a transferable string.

## First-publish checklist

Run through this by hand on the first real release, in order.

- [ ] A changeset exists for the change (`pnpm exec changeset add`). `changeset status`
      exits **1** when packages changed with no changeset present — that is the
      unreleased-change signal, not an error in the config.
- [ ] The "Version Packages" PR opened by `changesets/action` looks right: correct
      shared version bump, all three bounded changelog entries, the apply-derived
      `09-VERSION-RECEIPT.json`, consumed changeset deletion, and **no private package
      listed**. Both adapter manifests must contain source peer `workspace:^`. The
      automated commit must not contain regenerated evidence ledgers or unrelated
      manifest, lockfile, Markdown, or dependency changes.
- [ ] From the clean committed Version Packages PR head, run
      `node scripts/phase-09-mutation-battery.mjs finalize versioned --jobs 2` without
      repository or npm credentials. Review all four regenerated Phase 09 ledgers,
      confirm their `versionReceipt` binding matches the tracked receipt, commit them,
      and push. Do not merge while CI reports missing or stale receipt-backed evidence.
- [ ] Merge the reviewed semantic change plus separately reviewed finalization commit.
      The workflow re-runs on `main`; `prepare` emits the no-op version
      artifact, `version` reports no pending changeset, `verify` uploads four untrusted
      archive files and two publisher-tool files, and `seal` uploads exactly one seal
      plus three archives. Only then may the OIDC publisher run.
- [ ] Confirm every artifact name includes the current `github.run_attempt`, the seal
      artifact name is content-addressed, and the publisher log queries
      the exact core/React/Svelte versions in that order. Any package-directory publish,
      second pack, identity mismatch, or unsealed archive is a failed release.
- [ ] If any job stops partway through, use **Re-run all jobs**, never **Re-run failed
      jobs**. Attempt-scoped artifacts deliberately make a failed-jobs-only rerun fail
      closed. After an ambiguous publish result, the old seal is not resumable: the full
      rerun must create a new attempt and seal for the same commit. Already-present
      versions are skipped only when registry `dist.integrity` equals the sealed local
      SHA-512 and the fetched npmjs DSSE statement semantically matches the package,
      repository, source ref, commit, workflow, and GitHub Actions builder. Mismatched
      bytes or provenance are terminal failures. Never edit the command to skip a
      package manually.
- [ ] The job log shows the OIDC exchange, not a token read.
- [ ] **Open the package page on npmjs.com and verify the provenance attestation
      appears.** This is a human step and cannot be delegated to the workflow's exit
      code.
- [ ] Treat the publisher's fetched-bundle check as semantic binding, not local
      cryptographic verification. It decodes the DSSE statement and checks its claimed
      subject/source identity; it does not verify the signature or transparency log.
      The npm trusted-publisher ingestion and the human npmjs attestation check remain
      required.
- [ ] **A successful publish without an attestation is a FAILED publish.** Treat it as
      an incident: unpublish or deprecate the version and investigate the trusted
      publisher configuration. The publisher rejects token/auth variables and registry
      or npm-config overrides case-insensitively before invoking npm, so do not bypass
      that guard. Do not accept the artifact because the build was green.
- [ ] Record the observed pnpm, npm and Node versions from the job log here, so the
      next release has a known-good baseline instead of a table of floors.

## The `.changeset/config.json` `ignore` list

`.changeset/config.json` is parsed with a **strict JSON** parse (`@changesets/config`
reads it with `fs.readJSON`), so it cannot carry a `//` comment the way
`tsconfig.test-d.json` does. The explanation of what belongs in its `ignore` list, and
why `privatePackages` is `false`, therefore lives in
[`CONTRIBUTING.md` § Changesets and the `ignore` list](./CONTRIBUTING.md#changesets-and-the-ignore-list).

## What goes wrong if the workflow is edited

| Mistake | Symptom |
|---|---|
| `id-token: write` removed | No OIDC token to exchange; with no long-lived token, publication fails closed |
| pnpm/root lock pin drift | Version or verification installs a different graph; static workflow check fails before publication |
| publisher/npm artifact digest drift | Minimal publisher aborts before the OIDC exchange or any package publication |
| `NPM_TOKEN`, `NODE_AUTH_TOKEN`, `NPM_ID_TOKEN`, or ambient npm registry/auth config present | Publisher rejects the environment before invoking npm |
| package `publishConfig` or repository metadata gains an extra/foreign destination | Sealer/publisher rejects the archive before any registry query or publish |
| `--provenance` removed from the exact publisher | The reviewed publication command drifted; workflow/static checks fail before OIDC publication |
| dependency command added to `version` | Repository-write authority reaches workspace/dependency code; workflow checker rejects the edit |
| workspace script added to `seal` | The untrusted archive producer can self-authenticate; workflow checker rejects the edit |
| archive and adjacent digest manifest changed together | Tracked versioned evidence differs; the independent sealer rejects the substitution |
| an existing registry version has different integrity, provenance URL, subject, source repository/ref/commit/workflow, or builder | Resume fails closed and no later adapter is published |
| only failed jobs are rerun | New run attempt cannot consume artifacts from the prior attempt; use Re-run all jobs |
| publish exits ambiguously | Current attempt fails closed; rerun the complete workflow to produce a fresh seal |
| checkout/setup/install/build added to the OIDC job | Dependency or action code receives publication authority; workflow checker rejects the edit |
| `fetch-depth` left at the default | Changesets cannot determine what was already released; version preparation misbehaves |
| `publish:` restored on `changesets/action` | Packages are repacked from directories and diverge from checked archives; workflow checker rejects the edit |
