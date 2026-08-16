---
phase: 01-type-surface-completion
plan: 15
subsystem: type-surface
gap_closure: true
closes: []
tags: [mutation-testing, phase-gate, re-gate, type-tests, handoff]
requires: ["01-10", "01-11", "01-12", "01-13", "01-14"]
provides:
  - "Measured proof that all ten original Phase 1 detectors still fire against the final surface"
  - "Measured proof that all fourteen code-review escapees are now caught or compile"
  - "Phase 2 pinned-pattern recheck with corrected line numbers for 02-02, 02-04, 02-07, 02-11"
  - "Gap-Closure Validation Map appended to 01-VALIDATION.md"
affects:
  - .planning/phases/02-packaging-build-and-release/02-02-PLAN.md
  - .planning/phases/02-packaging-build-and-release/02-04-PLAN.md
  - .planning/phases/02-packaging-build-and-release/02-07-PLAN.md
  - .planning/phases/02-packaging-build-and-release/02-11-PLAN.md
tech-stack:
  added: []
  patterns:
    - "apply/observe/restore inside a single tool call, with a no-op assertion on the mutation itself"
    - "tsc --pretty is mandatory: non-pretty output omits the echoed source line carrying the guard alias"
    - "/tmp sandbox for exploit programs, so no probe file ever enters the typecheck program"
key-files:
  created: []
  modified:
    - .planning/phases/01-type-surface-completion/01-VALIDATION.md
decisions:
  - "M1 restated single-axis against the FLAT ActionResult that 01-13 shipped (option-b); TS2375 correctly does not fire and a supplementary two-axis run proved the TS2375 detector intact"
  - "Reported the plan's own stale predictions (TS2375 on M1, 'two' capability literals on M6, naive-grep count of 4) rather than rounding observations to them"
metrics:
  duration: ~70 min
  completed: 2026-07-28
  mutations_run: 24 (+2 supplementary)
  tasks: 3
  files_changed: 1
  commits: 2
---

# Phase 1 Plan 15: Gap-Closure Re-Gate Summary

**24 mutations run against the final type surface — 10 original detectors all still fire, all 14 code-review escapees flipped, and Phase 2's six pinned patterns survived with only prose line numbers stale.**

This plan closed no finding of its own (`closes: []` is deliberate). It is the gate that proves collectively what plans 01-10 through 01-14 each proved individually against five different partially-fixed trees.

---

## Bootstrap and preconditions

The worktree spawned at `e4e353f` — **behind** the required base — so the sanctioned
`<worktree_branch_check>` reset to `a70a4b7` fired. This mattered more than usual: without it every
"CAUGHT" row below would have been measured against a tree missing all five fixes. After the reset,
all five predecessor invariants were verified **before** any battery work:

| Invariant | Expected | Observed |
|---|---|---|
| comment-filtered `readonly` count in `types.ts` | 26 | **26** ✅ |
| `grep -c 'Record<string, never>'` | 0 | **0** ✅ |
| `grep -c 'challenge?: ServerChallenge;'` | 1 | **1** ✅ |
| `grep -c 'Readonly<ActionResult>'` | 0 | **0** ✅ |
| `grep -c 'USER_CANCELLED: Readonly<{'` | 1 | **1** ✅ |

All five SUMMARYs 01-10…01-14 present. `pnpm install --frozen-lockfile --prefer-offline` run as
bootstrap (fresh worktree, no `node_modules`); `pnpm-lock.yaml` byte-identical afterwards. Baseline
`tsc -p tsconfig.test-d.json` exits **0**. TypeScript **5.9.3**, matching `01-VALIDATION.md`.

**Method.** Every mutation applied, observed, and restored inside a **single** Bash call via
`/tmp/gapgate/run-mutant.sh`, which refuses to start on a dirty tree, aborts if the `perl`
substitution was a **no-op** (a silent no-op would turn an escapee into a fake CAUGHT), and asserts
`TREE_CLEAN` after restoring. All runs used `--pretty`; the plain `tsc` output omits the echoed
source line, which is exactly where the guard alias lives. The five exploit programs and the one
positive ran in a `/tmp` sandbox so no probe file ever entered the typecheck program.

