---
phase: 01-type-surface-completion
plan: 06
subsystem: types
tags: [typescript, consent, generics, variance, type-erasure, isolated-declarations, type-testing, mutation-testing]

# Dependency graph
requires:
  - phase: 01-01
    provides: "tsconfig.test-d.json (the src + test-d program) and test-d/_assert.ts (Expect / Equals / Assignable / Not)"
  - phase: 01-02
    provides: "the measured one-line-predicate rule — every assertion here sits on one line so tsc echoes the alias name"
  - phase: 01-03
    provides: "the check-the-diagnostic-COUNT-not-just-the-exit-code discipline"
  - phase: 01-04
    provides: "the defect-first discipline, and the deliberate DigestLike/snapshotEquality variance asymmetry that M9 guards"
  - phase: 01-05
    provides: "ConsentAck<Snapshot, Payload> as a two-branch union keeping BOTH parameters through either branch, and _commonPayload guaranteeing Payload actually reaches `payload` — the member _handlerAck binds against"
provides:
  - "ActionHandler<Args, Bridge, Snapshot, AckPayload> — ctx.ack is now ConsentAck<Snapshot, AckPayload>"
  - "ActionDefinition<Name, Schema, Bridge, Snapshot, AckPayload> — handler forwards BOTH, consent is ConsentPolicy<Snapshot>"
  - "readsUntrusted?: boolean as a sibling of effects, deliberately absent from SideEffects (D-04)"
  - "AnyActionDefinition<Bridge> — the any-erased collection view (D-12 item 2), applied at both collection sites"
  - "test-d/actions.test-d.ts — SC-7a, SC-7b, SC-7g, escapee 3, and the erasure positives"
  - "The TS9010 boundary demonstrated where it genuinely fires, and the phase-wide export-nothing rule it implies"
  - "Five-mutant defect-first proof; M8 and M9 each observed producing exactly ONE diagnostic"
