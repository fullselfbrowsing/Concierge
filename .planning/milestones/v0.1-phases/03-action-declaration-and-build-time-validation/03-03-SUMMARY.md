---
phase: 03-action-declaration-and-build-time-validation
plan: 03
subsystem: core
tags: [catalog, cat-01, cat-02, cat-05, cat-06, sec-01, sec-03, sec-05, dx-03, pkg-04, deep-freeze, host-seam]
requires:
  - "packages/concierge/src/json-schema.ts (emitSchema, vendorOf, JSON_SCHEMA_TARGET, SchemaEmission, JsonSchemaTarget) — plan 03-02"
  - "packages/concierge/src/contract.ts (assertSingleInstance) — plan 02-07"
  - "packages/concierge/src/types.ts (AnyActionDefinition, JsonSchemaObject, SideEffects, RedactionPolicy)"
provides:
  - "src/host.ts — warnHost, the single sanctioned structural globalThis reach for a host capability core cannot type-see"
  - "src/catalog.ts — buildCatalog, CatalogValidationError, Catalog, CatalogEntry, CatalogIssue, CatalogIssueCode, CatalogDiagnostic, CatalogDiagnosticCode, BuildCatalogOptions"
  - "The first production call site assertSingleInstance has ever had (ROADMAP Phase 3 SC-5)"
  - "The corrected SEC-01 emptiness test, measured across all three empty-shapes plus the z.record trap"
  - "deepFreeze — recursive, accessor-skipping, cycle-safe, validator-skipping"
affects:
  - "03-04 (owns src/index.ts barrel; nine names wait to be exported, none exported here)"
  - "03-06 / 03-07 (own the behavioural suites for every rule written here)"
  - "Phase 4 (catalogFor must re-freeze its filtered result; JsonSchemaObject.additionalProperties is narrower than reality; SchemaEmission wants a {diagnosis, remedy} split)"
  - "Phase 6 (catalog.byName is the frozen null-prototype lookup; must NOT be converted to a Map)"
tech-stack:
  added: []
  patterns:
    - "Structural globalThis reach isolated into a named seam file rather than repeated ad hoc"
    - "Untyped PropertyBag view for every field a JavaScript consumer can supply differently than the type says"
    - "Recursive freeze driven by property descriptors, never by property reads"
    - "Object spread as the mechanism that converts accessors into freezable data properties"
key-files:
  created:
    - packages/concierge/src/host.ts
    - packages/concierge/src/catalog.ts
  modified:
    - packages/concierge/src/contract.ts
decisions:
  - "hasStandardSchema admits `typeof schema === \"function\"`. An arktype validator instance IS a function; an object-only guard would have rejected every arktype action in existence."
  - "The `{...action}` spread invokes accessors, and that is kept deliberately — it is what converts a getter-backed handler into a fixed data property the freeze can hold down."
  - "SchemaEmission.detail's `action \"name\": ` opener is stripped by exact reconstruction; nothing else is stripped, because the remedy has no reliable boundary."
  - "byName is a frozen Object.create(null) record, not a Map — a frozen Map still accepts .set()."
  - "The Object.isFrozen early-out RESEARCH sketched is prohibited and was re-measured to skip the children of an already-frozen escape hatch."
metrics:
  duration: "~80 min"
  completed: 2026-07-29
  tasks: 3
  commits: 3
  files_changed: 3
---

# Phase 3 Plan 03: The Catalog Summary

`buildCatalog` — one function that fires the PKG-04 guard on its first line, validates every
declaration against six rules, aggregates every problem into a single structured throw, reports the
two consent markers without blocking, and returns a recursively frozen catalog whose handler and
whose name lookup are both un-replaceable.

## What Shipped

| Artifact | Lines | What it carries |
|---|---|---|
| `packages/concierge/src/host.ts` | 96 | `warnHost`, the named host seam. Zero module specifiers. |
| `packages/concierge/src/catalog.ts` | 828 | Nine exports, six rules, `deepFreeze`, five module-private helpers |
| `packages/concierge/src/contract.ts` | 173 (+11/−4) | Comment-only: the "no call site" paragraph corrected |

