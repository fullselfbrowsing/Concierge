---
phase: 02-packaging-build-and-release
plan: 10
subsystem: packaging
tags: [pkg-01, pkg-02, pkg-03, ci, github-actions, changesets, oidc, trusted-publishing, provenance, svelte-package, catalog]

# Dependency graph
requires:
  - phase: 02-packaging-build-and-release
    plan: "02-04"
    provides: "mutant P4 — the program on which `pnpm build` exits 0 and `pnpm typecheck` does not; the reason the CI step order is load-bearing"
  - phase: 02-packaging-build-and-release
    plan: "02-08"
    provides: "the two private fixture workspace members that `privatePackages: false` exists to exclude"
  - phase: 02-packaging-build-and-release
    plan: "02-09"
    provides: "scripts/pack-install-check.sh (check:pack, called by CI) and scripts/node-floor-check.sh (the local equivalent of the floor job, deliberately NOT called by CI)"
  - phase: 02-packaging-build-and-release
    plan: "02-11"
    provides: "mutant P8 — attw and publint both green on a build that LOST an export; the reason typecheck must be its own CI gate"
provides:
  - ".github/workflows/ci.yml — build job (assert pnpm 11.x -> install --frozen-lockfile -> typecheck -> build -> test -> check:artifact -> check:deps -> check:pack -> pack -> upload) and a pnpm-free node-floor job on a quoted, exact, asserted 22.12.0"
  - ".github/workflows/release.yml — changesets + npm trusted publishing over OIDC, no long-lived credential anywhere; SHIPS UNEXECUTED"
  - ".changeset/config.json — strict JSON, explicit empty ignore, privatePackages false"
  - "RELEASING.md — the first-publish checklist, the three version floors with their provenance, and the rule that a publish without an attestation is a FAILED publish"
  - "CONTRIBUTING.md — two new non-negotiables, the runner/builder centralization divergence, the changesets ignore-list note, and a pre-push command that is finally true"
  - "pnpm-workspace.yaml catalog: — svelte ^5.0.0 and @sveltejs/package ^2.5.8, pinned without being installed"
  - "A measured, defect-first proof that privatePackages:false is load-bearing: the versionable changed set is [concierge] with it and [fixture-alpha, fixture-beta, concierge] without it"
affects:
  - "02-12 — the phase gate re-runs these greps on a clean checkout; PKG-01/02/03 evidence is now wired into CI"
  - "02-12 — T-02-44 remediation (SHASUMS256.txt verification in scripts/node-floor-check.sh) is recorded here and NOT applied; scripts/ is outside this plan's files_modified"
  - "02-12 — 02-VALIDATION.md's `pnpm test -- <name>` rows are still uncorrected; this plan fixed the CI half only"
  - "Phase 9 — concierge-svelte's builder is now a written invariant with a catalog pin, not a discovery"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every comment in a workflow is a STANDALONE `#` line; a trailing inline comment survives `grep -v '^[[:space:]]*#'` and turns a compliant file red"
    - "State a version constraint as an exact inventory, never as an absence — '22.12.0' contains both '22.12' and '22', so 'must not contain 22.12' is unsatisfiable by construction"
    - "Scope an absence assertion narrowly enough that deleting the comment which records the mitigation is not the cheapest way to go green"
    - "Prove a config line is load-bearing by computing the counterfactual in memory against the tool's own API, rather than by mutating the file"

key-files:
  created:
    - .github/workflows/ci.yml
    - .github/workflows/release.yml
    - .changeset/config.json
    - RELEASING.md
  modified:
    - CONTRIBUTING.md
    - package.json
    - pnpm-workspace.yaml

key-decisions:
  - "The floor job does NOT call `pnpm run check:node-floor`. setup-node pins the runtime and download-artifact supplies the tarball, so the steps genuinely differ from the script's. The resulting asymmetry — the script is exercised only locally and at 02-12's gate — is written into ci.yml as a comment so each half is findable from the other"
  - "T-02-44 is NOT closed here and scripts/node-floor-check.sh is NOT edited: it is outside files_modified, and the escalation that motivated closing it (an unverified download on every CI job) does not occur, because CI never invokes that script"
  - "`typecheck` is its own required CI step and is never folded into `build`, on P4's and P8's combined evidence"
  - "`changeset status`'s exit code is deliberately not asserted; only its captured output is. The versionable-set computation is what carries the privatePackages claim"
  - "No placeholder `packages/concierge-svelte/` was created — research recommends the written rule plus the catalog pin (options 1 and 2), not option 3"

patterns-established:
  - "When CI and a local script cover the same requirement by genuinely different steps, name the asymmetry in a comment in both directions rather than pretending one calls the other"

requirements-completed: []

# Metrics
duration: 55min
completed: 2026-07-29
tasks: 3
commits: 3
files_changed: 7
---

# Phase 2 Plan 10: CI, the release path, and the two build toolchains Summary

**Every gate this phase built now runs on every change in the order that makes it mean something —
`typecheck` before `build`, as its own required step, because two separate mutants proved that the
build and its own `attw`/`publint` gates are both green on programs that are broken — the declared
Node floor is checked on a runtime that is pinned, quoted, exact, and *asserted*, by a job with zero
pnpm on any executable line, and the release path is configured for OIDC trusted publishing with no
long-lived credential and a written checklist for the one thing that cannot be verified yet.**

## Performance

- **Duration:** ~55 min wall (includes an interruption by a transient `ConnectionRefused` between
  Task 3's edits and its commit; no work was lost and the uncommitted diff was re-read before
  committing rather than assumed)
