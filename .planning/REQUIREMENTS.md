# Requirements — Concierge v0.1

**Milestone:** v0.1, the first publishable release.

**Scope rationale.** v0.1 is *core + consent + two adapters + packaging*. The consent kernel is in scope rather than deferred because framework-agnostic actuation became table stakes in 2026 and WebMCP is standardizing tool registration into the browser — a release with a catalog and dispatcher but no safety kernel is a strictly worse version of tools that already ship. Transports, server handlers, and devtools are deliberately v2; none are needed to prove the kernel, which is testable against a stub transport.

---

## v1 Requirements

### Catalog

- [ ] **CAT-01**: Developer declares an action once — name, description, schema, redaction, handler — and the name set, literal union type, per-stage catalogs, emitted JSON Schema, and redaction policy are all derived from that single declaration
- [ ] **CAT-02**: Catalog build throws, naming the offending action, when an action's emitted JSON Schema root is not `type: "object"`
- [ ] **CAT-03**: Catalog build throws when a `consent.requires` target does not exist in the catalog
- [ ] **CAT-04**: Catalog build throws when an action's `consent.minGrade` exceeds what the configured transport declares it can promise
- [ ] **CAT-05**: Catalog build emits a warning when an action declares `effects.destructive` without a consent policy
- [ ] **CAT-06**: Developer can supply an explicit `jsonSchema` for validators that do not implement Standard JSON Schema, and the catalog uses it in preference to derivation
- [ ] **CAT-07**: Action descriptions are rejected at build time if they are not static string literals available at module scope

### Dispatch

- [ ] **DSP-01**: A repeated call with the same `callId` inside the dedup window returns the *same Promise object by reference*, verifiable with `p1 === p2`
- [ ] **DSP-02**: Dedup falls back to a name+arguments key when `callId` is absent, and degrades to a no-dedup path rather than throwing when that key cannot be serialized
- [ ] **DSP-03**: A handler that throws returns `{ok: false, message: "Something went wrong."}` and the exception details reach neither the agent nor telemetry
- [ ] **DSP-04**: An action invoked with no registered handler returns an honest result rather than throwing
- [ ] **DSP-05**: Arguments are re-validated against the schema before the handler runs, independently of any validation the agent performed
- [ ] **DSP-06**: Malformed JSON in call arguments degrades to `{}` and is then rejected by validation, rather than crashing the dispatch loop
- [ ] **DSP-07**: A batch executes serially in `output_index` order, and every call in an aborted batch still produces a result so the agent is never left waiting
- [ ] **DSP-08**: A configurable commit window elapses before any non-read-only effect lands, and an abort during that window cancels the effect
- [ ] **DSP-09**: A handler returning a value that is not a valid `ActionResult` produces an honest failure rather than propagating the malformed value to the agent

### Bridge

- [ ] **BRG-01**: A page component registers `{actions, snapshot}` and receives an unsubscriber that removes the registration only if it is still the one it created
- [ ] **BRG-02**: A handler reads live app state through snapshot getters, returning current values after the app has updated without the bridge being re-registered
- [ ] **BRG-03**: A handler whose stage bridge is not mounted receives `bridge: null` and returns an honest off-page message
- [ ] **BRG-04**: A stale unregister from a remounted component cannot clear a newer registration
- [ ] **BRG-05**: Snapshots are detached from framework reactivity before storage, so a proxy-backed store cannot yield a stored snapshot that mutates with the app

### Stages

- [ ] **STG-01**: The catalog offered to the agent contains only the actions valid for the current stage, plus cross-stage actions
- [ ] **STG-02**: Stage matching is evaluated in declaration order, first match wins, and the order does not depend on stage naming
- [ ] **STG-03**: Stage matching evaluates arbitrary app context, not only pathname
- [ ] **STG-04**: `catalogFor` returns a memoized frozen array, so repeated calls with equivalent context yield a referentially identical result

### Consent

- [ ] **CON-01**: A gated action fails closed when no prior review armed consent
- [ ] **CON-02**: A gated action fails when invoked in the same user turn as its review, so an agent-generated follow-up cannot self-approve
- [ ] **CON-03**: Consent arms only after the review response is delivered to the human, never at the moment the review handler returns
- [ ] **CON-04**: Consent is invalidated when the reviewed snapshot and the snapshot at confirm time differ in any compared field
- [ ] **CON-05**: Consent is one-shot — a successful confirm, a fresh review, and a snapshot mismatch each destroy it
- [ ] **CON-06**: An interrupted or truncated delivery does not arm consent
- [ ] **CON-07**: `ConsentGrade` values name the hop actually measured, and a transport declaring a lower grade cannot satisfy an action requiring a higher one
- [ ] **CON-08**: The confirm handler receives the exact payload captured at review time, not a payload recomputed at confirm time
- [ ] **CON-09**: An action can distinguish an explicit human refusal from a dismissal, so the agent can choose whether re-offering is appropriate
- [ ] **CON-10**: A failed action's outcome reaches the human as the app composed it, not as the agent reauthored it — the agent cannot narrate a failure in its own words

### Session

