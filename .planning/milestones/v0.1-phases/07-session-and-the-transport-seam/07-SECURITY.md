---
phase: 07-session-and-the-transport-seam
phase_number: 7
phase_name: Session and the Transport Seam
revision: 48248fcb77bb8032add234cbccb951aa968c94b4
audited_at: 2026-08-10T05:24:00Z
status: secured
asvs_level: 1
block_on: high
threats_total: 7
threats_closed: 6
threats_accepted: 1
threats_open: 0
unregistered_flags: 0
---

# Phase 7 Security Audit

## SECURED

**Phase:** 7 — Session and the Transport Seam

**Threats resolved:** 7/7 (6 mitigated, 1 documented accepted risk)

**Open:** 0

**ASVS level:** 1

Formal verification may proceed. This final-revision audit independently rechecked every declared Phase 7 threat against the live implementation through commit `48248fc`; no earlier CLOSED disposition was carried forward without fresh code and executable evidence.

## Scope and Method

The threat registers in Plans 07-01 through 07-07 deduplicate to six high-severity `mitigate` threats (`T-07-01` through `T-07-06`) and one low-severity `accept` threat (`T-07-SC`). There are no `transfer` dispositions. All seven plans and summaries, the current review/fix/validation/mutation artifacts, the prior verification, the live Session/types/fixture/package implementation, and the relevant test and mutation harness paths were read before disposition.

Mitigations were treated as absent until the declared control was found at every relevant entry point and its negative detector was checked. Documentation and intent were not accepted as implementation evidence. This is a disposition audit of the registered threats, not a blind vulnerability scan.

## Threat Verification

