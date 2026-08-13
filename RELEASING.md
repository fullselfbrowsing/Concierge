# Releasing Concierge 0.2

Concierge publishes one fixed trio at one stable `0.2.x` version under the
npm `latest` dist-tag. Release artifacts are built without publish credentials,
independently sealed from a clean checkout, and published byte-for-byte from a
protected GitHub environment using npm trusted publishing.

The live release identity is `.release/lines/0.2.json`. Historical Phase 09
scripts and `.planning` evidence reproduce the unpublished v0.1 milestone; they
do not authorize a 0.2 release and must not be edited into the current flow.

## Fixed release set

Publish order is load-bearing:

1. `@fullselfbrowsing/concierge`
2. `@fullselfbrowsing/concierge-react`
3. `@fullselfbrowsing/concierge-svelte`

Core is first because each adapter has a core peer. All three manifests, packed
archives, Changesets output, release seal, registry versions, and `latest` tags
must agree. Contract v2 is fixed throughout the 0.2 line.

## One-time registry bootstrap

This setup changes npm and GitHub configuration and must be performed by an
authorized maintainer with account-level 2FA. It is not part of an ordinary
release run.

### 1. Confirm ownership and names

Confirm that the npm `@fullselfbrowsing` organization or user scope exists and
the maintainer has package/settings write permission. Recheck all three names:

```sh
npm view @fullselfbrowsing/concierge version
npm view @fullselfbrowsing/concierge-react version
npm view @fullselfbrowsing/concierge-svelte version
```

An `E404` means no public package record exists; it does not prove scope write
authority. Do not continue under a similarly spelled or lowercase scope.

Every release manifest must use this case-sensitive repository URL:

```text
git+https://github.com/fullselfbrowsing/Concierge.git
```

### 2. Create inert package records when they do not exist

npm requires a package to exist before a trusted-publisher relationship can be
configured. For each missing package, publish a minimal inert
`0.0.0-bootstrap.0` using interactive maintainer authentication:

```sh
bootstrap_dir="$(mktemp -d)"
cd "$bootstrap_dir"

# Repeat with each exact package name and matching packages/<directory> value.
npm init --yes
npm pkg set name='@fullselfbrowsing/concierge'
npm pkg set version='0.0.0-bootstrap.0'
npm pkg set description='Registry bootstrap only; install a supported release.'
npm pkg set type='module'
npm pkg set license='MIT'
npm pkg set repository.type='git'
npm pkg set repository.url='git+https://github.com/fullselfbrowsing/Concierge.git'
npm pkg set repository.directory='packages/concierge'
npm pkg set publishConfig.access='public'
npm pkg set publishConfig.tag='bootstrap'

# Replace the generated entry with a module that fails loudly if installed.
printf '%s\n' 'throw new Error("This is an inert Concierge registry bootstrap; install 0.2 or newer.");' > index.js
npm pkg set main='./index.js'
npm pkg set exports='./index.js'

npm publish --access public --tag bootstrap --otp='<current-2fa-code>'
```

Use a fresh temporary directory for each package. Confirm that only `bootstrap`
points to the inert version and that `latest` is absent:

```sh
npm view @fullselfbrowsing/concierge dist-tags --json
```

Do not publish any repository-built `0.1.0`, assign `latest`, or use an
automation token for bootstrap. Do not unpublish the inert version after
launch; registry history is immutable evidence.

### 3. Configure three trusted publishers

Use npm 11.19.0 or newer in the npm 11 line and authenticate interactively:

```sh
npm install --global npm@11.19.0
npm login

for package in \
  @fullselfbrowsing/concierge \
  @fullselfbrowsing/concierge-react \
  @fullselfbrowsing/concierge-svelte
do
  npm trust github "$package" \
    --repo fullselfbrowsing/Concierge \
    --file release.yml \
    --env npm-production \
    --allow-publish \
    --yes
done
```

The workflow field is the filename `release.yml`, not its full path. All names
are case-sensitive. `--allow-publish` is required by current npm trust
configuration and grants only the command used by this release workflow; do
not also grant `--allow-stage-publish`. npm currently permits one trusted
publisher per package.

