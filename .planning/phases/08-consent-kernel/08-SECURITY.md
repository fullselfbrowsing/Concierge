---
phase: 08-consent-kernel
phase_number: 8
status: secured
standard: OWASP ASVS Level 1
block_on: high
threats_total: 11
threats_mitigated: 11
threats_open: 0
register_digest: 7d38c388e0918f2f2e4c1f06bebc7768c084ea116df24cacff7b7a3cafe9f244
release_revision: 0d30400adbe22f900d0d59be40fa35430d505c1234eca07d129f4094e3c0512f
audited_at: 2026-08-10T16:05:40Z
---

# Phase 8 Security Audit

## SECURED

Phase 8 meets the OWASP ASVS Level 1 blocking policy. All ten canonical consent threats and the package supply-chain threat were freshly inspected against the live implementation, current named tests, compiled mutation evidence, and immutable release evidence. No earlier disposition was inherited.

## Scope and Method

The audit read the live consent profile, catalog, Concierge state machine, canonical evidence implementation, Session outcome barrier, exact test fixture, root README server example, package allow-list, and release scripts. A control was counted only when its relevant entry points were present and at least one exact compiled mutant made a named behavioral detector fail. Build failure, a zero-test selector, prose alone, or stale evidence was not accepted.

The current register has 48 unique exact mutations: 15 generation, 15 evidence, 7 capability, 7 outcome, and 4 package mutations. The forty-eighth row is the post-review D-08-12 control that resurrects contradictory-attestation downgrade into relayed authority. Every row compiled, selected a nonzero exact detector, matched a marker parsed from the actual failing assertion or package detector, was killed, restored byte-identically inside a disposable snapshot, passed its restored gates, and matched the live revision endpoints. The release proof ran seven gates from one read-only snapshot.

## Threat Dispositions

| Threat | Severity | Canonical meaning | Live control | Negative evidence | Disposition | Residual |
|--------|----------|-------------------|--------------|-------------------|-------------|----------|
| T-08-01 | High | The agent self-approves in the review response or a forgeable turn | `concierge.ts` requires nonempty distinct invocation boundaries and human-attested provenance; catalog and Session reject weaker profiles before effects | K14 and C29 kill M-08-G06, M-08-C02, and M-08-C03 | Mitigated | Core relies on the application and transport to truthfully establish the declared human provenance; a future vendor adapter needs its own audit |
| T-08-02 | High | Review return or partial delivery arms authority | A generation-owned pending slot is installed before the callback and only the matching completed response-owned report can arm it; interruption and stale callbacks remain terminal | K03, K04, K07, E10, and the fixture flagship kill M-08-G01..G04 | Mitigated | Delivery truth ultimately depends on the transport implementation; the kernel independently prevents a declaration or callback registration from being sufficient |
| T-08-03 | High | Reviewed payload or app state drifts before confirm | The ledger retains the exact detached validated payload, captures a late detached snapshot, contains comparator failure, and destroys authority on mismatch before handler entry | K17, K18, K20, K21, and K26 kill M-08-G07..G11 | Mitigated | A custom comparator defines application equality; a dishonest comparator can intentionally ignore fields and remains the application author's responsibility |
| T-08-04 | High | Capability declaration is mistaken for achieved proof | Catalog clamps every gated policy to delivered, runtime independently rejects achieved none, actual Session capability dominates the declared profile, and occurrence evidence derives the achieved grade only from a complete consistent tuple | N01, N02, C27, C29, S02, E12, and shared-gate E14 kill M-08-G15, M-08-C01/C04..C07, and M-08-E15 | Mitigated | Capabilities remain self-declared ceilings; future adapters must substantiate how their delivery and provenance evidence is measured |
| T-08-05 | High | Receipt/hash is forged or canonicalization collides | `consent-evidence.ts` accepts only strict JSON data, implements RFC 8785 and hand UTF-8, retains exact bytes, recomputes SHA-256 through the injected digest, compares receipt literals, bytes, and hashes, and destroys contradictory attempted claims | J02-J11, E02, and E14 kill M-08-E01..E09 and M-08-E12..E15 | Mitigated | Cryptographic strength depends on the injected digest implementation; construction gates require that seam but core cannot certify a malicious implementation |
| T-08-06 | High | A delivery hash is mistaken for a human act | A closed `ReadbackAttestation` is separate from presentation, must say confirmed, must carry a trustworthy nonempty turn, and must match generation, response, report, and receipt hashes; any incomplete or contradictory attempted tuple closes the shared generation | E02, shared-gate E14, and decline/dismissal cases kill M-08-E03..E06 and M-08-E15 | Mitigated | Human observation is bounded by the app or transport attestation source; core prevents a delivery report or hash alone from becoming attested authority |
| T-08-07 | High | Retry or reentrancy arms/consumes more than once | All review and confirm transitions remain behind exact-Promise dispatch dedupe; callbacks claim once and authority is deleted before application code | E09, E10, K07, K22, and K24 kill M-08-G03..G05, M-08-G07, and M-08-G12..G14 | Mitigated | The one-shot guarantee is in-memory and per Concierge factory; durable cross-process consent is explicitly out of scope |
| T-08-08 | High | The model rewrites app failure prose | Session constructs one frozen app-owned failure outcome, awaits its sink before the first response, skips success-only batches, withholds interrupted outcomes, emits fixed diagnostics, and never retries | S05-S07 and J04 kill M-08-O01..O05 and M-08-O07 | Mitigated | A sink that never settles can delay that FIFO occurrence; cancellation and Session teardown bound release but cannot forcibly terminate arbitrary application code |
| T-08-09 | High | Client assertion is treated as server authorization | The root README calls all client evidence untrusted and shows server authentication, a stored challenge, exact bindings, freshness and unused checks, current-policy exact-action authorization immediately before the guarded effect, burn, and commit | P03 and P04 kill M-08-P03 and M-08-P04 | Mitigated | The example is intentionally illustrative; production servers still own durable storage, authentication, policy, idempotency, and transactional recovery |
| T-08-10 | High | Hostile callbacks/objects leak secrets or escape | Construction and evidence paths snapshot own data descriptors, reject accessors, proxies, exotics, and aliases, contain every external callback, and expose only fixed authored failures and diagnostics | K18, J08, S02, and S07 kill M-08-G09, M-08-E10/E11, M-08-C06, and M-08-O03/O06 | Mitigated | JavaScript proxy invariants and application callbacks can consume CPU before throwing; core contains values and effects but does not provide process isolation |
| T-08-SC | High | Protected inputs, dependency graph, or package contents drift | Protected manifests and lockfile are hash-pinned, runtime dependency bytes are zero, the package allow-list excludes tests, and the real tarball is installed and imported by a foreign consumer on the Node floor | U08 and the package precondition kill M-08-P01 and M-08-P02 | Mitigated | Registry and toolchain compromise remain ecosystem risks; any manifest, lockfile, release-toolchain, or package-boundary change requires a fresh audit |

