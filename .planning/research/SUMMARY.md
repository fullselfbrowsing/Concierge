# Project Research Summary

**Project:** Concierge
**Domain:** Framework-agnostic TypeScript SDK family — consent-gated, in-app AI agent actuation
**Researched:** 2026-07-27
**Confidence:** HIGH

---

## Executive Summary

**The product thesis moved while the design was being captured.** Framework-agnostic actuation is no longer a differentiator — it is table stakes, and Concierge arrives after the incumbents. `@copilotkit/core` (framework-agnostic runtime, npm-created 2026-03-29) plus first-party Angular, Vue, and web-component adapters shipped in the last four months. `@assistant-ui/core` published a framework-agnostic core on 2026-07-26, the day before this research. And WebMCP — a W3C proposal edited by Google and Microsoft engineers — is standardizing typed tool registration *into Chrome itself* via `document.modelContext.registerTool()`, in public origin trial since Chrome 149 (announced 2026-05-19). PROJECT.md's Key Decision "ship a non-React adapter *with* v0.1" is still **correct** (it prevents a hooks-shaped core) but must be re-labeled a cost of entry, not an advantage. Roadmap budget allocated to framework breadth should move to the kernel.

**What remains defensible is the consent and safety kernel — and the research found that the kernel as currently designed is half theater.** Graded consent, build-time transport-mismatch failure, user-turn binding, snapshot-equality invalidation, delivery-armed consent, reference-identity dedup, and mandatory fail-closed redaction were each checked against CopilotKit v2, Vercel AI SDK 6, OpenAI Agents SDK (JS), the MCP `2025-11-25` schema, and the WebMCP explainer. **Nobody has any of them.** Everyone has a confirmation boolean; WebMCP lists consent as unresolved Open Question #165. But PITFALLS traced the actual bytes and found the flagship claim broken: `ActionResult.message` reaches the human **through the model**. The dispatcher hands the result to `transport.respond()`, which becomes a `function_call_output` item, and then the *model generates the audio the human hears*. So `consentGrade: "perceived"` currently asserts "some audio finished playing," not "the audio contained $4,180, Tuesday, non-refundable." That is OWASP ASI09 (Human-Agent Trust Exploitation) precisely, whose prescribed mitigation — *"forced, explicit confirmations that show the raw action rather than the agent's summary"* — is the one thing the design does not do. Compounding it, barge-in on OpenAI Realtime **truncates the readback and mints a genuinely new user turn in the same gesture**, so the most natural human behaviour in a voice UI both defeats perception and satisfies the gate.

**The recommended approach:** fix the committed type surface first, move the consent kernel into v0.1, and re-point the grade at the correct hop by giving core an app-owned **readback sink** that the model never touches. Regrade the vocabulary to `relayed` < `delivered` < `perceived`, where only an app-rendered channel can grant `perceived`, and bind `ConsentAck` to a `readbackHash` as well as a payload snapshot. Everything else in the roadmap is subordinate: an actuation library without a working kernel is a strictly worse CopilotKit, and PROJECT.md already states the principle — *"A library that makes agent actuation easy but consent optional is worse than nothing, because it will be used."* A v0.1 without consent **is** that library. Ship the kernel; keep the surface small; be the layer everyone else left out.

---

## Concierge's Defensible Position, In One Paragraph

Concierge is not the layer that lets an agent act — the browser will do that for free, and two funded competitors already do. **Concierge is the layer that decides whether the act is allowed to happen, and can prove that a human, not the agent, approved the specific thing that happened.** That is a real moat because it requires three things nobody else has built: the readback must leave the model's path entirely and be rendered by the app; consent must bind to a user turn that was a *deliberate response* rather than an interruption; and the wiring must **refuse to compile** when the transport cannot support the claim the action makes. The pitch is one sentence — *"Your booking confirmation refuses to build on a transport that can't prove the human heard it"* — and it is the only sentence in this space that no competitor can say. WebMCP strengthens rather than threatens this: it makes tool registration free and leaves consent explicitly unspecified, which turns it into transport #3 and makes the positioning write itself — **WebMCP is how the browser asks; Concierge is what decides whether to answer.**

One consequence must be absorbed, not argued with: **the Core Value's current wording overclaims.** "The human is structurally guaranteed to have *consented*" is not enforceable — the habituation literature is unambiguous (fMRI-measured drop in visual processing after the *second* warning exposure; a field HITL deployment hit a 99.7% approval rate by day three; fluent AI rationales *increase* deference by ~5pp on top of a ~19pp automation-bias baseline). A security-literate reader will catch the overclaim and discount everything else. The defensible restatement, which preserves the intent and survives every finding in PITFALLS: **"structurally guaranteed that a human — not the agent — confirmed this specific payload, or the action does not run."** Same for the catalog claim: *"an agent cannot invent a capability you did not write; it can still combine the ones you did"* is true, sells better to the audience being courted, and survives the STAC composition-attack literature (<2% per-step harmfulness, >90% composed attack success).

---

## Key Findings

### Recommended Stack

STACK is the highest-confidence document in the set: its load-bearing claims were **reproduced locally on 2026-07-27** in scratch repos, not recalled. Build on **tsdown** (the Rolldown-org successor to tsup, which has had no release since 2025-11-12) with **`isolatedDeclarations: true`** — this is not a style preference. TypeScript 7.0 GA'd 2026-07-08 with **no compiler API** (deferred to 7.1), so dts generators that call it degrade onto an explicitly experimental path; `isolatedDeclarations` routes dts through oxc-transform instead, measured at **25 ms vs 1064 ms** on the same package. `packages/concierge/src/types.ts` already compiles clean under TS 7 + `isolatedDeclarations` + the repo's full strict flags, unmodified — the constraint is nearly free because the core is a hand-written type surface.

Ship **ESM-only**. The compatibility argument is settled (`require(esm)` is unflagged on every living Node line; all declared server targets are ESM-native), but the decisive argument is Concierge-specific: a dual-format package creates the **dual-package hazard**, where a consumer reaching core through both `require` and `import` loads two module instances with two copies of module-level state. For a utility library that wastes a few KB. Here it silently duplicates **the bridge registry** (component registers into instance A, handler reads instance B, `bridge` is `null` forever — surfacing as *"Open the results page first"* on a page that is definitely open), **the dedup window** (two dispatchers, two windows, so a retried call double-fires — exactly the double-payment the design exists to prevent), and **the consent kernel**. ESM-only → dual is additive; dual → ESM-only is breaking. Start narrow.

**Core technologies:**
- **TypeScript 7.0.2** (pinned exactly) — compiler + typecheck; 8–12x faster, but no API, so `isolatedDeclarations` is mandatory
- **tsdown 0.22.14** + rolldown — library bundler with built-in `attw`/`publint` gating, `exports` generation, `platform: "neutral"` (which reinforces no-DOM at the bundler layer)
- **pnpm 11.17.0 workspaces + catalogs, no Turborepo** — strict node_modules is the only layout that reliably surfaces missing peer deps, exactly the bug class an adapter ships by accident. Turborepo's 50–100 ms per-task overhead would plausibly make a 25 ms build *slower*
- **Vitest 4.1.10 `test.projects`** — one config, `node` for core (proves the no-DOM guarantee at runtime), `jsdom` for adapters. `vitest.workspace.ts` was removed in v4
- **changesets 2.31.1** — monorepo-native, and domain-relevant: whether a change is breaking is *a judgment about the safety contract*, not something inferable from a `fix:` prefix. semantic-release would let a `fix:` commit silently loosen a consent gate at patch level
- **`@standard-schema/spec@1.1.0`** — verified types-only: `dist/index.js` is literally **0 bytes** with zero dependencies
- **npm trusted publishing (OIDC)**, no `NPM_TOKEN` — classic tokens are being revoked and write-enabled granular tokens now expire in 7 days by default. Provenance is automatic. **No JSR for v0.1**