---

## Battery 1 — Phase 1's original ten mutants, re-run against the final surface

Exit codes are the **true `tsc` exit** (2). `pnpm` rewrites this to 1, so `tsc` was invoked directly.

| ID | Edit applied | Exit | Diagnostics | Guards echoed | Result |
|---|---|---|---|---|---|
| **M1** | `reason?: ReasonCode \| undefined` → `string \| undefined` (single-axis; flat `ActionResult` per 01-13) | 2 | 2×TS2344, 1×TS2578, 1×TS2322 | `_reasonClosed` (results:35), `_onMissingShape` (actions:242), TS2578 directive (results:55), `_never` exhaustiveness arm (results:87) | CAUGHT |
| **M2** | `ToolBatch.deferUntilDelivered` → bare-id effect | 2 | 2×TS2344, 1×TS2322 | `_batchHook` (transport:48), `_batchRejectsBareId` (transport:56) | CAUGHT |
| **M3** | `ActionDefinition.consent` drops `<Snapshot>` | 2 | 1×TS2344, 2×TS2322 | `_snapshotInferred` (actions:202) + comparator TS2322 at actions:195 and :348 | CAUGHT |
| **M4** | `ConsentAck` flattened to one intersection, **`readonly` kept on every member** | 2 | 1×TS2344, 1×TS2322 | `_attestedNeedsHash` (consent:280); TS2322 in the narrowing fn (consent:316) | CAUGHT |
| **M5** | `ReadbackSink` → defaulted generic alias | 2 | 1×TS2344, 1×TS2578 | `_sinkShape` (consent:163); TS2578 on the directive at consent:168 guarding `_sinkTakesNoTypeArgs` (:169) | CAUGHT |
| **M6** | `userTurnIdentity` → `boolean`, `readonly` kept | 2 | 2×TS2344, 4×TS2322 | `_provenanceNotBoolean` (transport:86), `_capsProvenanceIsReadonly` (transport:136); capability literals at :95, :103, :156, :175 | CAUGHT |
| **M7** | `readsUntrusted` moved into `SideEffects` | 2 | 1×TS2339, 1×TS2578, 1×TS2353 | `_readsUntrustedOnDefinition` (actions:323); TS2578 on the `SideEffects` directive (actions:332) | CAUGHT |
| **M8** | `handler` back to two type arguments | 2 | 1×TS2344 | `_handlerAck` (actions:277) — the **sole** diagnostic in the repository | CAUGHT |
| **M9** | `snapshotEquality` → method syntax | 2 | 1×TS2578 | directive at actions:162, inside `_policyDegraded` (declared actions:159) | CAUGHT |
| **M10** | `ConsentPolicy<Snapshot, Name extends string = string>` with `requires: Name`, threaded through `consent` | 2 | 2×TS2344 | `_nameNotWidened` (actions:199), `_snapshotInferred` (actions:202) | CAUGHT |

**All ten produced a non-zero exit and every guard listed in its own row fired.** No gap-closure fix
disarmed an existing detector (T-01-57 discharged).

### The two deliberate expected-silences — recorded as CORRECT, not as misses

- **M4 did not fire TS2578.** No suppression directive becomes unused when `ConsentAck` flattens.
  Confirmed silent. This is the standing 2026-07-28 correction in `01-VALIDATION.md`, re-verified.
- **M10 did not fire `_requiresIsString`.** `ConsentPolicy<Booking>["requires"]` is still `string`
  once `Name` carries its `= string` default. Confirmed silent; `_nameNotWidened` and
  `_snapshotInferred` are M10's real detectors.

Neither is a hole and neither was "fixed" (T-01-36).

---

## Correction: M1's TS2375 prediction is stale, and the detector is nevertheless intact

`01-VALIDATION.md` predicts M1 yields "5 errors incl. TS2578, TS2322 on the `never` arm, **TS2375 on
the computed idiom**". Measured: **4 errors and no TS2375.**

