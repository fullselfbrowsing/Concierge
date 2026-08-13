---
phase: 03-action-declaration-and-build-time-validation
plan: 06
subsystem: core
tags: [catalog, tests, cat-01, cat-02, cat-05, sec-01, sec-03, sec-05, dx-03, pkg-04, mutation-proof]
requires:
  - "packages/concierge/src/catalog.ts (buildCatalog, CatalogValidationError) — plan 03-03"
  - "packages/concierge/src/index.ts (the barrel exporting both) — plan 03-04"
  - "packages/concierge/test/fixtures/schemas.ts — plan 03-02"
  - "packages/concierge/src/host.ts (warnHost) — plan 03-03"
provides:
  - "test/catalog.test.ts — 22 behavioural cases across CAT-01, CAT-02, CAT-05, SEC-01, SEC-03, SEC-05 and DX-03"
  - "test/single-instance.test.ts F4 — the ROADMAP Phase 3 SC-5 case, asserting the registry in BOTH directions"
  - "Seven mutation proofs (six required, one supplementary), every gate exit recorded"
  - "The corrected M-03-13 literal, written into the test file so 03-08's battery re-run does not rediscover the parse-error trap"
affects:
  - "03-08 (phase gate; re-runs the mutant battery — M-03-13's primary literal is unusable, see below)"
  - "Phase 4 (catalogFor must re-freeze; C22 pins the validator-skip as a positive claim, so 'freeze everything' cannot be adopted as an obvious tightening)"
tech-stack:
  added: []
  patterns:
    - "Artifact bindings loaded in an async beforeAll, after the dist-existence guard, so the friendly 'run pnpm build first' message survives"
    - "A capturing stand-in installed on globalThis.console and restored in a finally — a plain global assignment, never the Vitest mocking API"
    - "Tamper assertions on the VALUE, not on Object.isFrozen, because the shallow-freeze breach reports success"
key-files:
  created:
    - packages/concierge/test/catalog.test.ts
  modified:
    - packages/concierge/test/single-instance.test.ts
decisions:
  - "M-03-13's primary literal (`warnHost(` -> `void (`) is UNUSABLE: it produces `void (…,)`, a parse error, so the gate fires at the build and never runs a test — a vacuously-green PASS. Two working forms measured and recorded."
  - "Declarations in the suite are plain objects, not defineAction calls: `redact` is non-optional, so defineAction cannot express the omission SEC-01's runtime half exists for."
  - "Case 9b's stand-in console is installed by plain global assignment; `grep -c 'vi\\.'` over test/ is still 0 across every file, including inside comments."
  - "F4 asserts the registry is EMPTY after import as a check in its own right — that half catches a guard smuggled to module scope, which bundling would delete."
metrics:
  duration: "~25 min"
  completed: 2026-07-29
  tasks: 3
  commits: 3
  files_changed: 2
---

# Phase 3 Plan 06: The Catalog's Behavioural Suite Summary

Twenty-two cases proving the catalog behaves — errors aggregate and name their actions as fields,
both consent markers report without blocking, redaction fails closed on the record shape the obvious
test gets wrong, the freeze survives an actual tamper rather than an `Object.isFrozen` report, and
`assertSingleInstance` finally fires from a path a consumer reaches — plus seven mutants proving each
of those is a rule and not a coincidence.

## What Shipped

| Artifact | Lines | What it carries |
|---|---|---|
| `packages/concierge/test/catalog.test.ts` | 701 | 22 `it` cases in five `describe` blocks, one per requirement group |
| `packages/concierge/test/single-instance.test.ts` | 222 (+55/−0) | F4, plus a 27-line header paragraph. Purely additive — F1a, F1b and F2 are byte-identical |

## Commits

| Hash | Type | What |
|---|---|---|
| `0d9a4d4` | test | `test/catalog.test.ts` — the 22-case behavioural suite |
| `b70a344` | test | F4 and the SC-5 header paragraph in `test/single-instance.test.ts` |
| `cd61422` | test | The corrected M-03-13 literal recorded in the C12 case |