Three stack findings change the plan directly: `engines.node: ">=20"` targets a runtime that **reached EOL 2026-04-30** and must become `">=22.12.0"` (the precise floor where `require(esm)` is unflagged); the `@fullselfbrowsing/concierge-zod` package should be **deleted from the roadmap**; and `tsc --noEmit` must be a *separate* CI gate because tsdown does not typecheck — a broken build passes `tsdown` and fails only later.

### Expected Features

**Must have (table stakes — absence means developers bounce):**
- Typed action declaration → emitted JSON Schema — universal across CopilotKit, AI SDK, OpenAI Agents, MCP, WebMCP
- Schema-library agnosticism via Standard Schema v1 — hard-coding Zod now reads as dated
- Live app state readable by handlers — CopilotKit's `useAgentContext`; without it handlers can act but never ground
- **Some** human-in-the-loop approval primitive — `needsApproval` ships in *two* major SDKs; MCP says a human "SHOULD always be in the loop"
- Framework-agnostic core + ≥1 non-React adapter — **reclassified from differentiator to cost of entry**
- Cleanup-on-unregister that survives remounts — WebMCP uses `AbortSignal`; StrictMode/HMR make naive cleanup wrong
- SSR-safe construction, cancellation via `AbortSignal`, dynamic/scoped tool sets, a human-readable result sentence
- **Dev inspector** — `@copilotkit/web-inspector` exists today, lazy-loaded and localhost-gated. Scheduled v0.3 is too late
- **Side-effect annotations (`readOnly`/`destructive`/`idempotent`)** — a real gap. Every developer arriving from MCP expects to declare this, and its absence also blocks a future `concierge-mcp` from emitting `ToolAnnotations`

**Should have (verified: nobody else has these):**
- **Graded consent + build-time transport mismatch failure** — this is the product. Everyone has a confirmation *boolean*; nobody models what a transport can *promise*
- **Consent bound to user-turn identity** — competitors' approval is a free-floating boolean keyed by `toolCallId`
- **Snapshot-equality invalidation between review and confirm** — OpenAI Agents re-runs *guardrails* after approval, the closest prior art, but it validates arguments against policy, not against what the human was told. Be precise: this hardens a failure mode the ecosystem has named, it does not reveal one
- **Consent arms on delivery, not on tool return** — the mechanism that makes `perceived` meaningful rather than aspirational
- **Mandatory redaction, required field, defaults to `drop`** — AI SDK telemetry defaults `recordInputs: true`, i.e. fail-open. Cheapest strong trust signal per unit of effort
- **Build-time JSON Schema root validation** — WebMCP lists native schema validation as open question #92
- **Declarative stage-scoped catalogs**, **getter-based bridge snapshots** (CopilotKit serializes *values*; getters read through at call time and are the same shape across React refs, Vue refs, Svelte runes, and Angular signals), **commit window**, **reference-identity dedup**, **trustworthy annotations** (MCP mandates clients treat annotations as untrusted; here catalog author == app author, so `destructive: true` is a fact)

**Defer or delete:**
- `concierge-zod` bridge — **delete** (see Conflict 1)
- Third and fourth framework adapters — a trap. Cheap to build, permanent maintenance surface, and CopilotKit already has three
- Realtime/WebRTC transport (v0.4) — most vendor-coupled surface; defer until the kernel is proven
- `concierge-webmcp` — higher priority than its novelty suggests, but trigger on demand-side signal
- MCP executor, elicitation primitive, non-JS full-stack reference pattern

**Four new anti-features the competitive landscape surfaced,** to name before they eat a phase: **generative UI / `render` props on actions** (drags a UI framework into a core promised to have zero DOM access and forks every adapter into a renderer); **a chat UI** (converts a safety kernel into a fifth-place chat library); **an agent loop / model calling** (owning the loop means owning provider adapters forever); and **competing with WebMCP on tool registration** (unwinnable against Google + Microsoft + a shipped Chrome API, and unnecessary, because the platform left consent unspecified).

### Architecture Approach

Five framework-agnostic libraries were read at the source level from published npm tarballs, with LOC counted. All five converge on the same three-layer shape — thin adapters over a framework-free core over injected platform seams — and differ only in **where they put the seam** and **how much they left in core**. Better Auth is the proof the ~150 LOC budget is achievable: its Svelte adapter is **17 lines**, its React adapter 65, because its seam is *a value with a `subscribe` method* and every framework already knows how to consume one. Zag.js is the cautionary tale at 4× budget (491–686 LOC per adapter) because `@zag-js/core` publishes a machine *spec* and makes each adapter **run the machine** — the same interpreter written four times. The rule this yields, and it should be a CI-enforced boundary: **if any adapter contains a loop, a scheduler, or a state transition, logic has leaked out of core.** `@tanstack/query-core` having *zero* runtime dependencies is the model to copy; Floating UI's injected `Platform` interface is the pattern for any future environment coupling — inject, never import.

The getter-snapshot contract is **confirmed and convergently correct**: in Solid and Angular `() => T` *is already* the native reactive read (`Accessor<T> = () => T` is verbatim in `solid-js`), Svelte's compiler literally tells you to do it (*"Rather than `add(count)`, use `add(() => count)`"*), Vue ships `toValue`/`MaybeRefOrGetter` to normalize it, and TanStack Svelte Query v6 independently shipped the identical `Accessor<T> = () => T`. React is the sole exception where a syntactically identical getter is semantically wrong (`useState` closes over the render-time value), which is why the React adapter must own ref-mirroring rather than telling apps to maintain refs.

**Major components:**
1. **catalog** — `defineAction`/`defineStage`, name-union derivation, JSON Schema emission + root-type validation, redaction-required check, `consent.requires` resolvability. Pure functions plus one `buildCatalog` that throws naming the offending action. Must **not** read a bridge, touch a transport, or allocate mutable state
2. **bridge registry** — `read() => B | null`, `register(b) => identity-guarded unsub`. ~40 LOC closure over a single slot plus a **monotonic token** (keying the guard on the bridge *object* fails when a component re-registers an object that is `===` the previous one — a memoized literal or reused `$state` object — so the stale cleanup matches the live registration)
3. **dispatcher** — non-async `dispatch`, dedup by reference identity, serial batch execution by `outputIndex`, commit window, handler-exception containment. Closure plus `Map<string, Promise<ActionResult>>`
4. **consent kernel** — arm-on-delivery, `userTurnId` binding, snapshot equality, `minGrade` build-time gate. Must never trust `responseId`, arm on tool return, or degrade silently
5. **session/runtime** — ★ **missing from the current type surface**. Owns current stage, pushes catalog to transport, routes batches back into dispatch, returns result envelopes, re-pushes on reconnect. ~120 LOC
6. **adapters** — instance-into-scope, register/unregister with identity guard, nothing else
7. **transport** — vendor wire format, connection lifecycle, `capabilities` declaration. Never knows what an action *means*
8. **server handlers** — `Request → Response`; ephemeral token minting, MCP/SSE endpoint, redacted-telemetry sink

The `Transport` seam sits at the right altitude. Three real transport abstractions were compared: MCP's is at the message envelope, OpenAI's `RealtimeTransportLayer` is at the vendor protocol (it leaks `sendAudio`, `mute`, `interrupt`, `updateSessionConfig` — an MCP stdio transport could not implement it and would not want to), and Concierge's is at the semantic layer of tools/calls/results. `TransportCapabilities { consentGrade, parallelCalls, dynamicCatalog }` is better than anything in either comparator. It is also **incomplete**: it needs connection lifecycle (a stage change during WebRTC setup currently drops the catalog silently), a turn envelope on `onToolBatch`, and an error channel on `respond`.

### Critical Pitfalls

Ordered by **cost to fix late**, which is how PITFALLS itself is organized and the right lens for a pre-publish library.