This is not a regression — it is the single-axis discipline the plan itself mandates. Plan 01-12
(WR-02) added the explicit `| undefined` to `reason`, which split what used to be one axis into two:
the *closedness* of the union, and the *`exactOptionalPropertyTypes` widening*. A faithful
single-axis M1 mutates only the first, so the TS2375 detector is correctly not exercised.

To prove the detector still exists rather than assume it, a supplementary **M1b** ran the literal
01-09-era two-axis mutation (`reason?: string`, dropping `| undefined`):

| ID | Exit | Diagnostics | Guards |
|---|---|---|---|
| **M1b** | 2 | 3×TS2344, 1×TS2375, 1×TS2578, 1×TS2322 | adds `_computedReasonAssigns` (**TS2375**, results:97) and `_reasonAdmitsUndefined` (results:48) |

**The TS2375 detector is alive.** `01-VALIDATION.md`'s M1 row should be read as describing the
two-axis mutation; the single-axis form is the correct one to run post-01-12.

---

## Battery 2 — the code review's fourteen escapees, re-run collectively

IDs are **the reviewer's, unsuffixed** (`01-REVIEW.md`), per the plan's namespace mapping. The
`-SRC` suffixed IDs belonging to 01-10/01-11 have the opposite meaning and were **not** re-run here.

| ID | Mutation | Reviewer's result | This run | Verdict |
|---|---|---|---|---|
| **MUT-A** | exploit: `ack.grade = "attested"`, then read `readbackHash` under the narrowing | ESCAPED (CR-01) | exit 2 — **1×TS2540** on the write | **FLIPPED → CAUGHT** |
| **MUT-B** | exploit: overwrite `snapshot`, `payload`, `userTurnId` in place | ESCAPED (CR-01) | exit 2 — **3×TS2540** | **FLIPPED → CAUGHT** |
| **MUT-C** | positive: `BridgeRegistry<ResultsBridge>` + two concrete-bridge stages in one `ConciergeConfig` | **BROKEN TODAY** (CR-02) | **exit 0**, zero diagnostics, comment-filtered cast count **0** | **FLIPPED → COMPILES** |
| **MUT-D** | exploit: `capabilities.userTurnIdentity` / `.consentGrade` upgraded in place | ESCAPED (WR-01) | exit 2 — **2×TS2540** | **FLIPPED → CAUGHT** |
| **MUT-E** | exploit: `r.outcome = "completed"` on a `DeliveryReport` | ESCAPED (WR-01) | exit 2 — **1×TS2540** | **FLIPPED → CAUGHT** |
| **MUT-F** | exploit: `rc.hash = …` and `rc.canonical[0] = 0` | ESCAPED (WR-01) | exit 2 — **TS2540** on hash **+ TS2542** on the element write | **FLIPPED → CAUGHT** |
| **MUT-G** | `ConsentAckBase.userTurnId` → optional | ESCAPED (WR-07) | exit 2 — 2×TS2344: `_ackCarriesTurnIdentity` (consent:405), `_ackTurnIdIsReadonly` (consent:359) | **FLIPPED → CAUGHT** |
| **MUT-H** | `DeliveryReport.outcome` → `string` | ESCAPED (WR-07) | exit 2 — 2×TS2344: `_deliveryOutcomeIsClosed` (transport:73), `_deliveryOutcomeIsReadonly` (transport:130) | **FLIPPED → CAUGHT** |
| **MUT-I** | `ConsentPolicy.bindTo` → `string` | ESCAPED (WR-04) | exit 2 — TS2344: `_bindToIsClosed` (actions:225) | **FLIPPED → CAUGHT** |
| **MUT-J** | `ReadbackReceipt.canonical` → `unknown` | ESCAPED (WR-05) | exit 2 — 2×TS2344: `_receiptCanonicalIsBytes` (consent:106), `_receiptCanonicalIsReadonly` (consent:382) | **FLIPPED → CAUGHT** |
| **MUT-K** | `ActionHandler` ctx `bridge: B \| null` → `B` | ESCAPED (WR-03) | exit 2 — TS2344: `_handlerBridge` (actions:297) | **FLIPPED → CAUGHT** |
| **MUT-L** | `BridgeRegistry.read: () => B \| null` → `() => B` | ESCAPED (WR-03) | exit 2 — TS2344: `_registryReadIsNullable` (actions:429) | **FLIPPED → CAUGHT** |
| **MUT-M** | `ActionResult.ok` → optional | ESCAPED (WR-07) | exit 2 — TS2344: `_resultOkRequired` (results:173) | **FLIPPED → CAUGHT** |
| **MUT-N** | `ActionResult.message` → optional | ESCAPED (WR-07) | exit 2 — 2×TS2344: `_resultMessageRequired` (results:176), `_onMissingShape` (actions:242) | **FLIPPED → CAUGHT** |

