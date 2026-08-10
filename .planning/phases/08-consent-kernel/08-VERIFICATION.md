---
phase: 08-consent-kernel
verified: 2026-08-10T15:34:50Z
status: gaps_found
score: 8/10 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Any missing or contradictory evidence for a review occurrence leaves the gate closed; a review capable of attested consent cannot downgrade mismatched attestation evidence into relayed authority."
    status: failed
    reason: "observeReviewDelivery initializes achievedGrade to relayed and, when the attested conjunction is false because report/attestation hashes contradict the verified receipt, falls through to arm relayed authority. A relayed-minimum sibling sharing that review then enters its consequential handler."
    artifacts:
      - path: "packages/concierge/src/concierge.ts"
        issue: "Lines 1042-1099 promote valid evidence to attested but do not close contradictory higher-grade evidence; the relayed default is armed instead."
      - path: "packages/concierge/test/consent-kernel.test.ts"
        issue: "No test combines a shared relayed/attested review with a verified readback and mismatched delivery/attestation evidence. E12 covers a clean relayed-only occurrence, not contradictory attempted attestation."
      - path: ".planning/phases/08-consent-kernel/08-MUTATION-REGISTER.json"
        issue: "D-08-12 mutants cover receipt literals/bytes but no mutant or detector covers fail-open downgrade after contradictory delivery evidence."
    missing:
      - "Destroy or close the owned generation when expected/present higher-grade evidence is missing or internally contradictory; do not retain the relayed fallback for that occurrence."
      - "Add a public-flow regression with relayed and attested siblings sharing one review: after verified presentation, submit mismatched report/attestation hashes or turn evidence and prove neither sibling handler runs."
      - "Add mutation coverage for removing the contradiction-close branch or restoring the relayed fallthrough, then correct D-08-12 and CON-07 ledger closure evidence."
---

# Phase 8: Consent Kernel Verification Report

**Phase Goal:** A consequential action runs only when a human — not the agent — confirmed this exact payload, or it does not run.
**Verified:** 2026-08-10T15:34:50Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The six non-negotiable ROADMAP success criteria were merged with the additional PLAN truths. Closely overlapping plan statements were deduplicated into ten observable must-haves. Evidence below comes from source, tests, generated artifacts, and commands run by this verifier; SUMMARY claims were not used as proof.

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A gated action fails closed without prior review, and review plus confirm in the same human turn cannot self-approve. | ✓ VERIFIED | `concierge.ts:1482-1512` requires an armed generation and a fresh boundary. K01/K14 pass; M-08-G01 and M-08-G06 independently kill removal of those guards. |
| 2 | Authority arms only after owned, completed human delivery; interrupted delivery remains closed even after a genuinely new turn. | ✓ VERIFIED | `concierge.ts:989-1102` claims one pending generation, snapshots evidence, and rejects every non-`completed` outcome. `concierge.ts:1758-1771` installs pending state before registering the callback. K03/K04 and the public flagship pass; M-08-G02 kills the interrupted-delivery bypass. |
| 3 | Confirm uses the exact reviewed payload and detached snapshot, checks late drift, and consumes authority before handler entry or success/failure. | ✓ VERIFIED | `concierge.ts:1553-1621` performs the late comparison, rechecks generation ownership, deletes authority, and builds the ack from `owned.payload` and `owned.snapshot`. K17-K23 pass; M-08-G07 through G12 kill drift, identity, and one-shot regressions. |
| 4 | Build and Session reject insufficient grade or turn provenance with actionable diagnostics; `none` cannot satisfy a gated action. | ✓ VERIFIED | `catalog.ts:1143-1195` aggregates named grade, provenance, presenter, and digest failures; `session.ts:228-258` checks the actual captured transport before observable startup effects. The delivered floor and runtime `none` guards are in `consent-profile.ts`/`concierge.ts:184-187,1514-1549`. C27-C29, N01-N04, S01-S03 pass; capability mutants and M-08-G15 are green. |
| 5 | Explicit decline is distinguishable from dismissal, and documentation makes client consent an untrusted assertion that the server independently re-verifies. | ✓ VERIFIED | `concierge.ts:1026-1040,1494-1504` preserves `declined` versus `dismissed` as `USER_DECLINED` versus `USER_CANCELLED`. K24 passes. `README.md:60-119` requires authentication, exact action/payload binding, freshness, current-policy authorization, single-use, and an atomic effect-before-burn lifecycle. P03/P04 and M-08-P03/P04 pass. |
| 6 | A failed action reaches the human through one app-authored, model-free outcome before any result can be released to the agent. | ✓ VERIFIED | `session.ts:193-207` copies only `callId`, `reason`, and app-authored `message` into a frozen outcome. `session.ts:638-663` awaits completed presentation before `transport.respond`; interruption/throw emits the fixed diagnostic and returns. S05-S07 pass; M-08-O01 through O07 are green. |
| 7 | The public consent, evidence, transport, and outcome contracts are exact, readonly, type-only exported, and consumable from a foreign strict project. | ✓ VERIFIED | `types.ts` contains the separated contracts; `index.ts` exports them as types. `pnpm typecheck` passes the Phase 8 `test-d` pins. Export-surface checks report 75 names (60 types, 15 values), and release evidence records successful foreign typecheck/runtime import. |
| 8 | Evidence required by the occurrence is internally consistent: attested consent requires exact canonical bytes and a matching confirmed human act, and any missing or contradictory evidence leaves the gate closed rather than downgrading. | ✗ FAILED — BLOCKER | Canonicalization and positive attestation checks exist, but `concierge.ts:1042-1099` defaults to `relayed`; when verified presentation exists and supplied report/attestation hashes contradict it, the promotion predicate merely evaluates false and the generation is still armed as relayed. The independent reproduction entered a relayed sibling handler. This violates D-08-12 and the phase goal. |
| 9 | The exact Phase 7 stub drives the full public consent flow deterministically without network access while remaining test-only. | ✓ VERIFIED | `test/fixtures/stub-transport.ts` keeps the six-key public `Transport` separate from sibling delivery/outcome controls. U01-U10 and public-flow tests pass. Release evidence proves forbidden fixture entries absent from the 21-entry tarball; M-08-P01/P02 are green. |
| 10 | Mutation, release, task, threat, and requirement ledgers are current, complete against the locked decisions, and independently reproducible. | ✗ FAILED — BLOCKER | The 47 registered rows are reproducibly green, but their D-08-12 mapping is incomplete: M-08-E01/E02 test receipt literals/bytes and do not discriminate contradictory delivery evidence falling through to relayed. `08-VALIDATION.md:84` therefore closes D-08-12 without evidence for its “any missing or contradictory evidence leaves the gate closed” clause. |

