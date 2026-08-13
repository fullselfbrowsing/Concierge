---
phase: 01-type-surface-completion
plan: 09
subsystem: types
tags: [typescript, mutation-testing, phase-gate, validation, type-testing, dist-hygiene, sign-off]

# Dependency graph
requires:
  - phase: 01-01
    provides: "tsconfig.test-d.json (the src + test-d program), test-d/_assert.ts, and the repointed typecheck script — the entire apparatus this battery drives"
  - phase: 01-02
    provides: "results.test-d.ts and the measured one-line-predicate rule, without which tsc echoes a line carrying no alias name"
  - phase: 01-03
    provides: "transport.test-d.ts — M2's and M6's detectors"
  - phase: 01-04
    provides: "consent.test-d.ts part 1 — M5's pair; and the finding that DigestLike's method syntax can have no mutant"
  - phase: 01-05
    provides: "consent.test-d.ts part 2 — M4's two detectors"
  - phase: 01-06
    provides: "actions.test-d.ts — M3, M7, M8, M9, M10's detectors; the commit-before-mutating discipline; and the deferred M9 second-detector decision"
  - phase: 01-07
    provides: "the config/session assertions, M5's pinned battery count re-confirmed, and the deferred Scheduler shape-pin decision"
  - phase: 01-08
    provides: "the completed export surface, and the measured verbatimModuleSyntax placement asymmetry handed forward unguarded"
provides:
  - "SC-7 established as fact: all ten corrected defects reintroduced against the FINAL type surface, every one exiting non-zero with the guard its own row names"
  - "Empirical confirmation of the two 2026-07-28 row corrections — M4's TS2578 and M10's _requiresIsString are silent BY CONSTRUCTION, measured at 0"
  - "Emit-level proof that no test artifact reaches dist"
  - "01-VALIDATION.md signed off: status complete, nyquist_compliant true"
  - "A repaired 01-08-T2 row — the phase's one check that could never pass, replaced rather than marked red"
  - "Three inherited suite-strengthening decisions resolved, each with its reasoning and its named owner"
