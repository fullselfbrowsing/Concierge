// The bridge REGISTRY's behaviour — BRG-01, BRG-02, BRG-04, the frozen-capability
// guarantee and the two warn policies, asserted against the BUILT artifact.
//
// SCOPE. This file owns the registry. Capture, detachment and the no-bridge path
// (`captureSnapshot`, `offPageResult`) are asserted in
// `test/bridge-snapshot.test.ts`. The two files own disjoint concerns, run in the
// same wave, and both match the `pnpm test -- bridge` filter. `05-VALIDATION.md`'s
// Wave 0 list names only `test/bridge.test.ts`; the split is recorded here so a
// later reader does not read it as an omission.
//
// What escapes without this file:
//
// Five defects, and every one of them passes a naive test.
//
//   1. THE OBJECT-IDENTITY GUARD (Anti-Pattern 6). Guarding the unsubscriber on
//      `slot.bridge === bridge` instead of on the monotonic token is the shape a
//      reviewer reads as obviously correct, and it is the one that breaks the
//      page. MEASURED, this session, by running all thirteen mount/unmount
//      orderings against three implementations of the same registry — the token
//      guard (correct), the object guard (this defect), and the unconditional
//      clear:
//
//        object-guarded agrees with the token guard on:  9 of 13
//        unconditional clear agrees with the token guard on:  5 of 13
//
//      So the object guard survives nine of thirteen orderings, INCLUDING both of
//      the two a developer writes first — O1, the React StrictMode double mount,
//      and O7, the simple register-then-unmount. Only O1b, O2b, O4b and O4c catch
//      it, and every one of those four requires a stale unsubscriber to fire
//      AFTER a replacement whose bridge object is `===` the one that unsubscriber
//      captured. That is the load-bearing case and it is the hard one: a
//      component re-registering a memoized literal, or a reused `$state` object.
//      When the guard is wrong there, the stale cleanup matches the LIVE
//      registration and clears it, and every handler afterwards reads `null` on a
//      page where every component is still mounted.
//
//      Recorded because the number moved: `src/bridge.ts`'s guard comment and
//      `05-04-PLAN.md` both say "ten of thirteen". The re-measurement above says
//      NINE — the object guard differs from the token guard on exactly O1b, O2b,
//      O4b and O4c, and 13 − 4 = 9. The count is written here as measured rather
//      than as inherited; the source comment is one plan away from being
//      corrected and this file does not modify source.
//
//   2. THE UNCONDITIONAL CLEAR — an unsubscriber that runs `slot = null` with no
//      guard at all. MEASURED at 5 of 13 agreement above, so eight orderings
//      catch it: O1b, O2, O2b, O3b, O4, O4b, O4c and O8. The five listed in the
//      contract-pin block below catch NOTHING, which is the point of that block:
//      a suite made only of the orderings that read naturally is green on this
//      build.
//
//   3. NORMALIZING AT `register()` OR AT `read()`. Either one freezes the app's
//      state at MOUNT time and breaks BRG-02 — the handler would read the
//      mount-time value forever. This is the defect that looks correct on the
//      first read and is wrong on every subsequent one, which is exactly why a
//      single-read test cannot see it. MEASURED against the artifact: a bridge
//      whose snapshot thunk closes over a mutable variable reads `"shoes"`, the
//      app writes `"boots"`, and the SAME `read()` result then reads `"boots"`
//      with no re-registration in between. B15 asserts both halves, before and
//      after, so a getter that was always returning the new value cannot pass it
//      vacuously. B14 is the direct detector: `read()` must be reference-identical
//      to the object handed to `register()`, and a normalizer at either point
//      returns a detached copy there.
//
//   4. AN UNFROZEN REGISTRY OBJECT. The registry IS the capability — holding the
//      reference is the authorization — so `registry.read` is precisely the thing
//      worth taking. Left writable, third-party page script in the same realm
//      swaps it for a function returning an attacker-controlled bridge, and every
//      handler in the app reads attacker state while every check upstream still
//      reports success. MEASURED against the artifact: `Object.isFrozen(registry)`
//      is `true`, and BOTH `registry.read = fn` and `registry.extra = 1` throw
//      `TypeError`. The throws are asserted alongside `isFrozen` rather than
//      instead of it, because "we froze it so it must be immutable" is how a
//      breach reports success — `concierge.test.ts`'s defect 2 records a build
//      where `Object.isFrozen` returned `true` and the write went through anyway.
//
//   5. A WARN ON THE REFUSED UNSUBSCRIBER. Refusing a stale cleanup is correct
//      behaviour, not a swallowed error, so it must be SILENT. React StrictMode's
//      double mount, Vue HMR and Svelte remount all produce refused cleanups BY
//      DESIGN, so a warn on that path fires on every dev mount — and a warning
//      that fires on every mount trains developers to ignore the one diagnostic
//      channel this package has. B20 runs O2b under console capture and asserts
//      ZERO warnings, which is the only assertion that is false on that build:
//      every structural claim about the refusal (that it is a no-op, that `read()`
//      still returns the live bridge) is true on the warning build too.
//
// ---------------------------------------------------------------------------
// Five of the thirteen orderings in this file are CONTRACT PINS, not validation
// ---------------------------------------------------------------------------
//
// The house convention when a test cannot tell the builds apart is to write the
// truth into the file rather than let the count read as coverage.
// `export-surface.test.ts`'s Trap 2 (`:31-46`) is the precedent — a guard that
// passes vacuously "reads in a diff and in a test report exactly like coverage",
// and `02-VALIDATION.md` names it explicitly as something that must not be
// counted as a passing check. `concierge.test.ts:90-111` is the same move for two
// behaviours with no single-literal mutant.
//
// MEASURED: five of the thirteen orderings below — O1, O3, O5, O6 and O7 —
// produce IDENTICAL results on the correct token guard, on the object-identity
// defect, and on the unconditional clear. They discriminate nothing. They must
// NOT be counted toward BRG-01 or BRG-04 coverage.
//
//   O1  — the ordering every reader looks for first; its absence reads as an
//         omission. Identical across all three implementations.
//   O3  — pins unsubscriber idempotence. Identical across all three.
//   O5  — pins the ordinary happy path. Identical across all three.
//   O6  — pins the initial state. Identical across all three.
//   O7  — pins the simple unmount. Identical across all three.
//
// EXACTLY FOUR orderings discriminate Anti-Pattern 6: O1b, O2b, O4b and O4c.
// Counting O1 or O3 toward coverage would be the false-coverage failure Trap 2
// already warns about. Each of the five carries the same label inline, at its own
// case, so that a reader who arrives at one of them without reading this header
// still cannot mistake it for proof.
//
// ---------------------------------------------------------------------------
// Console capture — the idiom this file uses, declared once here
// ---------------------------------------------------------------------------
//
// The warn-policy cases capture `console` by PLAIN GLOBAL ASSIGNMENT
// (`globalThis.console = { ...realConsole, warn: sink }`), never the Vitest
// mocking API (`spyOn`, `fn`, `mock`). A grep for that API's namespace prefix
// over `test/` returns 0 across every file today and must still return 0
// afterwards — which is also why this note spells the prefix out in prose rather
// than writing it, since the acceptance check for the rule is not scoped to
// non-comment lines. The repository's prohibition is on the mocking API, not on
// assigning a global.
//
// Three more notes, each load-bearing, carried forward from
// `catalog.test.ts:454-471` and `concierge.test.ts:1054-1095`:
//
//   - The real console is SPREAD rather than replaced wholesale, so an unrelated
//     `console.error` from Vitest itself does not become "undefined is not a
//     function" while the stand-in is installed.
//   - Restoration happens in a `finally`, never after the assertions. A throwing
//     expectation would otherwise leave a stand-in console installed for every
//     later case in this file.
//   - No cast ceremony is needed for the assignment even though `console` is not
//     type-visible inside core under `lib: ["ES2022"]`: this file is in NO
//     TypeScript program (see `vitest.config.ts`).
//
// ---------------------------------------------------------------------------
// Case ids, and a note on mutation anchors
// ---------------------------------------------------------------------------
//
// Case ids in this file use the `B` prefix and are file-scoped and sequential.
// The prefixes already in use across `test/` are `C` (catalog.test.ts, C1-C26),
// `F` (single-instance.test.ts, F1a-F5) and `S` (concierge.test.ts, S1-S27). `S`
// is NOT continued — the numbering is per-file and Phase 4 owns S1-S27.
//
// `scripts/mutate-and-prove.sh` slurps a whole file and does not skip comments,
// so 05-01 established the convention that every doc-comment reference to an
// anchored expression is deliberately one token short of the anchor. This file
// follows it: the M-05-1 anchor is named below as `slot?.token === token` without
// its enclosing `if (`, so no comment here can be substituted in place of code.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);

