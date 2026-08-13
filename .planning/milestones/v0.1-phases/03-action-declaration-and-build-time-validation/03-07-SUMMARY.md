---
phase: 03-action-declaration-and-build-time-validation
plan: 07
subsystem: core
tags: [testing, cat-02, cat-06, dx-03, json-schema, validators, mutation-proof]
requires:
  - "packages/concierge/src/json-schema.ts (emitSchema, the locked three-branch order) — plan 03-02"
  - "packages/concierge/test/fixtures/schemas.ts (the twelve real-validator fixtures) — plan 03-02"
  - "packages/concierge/src/catalog.ts (buildCatalog, CatalogValidationError) — plan 03-03"
  - "packages/concierge/src/index.ts (the barrel that makes all three reachable from dist) — plan 03-04"
provides:
  - "test/emission.test.ts — 13 runtime cases proving CAT-02 and CAT-06 against zod 4.4.3, arktype 2.2.3 and valibot 1.4.2"
  - "The measured input/output projection divergence, pinned as an assertion rather than a comment"
  - "A distinguishable escape hatch, so the emission ORDER is observable rather than incidental"
  - "Four mutation proofs (M-03-4, M-03-5, M-03-6, M-03-10), all fired"
  - "The finding that the plan's bare /valibot/ message assertion is nearly vacuous, recorded as an executable case"
affects:
  - "plan 03-06 (catalog.test.ts) — shares the fixture module; zodRecord and the empty-shape cases are 03-06's, deliberately not touched here"
  - "plan 03-08 — the SchemaEmission {diagnosis, remedy} split 03-03 handed forward would change the `fix` string this plan measured as vendor-unspecific"
  - "Phase 4 — any change to emitSchema's branch order or projection now has four mutants watching it"
tech-stack:
  added: []
  patterns:
    - "A mutation-proof table written INTO the test file, mapping each mutant to the cases it turns red"
    - "Recording a weak assertion's weakness as an executable case rather than as a comment"
    - "Asserting a hatch and a derivation apart by two independent properties, in opposite directions"
key-files:
  created:
    - packages/concierge/test/emission.test.ts
  modified: []
decisions:
  - "Added a 13th case (case 5) proving the plan's own /valibot/ message assertion is nearly vacuous — the schema_not_emittable `fix` string names valibot unconditionally, so it matches on a `probe` failure too"
  - "Case 4 therefore pins the QUOTED form `its validator \"valibot\"` in addition to the bare regex the plan's acceptance criteria require"
  - "M-03-4 spelled as `explicit !== undefined && !hasJsonSchemaConverter(schema)` rather than a block swap — it is the exact semantics of 'derivation is preferred', and it leaves the valibot fallback working so the failure isolates to the ORDER case"
  - "zodRecord deliberately NOT imported — its root passes CAT-02, so it is 03-06's redaction case, not an emission case"
metrics:
  duration: "~35 min"
  completed: 2026-07-29
  tasks: 2
  commits: 3
  files_changed: 1
---

# Phase 3 Plan 07: Schema Emission Against Real Validators Summary

Thirteen runtime cases that drive the real `buildCatalog` over real zod, arktype and valibot
instances — proving that CAT-02's two failure shapes read differently, that CAT-06's escape hatch
*wins* rather than merely exists, and that the INPUT projection is the one that ships — with four
mutants proving each of those is load-bearing rather than incidental.

## What Shipped

| Artifact | Lines | What it carries |
|---|---|---|
| `packages/concierge/test/emission.test.ts` | 531 | 13 `it(` cases, both measured matrices, the deliberate non-coverage note, and the mutation-proof table |

## Commits

| Hash | Type | What |
|---|---|---|
| `1006275` | test | `test/emission.test.ts` — the 13 CAT-02 / CAT-06 cases |
| `a932c61` | test | The mutation-proof table written into the file's header |
| (final) | docs | This summary |

## Case numbering — the plan's numbers vs the file's

One case was added, so the numbering shifts from case 5 onward. Recorded because the plan's
acceptance criteria name specific numbers.

