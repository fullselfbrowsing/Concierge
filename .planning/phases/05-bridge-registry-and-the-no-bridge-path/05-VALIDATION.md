---
phase: 5
slug: bridge-registry-and-the-no-bridge-path
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-31
signed_off: 2026-07-31
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
| **Quick run command** | `pnpm build && pnpm exec vitest run bridge && pnpm typecheck` |
| **Full suite command** | `pnpm build && pnpm test && pnpm typecheck` |
| **Mutation harness** | `scripts/mutate-and-prove.sh <file> <literal> <replacement> -- <gate>` |
| **Estimated runtime** | ~2 s quick · ~4 s full (**133-test** phase-close baseline, 336 ms across 9 files; typecheck ~0.8 s) |

**Prerequisite:** `pnpm build` must precede `pnpm test` — `test/*.test.ts` import `../dist/index.js`
behind an `existsSync` guard in `beforeAll`. A stale `dist/` silently tests the previous build.

**⚠️ The quick-run command was CORRECTED at the phase gate, and the original was not merely
imprecise.** This table shipped `pnpm test -- bridge`. Measured under pnpm 11.17.0 by plans 05-04 and
05-05: that form does **not** filter — it runs `vitest run -- bridge` and executes the whole suite
(9 files / 133 tests). It is still a *sound* gate, because a superset run that reddens a bridge case
still exits non-zero, but it is satisfied vacuously and would stay green if Vitest's filtering broke
outright. `pnpm exec vitest run bridge` genuinely selects the two bridge files (42 cases). Both forms
were run at the gate and both PASS; the filtering form is documented here because it is the one whose
green means something.

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
mutant. **Completed at the phase gate (05-07).** The Task ID column names the task that *discharges*
the row — normally the task that wrote the assertion, not the one that wrote the implementation — and
the Wave column carries the wave that task actually executed in, which differs from the planning
estimate for every runtime row because Wave 0's test files were scheduled into wave 3.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-04-T2 | 05-04 | 3 | BRG-01 | — | Unsubscriber clears the slot only when the slot still holds its own registration | R + M | `pnpm exec vitest run bridge` → M-05-1, M-05-2 | ✅ `test/bridge.test.ts` B6–B13 | ✅ green |
| 05-07-T2 | 05-07 | 4 | BRG-01 | — | `read()` is `() => B \| null`, not `() => B` | T | `pnpm typecheck` → P-05-3 | ✅ `test-d/actions.test-d.ts:436` | ✅ green |
| 05-04-T3 | 05-04 | 3 | BRG-02 | — | Handler reads new values after the app moved, with no re-registration | R + M | `pnpm exec vitest run bridge` → M-05-9, M-05-3 | ✅ `test/bridge.test.ts` B15 | ✅ green |
| 05-04-T3 | 05-04 | 3 | BRG-02 | — | `register()` stores the bridge as given; `read() === theRegisteredObject` | R + M | `pnpm exec vitest run bridge` → M-05-9 | ✅ `test/bridge.test.ts` B14 | ✅ green |
| 05-05-T3 | 05-05 | 3 | BRG-03 | T-05-DoS | `resolveBridge` yields `null` for a declared-but-unmounted bridge; a throwing `read()` also yields `null` and does not propagate | R + M | `pnpm exec vitest run bridge` → M-05-13, M-05-14 | ✅ `test/bridge-snapshot.test.ts` D14–D17 | ✅ green |
| 05-05-T3 | 05-05 | 3 | BRG-03 | T-05-Info | Handler given `bridge: null` returns `{ok:false, reason:"no_bridge"}`, message ≤ 180 chars, no throw | R + M | `pnpm exec vitest run bridge` → M-05-12 | ✅ `test/bridge-snapshot.test.ts` D18, D19 | ✅ green |
| 05-04-T2 | 05-04 | 3 | BRG-04 | — | Stale cleanup after replacement is refused, including when the replacement is `===` the original | R + M | `pnpm exec vitest run bridge` → M-05-1 (O1b/O2b/O4b/O4c only) | ✅ `test/bridge.test.ts` B10–B13 | ✅ green |
| 05-05-T1 / T2 | 05-05 | 3 | BRG-05 | T-05-EoP | Captured snapshot does not move when the proxy-backed store moves, **and the store is not frozen as a side effect** | R + M | `pnpm exec vitest run bridge` → M-05-3 (Shape F), M-05-5, M-05-6 | ✅ `test/bridge-snapshot.test.ts` D1, D6, D7 | ✅ green |
| 05-05-T2 | 05-05 | 3 | BRG-05 | T-05-EoP | Cycles and shared refs survive: `c.self === c`, `c.l === c.r`, `c.l !== original` | R + M | `pnpm exec vitest run bridge` → M-05-4 | ✅ `test/bridge-snapshot.test.ts` D2, D3 | ✅ green |
| 05-05-T3 | 05-05 | 3 | DX-02 | — | A stage declaring no `bridge` runs and can succeed; resolution returns `null` without error | R + M | `pnpm exec vitest run bridge` → M-05-14 | ✅ `test/bridge-snapshot.test.ts` D20 | ✅ green |
| 05-05-T3 | 05-05 | 3 | DX-02 | — | A stage that declares a bridge with nothing registered still runs — core does not auto-fail | R + M | `pnpm exec vitest run bridge` → M-05-13 inverted | ✅ `test/bridge-snapshot.test.ts` D21 | ✅ green |
| 05-04-T3 | 05-04 | 3 | SEC-03 class | T-05-Tamper | Registry object frozen — `registry.read = fn` throws in ESM strict mode | R + M | `pnpm exec vitest run bridge` → M-05-7 | ✅ `test/bridge.test.ts` B16–B18 | ✅ green |
| 05-06-T2 | 05-06 | 3 | PKG-04 | T-05-DoS | `assertSingleInstance()` called inside `createBridge`'s body | R + M | **`pnpm exec vitest run single-instance`** → M-05-8 | ✅ `test/single-instance.test.ts` F6 | ✅ green |
| 05-03-T2 / T3 | 05-03 | 2 | Export pins | — | **Eleven** export pins move together; `createBridge` / `captureSnapshot` / `offPageResult` are **value** exports | T + A | `pnpm typecheck` + `pnpm exec vitest run export-surface` → P-05-1, P-05-2 | ✅ both edited | ✅ green |
| 05-02-T2 / 05-03-T1 | 05-02, 05-03 | 1, 2 | Shipped prose | T-05-04, T-05-12 | Zero hits for `deep freeze` in `dist/`; zero for `not yet constructible` in **`src/index.ts`** | A | `grep -c` over `dist/index.d.ts`, `dist/index.js`, `src/types.ts`, `src/index.ts` | ✅ audited at 05-07-T3 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Three corrections to this table, each forced by a measurement

