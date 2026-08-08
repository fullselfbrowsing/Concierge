# Phase 7: Session and the transport seam - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 22 new/modified files (plus one conditional traceability ledger)
**Closest analogs assigned:** 22 / 22
**Exact/self or prior-phase analogs:** 16
**Composite/partial analogs:** 6

## Scope Resolution

The concrete Phase 7 impact comes from `07-CONTEXT.md:60-64`, `07-RESEARCH.md:185-215,467-489`, and `07-VALIDATION.md:100-110`.

- Production: one new runtime module; public contract, barrel, and contract-prose amendments.
- Tests: one reusable test-only transport fixture; four new runtime suites; one new and three amended type suites.
- Publication gates: artifact, declaration-surface, single-instance, foreign-consumer, and tarball checks.
- Proof: a Phase 7 mutation battery, immutable register/evidence JSON, and measured updates to `07-VALIDATION.md`.
- `packages/concierge/package.json`, root `package.json`, and `pnpm-lock.yaml` are explicit **no-change** inputs. The package manifest already excludes `test/`; the phase must prove that fact from the packed tarball instead of widening `files`.

`.planning/REQUIREMENTS.md` is a conditional close-out edit, not part of the research file-impact table. Its Phase 7 rows are still pending at `REQUIREMENTS.md:192-197`; update them only after executable evidence exists and only if the execution workflow owns requirement-status close-out.

## File Classification

| New/Modified File | Role | Data Flow | Closest Existing Analog | Match Quality |
|---|---|---|---|---|
| **NEW** `packages/concierge/src/session.ts` | service + factory + provider | event-driven + batch + request-response | `src/bridge.ts`, `src/concierge.ts`, `src/dispatch.ts`, `src/host.ts` | composite / partial |
| **MOD** `packages/concierge/src/types.ts` | public model | request-response + event-driven + batch | its own `Transport`, `ToolBatch`, `Session`, `SessionConfig` blocks | exact self |
| **MOD** `packages/concierge/src/index.ts` | barrel + shipped documentation | transform | its own grouped type/value exports and package header | exact self |
| **MOD** `packages/concierge/src/contract.ts` | config/documentation | transform | its own guarded-entry-point inventory | exact self |
| **NEW** `packages/concierge/test/fixtures/stub-transport.ts` | test provider / fixture | event-driven + batch | `dispatcher-batch.test.ts:createAbortController`; `createBridge` frozen closure handle | partial |
| **NEW** `packages/concierge/test/session-catalog.test.ts` | runtime integration/security test | event-driven + request-response | `test/concierge.test.ts` STG-04 and duplicate-id cases | role/data-flow match |
| **NEW** `packages/concierge/test/session-routing.test.ts` | runtime concurrency/security test | event-driven + batch | `test/dispatcher-batch.test.ts` | exact harness/data-flow |
| **NEW** `packages/concierge/test/session-lifecycle.test.ts` | runtime lifecycle/security test | event-driven + batch | `test/bridge.test.ts`; `test/diagnostic-safety.test.ts` | role match |
| **NEW** `packages/concierge/test/stub-transport.test.ts` | fixture contract test | event-driven + batch | `test/bridge.test.ts` frozen capability and stale-unsubscriber cases | role match |
| **NEW** `packages/concierge/test-d/session.test-d.ts` | type test | compile-time transform | `test-d/dispatcher.test-d.ts`; `test-d/bridge.test-d.ts` | exact convention |
| **MOD** `packages/concierge/test-d/transport.test-d.ts` | type test | compile-time transform | itself | exact self |
| **MOD** `packages/concierge/test-d/actions.test-d.ts` | type test | compile-time transform | its D-08 Session fixture | exact self |
| **MOD** `packages/concierge/test-d/exports.test-d.ts` | type/export-placement test | compile-time transform | itself | exact self |
| **MOD** `packages/concierge/test/artifact.test.ts` | artifact test | file-I/O + request-response | its callable-value cases | exact self |
| **MOD** `packages/concierge/test/export-surface.test.ts` | artifact test | file-I/O + transform | its parsed declaration-surface gate | exact self |
| **MOD** `packages/concierge/test/single-instance.test.ts` | artifact/integration test | module-evaluation + request-response | F6 direct `createBridge` call-site case | exact self |
| **MOD** `packages/concierge/test/fixtures/probe.ts` | foreign-consumer fixture | compile-time + request-response | its shipped-value/type annotations | exact self |
| **MOD** `scripts/pack-install-check.sh` | package gate / utility | file-I/O + batch | its pack/install/typecheck/runtime-import flow | exact self |
| **NEW** `scripts/phase-07-mutation-battery.mjs` | mutation harness | file-I/O + batch | `scripts/phase-06-mutation-battery.mjs` | exact prior-phase harness |
| **NEW** `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-REGISTER.json` | immutable config | batch | Phase 6 mutation register | exact prior-phase artifact |
| **NEW** `.planning/phases/07-session-and-the-transport-seam/07-MUTATION-EVIDENCE.json` | evidence artifact | batch | Phase 6 mutation evidence | exact prior-phase artifact |
| **MOD** `.planning/phases/07-session-and-the-transport-seam/07-VALIDATION.md` | validation ledger | batch + transform | `06-VALIDATION.md` | exact prior-phase ledger |

