---
phase: 01-type-surface-completion
verified: 2026-07-28T17:05:00Z
status: passed
score: 7/8 must-haves verified, 1 overridden
overrides_applied: 1
reopened_and_reclosed:
  - date: 2026-07-28
    trigger: >-
      Code review (01-REVIEW.md) found defects this verification could not have caught. The
      verifier re-ran the phase's existing 19-mutation battery and correctly found zero
      escapees; the reviewer wrote 17 NEW mutations against uncovered surface and 14 escaped,
      two of them critical. A green suite measured only what it already knew to ask.
    criticals:
      - id: CR-01
        defect: >-
          ConsentAck's members were writable, so `ack.grade = "attested"` compiled with no cast.
          The two-branch union constrained construction, never mutation. Worse than a missing
          block — the compiler then narrowed `readbackHash` to `string` when the runtime value
          was `undefined`, at exactly the idiom the phase's own narrowsThroughTheUnion test
          teaches. Directly violated the project's core value.
        closed_by: plan 01-10 (readonly on 20 members across 5 consent-critical declarations)
        evidence: "Orchestrator-verified: the launder exploit now fails with TS2540 'Cannot assign to grade because it is a read-only property'; suite green after probe removal."
      - id: CR-02
        defect: >-
          Bridge's type parameters defaulted to Record<string, never> — the bottom of each
          constraint rather than the top — so no bridge with real members satisfied
          `B extends Bridge`, including the canonical example in CLAUDE.md. The suite never
          instantiated Bridge with a member, so both parameters were exercised only at their
          broken defaults.
        closed_by: plan 01-11
        evidence: "Orchestrator-verified: Bridge<{applyFilter},{count}> extends Bridge now resolves true (previously false)."
    closure: >-
      Plans 01-10 … 01-15 (waves 10-15). All 12 findings closed, each by exactly one plan.
      Plan 01-15 was a dedicated re-gate: a 24-mutation battery confirming all 10 original
      detectors still fire AND all 14 escapees now flip — GAP_GATE_PASS. `pnpm typecheck`
      exits 0, tree clean at 7bae041.
    process_note: >-
      The gap plan-checker found that three of its four blockers were guards added without
      ever being observed failing — the same defect the sequence existed to close, reproducing
      inside the fix. One would have rebuilt WR-04's self-referential vacuity inside the plan
      closing WR-04. Revision mandated an observed-failure step for every new guard.
    open_for_user:
      - "WR-06 is UNRATIFIED. Plan 01-13 carried a blocking checkpoint (autonomous: false) whose own threat entry T-01-63 covers an agent answering it; the execution agent answered it anyway, choosing option-b (keep the flat ActionResult shape), and recorded it as unratified in three places. Consequence: `{ ok: true, reason: \"handler_error\" }` remains legal at the type level, with rejection deferred to a Phase 6 runtime normalizer. The alternative — a discriminated union on `ok` — is free before publish and breaking after."
      - "SEC-01 doc defect: CLAUDE.md:21 and REQUIREMENTS.md:85 both claim redaction 'defaults to drop', which the shipped required ActionDefinition.redact makes unreachable. Left untouched deliberately — CLAUDE.md is the user's instruction file."
overrides:
  - truth: "The published README's ActionResult block matches the shipped type (plan 01-08 must_have)"
    accepted_by: user
    accepted_at: 2026-07-28
    decision: >-
      Accepted as closed-by-deletion. The user rewrote README.md as a positioning page
      (commit bc9ca88) mid-phase, deleting the design-contract section that carried the
      stale `reason?: string` line. When the collision surfaced, the user was presented
      with the choice explicitly and selected "commit my README rewrite, then run 01-08
      adapting Task 2 (exports land; README treated as fixed-by-deletion, deviation
      recorded)". Plan 01-08's Task 2 was amended by the orchestrator accordingly and the
      executor made no edit to README.md.
    rationale: >-
      Threat T-01-26 is a false public claim about a consent type. Deleting the claim
      closes the threat as completely as correcting it would have — a README that
      documents no type contract cannot contradict one. The verifier independently
      confirmed the rewritten 01-VALIDATION row 01-08-T2 tests what T-01-26 actually
      requires, and that it passes.
    residual_risk: >-
      The check now passes VACUOUSLY. It verifies only that the README does not document
      the contract wrongly, not that it documents it at all. The design contract is no
      longer published anywhere in README.md. This is a doc-coverage gap, not a
      correctness or breaking-change gap — README prose is not a public type. Carried
      forward as a documentation item, not a Phase 1 defect.
    supersedes_gap: true
