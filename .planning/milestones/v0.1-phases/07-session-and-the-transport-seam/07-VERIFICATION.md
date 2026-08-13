---
phase: 07-session-and-the-transport-seam
verified: 2026-08-10T05:44:44Z
status: passed
score: 28/28 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 23/28
  gaps_closed:
    - "Every arriving tool batch produces exactly one result per call on the transport after accessor-time context supersession."
    - "Latest-generation transitions fully reconcile abandoned publication state before batch admission resumes."
    - "Complete incoming batches retain FIFO progress across dispatch, responses, and finalization."
    - "Every batch captures the exact requested or confirmed arrival authority and epoch across reentrant transitions and failures."
    - "Every load-bearing Session authority branch has a compiled, exact, non-vacuous mutation detector."
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "Literal TRN-02 exercises the full consent kernel with the reusable configurable stub."
    addressed_in: "Phase 8"
    evidence: "ROADMAP Phase 7 notes and REQUIREMENTS.md explicitly keep TRN-02 unchecked/Partial until Phase 8 reuses this exact fixture against consent enforcement. Phase 7's reusable no-network stub/session-seam allocation is verified."
---

# Phase 7: Session and the Transport Seam Verification Report

**Phase Goal:** Something owns the loop between the catalog and the transport, so a stage change or a reconnect never leaves the agent holding a stale catalog — provable with no network.
**Verified:** 2026-08-10T05:44:44Z at `c4bcdd6bdae2940e4f65bc82fe342a792d175c08`
**Status:** passed
**Re-verification:** Yes — after closure of the accessor-abandoned publication gap and all follow-on authority/failure findings

## Goal Achievement

The phase goal is achieved. The original counterexample is now closed by matching publication-token/epoch cleanup and abort in `abandonSupersededPublication`. C17 reproduces both accessor-return and accessor-throw variants where B is superseded by C sharing the already-published A catalog, then proves C is confirmed, B's callable is never invoked, the pre-C occurrence is cancelled exactly once, and the post-C occurrence dispatches and responds exactly once under C. C18-C22 independently close every later stale-boundary, replay-progress, queued-authority, active-authority, and failed-request-reconciliation path exposed during adversarial review.

### Roadmap Contract

| # | Roadmap success criterion | Status | Codebase evidence |
|---:|---|---|---|
| 1 | Stage/page changes update the tool list, and reconnect replays the latest catalog without app intervention. | ✓ VERIFIED | Serialized context/status drain and reference-identity publication at `session.ts:955-1113`; built-artifact C01-C22 all pass. |
| 2 | A received tool batch yields exactly one result per call on the transport. | ✓ VERIFIED | One FIFO `runWork` invocation and one guarded response attempt per returned row at `session.ts:501-585`; C11-C22 and J01-J06/J15-J18 pass. |
| 3 | Turn identity and the delivery hook reach the handler intact. | ✓ VERIFIED | Frozen lazy facade preserves `responseId`, `userTurnId`, `calls`, and `deferUntilDelivered` while replacing only `signal` at `session.ts:437-472`; J12-J18 pass. |
| 4 | Stop unregisters, cancels, drains, and leaves no live listener, timer, or owned promise. | ✓ VERIFIED | Stop-first invalidation, independent cleanup, epoch abort, detached FIFO drain, and cached promise at `session.ts:818-904`; L01-L18 pass. No Session timer primitive exists. |
| 5 | A configurable stub drives the seam without network, WebRTC, browser, or vendor SDK. | ✓ VERIFIED | Closure-only structural fixture, synchronous controls, deterministic failures, and frozen histories pass U01-U08; package scan excludes the fixture. |

### Observable Truths

Roadmap truths are merged with PLAN-frontmatter truths. The stub's synchronous no-I/O truth is deduplicated into roadmap criterion 5, and the per-row response truth is deduplicated into criterion 2.

