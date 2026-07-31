---
phase: 05-bridge-registry-and-the-no-bridge-path
plan: 07
subsystem: validation
tags: [mutation-testing, phase-gate, prose-audit, packaging-gates, sign-off]

# Dependency graph
requires:
  - phase: 05-bridge-registry-and-the-no-bridge-path
    plan: 01
    provides: "`src/bridge.ts` and its eight recorded mutation anchors, each unique unfiltered, plus the `makeDefaultNormalizer(` count of 2 that proves M-05-3 is on a live call path"
  - phase: 05-bridge-registry-and-the-no-bridge-path
    plan: 02
    provides: "`resolveBridge`, the three corrected doc comments, and the measured `if (registry === undefined)` collision with the multi-line literal that resolves it"
  - phase: 05-bridge-registry-and-the-no-bridge-path
    plan: 03
    provides: "the barrel, all eleven export pins at 65/51/14, and the measurement that `src/index.ts`'s header does not reach `dist/`"
  - phase: 05-bridge-registry-and-the-no-bridge-path
    plan: 04
    provides: "`test/bridge.test.ts` B1-B21 and the case-id-to-mutant map"
  - phase: 05-bridge-registry-and-the-no-bridge-path
    plan: 05
    provides: "`test/bridge-snapshot.test.ts` D1-D21, the DX-03 review verdict, and the rebuild-after-every-probe trap"
  - phase: 05-bridge-registry-and-the-no-bridge-path
    plan: 06
    provides: "`test-d/bridge.test-d.ts` and F6 — M-05-8's only detector"
provides:
  - "seventeen of seventeen register mutants run and caught, each with a confirmed successful build, a non-zero test count, and named failing cases"
  - "the shipped-prose audit, green in both directions, with every literal shown able to fire and every count taken through two different grep binaries"
  - "four packaging gates green, a byte-identical lockfile, and a clean tree"
  - "`05-VALIDATION.md` completed and signed off with `nyquist_compliant: true`"
  - "BRG-01..BRG-05 and DX-02 recorded closed in `REQUIREMENTS.md`"
affects: [06-dispatch, 08-consent-kernel, 09-adapters]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A PASS is the gate's OUTPUT, never its exit code — every one of seventeen confirmed to have compiled and to have run a non-zero number of tests before being recorded"
    - "A negative control run deliberately: M-05-8 was run under the filter it ESCAPES, so the register records why F6 exists rather than asserting it"
    - "Audit greps taken twice, through two different binaries, plus a positive control per file proving the file was actually read — a zero from an unopened file is the same defect as a grep that cannot fail"

key-files:
  created:
    - .planning/phases/05-bridge-registry-and-the-no-bridge-path/05-07-SUMMARY.md
  modified:
    - .planning/phases/05-bridge-registry-and-the-no-bridge-path/05-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "M-05-5 was probed on all three of its arms rather than one, because the Date/Map/Set branch is three separate `if` statements and one literal can only disable one"
  - "The M-05-8 gate is the `single-instance` filter, and the bridge-filter escape was run and recorded as evidence rather than left as a claim"
  - "`nyquist_compliant: true` was set, with the warrant written out as three measured claims rather than asserted"
  - "PKG-04's automated command in the register was corrected — it named a filter the mutant provably escapes, which is a wrong entry rather than an imprecise one"

patterns-established:
  - "Correct a register entry only when a measurement contradicts it, and record the measurement beside the correction — three claimed detectors were disproven here, which is what makes the other fourteen credible"

requirements-completed: [BRG-01, BRG-02, BRG-03, BRG-04, BRG-05, DX-02]

# Metrics
duration: 20min
completed: 2026-07-31
---

# Phase 5 Plan 07: The phase gate Summary

**Seventeen of seventeen register mutants run and caught with zero escapes, every PASS confirmed from the gate's own output to have compiled and to have run tests; the shipped-prose audit green in both directions with each literal shown able to fire; four packaging gates green on a byte-identical lockfile; and `05-VALIDATION.md` signed off with `nyquist_compliant: true` after three of its claimed detectors were disproven by measurement and corrected.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-31T17:34Z (local)
- **Completed:** 2026-07-31T17:54Z (local)
- **Tasks:** 3
- **Files modified:** 2 (plus this SUMMARY)

## Task Commits