Verify each relationship and its publish-only permission with
`npm trust list <package>`. In each package's npm settings, set publishing
access to require 2FA and disallow traditional tokens. No `NPM_TOKEN` or write
token belongs in the repository or GitHub secrets. See npm's
[trusted-publisher requirements](https://docs.npmjs.com/trusted-publishers/)
before performing this one-time external setup.

### 4. Protect the GitHub environment

Create the `npm-production` deployment environment in
`fullselfbrowsing/Concierge` with:

- required maintainer reviewers and self-review prevention;
- deployment restricted to `main`;
- no npm credential secret;
- administrators subject to the same protection where repository policy
  permits it.

The repository must remain public for npm provenance generation. The publish
job must run on a GitHub-hosted runner and receive only `id-token: write`.

## Preparing a release

### 1. Add a Changeset

A release Changeset names all three public packages at the same bump level.
They are one exact fixed group in `.changeset/config.json`.

For a 0.2 patch, keep every adapter's source core peer at `workspace:^`. For a
future pre-1.0 minor, first use a bounded old/new transition such as
`workspace:^0.2.3 || ^0.3.0`; the version wrapper verifies the target and
normalizes the Version Packages PR back to `workspace:^`. Never publish a broad
`>=0.0.0` core peer.

### 2. Run candidate checks

From a clean checkout on Node 24:

```sh
corepack enable
pnpm install --frozen-lockfile

node scripts/release/check.mjs source
node scripts/release/version.mjs self-test
node scripts/release/package.mjs self-test
node scripts/release/compatibility.mjs self-test
node scripts/release/seal.mjs self-test
node scripts/release/publisher.mjs self-test

pnpm build
pnpm typecheck
pnpm test
pnpm --filter @fullselfbrowsing/concierge-example-next-ai-sdk build
```

To reproduce archive certification locally, allocate a new empty directory
outside the repository:

```sh
archive_dir="$(mktemp -d)"
node scripts/release/package.mjs export "$archive_dir"
node scripts/release/compatibility.mjs "$archive_dir"
```

That networked compatibility gate installs the exact core archive with AI
6.0.0, current 6.x, 7.0.0, and current 7.x, then builds the same Next source
against current AI 6 and 7 stacks. It also installs the exact React and Svelte
archives into minimum/current framework cells, checks ESM SSR imports, strict
declarations, and one physical core. It never uses a live model credential.

To prepare the exact AI 7 example in a new path for a local browser run:

```sh
example_dir="$(dirname "$archive_dir")/concierge-release-example"
test ! -e "$example_dir"
node scripts/release/compatibility.mjs prepare-example "$archive_dir" "$example_dir"
cd "$example_dir"
CONCIERGE_RELEASE_BROWSERS=1 npm run test:e2e
```

Install Chromium, Firefox, and WebKit with Playwright first if they are not
already present. The prepared manifest points at all three exact archives; it
contains no workspace dependency.

### 3. Review the Version Packages PR

Pushing a Changeset to `main` causes `changesets/action` to open or update a
Version Packages PR through `scripts/release/version.mjs`. Review that the PR:

- consumes at least one intended Changeset;
- gives all three packages one stable `0.2.x` version;
- updates all three changelogs;
- retains contract v2 for a patch;
- leaves adapter core peers as canonical `workspace:^`;
- contains only expected manifest, changelog, and lockfile changes.

Merge only after the source, example, compatibility, security, and migration
documentation for the release is final. Any tracked change after terminal
certification requires a new exact-SHA run.

## Automated release flow

Merging the Version Packages PR leaves no pending Changeset. The next
`release.yml` run follows five privilege-separated jobs:

| Job | Authority | Work |
| --- | --- | --- |
| `version` | Repository and PR write | Validate policy; open a Version Packages PR when Changesets remain |
| `verify` | Contents read | Install, build, typecheck, test, pack each package once, run publint/ATTW, test AI 6/7 plus React/Svelte minimum/current cells, fetch pinned npm |
| `seal` | Contents read | Clean checkout; independently validate policy, archive manifests/digests, and npm integrity; copy exact tools/archives and create `release-seal.json` |
| `browser_e2e` | Contents read | Revalidate the seal, install its exact trio into an isolated example, and test the signed bridge in Chromium, Firefox, and WebKit |
| `publish` | OIDC only, protected environment | No checkout/install/build/repack; verify sealed launcher, publish exact archives, verify registry integrity/provenance/tag |

Every artifact name binds workflow run, attempt, and source SHA. The seal binds
repository, source ref, workflow, environment, commit, package-set digest,
contract, version, dist-tag, archive SHA-256/SHA-512, and publisher tool bytes.

The publisher invokes, in fixed order:

```text
npm publish <sealed-archive> --access public --tag latest --provenance
```

For every package it then requires:

- registry `name` and `version` equal the seal;
- npm SHA-512 integrity equals the sealed archive;
- exactly one SLSA provenance statement names the package bytes;
- provenance names the public Concierge repository, `release.yml`, `main`, and
  the exact source commit on a GitHub-hosted runner;
- `dist-tags.latest` equals the shared version.

The publisher never changes a dist-tag separately. If a version exists with
foreign bytes, provenance, or tag, publication stops for maintainer review.

## Approval and publication

Before approving `npm-production`, review the completed `verify`, `seal`, and
`browser_e2e` jobs, exact source SHA, shared version, package order,
compatibility matrix, and sealed artifact name. Approval authorizes only the
already sealed bytes.

After publication, independently check:

```sh
for package in \
  @fullselfbrowsing/concierge \
  @fullselfbrowsing/concierge-react \
  @fullselfbrowsing/concierge-svelte
do
  npm view "$package" version dist-tags dist.integrity dist.attestations --json
done
```

Install the trio in a new Node 22.12 consumer, confirm one physical core with
`pnpm why`, import every public subpath, and run the documented quick start.

Only after all three registry records pass should a maintainer create GitHub tag
and release `v<shared-version>` at the exact sealed commit. Attach checksums or
link the workflow; do not attach repacked npm archives.

## Partial publication and resumption

npm versions are immutable, so publication is intentionally resumable. If the
publish job stops after one or more packages:

1. Do not rebuild, edit a tag, unpublish, or manually publish a remaining
   package.
2. Re-run the failed publish job so it reuses the retained sealed artifact.
   A later workflow attempt may consume an earlier seal from the same run and
   commit.
3. The publisher skips an existing package only after its integrity,
   provenance repository/workflow/commit, and `latest` tag pass.
4. It publishes the first genuinely missing package in the fixed order.

If the sealed artifact expired, run the complete workflow again from the exact
same commit. The newly certified archives must match already-published bytes or
the integrity check fails closed. A different commit requires a new version.

A nonzero `npm publish` result is treated as ambiguous even if the request may
have reached npm. Re-run the sealed publisher to query authoritative registry
state; do not guess.

## Emergency response

Published npm versions cannot be overwritten. For a code or security defect:

1. stop or reject pending environment approvals;
2. privately assess impact under [SECURITY.md](./SECURITY.md);
3. prepare and certify a synchronized patch trio;
4. publish it through the same workflow;
5. deprecate the affected version with a safe generic message if needed.

Changing `latest` outside the publisher is an exceptional registry mutation. It
requires an explicitly reviewed maintainer operation with 2FA, a recorded exact
target, and follow-up verification across all three packages. Never silently
retag only part of the trio.
