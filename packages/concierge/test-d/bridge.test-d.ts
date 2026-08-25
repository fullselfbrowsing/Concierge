// Phase 5's type-level half — BRG-01, BRG-03 and BRG-05 as claims that can go red.
// Everything pinned below is invisible to `test/`, and that is why this file exists
// rather than being folded into the runtime suite.
//
// WHAT ESCAPES WITHOUT THIS FILE
//
// The runtime suites for this phase import `../dist/index.js` **dynamically**, so every
// binding they touch arrives untyped. `test/bridge.test.ts`, `test/bridge-snapshot.test.ts`
// and `test/single-instance.test.ts` are in no TypeScript program at all; they assert on
// values, and a signature is not a value. Three consequences, none of which produces a
// failing test, a build warning, or an `attw`/`publint` complaint anywhere else in this
// repository:
//
//   1. A SILENTLY WIDENED `offPageResult`. Widen `what` and `where` to `unknown` and
//      every runtime case keeps passing — they call it with two strings, which `unknown`
//      still accepts. The consumer who pays is the handler author, who is the whole
//      audience for BRG-03: `offPageResult(count, page)` with the arguments transposed,
//      or with a number where a sentence belongs, stops being a compile error and starts
//      being a sentence read aloud to a user. `_offPageResultSignature` below is spelled
//      with `Equals` for exactly this, and `Assignable` was measured to be blind to it —
//      the measurement is itself a predicate, two lines further down, rather than a claim
//      in a comment.
//
//   2. A `createBridge` THAT STOPPED TRACKING ITS BRIDGE TYPE. `createBridge<B>` returning
//      `BridgeRegistry<Bridge>` instead of `BridgeRegistry<B>` is invisible to every
//      behavioural assertion in the phase — the object is identical at runtime. What is
//      lost is the entire reason the parameter exists: `read()` stops returning the app's
//      own bridge and starts returning the permissive supertype, so a handler reading
//      `bridge.actions.applyFilter` gets `(...args: never[]) => unknown` and is pushed
//      into the `as` cast that the consent kernel later reads through. `actions.test-d.ts`
//      records the same defect one level up, where a `Bridge` default too narrow to admit
//      a real bridge went past a 19-mutation battery and nine plans.
//
//   3. A `captureSnapshot` WHOSE THIRD PARAMETER BECAME REQUIRED. Every runtime case in
//      this phase that omits the normalizer is JavaScript, so it would keep passing; the
//      breakage lands on the adapter packages, where `captureSnapshot(bridge, id)` is the
//      two-argument call every framework except Svelte makes. `_captureSnapshotSignature`
//      and `_captureSnapshotNormalizerIsOptional` bracket that, and the second was
//      measured to genuinely go red against a required-third-parameter variant rather
//      than merely to look like it would.
//
// THE TERSE-OUTPUT CAVEAT, AND HOW A MUTANT AGAINST THIS FILE MUST BE ASSERTED
//
// Measured non-TTY, which is what CI sees (`03-RESEARCH.md` *Pitfall 10*, restated at
// `catalog.test-d.ts:55-63` and `concierge.test-d.ts:40-49`). A failing `Expect<…>` prints
// exactly `Type 'false' does not satisfy the constraint 'true'.` and **no alias name** —
// the echoed source line and the caret are TTY-only, so the name that carries all of the
// meaning never appears in the output. Assert a mutant against this file on its **exit
// code** (`tsc` exits **1**, not 2, under typescript 7.0.2) plus `file:line`. Never grep
// the output for a predicate's name; it will never match, and a grep that never matches
// reads as a passing check.
//
// AND THIS FILE HAS A SECOND DIAGNOSTIC SHAPE, WHICH IS NOT TS2344
//
// The value import below is the same barrel import `exports.test-d.ts:73` makes. Plan
// 05-03 measured what a P-05-1 mutation — the three values moved into `index.ts`'s
// `export type { … }` block — actually produces there: **three TS1485 at the shared IMPORT
// line**, at three different columns, and not TS2344 on the predicate lines named after
// them. This file inherits that behaviour, so from now on that mutation reddens SIX
// TS1485 across TWO files. A reader of the battery's output who is looking for a
// diagnostic on `_createBridgeSignature`'s line will not find one; the pin fired anyway.
//
// WHAT THESE PREDICATES DO NOT CATCH — measured, so nobody has to rediscover it
//
// A `const` type parameter. `Equals<typeof createBridge, <B extends Bridge = Bridge>(id:
// string) => BridgeRegistry<B>>` was measured this session against a
// `<const B extends Bridge = Bridge>` variant of the same signature and read **true** —
// TypeScript's type-identity relation ignores the `const` modifier, and the
// `Parameters<…>` decomposition ignores it for the same reason. `concierge.test-d.ts:150`
// records that `_createConciergeSignature` DOES discriminate its own `const` variant; that
// works because the `const` there sits on a parameter the argument is inferred from, and
// `createBridge` has no such parameter — `id: string` mentions `B` nowhere, so there is
// nothing for `const` to change. Do not add a predicate claiming to cover it. The honest
// statement is that `createBridge` gaining a `const` type parameter would be a **no-op**,
// which is a different and weaker claim than "it is guarded", and weaker in the direction
// that costs nothing.
//
// HOUSE RULES THIS FILE INHERITS
//
// **Nothing below is exported.** `isolatedDeclarations` demands an explicit annotation on
// anything reaching the declaration surface, and non-exported locals are exempt; the
// exemption ends the instant anything exported reads one. `actions.test-d.ts:32-53`
// records what that looks like: the TS9010 diagnostic lands on the **innocent** local
// rather than on the export that reached for it, so the first fix a developer applies is
// to annotate the local — which is precisely the edit that disables the assertion.
//
// **Every predicate is on ONE line however long**, because `tsc` echoes only the line the
// failing type argument sits on. Do not let a formatter wrap them.
//
// **Zero suppression directives.** Every claim here is expressible as a predicate, so the
// escape hatch `_assert.ts` reserves for object-literal freshness is not reached for. That
// hatch suppresses ANY error on the line after it — including an unrelated typo, which has
// happened twice in this repository — and TypeScript offers no way to scope it to an error
// code. There is also no runner-provided type-assertion helper anywhere in `test-d/`, and
// there will not be one: `tsc --noEmit` is this suite's entire apparatus, and a helper
// that reports through a runner would move the failure out of the gate that runs it.