## Commits

| Hash | Type | What |
|---|---|---|
| `1be2d9c` | feat | `src/host.ts` + the catalog's error/diagnostic vocabulary |
| `2b2017b` | feat | `buildCatalog` — rule table, aggregate throw, recursive freeze |
| `f4d297a` | docs | `contract.ts`'s now-false "no call site in this phase" claim |

## Verification

| Gate | Exit | Note |
|---|---|---|
| `pnpm typecheck` | 0 | |
| `pnpm build` | 0 | attw and publint clean |
| `pnpm test` | 0 | **4 files / 15 tests** — unchanged, this plan adds no test file |
| `pnpm check:deps` | 0 | unchanged from 03-02 |
| `pnpm check:artifact` | 0 | |
| `git status --porcelain` | clean | only this plan's three files were ever touched |

### `pnpm check:deps` byte count — required by the plan

**Unchanged from plan 03-02, in every figure:**

| Figure | Value |
|---|---|
| Runtime dependency bytes | **0** (`@standard-schema/spec`, 0 bytes) |
| Modules in built graph | **1** |
| Vendored modules | `[]` |
| Unbundled external imports | `[]` |

Expected: `src/catalog.ts` and `src/host.ts` are not reachable from `src/index.ts` (plan 03-04 owns
the barrel), so neither is in the built artifact at all yet.

### Mutant patterns — the exact one-occurrence literals

Both verified to occur **exactly once in the whole file**, not merely once outside comments, because
`scripts/mutate-and-prove.sh` aborts with exit 3 on a no-op and does not tolerate a pattern matching
twice.

| ID | File | Pattern (occurrences: 1) |
|---|---|---|
| **M-03-3** | `src/catalog.ts` | `<const A extends` |
| **M-03-7** | `src/catalog.ts` | `return deepFreeze(catalog, validators, new WeakSet<object>());` |

**M-03-3 proved load-bearing here, not just asserted.** Stripping the `const` modifier and
re-deriving `catalog.names` at a call site with no `as const`:

```
WITH    <const A extends …>  ->  readonly ("applyFilter" | "openItem")[]
WITHOUT <A extends …>        ->  readonly string[]
```

The tree was restored from a byte-exact backup afterwards and `diff` confirmed identity.
`cat.byName.notAnAction` is `TS2339` and `cat.byName.applyFilter` resolves clean, so CAT-01 holds
through the record as well as through `names`.

### Task acceptance greps (comment lines filtered)

| Check | Required | Observed |
|---|---|---|
| `host.ts` — `import` | 0 | **0** |
| `host.ts` — `console\.` | 0 | **0** |
| `catalog.ts` — `class CatalogValidationError extends Error` | 1 | **1** |
| `catalog.ts` — `new Map` | 0 | **0** |
| `catalog.ts` — `<const A extends` | 1 | **1** |
| `catalog.ts` — `assertSingleInstance()` | 1 | **1** |
| `catalog.ts` — `Reflect.ownKeys` | 1 | **1** |
| `catalog.ts` — `for (const .* in ` | 0 | **0** |
| `catalog.ts` — `Object.create(null)` | 1 | **1** |
| `catalog.ts` — line count | ≥ 260 | **828** |
| `contract.ts` — `There is no call site in this phase` | 0 | **0** |
| `contract.ts` — `buildCatalog` | ≥ 1 | **1** |
| `contract.ts` — `export const CONTRACT_VERSION = 1;` | 1 | **1** |

`assertSingleInstance();` is line 685, directly under the signature that closes on line 684 — the
literal first statement of the body, confirmed by reading the function, not only by counting.

`git diff -U0 -- packages/concierge/src/contract.ts` was read line by line: **every** changed line
begins `` * ``. No line outside the block comment is modified.

## Measurements the plan required

### The three empty-shapes, plus the trap — all four measured, none assumed

Run through the real `emitSchema` at `draft-2020-12` against the installed zod 4.4.3 and arktype
2.2.3, before the rule was written:

| Fixture | `properties` | `propertyNames` | `patternProperties` | `additionalProperties` | Verdict |
|---|---|---|---|---|---|
| `z.object({key, value})` | present, 2 own keys | absent | absent | **absent** | NON-EMPTY |
| `z.object({})` | present, `{}` | absent | absent | **absent** | EMPTY |
| arktype `type({})` | **absent** | absent | absent | **absent** | EMPTY |
| `z.record(z.string(), z.string())` | **absent** | **present**, `{type:"string"}` | absent | **present**, an **object** `{type:"string"}` | NON-EMPTY |

Three things this settles, each of which the plan asked to be measured rather than trusted:

1. **`additionalProperties` is ABSENT on all three non-record rows.** So the short form
   `additionalProperties !== false` reads `undefined !== false` as `true` and would flip
   `z.object({})` — the genuinely empty case, and the one every test writes — into a build failure.
   The shipped condition is **present AND not false**, spelled with `Object.hasOwn`.
2. **Absent `properties` means two unrelated things.** arktype spells "no members" by omitting the
   key; zod spells it `properties: {}`. So absence implies neither "record-shaped" nor "non-empty",
   and any rule keyed on `properties` alone is wrong in one direction or the other.
3. **`z.record`'s `additionalProperties` is a schema OBJECT, not a boolean.**
   `JsonSchemaObject.additionalProperties` is declared `boolean` in `types.ts`. The declaration is
   narrower than reality. All four keys are therefore read through a `PropertyBag`
   (`Record<string, unknown>`) view. **`types.ts` was NOT amended** — 03-CONTEXT forbids touching it
   this phase — so this is handed to Phase 4 below.

### The freeze semantics, all four re-measured in ESM strict mode

| Claim | Measured |
|---|---|
| Shallow freeze leaves `catalog[0].action.handler = attackerFn` succeeding silently | **Confirmed.** No throw; the replacement handler ran. |
| `Object.isFrozen(catalog)` still reports `true` on the breached form | **Confirmed.** A SEC-03 test asserting only this passes on the breach. |
| A frozen `Map` still accepts `.set()` | **Confirmed.** `Object.isFrozen(map) === true` and `map.set(k, evil)` succeeded. |
| The `Object.isFrozen` early-out skips children | **Confirmed.** A hatch frozen at the top kept mutable children; `hatch.properties.a` was successfully replaced through the early-out form. The early-out is **absent** from the shipped `deepFreeze`. |
| `frozenArray.filter(...)` returns an **unfrozen** array | **Confirmed.** Phase 4 hand-off, written into the `deepFreeze` doc comment as well as here. |
| `Reflect.getOwnPropertyDescriptor` on an accessor returns no `value` and does not run the getter | **Confirmed.** The `"value" in descriptor` test is exact and the descriptor read is itself safe. |

### SEC-03 end-to-end, against a real built catalog

Every one of these threw `TypeError` in ESM strict mode:

`entries[0].action.handler` · `entries[0].parameters.type` · `entries.push(...)` ·
`byName.applyFilter` · `byName.newKey` · `names.push(...)` · `diagnostics.push(...)` ·
`entries[0].action.effects.destructive`

And: `byName.__proto__` is `undefined`, `byName.constructor` is `undefined`,
`Object.getPrototypeOf(byName)` is `null`. `Object.isFrozen(action.schema)` is **`false`** — the
validator is skipped by design, and `schema.safeParse({key:"v"})` still returns
`{"success":true,...}` after the build.

Mutating the *original* declaration after the build (`decl.handler = attacker`,
`decl.description = "mutated"`) does not reach the catalog, and the original stays mutable.

### PKG-04 is genuinely wired, proved by poisoning the registry

Seeding `globalThis[Symbol.for("@fullselfbrowsing/concierge.contract")] = {version: 999}` and then
calling `buildCatalog` throws the contract-mismatch `Error`. If `assertSingleInstance()` were absent
or unreachable the build would have succeeded. This is the first time that guard has been observed
firing from a production path.