gaps: []
resolved_gaps:
  - truth: "The published README's ActionResult block matches the shipped type (plan 01-08 must_have)"
    status: overridden
    reason: >-
      Superseded by the user's own commit bc9ca88, which rewrote README.md as a positioning
      page and deleted the entire design-contract section. The artifact check
      (README.md contains "ReasonCode") and the key_link (README.md -> ActionResult.reason
      via /reason\?:/) both resolve to NOT FOUND. The underlying threat T-01-26 — a
      published README asserting an open `reason?: string` against a shipped twelve-member
      closed union — IS closed, but by deletion of the claim rather than correction of it.
      This does NOT block the phase goal: README prose is not a public type and its absence
      creates no post-publish breaking change. All 7 ROADMAP Success Criteria are VERIFIED.
    artifacts:
      - path: README.md
        issue: "Zero type-contract content. grep for userTurnIdentity|deferUntilDelivered|readbackHash|ConsentAck|reason?:|TransportCapabilities|snapshotEquality|ReasonCode|ActionResult returns no lines."
    missing:
      - "EITHER an `overrides:` entry accepting deletion-closes-the-threat (recommended — the amendment is already reasoned in 01-VALIDATION.md lines 99-124)"
      - "OR a README design-contract block regenerated from the shipped types.ts"
deferred:
  - truth: "A transport whose turn identity can be minted by the agent's own output cannot satisfy the strongest user-turn binding (TRN-05 enforcement half)"
    addressed_in: "Phase 8"
    evidence: "ROADMAP Phase 8 Notes: 'The TRN-05 runtime gate. Phase 1 makes turn-identity provenance representable; this phase refuses bindTo: \"userTurn\" on a transport whose turn identity is agent-forgeable.' Phase 1's SC-5 requires only type-system distinguishability, which is VERIFIED. types.ts:958-960 states the same boundary in-code."
  - truth: "M9 gains a second, named detector so its symptom is not a lone unused-directive diagnostic"
    addressed_in: "Phase 2"
    evidence: "01-09 decision: test-d/ outside the gate plan's files_modified; assertion handed forward complete. Independently confirmed non-blocking — SC-7a as literally worded is caught by 3x TS2322, not only by the TS2578 symptom."
  - truth: "Scheduler's own shape is pinned by an assertion"
    addressed_in: "Phase 6"
    evidence: "ROADMAP Phase 6 owns DSP-08; RESEARCH A3 marks the signature MEDIUM-risk and expects Phase 6 to refine it. types.ts:1065-1072 records the same. A pin now would fire on a sanctioned edit."
  - truth: "MESSAGE_MAX_CHARS export-placement regression guard (importing from ../src/index.js)"
    addressed_in: "Phase 2"
    evidence: "Current state independently verified CORRECT — dist/index.js carries a real runtime re-export and node resolves MESSAGE_MAX_CHARS to 180. The missing item is a regression guard only, not an unmet requirement. Phase 2 brings the test runner."
  - truth: "`pnpm build` succeeds at the repo root"
    addressed_in: "Phase 2"
    evidence: "ROADMAP Phase 2 goal 'The package that will carry the kernel can be built, published, and installed correctly'; PKG-01/PKG-02 require a packed artifact; Phase 2 Notes state 'there is no bundler, no test runner, no changesets, and no CI'. Phase 1's own gate never used `pnpm build` — it used `tsc -p tsconfig.json`, which exits 0 and emits correct output."
human_verification:
  - test: "Decide whether README.md deleting the design-contract section is the accepted closure for threat T-01-26, or whether a contract block should be regenerated."
    expected: "Either an overrides: entry is added to this file, or README.md regrows a contract block generated from packages/concierge/src/types.ts."
    why_human: "Editorial decision on the user's own commit (bc9ca88). A verifier must not fight a deliberate authoring choice, and cannot decide product documentation scope."
  - test: "Code-review that DigestLike (packages/concierge/src/types.ts:641-643) still uses METHOD syntax — `digest(algorithm: ..., data: ...): Promise<ArrayBuffer>` — and not a function-valued property."
    expected: "Method syntax intact. Confirmed present today at line 642."
    why_human: "types.ts:631-639 states this seam has NO mutant and cannot get one: the discriminator is the DOM-vs-Node BufferSource split, and neither typing is installed in this repo, so no in-repo edit can make a wrong DigestLike fail to compile. The positive assertion in consent.test-d.ts stays green under the wrong syntax. Review + grep are the only defences and this is by design, not by omission."
  - test: "Confirm `crypto.subtle` (browser) and `webcrypto.subtle` from node:crypto both assign to DigestLike with no wrapper or cast, in a scratch project that has DOM and @types/node installed."
    expected: "Both assign unmodified."
    why_human: "Requires DOM lib and Node typings that this package deliberately excludes; unverifiable inside the repo's lib: [\"ES2022\"] program."
  - test: "Update .planning/STATE.md and .planning/REQUIREMENTS.md to reflect Phase 1 completion."
    expected: "STATE.md shows completed_phases >= 1, completed_plans 9, and a status other than 'Plan 1 of 9 / percent 0'. REQUIREMENTS.md flips TRN-01 and TRN-05 from `- [ ]` / 'Pending'."
    why_human: "Orchestration bookkeeping outside the phase's code scope; requires a decision on whether these are updated per-phase or at milestone audit."
