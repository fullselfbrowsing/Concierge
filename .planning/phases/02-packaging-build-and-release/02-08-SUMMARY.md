---
phase: 02-packaging-build-and-release
plan: 08
subsystem: packaging
tags: [pkg-04, peer-dependencies, workspace-glob, pnpm, realpath, install-graph, fixtures, mutation-testing]

# Dependency graph
requires:
  - phase: 02-packaging-build-and-release
    plan: "02-06"
    provides: "CONTRACT_VERSION and assertSingleInstance — the two names the fixtures re-export"
  - phase: 02-packaging-build-and-release
    plan: "02-07"
    provides: "vitest.config.ts, the root `vitest run` test script, and the include glob that already covers this file"
provides:
  - "pnpm-workspace.yaml extended with packages/concierge/test/fixtures/* — the fixtures are genuine workspace members"
  - "@fullselfbrowsing/concierge-fixture-alpha and -beta — two private adapters declaring core as a peerDependency"
  - "packages/concierge/test/fixtures.test.ts — F3a/F3b/F3c, the packaging half of PKG-04"
  - "The measured three-installer peer-range table recorded beside the assertion rather than assumed away"
  - "A proven gate: F3a observed failing under the exact peer -> dependency regression it exists to catch"
  - "A measured defect in scripts/mutate-and-prove.sh: its restore covers only its target file"
affects:
  - "02-10 — .changeset/config.json must ignore both fixture package names"
  - "02-12 — PKG-04 is now complete in all clauses; the `--` correction reproduces on a fourth file"
  - "Phase 9 — this file stays meaningful when real adapters replace the fixtures"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Workspace globs are one level deep; a nested fixture package needs its own glob entry or it is silently not a workspace member"
    - "Three-way realpath equality, never pairwise — two links agreeing with each other can both be wrong"
    - "Identity (toBe) not deep equality (toEqual) when the claim is one instance rather than two equal ones"
    - "Assert a manifest invariant in the test file, not only in the plan's one-shot verify block, so it survives the plan that created it"
    - "Every comment is a standalone // or /** */ line — a trailing comment survives `grep -v '^[[:space:]]*[/*]'` and turns a compliant file red"

key-files:
  created:
    - packages/concierge/test/fixtures/adapter-alpha/package.json
    - packages/concierge/test/fixtures/adapter-alpha/index.js
    - packages/concierge/test/fixtures/adapter-beta/package.json
    - packages/concierge/test/fixtures/adapter-beta/index.js
    - packages/concierge/test/fixtures.test.ts
  modified:
    - pnpm-workspace.yaml
    - pnpm-lock.yaml

key-decisions:
  - "Open Question 4 resolved in favour of real workspace packages over temp-directory synthesis — synthesis re-runs pnpm install inside a test and produces an install graph that is not the one that ships"
  - "The `private: true` check was written into the test file as well as the verify block, so T-02-37's mitigation outlives this plan"
  - "F3a fires on the manifest and deliberately needs no reinstall — the regression is a declaration, and reading it from disk is the cheapest true observation of it"
  - "The lockfile collateral damage from the mutant proof was restored with a file-scoped `git checkout --`, never a blanket reset or clean"

patterns-established:
  - "When a mutation's gate command can trigger a `pnpm install`, the lockfile changes OUTSIDE mutate-and-prove.sh's trap — assert `git status --porcelain` at the repo root after the harness, not just its PASS line"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-07-29
tasks: 2
commits: 2
files_changed: 7
---

# Phase 2 Plan 08: The install graph made real Summary

**Two private workspace adapters now declare core as a `peerDependency` and are proven to resolve to
one physical directory and one function object — the packaging half of PKG-04 that no runtime
assertion can see — with the peer range's measured three-installer weakness written beside the
assertion instead of assumed away, and F3a observed failing under the exact peer-to-dependency edit
it exists to catch.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2
- **Files changed:** 7 (5 created, 2 modified)

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Two private fixture adapters as real workspace members | `3f74ca9` | `pnpm-workspace.yaml`, `pnpm-lock.yaml`, both fixtures' `package.json` + `index.js` |
| 2 | One physical core across two peer-declaring adapters | `f0b7e5d` | `packages/concierge/test/fixtures.test.ts` |

