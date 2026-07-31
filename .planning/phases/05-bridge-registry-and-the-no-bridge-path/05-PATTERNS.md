# Phase 5: Bridge registry and the no-bridge path - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 11 (3 created, 8 modified — two more than CONTEXT/RESEARCH listed; see § Files CONTEXT and RESEARCH Missed)
**Analogs found:** 11 / 11
**Analog search scope:** `packages/concierge/src/`, `packages/concierge/test/`, `packages/concierge/test-d/`, `scripts/`, root configs
**Files scanned:** 29 TypeScript sources + 5 configs + 1 shell script + the built `dist/index.d.ts`

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW** `packages/concierge/src/bridge.ts` | factory + utility module | event-driven (register/unsubscribe) + transform (clone) | `packages/concierge/src/concierge.ts` (`createConcierge`) primary; `packages/concierge/src/catalog.ts` (`deepFreeze`) for the walk; `packages/concierge/src/define-action.ts` for small-module header shape | exact (factory), exact (walk) |
| **NEW** `packages/concierge/test/bridge.test.ts` | test (runtime, against built artifact) | file-I/O + request-response | `packages/concierge/test/concierge.test.ts` | exact |
| **NEW** `packages/concierge/test-d/bridge.test-d.ts` | test (type-level) | compile-time predicate | `packages/concierge/test-d/concierge.test-d.ts`; fixtures from `packages/concierge/test-d/actions.test-d.ts` | exact |
| **MOD** `packages/concierge/src/index.ts` | barrel / config | re-export | itself (the existing grouped blocks are the pattern) | exact |
| **MOD** `packages/concierge/src/concierge.ts` | service / factory | request-response (`resolveBridge` seam) | its own `runMatch` (`:448-501`) and `bridgeStatus` (`:222-238`) | exact |
| **MOD** `packages/concierge/src/types.ts` | model (doc-comment correction) | n/a — shipped prose | its own sibling doc comments | exact |
| **MOD** `packages/concierge/src/contract.ts` | guard (doc-comment re-scope) | n/a — shipped prose | `contract.ts:147-157`, the Phase-4 correction of the adjacent sentence | exact |
| **MOD** `packages/concierge/test/export-surface.test.ts` | test (artifact audit) | file-I/O | itself | exact |
| **MOD** `packages/concierge/test-d/exports.test-d.ts` | test (type-level placement) | compile-time predicate | itself | exact |
| **MOD (missed by upstream)** `packages/concierge/test/artifact.test.ts` | test (runtime artifact) | file-I/O + dynamic import | its own 11 per-value-export `it` cases | exact |
| **MOD (missed by upstream)** `packages/concierge/test/single-instance.test.ts` | test (runtime, bundler) | file-I/O + dynamic import | its own `F5` case (`:239-268`) | exact |

---

## Files CONTEXT and RESEARCH Missed

Read this section first. Two of the files above are **not** in CONTEXT's or RESEARCH's file list, and one
of them closes a mutant RESEARCH names but never assigns a file to.

### 1. `test/single-instance.test.ts` — mutant **M-05-8** has no home without it

RESEARCH's mutant register lists **M-05-8** (`assertSingleInstance();` deleted from `createBridge`) but the
§"Phase requirements → test map" assigns it to no file. Nothing in `test/bridge.test.ts` can catch it —
`createBridge` behaves identically with the call removed.

The file that *does* catch it already exists and already carries the convention: **one case per production
`assertSingleInstance` call site.** `F4` (`:211-237`) pins `buildCatalog`'s; `F5` (`:239-268`) pins
`createConcierge`'s. Its header states the rule at `:57-61`:

> The guard now has TWO production call sites, not one. Phase 4 ships `createConcierge`, which records this
> copy as well, and the last case in this file, F5, is what makes ITS removal fail something. F4 cannot: it
> drives `buildCatalog` directly, so a `createConcierge` that stopped reaching the guard would leave F4 —
> and every case above it — green.

`createBridge` is the **third** call site, and the first one that is *direct* rather than transitive
(`createConcierge` reaches the guard through `buildCatalog`; `createBridge` reaches nothing). A new **F6**
belongs here.

### 2. `test/artifact.test.ts` — one `it` per value export, all 11 covered today

The file has exactly one `it` per shipped value export (`MESSAGE_MAX_CHARS`, `CONSENT_GRADE_ORDER`, the
frozen-constants case, `CONTRACT_VERSION`, `assertSingleInstance`, `defineAction`, `buildCatalog`,
`CatalogValidationError`, `createConcierge`, `JSON_SCHEMA_TARGET`). Three new value exports means three new
`it` cases, or the convention breaks silently. RESEARCH's Q5 "seven pins" checklist does not include this
file.

### 3. `test/fixtures/probe.ts` — checked, and there is **no** obligation

The probe imports **5 of 11** value exports (`MESSAGE_MAX_CHARS`, `CONTRACT_VERSION`,
`assertSingleInstance`, `defineAction`, `buildCatalog`). It is not a per-export pin; it exists to force
`skipLibCheck: false` resolution of the *shipped* `.d.ts` in a foreign program. Adding `createBridge` there
is discretionary. RESEARCH's Wave-0 note is right that a **sibling fixture module** must not be added to
`test/fixtures/` (the directory is copied into a foreign scratch project by
`scripts/pack-install-check.sh`), which is why the Shape-F factory belongs inline in `test/bridge.test.ts`.

---

## The Export-Surface Numbers — CONTEXT Supersedes RESEARCH

RESEARCH § Q5 computes `+2 values → 64 / 51 / 13`. CONTEXT § "Settled after research" **overrides this**:
the capture function is exported too, so the growth is **+3 values**.

**Live baseline re-measured this session** with the test's own regex against
`packages/concierge/dist/index.d.ts`:

```
blocks 1   names 62   types 51   values 11
values: ["CONSENT_GRADE_ORDER","CONTRACT_VERSION","CatalogValidationError","JSON_SCHEMA_TARGET",
         "MESSAGE_MAX_CHARS","USER_CANCELLED","USER_DECLINED","assertSingleInstance",
         "buildCatalog","createConcierge","defineAction"]
```

| Pin | Location | Current | After Phase 5 (+3 values) |
|---|---|---|---|
| `it` title | `test/export-surface.test.ts:134` | `"is exactly 62 names — …"` | **65** |
| count | `test/export-surface.test.ts:136` | `expect(names).toHaveLength(62)` | **65** |
| `it` title | `test/export-surface.test.ts:139` | `"splits 51 types to 11 values"` | **"splits 51 types to 14 values"** |
| count | `test/export-surface.test.ts:141` | `expect(types).toHaveLength(51)` | **51** (unchanged) |
| count | `test/export-surface.test.ts:142` | `expect(values).toHaveLength(11)` | **14** |
| `it` title | `test/export-surface.test.ts:145` | `"carries all eleven runtime value exports by name"` | **"all fourteen"** |
| `VALUE_EXPORTS` array | `test/export-surface.test.ts:106-122` | 11 entries | **14 entries** |
| header sentence | `test-d/exports.test-d.ts:53-54` | `"…Phase 4 added \`createConcierge\`, bringing the total to six"` | **nine** |
| predicates | `test-d/exports.test-d.ts:79-102` | 6 | **9** |
| shared import line | `test-d/exports.test-d.ts:72` | 6 names | **9 names** |
| per-export `it` | `test/artifact.test.ts:43-150` | 10 cases | **13 cases** |

**Total pins that move: eleven, not seven.**

---

## Pattern Assignments

### `packages/concierge/src/bridge.ts` (factory + utility, event-driven + transform)

**Primary analog:** `packages/concierge/src/concierge.ts` — `createConcierge`

#### Module header pattern (`concierge.ts:1-59`, `catalog.ts:1-57`, `host.ts:1-57`)

