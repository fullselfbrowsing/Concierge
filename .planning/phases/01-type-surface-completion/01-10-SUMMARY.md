---
phase: 01-type-surface-completion
plan: 10
subsystem: types
tags: [typescript, readonly, consent, immutability, type-tests, mutation-testing]

# Dependency graph
requires:
  - phase: 01-09
    provides: the four-file type-test suite and the ConsentAck two-branch union this plan makes immutable
provides:
  - readonly on all 20 members of ConsentAckBase, both ConsentAck branches, DeliveryReport, ReadbackReceipt, and TransportCapabilities
  - element-level immutability for ReadbackReceipt.canonical via Readonly<Uint8Array>
  - ten named read-only predicates, each observed red under a deliberate source mutation
affects: [phase-8-consent-kernel, phase-6-dispatcher, phase-2-mutation-harness, 01-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only-ness asserted as a named predicate via Expect<Equals<Pick<T,K>, {readonly K: V}>> rather than a suppression directive"
    - "Property modifier and element type treated as two distinct immutability axes, each with its own mutation"

key-files:
  created:
    - .planning/phases/01-type-surface-completion/01-10-SUMMARY.md
  modified:
    - packages/concierge/src/types.ts
    - packages/concierge/test-d/consent.test-d.ts
    - packages/concierge/test-d/transport.test-d.ts

key-decisions:
  - "Pick preserves readonly through the ConsentAck union and does not distribute, so Pick<Ack,'grade'> is the single object type {readonly grade: ConsentGrade} — measured, not assumed"
  - "Guard value sides written as the declared alias (ConsentGrade, TurnIdentityProvenance) rather than spelled-out unions, keeping each guard about the modifier alone"
  - "ReadbackReceipt.canonical typed Readonly<Uint8Array>, not bare Uint8Array — the bare form leaves receipt.canonical[0] = 0 compiling"
  - "All six read-only guards collected in one section of consent.test-d.ts, crossing the file's Part 1 / Part 2 split, with attribution carried by alias prefix instead of position"

patterns-established:
  - "Defect-first mutation proof: apply, observe, and restore inside a single tool call, asserting the mutation actually changed the file before trusting a red or green result"
  - "Doc comments state what the type enforces, not what it hopes for — prose that understates the type is treated as its own defect"

requirements-completed: [SC-1, SC-3, SC-6, TRN-05]

# Metrics
duration: 20min
completed: 2026-07-28
---

# Phase 01 Plan 10: Read-Only Consent Artifacts Summary

**`readonly` on all 20 members of the five consent-critical declarations plus `Readonly<Uint8Array>` on the receipt bytes, closing a hole where `ack.grade = "attested"` compiled cleanly and made the compiler type an absent `readbackHash` as `string` — with ten named predicates each observed red under a deliberate source mutation.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-28T20:08Z
- **Completed:** 2026-07-28T20:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **CR-01 closed.** `ConsentAck`'s discriminant is read-only on both branches, so the forgery that produced a false compiler guarantee is now TS2540. The union already constrained construction; `readonly` is what now constrains mutation.
- **WR-01 closed on all four remaining surfaces** — `DeliveryReport`, `ReadbackReceipt`, `TransportCapabilities`, and (transitively) `Transport.capabilities`, whose pre-existing `readonly` was protective in appearance only.
- **The element-level axis closed too.** `readonly canonical: Uint8Array` was measured to leave `receipt.canonical[0] = 0` compiling; `Readonly<Uint8Array>` makes it TS2542 at zero cost to every consumption site that matters.
- **Ten named guards added and all ten observed failing** under six source mutations before being trusted green.
- **Zero edits to any existing assertion.** The standing gap-closure constraint held: Task 1 changed `src/` only and the four-file suite stayed at exit 0 untouched.

## Task Commits

1. **Task 1: Make the consent-critical artifacts read-only (CR-01, WR-01)** — `d845a0b` (fix)
2. **Task 2: Add the mutation guards defect-first, and observe them red before green** — `afdb3d2` (test)

## Files Created/Modified

- `packages/concierge/src/types.ts` — `readonly` on 20 members across `ConsentAckBase` (5), both `ConsentAck` branches (4), `DeliveryReport` (3), `ReadbackReceipt` (4), `TransportCapabilities` (4); `canonical` retyped to `Readonly<Uint8Array>`; six doc comments rewritten to state what the type enforces.
- `packages/concierge/test-d/consent.test-d.ts` — six read-only predicates, the literal `mutableAck.grade = "attested"` write as a third suppression directive, header directive count corrected 2 → 3.
- `packages/concierge/test-d/transport.test-d.ts` — four read-only predicates for `DeliveryReport` and `TransportCapabilities`.

## Mutation Battery — six mutations, all observed red

Every row below was applied, observed, and restored **inside a single Bash tool call**, with an explicit assertion that the mutation actually changed the file (a no-op `perl` would have produced a green run indistinguishable from a broken guard). `git diff --exit-code -- packages/concierge/src/types.ts` exited 0 after each; `TREE_CLEAN` printed on all six.

| Mutation | Exit | Observed codes | Guard aliases echoed on the offending source lines |
|---|---|---|---|
| **MUT-A-SRC** — strip `readonly` from `grade` on both `ConsentAck` branches | 2 | 1 × TS2344, 1 × TS2578 | `consent.test-d.ts:327` `_ackGradeIsReadonly`; `consent.test-d.ts:344` unused directive |
| **MUT-B-SRC** — strip `readonly` from `snapshot`, `payload`, `userTurnId` | 2 | 3 × TS2344 | `:330` `_ackPayloadIsReadonly`, `:333` `_ackSnapshotIsReadonly`, `:336` `_ackTurnIdIsReadonly` |
| **MUT-DEF-SRC** — strip `readonly` from `userTurnIdentity`, `outcome`, `hash` | 2 | 3 × TS2344 | `consent:348` `_receiptHashIsReadonly`; `transport:112` `_deliveryOutcomeIsReadonly`; `transport:118` `_capsProvenanceIsReadonly` |
| **MUT-DH-SRC** — strip `readonly` from `readbackHash`, `consentGrade` | 2 | 2 × TS2344 | `transport:115` `_deliveryReadbackHashIsReadonly`, `transport:121` `_capsGradeIsReadonly` |
| **MUT-CANON-SRC** — degrade `canonical` to bare `Uint8Array`, keeping the modifier | 2 | **exactly 1** × TS2344 | `consent:359` `_receiptCanonicalIsReadonly` |
| **MUT-CANON2-SRC** — strip the modifier, keeping `Readonly<Uint8Array>` | 2 | 1 × TS2344 | `consent:359` `_receiptCanonicalIsReadonly` |

Every diagnostic matched the plan's prediction exactly — code, count, and alias. Representative diagnostic, verbatim from `tsc --pretty` under MUT-A-SRC:

```
packages/concierge/test-d/consent.test-d.ts:327:35 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
327 type _ackGradeIsReadonly = Expect<Equals<Pick<ConsentAck<Booking, { id: string }>, "grade">, { readonly grade: ConsentGrade }>>;
packages/concierge/test-d/consent.test-d.ts:344:1 - error TS2578: Unused '@ts-expect-error' directive.
344 // @ts-expect-error - grade must not be writable: a written grade forges the attested branch
```

### Guard → mutation mapping (all ten named, explicitly checked)

| Guard | Covered by |
|---|---|
| `_ackGradeIsReadonly` | MUT-A-SRC |
| `_ackPayloadIsReadonly` | MUT-B-SRC |
| `_ackSnapshotIsReadonly` | MUT-B-SRC |
| `_ackTurnIdIsReadonly` | MUT-B-SRC |
| `_receiptHashIsReadonly` | MUT-DEF-SRC |
| `_receiptCanonicalIsReadonly` | MUT-CANON-SRC **and** MUT-CANON2-SRC |
| `_deliveryOutcomeIsReadonly` | MUT-DEF-SRC |
| `_deliveryReadbackHashIsReadonly` | MUT-DH-SRC |
| `_capsProvenanceIsReadonly` | MUT-DEF-SRC |
| `_capsGradeIsReadonly` | MUT-DH-SRC |

Ten guards, six mutations, every guard named in at least one row. `_receiptCanonicalIsReadonly` is the only guard covered twice, deliberately: the pair proves the single predicate sees **both** the modifier axis and the element-type axis rather than one of them.

**Working tree after the battery** — `git status --porcelain` output, reproduced in full:

```
```

(empty — no mutation left applied, no untracked file created)

## Additional verification not required by the plan

The plan's mutations prove the guards detect a stripped modifier. They do not prove the fix blocks the reviewer's actual exploit. That was confirmed separately in a `/tmp` sandbox (`/tmp/gsd-probe-0110`, removed afterward) carrying a copy of the fixed `src/`; the worktree was asserted clean before and after and never touched. Compiling `launder` / `upgrade` / `relabel` / `tamper` against the fixed types yields:

```
error TS2540: Cannot assign to 'grade' because it is a read-only property.
error TS2540: Cannot assign to 'userTurnId' / 'responseId' / 'snapshot' / 'payload' ...
error TS2540: Cannot assign to 'userTurnIdentity' / 'consentGrade' ...
error TS2540: Cannot assign to 'outcome' ...
error TS2540: Cannot assign to 'hash' ...
error TS2542: Index signature in type 'Readonly<Uint8Array<ArrayBufferLike>>' only permits reading.
```

**Observed totals: 9 × TS2540 + 1 × TS2542.** Reported as measured rather than rounded to the plan's figures — see "Findings" below. A companion `stillReadable` probe exercising `.length`, `for…of`, `new Uint8Array(rc.canonical)`, and an indexed read produced **zero** diagnostics, confirming the `Readonly<Uint8Array>` choice costs nothing at consumption sites.

## Findings — observations that differ from the plan's stated predictions

Reported per the standing rule that a differing count is a finding, not something to round away. Neither finding affects any acceptance criterion; both concern the *exploit* probe above, not the mutation battery (whose six rows matched exactly).

1. **`launder` produced 5 × TS2540, not 6.** The plan predicted 6. The gap is entirely explained: `ConsentAckBase` has five members plus `grade` = six writable targets, and my probe omitted a write to `challenge`. Writing all six would give 6. Not a discrepancy in the fix — a difference in the probe.
2. **The WR-01 probes produced 4 × TS2540 + 1 × TS2542, where the plan predicted "3 × TS2540".** Counted by function: `upgrade` 2, `relabel` 1, `tamper` 1 (`hash`) + 1 × TS2542 (`canonical[0]`). The plan's "3" appears to count `upgrade` + `relabel` only, treating `tamper` separately. The fix behaves correctly on every probe; only the bookkeeping differs.

Plan 01-15 re-runs the reviewer's exploits under the unsuffixed `MUT-A`/`MUT-D`/`MUT-E`/`MUT-F` identifiers and is the authoritative place these counts get pinned.

## Line-number drift report

Per the plan's instruction to report drift rather than compensate for it:

- `export const MESSAGE_MAX_CHARS = 180;` — **line 206** (was 206; **unchanged**, it sits above `DeliveryReport`)
- `  snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean;` — **line 408** (was 399; **+9**)

The +9 is exactly the ten-line doc comment that replaced the one-line comment on `DeliveryReport.outcome`, and the exact match confirms nothing else between `DeliveryReport` and `ConsentPolicy` changed line count. Phase 2's harness matches by pattern and is unaffected; four Phase 2 plans carry these numbers in prose and plan 01-15 collects the drift.

## Decisions Made

- **`Pick` behaviour was measured, not assumed.** Before writing a single guard I probed all ten candidate shapes in a sandbox. The result that mattered: `Pick<ConsentAck<…>, "grade">` is `{ readonly grade: ConsentGrade }` — `Pick` preserves the modifier through the union and does **not** distribute. The distributed candidate (`{readonly grade: Exclude<…>} | {readonly grade: "attested"}`) evaluated `false` and would have been a broken guard that looked fine.
- **Guard value sides use the declared alias, not a spelled-out union.** `{ readonly grade: ConsentGrade }` rather than the four literals. Spelling them out would make each guard *also* fire when a grade is added — a different invariant that `_provenanceNotBoolean` and the grade-order assertions already own. Keeping the alias keeps each guard about the modifier alone.
- **All six consent-file guards placed in one section, crossing the file's Part 1 / Part 2 split.** The plan directed all six below the Part 2 marker, but the file's header claims the halves are disjoint so a failure names its half. Rather than let that claim go stale, the header now records this as the one deliberate crossing, with attribution carried by the alias prefix (`_ack…` vs `_receipt…`). The ack guards sit immediately beside `narrowsThroughTheUnion` and name it, which is the load-bearing placement (T-01-38).
- **The header's directive count was corrected in the same edit that invalidated it** (2 → 3), with a clause saying what the new directive guards. A stale count is a live falsehood in a file whose whole value is that its claims are checkable.

## Deviations from Plan

None. Both tasks executed as written.

Two judgement calls were made *within* the plan's latitude and are recorded above rather than as deviations: the placement/header-honesty handling in `consent.test-d.ts`, and the addition of the exploit probe as verification the plan did not require. Neither changed a file outside `files_modified`.

## Issues Encountered

- **A broken symlink in the first sandbox copy.** `cp -R` preserved pnpm's `@standard-schema` symlink, which dangled in `/tmp`, producing a spurious `TS2307` in the first exploit run. It could not have affected the result (`ConsentAck`, `DeliveryReport`, `ReadbackReceipt`, and `Transport` do not depend on `StandardSchemaV1`, and all TS2540s fired correctly), but the probe was re-run with `cp -RL` to remove any asterisk. The clean run shows `9 × TS2540 + 1 × TS2542` and no TS2307.
- No other issues. Bootstrap (`pnpm install --frozen-lockfile --prefer-offline`) left `pnpm-lock.yaml` byte-identical and the pre-edit baseline typecheck exited 0.

## Threat Model Coverage

| Threat ID | Disposition | Status |
|---|---|---|
| T-01-37 | mitigate | **Closed.** `readonly grade` on both branches; TS2540 confirmed against `launder`. Guarded by `_ackGradeIsReadonly` + the write directive, both observed red under MUT-A-SRC. |
| T-01-38 | mitigate | **Closed.** The write is unreachable, so the false narrowing guarantee is unreachable. The guard comment names `narrowsThroughTheUnion` and sits adjacent to it. |
| T-01-39 | mitigate | **Closed.** `readonly userTurnIdentity`; guarded by `_capsProvenanceIsReadonly`, observed red under MUT-DEF-SRC. |
| T-01-40 | mitigate | **Closed.** `readonly outcome`; guarded by `_deliveryOutcomeIsReadonly`, observed red under MUT-DEF-SRC. |
| T-01-41 | mitigate | **Closed.** `readonly hash` and `readonly canonical: Readonly<Uint8Array>` (TS2542 on element write, confirmed); guarded by `_receiptHashIsReadonly` and `_receiptCanonicalIsReadonly`. |
| T-01-51 | mitigate | **Held.** `git diff --exit-code -- packages/concierge/src/index.ts` exits 0 across both commits. Export surface byte-identical. |
| T-01-58 | mitigate | **Held.** Six mutations, six single-call apply/restore cycles, `TREE_CLEAN` on all six, empty `git status --porcelain` after the battery. |
| T-01-SC | accept | **Held.** No package installed; `pnpm-lock.yaml` unchanged. |

## Known Stubs

None. This plan adds no runtime code and no placeholder values — it is a type-modifier and type-test change only.

## Next Phase Readiness

- The consent-critical artifacts are immutable at the type level and the guards for that property are proven, not assumed. Phase 8's kernel can hold armed acks without an aliasing bug rewriting them.
- **Note for Phase 8 and any producer:** the `readonly` stops a write through *this* reference. It says nothing about a write through an alias obtained before arming, and nothing at all at runtime. `Object.freeze` at the producer remains required and is documented on `ConsentAckBase.snapshot`.
- **WR-02 remains open** and is out of scope here: eight optional members still lack the `| undefined` widening that `ActionResult.reason` documents at length. Non-breaking to fix later, which is why it is a warning.
- Plan 01-15 should pin the exploit counts recorded under "Findings" and collect the `snapshotEquality` line drift (399 → 408).

## Self-Check: PASSED

Verified after writing:

- `pnpm --filter @fullselfbrowsing/concierge typecheck` exits **0**
- `git status --porcelain` **empty** after the battery
- `git diff --exit-code pnpm-lock.yaml` exits 0 — lockfile byte-identical
- `git diff --exit-code HEAD~2 -- packages/concierge/src/index.ts` exits 0 — export surface untouched
- `grep -v '^[[:space:]]*[*/]' src/types.ts | grep -c 'readonly'` returns **26** (baseline 6 + 20 added)
- `readonly grade: "attested";`, `readonly grade: Exclude<ConsentGrade, "attested">;`, `readonly canonical: Readonly<Uint8Array>;` all present
- Property-name set of `types.ts` is **identical** before and after (109 members both sides) — no member added, removed, or renamed; `canonical` is the only retype
- All ten guard aliases present in their required files; all six mutations observed red with the predicted codes and counts
- `grep -c '@ts-expect-error' consent.test-d.ts` returns **3**, matching the prose ("Exactly three such directives appear below")
- Neither test file exports anything; no pre-existing `_`-prefixed alias deleted
- `git diff --stat HEAD~2 HEAD` touches exactly the three `files_modified` — **no** change to `README.md`, `STATE.md`, `ROADMAP.md`, or `src/index.ts`

---
*Phase: 01-type-surface-completion*
*Completed: 2026-07-28*
