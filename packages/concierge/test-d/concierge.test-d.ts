// Phase 4's type-level half — SEC-03, DX-01, STG-03 and STG-04 as claims that can go
// red. Everything pinned below is invisible to `test/`, and that is why this file
// exists rather than being folded into the runtime suite.
//
// WHAT ESCAPES WITHOUT THIS FILE
//
// Three losses. None of them produces a runtime symptom, a failing test, or a build
// warning anywhere else in this repository — `pnpm build` stays green, `attw` and
// `publint` included, and every behavioural case in `test/` keeps passing.
//
//   1. A MUTABLE `EmittedTool`. `resolveCatalog` returns readonly tools,
//      and `ReadonlyArray<…>` protects the ARRAY while saying nothing whatsoever
//      about the elements it holds. Before this phase
//      `concierge.resolveCatalog(ctx).tools[0]!.name = "evil"` typechecked — measured, and
//      recorded in `src/types.ts` with the `!` that this repo's
//      `noUncheckedIndexedAccess` requires (the bare `[0].name` form fails earlier,
//      at the index access, with TS2532, so it never reaches the assignment the
//      claim is about). Only the runtime `Object.freeze` stopped the write. The
//      runtime suite cannot tell a `readonly` build from a mutable one, because the
//      freeze throws either way and every modifier below is erased at emit — so the
//      freeze test and this file guard the same property for two different consumers
//      and neither substitutes for the other. The consumer who pays when this is lost
//      is the transport author consuming `Transport.setCatalog(...)`
//      hands consumer-written code the very element objects that every stage array
//      shares by reference.
//
//   2. A SILENTLY WIDENED `Concierge["explain"]` — or `createConcierge`. Both are
//      pinned with `Equals` rather than `Assignable`, and that choice is the entire
//      value of those two lines: `Assignable<…>` stays TRUE when a field is widened
//      to `unknown`, to a bare function type, or to a union that swallows the
//      declared type, which is exactly the silent-widening regression worth guarding.
//      The argument is `actions.test-d.ts:469-476`'s, transferred.
//
//   3. `StageContext` NARROWED TO PATHNAME-ONLY. STG-03 requires stage matching to
//      read arbitrary app context, not just a URL. A `StageContext` that lost its
//      index signature would fail HERE and nowhere else, because `test/` is in no
//      TypeScript program at all — its context objects are untyped, so they would go
//      on passing against a type that had stopped admitting them.
//
// THE TERSE-OUTPUT CAVEAT, AND HOW A MUTANT AGAINST THIS FILE MUST BE ASSERTED
//
// Measured non-TTY, which is what CI sees (`03-RESEARCH.md` *Pitfall 10*, restated at
// `catalog.test-d.ts:55-63`). A failing `Expect<…>` prints exactly `Type 'false' does
// not satisfy the constraint 'true'.` and **no alias name** — the echoed source line
// and the caret are TTY-only, so the name carrying all of the meaning never appears in
// the output. Assert a mutant against this file on its **exit code** (`tsc` exits
// **1**, not 2, under typescript 7.0.2) plus `file:line`. Never grep the output for a
// predicate's name; it will never match, and a grep that never matches reads as a
// passing check.
//
// **M-04-14 is asserted exactly that way, AND ITS DIAGNOSTIC IS NOT THE USUAL ONE.**
// That mutant deletes `explain: (ctx: StageContext) => Explanation;` from
// `src/types.ts`. Measured in this worktree, it produces exactly two diagnostics and
// exits 1:
//
//   src/concierge.ts(698,44):           error TS2353: Object literal may only specify
//                                       known properties, and 'explain' does not exist
//                                       in type 'Concierge'.
//   test-d/concierge.test-d.ts(148,59): error TS2339: Property 'explain' does not exist
//                                       on type 'Concierge'.
//
// **TS2339, at the indexed access — not TS2344 at the assertion.** The program stops
// resolving `Concierge["explain"]` before the `Expect<…>` constraint is ever evaluated,
// so the failure never reaches the `Type 'false' does not satisfy the constraint 'true'`
// form every other predicate in this file fails with. This is the same trap
// `exports.test-d.ts:32-42` records for its own TS1485 case, and it is recorded here for
// the same reason: a reader expecting TS2344 will conclude the pin did not fire. It
// fired. The line number above is `_conciergeExplainSignature`'s, and it is the second
// half of what 04-07 asserts on — that this FILE, and not only `src/concierge.ts`,
// appears among the diagnostics.
//
// HOUSE RULES THIS FILE INHERITS
//
// **Nothing below is exported.** `isolatedDeclarations` demands an explicit annotation
// on anything reaching the declaration surface, and non-exported locals are exempt;
// the exemption ends the instant anything exported reads one. `actions.test-d.ts:32-53`
// records what that looks like: the TS9010 diagnostic lands on the **innocent** local
// rather than on the export that reached for it, so the first fix a developer applies
// is to annotate the local — which is precisely the edit that disables the assertion.
//
// **Annotations appear below only where the annotation IS the assertion.** In
// `catalog.test-d.ts` nothing is annotated, because that file's subject is what
// TypeScript *infers* and an annotation would hand it the answer. This file's subject
// is different: its predicates read declared types by name, so there is no inference to
// protect, and the single annotated const — `_plainStageLiteral: StageDefinition` — is
// annotated for the same reason `actions.test-d.ts:442` annotates its two, namely that
// "this literal is accepted at this type" is the whole claim. Do not add an annotation
// anywhere it is not carrying a claim.
//
// **Every predicate is on ONE line however long**, because `tsc` echoes only the line
// the failing type argument sits on. Do not let a formatter wrap them.
//
// **Zero suppression directives.** `catalog.test-d.ts:82-86` records a file with zero
// and explains why every claim there was expressible as a predicate; that is the target
// here and it was met. The escape hatch `_assert.ts` reserves for object-literal
// freshness is not reached for, because no claim below is a freshness claim.