affects: [phase-02-packaging, phase-03-catalog, phase-06-dispatcher, phase-08-consent-kernel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Apply, measure, and restore each mutant inside ONE tool call, asserting git diff --exit-code immediately after — never across a boundary the agent does not control"
    - "Assert the restored file by blob hash against HEAD, not merely by git diff — a hash is positive evidence of byte-identity"
    - "Annotate every diagnostic with the source line tsc echoed: in this suite the alias name IS the diagnostic"
    - "Repair a validation row that has become unsatisfiable; do not mark it red and do not delete it"
    - "The phase gate certifies the suite as shipped — it does not modify the suite it is certifying"

key-files:
  created:
    - .planning/phases/01-type-surface-completion/01-09-SUMMARY.md
  modified:
    - .planning/phases/01-type-surface-completion/01-VALIDATION.md

key-decisions:
  - "Declined to add the M9 second detector: test-d/ is outside files_modified, and the gate plan's contract is to leave code byte-identical. Handed to Phase 2 with the exact assertion"
  - "Declined to add the Scheduler shape pin: RESEARCH A3 expects Phase 6 to change the signature, so the pin would fire on a sanctioned edit and get deleted. Handed to Phase 6"
  - "Declined to add the MESSAGE_MAX_CHARS export-placement guard: test-d/ outside scope. Recorded that the EXISTING _messageBound does NOT cover it, because it imports from types.ts rather than index.ts"
  - "Adopted 01-08's suggested replacement command for row 01-08-T2 on its merits — it tests absence of the false claim, which is what T-01-26 requires, without demanding a section the user deleted"
  - "Also repaired Sampling Rate gate item 4 and the Manual-Only row: same stale README:72 reference, and item 4 is one of the four items this plan certifies"
  - "Left the per-task map's File Exists column and the Wave 0 checklist untouched — they record provisioning state at authoring time, and the plan says change nothing else"

requirements-completed: [SC-7, TRN-01, TRN-05]

# Metrics
duration: ~30 min
completed: 2026-07-28
---

# Phase 01 Plan 09: The Phase Gate Summary

**All ten corrected defects were reintroduced against the final type surface and every one of them broke the build naming its own guard — including the three that escaped a first-draft suite — so Phase 1's type contract is now demonstrated rather than asserted.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2/2
- **Files modified:** 1 (`01-VALIDATION.md`). `types.ts` was mutated ten times and restored byte-identical.

## Task Commits

1. **Task 1: Run the ten-mutant battery against the final type surface** — *no commit, by design.* The plan requires `types.ts` to end byte-identical to how Plan 08 left it, so Task 1 changes no file. Its artifact is the battery record below.
2. **Task 2: Close the three remaining gate checks and sign off the validation strategy** — `3b10ec3` (docs)

---

## The ten-mutant battery — final phase gate

Every mutation was applied to `packages/concierge/src/types.ts`, typechecked, annotated, and restored with `git checkout --` **inside a single tool call**, with `git diff --exit-code` and `git status --porcelain` asserted immediately after. The tree was committed and clean before the first mutant ran, so an empty `git status` is a *complete* statement that no mutation is applied. **10/10 restored clean.**

| # | Mutation applied | Exit | Errors | Diagnostics observed → guard matched |
|---|---|---|---|---|
| **M1** | `reason?: ReasonCode \| undefined` → `reason?: string` | **2** | 5 | TS2322 `const _never: never = r.reason` (**the exhaustiveness arm**) · TS2375 `_computedReasonAssigns` (**the computed idiom**) · TS2578 the freshness directive · TS2344 `_reasonClosed` · TS2344 `_reasonAdmitsUndefined` |
| **M2** ⚑ | `ToolBatch.deferUntilDelivered` → `(effect: (deliveredResponseId: string) => void) => void` | **2** | 2 | TS2344 **`_batchHook`** · TS2344 **`_batchRejectsBareId`** |
| **M3** | `consent?: ConsentPolicy<Snapshot>` → `ConsentPolicy` | **2** | 3 | TS2344 **`_snapshotInferred`** · TS2322 ×2 on the two fixtures' comparators |
| **M4** | `ConsentAck` union → one interface, `grade: ConsentGrade`, `readbackHash?: string` | **2** | 2 | TS2344 **`_attestedNeedsHash`** · TS2322 in **`narrowsThroughTheUnion`**. **TS2578 count = 0 — correct** |
| **M5** ⚑ | `ReadbackSink` → `<Payload = unknown>(readback: Readback<Payload>) => …` | **2** | 2 | TS2344 **`_sinkShape`** · TS2578 **`_sinkTakesNoTypeArgs`** — **both fired** |
| **M6** | `userTurnIdentity: TurnIdentityProvenance` → `boolean` | **2** | 5 | TS2344 **`_provenanceNotBoolean`** · TS2322 ×4 on the two capability literals and the two transport fixtures |
| **M7** | `readsUntrusted` moved into `SideEffects` | **2** | 3 | TS2339 **`_readsUntrustedOnDefinition`** · TS2578 **the `SideEffects` negative directive** · TS2353 on the `cancelShipment` fixture |
| **M8** ⚑ | `handler` → `ActionHandler<InferOutput<Schema>, Bridge>` | **2** | **1** | TS2344 **`_handlerAck`** — the sole diagnostic in the entire repository |
| **M9** | `snapshotEquality?: (a, b) => boolean` → method syntax | **2** | **1** | TS2578 **`_policyDegraded`'s directive** |
| **M10** | `ConsentPolicy<Snapshot, Name extends string = string>`, `requires: Name`, threaded | **2** | 2 | TS2344 **`_nameNotWidened`** · TS2344 **`_snapshotInferred`**. **`_requiresIsString` silent — correct** |

⚑ = one of the three escapees that survived a first-draft suite during research.

**Every mutant exited non-zero. Every mutant produced the guards its own row names. No mutant was judged against a guard that cannot fire for it.**

### The three escapees, confirmed individually

1. **M2 — the `ToolBatch` delivery hook.** The `git diff` hunk header was captured with the mutation to prove it landed inside `export interface ToolBatch` and not on `InvocationMeta`, whose identically-spelled member sits 700 lines earlier. Both halves of the pair fired. Without `_batchHook`, a regression on the hook a transport author actually *implements* is invisible to every consent-shaped assertion, because they all read `InvocationMeta`.
2. **M5 — the `ReadbackSink` form.** Both halves fired, which is the criterion: the plan states that if only one fires the pair is broken. Count held at exactly **2**, both in `consent.test-d.ts`, **zero** in `actions.test-d.ts` — identical to 01-07's re-run, so the two new `ReadbackSink` references 01-07 added still do not interfere.
3. **M8 — the handler forward.** **Exactly one error in the whole repository.** One assertion stands between this regression and a green suite; every consent assertion above it stayed silent, exactly as 01-06 measured.

### The two silences, verified rather than assumed

Both were once written into `01-VALIDATION.md` as expectations that *could not be met*. T-01-36 names precisely this as the path to a remediation loop against a working suite on the last plan of the phase — the point of maximum pressure to "just make it pass". Both were measured at the gate:

- **M4 fires no TS2578.** Grep count over the full diagnostic output: **0**. No `@ts-expect-error` in the suite becomes unused when `ConsentAck` flattens. The 2026-07-28 correction to that row is now empirically confirmed rather than reasoned.
- **M10 does not fire `_requiresIsString`.** Diagnostics at `actions.test-d.ts(158…)`: **0**. Once `Name` carries its `= string` default, `ConsentPolicy<Booking>["requires"]` is still `string`, so the pin cannot see the mutation. It remains a valid static pin against `requires` being retyped outright; it is simply not M10's detector.

**Neither the suite nor either assertion was edited.** M4 and M10 are recorded as caught, not as escaping.

### Restoration hygiene

| Check | Result |
|---|---|
| Mutants applied and restored | **10/10** |
| `git diff --exit-code packages/concierge/src/types.ts` after each | **10/10 clean** |
| `git status --porcelain` after each | **10/10 empty** |
| Two mutants stacked at any point | **never** |
| `types.ts` blob hash vs `HEAD:packages/concierge/src/types.ts` | `b446d19…` = `b446d19…` — **byte-identical**, proven at the object level |
| `pnpm --filter @fullselfbrowsing/concierge typecheck` after the final revert | exit **0** |

The blob-hash check is stronger than `git diff` and was added deliberately: 01-05 was interrupted mid-measurement and left `ConsentAckBase.payload` mutated from `Payload` to `unknown`, and the whole repo typechecked green with that mutation applied. A hash comparison is positive evidence of byte-identity rather than the absence of a reported difference.

---

## The four phase-gate items

| # | Item | Command | Result |
|---|---|---|---|
| 1 | Workspace typecheck | `pnpm typecheck` (root, `pnpm -r typecheck`) | exit **0** |
| 2 | Ten-mutant battery, all non-zero | above | **10/10 exit 2** |
| 3 | No test artifact in `dist` | `tsc -p tsconfig.json` then scan | exit **0**, **0** matches |
| 4 | README agreement | the establishing grep | **0 lines returned** |

**Gate item 3, in detail.** `dist/` did not exist beforehand, so this was a real cold build. It emitted exactly eight files — `index` and `types`, each as `.js`, `.d.ts`, and both `.map`s. `ls -R … | grep -c "test-d\|_assert"` returned **0**, and a stricter `find -name '*.test-d.*' -o -name '*_assert*'` over every path also returned **0**. The claim under test was that `tsconfig.json`'s `include: ["src/**/*.ts"]` never reaches `test-d/`; it holds. `git status --porcelain` stayed **empty while `dist/` existed on disk**, which is the direct confirmation that it is gitignored — 01-08 recorded that `git check-ignore -v` misleads here, because a trailing-slash pattern matches directories only and the directory did not exist yet. `dist/` was removed afterwards.

**Gate item 4, stated precisely.** The establishing grep returns **zero lines**. The honest phrasing is that the check is satisfied **vacuously**, not that every returned line was confirmed consistent — there were none to confirm. The README was read in full against the shipped `types.ts` anyway: its only contract-adjacent statements are prose bullets ("**Structured results** — every action returns a safe, human-readable outcome instead of leaking exceptions or implementation details"; "**Consent that fails closed** — consequential actions require a fresh human confirmation bound to the exact payload that was reviewed"), both accurate against `ActionResult` and `ConsentPolicy`, and its Status section explicitly disclaims a runtime. **Nothing in `README.md` contradicts the shipped contract.**

---

## The `01-08-T2` row: rewritten, not marked red

Row `01-08-T2`'s command began `grep -n "reason?: ReasonCode" README.md && …`. The user rewrote `README.md` in `bc9ca88`, deleting the design-contract section and with it the `ActionResult` block, so **the first clause matches nothing and the conjunction short-circuits**. Measured, not assumed:

| Command | Exit |
|---|---|
| The original row command, verbatim | **1** — fails at clause 1 |
| `grep -c "reason?: ReasonCode" README.md` | **0** |
| `grep -c "reason?: string" README.md` | **0** — the original's *second* clause passes and always did |
| 01-08's suggested replacement, verbatim | **0** — echoes `README_NO_STALE_CONTRACT` |

**01-08's suggestion was evaluated on its merits and adopted.** It asserts the *absence of the false claim*, which is exactly what T-01-26 requires — the threat was a published README asserting an open `reason?: string` against a shipped twelve-member closed union, and a README documenting no type contract cannot contradict one. It demands nothing about the *presence* of a section the user deliberately deleted, which matters: asserting presence would have made the row a standing demand to undo `bc9ca88`, and the row must not fight the user's editorial decision. It still fires if a future README regrows a contract section carrying the stale type.

**What the row no longer covers, recorded in-file so no one mistakes a vacuous pass for a substantive one:** it verifies that the README does not document the contract *wrongly*, not that it documents it *correctly*. Nothing mechanical can cover the latter now, because there is no contract block to compare against.

**Two further repairs, same root cause.** § Sampling Rate gate item 4 read "`README.md:72` matches the shipped `ActionResult`" and the Manual-Only Verifications row read "`README.md:72` renders `reason?: string`". Both name a line and a block that no longer exist. Fixing one stale reference while leaving two would be incoherent — and gate item 4 is one of the four items this plan certifies as closed, so I could not honestly tick it as written. All three now carry a dated amendment note, matching the file's existing convention for the M4 and M10 corrections.

---

## The three inherited decisions

Each was a real strengthening option, not a formality. All three are declined **for this plan** and handed forward with the exact assertion and a named owner, because none can be added within `files_modified` — which is `packages/concierge/src/types.ts` (required to end byte-identical) and `01-VALIDATION.md`. Every one of them lives in `test-d/`.

### 1. M9's second detector — **declined, handed to Phase 2**

```ts
type _policyIsInvariantInSnapshot = Expect<Not<Assignable<ConsentPolicy<Booking>, ConsentPolicy<unknown>>>>;
```

01-06 designed this, measured it viable, and deferred the decision here. The case *for* it is strong and is recorded as still standing: M9's entire symptom is a lone TS2578 — confirmed again above, exactly one diagnostic — and an unused-directive diagnostic is precisely what a reviewer "fixes" by deleting the test. A named predicate converts a deletable symptom into one that says which invariant broke. 01-07's objection to *its* pin does **not** apply here: no sanctioned edit to `snapshotEquality`'s syntax is coming, so there is no false-alarm risk.

Declined anyway, for three reasons in ascending weight:

1. `test-d/actions.test-d.ts` is outside this plan's `files_modified`.
2. It changes M9's expected diagnostic set from `{TS2578}` to `{TS2344, TS2578}` — pinned in three places (this plan's Task 1 row, `01-VALIDATION.md`'s battery table, `01-RESEARCH.md`'s table). I own two of those; I do not own the suite.
3. **Decisive: this plan's contract is to certify the suite as shipped, not to modify it.** `types.ts` must end byte-identical and the plan changes no code at all — that is a deliberate design property of a gate. Adding an assertion here would mean the battery I recorded was run against a suite one commit older than the one signed off, and re-running to fix that makes the gate self-referential.

