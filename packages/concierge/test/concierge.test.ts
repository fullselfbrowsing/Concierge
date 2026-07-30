// `createConcierge`'s behaviour — STG-01, STG-02, STG-03, STG-04, SEC-03,
// DX-01, CAT-03, the matcher policy and the stage-id policy, asserted against
// the BUILT artifact.
//
// What escapes without this file:
//
// Five defects, and every one of them passes a naive test.
//
//   1. A FRESH ARRAY PER CALL. React's `useSyncExternalStore` compares
//      snapshots with `Object.is` — `ReactFiberHooks.js`,
//      `return !is(prevValue, nextValue)` — and Svelte 5's `$derived` compares
//      with `equals(value) { return value === this.v; }`. A fresh-but-deep-equal
//      array is a CHANGED store to both, so it does not render slowly, it
//      renders forever. Every structural assertion one would naturally write
//      (`toEqual`, `toHaveLength`, name lists) passes on that build.
//
//      The framework is not a detector, and this is the part worth stating
//      precisely. React's warning string is
//      'The result of getSnapshot should be cached to avoid an infinite loop'
//      — react.dev abbreviates it to "should be cached", so a comment quoting
//      the docs quotes something React never prints. Its
//      `didWarnUncachedGetSnapshot` guard is a MODULE-LEVEL latch, so the
//      warning fires once per PROCESS and a second offending store is silent.
//      And the whole block is `__DEV__`-only, so a production build has no
//      warning at all — only the loop. `toBe` is the detector. S7, S8 and S9
//      are it.
//
//   2. AN UNFROZEN PROJECTION IS A LIVE TOOL-INJECTION CHANNEL. Measured:
//      `push` onto the `.filter()` result SUCCEEDED and the agent's list became
//      `['a','injected']`. Page script cannot reach a handler through that
//      array — dispatch resolves through the frozen null-prototype `byName`, so
//      the injected tool has no implementation — which means the payload is the
//      `description`, the one field a model reads and reasons over. That is
//      CAT-07's compile-time guarantee defeated at runtime: descriptions are
//      statically unforgeable and the runtime array is writable, so the
//      guarantee is void. S11, S12 and S13 assert the write THROWS and the
//      value is UNCHANGED, because `Object.isFrozen` alone was measured to
//      return `true` on a breached build.
//
//   3. THE ELEMENT-SHARING INVARIANT, which no single assertion expresses. The
//      shallow seal on a projection is complete ONLY because its elements are
//      shared and already deep-frozen. S13 (the nested-schema write) and S14
//      (the `toBe` element-sharing assertion) are one pin in two halves:
//      REMOVING EITHER ONE LEAVES THE SHALLOW PROJECTION FREEZE SILENTLY
//      INSUFFICIENT. S13 alone passes on a build that rebuilds elements per
//      projection and deep-freezes each; S14 alone passes on a build that
//      shares unfrozen elements. Neither half is the invariant.
//
//   4. A NAIVE RENAME TEST PASSES UNDER A BROKEN IMPLEMENTATION. Renaming the
//      FIRST stage proves nothing — it is first under array iteration and under
//      object-key iteration alike. Measured, on the two implementations:
//
//        | Resolution over    | before | after renaming the LATER stage to "2" |
//        |--------------------|--------|---------------------------------------|
//        | an ordered array   | results| results                               |
//        | a keyed object     | results| 2               <-- FLIPS             |
//
//      S5 is therefore the LATER-stage rename, and the naive first-stage shape
//      was run in this worktree and confirmed still green — which is the point
//      rather than a reassurance: it cannot tell the two builds apart.
//
//   5. A TWO-PASS `explain()` CAN CONTRADICT ITSELF. Measured with a matcher
//      carrying an internal counter:
//
//        two-pass: {"stage":"flaky","stages":[{"id":"flaky","matched":false}]}
//        one-pass: {"stage":"flaky","stages":[{"id":"flaky","matched":true}]}
//
//      The two-pass row set contradicts its own header, and on a deterministic
//      matcher — which is every matcher a test writes by default — it looks
//      perfect. S17 pins `explain().stage` against `stageFor()` across three
//      configs and S19 pins the shadowed-stage row set, which is the shape a
//      short-circuiting implementation gets wrong.
//
// ---------------------------------------------------------------------------
// Two behaviours have no single-literal mutant — stated rather than faked
// ---------------------------------------------------------------------------
//
// The house convention when the obvious mutant does not work is to write the
// truth into the file rather than invent one (`catalog.test.ts:458-469` is the
// precedent, where the obvious `warnHost(` -> `void (` swap produces a PARSE
// error and the harness reports a vacuous PASS having run zero tests).
//
//   (a) RENAME-INDEPENDENCE (STG-02, S5) is a property of the DATA STRUCTURE —
//       an ordered `ReadonlyArray` rather than a keyed object — not of a
//       branch. Producing it requires rewriting resolution to key by id, a
//       multi-line change no `<literal> <replacement>` swap expresses. S5 is a
//       regression detector against a future rewrite; its sensitivity rests on
//       the measured key-ordering table below, not on a mutant. M-04-4 covers
//       the adjacent property that IS mutatable — first-match-wins, S4.
//
//   (b) THE ELEMENT-SHARING INVARIANT (SEC-03, S13 + S14) cannot be mutated
//       into existence, because building fresh elements per projection is a
//       restructuring rather than a literal swap. M-04-1 proves the array
//       freeze fires; S13 and S14 together pin the invariant that makes that
//       cheap freeze sufficient.
//
// ---------------------------------------------------------------------------
// M-04-4's design constraint on the source: two distinct loop spellings
// ---------------------------------------------------------------------------
//
// M-04-4 swaps the resolution loop for a reversed one and expects first-match-
// wins (S4) to go red. That requires the literal to be UNIQUE, so resolution
// and `explain` must not share a loop spelling. What 04-03 shipped, recorded
// here so that a later refactor unifying them is visibly a mutation regression
// rather than a tidy-up:
//
//     resolveIndex : for (const [index, stage] of stages.entries())
//     explain      : stages.map((stage): StageExplanation => ({ … }))
//
// A third `for (const stage of stages)` exists — the duplicate-id scan — and is
// textually distinct from both. Unifying any two of the three collapses two
// independent proofs into one.
//
// ---------------------------------------------------------------------------
// The ID series is S1…S26, and it is deliberately NOT a continuation
// ---------------------------------------------------------------------------
//
// `catalog.test.ts` runs C1…C26. This file starts a fresh S-series rather than
// continuing it, because C-numbers are cited BY ID across the `03-*-SUMMARY.md`
// records and a silent collision is a citation defect — a reader following
// "C17" would land in whichever file they opened. Two files are two blast
// radii; the same argument `consent-variance.test-d.ts:59-62` makes for
// re-declaring `Booking` locally rather than importing a neighbour's.
//
// S15 is a comment block rather than a case — see the SEC-03 section. So the
// series runs S1…S26 and the file contains 25 `it` blocks, which is not an
// off-by-one.
//
// ---------------------------------------------------------------------------
// dist, not src — the same decision its four siblings state
// ---------------------------------------------------------------------------
//
// Every assertion here runs against `../dist/index.js`, never against the
// source, for two reasons. It is the artifact a consumer actually imports, so
// an export lost to the `export type { … }` block or a rule dropped by a build
// config is visible here and nowhere else at runtime. And `vitest.config.ts`
// (see its third header block) records that `packages/concierge/test/` is in NO
// TypeScript program at all — so a source import would be untypechecked
// anyway, while additionally testing code that never shipped. (Every mention of
// `../src/` in this file is inside a comment; the acceptance check for that
// rule is scoped to non-comment lines, which is precisely why this paragraph
// may name the thing it forbids.)
//
// The same fact removes cast ceremony, and this file USES that deliberately
// rather than working around it, exactly as `emission.test.ts:41-47` does. A
// matcher that throws, a matcher returning a truthy non-boolean, and a
// hand-rolled `BridgeRegistry` are all shapes a TypeScript consumer could not
// write — and the population those runtime rules exist for is JavaScript
// consumers, who have no checker either.
//
// ---------------------------------------------------------------------------
// This suite writes the global contract registry, once per test
// ---------------------------------------------------------------------------
//
// `buildCatalog` calls `assertSingleInstance()` on its first line — that is
// ROADMAP Phase 3 SC-5, and `single-instance.test.ts` owns the case proving it.
// `createConcierge` reaches that guard TRANSITIVELY, on the one flat
// `buildCatalog` call it makes during assembly, so every test in this file
// mutates `globalThis[Symbol.for("@fullselfbrowsing/concierge.contract")]` as a
// side effect too. Vitest's default isolation gives each test FILE its own
// process, so this cannot leak into `single-instance.test.ts`; it is reset
// below anyway, so that a future in-file case which cares about the registry
// starts from a known state rather than from whatever the previous `it`
// happened to leave.
//
// ---------------------------------------------------------------------------
// MEASURED — key ordering, and what a frozen array's derivations are
// ---------------------------------------------------------------------------
//
// Two tables, both re-measured rather than transcribed. The first is why S5 is
// shaped the way it is: integer-like keys are hoisted to the FRONT of every
// object iteration order, so under any keyed implementation renaming a later
// stage to `"2"` moves it ahead of everything declared before it and
// first-match-wins silently starts meaning something else.
//
//   object key order:  [ '2', '10', 'results', 'checkout', 'home' ]
//   for...in order  :  [ '2', '10', 'results', 'checkout', 'home' ]
//   Object.entries  :  [ '2', '10', 'results', 'checkout', 'home' ]
//   Map key order   :  [ 'results', 'checkout', '2', 'home', '10' ]
//   array order     :  [ 'results', 'checkout', '2', 'home', '10' ]
//
// The second is why the projection is sealed at all rather than derived and
// handed over. EVERY array-producing method returns an UNFROZEN result from a
// frozen source — not just `filter`:
//
//   source frozen:              true
//   filter() result frozen:     false
//   map() result frozen:        false
//   slice() result frozen:      false
//   spread result frozen:       false
//   concat result frozen:       false
//   push onto filter() result:  SUCCEEDED, length now 3

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
// `import { createConcierge } from "../dist/index.js"` would fail with an opaque
// module-resolution error on a fresh checkout, BEFORE the existence guard below
// could produce the sentence that tells a developer to run `pnpm build`. Left
// unannotated on purpose: a dynamic import yields untyped bindings, and
// annotating them would be a claim this file has no program to check.
let createConcierge;
let CatalogValidationError;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      `packages/concierge/dist/index.js is missing. These tests run against the ` +
        `BUILT artifact, not the source. Run \`pnpm build\` first.`,
    );
  }

  const artifact = await import(DIST_URL.href);
  createConcierge = artifact.createConcierge;
  CatalogValidationError = artifact.CatalogValidationError;
});

