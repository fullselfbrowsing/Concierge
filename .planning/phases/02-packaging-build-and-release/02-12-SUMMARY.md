---
phase: 02-packaging-build-and-release
plan: 12
subsystem: packaging
tags: [pkg-01, pkg-02, pkg-03, pkg-04, pkg-05, phase-gate, mutation-testing, clean-checkout, validation-signoff, node-floor, tarball-review]

# Dependency graph
requires:
  - phase: 02-packaging-build-and-release
    plan: "02-04"
    provides: "mutants P1, P2, P3a, P3b, P4 — their patterns, replacements and gates"
  - phase: 02-packaging-build-and-release
    plan: "02-05"
    provides: "mutants P5a/P5b, and the lockfile hazard plus its preventive remedy"
  - phase: 02-packaging-build-and-release
    plan: "02-07"
    provides: "mutants P6, P7, P11, and the measured `pnpm test -- <name>` filtering defect"
  - phase: 02-packaging-build-and-release
    plan: "02-09"
    provides: "mutant P10, check:pack and check:node-floor"
  - phase: 02-packaging-build-and-release
    plan: "02-10"
    provides: "CI, the release path, and the static-review outcome the manual-only row now records"
  - phase: 02-packaging-build-and-release
    plan: "02-11"
    provides: "mutants P8 and P9, and the three stale M9 prose claims recorded for this plan"
provides:
  - "A recorded clean-checkout run: eight commands green from an empty node_modules and dist, git status --porcelain empty"
  - "Thirteen mutant invocations re-run consecutively on the finished phase, every one firing, tree clean after each"
  - "P4, P6 and P10 each explicitly run and each fired — none skipped"
  - "A reviewed tarball file list: 10 entries, 87,915 B, exactly one entry more than 02-03's record"
  - "02-VALIDATION.md signed off: nyquist_compliant true, status complete, 31 rows with an evidence-backed Status"
  - "The `pnpm test -- <name>` defect corrected in 10 places in 02-VALIDATION.md"
  - "The export surface corrected to the measured 45 = 39 types + 6 values"
  - "Three honest limits recorded in the contract, including assertSingleInstance's absent production call site"
  - "A third defect found in the validation table's own instructions: 02-12-T3's --watch clause disables its own --exclude-dir flags"
  - "A corrected attribution: 02-05 (wave 3) found the mutate-and-prove lockfile hazard, not 02-08 (wave 6), and supplied the preventive remedy"
affects:
  - "Phase 3 — three stale M9 prose claims, the /* @__PURE__ */ annotations and the mutate-and-prove precondition are recorded here, unclosed, with exact wording"
  - "the orchestrator — REQUIREMENTS.md PKG-01..PKG-05 are all delivered and ready to close; this plan could not touch that file"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Run the plan's gate verbatim for the acceptance record and a corrected form for the evidence, and report both — inherited from 02-11 and applied to five gates here"
    - "A phase gate re-runs every row's own automated command rather than reading the owning plan's SUMMARY, so a status is set from an exit code observed today"
    - "After any mutate-and-prove.sh invocation whose gate can install, assert `git status --porcelain` at the repo ROOT, not the harness's PASS line"

key-files:
  created:
    - .planning/phases/02-packaging-build-and-release/02-12-SUMMARY.md
  modified:
    - .planning/phases/02-packaging-build-and-release/02-VALIDATION.md

key-decisions:
  - "The bare `pnpm test <name>` form was used for the five filtered gates rather than the plan's `--` form, because the plan's own acceptance criteria demand named failing assertions and the `--` form cannot deliver them; both forms measured, correction landed in 02-VALIDATION.md"
  - "P2's finished-phase count is 2, not the table's 4; the measured signature was left as first recorded per the plan's instruction and the divergence recorded beneath the table"
  - "Rows whose command is stale or self-defeating were marked ⚠️ with the reason and the corrected form that is green, never rewritten to pass"
  - "02-VALIDATION.md's 'Two defects in this table's own instructions' was extended to three; the new one is the misplaced `--` in 02-12-T3's own --watch clause"
  - "REQUIREMENTS.md was NOT touched — it is not in this plan's files_modified and this agent runs in a worktree"

patterns-established:
  - "Extract every verification-map row's command mechanically and execute it, so a Status is an observation rather than an inference from the plan having run"

requirements-completed: [PKG-02, PKG-03]

# Metrics
duration: 22min
completed: 2026-07-29
tasks: 3
commits: 1
files_changed: 1
---

# Phase 2 Plan 12: The phase gate Summary

**The phase is green from nothing — eight commands from an empty `node_modules` and no `dist/`, on a
genuinely downloaded Node v22.12.0 rather than the developer's v24.14.1 — and every one of its eleven
structural gates was observed failing again on the finished code across thirteen consecutive
invocations, with `git diff --exit-code` asserted clean after each; the validation contract is signed
off on those exit codes, with five rows warned rather than passed and three limits recorded as
unproven.**

## Performance

- **Duration:** ~22 min (2026-07-29T14:34:48Z → 14:56:49Z)
- **Tasks:** 3
- **Files changed:** 1 modified (plus this SUMMARY)

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Clean-checkout green, the Node floor on a real v22.12.0, the tarball reviewed | *(no net file change — evidence, see below)* | none |
| 2 | Re-run the eleven-mutant battery end to end | *(no net file change — 6 sources mutated and restored)* | none |
| 3 | Sign off the validation contract | `ce789d1` | `.planning/phases/02-packaging-build-and-release/02-VALIDATION.md` |

**Tasks 1 and 2 have no commit, and that is correct rather than an omission.** Both are pure proof
tasks: Task 1 runs commands and reads a tarball, and Task 2 applies every mutation and restores it
inside a single `mutate-and-prove.sh` invocation. Their deliverable is recorded evidence, not source.
`git diff --exit-code` is clean after every one of the thirteen invocations and `git status
--porcelain` is empty at the end. This follows the precedent 02-02, 02-04, 02-07, 02-09 and 02-11 all
set for the same reason. The plan's own `files_modified` lists exactly one file, and exactly one file
changed.

`git diff --name-only e4f1b83..HEAD` lists **one path** —
`.planning/phases/02-packaging-build-and-release/02-VALIDATION.md`. No source file, no manifest, no
`pnpm-lock.yaml`, no `STATE.md`, `ROADMAP.md` or `REQUIREMENTS.md`. The commit contains no deletion.

---

# Task 1 — the phase gate's items 1, 2, 4 and 5

## 1. Clean checkout, full suite — every exit code recorded

`packages/concierge/dist`, the root `node_modules`, `packages/concierge/node_modules` and every
`packages/concierge/test/fixtures/*/node_modules` were removed and each verified absent before the
first command ran. (The worktree was in fact spawned without any of them, which is the strongest form
of the same state.)