## `pnpm test` — before and after

| | Test files | Tests |
|---|---|---|
| **Before this plan** | 4 | **19** |
| **After this plan** | **5** | **42** |

`pnpm test single-instance` alone: **3 before, 4 after.**
`pnpm test catalog`: **22**, in the BARE form. (`pnpm test -- catalog` does not filter — vitest's
cac CLI discards everything after `--`. Not used here.)

## Verification

| Gate | Exit | Note |
|---|---|---|
| `pnpm build` | **0** | attw and publint clean |
| `pnpm typecheck` | **0** | |
| `pnpm test` | **0** | 5 files / 42 tests |
| `pnpm test catalog` | **0** | 22 tests |
| `pnpm test single-instance` | **0** | 4 tests |
| `pnpm check:deps` | **0** | 0 bytes, 1 module — unchanged |
| `pnpm check:artifact` | **0** | |
| `git status --porcelain` | **empty** | only this plan's two files were ever touched |

### Task 1 acceptance greps

| Check | Required | Observed |
|---|---|---|
| `it(` cases in `catalog.test.ts` | ≥ 20 | **22** |
| `grep -c 'vi\.' test/catalog.test.ts` | 0 | **0** |
| `grep -c 'vi\.'` across all of `test/` | 0 | **0** (every file) |
| `grep -v '^[[:space:]]*//' … \| grep -c '\.\./src/'` | 0 | **0** |
| `dist/index.js` referenced | ≥ 1 | **4** |
| `Object.getPrototypeOf(catalog.byName)` asserted | 1 | **1** |
| line count | ≥ 220 | **701** |

The `vi.` criterion required one correction during the task: the first draft's own explanatory
comment contained the literal `vi.spyOn`, and `grep -c` counts lines regardless of whether they are
comments. The note now spells the prefix out in prose and says why.

### Task 2 acceptance greps

| Check | Required | Observed |
|---|---|---|
| `grep -c 'vi\.' test/single-instance.test.ts` | 0 | **0** |
| `grep -c 'buildCatalog' test/single-instance.test.ts` | ≥ 2 | **5** |
| `git diff -U0` — F1a / F1b / F2 modified | none | **none** — every changed line is a `+` |

`git diff -U0 -- packages/concierge/test/single-instance.test.ts` was read line by line: 27 added
header-comment lines and 28 added lines for the F4 case. No existing line is modified or deleted.

## Mutation proofs — seven mutants, every gate exit recorded

Every gate is `bash -c 'pnpm --config.verify-deps-before-run=false build && pnpm --config.verify-deps-before-run=false test <fragment>'`.
`CI=true` and `--frozen-lockfile` were deliberately NOT used — they produce a vacuously-green PASS.

| ID | Target | Exact literal → replacement | Occ. | Harness | Gate exit | Cases turned red |
|---|---|---|---|---|---|---|
| **M-03-7** | `src/catalog.ts` | `return deepFreeze(catalog, validators, new WeakSet<object>());` → `return Object.freeze(catalog);` | 1 | **0 (PASS)** | **1** | C17, C18, C19, C21 (4 failed / 18 passed) |
| **M-03-8** | `src/catalog.ts` | `assertSingleInstance();` → *(empty)* | 1 | **0 (PASS)** | **1** | **F4 only** — F1a, F1b and F2 all stayed green |
| **M-03-9** | `src/catalog.ts` | `throw new CatalogValidationError(issues);` → `throw new CatalogValidationError(issues.slice(0, 1));` | 1 | **0 (PASS)** | **1** | C4, C5 |
| **M-03-9b** *(supplementary)* | `src/catalog.ts` | `if (!emission.ok) {` → same line + `\n      if (issues.length > 0) throw new CatalogValidationError(issues);` | 1 | **0 (PASS)** | **1** | C4, C5 |
| **M-03-11** | `src/catalog.ts` | `const byName: Record<string, CatalogEntry> = Object.create(null);` → `… = {};` | 1 | **0 (PASS)** | **1** | C20 |
| **M-03-12** | `src/catalog.ts` | the six-line `issues.push({ code: "redaction_missing", … });` block → `      void 0;` | 1 | **0 (PASS)** | **1** | C13, C15 |
| **M-03-13** | `src/catalog.ts` | `warnHost(` → `String(` | 1 | **0 (PASS)** | **1** | **C12 only**, build green |
| **M-03-13 (fallback)** | `src/host.ts` | `host.console?.warn(message);` → `void message;` | 1 | **0 (PASS)** | **1** | **C12 only**, build green |

