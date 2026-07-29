---
phase: 02-packaging-build-and-release
plan: 07
subsystem: packaging
tags: [pkg-04, vitest, tree-shaking, side-effects, rolldown, export-surface, mutation-testing, silent-no-op]

# Dependency graph
requires:
  - phase: 02-packaging-build-and-release
    plan: "02-01"
    provides: "vitest@4.1.10 and rolldown@1.2.0 as root devDependencies, and scripts/mutate-and-prove.sh"
  - phase: 02-packaging-build-and-release
    plan: "02-03"
    provides: "the tsdown build and the export-surface baseline"
  - phase: 02-packaging-build-and-release
    plan: "02-06"
    provides: "CONTRACT_VERSION, assertSingleInstance, the exact registry key, and the 45-name surface"
provides:
  - "vitest.config.ts — the repository's first test runner; one node project, typecheck mode off"
  - "Root `test` script that actually runs tests: `pnpm -r test` (silent exit 0) -> `vitest run`"
  - "packages/concierge/test/single-instance.test.ts — F1a, F1b, F2 against the BUILT artifact"
  - "packages/concierge/test/artifact.test.ts — the five value exports pinned in dist/index.js"
  - "packages/concierge/test/export-surface.test.ts — the 45-name published surface pinned by count and by name"
  - "Mutants P6, P7 and P11 each observed failing; P6 explicitly NOT skipped"
  - "A measured correction to the P6 expectation: the module-scope form's fate is consumer-shape-dependent"
  - "A measured defect in the phase's own command vocabulary: `pnpm test -- <name>` does not filter"
affects:
  - "02-08 — adds fixtures.test.ts to this runner; F3's two fixture adapters complete PKG-04"
  - "02-09 — the Node-floor harness calls assertSingleInstance against the same artifact"
  - "02-10 — ci.yml must call `pnpm test <name>` without the `--`, or the filter silently does nothing"
  - "02-11 — the type-level MESSAGE_MAX_CHARS guard pairs with artifact.test.ts at a different sampling rate"
  - "02-12 — compares this SUMMARY's tree-shaking pair against 02-06's, and should carry the `--` correction into VALIDATION.md"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Runtime tests import ../dist/index.js and never ../src/; the acceptance grep is scoped to non-comment lines so the header prose may name what it forbids"
    - "Two-sided bundle assertion: assert the same substring present in one consumer bundle and absent from another, because only the pair discriminates"
    - "A vacuous check is recorded in a comment and deliberately not written as an assertion"
    - "Every comment is a standalone // or /** */ line — a trailing comment survives `grep -v '^[[:space:]]*[/*]'` and turns a compliant file red"
    - "Config comments name the diagnostic that fires when you get the setting wrong, following tsconfig.test-d.json's TS6059 note"

key-files:
  created:
    - vitest.config.ts
    - packages/concierge/test/single-instance.test.ts
    - packages/concierge/test/artifact.test.ts
    - packages/concierge/test/export-surface.test.ts
  modified:
    - package.json

key-decisions:
  - "F1b was NOT adjusted to match the plan's prediction about which side would fire under P6; the measurement was recorded and the divergence flagged instead"
  - "packages/concierge/test/** stays in no TypeScript program, for three named reasons written into vitest.config.ts"
  - "The ReadbackAttestation guard is documented in a header comment and deliberately not written"
  - "The `--` filtering defect is recorded, not patched: scripts.test must be exactly `vitest run` and 02-VALIDATION.md is outside this plan's files_modified"
  - "Task 3 produced no net file change, so it has no commit of its own; its deliverable is the evidence recorded here"

patterns-established:
  - "Diagnostic-through-the-harness: when a mutant's observed signature disagrees with the plan, re-apply the same mutation inside mutate-and-prove.sh with a measurement gate rather than mutating by hand"

requirements-completed: []

# Metrics
duration: 22min
completed: 2026-07-29
tasks: 3
commits: 2
files_changed: 5
---

# Phase 2 Plan 07: The first runtime tests this repository has ever had Summary

