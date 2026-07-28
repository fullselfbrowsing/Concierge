---
phase: 01-type-surface-completion
plan: 08
subsystem: api
tags: [typescript, esm, verbatimModuleSyntax, isolatedDeclarations, package-exports, public-api]

# Dependency graph
requires:
  - phase: 01-02
    provides: "FailureReason, ReasonCode, MESSAGE_MAX_CHARS declared in types.ts"
  - phase: 01-03
    provides: "TurnIdentityProvenance declared and referenced by TransportCapabilities.userTurnIdentity"
  - phase: 01-04
    provides: "Readback, ReadbackReceipt, ReadbackSink, DigestLike, ServerChallenge declared; brand symbol left module-private"
  - phase: 01-06
    provides: "AnyActionDefinition declared and referenced by StageDefinition.actions"
  - phase: 01-07
    provides: "Scheduler declared and referenced by ConciergeConfig.scheduler"
provides:
  - "The complete package entry point: 39 type exports and 4 value exports from packages/concierge/src/index.ts"
  - "Every type Phase 1 added is importable by name from @fullselfbrowsing/concierge"
  - "Emit-level proof that the ServerChallenge brand symbol and ReadbackAttestation stay off the published surface"
  - "A measured asymmetry in verbatimModuleSyntax's export-placement enforcement, with the unguarded direction named"
affects: [01-09, phase-03-catalog, phase-06-dispatcher, phase-07-session, phase-08-consent-kernel, adapters]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Export groups in index.ts mirror the section comments in types.ts; additions slot into their group rather than appending to the end"
    - "Types re-exported via `export type { … }`; runtime values via a separate plain `export { … }` statement"

key-files:
  created:
    - .planning/phases/01-type-surface-completion/01-08-SUMMARY.md
  modified:
    - packages/concierge/src/index.ts

key-decisions:
  - "Scheduler placed first in the Concierge export group, mirroring its declaration order in types.ts, so the Concierge/ConciergeConfig/Session/SessionConfig block stays contiguous"
  - "TurnIdentityProvenance placed immediately after TransportCapabilities, the interface whose userTurnIdentity member references it"
  - "The value export became a multi-line statement rather than a 97-char single line, matching the export type block directly above it"
  - "README.md deliberately NOT modified: the stale block the plan targeted was deleted by the user in bc9ca88, and re-adding a design-contract section would reverse an explicit user decision"

patterns-established:
  - "Placement asymmetry: a TYPE in the plain value export is compiler-enforced (TS1205); a VALUE in the export type block is NOT — it compiles clean and silently erases the runtime binding from the emitted JS"

requirements-completed: [SC-2, SC-3, SC-7]

# Metrics
duration: ~8 min
completed: 2026-07-28
---

# Phase 01 Plan 08: Export Surface Completion Summary

**The package entry point now re-exports all 39 public types and 4 runtime values — closing the ten-symbol export debt accumulated across plans 02–07 — with emit-level proof that the `ServerChallenge` brand symbol never reaches the published surface.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-28T16:05:00Z (approx.)
- **Completed:** 2026-07-28T16:13:00Z
- **Tasks:** 2 (1 code, 1 closed by amendment)
- **Files modified:** 1

## Accomplishments

- **Export debt closed.** Ten types that Phase 1 declared but left module-private are now re-exported. Two of them — `AnyActionDefinition` and `TurnIdentityProvenance` — appear *in the public surface* via `StageDefinition.actions`, `ConciergeConfig.crossStage`, and `TransportCapabilities.userTurnIdentity`, so `StageDefinition`, `ConciergeConfig`, and `TransportCapabilities` were all unusable by name from outside the package until this commit. `Scheduler` was the third such case, added by 01-07.
- **`MESSAGE_MAX_CHARS` reaches consumers as a value**, not a type-only re-export — verified by counting occurrences in the emitted `dist/index.js`, not by reading the source.
- **Nothing was dropped.** `AbandonReason` is still exported (T-01-28); the export count went 29 → 39 types and 3 → 4 values, with no removals.
- **The brand symbol and `ReadbackAttestation` stay off the surface**, confirmed against the emitted `.d.ts` rather than the source (T-01-27).
- **A real gap in the plan's own rationale was found and measured** — see [The placement asymmetry](#the-placement-asymmetry). The plan asserted that `verbatimModuleSyntax` *requires* `MESSAGE_MAX_CHARS` in the plain `export { … }` statement. It does not. The correct placement is a review-only guard.

