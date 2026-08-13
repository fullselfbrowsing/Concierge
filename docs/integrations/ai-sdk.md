# AI SDK 6 and 7 integration

`@fullselfbrowsing/concierge/ai-sdk` converts an atomic Concierge catalog to an
AI SDK `ToolSet` and, for split server/browser applications, carries complete
tool calls through a signed, replay-protected envelope.

The adapter supports `ai ^6.0.0 || ^7.0.0`. It uses the stable `tool`,
`jsonSchema`, complete step results, and tool-output APIs shared by both majors.
It does not depend on experimental AI SDK callbacks.

## Install

AI SDK 7 and React:

```sh
pnpm add @fullselfbrowsing/concierge@^0.2 \
  @fullselfbrowsing/concierge-react@^0.2 \
  ai@^7 @ai-sdk/react@^4
```

AI SDK 6 uses `@ai-sdk/react ^3` instead. If OpenRouter is the provider, use
`@openrouter/ai-sdk-provider ^2` with AI 6 or `^3` with AI 7. The Concierge
adapter itself is provider-neutral.

## Package boundaries

| Import | Runtime |
| --- | --- |
| `@fullselfbrowsing/concierge/ai-sdk` | Shared tool conversion, catalog preparation, and result correlation |
| `@fullselfbrowsing/concierge/ai-sdk/server` | ES256 batch issuer; never import into a client component |
| `@fullselfbrowsing/concierge/ai-sdk/browser` | Signature verification, replay protection, live-catalog check, and dispatch |

The server subpath has an explicit fail-closed browser condition. All entries
check core contract v2 before doing work.

## 1. Convert an atomic catalog

Construct one Concierge instance per application runtime and resolve the
catalog from server-validated state for every request or model step:

```ts
import { createAISDKAdapter } from "@fullselfbrowsing/concierge/ai-sdk";

const adapter = createAISDKAdapter({ concierge });
const catalog = await adapter.resolveCatalog({
  pathname: authorizedRoute.pathname,
  browserOpen: authorizedRoute.browserOpen,
});

// catalog.stage, revision, digest, emittedTools, and aiTools describe one state.
```

`catalog.aiTools` contains browser-owned tools without an `execute` function.
The model can propose them, but AI SDK cannot directly actuate the page.

For a catalog already obtained from another Concierge boundary,
`toAISDKTools(emittedTools)` performs only the tool conversion. Prefer
`adapter.resolveCatalog` in request code because it also supplies the catalog
revision and signed digest.

## 2. Give the tools to `streamText`

After a step completes, pass only complete AI SDK tool calls to `prepareStep`.
Never dispatch input deltas from the stream:

```ts
import { randomUUID } from "node:crypto";
import { streamText } from "ai";

const result = streamText({
  model,
  messages,
  tools: catalog.aiTools,
  onStepFinish: async (step) => {
    const prepared = adapter.prepareStep({
      catalog,
      responseId: `${sessionId}:${randomUUID()}`,
      userTurnId,
      toolCalls: step.toolCalls.map((call) => ({
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        input: call.input,
        dynamic: call.dynamic,
        invalid: call.invalid,
        providerExecuted: call.providerExecuted,
      })),
    });

    if (prepared.kind === "invalid") {
      // Log the bounded code, not model input. Do not fall back to raw dispatch.
      return;
    }
    if (prepared.kind !== "ready") return;

    // Sign prepared.value as shown below.
  },
});
```

Preparation rejects more than 128 calls, malformed identities, non-canonical
inputs, duplicates, unknown tools, dynamic tools, invalid tool calls, and calls
already executed by a provider. It assigns `outputIndex` in the completed step's
order and preserves that correlation through results.

## 3. Sign the server decision

Generate a P-256 key pair outside the request path. Store the PKCS #8 private
key only in the server secret store. Send the SPKI public key to the browser
through an authenticated, no-store bootstrap endpoint together with a
server-issued session ID and an application-specific audience.

The example includes a local key generator:

```sh
node examples/next-ai-sdk/scripts/generate-keys.mjs
```

Create an issuer and sign only after it re-resolves the current context:

```ts
import { createSignedBatchIssuer } from
  "@fullselfbrowsing/concierge/ai-sdk/server";

const issuer = createSignedBatchIssuer({
  adapter,
  audience: "https://app.example/concierge",
  keyId: "concierge-2026-08",
  privateKey: { format: "pkcs8-pem", data: process.env.CONCIERGE_PRIVATE_KEY! },
  ttlMs: 60_000,
});

const issued = await issuer.issue({
  sessionId,
  currentContext: authorizedContext,
  prepared: prepared.value,
  signal: request.signal,
});

if (issued.kind === "issued") {
  streamWriter.write({
    type: "data-concierge-envelope",
    data: { envelope: issued.envelope },
  });
}
```

