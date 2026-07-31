/**
 * Concierge contract identity — the single-instance guard (PKG-04).
 *
 * This is the first executable code in the package, and two constraints on it
 * are load-bearing enough that breaking either leaves a guard which reports
 * success while doing nothing at all.
 *
 * **1. Never call `assertSingleInstance` at module scope, and never move the
 * registry read out of its body.** This package ships `"sideEffects": false`,
 * which licenses a bundler to delete a module's evaluation outright. Measured
 * with rolldown 1.2.0 against a shape-faithful mirror of this package: a
 * module-evaluation-time registration is absent from the consumer bundle *even
 * when the consumer imports `CONTRACT_VERSION` itself*, because the constant is
 * inlined and the module's evaluation is then dropped entirely. That form is
 * still present under `node dist/index.js`, so it tests green in Node while
 * being absent from every React or Svelte app — which is the only place two
 * copies can collide. Hoisting this code to module scope looks like a
 * simplification. It is the single edit that silently disarms PKG-04.
 *
 * The tempting escape is not one. `"sideEffects": ["./dist/contract.js"]` would
 * keep the module-scope form alive, but tsdown emits a single bundled
 * `dist/index.js` from one entry, so that carve-out names the whole entry and
 * disables tree-shaking for the entire package — trading PKG-05 away to buy
 * PKG-04. A side-effectful subpath export reintroduces the same problem through
 * a side door and is out of scope for v0.1.
 *
 * **2. No top-level `await` in this file, ever.** A single one breaks
 * `require(esm)` for every CJS consumer on every supported Node line.
 *
 * Like `./types.ts`, this file has no runtime dependency, no framework import,
 * and no DOM access — it must construct on a server under Next App Router,
 * Nuxt, or SvelteKit without guards. It carries **zero imports**: the global
 * object is in `lib: ["ES2022"]`, and any import would enlarge the module graph
 * the PKG-05 probe measures.
 */

// ---------------------------------------------------------------------------
// Contract identity
// ---------------------------------------------------------------------------

/**
 * The shared-runtime contract version that two copies of core compare.
 *
 * Deliberately unannotated, matching {@link MESSAGE_MAX_CHARS} in `./types.ts`
 * rather than the `: 1 = 1` form research first sketched. Under
 * `isolatedDeclarations` the literal type `1` survives into the emitted `.d.ts`
 * either way, so both forms preserve the signal a consumer — and this package's
 * own type tests — read to pin the value; the annotation would buy nothing and
 * would leave this file and `types.ts` disagreeing on house style with no
 * explanation. Annotating it `: number` is the form that genuinely loses
 * something: it discards exactly that literal.
 *
 * **Bump policy.** An integer, bumped only when the *shared runtime contract*
 * changes incompatibly — the bridge registry shape, the dedup key, or the
 * consent record. Not on every release, and not on an additive type change.
 * Phase 2 ships `1`.
 *
 * An integer rather than a string or a semver-ish value: a richer shape buys
 * nothing until there is a compatibility *range* to express, and it is a one-way
 * door once published.
 */
export const CONTRACT_VERSION = 1;

/**
 * The cross-realm slot where two independently-resolved copies of core meet.
 *
 * `Symbol.for` and not `Symbol()`: the identity that matters is the *string*, so
 * that a second copy — a separate module evaluation with its own bindings —
 * computes the same key. A fresh `Symbol()` per copy would hand each one a
 * private slot and the guard would never fire.
 *
 * Annotated `symbol` rather than left to infer `unique symbol`, because nothing
 * here wants the nominal identity of this particular binding; the registry
 * string is the identity. Module-private and deliberately not re-exported from
 * `./index.ts` — a consumer able to reach this key could disarm the guard by
 * seeding the slot.
 */
const REGISTRY_KEY: symbol = Symbol.for("@fullselfbrowsing/concierge.contract");

/**
 * What one copy of core leaves behind for the next one to find.
 *
 * `version` is `number`, not the literal `1`: the record this reads may have
 * been written by a *different* version of this file, which is the entire case
 * the guard exists to detect. Typing it as the literal would make the mismatch
 * branch unreachable to the checker and the comparison a compile error.
 */
interface ContractRecord {
  readonly version: number;
}

/**
 * The global object, viewed as nothing but this one registry slot.
 *
 * Module-private, and deliberately minimal — widening it toward a real global
 * type would pull in the ambient declarations that `lib: ["ES2022"]` exists to
 * keep out of core.
 */
type Holder = Record<symbol, ContractRecord | undefined>;

// ---------------------------------------------------------------------------
// The guard
// ---------------------------------------------------------------------------

