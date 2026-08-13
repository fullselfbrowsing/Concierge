# Phase 3: Action declaration and build-time validation - Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 17 (9 new, 8 modified — 2 of the modified are conditional)
**Analogs found:** 15 / 17 with a usable in-repo analog; **4 distinct patterns have NO analog and are genuinely new** (see *No Analog Found*)

> **Read this first.** This package has almost no runtime code. `src/` is three files: `types.ts`
> (1537 lines, all types + doc comments), `contract.ts` (166 lines, one const + one function), and
> `index.ts` (75 lines, a barrel). Verified by grep this session: **`src/` contains zero classes,
> zero type-predicate functions (`x is Y`), zero `Reflect.*` calls, and zero loops — no `for`, no
> `.map`, no `.filter`.** Phase 3 introduces all four. Treat `contract.ts` as the analog for *how a
> runtime module in this package is written* (header, imports, discipline, error shape) and
> `types.ts` as the analog for *how a value is declared and frozen* — but do not stretch either into
> an analog for iteration, aggregation, or narrowing. Those are new, and *No Analog Found* says so.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW** `packages/concierge/src/define-action.ts` | core module (type machinery + identity fn) | pass-through / compile-time transform | `packages/concierge/src/contract.ts` | role-match |
| **NEW** `packages/concierge/src/json-schema.ts` | core module (converter / adapter) | transform | `packages/concierge/src/contract.ts` + `src/types.ts:38-49` | partial |
| **NEW** `packages/concierge/src/catalog.ts` | core module (validation service) | batch (N declarations → 1 aggregated throw) | `packages/concierge/src/contract.ts` | role-match, content new |
| **NEW** `packages/concierge/src/diagnostics.ts` *(discretionary — may fold into `catalog.ts`)* | utility (host-capability seam) | event-driven sink | `packages/concierge/src/contract.ts:92-99, 145-152` | **exact** (mechanism) |
| **NEW** `packages/concierge/test-d/description-literal.test-d.ts` | test (type-level) | compile-time predicate | `packages/concierge/test-d/consent-variance.test-d.ts` | **exact** |
| **NEW** `packages/concierge/test-d/catalog.test-d.ts` | test (type-level) | compile-time predicate | `packages/concierge/test-d/actions.test-d.ts` | **exact** |
| **NEW** `packages/concierge/test/catalog.test.ts` | test (runtime, Vitest) | batch / request-response | `packages/concierge/test/single-instance.test.ts` | **exact** |
| **NEW** `packages/concierge/test/emission.test.ts` | test (runtime, Vitest) | transform | `packages/concierge/test/single-instance.test.ts` | role-match |
| **NEW** `packages/concierge/test/fixtures/schemas.ts` | test fixture | data | `packages/concierge/test/fixtures/probe.ts` + `test-d/actions.test-d.ts:92-109` | role-match |
| **MOD** `packages/concierge/src/index.ts` | barrel / config | re-export | itself (`:15-75`) | **exact (self)** |
| **MOD** `packages/concierge/test/export-surface.test.ts` | test (runtime) | file-I/O | itself (`:101-129`) | **exact (self)** |
| **MOD** `packages/concierge/test-d/exports.test-d.ts` | test (type-level) | compile-time predicate | itself (`:51-59`) | **exact (self)** |
| **MOD** `packages/concierge/test/single-instance.test.ts` | test (runtime) | file-I/O + dynamic import | itself (`:106-166`) | **exact (self)** |
| **MOD** `packages/concierge/test-d/actions.test-d.ts` | test (type-level) | compile-time predicate | itself (`:111-131`) | **exact (self)** |
| **MOD** `packages/concierge/test/artifact.test.ts` *(inferred — not in RESEARCH's test map; planner should confirm)* | test (runtime) | dynamic import | itself (`:68-79`) | **exact (self)** |
| **MOD** `packages/concierge/package.json` *(conditional — only if real validators adopted)* | config | n/a | itself (`:48-54`) | **exact (self)** |
| **MOD** `packages/concierge/src/types.ts` *(conditional — opportunistic, per CONTEXT `<specifics>`)* | type contract | n/a | itself | **exact (self)** |

---

## Pattern Assignments

### `packages/concierge/src/define-action.ts` (core module, pass-through)

**Analog:** `packages/concierge/src/contract.ts` — the only existing runtime module in this package.

**File-header convention** (`contract.ts:1-35`). Every source file in this package opens with a block
comment that states *the constraints whose violation is silent*, not what the file does. Copy the
shape, not the words:

```typescript
/**
 * Concierge contract identity — the single-instance guard (PKG-04).
 *
 * This is the first executable code in the package, and two constraints on it
 * are load-bearing enough that breaking either leaves a guard which reports
 * success while doing nothing at all.
 *
 * **1. Never call `assertSingleInstance` at module scope, and never move the
 * registry read out of its body.** ...
 *
 * **2. No top-level `await` in this file, ever.** A single one breaks
 * `require(esm)` for every CJS consumer on every supported Node line.
 *
 * Like `./types.ts`, this file has no runtime dependency, no framework import,
 * and no DOM access — it must construct on a server under Next App Router,
 * Nuxt, or SvelteKit without guards. It carries **zero imports**: the global
 * object is in `lib: ["ES2022"]`, and any import would enlarge the module graph
 * the PKG-05 probe measures.
 */
```

For `define-action.ts` the two constraints worth stating in this slot are named by RESEARCH:
(a) `D` must appear **only** in the `description` position (`types.ts:478-487` records the identical
defect being hit in Phase 1 with `Name`), and (b) the rejection branch must be an **inline template
literal type**, never a named alias — a named alias prints as its name and fails DX-03.

**Section-divider convention** (`contract.ts:37-39`, `101-103`) — used to split a file into two or
three named regions:

```typescript
// ---------------------------------------------------------------------------
// Contract identity
// ---------------------------------------------------------------------------
```

`types.ts` uses the identical rule at `:15-17`, `:51-53`, `:831-833`, `:855-857`, `:885-887`. Copy it.

**Import discipline.** `contract.ts` has **zero** imports (stated as a rule at `:30-34`). `types.ts`
has exactly one, type-only:

```typescript
// packages/concierge/src/types.ts:11
import type { StandardSchemaV1 } from "@standard-schema/spec";
```

`define-action.ts` needs `import type { ActionDefinition, StandardSchemaV1 } from "./types.js";` —
note the **`.js` extension on a `.ts` source path**, which is the house form everywhere
(`index.ts:66`, `:73`, `:75`; `test-d/*.ts` throughout). `verbatimModuleSyntax` is on, so a
type-only import must say `import type`.

**Conditional-type precedent** (`types.ts:19-20`) — the only conditional type in `src/`, and it is
single-branch:

```typescript
export type InferOutput<S> =
  S extends StandardSchemaV1<unknown, infer O> ? O : never;
```

The multi-branch `HoleProbe` / `IsNotConcrete` / `LiteralDescription` chain has **no `src/` analog**.
The nearest *repo* analog is `test-d/_assert.ts:33-34`, which is test-only and documents the
"do NOT simplify this" hazard in the exact register the planner should reuse:

```typescript
// test-d/_assert.ts:20-34 (abridged)
// Conditional-identity formulation. Do NOT "simplify" this to the naive bidirectional
// `A extends B ? (B extends A ? true : false) : false` — that form is distributive, so it
// returns `boolean` rather than a decision whenever an operand is a union or `any` ...
export type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;
```

`HoleProbe` needs precisely this treatment: the naive `string extends D` form is the one a reader
will "simplify" toward, and RESEARCH measured it open at its centre.

**`isolatedDeclarations` obligation.** `isolatedDeclarations: true` is on
(`tsconfig.base.json:15`). Every exported binding needs an explicit type or an inferable literal.
`defineAction` as a `function` declaration with an annotated return type satisfies this;
`export const defineAction = <…>(def) => def` would be TS9010.

---

### `packages/concierge/src/json-schema.ts` (core module, transform)

**Analog:** `packages/concierge/src/types.ts:38-49` for the *policy* — declare a third-party shape
structurally rather than importing it — plus `contract.ts` for module discipline.

**Structural stand-in pattern** (`types.ts:38-49`). This is the precedent RESEARCH *Pitfall 4* points
at when it says `StandardJSONSchemaV1` cannot be used directly:

```typescript
/**
 * Structural stand-in for the platform `AbortSignal`.
 *
 * Declared locally rather than pulling the `DOM` lib into core, which would
 * make `document` and `window` type-visible and erode the guarantee above. A
 * real `AbortSignal` is assignable to this.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
  addEventListener(type: "abort", listener: () => void): void;
  removeEventListener(type: "abort", listener: () => void): void;
}
```

`JsonSchemaConverter` / `JsonSchemaConverterOptions` / `JsonSchemaTarget` go in exactly this slot,
with a doc comment saying *why* the sibling type from `@standard-schema/spec` was not imported —
same shape as the paragraph above.

**Module-private narrowing over `unknown`** (`contract.ts:92-99` + `:146-147`). This is the closest
thing in the repo to `hasJsonSchemaConverter`, and it is the *cast* half only — there is no type
predicate anywhere in the package (see *No Analog Found*):

```typescript
/**
 * The global object, viewed as nothing but this one registry slot.
 *
 * Module-private, and deliberately minimal — widening it toward a real global
 * type would pull in the ambient declarations that `lib: ["ES2022"]` exists to
 * keep out of core.
 */
type Holder = Record<symbol, ContractRecord | undefined>;

// ... inside the function body:
const holder: Holder = globalThis as unknown as Holder;
const prior: ContractRecord | undefined = holder[REGISTRY_KEY];
```

Two conventions to carry over: (1) the narrow view type is **module-private, not exported**;
(2) every local gets an explicit annotation even where inference would do.

**The JSON Schema root contract is already declared and already names its owner** (`types.ts:22-36`).
`json-schema.ts` implements against this, it does not redeclare it:

```typescript
/**
 * JSON Schema handed to the agent.
 *
 * The root MUST be `type: "object"`. A discriminated union emits `{oneOf: []}`
 * with no root type; OpenAI Realtime then rejects the *entire* session update
 * and the agent silently loses every action in that stage, apologizing that it
 * cannot do that here. `buildCatalog` throws on violation, naming the action.
 */
export interface JsonSchemaObject {
  type: "object";
  properties?: Record<string, unknown>;
  required?: readonly string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}
```

**Constant-declaration form for `JSON_SCHEMA_TARGET`** — `types.ts:279` is the house precedent, and
its doc comment states the annotation rule the planner must decide against:

```typescript
/**
 * Deliberately unannotated: under `isolatedDeclarations` the literal type
 * `180` survives into the emitted `.d.ts`, so a consumer — and this package's
 * own type tests — can guard against a silent widening to `number` or a
 * changed bound. Annotating it `: number` would discard exactly that signal.
 */
export const MESSAGE_MAX_CHARS = 180;
```

RESEARCH's sketch writes `export const JSON_SCHEMA_TARGET: JsonSchemaTarget = "draft-2020-12";`,
which **discards the literal** — `JsonSchemaTarget` includes `(string & {})`. Under the house rule
above that is the form that loses something. Flag it; leaving it unannotated preserves
`"draft-2020-12"` in the `.d.ts` and lets a type test pin it.

---

### `packages/concierge/src/catalog.ts` (core module, batch)

**Analog:** `packages/concierge/src/contract.ts` — role-match on module discipline, on the
developer-facing throw, and on the "keep the check on a reachable code path" rule. The batch
iteration, the error class, and the recursive freeze have no analog.

**The reachable-code-path rule, verbatim** (`contract.ts:105-138`). This is the doc comment
`buildCatalog` must inherit, because `buildCatalog` is now the call site it describes:

```typescript
/**
 * Record this copy of core in the process-wide registry, and throw if a copy at
 * an incompatible contract version got there first.
 *
 * **Call this from the first reachable entry point** — `createConcierge`, and
 * each adapter's registration hook — and never at module scope. See constraint
 * 1 in this file's header: module scope does not survive `"sideEffects": false`,
 * so a registration hoisted out of this body is deleted from every bundled
 * consumer.
 * ...
 * The thrown message carries the two contract versions and the remediation and
 * nothing else — no file paths, no environment values, no user data. This is a
 * developer-time error rather than a dispatcher result, so the project's rule
 * that a crash is one generic sentence does not govern it; what does govern it
 * is that it must never become a channel for anything but its own two integers.
 *
 * There is no call site in this phase — `createConcierge` does not exist yet.
 * The call sites arrive with the runtime in later phases. ...
 */
```

Two things the planner must do here. First, the last paragraph (`contract.ts:140-143`) is **now
false** — Phase 3 supplies the call site. Update it in the same commit that adds
`assertSingleInstance()` to `buildCatalog`'s first line. Second, `contract.ts:135-138` is the stated
precedent that build-time errors are exempt from the one-generic-sentence rule; cite it in
`CatalogValidationError`'s doc comment rather than re-deriving it.

**The throw-with-remediation shape** (`contract.ts:158-165`) — the only `throw new Error` in `src/`,
and the model for every message `CatalogValidationError` assembles:

```typescript
  throw new Error(
    `concierge: two different copies of @fullselfbrowsing/concierge are loaded ` +
      `(contract v${prior.version} and v${CONTRACT_VERSION}). Adapters must ` +
      `resolve the same core instance — check that every ` +
      `@fullselfbrowsing/concierge-* package has core as a peerDependency and ` +
      `that your lockfile has exactly one entry for it. ` +
      `Run: pnpm why @fullselfbrowsing/concierge`,
  );
```

Conventions to copy exactly: the `concierge: ` prefix; template literals concatenated with `+`
across lines with a trailing space inside each segment; the *what* and the *fix* both present in one
string; a runnable command last where one exists. DX-03's "names the action and states the fix" is
this message's structure applied per-issue.

**Freeze idiom** (`types.ts:239-243`, `:261-265`, `:467-472`) — the *only* freeze precedent, and it
is shallow-on-a-flat-literal in all three cases:

```typescript
export const USER_CANCELLED: Readonly<{
  ok: false;
  reason: "cancelled";
  message: string;
}> = Object.freeze({ ok: false, reason: "cancelled", message: "Cancelled." });

export const CONSENT_GRADE_ORDER: readonly ConsentGrade[] = Object.freeze([
  "none",
  "delivered",
  "relayed",
  "attested",
]);
```

The `readonly ConsentGrade[]` + `Object.freeze([...])` pair is the exact shape `buildCatalog`'s
returned entries array should take at the type level. The **recursive walk is new** — see
*No Analog Found*.

`artifact.test.ts:62-63` states the reason the freeze is not optional, and is the sentence to reuse:

```typescript
// `Readonly<…>` is erased at emit. Only `Object.freeze` survives, and only
// the frozen form actually stops a consumer mutating a shared constant.
```

**Requirement-ownership doc comments already exist and must be honoured, not duplicated.** Three
places in `types.ts` name Phase 3 / `buildCatalog` as the enforcement owner. `catalog.ts` implements
against these:

| `types.ts` | Says |
|---|---|
| `:844` | "`buildCatalog` warns when `destructive: true` carries no `consent` policy." (CAT-05) |
| `:873-878` | "**Enforcement of the wider requirement lives in Phase 3, under SEC-01** — the declaration-time redaction rule, checked at `buildCatalog` … The owner is named here so a reader who finds nothing checking this at runtime concludes the requirement is *elsewhere* rather than unowned." |
| `:975-984` | "**Phase 1 ships this field and its type test, and nothing else reads it.** The build-time gate is **SEC-05, in Phase 3**: a predicate in CAT-05's exact shape … an unenforced safety marker sitting beside a redaction policy that genuinely fails closed is this project's named failure mode." |

Once Phase 3 lands, `:975-984`'s "nothing else reads it" and "Until that lands, setting this to
`true` changes no behaviour" become false. Same class of stale-prose defect CONTEXT `<specifics>`
already flags at `types.ts:505-506`. Fix in the same commit.

**Declaration order within a module** — `contract.ts` runs: header → section divider → exported const
→ module-private const → module-private interface → module-private type → section divider →
exported function. `catalog.ts` should follow the same public-first, private-adjacent ordering.

---

### `packages/concierge/src/diagnostics.ts` (utility, event-driven sink)

**Analog:** `packages/concierge/src/contract.ts:92-99` + `:145-152` — **exact** for the mechanism.

RESEARCH *Pitfall 6* prescribes a structural `globalThis` read because `console` is not type-visible
under `lib: ["ES2022"]`. That is not a new pattern; it is the second instance of one `contract.ts`
already established, and the excerpt above under `json-schema.ts` is the code to copy. The three
carried conventions:

1. A **module-private, minimal** view type (`type Holder = Record<symbol, ContractRecord | undefined>`
   → `interface ConsoleLike { warn: (...args: readonly unknown[]) => void }`).
2. The cast happens **inside a function body**, annotated, never at module scope.
3. A doc comment saying why the ambient type was not used — `contract.ts:95-98`: "widening it toward
   a real global type would pull in the ambient declarations that `lib: ["ES2022"]` exists to keep
   out of core."

**Optional-call form.** `contract.ts` branches explicitly (`if (prior === undefined)`) rather than
using optional chaining. RESEARCH's sketch uses `host.console?.warn(message)`. Both compile; the
planner should pick one and be consistent within the file.

**This is the second instance of the seam, and `.planning/STATE.md:98` records the first as
deferred:** "`Scheduler` is optional but there is **no `setTimeout` in scope to default to** — it is
TS2304 under `lib: ["ES2022"]`. Phase 6 must either reach a platform timer structurally or make the
seam required." If the planner names this pattern now (a `host.ts` or `diagnostics.ts` holding every
structural host reach), Phase 6 inherits it. If not, say so — the deferral is already written down
and should not silently acquire a second unnamed instance.

