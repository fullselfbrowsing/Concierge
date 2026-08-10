---
phase: 08
slug: consent-kernel
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-10
completed: 2026-08-10
---

# Phase 08 — Validation Record

Phase 8 closes only from current-revision mutation evidence, an immutable seven-gate release snapshot, and an independent OWASP ASVS Level 1 audit. Runtime tests import the built artifact; every mutation detector builds first and selects an exact named case.

## Test Infrastructure

| Property | Evidence |
|----------|----------|
| **Runtime framework** | Vitest 4.1.10 against built `packages/concierge/dist/index.js` |
| **Type framework** | TypeScript 7.0.2 with strict declaration/type tests |
| **Focused suites** | Catalog, consent kernel, canonicalization, session consent, stub transport, and root README security suites |
| **Mutation runner** | `node scripts/phase-08-mutation-battery.mjs run all --jobs 4` |
| **Release gate** | Build, typecheck, test, artifact, dependency, pack/foreign-consumer, and Node-floor checks from one read-only snapshot |
| **Measured final runtime** | 20 runtime files / 427 passed / 427 total / 0 pending / 0 todo (`pnpm test`, exit 0) |

## Per-Task Verification Map

The rows below use the executed plan decomposition, not the earlier research projection.

| Task ID | Plan | Delivered boundary | Primary evidence | Status |
|---------|------|--------------------|------------------|--------|
| 08-01-01 | 08-01 | Immutable consent, attestation, delivery, and outcome contracts | Typecheck and strict type tests | ✅ green |
| 08-01-02 | 08-01 | Type-only public exports and exact declaration/runtime surface | Artifact and export-surface tests | ✅ green |
| 08-02-01 | 08-02 | Inherent delivered floor and aggregate catalog capability issues | C27-C29 and M-08-C01/C04/C07 | ✅ green |
| 08-02-02 | 08-02 | Descriptor-safe frozen per-Concierge profile | Concierge and diagnostic-safety suites | ✅ green |
| 08-03-01 | 08-03 | Review-keyed generation ledger armed only by owned completed delivery | K01-K16 and M-08-G01..G06 | ✅ green |
| 08-03-02 | 08-03 | Late snapshot comparison, exact payload identity, and atomic one-shot consumption | K17-K26, N01-N04, and M-08-G07..G15 | ✅ green |
| 08-04-01 | 08-04 | Strict RFC 8785, hand UTF-8, retained bytes, and digest verification | J01-J11 and M-08-E01/E02/E07..E14 | ✅ green |
| 08-04-02 | 08-04 | Completed-delivery plus confirmed human attestation conjunction | E01-E13 and M-08-E03..E06 | ✅ green |
| 08-05-01 | 08-05 | Actual Session transport dominates declared capability before side effects | S01-S04 and M-08-C05/C06 | ✅ green |
| 08-05-02 | 08-05 | App-authored failed-outcome barrier before every agent response | S05-S07, J04, and M-08-O01..O07 | ✅ green |
| 08-06-01 | 08-06 | Exact six-key Phase 7 fixture with sibling delivery/outcome controls | U01-U10, type tests, and M-08-P01 | ✅ green |
| 08-06-02 | 08-06 | Public no-network consent and outcome flows including the interrupted flagship | Stub-driven consent/session integration suites | ✅ green |
| 08-07-01 | 08-07 | Exact 47-mutant register and current-revision kill/restoration evidence | M-08-G01..P04, 47/47 green | ✅ green |
| 08-07-02 | 08-07 | Immutable release proof, security audit, and terminal ledger verifier | Seven gates and `verify ledgers` | ✅ green |
| 08-08-01 | 08-08 | Root README states client consent grants no server authority | P03 and M-08-P03 | ✅ green |
| 08-08-02 | 08-08 | Ordered stored challenge and current-policy reauthorization immediately before effect | P04 and M-08-P04 | ✅ green |

## Requirement Coverage

