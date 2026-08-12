# Phase 6: Dispatcher - Pattern Map

**Mapped:** 2026-08-05
**Planned file changes:** 12 (5 new, 7 modified)
**Close analogs found:** 10 / 12
**Search scope:** `packages/concierge/src/`, `packages/concierge/test/`, `packages/concierge/test-d/`, `.planning/REQUIREMENTS.md`

## Planner Decisions Required First

Patterns do not resolve these three API/design gaps identified by RESEARCH.md. The first plan task must settle and type-pin them:

1. The context-bearing single-call signature. Current `Concierge.dispatch(name, args, meta?)` cannot enforce `namesByStage` without hidden state. Prefer the researched context-first form, but make the choice explicit.
2. The transport-independent batch member and its immutable `{ callId, result }` response rows. No such member exists today.
3. The dedupe entry representation and the 500 ms dedupe / 600 ms commit-window overlap. A `Map<string, Promise<ActionResult>>` cannot also store creation timestamps, and access expiry can otherwise expire a still-pending effect.

Do not implement either public seam through “last context” state on `Concierge`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| **NEW** `packages/concierge/src/dispatch.ts` | service + utility | request-response + event-driven + transform | `src/concierge.ts` (`runMatch`, `projectFor`); `src/json-schema.ts` guarded vendor call | partial; no dispatcher exists |
| **NEW** `packages/concierge/src/message.ts` | utility | transform | `src/bridge.ts:360-403` (`boundedMessage`) | exact extraction |
| **MOD** `packages/concierge/src/concierge.ts` | service / factory | request-response + batch | its own factory closure, stage resolver, and bridge resolver | exact |
| **MOD** `packages/concierge/src/bridge.ts` | utility + service | transform | its own `boundedMessage` / `offPageResult` | exact |
| **MOD** `packages/concierge/src/host.ts` | provider / utility | event-driven | its own structural `globalThis` console seam | exact role |
| **MOD** `packages/concierge/src/types.ts` | model | request-response + batch | its own `InvocationMeta`, `ToolBatch`, `Scheduler`, `Concierge` | exact |
| **MOD** `packages/concierge/src/index.ts` | barrel + shipped documentation | transform | its own grouped public surface | exact |
| **NEW** `packages/concierge/test/dispatcher.test.ts` | runtime test | request-response + event-driven | `test/concierge.test.ts` | exact harness, new behavior |
| **NEW** `packages/concierge/test/dispatcher-batch.test.ts` | runtime test | batch + event-driven | `test/concierge.test.ts`; envelope shape in `test-d/transport.test-d.ts` | partial; no runtime batch analog |
| **NEW** `packages/concierge/test-d/dispatcher.test-d.ts` | type test | compile-time transform | `test-d/concierge.test-d.ts`; `test-d/transport.test-d.ts` | exact |
| **MOD** `packages/concierge/test/concierge.test.ts` | runtime test | request-response | itself | exact deletion/update |
| **MOD** `.planning/REQUIREMENTS.md` | config / traceability | transform | its existing completed traceability rows | exact |

`06-VALIDATION.md` already exists, so RESEARCH.md's Wave-0 “create” item is no longer a planned file change.

## Pattern Assignments

### `packages/concierge/src/dispatch.ts` (new)

**Closest analogs:** `src/concierge.ts` for instance-local state and consumer callback containment; `src/json-schema.ts` for a narrowly scoped external-schema call. This module should remain internal and must not be barrel-exported.

**Imports convention** (`src/concierge.ts:61-74`): runtime imports first, then `import type`, with `.js` specifiers.

```ts
import { buildCatalog, deepFreeze } from "./catalog.js";
import { warnHost } from "./host.js";
import type { Catalog } from "./catalog.js";
import type { ActionResult, InvocationMeta, StageContext } from "./types.js";
```

**Lazy instance cache pattern** (`src/concierge.ts:480-481`, `:630-645`):

