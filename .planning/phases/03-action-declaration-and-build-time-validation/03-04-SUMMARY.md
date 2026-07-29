---
phase: 03-action-declaration-and-build-time-validation
plan: 04
subsystem: core
tags: [barrel, export-surface, cat-01, cat-07, dx-03, pkg-02, verbatim-module-syntax, t-03-48]
requires:
  - "packages/concierge/src/define-action.ts (defineAction) — plan 03-01"
  - "packages/concierge/src/json-schema.ts (JSON_SCHEMA_TARGET + three converter types) — plan 03-02"
  - "packages/concierge/src/catalog.ts (buildCatalog, CatalogValidationError + seven types) — plan 03-03"
provides:
  - "The public barrel at its measured 59-name surface: 49 types + 10 values"
  - "defineAction and buildCatalog importable from the package entrypoint"
  - "A value-placement predicate per new runtime export in test-d/exports.test-d.ts"
  - "An artifact-level runtime-shape case per new runtime export"
  - "test/fixtures/probe.ts — the FIRST consumer-side pin on the CAT-07 description slot, read out of the shipped dist/index.d.ts"
affects:
  - "03-06 / 03-07 (behavioural suites; they add the two test FILES this plan deliberately did not)"
  - "03-08 (owns types.ts — the three unannotated Object.freeze calls are now genuinely measurable; measurement below)"
  - "Every later plan that adds a public name: FOUR files carry the count, and three of them carry it in an `it` TITLE"
tech-stack:
  added: []
  patterns:
    - "One value-export statement per source module, so a moved export is a one-line diff"
    - "Consumer-side type pins written as plain annotations against the shipped .d.ts, never as test-d helpers"
    - "A pin is only a pin once it has been made to fail; both directions run through the real check:pack"
key-files:
  created: []
  modified:
    - packages/concierge/src/index.ts
    - packages/concierge/test/export-surface.test.ts
    - packages/concierge/test-d/exports.test-d.ts
    - packages/concierge/test/artifact.test.ts
    - packages/concierge/test/fixtures/probe.ts
decisions:
  - "The measured surface is 59/49/10, exactly the plan's expectation. Reconciled against 03-03's 'nine names' rather than assumed: those nine ARE the catalog contribution (7 types + 2 values) and warnHost was never in the plan's interfaces, so the two documents never disagreed."
  - "The instantiation-expression form `Parameters<typeof defineAction<A,B,C>>[0][\"description\"]` is accepted by TS 7.0.2 in a foreign program. The FirstArg extractor fallback was NOT needed."
  - "Task 2 landed as two commits rather than one. Steps (a)-(c) must move in lockstep with the barrel; step (d) is an independent security pin. Both commits are independently green."
  - "The `Assignable` predicates in exports.test-d.ts are deliberately loose — `(...args: never[]) => unknown` asserts only 'this is a function value'. Signature shape is pinned elsewhere; tightening here would duplicate it and produce failures unrelated to export placement."
metrics:
  duration: "~35 min"
  completed: 2026-07-29
  tasks: 2
  commits: 3
  files_changed: 5
---

# Phase 3 Plan 04: The Public Barrel Summary

Fourteen names crossed into the public API — ten types and four values — and the count that
describes them moved in step across the four places it is written. The one thing this plan added
that did not exist before in any form: a pin on the CAT-07 guard that is read by a program
compiling the **shipped declarations**, not the source.

## Commits

| Hash | Type | What |
|---|---|---|
| `2f2cdbb` | feat | `src/index.ts` — ten types, four values, corrected module doc comment |
| `5ba96ef` | test | The lockstep pin across `export-surface.test.ts`, `exports.test-d.ts`, `artifact.test.ts` |
| `07c6964` | test | `test/fixtures/probe.ts` — the consumer-side CAT-07 and `buildCatalog` pins |

## The MEASURED surface — 59 / 49 / 10, and the reconciliation the brief asked for

Read out of the built `dist/index.d.ts` trailing block, not predicted:

| | Before | After |
|---|---|---|
| names | 45 | **59** |
| types | 39 | **49** |
| values | 6 | **10** |
| trailing `export { … }` blocks | 1 | **1** |