| Requirement | Summary | Detector | Mutant | Release fact |
|-------------|---------|----------|--------|--------------|
| CON-01 | 08-03 | K01, public no-review flow | M-08-G01 | 427/427 runtime tests |
| CON-02 | 08-03 | K14 and genuine-new-turn flagship | M-08-G06 | Built public artifact passed |
| CON-03 | 08-03 and 08-06 | K03-K08 and interrupted delivery flagship | M-08-G01, M-08-G02, M-08-G04 | Foreign runtime passed |
| CON-04 | 08-03 | K17-K20 | M-08-G07..G10 | 427/427 runtime tests |
| CON-05 | 08-03 | K09, K12, K17, K22-K26 | M-08-G03, M-08-G07, M-08-G12..G14 | 47/47 mutants green |
| CON-06 | 08-03 and 08-06 | K04 and interrupted-delivery flagship | M-08-G02 | Stub absent from tarball |
| CON-07 | 08-01, 08-02, 08-04, 08-05 | C27-C29, N01-N04, E12 | M-08-G15, M-08-C01/C04..C07, M-08-E12 | Exact 75 names, 60 types, 15 values |
| CON-08 | 08-03 | K21 | M-08-G11 | Built artifact and typecheck passed |
| CON-09 | 08-01, 08-03, 08-04 | K24 and E04 | M-08-G13, M-08-G14, M-08-E05/E06 | Foreign typecheck passed |
| CON-10 | 08-01 and 08-05 | S05-S07 and J04 | M-08-O01..O07 | Outcome runtime bindings passed |
| CAT-04 | 08-02 | C27-C29 | M-08-C01, M-08-C04, M-08-C07 | Full build passed |
| TRN-02 | 08-06 | Exact fixture U01-U10 and public flagship flow | M-08-P01, M-08-P02 | No fixture, test, or stub tar entry |
| TRN-03 | 08-01, 08-02, 08-05 | C29 and S02 | M-08-C02, M-08-C03, M-08-C05/C06 | Typecheck and foreign consumer passed |
| TRN-05 | 08-02 and 08-05 | C29 and actual-profile S02 | M-08-C02, M-08-C03, M-08-C05/C06 | Runtime capability dominance passed |
| SEC-04 | 08-08 | P03 and P04 | M-08-P03, M-08-P04 | Root README is release-bound |

## Decision Coverage

| Decision | Summary | Detector | Mutant | Release fact |
|----------|---------|----------|--------|--------------|
| D-08-01 | 08-03 factory-local review ledger | K03 | M-08-G01 | 47/47 mutants green |
| D-08-02 | 08-03 exact-Promise dedupe boundary | K04 | M-08-G02 | 427/427 tests |
| D-08-03 | 08-03 fresh-review replacement | E10, K07 | M-08-G03, M-08-G04 | 47/47 mutants green |
| D-08-04 | 08-03 completed owned delivery only | E09 | M-08-G05 | Public flagship passed |
| D-08-05 | 08-03 fresh human boundary | K14 | M-08-G06 | 427/427 tests |
| D-08-06 | 08-03 late detached snapshot | K26, K17 | M-08-G07, M-08-G08 | 47/47 mutants green |
| D-08-07 | 08-03 consume-before-handler | K18, K20 | M-08-G09, M-08-G10 | 47/47 mutants green |
| D-08-08 | 08-03 honest terminal outcomes | K21, K22, K24 | M-08-G11..G14 | Artifact import passed |
| D-08-09 | 08-02 and 08-03 inherent delivered floor | N01, N02, C27, C29 | M-08-G15, M-08-C01/C04/C07 | 47/47 mutants green |
| D-08-10 | 08-02 aggregated grade and provenance gates | C29 | M-08-C02, M-08-C03 | Build and typecheck passed |
| D-08-11 | 08-05 actual Session capability dominance | S02 | M-08-C05, M-08-C06 | Foreign runtime passed |
| D-08-12 | 08-04 achieved grade from evidence | J11 | M-08-E01, M-08-E02 | 47/47 mutants green |
| D-08-13 | 08-04 core-owned bytes and receipt verification | E02 | M-08-E03, M-08-E04 | Zero runtime dependencies |
| D-08-14 | 08-04 reject noncanonical evidence | E02 | M-08-E05, M-08-E06 | Node 22.12 artifact import passed |
| D-08-15 | 08-04 separate presentation and observation | J06-J09 | M-08-E07..E11 | 47/47 mutants green |
| D-08-16 | 08-04 attested requires both halves | J04 | M-08-E12 | 427/427 tests |
| D-08-17 | 08-02 and 08-04 missing seams fail early | J02, J03 | M-08-E13, M-08-E14 | Build and typecheck passed |
| D-08-18 | 08-05 app-owned batch outcome sink | S05-S07 | M-08-O01, M-08-O05, M-08-O07 | Outcome foreign binding passed |
| D-08-19 | 08-05 no model-authored failure prose | S06, S07 | M-08-O02, M-08-O06 | 47/47 mutants green |
| D-08-20 | 08-05 presentation fails closed | S07, J04 | M-08-O03, M-08-O04 | 427/427 tests |
| D-08-21 | 08-06 exact Phase 7 fixture | U08 | M-08-P01 | Stub absent from tarball |
| D-08-22 | 08-06 interrupted flagship proof | P02 package gate | M-08-P02 | Foreign package passed |
| D-08-23 | 08-08 honest server boundary | P03, P04 | M-08-P03, M-08-P04 | Root README release-bound |