**Owner: Phase 2**, which brings a test runner and is the next plan family to own `test-d/`. The assertion above is complete and can be pasted as-is; `Not` and `Assignable` must be added to the file's imports from `./_assert.js`, which currently pulls only `Equals` and `Expect` — 01-06 noted this rejected assertion was that file's only would-be consumer of the other two. `01-VALIDATION.md`'s M9 row must be updated in the same commit.

### 2. `Scheduler`'s shape pin — **declined, handed to Phase 6**

```ts
type _schedulerShape = Expect<Equals<Scheduler, (fn: () => void, delayMs: number) => () => void>>;
```

01-07 measured the gap it closes and it is genuine: under M5, `_configPresentReadback` produced **zero** diagnostics, because a field-to-alias `Equals` pin and the alias mutate in lockstep. The three `ConciergeConfig` assertions pin each field to its alias, never the alias's shape, so `Scheduler`'s own shape is guarded by nothing anywhere.

Declined, and here 01-07's own reasoning is the controlling argument rather than scope: **RESEARCH A3 marks this signature MEDIUM-risk and explicitly expects Phase 6 to refine it.** An `Equals` pin on a shape the project has announced it may change fires as a *false alarm* on a sanctioned edit, and the failure mode of a false alarm is that the next person deletes the assertion — which is how a suite loses the pins that were load-bearing. What actually matters (the field carries the alias; the alias returns a canceller) is covered by `_configScheduler` plus a long doc comment.