import type { Assignable, Equals, Expect, Not } from "./_assert.js";
import type { ActionResult, Bridge, BridgeRegistry, SnapshotNormalizer } from "../src/types.js";
// The value imports are from the BARREL, deliberately — `../src/index.js`, never
// `../src/bridge.js`. The point of pinning a signature is that the PUBLIC entrypoint
// carries the callable value AT that signature; a state that compiles from the module but
// not from the barrel is exactly what `exports.test-d.ts` catches one level up, and
// importing from the module here would make this file blind to it. (`test-d/` reads
// `../src/`; the inverse of `test/`, which reads the built artifact. `tsconfig.test-d.json`
// includes `["src/**/*.ts", "test-d/**/*.ts"]`.)
import { captureSnapshot, createBridge, offPageResult } from "../src/index.js";

// --------------------------------------------------------------------------
// Fixtures — declared HERE, not imported, and the reason is structural
// --------------------------------------------------------------------------
//
// `actions.test-d.ts:416,419` declares bridge fixtures of exactly these two shapes and
// carries no `export` on either — verified this session, and `concierge.test-d.ts` imports
// nothing from that file. Every fixture in `test-d/` is file-local by the same house rule
// that forbids exporting predicates, so "reuse the fixtures" can only mean reuse their
// SHAPE. Two shapes, duplicated; zero assertions, duplicated.
//
// What is deliberately NOT copied here is the nullability assertion on the registry's
// `read` at `actions.test-d.ts:436`. That line already discriminates mutant P-05-3
// (`read: () => B | null` narrowed to `() => B`), and it was measured to be the only thing
// in the four-file suite that did. A second copy would be two lines to update and one
// place for them to disagree — and the copy that went stale would still read as coverage.
// Likewise absent: any predicate on the message-length bound. `05-RESEARCH.md` § Q6
// records that reading that constant from `../src/types.js` recreates the blind guard
// `STATE.md` warns about; the placement pin for it lives in `exports.test-d.ts:80` and
// reads from `index.js`, which is the half that can actually regress.

