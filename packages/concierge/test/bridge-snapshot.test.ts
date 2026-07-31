// Snapshot capture, detachment and the no-bridge path — BRG-05, BRG-03 and
// DX-02, asserted against the BUILT artifact.
//
// Companion file. `test/bridge.test.ts` owns the registry itself (BRG-01,
// BRG-02, BRG-04). This file owns what happens to a snapshot at capture time,
// and what happens when there is no bridge to capture from. Disjoint concerns,
// one `pnpm test -- bridge` filter.
//
// What escapes without this file:
//
// Five defects. Four of them pass every naive test, and the first one is a
// SECURITY defect rather than a hygiene one.
//
//   1. THE FREEZE-IN-PLACE DEFAULT. `types.ts` shipped — into
//      `dist/index.d.ts`, twice — the claim that leaving `normalizeSnapshot`
//      unset gets you a recursive freeze applied in place. Plan 05-02 corrected
//      the prose; this file is what stops the implementation drifting back to
//      it. Freezing a `Proxy` does not detach it: the freeze fires the proxy's
//      WRITE traps (`preventExtensions`, `defineProperty`) and never reads a
//      value, so the stored "snapshot" is still a live view of the app's store.
//
//      That is not a slow snapshot, it is an open consent gate. Phase 8's
//      CON-04 drift check compares the payload the human confirmed against the
//      payload about to execute. If the captured side is a live view, the check
//      compares a value against ITSELF and passes unconditionally — with every
//      naive test green, because a live view has exactly the right shape and
//      exactly the right contents at the moment you assert on it. The whole
//      project's core value ("a human, not the agent, confirmed THIS payload")
//      rests on the captured side being dead. D1 is the detector.
//
//   2. THE FIXTURE TRAP — three of five hand-rolled proxy shapes give a
//      MISLEADING result under that mutant, so choosing the fixture is choosing
//      whether the test can discriminate at all. Measured across all five, with
//      `Object.freeze(value)` substituted for the clone:
//
//      | Shape                                                    | Under the mutant                                                                                  | Verdict for this file                            |
//      |----------------------------------------------------------|---------------------------------------------------------------------------------------------------|--------------------------------------------------|
//      | A — forwarding proxy, target HOLDS the values             | appears detached, but the app's own store is now frozen solid; its next write throws                | MUTANT PASSES WHILE DESTROYING THE APP — worst    |
//      | B — signal-backed, target is a husk                       | throws `TypeError: 'ownKeys' on proxy: trap returned extra keys but proxy target is non-extensible` | "caught" for the wrong reason — proves the proxy is malformed |
//      | E — read-only view proxy                                  | throws `TypeError: 'preventExtensions' on proxy…`                                                   | same                                              |
//      | F — accessor-backed target, all traps forwarding to `Reflect` | reads `"boots"` where the test asserted `"shoes"`; NO throw, NO collateral                      | THE ONLY CORRECT FIXTURE                          |
//      | C — plain object carrying a getter, no proxy              | accessor skipped, stays live                                                                        | correct but weaker; no proxy involved             |
//
//      Shape F is used for that reason and MUST NOT be "simplified" to a
//      signal-backed proxy — which is the intuitive way to hand-roll a reactive
//      one, and is shape B. A test that reddens by throwing has proved its own
//      fixture is malformed, not that the normalizer fails to detach.
//
//   3. THE NARROW `try`. Scoping the capture loop's `try` to `snapshot[key]()`
//      alone LOOKS complete — it catches the getter that throws. It does not
//      catch a getter nested INSIDE the returned value: measured, that one
//      throws from inside the normalizer, during the clone, after the outer
//      getter has already returned successfully. The `Error` escapes
//      `captureSnapshot` to the caller carrying whatever message the consumer's
//      own code put in it — which in a real app is assembled from the same user
//      input the component renders. That is the covert PII channel CLAUDE.md
//      closes for handler exceptions, one layer earlier and on a hotter path.
//      D11 is its only detector; D10 alone is green under the narrow `try`.
//
//   4. THE `Object.create(null)` ARM. Plain-object detection is
//      `proto === Object.prototype || proto === null`. Dropping the second arm
//      silently passes a null-prototype record through UNDETACHED — and a suite
//      that only ever snapshots object literals never notices, because every
//      literal it writes has `Object.prototype`. That shape is not exotic here:
//      it is exactly what `Catalog.byName` is built with. D6 is the detector.
//
//   5. THE PROXIED `Date`. A naively proxied `Date` is unextractable through
//      the proxy by EVERY route measured — six of them, every one a
//      `TypeError`: `getTime()`, `Number(pd)`, `+pd`, `valueOf()`,
//      `toISOString()`, and `Date.prototype.getTime.call(pd)`. A clone branch
//      that detects `Date` without a `catch` therefore crashes the whole
//      capture path on a value one framework's `reactive()` can hand it. D12
//      asserts the fallback: no throw, value by reference, and a warn with a
//      code distinct from the throwing-getter one.
//
// ---------------------------------------------------------------------------
// Case ids
// ---------------------------------------------------------------------------
//
// Prefix `D` (detachment), file-scoped and sequential. `C`, `F`, `S` and `B`
// are already taken by `catalog.test.ts`, `single-instance.test.ts`,
// `concierge.test.ts` and `bridge.test.ts` respectively; numbering is per file
// and must not continue another file's.

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
let captureSnapshot;
let offPageResult;
let createConcierge;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      `packages/concierge/dist/index.js is missing. These tests run against the ` +
        `BUILT artifact, not the source. Run \`pnpm build\` first.`,
    );
  }

  const artifact = await import(DIST_URL.href);
  createBridge = artifact.createBridge;
  captureSnapshot = artifact.captureSnapshot;
  offPageResult = artifact.offPageResult;
  createConcierge = artifact.createConcierge;
});

