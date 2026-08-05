# Phase 6: Dispatcher - Research

**Researched:** 2026-08-05
**Domain:** Dependency-free TypeScript dispatch orchestration, idempotency, validation, cancellation, and result-boundary security
**Confidence:** MEDIUM-HIGH

> Provenance note: `User Constraints` is copied verbatim from `06-CONTEXT.md`. Every factual claim outside that verbatim block carries an inline provenance tag.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Result shape and normalization (DSP-09, SEC-06)

- ⚠️ **WR-06 is ratified as option-b: the flat `ActionResult` shape stands.** Phase 1's
  execute-phase orchestrator selected it and recorded plainly that *the user did not*; the decision
  has been pending ratification since, with Phase 8 as the last free moment. Ratifying it here, with
  the reasoning stated so it can still be reversed:
  - The discriminated union on `ok` costs **six measured errors**, breaks
    `ConsentPolicy.onMissing: Pick<ActionResult, "reason" | "message">` with TS2344 — because
    `keyof` a union is the *intersection* of branch keys, collapsing `keyof ActionResult` to
    `"ok" | "message"` — and needs five edits to `test-d/results.test-d.ts`.
  - It also requires **superseding a standing "Rejected — do not revive" entry** in
    `01-CONTEXT.md`, authority no orchestrator has and which nothing new has come along to justify.
  - The mitigation for the flat shape is a **runtime normalizer at the dispatcher boundary**, which
    this phase builds anyway for DSP-09. Marginal cost of the mitigation is therefore ≈ zero.
  - A type that admits contradictions plus a runtime that rejects them is this project's own
    "enforced over declared" pattern applied correctly, not a compromise of it.
  **This remains an orchestrator ratification, not a user one.** It is surfaced for the user; if
  withheld, Phase 8 is still free and the union is still available at the cost above.
- ⚠️ **A handler returning `{ok: true, reason: …}` has its `reason` stripped and keeps `ok: true`,
  with a warn-once.** STATE.md's deferred row says the normalizer "must reject" this. That is
  deliberately softened, and the reason is the phase goal itself: by the time the dispatcher sees a
  return value **the handler has already run and its effect has already landed.** Converting to
  `invalid_result` would report "it didn't work" about an action that may well have worked — a
  dishonest result, which is the one thing this phase exists to prevent. The developer still learns
  their handler is malformed, through the warn.
- ⚠️ **A handler returning `{ok: false}` with no `reason` passes through unchanged, with a
  warn-once.** Same softening, opposite direction. The `ReasonCode` union is closed at twelve and
  has no "unspecified" member, so the dispatcher cannot supply one without inventing a claim. Phase
  4's own stub omits `reason` precisely because every available code would have been a lie
  (`concierge.ts:104-117`). A failure that says only *that* it failed is honest; a failure carrying
  a fabricated cause is not.
- **A handler return that is not a result at all** — `undefined`, a string, a promise resolving to a
  number, anything from a JavaScript consumer — is `invalid_result` (DSP-09). That is the case the
  code exists for, and it is distinct from the two above: nothing here can be salvaged.
- **The SEC-06 sanitizer extends `bridge.ts`'s `boundedMessage` rather than duplicating it.**
  Extract it to a shared internal module both `bridge.ts` and the dispatcher import, then add C0/C1
  stripping (U+0000–U+001F, U+007F–U+009F) and whitespace collapse. Two things must not regress:
  its **surrogate-pair-safe cut** (`charCodeAt(MESSAGE_MAX_CHARS - 1)` in `0xD800..0xDBFF` → cut one
  earlier), and the fact that it **shares `MESSAGE_MAX_CHARS`** rather than re-spelling `180`.
  Note the line `boundedMessage`'s doc draws: bounding removes no character the consumer wrote;
  sanitizing does. Phase 6 is where that second half finally happens, so the doc comment moves too.
- **Every message leaving the dispatcher is sanitized**, including `USER_CANCELLED` /
  `USER_DECLINED` and the handler's own. One boundary, no exceptions — an exception list is how a
  sanitizer stops being one.

### Dedup (DSP-01, DSP-02)

- **`dispatch` is not `async`.** An async wrapper allocates a fresh Promise per invocation and
  breaks dedup by identity, which is the mechanism criterion 1 tests. It returns a Promise; it is
  not declared `async`.
- **Key: `callId` when present, else `name` + `JSON.stringify(args)`.** When `JSON.stringify`
  throws — a cycle, a `BigInt` — the call **degrades to a no-dedup path** and runs normally
  (DSP-02). It never throws out of key derivation.
- **Storage is a `Map<string, Promise<ActionResult>>`, `let`-declared inside the `createConcierge`
  closure and `??=`-allocated on first dispatch.** A `Map` is correct *here* — this structure is
  mutable and is not part of the catalog, which is exactly the distinction `catalog.ts:252-288`
  draws. Module scope is forbidden: a module-scoped instance bleeds across requests and tenants in
  production while looking fine in development.
- ⚠️ **Eviction is by timestamp checked on access, not by timer.** Each entry stores its creation
  time; a lookup older than `dedupeWindowMs` is treated as absent and replaced. **This removes the
  scheduler dependency from dedup entirely**, leaving the commit window as its only consumer —
  which matters because the scheduler seam is the least settled thing in this phase. It also means
  no timer leaks a reference to a settled Promise.
