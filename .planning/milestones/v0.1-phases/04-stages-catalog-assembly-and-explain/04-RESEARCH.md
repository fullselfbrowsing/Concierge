# Phase 4: Stages, catalog assembly, and explain() - Research

**Researched:** 2026-07-30
**Domain:** Referential-identity memoization, immutability of derived projections, build-time cross-reference validation
**Confidence:** HIGH — every load-bearing claim below was produced by executing code against the built `dist/`, the installed `rolldown@1.2.0`/`typescript@7.0.2`, or the React/Svelte sources. Two recorded project claims were measured and found **wrong**; both are corrected in place.

## Summary

This phase is not a research problem in the "which library" sense — core is dependency-free and nothing new gets installed. It is a **measurement** problem, and three of the measurements invert what the phase was expected to do.

First, **STG-04 is a one-line requirement with a 6.9× performance story and a 100% correctness story, and only the correctness story matters.** React's `useSyncExternalStore` compares snapshots with `Object.is` — verified in `ReactFiberHooks.js` — and Svelte 5's `$derived` compares with `value === this.v`. A fresh-but-deep-equal array is a *changed* store to both. The memoization requirement therefore has nothing to do with speed; two fresh projections measured `JSON.stringify`-equal and `Object.is`-false in the same probe.

Second, **the re-freeze is not a re-freeze.** `Object.freeze(arr).filter(...)` returns an unfrozen array — already recorded — but the correct repair is *not* to run `deepFreeze` over the projection. If each `EmittedTool` is built once at assembly time and shared by reference across stage arrays, its every own property is a primitive or an object `buildCatalog` already deep-froze, so a **shallow `Object.freeze` on the projection is complete** and 510× cheaper (0.0074 ms vs 3.78 ms for 40 projections). All five tamper vectors were measured to throw under the shallow form. Building fresh `EmittedTool` objects per projection would make the shallow form a breach — the two decisions are coupled and must be taken together.

Third, and most consequential: **CAT-03 cannot live inside `buildCatalog`'s existing loop, and the way it fails there is a false positive on the canonical flow.** Measured — with the check inline, a `requires` pointing at *any* action declared later is reported missing. Because cross-stage actions are appended last, `{consent: {requires: "signOut"}}` would fail every build. The check has to be a post-pass over the complete name set, and the set it must read is `seenNames`, not `entries`.

**Primary recommendation:** one `resolve(ctx)` loop shared by `stageFor`, `catalogFor` and `explain`; one `EmittedTool` per action built at assembly time and shared across stage arrays; per-stage projections shallow-frozen and memoized in a lazily-allocated instance-local `Map` keyed `string | null`; CAT-03 as a post-pass over `seenNames` placed between the existing loop and the existing `if (issues.length > 0)` throw.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Catalog assembly and stage scoping**

- **One flat `buildCatalog` over `[...allStageActions, ...crossStage]`, then project per stage.** Not a `buildCatalog` per stage. CAT-03 needs the complete name set including cross-stage actions (`03-08-SUMMARY.md:343`), and a single build means a single aggregated `CatalogValidationError` rather than one throw per stage. The per-stage view is a projection of that one catalog.
- **A duplicate action name across two stages is rejected globally.** `buildCatalog`'s existing `duplicate_action_name` issue stands unchanged and unscoped. The action name is the agent's vocabulary; two different behaviours under one name is precisely the ambiguity the design exists to prevent, and the agent has no way to tell which one it is calling. Rejected: allowing it when the two definitions are structurally identical (a deep-equality check that would be a new correctness surface), and per-stage name-spacing (which changes the wire name the agent sees).
- **`catalogFor` memoizes on the resolved stage id (`string | null`), not on `ctx` identity.** `PITFALLS.md:556` — key by resolved stage name, not `ctx` identity — combined with STG-04's referential-identity requirement gives: resolve stage, look up cache by id, build-and-freeze on miss, return the same reference forever after. The cache is **per-`Concierge`-instance and lazily allocated on first `catalogFor` call**, never at module scope: `sideEffects: false` deletes module-scope evaluation from a bundled consumer while leaving it present under plain `node dist/index.js`, so a module-scope cache would test green and vanish in every real app (Phase 2 measured this).
- **When no stage matches, `catalogFor` returns the cross-stage actions only** — memoized under the `null` key with the same identity guarantee. `ConciergeConfig.crossStage` is declared "available in every stage"; an unknown page is still a page, and silently stripping actions the developer explicitly marked global would contradict the declaration they wrote. The situation is not hidden: `stageFor` returns `null` and `explain()` reports `stage: null` with every stage's `matched: false`. Rejected: returning an empty frozen array — "fail closed" is the right instinct for *consent*, but here it would silently disable `signOut`-shaped actions on any unrouted page.

**`explain()` shape**

- **`explain(ctx: StageContext)` — takes the context, returns a structured object.** Mirrors `catalogFor(ctx)` and `stageFor(ctx)` exactly. `Concierge` holds no context of its own; `Session` owns context (Phase 7), and a zero-arg `explain()` would have to invent hidden state on the very interface whose statelessness lets it construct on a server.
- **Three fields: `{ stage, stages: [{ id, matched, bridge }], catalog }`.** One field per clause of DX-01 ("the active stage, which bridges are registered, and the current catalog"). The per-stage row folds "which stages did not match" and "which bridges are registered" into one array indexed by stage rather than three parallel arrays that a reader has to cross-reference. `catalog` is the action-name list — the full `EmittedTool` array is already one `catalogFor(ctx)` call away, and Phase 1's D-04 preference ("prefer fewer, better-justified fields") governs. Rejected: `PITFALLS.md:494`'s five-field shape (`matchedStage`, `unmatchedStages`, `registeredBridges`, `missingBridges`, `catalogSize`) — same information, three more fields, and `catalogSize` is `catalog.length`.
- **The returned object is deep-frozen and deliberately NOT identity-stable.** Freezing is consistent with SEC-03 and costs nothing on a diagnostic-rate call. Not memoizing is the point: the doc comment must say so explicitly, so nobody wires `explain()` into `useSyncExternalStore` and reproduces the exact infinite-render defect STG-04 exists to prevent.
- **`explain()` does not print.** Structured return only; no `warnHost` call. Phase 3's precedent is that the structured value is the assertable channel and console output is the convenience one — and a convenience with no test is a surface with no guarantee.

**CAT-03 — consent target existence**

- **The check lives inside `buildCatalog`, as a new `CatalogIssueCode`.** `buildCatalog` already owns the assembled name set, the issue-aggregation loop, and `CatalogValidationError`. Putting CAT-03 in `createConcierge` would mean two build-failure channels with two error classes for the same class of mistake. Since this phase feeds `buildCatalog` the whole assembled set (stages + cross-stage), the name set it needs is already in hand.
- **Issue code: `consent_target_missing`.** Follows the existing `{code, action, problem, fix}` record shape and the existing message format. The `problem` names both the referring action and the missing target (ROADMAP SC-4 requires both); the `fix` states what to do.
- **The target may live in any stage, not necessarily the referring action's.** review-on-results → confirm-on-checkout is a legitimate flow. This is a build-time *existence* check only; whether the pair can actually be satisfied at runtime is Phase 8's consent kernel.
- **`requires` naming the action's own name is also an issue** — separate code `consent_self_reference`. It is unsatisfiable by construction: arming the gate would require running the very action the gate blocks. The consequence is identical to a typo — a safety gate that is silently permanently closed, or silently never armed — which is exactly the failure CAT-03 is written to catch. This is the one place where adding a code rather than reusing one is justified, because the `fix` prose is completely different.

**API surface and matching semantics**

- **Ship `createConcierge`. Do not ship `defineStage`.** Stage matching needs no identity mechanism; a plain `StageDefinition` object literal already typechecks (`test-d/actions.test-d.ts:442`). `defineStage`'s reason to exist is unforgeable bridge identity (`PITFALLS.md:234`), which belongs with the bridge registry in Phase 5. `src/index.ts:22`'s module doc comment currently lists `defineStage` among the unimplemented APIs and must be updated to reflect what actually ships.
- **A `match()` that throws is caught, treated as a non-match, and warned once via `warnHost`.** `catalogFor` runs on every route change in the host app; an exception propagating out of a matcher takes down the consumer's render. Skipping the stage is the honest degradation, and `explain()` still shows `matched: false` for it. Rejected: letting it propagate (loud, but the loudness lands on the end user's blank screen).
- **`stageFor` re-runs the matchers on every call; it is not memoized.** Matchers are pure and cheap, and their input is the caller's arbitrary `ctx`. Only the *projected catalog* is memoized, keyed by the resolved stage id — which is the whole reason `PITFALLS.md:556` says to key by stage name rather than by `ctx`.
- **The inline-`defineAction` widening defect is documented, not fixed.** 03-08 hand-off #2: an action declared inline inside `StageDefinition.actions` or `ConciergeConfig.crossStage` loses its `name` literal, because the contextual type `AnyActionDefinition` binds `N` to `string` before `name` is consulted, and `as const` does not help. Fixing it means re-narrowing collections that D-07 deliberately erased to `any` for a *measured* contravariance reason (`StageDefinition<ResultsBridge>` is not assignable to `StageDefinition<Bridge>`). So: add a doc comment on `stages`/`crossStage` showing the required spelling (declare actions in a `const` first, then reference), keep `_inlineDefineActionLosesTheUnion` in `test-d/catalog.test-d.ts` pinned red, and revisit in Phase 8 against a real kernel per D-12.2. If that predicate ever goes red-to-green the gap has closed — delete it, do not relax it.

### Claude's Discretion

- Internal module layout and file names (`src/stages.ts` vs folding into `catalog.ts` vs a new `src/concierge.ts`) — Phase 3 granted this and nothing here changes it.
- The exact `problem`/`fix` prose for the two new issue codes, subject to the standing rule that a message which says what is wrong without saying what to do fails the requirement.
- Whether the stage-id memo cache is a `Map` or a null-prototype record, given it is instance-local and never frozen.
- Test file naming and the split between new files and additions to `catalog.test.ts`.

### Deferred Ideas (OUT OF SCOPE)

- **`ServerSafeConcierge`** — a type exposing `catalogFor` but not `dispatch`, so a server render cannot reach mutable state (`PITFALLS.md:356`, `SUMMARY.md:196`). Real idea, but it is an export surface decision that wants Phase 9's SSR evidence behind it. Revisit at Phase 9 (ADP-04).
- **The visual devtools overlay** — v0.2–v0.3 per `research/SUMMARY.md:165`. `explain()` is the v0.1 answer and `PITFALLS.md:506` is explicit that `explain()` is the one thing that must not be deferred.
- **Fixing the inline-`defineAction` contextual widening** — deferred to Phase 8 per D-12.2, to be reconsidered against a real consent kernel.
- **`SchemaEmission → {diagnosis, remedy}` split** — a Phase 3 finding, not a Phase 4 requirement.
- **`defineStage` / `createBridge`** — Phase 5.

## Phase Requirements

| ID | Description | Research support |
|---|---|---|
| **CAT-03** | Catalog build throws when a `consent.requires` target does not exist in the catalog | *Pattern 4* gives the exact placement, with the measured false-positive table showing why the obvious placement is wrong |
| **STG-01** | The catalog offered to the agent contains only the actions valid for the current stage, plus cross-stage actions | *Pattern 2* (projection) + measured prototype output: `results` → `[applyFilter, sortResults, signOut]`, `checkout` → `[confirmBooking, signOut]` |
| **STG-02** | Stage matching is evaluated in declaration order, first match wins, and the order does not depend on stage naming | *Pattern 3* + the measured integer-key reordering table, and the **sensitive** rename test shape (rename a *later* stage) |
| **STG-03** | Stage matching evaluates arbitrary app context, not only pathname | Measured: `StageContext`'s index signature admits dot- and bracket-access on non-`pathname` keys under every repo flag |
| **STG-04** | `catalogFor` returns a memoized frozen array, so repeated calls with equivalent context yield a referentially identical result | *Pattern 1*, with the verbatim React source and Svelte equality function |
| **SEC-03** | The action registry is frozen after catalog build, so a handler cannot be replaced at runtime by third-party page script | *Pattern 2*, with the measured tool-injection attack on the unfrozen projection |
| **DX-01** | `concierge.explain()` reports the active stage, which bridges are registered, and the current catalog | *Pattern 5*, with the measured two-pass divergence and the Phase-5-stable `bridge` field shape |

CAT-01 is **not** in this phase's list but its `REQUIREMENTS.md:157` status (`Partial — 4/5 derived artifacts ship; per-stage catalogs is Phase 4`) is closed by STG-01's projection. See *Pitfall 6* for the one part of CAT-01 that measurably does **not** survive this phase, and why that is correct.

## Project Constraints (from CLAUDE.md)

Every directive below is verified against the current tree and must hold after this phase.

