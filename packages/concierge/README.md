<div align="center">

<img src="https://raw.githubusercontent.com/fullselfbrowsing/Concierge/main/assets/concierge-wordmark-horizontal.svg" alt="Concierge" width="280">

# `@full-self-browsing/concierge`

</div>

Framework-neutral action and control runtime for letting an AI agent operate a
web application. Concierge owns action admission, validation, consent,
deduplication, lifecycle, workflows, and terminal execution. It does not own the
model, chat UI, speech, overlay, or planning loop.

Version 0.2 is a public preview of contract 2. It requires Node 22.12 or newer;
Edge runtimes are not supported in the 0.2 line.

## Install

```sh
pnpm add @full-self-browsing/concierge
```

React and Svelte lifecycle bindings are published separately. Optional AI SDK
6/7 tool definitions and the signed browser bridge are available from
`@full-self-browsing/concierge/ai-sdk`, `/ai-sdk/server`, and `/ai-sdk/browser`.
Anonymous browser usage reporting is isolated in the optional
`@full-self-browsing/concierge/telemetry` subpath; importing this package root
continues to perform no browser storage, timer, DOM, or network work.

React and Svelte mount telemetry by default. Vanilla browser integrations can
mount it explicitly and offer an origin-wide opt-out:

```ts
import {
  mountConciergeTelemetry,
  setConciergeTelemetryEnabled,
} from "@full-self-browsing/concierge/telemetry";

const unmountTelemetry = mountConciergeTelemetry(concierge);
await setConciergeTelemetryEnabled(false);
```

See the repository's [telemetry privacy contract](https://github.com/fullselfbrowsing/Concierge/blob/main/docs/privacy.md)
for the exact payload and retention behavior.

## Atomic catalog admission

Resolve the current stage, state-derived action availability, tool definitions,
and opaque local revision together:

```ts
const resolved = concierge.resolveCatalog({
  pathname: location.pathname,
  canEdit: currentUser.canEdit,
});

// Give resolved.tools to the model and retain resolved.revision locally.
```

An action may declare `availableWhen(ctx)`. Only the literal value `true`
admits it; `false`, a thrown exception, or any non-boolean value fails closed.
Unavailable actions are absent from `resolved.tools` and dispatch as
`unknown_action`.

`resolved` is deeply frozen. Its branded symbol revision is memoized by the
effective stage and availability set, scoped to one Concierge instance, and
must never be serialized or used as cross-runtime authority.

## Dispatch

Dispatch requires the revision that admitted the action:

```ts
const result = await concierge.dispatch(context, {
  name: "openProject",
  input: { projectId: "p_123" },
  catalogRevision: resolved.revision,
  identity: {
    sessionId,
    responseId,
    callId,
    userTurnId,
    outputIndex: 0,
  },
  signal,
  deferUntilDelivered,
});
```

Batch dispatch accepts the same complete identity and returns an explicit
union. A `completed` outcome contains immutable, fully correlated
`{ callId, name, outputIndex, result }` rows. A `terminal` outcome also names
the action and lineage that entered terminal execution.

Retries deduplicate only by `(sessionId, responseId, callId)`. An exact retry
reuses the same Promise; changing its action, input, output index, turn, or
catalog revision returns `identity_conflict`. A superseded local revision
returns `catalog_stale`. Malformed JSON in a transport batch returns
`invalid_args`; it is never replaced with an empty object.

## Lifecycle and workflows

`concierge.onDispatch(listener)` observes immutable `accepted`, `waiting`,
`executing`, `succeeded`, `failed`, and `cancelled` events. Events include
correlation, stage, terminal state, and parent/child lineage. Input appears only
through the action's redaction policy; a failed projection is reported as
`dropped`. Listener failures never delay or change dispatch, and an exact
dedupe hit emits no second lifecycle.

Every action handler receives serial, core-mediated workflow controls:

```ts
handler: async ({ args, workflow }) => {
  workflow.cleanup(() => removeTourHighlight());
  await workflow.run({
    stepId: "open-settings",
    name: "openSettings",
    input: {},
  });
  await workflow.delay(300);
  return { ok: true, message: "The guided tour is complete." };
}
```

Child calls traverse normal availability, validation, consent, commit, bridge,
dedupe, lifecycle, and terminal gates. They run FIFO, inherit cancellation and
turn identity but not consent acknowledgements, latch the first child failure,
and execute registered cleanup exactly once in LIFO order before the parent
settles. Defaults are 16 nested levels and 256 steps per root workflow.

## Session and transport

`createSession` republishes a `ResolvedCatalog` whenever its effective catalog
changes, including availability changes within one stage. Publishing a new
catalog aborts the prior epoch. A contract-2 transport implements
`setCatalog(resolved)` and one awaited `onToolBatch` callback returning the
batch outcome; there is no ambiguous per-call response channel.

## Compatibility and stability

Documented 0.2 exports, failure reasons, wire fields, peer ranges, and contract
2 remain compatible throughout `0.2.x`. Breaking changes require a synchronized
0.3 release and migration notes. See the
[repository documentation](https://github.com/fullselfbrowsing/Concierge#readme),
[security policy](https://github.com/fullselfbrowsing/Concierge/blob/main/SECURITY.md),
and [0.1 to 0.2 migration guide](https://github.com/fullselfbrowsing/Concierge/blob/main/docs/migrations/0.1-to-0.2.md).

## License

MIT © Full Self Browsing
