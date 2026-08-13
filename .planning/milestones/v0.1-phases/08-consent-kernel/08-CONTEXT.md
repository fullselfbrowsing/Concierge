# Phase 8: Consent kernel - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** Autonomous advisor discussion; standard calibration; all recommended defaults auto-selected

<domain>
## Phase Boundary

Implement the transport-neutral consent runtime that turns a successful review into one generation-guarded, delivery-armed, one-shot authority and lets the gated handler run only when the exact reviewed payload, a detached snapshot, the declared capability grade, turn provenance, and observed delivery evidence all still agree. Add the build/session capability gates, strict JCS/UTF-8 evidence path, separate readback attestation, mandatory app-authored failure readback at the Phase 7 session seam, full reuse of the Phase 7 stub transport, and the SEC-04 worked server-verification warning.

This phase owns CON-01 through CON-10, CAT-04, TRN-03, the remaining full-kernel half of TRN-02, and SEC-04. It may amend pre-publish public types where the runtime proof requires it. It does not implement a server verifier, mint a server challenge, add a real vendor transport, add framework adapters, or trust model-authored prose as consent evidence.

</domain>

<decisions>
## Implementation Decisions

### Consent authority and state transitions

- **D-08-01 — Keep consent state factory-local and review-keyed.** Add one lazily allocated ledger inside each `createConcierge` closure, keyed by the globally unique review action name named by `ConsentPolicy.requires`. A review authorizes at most one later gated handler, even if several actions name that review. Do not use module state, a transport-owned ledger, or a per-confirm fan-out.
- **D-08-02 — Put every mutation behind the existing dispatch dedupe boundary.** Review, arming, comparison, and consumption happen inside the pipeline reached only after `dispatch` installs or reuses its cached Promise. Retrying one `callId` therefore returns the exact same Promise and cannot mint a second review generation or consume twice.
- **D-08-03 — A fresh real review replaces all earlier authority immediately.** After ordinary argument validation succeeds, a new review generation invalidates any pending or armed generation for that review name, captures the exact detached validated argument object as the ack payload, and captures the current bridge snapshot through `captureSnapshot` plus the configured normalizer. The handler sees the same captured payload object later; confirm never recomputes it from current app state or from confirm arguments.
- **D-08-04 — Successful review is necessary but never sufficient.** Only a successful review result may register the supplied `deferUntilDelivered` callback. Install the generation's pending-delivery state before invoking outside code so a synchronous callback is safe. A missing/invalid hook, hook-registration failure, unsuccessful review, interruption, dismissal, or any non-`completed` delivery outcome leaves the gate closed. Late or repeated callbacks are inert unless their generation and response still own the slot.
- **D-08-05 — Bind against the review invocation, not an agent response chosen later.** For `bindTo: "userTurn"`, both review and confirm need non-empty turn ids, the configured provenance must be `human-attested`, and confirm must be in a genuinely different turn. For `bindTo: "response"`, both response ids must exist and differ. A same-boundary attempt fails closed before the handler but does not consume an otherwise armed generation, allowing a later genuine human turn to try.
- **D-08-06 — Compare the latest detached snapshot as late as possible.** After validation, cancellation, and the commit window, but immediately before handler entry, capture the confirm-time snapshot and call the action's existing `snapshotEquality` function-property when supplied; otherwise use the kernel's strict structural equality over captured data. A comparator throw is contained. Any throw or mismatch destroys the generation and returns `consent_stale`.
- **D-08-07 — Consume atomically before application code.** Transition the owned generation from armed to consuming before entering the gated handler, and pass a newly frozen `ConsentAck` carrying the stored review turn/response ids, exact stored snapshot, exact stored payload, achieved grade, and validated evidence. Successful confirm, fresh review, mismatch, explicit decline, and every ambiguous post-entry failure leave it destroyed. A pre-entry abort or same-turn refusal does not consume. Preserve `declined` and `cancelled` exactly so the agent can choose whether to offer a fresh review; neither result silently re-arms consent.
- **D-08-08 — Use existing honest failure surfaces.** No/pending consent returns `policy.onMissing` when declared, otherwise the fixed `consent_required` result. Drift returns `consent_stale`; an observed capability degradation returns `grade_unavailable`. All paths pass through the existing result sanitizer and closed reason vocabulary; do not add a catch-all reason or leak caught values.

