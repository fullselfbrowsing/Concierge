---
phase: 02-packaging-build-and-release
plan: 02
subsystem: testing
tags: [bash, perl, git, mutation-testing, defect-first-proof, scripts]

# Dependency graph
requires:
  - phase: 01-type-contract
    provides: "packages/concierge/src/types.ts and src/index.ts — the tracked sources the harness was exercised against"
provides:
  - "scripts/mutate-and-prove.sh — the phase's only mutation harness: apply, gate, restore, prove the restore, in one invocation"
  - "A published five-code exit contract (0 PASS / 1 FAIL / 2 ABORT-unusable / 3 ABORT-no-op / 4 ABORT-not-restored)"
  - "Slash-safe literal substitution, so mutants P1 and P8 can be expressed at all"
  - "Structural prevention of Phase 1's near-miss: a mutation cannot outlive the command that made it"
affects: [02-04, 02-05, 02-07, 02-09, 02-10, 02-11, 02-12, mutation-proofs, ci]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "scripts/ convention: #!/usr/bin/env bash, then a # header naming the requirement ID it serves"
    - "Defect-first proof (shared pattern C) — a gate is only proven by observing it fire"
    - "Environment-passed regex operands: never interpolate caller data into a perl program's source text"

key-files:
  created:
    - scripts/mutate-and-prove.sh
  modified: []

key-decisions:
  - "Pattern and replacement reach perl via $ENV{MUT_PATTERN}/$ENV{MUT_REPLACEMENT} read directly in the s/// line, not via BEGIN-block lexicals: the my-in-BEGIN form the plan wording prescribes is unreliable by perl's own documentation and was measured re-running with an EMPTY pattern on a second record"
  - "The -- separator is consumed explicitly; the research body's `shift 3` would have executed `--` as the gate command and reported exit 127 for every mutant"
  - "Argument-count guards reuse exit 2 rather than adding a sixth code, because set -u's unbound-variable exit is 1 — identical to FAIL, so a caller's typo would have read as the finding 'the mutant escaped'"
  - "No perl exit-status check: a dying perl leaves the file unchanged, which the no-op detector already catches with the tree restored, and the plan forbids a sixth exit code"

patterns-established:
  - "Restore-before-report: the trap is installed before the mutation, and git diff --exit-code is a post-condition with its own abort code, not advice"
  - "Abort codes must distinguish causes: untracked and dirty share exit 2 but carry distinct messages, because 'run git add' and 'fix your pattern' are different debugging sessions"
  - "Comments in shell scripts are standalone # lines, never trailing, so acceptance checks can scope absence assertions to non-comment lines"

requirements-completed: [PKG-01]

# Metrics
duration: 9min
completed: 2026-07-28
---

# Phase 02 Plan 02: Mutation harness Summary

**`scripts/mutate-and-prove.sh` — a single invocation that mutates a tracked file, runs a gate, restores, and proves the restore, observed producing all five of its exit codes including a SIGKILL'd gate and a slash-bearing substitution.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-28T23:05:56Z
- **Completed:** 2026-07-28T23:14:34Z
- **Tasks:** 2
- **Files modified:** 1 created, 0 modified

## Accomplishments

- Built the harness every later mutation proof in this phase depends on, in 134 lines with no dependencies beyond `bash`, `git` and `perl`.
- **Closed the slash hazard, and measured that it was real.** The research body's `perl -0pi -e "s/\Q$PATTERN\E/$REPLACEMENT/"` was run against the exact P8 pattern and died: `syntax error at -e line 1` … `Execution of -e aborted due to compilation errors.`, exit **255**. Mutants P1 (`"./dist/index.d.ts"`) and P8 (`} from "./types.js";`) would both have been inexpressible.
- **Observed every one of the five exit codes firing**, not four — the two abort paths the plan did not require exercising (dirty pre-flight, and exit 4 not-restored) were exercised as well.
- Confirmed the harness fails *loud* when restoration is impossible: it prints the unrestored diff and exits 4 rather than reporting a pass.

## Task Commits

1. **Task 1: Write scripts/mutate-and-prove.sh with slash-safe substitution** — `01a8e20` (chore)
2. **Task 2: Prove the harness fails four ways, including the slash case** — no commit of its own. Task 2 changed no file: all four cases passed against the script as written, and the plan states *"do not commit any intermediate state."* Its deliverable is the recorded evidence below, committed with this SUMMARY.

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified

- `scripts/mutate-and-prove.sh` — created, executable (100755). Applies one literal substitution to a tracked file, runs a gate, restores, and proves the restoration. Establishes the `scripts/` header convention for this repo (no shell script existed anywhere before this one).

## Observed Results — the four mandated cases

All four run against the committed tree; every line below is verbatim stdout.

| Case | Script exit | Verbatim verdict line |
|---|---|---|
| **A** gate fires | **0** (expected 0) | `PASS: gate fired (exit 2), tree clean` |
| **B** mutant escapes | **1** (expected 1) | `FAIL: gate did NOT fire — mutant escaped` |
| **C** pattern never matched | **3** (expected 3) | `ABORT: mutation was a no-op (pattern never matched)` |
| **D** slash + SIGKILL'd gate | **0** (expected 0) | `PASS: gate fired (exit 137), tree clean` |

**Case A — observed gate exit code: 2.** Recorded rather than assumed, as the plan required. The mutation also surfaced the diagnostic pair proving the mutant was genuinely seen:

```
src/types.ts(279,14): error TS2322: Type '180' is not assignable to type '181'.
test-d/results.test-d.ts(108,29): error TS2344: Type 'false' does not satisfy the constraint 'true'.
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @fullselfbrowsing/concierge@0.0.0 typecheck: `tsc -p tsconfig.test-d.json`
Exit status 2
PASS: gate fired (exit 2), tree clean
```

`src/types.ts(279,14)` independently confirms the refreshed line reference from commit `a4ff337`: `MESSAGE_MAX_CHARS` is at line **279**. No exit-3 "moved target" abort occurred, so no drift needs reporting.

**Case C — the gate did not run.** Total output was exactly **one line** (the ABORT). The probe gate `bash -c 'echo GATE_RAN_IN_CASE_C'` produced no output, confirming the no-op detector aborts *before* the gate.

**Case D — the slash hazard is closed.** Both operands contain `/`. `grep -i 'syntax error'` over the output found nothing. `packages/concierge/src/index.ts` was **byte-identical** before and after:

```
sha256 BEFORE = f1416869bb03807399727203bb0daeae82e5ddf869a1c24ed02ef7d89e7c088d
sha256 AFTER  = f1416869bb03807399727203bb0daeae82e5ddf869a1c24ed02ef7d89e7c088d
```

The wrapper survived the gate's `kill -9` (bash reported `line 114: 50139 Killed: 9  "$@"`) and the trap restored the file.

**Supplementary probe (Case D-prime)** — same slash substitution, gate `grep -n "slash-safety probe" … ; exit 7`. Output: `63:} from "./types.js"; // slash-safety probe` then `PASS: gate fired (exit 7), tree clean`. This proves three things at once: the substitution genuinely lands, it is **non-global** (line 63, the *first* of the two occurrences — the type-export block, which is what mutant P8 needs), and perl parsed the slash-bearing operands fine.

## Observed Results — the two extra abort paths

Neither was required by the plan's four cases; both were exercised because an unobserved guard does not count.

| Probe | Script exit | Verbatim verdict line |
|---|---|---|
| **Untracked target** (Task 1 AC) | **2** | `ABORT: target is not tracked by git (nothing to restore from): scripts/.untracked-probe.tmp` |
| **Dirty target** (pre-flight B) | **2** | `ABORT: packages/concierge/src/types.ts is dirty before mutation` |
| **Not restored** (exit 4) | **4** | `ABORT: f.txt not restored` |

- **Untracked:** run against a freshly created, unstaged file. Aborted with the *untracked* message and **not** exit 3 — the misdiagnosis the plan specifically calls out. The gate did not run and the probe file was left unmutated.
- **Dirty:** dirt was appended to `types.ts` by hand, the harness refused, **and did not clobber the dirt** — the property the pre-flight exists for. The hand-applied dirt was restored inside the same shell invocation and `git diff --exit-code` asserted immediately after.
- **Not restored (exit 4):** forced inside a throwaway `git init` repo under `/tmp`, fully isolated from this worktree — the gate ran `chflags uchg f.txt`, making restoration impossible. The harness printed `error: unable to unlink old 'f.txt': Operation not permitted`, then the full unrestored diff, then `ABORT: f.txt not restored`, exit **4**. It did **not** report a pass. The probe repo was deleted in the same call.

