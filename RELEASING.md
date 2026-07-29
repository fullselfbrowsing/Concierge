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