- **Tasks:** 3
- **Files changed:** 7 (4 created, 3 modified)

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | ci.yml — a build job and a pinned node-floor job, artifact-passed | `d7adbd1` | `.github/workflows/ci.yml` |
| 2 | changesets, the OIDC release workflow, and a durable first-publish checklist | `fa2fc3d` | `.changeset/config.json`, `.github/workflows/release.yml`, `RELEASING.md`, `package.json` |
| 3 | The two build toolchains as invariants, and a pin for the second | `e82ad1d` | `CONTRIBUTING.md`, `pnpm-workspace.yaml` |

`git diff --name-status eea66f2..HEAD` lists exactly seven paths — `A .changeset/config.json`,
`A .github/workflows/ci.yml`, `A .github/workflows/release.yml`, `A RELEASING.md`,
`M CONTRIBUTING.md`, `M package.json`, `M pnpm-workspace.yaml` — all inside this plan's declared
`files_modified`. **No commit in this plan contains a deletion**
(`git diff --diff-filter=D --name-only eea66f2..HEAD` is empty). `pnpm-lock.yaml`,
`packages/concierge/package.json`, everything under `packages/concierge/src/`, everything under
`scripts/`, and `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` are all byte-unchanged.

## The five carry-forward items, answered explicitly

The wave-7 briefing named five findings from waves 1–6 and made this plan the owner of three. Each is
answered below with a measurement, not an intention.

### 1. `pnpm test -- <name>` does not filter — CI uses the bare form. **Resolved.**

Re-measured on this tree, which makes it a **fifth** independent reproduction after 02-07, 02-08,
02-09 and 02-11:

| Command | Test files run | Tests run |
|---|---|---|
| `pnpm test fixtures` | **1** | **3** |
| `pnpm test -- fixtures` | **4** | **15** |

`ci.yml` contains exactly one test invocation, and it is bare:

```
87:      - run: pnpm test
```

Measured: `grep -rIh 'pnpm test' .github/ | grep -v '^[[:space:]]*#' | grep -c -- 'pnpm test --'`
returns **0**. There is no `--` form on any executable line anywhere under `.github/`. The step also
carries a standalone comment recording *why* the bare form is used, so the correction survives
someone copying the line into a filtered invocation later.

**Still open, and not mine:** `02-VALIDATION.md`'s `02-07-T1`, `02-07-T2`, `02-07-T3` and `PKG-04a`
rows still name the `--` form. That file is outside this plan's `files_modified`. Owner remains 02-12.

### 2. Do not grep typecheck output for an alias or symbol name. **Avoided by construction.**

02-11 measured that `tsc`'s `pretty` is off without a TTY, so piped terse output carries `file:line`
only and never the identifier text. **This plan writes no CI step that greps typecheck output.**
`- run: pnpm typecheck` is asserted on its **exit code** alone, which is what a workflow step does
natively. Nothing in `ci.yml` or `release.yml` inspects compiler stdout, so the TTY question does not
arise and no `script -q /dev/null` wrapper was needed. Recorded so a later reader does not go looking
for a decision that was never forced.

### 3. `attw` and `publint` are blind to a moved export — **`typecheck` is its own required gate.**

`ci.yml` runs `typecheck` as a standalone step, at line 75, **before** `build` at line 79, and it is
never folded into `build`. Both mutants are named in a standalone comment at that line:

- **P4 (02-04)** — `pnpm build` exits 0 and `pnpm typecheck` exits non-zero on the same program.
  rolldown transpiles without checking. A workflow running only `build`, or running `build` first and
  treating its success as the signal, is green on exactly that mutant.
- **P8 (02-11)** — on a build whose `dist/index.js` had **lost** `MESSAGE_MAX_CHARS`, both `attw` and
  `publint` reported "No problems found" and exited 0. Only `typecheck` saw it. So the build's own
  internal gates do **not** protect the export surface, and the natural-looking optimisation of
  dropping the separate typecheck step because "build already runs publint and attw" is precisely the
  regression to prevent.

`release.yml` holds the same order in one step: `pnpm typecheck && pnpm build && pnpm test`. The `&&`
chain is what makes the order enforceable rather than conventional.

### 4. T-02-44 — the unverified `nodejs.org/dist` download. **Not escalated, because CI never runs it.**

The briefing's concern was that wiring `check:node-floor` into `ci.yml` would turn an occasional
developer-run unverified download into one that runs on every CI job. **That escalation does not
happen, and the reason is structural rather than lucky.**

Plan 02-10 Task 1 explicitly forbids adding `pnpm run check:node-floor` to the build job, and the
floor job cannot call it either — the script builds and packs with pnpm before switching runtimes,
and pnpm cannot start on Node 22.12.0. Measured: `grep -c 'check:node-floor' ` on executable
(non-comment) lines of `.github/` returns **0**. `scripts/node-floor-check.sh` is invoked by nothing
in CI. The CI floor job gets its runtime from `actions/setup-node` and its artifact from
`actions/download-artifact` — no `curl`, no `tar`, no executed download.

`scripts/node-floor-check.sh` is **outside this plan's `files_modified` and was not edited**
(`git diff eea66f2..HEAD -- scripts/` is empty). Per the briefing's instruction, the exact remediation
is recorded here and flagged for 02-12, and `ci.yml` carries a standalone comment at the pointer to
that script naming the gap:

> That script fetches a Node tarball from nodejs.org/dist over HTTPS and EXECUTES it with no checksum
> verification (threat T-02-44, accepted for v0.1). Keeping it out of CI is what stops an unverified
> download from running on every job. If it is ever wired into CI, verify against the published
> SHASUMS256.txt first.

