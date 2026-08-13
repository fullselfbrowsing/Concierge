---
phase: 01-type-surface-completion
plan: 02
subsystem: types
tags: [typescript, closed-union, exhaustiveness, exactOptionalPropertyTypes, isolatedDeclarations, type-testing]

# Dependency graph
requires:
  - phase: 01-01
    provides: "tsconfig.test-d.json (the src + test-d program) and test-d/_assert.ts (Expect / Equals / Assignable / Not)"
provides:
  - "FailureReason — nine machine-caused codes, incl. invalid_result"
  - "ReasonCode = AbandonReason | FailureReason — the twelve-code closed union"
  - "ActionResult.reason retyped to `ReasonCode | undefined`, closing the open-string hole and the AbandonReason orphan in one edit"
  - "MESSAGE_MAX_CHARS = 180, unannotated so the literal type survives isolatedDeclarations"
  - "ActionResult.message doc policy: best-effort human-facing sentence, never a consent artifact"
  - "test-d/results.test-d.ts — five named predicates, a twelve-arm exhaustive switch, one freshness directive"
  - "Six-mutant defect-first proof that the suite goes red, with observed diagnostics"
affects: [01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, phase-06-dispatcher, phase-08-consent-kernel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closed reason union with a `const _never: never` default arm — additions break every mapper by design"
    - "Explicit `| undefined` on optional fields whose value is computed, mandatory under exactOptionalPropertyTypes"
    - "Unannotated `const` for numeric bounds so the literal type reaches the .d.ts and can be guarded"
    - "Type-test predicates written on ONE line so tsc echoes the alias name rather than the predicate body"

key-files:
  created:
    - packages/concierge/test-d/results.test-d.ts
  modified:
    - packages/concierge/src/types.ts

key-decisions:
  - "The union is TWELVE codes (3 AbandonReason + 9 FailureReason). No thirteenth code was invented to satisfy any stale count."
  - "AbandonReason reused as a named subset rather than deleted — this is what closes the orphan defect"
  - "reason?: ReasonCode | undefined, not reason?: ReasonCode — proven load-bearing by mutant M2"
  - "MESSAGE_MAX_CHARS left unannotated; annotating it `: number` is a real regression, proven by mutant M5"
  - "Assertion predicates are single-line — multi-line wrapping silently strips the alias name out of the diagnostic (Rule 1 fix, measured)"
  - "index.ts left untouched; the export surface is plan 01-08's deliverable"

patterns-established:
  - "Defect-first authoring by mutation: every assertion is proven to go red by breaking the type it guards, then restoring"
  - "Restore-and-verify discipline: each mutant is reverted from a /tmp pristine copy and `git diff --exit-code` confirms byte-identity before the next mutant"
  - "One `case \"…\":` per line in exhaustive switches, so an arm count is greppable"

requirements-completed: [SC-2, SC-7d]

# Metrics
duration: 34min
completed: 2026-07-28
---

# Phase 01 Plan 02: Closed Reason Union and Message Policy Summary

**`ActionResult.reason` is now a twelve-code closed union that an arbitrary handler string cannot satisfy, and the assertion suite guarding it has been watched to fail against six separate mutations rather than merely observed to pass.**

## Performance

- **Duration:** ~34 min
- **Started:** 2026-07-28T07:05:00Z
- **Completed:** 2026-07-28T07:39:00Z
- **Tasks:** 2/2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- **The open-`string` hole and the `AbandonReason` orphan closed in a single edit.** `AbandonReason` was reused as a named subset of `ReasonCode` rather than deleted, so the symbol that nothing consumed is now the human-caused half of the field. Mutant M4 confirms the coupling is real: dropping `AbandonReason` from `ReasonCode` breaks `USER_CANCELLED` and `USER_DECLINED` in `src/` as well as three switch arms in the suite.
- **Exhaustiveness is enforced, and the enforcement was demonstrated, not asserted.** Mutant M6 added a hypothetical thirteenth code and produced `Type '"phase6_new_code"' is not assignable to type 'never'` — the exact breakage Phase 6 is meant to hit when it adds a code.
- **A defect in the phase's own diagnostic contract was found and fixed.** The predicates as first written (following the RESEARCH example's wrapping) did **not** put the alias name in the diagnostic. See Deviation 1 — this is the single most transferable finding for plans 01-03 through 01-07.

