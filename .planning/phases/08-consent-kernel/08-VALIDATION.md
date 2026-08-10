---
phase: 08
slug: consent-kernel
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-10
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Runtime framework** | Vitest 4.1.10, Node project, testing built `packages/concierge/dist/index.js` |
| **Type framework** | TypeScript 7.0.2 via `tsc -p packages/concierge/tsconfig.test-d.json` |
| **Config files** | `vitest.config.ts`; `packages/concierge/tsconfig.test-d.json` |
| **Consent quick run** | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/consent-kernel.test.ts` |
| **Canonicalization quick run** | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/readback-canonicalization.test.ts` |
| **Catalog quick run** | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/catalog.test.ts` |
| **Session quick run** | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-consent.test.ts` |
| **Type run** | `pnpm --filter @fullselfbrowsing/concierge typecheck` |
| **Full suite** | `pnpm build && pnpm typecheck && pnpm test` |
| **Release gate** | `pnpm build && pnpm typecheck && pnpm test && pnpm check:artifact && pnpm check:deps && pnpm check:pack && pnpm check:node-floor` |
| **Measured baseline** | 16 runtime files / 331 tests green; build + typecheck + full suite completed in 3.71 s on 2026-08-10 |
| **Expected feedback bound** | focused build + exact-file test under 5 s; full suite under 10 s before mutation and package gates |