Every `src/` module opens with a JSDoc header naming the requirements it implements, then a
`Three constraints whose violation is SILENT` (or equivalent) numbered block, then the standard
no-DOM closing sentence. Copy the closing sentence verbatim, extending the module list:

```typescript
/**
 * Like `./types.ts`, `./contract.ts`, `./json-schema.ts`, `./host.ts` and
 * `./catalog.ts`, this file has no runtime dependency, no framework reference
 * and no DOM access — it must construct on a server under Next App Router,
 * Nuxt or SvelteKit with no environment guards.
 */
```

Section separators are exactly this form (`concierge.ts:75-77`, `:135-137`, `:240-242`;
`catalog.ts:65-67`, `:698-700`):

```typescript
// ---------------------------------------------------------------------------
// Module scope — immutable constants only
// ---------------------------------------------------------------------------
```

#### Imports pattern (`concierge.ts:61-73`)

Value imports first, then `import type`, both sorted by module. `.js` extensions on every specifier.

```typescript
import { buildCatalog, deepFreeze } from "./catalog.js";
import { warnHost } from "./host.js";
import type { Catalog } from "./catalog.js";
import type {
  ActionResult,
  Concierge,
  ConciergeConfig,
  EmittedTool,
  Explanation,
  InvocationMeta,
  StageContext,
  StageExplanation,
} from "./types.js";
```

For `bridge.ts` the analogous block is `./contract.js` (`assertSingleInstance`), `./host.js` (`warnHost`),
and `import type` from `./types.js` (`Bridge`, `BridgeRegistry`, `ActionResult`, `SnapshotNormalizer`) plus
the value `MESSAGE_MAX_CHARS` from `./types.js`. **`./concierge.js` must not appear** — RESEARCH § Recommended
Project Structure: inverting this creates a cycle between the two largest runtime modules.

#### The factory pattern — closure-scoped `let`s, `null` until first use (`concierge.ts:389-411`)

This is the *exact* shape `createBridge` copies:

```typescript
  // The instance's only mutable state. Both are `null` until first use, per
  // header constraint 1 — a server process reuses this module across every
  // request it serves, and these are the two structures that would carry one
  // config's answers into another's if they lived a scope up.
  //
  // …
  let memo: Map<number | null, ReadonlyArray<EmittedTool>> | null = null;
  let warnedStages: Set<string> | null = null;
```

And the header constraint that justifies it (`concierge.ts:17-35`) — the paragraph `createBridge`'s own
header should mirror, including the correction it records:

```typescript
 * **1. The catalog memo is instance-local and lazily allocated, and the reason
 * is cross-request state pollution under SSR.** … Both mutable structures in this
 * file are therefore `let`s inside the factory body, `null` until first use;
 * module scope holds two immutable constants and nothing else.
 *
 * An earlier draft justified the same rule on bundler grounds instead — that a
 * module-scope structure is elided from a consumer build. Re-measured under
 * rolldown 1.2.0, it does **not** reproduce … The rule survived its justification
 * being wrong, which is exactly why the justification is written down rather
 * than assumed.
```

#### The warn-once latch (`concierge.ts:413-438`)

The lazily-allocated `Set` + the house message shape, in one function so the call site is a single
mutation-battery target:

```typescript
  function warnStage(id: string, problem: string, fix: string): false {
    warnedStages ??= new Set<string>();
    if (warnedStages.has(id)) {
      return false;
    }
    warnedStages.add(id);
    warnHost(`concierge: [stage_match] stage "${id}": ${problem} Fix: ${fix}`);
    return false;
  }
```

For `createBridge`, CONTEXT specifies **three distinct warn latches with distinct codes**: register-over-live
(per registry, boolean latch is sufficient — one registry, one id), throwing-snapshot-getter (per key), and
exotic-clone-fallback (per key, *distinct code* from the getter warn). The house message shape is fixed:
`concierge: [code] subject "x": problem Fix: fix`. It is rendered in exactly two other places and both agree
— `catalog.ts:581-586`:

```typescript
function defaultDiagnosticSink(diagnostic: CatalogDiagnostic): void {
  warnHost(
    `concierge: [${diagnostic.code}] action "${diagnostic.action}": ` +
      `${diagnostic.problem} Fix: ${diagnostic.fix}`,
  );
}
```

…and `concierge.ts:173-181` (`duplicateStageIdMessage`), which is behind a **named function** rather than
inline, for a reason the plan should honour (`concierge.ts:145-149`):

> **Behind a named function rather than written inline**, so the call site is one short statement a mutation
> battery can target as a single literal.

#### The `try {} catch {}` with no binding (`concierge.ts:469-473`)

```typescript
    try {
      result = stage.match(ctx);
    } catch {
      return warnStage(stage.id, "its `match(ctx)` threw, so the stage was skipped and its actions are absent from the catalog for this context.", "make `match` total — it runs on every navigation, so it must not assume any field of `ctx` is present.");
    }
```

Note the two properties the plan must reproduce: the catch **binds nothing** (so there is no caught value in
scope to interpolate by accident) and the warn text is fixed prose plus developer-authored identifiers only.
The justification, verbatim at `concierge.ts:450-468`, is worth transplanting into `bridge.ts` because the
same inversion applies:

```typescript
    // **The `catch` takes NO binding, and the message echoes nothing it
    // caught.** This is the same structure as the two guarded calls in
    // `./json-schema.ts` with one decision deliberately INVERTED …
    //
    // With no binding there is no caught value in scope, so the property is
    // structural rather than a matter of remembering not to interpolate it.
```

The second existing instance is the `read()` guard at `concierge.ts:230-235` (reproduced under
`src/concierge.ts` below).

#### The recursive walk — copy the *shape* of `deepFreeze`, not the function (`catalog.ts:671-696`)

```typescript
export function deepFreeze<T>(value: T, skip: ReadonlySet<object>, seen: WeakSet<object>): T {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const target: object = value as object;
  if (skip.has(target) || seen.has(target)) {
    return value;
  }
  seen.add(target);
  Object.freeze(target);

  for (const key of Reflect.ownKeys(target)) {
    const descriptor: PropertyDescriptor | undefined =
      Reflect.getOwnPropertyDescriptor(target, key);
    if (descriptor === undefined) {
      continue;
    }
    if (!("value" in descriptor)) {
      continue;
    }
    deepFreeze(descriptor.value, skip, seen);
  }

  return value;
}
```

Four transferable properties, and one deliberate divergence:

| Property | `deepFreeze` | The Phase 5 clone |
|---|---|---|
| primitive/null early-out | `typeof value !== "object" \|\| value === null` | **same** |
| cycle safety | `seen: WeakSet<object>`, `seen.add` **before** recursing | `seen: WeakMap<object, unknown>`, `seen.set` **before** recursing (needs the produced node, not just "walked") |
| accessor handling | **skips** via `!("value" in descriptor)` — never invokes a getter | **inverted**: the clone reads via `v[k]` (`[[Get]]`) so getters *are* invoked. Invoking them **is** the detachment. |
| explicit local annotations | `const target: object`, `const descriptor: PropertyDescriptor \| undefined` | same — `isolatedDeclarations` + house style |
| no `Object.isFrozen` early-out | documented refusal at `catalog.ts:615-621` | n/a |

`deepFreeze`'s own doc comment (`catalog.ts:665-669`) is the argument for *not* hand-rolling; the reason
Phase 5 hand-rolls anyway is that it needs the opposite accessor behaviour. RESEARCH § Q2 note 1 says to put
that sentence in `bridge.ts`'s header: *the same property, opposite valence.*

`deepFreeze` is **exported from `catalog.ts` but deliberately not barrelled** (`catalog.ts:656-663`) — that
paragraph is the template for how `bridge.ts` documents any internal-but-exported helper, and it names the
mechanism that keeps it off the counted surface.