**Exact remediation for 02-12** (or a post-v0.1 hardening plan), stated so it does not have to be
re-derived:

```bash
# after downloading node-${VER}-${PLAT}-${ARCH}.tar.xz into "$CACHE_PARENT"
curl -fsSL "https://nodejs.org/dist/v${VER}/SHASUMS256.txt" -o "$CACHE_PARENT/SHASUMS256.txt"
( cd "$CACHE_PARENT" && grep " node-v${VER}-${PLAT}-${ARCH}.tar.xz\$" SHASUMS256.txt | shasum -a 256 -c - ) \
  || { echo "checksum mismatch for the Node ${VER} tarball — refusing to execute it" >&2; rm -rf "$CACHE_DIR"; exit 1; }
```

Two notes for whoever applies it. First, the script currently streams `curl | tar` in one pipe, so
the tarball is never on disk to be checked — closing T-02-44 means materialising the `.tar.xz` first,
which is a slightly larger edit than "two lines". Second, `SHASUMS256.txt` is itself fetched over the
same HTTPS channel and is **not** signed-checked here; `SHASUMS256.txt.sig` plus the Node release
keys would be the complete fix. The partial fix still removes the corrupted-or-truncated-download
class and the CDN-object-substitution class, which is most of the value.

**Disposition unchanged: accepted for v0.1.** The reasoning 02-09 recorded still holds *because CI
does not run the script* — the runtime executes only the built artifact and never builds, typechecks
or publishes it.

### 5. The two private fixture packages are excluded from changesets. **Resolved, and proven.**

`.changeset/config.json` sets `"privatePackages": false` and an explicit empty `"ignore": []`.

`changeset status`'s captured output names **neither** `@fullselfbrowsing/concierge-fixture-alpha`
nor `-beta` (verbatim output in the next section). But the status error path names *no* package at
all, so on its own that is weak evidence. The decisive measurement calls changesets' own
`getVersionableChangedPackages` composition — `@changesets/git`'s `getChangedPackagesSinceRef`
filtered by `@changesets/should-skip-package` — against the real config:

```
config.privatePackages = {"tag":false,"version":false}
config.ignore          = []
raw changed since main      : ["@fullselfbrowsing/concierge-fixture-alpha","@fullselfbrowsing/concierge-fixture-beta","@fullselfbrowsing/concierge"]
VERSIONABLE (privatePackages:false): ["@fullselfbrowsing/concierge"]
VERSIONABLE (changesets DEFAULT)   : ["@fullselfbrowsing/concierge-fixture-alpha","@fullselfbrowsing/concierge-fixture-beta","@fullselfbrowsing/concierge"]
```

Both fixtures **are** in the raw changed set — they were created after `main` — and both are removed
by the setting. The counterfactual is the point: read from `@changesets/config@3.1.4`'s source,
omitting `privatePackages` defaults to `{version: true, tag: false}`, so **changesets versions
private packages by default**. 02-08's forward note said changesets "ignores `private: true` packages
by default"; that is **not** what the installed version does, and the correction is recorded here
rather than smoothed over. The line is load-bearing, and it was proven by computing the counterfactual
in memory rather than by mutating the config.

Also worth stating because it is the trap 02-PATTERNS flagged: `@changesets/config` reads the file
with `fs.readJSON` (read directly from `changesets-config.cjs.js:139`), i.e. a **strict `JSON.parse`**.
The repo's JSONC precedent from `tsconfig.test-d.json` does not transfer. The file carries no comment;
the prose that would have been one lives in `CONTRIBUTING.md § Changesets and the ignore list`, and
`RELEASING.md` links to it.

## `changeset status` — verbatim output, exit code, and what it means

Run on the final tree. **Its exit code is recorded, not asserted**, exactly as the plan requires.

```
$ pnpm exec changeset status
🦋  error Some packages have been changed but no changesets were found. Run `changeset add` to resolve this error.
🦋  error If this change doesn't need a release, run `changeset add --empty`.
$ echo $?
1
```

| Fact | Value |
|---|---|
| exit code | **1** |
| packages named in the output | **none** |
| `grep -c 'concierge-fixture-' ` on the captured output | **0** |
| versionable changed set (computed) | `["@fullselfbrowsing/concierge"]` |

**A non-zero exit here is not evidence that `privatePackages: false` failed.** `changeset status`
exits 1 whenever `getVersionableChangedPackages` is non-empty and no `.changeset/*.md` exists — read
from `@changesets/cli@2.31.1`'s `status()`. Plans 02-01 through 02-11 all modify `packages/concierge`
or the root, so on every execution branch in this phase it exits 1 *for a reason that has nothing to
do with the fixtures*: it is reporting an unreleased change to `@fullselfbrowsing/concierge`. No
placeholder changeset was added.

The control confirms it, and is worth recording because it is the only run of `changeset status` in
this phase that exits 0:

```
$ pnpm exec changeset status --since=HEAD
🦋  info NO packages to be bumped at patch
🦋  ---
🦋  info NO packages to be bumped at minor
🦋  ---
🦋  info NO packages to be bumped at major
$ echo $?
0
```

Same config, same `privatePackages: false`, nothing changed since the ref — exit 0. So the config
parses, the command works, and the exit 1 above is entirely about the unreleased core change.

## What shipped

### `.github/workflows/ci.yml` — 175 lines, two jobs

Parsed with `js-yaml@4.3.0` rather than eyeballed. Structure as loaded:

```
jobs: [ 'build', 'node-floor' ]      node-floor needs: "build"
=== job build | runs-on ubuntu-latest
   0 uses actions/checkout@v5
   1 uses pnpm/action-setup@v4
   2 uses actions/setup-node@v5 {"node-version":24,"cache":"pnpm"}
   3 run  pnpm --version                     (asserts the major is 11.)
   4 run  pnpm install --frozen-lockfile
   5 run  pnpm typecheck
   6 run  pnpm build
   7 run  pnpm test
   8 run  pnpm run check:artifact
   9 run  pnpm run check:deps
  10 run  pnpm run check:pack
  11 run  pnpm pack --pack-destination "${{ runner.temp }}"   (working-directory: packages/concierge)
  12 uses actions/upload-artifact@v4 {"name":"tarball","path":"${{ runner.temp }}/*.tgz","if-no-files-found":"error"}
=== job node-floor | runs-on ubuntu-latest
   0 uses actions/download-artifact@v4 {"name":"tarball","path":"."}
   1 uses actions/setup-node@v5 {"node-version":"22.12.0"}
   2 run  node -e "if (process.version !== 'v22.12.0') { throw new Error('floor drifted: ' + process.version); }"
   3 run  npm init -y && npm install --no-audit --no-fund ./*.tgz
   4 run  node --input-type=module -e '…assertSingleInstance(); MESSAGE_MAX_CHARS !== 180 → throw…'
```

Note the loaded types: `node-version: 24` is the integer `24` and `node-version: '22.12.0'` is the
**string** `"22.12.0"`. That is the quoting doing its job.

Two details beyond the plan's letter, both additive and neither changing a mandated line:

- **`if-no-files-found: error`** on the upload. Without it, a `pnpm pack` that produced nothing would
  upload an empty artifact, and the floor job would fail at `npm install ./*.tgz` with a glob error
  that reads like a packaging defect rather than a missing artifact. Applied under Rule 2.
- **The `pnpm --version` assertion is a `case` on the major**, not a string equality against
  `11.17.0`. Equality would go red on a legitimate patch bump of `packageManager`; the failure being
  guarded is a *major* regression (anything below 11.1.3 reintroduces the OIDC 404), and 11.x is the
  claim that matters.

### `.github/workflows/release.yml` — 109 lines, one job, **never executed**

```
top keys: [ 'name', 'on', 'concurrency', 'permissions', 'jobs' ]
on:          {"push":{"branches":["main"]}}
concurrency: ${{ github.workflow }}-${{ github.ref }}
permissions: {"contents":"write","pull-requests":"write","id-token":"write"}
jobs: [ 'release' ] | runs-on ubuntu-latest
   0 uses actions/checkout@v5 {"fetch-depth":0}
   1 uses pnpm/action-setup@v4
   2 uses actions/setup-node@v5 {"node-version":24,"registry-url":"https://registry.npmjs.org","cache":"pnpm"}
   3 run  npm install -g npm@latest
   4 run  pnpm install --frozen-lockfile
   5 run  pnpm typecheck && pnpm build && pnpm test
   6 uses changesets/action@v1 {"version":"pnpm changeset version","publish":"pnpm changeset publish"} env {"GITHUB_TOKEN":"${{ secrets.GITHUB_TOKEN }}"}
```

It carries a standalone comment recording that `changeset publish` shells out to **`pnpm publish`**
in this workspace, and that pnpm below **11.1.3** returns a **404 on the PUT** under OIDC because
`actions/setup-node` writes an unresolved `${NODE_AUTH_TOKEN}` placeholder into `.npmrc` — after
provenance signing appears to succeed.

### `.changeset/config.json` — 12 lines, strict JSON

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.4/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [],
  "privatePackages": false
}
```

`$schema` is pinned at `3.1.4`, the **installed** `@changesets/config` version (read from
`node_modules`), not at a guessed one. `privatePackages: false` was confirmed valid against that
package's own `schema.json`, whose `anyOf` accepts `{tag?, version?}` or the literal `false`.

### `RELEASING.md` — 102 lines

Carries all five required items: the three version floors in a table with the provenance of each
(pnpm ≥ 11.1.3 from the 11.1.3 release note / `pnpm/pnpm#11526`; npm ≥ 11.5.1 and Node ≥ 22.14.0 from
npm's trusted-publishing docs, with `npm/cli#8976` noted because this package is scoped); the npm-side
trusted-publisher binding (repo `fullselfbrowsing/concierge` + workflow `release.yml`); the
attestation check as an explicit human step with **"a successful publish without an attestation is a
FAILED publish"**; the statement that the workflow **has never been executed** and that its
verification to date is static review only, with the six properties enumerated; and a link to
`CONTRIBUTING.md § Changesets and the ignore list`.

### `CONTRIBUTING.md` and `pnpm-workspace.yaml`

Two new non-negotiables in the section's existing bold-claim-then-concrete-failure form, plus the
divergence note immediately after the bullets: **the test runner is centralized and the builder is
not**, because a misconfigured runner is loud (red suite, or a suite that visibly runs nothing) and a
misconfigured builder is silent (green build, dead reactivity).

Line 55 now reads `pnpm typecheck && pnpm build && pnpm test`, with the reason for the order attached.
The file's other sections are untouched.

`pnpm-workspace.yaml` gains a `catalog:` key with `svelte: ^5.0.0` and
`"@sveltejs/package": ^2.5.8`, and a 15-line comment naming the failure the pin serves. The
`packages:` list is byte-identical to what 02-08 left, including its 14-line comment. **No
`packages/concierge-svelte/` was created** — research's recommendation is options 1 and 2 (the
structural decision not to centralize, plus the pin), explicitly not option 3.

## Verification

All three `<verify><automated>` blocks were run **verbatim**, and re-run on the final tree after the
interruption.

