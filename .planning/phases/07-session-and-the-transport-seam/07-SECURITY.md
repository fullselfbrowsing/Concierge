---
phase: 07-session-and-the-transport-seam
phase_number: 7
phase_name: Session and the Transport Seam
audited_at: 2026-08-09T05:06:43Z
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

**Resolved:** 7/7 declared threats (6 mitigated, 1 documented accepted risk; 0 open)
**Open high-severity threats:** 0
**ASVS level:** 1

This audit deduplicates the threat registers in Plans 07-01 through 07-06 into the seven unique IDs below. A threat is closed only where the declared control is present at the relevant runtime/package entry points and has executable negative evidence. Planning prose and the prior review's intent were not treated as implementation evidence.

This independent gap-closure audit re-evaluated only T-07-01 and T-07-02 against the repaired Plan 07-07 revision. Both mitigations are present in the live implementation and have exact executable negative evidence, so both threats are closed. The prior CLOSED dispositions for T-07-03 through T-07-06 and the bounded ACCEPTED disposition for T-07-SC are preserved.

## Threat Verification

| Threat ID | Severity | Category | Disposition | Result | Implementation and executable evidence |
|-----------|----------|----------|-------------|--------|----------------------------------------|
| T-07-01 | high | Elevation of privilege / Tampering | mitigate | **CLOSED** | `clearPublication` mutates pending publication state only when both the provisional epoch identity and attempt token match, while `publicationIsCurrent` rejects stopped or superseded tokens (`session.ts:372-392`). Stop invalidates the token before clearing queues/state and aborting epochs (`:590-612`). For context publication, `abandonSupersededPublication` first rejects a stale token, otherwise aborts only the unpublished losing epoch and clears only that matching attempt (`:705-715`); it runs before the getter, after a returned getter, and inside the getter-throw catch before any stale callable or failure path can run (`:757-795`). C17 exercises both accessor-return and accessor-throws-after-supersession branches for B→C where C reuses published catalog A; it proves B's callable is never invoked, the throw is inert, only A remains published, C is confirmed, and no dispatch/response occurs before the later batch (`session-catalog.test.ts:1441-1558`). M-07-C10 removes exactly the abort-and-clear pair (`phase-07-mutation-battery.mjs:391-409`); its current evidence has one literal occurrence, compiles, fails only C17 on `[RED:C17:abandoned-publication-cleanup]`, restores byte-identically, and returns the 22/22 catalog suite plus typecheck to green (`07-MUTATION-EVIDENCE.json:1255-1357`). |
| T-07-02 | high | Tampering / Repudiation / Denial of service | mitigate | **CLOSED** | Superseded B returns to the synchronous outer transition drain, which continues through queued C (`session.ts:830-844`), and C17 verifies both getter outcomes reach stage C with the exact C object. After emitting one `later-c` batch, each branch records exactly one dispatch under C and exactly one completed response carrying the returned row's `callId` and `result` identities (`session-catalog.test.ts:1529-1568`). The compiled M-07-C10 mutant removes B's abort/clear cleanup and recreates zero progress: exactly one selected test runs, only C17 fails, and the unique failure marker is observed with no infrastructure, suite, or unhandled error (`07-MUTATION-EVIDENCE.json:1255-1357`). The immutable 31/31 mutation register and 16-test-file, 323/323 release record are current at register digest `a55444ba593e9d4f80dfb3664267d015dbb5740a8c6fe1c2f08ccf0585945492` and release digest `4efea16561defaf73e924b5dd855df2619af2186c58c00f92eab5855751c3252`. |
| T-07-03 | high | Spoofing / Repudiation | mitigate | **CLOSED** | The public envelope/capability/lifecycle vocabulary is explicit and readonly at `types.ts:1221-1254`, `:1303-1367`, and `:1814-1889`. `session.ts:395-430` constructs a frozen null-prototype facade with lazy getters that return the original `responseId`, `userTurnId`, `calls`, and delivery hook and replaces only `signal`. The downstream guarded snapshot and exact metadata join are at `dispatch.ts:805-853` and `:1040-1052`. J12/J13 at `session-routing.test.ts:904` and `:1065` verify descriptor shape and a real handler join; generated J15-J18 at `:1289` verify throwing-getter parity and prove Session performs no eager evidence read. Source and foreign-consumer type probes pin the six-key Transport, four-key Session config, closed diagnostics, and delivery-hook signature. |
| T-07-04 | high | Tampering / Denial of service | mitigate | **CLOSED** | `session.ts:183-345` uses idempotent cancellation, snapshots listeners, guards every hostile signal operation independently, closes the registration race, and disposes at most once. `session.ts:551-574` snapshots/tokenizes stage notifications and queues nested changes. `session.ts:590-672` caches the stop promise and marks stopped, invalidates transitions/publication, detaches work, aborts epochs, then attempts each cleanup independently before draining. `session.ts:822-878` serializes status/context transitions and makes public post-stop mutation entry points inert. L01-L13 begin at `session-lifecycle.test.ts:258` through `:1320`; L17/L18 at `:767` and `:806` specifically prove a row getter or `respond` getter that stops the session cannot begin a response. C13/C14 and J09-J14 exercise publication, cancellation, finalizer, and hostile-callback reentrancy. |
| T-07-05 | high | Information disclosure / Denial of service | mitigate | **CLOSED** | The only Session diagnostic strings are the fixed table at `session.ts:42-61`; `session.ts:159-180` creates a fresh frozen exact `{code,message}` object and contains both replacement and default sinks. Every catch in `session.ts` is no-binding; caught values, batch identifiers, results, and hostile getter values have no interpolation path. The fixture likewise throws only six fixed authored constants (`stub-transport.ts:70-81`, `:113-165`). L14 at `session-lifecycle.test.ts:1377` drives all nine codes with a private sentinel and asserts exact keys, fixed messages, freshness, freezing, and no secret; L15/L16 at `:1554` and `:1603` contain throwing hooks and missing/throwing consoles. J04/J05/J14-J18 cover response, dispatch, signal, and envelope failures without retry or detail leakage. |
| T-07-06 | high | Tampering | mitigate | **CLOSED** | `createSession` calls the shared-instance guard as its first statement (`session.ts:103-115`); the versioned global registry rejects incompatible copies at `contract.ts:190-210`; the public barrel exports the guard and factory at `index.ts:144-154`. The package allow-list excludes tests (`packages/concierge/package.json:36-40`), the pack harness inspects the real archive and rejects stub/fixture entries (`scripts/pack-install-check.sh:56-64`), and U08 verifies no production/barrel/config reachability (`stub-transport.test.ts:366`). The mutation/release harness rejects untracked scoped inputs, hashes every tracked source/test/type/script plus required package/config/document input, copies them read-only to one snapshot, installs offline with a frozen lockfile, and brackets every release gate with digest checks (`phase-07-mutation-battery.mjs:88-120`, `:1720-1860`, `:2458-2557`). F7, P01, and P02 cover the direct guard and package exclusion. Current generated verification found all 31 rows executed, compiled, killed, restored byte-identically, restored-green, and clean; the immutable-snapshot release digest is `4efea16561defaf73e924b5dd855df2619af2186c58c00f92eab5855751c3252`. |
| T-07-SC | low | Tampering | accept | **ACCEPTED** | See the accepted-risks log below. The acceptance is bounded by the three protected SHA-256 inputs in `07-MUTATION-EVIDENCE.json:37-40`; the live input verifier reread all three and passed. This disposition does not waive any high-severity runtime or package control. |

