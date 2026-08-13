# Phase 5: Bridge registry and the no-bridge path - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous). Grey area tables were generated and presented; the
acceptance prompt could not be surfaced because this session is non-interactive, so every
recommended answer below was **auto-accepted**. Each carries its rationale so any of them can be
reversed without re-deriving it. The two most consequential — 2.2 (the default normalizer) and
3.3 (dispatch wiring stays in Phase 6) — are flagged inline.

<domain>
## Phase Boundary

A handler reads live state from a page component that may or may not be mounted, without
prop-drilling and without re-rendering the app — and behaves honestly when nothing is mounted.

**In scope:** `createBridge` (the constructible `BridgeRegistry`), the monotonic-token identity
guard, snapshot capture and detachment from framework reactivity, the internal
stage→bridge resolution seam, and the off-page result helper.

**Out of scope — belongs to Phase 6:** replacing the `dispatch` stub, the DSP-09 result
normalizer, and the SEC-06 message sanitizer. Phase 5 ships the seam Phase 6 calls; it does not
call it from `dispatch`.

**Out of scope — belongs to Phase 9:** the React StrictMode and Svelte `$state.snapshot`
halves. Criterion 4 is deliberately guarded twice; Phase 5 owns the core-level half only,
demonstrated against a hand-rolled `Proxy` before any adapter exists.

</domain>

<decisions>
## Implementation Decisions

### Registry construction & identity

- **`createBridge<B extends Bridge>(id: string): BridgeRegistry<B>`.** The `id` is a human label
  for `explain()` only. Unforgeable identity comes from *holding the object reference* — the
  registry object is the capability. This is why `defineStage` was cut in Phase 4
  (`index.ts:32-36`); `createBridge` absorbs its only reason to exist.
  *Rejected:* an opaque `Symbol` identity, and string-id lookup through a map — both reintroduce
  the forgeability `PITFALLS.md:234` names.
- **Single slot, last-registration-wins.** A second `register()` replaces the first; the first's
  unsubscriber becomes a refused no-op.
  *Rejected:* LIFO stack semantics that restore the previous registration on unregister — that
  resurrects a dead page component, which is precisely the BRG-04 failure.
- **The stale-cleanup guard is keyed on a monotonic token, not the bridge object** (locked by the
  ROADMAP phase note). The counter is a `let` inside the `createBridge` closure — never module
  scope. Module-scope state pollutes across server requests; this is the correction Phase 4 had to
  make twice (`concierge.ts:17-35`).
- **A refused unsubscriber is an idempotent silent no-op.** Token mismatch → return, no warn.
  React StrictMode double-mount, Vue HMR, and Svelte remount produce refused cleanups *by design*,
  so warning here would fire on every dev mount and train developers to ignore the channel.
- **`register()` over a still-live registration warns once per registry id via `warnHost`.** Two
  components claiming one stage bridge is a genuine app bug, unlike a late cleanup. Warn, never
  throw — the loudness would land on the end user's blank screen.

### Snapshot detachment (BRG-05)

- **Detachment happens at capture time only.** `register()` stores the bridge as given and `read()`
  returns it untouched, so snapshot getters stay live — otherwise BRG-02 breaks. Phase 5 ships a
  capture function that invokes every getter in `bridge.snapshot` and passes each value through the
  normalizer.
  *Rejected:* normalizing at `register()` (freezes state at mount, breaks BRG-02) and normalizing
  inside `read()` (same defect, later).
- ⚠️ **The default `normalizeSnapshot` is a deep structural clone followed by a freeze — not a
  deep freeze.** `types.ts:1611` currently documents the default as "a deep freeze". That
  documented default **fails criterion 4**: freezing a `Proxy` does not detach it — the stored
  snapshot remains a live view and the CON-04 drift check passes unconditionally. Phase 5 corrects
  that doc comment as part of the work. `types.ts` ships inside `dist/index.d.ts`, so a false claim
  there is read by consumers.
  *Rejected:* keeping the deep-freeze default (fails BRG-05 outright); `structuredClone` (absent
  from `lib: ["ES2022"]`, would need a new `host.ts` capability, and throws on functions).