`git diff --exit-code` on the mutated file exited **0** after every single run. `pnpm build` was
re-run explicitly after **every** mutant, because `dist/` is gitignored and the harness's own
"tree clean" report is blind to it — and the final `pnpm build && pnpm typecheck && pnpm test` all
exit 0, which is the evidence that the artifact was rebuilt from restored source rather than left
mutated.

**Observed gate exit is 1 in all seven runs.** `scripts/mutate-and-prove.sh:32` still says "tsc
exits 2 on diagnostics"; that comment remains stale (03-02 recorded the same thing). The script's own
`RC -ne 0` logic is unaffected.

### The finding: M-03-13's primary literal is unusable, and its failure looks like a pass

The plan names `warnHost(` → `void (` as M-03-13's form. **Measured, it does not work, and the way
it fails is the exact failure mode this phase exists to catch.** The sink's call site is

```ts
  warnHost(
    `concierge: [${diagnostic.code}] action "${diagnostic.action}": ` +
      `${diagnostic.problem} Fix: ${diagnostic.fix}`,
  );
```

— a trailing comma, which is legal in an argument list and **illegal in a parenthesized
expression**. `void (…,)` is therefore a syntax error, rolldown fails with
`PARSE_ERROR … Parenthesized expressions may not have a trailing comma` at `src/catalog.ts:503`, the
gate exits 1 at the BUILD step, and the harness prints `PASS: gate fired (exit 1), tree clean`
**having never run a single test**. It reports the mutant caught while proving only that the build
rejects a syntax error.

Two forms were then measured, both with the build GREEN and both turning **exactly C12** red:

- `src/catalog.ts`: `warnHost(` → `String(` — the message is still composed and then discarded, so
  nothing reaches the host. This keeps the mutant in the file the plan wanted it in.
- `src/host.ts`: `host.console?.warn(message);` → `void message;` — the plan's own named fallback.

Both are written into the C12 case as a comment, so 03-08's sixteen-mutant battery re-run does not
rediscover the trap.

### The supplementary mutant, and why the plan's alternative form would have escaped

The plan offers a second M-03-9 form: "substitute the per-action `redaction_missing` push for the
same push followed by `throw new CatalogValidationError(issues);`". **Against this suite that mutant
would ESCAPE.** The four-bad-declarations fixture gives every action an explicit `redact: "drop"`,
so the `redaction_missing` push never runs in it at all; and C13 and C15, which do reach that push,
each carry exactly one issue, so throwing immediately after the push is indistinguishable from
throwing after the loop.

M-03-9's primary form (`issues.slice(0, 1)`) does fire, but it proves the *constructor* receives the
whole array rather than that the *loop* does not short-circuit. So **M-03-9b** was added: a genuine
mid-loop throw, placed on the emission-failure path the four-bad fixture hits three times. It fires,
which is the executable proof that the suite catches an actual short-circuit and not merely a
truncated argument.

## Measurements the plan required

### The four empty-shapes, re-measured through the real emitter at `draft-2020-12`