/** The canonical example, verbatim in shape from the project's own description. */
type ResultsBridge = Bridge<{ applyFilter: (key: string, value: string) => void }, { visibleCount: () => number }>;

/** A second bridge sharing nothing with the first — different verbs, different snapshot. Two bridges of one shape would agree even under a `createBridge` that had stopped tracking `B` at all, and would prove nothing. */
type CartBridge = Bridge<{ removeItem: (id: string) => void }, { total: () => number }>;

// --------------------------------------------------------------------------
// BRG-01 — `createBridge`'s signature
// --------------------------------------------------------------------------

/** The whole signature including its generic head, which is the strongest of the five and the only one that sees the `= Bridge` default: measured this session, `Equals<…>` against a `<B extends Bridge>(id: string) => BridgeRegistry<B>` variant with the default deleted reads FALSE, while the `ReturnType` decomposition two predicates down stays TRUE against that same variant, because an uninferrable type parameter falls back to its CONSTRAINT and the constraint here is also `Bridge`. Also measured red against `id: unknown`, against an added second parameter, and against a non-generic `(id: string) => BridgeRegistry<Bridge>`. */
type _createBridgeSignature = Expect<Equals<typeof createBridge, <B extends Bridge = Bridge>(id: string) => BridgeRegistry<B>>>;

/** Instantiated at a concrete bridge, which is the form a consumer actually writes and the form `actions.test-d.ts:400-406` records a whole phase getting wrong: a type parameter never instantiated is a type parameter never tested. `BridgeRegistry<ResultsBridge>` exactly — not a supertype of it, which is what the next predicate exists to make legible. */
type _createBridgeReturnsRegistryAtItsBridge = Expect<Equals<ReturnType<typeof createBridge<ResultsBridge>>, BridgeRegistry<ResultsBridge>>>;

/** The negative control the predicate above needs to mean anything: the return type must DIFFER at a different bridge. A `createBridge` that ignored `B` and always returned `BridgeRegistry<Bridge>` would make this read false, and `Not<…>` is what turns "these two are distinguishable" into something that can go red. This is also the only line reading `CartBridge`, which keeps the second shape live rather than one refactor from being deleted as dead. */
type _createBridgeReturnTypeTracksItsBridge = Expect<Not<Equals<ReturnType<typeof createBridge<ResultsBridge>>, BridgeRegistry<CartBridge>>>>;

/** One parameter, and it is a `string`. The `Parameters` decomposition is deliberately kept alongside the whole-signature pin above because it is the one that names the defect in the diagnostic a reader will actually be looking at: a second parameter added to `createBridge` reddens both, and this is the one whose alias says which. Tuple labels do not affect `Equals` — measured; `[id: string]` and `[string]` both read true — so the label here is documentation, not assertion. */
type _createBridgeTakesOneString = Expect<Equals<Parameters<typeof createBridge>, [id: string]>>;

