---
phase: 6
slug: dispatcher
status: complete
nyquist_compliant: true
wave_0_complete: true
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
| 06-06-T3 | 06-06 | 5 | SEC-02 | T-06-Info | No thrown message reaches results, console, or a new telemetry seam | AST source audit + security runtime | `node scripts/check-no-telemetry.mjs` | ✅ | ✅ green |
| 06-06-T1 | 06-06 | 5 | SEC-06 | T-06-Injection | Every outbound message strips controls, collapses whitespace, caps length, and preserves surrogate pairs | security runtime + mutation | `node scripts/phase-06-mutation-battery.mjs verify single` | ✅ | ✅ green |
| 06-06-T2 | 06-06 | 5 | TRN-04 | T-06-Coupling | Single and batch dispatch run without constructing a transport | integration + mutation | `node scripts/phase-06-mutation-battery.mjs verify all` | ✅ | ✅ green |
| 06-07-T1 | 06-07 | 6 | DSP-01, DSP-07 | T-06-G01 | R68 + Q17 prove malformed-metadata totality and correlation | security runtime | dispatcher quick run | ✅ | ✅ green |
| 06-07-T2 | 06-07 | 6 | DSP-02 | T-06-G02 | R06 + R69 prove BigInt and aliased-graph no-dedup without a synchronous throw | security runtime | dispatcher quick run | ✅ | ✅ green |
| 06-07-T3 | 06-07 | 6 | DSP-06 | T-06-G03 | Q04 proves empty-object validation before later calls continue | integration | dispatcher quick run | ✅ | ✅ green |
| 06-08-T1 | 06-08 | 7 | DSP-01, DSP-02, DSP-06, DSP-07 | T-06-G05 | 62-row register with bounded range self-tests and ledger self-tests | mutation infrastructure | `node scripts/phase-06-mutation-battery.mjs self-test` | ✅ | ✅ green |
| 06-08-T2 | 06-08 | 7 | DSP-01, DSP-02, DSP-06, DSP-07 | T-06-G05 | 62/62 compiled mutants killed by exact detectors and verify all | mutation | `node scripts/phase-06-mutation-battery.mjs verify all` | ✅ | ✅ green |
| 06-08-T3 | 06-08 | 7 | DSP-01, DSP-02, DSP-06, DSP-07, SEC-02 | T-06-G06, T-06-G07, T-06-G08 | Final release gates plus verify ledgers against live totals | release + ledger audit | `node scripts/phase-06-mutation-battery.mjs verify ledgers` | ✅ | ✅ green |

*Measured status: every row is green.*

---

## Wave 0 Requirements

- [x] `packages/concierge/test/dispatcher.test.ts` — Promise identity, dedupe, validation, stage scope, timing, normalization, sanitization, and bridge hand-forward.
- [x] `packages/concierge/test/dispatcher-batch.test.ts` — raw argument parsing, stable ordering, seriality, metadata forwarding, and abort completeness.
- [x] `packages/concierge/test-d/dispatcher.test-d.ts` — settled context-aware single-call API, batch API/result envelope, and exact scheduler signature.
- [x] Delete the obsolete dispatcher-stub assertion S27 from `packages/concierge/test/concierge.test.ts` when the stub is replaced.
- [x] Register concrete Phase 6 mutations in `scripts/mutate-and-prove.sh` invocations; every PASS must show a compiled mutant and the intended red test.

### Mutation Evidence

| Register | Digest | Counts | Result |
|----------|--------|--------|--------|
| Current immutable register | `ce136d9ef7cdefd7429b4ea8484e738e14e34cbc8bb7525476aa38d58e80be52` | 38/38 single; 24/24 batch; 62/62 total; 0 pending | ✅ compiled, exact named detector fired, restored gates green, scoped tree clean |

### Gap-Closure Detector Evidence

| Detector | Marker | Contract |
|----------|--------|----------|
| R68 | `[RED:R68:malformed-metadata-totality]` | Malformed metadata is total and returns one honest result without handler entry. |
| R06b | `[RED:R06b:prototype-safe-fallback-keys]` | Inherited `toJSON` hooks cannot collapse distinct fallback keys. |
| R69 | `[RED:R69:aliased-graph-no-dedup]` | Equal aliased graphs run independently without a synchronous throw or accidental deduplication. |
| Q17 | `[RED:Q17:malformed-callid-correlation]` | Malformed callId retains one frozen correlated row instead of rejecting the batch. |
| Q16 | `[RED:Q16:immutable-nested-result]` | Immutable nested result identity is preserved across cached retries. |
| Q18 | `[RED:Q18:malformed-sort-totality]` | Non-finite and non-number sort metadata is contained while valid calls still run. |
| Q19 | `[RED:Q19:throwing-batch-metadata-totality]` | Throwing batch and call metadata getters remain row-local and cannot reject the batch. |
| R71 | `[RED:R71:malformed-sync-scheduler-return]` | A synchronous callback cannot hide a scheduler that returns no callable canceller. |
| R72 | `[RED:R72:throwing-sync-scheduler-registration]` | A synchronous callback cannot hide a scheduler that throws during registration. |

---

## Manual-Only Verifications

None. Every locked Phase 6 behavior has automated runtime, type, source-structure, mutation,
or package-gate evidence.

---

## Phase Gate Evidence

Measured on 2026-08-07 with the exact chained phase command. Every command exited 0.

| Gate | Headline evidence | Result |
|------|-------------------|--------|
| Immutable mutation register | Digest `ce136d9ef7cdefd7429b4ea8484e738e14e34cbc8bb7525476aa38d58e80be52`; 62/62 compiled mutants killed; 63 named tests ran; 62 restored gates and scoped-tree checks green | ✅ |
| No-telemetry AST audit | TypeScript `createSourceFile` parsed 11/11 production files; required result-path files present; 0 executable channel, emission, or caught-value findings. Positive controls adding a `telemetry` identifier and a catch binding each fired, then restored clean | ✅ |
| `pnpm build` | 4 artifacts, 693.41 kB total; Build complete; embedded ATTW and publint checks clean | ✅ |
| `pnpm typecheck` | `tsc -p tsconfig.test-d.json`; exit 0 | ✅ |
| `pnpm test` | 12 test files passed; 252/252 tests passed; 0 pending; 0 todo | ✅ |
| `pnpm check:artifact` | publint strict: All good; ATTW ESM and JSON profiles green | ✅ |
| `pnpm check:deps` | 1 built chunk / 1 module; no vendored modules or external runtime imports; dependency ESM entries contribute 0 bytes | ✅ |
| `pnpm check:pack` | Foreign scratch install, declaration typecheck with TypeScript 7.0.2, and runtime import passed | ✅ |
| `pnpm check:node-floor` | Packed artifact installed and imported on pinned Node v22.12.0 | ✅ |
| Test isolation audit | 0 Vitest/Jest mocking API findings in either dispatcher suite | ✅ |
| Mutation restoration audit | All `packages/concierge` source, tests, fixtures, mutation scripts, workspace manifests, and lockfile clean after all probes | ✅ |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verification or completed Wave 0 dependencies.
- [x] Sampling continuity: no three consecutive tasks without automated verification.
- [x] Wave 0 covers every test reference above.
- [x] No watch-mode flags.
- [x] Feedback latency remained below 30 seconds for quick feedback.
- [x] Each security threat in PLAN.md has a discriminating source or runtime detector.
- [x] `nyquist_compliant: true` and `wave_0_complete: true` were set only after measured evidence existed.

**Approval:** complete — mutation, AST, runtime, type, artifact, dependency, pack-install, and Node-floor gates are green.
