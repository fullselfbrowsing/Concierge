# Phase 2: Packaging, build, and release - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 25 (17 created, 8 modified)
**Analogs found:** 12 / 25 (6 exact, 6 partial) — **13 have no analog**

## Read this first — the honest shape of this phase

This is an infrastructure phase in a repo that contains **exactly 12 tracked source/config
files** outside `.planning/`. Over half the files this phase creates have no analog because
the thing they belong to does not exist yet:

| Directory | Status `[VERIFIED — ls / git ls-files]` |
|---|---|
| `scripts/` | **Does not exist anywhere in the repo** |
| `.github/` | **Does not exist anywhere in the repo** |
| `.changeset/` | **Does not exist** |
| `packages/concierge/test/` | **Does not exist** — no runtime test has ever been written |
| `.npmrc` (root or package) | **Does not exist** |
| `packages/concierge/LICENSE` | **Does not exist** — but is listed in `files` (the research's LICENSE defect) |

Where an analog genuinely exists it is **strong** — Phase 1 left an unusually opinionated,
heavily-commented house style that a new file must match or it will look like it was written
by someone who did not read the repo. Where no analog exists, this document says so and states
what convention the phase is *establishing* instead. **No unrelated file is pointed at and
called an analog.**

`test-d/` contains **5 files**: `_assert.ts` plus four `*.test-d.ts` (`actions`, `consent`,
`results`, `transport`) — 939 lines total. (The "5 `*.test-d.ts` files" phrasing in
`02-VALIDATION.md` counts `_assert.ts`; there are four assertion files.)

---

## File Classification

### Created

| New file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `packages/concierge/test-d/exports.test-d.ts` | type-test | compile-time assertion | `packages/concierge/test-d/results.test-d.ts` | **exact** |
| M9 `_policyNotBivariant` (in `test-d/actions.test-d.ts` **or** new `test-d/consent-variance.test-d.ts`) | type-test | compile-time assertion | `test-d/transport.test-d.ts:59-66` (`_provenanceNotBoolean`) | **exact** |
| `packages/concierge/LICENSE` | legal asset | file copy | `/LICENSE` (root, MIT, 1075 B) | **exact** (byte copy) |
| `packages/concierge/src/contract.ts` | runtime module (**first in the package**) | pure function + module-scope constant | `packages/concierge/src/types.ts` (header + constant style only) | **partial** |
| `packages/concierge/test/fixtures/probe.ts` | test fixture (consumer-side type probe) | compile-time assertion, *foreign program* | `test-d/results.test-d.ts:103-108` (the "literal survived" idiom) | **partial** |
| `packages/concierge/test/fixtures/adapter-alpha/package.json` | fixture manifest | — | `packages/concierge/package.json` | **partial** |
| `packages/concierge/test/fixtures/adapter-beta/package.json` | fixture manifest | — | same | **partial** |
| `packages/concierge/tsdown.config.ts` | build config | — | **none** | **none** |
| `vitest.config.ts` (root) | test config | — | **none** | **none** |
| `.changeset/config.json` | release config | — | **none** | **none** |
| `packages/concierge/test/single-instance.test.ts` | runtime test | dynamic import / global registry | **none** | **none** |
| `packages/concierge/test/artifact.test.ts` | runtime test | file/artifact introspection | **none** | **none** |
| `scripts/pkg05-zero-runtime-deps.mjs` | script (node) | batch → exit code | **none** | **none** |
| `scripts/pack-install-check.sh` | script (bash) | subprocess orchestration | **none** | **none** |
| `scripts/node-floor-check.sh` | script (bash) | download + subprocess | **none** | **none** |
| `scripts/mutate-and-prove.sh` | script (bash) | mutate → gate → restore | **none** | **none** |
| `.github/workflows/ci.yml` | CI config | — | **none** | **none** |
| `.github/workflows/release.yml` | CI config | — | **none** | **none** |

### Modified

| Modified file | Role | Change | Closest analog | Match |
|---|---|---|---|---|
| `packages/concierge/src/index.ts` | barrel | add `CONTRACT_VERSION`, `assertSingleInstance` | **itself**, lines 65-70 | **exact (self)** |
| `packages/concierge/package.json` | manifest | add `build` + `test` scripts | **itself**, lines 50-52 | **exact (self)** |
| `package.json` (root) | manifest | TS 7.0.2, pnpm 11, new devDeps, `check:*` scripts | **itself**, lines 15-26 | **exact (self)** |
| `pnpm-workspace.yaml` | workspace config | add `catalog:` | **itself** (3 lines, no `catalog` key today) | **exact (self)** |
| `.gitignore` | config | see the gitignore audit below | **itself** | **exact (self)** |
| `CONTRIBUTING.md` **or** new `packages/README.md` | docs | build-toolchain constraint | `CONTRIBUTING.md:18-27` ("Non-negotiables") | **role-match** |
| `pnpm-lock.yaml` | generated | never hand-edited | n/a | n/a |
| `packages/concierge/tsconfig.json` | compiler config | *possibly* untouched — see sourcemap decision | **itself** | **exact (self)** |

---

## Pattern Assignments

### 1. `test-d/exports.test-d.ts` (type-test, compile-time assertion) — **strongest analog in the phase**

**Analog:** `packages/concierge/test-d/results.test-d.ts` (108 lines — read it whole before writing).
**Assertion vocabulary:** `packages/concierge/test-d/_assert.ts` (38 lines).

**The assertion primitives** — `test-d/_assert.ts:16-38`. There are exactly four, and they are
the *entire* vocabulary. Do not invent a fifth:

```typescript
export {}; // makes this file's module status unconditional rather than dependent on what it declares

export type Expect<T extends true> = T;

export type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;

export type Assignable<From, To> = [From] extends [To] ? true : false;

export type Not<T extends boolean> = T extends true ? false : true;
```

**Import pattern** — `test-d/results.test-d.ts:19-21`. Note three conventions: `import type`
for the predicates, `.js` extension on every relative specifier, and a **separate non-type
import line** when a value is needed:

```typescript
import type { Assignable, Equals, Expect, Not } from "./_assert.js";
import type { ActionResult } from "../src/types.js";
import { MESSAGE_MAX_CHARS } from "../src/types.js";
```

**The near-miss this new file exists to fix** — `test-d/results.test-d.ts:103-108`. Copy the
*shape*, change the import source. This is the whole point of the deferral:

```typescript
// --------------------------------------------------------------------------
// SC-7d — D-02's bound is a literal, not `number`
// --------------------------------------------------------------------------

/** Guards against a silent widening to `number` (an added `: number`) or a changed bound. */
type _messageBound = Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>;
```

`_messageBound` imports `MESSAGE_MAX_CHARS` from `../src/types.js` (line 21) and is therefore
**structurally blind** to the export-placement regression. `[VERIFIED — 02-RESEARCH.md:689-701]`
The new file must import from **`../src/index.js`**, and the diagnostic that fires is **TS1485
at the import line**, not TS2344 at the assertion.

**Required new-file skeleton** (research-supplied, `02-RESEARCH.md:703-710`) — the comment on
the import line is load-bearing and should survive verbatim:

```typescript
import type { Equals, Expect } from "./_assert.js";
import { MESSAGE_MAX_CHARS } from "../src/index.js";   // ← index.js. NOT types.js. This is the whole point.

/** MESSAGE_MAX_CHARS reaches the public entrypoint as a VALUE, not only as a type. */
type _messageBoundExportedAsValue = Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>;
```

**Four house rules this file must obey** (all four are stated in prose at the top of every
existing `test-d` file, and all four were *measured*, not assumed):

| Rule | Source | Why |
|---|---|---|
| **File-top prose header naming the SC/deferral and what escapes without it** | `results.test-d.ts:1-17`, `transport.test-d.ts:1-20`, `actions.test-d.ts:1-54` | Every file opens with 15-55 lines of `//` comment before the first import |
| **Export nothing** | `actions.test-d.ts:20-41` (with the TS9010 demonstration) | The imports supply module status; an export drags `isolatedDeclarations` in |
| **Every predicate on ONE line, however long** | `results.test-d.ts:27-32`, `transport.test-d.ts:10-15` | `tsc` echoes only the line the failing type argument sits on. Wrapping silently disabled 4 of 5 assertions in plan 01-02 |
| **Name every alias after the invariant; a `/** … *\/` doc comment above it** | `_assert.ts:8-11` | `Type 'false' does not satisfy the constraint 'true'` is the entire message; the alias name is the diagnostic |

**`@ts-expect-error` usage** — reserved, counted, and justified. Occurrence counts today:
`results.test-d.ts` 1, `consent.test-d.ts` 2, `actions.test-d.ts` 2, `transport.test-d.ts` 0.
`_assert.ts:5-14` states the rule:

```typescript
// Predicates, not `@ts-expect-error`. A directive suppresses ANY error on the line that
// follows it — including an unrelated typo — so a directive written to prove that a bad
// value is rejected can pass green for the wrong reason ...
//
// Reserve `@ts-expect-error` for object-literal freshness (excess properties), which
// predicates cannot model: `Assignable<{...; extra: 1}, T>` evaluates to `true`.
```

`exports.test-d.ts` needs **zero** directives. Do not add one.

**Section-divider style** — `results.test-d.ts:23-25`, 74 columns:

```typescript
// --------------------------------------------------------------------------
// SC-2 — the union is closed, and both halves of it reach the field
// --------------------------------------------------------------------------
```

(Note: `src/types.ts` uses a **77-column** divider with `---------` — `src/types.ts:15-17`.
The two are deliberately different widths. Match the directory you are writing into.)

---

### 2. The M9 `_policyNotBivariant` detector (type-test, compile-time assertion)

**Form analog:** `test-d/transport.test-d.ts:59-66` — the closest existing
`Expect<Not<Assignable<…>>>` with a doc comment explaining *why the negative is the guard*:

```typescript
/**
 * The guard that fires the moment the field regresses to `boolean`. `true` was a
 * legal value of the old shape and must not be a legal value of the new one. This
 * is also why D-12 item 3 settled on *replacing* the boolean rather than
 * supplementing it: alongside a surviving boolean this assertion is unwritable, and
 * two fields would be two sources of truth for one fact.
 */
type _provenanceNotBoolean = Expect<Not<Assignable<true, TransportCapabilities["userTurnIdentity"]>>>;
```

**Content analog — the thing it complements, not duplicates** — `test-d/actions.test-d.ts:115-142`.
This is M9's *current* sole detector, and its documented weakness is exactly what the new
predicate removes:

```typescript
const eq = (a: Booking, b: Booking): boolean => a.amount === b.amount;

/** The positive: a comparator over the real snapshot fits a policy over that snapshot. */
const _policyTyped: ConsentPolicy<Booking> = {
  requires: "reviewBooking",
  bindTo: "userTurn",
  snapshotEquality: eq,
};

/**
 * The negative — and **mutant M9's sole detector**.
 *
 * A `Booking` comparator must not fit a `ConsentPolicy<unknown>`. The directive sits
 * directly above the *property*, not above the declaration, because that is where the
 * error is reported: TS2322 on `snapshotEquality`, not on `_policyDegraded`.
 *
 * Switching `snapshotEquality` to method syntax makes its parameters bivariant, the
 * assignment above starts succeeding, and this directive goes unused — a lone TS2578 is
 * then the *only* symptom that the guard has stopped guarding. Nothing else in this
 * repository notices. ...
 */
const _policyDegraded: ConsentPolicy = {
  requires: "reviewBooking",
  bindTo: "userTurn",
  // @ts-expect-error - a Booking comparator must NOT fit ConsentPolicy<unknown> (SC-7a)
  snapshotEquality: eq,
};
```

**Pattern to write** (`02-RESEARCH.md:675-687`, measured `TS2344` under mutation):

```typescript
interface Booking { readonly id: string }

/** Function-property syntax keeps `snapshotEquality`'s parameters contravariant. Method syntax would make them bivariant. */
type _policyNotBivariant = Expect<Not<Assignable<ConsentPolicy<Booking>, ConsentPolicy<unknown>>>>;
```

**Placement guidance for the planner — two live options with different costs:**

- **In `test-d/actions.test-d.ts`.** `Booking` already exists there as `type Booking = { id: string; amount: number }` (line 76) and `ConsentPolicy` is already imported (line 61). Zero new fixtures. But the file's header (lines 1-54) enumerates exactly what it covers and would need amending, and it declares "exactly two suppression directives appear below and no more" (line 51) — a claim the planner must not invalidate.
- **In a new `test-d/consent-variance.test-d.ts`.** Requires re-declaring a local `Booking` and re-importing `ConsentPolicy` from `../src/types.js`. Cleaner blast radius; costs a new 20-line prose header.

**Cross-references that must be updated either way:** `consent.test-d.ts:163-167` currently
says M9's "*single* symptom is an unused directive on `_policyDegraded` in `actions.test-d.ts`".
That sentence becomes false the moment this detector lands.

---

### 3. `packages/concierge/src/contract.ts` (runtime module, first in the package)

**No runtime-module analog exists.** `src/` contains exactly two files — `index.ts` (71 lines,
pure re-export) and `types.ts` (1,242 lines, types plus four frozen constants). `contract.ts`
is the first file in this package to contain an executable function body.

What *does* transfer, from `src/types.ts`:

**File header** — `src/types.ts:1-9`. Every `src/` file opens with a `/** … */` block that names
the constraint the file operates under, not just what it contains:

```typescript
/**
 * Concierge core type surface.
 *
 * This file is the design contract. No runtime dependencies, no framework
 * imports, no top-level DOM access — it must construct on a server under Next
 * App Router, Nuxt, or SvelteKit without guards. The no-DOM guarantee is
 * enforced mechanically by `lib: ["ES2022"]`: referencing `document` here is a
 * compile error (TS2584), not a code-review question.
 */
```

`contract.ts`'s header should state the two constraints that are specific to it and that a
future editor will otherwise break: **(a) `assertSingleInstance` must never be called at module
scope** (`sideEffects: false` tree-shakes module-scope evaluation away — measured, the naive
form is absent from *every* bundled consumer even when the consumer imports `CONTRACT_VERSION`,
`02-RESEARCH.md:158-177`), and **(b) no top-level `await`**.

**Constant declaration style** — `src/types.ts:182-206`. Two forms coexist, and the choice
between them is documented rather than incidental:

```typescript
export const USER_CANCELLED: Readonly<ActionResult> = Object.freeze({
  ok: false,
  reason: "cancelled",
  message: "Cancelled.",
});
```

```typescript
/**
 * Maximum length of an {@link ActionResult.message}, in characters.
 *
 * Deliberately unannotated: under `isolatedDeclarations` the literal type
 * `180` survives into the emitted `.d.ts`, so a consumer — and this package's
 * own type tests — can guard against a silent widening to `number` or a
 * changed bound. Annotating it `: number` would discard exactly that signal.
 * ...
 */
export const MESSAGE_MAX_CHARS = 180;
```

⚠️ **Note the conflict the planner must resolve in one sentence.** `MESSAGE_MAX_CHARS` is
**deliberately unannotated** and its doc comment says so explicitly. `02-RESEARCH.md:239-241`
prescribes `export const CONTRACT_VERSION: 1 = 1;` — *annotated with the literal* — and calls it
"the same trick `MESSAGE_MAX_CHARS` uses". It is not literally the same trick: one omits the
annotation, one writes `: 1`. **Both preserve the literal in the emitted `.d.ts`**, so both
satisfy the requirement, but if `contract.ts` writes `: 1` while `types.ts` writes nothing, the
two files disagree on house style with no comment explaining why. Pick one and say why in the
doc comment — that is what `types.ts:194-205` does.

**Import style** — `src/types.ts:11` is the only import in `src/`:

```typescript
import type { StandardSchemaV1 } from "@standard-schema/spec";
```

`contract.ts` should need **zero** imports. `globalThis` is in `lib: ["ES2022"]`; adding any
import risks the PKG-05 module graph.

**Doc-comment density.** `src/types.ts` is 1,242 lines and is majority prose — every non-obvious
declaration carries a `/** */` explaining the alternative that was rejected and why. Match that.
`assertSingleInstance`'s comment is where "never call this at module scope" has to live, because
that is the exact edit a future contributor will make (it looks like a simplification).

---

### 4. `packages/concierge/src/index.ts` (barrel) — modify

**Analog: itself.** The file has exactly two blocks and the split is enforced by
`verbatimModuleSyntax`. `CONTRACT_VERSION` and `assertSingleInstance` are **values** and belong
in the second block.

**Type block** — `src/index.ts:12-63`, grouped by domain with `//` section comments:

```typescript
export type {
  // Schema interop
  StandardSchemaV1,
  InferOutput,
  ...
  // Concierge
  Scheduler,
  Concierge,
  ConciergeConfig,
  Session,
  SessionConfig,
} from "./types.js";
```

**Value block** — `src/index.ts:65-70`. This is the block `exports.test-d.ts` guards:

```typescript
export {
  USER_CANCELLED,
  USER_DECLINED,
  CONSENT_GRADE_ORDER,
  MESSAGE_MAX_CHARS,
} from "./types.js";
```

Adding `contract.ts` introduces the **first second-source re-export** in this file. Either add a
third block `export { CONTRACT_VERSION, assertSingleInstance } from "./contract.js";` or extend
with a `// Contract` comment group — but note the existing value block has **no** group comments
while the type block does. Also note the file header (`src/index.ts:1-10`) says "this package
currently exports the design contract only. The runtime … is being implemented" — that sentence
becomes partially false and should be amended in the same edit.

**Export-surface consequence:** the artifact guard in `test/artifact.test.ts` asserts **43 names
(39 types + 4 values)** in `dist/index.d.ts`'s trailing `export { … }` `[VERIFIED —
02-RESEARCH.md:753]`. Adding two names makes it **45 (39 + 6)**. The count in the test must be
written *after* `index.ts` is edited, or the two land inconsistent.

---

### 5. `packages/concierge/package.json` and root `package.json` (manifests) — modify

**Analog: themselves.** Two conventions worth preserving because a formatter or an `npm pkg set`
will silently violate both.

**Field ordering, `packages/concierge/package.json`** — identity → legal → links → module shape →
publish → runtime → deps → **scripts last** (lines 25-52):

```json
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  },
  "engines": {
    "node": ">=22.12.0"
  },
  "dependencies": {
    "@standard-schema/spec": "^1.0.0"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.test-d.json"
  }