| Block | Result |
|---|---|
| Task 1 | **`CI_STATIC_OK`**, exit 0 |
| Task 2 | **`RELEASE_STATIC_OK`**, exit 0 |
| Task 3 | **`TOOLCHAIN_DOC_OK`**, exit 0 |

Plan-level `<verification>` block, measured on the final tree:

| Check | Measured |
|---|---|
| two jobs, `typecheck` before `build`, quoted exact floor, zero pnpm in the floor job | **yes** — jobs `[build, node-floor]`; typecheck L75 < build L79; `'22.12.0'` loads as a string; floor-job non-comment `pnpm` count **0** |
| `.changeset/config.json` parses as strict JSON with `ignore: []` and `privatePackages: false` | **exit 0** on both `node -e` assertions |
| `changeset status` output names neither fixture | **0 matches**; exit 1, recorded not asserted |
| `release.yml` has `id-token: write` and `fetch-depth: 0`; no `--provenance` / `auth-token-line` on a non-comment line | **1 / 2 present**; **0 / 0** on non-comment lines |
| no `NPM_TOKEN` assignment or `secrets.NPM_TOKEN` under `.github/`, prohibition still present as a comment | assignment/reference count **0**; `grep -q 'NPM_TOKEN' release.yml` **succeeds** (2 comment lines) |
| `RELEASING.md` records the attestation check and that the workflow has never run | **yes**, `attestation` appears 2× |
| `CONTRIBUTING.md` carries both new non-negotiables and a true pre-push command | **yes** |
| `pnpm install --frozen-lockfile && pnpm typecheck && pnpm build && pnpm test` | **all exit 0** — 4 test files, 15 tests |

The six static release checks, recorded individually as the acceptance criteria require. **Every one
is an inspection or a `grep`. None of them is a run.**

| # | Static check | Measured |
|---|---|---|
| S1 | `permissions.id-token: write` present | **1 line** |
| S2 | no `NPM_TOKEN` assigned or referenced under `.github/` | **0** (`grep -rIh 'NPM_TOKEN' .github/ \| grep -v '^[[:space:]]*#' \| grep -cE 'NPM_TOKEN[[:space:]]*[:=]\|secrets\.NPM_TOKEN'`) |
| S3 | no `--provenance` on an executable line | **0** |
| S4 | no `auth-token-line` on an executable line | **0** |
| S5 | `fetch-depth: 0` present | **2 lines** (one executable, one in the comment explaining it) |
| S6 | `node-version: 24` | **1 line** |

Adjacent gates, re-run to confirm nothing regressed:

| Check | Result |
|---|---|
| `pnpm run check:artifact` (publint --strict + attw --profile esm-only) | **0** |
| `pnpm run check:deps` | **0** — "core's dependencies contribute zero bytes to a consumer bundle" |
| `pnpm build` | **0** — `dist/index.js` **9.74 kB**, `dist/index.d.ts` **77.26 kB**, unchanged |
| `pnpm typecheck` | **0** |
| `pnpm test` | **0** — 4 files, 15 tests |
| `git diff --exit-code pnpm-lock.yaml` | **0** — the catalog pins installed nothing |
| `packages/concierge/package.json` | **byte-unchanged**; `engines.node` still `">=22.12.0"` |

Acceptance-criteria spot checks:

| Criterion | Measured |
|---|---|
| non-comment `node-version:` lines in `ci.yml` | **exactly 2** — `24` and `'22.12.0'` |
| non-comment `pnpm` matches in `awk '/node-floor:/,0'` | **0** |
| standalone `#` comment lines in the floor job | **36**, covering all four mandated topics |
| trailing inline comments in `ci.yml` / `release.yml` | **0** / **0** |
| `grep -q "scripts/node-floor-check.sh" ci.yml` | **succeeds** |
| mutant **P4** named in `ci.yml` | **line 64** |
| root `scripts.release` | **`changeset publish`** |
| `packages/concierge-svelte/` | **absent** |
| `ci.yml` line count vs `min_lines: 40` | **175** |
| `release.yml` line count vs `min_lines: 25` | **109** |
| `RELEASING.md` line count vs `min_lines: 20` | **102** |

### Action versions used, recorded as RESEARCH assumption A3 asks

| Action | Pin | Used in |
|---|---|---|
| `actions/checkout` | `@v5` | ci.yml, release.yml |
| `actions/setup-node` | `@v5` | ci.yml (both jobs), release.yml |
| `actions/upload-artifact` | `@v4` | ci.yml build |
| `actions/download-artifact` | `@v4` | ci.yml node-floor |
| `pnpm/action-setup` | `@v4` | ci.yml build, release.yml |
| `changesets/action` | `@v1` | release.yml |

All pinned **by major tag, not by SHA** — registered as accepted threat T-02-54. **The workflow's
first real execution on GitHub is its first genuine test.** If that run reports an unresolvable
action, RESEARCH assumption A3 is what failed, not the repository.

## Deviations from Plan

### Additive, under Rule 2

**1. [Rule 2 - Correctness] `if-no-files-found: error` on the upload step.** Not specified by the
plan. Without it, a `pnpm pack` that silently produced no tarball uploads an empty artifact and the
floor job fails at `npm install ./*.tgz` with a glob error — a failure that reads like a packaging
defect rather than a missing input. One line, changes no mandated value.

**2. [Rule 2 - Correctness] The pnpm assertion is a major-version `case`, not string equality.** The
plan says "asserted to start with `11.`", which is what a `case "$(pnpm --version)" in 11.*)` does.
Recorded because the tempting stricter form — equality against `11.17.0` — would go red on a
legitimate `packageManager` patch bump while guarding nothing extra.

