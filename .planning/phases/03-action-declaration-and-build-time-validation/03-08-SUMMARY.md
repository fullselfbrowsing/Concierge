---
phase: 03-action-declaration-and-build-time-validation
plan: 08
subsystem: core
tags: [phase-gate, prose-correction, pure-annotation, mutation-battery, validation-signoff, cat-01, cat-02, cat-05, cat-06, cat-07, sec-01, sec-05, dx-03]
requires:
  - "packages/concierge/src/types.ts (the four prose sites and three Object.freeze initializers) — phase 1"
  - "packages/concierge/src/catalog.ts (buildCatalog, the two diagnostic codes, redaction_missing) — plan 03-03"
  - "packages/concierge/src/index.ts (the barrel that makes the freezes reachable from a consumer) — plan 03-04"
  - "packages/concierge/test/artifact.test.ts (the frozen-constants case) — phase 1 / plan 03-04"
  - "scripts/mutate-and-prove.sh — plan 02-01"
provides:
  - "A truthful types.ts: five false or unscoped claims corrected inside the published declarations"
  - "Three /* @__PURE__ */ annotations, measured to drop 194 B from a minified consumer bundle"
  - "A third Object.isFrozen assertion, landed and observed green BEFORE the annotations"
  - "Sixteen mutants re-run against the final tree, each confirmed to have COMPILED and RUN TESTS"
  - "03-VALIDATION.md complete and honestly signed"
  - "Two harness defects recorded in scripts/mutate-and-prove.sh's own header"
affects:
  - "Phase 4 (catalogFor must re-freeze after .filter(); the inline-defineAction contextual-widening defect; JsonSchemaObject.additionalProperties)"
  - "Phase 6 (catalog.byName is a frozen null-prototype record, NOT a Map)"
  - "Phase 7 ($schema is left IN the emitted parameters — RESEARCH Open Question 3)"
tech-stack:
  added: []
  patterns:
    - "A mutation result is only recorded once the mutant is confirmed to have compiled and the tests confirmed to have run — an exit code is not evidence"
    - "A safety-net assertion is landed and observed green BEFORE the change it is the net for"
    - "Occurrence counts for literal mutation are taken UNFILTERED, because the harness does not skip comments"
key-files:
  created: []
  modified:
    - packages/concierge/src/types.ts
    - packages/concierge/src/catalog.ts
    - packages/concierge/test/artifact.test.ts
    - scripts/mutate-and-prove.sh
    - .planning/phases/03-action-declaration-and-build-time-validation/03-VALIDATION.md
decisions:
  - "The `wc -c dist/index.js` delta is +48 B, not the predicted −205 B, and that is correct rather than a failure: a library bundle cannot tree-shake its own public exports. The saving is at the CONSUMER and was measured there — 194 B minified, 2,230 B raw."
  - "M-03-13 runs as `warnHost(` → `String(`. The plan's `void (` form is a parse error and its failure presents as a PASS."
  - "No type in types.ts was amended. Every changed line is inside a doc comment or is one of the three freeze initializer lines."
  - "SEC-03 is recorded as HALF closed. The `catalogFor` re-freeze is still open and ROADMAP/REQUIREMENTS should keep mapping SEC-03 to Phase 4."
metrics:
  duration: "~55 min"
  completed: 2026-07-29
  tasks: 3
  commits: 4
  files_changed: 5
---

# Phase 3 Plan 08: The Phase Gate Summary

Five claims that ship inside `dist/index.d.ts` are now true, three dead `Object.freeze` calls are
annotated and measured, sixteen mutants fired against the tree that will actually ship — and every
one of those sixteen was checked for the failure mode this phase discovered twice, where a mutant
that breaks the build reports a green PASS having run no tests at all.

## Commits

| Hash | Type | What |
|---|---|---|
| `705310d` | fix | Four prose sites in `types.ts`, three `/* @__PURE__ */` annotations, the third `Object.isFrozen` assertion |
| `b7c1d0e` | docs | `catalog.ts:596-611` — the `<const A>` claim, scoped |
| `33d351f` | docs | `scripts/mutate-and-prove.sh` — the two harness defects and the stale exit-code sentence |
| `033f138` | docs | `03-VALIDATION.md` signed off |

