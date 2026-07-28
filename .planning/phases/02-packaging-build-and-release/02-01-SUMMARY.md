---
phase: 02-packaging-build-and-release
plan: 01
subsystem: toolchain
tags: [packaging, build, release, typescript-7, pnpm-11, supply-chain]
requires: []
provides:
  - "TypeScript 7.0.2 exact as the repo compiler"
  - "pnpm 11.17.0 as the pinned package manager"
  - "tsdown, rolldown, vitest, publint, @arethetypeswrong/cli, @changesets/cli installed and resolvable from the repo root"
  - "packages/concierge/LICENSE, so npm pack and pnpm pack agree"
  - "*.tgz gitignored, so a packed tarball cannot dirty a git status --porcelain assertion"
  - "02-VALIDATION.md per-task verification map, 31 rows, wave_0_complete: true"
affects:
  - "every later plan in phase 2 — none of them can run without this toolchain"
tech-stack:
  added:
    - "typescript@7.0.2 (exact)"
    - "tsdown@0.22.14"
    - "rolldown@1.2.0"
    - "vitest@4.1.10"
    - "publint@0.3.22"
    - "@arethetypeswrong/cli@0.18.5"
    - "@changesets/cli@2.31.1"
  patterns:
    - "Exact version pins (no caret) for every root devDependency"
    - "pnpm 11's default 24h minimumReleaseAge supply-chain policy left ON; transitive deps re-resolved to satisfy it"
key-files:
  created:
    - packages/concierge/LICENSE
  modified:
    - package.json
    - pnpm-lock.yaml
    - .gitignore
    - .planning/phases/02-packaging-build-and-release/02-VALIDATION.md
    - packages/concierge/test-d/transport.test-d.ts
decisions:
  - "Re-resolved the lockfile rather than relaxing pnpm 11's minimumReleaseAge policy"
  - "Corrected the readbackHash type guard to its declared type rather than reverting off TS 7"
  - "Recorded two unsatisfiable clauses in this plan's own verify rather than distorting the data to satisfy them"
metrics:
  duration: "~15 min"
  completed: 2026-07-28
  tasks: 3
  commits: 4
  files_changed: 6
---

# Phase 2 Plan 01: Toolchain, LICENSE, and the Validation Map — Summary

Pinned TypeScript to 7.0.2 exactly and pnpm to 11.17.0, installed the six tools the rest of phase 2
runs on, gave `packages/concierge` its own LICENSE so `npm pack` and `pnpm pack` finally agree, and
expanded the phase validation map from one placeholder row to 31 real per-task rows.

## What Shipped

| Task | Name | Commit | Files |
|---|---|---|---|
| — (deviation) | Correct the `readbackHash` guard to its declared optional type | `b7abd2a` | `packages/concierge/test-d/transport.test-d.ts` |
| 1 | Pin TS 7.0.2, install the toolchain, close the LICENSE and `*.tgz` gaps | `3f34431` | `package.json`, `pnpm-lock.yaml`, `packages/concierge/LICENSE`, `.gitignore` |
| 2 | Bump `packageManager` to pnpm 11.17.0, isolated | `eb9dbfc` | `package.json`, `pnpm-lock.yaml` |
| 3 | Expand the validation map to per-task rows, close Wave 0 | `f2bf334` | `02-VALIDATION.md` |

## Verification

Every clause of the plan's `<verification>` block, run at the end of the plan:

| Check | Result |
|---|---|
| `pnpm exec tsc --version` | `Version 7.0.2` |
| `pnpm --version` | `11.17.0` |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm --filter @fullselfbrowsing/concierge typecheck` | exit 0 |
| `node -e "import('rolldown')"` from repo root | exit 0, `typeof rolldown === "function"` |
| `cmp LICENSE packages/concierge/LICENSE` | exit 0 |
| `.gitignore` contains exact line `*.tgz` | yes |
| `02-VALIDATION.md` per-task rows | 31, `wave_0_complete: true` |
| `git status --porcelain` | empty |

### Mutation hygiene (mandated pre-SUMMARY check)

`git status --porcelain` at the end of the plan, verbatim — the output is **empty**, zero lines:

```
```

`git diff --exit-code -- packages/concierge/src/` also exits 0. No source file carries a leftover
mutation. Every mutation in this plan was applied and restored inside a single Bash invocation with
`git diff --exit-code` asserted in that same call.

### Defect-first proof

The one guard this plan touched was observed **failing** before it was trusted. With `readonly`
stripped from `src/types.ts:383` (applied and restored in one call):

```
test-d/transport.test-d.ts(133,47): error TS2344: Type 'false' does not satisfy the constraint 'true'.
OBSERVED_GATE_EXIT=1
RESTORE_CLEAN
```

The LICENSE and `*.tgz` fixes were likewise proven against the defect they close, not just asserted
— see the two tables below.

## Deviations from Plan

### 1. [Rule 3 — Blocking] RESEARCH.md's `[VERIFIED]` TS 7 exit-0 claim is false for the test-d program

**Found during:** Task 1, immediately after installing TS 7.0.2.

`02-RESEARCH.md:777` states: *"TS 7.0.2 run against both real repo configs: exit 0, no diagnostics
`[VERIFIED]`."* That is **not** reproducible. `tsconfig.test-d.json` fails:

```
test-d/transport.test-d.ts(133,47): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```

The build program (`tsconfig.json`, `src/` only) **does** exit 0 under TS 7 — so the research claim
holds for one of the two configs and was likely never re-run against the test-d program after
commit `c5f5b10` (plan 01-14) added these four readonly guards on 2026-07-28, the same day.

**Root cause — measured, not inferred.** `src/types.ts:383` declares
`readonly readbackHash?: string | undefined`. The guard at `transport.test-d.ts:133` asserted the
value side was `string`, dropping the `| undefined`. Under `exactOptionalPropertyTypes: true` those
are distinct types. An out-of-repo probe run under both compilers:

| Predicate | TS 5.9.3 | TS 7.0.2 |
|---|---|---|
| `Equals<Pick<Src,"readbackHash">, { readonly readbackHash?: string }>` | `true` | **`false`** |
| `Equals<Pick<Src,"readbackHash">, { readonly readbackHash?: string \| undefined }>` | `true` | `true` |
| `Equals<Pick<Src,"readbackHash">, Src>` (Pick identity) | `true` | `true` |
| control: same predicate against a **mutable** member | `false` | `false` |

The `Equals` conditional-type identity trick could not distinguish `?: string` from
`?: string | undefined` on TS 5.9.3. TS 7.0.2 can. So the guard was passing while pinning a type the
source does not have — a latent defect TS 5.9.3 masked, not a TS 7 regression.

**Fix:** one token — the value side now reads `string | undefined`, which is what the block comment
above the guard already says it does (*"the value side is written as the declared alias rather than
spelled out"*). Green under **both** compilers, so the fix was committed first (`b7abd2a`) and every
commit in this plan is green under the compiler in effect at that commit.

The control row matters: the readonly-detection half of the guard is unaffected, and the mutation
proof above confirms it still fires with the corrected assertion.

- **Files modified:** `packages/concierge/test-d/transport.test-d.ts` (outside this plan's
  `files_modified`; `src/types.ts` — the file Phase 2 is fenced away from — was **not** changed)
- **Commit:** `b7abd2a`

### 2. [Rule 3 — Blocking] pnpm 11 rejects the lockfile pnpm 10 had just written

**Found during:** Task 2, on the first `pnpm install` after the `packageManager` bump.

```
✗ Lockfile failed supply-chain policy check (313 entries in 1.6s)
[ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION] 29 lockfile entries failed verification:
  @napi-rs/wasm-runtime@1.2.0 was published at 2026-07-28T09:41:14.000Z, within the
  minimumReleaseAge cutoff (2026-07-27T23:11:56.930Z)
  … and 28 more
