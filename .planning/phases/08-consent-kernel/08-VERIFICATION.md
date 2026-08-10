---
phase: 08-consent-kernel
verified: 2026-08-10T16:15:49Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/10
  gaps_closed:
    - "D-08-12: incomplete or contradictory attempted attestation can no longer fall through to relayed authority on a shared review generation."
  gaps_remaining: []
  regressions: []
---

# Phase 8: Consent Kernel Verification Report

**Phase Goal:** A consequential action runs only when a human — not the agent — confirmed this exact payload, or it does not run.
**Verified:** 2026-08-10T16:15:49Z
**Status:** passed
**Re-verification:** Yes — after D-08-12 gap closure
**Verified revision:** `7fc77ec33b8c13d865803a66ac0988223e88620e`

## Re-verification Result

The prior report found one root blocker: `observeReviewDelivery` treated `relayed` as a fallback when a review occurrence supplied incomplete or contradictory attempted-attestation evidence. A relayed-minimum sibling sharing an attested review could therefore run.

That gap is closed.

| Prior Gap | Previous Evidence | Current Closure | Status |
|---|---|---|---|
| Contradictory attempted attestation downgraded to relayed authority | Public reproduction returned `{ok:true,message:"RAN"}` and entered the relayed handler once | `concierge.ts:1039-1057` distinguishes no claim from an attempted claim; any attempted tuple that is not complete closes the owned generation. Public re-reproduction closes contradictory, missing-attestation, and missing-report-hash cases across shared relayed/attested gates. | ✓ CLOSED |
| No discriminating regression/mutant for that branch | E12 covered only a clean relayed occurrence; the 47-row register had no downgrade control | E14 covers six incomplete/contradictory tuples across both shared gates. M-08-E15 removes the close guard, compiles, makes only E14 fail with its assertion-observed marker, is killed, and restores green. | ✓ CLOSED |
| D-08-12/CON-07 ledgers overstated closure | Validation cited receipt checks that did not exercise delivery fallthrough | Validation, security, and requirements now cite E12 + shared-gate E14 + M-08-E15; the live 48-row ledger verifier exits 0. | ✓ CLOSED |

The repair preserves the intended lower-grade path. In the same shared relayed/attested setup, a completed delivery with both optional evidence fields absent is treated as a clean relayed occurrence: the relayed handler enters once with `ack.grade === "relayed"` and no `readbackHash`.

## Goal Achievement

The six ROADMAP success criteria were merged with additional PLAN truths and deduplicated into ten observable must-haves. Passed items received quick regression checks; the two previously failed truths received full source, behavior, mutation, and ledger verification.

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A gated action fails closed without prior review, and review plus confirm in the same human turn cannot self-approve. | ✓ VERIFIED | Armed-generation and fresh-boundary guards remain intact; K01/K14 pass and M-08-G01/G06 remain green. |
| 2 | Authority arms only after owned, completed human delivery; interruption remains closed even after a genuinely new turn. | ✓ VERIFIED | The pending/verifying generation path remains response-owned and completed-only; K03/K04/flagship pass and G01-G04 remain green. |
| 3 | Confirm uses the exact reviewed payload and detached snapshot, checks late drift, and consumes authority before handler entry. | ✓ VERIFIED | Late comparison, generation recheck, deletion, and ack construction remain wired; K17-K23 and G07-G12 pass. |
| 4 | Build and Session reject insufficient grade or turn provenance; achieved `none` cannot satisfy a gated action. | ✓ VERIFIED | Catalog aggregation, the delivered floor, runtime none guard, and actual-transport dominance pass C27-C29, N01-N04, S01-S03 and their mutants. |
| 5 | Explicit decline differs from dismissal, and documentation treats client consent as an untrusted assertion requiring independent server re-verification. | ✓ VERIFIED | K24 preserves `USER_DECLINED` versus `USER_CANCELLED`; README P03/P04 and package mutants protect the full server challenge lifecycle. |
| 6 | A failed action reaches the human through one app-authored, model-free outcome before any result is released to the agent. | ✓ VERIFIED | The frozen minimal outcome and awaited Session barrier pass S05-S07 and O01-O07. |
| 7 | Public consent, evidence, transport, and outcome contracts are exact, readonly, type-only exported, and foreign-consumer safe. | ✓ VERIFIED | Typecheck passes; the release snapshot reports 75 public names (60 types, 15 values), foreign typecheck/runtime success, and Node 22.12 import success. |
| 8 | Evidence is occurrence-derived and internally consistent: any incomplete or contradictory attempted attestation closes the shared generation, while a clean absent tuple may earn relayed. | ✓ VERIFIED | `concierge.ts:1039-1057` implements the distinction. E12/E14 pass. Independent public reproduction closed three corruptions across both gates and admitted one clean hash-free relayed occurrence. M-08-E15 kills removal of the close guard. |
| 9 | The exact Phase 7 stub drives the full kernel without network and remains test-only. | ✓ VERIFIED | U01-U10/public integration pass; the 21-entry tarball excludes forbidden fixture entries and P01/P02 remain green. |
| 10 | Mutation, release, task, threat, and requirement ledgers are current, complete against locked decisions, and reproducible. | ✓ VERIFIED | 48/48 rows are green/killed/restored with unique revision digests, exact observed fingerprints, zero infrastructure errors, matching protected-input hashes, and seven release commands at exit 0. The live terminal verifier passed. |