## The seven gates, on a clean tree

| Gate | Exit | Headline number |
|---|---|---|
| `pnpm build` | **0** | `dist/index.js` 54,707 B · `dist/index.d.ts` 110,264 B · attw and publint clean |
| `pnpm typecheck` | **0** | 0.66 / 0.69 / 0.71 s over three runs |
| `pnpm test` | **0** | **6 files / 55 tests** |
| `pnpm check:artifact` | **0** | publint `--strict` + attw `--profile esm-only`, all green |
| `pnpm check:deps` | **0** | **0 bytes**, **1 module**, vendored `[]`, unbundled `[]` — unchanged in every figure since 03-02 |
| `pnpm check:pack` | **0** | tarball 170,265 B; a foreign project typechecked `dist/index.d.ts` under `skipLibCheck: false` and imported the runtime; 4 s |
| `pnpm check:node-floor` | **0** | installed with npm and imported on a pinned **v22.12.0**; 3 s |

All seven were green before this phase and all seven are green after it.

## The `/* @__PURE__ */` measurement — the delta is +48 B on the artifact, and that is the right answer

**This is the number the plan asked for, and it goes the opposite way from the prediction.** It is
reported as measured rather than reconciled.

| Measurement | Before | After | Delta |
|---|---|---|---|
| `wc -c packages/concierge/dist/index.js` | 52,727 | 52,775 | **+48 B** |
| `Object.freeze` calls in the bundle | 4 | 4 | 0 |
| `/* @__PURE__ */` in the bundle | 3 | 6 | +3 |
| …**attached to a freeze** | **0** | **3** | **+3** |
| `pnpm check:deps` — bytes / modules / vendored / unbundled | 0 / 1 / [] / [] | 0 / 1 / [] / [] | unchanged |

+48 B is exactly 3 × 16 bytes of annotation text. Confirmed rather than inferred: stripping
`/* @__PURE__ */ ` back out of the built artifact reproduces **52,727 B exactly**, so the 48 bytes
are the annotations and nothing else.

**Why the library bundle cannot shrink.** `USER_CANCELLED`, `USER_DECLINED` and
`CONSENT_GRADE_ORDER` are all public exports reachable from `src/index.ts`. A library build does not
tree-shake its own public API — if it did, the package would ship without them. The annotation is
not for *this* bundle; it is a message to the **consumer's** bundler, telling it that these three
calls are side-effect-free and therefore droppable when the consumer does not import the constants.
RESEARCH's ~205 B is a claim about a consumer bundle, so that is where it was measured.

### The consumer-side measurement, run as a controlled comparison

Two copies of the shipped `dist/index.js` differing **only** in those 48 bytes, each bundled by
rolldown 1.2.0 with tree-shaking on, from a consumer that imports only `buildCatalog`:

| Consumer bundle | Annotated | Un-annotated | Saving |
|---|---|---|---|
| un-minified | 42,314 B | 44,544 B | **−2,230 B** |
| minified | 6,191 B | 6,385 B | **−194 B** |

And the mechanism, read out of the two bundles directly rather than inferred from the byte count:

| In the consumer bundle | Annotated | Un-annotated |
|---|---|---|
| `USER_CANCELLED` present | **no** | yes |
| `USER_DECLINED` present | **no** | yes |
| `CONSENT_GRADE_ORDER` present | **no** | yes |
| `Object.freeze` calls retained | **1** | 4 |

The single retained call in the annotated bundle is `deepFreeze`'s own, which is correctly
un-annotated: it *is* a side effect and dropping it would break SEC-03.

**Divergence from the ~205 B estimate, flagged as required:** the minified figure is **194 B**,
within 5 % of the prediction — so RESEARCH's number was sound, and it was a statement about a
minified consumer bundle. On an un-minified one the saving is 11× larger, because what the
annotation actually enables is dropping the whole initializer, not just the call. Reporting only
the `dist/index.js` figure would have made a correct change look like a regression.

### The safety net was closed BEFORE it was trusted

