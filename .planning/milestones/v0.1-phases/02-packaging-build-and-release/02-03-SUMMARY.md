---
phase: 02-packaging-build-and-release
plan: 03
subsystem: build
tags: [packaging, tsdown, esm-only, attw, publint, sourcemaps, data-protection]
requires:
  - "02-01 — tsdown 0.22.14, publint 0.3.22, @arethetypeswrong/cli 0.18.5 installed as root devDependencies"
  - "02-01 — packages/concierge/LICENSE, so pnpm pack and npm pack agree"
  - "02-02 — scripts/mutate-and-prove.sh, used for both defect-first proofs here"
provides:
  - "`pnpm build` exits 0 and emits an ESM-only artifact (was ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT)"
  - "publint and attw wired as build-FAILING gates at level error, attw at profile esm-only"
  - "root `check:artifact` — both gates standalone against the packed tarball"
  - "declaration maps that resolve inside the published tarball (src is published)"
  - "export-surface baseline: 43 names in one trailing export block of dist/index.d.ts"
affects:
  - "02-04 — mutants P1/P2/P3/P4 run against the gates this plan created"
  - "02-06 — changes the export surface when contract.ts lands; 43 is the pre-contract baseline"
  - "02-07 — asserts against the 43-name baseline; one export block, so no union needed"
  - "02-10 — CI runs `pnpm typecheck` before `pnpm build`, and `check:artifact` after"
tech-stack:
  added: []
  patterns:
    - "Package-local build config; root scripts stay `pnpm -r build` so each package declares its own builder"
    - "Every non-obvious config line carries a standalone comment naming the failure mode it prevents"
    - "Gate levels stated explicitly rather than inherited, so an upstream default change cannot silently downgrade a gate to a report"
key-files:
  created:
    - packages/concierge/tsdown.config.ts
  modified:
    - packages/concierge/package.json
    - package.json
decisions:
  - "Sourcemaps: option (a) — publish src/ so declaration maps resolve; accepted that serverChallengeBrand and ConsentAckBase ship as readable source text"
  - "attw configured as { level: \"error\", profile: \"esm-only\" }; attw: true is a report that exits 0, not a gate"
  - "No package-level `test` script, here or later in this phase — a deliberate divergence from 02-RESEARCH.md:786-798"
  - "publint's level stated explicitly even though its default already fails, so the gate cannot be downgraded by an upstream default change"
metrics:
  duration: "~20 min"
  completed: 2026-07-28
  tasks: 3
  commits: 3
  files_changed: 3
---

# Phase 2 Plan 03: Build, ESM-only, and the two artifact gates — Summary

`pnpm build` now exits 0 through tsdown with `publint` and `attw` wired so they can actually fail —
`attw` at `level: "error"` because `attw: true` is a report that exits 0, and at
`profile: "esm-only"` because the default profile fails a correct ESM-only package. The sourcemap
disposition was taken as a decision (publish `src/`) rather than inherited from
`tsconfig.base.json`, and both gates can now be run standalone against the packed tarball by
`pnpm run check:artifact`.

## What Shipped

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | tsdown.config.ts with both gates at level error, plus the `build` script | `7df01b4` | `packages/concierge/tsdown.config.ts`, `packages/concierge/package.json` |
| 2 | Sourcemap decision — publish `src` so declaration maps resolve | `19d9fa2` | `packages/concierge/package.json` |
| 3 | `check:artifact` — both gates, standalone, against the tarball | `c827be5` | `package.json` |

Net diff against the wave-1 base (`d8891d5`): 3 files, 53 insertions, 1 deletion. `pnpm-lock.yaml`
is byte-unchanged — this plan installed nothing.

## Task 1 — the build

### Recorded build facts

`pnpm build` at the end of the plan, verbatim:

```
ℹ tsdown v0.22.14 powered by rolldown v1.2.0
ℹ config file: packages/concierge/tsdown.config.ts
ℹ entry: src/index.ts
ℹ target: node22.12.0
ℹ tsconfig: tsconfig.json
ℹ dist/index.js         2.96 kB │ gzip:  1.38 kB
ℹ dist/index.js.map    78.72 kB │ gzip: 26.80 kB
ℹ dist/index.d.ts.map   3.12 kB │ gzip:  1.02 kB
ℹ dist/index.d.ts      71.68 kB │ gzip: 25.11 kB
ℹ 4 files, total: 156.48 kB
✔ Build complete in 417ms
✔ [attw] No problems found (251ms)
✔ [publint] No issues found (262ms)
```

| Emitted file | Bytes |
|---|---|
| `dist/index.js` | 2,961 |
| `dist/index.js.map` | 78,718 |
| `dist/index.d.ts` | 71,684 |
| `dist/index.d.ts.map` | 3,116 |

- **`target: node22.12.0`** — auto-derived from `engines.node`, as research predicted. No `target`
  is set in the config.
- **Build duration: 417 ms cold** (first run in a fresh worktree, dts included); **43–89 ms warm**
  on subsequent runs. Research measured 35 ms against a smaller `types.ts`.
- **`tsconfig: tsconfig.json`** — tsdown picked the package's own build program without being told,
  so no `tsconfig` option was added.
- No `.cjs`, `.mjs` or `.d.cts` file is emitted. `dist/` holds exactly four files.

### Sizes are larger than research measured, and that is expected

Research recorded `index.js 1.03 kB` / `index.d.ts 52.71 kB` on 2026-07-27. The measured values are
2.96 kB and 71.68 kB. `types.ts` grew through the rest of Phase 1 (it is 1,537 lines / 76,599 bytes
now). Nothing about the config accounts for the difference; recorded so a later reader does not
treat the delta as a regression.

### Export-surface baseline — for 02-06 and 02-07

| Measure | Value |
|---|---|
| Names in the trailing `export { … }` of `dist/index.d.ts` | **43** |
| Number of `export {` statements in `dist/index.d.ts` | **1** |
| Composition, counted at `src/index.ts` | **39 types + 4 values** |
| The 4 values | `USER_CANCELLED`, `USER_DECLINED`, `CONSENT_GRADE_ORDER`, `MESSAGE_MAX_CHARS` |

Matches research exactly. **Plan 02-07's guard does not need to union multiple export blocks** —
there is one, and the plan's contingency ("union them if so") does not apply. This is the
pre-`contract.ts` baseline; 02-06 will change it.

Also confirmed, and relevant to 02-07's guard design: `serverChallengeBrand` (2 occurrences) and
`ConsentAckBase` (3 occurrences) are **present in `dist/index.d.ts` as declarations** and **absent
from the export list**. A guard must assert absence from the export list, not absence from the file
— the latter fails on a correct artifact.

### The three load-bearing comments

All are standalone `//` or `/** */` lines. None is a trailing inline comment, deliberately: the
acceptance criterion scopes its `attw: true` assertion to non-comment lines
(`grep -v '^[[:space:]]*[/*]'`), and a trailing comment would ride on the code line and turn a
compliant file red.

```
$ grep -v '^[[:space:]]*[/*]' packages/concierge/tsdown.config.ts | grep -c 'attw: true'
0
```

The comments state: (1) `attw: true` prints a warning and exits 0 — a report, not a gate;
(2) the default `strict` profile fails a correct ESM-only package, and the natural "fix" reverses
the locked ESM-only decision; (3) the config is package-local deliberately, because the root script
stays `pnpm -r build` and that is the structural guard against a future `concierge-svelte` being
swept into tsdown and having its runes pre-bundled.

### No `test` script — a deliberate divergence, recorded so it is not "restored"

`packages/concierge/package.json` ends this phase with exactly two scripts, `typecheck` and
`build`. `02-RESEARCH.md:786-798` recommends a package-level `"test": "vitest run"`; that
recommendation is **not** followed, here or in any later plan of this phase. Vitest resolves its
config from the working directory and does not search upward, so a `packages/concierge` script
running `vitest run` would never find the root `vitest.config.ts`. Plan 02-07 makes the **root**
script `vitest run` instead.

