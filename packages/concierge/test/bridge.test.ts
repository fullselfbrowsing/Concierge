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

// The console-capture idiom, written once and reused, with the four load-bearing
// notes from this file's header. `run` is invoked with a stand-in `console`
// installed; the captured lines are returned.
//
// This exists in TWO registers, and both matter. The warn-policy cases below use
// the returned array as the assertion subject. The ORDERING cases use it as a
// muffler: five of the thirteen orderings displace a still-live registration, so
// they emit a real 340-character `bridge_overwrite` line. MEASURED before this
// file existed — `pnpm test` emitted ZERO `concierge: [` lines across the whole
// suite, because every case in Phase 3 and Phase 4 that provokes a diagnostic
// captures it. Letting eight cases here print would spend that invariant on
// nothing: a suite whose output is full of expected warnings is a suite where an
// UNEXPECTED one is invisible.
//
// All three sinks are stood in, not just `warn`, following
// `concierge.test.ts:1074-1076`: a "warns never" claim that captured only `warn`
// is satisfied by a diagnostic that reached for `console.log`.
function withCapturedWarnings(run: () => void): string[] {
  const realConsole = globalThis.console;
  const captured: string[] = [];
  const sink = (message: string) => {
    captured.push(String(message));
  };

  globalThis.console = { ...realConsole, warn: sink, error: sink, log: sink };

  try {
    run();
  } finally {
    globalThis.console = realConsole;
  }

  return captured;
}