/**
 * Record this copy of core in the process-wide registry, and throw if a copy at
 * an incompatible contract version got there first.
 *
 * **Call this from the first reachable entry point** — `createConcierge`,
 * `createBridge`, and each adapter's registration hook — and never at module
 * scope. See constraint 1 in this file's header: module scope does not survive
 * `"sideEffects": false`, so a registration hoisted out of this body is deleted
 * from every bundled consumer.
 *
 * **A same-version duplicate adopts rather than throws.** Two copies at the same
 * contract version share one record and therefore share state, which is exactly
 * what SC-4 asks for — two adapters resolving core independently end up on one
 * core instance. Only a *version* mismatch is a failure. Adopting also keeps
 * ordinary duplicate resolution and dev-server re-evaluation quiet: the record
 * persists across a re-evaluation and the same-version path returns silently.
 *
 * **The mismatch throws from here, not from module evaluation**, for three
 * reasons in order of force:
 *
 * 1. Module-scope code does not survive `"sideEffects": false`, so an
 *    import-time throw is not merely undesirable — it is unreachable in a
 *    bundle.
 * 2. An import-time throw in ESM surfaces as a module-evaluation error with no
 *    useful frame, and under a metaframework's SSR it takes down the whole
 *    render rather than the one feature.
 * 3. By the time this function runs the library owns the stack, so the message
 *    lands next to the API the developer just called.
 *
 * The thrown message carries the two contract versions and the remediation and
 * nothing else — no file paths, no environment values, no user data. This is a
 * developer-time error rather than a dispatcher result, so the project's rule
 * that a crash is one generic sentence does not govern it; what does govern it
 * is that it must never become a channel for anything but its own two integers.
 *
 * **`buildCatalog` in `./catalog.ts` is the first production call site**, added
 * in Phase 3, and it calls this on its first line. That is the earliest entry
 * point every consumer necessarily reaches — there is no way to use this package
 * without building a catalog — so it is the one place a single call covers every
 * app. Phase 2 shipped this guard with no production call site at all; the
 * instruction above is therefore satisfied rather than aspirational.
 *
 * **`createConcierge` in `./concierge.ts` arrived in Phase 4, and it adds no
 * second call here because it reaches this guard transitively.** Assembling a
 * catalog is the first thing it does, so `buildCatalog`'s first line — this
 * function — runs before anything else in its body. A direct call would satisfy
 * the instruction above as well, and would be a documented no-op: the
 * same-version adopt path described above returns silently when a second call
 * arrives at the same contract version. So the direct call was measured
 * unnecessary rather than forgotten, and the sentence that once named
 * `createConcierge` as pending was corrected here rather than left to ship —
 * this comment reaches `dist/index.d.ts` verbatim, and it went false the moment
 * that function landed.
 *
 * **`createBridge` in `./bridge.ts` arrived in Phase 5, and it does add a second
 * call here — it reaches this guard from its own body rather than through
 * anything else.** On the registration side of the instruction above it is
 * the first direct production call site — `buildCatalog` is a direct call too,
 * but it is the catalog path, and `createConcierge` reaches the guard only
 * transitively through it. Registration is also where two copies of core
 * actually bite: a component registers into one instance, a handler reads the
 * other, and `bridge` stays `null` forever on a page that is definitely open.
 *
 * **That narrows the reserved call site rather than closing it**, and the
 * distinction is why this paragraph is re-scoped instead of deleted. An app that
 * calls `createBridge` is now covered. A Phase 9 adapter that is imported and
 * mounted in a module with no `createBridge` call anywhere in its graph is not:
 * it inherits nothing from this call and nothing from `buildCatalog`'s, so it
 * still needs a call of its own, and the site stays named as pending for that
 * case alone. Corrected in place for the same reason as the `createConcierge`
 * sentence above — this comment reaches `dist/index.d.ts` verbatim, and it went
 * partly false the moment `createBridge` landed.
 *
 * Secondarily, this function is exercised by the tests in plan 02-07 and by the
 * Node-floor import harness in plan 02-09.
 */
export function assertSingleInstance(): void {
  const holder: Holder = globalThis as unknown as Holder;
  const prior: ContractRecord | undefined = holder[REGISTRY_KEY];

  if (prior === undefined) {
    holder[REGISTRY_KEY] = { version: CONTRACT_VERSION };
    return;
  }

  if (prior.version === CONTRACT_VERSION) {
    return;
  }

  throw new Error(
    `concierge: two different copies of @fullselfbrowsing/concierge are loaded ` +
      `(contract v${prior.version} and v${CONTRACT_VERSION}). Adapters must ` +
      `resolve the same core instance — check that every ` +
      `@fullselfbrowsing/concierge-* package has core as a peerDependency and ` +
      `that your lockfile has exactly one entry for it. ` +
      `Run: pnpm why @fullselfbrowsing/concierge`,
  );
}
