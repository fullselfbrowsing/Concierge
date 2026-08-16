<div align="center">

<img src="./assets/concierge-icon-square.svg" alt="Concierge logo" width="160">

# Concierge

**The safe action layer for agent-ready web apps.**

Expose a small, typed, state-aware action catalog to an AI without giving it a
generic DOM or JavaScript escape hatch.

![Status](https://img.shields.io/badge/status-supported%20public%20preview-FF6B35?style=for-the-badge)
![Version](https://img.shields.io/badge/release-0.2-635BFF?style=for-the-badge)
![Contract](https://img.shields.io/badge/runtime%20contract-v2-1B998B?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-3DA639?style=for-the-badge)

[Quick start](#quick-start) · [AI SDK](#ai-sdk-6-and-7) ·
[Security](#security-model) · [Compatibility](./COMPATIBILITY.md) ·
[Support](./SUPPORT.md)

</div>

Concierge lets the application declare verbs such as
`openProject({ projectId })`, `applyFilter({ key, value })`, or
`confirmBooking()`. The model receives JSON Schemas and descriptions; the
application retains stage selection, input validation, consent, scheduling,
deduplication, execution, and result presentation.

| Generic browser automation | Concierge |
| --- | --- |
| Click selectors or coordinates | Call app-defined verbs |
| Reconstruct intent from the visible UI | Receive typed schemas and live availability |
| Inherit broad page authority | See only the current catalog |
| Treat confirmation as a boolean | Bind consent to the reviewed payload and snapshot |
| Trust a model callback to actuate the browser | Verify a server-signed, replay-protected batch |

[FSB](https://github.com/fullselfbrowsing/FSB) operates sites that do not
cooperate. Concierge is how an application cooperates. They solve different
parts of the stack.

## Packages

The three packages are one fixed release set. Install and upgrade them together.

| Package | Purpose |
| --- | --- |
| `@full-self-browsing/concierge` | Framework-neutral catalog, dispatch, consent, workflow, and transport runtime |
| `@full-self-browsing/concierge-react` | React context, bridge registration, and optional action glow/badge overlay |
| `@full-self-browsing/concierge-svelte` | Svelte context, bridge registration, and `$state` snapshot normalization |

The core package also exposes optional AI SDK 6/7 integration through its
`/ai-sdk`, `/ai-sdk/server`, and `/ai-sdk/browser` subpaths.

All packages are ESM-only and require Node 22.12 or newer. The current runtime
contract is v2. A mixed 0.1/0.2 installation fails before bridge registration
or dispatch rather than operating with split safety state.

## Quick start

For React with AI SDK 7:

```sh
pnpm add @full-self-browsing/concierge@^0.2 \
  @full-self-browsing/concierge-react@^0.2 \
  ai@^7 @ai-sdk/react@^4 zod
```

Declare actions as named constants, attach them to stages, and resolve one
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
    if (bridge === null) return offPageResult("Project opening", "project interface");
    bridge.actions.openProject(args.projectId);
    return { ok: true, message: `Opened project ${args.projectId}.` };
  },
});

const concierge = createConcierge({
  stages: [{
    id: "projects",
    match: (context) => context.pathname === "/projects",
    actions: [openProject],
    bridge: projectBridge,
  }],
});

const catalog = concierge.resolveCatalog({ pathname: "/projects" });
// catalog.stage, catalog.revision, catalog.tools are one consistent snapshot.
```

Mount the same registry with the framework adapter and live getter-based state.
The React client entry is
`@full-self-browsing/concierge-react/client`; the Svelte client entry is
`@full-self-browsing/concierge-svelte/client.svelte`. Their package roots are
server-safe.

Mounted React and Svelte runtimes send default-on, anonymous usage estimates to
FSB's aggregate stats pipeline. The browser-only
`@full-self-browsing/concierge/telemetry` subpath exposes status and opt-out APIs;
the core package root remains storage-, timer-, DOM-, and network-free. See the
[telemetry privacy contract](docs/privacy.md) for the exact ten-field payload,
origin-scoped identity, retention, and stop-and-erase behavior.

React applications can also opt into `ConciergeActivityOverlay` from the client
entry. It renders a configurable two-color edge glow while dispatches are
active and can show an independently optional “Powered by FSB” badge. Apps that
own their own activity UI can use `useConciergeActivity()` instead.

## AI SDK 6 and 7

`@full-self-browsing/concierge/ai-sdk` deliberately separates model-facing tools
from browser authority:

1. The server resolves the current Concierge catalog and passes
   `catalog.aiTools` to AI SDK `streamText`.
2. After AI SDK reports complete tool calls, `prepareStep` validates and
   correlates them. Partial streamed inputs, dynamic calls, provider-executed
   calls, duplicates, and unknown tools are rejected.
3. `createSignedBatchIssuer` re-resolves the catalog, binds the calls to its
   digest, session, audience, expiry, nonce, response, and required turn, then signs the
   canonical claims with ES256.
4. `createSignedBrowserBridge` verifies the envelope, consumes its replay key,
   compares it with the browser's live catalog, and only then calls core.
5. Structured Concierge results return to the AI SDK through
   `addToolOutput`. Raw `onToolCall` values are display-only and never actuate
   the application.

See the [AI SDK integration guide](./docs/integrations/ai-sdk.md) and the full
[`examples/next-ai-sdk`](./examples/next-ai-sdk) App Router application. The
example uses OpenRouter as an injected model provider; the adapter itself is
provider-neutral.

## Runtime guarantees

- Action inputs are validated again immediately before execution.
- Stage, availability, tools, and the instance-local catalog revision resolve
  atomically.
- Non-read-only actions pass through a cancellable commit window.
- Retries share one Promise and cannot double-fire inside the deduplication
  window.
- Consequential actions consume payload- and snapshot-bound consent once.
- Batches execute in `outputIndex` order and return explicit completed or
  terminal outcomes.
- Compound actions use core-owned child dispatch, cleanup, delay, and bounded
  lineage rather than duplicating orchestration in adapters.
- `onDispatch` observes redacted lifecycle events without controlling them.

## Security model

The catalog is a least-authority boundary, not an authentication system.
Concierge does not authenticate a user and a client consent record is not
server authorization. A server performing a protected effect must independently
authenticate the current principal, authorize the exact action and payload
under current policy, reject replay, and make its effect idempotent or
transactional.

The signed AI bridge authenticates a short-lived server decision to admit a
specific browser batch. It does not make model output trustworthy, repair XSS,
or turn client state into server authority. Keep the private key server-only,
use a durable replay store, validate server request context, and maintain a
strict CSP.

Read [SECURITY.md](./SECURITY.md) before shipping a consequential integration.

## Public-preview policy

The documented 0.2 surface is supported, but the project is still a public
preview. Patches do not intentionally break documented exports or contract-v2
wire shapes. A contract bump, Node-floor increase, or removal of AI SDK 6/7
support requires a synchronized minor release and migration guide. See
[SUPPORT.md](./SUPPORT.md) for the support window and exclusions.

## Contributing

Start with [CONTRIBUTING.md](./CONTRIBUTING.md). Release operators should read
[RELEASING.md](./RELEASING.md); maintainers continuing the implementation can
use [HANDOFF.md](./HANDOFF.md). Historical v0.1 planning and evidence remain in
`.planning/`, but the live 0.2 release authority is `.release/lines/0.2.json`
and the version-neutral scripts under `scripts/release/`.

## License

[MIT](./LICENSE) © Full Self Browsing