affects: [01-07, 01-08, 01-09, phase-03-catalog, phase-04, phase-06, phase-08-consent-kernel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Atomic multi-site edit: when a type parameter enters a contravariant position, the erased collection view lands in the SAME commit — there is no compiling intermediate state"
    - "Erase the collection, not the declaration: `any` confined to one exported alias, concrete types preserved on every individual declaration"
    - "Assert against an INFERRED declaration (`typeof confirm`), never an annotated one — annotating the thing under test supplies the answer the test exists to derive"
    - "Distinguish the fixture types (Snapshot vs AckPayload) so a half-broken two-argument forward cannot pass with the arguments swapped"
    - "Demonstrate a diagnostic where it genuinely fires, then delete the probe and keep the rule"

key-files:
  created:
    - packages/concierge/test-d/actions.test-d.ts
  modified:
    - packages/concierge/src/types.ts

key-decisions:
  - "AckPayload moved from position 3 to position 4 on ActionHandler — a positional change to an exported type, safe only because nothing has published"
  - "any-erasure over never-erasure for AnyActionDefinition: forcing a cast into the consent kernel is worse than one documented `any` in a collection type"
  - "readsUntrusted placed as a sibling of effects, never inside SideEffects — the MCP mirror block's entire value is 1:1 fidelity and openWorldHint is a defective name"
  - "Declined to add a second M9 detector, deliberately — it would have changed M9's expected diagnostic set, which the plan and Plan 09's battery both pin"
  - "Task 2 was committed BEFORE the mutants ran, so that an empty `git status` is an unambiguous no-mutation-applied signal"

patterns-established:
  - "Commit the test file before running mutants against source — an untracked file has no `git checkout --` restore"
  - "Apply, measure, and restore each mutant inside ONE tool call, so the mutation never crosses a boundary the agent does not control"
  - "Do not embed a line number in a comment that must stay accurate; pin the alias name instead and put verbatim diagnostics in the SUMMARY"

requirements-completed: [SC-7a, SC-7b, SC-7g]

# Metrics
duration: ~25 min
completed: 2026-07-28
---

# Phase 01 Plan 06: Threading Snapshot Through the Declaration Chain Summary

**`snapshotEquality` is now typed against the action's own snapshot instead of `unknown` — the consent comparator can finally see what it is guarding, and the one regression that escapes every consent-shaped assertion has a purpose-built detector that was watched firing alone.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2
- **Files modified:** 2 (1 created, 1 modified) — `+377 / -7`

## Accomplishments

- **SC-7a is enforced.** `ActionDefinition.consent` is `ConsentPolicy<Snapshot>`, so a `Booking` comparator is typed against `Booking`. A comparator over `unknown` — a gate that cannot see what it guards — no longer typechecks into a declared action.
- **SC-7b holds under inference.** `name: "confirmBooking"` with `consent.requires: "reviewBooking"` still infers `Name` as `"confirmBooking"` alone. Proven against the *exact* mutation that widens it.
- **SC-7g is placed and pinned.** `readsUntrusted` is a direct member of `ActionDefinition` and is absent from `SideEffects`, asserted in both directions.
- **Escapee 3 is closed.** `handler` forwards `Snapshot` **and** `AckPayload`. M8 produced **exactly one** diagnostic in the entire repository — `_handlerAck`. Without that assertion the suite is green over a broken chain.
- **The erasure works on real heterogeneous input.** Two actions with unrelated snapshots (`Booking`, `Shipment`) assemble into one `StageDefinition.actions`, a third into `crossStage`, with **no `as` cast anywhere in the file**.
- **TS9010 was demonstrated where it actually fires**, and the phase-wide export-nothing rule now rests on an observation rather than an assumption.

## Task Commits

1. **Task 1: Thread `Snapshot`/`AckPayload`, add `readsUntrusted`, land the erasure — one atomic edit** — `b8e6e69` (feat)
2. **Task 2: Author `actions.test-d.ts` defect-first** — `b4f1807` (test)

## Files Modified

- `packages/concierge/src/types.ts` — `+118 / -7`, now **1094** lines. `ActionHandler` at **294** with `ack?: ConsentAck<Snapshot, AckPayload>` at **305**; `ActionDefinition` at **710**; `readsUntrusted` at **780**; `consent?: ConsentPolicy<Snapshot>` at **781**; `AnyActionDefinition` at **818**; the two collection sites at **880** and **1042**.
- `packages/concierge/test-d/actions.test-d.ts` — **created**, 259 lines. Exports nothing; exactly **2** `@ts-expect-error` directives.

No file outside the plan's `files_modified` was touched. `pnpm-lock.yaml` unchanged.

## Why Task 1 had to be one commit

Threading `Snapshot` puts it in **two** contravariant positions — `snapshotEquality`'s parameters and the handler's `ctx.ack`. The moment it becomes real, `ActionDefinition<…, Booking, …>` stops being assignable to the erased-to-`unknown` form that `StageDefinition.actions` and `ConciergeConfig.crossStage` carried, and `types.ts` does not compile at all. There is no intermediate state to commit. The erasure is not a follow-up improvement; it is the other half of the same edit.

## The two positional/API changes worth recording

1. **`ActionHandler`'s `AckPayload` moved from position 3 to position 4.** This is a breaking positional change to an exported type. It is free today only because nothing has published; `ActionDefinition.handler` was the sole in-repo reference and it passes arguments positionally, so it was updated in the same edit. Recorded because the cost will not be zero again.
2. **`AnyActionDefinition` is a new exported type** and is referenced from the public surface (`StageDefinition.actions`, `ConciergeConfig.crossStage`), so it cannot stay module-private. Adding it to `src/index.ts` is **plan 01-08's** export-debt task, not this one — `index.ts` was deliberately not edited.

## Where the `any` went, and why that was the better trade

`AnyActionDefinition<Bridge> = ActionDefinition<string, StandardSchemaV1, Bridge, any, any>`.

`never`-erasure also compiles. It was rejected because it types `snapshotEquality` as `(a: never, b: never) => boolean`, so the consent kernel — **the one place that must actually call the comparator** — needs a cast at the call site. A cast in the security-critical path is easier to get quietly wrong than one documented `any` in a collection type, and it would sit exactly where correctness matters most.

What is *not* given up: the concrete `Snapshot` still lives on every individual declaration, which is where `snapshotEquality` is written and typechecked. Only the collection is erased. The doc comment says all of this, names D-12 item 2 as the settling decision, and flags Phase 8 — against a real kernel — as the point to revisit it.

## `readsUntrusted` is a marker, not a control, and says so

Phase 1 ships the field and the type test. **Nothing reads it.** The build-time gate is **SEC-05, Phase 3**, and the doc comment states that plainly rather than burying it, because an unenforced safety marker sitting beside a redaction policy that genuinely fails closed is this project's named failure mode. A reader who mistakes this field for a control should have been misled by their own optimism, not by us.

It is the only survivor of D-04's four because two of the three lethal-trifecta legs are *structurally always on* here — an action runs inside the app the user is logged into, and `ActionResult.message` returns to the model by design. Untrusted ingress is the single variable leg. `maxPerTurn`, `conflictsWith`, and `impact` are named in the doc comment **only to explain why they were cut**, which is why the acceptance grep filters comment lines — verified at **0** matches outside comments.

## Defect-First Proof — five mutants, all observed

Every mutation was applied to `packages/concierge/src/types.ts`, typechecked, and restored **inside a single tool call**, with `git diff --exit-code` and `git status --porcelain` asserted clean before the next one ran. `actions.test-d.ts` was never mutated. Both source files were committed *before* the battery started, so an empty `git status` is an unambiguous "no mutation applied" signal — see Issues Encountered.

### M3 — `ActionDefinition.consent` reverted to `ConsentPolicy` (no type argument)

**Exit 2, 3 errors.**

```
test-d/actions.test-d.ts(163,61): error TS2322: Type '(a: Booking, b: Booking) => boolean' is not assignable to type '(a: unknown, b: unknown) => boolean'.
test-d/actions.test-d.ts(170,33): error TS2344: Type 'false' does not satisfy the constraint 'true'.
test-d/actions.test-d.ts(226,62): error TS2322: Type '(a: Shipment, b: Shipment) => boolean' is not assignable to type '(a: unknown, b: unknown) => boolean'.
```

Line 163 is `confirm`'s comparator, **170 is `_snapshotInferred`**, 226 is `cancelShipment`'s comparator. Both required diagnostics present; the third is the second fixture reporting the same defect independently.

### M7 — `readsUntrusted` moved into `SideEffects`

**Exit 2, 3 errors.**

```
test-d/actions.test-d.ts(201,67): error TS2339: Property 'readsUntrusted' does not exist on type 'ActionDefinition<string, StandardSchemaV1<unknown, unknown>, unknown, unknown, unknown>'.
test-d/actions.test-d.ts(210,1): error TS2578: Unused '@ts-expect-error' directive.
test-d/actions.test-d.ts(227,3): error TS2353: Object literal may only specify known properties, and 'readsUntrusted' does not exist in type 'ActionDefinition<"cancelShipment", StandardSchemaV1<unknown, { q: string; }>, unknown, Shipment, unknown>'.
```

**201 is `_readsUntrustedOnDefinition`**, **210 is the `SideEffects` negative's directive** — the required TS2339 + TS2578 pair. Line 227 is a bonus: `cancelShipment` sets `readsUntrusted: true` on the declaration, so the fixture itself reports the move.

### M8 (escapee 3) — `handler` reverted to `ActionHandler<InferOutput<Schema>, Bridge>`

**Exit 2, exactly 1 error.**

```
test-d/actions.test-d.ts(188,27): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```

Line 188 is **`_handlerAck`**. This is the plan's central claim confirmed empirically: **one assertion, in the entire repository, stands between this regression and a green suite.** Every consent assertion above it stayed silent, because `consent?: ConsentPolicy<Snapshot>` still infers `Snapshot` correctly on its own and `ctx.ack` still typechecks — as `ConsentAck<unknown, unknown>`. `_handlerArgs` and `_handlerBridge` also stayed silent, correctly: dropping `Snapshot`/`AckPayload` does not disturb `args` or `bridge`.

### M9 — `snapshotEquality` switched to method syntax

**Exit 2, exactly 1 error.**

```
test-d/actions.test-d.ts(130,3): error TS2578: Unused '@ts-expect-error' directive.
```

Line 130 is **`_policyDegraded`'s directive**. A single unused directive is M9's *entire* symptom, exactly as the plan predicts — and exactly the kind of thing a reviewer "fixes" by deleting the test. See Deviations for the second detector that was considered and deliberately not added.

### M10 — `ConsentPolicy<Snapshot, Name extends string = string>` with `requires: Name`, threaded

The plan's exact mutation, not an improvised one.

**Exit 2, exactly 2 errors.**

```
test-d/actions.test-d.ts(167,31): error TS2344: Type 'false' does not satisfy the constraint 'true'.
test-d/actions.test-d.ts(170,33): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```

**167 is `_nameNotWidened`, 170 is `_snapshotInferred`** — the two guards the corrected M10 row names.

**`_requiresIsString` (line 148) stayed silent, and that is correct, not a hole.** Once `Name` carries its `= string` default, `ConsentPolicy<Booking>["requires"]` is still `string`, so the static pin cannot see this mutation. It was not altered to make it fire, no member was added to make it fire, and M10 is **not** reported as escaping. Recorded explicitly because T-01-35 identifies exactly this as the path to a remediation loop against a working suite.

## TS9010 — demonstrated, then deleted

Wave 0 could not test TS9010: `_assert.ts` holds only type aliases and the diagnostic is a *variable*-annotation error. It fires here. Adding `export type _ConfirmProbe = typeof confirm;` produced **exit 2, exactly 1 error**:

```
test-d/actions.test-d.ts(151,7): error TS9010: Variable must have an explicit type annotation with --isolatedDeclarations.
```

At the time of measurement line 151 was `const confirm = defineAction({` and the exported alias sat seven lines below it. **The diagnostic lands on the declaration, not on the export that reached for it.** That asymmetry is the whole reason the rule is stated as "export nothing" rather than "annotate your exports": the error points at an innocent line, so the first fix a developer reaches for is to annotate `confirm` — which silently disables `_nameNotWidened` and `_snapshotInferred`, since both exist only to read an inferred type.

The probe was deleted immediately and the program returned to exit 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The worktree had no `node_modules`, so the plan's own verification command could not run**

- **Found during:** pre-Task-1 baseline.
- **Issue:** `tsc: command not found`. A freshly created worktree carries no installed dependencies, and `pnpm --filter @fullselfbrowsing/concierge typecheck` is the sole verification mechanism for both tasks.
- **Fix:** `pnpm install --frozen-lockfile --prefer-offline`. `--frozen-lockfile` is load-bearing: it forbids resolution, so nothing beyond the already-committed lockfile can be introduced. This is workspace bootstrap, **not** a package addition — no new dependency was requested, resolved, or added, so the plan's `T-01-SC / no packages installed` disposition still holds.
- **Verification:** `git diff --exit-code pnpm-lock.yaml` clean before and after.

**2. [Rule 1 - Bug] The file's own header inflated the `@ts-expect-error` count to 3**

- **Found during:** Task 2 verification.
- **Issue:** an acceptance criterion requires exactly two directives in the file. The header prose used the literal token while *describing* the two-directive rule, so `grep -c '@ts-expect-error'` returned **3**. The directive count was always 2, but the check a verifier would actually run disagreed — and every sibling test file's token count equals its directive count exactly.
- **Fix:** reworded to "exactly two suppression directives", matching `consent.test-d.ts`'s existing convention, and noted in-file why the token is not repeated. Count now **2**.

**3. [Rule 1 - Bug] A hard-coded line number in a comment went stale the moment the comment was edited**

- **Found during:** Task 2, immediately after the TS9010 measurement.
- **Issue:** the header quoted the diagnostic as `actions.test-d.ts(151,7)`. Editing that very comment shifted `const confirm` to line 153, so the file documented a line number that no longer pointed at the thing it described — a small self-invalidating comment of exactly the kind this phase keeps finding in its own planning docs.
- **Fix:** the header now names the *declaration* and the column, states that the line number is omitted deliberately, and points at this SUMMARY for the verbatim text. The plan requires verbatim recording in the SUMMARY, which is drift-free.

### Considered and Deliberately Not Done

**A second, named detector for M9 was designed, measured as viable, and rejected.**

`type _policyIsInvariantInSnapshot = Expect<Not<Assignable<ConsentPolicy<Booking>, ConsentPolicy<unknown>>>>;` would fire TS2344 under method syntax (bivariance makes the assignment succeed), giving M9 a named detector alongside the directive — strictly more robust than a lone TS2578, whose failure mode is silent deletion.

It was **not** added, for one reason: it changes M9's expected diagnostic set from `{TS2578}` to `{TS2344, TS2578}`. The plan states "a single unused directive is M9's *only* symptom — do not expect more", `01-VALIDATION.md`'s battery row pins TS2578, and Plan 09 re-runs that battery at the phase gate. Introducing an unannounced extra diagnostic is precisely the expectation-drift that T-01-35 describes as sending an executor to "fix" a working suite.

Recorded here rather than dropped, because it is a real strengthening option and **Plan 09 is the right place to decide it** — with the whole battery in view and the expectation table editable in the same pass. This also incidentally explains why only `Equals` and `Expect` are imported from `_assert.js`: that rejected assertion was the file's only would-be consumer of `Not` and `Assignable`, and importing types nothing uses would be dead weight.

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs), 1 considered-and-declined
**Impact on plan:** no scope creep. No file outside `files_modified` touched, no dependency added, no export removed, `src/index.ts` untouched.

