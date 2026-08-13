---
phase: 02-packaging-build-and-release
plan: 09
subsystem: packaging
tags: [pkg-02, pkg-03, pack-install, node-floor, mutation-testing, scratch-project, skiplibcheck, promise-try]

# Dependency graph
requires:
  - phase: 02-packaging-build-and-release
    plan: "02-02"
    provides: "scripts/mutate-and-prove.sh — the harness both negative controls run through"
  - phase: 02-packaging-build-and-release
    plan: "02-03"
    provides: "the tsdown build, the packable manifest, and the attw/publint gates inside it"
  - phase: 02-packaging-build-and-release
    plan: "02-06"
    provides: "CONTRACT_VERSION and assertSingleInstance — imported by the probe and called on the floor"
  - phase: 02-packaging-build-and-release
    plan: "02-07"
    provides: "the root `test` script and test/single-instance.test.ts, which mutant P10's gate runs"
provides:
  - "scripts/pack-install-check.sh — PKG-02: pack, install into a scratch project OUTSIDE the repo, typecheck the shipped .d.ts with skipLibCheck off, import the runtime"
  - "scripts/node-floor-check.sh — PKG-03: download the exact floor runtime, install the tarball, import it with npm and node only"
  - "packages/concierge/test/fixtures/probe.ts — the consumer-side type probe, compiled by a foreign program"
  - "Root scripts check:pack and check:node-floor — one name for CI and local"
  - "The PKG-02 negative control observed: TS2322 from a tracked probe"
  - "Mutant P10 observed, NOT SKIPPED: DEV_EXIT=0 on Node v24.14.1, TypeError on v22.12.0"
  - "A measured floor-runtime cache cost on darwin-arm64: 25,100,836 B compressed, 201 MB extracted, ~11 s cold / ~0 s warm"
affects:
  - "02-10 — ci.yml calls `pnpm run check:pack` in the build job and mirrors node-floor-check.sh as a separate npm-only job; it must NOT write `pnpm test -- <name>`"
  - "02-12 — the phase gate re-runs both scripts on a clean checkout; PKG-02 and PKG-03 are ready to close in REQUIREMENTS.md"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A scratch project for an install test lives in `mktemp -d` outside the repo; anything under packages/ or examples/ is absorbed by the workspace glob and the test passes without testing anything"
    - "scripts/ header convention: shebang, then a `#` line naming the requirement ID, then what the file proves that nothing else in the repo can"
    - "Network failures are reported as network failures, so an offline run never reads like a packaging defect"
    - "Every comment in a shell script is a standalone `#` line; every comment in the probe is a standalone `//` or `/** */` line, with exactly one sanctioned trailing exception"
    - "A defect-first proof of a runtime-floor job needs a mutation the developer's runtime cannot see — a type-erased call to a newer built-in, not a broken build"

key-files:
  created:
    - scripts/pack-install-check.sh
    - scripts/node-floor-check.sh
    - packages/concierge/test/fixtures/probe.ts
  modified:
    - package.json

key-decisions:
  - "The probe imports ConsentAck and Transport as unused type aliases rather than only naming them in an import — under skipLibCheck:false this forces the declaration bodies they reach to be fully checked rather than merely parsed"
  - "The floor script front-loads PATH and then states the pnpm finding, so the mandated pnpm comment sits INSIDE the awk range the acceptance criterion scopes to non-comment lines"
  - "nvm/fnm/volta are not named anywhere in node-floor-check.sh, not even in prose — the acceptance criterion is not comment-scoped, so the constraint is stated as 'no third-party Node version manager'"
  - "aarch64 was added to the ARCH sed mapping beyond research's form, so the script works on a Linux arm64 CI runner"
  - "REQUIREMENTS.md was NOT marked, following 02-05/02-06/02-07 precedent and this plan's files_modified"

patterns-established:
  - "Pre-verify a mutation's compile-time invisibility in an isolated mktemp program before spending a harness cycle on it"
  - "Prove the cast in a type-erased mutant is load-bearing by compiling the uncast form and recording its diagnostic (TS2550)"

requirements-completed: []

# Metrics
duration: 17min
completed: 2026-07-29
tasks: 3
commits: 2
files_changed: 4
---

# Phase 2 Plan 09: Prove the artifact installs and runs where the manifest says Summary