```ts
let memo: Map<number | null, ReadonlyArray<EmittedTool>> | null = null;

memo ??= new Map<number | null, ReadonlyArray<EmittedTool>>();
const hit = memo.get(index);
if (hit !== undefined) return hit;
// build once
memo.set(index, built);
return built;
```

Copy the allocation/lifetime pattern, not the value type. The dispatcher cache belongs inside `createConcierge`, is `let`-declared and `??=`-allocated, and stores the final Promise synchronously. The outer `dispatch` must be a normal function so a cache hit returns the identical Promise object.

**Consumer callback boundary** (`src/concierge.ts:518-543`):

```ts
let result: unknown;
try {
  result = stage.match(ctx);
} catch {
  return warnStage(/* fixed prose only */);
}
```

Copy the no-binding `catch` for handler errors. Keep validation, waiting, handler invocation, and result inspection in separate guarded boundaries; do not let a broad catch relabel validator/timer/normalizer failures as `handler_error`.

**Validation integration:** read `entry.action.schema["~standard"].validate(args)`, await sync or async output, reject `issues`, and pass the returned `value` to the handler. No runtime validation call exists in the repository; use RESEARCH.md Pattern 2 for this novel portion.

**Result integration:** build fresh `ActionResult` objects from only `ok`, optional `reason`, and sanitized `message`; never spread or return an untrusted handler object. Apply sanitization to every exit, including constants and dispatcher-authored failures.

### `packages/concierge/src/concierge.ts` (modify)

Keep orchestration inside the existing factory so it can reuse the one stage and bridge answer.

**Factory-local integration points:**

- `catalog` is built once at `:354-380`.
- `namesByStage` is the indexed stage projection at `:418-447`.
- `resolveIndex(ctx)` is the only first-match resolver at `:596-603`.
- `resolveBridge(stage)` is the module-private second-and-final caller seam at `:184-247`.
- `catalog.byName` is the handler lookup; its construction is the frozen null-prototype record in `catalog.ts:1060-1073`.

```ts
const byName: Record<string, CatalogEntry> = Object.create(null);
for (const entry of entries) byName[entry.action.name] = entry;
// catalog is then deep-frozen
```

Use the resolved stage position to check `namesByStage` before reading `catalog.byName`; `byName` is global across stages. Do not replace it with a `Map`, and do not add another bridge resolver. Pass `bridge: null` to the handler when resolution yields null; core must not synthesize `no_bridge`.

Replace the stub at `:648-654` wholesale and add the settled batch member to the returned object at `:768`. Also remove/update all stub-era prose in this file:

- header `:1-4`;
- `DISPATCH_NOT_IMPLEMENTED` and its comment `:100-134`;
- the “four seals” claim `:396-403` (it becomes three after deleting the frozen stub).

### `packages/concierge/src/message.ts` (new) and `src/bridge.ts` (modify)

Move, do not duplicate, the surrogate-safe bound from `bridge.ts:393-403`:

```ts
function boundedMessage(message: string): string {
  if (message.length <= MESSAGE_MAX_CHARS) return message;
  const lastRetained = message.charCodeAt(MESSAGE_MAX_CHARS - 1);
  const cut = lastRetained >= 0xd800 && lastRetained <= 0xdbff
    ? MESSAGE_MAX_CHARS - 1
    : MESSAGE_MAX_CHARS;
  return message.slice(0, cut);
}
```

The shared module imports `MESSAGE_MAX_CHARS` from `./types.js`, strips C0/C1 controls, collapses whitespace, trims, then calls the bound. Export helpers only from this internal module, not `src/index.ts`.

`bridge.ts:405-415` keeps `offPageResult`'s authored result shape but imports the shared bound:

```ts
return { ok: false, reason: "no_bridge", message: boundedMessage(message) };
```

Move the “bounding, not sanitizing” documentation at `bridge.ts:360-385` with the function, then document the sanitizer's stronger boundary in `message.ts`.

### `packages/concierge/src/host.ts` (modify)

Copy its existing structural-host convention exactly (`host.ts:63-96`):