**1. PKG-04's automated command was WRONG, not merely vacuous.** It read
`pnpm test -- bridge → M-05-8`. Measured at the gate: with `assertSingleInstance();` deleted from
`createBridge`, `pnpm exec vitest run bridge` reports **42 passed / 42** and `mutate-and-prove.sh`
returns exit 1, `FAIL: gate did NOT fire — mutant escaped`. No bridge test can see this mutant, which
is exactly why plan 05-06 wrote F6. The command is corrected to the `single-instance` filter, under
which F6 is the single red case of 6. (The superset `pnpm test -- single-instance` form also fires,
at 1 failed / 132 passed of 133, because it does not filter — see the Test Infrastructure note.)

**2. The "Seven export pins" row was wrong twice over.** There are **eleven** pins, not seven, and a
twelfth plan-directed correction beside them (the `` `Assignable` predicates `` count in
`test-d/exports.test-d.ts`, already stale at four before this phase and now seven). The surface moved
**62 / 51 / 11 → 65 / 51 / 14** — not the 64 / 51 / 13 that RESEARCH § Q5 projected, whose figure was
superseded by CONTEXT's decision to barrel three values rather than two. Types stayed at 51 because
this phase added no new type. All eleven pins moved together in plan 05-03, which is the only way any
of them has a red first run; the checklist is in `05-03-SUMMARY.md`.

