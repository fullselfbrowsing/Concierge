---
phase: 07-session-and-the-transport-seam
verified: 2026-08-09T03:31:38Z
status: gaps_found
score: 23/28 must-haves verified
overrides_applied: 0
gaps:
  - truth: "A latest-wins context transition fully clears abandoned publication state so every post-transition batch is admitted under the confirmed context and produces one response per call."
    status: failed
    reason: "When a structural transport's setTools accessor synchronously enqueues context C whose catalog is the already-published catalog, the superseded B record returns without clearing publicationPending. The session reports stage C, but later batches are captured against stale context B and never enter dispatch or respond."
    artifacts:
      - path: "packages/concierge/src/session.ts"
        issue: "The stale return after reading transport.setTools at lines 760-768 omits clearPublication; the same-catalog fast path at lines 721-729 then confirms C without clearing B's pending publication."
      - path: "packages/concierge/test/session-catalog.test.ts"
        issue: "Accessor regressions cover stop() reentry, but not setContext(C) reentry where catalogFor(C) is the already-published reference."
      - path: ".planning/phases/07-session-and-the-transport-seam/07-MUTATION-REGISTER.json"
        issue: "No registered mutant targets abandoned publication cleanup after a reentrant setTools accessor, so 30/30 green does not discriminate this branch."
    missing:
      - "Clear and abort the superseded publication attempt when the setTools accessor invalidates its context record, before a queued same-published-catalog transition takes the fast path."
      - "Add a built-artifact regression that reenters setContext(C) from the setTools accessor with catalogFor(C) === publishedCatalog, then proves a later batch dispatches once under C and responds once."
      - "Add a compiled mutation for the cleanup branch, regenerate mutation/release evidence, and re-sign validation plus SES-02 traceability."
deferred:
  - truth: "Literal TRN-02 exercises the full consent kernel with the reusable configurable stub."
    addressed_in: "Phase 8"
    evidence: "ROADMAP Phase 7 notes and REQUIREMENTS.md explicitly keep TRN-02 unchecked/Partial until Phase 8 reuses this exact fixture against consent enforcement. Phase 7's reusable stub/session-seam allocation is verified here."
---

# Phase 7: Session and the Transport Seam Verification Report

**Phase Goal:** Something owns the loop between the catalog and the transport, so a stage change or a reconnect never leaves the agent holding a stale catalog — provable with no network.
**Verified:** 2026-08-09T03:31:38Z at `ddf7939774614df13269a6a501beec904a920aa9`
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

The standard Phase 7 gates are green, but the goal is not fully achieved. An independent built-artifact counterexample found an uncovered reentrant transition that leaves `publicationPending` stuck after the winning context is confirmed. A later valid transport batch is accepted against stale context B, never dispatched, and never answered. This directly falsifies the one-result-per-call roadmap contract.

### Observable Truths

Roadmap truths are merged with PLAN-frontmatter truths. Two clear restatements were deduplicated: the stub's synchronous no-I/O driving truth into roadmap criterion 5, and the one-response-attempt-per-row truth into roadmap criterion 2.