---

# Phase 1: Type surface completion — Verification Report

**Phase Goal:** Every public type the consent kernel and the adapters will be built against is final — the remaining defects that would become breaking changes after publish are closed.
**Verified:** 2026-07-28T17:05:00Z
**Status:** gaps_found (documentation-only; goal itself achieved)
**Re-verification:** No — initial verification

## Verdict up front

**The phase goal is achieved.** All seven ROADMAP Success Criteria are VERIFIED, and — critically — verified by **independent re-execution of the mutation battery in an isolated sandbox**, not by reading SUMMARY.md. I ran 19 distinct mutations against the shipped `types.ts`: the phase's own ten, six more that I designed from SC-7's *literal roadmap wording* (which differs from some battery mutants), the literal pre-fix `reason?: string` form, and the exact probe the interrupted 01-05 session left behind. **All 19 were caught.** Zero escapees.

The single gap is a plan-level *documentation* must-have invalidated by the user's own README rewrite. It creates no post-publish breaking change and does not block Phase 2.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Both delivery hooks carry a completion outcome | VERIFIED | `InvocationMeta.deferUntilDelivered` types.ts:242 and `ToolBatch.deferUntilDelivered` types.ts:934 are byte-identical signatures over `DeliveryReport`; `outcome: "completed" \| "interrupted"` types.ts:259. Guards `_metaHook`/`_batchHook`/`_batchRejectsBareId`. **Mutation-proven both directions:** ToolBatch→bare id = 2× TS2344; InvocationMeta→bare id = TS2344 on `_metaHook`. |
| 2 | Arbitrary failure string fails to typecheck; closed reason set; message policy + declared bound | VERIFIED | 12 codes = 3 `AbandonReason` + 9 `FailureReason` (types.ts:107-180), incl. `invalid_result` for "returned something that is not a result at all" (types.ts:144). `MESSAGE_MAX_CHARS = 180` literal survives to `.d.ts:177` and resolves at runtime. Never-a-consent-artifact policy at types.ts:81-87. **Mutation-proven:** open `string` = 5 errors incl. TS2375 on the computed idiom; widen bound to `number` = TS2344. |
| 3 | Readback returns a receipt — hash, alg, canonicalization rule, canonical bytes | VERIFIED | `ReadbackReceipt {hash, alg:"SHA-256", canonicalization:"JCS", canonical: Uint8Array}` types.ts:561-576. Producer chain closed: `ReadbackSink` → receipt.hash → `DeliveryReport.readbackHash` → `ConsentAck.readbackHash`. Arrival seam `ConciergeConfig.presentReadback` types.ts:1135. `canonical` is what removes the re-serialize requirement. **Mutation-proven:** drop `canonical` = TS2353; widen `alg` = TS2344. |
| 4 | Transport definable end to end, no vendor event name, second shape sharing no wire vocabulary (TRN-01) | VERIFIED | `keyof Transport` pinned to exactly 4 members (`_transportKeys`). Two fixtures differing on all four capability axes — `streamingTransport` (relayed/agent-forgeable/parallel/dynamic) and `commandPaletteTransport` (attested/human-attested/serial/static) — satisfy one interface with no casts. Vendor-event grep over `src/` + `test-d/` returns nothing. |
| 5 | Turn identity provenance, not presence; agent-mintable distinguishable in the type system (TRN-05) | VERIFIED | `TurnIdentityProvenance = "none" \| "agent-forgeable" \| "human-attested"` types.ts:962-981; `TransportCapabilities.userTurnIdentity` retyped from `boolean` types.ts:998. `_provenanceNotBoolean` fires on regression. **Mutation-proven:** back to `boolean` = 5 errors incl. TS2344. *(Runtime refusal of `bindTo:"userTurn"` is Phase 8 — see Deferred.)* |
| 6 | Compiler, not a doc comment, enforces attested ⇒ readbackHash | VERIFIED | `ConsentAck` is a two-branch union over non-exported `ConsentAckBase`; attested branch carries required `readbackHash: string` types.ts:504. Union shape survives declaration emit (`dist/types.d.ts:417-431`) and `ConsentAckBase` stays unexported. **Mutation-proven twice:** flatten to one interface, and (softer) make the attested hash optional while keeping the union — both = TS2344 on `_attestedNeedsHash` + TS2322 in `narrowsThroughTheUnion`. |
| 7 | Suite fails when any corrected defect is reintroduced; adequacy proven by mutation, not by green | VERIFIED | Independently re-ran the full ten-mutant battery **plus 9 more**. See the two tables below. All 19 caught. Both documented silences (M4 fires no TS2578; M10 does not fire `_requiresIsString`) independently confirmed at 0. |
| 8 | *(plan 01-08)* The published README's ActionResult block matches the shipped type | **FAILED** | README.md carries no type contract at all after user commit `bc9ca88`. See Gaps. |

