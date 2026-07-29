/**
 * The host seam — the single sanctioned place where core reaches a host
 * capability it cannot type-see.
 *
 * Core compiles under `lib: ["ES2022"]` with no DOM types and no `@types/node`.
 * That is the mechanism keeping `window`, `document` and `navigator` out of a
 * package which must construct on the server under Next App Router, Nuxt and
 * SvelteKit with no environment guards. The price of the guarantee is that a
 * few genuinely universal host globals are invisible to the checker as well,
 * and `console` is the first one core actually needs.
 *
 * **The invisibility was measured, not assumed.** A suppression directive
 * placed above a bare `const c = console;` did **not** report an
 * unused-directive diagnostic — which is the proof that the error underneath it
 * is real rather than a stale belief about the lib set. The same holds for
 * `structuredClone` and, per `.planning/STATE.md`, for `setTimeout`.
 *
 * **Both obvious repairs are forbidden.** Adding `@types/node` is named in
 * `CLAUDE.md`'s *What NOT to Use*: it "pulls DOM-adjacent globals and silently
 * defeats the no-DOM guarantee". Reaching for `node:console` is worse — it is a
 * module dependency in a package whose PKG-05 probe asserts an empty external
 * graph, and it does not exist in a browser at all.
 *
 * **The sanctioned form is a structural read of `globalThis`**, and it is not a
 * new pattern: `./contract.ts:92-99` and `:145-152` already do exactly this for
 * the contract registry. Three conventions carry over from there, and anything
 * added to this file should keep all three.
 *
 * 1. The view type is module-private and deliberately minimal. Widening it
 *    toward a real global type would pull in the ambient declarations that
 *    `lib: ["ES2022"]` exists to keep out of core.
 * 2. The cast happens **inside a function body**, with the local annotated —
 *    never at module scope, which `"sideEffects": false` licenses a bundler to
 *    delete outright.
 * 3. The capability is optional at the type level and may be absent at runtime
 *    with no consequence. A host with no console is a supported host.
 *
 * **The second occupant of this seam is already scheduled.**
 * `.planning/STATE.md` records `setTimeout` as deferred to Phase 6 for
 * precisely this reason — it is TS2304 under `lib: ["ES2022"]`, so
 * `ConciergeConfig`'s optional `Scheduler` has nothing to default to. When
 * Phase 6 reaches a platform timer structurally, it belongs here rather than in
 * a second ad-hoc cast somewhere else. That deferral is written down; it should
 * not quietly acquire a second unnamed instance.
 *
 * **What does NOT need a seam**, measured type-visible under `lib: ["ES2022"]`
 * and therefore used directly: `AggregateError`, the two-argument
 * `Error(message, { cause })` form, `Object.hasOwn`, `Reflect.ownKeys` and
 * `Reflect.getOwnPropertyDescriptor`. This file is for the genuinely invisible
 * only. Every addition widens the surface core assumes about its host, so the
 * bar for adding one is a measured compile error, not a convenience.
 *
 * Like `./types.ts`, `./contract.ts` and `./json-schema.ts`, this file has no
 * runtime dependency, no framework reference and no DOM access. It carries
 * **zero** module specifiers of any kind — not even a type-only one — so it
 * contributes nothing to the module graph the PKG-05 probe measures.
 */

// ---------------------------------------------------------------------------
// The host's view type
// ---------------------------------------------------------------------------

/**
 * The host console, viewed as nothing but the one method core calls.
 *
 * Module-private and minimal, following `Holder` in `./contract.ts`. `warn`
 * takes a single `string` rather than the platform's variadic
 * `(...args: unknown[])`: core only ever hands it one already-composed
 * sentence, and every real console satisfies the narrower shape.
 */
interface ConsoleLike {
  warn: (message: string) => void;
}

// ---------------------------------------------------------------------------
// The seam
// ---------------------------------------------------------------------------

/**
 * Write one developer-facing warning to the host, if the host has anywhere to
 * write it.
 *
 * Optional-chained rather than branched on `undefined`. `contract.ts` uses the
 * explicit branch because it has a second thing to do in the absent case
 * (seeding the registry); this has none, so the branch would be ceremony.
 *
 * **Silent on a host with no console, by design.** A diagnostic that cannot be
 * printed is not a reason to fail a build. This is the convenience channel; the
 * assertable one is the `diagnostics` array `buildCatalog` returns, and the
 * redirectable one is its `onDiagnostic` hook. A consumer who needs to observe
 * these reliably uses the hook and depends on no host global whatsoever.
 */
export function warnHost(message: string): void {
  const host: { console?: ConsoleLike } = globalThis as { console?: ConsoleLike };
  host.console?.warn(message);
}
