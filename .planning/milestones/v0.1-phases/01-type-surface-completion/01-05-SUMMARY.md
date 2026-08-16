---
phase: 01-type-surface-completion
plan: 05
subsystem: types
tags: [typescript, consent, discriminated-union, narrowing, exact-optional-property-types, type-testing, mutation-testing]

# Dependency graph
requires:
  - phase: 01-01
    provides: "tsconfig.test-d.json (the src + test-d program) and test-d/_assert.ts (Expect / Equals / Assignable / Not)"
  - phase: 01-02
    provides: "the measured one-line-predicate rule — every assertion here is on one line so tsc echoes the alias name"
  - phase: 01-03
    provides: "the check-the-diagnostic-COUNT-not-just-the-exit-code discipline"
  - phase: 01-04
    provides: "ServerChallenge (the brand this plan mounts on the base), ReadbackReceipt (readbackHash's producer), and consent.test-d.ts part 1 with the Booking fixture and the foot marker"
provides:
  - "ConsentAckBase<Snapshot, Payload> — non-exported, five common members plus challenge?: ServerChallenge"
  - "ConsentAck — a two-branch discriminated union; the attested branch requires readbackHash: string"
  - "readbackHash's doc names ReadbackSink and ReadbackReceipt as its producer, closing the loop DeliveryReport opened"
  - "test-d/consent.test-d.ts part 2 — SC-6 positive, two predicate/control pairs, a narrowing function, two parameter-survival assertions"
  - "Three-mutant defect-first proof; M4 observed firing BOTH of its independent detectors"
