# Concierge

## What This Is

Concierge is an installable TypeScript package family that lets an AI agent operate a web app it has permission to control — through typed, consent-gated actions the app declares, rather than generic DOM automation. The app exposes verbs like `applyFilter({key, value})`; the agent never sees the DOM, only a schema. It is aimed at product engineers who want an agent to actually drive their app, not narrate screenshots of it.

Its sibling is [FSB](https://github.com/fullselfbrowsing/FSB): **FSB drives apps that don't cooperate; Concierge is how an app cooperates.** Same org, same vocabulary, complementary halves.

## Core Value

An agent can take a consequential action in a real app — and it is structurally guaranteed that **a human, not the agent, confirmed this specific payload**, or the action does not run.

Everything else (framework breadth, transport breadth, DX) is in service of that. A library that makes agent actuation easy but consent optional is worse than nothing, because it will be used.

*Wording note (2026-07-27): this previously read "the human is structurally guaranteed to have consented." Research pushed back, correctly — no library can guarantee a mental state, and the habituation literature says humans rubber-stamp confirmations. What is actually enforceable is the provenance of the confirmation and the identity of what was confirmed. The claim is narrower and true, rather than broader and unfalsifiable.*

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Author declares an action once (name, description, schema, redaction, handler) and everything downstream is derived: name set, union type, per-stage catalogs, emitted JSON Schema, redaction policy
- [ ] Core runs with zero DOM access, zero framework dependency, and zero vendor dependency
- [ ] Dispatcher deduplicates retried calls by returning the same Promise by reference
- [ ] Handlers read live app state through a bridge of getter functions, without prop-drilling and without re-rendering the app
- [ ] Stage-scoped catalogs — the agent only sees actions valid for where the user is
- [ ] Consent handshake: review → human responds in a genuinely new turn → confirm, with snapshot equality invalidating stale consent
- [ ] Transports declare a consent grade; actions declare a minimum grade; mismatch fails at catalog build time
- [ ] Consent snapshots are normalized out of framework reactivity before storage, so a proxy-backed store cannot make the drift check vacuously pass
- [ ] `createSession` owns the transport loop — catalog push on stage change and reconnect, and `onToolBatch → dispatch → respond`
- [ ] Actions declare side effects (`readOnly` / `destructive` / `idempotent`); a destructive action without a consent policy is a build warning
- [ ] Server re-verifies consent rather than trusting the client's assertion
- [ ] React adapter and Svelte adapter, shipped together
- [ ] Fetch-standard server handlers that mount unchanged in Next, Nuxt, SvelteKit, Remix, Hono, Bun, Deno, and Workers
- [ ] Catalog build validates emitted JSON Schema (root must be `type: "object"`) and throws naming the offending action
- [ ] Redaction required for any action with a non-empty schema, defaulting to `drop`
- [ ] An action reading attacker-controllable content declares it, and the build reports one that does so without a consent policy
- [ ] A failed action's outcome reaches the human as the app composed it — the agent cannot substitute its own narration for a failure
- [ ] A transport declares where its turn identity comes from, so one whose turns the agent can mint cannot satisfy the strongest binding
- [ ] Dev overlay showing active stage, registered bridges, live catalog, and manual action firing

### Out of Scope

- **Generic actuation primitives (`click`, `execute_js`, coordinate tools)** — that is FSB's job, and on an owned DOM they add attack surface for no benefit. The action catalog *is* the security boundary; a generic escape hatch destroys it.
- **Third-party site automation** — different product class with ToS, captcha, and 2FA exposure. Use FSB.
- **Voice as the primary framing** — voice is transport #1, not the noun. Welding the core to WebRTC and one vendor's event names would cap the addressable audience at people building voice UIs.
- **Hard dependency on Zod** — welds us to one validator's release cadence and excludes Valibot/ArkType/Effect Schema. Standard Schema v1 instead (depended on as `@standard-schema/spec`, whose ESM runtime entry is verified 0 bytes).
- **A `concierge-zod` JSON Schema bridge package** — an earlier draft committed to shipping one. Standard JSON Schema (`~standard.jsonSchema`) makes it largely unnecessary. The optional `jsonSchema?` field stays as the escape hatch, because valibot@1.4.2 does *not* implement the companion spec despite its documentation claiming otherwise.
- **Dual ESM/CJS publishing** — the dual-package hazard would load two module graphs and split the bridge registry, the dedup window, and the consent kernel. A split dedup window double-fires a retried call, which is the precise failure this library exists to prevent. ESM-only → dual stays available later; the reverse does not.
- **Generative UI / `render` props on actions** — pulls DOM concerns into a core promised to be DOM-free.
- **Shipping a chat UI or an agent loop** — adjacent products, and both would compromise the transport-agnostic core.
- **Non-JS full-stack framework adapters (Rails, Laravel, Django, Phoenix)** — the bridge pattern works there via a server-rendered JSON island plus `pushEvent`-style actions, but ship it as a documented pattern and one reference example, not as typed packages.
- **Long-term procedural memory / site-guide layer** — irrelevant when the app declares its own verbs.
- **Card capture or credential entry by voice or by agent** — structurally refused, not merely discouraged.

## Context

**Provenance.** The design is extracted from a production system (`voyza-voice-browser-control-spec.md`, 2685 lines, captured 2026-07-27): 28 control actions across 6 stages, ~3,947 LOC non-test, 28 test files. That system shipped and its failure modes are documented, including a section on verified drift between its planning record and its implementation. Concierge is the generic ~60% of it — and per that spec's own assessment, it is the *hard* 60%: concurrency, cancellation, dedup, and consent semantics.

**A second, independent implementation** was located and read on 2026-07-27: the `portfolio` repository, branch `audit-fsb-ai-control-loop` (2026-07-16, ~12.4k insertions, Next.js). It is a shipped in-app AI control loop with typed awaited results, correlated pending/success/failure, stale-completion suppression, and per-action display-arg allowlists. It is *lacklustre* against Concierge's ambition — no consent gate, no grades, no readback hash, no snapshot equality, no dedup by reference identity, and no `reason` field at all — but it corroborates the core shapes and it independently produced four things the design did not have: an `invalid_result` failure mode (handlers return junk, so there is a `normalizeControlResult` boundary), message sanitization with a hard length cap, an ASI09 mitigation that discards the agent's narration on failure, and recognizer-echo suppression, which is what exposed the turn-identity provenance hole. Two independent systems converging on the same shapes is stronger evidence than one.

**Prior art — corrected after research (2026-07-27).** An earlier draft of this section was wrong in two ways and the errors flattered us, so they are recorded rather than quietly deleted:

- *Claimed:* Vercel AI SDK "is server-side and has no client actuation or consent story." **False on both halves.** Its `execute` is optional *specifically* so calls can be forwarded to the client, and AI SDK 6 shipped `needsApproval: boolean | fn`.
- *Claimed:* CopilotKit is the React-ecosystem comparison. **Outdated.** It ships a React-free core, plus Angular, Vue, and web-component packages, and a web inspector. The hooks were also renamed: `useCopilotAction` → `useFrontendTool`, `useCopilotReadable` → `useAgentContext`. assistant-ui likewise shipped an agnostic core runtime.

OpenAI Agents JS is also closer than assumed — `needsApproval`, `interruptions[]`, sticky approve/reject, durable `RunState`, and guardrails that re-run after approval "in case the tool call became unsafe while waiting," which is adjacent to snapshot equality. **We are hardening a known failure mode, not discovering one.**

**Position after research.** Framework-agnostic actuation is table stakes, and WebMCP (`document.modelContext.registerTool`, Chrome origin trial) is standardizing tool registration into the browser. Concierge does not compete there — WebMCP becomes a *transport*. What remains uncommoditized is the interval between the agent deciding to act and the effect landing. Verified absent from CopilotKit, AI SDK 6, OpenAI Agents JS, MCP, and WebMCP: graded consent with build-time transport mismatch failure, user-turn binding, snapshot-equality invalidation, delivery-armed consent, reference-identity dedup, and fail-closed redaction. **Everyone else ships a confirmation boolean.**

**Decisions already encoded in the repo.** `README.md` carries the six-point design contract. `packages/concierge/src/types.ts` is the type surface and compiles clean. `CONTRIBUTING.md` lists the non-negotiables. These are inputs to planning, not open questions.

**Hard-won constraints from the source system** (each is a build-time error or a test in Concierge, not documentation):
- Root JSON Schema must be `type: "object"`. A discriminated union emits `{oneOf: []}` with no root type; OpenAI Realtime rejects the entire session update and the agent silently loses every action in that stage.
- `dispatch` must not be `async` — an async wrapper allocates a fresh Promise per invocation and breaks dedup by identity.
- `JSON.stringify` in a fallback dedup key throws synchronously on circular refs, and in a non-async dispatch that throw escapes and hangs the session.
- Registration unsubscribers must be identity-guarded — React StrictMode, Vue HMR, and Svelte remounts all produce stale cleanups.
- Bridge snapshots must be getters, not values; values captured at registration go stale inside handler closures.
- Consent must bind to user-turn identity, not response id — an agent can create a new response by itself, it cannot create a new user turn.
- Consent must arm on delivery, not on tool return; the tool returns before the human has heard or read anything.

## Constraints

- **Tech stack**: TypeScript, pnpm workspace, Node ≥20. Core is dependency-free.
- **Compatibility**: Core must construct on the server under Next App Router, Nuxt, and SvelteKit with no environment guards — no top-level `window`, `document`, or `navigator`.
- **Compatibility**: Framework adapters must stay around ~150 LOC. An adapter meaningfully larger than that means logic has leaked out of core, and is treated as a core bug.
- **Security**: Redaction is required for any action with a non-empty schema and defaults to `drop`. Telemetry leaks must be opt-in.
- **Security**: Handler exceptions never reach the model or telemetry — a generic sentence is the entire externally-visible surface of a crash. Thrown messages echo user input and would become a covert PII channel.
- **Licensing**: MIT, public. Chosen over FSB's BSL 1.1 because BSL on an npm library requires a commercial license for production use, which hard-caps adoption of an SDK.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Name it Concierge, not a voice-flavored name | The noun is agent actuation of a cooperating app; voice is one transport. Naming it for voice would cap the audience and misdescribe the core. | — Pending |
| Transport interface from day one | Welding to OpenAI Realtime's event names makes the library a bet on one vendor's wire protocol. A text sidebar, MCP client, or command palette must be first-class. | — Pending |
| Standard Schema v1 as a real dependency, instead of a Zod peer dep | Keeps core open to Valibot/ArkType/Effect Schema. `@standard-schema/spec` is depended on rather than inlined — research verified its ESM runtime entry is 0 bytes with zero dependencies, so "core is dependency-free" holds in substance while the inlined copy had already drifted from the spec in four places. No `concierge-zod` bridge: Standard JSON Schema (`~standard.jsonSchema`) makes it unnecessary, and the `jsonSchema?` escape hatch covers valibot, which does not implement the companion spec despite its docs. | ✓ Resolved 2026-07-27 |
| Consent is *graded*, and mismatches fail at build time | "The human perceived the readback" is only guaranteed on some transports. Voice guarantees it; a text sidebar does not; headless has no human. Silent degradation here is the worst possible failure. | — Pending |
| Ship a non-React adapter *with* v0.1, not after | Building React-first and porting later produces a hooks-shaped core. The non-React adapter is what forces React-isms out. | — Pending |
| MIT + public over BSL 1.1 | FSB is BSL, but BSL on a library people are meant to `npm install` blocks production use without a commercial license. | — Pending |
| Devtools treated as a v0.3 deliverable, not a nice-to-have | Adoption risk is the instrumentation cost of bridges. People need to see the kernel working before instrumenting five pages. | — Pending |
| Consent kernel moves into v0.1 | Framework-agnostic actuation is table stakes and WebMCP is commoditizing registration. Without consent, v0.1 is a strictly worse CopilotKit. Testable with a stub transport — no WebRTC needed. | — Pending |
| The non-React adapter is Svelte, and ships with v0.1 | Svelte `$state` is a Proxy, so a stored consent snapshot is a live view and the drift check passes unconditionally. Invisible in a React-only suite. Solid would validate nothing — its `Accessor<T>` already *is* our contract. | — Pending |
| Consent grades renamed: `perceived` → `relayed` / `attested` | `perceived` conflated "audio finished" with "the human learned the facts." `ActionResult.message` reaches the human *through* the agent, which reauthors it — OWASP ASI09. Only `attested` (raw payload rendered by the app) survives. | — Pending |
| ESM-only | Dual-package hazard splits the bridge registry, dedup window, and consent kernel. Non-breaking to add CJS later. | — Pending |
| `engines.node: ">=22.12.0"` | Node 20 reached EOL 2026-04-30, and 22.12 is the exact floor where `require(esm)` is unflagged — the previous `>=20` promised CJS consumers a runtime that would throw `ERR_REQUIRE_ESM`. | — Pending |
| `isolatedDeclarations: true` | TypeScript 7.0 ships no compiler API, which degrades dts generation. This routes the build through oxc: measured 25ms vs 1064ms, and it also removes the case for Turborepo (per-task overhead exceeds the build). | — Pending |
| Consent grades are modality-free | Asking "how does `attested` work on voice" was the wrong question — it smuggled modality back into a contract that had already rejected it. The real axes are content provenance (agent paraphrase vs app-rendered payload) and confirmation provenance (inferred vs a human act bound to that payload's hash). `attested` requires an app-rendered raw-payload surface plus an observed act on it; whether the app also speaks is irrelevant. Every app has a surface, so no product class is capped below `attested`. | ✓ Resolved 2026-07-27 |
| Turn identity has *provenance*, not just presence | A shipped implementation showed the microphone picks up the assistant's own TTS and the recognizer transcribes it as user speech. On a voice transport `userTurnId` is recognizer-derived — so the agent's own output can mint a new user turn, which is exactly what `bindTo: "userTurn"` accepts as proof a human acted. PITFALLS P2 covers a human barging in and prescribes turn classification, which does not catch this: an echoed readback transcribes as affirmative content, not as "stop". `TransportCapabilities` is implemented by consumers, so widening it after publish is breaking. | ✓ Resolved 2026-07-27 (TRN-05, Phase 1) |
| `readsUntrusted` is enforced, not declared-only — and it is the only taint field | An unenforced safety marker sitting beside a redaction policy that genuinely fails closed is this project's named failure mode in miniature. `maxPerTurn` is runner-level in every framework checked; `impact` duplicates the already-gated `consent.minGrade`; `conflictsWith` has no prior art and is covered by stage scoping plus `requires` plus serial batch order. | ✓ Resolved 2026-07-27 (SEC-05, Phase 3) |
| The server consent artifact is *inbound*, and v0.1 produces nothing | Every prior art puts minting authority where page JavaScript cannot reach — WebAuthn's challenge is server-generated *and server-stored*. A client-minted token, in a threat model where every third-party script has identical authority, is decorative and reads stronger than it is. So: reserve a server-issued, client-echoed `challenge?`, typed but never produced until v2. | ✓ Resolved 2026-07-27 (Phase 1) |
| The readback sink returns a receipt, and core owns canonicalization | A bare hash string makes canonicalization the app's bug, and the collision is real: `JSON.stringify({amount: 4180, coupon: undefined})` is byte-identical to `{amount: 4180}`. JCS (RFC 8785) in core, digest injected via a `DigestLike` structural stand-in — `crypto`, `TextEncoder`, and `btoa` are all absent under `lib: ["ES2022"]`. Carrying the canonical bytes alongside the hash follows WebAuthn's reason for making `clientDataJSON` opaque: intermediaries must not parse-and-reserialize. | ✓ Resolved 2026-07-27 (Phase 1) |
| The agent may not narrate a failure | A shipped implementation discards the model's text entirely when any result failed and speaks the app's own failure messages instead. This is a cheap, structural mitigation of the ASI09 reauthoring problem that sits below `attested` — and Concierge had nothing between `delivered` and `attested` doing it. | ✓ Resolved 2026-07-27 (CON-10, Phase 8) |
| Core is a `peerDependency` of every adapter | Structurally forces a single core instance. Two instances is not a performance problem, it is a correctness one, and it breaks all three load-bearing subsystems at once: a component registers into instance A while a handler reads instance B, so `bridge` is `null` forever on a page that is definitely open; dedup by Promise reference identity gets two windows, so a retried call double-fires — precisely the double-payment the design exists to prevent; and consent armed on instance A is invisible to instance B, so the kernel either fails closed everywhere or splits the review/confirm pair. A pinned dependency permits duplicate installs to resolve silently; a peer range makes a mismatch an install-time error with an actionable message. Accepted cost: diverges from TanStack, which pins, and makes install docs marginally harder. Same invariant already served by ESM-only, `engines.node >=22.12.0`, and `isolatedDeclarations`. | ✓ Resolved 2026-07-28 (PKG-04, Phase 2) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-27 after the Phase 1 discussion and milestone correction pass (57 → 62 requirements)*