- [ ] **SES-01**: A session pushes the current stage catalog to the transport on start, on stage change, and on reconnect
- [ ] **SES-02**: A session routes an incoming tool batch through dispatch and returns one result per call
- [ ] **SES-03**: A session carries turn identity and the delivery hook from the transport envelope through to the handler, so consent has the data it needs
- [ ] **SES-04**: Stopping a session unregisters cleanly and cancels in-flight work

### Transport

- [x] **TRN-01**: A transport is defined entirely by an interface with no vendor event names in core
- [ ] **TRN-02**: A stub transport with configurable capabilities exercises the full consent kernel without any network or WebRTC
- [ ] **TRN-03**: A transport that cannot derive turn identity is prevented from being used with `bindTo: "userTurn"`
- [ ] **TRN-04**: Concierge is usable with no transport at all, driven directly from an application's own agent loop
- [x] **TRN-05**: A transport declares the *provenance* of its turn identity, not merely whether it has one, and a transport whose turn identity can be minted by the agent's own output cannot satisfy the strongest user-turn binding

### Adapters

- [ ] **ADP-01**: A React adapter provides the instance in component scope and registers handlers and bridges with mount/unmount cleanup that survives StrictMode double-mount
- [ ] **ADP-02**: A Svelte adapter does the same, supplying `$state.snapshot` as the snapshot normalizer
- [ ] **ADP-03**: Each adapter's source stays within the stated size budget, enforced by a test that fails when logic leaks out of core
- [ ] **ADP-04**: Core imports cleanly in a server render under a metaframework, with no DOM globals touched at module scope

### Security

- [ ] **SEC-01**: Redaction is required at declaration time for any action with a non-empty schema, and an unspecified policy defaults to dropping arguments
- [ ] **SEC-02**: Telemetry never carries thrown error messages, only error class names
- [ ] **SEC-03**: The action registry is frozen after catalog build, so a handler cannot be replaced at runtime by third-party page script
- [ ] **SEC-04**: Documentation states, with a worked example, that client-side consent is an assertion the server must re-verify
- [ ] **SEC-05**: An action that reads attacker-controllable content declares it, and catalog build reports an action that does so without a consent policy
- [ ] **SEC-06**: `ActionResult.message` is sanitized before it leaves the dispatcher — control characters stripped, whitespace collapsed, and length capped

### Packaging

- [x] **PKG-01**: Published packages pass `publint` and `are-the-types-wrong` with no errors
- [x] **PKG-02**: A pack-and-install test imports the built artifact from a scratch project and typechecks against it
- [x] **PKG-03**: The declared Node floor matches the runtime the package actually works on
- [x] **PKG-04**: The package publishes ESM-only, and a test asserts a single core instance is shared across adapters
- [x] **PKG-05**: Core's runtime dependency footprint is verified to be zero-cost

### Developer experience

- [ ] **DX-01**: `concierge.explain()` reports the active stage, which bridges are registered, and the current catalog, so a developer can diagnose "why didn't my action fire" without a debugger
- [ ] **DX-02**: An action can run against DOM or router state with no bridge registered, so an app gets value before instrumenting its components
- [ ] **DX-03**: Every build-time error names the offending action and states the fix

---

## v2 Requirements

Deferred to v0.2–v0.4. Each is understood, none is needed to prove the kernel.

- Fetch-standard server handlers mounting unchanged across metaframeworks
- Server-side consent verification endpoint
- Devtools overlay with manual action firing
- OpenAI Realtime / WebRTC transport
- WebMCP transport over `document.modelContext`
- MCP server executor
- Vue and Angular adapters
- Documented pattern and reference example for server-rendered stacks (Rails, Laravel, Phoenix)

---

## Out of Scope

- **Generic actuation primitives** (`click`, `execute_js`, coordinate tools) — FSB's job; on an owned DOM they add attack surface for no benefit, and a generic escape hatch destroys the catalog-as-security-boundary property
- **Third-party site automation** — different product class with ToS, captcha, and 2FA exposure
- **Voice as the primary framing** — voice is one transport
- **Competing with WebMCP on registration** — it becomes a transport instead
- **A `concierge-zod` bridge package** — Standard JSON Schema makes it largely unnecessary; the `jsonSchema?` escape hatch covers the gap
- **Dual ESM/CJS publishing** — the dual-package hazard splits the registry, dedup window, and consent kernel
- **Generative UI / `render` props on actions** — pulls DOM concerns into a DOM-free core
- **A chat UI or an agent loop** — adjacent products that would compromise transport-agnosticism
- **Credential or payment entry by agent** — structurally refused; MCP's own spec normatively requires URL-mode handoff for these

---

## Traceability

All 62 v1 requirements are mapped to exactly one phase in ROADMAP.md. No orphans, no duplicates.

**Amended 2026-07-27**, during Phase 1 discussion. Five requirements were added after two sources of
evidence the original 57 did not have:

- **Advisor research on the Phase 1 gray areas** produced SEC-05 — the `readsUntrusted` marker is
  only honest if something enforces it.