1. **Task 1 (05-07-T1): The twelve `src/bridge.ts` mutants** — `2ff43d5` (test)
2. **Task 2 (05-07-T2): The five `concierge.ts` / `index.ts` / `types.ts` mutants** — `4e17bf6` (test)
3. **Task 3 (05-07-T3): Prose audit, packaging gates, sign-off** — `75ebc44` (docs)

## Files Created/Modified

- `.planning/phases/05-bridge-registry-and-the-no-bridge-path/05-VALIDATION.md` — the mutation battery results, the shipped-prose audit, the packaging-gate table, the completed per-task map, the DX-03 verdict, both deferrals, and the sign-off.
- `.planning/REQUIREMENTS.md` — BRG-01..BRG-05 and DX-02 closed in both the checkbox list and the traceability table.

**No source or test file was modified.** `git diff --name-only f0e9a76..HEAD` lists exactly the two planning files above. `STATE.md` and `ROADMAP.md` were not touched — the orchestrator owns those.

---

## The seventeen-mutant battery

Baseline before the first probe: **133 tests / 9 files**, `pnpm build` clean through `attw` and `publint --strict`, `pnpm typecheck` exit 0, `git status --porcelain` empty.

**Every occurrence count below was taken UNFILTERED**, comments left in, with `grep -o -F "<literal>" <file> | wc -l` — or, for the two multi-line literals, `String.split(literal).length - 1` over the raw file. **Every count is 1.** No mutant returned exit 3 (no-op), exit 2 (dirty/untracked) or exit 4 (not restored).

**Pre-flight abort check, cleared before M-05-3:** `makeDefaultNormalizer(` occurs **exactly 2** times, unfiltered and comment-stripped alike. Had it been 1, the normalizer would have been inlined anonymously, M-05-3 would have mutated an uninvoked function, and the run would have been recorded as an escape when the truth is that the mutant never executed.

| ID | Target | Final literal → replacement | Count | Exit | Build OK | Tests ran | Cases red |
|---|---|---|---|---|---|---|---|
| M-05-1 | `src/bridge.ts` | `if (slot?.token === token)` → `if (slot?.bridge === bridge)` | 1 | **0 PASS** | ✔ attw + publint clean | **42** | B10 (O1b), B11 (O2b), B12 (O4b), B13 (O4c), B20 |
| M-05-2 | `src/bridge.ts` | the 3-line guarded block, 8/10/8 indent → `slot = null;` | 1 | **0 PASS** | ✔ | **42** | B6, B7, B8, B9, B10, B11, B12, B13, B20 |
| M-05-3 | `src/bridge.ts` | `cloneDetached(value, seen, onExotic) as T` → `Object.freeze(value) as T` | 1 | **0 PASS** | ✔ | **42** | **D1**, D3, D4, D5, D6, D7, D8, D9, D11, D12 |
| M-05-4 | `src/bridge.ts` | `seen.get(obj)` → `undefined` | 1 | **0 PASS** | ✔ | **42** | **D2** (cycle), **D3** (DAG) |
| M-05-5 | `src/bridge.ts` | `obj instanceof Date \|\| tag === "[object Date]"` → `false` | 1 | **0 PASS** | ✔ | **42** | **D7**, D12 |
| M-05-5b | `src/bridge.ts` | the `Map` arm of the same branch → `false` | 1 | **0 PASS** | ✔ | **42** | **D7** |
| M-05-5c | `src/bridge.ts` | the `Set` arm of the same branch → `false` | 1 | **0 PASS** | ✔ | **42** | **D7** |
| M-05-6 | `src/bridge.ts` | `proto === Object.prototype \|\| proto === null` → `proto === Object.prototype` | 1 | **0 PASS** | ✔ | **42** | **D6** |
| M-05-7 | `src/bridge.ts` | `return Object.freeze(registry);` → `return registry;` | 1 | **0 PASS** | ✔ | **42** | **B16**, **B17**, **B18** |
| M-05-8 | `src/bridge.ts` | `assertSingleInstance();` → *(empty)*; gate `pnpm exec vitest run single-instance` | 1 | **0 PASS** | ✔ | **6** | **F6** — `expected undefined to deeply equal { version: 1 }` |
| M-05-9 | `src/bridge.ts` | `normalizeValue(getter())` → `getter()` | 1 | **0 PASS** | ✔ | **42** | **D1**, D3, D4, **D5**, D6, D7, D9, D11, D12 |
| M-05-10 | `src/bridge.ts` | `warnedOverwrite = true;` → *(empty)* | 1 | **0 PASS** | ✔ | **42** | **B19** — `expected […(3)] to have a length of 1 but got 3` |
| M-05-11 | `src/bridge.ts` | `if (slot?.token === token) {` → a `warnHost` on the refusal condition, then the original line | 1 | **0 PASS** | ✔ | **42** | **B20** — `expected [Array(1)] to have a length of +0 but got 1` |
| M-05-12 | `src/bridge.ts` | `message.slice(0, MESSAGE_MAX_CHARS)` → `message` | 1 | **0 PASS** | ✔ | **42** | **D19** — `to have a length of 180 but got 249` |
| M-05-13 | `src/concierge.ts` | `return registry.read() ?? null;` → `return null;` | 1 | **0 PASS** | ✔ | **42** | **D15** — declared-and-**mounted**: `registered: false` where `true` was asserted |
| M-05-14 | `src/concierge.ts` | anchored 5-line block; `bridgeStatus`'s `return null;` → `return { id: "", registered: false };` | 1 *(anchored)* | **0 PASS** | ✔ | **133** | **D17**, **S20**, plus D20, S24 |
| P-05-1 | `src/index.ts` | the barrel line → `export type { createBridge } …` + `export { captureSnapshot, offPageResult } …` | 1 | **0 PASS** | n/a (typecheck gate) | 2 diagnostics | TS1485 ×2 naming `createBridge` |
| P-05-2 | `src/index.ts` | same line → `export { createBridge, captureSnapshot } …` + `export type { offPageResult } …` | 1 | **0 PASS** | n/a | 2 diagnostics | TS1485 ×2 naming `offPageResult` |
| P-05-3 | `src/types.ts` | `read: () => B \| null;` → `read: () => B;` | 1 | **0 PASS** | n/a | 2 diagnostics | `test-d/actions.test-d.ts(436,39)` TS2344, plus `src/bridge.ts(221,27)` TS2322 |

