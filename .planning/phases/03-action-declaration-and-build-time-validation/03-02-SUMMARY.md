---
phase: 03-action-declaration-and-build-time-validation
plan: 02
subsystem: core
tags: [json-schema, standard-schema, cat-02, cat-06, dx-03, fixtures, validators]
requires: []
provides:
  - "src/json-schema.ts — JsonSchemaTarget, JsonSchemaConverterOptions, JsonSchemaConverter, JSON_SCHEMA_TARGET, hasJsonSchemaConverter, vendorOf, SchemaEmission, emitSchema"
  - "The locked three-branch emission order with source: 'explicit' | 'derived' making it provable"
  - "A root-type check that runs on BOTH the derived and the escape-hatch path and distinguishes an absent root type from a wrong one"
  - "test/fixtures/schemas.ts — twelve real-validator and dependency-free fixtures, every emitted root measured"
  - "zodRecord, the SEC-01 emptiness-heuristic fixture consumed by plan 03-06"
  - "test-d/json-schema.test-d.ts — the literal pin on JSON_SCHEMA_TARGET plus the converter contract, both mutation-proved"
  - "zod@4.4.3, arktype@2.2.3, valibot@1.4.2 as exact devDependency pins"
affects:
  - "plan 03-03 (catalog.ts) — consumes SchemaEmission and owns the corrected emptiness test that zodRecord exists to prove"
  - "plan 03-04 (barrel) — owns exporting these symbols through src/index.ts; this plan exports nothing through it"
  - "plan 03-06 — owns the SEC-01 record-shape case"
tech-stack:
  added:
    - "zod@4.4.3 (devDependency, exact)"
    - "arktype@2.2.3 (devDependency, exact)"
    - "valibot@1.4.2 (devDependency, exact)"
  patterns:
    - "Third-party shapes declared structurally in core rather than imported (AbortSignalLike precedent)"
    - "Unannotated const so the literal survives into the emitted .d.ts (types.ts:279 precedent)"
    - "User-defined type predicate over an unknown-typed local, no `any` (the package's first)"
    - "Object.keys, never for...in, when listing keys of a schema core did not author"
key-files:
  created:
    - packages/concierge/src/json-schema.ts
    - packages/concierge/test/fixtures/schemas.ts
    - packages/concierge/test-d/json-schema.test-d.ts
  modified:
    - packages/concierge/package.json
    - pnpm-lock.yaml
decisions:
  - "JSON_SCHEMA_TARGET left UNANNOTATED against RESEARCH's sketch — the alias contains (string & {}), so an annotation widens the emitted .d.ts to string, not to a three-member union"
  - "Root check made a type predicate (hasObjectRoot) so the file reaches JsonSchemaObject with no cast anywhere"
  - "Added describeCause: String(cause) throws on a null-prototype value, which would have let a throw escape the try that T-03-07 says contains it"
  - "describeRoot reports non-string root types by typeof rather than String()/JSON.stringify(), both of which can throw"
  - "Dropped RESEARCH's two valibot rows from the in-source table rather than repeating them unverified — they came from @valibot/to-json-schema, which this repo deliberately does not install"
  - "vendorOf left as the plain documented read; malformed-schema hardening flagged to plan 03-03 rather than added out of scope"
metrics:
  duration: "~50 min"
  completed: 2026-07-29
  tasks: 3
  commits: 4
  files_changed: 5
---

# Phase 3 Plan 02: JSON Schema Emission and Validator Fixtures Summary

The schema-emission half of the phase: core now declares the Standard JSON Schema converter
structurally, narrows to it without `any`, and emits in the locked order — explicit `jsonSchema`,
then `~standard.jsonSchema.input({target})`, then a failure naming the action and the vendor — with
three real validators installed so CAT-02's trap and CAT-06's negative case are reproduced rather
than self-asserted.

## What Shipped

| Artifact | Lines | What it carries |
|---|---|---|
| `packages/concierge/src/json-schema.ts` | 415 | The eight exports, the three-branch emission, the root check, and both measured tables as doc comments |
| `packages/concierge/test/fixtures/schemas.ts` | 267 | Twelve fixtures, each emitted root measured and recorded in the header |
| `packages/concierge/test-d/json-schema.test-d.ts` | 83 | Five predicates; two mutation-proved |

## Commits

| Hash | Type | What |
|---|---|---|
| `bab290e` | feat | `src/json-schema.ts` — converter types, narrowing predicate, ordered emission |
| `2d7ec56` | test | Three exact validator pins + `test/fixtures/schemas.ts` |
| `049148f` | docs | Corrected the in-source root-shape table against re-measurement |
| `f71c842` | test | `test-d/json-schema.test-d.ts` — the literal pin and the converter contract |

