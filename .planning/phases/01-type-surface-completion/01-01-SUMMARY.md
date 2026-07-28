---
phase: 01-type-surface-completion
plan: 01
subsystem: testing
tags: [typescript, tsc, type-testing, tsconfig, isolatedDeclarations, exactOptionalPropertyTypes]

# Dependency graph
requires: []
provides:
  - "packages/concierge/tsconfig.test-d.json — typecheck-only program covering src + test-d under the exact production flags"
  - "packages/concierge/test-d/_assert.ts — Expect / Equals / Assignable / Not predicate aliases, zero dependencies"
  - "packages/concierge/package.json scripts.typecheck repointed to `tsc -p tsconfig.test-d.json`"
  - "Empirical proof the harness goes red: TS6059 on a missing rootDir, TS2344 on a false predicate"
  - "01-VALIDATION.md per-task verification map — 19 rows, one per task across the nine plans"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, phase-02-build-config]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two tsconfigs, one program each — sibling test-d config instead of an exclude clause in the build config"
    - "Predicate assertions (Expect/Equals/Assignable/Not) rather than @ts-expect-error"
    - "Assertion aliases named after the invariant they guard, because the alias name is the only carrier of meaning in a TS2344"

key-files:
  created:
    - packages/concierge/tsconfig.test-d.json
    - packages/concierge/test-d/_assert.ts
  modified:
    - packages/concierge/package.json
    - .planning/phases/01-type-surface-completion/01-VALIDATION.md
    - .planning/phases/01-type-surface-completion/01-RESEARCH.md

key-decisions:
  - "Sibling tsconfig.test-d.json rather than editing the build tsconfig — keeps Phase 1 disjoint from Phase 2 (T-01-02)"
  - "rootDir: '.' is mandatory in the test-d config; it is inherited as ./src and is not relaxed by noEmit"
  - "Kept export {} in _assert.ts for unconditional module status, with NO claim that it prevents TS9010"
  - "No TS9010 breakage attempted against _assert.ts — it cannot fire on a file of pure type aliases"
  - "Corrected the shipped Equals rationale: the naive bidirectional form fails on union/any distribution, NOT on the optional-vs-undefined pair as previously stated"
  - "The 01-01-T3 row does not inline its own verify command, because that command greps for a literal that must be absent from the file it greps"

patterns-established:
  - "Every test-d/*.test-d.ts exports nothing; their imports already make them modules"
  - "Task IDs in 01-VALIDATION.md use the literal form 01-{plan}-T{n} so the phase gate can count rows via ^| 01-0"
  - "Pipes inside table-cell shell commands are escaped as \\| so cells do not terminate early"

requirements-completed: [SC-7]

# Metrics
duration: 12min
completed: 2026-07-28
---

# Phase 01 Plan 01: Type-Test Harness Summary

**`tsc --noEmit` is now the phase's test runner: one command typechecks `src` and `test-d` together, and it has been observed to go red on both a config regression and a false assertion.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-28T06:25:00Z
- **Completed:** 2026-07-28T06:37:00Z
- **Tasks:** 3/3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- **The compiler is now the test runner.** `pnpm --filter @fullselfbrowsing/concierge typecheck` runs `tsc -p tsconfig.test-d.json` over a single program containing `src/types.ts`, `src/index.ts`, and `test-d/_assert.ts` — verified by `--listFiles`, so the config demonstrably includes `test-d/` rather than silently matching nothing.
- **The harness was proven falsifiable, not merely green.** Three deliberate breakages each produced the predicted diagnostic and a non-zero exit; all were restored, and no intermediate broken state was committed.
- **The validation strategy now maps to real work.** `01-VALIDATION.md` carries 19 per-task rows (one per task across the nine plans) instead of 17 requirement-level rows, so a task that ships without an automated check shows up as a missing row.

## Task Commits

1. **Task 1: Create the test-d program and wire it to the typecheck script** — `4200007` (feat)
2. **Task 2: Prove the harness fails when it should** — `0c75822` (fix) — the breakages themselves are restore-to-green by design and produce no diff; this commit carries the Rule 1 correction they surfaced
3. **Task 3: Expand the validation map and close Wave 0 bookkeeping** — `c4e1a19` (docs)

