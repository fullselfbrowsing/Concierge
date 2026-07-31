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
// `node:vm` is here for ONE reason: `D26` needs a genuine second realm. The
// clone's plain-object test is `Object.getPrototypeOf(obj) === Object.prototype`,
// and a cross-realm object fails it while being, to every other eye, a plain
// object — which is exactly the miss the source comment calls "the SAFE failure
// direction". There is no way to construct that shape in-realm, so the claim is
// either executed against a real realm boundary or it is prose.
import { runInNewContext } from "node:vm";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { zodEmptyObject, zodObject } from "./fixtures/schemas.js";

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
// Read from the artifact, never hard-coded as `180`. The bound this file
// asserts and the bound the implementation applies must be the SAME number, or
// the assertion drifts silently the first time the constant moves.
let MESSAGE_MAX_CHARS;

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
  MESSAGE_MAX_CHARS = artifact.MESSAGE_MAX_CHARS;
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

// ---------------------------------------------------------------------------
// Two small helpers
// ---------------------------------------------------------------------------

// Put ONE value through the real capture path and hand back what came out.
//
// **No normalizer argument, and that is a property of every case below rather
// than a shorthand.** A caller-supplied `normalize` replaces the shipped
// default outright, so a case that passed one would assert nothing about the
// clone this file exists to pin.
function captureOne(value: unknown) {
  return captureSnapshot({ actions: {}, snapshot: { v: () => value } }, "results").v;
}