Net diff against the wave-5 base (`71d680b`): `M pnpm-workspace.yaml`, `M pnpm-lock.yaml`, and five
`A` entries. Nothing else. `packages/concierge/package.json`, `tsconfig.json`,
`tsconfig.test-d.json`, `vitest.config.ts`, root `package.json` and all of `packages/concierge/src/`
are byte-unchanged. No commit in this plan contains a deletion.

## The trap the plan was written to avoid, and the measurement that it was real

`pnpm-workspace.yaml` globbed `packages/*`, which matches **one level only**.
`packages/concierge/test/fixtures/adapter-alpha/` is three levels deeper and was **not** matched.
This was not a theoretical hazard — it is directly observable in pnpm's own scope line:

| | `packages` entries | pnpm's scope line |
|---|---|---|
| base commit `71d680b` | 2 | `Scope: all 2 workspace projects` |
| after the glob entry | 3 | `Scope: all 4 workspace projects` |

Without the third entry both fixtures would have been invisible to pnpm, neither would have received
a `node_modules` link, and F3b would have thrown `ENOENT` rather than silently passing. That last
point is worth stating precisely, because "the assertion would silently test nothing" is the usual
shape of this failure and is **not** what happens here: `realpathSync` on a missing link throws
`ENOENT`, verified directly. The guard fails loudly in the vacuous case. The glob entry is still
required — a red suite is not a working one.

## What shipped

### The two fixtures

`@fullselfbrowsing/concierge-fixture-alpha` and `@fullselfbrowsing/concierge-fixture-beta`, at
`packages/concierge/test/fixtures/adapter-{alpha,beta}/`. Eight lines of `package.json` each, matching
`02-PATTERNS.md:593-602` exactly, plus a two-line `index.js`:

```json
{
  "name": "@fullselfbrowsing/concierge-fixture-alpha",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "peerDependencies": { "@fullselfbrowsing/concierge": "workspace:^" },
  "devDependencies": { "@fullselfbrowsing/concierge": "workspace:*" }
}
```

The peer/dev pair is the point: the peer range is what a real adapter declares, and the `workspace:*`
devDependency is what makes pnpm actually create the link so the peer resolves. Neither fixture
declares a `build`, `test` or `typecheck` script, neither declares a `dependencies` block at all, and
`index.js` is plain JavaScript so that neither file enters any tsconfig program.

`index.js`, both identical:

```js
// Exists so the fixture resolves core by bare specifier, the way a real adapter does.
export { assertSingleInstance, CONTRACT_VERSION } from "@fullselfbrowsing/concierge";
```

### The lockfile diff is 12 lines and adds no registry package

```
+  packages/concierge/test/fixtures/adapter-alpha:
+    devDependencies:
+      '@fullselfbrowsing/concierge':
+        specifier: workspace:*
+        version: link:../../..
```

Two importers, both `link:../../..`, and the `+12/-0` diff contains nothing else.
`lockfileVersion: '9.0'` is unchanged. This is the evidence for T-02-SC: the install added workspace
links and no network resolution.

**One consequence of that diff is load-bearing and is recorded in the test file's header.** Only the
`workspace:*` **devDependency** appears in the lockfile — the peer declaration leaves no distinct
lockfile trace at all. So a peer-to-dependency move would not show up in `pnpm-lock.yaml` either, and
**F3a is the only thing in this repository that catches it.**

### `fixtures.test.ts` — 195 lines, three assertions

| Assertion | Claim | Mechanism |
|---|---|---|
| **F3a** | core is declared as a peer, not a dependency, in both fixtures — and both are `private` | reads both manifests from disk |
| **F3b** | one physical copy | three-way `realpathSync` equality |
| **F3c** | one function object | dynamic import of both `index.js`, `toBe` identity |

F3b is **three-way, not pairwise**: alpha's link, beta's link, **and** `packages/concierge` itself.
Two links that agree with each other while resolving somewhere other than the package under test
would satisfy `alpha === beta` and prove nothing. All three resolve to the same absolute path.

