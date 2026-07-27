# Concierge

**Typed, consent-gated actions that let an AI agent operate your web app.**

Concierge is the layer a web application adds so that an agent can *drive it* — safely, in-process, through verbs you defined — instead of scraping its DOM and clicking pixels.

> [!WARNING]
> **Pre-alpha. Nothing is published yet.** This repository currently contains the design contract and the type surface. The API below is what we are building toward, not what you can install today. Watch the repo or check [Roadmap](#roadmap) for status.

---

## The idea

There are two ways an AI can use a website.

**Generic automation** — take a DOM snapshot, resolve an element reference, click it. This is what [FSB](https://github.com/fullselfbrowsing/FSB) does, and it is the right answer for the ~99.9% of the web you do not control. It works everywhere and cooperates with nothing.

**Cooperation** — the app exposes a small set of typed verbs, and the agent calls those. `applyFilter({ key, value })`, never `click("#filter-brand-marriott")`. The agent never sees your DOM. It sees a schema.

Concierge is the second one.

```
FSB          →  drives apps that don't cooperate.
Concierge    →  is how an app cooperates.
```

They are complementary halves of the same problem, and they share a vocabulary on purpose.

### Why cooperation wins on your own app

| | Generic automation | Concierge |
|---|---|---|
| Agent's view of the page | DOM snapshot, element refs | Typed action schemas only |
| Action primitive | `click(selector)`, `type(selector, text)` | `applyFilter({key, value})` |
| Grounding | Visual/DOM, re-resolved every turn | Live app state, read through getters |
| Failure mode | Stale selector, overlay intercept, timeout | `{ok: false, message: "..."}` — always a sentence |
| Trust boundary | Full page authority | Only the verbs you enumerated |
| Latency | ~100ms–2s per action | Synchronous function call |
| Where it runs | Out of process | In process |

The catalog of actions **is** the security boundary. If you never defined a verb for it, no agent can do it — not by prompt injection, not by a clever selector, not at all.

### Where this sits in 2026

Being honest about the landscape, because it shapes what Concierge is *for*:

**Tool registration is being standardized into the browser.** [WebMCP](https://github.com/webmachinelearning/webmcp) (W3C, Google and Microsoft editors) gives pages `document.modelContext.registerTool({name, description, inputSchema, execute}, {signal})`, and it has reached a Chrome origin trial. Its motivation section argues nearly exactly what the table above argues.

**Framework-agnostic actuation is table stakes, not a differentiator.** CopilotKit ships a React-free core plus Angular, Vue, and web-component packages; assistant-ui ships an agnostic core runtime.

So Concierge is deliberately **not** competing on "a way to register actions." That layer is commoditizing, and we treat WebMCP as a *transport* rather than a rival — its `{signal}` unregistration maps cleanly onto our identity-guarded unsubscriber.

What is not commoditizing is everything that happens **between the agent deciding to act and the effect landing**. WebMCP's own open questions list user confirmation as unsolved. Every other library in this space ships a confirmation boolean. Graded consent, user-turn binding, snapshot-equality invalidation, reference-identity deduplication, and fail-closed redaction are the product.

---

## Design contract

Six decisions define Concierge. Each one exists because the naive alternative failed in production.

### 1. Enumerated verbs, not generic actuation

An action is a name, a schema, and a handler. There is deliberately no `execute_js`, no `click`, no coordinate tool. Adding a capability is a code change with a code review, not a prompt change.

### 2. Every action returns `{ok, message}`

```ts
interface ActionResult {
  ok: boolean;
  reason?: string;   // stable machine-readable failure code
  message: string;   // one sentence, safe to show or speak, verbatim
}
```

`message` is not log output. It is the sentence the agent relays to the human. Failures are honest and carry a recovery hint: `"I don't see a Marriott in your current results. Want me to clear all filters?"` — never a stack trace, never a retry loop.

### 3. Stage-scoped catalogs

The agent only sees the actions valid for where the user currently is. Checkout verbs are not merely rejected on the search page — they are **absent from the catalog**. This cuts wrong-tool selection dramatically and shrinks the attack surface per route.

Stages match on arbitrary app context, not just pathname, so this works for canvases and dashboards, not only URL-driven funnels.

### 4. The bridge pattern

Handlers register once, globally. Page components push `{actions, snapshot}` into a registry when they mount. This is how a globally-mounted handler reads live state from a component that may or may not exist — without prop drilling and without re-rendering your app.

**Snapshots are getter functions, never values.** A value captured at registration time goes stale inside the handler closure. A getter reads through at call time:

```ts
// React                          // Vue                        // Svelte 5
() => filteredRef.current         () => filtered.value          () => filtered
```

This contract is identical across every framework. It is the single most portable idea here.

### 5. Consent is graded, and it fails closed

Irreversible actions (pay, send, delete, book) require a two-step handshake: a `review` action reads the details back, the **human responds in a genuinely new turn**, then `confirm` runs. Consent is bound to user-turn identity — an agent can create a new response by itself, it cannot create a new user turn — and to a field-by-field snapshot of what was reviewed. Any drift between review and confirm destroys the consent.

The subtle part is what a transport can *honestly* promise about the readback reaching the human. Grades are **modality-free** — speech versus text was never the axis. Two things are:

- **Content provenance** — did the human receive the agent's paraphrase, or the payload the app rendered?
- **Confirmation provenance** — did the app observe a human act bound to *that specific payload*, or is consent being inferred?

| Grade | Measures |
|---|---|
| `none` | No human in the loop. Gated actions cannot run. |
| `delivered` | The agent's rendition was emitted. Receipt unconfirmed. |
| `relayed` | The agent's rendition demonstrably reached the human, in full. |
| `attested` | The app rendered the **raw payload** itself and observed a human act bound to its hash. |

The gap between `relayed` and `attested` is the whole ballgame, and it has nothing to do with modality. `ActionResult.message` reaches the human **through the agent**, which reauthors it — so "the readback finished" never supported the claim "the human learned the correct total." Treating the agent's own summary as the consent artifact is OWASP ASI09, Human-Agent Trust Exploitation, whose prescribed mitigation is to show the raw action rather than the agent's summary.

`attested` is reachable by any app with a surface of its own to render into — which is every app.

```ts
defineAction({
  name: "confirmBooking",
  effects: { destructive: true },
  consent: { requires: "reviewBooking", bindTo: "userTurn", minGrade: "attested" },
  // → throws at catalog build time on any transport that can't guarantee it
});
```

An action that needs consent on a transport that cannot deliver it does not degrade quietly. It refuses to build.

### 6. Transport-agnostic

Concierge core has no opinion about how the agent reaches it. Voice over WebRTC, a text chat sidebar, an MCP client, a command palette, an E2E test harness — all the same catalog, the same dispatcher, the same consent kernel.

**You can install Concierge with no transport at all** and drive it from your own agent loop.

---

## Packages

| Package | Purpose | Status |
|---|---|---|
| `@fullselfbrowsing/concierge` | Core — catalog DSL, dispatcher, dedup, bridge registry, consent, matching, redaction. No DOM, no transport, no vendor. | 🔨 design |
| `@fullselfbrowsing/concierge-react` | React adapter | 📋 planned |
| `@fullselfbrowsing/concierge-vue` | Vue adapter | 📋 planned |
| `@fullselfbrowsing/concierge-svelte` | Svelte 5 adapter | 📋 planned |
| `@fullselfbrowsing/concierge-server` | Fetch-standard route handlers | 📋 planned |
| `@fullselfbrowsing/concierge-realtime` | OpenAI Realtime + WebRTC transport | 📋 planned |
| `@fullselfbrowsing/concierge-webmcp` | [WebMCP](https://github.com/webmachinelearning/webmcp) transport — `document.modelContext` | 📋 planned |
| `@fullselfbrowsing/concierge-mcp` | MCP server executor | 📋 planned |
| `@fullselfbrowsing/concierge-devtools` | Dev overlay — active stage, registered bridges, live catalog, action firing | 📋 planned |

Core is pure TypeScript with **zero top-level DOM access**, so it constructs on the server under Next App Router, Nuxt, and SvelteKit without guards.

Framework adapters are ~150 LOC each. They do exactly two things: get the instance into component scope, and register with cleanup on unmount. All the load-bearing logic — dispatch, dedup, consent, matching — lives in core and is shared verbatim.

---

## What it looks like

```ts
import { defineAction, defineStage, createConcierge } from "@fullselfbrowsing/concierge";
import { z } from "zod";

const applyFilter = defineAction({
  name: "applyFilter",
  description:
    "Apply a filter to the current results list. Each call REPLACES the previous " +
    "value for that key — to add a value, include the previous values in the new array.",
  schema: z.object({
    key: z.enum(["priceMax", "brand", "amenity"]),
    // Never `z.unknown()` on its own — it emits `{}`, so the agent may send
    // anything. Keep the root a flat object (see below) and narrow per key.
    value: z.union([z.number().int().min(0), z.array(z.string().min(1)).min(1)]),
  }).superRefine((data, ctx) => {
    const ok = data.key === "priceMax"
      ? typeof data.value === "number"
      : Array.isArray(data.value);
    if (!ok) ctx.addIssue({ code: "custom", path: ["value"], message: `bad value for ${data.key}` });
  }),
  effects: { idempotent: true },
  redact: "passthrough",              // required — "drop" | "passthrough" | (args) => unknown
  handler: ({ args, bridge }) => {
    if (!bridge) return { ok: false, message: "Open the results page first." };
    const { nextCount } = bridge.actions.applyFilter(args.key, args.value);
    if (nextCount === 0) return { ok: true, message: "Now showing 0 results — too restrictive?" };
    return { ok: true, message: `Filtered to ${format(args.value)}.` };
  },
});

export const concierge = createConcierge({
  stages: {
    results: defineStage({
      match: (ctx) => ctx.pathname.startsWith("/search"),
      actions: [applyFilter, sortBy, openResult],
      bridge: resultsBridge,
    }),
  },
  crossStage: [navigate, goBack, signIn],
});
```

Registering the bridge from a page component (React shown; every adapter is the same shape):

```tsx
useRegisterBridge(resultsBridge, {
  actions: { applyFilter, clearFilter, setSortBy },
  snapshot: {
    getFiltered: () => filteredRef.current,     // getters, not values
    getVisible:  () => visibleRef.current,
  },
});
```

The factory derives everything downstream: the action-name set, the literal union type, the ordered spec list, the per-stage catalogs, the JSON Schema emitted to the model, and the redaction policy. One declaration per action, no parallel registries to keep in lockstep.

---

## Things we learned the hard way

These are baked into the library as build-time errors, not documentation you have to remember.

- **Root JSON Schema must be `type: "object"`.** A `z.discriminatedUnion` emits `{oneOf: [...]}` with no root type, and OpenAI Realtime rejects the *entire* session update — the agent silently loses every action in that stage and apologizes that it "can't do that from here." Concierge validates this at catalog build and throws, naming the action.
- **Dispatch must not be `async`.** An async wrapper allocates a fresh Promise per call, which breaks await-deduplication by identity.
- **Redaction defaults to `drop`, and is required** for any action with a non-empty schema. Telemetry leaks are opt-in, never accidental.
- **Registration unsubscribers must be identity-guarded.** React StrictMode double-mount, Vue HMR, and Svelte remounts all produce a stale cleanup that would otherwise wipe a newer registration.
- **Retries within the dedup window return the same Promise by reference**, so an agent retrying 200ms later cannot double-push a route or double-fire a payment.
- **A commit window before side effects** gives the human a grace period to interrupt.
- **ESM-only, deliberately.** The dual-package hazard loads two copies of the module graph, which splits the bridge registry (handlers see `bridge: null` on a page that is open), splits the dedup window (**a retried call double-fires — the exact double-payment this design exists to prevent**), and splits the consent kernel. ESM-only → dual is a non-breaking change later; the reverse is not.
- **Snapshots must be detached from framework reactivity before storage**, not just copied. `structuredClone` throws `DataCloneError` on a Svelte proxy — hence the `SnapshotNormalizer` seam.
- **Action descriptions must be static strings.** Building them from i18n, CMS, or per-tenant content reintroduces MCP-style tool poisoning into a catalog that is otherwise code-reviewed.
- **`registerHandler` is same-origin and live**, so any analytics tag or transitive dependency can overwrite a destructive action. Core freezes the registry after build; this is MCP's rug-pull attack with no approval step to subvert.
- **Client-side consent is an assertion, not proof.** The server must re-verify — there is no token scoping an in-page action, so every call carries the human's full ambient session authority.

---

## Roadmap

- [ ] **v0.1** — core: catalog DSL, dispatcher, dedup, bridge registry, `createSession`, **and the consent kernel**. React + Svelte adapters shipped together. Packaging CI (`publint`, `attw`, pack-and-install).
- [ ] **v0.2** — server handlers; server-side consent verification.
- [ ] **v0.3** — devtools overlay; zero-bridge on-ramp.
- [ ] **v0.4** — Realtime, WebMCP, and MCP transports.

Two sequencing decisions worth stating, because both are counterintuitive:

**Consent is in v0.1, not v0.2.** Framework-agnostic actuation stopped being a differentiator in 2026 — CopilotKit and assistant-ui both shipped agnostic cores, and WebMCP is standardizing tool registration into the browser itself. A v0.1 with catalog + dispatcher + bridge and no consent is a strictly worse version of tools that already exist. The safety kernel *is* the product. It also needs no transport to test: a stub declaring `consentGrade: "none"` exercises the whole build-time gate.

**The non-React adapter is Svelte, and it ships *with* v0.1.** Not because Svelte is popular here, but because Svelte's `$state` returns a Proxy — so a consent snapshot captured at review time would be a *live view* that mutates with the app, turning "any drift destroys consent" into "there is never any drift." The gate would pass unconditionally while appearing to work, and that defect is **invisible in a React-only test suite**. Svelte is the adapter that keeps the core honest.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). The design contract above is the thing to argue with — if a decision looks wrong, open an issue before writing code.

## License

[MIT](./LICENSE) © Full Self Browsing