`test/artifact.test.ts` asserted `Object.isFrozen` for `USER_CANCELLED` and `USER_DECLINED` only.
`CONSENT_GRADE_ORDER` was asserted by **value** (`toEqual`), which passes whether or not the array
is frozen — so the one site with no frozenness assertion was a site whose freeze a wrong annotation
could have dropped silently, with every suite in the repository staying green.

The third assertion was added first and **observed green before any annotation was written**
(`pnpm test artifact` → 9 passed). Its greenness afterwards therefore means something. All three
assertions are green against the final artifact. The case title now names all three constants
rather than "the two abandonment results".

## The five prose corrections

`types.ts` and `catalog.ts` doc comments ship verbatim inside `dist/index.d.ts` — verified, not
assumed: `grep` finds the `buildCatalog` heading and `reads_untrusted_without_consent` in the built
declarations. So each of these was a false claim in the product, not merely in the source.

| Site | Was | Now |
|---|---|---|
| `types.ts:505-506` | a lone TS2578 is mutant M9's "only symptom" | names both symptoms, and says why the second was added. Verbatim from `02-11-SUMMARY.md:317` |
| `types.ts:844` | "`buildCatalog` warns when `destructive: true` carries no `consent`" | names `destructive_without_consent`, states it **reports and does not block**, names `catalog.diagnostics` and the `onDiagnostic` hook |
| `types.ts:873-878` | SEC-01 enforcement "lives in Phase 3" — future tense | restated as shipped, naming both branches: non-empty schema + no `redact` → `redaction_missing` build failure; empty schema + no `redact` → `"drop"` |
| `types.ts:975-984` | `readsUntrusted` — "nothing else reads it" | SEC-05 landed; names the diagnostic code and the distinct-code rationale, and says **twice** that it reports rather than blocks |
| `catalog.ts:596-611` | the `const` type parameter is "CAT-01's entire mechanism" | scoped: load-bearing for **raw object literals only**; the return annotation is the mechanism that covers the documented `defineAction` path |

**`types.ts:975-984` was the one with a real way to get wrong.** That paragraph exists specifically
to stop an unenforced marker being mistaken for a control. Replacing it with "SEC-05 now enforces
this" would have inverted its purpose — the gate reports and the build still succeeds. The new
wording states the limitation twice and adds the symmetric warning: describing a reporting gate as
though it blocked is the same error in the opposite direction (T-03-42).

### The `test-d/actions.test-d.ts` sites were already corrected

The brief listed `actions.test-d.ts:147` and `:153-155` as still stale. **They are not** — both
already carry 02-11's replacement wording ("M9's *first* detector"; "this file's only symptom …
since plan 02-11 `_policyNotBivariant` fails with TS2344 in the same run"). `grep -rn "sole
detector" packages/` returns nothing. Checked rather than assumed, and no edit was made. `types.ts`
was the only shipped file still carrying the stale M9 claim.

**No type in `types.ts` was amended by this phase.** `git diff -U0` was read line by line: every
changed line is inside a `*` doc comment or is one of the three `Object.freeze` initializer lines.
A verifier should not read the file's appearance in the diff as a contract change. The same holds
for `catalog.ts`, where every changed line begins with ` *`.

## The sixteen-mutant battery — every row confirmed to have compiled and run tests

Every gate used `pnpm --config.verify-deps-before-run=false`. `CI=true` and `--frozen-lockfile` were
never used in a gate. `pnpm build` was re-run after every build-gated mutant, and
`git diff --exit-code` on the target was asserted after every single row.

**All sixteen patterns were verified at exactly one UNFILTERED occurrence before the battery ran.**

