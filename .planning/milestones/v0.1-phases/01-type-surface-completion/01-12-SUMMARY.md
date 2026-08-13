---
phase: 01-type-surface-completion
plan: 12
subsystem: types
tags: [typescript, exactOptionalPropertyTypes, invocation, consent, type-tests, mutation-testing]

# Dependency graph
requires:
  - phase: 01-11
    provides: the Bridge defaults and stages erasure this plan sits on top of and must not disturb
  - phase: 01-10
    provides: the readonly consent surface, including the readbackHash guard this plan had to prove still green
provides:
  - explicit `| undefined` on eleven optional members across InvocationMeta, DeliveryReport, ActionHandler's context, and ToolBatch
  - five construction positives that go TS2375 the moment a widening is removed
  - the measured fact that `Equals<{x?: T}, {x?: T | undefined}>` is `true` under EOPT, which is why the defect was invisible
affects: [phase-6-dispatcher, phase-7-transports, phase-8-consent-kernel, phase-2-mutation-harness, 01-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A widening whose read type is unobservable is guarded by a construction positive, never by a predicate"
    - "A function type is parenthesised before `| undefined`, because unparenthesised the union binds in the return position and yields a different type that still compiles"

key-files:
  created:
    - .planning/phases/01-type-surface-completion/01-12-SUMMARY.md
  modified:
    - packages/concierge/src/types.ts
    - packages/concierge/test-d/transport.test-d.ts
    - packages/concierge/test-d/actions.test-d.ts

key-decisions:
  - "Measured `Equals<{x?: T}, {x?: T | undefined}>` = true under EOPT before touching src/, which is both the confirmation 01-10's guard survives and the reason the defect class is undetectable by any predicate"
  - "Verified the parenthesisation claim empirically rather than asserting it in prose: unparenthesised, `| undefined` binds in the return position and the type is NOT `Hook | undefined`"
  - "The rule stated once on InvocationMeta and once on ToolBatch, pointing at ActionResult.reason, rather than eleven copies of a four-sentence explanation"
  - "New transport positives appended at the end of the file so 01-10's guards keep their recorded line numbers 112-121"

patterns-established:
  - "Defect-first mutation proof: apply, observe, and restore inside a single tool call, with a no-op assertion before trusting any result"
  - "Every prose claim written into a doc comment is measured before it is written, including claims about how TypeScript parses"

requirements-completed: [SC-1, SC-2, TRN-01]

# Metrics
duration: 25min
completed: 2026-07-28
---

# Phase 01 Plan 12: Apply the EOPT Widening Consistently Summary

**The `| undefined` that `ActionResult.reason` documents at length now sits on all eleven optional members of the invocation and consent path — including `DeliveryReport.readbackHash`, whose own doc comment prescribed `receipt?.hash` while the type rejected it — guarded by five construction positives, because the defect is invisible to every predicate in the suite: `Equals<{x?: T}, {x?: T | undefined}>` is `true` under `exactOptionalPropertyTypes`, measured.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **WR-02 closed on eleven members, not the review's eight.** `InvocationMeta` (`responseId`, `userTurnId`, `callId`, `outputIndex`, `signal`, `deferUntilDelivered`), `DeliveryReport.readbackHash`, `ActionHandler`'s `ctx.ack`, and `ToolBatch` (`userTurnId`, `signal`, `deferUntilDelivered`). The three beyond the review's list are the two `signal` members and `InvocationMeta.responseId` — `signal` is what the Phase 6/7 dispatcher forwards from `batch` into `meta`, so closing eight of eleven would have left the class open on the members the next phase actually writes.
- **The contradiction on `readbackHash` is gone.** Its doc comment instructs the author to take the value from the receipt; `receipt?.hash` is `string | undefined`; the bare field rejected that with TS2375. A type that refuses its own prescribed idiom does not stop the author, it teaches a cast — on the sole route to an `attested` grade.
- **Why the defect was invisible, measured rather than asserted.** Before touching `src/`, a `/tmp` probe established that `Equals<{readonly x?: string}, {readonly x?: string | undefined}>` is **`true`** under this repo's flags, while `const c: {x?: string} = { x: maybeStr }` is **TS2375**. The read type is identical and the write type is not. That single asymmetry explains both why eleven members drifted unnoticed and why a predicate cannot guard them.
- **01-10's `_deliveryReadbackHashIsReadonly` confirmed still green**, not assumed — see below.
- **Four mutations, all four observed red**, each producing exactly the predicted code, count, and construction site. No prediction was rounded.
- **Zero edits to any pre-existing assertion.** The test-d diff contains **no removed lines at all** — pure additions plus two import-list entries.

## Task Commits

1. **Task 1: Add the explicit `| undefined` to every optional member on the invocation and consent path (WR-02)** — `a245bc0` (fix)
2. **Task 2: Add the computed-idiom positives that would have caught it, defect-first** — `25f5009` (test)

## Files Created/Modified

- `packages/concierge/src/types.ts` — **+63 / −11.** Eleven members widened; both `deferUntilDelivered` declarations parenthesised; a doc block added above `InvocationMeta` and a paragraph appended to `ToolBatch`'s stating the rule once; a paragraph added to `DeliveryReport.readbackHash` naming `receipt?.hash`; a paragraph added to `ActionHandler`'s doc block on the one-context-shape argument.
- `packages/concierge/test-d/transport.test-d.ts` — 172 → **261 lines.** Adds `AbortSignalLike` to the import list, the four `maybe*` fixtures, and `_metaFromOptionalSources`, `_metaHookFromOptionalSource`, `_deliveryFromReceipt`, `_batchFromOptionalSources`. Appended as a new final section deliberately, so 01-10's guards keep the line numbers `01-10-SUMMARY.md` recorded (`112`–`121`).
- `packages/concierge/test-d/actions.test-d.ts` — 476 → **496 lines.** Adds `InvocationMeta` to the import list, the `maybeAck` / `plainBridge` / `meta` fixtures, and `_ctxWithMaybeAck`.

## Mutation Battery — four mutations, all observed red

Every row was applied, observed, and restored **inside a single Bash tool call**, with an explicit no-op assertion (`git diff --quiet … && FATAL`) before any result was trusted. `git diff --exit-code -- packages/concierge/src/types.ts` exited 0 after each; `TREE_CLEAN` printed on all four.

| Mutation | Exit | Observed codes | Construction site tsc reported it on |
|---|---|---|---|
| **MUT-EOPT-1** — strip `\| undefined` from `DeliveryReport.readbackHash` | 2 | **exactly 1 × TS2375** | `transport.test-d.ts:237` `_deliveryFromReceipt` |
| **MUT-EOPT-2** — strip it from `InvocationMeta.signal` **and** `ToolBatch.signal` together | 2 | **exactly 2 × TS2375** | `transport.test-d.ts:211` `_metaFromOptionalSources`; `transport.test-d.ts:250` `_batchFromOptionalSources` |
| **MUT-EOPT-3** — strip it from the handler context's `ack` | 2 | **exactly 1 × TS2375** | `actions.test-d.ts:270` `_ctxWithMaybeAck` |
| **MUT-EOPT-4** — strip it from `InvocationMeta.deferUntilDelivered`, restoring the unparenthesised form | 2 | **exactly 1 × TS2375** | `transport.test-d.ts:225` `_metaHookFromOptionalSource` |

Every code, count, and site matched the plan's prediction exactly. All four mutations **restore the WR-02 defect** and must go red; the five positives **compile on the fixed tree**, which is the asymmetry that constitutes the proof. Both directions were run: `pnpm --filter @fullselfbrowsing/concierge typecheck` exits **0** on the fixed tree with all five positives present, and exits **2** under each mutation.

MUT-EOPT-4 additionally asserted, inside the same tool call, that the `ToolBatch` twin stayed widened (`grep -c` returned 1, not 0) — so the single diagnostic is attributable to the `InvocationMeta` member alone and not to a substitution that caught both.

### Verbatim diagnostics, with the source line tsc's position points at

MUT-EOPT-1:

```
test-d/transport.test-d.ts(237,7): error TS2375: Type '{ responseId: string; outcome: "completed"; readbackHash: string | undefined; }' is not assignable to type 'DeliveryReport' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
  Types of property 'readbackHash' are incompatible.
    Type 'string | undefined' is not assignable to type 'string'.
      Type 'undefined' is not assignable to type 'string'.
```
`:237` → `const _deliveryFromReceipt: DeliveryReport = {`

MUT-EOPT-2, both diagnostics:

```
test-d/transport.test-d.ts(211,7): error TS2375: Type '{ responseId: string | undefined; userTurnId: string | undefined; callId: string | undefined; outputIndex: number | undefined; signal: AbortSignalLike | undefined; }' is not assignable to type 'InvocationMeta' with 'exactOptionalPropertyTypes: true'.
test-d/transport.test-d.ts(250,7): error TS2375: Type '{ responseId: string; calls: never[]; userTurnId: string | undefined; signal: AbortSignalLike | undefined; deferUntilDelivered: ((e: (r: DeliveryReport) => void) => void) | undefined; }' is not assignable to type 'ToolBatch' with 'exactOptionalPropertyTypes: true'.
```
`:211` → `const _metaFromOptionalSources: InvocationMeta = {`
`:250` → `const _batchFromOptionalSources: ToolBatch = {`

MUT-EOPT-3:

```
test-d/actions.test-d.ts(270,7): error TS2375: Type '{ args: { q: string; }; bridge: PlainBridge; meta: InvocationMeta; ack: ConsentAck<Booking, AckShape> | undefined; }' is not assignable to type '{ args: { q: string; }; bridge: PlainBridge | null; meta: InvocationMeta; ack?: ConsentAck<Booking, AckShape>; }' with 'exactOptionalPropertyTypes: true'.
```
`:270` → `const _ctxWithMaybeAck: Ctx = { args: { q: "x" }, bridge: plainBridge, meta, ack: maybeAck };`

MUT-EOPT-4:

```
test-d/transport.test-d.ts(225,7): error TS2375: Type '{ deferUntilDelivered: ((e: (r: DeliveryReport) => void) => void) | undefined; }' is not assignable to type 'InvocationMeta' with 'exactOptionalPropertyTypes: true'.
```
`:225` → `const _metaHookFromOptionalSource: InvocationMeta = { deferUntilDelivered: maybeHook };`

### Positive → mutation mapping (all five named, explicitly checked)

| Construction positive | File | Covered by |
|---|---|---|
| `_deliveryFromReceipt` | `transport.test-d.ts:237` | **MUT-EOPT-1** |
| `_metaFromOptionalSources` | `transport.test-d.ts:211` | **MUT-EOPT-2** |
| `_batchFromOptionalSources` | `transport.test-d.ts:250` | **MUT-EOPT-2** |
| `_metaHookFromOptionalSource` | `transport.test-d.ts:225` | **MUT-EOPT-4** |
| `_ctxWithMaybeAck` | `actions.test-d.ts:270` | **MUT-EOPT-3** |

Five positives, four mutations, every positive named in a row with an observed diagnostic — and every one shown compiling on the fixed tree (typecheck exit 0). `_metaHookFromOptionalSource` is separated from the other four `InvocationMeta` members deliberately, because the parenthesisation is its own failure mode; MUT-EOPT-4 exists so that a guard singled out as distinct is not left unobserved, which is the defect this whole sequence closes.

**Working tree after the battery** — `git status --porcelain` output, reproduced in full:

```
```

(empty — no mutation left applied, no untracked file created)

## The measurement that explains the finding

Run in `/tmp/gsd-0112-eq` (removed afterward; the worktree was asserted clean before and after and never written to), under this repo's exact flags:

| Assertion | Result |
|---|---|
| `Equals<Pick<{readonly x?: string \| undefined}, "x">, { readonly x?: string }>` | **`true`** |
| `Equals<{readonly x?: string}, {readonly x?: string \| undefined}>` | **`true`** |
| `const c: {readonly x?: string} = { x: maybeStr }` | **TS2375** |
| `const c: {readonly x?: string \| undefined} = { x: maybeStr }` | compiles |

The first two rows are why **01-10's `_deliveryReadbackHashIsReadonly` is still green** — confirmed, not assumed, as the plan required. That guard reads `Equals<Pick<DeliveryReport, "readbackHash">, { readonly readbackHash?: string }>` at `transport.test-d.ts:116`, is byte-identical (the test-d diff has zero removed lines), and the suite exits 0. A gap-closure fix silently disarming an earlier gap-closure guard was the risk; it did not happen, and the mechanism is now recorded rather than left to be re-derived.

Rows 3 and 4 are the same fact from the write side, and together the four rows are the whole reason eleven members drifted: **there is no predicate that can see this.** Hence positives.

## Verification not required by the plan

I wrote a claim about TypeScript parsing into two doc comments — that unparenthesised, `| undefined` binds inside the return position — and measured it before shipping it, on the principle this phase has been enforcing that prose which overstates or misstates the type is its own defect. In `/tmp/gsd-0112-paren2` (removed afterward):

- `Equals<(effect: (r: Report) => void) => void | undefined, (effect: (r: Report) => void) => void | undefined>` → **`true`**: the union does land in the return position.
- `Equals<Unparen, Hook | undefined>` → **`false`**: the unparenthesised form is therefore **not** the optional-widened hook, but a distinct type that still compiles.

Both doc comments are accurate as written. A first probe of this was confounded by indexed-access widening (`T["x"]` adds `| undefined` for an optional property regardless of EOPT) and was re-run with direct aliases rather than reported from the confounded form.

## Line-number drift report

Per the standing instruction to report drift rather than compensate for it. Base is `5181e93`.

| Pattern | Before (01-11) | Now | Drift |
|---|---|---|---|
| `export const MESSAGE_MAX_CHARS = 180;` | 206 | **206** | **0** |
| `  snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean;` | 408 | **445** | **+37** |

`MESSAGE_MAX_CHARS` sits above `InvocationMeta` and is unaffected, exactly as the plan predicted. The `+37` is fully accounted for: the file is `+52` net, of which `+15` (`ToolBatch`'s doc paragraph and its hook comment) falls *below* `snapshotEquality`, leaving `+37` above it — the `InvocationMeta` doc block, the `InvocationMeta` hook comment, the `readbackHash` paragraph, and the `ActionHandler` paragraph. The exact reconciliation confirms nothing else moved.

01-10's guards in `transport.test-d.ts` are **unmoved** at `112`–`121`, because the new section was appended at the end of the file rather than inserted near the hooks it concerns. Phase 2's harness matches by pattern and is unaffected either way; plan 01-15 collects the drift.

## Decisions Made

- **The `Equals` behaviour was measured before `src/` was touched, not after.** The plan permitted assuming it and asked only for confirmation. Measuring first turned a check into the explanation of the whole finding, and gave the doc comments something true and specific to say about why removing the widening is silent.
- **The rule is stated twice, not eleven times.** One doc block above `InvocationMeta` and one paragraph appended to `ToolBatch`'s existing block, both pointing at `ActionResult.reason` for the full reasoning, plus the two field-specific paragraphs the plan named. Eleven copies of a four-sentence explanation would be worse documentation, not more of it.
- **Both doc blocks say what stops the next person un-doing it**, in the concrete form the measurement supports: the write type narrows, the read type stays identical, no read-shaped assertion moves, and the construction positives are the entire alarm.
- **The new transport section was appended at the end of the file.** The subject matter would sit naturally beside the hook assertions at the top, but inserting there would have shifted 01-10's ten recorded guard line numbers for no benefit, in a phase where 01-15's job is to collect drift. Position costs nothing here; the section header and the alias names carry the attribution.
- **`_metaHookFromOptionalSource` kept as a one-line literal** while the other four are multi-line. It has exactly one member, and the parenthesisation failure it exists to catch is a property of that one member.

## Deviations from Plan

None. Both tasks executed as written, all eleven members widened, `ConsentAckBase.challenge` untouched.

Two pieces of work were done *within* the plan's latitude and are recorded above rather than as deviations: the `Equals` measurement was taken before the edit rather than after (the plan asked only that the guard be confirmed, which it also is), and the parenthesisation claim was verified empirically before being written into two doc comments.

## Issues Encountered

- **The first parenthesisation probe was confounded** by indexed-access widening: `Unparen["x"]` adds `| undefined` for an optional property irrespective of EOPT, so the first assertion evaluated `false` for a reason unrelated to the claim under test. Re-run with direct type aliases, which isolated the parse question. Reported rather than quietly discarded, because the confounded run's `false` looks like a refutation of the claim I then wrote down.
- **The worktree was spawned at `e4e353f`**, an ancestor of the required base `5181e93`, so plans 01-10 and 01-11 were absent. Corrected by the `git reset --hard` in the startup branch check, on a clean tree, before any edit.
- Bootstrap (`pnpm install --frozen-lockfile --prefer-offline`) left `pnpm-lock.yaml` byte-identical and the pre-edit baseline typecheck exited 0.

## Threat Model Coverage

| Threat ID | Disposition | Status |
|---|---|---|
| T-01-52 | mitigate | **Closed.** All eleven write types widened, so the natural object literal compiles on every input to the consent gate and a cast has no reason to be written. Guarded by five construction positives, each observed red under a stripping mutation. |
| T-01-60 | mitigate | **Closed.** `readbackHash` accepts `receipt?.hash`, the line its own doc comment prescribes; the doc now records why the widening is what permits it. Guarded by `_deliveryFromReceipt`, observed red under MUT-EOPT-1. |
| T-01-61 | mitigate | **Closed, and the mechanism is documented.** Measured: the read type is identical either way, so nothing at the declaration site or in any predicate goes red. The five positives are the sole detector, and both `InvocationMeta`'s and `ToolBatch`'s doc blocks say so by name. |
| T-01-62 | mitigate | **Held.** `grep -c 'challenge?: ServerChallenge;'` returns **1**; `git diff` contains **no hunk mentioning `challenge`**; `consent.test-d.ts` is byte-identical since the base, so `_challengeMustBeOmitted` (`:267`) is unchanged and green under the exit-0 suite. |
| T-01-51 | mitigate | **Held.** `git diff --exit-code 5181e93 HEAD -- packages/concierge/src/index.ts` exits 0. Export surface byte-identical. |
| T-01-58 | mitigate | **Held.** Four mutations, four single-call apply/observe/restore cycles, each with a no-op assertion before it and `TREE_CLEAN` after. Both tasks were committed *before* the battery began, so an empty `git status --porcelain` is an unambiguous signal. |
| T-01-SC | accept | **Held.** No package installed. `git diff --exit-code pnpm-lock.yaml` exits 0. |

## Known Stubs

None. This plan widens eleven declared types and adds five type-level construction sites. No runtime code, no placeholder values, no data source left unwired.

## Next Phase Readiness

- **Phase 6/7 can write the dispatcher's forward without a cast.** `batch.signal` → `meta.signal`, `batch.userTurnId` → `meta.userTurnId`, and `batch.deferUntilDelivered` → `meta.deferUntilDelivered` are optional on both sides and now accept the same possibly-absent value.
- **Phase 6 can build one handler-context shape** for gated and non-gated actions, which was the alternative to either two divergent shapes or a cast into the consent path.
- **A note for whoever widens further:** the members left bare are deliberate. `ConciergeConfig`'s injected seams, `ActionDefinition`'s declaration metadata, `SideEffects`, `JsonSchemaObject`, and `Readback.presented` are outside the invocation and consent path and were not measured; `ConsentAckBase.challenge` is the one member where the friction is the feature and must stay bare.
- **Plan 01-15** should collect the `snapshotEquality` drift (408 → **445**) and may note that `MESSAGE_MAX_CHARS` has now been stable at 206 across 01-10, 01-11, and 01-12.

## Self-Check: PASSED

Verified after writing:

- `pnpm --filter @fullselfbrowsing/concierge typecheck` exits **0**
- `git status --porcelain` **empty** after the mutation battery (reproduced above)
- `git diff --exit-code pnpm-lock.yaml` exits 0 — lockfile byte-identical after `pnpm install --frozen-lockfile --prefer-offline`
- `git diff --exit-code 5181e93 HEAD -- packages/concierge/src/index.ts` exits 0
- `grep -c 'deferUntilDelivered?: ((effect: (report: DeliveryReport) => void) => void) | undefined;'` returns **2**
- `grep -c 'challenge?: ServerChallenge;'` returns **1**; no diff hunk mentions `challenge`
- `types.ts` contains `readbackHash?: string | undefined;`, `signal?: AbortSignalLike | undefined;` (×2), `ack?: ConsentAck<Snapshot, AckPayload> | undefined;`
- 01-10 intact: comment-filtered `readonly` count is **26**; `_deliveryReadbackHashIsReadonly` byte-identical at `:116` and green
- 01-11 intact: `grep -c 'Record<string, never>'` returns **0**
- Property-name set of `types.ts` **identical** before and after (**109** members both sides); the eleven removed lines are exactly the eleven widened members, each retaining its `?` — no member added, removed, renamed, or made required
- All four mutations observed red with the predicted codes, counts, and construction sites; all five positives named in a row and all five compiling on the fixed tree
- `transport.test-d.ts` is **261** lines (min 170) and `actions.test-d.ts` **496**; neither exports anything; the test-d diff has **zero removed lines**, so no pre-existing assertion was modified or deleted
- `git diff --name-only 5181e93 HEAD` lists exactly **three** files, all in `files_modified` — **no** change to `README.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, or `src/index.ts`
- Post-edit line numbers reported: `MESSAGE_MAX_CHARS` **206**, `snapshotEquality` **445**

---
*Phase: 01-type-surface-completion*
*Completed: 2026-07-28*