affects: [01-06, 01-07, 01-08, 01-09, phase-08-consent-kernel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Union-of-intersections over a non-exported base: share members without duplicating them while keeping the discriminant load-bearing"
    - "Every negative predicate paired with a positive control, so a red line is attributable to the property under test rather than to fixture drift"
    - "A declared return type as the load-bearing half of a detector — inference would widen it and silence both branches"
    - "Assert a type parameter still reaches a member even when erasing it produces zero diagnostics on its own"

key-files:
  created: []
  modified:
    - packages/concierge/src/types.ts
    - packages/concierge/test-d/consent.test-d.ts

key-decisions:
  - "ConsentAck is a union of two branches, not one flat declaration — accepting the loss of `extends` and declaration merging to make `attested implies readbackHash` a compile error rather than a doc comment"
  - "D-03, D-05, and D-07 were landed as ONE edit; sequencing them produces intermediate states that do not compile, because D-05 changes the declaration's kind"
  - "_attestedNeedsHash and _challengeMustBeOmitted are predicates, never @ts-expect-error — a directive is satisfied by any error on the line, including a misspelled member"
  - "_commonPayload was added beyond the plan's three named aliases; erasing Payload was measured to produce ZERO diagnostics without it"
  - "ConsentAckBase is deliberately not exported — writing against the common shape is writing against a value whose grade has not been checked"

patterns-established:
  - "Pair every negative with a control that must assign"
  - "When a detector depends on an annotation (not just a predicate), say so in the comment — the annotation is the detector"

requirements-completed: [SC-6, SC-7f]

# Metrics
duration: interrupted — see Provenance
completed: 2026-07-28
---

# Phase 01 Plan 05: The ConsentAck Hinge Summary

**The strongest consent grade can no longer exist without the evidence binding it to a payload — `attested` without a `readbackHash` is now TS2344 at a named alias and TS2322 inside a narrowing function, two detectors that fail independently.**

## Provenance — this plan was closed out by a recovery pass

**Stated plainly, because it affects how much this SUMMARY should be trusted.** Task 1 was executed and committed by an executor agent on 2026-07-28T02:26:08-05:00. That session was interrupted before Task 2 was committed and before any SUMMARY existed. The plan was found in that state by `/gsd-autonomous`'s safe-resume gate: a production commit for `01-05` with no `01-05-SUMMARY.md`, and an orphaned worktree still holding uncommitted work.

What the recovery pass found in the worktree, and what it did:

| Found | Disposition |
|---|---|
| `08cfc77` — Task 1, committed, complete | Kept as-is. Not re-executed, not amended. |
| `consent.test-d.ts` — Task 2's full block, **uncommitted** | Reviewed against the plan's acceptance criteria, verified, committed as `2fcc9f4`. |
| `types.ts` — `payload: Payload` changed to `payload: unknown`, **uncommitted** | **Reverted.** This was a mutation probe the interrupted session never restored. See below. |

**The unreverted mutation is the part worth dwelling on.** Had the worktree been merged without inspection, `ConsentAckBase.payload` would have shipped as `unknown` — erasing the `Payload` type parameter from the ack for every consumer, silently, while the suite stayed green everywhere except one line. It was identified as a probe rather than an intended edit because the test file's own comment describes exactly that measurement ("`Payload` erased the same way was measured to produce **zero** diagnostics before the second line existed"), and confirmed by typechecking with it applied: **one** error, TS2344 at `_commonPayload`, the assertion written to catch precisely that. Reverting it returned the program to exit 0.

Task 1 was accepted on inspection rather than re-derived. The two mandatory defect-first proofs the plan requires were **run in full by the recovery pass**, not inherited from the interrupted session's notes — there were none.

## Accomplishments

- **SC-7f is enforced by the compiler.** `ConsentAck` is a two-branch union. The `attested` branch declares `readbackHash: string` as required; every other grade gets `readbackHash?: string | undefined`. Constructing an attested ack without a hash does not typecheck.
- **The invariant has two independent detectors, and both were watched firing.** Flattening the union back to one declaration produces TS2344 at `_attestedNeedsHash` *and* TS2322 inside `narrowsThroughTheUnion`. Either one alone would be a single point of failure for the regression this plan most fears.
- **Narrowing survives the union-of-intersections.** Inside `ack.grade === "attested"` the hash is a plain `string` needing no `??`. That absent fallback *is* the assertion.
- **D-05's omit-don't-spread caveat is pinned.** Under `exactOptionalPropertyTypes`, `challenge: undefined` is rejected while omitting the key assigns — both directions asserted.
- **A detector the plan did not ask for was added after measuring that its absence was a hole.** See Deviation 1.

## Task Commits

1. **Task 1: Rewrite `ConsentAck` as a discriminated union (D-03, D-05, D-07)** — `08cfc77` (feat)
2. **Task 2: Append `consent.test-d.ts` part 2 defect-first (SC-6, SC-7f)** — `2fcc9f4` (test)

## Files Modified

- `packages/concierge/src/types.ts` — `+87 / -9` in Task 1. `ConsentAckBase` at line **394** (not exported), `ConsentAck` at line **448**, `challenge?: ServerChallenge` at **416**, the optional `readbackHash` at **458**, the required one at **480**.
- `packages/concierge/test-d/consent.test-d.ts` — `+109 / -6`, now **302** lines. Still exports nothing; `@ts-expect-error` count still exactly **2**, both inherited from part 1.

Combined against base `a200945`: **2 files, +196 / -15**. No file outside `files_modified` was touched.

## What the union buys, and what it costs

The cost is real and was accepted at plan time: consumers lose `extends` and declaration merging on `ConsentAck`. What it buys is that *`attested` implies `readbackHash`* is a compile error to violate rather than a doc comment.

That trade was taken because an `attested` ack carrying no hash is a gate failing while appearing to work — it proves only that *a* readback occurred, not that it described *this* payload. Prose has never once stopped that object from being constructed.

**The doc comment on `ConsentAck` states the limit as bluntly as the guarantee**: this is a client-side assertion and nothing more. Serializing an ack and reading its `grade` off the wire is worth nothing, because a server cannot verify a grade the client minted. Phase 1 cannot fix that; what it does is remove the affordance one level down, so the strongest shape a client can even build is internally consistent. `challenge` reserves the seam for the server-issued counterpart.

## Defect-First Proof — three mutants, all observed

Each mutation was applied to `packages/concierge/src/types.ts`, typechecked, then restored and re-confirmed at exit 0 before the next. `consent.test-d.ts` was never mutated.

### M4 (mandatory) — `ConsentAck` flattened back to one declaration

Mutation: the two-branch union replaced by `ConsentAckBase<Snapshot, Payload> & { grade: ConsentGrade; readbackHash?: string | undefined }`.

**Exit non-zero. Exactly 2 errors — both of the plan's required diagnostics, from independent mechanisms.**

```
test-d/consent.test-d.ts(246,34): error TS2344: Type 'false' does not satisfy the constraint 'true'.
test-d/consent.test-d.ts(282,33): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
```

Line 246 is `_attestedNeedsHash`. Line 282 is `return ack.readbackHash;` inside `narrowsThroughTheUnion`.

**TS2578 did not fire, and its absence is correct — not a hole.** The plan says so in advance, and this run confirms it: neither of the file's two `@ts-expect-error` directives belongs to `ConsentAck`; both are part 1's, on the readback sink and the forged challenge, which flattening does not touch. No directive was added to manufacture one.

### M-challenge (mandatory) — `challenge?: ServerChallenge | undefined`

**Exit non-zero, 1 error.** Widening the optional to explicitly admit `undefined` makes the omit-don't-spread rule unenforceable, and the predicate says so:

```
test-d/consent.test-d.ts(256,39): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```

Line 256 is `_challengeMustBeOmitted`.

### M-payload (extra) — `ConsentAckBase.payload` erased to `unknown`

**Exit non-zero, 1 error.** This is the mutation the interrupted session left applied, re-run deliberately as a proof:

```
test-d/consent.test-d.ts(302,30): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```

Line 302 is `_commonPayload`. **Before that assertion existed this mutation produced zero diagnostics** — see Deviation 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] The `Payload` type parameter reached `payload` unguarded**