### The message a developer actually sees

Seven declarations, seven distinct faults, **one** throw:

```
concierge: 7 problem(s) in the action catalog.
  [duplicate_action_name] action "dupe": two actions share this name, so an agent calling it cannot address either one unambiguously. Fix: rename one of them.
  [schema_not_emittable] action "noHatch": its validator "valibot" does not implement Standard JSON Schema, so no schema can be derived. Supply an explicit `jsonSchema` on the action. Fix: supply an explicit `jsonSchema` on the action, or switch to a validator that implements Standard JSON Schema — zod 4.2+ and arktype 2.1.28+ do; valibot 1.4.2 does not.
  [schema_root_not_object] action "duUnion": the JSON Schema emitted by "zod" has no root `type` at all (keys: $schema, oneOf). … Fix: wrap the schema in an object, or move the union inside a property.
  [schema_root_not_object] action "stringRoot": the JSON Schema emitted by "zod" has root type "string", not "object". … Fix: wrap the schema in an object, or move the union inside a property.
  [redaction_missing] action "needsRedact": its schema accepts arguments but it declares no `redact` policy, so nothing states whether those arguments may reach telemetry. Fix: add `redact: "drop"` to the declaration, or a projection function if some arguments are safe to record.
  [schema_not_emittable] action "notASchema": its `schema` is not a Standard Schema validator … Fix: set `schema` to a validator instance from zod, arktype, valibot or another Standard Schema library …
  [schema_not_emittable] action "noSchemaField": its `schema` is not a Standard Schema validator …
```

Twenty bad declarations produce **20 issues across 20 distinct action names in one throw**, first
line `concierge: 20 problem(s) in the action catalog.` Every issue carries `action` and a non-empty
`fix` as **fields**, verified programmatically rather than by reading the string.

Diagnostics, non-blocking, on a catalog that still built with 4 entries:

| code | action |
|---|---|
| `destructive_without_consent` | `wipe` |
| `reads_untrusted_without_consent` | `readMail` |
| `destructive_without_consent` | `both` |
| `reads_untrusted_without_consent` | `both` |

The action carrying a `consent` policy produced none. Filtering
`reads_untrusted_without_consent` alone returns `["readMail","both"]` — SC-3b's "same shape,
distinct code" is what makes that possible. The default sink printed through `warnHost`, and a
throwing `onDiagnostic` propagated uncaught (`fatal in consumer build: destructive_without_consent`),
which is T-03-17's accepted disposition working as designed.

## The SEC-01 reading, stated plainly enough to disagree with

SEC-01 reads: *"Redaction is required for any action with a non-empty schema and defaults to
`drop`."* Two clauses that appear to contradict — a hard requirement and a default cannot both
govern one declaration, because whichever applies makes the other unreachable.

**The reading taken here is that the scope clause reconciles them.** The *requirement* is scoped to
non-empty schemas; the *default* covers everything outside that scope. Therefore:

- **non-empty schema, no `redact`** → a build-failing `redaction_missing` issue naming the action.
  There are arguments, only the author can know whether they are safe to record, and "required at
  declaration time" is what makes them answer.
- **empty schema, no `redact`** → resolves to `"drop"`, no issue, no diagnostic. There are no
  arguments to leak, so failing the build would be pure noise on the commonest declaration there is.

Neither branch ever resolves to `"passthrough"`, so ROADMAP SC-4 holds in both.

**The competing reading, and why it was rejected.** A reviewer may read the scope clause as
decoration on a universal requirement, making *every* missing `redact` a build failure. That is
defensible and strictly stricter. It is rejected only because it makes "defaults to `drop`" dead
text — nothing would ever reach the default. If the project prefers the stricter rule, the change is
one branch in `buildCatalog` and the `hasDeclaredParameters` helper becomes unused; it is not a
redesign. Stating it here so the disagreement can be had directly rather than reverse-engineered
from behaviour. The same paragraph is in the shipped doc comment.

## Hand-off to Phase 6: `byName` is the frozen null-prototype record

