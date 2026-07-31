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

  it("D8 — a class instance comes back BY REFERENCE and is NOT frozen", () => {
    class Model {
      constructor() {
        this.n = 1;
      }
    }
    const model = new Model();

    const result = captureOne(model);

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