| Plan case | File case | Subject |
|---|---|---|
| 1 | 1 | `zodDiscriminatedUnion` — `schema_root_not_object`, message names `oneOf` |
| 2 | 2 | `zodStringRoot` — same code, names `"string"`, must NOT name `oneOf` |
| 3 | 3 | positive control — zod and arktype both build with root `"object"` |
| 4 | 4 | valibot, no hatch — `vendor` field AND the message |
| — | **5** | **NEW** — the bare `/valibot/` match is nearly vacuous, measured |
| 5 | 6 | valibot WITH hatch — builds, `parameters` equals the hatch |
| 6 | 7 | **THE ORDER** — a distinguishable hatch beats derivation |
| 7 | 8 | a hatch with a non-object root still fails CAT-02 |
| 8 | 9 | the INPUT projection |
| 9 | 10 | failure containment — a throwing validator yields an issue |
| 10 | 11 | aggregation across three vendors |
| 11 | 12 | `draft-07` is observable |
| 12 | (comment) | deliberate non-coverage of other targets |
| — | **13** | **NEW** — an option-less build uses the exported `JSON_SCHEMA_TARGET` |

## The measurements the plan required

### `.input()` vs `.output()` on `zodWithDefault` — measured this session

Run through the real converter at `draft-2020-12`, both directions:

```
.input()  -> required: ["key"]           , NO  additionalProperties
.output() -> required: ["key","limit"]   , additionalProperties: false
```

**Two independent discriminators, and both are asserted** because they can fail separately — a
converter change could move one without the other. `required` is the one the plan predicted and it
is real; `additionalProperties` is a second, free one that 03-02 also recorded.

**What is deliberately NOT asserted:** `properties.limit.default` is `10` on **both** projections.
An assertion on it would read like coverage of the direction claim and prove nothing about it. That
non-assertion is written into the file in the style of `export-surface.test.ts:31-46`.

Re-confirmed alongside: `.output()` throws `Error: Transforms cannot be represented in JSON Schema`
on any schema carrying a transform. So the wrong projection is not merely wrong — on some
declarations it does not exist at all.

### The distinguishing property of case 7's escape hatch

Measured, `zodObject` derives:

```
{ $schema, type:"object", properties:{key,value}, required:["key","value"] }
```

with **no `additionalProperties` and no `title`**. The hatch supplied in case 7 is:

```
{ type:"object", properties:{key,value}, required:["key","value"],
  additionalProperties:false, title:"hand-written-escape-hatch" }
```

**Two independent distinguishers, asserted in opposite directions:**

1. `parameters.title === "hand-written-escape-hatch"` — present only on the hatch.
2. `Object.hasOwn(parameters, "$schema") === false` — `$schema` is present on **every** derived
   emission and is its first key, so its absence is only producible by the hatch.

Asserting in both directions is what makes the case fail on *both* halves under a reversed order
rather than on neither. A same-valued hatch — which is what a zod action naturally produces — would
pass under either ordering, which is exactly the hole mutant M-03-4 exists to find.

### `draft-07` — yes, observable, and it is the `$schema` value

| Target | Emitted `$schema` |
|---|---|
| `draft-2020-12` (default) | `https://json-schema.org/draft/2020-12/schema` |
| `draft-07` | `http://json-schema.org/draft-07/schema#` |

Measured on `zodObject` and on `arktypeObject`: at this fixture the **only** difference between the
two dialects is the `$schema` value — `type`, `properties` and `required` are byte-identical. So
`$schema` is the whole observable difference and is what case 12 pins, in both directions.

This matters more than "the option is accepted" would suggest: zod defaults to `draft-2020-12` on a
bare `.input()` call, so an implementation that **dropped the `target` argument entirely** would
still emit a perfectly plausible schema. Only the `$schema` comparison can see that.

### The other roots, re-measured through the built artifact