| # | Truth | Status | Evidence |
|---:|---|---|---|
| 1 | Stage/page changes publish the correct tool reference and connected transitions replay it without app work. | ✓ VERIFIED | C01-C16 pass; `processContext`/`processConnected` publish by reference at `session.ts:705-817`. |
| 2 | Every arriving tool batch produces exactly one result per call on the transport. | ✗ FAILED | The verifier's accessor-reentry probe produced `dispatchContexts: []` and `responses: []` for one valid call after stage C was confirmed. |
| 3 | Turn identity and the delivery hook reach the handler intact. | ✓ VERIFIED | J12/J13/J15-J18 pass; the null-prototype facade lazily forwards four evidence fields and replaces only `signal` at `session.ts:395-430`. |
| 4 | `stop()` unregisters, cancels, drains, and leaves no live listener, timer, or owned promise. | ✓ VERIFIED | L01-L18 pass; stop caches/marks/invalidates before cleanup and drains active/detached work at `session.ts:590-672`. No timer primitive exists in Session. |
| 5 | A configurable stub drives the Phase 7 seam with no network, WebRTC, browser, or vendor SDK. | ✓ VERIFIED | U01-U08 pass; the fixture is a synchronous closure-only structural Transport and is absent from source exports/tarball. |
| 6 | A consumer can implement the exact readonly, vendor-neutral six-member Transport lifecycle. | ✓ VERIFIED | `types.ts:1335-1367`, exact type predicates, and foreign package typecheck. |
| 7 | `Session.stop` is awaitable while Session retains exactly four public members. | ✓ VERIFIED | `types.ts:1840-1882`; source and packed declaration predicates pass. |
| 8 | `initialContext` and `onDiagnostic` accept computed optional values under EOPT. | ✓ VERIFIED | `types.ts:1884-1889`; local and foreign strict/EOPT probes pass. |
| 9 | Public Session diagnostics have a closed code vocabulary and exact safe readonly shape. | ✓ VERIFIED | Nine-code union at `types.ts:1815-1830`; L14-L16 exercise every runtime code and sink. |
| 10 | Conversational and command-palette capability profiles are frozen and differ only by capabilities. | ✓ VERIFIED | `stub-transport.ts:42-53`; U01 passes. |
| 11 | Stub `setTools`/`respond` attempts are recorded before deterministic occurrence failures. | ✓ VERIFIED | `stub-transport.ts:150-165`; U05 passes. |
| 12 | Stub catalog, response, and subscriber histories are immutable snapshots that preserve catalog identity. | ✓ VERIFIED | `stub-transport.ts:188-196`; U04/U07 pass. |
| 13 | Session creation synchronously publishes the exact initial catalog, or one frozen empty catalog without context. | ✓ VERIFIED | C01/C02 pass against `dist/index.js`. |
| 14 | Catalog identity follows what the transport actually holds; genuine reconnects replay the latest reference. | ✓ VERIFIED | C03/C04/C10-C16 and standard reentrant publication histories pass. |
| 15 | Latest-generation transitions fully reconcile publication state before batch admission resumes. | ✗ FAILED | `publicationPending` is set at `session.ts:748`; after accessor reentry, line 768 returns without `clearPublication`, and queued C's same-catalog fast path returns at line 729 with B still pending. |
| 16 | A fixed-catalog transport stops before exposing a catalog-change error. | ✓ VERIFIED | C06 and the fixed-capability reentry regression pass. |
| 17 | `createSession` is a callable public value with a direct single-instance guard and exact built surface. | ✓ VERIFIED | `index.ts:154`, `session.ts:110-111`, F7/P02, and exact 69/54/15 export tests. |
| 18 | Complete incoming batches run FIFO across dispatch, responses, and finalization. | ✗ FAILED | Normal J01 behavior passes, but the post-transition probe shows an accepted occurrence that never begins, so FIFO progress is not total. |
| 19 | Every batch captures the current arrival context/epoch, and authority changes abort old work. | ✗ FAILED | After stage C is confirmed, `acceptBatch` chooses stale `publishingContext` B at `session.ts:514-516` because the abandoned pending flag remains set. |
| 20 | Session preserves hostile envelope totality through lazy getters and signal-only composition. | ✓ VERIFIED | J11-J18 pass, including direct Phase 6 parity for every throwing evidence getter. |
| 21 | Every `stop()` call returns the same Promise before and after drain resolution. | ✓ VERIFIED | L01 and cleanup-time identity assertions pass. |
| 22 | Stop independently removes both subscriptions, invalidates transition/publication state, aborts/drains all accepted work, and suppresses output. | ✓ VERIFIED | L02-L08/L17/L18 pass; `enterStopped`, `performCleanup`, and `startStopDrain` are wired. |
| 23 | Stage listeners are tokenized, snapshot-based, ordered under nested changes, and independently contained. | ✓ VERIFIED | L09-L13 pass; `session.ts:548-574` and `:862-870`. |
| 24 | Every runtime diagnostic is fresh, frozen, fixed, detail-free, and sink failure is contained. | ✓ VERIFIED | `session.ts:42-61,159-180`; L14-L16 pass with secret-sentinel checks. |
| 25 | Every load-bearing Session branch has a compiled, exact, non-vacuous mutation detector. | ✗ FAILED | The 30 registered rows are genuinely green, but none covers cleanup after `setTools` accessor context reentry; the counterexample survives the full suite. |
| 26 | A strict/EOPT foreign consumer constructs and stops `createSession`, while the stub is absent from public package bytes. | ✓ VERIFIED | Snapshot `check:pack` exits 0; packed probe imports the exact factory/types and archive scan rejects stub/fixture paths. |
| 27 | All seven release commands run against one revision-bound immutable snapshot with unchanged manifests/lockfile. | ✓ VERIFIED | `verify ledgers` passed; recorded release digest `84e46d0a…`, seven zero exits, 16 files and 321/321 tests. |
| 28 | Validation/requirements ledgers agree with generated evidence and retain the Partial TRN-02 handoff. | ✓ VERIFIED mechanically | `verify ledgers` passes and TRN-02 is unchecked/Partial. Its SES-02 Complete claim is semantically superseded by this newly found blocker and must be re-signed after repair. |