ROADMAP Phase 6's note has already been amended and this summary confirms it against measurement.

- **A frozen `Map` is not frozen.** `Object.freeze` seals a `Map`'s own properties and does nothing
  to `[[MapData]]`; `frozenMap.set(name, evilEntry)` succeeded in the probe. A `Map` therefore
  **cannot** satisfy SEC-03 — page script could replace an entry through the lookup with the entries
  array correctly frozen.
- **`Object.create(null)` removes the prototype chain**, which is the protection the Phase 6 note
  was reaching for with `dispatch("__proto__")` and `dispatch("constructor")`. Both resolve to
  `undefined` on the shipped record.
- **`catalog.byName` is the frozen one.** If Phase 6's handler lookup reads it, it already has both
  properties and must **not** be converted to a `Map`. If Phase 6 keeps a *separate mutable* lookup,
  that one may be a `Map` — it is neither frozen nor part of the catalog. A `Map` remains right for
  the dedup map, the timer map and the consent map, all allocated lazily on first dispatch.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] The `schema` guard rejected every arktype action in existence**

- **Found during:** Task 2, first end-to-end probe run — the happy path itself failed.
- **Issue:** `hasStandardSchema` (the DX-03 hardening) opened with
  `if (typeof schema !== "object" || schema === null) return false`. **An arktype validator instance
  is a `function`**, not an object: `type({id: "string"})` returns a callable carrying `~standard` as
  a property. Measured — `typeof` is `function` for arktype, `object` for zod and valibot. The guard
  compiled, typechecked, and reported
  `action "openItem": its \`schema\` is not a Standard Schema validator` for a perfectly valid
  arktype action. `hasJsonSchemaConverter` in `json-schema.ts` never hit this because it reads
  `schema["~standard"]` without testing `schema` itself — this guard exists precisely to make that
  read safe, so it is the one place the distinction bites.
- **Fix:** `(typeof schema !== "object" && typeof schema !== "function") || schema === null`. The
  measurement and the reason are in the shipped doc comment, because the next person to tighten this
  guard will reach for the object-only form again.
- **Consequence noticed and documented:** an arktype validator never needs an entry in `deepFreeze`'s
  `skip` set, because the walk's own `typeof !== "object"` guard already excludes functions. Only
  object-shaped validators are added.
- **Commit:** `2b2017b`

**2. [Rule 1 — Bug] The error message printed the action name twice and the remedy twice**

- **Found during:** Task 2 probe.
- **Issue:** `SchemaEmission.detail` is authored in `json-schema.ts` as a **complete standalone
  sentence** — it opens `action "X": ` and closes with a remedy. Dropped verbatim into
  `CatalogIssue.problem`, which already has an `action` field and whose formatter already prints
  `action "name": `, the output read:
  `[schema_not_emittable] action "noHatch": action "noHatch": … Supply an explicit \`jsonSchema\` on the action. Fix: supply an explicit \`jsonSchema\` on the action.`
  DX-03 makes the message the product; this reads like a bug in the tool.
- **Fix:** a module-private `withoutActionPrefix(detail, name)` that reconstructs the opener from
  `name` and strips it only on an exact match — so it can never remove anything it did not assemble
  itself, and its failure mode is a no-op rather than a truncated diagnosis. The trailing remedy is
  deliberately **not** stripped: it has no reliable boundary, and a heuristic that guessed wrong
  would silently delete the vendor-specific diagnosis, which is the part only `json-schema.ts` can
  produce. Instead the `fix` field was rewritten to *add* to that remedy rather than restate it
  (naming which validators do and do not implement Standard JSON Schema).
- **Commit:** `2b2017b`

**3. [Rule 2 — Missing critical functionality] The DX-03 `vendorOf` gap 03-02 handed forward**