## Verification

Both `<verify><automated>` blocks were run verbatim:

- Task 1 → `HARNESS_WRITTEN`
- Task 2 → `PASS: gate fired (exit 2), tree clean` then `HARNESS_PROVEN`

Acceptance-criteria checks, all passing:

- `test -x scripts/mutate-and-prove.sh` → 0; `bash -n` → 0
- `set -uo pipefail` present; `grep -v '^[[:space:]]*#' … | grep -c 'set -e'` → **0**
- `trap 'git checkout -- "$TARGET"' EXIT INT TERM` at line 89, installed before the mutation
- `git ls-files --error-unmatch` pre-flight at line 75; `git diff --exit-code` post-condition at line 123
- Substitution line: `perl -0pi -e 's/\Q$ENV{MUT_PATTERN}\E/$ENV{MUT_REPLACEMENT}/' "$TARGET"` — no `/g`, and neither operand appears textually inside the `perl -e` string
- Zero trailing inline comments (checked after stripping `$#` parameter expansions, which are not comments)
- Exit codes 0/1/2/3/4 all present; **no sixth code**

## Tree hygiene (hard constraint 4)

`git status --porcelain` at the end of execution, verbatim — the output is **empty**:

```
```

Also asserted: `git diff --exit-code` clean at the repo root after **every** individual case; `pnpm --filter @fullselfbrowsing/concierge typecheck` exits **0** at rest (nothing left mutated); `pnpm-lock.yaml` unchanged after `pnpm install --frozen-lockfile --prefer-offline`; `README.md` and `packages/concierge/README.md` untouched and absent from every commit in this plan; `.planning/STATE.md` and `.planning/ROADMAP.md` unmodified.

No mutation was ever left live across a tool-call boundary.

## Decisions Made

- **The substitution reads `$ENV{...}` directly instead of via `BEGIN`-block lexicals.** See deviation 2 — the prescribed form is unreliable and was measured misbehaving.
- **`-0` rather than `-0777`**, as the plan and research both specify. For NUL-free text sources these are identical; every mutation target in this phase is source or manifest text.
- **No perl exit-status check.** A dying perl leaves the file unchanged, so the no-op detector already aborts with the tree restored by the trap. Adding a code for it would violate the plan's "no sixth code" contract; the diagnosis is slightly coarse but the harness fails closed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The `--` separator would have been executed as the gate command**

- **Found during:** Task 1
- **Issue:** The research body (`02-RESEARCH.md:602`) does `shift 3`, but the published interface is `<target> <pattern> <replacement> -- <gate...>`. After `shift 3` the first element of `"$@"` is `--`, so `"$@"` would try to execute a command literally named `--`. Every gate would have exited 127 — non-zero — so **every mutant in the phase would have reported `PASS` without the gate ever running.** This is the exact silently-green failure the plan exists to prevent, and it would have been invisible.
- **Fix:** Consume the separator explicitly (`if [ "${1:-}" = "--" ]; then shift; fi`), plus a guard for a gate command that is missing entirely.
- **Files modified:** `scripts/mutate-and-prove.sh`
- **Verification:** Case C's gate demonstrably did not run (single-line output), while Cases A/B/D demonstrably did (tsc diagnostics, `Killed: 9`, and the `grep` hit in D-prime). Case B returning exit 1 rather than a spurious PASS is the direct proof.
- **Committed in:** `01a8e20`

**2. [Rule 1 - Bug] The prescribed `BEGIN`-block lexical form is unreliable**

