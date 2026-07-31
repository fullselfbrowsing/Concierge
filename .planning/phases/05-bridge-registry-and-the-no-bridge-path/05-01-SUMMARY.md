---
phase: 05-bridge-registry-and-the-no-bridge-path
plan: 01
subsystem: core-runtime
tags: [typescript, bridge-registry, proxy, structural-clone, snapshot, ssr, esm]

# Dependency graph
requires:
  - phase: 01-type-surface-completion
    provides: "`Bridge`, `BridgeRegistry`, `SnapshotNormalizer`, `ActionResult`, `MESSAGE_MAX_CHARS`, the twelve-member closed `ReasonCode` union including `no_bridge`"
  - phase: 02-packaging-and-the-single-instance-guard
    provides: "`assertSingleInstance()` in `src/contract.ts`, and the measured finding that a module-scope call is deleted from a consumer bundle under `\"sideEffects\": false`"
  - phase: 03-catalog-assembly
    provides: "`warnHost` in `src/host.ts`, the house diagnostic shape `concierge: [code] subject \"x\": problem Fix: fix`, and the accessor-skipping recursive freeze whose behaviour this module deliberately inverts"
  - phase: 04-stages-catalog-assembly-and-explain
    provides: "`createConcierge`'s factory shape — module scope holds immutable constants only, every mutable binding is a closure-scoped `let`, consumer callbacks are wrapped in `try {} catch {}` with no binding"
provides:
  - "`createBridge<B>(id)` — the constructible `BridgeRegistry`: single slot, last-registration-wins, monotonic-token identity guard, frozen registry object, warn-once-per-registry on overwrite"
  - "`captureSnapshot<B>(bridge, id, normalize?)` — invokes every snapshot getter and detaches each value, with two distinct warn codes"
  - "`offPageResult(what, where)` — the BRG-03 off-page `ActionResult`, bounded at `MESSAGE_MAX_CHARS`"
  - "`cloneDetached` and `makeDefaultNormalizer` — module-private; the clone-then-freeze default normalizer and its exotic-report factory"
  - "Eight unique mutation anchors and their unfiltered occurrence counts, consumed verbatim by plan 05-07"
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 06-dispatch, 08-consent-kernel, 09-adapters]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Factory returning a closure-scoped object literal, sealed on return — diverges from `createConcierge`, which returns unfrozen, and the divergence is documented at both ends"
    - "Callback-factory as an out-channel: `makeDefaultNormalizer(onExotic)` reports without widening a published type, without module-scope state, and without a second walk"
    - "Structural clone that inverts the catalog walk's accessor handling — reads through `[[Get]]` so getters ARE invoked, because invoking them is what detachment is"

key-files:
  created:
    - packages/concierge/src/bridge.ts
  modified: []

key-decisions:
  - "`makeDefaultNormalizer` is a factory taking an `onExotic` callback rather than a plain normalizer — the only shape that gives the exotic fallback a report channel while satisfying four independent pins at once"
  - "Each of the `Date`/`Map`/`Set` extractions is wrapped in its own `try`, and recursion into the extracted contents happens outside it — so a throwing getter nested inside a `Map` value is reported as `snapshot_threw` rather than mislabelled `snapshot_exotic`"
  - "The `warned` latch is allocated inside `captureSnapshot`'s body, so the warn is once per key per capture rather than per process — the only process-lifetime alternative is module-scope state, which header constraint 1 forbids"
  - "Requirements were NOT marked complete in REQUIREMENTS.md — see Deviations"

patterns-established:
  - "Prose fences as executable gates: `deepFreeze`, `deep freeze`, `concierge.js`, `catalog.js` and `structuredClone` are each grep-asserted to zero in this file, so the module header had to argue about the catalog's recursive freeze without ever naming it"
  - "Mutation anchors are written to be unique UNFILTERED, not merely comment-stripped — every doc-comment reference to an anchored expression is deliberately misspelled by one token so `mutate-and-prove.sh`, which does not skip comments, cannot mutate prose"

requirements-completed: []

# Metrics
duration: 14min
completed: 2026-07-31
---

# Phase 5 Plan 01: The bridge registry and the no-bridge path Summary

