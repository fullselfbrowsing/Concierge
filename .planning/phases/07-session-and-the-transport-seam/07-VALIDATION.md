---
phase: 07
slug: session-and-the-transport-seam
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-08
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Runtime framework** | Vitest 4.1.10, Node project, testing built `packages/concierge/dist/index.js` |
| **Type framework** | TypeScript 7.0.2 via `tsc -p packages/concierge/tsconfig.test-d.json` |
| **Config files** | `vitest.config.ts`; `packages/concierge/tsconfig.test-d.json` |
| **Catalog quick run** | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-catalog.test.ts` |
| **Routing quick run** | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-routing.test.ts` |
| **Lifecycle quick run** | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-lifecycle.test.ts` |
| **Stub quick run** | `pnpm exec vitest run packages/concierge/test/stub-transport.test.ts` |
| **Type run** | `pnpm --filter @fullselfbrowsing/concierge typecheck` |
| **Full suite** | `pnpm build && pnpm typecheck && pnpm test` |
| **Release gate** | `pnpm build && pnpm typecheck && pnpm test && pnpm check:artifact && pnpm check:deps && pnpm check:pack && pnpm check:node-floor` |
| **Measured final runtime** | 16 runtime files / 327 passed / 327 total / 0 pending / 0 todo (`pnpm test`, exit 0) |
| **Feedback bound** | Focused feedback remains split into exact files or bounded mutation shards; the final release gate is measured separately below |

Do not use `pnpm test -- <fragment>` for focused feedback. Build first, then invoke `pnpm exec vitest run <exact-file>` because runtime suites import `dist`.

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @fullselfbrowsing/concierge typecheck` plus the exact affected focused suite after production-source changes.
- **After every plan wave:** Run `pnpm build && pnpm typecheck && pnpm test`.
- **After the contract/export wave:** Also run `pnpm exec vitest run packages/concierge/test/artifact.test.ts packages/concierge/test/export-surface.test.ts packages/concierge/test/single-instance.test.ts`.
- **Before `$gsd-verify-work`:** Run the seven-command release gate, Phase 7 mutation battery, and byte-identical lockfile check.
- **Max feedback latency:** 5 seconds for focused feedback; split any slower mutation group into bounded ranges.

---

## Security Threat Index

| Ref | Threat | Required control | Measured verification | Status |
|-----|--------|------------------|-----------------------|--------|
| T-07-01 | Reentrant transition resumes stale catalog/context authority, mistakes confirmed authority for transport reality, or admits work before reconciliation | Serialized context/status transition drain, latest-generation checkpoints after every resolver/capability property read and invocation, separate publishing/published/confirmed catalog state, identity-based epoch promotion/abort, publication-gated pump, fixed-catalog fail-close, and abandoned-attempt cleanup after hostile accessor reentry | C01-C18 plus connected-replay getter regressions; M-07-C01..C12 and M-07-R03..R04 all compiled, ran named detectors, and were killed | ✅ mitigated |
| T-07-02 | Concurrent/retried routing duplicates work or responses | Session-wide FIFO, one `dispatchBatch` per accepted occurrence, one non-retried response attempt per row, including progress after an accessor-abandoned or resolver/capability-superseded publication | C11-C18, J01-J06, J15-J18; M-07-C05/C06/C09/C10/C11/C12 and M-07-R01/R06/R07/R08/R09 | ✅ mitigated |
| T-07-03 | Session invents/replaces consent evidence or eagerly reads a hostile envelope before Phase 6 can contain it | Lazy descriptor getters preserve response/turn ids, calls, and delivery hook; compose only signal; direct-dispatch parity | J07-J18; M-07-R02/R05/R09 | ✅ mitigated |
| T-07-04 | Transition, stop, or subscriber reentrancy leaves live state | Transition queue/generation guard; guarded outside resolver/capability boundaries; mark stopped and invalidate drain before outside calls; tokenized listeners; independent cleanup; no post-stop output | C10-C18, L01-L13; M-07-C05..C12 and M-07-L01..L08 | ✅ mitigated |
| T-07-05 | Publication/diagnostic failures leak secrets, reenter live state, or become a fatal callback path | Stop before diagnostic/cleanup reentrancy, closed immutable fixed messages/errors, no caught/raw values, contained runtime hook | C08, C09, C13, C14, J14-J18, L14-L16; M-07-L02/L07, M-07-R09, and M-07-D01/D02 | ✅ mitigated |
| T-07-06 | Public/package drift or a duplicate core copy bypasses the intended seam | Exact type/export pins, direct `assertSingleInstance`, foreign consumer and tarball gates | Exact 69/54/15 public surface, F7 direct guard, P02 guard kill, P01 package-exclusion kill, foreign exact-optional-property-types consumer, and byte-identical input hashes | ✅ mitigated |