| Threat ID | Severity | Category | Disposition | Result | Implementation and executable evidence |
|-----------|----------|----------|-------------|--------|----------------------------------------|
| T-07-01 | high | Elevation of privilege / Tampering | mitigate | **CLOSED** | `createSession` keeps requested, active-requested, confirmed, publishing, and published authority separate (`packages/concierge/src/session.ts:138-163`). Exact context identity plus generation govern currentness (`:791-810`), pending publication is cleared only for the matching epoch/token (`:400-435`), and losing accessor-time attempts abort their own epoch and clear their own token (`:943-953`). Admission distinguishes confirmed replay, callable-captured/unpublished publication, queued requested transition, active requested generation, and confirmed fallback (`:665-755`). Context and connected publication recheck authority around every hostile boundary (`:955-1113`); the drain preserves active requested authority after queue shift and reconciles a failed current request back to confirmed authority without decrementing generation (`:1116-1163`). C17-C22 (`session-catalog.test.ts:1523`, `:1680`, `:1919`, `:2122`, `:2674`, `:3616`) exercise unpublished, queued, active, confirmed-replay, same-object generation, stop, and failure-reconciled authority. Independent M-07-C10 through M-07-C16 remove those exact controls (`07-MUTATION-REGISTER.json:337-484`) and are all killed on the current revision. |
| T-07-02 | high | Tampering / Repudiation / Denial of service | mitigate | **CLOSED** | One pump installs its observable promise before running, blocks behind publication/transition/admission, shifts exactly one FIFO head, and awaits its complete work before the next (`session.ts:537-585`). An accepted occurrence is enqueued once before hostile signal connection (`:665-763`), dispatched once with its captured binding, and each returned row receives at most one response attempt while active; failures are contained without retry and finalization always runs (`:501-535`). J01-J06 (`session-routing.test.ts:253-565`) prove FIFO, repeat-occurrence identity, row order/cardinality, no retry, later progress, and pre-context rejection. C19-C22 prove queued replay and post-failure progress. M-07-C13/C14/C15/C16 have exact, distinct C19/C20/C21/C22 fingerprints and nonzero focused executions (`07-MUTATION-EVIDENCE.json:1576-1995`). |
| T-07-03 | high | Spoofing / Repudiation | mitigate | **CLOSED** | The public Transport remains the exact neutral six-member seam and its capability/status fields are readonly (`packages/concierge/src/types.ts:1303-1368`); Session remains the exact four-member handle and diagnostics/config remain closed (`:1814-1889`). Session records the original batch object without reading evidence fields, then exposes a frozen null-prototype facade whose lazy getters preserve `responseId`, `userTurnId`, `calls`, and `deferUntilDelivered` and replace only `signal` (`session.ts:437-472`, `:665-755`). J12/J13 prove descriptor shape and a real-handler metadata join (`session-routing.test.ts:904`, `:1065`); J14 and generated J15-J18 (`:1122`, `:1395-1398`) prove hostile signal/evidence getters fail with Phase 6 parity and no eager Session read. Typecheck and the exact public declaration/export tests are green. |
| T-07-04 | high | Tampering / Denial of service | mitigate | **CLOSED** | Cancellation is factory-local, idempotent, listener-snapshotted, race-closed, and independently guards every upstream property/method/listener operation (`session.ts:211-374`); epochs mark aborted before callbacks (`:376-398`). Stop caches one promise and marks stopped before outside code, invalidates generation/publication authority, detaches queued work in arrival order, aborts all epochs, attempts cleanup independently, then drains active and detached work exactly once with responses disabled (`:818-904`). Stage notifications use tokenized subscriptions, callback snapshots, serialized nested notifications, and lifecycle cutoffs (`:765-789`, `:1196-1202`). L01-L13 plus L17/L18 (`session-lifecycle.test.ts:258-1366`, `:767`, `:806`) prove stable stop identity, exact-once detach/drain, abort-ignoring handler wait, independent cleanup, inert stale callbacks, and response cutoff after hostile row/respond getters. C17, C20, C21, C22 and the accessor-time stop regressions at `session-catalog.test.ts:4580` cover the revised state machine. |
| T-07-05 | high | Information disclosure / Denial of service | mitigate | **CLOSED** | The only Session diagnostic text is the fixed nine-message table (`session.ts:33-61`). `diagnose` creates a fresh frozen exact `{code,message}` object and contains both replacement and default sinks (`:187-208`); its public type is a readonly two-key object over the closed nine-code union (`types.ts:1814-1830`). All operational catches are no-binding except `drainTransitions`' control-flow-only `catch (failure)`; that value is preserved solely for exact rethrow to the initiating synchronous application caller after queued transitions drain and is never formatted, logged, or passed to diagnostics (`session.ts:1140-1163`). Stale resolver/capability exceptions are suppressed by the `finally` currentness check (`:799-810`); stale transport accessor failures are abandoned without throw, while current transport publication failures expose only fixed public errors (`:1031-1049`, `:1080-1106`). L14-L16 (`session-lifecycle.test.ts:1377`, `:1554`, `:1603`) drive all nine diagnostics with a private sentinel and prove exact keys/messages, freshness, freezing, no secret, and sink continuation. C17-C22, J04/J05/J14-J18, and L06/L07 prove no stale/private thrown leak, no diagnostic detail leak, and later progress. |
| T-07-06 | high | Tampering | mitigate | **CLOSED** | `assertSingleInstance()` is the first `createSession` statement (`session.ts:125-132`); the versioned global guard rejects incompatible copies (`packages/concierge/src/contract.ts:190-210`) and both guard/factory are public (`packages/concierge/src/index.ts:144-154`). The package allow-list excludes tests (`packages/concierge/package.json:25-50`), the real tarball check rejects stub/fixture entries (`scripts/pack-install-check.sh:55-64`), and U08 proves the no-I/O stub is absent from production source/barrel/package reachability (`stub-transport.test.ts:366`). The mutation harness requires the exact 16/9/8/2/2 register, one live literal, tracked targets, exact detector fingerprints, no infrastructure errors, byte-identical restoration, current unique revision digests, and clean live endpoints (`phase-07-mutation-battery.mjs:1265-1315`, `:2370-2464`). Mutants run only inside disposable snapshots (`:2053-2277`); release inputs run from one read-only snapshot bracketed by digest checks (`:2033-2103`, `:2786-2876`). The current evidence is 37/37 green and its 68-input release digest binds all seven green gates and 331/331 tests. |
| T-07-SC | low | Tampering | accept | **ACCEPTED** | The required acceptance record is below. Its boundary is verified by the current SHA-256 values for `package.json`, `packages/concierge/package.json`, and `pnpm-lock.yaml` (`07-MUTATION-EVIDENCE.json:44-48`), a passing live input check, and passing dependency/tarball gates. |