## Task Commits

1. **Task 1: Complete the export surface in index.ts** — `530151c` (feat)
2. **Task 2: Correct README.md's ActionResult block** — *no commit; superseded by user action, see [Deviations](#deviations-from-plan)*

**Plan metadata:** see the final `docs(01-08)` commit.

## Files Created/Modified

- `packages/concierge/src/index.ts` — `+16 / -1`, now **70** lines. Ten type re-exports added under their existing comment groups; `MESSAGE_MAX_CHARS` added to the value export statement. The header doc comment was left unchanged: it says the package "currently exports the design contract only", which is still exactly true.
- `README.md` — **untouched.** See Deviations.

## The Completed Export Surface

Additions, by group, in the order they appear in the file:

| Group | Added | Declared by | Why it could not stay private |
|---|---|---|---|
| Results | `FailureReason`, `ReasonCode` | 01-02 | `ActionResult.reason` is typed `ReasonCode \| undefined`; Phase 6 narrows on `FailureReason` directly |
| Consent | `Readback`, `ReadbackReceipt`, `ReadbackSink`, `DigestLike`, `ServerChallenge` | 01-04 | `ConciergeConfig.presentReadback`, `.digest`, and `ConsentAck.challenge` all reference them |
| Actions | `AnyActionDefinition` | 01-06 | `StageDefinition.actions` and `ConciergeConfig.crossStage` |
| Transport | `TurnIdentityProvenance` | 01-03 | `TransportCapabilities.userTurnIdentity` — and consumers *implement* `TransportCapabilities`, so they need the union by name |
| Concierge | `Scheduler` | 01-07 | `ConciergeConfig.scheduler` |
| *(value)* | `MESSAGE_MAX_CHARS` | 01-02 | `ActionResult.message`'s documented bound; Phase 6 (SEC-06) enforces against it |

**Counts:** 29 → **39** type exports, 3 → **4** value exports. Zero removals.

**Not exported, deliberately:**

- `serverChallengeBrand` — the `unique symbol` brand. T-01-27: exporting it would let an app construct a `ServerChallenge` by intersecting, defeating the produce-nothing rule the brand exists to enforce. `isolatedDeclarations` emits it correctly as a module-private `declare const`; **verified 0 occurrences in `dist/index.d.ts`**.
- `ReadbackAttestation` — not declared anywhere. D-12 item 1 defers it to Phase 8, which designs the kernel that consumes it. **Verified 0 occurrences in `dist/index.d.ts`**.
- `ConsentAckBase` — remains module-private, as 01-05 intended.

## Verification

| Check | Result |
|---|---|
| `pnpm --filter @fullselfbrowsing/concierge typecheck` | exit **0** |
| `pnpm typecheck` (repo root, `-r`) | exit **0** |
| `src/index.ts` is actually in the typecheck program | **yes** — `tsc --listFiles` lists it; `tsconfig.test-d.json` includes `src/**/*.ts` |
| `tsc -p tsconfig.json` (real build) | exit **0** |
| All 39 type names present in emitted `dist/index.d.ts` | **yes**, counted |
| `serverChallengeBrand` in `dist/index.d.ts` | **0** |
| `ReadbackAttestation` in `dist/index.d.ts` | **0** |
| `MESSAGE_MAX_CHARS` in emitted `dist/index.js` (runtime binding present) | **1** |
| `MESSAGE_MAX_CHARS` literal survives `isolatedDeclarations` | `export declare const MESSAGE_MAX_CHARS = 180;` at `dist/types.d.ts:177` |
| `AbandonReason` still exported | **yes** |
| `git diff --exit-code pnpm-lock.yaml` | exit **0** — install was `--frozen-lockfile`, lockfile byte-identical |
| `dist/` leaks into git | **no** — `git status --porcelain` stayed clean while `dist/` existed; removed afterward |
| `git status --porcelain README.md` | **empty** |

### Export-surface mutation battery

