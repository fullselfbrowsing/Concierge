/**
 * `createBridge` — the constructible bridge registry, its monotonic-token
 * identity guard, snapshot capture and detachment from framework reactivity,
 * and the off-page result helper (BRG-01, BRG-03, BRG-04, BRG-05).
 *
 * A separate module from `./concierge.ts`, and the dependency runs one way
 * only: nothing here imports that file. The stage-to-bridge resolution seam
 * reads a `StageDefinition`, a stage concept that lives there, so inverting the
 * direction would create a cycle between the two largest runtime modules.
 *
 * ---------------------------------------------------------------------------
 * Four constraints whose violation is SILENT
 * ---------------------------------------------------------------------------
 *
 * **1. Every mutable binding is a `let` inside {@link createBridge}'s body,
 * never module scope, and the reason is cross-request state pollution under
 * SSR.** Application modules are initialised once when a long-lived server
 * boots, and the same module instances are then reused for every request that
 * process serves. A module-scope token counter would therefore be shared by
 * every registry in the process, so one request's registrations would hand
 * their tokens to another's and a stale unsubscriber from request 1 could clear
 * a live registration in request 2. `./concierge.ts`'s header, constraint 1,
 * makes the same argument for its catalog memo and cites TanStack Router
 * shipping exactly this bug, where one request's leaked state made every
 * subsequent GET return a 307 until the process was restarted. Module scope in
 * this file therefore holds function declarations and nothing else.
 *
 * An earlier draft of the same rule, in that file, justified it on bundler
 * grounds instead — that a module-scope structure is elided from a consumer
 * build. Re-measured under rolldown 1.2.0 it does **not** reproduce: a
 * module-scope structure read by an exported function is retained, and behaves
 * identically bundled and unbundled. The rule survived its justification being
 * wrong, which is exactly why the justification is written down rather than
 * assumed.
 *
 * **2. `assertSingleInstance()` is the first statement of {@link createBridge}'s
 * body, and must never be hoisted to module scope.** This package ships
 * `"sideEffects": false`, and 02-06 measured that a module-evaluation-time
 * registration is deleted from the consumer bundle outright — while remaining
 * present under `node dist/index.js`. Hoisted, the guard tests green in Node and
 * does nothing in every React or Svelte app, which is the only place two copies
 * of core can collide. `./catalog.ts`'s header, constraint 1, states the same
 * thing for `buildCatalog`, and registration is where two copies actually bite:
 * a component registers into copy A while a handler reads copy B, so `bridge`
 * is `null` forever on a page that is definitely open.
 *
 * **The consequence, weighed and accepted.** A consumer idiomatically writes
 * `export const resultsBridge = createBridge("results")` at their own module
 * scope, so a contract-version mismatch now throws during *their* module
 * evaluation — which is the shape `./contract.ts:125-131` argues against for
 * core's own module scope: an import-time throw surfaces with no useful frame,
 * and under a metaframework's SSR it takes down the whole render rather than
 * the one feature. The trade was made anyway and is still correct, because an
 * undiagnosable `null` forever is worse than a loud throw that names both
 * contract versions and the remediation.
 *
 * **3. The default snapshot normalizer CLONES and then freezes; it never
 * freezes in place.** The mechanism is one sentence: cloning fires only *read*
 * traps (`ownKeys`, `getOwnPropertyDescriptor`, `get`), whereas freezing fires
 * *write* traps (`preventExtensions`, `defineProperty`). Freezing a snapshot
 * value where it stands has three measured failure modes, and two of them are
 * worse than the first:
 *
 * - it fails to detach — an accessor-backed proxy survives the seal intact, so
 *   the captured value goes on following the app's store and Phase 8's CON-04
 *   drift check compares a value against itself and passes unconditionally;
 * - it freezes the host app's own reactive store *through* the proxy, so the
 *   snapshot appears not to move only because the application has been made
 *   permanently read-only and the consumer's next write throws in their code;
 * - it throws `TypeError` out of the capture path entirely, on proxy shapes
 *   whose traps do not satisfy the freeze invariants.
 *
 * **4. The recursive freeze in `./catalog.ts` skips accessors, and that is
 * exactly why it cannot be the normalizer.** It walks with
 * `Reflect.getOwnPropertyDescriptor` and skips any property whose descriptor has
 * no `value` key, so a getter is never invoked. There that is a safety feature:
 * sealing a catalog must not run consumer code. Here the same property has the
 * opposite valence — invoking the getter *is* the detachment, so a walk that
 * refuses to invoke one cannot detach anything. Same property, opposite
 * valence: write that down so a future reader does not "fix" one by breaking
 * the other.
 *
 * This file therefore hand-rolls its own walk rather than reusing that one. And
 * the catalog's walk must **not** be run over the clone's result as a
 * belt-and-braces second pass: measured, with a class instance in the
 * pass-through branch a second pass leaves the consumer's own model object
 * sealed, so their next write throws in their code. The clone's per-node seal is
 * complete for everything it constructs, and a pass-through value is by
 * definition not ours to seal.
 *
 * Like `./types.ts`, `./contract.ts`, `./json-schema.ts`, `./host.ts`,
 * `./catalog.ts` and `./concierge.ts`, this file has no runtime dependency, no
 * framework reference and no DOM access — it must construct on a server under
 * Next App Router, Nuxt or SvelteKit with no environment guards.
 */

