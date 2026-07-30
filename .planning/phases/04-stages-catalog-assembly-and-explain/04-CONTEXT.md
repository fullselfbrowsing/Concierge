# Phase 4: Stages, catalog assembly, and explain() - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — 16 questions across 4 areas, all recommendations accepted

<domain>
## Phase Boundary

This phase turns the flat, validated catalog Phase 3 built into a *stage-scoped* one, and makes the
scoping legible when it surprises someone.

**In scope:**
- `createConcierge(config: ConciergeConfig): Concierge` — the factory that assembles stages,
  cross-stage actions, and one `buildCatalog` call into a live `Concierge`.
- `stageFor(ctx)` — declaration-order first-match resolution over `ConciergeConfig.stages`.
- `catalogFor(ctx)` — per-stage projection to `ReadonlyArray<EmittedTool>`, memoized by resolved
  stage id and **re-frozen** (the still-open half of SEC-03, handed forward by 03-03/03-06/03-08).
- `explain(ctx)` — a new member on the `Concierge` interface answering DX-01's three questions.
- CAT-03 — `consent.requires` must name an action that exists, checked at build against the whole
  assembled catalog. Ownership settled by `03-08-SUMMARY.md:341-352`.

**Out of scope:**
- `defineStage` / `createBridge` — bridge identity is Phase 5 (`PITFALLS.md:234`).
- `BridgeRegistry` implementation — Phase 5. This phase reads only the `StageDefinition.bridge?`
  seam that already exists in types.
- `dispatch` — Phase 6. `createConcierge` must return a `Concierge` whose `dispatch` exists, but
  its behaviour is Phase 6's; this phase ships whatever minimal honest form Phase 6 will replace.
- CAT-04 (transport grade ceiling) — Phase 8; it needs a transport, which is Phase 7.
- The visual devtools overlay — v0.2+ per `research/SUMMARY.md:165`.

</domain>

<decisions>
## Implementation Decisions

### Catalog assembly and stage scoping

- **One flat `buildCatalog` over `[...allStageActions, ...crossStage]`, then project per stage.**
  Not a `buildCatalog` per stage. CAT-03 needs the complete name set including cross-stage actions
  (`03-08-SUMMARY.md:343`), and a single build means a single aggregated `CatalogValidationError`
  rather than one throw per stage. The per-stage view is a projection of that one catalog.

- **A duplicate action name across two stages is rejected globally.** `buildCatalog`'s existing
  `duplicate_action_name` issue stands unchanged and unscoped. The action name is the agent's
  vocabulary; two different behaviours under one name is precisely the ambiguity the design exists
  to prevent, and the agent has no way to tell which one it is calling. Rejected: allowing it when
  the two definitions are structurally identical (a deep-equality check that would be a new
  correctness surface), and per-stage name-spacing (which changes the wire name the agent sees).

- **`catalogFor` memoizes on the resolved stage's *array index* (`number | null`), not on `ctx`
  identity and not on the stage id.** `PITFALLS.md:556` — key by resolved stage, not `ctx` identity
  — combined with STG-04's referential-identity requirement gives: resolve stage, look up cache,
  build-and-freeze on miss, return the same reference forever after. The cache is
  **per-`Concierge`-instance and lazily allocated on first `catalogFor` call**, never at module
  scope.

  > ⚠️ **Corrected 2026-07-30 after 04-RESEARCH, twice.**
  >
  > **(a) The key.** This originally read "the resolved stage id (`string | null`)". Research
  > measured that two stages declared with the same `id` build cleanly and then silently serve each
  > other's catalogs — the id-keyed lookup collapses to the last stage's actions, and `buildCatalog`
  > cannot see it because it receives a flat action array and has no concept of a stage.
  > `duplicate_action_name` does not fire, because the action *names* differ. That is a direct STG-01
  > failure. Keying by array index makes the collapse impossible at zero new surface cost, and still
  > satisfies `PITFALLS.md:556`'s actual instruction. **Additionally: `createConcierge` warns once via
  > `warnHost` when two stages share an id**, because the id is still what `stageFor`,
  > `Session.stage()`, and `explain()` report, so the ambiguity remains visible to a developer even
  > though it can no longer mis-route the catalog. Rejected: throwing (needs an issue whose `action`
  > field holds a stage id, corrupting the `issues.map(i => i.action)` semantics DX-03 depends on),
  > and warn-only (leaves a real correctness bug in place).
  >
  > **(b) The reason for lazy allocation.** This originally justified "never at module scope" with
  > `sideEffects: false` deleting module-scope evaluation from a bundled consumer. **That does not
  > reproduce.** Measured under rolldown 1.2.0 with `treeshake.moduleSideEffects: false`: a
  > module-scope `Map` read by an exported function is *retained* and behaves identically bundled and
  > unbundled. 02-RESEARCH's original finding was correctly scoped — the consumer imported
  > `CONTRACT_VERSION`, a constant that gets inlined, so nothing from the module was retained. I
  > over-generalized it. **The reason that is actually true, and the one the doc comment must state:
  > cross-request state pollution under SSR.** Module instances are reused across server requests
  > (`ARCHITECTURE.md:380-405`, quoting Vue's own definition and citing TanStack Router shipping this
  > exact bug). A module-scope catalog memo would be shared across every `createConcierge` in the
  > process, so two configs in one server would serve each other's catalogs under colliding stage
  > keys. Writing the tree-shaking sentence into a shipped doc comment would be a false claim of
  > exactly the kind 03-08 spent a whole plan removing from `dist/index.d.ts`.