| # | Truth | Status | Evidence |
|---:|---|---|---|
| 1 | Stage/page changes publish the correct tool reference and connected transitions replay it without app work. | ✓ VERIFIED | C01-C22 pass against `dist/index.js`; `processContext` and `processConnected` serialize publication and reconcile exact authority. |
| 2 | Every arriving tool batch produces exactly one result per call on the transport. | ✓ VERIFIED | C17-C22 restore progress through all repaired boundaries; J01-J06 prove one FIFO dispatch and one non-retried response attempt per row. |
| 3 | Turn identity and the delivery hook reach the handler intact. | ✓ VERIFIED | J12/J13/J15-J18 pass through the lazy, descriptor-backed batch facade. |
| 4 | `stop()` unregisters, cancels, drains, and leaves no live listener, timer, or owned promise. | ✓ VERIFIED | L01-L18 pass; `enterStopped`, `performCleanup`, and `startStopDrain` are fully wired. |
| 5 | A configurable stub drives the Phase 7 seam with no network, WebRTC, browser, or vendor SDK. | ✓ VERIFIED | U01-U08 pass; the fixture has no I/O import and is absent from production exports and package bytes. |
| 6 | A consumer can implement the exact readonly, vendor-neutral six-member Transport lifecycle. | ✓ VERIFIED | `types.ts:1335-1368`, exact type predicates, two structural profiles, and the packed foreign-consumer probe pass. |
| 7 | `Session.stop` is awaitable while Session retains exactly four public members. | ✓ VERIFIED | `types.ts:1840-1882`; source and shipped-declaration predicates pass. |
| 8 | `initialContext` and `onDiagnostic` accept computed optional values under EOPT. | ✓ VERIFIED | `types.ts:1884-1889`; local type tests and the strict/EOPT tarball consumer pass. |
| 9 | Public Session diagnostics have a closed code vocabulary and exact safe readonly shape. | ✓ VERIFIED | Nine-code union and exact two-key object at `types.ts:1815-1830`; L14-L16 drive every runtime code and sink. |
| 10 | Conversational and command-palette capability profiles are frozen and differ only by capabilities. | ✓ VERIFIED | `stub-transport.ts:42-53`; U01 passes. |
| 11 | Stub `setTools`/`respond` attempts are recorded before deterministic occurrence failures. | ✓ VERIFIED | Attempt-before-throw implementation at `stub-transport.ts:150-165`; U05 passes. |
| 12 | Stub catalog, response, and subscriber histories are immutable snapshots that preserve catalog identity. | ✓ VERIFIED | Frozen snapshot getters at `stub-transport.ts:188-196`; U04/U07 pass. |
| 13 | Session creation synchronously publishes the exact initial catalog, or one frozen empty catalog without context. | ✓ VERIFIED | Built-artifact C01/C02 pass. |
| 14 | Catalog identity follows what the transport actually holds; genuine reconnects replay the latest reference. | ✓ VERIFIED | C03/C04/C10-C22 cover ordinary, same-reference, reentrant, and failed-transition replay histories. |
| 15 | Latest-generation transitions fully reconcile publication state before batch admission resumes. | ✓ VERIFIED | Matching attempt cleanup at `session.ts:400-428,943-953`; C17 proves the original same-published-catalog counterexample is closed. |
| 16 | A fixed-catalog transport stops before exposing a catalog-change error. | ✓ VERIFIED | C06 and fixed-capability reentry cases pass. |
| 17 | `createSession` is a callable public value with a direct single-instance guard and exact built surface. | ✓ VERIFIED | `index.ts:154`, first factory statement at `session.ts:131-132`, F7/P02, and exact 69/54/15 surface gates pass. |
| 18 | Complete incoming batches run FIFO across dispatch, responses, and finalization. | ✓ VERIFIED | One paused single pump at `session.ts:537-585`; J01-J06 and C19-C22 prove progress across queued controls and current failures. |
| 19 | Every batch captures the exact arrival context/generation/epoch, and authority changes abort old work. | ✓ VERIFIED | Admission priority at `session.ts:665-729`, exact post-drain binding at `:587-648`, and C20-C22/J07-J10 pass. |
| 20 | Session preserves hostile envelope totality through lazy getters and signal-only composition. | ✓ VERIFIED | Null-prototype frozen descriptors at `session.ts:437-472`; J11-J18 include all hostile evidence-getter parity cases. |
| 21 | Every `stop()` call returns the same Promise before and after drain resolution. | ✓ VERIFIED | Cached identity at `session.ts:818-843`; L01 and reentrant stop cases pass. |
| 22 | Stop independently removes both subscriptions, invalidates transition/publication state, aborts/drains all accepted work, and suppresses output. | ✓ VERIFIED | `session.ts:818-904`; L02-L08/L17/L18 and C20-C22 stop variants pass. |
| 23 | Stage listeners are tokenized, snapshot-based, ordered under nested changes, and independently contained. | ✓ VERIFIED | Listener queue/token implementation and L09-L13 pass. |
| 24 | Every runtime diagnostic is fresh, frozen, fixed, detail-free, and sink failure is contained. | ✓ VERIFIED | Fixed table and contained sinks in `session.ts`; L14-L16 prove exact shape, freshness, freezing, and no sentinel leak. |
| 25 | Every load-bearing Session branch has a compiled, exact, non-vacuous mutation detector. | ✓ VERIFIED | 37/37 current-revision evidence is green; M-07-C10..C16 compile, each run one exact C17..C22 detector, are killed, restore byte-identically, and have no infrastructure error. |
| 26 | A strict/EOPT foreign consumer constructs and stops `createSession`, while the stub is absent from public package bytes. | ✓ VERIFIED | `pnpm check:pack` installs the real tarball, typechecks with TypeScript 7.0.2/`skipLibCheck:false`, imports runtime values, and rejects stub paths. |
| 27 | All seven release commands run against one revision-bound immutable snapshot with unchanged manifests/lockfile. | ✓ VERIFIED | Independent disposable `verify ledgers` passed; recorded release digest `b6dd1789…`, seven zero exits, 16 files and 331/331 tests. |
| 28 | Validation/requirements ledgers agree with generated evidence and retain the Partial TRN-02 handoff. | ✓ VERIFIED | `verify all`, `verify inputs`, and disposable `verify ledgers` pass; SES-01..04 are Complete and TRN-02 remains unchecked/Partial with the exact Phase 8 handoff. |

