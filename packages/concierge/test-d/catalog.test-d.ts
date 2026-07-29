// CAT-01's compile-time half — one declaration yields the action's literal name type,
// and the catalog's lookup is keyed by that type rather than by open `string`.
//
// WHAT ESCAPES WITHOUT THIS FILE
//
// Two independent mechanisms deliver CAT-01, and each has a one-token mutation that
// destroys it with no other symptom anywhere in the repository:
//
//   1. `<const A extends readonly AnyActionDefinition[]>` on `buildCatalog`. Drop the
//      `const` and a catalog assembled from raw object literals derives `readonly
//      string[]` instead of `readonly ("openItem" | "clearFilters")[]`.
//   2. `Catalog<A[number]["name"]>` as `buildCatalog`'s return type. Replace it with
//      `Catalog<string>` and EVERY catalog degrades, however it was assembled.
//
// Neither mutation produces a runtime defect, because there is no runtime defect to
// produce: the catalog still holds the same entries, the same names and the same frozen
// record. `pnpm build` stays green, `attw` and `publint` included. Every behavioural test
// still passes. Only the *type* has silently collapsed to open `string`.
//
// So the loss has no local symptom at all. What consumes the union is phases away —
// Phase 4's stage scoping, Phase 8's grade gate, and a consumer's editor every time they
// type a dot after `catalog.byName`. The failure therefore surfaces much later as "why is
// my action name not autocompleting", by which point the one-token cause is many commits
// behind. **This file is that property's only detector.**
//
// WHICH PREDICATES CATCH WHICH MUTANT — MEASURED, NOT ASSUMED
//
// The first draft of this file asserted CAT-01 only through catalogs built from
// `defineAction` consts, and mutant M-03-3 (`<const A` -> `<A`) **escaped it at exit 0**.
// That result is not a redundant assertion; it is a missing discriminating case, and the
// measurement below is why. `A` is inferred from already-typed values in that shape, so
// the element types carry their literal `name` whether or not the type parameter is
// `const` — the `const` modifier only preserves literals that would otherwise widen, and
// `defineAction`'s own `N extends string` has already fixed them.
//
//   call-site shape                          with `const`               without `const`
//   ---------------------------------------- -------------------------- ----------------
//   [applyFilterConst, cancelBookingConst]   "applyFilter"|"cancelBooking"   (same)
//   [{name: "openItem"}, {name: "clear…"}]   "openItem"|"clearFilters"       string
//   [defineAction({name: "…"}), …] inline    string                          string
//   []                                       never                           never
//
// **Raw object literals are the only shape the `const` modifier is load-bearing for**, so
// the `_raw*` block below is what makes M-03-3 fire and the `_declared*` block cannot.
// The `_declared*` block is kept, and is not decoration: it is what fires under M-03-3b
// (`Catalog<A[number]["name"]>` -> `Catalog<string>`), which no `_raw*` predicate is
// needed for and which is the mutation that destroys CAT-01 on the *documented* path. Two
// mechanisms, two mutants, two blocks. Deleting either block leaves a live mutation
// undetected.
//
// The raw-literal path is a supported input, not a contrivance: `buildCatalog` accepts
// `readonly AnyActionDefinition[]`, and `src/define-action.ts` records that an action
// assembled without `defineAction` stays reachable by design.
//
// THE TERSE-OUTPUT CAVEAT, AND HOW A MUTANT AGAINST THIS FILE MUST BE ASSERTED
//
// Measured non-TTY, which is what CI sees (`03-RESEARCH.md` *Pitfall 10*). A failing
// `Expect<…>` prints exactly `Type 'false' does not satisfy the constraint 'true'.` and
// **no alias name** — the echoed source line and the caret are TTY-only, so the name that
// carries all of the meaning never appears in the output. Assert a mutant against this
// file on its **exit code** (`tsc` exits **1**, not 2, under typescript 7.0.2) plus
// `file:line`. Never grep the output for a predicate's name; it will never match, and a
// grep that never matches reads as a passing check.
//
// HOUSE RULES THIS FILE INHERITS, AND THE ONE THAT IS LOAD-BEARING HERE
//
// **Nothing below is annotated, and nothing below is exported.** Both halves matter and
// the second exists to protect the first. Every `defineAction` and every `buildCatalog`
// const here is deliberately un-annotated, because its *inferred* type is the entire
// subject of the file — annotating one would hand the test the answer it exists to
// derive, and the annotated const would then keep passing forever. `isolatedDeclarations`
// demands an explicit annotation on anything reaching the declaration surface, and
// non-exported locals are exempt; the exemption ends the instant anything exported reads
// one. `actions.test-d.ts:32-53` records what that looks like when it happens: the TS9010
// diagnostic lands on the **innocent** `const` declaration rather than on the export that
// reached for it, so the first fix a developer applies is to annotate the const — which
// is precisely the edit that disables the assertion. Do not export from this file.
//
// Every predicate is on ONE line however long, for the same reason: `tsc` echoes only the
// line the failing type argument sits on. Do not let a formatter wrap them.
//
// **Zero suppression directives.** Every claim here is expressible as a predicate,
// including the typo'd-lookup one: `_rawByNameIsKeyedByTheUnion` pins `keyof byName` to
// the exact union, and a key outside a `keyof` is a TS2339 by construction — so there is
// nothing left for a directive to assert, and the escape hatch `_assert.ts` reserves for
// object-literal freshness is not reached for.