- **Found during:** Task 2, as scoped by 03-02's own hand-off.
- **Issue:** `emitSchema` calls `vendorOf(action.schema)` on its first line, and `vendorOf` is the
  plain documented read `schema["~standard"].vendor`. A JavaScript consumer whose `schema` is
  missing, `null`, or a plain object got a **raw `TypeError`** — no action name, no fix. 03-02's
  threat model covers the `jsonSchema` escape hatch rather than `schema`, so it correctly declined to
  harden out of scope and named `buildCatalog` as the owner.
- **Fix:** `hasStandardSchema` runs before `emitSchema` and produces a `schema_not_emittable` issue
  naming the action, with a fix that names the actual mistake (passing the inferred *type* rather
  than the validator instance). No new issue code was added — the four the plan pins are unchanged.
  `vendor` is omitted on this issue, because being unable to name the vendor is the whole problem.
- **Commit:** `2b2017b`

### Design findings that changed a decision

**The `{...action}` spread invokes accessors — and that is why it is the right copy.**

The plan's threat model (T-03-13) says `deepFreeze` must never read through an accessor, and it does
not. But the probe showed a getter on a declaration running anyway, during the normalized copy —
`{...action}` reads every own enumerable property. Measured: the getter runs **once**.

Investigating the alternative made the current form clearly correct rather than merely acceptable.
`Object.getOwnPropertyDescriptors` + `defineProperties` would *preserve* the accessor instead of
invoking it — and `Object.freeze` does **not** stop an accessor returning a different value on each
read. A getter-backed `handler` would therefore remain swappable on a fully frozen catalog, which is
SEC-03's exact failure. Measured on the shipped form:

```
getter reads during build       : 1
copy has a DATA property        : true  (get: undefined)
frozen                          : true
handler stable across reads     : true   — and it is the first (good) one
nested getter ran in deepFreeze : false
```

So the spread is what converts every accessor into a fixed data property the freeze can hold down,
and `deepFreeze`'s accessor skip covers what the spread does not flatten — `effects`, `consent`,
`parameters` and anything below them. Both halves are now in the shipped doc comments. T-03-13's
mitigation is intact; its *scope* was narrower than the sentence implied.

### Divergence from the plan text, recorded rather than reconciled

- The plan writes the SEC-01 presence tests informally ("`propertyNames` is present"). They are
  implemented with **`Object.hasOwn`**, not `!== undefined`, because "present" is the literal
  requirement and `Object.hasOwn` is the only spelling that is also prototype-pollution-safe
  (T-03-14). `Object.hasOwn` was confirmed type-visible under `lib: ["ES2022"]`.
- The plan sketches `action.redact === undefined` and `action.redact ?? "drop"`. Neither compiles:
  `redact` is **non-optional** on `ActionDefinition`, so the first is **TS2367** ("no overlap") and
  the second is **TS2869** ("right operand unreachable"). Both are the checker correctly describing
  the TypeScript surface — and the entire population SEC-01's runtime half exists for is JavaScript
  consumers who omitted the field the type says they cannot omit. A module-private
  `declaredRedaction(action): unknown` reads it through the `PropertyBag` view instead.

## Deferred / handed onward

- **Phase 4 — `catalogFor` must re-freeze.** `frozenArray.filter(...)` returns a new **unfrozen**
  array (measured, `Object.isFrozen` is `false`). Written into the `deepFreeze` doc comment as well
  as here, because Phase 4 reads the source.
- **Phase 4 — `JsonSchemaObject.additionalProperties` is declared `boolean` and reality is wider.**
  `z.record` emits a schema *object* there. `types.ts` was deliberately not amended (03-CONTEXT
  forbids it this phase). Until it is, anything reading that member through the declared type is
  reading a lie; `catalog.ts` reads it through a `PropertyBag`.
- **Phase 4 / `json-schema.ts` — `SchemaEmission` wants a `{diagnosis, remedy}` split.** `detail`
  being one complete sentence is what forced `withoutActionPrefix` to exist and what leaves a mild
  remedy echo on emission failures. The structural repair is a `json-schema.ts` change and that file
  is not in this plan's `files_modified`. Noted at the helper.