#### Frozen-return pattern, and the divergence that must be documented (`concierge.ts:681-698`)

`createConcierge` returns **unfrozen**, and says so:

```typescript
  // **The returned object is deliberately NOT frozen**, and this is recorded so
  // a reviewer does not add the freeze silently as a tidy-up.
  //
  // SEC-03 names the action *registry*, which is frozen … The `Concierge` object is
  // not part of that registry: it is the handle the consumer's own code holds,
  // and page script that can reach it can already reach the module that made it. …
  //
  // Deliberately NOT justified by a count of anything. An earlier draft argued
  // the freeze would disturb a mutation battery that depends on a particular
  // number of seals in this file; that argument was arithmetically wrong, and
  // a wrong reason attached to a right decision is how a right decision gets
  // reversed by the first reader who checks it.
  return { dispatch, catalogFor, stageFor, explain };
```

`createBridge` returns **frozen** (CONTEXT, locked). The divergence needs a doc comment pointing back at this
one by name — CONTEXT: *"the divergence gets a doc comment stating why, so nobody 'harmonizes' the two later."*
The seal spelling to copy is the one at `catalog.ts:681` / `concierge.ts:342`, `:344`, `:572`: a bare
`Object.freeze(x)` as its own single-occurrence statement. `concierge.ts:326-333` states why each seal is
spelled separately:

> The seal appears FOUR times in this file, each spelled as its own single-occurrence statement … Each is a
> distinct target for the mutation battery … Four is the number; if a later change makes it a different
> number, this sentence is what has to be corrected with it.

Note for the planner: this sentence lives in `concierge.ts` and counts seals **in `concierge.ts` only**.
Phase 5 does not change that count.

#### `assertSingleInstance()` inside the body (`catalog.ts:823-827`)

The one existing direct call site:

```typescript
export function buildCatalog<const A extends readonly AnyActionDefinition[]>(
  …
) {
  assertSingleInstance();
```

…and the constraint that governs it (`catalog.ts:17-23`, restating `contract.ts:8-18`):

```typescript
 * **1. `assertSingleInstance()` is the first statement of {@link buildCatalog}'s
 * body, and must never be hoisted to module scope.** This package ships
 * `"sideEffects": false`, and 02-06 measured that a module-evaluation-time
 * registration is deleted from the consumer bundle outright — while remaining
 * present under `node dist/index.js`. Hoisted, PKG-04 tests green in Node and
 * does nothing in every React or Svelte app …
```

#### `/* @__PURE__ */` on module-scope initializers (`concierge.ts:97`, `:129`; `types.ts:243`, `:265`)

```typescript
const NO_SKIP: ReadonlySet<object> = /* @__PURE__ */ new Set<object>();

const DISPATCH_NOT_IMPLEMENTED: ActionResult = /* @__PURE__ */ Object.freeze({ … });
```

Applies only if `bridge.ts` declares a module-scope frozen constant. `test/artifact.test.ts:59-81` is the
safety net that exists specifically because a wrong `@__PURE__` drops a freeze silently.

#### The off-page helper — signature and constant source

`isolatedDeclarations` (C4) requires the explicit return annotation. `MESSAGE_MAX_CHARS` is imported from
`./types.js` (the declaration module — the normal intra-package import; RESEARCH § Q6 confirms the
Phase-1 placement guard does not apply to a runtime import inside `src/`):

```typescript
export const MESSAGE_MAX_CHARS = 180;   // src/types.ts:279 — deliberately unannotated
```

The `ActionResult` shape it must produce (`types.ts:103-136`): `ok: boolean`, `reason?: ReasonCode | undefined`,
`message: string`. `"no_bridge"` is `types.ts:187`, already one of the twelve closed members
(`types.ts:173-205`). The existing frozen-result constants at `types.ts:239-243` / `:261-265` are the
precedent for a **narrower-than-`ActionResult`** annotation preserving literals:

```typescript
export const USER_CANCELLED: Readonly<{
  ok: false;
  reason: "cancelled";
  message: string;
}> = /* @__PURE__ */ Object.freeze({ ok: false, reason: "cancelled", message: "Cancelled." });
```

The helper is a *function* rather than a constant (the message is composed), so the annotation is
`: ActionResult`. If the plan wants the literals preserved for a type test, the narrower
`Readonly<{ ok: false; reason: "no_bridge"; message: string }>` form is available and is what the
`USER_CANCELLED` doc comment argues for.

---

### `packages/concierge/src/concierge.ts` (service, request-response) — MODIFY

**Analog:** its own two module-private helpers. `resolveBridge` slots into the
`// Module-private helpers` block (`concierge.ts:135-238`), beside `bridgeStatus`.

#### The exact current `bridgeStatus`, which is the edit target (`concierge.ts:222-238`)

```typescript
function bridgeStatus(
  stage: ConciergeConfig["stages"][number],
): StageExplanation["bridge"] {
  const registry: ConciergeConfig["stages"][number]["bridge"] = stage.bridge;
  if (registry === undefined) {
    return null;
  }

  let live: unknown;
  try {
    live = registry.read();
  } catch {
    live = null;
  }

  return { id: registry.id, registered: live !== null && live !== undefined };
}
```

Three details the planner must carry forward exactly:

1. **The parameter is spelled `ConciergeConfig["stages"][number]`, not `StageDefinition<any>`.** The reason is
   in the doc comment at `concierge.ts:217-220`: *"The `any` already lives in `types.ts`, where D-07's
   measured contravariance reason justifies it; re-spelling it here would be a second, unargued occurrence of
   an erasure that was argued once."* `resolveBridge` must use the same spelling.