Task 1's acceptance criteria assert that "the typecheck passing is the proof, since `verbatimModuleSyntax` rejects a re-export of a missing name." That claim was tested rather than assumed. **Source was committed first**, so an empty `git status` was an unambiguous no-mutation signal; every mutant was applied, read, and restored **inside a single tool call**, with `git diff --exit-code` asserted immediately after each.

| Mutant | Edit | Result |
|---|---|---|
| M-A | Add `ReadbackAttestation` to the type export block | **exit 2** — `TS2305: Module '"./types.js"' has no exported member 'ReadbackAttestation'` |
| M-B | Add `MESSAGE_MAX_CHARS` to the type block while leaving it in the value block | **exit 2** — `TS2300: Duplicate identifier` ×2 |
| M-C | Re-export the module-private `serverChallengeBrand` | **exit 2** — `TS2724: '"./types.js"' has no exported member named 'serverChallengeBrand'. Did you mean 'ServerChallenge'?` |
| M-B′ | **Move** `MESSAGE_MAX_CHARS` out of the value export and into the type block | ⚠️ **exit 0 — escapes** |
| M-D | Put a type (`Scheduler`) into the plain value export block | **exit 2** — `TS1205: Re-exporting a type when 'verbatimModuleSyntax' is enabled requires using 'export type'` |

Tree clean after every mutant; `git diff --exit-code` green at the end of both battery runs.

M-A and M-C confirm the criterion as written: a re-export of a name `types.ts` does not export cannot compile, so a green typecheck *is* proof that all 39 names resolve.

### The placement asymmetry

M-B′ is the finding worth carrying forward, and it **corrects the plan's stated rationale.** Plan 01-08 said:

> It is a value, not a type — `verbatimModuleSyntax` requires it in the plain `export { … }` statement, not the `export type { … }` block.

Measured, that is only half true, and the guarded half is the opposite one:

| Direction | Enforced? | Evidence |
|---|---|---|
| A **type** placed in the plain `export { … }` block | ✅ compiler-enforced | `TS1205` (M-D) |
| A **value** placed in the `export type { … }` block | ❌ **not enforced** | M-B′ typechecks clean, exit 0 |

The wrong placement is worse than a plain error, because it *looks* correct downstream. Under M-B′:

- `tsc` exits 0 and the build succeeds.
- `dist/index.d.ts` still lists `MESSAGE_MAX_CHARS` among the exports, so the name appears on the published type surface.
- `dist/index.js` contains **0** occurrences of it — the runtime binding is erased entirely.

Control run with the shipped (correct) placement: **1** occurrence in `index.js`, **1** in `index.d.ts`.

So a consumer doing `import { MESSAGE_MAX_CHARS } from "@fullselfbrowsing/concierge"` to check a message length at runtime would read `undefined`, and `undefined` compares falsy against every bound — a length cap that silently stops capping. That is the same failure shape the phase keeps naming: a guard that passes while appearing to work.

**This seam currently has no automated guard.** It joins `DigestLike`'s method syntax (recorded in 01-04) as review-only. Unlike `DigestLike` — whose discriminator is the DOM-vs-Node `BufferSource` split and therefore *cannot* get an in-repo mutant — this one **is** guardable in-repo, in one line:

```ts
// test-d/results.test-d.ts (or a new test-d/exports.test-d.ts)
import { MESSAGE_MAX_CHARS } from "../src/index.js";
type _MessageMaxIsAValue = Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>;
```

