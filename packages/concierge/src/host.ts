/**
 * The host seam — the single sanctioned place where core reaches a host
 * capability it cannot type-see.
 *
 * Core compiles under `lib: ["ES2022"]` with no DOM types and no `@types/node`.
 * That is the mechanism keeping `window`, `document` and `navigator` out of a
 * package which must construct on the server under Next App Router, Nuxt and
 * SvelteKit with no environment guards. The price of the guarantee is that a
 * few genuinely universal host globals are invisible to the checker as well.
 * Core reaches two of them here: the warning console and the cancellable timer
 * used by the dispatcher commit window.
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
 * 3. Each capability is optional at the type level. A host with no console is
 *    supported, and a host missing either timer function reports no Scheduler
 *    rather than exposing a partial one.
 *
 * **The timer is the second occupant of this seam.** `setTimeout` is TS2304
 * under `lib: ["ES2022"]`, so {@link readHostScheduler} reaches both scheduling
 * and cancellation structurally. The adapter carries no DOM or Node handle
 * type and reads the host only when called, preserving the same SSR and
 * tree-shaking constraints as the console seam.
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

/**
 * The host timer, viewed as only the two capabilities a cancellable Scheduler
 * requires. Both are optional so a partial or timerless host can be detected
 * without importing a platform timer type.
 */
interface TimerHost {
  setTimeout?(fn: () => void, delayMs: number): unknown;
  clearTimeout?(handle: unknown): void;
}

// ---------------------------------------------------------------------------
// The seam
// ---------------------------------------------------------------------------

/**
 * Read a cancellable Scheduler from the host, or report that none is available.
 *
 * Both functions are captured from the same minimal host view and invoked with
 * that host as their receiver. The returned canceller is idempotent even when
 * the host's `clearTimeout` throws: the attempt is marked before the host call,
 * so cancellation reaches the capability at most once.
 */
export function readHostScheduler():
  | ((fn: () => void, delayMs: number) => () => void)
  | undefined {
  const host: TimerHost = globalThis as TimerHost;
  const schedule: TimerHost["setTimeout"] = host.setTimeout;
  const clear: TimerHost["clearTimeout"] = host.clearTimeout;

  if (schedule === undefined || clear === undefined) {
    return undefined;
  }

  return (fn: () => void, delayMs: number): (() => void) => {
    const handle: unknown = schedule.call(host, fn, delayMs);
    let cancelled: boolean = false;

    return (): void => {
      if (cancelled) {
        return;
      }
      cancelled = true;
      clear.call(host, handle);
    };
  };
}

/**
 * Write one developer-facing warning to the host, if the host has anywhere to
 * write it.
 *
 * **Silent on a host with no console, by design.** A diagnostic that cannot be
 * printed is not a reason to fail a build. This is the convenience channel; the
 * assertable one is the `diagnostics` array `buildCatalog` returns, and the
 * redirectable one is its `onDiagnostic` hook. A consumer who needs to observe
 * these reliably uses the hook and depends on no host global whatsoever.
 */
export function warnHost(message: string): void {
  const host: { console?: ConsoleLike | null } = globalThis as {
    console?: ConsoleLike | null;
  };
  let consoleLike: ConsoleLike | null | undefined;
  try {
    consoleLike = host.console;
  } catch {
    return;
  }
  if (consoleLike === undefined || consoleLike === null) {
    return;
  }

  let warn: unknown;
  try {
    warn = (consoleLike as unknown as { warn?: unknown }).warn;
  } catch {
    return;
  }
  if (typeof warn !== "function") {
    return;
  }

  try {
    (warn as (message: string) => void).call(consoleLike, message);
  } catch {
    // A convenience diagnostic can never become application control flow.
  }
}