**`pnpm test` stopped being a silent exit-0 no-op and became twelve real assertions against the
built artifact — including the two-sided rolldown bundle check that is the only thing in the
repository able to see whether the duplicate-instance guard survives tree-shaking — and P6, P7 and
P11 were each observed failing, with P6 correcting a measured expectation the plan got backwards.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 3
- **Files changed:** 5 (4 created, 1 modified)

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Vitest config, a real test script, and the single-instance suite | `be7cfe4` | `vitest.config.ts`, `package.json`, `packages/concierge/test/single-instance.test.ts` |
| 2 | Artifact and export-surface guards, vacuous check recorded not written | `4d7eb30` | `packages/concierge/test/artifact.test.ts`, `packages/concierge/test/export-surface.test.ts` |
| 3 | Mutants P6, P7 and P11 | *(no net file change — see below)* | `src/contract.ts`, `src/index.ts` mutated and restored |

**Task 3 has no commit, and that is correct rather than an omission.** Each mutation is applied and
restored inside a single `mutate-and-prove.sh` invocation, so the task's output is evidence, not
source. `git diff --exit-code` is clean after every invocation and `git status --porcelain` is empty
at the end. An empty commit would have added a hash with nothing under it.

Net diff against the wave-4 base (`3516a1a`): `M package.json`, `A vitest.config.ts`,
`A packages/concierge/test/{single-instance,artifact,export-surface}.test.ts`. Nothing else.
`pnpm-lock.yaml`, `packages/concierge/package.json` and all of `packages/concierge/src/` are
byte-unchanged.

## What shipped

### `pnpm test` now means something

| | Before | After |
|---|---|---|
| root `scripts.test` | `pnpm -r test` | `vitest run` |
| output | *(nothing)* | `Test Files 3 passed (3)` / `Tests 12 passed (12)` |
| exit code | 0 | 0 |

The exit code is the same. That is the entire point: the "before" column is a green CI signal with
no behaviour behind it, and it is the signal a CI author wires up and trusts most.

The script is `vitest run` at the **root** and not `pnpm -r test` delegating to a package script,
because Vitest resolves its config from the working directory and does **not** search upward — a
`vitest run` executed inside `packages/concierge` would never find the root config. No `test` script
was added to `packages/concierge/package.json`; it is byte-unchanged.

### The three test files

| File | Tests | What it pins |
|---|---|---|
| `single-instance.test.ts` | 3 | F1a shared registry record, F1b tree-shaking survival, F2 the mismatch throw |
| `artifact.test.ts` | 5 | the five value exports surviving into `dist/index.js` |
| `export-surface.test.ts` | 4 | the 45-name published surface, by count, by split, by name, and by absence |

All twelve run against `../dist/index.js` or `../dist/index.d.ts`. No executable line in any of the
three references `../src/` — verified at 0 by the acceptance grep, while 10 comment lines across the
three files do name `../src/` as the thing they must never import, which is exactly why that grep is
scoped to non-comment lines.

### `vitest.config.ts` and the three things it writes down

One `node` project, `include: ["packages/*/test/**/*.test.ts"]`, **typecheck mode off**. The word
`typecheck` appears on 8 lines of the file and **all 8 are comments** — the non-comment count is 0.