- **Clone depth:** plain objects and arrays cloned recursively, cycle-safe via `WeakMap`;
  `Date`, `Map`, and `Set` cloned structurally; **everything else passed through by reference,
  with that limit documented on the export.** Adapters override with their own normalizer
  (`$state.snapshot` for Svelte), which is the sanctioned path for exotic values.
  *Rejected:* plain-objects-and-arrays only (leaves a `Date` in a payload silently live);
  attempting class-instance cloning (lossy, and silently drops the prototype).
- **A snapshot getter that throws during capture is caught; that key becomes `undefined`; warn once
  naming the registry id and the key.** Follows the Phase 4 precedent where a throwing `match()` is
  caught, treated as a non-match, and warned once — honest degradation over propagation. The catch
  binds nothing and the message echoes nothing caught, per the standing rule that handler
  exceptions never reach the model or telemetry.

### The no-bridge path (BRG-03, DX-02)

- **Core never auto-fails an action because the stage's declared bridge is unmounted.** It passes
  `bridge: null` and the handler decides. Auto-failing would break DX-02 — an action reading router
  or DOM state must run with nothing registered at all — and would strip handlers of legitimate
  partial-capability paths.
  *Rejected:* short-circuiting to `no_bridge` whenever `stage.bridge` is declared but unmounted.
- **Ship one small exported helper** that builds the off-page result
  (`{ ok: false, reason: "no_bridge", message }`). DX-03's standard is that the message *is* the
  product; without a helper every consumer hand-writes a worse sentence. It composes a "what" and a
  "where" into a sentence that tells the human what to do, and is **bounded by
  `MESSAGE_MAX_CHARS` (180) — bounded, not sanitized.** The SEC-06 sanitizer is Phase 6's; Phase 5
  must not implement sanitizing.
  *Rejected:* no helper, documenting the literal shape instead — this is the one place the project
  has repeatedly said a good default message is load-bearing.
- ⚠️ **Phase 5 does not wire `dispatch`.** It ships an internal `resolveBridge(stage) → B | null`
  seam plus tests that invoke handlers directly with the resolved value. Phase 4 locked that
  Phase 6 *replaces* the dispatch stub wholesale rather than normalizing it; wiring it now collides
  with DSP-09. **Consequence to carry forward:** success criterion 3's end-to-end form — a real
  `dispatch` call returning the off-page sentence — is provable only in Phase 6. Phase 5 proves
  each half (resolution yields `null`; a handler given `null` returns the honest sentence).
  *Rejected:* minimally wiring the stub now.
- **`explain()`'s bridge row does not change shape.** `{ id, registered }` stays exactly as pinned
  in Phase 4 (`types.ts:1452`); Phase 5 only makes `registered` reflect reality. Honors the
  standing "fewer, better-justified fields" rule.
  *Rejected:* adding `since` / token / `registeredAt` to the row.

### Hardening, module layout, export surface

- **The returned registry object is frozen.** It is a capability object; an unfrozen
  `registry.read` is swappable by third-party page script, which is exactly the SEC-03 attack class
  that `deepFreeze` exists to close on the catalog. This deliberately diverges from
  `createConcierge`'s return, which is documented as not frozen (`concierge.ts:698`) — the
  divergence gets a doc comment stating why, so nobody "harmonizes" the two later.
  *Rejected:* leaving it unfrozen for consistency.
- **`createBridge` calls `assertSingleInstance()` inside the function body**, never at module
  scope — a module-scope call was *measured* to be deleted from consumer bundles under
  `"sideEffects": false` (Phase 3). `contract.ts:159-163` reserves this call site and states it
  inherits nothing from `buildCatalog`'s. Registration is where two core instances actually bite:
  the symptom is `bridge: null` forever on a page that is definitely open, the single most
  undebuggable failure in the design.
  *Rejected:* deferring the second call site to the Phase 9 adapters.