**Two integration harnesses the repository could not previously make on its own behalf: a foreign
project outside the workspace now installs the real tarball and fully typechecks the 77 kB shipped
`index.d.ts` with `skipLibCheck` off, and the same artifact is installed with npm and imported on a
genuinely downloaded Node v22.12.0 — proven by mutant P10, which is invisible on the developer's
v24.14.1 (`DEV_EXIT=0`) and dies on the floor with `TypeError: Promise.try is not a function`.**

## Performance

- **Duration:** ~17 min
- **Tasks:** 3
- **Files changed:** 4 (3 created, 1 modified)

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | PKG-02 pack-and-install scratch harness + negative control | `1f91d8f` | `scripts/pack-install-check.sh`, `packages/concierge/test/fixtures/probe.ts`, `package.json` |
| 2 | PKG-03 the exact Node floor, npm and node only | `14dd01d` | `scripts/node-floor-check.sh`, `package.json` |
| 3 | Mutant P10 — the floor job proven able to fail | *(no net file change — see below)* | `src/contract.ts` mutated and restored |

**Task 3 has no commit, and that is correct rather than an omission** — the same situation as 02-07's
Task 3. The mutation is applied and restored inside a single `mutate-and-prove.sh` invocation, so the
task's output is evidence, not source. `git diff --exit-code` is clean afterwards and
`git status --porcelain` is empty.

Net diff against the wave-5 base (`71d680b`): `M package.json`, `A scripts/pack-install-check.sh`,
`A scripts/node-floor-check.sh`, `A packages/concierge/test/fixtures/probe.ts`. Nothing else.
`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `packages/concierge/package.json` and all of
`packages/concierge/src/` are byte-unchanged. No commit in this plan contains a deletion.

## PKG-02 — a foreign project actually installs the tarball

`pnpm run check:pack` exits **0**. It is 133 lines and does six things in order: build, pack into a
`mktemp -d`, write a scratch `package.json` and `tsconfig.json`, copy the probe in, `npm install` the
tarball plus its own compiler, then typecheck and import.

### The measurements the plan asked for

| Measure | Value |
|---|---|
| tarball path | `$TMPDIR/tmp.<rand>/fullselfbrowsing-concierge-0.0.0.tgz` |
| tarball size | **87,915 bytes** |
| packages on disk in the scratch project | **4** |
| wall time (warm npm cache) | **3–4 s** |
| `dist/index.js` inside it | 9,739 B (unchanged from 02-06) |
| `dist/index.d.ts` inside it | 77.26 kB |

The scratch project's dependency tree, read with `npm ls --all`:

```
├─┬ @fullselfbrowsing/concierge@0.0.0
│ └── @standard-schema/spec@1.1.0
└─┬ typescript@7.0.2
  ├── @typescript/typescript-darwin-arm64@7.0.2
  └── (19 × UNMET OPTIONAL DEPENDENCY @typescript/typescript-<platform>@7.0.2)