## Threat Coverage

| Threat | Canonical meaning | Summary | Detector | Mutant | Release fact |
|--------|-------------------|---------|----------|--------|--------------|
| T-08-01 | The agent self-approves in the review response or a forgeable turn | 08-02, 08-03, and 08-05 require nonempty distinct boundaries and human-attested provenance | K14, C29 | M-08-G06, M-08-C02, M-08-C03 | Build, typecheck, and 427/427 tests passed |
| T-08-02 | Review return or partial delivery arms authority | 08-03 and 08-06 require owned completed delivery | K03, K04, K07, E10, flagship | M-08-G01..G04 | Public fixture flow passed |
| T-08-03 | Reviewed payload or app state drifts before confirm | 08-03 compares late detached state and preserves exact payload | K17, K18, K20, K21, K26 | M-08-G07..G11 | 47/47 mutants green |
| T-08-04 | Capability declaration is mistaken for achieved proof | 08-02 through 08-05 retain the inherent delivered floor and runtime none guard and derive achieved grade from evidence | N01, N02, C27, C29, S02, E12 | M-08-G15, M-08-C01/C04..C07, M-08-E12 | Exact artifact and foreign consumer passed |
| T-08-05 | Receipt/hash is forged or canonicalization collides | 08-04 owns JCS and UTF-8 bytes, recomputes digest, and cross-checks receipt data | J02-J11 and E02 | M-08-E01..E09, M-08-E12..E14 | Zero dependencies and Node floor passed |
| T-08-06 | A delivery hash is mistaken for a human act | 08-04 requires a separate confirmed trustworthy attestation | E02 and refusal/dismissal matrix | M-08-E03..E06 | 427/427 tests passed |
| T-08-07 | Retry or reentrancy arms/consumes more than once | 08-03 keeps transitions behind dedupe and consumes before app code | E09, E10, K07, K22, K24 | M-08-G03..G05, M-08-G07, M-08-G12..G14 | 47/47 mutants green |
| T-08-08 | The model rewrites app failure prose | 08-05 awaits one frozen app-authored outcome before response and never retries | S05-S07 and J04 | M-08-O01..O05, M-08-O07 | Outcome foreign runtime passed |
| T-08-09 | Client assertion is treated as server authorization | 08-08 requires current-policy exact-action reauthorization immediately before effect inside a serialized server challenge lifecycle | P03 and P04 | M-08-P03, M-08-P04 | Root README is in immutable release digest |
| T-08-10 | Hostile callbacks/objects leak secrets or escape | 08-02 through 08-06 snapshot descriptors, contain callbacks, and emit fixed prose | K18, J08, S02, S07 | M-08-G09, M-08-E10/E11, M-08-C06, M-08-O03/O06 | 427/427 tests passed |

## Research Constraint Coverage

| Constraint | Summary | Detector | Mutant | Release fact |
|------------|---------|----------|--------|--------------|
| lazy-factory-ledger | 08-03 allocates authority per Concierge and review name | K03 and K11 | M-08-G01 | 47/47 mutants green |
| strict-jcs-utf8 | 08-04 implements RFC 8785 and hand UTF-8 under ES2022 | J01-J10 | M-08-E07..E14 | Node 22.12 import passed |
| retained-canonical-bytes | 08-04 hashes and rechecks exact retained bytes | J11 and E02 | M-08-E01..E04 | 47/47 mutants green |
| profile-capability-ceilings | 08-02 treats declared capabilities only as ceilings | C27-C29 | M-08-C01..C04/C07 | Build passed |
| actual-transport-dominance | 08-05 snapshots and validates the actual transport before effects | S02 | M-08-C05, M-08-C06 | Foreign runtime passed |
| immutable-outcome-barrier | 08-05 freezes stable rows and awaits presentation before response | S05-S07 | M-08-O01..O07 | Outcome binding passed |
| exact-phase7-fixture | 08-06 extends the existing no-network fixture with sibling controls only | U01-U10 | M-08-P01, M-08-P02 | No fixture tar entry |
| dependency-and-package-boundary | 08-07 preserves manifests and lockfile and proves the foreign tarball | P01 and P02 gates | M-08-P01, M-08-P02 | Zero bytes, 21 tar entries, Node floor passed |