2. **`registered` today tests `live !== null && live !== undefined`**, not `live !== null`. RESEARCH's code
   sketch writes `live !== null` — if `resolveBridge` returns `B | null` then the `undefined` arm becomes
   unreachable, which is fine, but the plan should state whether it is dropping the `undefined` test and why
   (a JavaScript consumer's `read()` returning `undefined` is exactly the case it exists for).
3. **The `stage.bridge === undefined` early return must stay in `bridgeStatus`**, before the `resolveBridge`
   call. Mutant **M-05-14** targets this; `types.ts:1432-1452` and
   `test-d/concierge.test-d.ts:141` (`_stageExplanationBridgeShape`) pin the three-state distinction.

#### The "called from exactly one place" convention (`concierge.ts:440-447`, header constraint 3 at `:52-54`)

```typescript
  /**
   * The ONLY place `stage.match` is invoked — header constraint 3.
   *
   * `catalogFor`, `stageFor` and `explain` all reach a matcher through here, so
   * the throw policy, the non-boolean policy and the warn-once latch exist once
   * and cannot drift apart into three readers that disagree about the same
   * context.
   */
```

`resolveBridge` gets the same treatment — RESEARCH's own sketch says *"Phase 6's dispatcher is the second
caller; there must never be a third."*

#### Do NOT touch (`concierge.ts:99-133`, `:578-584`)

`DISPATCH_NOT_IMPLEMENTED` and `dispatch`. CONTEXT § "Integration Points" marks them **do not touch**;
`test/concierge.test.ts:1274-1341` (S27) pins the absence of `reason` and its header records that this was
the one mutant of fifteen that survived Phase 4's battery.

---

### `packages/concierge/src/index.ts` (barrel) — MODIFY

#### Current stale prose — exact text, lines 24-36

```
24	 * Stated plainly so this is not oversold: nothing here dispatches. The
25	 * `dispatch` member exists because the interface requires it and returns a
26	 * not-implemented result; calling it runs no handler. There is no session, no
27	 * transport and no consent prompt in this package today, and bridges are
28	 * declared but not yet constructible. What you get is a validated, frozen,
29	 * correctly scoped description of what an agent would be permitted to do — not
30	 * the thing that lets it do so.
31	 *
32	 * The runtime still to come is `createSession` and `createBridge`. `defineStage`
33	 * is **not planned**: a stage needs no identity mechanism, a plain
34	 * `StageDefinition` object literal already typechecks, and the unforgeable
35	 * bridge identity that would have justified it belongs to `createBridge`. See
36	 * the roadmap in the repository README.
```

Two false clauses: `:27-28` *"bridges are declared but not yet constructible"* and `:32` *"The runtime still
to come is `createSession` and `createBridge`"*. `createSession` alone remains correct (Phase 7). The
`defineStage` sentence at `:32-36` stays true and should be **kept** — CONTEXT cites it (`index.ts:32-36`)
as the reason `createBridge` absorbs `defineStage`'s only justification, and `test-d/concierge.test-d.ts:183`
(`_plainStageLiteral`) is its compiled half.

**This paragraph reaches `dist/index.d.ts` verbatim.** Grep after `pnpm build` (`not yet constructible`,
expecting zero hits).

#### Current export blocks — the insertion points

```typescript
// types block — the barrel's grouped-comment style, one comment per domain
export type {
  …
  // Bridges
  Bridge,
  BridgeRegistry,
  // Stages
  StageContext,
  StageDefinition,
  …
} from "./types.js";                       // :39-92

export type { … } from "./json-schema.js"; // :94-99
export type { … } from "./catalog.js";     // :101-110

// values block — one `export { … } from` statement per source module,
// in dependency order, each on its own line with a blank line between
export {
  USER_CANCELLED,
  USER_DECLINED,
  CONSENT_GRADE_ORDER,
  MESSAGE_MAX_CHARS,
} from "./types.js";                                        // :112-117

export { CONTRACT_VERSION, assertSingleInstance } from "./contract.js";  // :119
export { JSON_SCHEMA_TARGET } from "./json-schema.js";                   // :121
export { buildCatalog, CatalogValidationError } from "./catalog.js";     // :123
export { defineAction } from "./define-action.js";                       // :125
export { createConcierge } from "./concierge.js";                        // :127
```

Phase 5 adds **one new line** in the same register, after `:127`:
`export { createBridge, <captureFn>, <offPageHelper> } from "./bridge.js";`

Placement is load-bearing at the type level: `test-d/exports.test-d.ts` catches a value smuggled into the
`export type { … }` block, and the diagnostic is **TS1485 on the shared import line**, not TS2344 on the
predicate (see below).

---

### `packages/concierge/src/types.ts` (model, doc-comment correction) — MODIFY

Two occurrences. Both ship — grep of the built `dist/index.d.ts` this session confirms
**`:553` and `:1409`**.

#### Occurrence 1 — `types.ts:656-668` (ships at `dist/index.d.ts:553`)

```typescript
/**
 * Detaches a snapshot from the app's reactivity system before it is stored.
 *
 * Required, not optional. Svelte's `$state` returns a Proxy, so a snapshot
 * captured at review time would otherwise be a *live view* that mutates with
 * the app — turning "any drift destroys consent" into "there is never any
 * drift," a gate that passes unconditionally while appearing to work.
 * `structuredClone` is not a fix; it throws `DataCloneError` on proxies.
 *
 * The Svelte adapter fills this with `$state.snapshot`. Frameworks without
 * proxy-based reactivity supply a deep freeze.
 */
export type SnapshotNormalizer = <T>(value: T) => T;
```

The false clause is the **last sentence** (`:665-666`). Everything above it is correct and should survive.

#### Occurrence 2 — `types.ts:1607-1611` (ships at `dist/index.d.ts:1409`)

```typescript
  /**
   * Detaches snapshots from framework reactivity before storage. Supplied by
   * the framework adapter; defaults to a deep freeze.
   */
  normalizeSnapshot?: SnapshotNormalizer;
```

The false clause is `defaults to a deep freeze` (`:1609`).

#### The one sentence RESEARCH says must replace it

> cloning fires only *read* traps (`ownKeys` / `getOwnPropertyDescriptor` / `get`); freezing fires *write*
> traps (`preventExtensions` / `defineProperty`).

#### The precedent for correcting shipped prose in place

`concierge.ts:263-282` and `catalog.ts:635-640` both annotate a correction rather than silently applying it:

```typescript
 * Re-measured this phase, and wider than first recorded: `map`, `slice`, spread,
 * `concat`, `flat`, `toReversed` and `Array.from` all return `false` from
 * `Object.isFrozen` on their result too. … The correction widens what was
 * documented; it does not narrow it.
```

#### Doc-comment style rules in force in this file

- **Do not touch `SnapshotNormalizer`'s function-property vs method syntax.** CONTEXT: `snapshotEquality` must
  stay function-property syntax (Phase 1 D-03) and `DigestLike` is the deliberate opposite. Any new
  snapshot-related type obeys the same rule; the plan must not harmonize them.
- `exactOptionalPropertyTypes` — optional members need explicit `| undefined`
  (`types.ts:111-116` records why: a bare `reason?: ReasonCode` rejects the natural mapper idiom).
- `readonly` goes all the way down or not at all (Phase 4).

---

### `packages/concierge/src/contract.ts` (guard, doc-comment re-scope) — MODIFY

#### Current text — exact, lines 159-163 (ships at `dist/index.d.ts:2028` verbatim)

```
159	 * The **adapter-registration** call site named above is genuinely still to
160	 * come, and stays named as such rather than being quietly folded into the
161	 * sentence above: an adapter can be imported and mounted in a module that never
162	 * builds a catalog, so it needs a call of its own and inherits nothing from
163	 * this one.
```

#### The analog for how to re-scope it — `contract.ts:147-157`, the Phase-4 correction of the adjacent sentence

```
147	 * **`createConcierge` in `./concierge.ts` arrived in Phase 4, and it adds no
148	 * second call here because it reaches this guard transitively.** Assembling a
149	 * catalog is the first thing it does, so `buildCatalog`'s first line — this
150	 * function — runs before anything else in its body. A direct call would satisfy
151	 * the instruction above as well, and would be a documented no-op: the
152	 * same-version adopt path described above returns silently when a second call
153	 * arrives at the same contract version. So the direct call was measured
154	 * unnecessary rather than forgotten, and the sentence that once named
155	 * `createConcierge` as pending was corrected here rather than left to ship —
156	 * this comment reaches `dist/index.d.ts` verbatim, and it went false the moment
157	 * that function landed.
```

Phase 5's edit is the same move, with a different outcome: `createBridge` **is** a direct call site (unlike
`createConcierge`, which is transitive), and it discharges the obligation *only for apps that call
`createBridge` directly*. CONTEXT: **re-scope, do not delete** — add the clause, do not claim the obligation
is closed.

#### The instruction line that also names call sites — `contract.ts:109-113`

```
 * **Call this from the first reachable entry point** — `createConcierge`, and
 * each adapter's registration hook — and never at module scope. See constraint
 * 1 in this file's header: module scope does not survive `"sideEffects": false`,
 * so a registration hoisted out of this body is deleted from every bundled
 * consumer.
```

Check this line too — it names `createConcierge` as an entry point and does not name `createBridge`.

---

### `packages/concierge/test/bridge.test.ts` (test, runtime) — NEW

**Analog:** `packages/concierge/test/concierge.test.ts`

#### Header pattern — "What escapes without this file", numbered, with measured evidence (`concierge.test.ts:1-130`)

```typescript
// `createConcierge`'s behaviour — STG-01, STG-02, STG-03, STG-04, SEC-03,
// DX-01, CAT-03, the matcher policy and the stage-id policy, asserted against
// the BUILT artifact.
//
// What escapes without this file:
//
// Six defects, and every one of them passes a naive test.
//
//   1. A FRESH ARRAY PER CALL. React's `useSyncExternalStore` compares
//      snapshots with `Object.is` — `ReactFiberHooks.js`, … `toBe` is the
//      detector. S7, S8 and S9 are it.
```

