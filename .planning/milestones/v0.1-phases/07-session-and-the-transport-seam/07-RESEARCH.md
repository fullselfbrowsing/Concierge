# Phase 7: Session and the transport seam - Research

**Researched:** 2026-08-08
**Domain:** Dependency-free TypeScript session orchestration, transport lifecycle, FIFO routing, epoch cancellation, teardown, diagnostics, and a deterministic test transport
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Phase Boundary

Implement the framework- and vendor-neutral session runtime that owns current context, publishes and replays the stage catalog, routes transport batches through the existing dispatcher, returns one correlated result per call, and tears down without leaving live session work. Amend the pre-publish transport lifecycle and session contracts where the runtime proof requires it, and prove the complete seam with a reusable configurable stub that uses no network, vendor SDK, framework, or platform DOM API. Consent enforcement remains Phase 8, and framework adapters remain Phase 9.

### Locked Decisions

#### Catalog publication and reconnect
- Add required `Transport.status: "idle" | "connecting" | "connected" | "closed"` and `Transport.onStatusChange(...)`; the session replays its latest catalog on every `"connected"` transition, covering both first connection and reconnect without a vendor-shaped event.
- A hot session immediately publishes `concierge.catalogFor(initialContext)` when an initial context exists. Without one it publishes one frozen empty catalog, reports `stage()` as `null`, and waits for `setContext`.
- `setContext` always retains the newest context, but calls `setTools` only when the memoized catalog identity changes. Stage subscribers fire only when the `string | null` stage value changes. A connected transition always forces a replay even when catalog identity is unchanged.
- A transport with `dynamicCatalog: false` may receive its initial catalog. A later catalog-identity change fails closed: initiate session stop before accepting work under the new context and throw a fixed, detail-free error instead of leaving a live stale catalog.

#### Batch routing and context epochs
- Queue complete incoming batches FIFO across the session; at most one batch dispatches at a time, in addition to the existing serial ordering inside `Concierge.dispatchBatch`.
- Capture the current context reference and catalog epoch when a batch arrives. A catalog-changing `setContext` aborts active and queued work from the old epoch; a same-catalog context update does not abort it, and later batches capture the newest context.
- Compose the transport signal with session-stop and catalog-epoch cancellation while preserving the batch's `responseId`, `userTurnId`, calls, and `deferUntilDelivered` values unchanged. Core never synthesizes turn identity or replaces the delivery hook.
- Invoke `dispatchBatch` exactly once for each accepted batch occurrence, then make exactly one `transport.respond(callId, result)` attempt for every returned row in its stable order. Contain and diagnose a thrown response, continue later rows, and never retry automatically because acceptance is ambiguous after a throw.

#### Lifecycle and teardown
- Export a hot standalone `createSession(config: SessionConfig): Session` rather than adding state to `Concierge` or requiring a separate `start()`. Return a frozen handle. Construction subscribes and performs the initial publication before returning; any partial setup failure rolls back registrations and fails closed.
- Amend `Session.stop` to `() => Promise<void>`. Its first call performs the synchronous stop transition and returns a cached drain Promise; every later call returns that same Promise. The Promise resolves only after all session-owned batch workers and finalizers have settled.
- Teardown marks the session stopped before invoking outside code, unregisters both transport subscriptions, aborts active and queued work, clears subscriber and queue state, and best-effort publishes the frozen empty catalog. Each cleanup step is independent so a throwing transport callback cannot prevent the rest. No response or stage event is emitted after the stop transition.
- Stage subscriptions use monotonic identity tokens, snapshot the current listener set before notification, and contain and diagnose one callback's throw while continuing the others. After stop, `stage()` remains readable as the last resolved stage; `setContext` and new `onStageChange` subscriptions throw a fixed use-after-stop error, while stale callbacks and old unsubscribe closures are inert. An application handler that has already entered receives the composed abort signal and can delay the drain if it ignores cancellation; the runtime does not claim JavaScript can forcibly terminate it.

#### Stub transport and runtime diagnostics
- Put a reusable `createStubTransport` fixture under the test tree only. Do not export it from the package barrel or include it in the published tarball; Phase 8 reuses the same fixture to exercise consent.
- Give the stub frozen configurable capabilities, explicit synchronous status and batch controls, deterministic failure injection, immutable catalog-publication and response histories, and subscriber-count inspection. It uses no timer, network, WebRTC, vendor SDK, or vendor event vocabulary.
- Prove two named profiles: a conversational profile with agent-forgeable turn identity, parallel calls, and a dynamic catalog; and a command-palette profile with human-attested turn identity, single-call batches, and a fixed catalog. Capability values drive behavior rather than modality names in production core.
- Add an optional `SessionConfig.onDiagnostic` runtime hook receiving immutable session diagnostics with a closed code vocabulary and fixed safe messages. A supplied hook replaces the default `warnHost` sink. Diagnostics never contain caught values, arguments, results, context, call or response identifiers, or raw batch fields. A throwing runtime hook is contained and cleanup/routing continues; unlike the build-time catalog hook, it cannot be used to make runtime cleanup fatal.

### the agent's Discretion
- Internal module boundaries, queue and cancellation data structures, exact safe diagnostic code names and message wording, test file partitioning, mutation identifiers, and whether the frozen empty catalog is shared are at the agent's discretion, provided the contracts above and the repository's existing security and packaging gates remain mechanically proven.

### Deferred Ideas (OUT OF SCOPE)
- Consent arming, grade enforcement, turn binding, delivery/readback evaluation, and snapshot drift remain Phase 8.
- React and Svelte lifecycle adapters remain Phase 9.
- Real vendor transports, server handlers, devtools, and broad action-level telemetry remain later roadmap work; Phase 7 adds only the transport-neutral session seam and its narrow operational diagnostics.
</user_constraints>

> Provenance note: `User Constraints` is copied verbatim from `07-CONTEXT.md`. Every factual claim outside that verbatim block carries an inline provenance tag. Recommendations are derived from those locked constraints and the inspected repository state; this phase requires no new package.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SES-01 | A session pushes the current stage catalog to the transport on start, on stage change, and on reconnect. | Use `Concierge.catalogFor` reference identity as the publication epoch, publish synchronously during construction, publish only on identity change in `setContext`, and force the same reference through `setTools` on every neutral `connected` event. [VERIFIED: `07-CONTEXT.md`; `packages/concierge/src/concierge.ts`] |
| SES-02 | A session routes an incoming tool batch through dispatch and returns one result per call. | Accept each callback occurrence once, queue complete occurrences FIFO, call the existing total `Concierge.dispatchBatch` once per occurrence, and attempt `respond` once per returned correlation row without retry. [VERIFIED: `07-CONTEXT.md`; `packages/concierge/src/dispatch.ts:920-1066`; `06-VERIFICATION.md`] |
| SES-03 | A session carries turn identity and the delivery hook from the transport envelope through to the handler. | Forward `responseId`, `userTurnId`, `calls`, and `deferUntilDelivered` unchanged in a shallow owned envelope while replacing only `signal` with the composed cancellation signal; Phase 6 already forwards those fields into `InvocationMeta`. [VERIFIED: `packages/concierge/src/types.ts:1194-1260`; `packages/concierge/src/dispatch.ts:1008-1058`] |
| SES-04 | Stopping a session unregisters cleanly and cancels in-flight work. | Cache the drain Promise before any outside call, mark stopped synchronously, independently invoke both unregister functions, abort every active/queued scope, suppress all later responses/events, and resolve only after active and detached queued work finalizes. [VERIFIED: `07-CONTEXT.md`; `packages/concierge/src/bridge.ts:200-293`] |
| TRN-02 | A stub transport with configurable capabilities exercises the full consent kernel without network or WebRTC. | Phase 7 must deliver the reusable no-I/O fixture, capability profiles, controls, histories, failure injection, and session proof. The literal consent-kernel exercise remains the locked Phase 8 reuse of this same fixture; Phase 7 must not invent consent behavior early. [VERIFIED: `07-CONTEXT.md`; `ROADMAP.md` Phase 7 and Phase 8] |
</phase_requirements>

## Summary

Phase 7 is an additive orchestration layer over two already-complete boundaries: `Concierge.catalogFor` supplies a finite set of frozen identity-stable catalog references, and `Concierge.dispatchBatch` supplies total, stable, immutable correlation rows while forwarding envelope metadata. The new session must own only the state between those boundaries and a structural `Transport`: current context, current catalog identity/epoch, current stage string, transport registrations, stage listeners, a FIFO of accepted batches, cancellation scopes, and a cached stop drain. It must not duplicate stage matching, call ordering, schema validation, result creation, or deduplication. [VERIFIED: `04-VERIFICATION.md`; `06-VERIFICATION.md`; `packages/concierge/src/concierge.ts`; `packages/concierge/src/dispatch.ts`]

The hard part is lifecycle ordering rather than API discovery. A catalog identity change must update the epoch and cancel old work before a reentrant transport can offer work under the new catalog; a fixed-catalog transport must become stopped before the failing `setContext` throws; `stop()` must cache its Promise and transition state before invoking any transport or diagnostic callback; and queued old-epoch batches must still reach `dispatchBatch` once so the existing dispatcher can produce correlated aborted rows. A stopped session is the sole exception to response delivery: it drains accepted work but suppresses every response and stage event after the synchronous stop transition. [VERIFIED: `07-CONTEXT.md`; `packages/concierge/src/dispatch.ts:1001-1066`]

No package, platform event target, DOM global, timer, network primitive, or vendor SDK is needed. Implement one new `src/session.ts`, amend the pre-publish public contracts, add the fixture under `test/fixtures/`, and widen the existing declaration/artifact/foreign-consumer/single-instance/package-list gates in the same phase. [VERIFIED: `package.json`; `packages/concierge/package.json`; `tsconfig.base.json`; `07-CONTEXT.md`]

