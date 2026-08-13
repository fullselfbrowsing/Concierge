/**
 * Concierge contract identity — the single-instance guard (PKG-04).
 *
 * This is the first executable code in the package, and two constraints on it
 * are load-bearing enough that breaking either leaves a guard which reports
 * success while doing nothing at all.
 *
 * **1. Never call `assertSingleInstance` at module scope, and never move the
 * registry read out of its body.** This package ships `"sideEffects": false`,
 * which licenses a bundler to delete module evaluation when no retained runtime
 * reference keeps it reachable. Measured with rolldown 1.2.0 against a
 * shape-faithful mirror of this package: a module-evaluation-time registration
 * is absent from the consumer bundle *even when the consumer imports
 * `CONTRACT_VERSION` itself*, because the constant is inlined and the module's
 * evaluation is then dropped. A retained function that reads registry state
 * keeps that state and read reachable, which is why the guard remains inside
 * retained API call paths. The hoisted form still appears under
 * `node dist/index.js`, so Node-only checks can miss the elision that silently
 * disarms PKG-04.
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
 * rather than an explicit literal annotation. Under `isolatedDeclarations`
 * the literal type `2` survives into the emitted `.d.ts`
 * either way, so both forms preserve the signal a consumer — and this package's
 * own type tests — read to pin the value; the annotation would buy nothing and
 * would leave this file and `types.ts` disagreeing on house style with no
 * explanation. Annotating it `: number` is the form that genuinely loses
 * something: it discards exactly that literal.
 *
 * **Bump policy.** An integer, bumped only when the *shared runtime contract*
 * changes incompatibly — the bridge registry shape, the dedup key, or the
 * consent record. Not on every release, and not on an additive type change.
 * Contract v2 ships `2`.
 *
 * An integer rather than a string or a semver-ish value: a richer shape buys
 * nothing until there is a compatibility *range* to express, and it is a one-way
 * door once published.
 */
export const CONTRACT_VERSION = 2;

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
 * `version` is `number`, not the literal `2`: the record this reads may have
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
 * Record this copy of core in the process-wide registry and reject an
 * incompatible contract version.
 *
 * Call from retained public entry points, never module evaluation: this package
 * is side-effect-free, so a bundler may erase unreferenced module work. Copies
 * at the same version adopt the existing record; only a version mismatch
 * throws. The error contains contract versions and remediation, never app data.
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