- **When no stage matches, `catalogFor` returns the cross-stage actions only** — memoized under the
  `null` key with the same identity guarantee. `ConciergeConfig.crossStage` is declared "available
  in every stage"; an unknown page is still a page, and silently stripping actions the developer
  explicitly marked global would contradict the declaration they wrote. The situation is not hidden:
  `stageFor` returns `null` and `explain()` reports `stage: null` with every stage's `matched: false`.
  Rejected: returning an empty frozen array — "fail closed" is the right instinct for *consent*, but
  here it would silently disable `signOut`-shaped actions on any unrouted page.

### `explain()` shape

- **`explain(ctx: StageContext)` — takes the context, returns a structured object.** Mirrors
  `catalogFor(ctx)` and `stageFor(ctx)` exactly. `Concierge` holds no context of its own; `Session`
  owns context (Phase 7), and a zero-arg `explain()` would have to invent hidden state on the very
  interface whose statelessness lets it construct on a server.

- **Three fields: `{ stage, stages: [{ id, matched, bridge }], catalog }`.** One field per clause of
  DX-01 ("the active stage, which bridges are registered, and the current catalog"). The per-stage
  row folds "which stages did not match" and "which bridges are registered" into one array indexed
  by stage rather than three parallel arrays that a reader has to cross-reference. `catalog` is the
  action-name list — the full `EmittedTool` array is already one `catalogFor(ctx)` call away, and
  Phase 1's D-04 preference ("prefer fewer, better-justified fields") governs. Rejected:
  `PITFALLS.md:494`'s five-field shape (`matchedStage`, `unmatchedStages`, `registeredBridges`,
  `missingBridges`, `catalogSize`) — same information, three more fields, and `catalogSize` is
  `catalog.length`.

- **The returned object is deep-frozen and deliberately NOT identity-stable.** Freezing is
  consistent with SEC-03 and costs nothing on a diagnostic-rate call. Not memoizing is the point:
  the doc comment must say so explicitly, so nobody wires `explain()` into `useSyncExternalStore`
  and reproduces the exact infinite-render defect STG-04 exists to prevent.

- **`explain()` does not print.** Structured return only; no `warnHost` call. Phase 3's precedent
  is that the structured value is the assertable channel and console output is the convenience one
  — and a convenience with no test is a surface with no guarantee.

### CAT-03 — consent target existence

- **The check lives inside `buildCatalog`, as a new `CatalogIssueCode`.** `buildCatalog` already
  owns the assembled name set, the issue-aggregation loop, and `CatalogValidationError`. Putting
  CAT-03 in `createConcierge` would mean two build-failure channels with two error classes for the
  same class of mistake. Since this phase feeds `buildCatalog` the whole assembled set (stages +
  cross-stage), the name set it needs is already in hand.

- **Issue code: `consent_target_missing`.** Follows the existing `{code, action, problem, fix}`
  record shape and the existing message format. The `problem` names both the referring action and
  the missing target (ROADMAP SC-4 requires both); the `fix` states what to do.