Applicable security references are OWASP ASVS 5.0 V2, V4, V8, V15, and V16. V7 applies only by lifecycle analogy: this is an agent-runtime session, not an authentication session.

All six high-severity T-07-01..T-07-06 technical mitigations are mechanically verified; none is accepted. Because the expanded C17/C18 and M-07-C10/M-07-C11/M-07-C12 evidence postdates the prior independent audit, T-07-01 and T-07-02 remain `re_audit_required` in 07-SECURITY.md until `$gsd-secure-phase 7` reviews this repaired revision. Residual risk is revision-bound evidence plus the possibility that a future vendor transport misreports its capabilities. Phase 7 proves the neutral seam and deterministic fixture, not trust in an unimplemented vendor adapter. The low supply-chain risk is accepted because dependency contribution is zero bytes and all three protected inputs remained byte-identical.

---

## Per-Task Verification Map

Task and plan IDs are the expected decomposition from research; the planner must update this table if it chooses different IDs without reducing coverage.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | SES-01, SES-03, TRN-02 | T-07-03, T-07-06 | Four-status neutral lifecycle, exact readonly six-key Transport, and baseline-safe scoped identifier gate that kills an onReconnect member control | type + static | `pnpm --filter @fullselfbrowsing/concierge typecheck` plus scoped Transport-block Node gate | ✅ `packages/concierge/test-d/transport.test-d.ts`; TransportStatus and exact six-key pins | ✅ green |
| 07-01-02 | 01 | 1 | SES-04 | T-07-05, T-07-06 | Promise stop, EOPT-safe config, exact readonly nine-code diagnostics | type + security | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ✅ `packages/concierge/test-d/session.test-d.ts`; Session/config/diagnostic pins | ✅ green |
| 07-02-01 | 02 | 1 | TRN-02 | T-07-06 | Frozen profiles, exact six-key transport, fixture-import type pin, synchronous status/batch snapshots and counts | fixture + type + runtime | `pnpm --filter @fullselfbrowsing/concierge typecheck && pnpm exec vitest run packages/concierge/test/stub-transport.test.ts --testNamePattern="^\\[U0[1-4]\\]"` | ✅ `packages/concierge/test/fixtures/stub-transport.ts`, `packages/concierge/test-d/stub-transport.test-d.ts`; U01-U04 | ✅ green |
| 07-02-02 | 02 | 1 | TRN-02 | T-07-02, T-07-05, T-07-06 | Attempt-before-throw failures, immutable identity-preserving histories, test-only boundary | fixture + security | `pnpm exec vitest run packages/concierge/test/stub-transport.test.ts` | ✅ `packages/concierge/test/stub-transport.test.ts`; U05-U08 | ✅ green |
| 07-03-01 | 03 | 2 | SES-01, SES-02, SES-04 | T-07-01, T-07-04, T-07-05 | C01-C18 hot publication, serialized latest-wins context/status reentrancy, guarded resolver/capability boundaries, actual-published identity reconciliation, publication-gated batch admission, fixed-catalog stop-first, failing-publication batch drain, and accessor-abandonment recovery | integration + concurrency + security | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-catalog.test.ts` | ✅ `packages/concierge/test/session-catalog.test.ts`; C01-C18 | ✅ green |
| 07-03-02 | 03 | 2 | SES-01 | T-07-06 | Exact factory signature/value placement and truthful source/guard prose | type + integration | `pnpm --filter @fullselfbrowsing/concierge typecheck && pnpm --filter @fullselfbrowsing/concierge build` | ✅ `packages/concierge/test-d/session.test-d.ts`, `packages/concierge/test-d/exports.test-d.ts`; factory pin | ✅ green |
| 07-03-03 | 03 | 2 | SES-01 | T-07-06 | Callable artifact, exact 69/54/15 surface, direct createSession F7 guard | artifact + integration | `pnpm build && pnpm exec vitest run packages/concierge/test/artifact.test.ts packages/concierge/test/export-surface.test.ts packages/concierge/test/single-instance.test.ts` | ✅ artifact/export/single-instance suites; 69/54/15 and F7 | ✅ green |
| 07-04-01 | 04 | 3 | SES-02 | T-07-02, T-07-05 | Cross-batch FIFO, one dispatch occurrence, stable one-attempt responses, failure continuation | concurrency + integration | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-routing.test.ts --testNamePattern="^\\[J0[1-6]\\]"` | ✅ `packages/concierge/test/session-routing.test.ts`; J01-J06 | ✅ green |
| 07-04-02 | 04 | 3 | SES-01, SES-02, SES-03 | T-07-01, T-07-03, T-07-04, T-07-05 | J07-J18 arrival context/epoch, active/queued/held cancellation, lazy descriptor envelope, four throwing-getter direct-dispatch parity cases, signal-only replacement, and real-handler join | concurrency + totality + security | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-routing.test.ts` | ✅ `packages/concierge/test/session-routing.test.ts`; J07-J18 | ✅ green |
| 07-05-01 | 05 | 4 | SES-04 | T-07-01, T-07-02, T-07-04 | Stable cached drain, transition/publication-token invalidation, complete rollback/cleanup, queued/published-but-unconfirmed settlement, and no post-stop output | lifecycle + concurrency | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-lifecycle.test.ts --testNamePattern="^\\[L0[1-8]\\]"` | ✅ `packages/concierge/test/session-lifecycle.test.ts`; L01-L08 | ✅ green |
| 07-05-02 | 05 | 4 | SES-04 | T-07-04, T-07-05 | Reentrant tokenized queued listeners and contained immutable fixed diagnostics | hostile callback + security | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-lifecycle.test.ts` | ✅ `packages/concierge/test/session-lifecycle.test.ts`; L09-L16 | ✅ green |
| 07-06-01 | 06 | 5 | SES-01, SES-02, SES-03, SES-04, TRN-02 | T-07-01–T-07-06 | Foreign/package seam plus exact pending mutation register, independent actual-published identity/reentrancy/admission/eager-read counterexamples, and specified three-file input verifier | mutation + package | `node scripts/phase-07-mutation-battery.mjs self-test && node scripts/phase-07-mutation-battery.mjs refresh && node scripts/phase-07-mutation-battery.mjs verify inputs && pnpm check:pack` | ✅ probe, pack script, battery, register, and evidence; 33-row register plus self-tests | ✅ green |
| 07-06-02 | 06 | 5 | SES-01, SES-02, SES-03, SES-04, TRN-02 | T-07-01–T-07-06 | Revision-bound non-vacuous mutation kills, release gates, tar exclusion, live counts, byte-identical inputs | mutation + release | `node scripts/phase-07-mutation-battery.mjs verify all && node scripts/phase-07-mutation-battery.mjs verify inputs && pnpm build && pnpm typecheck && pnpm test && pnpm check:artifact && pnpm check:deps && pnpm check:pack && pnpm check:node-floor` | ✅ immutable evidence; M-07-C01..M-07-P02, 33/33 plus release facts | ✅ green |
| 07-06-03 | 06 | 5 | SES-01, SES-02, SES-03, SES-04, TRN-02 | T-07-01–T-07-06 | Live task/threat/mutation/release ledgers, SES-01..04 closure, and enforced pending/Partial TRN-02 Phase 8 handoff | ledger + integration | `node scripts/phase-07-mutation-battery.mjs verify ledgers` | ✅ `.planning/phases/07-session-and-the-transport-seam/07-VALIDATION.md` and `.planning/REQUIREMENTS.md`; live ledger closure | ✅ green |
| 07-07-01 | 07 | 6 | SES-01, SES-02 | T-07-01, T-07-02 | Hostile setTools and resolver/capability boundaries that queue C abandon B completely, retain C authority, and permit exactly one later dispatch and response across return/throw and distinct/same-catalog variants | integration + concurrency + security | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-catalog.test.ts --testNamePattern="^\\[C1[78]\\]"` | ✅ `packages/concierge/src/session.ts`, `packages/concierge/test/session-catalog.test.ts`; C17-C18 | ✅ green |
| 07-07-02 | 07 | 6 | SES-01, SES-02 | T-07-01, T-07-02 | Independent compiled C17 abort/clear mutants and the C18-only stale-boundary guard mutant plus complete regenerated revision-bound mutation evidence | mutation + concurrency | `node scripts/phase-07-mutation-battery.mjs verify all && node scripts/phase-07-mutation-battery.mjs verify inputs` | ✅ register/evidence; M-07-C10/M-07-C11/M-07-C12 and 33/33 green | ✅ green |
| 07-07-03 | 07 | 6 | SES-01, SES-02 | T-07-01, T-07-02, T-07-06 | Fresh immutable-snapshot release facts, re-signed Session ledgers, exact TRN-02 handoff, and explicit security re-audit boundary | ledger + release + security | `node scripts/phase-07-mutation-battery.mjs verify ledgers` | ✅ validation, requirements, security handoff, and generated release evidence | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement Closure Boundary

