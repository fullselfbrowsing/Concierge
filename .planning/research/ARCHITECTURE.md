# Architecture Research

**Domain:** Framework-agnostic TypeScript SDK — client-side agent actuation with a consent kernel
**Researched:** 2026-07-27
**Confidence:** HIGH (library claims verified by reading published source; Svelte/React/Vue/Angular/Solid semantics verified against official docs)

> **Scope note.** The six-point design contract in `README.md` and the type surface in
> `packages/concierge/src/types.ts` are inputs, not open questions. This document
> pressure-tests them, fills the gaps, and calls out four places where the existing
> type surface is wrong. See [§9 Type surface defects](#9-type-surface-defects-read-this-first).

---

## 1. Standard Architecture

### The shape every successful framework-agnostic library converges on

Five libraries were read at the source level. All five are the same three-layer shape,
and they differ only in **where they put the seam** and **how much they left in core**.

```
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER 3 — FRAMEWORK ADAPTERS (thin, one per framework)              │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐             │
│  │  react    │ │   vue     │ │  svelte   │ │  angular  │  ...        │
│  │  useEffect│ │ onMounted │ │  $effect  │ │ DestroyRef│             │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘             │
│        │             │             │             │                   │
│        └─────────────┴──────┬──────┴─────────────┘                   │
│                    THE SEAM │  (one narrow contract)                 │
├─────────────────────────────┼────────────────────────────────────────┤
│  LAYER 2 — CORE RUNTIME     ▼  (all the load-bearing logic)          │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │  plain classes / closures · zero framework · zero DOM       │      │
│  └────────────────────────────────────────────────────────────┘      │
├──────────────────────────────────────────────────────────────────────┤
│  LAYER 1 — PLATFORM / VENDOR SEAMS (injected, never imported)        │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                          │
│  │ transport │ │  storage  │ │ scheduler │                          │
│  └───────────┘ └───────────┘ └───────────┘                          │
└──────────────────────────────────────────────────────────────────────┘
```

### Measured evidence — where each library put the seam, and what it cost

All LOC figures below were counted from published npm tarballs on 2026-07-27.

| Library | Core LOC / deps | The seam (verbatim) | Adapter LOC (react / vue / svelte / solid) |
|---|---|---|---|
| **TanStack Query** v5.101.4 | `query-core` 7,277 LOC, **zero runtime deps** | `Subscribable` base class — `subscribe(listener) => () => void` + `Observer.getCurrentResult()` | 2,098 / — / 1,217 / 1,660 (whole package; per-primitive `createBaseQuery` = **107**) |
| **Better Auth** v1.6.25 | `better-auth` core; server seam is `handler: (Request) => Promise<Response>` | Client: a **nanostores atom**. Server: **one fetch handler**. | **65 / 58 / 17 / 42** |
| **Zag.js** v1.42.0 | `@zag-js/core` — but depends on `@zag-js/dom-query` (**core is NOT DOM-free**) | `machine` spec + `connect(state, send, normalizeProps)` — the *adapter runs the machine* | **617 / 598 / 491 / 686** |
| **Floating UI** v1.8.0 | `@floating-ui/core` — pure math, `@floating-ui/utils` only | **`Platform` interface** (`getElementRects`, `getClippingRect`, `getDimensions`, …) injected by `@floating-ui/dom` | n/a (layered `core → dom → react`, not parallel adapters) |
| **Tiptap** v3.29.1 | `@tiptap/core` — peer-deps `@tiptap/pm` (ProseMirror), **requires a DOM element** | `Editor` instance = event emitter; adapter subscribes | react / vue-3 only — **no official Svelte adapter exists** |

### What this table actually says

**1. The ~150 LOC adapter budget is achievable, and Better Auth is the proof.**
Its Svelte adapter is **17 lines**. Its React adapter is 65 (21 + a 44-line `useStore`).
The reason: the seam is a *value with a `subscribe` method*, and every framework already
knows how to consume one of those. Better Auth wrote almost nothing framework-specific.

**2. Zag.js is the cautionary tale, and it is 4× over budget.**
Its adapters are 491–686 LOC because `@zag-js/core` publishes a machine *spec* and makes
each adapter **run the machine** — `machine.svelte.js` is 264 LOC, `machine.js` (react) is
286, `machine.js` (vue) is 287. That is the same interpreter written four times.
The rule this yields: **if any adapter contains a loop, a scheduler, or a state
transition, logic has leaked out of core.** Zag also proves that a "core" can quietly
acquire a DOM dependency (`@zag-js/dom-query`) — the exact thing `CONTRIBUTING.md`
forbids.

**3. `query-core` having *zero runtime dependencies* is the model to copy.**
`npm view @tanstack/query-core dependencies` returns nothing. That is why it drops
unchanged into Node, Deno, Workers, and React Native. Concierge's "core is
dependency-free" constraint is the same bet and it is the right one.

**4. Floating UI's `Platform` interface is the pattern for any environment coupling.**
Core never imports the DOM; it accepts an object of ~10 functions. This is the escape
hatch to reach for if Concierge ever needs `window`/`crypto`/timers in core — inject,
never import.

### Concierge's architecture, placed on this map

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  APP CODE                                                                     │
│  defineAction(...) · defineStage(...) · createConcierge(...)                   │
│  useRegisterBridge(resultsBridge, { actions, snapshot })       ← in component  │
└───────────────┬──────────────────────────────────────────┬───────────────────┘
                │ (build time, pure)                       │ (mount time)
┌───────────────▼──────────────────────────────────────────▼───────────────────┐
│  ADAPTERS  @concierge-react · -vue · -svelte · -angular · -solid              │
│  ─ get instance into scope (context / provide / setContext / DI token)       │
│  ─ register on mount, identity-guarded unregister on unmount                 │
│  ─ NOTHING ELSE.  Target ≤150 LOC.  "use client" banner (React).             │
└───────────────┬───────────────────────────────────────────┬──────────────────┘
        WRITE-SIDE SEAM                              READ-SIDE SEAM (v0.3)
        register(bridge) => unsub                    subscribe/getSnapshot
┌───────────────▼───────────────────────────────────────────▼──────────────────┐
│  CORE  @fullselfbrowsing/concierge   (zero deps · zero DOM · zero framework)  │
│                                                                               │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │
│   │ catalog      │  │ bridge       │  │ dispatcher   │  │ consent kernel │   │
│   │ · defineX    │  │ registry     │  │ · NOT async  │  │ · userTurn bind│   │
│   │ · buildCatalog│ │ · id-guarded │  │ · dedup by   │  │ · snapshot eq  │   │
│   │ · JSON Schema│  │   unsub      │  │   reference  │  │ · minGrade gate│   │
│   │ · redaction  │  │ · read()→|null│ │ · commit win │  │ · fail closed  │   │
│   └──────────────┘  └──────────────┘  └──────────────┘  └────────────────┘   │
│   ┌───────────────────────────────────────────────────────────────────────┐  │
│   │ SESSION / RUNTIME   ← ★ MISSING FROM THE CURRENT TYPE SURFACE ★        │  │
│   │ owns current stage · pushes catalog to transport · routes batches      │  │
│   │ back into dispatch · returns result envelopes · re-pushes on reconnect │  │
│   └───────────────────────────────────────────────────────────────────────┘  │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ Transport (the ONLY vendor-shaped seam)
┌───────────────▼──────────────────────────────────────────────────────────────┐
│  TRANSPORTS  realtime(WebRTC) · mcp(stdio/SSE) · text-sidebar · palette · test│
└───────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Owns | Must NOT | Typical implementation |
|---|---|---|---|
| **catalog** | `defineAction`/`defineStage`, name-union derivation, JSON Schema emission + root-`type:"object"` validation, redaction-required check, `consent.requires` resolvability | Read a bridge. Touch a transport. Allocate mutable state. | Pure functions + one `buildCatalog` that throws naming the offending action |
| **bridge registry** | `read() => B \| null`, `register(b) => identity-guarded unsub` | Know about stages, actions, or frameworks. Be reactive. | ~40 LOC closure over a single slot + a monotonic token |
| **dispatcher** | Non-async `dispatch`, dedup by reference identity, serial batch execution by `outputIndex`, commit window, handler-exception containment | Be `async`. Throw. Let a handler message reach telemetry unredacted. | Closure + `Map<string, Promise<ActionResult>>` |
| **consent kernel** | Arm-on-delivery, `userTurnId` binding, snapshot equality, `minGrade` build-time gate | Trust `responseId`. Arm on tool return. Degrade silently. | Closure + `Map<actionName, ConsentAck>` with TTL |
| **session/runtime** ★ | Current stage, `transport.setTools` push, `onToolBatch` → `dispatch` → `respond` loop, re-push on reconnect | Exist in v0.1's type surface — **it currently does not** | ~120 LOC class |
| **adapters** | Instance-into-scope; register/unregister with identity guard | Contain a loop, a scheduler, or a state transition | ≤150 LOC each |
| **transport** | Vendor wire format, connection lifecycle, `capabilities` declaration | Know what an action *means*. See a bridge. | One per vendor, outside core |
| **server handlers** | `Request → Response`; ephemeral token minting, MCP/SSE endpoint, redacted-telemetry sink | Import a framework. Assume Node. | One fetch handler + ≤20 LOC per-framework shims |

---

## 2. The getter-snapshot contract: **CONFIRMED**, with one framework-specific hazard

The question: is `snapshot: Record<string, () => T>` genuinely idiomatic across React refs,
Vue refs, Svelte 5 runes, Angular signals, and Solid?

**Verdict: yes — and in three of the five it is not merely compatible, it is the framework's
own native type.** This is the strongest part of the existing design.

| Framework | Native reactive read | Getter form | Compatibility | Evidence |
|---|---|---|---|---|
| **Solid** | `const [get, set] = createSignal()` | `get` **is already** `() => T` | ✅ **Identity** — `export type Accessor<T> = () => T` is verbatim in `solid-js/types/reactive/signal.d.ts:104` | read from published tarball |
| **Angular** | `count = signal(0)` | `count` **is already** `() => T` | ✅ **Identity** — "Signals are getter functions - calling them reads their value" | [angular.dev/guide/signals](https://angular.dev/guide/signals) |
| **Svelte 5** | `let x = $state(...)` | `() => x` | ✅ **The compiler tells you to do this.** Docs: *"Pass getter functions instead. Rather than `add(count)`, use `add(() => count)`."* Compiler warning `state_referenced_locally`: *"This reference only captures the initial value of `%name%`. Did you mean to reference it inside a %type% instead?"* | [svelte.dev/docs/svelte/$state](https://svelte.dev/docs/svelte/$state), [compiler-warnings](https://svelte.dev/docs/svelte/compiler-warnings) |
| **Vue 3** | `const r = ref(x)` | `() => r.value` | ✅ **First-class.** `toValue<T>(source: T \| Ref<T> \| (() => T)): T` and `MaybeRefOrGetter<T>` exist precisely to normalize this. `toRef(() => props.foo)` is "recommended in 3.3+". | [vuejs.org/api/reactivity-utilities](https://vuejs.org/api/reactivity-utilities.html) |
| **React** | `useState` / `useRef` | `() => ref.current` | ⚠️ **Works with refs; silently broken with state.** See below. | [react.dev](https://react.dev/reference/react/useRef) |

### Independent corroboration: TanStack Svelte Query v6 shipped this exact contract

The strongest evidence is not a doc, it is a shipped API. `@tanstack/svelte-query@6.1.38`'s
public signature is:

```ts
// x_tanstack-svelte-query-6.1.38/package/src/types.ts:21
export type Accessor<T> = () => T

// src/createBaseQuery.svelte.ts:25
options: Accessor<CreateBaseQueryOptions<...>>,
```

TanStack rewrote its Svelte adapter for Svelte 5 and the migration was **from stores to
getter functions**. Their internal `watchChanges` helper (`src/utils.svelte.ts:16`) is typed
`type Getter<T> = () => T`. Zag's Svelte adapter does the same — `track.svelte.js` has
`const access = (value) => typeof value === "function" ? value() : value`.

Concierge's `snapshot: Record<string, () => T>` is the convergent answer. Do not change it.

### Where it breaks down #1 — React `useState` (the real trap)

```tsx
// 🔴 BROKEN — closes over the render-time value; goes stale on the very next render
const [filtered, setFiltered] = useState([]);
useRegisterBridge(resultsBridge, { snapshot: { getFiltered: () => filtered } });

// ✅ CORRECT — ref is a stable box, `.current` is read at call time
const filteredRef = useRef(filtered);
filteredRef.current = filtered;                    // during render is fine for a mirror ref
useRegisterBridge(resultsBridge, { snapshot: { getFiltered: () => filteredRef.current } });
```

React is the **only** framework in the table where a syntactically identical getter is
semantically wrong. Svelte/Vue/Solid/Angular getters read through a live reactive cell;
React's read through a captured closure binding.

**Architectural consequence:** the React adapter must ship a `useBridgeSnapshot` (or
`useLatest`) helper that boxes values into refs, and the docs must lead with it. This is
one of the few places the React adapter legitimately earns lines. Budget ~25 LOC.
Without it, the single most portable idea in the library is also its most common bug —
and it is a *silent* bug, because a stale snapshot produces a confidently wrong readback,
which `CONTRIBUTING.md` correctly identifies as "the worst failure this library can produce."

### Where it breaks down #2 — Svelte 5 `$state` returns a **Proxy**, and consent touches it

This is the finding the brief specifically asked for, and it is real.

`$state` on an array or plain object produces a **deeply reactive state proxy**. The Svelte
docs: *"State is proxified recursively until Svelte finds something other than an array or
simple object."* So a Svelte snapshot getter returns a Proxy, not a plain object.

That is harmless for reads. It is **not** harmless for the consent kernel:

- **`structuredClone` throws `DataCloneError` on a Proxy.** This is the HTML spec behaviour,
  not a Svelte bug, and it has broken real libraries — see
  [sveltejs/svelte#12438](https://github.com/sveltejs/svelte/issues/12438),
  [#13562](https://github.com/sveltejs/svelte/issues/13562),
  [#15327 (IndexedDB)](https://github.com/sveltejs/svelte/issues/15327),
  [superforms#300](https://github.com/ciscoheat/sveltekit-superforms/issues/300).
  The prescribed fix is `$state.snapshot(value)` before cloning.
- **Reference identity is unreliable across the proxy boundary.** `proxy !== target`. Any
  `snapshotEquality` implemented with `===`, `Object.is`, or a `WeakMap` keyed on the object
  will behave differently on Svelte than on React.
- **`ConsentAck.snapshot` is stored at review time and compared at confirm time.** If the
  stored value is a live proxy, it is not a snapshot at all — it *mutates with the app*,
  and the entire "any drift destroys the consent" guarantee silently evaporates. **This is
  a security defect, not a compatibility annoyance.**

**Required design change** (see §9-G). Core must deep-freeze a plain structural copy at
review time. Because core cannot import `$state.snapshot`, the normalization must be a
seam the adapter fills — Floating UI's `Platform` pattern applied at micro-scale:

```ts
// core/types.ts — new
export interface SnapshotNormalizer {
  /** Return a plain, detached, framework-free copy. MUST NOT return a live proxy. */
  normalize: <T>(value: T) => T;
}
// core default: structural JSON-ish deep copy that tolerates proxies (never structuredClone)
// svelte adapter supplies: { normalize: (v) => $state.snapshot(v) }
```

### Where it breaks down #3 — Angular, mildly

Angular signals are perfect getters, but reading a signal **inside a reactive context**
registers a dependency. Concierge handlers call snapshot getters from a *non*-reactive
context (a dispatch callback), so no dependency is created — correct behaviour, and
`untracked()` is available if a caller ever needs to be explicit. No blocker. The real
Angular cost is elsewhere (lifecycle, §3).

### Where it breaks down #4 — none of them, for `actions`

`Bridge.actions: Record<string, (...args) => unknown>` is plain imperative functions.
That is universally portable with zero caveats. Worth noting because it means **all the
portability risk is concentrated in `snapshot`**, which is a good place for it to be.

---

## 3. Registration lifecycle — the actual failure modes

The identity guard is correctly identified as non-negotiable. Here is precisely what it is
guarding against, per framework, so the tests can be written against real sequences.

### React StrictMode — verified

React docs, verbatim: *"When Strict Mode is on, React will also run **one extra
setup+cleanup cycle in development for every Effect**"* and *"By running setup → cleanup →
setup instead of setup…"*. Callback refs get the same treatment. **Development only** —
*"All of these checks are development-only and do not impact the production build."*
([react.dev/reference/react/StrictMode](https://react.dev/reference/react/StrictMode))

The dangerous sequence is not the documented one — it is the **interleaved** one across two
components, or a fast unmount/remount:

```
t0  A.setup   → register(bridgeA) → slot = {token: 1, bridge: A}
t1  A.cleanup → unsub_1()          → NAIVE: slot = null
t2  A.setup   → register(bridgeA') → slot = {token: 2, bridge: A'}
─── later, a *stale* unsub_1 reference fires (dev tooling, double cleanup, race) ───
t3  unsub_1() → NAIVE: slot = null  ← A' is now unregistered; bridge reads null forever;
                                       every handler returns "Open the results page first."
```

The guard:

```ts
export function createBridgeRegistry<B extends Bridge>(id: string): BridgeRegistry<B> {
  let slot: { token: number; bridge: B } | null = null;
  let next = 0;
  return {
    id,
    read: () => slot?.bridge ?? null,
    register(bridge) {
      const token = ++next;
      slot = { token, bridge };
      return () => { if (slot?.token === token) slot = null; };   // ← the whole trick
    },
  };
}
```

Note the guard must key on a **monotonic token, not on the bridge object**. Keying on the
bridge (`if (slot?.bridge === bridge) slot = null`) fails when a component re-registers an
object that is `===` the previous one (memoized bridge literal, Svelte reused `$state`
object), because the stale cleanup then matches the *live* registration.

### Vue — two distinct hazards

1. **`setup()` runs on the server; `onMounted` does not.** Vue docs, verbatim: *"lifecycle
   hooks such as `mounted` / `onMounted` or `updated` / `onUpdated` will **NOT** be called
   during SSR… The only hooks that are called during SSR are `beforeCreate` and `created`."*
   ([vuejs.org SSR](https://vuejs.org/guide/scaling-up/ssr.html)) → **register inside
   `onMounted` or an `effectScope`, never in `setup()` body.**
2. **HMR replaces a component without a guaranteed unmount-before-mount order.** Vite's Vue
   HMR can mount the new instance before the old one's teardown flushes. Without the token
   guard the new registration is wiped by the old cleanup, and the page appears to lose all
   its actions until a full reload — the classic "works after F5" bug.

Use `onScopeDispose` rather than `onUnmounted` so the adapter also works inside a bare
`effectScope` (composable used outside a component). Vue docs describe it as *"a
non-component-coupled replacement of `onUnmounted` in reusable composition functions."*

### Svelte 5 — three hazards

1. **`$effect` does not run during SSR.** Register inside `$effect`, return the unsub as the
   cleanup. This is the direct analogue of `useEffect` and behaves correctly.
2. **`$effect` re-runs when any read dependency changes.** If the adapter reads
   `bridge.snapshot` *inside* the effect while building the registration object, every state
   change re-runs the effect → unregister/re-register storm. **The adapter must register the
   getter object, never invoke the getters.** `untrack()` around the registration body is the
   safe belt-and-braces move (TanStack's `watchChanges` does exactly this —
   `const cleanup = untrack(() => effect(values, previousValues))`).
3. **Any module containing a rune must be named `.svelte.ts` / `.svelte.js`.** Non-negotiable
   compiler requirement. This bleeds into packaging — see §5.

### Angular — different shape entirely

Angular has no effect-with-cleanup mount hook in the React sense. The idiomatic registration is:

```ts
// inside an injection context (field initializer or constructor)
private readonly destroyRef = inject(DestroyRef);
constructor() {
  const unsub = resultsBridge.register({ actions, snapshot: { getFiltered: this.filtered } });
  this.destroyRef.onDestroy(unsub);        // ← guaranteed once, no double-invoke
}
```

`DestroyRef.onDestroy` is *"the standard mechanism for registering teardown logic tied to an
injector's lifetime"* and is callable from any injection context — component, directive,
service, or pipe ([angular.dev/api/core/DestroyRef](https://angular.dev/api/core/DestroyRef)).
Angular 20.1+ adds `destroyRef.destroyed` so the adapter can refuse a late registration.

Angular is the **only** target with no double-invoke development mode, which means an
Angular-only implementation would never surface the identity-guard bug. That is an argument
for *not* choosing Angular as the v0.1 non-React adapter (§8).

Also note: Angular has real DI scoping, so `providedIn: 'root'` vs component-provided
changes the instance lifetime. The adapter should expose a `CONCIERGE` `InjectionToken`, not
a module singleton, so multi-instance and testing work.

### Solid

`onCleanup` inside `createEffect` / owner scope. No double-invoke, no HMR remount subtlety
of consequence. Cheapest adapter to write; also the least informative.

### The invariant to write down and enforce

> **Bridge registration is client-only, and always happens inside a post-mount effect.**

Enforce it, don't document it: in dev builds, `register()` warns when
`typeof window === "undefined"`. Under SSR in Node the registry is a **process-global module
singleton shared across every request** (§4), so a server-side registration is a
cross-request state-pollution bug waiting to happen.

---

## 4. SSR — what actually breaks

Core "constructs on the server without guards" is necessary but **not sufficient**. Five
distinct things break, only one of which is about `window`.

### 4.1 Module-scope singletons leak across requests — the severe one

`README.md` shows the canonical usage as `export const concierge = createConcierge({...})`
at module scope. In a long-lived Node server that object is created **once at boot and
reused for every request**.

Vue's docs name and define this precisely: *"the application modules are typically
initialized only once on the server, when the server boots up. The same module instances
will be reused across multiple server requests… If we mutate the shared singleton state with
data specific to one user, it can be accidentally leaked to a request from another user. We
call this **cross-request state pollution**."*
([vuejs.org SSR](https://vuejs.org/guide/scaling-up/ssr.html))

It is not theoretical. TanStack Router shipped exactly this bug:
[a singleton `getRouter()` leaked `router.state.redirect` across requests, so one bot request
made every subsequent GET return a 307 until the process restarted](https://github.com/TanStack/router/issues/6924).

**The rule for Concierge core:** module-scope construction is fine **only** if the constructed
object is *inert on the server*. Concretely:

- ✅ `stages`, `crossStage`, compiled JSON Schemas, redaction policies — immutable, safe to share.
- 🔴 dedup `Map`, commit-window timers, consent `Map`, devtools event buffer — mutable, must
  be **lazily created on first `dispatch`** and never allocated during module evaluation or
  during `catalogFor()`.
- 🔴 `BridgeRegistry` slot — mutable and process-global. Safe only under the §3 invariant.

Make this a test: import core, construct a `Concierge`, assert `catalogFor(ctx)` twice, and
assert no mutable maps/timers were allocated. That test is cheap and it is the difference
between "SSR-safe" and "SSR-safe until someone adds telemetry."

### 4.2 `"use client"` — put it on adapters, never on core

Next App Router requires the directive *"at the top of the file, before any imports"*
([nextjs.org use-client](https://nextjs.org/docs/app/api-reference/directives/use-client)).

TanStack's exact strategy, verified by grepping the published build:

- `@tanstack/react-query` **source** contains **zero** `"use client"` strings.
- The **built** output has it injected per-module: `QueryClientProvider.js`,
  `HydrationBoundary.js`, `IsRestoringProvider.js`, `QueryErrorResetBoundary.js` each carry it.
- `build/modern/index.js` — the **barrel — has none**.

Copy this exactly. Consequence: `@fullselfbrowsing/concierge` (core) never carries the
directive, so a React Server Component can legally
`import { buildCatalog } from "@fullselfbrowsing/concierge"` to render an agent prompt
server-side. Only `@fullselfbrowsing/concierge-react`'s hook modules carry it. Inject at
build time via a bundler banner; do not hand-write it (it is load-bearing and easy to drop).

### 4.3 The read-side `useSyncExternalStore` trap (bites at v0.3, decided at v0.1)

If devtools or any "current stage" display ever needs to *render* Concierge state in React,
`useSyncExternalStore` is the only correct primitive, and it has two hard requirements that
constrain **core's** API today:

- *"The store snapshot returned by `getSnapshot` must be immutable… Otherwise, return a
  cached last snapshot."* Violating it produces the error **"The result of `getSnapshot`
  should be cached"** and an infinite render loop.
  → **`catalogFor(ctx)` must return a memoized, frozen array per stage, not a fresh array
  per call.** Catalogs are pure functions of static config, so memoize at `buildCatalog`
  time and hand out the same reference forever. Decide this now; retrofitting it after
  someone depends on fresh arrays is a breaking change.
- *"If you omit this argument [`getServerSnapshot`], rendering the component on the server
  will throw an error."*
  → Any future read-side hook must ship a `getServerSnapshot` returning a **frozen empty
  catalog** — the same value on server and on first client render.

([react.dev/reference/react/useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore))

### 4.4 Per-framework specifics

| Framework | What runs on the server | Registration safe? | Gotcha |
|---|---|---|---|
| **Next App Router** | Server Components; Client Components pre-render but `useEffect` does not run | ✅ | Module singletons shared across requests (4.1). `"use client"` on adapter only. Beware the `react-server` export condition if core ever gains a React import — it must not. |
| **Nuxt / Nitro** | `setup()` runs; `onMounted`/`onScopeDispose` do not | ✅ if in `onMounted` | Same cross-request pollution; Vue docs prescribe a per-request factory. Nuxt's `useState` exists for exactly this. |
| **SvelteKit** | Component bodies and `.svelte.ts` module scope run; `$effect` does not | ✅ if in `$effect` | `$state` declared at module scope in a `.svelte.ts` file becomes **per-process, not per-request**. Keep the bridge registry in a plain `.ts` file with a plain `Map` — no runes. |
| **Remix / React Router** | Loaders + component render; no effects | ✅ | Nothing special. |
| **Astro islands** | Island shell only | ✅ | `client:only` avoids the whole class of problems. |

### 4.5 How the reference libraries stay SSR-safe

- **TanStack Query** — `query-core` is inert; observers only start on `subscribe()`, which
  only happens in an effect. Hydration is a first-class, explicit `HydrationBoundary`.
- **Better Auth** — the server surface is the *product*; framework integrations take
  `building` explicitly and short-circuit (`svelteKitHandler({auth, event, resolve, building})`).
- **Tiptap** — **does not** stay SSR-safe. Its `Editor` needs a DOM node, so it ships an
  `immediatelyRender: false` opt-out and throws *"SSR has been detected, please set
  `immediatelyRender` explicitly to `false` to avoid hydration mismatches"*
  ([ueberdosis/tiptap#5856](https://github.com/ueberdosis/tiptap/issues/5856)). This is the
  outcome Concierge's no-DOM-in-core rule exists to avoid: a permanent, documented footgun
  in every SSR integration guide.

---

## 5. Packaging: the constraint nobody budgets for

Shipping a Svelte adapter is materially different from shipping a React one, and it changes
the build pipeline. Verified from published packages:

**Svelte packages ship *source*, not compiled JS.** `@zag-js/svelte`'s build script is
`svelte-package -i src` and its exports map is:

```json
{ ".": { "types": "./dist/index.d.ts", "svelte": "./dist/index.js" } }
```

`@tanstack/svelte-query` is the same shape:

```json
{ ".": { "types": "./dist/index.d.ts", "svelte": "./dist/index.js", "import": "./dist/index.js" } }
```

`svelte-package` *preprocesses* — it transpiles TS to JS and leaves Svelte/rune syntax intact
for the consumer's compiler. The **`"svelte"` export condition is mandatory**: it is how
Svelte-aware tooling knows to run the file through the compiler
([svelte.dev/docs/kit/packaging](https://svelte.dev/docs/kit/packaging)).

**Build-order implications:**

1. The monorepo needs **two** build toolchains from day one — `tsc`/`tsup` for
   core + React + server, and `svelte-package` for the Svelte adapter. Discovering this in
   v0.2 means reworking CI, release, and the exports story mid-flight.
2. Any Svelte adapter file containing a rune must be `.svelte.ts`. Plan the filenames now.
3. The Svelte adapter needs `svelte` as a **peer** dep (`>=5`), and a `.d.ts` emitted
   alongside — `svelte-package` handles it, `tsc` alone does not.
4. Core's exports map must stay simple (`types` + `default`) so it resolves identically under
   Node, bundler, Deno, and Workers. It already does.

This is the second-strongest argument for making Svelte the v0.1 non-React adapter: it forces
the packaging pipeline to be honest while the repo is still four files.

---

## 6. Fetch-standard server handlers

### The pattern, extracted from Better Auth's published source

**One core primitive:** `handler: (request: Request) => Promise<Response>`.
Every framework integration is a shim, and the LOC counts are the proof
(counted from `better-auth@1.6.25`'s `dist/integrations/`):

| Integration | LOC | Body |
|---|---|---|
| `node` | **13** | `toNodeHandler(handler)` → `(req,res) => setResponse(res, await handler(getRequest({base, request:req})))` |
| `solid-start` | 15 | trivial re-export |
| `svelte-kit` | 57 | `toSvelteKitHandler(auth) => (event) => auth.handler(event.request)` + a `hooks.server.ts` helper + a cookie plugin |
| `tanstack-start` | 57 | same shape |
| `next-js` | 91 | `toNextJsHandler(auth) => ({GET:h, POST:h, PATCH:h, PUT:h, DELETE:h})` + an RSC cookie-write workaround |

The three genuinely load-bearing lines, verbatim from `dist/integrations/`:

```js
// node.mjs
const toNodeHandler = (auth) =>
  "handler" in auth ? toNodeHandler$1(auth.handler) : toNodeHandler$1(auth);

// next-js.mjs
function toNextJsHandler(auth) {
  const handler = async (request) => "handler" in auth ? auth.handler(request) : auth(request);
  return { GET: handler, POST: handler, PATCH: handler, PUT: handler, DELETE: handler };
}

// svelte-kit.mjs
const toSvelteKitHandler = (auth) => (event) => auth.handler(event.request);
```

### `toNodeHandler` — the only non-trivial adapter, and why

Node is the **only** target that does not speak `Request`/`Response`. Hono's docs make the
same split: it *"runs unchanged on Bun, Deno, Cloudflare Workers…"* but *"Node.js does not
natively implement Web Standards Request and Response APIs… Therefore, Node.js requires an
external translation package"* — hence the separate `@hono/node-server`
([hono.dev/docs/concepts/web-standard](https://hono.dev/docs/concepts/web-standard)).

Better Auth delegates to `better-call/node`, whose implementation is:

```js
function toNodeHandler(handler) {
  return async (req, res) =>
    setResponse(res, await handler(getRequest({
      base: `${req.headers["x-forwarded-proto"] || (req.socket.encrypted ? "https" : "http")}://${req.headers[":authority"] || req.headers.host}`,
      request: req,
    })));
}
```

`getRequest`/`setResponse` are SvelteKit's Node-adapter primitives (~80 LOC: stream the
body in, stream the response out, translate headers both ways, handle HTTP/2 `:authority`).
Note the proto/host reconstruction — behind a proxy, `x-forwarded-proto` is the only way to
get the URL right, and getting it wrong breaks cookie `Secure` and OAuth redirects.

**Recommendation:** vendor those ~80 LOC into `@fullselfbrowsing/concierge-server/node`
rather than taking a dependency. It is stable, small, and a dependency here would contradict
the dependency-free posture for the sake of one entry point.

### Recommended `@fullselfbrowsing/concierge-server` surface

```
@fullselfbrowsing/concierge-server            → createHandler(cx, opts): (Request) => Promise<Response>
@fullselfbrowsing/concierge-server/node       → toNodeHandler(h)         (~90 LOC incl. vendored marshalling)
@fullselfbrowsing/concierge-server/next       → toNextHandler(h)         (~10 LOC)
@fullselfbrowsing/concierge-server/sveltekit  → toSvelteKitHandler(h) + conciergeHandler({building,…})  (~25)
```

Bun / Deno / Workers / Hono / Remix / Nuxt need **no package** — document one line each:

```ts
export default { fetch: handler };                                   // Bun / Deno / Workers
app.all("/api/concierge/*", (c) => handler(c.req.raw));              // Hono
export const action = ({ request }) => handler(request);             // Remix
export default defineEventHandler((e) => handler(toWebRequest(e)));  // Nuxt / Nitro
```

### What a Concierge server handler is *for*

Not obvious, and worth stating in the roadmap because it determines whether this is a v0.2
or a v0.4 concern. Four jobs:

1. **Ephemeral Realtime token minting** — so the browser never holds a provider API key.
   This is the one that unblocks the Realtime transport, and it is a hard prerequisite for
   v0.4, not a nice-to-have.
2. **MCP / SSE transport endpoint** — server-driven agents reaching a client catalog.
3. **Redacted telemetry sink** — the consuming end of `RedactionPolicy`.
4. **Catalog serving** — `catalogFor(ctx)` as JSON for a server-side agent loop. Free,
   because core is already SSR-safe.

Jobs 1 and 4 are cheap and unblock other work; 2 and 3 are their own designs. Consider
splitting: token minting + catalog JSON in v0.2, MCP/SSE in v0.4.

---

## 7. Transport abstraction — Concierge's seam is at the right altitude

Three real transport abstractions were read at the type level. They sit at three different
altitudes and only two of them are actually vendor-neutral.

| | MCP SDK `Transport` | OpenAI `RealtimeTransportLayer` | **Concierge `Transport`** |
|---|---|---|---|
| **Altitude** | Message envelope (JSON-RPC bytes) | Vendor protocol | **Semantic (tools / calls / results)** |
| **Surface** | `start` `send` `close` `onmessage` `onerror` `onclose` `sessionId` | `connect` `sendEvent` `sendAudio` `sendMessage` `addImage` `mute` `interrupt` `updateSessionConfig` `sendFunctionCallOutput` `requestResponse` `resetHistory` `sendMcpResponse` | `capabilities` `setTools` `onToolBatch` `respond` |
| **Neutral?** | ✅ stdio / SSE / Streamable HTTP all implement it | 🔴 **No** — leaks `RealtimeClientMessage`, `RealtimeSessionConfig`, `response.create`, audio | ✅ in principle |
| **Lesson** | Neutrality comes from one universal payload type | Abstracts WebRTC-vs-WebSocket **for one vendor** — not a transport abstraction at all | Right altitude, **incomplete surface** |

The derived rule: **abstract at the altitude where the vocabulary is genuinely universal,
and push everything else into an explicit `capabilities` object.** MCP found it at the
envelope; Concierge found it at the tool call. OpenAI's `RealtimeTransportLayer` is the
anti-pattern — it is what `README.md` §6 means by "welding the library to one vendor's wire
protocol," and reading its `.d.ts` is the clearest possible argument for the existing design.

`TransportCapabilities { consentGrade, parallelCalls, dynamicCatalog }` is a genuinely good
idea and better than anything in the two comparators. Keep it.

### Three additions needed before it survives WebRTC + SSE + stdio

**1. Connection lifecycle.** A WebRTC data channel is not writable until `open`; SSE
reconnects and loses server-side state; stdio is ready immediately. Today `setTools` is
fire-and-forget with no notion of readiness, so **a stage change during connection setup
silently drops the catalog** and the agent apologises that it can't do anything — the exact
failure mode `README.md` describes for the `oneOf` bug, arriving by a different road.

```ts
readonly status: "idle" | "connecting" | "connected" | "closed";
onStatusChange: (cb: (s: TransportStatus) => void) => () => void;
```

The session must buffer the last catalog and re-push on every `connected` transition.
Keeping `setTools` returning `void` is correct — it must be *idempotent and replayable*,
not awaited. (MCP `tools/list_changed` is a notification followed by a client-initiated
pull; Realtime `session.update` is a push; a palette is a local render. All three are
satisfied by "idempotent, replayable, fire-and-forget.")

**2. A turn envelope on `onToolBatch`.** See §9-B — this is the defect that breaks consent.

**3. An error channel on `respond`.** If the transport died between dispatch and result,
core is left awaiting a promise nobody will settle. `respond` should be able to signal
failure so the session can abandon the batch and clear the dedup entry.

### Sanity check: does the interface actually cover the four target transports?

| Transport | `setTools` | `onToolBatch` | `respond` | `consentGrade` |
|---|---|---|---|---|
| OpenAI Realtime (WebRTC) | `session.update` | `response.done` → `function_call` items, ordered by `output_index` | `conversation.item.create` (`function_call_output`) | `perceived` (audio playback completion is observable) |
| Text sidebar (SSE/HTTP) | prompt-embedded or `tools` param | parse assistant tool calls | append tool result message | `delivered` |
| MCP (stdio / Streamable HTTP) | `tools/list` + `notifications/tools/list_changed` | `tools/call` (one at a time) | `CallToolResult` | `none` — **and this is the point**: an MCP-driven action with `minGrade: "perceived"` must refuse to build |
| Command palette / E2E | render a list | user selection / test script | display / assert | `perceived` (palette) or `none` (test) |

The interface covers all four. `outputIndex` on `ToolCall` is Realtime-shaped but maps
cleanly (MCP always sends 0; palette always 0). Fine.

One naming note: `EmittedTool { type: "function", name, description, parameters }` is the
OpenAI Realtime/Responses shape. Chat Completions nests under `function: {}`; MCP uses
`inputSchema` not `parameters`. It is the transport's job to reshape, so this is not a
correctness problem — but the type is doing double duty as "Concierge's neutral catalog
entry" and "OpenAI's tool object," and the name should reflect the former.

---

## 8. Build order and component boundaries

### Dependency DAG

```
L0  types.ts ─────────────────────────────────────────────┐  (exists, compiles clean)
    schema.ts    Standard Schema validate + JSON Schema    │
    subscribable.ts   30 LOC, TanStack-shaped, free now    │
                          │                                │
L1  defineAction / defineStage      createBridgeRegistry ──┤  ← independent, testable alone
    buildCatalog  (root type:"object" · redaction required │
                   · consent.requires resolvable · unique) │
                          │                                │
L2  dispatch  (NOT async · dedup by reference · commit     │
               window · serial by outputIndex · errors     │
               contained)          matchStage(ctx)         │
                          │                                │
L3  createConcierge ──── ★ createSession(cx, transport) ★ ──┘  ← THE MISSING COMPONENT
                          │
L4  ┌─────────────────────┼─────────────────────┐
    concierge-react   concierge-svelte      example app
    (useEffect)       ($effect,             (exercises BOTH,
     "use client"      svelte-package)       in one repo, in CI)
                          │
L5  consent kernel ──── requires the turn envelope from §9-B, shipped in v0.1
    concierge-server (fetch handler + /node + /next + /sveltekit)
L6  devtools (needs Subscribable from L0 + session events)
L7  realtime transport (needs server token minting from L5) · mcp executor
```

### The one structural addition: `createSession`

The type surface has `catalogFor(ctx)` producing tools and `Transport.setTools` consuming
them — **and nothing connecting them.** Nothing owns "which stage are we in," nothing
subscribes `onToolBatch`, nothing calls `respond`, nothing re-pushes on reconnect. The
dispatcher can't own it (it must stay transport-agnostic and non-async); the transport can't
own it (it must stay catalog-agnostic).

```ts
export interface ConciergeSession {
  /** Recompute stage, and push the catalog if it changed. Idempotent. */
  setContext: (ctx: StageContext) => void;
  readonly stage: string | null;
  onStageChange: (cb: (stage: string | null) => void) => () => void;
  /** Abandon in-flight batches; unsubscribe from the transport. */
  close: () => void;
}
export function createSession(cx: Concierge, transport: Transport): ConciergeSession;
```

This is the component that makes `parallelCalls: false` and `dynamicCatalog: false` mean
something, that owns the reconnect re-push, and that devtools attaches to in v0.3. Roughly
120 LOC. **Build it in v0.1** — every later phase assumes it exists, and retrofitting it
means changing the `Transport` contract after transports have shipped.

### Why the non-React adapter must be **Svelte 5**

The README already commits to shipping one with v0.1; the choice matters:

| Candidate | Forces React-isms out? | Packaging honesty | Finds real bugs |
|---|---|---|---|
| **Svelte 5** ✅ | Partly — `$effect` is `useEffect`-shaped | **Highest** — second toolchain, `svelte` condition, `.svelte.ts`, ships source | **Highest** — the `$state`-proxy consent defect (§2) is only findable here |
| Vue 3 | Partly — `setup()` runs on the server, HMR remount | Low (normal tsup) | Medium — validates the SSR invariant |
| Solid | Barely — `Accessor<T>` is already the contract, so it validates nothing | Low | Low |
| Angular | **Most** — no effects at all, DI scoping, no double-invoke | Medium (ng-packagr) | High, but highest cost and lowest audience overlap |

**Ship Svelte.** It is the only choice that surfaces the proxy defect, and it forces the
build pipeline to be correct while the repo is still small. Then write the **Vue adapter as
a ~40-line spike inside v0.1 without publishing it** — it costs an afternoon and it is the
cheapest possible proof that the seam is not Svelte-shaped either. Angular is the right
*third* published adapter, and the moment to write it is when someone asks.

### Boundary rules (enforce in CI, not in review)

| Rule | Enforcement |
|---|---|
| Core imports nothing | assert `dependencies === undefined` in `packages/concierge/package.json` |
| Core has no DOM types | `tsconfig` `"lib": ["ES2022"]` only — **already correct**; add a test that fails if `"DOM"` appears |
| Core has no top-level side effects | `"sideEffects": false` — **already set**; add an import-and-assert-no-timers test |
| Adapters ≤150 LOC | `cloc` gate in CI. Zag's 617-LOC React adapter is what this prevents. |
| Adapters contain no loop / scheduler / state machine | lint rule or review checklist; the LOC gate catches most of it |
| `"use client"` on adapter modules, never on the core barrel | build-time banner injection + a test grepping the built output (TanStack's exact setup) |

---

## 9. Type surface defects (read this first)

Ranked by severity. Each is a concrete change to `packages/concierge/src/types.ts`.

### A — 🔴 HIGH · Nothing owns the transport loop

`catalogFor` produces tools; `Transport.setTools` consumes them; no component connects them,
subscribes `onToolBatch`, or calls `respond`. **Fix:** add `createSession` / `ConciergeSession`
(§8).

### B — 🔴 HIGH · `ToolCall` cannot carry the fields consent depends on

```ts
onToolBatch: (cb: (batch: ReadonlyArray<ToolCall>) => void) => () => void;
interface ToolCall { callId; name; arguments; outputIndex }
```

`InvocationMeta` needs `responseId`, `userTurnId`, and `deferUntilDelivered` — and
`ConsentPolicy.bindTo: "userTurn"` is described as *"load-bearing for consent."* **There is
no path for the transport to supply any of them.** As written, the consent kernel cannot be
implemented against this `Transport`.

**Fix — add a batch envelope:**

```ts
export interface ToolBatch {
  calls: ReadonlyArray<ToolCall>;
  /** Agent response this batch belongs to. */
  responseId: string;
  /** Human turn that caused it. Transport-authoritative — core must never synthesise this. */
  userTurnId: string;
  /** Present only when the transport can promise delivery. Absent ⇒ grade "none". */
  deferUntilDelivered?: (effect: (deliveredResponseId: string) => void) => void;
}
onToolBatch: (cb: (batch: ToolBatch) => void) => () => void;
```

Do this in **v0.1**, before any transport ships, even though the consent kernel is v0.2.

### C — 🔴 HIGH · `ConsentPolicy.requires: string` is untyped, so a typo silently disables a safety gate

```ts
consent: { requires: "reviewBokking", bindTo: "userTurn" }   // compiles; gate never arms
```

The README promises the factory derives "the literal union type." **Fix:** thread the
catalog's name union through (`requires: TName`), and — because `defineAction` cannot know
the union at definition time — **`buildCatalog` must throw naming the action when `requires`
does not resolve**, exactly like the root-`type:"object"` check. The runtime check is the
one that actually has to exist; the type is the nicety.

### D — 🟠 MEDIUM-HIGH · Svelte `$state` proxies silently void the consent snapshot

`ConsentAck.snapshot` stored at review time must be a **detached, frozen, plain** value. On
Svelte it will be a live `$state` proxy that mutates with the app, so "any drift between
review and confirm destroys the consent" quietly becomes "there is never any drift."
`structuredClone` is not the fix — it throws `DataCloneError` on proxies. **Fix:** a
`SnapshotNormalizer` seam with a proxy-tolerant structural deep-copy default, which the
Svelte adapter fills with `$state.snapshot`. Full detail in §2. **This is a security
defect, and it is invisible in a React-only test suite.**

### E — 🟠 MEDIUM · `Concierge.registerHandler` is a second registry parallel to `ActionDefinition.handler`

`CONTRIBUTING.md`: *"If you find yourself maintaining two lists in lockstep, that is a bug in
Concierge."* This is that. **Fix:** delete it, or rename to `overrideHandler` with a stated
purpose (test doubles, devtools manual firing) and a dev-only warning when used outside those.
Also, `ActionHandler<never, never>` as the parameter type is a bottom-type trick that works
but reads as a mistake — annotate it if it stays.

### F — 🟠 MEDIUM · `Transport.respond(callId, output: string)` forces premature serialization

`string` is the OpenAI `function_call_output.output` shape. MCP wants content blocks; a
command palette wants to render `message`; devtools want `reason` without re-parsing.
**Fix:** `respond: (callId: string, result: ActionResult) => void` and let each transport
serialize. Costs nothing, and it keeps the *"one sentence, safe to speak verbatim"* contract
structurally intact all the way to the UI instead of round-tripping it through JSON.

### G — 🟠 MEDIUM · `stages: Record<string, StageDefinition>` has non-deterministic match order

First-match-wins over an object is unsafe: JS iterates **integer-like keys first, in ascending
numeric order**, then string keys in insertion order. A stage keyed `"404"` matches before
everything declared above it. **Fix:** `ReadonlyArray<StageDefinition & { id: string }>`, or
keep the `Record` and assert at `buildCatalog` that no key is integer-like. Also: document
whether match is first-wins or must-be-unique — the type says nothing, and "two stages
matched" is a real production state on a canvas app.

### H — 🟡 LOW-MEDIUM · `BridgeRegistry` is a free-floating module singleton

`resultsBridge` is created at module scope and handed to `defineStage`. Consequences: two
Concierge instances on one page share bridges; tests need global reset; and under SSR the
slot is process-global. It is *currently* safe only because registration happens in effects
that never run on the server — an invariant nobody has written down. **Fix:** keep registries
standalone (they are the decoupling point, and that is right), but add (1) a dev warning when
`register()` runs with `typeof window === "undefined"`, and (2) `__resetForTest()`.

### I — 🟡 LOW-MEDIUM · `ConsentPolicy`'s `Snapshot` param is erased at the use site

`ActionDefinition.consent?: ConsentPolicy` drops the generic, so `snapshotEquality` degrades
to `(a: unknown, b: unknown) => boolean` — losing type safety precisely where correctness
matters most. Same for `ActionHandler`'s `ack?: ConsentAck`. **Fix:** add a `Snapshot` type
param to `ActionDefinition`, or infer it from the referenced review action's output.

### J — 🟡 LOW · `TransportCapabilities.dynamicCatalog: false` has no defined behaviour

What does core emit on a static-catalog transport — the union of all stages? Only
`crossStage`? Refuse to build with >1 stage? Undefined today. MCP is `true`; a baked JSON
tool manifest is `false`. Pick one and encode it in `buildCatalog`.

### K — 🟡 LOW · No scheduler seam, and timer handle types differ by platform

`commitWindowMs` / `dedupeWindowMs` imply `setTimeout`. In core the handle is `number` under
DOM and `Timeout` under `@types/node` — use `ReturnType<typeof setTimeout>` and never cast.
More importantly, TanStack ships `notifyManager.setScheduler(fn)` for exactly this, and it is
what makes their suite testable with fake timers and their devtools able to observe batches.
Adding a `scheduler?: (cb: () => void) => void` config field costs ~5 LOC now and is a
breaking change later.

### L — 🟢 OPPORTUNITY · `jsonSchema?: JsonSchemaObject` predates Standard JSON Schema

A companion spec now standardizes emission: `~standard.jsonSchema` exposes a `Converter`
with `input(options)` / `output(options)` and targets `'draft-2020-12' | 'draft-07' |
'openapi-3.0'`. Implemented today by **Zod v4.2+, ArkType v2.1.28+, Valibot v1.2+ (via
`@valibot/to-json-schema` v1.5+), VineJS v4.3+, Sury, stnl, GraphQL Standard Schema v0.2+**
([standardschema.dev/json-schema](https://standardschema.dev/json-schema)).

**Fix:** detect `~standard.jsonSchema` first, fall back to the manual `jsonSchema?` escape
hatch. This likely **deletes the planned `@fullselfbrowsing/concierge-zod` package** from the
roadmap (Key Decisions row 3), which is a real scope reduction. Inline the `Converter` type
next to `StandardSchemaV1` — same reasoning, same file, zero dependencies.

### Things that are right and should not be touched

- `snapshot: Record<string, () => T>` — §2. Convergently correct; TanStack Svelte Query v6
  independently shipped the identical `Accessor<T> = () => T`.
- Inlining `StandardSchemaV1` instead of depending on it.
- `AbortSignalLike` declared locally to keep `lib: ["ES2022"]` — this is the single most
  disciplined thing in the file, and it is what will keep core honest as it grows.
- `TransportCapabilities` as a declared-capability object — better than either comparator.
- `dispatch` not `async`.
- `USER_STOPPED` as a frozen shared constant.

---

## 10. Anti-Patterns

### Anti-Pattern 1 — "The adapter runs the machine"

**What people do:** publish a *spec* from core and make each adapter interpret it.
**Why it's wrong:** you have written the interpreter N times. Zag.js: `machine.js` is 286
(react) / 287 (vue) / 275 (solid) / 264 (svelte) LOC — four implementations of one algorithm,
which must stay behaviourally identical forever. Adapters land at 491–686 LOC, 4× the budget.
**Do this instead:** core owns the runtime and exposes a *value with `subscribe`*. Better
Auth's Svelte adapter is 17 lines because of this one decision.

### Anti-Pattern 2 — Building React-first and porting later

**What people do:** ship React, port to Vue in v0.2.
**Why it's wrong:** the core silently acquires hook-shaped assumptions — dedup keyed to
render cycles, cleanup that assumes double-invoke, snapshots that assume ref semantics — and
by the time the second adapter arrives, "fixing core" is a breaking change. `README.md`
already names this; §8 is the concrete mitigation.
**Do this instead:** two adapters in the same commit range, both in CI, both exercised by one
example app.

### Anti-Pattern 3 — Core "constructs on the server" ≠ core is SSR-safe

**What people do:** verify no top-level `window` and declare victory.
**Why it's wrong:** the harder failure is a module-scope singleton whose *mutable* state is
shared across every request. TanStack Router shipped exactly this and served a wrong 307 to
every visitor until the process restarted
([#6924](https://github.com/TanStack/router/issues/6924)).
**Do this instead:** all mutable dispatcher state is lazily allocated on first `dispatch` and
never during module evaluation or `catalogFor`. Test it.

### Anti-Pattern 4 — Abstracting the transport at the vendor's altitude

**What people do:** define `Transport` in terms of the events the current vendor emits.
**Why it's wrong:** `RealtimeTransportLayer` has `sendAudio`, `mute`, `interrupt`,
`updateSessionConfig(config: Partial<RealtimeSessionConfig>)`, `requestResponse()`. It
abstracts WebRTC-vs-WebSocket *for one vendor* — an MCP stdio transport cannot implement it
and would not want to.
**Do this instead:** abstract where the vocabulary is universal (tools / calls / results) and
put everything else in `capabilities`. Concierge already does this; the job is to not regress
when the Realtime transport lands and something is "just easier" to expose.

### Anti-Pattern 5 — Returning a fresh array from `catalogFor`

**What people do:** rebuild the catalog per call because it's "pure."
**Why it's wrong:** the moment anything feeds it to `useSyncExternalStore`, React throws
*"The result of `getSnapshot` should be cached"* and infinite-loops. Catalogs are pure
functions of *static* config.
**Do this instead:** memoize and freeze per stage at `buildCatalog` time; hand out the same
reference forever. Decide in v0.1 — it is a breaking change after v0.3's devtools ship.

### Anti-Pattern 6 — Identity-guarding on the bridge object instead of a token

**What people do:** `if (slot?.bridge === bridge) slot = null`.
**Why it's wrong:** fails when a component re-registers an object that is `===` the previous
one (memoized literal, reused `$state` object) — the stale cleanup then matches the *live*
registration and wipes it. The guard appears to work in tests and fails under HMR.
**Do this instead:** monotonic token per registration (§3).

---

## 11. Scaling Considerations

For a library, "scale" is catalog size, not users.

| Scale | What to do |
|---|---|
| **1–20 actions, 1–3 stages** | Everything is trivial. Linear stage scan. No memoization needed (do it anyway — §10.5). |
| **20–100 actions, 5–15 stages** | Catalog memoization now matters — JSON Schema emission is not free and runs on every stage change. Realtime `session.update` payload size becomes a measurable turn-latency cost. **This is where stage scoping earns its keep**: model tool-selection accuracy degrades noticeably past ~30 concurrent tools, which is the whole argument for design-contract §3. |
| **100+ actions** | Past what any model selects reliably in one shot. The escape valve is progressive disclosure — `search_actions` → `invoke_action` — which is exactly what FSB does with `search_capabilities`/`invoke_capability` over its 128-app catalog. **Explicitly out of scope for v0.1**, but the `Transport`/catalog seam should not make it impossible: keep `EmittedTool[]` an ordered list core produces, so a future "meta-action" transport can substitute two tools for two hundred without touching the dispatcher. |

**First bottleneck:** JSON Schema re-emission on every stage change. Fix: memoize at
`buildCatalog`.
**Second bottleneck:** model tool-selection accuracy, not machine performance. Fix: narrower
stages, then progressive disclosure.

---

## 12. Integration Points

### Internal boundaries

| Boundary | Communication | Notes |
|---|---|---|
| adapter → core | `bridgeRegistry.register(bridge) => unsub` | Only write-side in v0.1. Getter-based, no reactivity crossing. |
| adapter → core (read, v0.3) | `subscribe(cb) => unsub` + memoized `getSnapshot()` | Must satisfy `useSyncExternalStore` caching + `getServerSnapshot`. Use `Subscribable` from L0. |
| core → transport | `setTools` (push, idempotent, replayable) | Must be safe pre-connection; session buffers and re-pushes on `connected`. |
| transport → core | `onToolBatch(ToolBatch)` | **Must carry the turn envelope** (§9-B). |
| core → transport | `respond(callId, ActionResult)` | Should not be pre-serialized (§9-F). |
| handler → bridge | `ctx.bridge: B \| null` | `null` = off-page. Always checked. This is the whole decoupling story and it is correct. |
| core → app (telemetry) | redacted args, default `drop` | Never sees a thrown message. |

### External services

| Service | Integration | Gotchas |
|---|---|---|
| OpenAI Realtime | `concierge-realtime` transport, WebRTC data channel | Root JSON Schema **must** be `type:"object"` or the whole `session.update` is rejected. Ephemeral token requires a server route → §6 job 1. `consentGrade: "perceived"`. |
| MCP client | `concierge-mcp` executor | `dynamicCatalog: true` via `notifications/tools/list_changed`, but the client pulls. `consentGrade: "none"` — so `minGrade: "perceived"` actions **must refuse to build**, which is the design working as intended. |
| Text sidebar | any LLM with tool calling | `consentGrade: "delivered"`. `deferUntilDelivered` = render completion. |
| Validators | Standard Schema v1 + Standard JSON Schema | Zod ≥4.2, ArkType ≥2.1.28, Valibot ≥1.2 emit JSON Schema natively (§9-L). |

---

## Sources

**Read at source level from published npm tarballs, 2026-07-27** (HIGH confidence):
- `@tanstack/query-core@5.101.4` — `src/subscribable.ts`, `src/notifyManager.ts`, zero deps
- `@tanstack/react-query@5.101.4` — `src/useBaseQuery.ts`, build-time `"use client"` injection
- `@tanstack/svelte-query@6.1.38` — `src/types.ts` (`Accessor<T> = () => T`), `src/createBaseQuery.svelte.ts`, `src/utils.svelte.ts`, `src/containers.svelte.ts`, exports map
- `@tanstack/solid-query@5.101.4`, `@tanstack/angular-query-experimental@5.101.4`
- `better-auth@1.6.25` — `dist/integrations/{node,next-js,svelte-kit,solid-start,tanstack-start}.mjs`, `dist/client/{react,vue,svelte,solid}/`, full exports map
- `better-call@1.3.7` — `dist/node.mjs` (`toNodeHandler`)
- `@zag-js/{core,react,vue,svelte,solid}@1.42.0` — adapter LOC, `machine.*.js`, `use-sync-external-store.svelte.js`, `track.svelte.js`
- `@floating-ui/core@1.8.0` — `Platform` interface
- `@modelcontextprotocol/sdk` — `dist/esm/shared/transport.d.ts`
- `@openai/agents-realtime@0.13.5` — `dist/transportLayer.d.ts`
- `solid-js` — `types/reactive/signal.d.ts:104`
- `@tiptap/core@3.29.1` — peer deps; `@tiptap/svelte` confirmed **not to exist** (E404)

**Official documentation** (HIGH confidence):
- [Svelte `$state`](https://svelte.dev/docs/svelte/$state) · [compiler warnings](https://svelte.dev/docs/svelte/compiler-warnings) · [SvelteKit packaging](https://svelte.dev/docs/kit/packaging)
- [React StrictMode](https://react.dev/reference/react/StrictMode) · [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [Vue reactivity utilities (`toValue`, `MaybeRefOrGetter`)](https://vuejs.org/api/reactivity-utilities.html) · [Vue SSR / cross-request state pollution](https://vuejs.org/guide/scaling-up/ssr.html) · [Reactivity advanced (`effectScope`)](https://vuejs.org/api/reactivity-advanced.html)
- [Angular signals](https://angular.dev/guide/signals) · [DestroyRef](https://angular.dev/api/core/DestroyRef)
- [Next.js `use client`](https://nextjs.org/docs/app/api-reference/directives/use-client)
- [Standard Schema](https://standardschema.dev/) · [Standard JSON Schema](https://standardschema.dev/json-schema)
- [Hono web standards](https://hono.dev/docs/concepts/web-standard)

**Issue trackers / incident evidence** (MEDIUM–HIGH confidence):
- [TanStack Router #6924 — singleton leaked request-scoped state across requests](https://github.com/TanStack/router/issues/6924)
- [sveltejs/svelte #12438](https://github.com/sveltejs/svelte/issues/12438), [#13562](https://github.com/sveltejs/svelte/issues/13562), [#15327](https://github.com/sveltejs/svelte/issues/15327) — `structuredClone` + `$state` proxies
- [sveltekit-superforms #300 — Svelte 5 proxies broke structuredClone](https://github.com/ciscoheat/sveltekit-superforms/issues/300)
- [ueberdosis/tiptap #5856 — SSR detected, set `immediatelyRender: false`](https://github.com/ueberdosis/tiptap/issues/5856)

**Confidence caveats:**
- Vue HMR remount ordering (§3) is characterised from the general Vite/Vue HMR model, not from
  a quoted Vue doc — **MEDIUM**. The mitigation (token guard) is correct regardless, and
  `README.md` already asserts the failure independently.
- CopilotKit's exact `useCopilotAction` signature was surveyed from docs summaries, not source
  — **LOW**. Not load-bearing for any recommendation here.
- The ~150 LOC adapter budget is validated as *achievable* (Better Auth: 17–65) and its failure
  mode is validated (Zag: 491–686). Concierge's own adapters are unwritten, so the budget
  remains a target, not a measurement.

---
*Architecture research for: framework-agnostic agent-actuation SDK*
*Researched: 2026-07-27*