**Score:** 8/10 truths verified

The D-08-12 gap is not deferred: Phase 9 covers framework adapters and has no goal or success criterion that repairs core evidence grading.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/concierge/src/types.ts` | Exact consent/evidence/outcome contracts | ✓ VERIFIED | Exists, substantive, strict type tests pass, and barrel consumers compile. |
| `packages/concierge/src/index.ts` | Type-only public exports | ✓ VERIFIED | New contracts are exported without adding unintended runtime values. |
| `packages/concierge/src/consent-profile.ts` | Frozen profile capture, grade ordering, private marker | ✓ VERIFIED | Substantive and used by both Concierge construction and Session dominance checks. |
| `packages/concierge/src/catalog.ts` | Aggregate build-time capability gate | ✓ VERIFIED | Substantive, called by `createConcierge`, and exercised through catalog plus public-flow tests. |
| `packages/concierge/src/concierge.ts` | Generation ledger, evidence arming, one-shot exact ack | ✗ INCOMPLETE | Substantive and wired, but `observeReviewDelivery` arms the relayed default when verified presentation evidence conflicts with supplied attestation evidence. |
| `packages/concierge/src/consent-evidence.ts` | Strict JCS/UTF-8, receipt snapshot and verification | ✓ VERIFIED | Substantive, imported by Concierge, with hostile-value and mutation coverage. |
| `packages/concierge/src/session.ts` | Actual-transport gate and outcome release barrier | ✓ VERIFIED | Substantive, exported through the package, and exercised by Session integration tests. |
| `packages/concierge/test/fixtures/stub-transport.ts` | Deterministic test-only transport controls | ✓ VERIFIED | Substantive and used by stub, consent, and Session suites; excluded from the tarball. |
| `packages/concierge/test-d/*.test-d.ts` | Exact foreign-facing compiler contracts | ✓ VERIFIED | Wired into `pnpm typecheck`; command passed. |
| Phase 8 runtime test suites | Behavioral proof for all consent branches | ⚠️ INCOMPLETE | Six focused suites pass 119/119 and the full suite passes 427/427, but no case covers the shared relayed/attested contradictory-evidence downgrade reproduced during verification. |
| `README.md` and `test/readme-security.test.ts` | SEC-04 server-boundary lifecycle | ✓ VERIFIED | Worked lifecycle is present and protected by ordered structural tests/mutants. |
| `scripts/phase-08-mutation-battery.mjs` | Isolated mutation/release/ledger verifier | ✓ VERIFIED | Executable terminal verifier passed independently. |
| `08-MUTATION-REGISTER.json` and `08-MUTATION-EVIDENCE.json` | Exact mutant definitions and complete current evidence | ⚠️ INCOMPLETE | 47 registered rows are current and green/restored, but no D-08-12 row targets contradictory-evidence downgrade into relayed authority. |
| `08-VALIDATION.md` and `08-SECURITY.md` | Closure and ASVS-oriented ledgers | ✗ INCORRECT CLOSURE | Present and accepted structurally by the verifier, but `08-VALIDATION.md:84` overstates D-08-12 closure using J11 and E01/E02. |

Across all eight PLAN files, `gsd-sdk query verify.artifacts` reported 26/26 declared artifacts present and passing its content checks. That is only existence/pattern evidence: semantic inspection and the independent reproduction above expose the incomplete behavior in `concierge.ts`, its tests, and its D-08-12 mutation/closure evidence.

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Public contracts | Package barrel and strict consumers | Type-only exports plus `test-d` | ✓ WIRED | Typecheck and export-surface tests pass. |
| Captured `ConsentProfile` | `buildCatalog` | One factory-local call with captured presenter/digest | ✓ WIRED | `concierge.ts:807-814` supplies all captured seams. |
| Concierge private profile | Actual Session transport | `consentProfileOf` plus `profileDominates` | ✓ WIRED | `session.ts:250` gates before transport status/subscription/catalog effects. |
| Dispatch Promise cache | Consent state transitions | `runDispatchPipeline` after synchronous cache installation | ✓ WIRED | Exact-Promise retry and re-entrant one-shot tests pass. |
| Validated review payload/snapshot | Delivery generation and handler ack | Stored references through owned generation | ✓ WIRED | K21 proves payload identity; drift and replacement tests prove ownership. |
| Prepared readback bytes | Receipt and attestation | SHA-256/JCS verification before achieved grade | ✗ PARTIAL | Exact bytes are retained and valid evidence can promote to `attested`, but contradictory hashes only make the promotion predicate false; they do not close the generation before the relayed fallback arms. |
| Batch failures | Human outcome sink | Awaited `presentOutcome` barrier before every response | ✓ WIRED | S05-S07 and O01-O07 prove ordering, sanitization, and fail-closed behavior. |
| Stub controls | Public Concierge/Session flow | Delivery, attestation, outcome, and event-history controls | ✓ WIRED | Public-flow and ordering suites use the real package surface. |
| Mutation register | Runner, evidence, and closure ledgers | Exact replacements, detectors, fingerprints, and revision digests | ✗ PARTIAL | The structural link passes, but the register has no mutation/detector for the D-08-12 downgrade branch, so green evidence cannot substantiate complete decision closure. |
| README security lifecycle | Regression test | Section-scoped ordered assertions | ✓ WIRED | P03/P04 and package mutation rows pass. |

The automated key-link matcher recognized 11/21 literal links. Its ten pattern negatives were conceptual `from` names (for example `DeliveryReport.attestation`) treated as file paths or one unsupported regex. Manual source-to-call-site inspection resolved those syntactic matcher limitations, but the evidence-to-grade link remains behaviorally partial for the independent reason above.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `concierge.ts` | `ConsentGeneration` | Validated review args + detached bridge snapshot + invocation metadata | Partial — state ownership flows correctly, but contradictory higher-grade evidence takes the `armed` relayed path rather than destruction | ✗ FAIL-OPEN DOWNGRADE |
| `consent-evidence.ts` / `concierge.ts` | `VerifiedReadbackEvidence` | Exact frozen readback → core JCS bytes → app receipt → injected digest → delivery attestation | No for contradictory evidence — mismatch skips `attested` promotion but leaves `achievedGrade = "relayed"`, which is then armed | ✗ FAIL-OPEN DOWNGRADE |
| `concierge.ts` | `ConsentAck` | Armed generation's stored payload, snapshot, response/turn identity, and optional hash | No for the failing occurrence — a relayed ack without the contradictory hash reaches the consequential sibling handler | ✗ FAIL-OPEN DOWNGRADE |
| `session.ts` | `FailureOutcome` | Actual failed `dispatchBatch` rows | Yes — frozen app messages flow to `presentOutcome`; only a completed report releases the original rows to `respond` | ✓ FLOWING |
| `catalog.ts` / `session.ts` | Effective consent capability | Frozen app profile and descriptor-snapshotted actual transport capabilities | Yes — both construction-time declarations and actual Session capabilities gate execution before effects | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Build plus focused Phase 8 behavior | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/{catalog,consent-kernel,readback-canonicalization,session-consent,stub-transport,readme-security}.test.ts` | Build/attw/publint passed; 6 files, 119 tests passed | ✓ PASS |
| Repository type and runtime regression | `pnpm typecheck && pnpm test` | Typecheck passed; 20 files, 427/427 tests passed | ✓ PASS |
| Artifact must-have checks | Eight `gsd-sdk query verify.artifacts <PLAN>` invocations | 26/26 declared artifacts passed | ✓ PASS |
| Mutation/release/closure agreement | `node scripts/phase-08-mutation-battery.mjs verify ledgers` | Exit 0: “Phase 8 mutation, input, release, task, and requirement ledgers agree” | ✓ PASS |
| D-08-12 shared-review contradiction | `node --input-type=module -e '<public createConcierge reproduction>'` | Exit 42: presenter called once; verified receipt hash `6f69…2d8e`; report and confirmed-attestation hash `0000…0000`; relayed confirm returned `{ok:true,message:"RAN"}` and handler-entry count was 1 | ✗ FAIL |

All spot-checks were read-only with respect to application state. The ledger command refreshed two evidence timestamps while running; those verifier-created timestamp edits were restored afterward, leaving the pre-existing artifact byte-for-byte unchanged.

### Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| Conventional shell probes | `find scripts -path '*/tests/probe-*.sh' -type f` | No Phase 8 probe scripts declared or present | SKIPPED — none applicable |
| Phase-declared terminal verifier | `node scripts/phase-08-mutation-battery.mjs verify ledgers` | Exit 0 with agreement marker | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CAT-04 | 08-02, 08-06, 08-07 | Reject actions exceeding configured capability | ✓ SATISFIED | Aggregate catalog diagnostics, C27-C29, capability mutants. |
| CON-01 | 08-03, 08-06, 08-07 | No prior review fails closed | ✓ SATISFIED | Armed-generation guard, K01/public flow, M-08-G01. |
| CON-02 | 08-03, 08-06, 08-07 | Same-turn review/confirm fails | ✓ SATISFIED | Fresh-boundary guard, K14, M-08-G06. |
| CON-03 | 08-03, 08-06, 08-07 | Arm only after human delivery | ✓ SATISFIED | Pending/owned delivery state, K03-K08, G01-G04. |
| CON-04 | 08-03, 08-06, 08-07 | Snapshot drift invalidates consent | ✓ SATISFIED | Late detached comparison, K17-K20, G07-G10. |
| CON-05 | 08-03, 08-06, 08-07 | Consent is one-shot and destructible | ✓ SATISFIED | Consume-before-handler and generation replacement, K09/K12/K22-K26. |
| CON-06 | 08-03, 08-06, 08-07 | Interrupted delivery never arms | ✓ SATISFIED | Completed-outcome guard, K04/flagship, M-08-G02. |
| CON-07 | 08-01, 08-02, 08-04, 08-06, 08-07 | Grades name measured hops and obey ceilings | ✗ BLOCKED | Contradictory attempted-attestation evidence is silently discarded while the occurrence is armed as relayed; the public reproduction enters a relayed-minimum sibling handler. Existing G15/C/E mutants do not cover this downgrade. |
| CON-08 | 08-03, 08-06, 08-07 | Handler receives exact reviewed payload | ✓ SATISFIED | `owned.payload` ack, K21 identity assertion, M-08-G11. |
| CON-09 | 08-01, 08-03, 08-04, 08-06, 08-07 | Decline differs from dismissal | ✓ SATISFIED | Terminal states and exact public results, K24, G13/G14. |
| CON-10 | 08-01, 08-05, 08-06, 08-07 | Human gets app-authored failure, not agent narration | ✓ SATISFIED | Frozen minimal outcome and response barrier, S05-S07, O01-O07. |
| TRN-02 | 08-06, 08-07 | Stub exercises full kernel without network | ✓ SATISFIED | Exact six-key fixture and public integration flow; fixture excluded from tarball. |
| TRN-03 | 08-01, 08-02, 08-05, 08-06, 08-07 | Missing turn identity cannot use `userTurn` binding | ✓ SATISFIED | Build and actual-transport gates, C29/S02, C02/C03 mutants. |
| TRN-05 | 08-01, 08-02, 08-05, 08-06, 08-07 | Turn identity carries provenance | ✓ SATISFIED | Profile/transport provenance types and runtime dominance, S02, C05/C06 mutants. |
| SEC-04 | 08-07, 08-08 | Server independently re-verifies client assertion | ✓ SATISFIED | README challenge lifecycle, P03/P04 tests and mutants. |

