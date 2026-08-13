# Migrate hand-written AI SDK browser tools to Concierge

This guide is for an application that already uses AI SDK `streamText` and
`useChat`, manually defines tools, and actuates browser state from
`onToolCall`. You can retain the model provider, prompts, messages, and chat UI.

## Before and after

| Existing responsibility | Concierge replacement |
| --- | --- |
| Hand-written `tool({ inputSchema })` objects | `defineAction` declarations converted from the current catalog |
| One global tool map | `resolveCatalog(context)` for stage- and state-scoped tools |
| `onToolCall` calls React setters directly | Signed envelope accepted by `createSignedBrowserBridge` |
| Ad hoc IDs and array zipping | Response, turn, call, output-index, and dispatch correlation |
| Boolean confirmation | Payload- and snapshot-bound consent policy |
| `try/catch` text | Structured `ActionResult` and app-authored failure presentation |
| A long scripted list of model calls | One app-owned compound action using `workflow.run` and `workflow.delay` |

## 1. Preserve the provider boundary

Keep the existing `streamText` model and provider construction. OpenRouter,
OpenAI, Anthropic, and other AI SDK providers can all consume the adapter's
`ToolSet`. Remove provider imports from browser actuation code.

## 2. Move browser verbs into declarations

Create one `defineAction` constant for each intended capability. Reuse the
existing validator, add an explicit JSON Schema when the validator cannot emit
one, declare side effects and redaction, and return structured results from the
handler. Do not add a generic `click`, selector, URL, or JavaScript tool to make
migration faster; that recreates the authority Concierge is meant to remove.

Group declarations into ordered stages. Express changing availability with
`availableWhen`, then mount live browser operations and getter-based snapshots
through one `createBridge` registry.

## 3. Replace the static model tool map

At the start of every server request or model step:

```ts
const catalog = await adapter.resolveCatalog(serverValidatedContext);

const result = streamText({
  model,
  messages,
  tools: catalog.aiTools,
  // ...
});
```

Do not cache a catalog across user sessions or keep using it after application
state changes. A stale signed request fails at the browser rather than gaining
the newer catalog's authority.

## 4. Remove browser authority from `onToolCall`

Leave raw AI SDK tool-call parts available for rendering, but stop invoking
setters, routers, DOM APIs, or business functions from `onToolCall`. Prepare
complete calls in `onStepFinish`, sign them on the server, and dispatch only the
verified envelope in the browser. Follow the
[AI SDK integration guide](../integrations/ai-sdk.md).

There must be no unsigned fallback when signing, bootstrap, replay storage,
verification, catalog comparison, or dispatch fails.

## 5. Preserve all correlation

Map these fields explicitly:

| AI SDK / application | Concierge |
| --- | --- |
| application session | `sessionId` |
| generated response | `responseId` |
| application user turn (required; provenance remains explicit) | `userTurnId` |
| AI SDK call ID | `callId` |
| completed step order | `outputIndex` |
| resolved catalog snapshot | `catalogRevision` and signed catalog digest |

Return each structured result to the exact AI SDK `toolCallId`. Do not correlate
by tool name; one step may call the same tool more than once.

## 6. Migrate confirmation deliberately

If the old application displays an “Are you sure?” modal, model it as an action
consent policy and app-owned readback presentation. Consent must remain bound to
the reviewed canonical payload and detached app snapshot and be consumed once.
It is still client evidence, not server authorization.

For a server effect, retain or add server authentication, exact-payload current
authorization, replay control, and transactional/idempotent execution next to
the effect itself.

## 7. Keep tours as application actions

A guided tour is usually one compound application action, not a prompt asking
the model to rediscover a sequence every time. Move narration and ordering into
the handler and call child actions with stable `stepId` values:

```ts
handler: async ({ workflow }) => {
  await workflow.run({ stepId: "projects", name: "navigate", input: { pathname: "/projects" } });
  await workflow.delay(300);
  await workflow.run({ stepId: "featured", name: "openProject", input: { projectId: "featured" } });
  return { ok: true, message: "Completed the guided tour." };
}
```

Core owns child lineage, cancellation, limits, cleanup, validation, consent,
and dispatch events. The model sees one stable intent.

## 8. Cut over with negative tests

Before removing the old path, prove:

- unknown and off-stage tools cannot actuate the browser;
- raw/partial `onToolCall` data cannot actuate the browser;
- duplicate, expired, wrong-session, wrong-audience, and stale-catalog
  envelopes fail closed;
- a replay across tabs is consumed once;
- every completed call receives exactly one structured result;
- terminal actions stop the model loop;
- abort and unmount cancel pending work;
- protected server effects still perform independent current authorization.

After cutover, search for direct browser mutations in AI callbacks and remove
the obsolete manual tool map. Keep telemetry subscribed to `onDispatch` rather
than inside action control flow.