// `delete`, not assignment to `undefined` — the same reset, and the same
// reasoning, as `single-instance.test.ts:68-82`. `assertSingleInstance`
// branches on `prior === undefined`, so the slot must be genuinely absent.
//
// Two entry points in this file reach that guard, not one: `createBridge` calls
// it from its own body (Phase 5), and `createConcierge` reaches it transitively
// through `buildCatalog`. Either one left over from a previous case would make
// the next case's first construction look like a second copy of the package.
beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

// ---------------------------------------------------------------------------
// The Shape F fixture — INLINE, and inline is a requirement
// ---------------------------------------------------------------------------
//
// This factory does NOT go in `test/fixtures/`. `scripts/pack-install-check.sh`
// copies that directory wholesale into a foreign scratch project, and a sibling
// module placed there gets pulled into that program by accident —
// `test/fixtures/probe.ts`'s own header states it "is never compiled by this
// repository", which is true of `probe.ts` and would stop being true of the
// directory the moment a file that IS only for vitest joined it.
//
// TWO PROPERTIES MAKE THE MUTANT FAIL CORRECTLY, and both are deliberate:
//
//   - THE TARGET IS ACCESSOR-BACKED. Its properties are `get`/`set` pairs over
//     a separate backing record rather than data properties holding the values.
//     Freezing an accessor property only makes it non-configurable; the getter
//     survives and keeps reading the live backing record, so a freeze-in-place
//     mutant produces a snapshot that VISIBLY follows the store instead of one
//     that throws. It also means the app's own data is never what got frozen —
//     the store stays writable, so the mutant does no collateral damage the
//     test could mistake for the defect.
//
//   - EVERY TRAP FORWARDS HONESTLY TO `Reflect`. A trap that lies about
//     `ownKeys` or `preventExtensions` relative to its target makes the runtime
//     enforce proxy invariants and THROW — that is shape B and shape E, and a
//     test that reddens by throwing has proved its fixture is malformed, not
//     that the normalizer failed to detach.
//
// Do not "simplify" this to a signal-backed proxy whose target is a husk. That
// is the intuitive way to hand-roll a reactive store and it is shape B.
function makeReactiveStore() {
  const backing: Record<string, unknown> = { q: "shoes", page: 1 };
  const target: Record<string, unknown> = {};

  for (const k of Object.keys(backing)) {
    Object.defineProperty(target, k, {
      get: () => backing[k],
      set: (v) => {
        backing[k] = v;
      },
      enumerable: true,
      configurable: true,
    });
  }

  const proxy = new Proxy(target, {
    get: (t, k, r) => Reflect.get(t, k, r),
    set: (t, k, v, r) => Reflect.set(t, k, v, r),
    ownKeys: (t) => Reflect.ownKeys(t),
    getOwnPropertyDescriptor: (t, k) => Reflect.getOwnPropertyDescriptor(t, k),
    defineProperty: (t, k, d) => Reflect.defineProperty(t, k, d),
    preventExtensions: (t) => Reflect.preventExtensions(t),
  });

  // The test writes through `backing` and asserts the captured snapshot did not
  // move. Handing both back is what makes "the app moved" and "the snapshot did
  // not" two separately observable facts rather than one.
  return { proxy, backing };
}