```ts
interface ConsoleLike {
  warn: (message: string) => void;
}

export function warnHost(message: string): void {
  const host: { console?: ConsoleLike } = globalThis as { console?: ConsoleLike };
  host.console?.warn(message);
}
```

Add a module-private minimal timer view and perform the `globalThis` cast inside a function body. Keep the capability optional. The fallback must return a canceller compatible with `Scheduler`; if the host lacks the capabilities needed to schedule/cancel, return absence so `createConcierge` can warn once and skip the commit window. Do not use bare `setTimeout`, DOM types, Node timer types, or a module-scope host read.

### `packages/concierge/src/types.ts` (modify)

Preserve these existing contracts:

```ts
// types.ts:413-425
type ActionHandler<...> = (ctx: {
  args: Args;
  bridge: B | null;
  meta: InvocationMeta;
  ack?: ConsentAck<Snapshot, AckPayload> | undefined;
}) => ActionResult | Promise<ActionResult>;

// types.ts:1413
export type Scheduler = (fn: () => void, delayMs: number) => () => void;
```

Settle and document the context-aware `Concierge.dispatch` and batch member at `types.ts:1714-1747`. Use one handler context `{ args, bridge, meta, ack }`, writing `ack: undefined` for non-gated calls. Keep explicit `| undefined` on optional fields (`InvocationMeta:301-336`, `ToolBatch:1185-1218`). Do not add a new `ReasonCode`; `aborted` remains the batch-abort spelling.

Prefer an inline readonly batch-result row in `Concierge` so Phase 6 adds no exported name. If planning chooses a named exported type instead, that intentionally expands the 65-name / 51-type / 14-value surface and requires all export-surface pins.

### `packages/concierge/src/index.ts` (modify)

No runtime export is needed for internal dispatch/message helpers. Keep the grouped type/value exports at `index.ts:44-134` unchanged unless planning deliberately adds a named public type.

Update the shipped header at `index.ts:24-35`: it currently says dispatch is a not-implemented result, runs no handler, and never routes through a bridge. Preserve the still-true boundary that Session, transport wiring, and consent gating are later phases.

### `packages/concierge/test/dispatcher.test.ts` (new)

Copy the built-artifact harness from `test/concierge.test.ts:308-352`:

```ts
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
beforeAll(async () => {
  if (!existsSync(fileURLToPath(DIST_URL))) throw new Error(/* run pnpm build */);
  const artifact = await import(DIST_URL.href);
  createConcierge = artifact.createConcierge;
});
```

Copy local declaration/stage helpers from `test/concierge.test.ts:375-413`, but give this file its own case-id series and fixtures. Tests import `dist`, never `src`.

Required test conventions/integration:

- Assert dedupe with `const p1 = dispatch(...); const p2 = dispatch(...); expect(p1).toBe(p2)` before awaiting.
- Use counters for handler-once, validation-before-handler, wrong-stage refusal, and commit-before-effect.
- Use an injected local scheduler fixture; no global fake timers or Vitest mocking API.
- Capture console through a plain global assignment and restore in `finally`, following `concierge.test.ts:1077-1095`.
- Prove thrown text reaches neither result nor console; assert exact generic failure prose.
- Exercise `__proto__`, `constructor`, cycle/BigInt keys, sync/async validators and transformed values, missing/non-callable handlers, abort races, malformed/throwing result getters/proxies, both normalized contradictions, every dispatcher-authored reason branch, SEC-06 controls/whitespace/bound/surrogate behavior, and mounted/null/throwing bridge resolution.

### `packages/concierge/test/dispatcher-batch.test.ts` (new)

There is no runtime batch analog. Reuse the same built-artifact harness and local fixture style. The envelope fields to model are concrete in `types.ts:1158-1218` and the existing compile fixture at `test-d/transport.test-d.ts:267-273`:

```ts
const batch: ToolBatch = {
  responseId: "r",
  calls: [],
  userTurnId: maybeStr,
  signal: maybeSig,
  deferUntilDelivered: maybeHook,
};
```