`stale-catalog` means the catalog changed between model exposure and signing;
discard the calls and start a fresh step. `aborted` is also terminal for that
attempt. Neither case may fall back to unsigned calls.

Envelope v1 is a flattened JWS-shaped object:

```ts
interface SignedToolBatchEnvelopeV1 {
  protected: string;
  payload: string;
  signature: string;
}
```

The canonical claims bind contract v2, audience, session, catalog stage and
digest, issued/expiry times, nonce, response, required user turn, and ordered
calls. The protected header fixes ES256, key ID, media type, and envelope
version.

## 4. Verify and dispatch in the browser

Create the bridge only after bootstrap succeeds. Use IndexedDB in production so
multiple tabs share an atomic replay decision:

```ts
import {
  createIndexedDBReplayStore,
  createSignedBrowserBridge,
} from "@fullselfbrowsing/concierge/ai-sdk/browser";

const signedBridge = createSignedBrowserBridge({
  concierge,
  audience: bootstrap.audience,
  sessionId: bootstrap.sessionId,
  publicKeys: new Map([[bootstrap.keyId, {
    format: "spki-pem",
    data: bootstrap.publicKeyPem,
  }]]),
  replayStore: createIndexedDBReplayStore({
    databaseName: "my-app-concierge-replay-v1",
  }),
  presentOutcome: async (outcome) => {
    await renderApplicationFailure(outcome);
    return { outcome: "completed" };
  },
  initialContext: liveContext,
  onDiagnostic: ({ code }) => reportSafeCode(code),
});
```

A custom `ReplayStore` receives `(key, retainUntil, currentTime)`. It must make
the consume decision atomically and compare retention against the supplied
`currentTime`, which comes from the same validated bridge clock used for the
signed-envelope checks. It must not substitute `Date.now()`.

Call `setContext` whenever application state changes and `stop` during cleanup.
The context must come from live application state, not the model or the signed
request body.

Feed envelope data parts to `accept` and return every completed row to AI SDK:

```ts
const report = await signedBridge.accept(envelope);

if (report.kind === "completed") {
  for (const row of report.rows) {
    // Do not await inside useChat.onToolCall; add the output to chat state.
    addToolOutput({
      tool: row.name,
      toolCallId: row.callId,
      output: row.result,
    });
  }
} else if (report.kind === "terminal") {
  await stopChat();
} else {
  reportSafeCode(report.code);
}
```

Configure AI SDK's raw `onToolCall` as display-only or leave it unused. Calling
Concierge from that callback bypasses the signed boundary.

The bridge verifies strict shape, ES256 key and signature, canonical payload,
contract, audience, session, clock bounds, one-time nonce, and live catalog
before dispatch. It never exposes unknown action names through diagnostics. A
rejection is final for that envelope.

## 5. Correlate results in a collocated loop

When the model loop and dispatch report live in one trusted runtime, the root
adapter can map a completed report back to AI SDK structures:

```ts
const modelParts = adapter.toToolResultParts(prepared, completedReport);
const uiUpdates = adapter.toToolOutputUpdates(prepared, completedReport);
```

Both methods verify response ID, row count, tool call IDs, names, and output
indices. A mismatch throws `ConciergeAISDKCorrelationError`; never zip unrelated
arrays or guess by tool name.

## Testing

- Use AI SDK's `MockLanguageModelV3` from `ai/test` and
  `simulateReadableStream` for deterministic model and streaming behavior.
- Test minimum and current patches of both AI SDK majors.
- Mutate signatures, payload bytes, key IDs, sessions, audience, times, nonce,
  catalog state, call order, and result correlation.
- Verify an envelope is consumed once across concurrent accepts.
- Verify raw `onToolCall` input never reaches `dispatch`.
- Build the actual Next source against both AI 6 and AI 7 dependency stacks.

The release workflow performs exact-tarball adapter smokes at AI 6.0.0,
6.0.253, 7.0.0, and 7.0.64 and builds the same Next source against current AI 6
and AI 7 stacks. See [COMPATIBILITY.md](../../COMPATIBILITY.md) for exact pins.

## Complete example

[`examples/next-ai-sdk`](../../examples/next-ai-sdk) demonstrates App Router,
OpenRouter, signed data parts, an HttpOnly session cookie, key bootstrap,
dynamic catalogs, React bridge registration, replay storage, dispatch overlays,
terminal actions, and an application-owned compound tour.