| # | Target | Gate | Harness | **Gate exit** | Compiled? | Tests ran? | Turned red |
|---|---|---|---|---|---|---|---|
| M-03-1 | `define-action.ts` | typecheck | 0 PASS | **1** | n/a | tsc emitted 8 diagnostics | 8 × TS2344 in `description-literal.test-d.ts` |
| M-03-2 | `define-action.ts` | typecheck | 0 PASS | **1** | n/a | tsc emitted 4 diagnostics | 4 × TS2344, incl. `:97` the interior-hole probe |
| M-03-3 | `catalog.ts` | typecheck | 0 PASS | **1** | n/a | tsc emitted 5 diagnostics | 5 × TS2344 at `catalog.test-d.ts:210,213,216,219,222` — every `_raw*`, the `_declared*` block green |
| M-03-4 | `json-schema.ts` | build + test emission | 0 PASS | **1** | **GREEN** | **RAN** 2 failed / 11 passed | cases 7, 8 |
| M-03-5 | `json-schema.ts` | build + test emission | 0 PASS | **1** | **GREEN** | **RAN** 1 failed / 12 passed | case 9 only |
| M-03-6 | `json-schema.ts` | build + test emission | 0 PASS | **1** | **GREEN** | **RAN** 4 failed / 9 passed | cases 1, 2, 8, 11 |
| M-03-7 | `catalog.ts` | build + test catalog | 0 PASS | **1** | **GREEN** | **RAN** 4 failed / 18 passed | C17, C18, C19, C21 |
| M-03-8 | `catalog.ts` | build + test single-instance | 0 PASS | **1** | **GREEN** | **RAN** 1 failed / 3 passed | **F4 only** |
| M-03-9 | `catalog.ts` | build + test catalog | 0 PASS | **1** | **GREEN** | **RAN** 2 failed / 20 passed | C4, C5 |
| M-03-10 | `json-schema.ts` | build + test emission | 0 PASS | **1** | **GREEN** | **RAN** 3 failed / 10 passed | cases 4, 5, 11 |
| M-03-11 | `catalog.ts` | build + test catalog | 0 PASS | **1** | **GREEN** | **RAN** 1 failed / 21 passed | **C20 only** |
| M-03-12 | `catalog.ts` | build + test catalog | 0 PASS | **1** | **GREEN** | **RAN** 2 failed / 20 passed | C13, C15 |
| M-03-13 | `catalog.ts` | build + test catalog | 0 PASS | **1** | **GREEN** | **RAN** 1 failed / 21 passed | **C12 only** |
| guard A | `types.ts` | typecheck | 0 PASS | **1** | n/a | tsc emitted 1 diagnostic | TS2344 at `actions.test-d.ts(340,33)` — `_redactIsRequired` |
| guard B | `json-schema.ts` | typecheck | 0 PASS | **1** | n/a | tsc emitted 2 diagnostics | TS2344 at `json-schema.test-d.ts(59,42)` **and** `exports.test-d.ts(85,48)` |
| guard C | `index.ts` | typecheck | 0 PASS | **1** | n/a | tsc emitted 1 diagnostic | **TS1485** at `exports.test-d.ts(71,49)` |

**Observed gate exit is 1 on all sixteen rows**, never 2. That is the sixth plan in this phase to
record it; the harness's stale sentence is now fixed in place rather than re-recorded.

After the battery: `git diff --exit-code` exits **0**, `git status --porcelain` is **empty**, and
`pnpm build && pnpm typecheck && pnpm test` all exit **0** with 6 files / 55 tests — which is the
evidence that `dist/` was rebuilt from clean source and not left mutated.

### The harness defect, reproduced against the final tree as a deliberate control

The plan's original M-03-13 literal (`warnHost(` → `void (`) was run once on purpose, to confirm the
03-06 finding still holds:

```
harness exit:            0        ← reports PASS
PASS: gate fired (exit 1), tree clean
"Build complete" in log: 0        ← the build NEVER succeeded
"PARSE_ERROR" in log:    1        ← Parenthesized expressions may not have a trailing comma
                                     at src/catalog.ts:503:53
vitest summary lines:    0        ← ZERO tests ran
```

Exit 1 from a compile failure and exit 1 from a failing assertion are indistinguishable in the
harness's output. **This is why every row above carries a "Compiled?" and a "Tests ran?" column** —
the battery was driven through a wrapper that reads the gate's output for `Build complete` and a
vitest summary line, and refuses to record a pass without both. A PASS that never ran a test is
worse than a FAIL, because it is filed as coverage.

### Three corrections to the recorded battery, all measured

1. **M-03-13's literal is `String(`, not `void (`.** Both working forms (`String(` in `catalog.ts`,
   and `host.console?.warn(message);` → `void message;` in `src/host.ts`) turn exactly C12 red with
   the build green. Already written into C12 by 03-06, and now into
   `03-VALIDATION.md`'s table so the plan text cannot mislead the next reader.