// `delete`, not assignment to `undefined` — the same reset, and the same
// reasoning, as `single-instance.test.ts:68-82`. `assertSingleInstance`
// branches on `prior === undefined`, so the slot must be genuinely absent.
beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

// ---------------------------------------------------------------------------
// Declaration helpers
// ---------------------------------------------------------------------------

// A handler that is identifiable by reference, for the same reason
// `catalog.test.ts:130-134` gives: an anonymous arrow per declaration would make
// an identity assertion unwritable. Nothing in this file dispatches — Phase 6
// owns that — so this never runs.
function noopHandler() {
  return { ok: true };
}

// `redact` IS defaulted here, and the decision is INVERTED relative to
// `catalog.test.ts:150-154`. That file deliberately omits it, because the
// population SEC-01's runtime half exists for is JavaScript consumers who
// omitted a field the type says they cannot omit, and defaulting it would put
// that failing branch out of the suite's reach. This file is the opposite case:
// every declaration here is assembled through `createConcierge`, which must
// SUCCEED, and a missing `redact` on a non-empty schema throws
// `redaction_missing` during the one flat `buildCatalog` — so every case in
// this file would fail for a reason that has nothing to do with what it claims.
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

// The natural addition in the same register. `bridge` is omitted rather than
// set to `undefined` when absent, so that "declares no bridge" is an absent key
// exactly as a consumer would write it — the source branches on
// `registry === undefined`, so both spellings work, and the one that matches
// real configuration is the one worth testing.
function stage(id: string, match: unknown, actions: unknown[], bridge?: unknown) {
  return bridge === undefined
    ? { id, match, actions }
    : { id, match, actions, bridge };
}