| Fixture | Outcome | Emitted root keys / issue |
|---|---|---|
| `zodObject` | builds | `$schema, type, properties, required` |
| `arktypeObject` | builds | `$schema, type, properties, required` |
| `zodEmptyObject` | builds | `$schema, type, properties` (`{}`) |
| `arktypeEmptyObject` | builds | `$schema, type` — **no `properties`** |
| `zodRecord` | builds | `$schema, type, propertyNames, additionalProperties` |
| `zodWithDefault` | builds | `$schema, type, properties, required:["key"]` |
| `zodDiscriminatedUnion` | `schema_root_not_object`, vendor `zod` | `$schema, oneOf` — no `type` |
| `zodStringRoot` | `schema_root_not_object`, vendor `zod` | `$schema, type:"string"` |
| `valibotObject` | `schema_not_emittable`, vendor `valibot` | no converter |
| `probeSchema` | `schema_not_emittable`, vendor `probe` | no converter |
| `probeSchemaThatThrows` | `schema_not_emittable`, vendor `probe-throws` | `Error: probe: refusing to emit` |
| hatch `{type:"string"}` | `schema_root_not_object`, vendor `zod` | names the **hatch**, not the emitter |

Every row reproduced 03-02's measurement exactly. `$schema` is present and first on every emitting
row, confirming the RESEARCH divergence 03-02 recorded rather than reconciled.

`typeof` per vendor, re-confirmed: **`arktypeObject` is a `function`**; `zodObject` and
`valibotObject` are `object`. This is pinned as an assertion in case 3 rather than left as prose,
because it is the exact shape of the bug 03-03 caught only by running an arktype action end to end.

## Mutation proofs — all four fired

Every gate used the required form. `dist/` was rebuilt **inside** the gate (because `test/` reads
`dist/` and the harness mutates `src/`) and **again after every mutant** (because `dist/` is
gitignored, so neither `git status --porcelain` nor the harness's own "tree clean" line says
anything about it).

Gate command, identical for all four:

```
bash -c 'pnpm --config.verify-deps-before-run=false build && pnpm --config.verify-deps-before-run=false test emission'
```

| ID | Exact one-occurrence literal → replacement | Occ. | Harness exit | Gate exit | Cases turned RED |
|---|---|---|---|---|---|
| **M-03-4** | `if (explicit !== undefined) {` → `if (explicit !== undefined && !hasJsonSchemaConverter(schema)) {` | 1 | **0 (PASS)** | **1** | 7, 8 |
| **M-03-5** | `derived = schema["~standard"].jsonSchema.input({ target });` → `derived = schema["~standard"].jsonSchema.output({ target });` | 1 | **0 (PASS)** | **1** | **9 only** |
| **M-03-6** | `return emitted["type"] === "object";` → `return true;` | 1 | **0 (PASS)** | **1** | 1, 2, 8, 11 |
| **M-03-10** | `reason: "not_emittable",\n      vendor,` → `reason: "not_emittable",\n      vendor: "",` | 1 | **0 (PASS)** | **1** | 4, 5, 11 |

**Observed gate exit code is 1 in all four runs**, consistent with 03-02's finding that
`mutate-and-prove.sh:32`'s "tsc exits 2 on diagnostics" comment is stale. Here the gate is
`vitest`, which exits 1 on a failing suite, so the observation is expected rather than surprising —
recorded because the plan asked for every observed code.

`git diff --exit-code -- packages/concierge/src/json-schema.ts` exited **0 after every one of the
four**. `pnpm build` was re-run after each, and `pnpm test emission` re-confirmed green from the
restored artifact before the next mutant was applied.

### The literal-selection detail worth recording

**`.input(` occurs FOUR times in `src/json-schema.ts`, not once.** 03-02's summary records it as
occurring exactly once — that count was taken with **comment lines filtered**, and
`mutate-and-prove.sh` does not filter comments; it aborts with exit 3 on a pattern that matches
zero times and replaces only the first of several otherwise. The doc-comment target table on
`emitSchema` contains `.input()` three more times. The literal actually used is the full statement
`derived = schema["~standard"].jsonSchema.input({ target });`, verified at exactly 1 occurrence in
the whole file. `.jsonSchema.input({ target })` is **not** unique either — it occurs twice, the
second in the same doc comment. No mutant reported ABORT 3.

