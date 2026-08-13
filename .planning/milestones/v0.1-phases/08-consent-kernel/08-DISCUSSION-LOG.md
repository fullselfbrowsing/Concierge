# Phase 8: Consent kernel - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `08-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 8-consent-kernel
**Mode:** `--auto`, advisor research, standard calibration
**Owner framing:** Technical; `NON_TECHNICAL_OWNER=false` because the developer profile contains no non-technical-owner signal
**Areas discussed:** Consent kernel state machine, attested readback and capability evidence, session outcome and human failure readback

`[--auto] Selected all gray areas: Consent kernel state machine; Attested readback and capability evidence; Session outcome and human failure readback.`

---

## Consent Kernel State Machine

| Option | Pros | Cons | Complexity | Recommendation | Selected |
|--------|------|------|------------|----------------|----------|
| Lazy per-`createConcierge` ledger keyed by review action name | Directly matches `ConsentPolicy.requires`; globally unique action names make the key sufficient; one review stays genuinely one-shot; no reverse index | Shared review actions intentionally compete for one consent; needs generation guards against synchronous/late delivery and concurrent confirm | Kernel module plus `concierge.ts` and focused tests; medium state-machine risk | Recommended when one completed review may authorize at most one consequential handler | ✓ |
| Ledger keyed by confirm action name plus review-to-confirm reverse index | Independent slots for every gated action | One review fans out into several consumable consents; fresh-review invalidation becomes multi-key; weaker one-shot interpretation | More public/private indexing and stale-child cleanup; high ambiguity risk | Use only if one review is deliberately meant to approve several actions | |

`[auto] [Consent kernel state machine] — Q: "Where should one-shot review-to-confirm authority live and how should it transition?" → Selected: "Lazy per-createConcierge ledger keyed by review action name" (recommended default).`

**Choice:** Factory-local, lazy, review-keyed state with generation-guarded review, pending-delivery, armed, and consuming transitions inside the deduplicated dispatch pipeline.

**Notes:** The same-turn attempt fails before consumption; fresh review and snapshot drift invalidate; handler entry consumes one-shot authority; exact validated review payload and detached snapshot are carried into the ack. `declined` and `cancelled` remain distinct and require a fresh review before any re-offer can run.

---

## Attested Readback and Capability Evidence

| Option | Pros | Cons | Complexity | Recommendation | Selected |
|--------|------|------|------------|----------------|----------|
| Concierge-owned evidence ledger plus declared consent profile | Preserves `createConcierge` / `createSession` separation and transportless dispatch; lets catalog construction fail closed; core owns JCS/UTF-8 verification; keeps presentation and observation separate | Adds a minimal declaration beside the real transport; session must prove the actual transport dominates it | `types.ts`, catalog, concierge, session, canonicalizer/kernel modules, and tests; capability-drift risk must be checked | Recommended while CAT-04, TRN-04, and the separate factories remain locked | ✓ |
| Capability-bound dispatch runner | One capability authority per runner; cannot dispatch gated actions before binding | Moves literal CAT-04 rejection away from catalog build; raw `Concierge.dispatch` must change; multiple runners can split one-shot state | New public handle and kernel ownership model; high bypass/split-state risk | Consider only if current direct dispatch may be replaced | |
| Core-issued per-dispatch evidence token | Handles changing capabilities per invocation | Capability data enters hostile invocation metadata; replay and dedupe interactions become token-ledger problems; cannot satisfy literal catalog-build rejection | Token issuer, replay ledger, envelope changes, and extensive tests; highest risk | Not appropriate for v0.1 | |

`[auto] [Attested readback and capability evidence] — Q: "How should core prove an attested readback and reject capability mismatches without coupling createConcierge to a Transport?" → Selected: "Concierge-owned evidence ledger plus declared consent profile" (recommended default).`

**Choice:** Freeze a minimal profile at `createConcierge`, reject catalog policies it cannot satisfy, validate the real session transport before side effects, and derive actual grade from observed evidence. Core verifies RFC 8785 bytes and injected SHA-256; a separate `ReadbackAttestation` binds the human act to the hash.

**Notes:** `attested` requires completed delivery, a core-verified receipt, and a matching one-shot confirmed act. A capability declaration, receipt, or hash alone can never grant it. External references consulted by the advisor were RFC 8785 and WebAuthn Level 3.

---

## Session Outcome and Human Failure Readback

| Option | Pros | Cons | Complexity | Recommendation | Selected |
|--------|------|------|------------|----------------|----------|
| Required batch-level `SessionConfig` outcome sink | Keeps `Transport.respond` unchanged; preserves app-owned presentation; one frozen stable-order failure readback can complete before any agent response; vendor/DOM neutral | Async presentation can delay the FIFO drain; a failing sink needs a strict fail-closed policy | `types.ts`, `session.ts`, stub, export/type pins; dispatch remains unchanged | Recommended when the app owns the human surface and Phase 7's transport contract should remain intact | ✓ |
| Required `Transport` outcome hook | Co-locates presentation with a modality-specific channel and fits the stub naturally | Conflates agent transport with app presentation; headless or indirect transports must fake/delegate the human surface; widens every transport | Transport/session contracts and every fixture/shape pin; higher adapter-misreporting risk | Consider only if every transport genuinely owns direct human presentation | |

`[auto] [Session outcome and human failure readback] — Q: "What is the smallest transport-neutral contract that prevents the agent from reauthoring a failed action?" → Selected: "Required batch-level SessionConfig outcome sink" (recommended default).`

**Choice:** The session presents one immutable batch of exact sanitized failures through an app-owned sink, waits for completion, then returns the original correlated results through `Transport.respond`. No model text is accepted. Interrupted/failed presentation stops release to the agent and never retries automatically.

**Notes:** Preserve `declined` versus `cancelled` exactly in both channels. This is intentionally separate from the consent delivery hook: it protects every app-authored failure, including ungated actions.

---

## Claude's Discretion

- Internal module/type names, safe diagnostic wording, state tag spelling, and test partitioning.
- Whether the minimal profile is a named interface or a narrow readonly projection.
- Whether a failed outcome sink stops the accepted occurrence or the entire session, provided no agent result escapes first.

## Deferred Ideas

- Server challenge issuance/verification, durable replay storage, and server-side effects remain v2.
- Real vendor transports remain later roadmap work; React/Svelte adapters remain Phase 9.
- Durable or cross-device consent, TTL policy, and run-state persistence remain out of v0.1 scope.