```

`scripts` **last** is unusual and is the convention here. Add `build` and `test` into that block:

```jsonc
  "scripts": {
    "build":     "tsdown",
    "typecheck": "tsc -p tsconfig.test-d.json",   // unchanged — Phase 1's gate
    "test":      "vitest run"
  }
```

**Field ordering, root `package.json`** (lines 15-26) — `packageManager` → `engines` → `scripts`
→ `devDependencies`:

```json
  "packageManager": "pnpm@10.33.0",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
```

Three deltas land here: `packageManager` → `pnpm@11.17.0`, `typescript` → `"7.0.2"` **exact, no
caret**, and the new `check:*` / `release` scripts. `engines.node: ">=22.12.0"` at the root is
**not** to be harmonized with pnpm 11's `>=22.13` — `02-RESEARCH.md:779` is explicit that the
package's floor is about consumers and pnpm's is about contributors.

⚠️ **`files` already lists `LICENSE` and the file does not exist** — `packages/concierge/`
contains `README.md`, `package.json`, `src/`, `test-d/`, `tsconfig.json`, `tsconfig.test-d.json`,
`node_modules/`, and nothing else `[VERIFIED — ls]`. The fix is to add the file, not to edit
`files`.

---

### 6. `packages/concierge/tsdown.config.ts` and root `vitest.config.ts` (build/test config)

**No analog. This phase establishes the convention.** The repo has never had a `.ts` config file
of any kind — the only build-adjacent configs are the three tsconfigs, which are JSON.

**The one structural precedent that *does* transfer** is the *two-programs-one-package* layering
Phase 1 established, and specifically the discipline of writing down why a config is split:

`tsconfig.base.json:1-21` — shared strictness, `$schema` present, single object:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "isolatedDeclarations": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

`packages/concierge/tsconfig.json:1-8` — the emit program, minimal, extends the base:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts"]
}
```