// The canonical two-stage config, built fresh per case because `beforeEach`
// clears the contract registry and because STG-04's whole subject is the
// INSTANCE-LOCAL memo — a shared instance across cases would let one case's
// first call populate another's.
function canonical() {
  return createConcierge({
    stages: [
      stage("results", (ctx) => ctx.pathname === "/results", [
        declare("applyFilter", zodObject),
        declare("sortResults", zodObject),
      ]),
      stage("checkout", (ctx) => ctx.pathname === "/checkout", [
        declare("confirmBooking", zodObject),
      ]),
    ],
    crossStage: [declare("signOut", zodEmptyObject)],
  });
}

describe("STG-01 — the catalog carries this stage's actions plus cross-stage, and nothing else", () => {
  it("S1 — the results stage is offered its own two actions plus signOut, and confirmBooking is ABSENT", () => {
    const concierge = canonical();
    const names = concierge.catalogFor({ pathname: "/results" }).map((tool) => tool.name);

    expect(names).toEqual(["applyFilter", "sortResults", "signOut"]);

    // STG-01's wording is that an out-of-stage action is ABSENT FROM THE
    // CATALOG rather than rejected when called, so the absence is the claim and
    // earns its own expectation. The `toEqual` above happens to imply it; a
    // later relaxation of that assertion to a `toContain` set would not, and
    // this line is what survives such a relaxation. An agent that can SEE
    // `confirmBooking` will try it — the refusal arrives after the model has
    // already decided to act, which is a different and worse design.
    expect(names).not.toContain("confirmBooking");

    // The other side of the same claim, in one case rather than two, so that
    // the pair is read together: cross-stage appears in BOTH, stage-local in
    // exactly one.
    expect(concierge.catalogFor({ pathname: "/checkout" }).map((tool) => tool.name)).toEqual([
      "confirmBooking",
      "signOut",
    ]);
  });

  it("S2 — an unrouted context is offered the cross-stage actions only, and stageFor is null", () => {
    const concierge = canonical();

    expect(concierge.catalogFor({ pathname: "/somewhere-with-no-stage" }).map((t) => t.name)).toEqual([
      "signOut",
    ]);
    expect(concierge.stageFor({ pathname: "/somewhere-with-no-stage" })).toBe(null);

    // Why this is not an EMPTY array, asserted here because the empty-array
    // build is the one a "fail closed" instinct produces and it passes every
    // other case in this file. `ConciergeConfig.crossStage` is declared
    // "available in every stage"; an unrouted page is still a page, and
    // stripping actions the developer explicitly marked global would contradict
    // the declaration they wrote. Failing closed is the right instinct for
    // CONSENT and the wrong one here — it would silently disable
    // `signOut`-shaped actions on every 404 and every route no stage has been
    // added for yet. Nothing is hidden either way: `stageFor` is `null` and
    // `explain` reports every stage `matched: false`, so the diagnosis is one
    // call away rather than absent.
    expect(concierge.catalogFor({ pathname: "/x" })).toHaveLength(1);
  });

  it("S3 — every element is an EmittedTool and carries neither the handler nor the validator", () => {
    const concierge = canonical();
    const tools = concierge.catalogFor({ pathname: "/results" });

    for (const tool of tools) {
      expect(tool.type).toBe("function");
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(typeof tool.parameters).toBe("object");

      // The projection is a PRIVILEGE REDUCTION, not a rename. A `CatalogEntry`
      // carries `action.handler` and `action.schema`; `EmittedTool`
      // deliberately carries neither, so the object handed toward a model has
      // no path to the function that runs and no path to the validator's
      // internals. `in` rather than a truthiness check, because a present key
      // holding `undefined` is a different — and equally wrong — shape.
      expect("handler" in tool).toBe(false);
      expect("schema" in tool).toBe(false);
    }

    // The exact key set, so that a fifth field added later lands here.
    expect(Object.keys(tools[0])).toEqual(["type", "name", "description", "parameters"]);
  });
});