```

**`@standard-schema/spec@1.1.0` resolving from the registry is the load-bearing line.** The shipped
`index.d.ts` imports from it; if the manifest had listed it as a `devDependency`, or omitted it, the
repo's own typecheck would still pass and only this install would notice. Nothing else in the
repository exercises that edge.

TypeScript 7 resolves exactly one platform binary and leaves the other nineteen unmet — worth
recording because "added 4 packages" looks small next to a 20-entry `optionalDependencies` block, and
a future reader should not mistake it for a broken install.

### Why `skipLibCheck: false` is the whole point

The repo's `tsconfig.base.json` sets `skipLibCheck: true`, so **nothing in this repository has ever
typechecked the 77 kB shipped `index.d.ts`** — it is trusted, not checked. The scratch project turns
the flag off and checks it in full, from a program that can see only what the tarball ships. That is
the one thing `pnpm build`, `publint` and `attw` cannot do between them.

### The two settings that are easy to get wrong, both commented at the line

`"module": "node20"` with **no** `moduleResolution` key. TS 7.0.2 rejects
`"moduleResolution": "node20"` outright; `"module": "node20"` alone implies
`moduleResolution: "node16"` plus `moduleDetection: "force"`, which is the strictest realistic
consumer setting. Adding the key back does not tighten anything — it makes the project fail to
configure.

`npm install`, never `pnpm add`: npm avoids the workspace and the pnpm store entirely, produces the
flat `node_modules` a real consumer has, and resolves the registry dependency above.

### The probe

79 lines, in a *foreign* program — compiled by the scratch project's own `typescript@7.0.2`, not by
`tsconfig.test-d.json`. Plain annotations rather than `Expect<Equals<…>>` (the helpers live in this
repo's program and installing them would defeat the point), and unlike every `test-d` file it
**exports**.

```ts
export const r: ActionResult = { ok: true, message: "ok" };
export const n: 180 = MESSAGE_MAX_CHARS; // the literal type survived into the shipped .d.ts
export const v: 1 = CONTRACT_VERSION;
export const f: () => void = assertSingleInstance;
export type ProbeAck = ConsentAck;
export type ProbeTransport = Transport;
```

`MESSAGE_MAX_CHARS`'s literal type is the strongest single assertion available today because it is
the one thing that degrades *silently* — an `isolatedDeclarations` slip widens it to `number`, the
build stays green, the repo's own type tests stay green, and only a consumer compiling against the
shipped `.d.ts` can see it.

The two type-only aliases are a deliberate addition beyond the plan's four declarations: naming
`ConsentAck` and `Transport` in an import is not enough to make `skipLibCheck: false` do work, but
aliasing them forces the declaration bodies they reach — the branded server-challenge machinery and
the tool/batch surface — to be resolved rather than merely parsed.

**No `console` anywhere.** The probe holds core's own `lib: ["ES2022"]`-with-no-`@types/node`
discipline, under which `console.log` is `TS2584`. That constraint is written as a standalone comment
at the top, which is exactly why the acceptance grep is scoped to non-comment lines — an unfiltered
grep would make the mandated comment self-invalidating. Measured: **0**.

### The negative control — a tracked probe, TS2322, exit 1

The probe is created earlier in the same task, so it had to be **staged before the mutant ran**.
`mutate-and-prove.sh` reasons about the git index at three points — `git ls-files --error-unmatch`,
`git diff --quiet`, `git checkout --` — and against an untracked path it aborts with exit 2, or, on a
harness built before that pre-flight existed, misdiagnoses as exit 3 (`mutation was a no-op`).
`git add` was run first and `git ls-files --error-unmatch` was confirmed to exit 0 at that point.

```
bash scripts/mutate-and-prove.sh packages/concierge/test/fixtures/probe.ts \
  'export const n: 180 = MESSAGE_MAX_CHARS;' \
  'export const n: 181 = MESSAGE_MAX_CHARS;' \
  -- pnpm run check:pack
```

| | |
|---|---|
| harness stdout | `PASS: gate fired (exit 1), tree clean` |
| harness exit | **0** — not 2 (untracked), not 3 (no-op) |
| gate diagnostic | `probe.ts(58,14): error TS2322: Type '180' is not assignable to type '181'.` |
| gate exit | **1** — `tsc` under `noEmit` returns *DiagnosticsPresent_OutputsSkipped* |
| tree after | `git diff --exit-code -- …/probe.ts` exits **0** against the staged content |

This is the assertion that separates a working harness from one that silently typechecks nothing:
both exit 0, and only the negative control tells them apart.

## PKG-03 — the exact floor, driven by npm and node alone

`pnpm run check:node-floor` exits **0**. 144 lines, three phases.

| Measure | Value |
|---|---|
| **developer's own runtime** | **v24.14.1** |
| **floor runtime, as printed by the download** | **v22.12.0** |
| compressed tarball (`content-length`) | **25,100,836 B** — 25.1 MB, matching research exactly |
| extracted cache size | **201 MB** at `$TMPDIR/node-v22.12.0` |
| cold run, total wall | **13 s** |
| warm run, total wall | **2 s** |
| implied download + extract cost | **~11 s** |

**One divergence from research, recorded rather than smoothed over.** `02-RESEARCH.md:512` measures
the cold `curl | tar` at *"~4 s for 25.1 MB on darwin-arm64"*. The compressed size reproduces to the
byte; the time does not — this tree measures ~11 s for the same operation on the same platform. The
gap is almost certainly xz decompression of 201 MB rather than transfer, and it is a one-time cost
per machine. No assertion depends on it; the number is corrected here so a later reader budgeting CI
time uses 11 s and not 4 s.

The exact import line that succeeded, verbatim from the script:

```bash
node --input-type=module -e '
  const m = await import("@fullselfbrowsing/concierge");
  m.assertSingleInstance();
  if (m.MESSAGE_MAX_CHARS !== 180) {
    throw new Error("runtime binding erased: MESSAGE_MAX_CHARS is " + String(m.MESSAGE_MAX_CHARS));
  }