Runtime tests import `dist`; build before every focused runtime run. Do not place a fragment after `--`, because this repository's Vitest invocation will not filter as intended. Use an exact test file with `pnpm exec vitest run`.

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @fullselfbrowsing/concierge typecheck` plus the exact affected focused suite after production-source changes.
- **After every plan wave:** Run `pnpm build && pnpm typecheck && pnpm test`.
- **After public contract changes:** Also run artifact, export-surface, and single-instance suites.
- **Before `/gsd-verify-work`:** Run the release gate, the Phase 8 mutation battery, exact tarball/foreign-consumer checks, and `git status --porcelain`.
- **Max feedback latency:** 5 seconds for focused feedback; split mutation runs into bounded shards if any shard exceeds 60 seconds.

---

## Security Threat Index

| Ref | Threat | Required control | Required evidence |
|-----|--------|------------------|-------------------|
| T-08-01 | The agent self-approves in the review response or a forgeable turn | Non-empty, distinct boundary ids; human-attested user-turn provenance; catalog and session dominance gates | Same-turn, missing-id, agent-forgeable, and new-human-turn tests |
| T-08-02 | Review return or partial delivery arms authority | Generation-guarded pending state installed before callback; only matching completed delivery may arm | Flagship interrupted-delivery then genuine-new-turn case plus sync/late/duplicate callback tests |
| T-08-03 | Reviewed payload or app state drifts before confirm | Exact detached validated payload, normalized snapshot, late comparison, mismatch/throw destruction | Reference-identity, drift, comparator-throw, and fresh-review supersession tests |
| T-08-04 | Capability declaration is mistaken for achieved proof | Capabilities are ceilings; occurrence evidence derives achieved grade | Grade mismatch and every missing-evidence-component test |
| T-08-05 | Receipt/hash is forged or canonicalization collides | Core-owned strict RFC 8785 + UTF-8, injected digest recomputation, exact retained bytes and all hash locations compared | Official vectors; non-JSON rejection; byte/hash/algorithm/canonicalization mismatch cases |
| T-08-06 | A delivery hash is mistaken for a human act | Separate closed `ReadbackAttestation`, confirmed act, trustworthy turn, response/generation ownership | Confirmed/declined/dismissed and hash/turn/generation mismatch matrix |
| T-08-07 | Retry or reentrancy arms/consumes more than once | Every transition behind exact-Promise dispatch dedupe; atomic consume before handler | Promise identity, duplicate callId, reentrant callback, handler-failure, and second-confirm tests |
| T-08-08 | The model rewrites app failure prose | Required app-owned batch sink completes before first `respond`; no model text; fixed diagnostic/no retry on failure | Shared event-order history, immutable stable rows, throw/reject/interruption and all-success cases |
| T-08-09 | Client assertion is treated as server authorization | Worked SEC-04 server challenge, independent auth/payload/freshness/single-use verification, effect then burn | README content test plus human semantic review during final security audit |
| T-08-10 | Hostile callbacks/objects leak secrets or escape | Snapshot once, reject accessors/exotics, contain throws, fixed reasons/diagnostics, never echo caught values | Diagnostic-safety sentinels and hostile getter/proxy/callback cases |

OWASP ASVS Level 1 is the minimum gate. Treat every T-08-01..T-08-10 control as blocking; no high-severity threat may be accepted without explicit user approval.

---

## Per-Task Verification Map

Task and plan IDs are the expected research decomposition. The planner must reconcile this table if it chooses different IDs without reducing requirement, decision, or threat coverage.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | CON-07, CON-09, CON-10, TRN-03 | T-08-01, T-08-04, T-08-06, T-08-08 | Exact readonly profile, attestation, delivery, outcome, and SessionConfig shapes | type | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ✅ existing type suite; new pins W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | CON-07, CON-09, CON-10 | T-08-04, T-08-06, T-08-08 | Export surface, declaration artifact, EOPT consumer, and `attested => readbackHash` remain exact | type + artifact | `pnpm build && pnpm typecheck && pnpm exec vitest run packages/concierge/test/artifact.test.ts packages/concierge/test/export-surface.test.ts` | ✅ extend existing | ⬜ pending |
| 08-02-01 | 02 | 1 | CON-07 | T-08-05, T-08-10 | RFC 8785 strings/numbers/order and hand UTF-8 encode exactly | unit | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/readback-canonicalization.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 1 | CON-07 | T-08-04, T-08-05 | Non-JSON/alias/accessor/exotic inputs reject; sink receipt is recomputed and exact retained bytes are compared | unit + security | same exact canonicalization suite | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 2 | CAT-04, TRN-03, TRN-05 | T-08-01, T-08-04 | One structured issue per grade/provenance offender; absent profile is weakest; aggregation preserved | unit + type | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/catalog.test.ts && pnpm --filter @fullselfbrowsing/concierge typecheck` | ✅ extend existing | ⬜ pending |
| 08-03-02 | 03 | 2 | CON-07 | T-08-04, T-08-05 | Attested declarations require presentation and digest seams during construction | unit | catalog + consent exact suites | ✅ extend existing | ⬜ pending |
| 08-04-01 | 04 | 3 | CON-01, CON-02, CON-03, CON-06 | T-08-01, T-08-02, T-08-07 | No review/same boundary fail; only owned completed delivery arms; interrupt remains closed | integration + security | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/consent-kernel.test.ts` | ❌ W0 | ⬜ pending |
| 08-04-02 | 04 | 3 | CON-04, CON-05, CON-08 | T-08-03, T-08-07 | Late snapshot comparison, exact stored payload identity, atomic one-shot consume, ambiguous post-entry destruction | integration + security | same exact consent suite | ❌ W0 | ⬜ pending |
| 08-05-01 | 05 | 4 | CON-07, CON-09 | T-08-04, T-08-05, T-08-06 | Achieved grades follow occurrence evidence; only matching confirmed attestation yields attested; refusal/dismissal remain distinct | integration + security | consent + canonicalization exact suites | ❌ W0 | ⬜ pending |
| 08-05-02 | 05 | 4 | CON-01..CON-09 | T-08-01..T-08-07 | State/evidence mutations compile, run named detectors, and are killed non-vacuously | mutation | `node scripts/phase-08-mutation-battery.mjs verify all` | ❌ W0 | ⬜ pending |
| 08-06-01 | 06 | 4 | CON-07, TRN-03, TRN-05 | T-08-01, T-08-04 | Actual Session transport dominates declaration before subscription/publication/batch effects | integration + security | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-consent.test.ts` | ❌ W0 | ⬜ pending |
| 08-06-02 | 06 | 4 | CON-10 | T-08-08, T-08-10 | Stable frozen app rows complete before any agent result; presentation failure emits fixed diagnostic, releases no affected failure, and never retries | integration + concurrency | same exact session-consent suite | ❌ W0 | ⬜ pending |
| 08-07-01 | 07 | 5 | TRN-02 | T-08-02, T-08-06, T-08-08 | Exact Phase 7 stub gains delivery/attestation/outcome controls and shared ordering history without network or production export | fixture + type + runtime | `pnpm typecheck && pnpm exec vitest run packages/concierge/test/stub-transport.test.ts` | ✅ extend existing | ⬜ pending |
| 08-07-02 | 07 | 5 | CON-01..CON-10, CAT-04, TRN-02, TRN-03 | T-08-01..T-08-10 | Full fixture-driven kernel, including review -> interrupted delivery -> genuine new turn -> closed confirm | end-to-end | build + consent + session + stub exact suites | ❌ W0 integration cases | ⬜ pending |
| 08-08-01 | 08 | 6 | SEC-04 | T-08-09 | README calls ack a client assertion and demonstrates server-issued/stored challenge, independent checks, single use, effect, and burn | documentation + security | `pnpm exec vitest run packages/concierge/test/readme-security.test.ts` | ❌ W0 | ⬜ pending |
| 08-08-02 | 08 | 6 | all Phase 8 + TRN-02 | T-08-01..T-08-10 | Release, tarball, foreign consumer, mutation, threat, decision, and requirement ledgers all close on final tree | release + security | mutation battery + full release gate | ✅ gates; battery/ledgers W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Sampling continuity holds: every proposed task has an automated command, and no three consecutive tasks rely on documentation or manual evidence.