- **New module `src/bridge.ts`** holds `createBridge`, the capture function, and the default
  normalizer. Barrel-exported in the existing grouped order (types block, then values block).
- **Export surface grows by 2 values** (`createBridge` and the off-page helper). All three pins
  must move together: the counts in `test/export-surface.test.ts:136-142`, the `VALUE_EXPORTS`
  array at `:106`, and `test-d/exports.test-d.ts`. **Verify the live baseline before planning** —
  it was 59 names post-Phase-4 and reads 62/51/11 today; planning against a stale count fails on
  the first run.
- **`index.ts:27-36`'s prose is now stale** and must be corrected in the same change: it says
  "bridges are declared but not yet constructible" and lists `createBridge` as still to come.

### Settled after research (2026-07-31)

Research surfaced three questions it declined to settle. Resolved here by the orchestrator so the
planner has no open choices.

- **The capture function is exported — the surface grows by 3 values, not 2**
  (`createBridge`, the off-page helper, and the snapshot-capture function). The "fewer exports"
  rule yields to the discretion clause's own condition: export only if a test cannot reach it
  otherwise. It cannot. Runtime suites import `dist/index.js` and never `src/`, and research
  confirms there is **no public caller** on the current design — `dispatch` is stubbed, `explain()`
  does not capture, and consent is Phase 8. Criterion 4 must be proven at runtime against a
  hand-rolled `Proxy`, so an unexported capture function is an unprovable one. **This moves seven
  export pins, not three** — count them before writing the plan.
- **`bridgeStatus` is routed through the new `resolveBridge` seam.** Without it `resolveBridge` has
  no caller reachable from `dist/index.js` and becomes a second unprovable seam. `bridgeStatus`
  (`concierge.ts:222-238`) is already the only `read()` call site, so this is a redirect, not new
  behavior, and it makes the seam observable through `explain()`. **The Phase 6 fence still
  holds:** the `dispatch` stub is not touched.
- **The SSR registration leak (ARCHITECTURE item H) is out of scope.** Guarding it needs a
  `typeof window` test, which needs a new `host.ts` capability, which collides with the hard
  constraint that core constructs on the server with no environment guards. Record the invariant in
  a doc comment on `createBridge` instead of leaving it unwritten. Deferred below.
- **`contract.ts:159-163`'s reserved-call-site sentence is re-scoped, not deleted.** It reaches
  `dist/index.d.ts:2028` verbatim, and Phase 4 already had to correct the adjacent
  `createConcierge` sentence for exactly this reason. `createBridge` satisfies it for apps that call
  `createBridge` directly; a Phase 9 adapter that mounts without any `createBridge` call in the
  graph would still need its own. Add that clause; do not claim the obligation is discharged.
- **A proxied exotic value that throws during cloning falls back to pass-through-by-reference
  *and* warns once.** Research measured that a proxied `Date`/`Map`/`Set` throws on all six
  extraction routes. Pass-through alone matches the stated "everything else by reference" rule but
  leaves a **silent** BRG-05 hole — and BRG-05 is a security requirement, because it is what makes
  Phase 8's CON-04 drift check meaningful. Dropping to `undefined` instead loses data silently,
  which is no better. So: pass through, and warn once naming the registry id and the key, using the
  same latch shape as the throwing-getter warn but a distinct code. This resolves research
  assumptions A3 and A4 together — a hole we accept must not also be invisible.
- **Symbol-keyed properties are not carried by the clone**, and the plan must say so in a doc
  comment rather than leaving it to be discovered. The three target frameworks use symbol keys for
  internal markers, which is exactly what detachment should drop (research assumption A1).
- **The off-page helper takes two string parameters, `what` and `where`** (research assumption A5).
  Shape was discretionary; fixing it here so the type-test predicate is stable.

### Corrections to earlier decisions, from measurement