**Score:** 23/28 truths verified

### Deferred Items

| Item | Addressed In | Evidence |
|---|---|---|
| Full literal TRN-02 consent-kernel exercise | Phase 8 | Phase 8's goal and success criteria own consent enforcement; Phase 7 intentionally supplies only the reusable fixture/session seam and keeps TRN-02 unchecked/Partial. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/concierge/src/types.ts` | Exact Transport/Session/config/diagnostic contracts | ✓ VERIFIED | Exists, substantive, exported, typechecked locally and from the tarball. |
| `packages/concierge/src/session.ts` | Hot publication, routing, teardown, and diagnostics | ✗ PARTIAL — BLOCKER | Substantive and wired, but abandoned publication state can remain live after reentrant accessor invalidation. |
| `packages/concierge/test/fixtures/stub-transport.ts` | Reusable deterministic no-I/O harness | ✓ VERIFIED | Exact six-key Transport, frozen profiles/harness, synchronous controls, deterministic failures, immutable histories. |
| `packages/concierge/test/session-catalog.test.ts` | Catalog/reconnect/reentrancy proof | ⚠ PARTIAL | 20 cases pass, including four review regressions; the failing accessor→same-published-catalog ordering is absent. |
| `packages/concierge/test/session-routing.test.ts` | FIFO, occurrence, context, metadata, and cancellation proof | ✓ VERIFIED for registered cases | J01-J18 pass; no test composes routing with the uncovered abandoned-publication ordering. |
| `packages/concierge/test/session-lifecycle.test.ts` | Stop/listener/diagnostic proof | ✓ VERIFIED | L01-L18 pass, including response-getter cutoff fixes. |
| `packages/concierge/src/index.ts` / package artifact | Public callable factory and exact surface | ✓ VERIFIED | Barrel, declarations, artifact parser, F7, foreign import, and Node-floor import pass. |
| Mutation register/evidence/battery | Exact compiled mutation and fail-closed release proof | ⚠ PARTIAL | Current 30 rows, restoration, digest, inputs, and snapshot release facts verify; coverage is not exhaustive because the discovered branch has no mutant. |
| `07-VALIDATION.md` / `REQUIREMENTS.md` | Current semantic requirement closure | ⚠ PARTIAL | Mechanically self-consistent, but SES-02 cannot remain Complete while the counterexample is open. |
| `07-REVIEW-FIX.md` / `07-SECURITY.md` | Closure of review/security issues | ⚠ PARTIAL | All four recorded fixes are present; the new accessor-context ordering is distinct and reopens the T-07-01/T-07-02 completeness claim. |