Pin stable `outputIndex` ordering, no handler overlap, malformed JSON -> `{}` -> validation, exact metadata forwarding (`responseId`, `callId`, `outputIndex`, `userTurnId`, `signal`, `deferUntilDelivered`), immutable `{callId, result}` rows, and one `aborted` result for every remaining call after abort.

### `packages/concierge/test-d/dispatcher.test-d.ts` (new)

Copy the type-test conventions from `test-d/concierge.test-d.ts:98-115`, `:147-154` and `test-d/transport.test-d.ts:10-15`:

```ts
import type { Equals, Expect } from "./_assert.js";
import type { Concierge, Scheduler, StageContext } from "../src/types.js";

type _schedulerSignature = Expect<Equals<Scheduler, (fn: () => void, delayMs: number) => () => void>>;
```

Add one-line, invariant-named `Equals` predicates for the settled single-call and batch signatures, plus construction positives where explicit `undefined` is the claim. Never use `expectTypeOf`; reserve suppression directives for object-literal freshness only.

### `packages/concierge/test/concierge.test.ts` (modify)

Delete S27 wholesale (`:1274-1341`), as its own comment requires. Also remove/update the coupled header claims so the file does not describe a deleted test or constant:

- defect 6 / S27 discussion at `:74-88`;
- case-series/history text at `:222-241`;
- the M-04-1 count at `:142-150`: deleting the frozen stub reduces `Object.freeze(` in `concierge.ts` from four to three.

Do not repurpose S27 into dispatcher behavior; that belongs in the new suite.

### `.planning/REQUIREMENTS.md` (modify after evidence)

Follow existing completed traceability-row wording at `REQUIREMENTS.md:157-177`. Mark only evidence-backed Phase 6 requirements complete. SEC-02 must say it is satisfied structurally because no telemetry output seam exists; do not claim a channel was sanitized. Update the BRG-03 row with the real-dispatch end-to-end join, and record DSP-01..09, SEC-06, and TRN-04 evidence. SEC-03 should move only if the phase's real-lookup tests complete its previously pending dispatch-side proof.

## Shared Patterns

### Authentication / authorization

No authentication middleware exists or belongs in this phase. Stage authorization is `resolveIndex(ctx)` + indexed `namesByStage` before frozen `catalog.byName` lookup.

### Error handling

Use no-binding catches for runtime consumer callbacks and generic authored messages. Never echo thrown values. Warning text follows:

```text
concierge: [code] subject "x": problem Fix: fix
```

Warn-once latches are lazy, instance-local `Set`s, following `concierge.ts:500-507`; use separate latches when one warning must not suppress another.

### Immutability and surface control

Catalog lookups remain frozen null-prototype records; mutable per-instance orchestration state uses `Map`. Build fresh outbound results, freeze batch rows/containers according to the settled type, and keep new helpers off the public barrel.

### Final security boundary

Every dispatcher exit passes through one result normalizer/sanitizer. No telemetry seam is added. Handler exceptions contribute only the fixed `handler_error` result; caught details have no output channel.

## No Close Analog Found

| File | Novel portion | Planner source |
|---|---|---|
| `packages/concierge/src/dispatch.ts` | Promise-identity dedupe, Standard Schema runtime validation, cancellable pre-effect commit window, malformed result normalization | `06-RESEARCH.md` Architecture Patterns 1-3 and locked CONTEXT decisions |
| `packages/concierge/test/dispatcher-batch.test.ts` | Transport-independent serial batch executor and abort completion | `06-RESEARCH.md` Pattern 4 and DSP-06/07/TRN-04 test map |

## Metadata

**TypeScript files scanned:** 32 (9 source, 11 runtime-test, 12 type-test)
**Strong analog files read:** `concierge.ts`, `bridge.ts`, `host.ts`, `catalog.ts`, `json-schema.ts`, `types.ts`, `index.ts`, `concierge.test.ts`, `concierge.test-d.ts`, `transport.test-d.ts`
**Project instructions:** no `AGENTS.md`, `.codex/skills/`, or `.agents/skills/` present
**Pattern extraction date:** 2026-08-05