**Owner: Phase 6 (DSP-08)**, at the moment it settles the signature — where the pin becomes free rather than pre-emptive. Note that Phase 6 also inherits the open question of what an *omitted* scheduler means, since `setTimeout` is TS2304 in this program; both should be resolved together.

### 3. `MESSAGE_MAX_CHARS`'s export placement — **out of scope, and saying so plainly**

01-08 measured the asymmetry: a **type** in the plain `export { … }` block is TS1205, but a **value** in the `export type { … }` block **compiles clean at exit 0** while erasing the runtime binding from `dist/index.js` entirely. A consumer importing `MESSAGE_MAX_CHARS` to check a message length would read `undefined`, and `undefined` compares falsy against every bound — a length cap that silently stops capping.

**This plan cannot guard it.** The guard belongs in `test-d/`, and this plan's `files_modified` is `types.ts` + `01-VALIDATION.md`. 01-08 predicted this correctly. I did not reach outside scope to add it, and I did not transiently mutate `src/index.ts` to re-measure — 01-08's measurement stands and re-running it would require listing a file this plan does not own.

**One refinement worth carrying, because it is a trap.** `results.test-d.ts` already contains:

```ts
import { MESSAGE_MAX_CHARS } from "../src/types.js";
type _messageBound = Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>;
```

