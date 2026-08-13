# Phase 8: Consent Kernel - Research

**Researched:** 2026-08-10
**Scope:** CON-01..CON-10, CAT-04, TRN-03, SEC-04; TRN-02 full-kernel closure; TRN-05 runtime enforcement
**Confidence:** High on repository integration and state-machine design; implementation must be checked against RFC 8785 vectors and the hostile-value suite

## Summary

Phase 8 should be implemented as three deliberately separate mechanisms:

1. A factory-local consent ledger in `createConcierge` that records a successful review, waits for delivery evidence, and consumes one authority immediately before the gated handler.
2. A strict evidence path that canonicalizes the app-owned `Readback`, verifies the sink's receipt with injected SHA-256, and treats a delivery-bound human act as a distinct attestation.
3. A session-owned failure-outcome barrier that presents app-authored failed rows before any `Transport.respond` call can return those rows to the agent.

The existing architecture already supplies the important ordering boundaries: `dispatch` installs a Promise in its dedupe cache before `runDispatchPipeline` executes, `runDispatchPipeline` has one handler-entry point, `executeDispatchBatch` preserves invocation evidence, and `Session.runWork` has one `dispatchBatch -> respond` seam. The implementation should extend those boundaries, not introduce a second dispatcher or consent-specific session.

The most important invariant is that freshness, delivery, snapshot equality, and grade are all necessary and none is sufficient alone. In particular, an interrupted delivery followed by a genuinely new human turn must still fail closed.

## Existing Seams and Required Changes

| File | Existing seam | Phase 8 change |
|---|---|---|
| `packages/concierge/src/types.ts` | Consent policy/ack, readback receipt, delivery report, transport capability, config, and session types | Add the minimal declared consent profile, readback attestation, failure-outcome sink types, delivery evidence field, and required session sink. Keep all evidence deeply readonly. |
| `packages/concierge/src/catalog.ts` | One flat aggregated catalog build and structured `CatalogIssue` values | Add profile-aware CAT-04/TRN-03 issue codes and checks without short-circuiting other issues. |
| `packages/concierge/src/concierge.ts` | Factory-local state, one flat `buildCatalog`, deduped pipeline, captured args, commit window, and one handler entry | Capture/freeze configuration, own the lazy review ledger, register delivery callbacks, validate evidence, compare late snapshots, consume atomically, and inject the ack. |
| `packages/concierge/src/bridge.ts` | Detached `captureSnapshot` behavior | Reuse as-is for review and confirm snapshots; do not store live bridge values. |
| `packages/concierge/src/dispatch.ts` | Copies hostile envelopes and forwards turn/response/delivery metadata | Preserve as-is except for type propagation required by a widened `DeliveryReport`. |
| `packages/concierge/src/session.ts` | Validates/owns transport lifecycle and serially calls `respond` after `dispatchBatch` | Validate actual capabilities before side effects, call the app outcome sink for failed rows, then release unchanged results only after successful presentation. |
| `packages/concierge/test/fixtures/stub-transport.ts` | Configurable Phase 7 no-network transport and histories | Extend this exact fixture with delivery callbacks/reports, attestation controls, capability variants, outcome histories, and event ordering. |
| `packages/concierge/test-d/*`, `packages/concierge/test/*` | Exact public-shape, hostile-runtime, session, release, and mutation proofs | Pin new readonly types and add focused kernel, canonicalization, catalog, session, fixture, package, and mutation tests. |
| `README.md` | Public design/trust contract | Add the SEC-04 server challenge and independent re-verification example. |

## Recommended Public Surface

Names may change during implementation, but the responsibilities should not:

- `ConsentCapabilities` (or `ConsentProfile`) contains only `consentGrade` and `userTurnIdentity`. `ConciergeConfig` requires or optionally accepts it; absence is normalized to frozen `{ consentGrade: "none", userTurnIdentity: "none" }`.
- `ReadbackAttestation` binds `act: "confirmed" | "declined" | "dismissed"`, a non-empty trustworthy `userTurnId`, and the exact `readbackHash`. It is evidence observed by the app/transport, not a value returned by `ReadbackSink`.
- `DeliveryReport` gains an optional attestation field. `outcome: "completed"` remains independently required; the attestation cannot relabel an interrupted report.
- A deeply readonly batch failure outcome contains stable rows of `{ callId, reason, message }`. The sink returns a closed presentation outcome (completed/interrupted) or rejects; it receives no agent-authored text.
- `SessionConfig` carries the required outcome sink. Keep `Transport.respond(callId, result)` unchanged so transport adapters do not acquire app narration policy.
- Add one fixed session diagnostic for outcome-presentation failure/interruption. Do not interpolate thrown values or failed result prose into it.