**Score:** 28/28 truths verified

### Deferred Items

| Item | Addressed In | Evidence |
|---|---|---|
| Full literal TRN-02 consent-kernel exercise | Phase 8 | Phase 8's goal is the exact-payload human-consent kernel and depends on Phase 7's envelope/hook seam. Phase 7 intentionally supplies only the reusable configurable fixture and Session integration, so REQUIREMENTS correctly remains Partial. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/concierge/src/types.ts` | Exact Transport/Session/config/diagnostic contracts | ✓ VERIFIED | Exists, substantive, exported, locally typechecked, and checked from shipped declarations. |
| `packages/concierge/src/session.ts` | Hot publication, FIFO routing, teardown, and diagnostics | ✓ VERIFIED | Substantive and wired; matching publication cleanup plus distinct requested/active/confirmed authority closes the prior hollow state. |
| `packages/concierge/test/fixtures/stub-transport.ts` | Reusable deterministic no-I/O harness | ✓ VERIFIED | Exact six-key Transport, frozen profiles/harness, synchronous controls, occurrence failures, and immutable histories. |
| `packages/concierge/test/session-catalog.test.ts` | Catalog/reconnect/reentrancy proof | ✓ VERIFIED | 30 built-artifact cases, including C17-C22 and additional reconnect/accessor/stop regressions. |
| `packages/concierge/test/session-routing.test.ts` | FIFO, occurrence, context, metadata, and cancellation proof | ✓ VERIFIED | J01-J18 pass. |
| `packages/concierge/test/session-lifecycle.test.ts` | Stop/listener/diagnostic proof | ✓ VERIFIED | 21 tests, including L01-L18, pass. |
| `packages/concierge/src/index.ts` and built package | Public callable factory and exact surface | ✓ VERIFIED | ESM value export, declaration surface, guard, foreign import, dependency, and Node-floor checks pass. |
| Mutation register/evidence/battery | Exact compiled mutation and fail-closed release proof | ✓ VERIFIED | 37 ordered green rows, unique revision digests, exact fingerprints, isolated snapshots, restoration, and negative-control self-tests. |
| `07-VALIDATION.md` and `REQUIREMENTS.md` | Current task, release, and requirement closure | ✓ VERIFIED | Disposable ledger verifier accepted current counts/digests/statuses; TRN-02 remains intentionally Partial. |
| `07-REVIEW.md`, `07-REVIEW-FIX.md`, and `07-SECURITY.md` | Independent quality/security closure | ✓ VERIFIED | Review is clean with 0 findings; fixes are 2/2; security is `secured`, 7/7 dispositions resolved, 0 open threats. |

All PLAN-declared artifacts exist and are substantive. The SDK artifact helper's remaining false negatives are stale or syntactic expectations: multiline structural objects/exports evade its regex, PLAN 07-07's `re_audit_required` expectation has been superseded by the completed clean security audit, and REQUIREMENTS uses the inclusive range notation `M-07-C01..C16` rather than repeating the literal `M-07-C10`. Manual source tracing and executable gates verify each intended artifact.

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `src/index.ts` | `src/session.ts` | ESM value re-export | ✓ WIRED | `export { createSession } from "./session.js"` at line 154. |
| `createSession` | `assertSingleInstance` | First factory statement | ✓ WIRED | `session.ts:131-132`; F7/P02 discriminate removal. |
| Context/status transition | `Transport.setTools` | Serialized reference-identity publication | ✓ WIRED | Exact currentness is checked across resolver, capability, accessor, and callable boundaries; C01-C22 pass. |
| Superseded publication | batch admission | matching epoch/token abort and clear | ✓ WIRED | `abandonSupersededPublication` calls `abortEpoch` and `clearPublication`; C17 and M-07-C10/C11 discriminate both operations. |
| `Transport.onToolBatch` | `Concierge.dispatchBatch` | accepted occurrence → exact binding → lazy facade → one FIFO pump | ✓ WIRED | `acceptBatch`, `bindQueuedOccurrences`, and `runWork` connect at `session.ts:501-729`; J01-J18/C17-C22 pass. |
| Dispatcher rows | `Transport.respond` | one active-lifecycle-guarded attempt per row | ✓ WIRED | `session.ts:517-527`; J03/J04/L17/L18 prove order, no retry, and stop cutoff. |
| `Session.stop` | active/detached work | cached Promise, abort, response-disabled drain | ✓ WIRED | `session.ts:818-904`; lifecycle and reentrant catalog stop cases pass. |
| Stub harness | public `Transport` | exact structural assignment and type import | ✓ WIRED | Typecheck and U01-U08 pass; no production reachability exists. |
| Mutation battery | tests and immutable release snapshot | exact markers, disposable mutants, tracked manifest, digest-bracketed gates | ✓ WIRED | 37/37, self-test, inputs, and disposable ledgers all pass. |

### Data-Flow Trace (Level 4)

| Artifact / flow | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| Catalog publication | exact frozen catalog reference | context → `catalogFor` → `setTools` → confirmed/published state | Yes | ✓ FLOWING |
| Accessor-reentrant transition | publication token, epoch, requested context/generation | B accessor → nested C → B abort/clear → C confirm | Yes | ✓ FLOWING |
| Boundary failure recovery | active/requested/confirmed authority | caught current failure → continue queued controls → exact rollback → rethrow | Yes | ✓ FLOWING |
| Batch routing | original batch and exact arrival binding | transport callback → queue → lazy facade → `dispatchBatch` → ordered `respond` | Yes | ✓ FLOWING |
| Stop drain | active and queued accepted occurrences | `enterStopped` → abort/detach → response-disabled `runWork` → cached resolve | Yes | ✓ FLOWING |
| Stub observations | publications, responses, subscribers, failure counts | synchronous harness controls and attempt recorders | Yes | ✓ FLOWING |
| Release evidence | exits, test counts, input/revision digests | one immutable snapshot → seven gates → structured evidence → ledgers | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Build current artifact | `pnpm build` | Four artifacts emitted; ATTW/publint green | ✓ PASS |
| Original gap and follow-on closures | `pnpm exec vitest run packages/concierge/test/session-catalog.test.ts -t '\[C(17|18|19|20|21|22)\]'` | 1 file, 6/6 | ✓ PASS |
| Complete Phase 7 runtime surface | Vitest catalog/routing/lifecycle/stub files | 4 files, 77/77 | ✓ PASS |
| Repository regression gate | `pnpm test` | 16 files, 331/331 | ✓ PASS |
| Type surface | `pnpm typecheck` | Exit 0 | ✓ PASS |
| Mutation evidence | `node scripts/phase-07-mutation-battery.mjs verify all` | 37/37 green | ✓ PASS |
| Protected inputs | `node scripts/phase-07-mutation-battery.mjs verify inputs` | 3 files byte-identical | ✓ PASS |
| Harness negative controls | `node scripts/phase-07-mutation-battery.mjs self-test` | Every negative control rejected | ✓ PASS |
| Artifact/public surface | `pnpm check:artifact` | Strict publint and ESM-only ATTW pass | ✓ PASS |
| Dependency boundary | `pnpm check:deps` | Zero dependency bytes | ✓ PASS |
| Foreign packed consumer | `pnpm check:pack` | Real tarball installs, EOPT declarations typecheck, runtime imports, fixture absent | ✓ PASS |
| Node floor | `pnpm check:node-floor` | Tarball installs/imports under Node v22.12.0 | ✓ PASS |
| Immutable ledger/release replay | disposable clone: `node scripts/phase-07-mutation-battery.mjs verify ledgers` | Mutation, input, release, task, and requirement ledgers agree | ✓ PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` or PLAN-declared shell probe exists. The package's `test/fixtures/probe.ts` is not a skipped probe: `pnpm check:pack` copied and typechecked it from a foreign project against the shipped declarations, then imported the shipped runtime.