// The console-capture idiom, factored to ONE place because this file has four
// call sites where `concierge.test.ts:1054-1095` has two.
//
// Four notes, each load-bearing, carried forward from that file and from
// `catalog.test.ts:454-471`:
//
//   - This is a PLAIN GLOBAL ASSIGNMENT, never the Vitest mocking API
//     (`spyOn`, `fn`, `mock`). A grep for that API's namespace prefix over
//     `test/` returns 0 across every file today and must still return 0
//     afterwards — which is also why this note spells the prefix out in prose
//     rather than writing it, since the check for the rule is not scoped to
//     non-comment lines. The repository's prohibition is on the mocking API,
//     not on assigning a global.
//   - The real console is SPREAD rather than replaced wholesale, so an
//     unrelated `console.error` from Vitest itself does not become
//     "undefined is not a function" while the stand-in is installed.
//   - Restoration happens in a `finally`, never after the assertions. A
//     throwing expectation would otherwise leave a stand-in console installed
//     for every later case in this file — and factoring it here is exactly what
//     makes that impossible to forget at a call site.
//   - All three sinks are captured, not just `warn`. "Warns exactly once" is
//     the claim, and a diagnostic that reached for `console.log` would satisfy
//     a `warn`-only capture while printing on every capture.
//
// No cast ceremony is needed for the assignment even though `console` is not
// type-visible inside core under `lib: ["ES2022"]`: this file is in NO
// TypeScript program (see `vitest.config.ts`).
function withConsoleCapture(body: () => void) {
  const realConsole = globalThis.console;
  const captured: string[] = [];
  const sink = (message: string) => {
    captured.push(String(message));
  };

  globalThis.console = { ...realConsole, warn: sink, error: sink, log: sink };

  try {
    body();
  } finally {
    globalThis.console = realConsole;
  }

  return captured;
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

  it("D2 — a self-referencing value captures without hanging, and the cycle survives as a cycle", () => {
    const cyc: Record<string, unknown> = { label: "root" };
    cyc["self"] = cyc;

    const result = captureOne(cyc);

    // `toBe`, not `toEqual`. The claim is that the memo produced ONE node and
    // pointed it at itself, not that the shape looks recursive — `toEqual` on a
    // cyclic structure is not the assertion it appears to be.
    expect(result.self).toBe(result);

    // MUTANT M-05-4 — moving the `seen.set` to AFTER the recursion instead of
    // before it. This case then recurses forever rather than failing an
    // assertion, which is why it is worth having: a stack overflow inside the
    // capture path is the observable, and no naive structural test reaches it.
  });

  it("D3 — a value reached twice clones ONCE: the two fields are identical to each other and distinct from the original", () => {
    const shared: Record<string, unknown> = { n: 1 };
    const result = captureOne({ l: shared, r: shared });

    // BOTH HALVES ARE REQUIRED, and each alone is satisfied by a different
    // wrong implementation:
    //
    //   - the first alone passes on a normalizer that returned the ORIGINAL
    //     graph untouched (in which case `l` and `r` are trivially identical,
    //     and nothing was detached);
    //   - the second alone passes on a normalizer that cloned the shared node
    //     TWICE (detached, but the app's object graph silently became a tree,
    //     so a later drift check comparing identities sees a difference that
    //     the app never made).
    //
    // Mutant M-05-4 again — the memo is what delivers both.
    expect(result.l).toBe(result.r);
    expect(result.l).not.toBe(shared);
  });

  it("D4 — an array of objects clones to a distinct frozen array whose elements are themselves distinct", () => {
    const first: Record<string, unknown> = { a: 1 };
    const second: Record<string, unknown> = { b: 2 };
    const items = [first, second];

    const result = captureOne(items);

    expect(result).not.toBe(items);
    expect(result[0]).not.toBe(first);
    expect(result[0]).toEqual({ a: 1 });
    expect(Object.isFrozen(result)).toBe(true);

    // `Array.isArray` and never `instanceof Array` is what the source uses, and
    // the difference is not stylistic: measured, `instanceof Array` reads
    // `false` for an array from another realm while `Array.isArray` reads
    // `true` through both a proxy and a realm boundary.
  });

  it("D5 — a live getter is INVOKED and lands as a data property, which is what distinguishes the clone from a freeze", () => {
    const holder: Record<string, unknown> = { plain: 1 };
    Object.defineProperty(holder, "live", {
      get: () => "read-through",
      enumerable: true,
      configurable: true,
    });

    const result = captureOne(holder);
    const descriptor = Object.getOwnPropertyDescriptor(result, "live");

    // INVOKING THE GETTER IS THE DETACHMENT. This is the one place the clone
    // deliberately inverts the recursive freeze in `src/catalog.ts`, which
    // SKIPS accessors by testing `"value" in descriptor` and therefore leaves
    // them live. Measured: that walk invokes a getter zero times; the clone
    // invokes it once. An accessor that survived capture is a snapshot key that
    // still reads the app.
    expect(descriptor.get).toBe(undefined);
    expect(descriptor.value).toBe("read-through");
  });

  it("D6 — a null-prototype record is CLONED rather than passed through", () => {
    const record = Object.create(null);
    record.a = 1;
    record.b = 2;

    const result = captureOne(record);

    expect(result).not.toBe(record);
    expect(Object.keys(result)).toEqual(["a", "b"]);

    // MUTANT M-05-6 — dropping the `|| proto === null` arm of the plain-object
    // test. The record then falls through to pass-through-by-reference and
    // `not.toBe` goes red. Nothing else in the suite would notice, because
    // every other object literal a test writes carries `Object.prototype` —
    // and `Object.create(null)` is not an exotic shape here, it is what
    // `Catalog.byName` is built with.
  });

  it("D7 — Date, Map and Set each clone to a distinct instance carrying the same content", () => {
    const when = new Date(0);
    const pairs = new Map([["a", 1]]);
    const members = new Set([1, 2]);

    const clonedDate = captureOne(when);
    const clonedMap = captureOne(pairs);
    const clonedSet = captureOne(members);

    expect(clonedDate).not.toBe(when);
    expect(clonedDate.getTime()).toBe(0);

    expect(clonedMap).not.toBe(pairs);
    expect(clonedMap.get("a")).toBe(1);

    expect(clonedSet).not.toBe(members);
    expect(clonedSet.has(1)).toBe(true);

    // MUTANT M-05-5 — the branch returns the value unchanged. All three
    // `not.toBe` assertions go red together.
    //
    // DELIBERATELY NOT ASSERTED, and recorded so a later reader does not add
    // it: **freezing a `Date`, `Map` or `Set` is cosmetic.** Measured —
    // `Object.freeze(new Map([["a",1]])).set("b",2)` SUCCEEDS and the size
    // becomes 2; the same holds for `Set.add` and `Date.setTime`. The clone
    // delivers what BRG-05 asks for, which is DETACHMENT — a distinct instance
    // the app cannot reach — and it does not deliver immutability for these
    // three types. An `expect(() => clonedMap.set(…)).toThrow()` would fail for
    // a reason that is not a defect, and `src/catalog.ts` already records the
    // same finding as "a frozen `Map` is not frozen".
  });

  it("D32 — an Array/Date/Map/Set SUBCLASS is still cloned, but the downgrade REPORTS instead of happening silently", () => {
    // The branches test `obj instanceof Map` and construct `new Map()`, so a
    // subclass loses both its prototype and every own property it carries.
    // Measured pre-fix, with no diagnostic at all:
    //
    //   F4: clone ctor = Map | lost .tag = undefined | lost subclass = true | warns = 0
    //
    // That contradicts the rationale the same file uses four branches later to
    // justify the pass-through: "a lossy clone that drops a prototype is worse
    // than an honest reference". The collection branches do exactly that, and
    // unlike the pass-through branch they did it without saying so.
    //
    // THE BEHAVIOUR CHOSEN IS "CLONE AND REPORT", not "pass through". Restricting
    // the branches to exact instances would have sent a CROSS-REALM `Date` or
    // `Map` down the pass-through path — and the union-of-predicates test exists
    // precisely to catch those, since a cross-realm instance fails `instanceof`
    // and passes the `toString` tag. Detachment is worth more there than
    // prototype fidelity, so the clone stays and the loss is merely made
    // visible.
    //
    // ---------------------------------------------------------------------
    // THE ARRAY ARM IS HERE BECAUSE IT WAS MISSED ONCE (RR-01)
    // ---------------------------------------------------------------------
    //
    // The first version of this case was titled "a Date/Map/Set SUBCLASS" and
    // covered exactly those three. `Array` is the FIRST collection branch in the
    // walk and it was left untouched, so `class Basket extends Array` went on
    // being downgraded in silence while the other three reported — and the
    // source comment introduced alongside the fix opened "EACH BRANCH REPORTS
    // ITS OWN DOWNGRADE", which was false for the one branch nothing tested.
    // Measured against that build:
    //
    //   Array subclass -> warns = 0 | ctor = Array | currency LOST = undefined | instanceof Basket = false
    //   Map subclass   -> warns = 1
    //   Set subclass   -> warns = 1
    //   Date subclass  -> warns = 1
    //
    // A case scoped one arm narrower than the claim it backs is the exact shape
    // that lets shipped prose outrun the code, which is what this phase's gate
    // exists to catch. The arm is enumerated here rather than given its own
    // case so that the loop and the claim cannot drift apart again.
    class Basket extends Array {
      constructor() {
        super();
        this.currency = "USD";
        this.push({ sku: "a" });
      }
    }
    class Tagged extends Map {
      constructor(entries) {
        super(entries);
        this.tag = "keep-me";
      }
    }
    class Ranked extends Set {
      constructor(members) {
        super(members);
        this.rank = 3;
      }
    }
    class Stamped extends Date {
      constructor(ms) {
        super(ms);
        this.label = "created";
      }
    }

    for (const [value, reader] of [
      [new Basket(), (c) => c[0]?.sku],
      [new Tagged([["a", 1]]), (c) => c.get("a")],
      [new Ranked([1, 2]), (c) => (c.has(1) ? 1 : undefined)],
      [new Stamped(0), (c) => (c.getTime() === 0 ? 1 : undefined)],
    ]) {
      let cloned;
      const captured = withConsoleCapture(() => {
        cloned = captureOne(value);
      });

      // The clone still happened and still carries the CONTENT — that is the
      // half worth keeping, and asserting it is what stops this case being
      // satisfied by a build that silently switched to pass-through.
      expect(cloned).not.toBe(value);
      expect(reader(cloned)).toBeDefined();

      // …and the loss is real, which is why it has to be reported.
      expect(Object.getPrototypeOf(cloned)).toBe(Object.getPrototypeOf(Object.getPrototypeOf(value)));

      expect(captured).toHaveLength(1);
      expect(captured[0]).toContain("[snapshot_exotic]");
      expect(captured[0]).toContain('snapshot "results.v"');
    }

    // THE CONTROL, and without it the fix could have been "always warn on this
    // branch" — which would fire on every `Date` in every snapshot in every app
    // and make the code carry no information at all. `D7` asserts these four
    // clone correctly; this asserts they do it in silence.
    //
    // THE ARRAY CONTROL IS THE LOAD-BEARING ONE OF THE FOUR, and it carries
    // three shapes rather than one. Arrays are the commonest value in any real
    // snapshot, and the array arm has no `instanceof` conjunct available for
    // free — `Array.isArray` is realm-transparent by design, which is the whole
    // reason the branch uses it — so a report gated on the prototype ALONE would
    // fire on every cross-realm array and, worse, on shapes a framework produces
    // constantly. A `Proxy` over an array is exactly what Vue's `reactive([])`
    // hands core, and a sparse array is what `new Array(3)` produces; both must
    // stay silent or this diagnostic becomes noise on the hottest path there is.
    const quiet = withConsoleCapture(() => {
      captureOne([1, 2]);
      captureOne(new Proxy([1, 2], {}));
      captureOne(Object.assign([], { 2: 1, length: 3 }));
      captureOne(runInNewContext("[1,2]"));
      captureOne(new Date(0));
      captureOne(new Map([["a", 1]]));
      captureOne(new Set([1, 2]));
    });

    expect(quiet).toHaveLength(0);
  });

  it("D8 — a class instance comes back BY REFERENCE, is NOT frozen, and REPORTS", () => {
    class Model {
      constructor() {
        this.n = 1;
      }
    }
    const model = new Model();

    let result;
    const captured = withConsoleCapture(() => {
      result = captureOne(model);
    });

    // The first half is the documented limit: prototype-bearing values are not
    // cloned, because a lossy clone that drops a prototype is worse than an
    // honest reference. Chasing it with an
    // `Object.prototype.toString.call(v) === "[object Object]"` fallback would
    // start cloning exactly the things this branch exists to pass through.
    expect(result).toBe(model);

    // THE SECOND HALF IS THE LOAD-BEARING ONE, and it is the detector for the
    // belt-and-braces `deepFreeze`-over-the-result pass that reads as a tidy-up.
    // Measured: that second walk leaves the CONSUMER'S OWN model object frozen,
    // so their next write throws inside their code, in a function core never
    // called. Freezing a value we did not construct is a bug — the clone seals
    // every node it creates and nothing else.
    expect(Object.isFrozen(model)).toBe(false);

    // THE THIRD HALF, and it is the one that makes the first two safe to ship.
    // The section note in `src/bridge.ts` states the governing invariant: the
    // hole is accepted, but "what is not accepted is the hole being INVISIBLE …
    // the fallback therefore reports". Measured against the pre-fix artifact,
    // the commonest occupant of that branch reported NOTHING:
    //
    //   A: class instance byRef = true | warnings = 0 []
    //
    // The consequence is the one the note names. Phase 8's CON-04 drift check
    // compares the payload the human confirmed against the payload about to
    // execute; with a live class instance on the captured side it compares a
    // value against ITSELF and passes unconditionally, with nothing anywhere
    // telling the developer why. `D12` proves the code fires for a proxied
    // `Date`; without these three lines nothing proved it fires for the branch
    // that catches every ordinary model object in a real app.
    expect(captured).toHaveLength(1);
    expect(captured[0]).toContain("[snapshot_exotic]");
    expect(captured[0]).toContain('snapshot "results.v"');
  });

  it("D25 — a FUNCTION is passed through by reference and reports, at the top level and nested", () => {
    // Functions never reached the pass-through branch at all: the
    // `typeof v !== "object"` early return swallowed them alongside numbers and
    // strings, so a closure over live app state was carried into a captured
    // snapshot with the same silence a primitive earns. A primitive IS already
    // detached; a closure is the opposite — it is a live read of whatever the
    // component still holds.
    const callback = () => "closure over app state";

    let top;
    const topWarns = withConsoleCapture(() => {
      top = captureOne(callback);
    });

    expect(top).toBe(callback);
    expect(topWarns).toHaveLength(1);
    expect(topWarns[0]).toContain("[snapshot_exotic]");

    // NESTED, and the nesting is a separate claim: `onExotic` is threaded
    // through every recursive call, so a function three levels down inside a
    // plain object still reports rather than being reported only when it is
    // the whole value.
    let nested;
    const nestedWarns = withConsoleCapture(() => {
      nested = captureOne({ handlers: { onSelect: callback } });
    });

    expect(nested.handlers.onSelect).toBe(callback);
    expect(nestedWarns).toHaveLength(1);
    expect(nestedWarns[0]).toContain("[snapshot_exotic]");
  });

  it("D26 — a prototype-bearing record and a CROSS-REALM plain object both pass through and both report", () => {
    // `Object.create({})` is named in the source comment beside the class
    // instance, and it is the shape a consumer produces with a prototype-based
    // defaults object. Measured pre-fix: by reference, zero warnings.
    const proto = { fallback: 1 };
    const derived = Object.create(proto);
    derived.own = 2;

    let fromProto;
    const protoWarns = withConsoleCapture(() => {
      fromProto = captureOne(derived);
    });

    expect(fromProto).toBe(derived);
    expect(protoWarns).toHaveLength(1);
    expect(protoWarns[0]).toContain("[snapshot_exotic]");

    // THE CROSS-REALM CASE, made executable rather than asserted in prose. The
    // source comment calls this miss "the SAFE failure direction" and forbids
    // chasing it with a `toString` tag fallback — correctly, since that
    // predicate is `true` for class instances too. Safe is not the same as
    // silent: the value is handed back live, so it still has to report.
    const foreign = runInNewContext("({ a: 1 })");

    expect(Object.getPrototypeOf(foreign)).not.toBe(Object.prototype);

    let fromRealm;
    const realmWarns = withConsoleCapture(() => {
      fromRealm = captureOne(foreign);
    });

    expect(fromRealm).toBe(foreign);
    expect(realmWarns).toHaveLength(1);
    expect(realmWarns[0]).toContain("[snapshot_exotic]");
  });

  it("D27 — an own `__proto__` key SURVIVES the clone as an own key, and the clone's prototype is untouched", () => {
    // `JSON.parse` is the canonical producer of an own enumerable `__proto__`
    // key, and it is not an exotic shape: it is what a server response or a
    // user-submitted body looks like the moment it reaches a snapshot getter.
    //
    // A plain `fields[key] = …` against an object that inherits
    // `Object.prototype` invokes the inherited `__proto__` SETTER instead of
    // creating an own property. Measured against the pre-fix artifact:
    //
    //   source own keys = [ '__proto__', 'total' ]
    //   clone own keys  = [ 'total' ]
    //   clone prototype = { injected: true }
    //   JSON of clone   = {"total":4180}
    //   out.injected    = true  (through the prototype chain)
    //
    // TWO silent failures at once. The captured snapshot no longer contains a
    // field the app does contain — in the exact value Phase 8 hashes and
    // drift-checks, and both sides of that check lose it identically, so drift
    // in that field can never be observed. And a value documented as a
    // structural clone acquires an inherited-property surface: a reader that
    // enumerates and a reader that dereferences disagree about the same object.
    const payload = JSON.parse('{"__proto__":{"injected":true},"total":4180}');

    // The fixture itself is asserted first. `JSON.parse` is the only reason
    // this shape exists here, and a case whose fixture quietly stopped carrying
    // an own `__proto__` would go green while proving nothing.
    expect(Object.keys(payload)).toEqual(["__proto__", "total"]);

    const result = captureOne(payload);

    expect(Object.keys(result)).toEqual(["__proto__", "total"]);
    expect(result.total).toBe(4180);

    // `toBe(Object.prototype)`, never `not.toBe(payloadProto)`. The claim is
    // that the clone is an ordinary object, not merely that it did not inherit
    // this particular attacker-shaped value.
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.injected).toBe(undefined);

    // Round-trips. The pre-fix clone serialized to `{"total":4180}` while the
    // source serialized to `{"__proto__":{"injected":true},"total":4180}` —
    // which is the data loss stated as bytes.
    expect(JSON.parse(JSON.stringify(result))).toEqual(JSON.parse(JSON.stringify(payload)));

    // THE NULL-PROTOTYPE RECORD IS AFFECTED IDENTICALLY, and it is worth its
    // own assertion because `Object.create(null)` is what `Catalog.byName` is
    // built with — the exact shape `D6` exists to keep in the clone at all.
    // Note it fails for a DIFFERENT reason: the record itself has no inherited
    // setter, but the `fields` object the clone writes INTO does.
    const record = Object.create(null);
    Object.defineProperty(record, "__proto__", {
      value: { evil: 1 },
      enumerable: true,
      writable: true,
      configurable: true,
    });
    record.total = 1;

    const cloned = captureOne(record);

    expect(Object.keys(cloned)).toEqual(["__proto__", "total"]);
    expect(Object.getPrototypeOf(cloned)).toBe(Object.prototype);
  });

  it("D28 — a snapshot key named `__proto__` lands as an own key of the RETURNED record, whether the getter succeeds or throws", () => {
    // `captureSnapshot`'s own container had the same defect as the clone's, and
    // the returned record is the thing every downstream reader holds. Measured
    // pre-fix:
    //
    //   returned own keys = [ 'ok' ] | proto = { evil: 1 } | res.evil = 1
    //
    // A snapshot member disappeared from the record and its value became the
    // record's prototype.
    //
    // `Object.defineProperty`, not an object literal: `{ __proto__: fn }` in a
    // literal SETS the prototype and creates no own key, so a literal would
    // build the wrong fixture and the case would pass vacuously.
    const holder = { ok: () => 1 };
    Object.defineProperty(holder, "__proto__", {
      value: () => ({ evil: 1 }),
      enumerable: true,
      writable: true,
      configurable: true,
    });

    let result;
    const captured = withConsoleCapture(() => {
      result = captureSnapshot({ actions: {}, snapshot: holder }, "results");
    });

    expect(Object.keys(result).sort()).toEqual(["__proto__", "ok"]);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.evil).toBe(undefined);
    expect(captured).toHaveLength(0);

    // THE `catch` ARM TOO. `out[key] = undefined` was a silent no-op for this
    // key — assigning `undefined` through the inherited setter does nothing at
    // all — which defeats the "key present at `undefined`" contract that lets a
    // reader tell a key that FAILED from a key the component never declared.
    // Measured pre-fix: `catch-arm own keys = []`.
    const throwing = {};
    Object.defineProperty(throwing, "__proto__", {
      value: () => {
        throw new Error("SECRET-FROM-THE-APP");
      },
      enumerable: true,
      writable: true,
      configurable: true,
    });

    let failed;
    const failedWarns = withConsoleCapture(() => {
      expect(() => {
        failed = captureSnapshot({ actions: {}, snapshot: throwing }, "results");
      }).not.toThrow();
    });

    expect(Object.prototype.hasOwnProperty.call(failed, "__proto__")).toBe(true);
    expect(failed.__proto__).toBe(undefined);
    expect(Object.getPrototypeOf(failed)).toBe(Object.prototype);

    expect(failedWarns).toHaveLength(1);
    expect(failedWarns[0]).toContain("[snapshot_threw]");
    expect(failedWarns[0]).not.toContain("SECRET-FROM-THE-APP");
  });

  it("D9 — a symbol-keyed property is not carried into the capture", () => {
    const marker = Symbol("framework-internal");
    const value: Record<string, unknown> = { visible: 1 };
    value[marker] = "internal";

    const result = captureOne(value);

    expect(result.visible).toBe(1);
    expect(result[marker]).toBe(undefined);
    expect(Object.getOwnPropertySymbols(result)).toHaveLength(0);

    // DELIBERATE, not an oversight of `Object.keys`. All three target
    // frameworks mark their internals with symbol keys — Vue's `__v_raw`,
    // Svelte's internal markers — and a snapshot is a payload Phase 6
    // serializes and Phase 8 hashes. `Reflect.ownKeys` would drag every one of
    // them into that hash, which is precisely the framework reactivity BRG-05
    // exists to drop.
  });
});