/** `createBridge("results")` with no explicit type argument yields `BridgeRegistry<Bridge>`, which is what makes the un-parameterised call — the one every quickstart writes — usable rather than merely legal. Stated precisely, because the imprecise version is tempting: this predicate does NOT discriminate the `= Bridge` default's removal (measured; the constraint fallback covers for it), and `_createBridgeSignature` is what does. It discriminates a widened or narrowed CONSTRAINT, which the whole-signature form would also catch and which this one names. */
type _createBridgeDefaultsToBridge = Expect<Equals<ReturnType<typeof createBridge>, BridgeRegistry<Bridge>>>;

// --------------------------------------------------------------------------
// BRG-03 — the off-page result helper
// --------------------------------------------------------------------------

/** `Equals`, not `Assignable`, per `actions.test-d.ts:469-476`: an `Assignable` spelling "stays true when the field is widened to `unknown`, to a bare function type, or to a union that swallows the declared type — which is exactly the silent-widening regression worth guarding". CONTEXT settles the two-string form, so this shape is stable and a change to it should be a decision rather than a drive-by. The data-less `ActionResult` status is pinned in the same breath: `offPageResult` cannot produce structured data, and keeping that fact in its return type lets legacy handlers use it without falsely widening their result after structured outputs were added. Intersecting rather than omitting keeps the public `data` property readable as `undefined` for source compatibility. */
type _offPageResultSignature = Expect<Equals<typeof offPageResult, (what: string, where: string) => ActionResult & { readonly data?: never }>>;

/** The executable form of the sentence above, so the choice of spelling is measured rather than asserted. Both parameters widened to `unknown` and the result is STILL assignable to the declared shape — this predicate reads true, and it is the proof that an `Assignable` spelling of the line above would have gone on passing through precisely the regression it exists to catch. If TypeScript ever changed this, the argument in the header would be wrong and this line is what would say so. */
type _assignableStaysTrueUnderTheWideningEqualsCatches = Expect<Assignable<(what: unknown, where: unknown) => ActionResult, (what: string, where: string) => ActionResult>>;

// --------------------------------------------------------------------------
// BRG-05 — `captureSnapshot`'s signature
// --------------------------------------------------------------------------

/** The whole signature including its generic head. Measured red against a variant whose third parameter is REQUIRED, which is the regression the two `Assignable` predicates below decompose into named halves. */
type _captureSnapshotSignature = Expect<Equals<typeof captureSnapshot, <B extends Bridge>(bridge: B, id: string, normalize?: SnapshotNormalizer) => Record<string, unknown>>>;

/** A PLAIN `Record<string, unknown>`, and the plainness is the claim. `captureSnapshot` invokes every snapshot getter and detaches each value, so what comes back is a new object the caller owns outright; narrowing this to a `Readonly<…>` or branding it would announce a guarantee the implementation deliberately does not make — 05-01 records that the returned container is NOT frozen, because freezing it is the operation that was measured to freeze the consumer's own model objects. */
type _captureSnapshotReturnsPlainRecord = Expect<Equals<ReturnType<typeof captureSnapshot<ResultsBridge>>, Record<string, unknown>>>;

/** The third parameter accepts a `SnapshotNormalizer` — the Svelte seam, where `$state.snapshot` is passed in because a rune-backed proxy cannot be detached structurally. This is the half that goes red if the parameter is retyped to something a normalizer no longer fits. */
type _captureSnapshotAcceptsASnapshotNormalizer = Expect<Assignable<typeof captureSnapshot, (bridge: ResultsBridge, id: string, normalize: SnapshotNormalizer) => Record<string, unknown>>>;

/** And it is OPTIONAL — the two-argument call every adapter except Svelte makes. The two-parameter target is what makes optionality the claim rather than decoration: TypeScript compares a source's MINIMUM argument count against the target's parameter count, so a required third parameter fails this and an optional one passes. Measured both ways this session, because a predicate that would pass either way is worse than none. */
type _captureSnapshotNormalizerIsOptional = Expect<Assignable<typeof captureSnapshot, (bridge: ResultsBridge, id: string) => Record<string, unknown>>>;