### Not Done, Deliberately

- **`src/index.ts` was not edited.** `AnyActionDefinition` is a new export that the public surface references, but the export-debt task is **01-08's**.
- **`ConciergeConfig` gained no new seams.** `presentReadback?`, `digest?`, and `scheduler?` are **01-07's**.
- **`ConsentPolicy` still takes exactly one type parameter** and `requires` is still `string`. Typing it would widen `Name` to the union of `name` and `requires` — that *is* mutant M10.
- **`.planning/STATE.md` and `.planning/ROADMAP.md` untouched.** The orchestrator owns those writes after the wave.

## Issues Encountered

**Ordering the Task 2 commit before the mutation battery was a deliberate response to 01-05's near-miss.** That plan was interrupted with a mutation still applied to `types.ts`, and it came within one unexamined merge of shipping an erased type parameter. The only thing that distinguished the probe from an intended edit was prose in a *test* file.

Two concrete practices followed from it here:

1. **Both source files were committed before the first mutant ran.** An untracked file has no `git checkout --` restore, so had `actions.test-d.ts` still been untracked, a restore would have been a manual re-edit — the exact fragility that failed last time. With everything committed, `git status --porcelain` returning empty is a *complete* statement that no mutation is applied.
2. **Each mutant was applied, measured, and restored inside one tool call**, with `git diff --exit-code` asserted immediately after. The mutation never crossed a boundary where an interruption could strand it. All five restores were verified clean, 5/5.