All construction paths must snapshot untrusted configuration before later reads. Preserve the existing function-property syntax for `ConsentPolicy.snapshotEquality` and method syntax for `DigestLike.digest`.

## Catalog and Session Capability Gates

`createConcierge` should copy and freeze the declared profile before the single `buildCatalog` call, then pass it through `BuildCatalogOptions`. The catalog post-pass should inspect every valid declared action with consent and aggregate:

- one grade issue when `minGrade` ranks above the declared `consentGrade`;
- one provenance issue for every `bindTo: "userTurn"` action unless declared `userTurnIdentity` is `human-attested`;
- an actionable issue naming the action, required value, declared value, and exact fix.

Do not silently lower `minGrade`, and do not use the action's review target as the issue subject. The gated action is what refuses to build.

`createSession` then snapshots `transport.capabilities` and proves that the real transport dominates the Concierge declaration before calling `setTools`, `onStatusChange`, or `onToolBatch`. Grade comparison uses `CONSENT_GRADE_ORDER`; provenance dominance is equality for `human-attested` and otherwise follows the declared trust ordering. A stronger transport is allowed. A weaker transport throws synchronously before externally observable work.

This second check is required because direct `Concierge.dispatch` has no transport, while a Session may be paired with a different transport after the catalog was built. It also makes TRN-05 load-bearing at runtime rather than merely representable in types.

## Consent Ledger and State Machine

Allocate the ledger lazily inside `createConcierge`, keyed by review action name. A monotonically increasing generation or unique token prevents late callbacks from owning a replacement generation.

Suggested private states:

```text
absent
  -> pendingDelivery(review generation, payload, snapshot, review ids, receipt claim)
  -> armed(generation, payload, snapshot, ids, achieved evidence)
  -> consuming
  -> absent
```

`declined` and `dismissed` are terminal observations of a generation, not armed states. They should map to the existing `declined` and `cancelled` result semantics and require a new review before any later confirm.

### Review transition

1. Run ordinary action lookup, argument snapshotting, validation, cancellation, and commit-window logic through the existing pipeline.
2. Immediately after validated review arguments exist, replace any earlier slot for that review name with a new generation.
3. Capture the exact frozen validated args object as the future ack payload.
4. Capture and normalize the review-time bridge snapshot once.
5. Run the review handler. Only a successful normalized result may proceed toward delivery registration.
6. Install `pendingDelivery` before invoking `deferUntilDelivered`, so a synchronous callback is safe.
7. A missing/invalid hook, registration throw, unsuccessful review, interrupted report, mismatched response, stale generation, or duplicate callback leaves the gate closed.

No callback may mutate a slot unless both its generation token and review response still own that slot.

### Delivery and evidence transition

For `delivered`/`relayed`, a completed report with matching response ownership establishes only the measured delivery hop. For `attested`, all of the following must agree:

- completed delivery;
- core-generated canonical bytes for the complete readback;
- SHA-256 digest over those exact retained bytes;
- receipt literals `alg === "SHA-256"` and `canonicalization === "JCS"`;
- byte-for-byte receipt canonical data equality;
- receipt hash, report hash, and attestation hash equality;
- attestation act is `confirmed`;
- attestation turn is non-empty, human-attested, and owned by this generation.

`declined` and `dismissed` must never be transformed into `confirmed`, even if every hash matches. Capability values are ceilings only; achieved grade is derived from the evidence actually present.

### Confirm transition

1. Resolve the gate from `ConsentPolicy.requires`; absent or pending returns `onMissing` or `consent_required`.
2. Validate the binding before consumption. User-turn binding requires non-empty review/confirm ids, human-attested provenance, and different ids. Response binding requires non-empty, different response ids.
3. A same-boundary attempt or pre-entry abort returns closed without consuming an otherwise valid armed slot.
4. After the commit window and immediately before handler entry, capture/normalize the latest snapshot.
5. Call the action's captured comparator or strict structural equality. A mismatch or comparator throw destroys the slot and returns `consent_stale`.
6. Recheck the achieved grade against `minGrade`; degradation destroys or closes the occurrence with `grade_unavailable` and never enters the handler.
7. Transition to `consuming` before invoking app code. Build and freeze one `ConsentAck` from stored payload, stored snapshot, review ids, achieved grade, retained evidence, and optional inbound challenge.
8. Call the handler with the exact stored payload object in `ack.payload`. Success, handler throw/rejection, invalid result, or any ambiguous post-entry failure leaves the generation destroyed.