`typecheck` is byte-unchanged (`tsc -p tsconfig.test-d.json`) and `scripts` is still the last field
in the manifest. The whole Task 1 manifest diff is one added line.

## Task 2 — the sourcemap decision

### The defect, measured before the fix

| Map | `sources` | `sourcesContent` | Bytes |
|---|---|---|---|
| `dist/index.d.ts.map` | `["../src/types.ts"]` | **absent** | 3,116 |
| `dist/index.js.map` | `["../src/types.ts"]` | present, **76,302 chars**, 1 entry | 78,718 |

`tsconfig.base.json` sets `declarationMap: true` and `sourceMap: true` globally and tsdown honours
both. The packed tarball before the change had **7 entries and no `package/src/` at all**, so
`../src/types.ts` resolved to nothing — Go-to-Definition landed on a missing file. Both gates said
clean on that state (`publint --strict` → "All good!", `attw` → no problems), so nothing would have
caught it.

Research measured `sourcesContent` at 57,413 characters; it is **76,302** now, for the same reason
the artifact sizes grew.

### Decision: option (a) — add `"src"` to `files`

`files` is now `["dist", "src", "README.md", "LICENSE"]`. This is a decision, not a discovery.
Rationale, because 78 kB of source in a 3 kB-runtime package invites deletion:

1. **The maps resolve.** Source-level debugging and Go-to-Definition work — what the ecosystem
   expects from a TypeScript library. Proven by extracting the tarball and resolving each `sources`
   entry against the map's own directory:

   ```
   dist/index.d.ts.map -> ../src/types.ts RESOLVES
   dist/index.js.map   -> ../src/types.ts RESOLVES
   ```

2. **The redundancy becomes purposeful.** `dist/index.js.map` already ships `sourcesContent` of
   76,302 characters — the whole of `types.ts`, comments included. Publishing `src/` makes that
   deliberate rather than accidental.

3. **It is a data-protection decision, not only a size one.** **`serverChallengeBrand` and
   `ConsentAckBase` are deliberately unexported and, under this decision, ship as readable source
   text** — as they already did inside `sourcesContent`. "Unexported" is not "unpublished". For an
   MIT public library whose `types.ts` carries the design rationale for the consent kernel, this is
   acceptable; it is stated rather than assumed. (`ReadbackAttestation` is not affected — it has
   zero occurrences in `types.ts` and does not exist.)

Options (b) turn the maps off and (c) inline `sourcesContent` into both maps were **not** taken.
`tsconfig.base.json` and `packages/concierge/tsconfig.json` were **not** edited —
`git diff --exit-code` on both exits 0.

### The reviewed tarball

`pnpm pack` from `packages/concierge`, manually reviewed — one of the phase gate's named manual
reviews.

| | Before | After |
|---|---|---|
| Tarball bytes | 53,893 | **79,453** |
| Entries | 7 | **9** |

```
package/LICENSE
package/README.md
package/dist/index.d.ts
package/dist/index.d.ts.map
package/dist/index.js
package/dist/index.js.map
package/package.json
package/src/index.ts
package/src/types.ts
```

Forbidden-path scan over the tarball listing — every count is **0**: `test-d`, `scripts`,
`node_modules`, `tsconfig`, `.test.ts`, `tsdown.config`. The temp directory was deleted after each
pack; `*.tgz` is gitignored (02-01), so no pack could dirty a `git status --porcelain` assertion.

## Task 3 — `check:artifact`

```jsonc
"check:artifact": "pnpm --filter @fullselfbrowsing/concierge exec publint --strict && pnpm exec attw --pack packages/concierge --profile esm-only"
```

Root `scripts` is now `build`, `test`, `typecheck`, `check:artifact`. `build` is still exactly
`pnpm -r build` — the build is not centralized. No other script was added.