- **Found during:** Task 2, while working out which mutants to run beyond the two mandated.
- **Issue:** the plan names three required aliases and `_commonSnapshot` is one of them — but it pins only `Snapshot`. Erasing `Payload` to `unknown` was measured to produce **zero** diagnostics: the SC-6 positive stays green because any payload assigns to `unknown`, and both negatives stay negative for unrelated reasons. This is not cosmetic. Plan 01-06 asserts that `ActionDefinition.handler` forwards `Snapshot` *and* `AckPayload` through to `ctx.ack`; had `Payload` quietly stopped reaching this member, 01-06 would have been measuring a chain with a hole in it and would still have passed.
- **Fix:** added `_commonPayload`, one line, alongside `_commonSnapshot`. Proven to fire (M-payload).
- **Files modified:** `packages/concierge/test-d/consent.test-d.ts`
- **Committed in:** `2fcc9f4`

**2. [Rule 2 - Missing Critical] Both negative predicates lacked controls**

- **Found during:** Task 2.
- **Issue:** a `Not<Assignable<…>>` predicate goes green when the object stops assigning *for any reason*. A typo in `userTurnId` would satisfy `_attestedNeedsHash` just as well as the missing hash does, and the invariant would read as tested while being untested — the same failure mode the plan cites for rejecting `@ts-expect-error`, reappearing one level up.
- **Fix:** added `_attestedWithHashAssigns` and `_challengeAbsentAssigns` — the same objects with the property under test restored, asserted to assign. A typo now breaks the control, so the pair localizes the failure.
- **Files modified:** `packages/concierge/test-d/consent.test-d.ts`
- **Committed in:** `2fcc9f4`

**3. [Recovery] An unreverted mutation probe was removed from the working tree**

- **Found during:** the safe-resume gate, before any executor was dispatched.
- **Issue:** `types.ts` carried `payload: unknown` as an uncommitted change — a probe, not an intended edit. Merging the worktree unexamined would have erased the `Payload` parameter from `ConsentAck` for every consumer.
- **Fix:** reverted via `git checkout --`, restoring `payload: Payload` at lines 400 and 511. Re-confirmed at exit 0. The probe was then re-run deliberately and recorded as M-payload.
- **Verification:** `git status` in the worktree showed only `consent.test-d.ts` modified before the Task 2 commit.

---

**Total deviations:** 2 auto-fixed (both missing-critical), 1 recovery action
**Impact on plan:** both additions were found by the defect-first procedure the plan mandates, and both close holes in assertions the plan itself specifies. No scope creep: no file outside `files_modified` touched, no dependency added, no export surface changed.

### Not Done, Deliberately

- **`src/index.ts` was not edited.** The export debt is plan 01-08's. `ConsentAck` was already exported before this plan; `ConsentAckBase` is deliberately not.
- **`ConciergeConfig` gained no seams.** `presentReadback?`, `digest?`, and `scheduler?` are plan 01-07's Task 1.
- **`ReadbackAttestation` still not declared.** D-12 item 1 defers it to Phase 8. Nothing here can be read as granting `attested`.
- **`.planning/STATE.md` and `.planning/ROADMAP.md` untouched** — `git diff --name-only a200945..HEAD` lists exactly the two source files.

## Issues Encountered

**The interruption itself is the issue worth recording.** An executor working in an isolated worktree left a mutation applied to a source file and the session ended. Nothing in the worktree marked the file as mid-measurement — no note, no stash, no marker in the commit trail. The only reason the probe was distinguishable from an intended edit is that the *test file* documented the measurement in prose.

Two things follow for later plans, both of which run mutants:

1. **Restore immediately after reading the diagnostic, in the same tool call if possible.** 01-04's SUMMARY already records `git checkout --` plus `git diff --exit-code` after every mutant as its discipline. That discipline is what this session skipped, and it is the only thing standing between a probe and a shipped defect.
2. **A mutation left applied is invisible to a green suite.** M-payload produces exactly one error — on the assertion designed to catch it. Every other check in the repo, including the root typecheck, passes with `payload: unknown` in place *if that one assertion is absent*. Which it was, until this plan added it.

## Verification Results