**This matches the plan's expected 59/49/10 exactly, and the apparent disagreement with 03-03 was
not a disagreement.** The brief flagged that 03-03 records "NINE names to export" with `warnHost`
staying internal, and warned the plan's 59 might predate that. Reconciled by reading both: 03-03's
nine names are the **catalog** contribution alone — `Catalog`, `CatalogEntry`, `CatalogIssue`,
`CatalogIssueCode`, `CatalogDiagnostic`, `CatalogDiagnosticCode`, `BuildCatalogOptions` (7 types)
plus `buildCatalog` and `CatalogValidationError` (2 values). The plan's `<interfaces>` block lists
precisely those nine, and never listed `warnHost`. Adding json-schema's 3 types + 1 value and
`defineAction` gives 14, and 45 + 14 = 59. No number was forced; the measurement was taken first
and happened to agree.

The ten values, in the artifact's own order:

```
CONSENT_GRADE_ORDER, CONTRACT_VERSION, CatalogValidationError, JSON_SCHEMA_TARGET,
MESSAGE_MAX_CHARS, USER_CANCELLED, USER_DECLINED, assertSingleInstance,
buildCatalog, defineAction
```

`CatalogValidationError` is confirmed present in the **VALUE** half with no `type ` prefix, which is
the thing the parser splits on and the thing that would silently break
`catch (e) { if (e instanceof CatalogValidationError) }` for a consumer.

Deliberately **not** exported, and asserted absent from `index.ts`: `LiteralDescription`,
`IsNotConcrete`, `HoleProbe`, `hasJsonSchemaConverter`, `vendorOf`, `emitSchema`, `SchemaEmission`,
`warnHost`.

## Gate results

| Gate | Exit | Note |
|---|---|---|
| `pnpm typecheck` | 0 | |
| `pnpm build` | 0 | attw and publint clean |
| `pnpm test` | 0 | **4 files / 19 tests** |
| `pnpm check:artifact` | 0 | publint `--strict` + attw `--profile esm-only` |
| `pnpm check:deps` | 0 | see below |
| `pnpm check:pack` | 0 | tarball 165,282 B, wall time 4 s |
| `git status --porcelain` | only this plan's 5 files | |

### `pnpm test` files/tests, before and after — required by the plan

| | Files | Tests |
|---|---|---|
| Before | 4 | 15 |
| After | **4** | **19** |

**4 test files, unchanged, as the plan requires.** This plan adds four *cases* to
`artifact.test.ts` and no test FILE. `catalog.test.ts` and `emission.test.ts` land in 03-06 and
03-07, taking the file count to 6 then.

### `pnpm check:deps` — PKG-05 did not move

| Figure | Value |
|---|---|
| Runtime dependency bytes | **0** (`@standard-schema/spec`, 0 bytes) |
| Modules in built graph | **1** |
| Vendored modules | `[]` |
| Unbundled external imports | `[]` |

Unchanged from 03-02 and 03-03 in every figure, **despite `dist/index.js` growing from 10,220 B to
52,727 B** now that `catalog.ts`, `json-schema.ts`, `define-action.ts` and `host.ts` are reachable
from the entrypoint for the first time. `dist/index.d.ts` grew 77,747 B → 106,367 B. The growth is
entirely first-party; no validator and no dependency leaked in.

## The P8-equivalent mutant — the one-directional hazard, reproduced on this phase's own surface

**Exact literal, verified to occur exactly once in `src/index.ts` before running:**

```
pattern:     export { defineAction } from "./define-action.js";
replacement: export type { defineAction } from "./define-action.js";
```

Run three ways through `scripts/mutate-and-prove.sh` with
`pnpm --config.verify-deps-before-run=false` (never `CI=true` / `--frozen-lockfile`, which would
produce a vacuously-green PASS):

| Gate | Harness exit | Gate exit | Meaning |
|---|---|---|---|
| `typecheck` | **0 — PASS** | 1 | **Caught.** `TS1485` at `test-d/exports.test-d.ts(71,49)` |
| `build` + `check:artifact` | **1 — "escaped"** | 0 | **Blind, as measured.** attw "No problems found", publint "No issues found" |
| `build` then `test` | **0 — PASS** | 1 | **Caught.** 3 assertions red across 2 files |

On the mutant build, `dist/index.js`'s `defineAction` is **`undefined`** — the runtime binding is
gone — while `pnpm build` exits 0 and both packaging linters report clean. That is the whole reason
the export surface is never gated on build alone, now confirmed on Phase 3's own exports rather
than inherited from Phase 2's proof on `MESSAGE_MAX_CHARS`.

The typecheck diagnostic is exactly the counter-intuitive one the file's header warns about:

```
test-d/exports.test-d.ts(71,49): error TS1485: 'defineAction' resolves to a type-only
declaration and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
```

TS1485 at the **import** line, not TS2344 at the predicate named after the symbol. Since all five
values now share one import statement, the line number is identical whichever one regresses — so
the header was extended to say: **read the NAME in the message, not the line.**

### A finding the plan did not predict: the TOTAL-count assertion is blind to this mutant

Under the mutant, the three suites reported:

| Assertion | Result |
|---|---|
| `is exactly 59 names` | **PASSED** — the name did not leave, it moved column |
| `splits 49 types to 10 values` | FAILED — "to have a length of 49 but got 50" |
| `carries all ten runtime value exports by name` | FAILED — "expected […] to include 'defineAction'" |
| `defineAction reaches dist/index.js as a callable function` | FAILED — "expected 'undefined' to be 'function'" |

The total is conserved by a value→type move, so **`toHaveLength(59)` cannot catch this defect
class at all.** Only the split and the by-name check can. This retroactively justifies asserting
the split separately from the total rather than treating it as a redundant restatement, and it is
worth knowing before someone "simplifies" the two into one.

`dist/` was rebuilt after the mutant runs and re-verified (`defineAction` is `function` again).
`dist/` is gitignored, so the harness's "tree clean" report says nothing about it.

## The three count-bearing `it` titles — all three moved

The plan was right that there are **three**, not two, and right about which one is structurally
uncatchable by a "does the title match the assertion beneath it" review:

| Line | Title | Checked against |
|---|---|---|
| `:133` | `is exactly 59 names — …` | `expect(names).toHaveLength(59)` |
| `:138` | `splits 49 types to 10 values` | `toHaveLength(49)` / `toHaveLength(10)` |
| `:144` | `carries all ten runtime value exports by name` | `VALUE_EXPORTS.length` — **there is no number in its assertion** |

The third's assertion is a `for…of` loop. Nothing beneath the title carries a number, so the only
thing it can be validated against is the array. A comment was added directly above `VALUE_EXPORTS`
saying so, because the next person to grow this list is the person who will otherwise leave the
title stale. `grep -c 'all six runtime value exports'` returns **0**.

`readSurface` and the `EXPORT_BLOCK` regex are **untouched** — confirmed by reading the whole diff,
not just the hunk headers. Its `no trailing export { … } statement found` error is left as the
standing guard against a red count being "fixed" by weakening the parser.

## The consumer-side CAT-07 pin, and both halves of its negative control

This is the part of the plan that existed because a blocker review found the gap, and it held up.

**The form that shipped: the instantiation expression, unchanged.**

```ts
type DescSlot = Parameters<typeof defineAction<"probeAction", "Probe description.", typeof probeSchema>>[0]["description"];
export const descSlotSurvived: "Probe description." = null as unknown as DescSlot;
```

TS 7.0.2 accepts `Parameters<typeof f<A, B, C>>` in this position inside a foreign program. **The
`FirstArg` extractor fallback the plan offered was not needed and is not present** — it is recorded
in the file's doc comment as the fallback that would have been used, so the next reader knows the
choice was measured.

**The parameter shipped as the `Omit` form**, matching 03-01's record —
`Omit<ActionDefinition<…>, "description"> & { description: LiteralDescription<N, D>; }` at
`dist/index.d.ts:1942-1943`. `["description"]` indexes straight through: `Omit` removed the key, so
the intersection contributes the only member there is. Confirmed by reading the emitted
declaration, not assumed.

**`LiteralDescription` DOES resolve inside the scratch project.** It reaches `dist/index.d.ts` at
`:1890` as a non-exported declaration, alongside `IsNotConcrete` (`:1868`) and `HoleProbe`
(`:1846`) — the same correct-and-expected situation as `serverChallengeBrand`, per Trap 1 in
`export-surface.test.ts`'s header. Had it not resolved, that would have been the defect itself and
is recorded in the probe's doc comment as such, with an explicit instruction never to work around
a red by relaxing the annotation to `string`.

### Negative control — run both ways through the real `pnpm check:pack`

| Run | `check:pack` exit | Diagnostic |
|---|---|---|
| Wrong literal (`"Not the description."`) | **1 — FAILS** | `probe.ts(142,14): error TS2322: Type '"Probe description."' is not assignable to type '"Not the description."'.` |
| Correct literal restored | **0 — PASSES** | — |

