<div align="center">

# Concierge

**The safe action layer for agent-ready web apps.**

Give AI agents a small set of typed, app-defined actions so they can operate your product through intent, live state, and explicit consent—not DOM scraping, brittle selectors, or pixel guessing.

![Status](https://img.shields.io/badge/status-pre--alpha-FF6B35?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-first-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![ESM](https://img.shields.io/badge/ESM-only-000000?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-3DA639?style=for-the-badge)

[Why Concierge](#why-concierge) · [How It Works](#how-it-works) · [Status](#status) · [Roadmap](#roadmap)

</div>

---

> [!IMPORTANT]
> **Concierge is a work in progress.** The public type contract is taking shape, but there is no published package or production runtime yet. The API may change before v0.1.

## Why Concierge

Agent-ready apps should not make models guess.

Traditional browser automation asks an agent to inspect a page and manipulate whatever it can find. Concierge lets an app expose only the actions it intends an agent to use:

```text
applyFilter({ key: "brand", value: ["Marriott"] })
reviewBooking()
confirmBooking()
```

The agent sees typed capabilities and current app state—not your DOM.

| Generic browser automation | Concierge |
| --- | --- |
| Clicks selectors or coordinates | Calls app-defined verbs |
| Reconstructs intent from the UI | Receives typed schemas |
| Inherits broad page authority | Sees only the current action catalog |
| Treats confirmation as a boolean | Binds consent to the reviewed payload |

[FSB](https://github.com/fullselfbrowsing/FSB) drives apps that do not cooperate. **Concierge is how an app cooperates.** The two are complementary.

<a id="design-contract"></a>

## How It Works

Concierge is being designed around six ideas:

- **Typed verbs** — actions are declared once with a name, schema, effects, redaction policy, and handler.
- **Structured results** — every action returns a safe, human-readable outcome instead of leaking exceptions or implementation details.
- **Least authority** — stage-scoped catalogs expose only the actions valid for the current part of the app.
- **Live state** — framework adapters read through getter-based bridges instead of stale captured values.
- **Consent that fails closed** — consequential actions require a fresh human confirmation bound to the exact payload that was reviewed.
- **Portable by default** — the core stays DOM-free, framework-agnostic, vendor-neutral, and transport-agnostic.

The same action catalog is intended to work with a chat sidebar, voice interface, MCP client, WebMCP, command palette, or a custom agent loop.

## Security Boundary: Client Consent Is Not Server Authorization

> [!WARNING]
> All client-originated evidence—including client-side consent state, grades, receipts, attestations, delivery callbacks, `ConsentAck` values, and other client assertions—is untrusted input at the server boundary. Even evidence described as human-attested can be forged, replayed, or rebound by a compromised client.

The consent kernel does not authenticate a principal and does not authorize a server action. It cannot independently permit a protected server effect. A `ConsentAck` can improve client UX and preserve audit context, but it is never server authorization. A relying server must independently establish the caller's identity and decide whether that authenticated principal may perform the exact requested action.

## Status

The repository currently contains:

- The public TypeScript contract for actions, transports, bridges, results, and consent.
- Type-level tests for the highest-risk parts of that contract.
- The design and implementation plan for the first release.

It does **not** yet contain the runtime or framework adapters. Please do not build production integrations against it yet.

## Roadmap

- **Now** — finish and harden the public type surface.
- **v0.1** — core runtime, catalog, dispatcher, bridge registry, session loop, consent kernel, and React + Svelte adapters.
- **Later** — server-side consent verification, developer tools, and first-party transports.

If you want to help shape the project, design feedback is especially useful right now. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. If you are continuing implementation, start with [HANDOFF.md](./HANDOFF.md).

## License

[MIT](./LICENSE) © Full Self Browsing