## Source Coverage Audit

| Source | Planned items | Evidence | Unplanned |
|--------|---------------|----------|-----------|
| GOAL | Exact readback-gated execution and user-visible app-authored failure outcome | 08-03 through 08-07 summaries, named detectors, mutation and release evidence | 0 |
| REQ | CON-01..10, CAT-04, TRN-02, TRN-03, TRN-05, SEC-04 | Requirement Coverage plus completed traceability rows | 0 |
| RESEARCH | Ledger, strict JCS and UTF-8, evidence dominance, outcome barrier, exact fixture, package boundary | Research Constraint Coverage and 47 compiled mutants | 0 |
| CONTEXT | D-08-01..23 | Decision Coverage with one or more named detector and mutant per decision | 0 |

## Measured Mutation Evidence

| Property | Evidence |
|----------|----------|
| Immutable register | Digest `7d22004c31980aa946f21b01b2ffb5c27bae46f6bd2b089bf8c4027b8441da2d` |
| Distribution | 15 generation / 14 evidence / 7 capability / 7 outcome / 4 package (`15/14/7/7/4`) |
| Outcome | 47/47 green; zero pending, zero escaped, zero failed |
| Non-vacuity | Every row compiled successfully, ran a nonzero named detector set, satisfied its detector, was killed, and matched its one exact source literal before mutation |
| Revision binding | Every row records a unique revision digest; all compiled-target hashes changed under mutation and returned to their recorded original values afterward |
| Restoration | Each target was mutated and restored only inside its disposable snapshot; the snapshot revision stayed stable and its restored gate passed, while live scoped endpoints matched before and after. This endpoint check does not prove uninterrupted live-history stability; no infrastructure error was recorded |
| Bounded execution | Bounded to at most four concurrent disposable mutation workers |

The protected inputs were verified byte-identical before and after the battery:

| Input | Evidence |
|-------|----------|
| `package.json` | `a8267855dba9a429225090c505a78c6169415e2978ce6fb8fcdd6b28e18d542a` |
| `packages/concierge/package.json` | `5ed9d24829c2ac5bdcf69b57d4f4b503c226cee33f474ad07536521fec4112e4` |
| `pnpm-lock.yaml` | `0e29065f823200f9bdb2284bdef721003f525f68fa60a2810046b1a7f720e0d4` |

## Measured Release Evidence

| Gate | Evidence |
|------|----------|
| `pnpm build` | Exit 0 |
| `pnpm typecheck` | Exit 0 |
| `pnpm test` | Exit 0; 20 runtime files, 427 passed, 427 total, 0 pending, 0 todo |
| `pnpm check:artifact` | Exit 0; callable artifact and exact public declaration surface of 75 names / 60 types / 15 values |
| Immutable snapshot | Revision `ddd3bd70822584bb387bb12f27956ff5f10c2611fabfdc4835ea6b6faf4069a1` remained byte-identical across all seven release gates |
| `pnpm check:deps` | Exit 0; dependency contribution is 0 bytes and the module graph is clean |
| `pnpm check:pack` | Exit 0; 21 tar entries (digest `bf8a250bffa403c2523e2ebb4adcb423326360ed6d5cff230b2ddc7fd51cb064`), no test/fixture/stub entry, foreign exact-optional typecheck passed, and consent/readback/outcome runtime bindings passed |
| `pnpm check:node-floor` | Exit 0; artifact imported under Node v22.12.0 |

## Wave 0 Requirements

- [x] Exact consent, canonicalization, catalog, session, stub, README, type, artifact, and package detectors exist.
- [x] Every named detector is live and green on the restored revision.
- [x] The mutation register contains exactly 47 compiled, killed, restored rows.
- [x] The security audit independently closes every registered high threat.
- [x] The terminal ledger gate binds requirements, decisions, threats, sources, inputs, package evidence, and release evidence.

## Validation Sign-Off

- [x] All 16 executed task rows are green.
- [x] All Phase 8 requirements and carried TRN-02/TRN-05 have current runtime evidence.
- [x] D-08-01..23 and T-08-01..10 have named detectors and killed mutants.
- [x] GOAL, REQ, RESEARCH, and CONTEXT each have zero unplanned items.
- [x] All seven release gates passed from one immutable revision.
- [x] OWASP ASVS Level 1 audit is secured with zero open threats.

**Approval:** approved 2026-08-10 — register 7d22004c31980aa946f21b01b2ffb5c27bae46f6bd2b089bf8c4027b8441da2d; 47/47 green; seven release gates green