- **The target may live in any stage, not necessarily the referring action's.** review-on-results →
  confirm-on-checkout is a legitimate flow. This is a build-time *existence* check only; whether
  the pair can actually be satisfied at runtime is Phase 8's consent kernel.

- **`requires` naming the action's own name is also an issue** — separate code
  `consent_self_reference`. It is unsatisfiable by construction: arming the gate would require
  running the very action the gate blocks. The consequence is identical to a typo — a safety gate
  that is silently permanently closed, or silently never armed — which is exactly the failure CAT-03
  is written to catch. This is the one place where adding a code rather than reusing one is
  justified, because the `fix` prose is completely different.

### API surface and matching semantics

- **Ship `createConcierge`. Do not ship `defineStage`.** Stage matching needs no identity mechanism;
  a plain `StageDefinition` object literal already typechecks (`test-d/actions.test-d.ts:442`).
  `defineStage`'s reason to exist is unforgeable bridge identity (`PITFALLS.md:234`), which belongs
  with the bridge registry in Phase 5. `src/index.ts:22`'s module doc comment currently lists
  `defineStage` among the unimplemented APIs and must be updated to reflect what actually ships.

- **The Phase 4 `dispatch` stub returns `{ ok: false, message }` with `reason` deliberately
  omitted.** *(Added 2026-07-30 — escalated from 04-RESEARCH Open Question 1.)* `Concierge.dispatch`
  is a required member, so `createConcierge` must supply one, but Phase 6 owns its behaviour.
  `ReasonCode` is a **closed** union of twelve and `types.ts:159-163` states that adding a member is
  a breaking change *by design* — none of the twelve means "this runtime is not built yet".
  `unknown_action` would be a lie for an action plainly in the catalog; `handler_error` would be a
  lie. Omitting `reason` asserts nothing false. The message says so plainly, a doc comment records
  it, and the phase summary must note that Phase 6's DSP-09 normalizer will *replace* this shape
  rather than normalize it. Rejected: adding `not_implemented` to the union — a `types.ts` contract
  change that Phase 6 would immediately have to remove.

