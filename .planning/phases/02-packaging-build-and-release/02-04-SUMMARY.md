---
phase: 02-packaging-build-and-release
plan: 04
subsystem: testing
tags: [mutation-testing, defect-first-proof, publint, attw, tsdown, packaging, pkg-01]

# Dependency graph
requires:
  - "02-02 — scripts/mutate-and-prove.sh, the harness every mutation below runs through"
  - "02-03 — pnpm build (tsdown + in-build publint/attw at level error) and root check:artifact"
provides:
  - "P1, P2, P3a, P3b and P4 each observed failing their named gate, with verbatim exit codes and diagnostics"
  - "PKG-01d demonstrated: BUILD_EXIT=0 while pnpm typecheck exits 1 on one and the same mutant"
  - "Measured correction: tsdown's in-build publint/attw run against a PACKED view, not the source tree"
  - "Measured correction: the files-omits-dist defect yields 2 publint errors, not the research-recorded 4"
affects:
  - "02-10 — ci.yml MUST run `pnpm typecheck` BEFORE `pnpm build`; P4 is the reason"
  - "02-12 — re-proves P4 at the phase gate; the recipe and signatures here are the reference"
  - "02-RESEARCH.md:564 and :576 — two [VERIFIED] claims corrected by measurement"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Defect-first proof (shared pattern C): every gate observed non-zero with its verbatim diagnostic recorded"
    - "Every mutation applied and restored inside one mutate-and-prove.sh invocation, with git diff --exit-code asserted in the same shell call"
    - "Controls are measured, not asserted — the P2 control was run and it falsified the plan's expectation"

key-files:
  created:
    - .planning/phases/02-packaging-build-and-release/02-04-SUMMARY.md
  modified: []

key-decisions:
  - "The plan's P2 control expectation was falsified by measurement and is reported as a finding, not absorbed: `pnpm build` DOES catch files-omits-dist, because tsdown's in-build gates pack"
  - "P3a's error count was asserted (exactly 2) as the plan required; P2's count was recorded (2, not 4) and escalated because it differs by two, not the one the plan allowed for"
  - "No per-task commit exists: both tasks changed zero tracked files, exactly as `files_modified: []` declares. The evidence is the deliverable and it ships with this SUMMARY"

requirements-completed: [PKG-01]

# Metrics
duration: ~16min
completed: 2026-07-28
tasks: 2
commits: 1
files_changed: 1
---

# Phase 02 Plan 04: Proving the PKG-01 gates fire — Summary

**All five mutants (P1, P2, P3a, P3b, P4) were observed failing their named gate with verbatim exit
codes recorded, P4 included and not skipped — and two `[VERIFIED]` research claims were falsified by
the measurements taken to prove them.**

## Performance

- **Duration:** ~16 min
- **Completed:** 2026-07-28T23:43:00Z
- **Tasks:** 2
- **Files modified:** 0 created, 0 modified (plus this SUMMARY)

## Task Commits

1. **Task 1: Mutants P1, P2 and P3** — **no commit of its own.** The task changed zero tracked files.
2. **Task 2: Mutant P4** — **no commit of its own.** The task changed zero tracked files.

This is not an omission. The plan declares `files_modified: []` and states *"This plan modifies no
file permanently."* Both tasks are pure proof tasks whose deliverable is recorded evidence; the only
committable artifact is this SUMMARY. Same handling as plan 02-02 Task 2, for the same reason.

**Net diff against the wave-2 base (`a71f421`): 1 file — this SUMMARY.** `pnpm-lock.yaml` is
byte-unchanged; nothing was installed beyond the mandated
`CI=true pnpm install --frozen-lockfile --prefer-offline` bootstrap of an empty worktree.

## Baseline, established before any mutation

So that every failure below is attributable to its mutation and nothing else:

| Command | Exit |
|---|---|
| `pnpm build` | **0** — `✔ [attw] No problems found (279ms)`, `✔ [publint] No issues found (300ms)` |
| `pnpm run check:artifact` | **0** — publint `All good!`, attw `node16 (from ESM) 🟢 (ESM)` |
| `pnpm typecheck` | **0** |
| `git status --porcelain` | empty |

Toolchain as measured: Node **v24.14.1**, pnpm **11.17.0**, tsdown **0.22.14** / rolldown **1.2.0**,
publint **0.3.22**, attw **0.18.5**, TypeScript **7.0.2**.

