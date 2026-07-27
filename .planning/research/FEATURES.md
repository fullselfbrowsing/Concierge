# Feature Research

**Domain:** In-app AI agent actuation SDK (typed, consent-gated actions declared by a cooperating web app)
**Researched:** 2026-07-27
**Confidence:** HIGH for competitor API surfaces (verified against live docs, npm registry metadata, and spec repos). MEDIUM for adoption/market-share claims.

---

## Executive Answer to the Two Questions That Matter

**1. Is there already a framework-agnostic (non-React) option in this space?**

**Yes. Three of them, and all three landed in the last four months.** This is the single most important finding in this document.

| Package | What it is | First published / version | Verified |
|---|---|---|---|
| `@copilotkit/core` | Framework-agnostic core runtime (rxjs + `@ag-ui/client`, no React) | created 2026-03-29, `1.63.2` | npm registry |
| `@copilotkit/angular` / `@copilotkit/vue` | First-party non-React adapters | `0.3.0` / `1.63.2` | npm registry |
| `@copilotkit/web-components` | "Framework-agnostic shadow-DOM web components" | `1.63.2` | npm registry |
| `@assistant-ui/core` | "Framework-agnostic core runtime for assistant-ui" | `0.2.22`, published 2026-07-26 | npm registry |
| `document.modelContext` (WebMCP) | Framework-agnostic **browser platform API** | Chrome 149 origin trial, May 2026 | W3C spec repo |

**Consequence for the roadmap:** "Ship a non-React adapter with v0.1" was recorded in PROJECT.md as a differentiating decision. It is no longer differentiating — it is table stakes, and we are arriving *after* the incumbents rather than ahead of them. The decision is still *correct* (it prevents a hooks-shaped core), but it must be re-labeled as a cost of entry, not a competitive advantage. Roadmap budget currently allocated to framework breadth should be re-allocated to the consent kernel.

**2. What is actually still differentiated?**

The safety kernel — and only the safety kernel. Specifically: graded consent with build-time transport mismatch failure, user-turn binding, snapshot-equality invalidation, delivery-armed consent, reference-identity dedup, and mandatory fail-closed redaction. I verified each of these against CopilotKit, Vercel AI SDK 6, OpenAI Agents SDK (JS), the MCP spec, and the WebMCP spec. **Nobody has them.** Everyone has a confirmation boolean.

---

## The Elephant: WebMCP Is Standardizing Our Layer (a)

This did not appear in PROJECT.md's "Prior art to position against" and it dominates the landscape.

**What it is.** WebMCP is a W3C proposal from the Web Machine Learning Community/Working Group, edited by Google and Microsoft engineers. It lets a web page declare typed tools directly to a browser agent:

```js
const controller = new AbortController();
await document.modelContext.registerTool({
  name: "add-todo",
  description: "Add a new item to the user's active todo list",
  inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  async execute({ text }) {
    await addTodoItemToCollection(text);
    return { content: [{ type: "text", text: `Added todo item: "${text}" successfully.` }] };
  }
}, { signal: controller.signal });
```

**Status (verified July 2026):** Chrome 146 flag preview (Feb 2026) → Chrome 149 **public origin trial** (announced 2026-05-19), running through Chrome 156. Spec namespace is `document.modelContext`; Chrome's origin trial still ships the deprecated `navigator.modelContext` (deprecated in Chrome 150). Edge is flag-gated experimental. Firefox and Safari participate in spec discussions but have **not committed to implementation**.

**Its framing is nearly verbatim our README.** From the explainer's "Existing web actuation techniques" section: general-purpose agents "rely on observing the browser state through a combination of screenshots, and DOM and accessibility tree snapshots, and then interact with the page by simulating human user input… WebMCP will give these tools an alternative means to interact with the web that give the web developer more control." It even preserves generic automation as the documented fallback — which is exactly the FSB/Concierge split.

**The hole in it is exactly our Core Value.** From the explainer's Open Questions:

> **User prompting and elicitation**: Exploring a way for a tool to prompt the user for confirmation when tools require explicit user authorization. This could be done by delegating to the agent and its harness, or by invoking native browser permission dialogue outside of the agent loop. See Issue #165 and Issue #50.

Consent is an **unresolved open question** in the standard. (Note: several 2026 blog posts claim a `requestUserInteraction()` method exists. It is **not** in the current explainer — I grepped the spec repo README directly. Treat those posts as stale. Source conflict resolved in favor of the spec repo.)

**Adoption reality check (MEDIUM confidence, single well-sourced analysis):** "a standard with everything except users." Named pilots exist (Expedia, Booking.com, Shopify) but deployment is unconfirmed, and **no mainstream AI agent consumes WebMCP tools yet**. Supply side is ready; demand side has not arrived.

**Strategic implication:** WebMCP is not a competitor to route around — it is a **transport we should adapt to**, and its consent gap is our wedge. A `@fullselfbrowsing/concierge-webmcp` package that emits our stage-scoped catalog through `document.modelContext.registerTool()` while keeping our consent kernel in front of `execute` is the single highest-leverage package not currently in the plan. Its `{signal}` unregistration model also maps cleanly onto our identity-guarded unsubscriber contract.