## Pattern Assignments

### `packages/concierge/src/session.ts` (service/factory, event-driven + batch)

**Primary analog:** `packages/concierge/src/bridge.ts`. Copy its import order, direct single-instance call, closure-local mutable state, monotonic identity, guarded stale cleanup, and frozen public handle.

**Imports and direct guard** (`bridge.ts:97-100,201-203`):

```ts
import { assertSingleInstance } from "./contract.js";
import { encodeDiagnosticSubject, warnHost } from "./host.js";
import { boundedMessage } from "./message.js";
import type { ActionResult, Bridge, BridgeRegistry, SnapshotNormalizer } from "./types.js";

export function createBridge<B extends Bridge = Bridge>(id: string): BridgeRegistry<B> {
  assertSingleInstance();
```

Use runtime imports first, then `import type`, always with `.js` specifiers. `createSession` must likewise call `assertSingleInstance()` directly before subscribing, publishing, or invoking any other outside capability.

**Factory-local monotonic token and stale-unsubscriber guard** (`bridge.ts:221-270`):

```ts
let slot: { token: number; bridge: B } | null = null;
let next: number = 0;

const token: number = ++next;
slot = { token, bridge };

return (): void => {
  if (slot?.token === token) {
    slot = null;
  }
};
```

Generalize this to `Map<number, callback>` for stage listeners. Delete by token, never by callback identity; never reset the counter. Snapshot the map for one stage value and queue nested stage values behind a `notifying` guard.

**Frozen capability handle** (`bridge.ts:274-293`):

```ts
// Mutable closure state remains usable after the outward object is sealed.
return Object.freeze(registry);
```

Return `Object.freeze({ setContext, stage, onStageChange, stop })`. Keep every mutable queue, listener, epoch, context, lifecycle, and drain binding in the factory closure; module scope may hold immutable constants only.

**Catalog identity and existing transformations** (`concierge.ts:741-756,1074-1087`):

```ts
function projectFor(index: number | null): ReadonlyArray<EmittedTool> {
  memo ??= new Map<number | null, ReadonlyArray<EmittedTool>>();
  const hit = memo.get(index);
  if (hit !== undefined) return hit;
  const built: ReadonlyArray<EmittedTool> = Object.freeze(projected);
  memo.set(index, built);
  return built;
}

async function dispatchBatch(ctx: StageContext, batch: ToolBatch) {
  return executeDispatchBatch(ctx, batch, dispatch);
}
function catalogFor(ctx: StageContext) { return projectFor(resolveIndex(ctx)); }
function stageFor(ctx: StageContext) { /* exact string | null resolver */ }
```

Session consumes these methods; it does not reproduce matching, projection, call parsing, stable ordering, validation, results, or deduplication. Catalog reference identity (`nextCatalog !== currentCatalog`) is the epoch. Stage string equality is only the listener-notification test. The no-context catalog is a separate frozen empty array: `catalogFor({})` is wrong because `concierge.ts:727-737` deliberately includes cross-stage actions in a no-stage projection.

**Defensive structural cancellation** (`dispatch.ts:457-483,516-569`):

```ts
export function isAborted(signal: AbortSignalLike | undefined): boolean {
  if (signal === undefined) return false;
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}

try {
  signal.addEventListener("abort", onAbort);
  listenerAttached = true;
} catch {
  settle("aborted", false);
  return;
}
if (isAborted(signal)) settle("aborted", false);
```

Build a private structural cancellation scope, not a DOM `AbortController`. Link the optional transport signal once; `abort()` marks aborted before snapshotting/clearing listeners; `dispose()` removes the upstream listener once. An unreadable/malformed/throwing upstream signal fails closed and emits only a fixed diagnostic.

**Envelope and dispatcher ownership** (`dispatch.ts:1014-1057`):

```ts
const batchSnapshot = snapshotBatchMetadata(batch);
const ordered = orderToolCallSnapshots(snapshotToolCalls(batch));
for (const call of ordered) {
  // Existing dispatcher authors one row for every observed call.
  result = await dispatch(ctx, call.name, args, meta, argumentsMalformed);
  rows.push(batchRow(call.callId, result));
}
```