### Capability profile, grades, and build gates

- **D-08-09 — Declare a minimal consent profile on `ConciergeConfig`.** Add one immutable profile containing only `consentGrade` and `userTurnIdentity`, copied and frozen during `createConcierge`. It is the build-time authority for both transport-backed and application-owned direct dispatch. Absence behaves as the weakest profile (`none` / `none`), so an ungated direct loop still works and a gated build fails closed until the app declares what it can actually prove.
- **D-08-10 — Enforce CAT-04 and TRN-03 while the complete catalog is built.** Pass the frozen profile into the single flat `buildCatalog` invocation. Aggregate one structured issue per offending action, naming the action, required grade or provenance, declared capability, and fix. Reject `minGrade` above the profile and reject every `bindTo: "userTurn"` action unless the profile declares `human-attested` turn identity. Never silently lower a policy.
- **D-08-11 — The real session transport must dominate the declaration.** `createSession` validates its frozen `TransportCapabilities` against the Concierge profile before any subscription, publication, or batch acceptance. A stronger transport is valid; a weaker grade or turn provenance throws before outside effects. Runtime evidence may still achieve less than the declared ceiling, in which case the action returns `grade_unavailable` and does not run.
- **D-08-12 — Grade is derived from evidence, never copied from capabilities.** The achieved grade is the lower of the declared ceiling, the actual transport ceiling, and what this review occurrence proved. Capability `attested` alone grants nothing. Delivery must complete; evidence required by each grade must be present and internally consistent; any missing or contradictory evidence leaves the gate closed.

### Canonical readback and attestation

- **D-08-13 — Core owns the bytes and verifies the receipt.** Implement strict RFC 8785 canonicalization of the complete `Readback` value and a small hand-written UTF-8 encoder under `lib: ["ES2022"]`; keep SHA-256 injected through `DigestLike`. Preserve the existing app-owned `ReadbackSink` and receipt return, but treat that receipt as a claim: core recomputes the canonical bytes, hashes them through the injected digest, and accepts the receipt only when algorithm, canonicalization, bytes, and hash all match.
- **D-08-14 — Reject values outside the canonical JSON domain.** Fail closed on `undefined`, functions, symbols, bigint, non-finite numbers, lone surrogates, cycles/alias ambiguity, accessors or `toJSON` substitution, unsupported exotic/proxy values, and any field `JSON.stringify` would silently omit or rewrite. Do not coerce, drop, or stringify these values opportunistically. Retain and freeze the exact canonical byte array that was hashed; confirm re-reads it and never reserializes the payload.
- **D-08-15 — Presentation and observation stay separate.** Add an immutable `ReadbackAttestation` carried through the delivery report rather than returned by the presentation sink. It binds a closed observed act (`confirmed`, `declined`, or `dismissed`) and a trustworthy human turn id to the exact `readbackHash`. The kernel cross-checks the receipt hash, report hash, attestation hash, response ownership, and generation.
- **D-08-16 — `attested` requires both halves.** Only a completed delivery plus a core-verified receipt plus a matching one-shot `confirmed` attestation can produce an `attested` ack. `declined` maps to the existing explicit-refusal semantics, `dismissed` maps to cancellation/re-offer semantics, and neither arms. No code path may construct the attested branch from a transport declaration, receipt, hash, or delivery report alone.
- **D-08-17 — Missing injected seams fail early when the claim needs them.** A profile/action combination that can require `attested` must also configure `presentReadback` and `digest`; report this during construction with an actionable named error. Lower grades do not acquire fake hashes, and core never bundles crypto or reaches for `crypto`, `TextEncoder`, or `btoa`.

### App-authored failure readback (CON-10)

- **D-08-18 — Add a required app-owned batch outcome sink to `SessionConfig`, not `Transport`.** Keep `Transport.respond(callId, result)` unchanged. After one `dispatchBatch`, collect failed rows in stable order into one deeply readonly/frozen app-authored outcome carrying each `callId`, exact sanitized `reason`, and exact sanitized `message`. Await the sink before the first result is released to the agent.
- **D-08-19 — The model never supplies or rewrites failure prose.** The sink receives no model text and the session performs no paraphrase. On successful presentation, return every original correlated `ActionResult` through the existing one-attempt-per-row `transport.respond` loop unchanged. Skip the sink when all rows succeeded.
- **D-08-20 — Outcome presentation fails closed.** If the sink throws, rejects, or reports interruption, emit only a fixed safe session diagnostic, do not release the affected failed outcome to the agent, do not retry automatically, and stop/abort that session occurrence rather than giving the agent a chance to narrate around the app. Preserve `declined` versus `cancelled` in both the human outcome and the eventual agent result whenever presentation completed.