- SES-01, SES-02, SES-03, and SES-04 may become checked/Complete when all Phase 7 evidence is green.
- Literal TRN-02 includes exercising the full consent kernel. Phase 7 proves only U01-U08, reuse across every Session suite, zero-I/O behavior, and package exclusion; REQUIREMENTS must therefore keep TRN-02 unchecked with a `Partial` trace row until Phase 8 reuses this exact fixture against consent enforcement.
- `verify ledgers` must reject a checked/Complete TRN-02, a missing Phase 8 handoff, or any claim that all five requirement IDs close in Phase 7.

---

## Required Behavioral Matrix

| Area | Required distinguishers |
|------|-------------------------|
| Initial state | context / no context; connected / non-connected; dynamic / fixed catalog |
| Context change | same object mutated; distinct contexts matching actual published catalog; context matching older confirmed catalog after a different successful publication; different catalog with same stage id; different catalog and stage |
| Reconnect | first connected; reconnect after another status; repeated identical-status control suppressed by the stub; replay getter queues C before returning or throwing, with zero stale invocation/fatal error and final C authority |
| Transition reentrancy | nested context C from old-epoch abort; nested C from successful setTools(B); nested C from the B setTools accessor where C reuses already-published A; nested C from catalogFor/stageFor property capture or invocation and from capabilities/dynamicCatalog reads immediately before return or throw; B skipped before publication vs successfully published but not confirmed; distinct C, C catalog identical to published B, and C catalog identical to pre-transition confirmed A; histories A→C, A→B→C, A→B, and A→B→A; final newest context/catalog/stage plus exact accessor-time C dispatch/response authority |
| Publication admission | batch emitted before a setTools getter queues C, another emitted after C is queued, and batches emitted inside successful setTools with and without nested C; zero B dispatch/response authority; exact provisional cancellation response under C; zero premature handler/output; distinct/return-to-A C aborts B, same-published-B C promotes B epoch; exact held/later dispatch, handler, response, arrival-context, and epoch-state counts |
| Batch ordering | blocked batch A while B arrives; response throw in A; B begins only after A finalization |
| Epoch | active old work; queued old work; later new work; same-catalog update; transport signal aborted before and after arrival |
| Stop timing | before work; during dispatch; during response; from unsubscriber; from stage listener; repeated before and after resolution |
| Stage listeners | duplicate callback twice; stale unsubscribe; add/remove during snapshot; throw; nested context update; stop during notification |
| Setup rollback | first subscription throws; second throws; invalid unsubscriber; initial publication throws; cleanup also throws |
| Later publication failure | setTools throws on catalog-changing setContext; setTools throws on connected replay; stopped-before-diagnostic/cleanup reentrancy; both subscriptions inert; cleanup continues; fixed error/diagnostic only |
| Hostile envelope fields | throwing responseId, userTurnId, calls, and deferUntilDelivered getters; zero Session pre-read; one dispatch each; exact direct-Phase-6 row parity; later FIFO continuation; no sentinel leak |
| Diagnostics | default sink; replacement hook; throwing hook; frozen exact object; secret sentinel and raw identifiers absent |
| Stub | both profiles; occurrence-based failures; history mutation attempts; subscriber counts; package/barrel absence |