describe("capture degrades honestly rather than propagating", () => {
  it("D10 — a throwing snapshot getter is caught: the key is present at undefined, one [snapshot_threw] warn, and nothing it threw is echoed", () => {
    const bridge = {
      actions: {},
      snapshot: {
        filters: () => {
          throw new Error("SECRET-FROM-THE-APP user@example.com");
        },
      },
    };
    const registry = createBridge("results");
    registry.register(bridge);

    let result;
    const captured = withConsoleCapture(() => {
      // ONE call, inside the capture. Calling `captureSnapshot` a second time
      // to obtain the result separately would emit a second warning — the latch
      // is allocated inside the function body, so it is once per key per
      // CAPTURE rather than once per process — and `toHaveLength(1)` below
      // would fail for a reason that is not a defect.
      expect(() => {
        result = captureSnapshot(registry.read(), "results");
      }).not.toThrow();
    });

    // The key is SET TO NOTHING rather than omitted, so `"filters" in snapshot`
    // still distinguishes a key that failed from a key the component never
    // declared.
    expect("filters" in result).toBe(true);
    expect(result.filters).toBe(undefined);

    // `toHaveLength(1)`, never `toBeGreaterThan(0)`.
    expect(captured).toHaveLength(1);

    // The bracketed code and the rendered subject, matched against the text
    // recorded in `05-01-SUMMARY.md`. Two claims, not one: that the sink FIRED,
    // and that what it emitted carried the identity a developer needs — an
    // aggregated summary line would satisfy the first and lose the second.
    expect(captured[0]).toContain("[snapshot_threw]");
    expect(captured[0]).toContain('snapshot "results.filters"');

    // THE EXECUTABLE FORM OF THE SECURITY DECISION. Without this pair the
    // `catch`-with-no-binding is a convention with no guarantee. The caught
    // message is whatever the consumer's own getter put in it, and in a real
    // app that is assembled from the same user input the component renders —
    // so echoing it opens the covert PII channel CLAUDE.md closes for handler
    // exceptions, one layer earlier and on a hotter path.
    expect(captured[0]).not.toContain("SECRET-FROM-THE-APP");
    expect(captured[0]).not.toContain("user@example.com");
  });

  it("D11 — a NESTED throwing getter is caught by the same try: still one [snapshot_threw], zero [snapshot_exotic], and no leak", () => {
    // THE OUTER GETTER DOES NOT THROW. It returns successfully; the CLONE
    // throws, later, while reading `boom`. That is the whole point of this
    // case.
    const bridge = {
      actions: {},
      snapshot: {
        filters: () => ({
          ok: 1,
          get boom() {
            throw new Error("SECRET-FROM-THE-APP");
          },
        }),
      },
    };
    const registry = createBridge("results");
    registry.register(bridge);

    let result;
    const captured = withConsoleCapture(() => {
      expect(() => {
        result = captureSnapshot(registry.read(), "results");
      }).not.toThrow();
    });

    expect(result.filters).toBe(undefined);

    // PITFALL 3'S ONLY DETECTOR. With the `try` scoped to `snapshot[key]()`
    // alone, this case throws OUT of `captureSnapshot` and the consumer's
    // message — user input, in a real app — reaches the caller. D10 is green
    // under that narrow `try`, because D10's getter throws where the narrow
    // `try` is looking. Removing this case ships the leak undetected.
    expect(captured).toHaveLength(1);
    expect(captured[0]).toContain("[snapshot_threw]");
    expect(captured[0]).not.toContain("SECRET-FROM-THE-APP");

    // ZERO exotic warns, and this is a second, independent claim. The source
    // wraps each `Date`/`Map`/`Set` extraction in its OWN `try` and recurses
    // outside it, so a throwing getter nested inside a collection value is
    // reported as a throwing getter rather than mislabelled as an undetachable
    // value — which would send a developer to inspect a value that is fine.
    expect(captured[0]).not.toContain("[snapshot_exotic]");
  });

  it("D12 — an undetachable value warns with a DISTINCT code, comes back by reference, and does not crash the capture", () => {
    // A naively proxied `Date`: unextractable through the proxy by every route
    // measured — six of them, every one a `TypeError`. A `Proxy` that BINDS
    // methods to its target, which is what Vue's `reactive()` does for
    // collections, extracts fine — so the throw is a property of naive
    // proxying rather than of proxying in general and cannot be assumed away.
    const exotic = new Proxy(new Date(0), {});

    const bridge = { actions: {}, snapshot: { when: () => exotic } };
    const registry = createBridge("results");
    registry.register(bridge);

    let result;
    const captured = withConsoleCapture(() => {
      // **NO NORMALIZER ARGUMENT, and this is a hard precondition of the case
      // rather than a stylistic echo of D1.** Core threads its `onExotic`
      // callback only through the normalizer it constructs itself, so a
      // caller-supplied `normalize` suppresses this warning BY DESIGN — core
      // has no evidence about whether someone else's normalizer detached
      // anything, and warning would be a claim it cannot support. Passing one
      // here captures zero warnings and the case fails for a reason that is
      // not a defect.
      expect(() => {
        result = captureSnapshot(registry.read(), "results");
      }).not.toThrow();
    });

    // The documented limit, made observable: the value is handed back
    // untouched rather than mangled or thrown over.
    expect(result.when).toBe(exotic);

    expect(captured).toHaveLength(1);
    expect(captured[0]).toContain("[snapshot_exotic]");
    expect(captured[0]).toContain('snapshot "results.when"');

    // THE CODES ARE ASSERTED DISTINCT RATHER THAN ASSUMED. CONTEXT requires
    // "the same latch shape as the throwing-getter warn but a distinct code",
    // and one code covering both conditions would make them indistinguishable
    // in the only diagnostic channel this package has — sending a developer to
    // look at a getter that is working perfectly. D10 asserts the other code on
    // the other condition; this line is what stops the two collapsing.
    expect(captured[0]).not.toContain("[snapshot_threw]");
  });

  it("D22 — a snapshot HOLDER whose get trap throws is caught: no throw, nothing echoed, and the capture is empty", () => {
    // PITFALL 3, ONE DOOR FURTHER OUT THAN D11. D11's outer getter returns and
    // the CLONE throws. Here the throw happens EARLIER STILL — reading
    // `snapshot[key]` fires the holder's `get` trap, which is consumer code
    // running before any getter has been invoked at all. Measured against the
    // pre-fix artifact: `threw = Error: SECRET-FROM-THE-APP user@example.com`
    // with ZERO warnings, so the consumer's message — assembled in a real app
    // from the same user input the component renders — reached the caller
    // intact. That is the covert PII channel CLAUDE.md closes for handler
    // exceptions, at the outermost layer of this function.
    //
    // A proxy- or accessor-backed `snapshot` holder is not an exotic
    // hypothetical here; it is the premise of the phase. A Vue component that
    // hands core `reactive({ filters: () => … })` reaches this line.
    const holder = new Proxy(
      { filters: () => 1 },
      {
        get(target, key, receiver) {
          if (key === "filters") {
            throw new Error("SECRET-FROM-THE-APP user@example.com");
          }
          return Reflect.get(target, key, receiver);
        },
      },
    );

    let result;
    const captured = withConsoleCapture(() => {
      expect(() => {
        result = captureSnapshot({ actions: {}, snapshot: holder }, "results");
      }).not.toThrow();
    });

    // The key is reported as failed, exactly as a throwing getter is: the read
    // that produced the getter is inside the SAME `try` as the invocation, so
    // both failures land in the same arm and get the same treatment.
    expect("filters" in result).toBe(true);
    expect(result.filters).toBe(undefined);

    expect(captured).toHaveLength(1);
    expect(captured[0]).toContain("[snapshot_threw]");
    expect(captured[0]).toContain('snapshot "results.filters"');

    // THE EXECUTABLE FORM OF THE SECURITY DECISION, at this layer.
    expect(captured[0]).not.toContain("SECRET-FROM-THE-APP");
    expect(captured[0]).not.toContain("user@example.com");
  });

  it("D23 — a snapshot HOLDER whose ownKeys trap throws is caught, warns once naming the registry, and echoes nothing", () => {
    // `Object.keys(bridge.snapshot)` fires `ownKeys` and
    // `getOwnPropertyDescriptor` on a proxied holder. Pre-fix that call sat
    // OUTSIDE every `try` in the function; measured,
    // `threw = Error: SECRET-3 keys` with zero warnings.
    //
    // The failure is terminal for the WHOLE capture rather than for one key —
    // there are no keys — so the diagnostic names the registry alone. It
    // carries the `[snapshot_threw]` code rather than a third one, because the
    // fix a developer must make is the same one `snapshotThrewMessage` asks
    // for: make the accessor total. `snapshotExoticMessage`'s argument for
    // keeping the two existing codes distinct — "one code covering both would
    // send a developer looking at a getter that is working perfectly" — is the
    // reason NOT to invent a third here: this code sends them to exactly the
    // right place.
    const holder = new Proxy(
      { filters: () => 1 },
      {
        ownKeys() {
          throw new Error("SECRET-3 keys");
        },
      },
    );

    let result;
    const captured = withConsoleCapture(() => {
      expect(() => {
        result = captureSnapshot({ actions: {}, snapshot: holder }, "results");
      }).not.toThrow();
    });

    expect(result).toEqual({});

    expect(captured).toHaveLength(1);
    expect(captured[0]).toContain("[snapshot_threw]");
    expect(captured[0]).toContain('snapshot "results"');
    expect(captured[0]).not.toContain("SECRET-3");
  });

  it("D24 — captureSnapshot(registry.read(), id) with NOTHING registered returns {} silently, because that is DX-02's supported state", () => {
    // `captureSnapshot(registry.read(), "results")` is the literal idiom every
    // case in this file uses, and `read()` returning `null` is DX-02's
    // SUPPORTED configuration rather than a defect — core never auto-fails an
    // action because a declared bridge is unmounted. Pre-fix this threw
    // `TypeError: Cannot read properties of null (reading 'snapshot')` out of
    // the capture path.
    //
    // THE SILENCE IS THE DECISION, and it is the same one B20 makes for the
    // refused unsubscriber: an unmounted page is correct behaviour, so a
    // warning here would fire on every capture taken while a component simply
    // is not on screen — and a channel that cries wolf on correct behaviour is
    // a channel developers filter out, taking the two real capture codes with
    // it. D16 records the identical judgement for a throwing `read()` inside
    // `explain`.
    const registry = createBridge("results");

    let result;
    const captured = withConsoleCapture(() => {
      expect(() => {
        result = captureSnapshot(registry.read(), "results");
      }).not.toThrow();
    });

    expect(result).toEqual({});
    expect(captured).toHaveLength(0);

    // A bridge that carries no `snapshot` at all degrades identically. The
    // TYPE forbids it; a JavaScript consumer is the population `types.ts`
    // names as the entire reason runtime rules exist.
    let bare;
    const bareCaptured = withConsoleCapture(() => {
      expect(() => {
        bare = captureSnapshot({ actions: {} }, "results");
      }).not.toThrow();
    });

    expect(bare).toEqual({});
    expect(bareCaptured).toHaveLength(0);
  });

  it("D29 — a key that is BOTH undetachable and terminally broken emits BOTH codes, and never the exotic one alone", () => {
    // The latch used to be one `Set` shared by both codes, and the exotic path
    // adds to it FIRST — so a key whose value contained an undetachable value
    // *and* a nested getter that threw emitted only `[snapshot_exotic]` while
    // the key itself landed at `undefined`. Measured pre-fix:
    //
    //   G2: threw = null | out.mixed = undefined | warns = 1
    //   G2: codes = [ '[snapshot_exotic] …' ]
    //
    // That is the exact mirror of the failure `snapshotExoticMessage` argues
    // the two codes exist to prevent — "one code covering both would send a
    // developer looking at a getter that is working perfectly". Here the getter
    // is genuinely broken, the key is genuinely absent, and the ONLY diagnostic
    // pointed at detachment. The actionable code was the one suppressed.
    //
    // Ordering is load-bearing in the fixture: `when` is enumerated before
    // `boom`, so the exotic warn fires first and gets the chance to swallow the
    // throw warn. Reversing the two keys makes the case green on the pre-fix
    // build, because `boom` throws before `when` is ever reached.
    const exotic = new Proxy(new Date(0), {});
    const bridge = {
      actions: {},
      snapshot: {
        mixed: () => ({
          when: exotic,
          get boom() {
            throw new Error("SECRET-FROM-THE-APP user@example.com");
          },
        }),
      },
    };
    const registry = createBridge("results");
    registry.register(bridge);

    let result;
    const captured = withConsoleCapture(() => {
      expect(() => {
        result = captureSnapshot(registry.read(), "results");
      }).not.toThrow();
    });

    // The failure is TERMINAL for the key, so the key is present at `undefined`
    // exactly as `D10` requires.
    expect("mixed" in result).toBe(true);
    expect(result.mixed).toBe(undefined);

    // `toHaveLength(2)`, and each code asserted by name rather than by index —
    // the two are emitted from different places and their relative order is not
    // a contract worth pinning.
    expect(captured).toHaveLength(2);
    expect(captured.some((line) => line.includes("[snapshot_threw]"))).toBe(true);
    expect(captured.some((line) => line.includes("[snapshot_exotic]"))).toBe(true);

    // Both name the same key, so a developer reading two lines knows they are
    // two facts about one member rather than two members misbehaving.
    for (const line of captured) {
      expect(line).toContain('snapshot \"results.mixed\"');
      expect(line).not.toContain("SECRET-FROM-THE-APP");
      expect(line).not.toContain("user@example.com");
    }

    // AND THE LATCH IS STILL A LATCH. Two keys that each fail the same way
    // twice must not print four lines: `warnedExotic` and `warnedThrew` are
    // per-code-per-key, not per-code. Without this half the fix could have been
    // "drop the latch", which is the warning-that-prints-forever failure.
    const repeated = {
      actions: {},
      snapshot: {
        a: () => ({ one: exotic, two: exotic }),
        b: () => ({ one: exotic, two: exotic }),
      },
    };

    const repeats = withConsoleCapture(() => {
      captureSnapshot(repeated, "results");
    });

    expect(repeats).toHaveLength(2);
  });

  it("D30 — a METHOD-SHORTHAND snapshot member is invoked on the holder, so `this` is the snapshot object", () => {
    // `Bridge`'s `Snapshot extends Record<string, () => unknown>` accepts method
    // shorthand, so `snapshot: { count() { return this.total(); } }` typechecks
    // — and then failed at runtime, because the getter was read out of the
    // holder and called bare, with `this === undefined`. Measured pre-fix:
    //
    //   F3: count = undefined | warns: [snapshot_threw] snapshot "results.count": the getter threw…
    //
    // The remediation text that warning prints — "make the getter total; it
    // runs on every capture, so it must not assume any part of the component's
    // state has loaded yet" — sends the developer looking for a load-order bug
    // that does not exist. A diagnostic that is accurate about WHAT happened and
    // wrong about WHY costs more than silence.
    const bridge = {
      actions: {},
      snapshot: {
        total: () => 7,
        count() {
          return this.total();
        },
      },
    };
    const registry = createBridge("results");
    registry.register(bridge);

    let result;
    const captured = withConsoleCapture(() => {
      result = captureSnapshot(registry.read(), "results");
    });

    expect(result.total).toBe(7);
    expect(result.count).toBe(7);

    // ZERO warnings is the load-bearing half. `result.count` being `7` proves
    // the receiver survived; `captured` being empty proves the case is not
    // green because something else quietly succeeded.
    expect(captured).toHaveLength(0);

    // AND ARROW MEMBERS ARE UNAFFECTED, which is what makes the change safe:
    // an arrow ignores its receiver entirely, so every existing snapshot in
    // this file behaves identically before and after. `total` above is one;
    // this asserts the property directly rather than leaving it to inference.
    const arrowOnly = { actions: {}, snapshot: { q: () => "shoes" } };

    expect(captureSnapshot(arrowOnly, "results").q).toBe("shoes");
  });

  it("D13 — a clean capture warns not at all, so both codes are proven CONDITIONAL", () => {
    const bridge = {
      actions: {},
      snapshot: {
        filters: () => ({ q: "shoes", page: 1 }),
        total: () => 42,
      },
    };
    const registry = createBridge("results");
    registry.register(bridge);

    let result;
    const captured = withConsoleCapture(() => {
      result = captureSnapshot(registry.read(), "results");
    });

    expect(result.filters).toEqual({ q: "shoes", page: 1 });
    expect(result.total).toBe(42);

    // Without this case, D10 and D12 are satisfied by an implementation that
    // warns on EVERY capture — which is a warning nobody reads, and which would
    // make the two codes carry no information at all.
    expect(captured).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Declaration helpers
// ---------------------------------------------------------------------------
//
// RE-DECLARED, not imported. The originals are file-local to
// `concierge.test.ts:358-414` and are not exported; copying the SHAPE keeps
// both files independent, where exporting them would make one file's fixture a
// published surface the other could not change.
//
// `redact: "drop"` on every declaration is mandatory rather than tidy: a
// missing `redact` on a non-empty schema throws `redaction_missing` during the
// one flat `buildCatalog` that `createConcierge` runs, so every case in this
// half would fail during construction for a reason with nothing to do with
// what it claims. Zod fixtures come from `./fixtures/schemas.js`, which IS a
// real importable module.
function noopHandler() {
  return { ok: true };
}

function declare(name: string, schema: unknown, extra: Record<string, unknown> = {}) {
  return {
    name,
    description: `the ${name} action`,
    schema,
    handler: noopHandler,
    redact: "drop",
    ...extra,
  };
}

// `bridge` is OMITTED rather than set to `undefined` when absent, so that
// "declares no bridge" is an absent key exactly as a consumer would write it.
// The source branches on `registry === undefined`, so both spellings work, and
// the one that matches real configuration is the one worth testing.
function stage(id: string, match: unknown, actions: unknown[], bridge?: unknown) {
  return bridge === undefined ? { id, match, actions } : { id, match, actions, bridge };
}

describe("BRG-03 — resolution yields null for a declared-but-unmounted bridge", () => {
  // `resolveBridge` is module-private, so its observable AT THIS LAYER is
  // `explain().stages[i].bridge.registered` — which is exactly why plan 05-02
  // routed `bridgeStatus` through the seam rather than leaving it with its own
  // `read()` call. Nothing below reaches into `src/`.
  //
  // Phase 5 proves BRG-03 as TWO SEPARATE HALVES: resolution here, and the
  // handler's response to a `null` bridge in the next block. CONTEXT decision
  // 3.3 locks the `dispatch` stub as untouched — Phase 6 replaces it
  // wholesale — so the end-to-end form joining the two is NOT provable at this
  // phase's boundary. See the deferral note in the next block; nothing in this
  // file calls dispatch.

  it("D14 — a stage declaring a real registry with nothing registered reports { id, registered: false }", () => {
    const registry = createBridge("results");

    const concierge = createConcierge({
      stages: [stage("results", () => true, [declare("applyFilter", zodObject)], registry)],
    });

    expect(concierge.explain({ pathname: "/results" }).stages[0].bridge).toEqual({
      id: "results",
      registered: false,
    });

    // MUTANT M-05-13 — `resolveBridge` returning `null` unconditionally instead
    // of the guarded `registry.read() ?? null`. THIS CASE STAYS GREEN under
    // that mutant, because `false` is what an always-null resolution reports
    // too. It is written anyway, as the honest half of a pair: D15 is the one
    // that goes red, and a reader who saw only this case would conclude the
    // unmounted state was covered when nothing about the seam was tested.
  });

  it("D15 — the same stage reports registered: true once a bridge is registered", () => {
    const registry = createBridge("results");

    const concierge = createConcierge({
      stages: [stage("results", () => true, [declare("applyFilter", zodObject)], registry)],
    });

    registry.register({ actions: {}, snapshot: { total: () => 1 } });

    // MUTANT M-05-13'S REAL DETECTOR. With `return null;` substituted for the
    // guarded read inside `resolveBridge`, `registered` stays `false` here and
    // every action in the app is off-page forever, on a page that is definitely
    // open — the single hardest bridge failure to diagnose from the outside.
    expect(concierge.explain({ pathname: "/results" }).stages[0].bridge).toEqual({
      id: "results",
      registered: true,
    });
  });

  it("D16 — a registry whose read() THROWS degrades to registered: false, does not propagate, and prints nothing", () => {
    // Hand-rolled, because `createBridge`'s own `read()` cannot throw. `id`,
    // `read` and `register` are the whole `BridgeRegistry` interface, so this
    // object is exactly what that interface admits — the same argument
    // `concierge.test.ts:951-956` makes for S20's fixture.
    const registry = {
      id: "results",
      read: () => {
        throw new Error("SECRET-FROM-THE-APP");
      },
      register: () => () => {},
    };

    const concierge = createConcierge({
      stages: [stage("results", () => true, [declare("applyFilter", zodObject)], registry)],
    });

    let row;
    const captured = withConsoleCapture(() => {
      expect(() => {
        row = concierge.explain({ pathname: "/results" }).stages[0].bridge;
      }).not.toThrow();
    });

    // A throwing `read()` is not a registration. It degrades to "not mounted"
    // rather than taking down the one call a developer makes when they are
    // already confused.
    expect(row).toEqual({ id: "results", registered: false });

    // ZERO WARNINGS, AND THE SILENCE IS A DECISION rather than an omission —
    // `src/concierge.ts:276-281` records it. Unlike a throwing matcher, which
    // fires on every navigation in a shipped app where nobody is watching, this
    // runs only inside `explain`: a human-debugging-rate call. A warning there
    // prints during the very activity it would interrupt, and the structured
    // `registered: false` row is already in front of the person who asked for
    // it.
    expect(captured).toHaveLength(0);
  });

  it("D17 — a stage declaring NO bridge reports null, not { registered: false }", () => {
    const concierge = createConcierge({
      stages: [
        stage("results", () => true, [declare("applyFilter", zodObject)], createBridge("results")),
        stage("plain", () => false, [declare("openItem", zodObject)]),
      ],
    });

    // `toBe(null)`, and the distinction from D14 is the entire reason this row
    // is not a boolean. `null` means the stage declares no bridge — DX-02's
    // SUPPORTED configuration — while `{registered: false}` means one is
    // declared and nothing mounted, which is the commonest cause of "my action
    // didn't fire". Collapsing them makes the two indistinguishable in the one
    // diagnostic a developer reaches for.
    expect(concierge.explain({ pathname: "/results" }).stages[1].bridge).toBe(null);

    // MUTANT M-05-14 — removing `bridgeStatus`'s `stage.bridge === undefined`
    // early return so the row is read off `resolveBridge`'s return value alone.
    // The three-state row collapses to two and this case goes red. It cannot be
    // "simplified" away by noting that `resolveBridge` contains a textually
    // identical guard four lines below: that one is right for a HANDLER, which
    // has the same thing to do about both states, and wrong for a REPORT —
    // and there is no `id` to put in the collapsed row.
  });
});

describe("BRG-03 / DX-02 — a handler given bridge: null returns a sentence, not an exception", () => {
  // Handlers are invoked DIRECTLY with a context object here. Nothing routes
  // through `dispatch`, and that is a fence rather than a shortcut: CONTEXT
  // decision 3.3 locks the Phase 4 `dispatch` stub as untouched and Phase 6
  // replaces it wholesale.
  //
  // SUCCESS CRITERION 3'S END-TO-END FORM IS DEFERRED TO PHASE 6 by that same
  // decision. Its absence here is a recorded deferral, not an omission — the
  // two halves it joins (resolution yields `null`; a handler given `null`
  // returns a sentence) are both proven, above and below.
  //
  // ---------------------------------------------------------------------------
  // THE DX-03 HALF THAT IS DELIBERATELY NOT ASSERTED
  // ---------------------------------------------------------------------------
  //
  // Following `export-surface.test.ts`'s Trap 2 precedent of writing down what
  // is deliberately left unasserted rather than leaving a gap a reader must
  // infer:
  //
  // DX-03's standard is that the message says what to DO, not merely what is
  // wrong. There is no honest automated form of that. A regex over
  // `/open|go to|navigate/i` pins VOCABULARY rather than MEANING: it goes red
  // on a legitimate rewording that still names an action, and green on
  // "the page is not open" — which names no action at all while containing the
  // word. Writing it would be an assertion that passes vacuously, which is the
  // one failure this phase's CONTEXT rejects by name.
  //
  // THE TWO AUTOMATED HALVES THAT DO CARRY WEIGHT are both below: the length
  // bound read from `MESSAGE_MAX_CHARS` (mutant M-05-12) and
  // `expect(() => handler(ctx)).not.toThrow()`. The what-to-do half is a
  // PLAN-AUTHOR REVIEW OBLIGATION, and its verdict is recorded in this plan's
  // SUMMARY rather than faked here.

  // The handler shape a consumer writes for an action that needs the page. It
  // takes ONE argument — the context — matching `ActionHandler`.
  function offPageHandler(ctx: { bridge: unknown }) {
    if (ctx.bridge === null) {
      return offPageResult("The result count", "results page");
    }
    return { ok: true };
  }

  it("D18 — the off-page result is ok:false / no_bridge / a bounded, non-empty sentence, and the handler does not throw", () => {
    const ctx = { args: {}, bridge: null, meta: {} };

    let result;
    expect(() => {
      result = offPageHandler(ctx);
    }).not.toThrow();

    expect(result.ok).toBe(false);

    // `toBe("no_bridge")`, not `toBeDefined()`. `ReasonCode` is a CLOSED union
    // of twelve members whose additions are breaking changes by design, and
    // `no_bridge` is the one declared for exactly this case. A handler placing
    // any other member here would be lying to the model about why it stopped.
    expect(result.reason).toBe("no_bridge");

    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.message.length).toBeLessThanOrEqual(MESSAGE_MAX_CHARS);
  });

  it("D19 — a composition that overshoots the bound comes back at exactly MESSAGE_MAX_CHARS", () => {
    // DELIBERATELY OVER-LONG, and the overshoot is the whole case. A pair whose
    // composition stayed under the bound would return an untruncated message
    // under BOTH implementations and could not distinguish them — the same
    // assertion, on a shorter pair, is an audit that cannot fail.
    const what = "The number of results matching every filter the shopper has applied so far on this page";
    const where = "search results page inside the storefront shell";

    const result = offPageResult(what, where);

    // MUTANT M-05-12 — removing `message.slice(0, MESSAGE_MAX_CHARS)`. The
    // composed sentence here runs well past the bound, so the returned length
    // stops being `MESSAGE_MAX_CHARS` and this goes red.
    //
    // The bound is READ FROM THE ARTIFACT rather than written as `180`. A
    // hard-coded literal is a second copy of a shared contract — this bound and
    // Phase 6's SEC-06 truncation are meant to be the same number — and two
    // copies of a number can disagree without anything noticing until a message
    // is cut at the wrong place.
    expect(result.message).toHaveLength(MESSAGE_MAX_CHARS);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_bridge");
  });

  it("D31 — truncation never splits a surrogate pair, so the bounded message is always well-formed", () => {
    // `slice` cuts at UTF-16 CODE UNITS. A non-BMP character — an emoji, a
    // CJK extension glyph, a mathematical alphanumeric — occupies two of them,
    // and `what`/`where` are consumer-supplied prose that in a real product
    // carries exactly those. Measured against the pre-fix artifact:
    //
    //   G1: LONE HIGH SURROGATE at n = 179 | len = 180 | tail = "AAA\ud83d" | wellFormed = false
    //
    // An ill-formed string is not a cosmetic problem here. It is spoken or
    // rendered to a human AND serialized to the model: `JSON.stringify` emits
    // the bare `\ud83d`, while `TextEncoder` substitutes U+FFFD — so the bytes
    // Phase 8 would hash are not the bytes anyone saw. And `offPageResult`'s
    // own doc states this bound IS the shared contract with Phase 6's SEC-06
    // truncation, so an unfixed cut propagates by design rather than by
    // accident.
    //
    // TRIMMING BACK IS BOUNDING, NOT SANITIZING. It removes no character the
    // consumer wrote; it declines to emit half of one. SEC-06 — stripping C0/C1
    // and collapsing whitespace — is still Phase 6's and is still not done here.
    const emoji = "\u{1F600}";

    // THE WHOLE WINDOW, not one lucky offset. A single n proves the fix at one
    // boundary; sweeping the offsets proves no boundary in the region produces
    // an ill-formed cut, which is the actual claim.
    for (let n = 150; n <= 220; n += 1) {
      const swept = offPageResult("A".repeat(n) + emoji, "results page");

      expect(swept.message.isWellFormed()).toBe(true);
      expect(swept.message.length).toBeLessThanOrEqual(MESSAGE_MAX_CHARS);
    }

    // AND THE EXACT MEASURED BOUNDARY, pinned so the shape of the fix is
    // asserted rather than only its effect. At n = 179 the pair straddles the
    // cut: the message comes back one character SHORT of the bound, with the
    // pair dropped whole rather than half-emitted or replaced by U+FFFD.
    const boundary = offPageResult("A".repeat(179) + emoji, "results page");

    expect(boundary.message).toHaveLength(MESSAGE_MAX_CHARS - 1);
    expect(boundary.message.isWellFormed()).toBe(true);
    expect(boundary.message.endsWith("\ud83d")).toBe(false);
    expect(boundary.message.endsWith("A")).toBe(true);

    // The other two fields are unchanged by any of this — the helper still
    // returns the same failure it always did.
    expect(boundary.ok).toBe(false);
    expect(boundary.reason).toBe("no_bridge");

    // A MESSAGE THAT DOES NOT OVERSHOOT IS RETURNED WHOLE, emoji and all. This
    // is what stops the fix being "always drop the last character".
    const short = offPageResult(`The ${emoji} result count`, "results page");

    expect(short.message).toContain(emoji);
    expect(short.message.isWellFormed()).toBe(true);
  });

  it("D20 — DX-02 criterion 5: a stage declaring NO bridge still runs its handler, which succeeds with ctx.bridge null", () => {
    // A handler that needs no instrumentation at all — it reads a stubbed
    // router value out of its OWN arguments. This is the "first useful action
    // costs no instrumentation" claim, made executable.
    let seenBridge = "handler-was-never-called";
    function routerHandler(ctx: { args: { pathname: string }; bridge: unknown }) {
      seenBridge = ctx.bridge;
      return { ok: true, message: `Navigated to ${ctx.args.pathname}.` };
    }

    const concierge = createConcierge({
      stages: [stage("plain", () => true, [declare("openItem", zodObject, { handler: routerHandler })])],
    });

    // The configuration is legal and the stage assembles: core does not treat
    // "declares no bridge" as a defect.
    expect(concierge.explain({ pathname: "/x" }).stages[0].bridge).toBe(null);

    const result = routerHandler({ args: { pathname: "/items/7" }, bridge: null, meta: {} });

    expect(result.ok).toBe(true);
    expect(seenBridge).toBe(null);
  });

  it("D21 — DX-02: a stage that DOES declare a bridge with nothing registered still runs its handler, which can still succeed", () => {
    let seenBridge = "handler-was-never-called";
    function partialHandler(ctx: { args: { pathname: string }; bridge: unknown }) {
      seenBridge = ctx.bridge;
      // The handler DECIDES. It has a legitimate path that does not need the
      // bridge, and it takes it.
      return { ok: true, message: `Navigated to ${ctx.args.pathname}.` };
    }

    const registry = createBridge("results");
    const concierge = createConcierge({
      stages: [
        stage("results", () => true, [declare("applyFilter", zodObject, { handler: partialHandler })], registry),
      ],
      crossStage: [declare("signOut", zodEmptyObject)],
    });

    expect(concierge.explain({ pathname: "/results" }).stages[0].bridge).toEqual({
      id: "results",
      registered: false,
    });

    const result = partialHandler({ args: { pathname: "/results" }, bridge: null, meta: {} });

    // AN IMPLEMENTATION THAT SHORT-CIRCUITED TO `no_bridge` whenever a declared
    // bridge is unmounted would make this case red. That auto-fail is what
    // CONTEXT rejects: core never decides an action cannot run because nothing
    // is registered, because doing so strips handlers of every legitimate
    // partial-capability path — the router read, the cached value, the
    // server-side fallback. `resolveBridge` hands over `null` and stops there.
    expect(result.ok).toBe(true);
    expect(seenBridge).toBe(null);
  });
});