- **A second prior implementation** was located and read: the `portfolio` repository, branch
  `audit-fsb-ai-control-loop` (2026-07-16). It is a shipped in-app AI control loop with typed action
  results, and it supplied DSP-09, SEC-06, CON-10, and TRN-05. This is distinct from the
  `voyza-voice-browser-control-spec.md` provenance recorded in PROJECT.md — a second, independent
  system that reached many of the same conclusions.

TRN-05 is the one that could not have waited: `TransportCapabilities` is an interface consumers
*implement*, so widening it after publish is a breaking change, unlike the other four.

| REQ-ID | Phase | Status |
|---|---|---|
| CAT-01 | Phase 3 — Action declaration and build-time validation | Pending |
| CAT-02 | Phase 3 — Action declaration and build-time validation | Pending |
| CAT-03 | Phase 4 — Stages, catalog assembly, and explain() | Pending |
| CAT-04 | Phase 8 — Consent kernel | Pending |
| CAT-05 | Phase 3 — Action declaration and build-time validation | Pending |
| CAT-06 | Phase 3 — Action declaration and build-time validation | Pending |
| CAT-07 | Phase 3 — Action declaration and build-time validation | Pending |
| DSP-01 | Phase 6 — Dispatcher | Pending |
| DSP-02 | Phase 6 — Dispatcher | Pending |
| DSP-03 | Phase 6 — Dispatcher | Pending |
| DSP-04 | Phase 6 — Dispatcher | Pending |
| DSP-05 | Phase 6 — Dispatcher | Pending |
| DSP-06 | Phase 6 — Dispatcher | Pending |
| DSP-07 | Phase 6 — Dispatcher | Pending |
| DSP-08 | Phase 6 — Dispatcher | Pending |
| DSP-09 | Phase 6 — Dispatcher | Pending |
| BRG-01 | Phase 5 — Bridge registry and the no-bridge path | Pending |
| BRG-02 | Phase 5 — Bridge registry and the no-bridge path | Pending |
| BRG-03 | Phase 5 — Bridge registry and the no-bridge path | Pending |
| BRG-04 | Phase 5 — Bridge registry and the no-bridge path | Pending |
| BRG-05 | Phase 5 — Bridge registry and the no-bridge path | Pending |
| STG-01 | Phase 4 — Stages, catalog assembly, and explain() | Pending |
| STG-02 | Phase 4 — Stages, catalog assembly, and explain() | Pending |
| STG-03 | Phase 4 — Stages, catalog assembly, and explain() | Pending |
| STG-04 | Phase 4 — Stages, catalog assembly, and explain() | Pending |
| CON-01 | Phase 8 — Consent kernel | Pending |
| CON-02 | Phase 8 — Consent kernel | Pending |
| CON-03 | Phase 8 — Consent kernel | Pending |
| CON-04 | Phase 8 — Consent kernel | Pending |
| CON-05 | Phase 8 — Consent kernel | Pending |
| CON-06 | Phase 8 — Consent kernel | Pending |
| CON-07 | Phase 8 — Consent kernel | Pending |
| CON-08 | Phase 8 — Consent kernel | Pending |
| CON-09 | Phase 8 — Consent kernel | Pending |
| CON-10 | Phase 8 — Consent kernel | Pending |
| SES-01 | Phase 7 — Session and the transport seam | Pending |
| SES-02 | Phase 7 — Session and the transport seam | Pending |
| SES-03 | Phase 7 — Session and the transport seam | Pending |
| SES-04 | Phase 7 — Session and the transport seam | Pending |
| TRN-01 | Phase 1 — Type surface completion | Complete |
| TRN-02 | Phase 7 — Session and the transport seam | Pending |
| TRN-03 | Phase 8 — Consent kernel | Pending |
| TRN-04 | Phase 6 — Dispatcher | Pending |
| TRN-05 | Phase 1 — Type surface completion | Complete |
| ADP-01 | Phase 9 — React and Svelte adapters | Pending |
| ADP-02 | Phase 9 — React and Svelte adapters | Pending |
| ADP-03 | Phase 9 — React and Svelte adapters | Pending |
| ADP-04 | Phase 9 — React and Svelte adapters | Pending |
| SEC-01 | Phase 3 — Action declaration and build-time validation | Pending |
| SEC-02 | Phase 6 — Dispatcher | Pending |
| SEC-03 | Phase 4 — Stages, catalog assembly, and explain() | Pending |
| SEC-04 | Phase 8 — Consent kernel | Pending |
| SEC-05 | Phase 3 — Action declaration and build-time validation | Pending |
| SEC-06 | Phase 6 — Dispatcher | Pending |
| PKG-01 | Phase 2 — Packaging, build, and release | Complete |
| PKG-02 | Phase 2 — Packaging, build, and release | Complete |
| PKG-03 | Phase 2 — Packaging, build, and release | Complete |
| PKG-04 | Phase 2 — Packaging, build, and release | Complete |
| PKG-05 | Phase 2 — Packaging, build, and release | Complete |
| DX-01 | Phase 4 — Stages, catalog assembly, and explain() | Pending |
| DX-02 | Phase 5 — Bridge registry and the no-bridge path | Pending |
| DX-03 | Phase 3 — Action declaration and build-time validation | Pending |