| Check | Result |
|---|---|
| `pnpm --filter @fullselfbrowsing/concierge typecheck` | exit **0** |
| `pnpm typecheck` (repo root) | exit **0** |
| M4 observed non-zero with TS2344 (`_attestedNeedsHash`) **and** TS2322 (narrowing fn) | **yes** — exactly 2 errors, both detectors |
| M4 produced no TS2578 | **yes** — correct, as the plan predicts |
| M-challenge observed non-zero with TS2344 (`_challengeMustBeOmitted`) | **yes** |
| M-payload observed non-zero with TS2344 (`_commonPayload`) | **yes** |
| `types.ts` restored to exit 0 after every mutant | **yes**, 3/3 |
| Every mutant diagnostic carried its alias name on the echoed line | **yes**, 3/3 |
| `export type ConsentAck<Snapshot = unknown, Payload = unknown>` present | line **448** |
| `ConsentAckBase` present and **not** exported | line **394** |
| `challenge?: ServerChallenge` on the shared base | line **416** |
| `readbackHash: string` required on the attested branch | line **480** |
| `_attestedNeedsHash`, `_challengeMustBeOmitted`, `_commonSnapshot` all present | **yes** |
| `_attestedNeedsHash` / `_challengeMustBeOmitted` are predicates, not directives | **yes** |
| Narrowing fn returns `ack.readbackHash` with no `??`, declared return `string` | line **281–283** |
| `Booking` fixture declared exactly once | **yes** |
| `@ts-expect-error` count in `consent.test-d.ts` | **2** (this task added none) |
| `consent.test-d.ts` exports nothing | **yes** |
| `consent.test-d.ts` line count | **302** |
| `git diff --exit-code pnpm-lock.yaml` | exit **0** |
| File deletions across both commits | **none** |
| `.planning/STATE.md`, `.planning/ROADMAP.md` in diff | **none** |

## Threat Model Compliance

| Threat ID | Disposition | Status |
|---|---|---|
| T-01-12 | mitigate | **Phase 1's half closed.** `challenge?: ServerChallenge` is now on the ack, branded and unmintable without a visible cast. Nothing in v0.1 produces one — the seam is inbound-only, which is what keeps anything this library emits from being mistaken for proof. |
| T-01-14 | mitigate | **Closed at the type level.** `attested` cannot be constructed without `readbackHash`, so the strongest grade cannot be claimed without evidence binding it to a payload (OWASP ASI09 — the agent reauthoring the rendition). Enforcement is the compiler, proven by M4. |
| T-01-15 | **accept — stated, not mitigated** | A client-minted grade read off a stringified ack proves nothing, and this plan does not change that. The `ConsentAck` doc says so in as many words. Removing the affordance one level down is all Phase 1 can do; the server-issued counterpart needs `challenge`, which Phase 8 owns. |

**No new threat surface.** Type declarations, doc comments, and one non-emitting test file. No runtime code path added.

## Known Stubs

None in this plan's artifacts — every declaration is a complete type.

Two **deliberate** gaps the verifier should not mistake for completion:

1. **`challenge` has no producer and is not meant to have one in v0.1.** Its security value today is that minting one is a compile error, not that any replay protection exists.
2. **`readbackHash` has a declared producer chain but no running code.** `ReadbackSink → ReadbackReceipt.hash → DeliveryReport.readbackHash → ConsentAck.readbackHash` is complete as *types*; the JCS canonicalizer and the digest call land in Phase 8.

## Next Phase Readiness

Plan 01-06 has what it needs. `ConsentAck<Snapshot, Payload>` keeps both parameters through either branch, and `_commonPayload` now guarantees `Payload` actually reaches `payload` — which is the member 01-06's `ActionDefinition.handler` assertion binds against. `ActionHandler`'s `ack?: ConsentAck<unknown, AckPayload>` compiled untouched through the refactor.

Two things to carry forward:

1. **`_policyDegraded` is 01-06's, and M9 is still its only detector.** Both `DigestLike`'s and `snapshotEquality`'s doc comments point at it. If 01-06 does not create that alias, `snapshotEquality`'s syntax joins `DigestLike`'s as unguarded and two doc comments become false.
2. **Restore mutants immediately.** See Issues Encountered. This plan came within one unexamined merge of shipping an erased type parameter.

## Self-Check: PASSED

- `packages/concierge/src/types.ts` — FOUND
- `packages/concierge/test-d/consent.test-d.ts` — FOUND
- `.planning/phases/01-type-surface-completion/01-05-SUMMARY.md` — FOUND
- Commit `08cfc77` (Task 1) — FOUND in git log
- Commit `2fcc9f4` (Task 2) — FOUND in git log
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — exit 0
- `pnpm typecheck` (root) — exit 0
- `.planning/STATE.md` and `.planning/ROADMAP.md` absent from the diff against base `a200945`

---
*Phase: 01-type-surface-completion*
*Completed: 2026-07-28*
