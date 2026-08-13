---
phase: 03-action-declaration-and-build-time-validation
plan: 05
subsystem: core-types
tags: [cat-01, type-level-guard, name-union, const-type-parameter, sec-03, mutation-proof]
requires:
  - "packages/concierge/src/catalog.ts (buildCatalog, Catalog, CatalogEntry) — plan 03-03"
  - "packages/concierge/src/define-action.ts (defineAction) — plan 03-01"
  - "packages/concierge/test-d/_assert.ts (Expect, Equals, Assignable, Not) — phase 1"
provides:
  - "packages/concierge/test-d/catalog.test-d.ts — CAT-01's compile-time half, 13 predicates, all 13 observed red"
  - "The measured fact that `<const A extends …>` is load-bearing for RAW OBJECT LITERALS ONLY"
  - "M-03-3b — a second, previously unregistered mutant that destroys CAT-01 on the documented path"
  - "A pinned, measured DX gap: inline `defineAction` inside `buildCatalog`'s argument loses the name union"
affects:
  - "03-04 (owns src/index.ts; this file imports ../src/catalog.js directly and does not read the barrel)"
  - "03-08 (candidate owner of the doc-comment correction to src/catalog.ts:596-611 — see Hand-offs)"
  - "Phase 4 (StageDefinition.actions and ConciergeConfig.crossStage carry the same contextual-widening gap)"
tech-stack:
  added: []
  patterns:
    - "Two assertion blocks split by which MECHANISM delivers the property, not by which type is asserted"
    - "A pin on a known defect, proved to fire by simulating the defect being FIXED"
    - "Opposite-direction detector pairs: `Equals` on the exact type plus `Not<Assignable<wide, actual>>`"
key-files:
  created:
    - packages/concierge/test-d/catalog.test-d.ts
  modified: []
decisions:
  - "The `const` type parameter is load-bearing for raw object literals ONLY. Measured: a catalog built from `defineAction` consts derives the union with or without it."
  - "Both assertion blocks SHIP. The `_declared*` block cannot catch M-03-3 and is kept because it is the only detector for M-03-3b."
  - "The inline-`defineAction` union loss is PINNED as a measured gap, not fixed — the fix is a `src/` signature change this plan does not own."
metrics:
  duration: "~50 min"
  completed: 2026-07-29
  tasks: 1
  commits: 2
  files_changed: 1
---

# Phase 3 Plan 05: CAT-01's Compile-Time Half Summary

One file, thirteen predicates, five mutants — and a correction to the phase's own model of how
CAT-01 is delivered: the `const` type parameter the plan calls "CAT-01's entire mechanism" is
load-bearing for exactly one call-site shape, and it is not the documented one.

## What Shipped

| File | Lines | Role |
|---|---|---|
| `packages/concierge/test-d/catalog.test-d.ts` | 301 | 13 `Expect<…>` predicates in five blocks, none exported, none annotated, zero suppression directives |

## Commits

| Hash | Type | What |
|---|---|---|
| `8a572ba` | test | The file — both assertion blocks, the empty case, the pinned gap, the two `readonly` companions |
| *(this doc)* | docs | Summary |

## The finding that changed the plan

**The plan's premise was falsified by its own acceptance criterion, and the criterion was right.**

The first draft of this file did exactly what `03-05-PLAN.md` describes: two `defineAction` consts,
`buildCatalog([applyFilter, cancelBooking])`, and predicates on the derived union. `pnpm typecheck`
was green. **Mutant M-03-3 then escaped it at exit 0** — the harness reported
`FAIL: gate did NOT fire — mutant escaped`.

Per the standing instruction inherited from 03-01, an escaping mutant means the *suite* lacks a
discriminating case rather than that the assertion is redundant. So the discriminating case was
measured rather than guessed. Every shape below was run twice, once against the shipped source and
once under `<const A extends` → `<A extends`:

| Call-site shape | with `const` | without `const` | discriminates M-03-3? |
|---|---|---|---|
| `[applyFilterConst, cancelBookingConst]` — pre-typed `defineAction` results | `"applyFilter" \| "cancelBooking"` | **same** | **no** |
| `[{name: "rawOne"}, {name: "rawTwo"}]` — raw object literals | `"rawOne" \| "rawTwo"` | **`string`** | **YES** |
| `[defineAction({name: "…"}), …]` — inline calls | **`string`** | `string` | no (already lost) |
| `[rawObjectConst]` — pre-typed plain object | `string` | `string` | no |
| `[applyFilterConst]` — solo, pre-typed | `"applyFilter"` | **same** | no |
| `[]` — empty | `never` | **same** | no |
| `keyof byName`, pre-typed shape | `"applyFilter" \| "cancelBooking"` | **same** | no |
| `keyof byName`, raw-literal shape | `"rawOne" \| "rawTwo"` | **`string`** | **YES** |

**Raw object literals are the only shape the `const` modifier is load-bearing for.** The reason is
mundane once seen: `const` type parameters preserve literals that would otherwise widen, and in
every other row the literal has already been fixed by `defineAction<N extends string>` before
`buildCatalog` is reached. `A` is then inferred from already-typed values, which do not widen.

### What this means for how CAT-01 is actually delivered

CAT-01 has **two** independent mechanisms, not one, and the plan (and `03-RESEARCH.md` *Pattern 2*,
and `03-03-SUMMARY.md`) name only the first:

1. `<const A extends readonly AnyActionDefinition[]>` — carries the union on the **raw-literal**
   path, which `src/define-action.ts` records as staying reachable by design.
2. `Catalog<A[number]["name"]>` as the return type — carries it on **every** path, including the
   documented `defineAction` one.

Mechanism 2 had no detector anywhere in the repository before this file. It is registered here as
**M-03-3b**, and it is the mutation that would silently destroy CAT-01 for the users the
documentation actually addresses.

**Both assertion blocks therefore ship.** The `_declared*` block is provably unable to catch M-03-3;
it is kept because it is the only thing that catches M-03-3b. Deleting either block leaves a live
mutation undetected. This is the same disposition 03-01 reached on the four individually-redundant
`HoleProbe` branches, arrived at the same way.

## Measurements the plan required

### The empty catalog — measured, and it matched the prediction

`buildCatalog([])` is **`Catalog<never>`**:

| Member | Measured type |
|---|---|
| `names` | **`readonly never[]`** — as predicted by the plan |
| `byName` | `Readonly<Record<never, CatalogEntry>>` |

No divergence. It is a legal build, not an error, and `readonly never[]` is exactly right — an
array that can never hold a name is what an empty catalog's name list is. Measured **identical with
and without** the `const` modifier, so `_emptyCatalogNamesAreNever` is M-03-3b's detector, not
M-03-3's.

### Observed `tsc` exit code under every mutant

**1**, on all five gate runs. `scripts/mutate-and-prove.sh:32` still says "tsc exits 2 on
diagnostics" and remains stale prose under typescript 7.0.2 — the same finding 03-01 recorded. Not
edited; that file is not in this plan's `files_modified`.

### Exact one-occurrence mutant literals

Each verified to occur **exactly once in the whole file** before running, because the harness aborts
with exit 3 on a no-op and does not tolerate a pattern matching twice.