**A smaller, recurring hazard also showed up twice in this plan:** a comment that asserts a fact the compiler does not check goes stale silently (Deviations 2 and 3). Both instances were self-inflicted and caught by running the acceptance greps rather than trusting the prose. Worth carrying forward: if a comment states a count or a line number, some check should be able to falsify it.

## Verification Results

| Check | Result |
|---|---|
| `pnpm --filter @fullselfbrowsing/concierge typecheck` | exit **0** |
| `pnpm typecheck` (repo root) | exit **0** |
| M3 non-zero with TS2322 (comparator) + TS2344 (`_snapshotInferred`) | **yes** — 3 errors |
| M7 non-zero with TS2339 + TS2578 | **yes** — 3 errors |
| M8 non-zero with TS2344 (`_handlerAck`) | **yes** — exactly 1 error |
| M9 non-zero with TS2578 on `_policyDegraded` | **yes** — exactly 1 error |
| M10 non-zero with **two** TS2344s (`_nameNotWidened`, `_snapshotInferred`) | **yes** — exactly 2 errors |
| `_requiresIsString` silent under M10 | **yes** — correct, not a hole |
| TS9010 observed on `const confirm` under an exported probe, probe removed | **yes** — exit 2, 1 error |
| `types.ts` restored clean after every mutant | **yes**, 5/5 (`git diff --exit-code`) |
| Every mutant diagnostic carried its alias on the echoed line | **yes**, 5/5 |
| `test -z "$(grep -l '^[[:space:]]*export' test-d/*.test-d.ts)"` | exit **0** across all four files |
| `ActionHandler<Args, Bridge, Snapshot = unknown, AckPayload = unknown>` | line **294** |
| `ack?: ConsentAck<Snapshot, AckPayload>` | line **305** |
| `ActionDefinition` declares five type parameters | line **710** |
| `handler: ActionHandler<InferOutput<Schema>, Bridge, Snapshot, AckPayload>` | line **742** |
| `readsUntrusted?: boolean` a direct member, absent from `SideEffects` | **780** / absent |
| `consent?: ConsentPolicy<Snapshot>` | line **781** |
| `export type AnyActionDefinition<Bridge = unknown>` with `any` in both positions | line **818** |
| `StageDefinition.actions` / `ConciergeConfig.crossStage` erased | **880** / **1042** |
| `SideEffects` still declares exactly 3 members | **yes** |
| Cut fields outside comments (`maxPerTurn\|conflictsWith\|impact?:`) | **0** |
| `ConsentPolicy` one type parameter, `requires: string`, function-property syntax | **yes** (355 / 369 / 399) |
| `readsUntrusted` doc names SEC-05 and Phase 3 | **yes** |
| All seven named aliases present | **yes** |
| `_nameNotWidened` / `_snapshotInferred` read `typeof confirm` (inferred) | **yes** |
| Two actions with different `Snapshot` types in one `StageDefinition.actions`, no cast | **yes** |
| `defineAction` is a non-exported `declare function` with no body | line **91** |
| `@ts-expect-error` count in `actions.test-d.ts` | **2** |
| `actions.test-d.ts` line count (min 60) | **259** |
| `git diff --exit-code pnpm-lock.yaml` | exit **0** |
| File deletions across both commits | **none** |
| `.planning/STATE.md`, `.planning/ROADMAP.md` in diff | **none** |
| Working tree clean before SUMMARY | **yes** |

