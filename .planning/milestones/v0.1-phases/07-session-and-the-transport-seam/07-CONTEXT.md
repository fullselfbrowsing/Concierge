# Phase 7: Session and the transport seam - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the framework- and vendor-neutral session runtime that owns current context, publishes and replays the stage catalog, routes transport batches through the existing dispatcher, returns one correlated result per call, and tears down without leaving live session work. Amend the pre-publish transport lifecycle and session contracts where the runtime proof requires it, and prove the complete seam with a reusable configurable stub that uses no network, vendor SDK, framework, or platform DOM API. Consent enforcement remains Phase 8, and framework adapters remain Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Catalog publication and reconnect
- Add required `Transport.status: "idle" | "connecting" | "connected" | "closed"` and `Transport.onStatusChange(...)`; the session replays its latest catalog on every `"connected"` transition, covering both first connection and reconnect without a vendor-shaped event.
- A hot session immediately publishes `concierge.catalogFor(initialContext)` when an initial context exists. Without one it publishes one frozen empty catalog, reports `stage()` as `null`, and waits for `setContext`.
- `setContext` always retains the newest context, but calls `setTools` only when the memoized catalog identity changes. Stage subscribers fire only when the `string | null` stage value changes. A connected transition always forces a replay even when catalog identity is unchanged.
- A transport with `dynamicCatalog: false` may receive its initial catalog. A later catalog-identity change fails closed: initiate session stop before accepting work under the new context and throw a fixed, detail-free error instead of leaving a live stale catalog.

### Batch routing and context epochs
- Queue complete incoming batches FIFO across the session; at most one batch dispatches at a time, in addition to the existing serial ordering inside `Concierge.dispatchBatch`.
- Capture the current context reference and catalog epoch when a batch arrives. A catalog-changing `setContext` aborts active and queued work from the old epoch; a same-catalog context update does not abort it, and later batches capture the newest context.
- Compose the transport signal with session-stop and catalog-epoch cancellation while preserving the batch's `responseId`, `userTurnId`, calls, and `deferUntilDelivered` values unchanged. Core never synthesizes turn identity or replaces the delivery hook.
- Invoke `dispatchBatch` exactly once for each accepted batch occurrence, then make exactly one `transport.respond(callId, result)` attempt for every returned row in its stable order. Contain and diagnose a thrown response, continue later rows, and never retry automatically because acceptance is ambiguous after a throw.

### Lifecycle and teardown
- Export a hot standalone `createSession(config: SessionConfig): Session` rather than adding state to `Concierge` or requiring a separate `start()`. Return a frozen handle. Construction subscribes and performs the initial publication before returning; any partial setup failure rolls back registrations and fails closed.
- Amend `Session.stop` to `() => Promise<void>`. Its first call performs the synchronous stop transition and returns a cached drain Promise; every later call returns that same Promise. The Promise resolves only after all session-owned batch workers and finalizers have settled.
- Teardown marks the session stopped before invoking outside code, unregisters both transport subscriptions, aborts active and queued work, clears subscriber and queue state, and best-effort publishes the frozen empty catalog. Each cleanup step is independent so a throwing transport callback cannot prevent the rest. No response or stage event is emitted after the stop transition.
- Stage subscriptions use monotonic identity tokens, snapshot the current listener set before notification, and contain and diagnose one callback's throw while continuing the others. After stop, `stage()` remains readable as the last resolved stage; `setContext` and new `onStageChange` subscriptions throw a fixed use-after-stop error, while stale callbacks and old unsubscribe closures are inert. An application handler that has already entered receives the composed abort signal and can delay the drain if it ignores cancellation; the runtime does not claim JavaScript can forcibly terminate it.