---

## Wave 0 Requirements

- [x] `packages/concierge/test-d/session.test-d.ts` is present with the config, diagnostic, stop, and callable-factory pins.
- [x] `packages/concierge/test-d/transport.test-d.ts` is present with lifecycle callbacks and the exact readonly six-key Transport pin.
- [x] `packages/concierge/test/fixtures/stub-transport.ts` is present as the reusable deterministic zero-network fixture.
- [x] `packages/concierge/test-d/stub-transport.test-d.ts` is present in the type-test project and pins exact six-key Transport conformance.
- [x] `packages/concierge/test/session-catalog.test.ts` is present and C01-C18 are named, discovered, and green.
- [x] `packages/concierge/test/session-routing.test.ts` is present and J01-J18 are named, discovered, and green.
- [x] `packages/concierge/test/session-lifecycle.test.ts` is present and L01-L16 are named, discovered, and green.
- [x] `packages/concierge/test/stub-transport.test.ts` is present and U01-U08 are named, discovered, and green.
- [x] Artifact/export/single-instance gates are present and green at 69/54/15 with F7; the foreign probe and tarball package-list gate are present and green.
- [x] `scripts/phase-07-mutation-battery.mjs` plus immutable register/evidence artifacts are present; the register digest is `b57d8a91933bf0884dd821047e6304def8138dd7a58d6759b38b1aadef813088` and all 33 rows are green.
- [x] Framework installation was not required; existing infrastructure executed every gate without a new dependency.