| Fixture | `properties` | `propertyNames` | `additionalProperties` | Resolves to |
|---|---|---|---|---|
| `zodEmptyObject` (`z.object({})`) | **present**, 0 own keys | absent | **ABSENT** | `"drop"`, no issue |
| `arktypeEmptyObject` (`type({})`) | **ABSENT** | absent | **ABSENT** | `"drop"`, no issue |
| `zodRecord` (`z.record(z.string(), z.string())`) | **ABSENT** | **present**, `{type:"string"}` | **PRESENT**, an **object** `{"type":"string"}` | **build FAILS** — `redaction_missing` |

Three consequences, each asserted in the suite rather than only recorded:

1. **`additionalProperties` is ABSENT on both genuinely-empty rows.** This is what settles 03-03's
   condition 4 as *present AND not `false`* rather than the shorter `additionalProperties !== false`
   — the short form reads an absent key as `undefined`, which is not `false`, and would turn both
   empty objects into build failures. C14 asserts the absence directly.
2. **Absent `properties` means two unrelated things.** arktype omits the key; zod writes
   `properties: {}`. C14 asserts both spellings.
3. **`zodRecord`'s `additionalProperties` is a schema OBJECT, not a boolean** —
   `typeof parameters.additionalProperties === "object"`, asserted in C15. `JsonSchemaObject`
   declares it `boolean`, so the declaration is still narrower than reality (Phase 4 hand-off from
   03-03 stands).

### The tamper, measured by consequence

Every one of these was observed against a real built catalog, in the suite and in a scratch probe:

| Claim | Observed |
|---|---|
| `catalog`, `catalog.entries`, `entries[0]`, `entries[0].action` all frozen | **true** |
| `entries[0].action.handler = attacker` | **throws `TypeError`**, and the handler is still the original by identity |
| `byName["applyFilter"] = evilEntry` | **throws `TypeError`**, and the lookup still resolves to the original entry |
| `Object.getPrototypeOf(catalog.byName)` | **`null`**; `byName.__proto__` and `byName.constructor` are both `undefined` |
| `entries[0].action.effects` frozen, `.destructive = true` | **frozen**, **throws**, value unchanged |
| `Object.isFrozen(entries[0].action.schema)` | **`false`** — the validator is skipped by design, and still `safeParse`s and still re-emits `type: "object"` afterwards |

Under M-03-7's shallow form, `Object.isFrozen(catalog)` alone still returned `true` — C17's first
expectation passes on the breach, which is why C18's **value** assertion is the load-bearing one.

### The default sink, and what it emitted

C12's capturing stand-in received **exactly one** message:

```
concierge: [destructive_without_consent] action "wipe": it declares `effects.destructive` but
carries no `consent` policy, so an agent can take an irreversible action with no human having
confirmed this specific payload. Fix: add a `consent` policy, or set `effects.destructive` to false
if the action is reversible.
```

### The four-issue aggregate

Five declarations, four faults, **one** throw. `err.issues.length === 4`, codes
`["schema_root_not_object", "schema_not_emittable", "schema_root_not_object",
"duplicate_action_name"]`, actions `["duUnion", "noHatch", "stringRoot", "applyFilter"]` — four
DISTINCT names, because the first `applyFilter` is valid and produces no issue of its own.
`issues[1].vendor === "valibot"`; `issues[3].vendor` is `undefined`, since a duplicate name is not a
property of any validator.

### arktype through the real path

`typeof arktypeObject === "function"` is asserted in C3 before the fixture is built, and the same
fixture is one of the two actions in C1. This is deliberate: 03-03's first DX-03 guard read
`typeof schema !== "object"` and would have rejected **every arktype action in existence** while
typechecking and building clean. No stand-in is used anywhere those cases run.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] M-03-13's specified literal produces a parse error, and the harness reports it as a PASS**