F3c is the **positive control** to F1a's deliberate `?dup=1` negative. F1a forces two module
evaluations to prove the same-version branch *adopts*; F3c asserts that ordinary use never produces
the second evaluation in the first place, so that branch does not fire spuriously. It uses `toBe`
rather than `toEqual` deliberately: two installed copies of core would produce two structurally
identical functions and two equal integers, and `toEqual` cannot tell that apart from one shared
instance.

## The honest limitation, recorded beside the assertion

The header carries the measured table, because CONTEXT.md's claim that "a peer range makes a version
mismatch a loud install-time error" is true for exactly one of three installers:

| Installer | Behaviour | Exit |
|---|---|---|
| `npm install` (default) | hard `ERESOLVE` | non-zero |
| `pnpm add` (default) | prints `✕ unmet peer …` and installs anyway | **0** |
| `npm install --legacy-peer-deps` | silent | **0** |

**The conclusion the register turns on: the runtime `CONTRACT_VERSION` check is PKG-04's primary
enforcement, not its backstop.** Two of the three installers exit 0 while producing precisely the
duplicate the peer range is imagined to prevent. The peer range is kept because it catches the
npm-default majority at install time and because it is the declaration that decides whether one copy
or two are installed at all — which is the half this file guards.

The header also records what the file does **not** prove, in the style of `consent.test-d.ts:150-168`:

1. **Nothing about a published install graph.** All three resolutions go through pnpm workspace
   symlinks; the lockfile says `link:../../..`, not a resolved registry tarball. The published-install
   evidence lives in **plan 02-09's pack-and-install harness** and **plan 02-10's Node-floor CI job**,
   both named in the file.
2. **Nothing about peer-*range* enforcement** — only that a range is declared.
3. **The lockfile is not a second witness**, for the reason given above.

## The gate was proven to fire — T-02-35, exactly

Not required by the plan, but the phase's whole ethos is that an exit code never observed non-zero is
indistinguishable from an absent check. The mutation is the literal regression the file exists to
catch: core moved from `peerDependencies` to `dependencies` in adapter-alpha.

```
bash scripts/mutate-and-prove.sh \
  packages/concierge/test/fixtures/adapter-alpha/package.json \
  '"peerDependencies": { "@fullselfbrowsing/concierge": "workspace:^" },' \
  '"dependencies": { "@fullselfbrowsing/concierge": "workspace:^" },' \
  -- bash -c 'pnpm test fixtures'
```

| | |
|---|---|
| harness stdout | `PASS: gate fired (exit 1), tree clean` |
| harness exit | **0** |
| suite result | `Test Files 1 failed (1)` — `Tests 1 failed | 2 passed (3)` |
| failing test | **F3a** |
| assertion message | `AssertionError: adapter-alpha: expected undefined to be defined` at `fixtures.test.ts:148:61` |

F3b and F3c passed under the mutant, which is correct and worth stating: the `node_modules` link is
unchanged by a manifest edit alone, so the *physical* graph is still single-copy at that instant. The
regression is a **declaration** that would produce two copies on the next clean install elsewhere.
That is exactly why F3a reads the manifest instead of inferring intent from the resolved graph — and
exactly why no runtime assertion can see it.

## Deviations from Plan

### Auto-fixed / recorded issues

**1. [Rule 1 - Bug] `scripts/mutate-and-prove.sh` reports "tree clean" while the repository is
dirty, when the gate command triggers a `pnpm install`.**

- **Found during:** the T-02-35 mutant proof above.
- **Issue:** the harness's `trap` restores **its target file** and verifies that one file. pnpm 11
  auto-installs before running a script when a workspace manifest has changed, so `pnpm test fixtures`
  re-resolved the mutated manifest and rewrote `pnpm-lock.yaml` — moving adapter-alpha's entry from
  `devDependencies`/`workspace:*` to `dependencies`/`workspace:^`. The harness printed
  `PASS: gate fired (exit 1), tree clean` with `pnpm-lock.yaml` modified.