| ID | Target | Pattern (occurrences: 1) | Replacement |
|---|---|---|---|
| **M-03-3** | `src/catalog.ts` | `<const A extends` | `<A extends` |
| **M-03-3b** | `src/catalog.ts` | `Catalog<A[number]["name"]>` | `Catalog<string>` |
| **M-03-5a** | `src/catalog.ts` | `readonly entries: readonly CatalogEntry[];` | `readonly entries: CatalogEntry[];` |
| **M-03-5b** | `src/catalog.ts` | `readonly action: AnyActionDefinition;` | `action: AnyActionDefinition;` |
| **gap-closure** | `test-d/catalog.test-d.ts` | `` defineAction({\n    name: "inlineFilter", `` (2-space indent, multi-line) | same with explicit type arguments |

The plan supplied only M-03-3. The other four were added because an assertion never observed red is
indistinguishable from an absent check, and four of the thirteen predicates would otherwise have
been unproved. Note the M-03-3 literal is the one `03-03-SUMMARY.md` recorded, used verbatim.

## Gate results

All re-run against the final committed tree.

| Gate | Harness | Gate exit | Predicates reddened |
|---|---|---|---|
| **M-03-3** (`const` modifier dropped) | PASS (0) | **1** | **5** — every `_raw*` predicate (`:210,213,216,219,222`). The `_declared*` block stayed green, which is the measured point of the split. |
| **M-03-3b** (return type widened to `Catalog<string>`) | PASS (0) | **1** | **10** — all 4 `_declared*` (`:159,162,165,168`), all 5 `_raw*`, and `_emptyCatalogNamesAreNever` (`:232`) |
| **M-03-5a** (`Catalog.entries` loses its outer `readonly`) | PASS (0) | **1** | **1** — only `_entriesAreReadonly` (`:298`) |
| **M-03-5b** (`CatalogEntry.action` loses its `readonly`) | PASS (0) | **1** | **1** — only `_entryMembersAreReadonly` (`:301`) |
| **gap-closure** (the pinned defect simulated as FIXED) | PASS (0) | **1** | **1** — only `_inlineDefineActionLosesTheUnion` (`:284`) |
| `pnpm typecheck` | — | 0 | — |
| `pnpm test` | — | 0 | **4 files / 15 tests** — unchanged; this plan adds no runtime test |
| `pnpm build` | — | 0 | `attw` and `publint` both clean |
| `git status --porcelain` | empty | — | — |
| `git diff --exit-code -- packages/concierge/src/catalog.ts` | 0 after every mutant | — | — |

**13 of 13 predicates observed red at least once.** No predicate in this file is unproved.

## The pinned gap: inline `defineAction` loses the name union

This is a real defect on the most ergonomic spelling there is, found while measuring, and **not
fixed here** — the fix is a signature change in `src/`, which this plan does not own.

```ts
const catalog = buildCatalog([ defineAction({ name: "applyFilter", … }) ]);
catalog.byName.aplyFilter   // NO ERROR — byName is Record<string, CatalogEntry>
```

**Mechanism, isolated by measurement rather than reasoned about.** The contextual type
`AnyActionDefinition` has `name: string` (`types.ts:1022-1028`), and it flows into the inline call
and binds `defineAction`'s `N` to `string` before the `name` property is consulted:

| Expression | `["name"]` |
|---|---|
| `takesAny<T extends AnyActionDefinition>(defineAction({name: "ctxOne", …}))` | **`string`** |
| `takesUnknown<T>(defineAction({name: "ctxOne", …}))` | `"ctxOne"` |
| `defineAction({name: "ctxOne", …})` — no contextual type at all | `"ctxOne"` |

So it is the *shape* of the contextual type, and nothing about arrays, `buildCatalog`, or literal
widening. `[…] as const` on the argument does **not** fix it (measured), which independently rules
out array widening as the cause. Two things fix it today:

- declare the action as its own `const` first — the shape the documentation should recommend;
- supply `defineAction`'s type arguments explicitly —
  `defineAction<"gOne", "G one.", typeof filterSchema>({…})` was measured to derive
  `readonly "gOne"[]`.

The predicate `_inlineDefineActionLosesTheUnion` pins `readonly string[]`, which is what is measured
today and is a defect rather than a specification. **If it goes red the gap has been closed — delete
the predicate and its comment block, do not relax it.** Same standing instruction as the `${number}`
gap pinned in `description-literal.test-d.ts`, and it was proved to fire by simulating the closure
rather than asserted to.

**The surface is wider than `buildCatalog`.** Anything contextually typed as `AnyActionDefinition`
does this, which includes `StageDefinition.actions` (`ReadonlyArray<AnyActionDefinition<B>>`) and
`ConciergeConfig.crossStage`. Handed to Phase 4 below.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] The plan's own assertion set could not detect the mutant it was written for**

- **Found during:** Task 1 verification, on the first M-03-3 run.
- **Issue:** The plan's `<action>` block specifies fixtures built from unannotated `defineAction`
  consts and predicates reading `(typeof catalog)["names"]`. Written exactly as specified, the file
  typechecked green and **M-03-3 escaped at exit 0**. The plan's `<objective>` asserts "with a plain
  `readonly AnyActionDefinition[]` parameter they derive `string`"; that is true for the shape
  `03-RESEARCH.md` measured (raw literals) and false for the shape the plan told me to build.
- **Fix:** Measured all six call-site shapes with and without the modifier (table above), then added
  Block 2 — a raw-object-literal catalog and a solo raw catalog — which is the only shape that
  discriminates. Kept the `defineAction` block and registered M-03-3b to prove it is not dead weight.
  The whole measurement is in the shipped file header, because the next person to read this file
  will otherwise "simplify" the two blocks back into one.
- **Files modified:** `packages/concierge/test-d/catalog.test-d.ts`
- **Commit:** `8a572ba`

### Additions beyond the plan, and why each earns its place

- **M-03-3b, M-03-5a, M-03-5b, and the gap-closure mutant.** The plan requires one mutant, which
  proves five of thirteen predicates. Four more predicates were unproved and are now proved. The
  fifth family (`_declared*`) had no registered mutant at all until M-03-3b existed.
- **`_entryMembersAreReadonly`** — the plan's `<behavior>` says "`entries` is `readonly` at the type
  level AND the elements are `readonly`", and the plan's own `_entriesAreReadonly` spelling covers
  only the array. Measured: `Assignable<{action, parameters}, CatalogEntry>` is **`true`**, because
  readonly property modifiers do not affect assignability — so an `Assignable` spelling of the
  element claim would stay green with both modifiers deleted. `Equals<CatalogEntry,
  Readonly<CatalogEntry>>` is the spelling that sees it, and M-03-5b proves it.
- **A second, unrelated schema (`bookingSchema`).** Two actions over one schema make the arrays
  homogeneous, and a homogeneous array derives its element union under weaker inference. Same
  reasoning as `Booking` vs. `Shipment` in `actions.test-d.ts`.
- **`_inlineDefineActionLosesTheUnion`.** Documented above.

### Divergences from the plan text, recorded rather than reconciled

- **Predicate names are prefixed `_declared*` / `_raw*`** rather than the plan's bare
  `_namesAreALiteralUnion` etc. The two blocks assert the same shapes against different mechanisms
  and a shared name would make a diagnostic unreadable — and terse output prints no alias name at
  all, so the name only helps a human reading the file.
- **`_nameUnionIgnoresConsentRequires` is spelled `Not<Assignable<"reviewFilter",
  names[number]>>`.** The plan says only "assert the union does not contain the target".
  `noUncheckedIndexedAccess` was measured **not** to reach `T[number]` in type position on an array
  type, so the indexed access is the bare union with no `| undefined` and the predicate is exact.
- **The plan's `verify` command is reproduced verbatim and works**, including
  `pnpm --config.verify-deps-before-run=false`. Confirmed the harness's ABORT-on-no-op path was not
  silently taken: the `<const A extends` pattern occurs exactly once, and a control run printed the
  mutated signature `export function buildCatalog<A extends readonly AnyActionDefinition[]>(` from
  inside the mutated tree before `tsc` ran.

## Acceptance criteria

| Criterion | Required | Observed |
|---|---|---|
| `pnpm typecheck` with the new file in the program | 0 | **0** |
| M-03-3 harness | PASS (0), gate exit 1 | **PASS (0), gate exit 1** |
| `git diff --exit-code -- packages/concierge/src/catalog.ts` after every mutant | 0 | **0** |
| `Expect<` predicates, one line each, `_`-prefixed | ≥ 6 | **13** |
| `ts-expect-error` (comment lines filtered) | 0 | **0** |
| `^export` (comment lines filtered) | 0 | **0** |
| Every `defineAction` / `buildCatalog` const unannotated | all 7 | **all 7**, read individually |
| File length | ≥ 70 | **301** |
| `from "../src/catalog.js"` (`key_links`) | present | **2 occurrences** — the value import and the type import |
| `git status --porcelain` | only this plan's file | **only `test-d/catalog.test-d.ts`** |

## Known Stubs

None. Every predicate is wired to real source and every one has been observed red.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern and no schema change
at a trust boundary. It installs nothing — no package-manager operation occurred (T-03-SC).

Both `mitigate` dispositions were implemented and measured:

- **T-03-24** (`const` type parameter) — `_rawNamesAreALiteralUnion` and
  `_rawNamesAreNotWidenedToString` fail in opposite directions, plus M-03-3 proved to fire. The
  threat register's sentence "losing the modifier compiles, builds, and passes every runtime test"
  is confirmed; its implicit scope was wider than reality, and the corrected scope is above.
- **T-03-25** (union widened by a second inference site) — `_declaredNameUnionIgnoresConsentRequires`
  and `_rawNameUnionIgnoresConsentRequires`. Both catalogs carry a `consent.requires` naming an
  action that is deliberately **not** declared anywhere in the file, so the target has exactly one
  route into the union and it is the defect.
- **T-03-26** (annotating a const under test) — the export-nothing rule is stated at length in the
  file header with the TS9010 asymmetry spelled out, and every one of the seven consts was read
  individually to confirm it carries no annotation.

## Requirements Satisfied

- **CAT-01** — compile-time half. One declaration yields the action's literal name type, proved by
  two detectors that fail in different directions, on both mechanisms that deliver it.
- **CAT-07** — not a target of this plan; the three `defineAction` call sites here are additional
  accept cases and compiled unchanged, which is incidental corroboration of 03-01's guard.
- **SEC-03** — compile-time companion only. `Object.freeze` remains the enforcement; these two lines
  keep the `.d.ts` claim honest so a TypeScript consumer is told what the runtime will enforce.

SEC-01 is **not** delivered by this plan, as the plan's own frontmatter comment states. Its type
half is 03-01's `_redactIsRequired`; its runtime half is 03-03.

## Hand-offs

- **03-08 (or whoever owns the next `src/catalog.ts` doc pass).** The doc comment at
  `src/catalog.ts:596-611` says the `const` modifier is what makes the union derive, without
  qualification. That is true only for raw object literals, and the file it guards now has the
  measurement. `src/catalog.ts` is not in this plan's `files_modified` and was left byte-identical
  (verified by `git diff --exit-code` after all four mutants). One paragraph, no code change.
- **Phase 4 — the contextual-widening gap is not confined to `buildCatalog`.**
  `StageDefinition.actions` and `ConciergeConfig.crossStage` are both `AnyActionDefinition`
  collections, so an action declared inline at either site loses its `name` literal the same way.
  Phase 4's stage scoping is one of the two consumers CAT-01 exists for.
- **Documentation.** Until the gap closes, examples must declare each action as its own `const`
  before passing it to `buildCatalog`. The inline spelling reads better and silently gives up the
  entire property.
- **03-04** — no interaction. This file imports `../src/catalog.js` and `../src/define-action.js`
  directly rather than through the barrel, exactly as `key_links` specifies, so it neither depends
  on nor constrains the export surface. Nothing in `src/index.ts`, `test/export-surface.test.ts`,
  `test-d/exports.test-d.ts`, `test/artifact.test.ts` or `test/fixtures/probe.ts` was read or
  touched.

## Self-Check: PASSED

Files verified present on disk in the worktree
(`/Users/lakshman/conductor/repos/concierge-v1/.claude/worktrees/agent-af510e695d167271b`):

- `packages/concierge/test-d/catalog.test-d.ts` — FOUND (301 lines, tracked)

Commits verified in `git log`:

- `8a572ba` — FOUND — `test(03-05): pin CAT-01's derived name union, its lookup key, and the two mutants that destroy it`

Scratch probes were written under `packages/concierge/.cache/` (gitignored), used for all six
call-site measurements, and removed. `git status --porcelain` is empty apart from this summary.
