---
phase: 5
slug: bridge-registry-and-the-no-bridge-path
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `05-RESEARCH.md` § Validation Architecture (line 1123), whose mutant *effects* were
> measured rather than reasoned.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (runtime) + `tsc` 7.0.2 (type level) |
| **Config file** | `vitest.config.ts` (root, single `node` project) · `packages/concierge/tsconfig.test-d.json` |
| **Quick run command** | `pnpm build && pnpm test -- bridge && pnpm typecheck` |
| **Full suite command** | `pnpm build && pnpm test && pnpm typecheck` |
| **Mutation harness** | `scripts/mutate-and-prove.sh <file> <literal> <replacement> -- <gate>` |
| **Estimated runtime** | ~2 s quick · ~4 s full (87-test baseline, 349 ms; typecheck 0.79 s) |

**Prerequisite:** `pnpm build` must precede `pnpm test` — `test/*.test.ts` import `../dist/index.js`
behind an `existsSync` guard in `beforeAll`. A stale `dist/` silently tests the previous build.

**Layers.** **R** = runtime test against `dist/index.js`. **T** = type test via
`tsc -p packages/concierge/tsconfig.test-d.json`. **M** = mutation via `scripts/mutate-and-prove.sh`.
**A** = artifact/prose audit by grep over `dist/index.d.ts` / `dist/index.js`.

---

## Sampling Rate

- **After every task commit:** `pnpm build && pnpm test -- bridge && pnpm typecheck` (< 2 s)
- **After every plan wave:** `pnpm build && pnpm test && pnpm typecheck`, plus
  `git diff --exit-code` at the repo root — the containment that `mutate-and-prove.sh`'s Known
  Limitation 1 depends on
- **Before `/gsd-verify-work`:** full suite green **plus** the complete mutation battery below,
  **plus** the shipped-prose audit, **plus** `pnpm check:deps` / `check:artifact` / `check:pack` /
  `check:node-floor`
- **Max feedback latency:** 2 seconds

**Mutation PASS is not the exit code alone.** Each PASS must be confirmed from the gate's *output*
to have compiled and actually run tests (Known Limitation 2). A mutant that fails to compile
produces a green-looking gate that proves nothing.

---

## Per-Task Verification Map