- **Failures are cached like successes.** DSP-01 is a claim about Promise *identity* for a retried
  call inside the window; the outcome is irrelevant to it. Caching only successes would let a
  retried failing call re-run its handler, which is the double-fire the requirement forbids.

### Batch, commit window, handler lookup (DSP-07, DSP-08, TRN-04, SEC-03)

- **A batch runs serially in `outputIndex` order**, and **every call in an aborted batch still
  produces a result** — `aborted` — so the agent is never left waiting on a response that will not
  come.
- **`batch_aborted` stays collapsed into `aborted`.** `types.ts:159-171` sanctions splitting it only
  if Phase 6 *finds* it needs the distinction. It does not.
- **The commit window elapses *before* the handler runs**, not after. DSP-08 requires that the
  effect not *land* until the window has passed; running the handler first and then delaying the
  result means the effect already landed and the window guarded nothing. An abort inside the window
  cancels the call and returns `aborted` without ever invoking the handler.
- **Read-only actions bypass the window entirely** — gated on `effects.readOnly === true`, so an
  action that omits `effects` is treated as non-read-only and waits. Fail-safe direction.
- **Handler lookup reads `catalog.byName`** — the ROADMAP requires this phase's plan to state which
  of the two lookups it uses, and this is the answer. It is already a **frozen
  `Object.create(null)`** record, so it satisfies SEC-03 *and* the `dispatch("__proto__")` /
  `dispatch("constructor")` cases in one structure. **It must not be converted to a `Map`** — a
  frozen `Map` still accepts `.set()`.
- **Stage scoping comes from `namesByStage`, not from `byName`.** `createConcierge` builds one flat
  catalog across all stages plus `crossStage`, so `byName` is global. An action present in the
  catalog but absent from the *current* stage must return `unknown_action`, and only the per-stage
  projection can tell the difference.
- **Bridge resolution calls the existing module-private `resolveBridge`.** Its doc names the
  dispatcher as its **second and final** caller and says there must never be a third, because a
  second resolution path is not a duplicate function but a second answer to "is this bridge
  mounted". Do not add one.
- **Core still never auto-fails on a null bridge** (Phase 5 decision 3.1, DX-02). The dispatcher
  passes `bridge: null` and the handler decides — `no_bridge` is a code the *handler* returns via
  `offPageResult`, not one the dispatcher synthesizes.
- **One handler-context shape for gated and non-gated actions alike** — `{ args, bridge, meta, ack }`
  with `ack` explicitly `undefined` when absent. `types.ts:405-411` states the alternatives are two
  divergent context shapes or a cast, "on the consent path, which is the one place in this library a
  cast must never be the path of least resistance."

### The `Scheduler` seam — closes two Phase 1 deferrals

- **`scheduler` stays optional, and an omitted one falls back to a structural `setTimeout` read in
  `host.ts`.** That file already reserves this exact landing site and warns the deferral "should not
  quietly acquire a second unnamed instance." The fallback obeys `host.ts`'s three conventions:
  a module-private minimal view type, the cast **inside a function body** and never at module scope,
  and the capability optional at the type level.
- **When neither a scheduler nor a host timer exists, the commit window is skipped — effects land
  immediately — and that is warned once, not silent.** A library that quietly drops a safety window
  is worse than one that says it is dropping it. Dedup is unaffected, per decision 2.4.
- **The `Scheduler` signature is kept as `(fn: () => void, delayMs: number) => () => void`.** There
  is no measured need to refine it. The returned canceller is load-bearing — a scheduler returning
  `void` cannot express cancellation — and returning a plain function rather than a platform handle
  keeps core free of a timer-id type whose spelling differs between DOM (`number`) and Node
  (`Timeout`).
- **`Scheduler`'s shape is now pinned in `test-d/`.** Phase 1 declined this pin only because the
  signature was expected to move and a pin would have fired on a sanctioned edit
  (`01-09-SUMMARY.md:187-197`). Settling the signature here makes the pin free rather than
  pre-emptive, which is the condition that deferral named. Closes STATE.md deferred row 1.

### SEC-02 — recorded as structural, not implemented

- **There is no telemetry seam in the codebase.** `telemetry` / `onError` / `onTelemetry` appear only
  in doc prose. SEC-02 ("telemetry never carries thrown error messages, only error class names") is
  therefore satisfied **structurally — nothing is emitted at all** — and Phase 6 does not invent a
  channel to constrain. Inventing one would be scope creep, and Phase 7's transport is its natural
  home. **Record this in REQUIREMENTS.md as satisfied-structurally with the reason**, rather than
  claiming a channel is being constrained. The adjacent shapes to model it on when it does arrive
  are `RedactionPolicy` and `BuildCatalogOptions.onDiagnostic`.

### the agent's Discretion

- Internal module layout (`src/dispatch.ts` vs a split), all internal names, and the division of
  tests across files.
- The exact wording of every new warn message, subject to the house shape
  `concierge: [code] subject "x": problem Fix: fix` and the DX-03 standard (say what is wrong *and*
  what to do).