describe("STG-02 — declaration order decides, first match wins, independent of naming", () => {
  it("S4 — with two stages both matching, the FIRST declared one wins", () => {
    const concierge = createConcierge({
      stages: [
        stage("first", () => true, [declare("fromFirst", zodObject)]),
        stage("second", () => true, [declare("fromSecond", zodObject)]),
      ],
    });

    expect(concierge.stageFor({ pathname: "/anything" })).toBe("first");
    expect(concierge.catalogFor({ pathname: "/anything" }).map((t) => t.name)).toEqual([
      "fromFirst",
    ]);

    // This is the mutatable half of STG-02 — M-04-4 reverses the resolution
    // loop and this case is what goes red. The other half, rename-independence,
    // has no single-literal mutant at all; see the header and S5.
  });

  it("S5 — renaming the LATER stage to an integer-like id does not change resolution", () => {
    // The sensitive shape, and the naive one is written out here because it is
    // what a reader would otherwise add. Renaming the FIRST stage proves
    // nothing: it is first under array iteration and first under object-key
    // iteration alike, so the naive test passes on both implementations. Run in
    // this worktree to confirm rather than assumed — the first-stage rename was
    // tried and stayed green, which is the point.
    //
    //   | Resolution over   | before  | after renaming the LATER stage to "2" |
    //   |-------------------|---------|---------------------------------------|
    //   | an ordered array  | results | results                               |
    //   | a keyed object    | results | 2                <-- FLIPS            |
    //
    // `"2"` specifically, because integer-like keys are hoisted to the FRONT of
    // every object iteration order (the table in this file's header). Under a
    // keyed implementation the later stage does not merely tie — it jumps ahead
    // of everything declared before it.
    function build(secondStageId: string) {
      return createConcierge({
        stages: [
          stage("results", () => true, [declare("fromResults", zodObject)]),
          stage(secondStageId, () => true, [declare("fromSecond", zodObject)]),
        ],
      });
    }

    const before = build("checkout");
    expect(before.stageFor({ pathname: "/x" })).toBe("results");
    expect(before.catalogFor({ pathname: "/x" }).map((t) => t.name)).toEqual(["fromResults"]);

    const after = build("2");
    expect(after.stageFor({ pathname: "/x" })).toBe("results");
    expect(after.catalogFor({ pathname: "/x" }).map((t) => t.name)).toEqual(["fromResults"]);

    // Stated as a claim rather than left implied by the two equal answers: the
    // renamed stage did not win, and it did not win by a name that would have
    // sorted first.
    expect(after.stageFor({ pathname: "/x" })).not.toBe("2");
  });
});

