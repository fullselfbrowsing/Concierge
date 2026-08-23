<div align="center">

<img src="./assets/concierge-wordmark-horizontal.svg" alt="Concierge" width="360">

# Concierge

**The safe action layer for agent-ready web applications.**

Expose a small, typed, state-aware action catalog to an AI while your
application retains control of validation, consent, execution, and results.

[![npm](https://img.shields.io/npm/v/@full-self-browsing/concierge?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/@full-self-browsing/concierge)
![Node](https://img.shields.io/badge/Node-%3E%3D22.12-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![ESM](https://img.shields.io/badge/ESM-only-000000?style=for-the-badge)
![Contract](https://img.shields.io/badge/runtime_contract-v2-1B998B?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-3DA639?style=for-the-badge)

[![CI](https://img.shields.io/github/actions/workflow/status/fullselfbrowsing/Concierge/ci.yml?branch=main&style=flat-square&logo=github&label=CI)](https://github.com/fullselfbrowsing/Concierge/actions/workflows/ci.yml)
[![Stars](https://img.shields.io/github/stars/fullselfbrowsing/Concierge?style=flat-square&logo=github&label=Stars)](https://github.com/fullselfbrowsing/Concierge/stargazers)
[![Forks](https://img.shields.io/github/forks/fullselfbrowsing/Concierge?style=flat-square&logo=github&label=Forks)](https://github.com/fullselfbrowsing/Concierge/network/members)
[![Issues](https://img.shields.io/github/issues/fullselfbrowsing/Concierge?style=flat-square&logo=github&label=Issues)](https://github.com/fullselfbrowsing/Concierge/issues)

[Website](https://full-selfbrowsing.com/concierge) · [Overview](#overview) ·
[How it works](#how-it-works) ·
[Install](#install) · [Quick start](#quick-start) ·
[Integrations](#framework-and-ai-integrations) · [Security](#security-model) ·
[Documentation](#documentation)

</div>

## Overview

Concierge is a framework-neutral TypeScript runtime for applications that want
to let an AI take useful actions without exposing a generic browser control
surface. An application declares verbs such as `openProject({ projectId })`,
`applyFilter({ key, value })`, or `confirmBooking()`. Concierge presents the
currently available actions as typed schemas and keeps execution behind the
application's own state, policy, and user interface.

Concierge owns action admission, input validation, consent, scheduling,
deduplication, workflow execution, and structured results. It does not own the
model, chat interface, planning loop, authentication system, or server
authorization policy.

Version `0.2.1` is a supported public preview. The current release uses runtime
contract v2 and ships as one synchronized set of three packages.

### Why Concierge

Generic browser automation reconstructs intent from page structure, selectors,
or coordinates. Concierge lets a cooperating application publish the exact
verbs an AI may use at the current moment.

| Generic browser automation | Concierge |
| --- | --- |
| Click selectors or coordinates | Call application-defined verbs |
| Reconstruct intent from the visible interface | Receive typed schemas and live availability |
| Inherit broad page authority | See only the current action catalog |
| Treat confirmation as a boolean | Bind consent to the reviewed payload and state snapshot |
| Trust a model callback to actuate the browser | Verify a signed and replay-protected batch before dispatch |

[FSB](https://github.com/fullselfbrowsing/FSB) operates sites that do not
cooperate. Concierge is the action layer for applications that do cooperate.
The projects address different parts of the agent browsing stack.

## How it works

1. The application defines named actions with descriptions, input schemas,
   availability rules, effect metadata, redaction policy, and handlers.
2. Concierge resolves the active stage and its available actions into one
   immutable catalog snapshot with an instance-local revision.
3. The model receives only the tools admitted by that snapshot.
4. Concierge validates every requested action again before execution, applies
   consent and scheduling rules, and rejects stale or conflicting calls.
5. The application bridge performs the approved interface operation and
   returns a structured result.

This boundary keeps responsibilities explicit:

| Owner | Responsibility |
| --- | --- |
| Application | Action definitions, live state, interface operations, authentication, and server authorization |
| Concierge | Catalog admission, validation, consent, scheduling, deduplication, dispatch, and workflows |
| Model integration | Tool presentation, model calls, tool correlation, and result delivery |

## Packages and compatibility

The public packages form one fixed release set. Install and upgrade them
together so every adapter resolves the same physical core and contract version.

| Package | Purpose |
| --- | --- |
| [`@full-self-browsing/concierge`](./packages/concierge/README.md) | Framework-neutral catalog, dispatch, consent, workflow, telemetry, and transport runtime |
| [`@full-self-browsing/concierge-react`](./packages/concierge-react/README.md) | React context, bridge lifecycle, and optional activity visuals |
| [`@full-self-browsing/concierge-svelte`](./packages/concierge-svelte/README.md) | Svelte context, bridge lifecycle, and reactive snapshot normalization |

| Component | Supported range |
| --- | --- |
| Node.js | `>=22.12.0` |
| Module format | ESM only |
| React and React DOM | `^18.2.0 || ^19.0.0` |
| Svelte | `^5.0.0` |
| AI SDK core | `^6.0.0 || ^7.0.0` |
| Runtime contract | v2 throughout `0.2.x` |

React and Svelte package roots are server-safe.
Their runtime bindings live in `/client` and `/client.svelte`. Edge deployment
is not part of the `0.2` support matrix. See [COMPATIBILITY.md](./COMPATIBILITY.md)
for the full certified matrix and runtime boundaries.

## Install

Install the core package for a framework-neutral integration:

```sh
pnpm add @full-self-browsing/concierge zod
```

Add the matching framework adapter when needed:

```sh
pnpm add @full-self-browsing/concierge@^0.2 \
  @full-self-browsing/concierge-react@^0.2 \
  zod
```

```sh
pnpm add @full-self-browsing/concierge@^0.2 \
  @full-self-browsing/concierge-svelte@^0.2 \
  zod
```

AI SDK integrations also install a supported AI SDK version and the relevant
provider packages. The maintained example uses AI SDK 7 and OpenRouter, but the
Concierge adapter is provider-neutral.

## Quick start

Declare each action as a named constant, attach it to a stage, and resolve one
atomic catalog snapshot for the current application state:

```ts
import {
  createBridge,
  createConcierge,
  defineAction,
  offPageResult,
} from "@full-self-browsing/concierge";
import { z } from "zod";

const projectBridge = createBridge<{
  actions: { openProject(id: string): void };
  snapshot: { activeProject(): string | null };
}>("project-ui");

const openProject = defineAction({
  name: "openProject",
  description: "Open one project in the application preview.",
  schema: z.object({ projectId: z.string().min(1).max(64) }).strict(),
  jsonSchema: {
    type: "object",
    properties: { projectId: { type: "string", minLength: 1, maxLength: 64 } },
    required: ["projectId"],
    additionalProperties: false,
  },
  redact: ({ projectId }) => ({ projectId }),
  effects: { readOnly: false, destructive: false, idempotent: true },
  handler: ({ args, bridge }) => {
    if (bridge === null) {
      return offPageResult("Project opening", "project interface");
    }

    bridge.actions.openProject(args.projectId);
    return { ok: true, message: `Opened project ${args.projectId}.` };
  },
});

const concierge = createConcierge({
  stages: [
    {
      id: "projects",
      match: (context) => context.pathname === "/projects",
      actions: [openProject],
      bridge: projectBridge,
    },
  ],
});

const catalog = concierge.resolveCatalog({ pathname: "/projects" });

// catalog.stage, catalog.revision, and catalog.tools are one snapshot.
```

Mount the same Concierge instance and bridge registry through the appropriate
framework adapter. Getter-based state remains live until Concierge captures a
snapshot for validation or consent.

For a complete model integration, continue with the
[AI SDK integration guide](./docs/integrations/ai-sdk.md) or run the maintained
[`examples/next-ai-sdk`](./examples/next-ai-sdk) Next.js application.

## Framework and AI integrations

| Integration | Runtime entry point | Guidance |
| --- | --- | --- |
| Framework-neutral | `@full-self-browsing/concierge` | Use the core runtime and register the application bridge directly |
| React | `@full-self-browsing/concierge-react/client` | Provide the core instance, register bridges, and optionally render the activity overlay |
| Svelte | `@full-self-browsing/concierge-svelte/client.svelte` | Provide the core instance with the Svelte snapshot normalizer and register bridges during initialization |
| AI SDK | `@full-self-browsing/concierge/ai-sdk` | Convert a resolved catalog into model tools and correlate completed calls |
| Signed server bridge | `/ai-sdk/server` and `/ai-sdk/browser` | Issue, verify, and dispatch short-lived browser batches |

The React adapter includes `ConciergeActivityOverlay` for a configurable edge
glow and optional “Powered by FSB” badge. Applications with their own activity
interface can subscribe through `useConciergeActivity()` instead.

### AI SDK 6 and 7

The optional AI SDK adapter separates model-facing tools from browser
authority:

1. The server resolves the current catalog and passes `catalog.aiTools` to AI
   SDK `streamText`.
2. `prepareStep` validates and correlates complete tool calls. It rejects
   partial, dynamic, provider-executed, duplicate, and unknown calls.
3. `createSignedBatchIssuer` resolves the catalog again and signs canonical
   claims that bind the calls to the catalog digest, session, audience, expiry,
   nonce, response, and required turn.
4. `createSignedBrowserBridge` verifies the envelope, consumes its replay key,
   compares it with the live browser catalog, and then enters core dispatch.
5. Structured Concierge results return to the model through `addToolOutput`.

Raw `onToolCall` values are display data only. They never actuate the
application. OpenRouter is used only by the example, and other AI SDK providers
can consume the same `ToolSet`.

## Runtime guarantees

* Action inputs are validated again immediately before execution.
* Stage selection, availability, tools, and the catalog revision resolve
  atomically.
* Actions with side effects pass through a cancellable commit window.
* Exact retries share one Promise and cannot execute twice inside the
  deduplication window.
* Consequential actions consume consent bound to the reviewed payload and state
  snapshot once.
* Batches execute in `outputIndex` order and return explicit completed or
  terminal outcomes.
* Compound actions use core-owned child dispatch, cleanup, delay, and bounded
  lineage.
* `onDispatch` receives redacted lifecycle events without controlling them.
* Mixed `0.1` and `0.2` installations fail before bridge registration or
  dispatch.

## Telemetry and privacy

Mounted React and Svelte runtimes send default-on anonymous usage estimates to
FSB's aggregate statistics pipeline. Vanilla integrations mount telemetry
explicitly. The browser-only `@full-self-browsing/concierge/telemetry` entry
provides status and opt-out APIs.

The framework-neutral package root performs no storage, timer, DOM, or network
work. Telemetry never sends action names, arguments, results, schemas, stages,
page URLs, DOM content, application names, or account identifiers. If browser
storage is unavailable, telemetry stops without affecting dispatch.

Read the [telemetry privacy contract](./docs/privacy.md) for the exact payload,
retention policy, origin-scoped identity, Global Privacy Control behavior, and
stop-and-erase process.

## Security model

The action catalog is a least-authority boundary, not an authentication system.
Concierge does not authenticate users, and a client consent record is not
server authorization. A server that performs a protected effect must
independently authenticate the current principal, authorize the exact action
and payload under current policy, reject replay, and make the effect idempotent
or transactional.

The signed AI bridge authenticates a short-lived server decision to admit one
specific browser batch. It does not make model output trustworthy, repair an
XSS vulnerability, or turn client state into server authority. Keep private
keys on the server, use a durable replay store, validate server request context,
and maintain a strict Content Security Policy.

Read [SECURITY.md](./SECURITY.md) before shipping a consequential integration.
Report vulnerabilities through the private process documented there, not in a
public issue.

## Public preview and support

The documented `0.2` surface is supported as a public preview. Patches do not
intentionally break documented exports or contract v2 wire shapes. Only the
latest `0.2.x` patch receives fixes.

A contract change, Node.js floor increase, removal of a documented export, or
removal of AI SDK 6 or 7 support requires a synchronized minor release and a
migration guide. Review [SUPPORT.md](./SUPPORT.md) for the maintenance window
and exclusions.

## Documentation

| Guide | Contents |
| --- | --- |
| [Core package](./packages/concierge/README.md) | Catalog admission, dispatch, workflows, transport, and compatibility |
| [React adapter](./packages/concierge-react/README.md) | Context, bridge registration, live state, and activity visuals |
| [Svelte adapter](./packages/concierge-svelte/README.md) | Context, bridge registration, rune-aware snapshots, and lifecycle |
| [AI SDK integration](./docs/integrations/ai-sdk.md) | Tool conversion, signed batches, result delivery, and deployment boundaries |
| [Next.js example](./examples/next-ai-sdk) | Complete AI SDK 7 application with the signed browser bridge |
| [Compatibility](./COMPATIBILITY.md) | Certified versions, runtimes, framework boundaries, and version mixing |
| [Telemetry privacy](./docs/privacy.md) | Data fields, local coordination, retention, opt-out, and erasure |
| [Migration from 0.1](./docs/migrations/0.1-to-0.2.md) | Contract v2 and API migration guidance |
| [Migration from a custom AI SDK adapter](./docs/migrations/custom-ai-sdk-to-concierge.md) | Adoption guidance for existing model tool integrations |
| [Support policy](./SUPPORT.md) | Supported surface, maintenance window, and help channels |

## Development and contributing

Contributors need Node.js 22.13 or newer for the pinned pnpm version. Public
packages retain a Node.js 22.12 consumer floor.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
node scripts/release/check.mjs source
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before changing runtime behavior or a
public contract. Release operators should also review
[RELEASING.md](./RELEASING.md). All participation is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) © Full Self Browsing