import type { Assignable, Equals, Expect, Not } from "./_assert.js";
import type { CatalogEntry } from "../src/catalog.js";
import { buildCatalog } from "../src/catalog.js";
import { defineAction } from "../src/define-action.js";
import type { StandardSchemaV1 } from "../src/types.js";

// --------------------------------------------------------------------------
// Fixtures — every one local, none exported, none annotated
// --------------------------------------------------------------------------

/** The canonical example's schema, verbatim in shape from the project's own description. */
declare const filterSchema: StandardSchemaV1<unknown, { key: string; value: string }>;

/**
 * A second schema sharing nothing with the first.
 *
 * Two actions over one schema would make every array below homogeneous, and a
 * homogeneous array derives its element union under weaker inference than a
 * heterogeneous one — so the two-action catalogs would prove less than they appear to.
 * Same reasoning as `Booking` vs. `Shipment` in `actions.test-d.ts`.
 */
declare const bookingSchema: StandardSchemaV1<unknown, { bookingId: string }>;

// --------------------------------------------------------------------------
// Block 1 — the `defineAction` round trip. Fires under M-03-3b, NOT under M-03-3.
// --------------------------------------------------------------------------
//
// What this block pins is that `buildCatalog` *carries through* what `defineAction`
// already established, which is the path the documentation recommends and the only path
// CAT-07 guards. The name literal here is fixed by `defineAction<N extends string>`
// before `buildCatalog` ever sees it — so `Catalog<A[number]["name"]>` is the sole thing
// standing between these actions and a widened catalog, and replacing that return type
// with `Catalog<string>` is what these four lines exist to catch.

/**
 * The action whose `consent.requires` names something that is **not** any action's `name`
 * in this file.
 *
 * That absence is deliberate and is what makes the no-widening predicates able to
 * discriminate: `"reviewFilter"` has exactly one route into the derived union, and it is
 * the defect. `types.ts:478-487` records that defect being hit for real in Phase 1 — an
 * earlier draft typed `ConsentPolicy.requires` as the action's own `Name`, `Name` was then
 * inferred from *both* `name` and `requires`, and the pair widened to the union of the two
 * sites, "silently corrupting the name-union derivation the whole catalog depends on".
 * `actions.test-d.ts:199` is that defect's detector at the declaration level; this file is
 * its detector one level up, at the catalog.
 *
 * Un-annotated on purpose — see this file's header.
 */
const applyFilter = defineAction({
  name: "applyFilter",
  description: "Apply one facet filter to the visible result list.",
  schema: filterSchema,
  redact: "drop",
  handler: () => ({ ok: true, message: "Filtered." }),
  consent: { requires: "reviewFilter", bindTo: "userTurn" },
});

/** The second declaration, over the unrelated schema and carrying no consent policy. */
const cancelBooking = defineAction({
  name: "cancelBooking",
  description: "Cancel this booking and release the seat.",
  schema: bookingSchema,
  redact: "drop",
  handler: () => ({ ok: true, message: "Cancelled." }),
});

/** The round-trip subject: two `defineAction` results in, one derived union out. */
const declaredCatalog = buildCatalog([applyFilter, cancelBooking]);

/** The round trip, end to end. Under `Catalog<string>` this is `readonly string[]` and goes red; under the lost `const` it stays green, which is measured and is why the `_raw*` block exists. */
type _declaredNamesAreALiteralUnion = Expect<Equals<(typeof declaredCatalog)["names"], readonly ("applyFilter" | "cancelBooking")[]>>;