**3. [Additive] `changeset status --since=HEAD` was run as a control.** Not required. It is the only
invocation in this phase that exits 0, and it separates "the config is broken" from "there is an
unreleased change", which is the distinction the plan spends a paragraph protecting.

**4. [Additive] The `privatePackages` counterfactual was computed, not assumed.** The plan asks only
that `changeset status`'s output not name a fixture. That output names no package at all, so it
cannot distinguish a working setting from a broken one. The versionable-set computation against
changesets' own API supplies the missing evidence, without mutating the config.

### Recorded, not fixed

**5. 02-08's forward note is wrong about the changesets default, and this plan is where it shows.**
02-08 wrote that "changesets ignores `private: true` packages by default when `privatePackages` is
left at its default." Read from `@changesets/config@3.1.4`, the default is `{version: true, tag: false}`
— private packages **are** versioned by default. The conclusion 02-08 drew (set the flag explicitly)
was right; the stated reason was not. Corrected here rather than silently inherited, because "we set
it for tidiness" and "we set it because the default would publish our fixtures" lead to different
decisions the next time someone reviews the file.

**6. `scripts/node-floor-check.sh` was not edited.** Outside `files_modified`. Full treatment in
carry-forward item 4 above, including the exact remediation and the two caveats on it.

**7. `02-VALIDATION.md` was not edited.** Outside `files_modified`. Its `pnpm test -- <name>` rows
remain uncorrected; this plan fixed the CI half only. Owner remains 02-12.

### Interruption, recorded because the recovery matters

Execution was terminated by a transient `ConnectionRefused` between Task 3's file edits and its
commit. On resume the uncommitted diff was **re-read with `git diff` before committing**, rather than
assumed from memory, and the Task 3 verify block was re-run from scratch. No work was lost, no
mutation survived, and no blanket `git clean` / `git stash` / `git reset --hard` was used at any point
past the mandated worktree-base correction at agent start.

## Tree hygiene

`git status --porcelain` immediately before writing this SUMMARY is **empty** and `git diff` is clean.
This plan created no scratch directory, ran no `pnpm pack`, and downloaded no runtime — every
verification in it is a file read, a `grep`, a `JSON.parse`, a YAML load, or an existing root script.
The three `pnpm install --frozen-lockfile` runs (worktree bootstrap, post-`package.json`-edit
re-check, post-`catalog:` re-check) left `pnpm-lock.yaml` byte-unchanged.

No `git clean`, `git stash`, `git rm`, blanket checkout, or `git reset --hard` (past the mandated
worktree-base correction at agent start) was run. `git update-ref` was never invoked.

## Requirements status

`requirements-completed` is deliberately **empty** and `.planning/REQUIREMENTS.md` was **not
touched** — it is outside this plan's `files_modified`, this agent runs in a worktree, and 02-05
through 02-09 and 02-11 all set the same precedent.

This plan's frontmatter names `[PKG-01, PKG-02, PKG-03]`. What it actually contributes to each is
**enforcement**, not delivery — the artifacts were delivered in 02-03, 02-09 and 02-09 respectively,
and what was missing was anything making them run on every change:

| Requirement | Delivered by | What 02-10 adds |
|---|---|---|
| PKG-01 (type tests / typecheck gate) | 02-04, 02-11 | `typecheck` as its own required CI step, before `build`, with P4 and P8 named at the line |
| PKG-02 (pack-and-install) | 02-09 | `pnpm run check:pack` as a CI step in the build job |
| PKG-03 (the declared Node floor) | 02-09 | a CI job on a pinned, quoted, exact, asserted `22.12.0` with no pnpm in it |

02-09 already flagged PKG-02 and PKG-03 as ready to close, and 02-08 flagged PKG-04 and PKG-05. That
remains 02-12's to do. Flagged so the empty field is not read as an oversight.

## Issues Encountered

**1. `changeset status`'s error path names no packages**, so the plan's prescribed assertion — that
its output names neither fixture — is satisfied vacuously by an output that names nothing. Diagnosed
by reading `@changesets/cli@2.31.1`'s `status()` rather than by inference, and closed by computing the
versionable set directly. Recorded as deviation 4.

**2. 02-08's stated reason for `privatePackages: false` did not survive contact with the installed
package.** Recorded as deviation 5.

## Deferred Items

| Item | Detail | Suggested owner |
|---|---|---|
| **T-02-44 — checksum-verify the Node tarball** in `scripts/node-floor-check.sh` | Exact remediation recorded in carry-forward item 4, including the two caveats: the current `curl \| tar` pipe must materialise the `.tar.xz` first, and `SHASUMS256.txt` is itself unsigned-checked unless `SHASUMS256.txt.sig` is added. **Not escalated by this plan — CI never invokes the script.** | 02-12, or a post-v0.1 hardening plan |
| Correct `pnpm test -- <name>` in `02-VALIDATION.md` | Rows `02-07-T1`, `02-07-T2`, `02-07-T3`, `PKG-04a`. One character each. The CI half is fixed here; the doc half is not. | 02-12 |
| `mutate-and-prove.sh` should assert repo-root cleanliness | 02-08's carried item, untouched — `scripts/` is outside this plan. | 02-12 |
| Close PKG-01..PKG-05 in `REQUIREMENTS.md` | Flagged by 02-08 and 02-09; this plan adds the CI enforcement for PKG-01/02/03 and likewise did not touch the file. | 02-12 |
| Consider caching `$TMPDIR/node-v22.12.0` in CI | 02-09 raised this for 02-10 to decide. **Decided: not applicable.** CI gets its floor runtime from `actions/setup-node`, not from the script's 201 MB `$TMPDIR` cache, so there is nothing to cache. Recorded so the question is closed rather than dropped. | closed here |
| SHA-pin the third-party actions | T-02-54, accepted for v0.1. Revisit when the first real publish happens. | post-v0.1 |
| `/* @__PURE__ */` on `types.ts`'s three `Object.freeze` initializers | 02-06/02-07/02-08/02-09's carried item; `types.ts` is out of scope here. | a Phase 3 plan |