## PKG-05 byte counts — before and after the install

Required by the plan: the zero-runtime-bytes probe must not move.

| | Before install | After install |
|---|---|---|
| Runtime dependency bytes | **0** (`@standard-schema/spec` 0 bytes) | **0** (`@standard-schema/spec` 0 bytes) |
| Modules in built graph | **1** | **1** |
| Vendored modules | `[]` | `[]` |
| Unbundled external imports | `[]` | `[]` |
| `pnpm check:deps` exit | 0 | 0 |

**Unchanged.** No validator leaked into the bundle. The three additions are `devDependencies` and
`src/json-schema.ts` is not yet reachable from the barrel (plan 03-04 owns that), so it is not in the
built artifact at all.

## Measured emitted roots — every fixture

Run against the installed packages at `target: "draft-2020-12"`, via the real `emitSchema`.

| Fixture | `emitSchema` result | Emitted root keys, in order |
|---|---|---|
| `zodObject` | ok, `source: "derived"` | `$schema, type, properties, required` |
| `zodEmptyObject` | ok, `source: "derived"` | `$schema, type, properties` (`properties` is `{}`) |
| `zodWithDefault` | ok, `source: "derived"` | `$schema, type, properties, required` |
| `zodRecord` | ok, `source: "derived"` | `$schema, type, propertyNames, additionalProperties` — **no `properties`** |
| `arktypeObject` | ok, `source: "derived"` | `$schema, type, properties, required` |
| `arktypeEmptyObject` | ok, `source: "derived"` | `$schema, type` — **no `properties`** |
| `zodDiscriminatedUnion` | fail, `root_not_object`, vendor `zod` | `$schema, oneOf` — **no `type`** |
| `zodStringRoot` | fail, `root_not_object`, vendor `zod` | `$schema, type` where `type` is `"string"` |
| `valibotObject` | fail, `not_emittable`, vendor `valibot` | no converter at all |
| `probeSchema` | fail, `not_emittable`, vendor `probe` | no converter at all |
| `probeSchemaThatThrows` | fail, `threw`, vendor `probe-throws` | detail carries `Error: probe: refusing to emit` |
| `valibotEscapeHatchSchema` | ok, `source: "explicit"` | `type, properties, required, additionalProperties` |

`valibotObject["~standard"]` keys measured as exactly `["version","vendor","validate"]` — **no
`jsonSchema`**, confirming CAT-06's reason to exist against valibot 1.4.2.

### Divergences from RESEARCH — recorded, not reconciled

**1. `$schema` is present on every emission and is the FIRST key.**
`03-RESEARCH.md:612-635` writes the passing rows as `{type:"object", properties, required}` and shows
`$schema` only on the failing rows. Measured, every zod and arktype emission at `draft-2020-12`
carries `$schema` first. RESEARCH is correct about *what fails*; it is incomplete about the key list.
This is not cosmetic: `describeRoot` prints `Object.keys(emitted)` into the developer-facing
diagnostic, so `z.string()` reports `keys: $schema, type`, not `keys: type`. The in-source table was
corrected in `049148f` and the fixture header records the divergence.

**2. `arktype type({})` emits no `properties` key; `z.object({})` emits `properties: {}`.**
RESEARCH predicted this and it reproduced exactly. Worth restating because it means `zodRecord` is
not the only shape that passes CAT-02 with no `properties` — the two emitting vendors disagree about
how to spell "no members", so plan 03-03's emptiness test must tolerate the key's absence on an
otherwise perfectly ordinary empty object, not only on a record.

**3. `z.record` confirmed as the SEC-01 trap.**
`z.record(z.string(), z.string())` emits `{$schema, type:"object", propertyNames, additionalProperties}`
— passes the root check, carries **no `properties`**. A naive
`Object.keys(properties ?? {}).length > 0` emptiness test classifies the most redaction-sensitive
shape there is (arbitrary caller-supplied keys *and* values) as EMPTY and silently defaults it to
`"drop"` instead of making the author choose. **Plan 03-06 consumes this fixture; plan 03-03 owns the
corrected test.**

**4. Two RESEARCH rows dropped rather than repeated.**
RESEARCH's table carries `valibot v.union → hatch` and `valibot v.variant → hatch`. Those were
produced with `@valibot/to-json-schema`, which this plan deliberately does not install. Rather than
carry unverified rows in a file whose header claims everything in it was measured, they were removed
and the removal is stated in the table's own note. `arktype .or(...)` was measured directly and kept:
`{$schema, anyOf}`, no root `type`.

