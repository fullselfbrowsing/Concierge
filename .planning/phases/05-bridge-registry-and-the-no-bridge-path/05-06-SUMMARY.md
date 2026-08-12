---
phase: 05-bridge-registry-and-the-no-bridge-path
plan: 06
subsystem: core-testing
tags: [typescript, type-tests, signature-pins, single-instance-guard, mutation-proof, esm]

# Dependency graph
requires:
  - phase: 05-bridge-registry-and-the-no-bridge-path
    plan: 01
    provides: "`createBridge`, `captureSnapshot`, `offPageResult` in `src/bridge.ts`, and `assertSingleInstance();` as the first statement of `createBridge`'s body"
  - phase: 05-bridge-registry-and-the-no-bridge-path
    plan: 03
    provides: "the three values reachable from the barrel at `src/index.js` and from `dist/index.js`, and the measured finding that P-05-1 surfaces as TS1485 at the shared IMPORT line"
  - phase: 02-packaging-and-the-single-instance-guard
    provides: "`test/single-instance.test.ts`, its `KEY`/`registry`/reset bindings, and the one-case-per-production-call-site convention"
  - phase: 01-type-surface-completion
    provides: "`test-d/_assert.ts`'s four aliases and the predicates-not-directives house rule"
provides:
  - "`test-d/bridge.test-d.ts` — 11 one-line predicates pinning `createBridge`, `captureSnapshot` and `offPageResult` from the public barrel"
  - "`test/single-instance.test.ts` F6 — mutant M-05-8's only detector, proven to be the ONLY red case in a 91-test suite"
  - "three measured negatives future plans should not re-derive: `const` type parameters are undetectable here, the `ReturnType` decomposition is blind to a removed default, and T-05-18 is caught by five cases rather than by F6 alone"
affects: [05-07, 06-dispatch, 09-adapters]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Whole-signature `Equals` against a GENERIC target type — `Equals<typeof createBridge, <B extends Bridge = Bridge>(id: string) => BridgeRegistry<B>>` holds under TS 7.0.2 and is strictly stronger than the `ReturnType`/`Parameters` decomposition"
    - "The choice of `Equals` over `Assignable` written as an executable predicate rather than a comment, so the argument for the spelling can itself go red"
    - "Prose fences as executable gates, inherited from 05-01: the acceptance greps forbid the literals the plan's own action text asks for, so every such reference is made descriptively"

key-files:
  created:
    - packages/concierge/test-d/bridge.test-d.ts
  modified:
    - packages/concierge/test/single-instance.test.ts

key-decisions:
  - "The plan's five named predicates were all kept AND a whole-signature `Equals` was added for `createBridge` and `captureSnapshot` — additive, because measurement showed the whole-signature form catches a removed default that the `ReturnType` form cannot"
  - "No predicate was weakened to `Assignable` to make it pass. The two `Assignable` predicates that exist are `Assignable` because assignability IS the claim (parameter optionality, and the executable proof that `Assignable` is blind to widening)"
  - "The plan's claim that `_createBridgeTakesOneString` covers 'did not silently gain a `const` type parameter' is measurably FALSE and is recorded as such in the file header rather than papered over"
  - "Requirements were NOT marked complete in REQUIREMENTS.md — see Deviations"

patterns-established:
  - "A negative control beside a positive pin: `_createBridgeReturnTypeTracksItsBridge` asserts the return type DIFFERS at a different bridge, which is what makes the positive `Equals` mean 'tracks B' rather than 'happens to match'"

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-07-31
---

# Phase 5 Plan 06: The type-level pins and the guard's third call site Summary

**Eleven one-line predicates in a new `test-d/bridge.test-d.ts` pin the three values Phase 5 barrels — proven red under three separate signature mutations — and `single-instance.test.ts` F6 gives mutant M-05-8 the only detector it has anywhere in the repository, measured as the single red case in a 91-test suite.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-31T22:09:52Z
- **Completed:** 2026-07-31T22:25:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments

- `test-d/bridge.test-d.ts` — 178 lines, 11 predicates, value imports from the barrel, zero exports, zero suppression directives. Every predicate is one physical line and every `type _` line contains `>;`.
- Three mutation probes run through `scripts/mutate-and-prove.sh`, each `PASS: gate fired (exit 1), tree clean`. The pins are proven to fire rather than assumed to.
- `test/single-instance.test.ts` F6 — the guard's third production call site and its first **direct** one. Proven to be M-05-8's **only** detector: under `assertSingleInstance();` deleted from `createBridge`, exactly 1 of 91 tests goes red, and it is F6.
- The header's stale `TWO production call sites` sentence moved to `THREE`; `grep -c` returns 0. F5's deliberate latitude paragraph is retained verbatim and F6's contrasting directness claim was added beside it, not over it.
- Suite moved 90 → **91**. `pnpm build`, `pnpm test`, `pnpm typecheck` and `pnpm check:deps` all green, tree clean.

## Task Commits

Each task was committed atomically:

1. **Task 1 (05-06-T1): `test-d/bridge.test-d.ts` — the signature pins** — `2add13f` (test)
2. **Task 2 (05-06-T2): `single-instance.test.ts` — F6, the third call site and the first direct one** — `94e5e53` (test)

## Files Created/Modified

- `packages/concierge/test-d/bridge.test-d.ts` (created, 178 lines) — header with five sections (what escapes, the terse-output caveat, the second diagnostic shape, what these predicates do NOT catch, house rules); two local fixture types; 11 predicates under three banners.
- `packages/concierge/test/single-instance.test.ts` (modified, 266 → 331 lines) — two hunks only: the header block at old `:56-70`, and F6 appended after F5. `git diff -U0` reports exactly three hunk ranges: `@@ -56,5 +56,9 @@`, `@@ -70,0 +75,13 @@`, `@@ -268,0 +286,45 @@`.

**Not modified, deliberately:** every file under `src/` (three were temporarily mutated by `mutate-and-prove.sh` and each run reported `tree clean`); `test/bridge.test.ts` and `test/bridge-snapshot.test.ts` (plans 05-04 and 05-05 own them in this same wave); `test-d/actions.test-d.ts` and `test-d/exports.test-d.ts`; and the shared orchestrator artifacts `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md`.

**Cases explicitly left untouched, verified by hunk range:** F1a (`:150-166` before the edit), **F1b** (`:168`, now `:185` — the one the plan flags as easy to clobber because it sits between F1a and F2), F2, F4 and F5. No hunk falls inside any of them.

---

## The eleven predicates and their final spellings

Every one is `Expect<…>` on a single physical line, named after the invariant it guards. `Assignable` appears twice and **neither is a weakening** — in both cases assignability is the claim itself.

| # | Line | Alias | Spelling | Why this spelling |
|---|------|-------|----------|-------------------|
| 1 | 140 | `_createBridgeSignature` | `Equals<typeof createBridge, <B extends Bridge = Bridge>(id: string) => BridgeRegistry<B>>` | **Whole signature, generic head included.** Not in the plan; added because measurement showed it is strictly stronger than the decomposition (see below) |
| 2 | 143 | `_createBridgeReturnsRegistryAtItsBridge` | `Equals<ReturnType<typeof createBridge<ResultsBridge>>, BridgeRegistry<ResultsBridge>>` | The plan's `_createBridgeReturnsRegistry`, at a concrete `B` |
| 3 | 146 | `_createBridgeReturnTypeTracksItsBridge` | `Not<Equals<ReturnType<typeof createBridge<ResultsBridge>>, BridgeRegistry<CartBridge>>>` | Negative control for #2, and the only reader of `CartBridge` — the dead-local guard the plan asks for |
| 4 | 149 | `_createBridgeTakesOneString` | `Equals<Parameters<typeof createBridge>, [id: string]>` | The plan's spelling, verbatim |
| 5 | 152 | `_createBridgeDefaultsToBridge` | `Equals<ReturnType<typeof createBridge>, BridgeRegistry<Bridge>>` | The plan's spelling, verbatim — with its actual discriminating power corrected in the JSDoc |
| 6 | 159 | `_offPageResultSignature` | `Equals<typeof offPageResult, (what: string, where: string) => ActionResult>` | `Equals`, per the plan. `grep -c "Assignable<typeof offPageResult"` → **0** |
| 7 | 162 | `_assignableStaysTrueUnderTheWideningEqualsCatches` | `Assignable<(what: unknown, where: unknown) => ActionResult, (what: string, where: string) => ActionResult>` | The executable form of #6's justification. Reads **true**, which is the proof that an `Assignable` spelling of #6 would be blind |
| 8 | 169 | `_captureSnapshotSignature` | `Equals<typeof captureSnapshot, <B extends Bridge>(bridge: B, id: string, normalize?: SnapshotNormalizer) => Record<string, unknown>>` | Whole signature; also the only reader of `SnapshotNormalizer` besides #10 |
| 9 | 172 | `_captureSnapshotReturnsPlainRecord` | `Equals<ReturnType<typeof captureSnapshot<ResultsBridge>>, Record<string, unknown>>` | The plan's spelling, verbatim |
| 10 | 175 | `_captureSnapshotAcceptsASnapshotNormalizer` | `Assignable<typeof captureSnapshot, (bridge: ResultsBridge, id: string, normalize: SnapshotNormalizer) => Record<string, unknown>>` | Assignability IS the claim: the seam accepts a normalizer |
| 11 | 178 | `_captureSnapshotNormalizerIsOptional` | `Assignable<typeof captureSnapshot, (bridge: ResultsBridge, id: string) => Record<string, unknown>>` | The plan's spelling, verbatim. Assignability IS the claim: optionality |