Session must instead make one shallow envelope per accepted occurrence, preserving the exact `responseId`, `userTurnId`, `calls`, and `deferUntilDelivered` values and replacing only `signal`. Call `concierge.dispatchBatch(capturedContext, envelope)` exactly once, then make one non-retried `transport.respond(row.callId, row.result)` attempt per returned row in order.

**Default diagnostic containment** (`host.ts:219-247`):

```ts
export function warnHost(message: string): void {
  // guarded host/receiver reads omitted
  try {
    (warn as (message: string) => void).call(consoleLike, message);
  } catch {
    // A convenience diagnostic can never become application control flow.
  }
}
```

Author a fresh frozen two-key `{ code, message }` from a closed code/message table. A supplied runtime hook replaces `warnHost`; catch its throw and do **not** fall back to console. This deliberately differs from the build-time catalog hook, which is unguarded at `catalog.ts:1131-1135`:

```ts
const sink = options?.onDiagnostic ?? defaultDiagnosticSink;
for (const diagnostic of diagnostics) {
  sink(diagnostic);
}
```

Do not copy that propagation behavior into Session.

**Novel lifecycle portion — use `07-RESEARCH.md`, not an invented analog:**

- Construct transactionally in `starting`; install inert subscriptions; publish once; transition to `active`; return the frozen handle. Roll back every partial setup failure independently.
- Accept a batch only while active and with a non-null current context. Capture context reference and epoch synchronously at callback arrival.
- One explicit FIFO pump owns the live queue. Epoch change aborts old records but leaves queued records to dispatch once. Stop splices queued records into a detached drain list, aborts them, runs each once with response emission suppressed, and awaits all finalizers.
- Cache the first stop Promise and mark `stopped` before the first unsubscriber, abort listener, diagnostic hook, or `setTools(empty)` call. Every later `stop()` returns that exact object.
- Recheck lifecycle immediately before every response and every stage callback. After the stop transition there is no response or stage emission; `stage()` remains readable, while `setContext` and new subscriptions throw fixed use-after-stop text.

### `packages/concierge/src/types.ts` (public model)

**Analog:** modify the existing definitions in place; do not create parallel types.

**Structural no-DOM signal** (`types.ts:38-49`):

```ts
export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: "abort", listener: () => void): void;
  removeEventListener(type: "abort", listener: () => void): void;
}
```

**Current Transport block to amend** (`types.ts:1303-1361`):

```ts
export interface Transport {
  readonly capabilities: TransportCapabilities;
  setTools: (tools: ReadonlyArray<EmittedTool>) => void;
  onToolBatch: (cb: (batch: ToolBatch) => void) => () => void;
  respond: (callId: string, result: ActionResult) => void;
}
```

Add exported `TransportStatus = "idle" | "connecting" | "connected" | "closed"`, required readonly `status`, and required `onStatusChange`. The resulting Transport has exactly six neutral keys.

**Current Session/Config block to amend** (`types.ts:1815-1863`):

```ts
export interface Session {
  setContext: (ctx: StageContext) => void;
  stage: () => string | null;
  onStageChange: (cb: (stage: string | null) => void) => () => void;
  stop: () => void;
}

export interface SessionConfig {
  concierge: Concierge;
  transport: Transport;
  initialContext?: StageContext;
}
```

Keep exactly four Session keys, change stop to `() => Promise<void>`, widen `initialContext?: StageContext | undefined`, and add `onDiagnostic?: ((diagnostic: SessionDiagnostic) => void) | undefined`. Follow `InvocationMeta`'s exact-optional rule at `types.ts:313-324`; explicit `| undefined` is required for computed optional object construction.

Add exported readonly `SessionDiagnostic { code, message }` and closed `SessionDiagnosticCode`. Do not add fixture-control types or new result/reason types to production.

### `packages/concierge/src/index.ts` (barrel and shipped prose)

**Analog:** its own grouped exports (`index.ts:59-149`).

```ts
export type {
  // Transport
  Transport,
  TransportCapabilities,
  // Concierge
  Concierge,
  Session,
  SessionConfig,
} from "./types.js";

export { createConcierge } from "./concierge.js";
export { createBridge, captureSnapshot, offPageResult } from "./bridge.js";
```

Add `TransportStatus`, `SessionDiagnosticCode`, and `SessionDiagnostic` to the grouped type block and `createSession` as the sole new value export from `./session.js`. Never export `createStubTransport`.

Replace the now-false header at `index.ts:46-56` that says Session/transport routing do not exist and `createSession` is still to come. Preserve the true boundaries: consent remains Phase 8; adapters/framework ownership remain Phase 9.

### `packages/concierge/src/contract.ts` (guard documentation)

**Analog:** the current entry-point inventory at `contract.ts:109-113,140-176`.

```ts
// Call from the first reachable entry point and never at module scope.
// createBridge reaches this guard from its own body rather than transitively.
```