## Gap-Closure Independent Re-Audit

- **Audited scope:** Only the reopened T-07-01 and T-07-02. T-07-03 through T-07-06 remain closed, and T-07-SC remains accepted under its existing boundary.
- **Independent result:** T-07-01 and T-07-02 are CLOSED. The accessor return, accessor throw, supersession, stop/token invalidation, exact later C dispatch, and exact one-response assertions are all present in code or C17 at the declared entry points.
- **Negative evidence:** Compiled M-07-C10 is exact, non-vacuous, uniquely detected by C17, byte-identically restored, and bound to register digest `a55444ba593e9d4f80dfb3664267d015dbb5740a8c6fe1c2f08ccf0585945492`.
- **Preserved regressions:** CR-01, CR-02, CR-03, WR-01, C10-C16, J01-J18, and L01-L18 remain green alongside C17 and the 31-row mutation battery.
- **Release binding:** The independently recomputed live revision digest equals immutable release digest `4efea16561defaf73e924b5dd855df2619af2186c58c00f92eab5855751c3252`; its recorded run has seven successful commands and 16 test files with 323/323 tests.

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
- **CR-03:** release inputs are enumerated, untracked scoped files are rejected, the snapshot is read-only, and every gate is bracketed by snapshot digest checks (`phase-07-mutation-battery.mjs:1749-1860`, `:2458-2528`). The current immutable run remained stable at release digest `4efea16561defaf73e924b5dd855df2619af2186c58c00f92eab5855751c3252`.
- **WR-01:** M-07-L03 now selects L17/L18, and the production branch rechecks lifecycle only after all hostile `respond`/row property reads (`session.ts:438-444`; tests at `session-lifecycle.test.ts:767` and `:806`). The mutation verifier reports the row green with the exact two detectors.