| Directive | Consequence for Phase 4 |
|---|---|
| **Core is dependency-free** | This phase installs nothing. `check:deps` (`scripts/pkg05-zero-runtime-deps.mjs`) must stay exit 0. No new module specifier may be added to any `src/` file except relative `./*.js` imports. |
| **ESM-only, no top-level `await`** | `createConcierge` is a plain exported function; nothing in the new code may be top-level `await`. |
| **`lib: ["ES2022"]`, no DOM types, no `@types/node`** | `console` is invisible — the throwing-matcher and non-boolean-matcher warnings **must** go through `warnHost` from `src/host.ts`, never a bare `console.warn`. `setTimeout` is likewise invisible; this phase needs no timer. |
| **`sideEffects: false`** | The memo cache must be instance-local and lazily allocated. See *Pitfall 8* — the reason recorded in CONTEXT is **not** the true one, and the doc comment must state the true one. |
| **No environment guards; must construct on the server** | `createConcierge` must be callable during an SSR render. It reads no `window`, no `document`. It must allocate **no** mutable state at module scope (ARCHITECTURE §4.1 cross-request pollution). |
| **`isolatedDeclarations: true`** | `createConcierge` needs an explicit `: Concierge` return annotation, and `explain()`'s return type must be a **named exported interface in `types.ts`**, not an inline anonymous object on the `Concierge` member. |
| **Adapters ~150 LOC** | Not touched this phase, but the STG-04 identity guarantee is precisely what keeps a React adapter's `useSyncExternalStore` wrapper at three lines instead of a memo-cache reimplementation. |
| **Handler exceptions never reach the model or telemetry** | Not exercised — Phase 4 runs no handler. The *matcher* exception policy is the analogue and is caught, never re-thrown, never echoed into a message. |
| **Commit rule (global CLAUDE.md)** | No `Co-Authored-By` / AI attribution line in any commit message. |

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|---|---|---|---|
| Stage resolution (`stageFor`) | Core, pure function | — | Reads only the caller's `ctx` and the config array. No bridge, no transport, no DOM. Must run identically on a server. |
| Catalog projection (`catalogFor`) | Core, pure + instance-local memo | — | The memo is the only mutable state in the phase, and it is derived — never observable state. |
| Referential identity | Core | Framework adapter (consumer) | Core owns the guarantee; the adapter merely passes `catalogFor` to `useSyncExternalStore`/`$derived`. Pushing identity into the adapter is the ~150 LOC violation CLAUDE.md names as a core bug. |
| Immutability of the agent-facing tool list | Core | — | SEC-03 is a core guarantee. A transport that receives `setTools(tools)` must not be trusted to preserve it. |
| Cross-reference validation (CAT-03) | Core, build-time | — | Cannot be a declaration-time check (`ConsentPolicy.requires`'s own doc comment records why: inferring `Name` from two positions corrupts the union). |
| Bridge registration status | **Phase 5** | Core reads the declared `BridgeRegistry.read()` seam | Phase 4 must not implement a registry. It may *observe* one through the interface `types.ts:1114` already declares. |
| Publishing tools to a model | **Phase 7** (`Session`) | — | This phase deliberately touches no transport; `Transport.setTools` has no caller until Phase 7. |
| Dispatching a call | **Phase 6** | — | `Concierge.dispatch` must exist to satisfy the interface. See *Open Question 1* for the honest minimal form. |

## Standard Stack

Nothing is added. The full set this phase uses already exists in the tree and is verified installed.

### Core

| Library | Version | Purpose | Why standard |
|---|---|---|---|
| `typescript` | `7.0.2` | Typecheck gate (`tsc -p tsconfig.test-d.json`) | Pinned exactly in `package.json` devDependencies. `pnpm typecheck` measured exit 0 on the current tree [VERIFIED: `pnpm typecheck`]. |
| `vitest` | `4.1.10` | Runtime suite against `dist/` | 6 files / 55 tests, 328 ms, all green on the current tree [VERIFIED: `pnpm test`]. |
| `tsdown` / `rolldown` | `0.22.14` / `1.2.0` | Build | Unchanged; no config edit needed for this phase. |
| `zod` | `4.4.3` | Real-validator fixtures in `test/fixtures/schemas.ts` | Already a devDependency; every probe in this document that needed a real schema used it. |

### Supporting — deliberately NOT added

| Candidate | Verdict | Reason |
|---|---|---|
| `react` + `react-dom` + `jsdom` + `@testing-library/react` | **Do not install** | STG-04's requirement is `Object.is(a, b) === true`. That is what React itself computes (`ReactFiberHooks.js:1895`, `return !is(prevValue, nextValue)`). Installing four packages and a DOM to observe a `console.error` that `Object.is` already decides adds a jsdom-fidelity risk and ~40 s of CI for zero additional information. Write `expect(a).toBe(b)` and cite the React source in the test header. Adapter-level `useSyncExternalStore` coverage belongs in the React adapter's own package, where jsdom is already the plan (`CLAUDE.md` testing section). |
| `svelte` | **Do not install** | Same argument. `equals(value) { return value === this.v; }` is the whole mechanism [VERIFIED: sveltejs/svelte `reactivity/equality.js`]. |

### Alternatives considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| Shallow `Object.freeze` on the projection | `deepFreeze` on the projection | Identical guarantee **only if** elements are shared and already deep-frozen; 510× slower (measured); and it silently becomes the *only* correct option if a future change starts building fresh `EmittedTool` objects per projection. Pick shallow, and pin the coupling with a test. |
| `Map` memo keyed `string \| null` | Null-prototype record + sentinel | Measured: a record cannot key on `null`. Any sentinel string is a legal stage id, and a stage named the sentinel silently overwrites the no-stage entry. `String(null)` is worse — a stage id of `"null"` collides. `Map` has no such hazard. |
| One `EmittedTool` per action at assembly | One per projection | Loses element identity across stage arrays (measured `signOut` shared across `results` and `checkout`), forces `deepFreeze` per projection, and multiplies allocation by stage count. |

**Installation:** none.

```bash
# Nothing to install. Verify the existing tree instead:
pnpm build && pnpm typecheck && pnpm test
pnpm check:artifact && pnpm check:deps && pnpm check:pack && pnpm check:node-floor
```

## Package Legitimacy Audit

**This phase installs no external packages.** The Package Legitimacy Gate is therefore not applicable, and that is a verified fact rather than an omission:

- `packages/concierge/package.json` `dependencies` is `{"@standard-schema/spec": "^1.0.0"}` and does not change.
- `scripts/pkg05-zero-runtime-deps.mjs` (`pnpm check:deps`) asserts the built bundle's external module graph; adding any runtime dependency would fail it.
- Every tool used by the research probes above (`typescript@7.0.2`, `rolldown@1.2.0`, `vitest@4.1.10`, `zod@4.4.3`) is already in the committed `pnpm-lock.yaml` and was resolved from `node_modules`, not from the registry.

| Package | Registry | Disposition |
|---|---|---|
| *(none)* | — | Phase adds no dependency; `pnpm-lock.yaml` must be byte-identical at phase exit |

**Packages removed due to slopcheck `[SLOP]` verdict:** none — none were considered.
**Packages flagged `[SUS]`:** none.

If the planner later decides to install React for adapter-shaped coverage (see *Standard Stack → deliberately NOT added* for why it should not), that install becomes a package-legitimacy event and needs its own gate run.

## Architecture Patterns

### System Architecture Diagram

```
   ConciergeConfig                                   caller's StageContext
   { stages[], crossStage[] }                        { pathname?, ...anything }
        │                                                     │
        ▼                                                     │
  ┌───────────────────────────────────────────┐               │
  │ createConcierge  (once, per instance)     │               │
  │                                           │               │
  │  [...stages.flatMap(s=>s.actions),        │               │
  │   ...crossStage]                          │               │
  │            │                              │               │
  │            ▼                              │               │
  │   buildCatalog(flat)  ── throws ──────────┼──► CatalogValidationError
  │      · existing per-action loop           │      (aggregated, one throw)
  │      · NEW CAT-03 post-pass ◄── seenNames │
  │      · deepFreeze(catalog)                │
  │            │                              │               │
  │            ▼                              │               │
  │   toolByName: null-proto record           │               │
  │      one EmittedTool per action,          │               │
  │      parameters BY REFERENCE (frozen),    │               │
  │      Object.freeze(tool)  ← shallow OK    │               │
  │            │                              │               │
  │   namesByStage: id -> string[]            │               │
  │   crossNames:   string[]                  │               │
  │            │                              │               │
  │   memo: Map<string|null, frozen[]> = null │  ← lazily allocated, instance-local
  └────────────┼──────────────────────────────┘               │
               │                                              │
               │        ┌─────────────────────────────────────┘
               │        │
               ▼        ▼
        ┌──────────────────────────────────────────────┐
        │ runMatch(stage, ctx)  ── the ONE guarded call│
        │   try { return stage.match(ctx) === true }   │
        │   catch { warnOnce(stage.id); return false } │
        └───────┬──────────────────────┬───────────────┘
                │                      │
     short-circuit                full pass
                │                      │
                ▼                      ▼
        stageFor(ctx)            explain(ctx)
        → string | null          → rows[], stage = first row with matched
                │                      │
                ▼                      │
        projectFor(id)  ◄──────────────┘   (reads the SAME memo, never re-resolves)
          memo hit? → return identical reference
          miss?     → Object.freeze(names.map(n => toolByName[n]))
                │
                ▼
        catalogFor(ctx): ReadonlyArray<EmittedTool>
                │
                ▼
        Phase 7: Session → Transport.setTools(tools)
        Phase 6: dispatch reads catalog.byName   (NOT this array)
```

Two boundaries the diagram is drawn to make visible:

1. **The memo is downstream of resolution and upstream of nothing.** `projectFor` never sees a `ctx`. That is what makes `PITFALLS.md:556` ("memoise by resolved stage name, not by `ctx` identity") mechanical rather than a discipline.
2. **`runMatch` is the single call site of consumer code in this phase.** Everything about throwing matchers, non-boolean returns, and warn-once policy lives in one function, so the mutation target is one function.

### Component Responsibilities

| File | Responsibility | New / modified |
|---|---|---|
| `src/concierge.ts` *(recommended new)* | `createConcierge`, `runMatch`, `stageFor`, `projectFor`, `catalogFor`, `explain` | new |
| `src/catalog.ts` | The CAT-03 post-pass, two new `CatalogIssueCode` members, `export` on `deepFreeze` for `explain`'s use | modified |
| `src/types.ts` | `Concierge.explain`, `Explanation`, `StageExplanation` | modified |
| `src/index.ts` | `createConcierge` value export, two type exports, **module doc-comment correction** | modified |
| `src/contract.ts` | Doc-comment correction only — the sentence claiming the `createConcierge` call site "remains future work" becomes false this phase (`contract.ts:145`, ships in `dist/index.d.ts:1837`) | modified (comment) |

Folding everything into `catalog.ts` is permitted by CONTEXT's discretion grant. A separate `src/concierge.ts` is recommended for one measured reason: `catalog.ts` is already 865 lines and its header states "every rule lives here, so *did we check X?* is a one-file question." Stage resolution is not a catalog rule, and diluting that invariant costs more than one import.

### Pattern 1: Referential-identity memoization (STG-04)

**What:** `catalogFor(ctx)` must return the *same array object* for any two contexts that resolve to the same stage.

**Why it is a correctness requirement and not a performance one — measured.**

React's `useSyncExternalStore` compares snapshots with `Object.is`, verbatim from `facebook/react` `packages/react-reconciler/src/ReactFiberHooks.js`:

```js
function checkIfSnapshotChanged(inst) {
  const latestGetSnapshot = inst.getSnapshot;
  const prevValue = inst.value;
  try {
    const nextValue = latestGetSnapshot();
    return !is(prevValue, nextValue);          // ← Object.is. Reference identity.
  } catch (error) {
    return true;
  }
}
```

`checkIfSnapshotChanged` returning `true` calls `forceStoreRerender(fiber)`. It is invoked from the passive effect on every commit *and* from `handleStoreChange` on every store notification. A fresh-but-equal array therefore forces a render, which commits, which re-reads, which forces a render.

The DEV detector calls `getSnapshot()` **twice in the same render** and compares:

```js
nextSnapshot = getSnapshot();
if (__DEV__) {
  if (!didWarnUncachedGetSnapshot) {
    const cachedSnapshot = getSnapshot();
    if (!is(nextSnapshot, cachedSnapshot)) {
      console.error(
        'The result of getSnapshot should be cached to avoid an infinite loop',
      );
      didWarnUncachedGetSnapshot = true;
    }
  }
}
```

Three details a test or a doc comment must get right:

- **The exact string is `'The result of getSnapshot should be cached to avoid an infinite loop'`.** `react.dev` abbreviates it to *"The result of `getSnapshot` should be cached"*; the source string is longer. A doc comment quoting the docs' wording is quoting something React never prints.
- **`didWarnUncachedGetSnapshot` is a module-level latch — the warning fires ONCE per process.** A second offending store is silent. So the warning is not a reliable detector even in development.
- **The whole block is `__DEV__`-only.** In a production build there is no warning at all — just the loop. This is why the guarantee has to be structural in core rather than observed by the app.

Svelte 5 is the same comparison under a different name — `packages/svelte/src/internal/client/reactivity/equality.js`:

```js
export function equals(value) {
	return value === this.v;
}
```

`deriveds.js:86` installs `equals` as a `$derived`'s default comparator and `deriveds.js:396` gates propagation on `if (!derived.equals(value))`. `safe_equals` is opt-in and is *looser*, not tighter. An adapter writing `$derived(concierge.catalogFor(ctx))` over a fresh array marks the derived changed on every recompute; any dependent `$effect` that writes state the derived reads then hits Svelte's guard: **`effect_update_depth_exceeded` — "Maximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state"**.

**Measured, on two projections of the same stage:**

```
two fresh projections, deep-equal:   true
two fresh projections, Object.is  :  false   <-- what React and Svelte compare
```

**The cache shape that satisfies it.**

```ts
// Instance-local. Lazily allocated. Never at module scope.
let memo: Map<string | null, ReadonlyArray<EmittedTool>> | null = null;

function projectFor(id: string | null): ReadonlyArray<EmittedTool> {
  memo ??= new Map<string | null, ReadonlyArray<EmittedTool>>();
  const hit: ReadonlyArray<EmittedTool> | undefined = memo.get(id);
  if (hit !== undefined) {
    return hit;
  }
  const names: readonly string[] = id === null ? crossNames : (namesByStage[id] ?? crossNames);
  const built: ReadonlyArray<EmittedTool> = Object.freeze(
    names.map((n) => toolByName[n]).filter((t): t is EmittedTool => t !== undefined),
  );
  memo.set(id, built);
  return built;
}
```

**`Map`, not a null-prototype record — and this settles CONTEXT's discretion question with a measurement rather than taste.** The key type is `string | null`. A record cannot hold a `null` key, so it needs a sentinel, and every sentinel is a legal stage id:

```
Map handles a null key natively:            [ 'cross' ]
record + sentinel, stage id === sentinel:   [ 'FROM A STAGE ACTUALLY NAMED THE SENTINEL' ]
record + String(null) key, stage id 'null': [ "a stage whose id is literally 'null'" ]
```

The `byName` argument from `catalog.ts:240-268` ("a frozen `Map` is not frozen") does **not** apply here: this map is never frozen and is never part of the catalog. `03-08-SUMMARY.md` states this explicitly — "A `Map` remains correct for Phase 6's own **mutable** per-dispatch state… and is wrong for anything that must be frozen." The memo is the former.

**Measured, on the real prototype:**

```
same reference across two distinct ctx objects in the same stage: true
Object.is: true
null-stage memo shares one reference: true
```

Note the second line of that probe: the two contexts were `{pathname:"/results"}` and `{pathname:"/results", scrollY:900, ts:Date.now()}`. Distinct objects, distinct extra keys, one array. That is the assertion ROADMAP SC-3 asks for.

Performance is the small half and is recorded only so nobody mistakes it for the point: 10 000 memoized lookups took **0.40 ms**; 10 000 fresh projections took **2.77 ms** (6.9×). Both are fast. Neither number is a reason to memoize.

### Pattern 2: Build the `EmittedTool` once, share it, shallow-freeze the projection (SEC-03, STG-01)

**What:** exactly one `EmittedTool` object per action, created during `createConcierge`, deep-frozen once, and *shared by reference* into every stage array that contains it. Each stage array is then sealed with a plain `Object.freeze`.

**Why the naive repair is the wrong one.** `catalog.ts:554` already hands this phase the finding: `frozenArray.filter(...)` returns a new, unfrozen array. Re-measured here, and widened:

```
source frozen:              true
filter() result frozen:     false
map() result frozen:        false
slice() result frozen:      false
spread result frozen:       false
concat result frozen:       false
push onto filter() result:  SUCCEEDED, length now 3
```

Every array-producing method is affected, not just `filter`. The obvious repair — run `deepFreeze` over the projection — works, and is 510× more expensive than necessary:

| Approach, 40 projections over 200 tools | Time |
|---|---|
| `Object.freeze(projection)` over shared, already-deep-frozen elements | **0.0074 ms** |
| `deepFreeze(projection, new Set(), new WeakSet())` | **3.78 ms** |

`deepFreeze` deliberately has **no `Object.isFrozen` early-out** (`catalog.ts:539-546` records why: it would skip children of an already-frozen object). So it re-walks every already-frozen JSON Schema subtree on every projection. That is the entire 3.78 ms.

**Where the projection must happen, and the answer to "at build time or per projection".** At build time, one `EmittedTool` per action, because that is what makes the shallow freeze *complete*:

```ts
const tool: EmittedTool = {
  type: "function",                       // primitive
  name: entry.action.name,                // primitive
  description: entry.action.description,  // primitive
  parameters: entry.parameters,           // ALREADY deep-frozen by buildCatalog
};
Object.freeze(tool);                      // → every own property is now unreachable for mutation
```

Measured against the real `dist/`, with a real zod schema carrying a nested object:

```
entries frozen: true                      parameters frozen: true
parameters.properties frozen: true        parameters.properties.nested frozen: true
nested.properties.a frozen: true          action.schema frozen: false   ← 03-06 C22 holds

-- shallow Object.freeze on an EmittedTool whose parameters is already deep-frozen --
  tool.name = 'evil'                                            -> TypeError
  tool.description = 'evil'                                     -> TypeError
  tool.parameters = {}                                          -> TypeError
  tool.parameters.type = 'string'                               -> TypeError
  tool.parameters.properties.key.type = 'number'                -> TypeError
  tool.parameters.properties.nested.properties.a.type='number'  -> TypeError
  delete tool.parameters.properties.key                         -> TypeError
```

And on the frozen projection built from those shared elements:

```
projection frozen: true
  push          -> TypeError
  index write   -> TypeError
  length write  -> TypeError
  element field write  -> TypeError
  nested schema write  -> TypeError
```

**The coupling is load-bearing and must be pinned by a test.** Shallow-freezing a projection whose elements are *not* already frozen is precisely the breach `catalog.ts:513-521` describes: `Object.isFrozen(projection)` returns `true` while every element stays mutable. If a later change starts building fresh `EmittedTool` objects per projection, the shallow freeze silently becomes a lie. The test therefore asserts on the *elements*, not on the array.

**Element identity across stage arrays — measured:**

```
signOut tool identical object in both stage arrays: true
```

That is not merely a memory saving; it is what lets a future adapter diff two catalogs elementwise.

**What the unfrozen projection actually costs, measured end to end.** This is the attack, and it is worth stating as a consequence rather than as a freeze report:

```
projection via .filter() frozen: false
push onto UNFROZEN projection succeeded; length: 2
  -> an agent would be offered: [ 'a', 'injected' ]
```

Page script cannot reach a *handler* through this array — `dispatch` resolves through the frozen null-prototype `catalog.byName`, so the injected tool has no implementation. What it *can* do is put an arbitrary `description` string into the list a model reads. That is tool-description poisoning (`PITFALLS` "Mid-Session Tool Injection", arXiv 2606.06387) achieved at runtime, on a package whose CAT-07 guard makes descriptions statically unforgeable at compile time. **The compile-time guarantee is void if the runtime array is writable.** That sentence belongs in the test header.

**Also freeze `toolByName`.** Measured on a frozen null-prototype record:

```
tools['a'] = evil -> TypeError      delete tools['a'] -> TypeError      tools['b'] = new -> TypeError
tools['__proto__'] -> undefined     tools['constructor'] -> undefined
```

Same two properties `catalog.byName` has, for the same two reasons.

### Pattern 3: One guarded matcher call, shared by all three readers (STG-02, STG-03)

**What:** a single module-private `runMatch(stage, ctx): boolean` is the only place `stage.match` is invoked.

```ts
function runMatch(stage: StageDefinition<any>, ctx: StageContext): boolean {
  let result: unknown;
  try {
    result = stage.match(ctx);
  } catch {
    warnOnce(stage.id, "its `match()` threw; the stage is being treated as a non-match.");
    return false;
  }
  if (result === true) {
    return true;
  }
  if (result !== false) {
    warnOnce(stage.id, "its `match()` returned a non-boolean; only `true` matches.");
  }
  return false;
}
```

**`=== true`, not truthiness, and the non-boolean warning is what makes that safe.** The house rule is already `action.effects?.destructive === true` and `action.readsUntrusted === true` (`catalog.ts:788`, `:798`). Strict equality fails closed. But failing closed *silently* here reproduces `PITFALLS` P14's exact first-run experience — a JavaScript consumer writing `match: (ctx) => ctx.pathname.startsWith("/results") && ctx.user` returns a truthy object, never matches, and reads "the agent says it can't do anything." Measured:

```
truthy match: `"yes" === true` -> false   |  `Boolean("yes")` -> true
```

Strict semantics + a named warning is the only combination that is both fail-closed and diagnosable. A silent strict check and a permissive truthy check are each defensible and each worse.

**Warn once per stage id per instance**, not once per instance. `CatalogDiagnostic`'s doc comment already settles the shape of this decision — "One diagnostic per offending action, each naming its action. An aggregated summary line… loses exactly the name DX-03 requires." Two broken matchers must produce two warnings. Measured on the prototype: three `catalogFor` calls through one throwing matcher produced exactly one warning naming the stage.

**`warnHost`, never `console.warn`.** `console` is TS2304 under `lib: ["ES2022"]` (`host.ts` records the measurement). This is also the only sanctioned structural `globalThis` read.

**Declaration order and rename-independence.** The mechanism is that `ConciergeConfig.stages` is a `ReadonlyArray` and is iterated with `for…of`. The doc comment at `types.ts:1397-1401` already argues it; here is the measurement behind the argument:

```
object key order:  [ '2', '10', 'results', 'checkout', 'home' ]
for...in order  :  [ '2', '10', 'results', 'checkout', 'home' ]
Object.entries  :  [ '2', '10', 'results', 'checkout', 'home' ]
Map key order   :  [ 'results', 'checkout', '2', 'home', '10' ]
array order     :  [ 'results', 'checkout', '2', 'home', '10' ]
```

**Designing the test that actually proves rename-independence, rather than asserting it.** A naive test renames the *first* stage and asserts nothing changed — which passes under an object-keyed implementation too, because the first stage was already first. The sensitive shape renames a **later** stage to an integer-like id and asserts it does **not** jump ahead:

```
array impl   before: results   after renaming stage 2 to "2": results
object impl  before: results   after renaming stage 2 to "2": 2      <-- FLIPS
```

Two stages, both `match: () => true`, ids `["results", "checkout"]` → rename to `["results", "2"]` → `stageFor` must still be `"results"` and `catalogFor` must still return the results actions. Under any id-keyed implementation this goes red.

Be honest in the test header about what this test is: **rename-independence is a property of the data structure, not of a branch, so no single-literal mutant produces it.** The available mutant is the ordering one — reverse the iteration and *first-match-wins* goes red. Both tests are needed; neither substitutes for the other.

**STG-03 — arbitrary app context.** `StageContext` is `{ pathname?: string; [key: string]: unknown }`. Verified to compile under the full repo flag set (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `isolatedDeclarations`, `verbatimModuleSyntax`):

```ts
const m1 = (ctx: StageContext): boolean => ctx.pathname === "/results";
const m2 = (ctx: StageContext): boolean => ctx["modal"] === "checkout" && ctx["cartCount"] !== 0;
const m3 = (ctx: StageContext): boolean => ctx.modal === "x";     // dot access on the index signature — compiles
s.match({ pathname: "/x", tenantId: "acme", role: "admin" });     // extra keys — compiles
```

Measured on the prototype: a config whose only stage matches on `{modalOpen: true, cartCount: 3}` with **no `pathname` anywhere** resolves correctly. The STG-03 test must contain no `pathname` at all, or it is testing STG-01 again.

### Pattern 4: The CAT-03 post-pass — exact placement

**Where it goes:** between the end of the existing `for (const action of actions)` loop and the existing `if (issues.length > 0) throw` at `catalog.ts:841`.

```
  for (const action of actions) {            ← unchanged, lines 733-839
      … duplicate / schema / redaction / diagnostics …
      seenNames.add(action.name);            ← line 744, the complete-name-set builder
      declared.push(action);                 ← NEW: one line, immediately after
  }

  for (const action of declared) {           ← NEW: the CAT-03 post-pass
      … consent_self_reference / consent_target_missing …
  }

  if (issues.length > 0) {                   ← unchanged, line 841
    throw new CatalogValidationError(issues);
  }
```

**Why it cannot be inside the loop, measured rather than argued.** Both placements were implemented and run over seven scenarios:

| Scenario | In-loop | Post-pass |
|---|---|---|
| 1. forward reference — `review` declared *after* `confirm` | ❌ `consent_target_missing` (**false positive**) | ✅ clean |
| 2. backward reference | ✅ clean | ✅ clean |
| 3. genuine typo (`reveiw`) | ✅ reported | ✅ reported |
| 4. self reference (`requires: "confirm"` on `confirm`) | ❌ **missed entirely** | ✅ `consent_self_reference` |
| 5. duplicate name, both carry the same typo | ⚠️ reported once, ordered before the duplicate issue | ✅ reported once |
| 6. target is a duplicate that was skipped | ✅ clean | ✅ clean |
| 7. `requires` a **cross-stage** action | ❌ `consent_target_missing` (**false positive**) | ✅ clean |

Row 7 is the one that decides it. This phase appends cross-stage actions **last** (`[...allStageActions, ...crossStage]`), so under the in-loop placement *every* `requires` naming a cross-stage action fails the build. Row 1 is the same defect for the canonical review→confirm flow when the two live in different stages, which is exactly the arrangement CONTEXT declares legitimate.

Row 4 is the quieter one: in-loop, `seenNames.add(action.name)` has already run when the check fires, so `seenNames.has(requires)` is `true` for a self-reference and `consent_self_reference` is unreachable.

**The set to check against is `seenNames`, not `catalog.entries`.** `seenNames` holds every *distinct declared* name, including names belonging to actions that later failed `schema_not_emittable` and `continue`d. That is the right set: a `requires` pointing at an action that exists but has a broken schema should report the broken schema **once**, not additionally claim its target does not exist. Reporting both is a cascade, and cascades are what the aggregation rule exists to avoid on the *other* axis.

**The set to iterate is `declared`, not `actions` and not `entries`.**

- `actions` would double-report: two same-named actions both carrying the same typo produce two identical issues (measured — in-loop row 5 shows the shape).
- `entries` would *under*-report: an action that failed its schema rule never reaches `entries`, so its consent typo is invisible until the schema is fixed and the build is run again. That is a second fix-and-rebuild cycle, which is the exact failure `catalog.ts:700-707` is written to prevent.
- `declared` — pushed immediately after `seenNames.add` — is exactly "one entry per distinct declared name, whatever else went wrong with it".

A `Set<string>` guard over `actions` is an equally correct alternative with one fewer array; `declared` is recommended only because it reads plainly at the call site.

**Interaction with `duplicate_action_name` having already skipped an action.** The second occurrence never enters `declared`, so its `consent` is never examined. This is correct and should be stated in the doc comment: a duplicate is already a build failure, and analysing the copy that is about to be renamed produces advice about a declaration that will not exist.

**Issue ordering.** CAT-03 issues append *after* every per-action issue rather than interleaving in declaration order. Verified safe against the existing suite: `test/catalog.test.ts` C4 asserts `error.issues.map(i => i.code)` positionally, and none of its five declarations carries a `consent` policy, so the array is unchanged. Any new CAT-03 test must not assume interleaving. Restoring declaration order would require carrying an origin index on every issue — new structure for cosmetic gain; rejected.

**Mutual exclusivity.** A self-reference implies the target exists, so the two codes can never both fire for one action. Check self-reference first, `else if` on missing.

**The two new codes, added to `CatalogIssueCode`:**

```ts
export type CatalogIssueCode =
  | "duplicate_action_name"
  | "schema_not_emittable"
  | "schema_root_not_object"
  | "redaction_missing"
  | "consent_target_missing"     // NEW
  | "consent_self_reference";    // NEW
```

This is a union widening on an already-exported type. It adds **no** name to the export surface.

**Reading `consent.requires` safely.** A JavaScript consumer can write `consent: {}` or `consent: null`. The existing house style is a `PropertyBag` view with `Object.hasOwn` (`catalog.ts:386-389`, `:440-467`), never `in`, because `in` walks a prototype this function did not author. A non-string `requires` is skipped silently in this phase — see *Open Question 3*.

### Pattern 5: `explain()` — one pass, every matcher, honest rows

**What:** `explain(ctx)` evaluates **every** stage's matcher exactly once, builds the rows, and derives `stage` from the rows. It does not call `stageFor`.

**Why not two passes — measured.** With a matcher whose result varies between calls (a `Date.now()` window, a mutable `ctx`, a matcher with an internal counter), calling `stageFor` and then mapping the rows separately produces a self-contradictory diagnostic:

```
two-pass: {"stage":"flaky","stages":[{"id":"flaky","matched":false}]}   <-- stage set, every row matched:false
one-pass: {"stage":"flaky","stages":[{"id":"flaky","matched":true}]}
```

A diagnostic that contradicts itself is worse than no diagnostic, because the developer debugs the tool.

**Why every matcher runs, rather than short-circuiting at the winner.** DX-01 exists to answer "why didn't my action fire". The single most likely answer in a multi-stage app is *an earlier stage shadowed yours*. A short-circuiting `explain` reports `matched: false` for the shadowed stage — which is not a measurement, it is "we never asked", rendered as a negative. Running all matchers turns the commonest failure into a visible two-`true` row set. The cost is one extra matcher call per stage on a call that happens at human debugging rate.

```ts
function explain(ctx: StageContext): Explanation {
  const rows: StageExplanation[] = [];
  let active: string | null = null;
  for (const stage of stages) {
    const matched: boolean = runMatch(stage, ctx);      // every stage, exactly once
    if (matched && active === null) {
      active = stage.id;                                // first match wins, unchanged
    }
    rows.push({ id: stage.id, matched, bridge: bridgeStatus(stage) });
  }
  return deepFreeze(
    { stage: active, stages: rows, catalog: projectFor(active).map((t) => t.name) },
    EMPTY_SKIP,
    new WeakSet<object>(),
  );
}
```

Reading the memo through `projectFor(active)` rather than `catalogFor(ctx)` is what guarantees `explain().catalog` and `explain().stage` cannot disagree — `catalogFor` would re-resolve and could land on a different stage under a non-deterministic matcher.

**The `bridge` field — what Phase 4 can honestly report, and the shape Phase 5 will not have to change.**

Phase 5 owns `BridgeRegistry`. What already exists in `types.ts:1114` is the *interface*:

```ts
export interface BridgeRegistry<B extends Bridge = Bridge> {
  readonly id: string;
  read: () => B | null;              // `null` when no component has registered
  register: (bridge: B) => () => void;
}
```

`StageDefinition.bridge?: BridgeRegistry<B>` is a declared seam, not an implementation. Phase 4 may **read** it. Recommended field value:

```ts
readonly bridge: { readonly id: string; readonly registered: boolean } | null;
```

- `null` — the stage declares no bridge. Honest, and it is DX-02's supported configuration, not a defect.
- `{ id, registered: false }` — a registry is declared and `read()` returned `null`: nothing is mounted. This is the single most common cause of "my action didn't fire" once bridges exist.
- `{ id, registered: true }` — `read()` returned a bridge.

Why this shape survives Phase 5 unchanged: `id` and `read()` are both on the interface *today*, so Phase 5's `createBridge` producing a conforming object changes nothing here. The rejected alternatives each force a Phase 5 edit — `bridge: string | null` (loses `registered`, must widen later), and a `"unknown"` third state (invents a value that stops being reachable the moment Phase 5 lands, and would then be dead prose in a shipped `.d.ts`).

`read()` is consumer code. Guard it exactly like `match()`:

```ts
function bridgeStatus(stage: StageDefinition<any>): { id: string; registered: boolean } | null {
  const registry: BridgeRegistry<any> | undefined = stage.bridge;
  if (registry === undefined) {
    return null;
  }
  let live: unknown = null;
  try {
    live = registry.read();
  } catch {
    live = null;                       // a throwing read() is not a registration
  }
  return { id: registry.id, registered: live !== null && live !== undefined };
}
```

**DX-01's bridge clause is fully testable in Phase 4 with no Phase 5 code.** A test writes a hand-rolled registry — `{ id: "results", read: () => mounted, register: () => () => {} }` — which is exactly what the exported interface admits. Nothing about that test changes when `createBridge` ships.

**Deep-freeze, and where `deepFreeze` comes from.** `deepFreeze` is module-private in `catalog.ts`. Add `export` to it (a module-internal export; it must **not** be re-exported from `src/index.ts`, and `test/export-surface.test.ts` parses only the trailing `export { … }` block so a non-re-exported symbol cannot leak into the count). Writing a second freeze walk in `concierge.ts` is the *Don't Hand-Roll* failure in miniature: `deepFreeze` carries a cycle-safe `WeakSet`, an accessor skip that avoids invoking getters, and a documented refusal to early-out on `Object.isFrozen` — three properties a re-implementation would rediscover by bug report.

**The doc comment must say `explain()` is not memoized, in those words.** Its return value is a fresh object every call by design, which makes it the one member of `Concierge` that would loop `useSyncExternalStore` forever. The requirement that motivates the whole phase is one line away from being violated by the phase's own diagnostic.

### Anti-Patterns to Avoid

- **Returning `catalog.entries.filter(...)` from `catalogFor`.** Wrong on three counts: unfrozen (measured), fresh per call (STG-04), and it hands the agent-facing layer `CatalogEntry` — which carries `action.handler` and `action.schema`. `EmittedTool` deliberately carries neither; the projection is a privilege reduction, not a rename.
- **Memoizing on `ctx`.** A `WeakMap<StageContext, …>` looks like a memo and is a leak with a 100% miss rate — a router hands you a new context object per navigation. `PITFALLS.md:556` names it.
- **A module-scope memo.** Not because of tree-shaking (see *Pitfall 8* — that reasoning does not reproduce) but because it is cross-request state under SSR. ARCHITECTURE §4.1 quotes Vue's own name for it and cites TanStack Router shipping the bug.
- **`deepFreeze` per projection.** Correct, 510× slower, and it hides the coupling that makes the shallow form safe.
- **Letting a matcher exception propagate.** It lands as a blank screen in the consumer's render tree, on a code path that runs on every navigation.
- **Calling `stage.match` from more than one place.** Each additional call site is a second copy of the throw policy, the non-boolean policy, and the warn-once latch — and a second place for `explain` and `stageFor` to disagree.
- **Asserting `Object.isFrozen(catalogFor(ctx))` and stopping there.** `catalog.ts:513-521` measured that exact assertion passing on a breached build. Assert that a *write* fails **and** that the value is unchanged.
- **Adding `explain()` to the memo "for symmetry".** It is the one thing that must stay unmemoized so that its own non-identity is a documented, tested property rather than an accident waiting to be "optimized".

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Recursively freezing the `explain()` result | A second freeze walk in `concierge.ts` | `export` the existing `deepFreeze` from `catalog.ts` | It carries a cycle-safe `WeakSet`, an accessor skip that does not invoke getters, and a documented refusal to early-out on `Object.isFrozen` (`catalog.ts:539-546`). A re-implementation rediscovers all three as bugs. |
| Aggregating CAT-03 failures | A second error class, or a `createConcierge`-level throw | The existing `issues[]` array + `CatalogValidationError` | Two build-failure channels for one class of mistake is exactly what CONTEXT rejects, and `issues.map(i => i.action)` is the assertable channel DX-03 depends on. |
| Warning about a broken matcher | `console.warn` | `warnHost` from `src/host.ts` | `console` is TS2304 under `lib: ["ES2022"]`. The seam is the single sanctioned structural `globalThis` read and its header states the three conventions any addition must keep. |
| Comparing catalogs for change | A deep-equality helper | Reference identity | React and Svelte both use reference identity. A deep-equality helper in core would be a second, weaker answer competing with the one the frameworks actually use. |
| The no-stage cache slot | A sentinel string key in a record | `Map` with a literal `null` key | Measured: every sentinel is a legal stage id, and a stage named it silently overwrites the cross-stage entry. |
| Detecting a duplicate action name across stages | A pre-pass in `createConcierge` | `buildCatalog`'s existing `duplicate_action_name` | The flat assembly already produces it. Measured: an action in both a stage and `crossStage` throws `duplicate_action_name:signOut` today, with no new code. |
| Emitting the tool JSON Schema | Anything | `entry.parameters`, by reference | `buildCatalog` already emitted, validated and froze it. Re-emitting would run a vendor converter a second time and produce a *different object*, destroying element identity and un-freezing the subtree. |

**Key insight:** every "missing" capability this phase appears to need already exists one file away, built and frozen by Phase 3. The phase is almost entirely *projection and wiring*; the temptation to build is strongest exactly where the existing thing is module-private (`deepFreeze`) and therefore looks absent.

## Common Pitfalls

### Pitfall 1: `Object.isFrozen(catalogFor(ctx))` is not the SEC-03 assertion

**What goes wrong:** a test asserts the returned array is frozen, passes, and the elements are mutable.
**Why:** `Object.freeze` is shallow. `catalog.ts:513-521` measured `Object.isFrozen(catalog)` returning `true` while `catalog[0].action.handler = attackerFn` succeeded silently.
**How to avoid:** assert the *write* throws **and** the value is unchanged, at the element and nested-schema level — the shape `test/catalog.test.ts` C18 already uses.
**Warning sign:** a SEC-03 test with no `expect(...).not.toBe(attacker)` line.

### Pitfall 2: the projection is unfrozen and that is a live tool-injection channel

**What goes wrong:** `catalogFor` returns `all.filter(...)`, and page script pushes a tool onto it.
**Measured:**

```
projection via .filter() frozen: false
push onto UNFROZEN projection succeeded; length: 2
  -> an agent would be offered: [ 'a', 'injected' ]
```

**Why it is worse than it looks:** the injected tool has no handler (`dispatch` resolves through the frozen `catalog.byName`), so it cannot *act*. What it can do is place attacker-chosen prose in the `description` field a model reads and reasons over. CAT-07 makes descriptions unforgeable at compile time; an unfrozen runtime array makes that guarantee void.
**How to avoid:** `Object.freeze` the projection, and pin the element-sharing invariant that makes the shallow form sufficient.

### Pitfall 3: a fresh array is a *changed* store, and the warning is DEV-only and fires once

**What goes wrong:** `catalogFor` returns a fresh array; the app renders fine in dev with one `console.error` scrolled past, and loops in production with no message.
**Why:** `didWarnUncachedGetSnapshot` is a module-level latch (`ReactFiberHooks.js:184`) and the whole detector is inside `if (__DEV__)`.
**How to avoid:** the guarantee is structural in core. The test asserts `Object.is`, which is what React computes.
**Warning sign:** a doc comment quoting *"The result of `getSnapshot` should be cached"* — that is react.dev's abbreviation; React prints `'The result of getSnapshot should be cached to avoid an infinite loop'`.

### Pitfall 4: the naive rename test passes under a broken implementation

**What goes wrong:** the STG-02 test renames the *first* stage and asserts resolution is unchanged.
**Why:** the first stage is first under both an array iteration and an object-key iteration, so the test cannot tell them apart.
**How to avoid:** rename a **later** stage to an integer-like id. Measured — array impl: `results` before and after; object impl: `results` → `2`.
**Warning sign:** a rename test whose "before" and "after" configs differ only in the first element.

### Pitfall 5: `explain()` evaluated in two passes can contradict itself

**What goes wrong:** `stage: "flaky"` alongside `stages: [{id: "flaky", matched: false}]`.
**Why:** `stageFor(ctx)` and `stages.map(s => s.match(ctx))` are two separate evaluations of consumer code that need not agree.
**Measured:** exactly that output, from a matcher with an internal counter.
**How to avoid:** one pass; derive `stage` from the rows.

### Pitfall 6: the CAT-01 literal name union does **not** survive `ConciergeConfig` — and that is correct

**What goes wrong:** a planner tries to preserve `Catalog<"applyFilter" | "signOut">` through `createConcierge` and burns a wave on it.
**Measured**, three assembly paths under the repo's exact flags:

| Path | Derived `names[number]` |
|---|---|
| `buildCatalog([alpha, beta])` — the documented path | `"alpha" \| "beta"` |
| `buildCatalog([...stage.actions])` where `stage` is `satisfies StageDefinition` | `"alpha"` |
| `buildCatalog([...config.stages.flatMap(s => s.actions), ...crossStage])` | **`string`** |

The erasure is not caused by `flatMap`. It is caused by `ConciergeConfig.stages: ReadonlyArray<StageDefinition<any>>` — D-07's deliberate `any`-erasure, taken for a *measured* contravariance reason (`types.ts:1403-1428`). Nothing downstream wants the union today: `Concierge.dispatch(name: string, …)`, `EmittedTool.name: string`, `Session.stage(): string | null`. So `createConcierge` returns `Catalog<string>` internally and no requirement is unmet.

A `const` type parameter **would** recover it — measured, `createConcierge<const C extends ConciergeConfig>(config: C)` keeps `ActionDefinition<"alpha", …>` inside the config literal. It is not recommended; see *Open Question 2*.

**How to avoid:** state in `createConcierge`'s doc comment that the union stops at the config boundary and why, so the next reader does not re-derive it.

### Pitfall 7: two stages sharing one id silently serve the wrong catalog

**What goes wrong:** the id-keyed memo and the id-keyed name lookup both collapse, and the agent on stage A is offered stage B's actions.
**Measured:**

```
buildCatalog is happy:                      [ 'a', 'b' ]
id-keyed projection silently collapses:     {"results":["b"]}
stageFor resolves to: results  ->  projection would be [ 'b' ]
```

Stage A (declared first, matching) resolves to id `"results"`; the projection under that id is stage **B's** actions. `buildCatalog` cannot see this — it receives a flat action array and has no concept of a stage.
**Why it is not covered by an existing rule:** `duplicate_action_name` fires on action names, not stage ids. Two stages with distinct actions and the same id build cleanly.
**How to avoid:** see *Open Question 4* — this needs a decision, and the locked id-keyed memo is what makes it necessary.

### Pitfall 8: the `sideEffects: false` justification in CONTEXT does not reproduce — the correct reason is SSR

**This is a correction to a claim recorded in `04-CONTEXT.md`, measured this session.**

CONTEXT states: *"`sideEffects: false` deletes module-scope evaluation from a bundled consumer while leaving it present under plain `node dist/index.js`, so a module-scope cache would test green and vanish in every real app (Phase 2 measured this)."*

The **decision** (instance-local, lazily allocated) is correct and locked. The **stated reason** is an over-generalization of 02-RESEARCH's finding, and writing it into a shipped doc comment would be a false claim of exactly the kind 03-08 spent a whole plan removing from `dist/index.d.ts`.

Measured under `rolldown@1.2.0` with `treeshake.moduleSideEffects: false` — two shapes, two outcomes:

| Consumer imports | Module-scope statement | Bundled | Unbundled |
|---|---|---|---|
| a **constant** (inlined at the use site) | `globalThis.__SIDE__ = …` | **dropped** — result `undefined` | `1` |
| a **function** that references the state | `const cache = new Map()` + `register()` | **retained** — result `1` | `1` |

Verbatim bundle output for the second case:

```js
//#region src/index2.js
function register() { globalThis.__REGISTERED__ = (globalThis.__REGISTERED__ ?? 0) + 1; }
register();
const eagerCache = /* @__PURE__ */ new Map();
eagerCache.set("seed", 1);
function readEager(k) { return eagerCache.get(k); }
//#endregion
```

02-RESEARCH's measurement is real and correctly scoped: the consumer imported `CONTRACT_VERSION`, a constant that gets inlined, so *nothing* from the module was retained and the module's evaluation was dropped entirely. A memo cache is the other shape — `catalogFor` is a function the consumer necessarily calls, so a module-scope cache it reads survives and works identically bundled and unbundled. It would **not** test green and vanish.

**The reason that is true, and the one the doc comment must state:** cross-request state pollution under SSR. `ARCHITECTURE.md:380-405` quotes Vue's own definition — *"the same module instances will be reused across multiple server requests… it can be accidentally leaked to a request from another user"* — and cites TanStack Router shipping exactly this bug (a singleton `getRouter()` leaking `router.state.redirect` so one request made every subsequent GET return a 307 until process restart). ARCHITECTURE's own rule list places the memo on the right side of the line: *"🔴 dedup Map, commit-window timers, consent Map, devtools event buffer — must be lazily created on first `dispatch` and never allocated during module evaluation or during `catalogFor()`."*

A module-scope catalog memo is *technically* immutable-per-config and would not leak user data — but it would be shared across every `createConcierge` in the process, so two configs in one server would serve each other's catalogs under colliding stage ids. That is a real defect and it is enough. The tree-shaking sentence is not.

### Pitfall 9: a getter inside a consumer-supplied `jsonSchema` survives the freeze

**Pre-existing, inherited from Phase 3, and it limits what Phase 4 may claim about SEC-03.**

`deepFreeze` skips accessors deliberately (`"value" in descriptor`) so that walking the catalog never invokes application code. For `emission.source === "explicit"` the `parameters` object *is* the consumer's own `jsonSchema` by reference. Measured against the real `dist/`:

```
parameters is the consumer object by reference: true
Object.isFrozen(parameters): true
accessor still varies after freeze: read #1 | read #2 | read #3
```

So a consumer who supplies an explicit `jsonSchema` carrying a getter can still vary what the agent is shown after the build. The `{...action}` spread flattens accessors on the action's **own** top-level properties (`catalog.ts:813-824` records that this is load-bearing, not an oversight) but does not reach nested ones.

**Phase 4 does not close this and should not claim to.** Re-freezing the projection changes nothing — it is the same object. The honest statement for the phase-close record: *SEC-03 is closed for handler and entry replacement, and for the tool array handed to the agent; a getter inside a consumer-supplied `jsonSchema` remains a channel and is recorded, not fixed.* Fixing it means flattening accessors during emission, which is a `json-schema.ts` change with its own contract decision.

### Pitfall 10: `pnpm test -- <name>` does not filter (seventh reproduction)

Vitest's cac CLI discards arguments after `--`. Use `pnpm test <name>`. Recorded in `03-RESEARCH.md:731` and in `04-CONTEXT.md`; reproduced again here because every phase so far has rediscovered it.

### Pitfall 11: the mutation harness reports a vacuous PASS on a mutant that breaks the build

`scripts/mutate-and-prove.sh` "Known limitation 2": the script cannot tell *why* the gate exited non-zero. A mutant that fails to compile exits 1 at the build step and prints `PASS: gate fired (exit 1), tree clean` having run **zero** tests. The caller must confirm from the gate's **output** that the mutant compiled and the tests ran.

"Known limitation 3": counts must be taken **unfiltered**. `perl -0pi` slurps the whole file and there is no `/g`, so a literal occurring once in code and earlier in a doc comment mutates the **comment**, the suite stays green, and the run is recorded as "FAIL: mutant escaped" — the inverse of the truth. Verified live for this phase: `duplicate_action_name` occurs **2×** in `src/catalog.ts` (once in the `CatalogIssueCode` union, once in the issue push), so it is a trap literal and must not be used bare.

Also unchanged and worth restating: the gate exits **1**, not 2, on `tsc` diagnostics under TS 7.0.2.

### Pitfall 12: `EmittedTool`'s fields are mutable at the type level

`EmittedTool` is `{ type; name; description; parameters }` with no `readonly` modifiers, and `ReadonlyArray<EmittedTool>` protects the array, not the elements. `catalogFor(ctx)[0].name = "evil"` **typechecks**. Only the runtime `Object.freeze` stops it — which means the runtime freeze is doing work the type system is not, and a type-level test cannot substitute for the runtime one. See *Open Question 5*.

## Code Examples

Every block below was executed. The prototype ran against the real `packages/concierge/dist/index.js` with `zod@4.4.3` fixtures; its measured output is quoted beneath each.

### The assembly, verbatim from the working prototype

```js
function createConcierge(config) {
  const stages = config.stages ?? [];
  const crossStage = config.crossStage ?? [];

  // ONE flat buildCatalog over [...allStageActions, ...crossStage].
  const assembled = [...stages.flatMap((s) => s.actions), ...crossStage];
  const catalog = buildCatalog(assembled);

  // ONE EmittedTool per action, parameters BY REFERENCE (already deep-frozen).
  // Shallow freeze is COMPLETE here: every own property is a primitive or a
  // frozen object. See Pattern 2 for the measurement, and for why this is only
  // true while the elements are shared rather than rebuilt per projection.
  const toolByName = Object.create(null);
  for (const e of catalog.entries) {
    toolByName[e.action.name] = Object.freeze({
      type: "function",
      name: e.action.name,
      description: e.action.description,
      parameters: e.parameters,
    });
  }
  Object.freeze(toolByName);

  const crossNames = crossStage.map((a) => a.name);
  const namesByStage = Object.create(null);
  for (const s of stages) namesByStage[s.id] = [...s.actions.map((a) => a.name), ...crossNames];

  let warned = null;   // lazily allocated Set — instance-local, never module scope
  let memo   = null;   // lazily allocated Map — instance-local, never module scope

  function catalogFor(ctx) {
    const id = stageFor(ctx);
    memo ??= new Map();
    const hit = memo.get(id);
    if (hit !== undefined) return hit;
    const names = id === null ? crossNames : (namesByStage[id] ?? crossNames);
    const built = Object.freeze(names.map((n) => toolByName[n]).filter((t) => t !== undefined));
    memo.set(id, built);
    return built;
  }
  // …stageFor / explain as in Patterns 3 and 5
}
```

Measured output for `stages: [results{applyFilter,sortResults}, checkout{confirmBooking}]`, `crossStage: [signOut]`:

```
=== STG-01 ===
results  : [ 'applyFilter', 'sortResults', 'signOut' ]
checkout : [ 'confirmBooking', 'signOut' ]
unrouted : [ 'signOut' ]
stageFor(unrouted): null

=== STG-04 — referential identity ===
same reference across two distinct ctx objects in the same stage: true
Object.is: true
null-stage memo shares one reference: true
frozen: true
push -> TypeError    element write -> TypeError    nested write -> TypeError

=== element identity shared across stage arrays ===
signOut tool identical object in both stage arrays: true

=== STG-02 — first match wins (two matchers both true) ===
stageFor: first    catalog: [ 'fromFirst' ]

=== STG-03 — non-pathname context ===
no pathname at all, matches on app state: modal

=== throwing matcher ===
stage after throw skipped: ok
catalog: [ 'offered', 'global' ]
warnings emitted: 1 ["concierge: stage \"boom\" match() threw; treating it as no match."]
explain shows matched:false for the thrower:
  [{"id":"boom","matched":false,"bridge":"…"},{"id":"ok","matched":true,"bridge":"…"}]
```

Note the throwing-matcher line: **three** `catalogFor` calls produced **one** warning.

### The CAT-03 post-pass

```ts
// Placed between the existing per-action loop and the existing throw.
// `declared` holds one entry per DISTINCT declared name, pushed immediately
// after `seenNames.add(action.name)` — so it includes actions that later failed
// their own schema rule, and excludes the second copy of a duplicate name.
for (const action of declared) {
  const requires: unknown = consentRequiresOf(action);   // PropertyBag read, Object.hasOwn
  if (typeof requires !== "string") {
    continue;
  }
  if (requires === action.name) {
    issues.push({
      code: "consent_self_reference",
      action: action.name,
      problem: `its consent policy requires "${requires}", which is the action itself — arming the gate would mean running the very action the gate blocks, so it can never be satisfied.`,
      fix: "point `consent.requires` at the review action that should run first, or remove the `consent` policy if this action needs no gate.",
    });
  } else if (!seenNames.has(requires)) {
    issues.push({
      code: "consent_target_missing",
      action: action.name,
      problem: `its consent policy requires "${requires}", and no action by that name is declared in this catalog — so the gate can never arm and the action is permanently blocked.`,
      fix: `declare an action named "${requires}", or correct the spelling in \`consent.requires\`. The target may live in any stage, or in \`crossStage\`.`,
    });
  }
}
```

Both `problem` strings name **the referring action and the missing target** — ROADMAP SC-4's requirement — and both do so through the `action` field plus an interpolated target, so `issues.map(i => i.action)` stays the assertable channel. The rendered line, in the existing format:

```
concierge: 1 problem(s) in the action catalog.
  [consent_target_missing] action "confirmBooking": its consent policy requires "reveiw", and no action
  by that name is declared in this catalog — so the gate can never arm and the action is permanently
  blocked. Fix: declare an action named "reveiw", or correct the spelling in `consent.requires`. …