2. **Guard B reddens TWO predicates, not one.** 03-02 recorded a single diagnostic. The phase-gate
   run also reddens `exports.test-d.ts(85,48)`, because plan 03-04 later added an export-placement
   predicate reading the same literal. A strengthening — recorded so the extra diagnostic is not
   read as a regression.
3. **03-02's `.input(` occurrence row is stale and is flagged.** It records "exactly 1"; the true
   UNFILTERED count in `src/json-schema.ts` is **4**, the other three inside a doc-comment table.
   A plan trusting that row would have mutated prose, seen the suite stay green, and recorded
   "FAIL: mutant escaped" — an inverted result. `03-VALIDATION.md` and the harness header now both
   carry the correction.

## The export surface, measured from the shipped declarations

| | Measured | Pinned in `test/export-surface.test.ts` |
|---|---|---|
| total names | **59** | `toHaveLength(59)` and the `it` title at `:133` |
| types | **49** | `toHaveLength(49)` at `:140` |
| values | **10** | `toHaveLength(10)` at `:141`, and the `it` title at `:144` |
| trailing `export { … }` blocks | 1 | the `EXPORT_BLOCK` parser's own guard |

The ten values, in the artifact's own order: `CONSENT_GRADE_ORDER`, `CONTRACT_VERSION`,
`CatalogValidationError`, `JSON_SCHEMA_TARGET`, `MESSAGE_MAX_CHARS`, `USER_CANCELLED`,
`USER_DECLINED`, `assertSingleInstance`, `buildCatalog`, `defineAction`. Unmoved by this plan, which
adds no export.

## Hand-offs — read these before planning Phase 4

### 1. Phase 4 — `catalogFor` must re-freeze after `.filter()`

`frozenArray.filter(...)` returns a **new, UNFROZEN** array (measured by 03-03). So `catalogFor`
must re-freeze its filtered result, or STG-04's memoized per-stage catalogs are mutable and page
script can replace an entry through one. This is the still-open half of SEC-03 — see *Requirement
ownership* below. It is written into `deepFreeze`'s doc comment as well as here, because Phase 4
reads the source.

### 2. Phase 4 — the inline-`defineAction` DX defect, and it is wider than `buildCatalog`

**This is a real defect on the most natural spelling there is, and Phase 4 inherits it.**

```ts
const catalog = buildCatalog([ defineAction({ name: "applyFilter", … }) ]);
catalog.names           // readonly string[]  — NOT the literal name union
catalog.byName.aplyFilter   // no error: byName is Record<string, CatalogEntry>
```

Mechanism, isolated by measurement (03-05): the contextual type `AnyActionDefinition` has
`name: string`, and it binds `defineAction`'s `N` to `string` before the `name` property is
consulted. **`as const` on the array does NOT help.** Two things fix it today — declare the action as
its own `const` first, or supply `defineAction`'s type arguments explicitly.

**The surface is wider than `buildCatalog`.** `StageDefinition.actions`
(`ReadonlyArray<AnyActionDefinition<B>>`) and `ConciergeConfig.crossStage` are both
`AnyActionDefinition` collections, so an action declared inline at *either* site loses its `name`
literal the same way — and Phase 4's stage scoping is one of the two consumers CAT-01 exists for.
**Phase 4 must decide: fix the contextual type, or document the required spelling loudly.** The
defect is now recorded in `buildCatalog`'s own shipped doc comment, and pinned by
`_inlineDefineActionLosesTheUnion` in `test-d/catalog.test-d.ts`. If that predicate goes red the gap
has closed — delete it, do not relax it.

### 3. Phase 6 — `catalog.byName` is a frozen null-prototype record, NOT a `Map`

Restated as agreed rather than as a divergence: ROADMAP Phase 6's Notes were already amended to
carry this, and they still read correctly.

- **A frozen `Map` is not frozen.** `Object.freeze` seals a `Map`'s own properties and does nothing
  to `[[MapData]]`; `frozenMap.set(name, evilEntry)` succeeded in 03-03's probe. A `Map` therefore
  cannot satisfy SEC-03.