## Files Created/Modified

- `packages/concierge/tsconfig.test-d.json` (created) — extends `./tsconfig.json`, `noEmit: true`, `rootDir: "."`, `include: ["src/**/*.ts", "test-d/**/*.ts"]`
- `packages/concierge/test-d/_assert.ts` (created) — the four predicate aliases plus `export {}` and the rationale header
- `packages/concierge/package.json` (modified) — one line: `scripts.typecheck` → `tsc -p tsconfig.test-d.json`
- `.planning/phases/01-type-surface-completion/01-VALIDATION.md` (modified) — per-task map, `wave_0_complete: true`
- `.planning/phases/01-type-surface-completion/01-RESEARCH.md` (modified) — `## Open Questions (RESOLVED)` + resolution note

## Harness Breakage Results — recorded verbatim as Task 2 requires

### Breakage A — `rootDir` override removed from `tsconfig.test-d.json`

**Exit code: 2 (non-zero, as required).**

```
error TS6059: File '.../packages/concierge/test-d/_assert.ts' is not under 'rootDir' '.../packages/concierge/src'. 'rootDir' is expected to contain all source files.
  The file is in the program because:
    Matched by include pattern 'test-d/**/*.ts' in 'tsconfig.test-d.json'
```

Restored; typecheck returned to exit 0.

### Breakage B — false predicate `type _harnessSelfCheck = Expect<Equals<1, 2>>;`

**Exit code: 2 (non-zero, as required).**

Default (non-TTY / piped) output:

```
test-d/_assert.ts(30,33): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```

With `--pretty`, the echoed source line carries the alias name:

```
test-d/_assert.ts:30:33 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

30 type _harnessSelfCheck = Expect<Equals<1, 2>>;
                                   ~~~~~~~~~~~~
```

Alias removed; typecheck returned to exit 0.

> **Caveat worth carrying into every later plan.** The alias name is only visible when `tsc` runs in
> pretty mode — a terminal, or an explicit `--pretty`. Piped into a file or a CI log, the non-pretty
> output is `file(line,col): error TS2344: ...` with **no source-line echo**, so the invariant name is
> not in the captured text. The phase's premise that "the alias name sits on the echoed source line"
> holds interactively but not in a piped log. `scripts.typecheck` was deliberately left as exactly
> `tsc -p tsconfig.test-d.json` because Task 1's acceptance criteria pin that string; if the phase
> wants named invariants in CI logs, adding `--pretty` is a one-word change for a later plan to own.

### Breakage C — `Expect<Not<Equals<{ a?: string }, { a: string | undefined }>>>`

**Exit code: 0 (compiles clean, as required).** `Equals` distinguishes the two types. Alias removed.

### Additional control not required by the plan, but necessary for adequacy

Breakages B and C are both satisfied by a **degenerate always-`false` `Equals`**, so neither proves
the alias works. Positive controls were run against the shipped aliases and all passed (exit 0):

```
Expect<Equals<string, string>>
Expect<Equals<string | number, number | string>>
Expect<Not<Assignable<string, number>>>
Expect<Assignable<"a", string>>
```

`Equals` therefore returns `true` for genuinely equal types and is not degenerate.

### No TS9010 breakage was attempted against `_assert.ts`