---

## Requirement → Evidence Boundary

- CON-01/02: no-review, missing identity, same-turn/response, agent-forgeable, and genuinely-new-human-turn controls.
- CON-03/06: delivery callback registration is insufficient; completed owned report arms, interruption never does. The flagship new-turn-after-interruption case is mandatory.
- CON-04/05/08: detached snapshot drift, comparator throw, fresh review, handler entry/failure, second confirm, and exact ack payload identity.
- CON-07/CAT-04/TRN-03/TRN-05: build profile, actual transport dominance, occurrence-achieved grade, and provenance enforcement at type/build/session/runtime layers.
- CON-09: confirmed/declined/dismissed are distinct observations; only confirmed can arm and declined/cancelled remain exact results.
- CON-10: one batch-level app outcome completes before response attempt one; failure/interruption releases no affected failure and triggers no retry.
- TRN-02: may become Complete only after the exact Phase 7 fixture drives the full kernel and remains test-only/tarball-absent.
- SEC-04: documentation must say client assertions are not server proof and show the complete server-side re-verification lifecycle.

---

## Wave 0 Requirements

- [ ] `packages/concierge/test/readback-canonicalization.test.ts` — official JCS vectors, UTF-8 boundaries, hostile JSON domain, receipt/digest/byte checks.
- [ ] `packages/concierge/test/consent-kernel.test.ts` — CON-01..09 state machine, exact payload, dedupe, grade, attestation, refusal/dismissal, flagship interrupt case.
- [ ] `packages/concierge/test/session-consent.test.ts` — capability dominance and CON-10 ordering/failure semantics.
- [ ] `packages/concierge/test/readme-security.test.ts` — SEC-04 worked-example contract.
- [ ] Existing `test-d/consent.test-d.ts`, `test-d/transport.test-d.ts`, `test-d/session.test-d.ts`, and export pins extended for new public shapes.
- [ ] Existing `test/catalog.test.ts`, `test/stub-transport.test.ts`, and `test/fixtures/stub-transport.ts` extended rather than duplicated.
- [ ] `scripts/phase-08-mutation-battery.mjs` plus revision-bound register/evidence and non-vacuous detector checks.

No new test framework or runtime dependency is required. `pnpm-lock.yaml` should remain byte-identical unless an independently justified tool change is approved.

---

## Minimum Mutation Obligations

The battery must independently kill at least these defects:

- arm at review return; arm on interrupted report; omit generation/response ownership; accept late or duplicate callback;
- allow same boundary; accept forgeable user-turn provenance; copy declared grade instead of deriving evidence;
- skip fresh-review invalidation; compare early/live snapshots; ignore comparator throw/mismatch; recompute payload; consume after handler; rearm after declined/dismissed;
- trust receipt hash without recomputing; omit exact canonical bytes comparison; accept one mismatched hash location; accept non-confirmed attestation; accept lone surrogate/non-JSON/alias/accessor input;
- remove catalog grade/provenance issue; weaken actual transport dominance; perform validation after subscription/publication;
- call `respond` before outcome presentation; pass model text; retry outcome/response; release failed result after sink interruption; echo caught values;
- export or pack the stub; remove the SEC-04 server-verification warning.

Every mutation must have a unique or precisely scoped literal, compile successfully, execute its named detector, and fail for the intended behavioral assertion. Build failure alone is not evidence.

---

## Manual-Only Verifications

No behavioral requirement is manual-only. The final security audit must still read the SEC-04 example for semantic honesty, but an automated README contract guards its required elements.

---

## Validation Sign-Off

- [x] All proposed tasks have an automated verification or Wave 0 dependency.
- [x] Sampling continuity: no three consecutive tasks without automated verify.
- [x] Wave 0 names every currently missing test/battery artifact.
- [x] No watch-mode flags.
- [x] Focused feedback target is below 5 seconds; measured full baseline is 3.71 seconds.
- [x] `nyquist_compliant: true` set in frontmatter.
- [ ] Wave 0 files exist and are observed green.
- [ ] All mutation targets compile, run their detector, and are killed.
- [ ] Release and security gates are observed green on the final tree.

**Approval:** strategy approved 2026-08-10; execution sign-off pending observed evidence