`packages/concierge/tsconfig.test-d.json:1-13` — the sibling program. **Note the comments in a
`.json` file** (TypeScript accepts JSONC) and note that every non-obvious line explains itself
*and names the diagnostic that fires if you get it wrong*:

```jsonc
{
  // Typecheck-only program: src + test-d, under the exact production compiler flags.
  // The build config (./tsconfig.json) is deliberately NOT edited — a sibling config keeps
  // the type-test suite out of the emit program without an `exclude` clause.
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    // REQUIRED. `rootDir` is inherited as "./src" from the build config and is NOT relaxed
    // by `noEmit`; omitting this override produces TS6059 naming the first test-d file.
    "rootDir": "."
  },
  "include": ["src/**/*.ts", "test-d/**/*.ts"]
}
```

**Convention this phase establishes for `tsdown.config.ts`:** package-local, not root-hoisted.
`02-RESEARCH.md:645-647` makes this a *deliberate structural guard*, not an accident — root
scripts stay `pnpm -r build` so each package declares its own builder, which is what prevents a
future `concierge-svelte` from being swept into tsdown and having its runes pre-bundled. That
reason must be written in the config file or it looks like duplication and gets "fixed".

**Convention this phase establishes for `vitest.config.ts`:** root, not package-local (a single
`test.projects` entry). Note this *diverges* from the tsdown decision and the divergence should
be stated: one shared runner, per-package builders.