describe("STG-03 — the context is whatever the app knows, not a pathname", () => {
  it("S6 — a stage matching on app state with NO pathname anywhere resolves correctly", () => {
    // There is deliberately no `pathname` in this case at all — not in the
    // context, and not in the matcher. A `pathname` here would make this a
    // second STG-01 test wearing STG-03's title, which is the commonest way
    // this requirement ends up unasserted.
    //
    // `StageContext` is `{ pathname?: string; [key: string]: unknown }`, so
    // this exact shape is what a TypeScript consumer writes. (The throwing and
    // non-boolean matchers further down are NOT — those are shapes only a
    // JavaScript consumer can produce, and no cast ceremony is needed for them
    // because this file is in no TypeScript program.)
    const concierge = createConcierge({
      stages: [
        stage(
          "cart-modal",
          (ctx) => ctx.modalOpen === true && ctx.cartCount === 3,
          [declare("editQuantity", zodObject)],
        ),
      ],
      crossStage: [declare("signOut", zodEmptyObject)],
    });

    expect(concierge.stageFor({ modalOpen: true, cartCount: 3 })).toBe("cart-modal");
    expect(concierge.catalogFor({ modalOpen: true, cartCount: 3 }).map((t) => t.name)).toEqual([
      "editQuantity",
      "signOut",
    ]);

    // And the near-miss, so the matcher is demonstrably reading both fields
    // rather than matching everything.
    expect(concierge.stageFor({ modalOpen: true, cartCount: 0 })).toBe(null);
  });
});