- **Decision 2.2 understated the defect.** It said a deep freeze "fails to detach". Measured, the
  deep-freeze default has **three** failure modes: it fails to detach; it **freezes the host app's
  own reactive store through the proxy**, so the snapshot appears not to move only because the app
  has been made permanently read-only; and it **throws `TypeError` out of the capture path** on
  proxy shapes whose traps do not satisfy the freeze invariants. The mechanism is one sentence:
  cloning fires only *read* traps (`ownKeys` / `getOwnPropertyDescriptor` / `get`), freezing fires
  *write* traps (`preventExtensions` / `defineProperty`). The clone-then-freeze decision stands and
  is now better justified.
- **The criterion-4 fixture is not free choice.** Only one hand-rolled proxy shape makes the
  deep-freeze mutant fail *correctly*: an accessor-backed target whose traps all forward honestly to
  `Reflect`. The intuitive signal-backed proxy makes the mutant **throw** rather than return a wrong
  value; a naively forwarding proxy makes the mutant **pass while destroying the app**. The plan
  must pin this exact shape.
- **Decision 2.4's `try` must wrap the normalizer, not just the getter.** A nested getter that
  throws propagates out of the *normalizer*, not out of `snapshot[k]()`. A `try` scoped to the
  getter call alone leaks a message echoing user input — the covert-PII channel CLAUDE.md forbids.
- **`Date` / `Map` / `Set` cloning needs `try`/`catch`.** A *proxied* `Date`/`Map`/`Set` throws on
  every extraction route (six measured, all `TypeError`).
- **Five of thirteen mount/unmount orderings discriminate nothing** — including the two a developer
  writes first (React StrictMode mount→unmount→mount, and double-invoking one unsubscriber). They
  produce identical results on the correct guard, on the object-identity defect, and on the naive
  clear. Exactly four orderings catch Anti-Pattern 6. Per project convention the five are **contract
  pins, not validation, and must be labelled as such** so a later reader does not mistake them for
  proof.
- **Export baseline confirmed live at 62 names / 51 types / 11 values.** `MESSAGE_MAX_CHARS` is
  `180` at `src/types.ts:279`. The Phase 1 deferred export-placement guard is **already closed** by
  `test-d/exports.test-d.ts:72` — do not re-open it.

### Claude's Discretion

- Internal file splits beyond `src/bridge.ts` (e.g. pulling the clone into its own module), all
  internal function and local names, and the division of tests across files.
- The exact wording of the default off-page sentence, subject to the DX-03 standard: it must say
  what is wrong *and* what to do, and stay under 180 characters.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`BridgeRegistry<B>` interface already exists**, `types.ts:1114-1124`, with `read`, `register`,
  and `id` — and its doc comment already states the identity-guarded-unsubscriber contract. Phase 5
  implements this interface; it does not design it. It is on the Phase 1 D-09 list of interfaces
  *consumers implement*, so adding a required member post-publish is breaking.
- **`Bridge<Actions, Snapshot>`**, `types.ts:1103-1112`. Defaults are the *top* of each constraint
  deliberately (plan 01-11 / CR-02); bare `Bridge` means widest, not empty. `types.ts:1076-1101`
  forbids restoring the `never`-valued form.
- **`deepFreeze`**, `catalog.ts:566` — cycle-safe via `WeakSet`, and **skips accessors by testing
  `"value" in descriptor` so a getter is never invoked.** That last property is exactly why a
  getter-based snapshot survives freezing, and makes it directly reusable here.
- **`warnHost`**, `host.ts:93-96` — the only sanctioned structural `globalThis` read. House message
  shape is `concierge: [code] subject "x": problem Fix: fix` (`concierge.ts:173-181`). Warn-once is
  latched per subject with a lazily-allocated `Set`.
- **`assertSingleInstance`**, `contract.ts:168`, called today only at `catalog.ts:827`.
- **`SnapshotNormalizer`**, `types.ts:668`, and `ConciergeConfig.normalizeSnapshot?`,
  `types.ts:1611`. The seam exists; **no default is implemented today.**