describe("BRG-01 — the unsubscriber clears the slot only when the slot still holds its own registration", () => {
  it("B1 — O6 never registered → read() is null. CONTRACT PIN", () => {
    // CONTRACT PIN. Measured identical across the token guard, the
    // object-identity defect and the naive clear — all three return `null` here,
    // because none of their unsubscribers has run. It pins the initial state and
    // it proves nothing about the guard. Not counted toward BRG-01 or BRG-04
    // coverage; see the contract-pin block in this file's header.
    const registry = createBridge("results");

    expect(registry.read()).toBeNull();
  });

  it("B2 — O1 `reg A(u1); u1(); reg A(u2)` → read() is A. CONTRACT PIN", () => {
    // CONTRACT PIN. This is React StrictMode's double mount with the SAME bridge
    // object, and it is the ordering every reader looks for first — its absence
    // would read as an omission. It is also, measured, identical across the token
    // guard, the object-identity defect and the naive clear: all three return `A`,
    // because the second `register` runs against an already-empty slot and no
    // unsubscriber fires afterwards. Proves nothing about the guard. Not counted
    // toward BRG-01 or BRG-04 coverage; see the contract-pin block in the header.
    // O1b, immediately below in the BRG-04 block, is this ordering plus the one
    // extra step that makes it discriminate.
    const registry = createBridge("results");
    const A = named("A");

    const u1 = registry.register(A);
    u1();
    registry.register(A);

    expect(registry.read()).toBe(A);
  });

  it("B3 — O3 `reg A(u1); u1(); u1(); reg B` → read() is B. CONTRACT PIN", () => {
    // CONTRACT PIN. Pins unsubscriber IDEMPOTENCE — calling the same cleanup
    // twice must not be an error and must not clear anything the second time.
    // Measured identical across all three implementations: the slot is already
    // empty when the second `u1()` runs, so even the unconditional clear has
    // nothing to destroy. Proves nothing about the guard; not counted toward
    // BRG-01 or BRG-04 coverage.
    const registry = createBridge("results");
    const A = named("A");
    const B = named("B");

    const u1 = registry.register(A);
    u1();
    u1();
    registry.register(B);

    expect(registry.read()).toBe(B);
  });

  it("B4 — O5 `reg A; reg B(u2); u2()` → read() is null. CONTRACT PIN", () => {
    // CONTRACT PIN. The ordinary happy path: the LIVE registration unsubscribes
    // itself and the slot empties. Measured identical across all three
    // implementations — the token matches, the bridge object matches, and the
    // unconditional clear clears; every guard agrees when the cleanup is the
    // live one. Proves nothing; not counted toward BRG-01 or BRG-04 coverage.
    const registry = createBridge("results");
    const A = named("A");
    const B = named("B");
    let u2;

    // `reg B` displaces a still-live `A`, so this ordering emits a real
    // `bridge_overwrite` line. Captured to keep the suite's output clean; the
    // warning itself is the subject of B19, not of this case.
    withCapturedWarnings(() => {
      registry.register(A);
      u2 = registry.register(B);
      u2();
    });

    expect(registry.read()).toBeNull();
  });

  it("B5 — O7 `reg A(u1); u1()` → read() is null. CONTRACT PIN", () => {
    // CONTRACT PIN. The simple unmount, and the second of the two orderings a
    // developer writes first. Measured identical across all three
    // implementations. Worth stating plainly: this case and B2 are the two a
    // naive suite contains, and a build with the object-identity defect passes
    // BOTH. Not counted toward BRG-01 or BRG-04 coverage.
    const registry = createBridge("results");
    const A = named("A");

    const u1 = registry.register(A);
    u1();

    expect(registry.read()).toBeNull();
  });

  it("B6 — O2 `reg A(u1); reg B; u1()` → read() is B, the late cleanup is refused", () => {
    // DISCRIMINATES M-05-2, the unconditional clear: the guarded clear becomes a
    // bare `slot = null;`, and this case then returns `null` where the token
    // guard returns `B`. That is the whole failure in one line — a component
    // unmounting AFTER its replacement mounted takes the replacement's
    // registration with it, and the page goes dark with a component still on it.
    //
    // It does NOT discriminate M-05-1: `A` and `B` are distinct objects, so the
    // object guard refuses this cleanup correctly and also returns `B`. The
    // object-identity defect needs the SAME object on both sides, which is B11.
    const registry = createBridge("results");
    const A = named("A");
    const B = named("B");
    let u1;

    withCapturedWarnings(() => {
      u1 = registry.register(A);
      registry.register(B);
      u1();
    });

    expect(registry.read()).toBe(B);
  });

  it("B7 — O3b `reg A(u1); u1(); reg B; u1()` → read() is B, the re-fired stale cleanup is refused", () => {
    // DISCRIMINATES M-05-2: the unconditional clear returns `null` here where the
    // token guard returns `B`. This is B3's idempotence claim carried ACROSS a
    // replacement — the second `u1()` is both stale and a repeat, and it must
    // still be a no-op.
    const registry = createBridge("results");
    const A = named("A");
    const B = named("B");

    const u1 = registry.register(A);
    u1();
    registry.register(B);
    u1();

    expect(registry.read()).toBe(B);
  });

  it("B8 — O4 `reg A; reg B(u2); reg A; u2()` → read() is A, B's cleanup cannot clear the restored A", () => {
    // DISCRIMINATES M-05-2: the unconditional clear returns `null` where the
    // token guard returns `A`. Replace-then-restore — B mounts over A, then A
    // remounts, and only THEN does B's cleanup arrive. The registration standing
    // at the end is A's second one, and B's stale cleanup has no claim on it.
    //
    // Not an M-05-1 detector: the live bridge is `A` and the cleanup captured
    // `B`, so the object guard refuses correctly here too.
    const registry = createBridge("results");
    const A = named("A");
    const B = named("B");
    let u2;

    withCapturedWarnings(() => {
      registry.register(A);
      u2 = registry.register(B);
      registry.register(A);
      u2();
    });

    expect(registry.read()).toBe(A);
  });

  it("B9 — O8 `reg A(u1); reg B(u2); reg C(u3); u2()` → read() is C, the middle of THREE components unmounts late", () => {
    // DISCRIMINATES M-05-2: the unconditional clear returns `null` where the
    // token guard returns `C`. THREE DISTINCT COMPONENTS, and the middle one
    // unmounts last — the shape a route transition produces when an exiting
    // component's cleanup is deferred past the entering component's mount.
    //
    // Not an M-05-1 detector, for the same reason as B8: `u2` captured `B` and
    // the live bridge is `C`.
    //
    // ---------------------------------------------------------------------
    // WHY THIS CASE READS `C` AND NOT `A` — a transcription bug, corrected
    // ---------------------------------------------------------------------
    //
    // `05-RESEARCH.md:725` describes O8 as "three components, middle unmounts
    // late" and then transcribes it as `reg A(u1); reg B(u2); reg A(u3); u2()`
    // — which is TWO components, and which is `O4` exactly. This file inherited
    // that transcription, so B8 and B9 shipped as BYTE-IDENTICAL programs under
    // two different ordering labels; the only textual difference was `u1` and
    // `u3` being named, and capturing an unsubscriber that is never invoked has
    // no observable effect. Verified programmatically: with comments stripped
    // the two case bodies were equal.
    //
    // That matters by this file's own standard rather than as tidiness. The
    // header counts THIRTEEN orderings and the arithmetic at `13 − 4 = 9` is
    // what the corrected agreement figure rests on — and a duplicated case
    // "reads in a diff and in a test report exactly like coverage", which is the
    // Trap 2 failure `export-surface.test.ts` names.
    //
    // The description was right and the program was wrong, so the PROGRAM was
    // corrected rather than the count. RE-MEASURED, all three implementations
    // run over all thirteen orderings with this one spelled as three distinct
    // components:
    //
    //   O8: token = C | object-guarded = C | naive = 🔴 null
    //   object guard agrees on 9 of 13, differing on exactly O1b, O2b, O4b, O4c
    //   naive clear agrees on 5 of 13, differing on O1b, O2, O2b, O3b, O4, O4b, O4c, O8
    //
    // Every number this file asserts therefore survives the correction
    // unchanged, which is the reason this branch was taken over deleting B9 and
    // renumbering to twelve.
    const registry = createBridge("results");
    const A = named("A");
    const B = named("B");
    const C = named("C");
    let u2;

    withCapturedWarnings(() => {
      registry.register(A);
      u2 = registry.register(B);
      registry.register(C);
      u2();
    });

    expect(registry.read()).toBe(C);
  });
});