The register's seventeen are M-05-1 … M-05-14 plus P-05-1/2/3. M-05-5b and M-05-5c are supplementary probes of the same register entry, listed for completeness — see finding 4.

**`git status --porcelain` was empty before the first probe and after the last.** `dist/` was rebuilt from unmutated source after every probe and the full suite re-run green at 133 before each commit.

### Escapes

**None among the seventeen.** One escape was produced *deliberately*, as a negative control — see finding 5. It names no coverage gap; it is the measurement that justifies F6's existence.

---

## Ten findings the exit codes alone do not carry

1. **The five contract pins stay GREEN under M-05-1 — observed, not inferred.** M-05-1 was re-run under `--reporter=verbose` so the passing cases print by name. `B1` (O6), `B2` (O1), `B3` (O3), `B4` (O5) and `B5` (O7) each printed `✓` while B10–B13 printed `×`. That is the empirical confirmation of the `CONTRACT PIN` label, which asserts exactly this and nothing wider. All five also stay green under M-05-2.

2. **M-05-3's output contains ZERO `TypeError`** (grepped explicitly). A `TypeError` would have meant the criterion-4 fixture is a Shape B or E proxy rather than Shape F — Pitfall 2 — and the case would have been proving its own proxy malformed rather than proving the normalizer fails to detach. D1's failure is the intended `expected 'boots' to be 'shoes'`.

3. **M-05-4's cycle case surfaces as an absent key, not as a visible `RangeError`.** The infinite recursion throws `RangeError: Maximum call stack size exceeded` *inside* `captureSnapshot`'s `try`, which catches it and writes `out[key] = undefined`. D2 therefore fails at `expect(result.self).toBe(result)` with `TypeError: Cannot read properties of undefined (reading 'self')` at `bridge-snapshot.test.ts:332`. The test ran and failed; the string `Maximum call stack` does not appear anywhere in the output because the guard swallowed it. Recorded so a later reader does not go looking for the wrong evidence.

4. **M-05-5's three arms were each probed independently, because one literal can only disable one.** The `Date`/`Map`/`Set` detection is three separate `if` statements. All three PASS. The Date arm reddens D7 **and D12**; the Map and Set arms redden D7 alone. D12's extra redness is informative rather than noise — its exotic fixture is a naively-proxied `Date`, and its `[snapshot_exotic]` warning is emitted from that branch's extraction `catch`. Disable the branch and the value falls straight through to pass-by-reference, so it is carried live *without* a warning. That is precisely the invisible hole the exotic-warn signal path exists to close, and it is now measured rather than argued.