**Primary recommendation:** Implement `createSession` as a transactional hot factory with an explicit `starting → active → stopped` state, catalog-reference epochs, one timer-free FIFO pump, one per-batch structural cancellation scope, a tokenized queued stage notifier, and a cached deferred stop Promise; keep all mutable state inside the factory closure. [VERIFIED: `07-CONTEXT.md`; `packages/concierge/src/bridge.ts`; `packages/concierge/src/concierge.ts`]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Current context, stage, catalog epoch | API / Backend (framework-neutral core session) | Browser / Client supplies `StageContext` | `Concierge` is intentionally stateless; the Session contract is the designated context owner. [VERIFIED: `packages/concierge/src/types.ts:1750-1863`] |
| Stage resolution and catalog projection | API / Backend (`Concierge`) | Session caches the returned identity | `catalogFor` and `stageFor` already centralize matcher policy and memoization; Session must consume, not reproduce, them. [VERIFIED: `packages/concierge/src/concierge.ts:624-757,1081-1088`] |
| Catalog publication and reconnect replay | API / Backend (Session) | External Transport receives tools | Session is the only owner spanning `catalogFor` and `setTools`; neutral status events drive replay. [VERIFIED: `07-CONTEXT.md`; `packages/concierge/src/types.ts:1338-1360`] |
| Incoming batch ordering | API / Backend (Session across batches) | `Concierge.dispatchBatch` inside a batch | Session adds FIFO between complete batches; the dispatcher already serializes calls by stable `outputIndex`. [VERIFIED: `07-CONTEXT.md`; `packages/concierge/src/dispatch.ts:974-1066`] |
| Call validation, dedup, commit window, result rows | API / Backend (`Concierge.dispatchBatch`) | Handler / runtime host | These are Phase 6 guarantees and must not move into Session. [VERIFIED: `06-VERIFICATION.md`] |
| Transport I/O and connection state | External Transport | Session subscribes structurally | Production core has no wire vocabulary; Transport owns status emission, batch delivery, tool publication, and result acceptance. [VERIFIED: `packages/concierge/src/types.ts:1338-1360`; `07-CONTEXT.md`] |
| Stop and epoch cancellation | API / Backend (Session) | Dispatcher and application handler observe `AbortSignalLike` | Session owns the lifetime; dispatcher checks the composed structural signal, while entered application code can only cooperate. [VERIFIED: `packages/concierge/src/types.ts:38-49`; `packages/concierge/src/dispatch.ts:447-590`; `07-CONTEXT.md`] |
| Runtime operational diagnostics | API / Backend (Session) | Consumer hook or host console | Session authors fixed immutable diagnostics; a supplied hook replaces the existing best-effort host sink. [VERIFIED: `packages/concierge/src/host.ts:205-248`; `07-CONTEXT.md`] |
| Test transport controls and histories | Test tier only | Phase 8 consent tests | The reusable fixture belongs under `test/fixtures` and is absent from the barrel and tarball. [VERIFIED: `07-CONTEXT.md`; `packages/concierge/package.json#files`] |

## Project Constraints

- No `AGENTS.md` exists at the repository root, and neither `.codex/skills/` nor `.agents/skills/` exists; there are no additional project-local skill directives. [VERIFIED: filesystem inspection]
- Core targets TypeScript with `target/lib: ES2022`, `platform: "neutral"`, no DOM library, ESM-only `.js` relative imports, strict mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `isolatedModules`, and `isolatedDeclarations`. [VERIFIED: `tsconfig.base.json`; `packages/concierge/tsdown.config.ts`]
- Core must have no top-level `window`, `document`, or `navigator`, and handler/callback exception details must not reach model-facing results or diagnostics. [VERIFIED: `CLAUDE.md`]
- Mutable runtime state must remain factory-local because server processes reuse module instances; immutable shared constants are allowed. [VERIFIED: `packages/concierge/src/concierge.ts:555-569`; `packages/concierge/src/bridge.ts:203-223`]
- Runtime tests import the built artifact, not source; the `test/` tree is intentionally outside every TypeScript program, while `test-d/` is checked by `tsconfig.test-d.json`. [VERIFIED: `vitest.config.ts:48-80`; existing runtime test headers]
- Public factories use explicit annotations required by `isolatedDeclarations`; consumer-provided nested capability objects are readonly, and core-owned outward values are frozen. [VERIFIED: `packages/concierge/src/types.ts`; `packages/concierge/src/catalog.ts`; `packages/concierge/src/bridge.ts`]

## Repository Baseline and Integration Points

| Existing asset | Exact current state | Phase 7 consequence |
|----------------|---------------------|---------------------|
| `Transport` | Four members: `capabilities`, `setTools`, `onToolBatch`, `respond`; `_transportKeys` pins that exact set. [VERIFIED: `types.ts:1338-1360`; `test-d/transport.test-d.ts`] | Add neutral `status` and `onStatusChange`, then update both structural fixtures, the exact key pin, and all prose that says “four-member.” |
| `Session` | Four members; `stop` is currently `() => void`; `stage` and `onStageChange` already have exact pins and an implementing fixture. [VERIFIED: `types.ts:1815-1857`; `test-d/actions.test-d.ts:525-548`] | Retain the four keys, change only `stop` to `() => Promise<void>`, and update the fixture plus an exact stop pin. |
| `SessionConfig` | `{ concierge, transport, initialContext? }`; `initialContext` lacks the repository's explicit `| undefined` write widening. [VERIFIED: `types.ts:1859-1863`] | Add `onDiagnostic?`, and change both optional members to `?: … | undefined` so computed optional sources work under `exactOptionalPropertyTypes`. |
| Catalog identity | One frozen `EmittedTool[]` reference per resolved stage position, including a memoized no-stage projection; distinct Concierge instances do not share the memo. [VERIFIED: `concierge.ts:701-757`; `concierge.test.ts` S7-S9] | Compare by reference only. Do not compare names, schemas, stage id, or deep equality. |
| No initial context | `catalogFor({})` could legitimately expose cross-stage actions. [VERIFIED: `concierge.ts:717-737`; `concierge.test.ts` S2/S8] | The session's required no-context catalog must be its own frozen empty array; do not invent `{}` and call `catalogFor`, or global actions leak before context exists. |
| `dispatchBatch` | Snapshots metadata/calls defensively, stably orders a copied list, dispatches serially, forwards all metadata, and returns a frozen row for every observed call, including aborted/unstarted calls. [VERIFIED: `dispatch.ts:700-1066`; `dispatcher-batch.test.ts`; `06-VERIFICATION.md`] | Session must call it once, pass a shallow envelope with only `signal` replaced, and iterate returned rows without reordering or rebuilding results. |
| Cancellation | `AbortSignalLike` is structural; `isAborted`, `isAbortSignalLike`, and `waitForCommit` already handle hostile getters/listener registration and remove listeners. [VERIFIED: `types.ts:38-49`; `dispatch.ts:447-590`] | Reuse these internal predicates where applicable and add a minimal internal cancellation source; never add DOM typings or a cancellation package. |
| Diagnostic sink | `warnHost` is receiver-safe, missing-console-safe, and contains a throwing `console.warn`. [VERIFIED: `host.ts:205-248`] | Default session diagnostics should format fixed prose and call `warnHost`; a supplied hook bypasses it entirely. |
| Listener identity pattern | `createBridge` uses a monotonic token, token-guarded stale unsubscriber, factory-local state, and a frozen capability handle. [VERIFIED: `bridge.ts:200-293`] | Apply the same mechanics to stage listeners, with a listener map rather than a single slot. |
| Public export gates | Built declaration surface is exactly 65 names: 51 types and 14 values. Value exports are pinned in `exports.test-d.ts`, `artifact.test.ts`, and `export-surface.test.ts`. [VERIFIED: current built `dist/index.d.ts`; `export-surface.test.ts:100-164`] | With the three recommended public types plus `createSession`, move all synchronized pins to **69 names / 54 types / 15 values**. |
| Single-instance gate | `buildCatalog`, `createConcierge` (transitively), and `createBridge` (directly) each have an artifact-level production-call-site case. [VERIFIED: `single-instance.test.ts` F4-F6; `contract.ts`] | `createSession` is a new consumer entry point and should call `assertSingleInstance` directly; add F7 using structural fakes so no other guarded factory contaminates the observation. |
| Package contents | `files` includes `dist`, `src`, README, and LICENSE; `test/` is not listed. [VERIFIED: `packages/concierge/package.json`] | Keep the stub under `test/fixtures/` and add an explicit tar listing assertion so its non-publication is proven rather than inferred. |
| Current validation baseline | Typecheck passes; runtime suite is 12 files / 252 tests; publint/ATTW, zero-runtime-dependency, foreign pack/install, and Node 22.12 floor gates all pass. [VERIFIED: local commands on 2026-08-08] | Use those exact counts only as the pre-Phase-7 baseline; regenerate final counts rather than carrying them into `07-VALIDATION.md`. |

## Standard Stack

### Core