## Threat Model Compliance

| Threat ID | Disposition | Status |
|---|---|---|
| T-01-18 | mitigate | **Closed.** `snapshotEquality` is typed against the action's real snapshot. A comparator over `unknown` no longer typechecks into a declared action. Both detectors observed: `_snapshotInferred` (M3) and `_policyDegraded` (M9). |
| T-01-19 | mitigate | **Closed.** Both type arguments are forwarded. M8 proved `_handlerAck` is the *sole* detector — one error in the whole repository — which is why it was purpose-built rather than assumed covered. |
| T-01-20 | **transfer — stated, not mitigated** | `readsUntrusted` ships as a field and a type test. **Nothing reads it; the gate is SEC-05, Phase 3.** The doc comment says so in as many words, so the field cannot be mistaken for a control. |
| T-01-21 | mitigate | **Closed.** Sibling placement, asserted in both directions (`_readsUntrustedOnDefinition` + the `SideEffects` negative); M7 fires TS2339 **and** TS2578, plus a third from the declaration fixture. |
| T-01-22 | **accept** | One `any` enters the public surface, in one exported alias, with a doc comment stating the tradeoff and naming D-12 item 2. Concrete `Snapshot` still lives on every individual declaration. Revisit in Phase 8. |
| T-01-35 | mitigate | **Closed.** M10 was run as the plan's exact mutation and caught by `_nameNotWidened` + `_snapshotInferred`. `_requiresIsString` stayed silent, was left alone, and its silence is recorded above as correct so no one remediates a working suite at the phase gate. |
| T-01-SC | accept | **No packages installed.** The only pnpm invocation was `install --frozen-lockfile`, which forbids resolution and left the lockfile byte-identical. |

