# Requirements — Concierge v0.1

**Milestone:** v0.1, the first publishable release.

**Scope rationale.** v0.1 is *core + consent + two adapters + packaging*. The consent kernel is in scope rather than deferred because framework-agnostic actuation became table stakes in 2026 and WebMCP is standardizing tool registration into the browser — a release with a catalog and dispatcher but no safety kernel is a strictly worse version of tools that already ship. Transports, server handlers, and devtools are deliberately v2; none are needed to prove the kernel, which is testable against a stub transport.

---

## v1 Requirements

### Catalog

- [x] **CAT-01**: Developer declares an action once — name, description, schema, redaction, handler — and the name set, literal union type, per-stage catalogs, emitted JSON Schema, and redaction policy are all derived from that single declaration
- [x] **CAT-02**: Catalog build throws, naming the offending action, when an action's emitted JSON Schema root is not `type: "object"`
- [ ] **CAT-03**: Catalog build throws when a `consent.requires` target does not exist in the catalog
- [x] **CAT-04**: Catalog build throws when an action's `consent.minGrade` exceeds what the configured transport declares it can promise
- [x] **CAT-05**: Catalog build emits a warning when an action declares `effects.destructive` without a consent policy
- [x] **CAT-06**: Developer can supply an explicit `jsonSchema` for validators that do not implement Standard JSON Schema, and the catalog uses it in preference to derivation
- [x] **CAT-07**: Action descriptions are rejected at build time if they are not static string literals available at module scope

### Dispatch

- [x] **DSP-01**: A repeated call with the same `callId` inside the dedup window returns the *same Promise object by reference*, verifiable with `p1 === p2`
- [x] **DSP-02**: Dedup falls back to a name+arguments key when `callId` is absent, and degrades to a no-dedup path rather than throwing when that key cannot be serialized
- [x] **DSP-03**: A handler that throws returns `{ok: false, message: "Something went wrong."}` and the exception details reach neither the agent nor telemetry
- [x] **DSP-04**: An action invoked with no registered handler returns an honest result rather than throwing
- [x] **DSP-05**: Arguments are re-validated against the schema before the handler runs, independently of any validation the agent performed
- [x] **DSP-06**: Malformed JSON in call arguments degrades to `{}` and is then rejected by validation, rather than crashing the dispatch loop
- [x] **DSP-07**: A batch executes serially in `output_index` order, and every call in an aborted batch still produces a result so the agent is never left waiting
- [x] **DSP-08**: A configurable commit window elapses before any non-read-only effect lands, and an abort during that window cancels the effect
- [x] **DSP-09**: A handler returning a value that is not a valid `ActionResult` produces an honest failure rather than propagating the malformed value to the agent

### Bridge

- [x] **BRG-01**: A page component registers `{actions, snapshot}` and receives an unsubscriber that removes the registration only if it is still the one it created
- [x] **BRG-02**: A handler reads live app state through snapshot getters, returning current values after the app has updated without the bridge being re-registered
- [x] **BRG-03**: A handler whose stage bridge is not mounted receives `bridge: null` and returns an honest off-page message
- [x] **BRG-04**: A stale unregister from a remounted component cannot clear a newer registration
- [x] **BRG-05**: Snapshots are detached from framework reactivity before storage, so a proxy-backed store cannot yield a stored snapshot that mutates with the app

### Stages

- [ ] **STG-01**: The catalog offered to the agent contains only the actions valid for the current stage, plus cross-stage actions
- [ ] **STG-02**: Stage matching is evaluated in declaration order, first match wins, and the order does not depend on stage naming
- [ ] **STG-03**: Stage matching evaluates arbitrary app context, not only pathname
- [ ] **STG-04**: `catalogFor` returns a memoized frozen array, so repeated calls with equivalent context yield a referentially identical result

### Consent