Because all of these transitions occur inside the existing deduped Promise, a repeated `callId` observes the same Promise and cannot mint or consume a second authority.

## Strict JCS, UTF-8, and Receipt Verification

Implement canonicalization in a small internal module with no DOM or Node imports. It should return a newly allocated frozen/read-only byte view retained by the generation.

The canonicalizer must:

- accept only JSON primitives, dense arrays, and ordinary/null-prototype data objects;
- reject `undefined`, bigint, symbol, function, non-finite number, sparse arrays, symbol keys, accessors, `toJSON`, exotic instances, proxies that throw or violate invariants, cycles, and repeated object aliases;
- reject lone UTF-16 surrogates in keys or string values;
- serialize strings with the JSON escapes required by RFC 8785 and leave other Unicode scalar values unescaped;
- serialize finite numbers according to ECMAScript JSON number serialization, including RFC 8785's normalization rules;
- sort object property names by UTF-16 code units as RFC 8785 specifies;
- never omit, coerce, or substitute a supplied field.

The hand-written UTF-8 encoder should walk code points, combine valid surrogate pairs, reject lone surrogates, and emit the standard one-to-four-byte sequence. Hash via `DigestLike.digest("SHA-256", bytes)`. Convert the result to the project's stable hash encoding once, then compare strings using exact equality and bytes with a length-plus-index loop.

Treat `ReadbackSink`'s returned receipt as an untrusted claim. Snapshot its fields, verify literals, canonical bytes, and digest, and do not later reserialize the readback. A sink throw/rejection, malformed receipt, or digest failure cannot arm consent and must not leak the caught value.

Use official RFC 8785 canonicalization/number/string vectors plus local negative cases. Cross-checking only `hash` is insufficient: a forged receipt could pair a matching string with different retained bytes.

## CON-10 Outcome Barrier

In `Session.runWork`, retain the exact `dispatchBatch` rows and derive failed rows in stable batch order. Deep-copy/freeze only the app-owned outcome projection `{ callId, reason, message }`; never pass action args, model text, or mutable `ActionResult` aliases to the sink.

If no rows failed, skip the sink and preserve the current response loop. If any failed:

1. await one batch-level outcome presentation;
2. on completed presentation, call `transport.respond` once per original row in stable order with the original correlated result;
3. on throw, rejection, or interrupted presentation, emit the fixed safe diagnostic, release no affected failed result to the agent, perform no automatic retry, and stop/abort the occurrence as selected by implementation.

No `respond` call may occur before the outcome barrier settles successfully. Tests need a shared event history to prove ordering, not two unrelated arrays whose timestamps are inferred.

## Validation Architecture

Validation should be layered so failures identify the broken boundary:

### Static/type checks

- Pin the exact exported shapes for profile, attestation, delivery report, outcome/sink, and SessionConfig.
- Prove `attested` still implies a required `readbackHash`; all evidence/profile members are readonly; payload/snapshot generics reach handler ack.
- Prove browser and Node `SubtleCrypto` remain structurally compatible with method-shaped `DigestLike`.
- Update export-surface and declaration-rollup pins intentionally.

### Focused runtime suites

- `catalog`: grade/provenance issue aggregation, weakest absent profile, multiple offenders, hostile declarations, and actionable fields.
- `canonicalization`: RFC vectors; ordering; escapes; UTF-8 boundaries; retained bytes; malformed strings; non-JSON/exotic/accessor/alias/cycle rejection; receipt/digest mismatch.
- `consent`: no review, same turn/response, fresh review supersession, late/duplicate callback, interrupted flagship case, drift, comparator throw, exact payload identity, one-shot use, cancellation boundaries, handler failures, and dedup Promise identity.
- `attestation`: capability-only forgery, each missing evidence component, all hash cross-mismatches, response/generation mismatch, confirmed/declined/dismissed mapping, and trustworthy turn provenance.
- `session`: capability dominance before side effects, outcome-before-response ordering, stable failed rows, all-success bypass, sink throw/reject/interruption, no retry, cleanup, and original-result correlation.
- `stub transport`: extend and reuse the Phase 7 fixture to drive the complete kernel without network/WebRTC; this is the acceptance proof that moves TRN-02 from Partial to Complete.
- `README/package`: worked server-verification example, no test fixture in tarball, no forbidden host globals/dependencies, and release build.