- **`buildCatalog` still throws a raw `TypeError` on a non-object array element** (`null`, a string).
  A structured issue needs an action *name* to report and that shape has none; inventing a sentinel
  would pollute the `action` field DX-03 tests assert on. Stated in the shipped doc comment.
- **`types.ts:844`, `:873-878` and `:975-984` are now partly stale.** `:975-984` says of
  `readsUntrusted` that "nothing else reads it" and "until that lands, setting this to `true` changes
  no behaviour" — SEC-05 has now landed and both sentences are false. `types.ts` is **not** in this
  plan's `files_modified` (03-08 owns it, alongside the three stale M9 claims at `:505-506`), so it
  was left byte-identical. **03-08 should fix all four in one pass.**
- **`types.ts`'s three `Object.freeze(...)` calls still lack `/* @__PURE__ */`.** 03-CONTEXT records
  ~205 B of dead calls retained in every consumer bundle once `assertSingleInstance` keeps the module
  alive. That is now *more* relevant, because this plan gave the guard a real call site — but it
  becomes measurable only when 03-04 exports `buildCatalog` through the barrel. Same owner: **03-08**.
- **Nothing is exported through `src/index.ts`.** Plan 03-04 owns the barrel. Nine names are waiting:
  `buildCatalog`, `CatalogValidationError`, `Catalog`, `CatalogEntry`, `CatalogIssue`,
  `CatalogIssueCode`, `CatalogDiagnostic`, `CatalogDiagnosticCode`, `BuildCatalogOptions`.
  `warnHost` is internal and should **not** be exported. `attw` and `publint` are blind to a missing
  export; only `typecheck` and the export-surface suite catch it.

## Known Stubs

None. Every rule, both diagnostics, the aggregate throw, the recursive freeze and the single-instance
call are fully implemented and were exercised end-to-end against real zod, arktype and valibot
instances.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern and no schema change
at a trust boundary beyond the five its own threat model registers. It installs nothing — no
package-manager operation occurred (T-03-SC).

All ten `mitigate` dispositions were implemented and measured: T-03-11 (recursive freeze), T-03-12
(frozen null-prototype `byName`), T-03-13 (accessor skip — scope clarified above), T-03-14
(`Reflect.ownKeys` / `Object.keys` / `Object.hasOwn` / `{...action}` / `Object.create(null)`, no
`for...in` anywhere, asserted absent), T-03-15 (SEC-01 fails closed in both branches), T-03-16
(SEC-05 diagnostic + hook), T-03-18 (`assertSingleInstance` on the first line, proved firing),
T-03-19 (the error message carries names, codes, vendors and fixed prose only). T-03-17 is
**accept** and the sink is deliberately unwrapped, verified by a throwing hook propagating.

## Requirements Satisfied

- **CAT-01** — literal name union derived through the `const` type parameter; proved, and proved to
  collapse to `string` without it.
- **CAT-02 / CAT-06** — consumed from `json-schema.ts` and mapped onto two distinct issue codes.
- **CAT-05** — `destructive_without_consent`, one diagnostic per action, non-blocking.
- **SEC-01** — runtime half; both branches fail closed, neither ever yields `"passthrough"`.
- **SEC-03** — closed here rather than Phase 4, recursively; array, records, nested `effects` /
  `consent` / `parameters`, and the `byName` lookup are all un-replaceable.
- **SEC-05** — `reads_untrusted_without_consent` under its own code, filterable independently.
- **DX-03** — `{action, fix}` as structured fields on every issue and every diagnostic; plus the
  `vendorOf` crash 03-02 handed forward.
- **PKG-04** — first production call site, on a path that survives bundling.

## Self-Check: PASSED

Files verified present on disk in the worktree:

- `packages/concierge/src/host.ts` — FOUND
- `packages/concierge/src/catalog.ts` — FOUND
- `packages/concierge/src/contract.ts` — FOUND (modified)

Commits verified in `git log`:

- `1be2d9c` — FOUND
- `2b2017b` — FOUND
- `f4d297a` — FOUND

Scratch probes were written under `packages/concierge/.cache/` (gitignored) and removed;
`git status --porcelain` is empty.
