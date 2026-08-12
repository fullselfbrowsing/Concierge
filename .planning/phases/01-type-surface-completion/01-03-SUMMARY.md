---
phase: 01-type-surface-completion
plan: 03
subsystem: types
tags: [typescript, transport, consent, turn-identity, delivery-report, type-testing, trust-boundary]

# Dependency graph
requires:
  - phase: 01-01
    provides: "tsconfig.test-d.json (the src + test-d program) and test-d/_assert.ts (Expect / Equals / Assignable / Not)"
  - phase: 01-02
    provides: "the measured one-line-predicate rule, without which four of five assertions here would have failed anonymously"
provides:
  - "ToolBatch.deferUntilDelivered corrected to (effect: (report: DeliveryReport) => void) => void — byte-identical to InvocationMeta's twin"
  - "TurnIdentityProvenance — none | agent-forgeable | human-attested, on a modality-free forgeability axis"
  - "TransportCapabilities.userTurnIdentity retyped from boolean to TurnIdentityProvenance (replaced, not supplemented)"
  - "test-d/transport.test-d.ts — five named predicates, two Transport fixtures, two capability fixtures"
  - "Four-mutant defect-first proof covering all five assertions, with observed diagnostics"
affects: [01-04, 01-05, 01-06, 01-07, 01-08, 01-09, phase-07-transport, phase-08-consent-kernel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provenance over presence: a capability field records where a fact comes from, not that it exists"
    - "Paired positive/negative assertions on a type nothing else reads (equality + rejection), so a regression cannot pass half the gate"
    - "Type-test predicates written on ONE line so tsc echoes the alias name rather than the predicate body"
    - "Structural fixtures named for their shape (streamingTransport, commandPaletteTransport), never for a vendor"

key-files:
  created:
    - packages/concierge/test-d/transport.test-d.ts
  modified:
    - packages/concierge/src/types.ts

key-decisions:
  - "userTurnIdentity REPLACED, not supplemented — D-12 item 3; alongside a surviving boolean, _provenanceNotBoolean is unwritable and there would be two sources of truth for one fact"
  - "Exactly three provenance members, named for the property not the modality — no voice/speech member, no fourth member"
  - "The ToolBatch hook doc describes the agreement with InvocationMeta in prose and does NOT paste the signature, so the parity grep counts implementations rather than quotations"
  - "The two Transport fixtures inline their capability literals rather than reusing the two named capability consts — this is what makes M6 produce 5 diagnostics instead of 3, matching VALIDATION's battery"
  - "No `.outcome` is read outside the type assertions, deliberately, so M2 produces exactly the 2 × TS2344 VALIDATION's table predicts"
  - "Transport itself untouched; TRN-01 needed no new type"
  - "index.ts left untouched; the export surface is plan 01-08's deliverable"

patterns-established:
  - "Every assertion proven live by mutation, not just the ones the plan mandates — `for each assertion`, four mutants for five aliases"
  - "Restore from git and assert `git diff --exit-code` after each mutant, so no broken state can be committed"

requirements-completed: [TRN-01, TRN-05, SC-1, SC-4, SC-5, SC-7c]

# Metrics
duration: 7min
completed: 2026-07-28
---

# Phase 01 Plan 03: Transport Delivery Hook and Turn-Identity Provenance Summary

**A transport now declares whether its turn identity is something the agent's own output could have minted, and both delivery hooks — including the transport-side one that no other test in the package reads — carry an outcome rather than a bare id.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-07-28T06:54:47Z
- **Completed:** 2026-07-28T07:01:54Z
- **Tasks:** 2/2
- **Files modified:** 2 (1 created, 1 modified) — `+225 / -4`

## Accomplishments

- **The security hole D-10 named is now representable.** `TransportCapabilities.userTurnIdentity` was a `boolean` that could record *whether* turn identity existed but not *where it came from*. A recognizer-derived `userTurnId` can be minted by the agent's own readback re-entering through the same input channel — the gate the whole design rests on, satisfied by the agent talking to itself with no human present. The field is now `TurnIdentityProvenance`, and `true` is no longer a legal value.
- **Escapee 2 is closed with a pair, not a single assertion.** `ToolBatch.deferUntilDelivered` had survived with the pre-fix bare-id signature precisely because every consent-shaped assertion in this package reads `InvocationMeta` and nothing reads `ToolBatch`. `_batchHook` (equality) and `_batchRejectsBareId` (rejection) both fire under the same mutation — verified, since a pair where only one member fires is not a pair.
- **All five assertions were watched to go red, not just the two the plan mandated.** The plan requires defect-first proof for M2 and M6. `_metaHook` and `_transportKeys` guard types this plan did not edit, so they could have been vacuous; two extra mutants prove they are not.
- **TRN-01's mechanical half was run, not asserted.** The vendor-vocabulary grep over `src/` and `test-d/` exits 0, and `_transportKeys` was proven to break when a fifth, vendor-shaped member is added to `Transport`.

## Task Commits

1. **Task 1: Correct the transport-side delivery hook and replace the turn-identity boolean (D-00a, D-10)** — `bca117a` (feat)
2. **Task 2: Author transport.test-d.ts defect-first (SC-1, SC-4/TRN-01, SC-5/TRN-05, SC-7c)** — `1aaa0df` (test)

## Files Created/Modified

- `packages/concierge/src/types.ts` (modified) — `+88 / -4`. The four removed lines are exactly the old `ToolBatch.deferUntilDelivered` signature, the old `userTurnIdentity: boolean` field, and the two one-line doc comments above them. Verified by `git diff | grep '^-'` before committing.
- `packages/concierge/test-d/transport.test-d.ts` (created) — 137 lines, exports nothing.

## What changed in `types.ts`

**Edit A — `ToolBatch.deferUntilDelivered` (D-00a, SC-1).** Now `(effect: (report: DeliveryReport) => void) => void`, identical to `InvocationMeta.deferUntilDelivered`. The doc comment states the twin relationship, why the two must stay in agreement, and that the effect receives a report rather than an id because a consumer that cannot see `outcome` cannot refuse a readback cut off partway. It deliberately does **not** paste the signature — the acceptance criterion counts occurrences on non-comment lines, and a quoted copy would both break the count's meaning and mislead a reader diffing the two sites.

**Edit B — `TurnIdentityProvenance` (D-10 / TRN-05).** Three members:

| Member | Meaning |
|---|---|
| `"none"` | No turn identity. Limited to the weaker `bindTo: "response"`. |
| `"agent-forgeable"` | Derived from a channel the agent's own output feeds back into. Real and ordered, but not evidence. |
| `"human-attested"` | Derived from an explicit human act the agent cannot perform. The only provenance under which a `userTurnId` is evidence. |

The axis is **forgeability by the agent's own output**, never voice versus text. No member names a modality. The acoustic recognizer case appears in the doc comment as the motivating example — it is the evidence, and omitting it would leave the type unexplained — but the member is named for the property. The doc also records that this is *not* the barge-in case (an echoed readback carries affirmative content and passes turn classification, where a human interrupting does not), and that **the runtime gate refusing `bindTo: "userTurn"` on an `"agent-forgeable"` transport is Phase 8** and must not be assumed present.

Two doc-only cross-references were added, at `InvocationMeta.userTurnId` and `ToolBatch.userTurnId`, both saying that presence is not the whole story and pointing at the provenance type. `Transport` itself is untouched.

## Defect-First Proof — four mutants, five assertions, all observed

Each mutation was applied to `packages/concierge/src/types.ts` with the Edit tool, typechecked, then restored with `git checkout -- packages/concierge/src/types.ts` and confirmed byte-identical by `git diff --exit-code` before the next mutant. `test-d/transport.test-d.ts` was never mutated, and no broken state was committed. Diagnostics below are `tsc --pretty` output, colour escapes stripped.

### M2 (mandatory) — `ToolBatch.deferUntilDelivered` reverted to the bare-id form

**Exit code: 2. Exactly 2 errors, both TS2344, matching VALIDATION's battery row.** Both members of the escapee pair fire:

```
packages/concierge/test-d/transport.test-d.ts:45:26 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
45 type _batchHook = Expect<Equals<NonNullable<ToolBatch["deferUntilDelivered"]>, (effect: (report: DeliveryReport) => void) => void>>;

packages/concierge/test-d/transport.test-d.ts:53:35 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
53 type _batchRejectsBareId = Expect<Not<Assignable<(effect: (id: string) => void) => void, NonNullable<ToolBatch["deferUntilDelivered"]>>>>;

Found 2 errors in the same file, starting at: packages/concierge/test-d/transport.test-d.ts:45
```

`_batchRejectsBareId` flipping under this mutation is also the proof that it is non-vacuous when green: with the correct signature, `(effect: (id: string) => void) => void` genuinely fails assignability under `strictFunctionTypes` (contravariance twice over — `string` is not assignable to `DeliveryReport`), rather than passing for some incidental reason.

### M6 (mandatory) — `TransportCapabilities.userTurnIdentity` reverted to `boolean`

**Exit code: 2. Exactly 5 errors, matching VALIDATION's "5 errors incl. TS2344 (`_provenanceNotBoolean`)".**

```
packages/concierge/test-d/transport.test-d.ts:66:37 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
66 type _provenanceNotBoolean = Expect<Not<Assignable<true, TransportCapabilities["userTurnIdentity"]>>>;

packages/concierge/test-d/transport.test-d.ts:75:3 - error TS2322: Type 'string' is not assignable to type 'boolean'.
75   userTurnIdentity: "agent-forgeable",
  packages/concierge/src/types.ts:635:3
    The expected type comes from property 'userTurnIdentity' which is declared here on type 'TransportCapabilities'

packages/concierge/test-d/transport.test-d.ts:83:3 - error TS2322: Type 'string' is not assignable to type 'boolean'.
83   userTurnIdentity: "human-attested",

packages/concierge/test-d/transport.test-d.ts:103:5 - error TS2322: Type 'string' is not assignable to type 'boolean'.
103     userTurnIdentity: "agent-forgeable",

packages/concierge/test-d/transport.test-d.ts:122:5 - error TS2322: Type 'string' is not assignable to type 'boolean'.
122     userTurnIdentity: "human-attested",

Found 5 errors in the same file, starting at: packages/concierge/test-d/transport.test-d.ts:66
```

The five are the predicate plus four capability literals: two standalone `TransportCapabilities` consts and two inlined inside the `Transport` fixtures. This is why the fixtures inline their capabilities rather than reusing the named consts — reuse would have produced 3 diagnostics and quietly diverged from the phase battery.

### M-a (extra) — `InvocationMeta.deferUntilDelivered` reverted to the bare-id form

**Exit code: 2.** `_metaHook` guards a type this plan did not edit, so it could have been vacuous. It is not:

```
packages/concierge/test-d/transport.test-d.ts:36:25 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
36 type _metaHook = Expect<Equals<NonNullable<InvocationMeta["deferUntilDelivered"]>, (effect: (report: DeliveryReport) => void) => void>>;
```

### M-b (extra) — a fifth, vendor-shaped member added to `Transport`

`onVendorEvent?: (name: string) => void;` added to the interface. **Exit code: 2.** This is TRN-01's asserted half demonstrated rather than claimed — a vendor event hook cannot be added to the seam without breaking the build:

```
packages/concierge/test-d/transport.test-d.ts:137:22 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
137 type _transportKeys = Expect<Equals<keyof Transport, "capabilities" | "setTools" | "onToolBatch" | "respond">>;
```

### SC-4 / TRN-01 mechanical half — the grep

Run verbatim, as the plan requires it be recorded:

```
test -z "$(grep -rniE 'response\.done|conversation\.item|session\.update' packages/concierge/src packages/concierge/test-d)"
```

**Exit code: 0.** No match in either directory, comments included. The full Task 2 verify chain — typecheck `&&` grep `&& echo NO_VENDOR_VOCABULARY` — printed `NO_VENDOR_VOCABULARY` and exited 0.

## Deviations from Plan

**None affecting the artifacts.** The plan executed as written. Two judgement calls worth recording, neither a departure:

1. **Two extra mutants beyond the plan's two.** The orchestrator's brief says defect-first proof is required "for each assertion", while the plan's acceptance criteria name only M2 and M6. `_metaHook` and `_transportKeys` guard types this plan did not edit and would have been the two most plausible places for a vacuous assertion to hide, so both were mutated (M-a, M-b). Both fired. No source file was left mutated.
2. **The RESEARCH predicates were not copied verbatim.** `01-RESEARCH.md` lines 867–883 and 960–1002 wrap every `Expect<…>` across three lines. Plan 01-02 measured that this puts the alias name on a line `tsc` never echoes, making the diagnostic anonymous. All five predicates here are single-line, and every mutant above confirms the alias name lands in the output. This is the previous wave's Rule 1 finding applied, not a new deviation.

### Environment

`node_modules` was absent from this worktree (worktrees do not share it with the main checkout). `pnpm install --frozen-lockfile` restored the two already-pinned packages; the lockfile is unchanged and `git diff` shows no entry for it. No package was installed, so the Package Legitimacy Gate did not trigger. This is the third consecutive Phase 1 worktree to need it — expect it in 01-04 onward.

### Not Done, Deliberately

- **`packages/concierge/src/index.ts` was not edited.** `TurnIdentityProvenance` is therefore not yet importable from the package entry point. `01-08-PLAN.md` owns the export surface; editing it here would collide. `transport.test-d.ts` imports from `"../src/types.js"` directly, so nothing in this plan depends on it. The debt now stands at `FailureReason`, `ReasonCode`, `MESSAGE_MAX_CHARS` (01-02) plus `TurnIdentityProvenance` (this plan).
- **No `report.outcome` is read outside the type assertions.** A consumer-shaped demonstration (a function refusing a non-`completed` outcome) was drafted and dropped: it would add a TS2339 to M2's output, taking that mutant from the 2 diagnostics VALIDATION's battery predicts to 3. The equality assertion already proves the effect sees `outcome`; perturbing a phase-level artifact to restate it was not worth it.
- **`STATE.md` and `ROADMAP.md` untouched**, per the orchestrator's instruction. `git diff --name-only <base>..HEAD` lists exactly two files.

## Verification Results

| Check | Result |
|---|---|
| `pnpm --filter @fullselfbrowsing/concierge typecheck` | exit **0** |
| `pnpm typecheck` (repo root) | exit **0** |
| `transport.test-d.ts` present in the program (`tsc --listFiles`) | **yes** |
| M2 observed non-zero with 2 × TS2344 naming `_batchHook`, `_batchRejectsBareId` | **yes** |
| M6 observed non-zero with TS2344 naming `_provenanceNotBoolean` + 4 literal errors | **yes**, 5 total |
| M-a observed non-zero naming `_metaHook` | **yes** |
| M-b observed non-zero naming `_transportKeys` | **yes** |
| `types.ts` restored byte-identical after every mutant (`git diff --exit-code`) | **yes**, 4/4 |
| Every mutant diagnostic carried its alias name on the echoed line | **yes**, 5/5 aliases |
| `export type TurnIdentityProvenance` present with exactly 3 members | **yes** |
| `userTurnIdentity: TurnIdentityProvenance` present | **1** |
| `userTurnIdentity: boolean` anywhere | **0** |
| `grep -v '^[[:space:]]*[*/]' src/types.ts \| grep -c "deferUntilDelivered?: (effect: (report: DeliveryReport) => void) => void"` | **2** |
| `deliveredResponseId` on any non-comment line | **0** (one surviving mention, in `DeliveryReport`'s doc describing the earlier draft) |
| `keyof Transport` still exactly `capabilities`, `setTools`, `onToolBatch`, `respond` | **yes**, asserted and mutation-proven |
| `grep -in "voice\|speech\|microphone" src/types.ts`, comment lines filtered out | **0** — every match is inside a doc comment |
| `test -z "$(grep -rniE 'response\.done\|conversation\.item\|session\.update' src test-d)"` | exit **0** |
| Five named aliases in `transport.test-d.ts` | all **1** each |
| Values annotated `: Transport = {` | **2** |
| Values annotated `: TransportCapabilities = {` | **2** |
| `as` casts on non-comment lines | **0** |
| Local redefinition of `Expect`/`Equals`/`Assignable`/`Not` | **0** |
| Imports from `"./_assert.js"` and `"../src/types.js"` | both present |
| Vendor SDK import | **0** |
| `test -z "$(grep -l '^[[:space:]]*export' test-d/*.test-d.ts)"` | exit **0** |
| `transport.test-d.ts` line count | **137** (min_lines 50) |
| File deletions across both commits | **none** |
| Untracked files left behind | **none** |
| `.planning/STATE.md`, `.planning/ROADMAP.md` | untouched |
| `pnpm-lock.yaml` | unchanged |

## Threat Model Compliance

| Threat ID | Disposition | Status |
|---|---|---|
| T-01-07 | mitigate | **Phase 1's half closed.** `TransportCapabilities.userTurnIdentity` is `TurnIdentityProvenance`; a transport whose turn identity the agent can mint is now distinguishable in the type system, and `_provenanceNotBoolean` fires the moment the field regresses (M6, 5 diagnostics). **The runtime gate that refuses `bindTo: "userTurn"` on `"agent-forgeable"` is Phase 8 and is not present.** Nothing today stops a transport from declaring `"human-attested"` while deriving identity from a recognizer — see Known Stubs. |
| T-01-08 | mitigate | Closed. Both hooks carry a `DeliveryReport` with an explicit `outcome`, so partial delivery is representable on the transport side as well as the consent side. `_batchHook` and `_batchRejectsBareId` were both observed to fire under M2. |
| T-01-09 | mitigate | Closed for this plan. `_transportKeys` pins `keyof Transport` to four members and was proven to break when a fifth vendor-shaped member is added (M-b); the recursive grep over `src/` and `test-d/` exits 0. Both halves ran. |
| T-01-SC | accept | No packages installed. `pnpm-lock.yaml` unchanged; `pnpm install --frozen-lockfile` was restoration only. |

**No new threat surface.** This plan adds no runtime code paths — type declarations and doc comments only. `test-d/` is outside `src/` and outside the emit program.

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or trust-boundary schema change. `TurnIdentityProvenance` *describes* an existing trust boundary (the recognizer/acoustic channel already in the threat register as T-01-07) rather than introducing one.

## Known Stubs

None in this plan's artifacts — every declaration is a complete type, and no placeholder value or empty literal was introduced.

One **inherited, deliberate** gap the verifier should not mistake for completion: `TurnIdentityProvenance` is a *self-declaration by the transport*, and the kernel has no independent way to verify it. A transport that declares `"human-attested"` while deriving turn identity from a recognizer defeats the gate entirely, and **nothing in the codebase currently checks the declaration or acts on it** — there is no consumer of `userTurnIdentity` anywhere yet. That is by design: D-10 splits the work, Phase 1 ships representability plus the type test, Phase 8 ships the runtime refusal. The doc comment on the field says so explicitly ("Self-declared, and the kernel has no independent way to verify it... Understate when unsure"), so the limitation is documented rather than implicit. Until Phase 8 lands, the security value of this plan is that the distinction is *expressible*, not that it is *enforced*.

## Notes for Plans 01-04 through 01-09

1. **The one-line predicate rule held up under measurement again.** All five aliases here appeared in their mutant diagnostics. The RESEARCH examples for SC-3, SC-6, SC-7a and onward are wrapped the same way 01-02 flagged — do not copy them verbatim.
2. **Check your mutant's diagnostic *count* against VALIDATION's battery, not just its exit code.** Reusing a fixture where the battery expects a literal silently changes the count. The choice to inline capabilities in the two `Transport` fixtures is what keeps M6 at 5.
3. **Prove the assertions the plan does not name.** `_metaHook` and `_transportKeys` guard types no task edited and were the likeliest place for a vacuous predicate to hide. Two extra mutants cost about a minute.
4. **`index.ts` debt is now four symbols**: `FailureReason`, `ReasonCode`, `MESSAGE_MAX_CHARS`, `TurnIdentityProvenance`. Plan 01-08 must add all of them plus whatever 01-04 through 01-07 introduce.

## Self-Check: PASSED

- `packages/concierge/src/types.ts` — FOUND
- `packages/concierge/test-d/transport.test-d.ts` — FOUND
- `.planning/phases/01-type-surface-completion/01-03-SUMMARY.md` — FOUND
- Commit `bca117a` (Task 1) — FOUND in git log
- Commit `1aaa0df` (Task 2) — FOUND in git log
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — exit 0
- Vendor-vocabulary grep — exit 0
- `.planning/STATE.md` and `.planning/ROADMAP.md` absent from the diff against base `a0e5fb7`