The house convention when the obvious mutant does not work (`concierge.test.ts:90-111`) — Phase 5 needs this
for the five non-discriminating orderings:

```typescript
// ---------------------------------------------------------------------------
// Two behaviours have no single-literal mutant — stated rather than faked
// ---------------------------------------------------------------------------
//
// The house convention when the obvious mutant does not work is to write the
// truth into the file rather than invent one (`catalog.test.ts:458-469` is the
// precedent, where the obvious `warnHost(` -> `void (` swap produces a PARSE
// error and the harness reports a vacuous PASS having run zero tests).
```

RESEARCH § "Non-discriminating tests — write them, do not count them" lists **O1, O3, O5, O6, O7**. The
precedent for labelling them is `export-surface.test.ts`'s Trap 2 (`:31-46`):

```typescript
// Trap 2 — `ReadbackAttestation` is recorded here and deliberately NOT asserted
// …
// So it is written down here instead of being written as an assertion. The two
// real names above are asserted; this third one is not, because there is
// nothing for it to prove.
```

#### Imports + artifact guard (`concierge.test.ts:308-345`) — copy exactly

```typescript
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);

// Bound in `beforeAll` rather than imported statically. A static
// `import { createConcierge } from "../dist/index.js"` would fail with an opaque
// module-resolution error on a fresh checkout, BEFORE the existence guard below
// could produce the sentence that tells a developer to run `pnpm build`. Left
// unannotated on purpose: a dynamic import yields untyped bindings, and
// annotating them would be a claim this file has no program to check.
let createConcierge;
let CatalogValidationError;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      `packages/concierge/dist/index.js is missing. These tests run against the ` +
        `BUILT artifact, not the source. Run \`pnpm build\` first.`,
    );
  }

  const artifact = await import(DIST_URL.href);
  createConcierge = artifact.createConcierge;
  CatalogValidationError = artifact.CatalogValidationError;
});
```

#### The contract-registry reset — REQUIRED, and easy to miss (`concierge.test.ts:318-323`, `:347-352`)

`createBridge` calls `assertSingleInstance()`, so `test/bridge.test.ts` needs this too:

```typescript
// Hard-coded, not imported, for the same reason `single-instance.test.ts:44-53`
// hard-codes it: the registry key is a cross-realm contract between two copies
// of this package that share no bindings, so its identity is the STRING and
// nothing else. Importing the symbol from the artifact under test would make
// this suite agree with whatever the artifact happens to say.
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");