1. **The readback never reaches the human — `perceived` measures the wrong hop (P1).** `ActionResult.message` travels to the human *through the model*, which generates its own rendition. OWASP ASI09; and *Moffatt v. Air Canada* established that the liability is the operator's, not the vendor's. **Avoid:** add a readback sink to core, separate from `Transport`; only the sink can grant `perceived`; regrade to `relayed < delivered < perceived`; bind `ConsentAck` to a `readbackHash`. **Warning sign:** the word "verbatim" appears in docs but no test asserts it, and all consent tests drive `dispatch` directly without a model
2. **Barge-in simultaneously destroys perception and mints the consent token (P2).** A human who says *"yeah yeah, go ahead"* two seconds into a nine-second readback has truncated the audio (WebRTC servers auto-truncate unplayed audio on interruption) *and* created a genuinely new user turn — which is exactly what `bindTo: "userTurn"` accepts as proof. `deferUntilDelivered` fires on "audio playback stopped," and playback stops on completion **and** on truncation, with nothing in the signature distinguishing them. **Avoid:** pass a completion reason and `playedMs`; non-`completed` must *invalidate*; classify the turn (a turn whose transcript is "stop"/"wait"/"no" must not confirm); add an explicit *review → barge-in at 20% → confirm must fail closed* test
3. **The catalog is a capability boundary, not a safety boundary (P3).** Enumeration bounds the *alphabet*, not the *sentences*. STAC constructs chains where each step scores under 2% harmfulness and the composition exceeds 90% attack success. `navigate` + `applyFilter` + `openResult` all live in `crossStage` by construction, and **`navigate(url: string)` in `crossStage` is an unrestricted exfiltration channel** that almost every real integration would write. **Avoid:** ship the reference example as `navigate({ route: z.enum([...routeIds]) })`; treat `crossStage` as privileged; add composition metadata (`maxPerTurn`, `conflictsWith`); add a per-session action budget and repeated-call breaker
4. **The lethal trifecta is fully present the moment one action reads user-generated content (P4).** Private data (the handler runs inside the human's authenticated session with no scoping), untrusted content (any bridge snapshot returning listing titles, seller descriptions, other users' names), and external communication (`navigate`, any logged query, and `ActionResult.message` itself, which crosses to the model vendor). All three legs are load-bearing product features. **Avoid:** adopt Chrome's `untrustedContentHint` vocabulary as `readsUntrusted?: boolean`, then **fail at catalog build time when a stage contains both an untrusted-reading action and an egress action** absent explicit acknowledgement. This is the highest-leverage security feature available here and it is *only* possible because the catalog is static — an advantage neither MCP nor generic automation has
5. **`ActionResult.message` is an injection channel back into the model, and it is the one string with no policy (P5).** `redact` is mandatory and governs *arguments*; nothing governs *results*. Yet `CONTRIBUTING.md` actively encourages interpolating app data into it. Tool results are the documented primary channel for indirect prompt injection. Second, independent problem on the same string: it crosses a vendor boundary on every call and carries no PII policy. **Avoid:** literal-vs-composed message API with core-side sanitisation and a length cap; `reason` from a **closed enum**, never `err.name` (which leaks `PrismaClientKnownRequestError`-class framework internals to the model and to logs)
6. **Mid-Session Tool Injection — the mutable runtime registry (P6).** `registerHandler(name, handler)` and `bridgeRegistry.register(bridge)` are live, in-page, same-origin functions. Every analytics tag, session-replay script, ad tag, browser extension, and transitive npm dependency runs with identical authority to your own registration code. This is **worse than MCP rug-pull**, because in MCP there was at least an approval step to subvert. The README line *"Adding a capability is a code change with a code review"* is true of the declaration and false of the runtime registry. **Avoid:** seal and freeze the built catalog; `registerHandler` refuses to overwrite; bridge ids keyed on object identity, not guessable strings; handlers in a `Map` not an object literal (test `dispatch("__proto__")`, `("constructor")`, `("toString")`); and a **server-issued signed single-use consent token** bound to `{userTurnId, payloadHash, readbackHash, expiry}` — because consent is currently a client-side construct and a malicious client can simply assert it

Three more that change the type surface and therefore must be decided now: **P8** (Standard Schema v1 cannot emit JSON Schema — and the input-vs-output projection is a correctness trap, since a schema with `.transform()` or `.default()` emits a *different* schema in each direction and tool calling needs the **input**; also the README's flagship `z.unknown()` example emits `{}` and directly defeats *"validation is enforcement, not decoration"*); **P9** (module-scoped `createConcierge()` leaks state across requests and tenants — CopilotKit shipped this exact bug and a customer got another tenant's documents; TanStack Router shipped the equivalent and served a wrong 307 to every visitor until the process restarted; invisible in development, manifests only under concurrent production traffic); and **P7** (approval fatigue — the honest verdict is that `bindTo: "userTurn"` and `snapshotEquality` are **real** controls against the agent, while `minGrade: "perceived"` as currently wired and "the human consented" as a claim about understanding are **theater**).

---

## Conflicts Between Researchers, Resolved

Four places where two researchers assert incompatible things. Each is resolved explicitly, with the winner and the reason.

### 1. The `jsonSchema?` escape hatch — **STACK wins, keep the field**

ARCHITECTURE §9-L argued that Standard JSON Schema (`~standard.jsonSchema`) makes the optional `jsonSchema?: JsonSchemaObject` field obsolete, citing standardschema.dev's implementer list which includes *"Valibot v1.2+"*. PITFALLS P8 repeated the same claim in a flatter form. **STACK probed the published packages and found valibot@1.4.2 does NOT implement `~standard.jsonSchema`** — its `~standard` keys are only `['version','vendor','validate']`. Valibot still requires the separate `@valibot/to-json-schema@1.7.1`, which emits **draft-07** by default, not draft-2020-12.

**STACK wins because it verified by probing the real installed artifact while ARCHITECTURE reasoned from the spec page.** In a conflict between a documentation claim and a runtime probe of the published package, the probe is authoritative.