5. **M-05-8 escapes the bridge suite, and the escape was run rather than asserted.** Under `pnpm exec vitest run bridge` the same mutant returns **exit 1 — `FAIL: gate did NOT fire — mutant escaped`** with all 42 bridge cases green. That is the correct result and is the whole reason plan 05-06 wrote F6: before it, M-05-8 had no detector anywhere in the repository. **The register's PKG-04 row named that escaping filter as its automated command, and it has been corrected** — this is a wrong entry, not merely a vacuous one. The plan's documented `pnpm test -- single-instance` form was also run and also PASSes, as the superset it is, at 1 failed / 132 passed of 133.

6. **The M-05-14 collision is real and was handled, not assumed away.** The bare literal `if (registry === undefined)` measures **2** occurrences unfiltered in `src/concierge.ts` — `:238` inside `resolveBridge` and `:301` inside `bridgeStatus`. The harness replaces the FIRST, and `resolveBridge` is written immediately before `bridgeStatus`, so a naive pattern mutates the wrong function to no observable effect and records an escape that is an artefact of the pattern rather than a coverage gap. The pattern used anchors to `bridgeStatus` by carrying the following blank line and the `const live: Bridge | null = resolveBridge(stage);` statement; **the anchored form measures exactly 1.**

7. **M-05-14 is a value substitution, and the build succeeding is the proof it is not a delete.** Deleting `bridgeStatus`'s early return leaves `registry` typed `BridgeRegistry<any> | undefined` at the `registry.id` read, so `tsc` rejects it — a build-step exit 1 the harness cannot distinguish from a failing assertion, i.e. a vacuous PASS having run zero tests. Returning `{ id: "", registered: false }` satisfies `StageExplanation["bridge"]`, compiles clean through attw and publint, and collapses the not-declared state into the declared-but-unmounted one. **133 tests ran.** All four red cases report the same thing — `expected { id: '', registered: false } to be null` — and D20/S24 are collateral readers of the same `explain()` row. This differs from 05-05's measurement of the *delete* spelling, where the same cases went red because `explain()` threw. Both spellings are caught; only one of them proves a test.

8. **P-05-1 and P-05-2 surface as TS1485 at a shared IMPORT line, across TWO files.** Not TS2344 on the predicate line named after the symbol. No result was recorded by grepping for a predicate's alias name, which non-TTY `tsc` output never prints. Verbatim:

   ```
   P-05-1  test-d/bridge.test-d.ts(107,27):  error TS1485: 'createBridge' resolves to a type-only declaration …
           test-d/exports.test-d.ts(73,118): error TS1485: 'createBridge' resolves to a type-only declaration …
   P-05-2  test-d/bridge.test-d.ts(107,41):  error TS1485: 'offPageResult' resolves to a type-only declaration …
           test-d/exports.test-d.ts(73,149): error TS1485: 'offPageResult' resolves to a type-only declaration …
   ```

   `tsc` exits **1**, not 2, under TypeScript 7.0.2 — confirmed on both runs. The second file is new since 05-03 measured this: `test-d/bridge.test-d.ts` landed in 05-06 and its barrel import carries the same three values, so the placement guard now has two independent readers.

9. **P-05-3 now has two detectors where it had one.** `test-d/actions.test-d.ts(436,39)` is `_registryReadIsNullable`, the pre-existing predicate 05-06 deliberately did not duplicate — and `actions.test-d.ts:433` records that before that line existed this exact mutation escaped the full four-file suite at exit 0. The second, `src/bridge.ts(221,27) TS2322: Type 'B | null' is not assignable to type 'B'`, is new this phase: `createBridge`'s `read` is now an implementation that stops conforming when the interface loses its nullability.