Everything else in RESEARCH reproduced exactly: bare `.input()` works on zod and throws
`TypeError: Cannot read properties of undefined (reading 'target')` on arktype; arktype throws
`ParseError` on `openapi-3.0`, `draft-04` and a nonsense target while zod silently emits for all
three (and silently drops `$schema` for `openapi-3.0` and the nonsense target).

### `.input()` vs `.output()` — the M-03-5 divergence, measured

On `zodWithDefault`:

```
.input()  -> required: ["key"]
.output() -> required: ["key","limit"], plus additionalProperties: false
```

And on a schema carrying a transform, `.output()` throws
`Error: Transforms cannot be represented in JSON Schema`. The `zodWithDefault` fixture is therefore
load-bearing: without a `.default()` anywhere in the fixture set the two projections agree on every
schema present and mutant M-03-5 escapes green.

## Mutation proofs

Both run with `pnpm --config.verify-deps-before-run=false` as the plan requires — the install
rewrote `pnpm-lock.yaml`, and `CI=true`/`--frozen-lockfile` would have produced a vacuously-green
PASS.

| Target | Pattern → replacement | Occurrences | Harness | Gate exit | Predicate turned red |
|---|---|---|---|---|---|
| `src/json-schema.ts` | `export const JSON_SCHEMA_TARGET = "draft-2020-12";` → `export const JSON_SCHEMA_TARGET: JsonSchemaTarget = "draft-2020-12";` | 1 | **0 (PASS)** | **1** | `_targetDefaultIsTheLiteral`, TS2344 at `test-d/json-schema.test-d.ts(59,42)` |
| `src/json-schema.ts` | `readonly target: JsonSchemaTarget;` → `readonly target?: JsonSchemaTarget \| undefined;` | 1 | **0 (PASS)** | **1** | `_converterOptionsTargetIsRequired`, TS2344 at `test-d/json-schema.test-d.ts(69,49)` |

**Observed gate exit code is 1, not 2.** `scripts/mutate-and-prove.sh:32` states "tsc exits 2 on
diagnostics". Under TypeScript 7.0.2 driven through `pnpm --filter … typecheck`, the observed exit is
**1** in both runs. The comment is stale; the script's own PASS logic (`RC -ne 0`) is unaffected. The
plan predicted this and it is confirmed.

`git diff --exit-code -- packages/concierge/src/json-schema.ts` exits 0 after both mutants — the tree
is provably restored.

## Verification

| Gate | Exit | Note |
|---|---|---|
| `pnpm typecheck` | 0 | |
| `pnpm build` | 0 | attw and publint clean |
| `pnpm test` | 0 | **4 files / 15 tests** — unchanged, this plan adds no test file |
| `pnpm check:deps` | 0 | 0 bytes, 1 module — unchanged from baseline |
| `pnpm check:artifact` | 0 | |
| `git status --porcelain` | clean | only this plan's intended paths were ever touched |

### Task 1 acceptance greps (comment lines filtered)

| Check | Required | Observed |
|---|---|---|
| `: any` | 0 | **0** |
| `.output(` | 0 | **0** |
| `.input(` | exactly 1 | **1** |
| `JSON_SCHEMA_TARGET:` | 0 | **0** (unannotated) |
| `StandardJSONSchemaV1` | 0 | **0** (declared structurally) |
| `for (… in …)` | absent | **absent** |
| `try` / `catch` around `.input(` | present | **present** |
| min lines | 130 | **415** |

### Task 3 acceptance greps

| Check | Required | Observed |
|---|---|---|
| `ts-expect-error` | 0 | **0** |
| `^export` | 0 | **0** |

### Package pins

`packages/concierge/package.json` `devDependencies` is exactly
`{"arktype":"2.2.3","valibot":"1.4.2","zod":"4.4.3"}` — no carets, no fourth package.
`sideEffects: false` unchanged; `dependencies` still exactly `@standard-schema/spec`.
No legitimacy checkpoint was required: all three are RESEARCH-verified `[OK]` by slopcheck with no
install scripts, at versions `CLAUDE.md`'s technology stack already names. `@valibot/to-json-schema`
was declined.

## must_haves — all five truths verified end-to-end

Each was exercised against the real `emitSchema` with real validators, not asserted:

1. **Explicit `jsonSchema` beats derivation** — the hatch won even on a zod action that *can* emit,
   returning `source: "explicit"` with `parameters` identical by reference to the hatch object. This
   is what makes the order provable rather than incidental.
2. **A Standard-JSON-Schema validator derives via INPUT** — zod and arktype both returned
   `source: "derived"`.
3. **A validator without the converter fails naming the vendor** — valibot returned
   `not_emittable`, `vendor: "valibot"`.
