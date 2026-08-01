---
phase: 05-bridge-registry-and-the-no-bridge-path
verified: 2026-08-01T00:20:43Z
status: passed
score: 25/25 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred:
  - truth: "Success criterion 3's END-TO-END form — a real `dispatch` call returning the off-page sentence"
    addressed_in: "Phase 6"
    evidence: "CONTEXT decision 3.3 locks the `dispatch` stub as untouched because Phase 4 settled that Phase 6 replaces it wholesale. Phase 5 proves each half separately (D14-D17 resolution yields null; D18/D19 handler given null returns the honest sentence). Recorded visibly in REQUIREMENTS.md's BRG-03 row, not hidden."
  - truth: "Success criterion 4's FRAMEWORK half — the real React StrictMode / Svelte `$state.snapshot` proxy"
    addressed_in: "Phase 9"
    evidence: "ROADMAP Phase 5 note: 'Criterion 4 is the core-level half of the Svelte proxy defect; Phase 9 supplies the real-framework half. Guarding it twice is deliberate.' Phase 5 owns the core-level half against a hand-rolled Proxy, which criterion 4's own wording requires."
  - truth: "SEC-06 message sanitizing (C0/C1 stripping) and the DSP-09 result normalizer"
    addressed_in: "Phase 6"
    evidence: "`src/bridge.ts:337-348` — offPageResult is BOUNDED, not SANITIZED; the policy lands at the dispatcher boundary so one policy does not live in two places."
  - truth: "A runtime guard against the SSR registration leak"
    addressed_in: "Phase 9"
    evidence: "`src/bridge.ts:187-209` records the invariant in a doc comment and states why a guard is refused here — it needs `typeof window`, which needs a new `host.ts` capability, which collides with the hard constraint that core constructs on the server with no environment guards."
  - truth: "`ConciergeConfig.normalizeSnapshot` reaching a production consumer"
    addressed_in: "Phase 6"
    evidence: "Code review IN-01. The field was declared pre-Phase-5 (commit eca8f5b); Phase 5 shipped the consumer-facing normalizer path as `captureSnapshot(bridge, id, normalize?)`, which is verified working. The config field's internal consumer is Phase 6's dispatcher — the same call site that first invokes `captureSnapshot`."
human_verification: []
---

# Phase 5: Bridge registry and the no-bridge path — Verification Report

**Phase Goal:** A handler reads live state from a page component that may or may not be mounted, without prop-drilling and without re-rendering the app — and behaves honestly when nothing is mounted.
**Verified:** 2026-08-01T00:20:43Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

Every claim below was checked against the tree or against the **built artifact**, never against SUMMARY.md.
Three independent instruments were used, in this order:

1. **A verifier-authored probe** (`/tmp/p5_probe.mjs`, 61 assertions) that imports `packages/concierge/dist/index.js` directly and exercises all five success criteria plus every regression case the code review closed. It shares no code with the phase's own suite. **61 passed, 0 failed.**
2. **Six mutants re-run from scratch** through `scripts/mutate-and-prove.sh`, with the failing case names read out of the gate's own output rather than taken from the register.
3. **Grep/parse audits** of the shipped `dist/` artifacts, the source tree, and the export surface — with the export counts re-derived by an independent parser rather than read from the test that pins them.

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | **SC1 (BRG-02)** A handler invoked after the app's state changed reads the new values, with no re-registration in between | VERIFIED | Probe C1: capture #1 `{count:1}`, app mutated to 42, capture #2 `{count:42}` with **zero** intervening `register()`. `read()` returns the registered object by `===`. `src/bridge.ts:238` `read: () => slot?.bridge ?? null` — nothing normalizes at register or read. Suite: B14/B15 |
| 2  | **SC2 (BRG-01, BRG-04)** A component that remounts and unregisters late cannot clear the newer registration | VERIFIED | Probe C2: stale `u1()` after replacement leaves `read() === b2`; **and in the `===` case** (same object re-registered) `read() === same`, not null. Guard is `slot?.token === token` (`src/bridge.ts:277`) on a `let next` monotonic counter inside the closure. M-05-1 re-run: reddens exactly B10/B11/B12/B13 (O1b/O2b/O4b/O4c) + B20 |
| 3  | **SC3 (BRG-03)** A handler whose stage bridge is not mounted receives `bridge: null` and returns a sentence telling the human what to do, not an exception | VERIFIED | Probe C3: unmounted `read()` → `null`; `explain()` row `{id:"results",registered:false}`; handler given null returns `{ok:false, reason:"no_bridge", message:"…Open the results page and try again."}`, len 108, **no throw**. M-05-13 re-run reddens D15. End-to-end join through a real `dispatch` is deferred to Phase 6 (see `deferred`) |
| 4  | **SC4 (BRG-05)** A snapshot from a proxy-backed store does not move when the store moves — against a hand-rolled Proxy in core | VERIFIED | Probe C4 against a verifier-authored **Shape F** accessor-backed Proxy: store moved `1→999` and `"a"→"z"`; captured stayed `1` and `"a"` at both top level and nested. M-05-3 re-run (`cloneDetached(…)` → `Object.freeze(value)`) reddens D1 + 14 others, with **zero `TypeError`** in the output — confirming the fixture is Shape F, not a malformed Shape B/E |
| 5  | **SC5 (DX-02)** An action reading router or DOM state runs with no bridge registered at all | VERIFIED | Probe C5: a stage with the `bridge` key **absent entirely** builds, `explain()` reports `bridge: null`, the action is emitted into the catalog, and the handler runs with `ctx.bridge === null` returning `{ok:true}`. No `reason` field — core never auto-failed. `src/concierge.ts:238-240` returns `null` for `registry === undefined` |
| 6  | A page component can construct a registry and register a bridge, receiving an unsubscriber | VERIFIED | `createBridge<B>(id): BridgeRegistry<B>` at `src/bridge.ts:211`; `register` returns `(): void`. Probe exercised the full mount/unmount cycle on 8 distinct registries |
| 7  | The store is **not frozen as a side effect** of capture | VERIFIED | Probe C4: `Object.isFrozen(proxy) === false`, `Object.isFrozen(store) === false`, and a subsequent `store.count = 5` write did not throw. The clone itself **is** frozen. This is the second of the three measured deep-freeze failure modes |
| 8  | The off-page sentence is bounded at `MESSAGE_MAX_CHARS` (180) | VERIFIED | Probe: 300+300-char inputs truncate to exactly 180; a truncation landing on a surrogate pair yields `isWellFormed() === true`. `boundedMessage` at `src/bridge.ts:393-403`. M-05-12 re-run on the **current** literal `message.slice(0, cut)` reddens D19 **and D31** |
| 9  | Declared-but-unmounted resolution goes through **one named seam** | VERIFIED | `function resolveBridge(stage)` at `src/concierge.ts:236`; it has exactly one caller today — `bridgeStatus` at `:305`. `grep -c "registry.read()"` in `src/` = 1, inside that seam |
| 10 | `explain()`'s bridge row still distinguishes three states | VERIFIED | Probe C3/C5 observed all three: `null` (not declared), `{id,registered:false}` (declared+unmounted), `{id,registered:true}` (mounted). The `registry === undefined` early return stays ahead of the seam (`src/concierge.ts:301`) so "not declared" does not collapse into `{id:"",registered:false}` |
| 11 | The shipped declaration file no longer claims the default normalizer is a deep freeze | VERIFIED | `grep -ci "deep freeze" dist/index.d.ts` = **0**; `dist/index.js` = **0**. `dist/index.d.ts:553` and `:1413` now read "a structural clone" |
| 12 | `createBridge`, `captureSnapshot`, `offPageResult` reach `dist/index.js` as callable functions | VERIFIED | Verifier probe imported all three from `dist/index.js` and called them. `typeof` = `function` for each. `src/index.ts:134` is the value re-export line |
| 13 | The published export surface is exactly **65 names / 51 types / 14 values** | VERIFIED | **Independently re-parsed** from `dist/index.d.ts` by the verifier: 65 / 51 / 14, value names matching the runtime `Object.keys(dist)` exactly. Pins agree in all three files: `test/export-surface.test.ts:139/144/145`, `test-d/exports.test-d.ts:73` (9-name shared import line), `test/artifact.test.ts:141/159/176` |
| 14 | `src/index.ts` no longer claims bridges are declared but not constructible | VERIFIED | `grep -c "not yet constructible" src/index.ts` = **0**; 0 across all of `src/`. Audited against `src/`, not `dist/` — the entry module's header does not reach `dist/` at all, so a `dist/` grep would pass vacuously |
| 15 | `register()` stores the bridge **as given**; `read()` returns that same object by reference | VERIFIED | Probe C1: `reg.read() === bridge`. `src/bridge.ts:258` `slot = { token, bridge }` — no normalization at either end. This is what keeps the getters live and is the mechanism behind truth 1 |
| 16 | The returned registry object is frozen; assigning `registry.read` throws | VERIFIED | Probe: `Object.isFrozen(reg) === true`; both `reg.read = …` and `reg.extra = 1` threw `TypeError` in ESM strict mode. `Object.freeze(registry)` at `src/bridge.ts:303`. M-05-7 covers B16/B17/B18 |
| 17 | Overwrite warns exactly once per registry; a refused unsubscriber warns never | VERIFIED | Probe: three registrations over a live one → **1** warning carrying `[bridge_overwrite]` and the id; a refused/clean unsubscriber → **0** warnings. `warnedOverwrite` is a `let` inside the closure (`src/bridge.ts:233`) |
| 18 | Cycles and shared references survive the clone: `c.self === c`, `c.l === c.r`, `c.l !== original` | VERIFIED | Probe C4: all three hold. `WeakMap` memo written **before** recursing (`src/bridge.ts:629`, `:704`, `:748`). M-05-4 (`seen.get(obj)` → `undefined`) is the recorded detector |
| 19 | A throwing snapshot getter is caught, the key becomes `undefined`, and nothing it threw reaches the warning | VERIFIED | Probe: a getter throwing `Error("SECRET-user-email@example.com")` produced no escape, `"bad" in s && s.bad === undefined`, and **zero** occurrences of `SECRET` in the emitted warning. Same result for a throwing **holder** (`ownKeys` trap). Every `catch` in `src/bridge.ts` binds nothing (`grep -c "catch ("` = **0**) |
| 20 | The three new values' signatures are pinned **from the barrel** | VERIFIED | `test-d/bridge.test-d.ts:107` imports values from `../src/index.js`; `../src/bridge.js` appears only inside a comment forbidding it. `Equals<>` pins at `:140`, `:159`, `:169`. `pnpm typecheck` (`tsc -p tsconfig.test-d.json`) exits **0** across 11 type-level suites |
| 21 | `createBridge` records this copy of core in the contract registry — PKG-04's third production call site and its first *direct* one | VERIFIED | `assertSingleInstance();` is the **first statement** of `createBridge`'s body (`src/bridge.ts:212`), not module scope. M-05-8 re-run under `vitest run single-instance` reddens **F6** exactly (`test/single-instance.test.ts:287`, fresh module evaluation under `?sc7=1`) |
| 22 | Every mutant was run with a confirmed compile and confirmed tests-ran, not on an exit code alone | VERIFIED | Six mutants re-run independently by the verifier — M-05-1, M-05-3, M-05-8, M-05-12, M-05-13, M-05-15. **All six fired**, each printing named failing cases and a nonzero test count, and the tree was proven clean after each. The `makeDefaultNormalizer(` pre-flight holds: **exactly 2** occurrences (`src/bridge.ts:815` declaration, `:1030` live call), so M-05-3 mutates live code |
| 23 | Prose audit: "deep freeze" 0 in built artifacts; "not yet constructible" 0 in `src/index.ts`; `src/bridge.ts` says "nine of thirteen" | VERIFIED | 0 / 0 / 0 respectively; `src/bridge.ts:262` reads "nine of thirteen", and "ten of thirteen" has 0 hits. The re-scoped `contract.ts` paragraph reaches `dist/index.d.ts` (1 hit) and the stale "genuinely still to come" sentence is gone (0 hits) |
| 24 | All four phase-gate scripts pass and the lockfile is byte-identical | VERIFIED | `check:artifact` (publint --strict + attw) exit 0; `check:deps` exit 0; `check:pack` exit 0; `check:node-floor` exit 0 on a pinned v22.12.0. `git diff --exit-code pnpm-lock.yaml` clean; `git status --porcelain` empty after all six mutation runs |
| 25 | Every requirement this phase owns is recorded closed in REQUIREMENTS.md, with BRG-03's deferral visible | VERIFIED | BRG-01…05 and DX-02 all `[x]` with traceability rows at `:173-177` and `:217`. BRG-03's row states the Phase 6 deferral in **bold**, in the row itself — not in a footnote |

