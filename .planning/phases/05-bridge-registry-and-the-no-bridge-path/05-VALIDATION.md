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