**Binary resolution was verified, not assumed.** Both resolve to the **root** `node_modules/.bin`
from both invocation sites, so **no devDependency was added to `packages/concierge`**:

```
$ pnpm --filter @fullselfbrowsing/concierge exec which publint
<repo>/node_modules/.bin/publint
$ pnpm exec which attw
./node_modules/.bin/attw
```

`pnpm run check:artifact` exits **0**, with `publint` reporting `All good!` and `attw` reporting
`(ignoring resolutions: 'node10', 'node16-cjs')` and a green node16-ESM/bundler matrix.

### D3 is a non-defect — do not "fix" it

Removing the `types` condition from `exports` passes **both** gates. That is correct behaviour, not
a blind spot: with `exports` present and no `types` condition, TypeScript falls back to the `.d.ts`
adjacent to the resolved `.js`, which resolves. **No task should be spent "fixing" D3.**

## Defect-first proofs

Both were run through `scripts/mutate-and-prove.sh` (02-02), so each mutation was applied, gated,
restored and *proven* restored inside one invocation.

### Proof 1 — `--profile esm-only` is not optional

The flag's necessity was **observed, not taken on trust**. Same package, same tarball, no mutation
needed:

| Command | Exit |
|---|---|
| `pnpm exec attw --pack packages/concierge --quiet` (default `strict` profile) | **1** |
| `pnpm exec attw --pack packages/concierge --profile esm-only` | **0** |

The diagnostic at the default profile:

```
⚠️ A require call resolved to an ESM JavaScript file, which is an error in Node and some
   bundlers. CommonJS consumers will need to use a dynamic import.
│ node16 (from CJS) │ ⚠️ ESM (dynamic import only) │
```

**One correction to the research.** `02-RESEARCH.md:530` says the strict profile reports
`CJS resolves to ESM` **and `node10` failures**. Measured here, `node10` is **🟢** — the package
declares top-level `main` and `types`, so node10 resolves fine. Only `cjs-resolves-to-esm` fires.
The conclusion is unchanged and the flag is still mandatory; the enumeration was over-stated by one.

### Proof 2 — `check:artifact` fails, and short-circuits

Mutant: `files` with `"dist"` removed (research defect D5) — the defect the in-build gate cannot
see, because the in-build gate reads the source-tree manifest and never packs.

```
PASS: gate fired (exit 1), tree clean
```

Gate output, verbatim:

```
Running publint v0.3.22 for @fullselfbrowsing/concierge...
Packing files with `pnpm pack`...
Linting...
Errors:
1. pkg.types is ./dist/index.d.ts but the file is not published. Is it specified in pkg.files?
2. pkg.exports["."].types is ./dist/index.d.ts but the file is not published. Is it specified in pkg.files?
[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command failed with exit code 1: publint --strict
```

`attw` produced **no output** — the `&&` short-circuited as designed. (Research's D5 reported 4
publint errors against `files: []`; this mutant leaves `src`, `README.md` and `LICENSE` in place, so
only the two `types` targets are flagged. Same finding, narrower mutant.)

### Proof 3 — a typecheck failure cannot pass the build

The structural half of success criterion 2 — mandated by this executor's hard constraints. Formal
ownership of mutant P4 is plan **02-04** (wave 3); this is a corroborating run made here because
this plan is the one that first creates `pnpm build`, and the claim is a property of that script.

Mutant: `export const MESSAGE_MAX_CHARS = 180;` → `export const MESSAGE_MAX_CHARS: 180 = 181;` in
`packages/concierge/src/types.ts`. Both gates run against the **same** mutated tree, in one
invocation:

```
BUILD_EXIT=0
TYPECHECK_EXIT=1
```

```
src/types.ts(279,14): error TS2322: Type '181' is not assignable to type '180'.
```

And the build that exited 0 was not merely silent — it was **wrong**, and both artifact gates
called it clean:

```
✔ Build complete in 52ms
✔ [attw] No problems found (138ms)
✔ [publint] No issues found (148ms)

$ grep -o "MESSAGE_MAX_CHARS = [0-9]*" packages/concierge/dist/index.js
MESSAGE_MAX_CHARS = 181
```

rolldown stripped the annotation and shipped the wrong constant. `publint` and `attw` inspect the
manifest and the resolution graph, not the semantics, so neither can see this. **`tsc --noEmit` is
the only gate that catches it, and CI must run `typecheck` before `build`.** After restore the
artifact reads `MESSAGE_MAX_CHARS = 180` again.

```
PASS: gate fired (exit 1), tree clean
```

## Mutation hygiene

Every mutation above was applied and restored inside a single Bash invocation via
`scripts/mutate-and-prove.sh`, whose `trap … EXIT INT TERM` restores on crash and which asserts
`git diff --exit-code` on the target before reporting. No mutation outlived the call that made it,
and none crossed a tool-call boundary.

`git status --porcelain` immediately before writing this SUMMARY, **verbatim — the output is empty,
zero lines**:

```
```

`git diff --exit-code` at the repo root exits 0. `git diff --exit-code d8891d5 -- pnpm-lock.yaml`
exits 0 — nothing was installed.

## Verification

Every clause of the plan's `<verification>` block, run at the end of the plan:

| Check | Result |
|---|---|
| `pnpm build` exits 0 with both gates clean | **0** — `✔ [attw] No problems found`, `✔ [publint] No issues found` |
| `dist/` holds ESM only, no `.cjs` / `.mjs` / `.d.cts` | 4 files, forbidden count **0** |
| Trailing `export { … }` lists 43 names | **43**, in **1** export block |
| `pnpm run check:artifact` exits 0 | **0** |
| `attw --pack packages/concierge` without the profile exits non-zero | **1** (recorded above) |
| Tarball has `src/`, `dist/`, `README.md`, `LICENSE`, nothing from `test-d/` | 9 entries, forbidden count 0 |
| `git diff --exit-code tsconfig.base.json packages/concierge/tsconfig.json` | **0** |
| `pnpm typecheck` still exits 0 | **0** |
| Task 1 `<automated>` verify (build + files + `EXPORT_NAMES===43`) | exit **0**, `EXPORT_NAMES=43` |
| Task 2 `<automated>` verify (pack + `package/src/types.ts` + no `test-d`) | exit **0**, `TARBALL_OK` |
| Task 3 `<automated>` verify (`build && check:artifact`) | exit **0** |
| `grep -c 'profile esm-only' package.json` | **1** |
| Root `scripts.build` | `"pnpm -r build"`, unchanged |

## Deviations from Plan

None that changed an artifact. Three factual corrections to the inputs are recorded above rather
than acted on:

1. **Artifact sizes and `sourcesContent` length exceed the research figures** (2.96 kB / 71.68 kB /
   76,302 chars vs 1.03 kB / 52.71 kB / 57,413) because `types.ts` grew through the rest of Phase 1
   after the research snapshot. Config-independent; not a regression.
2. **`attw`'s strict profile does not report node10 failures on this package** — only
   `cjs-resolves-to-esm`. `02-RESEARCH.md:530` over-states the enumeration by one. The flag is still
   mandatory; the exit code is still 1.
3. **The D5 mutant produces 2 publint errors, not 4**, because it removes only `dist` rather than
   emptying `files`. Same defect class, narrower mutant.

No `README.md` was touched. `.planning/STATE.md` and `.planning/ROADMAP.md` were not touched — the
orchestrator owns those writes.

## Threat Model Outcomes