- **Found during:** Task 3, first M-03-13 run.
- **Issue:** `warnHost(` → `void (` yields `void (…,)`. A parenthesized expression may not carry a
  trailing comma, so rolldown fails with `PARSE_ERROR` at `catalog.ts:503` and the gate exits 1 at
  the **build** step. `PASS: gate fired (exit 1), tree clean` was printed with zero tests executed —
  the mutant proved the build rejects a syntax error, which was never in question, and proved
  nothing whatsoever about case 9b.
- **Fix:** Two working forms measured, both with a green build and both failing exactly C12:
  `warnHost(` → `String(` in `src/catalog.ts`, and the plan's named fallback
  `host.console?.warn(message);` → `void message;` in `src/host.ts`. Both were run; both PASS at gate
  exit 1. Recorded as a comment in the C12 case.
- **Files modified:** `packages/concierge/test/catalog.test.ts`
- **Commit:** `cd61422`

**2. [Rule 1 — Bug] The suite's own `vi.` prohibition comment violated the `vi.` prohibition**

- **Found during:** Task 1 acceptance greps.
- **Issue:** `grep -c 'vi\.' test/catalog.test.ts` returned **1**. The match was the comment
  explaining that this is a plain global assignment "not `vi.spyOn`". Unlike the `../src/` rule, the
  acceptance check for `vi.` is not scoped to non-comment lines, so a comment naming the forbidden
  thing fails it.
- **Fix:** The note spells the prefix out in prose (`spyOn`, `fn`, `mock`) and states explicitly why
  it does not write the literal. Count is now **0** in that file and across every file in `test/`.
- **Files modified:** `packages/concierge/test/catalog.test.ts`
- **Commit:** `0d9a4d4`

### Divergences from the plan text, recorded rather than reconciled

- **M-03-9's alternative multi-line form would ESCAPE against this suite**, for the reason given
  above (the four-bad fixture never reaches the `redaction_missing` push, and the two cases that do
  each carry exactly one issue). The primary form was used, and **M-03-9b** was added as a genuine
  mid-loop short-circuit so the aggregation claim is proved by the loop and not only by the
  constructor. This is a seventh mutant, not a substitution.
- **M-03-12 is spelled as the six-line `issues.push({…})` block, not as a short anchor.** Its first
  line, `      issues.push({`, occurs **4** times in the file; the FULL six-line literal occurs
  **exactly once**, confirmed with a `quotemeta` count before the run rather than inferred from the
  harness not aborting.
- **The artifact bindings are loaded in an async `beforeAll`, after the existence guard**, rather
  than statically imported. A static `import { buildCatalog } from "../dist/index.js"` would fail
  with an opaque module-resolution error on a fresh checkout **before** the guard could print the
  sentence telling a developer to run `pnpm build`. The guard body itself is verbatim from
  `single-instance.test.ts:59-66`.
- **Declarations are plain objects, not `defineAction(...)` calls.** `ActionDefinition.redact` is
  non-optional, so `defineAction` cannot express a declaration that omits it — and the entire
  population SEC-01's runtime half exists for is JavaScript consumers who omitted the field the type
  says they cannot omit. A suite that could only build well-typed declarations could not reach the
  `redaction_missing` branch at all. Stated in the file header.

### Deliberate non-assertions, written down rather than written as vacuous checks

Following `export-surface.test.ts:31-46`:

- **C12 does not assert what a host DOES with the message**, nor that a host with no `console`
  behaves any particular way. Core reaches `globalThis.console?.warn` structurally and `host.ts` says
  a host with no console is a supported host, so there is no behaviour there to pin.
- **C11 prints a real warning into the test run's own output.** That is expected, not a failure —
  it is the default sink doing its job on the one case that deliberately supplies no hook.

## Deferred / handed onward

- **03-08 (phase gate).** The mutant battery re-run must use `String(` or the `host.ts` fallback for
  M-03-13. The primary literal in 03-06-PLAN.md is unusable and its failure presents as a PASS.
- **03-08.** `scripts/mutate-and-prove.sh:32`'s "tsc exits 2 on diagnostics" is stale for the third
  time in this phase. Observed exit is **1** in all seven runs here, as in 03-02's two.