## Task Commits

1. **Task 1: Close the reason union and declare the message policy (D-01, D-02)** — `19be2a9` (feat)
2. **Task 2: Author results.test-d.ts defect-first (SC-2, SC-7d)** — `8a42c58` (test)

## Files Created/Modified

- `packages/concierge/src/types.ts` (modified) — `+111 / -3`. The three removed lines are exactly the old `reason?: string` field and its two one-line doc comments; `AbandonReason`, `USER_CANCELLED`, `USER_DECLINED`, and `ConsentPolicy.onMissing` are byte-identical.
- `packages/concierge/test-d/results.test-d.ts` (created) — 108 lines, exports nothing.

## The count is twelve

Recorded explicitly because the plan flags it as a live hazard. `AbandonReason` contributes `declined`, `cancelled`, `superseded`; `FailureReason` contributes `invalid_args`, `invalid_result`, `unknown_action`, `no_bridge`, `handler_error`, `aborted`, `consent_required`, `consent_stale`, `grade_unavailable`. **3 + 9 = 12.** No thirteenth code was invented. `grep -ci thirteen packages/concierge/src/types.ts` returns 0; the only occurrence of the word "thirteen" in either shipped file is in a `results.test-d.ts` section header stating that a thirteenth code *must break* the mapper.

## Defect-First Proof — six mutants, all observed

Each mutation was applied to `packages/concierge/src/types.ts`, typechecked, then restored from a pristine `/tmp` copy with `git diff --exit-code` confirming byte-identity before the next mutant. `packages/concierge/test-d/results.test-d.ts` was never mutated. No broken state was committed. Diagnostics below are `--pretty` output against the final committed file.

### M1 — `reason` reverted to open `string` (the plan's mandatory mutant)

**`pnpm --filter @fullselfbrowsing/concierge typecheck` exit code: 2.** All three required diagnostics present (TS2578, TS2322, TS2375), plus two named predicate failures.

```
test-d/results.test-d.ts:35:29 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
35 type _reasonClosed = Expect<Not<Assignable<{ ok: false; reason: "whoops"; message: "x" }, ActionResult>>>;

test-d/results.test-d.ts:48:38 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
48 type _reasonAdmitsUndefined = Expect<Assignable<{ ok: true; reason: undefined; message: "x" }, ActionResult>>;

test-d/results.test-d.ts:55:1 - error TS2578: Unused '@ts-expect-error' directive.
55 // @ts-expect-error - an arbitrary reason string must not typecheck

test-d/results.test-d.ts:87:13 - error TS2322: Type 'string' is not assignable to type 'never'.
87       const _never: never = r.reason;

test-d/results.test-d.ts:97:7 - error TS2375: Type '{ ok: false; reason: string | undefined; message: string; }' is not
  assignable to type 'ActionResult' with 'exactOptionalPropertyTypes: true'.
97 const _computedReasonAssigns: ActionResult = {
```

### M2 — the explicit `| undefined` dropped from the field

**Exit code: 2.** This is the mutant that proves D-01's `| undefined` is load-bearing rather than cosmetic.

```
test-d/results.test-d.ts:48:38 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
48 type _reasonAdmitsUndefined = Expect<Assignable<{ ok: true; reason: undefined; message: "x" }, ActionResult>>;

test-d/results.test-d.ts:97:7 - error TS2375: Type '{ ok: false; reason: ReasonCode | undefined; message: string; }' is not
  assignable to type 'ActionResult' with 'exactOptionalPropertyTypes: true'.
97 const _computedReasonAssigns: ActionResult = {
```