---

### `packages/concierge/test-d/description-literal.test-d.ts` (type-level test, predicate)

**Analog:** `packages/concierge/test-d/consent-variance.test-d.ts` — **exact**. A single-invariant
type-test file, whose guard is a *negative* predicate, and whose header explains why the negative is
the only form that can work. Read the whole 76-line file; it is the shortest complete template in the
repo.

**Assertion vocabulary** (`test-d/_assert.ts:16-38`) — the entire mechanism, four aliases:

```typescript
export {}; // makes this file's module status unconditional rather than dependent on what it declares

export type Expect<T extends true> = T;

export type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;

export type Assignable<From, To> = [From] extends [To] ? true : false;

export type Not<T extends boolean> = T extends true ? false : true;
```

**The `@ts-expect-error` house rule** (`_assert.ts:6-14`) — CONTEXT and RESEARCH both cite it; here
is the source text:

```typescript
// Predicates, not `@ts-expect-error`. A directive suppresses ANY error on the line that
// follows it — including an unrelated typo — so a directive written to prove that a bad
// value is rejected can pass green for the wrong reason, and TypeScript offers no way to
// scope a directive to an error code. `Expect<...>` fails with TS2344 and puts the alias
// name on the echoed source line, so a failure says which guarantee broke. Name every
// assertion after the invariant it guards; that name is the only carrier of meaning in
// these diagnostics.
//
// Reserve `@ts-expect-error` for object-literal freshness (excess properties), which
// predicates cannot model: `Assignable<{...; extra: 1}, T>` evaluates to `true`.
```