### Two findings the mutants produced

**1. M-03-5 is caught by exactly ONE case, and the positive control cannot help.**

Measured: `zodObject.output()` and `arktypeObject.output()` emit a root identical to their
`.input()` root apart from `additionalProperties: false`, and arktype's converter *has* a working
`output`. So case 3 stays green while the wrong projection ships to every agent. If case 9 is ever
deleted or loosened, nothing in this repository notices `.output(`. This is written into the test
file, next to case 9, because that is where someone would loosen it.

**2. M-03-4 leaves case 6 GREEN by design, and that is the reason case 7 has to exist.**

The mutant makes the hatch a *fallback* rather than a *preference* — derivation wins wherever it is
available. Valibot still cannot derive, so its hatch is still used and case 6 stays green. Only a
hatch on a validator that *could* have derived can see the order, and only if that hatch is
measurably different from what derivation produces. Case 6 alone would report the escape hatch as
fully working on a build where it never wins for any zod or arktype action.

## The finding that changed a case: the plan's `/valibot/` assertion is nearly vacuous

The plan's acceptance criteria require case 4 to assert both `issue.vendor === "valibot"` and a
`/valibot/` match on `err.message`. Both are present. But the message half proves far less than it
appears to, and the reason is structural rather than accidental:

**Every `schema_not_emittable` issue carries the same hardcoded `fix` string**, authored in
`catalog.ts`, and that string names valibot unconditionally — *"zod 4.2+ and arktype 2.1.28+ do;
valibot 1.4.2 does not"*. `CatalogValidationError` joins `problem` and `fix` into the message. So
`/valibot/` matches on a failure that has nothing to do with valibot.

Rather than assert it and move on, this is **measured in the suite** as case 5, against the
dependency-free `probe` fixture:

```
issue.vendor          -> "probe"
err.message           -> matches /valibot/          (the vacuous match)
err.message           -> matches /its validator "probe"/
err.message           -> does NOT match /its validator "valibot"/
```

Case 4 therefore also pins the **quoted** form, `its validator "valibot"`, which appears only where
`emitSchema` interpolated the vendor it actually read. Case 5 is not decoration: M-03-10 turns it
red too, because it asserts `issue.vendor === "probe"`.

The structural repair is 03-03's already-recorded hand-off — `SchemaEmission` wants a
`{diagnosis, remedy}` split, and the `fix` string wants to be vendor-derived rather than a constant.
That is a `json-schema.ts` / `catalog.ts` change and neither file is in this plan's
`files_modified`, so it is **flagged to 03-08 / Phase 4** rather than made here.

## Verification

| Gate | Exit | Note |
|---|---|---|
| `pnpm build` | 0 | attw and publint clean |
| `pnpm typecheck` | 0 | |
| `pnpm test` | 0 | **5 files / 32 tests** — was 4 files / 19 tests |
| `pnpm test emission` | 0 | bare form; **13 tests**. `pnpm test -- emission` does not filter |
| `git status --porcelain` | clean | |

### Task 1 acceptance

| Check | Required | Observed |
|---|---|---|
| `pnpm build && pnpm test emission` | exit 0 | **0** |
| full `pnpm test` file count | one more than before | **4 → 5 files, 19 → 32 tests** |
| `it(` cases | ≥ 12 | **13** |
| `grep -v '^[[:space:]]*//' … \| grep -c '\.\./src/'` | 0 | **0** |
| line count | ≥ 180 | **531** |
| imports `./fixtures/schemas.js` | present | **present** (Vite resolves the `.js` specifier to the `.ts` source) |
| case 4 asserts vendor field AND message | both | **both**, plus the quoted form |
| case 7's hatch measurably different | yes | **`title` present, `$schema` absent** |
| case 9 pins a measured projection difference | yes | **`required` and `additionalProperties`** |
| non-coverage of other targets written down | comment | **present in the header** |

### Task 2 acceptance