### M3 — `invalid_result` removed from `FailureReason`

**Exit code: 2.** Note the second diagnostic: removal is caught from the *other* side by TS2678, so the switch is a total-membership guard, not merely an addition guard.

```
test-d/results.test-d.ts:41:42 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
41 type _reasonAdmitsInvalidResult = Expect<Assignable<{ ok: false; reason: "invalid_result"; message: "x" }, ActionResult>>;

test-d/results.test-d.ts:75:10 - error TS2678: Type '"invalid_result"' is not comparable to type 'ReasonCode | undefined'.
75     case "invalid_result":
```

### M4 — `AbandonReason` dropped from `ReasonCode` (the orphan defect reintroduced)

**Exit code: 2.** Six errors, two of them in `src/` — the frozen constants stop compiling, which is independent evidence that `AbandonReason` is now genuinely consumed.

```
src/types.ts:182:14 - error TS2322: Type 'Readonly<{ ok: false; reason: "cancelled"; message: "Cancelled."; }>' is not
  assignable to type 'Readonly<ActionResult>'.
182 export const USER_CANCELLED: Readonly<ActionResult> = Object.freeze({

src/types.ts:188:14 - error TS2322: Type 'Readonly<{ ok: false; reason: "declined"; message: "Okay, I won't do that."; }>'
  is not assignable to type 'Readonly<ActionResult>'.
188 export const USER_DECLINED: Readonly<ActionResult> = Object.freeze({

test-d/results.test-d.ts:38:36 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
38 type _reasonAdmitsAbandon = Expect<Assignable<{ ok: false; reason: "declined"; message: "x" }, ActionResult>>;

test-d/results.test-d.ts:71:10 - error TS2678: Type '"declined"' is not comparable to type 'FailureReason | undefined'.
test-d/results.test-d.ts:72:10 - error TS2678: Type '"cancelled"' is not comparable to type 'FailureReason | undefined'.
test-d/results.test-d.ts:73:10 - error TS2678: Type '"superseded"' is not comparable to type 'FailureReason | undefined'.
```

### M5 — `MESSAGE_MAX_CHARS` widened to `number`

**Exit code: 2.** Confirms SC-7d and confirms the "do not annotate" instruction is a real constraint.

```
test-d/results.test-d.ts:108:29 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
108 type _messageBound = Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>;
```

### M6 — a thirteenth code added, simulating Phase 6

**Exit code: 2.** The whole design property of the union, demonstrated:

```
test-d/results.test-d.ts:87:13 - error TS2322: Type '"phase6_new_code"' is not assignable to type 'never'.
87       const _never: never = r.reason;
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The predicates as specified did not put the alias name in the diagnostic — the phase's stated signal mechanism was silently broken**

- **Found during:** Task 2, while capturing `--pretty` output for the M1 proof.
- **Issue:** `01-RESEARCH.md` (line 1027) and `test-d/_assert.ts`'s own header both rest on the claim that *"the alias name is the only carrier of meaning in a TS2344"* — `tsc` prints only `Type 'false' does not satisfy the constraint 'true'`, so the echoed source line is the entire signal. But `tsc` echoes **only the line the failing type argument sits on**, not the whole declaration. The RESEARCH SC-2 example writes `_reasonClosed` wrapped across three lines, and I followed it. The result:

  ```
  test-d/results.test-d.ts:29:3 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
  29   Not<Assignable<{ ok: false; reason: "whoops"; message: "x" }, ActionResult>>
  ```

  The alias name `_reasonClosed` is on line 28 and is **never printed**. The diagnostic is anonymous — exactly the "suite of `type _1`, `type _2`" failure mode the convention exists to prevent. Four of the five predicates were affected; only `_messageBound`, which happened to fit on one line, worked as intended.
- **Fix:** every `Expect<…>` predicate is now written on a single line regardless of length, with a comment block above them stating why and warning a formatter off. Re-running M1 confirms the fix:

  ```
  35 type _reasonClosed = Expect<Not<Assignable<{ ok: false; reason: "whoops"; message: "x" }, ActionResult>>>;
  48 type _reasonAdmitsUndefined = Expect<Assignable<{ ok: true; reason: undefined; message: "x" }, ActionResult>>;
  ```
- **Why this was in scope:** it is a defect in the artifact this task ships, found by the defect-first procedure this task mandates. Had the suite only ever been run green, it would have shipped.
- **Files modified:** `packages/concierge/test-d/results.test-d.ts`
- **Commit:** `8a42c58` (folded into the task commit — the broken form was never committed)

**2. [Rule 1 - Bug] A prose mention of the directive token broke the task's own acceptance grep**

- **Found during:** Task 2, mechanical criteria check.
- **Issue:** the acceptance criterion is *"exactly one `@ts-expect-error` directive appears in the file"*. My header comment explained the predicates-over-directives rationale and used the literal token in prose, so `grep -c '@ts-expect-error'` returned **2**. The prose occurrence is not a directive — TypeScript only treats a comment as one when its content *begins* with the token — but the criterion is checked mechanically, and a gate that cannot distinguish the two is a gate that fails on a correct file.
- **Fix:** the header was reworded to describe the mechanism without using the literal token, and now states that the single occurrence below is the only one in the file. Count is 1.
- **Files modified:** `packages/concierge/test-d/results.test-d.ts`
- **Commit:** `8a42c58`

### Environment

`node_modules` was absent from this worktree (worktrees do not share it with the main checkout). `pnpm install --frozen-lockfile` restored the two already-pinned packages; `git diff --exit-code pnpm-lock.yaml` exits 0. No package was installed, so the Package Legitimacy Gate did not trigger. This matches Plan 01-01's deviation 1 and should be expected in every Phase 1 worktree.

### Not Done, Deliberately

`packages/concierge/src/index.ts` was **not** edited. `FailureReason`, `ReasonCode`, and `MESSAGE_MAX_CHARS` are therefore not yet importable from the package entry point. This is correct: `01-08-PLAN.md` declares `index.ts` in its `files_modified` and its Task 1 acceptance criteria enumerate all ten new type exports plus `MESSAGE_MAX_CHARS`. Editing it here would have collided. `results.test-d.ts` imports from `"../src/types.js"` directly, so nothing in this plan depends on the entry point.

## Verification Results

| Check | Result |
|---|---|
| `pnpm --filter @fullselfbrowsing/concierge typecheck` | exit **0** |
| `pnpm typecheck` (repo root) | exit **0** |
| `results.test-d.ts` present in the program (`tsc --listFiles`) | **yes** |
| M1 mutant observed non-zero with TS2578 + TS2322 + TS2375 | **yes** — see above |
| M2–M6 mutants observed non-zero | **yes** — all five |
| `types.ts` restored byte-identical after every mutant | **yes** — `git diff --exit-code` after each |
| `export type FailureReason` with nine members | **9** union members counted |
| `export type ReasonCode = AbandonReason | FailureReason` | present, line 180 |
| `reason?: ReasonCode | undefined;` on `ActionResult` | present, line 78 |
| `export const MESSAGE_MAX_CHARS = 180;` unannotated | present, line 206 |
| `export type AbandonReason` with its three original members + doc comment | unchanged |
| `USER_CANCELLED` / `USER_DECLINED` compile as `Readonly<ActionResult>` | unchanged, compile |
| `ConsentPolicy.onMissing` still `Pick<ActionResult, "reason" \| "message">` | unchanged, line 353 |
| `grep -v '^[[:space:]]*[*/]' src/types.ts \| grep -c "detail?"` | **0** |
| `message` doc contains "never a consent artifact" and names `MESSAGE_MAX_CHARS` | **yes** |
| Any doc comment claiming thirteen codes | **none** — `grep -ci thirteen src/types.ts` = 0 |
| Five named aliases present in `results.test-d.ts` | all **1** each |
| `grep -v '^[[:space:]]*[*/]' results.test-d.ts \| grep -c 'case "'` | **12** |
| `case undefined:` arm + `const _never: never` default arm | **1** each |
| Local redefinition of `Expect`/`Equals`/`Assignable`/`Not` | **0** |
| Imports from `"./_assert.js"` and `"../src/types.js"` | both present |
| `results.test-d.ts` export lines | **0** |
| `@ts-expect-error` directives | **1**, with a single-line object literal beneath it |
| `results.test-d.ts` line count | **108** (min_lines 40) |
| File deletions across both commits | **none** |
| `.planning/STATE.md`, `.planning/ROADMAP.md` | untouched |

## Threat Model Compliance

| Threat ID | Disposition | Status |
|---|---|---|
| T-01-03 | mitigate | Closed. `reason` admits twelve codes; `_reasonClosed` plus the freshness directive both reject `"whoops"`, and mutant M1 proves both fire. A handler can no longer place arbitrary text into a field the agent reads. |
| T-01-04 | mitigate | No `detail?` sibling added. Comment-filtered grep returns 0. `ActionResult` still has exactly three members. |
| T-01-05 | transfer | `MESSAGE_MAX_CHARS = 180` is exported with the literal type intact, and the `message` doc names Phase 6 / SEC-06 as the enforcer and states why the bound cannot be a type. The C0/C1 stripping and truncation remain Phase 6's obligation — **Phase 1 ships no runtime enforcement of this bound.** |
| T-01-06 | mitigate | The `const _never: never` default arm is in place and was proven to break on an added code (M6). |
| T-01-34 | mitigate | Twelve. No thirteenth code invented; the switch has exactly twelve string-literal arms and the count is greppable. |

**No new threat surface.** This plan adds no runtime code paths — one numeric constant and type declarations only. `test-d/` is outside `src/` and outside the emit program.

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or trust-boundary schema change.

## Known Stubs

None in this plan's artifacts.

One **inherited, deliberate** gap worth naming for the verifier: `MESSAGE_MAX_CHARS` is a declared bound with **no enforcement anywhere in the codebase**. Nothing truncates, and nothing strips control characters. That is by design — D-02 assigns enforcement to Phase 6 (SEC-06) and the constant exists to be the shared contract between the phases — but until SEC-06 lands, a handler returning a 10,000-character message with embedded control characters is accepted by the type system and by the (not yet written) runtime. This is documented in the `message` doc comment rather than left implicit.

## Notes for Plans 01-03 through 01-07

1. **Write every `Expect<…>` predicate on one line.** See Deviation 1. The `01-RESEARCH.md` SC-2 example's wrapped form is diagnostically inert, and several other SC examples in RESEARCH (SC-7a onward) are wrapped the same way. Copying them verbatim will produce anonymous failures.
2. **`tsc` echoes the source line only in pretty mode.** Plan 01-01 already flagged this; it compounds with the above. In a piped CI log there is no source echo at all, so `scripts.typecheck` gaining `--pretty` is still worth someone owning.
3. **Mutate `src/`, never the suite.** Restoring from a pristine copy and asserting `git diff --exit-code` after each mutant is what keeps a broken intermediate state from being committed.
4. **`index.ts` is untouched and accumulating debt.** Plan 01-08 must add `FailureReason`, `ReasonCode`, and `MESSAGE_MAX_CHARS` on top of everything plans 01-03..01-07 introduce.

## Self-Check: PASSED

- `packages/concierge/src/types.ts` — FOUND
- `packages/concierge/test-d/results.test-d.ts` — FOUND
- `.planning/phases/01-type-surface-completion/01-02-SUMMARY.md` — FOUND
- Commit `19be2a9` (Task 1) — FOUND in git log
- Commit `8a42c58` (Task 2) — FOUND in git log
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — exit 0
- `.planning/STATE.md` and `.planning/ROADMAP.md` absent from the diff against base `b65524f`