### Verification and documentation

- **D-08-21 — Reuse the exact Phase 7 fixture.** Extend `packages/concierge/test/fixtures/stub-transport.ts` in place with explicit delivery, attestation, capability, and outcome controls/histories. Keep it test-only and absent from the published tarball. TRN-02 becomes complete only when this same fixture proves the full kernel.
- **D-08-22 — The interrupt-partway case is the primary proof.** A review that registers delivery, receives an interrupted report, then receives a genuinely new user turn must still fail confirm. The suite must separately prove no review, same turn, missing turn identity, forgeable identity, grade mismatch, late callback, fresh-review supersession, drift, comparator throw, exact payload identity, one-shot consumption, dedup identity, refusal versus dismissal, app-outcome-before-agent ordering, and attested hash/act mismatch.
- **D-08-23 — Document the honest trust boundary with a worked example.** Update the public README/docs to say a `ConsentAck` is a client-side assertion, never server proof. Show a server issuing/storing a challenge, revalidating authorization and the exact payload independently, checking freshness/single use, performing the effect, and burning the challenge. v0.1 may echo an inbound branded challenge but must not mint or verify one.

### Claude's Discretion

- Names of new internal modules, private state tags, public profile/outcome-sink types, safe diagnostics, and test file partitioning.
- Whether the capability profile is a named exported interface or a narrow pick of `TransportCapabilities`, provided it contains no unrelated transport behavior and remains deeply readonly.
- Exact canonicalizer implementation structure and internal byte-comparison helpers, provided RFC 8785 behavior and every fail-closed boundary above are mutation-proven.
- Whether interrupted outcome presentation stops the whole session or only the accepted occurrence, provided no failed result reaches the agent before the app-authored outcome completed and Phase 7 teardown guarantees remain intact.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase contract and trust boundary
- `.planning/ROADMAP.md` — Phase 8 goal, six success criteria, JCS/attestation/TRN-05 additions, and the Phase 7 session seam ownership note.
- `.planning/REQUIREMENTS.md` — literal CON-01..CON-10, CAT-04, TRN-02/TRN-03, and SEC-04 wording and traceability.
- `.planning/PROJECT.md` — core value and locked decisions on modality-free grades, turn provenance, server challenge authority, readback receipts, and app-authored failure narration.
- `.planning/research/PITFALLS.md` — the model-reauthoring, truncated-readback/new-turn, client-assertion, and turn-classification failure modes this phase must close.
- `.planning/research/ARCHITECTURE.md` — existing consent-kernel boundaries and factory-local state constraints.

### Prior phase contracts
- `.planning/phases/01-type-surface-completion/01-CONTEXT.md` — D-03 and D-12: receipt shape, core-owned JCS, injected digest, separate presentation/observation, and deferred `ReadbackAttestation`.
- `.planning/phases/05-bridge-registry-and-the-no-bridge-path/05-CONTEXT.md` — snapshot capture/detachment, normalizer limits, and bridge-resolution contracts.
- `.planning/phases/06-dispatcher/06-CONTEXT.md` — non-async dedupe boundary, one handler context with `ack`, result sanitation, commit ordering, and consent deferrals.
- `.planning/phases/07-session-and-the-transport-seam/07-CONTEXT.md` — exact envelope forwarding, FIFO session routing, one response attempt per row, diagnostics, teardown, and reusable stub contract.

### Live implementation seams
- `packages/concierge/src/types.ts` — current public consent, readback, delivery, capability, action, config, session, and transport contracts.
- `packages/concierge/src/catalog.ts` — aggregated build validation and the complete frozen action registry.
- `packages/concierge/src/concierge.ts` — factory-local dispatcher state, single flat catalog build, stage/bridge resolution, commit window, handler entry, and `ack: undefined` insertion point.
- `packages/concierge/src/dispatch.ts` — hostile envelope snapshotting and exact metadata forwarding.
- `packages/concierge/src/bridge.ts` — `captureSnapshot` and the default clone/detach behavior.
- `packages/concierge/src/session.ts` — the `onToolBatch → dispatchBatch → respond` seam where CON-10 must run.
- `packages/concierge/test/fixtures/stub-transport.ts` — exact Phase 7 no-network fixture Phase 8 must reuse and extend.
- `README.md` — public design contract and SEC-04 worked-example destination.