| Threat | Disposition | Evidence |
|---|---|---|
| T-02-10 `attw: true` is a silently-passing gate | **mitigated** | `attw: { level: "error", profile: "esm-only" }` is in the config; `attw: true` appears on **zero** non-comment lines, and the trap is named in a standalone comment so it cannot be re-introduced by a reader who does not know why. Plan 02-04 proves the gate fires; `check:artifact`'s short-circuit was proven firing here. |
| T-02-11 `attw`'s default profile | **mitigated** | `--profile esm-only` is passed in both the build config and the standalone script. Its necessity was measured, not assumed: exit 1 without, exit 0 with. The comment in the config names the wrong fix (adding a CJS format) explicitly. |
| T-02-12 `files` including `src` | **accepted, and stated** | `serverChallengeBrand` and `ConsentAckBase` ship as readable source text. They already did, inside 76,302 characters of `sourcesContent`. Recorded as a decision with its consequence written down. |
| T-02-13 test or script sources escaping | **mitigated** | Tarball enumerated with `tar -tzf`: 9 entries, and `test-d`, `scripts`, `node_modules`, `tsconfig`, `.test.ts` and `tsdown.config` each match **0** paths. |
| T-02-14 a manifest defect visible only after packing | **mitigated, and observed** | `check:artifact` packs first. D5 was mutated in and caught: publint exit 1, attw never reached, tree restored clean. |
| T-02-SC supply chain | **accepted, and held** | This plan installed nothing. `pnpm install --frozen-lockfile` was the only install, and `git diff --exit-code d8891d5 -- pnpm-lock.yaml` exits 0. |

## For the Next Plans

1. **02-04:** the gates exist and are green, so the mutants have something to fire against. P4 was
   corroborated here (`BUILD_EXIT=0`, `TYPECHECK_EXIT=1`) — 02-04 still owns the formal run, and the
   `MESSAGE_MAX_CHARS: 180 = 181` mutant is a working recipe with a visible artifact-level
   consequence.
2. **02-06:** the export surface is **43** today. Any change to that count is expected to be yours;
   state the new number.
3. **02-07:** `dist/index.d.ts` has exactly **one** `export {` block, so the guard does not need to
   union multiple blocks. Assert absence from the **export list**, not absence from the file —
   `serverChallengeBrand` and `ConsentAckBase` are present as declarations in a correct artifact.
   `ReadbackAttestation` does not exist at all, so any guard naming it passes vacuously.
4. **02-07:** the root `test` script is still `pnpm -r test`, which no-ops green. `packages/concierge`
   has no `test` script and must not be given one — make the **root** script `vitest run`.
5. **02-10 (CI):** run `pnpm typecheck` **before** `pnpm build`, and `pnpm run check:artifact` after
   the build. Proof 3 is the reason the ordering is not cosmetic.
6. Anything that packs must use `--pack-destination "$(mktemp -d)"` and delete it; `*.tgz` is
   gitignored, but a stray tarball still confuses a manual review.

## Known Stubs

None. This plan added no code paths — one build config, two manifest edits.

## Threat Flags

None. No network endpoint, auth path or schema at a trust boundary was introduced. The one
security-relevant surface change is deliberate and dispositioned as **accept** in the plan's own
threat register (T-02-12): publishing `src/` makes two intentionally-unexported declarations
readable as source text, which they already were inside the published `sourcesContent`.

## Self-Check: PASSED

Files claimed created/modified, verified present on disk:

- `packages/concierge/tsdown.config.ts` — FOUND (49 lines; `format: ["esm"]`, `platform: "neutral"`,
  `publint: { level: "error" }`, `attw: { level: "error", profile: "esm-only" }`)
- `packages/concierge/package.json` — FOUND (`"build": "tsdown"`; `files` =
  `["dist","src","README.md","LICENSE"]`; `scripts` last; no `test` script)
- `package.json` — FOUND (`check:artifact` present; `build` still `pnpm -r build`)

Commits claimed, verified in `git log`:

- `7df01b4` — FOUND
- `19d9fa2` — FOUND
- `c827be5` — FOUND

`README.md` and `packages/concierge/README.md` untouched, `.planning/STATE.md` and
`.planning/ROADMAP.md` untouched — all four verified with
`git diff --exit-code d8891d5 -- …`, exit 0. `git status --porcelain` empty.