### No predicate needed the fallback, and none was weakened

The plan provides a `ReturnType`/`Parameters` decomposition as the deterministic fallback "if `Equals` on a generic-instantiation form does not hold under TypeScript 7.0.2". **It was not needed.** Every generic-instantiation `Equals` held on first measurement, including the two whole-signature forms that are not in the plan. The decomposed predicates (#2, #4, #5, #9) are present because the plan names them and because each puts a *different alias name* on the diagnostic a reader will be looking at — not because a stronger spelling failed.

**Confirmation, stated plainly as the plan's output section requires: no predicate was weakened to `Assignable` in order to pass.** The two `Assignable` predicates were `Assignable` by design from the first draft, and both were measured against their negative case before being kept (see the next section).

---

## Three measured negatives — record these rather than re-deriving them

All measured this session under the full repo flag set, in a scratch `test-d/` file deleted before the first commit.

### 1. A `const` type parameter is undetectable here, by any spelling

```
Equals<typeof createBridgeConst, <B extends Bridge = Bridge>(id: string) => BridgeRegistry<B>>   → TRUE
Equals<Parameters<typeof createBridgeConst>, [id: string]>                                       → TRUE
```

where `createBridgeConst` is declared `<const B extends Bridge = Bridge>(id: string): BridgeRegistry<B>`. TypeScript's type-identity relation ignores the `const` modifier.

**The plan's Task 1 action states that `_createBridgeTakesOneString` together with `_createBridgeReturnsRegistry` "covers … 'did not silently gain a `const` type parameter', the same pair `_createConciergeSignature` covers for `createConcierge`". That claim is false for `createBridge`, and the reason is structural rather than a spelling problem.** `concierge.test-d.ts:150` records that `_createConciergeSignature` *does* discriminate its own `const` variant — that works because the `const` there sits on a type parameter inferred from the `config` argument. `createBridge` has no such parameter: `id: string` mentions `B` nowhere, so there is nothing for `const` to change and the two signatures are genuinely identical.

The honest statement, which is what the file header now carries, is that `createBridge` gaining a `const` type parameter would be a **no-op** — a weaker claim than "it is guarded", and weaker in the direction that costs nothing. **Do not add a predicate claiming to cover it.**

### 2. The `ReturnType` decomposition is blind to the `= Bridge` default's removal; the whole-signature form is not

```
Equals<ReturnType<typeof createBridgeNoDefault>, BridgeRegistry<Bridge>>                          → TRUE   (blind)
Not<Equals<typeof createBridgeNoDefault, <B extends Bridge = Bridge>(id: string) => …>>           → TRUE   (catches it)
```

An uninferrable type parameter falls back to its **constraint**, and the constraint here is also `Bridge` — so deleting `= Bridge` moves nothing that `ReturnType` can see. This is the entire reason `_createBridgeSignature` was added on top of the plan's five: the plan's `_createBridgeDefaultsToBridge` JSDoc would otherwise have claimed a discrimination it does not have. Predicate #5's JSDoc now states what it *does* discriminate (a widened or narrowed constraint) instead.

### 3. Tuple labels do not affect `Equals`

`Equals<Parameters<typeof createBridge>, [id: string]>` and `Equals<…, [string]>` both read **true**. The label in predicate #4 is documentation, and the file says so.

---

## Mutation evidence — the pins are proven to fire

Four probes, all through `scripts/mutate-and-prove.sh`, which restores the file and proves the restoration. Gate commands are never piped (05-03's recorded trap).

### Probe A — `offPageResult`'s parameters widened to `unknown`. Gate: `pnpm typecheck`

```
pattern:     export function offPageResult(what: string, where: string): ActionResult
replacement: export function offPageResult(what: unknown, where: unknown): ActionResult

test-d/bridge.test-d.ts(159,39): error TS2344: Type 'false' does not satisfy the constraint 'true'.
PASS: gate fired (exit 1), tree clean
```

**Exactly one diagnostic, on `_offPageResultSignature`'s line, and nothing else in the repository moved.** This is the regression `Assignable` was measured blind to, and it is caught.

### Probe B — `createBridge` stops tracking `B`. Gate: `pnpm typecheck`

```
pattern:     … (id: string): BridgeRegistry<B> {
replacement: … (id: string): BridgeRegistry<Bridge> {

src/bridge.ts(285,3):            error TS2322: Type 'Readonly<BridgeRegistry<B>>' is not assignable to …
test-d/bridge.test-d.ts(140,38): error TS2344: Type 'false' does not satisfy the constraint 'true'.
test-d/bridge.test-d.ts(143,55): error TS2344: Type 'false' does not satisfy the constraint 'true'.
PASS: gate fired (exit 1), tree clean
```

`_createBridgeSignature` and `_createBridgeReturnsRegistryAtItsBridge` both red.

### Probe C — `captureSnapshot`'s third parameter becomes required. Gate: `pnpm typecheck`

```
pattern:     id: string, normalize?: SnapshotNormalizer)
replacement: id: string, normalize: SnapshotNormalizer)

test-d/bridge.test-d.ts(169,41): error TS2344: …
test-d/bridge.test-d.ts(178,52): error TS2344: …
PASS: gate fired (exit 1), tree clean
```

`_captureSnapshotSignature` and `_captureSnapshotNormalizerIsOptional` both red — so optionality is genuinely the claim, not decoration.

### Probe D — **M-05-8**. Gate: `bash -c 'pnpm build && pnpm test'`

```
pattern:     assertSingleInstance();
replacement: (empty)

× F6 — createBridge records this copy too, so the guard's third production call site, and its first DIRECT one, is asserted
  AssertionError: expected undefined to deeply equal { version: 1 }
  at packages/concierge/test/single-instance.test.ts:329:27

Tests  1 failed | 90 passed (91)
PASS: gate fired (exit 1), tree clean
```

**One red case out of 91, and it is F6.** This is the plan's central claim, measured: before this plan M-05-8 had no detector anywhere in the repository, and after it, it has exactly one.

⚠️ **Trap for 05-07, hit once here and worth carrying forward alongside 05-03's don't-pipe warning.** The first run of Probe D used the gate `pnpm test` alone and reported `FAIL: gate did NOT fire — mutant escaped` with all 91 tests green. It was correct to: `test/` runs against `dist/index.js`, and `dist/` still held the **pre-mutation** build. **Any mutation of `src/` asserted through the runtime suite must use a gate that rebuilds first.** A typecheck-gated mutation does not need this, because `tsconfig.test-d.json` reads `src/` directly. `dist/` was rebuilt after every runtime probe.

### Probe E — T-05-18, and a correction to the threat register's attribution

An extra probe, not required by the plan. `assertSingleInstance();` **added at module scope** (the form `"sideEffects": false` licenses a bundler to delete):

```
× F1b   × F2   × F4   × F5   × F6
Tests  5 failed | 86 passed (91)
PASS: gate fired (exit 1), tree clean
```

The plan's threat register assigns T-05-18's mitigation to "F6 half one". **That is true but understates the coverage: F4's and F5's half-one assertions catch it too, plus F1b (the bundler assertion) and F2.** F6's half one is a genuine detector and is correctly written; it is simply not the only one, and 05-07 should not treat it as a sole-detector case the way F6's half **two** genuinely is for M-05-8.

---

## Decisions Made

- **The plan's five `createBridge`/`captureSnapshot` predicates were all kept, and two whole-signature `Equals` pins were added on top.** This is additive, never substitutive: the plan forbids weakening a predicate to make it pass and says nothing against strengthening one. The trigger was measurement, not preference — the decomposition is blind to a removed default (negative #2 above), so shipping only the plan's spelling would have left `_createBridgeDefaultsToBridge`'s JSDoc claiming a discrimination it does not have.
- **A negative control was added rather than a second unrelated fixture being left dead.** The plan's dead-local guard says to tie an otherwise-unread local to a predicate. `CartBridge` is read by exactly one line, `_createBridgeReturnTypeTracksItsBridge`, and that line is not filler: it is what makes the positive `Equals` mean "tracks `B`" rather than "happens to match at this one instantiation".
- **The `Equals`-over-`Assignable` argument was made executable.** `actions.test-d.ts:469-476` and `concierge.test-d.ts:27-32` both make it in prose. Predicate #7 makes it a line that can go red, so if TypeScript's assignability rules ever changed, the comment that depends on them would stop being silently wrong.
- **The `@ts-expect-error` and `expectTypeOf` house rules are stated without naming either literal**, and the fixture comment refers to the registry-read predicate and the message-length constant descriptively. This is forced, not stylistic — see Issues Encountered.
- **F6's comment says `createBridge` reaches nothing else, and that was verified rather than inferred.** `grep -n "assertSingleInstance\|buildCatalog" src/bridge.ts` returns the import at `:97`, the call at `:195`, and two doc-comment mentions at `:36` and `:43`. `assertSingleInstance();` is the first statement of `createBridge`'s body at `:195`, immediately after the signature at `:194`.
- **The header edit also fixed a second staleness the plan did not name.** The original sentence read "the last case in this file, F5" — F5 is no longer last. Left alone it would have been a second false statement in the same paragraph the plan opened to correct the first.

## Deviations from Plan

### Auto-fixed issues

**None.** No bug, missing-critical-functionality or blocking issue arose. No Rule 1/2/3 fix was applied. No package was installed.

### Corrections to the plan's stated claims (not work changed)

1. **`_createBridgeTakesOneString` does not cover a `const` type parameter.** The plan asserts it does, by analogy to `_createConciergeSignature`. Measured false, and the analogy does not transfer because `createBridge` has no parameter `B` is inferred from. Recorded in the file header and in *Measured negative 1* above. Nothing was written to paper over it; the file states the weaker true claim.

2. **`_createBridgeDefaultsToBridge` does not discriminate the default's removal.** The plan says "Removing the default makes this red." Measured false — constraint fallback covers for it. Handled additively: `_createBridgeSignature` was added, which *does* catch it (measured), and predicate #5's JSDoc now describes what it actually discriminates.

3. **T-05-18 is caught by five cases, not by F6's half one alone.** Recorded above as Probe E.

### Two of the plan's `<action>` instructions contradict its own acceptance greps

Both were resolved in favour of the **acceptance criteria**, which are the gate:

| The action says to write | The verify command says | Resolution |
|---|---|---|
| "saying that the *assertion* `_registryReadIsNullable` is deliberately not duplicated here" | `! grep -qF "_registryReadIsNullable" $f` | Referred to descriptively: "the nullability assertion on the registry's `read` at `actions.test-d.ts:436`" |
| "Never `expectTypeOf`" and "predicates, never `@ts-expect-error`" in the house rules | `! grep -qE "@ts-expect-error\|expectTypeOf\|^export " $f` | Both rules stated in full without the literals, following `catalog.test-d.ts:82-86`'s established "**Zero suppression directives.**" phrasing |

This is 05-01's *prose fences as executable gates* pattern recurring: the argument must be made without naming the thing. Both rules survive intact in the header; only the tokens are routed around.

### Deliberate scope refusals

**REQUIREMENTS.md, STATE.md and ROADMAP.md were not touched**, following 05-01's and 05-03's precedent and this executor's explicit instruction that the orchestrator owns those writes after the wave completes. The plan's frontmatter lists `[BRG-01, BRG-03, BRG-05]`; two sibling agents are executing 05-04 and 05-05 in the same wave against the same rows.

**No source file was modified.** Three were temporarily mutated by `mutate-and-prove.sh` across five probe runs; every run printed `tree clean`, and `git diff --exit-code` at the repo root exits 0.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None. Two tasks, two commits, two files, every acceptance criterion met — with three of the plan's factual claims corrected by measurement rather than inherited.

## Issues Encountered

- **A runtime-suite mutation gate must rebuild `dist/` or it reports a fired gate as an escaped mutant.** Recorded above as the Probe D trap. This is the sibling of 05-03's don't-pipe finding: both produce a `FAIL: gate did NOT fire` line that a reader takes as evidence the pin is missing, when the pin is fine and the harness was misconfigured.
- **`sc7=1` had to occur exactly once, and the first draft had it twice.** The comment explaining the cache-busting rule originally enumerated the taken specifiers and named the new one. The acceptance criterion pins `grep -o "sc7=1" | wc -l` at exactly 1 — reasonably, since a comment naming a query string is one more place for it to go stale. The comment now carries the *rule* ("this case takes the next unused one, and a future case must do the same") without the enumeration, which is also how F5 phrases it.
- **`packages/concierge/node_modules` was absent in this worktree**, so `pnpm install --frozen-lockfile` ran before any gate — the same step 05-02 and 05-03 recorded. It resolved and downloaded nothing ("Lockfile is up to date, resolution step is skipped"; 234 packages, all reused from the store) and `pnpm-lock.yaml` is unmodified. **No package was added**, so the package-legitimacy checkpoint does not apply.

## Verification Evidence

| Gate | Result |
|---|---|
| `pnpm build` | exit 0; `attw` **No problems found**, `publint --strict` **No issues found** |
| `pnpm test` | `Test Files 7 passed (7)` / **`Tests 91 passed (91)`** (baseline 90, +1) |
| `pnpm test single-instance` | `Test Files 1 passed (1)` / `Tests 6 passed (6)` |
| `pnpm typecheck` | exit 0 |
| `pnpm check:deps` | Assertion A PASS, Assertion B PASS — `core's dependencies contribute zero bytes to a consumer bundle` |
| Barrel import rule | `grep -qF 'from "../src/index.js"'` ✅ and `from "../src/bridge.js"` **0** → `barrel import: OK` |
| House rules | `grep -qE "@ts-expect-error\|expectTypeOf\|^export "` → no match → `house rules: OK` |
| Predicate count | `grep -c "^type _"` → **11** (≥ 6 required) |
| One physical line each | `grep -n "^type _" \| grep -v ">;" \| wc -l` → **0** |
| No duplication / no blind guard | `_registryReadIsNullable` **0**, `MESSAGE_MAX_CHARS` **0** → `no duplication, no blind guard: OK` |
| `offPageResult` spelling | `grep -c "Assignable<typeof offPageResult"` → **0** |
| Terse-output caveat | ``grep -n "exits \*\*1\*\*, not 2, under typescript 7.0.2"`` → `:49` |
| F6 present | `?sc7=1` ✅, `createBridge("results")` ✅, `it("F6` ✅ → `F6 present: OK` |
| Stale prose | `grep -c "TWO production call sites"` → **0** |
| Query-string uniqueness | `grep -o "sc7=1" \| wc -l` → **1** |
| F1a/F1b/F2/F4/F5 untouched | `git diff -U0` hunk ranges: `-56,5`, `-70,0`, `-268,0` — none inside any case. F1b now at `:185` |
| Vitest mocking API | `grep -rn "vi\.mock\|vi\.fn\|vi\.spyOn"` across `test/` and `test-d/` → **0** |
| Probe A (offPageResult widened) | `PASS: gate fired (exit 1), tree clean` — 1 diagnostic, `bridge.test-d.ts(159,39)` |
| Probe B (createBridge drops `B`) | `PASS: gate fired (exit 1), tree clean` — `bridge.test-d.ts(140,38)`, `(143,55)` |
| Probe C (normalizer required) | `PASS: gate fired (exit 1), tree clean` — `bridge.test-d.ts(169,41)`, `(178,52)` |
| Probe D (**M-05-8**) | `PASS: gate fired (exit 1), tree clean` — **1 failed / 90 passed, and the 1 is F6** |
| Probe E (module-scope hoist) | `PASS: gate fired (exit 1), tree clean` — 5 failed: F1b, F2, F4, F5, F6 |
| `git diff --exit-code` at repo root | exit **0**, tree clean after all commits and all five probes |
| Shared artifacts | `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md` — not in the diff |
| Files owned by sibling wave-3 agents | `test/bridge.test.ts`, `test/bridge-snapshot.test.ts` — not in the diff |

## Known Stubs

**None.** This plan adds no placeholder, no hardcoded empty value and no unwired data path. Every predicate and every assertion it adds was individually observed red under a mutation before being recorded as coverage.

## Threat Flags

**None.** This plan adds no network endpoint, auth path, file access pattern or schema change. Both files are test-only and neither reaches the published surface: the export surface stays at 65 / 51 / 14, unchanged.

## User Setup Required

None.

## Next Phase Readiness

**Wave 3 complete from this plan's side; 05-07 is unblocked.**

- **05-07's mutation battery** can take Probes A–E above verbatim, including the exact pattern/replacement pairs and the expected `file:line` sets. Four things it needs that are easy to get wrong:
  1. **A `src/` mutation asserted through `pnpm test` MUST rebuild first.** `bash -c 'pnpm build && pnpm test'`, never `pnpm test` alone — the runtime suite reads `dist/`, and a stale `dist/` reports a fired gate as an escaped mutant.
  2. **Never pipe a gate command** (05-03's finding, independently reconfirmed by the shape of the failure above).
  3. **Assert a `test-d/` mutant on exit code plus `file:line`, never by grepping for a predicate's alias name.** Non-TTY output carries neither the alias nor the echoed source line.
  4. **P-05-1 now reddens SIX TS1485 across TWO files**, not three across one: `exports.test-d.ts:73` and `bridge.test-d.ts`'s barrel import line both carry the three values.
- **M-05-8's status changed from "no detector anywhere" to "exactly one detector, proven".** If 05-07's battery finds any other case going red under it, that is new information and should be investigated — the measurement here says there is none.
- **Do not add a `const`-type-parameter predicate to `bridge.test-d.ts`.** Measured undetectable, for a structural reason recorded in the file header. Adding one would produce a line that reads as coverage and is not.
- **Phase 9's adapters** get `_captureSnapshotNormalizerIsOptional` as the compile-time guarantee behind the two-argument `captureSnapshot(bridge, id)` call every framework except Svelte makes, and `_captureSnapshotAcceptsASnapshotNormalizer` behind Svelte's `$state.snapshot` seam.

**No blockers.**

## Self-Check: PASSED

- `packages/concierge/test-d/bridge.test-d.ts` — FOUND (178 lines)
- `packages/concierge/test/single-instance.test.ts` — FOUND (331 lines)
- `.planning/phases/05-bridge-registry-and-the-no-bridge-path/05-06-SUMMARY.md` — FOUND
- Commit `2add13f` — FOUND in git log
- Commit `94e5e53` — FOUND in git log
- Working tree clean; no shared orchestrator artifacts (STATE.md, ROADMAP.md, REQUIREMENTS.md) modified; no file owned by a sibling wave-3 agent modified.

---
*Phase: 05-bridge-registry-and-the-no-bridge-path*
*Completed: 2026-07-31*