- **`no_bridge`**, `types.ts:187` — already one of the twelve closed `ReasonCode` members. The
  union is final at twelve; do not add or "restore thirteen".
- **Type-test fixtures** ready to reuse: `ResultsBridge` / `CartBridge`
  (`test-d/actions.test-d.ts:416,419`), `_resultsStage` / `_cartStage` (`:442,:445`),
  `_registryReadIsNullable` (`:436`), `_stageExplanationBridgeShape`
  (`test-d/concierge.test-d.ts:141`).
- **`.planning/research/ARCHITECTURE.md:279-289`** already contains a working
  `createBridgeRegistry<B>(id)` closure with the monotonic-token guard; `:950` is "Anti-Pattern 6 —
  identity-guarding on the bridge object instead of a token"; `:842` flags the module-singleton SSR
  hazard. The ROADMAP says research is "None — the source system solved this and supplies the test
  list."

### Established Patterns

- **Factory function returning a closure-scoped object literal. No classes.** The single class,
  `CatalogValidationError` (`catalog.ts:225`), justifies itself in its doc comment because `issues`
  must survive the throw. `createConcierge` (`concierge.ts:284`) is the template: module scope holds
  only immutable constants; every mutable binding is a `let` inside the factory body, `null` until
  first use.
- **Two error channels, never a thrown message on a runtime path.** Build-time aggregates and
  throws once (`CatalogValidationError` with structured `{code, action, vendor?, problem, fix}`);
  runtime developer diagnostics go through `warnHost`, warn-once.
- **Consumer callbacks are wrapped in `try {} catch {}` with no binding**, and the message echoes
  nothing caught (`concierge.ts:469-473` for `match`, `:230-235` for `read()`). `register` and the
  capture path follow this exact form.
- **No-DOM is mechanical, not by review.** `lib: ["ES2022"]` makes `window`/`document`/`setTimeout`/
  `crypto`/`console` a compile error. `host.ts:27-37` states the only escape: module-private minimal
  view type, cast *inside a function body*, capability optional at runtime.
- Also in force: `isolatedDeclarations: true` (every export needs an explicit annotation),
  `exactOptionalPropertyTypes` (optional members need explicit `| undefined`),
  `noUncheckedIndexedAccess`.
- **`snapshotEquality` must stay function-property syntax** (Phase 1 D-03). Under method syntax,
  bivariance silently un-breaks the very defect the snapshot test exists to catch. `DigestLike` is
  the deliberate opposite. Two adjacent seams, two opposite syntaxes, both load-bearing — any new
  Phase 5 snapshot-related type obeys the same rule and the plan must not harmonize them.
- **`readonly` goes all the way down or not at all** (Phase 4) — "a partial `readonly` is worse
  than none, because a reader stopped looking."

### Integration Points

| Seam | Location | Symbol |
|---|---|---|
| Bridge status read — the only `read()` call site today | `concierge.ts:222-238` | module-private `bridgeStatus(stage)` |
| `explain()` bridge row | `concierge.ts:611-679`; type at `types.ts:1452` | `Explanation.stages[].bridge` |
| Stage → registry wiring | `types.ts:1147` | `StageDefinition.bridge?: BridgeRegistry<B>` |
| Handler's bridge slot | `types.ts:421` | `ActionHandler` ctx `bridge: B \| null` |
| Dispatch stub Phase 6 replaces — **do not touch** | `concierge.ts:578-584`, `:129` | `DISPATCH_NOT_IMPLEMENTED` |
| Stage resolution a dispatcher will reuse | `concierge.ts:526`, `:377`, `:448` | `resolveIndex`, `namesByStage`, `runMatch` |
| Public barrel | `index.ts:71-73` (types), `:112-127` (values) | `Bridge`, `BridgeRegistry` already exported |