- Whether the shared sanitizer module is exported or internal — export only if a runtime test
  cannot otherwise reach it, given the "fewer exports" rule and that runtime suites read
  `dist/index.js`.

### Deferred Ideas (OUT OF SCOPE)

- **A telemetry seam** → Phase 7, alongside the transport. SEC-02 is recorded as structurally
  satisfied here, with the reason, rather than claimed against a channel that does not exist.
- **The consent gate** (arming, drift detection, `consent_required` / `consent_stale` emission) →
  Phase 8. Phase 6 builds only the context shape that carries `ack`.
- **The WR-06 reversal window** stays open through Phase 8. If the user declines to ratify the flat
  shape, the discriminated union costs six errors and five test edits and is still free before
  publish.
- **`ConciergeConfig.normalizeSnapshot` is read by nothing in `src/`** (Phase 5 review IN-01). The
  path Phase 5 shipped is `captureSnapshot(bridge, id, normalize?)`. Wiring the config member is
  Phase 8's, where consent snapshots are actually captured.
- **Splitting `batch_aborted` out of `aborted`** — sanctioned only if a later phase finds it needs
  the distinction.
- **`ServerSafeConcierge`** and freezing the `createConcierge` return → Phase 9.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DSP-01 | Same `callId` inside the dedup window returns the same Promise object. | Non-`async` outer dispatch, synchronously stored final Promise, lazy per-instance cache, timestamped access eviction. [VERIFIED: codebase grep] |
| DSP-02 | Missing `callId` uses name+arguments; unserializable data runs without dedup. | Guard key derivation, preserve normal execution after `JSON.stringify` throws, and namespace the two key forms. [CITED: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify] |
| DSP-03 | Thrown handlers return a generic sentence and leak no exception details. | Isolated no-binding handler catch, authored `handler_error` result, sanitizer, no telemetry invention. [VERIFIED: codebase grep] |
| DSP-04 | Missing handler returns honestly instead of throwing. | Guard both catalog miss and non-callable runtime handler before invocation. [VERIFIED: codebase grep] |
| DSP-05 | Revalidate arguments before handler execution. | Await Standard Schema validation and pass the validator's output `value`, not the original input. [CITED: https://standardschema.dev/schema] |
| DSP-06 | Malformed JSON becomes `{}` and is then validated. | Batch parse boundary plus ordinary dispatch validation path. [VERIFIED: codebase grep] |
| DSP-07 | Execute batch serially by `outputIndex`; aborted batches settle every call. | Stable ordered copy, `for...of`/`await`, and synthesized `aborted` results for remaining calls. [VERIFIED: codebase grep] |
| DSP-08 | Commit window precedes non-read-only handlers; abort cancels. | Injectable scheduler/host fallback, abort listener cleanup, explicit read-only bypass. [VERIFIED: codebase grep] |
| DSP-09 | Invalid handler returns become honest failures. | Runtime normalizer that reads only `ok`, `reason`, and `message` under a guarded boundary. [VERIFIED: codebase grep] |
| SEC-02 | Telemetry never carries thrown messages. | Record structural satisfaction because the repository has no telemetry output seam; add none in Phase 6. [VERIFIED: codebase grep] |
| SEC-06 | Sanitize every dispatcher message. | Shared control-strip/whitespace-collapse/surrogate-safe bound helper at the final result boundary. [VERIFIED: codebase grep] |
| TRN-04 | Dispatch works without a transport. | Keep single-call dispatch usable directly and make batch orchestration independent of `Transport`. [VERIFIED: codebase grep] |
</phase_requirements>

## Summary

Phase 6 should remain an internal, dependency-free orchestration layer around the immutable catalog already built by `createConcierge`. The implementation sequence is: stage-scope lookup, guarded key derivation/dedup, schema validation, optional commit delay, bridge resolution, handler invocation, result normalization, and one final message-sanitization boundary. The existing `catalog.byName`, `namesByStage`, `resolveBridge`, `ActionHandler` context, `Scheduler`, and `MESSAGE_MAX_CHARS` are the correct primitives; no package or framework is needed. [VERIFIED: codebase grep]

Two public-shape gaps must be settled before the planner writes implementation tasks. First, `Concierge.dispatch(name, args, meta?)` has no `StageContext`, yet the locked decision requires current-stage enforcement via `namesByStage`; `Concierge` is explicitly stateless and Phase 7's `Session` is designated to own current context. Second, Phase 6 must parse and execute `ToolBatch`, but `Concierge` exposes no batch operation or result envelope. Hidden “last context” state and tests that manually loop over `dispatch` would not implement those requirements. [VERIFIED: codebase grep]

The dedup design also needs three precision fixes in planning: the stated `Map<string, Promise<ActionResult>>` cannot itself hold timestamps, access-only eviction of only the looked-up key leaks unique keys, and the documented defaults (`commitWindowMs = 600`, `dedupeWindowMs = 500`) allow a retry to expire before the first effect can run. Resolve these as explicit decisions, not incidental code choices. [VERIFIED: codebase grep]