## Independent Control Re-Audit

### Consent authority

`createConcierge` owns the only review ledger. Generations and response ownership guard every callback, a new validated review invalidates prior authority, achieved `none` is rejected at arming and entry, boundary freshness is checked before consumption, state is compared after the commit window, and the slot is deleted before the gated handler. The G and C mutation families independently remove each of these controls.

### Evidence and attestation

`consent-evidence.ts` does not delegate canonicalization to `JSON.stringify` over hostile values. It walks data descriptors, rejects unsupported values and aliasing, emits strict canonical text and UTF-8, retains canonical bytes, and recomputes the digest. `concierge.ts` treats a receipt as an untrusted claim, requires a distinct confirmed attestation before an attested grade, and destroys the review generation when any attempted higher-grade tuple is incomplete or contradictory. E14 proves that an attested and relayed sibling cannot consume that corrupted occurrence; M-08-E15 removes the close guard and is killed by the forbidden relayed entry. The E family targets every byte, literal, hash, act, turn, downgrade, accessor, and canonicalization boundary.

### Session outcome boundary

`session.ts` snapshots actual transport capabilities before subscription or publication and rejects weaker grade or provenance. For failed rows it creates an immutable stable projection and awaits `presentOutcome`; only a completed presentation permits the original correlated rows to enter the established one-attempt response loop. The C05/C06 and O family mutations prove the capability and outcome barriers are load-bearing.

### Server and package boundary

Only the root `README.md` owns the SEC-04 example. Its redemption order performs current-policy authorization of the authenticated principal for the exact action on the line immediately before the guarded effect. Tests reject removal, bypass, substitution, and reordering. The production barrel contains no stub transport, the package allow-list excludes test paths, and the foreign tarball proof rejects any fixture or stub entry.

## Evidence Integrity

- Register digest: `7d38c388e0918f2f2e4c1f06bebc7768c084ea116df24cacff7b7a3cafe9f244`.
- Mutation outcome: 48/48 green with zero infrastructure errors and 48 unique current-revision digests.
- Protected inputs: both manifests and `pnpm-lock.yaml` match their recorded SHA-256 values.
- Release revision: `0d30400adbe22f900d0d59be40fa35430d505c1234eca07d129f4094e3c0512f`.
- Release gates: all seven exits are zero; 20 files and 428/428 tests pass; artifact surface is 75 names, 60 types, and 15 values; runtime dependency contribution is zero bytes; the foreign package and Node v22.12.0 import pass.

## Residual Design Limits

Consent is deliberately bounded to one in-memory Concierge instance. Core cannot certify that a future transport's claimed provenance is honest, that an injected digest is cryptographically sound, or that a relying server implemented the illustrative challenge protocol. It also cannot terminate arbitrary application code that ignores cancellation. These limits are explicit trust boundaries; none permits capability declaration, delivery alone, model prose, or a client assertion to become authority inside the audited kernel.

**Current disposition:** SECURED. All eleven registered high threats are mitigated, `threats_open: 0`, and formal Phase 8 closure may proceed.
