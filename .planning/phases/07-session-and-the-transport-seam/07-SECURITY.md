---
phase: 07-session-and-the-transport-seam
phase_number: 7
phase_name: Session and the Transport Seam
audited_at: 2026-08-09T03:13:53Z
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

**Resolved:** 7/7 declared threats (6 mitigated, 1 documented accepted risk)  
**Open high-severity threats:** 0  
**ASVS level:** 1

This audit deduplicates the threat registers in Plans 07-01 through 07-06 into the seven unique IDs below. A threat is closed only where the declared control is present at the relevant runtime/package entry points and has executable negative evidence. Planning prose and the prior review's intent were not treated as implementation evidence.

## Threat Verification

| Threat ID | Severity | Category | Disposition | Result | Implementation and executable evidence |
|-----------|----------|----------|-------------|--------|----------------------------------------|
| T-07-01 | high | Elevation of privilege / Tampering | mitigate | **CLOSED** | `session.ts:475-546` blocks the sole FIFO pump during publication/transition/admission and captures context plus epoch before cancellation normalization; `session.ts:577-612` applies generation checks and invalidates generation/publication authority before any stop callback; `session.ts:705-820` rechecks freshness after every reentrant catalog, stage, capability, `dynamicCatalog`, and `setTools` accessor/invocation boundary while keeping publishing, published, and confirmed authority separate. The accessor-stop and superseding-resolver regressions are explicit at `session-catalog.test.ts:674`, `:733`, `:786`, and `:842`; C10-C16 begin at `:914`, `:972`, `:1055`, `:1187`, `:1225`, `:1263`, and `:1349`. Current catalog/epoch mutation rows M-07-C01..C09 and routing cancellation rows validate green in the 30/30 verifier. |
| T-07-02 | high | Tampering / Repudiation | mitigate | **CLOSED** | `stub-transport.ts:150-166` records each catalog/response attempt before an occurrence failure, and `:188-196` returns frozen snapshots. `session.ts:433-505` contains one `dispatchBatch` call per record, one FIFO pump, one `Reflect.apply(respond, ...)` per active returned row, and no retry branch; `session.ts:647-665` waits for the active pump and drains each detached record once with responses disabled. J01-J05 start at `session-routing.test.ts:253`, `:326`, `:378`, `:417`, and `:469`; stop/admission FIFO coverage starts at `session-lifecycle.test.ts:389`, `:439`, `:552`, `:651`, and `:706`. U05/U07 assert attempt-before-throw and immutable histories at `stub-transport.test.ts:211` and `:325`. |
| T-07-03 | high | Spoofing / Repudiation | mitigate | **CLOSED** | The public envelope/capability/lifecycle vocabulary is explicit and readonly at `types.ts:1221-1254`, `:1303-1367`, and `:1814-1889`. `session.ts:395-430` constructs a frozen null-prototype facade with lazy getters that return the original `responseId`, `userTurnId`, `calls`, and delivery hook and replaces only `signal`. The downstream guarded snapshot and exact metadata join are at `dispatch.ts:805-853` and `:1040-1052`. J12/J13 at `session-routing.test.ts:904` and `:1065` verify descriptor shape and a real handler join; generated J15-J18 at `:1289` verify throwing-getter parity and prove Session performs no eager evidence read. Source and foreign-consumer type probes pin the six-key Transport, four-key Session config, closed diagnostics, and delivery-hook signature. |
| T-07-04 | high | Tampering / Denial of service | mitigate | **CLOSED** | `session.ts:183-345` uses idempotent cancellation, snapshots listeners, guards every hostile signal operation independently, closes the registration race, and disposes at most once. `session.ts:551-574` snapshots/tokenizes stage notifications and queues nested changes. `session.ts:590-672` caches the stop promise and marks stopped, invalidates transitions/publication, detaches work, aborts epochs, then attempts each cleanup independently before draining. `session.ts:822-878` serializes status/context transitions and makes public post-stop mutation entry points inert. L01-L13 begin at `session-lifecycle.test.ts:258` through `:1320`; L17/L18 at `:767` and `:806` specifically prove a row getter or `respond` getter that stops the session cannot begin a response. C13/C14 and J09-J14 exercise publication, cancellation, finalizer, and hostile-callback reentrancy. |
| T-07-05 | high | Information disclosure / Denial of service | mitigate | **CLOSED** | The only Session diagnostic strings are the fixed table at `session.ts:42-61`; `session.ts:159-180` creates a fresh frozen exact `{code,message}` object and contains both replacement and default sinks. Every catch in `session.ts` is no-binding; caught values, batch identifiers, results, and hostile getter values have no interpolation path. The fixture likewise throws only six fixed authored constants (`stub-transport.ts:70-81`, `:113-165`). L14 at `session-lifecycle.test.ts:1377` drives all nine codes with a private sentinel and asserts exact keys, fixed messages, freshness, freezing, and no secret; L15/L16 at `:1554` and `:1603` contain throwing hooks and missing/throwing consoles. J04/J05/J14-J18 cover response, dispatch, signal, and envelope failures without retry or detail leakage. |
| T-07-06 | high | Tampering | mitigate | **CLOSED** | `createSession` calls the shared-instance guard as its first statement (`session.ts:103-115`); the versioned global registry rejects incompatible copies at `contract.ts:190-210`; the public barrel exports the guard and factory at `index.ts:144-154`. The package allow-list excludes tests (`packages/concierge/package.json:36-40`), the pack harness inspects the real archive and rejects stub/fixture entries (`scripts/pack-install-check.sh:56-64`), and U08 verifies no production/barrel/config reachability (`stub-transport.test.ts:366`). The mutation/release harness rejects untracked scoped inputs, hashes every tracked source/test/type/script plus required package/config/document input, copies them read-only to one snapshot, installs offline with a frozen lockfile, and brackets every release gate with digest checks (`phase-07-mutation-battery.mjs:88-120`, `:1720-1860`, `:2458-2557`). F7, P01, and P02 cover the direct guard and package exclusion. Independent verification found all 30 rows executed, compiled, killed, restored byte-identically, restored-green, and clean; the recomputed 68-path release digest equals the recorded `84e46d0af193fc5be9553c517eabd49fac9f9c29c6a7dc3138414bd58e2992be`. |
| T-07-SC | low | Tampering | accept | **ACCEPTED** | See the accepted-risks log below. The acceptance is bounded by the three protected SHA-256 inputs in `07-MUTATION-EVIDENCE.json:37-40`; the live input verifier reread all three and passed. This disposition does not waive any high-severity runtime or package control. |

