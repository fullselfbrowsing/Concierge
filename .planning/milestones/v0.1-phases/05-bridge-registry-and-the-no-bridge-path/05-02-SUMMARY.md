---
phase: 05-bridge-registry-and-the-no-bridge-path
plan: 02
subsystem: core
tags: [typescript, bridge-registry, doc-comments, dist-prose, explain]

# Dependency graph
requires:
  - phase: 04-stages-catalog-assembly-and-explain
    provides: "`bridgeStatus`, the three-state `explain()` bridge row, and the `dispatch` stub Phase 6 replaces"
  - phase: 01-type-surface-completion
    provides: "`Bridge`, `BridgeRegistry`, `SnapshotNormalizer`, `ConciergeConfig.normalizeSnapshot`"
provides:
  - "module-private `resolveBridge(stage): Bridge | null` in `src/concierge.ts` — the one stage-to-bridge resolution seam"
  - "`bridgeStatus` routed through that seam, so `explain()` exercises it from `dist/index.js`"
  - "corrected `SnapshotNormalizer` and `ConciergeConfig.normalizeSnapshot` doc comments — the shipped default-normalizer claim is now measured rather than false"
  - "re-scoped `assertSingleInstance` reserved-call-site paragraph naming `createBridge` as the first direct production call site"
affects: [05-03-createBridge, 05-05-snapshot-capture, 05-07-phase-gate, 06-dispatcher, 08-consent-drift-check]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "single-call-site seam: one named function owns the throw policy and the not-declared policy, exactly as `runMatch` owns them for `stage.match`"
    - "in-place prose correction: a shipped doc comment that went false is corrected AND annotated with the direction of the correction, never silently rewritten"

key-files:
  created: []
  modified:
    - packages/concierge/src/concierge.ts
    - packages/concierge/src/types.ts
    - packages/concierge/src/contract.ts

key-decisions:
  - "The `undefined` arm of the old `registered` test moves into `resolveBridge`'s `?? null` rather than disappearing — a JavaScript consumer's `read()` can return `undefined` even though the interface types it `B | null`, and `ctx.bridge: B | null` becomes structurally true at the producing point"
  - "`bridgeStatus` keeps its own `stage.bridge === undefined` early return AHEAD of the seam call — `resolveBridge` collapses not-declared and declared-but-unmounted into one `null`, which is right for a handler and wrong for a report"
  - "The mechanism sentence is written `**read traps**` / `**write traps**` rather than RESEARCH's `*read*` / `*write*`, so the two-word substrings the phase gate greps stay contiguous"
  - "`contract.ts`'s reservation is narrowed, not closed: `createBridge` discharges it for apps that call `createBridge` directly; a Phase 9 adapter mounting without one still needs its own call"

patterns-established:
  - "Resolution seam: `resolveBridge` is module-private, called from exactly one place today, and Phase 6's dispatcher becomes the second and last caller"
  - "Consumer callbacks stay wrapped in `try {} catch {}` with NO binding — no caught value is in scope to interpolate, so the no-echo property is structural"

requirements-completed: [BRG-03, BRG-05, DX-02]

# Metrics
duration: 9min
completed: 2026-07-31
---

# Phase 05 Plan 02: The resolveBridge seam and three shipped-prose corrections Summary

**A module-private `resolveBridge(stage): Bridge | null` seam now owns stage-to-bridge resolution and `bridgeStatus` routes through it, and the three doc comments that shipped a false claim about the default snapshot normalizer and a now-stale reserved call site are corrected in place.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-07-31T21:36:30Z
- **Completed:** 2026-07-31T21:45:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `resolveBridge` exists as the single named seam through which a stage becomes a bridge. `bridgeStatus` — until now the only `read()` call site in the package — calls it, so `explain()` exercises the seam through `dist/index.js` and BRG-03's resolution half is provable at the layer this project tests at.
- DX-02 is structural rather than aspirational: a stage that declares no bridge and a stage whose declared bridge is unmounted both resolve to `null`, with no error and no auto-fail. Core never decides an action cannot run because nothing is registered; the handler receives `null` and decides.
- `explain()`'s three-state bridge row is behaviourally unchanged. S20 passes untouched, `test-d/concierge.test-d.ts`'s `_stageExplanationBridgeShape` is unmoved, and the export surface is still 62 names / 51 types / 11 values.
- Two false claims that were already shipping in `dist/index.d.ts` (at `:553` and `:1409`) are gone. A consumer reading the declaration file previously learned that leaving `normalizeSnapshot` unset got them a freeze applied in place — a default that fails BRG-05 outright, because freezing a Proxy does not detach it.
- `contract.ts`'s reserved-call-site paragraph is re-scoped rather than deleted, and carries the anchor clause the Wave-4 phase gate greps for.