- [x] **CON-01**: A gated action fails closed when no prior review armed consent
- [x] **CON-02**: A gated action fails when invoked in the same user turn as its review, so an agent-generated follow-up cannot self-approve
- [x] **CON-03**: Consent arms only after the review response is delivered to the human, never at the moment the review handler returns
- [x] **CON-04**: Consent is invalidated when the reviewed snapshot and the snapshot at confirm time differ in any compared field
- [x] **CON-05**: Consent is one-shot — a successful confirm, a fresh review, and a snapshot mismatch each destroy it
- [x] **CON-06**: An interrupted or truncated delivery does not arm consent
- [x] **CON-07**: `ConsentGrade` values name the hop actually measured, and a transport declaring a lower grade cannot satisfy an action requiring a higher one
- [x] **CON-08**: The confirm handler receives the exact payload captured at review time, not a payload recomputed at confirm time
- [x] **CON-09**: An action can distinguish an explicit human refusal from a dismissal, so the agent can choose whether re-offering is appropriate
- [x] **CON-10**: A failed action's outcome reaches the human as the app composed it, not as the agent reauthored it — the agent cannot narrate a failure in its own words

### Session

- [x] **SES-01**: A session pushes the current stage catalog to the transport on start, on stage change, and on reconnect
- [x] **SES-02**: A session routes an incoming tool batch through dispatch and returns one result per call
- [x] **SES-03**: A session carries turn identity and the delivery hook from the transport envelope through to the handler, so consent has the data it needs
- [x] **SES-04**: Stopping a session unregisters cleanly and cancels in-flight work

### Transport

- [x] **TRN-01**: A transport is defined entirely by an interface with no vendor event names in core
- [x] **TRN-02**: A stub transport with configurable capabilities exercises the full consent kernel without any network or WebRTC
- [x] **TRN-03**: A transport that cannot derive turn identity is prevented from being used with `bindTo: "userTurn"`
- [x] **TRN-04**: Concierge is usable with no transport at all, driven directly from an application's own agent loop
- [x] **TRN-05**: A transport declares the *provenance* of its turn identity, not merely whether it has one, and a transport whose turn identity can be minted by the agent's own output cannot satisfy the strongest user-turn binding

### Adapters

- [ ] **ADP-01**: A React adapter provides the instance in component scope and registers handlers and bridges with mount/unmount cleanup that survives StrictMode double-mount
- [ ] **ADP-02**: A Svelte adapter does the same, supplying `$state.snapshot` as the snapshot normalizer
- [ ] **ADP-03**: Each adapter's source stays within the stated size budget, enforced by a test that fails when logic leaks out of core
- [ ] **ADP-04**: Core imports cleanly in a server render under a metaframework, with no DOM globals touched at module scope

### Security

- [x] **SEC-01**: Redaction is required at declaration time for any action with a non-empty schema, and an unspecified policy defaults to dropping arguments
- [x] **SEC-02**: Telemetry never carries thrown error messages, only error class names
- [ ] **SEC-03**: The action registry is frozen after catalog build, so a handler cannot be replaced at runtime by third-party page script
- [x] **SEC-04**: Documentation states, with a worked example, that client-side consent is an assertion the server must re-verify
- [x] **SEC-05**: An action that reads attacker-controllable content declares it, and catalog build reports an action that does so without a consent policy
- [x] **SEC-06**: `ActionResult.message` is sanitized before it leaves the dispatcher — control characters stripped, whitespace collapsed, and length capped

### Packaging

- [x] **PKG-01**: Published packages pass `publint` and `are-the-types-wrong` with no errors
- [x] **PKG-02**: A pack-and-install test imports the built artifact from a scratch project and typechecks against it
- [x] **PKG-03**: The declared Node floor matches the runtime the package actually works on
- [x] **PKG-04**: The package publishes ESM-only, and a test asserts a single core instance is shared across adapters
- [x] **PKG-05**: Core's runtime dependency footprint is verified to be zero-cost

### Developer experience