### Requirements Coverage

All five Phase 7 IDs appear in PLAN frontmatter and are mapped to Phase 7 in REQUIREMENTS.md. No orphaned Phase 7 requirement exists.

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| SES-01 | 07-01, 07-03, 07-04, 07-06, 07-07 | Start/stage/reconnect catalog publication | ✓ SATISFIED | C01-C22 and M-07-C01..C16/R03..R04 cover ordinary and adversarial publication authority. |
| SES-02 | 07-03, 07-04, 07-06, 07-07 | One routed result per call | ✓ SATISFIED | C11-C22/J01-J06/J15-J18 plus exact catalog/routing mutants prove progress, FIFO, cardinality, and no retry. |
| SES-03 | 07-01, 07-04, 07-06 | Preserve turn identity and delivery hook | ✓ SATISFIED | J07-J18 and M-07-R02..R05/R09 prove exact arrival evidence, lazy forwarding, and signal composition. |
| SES-04 | 07-01, 07-03, 07-05, 07-06, 07-07 | Clean unregister/cancel/drain | ✓ SATISFIED | C07-C22, L01-L18, and lifecycle/diagnostic mutants prove stop-first teardown and no post-stop output. |
| TRN-02 | 07-01 through 07-06 | No-network configurable stub exercises consent kernel | ✓ PHASE 7 ALLOCATION / OVERALL PARTIAL | U01-U08 and package exclusion prove the reusable no-network stub/session seam. Full consent-kernel use is explicitly owned by Phase 8 and must remain unchecked until then. |