`typeof` demands a value meaning, which a type-only re-export does not provide, so M-B′ would go red. **Not added here** — `test-d/` is outside this plan's `files_modified`, and plan 01-09's `files_modified` is `types.ts` + `01-VALIDATION.md`, so it will not add it either. Handed to Phase 2 or to whoever next owns `test-d/`. See [Next Plan Readiness](#next-plan-readiness).

## Decisions Made

1. **`Scheduler` placed first in the Concierge export group** (`Scheduler, Concierge, ConciergeConfig, Session, SessionConfig`) rather than adjacent to the `ConciergeConfig` that references it. This mirrors declaration order in `types.ts` and leaves the existing four-name block contiguous and unreordered — a pure insertion, which keeps `git diff` on this group to one added line.
2. **`TurnIdentityProvenance` placed immediately after `TransportCapabilities`**, the interface whose `userTurnIdentity` member references it, so the two read together. Also a pure insertion.
3. **The value export is now a multi-line statement.** Adding `MESSAGE_MAX_CHARS` to the existing single line would have produced a 97-character line. The repo has no formatter installed and no `.prettierrc`, but the source is plainly Prettier-shaped at printWidth 80 (the `export type { … }` block directly above is exactly what Prettier emits for an over-width list), and the stack doc names Prettier 3.9.6 as the intended formatter. The multi-line form is what that config would produce. **The statement lists exactly the four required names** — `USER_CANCELLED`, `USER_DECLINED`, `CONSENT_GRADE_ORDER`, `MESSAGE_MAX_CHARS` — which is what the acceptance criterion constrains; only its line count differs from a literal reading of "the value export line". Flagged here so no verifier has to guess.
4. **The header doc comment was not touched.** It says the package "currently exports the design contract only", which remains accurate — the plan instructed updating it only if it had become inaccurate.

## Deviations from Plan

### 1. [Plan expectation superseded by user action] Task 2 — `README.md` not modified

- **Found during:** Task 2, before any edit — the orchestrator flagged it and the greps confirmed it independently.
- **Issue:** Task 2 instructed correcting `README.md` line 72, which rendered `reason?: string; // stable machine-readable failure code` inside a "Design contract" section. **That section no longer exists.** Between plan authoring and execution the user rewrote `README.md` (commit `bc9ca88`, present in this plan's base) as a short positioning page, deleting the entire design-contract section including the stale block.
- **Verification of the premise:**

  | Command | Result |
  |---|---|
  | `grep -n "reason?: string" README.md` | no match (exit 1) |
  | `grep -c "reason?: string" README.md` | **0** — the plan's acceptance criterion, already satisfied |
  | `grep -n "Design contract\|ActionResult" README.md` | no match (exit 1) |
  | The research grep: `grep -n "userTurnIdentity\|deferUntilDelivered\|readbackHash\|ConsentAck\|reason?:\|TransportCapabilities\|snapshotEquality" README.md` | **no match** — the one line it was established to return is gone |

- **Action taken:** none. No edit to `README.md`. Per the orchestrator's amendment, re-adding a design-contract or `ActionResult` block would reverse an explicit user decision; the README is treated as correct as-is.
- **Files modified:** none. `git status --porcelain README.md` is empty.

### T-01-26: closed, and closed by removal rather than by correction

Stating this plainly because the distinction matters and is easy to lose:

**The threat is genuinely resolved.** T-01-26 was a repudiation risk — the published README asserting an open `reason?: string` while the shipped type is a closed twelve-member union. A README that no longer documents the contract cannot contradict it. There is now **no** false statement about any type this phase changed; the surviving prose bullet ("**Structured results** — every action returns a safe, human-readable outcome instead of leaking exceptions or implementation details") is accurate against the shipped `ActionResult`, and the rewritten page kept an `<a id="design-contract"></a>` anchor at line 46 so inbound links still land.

**But it was resolved by deleting the claim, not by fixing it.** Two consequences follow, neither a defect and both worth recording:

1. **The design contract is no longer documented at the type level anywhere in the README.** The six ideas survive as prose bullets under "How It Works"; the rendered `ActionResult` shape does not. Anyone wanting the contract now reads `packages/concierge/src/types.ts`, whose doc comments are extensive and current.
2. **Two things Task 2 wanted to *add* were not added:** that `message` is a best-effort human-facing sentence bounded by `MESSAGE_MAX_CHARS`, and that it is **never a consent artifact**. Both are stated at length in `types.ts` on `ActionResult.message`, so the contract itself carries them — but they are absent from the public-facing page. Given `ActionResult.message` reaching the human *through* an agent that reauthors it is the OWASP ASI09 problem the whole `ConsentGrade` ladder exists for, this is the one piece of doc coverage worth restoring when the README next grows a documentation section.

**Disposition: a doc-coverage observation for a later phase, not a defect to fix here.** Nothing is wrong; something is merely no longer said. Phase 8 owns the consent kernel and is the natural point to write user-facing consent documentation, at which point the `message`-is-not-consent statement should land in it.

---

**Total deviations:** 1 (plan expectation superseded by user action; no code change, no auto-fix).
**Impact on plan:** No scope creep. No file outside `files_modified` was touched — and one file *inside* it was deliberately left alone. No dependency added, no export removed, `types.ts` untouched, `test-d/` untouched, `STATE.md` and `ROADMAP.md` untouched.

## Issues Encountered

1. **The worktree had no `node_modules`, so `tsc` was missing.** Resolved with `pnpm install --frozen-lockfile --prefer-offline` (204 ms, 2 packages, typescript 5.9.3). `git diff --exit-code pnpm-lock.yaml` confirms the lockfile is byte-identical.
2. **The worktree base was wrong on arrival** — `git merge-base HEAD` resolved to `e4e353f` rather than the expected `bc9ca88`. Corrected with `git reset --hard bc9ca88…` per the startup check, and re-verified. Notably, `bc9ca88` is the very commit that made the Task 2 amendment necessary, so executing against the stale base would have found the old README and produced the wrong edit.
3. **`git check-ignore -v packages/concierge/dist` exits 1 even though `.gitignore` contains `dist/`.** Not a repo bug: a trailing-slash pattern matches directories only, and the directory did not exist yet, so git could not classify the path. Confirmed ignored the direct way instead — `git status --porcelain` stayed clean with `dist/` present on disk. Recorded because the same check will mislead anyone verifying 01-09's build-artifact criterion.

## User Setup Required

None — no external service configuration, no packages installed beyond the frozen-lockfile bootstrap.

## Next Plan Readiness

**Ready for 01-09 (the phase gate).**

- The type surface is complete and reachable. 01-09's ten-mutant battery operates on `types.ts`, which this plan did not touch, so there is no interaction.
- 01-09-T2 checks that a real build emits no `*.test-d.*` or `_assert` artifact into `dist`. A build was run here (`tsc -p tsconfig.json`, exit 0) and `dist/` removed afterward, so 01-09 starts from the same never-built state the research recorded. Note issue 3 above before verifying `dist` is ignored.
- `01-VALIDATION.md` row **01-08-T1** can be marked ✅. Row **01-08-T2**'s command is `grep -n "reason?: ReasonCode" README.md && grep -c "reason?: string" README.md | grep -qx 0 && echo README_CONSISTENT`. **This command now fails at its first clause** — the README contains no `reason?: ReasonCode`, because it contains no `ActionResult` block at all. Its *second* clause (zero `reason?: string`) passes. 01-09 owns `01-VALIDATION.md`; that row needs rewriting to match the amended reality rather than being marked red. Suggested replacement, which asserts the same absence-of-contradiction without demanding a section the user deleted:

  ```
  grep -c "reason?: string" README.md | grep -qx 0 && echo README_NO_STALE_CONTRACT
  ```

**Carried forward, unguarded:**

- **The value-vs-type export placement of `MESSAGE_MAX_CHARS` is review-only** (see [The placement asymmetry](#the-placement-asymmetry)). A one-line `typeof` assertion in `test-d/` would guard it; no plan in this phase owns `test-d/` any more. Hand to Phase 2 or the next `test-d/` owner. Until then, treat any edit moving a value into the `export type { … }` block as a silent runtime regression that no command in this repo will catch.
- **The README no longer states that `ActionResult.message` is never a consent artifact.** Doc coverage, not a defect. Natural home is Phase 8's consent documentation.

## Self-Check: PASSED

| Claim | Check | Result |
|---|---|---|
| `packages/concierge/src/index.ts` exists and was modified | `[ -f … ]` + `git show --stat` | FOUND — `+16 / -1` |
| `.planning/phases/01-type-surface-completion/01-08-SUMMARY.md` exists | `[ -f … ]` | FOUND |
| Commit `530151c` exists | `git log --oneline --all \| grep 530151c` | FOUND |
| `README.md` unmodified | `git status --porcelain README.md` | empty — FOUND (no modification) |
| `STATE.md` / `ROADMAP.md` unmodified | `git status --porcelain .planning/STATE.md .planning/ROADMAP.md` | empty |

---
*Phase: 01-type-surface-completion*
*Completed: 2026-07-28*