**The one-line rule** (`consent-variance.test-d.ts:53-57`, restated at `actions.test-d.ts:55-61`) —
non-negotiable and formatter-hostile:

```typescript
// This file declares nothing to the outside world. The import below already
// gives it module status, which is what keeps `isolatedDeclarations` from
// treating the alias as declaration-emitting (TS9010). The predicate is on ONE
// line however long — `tsc` echoes only the line the failing type argument sits
// on, so the alias name is the entire carrier of meaning. Do not let a formatter
// wrap it.
```

**Predicate shape** (`consent-variance.test-d.ts:64-76`) — imports, a local fixture, one
doc-commented predicate on one line:

```typescript
import type { Assignable, Expect, Not } from "./_assert.js";
import type { ConsentPolicy } from "../src/types.js";

interface Booking {
  readonly id: string;
}

/** Function-property syntax keeps `snapshotEquality`'s parameters contravariant. Method syntax would make them bivariant, and a comparator for the wrong snapshot type would satisfy the field. */
type _policyNotBivariant = Expect<Not<Assignable<ConsentPolicy<Booking>, ConsentPolicy<unknown>>>>;
```

Note `Booking` is **re-declared locally rather than imported** (`:59-62`): "a shared fixture would
couple two files whose blast radii are deliberately separate." RESEARCH's family-1/family-2 split for
CAT-07 is the same reasoning — carry it.

**Terse-output caveat to write into the header** — RESEARCH *Pitfall 10*, measured: a failing
`Expect<…>` prints only `Type 'false' does not satisfy the constraint 'true'` with **no alias name**
in non-TTY output. `consent-variance.test-d.ts:38-42` already states the TS2344 form. The CAT-07
*message* text, by contrast, does survive terse output verbatim — that asymmetry belongs in this
file's header because it decides how a mutant is asserted.