'
```

`assertSingleInstance()` is called on the floor runtime, which is the first time this phase has
executed the package's only executable code anywhere other than the developer's Node.

### The floor section invokes no pnpm, and that is a finding not a preference

`pnpm@11.17.0` refuses to start on Node 22.12.0 (`ERROR: This version of pnpm requires at least
Node.js v22.13`; `npm view pnpm@11.17.0 engines` → `{"node":">=22.13"}`). A floor job written with
pnpm fails on the **tooling** rather than on the artifact, and the obvious remedy — raising
`engines.node` to `>=22.13` — abandons the requirement while appearing to fix it.

The script says so at the exact line where the tempting edit happens: `engines.node` is the
**package's** floor, a promise to consumers about where the published artifact runs; pnpm's
`>=22.13` is a **contributor** requirement about where this repo is developed. They are not the same
kind of thing and must not be harmonized.

Measured, scoped exactly as the acceptance criteria specify:

| Check | Result |
|---|---|
| `awk '/PATH=/,0' … \| grep -v '^[[:space:]]*#' \| grep -c pnpm` | **0** |
| `grep -v '^[[:space:]]*#' … \| grep -oE '22(\.[0-9]+)*' \| sort -u` | **`22.12.0`**, exactly one line |
| `grep -cE 'nvm\|fnm\|volta'` | **0** |
| `git diff --exit-code packages/concierge/package.json` | **0** — `engines.node` still `">=22.12.0"` |

The version inventory is stated as an inventory rather than as "must not contain `22.12` or `22`"
because `22.12.0` *contains* both substrings; the absence form is unsatisfiable by construction. Both
the `PATH` and the pnpm assertions are scoped to non-comment lines for the same reason as the probe's
`console` grep: the comments the plan *mandates* would otherwise invalidate themselves. The pnpm
finding is written **after** the `export PATH=…` line specifically so it lands inside the `awk` range
and the scoping is doing real work rather than being decorative.

## Mutant P10 — NOT SKIPPED

**This mutant was not skipped.** It is the only check in the suite that can distinguish a floor job
from a job that silently runs on the developer's runtime, and `02-VALIDATION.md` names it
non-skippable.

```
bash scripts/mutate-and-prove.sh packages/concierge/src/contract.ts \
  '  const holder: Holder = globalThis as unknown as Holder;' \
  '  const holder: Holder = globalThis as unknown as Holder; void (Promise as unknown as { try: (f: () => number) => unknown }).try(() => 1);' \
  -- bash -c 'pnpm build && pnpm test -- single-instance; echo DEV_EXIT=$?; pnpm run check:node-floor'
