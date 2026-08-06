---
phase: 6
slug: dispatcher
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-05
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from
> `06-RESEARCH.md` § Validation Architecture. Results below are recorded from executable evidence.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (runtime) + TypeScript 7.0.2 (`test-d`) |
| **Config file** | `vitest.config.ts`; `packages/concierge/tsconfig.test-d.json` |
| **Quick run command** | `pnpm build && pnpm exec vitest run packages/concierge/test/dispatcher.test.ts packages/concierge/test/dispatcher-batch.test.ts && pnpm --filter @fullselfbrowsing/concierge typecheck` |
| **Full suite command** | `pnpm build && pnpm typecheck && pnpm test` |
| **Phase gate** | `pnpm build && pnpm typecheck && pnpm test && pnpm check:artifact && pnpm check:deps && pnpm check:pack && pnpm check:node-floor` |
| **Estimated runtime** | <10 seconds for quick feedback; <30 seconds for the phase gate |

Runtime tests import `packages/concierge/dist/index.js`; `pnpm build` must run before Vitest.
Use `pnpm exec vitest run <file>` for filtering—`pnpm test -- <name>` does not filter this suite.

---

## Sampling Rate

- **After every task commit:** build, run the affected dispatcher test file, and run the package typecheck.
- **After every plan wave:** `pnpm build && pnpm typecheck && pnpm test`.
- **Before `$gsd-verify-work`:** the full phase gate and all registered Phase 6 mutation detectors must be green.
- **Max feedback latency:** 30 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-06-T1 | 06-06 | 5 | DSP-01 | T-06-Replay | Same `callId` returns the same Promise object and invokes once, including failures | runtime + mutation | `node scripts/phase-06-mutation-battery.mjs verify single` | ✅ | ✅ green |
| 06-06-T1 | 06-06 | 5 | DSP-02 | T-06-Replay | Fallback keys dedupe; cyclic and BigInt inputs execute without dedupe or throw | runtime + mutation | `node scripts/phase-06-mutation-battery.mjs verify single` | ✅ | ✅ green |
| 06-06-T1 | 06-06 | 5 | DSP-03 | T-06-Info | Sync throws and rejections become a generic message with no exception text | security runtime + mutation | `node scripts/phase-06-mutation-battery.mjs verify single` | ✅ | ✅ green |
| 06-06-T1 | 06-06 | 5 | DSP-04 | T-06-DoS | Missing/non-callable handlers settle honestly | runtime | dispatcher quick run | ✅ | ✅ green |
| 06-06-T1 | 06-06 | 5 | DSP-05 | T-06-Input | Sync/async validation runs before the handler and passes transformed output | runtime + mutation | `node scripts/phase-06-mutation-battery.mjs verify single` | ✅ | ✅ green |
| 06-06-T2 | 06-06 | 5 | DSP-06 | T-06-Input | Malformed raw arguments become `{}`, are rejected by validation, and do not stop later calls | integration + mutation | `node scripts/phase-06-mutation-battery.mjs verify all` | ✅ | ✅ green |
| 06-06-T2 | 06-06 | 5 | DSP-07 | T-06-Ordering | Batches are stable by `outputIndex`, serial, and settle every call after abort | integration + mutation | `node scripts/phase-06-mutation-battery.mjs verify all` | ✅ | ✅ green |
| 06-06-T1 | 06-06 | 5 | DSP-08 | T-06-Race | Effects wait for the commit window; abort cancels before invocation | runtime + mutation | `node scripts/phase-06-mutation-battery.mjs verify single` | ✅ | ✅ green |
| 06-06-T1 | 06-06 | 5 | DSP-09 | T-06-Output | Malformed handler values/getters/proxies normalize to `invalid_result` | security runtime + mutation | `node scripts/phase-06-mutation-battery.mjs verify single` | ✅ | ✅ green |
| 06-06-T3 | 06-06 | 5 | SEC-02 | T-06-Info | No thrown message reaches results, console, or a new telemetry seam | AST source audit + security runtime | `node scripts/check-no-telemetry.mjs` | ✅ | ⬜ pending |
| 06-06-T1 | 06-06 | 5 | SEC-06 | T-06-Injection | Every outbound message strips controls, collapses whitespace, caps length, and preserves surrogate pairs | security runtime + mutation | `node scripts/phase-06-mutation-battery.mjs verify single` | ✅ | ✅ green |
| 06-06-T2 | 06-06 | 5 | TRN-04 | T-06-Coupling | Single and batch dispatch run without constructing a transport | integration + mutation | `node scripts/phase-06-mutation-battery.mjs verify all` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `packages/concierge/test/dispatcher.test.ts` — Promise identity, dedupe, validation, stage scope, timing, normalization, sanitization, and bridge hand-forward.
- [x] `packages/concierge/test/dispatcher-batch.test.ts` — raw argument parsing, stable ordering, seriality, metadata forwarding, and abort completeness.
- [x] `packages/concierge/test-d/dispatcher.test-d.ts` — settled context-aware single-call API, batch API/result envelope, and exact scheduler signature.
- [x] Delete the obsolete dispatcher-stub assertion S27 from `packages/concierge/test/concierge.test.ts` when the stub is replaced.
- [x] Register concrete Phase 6 mutations in `scripts/mutate-and-prove.sh` invocations; every PASS must show a compiled mutant and the intended red test.

### Mutation Evidence

| Register | Digest | Executed | Result |
|----------|--------|----------|--------|
| M-06-S01…M-06-S34 | `01013d0fafab25c58a2a030f606ac4633a78c5b65b02393c69a42a2d54b2d1ba` | 34/34 | ✅ compiled, named detector fired, restored gates green, scoped tree clean |
| M-06-B01…M-06-B20 | same immutable 54-row register | 20/20 | ✅ compiled, named detector fired, restored gates green, scoped tree clean |

---

## Manual-Only Verifications

All post-decision Phase 6 behaviors have automated verification. Before implementation, planning
must explicitly settle the context-aware dispatch signature, transport-independent batch signature,
and dedupe timestamp/default-window overlap; these must not be implemented through hidden mutable context.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verification or Wave 0 dependencies.
- [ ] Sampling continuity: no three consecutive tasks without automated verification.
- [ ] Wave 0 covers every missing test reference above.
- [ ] No watch-mode flags.
- [ ] Feedback latency remains below 30 seconds.
- [ ] Each security threat in PLAN.md has a discriminating source or runtime detector.
- [ ] `nyquist_compliant: true` and `wave_0_complete: true` are set after measured evidence exists.

**Approval:** pending