There is **no existing path from a resolved stage to `stage.bridge` at invocation time** —
`dispatch` never touches a stage today. Phase 5 builds the resolution half; Phase 6 calls it.

### Test Conventions

- Runtime suites live in `packages/concierge/test/*.test.ts` and import **`../dist/index.js`, never
  `../src/`**, guarded by an `existsSync` check in `beforeAll` with an actionable message.
  `pnpm build` is a prerequisite.
- `describe` titles are requirement ids (`"BRG-01 — …"`); `it` titles carry a case id plus the
  claim. Every file opens with a "what escapes without this file" header carrying measured
  evidence.
- **No Vitest mocking API in `test/`** — the grep must stay at zero. Console capture is a plain
  global assignment restored in a `finally`.
- Type tests live in `packages/concierge/test-d/*.test-d.ts`, run by `tsc -p tsconfig.test-d.json`,
  and use the four `_assert.ts` aliases (`Expect`, `Equals`, `Assignable`, `Not`) — **not**
  `expectTypeOf`. **Predicate assertions over `@ts-expect-error`**, which suppresses any error on
  the next line and has twice passed green over unrelated typos; it is reserved for object-literal
  freshness only.
- **Adequacy is proven by mutation, not by a green suite** — `scripts/mutate-and-prove.sh`. Where
  the obvious mutant literal does not work, the working one is written into the test file as a
  comment.

</code_context>

<specifics>
## Specific Ideas

- The identity guard must be demonstrated against the **hard case**, not the easy one: a component
  re-registering an object that is `===` its previous registration (a memoized literal, a reused
  `$state` object). Guarding on the bridge object passes the easy case and fails this one, which is
  why the token exists.
- Criterion 4 must be demonstrated **against a hand-rolled `Proxy` in core**, before any framework
  adapter exists. The test writes through the proxy after capture and asserts the stored snapshot
  did not move.
- The off-page sentence is held to the DX-03 standard: a message that says what is wrong without
  saying what to do fails the requirement even if it fires at exactly the right moment.
- The enforcement standard applies here as it did to `readsUntrusted`: a registry that *looks*
  identity-guarded without a test proving the stale cleanup is refused would be rejected. Each of
  the five success criteria needs a test that fails when the guard is removed.

</specifics>

<deferred>
## Deferred Ideas

- **End-to-end proof of criterion 3** (a real `dispatch` returning the off-page sentence) →
  Phase 6, following from decision 3.3.
- **The SEC-06 message sanitizer** → Phase 6. Phase 5 bounds message length only.
- **The DSP-09 result normalizer**, including rejecting a success that carries a `reason` and a
  failure that carries none → Phase 6. Already on the STATE.md deferred list from Phase 1 / plan
  01-13, and still awaiting user ratification of the flat `ActionResult` shape (option-b); the
  alternative is a discriminated union on `ok`, free before publish and breaking after, with
  Phase 8 the last free moment.
- **React StrictMode double-mount survival (ADP-01) and Svelte `$state.snapshot` as the supplied
  normalizer (ADP-02)** → Phase 9. Phase 5 proves the core-level half only.
- **SEC-03's registry-frozen-after-catalog-build requirement** is adjacent but owned elsewhere;
  Phase 5 freezes the registry object it constructs, which is a narrower claim.
- **The SSR registration leak** (ARCHITECTURE item H) — a registration made during server render
  outliving the request. Guarding it needs a `typeof window` test, which needs a new `host.ts`
  capability, which collides with the hard constraint that core must construct on the server with
  no environment guards. Phase 5 records the invariant in a doc comment on `createBridge` rather
  than leaving it unwritten. Revisit alongside the Phase 9 adapters, which are where a real
  server-render path first exists.
- **The pending todo "correct the over-broad `sideEffects` headline"** was surfaced by research as
  a possible fold-in "if Phase 5 touches `catalog.ts` anyway." It does not — `deepFreeze` is reused
  without editing that file, so the trigger never fires. Stays where it is.

</deferred>