**Primary recommendation:** Add one explicit context-aware dispatch seam and one transport-independent batch seam before implementation; then build the dispatcher as a non-`async` Promise-returning closure whose final Promise is cached synchronously and whose every exit is normalized and sanitized. [VERIFIED: codebase grep]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Single-call orchestration | API / Backend (core library) | Browser / Client host | Core owns validation, ordering, error/result semantics; the handler may actuate browser state. [VERIFIED: codebase grep] |
| Current-stage authorization | API / Backend (core library) | Browser / Client context producer | Core must enforce the stage projection, while application/session code supplies pathname/search/hash context. [VERIFIED: codebase grep] |
| Batch parsing and sequencing | API / Backend (core library) | Transport (future Phase 7) | `ToolBatch` is already transport-neutral; Phase 7 should only route batches and responses. [VERIFIED: codebase grep] |
| Commit timing and cancellation | API / Backend (core library) | Runtime host | Core decides when a handler may run; injected or structural host timing supplies the clock. [VERIFIED: codebase grep] |
| Live bridge access | Browser / Client | API / Backend (core resolver) | Mounted application code owns the bridge; core resolves it exactly once and passes `null` honestly when absent. [VERIFIED: codebase grep] |
| Result normalization/sanitization | API / Backend (core boundary) | Agent/transport consumer | Core is the last trusted boundary before a result reaches an agent-facing consumer. [VERIFIED: codebase grep] |
| Telemetry | Deferred Phase 7 | — | No telemetry channel exists and CONTEXT forbids adding one in Phase 6. [VERIFIED: codebase grep] |

## Standard Stack

### Core