Update prose to name `createSession` as the fourth guarded production entry point and a direct call site. The executable guard remains unchanged. The direct call belongs in `session.ts`, not module scope.

## Test Fixture and Runtime Suite Assignments

### `packages/concierge/test/fixtures/stub-transport.ts` (test provider)

**Closest event-control analog** (`dispatcher-batch.test.ts:96-122`):

```ts
function createAbortController(initiallyAborted = false) {
  let aborted = initiallyAborted;
  const listeners = new Set();
  const signal = {
    get aborted() { return aborted; },
    addEventListener(type, listener) { if (type === "abort") listeners.add(listener); },
    removeEventListener(type, listener) { if (type === "abort") listeners.delete(listener); },
  };
  return {
    abort() {
      if (aborted) return;
      aborted = true;
      for (const listener of [...listeners]) listener.call(signal);
    },
    listenerCount() { return listeners.size; },
    signal,
  };
}
```

Copy the closure-local set, idempotent state transition, snapshot iteration, and count inspection. Return a frozen outer harness containing a separately frozen six-key `transport`; controls must stay outside the object passed to production.

Required fixture behavior:

- frozen conversational and command-palette capability profiles with the exact values in `07-CONTEXT.md:34-38`;
- synchronous `emitStatus` and `emitBatch`; status emits only on actual transitions;
- occurrence-number failure injection for subscribe/unsubscribe, `setTools`, and `respond`;
- record each publication/response **attempt before throwing**;
- return frozen history snapshots and rows while retaining catalog references for `toBe` replay assertions;
- expose frozen `{ status, batch }` subscriber counts;
- no timer, network, WebRTC, vendor SDK/event name, production export, or source-tree placement.

There is no full transport-fixture analog; use the researched recommended shape at `07-RESEARCH.md:308-344` for the novel control API.

### All four new runtime suites — common harness

Copy the built-artifact harness from `dispatcher-batch.test.ts:1-26`:

```ts
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, expect, it } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
let createConcierge;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) throw new Error("... Run `pnpm build` ...");
  const artifact = await import(DIST_URL.href);
  createConcierge = artifact.createConcierge;
});

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});
```

Bind both `createConcierge` and `createSession` dynamically. Tests import `dist`, never executable source. Import the test-only stub relatively as `./fixtures/stub-transport.js`. Reset the hard-coded contract registry key before each case because `createSession` is a direct guard caller. Use explicit promises/controls; no timers, sleeps, or Vitest/Jest mocking APIs.

### `packages/concierge/test/session-catalog.test.ts`

**Analog:** catalog identity tests in `concierge.test.ts:560-630`.

```ts
const a = concierge.catalogFor({ pathname: "/results" });
const b = concierge.catalogFor({ pathname: "/results", scrollY: 900 });
expect(a).toBe(b);
expect(Object.is(a, b)).toBe(true);

const first = canonical();
const second = canonical();
expect(first.catalogFor(ctx)).not.toBe(second.catalogFor(ctx));
```

Test publication history by reference, not deep value. Include distinct contexts sharing a catalog, distinct catalogs with equal contents, and duplicate stage ids whose `stage()` string stays equal while catalog identity changes; the existing duplicate-id proof is at `concierge.test.ts:1202-1255`.

Cover initial context/no context, connected/non-connected, forced replay, same-catalog context retention, stage-only notification rules, fixed-catalog fail-closed stop, and reentrant work refusal.

### `packages/concierge/test/session-routing.test.ts`

**Analog:** `dispatcher-batch.test.ts` seriality and exact metadata cases.

**Concurrency counter** (`dispatcher-batch.test.ts:249-292`):

```ts
let active = 0;
let maximum = 0;
action("serial", async () => {
  active += 1;
  maximum = Math.max(maximum, active);
  await Promise.resolve();
  active -= 1;
});
expect(maximum).toBe(1);
```

Extend this across **two complete incoming batches** by blocking A with an explicit deferred promise while B arrives. Assert B does not enter until A's dispatch, response attempts, and finalizer finish—even if one A response throws.

**Reference-preserving metadata assertion** (`dispatcher-batch.test.ts:432-469`):

```ts
const signal = { aborted: false, addEventListener: () => {}, removeEventListener: () => {} };
const deferUntilDelivered = () => {};
// After dispatch:
expect(receivedMeta.deferUntilDelivered === deferUntilDelivered).toBe(true);
expect(receivedMeta.signal === signal).toBe(true);
```

For Session, assert ids by value; `calls` and delivery hook by reference; composed signal by inequality plus behavior. Add a real handler case proving Phase 6 `InvocationMeta` receives the exact ids/hook. Count accepted occurrences, `dispatchBatch` calls, returned rows, and response attempts separately. Never infer once-only behavior from final history alone.