**Every one of the fourteen rows flipped. No unclosed finding.**

### The two rows that carried the most weight

- **MUT-F produced TS2542** — *"Index signature in type `Readonly<Uint8Array<ArrayBufferLike>>` only
  permits reading."* This is the criterion that distinguishes `Readonly<Uint8Array>` from a bare
  `readonly canonical: Uint8Array`. Had it been absent, the element-write hole would still be open
  under a field whose doc comment promises the bytes are the exact ones that were hashed.
- **MUT-A + MUT-B combined** were also run as a single six-write exploit (`grade`, `snapshot`,
  `payload`, `userTurnId`, `responseId`, `challenge`) and produced **exactly 6 × TS2540** —
  reproducing the reviewer's measured count for the CR-01 fix.

**MUT-C's no-cast claim** was checked with the comment-filtered form
(`grep -v '^[[:space:]]*[*/]' | grep -v '^[[:space:]]*//' | grep -cE '\bas\b'`) → **0**. The probe
uses `CLAUDE.md`'s canonical `applyFilter({key, value})` shape and a second unrelated `CartBridge`,
collected into one `ConciergeConfig`.

---

## Phase 2 pinned-pattern recheck — plans 02-02, 02-04, 02-07, 02-11

Phase 2's harness (`scripts/mutate-and-prove.sh`, built by 02-02) matches by **pattern, not line
number**, and its exit code `3` means *pattern never matched* — an abort that reads nothing like a
caught mutant. **All six pinned patterns still match verbatim, so no Phase 2 mutant will abort.**

| # | Pinned pattern | Plan | Prose claims | Actual now | Matches |
|---|---|---|---|---|---|
| 1 | `export const MESSAGE_MAX_CHARS = 180;` | 02-02 (:104), 02-04 (P4) | line **206** | line **279** | ✅ verbatim |
| 2 | `  snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean;` (two leading spaces) | 02-11 (:179, :245, P9) | line **399** | line **518** | ✅ verbatim, whitespace included |
| 3 | The frozen-constants read-only window | 02-07 (:246) | lines **182–206** | lines **221–279** | ✅ `USER_CANCELLED` :239, `USER_DECLINED` :261, `MESSAGE_MAX_CHARS` :279 |
| 4 | `  MESSAGE_MAX_CHARS,` then `} from "./types.js";` | 02-07 (P11) | *(uniqueness)* | lines **69–70**, **occurs exactly once** | ✅ verbatim |
| 5 | `  SessionConfig,` → end of the `./types.js` value block | 02-11 (P8) | lines **62–70** | lines **62–70, unmoved** | ✅ verbatim |
| 6 | `CONSENT_GRADE_ORDER` frozen array contents | 02-07 (:246, :315) | lines **348–354** | lines **467–472** | ✅ four elements, order unchanged |

**Nothing is a blocking handoff — every pattern matched.** What *is* stale is prose:

- **02-02 line 104** and **02-04 P4** say `MESSAGE_MAX_CHARS` is at **line 206**. It is at **279**.
- **02-04 line 156** gives a read window of **lines 194–210**. The declaration plus its doc comment
  now spans **267–279**.
- **02-11 lines 179 and 245** say `snapshotEquality` is at **line 399**. It is at **518**.
- **02-07 line 246** gives **lines 182–206 and 348–354**. These are now **221–279** and **467–472**.