```

**pnpm 11 enforces a 24-hour `minimumReleaseAge` supply-chain policy by default.** It is set nowhere
in this repo — no `.npmrc` exists, and neither `pnpm-workspace.yaml` nor `package.json` mentions it.
`02-RESEARCH.md` does not mention this policy at all; it is a genuinely new pnpm 11 behaviour that
the research session could not have seen, because pnpm 11 was never installed there (Open Question 1
says so explicitly).

All 29 rejected entries were transitive native bindings published hours earlier — pulled in because
`pnpm add` ran under pnpm **10**, which has no such policy.

**Resolution: re-resolve, do not relax.** Disabling a supply-chain guard in a project whose stated
core value is structural security, and which runs a Package Legitimacy Audit protocol, is not a
change to make silently. Instead the lockfile was rebuilt so every entry predates the cutoff:

| Package | Was | Now | Published |
|---|---|---|---|
| `@yuku-codegen/binding-*` (12) | `0.8.1` | **`0.8.0`** | 2026-07-23 (was 2026-07-28) |
| `@yuku-parser/binding-*` (12) | `0.8.1` | **`0.8.0`** | 2026-07-23 (was 2026-07-28) |
| `@napi-rs/wasm-runtime` | `1.2.0` | **`1.1.6`** | — |

All seven direct devDependency pins are unchanged after the re-resolution — only transitive
selections moved, and they moved onto **older, longer-exposed** versions. `pnpm install
--frozen-lockfile` now prints `✓ Lockfile passes supply-chain policies`. Net supply-chain posture is
better than before the bump, not worse.

**Two mechanical notes for later plans and CI:**

1. `pnpm install` under pnpm 11 aborts with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` when it
   needs to purge a `node_modules` built by pnpm 10. `CI=true` is the documented path and is what CI
   will hit anyway; no repo config was changed to work around it.
2. Plan 02-10's CI workflows should expect the supply-chain check to run on every
   `pnpm install --frozen-lockfile`, and should **not** add a flag to skip it.

- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Commit:** `eb9dbfc`

### 3. [Rule 1 — Bug] Task 3's own verify block has two clauses that cannot pass

**Found during:** Task 3.

**(a) The row-count proxy tops out at 22 of 31.** The verify asserts
`test "$(grep -c '^| 02-0' …)" -ge 31`. That pattern matches plans `02-01`…`02-09` only — which hold
**22** of the 31 tasks. Rows for `02-10`, `02-11` and `02-12` begin `| 02-1`. The pattern that
matches all 31 is `^| 02-`.

The stated rationale — *"because the phase-gate plan (02-12) counts rows by matching `^| 02-0`"* — is
also **not what 02-12 does**. Its sign-off verify greps `nyquist_compliant`, `status: complete`,
`⬜ pending` and `Approval:** pending`; it never counts rows.

**(b) Two rows are self-referential.** "Copy the command verbatim" and "grep this file for a literal"
cannot both hold once the command *contains* that literal:

| Row | Literal its own command greps for | Consequence |
|---|---|---|
| `02-01-T3` | `*pending*` | Its own clause `test -z "$(grep -F '*pending*' …)"` can never pass |
| `02-12-T3` | `⬜ pending`, `Approval:** pending` | 02-12's sign-off cannot go quiet by flipping statuses alone |

**Resolution:** the rows use correct task IDs and verbatim commands, and both defects are recorded in
`02-VALIDATION.md` § Per-Task Verification Map rather than worked around. The *intent* of each check
is met and was verified by column-anchored greps:

- rows matching `^| 02-` → **31**
- placeholder rows matching `^\| \*pending\* \|` → **0**
- every task from `grep -n '^  <name>Task' 02-*-PLAN.md` appears in **exactly one** row (0 off-by)
- every command cell is byte-identical to its task's `<verify><automated>` text, `|` → `\|`
  (0 drift, machine-compared against the plan sources)

**Plan 02-12 must adjust its sign-off greps** to match the Status *column*
(`grep -F '| ⬜ pending |'`) rather than the bare string, or it will never pass.

- **Files modified:** `.planning/phases/02-packaging-build-and-release/02-VALIDATION.md`
- **Commit:** `f2bf334`

### 4. [Process] Task 1 split into two commits

The plan says "four changes, one commit." The four toolchain changes are in one commit (`3f34431`);
the deviation-1 guard fix is isolated in `b7abd2a` **before** it, so that no commit in this plan is
red under the compiler in effect at that commit. Committing the TS 7 pin first would have produced a
knowingly-red commit.

## Threat Model Outcomes