**Score:** 25/25 truths verified

### Deferred Items

Items not met at this phase boundary but explicitly addressed later in the milestone. Each carries written authority and is **not** an actionable gap.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | SC3's end-to-end form — a real `dispatch` call returning the off-page sentence | Phase 6 | CONTEXT decision 3.3; Phase 4 locked that Phase 6 replaces the `dispatch` stub wholesale. Phase 5 proves each half separately and no test pretends otherwise |
| 2 | SC4's framework half — real React StrictMode / Svelte `$state.snapshot` | Phase 9 | ROADMAP Phase 5 note: "Guarding it twice is deliberate — it is a security defect that is invisible in a React-only suite" |
| 3 | SEC-06 C0/C1 sanitizing; DSP-09 result normalizer | Phase 6 | `src/bridge.ts:337-348` — bounded, not sanitized, so one policy does not live in two places |
| 4 | Runtime guard for the SSR registration leak | Phase 9 | `src/bridge.ts:187-209` records the invariant and states why a guard is refused in core |
| 5 | `ConciergeConfig.normalizeSnapshot` reaching a production consumer | Phase 6 | Review IN-01. Field predates Phase 5 (eca8f5b); Phase 5's shipped normalizer path is `captureSnapshot(…, normalize?)`, verified working |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/concierge/src/bridge.ts` | NEW, ≥320 lines; `createBridge` exported; `cloneDetached`/`makeDefaultNormalizer` module-private | VERIFIED | **1091 lines.** `export function createBridge` present. `cloneDetached`, `makeDefaultNormalizer`, `boundedMessage`, `defineField` and four message builders all module-private. 0 module-scope `let` |
| `packages/concierge/src/concierge.ts` | module-private `resolveBridge(stage)`; `bridgeStatus` routed through it | VERIFIED | `resolveBridge` at `:236`, sole caller `bridgeStatus` at `:305`. The `dispatch` stub is byte-unchanged — the phase-5 diff touches only doc comments naming "dispatcher" |
| `packages/concierge/src/types.ts` | corrected `SnapshotNormalizer` / `ConciergeConfig.normalizeSnapshot` doc comments | VERIFIED | Both corrections reach `dist/index.d.ts` (`:553`, `:1413`); "deep freeze" is 0 hits there |
| `packages/concierge/src/contract.ts` | re-scoped reserved-call-site paragraph naming `createBridge` | VERIFIED | Re-scoped, **not deleted** — "That narrows the reserved call site rather than closing it" reaches `dist/index.d.ts`; the Phase 9 adapter obligation stays named as pending |
| `packages/concierge/src/index.ts` | value export line + corrected module header | VERIFIED | `:134` `export { createBridge, captureSnapshot, offPageResult } from "./bridge.js";`. Header prose corrected; 0 hits for "not yet constructible" |
| `packages/concierge/test/bridge.test.ts` | NEW, ≥260 lines; thirteen orderings; five labelled contract pins | VERIFIED | **856 lines**, B1–B21. Header block at `:100-127` names O1/O3/O5/O6/O7 as non-discriminating; each of B1–B5 carries `CONTRACT PIN` in its own title **and** inline. Empirically confirmed: under M-05-1 all five stayed green while B10–B13 reddened |
| `packages/concierge/test/bridge-snapshot.test.ts` | NEW, ≥300 lines; Shape F fixture inline | VERIFIED | **1611 lines**, D1–D32 (32 cases). Shape F built inline with `Object.defineProperty`, never from `test/fixtures/` |
| `packages/concierge/test/export-surface.test.ts` | three counts + `VALUE_EXPORTS` at 14 | VERIFIED | 65/51/14 at `:139/:144/:145`; `VALUE_EXPORTS` array holds 14 names ending in the three new ones |
| `packages/concierge/test-d/exports.test-d.ts` | three placement predicates; header numbers at nine | VERIFIED | Shared import line at `:73` carries 9 names from `../src/index.js`; header says "nine" in all three places (`:55`, `:57`, `:61`) |
| `packages/concierge/test/artifact.test.ts` | one runtime case per new value export | VERIFIED | Three cases at `:141`, `:159`, `:176` |
| `packages/concierge/test-d/bridge.test-d.ts` | NEW; signature pins from the barrel | VERIFIED | **178 lines**; values imported from `../src/index.js` at `:107`; six `Equals`/`Assignable` pins |
| `packages/concierge/test/single-instance.test.ts` | F6 — the third production call site, first direct one | VERIFIED | F6 at `:287`, fresh module evaluation under `?sc7=1` at `:307`. Sole detector for M-05-8 |
| `.planning/phases/05-…/05-VALIDATION.md` | completed map, mutation results, signed sign-off | VERIFIED | `nyquist_compliant: true`, `status: complete`, `signed_off: 2026-07-31`, seventeen-mutant register with per-mutant failing cases |
| `.planning/REQUIREMENTS.md` | six requirements closed | VERIFIED | All six `[x]` with traceability rows; no orphans |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/bridge.ts` | `src/contract.ts` | `assertSingleInstance()` as first statement of `createBridge`'s body | WIRED | `:212`, inside the body. M-05-8 removal reddens F6 |
| `src/bridge.ts` | `src/host.ts` | `warnHost` for the diagnostic latches | WIRED | 4 call sites: overwrite, snapshot-threw, holder-threw, snapshot-exotic — all four observed firing in the probe |
| `src/bridge.ts` | `src/types.ts` | `MESSAGE_MAX_CHARS` value import for the off-page bound | WIRED | Imported at `:99`, consumed in `boundedMessage`. One constant, not two |
| `src/concierge.ts` `bridgeStatus` | `resolveBridge` | the only `read()` call path | WIRED | `:305`. `registry.read()` occurs exactly once in `src/`, inside the seam |
| `src/index.ts` | `src/bridge.ts` | value re-export line | WIRED | `:134`; all three names callable from `dist/index.js` |
| `test-d/exports.test-d.ts` | `src/index.ts` | shared import line — index.js, never types.js | WIRED | `:73` |
| `test-d/bridge.test-d.ts` | `src/index.ts` | value import from the **barrel** | WIRED | `:107`; `../src/bridge.js` appears only in a comment forbidding it |
| `test/bridge.test.ts` · `test/bridge-snapshot.test.ts` | `dist/index.js` | dynamic import in `beforeAll` behind an `existsSync` guard | WIRED | The guard **throws** on a missing `dist/` rather than skipping — no vacuous-green path |
| `test/single-instance.test.ts` F6 | `dist/index.js` | fresh module evaluation under a unique query string | WIRED | `?sc7=1` at `:307` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `createBridge` registry | `slot` | `register()`'s argument, stored as given | Yes — `read()` returns the same object by `===`, verified | FLOWING |
| `captureSnapshot` | `out[key]` | `holder[key].call(holder)` then `normalizeValue(…)` | Yes — real getter invocation; probe observed live values changing between captures | FLOWING |
| Default normalizer | clone tree | `cloneDetached(value, seen, onExotic)` | Yes — real structural walk; M-05-3 substitution reddens 15 cases, proving the walk is load-bearing rather than decorative | FLOWING |
| `explain().stages[].bridge` | `live` | `resolveBridge(stage)` → `registry.read()` | Yes — flips `registered` false→true on real registration; M-05-13 reddens D15 | FLOWING |
| `offPageResult` | `message` | template composition + `boundedMessage` | Yes — interpolates both parameters, real truncation; M-05-12 reddens D19/D31 | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build clean through `attw` + `publint --strict` | `pnpm build` | 4 files, "No problems found" / "No issues found" | PASS |
| Full suite | `pnpm test` | **144 passed (144)**, **9 files passed (9)** | PASS |
| Typecheck | `pnpm typecheck` (`tsc -p tsconfig.test-d.json`) | exit 0, 11 type-level suites | PASS |
| All five criteria end-to-end against `dist/` | verifier-authored `/tmp/p5_probe.mjs` | **61 passed, 0 failed** | PASS |
| Export surface, independently re-parsed | verifier parser over `dist/index.d.ts` | 65 names / 51 types / 14 values | PASS |
| Cross-registry token isolation (SSR shape) | verifier probe | registry A's unsubscriber cannot touch registry B | PASS |
| Packaging: types resolution + manifest | `pnpm run check:artifact` | exit 0 | PASS |
| Packaging: zero-runtime-byte dependencies | `pnpm run check:deps` | exit 0 — `@standard-schema/spec` 0 bytes | PASS |
| Packaging: foreign install + typecheck + import | `pnpm run check:pack` | exit 0, 4s | PASS |
| Packaging: import on the pinned Node floor | `pnpm run check:node-floor` | exit 0 on v22.12.0 | PASS |

### Probe Execution

This repository has no `scripts/*/tests/probe-*.sh` convention. The phase declares four gate scripts plus a mutation harness; all were executed by the verifier in its own process.

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `scripts/pkg05-zero-runtime-deps.mjs` | `pnpm run check:deps` | exit 0 | PASS |
| `scripts/pack-install-check.sh` | `pnpm run check:pack` | exit 0 | PASS |
| `scripts/node-floor-check.sh` | `pnpm run check:node-floor` | exit 0, asserted `v22.12.0` | PASS |
| publint --strict + attw | `pnpm run check:artifact` | exit 0 | PASS |
| M-05-1 token→object guard | `mutate-and-prove.sh … -- pnpm build && vitest run bridge` | exit 0 (gate fired); red: B10, B11, B12, B13, B20; 53 tests ran | PASS |
| M-05-3 clone→deep-freeze | same harness | exit 0; red: D1 + 14; **0 `TypeError`** in output | PASS |
| M-05-8 delete `assertSingleInstance()` | `… -- vitest run single-instance` | exit 0; red: F6 only; 6 tests ran | PASS |
| M-05-12 remove truncation | same harness | exit 0; red: D19, D31 | PASS |
| M-05-13 `resolveBridge` → `return null` | same harness | exit 0; red: D15 | PASS |
| M-05-15 array-subclass report gate → `if (false)` | same harness | exit 0; red: D32 only | PASS |

Tree verified clean (`git status --porcelain` empty) before and after every mutation run.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BRG-01 | 05-01, 05-03, 05-04, 05-06, 05-07 | Component registers and receives an identity-guarded unsubscriber | SATISFIED | B1–B13 (13 orderings); M-05-1/M-05-2 discriminate; probe C2 |
| BRG-02 | 05-04, 05-07 | Handler reads live app state; current values after an update with no re-registration | SATISFIED | B14/B15; probe C1 (`1 → 42` across one registration) |
| BRG-03 | 05-01, 05-02, 05-03, 05-05, 05-06, 05-07 | Unmounted bridge → `bridge: null` → honest off-page message | SATISFIED (two halves; E2E join deferred to Phase 6, visible in REQUIREMENTS.md) | D14–D19; M-05-13/M-05-14/M-05-12; probe C3 |
| BRG-04 | 05-01, 05-04, 05-07 | Stale unregister cannot clear a newer registration | SATISFIED | B10–B13; M-05-1 reddens exactly those four; probe C2 `===` case |
| BRG-05 | 05-01, 05-02, 05-03, 05-05, 05-06, 05-07 | Snapshots detached from framework reactivity before storage | SATISFIED (core half; framework half is Phase 9) | D1–D13, D25–D27, D32; M-05-3/4/5/6/9/15; probe C4 |
| DX-02 | 05-02, 05-05, 05-07 | An action runs with no bridge registered | SATISFIED | D20/D21/D24; `resolveBridge`; probe C5 both variants |

**Orphan check:** `grep "Phase 5" .planning/REQUIREMENTS.md` yields exactly BRG-01…05 and DX-02 — the same six the plans declared. **No orphaned requirements.**

### Anti-Patterns Found

Scanned the 12 files the phase modified (the diff scope matches the plans' `files_modified` union exactly — no scope creep).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | `TBD` / `FIXME` / `XXX` | — | **0 hits** across all 12 files. No debt-marker gate trip |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` | — | **0 hits** across all 12 files |
| `src/concierge.ts` | 116 | the word "placeholder" | INFO | Prose inside the `dispatch` stub's doc comment, describing why the stub returns a fixed result. The stub is deliberately untouched (CONTEXT 3.3); the phase-5 diff of this file contains no `dispatch` code change |
| `src/json-schema.ts` | 387 | `catch (cause)` — a bound catch | INFO | The **only** bound catch in `src/`. It predates Phase 5 (introduced at commit `049148f`, Phase 3) and lies outside the phase's file set. All five phase-5 source files have `grep -c "catch ("` = **0** |

### Disconfirmation Pass

Run deliberately against the phase's own narrative. Findings, all INFO — none undermines a must-have:

1. **A requirement that is only partially met.** BRG-03. It is proven as two halves rather than end-to-end, because the `dispatch` stub is fenced. This is the one partial requirement in the phase, it has written authority (CONTEXT 3.3), and REQUIREMENTS.md states it in bold in the row itself rather than burying it. Reported as **deferred**, not as a gap, per the phase's known-deferral list.
2. **A test that passes without testing the stated behavior.** Seven exist, and the phase names all seven itself. B1–B5 carry a literal `CONTRACT PIN` label in the title and inline; I confirmed empirically under M-05-1 that all five stay green while only B10–B13 redden — the label asserts exactly this and nothing wider. D14's non-discrimination is disclosed inline ("THIS CASE STAYS GREEN under that mutant … D15 is the one that goes red"), and D10's at the file header (`:58`, "D11 is its only detector; D10 alone is green under the narrow `try`"). The disclosure is substantively present in every case, though D10/D14 use prose where B1–B5 use the literal `CONTRACT PIN` token.
3. **Error paths with no test coverage.** Two, both reproduced by the verifier and both left open as INFO by the code review:
   - **IN-03** — `register(null)` occupies the slot; `read()` returns `null`; the next genuine registration emits a spurious `[bridge_overwrite]`. Confirmed. The type forbids `null`, and the observable for a handler is still honest (`bridge: null` → off-page path). Diagnostic noise only.
   - **IN-04** — a plain object carrying `[Symbol.toStringTag]="Date"` is diverted into the `Date` branch and passed through by reference. Confirmed — **and it warns**, so the accepted hole is visible, which is the rule this phase adopted ("a hole we accept must not also be invisible").
4. **`captureSnapshot` has no production caller inside `src/`.** Confirmed: the only non-comment reference is the barrel export. This is deliberate and pre-decided — CONTEXT's "Settled after research" section exports it precisely because criterion 4 is otherwise unprovable at runtime, and records that no public caller exists on the current design. It is a real, reachable, working public API (the verifier called it from `dist/`), and Phase 6's dispatcher is the intended internal consumer. **Not** an orphan.
5. **Planning-artifact staleness.** `05-VALIDATION.md:722` still cites the pre-review-fix latency baseline ("336 ms for 133 tests … 42 tests for the bridge filter") while `:28` and `:324` record the corrected 144/9 baseline and explicitly reconcile it ("133 at phase close plus eleven regression cases"). The numbers are traceable, not contradictory. **No shipped prose is affected** — every `dist/` claim audited above is true.

### Human Verification Required

None.

This phase ships a headless, dependency-free, DOM-free library. Every one of the five success criteria is a structural property of pure functions over ordinary JavaScript values, and each was verified by executing the built artifact directly rather than by inspection. There is no visual surface, no user flow, no real-time behavior and no external service in scope. The framework-level behaviors that would need a human (React StrictMode double-mount, Svelte `$state.snapshot`) are Phase 9's, and are recorded as deferred above. No plan declared a `<verify><human-check>` block; all seven are `autonomous: true` with empty `user_setup`.

### Gaps Summary

No gaps. All 25 must-haves — the five ROADMAP success criteria plus the twenty plan-frontmatter truths, deduplicated — resolve to VERIFIED against the codebase and the built artifact.

The three claims that were most worth doubting all held under independent instruments:

- **The mutation battery is not hollow.** Six mutants re-run from a clean tree by the verifier all fired, each with the exact failing case set the register records. M-05-3's anchor is live, not dead — `makeDefaultNormalizer(` occurs exactly twice, declaration plus one live call inside `captureSnapshot`'s key loop, so the mutant mutates code that actually runs.
- **The three Critical review findings are genuinely closed in the tree, not just in prose.** A getter throwing `Error("SECRET-…")` leaks nothing into the warning and does not escape (CR-01); a class instance passed through by reference now emits `[snapshot_exotic]` rather than passing silently (CR-02); an own `__proto__` key from `JSON.parse` survives the clone as an own key with the clone's prototype untouched and no global pollution (CR-03). The eleven regression cases D22–D32 all exist and all run.
- **Shipped prose is true in both directions.** "deep freeze" is 0 in both built artifacts; "not yet constructible" is 0 in `src/index.ts` — audited against `src/` rather than `dist/`, because the entry module's header never reaches `dist/` and a `dist/` grep would pass vacuously; `src/bridge.ts` says "nine of thirteen"; the re-scoped `contract.ts` paragraph reaches `dist/index.d.ts` and the stale sentence it replaced is gone.

The phase's most notable quality is that it labels its own non-discriminating tests rather than letting the case count read as coverage — and that labelling survived adversarial checking: under M-05-1 the five contract pins printed green while exactly the four discriminating orderings printed red.

Five items are deferred to Phases 6 and 9. Each has written authority, each is visible in REQUIREMENTS.md or in a source doc comment rather than hidden, and none is required by a Phase 5 success criterion.

---

_Verified: 2026-08-01T00:20:43Z_
_Verifier: Claude (gsd-verifier)_