**Score:** 7/8 must-haves verified — **7/7 ROADMAP Success Criteria VERIFIED.**

### Probe Execution — ten-mutant battery, independently re-run

Run in an isolated `/tmp` sandbox mirroring the package against the repo's own `node_modules` and `tsconfig.base.json`. **The working tree was never mutated** (`git status --porcelain` empty before and after; `git diff --exit-code` clean).

| Mutant | Reintroduced defect | Exit | Diagnostics observed | Guard named | Matches VALIDATION.md |
|---|---|---|---|---|---|
| M1 | `reason` → open `string` | 2 | 5 errors: TS2344 ×2, TS2578, TS2322, **TS2375** | `_reasonClosed`, `_reasonAdmitsUndefined`, freshness directive, `never` arm, `_computedReasonAssigns` | YES |
| M2 ⚑ | `ToolBatch` hook drops the outcome | 2 | 2 × TS2344 | `_batchHook` (:45), `_batchRejectsBareId` (:53) — **both halves fired** | YES |
| M3 | `ActionDefinition` drops the `ConsentPolicy` arg | 2 | TS2322 ×2, TS2344 | `_snapshotInferred` (:180) | YES |
| M4 | `ConsentAck` flattened to one interface | 2 | TS2344, TS2322 | `_attestedNeedsHash` (:246), `narrowsThroughTheUnion` (:282). **TS2578 count = 0** | YES (incl. the correction) |
| M5 ⚑ | `ReadbackSink` → defaulted generic alias | 2 | TS2344, TS2578 | `_sinkShape` (:129), `_sinkTakesNoTypeArgs` (:134) — **both halves fired** | YES |
| M6 | `userTurnIdentity` → `boolean` | 2 | 5 errors: TS2344, TS2322 ×4 | `_provenanceNotBoolean` (:66) | YES |
| M7 | `readsUntrusted` moved into `SideEffects` | 2 | TS2339, TS2578, TS2353 | `_readsUntrustedOnDefinition` (:211), `_notInSideEffects` directive (:220) | YES (superset) |
| M8 ⚑ | `handler` drops `Snapshot`/`AckPayload` | 2 | **1** error: TS2344 | `_handlerAck` (:198) — **sole diagnostic in the entire repository** | YES |
| M9 | `snapshotEquality` → method syntax | 2 | **1** error: TS2578 | `_policyDegraded`'s directive (:140) | YES |
| M10 | `requires` typed as the action's name union | 2 | 2 × TS2344 | `_nameNotWidened` (:177), `_snapshotInferred` (:180). **`_requiresIsString` silent** | YES (incl. the correction) |

⚑ = one of the three escapees that survived a first-draft suite. All three confirmed load-bearing.

**Post-restore baseline exit: 0. Escaped: NONE.** Every claim in `01-VALIDATION.md`'s battery table and every claim in `01-09-SUMMARY.md`'s battery table reproduced exactly, including both "expected silences."

### Probe Execution — nine additional mutations I designed independently

These test SC-7's defects **as the ROADMAP literally words them**, which differs from several battery mutants (e.g. SC-7a says `snapshotEquality` degraded to `(a: unknown, b: unknown)`; battery M9 instead tests method-syntax bivariance — a different edit).

| # | Mutation | Exit | Result |
|---|---|---|---|
| SC-7a-literal | `snapshotEquality?: (a: unknown, b: unknown) => boolean` | 2 | CAUGHT — 3 × TS2322 (`_policyTyped` :121, `confirm` :173, `cancelShipment` :236) |
| SC-7c-meta | `InvocationMeta` hook drops the completion reason (the *other* interface) | 2 | CAUGHT — TS2344 on `_metaHook` (:36) |
| SC-7f-soft | attested branch `readbackHash` made optional, union kept | 2 | CAUGHT — TS2344 + TS2322 |
| SC-3-bytes | `ReadbackReceipt` loses `canonical` | 2 | CAUGHT — TS2353 |
| SC-3-alg | `ReadbackReceipt.alg` widened to `string` | 2 | CAUGHT — TS2344 (:69) |
| SC-2-bound | `MESSAGE_MAX_CHARS` widened to `number` | 2 | CAUGHT — TS2344 (:108) |
| M1-strict | `reason?: string` — the literal pre-fix defect | 2 | CAUGHT — 5 errors incl. TS2375 |
| **01-05 probe** | `ConsentAckBase.payload` → `unknown` — *the exact probe the interrupted session left behind* | 2 | **CAUGHT — TS2344 on `_commonPayload` (:302), the SOLE diagnostic** |
| 01-05 probe b | `ConsentAckBase.snapshot` → `unknown` | 2 | CAUGHT — TS2344 on `_commonSnapshot` (:299), sole diagnostic |