| # | Command | Exit | Wall |
|---|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | **0** | 1 s |
| 2 | `pnpm typecheck` | **0** | 1 s |
| 3 | `pnpm build` | **0** | 2 s |
| 4 | `pnpm test` | **0** | 1 s |
| 5 | `pnpm run check:artifact` | **0** | 3 s |
| 6 | `pnpm run check:deps` | **0** | 0 s |
| 7 | `pnpm run check:pack` | **0** | 3 s |
| 8 | `pnpm run check:node-floor` | **0** | 3 s |
| — | `git status --porcelain` | **empty** | — |

`--frozen-lockfile` is the load-bearing flag: it is what proves the committed lockfile is the one CI
will install from. pnpm reported `Scope: all 4 workspace projects`, `Lockfile is up to date,
resolution step is skipped`, `+228` packages.

Notable output: `pnpm test` → `Test Files 4 passed (4)` / `Tests 15 passed (15)`; `pnpm build` →
`✔ [attw] No problems found`, `✔ [publint] No issues found`, `dist/index.js 9.74 kB`,
`dist/index.d.ts 77.26 kB`; `check:artifact` → publint `All good!`; `check:deps` → *core's
dependencies contribute zero bytes to a consumer bundle*.

The plan's Task 1 `<verify><automated>` block was then run **verbatim**, repeating the whole clean
sequence in one `&&` chain: **`PHASE_GATE_GREEN`**, exit **0**.

## 2. The Node floor on a real v22.12.0

| | |
|---|---|
| **developer's own runtime** | **v24.14.1** |
| **floor runtime, printed by the job** | **v22.12.0** |
| floor cache | warm, `$TMPDIR/node-v22.12.0`, 188 MB |
| wall | 3 s warm |
| result | `PASS: the published artifact installed with npm and imported on a pinned v22.12.0` |

The contrast is the criterion, and it holds: the artifact was installed with `npm` and imported —
including a live `assertSingleInstance()` call and a `MESSAGE_MAX_CHARS !== 180` assertion — on a
runtime two majors below the one every other command in this phase ran on.

## 4. `git status --porcelain` empty

Empty at the end of Task 1, after each of the thirteen invocations in Task 2, and at the end of the
plan. No `*.tgz` appeared anywhere in the worktree; every `pnpm pack` in this plan wrote into a
`mktemp -d` outside the repo.

## 5. The packed tarball, reviewed by eye

`pnpm pack --pack-destination "$(mktemp -d)"` from `packages/concierge`.

| | 02-03's record | This run |
|---|---|---|
| bytes | 79,453 | **87,915** |
| entries | 9 | **10** |

```
package/LICENSE
package/README.md
package/dist/index.d.ts
package/dist/index.d.ts.map
package/dist/index.js
package/dist/index.js.map
package/package.json
package/src/contract.ts     <-- the one entry 02-03's list does not have
package/src/index.ts
package/src/types.ts
```

**The list differs from plan 02-03's recorded list by exactly one entry — `package/src/contract.ts`
— added by plan 02-06 after 02-03 took the sourcemap decision. That is the expected delta and
nothing else drifted.** `dist/` is four files; `src/` is **all three** (`index.ts`, `types.ts`,
`contract.ts`); `README.md`, `LICENSE` and `package.json` are present.

Forbidden-path scan over the listing — every count **0**: `test`, `test-d`, `scripts`, `.github`,
`.changeset`, `node_modules`.

**The declaration map resolves inside the tarball.** Extracted and each `sources` entry resolved
against the map's own directory:

| Map | `sources` | Resolution | `sourcesContent` |
|---|---|---|---|
| `dist/index.d.ts.map` | `["../src/types.ts", "../src/contract.ts"]` | **both RESOLVE** to `package/src/types.ts` and `package/src/contract.ts` | absent |
| `dist/index.js.map` | `["../src/types.ts", "../src/contract.ts"]` | **both RESOLVE** | present, 2 entries, 84,414 chars |

Note the `sources` arrays are now two-element; 02-03 measured one, before `contract.ts` existed. Both
entries are present in the tarball, which is the property the review is for.

**The tarball publishes `src/types.ts` verbatim, and that is a deliberate decision taken in plan
02-03**, not an accident. 02-03 chose option (a) — add `"src"` to `files` — over turning the maps off
or inlining `sourcesContent`, so that source-level debugging and Go-to-Definition work the way the
ecosystem expects of a TypeScript library. The stated consequence still holds and is restated here
rather than quietly inherited: **`serverChallengeBrand` and `ConsentAckBase` are deliberately
unexported and, under this decision, ship as readable source text** — as they already did inside
`dist/index.js.map`'s `sourcesContent`. "Unexported" is not "unpublished". For an MIT public library
whose `types.ts` carries the design rationale for the consent kernel, that is acceptable; it is a
choice, and it was looked at rather than assumed.

---

# Task 2 — the eleven-mutant battery, re-run end to end

**Thirteen invocations, in ascending order, on the finished phase. Every one produced a non-zero exit
from its named gate. No invocation aborted with exit 2 (dirty target) or exit 3 (no-op pattern).
`git diff --exit-code` at the repo root was asserted clean after *each* one, not only at the end.**