## Task Commits

Each task was committed atomically:

1. **Task 1 (05-02-T1): The resolveBridge seam** — `6ec5720` (feat)
2. **Task 2 (05-02-T2): Correct the three shipped doc comments** — `f514e20` (docs)

## Files Created/Modified

- `packages/concierge/src/concierge.ts` — added module-private `resolveBridge`; rewrote `bridgeStatus`'s body to call it; added `Bridge` to the `import type` list. `DISPATCH_NOT_IMPLEMENTED` and the `dispatch` stub are byte-identical (verified by diffing both regions against `HEAD~`).
- `packages/concierge/src/types.ts` — corrected the `SnapshotNormalizer` and `ConciergeConfig.normalizeSnapshot` doc comments. Both declarations are unchanged verbatim.
- `packages/concierge/src/contract.ts` — added `createBridge` to the `assertSingleInstance` instruction line; re-scoped the reserved-call-site paragraph.

## The final text of `resolveBridge`

`packages/concierge/src/concierge.ts:184-247`:

```typescript
/**
 * The ONE place a stage becomes a bridge — the same rule header constraint 3
 * states for `stage.match`, applied to the other consumer-supplied seam a stage
 * carries.
 *
 * `bridgeStatus` is its only caller today. Phase 6's dispatcher is the second,
 * and there must never be a third: the throw policy below and the not-declared
 * policy below it are each written once here, so `explain` and a dispatcher
 * cannot drift into two readers that disagree about the same stage. A second
 * resolution path is not a duplicate function, it is a second answer to "is this
 * bridge mounted" — and the two would be consulted by different callers.
 *
 * **A stage that declares no bridge resolves to `null` without error and without
 * auto-failing anything (DX-02).** Declaring no bridge is a supported
 * configuration rather than a defect: an action that reads router or DOM state
 * must run with nothing registered at all. Core therefore never auto-fails an
 * action because a stage's declared bridge is unmounted, and it certainly does
 * not fail one for a stage that declares nothing. The handler receives `null`
 * and decides.
 *
 * **`read()` is consumer code, so it is guarded exactly as `match` is** — the
 * `catch` takes no binding, so there is no caught value in scope to interpolate
 * and the property is structural rather than a matter of remembering not to
 * echo one. A throwing `read()` is not a registration; it degrades to "not
 * mounted" rather than taking down the one call a developer makes when they are
 * already confused.
 *
 * **The `?? null` coalesce is a decision, not a tidying.** `BridgeRegistry.read`
 * is typed `() => B | null`, but the interface is implemented by consumers, and
 * a JavaScript consumer whose `read()` falls off the end returns `undefined`.
 * That case is exactly why `bridgeStatus` tested both `null` and `undefined`
 * before this seam existed; the arm does not disappear, it MOVES here. Two
 * consequences, and both are why it is written rather than left implicit: the
 * observable is unchanged — such a registry still reports `registered: false` —
 * and the handler contract `ctx.bridge: B | null` becomes structurally true at
 * the one point that produces the value, rather than merely annotated at the
 * point that consumes it.
 *
 * **This deliberately collapses "not declared" and "declared but unmounted" into
 * the same `null`,** because a handler has the same thing to do about both. The
 * distinction is a *reporting* concern, not a resolution one, which is why
 * `bridgeStatus` keeps its own `stage.bridge === undefined` early return ahead of
 * the call rather than reconstructing the distinction from this return value.
 *
 * The parameter is spelled `ConciergeConfig["stages"][number]` for the reason
 * already recorded on `bridgeStatus` below: the `any` lives in `types.ts`, where
 * D-07's measured contravariance reason justifies it, and re-spelling it here
 * would be a second, unargued occurrence of an erasure that was argued once.
 * Because that collection is erased, `registry.read()` yields `any`; the
 * explicit `Bridge | null` return annotation is what stops the erasure
 * propagating to every caller.
 */
function resolveBridge(stage: ConciergeConfig["stages"][number]): Bridge | null {
  const registry: ConciergeConfig["stages"][number]["bridge"] = stage.bridge;
  if (registry === undefined) {
    return null;
  }

  try {
    return registry.read() ?? null;
  } catch {
    return null;
  }
}
```