### Stub transport and runtime diagnostics
- Put a reusable `createStubTransport` fixture under the test tree only. Do not export it from the package barrel or include it in the published tarball; Phase 8 reuses the same fixture to exercise consent.
- Give the stub frozen configurable capabilities, explicit synchronous status and batch controls, deterministic failure injection, immutable catalog-publication and response histories, and subscriber-count inspection. It uses no timer, network, WebRTC, vendor SDK, or vendor event vocabulary.
- Prove two named profiles: a conversational profile with agent-forgeable turn identity, parallel calls, and a dynamic catalog; and a command-palette profile with human-attested turn identity, single-call batches, and a fixed catalog. Capability values drive behavior rather than modality names in production core.
- Add an optional `SessionConfig.onDiagnostic` runtime hook receiving immutable session diagnostics with a closed code vocabulary and fixed safe messages. A supplied hook replaces the default `warnHost` sink. Diagnostics never contain caught values, arguments, results, context, call or response identifiers, or raw batch fields. A throwing runtime hook is contained and cleanup/routing continues; unlike the build-time catalog hook, it cannot be used to make runtime cleanup fatal.

### the agent's Discretion
- Internal module boundaries, queue and cancellation data structures, exact safe diagnostic code names and message wording, test file partitioning, mutation identifiers, and whether the frozen empty catalog is shared are at the agent's discretion, provided the contracts above and the repository's existing security and packaging gates remain mechanically proven.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Concierge.catalogFor`, `stageFor`, and `dispatchBatch` already provide memoized frozen catalogs, exact `string | null` stage resolution, guarded envelope parsing, stable call ordering, serial execution, cancellation rows, immutable correlation rows, and intact metadata forwarding.
- `AbortSignalLike`, dispatcher abort guards, and the cancellable commit-window scheduler provide the structural cancellation vocabulary without adding the DOM library.
- `createBridge` supplies the established monotonic-token, identity-guarded unsubscriber pattern for session stage listeners.
- `warnHost`, diagnostic subject encoding, result sanitization, and fixed authored results provide existing no-caught-detail safety patterns.

### Established Patterns
- Runtime state is instance-local inside factory closures; mutable module-scope session state is forbidden because server module instances are reused across requests.
- Public factories return narrow frozen handles, emitted data is deeply readonly/frozen, and consumer-implemented capability objects are readonly through every level.
- Core targets ES2022 with no DOM globals, stays framework/vendor neutral and runtime-dependency-free in substance, uses ESM-only relative `.js` imports, and compiles under `isolatedDeclarations`, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess`.
- Recoverable runtime failures use fixed actionable diagnostics and never forward caught values. Tests prove negative properties and mutation sensitivity rather than relying on happy-path assertions alone.

### Integration Points
- Amend `packages/concierge/src/types.ts` for transport lifecycle, awaitable stop, and session diagnostics; update every exact public-shape pin in the same change.
- Add the runtime in a dedicated source module and export `createSession` plus any required public diagnostic/status types from `packages/concierge/src/index.ts`, updating artifact, consumer-fixture, and export-count gates together.
- Add focused runtime and type tests for catalog replay, cross-batch FIFO behavior, context epochs, envelope identity, result cardinality, teardown, reentrancy, hostile callbacks, diagnostics, and both stub capability profiles.
- Keep the stub reusable from Phase 8 without making it a production export or allowing tests to depend on behavior outside the public `Transport` contract.

</code_context>

<specifics>
## Specific Ideas

- Model reconnect through neutral connection status transitions, not `onReconnect` or any vendor event name.
- Treat catalog identity as the publication epoch because `catalogFor` already guarantees one frozen reference per resolved stage projection.
- Make stop both immediately fail-closed and observably drained: cleanup starts synchronously, while the stable returned Promise is the proof boundary for zero session-owned pending work.
- The stub should make every external event explicit and synchronous; asynchronous progress belongs to the real session/dispatcher promises, not hidden fixture timers.

</specifics>

<deferred>
## Deferred Ideas

- Consent arming, grade enforcement, turn binding, delivery/readback evaluation, and snapshot drift remain Phase 8.
- React and Svelte lifecycle adapters remain Phase 9.
- Real vendor transports, server handlers, devtools, and broad action-level telemetry remain later roadmap work; Phase 7 adds only the transport-neutral session seam and its narrow operational diagnostics.

</deferred>