All 15 requirement IDs declared by Phase 8 plans are present in `REQUIREMENTS.md` and mapped to Phase 8 (including carried closure for TRN-02/TRN-05). No orphaned ID was found, but CON-07's recorded “Complete” status is contradicted by the live D-08-12 reproduction and must be reopened.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `packages/concierge/src/types.ts` | 1805 | Public `Concierge` doc still says consent gating is not implemented by this handle | ⚠️ Warning | Documentation drift: direct `Concierge.dispatch` now contains consent gating. This is separate from the blocking D-08-12 defect and should be corrected with the gap work. |
| `packages/concierge/test/consent-kernel.test.ts` | 503 | Direct-Concierge flagship asserts an unrelated stub `responseHistory()` is empty | ℹ️ Info | This assertion is non-discriminating because no Session response path is attached in that test. Its zero handler-entry assertion and separate Session integration/mutation coverage remain discriminating. |

No unreferenced `TBD`, `FIXME`, or `XXX` debt marker exists in Phase 8 source. Scan hits in the lockfile were integrity-string substrings; `numTodoTests` fields enforce zero todo tests; `return null` sites in consent evidence are fail-closed validation branches, not stubs. No placeholder, console-only handler, hardcoded empty user data, missing artifact, or orphaned implementation was found.