## Accepted Risks Log

### T-07-SC — package supply-chain exposure

- **Decision:** Accept for Phase 7.
- **Scope:** The phase adds no vendor adapter or new runtime integration and requires no Phase 7 package installation. A future dependency or adapter change is outside this acceptance.
- **Evidence boundary:** `package.json`, `packages/concierge/package.json`, and `pnpm-lock.yaml` are protected by exact SHA-256 rows in `07-MUTATION-EVIDENCE.json:37-40`. `node scripts/phase-07-mutation-battery.mjs verify inputs` passed against the current bytes. The snapshot release evidence also records `check:deps`, `check:pack`, and every other release command at exit 0 (`07-MUTATION-EVIDENCE.json:42-62`).
- **Residual risk:** A future dependency update, registry compromise, or vendor transport that overstates self-declared capabilities requires a new threat decision; it is not transferred or silently treated as mitigated here.

## Review-Fix Verification

The prior review remained an issue report, so each reported edge was checked directly after reading `07-REVIEW-FIX.md`:

- **CR-01:** both catalog-change and reconnect `setTools` accessors are captured inside `try`, followed by current-attempt checks before invocation (`session.ts:760-771`, `:801-811`). The two stop-from-accessor regressions pass.
- **CR-02:** catalog, stage, capabilities, and `dynamicCatalog` reads each have an immediate `isCurrent` checkpoint (`session.ts:705-738`). Both superseding-transition regressions pass.
- **CR-03:** release inputs are enumerated, untracked scoped files are rejected, the snapshot is read-only, and every gate is bracketed by snapshot digest checks (`phase-07-mutation-battery.mjs:1749-1860`, `:2458-2528`). An independent recomputation matched the recorded digest across 68 paths.
- **WR-01:** M-07-L03 now selects L17/L18, and the production branch rechecks lifecycle only after all hostile `respond`/row property reads (`session.ts:438-444`; tests at `session-lifecycle.test.ts:767` and `:806`). The mutation verifier reports the row green with the exact two detectors.

## Threat Flags and New Attack Surface

No summary contains an unmapped `## Threat Flags` item. The executor's threat-evidence entries map only to T-07-01 through T-07-06, and the Phase 07-04 summary explicitly records no new endpoint, authentication path, file-access boundary, schema, or other surface beyond the registered Session transport seam. **Unregistered flags: none.**

## Independent Audit Trail

| Check | Result |
|-------|--------|
| `node scripts/phase-07-mutation-battery.mjs verify inputs` | PASS — 3 protected inputs byte-identical |
| `node scripts/phase-07-mutation-battery.mjs verify all` | PASS — 30/30 current-revision mutation rows green |
| `node scripts/phase-07-mutation-battery.mjs self-test` | PASS — negative controls, including release-snapshot and response-cutoff sensitivity, rejected |
| Focused Vitest: catalog, routing, lifecycle, stub, single-instance | PASS — 5 files, 74 tests |
| Direct release digest recomputation | PASS — 68 tracked/required paths; computed digest equals recorded digest |
| Recorded immutable release run | PASS — 7/7 release commands exit 0; 16 files, 321/321 tests, 0 failed/pending/todo (`07-MUTATION-EVIDENCE.json:42-62`) |

## Residual Risk

JavaScript cannot forcibly terminate a handler that has already entered and ignores cancellation, and core cannot prove that a future consumer transport reports truthful capabilities. The implementation aborts the composed signal, waits for entered work during stop, suppresses all post-stop responses, and treats capability declarations as immutable. These are declared design limits, not unverified Phase 7 mitigations.

**Final disposition:** SECURED. No declared high-severity threat is open, and `block_on: high` is not triggered.