- **Why it had not surfaced before:** every prior mutant in this phase (P1–P4, P6, P7, P11) targeted a
  `.ts` source file or `package.json` *scripts*, none of which causes pnpm to re-resolve the workspace.
  This is the first mutation in the phase to touch a **dependency manifest**, and therefore the first
  able to expose the gap.
- **Fix applied:** `git checkout -- pnpm-lock.yaml` — file-scoped, never a blanket reset, `git clean`
  or `git stash` — followed by `CI=true pnpm install --frozen-lockfile` to resync `node_modules`, then
  `git status --porcelain` asserted empty. The final tree is clean and the lockfile is byte-identical
  to what commit `3f74ca9` recorded.
- **Not fixed in the harness:** `scripts/` is owned by plan 02-09 in this same wave and is outside
  this plan's `files_modified`. Filed under Deferred Items with the exact remedy.
- **Transferable rule:** after any `mutate-and-prove.sh` invocation whose gate can install, assert
  `git status --porcelain` at the **repo root**, not merely the harness's PASS line.

**2. [Recorded, not fixed] `pnpm test -- fixtures` does not filter — 02-07's finding reproduces on a
fourth file.**

The plan's Task 2 `<verify>` block is `pnpm build && pnpm test -- fixtures`. It was run verbatim and
exits 0, but it runs the **whole** suite. Measured on the final tree:

| Command | Test files run | Tests run |
|---|---|---|
| `pnpm test fixtures` | **1** | **3** |
| `pnpm test -- fixtures` | **4** | **15** |

The gate still fires (any failure anywhere makes the run non-zero), so nothing in this plan is
invalidated; what is lost is specificity. Both forms were run for every gate here, and the mutant
proof above deliberately used the **correct** form, which is why it reports one failing file rather
than a suite-wide spray. No code change: `scripts.test` must remain exactly `vitest run`, and
`02-VALIDATION.md` is outside this plan's `files_modified`. Already owned by 02-12.

### Strengthened beyond the letter, recorded rather than filed as a deviation

The plan specified three assertions and asserted `private: true` only in Task 1's one-shot `<verify>`
block. The `private` check was **also** written into F3a. T-02-37's mitigation reads "Both are
`private: true`, asserted" — a verify block asserts it once, at the moment of creation; a test
asserts it on every CI run forever. This adds no fourth `it` block and changes no artifact the plan
specified. Applied under Rule 2 (a publishable fixture is a supply-chain hazard, not a fixture).

Nothing else deviated. Two tasks, seven files, the prescribed manifest shape, the prescribed glob
comment, the prescribed header prose.

## Forward dependency for plan 02-10 — the explicit record the plan asked for

Two **private** packages now exist in the workspace. `.changeset/config.json` must keep changesets
from trying to version or publish them. The two names it has to account for are:

- `@fullselfbrowsing/concierge-fixture-alpha`
- `@fullselfbrowsing/concierge-fixture-beta`

Changesets ignores `private: true` packages by default when `privatePackages` is left at its default,
but the setting is a config knob and this phase's habit is to write the invariant down rather than
inherit it. Both names are asserted `private: true` by F3a on every run, so a regression on the
manifest side is caught here; the changesets side is 02-10's.

## Verification

Both `<verify><automated>` blocks were run verbatim.

| Block | Result |
|---|---|
| Task 1 — `pnpm install && test -e …alpha… && test -e …beta… && pnpm build && pnpm typecheck && pnpm test && node -e …` | **`FIXTURES_LINKED`**, exit 0 |
| Task 2 — `pnpm build && pnpm test -- fixtures` | **`FIXTURES_TEST_OK`**, exit 0 |

Plan-level `<verification>` block on the final tree:

| Check | Result |
|---|---|
| `pnpm-workspace.yaml` matches the fixtures; both `node_modules` links exist | **yes** / **yes**, both |
| `pnpm test -- fixtures` exits 0 with all three assertions | **0** (4 files, 15 tests — see deviation 2) |
| `pnpm test fixtures` | **0** (1 file, **3 tests**) |
| `pnpm install --frozen-lockfile` | **0** |
| `pnpm build` (attw + publint clean) | **0** |
| `pnpm typecheck` | **0** |
| `pnpm test` (whole suite) | **0** — 4 files, **15 tests** (12 -> 15) |
| packed tarball contains no `test/` or `fixtures` path | **0 matches**, 10 entries |
| `git status --porcelain` | **empty** |

Acceptance-criteria spot checks:

| Criterion | Measured |
|---|---|
| `packages` includes the fixtures glob alongside the two existing entries, with a comment | **yes**, 3 entries, 14 comment lines |
| both fixtures `private: true`, `type: "module"`, peer + dev entries for core | **yes**, both |
| neither fixture declares `build`, `test` or `typecheck` | `scripts` is **absent** in both |
| neither fixture declares a `dependencies` block | **absent** in both |
| three-way realpath equality | alpha === beta === `packages/concierge` |
| `git diff --exit-code packages/concierge/package.json` | **0** |
| `git diff --exit-code packages/concierge/tsconfig.test-d.json` | **0** |
| executable lines referencing `../src/` (`grep -v '^[[:space:]]*[/*]' \| grep -c`) | **0** (1 mention, in the header) |
| trailing inline comments on code lines | **none** |
| `realpath` occurrences in `fixtures.test.ts` | **4** |
| `fixtures.test.ts` line count vs `min_lines: 30` | **195** |
| `pnpm -r build` / `pnpm -r typecheck` with fixtures present | **0** / **0**, `Scope: 3 of 4` — script-less fixtures skipped, not failed |
| `dist/index.js` | **9,739 B**, unchanged from 02-06 — this plan added no source code |

## Tree hygiene

`git status --porcelain` immediately before writing this SUMMARY is **empty** and `git diff` is clean.
Both `pnpm pack` runs wrote into a `mktemp -d` under `TMPDIR` — outside the repo, and deliberately
outside `packages/`, which the workspace glob would swallow — and were `rm -rf`'d in the same Bash
call. No `.tgz` remains anywhere in the worktree and no `concierge-*` temp directory remains under
`TMPDIR`.

No `git clean`, `git reset --hard` (past the mandated worktree-base correction at agent start),
`git stash`, or blanket checkout was run at any point. The one file-scoped restore was
`git checkout -- pnpm-lock.yaml`, documented as deviation 1. Installs were `pnpm install` (twice, to
create and confirm the links) and `CI=true pnpm install --frozen-lockfile` (to assert the committed
lockfile matches); the lockfile's only net change is the 12-line, two-importer diff committed in
`3f74ca9`.

## Requirements status

`requirements-completed` is deliberately **empty** and `.planning/REQUIREMENTS.md` was not touched,
following 02-05, 02-06 and 02-07's precedent — and because this worktree agent is explicitly
forbidden from writing shared tracking artifacts.

**PKG-04 is now complete in all clauses, and this is the plan that completes it.** It reads *"The
package publishes ESM-only, and a test asserts a single core instance is shared across adapters."*

| Clause | Delivered by | Evidence |
|---|---|---|
| publishes ESM-only | 02-03 | attw `--profile esm-only` clean; publint strict clean |
| a test asserts a single core instance | 02-07 | F1a, F1b, F2 against `dist/index.js` |
| **…across adapters** | **02-08** | **F3a/F3b/F3c across two peer-declaring workspace adapters** |

02-07 recorded that the words "across adapters" were "still literally unmet: there are no adapters."
There are now two. **PKG-04 and PKG-05 are both ready to close**, and the orchestrator or 02-12 should
close them. Flagged so the empty field is not read as an oversight.

## Issues Encountered

**1. The harness reported a clean tree while `pnpm-lock.yaml` was dirty.** Diagnosed rather than
assumed — the cause is pnpm 11 auto-installing before a script run when a workspace manifest changed,
which happens outside the harness's `trap`. Restored file-scoped, resynced, re-asserted. Full
treatment as deviation 1, remedy filed below.