| # | Command line | Harness stdout | Harness exit | Signature reproduced |
|---|---|---|---|---|
| **P1** | `mutate-and-prove.sh packages/concierge/package.json '      "types": "./dist/index.d.ts",' '      "types": "./dist/nope.d.ts",' -- pnpm build` | `PASS: gate fired (exit 1), tree clean` | **0** | `ERROR [publint] pkg.exports["."].types is ./dist/nope.d.ts but the file does not exist.` **and** `ERROR [attw] problems found:` |
| **P2** | same file, the whole `"files": [...]` block → `"files": ["README.md"]`, gate `pnpm run check:artifact` | `PASS: gate fired (exit 1), tree clean` | **0** | publint on the **packed tarball**: **2** errors (`pkg.types` and `pkg.exports["."].types` "not published. Is it specified in pkg.files?"), exit 1 |
| **P3a** | same file, `  "type": "module",` → `  "type": "commonjs",`, gate `publint --strict` alone | `PASS: gate fired (exit 1), tree clean` | **0** | **exactly 2** errors — `pkg.main` and `pkg.exports["."].default` "written in ESM, but is interpreted as CJS" — exit 1 |
| **P3b** | same mutation, gate `attw --pack packages/concierge --profile esm-only` alone | `PASS: gate fired (exit 1), tree clean` | **0** | attw exit **1**, `🚭 Unexpected module syntax` on `node16 (from ESM)` |
| **P4** | `src/types.ts`, `export const MESSAGE_MAX_CHARS = 180;` → `: 181 = 180;`, gate `bash -c 'pnpm build; echo BUILD_EXIT=$?; pnpm typecheck'` | `PASS: gate fired (exit 1), tree clean` | **0** | **`BUILD_EXIT=0`** with `✔ [attw]` and `✔ [publint]` both clean, then `src/types.ts(279,14): error TS2322: Type '180' is not assignable to type '181'.` |
| **P5a** | `node scripts/pkg05-zero-runtime-deps.mjs "$SCRATCH/entry.mjs"` — no mutation, synthesized entry in a `mktemp -d` | *(not routed through the harness — no tracked file is mutated)* | gate exit **1** | `vendored modules:` 1 path under `node_modules`; `unbundled external imports: node:url`; **Assertion A: FAIL** |
| **P5b** | `packages/concierge/package.json`, `"@standard-schema/spec": "^1.0.0"` → `…, "typescript": "7.0.2"`, gate `pnpm run check:deps` | `PASS: gate fired (exit 1), tree clean` | **0** | **Assertion B: FAIL** naming `typescript`, `resolved via exports["."] -> packages/concierge/node_modules/typescript/lib/version.cjs`, **113 bytes** > 0 |
| **P6** | `src/contract.ts`, the whole `assertSingleInstance` declaration → the same logic as module-scope statements + a no-op exported function, gate `bash -c 'pnpm build && pnpm test single-instance'` | `PASS: gate fired (exit 1), tree clean` | **0** | 1 file / 3 tests. **F1b fails**; **F2 fails alongside it**; **F1a passes** |
| **P7** | `src/contract.ts`, `export const CONTRACT_VERSION = 1;` → `= 0;`, same gate | `PASS: gate fired (exit 1), tree clean` | **0** | **F2 the sole failure**: `AssertionError: expected [Function] to throw an error` |
| **P8** | `src/index.ts`, the 9-line span moving `MESSAGE_MAX_CHARS` into the type-export block, gate `bash -c 'pnpm build; echo BUILD_EXIT=$?; pnpm test artifact; echo ARTIFACT_EXIT=$?; pnpm typecheck'` | `PASS: gate fired (exit 1), tree clean` | **0** | **`BUILD_EXIT=0`**, **`ARTIFACT_EXIT=1`**, `TS1485` at `exports.test-d.ts(52,10)`, `results.test-d.ts` named **0** times |
| **P9** | `src/types.ts`, `  snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean;` → method syntax, gate `pnpm typecheck` | `PASS: gate fired (exit 1), tree clean` | **0** | `TS2344` at `consent-variance.test-d.ts(76,35)` **and** `TS2578` at `actions.test-d.ts(162,3)`, `Found 2 errors in 2 files.` |
| **P10** | `src/contract.ts`, `  const holder: Holder = globalThis as unknown as Holder;` → same + a type-erased `Promise.try` call, gate `bash -c 'pnpm build && pnpm test single-instance; echo DEV_EXIT=$?; pnpm run check:node-floor'` | `PASS: gate fired (exit 1), tree clean` | **0** | **`DEV_EXIT=0`** (`Test Files 1 passed`, `Tests 3 passed` on v24.14.1), floor exit **1**: `TypeError: Promise.try is not a function` at `Module.assertSingleInstance (…/dist/index.js:181:13)`, footer `Node.js v22.12.0` |
| **P11** | `src/index.ts`, `  MESSAGE_MAX_CHARS,\n} from "./types.js";` → `} from "./types.js";`, gate `bash -c 'pnpm build && pnpm test export-surface'` | `PASS: gate fired (exit 1), tree clean` | **0** | **`expected [ 'AbandonReason', …(43) ] to have a length of 45 but got 44`** |

## P4, P6 and P10 — each run, each fired, none skipped

Stated explicitly because the plan requires it and because these three prove claims that are *only*
structural:

- **P4 fired.** `BUILD_EXIT=0` on a program that `tsc` rejects. rolldown transpiles without checking,
  and `attw` and `publint` — the build's own gates — both reported clean on it. That pair is the whole
  of PKG-01d, and it is the reason `typecheck` is a separate required step before `build` in CI.
  Beyond the mandated `src/types.ts` diagnostic, two type-test predicates also fired
  (`exports.test-d.ts(59,44)` and `results.test-d.ts(108,29)`, both `TS2344`), which did not exist
  when 02-04 first measured P4.
- **P6 fired.** F1b is among the failing assertions — `AssertionError: expected
  'Object.freeze({\n\tok: false,\n\treas…' not to contain '@fullselfbrowsing/concierge.contract'`,
  i.e. a consumer bundle that never calls the guard now carries the registry key. **F2 failing
  alongside it is expected and is recorded rather than reported as an anomaly**: under the
  module-scope mutant the registration runs during *module evaluation*, so the dynamic import rejects
  before `expect(() => …).toThrow()` executes, and the thrown message appears with a `contract.ts`
  frame. **F1a passed**, which is exactly why F1b exists — the module-scope form still registers
  under Node, so F1a is structurally blind to the regression.
- **P10 fired.** `DEV_EXIT=0`: the entire `single-instance` suite passed against a `dist/index.js`
  built **from the mutated source** on the developer's v24.14.1, with the defect present. The floor
  job then died on it. Nothing else in this repository can see that.

## P11 — 44 against 45, and why the contract said 42/43

P11's failure is `to have a length of 45 but got 44`, plus the split guard (`length of 6 … got 5`)
and the by-name guard (`to include 'MESSAGE_MAX_CHARS'`).

`02-VALIDATION.md`'s measured signature reads **"42 names instead of 43"** because it was measured in
Wave 0, before `src/contract.ts` added `CONTRACT_VERSION` and `assertSingleInstance` to the surface.
**The invariant proven is the identical −1 delta**: `43 → 42` then, `45 → 44` now. A parenthetical
saying so was appended to P11's row; no other measured signature in that table was edited.

## The `--` correction, applied here and measured a sixth time

The plan's Task 2 table writes five gates as `pnpm test -- <name>`. That form does **not** filter —
Vitest's cac CLI discards everything after `--` — and the plan's own acceptance criteria demand named
failing assertions (*"F1b is among the failing assertions"*, *"F2 is P7's"*), which the unfiltered
form cannot deliver. **The bare form was used for all five**, and the defect was re-measured across
all four filter names to justify it:

| Command | Test files run | Tests run |
|---|---|---|
| `pnpm test single-instance` / `export-surface` / `artifact` / `fixtures` | **1** each | 3 / 4 / 5 / 3 |
| `pnpm test -- <any of the four>` | **4** | **15** |

That is the **sixth** independent reproduction, after 02-07, 02-08, 02-09, 02-10 and 02-11. The
payoff is visible in the results above: P7 shows **one** failing test where 02-07 recorded two, and
P8 shows **one** where 02-11's verbatim run recorded four. Same gates, same firings, real specificity.

## Closing state of Task 2

`pnpm build` **0**, `pnpm typecheck` **0**, `pnpm test` **0** (4 files, 15 tests),
`pnpm run check:deps` **0**, `git diff --exit-code` **0**, `git status --porcelain` **empty**.