**Resolution.** Keep `jsonSchema?: JsonSchemaObject`. The emission order is: explicit escape hatch → `~standard.jsonSchema.input({ target: "draft-2020-12" })` → throw naming the action *and* the vendor. Note the `input` projection specifically (P8's correctness trap). Strip the `$schema` key that both Zod and ArkType inject before emitting to a transport, since OpenAI Realtime's `parameters` may reject unknown root keys. The `concierge-zod` package is still deleted — all three researchers agree on that independently, and it would not have helped Valibot anyway.

**Durable warning to carry forward — record this as a project rule.** *Standard-Schema-adjacent capability claims must be verified by probing the installed artifact in a test, never by reading standardschema.dev.* The docs claimed a capability the published package does not have, and trusting them would have deleted a field that is the only working path for one of the three target validators. Concrete mitigation: a CI conformance probe that asserts, per supported validator, whether `~standard.jsonSchema` exists and what target it emits. That test is also the early-warning system for the reverse case (Valibot shipping it later, which would otherwise be silent).

### 2. Core as a `peerDependency` of adapters — **adopt it, and flag as a Key Decision**

STACK recommends core as a `peerDependency` (plus `devDependency` for tests), noting **MEDIUM** confidence and that TanStack does the opposite — it makes `@tanstack/query-core` a regular dependency pinned to an **exact** version. PITFALLS P13 independently reaches the same recommendation for the same reason. So the disagreement is not between researchers; it is between the two researchers and the dominant ecosystem prior art.

**Recommendation: adopt the peer dependency.** The reason is structural and specific to this codebase. With a regular dependency — especially an exact pin — installing `concierge-react@0.1.0` alongside `concierge-vue@0.1.1` yields **two cores**, and in Concierge that means two bridge registries, two dedup windows, and two consent kernels. This is the *same failure* the ESM-only decision exists to prevent, arriving by a different road. Note the coherent theme across three independent packaging decisions — ESM-only, core-as-peer, and `CONTRACT_VERSION` — all serve one invariant: **exactly one core instance, because module-level identity is the correctness mechanism.** A library whose core value is "the human structurally consented, or it doesn't run" should not ship a packaging configuration that can silently duplicate the consent kernel.

The residual risk peer deps introduce is version skew — a wide peer range lets `concierge@0.4` pair with `concierge-react@0.2`, which typechecks because TypeScript is structural and then fails at runtime in a way nobody can debug. P13's fix closes it: **export a `CONTRACT_VERSION` from core and have every adapter assert it at runtime** with an actionable message. Peer dependency + contract assertion together are strictly better than either alone.

**This needs an owner** because it diverges from the ecosystem's dominant pattern, changes install docs (`pnpm add @fullselfbrowsing/concierge @fullselfbrowsing/concierge-react` — the familiar `react` + `react-dom` shape), and is expensive to reverse after eight packages are published.

### 3. Svelte adapter packaging — **ARCHITECTURE and PITFALLS win over STACK**

STACK's build plan is tsdown for every package, and it acknowledges the rune constraint only as a file-naming and Vite-plugin issue: *"the tsdown/rolldown config must run them through the Svelte plugin."* ARCHITECTURE §5 and PITFALLS P11 both say something incompatible: **Svelte packages ship *source*, not compiled JS**, via `svelte-package`, with a mandatory `"svelte"` export condition. ARCHITECTURE verified this by reading the published exports maps of `@zag-js/svelte` and `@tanstack/svelte-query`; PITFALLS supplies the failure mode — pre-bundling with tsup/esbuild **strips the runes and produces an adapter that compiles and is silently non-reactive.**

**ARCHITECTURE/PITFALLS win** on evidence: they read shipped Svelte packages and the Svelte packaging docs, while STACK reasoned about the build config without testing a rune-containing library build. **Resolution:** the monorepo needs **two build toolchains from day one** — tsdown for core, React, and server; `svelte-package` for the Svelte adapter. This is a real, previously unbudgeted cost, and discovering it in v0.2 means reworking CI, release, and the exports story mid-flight. Verify with a **pack-and-install test that asserts live reactivity through a rune-backed getter**, not merely that the package builds.

### 4. `@standard-schema/spec` as a real dependency vs. inlining — **STACK wins; this reverses a PROJECT.md decision**

ARCHITECTURE lists *"Inlining `StandardSchemaV1` instead of depending on it"* under "Things that are right and should not be touched." STACK recommends taking the real dependency and shows the inlined copy **has already drifted in four ways**, one of which is a live interop break: the real spec declares `types?: Types | undefined` while the inlined copy declares `types?: Types`, so under the repo's `exactOptionalPropertyTypes: true` a library that explicitly sets `types: undefined` would be **rejected**. It also loses `Issue.path` (so you cannot tell the model *which field* failed) and the entire `StandardJSONSchemaV1` interface.

**STACK wins** because it unpacked the published package and enumerated concrete drift, while ARCHITECTURE's endorsement was a general dependency-free heuristic applied without examining the copy. The dependency is **types-only: 0-byte runtime, zero transitive deps** — it satisfies "core is dependency-free" in substance and adds nothing to any consumer bundle.

**Recommendation: take the dependency.** If the zero-dependency constraint is held as absolute (PROJECT.md states it as a hard constraint), the fallback is `devDependency` + inline + an **`expectTypeOf` conformance test asserting the inlined interface still accepts real Zod/ArkType/Valibot schemas** — and that test is mandatory, not optional, because inlining a spec you don't test against is exactly how the current four-way drift happened. **Needs an owner:** PROJECT.md's Key Decisions row commits to "Standard Schema v1, inlined."

### Convergences worth noting (not conflicts, but strong signals)

- **`registerHandler` was independently flagged by two researchers for two different reasons** — ARCHITECTURE §9-E as a duplicate registry violating *"if you maintain two lists in lockstep, that is a bug"*, and PITFALLS P6 as the Mid-Session Tool Injection attack surface. Two unrelated critiques converging on one field is a strong delete signal.
- **Devtools timing looked like a three-way disagreement and is not.** PROJECT.md says v0.3; FEATURES says pull the overlay to v0.2 because CopilotKit ships an inspector; PITFALLS P14 says pull `explain()` to v0.1 but leave the overlay at v0.3. These reconcile cleanly once split: **`concierge.explain(ctx)` is a core function in v0.1** (the single most common first-run experience is "the agent says it can't do anything," and the answer is always one of three things), while the **visual overlay is v0.2–v0.3**.
- **Adapter LOC budget** — PROJECT.md and ARCHITECTURE treat ~150 LOC as a hard constraint enforced by a `cloc` CI gate; PITFALLS P11 says treat it as *"a smell detector, not a hard gate that ships bugs"*, citing TanStack Table's Vue adapter needing a bespoke `mergeProxy`. Reconcile by reporting the number always, triggering review at 150, and failing the build only at ~250. Note React is already at 150+ once the mandatory adapter-owned `useLiveRef` (~25 LOC) is counted.

---

## What Forces a Change to v0.1 Scope

Multiple researchers independently argued to pull work **into** v0.1. Consolidated into one argument rather than four:

**The consent kernel moves into v0.1 — all three of FEATURES, PITFALLS, and ARCHITECTURE force this, from different directions.** FEATURES: a v0.1 shipping catalog + dispatcher + dedup + bridge + adapters and *no consent* is a strictly worse CopilotKit, who have the same features plus Angular, Vue, web components, an inspector, voice, chat UI, and distribution. PITFALLS: `ConsentPolicy`, `ConsentAck`, `ConsentGrade`, `deferUntilDelivered`, and the server-token shape are **public types**, so getting them wrong in v0.1 and fixing them in v0.2 is a breaking change *before the library has a reason to exist*. ARCHITECTURE: the consent kernel depends on a turn envelope that must be added to `Transport` before any transport ships. The standard counter-argument — that consent needs a transport to be demonstrable — is answered by the design itself: **`minGrade` failing at catalog build time is testable against a stub transport declaring `consentGrade: "none"`, with no WebRTC required.** That is the right first deliverable.

**The readback sink is new work that did not exist in any roadmap (P1).** Regraded `ConsentGrade` vocabulary, an app-owned readback channel that the model never touches, and `ConsentAck.readbackHash`. This is the most expensive item on this list to retrofit — every action definition and every transport in the wild would break — and it is the difference between the headline claim being true and being theater.

**`concierge.explain(ctx)` and a working zero-bridge path move to v0.1 (P14).** PROJECT.md already names bridge instrumentation cost as the top adoption risk and then places the mitigation two milestones downstream of it. The analytics industry ran this experiment for a decade with a stronger value proposition and lost — manual instrumentation plateaus around 20% coverage, and Amplitude eventually shipped autocapture after watching thousands of customers. The failure mode is not rejection; it is a team instrumenting three pages, hearing "I can't do that from here" everywhere else, and concluding the library doesn't work. Comparable successes (Zod, TanStack Query, react-hook-form) all pay off at **N=1**; Concierge's first bridge currently pays off only once a transport is wired *and* a stage matches.

**`createSession` moves into v0.1 (ARCHITECTURE §9-A).** `catalogFor` produces tools and `Transport.setTools` consumes them, with **nothing connecting them** — nothing owns "which stage are we in," subscribes `onToolBatch`, calls `respond`, or re-pushes on reconnect. The dispatcher can't own it (must stay transport-agnostic and non-async) and the transport can't own it (must stay catalog-agnostic). Every later phase assumes it exists, and retrofitting it means changing `Transport` after transports ship.

**Packaging and release infrastructure move to v0.1 (STACK + P10 + P13).** `publint`, `attw`, a pack-and-install smoke test, `CONTRACT_VERSION`, and a templated exports map cost one CI job while there is **one** package and require a coordinated major across **eight** afterwards. The compounding factor is package count, and the roadmap has eight.

**Metadata fields on `ActionDefinition` move to v0.1** — side-effect annotations, `readsUntrusted`, composition metadata (`maxPerTurn`, `conflictsWith`), the result-message policy, and `impact`. All are type-surface changes, the most expensive category of late change, and all are nearly free now. FEATURES and PITFALLS converge on adopting **WebMCP's vocabulary specifically** (`readOnlyHint`, `untrustedContentHint`, and the character budgets: 30 for names, 500 for descriptions, 150 per parameter, ~1.5K per output), which costs nothing today and makes a future `@fullselfbrowsing/concierge-webmcp` a **projection rather than a translation layer**.

**What comes out to pay for it.** `concierge-zod` (deleted outright), any third or fourth framework adapter, the visual devtools overlay (keep `explain()`), server handlers beyond ephemeral-token minting and catalog JSON, the MCP executor, JSR publishing, and Turborepo. The Realtime transport stays at v0.4 — but note that **ephemeral token minting is its hard prerequisite, not a nice-to-have**, so the server package cannot be deferred past the transport.

---

## What Must Be Fixed in the Committed Type Surface Before Any Implementation Phase

`packages/concierge/src/types.ts` is committed and compiles clean, but ARCHITECTURE §9 and PITFALLS P1–P8 together identify defects that make the design's central claim unimplementable. **No implementation phase should start against the current surface.** Blocking items:

| # | Defect | Fix | Source |
|---|--------|-----|--------|
| 1 | **`ConsentGrade` measures the wrong hop** — `perceived` asserts "audio finished playing," not "the correct content reached the human" | Add a readback sink to core, separate from `Transport`; regrade to `relayed \| delivered \| perceived`; only the sink grants `perceived`; add `ConsentAck.readbackHash` | P1 |
| 2 | **`ToolCall` cannot carry the fields consent depends on** — no path for a transport to supply `responseId`, `userTurnId`, or `deferUntilDelivered`, so the kernel is unimplementable against the current `Transport` | Add a `ToolBatch` envelope: `{ calls, responseId, userTurnId, deferUntilDelivered? }`. `userTurnId` is **transport-authoritative — core must never synthesise it** | §9-B |
| 3 | **`deferUntilDelivered` cannot distinguish completion from truncation** — barge-in both defeats perception and satisfies the gate | `(effect: (r: { responseId, completion: "completed" \| "interrupted" \| "cancelled", playedMs }) => void)`; non-`completed` **invalidates** | P2 |
| 4 | **Nothing owns the transport loop** | Add `createSession` / `ConciergeSession` with `setContext`, `stage`, `onStageChange`, `close`; buffers the last catalog and re-pushes on every `connected` transition | §9-A |
| 5 | **`ConsentPolicy.requires: string` is untyped** — `requires: "reviewBokking"` compiles and the gate never arms | Thread the catalog name union; and because `defineAction` cannot know the union at definition time, **`buildCatalog` must throw naming the action** when `requires` does not resolve. The runtime check is the one that has to exist | §9-C |
| 6 | **`ActionResult.message` has no policy** — the one string that always crosses a vendor boundary | Literal-vs-composed message API with core-side sanitisation (strip control chars/newlines, cap length); `reason` from a **closed enum**, never `err.name` | P5 |
| 7 | **`ConsentAck` cannot accommodate a server-verifiable artifact** — consent is client-asserted, so a hostile client fabricates it | Decide the signed single-use token shape now (`{userTurnId, payloadHash, readbackHash, expiry}`) even though the server package ships later — `ConsentAck` is a public type | P6 |
| 8 | **Mutable runtime registries enable Mid-Session Tool Injection** | Seal and `Object.freeze` the built catalog; `registerHandler` refuses to overwrite (or is deleted per §9-E); bridge ids keyed on **object identity**, not guessable strings; handlers in a `Map`, not an object literal | P6 + §9-E/H |
| 9 | **Svelte `$state` proxies silently void the consent snapshot** — `ConsentAck.snapshot` stored at review time is a *live proxy* that mutates with the app, so "any drift destroys the consent" becomes "there is never any drift." `structuredClone` is not the fix; it throws `DataCloneError` on proxies | Add a `SnapshotNormalizer` seam (Floating UI's `Platform` pattern at micro-scale) with a proxy-tolerant structural deep-copy default; the Svelte adapter fills it with `$state.snapshot`. **A security defect, and invisible in a React-only test suite** | §9-D |
| 10 | **JSON Schema emission** — no `~standard.jsonSchema` path, wrong-projection risk, missing strict-mode checks | Escape hatch → `~standard.jsonSchema.input()` → throw. `buildCatalog` also rejects `{}`/unconstrained property schemas, missing `additionalProperties: false`, and properties absent from `required`, each naming the offending action **and** property | P8 + §9-L |
| 11 | **`Transport.respond(callId, output: string)` forces premature serialization** | `respond(callId, result: ActionResult)`; let each transport serialize. Keeps the *"one sentence, safe to speak verbatim"* contract structurally intact all the way to the UI | §9-F |
| 12 | **`stages: Record<string, StageDefinition>` has non-deterministic match order** — JS iterates integer-like keys first in ascending numeric order, so a stage keyed `"404"` matches before everything declared above it | Use an ordered array, or assert at `buildCatalog` that no key is integer-like. Also document whether match is first-wins or must-be-unique — "two stages matched" is a real production state on a canvas app | §9-G |
| 13 | **No composition or taint metadata** | Add `readsUntrusted?`, side-effect annotations (`readOnlyHint`/`destructive`/`idempotent`), `maxPerTurn?`, `conflictsWith?`, `requiresFreshStage?`, `impact?` — aligned to WebMCP's vocabulary | P3/P4/P7/P18 |
| 14 | **`catalogFor(ctx)` returning a fresh array** | Memoize and freeze per stage at `buildCatalog` time; hand out the same reference forever. `useSyncExternalStore` throws *"The result of `getSnapshot` should be cached"* and infinite-loops otherwise — **and this becomes a breaking change the moment devtools ship** | Anti-Pattern 5 |
| 15 | **Instance lifecycle invites cross-request/tenant bleed** | All mutable state (dedup `Map`, timers, consent `Map`, event buffer) lazily allocated on first `dispatch`, never during module evaluation or `catalogFor`. Consider a `ServerSafeConcierge` type with `catalogFor` but no `dispatch`. **No module-scoped `createConcierge()` in docs, ever** | P9 |
| 16 | **No `CONTRACT_VERSION`** | Export from core; every adapter asserts at runtime with an actionable message. Free before publish; a coordinated major across eight packages after | P13 |

Cheaper, can follow in the same phase or the next: a `Snapshot` type param on `ActionDefinition` (currently erased, so `snapshotEquality` degrades to `(a: unknown, b: unknown) => boolean` precisely where correctness matters most, §9-I); defined behaviour for `dynamicCatalog: false` (§9-J); a `scheduler?: (cb) => void` seam plus `ReturnType<typeof setTimeout>` for timer handles (§9-K — TanStack ships `notifyManager.setScheduler` for exactly this, it costs ~5 LOC now and is breaking later); and `__resetForTest()` plus a dev warning when `register()` runs with `typeof window === "undefined"` (§9-H).

**Things that are right and must not be touched:** `snapshot: Record<string, () => T>` (convergently correct — TanStack Svelte Query v6 independently shipped the identical `Accessor<T> = () => T`); `AbortSignalLike` declared locally to keep `lib: ["ES2022"]` (the single most disciplined thing in the file, and a real DOM `AbortSignal` was verified assignable to it with no cast); `TransportCapabilities` as a declared-capability object; `dispatch` not being `async`; `USER_STOPPED` as a frozen shared constant; and the `jsonSchema?` escape hatch (Conflict 1).

---

## Implications for Roadmap

Suggested phase structure. Phases 1–6 constitute v0.1; Phases 7–8 are v0.2; Phase 9 is v0.3–v0.4.

### Phase 1: Type surface correction
**Rationale:** Sixteen blocking defects in a committed public type surface, several security-shaped, all breaking to fix after publish. The consent kernel is literally unimplementable against the current `Transport`. Nothing should be built against it.
**Delivers:** Corrected `types.ts` — `ToolBatch` envelope, regraded `ConsentGrade` + readback sink types, `ConsentAck` with `readbackHash` and server-token shape, typed `requires`, result-message policy + closed `reason` enum, metadata fields, `respond(ActionResult)`, deterministic stage ordering, `SnapshotNormalizer`, `CONTRACT_VERSION`, `createSession` signatures.
**Addresses:** Nothing user-visible — this is a design gate.
**Avoids:** P1, P2, P5, P6, and every "HIGH post-publish" recovery cost in PITFALLS.

### Phase 2: Build, packaging, and release infrastructure (parallelizable with Phase 1)
**Rationale:** Costs one CI job at one package and a coordinated major at eight. STACK verified every choice here empirically on this machine.
**Delivers:** tsdown + TS 7.0.2 + `isolatedDeclarations`; ESM-only with `platform: "neutral"`; pnpm 11 workspaces + named catalogs for the peer matrix; Vitest 4 `test.projects` (`node` for core, `jsdom` for adapters); `publint` + `attw` + `tsc --noEmit` as separate gates; a `tsconfig.node20.json` that typechecks the *published output*; pack-and-install smoke test; changesets ≥2.31.1; npm trusted publishing via OIDC; `engines.node: ">=22.12.0"`; core-as-peer-dependency wiring. Plus the **second toolchain** (`svelte-package`) scaffolded now, not discovered in v0.2.
**Uses:** The entire STACK document.
**Avoids:** P10, P13.

### Phase 3: Catalog, schema emission, and `explain()`
**Rationale:** Everything downstream derives from the single action declaration. Build-time validation is where the differentiators are cheapest and sharpest.
**Delivers:** `defineAction`/`defineStage`/`buildCatalog`; Standard JSON Schema detection with the escape hatch; root `type: "object"` validation throwing by action name; rejection of `{}` property schemas, missing `additionalProperties: false`, and incomplete `required`; redaction-required check; `requires` resolvability; catalog sealing, freezing, and per-stage memoization; `concierge.explain(ctx)`; the working zero-bridge path.
**Addresses:** Typed action declaration, schema agnosticism, stage-scoped catalogs, build-time `minGrade` mismatch, side-effect annotations.
**Avoids:** P8, P14, and the composition/trifecta build checks from P3/P4.

### Phase 4: Bridge registry, dispatcher, and session
**Rationale:** The concurrency-correctness core, and the component (`createSession`) every later phase assumes exists. Mostly solved by the source system; PITFALLS supplies the missing test list.
**Delivers:** Bridge registry with monotonic-token identity guard, unforgeable identity, dev SSR warning, `__resetForTest()`; non-async `dispatch` with reference-identity dedup, `callId`-primary keying and **no `JSON.stringify` fallback**, `Map`-backed handler lookup, prototype-pollution-safe names, exception containment, dedup-map sweeping, signal composition across dedup'd callers; commit window; `createSession` with catalog buffering and re-push on `connected`; lazily-allocated mutable state.
**Implements:** Components 2, 3, 5.
**Avoids:** P9, the performance traps, and the "looks done but isn't" dispatch checklist.

### Phase 5: Consent kernel
**Rationale:** This is the product, and it is the only thing left that competitors do not have. It ships in v0.1 because a v0.1 without it is a strictly worse CopilotKit.
**Delivers:** Readback sink; build-time grade gate against a stub transport; `userTurn` binding with turn classification (core refuses to auto-accept); snapshot equality through `SnapshotNormalizer`; arm-on-delivery distinguishing completion from truncation with `playedMs >= readbackDurationMs`; `readbackHash`; the client half of the consent token; and the mandatory **review → barge-in at 20% → confirm fails closed** test.
**Addresses:** The entire differentiator column.
**Avoids:** P1, P2, P7.

### Phase 6: Adapters — React + Svelte together, one example app
**Rationale:** Two adapters in the same commit range is the only thing that keeps core honest. Svelte specifically, because it is the sole choice that surfaces the `$state` proxy consent defect and forces the packaging pipeline to be correct while the repo is still small.
**Delivers:** React adapter with adapter-owned `useLiveRef`/ref-mirroring (so app code never touches a ref and never fights the React 19 compiler), build-time `"use client"` banner injection on hook modules only — never the core barrel — and StrictMode double-invoke tests; Svelte adapter via `svelte-package` with `.svelte.ts` files, the `svelte` export condition, `$state.snapshot` normalizer, and a **live-reactivity test through the published tarball**; a ~40-line unpublished Vue spike as a seam check; one example app exercising both, with React Compiler enabled.
**Avoids:** P11, P12, §9-D, Anti-Pattern 2.

### Phase 7: Fetch-standard server handlers + server-verified consent
**Rationale:** Consent that only exists in the browser is decorative the moment it guards a server-side side effect. Also unblocks the Realtime transport, since ephemeral token minting is a hard prerequisite.
**Delivers:** `createHandler(cx, opts): (Request) => Promise<Response>`; `/node` with ~80 LOC of vendored request/response marshalling (Node is the only target that doesn't speak `Request`/`Response`; note the `x-forwarded-proto` reconstruction, without which cookie `Secure` and OAuth redirects break behind a proxy); ~10–25 LOC shims for `/next` and `/sveltekit`; one documented line each for Bun, Deno, Workers, Hono, Remix, Nuxt; ephemeral Realtime token minting; catalog JSON; **server-issued signed single-use consent token verification**; the append-only redaction-aware action ledger.
**Avoids:** P6's confused-deputy corollary; supports EU AI Act Art. 50, which applies 2026-08-02.

### Phase 8: Devtools overlay and safety telemetry
**Rationale:** Table stakes (CopilotKit ships `@copilotkit/web-inspector` today), and it is where the approval-fatigue canary lives. Does not depend on the consent kernel, so it can run in parallel.
**Delivers:** Overlay showing active stage, registered bridges, live catalog, manual firing; instrumentation coverage ("12 of 40 routes have a matching stage"); **confirm-rate and time-from-readback-to-confirm telemetry** — the metrics that tell you whether the kernel is working or being rubber-stamped.

### Phase 9: Transports — Realtime, then WebMCP, then MCP
**Rationale:** Most vendor-coupled surface, and the only place `perceived` can be validated end-to-end. Defer until the kernel is proven.
**Delivers:** OpenAI Realtime over WebRTC (the only transport that can honestly claim `perceived`, and the only package that justifies `@vitest/browser-playwright`); `concierge-webmcp` emitting the stage-scoped catalog through `document.modelContext.registerTool()` with the kernel in front of `execute` — its `{signal}` unregistration model maps cleanly onto the identity-guarded unsubscriber contract; `concierge-mcp` executor at `consentGrade: "none"`, which is the point: `minGrade: "perceived"` actions **must refuse to build** against it.

### Phase Ordering Rationale

- **Types before everything** because sixteen defects in a committed public surface include three that make the Core Value unimplementable, and PITFALLS ranks their post-publish recovery cost as HIGH.
- **Packaging early** because its cost scales linearly with published package count and the roadmap has eight packages.
- **Catalog before dispatcher** because the dependency graph is strict: the action DSL requires Standard Schema interop, which requires JSON Schema emission, which requires root-type validation. Dedup is enabled by the dispatcher, which requires the DSL.
- **Consent after the dispatcher but inside v0.1** because the kernel must intercept before the handler, and `minGrade` build-time failure is demonstrable against a stub transport with no WebRTC.
- **Both adapters in one phase** because building React-first and porting later produces a hooks-shaped core, and by the time the second adapter arrives "fixing core" is a breaking change.
- **Redaction is fully independent** — it requires only the action DSL — so it can land in Phase 3 rather than waiting for the kernel. It is cheap, fail-closed, and the strongest trust signal per unit of effort.
- **Devtools does not depend on consent**, so Phase 8 can be parallelized rather than serialized.

### Top Risks, Ranked by Cost-to-Fix-Late (not by severity)

This ordering deliberately inverts severity in places. P7 (approval fatigue) is arguably the most damning finding for the product story but is additive and cheap to address later; P10 (packaging) is trivial but must be done now.

| Rank | Risk | Cost if fixed late | Why |
|------|------|-------------------|-----|
| 1 | `ConsentGrade` measures the wrong hop (P1) | **HIGH** | New grade member + readback sink = breaking change to `ConsentPolicy`, `ConsentAck`, `TransportCapabilities`, and every action definition in the wild |
| 2 | Unpoliced `ActionResult.message` (P5) | **HIGH** | Changes what every handler returns. Interim mitigation: sanitise centrally in the dispatcher and cap length — buys time without an API break |
| 3 | Incomplete consent type surface — turn envelope, untyped `requires`, no server token, no readback hash (§9-B/C, P2, P6) | **HIGH** | All public types; all breaking; all free today |
| 4 | Missing `createSession` (§9-A) | **HIGH** | Retrofitting changes the `Transport` contract *after* transports have shipped |
| 5 | Missing metadata fields on `ActionDefinition` (P3/P4/P7/P18) | **MEDIUM→HIGH** | Additive *only if* the invariant "adapters pass definitions through opaquely" is written down now (P13). Otherwise every adapter breaks |
| 6 | No `CONTRACT_VERSION` / packaging gates (P13, P10) | **LOW→HIGH** | Free before publish; a coordinated major across eight packages after |
| 7 | `catalogFor` returning fresh arrays (Anti-Pattern 5) | **MEDIUM** | Becomes breaking the moment anything feeds it to `useSyncExternalStore` — i.e. when devtools ship |
| 8 | Svelte `$state` proxy normalizer (§9-D) | **MEDIUM** | Needs a seam *in core*; adding it later breaks adapters. And it is a silent security defect, invisible in a React-only suite |
| 9 | Wrong JSON Schema projection (P8) | **MEDIUM** | Adopters may have authored schemas that depended on the wrong projection |
| 10 | Module-scope singleton / SSR dispatch (P9) | **MEDIUM** | Adopters must move construction; a loud runtime error is the whole fix |
| 11 | Mutable registry / MSTI (P6) | **MEDIUM** | Register-once is technically breaking for anyone relying on re-registration. Ship as a warning first, throw at 1.0 |
| 12 | ESM-only + Node floor (P10) | **LOW** | One CI job, but cost scales linearly with published package count |
| 13 | Instrumentation plateau / `explain()` (P14) | **LOW technically, HIGH in reputation** | `explain()` is a small function. The unrecoverable cost is the cohort that already bounced |
| 14 | Approval fatigue (P7) | **LOW technically, ongoing** | Risk-based escalation and polymorphic readback are additive. Instrument confirm-rate to know whether it is happening |

### Research Flags

Phases likely needing `/gsd-plan-phase --research-phase <N>`:
- **Phase 5 (consent kernel):** No prior art exists for any of it — verified absent from five competitors and two specs. The design also changed mid-research (P1 invalidated the grade semantics), so the readback sink, turn classification, and `playedMs` thresholding are proposals, not validated mechanisms.
- **Phase 7 (server-verified consent):** The token's cryptographic design is unspecified by every researcher. Binding, signing, single-use burn semantics, and clock-skew handling all need design work.
- **Phase 9 (transports):** Realtime is vendor-coupled, browser-test-only, and is where `perceived` gets its first real evidence. WebMCP is a live origin trial through Chrome 156 with a deprecated namespace already in flight (`navigator.modelContext` deprecated in Chrome 150) — re-verify at implementation time, since at least one widely-cited blog post already describes a `requestUserInteraction()` method that **is not in the spec**.

Light research only (re-verify a specific fact, don't re-survey):
- **Phase 3:** OpenAI strict-mode function-calling constraints and the Standard JSON Schema conformance matrix both move. Re-probe the installed validators rather than reading docs.
- **Phase 6:** `svelte-package` coexisting with tsdown in one pnpm workspace was not tested by anyone.

Phases with standard patterns (skip research-phase):
- **Phase 1, 2:** Every choice was empirically verified locally on 2026-07-27 with reproducible commands.
- **Phase 4:** The source system already solved this; PITFALLS supplies the test list.
- **Phase 8:** Well-trodden; CopilotKit's inspector is a readable reference.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Load-bearing claims reproduced locally on 2026-07-27 in scratch repos with commands recorded. MEDIUM on jsdom-vs-browser-mode (ecosystem genuinely mid-migration) and on Svelte packaging, where ARCHITECTURE/PITFALLS contradicted it and won |
| Features | **HIGH** for competitor API surfaces | Verified against npm registry metadata, live docs, and spec repos; one stale blog claim was caught and resolved in favour of the spec repo. **MEDIUM–LOW on adoption claims** — WebMCP pilot names and "no mainstream agent consumes WebMCP yet" each rest on a single secondary analysis |
| Architecture | **HIGH** | Five libraries read at source from published npm tarballs with LOC counted; framework semantics verified against official docs; three shipped-bug issue threads cited. MEDIUM on Vue HMR ordering (characterised from the general Vite/Vue model, not a quoted doc — the mitigation is correct regardless). LOW on CopilotKit's exact signature, not load-bearing |
| Pitfalls | **HIGH** on security and library engineering | OWASP Top 10 for Agentic Applications 2026, peer-reviewed attack papers (STAC, WebMCP surface poisoning), vendor docs, and fMRI/MIS-Quarterly human-factors literature. **MEDIUM on adoption failure modes** — one practitioner post-mortem and industry write-ups; the 99.7%-by-day-three figure is LOW–MEDIUM |

**Overall confidence: HIGH.** The two most consequential findings — that framework-agnostic actuation is now table stakes, and that `perceived` measures the wrong hop — are both HIGH confidence and both traceable to primary sources (npm registry timestamps; OpenAI's own Realtime documentation stating the client must send `response.create` after `function_call_output`).

### Gaps to Address

- **`perceived` has never been demonstrated end-to-end.** `playedMs >= readbackDurationMs` is a proposal. Validate in Phase 9 against a real WebRTC session, but design for it in Phase 1 — the type shape cannot wait for the evidence.
- **The consent token design is unspecified.** No researcher designed the binding, signing, or burn semantics. Decide the *shape* in Phase 1 (it is a public type), the *cryptography* in Phase 7.
- **Turn classification has no mechanism** beyond "core exposes `consent.acceptTurn(turnId, classification)` and refuses to auto-accept." Needs design in Phase 5.
- **Whether `@copilotkit/core` is genuinely DOM-free at import time was never tested** — it depends on `@ag-ui/client`, `rxjs`, and `phoenix`. **Do not publish an SSR-advantage claim until this is tested.**
- **Standard Schema docs-vs-reality.** standardschema.dev claims Valibot v1.2+ implements Standard JSON Schema; valibot@1.4.2 does not. Add a CI conformance probe per validator — it is both the guard and the early-warning system for the reverse case.
- **The Valibot escape-hatch path is untested end-to-end.** `@valibot/to-json-schema@1.7.1` emits draft-07 by default, and OpenAI Realtime's `parameters` field may reject unknown root keys such as the `$schema` that Zod and ArkType inject.
- **changesets + OIDC.** The crash fix (issue #2099) closed 2026-07-02 and `@changesets/cli@2.31.1` postdates it, but the specific changelog entry was not read. **Smoke-test the release workflow against a throwaway scope before the first real publish.**
- **The ~150 LOC adapter budget is a target, not a measurement.** Validated as achievable (Better Auth: 17–65) and its failure mode validated (Zag: 491–686), but Concierge's own adapters are unwritten and React is already at 150+ with the mandatory ref-mirroring helper.
- **`dynamicCatalog: false` behaviour is undefined** — pick one and encode it in `buildCatalog`.
- **WebMCP's demand side is unverified.** Supply is ready; no mainstream agent consumes WebMCP tools yet. Monitor rather than plan around it — but if Gemini-in-Chrome ships as a consumer, the value of "we let you declare typed verbs" drops toward zero and *everything* rests on the kernel.

---

## Open Decisions Needing a Human

| # | Decision | Recommendation | Why it needs an owner |
|---|----------|----------------|----------------------|
| 1 | Does `perceived` now require an app-owned readback sink? | **Yes**, and regrade to `relayed < delivered < perceived` | Changes the pitch, the README, the Realtime demo, and adds real integration work for adopters. It is also the difference between a true claim and a false one |
| 2 | Reverse PROJECT.md's "Standard Schema v1, inlined" and take `@standard-schema/spec@1.1.0` as a dependency? | **Yes** — types-only, 0-byte runtime, zero deps, and the inlined copy has already drifted four ways including one `exactOptionalPropertyTypes` interop break. If the zero-dep constraint is absolute, then devDependency + `expectTypeOf` conformance test is **mandatory** | Reverses a recorded Key Decision and touches the "core is dependency-free" constraint |
| 3 | Core as `peerDependency` of adapters? | **Yes**, plus a `CONTRACT_VERSION` runtime assertion | Diverges from TanStack's dominant pattern, changes install docs, expensive to reverse after eight packages |
| 4 | ESM-only, and raise `engines.node` from `">=20"` to `">=22.12.0"`? | **Yes to both**; document the Jest/CJS caveat | Node 20 EOL'd 2026-04-30, so the current constraint advertises support for an unpatched runtime. Changes a PROJECT.md constraint |
| 5 | Consent moves into v0.1 — what comes out? | Drop `concierge-zod`, extra adapters, the visual overlay (keep `explain()`), server handlers beyond token-minting + catalog JSON, MCP executor, JSR | A scope trade with a delivery-date consequence |
| 6 | Rewrite the Core Value and the catalog claim? | **Yes.** "Structurally guaranteed that a human — not the agent — confirmed this specific payload." And "an agent cannot invent a capability you did not write; it can still combine the ones you did" | Touches PROJECT.md's Core Value sentence and the README's headline claims. Both current wordings are overclaims a security-literate reader will catch |
| 7 | Svelte packaging: `svelte-package` vs tsdown + Svelte plugin? | **`svelte-package`**, verified by a pack-and-install live-reactivity test | Adds a second build toolchain from day one — a previously unbudgeted cost affecting CI, release, and the exports story |
| 8 | Delete `registerHandler`, or seal it? | **Delete from the public surface.** If a test-double hook is needed, make it dev-only, register-once, and named for that purpose | Flagged independently as both a duplicate registry and an MSTI attack surface |
| 9 | Adapter LOC: hard gate or smell detector? | Report always, review at 150, fail at ~250 | PROJECT.md currently states it as a hard constraint; PITFALLS says a hard gate would ship a broken Vue adapter |

**Out of Scope check.** Research validates all seven of PROJECT.md's Out of Scope items and strengthens one: "card capture or credential entry by agent" is an **MCP spec MUST NOT** — form-mode elicitation for passwords, API keys, tokens, or payment credentials is prohibited and URL mode is mandatory — so the structural refusal can now cite normative ecosystem text rather than reading as an idiosyncratic opinion. Four items should be **added**: generative UI / `render` props on actions, a chat UI, an agent loop / model calling, and reimplementing or competing with WebMCP. One existing item changes shape: "Hard dependency on Zod → Standard Schema v1 instead. Ship a `@fullselfbrowsing/concierge-zod` bridge" — the bridge is deleted, and the Standard Schema decision itself may take a types-only dependency (Open Decision 2).

---

## Sources

Full bibliographies live in the four research documents. Aggregated by tier:

### Primary (HIGH confidence)
- **Empirical verification on this machine, 2026-07-27** — tsdown 0.22.14 dual-format build + `attw --pack` + `publint` matrix; TS 7.0.2 dts generation with and without `isolatedDeclarations` (timing + warning); `types.ts` compiling clean under TS 7 + full strict flags; `lib: ["ES2022"]` rejecting `document`; real `AbortSignal` → `AbortSignalLike` assignability; `~standard.jsonSchema` probe across zod@4.4.3 / valibot@1.4.2 / arktype@2.2.3; `z.discriminatedUnion` root-type reproduction; `@standard-schema/spec@1.1.0` unpacked (0-byte runtime, zero deps)
- **Published npm tarballs read at source level** — `@tanstack/query-core@5.101.4`, `@tanstack/react-query`, `@tanstack/svelte-query@6.1.38`, `@tanstack/solid-query`, `better-auth@1.6.25`, `better-call@1.3.7`, `@zag-js/{core,react,vue,svelte,solid}@1.42.0`, `@floating-ui/core@1.8.0`, `@modelcontextprotocol/sdk`, `@openai/agents-realtime@0.13.5`, `solid-js`, `@tiptap/core@3.29.1`
- **Official documentation** — TypeScript 7.0 announcement; tsdown, Vitest, pnpm catalogs, npm trusted publishing; React (`StrictMode`, `useSyncExternalStore`, ref lint rules); Svelte (`$state`, compiler warnings, SvelteKit packaging); Vue (reactivity utilities, SSR/cross-request state pollution); Angular (signals, `DestroyRef`); Next.js `use client`; Hono web standards; standardschema.dev + the Standard JSON Schema spec; Zod JSON Schema; nodejs/Release `schedule.json`
- **Specs and vendor docs** — MCP `schema/2025-11-25/schema.ts` (`ToolAnnotations` exact defaults), MCP tools + elicitation specifications; WebMCP explainer (webmachinelearning/webmcp) and Chrome origin-trial + secure-tools + agent-security docs; OpenAI Realtime conversations and function-calling guides; Vercel AI SDK 6 docs and release post; OpenAI Agents JS human-in-the-loop and voice-agents guides
- **Security standards and research** — OWASP Top 10 for Agentic Applications 2026 (published 2025-12-09); Simon Willison's lethal trifecta; STAC (arXiv 2509.25624); WebMCP Tool Surface Poisoning / Mid-Session Tool Injection (arXiv 2606.06387); Invariant Labs MCP tool poisoning; CaMeL (arXiv 2503.18813)
- **Human factors** — Polymorphic warnings / habituation fMRI (CHI 2015); Tuning Out Security Warnings (MIS Quarterly 42:2); *Moffatt v. Air Canada* coverage
- **Registry and issue-tracker evidence** — npm registry version/timestamp/download data; `changesets/changesets#2099`; TanStack Router #6924; sveltejs/svelte #12438/#13562/#15327; sveltekit-superforms #300; ueberdosis/tiptap #5856; React Compiler ref issues
- **Compliance** — EU AI Act Article 50 and the European Commission transparency FAQ (applies 2026-08-02)

### Secondary (MEDIUM confidence)
- CopilotKit in Production post-mortem (multi-tenant state bleed, no error taxonomy, ~200-concurrent-session re-render thrash) — single practitioner account but highly specific and directly on-point
- The HITL Rubber Stamp Problem; Approval Fatigue industry report (99.7%-by-day-three)
- Amplitude autocapture-vs-manual-tracking (the instrumentation-coverage plateau)
- TanStack Table framework adapters (Vue `mergeProxy`); ESM/CJS dual-publishing write-ups; tshy dual-package-hazard framing
- Defense Against Indirect Prompt Injection via Tool Result Parsing (arXiv 2601.04795); IPIGuard (arXiv 2508.15310); MCP confused-deputy and threat-modelling analyses
- OpenTelemetry GenAI PII-redaction practice

### Tertiary (LOW confidence — needs validation)
- WebMCP pilot names (Expedia, Booking.com, Shopify) — single secondary source, deployment unconfirmed
- "No mainstream AI agent consumes WebMCP tools yet" — single analysis, consistent with the absence of any vendor announcement
- Patrick Brosset's WebMCP article — **partially stale**; claims `navigator.modelContext` and a `requestUserInteraction()` method, neither matching the current explainer. Conflict resolved in favour of the spec repo
- CopilotKit's exact `useCopilotAction` signature — surveyed from docs summaries, not source; not load-bearing

---
*Research completed: 2026-07-27*
*Ready for roadmap: yes*