## Known Stubs

None. Every artifact in this plan is a configuration file whose properties were measured on disk after
writing: both workflows were **parsed with a real YAML loader** and their job graphs printed, not
eyeballed; `.changeset/config.json` was parsed with `JSON.parse`, its shape asserted, its `$schema`
pinned to the installed version, and its `privatePackages` value validated against that package's own
`schema.json`; and the setting it exists for was proven load-bearing by computing the counterfactual.
There is no placeholder value, no `TODO`, and no skipped step.

**One thing is genuinely unproven and is not a stub — it is the plan's stated limit.**
`.github/workflows/release.yml` **has never been executed**, because nothing publishes until v0.1
completes. Its verification here is static review of six named properties. That limit is written into
the workflow's own header, into `RELEASING.md`, and into this SUMMARY, and it is registered as
accepted threat T-02-53. `ci.yml` is in the same position for a different reason — it is committed but
has not yet run on GitHub — and its header says so.

## Threat Model Outcomes

| Threat | Disposition | Evidence |
|---|---|---|
| T-02-46 publish-token exfiltration from CI | **mitigated** | OIDC trusted publishing with `permissions.id-token: write`. Measured: **0** `NPM_TOKEN` assignments or `secrets.NPM_TOKEN` references on any non-comment line under `.github/`, while `grep -q 'NPM_TOKEN' release.yml` still succeeds against 2 comment lines. `RELEASING.md` requires the npm-side trusted publisher to bind repo + workflow file rather than a transferable secret. |
| T-02-47 silent provenance downgrade | **mitigated** | The failure is named in a standalone comment in `release.yml` as the only one in the set that produces a green build and a degraded artifact, and `RELEASING.md` makes the attestation check a human step on the first release and states that a publish without an attestation is a **failed** publish, with an incident procedure. No `--provenance` on any executable line — attestations are automatic for public repos on GH Actions. |
| T-02-48 dependency substitution at install time in CI | **mitigated** | `pnpm install --frozen-lockfile` in both workflows, plus a `pnpm --version` major assertion in `ci.yml` so the lockfile is read by the package manager that wrote it. |
| T-02-49 a type error reaching a published artifact | **mitigated** | `typecheck` is a separate required step at L75, **before** `build` at L79, with **P4** named in a comment as the reason and **P8** named as the reason it cannot be folded into `build` — `attw` and `publint` were both green on a build that had lost an export. `release.yml` holds the same order via `&&`. |
| T-02-50 a floor job silently running on a newer runtime | **mitigated** | `node-version: '22.12.0'` — quoted, and confirmed to load as the **string** `"22.12.0"` — plus an in-job `process.version` assertion that throws `floor drifted: <version>`, plus **0** non-comment `pnpm` matches from the `node-floor:` line to EOF. |
| T-02-51 a private fixture published by `changeset publish` | **mitigated, and proven** | `privatePackages: false` (normalized to `{tag:false,version:false}`) plus `private: true` on both fixtures. Versionable changed set measured as `["@fullselfbrowsing/concierge"]` with the setting and all three packages without it. `changeset status` names neither fixture. |
| T-02-52 `.changeset/config.json` written as JSONC | **mitigated** | Strict `JSON.parse` asserted, exit 0. The parser was confirmed by reading `@changesets/config`'s source (`fs.readJSON`, `changesets-config.cjs.js:139`). The explanatory prose was relocated to `CONTRIBUTING.md § Changesets and the ignore list` and linked from `RELEASING.md`. |
| T-02-53 claiming the release path is verified when it has never run | **accepted, and held** | Six static checks recorded individually above, each labelled an inspection or a grep. The "never executed" statement appears in `release.yml`'s header, in `RELEASING.md`, and in this SUMMARY. **No statement anywhere in this document implies the release workflow ran.** |
| T-02-54 third-party GitHub Actions in the publish path | **accepted** | Six actions pinned by major tag, inventoried above with the jobs that use them. SHA pinning deferred to the first real publish. |
| T-02-44 an unverified Node runtime download (inherited from 02-09) | **accepted, unchanged — and deliberately not escalated** | The escalation that would have forced re-dispositioning (running on every CI job) does not occur: `check:node-floor` is called by nothing under `.github/` (**0** non-comment matches). `scripts/node-floor-check.sh` is outside `files_modified` and was not edited. Remediation recorded verbatim above and flagged for 02-12; the gap is also named in a standalone comment in `ci.yml`. |
| T-02-SC npm/pnpm installs | **held** | This plan installs nothing. `git diff --exit-code pnpm-lock.yaml` exits 0 with the `catalog:` pins present — a catalog entry is a version declaration awaiting a dependent, and `pnpm install --frozen-lockfile` was re-run after adding it to confirm. No dependency was added to any manifest; `package.json` gained one `scripts` entry. |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: ci-identity | `.github/workflows/release.yml` | New trust boundary: publish authority crosses from a GitHub Actions runner to the npm registry via an OIDC token exchange. Already registered as T-02-46/T-02-47 and mitigated as recorded above. Flagged at the phase level because this is the highest-value target in the repository and it is created by this plan, on a workflow that **has never executed** — so every mitigation behind it is static review, not observed behaviour. |
| threat_flag: ci-network | `.github/workflows/ci.yml` | Both jobs reach the network: `pnpm install` and `npm install` to the npm registry, `actions/setup-node` to `nodejs.org` via the runner tool cache, and `pnpm run check:pack` installs into a throwaway directory. All are lockfile-pinned or throwaway, and no downloaded content is executed outside `node`/`tsc`/`npm` themselves. Recorded rather than left implicit because plan 02-09's `scripts/node-floor-check.sh` — which *does* execute an unverified download — is deliberately **not** among them. |