The plan's Task 2 `<verify><automated>` block (the P4 invocation followed by `git diff --exit-code
&& pnpm build && pnpm test`) was run **verbatim**: **`P4_REPROVEN`**.

---

# Task 3 — the validation contract, signed off

Every one of the **31** rows in § Per-Task Verification Map had its `<automated>` command extracted
from the table and **executed on this tree**, so each Status is an exit code observed on 2026-07-29
rather than an inference from the owning plan having run. **26 exited 0. Five did not, and each is
marked ⚠️ with a one-clause reason and the corrected form that *is* green.** No row was rewritten to
make it pass.

| Row | Exit | Why not ✅ |
|---|---|---|
| `02-01-T3` | 1 | The two self-referential defects the table already documents: `^\| 02-0` matches **22** of 31 rows (`^\| 02-` matches 31), and the 3 `*pending*` hits are all inside quoted command cells — the placeholder **row** count is 0. Its `nyquist_compliant: false` clause is also inverted by the sign-off itself |
| `02-03-T1` | 1 | The build half is green; the `n===43` assertion is **superseded** — `EXPORT_NAMES=45` since `contract.ts`. Row `02-06-T2` asserts 45 and passes |
| `02-05-T2` | 1 | The mutant **fires**; the row's own `git diff --exit-code` fails because pnpm rewrote `pnpm-lock.yaml` outside the harness's trap. `P5B_PROVEN`, exit 0, with the flag 02-05 actually used |
| `02-11-T3` | 1 | The mutant **fires** and both diagnostics reproduce with `file:line`; only the third grep fails, because `tsc` echoes source text solely under `--pretty` |
| `02-12-T3` | 1 | Self-referential (defect 2) plus the newly-found defect 3 below. Every clause verified individually |

Every row's **File Exists** column is now ✅, in both the per-task map and the Requirement → Test Map.

## A third defect in the validation table's own instructions

`02-12-T3`'s `--watch` clause reads
`grep -rIh -- '--watch' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.planning .`.
**`--` terminates option parsing**, so the three `--exclude-dir=` arguments are read as *file
operands*: `grep` prints `No such file or directory` for each and then scans `.` recursively,
`node_modules` included.

| Form | Non-comment `--watch` count |
|---|---|
| as written (flags after `--`) | **72** at the start of this plan, **74** now — it can never return 0 |
| flags moved **before** the `--` | **0** |

The substantive claim is stronger than the criterion asks for: `git grep -i watch -- ':!.planning'`
returns **nothing at all** — no `--watch`, no `watchOptions`, no watch token of any kind, on any line,
comment or executable, in any script, workflow, config or test file this repository owns. The
criterion's stated rationale ("scoped to non-comment lines because plan 02-07 mandates a config
comment naming `--watch`") is itself stale: `vitest.config.ts` never spells the token. Recorded as
defect (3) in the file rather than papered over, and the row marked ⚠️.

## What was corrected in `02-VALIDATION.md`

| Correction | Where |
|---|---|
| `pnpm test -- <name>` → `pnpm test <name>` | rows `02-07-T1`, `02-07-T2`, `02-07-T3`, `02-08-T2`; `PKG-04a`, `PKG-04c` and both `*(artifact)` rows of the Requirement → Test Map; the `P6` and `P11` gate cells — **10 places**, with the measurement table and the divergence-from-verbatim note beside them |
| export surface `39 types + 4 values` → **`39 types + 6 values = 45 names in 1 export block`** | Requirement → Test Map `*(artifact)` row, with the six value names enumerated and the reason for the change |
| P11's `42 names instead of 43` | left as first measured, with a **parenthetical** recording the finished-phase 44/45. No other measured signature edited |
| Test Infrastructure "does not exist yet" rows | corrected to measured state: `vitest.config.ts` exists, the runtime glob is 4 files / 15 tests, the type-test glob is **6** files (was 5 at Wave 0), and the Wave 0 `pnpm build`/`pnpm test` defects are marked closed |
| latency figures | inner loop measured **0.45 s** (bare `tsc` 0.11–0.15 s); the chained full suite measured **2.71 s**, over the `< 2 s` estimate, and the estimate corrected rather than defended |
| "Two defects in this table's own instructions" → **"Three"** | the misplaced `--`, above |

## The tree-shaking pair — the two SUMMARYs agree, byte for byte

The plan required 02-06 and 02-07 to record this in identical wording precisely so a contradiction
would be visible. Compared programmatically: **one occurrence each, the same blockquote, no
divergence.**

> **63 B uncalled / 587 B called — the registry code itself contributes 0 bytes when uncalled.**

`02-06-SUMMARY.md:205` and `02-07-SUMMARY.md:171`. **Nothing to reconcile.** Recorded beside them, and
explicitly not substituted for them: 02-07's own F1b bundles measured **3,942 B** called (902 B
non-comment, key present) and **852 B** uncalled (292 B non-comment, key absent); 02-06's bare-specifier
re-measurement is a third shape again (15 B / 918 B of code). The three differ because the consumer
shapes differ; the load-bearing fact — the key is absent when uncalled and present verbatim when
called — is identical in all three and is the only thing F1b asserts.

## The three honest limits, all recorded in the contract

1. **The OIDC release workflow.** § Manual-Only Verifications still has **exactly one row**, and it
   still says the workflow **cannot be executed in this phase**. Nothing was promoted out of it.
   Plan 02-10's static review of the six named properties was appended under a heading that says it
   is *not* a second manual-only row, with each outcome and the explicit note that **every one of the
   six is an inspection or a `grep`, none is a run** — plus the three version floors and a pointer to
   **`RELEASING.md`**, where the first-publish checklist and the rule that *a publish without an
   attestation is a FAILED publish* live.
2. **Two vacuous assertions, counted nowhere.** `ReadbackAttestation` has **0** occurrences in
   `src/types.ts` and **0** in `dist/index.d.ts` — it does not exist, so a non-export guard would pass
   while testing nothing, and 02-07 deliberately did not write it. The second finding is the opposite
   and more dangerous shape: **`serverChallengeBrand` and `ConsentAckBase` are *present* in
   `dist/index.d.ts` as declarations** (measured at the gate: `declared in file = true`, `in export
   list = false`) and must be asserted absent **from the trailing export list only** — a file-absence
   assertion would fail on a correct artifact and read like a real regression. Both are named in the
   contract and neither is counted as a passing check.
3. **`assertSingleInstance` has no production call site.** Nothing outside the test suite calls it in
   this phase; 02-06 records the intended call sites (`createConcierge`, each adapter's registration
   hook) in a doc comment only, and the runtime that would call them lands in Phases 3–8. So
   **PKG-04's runtime enforcement is proven by test, not active in product: two copies of core in a
   real application today would *not* fail loudly, because nothing calls the check.** SC-4's "fails
   loudly" is demonstrated by fixture **F2** and mutant **P7** exercising the function directly
   against the built artifact, not by the guard firing on its own in a consumer. Written into the
   sign-off in those terms, beside the OIDC row.

## Wave 0 Requirements — fully resolved

Every box verified on disk, item by item, rather than from the plan that promised it. **One box is
annotated instead of ticked:** `packages/concierge/package.json` gained a `build` script but
deliberately **no `test` script** — Vitest resolves its config from the working directory and does not
search upward, so a `vitest run` inside `packages/concierge` would never find the root config.

Two additions beyond the original list are ticked with their reason: `test/export-surface.test.ts`
(the count guard moved to its own file, which is why P8 and P11 are separable) and
`test-d/consent-variance.test-d.ts` (M9's second, named detector).

**No placeholder `packages/concierge-svelte/` was created, deliberately** — the written constraint in
`CONTRIBUTING.md § Non-negotiables` and the `catalog:` pin in `pnpm-workspace.yaml` *are* the
scaffolding (research's options 1 and 2, explicitly not option 3). Verified absent.

---

## Deviations from Plan

### Recorded, not fixed

**1. [Recorded] The bare `pnpm test <name>` form was used for the five filtered gates.** The plan's
Task 2 table writes them with `--`. Full treatment above: the `--` form runs the whole suite, the
plan's own acceptance criteria demand named failing assertions, and both forms were measured. The
correction landed in `02-VALIDATION.md`, which is this plan's job under carry-forward item A.

**2. [Recorded] P2's finished-phase count is 2, not the table's 4.** Plan 02-04 measured 2 in Wave 3
and escalated it; the gate reproduces 2 (`pkg.types` and `pkg.exports["."].types`, both "not
published"). The plan instructs *"do not edit the mutant table's measured signatures — except to
append a parenthetical to P11's row"*, so the row was left as first recorded and the divergence is
written beneath the table instead.

**3. [Recorded] P9's plan-specified signature is renderer-conditioned.** The required signature is
`TS2344` on a line whose **echoed source** contains `_policyNotBivariant`. `tsc` echoes source text
only under `--pretty`, which is off through a pipe. On this tree it is worse than 02-11 found: under a
real pty, `pnpm -r`'s spinner reporter swallows the child's output **entirely**, so the diagnostics
vanish in that direction too. The signature was reproduced in full by forcing the *gate's rendering*
(`pnpm --filter … exec tsc -p tsconfig.test-d.json --pretty`) through the same harness — no assertion
weakened, no identifier renamed:

```
test-d/actions.test-d.ts:162:3 - error TS2578: Unused '@ts-expect-error' directive.
162   // @ts-expect-error - a Booking comparator must NOT fit ConsentPolicy<unknown> (SC-7a)

