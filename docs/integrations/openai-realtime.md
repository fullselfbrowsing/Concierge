# OpenAI Realtime integration

`@full-self-browsing/concierge/openai-realtime` is a protocol codec for an
application-owned OpenAI Realtime connection. It does not create a peer
connection, fetch credentials, own media tracks, inspect transcripts, schedule
application continuations, or send `response.create`.

```ts
import { createOpenAIRealtimeCodec } from
  "@full-self-browsing/concierge/openai-realtime";

const codec = createOpenAIRealtimeCodec();
```

## Publish and acknowledge a catalog

Resolve one atomic catalog and place the converted tools in `session.update`:

```ts
const catalog = concierge.resolveCatalog(currentContext);

sendRealtime({
  type: "session.update",
  session: {
    type: "realtime",
    tools: codec.toSessionTools(catalog),
    tool_choice: "auto",
  },
});
```

Sending the event does not activate the revision. Serialize catalog
publications and wait for the corresponding successful `session.updated`
before allowing a response to begin under `catalog.revision`. If the update is
rejected, keep the previous acknowledged revision, pause or cancel new
responses, and report only a bounded application diagnostic.

When `response.created` arrives, bind its response ID to the currently
acknowledged local revision. Never infer a revision later from the current
page, and never fall back to an unrevisioned dispatch.

## Extract one complete batch

Wait for `response.done`. Do not execute from argument-delta or output-item
events.

```ts
const acknowledgedRevision = revisionByResponseId.get(event.response.id);
if (acknowledgedRevision === undefined) return;

const batch = codec.extractCompletedBatch({
  response: event,
  sessionId,
  userTurnId,
  catalogRevision: acknowledgedRevision,
  signal: responseAbort.signal,
  deferUntilDelivered,
});

if (batch === null) return;
const outcome = await concierge.dispatchBatch(currentContext, batch);
```

The codec accepts a completed `response.done` event or its `response` member.
It preserves `response.id`, exact `call_id`, function name, raw JSON arguments,
and the response-output position. Multiple function calls become one ordered
batch. Duplicate IDs, incomplete calls, cancelled or failed responses, and
malformed event shapes fail closed. Malformed argument JSON remains raw until
core classifies it as `invalid_args`.

## Send correlated results

For a completed outcome, send every returned event before requesting the next
model response:

```ts
for (const outputEvent of codec.toFunctionCallOutputEvents(outcome)) {
  sendRealtime(outputEvent);
}

if (outcome.kind === "completed") {
  // Exactly one caller-owned follow-up after every output item is sent.
  sendRealtime({ type: "response.create" });
}
```

Each event is `conversation.item.create` with a `function_call_output` item,
the exact original call ID, and one JSON encoding of the normalized Concierge
result. Structured `data` stays a JSON object or array inside that result; it
is not double-stringified. Terminal outcomes emit no ordinary result events,
so the application can tear down its session without generating a follow-up.

This matches OpenAI's documented flow: complete function calls are available
on `response.done`, function results return through
`conversation.item.create`, and the caller sends `response.create` when it
wants a follow-up response. See the [official Realtime conversations guide](https://developers.openai.com/api/docs/guides/realtime-conversations).

## Interruption and consent

Model generation completing is not evidence that audio reached the user. Call
the delivery hook with `outcome: "completed"` only after playback completes.
Speech interruption, output-buffer clearing, cancellation, navigation,
disconnect, and teardown map to `outcome: "interrupted"` and must abort any
pending commit window.

For acoustic or VAD-derived turns, declare `userTurnIdentity` as
`"agent-forgeable"`. Use `"human-attested"` only for a separate explicit act,
such as a click or keypress, that model output cannot perform.