// Hard-coded, not imported, for the same reason `single-instance.test.ts:44-53`
// hard-codes it: the registry key is a cross-realm contract between two copies
// of this package that share no bindings, so its identity is the STRING and
// nothing else. Importing the symbol from the artifact under test would make
// this suite agree with whatever the artifact happens to say.
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");

// Bound in `beforeAll` rather than imported statically. A static
// `import { createBridge } from "../dist/index.js"` would fail with an opaque
// module-resolution error on a fresh checkout, BEFORE the existence guard below
// could produce the sentence that tells a developer to run `pnpm build`. Left
// unannotated on purpose: a dynamic import yields untyped bindings, and
// annotating them would be a claim this file has no program to check.
let createBridge;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      `packages/concierge/dist/index.js is missing. These tests run against the ` +
        `BUILT artifact, not the source. Run \`pnpm build\` first.`,
    );
  }

  const artifact = await import(DIST_URL.href);
  createBridge = artifact.createBridge;
});

// REQUIRED, and the easiest thing in this file to omit: `createBridge` calls
// `assertSingleInstance`, so this file needs the same reset
// `concierge.test.ts:347-352` uses.
//
// `delete`, not assignment to `undefined` — the same reset, and the same
// reasoning, as `single-instance.test.ts:68-82`. `assertSingleInstance` branches
// on `prior === undefined`, so the slot must be genuinely ABSENT; writing
// `undefined` into it leaves an own property whose presence a later guard can
// see.
beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