describe("BRG-04 — a stale unregister from a remounted component cannot clear a newer registration", () => {
  // The four orderings in this block are the ONLY four of the thirteen that
  // discriminate Anti-Pattern 6 (mutant M-05-1: the guard `slot?.token === token`
  // becomes `slot?.bridge === bridge`). Every one of them requires a stale
  // unsubscriber to fire AFTER a replacement whose bridge object is `===` the one
  // that unsubscriber captured — which is why nine of thirteen orderings cannot
  // see the defect at all. On M-05-1 each case below returns `null` where the
  // token guard returns the live bridge; M-05-2, the unconditional clear, returns
  // `null` on all four as well.
  //
  // If this block is ever deleted, BRG-04 is unvalidated and the remaining nine
  // orderings will still be green.

  it("B10 — O1b `reg A(u1); u1(); reg A(u2); u1()` → read() is A, the stale u1 is refused on re-fire", () => {
    // DISCRIMINATES M-05-1 AND M-05-2. This is B2's StrictMode ordering plus one
    // step: the already-spent `u1` fires a second time, after `A` has been
    // re-registered. On the object guard the live slot holds `A` and `u1`
    // captured `A`, so `slot?.bridge === bridge` is TRUE and it clears — read()
    // returns `null` where the token guard returns `A`. The unconditional clear
    // returns `null` too.
    //
    // The pair B2/B10 is the cheapest demonstration in this file that the
    // ordering a developer writes first is one step short of the one that
    // matters.
    const registry = createBridge("results");
    const A = named("A");

    const u1 = registry.register(A);
    u1();
    registry.register(A);
    u1();

    expect(registry.read()).toBe(A);
  });

  it("B11 — O2b `reg A(u1); reg A(u2); u1()` → read() is A, the same object registered twice", () => {
    // DISCRIMINATES M-05-1 AND M-05-2, and it is the MINIMAL spelling of the
    // defect the ROADMAP note names — the whole reason the token exists. On the
    // object guard `slot?.bridge === bridge` is TRUE (both sides are `A`), the
    // stale cleanup clears the LIVE registration, and read() returns `null` where
    // the token guard returns `A`. M-05-2 returns `null` as well.
    //
    // ONE construction, registered twice through the SAME identifier. Building a
    // second structurally identical object here would silently convert this into
    // the distinct-object case (B6) and destroy the discrimination entirely,
    // while every assertion still read as if it were testing the hard case. The
    // real shapes this models are a memoized object literal and a reused Svelte
    // `$state` object, both of which are `===` across a remount.
    const registry = createBridge("results");
    const A = named("A");
    let u1;

    withCapturedWarnings(() => {
      u1 = registry.register(A);
      registry.register(A);
      u1();
    });

    expect(registry.read()).toBe(A);
  });

  it("B12 — O4b `reg A(u1); reg B; reg A(u3); u1()` → read() is A, the first A's cleanup arrives last", () => {
    // DISCRIMINATES M-05-1 AND M-05-2. The realistic one: a component unmounting
    // late after a sibling has come and gone. It uses DISTINCT objects for the
    // two components, which makes it harder to dismiss as contrived — the
    // sameness that defeats the object guard is between A's FIRST and THIRD
    // registrations, not between two different components.
    //
    // On the object guard the live slot holds `A` and `u1` captured `A`, so it
    // clears and read() returns `null` where the token guard returns `A`. M-05-2
    // returns `null` too.
    const registry = createBridge("results");
    const A = named("A");
    const B = named("B");
    let u1;

    withCapturedWarnings(() => {
      u1 = registry.register(A);
      registry.register(B);
      registry.register(A);
      u1();
    });

    expect(registry.read()).toBe(A);
  });

  it("B13 — O4c `reg A(u1); reg A; reg A(u3); u1()` → read() is A, three registrations of one object", () => {
    // DISCRIMINATES M-05-1 AND M-05-2. B12 with the SAME object throughout: every
    // registration is the identical reference, so the object guard has literally
    // no information to distinguish the first registration from the third. It
    // clears, and read() returns `null` where the token guard returns `A`. M-05-2
    // returns `null` as well.
    //
    // ONE construction, registered three times through the SAME identifier —
    // three because that is what this ordering IS; collapsing it to two would
    // make it B11. A monotonic token cannot collide with itself, which is the
    // entire reason this case is green.
    const registry = createBridge("results");
    const A = named("A");
    let u1;

    withCapturedWarnings(() => {
      u1 = registry.register(A);
      registry.register(A);
      registry.register(A);
      u1();
    });

    expect(registry.read()).toBe(A);
  });
});