import type { Equals, Expect } from "./_assert.js";
import type {
  Concierge,
  ConciergeConfig,
  EmittedTool,
  Explanation,
  StageContext,
  StageDefinition,
  StageExplanation,
} from "../src/types.js";
// The value import is from the BARREL, deliberately — `../src/index.js`, never
// `../src/concierge.js`. The point of pinning `createConcierge`'s signature is that the
// PUBLIC entrypoint carries the callable value at that signature; a state that compiles
// from the module but not from the barrel is exactly what `exports.test-d.ts` catches
// one level up, and importing from the module here would make this file blind to it.
// (`test-d/` reads `../src/`; the inverse of `test/`, which reads the built artifact.
// `tsconfig.test-d.json` includes `["src/**/*.ts", "test-d/**/*.ts"]`.)
import { createConcierge } from "../src/index.js";

// --------------------------------------------------------------------------
// SEC-03's compile-time half — the modifiers the freeze cannot speak for
// --------------------------------------------------------------------------

/** The elements a `ReadonlyArray<EmittedTool>` does not cover. `Equals` and NOT `Assignable`, and the choice is the whole value of the line: readonly property modifiers do not affect assignability, so a mutable-shaped `{type, name, description, parameters}` object IS assignable to `EmittedTool` and an `Assignable` spelling would stay green with every modifier deleted. This is the same defect one level down from `catalog.test-d.ts:301`'s `_entryMembersAreReadonly`, and the two should read as a pair. `Readonly<EmittedTool>` being identical to `EmittedTool` is true today and false the moment any one of the four members loses its `readonly`. */
type _emittedToolMembersAreReadonly = Expect<Equals<EmittedTool, Readonly<EmittedTool>>>;

/** `explain()`'s return value is deep-frozen at runtime; this is the type-level half, in the same spelling and for the same reason. Delete one `readonly` and a consumer is told they may write to a value the runtime will throw at. */
type _explanationMembersAreReadonly = Expect<Equals<Explanation, Readonly<Explanation>>>;

/** The rows inside `Explanation.stages`, which the line above does not reach — `ReadonlyArray<StageExplanation>` protects the array, not its elements, which is the identical gap `EmittedTool` had. */
type _stageExplanationMembersAreReadonly = Expect<Equals<StageExplanation, Readonly<StageExplanation>>>;

// --------------------------------------------------------------------------
// DX-01 — `Explanation`'s shape, field by field
// --------------------------------------------------------------------------

/** Three fields, one per clause of DX-01, and `Equals` on `keyof` is what keeps it three: a fourth field added later goes red here and must therefore be a decision rather than a drive-by. Phase 1's D-04 preference — prefer fewer, better-justified fields — governs, and `src/types.ts` records the five-field shape that was rejected. */
type _explanationHasExactlyFourFields = Expect<Equals<keyof Explanation, "stage" | "stages" | "actions" | "catalog">>;

/** One spelling of "no stage" across atomic catalogs and explanations. */
type _explanationStageIsNullableString = Expect<Equals<Explanation["stage"], string | null>>;

/** The three-state bridge report, pinned in full because it is the shape Phase 5 must NOT have to change: `id` and `read()` are both on the declared `BridgeRegistry` today, so `createBridge` arriving later produces a conforming object and moves nothing. The two rejected shapes are recorded in `src/types.ts` — `string | null` loses `registered` and would have to widen in Phase 5, and a third `"unknown"` state stops being reachable the moment Phase 5 lands and is then dead prose in a shipped `.d.ts`. */
type _stageExplanationBridgeShape = Expect<Equals<StageExplanation["bridge"], { readonly id: string; readonly registered: boolean } | null>>;