### Orchestrator's five flagged items — independently checked

| # | Item | Finding |
|---|---|---|
| 1 | 01-05 recovery: is `payload: Payload` intact and `_commonPayload` present? | **CONFIRMED CLEAN.** `payload: Payload` at `types.ts:424` (`ConsentAckBase`) and `:535` (`Readback`). Traced across every 01-05 commit (`08cfc77`, `2fcc9f4`, `03b9b68`, `db77bfd`, `5251c26`, HEAD) — `payload: Payload` at every one; the probe was never committed. `_commonPayload` present in `consent.test-d.ts:302` at `2fcc9f4` onward (not retro-added). **And it is load-bearing:** reapplying the exact probe produces exactly one diagnostic in the whole repo, and it is `_commonPayload`. Highest-risk item resolves fully. |
| 2 | README rewritten mid-phase; T-01-26 closed by deletion | **ACCEPTABLE ON THE MERITS, but the plan must-have fails literally.** README carries zero contract claims, so it cannot contradict the shipped types — the threat is genuinely closed. Its remaining claims ("The public TypeScript contract for actions, transports, bridges, results, and consent", "Type-level tests for the highest-risk parts") are accurate. But plan 01-08's `must_haves` demand `README.md contains "ReasonCode"` and a `reason?:` link, both NOT FOUND. Recorded as the one gap; override suggested below. Note the report's own caveat stands: the README now documents **no** type contract, and the manual grep passes **vacuously**. |
| 3 | 01-09 rewrote VALIDATION row 01-08-T2 — does it test what T-01-26 requires? | **YES.** Ran it: `grep -c "reason?: string" README.md \| grep -qx 0` → `README_NO_STALE_CONTRACT`. T-01-26 is "a published README asserting an open `reason?: string` against a shipped closed union" — asserting the *absence of the false claim* is precisely the threat's negation, and it still fires if a future README regrows a contract block carrying the stale type. The replaced command (`grep -n "reason?: ReasonCode" README.md && …`) genuinely could never pass. Repair, not evasion. |
| 4 | Three deferrals out of this phase — legitimate? | **All three legitimate; none leaves a Phase 1 must-have unmet.** (a) *M9 second detector → Phase 2*: I independently verified SC-7a **as roadmap-worded** is caught by 3 × TS2322, so the lone-TS2578 fragility applies to the method-syntax variant only — a robustness improvement, not a hole. (b) *`Scheduler` pin → Phase 6*: Phase 6 owns DSP-08 and is expected to change the signature; a pin now would fire on a sanctioned edit. (c) *`MESSAGE_MAX_CHARS` guard → Phase 2*: I verified the **current state is correct** — `dist/index.js` emits a real runtime re-export and `node` resolves it to `180`; the missing piece is a regression guard only. 01-09's warning that the existing `_messageBound` does *not* cover it is accurate (it imports from `types.js`, not `index.js`). |
| 5 | `pnpm build` fails — is that Phase 2's scope? | **CONFIRMED, and the judgment is correct.** Reproduced: `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`. Phase 1 ships types only; no SC mentions a build script; Phase 1's own gate used `tsc -p tsconfig.json` (which **exits 0** and emits correct `dist/`). PKG-01…PKG-05 all map to Phase 2, whose Notes state "there is no bundler, no test runner, no changesets, and no CI." Deferred, not a gap. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/concierge/src/types.ts` | The corrected public type surface | VERIFIED | 1242 lines. All 12 target declarations present and correctly shaped. Mutation-proven at 19 points. |
| `packages/concierge/src/index.ts` | Complete export surface | VERIFIED | 70 lines. Diffed declared-vs-re-exported: **zero** gaps, zero dangling. 42 named + `StandardSchemaV1` = 43, all re-exported. 4 values in the value block; runtime resolution confirmed via `node`. |
| `packages/concierge/test-d/_assert.ts` | 4 predicate aliases, zero deps | VERIFIED | `Expect`/`Equals`/`Assignable`/`Not`. Conditional-identity `Equals` (non-distributive), as required. |
| `packages/concierge/test-d/results.test-d.ts` | SC-2, SC-7d | VERIFIED | 108 lines. 12-arm exhaustive switch with `never` default. Fires on 3 distinct mutations. |
| `packages/concierge/test-d/transport.test-d.ts` | SC-1, SC-4, SC-5, SC-7c | VERIFIED | 137 lines. Fires on 3 distinct mutations. |
| `packages/concierge/test-d/consent.test-d.ts` | SC-3, SC-6, SC-7e, SC-7f | VERIFIED | 302 lines. Fires on 7 distinct mutations. |
| `packages/concierge/test-d/actions.test-d.ts` | SC-7a/b/g, escapee 3, erasure | VERIFIED | 354 lines. Fires on 6 distinct mutations. |
| `packages/concierge/tsconfig.test-d.json` | src + test-d in one program | VERIFIED | `extends ./tsconfig.json`, `noEmit: true`, `rootDir: "."`, correct include. Build config untouched. |
| `01-VALIDATION.md` | Signed-off strategy | VERIFIED | `status: complete`, `nyquist_compliant: true`, 19 task rows (gate requires ≥19). |
| `README.md` | Design-contract block agreeing with types.ts | **FAILED** | No contract block. See Gaps. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `package.json` | `tsconfig.test-d.json` | typecheck script | WIRED | `"typecheck": "tsc -p tsconfig.test-d.json"` |
| `ToolBatch.deferUntilDelivered` | `DeliveryReport` | effect callback param | WIRED | types.ts:934; M2 proves it load-bearing |
| `TransportCapabilities.userTurnIdentity` | `TurnIdentityProvenance` | field type | WIRED | types.ts:998; M6 proves it |
| `ReadbackSink` | `ReadbackReceipt` | generic-function return | WIRED | types.ts:605 exact form; M5 proves it |
| `ReadbackSink` | `ConciergeConfig.presentReadback` | injected seam | WIRED | types.ts:1135; `_configPresentReadback` pins field-to-alias |
| `ConsentAck` attested branch | `readbackHash` | required member on that branch only | WIRED | types.ts:504; survives `.d.ts` emit |
| `ConsentAck` | `ServerChallenge` | optional `challenge?` on shared base | WIRED | types.ts:440; brand blocks minting (TS2322) |
| `ActionDefinition.handler` | `ActionHandler<…, Snapshot, AckPayload>` | forwarded type args | WIRED | types.ts:742; M8 = sole diagnostic in repo |
| `StageDefinition.actions` / `crossStage` | `AnyActionDefinition` | erased collection | WIRED | types.ts:881, :1104; heterogeneous fixtures assemble with no `as` cast |
| `index.ts` | `types.ts` | `export type` re-export | WIRED | Zero-gap diff |
| `README.md` | `ActionResult.reason` | rendered design contract | **NOT_WIRED** | Section deleted in `bc9ca88` |

### Data-Flow Trace (Level 4)

Not applicable in the usual sense — this phase ships **no runtime**, by design. The equivalent check is that the type surface reaches a consumer intact:

| Artifact | "Data" | Source | Reaches consumer | Status |
|---|---|---|---|---|
| `dist/index.d.ts` | Public type surface | `src/types.ts` via `src/index.ts` | Union shape, generic-function sink, unexported `ConsentAckBase`, and module-private brand symbol all preserved through `isolatedDeclarations` emit | FLOWING |
| `dist/index.js` | 4 runtime constants | `src/types.ts` | `node` import resolves `MESSAGE_MAX_CHARS`=180, `USER_CANCELLED`/`USER_DECLINED`/`CONSENT_GRADE_ORDER` all frozen | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Workspace typecheck green | `pnpm typecheck` | exit 0 | PASS |
| Emit build succeeds | `pnpm --filter @fullselfbrowsing/concierge exec tsc -p tsconfig.json` | exit 0, 8 files | PASS |
| Dist hygiene — no test artifacts | `ls -R dist \| grep -c "test-d\|_assert"` | `0` | PASS |
| Runtime constants resolve | `node --input-type=module` import from `dist/index.js` | `180`, 3 frozen values | PASS |
| No vendor event vocabulary (TRN-01) | `grep -rniE 'response\.done\|conversation\.item\|session\.update' src test-d` | no matches | PASS |
| No exports in test-d | `grep -l '^[[:space:]]*export' test-d/*.test-d.ts` | no matches | PASS |
| README no stale contract | `grep -c "reason?: string" README.md \| grep -qx 0` | `README_NO_STALE_CONTRACT` | PASS |
| `DigestLike` method syntax | `grep -n 'digest(algorithm'` | types.ts:642 method form | PASS |
| `snapshotEquality` property syntax | `grep -n 'snapshotEquality?:'` | types.ts:399 property form | PASS |
| Repo integrity after 19 mutations | `git status --porcelain` / `git diff --exit-code` | empty / clean | PASS |
| Root `pnpm build` | `pnpm build` | `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT` | **FAIL — deferred to Phase 2** |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| TRN-01 | 01-03, 01-09 | A transport is defined entirely by an interface with no vendor event names in core | SATISFIED | `Transport` pinned to exactly 4 members by `_transportKeys`; two structurally unrelated transports satisfy it with no casts; vendor-event grep over `src/` + `test-d/` clean. |
| TRN-05 | 01-03, 01-09 | A transport declares the *provenance* of its turn identity … and one whose turn identity can be minted by the agent's own output cannot satisfy the strongest user-turn binding | SATISFIED (declaration half) / DEFERRED (enforcement half) | `TurnIdentityProvenance` ships and `boolean` is rejected (M6). Phase 1's SC-5 asks only for type-system distinguishability — met. The runtime refusal is explicitly Phase 8's, named in both `types.ts:958-960` and the Phase 8 roadmap notes. |

**Orphan check:** `grep "Phase 1" .planning/REQUIREMENTS.md` returns exactly TRN-01 and TRN-05. **No orphaned requirements.** Both were claimed by plans and both are implemented.

**Bookkeeping warning:** `REQUIREMENTS.md` still lists both as `- [ ]` and "Pending" in the traceability table despite ROADMAP marking Phase 1 `[x]` complete. Implementation is verified; only the status flags are stale.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` | — | **None found** across `src/`, `test-d/`, `package.json`, `README.md`, or any `packages/**/*.ts`. Debt-marker gate passes. |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` | — | None found. |
| — | — | Stub prose / empty returns | — | None found. `src/` contains no function bodies at all — types plus 4 frozen constants. |
| `.planning/STATE.md` | 1-20 | Stale tracking state | WARNING | `completed_phases: 0`, `completed_plans: 0`, `percent: 0`, `Plan: 1 of 9`, `status: executing`, `last_updated` 06:24 vs phase completion 11:29. Never updated across any of the 9 waves — the "update tracking" commits touched `ROADMAP.md` only. Affects `/gsd-next` and milestone audit, not the phase goal. |
| `.planning/REQUIREMENTS.md` | 70, 74, 196, 200 | TRN-01/TRN-05 still `- [ ]` / "Pending" | WARNING | Traceability bookkeeping only; both requirements verified implemented. |