// ---------------------------------------------------------------------------
// Local factories
// ---------------------------------------------------------------------------
//
// Both live inline in this file. Nothing here goes into `test/fixtures/`:
// `scripts/pack-install-check.sh` copies that directory into a foreign scratch
// project, and a sibling module gets pulled into that program by accident.

// A distinct bridge object carrying a name, so that a failed identity assertion
// reports WHICH object it got rather than two indistinguishable `{}`s. The
// `Bridge` shape is `{ actions, snapshot }`; `name` is an extra own property,
// which is legal at runtime and is the only thing that makes the diff readable.
function named(name: string) {
  return {
    name,
    actions: {},
    snapshot: { marker: () => name },
  };
}

// A bridge whose snapshot thunk reads THROUGH a mutable closure variable, plus
// the mover that writes it. This is the BRG-02 fixture: `move()` is the app
// changing its own state, and it deliberately does NOT touch the registry, so a
// case can read twice across a state change with no `register` call in between.
function liveBridge(initial: string) {
  let value = initial;
  return {
    bridge: {
      actions: {},
      snapshot: { query: () => value },
    },
    move(next: string) {
      value = next;
    },
  };
}

describe("BRG-01 — the unsubscriber clears the slot only when the slot still holds its own registration", () => {
  it("B1 — O6 never registered → read() is null", () => {
    // CONTRACT PIN. Measured identical across the token guard, the
    // object-identity defect and the naive clear — all three return `null` here,
    // because none of their unsubscribers has run. It pins the initial state and
    // it proves nothing about the guard. Not counted toward BRG-01 or BRG-04
    // coverage; see the contract-pin block in this file's header.
    const registry = createBridge("results");

    expect(registry.read()).toBeNull();
  });
});