/** The same fact from the opposite direction, and not redundant with the line above: `Equals` is a structural identity check and can be satisfied by an accident of alias resolution, whereas this one fails whenever `names` grows wide enough to *accept* an arbitrary `readonly string[]`. */
type _declaredNamesAreNotWidenedToString = Expect<Not<Assignable<readonly string[], (typeof declaredCatalog)["names"]>>>;

/** What the union actually buys, on the documented path: the lookup is keyed by it, so `declaredCatalog.byName.aplyFilter` is a TS2339 at build time rather than an `undefined` at dispatch time. */
type _declaredByNameIsKeyedByTheUnion = Expect<Equals<keyof (typeof declaredCatalog)["byName"], "applyFilter" | "cancelBooking">>;

/** T-03-25 at the catalog level: the union comes from `name` ALONE, so `applyFilter`'s `consent.requires: "reviewFilter"` is absent from it. `noUncheckedIndexedAccess` was measured not to reach `T[number]` in type position, so this indexed access is the bare union with no `| undefined`. */
type _declaredNameUnionIgnoresConsentRequires = Expect<Not<Assignable<"reviewFilter", (typeof declaredCatalog)["names"][number]>>>;

// --------------------------------------------------------------------------
// Block 2 — raw object literals. The ONLY shape M-03-3 is detectable in.
// --------------------------------------------------------------------------
//
// Nothing has fixed these names before `buildCatalog` sees them. The contextual type is
// `AnyActionDefinition`, whose `name` is `string` (`types.ts:1022-1028`), so `"openItem"`
// widens to `string` unless the `const` type parameter holds it down. That is the whole
// of M-03-3, and this block is the whole of its detection.

/** The raw-literal subject, carrying the same non-declared `consent.requires` trick as `applyFilter` above. */
const rawCatalog = buildCatalog([
  {
    name: "openItem",
    description: "Open one result row in the detail pane.",
    schema: filterSchema,
    redact: "drop",
    handler: () => ({ ok: true, message: "Opened." }),
    consent: { requires: "reviewItem", bindTo: "userTurn" },
  },
  {
    name: "clearFilters",
    description: "Remove every active facet filter.",
    schema: bookingSchema,
    redact: "drop",
    handler: () => ({ ok: true, message: "Cleared." }),
  },
]);

/** The degenerate case a union type is likeliest to collapse on — one member, not `string`. A singleton union and a widened type are indistinguishable in a hover on a single-action app, which is exactly why it gets its own line. */
const soloRawCatalog = buildCatalog([
  {
    name: "openItem",
    description: "Open one result row in the detail pane.",
    schema: filterSchema,
    redact: "drop",
    handler: () => ({ ok: true, message: "Opened." }),
  },
]);

/** M-03-3's primary detector: without the `const` modifier this is `readonly string[]`. */
type _rawNamesAreALiteralUnion = Expect<Equals<(typeof rawCatalog)["names"], readonly ("openItem" | "clearFilters")[]>>;

/** M-03-3's second, opposite-direction detector, for the reason given on `_declaredNamesAreNotWidenedToString`. Measured today the assignability is `false`, so this is `true`; under the mutant it is `true`, so this is `false`. */
type _rawNamesAreNotWidenedToString = Expect<Not<Assignable<readonly string[], (typeof rawCatalog)["names"]>>>;

/** The lookup key, on the path where losing it is silent. Under the mutant `keyof` is `string` and every typo resolves. */
type _rawByNameIsKeyedByTheUnion = Expect<Equals<keyof (typeof rawCatalog)["byName"], "openItem" | "clearFilters">>;

/** One action still yields a one-member union rather than collapsing to `string`. */
type _rawSingleActionYieldsASingletonUnion = Expect<Equals<(typeof soloRawCatalog)["names"], readonly "openItem"[]>>;

/** T-03-25 again, on the shape where the union is actually derived here rather than carried through. `"reviewItem"` is no action's `name`, so its only route into the union is the second-inference-site defect. */
type _rawNameUnionIgnoresConsentRequires = Expect<Not<Assignable<"reviewItem", (typeof rawCatalog)["names"][number]>>>;

// --------------------------------------------------------------------------
// Block 3 — the empty catalog, measured rather than predicted
// --------------------------------------------------------------------------

/** Zero actions must be a legal build, not a type error. */
const emptyCatalog = buildCatalog([]);

/** MEASURED, not assumed: `buildCatalog([])` is `Catalog<never>`, so `names` is `readonly never[]` and `byName` is `Readonly<Record<never, CatalogEntry>>`. Both are correct — an empty catalog admits no name, and `readonly never[]` is exactly the type of an array that can never hold one. Measured identical with and without the `const` modifier, so this line is M-03-3b's detector rather than M-03-3's. */
type _emptyCatalogNamesAreNever = Expect<Equals<(typeof emptyCatalog)["names"], readonly never[]>>;