## Final Authority and Lifecycle Re-Audit

The C17-C22 changes do not collapse distinct authority states:

| Boundary | Live control | Exact negative proof |
|----------|--------------|----------------------|
| Unpublished accessor attempt | Matching epoch/token cleanup plus stale-record abandonment before getter, after getter, and on getter throw (`session.ts:943-1057`) | M-07-C10 and M-07-C11 independently remove abort and clear; both fail only C17 on `[RED:C17:abandoned-publication-cleanup]`. |
| Resolver/capability boundary | `captureCurrent` checks exact context identity and generation in `finally` (`:791-810`) | M-07-C12 fails only C18 on `[RED:C18:stale-boundary-progress]`. |
| Current exception plus queued confirmed replay | The transition drain stores the first current failure, continues queued control work, then rethrows the exact value (`:1116-1163`) | M-07-C13 fails only C19 on `[RED:C19:current-exception-drain-progress]`. |
| Queued requested authority | Admission binds to the queued requested context/generation rather than confirmed fallback (`:714-729`) | M-07-C14 fails only C20 on `[RED:C20:post-request-admission-authority]`. |
| Active requested authority after queue shift | The drain installs `activeRequestedAuthority`; admission consumes that exact context/generation until confirm/failure (`:719-723`, `:1124-1147`) | M-07-C15 fails only C21 on `[RED:C21:active-request-generation-authority]`. |
| Failed request followed by confirmed replay | Exact failed requested identity is reconciled to confirmed context while generation remains monotonic (`:1148-1155`) | M-07-C16 fails only C22 on `[RED:C22:failed-request-authority-reconciliation]`. |

The seven mutant definitions are independent literal/replacement identities. Their revision digests are also seven distinct SHA-256 values. C20, C21, and C22 have three distinct markers and are respectively the sole detector for M-07-C14, M-07-C15, and M-07-C16. Every row compiled, ran one focused test, was killed, restored byte-identically, passed its restored build/catalog/type gates, matched clean live endpoints, and recorded no infrastructure error (`07-MUTATION-EVIDENCE.json:1261-1995`).

Confirmed replay snapshots confirmed catalog/context/epoch plus requested identity before reading or invoking `setTools` (`session.ts:1064-1113`). The C22 matrix covers a later distinct request, direct/signal stop, same-object later generation, sequential failures, multiple queued replay statuses, no work, and no-initial-context behavior. The connected-replay getter and accessor-time stop regressions at `session-catalog.test.ts:4409` and `:4580` additionally prove exact arrival binding, stale callable suppression, FIFO detach, stable stop promise, and zero post-stop response.

## Evidence Integrity