4. **A validator that throws fails naming the vendor and the thrown text** — `probe-throws` returned
   `threw` with `Error: probe: refusing to emit` in the detail.
5. **A non-object root fails, distinguishing the two shapes** —
   `has no root \`type\` at all (keys: $schema, oneOf)` versus
   `has root type "string", not "object"`.

The root check also fires on the escape-hatch path: a JavaScript consumer passing `{type:"string"}`
through `jsonSchema` gets `root_not_object` with a message naming the hatch, not the vendor's emitter.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 2 — missing critical functionality] `String(cause)` could escape the `try` that contains it**

- **Found during:** Task 1
- **Issue:** The plan and RESEARCH both specify `String(cause)` in the `reason: "threw"` detail.
  `String()` throws `TypeError: Cannot convert object to primitive value` on a null-prototype value,
  and on any object whose `toString` throws. A validator throwing such a value would escape the
  `try`/`catch` through the handler written to contain it — defeating T-03-07's stated mitigation
  ("never an unhandled module-init crash") on the exact path it governs.
- **Fix:** Added a module-private `describeCause(cause: unknown): string` that wraps `String(cause)`
  in its own `try`/`catch` and falls back to a fixed sentence. Same reasoning applied to
  `describeRoot`, which reports a non-string root `type` by its `typeof` rather than via `String()`
  or `JSON.stringify()` — the latter throws on a BigInt and on a cycle.
- **Files modified:** `packages/concierge/src/json-schema.ts`
- **Commit:** `bab290e`

**2. [Rule 1 — bug] The in-source root-shape table understated the emitted key list**

- **Found during:** Task 2 measurement
- **Issue:** The table written in Task 1 was carried from RESEARCH, which omits `$schema` from the
  passing rows. Measured, it is present on every row and is the first key. Left uncorrected, the
  table would contradict the diagnostics the same file produces.
- **Fix:** Table rewritten from the measurement, empty-object rows added, unverifiable valibot rows
  dropped with a stated reason.
- **Files modified:** `packages/concierge/src/json-schema.ts`
- **Commit:** `049148f` (kept separate from the Task 2 commit so each stays inside its declared file
  list)

### Design choices that depart from RESEARCH's sketch

**`JSON_SCHEMA_TARGET` is unannotated.** RESEARCH writes
`export const JSON_SCHEMA_TARGET: JsonSchemaTarget = "draft-2020-12"`. The plan already flagged this
and the flag is correct: because `JsonSchemaTarget` contains `(string & {})`, the annotation widens
the emitted declaration to `string` — worse than the `: number` case `types.ts:279` was written for.
Mutation-proved above.

**The root check is a type predicate.** `hasObjectRoot(emitted): emitted is JsonSchemaObject` gets
from an untyped emission to `JsonSchemaObject` with **no type assertion anywhere in the file** —
including no `as unknown as` double cast of the kind `contract.ts:146` needs.

## Deferred / handed onward

- **`vendorOf` is not defensive against a malformed `schema`.** It is the plain read the plan
  specifies, `schema["~standard"].vendor`. A JavaScript consumer passing an action whose `schema`
  lacks `~standard` gets a raw `TypeError` rather than a named catalog issue. This boundary is not in
  this plan's threat model (which lists the `jsonSchema` escape hatch, not `schema`), so it was not
  hardened here. **Flagged to plan 03-03**, which owns `buildCatalog` and is the natural place for a
  declaration-shape check.
- **Nothing is exported through `src/index.ts`.** Plan 03-04 owns the barrel, as instructed. The
  consequence is that `JSON_SCHEMA_TARGET`'s literal is currently pinned only against
  `src/json-schema.ts`; the shipped-`.d.ts` half of that guarantee arrives when the barrel does.
- **`test/fixtures/schemas.ts` is in no TypeScript program.** Stated in its own header. A type error
  there surfaces only as a runtime failure under `vitest run`, and no test file imports it yet —
  plans 03-03 and 03-06 are its first consumers.

## Known Stubs

None. Every export is fully implemented and exercised end-to-end against real validators.

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or schema change at a trust boundary
beyond the four the plan's own threat model already registers. The three npm additions are covered by
T-03-SC and were installed at the audited exact versions.

## Self-Check: PASSED

Files verified present on disk:

- `packages/concierge/src/json-schema.ts` — FOUND
- `packages/concierge/test/fixtures/schemas.ts` — FOUND
- `packages/concierge/test-d/json-schema.test-d.ts` — FOUND

Commits verified in `git log`:

- `bab290e` — FOUND
- `2d7ec56` — FOUND
- `049148f` — FOUND
- `f71c842` — FOUND