- **`Object.create(null)` is what the Phase 6 note's own concern was reaching for.**
  `dispatch("__proto__")` and `dispatch("constructor")` both resolve to `undefined` on the shipped
  record. The null prototype satisfies that concern *and* is freezable, which a `Map` is not.
- **Which structure the dispatcher's own lookup is, stated explicitly:** `catalog.byName` is the
  frozen one. If Phase 6's handler lookup reads it, it already has both properties and must **not**
  be converted to a `Map`. If Phase 6 keeps a **separate mutable** lookup, that one may be a `Map` —
  it is neither frozen nor part of the catalog. A `Map` remains correct for Phase 6's own mutable
  per-dispatch state: the dedup map, the timer map and the consent map, all allocated lazily on
  first dispatch. M-03-11 turns C20 red, so the null prototype cannot be quietly removed.

### 4. Phase 7 — `$schema` is left IN the emitted `parameters` (RESEARCH Open Question 3)

Recorded here because this is the one recommendation in RESEARCH's *Open Questions* that no other
plan in this phase executes, and Phase 7 is where a transport first exists to have an opinion.

Measured (03-07): **all three emission paths include `$schema` at the root, and it is the first
key** — `https://json-schema.org/draft/2020-12/schema` by default,
`http://json-schema.org/draft-07/schema#` under `draft-07`. `EmittedTool.parameters` is typed
`JsonSchemaObject`, which carries an index signature, so it permits the key. Whether a real
transport rejects it is **unverifiable before a transport exists**. Stripping it is a one-line
change later; guessing now risks removing something a transport wants. `$schema` is also the *whole*
observable difference between the two dialects at the fixtures measured, so `test/emission.test.ts`
case 12 pins it in both directions — an implementation that dropped the `target` argument entirely
would still emit a plausible schema, and only the `$schema` comparison can see that.

### 5. Phase 4 — two smaller items carried forward from earlier plans

- **`JsonSchemaObject.additionalProperties` is declared `boolean` and reality is wider.**
  `z.record` emits a schema **object** there — `typeof parameters.additionalProperties === "object"`,
  asserted at runtime by `catalog.test.ts` C15. `catalog.ts` reads it through a `PropertyBag` view.
  `types.ts` was deliberately **not** amended: this plan corrects prose and annotates freezes, and
  amending a declared type is a contract change that needs its own decision.
- **The `schema_not_emittable` remedy is vendor-blind.** Every such issue carries the same hardcoded
  `fix` naming valibot unconditionally, so a `/valibot/` message assertion matches even on a `probe`
  failure — `test/emission.test.ts` case 5 measures this as an executable finding rather than a
  comment. The structural repair is 03-03's already-flagged `SchemaEmission → {diagnosis, remedy}`
  split, with the remedy derived from `emission.vendor`.

## Requirement ownership — resolved as planned, not absorbed silently

- **CAT-03** (a `consent.requires` target must exist) **remains with Phase 4** per
  `REQUIREMENTS.md`. The check needs the whole assembled catalog including cross-stage actions.
- **CAT-04** (the transport grade ceiling) **remains with Phase 8**. It needs a transport, which does
  not exist until Phase 7.
- **SEC-03 is HALF closed here — not closed.** The `buildCatalog` half landed in 03-03 (recursive
  freeze, un-replaceable handler, frozen null-prototype `byName`) because `buildCatalog` is the only
  place a freeze can happen. The `catalogFor` half did **not**: ROADMAP Phase 4 still lists SEC-03 in
  its Requirements and in its criterion 5, and `REQUIREMENTS.md:207` still maps SEC-03 → Phase 4.
  **Both are correct and neither should be changed.** Writing "SEC-03 closed" would let a Phase 4
  planner drop the `.filter()` re-freeze obligation this phase discovered.

## Deviations from Plan

### Auto-fixed / added

**1. [Rule 2 — missing critical functionality] A fifth false claim, in `catalog.ts`, also shipping to consumers**