### Commands and cadence

During implementation run the smallest affected Vitest/type-test target after each task, then package-wide `typecheck`, `test-d`, unit/integration tests, build, pack/foreign-consumer checks, and the repository release gate. The phase mutation battery must target each fail-closed transition and evidence comparison; a green suite without mutation discrimination is not sufficient for this kernel.

## Plan Decomposition

A low-conflict execution sequence is:

1. Public evidence/profile/outcome types and exact type/export tests.
2. Strict JCS/UTF-8/digest/receipt internal module with focused vectors and hostile-value tests.
3. Profile-aware catalog validation and construction-time injected-seam checks.
4. Factory-local consent ledger, delivery arming, binding, snapshot comparison, one-shot ack injection, and focused kernel tests.
5. Attested evidence/act verification and refusal/dismissal behavior.
6. Session transport dominance and CON-10 outcome barrier.
7. Extend the Phase 7 stub and add full end-to-end consent/session cases, especially the interrupted-delivery/new-turn case.
8. SEC-04 documentation, mutation/security audit, tarball/foreign-consumer/release closure, and requirements traceability.

Types and canonicalization can be planned separately, but the ledger and attestation work should share an explicit dependency because the ledger must consume verified evidence rather than reconstruct it.

## Security Threats and Required Mitigations

| Threat | Mitigation and proof |
|---|---|
| Agent self-approves in a fabricated turn | Require human-attested provenance and genuinely different non-empty turn ids; build/session gates plus negative runtime tests. |
| Review result arms before reaching a human | Pending-before-callback generation state; only matching completed delivery arms. |
| Late callback arms a replacement review | Generation and response ownership checks; supersession/late-callback tests. |
| Payload or app state changes after review | Detached stored args and snapshot; late normalized comparison; exact identity and drift tests. |
| Capability declaration is treated as proof | Capabilities are ceilings; achieved grade comes only from occurrence evidence. |
| App/sink forges a receipt or reserializes differently | Core-owned JCS/UTF-8, injected digest recomputation, exact retained-byte and multi-hash comparison. |
| Delivery hash is mistaken for human confirmation | Separate `ReadbackAttestation`, closed act union, completed report, trusted turn, and generation binding. |
| Duplicate/retried call consumes or arms twice | All state transitions live behind the existing exact-Promise dedupe boundary. |
| Model rewrites a failed outcome | App-owned batch sink must complete before any failed result reaches `respond`; fixed diagnostic and no retry on failure. |
| Client ack is trusted by a server | SEC-04 example requires server-issued/stored challenge, independent auth/payload/freshness verification, single use, effect, then burn. |
| Hostile callbacks/objects leak or execute unexpectedly | Snapshot fields once, reject accessors/exotics, contain throws, use fixed reasons/diagnostics, and never echo caught values. |

## Risks and Planning Notes

- RFC 8785 number formatting is easy to approximate incorrectly. Prefer a small auditable implementation backed by official vectors; do not hand-invent alternate decimal formatting.
- `Object.freeze(new Uint8Array(...))` is not portable as a runtime immutability mechanism. Do not expose the internal mutable view; retain a private copy and return a defensive readonly copy if public receipt verification requires one.
- A required `SessionConfig` outcome sink touches every existing session fixture. Update test builders centrally while keeping tests that prove omission/malformed JavaScript input fails early.
- The outcome barrier slightly changes Phase 7 liveness: failed results are deliberately withheld when human presentation fails. Preserve FIFO cleanup and make the security precedence explicit in tests.
- Review actions may be referenced by several gated actions, but the ledger is review-keyed and one-shot. Tests must prove one confirm consumes the shared authority rather than fanning it out.
- `TRN-02` is recorded as Phase 7 Partial and is absent from the Phase 8 formal requirement list; plans must still include its explicit closure using the exact existing fixture.
- `TRN-05` is already marked complete at the type level; Phase 8 must nevertheless test the runtime refusal promised by the roadmap.

## Sources

- `.planning/phases/08-consent-kernel/08-CONTEXT.md`
- `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md`
- `packages/concierge/src/{types,catalog,concierge,dispatch,bridge,session}.ts`
- `packages/concierge/test/fixtures/stub-transport.ts`
- RFC 8785, JSON Canonicalization Scheme
- WebAuthn Level 3 retained-byte and challenge-binding model

---

*Phase: 08-consent-kernel*
*Research completed: 2026-08-10*