The accepted, named limitation, repeated here because an acceptance criterion requires it:
`packages/concierge/test/**` is in **no TypeScript program**. `tsconfig.json` includes
`["src/**/*.ts"]`; `tsconfig.test-d.json` includes `["src/**/*.ts", "test-d/**/*.ts"]`. Neither
covers `test/`. Vitest transpiles without typechecking, so a type error in any of these four files
(including 02-08's `fixtures.test.ts`) is invisible to `pnpm typecheck` and surfaces only as a
runtime failure under `vitest run`. Extending `tsconfig.test-d.json`'s `include` was considered and
rejected for three concrete reasons:

1. These files use `node:fs`, `node:os` and `node:path`. Typechecking them requires `@types/node` in
   the package program, which CONTEXT.md locks out — it pulls DOM-adjacent globals and silently
   defeats the no-DOM guarantee `lib: ["ES2022"]` enforces.
2. They import `../dist/index.js`, a real on-disk path. Including them would make `pnpm typecheck`
   fail on a clean checkout until `pnpm build` had run — inverting the **`typecheck` before `build`**
   order that mutant P4 exists to justify and that 02-10's `ci.yml` and 02-12's clean-checkout gate
   both depend on.
3. `test/fixtures/probe.ts` imports `@fullselfbrowsing/concierge` by bare specifier and is compiled
   by a *foreign* program (02-09's scratch project). Keeping `test/fixtures/` out of this repo's own
   program is a feature, not an omission.

Vitest typecheck mode is **not** a substitute: its `typecheck.include` default matches Phase 1's four
`test-d/*.test-d.ts` files, which contain no `describe`/`it`, and enabling it errors in
`startTypechecker` and exits 1. The residual is stated plainly — `vitest run` is the only thing that
exercises these four files, and it runs in CI.

`tsconfig.json` and `tsconfig.test-d.json` are both byte-unchanged (`git diff --exit-code` exits 0).

## The tree-shaking measurement

Recorded in the plan's mandated wording, unchanged from 02-06 so that 02-12's comparison reads on one
pair:

> **63 B uncalled / 587 B called — the registry code itself contributes 0 bytes when uncalled.**

### F1b's own bundles, measured on this tree

rolldown 1.2.0, `platform: "neutral"`, `format: "es"`, consumers importing `dist/index.js` by
**absolute path** (the shape the plan specifies, and a different resolution path from 02-06's bare
specifier through a `node_modules` symlink):

| Consumer | Total chunk | Non-comment code | Registry key present? |
|---|---|---|---|
| `calls.mjs` — imports `assertSingleInstance` and calls it | **3,942 B** | 902 B | **Yes** |
| `uncalled.mjs` — imports `MESSAGE_MAX_CHARS` and re-exports it | **852 B** | 292 B | **No** |

Three numbers now exist for the same claim and none of them is 63/587. They are not in conflict —
they are three different consumer shapes:

| Source | Uncalled | Called | Consumer shape |
|---|---|---|---|
| 02-RESEARCH (canonical) | 63 B | 587 B | shape-faithful mirror package |
| 02-06 re-measure | 15 B | 918 B | bare specifier; uncalled consumer `console.log`s an inlined constant |
| **02-07, this plan** | **852 B** (292 B code) | **3,942 B** (902 B code) | absolute path; uncalled consumer **re-exports** the constant |

The load-bearing fact is identical in all three and is the only thing F1b asserts: **the registry key
is absent from the uncalled bundle and present verbatim in the calling one.**

The 852 B is larger than 02-06's 15 B for a reason worth carrying forward: a **re-export** keeps the
binding live, so rolldown must retain the module — and once the module is retained it also keeps
`types.ts`'s three `Object.freeze(...)` calls as bare side-effecting statements. That is 02-06's
deferred `/* @__PURE__ */` finding, reproduced independently here from a different direction, and it
accounts for essentially all of the 292 non-comment bytes. The uncalled bundle is printed in full in
the P6 failure output below, where those three calls are visible.

## Mutant proofs

All three used `scripts/mutate-and-prove.sh`. Every invocation returned harness exit **0** with
`PASS: gate fired (exit 1), tree clean`, and `git diff --exit-code` on the mutated file exits 0
afterwards.

### P6 — `assertSingleInstance` moved to module scope. **NOT SKIPPED.**

```
bash scripts/mutate-and-prove.sh packages/concierge/src/contract.ts \
  "$(cat /tmp/p6-pattern.txt)" "$(cat /tmp/p6-replacement.txt)" \
  -- bash -c 'pnpm build && pnpm test -- single-instance'
```

The pattern was the whole `export function assertSingleInstance(): void { … }` declaration read
verbatim from `contract.ts:145-166`. The replacement was the same read/write/throw logic as
**module-scope statements**, followed by `export function assertSingleInstance(): void { return; }`
so the export still exists.

| | |
|---|---|
| harness stdout | `PASS: gate fired (exit 1), tree clean` |
| harness exit | **0** |
| suite result | `Test Files 1 failed | 2 passed (3)` — `Tests 2 failed | 10 passed (12)` |
| failing test 1 | **F1b** — the registry reaches a calling bundle and contributes zero bytes to one that does not call |
| failing test 2 | **F2** — a contract-version mismatch throws a message naming both versions and the remediation |
| **passing** | **F1a** |

F1b's assertion message:

```
AssertionError: expected 'Object.freeze({\n\tok: false,\n\treas…'
  not to contain '@fullselfbrowsing/concierge.contract'
   ❯ packages/concierge/test/single-instance.test.ts:151:26
```

The received bundle contains, verbatim,
`const REGISTRY_KEY = Symbol.for("@fullselfbrowsing/concierge.contract");` followed by
`const holder = globalThis; const prior = holder[REGISTRY_KEY]; if (prior === void 0) … else if
(prior.version !== 1) throw new Error(…)` — in a consumer that never calls the guard.

F2's failure, exactly as the plan predicted and **not** an anomaly:

```
Error: concierge: two different copies of @fullselfbrowsing/concierge are loaded
(contract v0 and v1). …
 ❯ packages/concierge/src/contract.ts:151:9
```

The frame is `contract.ts`, not the test: under the module-scope mutant the registration runs during
*module evaluation*, so `await import(...)` rejects before `expect(() => …).toThrow()` ever executes.

**F1a passed, and that is the whole reason F1b exists.** The module-scope form survives into
`dist/index.js`, so under Node it still registers, and F1a is structurally blind to the regression.
F1b is the only assertion in this repository that can see it.

#### The correction: the plan predicted the wrong side, and the assertion was NOT adjusted to match

The plan's acceptance criterion expected F1b's message to show that **`calls.mjs` no longer
contains** the registry key. It fired from the opposite direction: **`uncalled.mjs` now *does*
contain it.** The plan also instructed that if rolldown had *retained* the module-scope registration
this should be escalated rather than accommodated. Those two conditions came apart — rolldown
retained it *and* F1b fired — so rather than touch the assertion, the same mutation was re-applied
inside another `mutate-and-prove.sh` invocation with a measurement gate, bundling four consumer
shapes against the mutated artifact:

| Consumer shape under the P6 mutant | Registry key present? | Bytes |
|---|---|---|
| A — `console.log(MESSAGE_MAX_CHARS)` (research's shape) | **No** | 144 B |
| B — `console.log(CONTRACT_VERSION, MESSAGE_MAX_CHARS)` (research's shape) | **No** | 147 B |
| C — `export { MESSAGE_MAX_CHARS }` (F1b's uncalled consumer) | **Yes** | 4,339 B |
| D — `assertSingleInstance()` called (F1b's calling consumer) | **Yes** | 3,732 B |

**Research is corroborated, not contradicted.** Rows A and B reproduce `02-RESEARCH.md:170-175`
exactly — including 02-06's 147 B figure for row B. What research measured is true in research's
shape, where every imported binding is an inlinable constant so the whole module evaluation can be
dropped.

The correct, sharper statement is that **the module-scope form's fate is consumer-shape-dependent,
and it is wrong in both directions**:

- every imported binding inlinable -> the module evaluation is dropped -> **the guard is silently
  disarmed** (research's measurement; the reason the check lives in a function body);
- any binding must stay live — a re-export, or a function that is called -> the module is retained ->
  **the registry code rides into consumers that never asked for it**, carrying an import-time throw
  that would take down an SSR render.

The function-body form is correct under both. The plan's expectation could never have held for
`calls.mjs` specifically, because a consumer that *calls* `assertSingleInstance` necessarily keeps
the module live. F1b remains exactly as written; only the prediction about which side fires was
wrong.

### P7 — a contract-version mismatch stops being detected

```
bash scripts/mutate-and-prove.sh packages/concierge/src/contract.ts \
  'export const CONTRACT_VERSION = 1;' 'export const CONTRACT_VERSION = 0;' \
  -- bash -c 'pnpm build && pnpm test -- single-instance'
```

| | |
|---|---|
| harness stdout | `PASS: gate fired (exit 1), tree clean` |
| harness exit | **0** |
| suite result | `Test Files 2 failed | 1 passed (3)` — `Tests 2 failed | 10 passed (12)` |
| failing test | **F2** |
| assertion message | `AssertionError: expected [Function] to throw an error` — Expected `null`, Received `undefined`, at `single-instance.test.ts:164:42` |

Nothing was thrown: the seeded prior record `{ version: 0 }` now matches the mutated current version,
so the adopt branch is taken. This is the "bumped in one of two loaded copies" case from the other
side, and it proves F2's throw assertion is load-bearing rather than incidental.

A second test also failed — `artifact.test.ts > CONTRACT_VERSION reaches dist/index.js as the integer
1`, `AssertionError: expected +0 to be 1`. That is a bonus independent guard on the same regression,
and it appears in this run only because of the `--` filtering defect recorded below. F1a passed, as
expected: it reads `alpha.CONTRACT_VERSION` and so tracks the mutant.

The plan's `<verify><automated>` block for Task 3 is this same P7 invocation followed by
`git diff --exit-code && pnpm build && pnpm test`. Run verbatim: **`P7_PROVEN`**.

### P11 — `MESSAGE_MAX_CHARS` dropped from `index.ts`'s export list

```
P11_PATTERN=$(printf '  MESSAGE_MAX_CHARS,\n} from "./types.js";')
bash scripts/mutate-and-prove.sh packages/concierge/src/index.ts \
  "$P11_PATTERN" '} from "./types.js";' \
  -- bash -c 'pnpm build && pnpm test -- export-surface'
```

The two-line sequence occurs exactly once (verified by count before mutating — the type block's tail
ends with `  SessionConfig,`). Both lines contain a `/`, so this mutant also re-exercises the
`perl`-via-environment fix from plan 02-02.

| | |
|---|---|
| harness stdout | `PASS: gate fired (exit 1), tree clean` |
| harness exit | **0** |
| suite result | `Tests 5 failed | 7 passed (12)` |
| failing test | **the export-surface count guard** |
| assertion message | ``AssertionError: expected [ 'AbandonReason', …(43) ] to have a length of 45 but got 44`` at `export-surface.test.ts:122:19` |

**44 names against an expected 45.** `02-VALIDATION.md`'s measured signature reads *"42 names instead
of 43"*; it was measured before `contract.ts` added `CONTRACT_VERSION` and `assertSingleInstance` to
the surface. Both pairs are recorded here so the discrepancy is explained rather than discovered:
the invariant proven is the identical −1 delta, `43 -> 42` then and `45 -> 44` now.

The four other failures are all the same defect seen from different levels, and are worth naming
because they are the "different sampling rates, same defect" pairing working as designed:

| Also failed | Message |
|---|---|
| `export-surface > splits 39 types to 6 values` | `expected […] to have a length of 6 but got 5` |
| `export-surface > carries all six runtime value exports by name` | `expected […] to include 'MESSAGE_MAX_CHARS'` |
| `artifact > MESSAGE_MAX_CHARS reaches dist/index.js as a value, at 180` | `expected undefined to be 180` |
| `single-instance > F1b` | rolldown `[MISSING_EXPORT] "MESSAGE_MAX_CHARS" is not exported by ".../dist/index.js"` — a hard bundle error, not an assertion failure |

## Deviations from Plan

### Auto-fixed / recorded issues

**1. [Rule 1 - Bug] `pnpm test -- <name>` does not filter by filename. The documented command
vocabulary of this phase is wrong.**

- **Found during:** Task 2, running the plan's own `<verify>` block.
- **Issue:** `02-VALIDATION.md` states that "`02-VALIDATION.md` names `pnpm test -- export-surface`
  as this guard's command and Vitest filters by filename". It does not. Vitest's cac-based CLI
  swallows everything after `--`, so the filter argument is silently discarded and the **entire
  suite** runs. Measured, immediately after Task 2 when three test files existed:

  | Command | Test files run | Tests run |
  |---|---|---|
  | `pnpm exec vitest run artifact` | **1** | 5 |
  | `pnpm exec vitest run -- artifact` | **3** | 12 |
  | `pnpm run test artifact` | **1** | 5 |
  | `pnpm test -- artifact` | **3** | 12 |

- **Why this matters and is not cosmetic:** it is the same failure family the plan exists to close —
  a command that reports success while doing something other than what it says. Every `-- <name>`
  gate still *fires* correctly (any failure anywhere makes the run non-zero), so no proof in this
  plan is invalidated. What is lost is **specificity**: each mutant proof above reports extra failing
  tests from files the gate was never meant to run, which is why P7 shows two failures and P11 shows
  five.
- **Fix applied:** none in code, deliberately. `scripts.test` must be **exactly** `vitest run` (an
  acceptance criterion of this plan and independently correct), and `02-VALIDATION.md` is outside
  this plan's `files_modified`. The remedy is one character wide and belongs to the callers: **drop
  the `--`**. Both forms were run for every gate in this plan; both green states and all three
  mutant proofs hold under either.
- **Carried to:** 02-10 (`ci.yml` must not write `pnpm test -- <name>`) and 02-12 (correct the three
  `02-07-T*` rows and the PKG-04a row in `02-VALIDATION.md`).

**2. [Recorded, not fixed] P6's expected failure direction was wrong in the plan.** Full treatment in
the P6 section above. No assertion was adjusted to match the plan; a diagnostic was run instead and
the measurement is recorded. This is the plan's own instruction — *"record the observed bundle output
and escalate rather than adjusting the assertion to match"* — honoured in the only form available
once F1b had in fact fired.

Nothing else deviated. Three tasks, five files, the mandated command forms, the mandated comment
discipline, the mandated numbers.

## Verification

Both `<verify><automated>` blocks and the Task 3 block were run verbatim.

| Block | Result |
|---|---|
| Task 1 — `pnpm build && pnpm test -- single-instance && …` | **`SINGLE_INSTANCE_OK`** |
| Task 2 — `pnpm build && pnpm test -- artifact && pnpm test -- export-surface && …` | **`ARTIFACT_GUARDS_OK`** |
| Task 3 — P7 invocation `&& git diff --exit-code && pnpm build && pnpm test` | **`P7_PROVEN`** |

Plan-level `<verification>` block on the final tree:

| Check | Result |
|---|---|
| `pnpm test` runs Vitest from the root and reports real tests | **12 tests, 3 files** |
| `pnpm test single-instance` / `artifact` / `export-surface` | **0** / **0** / **0** (3, 5, 4 tests) |
| `pnpm test -- single-instance` / `-- artifact` / `-- export-surface` | **0** each (12 tests — see deviation 1) |
| no test file references `../src/` on an executable line | **0** across all three files |
| F1b asserts the key present in the calling bundle and absent in the uncalled one | **yes**, both directions |
| P6 / P7 / P11 observed failing, every failing test named | **yes** — P6: F1b **and** F2 |
| `pnpm typecheck` | **0** |
| `pnpm build` (attw + publint clean) | **0** |
| `pnpm run check:deps` | **0** |
| `pnpm run check:artifact` | **0** |
| `git diff --exit-code` | **0** |
| `git status --porcelain` | **empty** |

Acceptance-criteria spot checks:

| Criterion | Measured |
|---|---|
| `scripts.test` is exactly `vitest run`; `scripts.build` still `pnpm -r build` | **yes** |
| `packages/concierge/package.json` unchanged | `git diff --exit-code` **0** |
| `tsconfig.json` / `tsconfig.test-d.json` unchanged | `git diff --exit-code` **0** |
| `grep -c "typecheck" vitest.config.ts` | **8**, all comments (non-comment count **0**) |
| `Symbol.for("@fullselfbrowsing/concierge.contract")` literal in the test | **1** |
| `grep -c "expect(.*ReadbackAttestation" export-surface.test.ts` | **0** — recorded, not written |
| `grep -c "ReadbackAttestation" export-surface.test.ts` | **2**, both comments |
| `expectTypeOf` in either Task 2 file | **0** |
| `--watch` anywhere in this plan | **0** |
| trailing inline comments in any of the four files | **none** |
| leaked temp directories under `TMPDIR` or `/tmp` | **none** |

## Tree hygiene

`git status --porcelain` immediately before writing this SUMMARY is **empty**, and `git diff` is
clean. Every measurement ran inside a `mkdtemp` under `os.tmpdir()` — outside the repo, and
deliberately outside `packages/`, which `pnpm-workspace.yaml`'s `packages/*` glob would swallow — and
F1b's `afterEach` removes its scratch directories unconditionally, so a failing assertion cannot leak
one. Verified after the full run: no `concierge-treeshake-*` directory remains under either `/tmp` or
`TMPDIR`.

Every mutation was applied and restored inside a single `mutate-and-prove.sh` invocation, including
the P6 diagnostic, which was run *through the harness* with a forced non-zero exit rather than by
hand precisely so the `trap`-based restore still covered it. No `git clean`, `git reset --hard` (past
the mandated worktree-base correction at agent start), `git stash`, or blanket checkout was run at
any point. The one install was `CI=true pnpm install --frozen-lockfile --prefer-offline` to bootstrap
the fresh worktree; `pnpm-lock.yaml` is byte-unchanged.

## Requirements status

`requirements-completed` is deliberately **empty**, following 02-05's and 02-06's precedent, and
`.planning/REQUIREMENTS.md` was not touched.

**PKG-04** reads *"The package publishes ESM-only, and a test asserts a single core instance is
shared across adapters."* This plan delivers the runtime half — F1a asserts two independently
evaluated copies converge on one registry record, F2 asserts a mismatch fails loudly, F1b asserts the
mechanism survives the bundler. The words **"across adapters"** are still literally unmet: there are
no adapters. 02-08's F3 — two workspace fixture packages declaring core as a `peerDependency` — is
what makes the install graph real. Marking PKG-04 complete here would be false by one clause.

PKG-04 and PKG-05 are both ready to close after 02-08. Flagged so 02-12 does not read the empty field
as an oversight.

## Issues Encountered

**1. The `--` filtering defect.** Diagnosed rather than assumed, measured four ways, recorded as
deviation 1 above with the exact remedy and the two downstream owners.

**2. P6's failure arrived from the opposite side.** Diagnosed rather than accommodated: four consumer
shapes bundled against the mutated artifact established that research's measurement reproduces
exactly in research's shape and that the naive form is unreliable in both directions. Recorded in
full above. No assertion was weakened.

## Deferred Items

| Item | Detail | Suggested owner |
|---|---|---|
| Correct the `pnpm test -- <name>` command form in `02-VALIDATION.md` | Rows `02-07-T1`, `02-07-T2`, `02-07-T3` and the `PKG-04a` row all name a command whose filter is silently discarded. One character each. | 02-12 |
| Do not write `pnpm test -- <name>` in `ci.yml` | Same defect; in CI it means every job runs the whole suite while appearing targeted. | 02-10 |
| `/* @__PURE__ */` on `types.ts`'s three `Object.freeze` initializers | 02-06's deferred item, independently corroborated here: it is essentially all 292 non-comment bytes of F1b's uncalled bundle. `types.ts` is out of scope for this plan. | 02-11 or a Phase 3 plan that opens `types.ts` |
| `packages/concierge/test/**` is in no TypeScript program | Accepted with three named reasons (above and in `vitest.config.ts`). Revisit only if a type error in a test file ever costs real debugging time. | not scheduled — accepted |

## Known Stubs

None. Every assertion in all three files runs against the built artifact and was observed both
passing on a correct build and failing under a deliberate regression. There is no placeholder value,
no hardcoded empty return, no skipped test, and no `TODO` in any of the four files. The one check
that *would* have been a stub — `ReadbackAttestation` — is documented as vacuous and deliberately not
written, and an acceptance grep asserts its absence.

## Threat Model Outcomes

| Threat | Disposition | Evidence |
|---|---|---|
| T-02-29 `pnpm test` exiting 0 with no tests | **mitigated** | Root `test` is `vitest run` against a config Vitest can find from the root. 12 real tests. The residual — `-- <name>` silently not filtering — is recorded as deviation 1 and does not restore the silent-green mode, because the suite still runs and still fails. |
| T-02-30 a duplicate-instance guard removed by tree-shaking | **mitigated, and sharpened** | F1b bundles two real consumers and asserts the registry key present when called, absent when not. Mutant P6 proved it fires; F1a provably did not. The P6 diagnostic further established that the naive form is wrong in *both* directions, which strengthens the case for the shipped form. |
| T-02-31 consent armed on one core instance invisible to another | **mitigated** | F1a: two distinct module namespaces, two distinct function objects, one `globalThis` record. F2: a version mismatch throws, and the message satisfies `/two different copies/` and `/peerDependency/` as two separate expectations. |
| T-02-32 an internal declaration becoming publicly importable | **mitigated** | `export-surface.test.ts` pins 45 names, the 39/6 split, all six value names, and the absence of `serverChallengeBrand` and `ConsentAckBase` **from the parsed export list** rather than from the file. P11 proved it fires. |
| T-02-33 a vacuous assertion counted as coverage | **mitigated** | The `ReadbackAttestation` check is documented in the file header and not written; `grep -c "expect(.*ReadbackAttestation"` is 0. |
| T-02-34 Vitest typecheck mode silently collecting `test-d/` | **mitigated** | Typecheck mode is off, with the reason and the reproduced `startTypechecker` failure named in a config comment. The 8 occurrences of the token are all comments. |
| T-02-SC npm/pnpm installs | **accepted, and held** | This plan installed nothing and added no dependency edge. `pnpm-lock.yaml` byte-unchanged; `check:deps` re-run green. |

## Threat Flags

None. This plan adds no network endpoint, no auth path, no schema at a trust boundary. It adds file
reads (`dist/index.js`, `dist/index.d.ts`) and temp-file writes, all inside the repo's own build
output and `os.tmpdir()`, all in test-only code that is not published — `packages/concierge`'s
`files` array lists `dist`, `src`, `README.md` and `LICENSE`, and not `test`.

## User Setup Required

None.

## Next Phase Readiness

1. **02-08 adds `fixtures.test.ts` to an existing, working runner.** The `include` glob
   `packages/*/test/**/*.test.ts` already covers it; no config change is needed. F3's two fixture
   adapters are the last clause of PKG-04.
2. **Use `pnpm test <name>`, never `pnpm test -- <name>`.** The `--` form runs the whole suite. This
   is the single most transferable finding in this plan.
3. **The export surface is 45 names in one trailing block.** No union logic was needed; the union is
   written defensively anyway, and a parse that finds zero blocks throws a message that says the
   parser changed rather than the surface.
4. **F1b is the only check that can see tree-shaking**, and it now has a proven failure mode in each
   direction. Do not "simplify" it to one bundle.
5. **`dist/index.js` is 9,739 B**, unchanged from 02-06 — this plan added no source code.
6. **The tree-shaking pair for 02-12's comparison is 63 B / 587 B**, identical to 02-06's. This
   plan's own 852 B / 3,942 B measurement is labelled separately and is not a substitute.

## Self-Check: PASSED

Files claimed created/modified, verified present on disk:

- `vitest.config.ts` — FOUND, 94 lines; one `node` project; `typecheck` on 8 comment lines and 0
  code lines
- `packages/concierge/test/single-instance.test.ts` — FOUND, 167 lines; contains
  `Symbol.for("@fullselfbrowsing/concierge.contract")` once; 0 executable references to `../src/`
- `packages/concierge/test/artifact.test.ts` — FOUND, 80 lines
- `packages/concierge/test/export-surface.test.ts` — FOUND, 147 lines; contains the literal `45`;
  `ReadbackAttestation` twice, both in comments; 0 written assertions about it
- `package.json` — FOUND; `scripts.test` is `vitest run`; `scripts.build` still `pnpm -r build`

Commits claimed, verified in `git log`:

- `be7cfe4` — FOUND (`test(02-07): vitest config, a real test script, and the single-instance suite`)
- `4d7eb30` — FOUND (`test(02-07): artifact and export-surface guards, vacuous check recorded not written`)

`git diff --name-status 3516a1a..HEAD` lists **exactly five** files before this SUMMARY commit —
`M package.json`, `A vitest.config.ts`, and the three new test files — all inside this plan's declared
scope. No `pnpm-lock.yaml`, no `packages/concierge/package.json`, no file under
`packages/concierge/src/`, no `STATE.md`, `ROADMAP.md` or `REQUIREMENTS.md` appears. No commit in this
plan contains a deletion (`git diff --diff-filter=D` empty across the range).

---
*Phase: 02-packaging-build-and-release*
*Completed: 2026-07-29*