describe("STG-04 — one frozen array per resolved stage, referentially identical across calls", () => {
  it("S7 — two DISTINCT context objects resolving to one stage return the identical array", () => {
    // This is the assertion React itself computes. `ReactFiberHooks.js`:
    //
    //   function checkIfSnapshotChanged(inst) {
    //     const nextValue = latestGetSnapshot();
    //     return !is(prevValue, nextValue);        // Object.is
    //   }
    //
    // …and Svelte 5's `equals(value) { return value === this.v; }`. A fresh,
    // deep-equal array is a CHANGED store to both. No React or Svelte install
    // is needed to assert this, because `Object.is` and `===` are what those
    // frameworks compute and both are in the language.
    const concierge = canonical();

    const a = concierge.catalogFor({ pathname: "/results" });
    const b = concierge.catalogFor({ pathname: "/results", scrollY: 900, ts: Date.now() });

    // The second context is deliberately a DIFFERENT OBJECT WITH EXTRA KEYS. A
    // case passing the same `ctx` twice would also pass under a
    // `WeakMap<StageContext, …>` memo — the implementation `PITFALLS.md:556`
    // exists to forbid, because it holds a reference to every context the app
    // has ever produced and still returns a fresh array for the next one.
    expect(a).toBe(b);

    // Spelled out on its own line even though `toBe` IS `Object.is`, so the
    // requirement is legible to a reader who does not know that.
    expect(Object.is(a, b)).toBe(true);
  });

  it("S8 — two distinct no-stage contexts share one array under the null key", () => {
    const concierge = canonical();

    const a = concierge.catalogFor({ pathname: "/nowhere" });
    const b = concierge.catalogFor({ tenantId: "acme", role: "admin" });

    // The null key is a real key, not an absence. A memo that special-cases
    // "no stage" by rebuilding the cross-stage array each time loops React on
    // exactly the pages a developer has not written a stage for yet — which is
    // every 404 and every new route.
    expect(a).toBe(b);
    expect(a.map((t) => t.name)).toEqual(["signOut"]);
  });

  it("S9 — two separate instances built from equivalent configs do NOT share an array", () => {
    const first = canonical();
    const second = canonical();

    const a = first.catalogFor({ pathname: "/results" });
    const b = second.catalogFor({ pathname: "/results" });

    // The positive claim about a negative, in C22's register. The cache must be
    // INSTANCE-LOCAL, and the reason is cross-request state pollution under
    // SSR: application modules are initialised once when a long-lived server
    // boots and the same module instances are reused for every request that
    // process serves. A module-scope memo would be shared by every
    // `createConcierge` in the process, so two configs in one server would
    // serve each other's catalogs under colliding keys — and that is a
    // correctness defect, not a leak of one user's data into another's, which
    // is why it is stated as scoping rather than as disclosure.
    expect(a).not.toBe(b);

    // …and the contents are still equal, so this is genuinely two caches of the
    // same answer rather than two different answers.
    expect(a.map((t) => t.name)).toEqual(b.map((t) => t.name));

    // Each instance is still internally stable — otherwise "not shared" could
    // be satisfied by a build with no memo at all.
    expect(first.catalogFor({ pathname: "/results" })).toBe(a);
    expect(second.catalogFor({ pathname: "/results" })).toBe(b);
  });
});

describe("CAT-03 — a consent policy may name a CROSS-STAGE action, which only createConcierge can assemble", () => {
  it("S10 — a review action requiring a cross-stage confirm action builds clean", () => {
    // This is the row that decided CAT-03's placement, and it is unreachable
    // from `catalog.test.ts` because only `createConcierge` produces the
    // assembly order that breaks the wrong implementation. Cross-stage actions
    // are appended LAST to the one flat build, so an in-loop consent check —
    // one that runs as each action is visited rather than as a post-pass over
    // the complete declared-name set — fires before `signOut` has been seen and
    // FAILS EVERY BUILD with this shape. A rule that rejects every legitimate
    // build is a rule that gets deleted, which leaves CAT-03 unenforced by the
    // shortest possible route.
    //
    // Proved able to go red rather than assumed: pointing `requires` at a name
    // declared nowhere was run in this worktree and threw
    // `CatalogValidationError`, so this case is measuring the rule rather than
    // measuring that nothing checks anything.
    const concierge = createConcierge({
      stages: [
        stage("results", () => true, [
          declare("reviewBooking", zodObject, { consent: { requires: "signOut" } }),
        ]),
      ],
      crossStage: [declare("signOut", zodEmptyObject)],
    });

    expect(concierge.catalogFor({ pathname: "/x" }).map((t) => t.name)).toEqual([
      "reviewBooking",
      "signOut",
    ]);

    // The negative half, so that "builds clean" is a measurement of THIS rule
    // and not of a build that validates nothing: the same config with a target
    // that exists nowhere must throw.
    expect(() =>
      createConcierge({
        stages: [
          stage("results", () => true, [
            declare("reviewBooking", zodObject, { consent: { requires: "nowhere" } }),
          ]),
        ],
        crossStage: [declare("signOut", zodEmptyObject)],
      }),
    ).toThrow(CatalogValidationError);
  });
});