- [ ] **DX-01**: `concierge.explain()` reports the active stage, which bridges are registered, and the current catalog, so a developer can diagnose "why didn't my action fire" without a debugger
- [x] **DX-02**: An action can run against DOM or router state with no bridge registered, so an app gets value before instrumenting its components
- [x] **DX-03**: Every build-time error names the offending action and states the fix

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
| CAT-01 | Phase 3 — Action declaration and build-time validation; **closed by Phase 4 — Stages, catalog assembly, and explain()** | Complete — Phase 3 shipped 4/5 derived artifacts; the fifth, `per-stage catalogs`, ships as `createConcierge().catalogFor` (plan 04-03, exported and implemented). Evidence: 04-05 S1/S2 |
| CAT-02 | Phase 3 — Action declaration and build-time validation | Complete |
| CAT-03 | Phase 4 — Stages, catalog assembly, and explain() | Pending |
| CAT-04 | Phase 8 — Consent kernel | Complete — 08-02 C27-C29 enforce the inherent delivered floor and aggregate grade/provenance/seam faults; M-08-C01/C04/C07 independently kill floor and capability regressions. |
| CAT-05 | Phase 3 — Action declaration and build-time validation | Complete |
| CAT-06 | Phase 3 — Action declaration and build-time validation | Complete |
| CAT-07 | Phase 3 — Action declaration and build-time validation | Complete |
| DSP-01 | Phase 6 — Dispatcher | Complete — R01/R02 prove valid string callIds retain exact same-Promise identity and failure reuse; R68 proves malformed metadata is contained as one honest result rather than being deduplicated or escaping. M-06-S01…S04/S35 discriminate these boundaries. |
| DSP-02 | Phase 6 — Dispatcher | Complete — R05/R06/R69 prove cyclic, BigInt, and equal aliased arguments do not throw and do not deduplicate; R06a/R06b retain injective, prototype-safe collision evidence for keyable values. M-06-S07/S36/S37 discriminate the no-dedup boundary. |
| DSP-03 | Phase 6 — Dispatcher | Complete — R34…R36 prove sync throws and rejections return only the generic authored result and leak no marker to result or console; M-06-S25 kills exception echo. |
| DSP-04 | Phase 6 — Dispatcher | Complete — R09…R12 prove prototype names, absent handlers, and non-callable handlers settle honestly without entering application code. |
| DSP-05 | Phase 6 — Dispatcher | Complete — R13…R18 prove sync/async validation, transformed arguments, and contained validator failures; M-06-S16/S17 kill bypass and original-argument regressions. |
| DSP-06 | Phase 6 — Dispatcher | Complete — Q04 proves malformed JSON becomes an empty object, reaches rejecting and defaulting validation, cannot enter the handler, and later calls continue; Q05 keeps valid primitives intact. M-06-B05/B06 kill uncaught-parse and provenance-bypass regressions. |
| DSP-07 | Phase 6 — Dispatcher | Complete — Q01…Q03 and Q07…Q19 prove copied stable ordering, strict seriality, correlation, abort completeness, dedup reuse, and row-local containment of malformed metadata; Q17 proves malformed call metadata still yields one correlated row, while Q16 proves immutable nested batch results across cached retries. M-06-B01…B24 discriminate those boundaries, including exact B22→Q16 and B23/B24→Q17 mappings. |
| DSP-08 | Phase 6 — Dispatcher | Complete — R20…R33, R71/R72, and Q10…Q12 prove both 600 ms defaults, settlement-based expiry, commit waits, abort cancellation, cleanup, scheduler fallback, and buffered synchronous registration before canceller validation; M-06-S12/S13/S18…S23/S38 kill timing, cleanup, and premature-settlement regressions. |
| DSP-09 | Phase 6 — Dispatcher | Complete — R37…R45 normalize scalars, null, bad fields/getters/proxies/reasons, strip extras, and preserve the closed reason vocabulary; M-06-S26…S29 kill pass-through and contradiction regressions. |
| BRG-01 | Phase 5 — Bridge registry and the no-bridge path | Complete — all thirteen mount/unmount orderings asserted against `dist/index.js`; discrimination proven by M-05-1 and M-05-2. Evidence: 05-04 B1–B13, 05-07 mutation battery |
| BRG-02 | Phase 5 — Bridge registry and the no-bridge path | Complete — `register()` stores the bridge as given and `read()` returns it by reference, so getters stay live across an app state change. Evidence: 05-04 B14/B15 |
| BRG-03 | Phase 5 — Bridge registry and the no-bridge path | Complete — Phase 5 proves registry resolution and honest `no_bridge` handling (05-05 D14–D19, M-05-12…M-05-14); Phase 6 closes the real-dispatch join: R52 passes the mounted live bridge, R53 resolves an absent bridge to `null` at the handler, R54 turns a throwing `read()` into `null`, and M-06-S24 kills `resolveBridge` bypass. |
| BRG-04 | Phase 5 — Bridge registry and the no-bridge path | Complete — the unsubscriber is guarded on a monotonic token, so a stale cleanup is refused even when the replacement is `===` the original. M-05-1 reddens exactly the four discriminating orderings. Evidence: 05-04 B10–B13 |
| BRG-05 | Phase 5 — Bridge registry and the no-bridge path | Complete — a structural clone detaches an accessor-backed `Proxy` while leaving the host store unfrozen; discriminated by M-05-3, M-05-4, M-05-5, M-05-6, M-05-9. The framework half (React StrictMode, Svelte `$state.snapshot`) is Phase 9's. Evidence: 05-05 D1–D13 |
| STG-01 | Phase 4 — Stages, catalog assembly, and explain() | Pending |
| STG-02 | Phase 4 — Stages, catalog assembly, and explain() | Pending |
| STG-03 | Phase 4 — Stages, catalog assembly, and explain() | Pending |
| STG-04 | Phase 4 — Stages, catalog assembly, and explain() | Pending |
| CON-01 | Phase 8 — Consent kernel | Complete — 08-03 K01 and the 08-06 public fixture flow fail closed without a review; M-08-G01 proves the ledger guard is load-bearing. |
| CON-02 | Phase 8 — Consent kernel | Complete — 08-03 K14 rejects same or forgeable boundaries while preserving a later genuine turn; M-08-G06 kills the boundary bypass. |
| CON-03 | Phase 8 — Consent kernel | Complete — 08-03 K03-K08 arm only from an owned completed delivery; M-08-G01..G04 kill review-return, interrupted, stale, and ownership defects. |
| CON-04 | Phase 8 — Consent kernel | Complete — 08-03 K17-K20 compare a late detached snapshot and destroy on mismatch or throw; M-08-G07..G10 discriminate the boundary. |
| CON-05 | Phase 8 — Consent kernel | Complete — 08-03 K09/K12/K17/K22-K26 prove fresh-review replacement, shared one-shot authority, consume-before-handler, and terminal destruction; the corresponding G mutants are green. |
| CON-06 | Phase 8 — Consent kernel | Complete — 08-03 K04 and the 08-06 interrupted-delivery then genuine-new-turn flagship stay closed; M-08-G02 removes that guard and is killed. |
| CON-07 | Phase 8 — Consent kernel | Complete — 08-02 through 08-05 enforce capability ceilings, the delivered floor, runtime none guard, occurrence-derived grades, actual-transport dominance, and terminal rejection of incomplete or contradictory attempted attestation; shared-gate E14 and M-08-E15 prove corrupted evidence cannot downgrade into relayed authority. M-08-G15 and C01/C04..C07 remain green. |
| CON-08 | Phase 8 — Consent kernel | Complete — 08-03 K21 proves the frozen ack reuses the exact validated review payload object; M-08-G11 kills recomputation. |
| CON-09 | Phase 8 — Consent kernel | Complete — 08-03 K24 and 08-04 E04 preserve exact declined versus cancelled outcomes and never arm; M-08-G13/G14 and E05/E06 are green. |
| CON-10 | Phase 8 — Consent kernel | Complete — 08-05 S05-S07/J04 await one immutable app-authored outcome before response, withhold interrupted rows, and never retry; M-08-O01..O07 are green. |
| SES-01 | Phase 7 — Session and the transport seam | Complete — C01-C22 plus M-07-C01..C16/M-07-R03..R04 prove start, stage-change, reconnect, latest-wins queued/active/confirmed authority, abandoned-attempt cleanup, current/stale boundary progress, and failed-request reconciliation. |
| SES-02 | Phase 7 — Session and the transport seam | Complete — C11-C22/J01-J06/J15-J18 plus M-07-C05/C06/C09..C16 and M-07-R01/R06/R07/R08/R09 prove one FIFO dispatch occurrence and one stable response attempt per call, including progress across accessor supersession, boundary failure, requested-generation changes, and confirmed replay. |
| SES-03 | Phase 7 — Session and the transport seam | Complete — J07-J18 plus M-07-R02..R05/R09 prove arrival identity, lazy envelope forwarding, delivery-hook preservation, signal composition, and direct-dispatch parity. |
| SES-04 | Phase 7 — Session and the transport seam | Complete — C07-C22 and L01-L18 plus M-07-C07..C16/M-07-L02/L07/M-07-D02 prove stop-first invalidation, exact queued/unresolved detachment, cleanup, cancellation identity, reentrancy containment, and no post-stop output. |
| TRN-01 | Phase 1 — Type surface completion | Complete |
| TRN-02 | Phase 7 — Session and the transport seam; closed by Phase 8 — Consent kernel | Complete — 08-06 extends the exact Phase 7 six-key fixture with sibling-only delivery, attestation, outcome, and ordering controls and drives the full public kernel without network; M-08-P01/P02 plus the foreign tarball gate prove it remains test-only. |
| TRN-03 | Phase 8 — Consent kernel | Complete — 08-02 C29 and 08-05 S02 reject missing or weak human-turn provenance at build and actual-session boundaries; M-08-C02/C03/C05/C06 are green. |
| TRN-04 | Phase 6 — Dispatcher | Complete — R19 drives one action and Q14 drives a batch directly from an application loop without constructing a Transport; the complete 62-row mutation register remains green. |
| TRN-05 | Phase 1 — Type surface completion; runtime proof in Phase 8 — Consent kernel | Complete — 08-05 S02 proves the actual captured transport provenance must dominate the Concierge profile before subscription, publication, or batch effects; M-08-C05/C06 kill runtime dominance defects. |
| ADP-01 | Phase 9 — React and Svelte adapters | Pending |
| ADP-02 | Phase 9 — React and Svelte adapters | Pending |
| ADP-03 | Phase 9 — React and Svelte adapters | Pending |
| ADP-04 | Phase 9 — React and Svelte adapters | Pending |
| SEC-01 | Phase 3 — Action declaration and build-time validation | Complete |
| SEC-02 | Phase 6 — Dispatcher | Complete structurally — the TypeScript AST audit parses all 11 production files and proves Phase 6 defines no telemetry/onTelemetry/onError channel or emission and no bound exception forwarding path. R34…R36 prove at runtime that handler exception text reaches neither `ActionResult` nor console; M-06-S25 kills exception echo. |
| SEC-03 | Phase 4 — Stages, catalog assembly, and explain() | Pending overall under Phase 4's recorded consumer-supplied `jsonSchema` getter carve-out. Phase 6 completes the dispatch-side lookup proof without remapping the requirement: R09/R10 execute zero handlers for `__proto__`/`constructor`, and M-06-S15 kills a prototype-bearing lookup. |
| SEC-04 | Phase 8 — Consent kernel | Complete — 08-08 root README P03/P04 tests require untrusted-client wording and current-policy exact-action reauthorization immediately before the guarded effect; M-08-P03/P04 are green. |
| SEC-05 | Phase 3 — Action declaration and build-time validation | Complete |
| SEC-06 | Phase 6 — Dispatcher | Complete — R47…R51 prove C0/C1 replacement, whitespace normalization, the shared length cap, surrogate-pair preservation, and fresh sanitized constants; M-06-S30…S33 kill every sanitizer boundary. |
| PKG-01 | Phase 2 — Packaging, build, and release | Complete |
| PKG-02 | Phase 2 — Packaging, build, and release | Complete |
| PKG-03 | Phase 2 — Packaging, build, and release | Complete |
| PKG-04 | Phase 2 — Packaging, build, and release | Complete |
| PKG-05 | Phase 2 — Packaging, build, and release | Complete |
| DX-01 | Phase 4 — Stages, catalog assembly, and explain() | Pending |
| DX-02 | Phase 5 — Bridge registry and the no-bridge path | Complete — proven in both variants: a stage declaring no bridge, and a stage declaring one with nothing registered. Both run their handler, which returns `{ok:true}` with `ctx.bridge` null; core never auto-fails an action over an unmounted bridge. Evidence: 05-05 D20/D21, 05-02 `resolveBridge` |
| DX-03 | Phase 3 — Action declaration and build-time validation | Complete |