The rewritten `bridgeStatus` body (`concierge.ts:288-308`); its doc comment and signature are unchanged:

```typescript
  const registry: ConciergeConfig["stages"][number]["bridge"] = stage.bridge;
  // **This early return stays HERE, ahead of the seam, and is not a redundant
  // repeat of the one inside it.** `resolveBridge` collapses "declares no
  // bridge" and "declares one that is unmounted" into the same `null`, which is
  // right for a handler and wrong for a report. Reading the row off that return
  // value alone would turn a stage with no bridge from `null` into
  // `{id, registered: false}` — and there is no `id` to put there. The
  // three-state shape is pinned by `types.ts` and by
  // `test-d/concierge.test-d.ts`'s `_stageExplanationBridgeShape`; do not
  // "simplify" this away.
  if (registry === undefined) {
    return null;
  }

  const live: Bridge | null = resolveBridge(stage);

  return { id: registry.id, registered: live !== null };
```

## Evidence table

### The false-default phrase, before and after

The audited literal is the two-word phrase for a recursive freeze. It is written hyphenated
everywhere in this SUMMARY (`deep-freeze`) so this file cannot itself trip a repo-wide audit; the
greps below used the real two-word spelling.

| File | Before | After |
|---|---|---|
| `packages/concierge/src/types.ts` | **2** | **0** |
| `packages/concierge/src/contract.ts` | **0** | **0** |
| `packages/concierge/dist/index.d.ts` | **2** (at `:553` and `:1409`) | **0** |
| `packages/concierge/dist/index.js` | **0** | **0** |

Both "before" hits in `dist/index.d.ts` were emitted from `src/types.ts` — the JSDoc for
`SnapshotNormalizer` (shipped at `:553`) and for `ConciergeConfig.normalizeSnapshot` (shipped at
`:1409`). The baseline matches the plan's measurement exactly (2 / 0 / 2 / 0).

### Where the re-scoped `contract.ts` paragraph now lands in `dist/index.d.ts`

- Old paragraph, pre-correction: `dist/index.d.ts:2062` (`The **adapter-registration** call site named above is genuinely still to`).
- Re-scoped paragraph, post-correction: **`dist/index.d.ts:2104-2121`**. It opens at `:2104` with
  `**\`createBridge\` in \`./bridge.ts\` arrived in Phase 5, …` and the second half
  (`**That narrows the reserved call site rather than closing it**, …`) runs `:2113-2121`.

### Re-scope anchor phrase

re-scope anchor phrase: the first direct production call site — `dist/index.d.ts` hits before the edit: **0**; after `pnpm build`: **1** (at `dist/index.d.ts:2107`).

Also measured before the edit, for the "shown able to fire" rule: **0** in `packages/concierge/dist/index.js`, **0** in `packages/concierge/src/contract.ts`. After: **1** in `src/contract.ts`, **0** in `dist/index.js` (the paragraph is a declaration-file comment and is not carried into the JS bundle — the same behaviour every other `contract.ts` doc comment shows).

The clause is on one line, unwrapped, with no backticks and no markdown emphasis. Both gates that
consult it (this plan's `<verify>` and plan 05-07's) grep the literal fixed in the plans with
`grep -qF`; **no gate parses this SUMMARY and no gate reads any file under `/tmp`.** This line is
recorded for 05-07's evidence table only.