That looks like the guard and **is not**. It imports from `../src/types.js`, so it pins the *declaration* — it cannot see a placement regression in `index.ts`, which is where the erasure happens. The guard must import from **`../src/index.js`**:

```ts
import { MESSAGE_MAX_CHARS } from "../src/index.js";
type _messageMaxIsAValue = Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>;
```

`typeof` demands a value meaning, which a type-only re-export does not provide. Anyone implementing this from 01-08's note alone could reasonably conclude `_messageBound` already covers it and close the item wrongly. **Owner: Phase 2 or the next `test-d/` owner.**

---

## Recorded for the downstream phases

- **SC-7e is satisfied by the `_sinkShape` + `_sinkTakesNoTypeArgs` pair against mutant M5**, both observed firing. ROADMAP Success Criterion 7 now reads "a readback sink seam that accepts a type argument"; it previously read "a readback sink that **rejects a typed app sink**". That phrasing was amended upstream on 2026-07-28 because research falsified its premise — **neither** the generic-function form nor the defaulted-alias form accepts a payload-specific app sink, so there is no non-defective contrast state and the original criterion was unachievable as written. ROADMAP carries the amended phrasing plus its own inline note, so **verification grades against the amended criterion, not the original.** The conclusion the criterion protects is unchanged; only the phrasing was wrong.
- **`ActionHandler`'s `AckPayload` moved from type-parameter position 3 to position 4** (01-06, D-07). A breaking positional change to an exported type, free only because nothing has published. `ActionDefinition.handler` was the sole in-repo reference and passes arguments positionally. It will not be free again.
- **`AnyActionDefinition` carries a deliberate `any` in both the `Snapshot` and `AckPayload` positions.** Threading `Snapshot` puts it in two contravariant positions, so `ActionDefinition<…, Booking, …>` is not assignable to an `unknown`-erased form (TS2375) and `types.ts` does not compile without the erasure. `never`-erasure also works and was rejected: it types `snapshotEquality` as `(a: never, b: never) => boolean`, forcing a cast at the one place that must actually *call* the comparator — the consent kernel. **Revisit in Phase 8 against a real kernel** (D-12 item 2), the first point at which the alternative's cost is measurable rather than predicted.
- **`DigestLike`'s method syntax has no mutant and cannot get one.** Its discriminator is the DOM-vs-Node `BufferSource` split, and neither typing is installed in this repo, so no in-repo edit can make a wrong `DigestLike` fail to compile. The positive in `consent.test-d.ts` stays green under the wrong syntax and is **not** a guard. Its only defences are the doc comment, code review, and a grep asserting method syntax. This is the deliberate opposite of `ConsentPolicy.snapshotEquality`, which must stay function-property syntax and *is* guarded (M9) — two adjacent seams, two opposite syntaxes, asymmetric enforcement. A reviewer who normalizes them breaks one.