Other WebMCP open questions that overlap our design: build-time schema validation (#92), "Skills Integration" for grouping tools by user journey (#161 — this is stage-scoped catalogs), `outputSchema` (#9), and **cross-document tool response** (#135 — what happens to a tool result when the tool navigates the page; our `navigate` cross-stage action has this identical problem).

---

## Competitor Matrix: The Four Questions

For each: (a) how the agent learns what it can do, (b) how the app exposes live state, (c) how irreversible actions are gated, (d) framework breadth.

### CopilotKit — the closest competitor, and it moved

CopilotKit shipped a **v2** API. PROJECT.md references `useCopilotAction` / `useCopilotReadable`; both are v1 names and are being migrated away from.

| | Answer |
|---|---|
| **(a) Discovery** | v1 `useCopilotAction({name, description, parameters: [...], handler, render})` with a bespoke parameter-descriptor array. **v2 renames it `useFrontendTool` and switches to Zod schemas** (`parameters: z.object({...})`). Tools are passed to the agent via AG-UI `RunAgentInput.tools`; the frontend determines available capabilities. |
| **(b) Live state** | v1 `useCopilotReadable({description, value})`. **v2 renames it `useAgentContext`.** The value is **JSON-serialized and registered as context**, removed on unmount. v2 also **removed hierarchical context** (`parentId`) — migration guidance is to flatten manually. |
| **(c) Consent** | `useHumanInTheLoop` (LLM-initiated, `render` prop + `respond()`) and `useInterrupt` (LangGraph `interrupt()`-driven). CopilotKit's own docs say both "ship with a `render` prop — CopilotKit handles the 'when to show the picker' logic for you." **Enforcement of what counts as consent is entirely inside the developer's `render` implementation.** No user-turn binding, no snapshot equality, no transport capability negotiation. |
| **(d) Frameworks** | React, **Angular**, **Vue**, framework-agnostic `@copilotkit/core`, framework-agnostic web components. AG-UI has community clients in Go, Rust, and Java. |

**Critical difference on (b):** CopilotKit passes **values**, we pass **getters**. Their model is "serialize app state into the agent's context on every run." Ours is "the handler reads through a getter at call time." Theirs is simpler and works for context; ours is required for correctness when the handler mutates and then reads back. This is a genuine, defensible, *small* technical differentiator — and it is the one that makes our bridge contract portable (`() => ref.current` / `() => ref.value` / `() => rune` / `() => signal()`).

**They also already have devtools.** `@copilotkit/web-inspector` — `<CopilotKitWebInspector />`, lazy-loaded, gated behind `showDevConsole="auto"` which evaluates false in production. It shows AG-UI events, error events, agent state snapshots, and tool call lifecycles. Our v0.3 devtools overlay is therefore **table stakes, not a bonus**.

**And they have voice.** `@copilotkit/voice` (transcription, TTS).

### Vercel AI SDK 6 — server-first, but the approval story changed

PROJECT.md says AI SDK "has no client actuation or consent story." **Both halves of that are now out of date.**

| | Answer |
|---|---|
| **(a) Discovery** | `tool({description, inputSchema, execute, strict})`. `inputSchema` accepts Zod or raw JSON Schema. **`execute` is optional** — the docs state it is optional "because you might want to forward tool calls to the client or to a queue instead of executing them in the same process." That *is* a client actuation story: tools without `execute` surface on the client via `onToolCall`, and results return via `addToolResult`. |
| **(b) Live state** | None. No bridge concept. State goes into messages/system prompt, or `runtimeContext`/`toolsContext` as per-call values. **This remains a real gap in their product.** |
| **(c) Consent** | **`needsApproval: boolean \| async ({input}) => boolean`**, built in as of AI SDK 6. Produces `tool-approval-request` parts; client resolves with `addToolApprovalResponse({ id, approved })`. Approval statuses: `not-applicable \| approved \| denied \| user-approval`. Vercel's own framing: "human-in-the-loop control with a single `needsApproval` flag, requiring no custom code." |
| **(d) Frameworks** | Framework-agnostic core with React/Svelte/Vue/Angular UI bindings. |

**Also relevant:** `prepareStep` can return `activeTools: string[]` and `toolChoice` per step — dynamic tool scoping exists, but scoped to *agent step number*, not *app state*. And AI SDK 6 added MCP elicitation support and OAuth for remote MCP.

**Telemetry contrast worth noting:** AI SDK's `recordInputs` / `recordOutputs` **default to `true`** — tool definitions and arguments are captured unless you opt out. That is fail-open. Our mandatory-`drop` redaction is fail-closed. This is a real, articulable safety difference.

### OpenAI Agents SDK (JS) — the most sophisticated HITL in the ecosystem

This is the strongest prior art on consent and we should not understate it.

| | Answer |
|---|---|
| **(a) Discovery** | `tool()` with Zod params; agents-as-tools via `agent.asTool()`. |
| **(b) Live state** | `RunContext`; no live-state bridge. |
| **(c) Consent** | `needsApproval: true \| async fn`. Pending calls surface as `RunToolApprovalItem` in `result.interruptions[]`. Resolve with `result.state.approve(item)` / `.reject(item, { message })`, plus sticky `{ alwaysApprove: true }` / `{ alwaysReject: true }`. **Durable pause:** `result.state.toString()` → store in a DB → `RunState.fromString(agent, serialized)` resumes across process restarts, with `fromStringWithContext(..., { contextStrategy: 'merge' \| 'replace' })`. Guardrails: `toolExecution: { preApprovalInputGuardrails: true }`, and input guardrails **re-run after approval** "in case the tool call became unsafe while waiting." |
| **(d) Frameworks** | JS/TS and Python. Not a UI library, so no adapters needed. |

**Realtime/voice** (directly relevant — this is our transport #1): `needsApproval: true` emits a `tool_approval_requested` event; resolve with `await session.approve(request.approvalItem)` / `session.reject(...)`. Their docs carry this caveat: *"While the voice agent is waiting for approval for the tool call, the agent will not be able to process new requests from the user."*

**Honest assessment:** re-running guardrails after approval is the closest anyone comes to our snapshot-equality invalidation. It is **not the same thing** — it re-validates the *arguments* against a policy, it does not compare a *field-by-field snapshot of what the human was told* against what is about to execute, and it binds the approval to nothing. But it proves the ecosystem understands the "state drifted while we waited" failure mode. We are refining a known problem, not discovering one.

They also handle a secrets concern: tracing API keys are omitted from serialized state by default, and their docs warn that `runContext.context` should be treated as persisted data.

### assistant-ui — adjacent, not competing

Chat-UI product. `makeAssistantTool` / `makeAssistantToolUI` register client tools with Zod schemas and render props — but **these are marked deprecated compatibility APIs**, migrating to "use generative" + Toolkits. React-first (`@assistant-ui/react` 0.14.28), but `@assistant-ui/core` is now billed as a framework-agnostic core runtime. **No consent kernel.** Their value is the chat surface, which we explicitly do not build.

### MCP — the vocabulary developers now arrive with

MCP is not a competitor; it is the **convention set our users will expect us to speak**. Verified against the `2025-11-25` schema.

**Tool annotations** (`ToolAnnotations`), with exact defaults from `schema/2025-11-25/schema.ts`:

| Field | Meaning | Default |
|---|---|---|
| `readOnlyHint` | Tool does not modify its environment | `false` |
| `destructiveHint` | May perform destructive updates (meaningful only when `readOnlyHint == false`) | **`true`** |
| `idempotentHint` | Repeated calls with same args have no additional effect | `false` |
| `openWorldHint` | Interacts with an open world of external entities | `true` |

Note `destructiveHint` defaults to **true** — MCP itself fails closed on destructiveness. The spec is also blunt that these are hints: *"all properties within this interface are considered hints and are not guaranteed to be a faithful representation of actual tool behavior"* and clients *"MUST consider tool annotations to be untrusted unless they come from trusted servers."* In Concierge they can be trustworthy, because the app author and the catalog author are the same person — that is a real story to tell.

**Elicitation** (`elicitation/create`) has two modes and a three-action response model:
- `mode: "form"` — structured data, restricted to flat objects of primitives
- `mode: "url"` — out-of-band navigation; data does not pass through the client
- Response `action`: **`accept` / `decline` / `cancel`** — deliberately distinguishing an explicit refusal from a dismissal

**And this MUST directly validates one of our Out of Scope items:**

> Servers **MUST NOT** use form mode elicitation to request sensitive information such as passwords, API keys, access tokens, or payment credentials. Servers **MUST** use URL mode for interactions involving such sensitive information.

Our "card capture or credential entry by agent — structurally refused" is not an idiosyncratic opinion. It is the ecosystem's normative position, and we can cite the spec.

MCP's overall HITL posture: *"For trust & safety and security, there SHOULD always be a human in the loop with the ability to deny tool invocations."*

### Generative UI (Thesys C1, A2UI) — different product class

Thesys C1 is an OpenAI-compatible API where **the LLM generates the UI itself**, streamed and rendered as React components. A2UI is Google's declarative generative-UI spec (streaming JSON, platform-agnostic); AG-UI is CopilotKit's runtime/transport layer. Neither A2UI nor AG-UI contains any consent, permission, or approval concept — verified.

This matters as a **boundary**, not a competitor. CopilotKit's action definitions carry a `render` prop, and they ship `@copilotkit/a2ui-renderer`. The gravitational pull toward "and it renders UI too" is strong and we should name it as an anti-feature before it eats a phase.

---

## Feature Landscape

### Table Stakes (Absence = developers bounce)

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Typed action declaration → emitted JSON Schema | Universal. CopilotKit, AI SDK, OpenAI Agents, MCP, WebMCP all do it. | LOW | Already in `ActionDefinition`. |
| Schema-library agnosticism (Standard Schema v1) | Zod 4 / Valibot / ArkType all implement it; MCP TS SDK has an open adoption issue. Hard-coding Zod now reads as dated. | LOW | Already inlined in `types.ts`. Correct call, but it is table stakes — not a differentiator. |
| Live app state readable by handlers | CopilotKit `useAgentContext`. Without it, handlers can only act, never ground. | MEDIUM | Our getter-based bridge is a *better* answer to a table-stakes need. |
| **Some** human-in-the-loop approval hook | AI SDK 6 `needsApproval`, OpenAI Agents `needsApproval`, CopilotKit `useHumanInTheLoop`, MCP "SHOULD always be a human in the loop". | MEDIUM | A library shipping v0.1 with **no** confirmation primitive is now strictly behind three incumbents. See MVP note. |
| Framework-agnostic core + ≥1 non-React adapter | CopilotKit ships React+Angular+Vue+web-components; assistant-ui ships a framework-agnostic core. | MEDIUM | **Reclassified from differentiator.** |
| Cleanup-on-unregister that survives remounts | WebMCP uses `AbortSignal`; React StrictMode/HMR make naive cleanup wrong. | LOW | Our identity-guarded unsubscriber is the correct implementation of a table-stakes feature. |
| Result carries a human-readable sentence | MCP content blocks; every chat surface needs something to say. | LOW | Our `{ok, reason, message}` is tighter than MCP's content array. |
| SSR-safe construction (no top-level `window`/`document`) | Everyone targeting Next App Router / Nuxt / SvelteKit needs it. | LOW | Already a constraint; `AbortSignalLike` avoids pulling in the DOM lib. |
| Dynamic / scoped tool sets | AI SDK `activeTools` via `prepareStep`; AG-UI lets the frontend decide tools "based on permissions and application state". | MEDIUM | Dynamism is table stakes; *declarative stage matching* is the differentiated part. |
| Cancellation of an in-flight action | `AbortSignal` is the platform idiom; WebMCP uses it. | LOW | `AbortSignalLike` present in `InvocationMeta`. |
| Dev inspector / overlay | `@copilotkit/web-inspector` exists today, lazy-loaded and localhost-gated. | MEDIUM | **Currently scheduled v0.3. That is too late** given our own PROJECT.md notes adoption risk is bridge instrumentation cost. |
| Side-effect annotation vocabulary (`readOnly` / `destructive` / `idempotent`) | Every developer arriving from MCP expects to declare this. | LOW | **Gap.** `ActionDefinition` has `consent?` and `terminal?` but no side-effect class. Also blocks `concierge-mcp` from emitting annotations. |
| Explicit decline vs. dismissal distinction | MCP's three-action `accept`/`decline`/`cancel` model. | LOW | We have `USER_STOPPED` (`reason: "user-stopped"`). Partial — no way to distinguish "the human said no" from "the human walked away," which matters for what the agent says next. |

### Differentiators (Verified: nobody else has these)

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Graded consent + build-time transport mismatch failure** | Everyone has a confirmation *boolean*. Nobody models what a transport can *promise*. `consentGrade: "perceived" \| "delivered" \| "none"` + `minGrade` that throws at `buildCatalog` is genuinely novel. Verified absent from CopilotKit, AI SDK 6, OpenAI Agents, MCP, WebMCP. | HIGH | **This is the product.** The pitch is one sentence: *"Your booking confirmation refuses to compile on a transport that can't prove the human heard it."* |
| **Consent bound to user-turn identity** | "An agent can create a new response by itself, it cannot create a new user turn." No competitor binds approval to anything — approval is a free-floating boolean keyed by `toolCallId`. | MEDIUM | Depends on the transport surfacing `userTurnId`. Realtime does; a text sidebar needs the adapter to synthesize it. Verify per transport. |
| **Snapshot-equality invalidation between review and confirm** | OpenAI Agents re-runs *guardrails* after approval ("in case the tool call became unsafe while waiting") — closest prior art, but it validates arguments against policy, not against what the human was told. | MEDIUM | Be precise in messaging: we are hardening a failure mode the ecosystem has already named, not revealing one. |
| **Consent arms on delivery, not on tool return** (`deferUntilDelivered`) | The tool returns before the human has heard or read anything. Nobody else models this gap at all. | HIGH | The mechanism that makes `perceived` meaningful rather than aspirational. |
| **Reference-identity dedup (same Promise for retries in window)** | The ecosystem's answer is a pile of blog posts about idempotency keys, dedupe ledgers, and outbox patterns — i.e. *developer homework*. No actuation SDK builds it in. | MEDIUM | Real gap, but **weak as a headline**: developers do not shop for it. Sell it as "you cannot double-fire a payment," not as "reference-identity dedup." |
| **Mandatory redaction, required field, defaults to `drop`** | AI SDK telemetry defaults `recordInputs: true` — fail-open. Nobody makes redaction a *required* field of the action declaration. | LOW | Cheap to build, easy to demo, and the strongest "we are the serious one" signal per unit of effort. |
| **Build-time JSON Schema root validation (`type: "object"`)** | WebMCP lists native schema validation as open question #92. Nobody checks the root-type constraint that silently kills an entire OpenAI Realtime session. | LOW | Small, sharp, and a great README anecdote. High credibility-per-line-of-code. |
| **Declarative stage-scoped catalogs matching arbitrary app context** | WebMCP's "Skills Integration" (#161) is the same idea, unresolved. AI SDK's `activeTools` is step-scoped, not state-scoped. | MEDIUM | Differentiated as a *declarative* concept. Do not overclaim — dynamic tool lists exist everywhere. |
| **Getter-based bridge snapshots** | CopilotKit serializes **values** into context. Getters read through at call time and are the same shape across React refs, Vue refs, Svelte runes, and Angular signals. | LOW | Our most portable idea, and the thing that keeps adapters at ~150 LOC. |
| **Commit window before side effects** | Nobody has it. Note the contrast with OpenAI Realtime, where waiting for approval *blocks the agent from hearing the user* — ours lets the human interrupt without blocking. | MEDIUM | Pairs naturally with `perceived` grade. |
| **Trustworthy annotations** | MCP mandates clients treat annotations as untrusted. In Concierge, catalog author == app author, so `destructive: true` is a fact, not a hint. | LOW | Free positioning win once the annotation field exists. |

### Anti-Features (Do NOT build)

Carried from PROJECT.md Out of Scope, plus four new ones the competitive landscape surfaced.

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Generic actuation (`click`, `execute_js`, coordinate tools) | "Just one escape hatch for the case we forgot." | The catalog **is** the security boundary; an escape hatch destroys it. WebMCP independently keeps generic automation as an out-of-band fallback rather than an in-catalog tool. | FSB. Document the split. |
| Third-party site automation | Same-shaped problem, adjacent demand. | Different product class: ToS, captcha, 2FA exposure. | FSB. |
| Voice-first framing | Voice demos best, and it is our transport #1. | Welds core to WebRTC and one vendor's event names; caps audience at voice-UI builders. CopilotKit already treats voice as a *package* (`@copilotkit/voice`), not the noun. | Transport interface from day one. |
| Hard Zod dependency | Simplest DX. | Welds to one validator's release cadence; excludes Valibot/ArkType/Effect Schema. Ecosystem has converged on Standard Schema v1. | Inlined Standard Schema v1 + `concierge-zod` bridge for JSON Schema emission. |
| Typed packages for Rails/Laravel/Django/Phoenix | "The bridge pattern works there too." | N× maintenance surface for a pattern that is already documentable. | One documented pattern + one reference example. |
| Long-term procedural memory / site guides | FSB has it and it is impressive. | Irrelevant when the app declares its own verbs — there is nothing to *learn*. | Nothing. Delete the idea. |
| Card capture / credential entry by agent | "Users will ask for it." | **MCP spec MUST-NOT.** Form-mode elicitation for passwords, API keys, tokens, or payment credentials is prohibited; URL mode is mandatory. | Structural refusal + link to the MCP normative text. |
| **NEW — Generative UI / `render` props on actions** | CopilotKit actions carry `render`; A2UI and Thesys C1 make it look like the future. | Drags a UI framework into a core we promised has zero DOM access, and forks every adapter into a renderer. Actions return a **sentence**; the transport decides how to present it. | Emit `{ok, reason, message}`. Let the host chat surface render. |
| **NEW — A chat UI** | Every competitor has one; it is the obvious demo. | assistant-ui and CopilotKit have multi-year head starts and it is not our Core Value. Building one converts us from a safety kernel into a fifth-place chat library. | Ship with no transport at all as a first-class mode; integrate with existing surfaces. |
| **NEW — An agent loop / model calling** | "Just make it work end to end." | AI SDK `ToolLoopAgent` and OpenAI Agents own this and are far ahead. Owning the loop means owning provider adapters forever. | Consume a loop. Be the layer between the loop and the app. |
| **NEW — Reimplementing / competing with WebMCP** | "We got there first conceptually." | Google + Microsoft + a Chrome origin trial. Competing with the browser platform on tool *registration* is unwinnable and unnecessary — the platform left consent unspecified. | `@fullselfbrowsing/concierge-webmcp` as a transport. Be the kernel in front of `execute`. |

---

## Feature Dependencies

```
Action DSL (defineAction / defineStage)
    └──requires──> Standard Schema v1 interop
    └──requires──> JSON Schema emission
                       └──requires──> root-type validation (type: "object")

Dispatcher (non-async, by design)
    └──requires──> Action DSL
    └──enables───> reference-identity dedup
                       └──requires──> callId-primary dedup key
                                          (NEVER JSON.stringify fallback — throws
                                           synchronously on circular refs, and in a
                                           non-async dispatch that throw hangs the session)

Bridge registry (getters, identity-guarded unsubscribe)
    └──requires──> nothing (independent of dispatcher)
    └──enables───> handlers that read live state
    └──enables───> Framework adapters (~150 LOC each)

Stage matching
    └──requires──> Action DSL
    └──enables───> stage-scoped catalogs
                       └──requires──> Transport.setTools + capabilities.dynamicCatalog

Consent kernel
    └──requires──> Dispatcher (must intercept before handler)
    └──requires──> Transport.capabilities.consentGrade    ← build-time gate
    └──requires──> InvocationMeta.userTurnId              ← transport must supply
    └──requires──> InvocationMeta.deferUntilDelivered     ← arms on delivery
    └──requires──> snapshot equality fn                   ← per-action

Redaction
    └──requires──> Action DSL only
    └──independent of everything else                     ← can ship in the first phase

Devtools overlay
    └──requires──> Bridge registry + stage matching + catalog
    └──requires──> nothing from the consent kernel

WebMCP transport
    └──requires──> Transport interface + catalog emission
    └──consent grade: "delivered" at best (no perception guarantee in the platform)

Side-effect annotations (readOnly / destructive / idempotent)
    └──requires──> Action DSL only
    └──enables───> concierge-mcp emitting MCP ToolAnnotations
    └──enhances──> consent kernel (destructive ⇒ consent required, lintable)
```

### Dependency Notes

- **Consent kernel requires `Transport.capabilities`, so the transport interface cannot be deferred.** This is already encoded in `types.ts` and is the right call — but it means consent cannot be a bolt-on phase after v0.1 without the v0.1 transport interface already carrying `consentGrade`. It does.
- **`userTurnId` is a transport obligation, not a core one.** Core can only *check* it. Every transport adapter must document how it derives one. A transport that cannot derive one can only ever offer `bindTo: "response"`, which is weaker. This should be an explicit acceptance criterion on every transport package.
- **Redaction is fully independent.** It requires only the action DSL. Given it is cheap, fail-closed, and a strong trust signal, there is no reason to defer it past the first shipped phase.
- **Side-effect annotations are independent and cheap**, and they unlock a lint (`destructive: true` without a `consent` policy is almost certainly a bug). That lint is a differentiator disguised as a small feature.
- **Dedup conflicts with naive "make dispatch async."** The constraint that `dispatch` must not be `async` is a *load-bearing dependency* of dedup, not a style preference. Any refactor that adds `async` silently breaks it, which argues for a test that asserts `dispatch(a) === dispatch(a)` by reference.
- **Devtools does not depend on consent**, so it can ship in parallel with the consent kernel rather than after it.

---

## MVP Definition

### Recommended change to the published roadmap

The README roadmap is:

- v0.1 — core: catalog DSL, dispatcher, dedup, bridge registry, matching. React + one non-React adapter.
- v0.2 — consent kernel with graded transports; server handlers.
- v0.3 — devtools overlay.
- v0.4 — Realtime transport; MCP executor.

**Recommendation: move the consent kernel into v0.1.**

The reasoning is not preference, it is competitive position. As of today, a v0.1 that ships catalog + dispatcher + dedup + bridge + framework adapters and **no consent** is a strictly worse CopilotKit: they have the same features plus Angular, Vue, web components, a web inspector, voice, chat UI, AG-UI, and distribution. Our entire reason to exist — "the human is structurally guaranteed to have consented, or the action does not run" — would be absent from the only artifact anyone can install.

PROJECT.md already states the principle: *"A library that makes agent actuation easy but consent optional is worse than nothing, because it will be used."* A v0.1 without consent **is** that library.

The counter-argument is that consent needs a transport to be demonstrable. That is true, and it is why `minGrade` failing at **catalog build time** is the right first deliverable: it is testable with a stub transport declaring `consentGrade: "none"`, no WebRTC required.

### Launch With (v0.1)

- [ ] Action DSL — `defineAction` with `name`, `description`, `schema`, `redact`, `handler` — *the single declaration everything derives from*
- [ ] JSON Schema emission **with root `type: "object"` validation that throws naming the action** — cheap, sharp, prevents a silent production failure
- [ ] Non-async dispatcher with reference-identity dedup, `callId`-primary keying, no `JSON.stringify` fallback — *the concurrency correctness core*
- [ ] Bridge registry with getter snapshots and identity-guarded unsubscribers — *the portability claim*
- [ ] Stage matching + stage-scoped catalog build — *the attack-surface claim*
- [ ] Mandatory `redact`, defaulting to `drop`, required for any non-empty schema — *independent, cheap, strongest trust-per-effort*
- [ ] Handler exception containment (generic sentence only, never the thrown message) — *stated constraint; must be a test, not a doc*
- [ ] Transport interface **including `capabilities.consentGrade`** — must exist in v0.1 or consent cannot be added without a breaking change
- [ ] **Consent: `minGrade` mismatch fails at catalog build time** — the differentiator, testable against a stub transport
- [ ] **Consent: `requires` + `bindTo: "userTurn"` + snapshot equality at dispatch** — the handshake
- [ ] React adapter + one non-React adapter (Vue or Svelte 5) — table stakes; the non-React one is what keeps core honest
- [ ] Side-effect annotations (`readOnly` / `destructive` / `idempotent`) — cheap, expected by every MCP-native developer, and enables the `destructive`-without-`consent` lint

### Add After Validation (v0.2)

- [ ] `deferUntilDelivered` / delivery-armed consent — needs a real transport to validate; `delivered` grade is meaningful before `perceived` is
- [ ] Commit window before side effects
- [ ] Devtools overlay — **pulled forward from v0.3**, because PROJECT.md identifies bridge instrumentation cost as the top adoption risk and CopilotKit already ships an inspector
- [ ] Fetch-standard server handlers (Next, Nuxt, SvelteKit, Remix, Hono, Bun, Deno, Workers)
- [ ] Explicit `declined` vs `cancelled` result reasons, mirroring MCP's three-action model
- [ ] Third framework adapter

### Future Consideration (v0.3+)

- [ ] OpenAI Realtime + WebRTC transport — the only transport that can honestly claim `perceived`; defer until the kernel is proven, because it is the most vendor-coupled surface
- [ ] `@fullselfbrowsing/concierge-webmcp` — **new, and higher priority than its novelty suggests.** Trigger: WebMCP demand side materializes (Gemini in Chrome consuming tools) or the origin trial extends past Chrome 156
- [ ] `@fullselfbrowsing/concierge-mcp` executor — depends on side-effect annotations existing
- [ ] `concierge-zod` JSON Schema emission bridge
- [ ] Documented non-JS full-stack pattern + one reference example
- [ ] Elicitation-style "action needs a missing field" primitive — MCP has it; we currently assume the agent asks conversationally, which is fine for chat and voice but not for a command palette

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Consent: build-time `minGrade` mismatch | HIGH | LOW | **P1** |
| Consent: `requires` + `userTurn` binding + snapshot equality | HIGH | MEDIUM | **P1** |
| Mandatory redaction, default `drop` | HIGH | LOW | **P1** |
| Root JSON Schema `type: "object"` validation | MEDIUM | LOW | **P1** |
| Non-async dispatcher + reference-identity dedup | HIGH | MEDIUM | **P1** |
| Bridge registry (getters + identity-guarded unsubscribe) | HIGH | MEDIUM | **P1** |
| Stage-scoped catalogs | HIGH | MEDIUM | **P1** |
| Action DSL + derived catalog | HIGH | MEDIUM | **P1** |
| Handler exception containment | HIGH | LOW | **P1** |
| Transport interface with `capabilities` | HIGH | LOW | **P1** |
| Side-effect annotations (`readOnly`/`destructive`/`idempotent`) | MEDIUM | LOW | **P1** |
| React adapter | HIGH | LOW | **P1** |
| One non-React adapter | MEDIUM | LOW | **P1** |
| `deferUntilDelivered` / delivery-armed consent | HIGH | HIGH | P2 |
| Devtools overlay | HIGH | MEDIUM | P2 |
| Commit window | MEDIUM | MEDIUM | P2 |
| Fetch-standard server handlers | MEDIUM | MEDIUM | P2 |
| `declined` vs `cancelled` distinction | MEDIUM | LOW | P2 |
| WebMCP transport | MEDIUM (rising) | MEDIUM | P2 |
| Realtime/WebRTC transport | HIGH | HIGH | P3 |
| MCP executor | MEDIUM | MEDIUM | P3 |
| Third/fourth framework adapter | LOW | LOW | P3 |
| `concierge-zod` bridge | LOW | LOW | P3 |
| Elicitation primitive | LOW | MEDIUM | P3 |

**Priority key:** P1 must have for launch · P2 should have, add when possible · P3 future consideration

**Note on the two LOW-value/LOW-cost P3 items:** extra framework adapters look attractive because they are cheap. They are a trap — each one is permanent maintenance surface for a capability CopilotKit already has in three frameworks. Ship exactly one non-React adapter until the kernel has users.

---

## Competitor Feature Analysis

| Feature | CopilotKit v2 | Vercel AI SDK 6 | OpenAI Agents JS | WebMCP (W3C) | Our Approach |
|---|---|---|---|---|---|
| Action declaration | `useFrontendTool` + Zod | `tool({inputSchema})` Zod or JSON Schema | `tool()` + Zod | `document.modelContext.registerTool` + raw JSON Schema | `defineAction` + Standard Schema v1 (validator-agnostic) |
| Live app state | `useAgentContext` — JSON-serialized **values**, flat (hierarchy removed in v2) | None (messages / per-call context) | `RunContext` | None | Bridge registry — **getter functions**, read through at call time |
| Approval / consent | `useHumanInTheLoop` + `useInterrupt`, `render`+`respond()`; enforcement lives in the developer's render | `needsApproval: bool \| fn` → `addToolApprovalResponse({id, approved})` | `needsApproval`, `interruptions[]`, `state.approve/reject`, sticky decisions, durable `RunState` serialization, guardrail re-run after approval | **Unspecified — Open Question #165** | **Graded**: transport declares `consentGrade`, action declares `minGrade`, mismatch **throws at catalog build**; bound to `userTurnId` + snapshot equality; armed on delivery |
| Consent binding target | none | `toolCallId` | none (free-floating boolean) | n/a | **user-turn identity** + field-level snapshot |
| Tool-set scoping | AG-UI `RunAgentInput.tools` (frontend decides, by permissions/app state) | `prepareStep` → `activeTools` (per **step**) | agent handoffs | per-document registration + `exposedTo` origins | **Declarative stages** matching arbitrary app context |
| Retry / dedup | not built in | not built in | not built in | not built in | Same Promise **by reference** within `dedupeWindowMs` |
| Redaction / telemetry | not a first-class field | `recordInputs`/`recordOutputs` **default true** (fail-open) | tracing keys excluded from serialized state | n/a | `redact` **required**, defaults `drop` (fail-closed) |
| Side-effect annotation | none | none | none | none (follows MCP result shape) | *Gap to close* — adopt MCP vocabulary, and it is trustworthy here |
| Framework breadth | React, Angular, Vue, web components, agnostic core | agnostic core + React/Svelte/Vue/Angular UI | n/a (not a UI lib) | browser-native, framework-agnostic | Agnostic core + React + one non-React |
| Devtools | `@copilotkit/web-inspector`, localhost-gated | — | tracing | — | Planned overlay (**pull forward**) |
| Chat UI | yes | yes (AI SDK UI) | no | no | **no — anti-feature** |
| Generative UI render | yes (`render` prop, `a2ui-renderer`) | yes | no | no | **no — anti-feature** |

---

## Honest Risk Assessment

Three things the roadmap should absorb rather than argue with:

1. **Our framework-breadth advantage evaporated between the source system's capture and today.** CopilotKit shipped Angular, Vue, a framework-agnostic core, and framework-agnostic web components in the four months before this research. Planning as though React-only incumbency still exists will produce a roadmap that spends its first milestone catching up to March 2026.

2. **Confirmation is solved-enough for most developers.** `needsApproval: true` is one line, ships in two major SDKs, and is what a developer will reach for. Our graded-consent argument is *correct* but requires the reader to first believe that "the human clicked approve" and "the human perceived the readback" are different things. That is a teaching burden, not a feature-list win — which means the README's booking example and a failing-build demo are load-bearing product surface, not marketing.

3. **WebMCP could make layer (a) free.** If Gemini in Chrome ships as a WebMCP consumer and the API graduates from origin trial, the value of "we let you declare typed verbs" drops toward zero, because the browser will do it. Everything we have left is the kernel. This *strengthens* the case for moving consent into v0.1 — it is the part with a durable moat.

The optimistic read: all three risks push in the same direction. Build the kernel first, keep the surface small, and be the layer everyone else left out.

---

## Sources

**CopilotKit** (HIGH — Context7 against the CopilotKit repo + npm registry + live docs)
- https://github.com/CopilotKit/CopilotKit — v1→v2 migration refs, Angular/Vue package sources, skills references
- https://docs.copilotkit.ai/agent-spec/human-in-the-loop — `useHumanInTheLoop`, `useInterrupt`
- https://docs.showcase.copilotkit.ai/reference/v1/hooks/useCopilotAction
- npm registry metadata for `@copilotkit/core` (created 2026-03-29, `1.63.2`), `@copilotkit/angular` (`0.3.0`), `@copilotkit/vue` (`1.63.2`), `@copilotkit/web-components`, `@copilotkit/web-inspector`, `@copilotkit/voice`
- https://www.copilotkit.ai/blog/ag-ui-and-a2ui-explained-how-the-emerging-agentic-stack-fits-together

**Vercel AI SDK** (HIGH — official docs + Vercel release post)
- https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling — `tool()`, optional `execute`, `toolApproval`, `prepareStep`/`activeTools`
- https://vercel.com/blog/ai-sdk-6 — `needsApproval` (bool or fn), `addToolApprovalResponse`, `ToolLoopAgent`, MCP elicitation/OAuth
- https://ai-sdk.dev/docs/ai-sdk-core/telemetry — `recordInputs` / `recordOutputs` defaults

**OpenAI Agents SDK (JS)** (HIGH — raw guide source from the openai-agents-js repo)
- `docs/src/content/docs/guides/human-in-the-loop.mdx` — `needsApproval`, `RunToolApprovalItem`, `interruptions`, `state.approve/reject`, `RunState.fromString`, `preApprovalInputGuardrails`
- `docs/src/content/docs/guides/voice-agents/build.mdx` — `tool_approval_requested`, `session.approve/reject`, blocking caveat

**MCP** (HIGH — spec repo schema + specification pages)
- `schema/2025-11-25/schema.ts` — `ToolAnnotations` exact fields and defaults
- https://modelcontextprotocol.io/specification/2025-06-18/server/tools — HITL SHOULD, untrusted-annotations MUST
- https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation — form/url modes, accept/decline/cancel, credential MUST-NOTs

**WebMCP** (HIGH for spec, MEDIUM for adoption)
- https://github.com/webmachinelearning/webmcp — explainer README: `document.modelContext.registerTool`, goals/non-goals, permissions policy, Open Questions incl. #165 consent
- https://developer.chrome.com/blog/ai-webmcp-origin-trial — Chrome 149 origin trial
- https://www.spronta.com/blog/state-of-webmcp-july-2026/ — adoption state (MEDIUM, single analysis)
- https://www.vietanh.dev/blog/2026-07-06-webmcp-agent-ready-website — practitioner attack-surface report (MEDIUM)
- https://patrickbrosset.com/articles/2026-02-23-webmcp-updates-clarifications-and-next-steps/ — **partially stale**; claims `navigator.modelContext` + `requestUserInteraction()`, neither of which matches the current explainer. Conflict resolved in favor of the spec repo.
- npm: `@mcp-b/webmcp-polyfill`, `@mcp-b/webmcp-types`, `@mcp-b/transports`, `@mcp-b/react-components` (all `4.0.0`/`0.31.1`, July 2026)

**assistant-ui / AG-UI / generative UI** (MEDIUM)
- https://www.assistant-ui.com/docs/copilots/make-assistant-tool — `makeAssistantTool` (deprecated → Toolkits)
- npm: `@assistant-ui/core` `0.2.22` published 2026-07-26, `@assistant-ui/react` `0.14.28`
- https://docs.ag-ui.com/concepts/tools — `RunAgentInput.tools`, frontend-decided capabilities
- https://docs.thesys.dev/ , https://www.thesys.dev/blogs/generative-ui-architecture — C1 generative UI

**Ecosystem conventions** (MEDIUM — corroborating, not authoritative)
- https://standardschema.dev/ + https://github.com/modelcontextprotocol/typescript-sdk/issues/164 — Standard Schema v1 adoption
- Idempotency-pattern literature (agentpatterns.ai, channel.tel, padiso.co) — establishes that dedup is universally treated as *developer homework*, not an SDK feature

**Confidence caveats**
- LOW: WebMCP pilot names (Expedia/Booking/Shopify) — single secondary source, deployment unconfirmed.
- LOW: "no mainstream agent consumes WebMCP yet" — single analysis, though consistent with the absence of any vendor announcement.
- Not verified: whether `@copilotkit/core` is genuinely DOM-free at import time. It depends on `@ag-ui/client`, `rxjs`, and `phoenix`; SSR-safety was not independently tested. If we intend to claim an SSR advantage over CopilotKit, **test it before publishing the claim.**

---
*Feature research for: in-app AI agent actuation SDKs*
*Researched: 2026-07-27*