| Check | Required | Observed |
|---|---|---|
| all four mutants `PASS: gate fired` | 4 | **4** |
| harness exit per mutant | 0 | **0, 0, 0, 0** |
| `git diff --exit-code -- src/json-schema.ts` after each | 0 | **0, 0, 0, 0** |
| `pnpm build` re-run after each mutant | yes | **yes — 4 of 4, each followed by a green `pnpm test emission`** |
| final `pnpm build && pnpm typecheck && pnpm test` | all 0 | **all 0** |
| `git status --porcelain` | only `test/emission.test.ts` | **clean** (the file was already committed in Task 1) |

## Deviations from Plan

### Auto-fixed / strengthened

**1. [Rule 2 — missing critical functionality] The specified `/valibot/` message assertion would
have passed on a vendor-blind implementation**

- **Found during:** Task 1, while writing case 4.
- **Issue:** The `fix` string for every `schema_not_emittable` issue names valibot unconditionally,
  so the plan's specified `/valibot/` regex matches regardless of which vendor actually failed. As
  written it is close to a vacuously-passing guard — the exact class
  `export-surface.test.ts:31-46` exists to warn about, and T-03-36 (the vendor absent from the
  failure) would go unmitigated by the assertion nominally mitigating it.
- **Fix:** Kept the specified assertion (the acceptance criteria require it), added the quoted
  form `its validator "valibot"` which is genuinely discriminating, and added case 5 — an executable
  measurement of the weakness against the `probe` fixture, rather than a comment claiming it.
- **Files modified:** `packages/concierge/test/emission.test.ts`
- **Commit:** `1006275`

**2. [Rule 3 — blocking] A fresh worktree had no `node_modules`**

- **Found during:** setup, before Task 1.
- **Issue:** `pnpm build` and `pnpm test` both fail on a fresh worktree until dependencies are
  restored.
- **Fix:** `pnpm install --frozen-lockfile` — restores exactly the committed lockfile and installs
  **nothing new**, so T-03-SC is untouched (no package was added, resolved, or substituted;
  `pnpm-lock.yaml` is byte-identical afterwards, confirmed by `git status --porcelain`). The
  `--frozen-lockfile` warning in this phase's tooling notes applies to **mutant gates**, where it
  produces a vacuously-green PASS; for a one-time restore it is the strictly safer form because it
  cannot rewrite the lockfile.
- **Files modified:** none.

### Additions beyond the plan text

- **Case 13** (`an option-less build uses the exported JSON_SCHEMA_TARGET`). The literal is pinned
  at the type level in `test-d/json-schema.test-d.ts` and by name in `export-surface.test.ts`, and
  neither can see whether `buildCatalog` actually *uses* it. A default silently changed inside
  `buildCatalog`'s own body would leave both green while every consumer received a different dialect
  than the exported constant advertises. Needed to reach 12 `it(` cases; kept because it closes a
  real gap rather than because it was needed.
- **The mutation-proof table written into the test file** (`a932c61`), following 03-02's and 03-03's
  precedent of recording measured matrices in-source. The question "can I relax this assertion?" is
  asked by someone reading the test file, so that is where the answer lives.
- **`typeof arktypeObject === "function"` asserted in case 3.** 03-03's summary records this as the
  finding that broke the happy path and was caught only end to end. Nothing in the suite pinned it.
  It is one expectation inside the existing positive control, not a new case, so it does not encroach
  on 03-06's `catalog.test.ts` cases.

### Divergence from a recorded fact

- **`.input(` occurs 4 times in `src/json-schema.ts`, not 1.** 03-02's acceptance table records
  "exactly 1", measured with comment lines filtered. `mutate-and-prove.sh` does not filter comments.
  A plan reading that row and using `.input(` as M-03-5's pattern would have silently mutated the
  first occurrence — which is inside a doc comment — and reported a green suite as `FAIL: mutant
  escaped`. Recorded above with the literal that is genuinely unique.

## Deferred / handed onward