// `delete`, not assignment to `undefined` — the same reset, and the same
// reasoning, as `single-instance.test.ts:68-82`. `assertSingleInstance`
// branches on `prior === undefined`, so the slot must be genuinely absent.
beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});
```

#### `describe` = requirement id, `it` = case id + claim (`concierge.test.ts:416-417`)

```typescript
describe("STG-01 — the catalog carries this stage's actions plus cross-stage, and nothing else", () => {
  it("S1 — the results stage is offered its own two actions plus signOut, and confirmBooking is ABSENT", () => {
```

Case ids are file-scoped and sequential (`S1`…`S27` in `concierge.test.ts`, `F1a`…`F5` in
`single-instance.test.ts`). Phase 5 picks its own prefix; **do not continue `S`** — the numbering is
per-file, and the Phase 4 file already owns `S1`–`S27`.

#### Console capture — the exact idiom, no Vitest mocking API (`concierge.test.ts:1054-1095`)

```typescript
    // Four notes, each load-bearing, carried forward from
    // `catalog.test.ts:454-471`:
    //
    //   - This is a PLAIN GLOBAL ASSIGNMENT, never the Vitest mocking API
    //     (`spyOn`, `fn`, `mock`). A grep for that API's namespace prefix over
    //     `test/` returns 0 across every file today and must still return 0
    //     afterwards — which is also why this note spells the prefix out in
    //     prose rather than writing it …
    //   - The real console is SPREAD rather than replaced wholesale, so an
    //     unrelated `console.error` from Vitest itself does not become
    //     "undefined is not a function" while the stand-in is installed.
    //   - Restoration happens in a `finally`, never after the assertions. A
    //     throwing expectation would otherwise leave a stand-in console
    //     installed for every later case in this file.
    //   - No cast ceremony is needed for the assignment even though `console`
    //     is not type-visible inside core under `lib: ["ES2022"]`: this file is
    //     in NO TypeScript program (see the header, and `vitest.config.ts`).
    const realConsole = globalThis.console;
    const captured: string[] = [];
    const sink = (message: string) => {
      captured.push(String(message));
    };

    globalThis.console = { ...realConsole, warn: sink, error: sink, log: sink };

    try {
      concierge.explain({ pathname: "/results" });
      concierge.explain({ pathname: "/nowhere" });
    } finally {
      globalThis.console = realConsole;
    }

    expect(captured).toHaveLength(0);
```

**Verified this session:** a grep for the Vitest mocking namespace over `packages/concierge/test/` returns
zero non-comment hits. The `warn`-only variant (used when the claim is "warns once") is at
`concierge.test.ts:1115-1132`.

#### The warn-once assertion triad (`concierge.test.ts:1140-1161`) — reuse verbatim for the register-over-live case

```typescript
    // `toHaveLength(1)`, never `toBeGreaterThan(0)`. Three calls, ONE warning:
    // the latch is per stage id per instance … Without the latch this prints
    // on every navigation forever, and a warning that prints forever is a
    // warning nobody reads.
    expect(captured).toHaveLength(1);

    // Two expectations, two claims: that the sink FIRED at all, and that what
    // it emitted carried the STAGE'S IDENTITY. A warning that fired with an
    // aggregated summary line satisfies the first and loses exactly the name a
    // developer needs.
    expect(captured[0]).toContain("boom");

    // The executable form of the security decision, and without it the
    // `catch`-with-no-binding is a convention with no guarantee. …
    expect(captured[0]).not.toContain("SECRET-FROM-THE-APP");
```

The secret-token fixture shape is `concierge.test.ts:1106`: `throw new Error("SECRET-FROM-THE-APP")`.
Phase 5's throwing snapshot getter uses the same shape (RESEARCH § Pattern 2 measured
`new Error("SECRET user@example.com")`); assert the token does **not** appear in any captured warning.

#### Hand-rolled bridge fixture — already exists, and is the shape to extend (`concierge.test.ts:950-988`, S20)

```typescript
  it("S20 — the bridge field reports declared-and-unmounted, declared-and-mounted, and not declared", () => {
    // A HAND-ROLLED `BridgeRegistry`, and no Phase 5 code. `id` and `read()`
    // are both on the exported interface TODAY, so this object is exactly what
    // that interface admits — which is also why nothing about this case changes
    // when `createBridge` ships. …
    let mounted = null;
    const registry = {
      id: "results",
      read: () => mounted,
      register: () => () => {},
    };
    …
    expect(concierge.explain({ pathname: "/x" }).stages[0].bridge).toEqual({
      id: "results",
      registered: false,
    });
    expect(concierge.explain({ pathname: "/x" }).stages[1].bridge).toBe(null);
```

**S20 must keep passing after Phase 5's `resolveBridge` redirect.** It is the existing regression detector for
`bridgeStatus`'s three states and is the reason the `stage.bridge === undefined` early return cannot move.
Phase 5's own BRG-03 cases use a **real** `createBridge(...)` registry through the same `explain()` observable.

#### Declaration helpers (`concierge.test.ts:358-414`) — reuse

```typescript
function noopHandler() { return { ok: true }; }

function declare(name: string, schema: unknown, extra: Record<string, unknown> = {}) {
  return { name, description: `the ${name} action`, schema, handler: noopHandler, redact: "drop", ...extra };
}

// `bridge` is omitted rather than set to `undefined` when absent, so that
// "declares no bridge" is an absent key exactly as a consumer would write it …
function stage(id: string, match: unknown, actions: unknown[], bridge?: unknown) {
  return bridge === undefined ? { id, match, actions } : { id, match, actions, bridge };
}
```

`redact: "drop"` on every declaration is mandatory here and the reason is at `concierge.test.ts:366-374`:
a missing `redact` on a non-empty schema throws `redaction_missing` during `buildCatalog`.
Zod fixtures come from `./fixtures/schemas.js` (`zodObject`, `zodEmptyObject`).

#### The Shape-F fixture goes INLINE in this file

RESEARCH § Wave 0: not in `test/fixtures/` — `scripts/pack-install-check.sh` copies that directory into a
foreign scratch project and a sibling module would be pulled into it by accident. Verified: `probe.ts`'s own
header states it *"is never compiled by this repository."*

---

### `packages/concierge/test-d/bridge.test-d.ts` (test, type-level) — NEW

**Analog:** `packages/concierge/test-d/concierge.test-d.ts`

#### Header — "WHAT ESCAPES WITHOUT THIS FILE" + the terse-output caveat (`concierge.test-d.ts:1-96`)

```typescript
// Phase 4's type-level half — SEC-03, DX-01, STG-03 and STG-04 as claims that can go
// red. Everything pinned below is invisible to `test/`, and that is why this file
// exists rather than being folded into the runtime suite.
//
// WHAT ESCAPES WITHOUT THIS FILE
// …
// THE TERSE-OUTPUT CAVEAT, AND HOW A MUTANT AGAINST THIS FILE MUST BE ASSERTED
//
// Measured non-TTY, which is what CI sees … A failing `Expect<…>` prints exactly
// `Type 'false' does not satisfy the constraint 'true'.` and **no alias name** …
// Assert a mutant against this file on its **exit code** (`tsc` exits **1**, not 2,
// under typescript 7.0.2) plus `file:line`. Never grep the output for a
// predicate's name; it will never match, and a grep that never matches reads as a
// passing check.
//
// HOUSE RULES THIS FILE INHERITS
//
// **Nothing below is exported.** `isolatedDeclarations` demands an explicit annotation
// on anything reaching the declaration surface, and non-exported locals are exempt …
//
// **Every predicate is on ONE line however long**, because `tsc` echoes only the line
// the failing type argument sits on. Do not let a formatter wrap them.
//
// **Zero suppression directives.**
```

#### Imports (`concierge.test-d.ts:98-115`) — note the barrel-vs-module split

```typescript
import type { Equals, Expect } from "./_assert.js";
import type {
  Concierge,
  ConciergeConfig,
  …
} from "../src/types.js";
// The value import is from the BARREL, deliberately — `../src/index.js`, never
// `../src/concierge.js`. The point of pinning `createConcierge`'s signature is that the
// PUBLIC entrypoint carries the callable value at that signature …
import { createConcierge } from "../src/index.js";
```

`bridge.test-d.ts` imports `createBridge` (and the two other new values) from `../src/index.js`, **not**
`../src/bridge.js`, for exactly this reason.

#### The four assertion aliases (`test-d/_assert.ts:18-38`) — the entire mechanism

```typescript
export type Expect<T extends true> = T;

export type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;

export type Assignable<From, To> = [From] extends [To] ? true : false;

export type Not<T extends boolean> = T extends true ? false : true;
```

Rules from the same file's header (`:1-14`): predicates, **never** `@ts-expect-error` (reserved for
object-literal freshness only); name every alias after the invariant it guards; the `Equals` formulation
must not be "simplified" to the naive bidirectional form.

#### `Equals` vs `Assignable` — the choice IS the assertion (`concierge.test-d.ts:147`)

```typescript
/** `Equals`, not `Assignable`, per `actions.test-d.ts:469-476`: an `Assignable` spelling "stays true when the field is widened to `unknown`, to a bare function type, or to a union that swallows the declared type — which is exactly the silent-widening regression worth guarding". … */
type _conciergeExplainSignature = Expect<Equals<Concierge["explain"], (ctx: StageContext) => Explanation>>;
```

The signature pin to copy for `createBridge` (`concierge.test-d.ts:150-151`):

```typescript
/** `createConcierge`'s signature is pinned HERE, not in `exports.test-d.ts` — that file's predicates are deliberately loose (`(...args: never[]) => unknown`) because they guard export PLACEMENT only … This one predicate also covers "did not silently gain a `const` type parameter", measured rather than assumed … */
type _createConciergeSignature = Expect<Equals<typeof createConcierge, (config: ConciergeConfig) => Concierge>>;
```

#### Ready-made bridge fixtures — reuse, do not re-declare (`actions.test-d.ts:415-445`)

```typescript
/** The canonical example, verbatim in shape from the project's own description. */
type ResultsBridge = Bridge<{ applyFilter: (key: string, value: string) => void }, { visibleCount: () => number }>;

/** A second bridge sharing nothing with the first — different verbs, different snapshot. */
type CartBridge = Bridge<{ removeItem: (id: string) => void }, { total: () => number }>;

/** CR-02's direct detector: a bridge with real members satisfies its own constraint. Under the old defaults this is `false`. */
type _realBridgeSatisfiesConstraint = Expect<Assignable<ResultsBridge, Bridge>>;

/**
 * The registry half of WR-03 …
 * `read` returns `ResultsBridge | null`, and the `| null` is the entire representation of
 * "no component has registered" … Measured before this line existed: `read: () => B | null` →
 * `() => B` escaped the full four-file suite at exit 0.
 */
type _registryReadIsNullable = Expect<Equals<BridgeRegistry<ResultsBridge>["read"], () => ResultsBridge | null>>;

declare const resultsRegistry: BridgeRegistry<ResultsBridge>;
declare const cartRegistry: BridgeRegistry<CartBridge>;

/** A stage at a concrete bridge type, carrying its own registry. TS2344 under the old defaults. */
const _resultsStage: StageDefinition<ResultsBridge> = { id: "results", match: () => true, actions: [], bridge: resultsRegistry };
```

`_registryReadIsNullable` already discriminates mutant **P-05-3** and **must not be duplicated** in
`bridge.test-d.ts` — RESEARCH's test map marks it "✅ exists". What *is* new: a predicate that
`createBridge("x")` produces a `BridgeRegistry<B>` (i.e. `Equals<ReturnType<typeof createBridge<ResultsBridge>>,
BridgeRegistry<ResultsBridge>>`) and one pinning the off-page helper's `(what: string, where: string) => ActionResult`
shape (CONTEXT settles the two-string form so the predicate is stable).

Do **not** add a `MESSAGE_MAX_CHARS` predicate here importing from `types.js` — RESEARCH § Q6: that recreates
the blind guard `STATE.md` warns about.

#### Annotations only where the annotation IS the claim (`concierge.test-d.ts:81-88`, `:183`)

```typescript
/** A plain object literal at `StageDefinition`, annotated because the annotation IS the claim — `actions.test-d.ts:442` records the same finding for its own two stage literals. … */
const _plainStageLiteral: StageDefinition = { id: "results", match: _m1, actions: [] };
```

And the dead-local guard (`concierge.test-d.ts:189-190`):

```typescript
/** `_m2` and `_m3` are otherwise unread, and an unread local is one refactor away from being deleted as dead. Reading them here ties them to a value, so the four shapes travel together. */
const _stg03ShapesAreLive: boolean = _m2({ modal: "checkout", cartCount: 3 }) || _m3({ modal: "x" }) || _extraKeysAreAccepted;
```

---

### `packages/concierge/test/export-surface.test.ts` (test, artifact audit) — MODIFY

#### Exact current pinned numbers and array — verbatim, lines 101-161

```typescript
// The third `it` title below states this list's LENGTH and its assertion is a
// `for…of` loop carrying no number at all. So a reviewer checking "does the
// title match the assertion beneath it" structurally cannot catch a stale
// number there — the only thing it can be checked against is this array. Grow
// one, reread the other.
const VALUE_EXPORTS = [
  "USER_CANCELLED",
  "USER_DECLINED",
  "CONSENT_GRADE_ORDER",
  "MESSAGE_MAX_CHARS",
  "CONTRACT_VERSION",
  "assertSingleInstance",
  "JSON_SCHEMA_TARGET",
  "defineAction",
  "buildCatalog",
  // A class is both a value and a type. It must appear here, in the VALUE half
  // of the parsed surface, with no `type ` prefix — if it were ever re-exported
  // through the `export type { … }` block the parser would file it under types
  // and `new CatalogValidationError(…)` would be unreachable for a consumer.
  "CatalogValidationError",
  "createConcierge",
];

beforeAll(() => {
  if (!existsSync(DTS_PATH)) {
    throw new Error(
      `packages/concierge/dist/index.d.ts is missing. This guard reads the ` +
        `BUILT declaration file, not the source. Run \`pnpm build\` first.`,
    );
  }
});

describe("the published export surface of dist/index.d.ts", () => {
  it("is exactly 62 names — an export added or dropped by a build-config change lands here", () => {
    const { names } = readSurface();
    expect(names).toHaveLength(62);
  });

  it("splits 51 types to 11 values", () => {
    const { types, values } = readSurface();
    expect(types).toHaveLength(51);
    expect(values).toHaveLength(11);
  });

  it("carries all eleven runtime value exports by name", () => {
    const { values } = readSurface();
    for (const name of VALUE_EXPORTS) {
      expect(values).toContain(name);
    }
  });

  it("does not publish serverChallengeBrand or ConsentAckBase", () => {
    const { names } = readSurface();
    expect(names).not.toContain("serverChallengeBrand");
    expect(names).not.toContain("ConsentAckBase");
  });
});
```

The array is in **source order**, not the alphabetized order the parser produces. The assertion is
`toContain` per entry, so order does not matter to the test — but the three counts do. New entries append in
source order: `createBridge`, then the capture function, then the off-page helper (matching the order they
appear in the new `export { … } from "./bridge.js";` line).

`readSurface()` (`:74-99`) and the `EXPORT_BLOCK` regex (`:59`) do not change.

---

### `packages/concierge/test-d/exports.test-d.ts` (test, type-level placement) — MODIFY

#### The header sentence to update — exact text, lines 51-61

```
51	// EVERY PREDICATE BELOW INHERITS THE TS1485-AT-THE-IMPORT-LINE BEHAVIOUR
52	//
53	// Phase 3 added four more runtime values to the entrypoint and each one gets a
54	// predicate here; Phase 4 added `createConcierge`, bringing the total to six.
55	// They all fail the same way the original does, and it is worth restating
56	// because the failure is counter-intuitive at six names as much as at one: move
57	// `buildCatalog` into `index.ts`'s `export type { … }` block and the diagnostic
58	// is TS1485 on the single shared IMPORT line below, naming `buildCatalog` — not
59	// TS2344 on the predicate line named after it. The import is shared, so the
60	// line number is identical whichever of the six regressed. Read the NAME in the
61	// message, not the line.
```

**Three numbers move, not one:** "the total to six" (`:54`), "counter-intuitive at six names" (`:56`), and
"whichever of the six regressed" (`:60`). With +3 values the total is **nine**.

#### The shared import line — exact text, line 72

```typescript
import { MESSAGE_MAX_CHARS, JSON_SCHEMA_TARGET, defineAction, buildCatalog, CatalogValidationError, createConcierge } from "../src/index.js";   // ← index.js. NOT types.js. This is the whole point.
```

The trailing comment is load-bearing; keep it. The line must stay on ONE line (`:47-49`).

#### The six current predicates, verbatim (lines 78-102)

```typescript
/** MESSAGE_MAX_CHARS reaches the public entrypoint as a VALUE, not only as a type. */
type _messageBoundExportedAsValue = Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>;

/** JSON_SCHEMA_TARGET reaches the public entrypoint as a VALUE, still at its literal type. */
type _jsonSchemaTargetExportedAsValue = Expect<Equals<typeof JSON_SCHEMA_TARGET, "draft-2020-12">>;

/** defineAction reaches the public entrypoint as a callable VALUE, not only as a type. */
type _defineActionExportedAsValue = Expect<Assignable<typeof defineAction, (...args: never[]) => unknown>>;

/** buildCatalog reaches the public entrypoint as a callable VALUE, not only as a type. */
type _buildCatalogExportedAsValue = Expect<Assignable<typeof buildCatalog, (...args: never[]) => unknown>>;

/** CatalogValidationError is a class — a value AND a type. This pins the VALUE half: it stays constructible. */
type _catalogValidationErrorExportedAsValue = Expect<Assignable<typeof CatalogValidationError, new (...args: never[]) => Error>>;

// --------------------------------------------------------------------------
// Phase 4 — the one value this phase adds to the entrypoint
// --------------------------------------------------------------------------

/** createConcierge reaches the public entrypoint as a callable VALUE, not only as a type. */
type _createConciergeExportedAsValue = Expect<Assignable<typeof createConcierge, (...args: never[]) => unknown>>;
```

Phase 5's three predicates copy the `_createConciergeExportedAsValue` form exactly, under a new banner:

```typescript
// --------------------------------------------------------------------------
// Phase 5 — the three values this phase adds to the entrypoint
// --------------------------------------------------------------------------
```

**Deliberately loose** (`:63-69`): `(...args: never[]) => unknown` asserts only "this is a function value".
Tightening here duplicates `bridge.test-d.ts` and makes the file fail for reasons unrelated to placement.

---

### `packages/concierge/test/artifact.test.ts` (test, runtime artifact) — MODIFY *(not in upstream list)*

**Analog:** its own `createConcierge` case (`:129-139`) — copy the shape three times.

```typescript
  it("createConcierge reaches dist/index.js as a callable function", async () => {
    const m = await import(DIST_URL.href);

    // The entire stage-scoping surface is behind this one binding — per-stage
    // catalogs, the referential-identity guarantee `useSyncExternalStore`
    // depends on, and `explain()`. Lost to the `export type { … }` block, a
    // consumer's `createConcierge(config)` throws
    // `TypeError: createConcierge is not a function` at their module scope,
    // which reads as "the package is broken" rather than "one export moved".
    expect(typeof m.createConcierge).toBe("function");
  });
```

Each case's comment names **what specifically is lost** and **how the failure reads to a consumer**. For
`createBridge` the loss is: every registry becomes unconstructible, every stage's `bridge` is permanently
absent, and the symptom is `bridge: null` forever on a page that is definitely open — which CONTEXT calls
"the single most undebuggable failure in the design."

Each case re-imports `DIST_URL.href` inside the `it` rather than hoisting the namespace. Keep that.

---

### `packages/concierge/test/single-instance.test.ts` (test, runtime + bundler) — MODIFY *(not in upstream list)*

**Analog:** `F5` (`:239-268`) — the same case shape, one query-string bump.

```typescript
  it("F5 — createConcierge records this copy too, so the guard's second production call site is asserted", async () => {
    // Its own query string, unique to this case. Every case that needs a fresh
    // module evaluation must use one nothing else in this file uses: two cases
    // sharing a specifier share Node's cached namespace, so the second would
    // skip module scope entirely and its "empty after import" half would be
    // asserting against state the first case left behind. …
    const { assertSingleInstance, createConcierge, CONTRACT_VERSION } = await import(
      `${DIST_HREF}?sc6=1`
    );

    // Half one — EMPTY immediately after evaluation, and this half is a check in
    // its own right rather than setup: it is what catches a guard smuggled up to
    // module scope, the form `sideEffects: false` licenses a bundler to delete.
    // `assertSingleInstance` is destructured above and deliberately NOT called —
    // importing a binding is not invoking it, and calling it here would populate
    // the registry itself and make half two pass no matter what the factory does.
    expect(typeof createConcierge).toBe("function");
    expect(registry[KEY]).toBeUndefined();

    // The production path, at its minimum. …
    createConcierge({ stages: [] });

    // Half two — POPULATED afterwards, through the same global record F1a and F4
    // assert on. No spy: the observable already exists and reports exactly this.
    expect(registry[KEY]).toEqual({ version: CONTRACT_VERSION });
  });
```

For **F6**: query string `?sc7=1` (unique — `?sc5=1` and `?sc6=1` are taken), production path
`createBridge("results")`, no config needed. And the file's header sentence at `:57-71` — "The guard now has
TWO production call sites, not one" — must move to **three**, adding the note that `createBridge`'s is the
first **direct** one (`createConcierge`'s is transitive, and `:61-71` says so explicitly and warns a reader
against "restoring" a direct call that does not exist).

The reset (`:111-118`) and `registry` binding already exist in the file.

---

## Shared Patterns

### Warn-once through `warnHost` — the only sanctioned `globalThis` read
**Source:** `packages/concierge/src/host.ts:93-96`
**Apply to:** `src/bridge.ts` (three latches)

```typescript
export function warnHost(message: string): void {
  const host: { console?: ConsoleLike } = globalThis as { console?: ConsoleLike };
  host.console?.warn(message);
}
```

The three conventions `host.ts:29-37` says any second seam must keep — module-private minimal view type, cast
**inside a function body**, capability optional at runtime — are the rule if `bridge.ts` ever needs its own.
It should not: CONTEXT § "Settled after research" puts the SSR `typeof window` guard out of scope precisely
because it would need one.

### House message shape
**Source:** `packages/concierge/src/concierge.ts:173-181` and `packages/concierge/src/catalog.ts:581-586`
**Apply to:** every `warnHost` call in `src/bridge.ts`

```
concierge: [code] subject "x": problem Fix: fix
```

Two renderers already agree; a third shape makes the warn channel unparseable.

### `try {} catch {}` with no binding, message echoes nothing caught
**Source:** `packages/concierge/src/concierge.ts:469-473` (`runMatch`), `:230-235` (`bridgeStatus`)
**Apply to:** `register`, the capture loop (**around the normalizer call, not just the getter**), the
`Date`/`Map`/`Set` clone branch, `resolveBridge`

```typescript
  let live: unknown;
  try {
    live = registry.read();
  } catch {
    live = null;
  }
```

The inverted precedent is `json-schema.ts:259-261`, which *does* render the caught value because it is a
build-time diagnostic. `concierge.ts:450-468` writes out why the runtime case is the opposite in all three
respects that matter. Keep that inversion documented, or a later reader "fixes" the inconsistency.

### `isolatedDeclarations` — explicit annotation on every export
**Source:** the whole of `src/`; the canonical statements are `contract.ts:41-51` and `define-action.ts:203-211`
**Apply to:** every export in `src/bridge.ts`

`createBridge` must be annotated `: BridgeRegistry<B>`; the off-page helper `: ActionResult`. Note the
counter-rule from `contract.ts:44-51`: an annotation that *discards a literal* (e.g. `: number` on
`MESSAGE_MAX_CHARS`) is the form that loses something. Local `const`s inside function bodies are also
annotated by house style (`concierge.ts:285`, `:310`, `:346`, `:377`; `catalog.ts:676`, `:684`).

### Test-file header: "What escapes without this file", with measured evidence
**Source:** `test/concierge.test.ts:1-130`, `test/export-surface.test.ts:1-46`, `test/artifact.test.ts:1-24`,
`test-d/concierge.test-d.ts:1-96`, `test-d/exports.test-d.ts:1-69`
**Apply to:** both new test files

Every file states the defect that escapes, the measurement that proves it escapes, and — where the obvious
mutant does not work — writes the truth down instead of faking one.

### Mutation battery contract
**Source:** `scripts/mutate-and-prove.sh:1-70`
**Apply to:** every mutant in RESEARCH's register

```
Usage: scripts/mutate-and-prove.sh <target-file> <literal-pattern> <replacement> -- <gate command...>

  0  PASS  — the gate exited non-zero (the mutant was caught) and the tree is clean
  1  FAIL  — the gate exited 0 (the mutant escaped)
  2  ABORT — the target is unusable: not tracked, already dirty, or not supplied
  3  ABORT — the substitution was a no-op (the pattern never matched)
  4  ABORT — the target file was not restored
```

Two limitations the plan must honour:
- **Known limitation 2** — a mutant that breaks the BUILD produces a PASS having run zero tests. The **caller**
  confirms from the gate's output that the mutant compiled and tests ran.
- **Known limitation 3** — count occurrences **unfiltered, comments included**. `src/bridge.ts` will be heavily
  commented, and short patterns like `slot = null` will occur in prose.

### Build-then-audit for shipped prose
**Source:** the pattern behind plan 03-08; the observable is `test/export-surface.test.ts` + `test/artifact.test.ts`
**Apply to:** all three doc-comment corrections

Correct `src/`, run `pnpm build`, then grep `dist/index.d.ts` for `deep freeze` and `not yet constructible`
expecting **zero** hits. Confirmed present today at `dist/index.d.ts:553` and `:1409`; the
`not yet constructible` clause is in the `index.ts` header region of the same file. The defect is defined by
what ships, not by what is in `src/`.

### Command sequence
**Source:** `package.json` (root), `packages/concierge/package.json`

```
pnpm build      # tsdown — MUST precede pnpm test; test/*.test.ts read ../dist/
pnpm test       # vitest run — project "node", include packages/*/test/**/*.test.ts
pnpm typecheck  # tsc -p packages/concierge/tsconfig.test-d.json (src + test-d)
```

Plus the four phase-gate checks: `pnpm check:deps`, `check:artifact`, `check:pack`, `check:node-floor`.
`pnpm test -- bridge` filters by filename.

---

## No Analog Found

None. Every file has at least a role-match analog in this package.

Two *sub-behaviours* inside `src/bridge.ts` are genuinely new and have no analog to copy — RESEARCH says the
same ("the genuinely new code is exactly three things"):

| Behaviour | Why no analog | Nearest guidance |
|---|---|---|
| The structural **clone** walk | `deepFreeze` is the only recursive walk in the package and it deliberately does the opposite thing with accessors | Copy `deepFreeze`'s skeleton (early-out, `seen` before recursion, explicit local annotations) and invert the accessor branch. Detection predicates are specified and measured in RESEARCH § Q1. |
| The **monotonic-token closure** | No existing closure holds an identity-guarded slot | `.planning/research/ARCHITECTURE.md:279-289` carries the verbatim mechanism; `createConcierge`'s `let … = null` discipline is the house wrapper for it. |

---

## Metadata

**Analog search scope:** `packages/concierge/src/` (8 files), `packages/concierge/test/` (7 files +
2 fixtures), `packages/concierge/test-d/` (10 files), `scripts/` (4), root configs (5), built
`packages/concierge/dist/index.d.ts`
**Files scanned:** 29 TypeScript sources, 5 configs, 1 shell script, 1 built declaration file
**Live measurements taken this session:** export surface parsed from `dist/index.d.ts` with the test's own
regex (62 / 51 / 11, one block); `deep freeze` located at `dist/index.d.ts:553` and `:1409`; Vitest mocking
API grep over `test/` returned zero non-comment hits
**Pattern extraction date:** 2026-07-31