describe("BRG-02 — a handler reads live app state through snapshot getters", () => {
  it("B14 — read() returns the registered object BY REFERENCE, not a copy of it", () => {
    // The direct detector for the "normalize at `register()` or at `read()`"
    // defect, and for the register-time spelling of mutant M-05-9. `register()`
    // stores the bridge AS GIVEN and `read()` returns it untouched; a normalizer
    // applied at either point returns a DETACHED COPY here, and a detached copy
    // is a different object.
    //
    // `toBe`, never `toEqual` — the claim is reference identity, and a detached
    // copy of this bridge is structurally identical to it, so `toEqual` is green
    // on precisely the build this case exists to catch. This is the same trap
    // `concierge.test.ts`'s defect 1 records for `useSyncExternalStore`.
    const registry = createBridge("results");
    const A = named("A");

    registry.register(A);

    expect(registry.read()).toBe(A);
  });

  it("B15 — the app moves and the SAME read() result reports the new value, with no re-registration", () => {
    // Success criterion 1, and the reason detachment lives at capture time and
    // nowhere else. The snapshot thunk reads THROUGH a mutable closure variable,
    // which is what a real framework binding is: `() => this.state.query` in
    // React, a rune read in Svelte. `move()` is the app changing its own state
    // and it deliberately does not touch the registry.
    //
    // BOTH reads are asserted, the before as well as the after. A case that
    // asserted only the after value would be green on a getter that had been
    // returning "boots" all along — vacuously, for the wrong reason — and green
    // on a build where the read was never live in the first place.
    //
    // `held` is captured ONCE, before the move, and re-read afterwards. There is
    // no `register` call between the two assertions; if there were, this case
    // would prove only that a fresh registration sees fresh state, which is a
    // much weaker claim and is not what a handler does.
    const registry = createBridge("results");
    const { bridge, move } = liveBridge("shoes");

    registry.register(bridge);
    const held = registry.read();

    expect(held.snapshot.query()).toBe("shoes");

    move("boots");

    expect(held.snapshot.query()).toBe("boots");
  });
});