### Adversarial Disconfirmation

Four direct ways the goal could have been falsely claimed were checked independently:

1. Removing the completed-delivery guard lets interruption arm consent; M-08-G02 is compiled and killed by a named detector.
2. Removing the runtime `achievedGrade !== "none"` guard permits a catalog-bypass fault to enter a handler; M-08-G15 is compiled and killed.
3. Releasing agent-facing rows before app outcome completion violates CON-10; M-08-O01 is compiled and killed by the ordering detector.
4. Supplying contradictory attempted-attestation evidence to a review shared by relayed- and attested-minimum actions should close both gates. The public-artifact reproduction instead returned success and entered the relayed handler once. This falsifies the starting completion narrative and exposes a missing mutation dimension.

The existing E12 test is not a counterexample: it proves a clean relayed-only occurrence under an attested ceiling, deliberately avoids readback presentation, and supplies no contradictory higher-grade evidence. J11 and M-08-E01/E02 stop a bad receipt earlier during presentation; they do not exercise the later delivery fallthrough. The weakest-looking direct-flow `responseHistory()` assertion was also not credited as proof. The remaining non-blocking operational residual is a consumer-supplied outcome presenter that never settles: core releases nothing but cannot guarantee progress for an arbitrary unresolved application Promise.

### Human Verification Required

None. The blocker is deterministically reproduced in core-library code and does not require visual, external-service, or subjective testing.

### Gaps Summary

One root-cause blocker prevents goal achievement. `observeReviewDelivery` treats relayed as a default before it evaluates attempted attestation; a mismatch only prevents promotion and does not invalidate the occurrence. With one review shared by an attested-minimum sibling and a relayed-minimum consequential action, a verified readback followed by contradictory confirmed-attestation hashes still arms relayed authority and executes the latter handler. The tests and mutation/validation ledgers close D-08-12 without covering this branch. Phase 9 does not address it.

Required closure is concrete: make contradictory or missing evidence for an attempted/expected higher-grade occurrence terminal, add the shared-review public regression, add a mutation that resurrects the downgrade, reopen and re-close CON-07/D-08-12 ledgers, and correct the stale `Concierge` API documentation sentence.

---

_Verified: 2026-08-10T15:34:50Z_
_Verifier: the agent (gsd-verifier)_