- **Phase 4.** C22 pins `Object.isFrozen(entries[0].action.schema) === false` as a POSITIVE claim, so
  "freeze everything" cannot be adopted later as an obvious tightening without a red test and a
  deliberate decision. `catalogFor`'s re-freeze obligation (03-03's hand-off) is unaffected and still
  outstanding.
- **`JsonSchemaObject.additionalProperties` is still declared `boolean` while `z.record` emits an
  object there.** C15 now asserts the object at runtime, so the divergence is executable rather than
  only recorded. `types.ts` was not touched (03-CONTEXT forbids it this phase; 03-08 owns it).

## Known Stubs

None. Every case asserts against the real built artifact and real published validators. No mock, no
stand-in validator, and no placeholder assertion exists anywhere in either file.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern and no schema change
at a trust boundary. It installs nothing — `pnpm install --frozen-lockfile` restored the existing
lockfile on a fresh worktree and added no package (T-03-SC).

All nine `mitigate` dispositions in the plan's threat register were implemented and measured:

| Threat | Evidence |
|---|---|
| T-03-27 (a SEC-03 test that only reads `Object.isFrozen`) | C18 asserts the handler VALUE; M-03-7 turns C17/C18/C19/C21 red |
| T-03-28 (`byName` swapped through the lookup) | C19 + C20; M-03-11 turns C20 red |
| T-03-29 (a diagnostic that only reaches the console) | C7–C9 and C11 read `catalog.diagnostics` or the hook, never the console |
| T-03-49 (the default warning silently not emitted) | C12; M-03-13 in both forms turns exactly C12 red with the build green |
| T-03-30 (redaction silently defaulting) | C13 and C15; M-03-12 turns both red |
| T-03-31 (a `buildCatalog` that stops arming PKG-04) | F4 asserts both directions; M-03-8 turns F4 red and leaves F1a/F1b/F2 green |
| T-03-32 (a mutated `dist/` surviving) | explicit `pnpm build` after every mutant; final `build && typecheck && test` all exit 0 |
| T-03-33 (a lockfile rewritten under a gate) | every gate ran `pnpm --config.verify-deps-before-run=false`; `git status --porcelain` empty |
| T-03-SC (package installs) | none performed |

## Requirements Satisfied

- **CAT-01** — C1, C2, C3: names in declaration order, `byName` by identity, emitted `parameters`,
  and a declared policy reaching the entry unchanged, all from one declaration array.
- **CAT-02** — C4/C5: both root-failure shapes (`oneOf` with no root `type`, and `type: "string"`)
  reported under `schema_root_not_object` with distinct diagnoses.
- **CAT-05** — C7: builds, and reports itself in `catalog.diagnostics` with a non-empty `fix`.
- **SEC-01** — C13, C14, C15, C16: both branches, the record trap, and `"passthrough"` surviving.
- **SEC-03** — C17–C22: tested by consequence, not by report.
- **SEC-05** — C8: a DIFFERENT code on a catalog carrying both markers, and the filter it enables.
- **DX-03** — C4, C5, C6: four issues in one throw, `action` and `fix` as fields plus two
  independent message regexes, and `name` set on the subclass.
- **PKG-04 / ROADMAP Phase 3 SC-5** — F4, mutant-proved by M-03-8.

## Self-Check: PASSED

Files verified present on disk in the worktree:

- `packages/concierge/test/catalog.test.ts` — FOUND
- `packages/concierge/test/single-instance.test.ts` — FOUND (modified)
- `.planning/phases/03-action-declaration-and-build-time-validation/03-06-SUMMARY.md` — FOUND

Commits verified in `git log`:

- `0d9a4d4` — FOUND
- `b70a344` — FOUND
- `cd61422` — FOUND

Scratch probes were written under `packages/concierge/.cache/` (gitignored) and removed.
`git status --porcelain` is empty apart from this summary.