describe("SEC-03 class — the returned registry is a frozen capability object", () => {
  it("B16 — the registry object is frozen", () => {
    // Mutant M-05-7's first detector: `return Object.freeze(registry);` becomes
    // `return registry;`, and this returns `false`.
    const registry = createBridge("results");

    expect(Object.isFrozen(registry)).toBe(true);
  });

  it("B17 — replacing registry.read THROWS, and so does adding a new property", () => {
    // Mutant M-05-7's second detector, and the one that carries the actual
    // security claim. `Object.isFrozen` is asserted separately in B16 and is the
    // WEAKER half: `concierge.test.ts`'s defect 2 records a measured build where
    // `Object.isFrozen` returned `true` and the write went through anyway, so
    // "we froze it so it must be immutable" is how a breach reports success. The
    // consequence is what is asserted here.
    //
    // The registry IS the capability — holding the reference is the
    // authorization — so `registry.read` is precisely the thing worth taking.
    // Left writable, third-party page script in the same realm swaps it for a
    // function returning an attacker-controlled bridge, and every handler in the
    // app then reads attacker state while every check upstream still reports
    // success.
    //
    // These assertions THROW rather than fail silently because ESM modules are
    // strict-mode and this file is a module. Measured against the artifact: both
    // are `TypeError`. In a sloppy-mode context the same two writes would be
    // silent no-ops and `toThrow()` would be the wrong assertion — which is why
    // the strict-mode dependency is written down rather than assumed.
    const registry = createBridge("results");

    expect(() => {
      registry.read = () => null;
    }).toThrow();

    expect(() => {
      registry.extra = 1;
    }).toThrow();
  });

  it("B18 — the freeze seals the OBJECT and not the closure: register() still works after it", () => {
    // Obvious, and asserted anyway. `catalog.ts:601-607` calls the reasoning this
    // guards against "a breach that reports success" — a sealed object whose
    // methods silently stopped working would satisfy B16 and B17 completely while
    // being a registry that cannot register, which is a very safe brick.
    //
    // `slot`, the token counter and the warn latch all live in the closure, not
    // on the frozen object, so `Object.freeze` cannot reach them. This case is
    // what proves that separation is real rather than intended.
    const registry = createBridge("results");
    const A = named("A");

    expect(Object.isFrozen(registry)).toBe(true);

    registry.register(A);

    expect(registry.read()).toBe(A);
  });
});

// The exact rendering recorded as handoff data in `05-01-SUMMARY.md`
// § "The three warn messages, rendered", for a registry whose id is `results`.
// 340 characters, measured by execution against the built artifact rather than
// counted by hand.
//
// This is a deliberate exact-text pin, and it is a different judgement from the
// one this phase made about the off-page sentence. There, a regex over message
// VOCABULARY was rejected because it pins wording rather than meaning and goes
// red on a legitimate rewording. Here the full rendering is a recorded handoff
// artifact that two later plans read, so a rewording SHOULD go red — the point
// is that the record and the code cannot drift apart silently. If the message is
// legitimately reworded, update this literal and `05-01-SUMMARY.md`'s record in
// the same change; the semantic pins in B19 (the code tag, the id, the absent
// secret) are the ones that must never be weakened.
const BRIDGE_OVERWRITE_RENDERED =
  `concierge: [bridge_overwrite] bridge "results": a second component registered ` +
  `over a still-live registration, so the first component's snapshot and actions ` +
  `are no longer reachable through this registry. Fix: make sure exactly one ` +
  `mounted component registers this bridge. This warning fires once per registry, ` +
  `so a later overwrite is silent.`;