- **Found during:** Task 1, reconciling the plan's four sites against 03-05's hand-off.
- **Issue:** `src/catalog.ts:596-611` states that the `const` type parameter is "CAT-01's entire
  mechanism", without qualification. 03-05 measured that and it is true for **raw object literals
  only** — everywhere else `defineAction<N extends string>` has already fixed the literal and
  dropping the modifier changes nothing. The return annotation `Catalog<A[number]["name"]>` is the
  mechanism that covers the documented path, and it had no detector at all until 03-05 registered
  M-03-3b. Confirmed the comment ships: `grep` finds the heading in `dist/index.d.ts`.
- **Fix:** One doc-comment block rewritten to name both mechanisms and their scopes, plus the
  inline-`defineAction` defect recorded where a reader of `buildCatalog` will meet it. Comment-only.
- **Guarded:** all seven mutant literals in `catalog.ts` re-counted UNFILTERED after the edit — each
  still occurs exactly once. Verified before the battery, not after.
- **Commit:** `b7c1d0e`

**2. [Rule 1 — Bug] The harness's exit-code sentence, stale for the sixth time; and two undocumented defects**

- **Found during:** Task 2.
- **Issue:** `scripts/mutate-and-prove.sh:32` claims "tsc exits 2 on diagnostics". Observed exit is
  **1** in all sixteen rows here and in every Phase 2 and Phase 3 measurement. Six plans have
  re-derived it. Worse, two genuine defects were undocumented in the file itself: a mutant that
  breaks the build produces a vacuously-green PASS, and an occurrence count taken with comments
  filtered mutates prose and inverts the result.
- **Fix:** the stale sentence corrected **in place, on the same line**, so existing
  `mutate-and-prove.sh:32` citations still land on it; the two defects added as "Known limitation 2"
  and "Known limitation 3" *below* line 32, so no line number moved. Comment-only — behaviour, the
  argv contract and the five exit codes are unchanged. The harness was re-exercised afterwards
  (M-03-11 and guard C both still PASS at gate exit 1).
- **Commit:** `33d351f`

### Recorded rather than reconciled

- **The `dist/index.js` delta is +48 B, not −205 B.** Reported as measured, with the reason, the
  controlled strip-and-recount that proves the 48 bytes are annotation text, and the consumer-side
  measurement that shows where RESEARCH's number actually lives. The plan explicitly required a zero
  or divergent delta to be reported rather than assumed away.
- **The final `dist/index.js` is 54,707 B, not 52,775 B.** The extra 1,932 B is the `catalog.ts` doc
  comment from `b7c1d0e`, which rolldown preserves in the bundle. The annotation measurement was
  taken at the right moment — immediately before and after the annotation change and nothing else —
  so it is not contaminated by the later prose commit. `dist/index.d.ts` moved 106,367 → 108,301
  (the `types.ts` prose) → 110,264 (the `catalog.ts` prose), which is independent confirmation that
  these doc comments ship.
- **`test-d/actions.test-d.ts` needed no edit.** Both claims the brief listed as stale already carry
  02-11's replacement wording. Checked with `grep`, not assumed.
- **`test-d/consent-variance.test-d.ts:33` says "the only symptom anywhere in this repository is a
  lone TS2578".** Read in full: it is a narrative "WHAT THIS ADDS OVER `actions.test-d.ts`" passage
  that lines 38-50 immediately resolve, describing the state *before* that file existed. It does not
  ship in `dist/`. Left alone, and recorded here so a future reader does not count it as a fifth
  stale claim.
- **Task 2 produced no source change of its own.** It is a verification task; its commit carries the
  harness documentation the verification produced.

### Divergence from a recorded fact

- **03-02's acceptance table records `.input(` as occurring "exactly 1" time in
  `src/json-schema.ts`.** The true UNFILTERED count is **4**. Flagged in `03-VALIDATION.md` and in
  the harness header. The literal actually used for M-03-5 is the full statement, verified unique.

## Known Stubs

None. No stub, placeholder, hardcoded empty value or TODO was introduced. The only `placeholder`
match anywhere in the touched files is `types.ts:1096`, pre-existing prose reading *"it is a
permissive supertype, **not** a placeholder"*.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern and no schema change
at a trust boundary. It installs nothing — the only package-manager operation was
`pnpm install --frozen-lockfile` restoring the committed lockfile into a fresh worktree, which
resolves nothing new and leaves `pnpm-lock.yaml` byte-identical (T-03-SC). `check:pack` and
`check:node-floor` run their own scratch installs outside the repository.