| Library / Runtime | Project version | Registry status on 2026-08-08 | Purpose | Why Standard Here |
|-------------------|-----------------|-------------------------------|---------|-------------------|
| TypeScript | 7.0.2 exact | 7.0.2 latest, modified 2026-08-08 | Public contracts and strict declarations | Already enforces the no-DOM, `isolatedDeclarations`, and exact-optional constraints the new session API must satisfy. [VERIFIED: npm registry; `package.json`; `tsconfig.base.json`] |
| Native ES2022 `Promise`, `Map`, `Set`, arrays | ES2022 | Built into the configured language target | Drain promise, FIFO, listener tokens, work tracking | Enough for the complete runtime; a queue/event library would add cost without supplying any locked behavior. [VERIFIED: `tsconfig.base.json`; `07-CONTEXT.md`] |
| Structural `AbortSignalLike` | Repository contract | Existing source type | Cancellation delivered to dispatcher/handlers without DOM types | Real platform signals remain structurally assignable while core compiles with `lib: ["ES2022"]`. [VERIFIED: `types.ts:38-49`; `test-d/dispatcher.test-d.ts`] |
| Existing `Concierge` | Current Phase 6 surface | Five methods | Catalog identity/stage resolution and batch dispatch | It already owns every transformation Session would otherwise duplicate. [VERIFIED: `types.ts:1761-1802`; `concierge.ts:962-1192`] |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Vitest | 4.1.10 exact | Built-artifact runtime tests | Catalog lifecycle, FIFO, epochs, reentrancy, teardown, diagnostics, and stub controls. [VERIFIED: npm registry; `package.json`; `vitest.config.ts`] |
| TypeScript test program | 7.0.2 via `tsc -p tsconfig.test-d.json` | Exact public-shape and readonly/equality pins | Transport/Session/diagnostic/config/factory signatures and entrypoint placement. [VERIFIED: `packages/concierge/tsconfig.test-d.json`] |
| tsdown / Rolldown | 0.22.14 / 1.2.0 pinned | ESM artifact + declarations | Every runtime test must build first because it imports `dist`. Do not upgrade inside this phase even though registry Rolldown is 1.2.3. [VERIFIED: npm registry; `package.json`; `tsdown.config.ts`] |
| publint / ATTW | 0.3.22 / 0.18.5 pinned | Package artifact gates | Run at the phase gate after public export growth. Do not opportunistically upgrade publint to 0.3.23 here. [VERIFIED: npm registry; `package.json`] |
| pnpm | 11.17.0 pinned | Workspace/build/pack commands | Preserve the package-manager pin and byte-identical lockfile; registry latest is 11.20.0 but no Phase 7 need justifies churn. [VERIFIED: npm registry; `package.json`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Factory-local FIFO array + async pump | Promise-tail chaining | A tail is compact, but queued records become closure-captured and cannot be synchronously detached/cleared during stop while still being drained exactly once. Use the explicit queue. [VERIFIED: `07-CONTEXT.md` teardown and once-per-occurrence constraints] |
| Internal structural cancellation source | Platform `AbortController` | Core's TypeScript program has no DOM library, and runtime availability cannot be assumed under `platform: "neutral"`. Use the existing structural vocabulary. [VERIFIED: `tsconfig.base.json`; `types.ts:38-49`] |
| Neutral `status` transitions | Vendor reconnect callback | A reconnect-shaped method reintroduces wire vocabulary and cannot represent the full required lifecycle. Use the locked status union. [VERIFIED: `07-CONTEXT.md`; TRN-01] |
| Test-only stub fixture | Production exported mock package/API | A production export expands the package and violates the locked Phase 8 reuse location; relative test import already provides reuse. [VERIFIED: `07-CONTEXT.md`; `packages/concierge/package.json`] |

**Installation:** None. Do not change `package.json`, package manifests, or `pnpm-lock.yaml` for Phase 7. [VERIFIED: existing stack and locked no-framework/no-vendor/no-network design]

## Package Legitimacy Audit

Not applicable. Phase 7 installs no external package, so the Package Legitimacy Gate and slopcheck do not run; the planner should instead assert that `pnpm-lock.yaml` is byte-identical at the final gate. [VERIFIED: `07-CONTEXT.md`; repository stack inspection]

## Architecture Patterns

### System Architecture Diagram

```text
Application setContext(ctx)
          │
          ▼
┌────────────────────────── createSession closure ──────────────────────────┐
│ currentContext ──► concierge.catalogFor(ctx) ──► catalog identity/epoch   │
│        │         └► concierge.stageFor(ctx) ───► stage value ─► listeners │
│        │                                                                  │
│        └──────────────────── captured per accepted batch ──────────┐      │
│                                                                    ▼      │
│ Transport.onToolBatch ─► accept? ─► FIFO work queue ─► one worker at once │
│                               │          │                                │
│ transport signal ─────────────┼────┐     │                                │
│ catalog epoch change ─────────┼──► composed AbortSignalLike               │
│ session stop ─────────────────┘     │     │                                │
│                                     └────► concierge.dispatchBatch(ctx,b) │
│                                                   │ frozen rows, stable    │
│                                                   ▼                       │
│                                      transport.respond(callId, result)    │
│                                      one attempt; no automatic retry      │
│                                                                            │
│ Transport.onStatusChange("connected") ─► force setTools(latest catalog)   │
│ setContext catalog identity change ─────► setTools(new catalog)            │
│ stop ─► unregister both ─► abort/detach work ─► setTools(frozen empty)      │
│                                                                            │
│ caught operational failure ─► frozen {code,message} ─► hook OR warnHost    │
└────────────────────────────────────────────────────────────────────────────┘
```

The diagram shows the only dataflow Phase 7 should add: context and transport events enter Session, existing Concierge operations transform them, transport methods receive the outputs, and cancellation/diagnostics cross-cut the loop without becoming separate public services. [VERIFIED: `07-CONTEXT.md`; existing public interfaces]

### Recommended Project Structure

```text
packages/concierge/
├── src/
│   ├── session.ts                  # NEW: hot factory, queue, cancellation, diagnostics
│   ├── types.ts                    # MOD: status, diagnostics, Session/Config amendments
│   ├── index.ts                    # MOD: createSession/types exports + truthful module prose
│   └── contract.ts                 # MOD prose: fourth guarded production entry point
├── test/
│   ├── fixtures/
│   │   ├── stub-transport.ts       # NEW: reusable Phase 7/8 test-only transport
│   │   └── probe.ts                # MOD: foreign consumer sees new value/types
│   ├── session-catalog.test.ts     # NEW: start/context/status/stage/fixed-catalog
│   ├── session-routing.test.ts     # NEW: FIFO/envelope/epochs/response attempts
│   ├── session-lifecycle.test.ts   # NEW: stop/drain/rollback/reentrancy/diagnostics
│   ├── stub-transport.test.ts      # NEW: profiles/controls/history/no-I/O contract
│   ├── artifact.test.ts            # MOD: createSession runtime binding
│   ├── export-surface.test.ts      # MOD: 69 / 54 / 15 and value list
│   └── single-instance.test.ts     # MOD: F7 direct createSession call site
├── test-d/
│   ├── session.test-d.ts           # NEW: exact Session/config/diagnostic/factory pins
│   ├── transport.test-d.ts         # MOD: six-member neutral lifecycle contract
│   ├── actions.test-d.ts           # MOD: stop implementation returns Promise<void>
│   └── exports.test-d.ts           # MOD: createSession value placement
└── package.json                    # UNCHANGED

scripts/
├── pack-install-check.sh           # MOD: stub absent; consumer imports createSession
└── phase-07-mutation-battery.mjs    # NEW if planner follows established Phase 6 proof style
```

This split keeps production orchestration in one module, gives Phase 8 one stable fixture import, and separates catalog, routing, and teardown failures so a scoped run reports the failed dimension directly. [VERIFIED: `07-CONTEXT.md`; existing one-feature-per-runtime-file repository pattern]

### Pattern 1: Transactional hot construction

Use three lifecycle states: `starting`, `active`, and `stopped`. Resolve the initial context/catalog/stage before subscribing; install both subscriptions while callbacks are inert in `starting`; perform the initial `setTools`; then switch to `active` and return the frozen handle. If any subscription or initial publication fails, assign the cached internal drain promise, mark stopped before cleanup, independently unregister anything already installed, best-effort clear tools, diagnose with fixed prose, and throw `Error("The session could not start.")`. [VERIFIED: `07-CONTEXT.md`; `createBridge` factory-local/frozen-handle precedent]

Do not call a user-visible `start()` and do not accept a batch reentrantly during construction. A callback invoked synchronously by a subscription method while lifecycle is `starting` is not an accepted occurrence. [VERIFIED: locked hot-construction and partial-rollback rules]

### Pattern 2: Catalog reference is the epoch

Keep `currentCatalog`, `currentStage`, `currentContext`, and an integer `epoch`. A `setContext` call stores the new context reference first, obtains the new catalog and stage, and compares `nextCatalog !== currentCatalog`; only that comparison changes the epoch or calls `setTools`. A `connected` callback never changes epoch and always republishes `currentCatalog`. [VERIFIED: `07-CONTEXT.md`; `catalogFor` memo implementation]

For a fixed transport, resolve and retain the newest context/stage, then call `stop()` before throwing `Error("This transport does not support catalog changes.")`; do not publish, notify stage subscribers, or admit reentrant batch work under the new context. `stage()` remains readable as that last resolved string after stop. [VERIFIED: `07-CONTEXT.md` fail-closed and post-stop rules]

For a dynamic transport, update epoch/catalog/stage and abort every work record from an older epoch before calling `setTools(nextCatalog)`. If that publication throws, emit only the fixed diagnostic, synchronously stop, and throw `Error("The session could not publish the current catalog.")`; remaining live with an unconfirmed catalog would violate the phase goal. [VERIFIED: phase goal; locked diagnostic and fail-closed rules]

### Pattern 3: Define acceptance explicitly

A transport batch is accepted only when the session is `active` and `currentContext !== null`. Before the first `setContext`, the session has deliberately published an empty catalog and must not substitute `{}` as context, because `{}` can resolve to cross-stage actions. Emit the fixed `batch_without_context` diagnostic and do not enqueue or respond. Stale callbacks after stop are inert and silent. [VERIFIED: `07-CONTEXT.md`; `concierge.ts` no-stage projection]

Each accepted callback occurrence receives its own work record even if the same `ToolBatch` object or call ids were seen before. Session-level coalescing is forbidden: `Concierge.dispatch` already owns call deduplication, while every transport delivery occurrence independently requires response attempts. [VERIFIED: SES-02; DSP-01; `07-CONTEXT.md` once-per-occurrence wording]

### Pattern 4: Explicit FIFO plus a detached stop drain

Use an explicit queue and one async pump, not parallel worker promises. The pump removes exactly one record, assigns it as active, awaits `concierge.dispatchBatch`, performs stable response attempts, finalizes its cancellation link, and only then takes the next record. A rejected/thrown `dispatchBatch` is diagnosed without caught detail and the pump advances. [VERIFIED: `07-CONTEXT.md`; `executeDispatchBatch` stable row contract]

Epoch cancellation leaves queued records in FIFO with their composed signal aborted. When they reach `dispatchBatch`, Phase 6 produces one aborted correlation row per call, and an active session responds to those rows normally. Stop is different: synchronously splice queued records into a local drain list, clear the live queue, abort active and detached records, await the active pump, then run each detached record serially through `dispatchBatch` exactly once with response emission suppressed. This reconciles the locked “clear queue state,” “dispatch once,” “drain,” and “no response after stop” requirements without dropping accepted work. [VERIFIED: `07-CONTEXT.md`; `dispatch.ts:1001-1066`]

### Pattern 5: One per-batch structural cancellation scope

Create a private scope with `{ signal, abort(), dispose() }`. Its `signal` implements only `AbortSignalLike`; `abort()` is idempotent, marks the signal first, snapshots/clears its listener set, then invokes listeners independently; `dispose()` removes the one upstream transport listener and is also idempotent. Link the optional transport signal once, and invoke the same scope's `abort()` for epoch change or session stop. [VERIFIED: `AbortSignalLike`; `waitForCommit` idempotent cleanup precedent; `07-CONTEXT.md` composition rule]

Treat an unreadable/malformed upstream signal or a throwing `addEventListener` as cancelled, emit `abort_signal_failed`, and still pass the composed signal so the dispatcher fails closed. Never leak the thrown value. A handler already entered may retain the structural signal and delay completion; the drain waits and does not pretend to terminate it. [VERIFIED: `dispatch.ts:450-478`; `07-CONTEXT.md`]

### Pattern 6: Preserve the transport envelope, replace only signal

Construct one shallow frozen envelope per accepted occurrence with the exact captured values of `responseId`, `userTurnId`, `calls`, and `deferUntilDelivered`, plus the composed signal. Do not clone calls, invent a `userTurnId`, wrap the delivery hook, parse arguments, reorder calls, or create results in Session. [VERIFIED: SES-03; `dispatch.ts:805-967,1008-1058`]

The test must assert reference equality for `calls` and `deferUntilDelivered`, value equality for both ids, and inequality/behavioral composition for `signal`. Use a real `createConcierge` handler to prove the same `responseId`, `userTurnId`, and delivery-hook function arrive in `InvocationMeta`; a structural Concierge spy alone does not prove the Phase 6 handoff. [VERIFIED: `ToolBatch`/`InvocationMeta` twin signatures; `test-d/transport.test-d.ts`]

### Pattern 7: Reentrancy-safe stage notification

Store listeners as tokenized records in a factory-local `Map<number, callback>` with a never-reset monotonic counter. An unsubscriber deletes only its token; after replacement/stop it is a no-op. Queue stage values and use a `notifying` guard: snapshot listeners for one value, finish that value's snapshot, then deliver any stage value enqueued by a reentrant `setContext`. This prevents an outer notification from delivering an older stage after a nested notification delivered a newer one. [VERIFIED: `07-CONTEXT.md`; `createBridge` token pattern]

Before every callback in a snapshot, re-check lifecycle; if a listener reentrantly stops the session, do not call later listeners. Contain a throw, emit one safe diagnostic, and continue only while still active. A listener added during delivery begins with the next change; removal during delivery does not alter the already-taken snapshot. [VERIFIED: locked snapshot/no-post-stop rules]

### Pattern 8: Cache the stop Promise before outside code

On the first `stop()`, create and assign a deferred `Promise<void>`, set lifecycle to `stopped`, and only then call unregister functions, cancellation listeners, diagnostics, or `setTools(empty)`. This makes a reentrant `stop()` from any outside callback return the same object and makes every stale transport callback observe the stopped state. Later calls return the cached object with no cleanup repetition. [VERIFIED: `07-CONTEXT.md`]

Invoke status unsubscribe, batch unsubscribe, work abort, listener/event clearing, queue detachment, and empty-catalog publication as independent guarded steps. A cleanup failure may leave a hostile transport's own subscriber registered—core cannot force an unsubscriber to work—but the retained callback is inert because stopped state was established first. Resolve, never reject, the drain after all session-owned dispatch/finalizer work settles. [VERIFIED: locked independent cleanup/stale-callback contract]

### Pattern 9: Closed, immutable, replacement diagnostics

Use a two-field public diagnostic and a closed exported code union:

```typescript
// Source: locked 07-CONTEXT.md; exact names are the recommended discretion resolution.
export type SessionDiagnosticCode =
  | "catalog_publish_failed"
  | "batch_dispatch_failed"
  | "response_failed"
  | "stage_listener_failed"
  | "transport_subscribe_failed"
  | "transport_unsubscribe_failed"
  | "catalog_clear_failed"
  | "abort_signal_failed"
  | "batch_without_context";

export interface SessionDiagnostic {
  readonly code: SessionDiagnosticCode;
  readonly message: string;
}
```

Recommended fixed messages, each carried in a freshly frozen `{code, message}` object: [VERIFIED: locked fixed-safe-message and immutability constraints]

| Code | Exact safe message |
|------|--------------------|
| `catalog_publish_failed` | `The transport rejected a catalog publication, so the session was stopped.` |
| `batch_dispatch_failed` | `The dispatcher could not complete an accepted batch; later batches will continue.` |
| `response_failed` | `The transport rejected a result; it was not retried.` |
| `stage_listener_failed` | `A stage subscriber threw; remaining subscribers will continue.` |
| `transport_subscribe_failed` | `The transport could not register a session subscription; construction was rolled back.` |
| `transport_unsubscribe_failed` | `The transport could not remove a session subscription; remaining cleanup continued.` |
| `catalog_clear_failed` | `The transport could not clear its catalog; remaining cleanup continued.` |
| `abort_signal_failed` | `A batch cancellation signal failed; the batch was treated as cancelled.` |
| `batch_without_context` | `A batch arrived before session context was set and was ignored.` |

If `onDiagnostic` exists, call only it; do not fall back to `warnHost` when it throws, because replacement means replacement. If absent, call `warnHost("concierge: [${code}] ${message}")`. Both calls are guarded with a no-binding `catch`; diagnostics contain no subject field, caught class, id, context, argument, result, or batch excerpt. [VERIFIED: `07-CONTEXT.md`; `host.ts` safe sink precedent]

### Pattern 10: Test stub as a controlled boundary

Return a frozen test harness containing a frozen `transport` and external controls, rather than putting test controls directly on the object passed as `Transport`. Recommended shape: [VERIFIED: locked stub requirements]

```typescript
// Source: locked 07-CONTEXT.md; test-only API recommendation.
const stub = createStubTransport({
  capabilities: CONVERSATIONAL_CAPABILITIES,
  initialStatus: "idle",
  failures: {
    setToolsAt: [2],       // 1-based invocation numbers
    respondAt: [1],
    subscribeStatus: false,
    subscribeBatch: false,
    unsubscribeStatus: false,
    unsubscribeBatch: false,
  },
});

stub.transport;                    // the only object supplied to production core
stub.emitStatus("connected");     // synchronous, snapshots subscriber set
stub.emitBatch(batch);             // synchronous, snapshots subscriber set
stub.catalogHistory();             // frozen snapshot of every attempt
stub.responseHistory();            // frozen snapshot of every attempt
stub.subscriberCounts();            // frozen { status, batch }
```

Record an attempted `setTools`/`respond` entry before throwing at a configured occurrence so tests can prove that a failure was attempted once and never retried. Preserve catalog references in history so reconnect identity is assertable with `toBe`; freeze the history snapshot and response rows rather than cloning the catalog elements. Status changes should emit only on actual value transitions. [VERIFIED: `07-CONTEXT.md`; catalog reference requirement]

Define and freeze these named test-only profiles: [VERIFIED: `07-CONTEXT.md`; existing Phase 1 structural fixtures]

| Profile | `consentGrade` | `userTurnIdentity` | `parallelCalls` | `dynamicCatalog` |
|---------|----------------|--------------------|-----------------|------------------|
| Conversational | `relayed` | `agent-forgeable` | `true` | `true` |
| Command palette | `attested` | `human-attested` | `false` | `false` |

Production `session.ts` may branch on `dynamicCatalog` and status values only; it must not contain either profile name, and it must not enforce grade or turn provenance before Phase 8. [VERIFIED: locked capability-not-modality and deferred-consent decisions]

## Exact Public Contract Recommendation

```typescript
// Source: current types.ts plus locked Phase 7 amendments.
export type TransportStatus = "idle" | "connecting" | "connected" | "closed";

export interface Transport {
  readonly capabilities: TransportCapabilities;
  readonly status: TransportStatus;
  setTools: (tools: ReadonlyArray<EmittedTool>) => void;
  onStatusChange: (cb: (status: TransportStatus) => void) => () => void;
  onToolBatch: (cb: (batch: ToolBatch) => void) => () => void;
  respond: (callId: string, result: ActionResult) => void;
}

export interface Session {
  setContext: (ctx: StageContext) => void;
  stage: () => string | null;
  onStageChange: (cb: (stage: string | null) => void) => () => void;
  stop: () => Promise<void>;
}

export interface SessionConfig {
  concierge: Concierge;
  transport: Transport;
  initialContext?: StageContext | undefined;
  onDiagnostic?: ((diagnostic: SessionDiagnostic) => void) | undefined;
}

export function createSession(config: SessionConfig): Session;
```

`TransportStatus`, `SessionDiagnosticCode`, and `SessionDiagnostic` should be named public types because consumers implement the transport/status callback and must exhaustively handle diagnostics; `createSession` is the sole new public value. This produces the mechanically expected 69/54/15 declaration counts. [VERIFIED: current 65/51/14 surface plus the four recommended names]

## Component Responsibilities

| Component | Owns | Must not own |
|-----------|------|--------------|
| `session.ts` | lifecycle state, context/catalog/stage/epoch, subscriptions, FIFO, cancellation scopes, diagnostics, stop drain | matcher logic, call parsing/order, validation, result authorship, consent, framework hooks, wire vocabulary |
| `concierge.ts` | catalog projection, stage resolution, dispatch and dispatchBatch | live context, transport registrations, reconnect, stop |
| `dispatch.ts` | envelope snapshot, call order, parsing, abort rows, metadata forwarding, handler/result boundary | cross-batch queue, transport response calls |
| `types.ts` | public structural contracts only | runtime helpers or fixture controls |
| `test/fixtures/stub-transport.ts` | explicit events, attempts, configured failures, counts, profile constants | production export, implicit timers, session logic, consent decisions |

The boundaries above are directly implied by the existing public interfaces and the Phase 7 boundary; crossing them would duplicate a previously proven invariant or implement a deferred phase. [VERIFIED: `07-CONTEXT.md`; `04-VERIFICATION.md`; `06-VERIFICATION.md`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stage matching/catalog assembly | A second matcher loop or catalog comparison | `concierge.stageFor(ctx)` and reference-stable `catalogFor(ctx)` | Existing policy contains throws, non-booleans, declaration order, cross-stage actions, duplicate ids, and memo identity. [VERIFIED: `concierge.ts`; Phase 4 evidence] |
| Batch parsing/call ordering/correlation | A Session loop over `batch.calls` | One `concierge.dispatchBatch(ctx, envelope)` | Dispatcher guards hostile metadata, orders stably, forwards metadata, and fills aborted rows. [VERIFIED: `dispatch.ts`; Phase 6 evidence] |
| Session-level dedup | Batch-id/call-id cache or coalescing | Existing `Concierge.dispatch` cache | Each incoming occurrence still owes response attempts; core call dedup already protects effects. [VERIFIED: DSP-01/SES-02] |
| Vendor reconnect mapping | `onReconnect`, wire event strings, or SDK import | `TransportStatus` plus `onStatusChange` | Neutral connection transitions are the locked abstraction. [VERIFIED: TRN-01; `07-CONTEXT.md`] |
| Timer-driven queue/drain | Poll loop, timeout, or background timer | Async FIFO pump and cached Promise | The stub/session must use no timer; work promises already define completion. [VERIFIED: `07-CONTEXT.md`] |
| DOM cancellation | `AbortController`, DOM lib, or dependency | Private `AbortSignalLike` source | Maintains platform-neutral compilation and existing dispatcher compatibility. [VERIFIED: `tsconfig.base.json`; `types.ts`] |
| General event emitter | EventEmitter/package | Tokenized factory-local `Map` + snapshot delivery | Only one closed event shape exists, and existing bridge code supplies the proven identity pattern. [VERIFIED: `bridge.ts`] |
| Error serialization | Passing caught values/classes/stacks to diagnostic hook | Closed code + fixed message table | Raw callback errors can echo user data and violate the project security rule. [VERIFIED: `CLAUDE.md`; `07-CONTEXT.md`] |
| Result recovery after `respond` throws | Retry/backoff or synthesized ack | Diagnose once, continue next row | Acceptance is ambiguous; retry can duplicate delivery. [VERIFIED: `07-CONTEXT.md`] |
| Production mock export | `createStubTransport` in `src/` or barrel | Relative import from `test/fixtures/stub-transport.ts` | Keeps package surface/runtime clean while Phase 8 can reuse the fixture. [VERIFIED: `07-CONTEXT.md`; package files list] |

**Key insight:** Phase 7's correctness comes from sequencing already-proven components, not from adding transformations. Any new parsing, matching, result construction, retry, timer, or modality branch is a likely boundary violation. [VERIFIED: Phase 4/6 implementations and locked scope]

## Common Pitfalls

### Pitfall 1: Using stage string equality as the catalog epoch

**What goes wrong:** Duplicate stage ids can produce the same `stage()` string with different catalog arrays, so the transport remains stale and old work is not aborted. **Why it happens:** Stage strings look semantic while Phase 4 deliberately memoizes by declaration position. **How to avoid:** Compare catalog references only; compare stage strings only for subscriber notification. **Warning signs:** A test with two matching stages sharing an id changes tools but emits no `setTools`. [VERIFIED: `concierge.ts:508-551`; `concierge.test.ts` S26; `07-CONTEXT.md`]

### Pitfall 2: Calling `catalogFor({})` when there is no context

**What goes wrong:** Cross-stage actions are published even though the locked no-context behavior is an empty catalog. **Why it happens:** `StageContext` is structurally easy to fabricate and the no-stage Concierge projection is not empty by design. **How to avoid:** Keep an explicit `currentContext: StageContext | null` and one frozen empty catalog. **Warning signs:** The initial history contains a global action in a session constructed without `initialContext`. [VERIFIED: `concierge.ts:717-737`; `07-CONTEXT.md`]

### Pitfall 3: Dropping aborted queued batches

**What goes wrong:** Accepted calls receive no correlated result and `dispatchBatch` is not invoked once per occurrence. **Why it happens:** “Abort queued work” is misread as “delete queue entries.” **How to avoid:** Abort the record's composed signal but leave it in FIFO on epoch change; on stop, detach and drain it once with responses suppressed. **Warning signs:** Dispatch-spy count is lower than accepted-occurrence count. [VERIFIED: `07-CONTEXT.md`; DSP-07]

### Pitfall 4: Promise chaining hides queue state from stop

**What goes wrong:** `stop()` cannot synchronously clear/detach queued state or individually abort/finalize records. **Why it happens:** A Promise tail appears to guarantee serialization with less code. **How to avoid:** Use an explicit array, active record, and one pump Promise. **Warning signs:** Queue records exist only inside `.then` closures. [VERIFIED: locked teardown requirements]

### Pitfall 5: Assigning the stop Promise after cleanup begins

**What goes wrong:** An unsubscriber, `setTools`, abort listener, or diagnostic hook reentrantly calls `stop()` and receives a second Promise or repeats cleanup. **Why it happens:** The promise is treated as a return value rather than lifecycle state. **How to avoid:** Construct/cache it and mark stopped before the first outside call. **Warning signs:** Two synchronous `stop()` calls fail `toBe`, or cleanup invocation counts exceed one. [VERIFIED: `07-CONTEXT.md`]

### Pitfall 6: Emitting from an old stage notification after a nested update

**What goes wrong:** Listener A calls `setContext(newer)`, the nested change emits, then the outer loop tells listener B the older stage. **Why it happens:** Snapshotting listeners alone does not serialize stage values. **How to avoid:** Queue stage values behind a `notifying` guard; complete one snapshot before the next value. **Warning signs:** Observed sequence is `old,new,old` across two listeners. [VERIFIED: locked snapshot/reentrancy rules; derived ordering requirement]

### Pitfall 7: Letting a fixed-catalog transport live after identity change

**What goes wrong:** New batches capture new application context while the agent still holds old tools. **Why it happens:** Code throws before stopping or treats equal tool contents as safe. **How to avoid:** Retain/resolve the new context, transition stopped synchronously, then throw the fixed error; never deep-compare. **Warning signs:** Subscriber counts remain non-zero or a reentrant batch reaches dispatch after the throw. [VERIFIED: `07-CONTEXT.md`]

### Pitfall 8: Retrying `respond`

**What goes wrong:** A transport may have accepted the first call before throwing, so retry duplicates the result. **Why it happens:** Ordinary network retry intuition is applied to an acknowledgment-free method. **How to avoid:** Record one attempt, diagnose without ids/details, and continue stable later rows. **Warning signs:** Stub response-attempt history has the same returned row twice. [VERIFIED: `07-CONTEXT.md`]

### Pitfall 9: Suppressing only future batches after stop

**What goes wrong:** An active `dispatchBatch` resolves after stop and Session emits responses or a stage callback already in a snapshot continues. **Why it happens:** Stale subscription callbacks are guarded, but async continuations and notification loops are not. **How to avoid:** Check lifecycle immediately before every outside response/stage callback. **Warning signs:** Any response/event history grows after the synchronous stop transition. [VERIFIED: `07-CONTEXT.md`]

### Pitfall 10: Letting one cleanup throw skip the rest

**What goes wrong:** One subscriber remains, work is not aborted, or the empty catalog is never attempted. **Why it happens:** Cleanup is placed in one `try/finally` chain or `Promise.all` that short-circuits. **How to avoid:** Guard every step independently and make the drain resolve. **Warning signs:** Injecting a status-unsubscribe failure prevents the batch unsubscribe or clear attempt. [VERIFIED: `07-CONTEXT.md`]

### Pitfall 11: Making the diagnostic hook a second fatal path

**What goes wrong:** The consumer's hook throws and stops later response rows, notifications, or teardown. **Why it happens:** Build-time `onDiagnostic` intentionally propagates, but runtime diagnostics have the opposite contract. **How to avoid:** Use a no-binding catch around every hook invocation and never fall back to console when a replacement hook fails. **Warning signs:** A throwing hook rejects `stop()` or prevents the next response attempt. [VERIFIED: `catalog.ts:365-377`; `07-CONTEXT.md`]

### Pitfall 12: Mutating the transport contract without every exact pin

**What goes wrong:** Source compiles while fixtures, foreign declarations, artifact counts, or docs still assert four Transport members / void stop / no Session runtime. **Why it happens:** The repository intentionally duplicates public-shape checks at source, built artifact, and foreign-consumer layers. **How to avoid:** Update all synchronized gates in one plan and re-derive counts from `dist/index.d.ts`. **Warning signs:** `pnpm typecheck` fails in `transport.test-d.ts`, or export surface still says 65/51/14. [VERIFIED: current tests]

### Pitfall 13: Extending Phase 7 into consent

**What goes wrong:** Session begins reading `consentGrade`, enforcing turn provenance, invoking delivery hooks, or composing human-facing outcomes before the kernel exists. **Why it happens:** TRN-02's requirement sentence mentions the full kernel, and CON-10 will eventually live at this seam. **How to avoid:** Forward the data unchanged and preserve the fixture; Phase 8 alone consumes it. **Warning signs:** Production Session branches on grade/profile/provenance or invokes `deferUntilDelivered`. [VERIFIED: `07-CONTEXT.md` deferred section; ROADMAP Phase 8]

### Pitfall 14: Adding a queue limit without a response protocol

**What goes wrong:** Overflow drops an accepted occurrence and leaves calls awaiting results. **Why it happens:** An unbounded FIFO looks like a denial-of-service risk, but no overload result or rejection callback exists in the contract. **How to avoid:** Do not invent a Phase 7 cap; the dispatcher already bounds one batch's observed call count at 10,000, and broader backpressure needs a future transport contract decision. **Warning signs:** `emitBatch` succeeds but neither `dispatchBatch` nor `respond` observes the occurrence. [VERIFIED: `dispatch.ts:37-38,940-967`; SES-02]

## Source and File Impact

| File | Required impact | Proof obligation |
|------|-----------------|------------------|
| `packages/concierge/src/types.ts` | Add `TransportStatus`, `SessionDiagnosticCode`, `SessionDiagnostic`; add `Transport.status`/`onStatusChange`; widen `Session.stop`; add exact-optional `SessionConfig.onDiagnostic` and fix `initialContext`. | Type program pins unions, keys, readonly modifiers, callback signatures, Promise stop, and computed optional construction. [VERIFIED: current type-test conventions] |
| `packages/concierge/src/session.ts` | New hot factory and all factory-local runtime state. | Runtime suites prove construction, identity epochs, FIFO, cancellation, response attempts, teardown, reentrancy, and diagnostic safety. [VERIFIED: `07-CONTEXT.md`] |
| `packages/concierge/src/index.ts` | Export three new types and `createSession`; replace the lines claiming Session does not exist. | Source entrypoint type placement, artifact callable check, parsed declaration count/name check. [VERIFIED: `index.ts:46-52`; export gates] |
| `packages/concierge/src/contract.ts` | Correct call-site prose to name `createSession` as a fourth guarded entry point. | Built declaration prose is truthful and F7 proves the direct call. [VERIFIED: existing contract commentary convention] |
| `packages/concierge/test/fixtures/stub-transport.ts` | Add the reusable frozen stub, profiles, controls, failures, histories, and counts. | Dedicated tests plus import from all three Session suites and later Phase 8. [VERIFIED: locked location/reuse] |
| `packages/concierge/test/session-catalog.test.ts` | New catalog/status/stage/fixed-profile cases. | SES-01 plus lifecycle subset. |
| `packages/concierge/test/session-routing.test.ts` | New cross-batch FIFO, capture, epoch, signal, envelope, response cases. | SES-02/SES-03. |
| `packages/concierge/test/session-lifecycle.test.ts` | New rollback, stop identity/drain, stale callback, cleanup, reentrancy, diagnostic cases. | SES-04 and security negatives. |
| `packages/concierge/test/stub-transport.test.ts` | New fixture contract/profile/history/no-I/O cases. | TRN-02 Phase 7 half. |
| `packages/concierge/test-d/transport.test-d.ts` | Update two transport literals and exact key set from four to six; pin status union/callback/readonly. | TRN-01 remains neutral while lifecycle becomes observable. [VERIFIED: current file] |
| `packages/concierge/test-d/actions.test-d.ts` | Update implementing Session fixture's `stop` to return a Promise and add exact pin if not moved. | Existing D-08 checks remain green. [VERIFIED: current file] |
| `packages/concierge/test-d/session.test-d.ts` | New exact factory/config/diagnostic/Session pins and negative mutability/use shapes. | Public pre-publish contract is mutation-sensitive. |
| `packages/concierge/test-d/exports.test-d.ts` | Import/pin `createSession` as a value from `src/index.js`. | A type-only export move is TS1485. [VERIFIED: existing export-placement pattern] |
| `packages/concierge/test/artifact.test.ts` | Assert built `createSession` is callable. | Runtime binding survived bundling. [VERIFIED: existing value-export pattern] |
| `packages/concierge/test/export-surface.test.ts` | Add `createSession`; update 69 names / 54 types / 15 values and title prose. | Built declaration surface exact. [VERIFIED: current 65/51/14 baseline] |
| `packages/concierge/test/single-instance.test.ts` | Add F7 with structural Concierge/Transport fakes and a unique query string. | `createSession` directly records the package copy without calling another guarded factory. [VERIFIED: F4-F6 pattern] |
| `packages/concierge/test/fixtures/probe.ts` | Import `createSession` as a value and the new types; construct a minimal transport/session config under foreign `exactOptionalPropertyTypes`. | Packed declaration/value usability, not only source typecheck. [VERIFIED: PKG-02 harness] |
| `scripts/pack-install-check.sh` | After packing, inspect tar entries and fail if `test/fixtures/stub-transport` appears; make runtime import assert `createSession` callable. | Stub is absent and new value is shipped. [VERIFIED: current harness does not list contents] |
| `packages/concierge/package.json` / root `package.json` / `pnpm-lock.yaml` | No changes. | Final byte comparison and zero-runtime-dependency gate. [VERIFIED: no new dependency required] |

## Code Examples

Verified patterns and implementation skeletons:

### Catalog transition ordering

```typescript
// Source: 07-CONTEXT.md + catalogFor identity in src/concierge.ts.
function setContext(ctx: StageContext): void {
  assertActive();
  currentContext = ctx; // retain newest reference first

  const nextCatalog = concierge.catalogFor(ctx);
  const nextStage = concierge.stageFor(ctx);
  const catalogChanged = nextCatalog !== currentCatalog;
  const stageChanged = nextStage !== currentStage;

  if (catalogChanged && !transport.capabilities.dynamicCatalog) {
    currentStage = nextStage;
    void stop(); // synchronous stopped transition occurs inside
    throw new Error(FIXED_CATALOG_ERROR);
  }

  if (catalogChanged) {
    currentCatalog = nextCatalog;
    currentStage = nextStage;
    epoch += 1;
    abortWorkBefore(epoch);
    publishOrStop(nextCatalog);
  } else {
    currentStage = nextStage;
  }

  if (stageChanged && lifecycle === "active") enqueueStage(nextStage);
}
```

### One dispatch and stable response attempts

```typescript
// Source: 07-CONTEXT.md + frozen stable rows from src/dispatch.ts.
async function runWork(work: Work): Promise<void> {
  try {
    const rows = await concierge.dispatchBatch(work.context, work.envelope);
    for (const row of rows) {
      if (lifecycle !== "active") break;
      try {
        transport.respond(row.callId, row.result);
      } catch {
        diagnose("response_failed");
      }
    }
  } catch {
    diagnose("batch_dispatch_failed");
  } finally {
    work.cancel.dispose();
  }
}
```

### Cached stop promise before reentrancy

```typescript
// Source: locked stop identity/order contract.
function stop(): Promise<void> {
  if (stopPromise !== null) return stopPromise;

  let resolveDrain!: () => void;
  stopPromise = new Promise<void>((resolve) => { resolveDrain = resolve; });
  lifecycle = "stopped";

  const detached = queue.splice(0);
  // Every outside cleanup call is separately guarded here.
  beginStopCleanup(detached, resolveDrain);
  return stopPromise;
}
```

### Tokenized listener unsubscriber

```typescript
// Source: src/bridge.ts token pattern, generalized to a listener map.
const token = ++nextListenerToken;
listeners.set(token, callback);
return (): void => {
  if (listeners.get(token) === callback) listeners.delete(token);
};
```

The snippets are ordering specifications, not permission to omit the hostile-callback guards, state rechecks, and finalizers described above. [VERIFIED: locked lifecycle requirements]

## State of the Art

| Old/current pre-Phase-7 approach | Required Phase-7 approach | When changed | Impact |
|----------------------------------|---------------------------|--------------|--------|
| App manually calls `catalogFor`, `dispatchBatch`, and transport methods | Hot Session owns the complete neutral loop | Phase 7, locked 2026-08-08 | Reconnect/stage changes cannot silently retain an old catalog. [VERIFIED: `index.ts:46-52`; `07-CONTEXT.md`] |
| Four-member Transport with no lifecycle | Six-member Transport with required status and status subscription | Phase 7 | Reconnect is modeled without a vendor event name. [VERIFIED: current types; locked context] |
| `Session.stop(): void` declaration only | Cached `Promise<void>` drain with synchronous fail-closed transition | Phase 7 | Callers can observe zero session-owned pending work and get reference-stable idempotence. [VERIFIED: current types; locked context] |
| One batch serializes internally, but separate calls may overlap | Complete incoming batches FIFO plus existing within-batch serial order | Phase 7 | At most one Session batch reaches application dispatch at once. [VERIFIED: Phase 6 implementation; locked context] |
| No operational runtime diagnostic seam | Closed immutable Session diagnostic hook replacing `warnHost` | Phase 7 | Callback/transport failures become observable without caught-data leakage or cleanup control. [VERIFIED: current host/catalog patterns; locked context] |
| ASVS 4.x labels used by earlier planning templates | Stable ASVS 5.0.0 labels: V2 Validation/Business Logic, V4 API, V7 Session Management, V8 Authorization, V16 Logging/Error Handling | ASVS 5.0.0, May 2025 | `07-VALIDATION.md` should version-prefix ASVS references instead of silently reusing old chapter numbers. [CITED: https://github.com/OWASP/ASVS] |

**Deprecated/outdated:**

- Any prose saying Session ownership or transport routing is not implemented becomes false when this phase lands and must be corrected in `src/index.ts`. [VERIFIED: `index.ts:46-52`]
- Any exact claim that Transport has four members becomes false; the neutral six-member set is the new contract. [VERIFIED: `test-d/transport.test-d.ts`; `07-CONTEXT.md`]
- `Session.stop: () => void` is superseded by the awaitable cached drain. [VERIFIED: current type; locked context]
- Vendor-specific reconnect callbacks remain forbidden rather than deprecated alternatives. [VERIFIED: TRN-01; locked context]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None. Locked lifecycle/stub decisions, current source/tests, local gate results, npm registry versions, and official ASVS 5.0 were all inspected directly. | — | — |

## Open Questions

There are no blocking product or contract questions. The following are resolved planning notes, not decisions to reopen: [VERIFIED: `07-CONTEXT.md`]

1. **How can stop clear queued state and still dispatch each accepted occurrence once?**
   - Resolution: synchronously splice queued records into a private drain list, abort them, await the active pump, then call `dispatchBatch` once per detached record with responses suppressed.
2. **What does TRN-02 mean before consent exists?**
   - Resolution: Phase 7 proves the reusable configurable no-I/O stub and full session seam; Phase 8 reuses that exact fixture for the literal consent-kernel exercise. Do not fake consent evidence in Phase 7.
3. **Should a `closed` status automatically stop Session?**
   - Resolution: no. The locked behavior assigns special meaning only to transitions into `connected`; explicit `stop()` remains the lifetime boundary.
4. **Should initial publication depend on `transport.status`?**
   - Resolution: no. Construction always publishes once, and every later `connected` event forces replay. Gating the first publication would contradict hot construction.
5. **Should Session enforce `parallelCalls`, consent grade, or turn provenance?**
   - Resolution: no. `dispatchBatch` already serializes calls, while grade/provenance enforcement is Phase 8; Phase 7 branches only on `dynamicCatalog` and neutral status.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | build/runtime tests | ✓ | 24.14.1 local; 22.12.0 floor probe ✓ | None needed. [VERIFIED: local command and `check:node-floor`] |
| pnpm | workspace commands | ✓ | 11.17.0 | Use repository Corepack/package-manager pin; do not upgrade in phase. [VERIFIED: local command; `package.json`] |
| TypeScript | source/type tests | ✓ | 7.0.2 | None; exact project pin. [VERIFIED: local command; npm registry] |
| Vitest | runtime suites | ✓ | 4.1.10 | None; exact project pin. [VERIFIED: local dependency graph; npm registry] |
| tsdown | build before runtime tests | ✓ | 0.22.14 | Existing `pnpm build`; no alternate builder needed. [VERIFIED: local dependency graph] |
| publint / ATTW | artifact gate | ✓ | 0.3.22 / 0.18.5 | Existing standalone gate. [VERIFIED: successful local gate] |
| Network / transport service | none | not required | — | Stub is entirely synchronous and local. [VERIFIED: locked scope] |
| DOM / WebRTC / vendor SDK | none | not required | — | Structural types and test controls only. [VERIFIED: locked scope; no-DOM compiler config] |

**Missing dependencies with no fallback:** None. [VERIFIED: successful baseline commands]

**Missing dependencies with fallback:** None. [VERIFIED: successful baseline commands]

## Validation Architecture

`workflow.nyquist_validation` is `true`, so Phase 7 requires a concrete validation ledger rather than implementation-only tests. [VERIFIED: `.planning/config.json`]

### Test Framework

| Property | Value |
|----------|-------|
| Runtime framework | Vitest 4.1.10, Node project, tests against built `packages/concierge/dist/index.js`. [VERIFIED: `vitest.config.ts`; package pin] |
| Type framework | TypeScript 7.0.2 through `tsc -p packages/concierge/tsconfig.test-d.json`. [VERIFIED: package script/config] |
| Current baseline | `pnpm typecheck` green; `pnpm test` green at 12 files / 252 tests / 0 pending / 0 todo. [VERIFIED: local commands 2026-08-08] |
| Quick catalog run | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-catalog.test.ts` |
| Quick routing run | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-routing.test.ts` |
| Quick lifecycle run | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/session-lifecycle.test.ts` |
| Quick stub run | `pnpm exec vitest run packages/concierge/test/stub-transport.test.ts` |
| Type run | `pnpm --filter @fullselfbrowsing/concierge typecheck` |
| Full suite | `pnpm build && pnpm typecheck && pnpm test` |
| Phase gate | `pnpm build && pnpm typecheck && pnpm test && pnpm check:artifact && pnpm check:deps && pnpm check:pack && pnpm check:node-floor` |

Do not use `pnpm test -- <fragment>`; earlier phases measured that Vitest does not receive the intended filter through that spelling. Invoke `pnpm exec vitest run <exact-file>` for scoped feedback, and build first because runtime tests import `dist`. [VERIFIED: prior phase validation records; runtime test headers]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SES-01 | Initial context publishes the exact `catalogFor` reference before return; absent context publishes a frozen empty reference and stage null | integration/runtime | quick catalog run | ❌ Wave 0 |
| SES-01 | Same-catalog context update retains new context but does not publish; identity change publishes once; stage listeners key only on string/null change | integration/runtime | quick catalog run | ❌ Wave 0 |
| SES-01 | Every actual transition to `connected` republishes the latest identical catalog reference; other statuses do nothing | integration/runtime | quick catalog run | ❌ Wave 0 |
| SES-01 | Fixed transport accepts initial/same/reconnect publication but a later identity change stops before throw and accepts no reentrant work | security/runtime | quick catalog + lifecycle runs | ❌ Wave 0 |
| SES-02 | Complete batches are FIFO across the session and calls remain serial inside each batch | concurrency/runtime | quick routing run | ❌ Wave 0 |
| SES-02 | Every accepted occurrence calls `dispatchBatch` once; every real dispatcher row yields one stable-order response attempt | integration/runtime | quick routing run | ❌ Wave 0 |
| SES-02 | A thrown response is attempted once, diagnosed safely, later rows and later batches continue, and no retry occurs | hostile-callback/runtime | quick routing run | ❌ Wave 0 |
| SES-03 | Batch arrival captures context reference/epoch; same-catalog update does not abort old work and later batches capture new context | concurrency/runtime | quick routing run | ❌ Wave 0 |
| SES-03 | `responseId`, `userTurnId`, `calls`, and delivery hook are unchanged; composed signal reflects transport, epoch, and stop cancellation | integration/runtime + type | quick routing + type runs | ❌ Wave 0 |
| SES-03 | A real handler receives the exact ids/hook through Phase 6 `InvocationMeta` | end-to-end/runtime | quick routing run | ❌ Wave 0 |
| SES-04 | First stop changes state synchronously and all calls return one Promise reference; stage remains readable; mutation methods throw fixed text | lifecycle/runtime + type | quick lifecycle + type runs | ❌ Wave 0 |
| SES-04 | Both subscriptions unregister, all scopes abort, live queue/listeners clear, empty catalog is attempted, and stale callbacks/unsubscribers are inert | lifecycle/runtime | quick lifecycle run | ❌ Wave 0 |
| SES-04 | Active handler ignoring abort delays drain; queued accepted records dispatch once aborted; no response/event occurs after stop | concurrency/runtime | quick lifecycle run | ❌ Wave 0 |
| SES-04 | Partial construction failures roll back whichever registrations succeeded and expose only a fixed error | hostile-callback/runtime | quick lifecycle run | ❌ Wave 0 |
| SES-04 | Each cleanup step survives adjacent throws; throwing diagnostic hook cannot reject drain or halt cleanup | security/runtime | quick lifecycle run | ❌ Wave 0 |
| TRN-02 | Both named capability profiles are deeply frozen and structurally satisfy updated Transport | type + runtime | quick stub + type runs | ❌ Wave 0 |
| TRN-02 | Status/batch controls are synchronous; histories/counts immutable; occurrence-based failures deterministic | fixture/runtime | quick stub run | ❌ Wave 0 |
| TRN-02 | Fixture/session contain no timer/network/platform/vendor dependency and fixture is absent from tarball/barrel | static + package | static grep + `pnpm check:pack` | ❌ Wave 0 |
| Public shape | Transport exactly six neutral keys; Session exactly four keys with Promise stop; diagnostics/config/factory exact | type | type run | ❌ Wave 0 |
| Public artifact | `createSession` callable; surface 69/54/15; foreign consumer compiles; direct single-instance guard fires | artifact/integration | artifact, export-surface, single-instance, pack gates | existing files need updates |

### Required Behavioral Matrix

`07-VALIDATION.md` should name cases rather than only file-level commands. Minimum matrix: [VERIFIED: locked decisions]

| Area | Required distinguishers |
|------|-------------------------|
| Initial state | context / no context; connected / non-connected status; dynamic / fixed catalog |
| Context change | same context object mutated; distinct contexts same catalog; different catalog same stage id; different catalog different stage |
| Reconnect | first connected, reconnect after non-connected transition, repeated identical status control suppressed by stub |
| Batch ordering | batch A blocked while B arrives; response-throw in A; B begins only after A finalizer |
| Epoch | active old work; queued old work; later new work; same-catalog update; transport signal already aborted and aborts later |
| Stop timing | before any work; during dispatch; during response loop; from unsubscriber; from stage listener; repeated before and after resolve |
| Stage listeners | duplicate callback subscribed twice; stale unsubscribe; add/remove during snapshot; throw; nested setContext; stop during notify |
| Setup rollback | first subscribe throws; second subscribe throws; invalid unsubscriber; initial setTools throws; cleanup also throws |
| Diagnostics | default sink; replacement hook; throwing hook; frozen object; exact keys; secret sentinel absent; no ids/raw fields |
| Stub | both profiles; every failure occurrence; history mutation attempts; subscriber counts; test-only package absence |

### Sampling Rate

- **Per task:** run `pnpm --filter @fullselfbrowsing/concierge typecheck`; if production source changed, build and run the exact affected Session file. [VERIFIED: current feedback times are sub-second for type/runtime baseline]
- **Per wave merge:** `pnpm build && pnpm typecheck && pnpm test`. [VERIFIED: established repository gate]
- **Contract/export wave:** add `pnpm exec vitest run packages/concierge/test/artifact.test.ts packages/concierge/test/export-surface.test.ts packages/concierge/test/single-instance.test.ts`. [VERIFIED: current gate locations]
- **Phase gate:** all seven release commands above, then the Phase 7 mutation battery and a byte-identical lockfile check. [VERIFIED: Phase 6 gate precedent]
- **Sign-off evidence:** record actual final test file/test counts, tarball file absence, export counts, and mutation detector output; never copy the 252-test baseline forward. [VERIFIED: `06-VALIDATION.md` live-ledger rule]

### Wave 0 Gaps

- [ ] `packages/concierge/test-d/session.test-d.ts` — factory, config, diagnostics, stop, exact key and readonly pins.
- [ ] Update `packages/concierge/test-d/transport.test-d.ts` — status/callback and six-key pin.
- [ ] `packages/concierge/test/fixtures/stub-transport.ts` — reusable deterministic fixture.
- [ ] `packages/concierge/test/session-catalog.test.ts` — SES-01 and fixed-catalog lifecycle.
- [ ] `packages/concierge/test/session-routing.test.ts` — SES-02/SES-03 and epoch cancellation.
- [ ] `packages/concierge/test/session-lifecycle.test.ts` — SES-04, rollback, reentrancy, diagnostics.
- [ ] `packages/concierge/test/stub-transport.test.ts` — TRN-02 fixture proof.
- [ ] Artifact/export/single-instance/foreign-probe/package-list updates for the new public value and types.
- [ ] Optional but recommended `scripts/phase-07-mutation-battery.mjs` plus immutable register/evidence files, following Phase 6's compiled-and-ran detector rule.
- [ ] Framework install: none.

### Mutation Targets

At minimum, prove tests go red for these edits rather than merely reporting a green suite: [VERIFIED: repository mutation-testing convention]

| Mutant | Required detector |
|--------|-------------------|
| Remove initial `setTools` | initial publication case |
| Remove forced connected replay | reconnect history identity case |
| Compare stage string/deep equality instead of catalog reference | duplicate-id / referential epoch case |
| Let fixed transport throw before stop | reentrant batch + subscriber-count case |
| Start two batch workers | cross-batch overlap counter |
| Read context at execution rather than arrival | blocked-A/new-context capture case |
| Omit epoch abort for active or queued work | two distinct signal cases |
| Forward transport signal instead of composed signal | stop/epoch abort observation |
| Call `dispatchBatch` zero/twice for queued cancellation | accepted occurrence counter |
| Retry `respond` after throw | stub attempt history |
| Allocate a new stop Promise | reference identity case |
| Mark stopped after an unsubscriber | reentrant stale callback case |
| Continue response/listener loop after stop | no-post-stop histories |
| Iterate live listener map instead of snapshot/queue | add/remove/nested notification cases |
| Reuse callback identity instead of monotonic token | duplicate-callback stale unsubscribe case |
| Interpolate caught message/id into diagnostic | secret-sentinel exact-object case |
| Let diagnostic hook throw escape | later-row/cleanup continuation case |
| Export or pack the stub | barrel name/tar listing case |
| Remove direct `assertSingleInstance` call | F7 only |

The mutation gate must verify from output that the mutant built and the named test executed; a build failure alone is not behavioral proof. [VERIFIED: Phase 6 mutation/validation records]

## Security Domain

OWASP's latest stable ASVS is 5.0.0 (May 2025), and its chapter numbers differ from the 4.x labels embedded in the generic research template. Use version-prefixed ASVS 5.0 references in `07-VALIDATION.md`. [CITED: https://github.com/OWASP/ASVS]

### Applicable ASVS 5.0 Categories

| ASVS Category | Applies | Phase 7 control |
|---------------|---------|-----------------|
| V2 Validation and Business Logic | yes | Session preserves the envelope and delegates all parsing/validation/result totality to the existing dispatcher; it adds no bypass path. [VERIFIED: `dispatch.ts`; SES-02/03] |
| V4 API and Web Service | yes, structurally | Transport is the external service boundary; the neutral exact interface, correlation preservation, one-attempt response policy, and no vendor vocabulary constrain it. [VERIFIED: TRN-01; `07-CONTEXT.md`] |
| V6 Authentication | no | Session neither authenticates users nor creates credentials/tokens. [VERIFIED: phase boundary] |
| V7 Session Management | partial analogy only | This “Session” is an agent-runtime lifetime, not an HTTP authentication session; its applicable controls are explicit invalidation, cleanup, and no post-stop activity. [VERIFIED: phase boundary; ASVS scope] |
| V8 Authorization | yes | Stage catalog identity is the action allowlist; fixed transports fail closed and old-epoch work is cancelled when authority changes. [VERIFIED: SES-01; STG-01; locked epoch rules] |
| V11 Cryptography | no | Phase 7 hashes, encrypts, signs, and generates no secret. [VERIFIED: phase boundary; Phase 8 deferrals] |
| V15 Secure Coding and Architecture | yes | Factory-local state, frozen handles/data, structural platform seams, and explicit ownership boundaries prevent cross-instance leakage. [VERIFIED: project constraints; architecture map] |
| V16 Security Logging and Error Handling | yes | Closed immutable diagnostics, no-binding catches, fixed messages, and contained hooks prevent error detail exfiltration/control-flow corruption. [VERIFIED: `07-CONTEXT.md`; `CLAUDE.md`] |
| V17 WebRTC | no | Core and stub contain no WebRTC implementation or dependency. [VERIFIED: locked scope] |

### Known Threat Patterns for the Session Seam

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Agent holds a stale catalog after navigation/reconnect | Elevation of Privilege / Tampering | Reference-identity publication epoch; connected replay; fixed-catalog fail-closed stop. [VERIFIED: SES-01] |
| Old-context batch runs after authority changed | Elevation of Privilege / TOCTOU | Capture context+epoch at arrival; abort all older-epoch active/queued scopes before publication. [VERIFIED: locked epoch rule] |
| Stop callback reentrancy reopens or duplicates cleanup | Tampering / Denial of Service | Cache drain and mark stopped before any outside code; stale callbacks inert. [VERIFIED: SES-04] |
| One hostile callback prevents later cleanup/results/listeners | Denial of Service | Independent catches/finalizers and lifecycle rechecks; drain resolves. [VERIFIED: `07-CONTEXT.md`] |
| `respond` retry duplicates an ambiguously accepted result | Repudiation / Integrity | Exactly one attempt, immutable attempt history in stub, no automatic retry. [VERIFIED: locked response rule] |
| Session invents/replaces turn or delivery evidence | Spoofing / Repudiation | Exact envelope forwarding; only signal is composed; Phase 8 alone interprets provenance/delivery. [VERIFIED: SES-03; deferred consent decisions] |
| Diagnostic leaks caught/user/call data | Information Disclosure | Two fixed fields, closed code union, fixed messages, no caught binding, exact secret-absence tests. [VERIFIED: project security constraint; locked diagnostics] |
| Listener/signal/timer survives stop | Denial of Service / state confusion | Both unsubs, per-work signal disposal, timer-free Session/stub, awaited drain, subscriber-count assertions. [VERIFIED: SES-04; TRN-02] |
| Duplicate core copy splits session from catalog/dispatcher | Tampering / Authorization bypass | Direct `assertSingleInstance` call in `createSession`, artifact F7, peer/package gates unchanged. [VERIFIED: PKG-04 architecture; existing contract guard] |

### Residual Limits

- JavaScript cannot forcibly terminate a handler that already entered; Session aborts its signal and waits. Stop suppresses its eventual responses, while a live catalog epoch change can only rely on cooperative cancellation once application code has begun. [VERIFIED: `07-CONTEXT.md`; current dispatcher has pre-handler but no post-handler abort rewrite]
- A throwing transport unsubscriber may fail to remove its own callback; core can only make the retained callback inert and continue other cleanup. [VERIFIED: structural interface limitation; locked stale-callback rule]
- Turn provenance and consent grade remain self-declared and unenforced until Phase 8. [VERIFIED: `types.ts` comments; ROADMAP Phase 8]
- Session FIFO has no new overload/drop protocol in Phase 7; inventing one would violate response cardinality. [VERIFIED: current public Transport lacks rejection/backpressure method]

## Recommended Plan Decomposition

| Wave | Deliverable | Dependencies | Exit signal |
|------|-------------|--------------|-------------|
| 1 | Public lifecycle/diagnostic contracts and exact type pins; update existing transport/session fixtures | none | `pnpm typecheck` green; six-key/Promise/EOPT mutations observed red |
| 1 | Test-only stub transport and dedicated fixture contract suite | contract shapes | stub quick run green; no production export/import |
| 2 | `session.ts` hot construction, initial publication, status replay, stage API, direct single-instance guard, public export/artifact pins | Wave 1 | catalog quick run + artifact/export/F7 green |
| 3 | FIFO routing, exact envelope forwarding, composed cancellation, epoch changes, fixed-catalog stop | Wave 2 | routing quick run green with no overlap and exact attempt histories |
| 4 | Cached stop drain, detached queue finalization, rollback, hostile cleanup, reentrant stage queue, diagnostics | Wave 3 | lifecycle quick run green; no post-stop output |
| 5 | Mutation battery, tarball exclusion, foreign consumer, zero-dep and full release gate; populate `07-VALIDATION.md` with measured evidence | Waves 1-4 | all gates green, lockfile identical, final counts recorded |

The contract and stub tracks can be parallel because they touch disjoint files after the Transport shape is agreed; runtime work is serial because publication, queueing, and teardown share the same lifecycle state machine. [VERIFIED: file impact and `07-CONTEXT.md`]

## Sources

### Primary (HIGH confidence)

- `.planning/phases/07-session-and-the-transport-seam/07-CONTEXT.md` — all locked lifecycle, cancellation, diagnostics, stub, and scope decisions.
- `.planning/REQUIREMENTS.md` — SES-01 through SES-04 and TRN-02 requirement text.
- `.planning/ROADMAP.md` — Phase 7 goal/success criteria, Phase 8 handoff, and dependency order.
- `.planning/STATE.md` — completed Phase 4/6 decisions and current no-blocker state.
- `packages/concierge/src/types.ts` — exact current Transport, ToolBatch, Session, SessionConfig, AbortSignalLike, and Concierge contracts.
- `packages/concierge/src/concierge.ts` — stage/catalog reference identity and dispatchBatch boundary.
- `packages/concierge/src/dispatch.ts` — defensive envelope snapshot, stable order, cancellation, immutable correlation rows.
- `packages/concierge/src/bridge.ts` — monotonic token, stale unsubscriber, factory-local state, frozen handle pattern.
- `packages/concierge/src/host.ts` — safe default warning sink.
- `packages/concierge/src/index.ts`, `src/contract.ts` — public documentation and single-instance call-site obligations.
- `packages/concierge/test-d/*.ts`, `packages/concierge/test/{artifact,export-surface,single-instance}.test.ts`, and `test/fixtures/probe.ts` — exact type/artifact/foreign-program gates.
- `.planning/phases/04-stages-catalog-assembly-and-explain/04-{VALIDATION,VERIFICATION}.md` — catalog identity/mutation evidence.
- `.planning/phases/06-dispatcher/06-{VALIDATION,VERIFICATION}.md` — dispatcher totality/current 252-test and mutation evidence.
- npm registry queries on 2026-08-08 — current versions and modification dates for TypeScript, Vitest, tsdown, Standard Schema, pnpm, Rolldown, publint, and ATTW.
- [OWASP ASVS official repository](https://github.com/OWASP/ASVS) — latest stable 5.0.0 and versioned category numbering.

### Secondary (MEDIUM confidence)

- None required.

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all tools are installed, pinned, registry-checked, and current release gates passed locally. [VERIFIED: local commands; npm registry]
- Architecture: HIGH — the user locked lifecycle semantics, and every adjacent catalog/dispatcher/listener primitive was inspected in current source and verified artifacts. [VERIFIED: context and codebase]
- Public/file impact: HIGH — every exact pin, artifact gate, current export count, foreign probe, and package file rule was inspected. [VERIFIED: codebase]
- Validation: HIGH — the current baseline and all seven existing gates were executed successfully; Wave 0 cases map one-to-one to locked behaviors. [VERIFIED: local commands]
- Teardown reconciliation: MEDIUM-HIGH — the detached drain is a reasoned implementation prescription satisfying all locked constraints; no production implementation exists yet to mutation-test it. [VERIFIED: constraints; implementation pending]
- Pitfalls/security: HIGH — failure modes follow directly from locked negative requirements and current code behavior; ASVS labels were checked against stable 5.0.0. [VERIFIED: codebase/context] [CITED: https://github.com/OWASP/ASVS]

**Research date:** 2026-08-08
**Valid until:** 2026-09-07 for repository architecture; re-check npm/tool versions only if the plan proposes upgrades, which this research forbids.