describe("the two warn policies — an overwrite warns once, a refused unsubscriber never warns", () => {
  it("B19 — three registrations over a live one produce exactly ONE warning, naming the registry and echoing nothing from the app", () => {
    // Mutant M-05-10's detector: delete the warn-once latch assignment and
    // `captured` becomes 3.
    //
    // The displaced bridge carries a marker in every place a careless
    // implementation might reach for one — the object's own name, an action key
    // and a snapshot key — so the negative assertion below has something real to
    // fail on. Without it, the `catch`-binds-nothing rule and the
    // "diagnostics are built from the id alone" rule are conventions with no
    // guarantee.
    const registry = createBridge("results");
    const displaced = {
      name: "SECRET-FROM-THE-APP",
      actions: { "SECRET-FROM-THE-APP": () => undefined },
      snapshot: { "SECRET-FROM-THE-APP": () => "SECRET-FROM-THE-APP" },
    };

    const captured = withCapturedWarnings(() => {
      registry.register(displaced);
      registry.register(named("second"));
      registry.register(named("third"));
      registry.register(named("fourth"));
    });

    // `toHaveLength(1)`, never `toBeGreaterThan(0)`. FOUR registrations, THREE of
    // them over a still-live registration, ONE warning: the latch is per
    // registry, and one registry has exactly one id, so a boolean carries all the
    // granularity there is. Without the latch a hot-reloading dev session prints
    // this 340-character line on every remount forever, and a warning that prints
    // forever is a warning nobody reads. `toBeGreaterThan(0)` would be green on
    // the unlatched build, which is the entire defect.
    expect(captured).toHaveLength(1);

    // Two expectations, two claims: that the sink FIRED at all, and that what it
    // emitted carried THIS REGISTRY'S identity rather than an aggregated summary
    // line. An app with a bridge per stage gets several of these; a warning that
    // does not name which one is a warning that costs a developer the search.
    expect(captured[0]).toContain("[bridge_overwrite]");
    expect(captured[0]).toContain("results");

    // The executable form of the security decision. The displaced bridge is
    // consumer data assembled from the same user input the rest of the app
    // carries, so a diagnostic that echoed any of it would open the covert
    // channel CLAUDE.md's rule closes for handler exceptions — one layer earlier,
    // and on a path that fires during ordinary development rather than only on a
    // crash.
    expect(captured[0]).not.toContain("SECRET-FROM-THE-APP");

    // …and the whole rendering agrees with the record in `05-01-SUMMARY.md`.
    expect(captured[0]).toBe(BRIDGE_OVERWRITE_RENDERED);
    expect(captured[0].length).toBe(340);
  });

  it("B20 — a refused unsubscriber warns NEVER, so a StrictMode double mount is silent", () => {
    // Mutant M-05-11's detector: add a `warnHost` call to the refusal path and
    // `refusal` below becomes 1.
    //
    // React StrictMode's double mount, Vue HMR and Svelte remount ALL produce
    // refused cleanups by design. A warn on this path therefore fires on every
    // dev mount of every component that registers a bridge — and a channel that
    // cries wolf on correct behaviour is a channel developers filter out, taking
    // the overwrite warning in B19 with it. Refusing quietly is the correct
    // behaviour, not a swallowed error.
    //
    // THE CAPTURE IS SCOPED TO THE REFUSAL, and that scoping is the whole case.
    // The ordering is O2b, whose second `register` displaces a still-live
    // registration and so emits `bridge_overwrite` BY DESIGN — capturing the
    // whole ordering would produce 1, and "a refused unsubscriber warns never"
    // would be untestable in that shape. The setup's single warning is asserted
    // rather than discarded, which also proves the stand-in console is live: a
    // capture that never fired would report 0 for both blocks and let the real
    // assertion below pass vacuously.
    const registry = createBridge("results");
    const A = named("A");
    let u1;

    const setup = withCapturedWarnings(() => {
      u1 = registry.register(A);
      registry.register(A);
    });

    expect(setup).toHaveLength(1);

    const refusal = withCapturedWarnings(() => {
      u1();
    });

    expect(refusal).toHaveLength(0);

    // …and the refusal really was a refusal, not a cleanup that happened to be
    // quiet about clearing the slot.
    expect(registry.read()).toBe(A);
  });

  it("B21 — the ordinary first registration warns not at all", () => {
    // Proves the overwrite warning is CONDITIONAL rather than unconditional.
    // Without this case, a build that warned on every `register()` would still
    // satisfy B19 — its first captured line would carry the code and the id and
    // none of the secret, and `toHaveLength(1)` would hold for a single
    // registration. Every app that uses this package performs this exact
    // sequence once per mounted component, so a warning here fires for everyone,
    // always, on correct usage.
    const registry = createBridge("results");
    const A = named("A");

    const captured = withCapturedWarnings(() => {
      registry.register(A);
    });

    expect(captured).toHaveLength(0);
    expect(registry.read()).toBe(A);
  });
});