```

The pattern is `contract.ts:146`, `assertSingleInstance`'s first statement, read verbatim and
confirmed to occur exactly once.

### Both halves of the signature

| | |
|---|---|
| harness stdout | `PASS: gate fired (exit 1), tree clean` |
| **harness exit** | **0** |
| **dev-runtime half** | **`DEV_EXIT=0`** — `Test Files 3 passed (3)` / `Tests 12 passed (12)` on v24.14.1 |
| **floor half** | `pnpm run check:node-floor` exited **1** (`[ELIFECYCLE] Command failed with exit code 1`) |
| floor error | `TypeError: Promise.try is not a function` |
| floor frame | `at Module.assertSingleInstance (…/dist/index.js:181:13)`, footer `Node.js v22.12.0` |
| tree after | `git diff --exit-code -- packages/concierge/src/contract.ts` exits **0** |

`DEV_EXIT=0` is the half that makes the floor job worth having: the entire twelve-test suite passed
against a `dist/index.js` built **from the mutated source**, on the developer's runtime, with the
defect present. Nothing else in this repository can see it.

The emitted line on the floor was `Promise.try(() => 1);` — rolldown erased the cast entirely, which
is precisely why the type system is blind to it too.

### The cast is load-bearing, and that was measured rather than assumed

Before spending a harness cycle, the replacement was compiled in an isolated `mktemp -d` program
under the same `lib: ["ES2022"]` + `strict` + `isolatedDeclarations` settings:

| Form | `tsc` exit | Diagnostic |
|---|---|---|
| `void (Promise as unknown as { try: … }).try(() => 1);` | **0** | none |
| `void Promise.try(() => 1);` | **1** | `error TS2550: Property 'try' does not exist on type 'PromiseConstructor'. … Try changing the 'lib' compiler option to 'es2025' or later.` |

So the mutation is invisible to the type checker **and** to the v24 runtime, and visible only to the
floor. A mutation that also broke the dev runtime would have proven nothing about the floor; a
mutation that failed to compile would have made `DEV_EXIT` non-zero and destroyed the evidence.

### Restored and re-verified

After the invocation, `pnpm build` was re-run (the harness restores the source, not the build
output), then:

| Check | Result |
|---|---|
| Task 3 verify block — `pnpm build && pnpm run check:node-floor && git diff --exit-code` | **`P10_BASELINE_GREEN`**, exit 0 |
| `pnpm test` | **0** — 12 tests, 3 files |
| `pnpm typecheck` | **0** |
| `packages/concierge/package.json` | unchanged; `engines.node` still `">=22.12.0"` |
| `git status --porcelain` | **empty** |

## Deviations from Plan

### Auto-fixed / additive

**1. [Rule 2 - Correctness] `aarch64` added to the architecture mapping.** Research's form is
`sed 's/x86_64/x64/;s/arm64/arm64/'`, whose second clause is a no-op. On a Linux arm64 runner
`uname -m` reports `aarch64`, which Node's tarball naming calls `arm64`, so the unmodified form would
build a 404 URL and the script would fail with a network-shaped error on a platform 02-10's CI may
well use. Written as `sed 's/x86_64/x64/; s/aarch64/arm64/'`. Verified on `darwin-arm64` (where
`uname -m` already reports `arm64` and neither clause fires).

**2. [Rule 2 - Correctness] Both scripts distinguish a network failure from a packaging defect.**
The plan requires this of `pack-install-check.sh`; the same treatment was applied to the floor
script's `curl` and its `npm install`, since an offline run of the floor job would otherwise read as
"the artifact does not run on v22.12.0". The cold-download branch also `rm -rf`s the cache directory
on failure so a truncated extract cannot be picked up as warm by the next run.

**3. [Additive] Two type-only aliases in the probe** (`ProbeAck`, `ProbeTransport`) beyond the four
declarations the plan lists. Rationale in the PKG-02 section: without them, `skipLibCheck: false` has
markedly less of `index.d.ts` to check. Does not change any mandated line.

### Recorded, not fixed

**4. `pnpm test -- <name>` still does not filter — re-measured on this tree.** 02-07 found this and
deferred the correction to 02-10 and 02-12. Task 3's gate command is specified verbatim by this plan
in the `--` form, so it was run in that form and the whole suite ran:

| Command | Test files | Tests |
|---|---|---|
| `pnpm test -- single-instance` | **3** | **12** |
| `pnpm exec vitest run single-instance` | **1** | **3** |

**The evidence is unaffected and arguably stronger.** The required signature is `DEV_EXIT=0`, and it
was produced by the *entire* twelve-test suite passing against the mutated build rather than by three
tests passing — a wider claim than the plan asked for. The `--` form was kept because the plan
mandates that exact string; the divergence is recorded here rather than silently patched, and the
correction remains owned by 02-10 (`ci.yml`) and 02-12 (`02-VALIDATION.md`).

Nothing else deviated. Three tasks, four files, the mandated `mktemp`/`trap` shape, the mandated
tsconfig settings, the mandated comment discipline, the mandated mutant.

## Verification

All three `<verify><automated>` blocks were run verbatim.

| Block | Result |
|---|---|
| Task 1 — `check:pack && mutate-and-prove … ; test $? -eq 0 && git diff --exit-code && check:pack` | **`PKG02_OK`**, exit 0 |
| Task 2 — `pnpm run check:node-floor && echo PKG03_OK` | **`PKG03_OK`**, exit 0 |
| Task 3 — `pnpm build && pnpm run check:node-floor && git diff --exit-code` | **`P10_BASELINE_GREEN`**, exit 0 |

Plan-level `<verification>` block on the final tree:

| Check | Result |
|---|---|
| `pnpm run check:pack` | **0** |
| negative control from a **tracked** probe → TS2322, harness `PASS` (not exit 2 or 3) | **yes** |
| `pnpm run check:node-floor` on a genuinely downloaded v22.12.0 | **0** |
| the floor section invokes no pnpm | **0 non-comment matches in the `awk` range** |
| P10: `DEV_EXIT=0` and a non-zero floor exit with a `TypeError` naming `try` | **both observed** |
| `engines.node` unchanged; `packages/concierge/package.json` unchanged | `git diff --exit-code` **0** |
| `git status --porcelain` empty | **empty** |
| no scratch directory remains | **none of this plan's remain** — see *Tree hygiene* |

Adjacent gates, re-run to confirm nothing regressed:

| Check | Result |
|---|---|
| `pnpm build` (attw + publint clean) | **0** |
| `pnpm test` | **0** — 12 tests, 3 files |
| `pnpm typecheck` | **0** |
| `pnpm run check:artifact` | **0** |
| `pnpm run check:deps` | **0** |

Acceptance-criteria spot checks:

| Criterion | Measured |
|---|---|
| `trap 'rm -rf "$OUT"' EXIT` present verbatim in both scripts | **yes** |
| scratch `tsconfig.json` has `"module": "node20"`, **no** `moduleResolution` key | **yes** — 0 non-comment matches |
| scratch `tsconfig.json` has `"skipLibCheck": false` | **yes** |
| installs with `npm install`, never `pnpm add` | **0 non-comment `pnpm add`** |
| `console` on a non-comment line of `probe.ts` | **0** |
| `probe.ts` has `export const n: 180 = …` and `export const v: 1 = …` | **1 each** |
| trailing inline comments in either script | **none** |
| trailing inline comments in `probe.ts` | **exactly 1** — the sanctioned note on the `export const n` line |
| root `scripts["check:pack"]` / `scripts["check:node-floor"]` | `bash scripts/pack-install-check.sh` / `bash scripts/node-floor-check.sh` |
| `nodejs.org/dist` present, `${TMPDIR:-/tmp}` cache present | **yes** |

## Tree hygiene

`git status --porcelain` immediately before writing this SUMMARY is **empty** and `git diff` is
clean. Every scratch project this plan created lived in a `mktemp -d` **outside the repository** —
deliberately outside `packages/` and `examples/`, which `pnpm-workspace.yaml`'s globs would swallow —
and each was removed by its script's `trap … EXIT`. Verified by name after the runs: every directory
this plan created is gone.

Pre-existing directories under `$TMPDIR` were left alone and are **not** leaks from this plan:

| Directory | mtime | Attribution |
|---|---|---|
| `tmp.LXG8q68tDr`, `tmp.wgpqDkXibf`, `tmp.asKuPraZpH`, and 5 others | **2026-07-28** | the research session — `tmp.LXG8q68tDr`'s tsconfig reads `"module": "ESNext"`, `"skipLibCheck": true`, which is research's draft and not this script's output |
| `tmp.62h3BtJNdA` | 2026-07-29 08:20 | contains `p8-pattern.txt` / `p8-replacement.txt` — **mutant P8, a concurrently-running sibling plan's** working files, not this plan's |

Deleting either set would have been out of scope and, in the P8 case, actively harmful to a parallel
agent.

The floor-runtime cache at `$TMPDIR/node-v22.12.0` (201 MB) is **intentionally retained** — it is the
cache the script exists to build, it lives outside the repo, and re-downloading it costs ~11 s per
run.

No `git clean`, `git stash`, `git rm`, blanket checkout, or `git reset --hard` (past the mandated
worktree-base correction at agent start) was run at any point. Both mutations were applied and
restored inside a single `mutate-and-prove.sh` invocation so the `trap`-based restore always covered
them. The one install was `CI=true pnpm install --frozen-lockfile --prefer-offline` to bootstrap the
fresh worktree; `pnpm-lock.yaml` is byte-unchanged.

## Requirements status

`requirements-completed` is deliberately **empty** and `.planning/REQUIREMENTS.md` was **not
touched**, for three reasons:

1. It is not in this plan's `files_modified`, and this plan ran in a worktree concurrently with
   02-08 and 02-11. A shared-file edit here is a merge conflict for the orchestrator.
2. 02-05, 02-06 and 02-07 each left it untouched. Breaking that precedent mid-phase would leave the
   rows inconsistent for whoever closes them.
3. Both rows are, on the evidence above, **ready to close**:
   - **PKG-02** — *"A pack-and-install test imports the built artifact from a scratch project and
     typechecks against it"* — delivered in full and observed failing.
   - **PKG-03** — *"The declared Node floor matches the runtime the package actually works on"* —
     delivered in full and observed failing, on a floor that is asserted rather than assumed.

Rows 95–96 still read `- [ ]` and rows 212–213 still read `Pending`. Flagged so 02-12 does not read
the empty field as an oversight.

## Issues Encountered

**1. The floor cold-download cost is ~11 s, not research's ~4 s.** Diagnosed rather than assumed: the
compressed `content-length` reproduces to the byte (25,100,836 B), and the extracted tree is 201 MB,
so the extra time is xz decompression rather than transfer. Recorded and corrected above; nothing
depends on it.

**2. `pnpm test -- <name>` still does not filter.** Re-measured on this tree (3 files / 12 tests
versus 1 file / 3 tests). Not patched — see deviation 4; the owners remain 02-10 and 02-12.

## Deferred Items

| Item | Detail | Suggested owner |
|---|---|---|
| Close PKG-02 and PKG-03 in `REQUIREMENTS.md` | Both delivered and defect-proven here; rows 95–96 and 212–213 untouched for the reasons above. | 02-12 |
| No checksum verification on the Node tarball | Accepted residual, already in the threat register as **T-02-44**. `nodejs.org` publishes `SHASUMS256.txt` alongside every release; a two-line `shasum -c` would close it. Not done for v0.1 because the runtime is used only to *run* the artifact, never to build or publish it. | a hardening plan, post-v0.1 |
| The floor cache is 201 MB in `$TMPDIR` | Intentional and outside the repo, but it is real disk. CI runners are ephemeral so it costs one download per job unless cached. | 02-10, when it decides whether to cache `$TMPDIR/node-v22.12.0` |
| `/* @__PURE__ */` on `types.ts`'s three `Object.freeze` initializers | 02-06's and 02-07's carried item; untouched here, `types.ts` is out of scope. | 02-11 or a Phase 3 plan |

## Known Stubs

None. Both scripts were executed end to end on a real tarball and observed both passing on a correct
artifact and failing under a deliberate regression. There is no placeholder value, no hardcoded
empty return, no skipped step and no `TODO` in any of the three new files. Every branch that can
short-circuit — the pack-produced-no-tarball guard, the cold-download failure, the cached-runtime
version mismatch, the two `npm install` failures — reports a distinct message and a non-zero exit.

## Threat Model Outcomes

| Threat | Disposition | Evidence |
|---|---|---|
| T-02-40 a scratch project silently resolving the workspace copy | **mitigated** | `mktemp -d` outside the repo with the workspace-glob hazard named at the line; `npm install` rather than `pnpm add`; `typescript@7.0.2` installed into the scratch project so no repo-relative compiler is reachable. The negative control proves the harness can fail — TS2322, exit 1. |
| T-02-41 a published `.d.ts` that does not typecheck for consumers | **mitigated** | `skipLibCheck: false` fully checks the 77 kB shipped declarations under `"module": "node20"` (⇒ `moduleResolution: node16`, `moduleDetection: force`), `strict`, `exactOptionalPropertyTypes`. `@standard-schema/spec@1.1.0` is resolved from the registry, so the declaration's external import is genuinely exercised. |
| T-02-42 a floor claim verified only on the developer's newer runtime | **mitigated** | An exact pinned download asserted at `v22.12.0` before use, an in-job `process.version` assertion against the literal, and **mutant P10**, which passes on v24.14.1 (`DEV_EXIT=0`) and fails on the floor. Developer runtime recorded as v24.14.1 for contrast. |
| T-02-43 raising `engines.node` to make a broken floor job pass | **mitigated** | The package/contributor floor distinction is written at the exact line where the edit is tempting; the floor section invokes no pnpm (0 non-comment matches in the `awk` range); `git diff --exit-code packages/concierge/package.json` exits 0. |
| T-02-44 a Node runtime fetched over the network into the test path | **accepted** | HTTPS from `nodejs.org/dist`, cached in `$TMPDIR`, used only to *run* the artifact — never to build, typecheck or publish it. No checksum for v0.1; filed under *Deferred Items* as a residual rather than an oversight. |
| T-02-45 scratch directories persisting with installed packages | **mitigated** | `trap 'rm -rf "$OUT"' EXIT` in both scripts, verified by name after every run. `git status --porcelain` empty. The only retained directory is the floor-runtime cache, which is the script's deliberate output. |
| T-02-SC npm/pnpm installs | **mitigated, and held** | Every registry install happened inside a throwaway directory deleted on every exit path. No repo dependency was added; `pnpm-lock.yaml` and `pnpm-workspace.yaml` are byte-unchanged; `package.json` gained two `scripts` entries and no dependency. |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: network-fetch | `scripts/node-floor-check.sh` | New outbound HTTPS fetch to `nodejs.org/dist`, executed by a developer- and CI-invoked script, whose extracted contents are then **executed** as `$DIR/bin/node`. Already registered as **T-02-44** and dispositioned *accept* with the checksum gap named explicitly; flagged here so it is visible at the phase level and not only inside this plan's register. Not a consumer-facing surface — nothing under `scripts/` is in `packages/concierge`'s `files` array. |

`scripts/pack-install-check.sh` also reaches the npm registry, but only to install into a throwaway
directory; it executes nothing it downloads beyond `tsc`, which the repo already runs.

## User Setup Required

None. The floor runtime downloads itself on first run.

## Next Phase Readiness

1. **02-10 has two script names to call, and must call them in different jobs.** `pnpm run
   check:pack` belongs in the **build** job (it needs a modern Node and pnpm). The floor job must
   mirror `node-floor-check.sh`'s phase three — `actions/setup-node` with a **quoted, exact**
   `'22.12.0'`, then `npm init -y`, `npm install ./*.tgz`, the `process.version` assertion, and the
   import — with **no pnpm step of any kind**, because pnpm cannot start on that runtime.
2. **Do not write `pnpm test -- <name>` in `ci.yml`.** Re-measured here: the `--` form runs the whole
   suite. Drop the `--`.
3. **Do not "fix" a red floor job by raising `engines.node`.** That is the failure this plan's
   threat register calls T-02-43, and the reasoning is written into the script at the line.
4. **P10 is the only proof the floor job can fail**, and its shape is specific: a type-erased call to
   a built-in newer than the floor. Do not replace it with a mutation that also breaks the dev
   runtime — that proves nothing about the floor.
5. **PKG-02 and PKG-03 are ready to close in `REQUIREMENTS.md`** (rows 95–96 and 212–213). This plan
   deliberately did not touch that file; see *Requirements status*.
6. **Reference numbers for 02-12:** tarball **87,915 B**; `dist/index.js` **9,739 B** (unchanged from
   02-06 — this plan added no source); floor cold **~11 s** / warm **~2 s**; `check:pack` **~3–4 s**.
   The tree-shaking pair remains **63 B uncalled / 587 B called**, untouched by this plan.

## Self-Check: PASSED

Files claimed created/modified, verified present on disk:

- `scripts/pack-install-check.sh` — FOUND, 133 lines, mode 755; contains `mktemp -d` and
  `trap 'rm -rf "$OUT"' EXIT`; 0 non-comment `moduleResolution` matches; 0 non-comment `pnpm add`
  matches; 0 trailing inline comments
- `scripts/node-floor-check.sh` — FOUND, 144 lines, mode 755; contains `nodejs.org/dist` and
  `${TMPDIR:-/tmp}`; non-comment version inventory is exactly `22.12.0`; `awk '/PATH=/,0' | grep -v
  '^[[:space:]]*#' | grep -c pnpm` is **0**; `grep -cE 'nvm|fnm|volta'` is **0**; 0 trailing inline
  comments
- `packages/concierge/test/fixtures/probe.ts` — FOUND, 79 lines; `export const n: 180 =
  MESSAGE_MAX_CHARS;` at line 58 and `export const v: 1 = CONTRACT_VERSION;` present; 0 `console` on
  non-comment lines; exactly 1 trailing inline comment, the sanctioned one
- `package.json` — FOUND; `scripts["check:pack"]` is `bash scripts/pack-install-check.sh`;
  `scripts["check:node-floor"]` is `bash scripts/node-floor-check.sh`; no other key reordered or
  reformatted, and no dependency added
- `.planning/phases/02-packaging-build-and-release/02-09-SUMMARY.md` — FOUND

Commits claimed, verified in `git log`:

- `1f91d8f` — FOUND (`test(02-09): PKG-02 pack-and-install scratch harness with its negative control`)
- `14dd01d` — FOUND (`test(02-09): PKG-03 pin the exact Node floor, with npm and node only`)

`git diff --name-status 71d680b..HEAD` lists **exactly four** files before this SUMMARY commit —
`M package.json`, `A packages/concierge/test/fixtures/probe.ts`, `A scripts/node-floor-check.sh`,
`A scripts/pack-install-check.sh` — all inside this plan's declared `files_modified`. No
`pnpm-lock.yaml`, no `pnpm-workspace.yaml`, no `packages/concierge/package.json`, no file under
`packages/concierge/src/` or `test-d/`, and no `STATE.md`, `ROADMAP.md` or `REQUIREMENTS.md` appears.
No commit in this plan contains a deletion (`git diff --diff-filter=D` empty across the range).

---
*Phase: 02-packaging-build-and-release*
*Completed: 2026-07-29*