**Score:** 10/10 truths verified

No remaining item is deferred to Phase 9.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/concierge/src/types.ts` | Exact public consent/evidence/outcome contracts and accurate direct-dispatch docs | ✓ VERIFIED | Strict type consumers pass; the stale “consent gating is not implemented” sentence was corrected at lines 1798-1808. |
| `packages/concierge/src/index.ts` | Type-only public exports | ✓ VERIFIED | Export surface remains 60 types and 15 runtime values. |
| `packages/concierge/src/consent-profile.ts` | Frozen profile capture, grade ordering, private marker | ✓ VERIFIED | Still used by Concierge construction and Session dominance checks. |
| `packages/concierge/src/catalog.ts` | Aggregate build-time capability gate | ✓ VERIFIED | C27-C29 and catalog mutants pass. |
| `packages/concierge/src/concierge.ts` | Generation ledger, strict evidence grading, one-shot exact ack | ✓ VERIFIED | Substantive and wired; lines 1039-1057 close attempted incomplete/contradictory tuples before the relayed arm path. |
| `packages/concierge/src/consent-evidence.ts` | Strict JCS/UTF-8 and receipt verification | ✓ VERIFIED | J01-J17 and evidence mutation family pass. |
| `packages/concierge/src/session.ts` | Actual-transport gate and app-outcome barrier | ✓ VERIFIED | Session integration and outcome mutants pass. |
| `packages/concierge/test/consent-kernel.test.ts` | Full consent-state and evidence branch proof | ✓ VERIFIED | E14 adds the exact shared-generation regression; focused suite is green. |
| `packages/concierge/test/fixtures/stub-transport.ts` | Deterministic test-only transport controls | ✓ VERIFIED | Public fixture flows pass and fixture remains absent from the package. |
| `packages/concierge/test-d/*.test-d.ts` | Exact foreign-facing compiler contracts | ✓ VERIFIED | `pnpm typecheck` passed. |
| `scripts/phase-08-mutation-battery.mjs` | Assertion-observed mutation/release/ledger verifier | ✓ VERIFIED | Parses RED markers from actual failed assertion messages, requires exact case/fingerprint equality, and passed the live ledger command. |
| `08-MUTATION-REGISTER.json` / `08-MUTATION-EVIDENCE.json` | Complete current mutation definitions/evidence | ✓ VERIFIED | 48 rows: 15 generation, 15 evidence, 7 capability, 7 outcome, 4 package. |
| `08-VALIDATION.md` / `08-SECURITY.md` / `REQUIREMENTS.md` | Honest closure ledgers | ✓ VERIFIED | D-08-12, CON-07, T-08-04/05/06, M-08-E15, 48/48, and 428/428 facts agree and the terminal verifier accepts them. |
| `README.md` / `test/readme-security.test.ts` | SEC-04 server trust boundary | ✓ VERIFIED | Worked boundary and ordered guards remain protected by P03/P04. |

All eight PLAN artifact checks were rerun: 26/26 declared artifacts exist and pass their content predicates. Substantive and wiring checks above were performed separately.

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Captured profile | Catalog and actual Session transport | Factory capture, `buildCatalog`, `consentProfileOf`, `profileDominates` | ✓ WIRED | Build and pre-effect runtime capability gates pass. |
| Dispatch Promise cache | Consent generation mutations | Pipeline execution after synchronous cache installation | ✓ WIRED | Retry/reentrancy and one-shot tests/mutants pass. |
| Validated review payload/snapshot | Consequential handler ack | Owned generation references and consume-before-handler | ✓ WIRED | K21/K22 and G11/G12 pass. |
| Verified readback | Delivery report/attestation | Exact bytes, digest, response, hash, act, and turn conjunction | ✓ WIRED | Complete tuples promote; attempted incomplete/contradictory tuples close at lines 1054-1057. |
| No optional evidence tuple | Relayed arm | `hasAttestedClaim === false` preserves measured completed-delivery grade | ✓ WIRED | Shared-gate public reproduction enters once with hash-free relayed ack. |
| Batch failures | Human outcome sink, then transport response | Awaited `presentOutcome` barrier | ✓ WIRED | S05-S07 and O01-O07 pass. |
| Mutation register | Failed assertion, evidence, closure ledgers | Exact source mutation plus assertion-observed fingerprint | ✓ WIRED | M-08-E15 selects one test, observes the E14 marker in its actual assertion failure, is killed/restored, and maps to D-08-12/T-08-04/05/06. |
| README lifecycle | Security regression | Ordered section assertions and package mutants | ✓ WIRED | P03/P04 pass. |

The generic key-link matcher still recognizes 11/21 links because several PLAN `from` values are conceptual symbols rather than files and one regex is unsupported. Manual source/call-site checks resolve those matcher limitations; no behavioral link remains partial.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Correct Data | Status |
|---|---|---|---|---|
| `concierge.ts` | `ConsentGeneration` | Validated review + detached snapshot + owned delivery | Yes — corrupt attempted claims delete the generation; clean completed delivery may arm measured relayed; complete valid evidence may arm attested | ✓ FLOWING |
| `consent-evidence.ts` / `concierge.ts` | `VerifiedReadbackEvidence` | Core JCS bytes → receipt snapshot → injected digest → delivery tuple | Yes — exact evidence is retained and independently re-digested; contradiction cannot be discarded into a lower-grade ack | ✓ FLOWING |
| `concierge.ts` | `ConsentAck` | Armed generation's stored payload/snapshot/identity/evidence | Yes — corrupt occurrences produce no ack; clean relayed produces no hash; complete attested includes the verified hash | ✓ FLOWING |
| `session.ts` | `FailureOutcome` | Failed `dispatchBatch` rows | Yes — frozen app-authored data reaches the sink before any original row reaches `respond` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Build plus focused Phase 8 regression | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run <six Phase 8 suites>` | Build/attw/publint passed; 6 files, 120/120 tests passed | ✓ PASS |
| Former blocker and clean-relayed control | `node --input-type=module -e '<shared-gate public-artifact reproduction>'` | Contradictory hash, missing attestation, and missing report hash closed both gates with zero entries; absent-both control entered relayed once with no hash | ✓ PASS |
| Full type/runtime regression | `pnpm typecheck && pnpm test` | Typecheck passed; 20 files, 428/428 tests passed | ✓ PASS |
| PLAN artifact checks | Eight `gsd-sdk query verify.artifacts <PLAN>` calls | 26/26 passed | ✓ PASS |
| Assertion-observed fingerprint audit | Read-only evidence audit over every runtime row | 47/47 runtime rows have expected=observed; every marker occurs in the actual failed assertion's sole failure message; M-08-E15 reports E14 exactly | ✓ PASS |
| Mutation/release/closure agreement | `node scripts/phase-08-mutation-battery.mjs verify ledgers` | Exit 0: “Phase 8 mutation, input, release, task, and requirement ledgers agree” | ✓ PASS |

The ledger command refreshes two generated timestamps while executing. This verifier restored those two timestamps afterward and confirmed the evidence SHA-256 returned to `c38611aab1e95f9fbe3ee4e30bee72c8afb304cef38b0cc1baec0c4a9feae813`; no ledger/source/config file was left modified by verification.

### Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| Conventional shell probes | `find scripts -path '*/tests/probe-*.sh' -type f` | None declared or present | SKIPPED — none applicable |
| Phase terminal verifier | `node scripts/phase-08-mutation-battery.mjs verify ledgers` | Exit 0 with agreement marker | ✓ PASS |