`probe.ts` was restored from a byte-exact backup and `diff -q` confirmed identity before the second
run. **The failing message is itself the strongest evidence available**: it names
`Type '"Probe description."'` as the source type, which proves `DescSlot` really did resolve to the
literal through the shipped declarations, rather than to `string`, to `any`, or to an unresolved
alias that would have made the annotation vacuously satisfiable.

### A second negative control the plan did not ask for — the actual defect class

The wrong-literal control proves the assertion is live. It does **not** prove it catches the thing
T-03-48 is about. So the shipped declaration was mutated directly:

```
dist/index.d.ts:  description: LiteralDescription<N, D>;   →   description: string;
```

Result: `error TS2322: Type 'string' is not assignable to type '"Probe description."'`. **The pin
catches a widened emitted slot.** `dist/index.d.ts` was restored from a byte-exact backup and
`diff -q` confirmed identity. This is the measurement that converts "CAT-07 is guarded for
consumers" from a claim into a fact.

Both controls were first iterated in a fast local replica of the scratch project (a temp dir
outside the repo, symlinked `node_modules`, the script's exact `tsconfig.json` including
`skipLibCheck: false` and `module: node20`), then the required ones re-run through the real
`pnpm check:pack` against a genuinely packed tarball.

## Acceptance greps

### Task 1

| Check | Required | Observed |
|---|---|---|
| `grep -c 'export {' src/index.ts` | 5 | **5** |
| `grep -c 'defineAction' src/index.ts` | ≥ 2 | **2** |
| `grep -c 'still being implemented' src/index.ts` | 1 | **1** (line 23) |
| …and that line contains `defineAction` | no | **no** |
| `grep -c 'LiteralDescription\|hasJsonSchemaConverter\|emitSchema\|warnHost'` | 0 | **0** |
| `IsNotConcrete` / `HoleProbe` / `vendorOf` / `SchemaEmission` | 0 | **0** |
| dynamic-import probe | `BARREL_OK` | **`BARREL_OK`** |

The five `export {` statements are one per source module: `types.js`, `contract.js` (both
pre-existing and unmoved) plus `json-schema.js`, `catalog.js`, `define-action.js`.

### Task 2

| Check | Required | Observed |
|---|---|---|
| `grep -c 'all six runtime value exports'` | 0 | **0** |
| `VALUE_EXPORTS` entries | 10 | **10**, incl. all four new names |
| diff inside `readSurface` / `EXPORT_BLOCK` | none | **none** |
| `exports.test-d.ts` imports from `../src/index.js` | exactly 1 | **1** |
| `exports.test-d.ts` imports from any other `../src/` module | 0 | **0** |
| `probe.ts` diff | additions only | **+76 / −0** |
| `probe.ts` imports `defineAction`, `buildCatalog` as values | yes | **yes** |

`probe.ts` measured **76 insertions and zero deletions** — even the two import statements grew
purely by insertion, so no existing assertion in that file was modified or removed.

### The new `Assignable` predicates are not vacuous

A predicate that can never be `false` is decoration. Both were checked against deliberately wrong
subjects in a standalone program:

```
Assignable<180, (...args: never[]) => unknown>              -> false  (TS2344, as required)
Assignable<() => void, new (...args: never[]) => Error>     -> false  (TS2344, as required)
```

This matters because the mutant proves the *import line* is load-bearing (TS1485 fires before any
predicate is evaluated) — it does not, on its own, prove the predicates are.

## Deviations from Plan

### Structural

**Task 2 landed as two commits rather than one.** Steps (a)–(c) must move in lockstep with the
barrel — an intermediate state where the counts disagree with the artifact is red — while step (d),
the `probe.ts` pin, is an independent security assertion with no coupling to the counts. Splitting
gives two independently-green commits and a reviewable history. Both are `test(03-04)`. No file
crossed a commit boundary.

### Auto-fixed issues

**None.** No Rule 1, 2 or 3 fix was required. Every gate was green on first run after each edit,
and the two `tsc` failures observed were the deliberate negative controls.

### Recorded rather than reconciled

- **The doc-comment cross-reference in `probe.ts` cites a binding, not a line number.** The draft
  said "the same thing line 69 does for `assertSingleInstance`"; adding 28 header lines moved that
  statement to line 100 and would have made the comment wrong on arrival. It now names the `f`
  binding instead. Line-number references inside a file that grows are a self-falsifying comment
  style and this one caught itself.