### `createBridge` in `dist/index.d.ts` — recorded, NOT a gate

| | Count |
|---|---|
| Before this plan | **1** (at `dist/index.d.ts:1245`, emitted from `src/types.ts:1446` — `StageExplanation["bridge"]`'s doc comment) |
| After this plan | **6** |

A bare-identifier assertion on this would be an audit that cannot fail (threat T-05-12): it already
returned 1 on the uncorrected tree, and plan 05-03 will push it higher regardless of whether this
re-scope shipped. Recorded for completeness; asserted on by nothing.

### Unfiltered occurrence counts for plan 05-07's mutation battery

Counted with comments left in, per `mutate-and-prove.sh`'s Known Limitation 3.

| Literal | Unfiltered count in `src/concierge.ts` | Mutant |
|---|---|---|
| `return registry.read() ?? null;` | **1** | M-05-13 — substitute `return null;`; effect is "resolution always off-page" |
| `if (registry === undefined) {` | **2** | ⚠️ see note below |
| `const live: Bridge | null = resolveBridge(stage);` | **1** | anchors the redirect itself |
| `registered: live !== null` | **1** | anchors the three-state row's second field |

⚠️ **`if (registry === undefined) {` occurs TWICE and a first-occurrence substitution hits the wrong
one.** Occurrence 1 is `resolveBridge`'s (`concierge.ts:238`); occurrence 2 is `bridgeStatus`'s
(`concierge.ts:298`) — the M-05-14 target. A `perl -0pi` mutation on the bare literal will silently
mutate `resolveBridge` instead, which is Pitfall 8 in this phase's RESEARCH, inverted. To target
M-05-14, mutate the **multi-line** literal instead, which is unique because the line following it is
unique:

```
  if (registry === undefined) {
    return null;
  }

  const live: Bridge | null = resolveBridge(stage);
```

In the comment-stripped source (`grep -v "^\s*[*/]"`), the three plan-specified anchors
(`return registry.read() ?? null;`, `resolveBridge(stage)`, `registered: live !== null`) each occur
exactly **1** time.

## Decisions Made

- **The mechanism sentence is emphasised as `**read traps**` / `**write traps**`, not RESEARCH's `*read*` / `*write*`.** RESEARCH specifies the sentence "verbatim" with the emphasis inside the word, but the plan's own acceptance criterion greps `dist/index.d.ts` for the fixed string `read traps`. With `*read* traps` that substring does not exist and the gate would fail on a correct correction. Moving the emphasis markers outward keeps the sentence's content verbatim and keeps both two-word substrings contiguous. Resolved toward the measurable acceptance criterion.
- **The `?? null` coalesce is documented as a decision with both halves written out** — that the `undefined` arm moved rather than disappeared, and that the observable is unchanged. PATTERNS required this to be stated rather than left implicit.
- **`bridgeStatus`'s early return carries an inline comment naming why it is not redundant.** `resolveBridge` contains a textually identical guard four lines above; without the comment the `bridgeStatus` one reads as a duplicate and is exactly the kind of thing a later reader "simplifies", which collapses `explain()`'s three-state row to two.
- **The re-scoped paragraph says `createBridge` is the first direct production call site *on the registration side of the instruction*,** rather than the first direct call site outright. `buildCatalog` is also a direct call (`contract.ts:140`), so the unqualified claim would be false; the qualified one is true and still carries the anchor clause contiguously.

## Deviations from Plan

None — plan executed exactly as written.

One environment step was required before any gate could run: this worktree had no `node_modules`, so
`pnpm install --frozen-lockfile` was run first. It resolved nothing and downloaded nothing new
("Lockfile is up to date, resolution step is skipped"; 234 packages, all reused from the store), and
`pnpm-lock.yaml` is unmodified. No package was added, so the package-legitimacy checkpoint does not
apply. `pnpm check:deps` was re-run after the change and both assertions pass — the unbundled
external import list is still `[]` and `@standard-schema/spec`'s ESM runtime entry is still 0 bytes.

## Issues Encountered

None. Every baseline this plan asserts was re-measured against the uncorrected tree before any edit
and matched the plan exactly: `deep-freeze` at 2 / 0 / 2 / 0, `createBridge` in `dist/index.d.ts` at
1, and the anchor clause at 0 / 0 / 0. Baseline suite was green at 87 tests before the first edit.

## Verification

| Gate | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm build` | exit 0; attw and publint both clean |
| `pnpm test` | `Tests  87 passed (87)`, 7 files |
| S20 — "the bridge field reports declared-and-unmounted, declared-and-mounted, and not declared" | ✓ passes, untouched |
| Export surface | 62 names / 51 types / 11 values — unmoved |
| Comment-stripped seam anchors unique | ✓ 1 / 1 / 1 |
| `resolveBridge` signature verbatim, and not exported | ✓ (`grep -cE "^export function resolveBridge"` → 0) |
| `} catch {` with no binding inside `resolveBridge` | ✓ no `} catch (` anywhere in the file |
| `DISPATCH_NOT_IMPLEMENTED` region byte-identical to `HEAD~2` | ✓ `diff` clean |
| `dispatch` stub byte-identical to `HEAD~2` | ✓ `diff` clean |
| `deep-freeze` phrase, all four files | ✓ 0 / 0 / 0 / 0 |
| Anchor clause in `src/contract.ts` and `dist/index.d.ts` | ✓ present in both |
| Mechanism sentence ships (`read traps`, with `preventExtensions` / `defineProperty` in the same region) | ✓ `dist/index.d.ts:1428-1429` |
| `export type SnapshotNormalizer = <T>(value: T) => T;` verbatim | ✓ unchanged |
| `normalizeSnapshot?: SnapshotNormalizer;` verbatim | ✓ unchanged |
| `src/index.ts` untouched (belongs to 05-03) | ✓ not in the diff |
| `pnpm check:deps` | ✓ both assertions pass |
| `git status --short` after both commits | clean |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **For plan 05-03 (`createBridge`, `src/bridge.ts`, barrel export):** `contract.ts` now instructs
  `createBridge` to call `assertSingleInstance()` from its own body and the re-scoped paragraph
  already asserts that it does. **05-03 must actually make that call** — the prose shipped in this
  plan is currently ahead of the code, by the plan's own design, and the two converge only when
  05-03 lands. 05-03 also owns `src/index.ts`'s `not yet constructible` prose; this plan did not
  touch that file.
- **For plan 05-05 (snapshot capture / the default normalizer):** `ConciergeConfig.normalizeSnapshot`'s
  corrected comment is now the specification the implementation must satisfy — clone-then-freeze;
  plain objects, arrays, `Date`, `Map`, `Set` cloned; everything else by reference; symbol keys not
  carried; detachment rather than immutability. If the implementation diverges, the comment is the
  thing that is wrong.
- **For plan 05-07 (phase gate):** the anchor literal `the first direct production call site` is
  present in `src/contract.ts` and reaches `dist/index.d.ts:2107`. Grep it with `grep -qF`. Do not
  reconstruct it from `/tmp` or from this SUMMARY.
- **For Phase 6:** `resolveBridge` is the seam the dispatcher calls. It is the second and final
  caller — do not write a parallel resolution path. The `dispatch` stub and
  `DISPATCH_NOT_IMPLEMENTED` are untouched and still byte-identical to their Phase 4 form, so
  Phase 6 deletes both together as planned.
- **No blockers.**

## Self-Check: PASSED

- `packages/concierge/src/concierge.ts` — FOUND
- `packages/concierge/src/types.ts` — FOUND
- `packages/concierge/src/contract.ts` — FOUND
- `.planning/phases/05-bridge-registry-and-the-no-bridge-path/05-02-SUMMARY.md` — FOUND
- Commit `6ec5720` — FOUND
- Commit `f514e20` — FOUND

---
*Phase: 05-bridge-registry-and-the-no-bridge-path*
*Completed: 2026-07-31*