**Both configs carry a non-obvious gate that must be commented like `tsconfig.test-d.json`
comments TS6059:**

| Config | The line that looks wrong and is right | What fires if you get it wrong |
|---|---|---|
| `tsdown.config.ts` | `attw: { level: "error", profile: "esm-only" }` | `attw: true` reports and **exits 0** — not a gate `[VERIFIED]`. Default profile **fails a correct ESM-only package** `[VERIFIED]` |
| `vitest.config.ts` | typecheck mode **off** | `typecheck.include` default `**/*.{test,spec}-d.*` matches `test-d/`; enabling it errors in `startTypechecker` `[VERIFIED]` |

---

### 7. `packages/concierge/test/*.test.ts` (runtime tests)

**No analog — this phase writes the first runtime test in the repository.** `test/` does not
exist; `vitest` is not installed; `node_modules/` at the root contains exactly one entry,
`typescript`.

**What does not transfer:** `test-d/`'s `Expect`/`Equals` vocabulary, `_assert.ts`, the
one-predicate-per-line rule, and the export-nothing rule are all `tsc`-specific and have no
meaning in Vitest.

**What should transfer, as a documentary convention rather than a code pattern:**

1. **A prose header naming what escapes without this file.** Every `test-d` file has one —
   `transport.test-d.ts:38-44` is the model: it says *"nothing anywhere reads `ToolBatch` …
   without this line, a regression on the hook a transport author actually implements is
   completely invisible."* The single-instance test needs exactly this sentence about
   `sideEffects: false`.