- **`EmittedTool`'s fields become `readonly` in this phase.** *(Added 2026-07-30 — escalated from
  04-RESEARCH Open Question 5.)* Measured: `catalogFor(ctx)[0].name = "evil"` typechecks today and
  is stopped only by the runtime freeze. Nothing constructs an `EmittedTool` yet, so tightening
  costs nothing now and is breaking once Phase 7 writes a transport against
  `Transport.setTools(tools: ReadonlyArray<EmittedTool>)`. `types.ts:1302-1310`'s `readonly
  capabilities` precedent is directly on point: a `readonly` that does not go all the way down is
  worse than none, "because a reader stopped looking". Lands in the same commit as the
  `Concierge.explain` addition, with a type-level predicate pinning it.

- **A `match()` that throws is caught, treated as a non-match, and warned once via `warnHost`.**
  `catalogFor` runs on every route change in the host app; an exception propagating out of a
  matcher takes down the consumer's render. Skipping the stage is the honest degradation, and
  `explain()` still shows `matched: false` for it. Rejected: letting it propagate (loud, but the
  loudness lands on the end user's blank screen).

- **`stageFor` re-runs the matchers on every call; it is not memoized.** Matchers are pure and
  cheap, and their input is the caller's arbitrary `ctx`. Only the *projected catalog* is memoized,
  keyed by the resolved stage id — which is the whole reason `PITFALLS.md:556` says to key by stage
  name rather than by `ctx`.

- **The inline-`defineAction` widening defect is documented, not fixed.** 03-08 hand-off #2: an
  action declared inline inside `StageDefinition.actions` or `ConciergeConfig.crossStage` loses its
  `name` literal, because the contextual type `AnyActionDefinition` binds `N` to `string` before
  `name` is consulted, and `as const` does not help. Fixing it means re-narrowing collections that
  D-07 deliberately erased to `any` for a *measured* contravariance reason
  (`StageDefinition<ResultsBridge>` is not assignable to `StageDefinition<Bridge>`). So: add a doc
  comment on `stages`/`crossStage` showing the required spelling (declare actions in a `const`
  first, then reference), keep `_inlineDefineActionLosesTheUnion` in `test-d/catalog.test-d.ts`
  pinned red, and revisit in Phase 8 against a real kernel per D-12.2. If that predicate ever goes
  red-to-green the gap has closed — delete it, do not relax it.

### Claude's Discretion

- Internal module layout and file names (`src/stages.ts` vs folding into `catalog.ts` vs a new
  `src/concierge.ts`) — Phase 3 granted this and nothing here changes it.
- The exact `problem`/`fix` prose for the two new issue codes, subject to the standing rule that a
  message which says what is wrong without saying what to do fails the requirement.
- Whether the stage-id memo cache is a `Map` or a null-prototype record, given it is instance-local
  and never frozen.
- Test file naming and the split between new files and additions to `catalog.test.ts`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`buildCatalog(actions, options?)` → `Catalog<Name>`** (`src/catalog.ts:718`) — takes a *flat
  array*, not stages and not a `ConciergeConfig`. Returns `{entries, names, byName, diagnostics}`.
  `byName` is a frozen null-prototype record, deliberately not a `Map`. Four issue codes and two
  diagnostic codes exist; CAT-03 adds to that set.
- **`deepFreeze(value, skip, seen)`** (`src/catalog.ts:566`) — recursive, cycle-safe via `WeakSet`,
  skips validator instances, skips accessors by testing `"value" in descriptor` so a getter is
  never invoked, and does not early-out on `Object.isFrozen`. Its doc comment already carries this
  phase's instruction: `frozenArray.filter(...)` returns a **new, unfrozen** array.
- **`CatalogValidationError`** (`src/catalog.ts:206`) — carries `readonly issues`, aggregated, never
  short-circuited. `issues.map(i => i.action)` is the assertable channel; `message.includes(name)`
  is not.
- **`warnHost`** (`src/host.ts`) — the single sanctioned structural `globalThis` read. `console` is
  not type-visible under `lib: ["ES2022"]` with no `@types/node`.
- **`emitSchema` / `CatalogEntry.parameters`** — the `JsonSchemaObject` each entry already carries;
  `EmittedTool` is a four-field projection (`{type:"function", name, description, parameters}`) that
  nothing builds yet.

### Established Patterns

- **Two channels, distinct semantics.** *Issue* = build-failing, aggregated, thrown once. *Diagnostic*
  = reported and continued, one per offending action, each naming its action, severity via
  `onDiagnostic` (default warn), and throwing from the hook is the supported way to make it fatal.
  The sink is deliberately not wrapped in try/catch.
- **Message format is the product.** `concierge: {n} problem(s) in the action catalog.` then
  `  [{code}] action "{name}": {problem} Fix: {fix}` per issue.
- **Runtime tests import `../dist/index.js`, never `../src/`**, guarded by an `existsSync` check in
  `beforeAll` so the "run pnpm build first" message survives. Type tests live in `test-d/` and run
  under `tsc -p tsconfig.test-d.json`. `test/` is in no TypeScript program.
- **Every validation rule gets a mutant** via `scripts/mutate-and-prove.sh`; where the obvious mutant
  literal doesn't work, the *working* one is written into the test file as a comment.
- **No Vitest mocking API in `test/`** — a grep for that namespace must stay at zero. Console capture
  is a plain global assignment restored in a `finally`.
- **Every test file opens with a "What escapes without this file" header.**
- Predicate assertions (`Expect<Not<Assignable<…>>>`) over `@ts-expect-error`, which is reserved for
  object-literal freshness.
- Corrections are annotated in place, never silently rewritten; the rejected alternative and its
  reason are recorded so a later reader can reverse a decision without re-deriving it.

### Integration Points

- **`src/index.ts`** — the export surface is pinned twice and both must move together:
  `test/export-surface.test.ts` (count + names, parsed from `dist/index.d.ts`) and
  `test-d/exports.test-d.ts`. Currently **59 names total — 49 type exports, 10 value exports**.
  `createConcierge` and any new issue codes / `explain` return type land here. The module doc comment
  at `index.ts:22` lists `createConcierge` and `defineStage` as unimplemented and needs correcting.

  > ⚠️ **Corrected 2026-07-30 after 04-RESEARCH.** This originally read "10 value exports, 42 type
  > exports". The real figure, parsed from `dist/index.d.ts` with the suite's own regex, is 49 types.
  > Planning against 42 fails `pnpm test export-surface` on the first run.
- **`Concierge` interface** (`types.ts:1497`) — `dispatch`, `catalogFor`, `stageFor` exist;
  `explain` must be added. Per D-09 this is core-constructed, so the addition is cheap now and
  expensive after adapters exist.
- **`Session.stage()`** (`types.ts:1521`) returns `string | null` "matching `Concierge.stageFor`
  exactly" — two spellings of "no stage" would be a defect. Phase 7 depends on this.
- **`Transport.setTools(tools: ReadonlyArray<EmittedTool>)`** (`types.ts:1313`) is what `catalogFor`
  ultimately feeds; nothing connects them until Phase 7.
- **Seven gates must stay green**: `pnpm typecheck`, `pnpm build`, `pnpm test`, `check:artifact`,
  `check:deps`, `check:pack`, `check:node-floor`. `tsdown` does not typecheck — `tsc --noEmit` is a
  separate, load-bearing gate.
- **`pnpm test -- <name>` does not filter** (vitest's cac CLI discards after `--`). Use `pnpm test <name>`.

</code_context>

<specifics>
## Specific Ideas

- ROADMAP SC-3 is a referential-identity assertion, not a deep-equality one: two `catalogFor` calls
  with equivalent context must return **the identical array reference**. `ARCHITECTURE.md:398-432`
  names "returning a fresh array from `catalogFor`" as Anti-Pattern 5 and asks for exactly this test:
  construct a `Concierge`, call `catalogFor(ctx)` twice, assert identity.

- ROADMAP SC-2 requires that stage matching "does not change behavior when a stage is renamed". The
  mechanism already exists and is already argued in `ConciergeConfig.stages`'s doc comment: an
  ordered array rather than a keyed object, because object key iteration puts integer-like keys
  first and would make match order depend on whether a stage happened to be named `"2"`. The test
  should rename a stage and assert unchanged resolution order.

- SEC-03 must be recorded as *fully* closed only when the `catalogFor` re-freeze lands. 03-08
  deliberately recorded it as HALF closed so that a Phase 4 planner could not drop the obligation.
  `03-06`'s C22 pins `Object.isFrozen(entries[0].action.schema) === false` as a **positive** claim —
  so "freeze everything" is not available as an obvious tightening.

- CAT-01 in `REQUIREMENTS.md` is currently *Partial* — 4/5 derived artifacts ship, and "per-stage
  catalogs" is the missing fifth. This phase is what closes it.

- The `schema_not_emittable` remedy is vendor-blind — every such issue carries a hardcoded `fix`
  naming valibot unconditionally. The structural repair is 03-03's flagged `SchemaEmission →
  {diagnosis, remedy}` split. Not this phase's requirement, but this phase is adding issue codes to
  the same function and may find it cheap to fix in passing.

- `JsonSchemaObject.additionalProperties` is declared `boolean` and reality is wider (`z.record`
  emits a schema *object* there). `types.ts` was deliberately not amended — amending a declared type
  is a contract change needing its own decision. Carried, not resolved here.

</specifics>

<deferred>
## Deferred Ideas

- **`ServerSafeConcierge`** — a type exposing `catalogFor` but not `dispatch`, so a server render
  cannot reach mutable state (`PITFALLS.md:356`, `SUMMARY.md:196`). Real idea, but it is an export
  surface decision that wants Phase 9's SSR evidence behind it. Revisit at Phase 9 (ADP-04).
- **The visual devtools overlay** — v0.2–v0.3 per `research/SUMMARY.md:165`. `explain()` is the v0.1
  answer and `PITFALLS.md:506` is explicit that `explain()` is the one thing that must not be
  deferred.
- **Fixing the inline-`defineAction` contextual widening** — deferred to Phase 8 per D-12.2, to be
  reconsidered against a real consent kernel.
- **`SchemaEmission → {diagnosis, remedy}` split** — a Phase 3 finding, not a Phase 4 requirement.
- **`defineStage` / `createBridge`** — Phase 5.

</deferred>