### The four items handed forward

| Item | Requirement | Target phase | State today |
|---|---|---|---|
| `readsUntrusted` build-time gate — a predicate reporting a `readsUntrusted` action with no consent policy | **SEC-05** | **Phase 3** | Field ships with its type test; **nothing reads it**. Documented on the field itself so it cannot be mistaken for a control |
| `message` truncation to `MESSAGE_MAX_CHARS` + C0/C1 control-character stripping at the dispatcher boundary | **SEC-06** | **Phase 6** | The constant is the shared contract; the type system cannot express a length bound |
| Runtime rejection of a handler return that is not a valid `ActionResult` (`invalid_result`) | **DSP-09** | **Phase 6** | The return type enforces the shape at compile time; the dispatcher receives whatever actually arrives |
| The **TRN-05 runtime gate** refusing `bindTo: "userTurn"` on an `"agent-forgeable"` transport, the **JCS (RFC 8785) encoder**, and **`ReadbackAttestation`** | TRN-05, D-12 item 1 | **Phase 8** | Phase 1's obligation was representability plus a type test. The gate **must not be assumed present** |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The worktree had no `node_modules`, so the plan's only verification mechanism could not run**

- **Found during:** pre-Task-1 baseline. Sixth consecutive Phase 1 worktree to hit this.
- **Issue:** `tsc` absent. `pnpm --filter @fullselfbrowsing/concierge typecheck` is the entire verification apparatus for both tasks and for all ten mutants.
- **Fix:** `pnpm install --frozen-lockfile --prefer-offline` (200 ms, 2 packages, typescript 5.9.3). `--frozen-lockfile` is load-bearing: it forbids resolution, so nothing beyond the committed lockfile can enter. Workspace bootstrap, **not** a package addition — T-01-SC's disposition holds.
- **Verification:** `git diff --exit-code pnpm-lock.yaml` clean before and after.

**2. [Rule 1 - Bug] Two further `README.md:72` references in `01-VALIDATION.md` were as broken as the row I was sent to fix**

- **Found during:** Task 2, while reading § Sampling Rate for the four-item gate.
- **Issue:** gate item 4 read "`README.md:72` matches the shipped `ActionResult`" and the Manual-Only Verifications row read "`README.md:72` renders `reason?: string`". Both name a line and a block deleted in `bc9ca88`. Repairing row 01-08-T2 alone would have left the same falsified claim in two other places — and gate item 4 is one of the four items this plan certifies, so ticking it as written would have been an unsupported sign-off.
- **Fix:** both rewritten to the establishing-grep formulation, each carrying a dated amendment note.
- **Committed in:** `3b10ec3`

### Considered and Deliberately Not Done

- **The three inherited decisions** — full reasoning above. All declined for this plan, all handed forward with the exact assertion and a named owner.
- **The per-task map's `File Exists` column was not updated.** Nineteen rows still read `❌ → src/types.ts` and similar. That column records **provisioning state at strategy-authoring time** — which artifacts Wave 0 had to create before a check could run — and that is a historical fact which is still true and still useful; overwriting it would erase the record of what Wave 0 had to build. The completion record lives in `wave_0_complete: true` and in the nine SUMMARY files. Note for a later reader: the generic legend beneath the table (`⬜ pending · ✅ green · ❌ red · ⚠️ flaky`) describes a *status* column and does not match this column's semantics — a template artifact, flagged rather than silently "fixed".
- **The Wave 0 Requirements checklist was left unticked**, for the same reason and because Plan 01-01 owned that section and chose the frontmatter flag as its completion record. All six artifacts were verified present.
- **`src/index.ts` was not transiently mutated** to re-measure 01-08's M-B′ escape. It is not in `files_modified`, and 01-08's measurement is recorded and sufficient.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug), 3 inherited decisions resolved as declined-and-handed-forward.
**Impact on plan:** no scope creep. No file outside `files_modified` was touched. No dependency added, no export removed, no source file changed.