2. **Name the test after the invariant.** `_assert.ts:9-11`: *"Name every assertion after the
   invariant it guards; that name is the only carrier of meaning in these diagnostics."*
   `02-RESEARCH.md:335` applies this directly: name the PKG-05 test
   `it("core's dependencies contribute zero bytes to a consumer bundle")`, not `it("has no deps")`.
3. **Record what a check does *not* prove.** `consent.test-d.ts:150-161` is the model, and there
   are two vacuous-check hazards in this phase that must be recorded the same way:
   `ReadbackAttestation` **does not exist in `types.ts` at all** (`02-RESEARCH.md:757`), so a
   "not exported" assertion passes vacuously; and `serverChallengeBrand`/`ConsentAckBase` **are
   present in `dist/index.d.ts` as declarations** and must be asserted absent *from the trailing
   export list*, not from the file (`02-RESEARCH.md:755`).

**The one hard structural rule** (`02-RESEARCH.md:908`): these tests import `../dist/index.js`,
**never** `../src/`. A test against `src/` proves nothing about tree-shaking and will pass forever.

---

### 8. `packages/concierge/test/fixtures/probe.ts` (consumer-side type probe)

**Partial analog:** `test-d/results.test-d.ts:103-108`. Same idiom — *assert a literal type
survived* — but a different program: the probe is compiled by a **scratch project's own
`typescript@7.0.2`** with `skipLibCheck: false` against the shipped `.d.ts`, not by
`tsconfig.test-d.json`. So it uses plain annotations, not `Expect<Equals<…>>`:

```typescript
export const n: 180 = MESSAGE_MAX_CHARS;       // literal type survived into the shipped .d.ts
export const v: 1 = CONTRACT_VERSION;
```

**Two constraints inherited from core, both worth a comment:** no `console` (the probe runs
under `lib: ["ES2022"]` with no `@types/node`; `console.log` is TS2584 — this bit the first draft
of the harness, `02-RESEARCH.md:417`), and it **does** export (unlike every `test-d` file), because
it is a module in a foreign program with no `isolatedDeclarations` interaction with this repo.

---

### 9. `packages/concierge/test/fixtures/adapter-alpha|beta/package.json`