| Library / Runtime | Version | Published / observed | Purpose | Why Standard Here |
|-------------------|---------|----------------------|---------|-------------------|
| TypeScript | 7.0.2 | Repository pin; current registry version on 2026-08-05 | Strict source and declaration checking | Already configured with `isolatedDeclarations`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and ES2022-only core libs. [VERIFIED: npm registry] |
| `@standard-schema/spec` | 1.1.0 | 2025-12-15 | Schema interoperability contract | Existing runtime package dependency; its validator contract supports sync or async results and transformed output values. [VERIFIED: npm registry] [CITED: https://standardschema.dev/schema] |
| Native Promise / Map / JSON / AbortSignal-like structures | ES2022 | Node 24.14.1 observed locally | Dispatch pipeline, cache, parsing, cancellation | All required mechanics exist in the configured runtime; another orchestration dependency would violate the core constraint. [VERIFIED: codebase grep] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| Vitest | 4.1.10 | Runtime behavior and mutation-sensitive assertions | Exercise the built `dist/index.js`; use local scheduler probes rather than global fake timers. [VERIFIED: npm registry] [VERIFIED: codebase grep] |
| tsdown | 0.22.14 | ESM library build and declarations | Rebuild before runtime tests because suites import `dist/index.js`. [VERIFIED: npm registry] [VERIFIED: codebase grep] |
| pnpm | 11.17.0 | Workspace commands | Use existing root scripts for full gates. [VERIFIED: codebase grep] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing Standard Schema contract | Schema-library-specific adapters | Rejected: adds dependencies and breaks the existing schema-agnostic action surface. [VERIFIED: codebase grep] |
| Injected/structural scheduler | Global fake timers in implementation | Rejected: core cannot type-see DOM/Node timer globals and global test state conflicts with the local seam convention. [VERIFIED: codebase grep] |
| Factory-closure cache | Module-level cache | Rejected: would share dedup state across Concierge instances. [VERIFIED: codebase grep] |
| Serial loop | `Promise.all` | Rejected: violates output ordering, short-circuit/abort behavior, and the one-effect-at-a-time criterion. [VERIFIED: codebase grep] |

**Installation:** No new packages. [VERIFIED: codebase grep]

```bash
pnpm install --frozen-lockfile
```

The command above restores the already-locked workspace only; Phase 6 should not add dependencies. [VERIFIED: codebase grep]

## Package Legitimacy Audit

No external package installation is recommended, so the legitimacy gate is not applicable to this phase. Existing package identities and versions were taken from repository manifests and confirmed against their ecosystem registry. [VERIFIED: npm registry]

## Planner-Critical API Seams

These two seams are prerequisites, not implementation details. The planner should resolve them in the first plan task and pin the selected public shape in `test-d/` before building dispatcher behavior. [VERIFIED: codebase grep]

### Seam 1: Stage Context Must Reach Dispatch

The current public member is `dispatch(name, args, meta?)`; it receives no `StageContext`. The locked design nevertheless requires wrong-stage names to return `unknown_action` by comparing against `namesByStage`, and the existing `Concierge` contract says `Session` owns current context rather than Concierge retaining it. Those facts cannot all be implemented through the current signature. [VERIFIED: codebase grep]

**Recommended resolution:** make context explicit at the dispatch boundary, preferably `dispatch(ctx, name, args, meta?)`, while the package is unpublished. Phase 7 can pass its Session context and TRN-04 applications can pass their own context directly. Do not store “the last context passed to `catalogFor`”, and do not hide application routing state inside `InvocationMeta`; either approach creates stale cross-call state in an object documented as stateless. [VERIFIED: codebase grep]

**Required pin:** a `test-d/dispatcher.test-d.ts` predicate must assert the settled signature, and runtime tests must prove that an action present globally but absent from the supplied stage never reaches its handler. [VERIFIED: codebase grep]

### Seam 2: ToolBatch Needs a Transport-Independent Entry Point

`ToolBatch` exists, but `Concierge` has no batch method and Phase 7's `Session` is not implemented. Tests that sort and loop over `dispatch` themselves would test the test harness rather than a Phase 6 batch implementation. [VERIFIED: codebase grep]

**Recommended resolution:** add a Concierge-owned context-aware batch member, conceptually `dispatchBatch(ctx, batch)`, returning one immutable `{callId, result}` item for every input call. Keeping `callId` in the result envelope lets Phase 7 call `Transport.respond(callId, result)` without relying on array position, while adding no new runtime export. [VERIFIED: codebase grep]

**Required pin:** type-test the selected batch input/output signature and runtime-test parsing, metadata forwarding, stable `outputIndex` ordering, serial handler entry, and one result per call after abort. [VERIFIED: codebase grep]

## Architecture Patterns

### System Architecture Diagram

```text
direct app loop / Phase 7 Session
            |
            v
  explicit StageContext + call or ToolBatch
            |
            v
  stage scope ---- name absent ----> sanitized unknown_action
            |
            v
  dedup key ---- live hit ----------> exact cached Promise reference
            |
            v
  Standard Schema validation ------> sanitized invalid_args
            |
            v
  readOnly? -- no --> commit window -- abort --> sanitized aborted
            |                    |
            +--------- yes ------+
                                 v
                    resolveBridge (null is allowed)
                                 |
                                 v
                    handler error boundary --------> sanitized handler_error
                                 |
                                 v
                    result normalizer -------------> sanitized invalid_result
                                 |
                                 v
                    immutable honest ActionResult
```

The diagram reflects the existing core boundaries and the locked order: validation and the commit window occur before handler invocation, while normalization and sanitization occur after every branch. [VERIFIED: codebase grep]

### Recommended Project Structure

```text
packages/concierge/
├── src/
│   ├── concierge.ts          # catalog/stage/bridge closure and public orchestration
│   ├── dispatch.ts           # internal key, validation, delay, and result helpers
│   ├── message.ts            # shared sanitize + surrogate-safe bound
│   ├── host.ts               # structural host timer fallback beside warnHost
│   └── types.ts              # settled dispatch/batch signatures only
├── test/
│   ├── dispatcher.test.ts    # single-call boundary behavior
│   └── dispatcher-batch.test.ts # parse/order/abort/metadata behavior
└── test-d/
    └── dispatcher.test-d.ts  # Scheduler and selected API seam pins
```

This split is a recommendation under the agent's discretion: `concierge.ts` must still own access to `catalog.byName`, `namesByStage`, and the existing module-private `resolveBridge`; helper extraction must not create a second bridge resolver or export a new runtime value. [VERIFIED: codebase grep]

### Pattern 1: Cache the Final Promise Synchronously

`dispatch` must be a normal function. It derives the key, checks the per-instance cache, creates the complete pipeline Promise, stores that exact object, and returns it without an `async` wrapper. An `async` function called with an existing Promise returns a distinct Promise object; a local probe produced `p === asyncWrapper(p) // false`. [CITED: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function] [VERIFIED: local runtime probe]

```ts
// Source: MDN async function semantics + verified repository contract
function dispatch(/* settled context-aware parameters */): Promise<ActionResult> {
  const key = deriveKeyWithoutThrowing();
  const hit = key === null ? undefined : readUnexpiredEntry(key);
  if (hit !== undefined) return hit.promise;

  const promise = runDispatchPipeline();
  if (key !== null) writeEntry(key, promise);
  return promise;
}
```

The timestamp requirement needs either a timestamped entry object or a separate timestamp store; the locked phrase `Map<string, Promise<ActionResult>>` cannot itself make “each entry stores its creation time” true. The planner must choose one spelling explicitly rather than leave incompatible types to the executor. [VERIFIED: codebase grep]

### Pattern 2: Treat Validation Output as Handler Input

Standard Schema validators may return a validation result directly or through a Promise, and a successful result contains the validated/transformed `value`. Await the result and pass `value` as `ctx.args`; do not validate and then pass the original input. [CITED: https://standardschema.dev/schema]

```ts
// Source: https://standardschema.dev/schema
const validated = await entry.action.schema["~standard"].validate(args);
if (validated.issues !== undefined) return invalidArgsResult();
const handlerArgs = validated.value;
```

### Pattern 3: One Final Sanitization Boundary

Replace C0/C1 controls with spaces, collapse whitespace, trim, and then apply the existing surrogate-safe `MESSAGE_MAX_CHARS` cutoff. Build a fresh result from `ok`, optional `reason`, and sanitized `message`; never spread an untrusted handler return because extra enumerable fields could cross the agent boundary. [VERIFIED: codebase grep]

### Pattern 4: Serial Batch Loop

Copy and stably order calls by `outputIndex`, parse each `arguments` string with a `{}` fallback, assemble `InvocationMeta` without casts, and `await` each dispatch before starting the next. If the batch signal is aborted, synthesize `aborted` results for every remaining call rather than breaking the loop. [VERIFIED: codebase grep]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Argument validation | Per-action property checks | Existing Standard Schema validator | Supports the declared schema ecosystem and transformed values. [CITED: https://standardschema.dev/schema] |
| Stage registry | A second mutable name registry | Existing frozen null-prototype `catalog.byName` plus `namesByStage` | Preserves SEC-03 and handles `__proto__`/`constructor` safely. [VERIFIED: codebase grep] |
| Bridge lookup | Another registry read helper | Existing module-private `resolveBridge` | One answer to whether the stage bridge is mounted. [VERIFIED: codebase grep] |
| Timer platform types | DOM/Node timer imports | Existing `Scheduler` plus structural `globalThis` fallback in `host.ts` | Keeps core ES2022-only and SSR-safe. [VERIFIED: codebase grep] |
| Message length logic | A second numeric cutoff | Shared helper using `MESSAGE_MAX_CHARS` | Retains the existing surrogate-pair-safe boundary. [VERIFIED: codebase grep] |

## Common Pitfalls

### Promise Identity Lost by `async`

**What goes wrong:** retries get equal results through different Promise objects and can enter duplicate pipelines. **How to avoid:** keep the outer dispatch synchronous and store its final Promise before returning. **Warning sign:** `p1 === p2` is false. [CITED: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function]

### Wrong-Stage Actions Leak Through the Global Catalog

**What goes wrong:** `catalog.byName` finds an action from another stage and invokes it. **How to avoid:** require explicit stage context and check `namesByStage` before the global entry lookup. **Warning sign:** an off-stage handler counter increments. [VERIFIED: codebase grep]

### Parse Errors Bypass Validation

**What goes wrong:** malformed batch JSON rejects the loop or `{}` reaches the handler. **How to avoid:** catch only parsing, substitute `{}`, then run the identical validation path used by direct calls. **Warning sign:** later calls in the batch never settle. [VERIFIED: codebase grep]

### Commit and Dedup Windows Cross

**What goes wrong:** the documented 500 ms dedup default expires before the documented 600 ms commit delay, allowing a retry to create a second pending effect. **How to avoid:** the planner must explicitly reconcile the defaults or protect in-flight entries from expiry; do not let the executor choose silently. **Warning sign:** two scheduler callbacks exist for one `callId`. [VERIFIED: codebase grep]

### Cancellation Listener Races or Leaks

**What goes wrong:** abort between the initial check and listener registration still runs the handler, or settled calls retain listeners. **How to avoid:** register, re-check `signal.aborted`, make cleanup idempotent, call the scheduler canceller once, and test a synchronously firing scheduler. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal]

### Broad Catch Mislabels Failures

**What goes wrong:** validation, timer, or normalizer failures are reported as handler crashes. **How to avoid:** use separate guarded boundaries for key derivation, validation, waiting, handler invocation, and result inspection. **Warning sign:** changing a validator throw changes the handler-error test rather than invalid-args behavior. [VERIFIED: codebase grep]

## Open Questions

1. **What exact public signature carries `StageContext`?**
   - What we know: current `dispatch` lacks context; stage enforcement requires it; Concierge is documented stateless. [VERIFIED: codebase grep]
   - Recommendation: ratify context-first `dispatch(ctx, name, args, meta?)` before implementation and pin it in `test-d/`. [ASSUMED]

2. **What exact batch member and result envelope ship?**
   - What we know: Phase 6 owns batch execution, `ToolBatch` exists, and no callable batch seam exists. [VERIFIED: codebase grep]
   - Recommendation: ratify `dispatchBatch(ctx, batch)` returning immutable `{callId, result}` rows, without a new runtime export. [ASSUMED]

3. **How are timestamps represented and the 500/600 ms default overlap resolved?**
   - What we know: the locked cache type and timestamp wording conflict, and current documented defaults permit dedup expiry before the commit callback. [VERIFIED: codebase grep]
   - Recommendation: use timestamped entries and retain in-flight entries until settlement, subject to explicit CONTEXT amendment. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | build/tests/runtime probes | ✓ | 24.14.1 | Project floor is encoded by `check:node-floor`. [VERIFIED: local command] |
| pnpm | workspace gates | ✓ | 11.17.0 | — [VERIFIED: local command] |
| TypeScript | type tests | ✓ | 7.0.2 | — [VERIFIED: codebase grep] |
| Vitest | runtime tests | ✓ | 4.1.10 | — [VERIFIED: codebase grep] |
| Host timer | uninjected commit window | ✓ in local Node | structural fallback; version not applicable | Inject `Scheduler`; if both absent, locked behavior is warn once and skip. [VERIFIED: local command] |

**Missing dependencies with no fallback:** None. [VERIFIED: local command]

**Missing dependencies with fallback:** `ctx7` was unavailable, so official Standard Schema and MDN documentation were used directly. [VERIFIED: local command]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 for runtime; TypeScript 7.0.2 for `test-d` [VERIFIED: codebase grep] |
| Config file | `vitest.config.ts`; `packages/concierge/tsconfig.test-d.json` [VERIFIED: codebase grep] |
| Runtime import boundary | Tests import `packages/concierge/dist/index.js`, so build first. [VERIFIED: codebase grep] |
| Quick single-call command | `pnpm build && pnpm exec vitest run packages/concierge/test/dispatcher.test.ts` [VERIFIED: codebase grep] |
| Quick batch command | `pnpm build && pnpm exec vitest run packages/concierge/test/dispatcher-batch.test.ts` [VERIFIED: codebase grep] |
| Type command | `pnpm --filter @fullselfbrowsing/concierge typecheck` [VERIFIED: codebase grep] |
| Full suite command | `pnpm build && pnpm typecheck && pnpm test` [VERIFIED: codebase grep] |

Do not use `pnpm test -- <name>` as a file filter; the repository records that it does not filter. Do not introduce Vitest mocking APIs: use injected schedulers and plain console capture restored in `finally`. [VERIFIED: codebase grep]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DSP-01 | Same `callId` returns same Promise reference; handler once; failures cached | unit/runtime | `pnpm build && pnpm exec vitest run packages/concierge/test/dispatcher.test.ts` | ❌ Wave 0 |
| DSP-02 | Fallback key dedups; cycle and BigInt run without dedup or throw | unit/runtime | same single-call command | ❌ Wave 0 |
| DSP-03 | Sync throw and rejected Promise return only generic message; caught text absent | security/runtime | same single-call command | ❌ Wave 0 |
| DSP-04 | Missing and runtime-noncallable handlers settle honestly | unit/runtime | same single-call command | ❌ Wave 0 |
| DSP-05 | Sync/async validation, rejection, throw, and transformed `value` before handler | unit/runtime | same single-call command | ❌ Wave 0 |
| DSP-06 | Malformed raw arguments become `{}`, fail validation, later calls still run | integration/runtime | quick batch command | ❌ Wave 0 |
| DSP-07 | Stable `outputIndex` order, no overlap, abort yields one result per call | integration/runtime | quick batch command | ❌ Wave 0 |
| DSP-08 | Non-read-only waits; read-only bypasses; abort cancels callback and handler | unit/runtime | same single-call command | ❌ Wave 0 |
| DSP-09 | Invalid values/getters/proxies become `invalid_result`; two locked contradictions normalize as decided | security/runtime | same single-call command | ❌ Wave 0 |
| SEC-02 | No telemetry seam/output; thrown message appears nowhere in returned result or console | structure + runtime | `rg -n "telemetry|onTelemetry|onError" packages/concierge/src && pnpm build && pnpm exec vitest run packages/concierge/test/dispatcher.test.ts` | ❌ Wave 0 |
| SEC-06 | C0/C1 stripped, whitespace collapsed, bound shared, high surrogate not split, constants pass boundary | security/runtime | same single-call command | ❌ Wave 0 |
| TRN-04 | Single and batch calls run without constructing a Transport | integration/runtime | both quick commands | ❌ Wave 0 |
| BRG-03 hand-forward | Mounted bridge passes live object; absent/throwing registry passes null to handler | integration/runtime | same single-call command plus existing bridge suites | ❌ Wave 0 join |

### Red/Green and Mutation Detectors

| Mutant / Regression | Required detector |
|---------------------|-------------------|
| Add `async` to outer `dispatch` | `p1 === p2` goes false while result equality may remain green. [VERIFIED: local runtime probe] |
| Cache only after awaiting / cache only successes | concurrent duplicate handler counter or repeated failing call counter becomes 2. [ASSUMED] |
| Remove `callId` key / fallback / serialization catch | identity case, no-callId case, cycle/BigInt case respectively go red. [CITED: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify] |
| Look up only `catalog.byName` | wrong-stage action invokes its handler; `__proto__` and `constructor` remain separate pins. [VERIFIED: codebase grep] |
| Skip validation or pass original args | malformed input reaches handler or transform/default assertion receives pre-transform value. [CITED: https://standardschema.dev/schema] |
| Move window after handler / treat omitted effects as read-only | handler counter increments before scheduler fire. [VERIFIED: codebase grep] |
| Drop abort listener/canceller/re-check | abort-during-window handler counter increments or canceller count stays zero. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal] |
| Replace serial loop with `Promise.all` / skip sort | overlap detector exceeds 1 or entry order differs from `outputIndex`. [ASSUMED] |
| Break after batch abort | result count is less than call count. [VERIFIED: codebase grep] |
| Spread/pass handler result | extra sentinel field reaches consumer or throwing getter rejects the dispatcher Promise. [ASSUMED] |
| Remove control strip/collapse/bound/surrogate guard | dedicated SEC-06 assertion fails for each independent string fixture. [VERIFIED: codebase grep] |
| Reuse Phase 4 stub or retain S27 | real handler never runs or stale exact-stub assertion conflicts; delete S27 wholesale as directed. [VERIFIED: codebase grep] |

Run concrete source mutations through `scripts/mutate-and-prove.sh`; record the unfiltered literal occurrence count, confirm the mutant compiled and tests actually ran, and rebuild afterward because the harness restores `src/` but not `dist/`. [VERIFIED: codebase grep]

### Sampling Rate

- **Per task commit:** build plus the affected dispatcher file and `pnpm --filter @fullselfbrowsing/concierge typecheck`. [VERIFIED: codebase grep]
- **Per wave merge:** `pnpm build && pnpm typecheck && pnpm test`. [VERIFIED: codebase grep]
- **Phase gate:** full suite plus `pnpm check:artifact && pnpm check:deps && pnpm check:pack && pnpm check:node-floor`. [VERIFIED: codebase grep]
- **Mutation gate:** every registered Phase 6 mutant must be killed for the intended assertion, not by a build error or unrelated failure. [VERIFIED: codebase grep]

### Wave 0 Gaps

- [ ] `packages/concierge/test/dispatcher.test.ts` — single-call, dedup, validation, timing, normalization, sanitizer, direct-loop, and BRG-03 join. [ASSUMED]
- [ ] `packages/concierge/test/dispatcher-batch.test.ts` — batch parse, stable order, seriality, metadata forwarding, abort completeness. [ASSUMED]
- [ ] `packages/concierge/test-d/dispatcher.test-d.ts` — settled context/batch API plus exact `Scheduler` signature. [ASSUMED]
- [ ] Delete, rather than repurpose, `packages/concierge/test/concierge.test.ts` S27 when the stub is removed. [VERIFIED: codebase grep]
- [ ] Create `06-VALIDATION.md` during the validation plan to record red/green and mutation evidence. [VERIFIED: codebase grep]

### Manual / Human Verification

One pre-implementation decision checkpoint is required: ratify the two API signatures and the dedup timestamp/default-overlap resolution. After those decisions are locked, all Phase 6 behavior is automatable; no manual UI, transport, network, or external-service verification is required. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No identity/authentication feature in Phase 6. [VERIFIED: codebase grep] |
| V3 Session Management | no | Session lifecycle is Phase 7. [VERIFIED: codebase grep] |
| V4 Access Control | yes | Explicit stage context, `namesByStage`, frozen null-prototype registry. [VERIFIED: codebase grep] |
| V5 Input Validation | yes | Standard Schema revalidation, guarded JSON parsing, runtime result validation. [CITED: https://standardschema.dev/schema] |
| V6 Cryptography | no | No cryptographic operation in Phase 6. [VERIFIED: codebase grep] |

### Known Threat Patterns for the Dispatcher

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Replay/double actuation | Tampering | Exact-Promise dedup, failures cached, serial batch execution. [VERIFIED: codebase grep] |
| Wrong-stage action invocation | Elevation of privilege | Explicit context and `namesByStage` scope check before global lookup. [VERIFIED: codebase grep] |
| Exception/PII disclosure | Information disclosure | No-binding handler catch, generic authored sentence, no Phase 6 telemetry channel. [VERIFIED: codebase grep] |
| Control-character/model-channel injection | Spoofing / Information disclosure | Sanitize every outbound message at one boundary. [VERIFIED: codebase grep] |
| Abort race | Tampering / Repudiation | Pre-handler commit window, signal re-check, canceller and listener cleanup. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal] |
| Prototype-key lookup | Tampering | Existing frozen null-prototype `byName` record. [VERIFIED: codebase grep] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Context-first `dispatch` is the preferred API resolution. | Planner-Critical API Seams | Public type tests and Phase 7 call sites would need a different signature. |
| A2 | `dispatchBatch` should return immutable `{callId, result}` rows. | Planner-Critical API Seams | Phase 7 may require a different response-correlation contract. |
| A3 | Timestamped entries retained while in flight are the preferred cache reconciliation. | Open Questions | Could contradict a stricter reading of access-time expiry. |
| A4 | The proposed three new test files are the clearest division. | Validation Architecture | Tests may be combined without changing coverage. |

## Sources

### Primary (HIGH confidence)

- `packages/concierge/src/{concierge,types,catalog,bridge,host}.ts` and current tests/config — dispatcher seams, immutable registry, bridge resolver, timer constraint, and house test conventions. [VERIFIED: codebase grep]
- `06-CONTEXT.md`, `REQUIREMENTS.md`, and `ROADMAP.md` — locked behavior and requirement ownership. [VERIFIED: codebase grep]
- [Standard Schema specification](https://standardschema.dev/schema) — sync/async validation result and validated output value. [CITED: https://standardschema.dev/schema]
- [MDN async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) — async return Promise identity behavior. [CITED: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function]
- [MDN JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) — serialization behavior and throwing cases. [CITED: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify]
- [MDN AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) — `aborted` state and abort-event contract. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal]

### Secondary (MEDIUM confidence)

- Local Node probes — `async` Promise identity, cyclic/BigInt stringify errors, and fallback-key collision. [VERIFIED: local runtime probe]

### Tertiary (LOW confidence)

- None; unresolved design recommendations are listed explicitly as `[ASSUMED]`. [VERIFIED: research audit]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — existing pins, registry verification, and official Standard Schema docs. [VERIFIED: npm registry]
- Architecture: MEDIUM-HIGH — implementation boundaries are verified, but two public API seams require ratification. [VERIFIED: codebase grep]
- Pitfalls: HIGH for Promise identity, schema output, JSON, abort, and repository-specific boundaries; MEDIUM for the recommended cache reconciliation. [CITED: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function] [ASSUMED]
- Validation: HIGH — existing test commands and conventions are verified; only the proposed file split is discretionary. [VERIFIED: codebase grep]

**Research date:** 2026-08-05
**Valid until:** 2026-09-04