**3. The shipped-prose row's target moved from `dist/` to `src/index.ts` for one of its two phrases.**
See § *Shipped-prose audit* below. `deep freeze` genuinely ships and the `dist/` grep is real;
`not yet constructible` never reaches `dist/` at all and a `dist/` grep for it would have passed
vacuously.

**Pin 2 (`is exactly 65 names`) does NOT catch a placement regression, and must not be read as
covering P-05-1.** Measured in 05-03 and re-confirmed at the gate: moving three values into the
`export type` block re-files them rather than removing them, so names stay 65 while types go 51 → 54
and values go 14 → 11. Pin 2 exists for a build-config change that adds or drops a name outright.
**Pins 3 and 5 (the 51/14 split) and pin 6 (the by-name loop, made able to fire by pin 7's array
growth) are what catch placement at the runtime layer**, and the three TS1485 predicates catch it at
the type layer. Recorded because a register that credits pin 2 with P-05-1 coverage would be claiming
a detector that has been measured green under the defect.

### Mutant register (17)

| ID | Target | Substitution (shape) | What it breaks |
|---|---|---|---|
| M-05-1 | `src/bridge.ts` | `if (slot?.token === token)` → `if (slot?.bridge === bridge)` | Anti-Pattern 6 — object-identity guard |
| M-05-2 | `src/bridge.ts` | guarded clear → unconditional `slot = null;` | Naive clear |
| M-05-3 | `src/bridge.ts` | clone call in default normalizer → deep-freeze call | The deep-freeze default (BRG-05) |
| M-05-4 | `src/bridge.ts` | `WeakMap` lookup removed / `seen.set` moved after recursion | Cycle safety + DAG identity |
| M-05-5 | `src/bridge.ts` | `Date`/`Map`/`Set` branch → `return v;` | Exotic values stay live |
| M-05-6 | `src/bridge.ts` | drop the `\|\| proto === null` arm | `Object.create(null)` records pass through undetached |
| M-05-7 | `src/bridge.ts` | `return Object.freeze(registry);` → `return registry;` | Capability object swappable |
| M-05-8 | `src/bridge.ts` | `assertSingleInstance();` deleted | PKG-04's **third** call site, and its first DIRECT one (05-06 measured the count; "second" was stale) |
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

**All satisfied.** Every `❌ W0` reference in the map above now resolves to a committed file.

- [x] `packages/concierge/test/bridge.test.ts` — new (05-04, 810 lines, 21 cases B1–B21). Covers
      BRG-01, BRG-02, BRG-04, the SEC-03-class frozen capability and both warn policies. Opens with
      the "what escapes without this file" header carrying measured evidence. Imports
      `../dist/index.js` behind an `existsSync` guard in `beforeAll`. **No Vitest mocking API** —
      `grep -rn "vi\.spyOn|vi\.fn|vi\.mock"` across `test/` returns zero; console capture is a plain
      `globalThis.console` assignment restored in a `finally`.
