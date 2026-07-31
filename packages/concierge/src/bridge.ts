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
import type { ActionResult, Bridge, BridgeRegistry } from "./types.js";

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
        // the object passes ten of thirteen mount/unmount orderings, including
        // both of the two a developer writes first, and fails exactly when a
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