---

## Minimum Mutation Targets

The mutation harness must contain exactly 33 ordered mutants (12 catalog, 9 routing, 8 lifecycle, 2 diagnostic, 2 package/guard) and prove each mutant built and its named detector executed; a build failure alone is not behavioral proof.

Execution uses exactly ten contiguous same-group shards of at most four rows: C01-C04, C05-C08, C09-C12, R01-R04, R05-R08, R09-R09, L01-L04, L05-L08, D01-D02, and P01-P02.

Final gap-closure mapping, with a 33-row total and 12/9/8/2/2 distribution:

- M-07-C05 now mutates queued reconciliation to compare against confirmed authority instead of `publishedCatalog`, with exact detector C16; it replaces the former caller-specific later-setContext late-stop target.
- M-07-C06 now unconditionally aborts and republishes a queued context whose catalog is already the successfully published reference, detected by C15; it replaces the former caller-specific connected-replay late-stop target.
- M-07-C10 removes only the provisional abort for an accessor-superseded unpublished attempt; M-07-C11 independently removes only its publication clear. Both compile, run exactly C17, and are killed only by `[RED:C17:abandoned-publication-cleanup]`.
- M-07-C12 removes only the shared post-operation freshness guard. It compiles, runs exactly C18, and is killed only by `[RED:C18:stale-boundary-progress]`, whose 24 built-artifact variants require zero stale invocation/diagnostic/failure plus one later C dispatch and response.
- The displaced stop-first behavior remains mutation-covered by shared M-07-L02 with C08/C09/C13/C14/L01/L05 detectors, while failure-emitted-work drainage remains covered by M-07-L07 with C13/C14.

- Remove initial `setTools`; remove forced connected replay; compare stage strings instead of catalog references.
- Throw for a fixed-catalog transition before synchronously stopping; move the shared stopped/publication-token invalidation after outside cleanup, with C08/C09/C13/C14 all required to kill that lifecycle mutant.
- Reconcile a queued context against confirmed authority instead of the last successfully published transport reference; unconditionally abort/republish a successfully published epoch when the queued context uses that same published reference.
- Disable transitionDraining serialization; remove latest-generation checks after reentrant callbacks; allow the pump while publication is pending or newer transitions remain queued.
- Independently omit aborting or clearing the still-current unpublished B attempt after a hostile setTools accessor supersedes its context record.
- Remove the shared freshness/stale-exception guard after resolver property capture/invocation or capability reads.
- Omit active or queued epoch abort.
- Start two batch workers; read context at execution instead of arrival; forward only the transport signal.
- Replace the lazy descriptor envelope with an eager spread/property copy so a hostile getter escapes before Phase 6 guarded snapshotting.
- Dispatch an accepted queued occurrence zero or twice; retry `respond`; continue responses after stop.
- Allocate a new stop Promise; fail to drain detached queued/publication-in-progress/published-but-unconfirmed work.
- Iterate a retained live listener collection instead of a snapshot; key unsubscribe by callback identity; recursively emit a nested stage instead of queueing it; allow recursive post-teardown context/stage output.
- Interpolate a caught value or identifier into diagnostics; allow the diagnostic hook to escape.
- Export or pack the stub; remove the direct `assertSingleInstance` call.