---

### `packages/concierge/test-d/catalog.test-d.ts` (type-level test, predicate)

**Analog:** `packages/concierge/test-d/actions.test-d.ts` — **exact**. This is the file that reads
*inferred* types off a declaration, which is exactly what the CAT-01 name-union predicate must do.

**The unannotated-const technique** (`actions.test-d.ts:182-202`) — the mechanism for reading an
inferred type, plus the reason it must not be annotated:

```typescript
/**
 * The declaration both guards below read. `name` is one literal and `consent.requires`
 * is a *different* one, which is the entire point: `Name` is inferred from `name` alone
 * and must not pick up the union of the two.
 *
 * Deliberately unannotated — see the TS9010 note in this file's header.
 */
const confirm = defineAction({
  name: "confirmBooking",
  description: "Confirm the booking.",
  schema,
  redact: "drop",
  handler: () => ({ ok: true, message: "Done." }),
  consent: { requires: "reviewBooking", bindTo: "userTurn", snapshotEquality: eq },
});

/** M10 detector 1: `Name` stayed the action's own name and did not absorb `requires`. */
type _nameNotWidened = Expect<Equals<(typeof confirm)["name"], "confirmBooking">>;
```

**The export-nothing rule and its measured justification** (`actions.test-d.ts:32-53`) — the single
most important header paragraph to carry into any new `test-d/` file:

```typescript
// **This file exports nothing, and that is a phase-wide rule, not a style preference.**
// The imports below already give it module status. `isolatedDeclarations` demands an
// explicit annotation on anything reaching the declaration surface, and
// `const confirm = defineAction({…})` is deliberately *un*annotated because its inferred
// type is the thing under test — annotating it would hand the test the answer it exists
// to derive. Non-exported locals are exempt from that demand. **The exemption ends the
// instant anything exported reads one** ... That asymmetry is precisely
// why the rule is "export nothing" rather than "annotate your exports": the diagnostic
// lands on the innocent line, so the first fix a developer reaches for is to annotate
// `confirm` — which silently disables `_nameNotWidened` and `_snapshotInferred`, since
// both exist only to read an inferred type.
```

**Fixture block convention** (`actions.test-d.ts:88-109`) — local, doc-commented, none exported:

```typescript
// --------------------------------------------------------------------------
// Fixtures — every one local, none exported
// --------------------------------------------------------------------------

/** A payload with a consequential field on it. Test fixture only. */
type Booking = { id: string; amount: number };

declare const schema: StandardSchemaV1<unknown, { q: string }>;
```

`declare const schema: StandardSchemaV1<…>` at `:109` is the zero-cost fixture form for a type-level
program — RESEARCH's "hand-roll for `test-d/`" recommendation is already the established practice
here.

**Naming convention for predicates:** `_lowerCamelInvariantName`, prefixed with `_`, doc-commented
with one sentence naming what breaks. See `:180`, `:199`, `:202`, `:225`, `:228`, `:242`, `:245`,
`:277`, `:280`, `:297`, `:323`, `:472`, `:475`, `:478`, `:518`, `:521`.

---

### `packages/concierge/test/catalog.test.ts` (runtime test, batch)

**Analog:** `packages/concierge/test/single-instance.test.ts` — **exact**. Behavioural runtime suite
with `describe`/`it`, throw assertions, and per-test state reset.

**Header convention: "What escapes without this file"** (`single-instance.test.ts:1-27`,
`artifact.test.ts:1-24`, `export-surface.test.ts:1-46`). Every runtime test file opens with this
exact heading and then names the defect that would ship silently:

```typescript
// PKG-04 — the duplicate-instance guard, asserted against the BUILT artifact.
//
// What escapes without this file:
//
// This package ships `"sideEffects": false`, which licenses a bundler to delete
// a module's evaluation outright. ...
```

**Imports** (`single-instance.test.ts:29-35`) — node builtins first, blank line, then third-party,
then vitest named imports in alphabetical order:

```typescript
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { rolldown } from "rolldown";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
```

**The dist-only import rule.** Every file in `test/` imports `../dist/index.js`, never `../src/`
(`single-instance.test.ts:14-20`, `artifact.test.ts:21-24`, `export-surface.test.ts:5-13`). The
reason is stated per-file. **`catalog.test.ts` must decide this explicitly and say why in its
header** — the existing three read `dist/` because their subject is the *artifact* (tree-shaking,
export placement). A behavioural test of `buildCatalog`'s validation rules has no such requirement,
and `vitest.config.ts:48-80` records that `test/` is in **no TypeScript program**, so a `src/` import
there is untypechecked either way. Whichever way it goes, the choice is a header paragraph, not an
accident. Note the sub-convention both files use: they mention `../src/` only inside comments and
say so explicitly, because an acceptance check greps non-comment lines.

**`beforeAll` dist-existence guard** (`single-instance.test.ts:59-66`) — copy verbatim if
`catalog.test.ts` reads `dist/`:

```typescript
beforeAll(() => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      `packages/concierge/dist/index.js is missing. These tests run against the ` +
        `BUILT artifact, not the source. Run \`pnpm build\` first.`,
    );
  }
});
```

**Per-test state reset with a doc comment on the mechanism** (`single-instance.test.ts:68-82`) —
directly relevant, because `buildCatalog` calls `assertSingleInstance()` and therefore *writes the
global registry on every test*:

```typescript
// `delete`, not assignment to `undefined`: `assertSingleInstance` branches on
// `prior === undefined`, and the property must also be genuinely absent for a
// `toEqual` against the whole record to be meaningful. ...
beforeEach(() => {
  delete registry[KEY];
});