```

The measured placement table is in *Pattern 4*. Scenario 1 (forward reference) and scenario 7 (cross-stage target) are the two the in-loop form gets wrong.

### What a duplicate action name across two stages produces today — measured, unmodified

```
concierge: 1 problem(s) in the action catalog.
  [duplicate_action_name] action "applyFilter": two actions share this name, so an agent calling it
  cannot address either one unambiguously. Fix: rename one of them.

structured: [ { "code": "duplicate_action_name", "action": "applyFilter",
                "problem": "two actions share this name, …", "fix": "rename one of them." } ]
```

**The existing issue shape cannot carry the stage names, and this is the honest accounting.** `CatalogIssue` is `{code, action, vendor?, problem, fix}`. `buildCatalog` receives a flat `readonly AnyActionDefinition[]` and has no concept of a stage, so it cannot name one. Three ways to change that, in increasing cost:

1. **Do nothing.** The developer greps for `name: "applyFilter"` and gets exactly two hits, which *is* the answer. Cost: one grep. This is the recommendation.
2. **Enrich the fixed `fix` prose** to `"rename one of them. An action name is global across every stage and across crossStage — the same name may not be declared twice even in different stages."` Zero new surface, still exact-matchable in a test because the string is a constant, and it converts the one genuinely surprising part (that stage scoping does *not* namespace the name) from tribal knowledge into the error message. Cost: one string. **Recommended as a cheap addition.**
3. **Add `stage?: string` to `CatalogIssue` and an `origins?: readonly (string | undefined)[]` to `BuildCatalogOptions`**, parallel to the actions array. `vendor?` is the precedent for a field present only where meaningful, and origins would enrich *every* code, not just this one (`redaction_missing` in stage `"checkout"` is genuinely more useful in a 40-stage app). Cost: two new public fields, a new parallel-array invariant, and it is not asked for by any requirement in this phase. **Rejected for Phase 4**; recorded here so a later phase can adopt it without re-deriving the design.

Also measured, and worth a doc sentence: an action declared in **both** a stage and `crossStage` throws `duplicate_action_name` today. That is the correct outcome — `crossStage` already means "available in every stage", so re-declaring it in one is redundant — but it will surprise someone, and option 2's prose is where it gets explained.

### The identity assertion, without installing React

```ts
// test/concierge.test.ts — STG-04
//
// This is the assertion React itself computes. `ReactFiberHooks.js`:
//
//   function checkIfSnapshotChanged(inst) {
//     const nextValue = latestGetSnapshot();
//     return !is(prevValue, nextValue);        // Object.is
//   }
//
// …and Svelte 5's `equals(value) { return value === this.v; }`. A fresh,
// deep-equal array is a CHANGED store to both. React's dev warning is
// 'The result of getSnapshot should be cached to avoid an infinite loop',
// it is __DEV__-only, and its `didWarnUncachedGetSnapshot` latch fires once
// per process — so it is not a detector we can rely on. `toBe` is.
const a = concierge.catalogFor({ pathname: "/results" });
const b = concierge.catalogFor({ pathname: "/results", scrollY: 900, ts: Date.now() });