### `packages/concierge/test/session-lifecycle.test.ts`

**Analog:** stale unsubscriber and frozen-closure cases in `bridge.test.ts:513-556,662-716`.

```ts
const u1 = registry.register(A);
u1();
registry.register(A);
u1();
expect(registry.read()).toBe(A);

expect(Object.isFrozen(registry)).toBe(true);
registry.register(A); // frozen handle, live closure
```

Translate the same-callback-twice/stale-unsubscribe ordering to stage listeners. Add listener snapshot cases for add/remove during delivery, throw, nested `setContext`, and stop during notification.

Use the console capture pattern from `diagnostic-safety.test.ts:58-69` for the default sink:

```ts
const realConsole = globalThis.console;
const captured = [];
globalThis.console = { ...realConsole, warn: (message) => captured.push(String(message)) };
try {
  await run();
} finally {
  globalThis.console = realConsole;
}
```

Prove exact frozen diagnostic keys/messages, replacement-hook behavior, hook-throw containment, and absence of secret sentinels, ids, raw batches, caught text, context, args, and results.

Lifecycle matrix: setup failure at each subscription/publication step; invalid unsubscriber; cleanup failures independently; stop before/during dispatch/response/listener/unsubscriber; exact Promise identity before/after resolution; active handler ignoring abort delays drain; queued records dispatch once but emit no post-stop response.

### `packages/concierge/test/stub-transport.test.ts`

**Analog:** `bridge.test.ts:662-716` for “frozen outward object, live closure” plus `dispatcher-batch.test.ts:96-122` for synchronous snapshot events.