afterEach(() => {
  for (const dir of scratchDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  scratchDirs = [];
});
```

The `Symbol.for` key is **hard-coded, not imported** (`:44-49`):

```typescript
// Hard-coded, not imported. The registry key is a cross-realm contract between
// two copies of this package that share no bindings, so its identity is the
// STRING and nothing else. Importing the symbol from the artifact under test
// would make this suite agree with whatever the artifact happens to say.
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");

type Registry = Record<symbol, { version: number } | undefined>;

const registry = globalThis as unknown as Registry;
```

**Test-title convention** (`single-instance.test.ts:106-107`, `:125`, `:154`) — `describe` states the
requirement ID plus the claim; each `it` is prefixed with its finding ID and states a full
proposition:

```typescript
describe("PKG-04 — one core instance across two independently-resolved copies", () => {
  it("F1a — two adapters resolving core independently converge on one registry record", async () => {
```

**Two-expectations-per-claim rule** (`single-instance.test.ts:154-166`) — this is the pattern DX-03
demands and the one the planner should apply to every `CatalogValidationError` assertion:

```typescript
  it("F2 — a contract-version mismatch throws a message naming both versions and the remediation", async () => {
    registry[KEY] = { version: 0 };
    const { assertSingleInstance } = await import(`${DIST_HREF}?mismatch=1`);

    // Two expectations, not one. That the mismatch is DETECTED and that the
    // message is ACTIONABLE are distinct claims, and a message that named the
    // versions but not the fix would satisfy the first while leaving the
    // developer with nothing to do.
    expect(() => assertSingleInstance()).toThrow(/two different copies/);
    expect(() => assertSingleInstance()).toThrow(/peerDependency/);
  });
```

DX-03's structural half ("`{action, fix}` as fields, not substrings") should be asserted on
`err.issues[i].action` / `.fix` **in addition to** — not instead of — the two `toThrow` regexes.

**Freeze assertion form** (`artifact.test.ts:59-66`), and the trap RESEARCH names:

```typescript
  it("the two abandonment results are frozen in the artifact, not merely typed readonly", async () => {
    const m = await import(DIST_URL.href);

    // `Readonly<…>` is erased at emit. Only `Object.freeze` survives, and only
    // the frozen form actually stops a consumer mutating a shared constant.
    expect(Object.isFrozen(m.USER_CANCELLED)).toBe(true);
    expect(Object.isFrozen(m.USER_DECLINED)).toBe(true);
  });
```

RESEARCH *Pitfall 7* warns that `Object.isFrozen(catalog)` alone passes on the breached shallow
form. The SEC-03 test must assert the **tamper attempt fails**, not just that the array is frozen —
`expect(() => { catalog[0].handler = attacker; }).toThrow()` plus
`expect(catalog[0].handler).toBe(original)`, since the assignment is silent in some modes.

---

### `packages/concierge/test/emission.test.ts` (runtime test, transform)

**Analog:** `packages/concierge/test/single-instance.test.ts` (role-match). All conventions above
apply. Two additions specific to this file:

**Table-in-a-comment for measured vendor behaviour.** `test/fixtures.test.ts:16-33` is the house form
for recording a measured matrix inside a test file, and RESEARCH produced two such matrices
(*Pitfall 3* schema roots, *Pitfall 5* target support) that belong here rather than only in
RESEARCH.md:

```typescript
// ---------------------------------------------------------------------------
// The peer range is weaker than CONTEXT.md assumes — measured
// ---------------------------------------------------------------------------
//
//   | Installer                        | Behaviour                                   | Exit     |
//   |----------------------------------|---------------------------------------------|----------|
//   | `npm install` (default)          | hard `ERESOLVE`                             | non-zero |
//   | `pnpm add` (default)             | prints `✕ unmet peer …` and installs anyway | 0        |
//   | `npm install --legacy-peer-deps` | silent                                      | 0        |
```

**Recording a guard that is deliberately absent.** `export-surface.test.ts:31-46` (Trap 2) is the
precedent for writing down a non-assertion so it is not mistaken for missing coverage — directly
applicable if the planner declines the real-validator devDependencies and therefore cannot reproduce
`z.discriminatedUnion`:

```typescript
// `ReadbackAttestation` has ZERO occurrences in `types.ts`. ... A guard asserting that it is not
// exported therefore passes vacuously, forever, no matter what the artifact contains —
// and it reads in a diff and in a test report exactly like coverage.
// `02-VALIDATION.md` names this explicitly: it must not be counted as a passing check.
//
// So it is written down here instead of being written as an assertion.
```

---

### `packages/concierge/test/fixtures/schemas.ts` (test fixture, data)

**Analog:** `packages/concierge/test/fixtures/probe.ts` (role-match) — the only file in
`test/fixtures/` and the only precedent for a fixture module.

**Header states which program compiles it** (`probe.ts:1-34`). This matters because
`vitest.config.ts:72-75` records that `test/fixtures/` is deliberately outside this repo's TS
program:

```typescript
/**
 * packages/concierge/test/fixtures/probe.ts — PKG-02, the consumer-side type probe.
 *
 * This file is never compiled by this repository. `scripts/pack-install-check.sh`
 * copies it into a `mktemp -d` scratch project outside the repo, where it is
 * compiled by that project's own `typescript@7.0.2` against the **shipped**
 * `dist/index.d.ts` from a real packed tarball, with `skipLibCheck: false`.
 *
 * Two consequences follow, and both are the reason this file looks unlike
 * anything in `test-d/`:
 * ...
 */
```

`schemas.ts` is different — it *is* imported by Vitest at runtime and is in no TS program at all
(`vitest.config.ts:52-58`). Its header should say that plainly, because it means a type error in it
surfaces only as a runtime failure.

**Fixture shape.** RESEARCH's dependency-free `StandardSchemaV1` fixture is the content; the existing
`declare const schema: StandardSchemaV1<unknown, { q: string }>` at `actions.test-d.ts:109` is the
type-level counterpart. A runtime fixture needs the real object literal RESEARCH gives.

**Note there are also `.json` fixtures** (`test/fixtures/adapter-alpha/package.json`,
`adapter-beta/package.json`) — so `test/fixtures/` already holds non-`.ts` payloads; adding a `.ts`
module there is consistent with the directory's existing use.

---

### `packages/concierge/src/index.ts` (barrel, re-export) — MODIFIED

**Analog:** itself. The file is 75 lines and the whole structure is the pattern.

**Two-block structure with category comments** (`:15-75`):

```typescript
export type {
  // Schema interop
  StandardSchemaV1,
  InferOutput,
  JsonSchemaObject,
  AbortSignalLike,
  // Results
  ActionResult,
  ...
  // Actions
  ActionDefinition,
  AnyActionDefinition,
  ...
} from "./types.js";

export {
  USER_CANCELLED,
  USER_DECLINED,
  CONSENT_GRADE_ORDER,
  MESSAGE_MAX_CHARS,
} from "./types.js";

export { CONTRACT_VERSION, assertSingleInstance } from "./contract.js";
```

Conventions: `export type { … }` block first, grouped by `// Category` comments matching `types.ts`'s
section dividers; value block second; **one value-export statement per source module**, so
`define-action.ts`, `json-schema.ts` and `catalog.ts` each get their own line. New *type* exports
from the new modules cannot join the `from "./types.js"` block — they need their own
`export type { … } from "./catalog.js";` statements.

**The one-directional hazard** — `test-d/exports.test-d.ts:9-18` measures it, and it governs every
new value export:

```typescript
// `verbatimModuleSyntax` enforcement is **one-directional**. A *type* written
// into the value-export block of `../src/index.ts` is TS1205 and nobody can
// miss it. A *value* moved the other way — out of the value block and into the
// `export type { … }` block — is silently legal in both directions that matter:
// `tsc -p tsconfig.test-d.json` exits **0**, the emit build exits **0**, and
// `dist/index.js` quietly loses the runtime binding.
```

Every value Phase 3 adds (`defineAction`, `buildCatalog`, `CatalogValidationError`, and any
constant) therefore needs **both** an `exports.test-d.ts` predicate and an `artifact.test.ts` case —
the two guards catch the same defect at different sampling rates (`artifact.test.ts:14-19`).

**Module doc comment is stale on landing** (`index.ts:1-13`):

```typescript
 * Pre-alpha: this package exports the design contract, plus the single-instance
 * contract guard (`CONTRACT_VERSION`, `assertSingleInstance`) ... The rest of the runtime
 * (`createConcierge`, `createSession`, `defineAction`, `defineStage`,
 * `createBridge`) is still being implemented against these types
```

`defineAction` moves out of that "still being implemented" list this phase. Update in the same commit.

---

### `packages/concierge/test/export-surface.test.ts` (runtime test, file-I/O) — MODIFIED

**Analog:** itself. Three things move together and the count appears in **four** places.

**Pinned counts** (`:119-129`) — note the numbers are in the `it` **titles** as well as the
assertions, so a stale title lies in the test report:

```typescript
describe("the published export surface of dist/index.d.ts", () => {
  it("is exactly 45 names — an export added or dropped by a build-config change lands here", () => {
    const { names } = readSurface();
    expect(names).toHaveLength(45);
  });

  it("splits 39 types to 6 values", () => {
    const { types, values } = readSurface();
    expect(types).toHaveLength(39);
    expect(values).toHaveLength(6);
  });
```

**The name list** (`:101-108`) must grow alongside the counts:

```typescript
const VALUE_EXPORTS = [
  "USER_CANCELLED",
  "USER_DECLINED",
  "CONSENT_GRADE_ORDER",
  "MESSAGE_MAX_CHARS",
  "CONTRACT_VERSION",
  "assertSingleInstance",
];
```

**Do not touch the parser** (`:74-99`). `readSurface` throws with a diagnostic that tells the reader
which thing changed — the parser or the surface — and that message is the guard against "fixing" a
red count by weakening the regex:

```typescript
  if (blocks.length === 0) {
    throw new Error(
      `no trailing \`export { … };\` statement found in dist/index.d.ts — ` +
        `the parser, not the surface, is what changed. Inspect the artifact ` +
        `before adjusting the expected count.`,
    );
  }
```

**Ordering obligation.** This file and `artifact.test.ts` and `single-instance.test.ts` all read
`packages/concierge/dist/`. They go red until `pnpm build` re-runs after new exports land, so every
plan touching exports must run `pnpm build` before `pnpm test`. Root scripts
(`package.json:19-27`): `build` = `pnpm -r build`, `test` = `vitest run`, `typecheck` = `pnpm -r typecheck`.

---

### `packages/concierge/test-d/exports.test-d.ts` (type-level test, predicate) — MODIFIED

**Analog:** itself (`:51-59`). The whole file is one import plus one predicate, and the import target
is the assertion:

```typescript
import type { Equals, Expect } from "./_assert.js";
import { MESSAGE_MAX_CHARS } from "../src/index.js";   // ← index.js. NOT types.js. This is the whole point.

/** MESSAGE_MAX_CHARS reaches the public entrypoint as a VALUE, not only as a type. */
type _messageBoundExportedAsValue = Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>;
```

Copy the pattern per new value export. Note `:32-42` — the diagnostic for this guard is **TS1485 at
the import line**, not TS2344 at the predicate, and that asymmetry is documented so a reader does not
look at the wrong line. Any new value pin inherits the same behaviour and the header should say so.

---

### `packages/concierge/test/single-instance.test.ts` (runtime test) — MODIFIED

**Analog:** itself. RESEARCH's test map requires a new case proving `buildCatalog` calls
`assertSingleInstance` (mutant M-03-8). Copy the `it` shape from `:154-166` and the reset from
`:68-75`.

**Header paragraph that must change** (`:1-27`). It currently describes a guard with no production
call site. Phase 3 supplies one, so the "what escapes" framing extends: a `buildCatalog` that stops
calling the guard is invisible to F1a/F1b/F2, all three of which call `assertSingleInstance`
directly.

**Testing the call happened.** There is no spy/mock precedent anywhere in this repo — no `vi.fn`, no
`vi.spyOn` in any existing test. The observable in the existing suite is the **global registry
record** (`:53`, `:122`):

```typescript
const registry = globalThis as unknown as Registry;
...
expect(registry[KEY]).toEqual({ version: alpha.CONTRACT_VERSION });
```

Asserting `buildCatalog([])` populates `registry[KEY]` after a `delete registry[KEY]` reuses the
established observable and needs no new tooling. Prefer it over introducing mocking.

---

### `packages/concierge/test-d/actions.test-d.ts` (type-level test) — MODIFIED

**Analog:** itself. **This file contains the placeholder Phase 3 replaces.** `:111-131`:

```typescript
/**
 * Stand-in for the real `defineAction`, which **Phase 3 owns**. A `declare function`
 * with no runtime body, never exported, existing for one reason: the assertions below
 * must read an *inferred* `ActionDefinition`. An explicitly annotated one would supply
 * the very answer — `Name`, `Snapshot` — that the test is supposed to derive, and would
 * pass just as happily over a broken declaration chain.
 *
 * The third parameter is `B`, not `Bridge`, and the spelling is deliberate ...
 */
declare function defineAction<
  Name extends string,
  Schema extends StandardSchemaV1,
  B = unknown,
  Snapshot = unknown,
  AckPayload = unknown,
>(
  def: ActionDefinition<Name, Schema, B, Snapshot, AckPayload>,
): ActionDefinition<Name, Schema, B, Snapshot, AckPayload>;
```

**Three concrete consequences for the planner:**

1. **Positional collision.** The stand-in is `<Name, Schema, B, Snapshot, AckPayload>`; RESEARCH's
   real signature is `<N, D, S, B, Snap, Ack>` with `D` (description) inserted at **position 2**.
   All three call sites in this file (`:189`, `:342`, `:368`) rely on pure inference with no explicit
   type arguments, so they survive the swap — but RESEARCH's family-2 assertion
   `Parameters<typeof defineAction<N, D, typeof filterSchema>>[0]["description"]` depends on `D`
   being at position 2 specifically. Pin the parameter order deliberately.
2. **All three call sites already pass CAT-07.** Their descriptions are
   `"Confirm the booking."` (`:191`), `"Cancel the shipment before it leaves the warehouse."`
   (`:345`), `"Sign the user out."` (`:371`) — all inline literals. Swapping in the real guard should
   not turn this file red. If it does, the guard is over-rejecting.
3. **Two stale prose claims live here**, and CONTEXT `<specifics>` says fix them if the file is
   touched: `:152` ("a lone TS2578 is then the *only* symptom") and `:155-157`, plus the paired claim
   at `types.ts:505-506`. Both became false when `consent-variance.test-d.ts` added a second named
   detector — which that file's own header says at `:44-50`. Replacement wording is in
   `02-11-SUMMARY.md`.

**Directive count is asserted by prose** (`:63-66`): "Exactly two suppression directives appear below
and no more — a count a grep for the token can confirm". If Phase 3 adds a third, that paragraph must
change with it.

**SEC-01's type half** goes here per RESEARCH's test map — a predicate that `redact` is non-optional.
Model it on `:323`:

```typescript
/** The field exists on the declaration itself, optional and boolean. */
type _readsUntrustedOnDefinition = Expect<Equals<ActionDefinition["readsUntrusted"], boolean | undefined>>;
```

---

### `packages/concierge/test/artifact.test.ts` (runtime test) — MODIFIED *(inferred)*

**Analog:** itself (`:68-79`). Not listed in RESEARCH's test map, but the established convention is
that **every value export gets an artifact-level case**, and `index.ts`'s two Phase 2 values both
have one:

```typescript
  it("CONTRACT_VERSION reaches dist/index.js as the integer 1", async () => {
    const m = await import(DIST_URL.href);
    expect(m.CONTRACT_VERSION).toBe(1);
  });

  it("assertSingleInstance reaches dist/index.js as a callable function", async () => {
    const m = await import(DIST_URL.href);

    // A guard exported as `undefined` is the failure mode PKG-04 cannot
    // tolerate: every call site would be a silent no-op rather than an error.
    expect(typeof m.assertSingleInstance).toBe("function");
  });
```

Planner decision: add cases for `defineAction`, `buildCatalog`, `CatalogValidationError` — or record
in the file why not (per the `export-surface.test.ts:31-46` "written down instead of asserted"
precedent).

---

### `packages/concierge/package.json` (config) — MODIFIED *(conditional)*

**Analog:** itself (`:45-54`):

```json
  "engines": {
    "node": ">=22.12.0"
  },
  "dependencies": {
    "@standard-schema/spec": "^1.0.0"
  },
  "scripts": {
    "build": "tsdown",
    "typecheck": "tsc -p tsconfig.test-d.json"
  }
```

There is **no `devDependencies` key today** — adding `zod`/`arktype`/`valibot` creates it. Root
`package.json:29-37` shows the house form: **exact pins, no carets** (`"typescript": "7.0.2"`,
`"vitest": "4.1.10"`). RESEARCH's install command uses exact versions, which matches.

`sideEffects: false` (`:26`) is the constraint behind the whole reachable-call-site rule. Do not
touch it. `tsdown.config.ts:16` has a single entry (`entry: ["src/index.ts"]`), so **new `src/` files
need no build-config change** — they are bundled through the barrel.

---

### `packages/concierge/src/types.ts` (type contract) — MODIFIED *(conditional, opportunistic)*

Only if the phase touches it at all. Two batches, both from CONTEXT `<specifics>`:

1. **Three false prose claims** at `:505-506` (plus `test-d/actions.test-d.ts:147`, `:153-155`) —
   `types.ts` ships inside `dist/index.d.ts`, so consumers read them. Wording in `02-11-SUMMARY.md`.
2. **Three `Object.freeze` calls needing `/* @__PURE__ */`** — verified this session: **zero
   `__PURE__` annotations exist in `src/` today**. The three sites are `:243`, `:265`, `:467`.
   Measured cost of omission: ~205 B retained in every consumer bundle, because
   `assertSingleInstance` now keeps the module alive.

Plus the two staleness items this phase creates: `:975-984` ("nothing else reads it" — SEC-05 now
does) and `contract.ts:140-143` ("There is no call site in this phase" — now there is).

**CONTEXT is explicit that a `types.ts` change is otherwise a deviation, not a task.** RESEARCH
*Open Question 1* recommends guarding on `defineAction` only, which requires **no** amendment.

---

## Shared Patterns

### Doc comments carry the *why*, and specifically the measured why

**Source:** every file in the package, but canonically `contract.ts:1-35` and `types.ts:993-1021`
**Apply to:** all new `src/` files, all new test files

This repo's density of explanatory comment is far above normal and it is deliberate: comments record
what was *measured*, what the wrong-looking-right alternative is, and what breaks silently. Examples
of the register:

```typescript
// types.ts:997-1011
 * **The `any` in the `Snapshot` and `AckPayload` positions is deliberate and
 * load-bearing rather than laziness.** Threading `Snapshot` puts it in two
 * contravariant positions ... so `ActionDefinition<…, Booking, …>` is simply *not* assignable to
 * `ActionDefinition<…, unknown, unknown>` (TS2375, verified).
```

```typescript
// contract.ts:16-18
 * still present under `node dist/index.js`, so it tests green in Node while
 * being absent from every React or Svelte app ... Hoisting this code to module scope looks like a
 * simplification. It is the single edit that silently disarms PKG-04.
```

RESEARCH produced a large body of measured findings (the 25-case CAT-07 matrix, the `${number}` gap,
the vendor target table, the shallow-freeze breach). **Those belong in doc comments in the source,
not only in `03-RESEARCH.md`** — that is what every prior phase did, and it is why a reader of
`contract.ts` does not re-derive the tree-shaking finding.

### Error messages: `concierge: ` prefix, what + fix, runnable command last

**Source:** `packages/concierge/src/contract.ts:158-165`
**Apply to:** `CatalogValidationError`, every `CatalogIssue.fix`, every `CatalogDiagnostic`

See the excerpt under `src/catalog.ts` above. The test-side mirror
(`export-surface.test.ts:79-84`, `:112-116`; `single-instance.test.ts:61-65`;
`artifact.test.ts:36-40`) uses the same shape for guard failures — a sentence naming what is missing
and the command that fixes it.

### Structural `globalThis` reach for host capabilities

**Source:** `packages/concierge/src/contract.ts:92-99` + `:145-152`
**Apply to:** the diagnostics console sink (CAT-05 / SEC-05 default warning)

Excerpt under `src/json-schema.ts` above. This is the **only** sanctioned way to reach a host global
from core, and `.planning/STATE.md:98` records a second pending instance (`setTimeout`, Phase 6).

### Type-level assertions are predicates, never `@ts-expect-error`

**Source:** `packages/concierge/test-d/_assert.ts:1-38`
**Apply to:** `description-literal.test-d.ts`, `catalog.test-d.ts`, `exports.test-d.ts`,
`actions.test-d.ts`

Excerpt under `test-d/description-literal.test-d.ts` above. `@ts-expect-error` is reserved for
object-literal freshness; every other invariant is `Expect<…>`, on one line, named after the
invariant.

### Every guard's file header names what escapes without it

**Source:** `test/single-instance.test.ts:1-27`, `test/artifact.test.ts:1-24`,
`test/export-surface.test.ts:1-46`, `test/fixtures.test.ts:1-15`, `test-d/exports.test-d.ts:7-18`,
`test-d/consent-variance.test-d.ts:8-50`
**Apply to:** all new test files

Literal heading text in the runtime suite is `What escapes without this file:`. The type-level suite
uses `WHAT ESCAPES WITHOUT THIS FILE` in caps. Both are established; match the directory.

### Mutation proofs

**Source:** `scripts/mutate-and-prove.sh:16-42`
**Apply to:** each of RESEARCH's ten mutants (M-03-1 … M-03-10)

```bash
# Usage:
#   scripts/mutate-and-prove.sh <target-file> <literal-pattern> <replacement> -- <gate command...>
#
# Exit codes — each is meaningful, and this table is a published contract ...
#   0  PASS  — the gate exited non-zero (the mutant was caught) and the tree is clean
#   1  FAIL  — the gate exited 0 (the mutant escaped)
#   2  ABORT — the target is unusable: not tracked, already dirty, or not supplied
#   3  ABORT — the substitution was a no-op (the pattern never matched)
#   4  ABORT — the target file was not restored
```

Two known defects the planner must route around, both documented in RESEARCH:

- **Line 32 is stale.** It reads "tsc exits 2 on diagnostics"; TypeScript 7.0.2 exits **1**. Every
  Phase 3 mutant expectation must say `exit 1`. (Every Phase 2 *measurement* already recorded 1 —
  the prose is stale, not the practice.)
- **Lockfile hazard.** The `trap` at line 89 restores only `$TARGET`, so a gate that triggers a pnpm
  install leaves `pnpm-lock.yaml` dirty while the script prints "tree clean" (line 129). Preventive
  remedy: `pnpm --config.verify-deps-before-run=false <gate>`. `CI=true` / `--frozen-lockfile` is
  **actively wrong** — it produces a vacuously-green PASS.

The literal-pattern matching (line 99-103, `\Q…\E`, no `/g`) means each mutant needs a pattern that
occurs **exactly once** in the target. RESEARCH's M-03-5 (`.input(` → `.output(`) is safe only if
`.input(` appears once in `json-schema.ts`.

### Command forms

**Source:** `03-RESEARCH.md` *Pitfall 8* (sixth reproduction), `vitest.config.ts:82-94`
**Apply to:** every plan step, verification block, and CI line

| Intent | Correct | Wrong |
|---|---|---|
| Run one suite | `pnpm test catalog` | `pnpm test -- catalog` (runs the **whole** suite) |
| Full gate | `pnpm build && pnpm typecheck && pnpm test` | `pnpm test` alone (dist-reading suites go red) |
| Type-level suite | `pnpm typecheck` → `tsc -p tsconfig.test-d.json` | Vitest typecheck mode (`vitest.config.ts:19-24` records it exits 1) |

---

## No Analog Found

These patterns have **nothing** to copy from in this repository. Verified by grep across
`packages/concierge/src`, `test`, and `test-d` this session. The planner should use RESEARCH.md's
measured prototypes directly and treat these as new-pattern-establishing work.

| Pattern | Needed by | Role | Data Flow | Evidence of absence |
|---|---|---|---|---|
| **A class, of any kind** — `CatalogValidationError extends Error` | DX-03 | error type | aggregation | `grep -rn 'class \|extends Error'` over `src/`, `test/`, `test-d/` → **0 matches**. Every error in the package is `new Error(...)` at `contract.ts:158` and four `beforeAll` guards. |
| **A user-defined type predicate** — `function hasJsonSchemaConverter(s): s is …` | CAT-06 | narrowing utility | transform | `grep -rn '): [a-zA-Z]* is '` → **0 matches**. The only narrowing in `src/` is the double cast at `contract.ts:146` and the `=== undefined` branch at `:149`. |
| **A recursive object walk / `Reflect.*`** — `deepFreeze` | SEC-03 | immutability utility | traversal | `grep -rn 'Reflect\.'` → **0 matches**. All three `Object.freeze` calls (`types.ts:243`, `:265`, `:467`) are shallow, on flat literals, at declaration sites. **The idiom exists; the recursion does not.** |
| **Iteration of any kind in `src/`** — the per-action rule loop | CAT-01/02/05/06, SEC-01/05 | control flow | batch | `grep -rn 'for (\|\.map(\|\.filter('` over `src/` → **0 matches**. `src/` has no loops at all. Phase 3's rule table is the package's first iteration. |
| **A callback/hook seam that core invokes** — `onDiagnostic` | CAT-05, SEC-05 | injection seam | event-driven | The *types* exist (`ConciergeConfig.presentReadback`/`digest`/`scheduler`, `types.ts:1363+`) but nothing in `src/` ever calls one. The `globalThis` default sink has an exact mechanism analog; the hook-with-default does not. |
| **A `const` type parameter** — `buildCatalog<const A extends …>` | CAT-01 | type machinery | compile-time | `grep` over `src/` and `test-d/` → **0 matches** for `<const `. New. |
| **A multi-branch conditional type predicate** — `HoleProbe`/`IsNotConcrete` | CAT-07 | type machinery | compile-time | `src/` has exactly one conditional type, single-branch (`types.ts:19-20`). The repo's only multi-step conditional types are `_assert.ts:33-38`, which are test-only helpers. |
| **Any mocking/spying in tests** — proving `buildCatalog` called `assertSingleInstance` | PKG-04 SC-5 | test technique | — | `grep -rn 'vi\.'` over `test/` → **0 matches**. **Recommended substitute:** assert on the global registry record, exactly as `single-instance.test.ts:122` does. Do not introduce `vi.spyOn` when an existing observable works. |

**Also genuinely new, though lower-risk:** a runtime `devDependencies` block in
`packages/concierge/package.json` (the key does not exist today), and a `.ts` module under
`test/fixtures/` that this repo's Vitest actually imports (`probe.ts` is compiled by a foreign
program and never imported here).

---

## Metadata

**Analog search scope:** `packages/concierge/src/`, `packages/concierge/test/`,
`packages/concierge/test-d/`, `packages/concierge/test/fixtures/`, `scripts/`, repo-root configs
(`package.json`, `tsconfig.base.json`, `vitest.config.ts`, `packages/concierge/tsdown.config.ts`,
`packages/concierge/tsconfig.json`, `packages/concierge/tsconfig.test-d.json`,
`packages/concierge/package.json`)

**Files scanned:** 14 TypeScript sources + 7 configs + 1 shell script (the package's entire
non-generated TypeScript surface — 3943 lines across `src/`, `test/`, `test-d/`)

**Files read in full:** `src/contract.ts`, `src/index.ts`, `test-d/_assert.ts`,
`test-d/actions.test-d.ts`, `test-d/consent-variance.test-d.ts`, `test-d/exports.test-d.ts`,
`test/single-instance.test.ts`, `test/artifact.test.ts`, `test/export-surface.test.ts`,
`test/fixtures/probe.ts`, `scripts/mutate-and-prove.sh`, `vitest.config.ts`, `tsdown.config.ts`,
all tsconfigs, both `package.json`s

**Files read in targeted ranges (non-overlapping):** `src/types.ts` — `:1-60` (header, schema
interop, `JsonSchemaObject`, `AbortSignalLike`), `:225-284` (frozen constants, `MESSAGE_MAX_CHARS`),
`:455-480` (`CONSENT_GRADE_ORDER`), `:830-1069` (`SideEffects`, `RedactionPolicy`,
`ActionDefinition`, `AnyActionDefinition`, `Bridge`). Structural map via grep for all 47 top-level
declarations.

**Absence claims verified by grep, not assumed:** classes, `extends Error`, type predicates,
`Reflect.*`, `for (`, `.map(`, `.filter(`, `vi.`, `<const `, `__PURE__`, `globalThis`,
`Object.freeze`, `throw new`.

**Project skills:** none — `.claude/skills/` and `.agents/skills/` do not exist (matches CLAUDE.md).

**Pattern extraction date:** 2026-07-29