No new application endpoint, auth path, or schema at a trust boundary. Nothing in this plan is
consumer-facing: `.github/`, `.changeset/`, `RELEASING.md` and `CONTRIBUTING.md` are all outside
`packages/concierge`'s `files` array.

## User Setup Required

**One item, and it blocks the first publish only** — nothing in this phase, and no CI run, depends
on it.

Before the first real release, a maintainer must configure the trusted publisher on npmjs.com:
package settings → **Trusted publishers** → GitHub Actions, bound to repository
`fullselfbrowsing/concierge` and workflow file `release.yml`. The workflow cannot create this binding.
Full steps, and the confirmation that no `NPM_TOKEN` exists in any secret scope this workflow reads,
are in `RELEASING.md § One-time setup on the npm side`.

## Next Phase Readiness

1. **`typecheck` is its own required CI gate and must stay one.** Two independent mutants say so: P4
   (build green, typecheck red) and P8 (attw and publint green on a build that lost an export). Do not
   fold it into `build`.
2. **`ci.yml` uses bare `pnpm test`.** There is no `--` form on any executable line under `.github/`.
   The defect reproduced a fifth time on this tree: 1 file / 3 tests vs 4 files / 15 tests.
   `02-VALIDATION.md` still needs the same correction.
3. **The floor job and `scripts/node-floor-check.sh` are two implementations of one requirement, and
   neither calls the other.** The script is exercised only locally and at 02-12's phase gate, so it
   can rot without CI noticing. Both halves carry a comment pointing at the other.
4. **T-02-44 is still open and still accepted.** It was *not* escalated, because CI does not run the
   downloading script. The exact remediation, and the two caveats on it, are in this SUMMARY.
5. **`privatePackages: false` is load-bearing.** Deleting it does not restore a safe default — the
   changesets default versions private packages, and both fixtures would rejoin the release plan.
6. **`release.yml` has never run.** Treat the first release as its first test and work through
   `RELEASING.md` by hand, including the attestation check.
7. **Phase 9 must build `concierge-svelte` with `svelte-package`.** The pin is in
   `pnpm-workspace.yaml`'s `catalog:` and the rule is in `CONTRIBUTING.md § Non-negotiables`. Nothing
   is installed and no placeholder package exists, deliberately.

## Self-Check: PASSED

Files claimed created/modified, verified present on disk:

- `.github/workflows/ci.yml` — FOUND, **175 lines**; loads under `js-yaml` as exactly two jobs
  (`build`, `node-floor`) with `needs: build`; non-comment `node-version:` lines **2**; non-comment
  `pnpm` in the `node-floor:`-to-EOF range **0**; trailing inline comments **0**; contains
  `scripts/node-floor-check.sh` and `'22.12.0'`
- `.github/workflows/release.yml` — FOUND, **109 lines**; loads as one job with
  `permissions {contents: write, pull-requests: write, id-token: write}` and
  `checkout {fetch-depth: 0}`; `--provenance` / `auth-token-line` on non-comment lines **0 / 0**;
  `NPM_TOKEN` assignment or `secrets.` reference **0**, comment mentions **2**; trailing inline
  comments **0**
- `.changeset/config.json` — FOUND, **12 lines**; `JSON.parse` exit 0; `ignore` `[]`;
  `privatePackages` `false`
- `RELEASING.md` — FOUND, **102 lines**; `attestation` appears **2×**; states the workflow has never
  been executed
- `CONTRIBUTING.md` — FOUND, **81 lines**; contains `svelte-package`, `not centralized`, and
  `pnpm typecheck && pnpm build && pnpm test`
- `pnpm-workspace.yaml` — FOUND, **37 lines**; `catalog:` with `svelte: ^5.0.0` and
  `"@sveltejs/package": ^2.5.8`; `packages:` list byte-identical to 02-08's, including its comment
- `package.json` — FOUND; `scripts.release` is `changeset publish`; no dependency added
- `packages/concierge-svelte/` — **correctly ABSENT**
- `.planning/phases/02-packaging-build-and-release/02-10-SUMMARY.md` — FOUND

Commits claimed, verified in `git log`:

- `d7adbd1` — FOUND (`ci(02-10): typecheck-first build job and a pnpm-free Node floor job`)
- `fa2fc3d` — FOUND (`ci(02-10): changesets config, the OIDC release workflow, and RELEASING.md`)
- `e82ad1d` — FOUND (`docs(02-10): the two build toolchains as invariants, and a pin for the second`)

`git diff --name-status eea66f2..HEAD` lists **exactly seven** paths before this SUMMARY commit, all
inside this plan's declared `files_modified`. No file under `scripts/`, `packages/concierge/src/`,
`packages/concierge/test/`, no `pnpm-lock.yaml`, no `packages/concierge/package.json`, and no
`STATE.md`, `ROADMAP.md` or `REQUIREMENTS.md` appears — the last three are the orchestrator's to
write. No commit in this plan contains a deletion.

---
*Phase: 02-packaging-build-and-release*
*Completed: 2026-07-29*