### Key Link Verification

The SDK helper's false negatives were path/regex heuristics (`Transport.onToolBatch`, `Session.stop`, multiline exports). Manual source tracing and executable tests establish the real links below.

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `src/index.ts` | `src/session.ts` | ESM value re-export | ✓ WIRED | `export { createSession } from "./session.js"` at line 154. |
| `createSession` | `assertSingleInstance` | first factory statement | ✓ WIRED | `session.ts:111`; F7/P02 discriminate removal. |
| Context/status transition | `Transport.setTools` | serialized reference-identity publication | ⚠ PARTIAL | Standard paths work; accessor invalidation can leave the old publication pending. |
| `Transport.onToolBatch` | `Concierge.dispatchBatch` | accepted record → lazy facade → one FIFO pump | ⚠ PARTIAL | Direct link exists at `session.ts:436,905`, but the uncovered pending state prevents pump entry. |
| Dispatcher rows | `Transport.respond` | one guarded `Reflect.apply` per row | ✓ WIRED when pump runs | J03/J04/L17/L18 pass; uncovered occurrence never reaches this link. |
| `Session.stop` | active/detached work | cached Promise, abort, response-disabled drain | ✓ WIRED | `session.ts:590-672`; lifecycle suite passes. |
| Stub harness | public `Transport` | exact structural assignment and type import | ✓ WIRED | Typecheck and U01-U08 pass. |
| Mutation battery | immutable release snapshot | tracked manifest, offline frozen install, digest around every gate | ✓ WIRED | README/LICENSE included; snapshot and A→B→A negative controls pass. |

### Data-Flow Trace (Level 4)