Assert both named capability profiles deeply frozen; transport exact six-key behavior; transition suppression; batch snapshot delivery; occurrence-based failures; attempt-before-throw histories; immutable history snapshots/rows; subscriber counts; and continued operation after callers unsuccessfully mutate snapshots. Add static negative checks for timer/network/WebRTC/vendor vocabulary and prove the fixture is absent from the production barrel (tarball absence remains the pack gate's job).

## Type-Test Assignments

### `packages/concierge/test-d/session.test-d.ts`

**Analog:** one-line exact predicates in `dispatcher.test-d.ts:20-25`.

```ts
type _dispatchSignature = Expect<Equals<Concierge["dispatch"], (...) => Promise<ActionResult>>>;
type _conciergeKeys = Expect<Equals<keyof Concierge, "dispatch" | "dispatchBatch" | "catalogFor" | "stageFor" | "explain">>;
type _toolBatchEnvelopeIsReadonly = Expect<Equals<Pick<ToolBatch, ...>, { readonly ... }>>;
```

Use `Expect<Equals<...>>` one line per invariant; reserve `@ts-expect-error` for excess-property freshness only. Pin:

- `typeof createSession` exactly `(config: SessionConfig) => Session` from the public barrel;
- exact four Session keys and `stop: () => Promise<void>`;
- exact diagnostic code union, exact two readonly diagnostic keys, and no extra-key object literal;
- exact `SessionConfig` required/optional members and computed `StageContext | undefined` / hook `| undefined` construction positives;
- readonly Transport status and callback signatures;
- frozen-at-runtime claims stay in runtime tests, not type predicates.

### `packages/concierge/test-d/transport.test-d.ts`

**Analog:** modify its two structural fixtures and key pin (`transport.test-d.ts:145-190`).

```ts
const streamingTransport: Transport = {
  capabilities: { /* ... */ },
  setTools: () => {},
  onToolBatch: () => unsubscribe,
  respond: () => {},
};

type _transportKeys = Expect<Equals<keyof Transport,
  "capabilities" | "setTools" | "onToolBatch" | "respond"
>>;
```

Add `status` and `onStatusChange` to both unrelated fixtures and change the key pin to the exact six-key union. Add exact `TransportStatus` union/callback pins and readonly-status proof. Keep all vocabulary neutral, including comments.

### `packages/concierge/test-d/actions.test-d.ts`

**Analog:** existing D-08 fixture (`actions.test-d.ts:520-548`).

```ts
type _sessionStage = Expect<Equals<Session["stage"], () => string | null>>;
type _sessionOnStageChange = Expect<Equals<Session["onStageChange"], (cb: (stage: string | null) => void) => () => void>>;

const _session: Session = {
  setContext: () => {},
  stage: () => "checkout",
  onStageChange: () => () => {},
  stop: () => {},
};
```

Change only the fixture's stop implementation to return `Promise<void>` (for example `() => Promise.resolve()`). Keep the existing stage/change pins; put the full new Session contract in `session.test-d.ts` rather than duplicating it here.

### `packages/concierge/test-d/exports.test-d.ts`

**Analog:** the value-placement import and predicates at `exports.test-d.ts:72-116`.

```ts
import { /* existing values */, createBridge, captureSnapshot, offPageResult } from "../src/index.js";
type _createBridgeExportedAsValue = Expect<Assignable<typeof createBridge, (...args: never[]) => unknown>>;
```

Import `createSession` from `../src/index.js` in the value import and add a callable-value predicate. Do not import it directly from `session.js`; the point is public placement and TS1485 sensitivity.

## Artifact, Export, Single-Instance, Foreign-Probe, and Package Gates

### `packages/concierge/test/artifact.test.ts`

**Analog:** callable factory case (`artifact.test.ts:129-139`).

```ts
it("createConcierge reaches dist/index.js as a callable function", async () => {
  const m = await import(DIST_URL.href);
  expect(typeof m.createConcierge).toBe("function");
});
```

Add the parallel `createSession` case against `dist/index.js`.

### `packages/concierge/test/export-surface.test.ts`

**Analog:** parsed surface/count/name gate (`export-surface.test.ts:74-99,106-152`).

```ts
const VALUE_EXPORTS = [
  // ...
  "createConcierge",
  "createBridge",
  "captureSnapshot",
  "offPageResult",
];

expect(names).toHaveLength(65);
expect(types).toHaveLength(51);
expect(values).toHaveLength(14);
```

Append `createSession` to `VALUE_EXPORTS` and synchronize title/assertion counts to **69 names / 54 types / 15 values**. Re-derive from the built declaration; do not trust arithmetic if the implemented public type set differs.

### `packages/concierge/test/single-instance.test.ts`

**Analog:** F6 direct factory guard (`single-instance.test.ts:287-329`).

```ts
const { assertSingleInstance, createBridge, CONTRACT_VERSION } = await import(
  `${DIST_HREF}?sc7=1`
);
expect(registry[KEY]).toBeUndefined();
createBridge("results");
expect(registry[KEY]).toEqual({ version: CONTRACT_VERSION });
```

Add F7 with a never-reused query string. Destructure but never call `assertSingleInstance`; assert empty after import, call `createSession` with structural Concierge/Transport fakes, then assert the registry populated. Do not construct the fake through `createConcierge` or `createBridge`, because either would contaminate the direct-call observation. Stop the created session to leave no subscriber behind.

### `packages/concierge/test/fixtures/probe.ts`

**Analog:** foreign package value/type annotations (`probe.ts:64-76,94-110,144-155`).

```ts
import { MESSAGE_MAX_CHARS, CONTRACT_VERSION, assertSingleInstance, buildCatalog } from "@fullselfbrowsing/concierge";
import type { ActionResult, ConsentAck, Transport } from "@fullselfbrowsing/concierge";

export const f: () => void = assertSingleInstance;
export type ProbeTransport = Transport;
export const bc: (a: readonly never[]) => unknown = buildCatalog;
```

Import `createSession` as a value and `TransportStatus`, `SessionDiagnosticCode`, `SessionDiagnostic`, `SessionConfig`, and `Session` as types. Construct a minimal six-key transport and config under foreign `strict` + `exactOptionalPropertyTypes`; pin computed optional values with explicit `undefined`; annotate the factory/returned handle and Promise stop. Keep the probe no-DOM and dependency-free.

### `scripts/pack-install-check.sh`

**Analog:** existing pack/install/runtime flow (`pack-install-check.sh:43-54,97-130`).

```sh
TGZ="$(cd "$PKG_DIR" && pnpm pack --pack-destination "$OUT" | tail -1)"
if [ ! -f "$TGZ" ]; then
  echo "FAIL: pnpm pack did not produce a tarball at: $TGZ" >&2
  exit 1
fi

cp "$PKG_DIR/test/fixtures/probe.ts" ./probe.ts
./node_modules/.bin/tsc -p tsconfig.json
node --input-type=module -e 'const m = await import("@fullselfbrowsing/concierge"); /* assertions */'
```

Immediately after packing, list tar entries and fail if any path contains `test/fixtures/stub-transport` (or the fixture basename). Extend the runtime import assertion to require callable `createSession`. Preserve the external `mktemp -d`, npm install, foreign compiler, and cleanup trap.

The existing package boundary is already correct (`packages/concierge/package.json:36-41`):

```json
"files": ["dist", "src", "README.md", "LICENSE"]
```

Do not edit the manifest to solve fixture packaging; location plus explicit tar inspection is the proof.

## Mutation Harness and Planning Evidence

### `scripts/phase-07-mutation-battery.mjs`

**Analog:** `scripts/phase-06-mutation-battery.mjs`. Copy the harness architecture, then replace phase paths, test groups, ids, detector mappings, and ledger schema inputs.

**Definition shape** (`phase-06-mutation-battery.mjs:326-400`):

```js
function runtimeMutant({ id, group, name, target, literalPattern, replacement, intendedCaseIds }) {
  return Object.freeze({
    id,
    group,
    name,
    target,
    literalPattern,
    replacement,
    detectorKind: "vitest",
    intendedCaseIds: Object.freeze([...intendedCaseIds]),
    expectedFailureFingerprint: Object.freeze(/* exact RED marker per case */),
  });
}
```

**Compiled-and-ran detector gate** (`phase-06-mutation-battery.mjs:1938-1987`):

```js
const build = runBuild();
gate.compiled = build.succeeded;
if (!build.succeeded) return;
const vitest = runVitest(mutant.intendedTestFile, reportPath, mutant.intendedCaseIds);
gate.testsRan = vitest.report.numTotalTests;
gate.detectorSatisfied = vitest.exitCode !== 0 && fingerprint.satisfied;
```

**Restoration/evidence closure** (`phase-06-mutation-battery.mjs:2092-2149`):

```js
const targetRestored = hashAfter === hashBefore;
const restored = runRestoredGates(mutant, directory);
const scopedTreeClean = beforeStatus === "" && afterStatus === "";
const killed = gate.compiled === true && gate.testsRan > 0 && gate.detectorSatisfied === true;
```

Carry forward the repository-wide advisory lock, atomic evidence writes, exact one-occurrence replacement, source hash restoration, bounded `run range`, exact failure fingerprints, restored gates, revision digest, and ledger counterexample self-tests. A build failure alone is never a killed mutant.

Register at least every target in `07-VALIDATION.md:115-126`: initial publish, connected replay, reference-vs-stage comparison, fixed-catalog stop ordering, single pump, arrival-time context, active and queued epoch abort, composed signal, exactly-once dispatch, no retry, cached stop Promise, stopped-before-cleanup, no post-stop output, snapshot listener queue, token identity, safe diagnostics, contained hook, test-only stub, and direct single-instance call.

### `07-MUTATION-REGISTER.json` and `07-MUTATION-EVIDENCE.json`

**Analogs:** Phase 6 register/evidence.

Register schema (`06-MUTATION-REGISTER.json:1-4,134-155`):

```json
{
  "schemaVersion": 2,
  "phase": "06-dispatcher",
  "registerDigest": "...",
  "mutants": [{
    "id": "M-06-S01",
    "target": "packages/concierge/src/concierge.ts",
    "detectorKind": "vitest",
    "intendedCaseIds": ["R01"],
    "expectedFailureFingerprint": [{ "caseId": "R01", "marker": "[RED:R01:promise-identity]" }]
  }]
}
```

Evidence schema (`06-MUTATION-EVIDENCE.json:69-109`):

```json
{
  "rows": [{
    "status": "green",
    "executed": true,
    "compiled": true,
    "testsRan": 1,
    "detectorSatisfied": true,
    "targetRestored": true,
    "restoredGreen": true,
    "scopedTreeClean": true,
    "revisionDigest": "..."
  }]
}
```

Generate both through the harness; do not hand-edit measured rows or digests. The register is immutable once execution begins. Evidence is valid only for its exact shared digest and revision input.

### `.planning/phases/07-session-and-the-transport-seam/07-VALIDATION.md`

**Analog:** Phase 6's measured ledger (`06-VALIDATION.md:42-65,77-95,106-136`).

Copy these close-out patterns:

- per-task rows move from Wave-0/pending to exact existing file + green status;
- mutation evidence records digest, exact group/total counts, zero pending, compiled mutant, exact detector, restored gate, and clean tree;
- phase-gate evidence records actual command exits and live counts;
- frontmatter becomes `status: complete`, `nyquist_compliant: true`, and `wave_0_complete: true` only after all evidence agrees;
- replace the 12-file/252-test Phase 6 baseline with measured Phase 7 totals; never copy it forward.

If `.planning/REQUIREMENTS.md` is included in the final evidence plan, copy the evidence-rich completed wording at `REQUIREMENTS.md:164-172`, not a bare `Complete`, and change only SES-01..04/TRN-02 after their named tests and mutations are green.

## Shared Patterns

### Instance and authority boundaries

- Mutable runtime state is factory-local; only immutable constants may be module-scoped.
- `createSession` is a direct single-instance call site.
- Catalog reference identity is authority/epoch identity. Stage ids may collide and array contents may be equal.
- A fixed-catalog identity change stops synchronously before throwing or admitting reentrant work.

### Error and diagnostic handling

- Use no-binding catches at consumer/transport boundaries.
- Never include caught values, ids, context, args, results, raw batch fields, or stack/class text in diagnostics.
- Guard cleanup steps independently. A failed unsubscriber, clear, response, listener, or diagnostic hook cannot skip later work.
- `respond` is attempted once and never retried after a throw because acceptance is ambiguous.

### Immutability

- Freeze the Session handle, diagnostics, empty catalog, stub capabilities/transport/harness, history snapshots, history rows, and subscriber-count snapshots.
- Do not deep-clone catalog entries or replace catalog references in histories.
- Freezing the outward handle must not freeze or disable its closure state.

### Runtime-test discipline

- Build before focused runtime tests; they import `dist`.
- Use `pnpm exec vitest run <exact-file>`, not `pnpm test -- <fragment>`.
- Use explicit deferred promises and synchronous fixture controls, not timers or mocks.
- Give load-bearing assertions unique case ids/RED markers so the mutation harness can prove the exact detector fired.

## Integration Order and Pitfall Rules

| Order | Integration rule | Pitfall prevented |
|---|---|---|
| 1 | Amend `types.ts` and all exact type fixtures together. | Four-key Transport, void stop, or EOPT drift survives in one layer. |
| 2 | Land the test-only stub and its own contract suite. | Session suites invent incompatible transport fakes or production exports test controls. |
| 3 | Implement hot publication/stage/status plus barrel and F7 guard. | Reconnect is vendor-shaped; import alone registers the copy; initial publication occurs after return. |
| 4 | Add FIFO routing and epoch cancellation. | Cross-batch overlap, execution-time context reads, dropped queued rows, or replaced consent metadata. |
| 5 | Add cached stop drain, rollback, reentrancy, and diagnostics. | Reentrant duplicate cleanup, post-stop output, stale listener removal, or hook throws becoming fatal. |
| 6 | Synchronize artifact/export/foreign/tarball gates. | Source looks correct while the shipped value/type is absent or the stub is packed. |
| 7 | Run mutation battery and only then populate evidence ledgers. | Build-only “kills,” stale counts, hand-authored proof, or evidence for a different revision. |

Additional hard pitfalls:

- Do not call `catalogFor({})` for missing initial context.
- Do not compare stage strings or catalog contents to decide epochs.
- Do not drop queued accepted work on epoch change or stop; dispatch each occurrence once.
- Do not use Promise-tail chaining when stop must synchronously detach/clear queue state.
- Do not assign the stop Promise after cleanup begins.
- Do not iterate a live listener map or recursively emit nested stage values.
- Do not branch production on profile name, consent grade, turn provenance, or `parallelCalls`; those are fixture data or Phase 8 concerns.
- Do not invoke or wrap `deferUntilDelivered`; forward it unchanged.
- Do not auto-stop merely because status becomes `closed`; only `connected` has special replay semantics in this phase.
- Do not add queue limits without a transport rejection/result protocol.

## No Exact Analog Found

| File / Portion | Closest Partial Analog | Planner Source for Novel Behavior |
|---|---|---|
| `src/session.ts` transactional hot startup and partial rollback | `createBridge` factory-local/frozen handle | `07-RESEARCH.md:219-231` |
| `src/session.ts` explicit FIFO plus detached stop drain | dispatcher serial loop | `07-RESEARCH.md:239-267` |
| `src/session.ts` queued reentrant stage-value notifier | bridge monotonic token | `07-RESEARCH.md:257-267` |
| `test/fixtures/stub-transport.ts` full status/batch/failure/history control surface | structural abort controller fixture | `07-RESEARCH.md:308-344` |

## Unchanged Gate Inputs

- `packages/concierge/package.json`: no dependency/export/files change.
- root `package.json`: existing seven-command release gate remains authoritative.
- `pnpm-lock.yaml`: byte-identical final comparison.
- `scripts/pkg05-zero-runtime-deps.mjs` and `scripts/node-floor-check.sh`: run unchanged.
- No framework, vendor, transport, queue, event-emitter, cancellation, DOM, network, or timer package is added.

## Metadata

**Analog search scope:** `packages/concierge/src/`, `packages/concierge/test/`, `packages/concierge/test-d/`, `scripts/`, Phase 4 catalog evidence, and Phase 6 dispatcher/mutation evidence.

**Candidates scanned:** 11 production source files, 18 runtime-test/fixture files, 13 type-test files, 6 scripts, and relevant Phase 6 planning artifacts.

**Strong analogs read:** `src/bridge.ts`, `src/concierge.ts`, `src/dispatch.ts`, `src/host.ts`, `src/catalog.ts`, public/gate target files, `test/concierge.test.ts`, `test/dispatcher-batch.test.ts`, `test/bridge.test.ts`, `test/diagnostic-safety.test.ts`, and the Phase 6 mutation/validation artifacts.

**Project instructions:** no root `AGENTS.md`, `.codex/skills/`, or `.agents/skills/` exists.

**Pattern extraction date:** 2026-08-08