- **The `fix` string is vendor-unspecific.** Every `schema_not_emittable` issue asserts
  "valibot 1.4.2 does not" regardless of which validator failed. It is factually true and it is
  useful advice, but it makes any message-level vendor assertion weak, and on a `probe` or arktype
  failure it names a package the developer is not using. The repair is `catalog.ts` deriving the
  remedy from `emission.vendor`, which pairs naturally with 03-03's already-flagged
  `SchemaEmission → {diagnosis, remedy}` split. **Flagged to 03-08 / Phase 4** — neither file is in
  this plan's `files_modified`.
- **Targets outside `{draft-2020-12, draft-07}` are uncovered on purpose.** The two emitting vendors
  disagree there — zod silently emits for a typo'd target, arktype throws `ParseError` — so any
  cross-vendor assertion would encode one vendor's tolerance as Concierge's contract. Written into
  the file's header as a comment, not as a test.
- **`zodRecord`, `zodEmptyObject` and `arktypeEmptyObject` are emission-tested here only
  incidentally.** Their SEC-01 emptiness behaviour is plan 03-06's, and `zodRecord` is not even
  imported by this file. If 03-06's cases move, this file does not need to change.

## Known Stubs

None. Every case drives the real `buildCatalog` from the built artifact against real installed
validators. No mock, no hand-rolled schema standing in for a vendor's output, and no assertion that
passes vacuously — case 5 exists specifically to measure the one that came closest.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern and no schema change
at a trust boundary. It installs nothing: the only package-manager operation was
`pnpm install --frozen-lockfile` restoring the committed lockfile in a fresh worktree, which
resolves nothing new and leaves `pnpm-lock.yaml` byte-identical (T-03-SC).

All eight `mitigate` dispositions in this plan's threat model are implemented and measured:

| Threat | How it is now mitigated, and the proof |
|---|---|
| T-03-34 | Cases 1-3 against real emitters; **M-03-6 fired**, turning cases 1, 2, 8 and 11 red |
| T-03-35 | Case 10 — a throwing validator yields `CatalogValidationError`, never the validator's own `Error` |
| T-03-36 | Case 4 asserts the field and the quoted message form; **M-03-10 fired**. Case 5 measures why the bare form was not enough |
| T-03-37 | Case 7 uses a hatch different from the derivation in two directions; **M-03-4 fired** |
| T-03-38 | Case 9 pins `required` and `additionalProperties`; **M-03-5 fired**, and is caught by that case alone |
| T-03-39 | `pnpm build` re-run after all four mutants, each followed by a green `pnpm test emission`; final three-gate run all 0 |
| T-03-40 | Every gate used `pnpm --config.verify-deps-before-run=false`; `CI=true` / `--frozen-lockfile` never used in a gate |
| T-03-SC | No install performed by this plan; the lockfile restore is byte-identical |

## Requirements Satisfied

- **CAT-02** — reproduced against the real emitter that produces the shape, with the two failure
  diagnoses asserted to read *differently* (one names `oneOf`, the other quotes `"string"` and must
  not name `oneOf`), plus a positive control so neither can pass on a check that rejects everything.
  The root check is proved to run on the escape-hatch path too, blaming the hatch rather than the
  emitter.
- **CAT-06** — the negative case is a real published package whose documentation claims the
  opposite, and the hatch is proved to **win** over a validator that could have derived, not merely
  to be present.
- **DX-03** — every failure carries `action` and `vendor` as structured fields, the composed message
  names the vendor in a discriminating form, and aggregation across three vendors throws once with
  two issues that name the two failing actions and never the healthy one.

## Self-Check: PASSED

File verified present on disk in this worktree:

- `packages/concierge/test/emission.test.ts` — FOUND (531 lines)
- `.planning/phases/03-action-declaration-and-build-time-validation/03-07-SUMMARY.md` — FOUND

Commits verified in `git log`:

- `1006275` — FOUND
- `a932c61` — FOUND

Scratch probes were written under `packages/concierge/.cache/` (gitignored) and removed;
`git status --porcelain` is empty apart from this summary before its own commit.