- [x] `packages/concierge/test/bridge-snapshot.test.ts` — new (05-05, 959 lines, 21 cases D1–D21).
      **This file is a SPLIT of the single `test/bridge.test.ts` Wave 0 planned, and the split is
      Claude's discretion under CONTEXT ("the division of tests across files"), not unplanned work.**
      It carries BRG-05 (detachment, the clone's measured properties, both capture warns), BRG-03
      (the no-bridge path, both halves) and DX-02 (both variants). Recorded here so a later reader
      does not read a second bridge file as scope that nobody authorised. Both files satisfy every
      constraint the single-file entry above states.
- [x] `packages/concierge/test-d/bridge.test-d.ts` — new (05-06, 178 lines, 11 predicates).
      `createBridge`'s whole signature via `Equals`, `BridgeRegistry<B>` conformance at a concrete
      `B` with a negative control, and the off-page helper's return type. Uses the `_assert.ts`
      aliases; predicates only; zero suppression directives; zero `export`.
- [x] `packages/concierge/test/export-surface.test.ts` — **edited** (05-03). **Eleven** pins moved
      together, not seven. Baseline 62 names / 51 types / 11 values → **65 / 51 / 14**.
- [x] `packages/concierge/test-d/exports.test-d.ts` — **edited** (05-03). **Three** predicates added
      (one per new value) on the shared import line, which is now nine symbols on one physical line
      at `:73`; the header's three "six" numbers became **nine**, not eight.
- [x] **Shape F fixture** — accessor-backed target, all six traps forwarding honestly to `Reflect`.
      Lives **inline in `test/bridge-snapshot.test.ts`** — corrected from this list's original
      `test/bridge.test.ts` by the two-file split above. **The substantive constraint is unchanged
      and was honoured: NOT in `test/fixtures/`**, because `test/fixtures/probe.ts` is compiled by a
      foreign program (`scripts/pack-install-check.sh`'s scratch project) and a sibling module there
      gets pulled into that program by accident. Verified at the gate:
      `git log cbd2833..HEAD -- packages/concierge/test/fixtures/` returns **zero commits** — nothing
      was added to that directory anywhere in Phase 5.
- [x] Framework install: **none.** Vitest 4.1.10, TypeScript 7.0.2 and `scripts/mutate-and-prove.sh`
      present and green. `git diff --exit-code pnpm-lock.yaml` exits 0 — this phase installed nothing.

---

## Shipped-Prose Audit — measured at the phase gate

Run after `pnpm build`, because the defect is defined by what **ships**, not by what is in `src/`.
Every literal is shown able to fire: each has a recorded pre-correction count taken against the
uncorrected tree by the plan that made the correction, so none of these is a grep that never matched.

### Negative half — the false claims are gone

| Grep | File | Baseline (pre-correction) | Now | Recorded by |
|---|---|---|---|---|
| `deep freeze` | `packages/concierge/dist/index.d.ts` | **2** (at `:553` and `:1409`) | **0** | 05-02 |
| `deep freeze` | `packages/concierge/dist/index.js` | 0 | **0** | 05-02 |
| `deep freeze` | `packages/concierge/src/types.ts` | **2** | **0** | 05-02 |
| `not yet constructible` | `packages/concierge/src/index.ts` | **1** | **0** | 05-03 |

Both `dist/index.d.ts` baseline hits were emitted from `src/types.ts` — the JSDoc for
`SnapshotNormalizer` and for `ConciergeConfig.normalizeSnapshot`. **Those claims genuinely shipped**,
so the `dist/` grep for `deep freeze` is a real audit with a real 2 → 0.

### The fourth row is a SOURCE audit, and the distinction is load-bearing

`05-PATTERNS.md:492-493` instructs a `dist/` grep for `not yet constructible`. **It is wrong on this
point**, and the correction was made on evidence rather than preference. `src/index.ts`'s module
header does not reach the built artifacts *at all*, so a `dist/` grep for that phrase returned **0 on
the uncorrected tree too** and would have read in a report exactly like coverage — threat T-05-12,
an audit that cannot fail.

The proof is a sentence that was **never edited by this phase**, taken from the same paragraph the
stale clause lived in, re-measured at the gate with `/usr/bin/grep -cF`:

| Literal | `src/index.ts` | `dist/index.d.ts` | `dist/index.js` |
|---|---|---|---|
| `Stated plainly so this is not oversold` (**unedited**, same paragraph) | **1** | **0** | **0** |
| `not yet constructible` (removed by 05-03) | 0 (baseline 1) | 0 | 0 |

The first row is the whole argument: an untouched sentence present in source and absent from both
artifacts shows the entry module's header does not ship. The audit target is
**`packages/concierge/src/index.ts`**, and that is where the gate greps it.

### Positive half — the corrections actually shipped

| Literal | Where | Pre-correction baseline | Now |
|---|---|---|---|
| `read traps` / `write traps` (the mechanism sentence) | `dist/index.d.ts:1428` | — | **1** each |
| `the first direct production call site` (the `contract.ts` re-scope anchor) | `dist/index.d.ts:2107` | **0** in `dist/index.d.ts`, `dist/index.js` **and** `src/contract.ts` | **1** |

The anchor clause is grepped with **`-F`**, as a fixed string, and the literal is fixed in the plans
at both ends. **No gate here reads `/tmp` and none parses a SUMMARY.** An earlier draft of this gate
read `grep -q "$(cat /tmp/rescope-anchor.txt)"`; with the file absent that expands to `grep -q ""`,
matches every line, and exits 0 against an artifact carrying no correction — measured. Three waves
and, under `use_worktrees: true`, three separate working trees stand between the writer of that
clause and this reader, so the channel is the plans, which cannot fail open. Verified at the gate:
`$(cat` occurs twice in `05-07-PLAN.md`, at `:362` and `:451`, and **both are prose** — the
`<automated>` blocks are at `:190-197`, `:294-299` and `:426-437` and contain none.

### `createBridge` in `dist/index.d.ts` — an OBSERVATION, not a check

**9** lines. Baseline before this phase: **1**, at `dist/index.d.ts:1245`, emitted from
`src/types.ts:1446` where `StageExplanation["bridge"]`'s doc comment already named it. An assertion
on the bare identifier could not have failed even then, and plan 05-03 added `declare function
createBridge` plus an export entry regardless of whether the `contract.ts` re-scope shipped. That is
threat T-05-12 again; it is recorded for completeness and asserted on by nothing.

### The grep binary is not what it looks like, and this mattered

`grep` on this shell resolves to a **shell function wrapping ugrep 7.5.0**, not GNU or BSD grep —
which is precisely why the anchor gate is specified with `-F` rather than relying on any one
platform's error behaviour on a `**`-bearing pattern. Every count in the three tables above was taken
**twice**, once through that wrapper and once through `/usr/bin/grep` directly, and the two agree on
every row. The four zeros were additionally proven non-vacuous by positive controls showing each file
is genuinely being read: `SnapshotNormalizer` → 5 in `src/types.ts`, `no_bridge` → 2 in
`dist/index.js`, `Stated plainly so this is not oversold` → 1 in `src/index.ts`, `read traps` → 1 in
`dist/index.d.ts`. A zero from a file that was never opened is the same defect as a grep that cannot
fail.

---

## Packaging Gates and Full-Suite State — measured at the phase gate

| Gate | Result |
|---|---|
| `pnpm build` | exit 0 — `attw` **No problems found**, `publint --strict` **No issues found** |
| `pnpm test` | **`Test Files 9 passed (9)` / `Tests 133 passed (133)`** |
| `pnpm typecheck` | exit 0 |
| `pnpm check:deps` | exit 0 — Assertion A `unbundled external imports: []`, Assertion B `@standard-schema/spec 0 bytes`; *core's dependencies contribute zero bytes to a consumer bundle* |
| `pnpm check:artifact` | exit 0 — `publint --strict` clean; `attw --pack --profile esm-only` 🟢 on node16-from-ESM and bundler, node10 and node16-from-CJS ignored per resolution |
| `pnpm check:pack` | exit 0 — a foreign npm project installed the tarball, typechecked the shipped `.d.ts` with `skipLibCheck: false`, and imported the runtime (5 s) |
| `pnpm check:node-floor` | exit 0 — the tarball installed and imported on a pinned **v22.12.0** (10 s) |
| `git diff --exit-code pnpm-lock.yaml` | exit **0** — byte-identical. Zero packages installed this phase, proven rather than asserted |
| `git status --porcelain` | empty, before the first mutant and after the last |
| `test/fixtures/` | zero Phase 5 commits touch it |

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

### DX-03 review verdict — DISCHARGED (plan 05-05, restated here)

The obligation above is a plan-author review, and it was performed and recorded in
`05-05-SUMMARY.md`. It is **not** re-performed at the gate; it is cited.

The shipped sentence, measured by executing `dist/index.js` rather than read off the source:

> "The result count is not available because the results page is not open. Open the results page and
> try again."

`message.length` = **108** against a `MESSAGE_MAX_CHARS` of 180 — 72 characters of headroom, matching
plan 05-01's independently recorded measurement exactly.

**VERDICT: PASS.** The sentence is two clauses doing two different jobs. The first names the fault
*and its cause* ("is not available **because** the results page is not open"), which is where a
merely-diagnostic message stops. The second is an imperative naming a concrete next action the reader
can actually take — "**Open the results page** and try again" — and it names *which* page rather than
gesturing at the situation. It does not say "the bridge is not registered", which would be true,
internal and unactionable to the person reading it; and it does not say "try again later", which
would be an action that fixes nothing.

**No regex over `/open|go to|navigate/i` was written, in either bridge test file.** It would pin
vocabulary rather than meaning: red on a legitimate rewording that still names an action, green on
"the page is not open", which names no action at all while containing the word. The two automated
halves that *do* carry weight are both asserted and both measured to discriminate — D19's
`message.length` bound read from the artifact's own `MESSAGE_MAX_CHARS` export (red under M-05-12 at
`length of 180 but got 249`) and D18's `expect(() => handler(ctx)).not.toThrow()`.

### Two deferrals, recorded so their absence is not read as an omission

| Deferred | To | Authority |
|---|---|---|
| **Success criterion 3's end-to-end form** — resolution yielding `null` joined to a handler returning the off-page sentence through a real dispatcher | **Phase 6** | CONTEXT decision 3.3. `dispatch` is a stub; `test/bridge-snapshot.test.ts` never calls it (`grep -cE "\.dispatch\("` → 0). Phase 5 proves each half separately and says so in the file. |
| **Success criterion 4's framework half** — React StrictMode double-mount, Svelte `$state.snapshot` as the caller-supplied normalizer | **Phase 9** | No adapter exists yet. The core half *is* proven here, against a hand-rolled accessor-backed `Proxy` (D1), which is the stronger ordering: the guarantee is core's, not the adapter's. |

---

## Validation Sign-Off

- [x] All tasks have an automated verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all ❌ references above — every one now resolves to a committed file
- [x] No watch-mode flags
- [x] Feedback latency < 2 s — 336 ms for the full 133-test suite
- [x] Every mutant in the register run through `mutate-and-prove.sh`, each PASS confirmed from the
      gate's output to have compiled and run tests
- [x] Non-discriminating tests are labelled as contract pins in the test file — **and the labelling
      is proven**: all five stay green under M-05-1 and M-05-2, observed by name in a verbose run
- [x] `nyquist_compliant: true` set in frontmatter

### Why `nyquist_compliant: true` is warranted, stated rather than assumed

The claim this flag makes is that feedback is sampled often enough to catch a defect before it is
buried, and that what is sampled actually discriminates. Both halves are measured here rather than
argued:

- **Latency.** 336 ms for 133 tests across 9 files; 42 tests for the bridge filter; typecheck ~0.8 s.
  Every gate in this phase runs in under two seconds. No watch-mode flag anywhere.
- **Discrimination.** All **seventeen** register mutants were run and all seventeen were caught, each
  with a named failing case and a confirmed successful build. Nothing was recorded on an exit code
  alone. Three claimed detectors were additionally *disproven* where the claim was too strong and the
  register corrected — pin 2 against P-05-1, PKG-04's bridge-filter command, and the "seven pins"
  count — which is the behaviour that makes the remaining fourteen credible.
- **Honesty about the gaps.** Five orderings and two paired cases (D14, D10) are labelled as
  non-discriminating and are counted as contract pins rather than as validation. Two success-criterion
  halves are deferred with a named phase and a written authority. A register that only ever adds
  coverage is not measuring anything.

**Approval:** ✅ **Signed off at the phase gate, plan 05-07 (wave 4), 2026-07-31.** Seventeen of
seventeen mutants caught, zero escapes, prose audit green in both directions with recorded baselines,
four packaging gates green, lockfile byte-identical, working tree clean.
