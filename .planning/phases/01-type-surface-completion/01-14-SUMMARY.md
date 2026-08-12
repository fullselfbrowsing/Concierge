---
phase: 01-type-surface-completion
plan: 14
subsystem: types
tags: [typescript, type-tests, mutation-testing, consent-policy, readback-receipt, doc-accuracy]

# Dependency graph
requires:
  - phase: 01-10
    provides: the readonly consent surface — and, unexpectedly, the four `Pick`-shaped pins that already catch MUT-G, MUT-H, MUT-J and MUT-J2, which this plan measured rather than assumed
  - phase: 01-11
    provides: the Bridge defaults this plan left untouched (`Record<string, never>` count 0)
  - phase: 01-12
    provides: the EOPT `| undefined` on `ActionResult.reason`, which `_onMissingShape`'s literal right-hand side has to spell out
  - phase: 01-13
    provides: the flat `ActionResult` that `_resultOkRequired`, `_resultMessageRequired` and `_onMissingShape` are written against, and the `--pretty` finding this battery depends on
provides:
  - ten named guards across four test files, every one observed red under a mutation
  - the first member-level assertions `ConsentPolicy` has ever had, plus a closed key set modelled on `_transportKeys`
  - complete predicate coverage of all four `ReadbackReceipt` fields
  - a `RedactionPolicy` doc comment that describes the required member that shipped
  - a measured correction to the plan's escape claims for four of ten mutations