**No new threat surface.** Type declarations, doc comments, and one non-emitting test file. No runtime code path added.

## Known Stubs

None in this plan's artifacts — every declaration is a complete type.

Three **deliberate** gaps the verifier should not mistake for incompleteness:

1. **`readsUntrusted` is inert in Phase 1 by design.** SEC-05 (Phase 3) is the gate. Documented on the field itself.
2. **`AnyActionDefinition` is exported from `types.ts` but not yet re-exported from `src/index.ts`.** That is 01-08's export-debt task; every new type from plans 01-02 onward is in the same state.
3. **`defineAction` exists only as a `declare function` in the test file.** Phase 3 owns the real one. It has no runtime body and is not exported.

## Next Phase Readiness

The declaration chain is now threaded end to end: `ActionDefinition` → `ActionHandler` → `ConsentAck` → `ConsentPolicy`, with `Snapshot` and `AckPayload` reaching every member that needs them, and 01-05's `_commonPayload` guaranteeing the last hop.

Three things to carry forward:

1. **`AnyActionDefinition` must be added to `src/index.ts` in 01-08.** It is referenced from the public surface by two fields, so omitting it would leave `StageDefinition` and `ConciergeConfig` unusable by name from outside the package.
2. **Plan 09's battery should expect M8 and M9 to produce exactly ONE error each.** Both were measured here. If either produces more, an assertion has been added since — see the considered-and-declined note above, which is the most likely source and is the decision Plan 09 should make.
3. **The `any` in `AnyActionDefinition` is scheduled for review in Phase 8**, against a real kernel, where the cost of `never`-erasure becomes measurable rather than predicted.

## Self-Check: PASSED

- `packages/concierge/src/types.ts` — FOUND
- `packages/concierge/test-d/actions.test-d.ts` — FOUND
- `.planning/phases/01-type-surface-completion/01-06-SUMMARY.md` — FOUND
- Commit `b8e6e69` (Task 1) — FOUND in git log
- Commit `b4f1807` (Task 2) — FOUND in git log
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — exit 0
- `pnpm typecheck` (root) — exit 0
- `git status --porcelain` clean of unintended source modifications
- `.planning/STATE.md` and `.planning/ROADMAP.md` absent from the diff against base `5251c26`

---
*Phase: 01-type-surface-completion*
*Completed: 2026-07-28*