---

## Measured Mutation Evidence

| Evidence | Measured result |
|----------|-----------------|
| Immutable register | Digest `b57d8a91933bf0884dd821047e6304def8138dd7a58d6759b38b1aadef813088` |
| Distribution | 12 catalog / 9 routing / 8 lifecycle / 2 diagnostics / 2 package-guard (`12/9/8/2/2`) |
| Outcome | 33/33 green; zero pending, zero escaped, zero failed |
| Non-vacuity | Every row compiled successfully, ran a nonzero named detector set, satisfied its detector, was killed, and matched its one exact source literal before mutation |
| Revision binding | Every row records a unique revision digest; all compiled-target hashes changed under mutation and returned to their recorded original values afterward |
| Restoration | Each target was mutated and restored only inside its disposable snapshot; the snapshot revision stayed stable and its restored gate passed, while live scoped endpoints matched before and after. This endpoint check does not prove uninterrupted live-history stability; no infrastructure error was recorded |
| Bounded execution | Exactly ten contiguous shards: C01-C04, C05-C08, C09-C12, R01-R04, R05-R08, R09-R09, L01-L04, L05-L08, D01-D02, P01-P02 |

The protected inputs were verified byte-identical before and after the battery:

| Input | SHA-256 |
|-------|---------|
| `package.json` | `a8267855dba9a429225090c505a78c6169415e2978ce6fb8fcdd6b28e18d542a` |
| `packages/concierge/package.json` | `5ed9d24829c2ac5bdcf69b57d4f4b503c226cee33f474ad07536521fec4112e4` |
| `pnpm-lock.yaml` | `0e29065f823200f9bdb2284bdef721003f525f68fa60a2810046b1a7f720e0d4` |

## Measured Release Evidence

Immutable snapshot release revision: digest `0c2fe699ade17c54cda98d9e0cab7d1d17dd3cb9b70988ab1e8aeb4abcb5ef13`, generated 2026-08-09 UTC; all seven commands ran against the same read-only snapshot with stable pre/around/post digests.

| Gate | Measured result |
|------|-----------------|
| `pnpm build` | Exit 0 |
| `pnpm typecheck` | Exit 0 |
| `pnpm test` | Exit 0; 16 runtime files, 327 passed, 327 total, 0 pending, 0 todo |
| `pnpm check:artifact` | Exit 0; callable artifact and exact public declaration surface of 69 names / 54 types / 15 values |
| Direct guard | F7 passed and P02 killed exactly the direct `createSession` single-instance guard |
| `pnpm check:deps` | Exit 0; dependency contribution is zero bytes |
| `pnpm check:pack` | Exit 0; foreign tarball install, typecheck with `exactOptionalPropertyTypes`, and runtime import of `createSession`/public types passed; the test-only stub fixture is absent from the tarball |
| `pnpm check:node-floor` | Exit 0 under Node v22.12.0 |

---

## Manual-Only Verifications

All Phase 7 behaviors have automated verification. No network, browser, vendor account, framework host, or human perceptual judgment is in scope.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verification or explicit Wave 0 dependencies.
- [x] Sampling continuity: no three consecutive tasks lack automated feedback.
- [x] Wave 0 covers every missing test and fixture above.
- [x] No watch-mode flags or hidden fixture timers.
- [x] Focused feedback latency stays below 5 seconds or is split into bounded groups.
- [x] All five requirement IDs map to tests and mutation targets; SES-01..04 are Complete while TRN-02 remains unchecked/Partial with the Phase 8 consent-kernel handoff.
- [x] Final runtime/type/artifact/package counts are measured live rather than copied from the Phase 6 baseline.
- [x] `nyquist_compliant: true`, `wave_0_complete: true`, and `status: complete` are set only after plans and evidence agree.
- [x] Approval records the actual UTC date, matching register digest, 33/33 outcome, and green release gate.

**Approval:** approved 2026-08-09 — register b57d8a91933bf0884dd821047e6304def8138dd7a58d6759b38b1aadef813088; 33/33 green; release gate green