// --------------------------------------------------------------------------
// The two signatures that can be widened without anything else noticing
// --------------------------------------------------------------------------

/** `Equals`, not `Assignable`, per `actions.test-d.ts:469-476`: an `Assignable` spelling "stays true when the field is widened to `unknown`, to a bare function type, or to a union that swallows the declared type — which is exactly the silent-widening regression worth guarding". This is also M-04-14's detector in this file: delete the member from `src/types.ts` and the indexed access below stops resolving. */
type _conciergeExplainSignature = Expect<Equals<Concierge["explain"], (ctx: StageContext) => Explanation>>;

/** `createConcierge`'s signature is pinned HERE, not in `exports.test-d.ts` — that file's predicates are deliberately loose (`(...args: never[]) => unknown`) because they guard export PLACEMENT only, and tightening them would duplicate this line and make them fail for reasons unrelated to placement. This one predicate also covers "did not silently gain a `const` type parameter", measured rather than assumed: `Equals<typeof createConcierge, (config: ConciergeConfig) => Concierge>` reads `true` against the shipped declaration and `false` against a `<const C extends ConciergeConfig>(config: C) => Concierge` form, so a second predicate would assert nothing this one does not. That generic form WOULD recover the literal action-name union inside a config literal and is deliberately declined; `src/types.ts` and `createConcierge`'s own doc comment carry the argument. */
type _createConciergeSignature = Expect<Equals<typeof createConcierge, (config: ConciergeConfig) => Concierge>>;

/** STG-04's compile-time companion. The return type is what makes the memo's identity guarantee expressible to a TypeScript consumer at all, and widening it to `EmittedTool[]` would offer `push` on an array the runtime has frozen — the array-level half of the element-level pin at the top of this file. */
type _resolveCatalogReturnsAtomicSnapshot = Expect<Equals<Concierge["resolveCatalog"], (ctx: StageContext) => import("../src/types.js").ResolvedCatalog>>;

// --------------------------------------------------------------------------
// STG-03 — arbitrary app context. COMPILATION IS THE ASSERTION here.
// --------------------------------------------------------------------------
//
// These four are declarations, not predicates, and that is the correct mechanism for an
// admits-this-shape claim: there is no `Expect<…>` to write, because the thing being
// asserted is that the program builds. Narrow `StageContext` to `{ pathname?: string }`
// and three of the four below become errors — TS2339 on the unknown properties and
// TS2353 on the excess ones — rather than a `false` anywhere.
//
// All four were verified to compile under the full repo flag set (`strict`,
// `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `isolatedDeclarations`,
// `verbatimModuleSyntax`) at `04-RESEARCH.md:496-503`, and re-measured here.
//
// `_m1` is the STG-01 shape and carries none of STG-03's weight; it is kept as the
// contrast that makes the other three legible. `_m2` and `_m3` are the requirement:
// neither mentions `pathname` at all.

/** The URL-only matcher. Not STG-03 — this is what STG-03 exists to be more than. */
const _m1 = (ctx: StageContext): boolean => ctx.pathname === "/results";

/** Bracket access on two non-`pathname` keys, one of them numeric-valued. This is the shape an app with modal state and a cart actually writes. */
const _m2 = (ctx: StageContext): boolean => ctx["modal"] === "checkout" && ctx["cartCount"] !== 0;

/** DOT access on the index signature, which is the half a reader doubts: `ctx.modal` compiles, so a matcher author is never forced into bracket syntax by the type. */
const _m3 = (ctx: StageContext): boolean => ctx.modal === "x";

/** A plain object literal at `StageDefinition`, annotated because the annotation IS the claim — `actions.test-d.ts:442` records the same finding for its own two stage literals. This is why no `defineStage` helper is shipping: there is nothing for one to fix. */
const _plainStageLiteral: StageDefinition = { id: "results", match: _m1, actions: [] };

/** A context carrying keys no matcher declared, passed positionally through the declared `match`. Excess-property checking applies to fresh object literals, so this is the strictest position the call can be made from — and it compiles, which is STG-03's claim in one line. */
const _extraKeysAreAccepted: boolean = _plainStageLiteral.match({ pathname: "/x", tenantId: "acme", role: "admin" });

/** `_m2` and `_m3` are otherwise unread, and an unread local is one refactor away from being deleted as dead. Reading them here ties them to a value, so the four shapes travel together. */
const _stg03ShapesAreLive: boolean = _m2({ modal: "checkout", cartCount: 3 }) || _m3({ modal: "x" }) || _extraKeysAreAccepted;