test-d/consent-variance.test-d.ts:76:35 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
 76 type _policyNotBivariant = Expect<Not<Assignable<ConsentPolicy<Booking>, ConsentPolicy<unknown>>>>;

Found 2 errors in 2 files.
```

Line 162 sits inside the `_policyDegraded` declaration (`const _policyDegraded: ConsentPolicy` at
line 159), so both halves of the signature hold.

**4. [Recorded] The plan's Task 3 `<verify><automated>` block cannot print `SIGNOFF_OK`.** Two
clauses are unsatisfiable by construction — the two `grep -F` clauses match literals that live inside
the file's own documented-defect prose and inside row `02-12-T3`'s command cell, and the `--watch`
clause disables its own `--exclude-dir` flags (defect 3 above). Every clause was verified
individually instead:

| Clause | Result |
|---|---|
| `grep -q "^nyquist_compliant: true"` | **0** |
| `grep -q "^status: complete"` | **0** |
| no `⬜ pending` **Status cell** | **0 cells** (`grep -cE "\| ⬜ pending \|$"` returns 0); the 5 literal hits are the documented self-reference |
| `Approval:** pending` | gone — the line reads `**Approval:** approved — 2026-07-29`; the 3 literal hits are the documented self-reference |
| no `--watch` on an executable line | **0** with the flags correctly placed; `git grep -i watch -- ':!.planning'` returns nothing at all |
| `git diff --name-only` lists only `02-VALIDATION.md` | **yes**, one path |

Table integrity was checked separately: all **31** data rows have exactly **10** unescaped-pipe
columns, matching the header.

### Auto-fixed

**5. [Rule 1 - Bug] The `pnpm-lock.yaml` dirtied by P5b was restored file-scoped.** `git checkout --
pnpm-lock.yaml`, then `CI=true pnpm install --frozen-lockfile --prefer-offline` to resync
`node_modules`, then `git status --porcelain` asserted empty. Never a blanket reset, `git clean`,
`git stash` or blanket checkout. Recurred once more while executing row `02-05-T2` and was restored
the same way.

Nothing else deviated. Three tasks, one file, the prescribed clean sequence, the prescribed thirteen
invocations, the prescribed sign-off structure.

---

## Carry-forward items — what this plan closed, and what it could not

The wave briefing named this plan owner of last resort for eight items. **Four are closed. Four fall
outside `files_modified` and are recorded below with file:line and exact replacement wording so
nothing is lost at phase close.**

### CLOSED

**A. The `pnpm test -- <name>` defect.** Corrected in **10 places** in `02-VALIDATION.md`, with the
measurement table, the sixth reproduction, and an explicit note that these cells deliberately diverge
from their plans' `<verify>` text by one character. 02-10 confirmed `.github/` was already clean
(0 executable `pnpm test --` lines); re-confirmed here. **Fully closed — no holder remains.**

**B. Stale export-surface numbers.** The Requirement → Test Map row now reads **39 types + 6 values =
45 names in 1 export block**, with the six value names enumerated and the reason recorded. Re-measured
on this tree by parsing the built `dist/index.d.ts`: 1 block, 45 names, 39 type-prefixed, 6 plain —
agreeing with 02-06, 02-07 (after its own correction) and 02-11. **Closed.**

**G. The changesets `private: true` claim.** 02-08's forward note said changesets ignores
`private: true` by default; 02-10 read `@changesets/config@3.1.4` and found the default is
`{version: true, tag: false}` — private packages **are** versioned by default. The conclusion was
right, the reason was wrong, and `privatePackages: false` is set explicitly. Also confirmed: `changeset
status` alone is vacuous here because its error path names **no package at all**; the decisive
measurement is `getChangedPackagesSinceRef` + `shouldSkipPackage`, which 02-10 computed
(`["@fullselfbrowsing/concierge"]` with the setting, all three packages without it). **No file needed
changing** — the config and 02-10's SUMMARY are both already correct. Row `02-10-T2` re-run at the
gate: `RELEASE_STATIC_OK`, exit 0. **Closed as a claim; nothing outstanding.**

**H. REQUIREMENTS.md closeout — reported, not performed.** See the dedicated section below.

### NOT CLOSED — outside this plan's `files_modified`

This plan's `files_modified` is a single path:
`.planning/phases/02-packaging-build-and-release/02-VALIDATION.md`. Its Task 3 action closes with
*"Change nothing outside `02-VALIDATION.md`."* The four items below each require editing a file that
is not that one, so each is recorded rather than done.

**C. Three false M9 prose claims** — all made false by 02-11 adding the second, named detector.
Verified still present on this tree at the exact lines below.

| File:line | Current text | Exact replacement |
|---|---|---|
| `packages/concierge/test-d/actions.test-d.ts:147` | " * The negative — and **mutant M9's sole detector**." | " * The negative — and M9's *first* detector; the second is `_policyNotBivariant` in `consent-variance.test-d.ts`." |
| `packages/concierge/test-d/actions.test-d.ts:153-155` | " * assignment above starts succeeding, and this directive goes unused — a lone TS2578 is / * then the *only* symptom that the guard has stopped guarding. Nothing else in this / * repository notices." | " * assignment above starts succeeding, and this directive goes unused — a lone TS2578 is / * then this file's only symptom; since plan 02-11 `_policyNotBivariant` fails with / * TS2344 in the same run." |
| `packages/concierge/src/types.ts:505-506` | "Its only symptom is one unused suppression directive in the type-test suite — the kind of thing a reviewer 'fixes' by deleting the test." | "Its symptoms are one unused suppression directive and, since plan 02-11, a TS2344 on `_policyNotBivariant`." |

Both files are additionally protected by `git diff --exit-code` acceptance criteria in **two** of
02-11's tasks, and `src/types.ts`'s doc comment ships inside `dist/index.d.ts`, so editing it perturbs
the published artifact. **Owner: a Phase 3+ plan that legitimately opens both files.**

**E. `/* @__PURE__ */` on `types.ts`'s three `Object.freeze` initializers.** `USER_CANCELLED`,
`USER_DECLINED` and `CONSENT_GRADE_ORDER`. Because `assertSingleInstance` keeps the module alive,
rolldown retains the three calls as bare side-effecting statements in every consumer bundle that
reaches any runtime code — ~205 B, forever. Mechanism proven by 02-06 with a self-contained probe,
corroborated independently by 02-07 (they account for essentially all 292 non-comment bytes of F1b's
uncalled bundle). Three-line change; `src/types.ts` is outside `files_modified` and is the same file
protected by 02-11's acceptance criteria. **Owner: the same Phase 3+ plan as item C — the two changes
touch the same file and should land together.**

**D. `scripts/mutate-and-prove.sh` reports "tree clean" while the repo is dirty.** Reproduced twice at
this gate (the P5b invocation, and again while executing row `02-05-T2`). The harness's `trap`
restores **its target file** and verifies that one file; pnpm 11 auto-installs before running a script
when a workspace manifest changed, so `pnpm-lock.yaml` is rewritten **outside** that scope.

**A correction to the briefing's attribution, because it changes who is credited and what the remedy
is.** The briefing states that "Mutants P1-P4, P6, P7, P11 all targeted `.ts` sources, which never
re-resolve — 02-08's peer→dependency mutation was the first able to expose it." **That is not right.**
Plan **02-05**, in Wave 3, found it first — three waves earlier — under a heading titled *"The lockfile
hazard — a finding every later mutation plan needs"*, and its `affects` block names "02-04, 02-09,
02-12 — every plan that mutates a manifest and gates with `pnpm run`". P5b mutates
`packages/concierge/package.json`'s **`dependencies`** block, which is precisely a dependency-manifest
mutation, so it was always able to expose it. 02-08 rediscovered it independently on a different
mutation class.

The two plans also propose **different and complementary** remedies, and both should be applied:

| Remedy | Kind | Source | Verified here |
|---|---|---|---|
| `pnpm --config.verify-deps-before-run=false run <script>` as the gate | **preventive** | 02-05 | Re-run at the gate: harness `PASS`, `P5B_PROVEN`, `pnpm-lock.yaml` byte-identical, `git status --porcelain` empty |
| capture `git status --porcelain` before the mutation, compare after the restore, and downgrade the `PASS` line to a distinct wording if they differ | **detective** | 02-08 | not implemented |

02-05 additionally established what does **not** work, which matters more than either remedy:
`npm_config_verify_deps_before_run=false` has no effect (pnpm does not read the npm-style env var),
and `CI=true` / `--frozen-lockfile` is **actively wrong** — the pre-run install would *fail* before
the gate ever runs, and the harness would report `PASS: gate fired` on a proof that never executed,
which is the vacuously-green failure the harness exists to prevent. The published five-code exit table
is a contract that says "do not add a sixth code", so 02-08's half is a precondition/wording change
rather than a new code. **Owner: a Phase 3+ plan that opens `scripts/`, or a hardening plan.**

**F. T-02-44 — the unverified `nodejs.org/dist` download in `scripts/node-floor-check.sh`.**
Disposition **unchanged: accepted for v0.1**, and correctly so — 02-10 measured that the script is
invoked by **nothing** under `.github/` (0 non-comment matches), so it is not a CI-time exposure; the
downloaded runtime only *runs* the artifact and never builds, typechecks or publishes it. The
remediation is **larger than 02-09's claimed "two-line change"**, for two reasons both recorded by
02-10 and restated here so they are not re-derived:

1. The script currently streams `curl | tar` in one pipe, so **the tarball is never on disk to be
   checked**. Closing T-02-44 means materialising the `.tar.xz` first, then verifying, then extracting.
2. **`SHASUMS256.txt` is itself fetched over the same HTTPS channel and is not signature-checked.**
   The complete fix needs `SHASUMS256.txt.sig` plus the Node release keys. The partial fix still
   removes the corrupted-or-truncated-download class and the CDN-object-substitution class.

The exact shell is in `02-10-SUMMARY.md § carry-forward item 4`. **Owner: a post-v0.1 hardening plan.**
`ci.yml` already carries a standalone comment naming the gap at the pointer to that script.

## Requirements status

**`.planning/REQUIREMENTS.md` was NOT touched, and this is a scope fact rather than a sixth
consecutive deferral.** It is not in this plan's `files_modified` — that field lists exactly one path,
`02-VALIDATION.md` — and this plan's Task 3 action closes with *"Change nothing outside
`02-VALIDATION.md`."* This agent also runs in a worktree that is explicitly forbidden from writing
shared tracking artifacts.

**Stated explicitly so the phase verifier does not read five consecutive deferrals as an oversight:**
plans 02-05, 02-06, 02-07, 02-08, 02-09, 02-10 and 02-11 each left `REQUIREMENTS.md` untouched citing
`files_modified` scope and deferring to phase closeout, and this plan — the closeout — is scoped out
of it too. **The rows are ready to close on the evidence in this document. The orchestrator owns the
write.**

| Req | Reads | Delivered by | Evidence at the phase gate |
|---|---|---|---|
| **PKG-01** | publint and attw report no errors | 02-01, 02-03, 02-04, 02-11 | `check:artifact` exit **0** (publint `All good!`, attw `🟢`); mutants **P1, P2, P3a, P3b, P4, P8, P9** all fired |
| **PKG-02** | a pack-and-install test imports the artifact from a scratch project and typechecks against it | 02-09 | `check:pack` exit **0** from a clean checkout; row `02-09-T1` → `PKG02_OK`; negative control fires with `TS2322` |
| **PKG-03** | the declared Node floor matches the runtime the package works on | 02-09, 02-10 | `check:node-floor` exit **0** on a real **v22.12.0** against the developer's **v24.14.1**; mutant **P10** fired |
| **PKG-04** | publishes ESM-only, and a test asserts a single core instance shared across adapters | 02-03, 02-06, 02-07, 02-08 | attw `--profile esm-only` clean; F1a/F1b/F2 and F3a/F3b/F3c all green; mutants **P6, P7, P11** fired. **Caveat recorded in the contract: the runtime guard has no production call site yet** |
| **PKG-05** | core's runtime dependency footprint is verified zero-cost | 02-05, 02-06 | `check:deps` exit **0** — *core's dependencies contribute zero bytes to a consumer bundle*; mutants **P5a, P5b** fired |

Rows 94–98 still read `- [ ]` and rows 211–215 still read `Pending`.

## Verification

Both executable `<verify><automated>` blocks were run **verbatim**; the third is treated under
deviation 4.

| Block | Result |
|---|---|
| Task 1 — full clean → 8 commands → `test -z "$(git status --porcelain)"` | **`PHASE_GATE_GREEN`**, exit 0 |
| Task 2 — `pnpm build && mutate-and-prove … P4 … && git diff --exit-code && pnpm build && pnpm test` | **`P4_REPROVEN`**, exit 0 |
| Task 3 — the sign-off greps | exit 1 by construction; **every clause verified individually** (deviation 4) |

Plan-level `<verification>` block on the final tree:

| Check | Result |
|---|---|
| Clean checkout: seven commands green, exit codes recorded | **8** recorded (the plan's seven plus `check:node-floor`), all **0** |
| `check:node-floor` green on a real v22.12.0, developer's version recorded beside it | **v22.12.0** vs **v24.14.1**, both recorded |
| Thirteen mutant invocations, every one firing, `git diff --exit-code` clean after each | **13 / 13**, tree clean after **each** |
| P4, P6 and P10 each explicitly recorded as run and fired | **yes**, all three, with their distinguishing observations |
| Tarball file list reviewed and recorded; declaration map `sources` present in the tarball | **10 entries, 87,915 B**; both maps' sources resolve |
| Three honest limits recorded | **all three** in `02-VALIDATION.md` |
| `git status --porcelain` empty | **empty** |
| `02-VALIDATION.md` signed off, no pending rows, manual-only row intact | `nyquist_compliant: true`, `status: complete`, 0 pending **Status cells**, 1 manual-only row |

Adjacent gates, re-run after the edit to confirm nothing regressed:

| Check | Result |
|---|---|
| `pnpm typecheck` | **0** |
| `pnpm build` | **0** — `dist/index.js` 9.74 kB, `dist/index.d.ts` 77.26 kB |
| `pnpm test` | **0** — 4 files, 15 tests |
| `pnpm run check:artifact` | **0** |
| `pnpm run check:deps` | **0** |
| `git diff --exit-code` | **0** |

## Tree hygiene

`git status --porcelain` immediately before writing this SUMMARY is **empty** and `git diff` is clean.

Every mutation was applied and restored inside a single `mutate-and-prove.sh` invocation, and
`git diff --exit-code` at the repo root was asserted after **each** of the thirteen. Two invocations
dirtied `pnpm-lock.yaml` outside the harness's trap (P5b, and row `02-05-T2`); both were restored with
a file-scoped `git checkout -- pnpm-lock.yaml` followed by `CI=true pnpm install --frozen-lockfile
--prefer-offline`, and the tree re-asserted empty each time.

**No `git clean`, `git stash`, `git rm`, blanket checkout, or `git reset --hard`** was run at any
point past the mandated worktree-base correction at agent start. `git update-ref` was never invoked.

Every pack, scratch project and pattern file lived in a `mktemp -d` **outside the repository** —
deliberately outside `packages/`, which `pnpm-workspace.yaml`'s glob would swallow. The one directory
this plan retained during execution (the P6/P8/P11 pattern files) was removed before writing this
SUMMARY and verified gone. The `tmp.*` directories that remain under `$TMPDIR` all predate this plan's
start (2026-07-28, plus one Chrome cache directory from 07:08 local, against a 09:34 start) and were
left alone. The floor-runtime cache at `$TMPDIR/node-v22.12.0` (188 MB) is **intentionally retained** —
it is the cache `node-floor-check.sh` exists to build, it lives outside the repo, and re-downloading it
costs ~11 s.

No `.tgz` remains anywhere in the worktree; `*.tgz` is gitignored (02-01) and every pack used
`--pack-destination`.

## Issues Encountered

**1. The plan's own sign-off verify block cannot pass.** Diagnosed clause by clause rather than
worked around: two `grep -F` clauses are self-referential (already documented in the file) and the
`--watch` clause disables its own `--exclude-dir` flags by placing them after `--`. The third is a new
finding and was added to the file's documented-defects note. Full treatment as deviation 4.

**2. `mutate-and-prove.sh` reported a clean tree twice while `pnpm-lock.yaml` was dirty.** Restored
file-scoped both times. The briefing's attribution of this finding to 02-08 is corrected above: 02-05
found it in Wave 3 and supplied the preventive remedy, which was re-verified here.

**3. P9's echoed-source signature is renderer-conditioned in *both* directions on this tree** —
absent through a pipe, and suppressed entirely by pnpm's TTY spinner reporter. Reproduced by forcing
`--pretty` on the gate. Full treatment as deviation 3.

**4. Three rows' commands are stale rather than wrong** (`02-01-T3`, `02-03-T1`, `02-05-T2`). Each was
marked ⚠️ with its reason and the corrected form that is green. None was rewritten to pass.

## Deferred Items

| Item | Detail | Suggested owner |
|---|---|---|
| Three stale M9 prose claims | `actions.test-d.ts:147`, `:153-155`, `src/types.ts:505-506`. Exact replacement wording in carry-forward item C. Both files are outside `files_modified` and are protected by `git diff --exit-code` criteria in two of 02-11's tasks | a Phase 3+ plan that opens both |
| `/* @__PURE__ */` on `types.ts`'s three `Object.freeze` initializers | ~205 B of dead calls in every consumer bundle that reaches runtime code. Mechanism and remedy both proven (02-06, corroborated by 02-07). Same file as item C — land them together | the same Phase 3+ plan |
| `mutate-and-prove.sh` lockfile precondition | Two complementary remedies, and one form that is actively wrong. Carry-forward item D | a Phase 3+ plan that opens `scripts/`, or a hardening plan |
| T-02-44 checksum verification | Larger than "two lines": materialise the `.tar.xz` first, and `SHASUMS256.txt` is itself unsigned-checked. **Accepted for v0.1** — CI never invokes the script | a post-v0.1 hardening plan |
| Close PKG-01…PKG-05 in `REQUIREMENTS.md` | All five delivered and defect-proven; rows 94–98 and 211–215 untouched. Outside `files_modified` | the orchestrator, at phase close |
| Row `02-03-T1`'s `n===43` assertion | Historical and superseded by `02-06-T2`'s 45. Left verbatim so the cell still matches 02-03's `<verify>` text | not scheduled — accepted |
| SHA-pin the third-party GitHub Actions | T-02-54, accepted for v0.1 | post-v0.1 |
| `packages/concierge/test/**` is in no TypeScript program | Inherited and accepted with three named reasons in `vitest.config.ts` | not scheduled — accepted |

## Known Stubs

None. This plan wrote no code. Every statement in `02-VALIDATION.md` that changed is backed by a
command executed on this tree with its exit code recorded: 31 row commands, 13 mutant invocations, 8
clean-checkout commands, a packed-and-extracted tarball, and a parsed `dist/index.d.ts`. There is no
placeholder value, no `TODO`, and no row marked ✅ on the strength of a plan having been executed.

The three things that are genuinely unproven are **not stubs** — they are the phase's stated limits,
recorded in the contract as such: the release workflow has never executed, two assertions are vacuous
and counted nowhere, and `assertSingleInstance` has no production call site.

## Threat Model Outcomes

| Threat | Disposition | Evidence |
|---|---|---|
| T-02-59 a gate weakened by a later wave and never re-checked | **mitigated** | The whole eleven-mutant battery re-run consecutively on the finished phase — thirteen invocations, every one non-zero from its named gate, none trusted from the wave that built it. Two gates were found to have moved and are recorded: P2's count is 2 not 4, and P11's is 44/45 not 42/43 |
| T-02-60 a lockfile that only resolves against an already-installed tree | **mitigated** | `pnpm install --frozen-lockfile` after removing `dist/` and every `node_modules`, which is the same install CI performs. Exit 0, `Lockfile is up to date, resolution step is skipped`, `Scope: all 4 workspace projects` |
| T-02-61 an unrestored mutation shipping in the phase commit | **mitigated** | `git diff --exit-code` after **each** of the thirteen invocations, not only at the end, plus `git status --porcelain` empty as a phase-level assertion. The two lockfile dirtyings this surfaced were caught by exactly that root-level assertion and restored file-scoped — which is the residual 02-02's T-02-09 accepted, now closed by observation rather than by argument |
| T-02-62 tarball contents drifting from the reviewed decision | **mitigated** | The file list was reviewed against 02-03's record and differs by **exactly one** expected entry. Forbidden-path scan all 0. Both maps' `sources` entries extracted and resolved against the tarball's own contents — all four resolve |
| T-02-63 a validation sign-off asserting coverage that was never observed | **mitigated** | Every Status set from a command executed today; **five rows warned rather than passed**, each with its reason. The manual-only row keeps its "cannot be executed in this phase" wording and its static-review outcome is labelled as inspection, not execution. Both vacuous assertions are named and excluded from the count, and a **third** limit — the absent production call site — was added because it is the overclaim most likely to be discovered in Phase 3 |
| T-02-SC npm/pnpm installs | **held** | The only installs were `pnpm install --frozen-lockfile` from the committed lockfile (three times: the clean gate, the verbatim verify block, and two file-scoped resyncs). `pnpm-lock.yaml` is byte-unchanged in the final tree and no dependency edge was added |

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access and no schema at a trust
boundary. It changes one markdown file inside `.planning/`, which is outside `packages/concierge`'s
`files` array and ships nowhere.

The two network-reaching scripts it *executed* — `check:pack` (npm registry, into a throwaway
directory) and `check:node-floor` (`nodejs.org/dist`, executed with no checksum) — are already
registered as **T-02-44** and were flagged at phase level by 02-09. Nothing about their disposition
changed here; the remediation is recorded in carry-forward item F.

## User Setup Required

**One item, and it blocks the first publish only** — nothing in this phase, and no CI run, depends on
it. Before the first real release, a maintainer must configure the trusted publisher on npmjs.com
(package settings → **Trusted publishers** → GitHub Actions, bound to repository
`fullselfbrowsing/concierge` and workflow file `release.yml`). The workflow cannot create this
binding. Full steps are in `RELEASING.md § One-time setup on the npm side`. Carried forward from
02-10, unchanged.

## Next Phase Readiness

1. **The phase is green from nothing.** Eight commands from an empty `node_modules` and no `dist/`,
   on a genuinely downloaded v22.12.0. Any Phase 3 regression can be attributed against this baseline:
   `dist/index.js` **9.74 kB**, `dist/index.d.ts` **77.26 kB**, tarball **87,915 B**, **10** entries,
   export surface **45** names in **1** block, suite **4 files / 15 tests**.
2. **`assertSingleInstance` still has no caller, and Phase 3 is where that changes.** The intended
   call sites are `createConcierge` and each adapter's registration hook. Until one of them lands,
   PKG-04's runtime enforcement is proven by test and inert in product — written into the sign-off in
   those terms.
3. **Three stale M9 prose claims and the three `/* @__PURE__ */` annotations touch the same two
   files.** Land them in one plan; exact wording and line numbers are in carry-forward items C and E.
4. **Use `pnpm test <name>`, never `pnpm test -- <name>`.** Six independent reproductions. The docs
   and CI are both clean now; do not reintroduce it.
5. **After any `mutate-and-prove.sh` run whose gate can install, assert `git status --porcelain` at
   the repo root.** The harness's "tree clean" covers its target file only. 02-05's
   `--config.verify-deps-before-run=false` prevents it; do **not** reach for `CI=true` or
   `--frozen-lockfile`, which produce a vacuously-green `PASS`.
6. **Do not grep typecheck output for an alias name.** `tsc`'s `pretty` is off without a TTY, and
   pnpm's TTY reporter swallows the output entirely. Grep the `file:line`, which is present in both
   modes, or force `--pretty` on the gate.
7. **`REQUIREMENTS.md` PKG-01…PKG-05 are all delivered and ready to close.** The orchestrator owns
   that write; the evidence table is in § Requirements status.

## Self-Check: PASSED

Files claimed created/modified, verified present on disk:

- `.planning/phases/02-packaging-build-and-release/02-VALIDATION.md` — FOUND, **440 lines**;
  frontmatter `status: complete` and `nyquist_compliant: true`; **31** rows matching `^| 02-`, each
  with exactly **10** unescaped-pipe columns; **0** `⬜ pending` Status cells; `**Approval:** approved
  — 2026-07-29`; § Manual-Only Verifications has exactly **1** data row and still contains
  `cannot be executed in this phase`
- `.planning/phases/02-packaging-build-and-release/02-12-SUMMARY.md` — FOUND

Commit claimed, verified in `git log`:

- `ce789d1` — FOUND (`docs(02-12): sign off the validation contract on measured evidence`),
  1 file changed, 293 insertions, 93 deletions

`git diff --name-only e4f1b83..HEAD` lists **exactly one** path before this SUMMARY commit —
`.planning/phases/02-packaging-build-and-release/02-VALIDATION.md` — which is this plan's entire
declared `files_modified`. No file under `packages/`, `scripts/`, `.github/` or `.changeset/`, no
`package.json`, no `pnpm-lock.yaml`, no `pnpm-workspace.yaml`, and no `STATE.md`, `ROADMAP.md` or
`REQUIREMENTS.md` appears — the last three are the orchestrator's to write. The commit contains no
deletion (`git diff --diff-filter=D --name-only HEAD~1 HEAD` is empty) and no untracked file remains.

---
*Phase: 02-packaging-build-and-release*
*Completed: 2026-07-29*