Per the plan's ⚠️ callout and `01-VALIDATION.md`'s corrected trap table, the deleted fourth breakage
was **not** reinstated. `export {}` was kept, and no comment in `_assert.ts` claims it prevents
TS9010. The file contains zero occurrences of the string `TS9010`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` absent — the verification command could not run at all**

- **Found during:** Task 1 (pre-flight baseline)
- **Issue:** Neither the worktree nor the main checkout had `node_modules`. `pnpm --filter @fullselfbrowsing/concierge typecheck` failed with `sh: tsc: command not found`. `01-VALIDATION.md` records TypeScript 5.9.3 as "installed", which was true of the research sandbox but not of this checkout.
- **Fix:** `pnpm install --frozen-lockfile`. This is dependency *restoration*, not a package install — `--frozen-lockfile` refuses to resolve anything not already pinned, so no new package name could enter. It added exactly the two locked packages (`typescript@5.9.3`, `@standard-schema/spec@1.1.0`). The Package Legitimacy Gate was therefore not triggered.
- **Verification:** `git diff --exit-code pnpm-lock.yaml` exits 0 — the lockfile is byte-identical, satisfying the T-01-SC acceptance criterion. `tsc --version` → 5.9.3, matching the strategy.
- **Files modified:** none tracked (`node_modules/` is gitignored)
- **Commit:** n/a (no tracked change)

**2. [Rule 1 - Bug] The `Equals` rationale comment stated something my own probe falsified**

- **Found during:** Task 2, Breakage C
- **Issue:** Task 1's action text instructs the comment to say the naive bidirectional-extends form "silently passes on the `{a?: x}` vs `{a: x | undefined}` cases". I wrote that into `_assert.ts`. A differential probe of both forms under this repo's flags shows it is **false** — the naive form returns `false` for that pair too, because `exactOptionalPropertyTypes` already blocks the assignability. Measured:

  | comparison | conditional-identity | naive bidirectional |
  |---|---|---|
  | `Equals<string \| number, number \| string>` | `true` | `boolean` ← wrong |
  | `Equals<any, string>` | `false` | `boolean` ← wrong |
  | `Equals<{a?: string}, {a: string \| undefined}>` | `false` | `false` ← same |

- **Why this mattered enough to fix:** `_assert.ts` is the phase's only assertion mechanism. A maintainer who tested the stated claim would find it false and could reasonably conclude the conditional-identity form is unnecessary ceremony — then break every union-order and `any` comparison in the suite. The comment argued *for* the right code with a reason that disproves itself.
- **Fix:** replaced the rationale with the measured table above and an explicit "do NOT simplify this" note. The `Equals` implementation itself is unchanged.
- **Files modified:** `packages/concierge/test-d/_assert.ts`
- **Commit:** `0c75822`

**3. [Rule 1 - Bug] Quoting Task 3's verify command verbatim made the gate fail against itself**

- **Found during:** Task 3
- **Issue:** The plan says each row's Automated Command is the task's own `<verify><automated>` block "copied verbatim". Task 01-01-T3's command ends with `test -z "$(grep -F '13 codes' 01-VALIDATION.md)"`. Copying it verbatim *into* `01-VALIDATION.md` inserts the literal `13 codes` into the very file the clause asserts must not contain it. The row I first wrote broke both the task's own verify command and its acceptance criterion.
- **Fix:** the 01-01-T3 row now describes its four checks and points at `01-01-PLAN.md` § Task 3 `<verify>` for the executable form, with an inline note explaining why it is not quoted. Every other row is verbatim.
- **Files modified:** `.planning/phases/01-type-surface-completion/01-VALIDATION.md`
- **Commit:** `c4e1a19`

### Planned Work That Was Already Done

**Task 3 item 2 (the `13 codes` → `12 codes` fix) required no change.** The plan states the SC-2 row
"still reads '13 codes exhaustively switchable'". It does not — commit `81c1f66`
("docs(01): fix two residual miscounts the word-only grep missed") had already corrected it to
`**12** codes`. `grep -F "13 codes"` returned nothing before my edits and returns nothing now. The
work done here was to *avoid re-introducing* the literal (see deviation 3), not to remove it.

## Findings for the Phase Owner

These are outside this plan's write scope — the plan explicitly forbids touching `01-CONTEXT.md`,
`ROADMAP.md`, and the other plans — so they are reported rather than fixed.

1. **The reason-code miscount still survives in `01-CONTEXT.md` § D-12 item 4**, which reads
   "**Ship the thirteen**". The plan asserted `01-VALIDATION.md` was "the only place the miscount
   survives"; in fact it was already fixed there and is still wrong in CONTEXT. `01-RESEARCH.md`'s
   Open Question 4 correctly says "ship the twelve". D-12 is the document Plan **01-02** — the very
   next wave — is told to treat as settled law for the reason union. Recommend correcting D-12 item 4
   to twelve before 01-02 executes. My RESEARCH resolution note deliberately states item 4 without a
   number so as not to propagate either count.

2. **`01-VALIDATION.md` § "Wave 0 Requirements" checkboxes are all still unchecked**, including the
   three this plan completed (`tsconfig.test-d.json`, `_assert.ts`, the `package.json` repoint),
   because Task 3 enumerates exactly three bookkeeping edits and then says "Change nothing else in
   either file." A reader should not take `wave_0_complete: true` to mean all seven boxes are done —
   the four `test-d/*.test-d.ts` suite files are genuinely still absent and are owned by plans 02–07.

3. **`01-VALIDATION.md` § "Manual-Only Verifications" is now stale.** It lists the `README.md:72`
   `ActionResult` check as manual because "the compiler cannot see it" — but Plan 01-08 Task 2 has an
   `<automated>` grep for exactly that, which I recorded in the 01-08-T2 row. The phase arguably has
   zero manual-only verifications now. Left unedited per the same "change nothing else" constraint.

## Verification Results

| Check | Result |
|---|---|
| `pnpm --filter @fullselfbrowsing/concierge typecheck` | exit **0** |
| `pnpm typecheck` (repo root) | exit **0** |
| `git diff --exit-code packages/concierge/tsconfig.json` | exit **0** — build config untouched (T-01-02) |
| `git diff --exit-code pnpm-lock.yaml` | exit **0** — no dependency edge added (T-01-SC) |
| Task 3 `VALIDATION_MAP_OK` gate | **VALIDATION_MAP_OK**, exit 0 |
| `grep -c '^\| 01-0' 01-VALIDATION.md` | **19** |
| Unique task IDs in the map | **19** — `01-01-T1` … `01-09-T2`, each exactly once |
| `grep -F "13 codes" 01-VALIDATION.md` | no output |
| `01-VALIDATION.md` frontmatter | `wave_0_complete: true`, `status: draft`, `nyquist_compliant: false` |
| `01-RESEARCH.md` heading | `## Open Questions (RESOLVED)` with resolution note |
| Program membership (`tsc --listFiles`) | `src/types.ts`, `src/index.ts`, `test-d/_assert.ts` |
| Markdown table integrity | all 19 rows have exactly 8 unescaped pipes (7 columns) |
| `git diff --stat` for Task 3 | confined to `01-VALIDATION.md` and `01-RESEARCH.md` |
| File deletions across all commits | **none** |
| `.planning/STATE.md`, `.planning/ROADMAP.md` | untouched (orchestrator owns these) |

## Threat Model Compliance

| Threat ID | Disposition | Status |
|---|---|---|
| T-01-01 | mitigate | `test-d/` sits outside `src/`; the build config's `include: ["src/**/*.ts"]` cannot reach it, and no `exclude` clause was needed. Absence from `dist/` is asserted in Plan 01-09. |
| T-01-02 | mitigate | `packages/concierge/tsconfig.json` is byte-identical — `git diff --exit-code` exits 0. A sibling config was added instead. |
| T-01-33 | mitigate | The map is now per-task; a task shipping without an automated check is a missing row. |
| T-01-SC | accept | Zero packages installed. `pnpm install --frozen-lockfile` restored the two already-locked packages and left `pnpm-lock.yaml` byte-identical. |

No new threat surface. This plan adds no runtime code — `_assert.ts` is type aliases only and is
outside the emit program.

## Known Stubs

None. `test-d/_assert.ts` is complete as specified; the four `*.test-d.ts` suite files it exists to
serve are the deliverables of plans 01-02 through 01-07, not stubs of this one.

## Next Steps

Plan **01-02** (Close the reason union and declare the message policy). Phase 1 is a **single serial
sequence** — plans 01 through 09 all edit `packages/concierge/src/types.ts` and must not be
parallelized despite `parallelization: true` in `.planning/config.json`.

Before 01-02 starts, resolve Finding 1 above: `01-CONTEXT.md` § D-12 item 4 says "thirteen" and
01-02 is the plan that implements that union.