### Mutation and Release Evidence

| Check | Evidence | Status |
|---|---|---|
| Register shape | Schema 3; digest `7d38c388e0918f2f2e4c1f06bebc7768c084ea116df24cacff7b7a3cafe9f244`; distribution 15/15/7/7/4 | ✓ VERIFIED |
| M-08-E15 target | Exact single occurrence of `if (hasAttestedClaim && !completeAttestedClaim)`; replacement `if (false)` | ✓ VERIFIED |
| M-08-E15 detector | Compiled, testsRan 1, only E14 failed, exact marker `[RED:E14:contradictory-attestation-closes-shared-generation]`, killed/restored green | ✓ VERIFIED |
| Assertion provenance | Runtime fingerprints are extracted from actual Vitest `failureMessages`, not test titles or executor narration; 47/47 runtime rows satisfy one-message/one-marker and exact expected/observed equality | ✓ VERIFIED |
| All mutation rows | 48/48 green, compiled, killed, target-restored, restored-green, live endpoints matching; 48 unique revision digests; zero infrastructure errors | ✓ VERIFIED |
| Protected inputs | Root manifest, package manifest, and lockfile hashes exactly match the register | ✓ VERIFIED |
| Release snapshot | Revision `0d30400adbe22f900d0d59be40fa35430d505c1234eca07d129f4094e3c0512f`; all seven exits 0; 428/428 tests | ✓ VERIFIED |
| Package boundary | 75 names/60 types/15 values; zero runtime dependency bytes; 21-entry tarball digest `bf8a…064`; forbidden entries absent; foreign type/runtime and Node 22.12 import pass | ✓ VERIFIED |

### Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| CAT-04 | ✓ SATISFIED | Aggregate capability diagnostics, effective delivered floor, C27-C29 and C mutants. |
| CON-01 | ✓ SATISFIED | No-review guard, K01, M-08-G01. |
| CON-02 | ✓ SATISFIED | Fresh boundary, K14, M-08-G06. |
| CON-03 | ✓ SATISFIED | Owned completed delivery, K03-K08, G01-G04. |
| CON-04 | ✓ SATISFIED | Late snapshot comparison, K17-K20, G07-G10. |
| CON-05 | ✓ SATISFIED | Replacement and consume-before-handler, K09/K12/K22-K26. |
| CON-06 | ✓ SATISFIED | Interrupted delivery closes, K04/flagship, G02. |
| CON-07 | ✓ SATISFIED | Occurrence-derived grades now reject attempted incomplete/contradictory tuples; E12 distinguishes clean relayed, E14 protects shared gates, M-08-E15 kills downgrade. |
| CON-08 | ✓ SATISFIED | Exact `owned.payload`, K21, G11. |
| CON-09 | ✓ SATISFIED | Exact decline/dismissal outcomes, K24, G13/G14. |
| CON-10 | ✓ SATISFIED | App-authored outcome barrier, S05-S07, O01-O07. |
| TRN-02 | ✓ SATISFIED | Exact no-network stub flow and package exclusion. |
| TRN-03 | ✓ SATISFIED | Build/Session turn-identity gates, C29/S02. |
| TRN-05 | ✓ SATISFIED | Provenance types and actual transport dominance, S02/C05/C06. |
| SEC-04 | ✓ SATISFIED | README server challenge lifecycle, P03/P04. |

All 15 declared IDs are mapped and satisfied. CON-07 was specifically reopened by the prior verification and is now supported by live source, E12/E14, M-08-E15, and current requirements/security ledgers. No orphaned Phase 8 requirement exists.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `packages/concierge/test/consent-kernel.test.ts` | 503 | Direct-Concierge flagship retains an unrelated empty `responseHistory()` assertion | ℹ️ Info | It remains non-discriminating in that unit fixture, but is not credited as proof; handler-entry, Session integration, public reproduction, and mutation evidence are discriminating. |

The prior stale public `Concierge` documentation is fixed. No unreferenced `TBD`, `FIXME`, or `XXX` marker, placeholder implementation, console-only handler, hardcoded empty runtime data, missing artifact, or orphaned source was found. Scan matches for `todo` are zero-todo ledger fields; `placeholder` in `types.ts` explicitly says a type is not a placeholder.

### Human Verification Required

None. The phase is core-library infrastructure; the prior blocker and all success criteria are deterministically verifiable without a visual flow or external service.

### Gaps Summary

The previous D-08-12 blocker is closed. No must-have failure, uncertain behavior, incomplete artifact, broken link, hollow data flow, blocker debt marker, regression, human-only check, or deferred Phase 9 item remains.

---

_Verified: 2026-08-10T16:15:49Z_
_Verifier: the agent (gsd-verifier)_