Two notes recorded as **not** anti-patterns after inspection:
- `types.ts:823-824` contains `any` in `AnyActionDefinition`'s `Snapshot`/`AckPayload` positions. Verified deliberate and load-bearing — the file does not compile without an erasure (contravariant positions make `unknown` unassignable, TS2375), `never`-erasure was rejected for forcing a cast into the security-critical path, and the concrete `Snapshot` survives on every individual declaration. Documented at length in-file and settled by D-12 item 2. Revisit is scheduled for Phase 8.
- `types.ts:26` and `:1007` mention "OpenAI Realtime" and "WebRTC/SSE/MCP/WebMCP" in prose. Neither is a vendor *event name*, neither appears in a type declaration, and `:1007` is the comment asserting core has no transport opinion. TRN-01 is about event names; the targeted grep is clean.

### Deferred Items

Not yet met but explicitly addressed in later milestone phases. **None affects the Phase 1 goal.**

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | TRN-05 runtime gate (refuse `bindTo:"userTurn"` on agent-forgeable) | Phase 8 | Phase 8 Notes name it verbatim; `types.ts:958-960` states the same boundary in-code |
| 2 | M9 second detector (`_policyIsInvariantInSnapshot`) | Phase 2 | 01-09 decision + handed-forward assertion. Independently confirmed non-blocking: SC-7a as roadmap-worded is caught by 3 × TS2322 |
| 3 | `Scheduler` shape pin | Phase 6 | Phase 6 owns DSP-08; RESEARCH A3 expects the signature to change; a pin now fires on a sanctioned edit |
| 4 | `MESSAGE_MAX_CHARS` export-placement guard (from `index.js`) | Phase 2 | Current state verified correct at runtime; regression guard only |
| 5 | Root `pnpm build` script | Phase 2 | Phase 2 goal + PKG-01/PKG-02 + Phase 2 Notes ("no bundler, no test runner, no CI") |