**Partial analog:** `packages/concierge/package.json`. Shares `type: "module"` and the field-order
convention; shares almost nothing else. These are `private: true`, ~10 lines, and their only job
is to make the *install graph* real:

```jsonc
{
  "name": "@fullselfbrowsing/concierge-fixture-alpha",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "peerDependencies": { "@fullselfbrowsing/concierge": "workspace:^" },
  "devDependencies":  { "@fullselfbrowsing/concierge": "workspace:*" }
}
```

⚠️ **`pnpm-workspace.yaml` currently globs `packages/*` and `examples/*`.** Fixtures under
`packages/concierge/test/fixtures/` are **not** matched by `packages/*` (one level only), so they
are invisible to pnpm as workspace packages unless the glob is extended. The planner must decide
this explicitly — the research's `realpath`-equality assertion (`02-RESEARCH.md:277`) requires
them to actually be workspace members.

---

### 10. `scripts/*` — four files, no analog

**`scripts/` does not exist.** This phase creates it. Four files, two languages, and the
conventions this phase establishes:

| File | Language | Contract |
|---|---|---|
| `mutate-and-prove.sh` | bash | `set -uo pipefail` (**not** `-e` — it must survive the gate failing), `trap … EXIT INT TERM`, pre-flight dirty check, no-op detection, `git diff --exit-code` post-condition. Exit codes 0/1/2/3/4 are each meaningful. Verbatim in `02-RESEARCH.md:598-617` |
| `pack-install-check.sh` | bash | `set -euo pipefail`, `mktemp -d` **outside the repo** (a scratch dir under `packages/` is swallowed by the `packages/*` glob and pnpm links the workspace copy — the test would pass without testing anything), `trap 'rm -rf "$OUT"' EXIT` |
| `node-floor-check.sh` | bash | raw tarball download to `${TMPDIR:-/tmp}/node-v$FLOOR`, no `nvm`/`fnm`/`volta` |
| `pkg05-zero-runtime-deps.mjs` | node ESM | `.mjs` extension, `process.exit(0|1)`, takes the entry as `process.argv[2]` |

**Note the language split is not arbitrary and should be written down:** the `.mjs` script needs
`rolldown`'s JS API; the `.sh` scripts orchestrate subprocesses and need `trap`. Root scripts
invoke them by a stable name (`pnpm run check:pack`) so CI and local run the *same* file —
`02-RESEARCH.md:440` — which is the reason they are in `scripts/` rather than inline in workflow YAML.

**No existing shell script or `.mjs` file exists anywhere in the repo to copy a header from.**
Establish one: a `#!/usr/bin/env bash` shebang, then a `#` line naming the requirement ID it
serves (`# scripts/pack-install-check.sh — PKG-02`), matching the way every `test-d` file opens
by naming its SC.

---

### 11. `.github/workflows/ci.yml` and `release.yml` — no analog

**`.github/` does not exist at all** `[VERIFIED — 02-RESEARCH.md:148, and `ls`]`. CI is entirely
greenfield. Full YAML is in `02-RESEARCH.md:462-490` (CI) and `:851-883` (release); the planner
should treat those as the source, not re-derive them.

**Non-obvious lines that must carry a comment, because each has a silent-failure mode:**

| Line | Why it is not decoration |
|---|---|
| `node-version: '22.12.0'` **quoted** + `node -e "if(process.version!=='v22.12.0') throw …"` | `22.12` silently resolves to latest 22.12.x, `22` to latest 22.x |
| `node-floor` as a **separate job**, not a matrix entry | Its *steps* differ — no pnpm, no build, tarball input. **pnpm 11 cannot run on Node 22.12.0** (`requires at least Node.js v22.13`) `[VERIFIED]` |
| `permissions: { id-token: write }` | Omitted → no OIDC exchange → 404 that reads like a permissions problem |
| `fetch-depth: 0` | changesets cannot diff released versions otherwise |
| **no** `NPM_TOKEN`, **no** `--provenance` | A stray `NPM_TOKEN` makes publish succeed *without* provenance — a silent downgrade |
| **do not** write `auth-token-line: false` | The input does not exist in `actions/setup-node`'s current `action.yml` `[VERIFIED]` |

---

### 12. `.changeset/config.json` — no analog

**`.changeset/` does not exist.** Requirements: `ignore: []` **explicit and empty**, with a
comment naming what goes there (`02-RESEARCH.md:667`) so Phase 9's first private package has an
obvious home.

⚠️ **The repo's JSONC precedent does not transfer here.** `tsconfig.test-d.json` carries `//`
comments because *TypeScript* accepts them. `@changesets/config` reads its config with a strict
JSON parse. **The planner must verify comment tolerance before writing one**, or put the "what
goes in `ignore`" note in `CONTRIBUTING.md` and reference it. This is the single most likely
place a plan copies the wrong repo pattern.

---

### 13. The build-toolchain constraint document

**Role-match analog:** `CONTRIBUTING.md:18-27`, the "Non-negotiables" section. Six bullets, each
in the form **bold claim → the concrete failure the alternative caused**:

```markdown
## Non-negotiables

These are invariants, not preferences. Each one exists because the alternative broke something real:

- **Core has zero top-level DOM access.** It must construct on the server under Next App Router,
  Nuxt, and SvelteKit without environment guards. No `window`, `document`, or `navigator`
  outside a lazily-invoked function.
- **`dispatch` is not `async`.** An async wrapper allocates a fresh Promise per invocation,
  which breaks await-deduplication by reference identity. There is a test asserting `p1 === p2`;
  do not delete it.
```

Two new bullets belong in exactly this form:

- **`concierge-svelte` builds with `svelte-package`, never tsdown.** Runes are compiler-transformed; pre-bundling them produces code that runs and is not reactive. No error, no warning — the symptom is "the snapshot doesn't update," indistinguishable from a bridge bug.
- **The build is not centralized.** Root scripts stay `pnpm -r build` so each package declares its own builder. This looks like duplication and is the structural guard against the bullet above.

`CONTRIBUTING.md:55` already says *"Run `pnpm typecheck && pnpm test` before pushing"* — a command
that is **currently a lie** (`pnpm test` exits 0 as a silent no-op `[VERIFIED]`). This phase makes
it true; the planner may also want to extend it to include `pnpm build`.

---

## Shared Patterns

### A. Doc-comment-as-diagnostic

**Source:** `test-d/_assert.ts:8-11`, and every declaration in `src/types.ts`.
**Apply to:** every file this phase creates, including the shell scripts and YAML.

> Name every assertion after the invariant it guards; that name is the only carrier of meaning
> in these diagnostics.

This repo's dominant convention: **a non-obvious line carries a comment stating the failure mode
it prevents, and where possible the exact diagnostic code.** `tsconfig.test-d.json` names TS6059.
`actions.test-d.ts` names TS9010, TS2322, TS2578. `types.ts` names TS2584. A Phase 2 file that
sets `attw: { level: "error", profile: "esm-only" }` without a comment saying *"`attw: true`
exits 0 — it is a report, not a gate"* is off-style **and** will be silently reverted.

### B. Record what a check does *not* prove

**Source:** `test-d/consent.test-d.ts:150-168` (the `DigestLike` non-mutant), `actions.test-d.ts:148-157`
(`_requiresIsString` is "explicitly *not* M10's detector").
**Apply to:** the artifact tests, and the release workflow.

Two Phase 2 items require this treatment verbatim: the **`ReadbackAttestation` vacuous
assertion** (`02-RESEARCH.md:757`, `:991` — "must not be counted as a passing check"), and the
**OIDC release workflow**, which cannot be executed this phase and whose verification is static
review only (`02-RESEARCH.md:991`).

### C. Defect-first proof

**Source:** Phase 1's ten-mutant battery (three of ten escaped the first draft —
`02-RESEARCH.md:995`).
**Apply to:** all eleven mutants P1-P11 (`02-RESEARCH.md:1001-1011`).

Every gate in this phase is a shell exit code, which fails silently green more readily than a
type assertion. `scripts/mutate-and-prove.sh` is the mechanism and should be written **first**,
in Wave 0 or early Wave 1, because every subsequent wave's proof depends on it. P4, P6 and P10
are named as non-skippable.

### D. `.js` extension on every relative specifier

**Source:** `src/index.ts:63,70`, `src/types.ts:11`, all four `test-d` files.
**Apply to:** `src/contract.ts`, `src/index.ts`, `test-d/exports.test-d.ts`, and any relative
import in `test/*.test.ts`.

`verbatimModuleSyntax` + `moduleResolution: "bundler"`. Note `test/*.test.ts` importing
`../dist/index.js` is a *real* on-disk path, not a mapped one — different reason, same shape.

### E. Two-programs-one-package

**Source:** `packages/concierge/tsconfig.json` + `tsconfig.test-d.json`.
**Apply to:** the `dist/` boundary generally.

Phase 1 verified a cold `tsc -p tsconfig.json` emits 8 files into `dist/` with **zero** test
artifacts. `tsdown` replaces the emit half but the invariant survives: nothing under `test/`,
`test-d/`, or `scripts/` may reach `dist/`. `files: ["dist", "README.md", "LICENSE"]` is the
second enforcement layer, and `publint`/`attw` on the **packed tarball** is the third (defect D5,
`files: []` omitting `dist`, is caught **only** by `publint` on the packed artifact).

---

## No Analog Found

Files with no close match anywhere in the codebase. The planner should use `02-RESEARCH.md`'s
verbatim, measured code blocks rather than looking for a repo precedent.