import { assertSingleInstance } from "./contract.js";
import { warnHost } from "./host.js";
import { MESSAGE_MAX_CHARS } from "./types.js";
import type { ActionResult, Bridge, BridgeRegistry, SnapshotNormalizer } from "./types.js";

// ---------------------------------------------------------------------------
// Module scope — immutable declarations only
// ---------------------------------------------------------------------------
//
// Header constraint 1 restated as a reading rule: nothing below this separator
// is written after module evaluation. This file declares no module-scope
// constants at all — only functions — so there is also nothing here for a
// `@__PURE__` annotation to guard.

// ---------------------------------------------------------------------------
// Module-private message builders
// ---------------------------------------------------------------------------

/**
 * The warning a second component earns for registering over a still-live
 * registration, in the house message shape — a `concierge: ` prefix, the code,
 * the quoted subject, the problem, then `Fix: `, exactly as `./catalog.ts`'s
 * diagnostics are rendered with the bridge id substituted for the action name.
 *
 * **Behind a named function rather than written inline**, for the reason
 * `./concierge.ts` gives for its own duplicate-stage message: the call site
 * becomes one short statement a mutation battery can target as a single
 * literal, which is what lets the battery prove the test covering it fires.
 *
 * **What it claims, and what it deliberately does not.** It does not say the
 * registry is broken, because it is not: last registration wins, so the second
 * component's bridge is live and correct. What is genuinely lost is the first
 * component's — its snapshot getters and actions are no longer reachable
 * through this registry, and nothing else in the package would ever mention it.
 *
 * It interpolates `id` and nothing else. Never a caught value, never a snapshot
 * value: `id` is a developer-authored string already in the config, and
 * everything around it is fixed prose.
 */