| Artifact / flow | Data | Source | Produces real data | Status |
|---|---|---|---|---|
| Normal catalog publication | frozen tool reference | context → `catalogFor` → `setTools` | Yes | ✓ FLOWING |
| Accessor-reentrant transition | pending publication/context | B publication accessor → queued C sharing published A | No — stale B remains authoritative for admission state | ✗ DISCONNECTED |
| Normal batch response | call/result rows | batch → lazy facade → `dispatchBatch` → `respond` | Yes | ✓ FLOWING |
| Counterexample batch | one valid call | post-C batch callback | No — zero dispatch and zero response | ✗ DISCONNECTED |
| Stop drain | active/queued accepted work | `enterStopped` → abort/detach → response-disabled `runWork` | Yes | ✓ FLOWING |
| Release evidence | exits/counts/digest | immutable snapshot → seven commands → structured JSON | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Current built artifact | `pnpm --filter @fullselfbrowsing/concierge build` | ATTW/publint clean; four artifacts emitted | ✓ PASS |
| Phase runtime surface | Vitest catalog/routing/lifecycle/stub/single-instance files | 5 files, 74/74 tests | ✓ PASS |
| Prior-phase regression gate | `pnpm test` | 16 files, 321/321 tests, zero pending/todo | ✓ PASS |
| Type surface | `pnpm typecheck` | exit 0 | ✓ PASS |
| Mutation/input evidence | `verify all && verify inputs` | 30/30 green; 3 files byte-identical | ✓ PASS |
| Ledger/release evidence | `verify ledgers` | all seven snapshot gates and ledgers agree | ✓ PASS |
| Evidence negative controls | `self-test` | every registered negative control rejected | ✓ PASS |
| Reentrant accessor counterexample | inline Node ESM probe against `dist/index.js` | `{"publications":["A"],"stage":"C","dispatchContexts":[],"responses":[]}` | ✗ FAIL |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` file or PLAN-declared probe path exists. The phase's executable proof drivers (`phase-07-mutation-battery.mjs`, packed foreign consumer, artifact/dependency/package/Node-floor gates) were executed through the commands above.

### Review-Fix and Security Disposition

| Recorded item | Independent current-tree result |
|---|---|
| CR-01 — stop from `setTools` accessor | ✓ Fixed for both setContext and reconnect; focused regressions pass and stale returned functions are not invoked. |
| CR-02 — resolver/capability reentry | ✓ Fixed; freshness checks follow each `catalogFor`, `stageFor`, capabilities, and `dynamicCatalog` boundary. |
| CR-03 — immutable release bytes | ✓ Fixed; required README/LICENSE and all tracked scopes run from one read-only offline snapshot. |
| WR-01 — response cutoff mutant | ✓ Fixed; L17/L18 are exact M-07-L03 detectors and pass restored. |
| Security `threats_open: 0` | ⚠ Superseded for this exact ordering: the new counterexample is a distinct stale-publication/FIFO availability path under T-07-01/T-07-02. |

### Requirements Coverage

All five Phase 7 IDs appear in PLAN frontmatter and are mapped to Phase 7 in REQUIREMENTS.md. No orphaned Phase 7 requirement exists.

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| SES-01 | 07-01, 07-03, 07-04, 07-06 | ✓ SATISFIED | Initial, identity-change, same-published-reference reconciliation, fixed transport, and reconnect cases C01-C16 pass. |
| SES-02 | 07-03, 07-04, 07-06 | ✗ BLOCKED | The verifier's accepted one-call batch produced zero dispatches and zero transport responses after accessor reentry. |
| SES-03 | 07-01, 07-04, 07-06 | ✓ SATISFIED | J12/J13/J15-J18 preserve ids/hook/calls and direct dispatcher totality. |
| SES-04 | 07-01, 07-03, 07-05, 07-06 | ✓ SATISFIED | C07-C14 and L01-L18 prove stop-first teardown, cancellation, draining, containment, and no post-stop output. |
| TRN-02 | 07-01 through 07-06 | ✓ PHASE 7 ALLOCATION / OVERALL PARTIAL | U01-U08 and package exclusion prove the reusable no-network stub/session seam. The literal full-consent-kernel requirement correctly remains unchecked for Phase 8. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `packages/concierge/src/session.ts` | 768 | Freshness failure returns without clearing the publication attempt | BLOCKER | Leaves admission pinned to stale B and prevents later batch progress. |
| `packages/concierge/test/session-catalog.test.ts` | 674-911 | Adjacent accessor/resolver regressions omit accessor→context-C sharing published catalog A | WARNING | Full suite and 30-mutant proof remain green despite the blocker. |
| Phase-modified source/tests | — | Unreferenced `TBD`, `FIXME`, `XXX`, TODO/HACK/placeholder implementation | — | None. `numTodoTests` identifiers and a historical prose use of “placeholder” are not debt markers or runtime stubs. |

### Human Verification Required

None. Phase 7 is a headless, deterministic library seam with no visual, external-service, subjective, or performance-feel criterion. The fixer report's generic human-verification note is superseded by direct automated execution; the remaining issue is a reproducible code gap, not a human judgment.

### Gaps Summary

One root cause blocks five merged truths. Reading `transport.setTools` is correctly treated as a reentrant outside boundary, but the invalidated context-publication branch returns without clearing its pending attempt. If that getter queued C and `catalogFor(C)` is exactly the catalog already held by the transport, C takes the same-catalog fast path, confirms stage C, and never clears B. Subsequent batches are admitted against stale B and remain permanently gated until another transition or stop.

This gap is not covered by Phase 8 or 9 and has no override. Repair the publication cleanup, add the built-artifact regression and a compiled exact mutant, regenerate evidence/release facts, then re-run verification. TRN-02 should remain Partial throughout; SES-02 must not be treated as closed until the counterexample receives exactly one response.

---

_Verified: 2026-08-09T03:31:38Z_
_Verifier: the agent (gsd-verifier)_
