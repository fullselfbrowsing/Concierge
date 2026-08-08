---
phase: 07
slug: session-and-the-transport-seam
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| **Current baseline** | 12 runtime files / 252 tests / 0 pending / 0 todo; replace with measured final counts during sign-off |
| **Estimated runtime** | Focused feedback should remain under 5 seconds; record measured full-gate duration during execution |

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

| Ref | Threat | Required control |
|-----|--------|------------------|
| T-07-01 | Reentrant transition resumes stale catalog/context authority, mistakes confirmed authority for transport reality, or admits work before reconciliation | Serialized context/status transition drain, latest-generation checkpoints, separate publishing/published/confirmed catalog state, identity-based epoch promotion/abort, publication-gated pump, fixed-catalog fail-close |
| T-07-02 | Concurrent/retried routing duplicates work or responses | Session-wide FIFO, one `dispatchBatch` per accepted occurrence, one non-retried response attempt per row |
| T-07-03 | Session invents/replaces consent evidence or eagerly reads a hostile envelope before Phase 6 can contain it | Lazy descriptor getters preserve response/turn ids, calls, and delivery hook; compose only signal; direct-dispatch parity |
| T-07-04 | Transition, stop, or subscriber reentrancy leaves live state | Transition queue/generation guard; mark stopped and invalidate drain before outside calls; tokenized listeners; independent cleanup; no post-stop output |
| T-07-05 | Publication/diagnostic failures leak secrets, reenter live state, or become a fatal callback path | Stop before diagnostic/cleanup reentrancy, closed immutable fixed messages/errors, no caught/raw values, contained runtime hook |
| T-07-06 | Public/package drift or a duplicate core copy bypasses the intended seam | Exact type/export pins, direct `assertSingleInstance`, foreign consumer and tarball gates |

Applicable security references are OWASP ASVS 5.0 V2, V4, V8, V15, and V16. V7 applies only by lifecycle analogy: this is an agent-runtime session, not an authentication session.

---

## Per-Task Verification Map