---

# Task 1 — P1, P2, P3a, P3b

## P1 — `exports["."].types` points at a file that does not exist

**Command line, verbatim:**

```bash
bash scripts/mutate-and-prove.sh packages/concierge/package.json \
  '      "types": "./dist/index.d.ts",' \
  '      "types": "./dist/nope.d.ts",' \
  -- pnpm build
```

The pattern is the **six-space-indented** line inside `exports`, not the two-space top-level `"types"`
at line 28. Both operands contain `/` — the case plan 02-02's harness fix exists for. No exit-3
"moved target" abort occurred; the pinned pattern still matches verbatim.

| | Value |
|---|---|
| **Harness exit** | **0** |
| **Harness stdout verdict** | `PASS: gate fired (exit 1), tree clean` |
| **`pnpm build`'s own exit code** | **1** |

**Gate diagnostic, verbatim (first lines of each gate's output):**

```
 ERROR  [attw] problems found:
  🎯 Fallback condition used (node16-esm) at @fullselfbrowsing/concierge
  🎯 Fallback condition used (bundler) at @fullselfbrowsing/concierge


 ERROR  [publint] pkg.exports["."].types is ./dist/nope.d.ts but the file does not exist.

[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @fullselfbrowsing/concierge@0.0.0 build: `tsdown`
Exit status 1
```

Both gates fired, both at **ERROR** level, and the build **exited 1** — `✔ Build complete in 42ms`
appears immediately above, so tsdown transpiled fine and it is the gates that failed the build. That
is exactly the shape the criterion needs: the gate, not the bundler, is what says no.

Note the attw diagnostic is `Fallback condition used`, not a missing-types error. attw resolves
through the `default` condition when `types` is unresolvable, so the *symptom* of a broken types
target is a silent fallback. Recorded because a reader grepping for "types" in attw's output would
find nothing and wrongly conclude attw was silent.

## P2 — `files` omits `dist`

**Command line, verbatim:**

```bash
bash scripts/mutate-and-prove.sh packages/concierge/package.json \
  '  "files": [
    "dist",
    "src",
    "README.md",
    "LICENSE"
  ],' \
  '  "files": [
    "README.md"
  ],' \
  -- pnpm run check:artifact
```

The pattern was copied verbatim from the current manifest, which includes the `"src"` entry plan
02-03 added.

| | Value |
|---|---|
| **Harness exit** | **0** |
| **Harness stdout verdict** | `PASS: gate fired (exit 1), tree clean` |
| **Gate exit** | **1** |
| **publint errors on the packed tarball** | **2** — *not the 4 the research recorded; see below* |

**Gate diagnostic, verbatim:**

```
Running publint v0.3.22 for @fullselfbrowsing/concierge...
Packing files with `pnpm pack`...
Linting...
Errors:
1. pkg.types is ./dist/index.d.ts but the file is not published. Is it specified in pkg.files?
2. pkg.exports["."].types is ./dist/index.d.ts but the file is not published. Is it specified in pkg.files?
undefined
[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command failed with exit code 1: publint --strict
```

`attw` produced **no output** — `check:artifact`'s `&&` short-circuited at publint, as designed.

### The count is 2, not 4 — escalated, not absorbed

The plan allowed the count to *"differ by one"* because 02-03 added `"src"` to `files`. It differs by
**two**, so this is reported as a finding. Two probes were run to make sure the discrepancy is not an
artifact of my narrower mutant:

**Probe 1 — the research mutant verbatim.** `files` replaced with `[]`, exactly
`02-RESEARCH.md:576`'s D5. Byte-identical result: the same **2** numbered errors, the same trailing
`undefined`, exit 1. The 4-error figure does not reproduce on publint 0.3.22 against this package.

**Probe 2 — is a third error failing to render?** The stray `undefined` line raised the possibility
that publint found 3 errors and could only format 2. Settled with publint's Node API under the same
live mutation:

```
MESSAGE_COUNT=2
[
  { "code": "FILE_NOT_PUBLISHED", "args": {}, "path": ["types"], "type": "error" },
  { "code": "FILE_NOT_PUBLISHED", "args": {}, "path": ["exports", ".", "types"], "type": "error" }
]
```

publint emits **exactly two message objects**. The `undefined` is a cosmetic publint 0.3.22 CLI
artifact printed after a non-empty error list — it is absent from the green baseline run (`All
good!`, zero `undefined` occurrences) and appeared in all three failing runs. **No error is hidden
behind it.**

Also worth recording: publint flags only the two **types** paths. `pkg.main` and
`pkg.exports["."].default` — both `./dist/index.js`, equally unpublished — are **not** reported. A
package with no `types` field could therefore omit `dist` and pass publint entirely. `attw` is what
covers that case (see the control below, where it reports `Package has no types`). The two gates are
complementary, and this is a concrete instance of why neither alone is sufficient.

### The P2 control — the plan's stated expectation is FALSE, and here is the measurement

The plan asked me to *"note in the SUMMARY that `pnpm build` alone is **not** expected to catch P2"*
and to explain it as *"the in-build gate reads the source-tree manifest, not the tarball."* Hard
constraint 5 forbids asserting what a gate would do, so the control was **run** rather than noted.

**It fires.** Same mutation, gate `pnpm build`:

```
BUILD_EXIT=1
 ERROR  [attw] Package has no types
 ERROR  [publint] pkg.exports["."].types is ./dist/index.d.ts but the file does not exist.
 ERROR  [publint] pkg.types is ./dist/index.d.ts but the file does not exist.
```

Harness verdict: `PASS: gate fired (exit 1), tree clean`, harness exit **0**.

The mechanism is visible in the diagnostic itself. publint says `./dist/index.d.ts` **does not
exist** — while the file is physically present on disk at that moment. Proven in the same
invocation, immediately after the failing build:

```
ON_DISK:
-rw-r--r--@ 1 lakshman  staff  71684 Jul 28 18:40 packages/concierge/dist/index.d.ts
```

A 71,684-byte file that the in-build gate calls nonexistent is not being read from the source tree.
And `attw`'s `Package has no types` is only derivable from a tarball. **tsdown 0.22.14's in-build
`publint`/`attw` integrations pack first**; publint 0.3's `pack` option defaults to auto.

**This corrects two inputs:**

1. `02-RESEARCH.md:564` — *"the in-build gate runs against the source tree manifest, whereas the
   standalone run packs first — and one of the five defects below is only visible after packing."*
   Measured: both pack. `[VERIFIED]` marker not warranted for this clause.
2. The plan's own P2-control acceptance criterion, which asks the SUMMARY to state something that is
   not true of this toolchain.

**Does `check:artifact` become redundant? No — but its justification changes.** The "only visible
after packing" rationale is gone. What remains, and is sufficient:

- It runs the gates **without running the build**, so CI keeps a gate on the artifact even if the
  build script, `tsdown.config.ts`, or the tsdown gate integration regresses. A gate that lives
  *inside* the thing it checks is not independent of it. T-02-10 is precisely the threat of that
  integration silently degrading to a report — `attw: true` exits 0, and 02-03 had to configure
  `level: "error"` explicitly to prevent it.
- It packs with real `pnpm pack` and runs `attw --pack` against the tarball a consumer receives,
  rather than through a bundler plugin's view of it.
- It is a plain root script, so it is runnable in a publish-time job that does no building at all.

Kept, with the honest reason recorded in place of the inaccurate one.

## P3a — `type: "commonjs"` with ESM output, gated by `publint --strict` alone

**Command line, verbatim:**

```bash
bash scripts/mutate-and-prove.sh packages/concierge/package.json \
  '  "type": "module",' \
  '  "type": "commonjs",' \
  -- pnpm --filter @fullselfbrowsing/concierge exec publint --strict
```

| | Value |
|---|---|
| **Harness exit** | **0** |
| **Harness stdout verdict** | `PASS: gate fired (exit 1), tree clean` |
| **Gate exit** | **1** |
| **publint errors** | **exactly 2** — asserted, as the plan requires |

```
Errors:
1. pkg.main is ./dist/index.js and is written in ESM, but is interpreted as CJS. Consider using the .mjs extension, e.g. ./dist/index.mjs
2. pkg.exports["."].default is ./dist/index.js and is written in ESM, but is interpreted as CJS. Consider using the .mjs extension, e.g. ./dist/index.mjs
```

The count is **2**, matching the measured signature exactly. Nothing to escalate. (The trailing
`undefined` line appears here too, confirming it tracks "publint printed errors" and not any
particular defect.)

Note the suggested fix in publint's own text — *"Consider using the .mjs extension"* — is a change
this project must not make. It is the same class of trap 02-03 documented for attw's default
profile: the linter's advice, followed literally, edges toward reversing the locked ESM-only
decision. Recorded, not acted on.

## P3b — the same mutation, gated by `attw` alone

**Command line, verbatim** (this is also Task 1's `<verify><automated>` block, run verbatim):

```bash
bash scripts/mutate-and-prove.sh packages/concierge/package.json \
  '  "type": "module",' \
  '  "type": "commonjs",' \
  -- pnpm exec attw --pack packages/concierge --profile esm-only
```

| | Value |
|---|---|
| **Harness exit** | **0** |
| **Harness stdout verdict** | `PASS: gate fired (exit 1), tree clean` |
| **`attw` exit** | **1** |

```
🚭 Syntax detected in the module is incompatible with the module kind according to the package.json
   or file extension. This is an error in Node and may cause problems in some bundlers.
   .../docs/problems/UnexpectedModuleSyntax.md

│ node16 (from ESM) │ 🚭 Unexpected module syntax           │
│ node16 (from CJS) │ (ignored) 🚭 Unexpected module syntax │
```

Run as **two separate invocations** rather than one `&&` chain, so each gate's independent failure
was observed rather than inferred from a short-circuit. Verify block output: `P3B_PROVEN`.

Both gates fail P3 independently, so removing either one does not silently open the hole (T-02-17).

## End of Task 1

```
END_BUILD_EXIT=0        ✔ [attw] No problems found (135ms)   ✔ [publint] No issues found (150ms)
END_ARTIFACT_EXIT=0     All good!   │ node16 (from ESM) │ 🟢 (ESM) │
TASK1_REPO_CLEAN        git status --porcelain: 0 lines      LOCKFILE_UNCHANGED
```

---

# Task 2 — P4, the structural half of success criterion 2

**This mutant was NOT skipped.** `02-VALIDATION.md` § Suite Adequacy Requirement names P4 as
non-skippable; it was executed, and its evidence is below.

**Command line, verbatim** (Task 2's `<verify><automated>` block):

```bash
bash scripts/mutate-and-prove.sh packages/concierge/src/types.ts \
  'export const MESSAGE_MAX_CHARS = 180;' \
  'export const MESSAGE_MAX_CHARS: 181 = 180;' \
  -- bash -c 'pnpm build; echo BUILD_EXIT=$?; pnpm typecheck'
```

One invocation, one applied mutation, compound gate — so the pair is *observed together* rather than
stitched from two runs of two different trees. Verify block output: **`P4_PROVEN`**.

| | Value |
|---|---|
| **Harness exit** | **0** |
| **Harness stdout verdict** | `PASS: gate fired (exit 1), tree clean` |
| **`pnpm build` exit** | **`BUILD_EXIT=0`** — the literal line, verbatim from the gate output |
| **`pnpm typecheck` exit** | **1** |

**Both diagnostics, verbatim with their file locations:**

```
src/types.ts(279,14): error TS2322: Type '180' is not assignable to type '181'.
test-d/results.test-d.ts(108,29): error TS2344: Type 'false' does not satisfy the constraint 'true'.
Exit status 1
```

Paths are package-relative because `tsc` runs with cwd `packages/concierge`; the TS2344 is in
`packages/concierge/test-d/results.test-d.ts`, at line **108** — `_messageBound`, the
`Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>` guard. `src/types.ts(279,14)` independently
re-confirms the refreshed line reference from commit `a4ff337`.

## What the build that exited 0 actually shipped

The interesting half. A richer run of the same mutant captured the artifact while the mutation was
live:

```
BUILD_EXIT=0
✔ [attw] No problems found (171ms)
✔ [publint] No issues found (183ms)

DTS_UNDER_MUTANT:
MESSAGE_MAX_CHARS: 181

JS_UNDER_MUTANT:
MESSAGE_MAX_CHARS = 180

ARTIFACT_GATES_UNDER_MUTANT:
CHECK_ARTIFACT_EXIT=0
```

**The shipped `.d.ts` and the shipped `.js` disagree with each other.** `dist/index.d.ts` declares
`MESSAGE_MAX_CHARS: 181`; `dist/index.js` assigns `MESSAGE_MAX_CHARS = 180`. A consumer's `tsc`
would narrow every use to the literal `181` while the runtime value is `180` — a lying declaration
file, which is worse than a wrong-but-consistent one because the type system actively vouches for
the falsehood.

This is not an accident of the toolchain, it is the documented consequence of the locked
configuration: under `isolatedDeclarations: true`, tsdown's dts path is oxc's isolated-declarations
transform, which copies the annotation into the `.d.ts` **without checking it against the
initializer**. rolldown then strips the annotation from the JS. Neither step typechecks.

And **all four artifact gates called it clean** on the same tree: in-build `attw` ✔, in-build
`publint` ✔, and `check:artifact` exit **0**. publint and attw inspect the manifest and the
resolution graph, not semantics — they structurally cannot see this. **`tsc --noEmit` is the only
gate in the phase that catches it.**

This is a sharper case than the corroborating run in 02-03, which used the reverse annotation
(`: 180 = 181`) and shipped a wrong *runtime value* with a correct `.d.ts`. Both halves of the
inconsistency are now on record.

## Restore verified at the artifact level

```
grep -c "181" packages/concierge/dist/index.d.ts  =>  0
declare const MESSAGE_MAX_CHARS = 180;            (dist/index.d.ts:211)
MESSAGE_MAX_CHARS = 180                           (dist/index.js)
```

`pnpm build` was re-run after the invocation and the `181` is gone from the artifact — count **0**,
as the acceptance criterion requires.

## The ordering constraint — for **plan 02-10**

**Plan 02-10 creates `.github/workflows/ci.yml` and must make it run `pnpm typecheck` BEFORE
`pnpm build`.** (02-10, not 02-11 — 02-11 is the two Phase 1 test-d deferrals and cannot act on
this. 02-10 Task 1 reads this SUMMARY.)

A `ci.yml` that runs only `pnpm build`, or that runs `build` and treats its exit code as the
verdict, would be **fully green on this exact mutant** and would publish an artifact whose `.d.ts`
contradicts its `.js`. The ordering is not cosmetic and not stylistic: `BUILD_EXIT=0` above is the
whole argument. Running `typecheck` first also fails fast in ~0.1 s instead of after a build.

The gates are structurally separate processes. That is the claim PKG-01d makes, and this pair is the
only way to demonstrate it — no passing command can.

---

## Mutation hygiene (hard constraint 4)

Nine harness invocations were made across this plan — P1 (×2, the second to capture the exit code
without a pipeline), P2, P2 research-variant, P2 Node-API probe, P2 control, P2 control-evidence,
P3a, P3b, P3b-as-verify, P4 (×2). **Every one applied and restored its mutation inside a single
`scripts/mutate-and-prove.sh` invocation, inside a single Bash tool call, with
`git diff --exit-code` asserted in that same call.** No mutation ever crossed a tool-call boundary
and none was ever live while I was not inside the shell command that made it.

Per-invocation assertions all passed: `P1_TARGET_CLEAN`/`P1_REPO_CLEAN`, `P2_*`, `P2B_*`,
`PROBE_*`, `P2CTL_*`, `P2EVID_REPO_CLEAN`, `P3A_*`, `P3B_*`, `P4_TARGET_CLEAN`/`P4_REPO_CLEAN`.

`git status --porcelain` immediately before writing this SUMMARY, **verbatim — the output is empty,
zero lines**:

```
```

Also asserted at the end of the plan:

| Check | Result |
|---|---|
| `pnpm build` | **0** |
| `pnpm run check:artifact` | **0** |
| `pnpm typecheck` | **0** |
| `git diff --exit-code` (repo root) | **0** |
| `git diff --exit-code -- README.md packages/concierge/README.md` | **0** — `READMES_UNTOUCHED` |
| `git diff --exit-code -- package.json` (root, owned by 02-05 this wave) | **0** — `ROOT_PKGJSON_UNTOUCHED` |
| `git diff --exit-code -- .planning/STATE.md .planning/ROADMAP.md` | **0** — `STATE_ROADMAP_UNTOUCHED` |
| `git diff --exit-code -- pnpm-lock.yaml` | **0** — `LOCKFILE_UNTOUCHED` |

The worktree was bootstrapped with `CI=true pnpm install --frozen-lockfile --prefer-offline`
(pnpm 11.17.0, Node v24.14.1, `✓ Lockfile passes supply-chain policies`) and the lockfile was
asserted unchanged immediately afterward. No `minimumReleaseAge` skip flag was used. Nothing was
installed.

## Verification

Plan `<verification>` block, clause by clause:

| Clause | Result |
|---|---|
| P1, P2, P3a, P3b and P4 each observed with the measured signature recorded verbatim | ✅ — all five, above |
| `BUILD_EXIT=0` observed on the P4 mutant | ✅ — verbatim from gate stdout |
| `git diff --exit-code` clean after every single invocation | ✅ — asserted in-call, every time |
| `git status --porcelain` empty at the end of the plan | ✅ — 0 lines |
| `pnpm build && pnpm run check:artifact && pnpm typecheck` all exit 0 | ✅ — 0 / 0 / 0 |

Both `<verify><automated>` blocks run verbatim: Task 1 → `P3B_PROVEN`; Task 2 → `P4_PROVEN`.

## Decisions Made

- **The P2 control was measured rather than asserted, and the measurement contradicted the plan.**
  Reported as a finding with the mechanism proven (a 71,684-byte file on disk that the in-build gate
  calls nonexistent). Hard constraint 5 makes "would fire" claims inadmissible; that cuts both ways,
  so "would not fire" is inadmissible too.
- **`check:artifact` is retained with a corrected rationale**, not deleted. Its value is gate
  independence from the build pipeline (T-02-10), not packing exclusivity.
- **P2's error count is recorded, P3a's is asserted** — exactly the asymmetry the plan specifies,
  because this phase perturbed `files` and did not perturb `type`.

## Deviations from Plan

No file was modified, so there is no deviation in the code-change sense. Three factual corrections
to the plan's and research's inputs, recorded rather than absorbed:

**1. [Finding — escalated] The P2 control expectation is false; the in-build gates pack**

- **Found during:** Task 1, P2
- **Issue:** The plan's acceptance criterion asks the SUMMARY to state that `pnpm build` does not
  catch a `files` array omitting `dist`, "because the in-build gate reads the source-tree manifest,
  not the tarball." Measured: `pnpm build` exits **1** on that mutant. `attw` reports
  `Package has no types` (derivable only from a tarball) and `publint` reports a file that is
  physically present on disk as nonexistent. tsdown 0.22.14's in-build integrations pack first.
- **Same defect in the inputs:** `02-RESEARCH.md:564`, whose "only visible after packing" clause
  carries a `[VERIFIED]` marker it does not earn.
- **Action:** recorded, with the mechanism proven in a dedicated probe. `check:artifact` kept with a
  corrected justification. No file changed.

**2. [Finding — escalated] The `files`-omits-`dist` defect yields 2 publint errors, not 4**

- **Found during:** Task 1, P2
- **Issue:** `02-RESEARCH.md:576` records D5 as **4 errors** `[VERIFIED — publint 0.3.22]`. Measured
  **2**, against both my narrower mutant *and* the research mutant verbatim (`files: []`). Confirmed
  at the API level: `MESSAGE_COUNT=2`, both `FILE_NOT_PUBLISHED`. The plan pre-authorised a drift of
  one; this is two, so it is escalated rather than absorbed.
- **Consequence worth carrying:** publint flags only the two `types` paths, never `main` or
  `exports["."].default`. A package without a `types` field could omit `dist` and pass publint. attw
  is the gate that covers it.
- **Action:** recorded. No file changed.

**3. [Cosmetic — recorded] publint 0.3.22 prints a stray `undefined` after any non-empty error list**

- **Found during:** Task 1, P2
- **Issue:** A bare `undefined` line follows the numbered errors in every failing publint run and is
  absent from green runs. Investigated because it could have masked an unrendered third error.
- **Resolution:** it could not. The Node API returns exactly the messages that render. Upstream
  cosmetic bug in the CLI's output path; nothing in this repo to fix, and no error is hidden.
- **Action:** recorded so a future reader does not re-investigate. No file changed.

**Total deviations:** 0 code changes, 3 recorded findings (2 escalated corrections to `[VERIFIED]`
research claims, 1 cosmetic upstream note).
**Impact on plan:** none on scope. Finding 1 changes *why* `check:artifact` exists, not *whether*.

## Issues Encountered

- **`${PIPESTATUS[0]}` returns empty in this environment.** The Bash tool's shell is **zsh**
  (`$0` = `/bin/zsh`, `$BASH_VERSION` empty), where arrays are 1-indexed and the pipeline-status
  array is `$pipestatus`. The first P1 capture lost the harness exit code to this. Fixed by
  redirecting to a log and reading `$?` with no pipeline in between, and P1 was re-run to record its
  exit code properly. **Carry-forward: any later plan capturing an exit code through a pipe must not
  use `${PIPESTATUS[0]}`.** The plan's own Task 2 verify block pipes through `tee` but then greps the
  log file rather than reading `PIPESTATUS`, so it is unaffected — that is luck, not design.
- **Fresh worktree had no `node_modules`.** Bootstrapped as mandated; lockfile asserted unchanged.

## Known Stubs

None. This plan added no code paths and no files other than this SUMMARY.

## Threat Model Outcomes

| Threat | Disposition | Evidence |
|---|---|---|
| T-02-15 a silently-passing artifact gate | **mitigated, observed** | P1: both gates ERROR, build exit 1. P3a: publint exit 1, exactly 2 errors. P3b: attw exit 1. No gate in this phase is now unobserved-non-zero. |
| T-02-16 an unpublished `dist` in a published package | **mitigated, observed** | P2: `check:artifact` exit 1 with 2 `FILE_NOT_PUBLISHED` errors. The stated *reason* the standalone gate is required was corrected — the in-build gate also fires — but the defect is caught, twice over. |
| T-02-17 a CommonJS-declared package emitting ESM | **mitigated, observed** | P3a and P3b run as two independent invocations, each exit 1. Removing either gate does not silently open the hole. |
| T-02-18 a type error reaching the published artifact | **mitigated, observed** | P4: `BUILD_EXIT=0`, typecheck exit 1, TS2322 + TS2344. The 0-exit build shipped a `.d.ts` saying `181` beside a `.js` saying `180`, with all four artifact gates green. Ordering constraint recorded for 02-10. |
| T-02-19 an unrestored mutation reaching a commit | **mitigated** | Every mutation via `mutate-and-prove.sh`; per-invocation `git diff --exit-code`; `git status --porcelain` empty, verbatim, before this SUMMARY was written. |
| T-02-SC npm/pnpm installs | **accepted, held** | Nothing installed. `git diff --exit-code -- pnpm-lock.yaml` exits 0. |

## Threat Flags

None. This plan introduces no network endpoint, auth path, file-access pattern, or schema change. It
adds no product file at all.

## User Setup Required

None.

## Next Phase Readiness

- **02-10 (CI) — load-bearing:** `ci.yml` must run `pnpm typecheck` **before** `pnpm build`. A
  build-only CI is green on the P4 mutant. This is the single most important carry-forward from this
  plan.
- **02-10 / 02-12:** `check:artifact` is worth keeping in CI, but for gate *independence* from the
  build pipeline, not because it is the only packing gate. Do not simplify it away on the old
  rationale.
- **02-12 (phase gate):** P4's recipe and signatures are reproducible exactly as written above;
  02-12-T2 re-proves it. The `BUILD_EXIT=0` line is the assertion target.
- **Anyone touching `02-RESEARCH.md` line 564 or 576:** both carry `[VERIFIED]` markers that this
  plan's measurements contradict. Third and fourth such corrections in this phase, after wave 1's
  line 777 and 02-03's line 530.
- **Anyone capturing exit codes in this repo's shell environment:** it is zsh. `${PIPESTATUS[0]}` is
  empty; use `$pipestatus[1]` or avoid the pipeline.
- Mutants still outstanding for this phase: P5 (02-05, this wave), P6/P7 (02-07), P8/P9 (02-11),
  P10 (02-09), P11 (02-07).

## Self-Check: PASSED

- `.planning/phases/02-packaging-build-and-release/02-04-SUMMARY.md` — FOUND (this file, the only
  file this plan adds)
- `scripts/mutate-and-prove.sh` — FOUND, unmodified (`git diff --exit-code` clean)
- `packages/concierge/package.json` — FOUND, unmodified after four mutations
- `packages/concierge/src/types.ts` — FOUND, unmodified after two mutations;
  `export const MESSAGE_MAX_CHARS = 180;` still at line **279**
- No per-task commit hashes to verify: both tasks changed zero tracked files, as `files_modified: []`
  declares. The one commit in this plan carries this SUMMARY.
- `git status --porcelain` empty; `pnpm build`, `pnpm run check:artifact` and `pnpm typecheck` each
  exit **0** at the end of execution.

---
*Phase: 02-packaging-build-and-release*
*Completed: 2026-07-28*