- **`pnpm test` failed 4/4 on this fresh worktree until `pnpm build` ran**, and `node_modules` was
  absent entirely (`pnpm install --frozen-lockfile` restored it, adding nothing). Both are the
  suite's own guards and the worktree's starting state, not regressions — the same note 03-01
  recorded.

## Measurements for later plans

### 03-08 — the `Object.freeze` / `@__PURE__` hand-off is now live, and still open

03-03 predicted this becomes measurable "only when 03-04 exports `buildCatalog` through the
barrel". It has. Measured on the shipped artifact:

| Figure | Value |
|---|---|
| `Object.freeze` occurrences in `dist/index.js` | **4** |
| `/* @__PURE__ */` occurrences in `dist/index.js` | **3** |
| …attached to the freeze calls? | **no** |

The three `@__PURE__` annotations rolldown emitted are on `new Set()` / `new Set()` / `new WeakSet()`
inside `buildCatalog` — unrelated. The three `types.ts` freeze calls (`:243`, `:265`, `:467`) remain
unannotated in source and unannotated in the bundle, so they are retained in a consumer bundle now
that `assertSingleInstance` keeps the module graph alive. **`types.ts` is not in this plan's
`files_modified` and was left byte-identical. 03-08 owns it**, alongside the four stale claims 03-01
and 03-03 already routed there.

### Every later plan that adds a public name

Four files carry the count and **three `it` titles** carry it as prose:
`test/export-surface.test.ts` (three titles + two assertions + `VALUE_EXPORTS`),
`test-d/exports.test-d.ts` (one predicate per value), `test/artifact.test.ts` (one case per value),
and — for anything whose *type shape* a consumer depends on — `test/fixtures/probe.ts`.
`attw` and `publint` will not help; only `typecheck` and these suites will.

## Known Stubs

None. Every export is a real binding proved present in `dist/index.js` by dynamic import, by the
artifact suite, and by a foreign project that installed a packed tarball.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern and no schema change
at a trust boundary. It installs nothing — `pnpm install --frozen-lockfile` restored the existing
lockfile into an empty worktree and added no package (T-03-SC).

All six `mitigate` dispositions were implemented and measured:

- **T-03-20** (value moved into the `export type` block) — predicate + artifact case per value,
  plus the P8-equivalent mutant run on this phase's own surface. Build/attw/publint measured blind;
  build-alone is never the gate.
- **T-03-21** (internal machinery leaking) — all eight internal names asserted absent from
  `index.ts`, including `warnHost`, whose shape Phase 6 will change.
- **T-03-22** (stale count in an `it` title) — all three titles moved and each verified against a
  different thing; the third against `VALUE_EXPORTS.length`, since it has no assertion number.
- **T-03-48** (CAT-07 not surviving `.d.ts` emission) — closed, and proved closed by two negative
  controls including a direct mutation of the shipped declaration.
- **T-03-23** (weakening `readSurface`) — untouched, confirmed by reading the full diff.
- **T-03-SC** — nothing installed.

## Requirements Satisfied

- **CAT-01** — `buildCatalog`'s `<const A extends …>` literal-name inference is now reachable by a
  consumer at all, which is what makes CAT-01 a shipped guarantee rather than an internal one.
- **CAT-07** — reached the public entrypoint, and for the first time is pinned by a program that
  compiles the **shipped** declarations rather than `src/`.
- **DX-03** — `CatalogValidationError` and the issue/diagnostic types are importable, so a consumer
  can `instanceof`-narrow the aggregate throw and read `{code, action, vendor?, problem, fix}` as
  typed fields.

## Self-Check: PASSED

Files verified present on disk in this worktree:

- `packages/concierge/src/index.ts` — FOUND (modified)
- `packages/concierge/test/export-surface.test.ts` — FOUND (modified)
- `packages/concierge/test-d/exports.test-d.ts` — FOUND (modified)
- `packages/concierge/test/artifact.test.ts` — FOUND (modified)
- `packages/concierge/test/fixtures/probe.ts` — FOUND (modified)

Commits verified in `git log`:

- `2f2cdbb` — FOUND
- `5ba96ef` — FOUND
- `07c6964` — FOUND

Scratch replicas were created under `mktemp -d` outside the repository and removed. `dist/` was
rebuilt after the mutant runs and re-verified. `git status --porcelain` shows only this SUMMARY
before its own commit.