Task and plan IDs are the expected decomposition from research; the planner must update this table if it chooses different IDs without reducing coverage.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | SES-01, SES-03, TRN-02 | T-07-03, T-07-06 | Four-status neutral lifecycle, exact readonly six-key Transport, and baseline-safe scoped identifier gate that kills an onReconnect member control | type + static | `pnpm --filter @fullselfbrowsing/concierge typecheck` plus scoped Transport-block Node gate | `test-d/transport.test-d.ts` update required | ⬜ pending |
| 07-01-02 | 01 | 1 | SES-04 | T-07-05, T-07-06 | Promise stop, EOPT-safe config, exact readonly nine-code diagnostics | type + security | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ `test-d/session.test-d.ts` W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | TRN-02 | T-07-06 | Frozen profiles, exact six-key transport, fixture-import type pin, synchronous status/batch snapshots and counts | fixture + type + runtime | `pnpm --filter @fullselfbrowsing/concierge typecheck && pnpm exec vitest run packages/concierge/test/stub-transport.test.ts --testNamePattern="^\\[U0[1-4]\\]"` | ❌ fixture + test-d W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | TRN-02 | T-07-02, T-07-05, T-07-06 | Attempt-before-throw failures, immutable identity-preserving histories, test-only boundary | fixture + security | `pnpm exec vitest run packages/concierge/test/stub-transport.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | SES-01, SES-02, SES-04 | T-07-01, T-07-04, T-07-05 | C01-C16 hot publication, serialized latest-wins context/status reentrancy, actual-published identity reconciliation, publication-gated batch admission, fixed-catalog stop-first, and failing-publication batch drain | integration + concurrency + security | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-catalog.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | SES-01 | T-07-06 | Exact factory signature/value placement and truthful source/guard prose | type + integration | `pnpm --filter @fullselfbrowsing/concierge typecheck && pnpm --filter @fullselfbrowsing/concierge build` | existing files + W0 factory pin | ⬜ pending |
| 07-03-03 | 03 | 2 | SES-01 | T-07-06 | Callable artifact, exact 69/54/15 surface, direct createSession F7 guard | artifact + integration | `pnpm build && pnpm exec vitest run packages/concierge/test/artifact.test.ts packages/concierge/test/export-surface.test.ts packages/concierge/test/single-instance.test.ts` | existing files need updates | ⬜ pending |
| 07-04-01 | 04 | 3 | SES-02 | T-07-02, T-07-05 | Cross-batch FIFO, one dispatch occurrence, stable one-attempt responses, failure continuation | concurrency + integration | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-routing.test.ts --testNamePattern="^\\[J0[1-6]\\]"` | ❌ W0 | ⬜ pending |
| 07-04-02 | 04 | 3 | SES-01, SES-02, SES-03 | T-07-01, T-07-03, T-07-04, T-07-05 | J07-J18 arrival context/epoch, active/queued/held cancellation, lazy descriptor envelope, four throwing-getter direct-dispatch parity cases, signal-only replacement, and real-handler join | concurrency + totality + security | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-routing.test.ts` | ❌ W0 | ⬜ pending |
| 07-05-01 | 05 | 4 | SES-04 | T-07-01, T-07-02, T-07-04 | Stable cached drain, transition/publication-token invalidation, complete rollback/cleanup, queued/published-but-unconfirmed settlement, and no post-stop output | lifecycle + concurrency | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-lifecycle.test.ts --testNamePattern="^\\[L0[1-8]\\]"` | ❌ W0 | ⬜ pending |
| 07-05-02 | 05 | 4 | SES-04 | T-07-04, T-07-05 | Reentrant tokenized queued listeners and contained immutable fixed diagnostics | hostile callback + security | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-lifecycle.test.ts` | ❌ W0 | ⬜ pending |
| 07-06-01 | 06 | 5 | SES-01, SES-02, SES-03, SES-04, TRN-02 | T-07-01–T-07-06 | Foreign/package seam plus exact pending 30-mutant register, independent actual-published identity/reentrancy/admission/eager-read counterexamples, and specified three-file input verifier | mutation + package | `node scripts/phase-07-mutation-battery.mjs self-test && node scripts/phase-07-mutation-battery.mjs refresh && node scripts/phase-07-mutation-battery.mjs verify inputs && pnpm check:pack` | ❌ W0 | ⬜ pending |
| 07-06-02 | 06 | 5 | SES-01, SES-02, SES-03, SES-04, TRN-02 | T-07-01–T-07-06 | Thirty non-vacuous mutation kills, release gates, tar exclusion, live counts, byte-identical inputs | mutation + release | `node scripts/phase-07-mutation-battery.mjs verify all && node scripts/phase-07-mutation-battery.mjs verify inputs && pnpm build && pnpm typecheck && pnpm test && pnpm check:artifact && pnpm check:deps && pnpm check:pack && pnpm check:node-floor` | ❌ W0 evidence | ⬜ pending |
| 07-06-03 | 06 | 5 | SES-01, SES-02, SES-03, SES-04, TRN-02 | T-07-01–T-07-06 | Live task/threat/mutation/release ledgers, SES-01..04 closure, and enforced pending/Partial TRN-02 Phase 8 handoff | ledger + integration | `node scripts/phase-07-mutation-battery.mjs verify ledgers` | existing ledgers need updates | ⬜ pending |

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
| Reconnect | first connected; reconnect after another status; repeated identical-status control suppressed by the stub |
| Transition reentrancy | nested context C from old-epoch abort; nested C from successful setTools(B); B skipped before publication vs successfully published but not confirmed; distinct C, C catalog identical to published B, and C catalog identical to pre-transition confirmed A; histories A→C, A→B→C, A→B, and A→B→A; final newest context/catalog/stage |
| Publication admission | batch emitted inside successful setTools with and without nested C; zero premature handler/output; distinct/return-to-A C aborts B, same-published-B C promotes B epoch; exact held/later dispatch, handler, response, arrival-context, and epoch-state counts |
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

- [ ] `packages/concierge/test-d/session.test-d.ts` — 07-01-02 creates config/diagnostic/stop pins; 07-03-02 adds the callable factory pin.
- [ ] Update `packages/concierge/test-d/transport.test-d.ts` — 07-01-01 owns lifecycle callback and exact six-key pin.
- [ ] `packages/concierge/test/fixtures/stub-transport.ts` — 07-02-01/02 own the reusable deterministic fixture.
- [ ] `packages/concierge/test-d/stub-transport.test-d.ts` — 07-02-01 imports the fixture into tsconfig.test-d.json and pins exact six-key Transport conformance after the Wave 1 merge.
- [ ] `packages/concierge/test/session-catalog.test.ts` — 07-03-01 owns C01-C16 SES-01 publication, actual-published identity reconciliation, transition reentrancy, admission gating, and fail-closed batch-drain RED scaffolding before source edits.
- [ ] `packages/concierge/test/session-routing.test.ts` — 07-04-01/02 own J01-J18 FIFO/epoch/lazy-envelope/hostile-getter parity RED scaffolding before source edits.
- [ ] `packages/concierge/test/session-lifecycle.test.ts` — 07-05-01/02 own SES-04 rollback/reentrancy/diagnostic RED scaffolding before source edits.
- [ ] `packages/concierge/test/stub-transport.test.ts` — 07-02-01/02 own TRN-02 fixture proof.
- [ ] Artifact/export/single-instance gates — 07-03-03; foreign probe and tarball package-list gate — 07-06-01.
- [ ] `scripts/phase-07-mutation-battery.mjs` and immutable register/evidence artifacts — 07-06-01 creates pending definitions and 07-06-02 records non-vacuous evidence.
- [ ] Framework installation — none; existing infrastructure covers execution.

---

## Minimum Mutation Targets

The mutation harness must contain exactly 30 ordered mutants (9 catalog, 9 routing, 8 lifecycle, 2 diagnostic, 2 package/guard) and prove each mutant built and its named detector executed; a build failure alone is not behavioral proof.

Execution uses exactly ten contiguous same-group shards of at most four rows: C01-C03, C04-C06, C07-C09, R01-R04, R05-R08, R09-R09, L01-L04, L05-L08, D01-D02, and P01-P02.

Final replacement mapping, with the 30-row total and 9/9/8/2/2 distribution unchanged:

- M-07-C05 now mutates queued reconciliation to compare against confirmed authority instead of `publishedCatalog`, with exact detector C16; it replaces the former caller-specific later-setContext late-stop target.
- M-07-C06 now unconditionally aborts and republishes a queued context whose catalog is already the successfully published reference, detected by C15; it replaces the former caller-specific connected-replay late-stop target.
- The displaced stop-first behavior remains mutation-covered by shared M-07-L02 with C08/C09/C13/C14/L01/L05 detectors, while failure-emitted-work drainage remains covered by M-07-L07 with C13/C14.

- Remove initial `setTools`; remove forced connected replay; compare stage strings instead of catalog references.
- Throw for a fixed-catalog transition before synchronously stopping; move the shared stopped/publication-token invalidation after outside cleanup, with C08/C09/C13/C14 all required to kill that lifecycle mutant.
- Reconcile a queued context against confirmed authority instead of the last successfully published transport reference; unconditionally abort/republish a successfully published epoch when the queued context uses that same published reference.
- Disable transitionDraining serialization; remove latest-generation checks after reentrant callbacks; allow the pump while publication is pending or newer transitions remain queued.
- Omit active or queued epoch abort.
- Start two batch workers; read context at execution instead of arrival; forward only the transport signal.
- Replace the lazy descriptor envelope with an eager spread/property copy so a hostile getter escapes before Phase 6 guarded snapshotting.
- Dispatch an accepted queued occurrence zero or twice; retry `respond`; continue responses after stop.
- Allocate a new stop Promise; fail to drain detached queued/publication-in-progress/published-but-unconfirmed work.
- Iterate a retained live listener collection instead of a snapshot; key unsubscribe by callback identity; recursively emit a nested stage instead of queueing it; allow recursive post-teardown context/stage output.
- Interpolate a caught value or identifier into diagnostics; allow the diagnostic hook to escape.
- Export or pack the stub; remove the direct `assertSingleInstance` call.

---

## Manual-Only Verifications

All Phase 7 behaviors have automated verification. No network, browser, vendor account, framework host, or human perceptual judgment is in scope.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or explicit Wave 0 dependencies.
- [ ] Sampling continuity: no three consecutive tasks lack automated feedback.
- [ ] Wave 0 covers every missing test and fixture above.
- [ ] No watch-mode flags or hidden fixture timers.
- [ ] Focused feedback latency stays below 5 seconds or is split into bounded groups.
- [ ] All five requirement IDs map to tests and mutation targets; SES-01..04 are Complete while TRN-02 remains unchecked/Partial with the Phase 8 consent-kernel handoff.
- [ ] Final runtime/type/artifact/package counts are measured live rather than copied from the Phase 6 baseline.
- [ ] `nyquist_compliant: true`, `wave_0_complete: true`, and `status: complete` are set only after plans and evidence agree.
- [ ] `**Approval:** pending` is replaced by `**Approval:** approved YYYY-MM-DD — register <digest>; 30/30 green; release gate green` using the actual UTC date and matching evidence digest.

**Approval:** pending