### External standards
- `https://www.rfc-editor.org/rfc/rfc8785.html` — JSON Canonicalization Scheme and I-JSON constraints.
- `https://www.w3.org/TR/webauthn-3/` — retained serialized bytes, challenge binding, and separate user-presence evidence.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createConcierge` already owns all mutable dispatch state in one factory closure and inserts `ack: undefined` at the single handler-entry point.
- `snapshotInvocationValue`, ordinary schema validation, and `captureSnapshot` already detach and freeze the two values the kernel must preserve.
- `dispatch` installs the final Promise synchronously, while `executeDispatchBatch` forwards `responseId`, `userTurnId`, cancellation, and `deferUntilDelivered` without a cast.
- `CONSENT_GRADE_ORDER`, the closed reason vocabulary, `USER_DECLINED`, `USER_CANCELLED`, result sanitation, and fixed authored failures already encode the public semantics this phase should enforce rather than duplicate.
- `createSession` already owns batch FIFO ordering, safe diagnostics, exact result correlation, and the only pre-agent response seam.

### Established Patterns
- Mutable runtime state is per factory, lazily allocated, generation/token guarded, and never module-scoped.
- Public handles and evidence objects are readonly/frozen; externally supplied values are snapshotted before use; callbacks are treated as hostile and caught without binding or echoing their thrown values.
- Build faults aggregate into structured named issues; runtime degradation uses fixed reason codes/diagnostics and never silently lowers a safety promise.
- Core remains framework/vendor/DOM neutral under `lib: ["ES2022"]`, ESM-only, and runtime-dependency-free in substance. No top-level host capability reads are allowed.
- Runtime adequacy is established by named negative cases and mutation discrimination, not a green happy-path suite alone.

### Integration Points
- Amend `types.ts` and every exact public-shape/export pin together for the capability profile, `ReadbackAttestation`, delivery report, session outcome sink, and any ack evidence tightening.
- Thread the profile through `createConcierge` into the existing one flat `buildCatalog`; do not build a second transport-specific catalog.
- Add the kernel at `concierge.ts`'s one `runDispatchPipeline` handler boundary, keeping the outer `dispatch` non-`async` and its cached Promise identity untouched.
- Capture `normalizeSnapshot`, `presentReadback`, and `digest` once during construction; Phase 8 is their first production consumer.
- Add the mandatory failure-outcome step in `session.ts` after `dispatchBatch` and before the first `transport.respond`, retaining Phase 7's stable row order and cleanup rules.
- Extend the existing stub and its type/runtime tests; do not add a second consent-only transport fixture or export test helpers from production.

</code_context>

<specifics>
## Specific Ideas

- Treat the named sequence `review → delivery interrupted partway → genuinely new user turn → confirm` as the kernel's flagship regression case; it must end closed even though turn freshness alone passes.
- Prove CON-08 by reference identity as well as deep equality: the ack payload observed by the confirm handler is the frozen validated review payload object, not a fresh equivalent object.
- Cross-check receipt bytes and all three hash locations rather than trusting a matching string in one field.
- For a failed batch, assert the app-owned outcome sink completed before response attempt 1, and that no agent/model text entered the sink input.

</specifics>

<deferred>
## Deferred Ideas

- Server-side challenge issuance, durable replay storage, signature verification, and server effect execution remain v2; Phase 8 documents the required pattern but implements only the client assertion.
- Real OpenAI Realtime, WebMCP, MCP, or other vendor transports remain later work. Capability profiles and evidence remain modality-free.
- React and Svelte lifecycle wiring, including the real `$state.snapshot` adapter path, remains Phase 9.
- Persisting consent across process reloads, multi-device approval, TTL/expiry policy, and durable run-state serialization are not required for the bounded in-memory v0.1 kernel.

</deferred>

---

*Phase: 8-consent-kernel*
*Context gathered: 2026-08-10*