**2. `pnpm test -- fixtures` runs the whole suite.** 02-07's finding, reproduced on a fourth file and
re-measured. Recorded as deviation 2; already owned by 02-10 and 02-12.

## Deferred Items

| Item | Detail | Suggested owner |
|---|---|---|
| `mutate-and-prove.sh` should assert repo-root cleanliness, not just its target | Its `trap` restores one file and its PASS line claims "tree clean". A gate that triggers `pnpm install` dirties `pnpm-lock.yaml` outside that scope. Remedy: capture `git status --porcelain` before the mutation and compare after the restore, downgrading the PASS line to a distinct code if they differ. Note the published exit-code table is a contract that says "do not add a sixth code", so this is a wording/precondition change rather than a new code. | 02-09 (owns `scripts/`) or 02-12 |
| `.changeset/config.json` must ignore both fixture package names | Named in full above. | 02-10 |
| Correct `pnpm test -- <name>` in `02-VALIDATION.md` | 02-07's deferred item, unchanged; the `PKG-04c` row names `pnpm test -- fixtures`, whose filter is silently discarded. | 02-12 |
| `packages/concierge/test/**` is in no TypeScript program | Inherited and accepted, with three named reasons in `vitest.config.ts`. `fixtures.test.ts` joins the other three under that limitation; a type error in it surfaces only under `vitest run`. Not restated here — see 02-07's record. | not scheduled — accepted |
| `/* @__PURE__ */` on `types.ts`'s three `Object.freeze` initializers | 02-06's and 02-07's deferred item, untouched by this plan. | 02-11 or a Phase 3 plan that opens `types.ts` |

## Known Stubs

None. All three assertions run against real on-disk artifacts — two manifests, three resolved
filesystem paths, and two dynamically imported modules — and F3a was observed failing under a
deliberate regression. There is no placeholder value, no hardcoded empty return, no skipped test, and
no `TODO` in any of the five created files. Both `index.js` files are two lines by design, not as
placeholders: their entire job is to make the fixture resolve core by bare specifier the way a real
adapter does.

## Threat Model Outcomes

| Threat | Disposition | Evidence |
|---|---|---|
| T-02-35 core moved from `peerDependencies` to `dependencies` in an adapter | **mitigated, and proven** | F3a reads both manifests and asserts the peer entry present and the `dependencies` entry absent. Observed failing under exactly that edit via `mutate-and-prove.sh`: `expected undefined to be defined`, harness exit 0. Also established that the lockfile carries no trace of the peer declaration, so F3a is the **only** thing in the repository that catches this. |
| T-02-36 a fixture silently outside the workspace, making the guard vacuous | **mitigated** | The glob is extended with a 14-line comment naming the one-level limitation. Task 1 asserted both `node_modules` links exist before Task 2 asserted anything about them. Independently: pnpm's scope line moved from `all 2 workspace projects` to `all 4`, and `realpathSync` on a missing link throws `ENOENT` rather than returning something comparable — so the vacuous case is red, not green. |
| T-02-37 a fixture package accidentally published to npm | **mitigated** | Both are `private: true`, asserted in Task 1's verify block **and** persistently in F3a. Both names are recorded above for 02-10's changesets config. |
| T-02-38 fixture sources escaping into the published tarball | **mitigated** | Re-packed after the fixtures existed: 10 entries, `0` matching `test` or `fixtures`. `files` still lists only `dist`, `src`, `README.md`, `LICENSE`, and `packages/concierge/package.json` is byte-unchanged. |
| T-02-39 over-claiming what a workspace-symlink test proves | **mitigated** | The header states that all three resolutions go through pnpm workspace symlinks, that the lockfile records `link:../../..` rather than a registry tarball, and names 02-09 and 02-10 as where the published-install evidence actually lives. It further records that peer-*range* enforcement is not asserted at all, with the measured three-installer table. |
| T-02-SC npm/pnpm installs | **accepted, and held** | The install added only workspace links: a `+12/-0` lockfile diff, two importers, both `link:../../..`, no registry package and no new resolution. `pnpm install --frozen-lockfile` asserted green afterwards, and `check:deps` still reports zero dependency bytes. |