affects: [phase-2-mutation-harness, phase-3-declaration-validation, phase-8-consent-kernel, 01-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A pin whose right-hand side is spelled out literally detects a change *inside* the type its left-hand side is derived from; a pin expressed through the same alias on both sides cannot. Proven empirically here, not by inspection — MUT-N (a change inside `ActionResult`) fires `_onMissingShape`."
    - "A `Pick`-shaped readonly pin that spells its value type out also catches a widening of that value type, so a `readonly` guard can silently double as a closed-union guard — which makes 'this mutation escapes' a claim with a shelf life."

key-files:
  created:
    - .planning/phases/01-type-surface-completion/01-14-SUMMARY.md
  modified:
    - packages/concierge/src/types.ts
    - packages/concierge/test-d/actions.test-d.ts
    - packages/concierge/test-d/consent.test-d.ts
    - packages/concierge/test-d/results.test-d.ts
    - packages/concierge/test-d/transport.test-d.ts

key-decisions:
  - "A pre-flight escape measurement was run against the untouched base before any guard was added, because the plan asserts ten times that a mutation 'exits 0 against the suite as it stands today'. Six do. Four do not — 01-10's readonly pins already catch them — and that is reported as measured rather than rounded to the plan's prediction."
  - "`_deliveryOutcomeIsClosed` was added anyway despite `_deliveryOutcomeIsReadonly` already catching MUT-H, and the comment says why: two invariants, two names, and the one a reader looks up under 'closed' should not be spelled 'readonly'."
  - "IN-01's divergence with SEC-01 is handed off, not resolved here. `CLAUDE.md:21` carries the same claim and is FLAGGED, not edited — project instruction files are not this plan's to change."

requirements-completed: []

# Metrics
duration: 28min
completed: 2026-07-28
---

# Phase 01 Plan 14: Ten Guards for Four Unguarded Contracts Summary

**`ConsentPolicy` — the consent gate's own declaration — had no member-level assertion anywhere in the suite, so `bindTo: string` typechecked and a `bindTo: "usreTurn"` typo could pick the weak gate or none; it now has four pins including a closed key set, the receipt's last two fixture-only fields have predicates, the ack's turn identity, the delivery outcome and both required `ActionResult` members each have a detector, and the redaction policy's doc comment stopped promising a default the type cannot have — with all ten guards watched failing, and the plan's claim that all ten mutations escape today corrected to six after measurement.**

## Performance

- **Duration:** ~28 min
- **Tasks:** 3 (all auto, no checkpoints)
- **Files modified:** 5 — `+142 / −5` against base `c190e14`
- **Mutations run:** 20 (10 pre-flight against the untouched base, 10 post-guard)

## Task Commits

1. **Task 1: Reword the `RedactionPolicy` doc comment (IN-01)** — `f647eb1` (docs)
2. **Task 2: Pin `ConsentPolicy`'s members and the receipt's last two fields (WR-04, WR-05)** — `8091b72` (test)
3. **Task 3: Pin the four required/closed contracts with no assertion anywhere (WR-07)** — `c5f5b10` (test)

## Accomplishments

- **WR-04 closed.** `ConsentPolicy` gained the first member-level assertions it has ever carried:
  `_bindToIsClosed`, `_minGradeIsGrade`, `_onMissingShape`, `_policyKeys`. Before them, `bindTo:
  "userTurn" | "response"` → `bindTo: string` exited **0** against the full four-file suite —
  measured here, not inherited from the review. `_snapshotInferred` is untouched and byte-identical:
  the finding was that it is insufficient, not that it is wrong.
- **WR-05 closed.** `_receiptHashIsString` and `_receiptCanonicalIsBytes` complete predicate coverage
  of all four `ReadbackReceipt` fields. `_receiptCanonicalIsBytes` names `Readonly<Uint8Array>` —
  read from the shipped declaration (`types.ts:737`), not assumed from a bare `Uint8Array`.
- **WR-07 closed.** `_ackCarriesTurnIdentity`, `_deliveryOutcomeIsClosed`, `_resultOkRequired`,
  `_resultMessageRequired`.
- **IN-01 closed.** The `RedactionPolicy` doc block now describes the required member that shipped.
- **`_onMissingShape`'s literal right-hand side is proven, not merely grepped.** MUT-N — making
  `ActionResult.message` optional, a change *inside* `ActionResult` — fires `_onMissingShape`. A
  right-hand side routed back through `ActionResult` could not have fired there. See the finding
  below; this is stronger evidence than the plan asked for.
- **Ten guards, ten mutations, ten observed reds**, each with the `--pretty` echoed source line
  carrying the alias name. Every mutation applied, observed and restored **inside a single Bash tool
  call**, each with a no-op assertion before the result was trusted.

## Files Created/Modified

| File | Lines | Change |
|---|---|---|
| `packages/concierge/src/types.ts` | 1520 → **1537** | `+19 / −2`, comment lines only |
| `packages/concierge/test-d/actions.test-d.ts` | 496 → **541** | `+45 / −0` (2 import lines, 4 pins, 1 block comment) |
| `packages/concierge/test-d/consent.test-d.ts` | 375 → **405** | `+33 / −3` (3 pins; the 3 removed lines are the reworded fixture note) |
| `packages/concierge/test-d/results.test-d.ts` | 148 → **176** | `+28 / −0` (2 pins) |
| `packages/concierge/test-d/transport.test-d.ts` | 261 → **278** | `+17 / −0` (1 pin) |

**No pre-existing assertion was modified or deleted in any file.**

## The finding: four of the ten mutations no longer escape, and the plan says they do

The plan states, ten times over, that each mutation "exits 0 against the suite as it stands today"
and calls that "the finding". Before writing a single guard, all ten were run against the untouched
base `c190e14` to check. **Six escape. Four do not.**

| Mutation | Pre-flight exit | Errors | Alias that fired | Plan's claim |
|---|---|---|---|---|
| MUT-I — `bindTo` → `string` | **0** | 0 | — | **correct** |
| MUT-I2 — sixth `ConsentPolicy` member | **0** | 0 | — | **correct** |
| MUT-I3 — `minGrade?: string` | **0** | 0 | — | **correct** |
| MUT-I4 — `onMissing` → `{ message: string }` | **0** | 0 | — | **correct** |
| MUT-J — `canonical` → `unknown` | **2** | 1 | `_receiptCanonicalIsReadonly` | **WRONG** — "Also exits 0 today" |
| MUT-J2 — `hash` → `unknown` | **2** | 1 | `_receiptHashIsReadonly` | **WRONG** (implied by WR-05's framing) |
| MUT-G — `userTurnId` → optional | **2** | 1 | `_ackTurnIdIsReadonly` | **WRONG** — "All four mutations exit 0" |
| MUT-H — `outcome` → `string` | **2** | 1 | `_deliveryOutcomeIsReadonly` | **WRONG** — same sentence |
| MUT-M — `ok` → optional | **0** | 0 | — | **correct** |
| MUT-N — `message` → optional | **0** | 0 | — | **correct** |

**Why the plan is wrong, and it is not sloppiness.** Its escape claims are inherited verbatim from
`01-REVIEW.md`'s 19-mutation battery, which ran against the pre-01-10 tree. Plan 01-10 then added
four `Pick`-shaped readonly pins that spell their value types out on the right-hand side —
`Equals<Pick<DeliveryReport, "outcome">, { readonly outcome: "completed" | "interrupted" }>` and its
three siblings. A pin written to detect a stripped modifier turns out to detect a widened value type
too, because `Pick` carries both axes into one comparison. The four "escaping" mutations were closed
as a side effect of a plan that was about something else, and nobody noticed because nobody re-ran
the battery.

**This does not make the four new guards redundant, and the reason is worth stating.** The pre-existing
pins are named for the wrong invariant. `_deliveryOutcomeIsReadonly` going red tells a reader the
modifier broke; it is not where anyone looks for "the union opened". More concretely, the two axes
separate under single-axis mutation: strip `readonly` alone and only `_deliveryOutcomeIsReadonly`
fires; widen the union alone and both fire, but only `_deliveryOutcomeIsClosed` is *about* what
broke. Each new guard's comment says exactly what it adds that the neighbour does not.

**What Phase 2 should take from this:** an "escapes today" claim has a shelf life measured in plans.
The harness should re-derive escape status at run time rather than carry it in prose.

## Mutation battery — ten mutations, ten observed reds

Every row applied, observed and restored **inside a single Bash tool call**, with
`git diff --quiet … && FATAL` asserting the substitution was not a no-op before any result was
trusted, and `git diff --exit-code` asserting restoration afterward. `TREE_CLEAN` printed on all
twenty runs (10 pre-flight + 10 post-guard). **All three tasks were committed before their batteries
ran**, so an empty `git status --porcelain` is an unambiguous "no mutation applied" signal.

All output captured with `tsc --pretty` — plan 01-13 found that non-pretty output omits the echoed
source line, which is the only place the alias name appears.

### Task 2 battery (WR-04, WR-05)

| Mutation | Exit | Errors | Codes | Aliases tripped | Matches prediction |
|---|---|---|---|---|---|
| **MUT-I** — `bindTo: "userTurn" \| "response"` → `bindTo: string` | 2 | **1** | TS2344 | `_bindToIsClosed` | **yes** |
| **MUT-I2** — sixth member `sixthDial?: number` on `ConsentPolicy` | 2 | **1** | TS2344 | `_policyKeys` | **yes** |
| **MUT-I3** — `minGrade?: ConsentGrade` → `minGrade?: string` | 2 | **exactly 1** | TS2344 | `_minGradeIsGrade` | **yes** — exactly one, as required |
| **MUT-I4** — `onMissing` → `{ message: string }` | 2 | **exactly 1** | TS2344 | `_onMissingShape` | **yes** — exactly one, as required |
| **MUT-J** — `canonical: Readonly<Uint8Array>` → `unknown` | 2 | **2** | TS2344 ×2 | `_receiptCanonicalIsBytes`, `_receiptCanonicalIsReadonly` | **partly** — the required alias fired; the plan did not predict the second |
| **MUT-J2** — `hash: string` → `unknown` | 2 | **2** | TS2344 ×2 | `_receiptHashIsString`, `_receiptHashIsReadonly` | **partly** — same |

### Task 3 battery (WR-07)

| Mutation | Exit | Errors | Codes | Aliases tripped | Matches prediction |
|---|---|---|---|---|---|
| **MUT-G** — `readonly userTurnId: string` → `readonly userTurnId?: string` | 2 | **2** | TS2344 ×2 | `_ackCarriesTurnIdentity`, `_ackTurnIdIsReadonly` | **partly** — required alias fired; second unpredicted |
| **MUT-H** — `outcome: "completed" \| "interrupted"` → `string` | 2 | **2** | TS2344 ×2 | `_deliveryOutcomeIsClosed`, `_deliveryOutcomeIsReadonly` | **partly** — same |
| **MUT-M** — `ok: boolean` → `ok?: boolean` | 2 | **exactly 1** | TS2344 | `_resultOkRequired` | **yes** |
| **MUT-N** — `message: string` → `message?: string` | 2 | **2** | TS2344 ×2 | `_resultMessageRequired`, **`_onMissingShape`** | **exceeds** — see below |

MUT-G is single-axis by construction: `readonly` was **kept** and only optionality changed
(`readonly userTurnId: string` → `readonly userTurnId?: string`, hunk reproduced in the run log).
01-10 owns the `readonly` axis; a mutation changing both would prove neither.

### Guard → mutation mapping (all ten named, explicitly)

| Guard | File:line | Named in |
|---|---|---|
| `_bindToIsClosed` | `actions.test-d.ts:225` | **MUT-I** |
| `_minGradeIsGrade` | `actions.test-d.ts:228` | **MUT-I3** |
| `_onMissingShape` | `actions.test-d.ts:242` | **MUT-I4** and **MUT-N** |
| `_policyKeys` | `actions.test-d.ts:245` | **MUT-I2** |
| `_receiptHashIsString` | `consent.test-d.ts:93` | **MUT-J2** |
| `_receiptCanonicalIsBytes` | `consent.test-d.ts:106` | **MUT-J** |
| `_ackCarriesTurnIdentity` | `consent.test-d.ts:405` | **MUT-G** |
| `_deliveryOutcomeIsClosed` | `transport.test-d.ts:73` | **MUT-H** |
| `_resultOkRequired` | `results.test-d.ts:173` | **MUT-M** |
| `_resultMessageRequired` | `results.test-d.ts:176` | **MUT-N** |

**Every one of the ten was watched failing.** None was added on the strength of a prediction.

### Verbatim diagnostics, with the echoed source line

ANSI stripped for legibility; nothing else altered.

**MUT-I** (exit 2, 1 error):

```
test-d/actions.test-d.ts:225:31 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

225 type _bindToIsClosed = Expect<Equals<ConsentPolicy["bindTo"], "userTurn" | "response">>;
                                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 1 error in test-d/actions.test-d.ts:225
```

**MUT-I2** (exit 2, 1 error):

```
test-d/actions.test-d.ts:245:27 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

245 type _policyKeys = Expect<Equals<keyof ConsentPolicy, "requires" | "bindTo" | "snapshotEquality" | "minGrade" | "onMissing">>;
                              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 1 error in test-d/actions.test-d.ts:245
```

**MUT-I3** (exit 2, exactly 1 error — `_policyKeys` stays green, as the plan required):

```
test-d/actions.test-d.ts:228:32 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

228 type _minGradeIsGrade = Expect<Equals<ConsentPolicy["minGrade"], ConsentGrade | undefined>>;
                                   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 1 error in test-d/actions.test-d.ts:228
```

**MUT-I4** (exit 2, exactly 1 error — `_policyKeys` stays green, the member is still present):

```
test-d/actions.test-d.ts:242:31 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

242 type _onMissingShape = Expect<Equals<ConsentPolicy["onMissing"], { reason?: ReasonCode | undefined; message: string } | undefined>>;
                                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 1 error in test-d/actions.test-d.ts:242
```

**MUT-J** (exit 2, 2 errors):

```
test-d/consent.test-d.ts:106:40 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

106 type _receiptCanonicalIsBytes = Expect<Equals<ReadbackReceipt["canonical"], Readonly<Uint8Array>>>;
                                           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

test-d/consent.test-d.ts:382:43 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

382 type _receiptCanonicalIsReadonly = Expect<Equals<Pick<ReadbackReceipt, "canonical">, { readonly canonical: Readonly<Uint8Array> }>>;
                                              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 2 errors in the same file, starting at: test-d/consent.test-d.ts:106
```

**MUT-J2** (exit 2, 2 errors):

```
test-d/consent.test-d.ts:93:36 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

93 type _receiptHashIsString = Expect<Equals<ReadbackReceipt["hash"], string>>;
                                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

test-d/consent.test-d.ts:371:38 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

371 type _receiptHashIsReadonly = Expect<Equals<Pick<ReadbackReceipt, "hash">, { readonly hash: string }>>;
                                         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 2 errors in the same file, starting at: test-d/consent.test-d.ts:93
```

**MUT-G** (exit 2, 2 errors — optionality changed, `readonly` kept):

```
test-d/consent.test-d.ts:359:36 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

359 type _ackTurnIdIsReadonly = Expect<Equals<Pick<ConsentAck<Booking, { id: string }>, "userTurnId">, { readonly userTurnId: string }>>;
                                       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

test-d/consent.test-d.ts:405:39 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

405 type _ackCarriesTurnIdentity = Expect<Equals<ConsentAck<Booking, null>["userTurnId"], string>>;
                                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 2 errors in the same file, starting at: test-d/consent.test-d.ts:359
```

**MUT-H** (exit 2, 2 errors):

```
test-d/transport.test-d.ts:73:40 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

73 type _deliveryOutcomeIsClosed = Expect<Equals<DeliveryReport["outcome"], "completed" | "interrupted">>;
                                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

test-d/transport.test-d.ts:130:42 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

130 type _deliveryOutcomeIsReadonly = Expect<Equals<Pick<DeliveryReport, "outcome">, { readonly outcome: "completed" | "interrupted" }>>;
                                             ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 2 errors in test-d/transport.test-d.ts:73
```

**MUT-M** (exit 2, exactly 1 error):

```
test-d/results.test-d.ts:173:33 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

173 type _resultOkRequired = Expect<Equals<ActionResult["ok"], boolean>>;
                                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 1 error in test-d/results.test-d.ts:173
```

**MUT-N** (exit 2, 2 errors in 2 files — and the second one is the important one):

```
test-d/actions.test-d.ts:242:31 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

242 type _onMissingShape = Expect<Equals<ConsentPolicy["onMissing"], { reason?: ReasonCode | undefined; message: string } | undefined>>;
                                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

test-d/results.test-d.ts:176:38 - error TS2344: Type 'false' does not satisfy the constraint 'true'.

176 type _resultMessageRequired = Expect<Equals<ActionResult["message"], string>>;
                                         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 2 errors in 2 files.

Errors  Files
     1  test-d/actions.test-d.ts:242
     1  test-d/results.test-d.ts:176
```

### Why MUT-N firing `_onMissingShape` is the strongest single result here

The plan could only ask for a grep: *"`grep -c 'Pick<ActionResult' actions.test-d.ts` returns 0"*, plus
an instruction to re-read the line if MUT-I4 passed. That grep proves the token is absent; it does
not prove the property.

MUT-N proves the property directly. `onMissing` is *declared* as a `Pick` over `ActionResult`, so
`ConsentPolicy["onMissing"]` moves whenever `ActionResult` moves. Making `ActionResult.message`
optional is a change **inside `ActionResult`** — the exact class of change a right-hand side routed
through `ActionResult` is blind to, because it would move identically on both sides and stay true.
`_onMissingShape` went red. The literal right-hand side is therefore load-bearing as measured, not as
asserted.

`grep -c 'Pick<ActionResult' packages/concierge/test-d/actions.test-d.ts` returns **0** as well —
including in the prose, which describes the declared shape as "a `Pick` over {@link ActionResult}"
rather than reproducing the token. That is plan 01-13's lesson applied pre-emptively rather than
after tripping the criterion.

### Working tree after the battery

`git status --porcelain` output, reproduced in full:

```
```

(empty — no mutation left applied, no untracked file created, no scratch file in the tree)

**Method note.** The `/tmp` sandbox idiom offered by the plan was **not** used. All twenty mutations
ran in place against the real working tree with apply/assert-not-a-no-op/observe/restore/assert-clean
in one call each, under a shell `trap` restoring `src/types.ts` on any exit path.

## Phase 3 handoff — SEC-01 diverges from the type that shipped

**This section is the deliverable half of Task 1.** The doc comment was corrected; the requirement
was not, deliberately.

1. **`ActionDefinition.redact` (`types.ts:922`) is a required member with no optionality.** Nothing
   ever defaults. Every action must state a policy explicitly, and a declaration that omits one does
   not typecheck at all. SEC-01's second clause — *"an unspecified policy defaults to dropping
   arguments"* (`REQUIREMENTS.md:85`) — therefore describes a state the type cannot reach. There is
   no such thing as an unspecified policy.

2. **Proposed correction to SEC-01**, which is what the type actually supports and what Phase 3 can
   implement:

   > **SEC-01**: Redaction is required at declaration time for any action with a non-empty schema; an
   > action with a non-empty schema and no redaction policy does not build.

   The doc comment deliberately does **not** assert this. Writing it into `types.ts` while
   `REQUIREMENTS.md` still says the opposite would leave the two in direct contradiction — the same
   class of defect IN-01 exists to close. `grep -c 'fails the build' packages/concierge/src/types.ts`
   returns **0**; the comment says only that Phase 3 owns the declaration-time rule under SEC-01.

3. **`CLAUDE.md:21` carries the same claim and is FLAGGED, NOT EDITED.** It reads:

   > **Security**: Redaction is required for any action with a non-empty schema and defaults to
   > `drop`. Telemetry leaks must be opt-in.

   The "defaults to `drop`" half is unreachable for the same reason. **This is out of scope for this
   sequence and is surfaced for the user to decide** — project instruction files are not this plan's
   to change, and no edit was made to it (verified: `git diff --exit-code c190e14 HEAD -- CLAUDE.md`
   exits 0).

After Task 1, `REQUIREMENTS.md:85` and `CLAUDE.md:21` are **the only two surviving carriers of the
claim**. `types.ts` no longer contains the string `Defaults to` anywhere (count **0**).

## Decisions Made

- **A pre-flight escape measurement was run before any guard was written.** The plan asserts an
  escape ten times over and calls it "the finding"; repeating an unverified claim in a SUMMARY is
  how a stale claim becomes a permanent one. Cost: ten extra `tsc` runs. Return: four corrected rows
  and a transferable lesson for Phase 2's harness.
- **`_deliveryOutcomeIsClosed` was added despite `_deliveryOutcomeIsReadonly` already catching
  MUT-H**, and the same for `_receiptHashIsString`, `_receiptCanonicalIsBytes` and
  `_ackCarriesTurnIdentity`. Redundancy in *detection* is not redundancy in *meaning*: a guard named
  for the modifier is not where a reader looks for the union, and the two axes separate under
  single-axis mutation. Each new guard's comment states what it adds that its neighbour does not.
- **`_onMissingShape` was written against the flat `ActionResult`, and its comment says so.**
  `{ reason?: ReasonCode | undefined; message: string } | undefined` — the `| undefined` from the
  optional member, the inner `| undefined` from 01-12's EOPT widening. Both are load-bearing; the
  predicate is `false` without either.
- **`_resultOkRequired` / `_resultMessageRequired` use indexed access, not `Pick`.** An optional
  member's indexed access carries `| undefined` regardless of `exactOptionalPropertyTypes`, which is
  what lets a one-line predicate see optionality. Their comment names the flat shape they were
  written for and instructs the next reader to re-derive rather than assume if WR-06 is ever
  revisited.
- **Two imports added to `actions.test-d.ts`** (`ConsentGrade`, `ReasonCode`) so the two right-hand
  sides could be spelled literally. Kept in the existing alphabetical order.
- **Sixth-member mutation (MUT-I2) used an *optional* member** (`sixthDial?: number`). A required
  one would additionally break both `ConsentPolicy` fixtures and produce three errors, which would
  have obscured whether `_policyKeys` was the thing that fired.

## Deviations from Plan

### Corrected predictions — reported as observed, not rounded

**1. [Rule 1 — bug in the plan's own factual claim] Four of the ten mutations do not escape the suite today**

- **Found during:** pre-flight measurement, before Task 1
- **Issue:** The plan states MUT-J "Also exits 0 today", and that MUT-G / MUT-H / MUT-M / MUT-N "all
  four ... exit 0 against the current four-file suite; that is the finding." Measured: MUT-J,
  MUT-J2, MUT-G and MUT-H each exit **2** with one TS2344, tripping 01-10's `Pick`-shaped readonly
  pins. Only MUT-M and MUT-N of that group escape.
- **Cause:** the claims are inherited from `01-REVIEW.md`'s battery, which ran pre-01-10.
- **Action:** reported as measured, with the full pre-flight table above. **No guard was dropped** —
  every one the plan required was still added, and every one was still observed red. No acceptance
  criterion is affected: each says "produces TS2344 naming `<alias>`", and each does.
- **Files modified:** none (mutations applied and restored in-call)
- **Commit:** n/a — battery only

**2. [Not a defect — a stronger result than predicted] MUT-N also fires `_onMissingShape`**

- **Found during:** Task 3 battery
- **Observed:** MUT-N produces 2 errors in 2 files, not 1. The unpredicted one is `_onMissingShape`
  at `actions.test-d.ts:242`.
- **Why it matters:** it empirically proves the property the plan could only grep for. A right-hand
  side routed through `ActionResult` would be blind to a change inside `ActionResult`; this one is
  not. Recorded rather than trimmed.
- **Files modified:** none
- **Commit:** n/a — battery only

### Not a deviation, but worth stating

The plan's Task 2 `<action>` says to "extend the sentence at `:63-66`" of `consent.test-d.ts`. That
note was rewritten rather than extended (`+3 / −3` within the block plus new lines), because its
original framing — "the two self-describing fields ... `"SHA-256"` assigns happily to a widened
`string`" — is specifically about literal-typed fields and does not carry over to `hash` and
`canonical`. The replacement states the general rule (a fixture detects removal, a predicate detects
widening), says the coverage is now complete across all four fields, names the exact widening that
had been silent, and tells the next reader to extend all four together. No assertion was touched.

## Issues Encountered

- **The worktree spawned at `e4e353f`**, an ancestor of the required base `c190e14`, so all four
  predecessor plans were absent. Corrected by the startup `git reset --hard` on a clean tree before
  any edit — the third time in this sequence. All five predecessor invariants then verified present
  and re-verified after all edits: comment-filtered `readonly` **26**, `Record<string, never>` **0**,
  `challenge?: ServerChallenge;` **1**, `Readonly<ActionResult>` **0**, `USER_CANCELLED: Readonly<{`
  **1**.
- **Bootstrap** (`pnpm install --frozen-lockfile --prefer-offline`) resolved from the lockfile with
  the resolution step skipped; `git diff --exit-code pnpm-lock.yaml` exits **0**. Pre-edit baseline
  typecheck exited **0**.
- **`--pretty` writes ANSI escapes, which break a naive `grep -c "error TS"`** on the captured log —
  the token is split by colour codes. Stripped with `perl -pe 's/\e\[[0-9;]*m//g'` before counting.
  Worth knowing for Phase 2's harness, alongside 01-13's finding that non-pretty output drops the
  echoed line entirely: the harness needs pretty output *and* an ANSI strip, not one or the other.

## Threat Model Coverage

| Threat ID | Disposition | Status |
|---|---|---|
| T-01-44 | mitigate | **Closed.** `_bindToIsClosed` and `_policyKeys` both observed red (MUT-I, MUT-I2). The escape claim is confirmed by measurement: `bindTo: string` exits **0** against the untouched base. `ConsentPolicy` now carries four member-level assertions where it carried none. |
| T-01-45 | mitigate | **Closed, and the threat was narrower than stated.** `_receiptCanonicalIsBytes` and `_receiptHashIsString` both observed red (MUT-J, MUT-J2). But the pre-flight shows 01-10's `_receiptCanonicalIsReadonly` / `_receiptHashIsReadonly` already caught both widenings, so the hazard was closed before this plan ran — what this plan adds is a guard named for the right invariant. Recorded honestly rather than claimed as a rescue. |
| T-01-54 | mitigate | **Closed, same caveat.** `_ackCarriesTurnIdentity` observed red under MUT-G (single-axis: optionality only, `readonly` kept). `_ackTurnIdIsReadonly` also fires, and already did before this plan. Sits beside `_commonSnapshot` / `_commonPayload`, completing the shared-member set. |
| T-01-55 | mitigate | **Closed, same caveat.** `_deliveryOutcomeIsClosed` observed red under MUT-H, alongside `_deliveryOutcomeIsReadonly`, which already caught it. The new guard's comment states precisely what it adds and why a "readonly"-named guard is not where a reader looks for "closed". |
| T-01-56 | mitigate | **Closed, and these two genuinely escaped.** `_resultOkRequired` (MUT-M, exactly 1 error) and `_resultMessageRequired` (MUT-N). Both mutations exit **0** against the untouched base — measured, not inherited. |
| T-01-48 | mitigate | **Closed.** The `RedactionPolicy` block describes the required member that shipped: `no implicit default` present (count 1), `Defaults to` absent (count 0), `fails the build` absent (count 0), Phase 3 / SEC-01 named as the enforcement owner. The divergence with SEC-01 is handed off above rather than papered over. |
| T-01-64 | mitigate | **Held.** `_snapshotInferred`, `_nameNotWidened` and `_requiresIsString` verified **byte-identical** to their form at base `c190e14`, by string comparison against `git show`. No pre-existing assertion in any of the four test files was modified or deleted; the only removed lines anywhere are three prose lines in `consent.test-d.ts`'s fixture note and two doc-comment lines in `types.ts`. `_requiresIsString` was left silent under M10 by construction, as `01-VALIDATION.md` requires. |
| T-01-51 | mitigate | **Held.** `git diff --exit-code c190e14 HEAD -- packages/concierge/src/index.ts` exits 0. No export added, removed or renamed. |
| T-01-58 | mitigate | **Held.** Twenty mutations, twenty single-call apply/observe/restore cycles, each with a no-op assertion before it and a restore assertion after it, under a shell `trap`. `TREE_CLEAN` printed on all twenty. All three tasks committed before their batteries ran; `git status --porcelain` empty afterward. |
| T-01-SC | accept | **Held.** No package installed. `git diff --exit-code pnpm-lock.yaml` exits 0. |

## Line-number report

Per the standing instruction to **report drift rather than compensate for it**.

| Pattern | At 01-13 | Now | Drift |
|---|---|---|---|
| `export const MESSAGE_MAX_CHARS = 180;` | 279 | **279** | **0** |
| `  snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean;` | 518 | **518** | **0** |

**This plan adds zero drift.** Its only `types.ts` edit is the `RedactionPolicy` doc comment at
`:859`, which sits **below** both pinned patterns. The cumulative drift 01-15 Task 3 must collect is
therefore unchanged from 01-13's report: `MESSAGE_MAX_CHARS` **206 → 279 (+73)**, `snapshotEquality`
**399 → 518 (+119)**. `ActionDefinition.redact` moved 736 → **922** across the sequence; the plan's
prose cites `:736` and `:697-704`, both stale, and everything here was located by pattern.

## Known Stubs

None. This plan adds ten type-level assertions and rewrites one doc comment. No runtime code, no
placeholder values, no unwired data source, no `TODO`/`FIXME` introduced.

## Next Phase Readiness

- **Phase 3 has a decision to make before it plans SEC-01**, not an inherited assumption: the
  requirement's "defaults to dropping" clause is unreachable against the shipped type. Proposed
  wording is above.
- **The user has one flagged item:** `CLAUDE.md:21`. Unedited, out of scope, surfaced.
- **Phase 2's harness should not carry escape claims in prose.** Four of this plan's ten went stale
  in four plans. Re-derive escape status at run time. The harness also needs `--pretty` **plus** an
  ANSI strip: without pretty there is no alias name, with pretty there are colour codes inside the
  `error TS` token.
- **Phase 8 gains a compile-time selector guarantee.** `ConsentPolicy.bindTo` can no longer be
  widened to `string` without the suite going red, so the strong/weak gate choice is a closed pair
  the runtime can switch on exhaustively.

## Self-Check: PASSED

Every acceptance criterion in the plan and every success criterion in the execution brief is met.
Two rows below are *corrected predictions* rather than unmet criteria, and they are called out again
here so a reader does not have to take the pass on trust.

### Verified passing

- `pnpm install --frozen-lockfile --prefer-offline` run; `git diff --exit-code pnpm-lock.yaml` exits **0**
- Baseline typecheck exited **0** before any edit; final `pnpm --filter @fullselfbrowsing/concierge typecheck` exits **0**
- Tasks 1, 2, 3 executed and committed atomically — `f647eb1`, `8091b72`, `c5f5b10`
- Task 1 is doc-comment-only: `git diff --exit-code -- packages/concierge/test-d packages/concierge/src/index.ts` exited **0** after it; the whole hunk is `*`-prefixed comment lines, no type, modifier or member name touched
- **All ten mutations** (MUT-I, MUT-I2, MUT-I3, MUT-I4, MUT-J, MUT-J2, MUT-G, MUT-H, MUT-M, MUT-N) applied, **observed non-zero with the real `--pretty` diagnostic and echoed source line recorded verbatim above**, and restored **inside the same tool call**
- MUT-I3 and MUT-I4 produced **exactly one** TS2344 each, as their criteria require
- MUT-G is single-axis: optionality changed, `readonly` kept; applied hunk reproduced in the run log
- **All ten guards** named in a mutation row with an observed diagnostic — mapping table above
- `git diff --exit-code -- packages/concierge/src/types.ts` exited **0** after every one of the twenty runs; `TREE_CLEAN` printed twenty times
- RedactionPolicy doc block: `no implicit default` **1**, `Defaults to` **0**, `fails the build` **0**
- `grep -c 'Pick<ActionResult' packages/concierge/test-d/actions.test-d.ts` returns **0**
- No test-d file contains a top-level `export`: `grep -l '^[[:space:]]*export' packages/concierge/test-d/*.test-d.ts` returns empty
- `_snapshotInferred`, `_nameNotWidened`, `_requiresIsString` **byte-identical** to their pre-plan form (string-compared against `git show c190e14:…`)
- `_receiptCanonicalIsBytes` names `Readonly<Uint8Array>`, read from `types.ts:737` rather than assumed; the two `ActionResult` pins were written against the flat shape 01-13 landed, and their comment names it
- Predecessor invariants re-asserted after all edits: **26 / 0 / 1 / 0 / 1**
- `git status --porcelain` **empty** after both batteries (reproduced above)
- Phase 3 handoff section present, naming SEC-01, stating the divergence, proposing corrected wording, and flagging `CLAUDE.md:21` as out of scope — **flagged, not edited**
- Post-edit line numbers reported: `MESSAGE_MAX_CHARS` **279**, `snapshotEquality` **518**, drift **0**
- `git diff --name-only c190e14 HEAD` lists exactly **five** files, all declared in `files_modified`
- Untouched, verified against base: `README.md`, `CLAUDE.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `01-CONTEXT.md`, `packages/concierge/src/index.ts`, `pnpm-lock.yaml`
- `STATE.md` and `ROADMAP.md` deliberately **not** written — the orchestrator owns those after merge

### Corrected predictions (measured, not rounded)

1. **MUT-J, MUT-J2, MUT-G and MUT-H do NOT escape the suite as it stands today**, contrary to the
   plan's `<objective>` and Task 3 `<action>`. Each exits 2 with one TS2344 tripping a plan-01-10
   readonly pin. Measured pre-flight against untouched base `c190e14`. Every required guard was
   still added and still observed red.
2. **MUT-N produces two errors, not one** — `_resultMessageRequired` as predicted, plus
   `_onMissingShape`, which the plan did not anticipate. This is a stronger result: it is direct
   proof that `_onMissingShape`'s right-hand side is not routed through `ActionResult`.

---
*Phase: 01-type-surface-completion*
*Completed: 2026-07-28*