## Threat Flags and New Attack Surface

No summary contains an unmapped `## Threat Flags` item. The executor's threat-evidence entries map only to T-07-01 through T-07-06, and the Phase 07-04 summary explicitly records no new endpoint, authentication path, file-access boundary, schema, or other surface beyond the registered Session transport seam. **Unregistered flags: none.**

## Independent Gap-Closure Verification

The independent audit performed the following live, read-only or build/test checks against the repaired revision and separately inspected the immutable mutation/release records.

| Check | Result |
|-------|--------|
| `node scripts/phase-07-mutation-battery.mjs verify inputs` | PASS — 3 protected inputs byte-identical |
| `node scripts/phase-07-mutation-battery.mjs verify all` | PASS — 31/31 current-revision mutation rows green |
| `node scripts/phase-07-mutation-battery.mjs self-test` | PASS — negative controls, including release-snapshot and response-cutoff sensitivity, rejected |
| `pnpm -r build` | PASS — package build, ATTW, and publint green |
| C17 exact focused test | PASS — 1/1; both accessor return and accessor throw branches reached exact later C dispatch/response |
| Full catalog suite and package typecheck | PASS — 22/22 catalog tests and `tsc -p tsconfig.test-d.json` green |
| M-07-C10 immutable focused/restored record | PASS — exactly C17 ran and failed on its unique marker; target hashes match; restored catalog 22/22, build, and typecheck were green |
| Independently recomputed register/release digests | PASS — register `a55444ba593e9d4f80dfb3664267d015dbb5740a8c6fe1c2f08ccf0585945492`; release `4efea16561defaf73e924b5dd855df2619af2186c58c00f92eab5855751c3252` |
| Recorded immutable release run | PASS — 7/7 release commands exit 0; 16 test files, 323/323 tests, 0 failed/pending/todo (`07-MUTATION-EVIDENCE.json:42-62`) |

## Audit Trail

### 2026-08-09 — Plan 07-07 gap-closure independent re-audit

- **Prior state:** T-07-01 and T-07-02 were reopened because the earlier security audit predated the composed accessor-supersession repair and could not self-certify it.
- **Code verification:** The live implementation contains token/epoch-identity cleanup, stale-record abandonment on both getter return and getter throw, stop-time token invalidation, and continued outer transition draining to the winning context.
- **Executable verification:** C17 passed live and proves exact later C dispatch/response in both getter branches. The current M-07-C10 record proves removal of abort/clear compiles, executes one detector, fails only C17 on its unique marker, and restores the target byte-identically.
- **Integrity verification:** The on-disk register digest was recomputed, every one of 31 evidence rows passed current-revision verification, and the immutable release digest was independently recomputed from the 68 tracked release inputs and matched its seven-command, 16-test-file, 323/323 record.
- **Disposition change:** T-07-01 and T-07-02 move from RE-AUDIT REQUIRED to CLOSED. No other threat disposition changed; there are no unregistered flags and no open high-severity threats.

## Residual Risk

JavaScript cannot forcibly terminate a handler that has already entered and ignores cancellation, and core cannot prove that a future consumer transport reports truthful capabilities. The implementation aborts the composed signal, waits for entered work during stop, suppresses all post-stop responses, and treats capability declarations as immutable. These are declared design limits, not unverified Phase 7 mitigations.

**Current disposition:** SECURED. All six mitigated threats are CLOSED, T-07-SC remains a documented ACCEPTED risk within its stated boundary, and `threats_open: 0` satisfies `block_on: high`.