Task IDs are assigned during planning. This table maps each requirement to its discriminating
mutant; the planner fills the Task ID and Plan columns.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | BRG-01 | — | Unsubscriber clears the slot only when the slot still holds its own registration | R + M | `pnpm test -- bridge` → M-05-1, M-05-2 | ❌ W0 `test/bridge.test.ts` | ⬜ pending |
| TBD | TBD | 1 | BRG-01 | — | `read()` is `() => B \| null`, not `() => B` | T | `pnpm typecheck` → P-05-3 | ✅ `test-d/actions.test-d.ts:436` | ⬜ pending |
| TBD | TBD | 1 | BRG-02 | — | Handler reads new values after the app moved, with no re-registration | R + M | `pnpm test -- bridge` → M-05-9, M-05-3 | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | BRG-02 | — | `register()` stores the bridge as given; `read() === theRegisteredObject` | R + M | `pnpm test -- bridge` → M-05-9 | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | BRG-03 | T-05-DoS | `resolveBridge` yields `null` for a declared-but-unmounted bridge; a throwing `read()` also yields `null` and does not propagate | R + M | `pnpm test -- bridge` → M-05-13, M-05-14 | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | BRG-03 | T-05-Info | Handler given `bridge: null` returns `{ok:false, reason:"no_bridge"}`, message ≤ 180 chars, no throw | R + M | `pnpm test -- bridge` → M-05-12 | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | BRG-04 | — | Stale cleanup after replacement is refused, including when the replacement is `===` the original | R + M | `pnpm test -- bridge` → M-05-1 (O1b/O2b/O4b/O4c only) | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | BRG-05 | T-05-EoP | Captured snapshot does not move when the proxy-backed store moves, **and the store is not frozen as a side effect** | R + M | `pnpm test -- bridge` → M-05-3 (Shape F), M-05-5, M-05-6 | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | BRG-05 | T-05-EoP | Cycles and shared refs survive: `c.self === c`, `c.l === c.r`, `c.l !== original` | R + M | `pnpm test -- bridge` → M-05-4 | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | DX-02 | — | A stage declaring no `bridge` runs and can succeed; resolution returns `null` without error | R + M | `pnpm test -- bridge` → M-05-14 | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | DX-02 | — | A stage that declares a bridge with nothing registered still runs — core does not auto-fail | R + M | `pnpm test -- bridge` → M-05-13 inverted | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | SEC-03 class | T-05-Tamper | Registry object frozen — `registry.read = fn` throws in ESM strict mode | R + M | `pnpm test -- bridge` → M-05-7 | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PKG-04 | T-05-DoS | `assertSingleInstance()` called inside `createBridge`'s body | R + M | `pnpm test -- bridge` → M-05-8 | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | Export pins | — | Seven export pins move together; `createBridge` / helper / capture are **value** exports | T + A | `pnpm typecheck` + `pnpm test -- export-surface` → P-05-1, P-05-2 | ✅ edit both | ⬜ pending |
| TBD | TBD | 3 | Shipped prose | — | Zero hits for `deep freeze` and `not yet constructible` in `dist/` | A | `grep -c` over `dist/index.d.ts`, `dist/index.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Mutant register (15)

| ID | Target | Substitution (shape) | What it breaks |
|---|---|---|---|
| M-05-1 | `src/bridge.ts` | `if (slot?.token === token)` → `if (slot?.bridge === bridge)` | Anti-Pattern 6 — object-identity guard |
| M-05-2 | `src/bridge.ts` | guarded clear → unconditional `slot = null;` | Naive clear |
| M-05-3 | `src/bridge.ts` | clone call in default normalizer → deep-freeze call | The deep-freeze default (BRG-05) |
| M-05-4 | `src/bridge.ts` | `WeakMap` lookup removed / `seen.set` moved after recursion | Cycle safety + DAG identity |
| M-05-5 | `src/bridge.ts` | `Date`/`Map`/`Set` branch → `return v;` | Exotic values stay live |
| M-05-6 | `src/bridge.ts` | drop the `\|\| proto === null` arm | `Object.create(null)` records pass through undetached |
| M-05-7 | `src/bridge.ts` | `return Object.freeze(registry);` → `return registry;` | Capability object swappable |
| M-05-8 | `src/bridge.ts` | `assertSingleInstance();` deleted | PKG-04's second call site |
| M-05-9 | `src/bridge.ts` | `normalize(getter())` → `getter()` | Detachment skipped at capture |
| M-05-10 | `src/bridge.ts` | warn-once latch assignment deleted | Warns on every register |
| M-05-11 | `src/bridge.ts` | add `warnHost(...)` to the refused-unsubscriber return | Warns on every StrictMode mount |
| M-05-12 | `src/bridge.ts` | `message.slice(0, MESSAGE_MAX_CHARS)` → `message` | Off-page message unbounded |
| M-05-13 | `src/concierge.ts` | `return registry.read();` in `resolveBridge` → `return null;` | Resolution always off-page |
| M-05-14 | `src/concierge.ts` | remove `stage.bridge === undefined` early return | `explain()`'s three-state row collapses to two |
| P-05-1/2 | `src/index.ts` | move `createBridge` / helper into the `export type` block | Export placement — surfaces as **TS1485 at the shared import line**, not TS2344 at the predicate |
| P-05-3 | `src/types.ts` | `read: () => B \| null` → `read: () => B` | Nullability erased — caught by existing `_registryReadIsNullable` |

**Uniqueness is not inherited.** Every literal above is a *shape*. Count occurrences unfiltered and
comments included against the file the plan actually writes before using it (Known Limitation 3).

---

## Mutation Battery — Measured Results

Run in plan 05-07 (wave 4) against the completed phase tree. Baseline before the battery:
**133 tests / 9 files**, `pnpm build` clean through `attw` and `publint --strict`, `pnpm typecheck`
exit 0, `git status --porcelain` empty.

**Gate form.** Every `src/` mutant asserted through the runtime suite uses
`bash -c 'pnpm build > <file> 2>&1 && pnpm exec vitest run <filter> > <file> 2>&1'`. Three properties
of that shape are load-bearing and each was learned the hard way by an earlier plan in this phase:

1. **The gate rebuilds.** `test/*.test.ts` import `dist/index.js`, so `pnpm test` alone reads the
   PRE-mutation artifact and every mutant escapes (05-06, Probe D).
2. **The gate is never piped.** `mutate-and-prove.sh` reads the gate's exit status, and a gate ending
   in `| tail` reports `tail`'s — printing `FAIL: mutant escaped` beside its own failing tests
   (05-03).
3. **The filter is `pnpm exec vitest run <name>`, not `pnpm test -- <name>`.** Under pnpm 11.17.0 the
   latter does not filter — it runs the whole suite (05-04, 05-05). The register's documented
   `pnpm test -- bridge` gate is *sound* (a superset run that reddens a bridge case still fires) but
   vacuous in the filtering sense, so the filtering form was used throughout and the counts below are
   scoped to the two bridge files (42 cases) unless stated otherwise.

**`dist/` was rebuilt after every probe.** `mutate-and-prove.sh` restores `src/` but not `dist/`, and
`dist/` is gitignored — so a mutant artifact survives a probe behind a clean `git status` (05-05).

### Occurrence counts, taken UNFILTERED

`grep -o -F "<literal>" packages/concierge/src/bridge.ts | wc -l`, comments left in, per Known
Limitation 3. **Every literal below counted exactly 1.** The M-05-2 multi-line literal was counted
with `String.split(literal).length - 1` over the raw file, which grep cannot do.

**Pre-flight abort check, cleared:** `makeDefaultNormalizer(` occurs **exactly 2** times
(unfiltered and comment-stripped alike) — the declaration plus the live call inside `captureSnapshot`'s
key loop. Had it been 1 the normalizer would have been inlined anonymously, M-05-3 would have mutated
an uninvoked function, and the battery would have recorded an escape that is the inverse of the truth.

### The twelve `src/bridge.ts` mutants

| ID | Final literal → replacement | Count | Exit | Build | Tests ran | Cases red |
|---|---|---|---|---|---|---|
| **M-05-1** | `if (slot?.token === token)` → `if (slot?.bridge === bridge)` | 1 | **0 PASS** | ✔ attw + publint clean | 42 | **B10** (O1b), **B11** (O2b), **B12** (O4b), **B13** (O4c), B20 |
| **M-05-2** | the 3-line guarded block (8/10/8 indent) → `slot = null;` | 1 | **0 PASS** | ✔ | 42 | B6 (O2), B7 (O3b), B8 (O4), B9 (O8), B10, B11, B12, B13, B20 |
| **M-05-3** | `cloneDetached(value, seen, onExotic) as T` → `Object.freeze(value) as T` | 1 | **0 PASS** | ✔ | 42 | **D1**, D3, D4, D5, D6, D7, D8, D9, D11, D12 |
| **M-05-4** | `seen.get(obj)` → `undefined` | 1 | **0 PASS** | ✔ | 42 | **D2** (cycle), **D3** (DAG) |
| **M-05-5** | `obj instanceof Date \|\| tag === "[object Date]"` → `false` | 1 | **0 PASS** | ✔ | 42 | **D7**, D12 |
| **M-05-6** | `proto === Object.prototype \|\| proto === null` → `proto === Object.prototype` | 1 | **0 PASS** | ✔ | 42 | **D6** |
| **M-05-7** | `return Object.freeze(registry);` → `return registry;` | 1 | **0 PASS** | ✔ | 42 | **B16**, **B17**, **B18** |
| **M-05-9** | `normalizeValue(getter())` → `getter()` | 1 | **0 PASS** | ✔ | 42 | **D1**, D3, D4, **D5**, D6, D7, D9, D11, D12 |
| **M-05-10** | `warnedOverwrite = true;` → *(empty)* | 1 | **0 PASS** | ✔ | 42 | **B19** — `expected […(3)] to have a length of 1 but got 3` |
| **M-05-11** | `if (slot?.token === token) {` → a `warnHost` on the refusal condition, then the original line | 1 | **0 PASS** | ✔ | 42 | **B20** — `expected [Array(1)] to have a length of +0 but got 1` |
| **M-05-12** | `message.slice(0, MESSAGE_MAX_CHARS)` → `message` | 1 | **0 PASS** | ✔ | 42 | **D19** — `to have a length of 180 but got 249` |
| **M-05-8** | `assertSingleInstance();` → *(empty)*, gate `pnpm exec vitest run single-instance` | 1 | **0 PASS** | ✔ | 6 | **F6** — `expected undefined to deeply equal { version: 1 }` |

**No mutant returned exit 3 (no-op), exit 2 (dirty/untracked) or exit 4 (not restored). No escapes.**
`git status --porcelain` was empty before the first probe and after the last.

### Five findings the exit codes alone do not carry

1. **The five contract pins stay GREEN under M-05-1 — observed, not inferred.** M-05-1 was re-run
   under `--reporter=verbose` so the passing cases print by name. `B1` (O6), `B2` (O1), `B3` (O3),
   `B4` (O5) and `B5` (O7) each printed `✓` while B10–B13 printed `×`. That is the empirical
   confirmation of the `CONTRACT PIN` label, which asserts exactly this and nothing wider. All five
   also stay green under M-05-2.

2. **M-05-3's output contains ZERO `TypeError`.** Grepped explicitly. A `TypeError` would have meant
   the criterion-4 fixture is a Shape B or E proxy rather than Shape F — Pitfall 2 — and the case
   would have been proving its own proxy malformed rather than proving the normalizer fails to
   detach. D1's failure is the intended `expected 'boots' to be 'shoes'`.

3. **M-05-4's cycle case surfaces as an absent key, not as a visible `RangeError`.** The infinite
   recursion throws `RangeError: Maximum call stack size exceeded` *inside* `captureSnapshot`'s
   `try`, which catches it and writes `out[key] = undefined`. D2 therefore fails at
   `expect(result.self).toBe(result)` with `TypeError: Cannot read properties of undefined (reading
   'self')` at `bridge-snapshot.test.ts:332`. The test ran and failed; the string
   `Maximum call stack` does not appear in the output because the guard swallowed it. Recorded so a
   later reader does not go looking for the wrong evidence.

4. **M-05-5's three arms were each probed independently.** The `Date`/`Map`/`Set` branch is three
   separate `if` statements, so one literal can only disable one arm. All three were run and all
   three PASS: the Date arm reddens D7 **and D12**, the Map arm reddens D7 alone, the Set arm reddens
   D7 alone. D12's extra redness under the Date arm is informative rather than noise — D12's exotic
   fixture is a naively-proxied `Date`, and its `[snapshot_exotic]` warning is emitted from that
   branch's extraction `catch`. Disable the branch and the value falls straight through to
   pass-by-reference, so it is carried live *without* a warning, which is precisely the invisible
   hole the exotic-warn signal path exists to close.

5. **M-05-8 escapes the bridge suite, and that was measured rather than assumed.** Run under
   `pnpm exec vitest run bridge` the same mutant returns **exit 1 — `FAIL: gate did NOT fire`** with
   all 42 bridge cases green. That is the correct result and is the whole reason plan 05-06 wrote F6:
   before it, M-05-8 had no detector anywhere in the repository. The register's documented
   `pnpm test -- single-instance` form was also run and also PASSes — as the superset it is, at
   1 failed / 132 passed of 133.

### The five `concierge.ts` / `index.ts` / `types.ts` mutants

| ID | Target | Final literal → replacement | Count | Exit | Build | Gate did work | Cases red |
|---|---|---|---|---|---|---|---|
| **M-05-13** | `src/concierge.ts` | `return registry.read() ?? null;` → `return null;` | 1 | **0 PASS** | ✔ | 42 tests ran | **D15** — declared-and-**mounted**: `expected { id: 'results', registered: false } to deeply equal { id: 'results', registered: true }` |
| **M-05-14** | `src/concierge.ts` | anchored 5-line block; `bridgeStatus`'s `return null;` → `return { id: "", registered: false };` | 1 *(anchored)* | **0 PASS** | ✔ | 133 tests ran | **D17**, **S20**, plus D20 and S24 |
| **P-05-1** | `src/index.ts` | the whole barrel line → `export type { createBridge } …` + `export { captureSnapshot, offPageResult } …` | 1 | **0 PASS** | n/a (typecheck gate) | `tsc` emitted 2 diagnostics | **TS1485** ×2, naming `createBridge` |
| **P-05-2** | `src/index.ts` | same line → `export { createBridge, captureSnapshot } …` + `export type { offPageResult } …` | 1 | **0 PASS** | n/a | `tsc` emitted 2 diagnostics | **TS1485** ×2, naming `offPageResult` |
| **P-05-3** | `src/types.ts` | `read: () => B \| null;` → `read: () => B;` | 1 | **0 PASS** | n/a | `tsc` emitted 2 diagnostics | **`test-d/actions.test-d.ts(436,39)` TS2344**, plus `src/bridge.ts(221,27)` TS2322 |

### Four findings from the second half of the battery

6. **The M-05-14 collision is real and was handled, not assumed away.** The bare literal
   `if (registry === undefined)` measures **2** occurrences unfiltered in `src/concierge.ts` — at
   `:238` inside `resolveBridge` and at `:301` inside `bridgeStatus`. `mutate-and-prove.sh` replaces
   the FIRST, and `resolveBridge` is written immediately before `bridgeStatus`, so the naive pattern
   mutates the wrong function to no observable effect and the run records an escape that is an
   artefact of the pattern rather than a coverage gap. The pattern actually used anchors to
   `bridgeStatus` by carrying the following blank line and the `const live: Bridge | null =
   resolveBridge(stage);` statement, and **that anchored form measures exactly 1**.

7. **M-05-14 is a value substitution, and the build succeeding is the proof it is not a delete.**
   Deleting `bridgeStatus`'s early return leaves `registry` typed `BridgeRegistry<any> | undefined`
   at the `registry.id` read, so `tsc` rejects it — a build-step exit 1 that this harness cannot
   distinguish from a failing assertion, i.e. a vacuous PASS having run zero tests (Known Limitation
   2). Returning `{ id: "", registered: false }` satisfies `StageExplanation["bridge"]`, compiles
   clean through `attw` and `publint`, and collapses the not-declared state into the
   declared-but-unmounted one — which is the defect the three-state row exists to prevent. **133
   tests ran.**

8. **M-05-14 reddens four cases, and all four fail for the same reason.** D17 and S20 are the two the
   plan requires, and both report `expected { id: '', registered: false } to be null`. D20 and S24
   are collateral: D20 reads the same `explain()` row for a stage with no bridge, and S24's
   deep-equal over a stage row carries `bridge: null` inside it. The observable here is a **wrong
   answer**, not a crash — which differs from 05-05's measurement of the *delete* spelling, where
   `explain()` threw `TypeError: Cannot read properties of undefined (reading 'id')` and the same
   cases went red for a different reason. Both spellings are caught; only one of them proves a test.

9. **P-05-1 and P-05-2 each surface as TS1485 at a shared IMPORT line, across TWO files.** Not TS2344
   on the predicate line named after the symbol — that is the counter-intuitive behaviour
   `exports.test-d.ts`'s own header warns about, and it is why no result here was recorded by
   grepping for a predicate's alias name, which non-TTY `tsc` output never prints. Recorded verbatim:

   ```
   P-05-1  test-d/bridge.test-d.ts(107,27):  error TS1485: 'createBridge' resolves to a type-only declaration …
           test-d/exports.test-d.ts(73,118): error TS1485: 'createBridge' resolves to a type-only declaration …
   P-05-2  test-d/bridge.test-d.ts(107,41):  error TS1485: 'offPageResult' resolves to a type-only declaration …
           test-d/exports.test-d.ts(73,149): error TS1485: 'offPageResult' resolves to a type-only declaration …
   ```

   `tsc` exits **1**, not 2, under TypeScript 7.0.2 — confirmed on both runs. The second file is new
   since 05-03 measured this: `test-d/bridge.test-d.ts` landed in 05-06 and its barrel import carries
   the same three values, so the placement guard now has two independent readers.

10. **P-05-3 now has two detectors where it had one.** `test-d/actions.test-d.ts(436,39)` is
    `_registryReadIsNullable`, the pre-existing predicate plan 05-06 deliberately did not duplicate —
    and `actions.test-d.ts:433` records that before that line existed this exact mutation escaped the
    full four-file suite at exit 0. The second, `src/bridge.ts(221,27) TS2322: Type 'B | null' is not
    assignable to type 'B'`, is new this phase: `createBridge`'s `read: (): B | null => slot?.bridge
    ?? null` is now an implementation that stops conforming when the interface loses its nullability.
    A predicate and an implementation disagreeing is stronger than either alone.

---

## Wave 0 Requirements

- [ ] `packages/concierge/test/bridge.test.ts` — new. Covers BRG-01…05 and DX-02. Opens with the
      "what escapes without this file" header carrying measured evidence. Imports `../dist/index.js`
      behind an `existsSync` guard in `beforeAll`. **No Vitest mocking API** — the grep must stay at
      zero; console capture is a plain `globalThis.console` assignment restored in a `finally`
      (`test/concierge.test.ts:1077-1089` is the template).
- [ ] `packages/concierge/test-d/bridge.test-d.ts` — new. `createBridge`'s signature via `Equals`,
      `BridgeRegistry<B>` conformance, the off-page helper's return type. Uses the four `_assert.ts`
      aliases; **predicates, never `expectTypeOf`**; `@ts-expect-error` only for object-literal
      freshness.
- [ ] `packages/concierge/test/export-surface.test.ts` — **edit.** Seven pins move together.
      Baseline is 62 names / 51 types / 11 values; this phase adds 3 values.
- [ ] `packages/concierge/test-d/exports.test-d.ts` — **edit.** Two predicates on the shared import
      line; the header sentence "bringing the total to six" becomes eight.
- [ ] **Shape F fixture** — accessor-backed target, all traps forwarding honestly to `Reflect`. Lives
      **inline in `test/bridge.test.ts`**, not in `test/fixtures/` — `test/fixtures/probe.ts` is
      compiled by a foreign program (plan 02-09's scratch project) and a sibling there gets pulled
      into that program by accident.
- [ ] Framework install: **none.** Vitest 4.1.10, TypeScript 7.0.2, and `scripts/mutate-and-prove.sh`
      are present and green.

---

## Non-Discriminating Tests — write them, do not count them

Five of thirteen measured mount/unmount orderings produce identical results on the correct guard,
on the object-identity defect, and on the naive clear. They are **contract pins, not validation**,
and the test file must label them so — otherwise a later reader mistakes them for proof.

| Test | Why write it | Why it proves nothing about the guard |
|---|---|---|
| O1 — StrictMode `reg A(u1); u1(); reg A(u2)` | The ordering every reader looks for first; its absence reads as an omission | Measured identical across all three implementations |
| O3 — `reg A(u1); u1(); u1(); reg B` | Pins unsubscriber idempotence | Identical across all three |
| O5 — `reg A; reg B(u2); u2()` | Pins the ordinary happy path | Identical across all three |
| O6 — never registered → `null` | Pins the initial state | Identical across all three |
| O7 — `reg A(u1); u1()` → `null` | Pins the simple unmount | Identical across all three |

Only **O1b, O2b, O4b, O4c** discriminate Anti-Pattern 6.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The off-page message "says what to do", not merely "what is wrong" (DX-03 standard) | BRG-03 | A regex over `/open\|go to\|navigate/i` pins vocabulary, not meaning, and goes red on a legitimate rewording. Writing it would be an assertion that passes vacuously. | **Plan-author review obligation.** Read the shipped sentence and confirm it names a concrete next action. The two automated halves that *do* carry weight — `message.length <= MESSAGE_MAX_CHARS` (M-05-12) and `expect(() => handler(ctx)).not.toThrow()` — are in the map above. Record the review verdict in the plan's SUMMARY. |
| Success criterion 3 end-to-end through a real `dispatch` | BRG-03 | `dispatch` is stubbed until Phase 6 by CONTEXT decision 3.3. Phase 5 proves each half separately. | **Deferred to Phase 6.** Not provable here; do not write a test that pretends otherwise. |

---

## Validation Sign-Off

- [ ] All tasks have an automated verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ references above
- [ ] No watch-mode flags
- [ ] Feedback latency < 2 s
- [ ] Every mutant in the register run through `mutate-and-prove.sh`, each PASS confirmed from the
      gate's output to have compiled and run tests
- [ ] Non-discriminating tests are labelled as contract pins in the test file
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