- **Found during:** Task 1
- **Issue:** The plan's action text says to read the env vars "into lexicals in a `BEGIN` block". Under `perl -p`, the code is wrapped in a `while` loop, so `my ($p,$r); BEGIN { $p = … }` assigns at compile time and the runtime `my` re-introduction clears the pad. Perl documents the value of a `my` assigned in `BEGIN` as unpredictable. Measured directly on a two-record input: the `BEGIN`+`my` form substituted only in record 1 and ran record 2 with an **empty pattern** — and an empty pattern in perl reuses the last successful one, which is a silent double-substitution hazard in exactly the tool whose job is single-substitution provability.
- **Fix:** Read `$ENV{MUT_PATTERN}` / `$ENV{MUT_REPLACEMENT}` directly in the `s///` line. This preserves the plan's mandatory property in full — nothing is interpolated into perl's source text — and matches the acceptance criterion's own wording ("the substitution line references `MUT_PATTERN` and `MUT_REPLACEMENT` via `$ENV{...}`") more literally than the `BEGIN` form would.
- **Files modified:** `scripts/mutate-and-prove.sh`
- **Verification:** Four forms were probed side by side outside the repo before the script was written. The chosen form substitutes correctly, is slash-safe, and has no compile-time/runtime ordering dependency. Case D and D-prime confirm it in situ.
- **Committed in:** `01a8e20`

**3. [Rule 2 - Missing Critical] Argument-count guards, mapped onto exit 2**

- **Found during:** Task 1
- **Issue:** With `set -u` and no `set -e`, a missing argument makes `TARGET="$1"` abort the shell with status **1** — which is the harness's own `FAIL: mutant escaped` code. A caller who dropped an argument would be handed a false finding to investigate, in a suite where exit 1 means "your gate is broken".
- **Fix:** Two explicit guards printing `ABORT:` messages and exiting **2** ("target unusable, nothing was mutated"). No sixth exit code was introduced, per the plan's explicit contract.
- **Files modified:** `scripts/mutate-and-prove.sh`
- **Verification:** Exit-code inventory confirms only 0/1/2/3/4 appear. All three exit-2 messages are distinct and name their cause.
- **Committed in:** `01a8e20`

---

**Total deviations:** 3 auto-fixed (2 bugs in the prescribed source body, 1 missing critical guard)
**Impact on plan:** No scope creep — all three are inside `scripts/mutate-and-prove.sh`, the plan's only `files_modified` entry. Deviation 1 is load-bearing: without it every mutation proof in Phase 2 would have been vacuously green. The plan's forbidden additions (`--dry-run`, `-g/--global`, regex mode, multi-file) were all omitted.

## Issues Encountered

- **The research body cannot run the phase's own mutants.** Confirmed empirically rather than argued: `perl -0pi -e "s/\Q$PATTERN\E/$REPLACEMENT/"` against `} from "./types.js";` exits 255 with `syntax error at -e line 1`. The plan anticipated this and mandated the env-var departure; this records the measurement backing it.
- **Fresh worktree had no `node_modules`.** Bootstrapped with `pnpm install --frozen-lockfile --prefer-offline` (pnpm 10.33.0, Node v24.14.1). Lockfile asserted unchanged afterward, as required — this plan installs nothing.

## Known Stubs

None. The script is complete and every branch has been executed at least once.

## Threat Flags

None. This plan introduces no network endpoint, auth path, or schema change. The one new file writes to tracked source deliberately and is the mitigation for T-02-06, T-02-07 and T-02-08 rather than new surface. T-02-09 (SIGKILL of the wrapper) remains **accepted** and is documented in the script header, as the register specifies.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready.** Plans 02-04, 02-05, 02-07, 02-09, 02-10, 02-11 and 02-12 can now express their mutants as one command and must not hand-roll a `sed`-then-undo equivalent.
- The published exit-code contract is stable: **0** PASS, **1** FAIL, **2** ABORT-unusable, **3** ABORT-no-op, **4** ABORT-not-restored.
- Callers needing two facts about one mutant (P4: `typecheck` must fire while `build` must not) use the compound-gate form from the plan's `<interfaces>` block: `-- bash -c '<cmd>; echo TAG=$?; <cmd-that-must-fire>'`.
- **Carry-forward for 02-09:** its PKG-02 negative control targets a file the task creates itself. That file must be `git add`ed before the harness sees it, or the run aborts with exit 2 and the untracked message. This is now a clear diagnostic rather than a confusing exit 3.
- **Carry-forward for whoever runs the P8 mutant:** the pattern `} from "./types.js";` occurs **twice** in `src/index.ts` (lines 63 and 70). The substitution is non-global and hits **line 63**, the type-export block — verified. That is the occurrence P8 wants.

---
*Phase: 02-packaging-build-and-release*
*Completed: 2026-07-28*