All seven `mitigate` dispositions in the plan's threat register were implemented and measured:

| Threat | Evidence |
|---|---|
| T-03-41 (false prose shipping in the declarations) | Five sites corrected; three absences asserted by grep in the task's automated verify; both files confirmed to ship into `dist/index.d.ts` |
| T-03-42 (overstating `readsUntrusted`) | The replacement says "it reports; it does not block" and adds the symmetric warning that describing a reporting gate as blocking is the same error inverted |
| T-03-43 (`@__PURE__` dropping a live freeze) | The third `Object.isFrozen` assertion landed and was observed green BEFORE any annotation; all three green after; the consumer-bundle probe confirms `deepFreeze`'s own freeze is retained |
| T-03-44 (reporting an unmeasured delta) | Before/after `wc -c` and `check:deps` both taken; the divergence from ~205 B measured, explained and reported in three separate bundles |
| T-03-45 (a mutated `dist/` or `src/` surviving) | `git diff --exit-code` after every row; empty `git status --porcelain`; explicit `pnpm build` after every build-gated mutant; final three-gate run all 0 |
| T-03-46 (an untruthful sign-off) | Every box ticked is measured; two claims the sign-off deliberately does NOT make are written into the document |
| T-03-47 (`check:pack` failing on the emitted signature) | `check:pack` exits 0 against a genuinely packed 170,265 B tarball, typechecking `dist/index.d.ts` under `skipLibCheck: false`. Its scope is stated as exactly `probe.ts` and not broader |
| T-03-SC | Nothing installed |

## Requirements Satisfied

This plan closes the phase for eight requirements. Each is delivered by earlier plans and *proved*
here against the final tree.

- **CAT-01** — the literal name union, on both mechanisms, with the scope of each now stated
  truthfully in the shipped doc comment. M-03-3 fires; the known DX gap is pinned and handed to
  Phase 4.
- **CAT-02** — both root-failure shapes, proved by M-03-6 against real zod output.
- **CAT-05** — `destructive_without_consent`, its non-blocking nature now stated accurately in
  `types.ts`, and its default sink proved reachable by M-03-13.
- **CAT-06** — the escape hatch proved to *win* (M-03-4) and the vendor named in the failure
  (M-03-10).
- **CAT-07** — pinned by the one foreign program that compiles the shipped declarations
  (`check:pack`, exit 0), and by M-03-1 / M-03-2.
- **SEC-01** — both branches, with the `types.ts` paragraph that named this as future work now
  restated as shipped. M-03-12 and guard A both fire.
- **SEC-05** — `reads_untrusted_without_consent`, and the `types.ts` claim that nothing reads
  `readsUntrusted` is gone.
- **DX-03** — `{action, fix}` as fields, aggregation, and the compile-time message; M-03-9 fires.

**SEC-03 is deliberately excluded from this list.** It is half closed — see *Requirement ownership*.

## Self-Check: PASSED

Files verified present on disk in **this worktree**
(`/Users/lakshman/conductor/repos/concierge-v1/.claude/worktrees/agent-aff424050d597363a`):

- `packages/concierge/src/types.ts` — FOUND (modified)
- `packages/concierge/src/catalog.ts` — FOUND (modified)
- `packages/concierge/test/artifact.test.ts` — FOUND (modified)
- `scripts/mutate-and-prove.sh` — FOUND (modified)
- `.planning/phases/03-action-declaration-and-build-time-validation/03-VALIDATION.md` — FOUND
- `.planning/phases/03-action-declaration-and-build-time-validation/03-08-SUMMARY.md` — FOUND

Commits verified in `git log`:

- `705310d` — FOUND
- `b7c1d0e` — FOUND
- `33d351f` — FOUND
- `033f138` — FOUND

Scratch bundles were written under `mktemp -d` outside the repository and removed; the battery
driver and its logs live under `/tmp` and were never inside the tree. `git status --porcelain` is
empty apart from this summary before its own commit.