Cumulative drift is **+73** at `MESSAGE_MAX_CHARS` and **+119** at `snapshotEquality`. 02-07's
read-only window must be **re-derived from the patterns**, not renumbered by hand.

### One additional handoff note for 02-11

02-11's P9 `<automated>` greps for `TS2344` and a guard named **`_policyNotBivariant`**. That alias
**does not exist in the suite today** — 02-11 Task 2 creates it. Measured against the *current*
suite, the same P9 mutation (run here as M9) produces **TS2578 on `_policyDegraded`**, not TS2344.
This is consistent with 02-11 authoring the new guard and is **not** a defect, but an executor who
runs P9 before 02-11 Task 2 lands will see a diagnostic that does not match the verify string.

---

## Export surface — proven untouched, ref-pinned

`src/index.ts` was off-limits for the whole gap-closure sequence, because any change invalidates
02-07/P11 and 02-11/P8 simultaneously with a silent exit 3. Both required checks pass:

- `git diff --exit-code 8c5b1a3 -- packages/concierge/src/index.ts` → **exit 0** (content identical)
- `git log --oneline 8c5b1a3..HEAD -- packages/concierge/src/index.ts` → **empty** (no commit in the
  range touched it, so a change-and-revert is excluded too — T-01-51)

`8c5b1a3` resolves to *"chore: merge executor worktree (01-09 phase gate)"*. Exported names:
**43** = the verifier's 42 plus `StandardSchemaV1`, unchanged.

---

## Deviations from Plan

No source file was changed by this plan. The deviations below are **corrections to the plan's own
predictions**, reported rather than absorbed.

**1. [Observation] M1's predicted TS2375 does not fire, and that is correct.**
Covered in full above. Root cause: 01-12 split one axis into two. Supplementary M1b proved the
`_computedReasonAssigns` TS2375 detector intact.

**2. [Observation] M6 produces four capability-literal errors, not "two".**
The plan predicts "errors on the two capability literals". Measured **four** (transport:95, :103,
:156, :175) — 01-14 added further literals. A higher count, which the plan explicitly anticipates.

**3. [Observation] Four Battery-1/2 mutants produce a *bonus* second guard.**
`_capsProvenanceIsReadonly` (M6), `_ackTurnIdIsReadonly` (MUT-G), `_deliveryOutcomeIsReadonly`
(MUT-H), `_receiptCanonicalIsReadonly` (MUT-J). These are 01-10's `Pick`-shaped pins, which carry
**both** the modifier axis and the value-type axis — the same effect 01-14's SUMMARY recorded when
it found four of its ten mutations already caught. Recorded, not treated as noise.

**4. [Correction] The plan's naive-grep figure is stale.**
The plan states that `grep -c ' as '` "returns 4 on the untouched `actions.test-d.ts`". Measured
today it returns **10** — the file grew through 01-10…01-14. The plan's *point* is unaffected and
correct: the naive form counts English prose and is unsatisfiable; the comment-filtered form returns
**0**.

**5. [Method note] `cp -R` of pnpm's `@standard-schema` produced a false-red sandbox.**
pnpm links `node_modules/@standard-schema/spec` as a symlink into the store. BSD `cp -R` preserves
it as a dangling link, so the first sandbox baseline failed with TS2307 plus one **cascade** TS2344
in `actions.test-d.ts`. `cp -RL` is required. Worth recording because that cascade error looked
exactly like a real escapee.

**6. [Environment] The worktree spawned behind the required base.**
`e4e353f`, not `a70a4b7`. The sanctioned reset fired and all five predecessor invariants were
re-verified before any mutation ran.

No Rule 4 architectural decisions arose. No package installs were attempted.

---

## Hygiene — the mutation-residue guarantee

`types.ts` is **byte-identical to the base commit**, proven directly:

```
git diff --exit-code a70a4b7 -- packages/concierge/src/types.ts   → exit 0
```

`git status --porcelain` was empty before Battery 1, between the batteries, after Battery 2, and
after sandbox removal. Every one of the 26 runs printed `TREE_CLEAN`. No probe file ever entered the
repository; the sandbox lived in `/tmp` and was deleted. This plan's own must-have — *"the type
surface is left byte-identical to how plan 01-14 committed it"* — is met (T-01-58).

