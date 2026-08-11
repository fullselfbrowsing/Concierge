# Releasing Concierge

Concierge publishes to npm from `.github/workflows/release.yml` using **npm trusted
publishing over OIDC**. There is no long-lived publish token anywhere in this
repository or in the org secrets this workflow reads.

## Read this first

> **`.github/workflows/release.yml` has never been executed.**
>
> Nothing publishes until v0.1 completes (see `.planning/ROADMAP.md`), so the workflow
> ships unrun. Its verification to date is **static review only** — six named properties
> checked by inspection and `grep` in plan 02-10:
>
> 1. `permissions.id-token: write` is present
> 2. no `NPM_TOKEN` is assigned or referenced anywhere under `.github/`
> 3. no `--provenance` flag on any executable line
> 4. no `auth-token-line` input on any executable line
> 5. `fetch-depth: 0` is present on the checkout step
> 6. `node-version: 24`
>
> None of those is a substitute for a run. The first real release is the first genuine
> test of this file, and the checklist below is what turns that release into a checked
> claim rather than a hopeful one.

## Version floors, and where each one comes from

These are hard requirements, not preferences. Each has a specific failure attached.

| Tool | Floor | Where it comes from | What happens below it |
|---|---|---|---|
| **pnpm** | **≥ 11.1.3** | pnpm 11.1.3 release note (2026-05-18), PR `pnpm/pnpm#11526`, issue `pnpm/pnpm#11513` | **404 on the PUT.** `changeset publish` shells out to `pnpm publish` in this workspace (read from `@changesets/cli@2.31.1`'s `getPublishTool`), so OIDC support lives in pnpm. `actions/setup-node` writes `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}` into a project-level `.npmrc`; under OIDC there is deliberately no `NODE_AUTH_TOKEN`, and an older pnpm passes the unresolved placeholder through, concludes auth is configured, and never performs the OIDC exchange. Provenance signing appears to succeed first, which makes it the most misleading failure in the set. |
| **npm CLI** | **≥ 11.5.1** | npm trusted-publishing docs | The OIDC exchange is unsupported. The workflow runs `npm install -g npm@latest` because the runner's bundled npm may be older. There is a matching open report for **scoped** packages (`npm/cli#8976`), and this package is scoped, which is why npm is upgraded explicitly rather than trusted at the runner default. |
| **Node** | **≥ 22.14.0** | npm trusted-publishing docs | The OIDC exchange is unsupported. The workflow pins `node-version: 24`. |

`packageManager` in the root `package.json` pins `pnpm@11.17.0`, far past the pnpm floor.
`ci.yml`'s build job asserts the resolved pnpm major is `11.` so a silent downgrade in
`pnpm/action-setup` surfaces in CI rather than at publish time.

**Do not confuse these with `engines.node`.** `packages/concierge`'s
`engines.node: ">=22.12.0"` is a promise to *consumers* about where the published
artifact runs. The numbers above are *release-machinery* requirements. They are
different numbers for different audiences and must never be harmonized.

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

The `all` run builds each live package and packs it exactly once. It then runs
`publint --strict` and ATTW with the `esm-only` profile directly against each
of those exact archives, inspects every tar entry and export target, and
installs the same paths in a consumer outside workspace resolution with install
scripts disabled. The installed adapter manifests and resolver realpaths must
both converge on one physical core, with no adapter-local core copy; package
manager graph text by itself is not sufficient evidence.

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
register, ledger, archive, or Phase 8 drift invalidates verify-only evidence.
Rerun Task 09-13-01 before relying on that evidence or publishing; a later
`verify all` pass cannot bless bytes different from the terminal snapshot it
was created to verify.

## One-time setup on the npm side

Trusted publishing must be configured on npmjs.com before the first release; the
workflow cannot create it.

1. Sign in to npmjs.com as a maintainer of the `@fullselfbrowsing` scope.
2. On the package's **Settings → Trusted publishers**, add a GitHub Actions publisher
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
      version bump, correct changelog entry, and **no private package listed**.
- [ ] Merge it. The workflow re-runs on `main` and publishes.
- [ ] The job log shows the OIDC exchange, not a token read.
- [ ] **Open the package page on npmjs.com and verify the provenance attestation
      appears.** This is a human step and cannot be delegated to the workflow's exit
      code.
- [ ] **A successful publish without an attestation is a FAILED publish.** Treat it as
      an incident: unpublish or deprecate the version, find the credential that took
      precedence over OIDC (almost always a stray `NPM_TOKEN` in the env), remove it,
      and publish again. Do not accept the artifact because the build was green — a
      silent provenance downgrade is exactly the failure that looks fine.
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
| `id-token: write` removed | No OIDC token to exchange; publish falls back to token auth and fails `ENEEDAUTH` / 404 |
| pnpm pinned below 11.1.3 | 404 on the PUT, after provenance signing appears to succeed |
| npm CLI below 11.5.1 on the runner | OIDC exchange unsupported |
| `NPM_TOKEN` present in the env | Token auth wins; publish succeeds **without** provenance — green build, degraded artifact |
| `--provenance` passed by hand | Redundant on a public repo; a second, divergent signing path |
| `auth-token-line: false` added | The input does not exist in `actions/setup-node`; unknown `with:` keys are ignored, so it looks like it did something and did not |
| `fetch-depth` left at the default | changesets cannot determine what was already released; version/publish misbehave |
