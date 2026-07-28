#!/usr/bin/env bash
# scripts/mutate-and-prove.sh — PKG-01
#
# Applies one literal substitution to a tracked file, runs a gate command
# against the mutated tree, restores the file, and PROVES the restoration —
# all in a single invocation, so no mutation can outlive the command that
# made it.
#
# Why this file exists: every gate in this phase is a shell exit code, and an
# exit code never observed non-zero is indistinguishable from an absent check.
# Proving a gate fires means deliberately breaking the source. Phase 1 ended
# with a near-miss doing exactly that by hand — an interrupted executor left a
# mutation applied and uncommitted, one unexamined merge away from shipping an
# erased type parameter. That is a process defect, and a `trap` fixes it.
#
# Usage:
#   scripts/mutate-and-prove.sh <target-file> <literal-pattern> <replacement> -- <gate command...>
#
# The pattern is matched LITERALLY, not as a regex, and exactly one occurrence
# is replaced.
#
# Exit codes — each is meaningful, and this table is a published contract that
# other plans in this phase already read. Do not add a sixth code:
#
#   0  PASS  — the gate exited non-zero (the mutant was caught) and the tree is clean
#   1  FAIL  — the gate exited 0 (the mutant escaped)
#   2  ABORT — the target is unusable: not tracked, already dirty, or not supplied
#   3  ABORT — the substitution was a no-op (the pattern never matched)
#   4  ABORT — the target file was not restored
#
# The gate's own exit code is printed on the PASS line, because callers assert
# on the specific code (tsc exits 2 on diagnostics; a SIGKILLed gate exits 137).
#
# Shell options are `set -uo pipefail` and deliberately NOT errexit. The gate
# failing is this script's EXPECTED outcome; `set -e` would abort the run at the
# gate and skip the restore-and-prove sequence that is the entire point.
#
# Known limitation, accepted rather than mitigated (T-02-09): SIGKILL does not
# run traps, so `kill -9` of this wrapper itself leaves the mutation applied.
# That is contained at the wave boundary instead — every plan in this phase
# asserts `git diff --exit-code` at the repo root before its commit, and the
# phase gate asserts `git status --porcelain` empty once more.

set -uo pipefail

# A missing argument must not be allowed to reach the unbound-variable check,
# whose exit status is 1 — the same code as FAIL. A caller's typo would
# otherwise be read as the finding "the mutant escaped".
if [ "$#" -lt 4 ]; then
  echo "ABORT: usage: $0 <target-file> <literal-pattern> <replacement> -- <gate command...>"
  exit 2
fi

TARGET="$1"
PATTERN="$2"
REPLACEMENT="$3"
shift 3

# The published interface separates the gate with `--`. Consume it, so that the
# gate command and not the separator is what gets executed.
if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "$#" -lt 1 ]; then
  echo "ABORT: no gate command supplied after --"
  exit 2
fi

# Pre-flight A — the target must be tracked by git.
# Against an untracked path `git diff --quiet` exits 0 both before AND after a
# successful substitution, so the no-op detector below would fire exit 3 and
# report a bad pattern when the real problem is a missing `git add`. Worse, the
# EXIT trap's `git checkout --` then fails and leaves the mutation on disk.
if ! git ls-files --error-unmatch "$TARGET" >/dev/null 2>&1; then
  echo "ABORT: target is not tracked by git (nothing to restore from): $TARGET"
  exit 2
fi

# Pre-flight B — the target must be clean, so that the restore below can never
# clobber real uncommitted work.
if ! git diff --quiet -- "$TARGET"; then
  echo "ABORT: $TARGET is dirty before mutation"
  exit 2
fi

# Installed BEFORE the mutation, so restoration survives a gate that crashes or
# hangs, and a SIGINT or SIGTERM delivered to this script mid-run.
trap 'git checkout -- "$TARGET"' EXIT INT TERM

# The pattern and the replacement travel through the ENVIRONMENT and are never
# interpolated into perl's source text. Writing this the obvious way —
# perl -0pi -e "s/\Q$PATTERN\E/$REPLACEMENT/" — lets the shell paste the
# arguments into the program before perl parses it, so any `/` in either one
# terminates the s/// delimiter and perl dies with a syntax error instead of
# mutating. That is not hypothetical here: mutant P1 replaces "./dist/index.d.ts"
# and mutant P8 moves the line `} from "./types.js";`. Both contain a slash.
#
# `-0` slurps, so a multi-line pattern matches. `\Q...\E` makes the pattern
# literal rather than a regex. There is deliberately no `/g` — replacing exactly
# one occurrence is what keeps the restore small and provable.
MUT_PATTERN="$PATTERN" MUT_REPLACEMENT="$REPLACEMENT" \
  perl -0pi -e 's/\Q$ENV{MUT_PATTERN}\E/$ENV{MUT_REPLACEMENT}/' "$TARGET"

# No-op detection. If the file is still byte-identical the pattern never
# matched, and running the gate now would test unmutated source — the failure
# mode that reports a green "mutant caught" while proving nothing. Phase 1's
# suite had three escapees of exactly this family.
if git diff --quiet -- "$TARGET"; then
  echo "ABORT: mutation was a no-op (pattern never matched)"
  exit 3
fi

"$@"
RC=$?

git checkout -- "$TARGET"
trap - EXIT INT TERM

# The post-condition, not advice. A result is only trustworthy if the tree is
# provably back at its committed state, so the restore is asserted rather than
# assumed.
if ! git diff --exit-code -- "$TARGET"; then
  echo "ABORT: $TARGET not restored"
  exit 4
fi

if [ "$RC" -ne 0 ]; then
  echo "PASS: gate fired (exit $RC), tree clean"
  exit 0
fi

echo "FAIL: gate did NOT fire — mutant escaped"
exit 1