- Register digest: `58e8e7d6f15a61156d4f9cc8acad2a86af7840b860f4d2107c6fda261bbd004f`.
- Register/evidence shape: exactly 37 ordered rows, distributed 16 catalog / 9 routing / 8 lifecycle / 2 diagnostics / 2 package; 37 unique revision digests; all 37 green.
- Mutation isolation: the live target is measured first, a disposable snapshot is materialized, only the snapshot target is mutated, the snapshot is restored and re-gated, and live scoped endpoints must remain clean and digest-equal (`phase-07-mutation-battery.mjs:2165-2277`). The harness self-test's A→B→A control proves endpoint equality alone cannot masquerade as uninterrupted-history evidence (`:3101-3180`).
- Release binding: independently recomputing the digest over all 68 tracked release inputs produced `b6dd1789125cc1f5b1a5cfdd3f22ac4f057decadeccb8fa7d817ef70c681a1cb`, exactly matching `07-MUTATION-EVIDENCE.json:50`.
- Immutable release record: all seven command exits are zero and the recorded runtime is 16 files / 331 passed / 331 total / 0 failed / 0 pending / 0 todo (`07-MUTATION-EVIDENCE.json:49-70`).

## Accepted Risks Log

### T-07-SC — package supply-chain exposure

- **Decision:** Accepted for Phase 7 on 2026-08-10; no high-severity threat is accepted by this entry.
- **Scope:** Phase 7 adds no vendor adapter, new runtime integration, dependency, manifest edit, or lockfile edit. Existing dependency/toolchain risk remains outside the runtime seam mitigation claim.
- **Verified boundary:** `package.json`, `packages/concierge/package.json`, and `pnpm-lock.yaml` match the three recorded SHA-256 values. `check:deps` reports zero dependency bytes in the ESM artifact; `check:pack` installs the real tarball in a foreign project, typechecks the shipped declarations, imports `createSession`, and confirms the test stub is absent.
- **Residual risk:** Registry or toolchain compromise, a future dependency update, or a future vendor transport that overstates self-declared capabilities can invalidate this acceptance.
- **Review trigger:** Any change to a protected manifest/lockfile, dependency graph, vendor adapter, release toolchain, or transport capability trust model requires a new threat decision. This risk is accepted, not transferred or claimed as mitigated.

## Unregistered Flags

None. No Phase 7 summary contains an `## Threat Flags` section, and the summaries' threat-evidence notes map to the registered IDs above. No unmapped executor flag is being used to bypass `block_on: high`.

## Live Verification at `48248fc`

| Check | Result |
|-------|--------|
| `node scripts/phase-07-mutation-battery.mjs verify inputs` | PASS — 3 protected inputs byte-identical |
| `node scripts/phase-07-mutation-battery.mjs verify all` | PASS — 37/37 current-revision mutation rows green |
| `node scripts/phase-07-mutation-battery.mjs self-test` | PASS — all negative controls rejected, including snapshot isolation and fingerprint substitution |
| Neutral Transport scoped gate | PASS — live block contains no forbidden vendor lifecycle identifier and the synthetic `onReconnect` mutation is detected |
| `pnpm build` | PASS — build complete; ATTW and publint green |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 16 files, 331/331 tests |
| `pnpm check:artifact` | PASS — strict publint and ESM-only ATTW |
| `pnpm check:deps` | PASS — dependency contribution zero bytes |
| `pnpm check:pack` | PASS — foreign install/typecheck/runtime import; no stub or test fixture in tarball |
| `pnpm check:node-floor` | PASS — tarball installs/imports under Node v22.12.0 |
| Independent release digest recomputation | PASS — 68 inputs exactly match `b6dd1789125cc1f5b1a5cfdd3f22ac4f057decadeccb8fa7d817ef70c681a1cb` |

## Residual Design Limits

JavaScript cannot forcibly terminate a handler that has already entered and ignores cancellation. Session therefore aborts the composed signal, waits for entered work during stop, and suppresses every post-stop response. Core also cannot independently prove that a future transport truthfully declares its capabilities; those declarations are immutable but self-asserted. A current application resolver exception is intentionally rethrown unchanged to the initiating synchronous caller after queued control work drains; stale transport/application exceptions and all diagnostics remain contained and detail-free. These are explicit design boundaries, not missing Phase 7 mitigations.

**Current disposition:** SECURED. `threats_open: 0`; all six high-severity mitigations are present and verified, T-07-SC is documented as accepted within a bounded scope, and formal verification may proceed.