function bridgeOverwriteMessage(id: string): string {
  return (
    `concierge: [bridge_overwrite] bridge "${id}": a second component registered over a ` +
    `still-live registration, so the first component's snapshot and actions are no longer ` +
    `reachable through this registry. ` +
    `Fix: make sure exactly one mounted component registers this bridge. This warning fires ` +
    `once per registry, so a later overwrite is silent.`
  );
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

/**
 * Construct a bridge registry: one slot, last-registration-wins, and an
 * identity-guarded unsubscriber (BRG-01, BRG-04).
 *
 * A page component calls {@link BridgeRegistry.register} on mount and calls the
 * function it returns on unmount. A handler calls {@link BridgeRegistry.read}
 * and gets the live bridge, or `null` when nothing is mounted — which is DX-02's
 * supported configuration rather than a defect, and is why core never
 * auto-fails an action over an unmounted bridge.
 *
 * **`id` is a human label, and it is never a lookup key.** It exists so
 * `explain()` can print a row a developer recognises. Unforgeable identity comes
 * from *holding this object*: the registry IS the capability, so a caller with
 * the reference is authorised and a caller without it cannot name their way in.
 * That is why `defineStage` was cut in Phase 4 — a stage needs no identity
 * mechanism, a plain `StageDefinition` object literal already typechecks, and
 * the unforgeable-identity argument that would have justified one belongs here.
 * It is also why this package holds no id-to-registry map anywhere: there is
 * nothing to reach by guessing a string.
 *
 * ---------------------------------------------------------------------------
 * The SSR registration invariant — recorded here, enforced nowhere
 * ---------------------------------------------------------------------------
 *
 * **A registry constructed at a consumer's own module scope has a
 * process-global slot.** The idiomatic call is
 * `export const resultsBridge = createBridge("results")` at the top of a page
 * module, and on a long-lived server that module is evaluated once and reused
 * for every request the process serves. So a `register()` that ever runs on the
 * server leaks its bridge into the next request, where a handler would read one
 * user's live component as another's.
 *
 * This is safe today, and it is safe for a reason nobody had written down:
 * registration happens inside framework effects, and effects do not run during
 * server rendering. That is an invariant of the adapters, not of this function,
 * and it is stated here so it stops being invisible.
 *
 * **It is deliberately not guarded.** A guard needs a `typeof window` test,
 * which needs a new capability in `./host.ts`, which collides head-on with the
 * hard constraint that core constructs on the server with no environment
 * guards. So the invariant is recorded and deferred to the Phase 9 adapters,
 * where "am I on the server" is already known for free. There is no runtime
 * guard in this function and no change to `./host.ts`; do not add either here.
 */
export function createBridge<B extends Bridge = Bridge>(id: string): BridgeRegistry<B> {
  assertSingleInstance();

  // This instance's only mutable state, and header constraint 1 is why all
  // three live in this body rather than a scope up. A server process reuses
  // this module across every request it serves: a module-scope token counter
  // would hand one request's tokens to another request's registry, and a
  // module-scope warn latch would suppress request N's warning because request
  // 1 already warned — a silenced diagnostic being strictly worse than a
  // repeated one.
  //
  // `slot` is a single slot and not a stack. Last registration wins, and the
  // displaced registration's unsubscriber becomes a refused no-op. LIFO
  // semantics that restore the previous registration on unregister were
  // rejected: they resurrect a dead page component, which is precisely the
  // BRG-04 failure.
  //
  // `next` is monotonic and never reset, so within one registry no token is
  // ever reused. That is the entire basis of the guard on the unsubscriber
  // below.
  let slot: { token: number; bridge: B } | null = null;
  let next: number = 0;
  let warnedOverwrite: boolean = false;

  const registry: BridgeRegistry<B> = {
    id,

    read: (): B | null => slot?.bridge ?? null,

    register: (bridge: B): (() => void) => {
      // Warn once per registry, not once per overwrite. Two components claiming
      // one stage bridge is a genuine app bug, unlike a late cleanup — but a
      // warning that prints forever is a warning nobody reads, and one registry
      // has exactly one id, so a boolean latch carries all the granularity
      // there is. Warn, never throw: a throw here would land on the end user's
      // blank screen for a defect only the developer can fix.
      if (slot !== null && !warnedOverwrite) {
        warnedOverwrite = true;
        warnHost(bridgeOverwriteMessage(id));
      }

      // The bridge is stored AS GIVEN. Nothing is normalized here, and nothing
      // is normalized in `read()` either. Either would capture state at mount
      // time and hand every later handler a view frozen at the moment the
      // component mounted, which is BRG-02's failure exactly — the getters must
      // stay live. Detachment belongs at capture time and nowhere else.
      const token: number = ++next;
      slot = { token, bridge };

      return (): void => {
        // **The guard is on the TOKEN, not on the bridge object.** Guarding on
        // the object agrees with this one on nine of thirteen mount/unmount
        // orderings — including both of the two a developer writes first, so a
        // reviewer's instinct does not catch it — and fails exactly when a
        // component re-registers an object that is `===` its previous
        // registration — a memoized literal, or a reused `$state` object. There
        // the stale cleanup matches the live registration and clears it, and
        // the page goes dark with every component still mounted. A monotonic
        // token cannot collide with itself, so it has no such case.
        //
        // **A mismatch is a silent, idempotent no-op with NO warning.** React
        // StrictMode's double mount, Vue HMR and Svelte remount all produce
        // refused cleanups by design, so a warning here would fire on every dev
        // mount and train developers to ignore the one diagnostic channel this
        // package has. Refusing quietly is the correct behaviour, not a
        // swallowed error.
        if (slot?.token === token) {
          slot = null;
        }
      };
    },
  };

  // **The returned object IS sealed, and this DIVERGES from `createConcierge`**,
  // which returns unfrozen and records that refusal in a comment of its own.
  // The divergence is named here so nobody harmonizes the two later.
  //
  // The registry is a capability object — holding the reference IS the
  // authorization — so `registry.read` is precisely the thing worth taking.
  // Left writable, third-party page script in the same realm swaps it for a
  // function returning an attacker-controlled bridge, and every handler in the
  // app then reads attacker state while every check upstream still reports
  // success. That is the SEC-03 attack class. The `Concierge` handle is not
  // that: it is the consumer's own handle, and script that can reach it can
  // already reach the module that made it.
  //
  // Measured: the seal makes `registry.read = evil` and `registry.extra = 1`
  // both throw `TypeError` in ESM strict mode. Measured too, and stated because
  // "we froze it so it must be immutable" is how a breach reports success —
  // sealing the object does NOT seal the closure. `register()` goes on mutating
  // `slot`, `next` and the latch normally afterwards, which is required: a
  // registry that could not register would be a very safe brick.
  return Object.freeze(registry);
}

// ---------------------------------------------------------------------------
// The no-bridge path
// ---------------------------------------------------------------------------

/**
 * The honest sentence a handler returns when the page it reads from is not open
 * (BRG-03, DX-02, DX-03).
 *
 * Core never auto-fails an action because a declared bridge is unmounted — it
 * passes `bridge: null` and the handler decides, because an action reading
 * router or DOM state must still run with nothing registered at all. This helper
 * is for the handlers that genuinely cannot proceed, and it exists because
 * DX-03's standard is that the message *is* the product: a sentence saying what
 * is wrong without saying what to do fails the requirement even when it fires at
 * exactly the right moment. With no helper, every consumer hand-writes a worse
 * sentence.
 *
 * **Parameter forms.** `what` is a capitalised noun phrase naming the thing that
 * is unavailable — "The result count", "The selected rows". `where` is a
 * lowercase noun phrase naming the page — "results page", "cart". Both are
 * dropped into fixed prose; neither is a format string, and neither is parsed.
 *
 * Worked example, measured by execution rather than counted by hand:
 *
 * ```
 * offPageResult("The result count", "results page").message
 * // → "The result count is not available because the results page is not open. Open the results page and try again."
 * // length 108, which leaves 72 characters of headroom under the 180 bound
 * ```
 *
 * **BOUNDED, not SANITIZED — and the distinction is a scheduling decision
 * rather than an oversight.** This truncates at {@link MESSAGE_MAX_CHARS} and
 * does nothing else. Stripping C0/C1 control characters and collapsing
 * whitespace is SEC-06, and it lands at the dispatcher boundary in Phase 6 where
 * it covers *every* result rather than the ones this helper builds. Doing either
 * half here would put one policy in two places, which is how two copies of a
 * policy drift.
 *
 * {@link MESSAGE_MAX_CHARS} is imported from `./types.ts` rather than
 * re-declared. It is the shared contract between this bound and Phase 6's
 * truncation, and a second constant is two numbers that can disagree — a
 * disagreement that would stay invisible until a message was cut at the wrong
 * place.
 *
 * `"no_bridge"` is one of the twelve closed `ReasonCode` members, already
 * declared for exactly this case. That union is **final at twelve**: adding a
 * member is a breaking change by design, and this function needs no thirteenth.
 */
export function offPageResult(what: string, where: string): ActionResult {
  const message: string =
    `${what} is not available because the ${where} is not open. ` +
    `Open the ${where} and try again.`;

  return {
    ok: false,
    reason: "no_bridge",
    message: message.length > MESSAGE_MAX_CHARS ? message.slice(0, MESSAGE_MAX_CHARS) : message,
  };
}

// ---------------------------------------------------------------------------
// Snapshot capture and detachment
// ---------------------------------------------------------------------------
//
// THE EXOTIC-WARN SIGNAL PATH, stated once here because the shape of all three
// units below follows from it.
//
// A value that cannot be detached is passed through by reference — the
// documented limit — and that hole is accepted. What is not accepted is the hole
// being *invisible*: BRG-05 is what makes Phase 8's CON-04 drift check
// meaningful, so a snapshot value that silently stayed live would turn a
// security gate into decoration. The fallback therefore reports.
//
// Four independent pins close every obvious way of reporting it. The normalizer
// type is `<T>(value: T) => T`, which has no out-channel. Module-scope mutable
// state is forbidden by header constraint 1, so a module-level latch is out. A
// second walk over the clone's result is forbidden, so the report cannot be
// collected afterwards. And the single delegating call inside the returned
// normalizer must stay one live call site, because it is the mutation battery's
// only anchor on the detachment decision.
//
// One shape satisfies all four: a factory. `makeDefaultNormalizer` takes an
// `onExotic` callback and returns the normalizer closure that carries the
// delegation. The callback is closed over per snapshot key, inside
// `captureSnapshot`'s body, so no state lives at module scope, the normalizer's
// public signature is untouched, and the anchor moves inside the returned
// closure while remaining a single live call site.
//
// **Do not replace the factory with an anonymous closure written inline in
// `captureSnapshot`.** That leaves a named default normalizer with no caller,
// and the battery then mutates a function nobody invokes — which it records as
// an escape. That is the inverse of the truth, and it is the one failure this
// phase's gate exists to prevent.

/**
 * A structural clone that detaches a value from whatever produced it.
 *
 * Module-private. `seen` carries cycle safety and DAG identity; `onExotic` is
 * called when a value cannot be extracted and is handed back by reference.
 *
 * **`onExotic` is a parameter rather than a `warnHost` call here.** It is
 * invoked from one place — the extraction fallback below — and the emission
 * point stays a single statement in `captureSnapshot` that the mutation battery
 * can target as one literal. It is threaded through every recursive call, so a
 * proxied `Date` nested three levels inside a plain object still reports.
 *
 * This copies the skeleton of the recursive freeze in `./catalog.ts` and inverts
 * exactly one thing: accessor handling. That walk skips accessors so a getter is
 * never invoked; this one reads through `[[Get]]` so getters ARE invoked,
 * because invoking them is what detachment *is*. See header constraint 4.
 *
 * **What it does not deliver.** Freezing a `Date`, `Map` or `Set` is cosmetic —
 * measured, their own mutator methods still succeed on a frozen instance. This
 * function delivers *detachment*, a distinct object the app cannot reach, and
 * for those three types it does not additionally deliver immutability. Nothing
 * downstream may claim more.
 *
 * **Symbol keys are not carried.** `Object.keys` returns enumerable string keys
 * only, and that is deliberate rather than incidental. The three target
 * frameworks use symbol keys for internal markers — Vue's `__v_raw`, Svelte's
 * internal markers — which is precisely the framework reactivity BRG-05 exists
 * to drop, and a snapshot is a payload Phase 8 will hash and Phase 6 will
 * serialize. `Reflect.ownKeys` would drag all of it in.
 */
function cloneDetached(v: unknown, seen: WeakMap<object, unknown>, onExotic: () => void): unknown {
  if (typeof v !== "object" || v === null) {
    return v;
  }

  // A `WeakMap`, where the walk in `./catalog.ts` uses a `WeakSet`. That file
  // only needs "have I walked this"; a clone needs "what did I produce for
  // this", so the memo's value is the output node. One structure then delivers
  // two properties at once. Cycles: a self-referencing node satisfies
  // `c.self === c` instead of recursing forever. DAG identity: a node reached
  // twice satisfies `c.l === c.r` while neither is the original.
  //
  // Nothing is ever stored under a key whose value is `undefined`, so the
  // absence test below is exact rather than approximate.
  const obj: object = v;
  const hit: unknown = seen.get(obj);
  if (hit !== undefined) {
    return hit;
  }

  // ARRAYS. `Array.isArray` and never `instanceof Array`: measured, it is the
  // only predicate that is both proxy-transparent and realm-transparent, where
  // `instanceof Array` returns false for an array from another realm. The memo
  // entry is written BEFORE recursing, or a self-referencing array never
  // terminates.
  if (Array.isArray(obj)) {
    const elements: unknown[] = [];
    seen.set(obj, elements);
    for (const element of obj) {
      elements.push(cloneDetached(element, seen, onExotic));
    }
    return Object.freeze(elements);
  }

  // `Date` / `Map` / `Set`, detected as `instanceof` OR the
  // `Object.prototype.toString` tag, because **neither predicate alone is
  // complete and the two are blind in exactly opposite directions**. Measured: a
  // `Proxy` over a `Date` reports `[object Object]` from the tag — the tag reads
  // internal slots and a proxy has no `[[DateValue]]` — but it passes
  // `instanceof`, which walks the prototype chain the proxy forwards. A
  // cross-realm `Date` is the mirror image: it fails `instanceof` and passes the
  // tag. The union covers both.
  //
  // **Each extraction is wrapped in `try`/`catch` and that is mandatory, not
  // defensive.** A naively proxied `Date` is unextractable by every route
  // measured — six of them, all `TypeError` — and spreading a naively proxied
  // `Map` fails the same way with "called on incompatible receiver". A proxy
  // that binds methods to its target, which is what Vue's `reactive` does for
  // collections, works fine, so the throw is a property of naive proxying rather
  // than of proxying in general and cannot be assumed away.
  //
  // The `try` wraps the extraction only. Recursion into the extracted contents
  // happens after it, so a throwing getter nested inside a `Map` value
  // propagates to the capture loop and is reported as a throwing getter rather
  // than mislabelled as an undetachable value. Every `catch` binds nothing.
  const tag: string = Object.prototype.toString.call(obj);

  if (obj instanceof Date || tag === "[object Date]") {
    let time: number;
    try {
      time = (obj as Date).getTime();
    } catch {
      onExotic();
      return v;
    }
    const when: Date = new Date(time);
    seen.set(obj, when);
    return Object.freeze(when);
  }

  if (obj instanceof Map || tag === "[object Map]") {
    let entries: Array<[unknown, unknown]>;
    try {
      entries = [...(obj as Map<unknown, unknown>)];
    } catch {
      onExotic();
      return v;
    }
    const pairs: Map<unknown, unknown> = new Map<unknown, unknown>();
    seen.set(obj, pairs);
    for (const entry of entries) {
      pairs.set(cloneDetached(entry[0], seen, onExotic), cloneDetached(entry[1], seen, onExotic));
    }
    return Object.freeze(pairs);
  }

  if (obj instanceof Set || tag === "[object Set]") {
    let members: unknown[];
    try {
      members = [...(obj as Set<unknown>)];
    } catch {
      onExotic();
      return v;
    }
    const unique: Set<unknown> = new Set<unknown>();
    seen.set(obj, unique);
    for (const member of members) {
      unique.add(cloneDetached(member, seen, onExotic));
    }
    return Object.freeze(unique);
  }

  // PLAIN OBJECTS. Measured proxy-transparent: the prototype test reads `true`
  // through a `Proxy` over a plain object, which is the whole reason a clone
  // detaches a reactive store at all.
  //
  // **The second arm of the test is load-bearing and is a mutation target.**
  // Dropping it silently passes through a record built with
  // `Object.create(null)` — which is exactly the shape `Catalog.byName` uses, so
  // the omission would be invisible in a suite that only ever snapshots object
  // literals.
  //
  // Values are read through an indexed `[[Get]]` so getters ARE invoked. This is
  // the one place the walk deliberately diverges from the recursive freeze in
  // `./catalog.ts`, which skips accessors by testing `"value" in descriptor`.
  // Under `noUncheckedIndexedAccess` the read is `unknown` and presence is not
  // assumed. The memo entry is written before recursing, as above.
  const proto: object | null = Object.getPrototypeOf(obj);
  if (proto === Object.prototype || proto === null) {
    const fields: Record<string, unknown> = {};
    seen.set(obj, fields);
    for (const key of Object.keys(obj)) {
      fields[key] = cloneDetached((obj as Record<string, unknown>)[key], seen, onExotic);
    }
    return Object.freeze(fields);
  }

  // EVERYTHING ELSE: by reference, unfrozen, and this is the documented limit.
  // Class instances land here, so does `Object.create({})`, and so does a plain
  // object from another realm — measured false on the prototype test above,
  // via `node:vm`.
  //
  // The cross-realm miss is the *safe* failure direction: the value is handed
  // back untouched rather than mangled. **Do not chase it** with an
  // `Object.prototype.toString.call(v) === "[object Object]"` fallback. That
  // same predicate is `true` for class instances and for `Object.create({})`,
  // so it would start cloning the things this branch exists to pass through,
  // and a lossy clone that drops a prototype is worse than an honest reference.
  //
  // Nothing is frozen on this path. A pass-through value is not ours to seal —
  // see header constraint 4.
  return v;
}

/**
 * Build the default {@link SnapshotNormalizer}: a structural clone, then a
 * freeze. Never a freeze in place.
 *
 * Module-private, and a factory rather than a plain function so the exotic
 * report has a channel — see the section note above. The explicit
 * {@link SnapshotNormalizer} return annotation is required by
 * `isolatedDeclarations`.
 *
 * **The returned closure is exactly two statements, and the second one is a
 * mutation anchor.** Measured this session: a mutant replacing the delegation
 * with `Object.freeze(value) as T` compiles under TypeScript 7.0.2 with these
 * exact flags and reproduces the freeze-in-place default's observable — the
 * captured value follows the store, `Object.isFrozen(proxy)` becomes `true`, and
 * nothing throws. So the anchor must stay a single live call site. Do not inline
 * the memo allocation into the return expression; that destroys it.
 *
 * **A fresh memo per invocation is correct, not wasteful.** It must not survive
 * across values: two unrelated snapshot keys that happen to share a sub-object
 * would otherwise alias, and one key's clone would appear inside the other's.
 *
 * **Do not run a second walk over the result.** Measured: with a class instance
 * in the pass-through branch, a second pass leaves the consumer's own model
 * object frozen, so their next write throws in their code. The clone's per-node
 * seal is complete for everything it constructs, and everything else is not ours
 * to seal. This refusal is written down so no reviewer adds the belt-and-braces
 * pass as a tidy-up.
 */
function makeDefaultNormalizer(onExotic: () => void): SnapshotNormalizer {
  return <T>(value: T): T => {
    const seen: WeakMap<object, unknown> = new WeakMap<object, unknown>();
    return cloneDetached(value, seen, onExotic) as T;
  };
}

/**
 * The warning a snapshot getter earns for throwing during capture.
 *
 * House message shape, subject word `snapshot`, and the subject string is the
 * registry id and the key joined by a dot — so it renders as
 * `concierge: [snapshot_threw] snapshot "results.filters": …`. Behind a named
 * function for the same reason the overwrite message above is: the call site
 * becomes one short statement a mutation battery can target.
 *
 * Interpolates `id` and `key` and nothing else. Both are developer-authored
 * strings already in the app's own source; the caught value is not in scope at
 * the call site and could not be interpolated even by accident.
 */
function snapshotThrewMessage(id: string, key: string): string {
  return (
    `concierge: [snapshot_threw] snapshot "${id}.${key}": the getter threw, so this key is ` +
    `absent from the captured snapshot and every reader of it sees nothing where a value ` +
    `should be. ` +
    `Fix: make the getter total — it runs on every capture, so it must not assume any part of ` +
    `the component's state has loaded yet.`
  );
}

/**
 * The warning a snapshot HOLDER earns for throwing while its keys are read.
 *
 * A distinct *subject* from {@link snapshotThrewMessage} — the registry id
 * alone, with no key — because the failure is terminal for the whole capture
 * rather than for one member: there are no keys to name.
 *
 * **The same `[snapshot_threw]` code, deliberately, and this is the one place a
 * third code would have been the obvious move.** {@link snapshotExoticMessage}
 * argues the two existing codes must stay apart because "one code covering both
 * would send a developer looking at a getter that is working perfectly". That
 * argument is the reason NOT to split here: the remedy for a throwing `ownKeys`
 * trap is the remedy `snapshotThrewMessage` already prints — make the accessor
 * total — so a third code would cost a developer the search and buy nothing.
 *
 * Interpolates `id` and nothing else. The caught value is not in scope at the
 * call site and could not be interpolated even by accident.
 */
function snapshotHolderThrewMessage(id: string): string {
  return (
    `concierge: [snapshot_threw] snapshot "${id}": reading the snapshot holder's own keys threw, ` +
    `so the whole captured snapshot is empty and every reader of it sees nothing where the ` +
    `component's state should be. ` +
    `Fix: make the holder total — enumerating \`bridge.snapshot\` runs on every capture, so its ` +
    `own proxy traps and accessors must not throw.`
  );
}

/**
 * The warning an undetachable snapshot value earns.
 *
 * A **distinct code** from the throwing-getter warning, deliberately: the two
 * failures need different fixes, and one code covering both would send a
 * developer looking at a getter that is working perfectly. Same house shape,
 * same subject spelling, same interpolation rule — `id` and `key` only.
 */
function snapshotExoticMessage(id: string, key: string): string {
  return (
    `concierge: [snapshot_exotic] snapshot "${id}.${key}": a value here could not be detached ` +
    `and was carried by reference, so it may still change after capture and a later drift ` +
    `check may not see the change. ` +
    `Fix: supply a \`normalizeSnapshot\` that understands this value — for Svelte that is ` +
    `\`$state.snapshot\`.`
  );
}

/**
 * Invoke every getter on a bridge's snapshot and detach each value from the app
 * that produced it (BRG-05).
 *
 * Capture is the ONLY place detachment happens. `register()` stores the bridge
 * as given and `read()` returns it untouched, because normalizing at either
 * would freeze state at mount time and break BRG-02.
 *
 * `id` is the registry's label, carried only so a warning can name which bridge
 * and which key misbehaved.
 *
 * **A caller-supplied `normalize` suppresses the exotic warning, and that is
 * correct rather than an oversight.** When the consumer passes their own
 * normalizer — the Svelte adapter's `$state.snapshot`, say — core neither
 * constructs nor threads the `onExotic` callback, and it has no way to know
 * whether that normalizer detached anything. Warning there would be a claim core
 * has no evidence for. The throwing-getter warning is unaffected: that one
 * observes an exception core saw itself.
 *
 * **The returned container is deliberately NOT frozen**, and the refusal is
 * recorded here so nobody adds the seal as a tidy-up. It is allocated fresh on
 * every call and handed to exactly one caller, so a seal would harden a surface
 * no attacker reaches. Worse, it would be a *partial* seal: the pass-through
 * values it holds stay mutable by design, so `Object.isFrozen` would report
 * `true` over a structure that is mutable one level down. Phase 4 settled that
 * shape — "a partial `readonly` is worse than none, because a reader stopped
 * looking."
 *
 * **A `null` bridge captures to `{}`, SILENTLY, and the silence is a decision.**
 * `captureSnapshot(registry.read(), id)` is the idiom, and `read()` returning
 * `null` is DX-02's *supported* configuration rather than a defect — core never
 * auto-fails an action because a declared bridge is unmounted. A warning here
 * would therefore fire on every capture taken while a component is simply not on
 * screen, which is the "a channel that cries wolf on correct behaviour is a
 * channel developers filter out" hazard that {@link createBridge}'s refused
 * unsubscriber already answers the same way. A bridge carrying no `snapshot` at
 * all degrades identically; the type forbids it and a JavaScript consumer does
 * not get the type.
 *
 * **Only own enumerable STRING keys of the holder are captured**, which follows
 * from `Object.keys` and is the same rule `cloneDetached` applies one level
 * down. The consequence worth stating: a holder whose members live on a class
 * PROTOTYPE captures as `{}` with no warning, because it has no own keys. That
 * is the correct rule — inherited framework members are exactly what BRG-05
 * drops — but a consumer who gets an empty capture needs something to search
 * for, and this sentence is it.
 */
export function captureSnapshot<B extends Bridge>(bridge: B, id: string, normalize?: SnapshotNormalizer): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // LATCH SCOPE — a deliberate narrowing of "warn once", written down rather
  // than chosen silently. This `Set` is allocated inside the body, so the warn
  // is once per key per CAPTURE rather than once per key per process.
  //
  // The reason is that the only way to get a process-lifetime latch here is
  // module-scope state, which header constraint 1 forbids outright: under SSR a
  // module-scope `Set` would suppress request N's warning because request 1
  // already warned, and a silenced diagnostic is strictly worse than a repeated
  // one. Capture is a human-rate event — Phase 8 arms consent in response to a
  // human act — not a render-rate one, so the "a warning that prints forever is
  // a warning nobody reads" hazard that justifies the `register()` latch does
  // not apply. `./concierge.ts` makes exactly this argument when it declines to
  // warn on a throwing `read()` inside `explain`.
  //
  // The in-body `Set` still does real work: it keeps one key from emitting both
  // codes in the same capture. The `register()` latch is unaffected and stays
  // per-registry.
  const warned: Set<string> = new Set<string>();

  // **REACHING THE HOLDER IS CONSUMER CODE, so it is inside a `try` as well.**
  // This is one door further out than the `try` around the getter call below,
  // and the distance is the whole point: `bridge.snapshot` fires a `get` trap on
  // a proxied bridge, and `Object.keys` over the holder fires `ownKeys` and
  // `getOwnPropertyDescriptor`. A proxy- or accessor-backed snapshot holder is
  // not an exotic hypothetical here — it is the premise of BRG-05, and a Vue
  // component handing core `reactive({ filters: () => … })` reaches both. An
  // `Error` escaping from either one carries whatever message the consumer's own
  // code put in it, which in a real app is assembled from the same user input
  // the component renders. That is the covert PII channel CLAUDE.md's rule
  // closes for handler exceptions, at the outermost layer of this function.
  //
  // `?? {}` is what makes an unmounted bridge a silent empty capture rather than
  // a `TypeError` — see the doc comment above; DX-02's supported state must not
  // throw out of the idiom `captureSnapshot(registry.read(), id)`.
  //
  // The holder is read ONCE and held, rather than re-read as `bridge.snapshot`
  // per key: on a proxied bridge every re-read is another trap invocation, and a
  // holder that changed identity mid-loop would enumerate one object and read
  // from another.
  const given: Bridge | null | undefined = bridge as Bridge | null | undefined;
  let holder: object;
  let keys: readonly string[];
  try {
    holder = given?.snapshot ?? {};
    keys = Object.keys(holder);
  } catch {
    // Terminal for the whole capture: there are no keys, so the diagnostic names
    // the registry alone. The `catch` takes no binding here either.
    warnHost(snapshotHolderThrewMessage(id));
    return out;
  }

  for (const key of keys) {
    // Bound INSIDE the loop so the callback closes over the current key
    // directly, with no mutable cursor to keep in step. Constructing one
    // normalizer per key is trivial in cost and is what keeps the exotic report
    // honest about which key it names.
    const normalizeValue: SnapshotNormalizer =
      normalize ??
      makeDefaultNormalizer((): void => {
        if (warned.has(key)) {
          return;
        }
        warned.add(key);
        warnHost(snapshotExoticMessage(id, key));
      });

    // **The READ, the invocation and the normalize call are all inside the same
    // `try`.** Three operations, three distinct escape routes, one arm:
    //
    // - `holder[key]` runs the holder's `get` trap or an accessor on the holder
    //   itself — consumer code, before any snapshot getter has been invoked;
    // - `getter()` is the snapshot getter, the obvious one;
    // - `normalizeValue(…)` walks the returned value, and a getter nested inside
    //   it throws from in here — measured, during the clone, after the outer
    //   getter has already returned successfully.
    //
    // A `try` scoped to any one of the three leaves the other two escaping to
    // the caller carrying whatever message the consumer's own code put in it,
    // which in a real app is assembled from the same user input the component
    // renders. That is the covert PII channel CLAUDE.md's rule closes for
    // handler exceptions, one layer earlier.
    //
    // **The `catch` takes NO binding**, so there is no caught value in scope to
    // interpolate by accident. The property is structural rather than a matter
    // of remembering not to write it — the same inversion `./concierge.ts`
    // records for its matcher guard, and for the same three reasons: this fires
    // at runtime, in a shipped app, on a value derived from user input.
    //
    // The key is set to nothing rather than omitted, so a reader can tell a key
    // that failed from a key the component never declared.
    try {
      const getter: unknown = (holder as Record<string, unknown>)[key];
      if (getter === undefined) {
        continue;
      }
      out[key] = normalizeValue((getter as () => unknown)());
    } catch {
      out[key] = undefined;
      if (!warned.has(key)) {
        warned.add(key);
        warnHost(snapshotThrewMessage(id, key));
      }
    }
  }

  return out;
}