**One new 731-line module, `packages/concierge/src/bridge.ts`: a monotonic-token bridge registry sealed on return, a structural-clone snapshot normalizer that detaches an accessor-backed `Proxy` without freezing the host app's store, and the bounded off-page `ActionResult` — deliberately unbarrelled, so the export surface stays at 62/51/11 and the 87-test suite stays green.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-31T21:36:30Z
- **Completed:** 2026-07-31T21:50:29Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- `createBridge<B extends Bridge = Bridge>(id: string): BridgeRegistry<B>` — one slot, last-registration-wins, with an unsubscriber guarded on a monotonic token rather than the bridge object. Verified against the hard case: re-registering an object that is `===` its previous registration, then firing the stale unsubscriber, leaves the live registration intact.
- `captureSnapshot` + the module-private `cloneDetached` / `makeDefaultNormalizer` pair. Verified against the Shape F accessor-backed proxy fixture: the captured value reads `"shoes"` and stays `"shoes"` after the app writes `"boots"`, while `Object.isFrozen(proxy)` and `Object.isFrozen(backing)` both stay `false` and the store stays writable.
- `offPageResult(what, where)` — 108 characters for the worked example, 72 of headroom under the 180 bound, measured by execution.
- Eight mutation anchors, each unique **unfiltered**, plus the `makeDefaultNormalizer(` count of exactly 2 that proves the factory is on a live call path.

## Task Commits

1. **Task 1 (05-01-T1): The registry closure and the off-page helper** — `43cbf44` (feat)
2. **Task 2 (05-01-T2): The structural clone and the capture loop** — `65cc1ca` (feat)

## Files Created/Modified

- `packages/concierge/src/bridge.ts` (created, 731 lines) — module header with the four SILENT constraints; `bridgeOverwriteMessage`, `snapshotThrewMessage`, `snapshotExoticMessage` (module-private builders); `createBridge` and `offPageResult` (exported); `cloneDetached` and `makeDefaultNormalizer` (module-private); `captureSnapshot` (exported).