### Review-Fix and Security Disposition

| Item | Current disposition | Independent evidence |
|---|---|---|
| Original accessor-abandoned publication gap | ✓ CLOSED | Matching attempt abort/clear exists; C17 passes both return/throw variants; M-07-C10/C11 independently kill removal of abort and clear. |
| C18 stale resolver/capability boundaries | ✓ CLOSED | `captureCurrent` uses a `finally` currentness gate; C18 and M-07-C12 pass. |
| C19 current error plus queued replay progress | ✓ CLOSED | Drain records first failure, continues controls, binds/pumps, then rethrows exact value; C19/M-07-C13 pass. |
| C20 queued requested authority | ✓ CLOSED | Queue-presence priority in `acceptBatch`; C20/M-07-C14 pass across boundary/catalog/stop variants. |
| C21 active requested authority | ✓ CLOSED | Active authority survives queue shift until exact confirm/failure; C21/M-07-C15 pass across repeat/supersession/replay/stop variants. |
| C22 failed request reconciliation | ✓ CLOSED | Exact failed requested identity rolls back to confirmed context without decrementing generation; C22/M-07-C16 pass across recovery matrices. |
| Final code review | ✓ CLEAN | `07-REVIEW.md`: 0 critical, 0 warning, 0 info; both prior findings independently closed. |
| Final security audit | ✓ SECURED | `07-SECURITY.md`: 7/7 threats resolved, 0 open, all six high-severity mitigations closed, one low supply-chain risk explicitly accepted. Only SECURITY/REQUIREMENTS documentation changed after its audited implementation revision. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| Phase-modified production source/tests/harness | — | Unreferenced `TBD`, `FIXME`, `XXX`, TODO/HACK, placeholder implementation, empty handler, or hardcoded hollow data | — | None found. Matches were test-count identifiers or explanatory prose, not executable debt/stubs. |
| `.planning/ROADMAP.md` | 345, 370 | Future Phase 8/9 plan counts are `TBD` | ℹ INFO | Explicit later-phase roadmap work, not Phase 7 implementation debt; Phase 8 is the recorded sink for full TRN-02. |

### Human Verification Required

None. Phase 7 is a headless deterministic library seam. Every claimed behavior is observable through built-artifact tests, strict type/package consumers, exact mutation detectors, and disposable release gates; no visual, external-service, subjective, or performance-feel criterion is in scope. The fix report's interim human-verification flag was discharged by the subsequent independent clean review, security audit, C17-C22 matrix, and re-verification runs.

### Gaps Summary

No actionable gaps remain. The original blocker and all follow-on authority/failure defects are closed in production code, covered by built-artifact regressions, independently discriminated by compiled mutations, and supported by current release/review/security evidence. No regression was found in the 23 truths that passed the initial verification.

Literal TRN-02 remains intentionally Partial because Phase 8 has not yet applied this fixture to the consent kernel. That deferred milestone requirement does not reduce Phase 7's score or block advancement; changing it to Complete now would be the error.

---

_Verified: 2026-08-10T05:44:44Z_
_Verifier: the agent (gsd-verifier)_