// --------------------------------------------------------------------------
// Block 4 — a MEASURED GAP, pinned so that closing it is visible
// --------------------------------------------------------------------------
//
// **`defineAction` called INLINE inside `buildCatalog`'s argument loses the name union,
// and the `const` modifier does not save it.** This is the most ergonomic spelling there
// is and the one a consumer reaches for first:
//
//   const catalog = buildCatalog([ defineAction({ name: "applyFilter", … }) ]);
//   catalog.byName.aplyFilter   // NO ERROR — byName is Record<string, CatalogEntry>
//
// Mechanism, isolated by measurement rather than reasoned about: the contextual type
// `AnyActionDefinition` has `name: string`, and it flows into the inline call and binds
// `defineAction`'s `N` to `string` before the `name` property is ever consulted. Three
// measurements pin that down —
//
//   takesAny<T extends AnyActionDefinition>(defineAction({name: "ctxOne", …}))  ->  string
//   takesUnknown<T>(defineAction({name: "ctxOne", …}))                          ->  "ctxOne"
//   defineAction({name: "ctxOne", …})            (no contextual type at all)    ->  "ctxOne"
//
// — so it is the *shape* of the contextual type and nothing about arrays, `buildCatalog`,
// or literal widening. `[…] as const` on the argument does **not** fix it (measured), which
// independently rules out array widening as the cause. Two things do fix it today:
// declaring the action as its own `const` first (Block 1's shape, which is what the
// documentation should therefore recommend), or supplying `defineAction`'s type arguments
// explicitly — `defineAction<"gOne", "G one.", typeof filterSchema>({…})` was measured to
// derive `readonly "gOne"[]`.
//
// The same mechanism applies anywhere a declaration is contextually typed as
// `AnyActionDefinition`, which includes `StageDefinition.actions` and
// `ConciergeConfig.crossStage`. That is a wider surface than this file, and closing it is
// a change to `src/` that this plan does not own.
//
// **If this predicate ever goes red, the gap has been CLOSED. Delete the predicate and
// this comment — do not relax it.** Same standing instruction as the `${number}` gap
// pinned in `description-literal.test-d.ts`, and for the same reason: a pin on a known
// defect is only useful if it is loud when the defect goes away.

/** Un-annotated, and the inline call is the entire point — hoisting it to a `const` would silently repair the very thing this pins. */
const inlineCatalog = buildCatalog([
  defineAction({
    name: "inlineFilter",
    description: "Declared inline inside the catalog argument.",
    schema: filterSchema,
    redact: "drop",
    handler: () => ({ ok: true, message: "Filtered." }),
  }),
]);

/** The pin. `readonly string[]` is what is measured TODAY and is a defect, not a specification; see the block comment directly above before touching this line. */
type _inlineDefineActionLosesTheUnion = Expect<Equals<(typeof inlineCatalog)["names"], readonly string[]>>;

// --------------------------------------------------------------------------
// Block 5 — SEC-03's compile-time companion. `Readonly<…>` is erased at emit.
// --------------------------------------------------------------------------
//
// `Object.freeze` is what actually holds the catalog down at runtime, and
// `artifact.test.ts:62-63` is what proves the freeze survives the build — because every
// `readonly` below is erased at emit and reaches no consumer as anything but a `.d.ts`
// claim. These two lines are the other half: they keep the claim true, so that a
// TypeScript consumer is told the same thing the runtime will enforce. Neither
// substitutes for the freeze test, and the freeze test does not substitute for these.

/** The collection cannot be swapped for a mutable one — drop the `readonly` on `Catalog.entries` and `push` becomes available to a consumer the runtime will then throw at. */
type _entriesAreReadonly = Expect<Not<Assignable<(typeof rawCatalog)["entries"], CatalogEntry[]>>>;

/** The elements, which the line above does not cover. `Equals` and not `Assignable`, and the choice is the whole value of the line: a mutable-shaped `{action, parameters}` object IS assignable to `CatalogEntry` — measured `true` — because readonly property modifiers do not affect assignability, so an `Assignable` spelling here would stay green with both modifiers deleted. `Readonly<CatalogEntry>` being identical to `CatalogEntry` is true today and is false the moment either member loses its `readonly`. */
type _entryMembersAreReadonly = Expect<Equals<CatalogEntry, Readonly<CatalogEntry>>>;