### Human Verification Required

**1. README design-contract decision** — *the one gap.*
- **Test:** Decide whether deleting the design-contract section (commit `bc9ca88`) is the accepted closure for threat T-01-26.
- **Expected:** Either add an `overrides:` entry to this file, or regenerate a README contract block from `types.ts`.
- **Why human:** Editorial decision on your own commit. A verifier must not fight a deliberate authoring choice.

**2. `DigestLike` method syntax — structurally unguardable.**
- **Test:** Review that `packages/concierge/src/types.ts:642` reads `digest(algorithm: "SHA-256", data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>` — method syntax, not a function-valued property.
- **Expected:** Method syntax. Confirmed present today.
- **Why human:** `types.ts:631-639` states this seam **has no mutant and cannot get one** — the discriminator is the DOM-vs-Node `BufferSource` split and neither typing is installed here. The positive in `consent.test-d.ts` stays green under the wrong syntax. Review + grep are the only defences, by design. This is the phase's one honestly-declared unguarded seam and it is correctly documented as such.

**3. Real-platform digest assignability.**
- **Test:** In a scratch project with DOM lib and `@types/node`, assign both `crypto.subtle` and `webcrypto.subtle` to `DigestLike`.
- **Expected:** Both assign with no wrapper or cast.
- **Why human:** Requires typings this package deliberately excludes.

