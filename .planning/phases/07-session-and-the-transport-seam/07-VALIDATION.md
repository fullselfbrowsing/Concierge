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
| T-07-01 | Stale catalog or old-context work survives an authority change | Catalog-reference epoch, connected replay, fixed-catalog fail-closed stop, old-epoch cancellation |
| T-07-02 | Concurrent/retried routing duplicates work or responses | Session-wide FIFO, one `dispatchBatch` per accepted occurrence, one non-retried response attempt per row |
| T-07-03 | Session invents or replaces consent evidence | Preserve response/turn ids, calls, and delivery hook; compose only the cancellation signal |
| T-07-04 | Stop or subscriber reentrancy leaves live state | Mark stopped and cache drain before outside calls; tokenized listeners; independent cleanup; no post-stop output |
| T-07-05 | Diagnostics leak secrets or become a fatal callback path | Closed immutable fixed messages, no caught/raw values, contained runtime hook |
| T-07-06 | Public/package drift or a duplicate core copy bypasses the intended seam | Exact type/export pins, direct `assertSingleInstance`, foreign consumer and tarball gates |

Applicable security references are OWASP ASVS 5.0 V2, V4, V8, V15, and V16. V7 applies only by lifecycle analogy: this is an agent-runtime session, not an authentication session.

---

## Per-Task Verification Map

Task and plan IDs are the expected decomposition from research; the planner must update this table if it chooses different IDs without reducing coverage.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | SES-01, SES-03, SES-04, TRN-02 | T-07-03, T-07-06 | Six-key neutral Transport, Promise-returning stop, exact diagnostic/config contracts | type | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | TRN-02 | T-07-02, T-07-06 | Frozen capability profiles, synchronous controls, immutable histories, no product export | fixture + runtime | `pnpm exec vitest run packages/concierge/test/stub-transport.test.ts` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | SES-01 | T-07-01, T-07-04 | Hot publication, identity epochs, connected replay, fixed-catalog fail-closed behavior | integration + security | catalog quick run | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | SES-01 | T-07-06 | Callable factory, truthful barrel/artifact, exact export counts, direct single-instance guard | artifact + integration | artifact/export/single-instance focused run | existing files need updates | ⬜ pending |
| 07-04-01 | 04 | 3 | SES-02, SES-03 | T-07-02, T-07-03 | Cross-batch FIFO, one dispatch occurrence, stable one-attempt responses, intact metadata | concurrency + integration | routing quick run | ❌ W0 | ⬜ pending |
| 07-04-02 | 04 | 3 | SES-01, SES-03 | T-07-01, T-07-03 | Arrival-time context capture and transport/epoch/stop signal composition | concurrency + security | routing quick run | ❌ W0 | ⬜ pending |
| 07-05-01 | 05 | 4 | SES-04 | T-07-04 | Reference-stable drain, complete rollback/cleanup, queued-work settlement, no post-stop output | lifecycle + concurrency | lifecycle quick run | ❌ W0 | ⬜ pending |
| 07-05-02 | 05 | 4 | SES-04 | T-07-04, T-07-05 | Reentrant tokenized listeners and contained immutable safe diagnostics | hostile callback + security | lifecycle quick run | ❌ W0 | ⬜ pending |
| 07-06-01 | 06 | 5 | SES-01, SES-02, SES-03, SES-04, TRN-02 | T-07-01–T-07-06 | Each load-bearing branch has a named behavioral mutation detector | mutation | `node scripts/phase-07-mutation-battery.mjs` | ❌ W0 | ⬜ pending |
| 07-06-02 | 06 | 5 | SES-01, SES-02, SES-03, SES-04, TRN-02 | T-07-06 | Release gates green, stub absent from package, lockfile unchanged, live counts recorded | package + integration | release gate plus lockfile comparison | existing gates need updates | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Required Behavioral Matrix

| Area | Required distinguishers |
|------|-------------------------|
| Initial state | context / no context; connected / non-connected; dynamic / fixed catalog |
| Context change | same object mutated; distinct contexts same catalog; different catalog with same stage id; different catalog and stage |
| Reconnect | first connected; reconnect after another status; repeated identical-status control suppressed by the stub |
| Batch ordering | blocked batch A while B arrives; response throw in A; B begins only after A finalization |
| Epoch | active old work; queued old work; later new work; same-catalog update; transport signal aborted before and after arrival |
| Stop timing | before work; during dispatch; during response; from unsubscriber; from stage listener; repeated before and after resolution |
| Stage listeners | duplicate callback twice; stale unsubscribe; add/remove during snapshot; throw; nested context update; stop during notification |
| Setup rollback | first subscription throws; second throws; invalid unsubscriber; initial publication throws; cleanup also throws |
| Diagnostics | default sink; replacement hook; throwing hook; frozen exact object; secret sentinel and raw identifiers absent |
| Stub | both profiles; occurrence-based failures; history mutation attempts; subscriber counts; package/barrel absence |

---

## Wave 0 Requirements

- [ ] `packages/concierge/test-d/session.test-d.ts` — factory, config, diagnostic, stop, exact-key and readonly pins.
- [ ] Update `packages/concierge/test-d/transport.test-d.ts` — lifecycle callback and six-key pin.
- [ ] `packages/concierge/test/fixtures/stub-transport.ts` — reusable deterministic fixture.
- [ ] `packages/concierge/test/session-catalog.test.ts` — SES-01 and fixed-catalog lifecycle.
- [ ] `packages/concierge/test/session-routing.test.ts` — SES-02, SES-03, FIFO and epoch cancellation.
- [ ] `packages/concierge/test/session-lifecycle.test.ts` — SES-04, rollback, reentrancy and diagnostics.
- [ ] `packages/concierge/test/stub-transport.test.ts` — TRN-02 fixture proof.
- [ ] Update artifact, export-surface, single-instance, foreign-probe and package-list gates for the new public contracts.
- [ ] `scripts/phase-07-mutation-battery.mjs` plus immutable register/evidence artifacts, following Phase 6's compiled-and-ran detector rule.
- [ ] Framework installation — none; existing infrastructure covers execution.

---

## Minimum Mutation Targets

The mutation harness must prove the mutant built and the named detector executed; a build failure alone is not behavioral proof.

- Remove initial `setTools`; remove forced connected replay; compare stage strings instead of catalog references.
- Throw for a fixed-catalog transition before synchronously stopping; omit active or queued epoch abort.
- Start two batch workers; read context at execution instead of arrival; forward only the transport signal.
- Dispatch an accepted queued occurrence zero or twice; retry `respond`; continue responses after stop.
- Allocate a new stop Promise; mark stopped after outside cleanup; fail to drain detached queued work.
- Iterate a live listener map; key unsubscribe by callback identity; allow a stale callback or stage event after stop.
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
- [ ] All five requirement IDs map to both tests and mutation targets.
- [ ] Final runtime/type/artifact/package counts are measured live rather than copied from the Phase 6 baseline.
- [ ] `nyquist_compliant: true`, `wave_0_complete: true`, and `status: approved` are set only after plans and evidence agree.

**Approval:** pending