**Not modified, deliberately:** `src/index.ts` (the barrel is plan 05-03's, together with all eleven export pins — the only way those move without a red first run), `src/catalog.ts`, `src/host.ts`, `src/concierge.ts`, `src/types.ts`, `src/contract.ts`.

---

## Handoff data — read this section, later plans depend on it

### The three warn messages, rendered

Sample values: registry `id` = `results`, snapshot key = `filters`. All three go through `warnHost`; none is an `ActionResult.message`, so `MESSAGE_MAX_CHARS` does not apply to them — the same as the existing `duplicateStageIdMessage`.

**`bridge_overwrite`** (340 chars), emitted from `register()` when a live registration is displaced, latched per registry:

```
concierge: [bridge_overwrite] bridge "results": a second component registered over a still-live registration, so the first component's snapshot and actions are no longer reachable through this registry. Fix: make sure exactly one mounted component registers this bridge. This warning fires once per registry, so a later overwrite is silent.
```

**`snapshot_threw`** (310 chars), emitted from `captureSnapshot`'s `catch`, latched per key per capture:

```
concierge: [snapshot_threw] snapshot "results.filters": the getter threw, so this key is absent from the captured snapshot and every reader of it sees nothing where a value should be. Fix: make the getter total — it runs on every capture, so it must not assume any part of the component's state has loaded yet.
```

**`snapshot_exotic`** (308 chars), emitted from the `onExotic` callback `captureSnapshot` closes over per key, latched on the same `Set`:

```
concierge: [snapshot_exotic] snapshot "results.filters": a value here could not be detached and was carried by reference, so it may still change after capture and a later drift check may not see the change. Fix: supply a `normalizeSnapshot` that understands this value — for Svelte that is `$state.snapshot`.
```

The em-dash in the two `snapshot_*` fix clauses is U+2014, and the backticks around `normalizeSnapshot` and `$state.snapshot` are literal characters in the emitted string.

### The off-page sentence

```js
offPageResult("The result count", "results page")
// → { ok: false, reason: "no_bridge", message: "The result count is not available because the results page is not open. Open the results page and try again." }
```

`message.length` is **108**. Measured by execution against the built module, not counted by hand. `180 - 108 = 72` of headroom. The bound truncates rather than throws: `offPageResult("X".repeat(300), "y").message.length === 180`.

### Mutation anchors — unfiltered occurrence counts

Counted with `String.split(literal).length - 1` over the raw file, **not** comment-stripped, because `scripts/mutate-and-prove.sh` does not skip comments (Known Limitation 3). Every count is 1, so no doc comment can be mutated in place of code.

| Mutant | Anchor literal (verbatim) | Unfiltered count |
|---|---|---|
| M-05-8 | `assertSingleInstance();` | 1 |
| M-05-7 | `return Object.freeze(registry);` | 1 |
| M-05-1 | `if (slot?.token === token)` | 1 |
| M-05-12 | `message.slice(0, MESSAGE_MAX_CHARS)` | 1 |
| M-05-3 | `cloneDetached(value, seen, onExotic) as T` | 1 |
| M-05-6 (array arm) | `Array.isArray(obj)` | 1 |
| M-05-6 (null-prototype arm) | `proto === null` | 1 |
| M-05-9 / capture return | `return out;` | 1 |

**M-05-3's replacement was probed end to end this session.** `scripts/mutate-and-prove.sh packages/concierge/src/bridge.ts "cloneDetached(value, seen, onExotic) as T" "Object.freeze(value) as T" -- pnpm typecheck` substituted exactly one occurrence (no exit 3), the typecheck gate exited 0, the script reported `FAIL: gate did NOT fire — mutant escaped`, and it restored the file (`git status` clean afterwards). That is the **expected** result at this point in the phase: the mutant compiles cleanly under TypeScript 7.0.2 with the production flags, so only a runtime behavioural test can catch it — which is plan 05-05's job. Plan 05-07 can use that pattern/replacement pair verbatim.

### `makeDefaultNormalizer` is on a live call path

`makeDefaultNormalizer(` occurs **exactly 2 times**, comment-stripped and unfiltered alike:

1. the declaration — `function makeDefaultNormalizer(onExotic: () => void): SnapshotNormalizer {`
2. the call inside `captureSnapshot`'s key loop — `makeDefaultNormalizer((): void => {`

It was **not** inlined as an anonymous closure. M-05-3 therefore mutates a function that is actually invoked, and the battery cannot record the inversion the phase gate exists to prevent.

### Final line count

`wc -l packages/concierge/src/bridge.ts` → **731** (the plan's `min_lines` was 320).

---

## Decisions Made

- **`makeDefaultNormalizer` is a factory, and this was forced rather than chosen.** CONTEXT locks a `snapshot_exotic` warn on the exotic-clone fallback, which needs a mechanism, and four pins jointly close the obvious ones: `SnapshotNormalizer` is `<T>(value: T) => T` with no out-channel; module-scope mutable state is forbidden by header constraint 1 and gated by `grep -c "^let "` returning 0; a second walk over the clone's result is forbidden (it was measured to freeze the consumer's own model objects); and the single delegating call must stay a live, unique M-05-3 anchor. A callback-taking factory whose returned closure carries the delegation is the one shape that satisfies all four.
- **Each `Date`/`Map`/`Set` extraction has its own `try`, and recursion happens outside it.** The plan required the branch to be inside a `try`; the narrower scoping is a refinement, not a departure. Extraction (`getTime()`, spreading the collection) is the only operation a naively proxied instance throws on, so wrapping only it keeps the `catch` honest: a throwing getter nested inside a `Map` value now propagates to `captureSnapshot`'s `try` and is reported as `snapshot_threw`, where a wider `try` would have caught it here and mislabelled it `snapshot_exotic` — sending a developer to look at a value that is fine. Verified: a nested throwing getter emits exactly one `snapshot_threw` and no `snapshot_exotic`. The `memo.set` also happens strictly after the extraction, so a failed extraction leaves no partial clone in `seen` for a later DAG visit to find.
- **`hit !== undefined` is the memo's absence test, and it is exact rather than approximate.** Nothing is ever stored under a key whose value is `undefined` — every `seen.set` writes a freshly constructed node — so the test cannot confuse "cloned to `undefined`" with "not seen". Written down in the source so a reader does not "harden" it into a `seen.has(obj)` + `seen.get(obj)` pair.
- **The `snapshot_threw` path writes `out[key] = undefined` rather than omitting the key**, so `"boom" in snapshot` distinguishes a key that failed from a key the component never declared. Verified.

## Deviations from Plan

### Deliberate scope refusals (not deviations, recorded so the verifier can tell them apart)

**REQUIREMENTS.md was not touched, and no requirement was marked complete.** The plan's frontmatter lists `[BRG-01, BRG-03, BRG-04, BRG-05]`, and the normal step is `gsd-sdk query requirements.mark-complete`. Two reasons not to, both concrete:

1. **Concurrency.** Plan 05-02 is in the **same wave** (wave 1) and its frontmatter claims `[BRG-03, BRG-05, DX-02]` — two of the same ids. Two worktree agents writing the same rows of REQUIREMENTS.md in parallel produce a merge conflict on a shared artifact the orchestrator owns.
2. **Truth.** None of the four is actually satisfied at this plan's boundary. The module is deliberately unbarrelled, so nothing here is reachable from `dist/index.js`; the runtime proof lands in 05-04 and 05-05, and the barrel in 05-03. Marking BRG-01 complete against a module no consumer can import would be exactly the "looks enforced without a test proving it" failure this phase's own CONTEXT rejects.

The orchestrator should mark them at the phase boundary, after 05-07's mutation battery.

### Auto-fixed issues

**None.** No bug, missing-critical-functionality, or blocking issue arose. The plan's pins were followed as written; the two refinements above (`try` scoping and the memo-write ordering) are elaborations inside the latitude the plan grants, not corrections to it.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None. Two tasks, two commits, one file, every acceptance criterion met.

## Issues Encountered

- **Two prose fences collided with the plan's own instructions and had to be routed around.** Header constraint 4 asks for a paragraph about the catalog's recursive freeze skipping accessors, while the acceptance criteria require `grep -c "deepFreeze"` and `grep -c "deep freeze"` to both return 0 in this file. The argument is therefore made in full while naming the function only as "the recursive freeze in `./catalog.ts`". Same for `catalog.js` / `concierge.js`: the header cross-references those modules by their `.ts` paths throughout.
- **Anchor uniqueness had to hold unfiltered, which is stricter than the plan's own verify commands.** Those strip comment lines; `mutate-and-prove.sh` does not. Every doc-comment mention of an anchored expression is therefore deliberately one token short of the anchor — `assertSingleInstance()` without the semicolon, `Array.isArray` without `(obj)`, "the second arm of the test" instead of the null-prototype comparison, `makeDefaultNormalizer` without the open paren. All eight anchors plus the factory count verify at their target values against the raw file.

## Verification Evidence

| Gate | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm build` | exit 0, including `attw` at `level: "error"` and `publint --strict` — both clean |
| `pnpm test` | `Test Files 7 passed (7)` / `Tests 87 passed (87)` — unchanged, as an unbarrelled module must leave it |
| Built export surface | `62 51 11` — unchanged, proving the module is not yet bundled |
| `pnpm check:deps` | `core's dependencies contribute zero bytes to a consumer bundle` |
| `git diff --name-status <base>..HEAD` | `A packages/concierge/src/bridge.ts` and nothing else |
| Mutant anchors, unfiltered | 8 literals × 1 occurrence; `makeDefaultNormalizer(` × 2 |
| Prose/import fences | `deepFreeze` 0, `deep freeze` 0, `concierge.js` 0, `catalog.js` 0, `structuredClone` 0, `typeof window` 0 in code, `^let ` 0 |
| Source signatures | `export function createBridge<B extends Bridge = Bridge>(id: string): BridgeRegistry<B>`, `export function offPageResult(what: string, where: string): ActionResult`, `export function captureSnapshot<B extends Bridge>(bridge: B, id: string, normalize?: SnapshotNormalizer): Record<string, unknown>` — all present verbatim |
| M-05-8 placement | `assertSingleInstance();` at a character index greater than `export function createBridge` — inside the body, not module scope |
| M-05-11 | zero `warnHost` occurrences between `return (): void => {` and its closing brace |
| M-05-9 / Pitfall 3 | `out[key] = normalizeValue(getter());` on one line inside the `try`; no `try { out[key] = getter(); }` anywhere |
| Exotic signal path | `onExotic: () => void` is `cloneDetached`'s third parameter; `onExotic()` is called from all three extraction catches; all 5 recursive calls thread `seen, onExotic`; `warnHost` never appears inside `cloneDetached` |
| Internals unexported | `grep -cE "export (function\|const) (cloneDetached\|makeDefaultNormalizer)"` → 0 |

### Behavioural evidence (probe build, not a committed test)

`src/bridge.ts` was bundled standalone to `/tmp` with `tsdown --no-config` and exercised directly. This is evidence for the SUMMARY, not a substitute for plans 05-04 / 05-05, which must assert the same properties against `dist/index.js` after the barrel lands. Every claim below passed:

- **Registry (BRG-01, BRG-04).** Registry is frozen; `registry.read = evil` throws `TypeError`; `read()` is `null` before registration and returns the registered object after. The hard identity case: register `b1`, register `b1` **again** (same reference), fire the first unsubscriber → the live registration survives; fire the second → cleared; fire it again → idempotent no-op. Registration still works after the freeze, proving sealing the object does not seal the closure. Overwrite warns exactly once per registry.
- **Detachment (BRG-05), Shape F fixture.** Captured `store.q === "shoes"`; the app writes `backing.q = "boots"`; captured value still `"shoes"`. `Object.isFrozen(proxy) === false`, `Object.isFrozen(backing) === false`, and `backing.page = 2` succeeds — the host store is not collateral damage.
- **Clone algorithm.** Cycle → `c.self === c`. DAG → `c.l === c.r` and `c.l !== shared`. `Object.create(null)` record → cloned, not passed through (the M-05-6 arm). Array → cloned and frozen, elements cloned. `Date` / `Map` / `Set` → distinct instances with contents preserved. Class instance and `Object.create({})` → passed through by reference **and left unfrozen**. Symbol-keyed property → dropped.
- **Capture guards (T-05-05).** A getter throwing `new Error("SECRET user@example.com")` → key present and `undefined`, one `snapshot_threw` warn, and the warn contains neither `SECRET` nor the address. A getter returning an object with a **nested** throwing getter → caught by the same `try`, nothing escapes, still `snapshot_threw`, still no leak.
- **Exotic path.** `new Proxy(new Date(0), {})` nested in a plain object → carried by reference, one `snapshot_exotic` warn naming `results.d`. Supplying a caller `normalize` → **zero** warns, which is the documented asymmetry. The returned container is not frozen.

## User Setup Required

None.

## Next Phase Readiness

**Ready for the rest of wave 1 and wave 2.**

- **05-02** (doc-comment corrections in `types.ts` / `contract.ts` / `index.ts`) shares no file with this plan and can land in parallel. The `types.ts:1611` correction it makes should match this module's header constraint 3: clone-then-freeze, and cloning fires only read traps while freezing fires write traps.
- **05-03** (the barrel plus all eleven export pins) adds exactly three value exports — `createBridge`, `captureSnapshot`, `offPageResult` — taking the surface from `62 / 51 / 11` to `65 / 51 / 14`. Both module-private helpers stay off it; that is grep-asserted here and should be re-asserted there.
- **05-04 / 05-05 / 05-06** get the runtime surface they need. The Shape F fixture from RESEARCH lines 559-581 is the one that makes the M-05-3 mutant fail *visibly* rather than by throwing; it is reproduced verbatim in the probe above and is known to work against this implementation.
- **05-07** can use the anchor table above verbatim. The M-05-3 pattern/replacement pair is already known to substitute cleanly and to escape a typecheck-only gate.

**Carried forward, not a blocker:** the SSR registration invariant is recorded on `createBridge`'s JSDoc — where it reaches `dist/index.d.ts`, unlike a module header — with no runtime guard and no `host.ts` change, exactly as CONTEXT settled. Phase 9 owns it.

## Self-Check: PASSED

- `packages/concierge/src/bridge.ts` — FOUND (37922 bytes, 731 lines)
- `.planning/phases/05-bridge-registry-and-the-no-bridge-path/05-01-SUMMARY.md` — FOUND
- `43cbf44` — FOUND in git log
- `65cc1ca` — FOUND in git log
- `f635d24` — FOUND in git log
- Working tree clean; no shared orchestrator artifacts (STATE.md, ROADMAP.md, REQUIREMENTS.md) modified.

---
*Phase: 05-bridge-registry-and-the-no-bridge-path*
*Completed: 2026-07-31*