**4. Tracking bookkeeping.**
- **Test:** Update `.planning/STATE.md` (still `completed_phases: 0` / `percent: 0` / `Plan: 1 of 9`) and flip TRN-01/TRN-05 in `.planning/REQUIREMENTS.md`.
- **Expected:** State reflects a completed Phase 1.
- **Why human:** Orchestration bookkeeping outside the phase's code scope.

### Suggested Override

The README gap looks intentional and its reasoning is already recorded in `01-VALIDATION.md` (lines 99-124). To accept it, add to this file's frontmatter:

```yaml
overrides:
  - must_have: "The published README's ActionResult block matches the shipped type"
    reason: >-
      Superseded by user commit bc9ca88, which rewrote README.md as a positioning page and
      deleted the design-contract section. Threat T-01-26 (a README asserting an open
      `reason?: string` against a shipped closed union) is closed by removal of the claim.
      README prose is not part of the public type surface and its absence creates no
      post-publish breaking change.
    accepted_by: "lakshman"
    accepted_at: "2026-07-28T17:05:00Z"
```

Then re-run verification; the phase moves to `passed` (or `human_needed` for items 2-4).

### Gaps Summary

**One gap, and it is not the goal.** Every ROADMAP Success Criterion is VERIFIED with independent mutation evidence. The shipped `types.ts` and `index.ts` are exactly what the phase claims: a complete, closed, compiler-enforced public contract with a suite that is demonstrably load-bearing rather than merely green.

I want to be explicit about how hard I tried to falsify this. I did not read the battery table and accept it — I rebuilt the package in an isolated sandbox and re-ran all ten mutants myself, then wrote nine more, including six derived from the roadmap's own wording rather than the phase's restatement of it, and including the exact `payload: unknown` probe the interrupted 01-05 session left behind. **Nineteen mutations, nineteen caught, zero escapees**, and the working tree was byte-identical before and after. The three escapees the research pass identified are individually confirmed load-bearing — M8's `_handlerAck` really is the sole diagnostic in the entire repository, and `_commonPayload` really is the sole detector for the `Payload` erasure. The two "expected silences" that `01-VALIDATION.md` was corrected to record are real silences, measured at zero, not excuses.

The gap: plan 01-08 declared a `must_have` that the README's `ActionResult` block match the shipped type, with an artifact check for `ReasonCode` and a key link to `reason?:`. The user rewrote README.md in `bc9ca88` and deleted that section, so both checks resolve to NOT FOUND. The underlying threat is genuinely closed — a README that documents no contract cannot contradict one — and plan 01-09's replacement check (`grep -c "reason?: string" README.md` = 0) tests exactly the threat's negation and passes. But `01-VALIDATION.md`'s own caveat is worth repeating rather than burying: the check now verifies only that the README does not document the contract *wrongly*, not that it documents it *correctly*, and the broader manual grep passes **vacuously** because it returns no lines at all. That is a real reduction in coverage, honestly disclosed by the phase itself, and it needs your decision rather than my ruling.

Two bookkeeping items also need attention before the milestone audit: `.planning/STATE.md` was never updated across any of the nine waves (it still reports Phase 1 executing at plan 1 of 9, 0% complete), and `REQUIREMENTS.md` still marks TRN-01 and TRN-05 "Pending". Neither affects the code.

Nothing here blocks Phase 2. The build-script failure, the `Scheduler` pin, the M9 second detector, and the `MESSAGE_MAX_CHARS` guard are all legitimately Phase 2's or Phase 6's, and I confirmed each against the later phases' own roadmap sections rather than taking the deferral on trust.

---

_Verified: 2026-07-28T17:05:00Z_
_Verifier: Claude (gsd-verifier) — goal-backward, FORCE stance. 19 independent mutations executed in an isolated sandbox; working tree unmodified._