## Full automated verify chain (Task 3)

```
pnpm typecheck && pnpm --filter @fullselfbrowsing/concierge exec tsc -p tsconfig.json
  && ls -R packages/concierge/dist | grep -c "test-d\|_assert" | grep -qx 0
  && rm -rf packages/concierge/dist
  && git diff --exit-code 8c5b1a3 -- packages/concierge/src/index.ts
  && test -z "$(git log --oneline 8c5b1a3..HEAD -- packages/concierge/src/index.ts)"
  && git diff --exit-code pnpm-lock.yaml
  && grep -q "Gap-Closure Validation Map" .../01-VALIDATION.md
  && echo GAP_GATE_PASS
```

**Result: `GAP_GATE_PASS`.** Root `pnpm typecheck` exits 0; the real build emits only
`index.{js,d.ts}` / `types.{js,d.ts}` (+ maps) with **zero** `test-d`/`_assert` artifacts (T-01-30);
`dist` removed; `pnpm-lock.yaml` unchanged — the gap-closure sequence added **zero** dependency
edges (T-01-SC).

## Validation map

`01-VALIDATION.md` gained an appended `## Gap-Closure Validation Map` — **78 insertions, 0
deletions**. The `status: complete` / `nyquist_compliant: true` frontmatter and the original
sign-off are unchanged, and `grep -c '^| 01-0'` still returns **19**: every new task ID begins
`01-1`, so the phase gate's row-count command is unaffected **by construction**.

---

## What this sequence establishes — and what it does not

It establishes two measured things: **fourteen specific mutations that escaped an independent
adversarial review are now caught by named guards**, and **all ten of Phase 1's prior detectors
still fire**, so no gap-closure fix bought coverage by costing coverage.

It does **not** establish that no further uncovered surface exists. The reviewer found fourteen
escapees against a suite that had already survived nineteen mutations and two independent
verification passes. Running fourteen more does not prove there is no fifteenth. **A battery
measures only the surface it was written for.** That is the accepted residual (T-01-65), stated
plainly rather than resolved — a second false all-clear would be strictly worse than a disclosed
limit.

One substantive item remains open and is **not** closed by this plan: **WR-06 was resolved as
`option-b` by the execute-phase orchestrator, not by the user.** 01-13's `<human-check>` required a
user selection and is not satisfied as written. The flat `ActionResult` is what shipped and what M1,
MUT-M and MUT-N were measured against, but the ratification is still outstanding.

---

## Self-Check: PASSED

| Claim | Check | Result |
|---|---|---|
| `01-VALIDATION.md` carries the appended section | `grep -q "Gap-Closure Validation Map"` | ✅ found |
| Original frontmatter unchanged | `head -8` shows `status: complete`, `nyquist_compliant: true` | ✅ |
| Original rows intact | `grep -c '^| 01-0'` | ✅ 19 |
| Append is purely additive | `git diff --numstat` | ✅ 78 insertions, 0 deletions |
| `types.ts` byte-identical to base | `git diff --exit-code a70a4b7 -- .../types.ts` | ✅ exit 0 |
| `index.ts` ref-pinned clean | content diff + `git log` range vs `8c5b1a3` | ✅ both pass |
| Lockfile untouched | `git diff --exit-code pnpm-lock.yaml` | ✅ exit 0 |
| Root typecheck green | `pnpm typecheck` | ✅ exit 0 |
| Gate chain | full Task 3 chain | ✅ `GAP_GATE_PASS` |
| Commit `5bd2f52` exists | `git log --oneline` | ✅ found |
| No forbidden file touched | `git diff --stat a70a4b7..HEAD` | ✅ only `01-VALIDATION.md` + this SUMMARY |

`README.md`, `CLAUDE.md`, `STATE.md`, `ROADMAP.md`, `01-CONTEXT.md`, `src/index.ts`, and every
`test-d/` file are **unmodified** — confirmed by the commit-range diff. `STATE.md` and `ROADMAP.md`
were deliberately left to the orchestrator, per the plan brief.