describe("BRG-05 — a snapshot captured from a proxy-backed store does not move when the store moves", () => {
  it("D1 — success criterion 4: captured stays \"shoes\" while the store moves to \"boots\", and the store is not frozen", () => {
    // A hand-rolled `Proxy`, in core, before any framework adapter exists —
    // CONTEXT requires criterion 4 to be demonstrated at this layer. Nothing in
    // this file imports react, vue or svelte.
    const { proxy, backing } = makeReactiveStore();

    const bridge = { actions: {}, snapshot: { filters: () => proxy } };
    const registry = createBridge("results");
    registry.register(bridge);

    // NO NORMALIZER ARGUMENT. The default clone is the thing under test; a
    // caller-supplied `normalize` would replace it and this case would assert
    // nothing about the shipped default.
    const captured = captureSnapshot(registry.read(), "results");

    // 1. BEFORE THE STORE MOVES. Without this the case could pass vacuously on
    //    a capture that returned `undefined` for every key — `undefined` is not
    //    `"boots"` either, so assertion 2 alone does not distinguish "detached"
    //    from "captured nothing".
    expect(captured.filters.q).toBe("shoes");

    // The app moves, written through the backing record so the accessor and the
    // proxy both see it the way a real reactive store would.
    backing["q"] = "boots";

    // 2. DETACHMENT. The captured value did not follow.
    expect(captured.filters.q).toBe("shoes");

    // 3. THE STORE GENUINELY MOVED, so assertion 2 is not passing because
    //    nothing happened. A fixture whose write silently failed would make
    //    assertion 2 green on an implementation that detaches nothing at all.
    expect(proxy.q).toBe("boots");

    // 4. AND WE DID NOT DETACH BY BREAKING THE APP. This is the ONLY detector
    //    for the freeze-the-app failure mode: under a Shape A fixture plus a
    //    freeze-in-place normalizer, assertions 2 AND 3 both pass while the
    //    consumer's store is frozen solid and their next write throws inside
    //    their own code. Freezing a value we did not construct is a bug, not a
    //    safety measure.
    expect(Object.isFrozen(proxy)).toBe(false);

    // MUTANT M-05-3 — replacing `cloneDetached(value, seen, onExotic) as T`
    // with `Object.freeze(value) as T` in `src/bridge.ts`. Re-measured:
    //
    //   CORRECT:  capturedBefore=shoes  capturedAfter=shoes  proxyAfter=boots  isFrozen(proxy)=false
    //   MUTANT:   capturedBefore=shoes  capturedAfter=boots  proxyAfter=boots  isFrozen(proxy)=true
    //
    // ASSERTIONS 2 AND 4 GO RED, with no throw and no `TypeError` anywhere in
    // the output. Assertions 1 and 3 stay GREEN under the mutant and that is
    // not an oversight: assertion 1 runs before the store moves, and assertion
    // 3 asserts that the store moved — which it does under both
    // implementations. Naming the wrong two here would mis-record the result in
    // plan 05-07, whose battery requires the failing case names as evidence.
    //
    // A PASS whose output names `TypeError` means the FIXTURE is wrong (shape B
    // or E crept in), not that the normalizer is.
  });
});