10. **Pin 2 (`is exactly 65 names`) does NOT cover P-05-1, and the register no longer implies it does.** Moving values into the `export type` block re-files them rather than removing them: names stay 65 while types go 51 → 54 and values go 14 → 11. Pins 3 and 5 (the split) and pin 6 (the by-name loop, made able to fire by pin 7's array growth) are the runtime detectors; the three TS1485 predicates are the type-layer ones.

---

## The shipped-prose audit

Run after `pnpm build`, because the defect is defined by what **ships**. Every literal has a recorded pre-correction count taken against the uncorrected tree by the plan that made the correction, so none of these is a grep that never matched.

### Negative half

| Grep | File | Baseline | Now | Baseline recorded by |
|---|---|---|---|---|
| `deep freeze` | `dist/index.d.ts` | **2** (`:553`, `:1409`) | **0** | 05-02 |
| `deep freeze` | `dist/index.js` | 0 | **0** | 05-02 |
| `deep freeze` | `src/types.ts` | **2** | **0** | 05-02 |
| `not yet constructible` | `src/index.ts` | **1** | **0** | 05-03 |

Both `dist/index.d.ts` baseline hits were emitted from `src/types.ts` — the JSDoc for `SnapshotNormalizer` and for `ConciergeConfig.normalizeSnapshot`. **Those claims genuinely shipped**, so that row is a real 2 → 0 against a real artifact.

### The fourth row is a SOURCE audit, and the distinction is load-bearing

`05-PATTERNS.md:492-493` instructs a `dist/` grep for `not yet constructible`. **It is wrong on this point.** `src/index.ts`'s module header does not reach the built artifacts at all, so a `dist/` grep returned **0 on the uncorrected tree too** and would have read in a report exactly like coverage — threat T-05-12, an audit that cannot fail. Re-proven at the gate with a sentence this phase **never edited**, from the same paragraph the stale clause lived in:

| Literal | `src/index.ts` | `dist/index.d.ts` | `dist/index.js` |
|---|---|---|---|
| `Stated plainly so this is not oversold` (**unedited**) | **1** | **0** | **0** |
| `not yet constructible` | 0 (baseline 1) | 0 | 0 |

An untouched sentence present in source and absent from both artifacts is the proof that the entry module's header does not ship. The audit target is `packages/concierge/src/index.ts`.

### Positive half

| Literal | Where | Pre-correction baseline | Now |
|---|---|---|---|
| `read traps` / `write traps` (the mechanism sentence) | `dist/index.d.ts:1428` | — | **1** each |
| `the first direct production call site` (the `contract.ts` re-scope anchor) | `dist/index.d.ts:2107` | **0** in `dist/index.d.ts`, `dist/index.js` **and** `src/contract.ts` | **1** |

The anchor is grepped with **`-F`**, as a fixed string fixed in the plans at both ends. **No gate reads `/tmp` and none parses a SUMMARY.** Verified: `$(cat` occurs twice in `05-07-PLAN.md`, at `:362` and `:451`, and **both are prose** — the `<automated>` blocks are at `:190-197`, `:294-299` and `:426-437` and contain none.

### `createBridge` in `dist/index.d.ts` — an observation, NOT a check

**9** lines. Pre-change baseline **1**, at `:1245`, emitted from `src/types.ts:1446`. An assertion on the bare identifier could not have failed even then, and 05-03 added more occurrences unconditionally. Recorded for completeness; asserted on by nothing.

### The grep binary is not what it looks like, and this mattered

`grep` on this shell resolves to a **shell function wrapping ugrep 7.5.0**, not GNU or BSD grep — which is exactly why the anchor gate is specified with `-F` rather than relying on any one platform's error behaviour. Every count above was taken **twice**, once through that wrapper and once through `/usr/bin/grep`, and the two agree on every row. The four zeros were additionally proven non-vacuous by positive controls showing each file is genuinely read: `SnapshotNormalizer` → 5 in `src/types.ts`, `no_bridge` → 2 in `dist/index.js`, `Stated plainly so this is not oversold` → 1 in `src/index.ts`, `read traps` → 1 in `dist/index.d.ts`. **A zero from a file that was never opened is the same defect as a grep that cannot fail.**

---

## The four packaging gates, and the rest of the phase-close state

| Gate | Result |
|---|---|
| `pnpm check:deps` | exit **0** — Assertion A `unbundled external imports: []`, Assertion B `@standard-schema/spec 0 bytes`; *core's dependencies contribute zero bytes to a consumer bundle* |
| `pnpm check:artifact` | exit **0** — `publint --strict` clean; `attw --pack --profile esm-only` 🟢 on node16-from-ESM and bundler, node10 and node16-from-CJS ignored per resolution |
| `pnpm check:pack` | exit **0** — a foreign npm project installed the tarball, typechecked the shipped `.d.ts` with `skipLibCheck: false`, and imported the runtime (5 s) |
| `pnpm check:node-floor` | exit **0** — the tarball installed and imported on a pinned **v22.12.0** (10 s) |
| `pnpm build` | exit **0**, `attw` No problems found, `publint --strict` No issues found |
| `pnpm test` | **`Test Files 9 passed (9)` / `Tests 133 passed (133)`** |
| `pnpm typecheck` | exit **0** |
| `git diff --exit-code pnpm-lock.yaml` | exit **0** — byte-identical; zero packages installed this phase, proven rather than asserted |
| `git status --porcelain` | empty |
| `test/fixtures/` | `git log cbd2833..HEAD -- packages/concierge/test/fixtures/` → **zero commits**; nothing added there in Phase 5 |

---

## The DX-03 review verdict, restated

**Discharged by plan 05-05 with a recorded PASS; cited here, not redone.** VALIDATION.md marks it a plan-author review obligation because a regex over `/open|go to|navigate/i` pins vocabulary rather than meaning — red on a legitimate rewording that still names an action, green on "the page is not open", which names no action at all while containing the word.

The shipped sentence, measured by executing `dist/index.js`:

> "The result count is not available because the results page is not open. Open the results page and try again."

`message.length` = **108** against a `MESSAGE_MAX_CHARS` of 180 — 72 characters of headroom, matching plan 05-01's independent measurement exactly.

**VERDICT: PASS.** Two clauses doing two different jobs. The first names the fault *and its cause* ("is not available **because** the results page is not open"), which is where a merely-diagnostic message stops. The second is an imperative naming a concrete next action, and it names *which* page — "**Open the results page** and try again". It does not say "the bridge is not registered", which would be true, internal and unactionable to the reader; nor "try again later", which would be an action that fixes nothing.

The two automated halves that *do* carry weight are both asserted and both measured to discriminate: D19's `message.length` bound read from the artifact's own `MESSAGE_MAX_CHARS` export (red under M-05-12 at `length of 180 but got 249`), and D18's `expect(() => handler(ctx)).not.toThrow()`.

---

## Corrections made to `05-VALIDATION.md`

Every one is backed by a measurement recorded beside it.

| Was | Now | Why |
|---|---|---|
| `### Mutant register (15)` | **(17)** | It already listed seventeen; every plan and the ROADMAP say seventeen. A count in a heading disagreeing with the rows beneath it is the defect class `export-surface.test.ts`'s `it`-titles exist to catch |
| Every Task ID / Plan cell `TBD` | filled with the task that *discharges* the row | — |
| Every Status cell `⬜ pending` | ✅ green | — |
| Every `❌ W0` File Exists cell | ✅ with the committed file and case ids | — |
| PKG-04 command `pnpm test -- bridge → M-05-8` | **`pnpm exec vitest run single-instance`** | Measured: M-05-8 **escapes** the bridge filter at 42/42 green. A wrong entry, not an imprecise one |
| "Seven export pins move together" | **eleven**, plus a twelfth plan-directed correction | Counted |
| `62/51/11 → 64/51/13` (RESEARCH § Q5) | **62/51/11 → 65/51/14** | Superseded by CONTEXT's +3-values decision; measured against the built artifact |
| Shape F fixture "inline in `test/bridge.test.ts`" | inline in **`test/bridge-snapshot.test.ts`** | The two-file split. The substantive constraint — **not** in `test/fixtures/` — is unchanged and was honoured |
| Quick-run command `pnpm test -- bridge` | `pnpm exec vitest run bridge` | The former does not filter under pnpm 11.17.0; sound but vacuous |
| M-05-8 "PKG-04's second call site" | **third**, and its first DIRECT one | 05-06 counted them |
| Estimated runtime "87-test baseline" | **133-test**, 336 ms across 9 files | Re-measured |

Two things the register got **right** and which were left alone: the `types.ts` `deep freeze` claims genuinely do ship (2 → 0 in `dist/index.d.ts`), and `src/bridge.ts`'s object-guard ordering count was already corrected from ten to nine by the orchestrator in `934b53f`.

---

## Decisions Made

- **`nyquist_compliant: true` was set, and the warrant is written into the file rather than implied.** Three measured claims carry it: latency (336 ms for 133 tests, no watch-mode flag anywhere), discrimination (seventeen of seventeen caught, each with a named failing case and a confirmed build), and honesty about the gaps (five orderings plus D14 and D10 labelled non-discriminating and counted as contract pins rather than validation; two success-criterion halves deferred with a named phase and a written authority). A register that only ever adds coverage is not measuring anything, which is why the three disproven detectors are recorded as prominently as the fourteen confirmed ones.
- **M-05-5 was probed three times rather than once.** The plan names one literal; the branch is three `if` statements and one literal disables one arm. Running all three converts "the Date/Map/Set branch is covered" from an inference about structural similarity into a measurement, and it surfaced the D12 finding.
- **The M-05-8 escape was run deliberately.** The plan says running it under the bridge filter "would be correct to do so". Running it turns the claim that F6 is M-05-8's only detector into a measurement, and it is what exposed the wrong PKG-04 command in the register.
- **BRG-03 is marked Complete with its deferral written into the Status cell**, following CAT-01's precedent of a Status cell that explains rather than merely asserts. Both halves the requirement states are proven; what is deferred is the join through a real `dispatch`, which the requirement's own wording does not mention and which CONTEXT decision 3.3 defers to Phase 6.
- **The audit counts were taken through two grep binaries.** `grep` on this shell is a ugrep wrapper. The plan anticipated a binary-dependence hazard and specified `-F`; cross-checking against `/usr/bin/grep` and adding a per-file positive control closes the residual case where a wrapper silently declines to read a gitignored path.

## Deviations from Plan

### Auto-fixed issues

**None.** No bug, missing-critical-functionality or blocking issue arose. No source file was touched, so no Rule 1/2/3 fix was applicable. No package was installed.

### Corrections to the plan's stated commands (not work changed)

1. **The gate filter.** The plan's `<action>` and `<verify>` blocks specify `pnpm test -- bridge`. That form does not filter under pnpm 11.17.0 — a finding this executor was handed by 05-04 and 05-05 and which was re-confirmed here. Every probe used `pnpm exec vitest run <name>`, which genuinely selects. Both forms were run for M-05-8 and both PASS. The acceptance criteria are met either way; the filtering form is what the counts above are scoped to.

2. **M-05-2's multi-line literal could not be passed with `$'…\n…'` quoting.** This worktree agent's isolation check refuses both `$'…'` and `"$(printf …)"` in the position of a `mutate-and-prove.sh` argument. A **literal newline inside a double-quoted argument** works and was used, for M-05-2 and again for M-05-14 and P-05-1/P-05-2. Same bytes reach `perl -0`; only the shell quoting differs. Recorded so the next executor does not read the two refusals as a harness fault.

### Environment step

This worktree had no `node_modules`, so `pnpm install --frozen-lockfile` ran before any gate — the same step 05-02 through 05-06 recorded. It resolved and downloaded nothing ("Lockfile is up to date, resolution step is skipped"; 234 packages, all reused from the store) and `pnpm-lock.yaml` is unmodified; `git status` was clean immediately afterwards. **No package was added**, so the package-legitimacy checkpoint does not apply.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None. Three tasks, three commits, two files, every acceptance criterion met.

## Issues Encountered

- **The isolation check refuses `$'…'` and `$(…)` inside a mutation argument.** Two attempts were rejected with "this command is too complex to verify that it stays inside the worktree" before the literal-newline form was found. No harm done — the rejections happened before any mutation was applied.
- **`grep` is not `grep` here.** It resolves to a shell function wrapping ugrep 7.5.0 with `--ignore-files`, which respects `.gitignore`. `packages/concierge/dist/` **is** gitignored. Explicit file arguments were searched correctly, but this is one option-flag change away from an audit that silently reads nothing and reports zero. Every count was therefore cross-checked against `/usr/bin/grep` and every file given a positive control.

## Verification Evidence

| Gate | Result |
|---|---|
| Occurrence counts, unfiltered | 19 literals × 1 occurrence; `makeDefaultNormalizer(` × 2; un-anchored `if (registry === undefined)` × **2** (the recorded collision) |
| Mutation battery | **17/17 PASS**, zero escapes; plus 2 supplementary arms and 1 deliberate negative control |
| Every PASS's build step | `attw` No problems found + `publint --strict` No issues found on all twelve `src/bridge.ts` probes and both `concierge.ts` probes |
| Every PASS's test count | 42 (bridge filter), 6 (single-instance filter), 133 (M-05-14, full suite), 2 diagnostics each (typecheck gates) — **never zero** |
| `git status --porcelain` | empty before the first probe, after the last, and after all three commits |
| Prose audit, negative half | 0 / 0 / 0 / 0 against baselines 2 / 0 / 2 / 1, cross-checked on two grep binaries |
| Prose audit, positive half | `read traps` 1, `write traps` 1, anchor clause 1 at `dist/index.d.ts:2107` (baseline 0/0/0) |
| `$(cat` in `<automated>` blocks | **0** — both occurrences are prose at `:362` and `:451` |
| Four packaging gates | all exit 0 |
| `pnpm build && pnpm test && pnpm typecheck` | 0 / 133 passed / 0 |
| `git diff --exit-code pnpm-lock.yaml` | exit 0 |
| `git diff --name-only f0e9a76..HEAD` | exactly `.planning/REQUIREMENTS.md` and `.planning/phases/…/05-VALIDATION.md` |
| Shared artifacts | `STATE.md`, `ROADMAP.md` — not in the diff |
| `05-VALIDATION.md` | 0 `TBD`, 0 `⬜ pending` rows, 0 `❌ W0` cells, 0 unticked sign-off boxes |
| `REQUIREMENTS.md` | BRG-01..05 and DX-02 `[x]` in the list and `Complete` in the traceability table |

## Known Stubs

**None.** This plan adds no placeholder, no hardcoded empty value and no unwired data path. It modifies no source. The one thing deliberately not asserted — DX-03's what-to-do half — is a labelled review obligation whose verdict is recorded above and in `05-VALIDATION.md`.

## Threat Flags

**None.** This plan modifies no source and introduces no network endpoint, auth path, file-access pattern or schema change. Every `mitigate` disposition in the plan's register is discharged: T-05-20 by the compiled-and-ran confirmation on all seventeen; T-05-21 by `git status --porcelain` empty at both ends of both batteries; T-05-22 by the unfiltered counts and the recorded M-05-14 collision; T-05-04 by the prose audit's two halves with baselines; T-05-12 by the `src/` retarget with its unedited-control proof. T-05-SC (`accept`) holds: zero installs, empty external module graph, byte-identical lockfile.

## User Setup Required

None.

## Next Phase Readiness

**Phase 5 is closed. Phase 6 is unblocked.**

- **`resolveBridge` is the seam the dispatcher calls**, and it is the second and final caller — do not write a parallel resolution path. The `dispatch` stub and `DISPATCH_NOT_IMPLEMENTED` are untouched and still byte-identical to their Phase 4 form.
- **Success criterion 3's end-to-end form is Phase 6's**, and both halves it joins are already proven and mutation-discriminated: resolution yielding `null` (M-05-13, M-05-14) and a handler returning the bounded off-page sentence (M-05-12).
- **`offPageResult`'s 180-character bound is the constant SEC-06's truncation should share rather than re-derive.** D19 pins it read from the artifact's own `MESSAGE_MAX_CHARS` export, so the two cannot silently disagree.
- **For Phase 8:** D1 is what makes CON-04's drift check meaningful. If the captured side ever becomes a live view again, D1 goes red — proven by M-05-3 — before the consent gate can be built on top of it.
- **For Phase 9:** criterion 4's framework half (React StrictMode, Svelte `$state.snapshot`) is deferred there and recorded as deferred. D8 and D9 record the two documented limits an adapter has to work with. The SSR registration invariant on `createBridge`'s JSDoc is unguarded by design and is Phase 9's to enforce.
- **Four harness facts the next battery needs:** rebuild `dist/` after every probe (the harness restores `src/` only, and `dist/` is gitignored); never pipe a gate command; `pnpm test -- <name>` does not filter, `pnpm exec vitest run <name>` does; and a multi-line mutation literal must be passed as a literal newline inside a double-quoted argument, because `$'…'` and `$(printf …)` are both refused by the worktree isolation check.

**No blockers.**

## Self-Check: PASSED

- `.planning/phases/05-bridge-registry-and-the-no-bridge-path/05-VALIDATION.md` — FOUND
- `.planning/REQUIREMENTS.md` — FOUND
- `.planning/phases/05-bridge-registry-and-the-no-bridge-path/05-07-SUMMARY.md` — FOUND
- Commit `2ff43d5` — FOUND in git log
- Commit `4e17bf6` — FOUND in git log
- Commit `75ebc44` — FOUND in git log
- Working tree clean; `dist/` rebuilt from unmutated source and the full suite green at 133; no source or test file modified; `STATE.md` and `ROADMAP.md` not touched.

---
*Phase: 05-bridge-registry-and-the-no-bridge-path*
*Completed: 2026-07-31*