| File | Role | Reason | Research source |
|---|---|---|---|
| `packages/concierge/tsdown.config.ts` | build config | No bundler has ever existed here | `02-RESEARCH.md:542-555` |
| `vitest.config.ts` | test config | No test runner has ever existed here | `02-RESEARCH.md:956` |
| `.changeset/config.json` | release config | `.changeset/` does not exist | `02-RESEARCH.md:667` |
| `.github/workflows/ci.yml` | CI config | **`.github/` does not exist at all** | `02-RESEARCH.md:462-490` |
| `.github/workflows/release.yml` | CI config | same | `02-RESEARCH.md:851-883` |
| `scripts/mutate-and-prove.sh` | script | `scripts/` does not exist; no shell script anywhere in repo | `02-RESEARCH.md:598-617` (verbatim) |
| `scripts/pack-install-check.sh` | script | same | `02-RESEARCH.md:375-406` |
| `scripts/node-floor-check.sh` | script | same | `02-RESEARCH.md:499-510` |
| `scripts/pkg05-zero-runtime-deps.mjs` | script | same; no `.mjs` file anywhere in repo | `02-RESEARCH.md:344-355` |
| `packages/concierge/test/single-instance.test.ts` | runtime test | `test/` does not exist; no runtime test has ever been written | `02-RESEARCH.md:285-313` |
| `packages/concierge/test/artifact.test.ts` | runtime test | same | `02-RESEARCH.md:725-733` |
| `packages/concierge/src/contract.ts` (the *function body*) | runtime module | No executable code exists in `src/` — only types and four frozen constants | `02-RESEARCH.md:184-202` |
| `.npmrc` (if needed) | config | Does not exist at root or in the package | — |

---

## Repo Audit — requested checks

### `.gitignore` coverage `[VERIFIED — git check-ignore -v]`

Current file (26 lines):

```gitignore
node_modules/
dist/
build/
coverage/
*.tsbuildinfo

.DS_Store
Icon?
Thumbs.db

.env
.env.*
!.env.example

.idea/
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json

*.log
npm-debug.log*
pnpm-debug.log*

.turbo/
.cache/
.context/
```

| Artifact | Covered? | Evidence |
|---|---|---|
| `packages/concierge/dist/` | ✅ **yes** | `git check-ignore` → `.gitignore:2:dist/` matches at any depth |
| `coverage/` (`@vitest/coverage-v8`, if added later) | ✅ yes | line 4 |
| `.turbo/`, `.cache/` | ✅ yes (unused today) | lines 24-25 |
| **Packed tarballs (`*.tgz`)** | ❌ **NO** | `packages/concierge/*.tgz` and root `*.tgz` both **not ignored**. `pnpm pack` with no `--pack-destination` writes into the package dir. The research's harness uses `--pack-destination "$(mktemp -d)"` and CI uses `${{ runner.temp }}`, so the happy path is safe — but one manual `pnpm pack` leaves an untracked 116 kB tarball, and the phase gate asserts `git status --porcelain` is **empty** (`02-RESEARCH.md:1022`). **Recommend adding `*.tgz`.** |
| **`.tmp/`** | ❌ **NO** | not ignored. Not currently used by any research-specified script — all scratch dirs are `mktemp -d` / `${TMPDIR:-/tmp}`, outside the repo. Add only if a plan introduces an in-repo scratch dir; prefer keeping scratch out of the repo (a dir under `packages/` is swallowed by the `packages/*` workspace glob and would break PKG-02 silently). |
| **Downloaded Node** | ✅ n/a | `scripts/node-floor-check.sh` targets `${TMPDIR:-/tmp}/node-v22.12.0` — outside the repo. If a plan relocates it in-repo (e.g. `.node/`), it **must** add the ignore in the same commit. |
| `.changeset/` | ✅ correct as-is | must stay **tracked** — do not add an ignore |
| `.github/` | ✅ correct as-is | must stay tracked |

**Recommended single-line addition:** `*.tgz`, next to `*.tsbuildinfo` in the build-artifact block.

### `scripts/` and `.github/` existence

```
scripts/   → does not exist  (find, maxdepth 3, excluding node_modules: no match)
.github/   → does not exist  (find, maxdepth 3, excluding node_modules: no match)
```

Both are created from nothing by this phase. `git ls-files` confirms no tracked file under
either path.

### Other environment facts the planner will want

| Fact | Value `[VERIFIED]` |
|---|---|
| `pnpm-lock.yaml` | `lockfileVersion: '9.0'`; exactly two packages resolved (`typescript@5.9.3`, `@standard-schema/spec@1.1.0`); `settings.autoInstallPeers: true` — relevant to the F3 peer fixtures |
| root `node_modules/` | one entry: `typescript` |
| `pnpm-workspace.yaml` | 3 lines, `packages: ["packages/*", "examples/*"]`, **no `catalog:` key yet**; `examples/` does not exist |
| `.npmrc` | absent at root and in the package |
| `packages/concierge/` contents | `README.md`, `package.json`, `src/`, `test-d/`, `tsconfig.json`, `tsconfig.test-d.json`, `node_modules/` — **no `LICENSE`**, no `dist/` |
| `test-d/` line counts | `_assert.ts` 38, `results` 108, `transport` 137, `consent` 302, `actions` 354 |
| `src/` line counts | `index.ts` 71, `types.ts` 1,242 |

---

## Metadata

**Analog search scope:** repo root, `packages/concierge/{src,test-d}/`, `packages/concierge/*.json`,
root `*.json` / `*.yaml` / `.gitignore`, `CONTRIBUTING.md`. `node_modules/` and `.planning/`
excluded from analog candidacy.
**Files scanned:** 15 source/config files (the complete non-`.planning` tracked set is 12 files
plus 3 untracked-but-present).
**Pattern extraction date:** 2026-07-28