expect(a).toBe(b);                       // reference identity — the requirement
expect(Object.is(a, b)).toBe(true);      // spelled out, because `toBe` IS Object.is
```

The second context is deliberately a *different object with extra keys*. A test that passes the same `ctx` object twice would also pass under a `WeakMap<StageContext, …>` memo, which is the implementation `PITFALLS.md:556` exists to forbid.

## Export Surface Impact

**First, a correction.** `04-CONTEXT.md` records the current surface as "10 value exports, 42 type exports". Measured against `packages/concierge/dist/index.d.ts` and against the assertions in `test/export-surface.test.ts`:

```
blocks 1   names 59   values 10   types 49
```

`test/export-surface.test.ts:133-142` asserts exactly `59` names, `49` types, `10` values. The figure 42 is the first two `export type { … }` blocks of `src/index.ts` (39 from `types.js` + 3 from `json-schema.js`) with the third block's **7 catalog types omitted**. The planner must use **49**, or `pnpm test export-surface` fails immediately.

### What this phase adds

| Name | Kind | Where declared | Why it must be exported |
|---|---|---|---|
| `createConcierge` | **value** | `src/concierge.ts` | The phase's entire public entry point. |
| `Explanation` | type | `src/types.ts` | `isolatedDeclarations` requires `Concierge.explain`'s return type to be named. A consumer holding the result needs to be able to spell it. |
| `StageExplanation` | type | `src/types.ts` | The row type. A developer iterating `explain(ctx).stages` and writing a helper needs it; it is also the type carrying the `bridge` field Phase 5 will read. |

Nothing else. `CatalogIssueCode` gains two union members — a widening of an already-exported type, **not** a new export.

### Resulting pins — every one of these numbers must move in the same commit

| Location | From | To |
|---|---|---|
| `test/export-surface.test.ts` — total names | `59` | **62** |
| `test/export-surface.test.ts` — types | `49` | **51** |
| `test/export-surface.test.ts` — values | `10` | **11** |
| `test/export-surface.test.ts` — `VALUE_EXPORTS` array | 10 entries | **11** — add `"createConcierge"` |
| `test/export-surface.test.ts` — `it("carries all ten runtime value exports…")` | "ten" | **"eleven"** (the title states the length; the assertion is a `for…of` carrying no number, so the title is the only thing a reviewer can check it against — the file's own header says so) |
| `test/export-surface.test.ts` — `it("splits 49 types to 10 values")` | title text | **"splits 51 types to 11 values"** |
| `test-d/exports.test-d.ts` | 5 predicates | **6** — add `_createConciergeExportedAsValue` |

`test-d/exports.test-d.ts` needs the new predicate in the house shape, and the file's own header explains the diagnostic to expect:

```ts
/** createConcierge reaches the public entrypoint as a callable VALUE, not only as a type. */
type _createConciergeExportedAsValue = Expect<Assignable<typeof createConcierge, (...args: never[]) => unknown>>;
```

Add `createConcierge` to the **shared import line** at `test-d/exports.test-d.ts:71`. Per that file's header: if the value is ever moved into `index.ts`'s `export type { … }` block, the diagnostic is **TS1485 on the import line**, not TS2344 on the predicate line, and the import is shared — so the line number is identical whichever of the six regressed. Read the *name* in the message.

### Doc comments that become false and must be corrected in the same phase

These ship. `03-08` measured `dist/index.d.ts` growing by ~1.9 KB from a single `catalog.ts` doc comment, and confirmed the text is in the published declarations.

| Site | Current text | Why it becomes false |
|---|---|---|
| `src/index.ts:22-24` | "The rest of the runtime (`createConcierge`, `createSession`, `defineStage`, `createBridge`) is still being implemented against these types" | `createConcierge` ships this phase. `defineStage` is now **not going to ship at all** (locked) — listing it as pending is a promise the project has decided not to keep. |
| `src/index.ts:16-20` | "Stated plainly so this is not oversold: `buildCatalog` *builds* a catalog and nothing here dispatches from it yet. There is no session, no transport and no consent prompt" | Still true about dispatch/session/transport, but the paragraph now under-sells: stage scoping and `explain()` ship. It needs an honest rewrite, not a deletion — the "not oversold" posture is the point. |
| `src/contract.ts:143-147` | "the `createConcierge` and adapter-registration call sites it also names remain future work and should be added when those arrive" | `createConcierge` arrives this phase. Verified shipping at `dist/index.d.ts:1837`. |

`createConcierge` does **not** need its own `assertSingleInstance()` call — it reaches the guard transitively through `buildCatalog` on its first line, and a second call is a documented no-op (`contract.ts` same-version adopt path). Either add the direct call *or* correct the sentence; doing neither leaves a false claim in the published declarations, which is the exact defect class 03-08 spent a plan removing.

## State of the Art

| Old approach | Current approach | When changed | Impact here |
|---|---|---|---|
| Subscribing to an external store via `useEffect` + `useState` | `useSyncExternalStore` with an immutable, cached snapshot | React 18 | Makes reference identity a hard API constraint on `catalogFor`, not a nicety. |
| Svelte 4 stores (`subscribe`/`set`, `safe_not_equal`) | Svelte 5 runes (`$state`/`$derived`, `equals` = `===`) | Svelte 5 | Svelte 4's `safe_not_equal` treated *every* object as changed; Svelte 5's default `equals` is strict identity, so identity now buys the same thing in both frameworks. |
| Namespacing tool names per scope | One global, unambiguous name set | — | Locked by CONTEXT; matches how OpenAI/Anthropic tool calling addresses tools (a flat name), so per-stage namespacing would have to be undone at the transport. |
| Deep-freezing every derived view | Freeze once at the source, share frozen elements, shallow-seal each view | measured this phase | 510× cheaper for an identical guarantee, at the cost of one invariant that must be tested. |

**Deprecated/outdated in this repo's own records:**

- *"a module-scope memo cache would test green and vanish in every real app"* — did not reproduce under rolldown 1.2.0. See *Pitfall 8*. The decision stands; the reason must change.
- *"10 value exports, 42 type exports"* (`04-CONTEXT.md`) — the real figures are 10 and **49**. See *Export Surface Impact*.
- *"tsc exits 2 on diagnostics"* — corrected in `scripts/mutate-and-prove.sh:32` during 03-08; it exits **1**. Restated because six plans have now re-derived it.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `Explanation` / `StageExplanation` are the right names for the two new type exports | Export Surface Impact | Cosmetic. Names are free before publish; the *count* is what the tests pin. |
| A2 | Warning once **per stage id** (rather than once per instance) is the right granularity for a broken matcher | Pattern 3 | Low. Follows `CatalogDiagnostic`'s "one per offending action, each naming its action" precedent, but it is an inference from that precedent, not a stated rule. |
| A3 | A non-string `consent.requires` from a JavaScript consumer should be skipped silently rather than reported | Pattern 4 | Medium — see *Open Question 3*. A silently ignored malformed consent policy is a gate that does not exist, which is the failure CAT-03 exists to catch, one level up. |
| A4 | `explain()` should evaluate every matcher rather than short-circuiting | Pattern 5 | Low. The argument (shadowed stages are the commonest cause of "it didn't fire") is strong, but the cost is running consumer matchers that `stageFor` would not have run. If a matcher has a side effect, `explain` triggers more of them than `stageFor` does. |
| A5 | The Phase-4 `dispatch` stub should omit `reason` rather than pick a `ReasonCode` | Open Question 1 | Medium — it produces exactly the `{ok:false, reason: undefined}` shape STATE.md schedules Phase 6 to *reject*. |
| A6 | Recommending `src/concierge.ts` as a new file rather than folding into `catalog.ts` | Component Responsibilities | None. Explicitly Claude's discretion per CONTEXT. |

## Open Questions (RESOLVED)

> **All six were settled before planning closed.** OQ1, OQ4 and OQ5 were escalated to the user and
> answered in `04-CONTEXT.md`; OQ2, OQ3 and OQ6 were settled by the planner within the discretion
> CONTEXT grants. Each question is left below in full, because the tradeoff analysis is what the
> resolution rests on — but **read the resolution line first**; the question text describes a state
> the project is no longer in.
>
> | # | Resolution | Landed in |
> |---|---|---|
> | **OQ1** — `dispatch`'s return | **Escalated and answered by the user.** Ship `{ ok: false, message }` with **`reason` deliberately omitted**; do NOT add `not_implemented` to the closed union. Phase 6's DSP-09 normalizer must **REPLACE** this shape, not normalize it. | `04-CONTEXT.md` (locked); 04-03 T1 step 12 + T2 anchor 13; `04-VALIDATION.md` *Hand-off to Phase 6* |
> | **OQ2** — `const` type parameter on `createConcierge` | **Not taken.** CONTEXT locks the non-generic `createConcierge(config: ConciergeConfig): Concierge`. The measurement is recorded in a doc comment so Phase 8 inherits it rather than re-deriving it, and a type-level pin stops the generic form arriving silently. | 04-01 T2; 04-03 T1 anchor 18 + T2; 04-06 T1 `_createConciergeIsNotGeneric` |
> | **OQ3** — non-string or missing `consent.requires` | **Skipped deliberately for Phase 4**, recorded as a residual in `catalog.ts`'s doc comment in the `catalog.ts:348-359` style. Revisited with Phase 8's consent kernel, the first code that reads `requires` at runtime. | 04-02 (d); `04-VALIDATION.md` *Explicitly NOT closed by this phase* |
> | **OQ4** — two stages sharing one id | **Escalated and answered by the user: option (c) PLUS (b).** The memo and the name lookup are keyed by declaration **array index** (`number \| null`), which makes the measured collapse structurally impossible, **and** `warnHost` fires once per distinct duplicated id, because the id is still what `stageFor`, `Session.stage()` and `explain()` report. Both halves are required; either alone leaves a defect. | `04-CONTEXT.md` (locked, superseding the `string \| null` key); 04-03 T1 steps 5–7; 04-05 S26; M-04-7 respelled; M-04-15 |
> | **OQ5** — `readonly` on `EmittedTool` | **Escalated and answered by the user: tighten it**, in the same commit as the `Concierge.explain` addition, with a type-level `Equals` pin (never `Assignable` — `readonly` modifiers do not affect assignability). | `04-CONTEXT.md` (locked); 04-01 T1; 04-06 T1 `_emittedToolMembersAreReadonly` |
> | **OQ6** — export `deepFreeze` or hand-roll | **Export it**, module-internal, NOT re-exported from `src/index.ts`, so the export-surface count is unaffected. A hand-written six-line freeze would have to independently reproduce a cycle-safe `WeakSet`, an accessor skip that does not invoke getters, and the documented refusal to early-out on `Object.isFrozen`. | 04-02 (a); 04-03 T1 step 15 (`explain`'s `deepFreeze` call) |
>
> Two corrections that touch this section's own text, recorded here so a linear reader meets them
> before the question bodies: the memo is instance-local because of **SSR cross-request pollution**
> and never because of tree-shaking (measured false under rolldown 1.2.0), and OQ4's *"given the
> locked `string | null` memo key"* framing is superseded — the key is `number | null`.

### 1. What does `Concierge.dispatch` return in Phase 4?

- **What we know:** `Concierge.dispatch` is a required member, so `createConcierge` must supply one. CONTEXT: "this phase ships whatever minimal honest form Phase 6 will replace." `ReasonCode` is a **closed** union of twelve, and `types.ts:159-163` states that adding a member is a breaking change *by design*.
- **What's unclear:** none of the twelve codes describes "this runtime is not built yet". `unknown_action` is the closest (*"No action by that name is registered in the current stage"*) and is a lie for an action that is plainly in the catalog. `handler_error` is a lie. Adding `not_implemented` widens a closed union that Phase 6 would then have to remove.
- **Tradeoff:** omitting `reason` asserts nothing false, but `{ok: false, message, reason: undefined}` is precisely the contradictory shape `STATE.md` schedules Phase 6's DSP-09 normalizer to reject — so Phase 4 would ship an `ActionResult` its successor is written to refuse.
- **Recommendation:** `{ ok: false, message: "concierge: dispatch is not implemented yet — this build ships catalog assembly and stage scoping only." }` with `reason` omitted, plus a doc comment saying so, plus a note in the phase summary that DSP-09 must treat this as *replaced*, not *normalized*. Escalate to the user if the planner would rather add `not_implemented` — that is a `types.ts` contract decision, and contract decisions in this repo get their own discussion.

### 2. Should `createConcierge` take a `const` type parameter to recover the name union?

- **What we know:** measured — `createConcierge<const C extends ConciergeConfig>(config: C)` **does** preserve `ActionDefinition<"alpha", …>` inside a config literal, so `C["stages"][number]["actions"][number]["name"]` resolves to the real union. Adding a `const` type parameter to a currently non-generic function is backward-compatible for callers.
- **What's unclear:** the union has nowhere to go. `Concierge` is not generic; making it generic ripples into `Session`, `SessionConfig`, and every adapter. And the *inline*-`defineAction` widening defect (03-08 hand-off #2, pinned red in `test-d/catalog.test-d.ts`) means the union survives only for the documented `const`-first spelling — so the feature would work for some call sites and silently not for others.
- **Recommendation:** **do not** do it in Phase 4. CONTEXT locks `createConcierge(config: ConciergeConfig): Concierge`. Record the measurement in the doc comment so Phase 8 (which already owns the D-12.2 revisit of the same erasure) inherits it rather than re-deriving it. Nothing publishes until v0.1 completes, so the option stays free.

### 3. Is a non-string `consent.requires` an issue?

- **What we know:** `ConsentPolicy.requires` is typed `string` and is **required**. A JavaScript consumer can write `consent: {}`, `consent: null`, or `requires: 42`.
- **What's unclear:** CAT-03's wording is *"a `consent.requires` target does not exist in the catalog"*. A missing `requires` has no target to check, so it is arguably out of scope — and arguably the worse failure, because a consent policy with no `requires` is a gate that silently does not exist, which is exactly the class CAT-03 is written to catch.
- **Tradeoff:** adding a third code (`consent_requires_missing`) is one more `CatalogIssueCode` and a genuinely different `fix`. Skipping is one `continue` and a documented residual, in the same style as `catalog.ts:348-359`'s recorded `null`/`undefined` array-element residual.
- **Recommendation:** skip silently in Phase 4, **and write the residual into the doc comment in the same paragraph style Phase 3 used** so it is a recorded decision rather than an oversight. Revisit with Phase 8's consent kernel, which is the first code that actually reads `requires` at runtime and will care.

### 4. Two stages sharing one id — silent, and the locked memo key is what makes it dangerous

- **What we know:** measured (*Pitfall 7*) — the id-keyed name lookup collapses to the last stage's actions, `buildCatalog` cannot see it, and the agent on stage A is offered stage B's actions. `duplicate_action_name` does not fire, because the action names differ.
- **What's unclear:** which remedy, given the locked `string | null` memo key.
  - **(a)** Detect it in `createConcierge` and throw. Needs an issue whose `action` field holds a *stage id*, which corrupts the `issues.map(i => i.action)` semantics DX-03 depends on — or a second error class, which CONTEXT rejects.
  - **(b)** `warnHost` once, and let the collapse happen. Cheap, honest, and leaves a real correctness bug in place.
  - **(c)** Key the memo by **array index** (`number | null`) instead of by id, and keep reporting the id everywhere else. Zero new surface, the collapse becomes impossible, `PITFALLS.md:556`'s actual instruction ("not by `ctx` identity") is still satisfied — but it contradicts CONTEXT's literal wording, so it needs the user's sign-off rather than a planner's.
- **Recommendation:** escalate. This was not considered during discussion, it is a genuine STG-01 failure ("the catalog contains only the actions valid for the current stage"), and all three remedies are cheap. If forced to choose without escalation: **(b) plus a test pinning the current behaviour**, so the defect is recorded and visible rather than latent.

### 5. Should `EmittedTool`'s fields be `readonly`?

- **What we know:** measured — `catalogFor(ctx)[0].name = "evil"` typechecks today and is stopped only at runtime. `Transport.setTools(tools: ReadonlyArray<EmittedTool>)` hands a transport author the same mutable elements.
- **What's unclear:** whether tightening `EmittedTool` to `readonly` members breaks any construction site. Nothing builds an `EmittedTool` today (`04-CONTEXT.md` records this), so the cost is likely zero *right now* and non-zero after Phase 7 writes a transport.
- **Tradeoff:** it is a `types.ts` contract change. `03-CONTEXT` forbade touching `types.ts` in that phase; this phase already must touch it for `Concierge.explain`. The `readonly capabilities` precedent at `types.ts:1302-1310` is directly on point — it records that a `readonly` which does not go all the way down is *worse than none*, "because a reader stopped looking".
- **Recommendation:** tighten it, in the same commit as the `Concierge.explain` addition, and add the type-level predicate. It is free today and breaking after Phase 7. If the planner disagrees, the runtime freeze is what satisfies SEC-03 either way — but then the doc comment must say the type is deliberately looser than the runtime, or a reader will assume the modifier is doing work it is not.

### 6. Does `deepFreeze` need exporting, or should `explain()` freeze by hand?

- **What we know:** `deepFreeze` is module-private in `catalog.ts`. `explain()`'s return value is exactly three levels deep and entirely known at the call site, so a hand-written freeze is ~6 lines.
- **Recommendation:** export it (module-internal; not re-exported from `index.ts`, so the export-surface count is unaffected). Six lines that must independently reproduce a cycle-safe `WeakSet`, an accessor skip that avoids invoking getters, and a refusal to early-out on `Object.isFrozen` is not a saving. **Low confidence that this is contentious** — it is listed only because it is a source-layout change to a Phase 3 file and therefore wants to be a decision rather than a drive-by.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | everything | ✓ | v24.14.1 (floor is `>=22.12.0`) | — |
| pnpm | workspace | ✓ | 11.17.0 (matches `packageManager`) | — |
| TypeScript | `pnpm typecheck` | ✓ | 7.0.2 (exact pin) | — |
| Vitest | `pnpm test` | ✓ | 4.1.10 | — |
| rolldown / tsdown | `pnpm build` | ✓ | 1.2.0 / 0.22.14 | — |
| zod | real-validator fixtures | ✓ | 4.4.3 | — |
| arktype / valibot | existing emission fixtures | ✓ | 2.2.3 / 1.4.2 | — |
| `git` | `scripts/mutate-and-prove.sh` | ✓ | tracked, clean tree required | none — the harness aborts (exit 2) on an untracked or dirty target |
| React / Svelte | *not required* | ✗ | — | `Object.is` and `===` are what the frameworks compute; see *Standard Stack* |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

**Baseline verified green on the current tree**, so any red is this phase's:

```
pnpm test       →  6 files, 55 tests, all passed (328 ms)
pnpm typecheck  →  exit 0
```

## Validation Architecture

> ⚠️ **SUPERSEDED COMMAND FORM — `pnpm test concierge` appears 34× below and is WRONG.**
> Every `pnpm test concierge` in this section is superseded by **`pnpm test test/concierge`**.
> Vitest matches the positional argument against the **full path**, not the filename, and every test
> file in this repo lives under `packages/concierge/` — so `concierge` matches all of them and runs
> the whole suite. Measured on the pre-phase tree: `pnpm test concierge` → 6 files / 55 tests;
> `pnpm test catalog` → 1 file / 22 tests; `pnpm test test/concierge` → *"No test files found", exit
> 1*, which is the correct red-before-green state for a file 04-05 creates. The tables below are left
> as the research record; **`04-VALIDATION.md:44-52` (command trap 4) is the authority**, and the
> plans carry the corrected form. This supersedes only the scoped-run fragment — the "no `--`" rule
> and the build-before-test rule below are unchanged and still true.

### Test Framework

| Property | Value |
|---|---|
| Runtime framework | Vitest 4.1.10 |
| Runtime config file | `vitest.config.ts` (root, single shared project) |
| Type-level framework | `tsc -p packages/concierge/tsconfig.test-d.json` — **not** Vitest typecheck mode, which `vitest.config.ts` documents as deliberately off |
| Quick run command | `pnpm test <filename-fragment>` — **bare, no `--`** (Pitfall 10) |
| Full suite command | `pnpm build && pnpm typecheck && pnpm test` |
| Type-level command | `pnpm typecheck` |
| Mutation harness | `scripts/mutate-and-prove.sh <file> <literal> <replacement> -- <gate>`; gate exits **1**, not 2 |

> `pnpm build` precedes `pnpm test` because every runtime test imports `../dist/index.js` and `artifact.test.ts` / `export-surface.test.ts` read `../dist/index.d.ts` from disk. Runtime tests import `dist/`, **never** `../src/` — the acceptance check for that rule is scoped to non-comment lines.

### Phase Requirements → Test Map

> ⚠️ **SUPERSEDED COMMAND FORM — `pnpm test concierge` appears 34× below and is WRONG.**
> Every `pnpm test concierge` in this section is superseded by **`pnpm test test/concierge`**.
> Vitest matches the positional argument against the **full path**, not the filename, and every test
> file in this repo lives under `packages/concierge/` — so `concierge` matches all of them and runs
> the whole suite. Measured on the pre-phase tree: `pnpm test concierge` → 6 files / 55 tests;
> `pnpm test catalog` → 1 file / 22 tests; `pnpm test test/concierge` → *"No test files found", exit
> 1*, which is the correct red-before-green state for a file 04-05 creates. The tables below are left
> as the research record; **`04-VALIDATION.md:44-52` (command trap 4) is the authority**, and the
> plans carry the corrected form. This supersedes only the scoped-run fragment — the "no `--`" rule
> and the build-before-test rule below are unchanged and still true.

| Req | Observable evidence that proves it | Layer | Automated command | File exists? |
|---|---|---|---|---|
| **STG-01** | `catalogFor({pathname:"/results"}).map(t=>t.name)` equals `["applyFilter","sortResults","signOut"]` — checkout actions **absent from the array**, not rejected | runtime, `dist/` | `pnpm test concierge` | ❌ Wave 0 — `test/concierge.test.ts` |
| **STG-01** | `catalogFor` on an unrouted path returns cross-stage only; `stageFor` returns `null` | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **STG-01** | every element of `catalogFor(ctx)` is an `EmittedTool` — has `type:"function"`, and carries **no** `handler` and **no** `schema` key | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **STG-02** | two stages both `match: () => true` → `stageFor` is the **first** | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **STG-02** | renaming a **later** stage to the integer-like id `"2"` leaves resolution unchanged (the *sensitive* shape — see Pitfall 4) | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **STG-03** | a config whose stage matches on `{modalOpen:true, cartCount:3}` with **no `pathname` anywhere** resolves correctly | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **STG-03** | `StageContext` admits dot- and bracket-access on non-`pathname` keys, and `match` accepts a context with extra keys | type | `pnpm typecheck` | ❌ Wave 0 — `test-d/concierge.test-d.ts` |
| **STG-04** | `catalogFor(ctxA)` `toBe` `catalogFor(ctxB)` where A and B are **distinct objects with different extra keys** resolving to one stage | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **STG-04** | two no-stage contexts share one reference under the `null` key | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **STG-04** | two separate `createConcierge` instances do **not** share an array (proves the cache is instance-local, not module-scope) | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **SEC-03** | `catalogFor(ctx).push(evilTool)` throws **and** `length` is unchanged | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **SEC-03** | `catalogFor(ctx)[0].name = "evil"` throws **and** the name is unchanged (element-level — the array-level freeze passes on a breached build) | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **SEC-03** | `catalogFor(ctx)[0].parameters.properties.key.type = "number"` throws — proves elements are *deep*-frozen, which is what makes the shallow projection freeze sufficient | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **SEC-03** | the same `EmittedTool` object appears in two stage arrays (`toBe`) — pins the element-sharing invariant the shallow freeze depends on | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **SEC-03** | `entries[0].action.schema` is still **not** frozen and still validates (03-06 C22 must stay green) | runtime | `pnpm test catalog` | ✅ exists — must not regress |
| **CAT-03** | a typo'd `requires` throws `CatalogValidationError`; `issues[0].code === "consent_target_missing"`; `issues[0].action` is the **referrer**; `issues[0].problem` contains the **target** | runtime | `pnpm test catalog` | ⚠️ `test/catalog.test.ts` exists; needs a new describe block |
| **CAT-03** | `requires` naming the action itself yields `consent_self_reference`, and **not** `consent_target_missing` | runtime | `pnpm test catalog` | ⚠️ needs a new case |
| **CAT-03** | a **forward** reference (target declared later) builds **clean** — the false positive the in-loop placement produces | runtime | `pnpm test catalog` | ⚠️ needs a new case |
| **CAT-03** | `requires` naming a **cross-stage** action builds clean (cross-stage actions are appended last) | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **CAT-03** | a catalog with a consent typo **and** three other faults throws once with four issues — aggregation is not broken by the post-pass | runtime | `pnpm test catalog` | ⚠️ needs a new case |
| **CAT-03** | `CatalogIssueCode` includes both new members | type | `pnpm typecheck` | ⚠️ `test-d/catalog.test-d.ts` exists; needs an assertion |
| **DX-01** | `explain(ctx)` returns `{stage, stages, catalog}` and nothing else (`Object.keys` length 3) | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **DX-01** | `explain(ctx).stage` equals `stageFor(ctx)` for a matched, an unmatched, and a throwing-matcher config | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **DX-01** | `explain(ctx).catalog` equals `catalogFor(ctx).map(t => t.name)` | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **DX-01** | with **two** overlapping matchers, `explain` reports `matched: true` on **both** rows while `stage` is the first — the shadowed-stage case, and the reason `explain` does not short-circuit | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **DX-01** | a stage with a hand-written `BridgeRegistry` whose `read()` returns `null` reports `bridge: {id, registered:false}`; returning a bridge reports `registered:true`; no `bridge` field reports `null` | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **DX-01** | the returned object is deep-frozen: `explain(ctx).stages.push(...)` throws, and `explain(ctx).stages[0].matched = true` throws | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **DX-01** | `explain(ctx) !== explain(ctx)` — the deliberate **non**-identity, asserted as a positive claim so it cannot be "optimized" into the memo later | runtime | `pnpm test concierge` | ❌ Wave 0 |
| **DX-01** | `explain` writes nothing to the console (a plain global assignment restored in a `finally` — **no Vitest mocking API**, the grep for that namespace must stay at zero) | runtime | `pnpm test concierge` | ❌ Wave 0 |
| matcher policy | a throwing `match()` is skipped, warns **once** naming the stage across three `catalogFor` calls, and `explain` shows `matched:false` for it | runtime | `pnpm test concierge` | ❌ Wave 0 |
| matcher policy | a matcher returning a truthy non-boolean does **not** match and warns naming the stage | runtime | `pnpm test concierge` | ❌ Wave 0 |
| PKG-04 | `createConcierge` reaches `assertSingleInstance` (transitively via `buildCatalog`) | runtime | `pnpm test single-instance` | ⚠️ file exists; add a case |
| — | export surface moves in step: 62 names / 51 types / 11 values, `createConcierge` in `VALUE_EXPORTS` | runtime | `pnpm build && pnpm test export-surface` | ✅ exists — **counts change** |
| — | `createConcierge` reaches the entrypoint as a **value** | type | `pnpm typecheck` | ⚠️ `test-d/exports.test-d.ts` exists; add the sixth predicate |
| — | `_inlineDefineActionLosesTheUnion` stays **red-as-pinned** (if it flips, delete it — do not relax it) | type | `pnpm typecheck` | ✅ exists |

### Sampling Rate

- **Per task commit:** `pnpm typecheck` (~0.1 s under TS 7) plus the one `pnpm test <fragment>` the task touches. Any task touching `src/` also needs `pnpm build` first, because the runtime suite reads `dist/`.
- **Per wave merge:** `pnpm build && pnpm typecheck && pnpm test`.
- **Phase gate:** the above plus `pnpm check:artifact`, `check:deps`, `check:pack`, `check:node-floor` — all currently exit 0 and must continue to — plus the full mutant battery below, plus `git status --porcelain` empty.

### Wave 0 Gaps

- [ ] `packages/concierge/test/concierge.test.ts` — STG-01/02/03/04, SEC-03 projection half, DX-01, matcher policy. Opens with a "What escapes without this file" header per house convention.
- [ ] `packages/concierge/test-d/concierge.test-d.ts` — `StageContext` access shapes, `Explanation`/`StageExplanation` shapes, `createConcierge` signature
- [ ] `packages/concierge/test/catalog.test.ts` — new describe block for CAT-03 (five cases)
- [ ] `packages/concierge/test-d/catalog.test-d.ts` — `CatalogIssueCode` union assertion
- [ ] `packages/concierge/test-d/exports.test-d.ts` — sixth predicate + shared import line
- [ ] `packages/concierge/test/export-surface.test.ts` — four numbers, two `it` titles, one array entry
- [ ] `packages/concierge/test/single-instance.test.ts` — `createConcierge` call-site case
- [ ] No new fixture file needed — `test/fixtures/schemas.ts` already provides every validator shape this phase uses. No new devDependency.

### Mutant Obligations

> ⚠️ **SUPERSEDED COMMAND FORM — `pnpm test concierge` appears 34× below and is WRONG.**
> Every `pnpm test concierge` in this section is superseded by **`pnpm test test/concierge`**.
> Vitest matches the positional argument against the **full path**, not the filename, and every test
> file in this repo lives under `packages/concierge/` — so `concierge` matches all of them and runs
> the whole suite. Measured on the pre-phase tree: `pnpm test concierge` → 6 files / 55 tests;
> `pnpm test catalog` → 1 file / 22 tests; `pnpm test test/concierge` → *"No test files found", exit
> 1*, which is the correct red-before-green state for a file 04-05 creates. The tables below are left
> as the research record; **`04-VALIDATION.md:44-52` (command trap 4) is the authority**, and the
> plans carry the corrected form. This supersedes only the scoped-run fragment — the "no `--`" rule
> and the build-before-test rule below are unchanged and still true.

**Mandatory pre-flight for every row.** The harness replaces exactly one occurrence, does not skip comments, and slurps the file — so a literal appearing earlier in a doc comment mutates the comment and reports the inverse of the truth. Before running each row:

```bash
grep -F -o -- '<literal>' <file> | wc -l     # must print exactly 1, comments INCLUDED
```

And after each PASS, confirm from the gate's **output** that the mutant compiled and the tests actually ran — a build failure prints `PASS: gate fired (exit 1), tree clean` having run zero tests (Known limitation 2).

**Literals already verified unique in `src/catalog.ts` at time of research** (unfiltered counts):

| Literal | Count |
|---|---|
| `seenNames.add(action.name);` | 1 |
| `seenNames.has(action.name)` | 1 |
| `if (issues.length > 0) {` | 1 |
| `code: "duplicate_action_name",` | 1 |
| `return deepFreeze(catalog, validators, new WeakSet<object>());` | 1 |
| `"duplicate_action_name"` | **2** ← trap, do not use bare |
| `duplicate_action_name` | **2** ← trap |
| `action.consent` | **2** ← trap |

| # | File | Literal → replacement | Gate | Expected red |
|---|---|---|---|---|
| **M-04-1** | `src/concierge.ts` | `Object.freeze(` *(the projection call — verify uniqueness; if `Object.freeze` recurs, use the whole `return` statement)* → `(` | `pnpm build && pnpm test concierge` | the `push` and element-write SEC-03 cases fail |
| **M-04-2** | `src/concierge.ts` | `memo ??= new Map` → `memo = new Map` | `pnpm build && pnpm test concierge` | STG-04 identity case fails — a fresh cache per call means a fresh array per call |
| **M-04-3** | `src/concierge.ts` | `memo.set(id, built);` → `;` *(or delete the line)* | `pnpm build && pnpm test concierge` | STG-04 identity case fails, from the other direction |
| **M-04-4** | `src/concierge.ts` | `for (const stage of stages)` *(in `stageFor`)* → `for (const stage of [...stages].reverse())` | `pnpm build && pnpm test concierge` | first-match-wins case fails. **Requires distinct loop spellings** in `stageFor` and `explain`, or the literal is not unique — a design constraint the implementation must honour, noted in the test file. |
| **M-04-5** | `src/concierge.ts` | `result === true` → `result !== false` | `pnpm build && pnpm test concierge` | the truthy-non-boolean case fails (a truthy string is `!== false`) |
| **M-04-6** | `src/concierge.ts` | the `catch` body's `return false` → `throw` *(or delete the `try`)* | `pnpm build && pnpm test concierge` | the throwing-matcher case fails |
| **M-04-7** | `src/concierge.ts` | `id === null ? crossNames` → `id === null ? []` | `pnpm build && pnpm test concierge` | the no-stage-returns-cross-stage case fails |
| **M-04-8** | `src/concierge.ts` | `...crossNames]` *(in `namesByStage`)* → `]` | `pnpm build && pnpm test concierge` | STG-01 — `signOut` missing from the results catalog |
| **M-04-9** | `src/catalog.ts` | `!seenNames.has(requires)` → `false` | `pnpm build && pnpm test catalog` | the CAT-03 typo case fails |
| **M-04-10** | `src/catalog.ts` | `requires === action.name` → `false` | `pnpm build && pnpm test catalog` | the `consent_self_reference` case fails |
| **M-04-11** | `src/catalog.ts` | `!seenNames.has(requires)` → `!new Set<string>().has(requires)` | `pnpm build && pnpm test catalog` | the **forward-reference** and **cross-stage-target** clean-build cases fail. This is the only mutant that proves the check reads the *complete* name set — M-04-9 does not. |
| **M-04-12** | `src/concierge.ts` | in `explain`, `matched && active === null` → `matched` | `pnpm build && pnpm test concierge` | the two-overlapping-matchers case fails — `stage` becomes the last match, not the first |
| **M-04-13** | `src/concierge.ts` | `deepFreeze(` in `explain` → `Object.freeze(` | `pnpm build && pnpm test concierge` | `explain(ctx).stages[0].matched = true` no longer throws |
| **M-04-14** | `src/types.ts` | `explain: (ctx: StageContext) => Explanation;` → `` (delete) `` | `pnpm typecheck` | `test-d/concierge.test-d.ts` goes red |

**Two behaviours with no single-literal mutant, stated rather than faked.** Write both into the test file as a comment, following the house convention that *"where the obvious mutant literal doesn't work, the working one is written into the test file as a comment"*:

1. **Rename-independence (STG-02).** It is a property of the data structure — an ordered `ReadonlyArray` rather than a keyed object — not of a branch. Producing it requires rewriting the resolution to key by id, which is a multi-line change no `<literal> <replacement>` swap expresses. The test is a *regression* detector against a future rewrite, and its sensitivity is demonstrated by the measured table in Pattern 3 rather than by a mutant. M-04-4 covers the adjacent, mutatable property (first-match-wins).
2. **The element-sharing invariant (SEC-03).** "The shallow projection freeze is sufficient *because* elements are shared and already deep-frozen" cannot be mutated into existence — building fresh elements per projection is a restructuring. M-04-1 proves the array freeze fires; the `toBe` sharing assertion and the nested-schema-write assertion together pin the invariant, and the test header must say that removing *either* leaves the shallow freeze silently insufficient.

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section applies.

### Applicable ASVS Categories

| ASVS category | Applies | Standard control here |
|---|---|---|
| V2 Authentication | no | No identity in this phase. |
| V3 Session Management | no | `Session` is Phase 7. |
| V4 Access Control | **yes** | **This phase is the access-control surface.** STG-01 is authorization by omission: an action absent from the catalog cannot be called, which is strictly stronger than rejecting it at dispatch. SEC-03's freeze is what makes that boundary non-negotiable at runtime. |
| V5 Input Validation | **yes** | `StageContext` is caller-supplied and reaches consumer matchers. Core validates nothing about it — deliberately, since STG-03 requires arbitrary app context — but it must never be interpolated into an error message or a tool description. |
| V6 Cryptography | no | `DigestLike` is Phase 8. |
| V7 Error Handling & Logging | **yes** | Two channels, both constrained. Build-time `CatalogValidationError` is developer-facing and verbose but carries only names, codes and fixed remedial prose (`catalog.ts:195-201`). The runtime matcher warning must carry **only the stage id and fixed prose** — never the caught error's `message`, which would echo whatever the app's matcher put in it. |
| V8 Data Protection | **yes** | Inherited: SEC-01's redaction default. Unchanged this phase. |
| V14 Configuration | **yes** | The frozen catalog, the frozen `toolByName` record, and the frozen projections are configuration immutability. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation | Status here |
|---|---|---|---|
| **Mid-session tool injection** — page script pushes a tool onto the array handed to the model (arXiv 2606.06387) | Tampering / Elevation | Seal every derived view, not just the source | **SEC-03, this phase.** Measured breached: `push` onto the unfrozen projection succeeded and the agent's list became `['a','injected']`. The injected tool has no handler, so the payload is the *description* — which is CAT-07's compile-time guarantee defeated at runtime. |
| **Handler substitution** — `catalog[0].action.handler = attackerFn` | Tampering | Recursive freeze at build | Closed in Phase 3 (`deepFreeze`); C18 must stay green. |
| **Capability leakage across stages** — the agent is offered a checkout action while the user is on results | Elevation of Privilege | Scope by projection, not by rejection at call time | **STG-01.** The requirement's own wording — *"absent from the catalog rather than rejected when called"* — is the control. A dispatch-time check is a second, weaker line and is Phase 6's. |
| **Wrong-stage catalog via colliding stage ids** | Elevation of Privilege | Reject or index-key | **OPEN — see Open Question 4.** Measured: stage A resolves to id `"results"` and is served stage B's actions. No current check sees it. |
| **Denial of service via a throwing matcher** | Denial of Service | Catch, degrade honestly, warn once | **Closed by Pattern 3.** An uncaught matcher exception runs inside the consumer's render on every navigation. |
| **Covert channel through an error message** | Information Disclosure | Fixed prose only | The matcher warning must not include the caught error's `message`. CLAUDE.md's rule ("thrown messages echo user input and would become a covert PII channel") is written for handlers; a matcher is the same shape. |
| **Post-build mutation of a consumer-supplied `jsonSchema` getter** | Tampering | Flatten accessors at emission | **OPEN, inherited, out of scope.** Measured: the accessor still varies after the freeze. See Pitfall 9 — Phase 4 must not claim to close it. |
| **Cross-request state pollution under SSR** | Information Disclosure | No mutable module-scope state | **Closed by design.** The memo is instance-local and lazily allocated. See Pitfall 8 for the reason that is actually true. |
| **Slopsquatted dependency** | Tampering | Registry + slopcheck before install | **N/A** — this phase installs nothing; `pnpm-lock.yaml` must be byte-identical at phase exit. |

## Sources

### Primary (HIGH confidence — measured in this session)

- **`packages/concierge/dist/index.js`** (built artifact) — `buildCatalog` run with real `zod@4.4.3` schemas: freeze depth to `parameters.properties.nested.properties.a`; `action.schema` unfrozen (03-06 C22 confirmed); `byName` null prototype; `buildCatalog([])`; duplicate-name message and structured issues; the stage-and-`crossStage` overlap throwing `duplicate_action_name`.
- **Freeze semantics probe** — `filter`/`map`/`slice`/spread/`concat` on a frozen array all return unfrozen results; `push` onto the projection succeeds; shallow `Object.freeze` over already-deep-frozen elements blocks all seven tamper vectors; 40-projection timing 0.0074 ms (shallow, shared) vs 3.78 ms (`deepFreeze`).
- **Full Phase-4 prototype against `dist/`** — STG-01/02/03/04 outputs quoted verbatim in *Code Examples*; element identity shared across stage arrays; throwing matcher warned once across three calls.
- **CAT-03 placement probe** — seven scenarios × two placements; the false-positive table in Pattern 4.
- **`typescript@7.0.2`** under the repo's exact flag set (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, `isolatedDeclarations`, `lib: ["ES2022"]`, `moduleResolution: "bundler"`) — the three-path name-union table; the `const C extends ConciergeConfig` recovery; `StageContext` dot/bracket access.
- **`rolldown@1.2.0`** with `treeshake.moduleSideEffects: false` — four bundles proving the constant-import vs function-import split in Pitfall 8; bundle output quoted verbatim.
- **`facebook/react` `packages/react-reconciler/src/ReactFiberHooks.js`** (main) — `checkIfSnapshotChanged` (`return !is(prevValue, nextValue)`), the `__DEV__` double-call detector, the exact string `'The result of getSnapshot should be cached to avoid an infinite loop'`, the `didWarnUncachedGetSnapshot` latch at line 184, and the `'Missing getServerSnapshot, which is required for server-rendered content. Will revert to client rendering.'` throw.
- **`sveltejs/svelte` `packages/svelte/src/internal/client/reactivity/equality.js`** — `equals(value) { return value === this.v; }`; `deriveds.js:86` installs it as the default and `:396` gates propagation on it.
- **`sveltejs/svelte` generated client-error docs** — `effect_update_depth_exceeded`, *"Maximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state"*.
- **Object key ordering probe** — integer-like keys hoisted in `Object.keys`, `for…in`, `Object.entries` and `JSON.stringify`; `Map` and array preserve insertion order; the sensitive rename-test shape demonstrated flipping under an object-keyed resolver.
- **Repo state** — `pnpm test` 6 files / 55 tests green in 328 ms; `pnpm typecheck` exit 0; `dist/index.d.ts` parsed to 59 names / 49 types / 10 values; unfiltered mutant-literal counts in `src/catalog.ts`.
- **Repo sources read in full** — `src/catalog.ts`, `src/host.ts`, `src/index.ts`, `src/contract.ts`, relevant regions of `src/types.ts`; `test/catalog.test.ts`, `test/export-surface.test.ts`, `test-d/exports.test-d.ts`; `scripts/mutate-and-prove.sh`; `tsdown.config.ts`; `package.json` (root and package); `tsconfig.base.json` and both package configs.

### Secondary (MEDIUM confidence — official docs, cross-checked against source)

- https://react.dev/reference/react/useSyncExternalStore — the immutability and caching requirements, and `getServerSnapshot`'s "will throw if omitted". Cross-checked against `ReactFiberHooks.js`; **the docs' abbreviated error string differs from the source string** and the source is what is quoted in this document.
- Project research documents: `.planning/research/ARCHITECTURE.md:380-432` (SSR cross-request pollution, the `useSyncExternalStore` read-side trap, Anti-Pattern 5), `.planning/research/PITFALLS.md:480-560` (P14 `explain()` moved to v0.1, the performance-trap table's "memoise by resolved stage name, not by `ctx` identity", mid-session tool injection).
- Phase documents: `03-08-SUMMARY.md` (SEC-03 half-closed, CAT-03 ownership, `Map`-vs-record disposition), `02-RESEARCH.md:152-215` (the module-scope registry finding — **correctly scoped there**, over-generalized in `04-CONTEXT.md`), `03-RESEARCH.md` (validation-architecture shape, harness pitfalls).

### Tertiary (LOW confidence — flagged, relied on for nothing load-bearing)

- The claim that React's `useSyncExternalStore` is *"the only correct primitive"* for reading external state (ARCHITECTURE §4.3). Plausible and widely held; no measurement here. Nothing in this phase's recommendations depends on it — the identity requirement follows from `Object.is` alone.

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| STG-04 memoization mechanics | **HIGH** | React and Svelte comparison functions read from source; identity behaviour measured on a working prototype. |
| Freeze mechanics and the shallow/shared coupling | **HIGH** | Seven tamper vectors and two timing comparisons measured against the real built artifact. |
| CAT-03 placement | **HIGH** | Both placements implemented and run over seven scenarios; the decisive rows are false positives, not preferences. |
| Stage matching and rename-independence | **HIGH** | Key-ordering measured; the sensitive test shape demonstrated to flip under the wrong implementation. |
| Export surface numbers | **HIGH** | Parsed from `dist/index.d.ts` with the suite's own regex, and cross-checked against the test's assertions. CONTEXT's figure corrected. |
| `explain()` shape and the `bridge` field | **MEDIUM-HIGH** | The single-pass requirement and the two-pass divergence are measured; the specific `{id, registered}` shape is a design recommendation argued against Phase 5's declared interface, not a measurement. |
| Module-scope vs instance-local justification | **HIGH** (that CONTEXT's reason does not reproduce) / **MEDIUM** (that SSR is the whole of the real reason) | Four bundles measured. The SSR argument is cited from ARCHITECTURE and Vue's docs, not re-measured here. |
| Phase-4 `dispatch` stub shape | **LOW** | No good answer exists; see Open Question 1. Escalate. |
| Duplicate stage ids | **HIGH** (that the defect is real) / **LOW** (which remedy) | Collapse measured; the three remedies are unranked and one contradicts a locked decision. Escalate. |

**Research date:** 2026-07-30
**Valid until:** ~2026-08-29 for the ecosystem claims (React/Svelte internals move slowly; both were read from `main`). The repo-internal measurements are valid until the next commit that touches `src/catalog.ts`, `src/index.ts` or `package.json` — in particular, **every mutant literal count must be re-taken at implementation time**, unfiltered, before the harness is run.

**Two claims this document deliberately does NOT make:**

1. That SEC-03 is fully closed by this phase. The handler-replacement and tool-array halves are closed; the consumer-supplied-`jsonSchema` getter channel (Pitfall 9) is measured open and is not this phase's to fix.
2. That the recommended implementation is the only correct one. Three decisions — the memo's `Map`-vs-record, the file layout, and the issue prose — are CONTEXT's explicit discretion grants, and two more (Open Questions 4 and 5) are genuinely unsettled and marked for escalation rather than resolved by a researcher's preference.