## Issues Encountered

**The mutation-hygiene protocol was the single highest-risk part of this plan, and it held 10/10.** This plan runs more mutants than any other in the phase, and 01-05 came within one unexamined merge of shipping an erased type parameter because a mutation was left applied — invisibly, since the repo typechecks green under it. Three practices carried that risk:

1. **Everything was committed before the first mutant ran**, so an empty `git status --porcelain` is a *complete* statement that no mutation is applied, not a partial one. An untracked file has no `git checkout --` restore.
2. **Each mutant was applied, measured, annotated, and restored inside one tool call.** The mutation never crossed a boundary an interruption could strand it on.
3. **The mutation harness asserts its own anchors.** Each mutation asserts its anchor matches exactly once (or at a specified occurrence index) and that the result differs from the input. A silently no-op mutation would have produced a false "escapee" report and sent the executor to edit a working suite — the T-01-36 failure mode. M2 is the case that needed this: its anchor string appears **twice** in `types.ts`, once on `InvocationMeta` and once on `ToolBatch`, so the harness targets occurrence 2 and the `git diff` hunk header was captured alongside the diagnostics as proof it landed on the right interface.

**A recurring class showed up for the fifth time in this phase:** prose asserting something no check can falsify goes stale silently. Deviation 2 is the third and fourth instance of the *same* stale reference (`README.md:72`) surviving in a document whose whole purpose is to be checkable. The generalizable rule this phase has now earned: **if a planning document states a line number, a count, or a grep target, something should be able to falsify it** — and where nothing can, the statement should be written so that it degrades to a vacuous pass rather than an impossible one.

## Verification Results

| Check | Result |
|---|---|
| All ten mutants exit non-zero | **10/10, all exit 2** |
| Each mutant produced the guards its own row names | **10/10** |
| M2, M5, M8 (the escapees) explicitly confirmed | **yes** |
| M5 fires **both** `_sinkShape` and `_sinkTakesNoTypeArgs` | **yes** — 2 errors, both in `consent.test-d.ts`, 0 in `actions.test-d.ts` |
| M4 confirmed via `_attestedNeedsHash` + narrowing TS2322 | **yes**; TS2578 count **0** — recorded as correct |
| M10 confirmed via `_nameNotWidened` + `_snapshotInferred` | **yes**; `_requiresIsString` silent — recorded as correct |
| M9 explicitly confirmed non-zero | **yes** — exit 2, exactly 1 error |
| `types.ts` restored after every mutant | **10/10** (`git diff --exit-code`) |
| `types.ts` blob hash == `HEAD:packages/concierge/src/types.ts` | **yes** — `b446d19…` |
| `pnpm --filter @fullselfbrowsing/concierge typecheck` after final revert | exit **0** |
| `pnpm typecheck` (repo root, `-r`) | exit **0** |
| `tsc -p tsconfig.json` cold build | exit **0**, 8 files emitted |
| `ls -R packages/concierge/dist \| grep -c "test-d\|_assert"` | **0** |
| `find dist -name '*.test-d.*' -o -name '*_assert*'` | **0** |
| `dist/` leaks into git while present | **no** — `git status --porcelain` empty with `dist/` on disk |
| `dist/` removed afterwards | **yes** |
| README establishing grep | **0 lines** |
| Task 2's verbatim `<automated>` command | **`GATE_PASS`** |
| Rewritten row 01-08-T2 command | **`README_NO_STALE_CONTRACT`** |
| `01-VALIDATION.md`: `status: complete`, `nyquist_compliant: true`, `wave_0_complete: true` | **all three** |
| Per-task map rows matching `^\| 01-0` (01-01-T3 pins ≥ 19) | **19** — preserved |
| `## Open Questions (RESOLVED)` still present in `01-RESEARCH.md` | **yes** |
| Feedback latency (3 runs, bare `tsc`) | **225 / 231 / 247 ms** |
| Watch-mode flags anywhere in scripts or tsconfigs | **none** |
| `git diff --exit-code pnpm-lock.yaml` | exit **0** |
| `README.md`, `STATE.md`, `ROADMAP.md`, `types.ts`, `index.ts` modified | **none** |
| File deletions in the commit | **none** |
| Untracked files left behind | **none** |

