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

But "the human definitely perceived the readback" is only guaranteed on some transports. Voice guarantees it; a text sidebar does not; a headless run has no human at all. So transports declare what they can promise, and actions declare what they require:

```ts
transport.capabilities.consentGrade  // "perceived" | "delivered" | "none"

defineAction({
  name: "confirmBooking",
  consent: { requires: "reviewBooking", bindTo: "userTurn", minGrade: "perceived" },
  // → fails at catalog build time on any transport that can't guarantee it
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
    value: z.unknown(),
  }),
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

---

## Roadmap

- [ ] **v0.1** — core: catalog DSL, dispatcher, dedup, bridge registry, matching. React + one non-React adapter shipped together.
- [ ] **v0.2** — consent kernel with graded transports; server handlers.
- [ ] **v0.3** — devtools overlay.
- [ ] **v0.4** — Realtime transport; MCP executor.

The first non-React adapter ships *with* v0.1, not after. Building React-first and porting later produces a hooks-shaped core.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). The design contract above is the thing to argue with — if a decision looks wrong, open an issue before writing code.

## License

[MIT](./LICENSE) © Full Self Browsing
