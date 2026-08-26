# Next.js + AI SDK signed-browser example

This Next 16 App Router application is the complete contract-v3 integration
pattern. Concierge remains the action and control layer; AI SDK owns the model
loop, React owns rendering, the application owns navigation/speech/viewer state,
and OpenRouter is only an injected server-side model boundary.

The model-facing `tool()` definitions are derived exactly once from the
request-local Concierge catalog. They intentionally have no `execute` member.
Raw streamed tool-call parts are rendered for feedback but never execute. Only
the matching short-lived ES256 envelope written by the server can enter the
browser bridge.

## Run it

Requires Node 22.12 or later. From this directory:

```sh
pnpm keys
```

Copy the two generated PEM values into `.env.local`, then add:

```dotenv
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

Start the app with `pnpm dev`. Private signing material is read only by the
Node route. The browser receives the allowlisted public key and an independent
HTTP-only session bootstrap.

## What to inspect

- [`src/portfolio-concierge.ts`](./src/portfolio-concierge.ts) contains the one
  shared declaration set, dynamic `availableWhen` predicates, consent, terminal
  actions, and the cancellable serial tour workflow.
- [`app/api/chat/route.ts`](./app/api/chat/route.ts) validates request context,
  resolves the per-request catalog, gives definition-only tools to AI SDK, and
  signs only complete tool calls.
- [`src/concierge-demo.tsx`](./src/concierge-demo.tsx) treats streamed calls as
  display-only, verifies signed batches through IndexedDB replay protection,
  maps completed reports to `addToolOutput`, and drives its overlay only from
  `onDispatch` events. Its Action visuals panel demonstrates the optional
  two-color glow and action-only “Powered by FSB” badge.
- [`src/deterministic-model.ts`](./src/deterministic-model.ts) uses AI SDK's
  `MockLanguageModelV3` for route and browser tests; it is enabled only through
  the explicit test environment switch.

Catalog mismatch is a retry boundary, not an action result. The unresolved
assistant step is discarded and regenerated from its preceding history.
Signature, session, expiry, or replay rejection ends the turn without inventing
a tool output. A terminal report stops the model loop and emits no outputs.

The release compatibility job installs sealed archives against AI SDK 6 and 7.
The checked-in app itself stays pinned to current AI SDK 7 and React 19 so its
production example does not depend on a floating package graph.

## Security boundary

The signature prevents the normal browser bridge from inventing or modifying a
server-issued batch. It does not defeat same-origin XSS, prove that a human
authored a turn, make browser results trustworthy, or authorize protected
backend effects. Those effects still need server authentication,
authorization, replay protection, and idempotency.