## Threat Model Compliance

| Threat ID | Disposition | Status |
|---|---|---|
| T-01-29 | mitigate | **Closed.** All ten mutants run against the *final* surface, not against the state each was authored under. Every one exited non-zero naming the guard its own row lists. The three that escaped a first-draft suite during research were confirmed individually, and M8 was again observed as the sole diagnostic in the repository. |
| T-01-30 | mitigate | **Closed.** A real cold build emitted 8 files, all derived from `src/`. Zero `*.test-d.*`, zero `_assert*`, confirmed by both the `ls -R` grep and a stricter `find`. `files: ["dist"]` was correctly not relied on — the pollution would have been *inside* `dist`. |
| T-01-31 | mitigate | **Closed, and verified more strongly than required.** 10/10 restored, `git diff --exit-code` and `git status --porcelain` asserted after each, never two mutants stacked, and the final state confirmed by **blob hash** against HEAD rather than by diff alone. |
| T-01-32 | mitigate | **Closed, with a scope note.** The establishing grep returns zero lines and the README was read in full against `types.ts`; nothing contradicts the shipped contract. The note recorded in `01-VALIDATION.md` states that this is now a *vacuous* pass — the README documents no type contract at all — so the check proves absence of contradiction, not presence of accuracy. |
| T-01-36 | mitigate | **Closed, and this was the live risk.** Both expected silences (M4's TS2578, M10's `_requiresIsString`) were measured at **0** and recorded as correct. **No assertion was added, altered, or deleted, and no mutant was reported as escaping.** The three inherited strengthening options were each resolved by decision and hand-off rather than by editing the suite at the gate. |
| T-01-SC | accept | **No packages installed.** The only pnpm invocation was `install --frozen-lockfile --prefer-offline`, which forbids resolution; `pnpm-lock.yaml` byte-identical. **Phase 1 added zero dependency edges end to end.** |

## Threat Flags

None. This plan added no code, no network endpoint, no auth path, no file access pattern, and no trust-boundary schema change. Its only durable artifact is a signed-off planning document.

## Known Stubs

None in this plan's artifacts. The deliberate gaps a verifier should not mistake for incompleteness are the four handed-forward items tabled above, each with a requirement ID and a target phase, plus the three declined assertions with their named owners.

## Next Phase Readiness

**Phase 1 is complete.** The public type surface is final, exported, and demonstrated to be defended by a suite that has been watched failing on every defect it exists to catch.

Three things Phase 2 should pick up first:

1. **The `MESSAGE_MAX_CHARS` export-placement guard**, importing from `../src/index.js` — not the existing `_messageBound`, which imports from `types.ts` and cannot see the regression. One line; the only unguarded seam in the phase that is guardable in-repo.
2. **M9's second detector**, ready to paste, with `Not` and `Assignable` added to `actions.test-d.ts`'s imports and `01-VALIDATION.md`'s M9 row updated in the same commit.
3. **The compiler bump is safe.** Every experiment behind this strategy was re-run under TypeScript 7.0.2 alongside the installed 5.9.3 and produced byte-identical diagnostics, so Phase 2's bump cannot invalidate this suite. Note that TS 7 removes `moduleResolution: "node"` and wants `isolatedDeclarations: true` for the fast dts path — both already satisfied here.

## Self-Check: PASSED

| Claim | Check | Result |
|---|---|---|
| `.planning/phases/01-type-surface-completion/01-09-SUMMARY.md` exists | `[ -f … ]` | FOUND |
| `.planning/phases/01-type-surface-completion/01-VALIDATION.md` modified | `git show --stat` | FOUND — `+56 / -15` |
| Commit `3b10ec3` exists | `git log --oneline` | FOUND |
| `packages/concierge/src/types.ts` unmodified | blob hash vs `HEAD:` | IDENTICAL |
| `README.md` / `STATE.md` / `ROADMAP.md` unmodified | `git status --porcelain <paths>` | empty |
| `pnpm-lock.yaml` unmodified | `git diff --exit-code` | exit 0 |

---
*Phase: 01-type-surface-completion*
*Completed: 2026-07-28*