| Threat | Disposition | Evidence |
|---|---|---|
| T-02-01 tampering via six new devDependency edges | mitigated | All seven root devDependencies are exact pins with no range — verified programmatically. All six are `Approved` in the Package Legitimacy Audit; no legitimacy checkpoint was opened, per the plan. `pnpm install --frozen-lockfile` green. |
| T-02-02 dependency install scripts | mitigated | `pnpm add` reported **no** ignored build/postinstall scripts. `node_modules/.modules.yaml` shows `pendingBuilds: []`; its `skipped` list holds only platform-specific optional binaries (other-OS `@rolldown/binding-*`), which are irrelevant-platform skips, not suppressed build scripts. No `onlyBuiltDependencies` allowlist was added. |
| T-02-03 LICENSE listed in `files` but absent | **closed, measured both ways** | Before: `npm pack --dry-run` 2 entries (no LICENSE), `pnpm pack` 3. After: **both report 3 entries including LICENSE**. `attw`/`publint` now inspect the same artifact `changeset publish` ships. |
| T-02-04 lockfile diff mixed with functional change | mitigated | `git show --stat eb9dbfc` lists exactly `package.json` + `pnpm-lock.yaml`. |
| T-02-05 stray `*.tgz` defeating a clean-tree assertion | **closed, proven** | A bare `pnpm pack` wrote a real 1598-byte tarball into `packages/concierge/`; `git status --porcelain` did not list it. Tarball then removed. |
| T-02-SC supply-chain | mitigated, **and strengthened** | No package outside the audit table was installed. pnpm 11's `minimumReleaseAge` policy was left enabled and satisfied by re-resolution (deviation 2), not bypassed. |

## Open Question 1 — answered by observation

`02-RESEARCH.md:1152` flagged **LOW confidence** on pnpm 11's lockfile format. Measured:

- **`pnpm-lock.yaml` line 1 after the bump: `lockfileVersion: '9.0'`** — unchanged from pnpm 10.33.0.
  No format migration.
- **`git diff --stat pnpm-lock.yaml` for the bump commit: 257 lines changed** (128 insertions,
  129 deletions).

The churn is **not** a format bump. It is entirely the supply-chain re-resolution described in
deviation 2 — which is precisely why isolating this commit was worth doing: had it been mixed with
Task 1, a 2800-line lockfile diff would have hidden a 257-line security-relevant change.

## For the Next Plans

1. **Use `CI=true` for `pnpm install`** in any script or workflow that may face a stale
   `node_modules`, or pnpm 11 aborts on the TTY confirmation prompt.
2. **02-10 (CI):** the supply-chain policy runs on every `pnpm install --frozen-lockfile`. Do not add
   a skip flag. Freshly-published transitive deps will fail CI for their first 24 hours — that is the
   feature working.
3. **02-12 (phase gate):** its sign-off greps must be column-anchored (`| ⬜ pending |`) or they can
   never pass — see deviation 3(b).
4. **The eleven-mutant battery is unaffected** by the guard correction: P8/P9 target
   `MESSAGE_MAX_CHARS` and `snapshotEquality`, neither of which this plan touched.
5. `packages/concierge/package.json` is **unchanged** — `git diff --exit-code` on it exits 0. The
   `build` and `test` scripts remain 02-03's and 02-07's work.

## Known Stubs

None. This plan added no code paths — it is toolchain, one license file, one gitignore line, one
type-guard correction, and a planning document.

## Threat Flags

None. No network endpoint, auth path, file-access pattern, or schema at a trust boundary was
introduced. The one security-relevant surface change is a **tightening**: pnpm 11's supply-chain
policy is now enforced on every install.

## Self-Check: PASSED

Files claimed created/modified, verified present on disk:

- `packages/concierge/LICENSE` — FOUND (21 lines, byte-identical to root `LICENSE`)
- `package.json` — FOUND (`"typescript": "7.0.2"`, `"packageManager": "pnpm@11.17.0"`)
- `.gitignore` — FOUND (exact line `*.tgz`)
- `pnpm-lock.yaml` — FOUND (`lockfileVersion: '9.0'`)
- `.planning/phases/02-packaging-build-and-release/02-VALIDATION.md` — FOUND (31 rows,
  `wave_0_complete: true`)
- `packages/concierge/test-d/transport.test-d.ts` — FOUND

Commits claimed, verified in `git log`:

- `b7abd2a` — FOUND
- `3f34431` — FOUND
- `eb9dbfc` — FOUND
- `f2bf334` — FOUND

`README.md` and `packages/concierge/README.md` untouched (`git diff --exit-code` clean).
`.planning/STATE.md` and `.planning/ROADMAP.md` untouched — the orchestrator owns those writes.