## Threat Flags

None. This plan adds no network endpoint, no auth path, and no schema at a trust boundary. It adds
file reads (two `package.json` files, three directory realpaths, two `index.js` modules), all inside
the repository's own tree, all in test-only code that is not published — `packages/concierge`'s
`files` array lists `dist`, `src`, `README.md` and `LICENSE`, and the re-packed tarball was verified
to contain no `test/` path.

It does add two new **workspace members**, which is a publish-surface change in principle. That is
precisely T-02-37, addressed above and forwarded to 02-10.

## User Setup Required

None.

## Next Phase Readiness

1. **PKG-04 is complete in all three clauses.** The "across adapters" clause that 02-07 correctly
   refused to claim is now met by two real workspace adapters. PKG-04 and PKG-05 are both ready to
   close in `REQUIREMENTS.md`, which this worktree agent deliberately did not touch.
2. **02-10 must keep changesets away from `@fullselfbrowsing/concierge-fixture-alpha` and
   `@fullselfbrowsing/concierge-fixture-beta`.** Both names are in the § Forward dependency section.
3. **The workspace is now 4 projects, not 2.** `pnpm -r <script>` reports `Scope: 3 of 4` and skips
   the two script-less fixtures rather than failing. Any future plan adding a root-level `pnpm -r`
   script must not assume every workspace member can run it.
4. **After any `mutate-and-prove.sh` run whose gate can install, check `git status --porcelain` at the
   repo root.** The harness's "tree clean" covers its target file only. This is the single most
   transferable finding in this plan.
5. **Use `pnpm test fixtures`, never `pnpm test -- fixtures`.** 02-07's finding, reproduced on a
   fourth file: 1 file / 3 tests versus 4 files / 15 tests.
6. **The suite is now 4 files and 15 tests**, up from 3 and 12. `dist/index.js` is **9,739 B**,
   unchanged — this plan added no source code and no dependency edge.

## Self-Check: PASSED

Files claimed created/modified, verified present on disk:

- `pnpm-workspace.yaml` — FOUND, 3 `packages` entries including
  `"packages/concierge/test/fixtures/*"`, with a 14-line explanatory comment block
- `pnpm-lock.yaml` — FOUND, `lockfileVersion: '9.0'`, two new importers, both `link:../../..`
- `packages/concierge/test/fixtures/adapter-alpha/package.json` — FOUND, 8 lines, `private: true`,
  peer `workspace:^`, dev `workspace:*`, no `scripts`, no `dependencies`
- `packages/concierge/test/fixtures/adapter-alpha/index.js` — FOUND, 2 lines
- `packages/concierge/test/fixtures/adapter-beta/package.json` — FOUND, 8 lines, same shape
- `packages/concierge/test/fixtures/adapter-beta/index.js` — FOUND, 2 lines
- `packages/concierge/test/fixtures.test.ts` — FOUND, 195 lines; `realpath` 4 times; 0 executable
  references to `../src/`; no trailing inline comments
- `.planning/phases/02-packaging-build-and-release/02-08-SUMMARY.md` — FOUND

Commits claimed, verified in `git log`:

- `3f74ca9` — FOUND (`test(02-08): two private fixture adapters as real workspace members`)
- `f0b7e5d` — FOUND (`test(02-08): one physical core across two peer-declaring adapters`)

`git diff --name-status 71d680b..HEAD` lists **exactly seven** files before this SUMMARY commit —
`M pnpm-workspace.yaml`, `M pnpm-lock.yaml`, and the five new fixture/test files — all inside this
plan's declared `files_modified`. No `packages/concierge/package.json`, no file under
`packages/concierge/src/`, no `vitest.config.ts`, no root `package.json`, no `scripts/`, no
`packages/concierge/test-d/`, and no `STATE.md`, `ROADMAP.md` or `REQUIREMENTS.md` appears — the last
three are the orchestrator's to write. No commit in this plan contains a deletion
(`git diff --diff-filter=D` empty across the range).

---
*Phase: 02-packaging-build-and-release*
*Completed: 2026-07-29*
