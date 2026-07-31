# Phase 5: Bridge registry and the no-bridge path - Research

**Researched:** 2026-07-31
**Domain:** In-process capability registry, snapshot detachment from reactive proxies, honest degradation
**Confidence:** HIGH — every load-bearing claim below was executed in this session against Node v24.14.1, TypeScript 7.0.2, the repo's exact compiler flags, and the built `packages/concierge/dist/`. Nothing here rests on training data.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Registry construction & identity**

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

**Snapshot detachment (BRG-05)**

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

**The no-bridge path (BRG-03, DX-02)**

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

**Hardening, module layout, export surface**

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

### Claude's Discretion

- Internal file splits beyond `src/bridge.ts` (e.g. pulling the clone into its own module), all
  internal function and local names, and the division of tests across files.
- The exact wording of the default off-page sentence, subject to the DX-03 standard: it must say
  what is wrong *and* what to do, and stay under 180 characters.
- Whether the capture function is exported or internal — export only if a test cannot reach it
  otherwise, given the "fewer exports" rule.

### Deferred Ideas (OUT OF SCOPE)

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
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **BRG-01** | A page component registers `{actions, snapshot}` and receives an unsubscriber that removes the registration only if it is still the one it created | The monotonic-token closure, §"The Monotonic Token Guard". The complete ordering matrix (§Ordering Matrix) shows which orderings actually discriminate a defective guard and which pass on every implementation. |
| **BRG-02** | A handler reads live app state through snapshot getters, returning current values after the app has updated without the bridge being re-registered | `register()` stores the bridge *as given*; `read()` returns it untouched. The store-as-given rule is what keeps getters live — §"Two Storage Rules That Look Redundant And Are Not". Detachment is at capture, never at register or read. |
| **BRG-03** | A handler whose stage bridge is not mounted receives `bridge: null` and returns an honest off-page message | `resolveBridge(stage) → B \| null` with a `try/catch` around `read()` mirroring `bridgeStatus` (`concierge.ts:230-235`), plus the off-page helper. §"The No-Bridge Path". |
| **BRG-04** | A stale unregister from a remounted component cannot clear a newer registration | Same token guard. Measured: **only four of thirteen orderings discriminate the object-identity defect**, and the "obvious" late-cleanup test is not one of them. §Ordering Matrix. |
| **BRG-05** | Snapshots are detached from framework reactivity before storage, so a proxy-backed store cannot yield a stored snapshot that mutates with the app | The clone-then-freeze default normalizer, with the full detection algorithm and its three measured failure modes for the deep-freeze default. §"The Default Normalizer" and §"Freeze vs Clone: The Measured Matrix". |
| **DX-02** | An action can run against DOM or router state with no bridge registered, so an app gets value before instrumenting its components | Core never auto-fails on an unmounted bridge; a stage that declares no `bridge` at all resolves to `null` and the handler still runs. §"The No-Bridge Path". |
</phase_requirements>

---

## Summary

The mechanism for this phase is settled — `ARCHITECTURE.md:279-289` already contains the working
closure, and the ROADMAP correctly says no open-web research is needed. What was *not* settled, and
what this session measured, is the **default snapshot normalizer**, and the measurements invert what
the shipped documentation says in a way that matters more than CONTEXT.md anticipated.

`types.ts:1609` and `types.ts:666` both ship — inside `dist/index.d.ts`, at `:1409` and `:553` — the
claim that the default normalizer is "a deep freeze". CONTEXT.md decision 2.2 already established
that a deep freeze fails BRG-05. It is worse than that. A deep freeze applied to a proxy-backed
value has **three distinct failure modes depending on the proxy's trap shape**, and all three were
reproduced in this session: it can silently fail to detach (the accessor-skip path, which is the
one that makes criterion 4 pass unconditionally); it can **freeze the host application's own
reactive store through the proxy**, permanently breaking the app it was trying to observe; or it can
**throw a `TypeError` out of the capture path** on a proxy whose traps do not satisfy the freeze
invariants. The clone-then-freeze default avoids all three, and the reason is mechanical rather
than incidental: cloning fires only *read* traps (`ownKeys`, `getOwnPropertyDescriptor`, `get`)
while freezing fires *write* traps (`preventExtensions`, `defineProperty`). That distinction is the
whole of the argument and is worth stating in the doc comment that replaces the false one.

The second finding that changes the plan is about **test adequacy rather than implementation**. The
monotonic-token guard was exercised against thirteen mount/unmount orderings and compared against
the two defective implementations a reviewer would plausibly write. Five of those thirteen
orderings — including the two most natural ones to write first, "React StrictMode mount → unmount →
mount" and "double-invoke one unsubscriber" — produce **identical results on the correct
implementation and on both defects**. Under this project's own standard ("a test that cannot be
made to fail by a named mutant does not count as validation") those five are contract pins, not
validation, and the plan must label them as such rather than counting them toward BRG-01/BRG-04.
Exactly four orderings discriminate the object-identity defect the ROADMAP note names, and every
one of them requires a stale unsubscriber to fire *after* a replacement whose bridge object is
`===` the one it captured.

**Primary recommendation:** Build `src/bridge.ts` around three separable units — the token closure,
the capture loop, and the structural clone — and route `concierge.ts`'s existing `bridgeStatus`
through the new `resolveBridge` seam so the phase's one new resolution path has a reachable caller
in the built artifact. Write the criterion-4 test against the accessor-backed `Proxy` shape
specified in §"Shape F", which is the only hand-rolled proxy shape under which the deep-freeze
mutant fails *visibly and without throwing*.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bridge registration + unsubscribe | Core (`src/bridge.ts`) | Framework adapter (Phase 9) | The identity guard is framework-agnostic; the adapter only decides *when* to call `register`. Putting the guard in the adapter would mean writing it three times and getting it right in React only — the defect the ROADMAP calls "invisible in a React-only suite". |
| Snapshot capture (invoking getters) | Core (`src/bridge.ts`) | — | Capture must be adjacent to the normalizer call so the `try/catch` covers both. Splitting them puts the throw boundary in the wrong place — see §"Where the try/catch actually goes". |
| Snapshot detachment (the normalizer) | Core default; adapter override | Framework adapter (Phase 9) | Core ships a structural clone that works everywhere. Svelte supplies `$state.snapshot`, which is strictly better *for Svelte* because it understands its own proxy. `ConciergeConfig.normalizeSnapshot` is the seam and already exists. |
| Stage → bridge resolution | Core (`src/concierge.ts`) | — | It reads `StageDefinition.bridge`, which is a `concierge.ts` concern. `bridge.ts` must not import stage types or the module boundary inverts. |
| Off-page result construction | Core (exported helper) | Consumer handler | Core supplies the default sentence; the handler chooses whether to use it. Core never *forces* it — that would be the auto-fail DX-02 forbids. |
| Deciding what to do with `bridge: null` | Consumer handler | — | Locked by CONTEXT: core passes `null` and the handler decides. This is the DX-02 mechanism. |
| Message sanitization | **Phase 6 (out of scope)** | — | Phase 5 bounds length only. Implementing sanitizing here collides with SEC-06. |

---

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md` that constrain this phase. The planner must verify each.

| # | Directive | Consequence for Phase 5 |
|---|-----------|------------------------|
| C1 | **Core is dependency-free.** | `src/bridge.ts` adds zero packages. The clone is hand-written because there is no third-party option that satisfies C2. |
| C2 | **No top-level `window`, `document`, `navigator`; must construct on the server under Next/Nuxt/SvelteKit with no environment guards.** | Rules out ARCHITECTURE.md item H's suggested `typeof window === "undefined"` SSR dev-warning without a new `host.ts` capability. See Open Question 1. |
| C3 | **`lib: ["ES2022"]`, no `@types/node`.** | `structuredClone` is **TS2304 — verified this session**. `Reflect`, `WeakMap`, `WeakSet`, `Object.getOwnPropertyDescriptors`, `Object.getPrototypeOf`, `Object.create(null)`, `Array.isArray`, `Object.hasOwn`, `Object.prototype.toString`, `Date`, `Map`, `Set` are all **reachable — verified this session**. |
| C4 | **`isolatedDeclarations: true`.** | Every export in `src/bridge.ts` needs an explicit return-type annotation. `createBridge` must be annotated `: BridgeRegistry<B>`; the helper `: ActionResult`. |
| C5 | **`exactOptionalPropertyTypes: true`.** | Any optional member added needs an explicit `\| undefined`. Relevant if the capture result models "this key threw" as an explicit `undefined`. |
| C6 | **`noUncheckedIndexedAccess`.** | Indexed reads inside the clone (`v[k]`) are `T \| undefined`. The clone must not assume presence. |
| C7 | **Handler exceptions never reach the model or telemetry; a generic sentence is the entire externally-visible surface of a crash.** | The capture `catch` binds nothing and echoes nothing. Applies to the *normalizer* call too, not just the getter — §"Where the try/catch actually goes". |
| C8 | **ESM-only; no top-level `await` anywhere in core.** | Trivially held; `src/bridge.ts` has no async surface at all. |
| C9 | **Node ≥ 22.12.0** (`engines`). | No polyfill considerations. |
| C10 | **MIT, public; `dist/index.d.ts` is read by consumers.** | The false "deep freeze" prose at `dist/index.d.ts:553` and `:1409` is a shipped defect, not an internal note. |

---

## Standard Stack

**This phase installs nothing.** Core is dependency-free by constraint C1, and every primitive the
phase needs is in `lib: ["ES2022"]`.

### Core (already present, verified this session)

| Capability | Where | Verified | Purpose in this phase |
|------------|-------|----------|----------------------|
| `WeakMap` | `lib.es2015.collection` | ✅ compiles under repo flags | Cycle safety + DAG identity in the clone |
| `WeakSet` | `lib.es2015.collection` | ✅ | Already used by `deepFreeze` (`catalog.ts:672`) |
| `Reflect.ownKeys` / `Reflect.getOwnPropertyDescriptor` | `lib.es2015.reflect` | ✅ (also named safe in `host.ts:48-49`) | Descriptor reads that do not invoke getters |
| `Object.getOwnPropertyDescriptors` | `lib.es2017.object` | ✅ | Available if the plan prefers a bulk descriptor read |
| `Object.getPrototypeOf` / `Object.create` | `lib.es5` | ✅ | Plain-object detection |
| `Array.isArray` | `lib.es5` | ✅ | Array detection — **proxy-transparent AND realm-transparent**, measured |
| `Object.prototype.toString` | `lib.es5` | ✅ | Realm-transparent `Date`/`Map`/`Set` tag |
| `Date` / `Map` / `Set` | `lib.es2015` | ✅ | Structural clone targets |
| `Object.freeze` / `Object.isFrozen` | `lib.es5` | ✅ | The freeze half of the default normalizer |
| `structuredClone` | — | ❌ **TS2304: Cannot find name 'structuredClone'** | **Not available.** Confirms CONTEXT's rejection and `types.ts:663`. |

**Verification commands run:**

```
tsc --version                                  # Version 7.0.2
tsc -p <probe with lib:["ES2022"], types:[]>   # exit 0 for every API above
tsc -p <probe using structuredClone>           # error TS2304
node --version                                 # v24.14.1
```

### Existing internal assets reused (no new code)

| Symbol | Location | Reuse |
|--------|----------|-------|
| `deepFreeze` | `catalog.ts:672` (exported, deliberately not barrelled) | **Available but see §"Do not run deepFreeze over the clone result"** — measured to freeze consumer objects that fell into the pass-through branch. |
| `warnHost` | `host.ts:93` | The only sanctioned `globalThis` read. Used for the register-over-live warn and the throwing-getter warn. |
| `assertSingleInstance` | `contract.ts:168` | Called from inside `createBridge`'s body. Measured **idempotent and free**: 100 000 calls in 0.89 ms (≈ 8.9 ns each), registry slot unchanged after. |
| `MESSAGE_MAX_CHARS` | `types.ts:279` → barrelled at `index.ts:116` | The off-page message bound. Value is **180**, confirmed. |
| `BridgeRegistry<B>` / `Bridge<A,S>` | `types.ts:1114` / `:1103` | Implemented, not designed. Already on the D-09 consumer-implemented list. |
| `no_bridge` | `types.ts:187` | Already one of the twelve closed `ReasonCode` members. Do not add a thirteenth. |
| `ResultsBridge` / `CartBridge` / `_registryReadIsNullable` | `test-d/actions.test-d.ts:416,419,436` | Ready-made type-test fixtures. |
| `_stageExplanationBridgeShape` | `test-d/concierge.test-d.ts:141` | Already pins `{id, registered} \| null` — Phase 5 must not move it. |

### Alternatives Considered

| Instead of | Could Use | Why rejected here |
|------------|-----------|-------------------|
| Hand-written structural clone | `structuredClone` | **TS2304 under `lib: ["ES2022"]`** — measured. Also throws `DataCloneError` on proxies and on functions — both measured this session. |
| Hand-written structural clone | `JSON.parse(JSON.stringify(v))` | Drops `undefined`, `Date` → string, `Map`/`Set` → `{}`, throws on cycles, and invokes `toJSON` — the exact silent-rehash failure `types.ts:690-698` already argues against for readback hashing. |
| Hand-written structural clone | An npm deep-clone package | Violates C1 outright. Not considered further. |
| Monotonic `number` token | `Symbol()` per registration | Works identically and is marginally harder to forge, but the token never leaves the closure so forgeability is not in the threat model. A `number` is what `ARCHITECTURE.md:279-289` specifies and what the ROADMAP note locks. |
| Monotonic `number` token | Comparing the returned unsubscriber's identity | Equivalent in effect, more indirection, and does not match the locked design. |

---

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.**

Core is dependency-free by constraint C1 in `CLAUDE.md` ("Core is dependency-free"), and
`package.json` declares exactly one runtime dependency, `@standard-schema/spec`, which is types-only
(0-byte runtime) and is unchanged by this phase. `scripts/pkg05-zero-runtime-deps.mjs` asserts the
empty external module graph and will continue to pass unmodified.

| Package | Registry | Disposition |
|---------|----------|-------------|
| *(none)* | — | No installs in Phase 5 |

**Packages removed due to slopcheck `[SLOP]` verdict:** none — no packages proposed.
**Packages flagged as suspicious `[SUS]`:** none — no packages proposed.

slopcheck was not run because there is nothing to check. If a plan iteration proposes any package,
that plan must run the Package Legitimacy Gate before the install task, and the planner must gate
it behind a `checkpoint:human-verify`.

---

## Architecture Patterns

### System Architecture Diagram

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │ APP / PAGE COMPONENT                    (Phase 9 adapters call this) │
  └───────────────┬─────────────────────────────────┬────────────────────┘
                  │ register({actions, snapshot})   │ unsub()
                  │ returns unsub                   │  (may fire LATE,
                  ▼                                 ▼   or TWICE, or after
  ┌──────────────────────────────────────────────────┐  a replacement)
  │ createBridge(id) closure          src/bridge.ts  │
  │  ┌────────────────────────────────────────────┐  │
  │  │ let slot: {token, bridge} | null = null     │  │
  │  │ let next = 0                                │  │
  │  └────────────────────────────────────────────┘  │
  │        │                    ▲                     │
  │        │ ++next             │ token === slot.token?
  │        │ slot = {token, b}  │   YES → slot = null
  │        │ (warn-once if      │   NO  → silent no-op   ◄── BRG-01 / BRG-04
  │        │  slot was live)    │                       │
  │        ▼                    │                       │
  │   Object.freeze(registry)  ─┴─ read() ────────────► │ B | null
  └──────────────────────────────────────────────────┬─┘
                                                     │
        ┌────────────────────────────────────────────┘
        │
        ▼  read()                                   ┌─────────────────────┐
  ┌───────────────────────────────┐                 │ StageDefinition     │
  │ resolveBridge(stage): B|null  │◄────────────────┤   .bridge?          │
  │   stage.bridge === undefined  │                 └─────────────────────┘
  │      → null   (DX-02: no      │
  │                instrumentation)│                 ┌─────────────────────┐
  │   try { read() } catch → null │────────────────►│ bridgeStatus(stage) │
  └──────────────┬────────────────┘                 │  → explain().bridge │
                 │                                   │    {id, registered} │
                 │  B | null                         └─────────────────────┘
                 ▼
  ┌────────────────────────────────────────────────────────────┐
  │ HANDLER   ctx.bridge: B | null                             │
  │   null? → offPageResult(...)  {ok:false, reason:"no_bridge"}│ ◄── BRG-03
  │   B?    → bridge.snapshot.query()   (LIVE getters)          │ ◄── BRG-02
  │        → bridge.actions.applyFilter(...)                    │
  └────────────────────────┬───────────────────────────────────┘
                           │  (Phase 8 consent path calls this)
                           ▼
  ┌────────────────────────────────────────────────────────────┐
  │ captureSnapshot(bridge, normalize)                          │
  │   for each key in bridge.snapshot:                          │
  │     try { normalize(snapshot[key]())  }  ◄── BOTH inside    │
  │     catch { value = undefined; warn once }   the try        │
  └────────────────────────┬───────────────────────────────────┘
                           ▼
  ┌────────────────────────────────────────────────────────────┐
  │ default normalizeSnapshot = structural CLONE, then freeze   │ ◄── BRG-05
  │   fires READ traps only: ownKeys, gopd, get                 │
  │   NEVER preventExtensions / defineProperty                  │
  └────────────────────────┬───────────────────────────────────┘
                           ▼
                  detached, frozen plain data
                  (Phase 8 hashes this for CON-04)
```

### Recommended Project Structure

```
packages/concierge/
├── src/
│   ├── bridge.ts          # NEW — createBridge, captureSnapshot, defaultNormalizeSnapshot,
│   │                      #       offPageResult. Imports ONLY ./types.js, ./host.js,
│   │                      #       ./contract.js — never ./concierge.js (would cycle).
│   ├── concierge.ts       # EDIT — resolveBridge seam; bridgeStatus routed through it
│   ├── types.ts           # EDIT — correct the two false "deep freeze" doc comments (:666, :1609)
│   └── index.ts           # EDIT — +2 value exports; correct stale prose at :27-36
├── test/
│   └── bridge.test.ts     # NEW — runtime suite against ../dist/index.js
└── test-d/
    ├── bridge.test-d.ts   # NEW — createBridge signature + variance pins
    └── exports.test-d.ts  # EDIT — +2 export-placement predicates
```

**Module-import direction is load-bearing.** `bridge.ts` must not import from `concierge.ts`.
`resolveBridge` reads `StageDefinition`, which is a stage concept, so it belongs in `concierge.ts`
even though it is conceptually "bridge" work. Inverting this creates an import cycle between the
two largest runtime modules and, under `isolatedDeclarations`, produces confusing TS9006/TS9007
diagnostics rather than a clean cycle error.

### Pattern 1: The monotonic-token registry closure

**What:** A factory returning a frozen object literal over closure-scoped mutable state.
**When to use:** This is the locked design; there is no alternative to evaluate.

```ts
// Source: .planning/research/ARCHITECTURE.md:279-289 (verbatim mechanism),
// adapted to this repo's isolatedDeclarations + frozen-capability requirements.
export function createBridge<B extends Bridge = Bridge>(id: string): BridgeRegistry<B> {
  assertSingleInstance();                       // inside the BODY — never module scope (C-contract 1)

  let slot: { token: number; bridge: B } | null = null;
  let next = 0;
  let warnedOverwrite = false;                  // warn-once latch, per registry instance

  const registry: BridgeRegistry<B> = {
    id,
    read: (): B | null => slot?.bridge ?? null,
    register: (bridge: B): (() => void) => {
      if (slot !== null && !warnedOverwrite) {
        warnedOverwrite = true;
        warnHost(/* house shape: concierge: [code] subject "id": problem Fix: fix */);
      }
      const token: number = ++next;             // ← monotonic. NOT the bridge object.
      slot = { token, bridge };
      return (): void => {
        if (slot?.token === token) {            // ← the whole trick
          slot = null;
        }
        // Token mismatch → silent, idempotent no-op. NO warn: StrictMode /
        // Vue HMR / Svelte remount produce these BY DESIGN.
      };
    },
  };

  return Object.freeze(registry);               // capability object — SEC-03 class
}
```

**Three properties measured this session:**
- `Object.freeze(registry)` makes `registry.read = evil` throw `TypeError: Cannot assign to read only property 'read'` in ESM strict mode, and makes `registry.extra = 1` throw. ✅
- Freezing the object does **not** freeze the closure — `register()` still mutates `slot` normally after the freeze. ✅ (This is obvious but worth a test, because "we froze it so it must be immutable" is exactly the reasoning `catalog.ts:601-607` calls "a breach that reports success".)
- `assertSingleInstance()` at the top of the body is idempotent across 100 000 calls at ≈8.9 ns each. ✅

### Pattern 2: Capture — where the `try/catch` actually goes

**What:** Invoke every getter in `bridge.snapshot`, pass each value through the normalizer.
**Critical detail, measured:** a getter *nested inside a returned value* throws from inside the
**normalizer**, not from the snapshot getter. A `try/catch` scoped to `snapshot[key]()` alone does
not catch it and the exception escapes to the caller — violating constraint C7.

```ts
// Both the invocation AND the normalize call must be inside the same try.
for (const key of Object.keys(bridge.snapshot)) {
  const getter = bridge.snapshot[key];
  if (getter === undefined) continue;           // noUncheckedIndexedAccess (C6)
  try {
    out[key] = normalize(getter());             // ← BOTH inside. Not just getter().
  } catch {                                     // ← binds nothing (C7)
    out[key] = undefined;
    warnOnce(id, key);                          // names the registry id and the key; echoes nothing caught
  }
}
```

Measured: `clone({ filters: { ok: 1, get boom() { throw new Error("SECRET user@example.com") } } })`
propagates the `Error` out of the clone. With the narrow `try`, that message reaches the caller —
and it is precisely the covert-PII-channel shape C7 forbids.

### Pattern 3: The default normalizer — structural clone, then freeze

```ts
// Detection order matters. Each line was measured against plain / proxied /
// cross-realm instances of its target.
function defaultNormalizeSnapshot<T>(value: T): T { /* entry; delegates to the walk below */ }

function walk(v: unknown, seen: WeakMap<object, unknown>): unknown {
  if (typeof v !== "object" || v === null) return v;      // primitives + null pass through
  const obj: object = v;
  const hit = seen.get(obj);
  if (hit !== undefined) return hit;                       // cycles AND DAG identity

  // 1. ARRAYS — Array.isArray is proxy-transparent AND realm-transparent (measured).
  //    `instanceof Array` is NOT realm-transparent (measured false cross-realm).
  if (Array.isArray(obj)) { /* fresh [], seen.set BEFORE recursing, freeze at end */ }

  // 2. Date / Map / Set — `instanceof || toString-tag`, wrapped in try/catch.
  //    instanceof  is proxy-transparent, NOT realm-transparent
  //    toString-tag is realm-transparent, NOT proxy-transparent for Date
  //    Neither alone is complete; the union covers both. See the measured matrix below.
  //    The try/catch is MANDATORY: a naively proxied Date/Map/Set THROWS on every
  //    extraction route (measured, six routes, all TypeError).

  // 3. PLAIN OBJECTS — proto === Object.prototype || proto === null.
  //    Proxy-transparent (measured true through a Proxy).
  //    NOT realm-transparent (measured false) — cross-realm plain objects fall
  //    through to pass-through. That is the safe direction and is the documented limit.
  //    Read via v[k] ([[Get]]) so getters are INVOKED — that is the detachment.

  // 4. EVERYTHING ELSE — returned BY REFERENCE, unfrozen. Documented on the export.
}
```

### Anti-Patterns to Avoid

- **Anti-Pattern 6 (ARCHITECTURE.md:950) — identity-guarding on the bridge object.**
  `if (slot?.bridge === bridge) slot = null`. Measured: passes ten of thirteen orderings including
  both of the two most natural tests. Fails exactly when a component re-registers an object that is
  `===` its previous one.
- **Deep-freezing the snapshot instead of cloning it.** Three measured failure modes; see the
  matrix below. Two of them are worse than "does not detach".
- **Running `deepFreeze` over the clone's result as a belt-and-braces pass.** Measured: it freezes
  the consumer's own objects that fell into the pass-through branch. This is the same visible
  side effect `catalog.ts:653-657` records for `jsonSchema`, but there it was an accepted
  consequence of the object having *become the agent-facing contract*. A snapshot value is not that;
  freezing a consumer's live model object is a bug. The clone already freezes every node it creates.
- **Normalizing inside `register()` or `read()`.** Both break BRG-02. Locked by CONTEXT.
- **Warning on a refused unsubscriber.** Fires on every React StrictMode dev mount. Locked by CONTEXT.
- **A module-scope token counter.** Cross-request pollution under SSR — the correction
  `concierge.ts:17-35` had to make twice.
- **Adding `__resetForTest()` to the registry.** ARCHITECTURE.md item H suggests it; it is
  unnecessary here and would break the "+2 values" export pin. The factory *is* the reset: each test
  calls `createBridge("x")` and gets fresh closure state.

---

## The Six Questions the Plan Needs Answered

### Q1 — The default `normalizeSnapshot`

#### Freeze vs Clone: the measured matrix

Every cell below was executed this session on Node v24.14.1. `deepFreezeNaive` is a faithful
replication of `catalog.ts:672-698` including its `"value" in descriptor` accessor skip.

| Proxy shape | `Object.freeze` outcome | Detached? | Collateral damage |
|---|---|---|---|
| **A — forwarding proxy** (traps → `Reflect` on target; target holds the values) | succeeds; fires `preventExtensions`, `ownKeys`, `gopd:*`, `defineProperty:*` | "yes" — but only because… | **🔴 the app's own store is now frozen solid.** `Object.isFrozen(target) === true`; the app's next `store.q = "boots"` throws `TypeError`. |
| **B — signal-backed proxy** (truth behind the trap; target is a husk) | **🔴 throws** `TypeError: 'ownKeys' on proxy: trap returned extra keys but proxy target is non-extensible` | n/a — capture crashed | The exception escapes the capture path |
| **E — read-only view proxy** (`preventExtensions` returns true, target stays extensible) | **🔴 throws** `TypeError: 'preventExtensions' on proxy: trap returned truish but the proxy target is extensible` | n/a | The exception escapes |
| **F — accessor-backed proxy** (target's props are accessors over a live store; all traps forward honestly) | succeeds silently, **no throw, no collateral** | **🔴 NO** — reads `"boots"` after the app moves | none — and that is what makes it dangerous |
| **C — plain object carrying a getter** (no proxy at all) | succeeds silently | **🔴 NO** — accessor skipped, stays live | none |

| Same shapes, clone-then-freeze | Traps fired | Detached? | Collateral |
|---|---|---|---|
| A | `ownKeys`, `gopd:q`, `gopd:page`, `get:q`, `get:page` — **read traps only** | ✅ yes | ✅ none; `Object.isFrozen(target) === false`, app still writable |
| B | read traps only | ✅ yes | ✅ none |
| F | `ownKeys`, `gopd:*`, `get:*` | ✅ yes | ✅ none |
| C | invokes the getter once | ✅ yes | ✅ none |

**The mechanism in one sentence:** cloning fires only *read* traps
(`ownKeys` / `getOwnPropertyDescriptor` / `get`); freezing fires *write* traps
(`preventExtensions` / `defineProperty`). This sentence belongs in the doc comment that replaces
the false one at `types.ts:1609`.

**Shape F is the fixture the criterion-4 test must use.** It is the only hand-rolled `Proxy` shape
under which the deep-freeze mutant produces a *visible, non-throwing* failure — the test reads
`"boots"` where it asserted `"shoes"`. Shapes B and E would make the mutant throw, which still fails
the test but for a reason that reads as "the proxy is malformed" rather than "the normalizer does
not detach". Shape A would make the mutant *pass* while destroying the app, which is the worst
possible outcome for a validation suite.

```ts
// The Shape F fixture, verbatim from the measured script. Hand-rolled, in core, no adapter.
function makeReactiveStore() {
  const backing: Record<string, unknown> = { q: "shoes", page: 1 };
  const target: Record<string, unknown> = {};
  for (const k of Object.keys(backing)) {
    Object.defineProperty(target, k, {
      get: () => backing[k],
      set: (v) => { backing[k] = v; },
      enumerable: true,
      configurable: true,
    });
  }
  const proxy = new Proxy(target, {
    get: (t, k, r) => Reflect.get(t, k, r),
    set: (t, k, v, r) => Reflect.set(t, k, v, r),
    ownKeys: (t) => Reflect.ownKeys(t),
    getOwnPropertyDescriptor: (t, k) => Reflect.getOwnPropertyDescriptor(t, k),
    defineProperty: (t, k, d) => Reflect.defineProperty(t, k, d),
    preventExtensions: (t) => Reflect.preventExtensions(t),
  });
  return { proxy, backing };   // test writes through `backing`, asserts the snapshot did not move
}
```

#### The clone algorithm, specified precisely

**Cycle safety and DAG identity — `WeakMap`, not `WeakSet`.** `deepFreeze` uses a `WeakSet` because
it only needs "have I walked this". A clone needs "what did I produce for this", so the map's value
is the output node. Measured: `cyc.self = cyc` → `c1.self === c1` ✅; and a shared node reached
twice (`{l: shared, r: shared}`) → `c2.l === c2.r` ✅ **and** `c2.l !== shared` ✅. The `seen.set`
must happen **before** recursing into children or a self-referencing node recurses forever.

**Plain-object detection.** `Object.getPrototypeOf(v) === Object.prototype || === null`.

| Case | proto test | Verdict |
|---|---|---|
| `{a:1}` | ✅ true | cloned |
| `Object.create(null)` | ✅ true | cloned — **the null-prototype case is handled by the `\|\| null` arm; omitting it silently passes through a record built with `Object.create(null)`, which is exactly the shape `catalog.byName` uses** |
| `new Proxy({a:1}, {})` | ✅ true | cloned — **proxy-transparent, measured** |
| class instance | ❌ false | passed through by reference (documented limit) |
| `Object.create({})` | ❌ false | passed through |
| **cross-realm `{a:1}`** | ❌ **false** | **passed through by reference — the documented limit.** Measured via `node:vm`. |

The cross-realm miss is the *safe* failure direction: the value is handed back untouched rather than
mangled. It is not the safe direction for BRG-05 — a cross-realm reactive store would not be
detached — but a reactive store in another realm is not a shape any of the three target frameworks
produce. **Document it on the export; do not chase it.** Adding a
`Object.prototype.toString.call(v) === "[object Object]"` fallback would catch it, but the same
predicate is `true` for class instances and for `Object.create({})`, so it would start cloning
things CONTEXT explicitly decided to pass through.

**Array detection — `Array.isArray`, not `instanceof Array`.** Measured:

| | `instanceof Array` | `Array.isArray` |
|---|---|---|
| plain `[1,2]` | true | true |
| `new Proxy([1,2],{})` | true | ✅ true |
| cross-realm `[1,2]` | **false** | ✅ **true** |

`Array.isArray` is the only one that is both proxy- and realm-transparent.

**`Date` / `Map` / `Set` detection — `instanceof` OR the `toString` tag, and neither alone.**
This is a genuine surprise and it is measured:

| value | `v instanceof C` | `toString === "[object C]"` | union |
|---|---|---|---|
| `new Date(0)` | ✅ | ✅ | ✅ |
| `new Proxy(new Date(0), {})` | ✅ | ❌ **false — reports `[object Object]`** | ✅ |
| cross-realm `new Date(0)` | ❌ **false** | ✅ | ✅ |
| `new Map(...)` | ✅ | ✅ | ✅ |
| `new Proxy(new Map(...), {})` | ✅ | ✅ | ✅ |
| cross-realm `new Map(...)` | ❌ **false** | ✅ | ✅ |

A `Proxy` over a `Date` reports `[object Object]` because `Object.prototype.toString` checks
internal slots and a proxy has no `[[DateValue]]`; `instanceof` walks the prototype chain, which the
proxy forwards. The two predicates are blind in exactly opposite directions.

**🔴 The `Date`/`Map`/`Set` clone MUST be wrapped in `try/catch`.** A naively proxied `Date` is
unextractable through the proxy by *every* route — six were measured, all `TypeError`:

```
pd.getTime()                     -> TypeError: this is not a Date object.
Number(pd)                       -> TypeError: this is not a Date object.
+pd                              -> TypeError: this is not a Date object.
pd.valueOf()                     -> TypeError: this is not a Date object.
pd.toISOString()                 -> TypeError: Method Date.prototype.toISOString called on incompatible receiver
Date.prototype.getTime.call(pd)  -> TypeError: this is not a Date object.
```

`new Map(proxiedMap)` fails the same way:
`TypeError: Method Map.prototype.entries called on incompatible receiver #<Map>`.

A reactive proxy that **binds methods to the target** — which is what Vue's `reactive` does for
collections — works fine: `new Map(boundProxy)` succeeded and produced a distinct `Map`. So the
throw is a property of naive proxying, not of proxying in general, and cannot be assumed away.
The `catch` should fall back to pass-through-by-reference (the documented limit) rather than
propagating.

**Freezing a `Date`, `Map` or `Set` is cosmetic — measured:**

```
Object.freeze(new Map([["a",1]])).set("b",2)  -> SUCCEEDED, size now 2
Object.freeze(new Set([1])).add(2)            -> SUCCEEDED, size now 2
Object.freeze(new Date(0)).setTime(5)         -> SUCCEEDED, now 5
```

This is the same finding `catalog.ts:260-268` already records as "a frozen `Map` is not frozen" and
which `concierge.ts:405-420` cites when choosing a `Map` for the memo. The clone still delivers the
property BRG-05 asks for — **detachment**, a distinct object the app cannot reach — but it does not
deliver immutability for these three types. State that on the export; do not claim more.

**Symbol keys.** `Object.keys` returns enumerable string keys only. The plan should state whether
symbol-keyed properties are carried. Recommendation: **do not carry them** — a snapshot is a
payload that Phase 8 will hash and Phase 6 will serialize, and `Reflect.ownKeys` would pull in
framework-internal symbols (Vue's `__v_raw`, Svelte's internal markers) that are meaningless in a
hash and are exactly the "framework reactivity" BRG-05 wants gone. This is Claude's-discretion
territory but should be an explicit line in the plan, not an omission.

### Q2 — Freezing a getter-bearing snapshot

**Confirmed: no path through the freeze invokes a live getter.** Four measurements:

| # | Operation | Getter invocations | Note |
|---|---|---|---|
| A | `deepFreeze` (catalog.ts logic) over an object carrying an accessor | **0** | The `"value" in descriptor` skip is exact. The accessor *survives* the freeze and stays live. |
| B | `Object.freeze` directly on the accessor holder | **0** | `Object.freeze` itself never reads values. |
| C | The **clone** over the same object | **1** | This is intentional — invoking the getter *is* the detachment. Result carries a data property, not an accessor. |
| D | `deepFreeze` over the **cloned** result | **0** | All data properties by construction. |

So the capture path's interaction is exactly as CONTEXT anticipates: after capture the values are
plain data and a normal deep freeze over them is safe. **But there are two consequences worth
stating in the plan rather than leaving implicit:**

1. **The accessor skip is why a deep freeze cannot detach.** `deepFreeze` never invokes a getter,
   so it never converts an accessor into data — it just makes the accessor non-configurable. That is
   the mechanism behind Shape C and Shape F above. The property `catalog.ts` documents as a *safety*
   feature ("executing application code during catalog build" is bad) is, in this phase, precisely
   the reason the deep-freeze default is inert. Same property, opposite valence. Worth one sentence
   in `bridge.ts`'s header so a future reader does not "fix" one by breaking the other.
2. **🔴 Do not run `deepFreeze` over the clone result.** Measured: with a class instance in the
   pass-through branch, `deepFreeze(cloneResult)` returned with `Object.isFrozen(consumerInstance)
   === true`. The clone already calls `Object.freeze` on every node it constructs, so a second pass
   adds nothing except a visible side effect on objects the consumer still holds and did not hand
   over. Reject the belt-and-braces pass explicitly in the plan so a reviewer does not add it.

### Q3 — The monotonic token guard: the complete ordering matrix

Thirteen orderings, run against three implementations: **token** (correct), **object-guarded**
(Anti-Pattern 6), and **naive** (unconditional clear). `A` and `B` are distinct bridge objects;
`u1`/`u2`/`u3` are the unsubscribers returned by the first/second/third `register` call.

| # | Ordering | token (CORRECT) | object-guarded | naive |
|---|---|---|---|---|
| O1 | StrictMode, SAME object: `reg A(u1); u1(); reg A(u2)` | **A** | A | A |
| O1b | O1, then the stale `u1` fires again | **A** | 🔴 null | 🔴 null |
| O2 | late cleanup after replacement: `reg A(u1); reg B; u1()` | **B** | B | 🔴 null |
| O2b | SAME-object replacement: `reg A(u1); reg A(u2); u1()` | **A** | 🔴 null | 🔴 null |
| O3 | double-invoke: `reg A(u1); u1(); u1(); reg B` | **B** | B | B |
| O3b | double-invoke across a replacement: `reg A(u1); u1(); reg B; u1()` | **B** | B | 🔴 null |
| O4 | replace-then-restore, B's cleanup: `reg A; reg B(u2); reg A; u2()` | **A** | A | 🔴 null |
| O4b | replace-then-restore, FIRST A's cleanup: `reg A(u1); reg B; reg A(u3); u1()` | **A** | 🔴 null | 🔴 null |
| O4c | O4b with the SAME object throughout: `reg A(u1); reg A; reg A(u3); u1()` | **A** | 🔴 null | 🔴 null |
| O5 | normal unsubscribe of the LIVE registration: `reg A; reg B(u2); u2()` | **null** | null | null |
| O6 | never registered | **null** | null | null |
| O7 | register then its own cleanup: `reg A(u1); u1()` | **null** | null | null |
| O8 | three components, middle unmounts late: `reg A(u1); reg B(u2); reg A(u3); u2()` | **A** | A | 🔴 null |

**Orderings that discriminate the object-identity defect (Anti-Pattern 6) — exactly four:**
**O1b, O2b, O4b, O4c.** Every one requires a stale unsubscriber to fire *after* a replacement whose
bridge object is `===` the one that unsubscriber captured. **At least one of these must be in the
suite or BRG-04 is unvalidated.** O2b is the minimal spelling and is the one the ROADMAP note
describes; O4b is the more realistic one (a component unmounting late after a sibling has come and
gone) and uses distinct objects, which makes it harder to dismiss as a contrived case. Recommend
both.

**Orderings that discriminate the unconditional-clear defect — eight:**
O1b, O2, O2b, O3b, O4, O4b, O4c, O8.

**🔴 Orderings that discriminate NEITHER defect — five: O1, O3, O5, O6, O7.** These produce
identical results on all three implementations. Under this project's standard
(`05-CONTEXT.md` § Specific Ideas: "Each of the five success criteria needs a test that fails when
the guard is removed") they are **contract pins, not validation**. They are still worth writing —
O5/O6/O7 pin the ordinary happy path and O1 pins the StrictMode shape a reader will look for — but
the plan must label them as non-discriminating in the test file, exactly as Phase 4 had to when its
verification found "three non-discriminating criteria closed by re-measurement" (commit `565f93e`).
Counting O1 or O3 toward BRG-01/BRG-04 coverage would be the false-coverage failure
`export-surface.test.ts`'s Trap 2 header already warns about.

### Q4 — `assertSingleInstance` inside `createBridge`

**Safe. Confirmed on all four axes.**

| Property | Evidence |
|---|---|
| **Idempotent** | 100 000 consecutive calls, no throw. Registry slot unchanged: `{"version":1}`. The same-version adopt path (`contract.ts:177-179`) returns immediately. |
| **Cheap** | 0.887 ms for 100 000 calls ≈ **8.9 ns per call**. Irrelevant against a `register()` that runs once per component mount. |
| **No module-scope evaluation** | The call sits in `createBridge`'s body. `contract.ts:109-113` requires exactly this; `contract.ts:159-163` explicitly reserves the adapter-registration call site and states it "inherits nothing from this one". |
| **Order-independent** | Whichever entry point runs first seeds `globalThis[Symbol.for("@fullselfbrowsing/concierge.contract")]`; the second adopts. **There is no hazard if `createBridge` runs before `buildCatalog`** — that is the case the reserved call site exists for. |

**One consequence to record, not a blocker.** A consumer will idiomatically write
`export const resultsBridge = createBridge("results")` at *their* module scope. That is fine for the
`"sideEffects": false` concern (the call is in core's function body, not core's module body), but it
means a **contract-version mismatch now throws during the consumer's module evaluation**, which is
the failure shape `contract.ts:125-131` argues against for core's own module scope: "an import-time
throw in ESM surfaces as a module-evaluation error with no useful frame, and under a
metaframework's SSR it takes down the whole render rather than the one feature." The trade is still
correct — a mismatch is unrecoverable and `bridge: null` forever is worse — but the plan should put
one sentence in `createBridge`'s doc comment acknowledging it, because a reader who knows
`contract.ts` will otherwise think the rule was forgotten rather than weighed.

**A second, separate SSR consequence** (ARCHITECTURE.md item H): a registry created at consumer
module scope has a **process-global slot** under SSR. If anything ever calls `register()` on the
server, that registration leaks into the next request. It is currently safe only because
registration happens in effects that never run on the server — "an invariant nobody has written
down." See Open Question 1.

### Q5 — Export-surface baseline

**Measured against the built artifact in this session, not read from a plan.**

```
node -e "parse dist/index.d.ts trailing export block"
  blocks 1   names 62   types 51   values 11
```

| Pin | File:line | Current value | After Phase 5 (+2 values) |
|---|---|---|---|
| total names | `test/export-surface.test.ts:136` | `toHaveLength(62)` | **64** |
| types | `test/export-surface.test.ts:141` | `toHaveLength(51)` | **51** (unchanged) |
| values | `test/export-surface.test.ts:142` | `toHaveLength(11)` | **13** |
| `it` title | `test/export-surface.test.ts:134` | `"is exactly 62 names…"` | **64** — the title carries the number |
| `it` title | `test/export-surface.test.ts:139` | `"splits 51 types to 11 values"` | **"51 types to 13 values"** |
| `it` title | `test/export-surface.test.ts:145` | `"carries all eleven runtime value exports by name"` | **"thirteen"** — the file header at `:101-105` explicitly warns this title's number can only be checked against the array |
| `VALUE_EXPORTS` array | `test/export-surface.test.ts:106-122` | 11 entries (below) | **13 entries** |

**The exact current `VALUE_EXPORTS` contents (source order, as written in the file):**

```
USER_CANCELLED, USER_DECLINED, CONSENT_GRADE_ORDER, MESSAGE_MAX_CHARS,
CONTRACT_VERSION, assertSingleInstance, JSON_SCHEMA_TARGET, defineAction,
buildCatalog, CatalogValidationError, createConcierge
```

The parsed surface from `dist/index.d.ts` is alphabetized by rolldown and matches as a set:
`["CONSENT_GRADE_ORDER","CONTRACT_VERSION","CatalogValidationError","JSON_SCHEMA_TARGET","MESSAGE_MAX_CHARS","USER_CANCELLED","USER_DECLINED","assertSingleInstance","buildCatalog","createConcierge","defineAction"]`.
The test uses `expect(values).toContain(name)` per entry, so order does not matter — but the count
assertions do.

**What `test-d/exports.test-d.ts` pins.** Six export-*placement* predicates, all reading from
`../src/index.js` (line 72) — never `../src/types.js`:

| Line | Alias | Predicate |
|---|---|---|
| 79 | `_messageBoundExportedAsValue` | `Equals<typeof MESSAGE_MAX_CHARS, 180>` |
| 86 | `_jsonSchemaTargetExportedAsValue` | `Equals<typeof JSON_SCHEMA_TARGET, "draft-2020-12">` |
| 89 | `_defineActionExportedAsValue` | `Assignable<typeof defineAction, (...args: never[]) => unknown>` |
| 92 | `_buildCatalogExportedAsValue` | `Assignable<typeof buildCatalog, …>` |
| 95 | `_catalogValidationErrorExportedAsValue` | `Assignable<typeof CatalogValidationError, new (...args: never[]) => Error>` |
| 102 | `_createConciergeExportedAsValue` | `Assignable<typeof createConcierge, …>` |

Phase 5 adds two: one for `createBridge` and one for the off-page helper, both on the shared import
line at `:72`, both using the deliberately-loose `(...args: never[]) => unknown` form. The file's
header (`:53-61`) states the rule the plan must follow: **the diagnostic is TS1485 on the shared
IMPORT line, naming the symbol — not TS2344 on the predicate line.** The header sentence "Phase 3
added four more … Phase 4 added `createConcierge`, bringing the total to six" must be updated to
eight, or it becomes the same class of stale shipped prose the pending todo is about.

**Tight signature pins go elsewhere.** `test-d/exports.test-d.ts:63-69` explicitly forbids
tightening its predicates. `createBridge`'s real signature belongs in the new
`test-d/bridge.test-d.ts`, matching how `_createConciergeSignature` lives in
`test-d/concierge.test-d.ts:152`.

### Q6 — `MESSAGE_MAX_CHARS`: value and placement

**Value: `180`. Declared at `packages/concierge/src/types.ts:279`, re-exported through
`packages/concierge/src/index.ts:116`.** Both verified by grep and by the runtime probe
(`dist/index.js` exports it at `180` — `test/artifact.test.ts:44-46` asserts this).

**The Phase 1 deferred item this question refers to is already closed, and the plan should not
re-open it.** STATE.md § Deferred Items records: *"The guard must import from `../src/index.js` —
`results.test-d.ts`'s existing `_messageBound` imports from `../src/types.js` and cannot see this
regression."* That guard landed in Phase 2 as `test-d/exports.test-d.ts`, whose line 72 imports from
`../src/index.js` with the inline comment `← index.js. NOT types.js. This is the whole point.`

The two files are deliberately *both* present and neither replaces the other:

| File | Imports from | Pins | Blind to |
|---|---|---|---|
| `test-d/results.test-d.ts:21,108` | `../src/types.js` | the literal type at the **declaration** | export placement — exits 0 under the mutation |
| `test-d/exports.test-d.ts:72,79` | `../src/index.js` | export **placement** at the public entrypoint | nothing relevant here |

**So for Phase 5: the off-page helper must import `MESSAGE_MAX_CHARS` from `./types.js`** (the
declaration module, the normal intra-package import) — that is a runtime import inside `src/`, not a
guard, and the guard question does not apply to it. What *does* apply: the two new export-placement
predicates go in `exports.test-d.ts` (reading `../src/index.js`), and any tight signature pin for
the helper goes in `bridge.test-d.ts`. Do not add a `MESSAGE_MAX_CHARS` predicate to
`bridge.test-d.ts` importing from `types.js` — that would recreate the exact blind guard STATE.md
warns about.

**Bounding, not sanitizing.** Candidate sentences measured against the 180 bound:

```
115 chars  OK    "The results page is not open, so its filters and result count are
                  unavailable. Open the results page and try again."
120 chars  OK    "Nothing has registered the "results" bridge, so this action cannot
                  read the page. Open the results page, then ask again."
218 chars  OVER  (a sentence that explains the mechanism instead of the remedy)
```

Both passing candidates satisfy DX-03's what-*and*-what-to-do standard with ~60 characters of
headroom for a caller-supplied "where". The bound is enforced by truncation at 180 (`slice(0, 180)`
was measured lossy on the over-long candidate, as intended). **Phase 5 must not strip control
characters or collapse whitespace** — that is SEC-06 and belongs to Phase 6.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Freezing a nested structure | A six-line recursive freeze in `bridge.ts` | `deepFreeze` from `catalog.ts:672` **— but only if a deep freeze is actually wanted, which per Q2 it is not here** | `catalog.ts:665-670` already argues this: a re-implementation must independently rediscover a cycle-safe `WeakSet`, an accessor skip that does not invoke getters, and the refusal to early-out on `Object.isFrozen`. "It rediscovers them as bug reports." |
| Warning the developer | `console.warn` directly | `warnHost` (`host.ts:93`) | `console` is TS2304 under `lib: ["ES2022"]`. `host.ts` is the *only* sanctioned structural `globalThis` read and its header states every convention a second one must keep. |
| Detecting two core copies | A version constant compared by hand | `assertSingleInstance()` (`contract.ts:168`) | The `Symbol.for` cross-realm slot, the adopt-on-same-version path, and the "throw from the body, never module scope" rule are all non-obvious and already argued. |
| Structural cloning | A `JSON` round-trip, or an npm package | The hand-written walk specified in Q1 | `structuredClone` is TS2304; `JSON` drops `undefined`/`Date`/`Map`/`Set`, throws on cycles, and honours `toJSON`; a package violates the zero-dependency constraint. |
| Message-length policy | A new constant | `MESSAGE_MAX_CHARS` (`types.ts:279`) | It is the shared contract between Phase 5's bound and Phase 6's SEC-06 truncation. A second constant means two numbers that can drift. |
| The house message shape | An ad-hoc string | `concierge: [code] subject "x": problem Fix: fix` (`concierge.ts:173-181`, `catalog.ts:580-584`) | Two existing renderers already use it; a third shape makes the warn channel unparseable. |

**Key insight:** every "just write six lines" temptation in this phase has already been written
somewhere in this package, argued in a doc comment, and had its edge cases measured. The genuinely
new code is exactly three things — the token closure, the capture loop, and the clone — and each is
new because nothing existing does it.

---

## Common Pitfalls

### Pitfall 1 — Testing the identity guard with an ordering that cannot fail

**What goes wrong:** The suite contains "React StrictMode: mount, unmount, mount" and "double-invoke
the unsubscriber", both go green, BRG-01 and BRG-04 are marked covered — and the object-identity
defect ships.
**Why it happens:** Those are the two orderings a developer thinks of first, and both are
non-discriminating (measured: O1 and O3 give identical results on all three implementations).
**How to avoid:** Include at least O2b and O4b. Run `scripts/mutate-and-prove.sh` with the
object-identity mutant and confirm the gate fires.
**Warning signs:** A BRG-04 test that never registers the *same object twice* and never fires a
cleanup *after* a replacement.

### Pitfall 2 — Criterion-4's fixture makes the mutant throw instead of fail

**What goes wrong:** The hand-rolled proxy is a signal-backed one (Shape B); under the deep-freeze
mutant the capture path throws `TypeError: 'ownKeys' on proxy: trap returned extra keys…`. The test
fails, so the mutation "passes" — but it proved the proxy is malformed, not that the normalizer
detaches. Worse, under the real implementation the same fixture may mask a partial defect.
**Why it happens:** Signal-backed is the intuitive way to hand-roll a reactive proxy.
**How to avoid:** Use Shape F (accessor-backed, honest traps). Measured to make the mutant fail
*by returning the wrong value*, with no throw and no collateral damage.
**Warning signs:** A mutation-battery PASS whose captured output contains the word `TypeError`.
`mutate-and-prove.sh`'s Known Limitation 2 is exactly this — "a PASS that never ran a test is worse
than a FAIL."

### Pitfall 3 — The `try/catch` scoped to the getter, not to the normalizer

**What goes wrong:** A getter returns `{ ok: 1, get boom() { throw new Error(userEmail) } }`. The
outer getter does not throw; the *clone* does, while reading `boom`. The `Error` escapes capture and
its message — which echoes user input — reaches the caller.
**Why it happens:** `try { out[k] = snapshot[k]() } catch {}` reads as complete.
**How to avoid:** `try { out[k] = normalize(snapshot[k]()) } catch {}`. Measured: the narrow form
propagates.
**Warning signs:** Any test fixture whose nested getter throws is absent from the suite.

### Pitfall 4 — Deep-freezing the clone result "to be safe"

**What goes wrong:** `deepFreeze(cloneResult)` freezes the consumer's own objects that fell into
the pass-through branch. Measured: `Object.isFrozen(consumerClassInstance) === true` afterwards.
The consumer's model object becomes read-only and their next write throws in *their* code.
**Why it happens:** "The clone froze each node, but let's be certain."
**How to avoid:** The clone's per-node `Object.freeze` is complete for everything it constructs.
Pass-through values are, by definition, not ours to freeze.
**Warning signs:** A second walk over the normalizer's output anywhere in `bridge.ts`.

### Pitfall 5 — A `Date` behind a proxy crashes the capture

**What goes wrong:** `new Date(v.getTime())` on a proxied `Date` throws `TypeError: this is not a
Date object`. Every extraction route was measured to throw.
**How to avoid:** Wrap the `Date`/`Map`/`Set` branch in `try/catch` and fall back to
pass-through-by-reference.
**Warning signs:** The `Date`/`Map`/`Set` branch has no `catch`.

### Pitfall 6 — Module-scope token counter

**What goes wrong:** `let next = 0` outside `createBridge`. Two registries share the counter
(harmless), but under SSR the counter and any adjacent state persist across requests.
**How to avoid:** Every mutable binding is a `let` inside the factory body. This is the correction
`concierge.ts:17-35` had to make twice and re-justify once when the original bundler-based reason
turned out not to reproduce.
**Warning signs:** Any `let` or `Map` at module scope in `src/bridge.ts`.

### Pitfall 7 — The stale-count first-run failure

**What goes wrong:** The plan writes `toHaveLength(64)` but the `it` title still says 62, or
`VALUE_EXPORTS` gains one entry instead of two. First `pnpm test` run fails.
**How to avoid:** Seven pins move together — three counts, three `it` titles, one array — plus two
new predicates and one header sentence in `exports.test-d.ts`. The table in Q5 is the checklist.

### Pitfall 8 — `mutate-and-prove.sh` mutating a doc comment

**What goes wrong:** The chosen literal occurs once in code and three more times in a doc comment.
`perl -0pi` replaces the *first* occurrence, which is in the comment. The suite stays green and the
run is recorded as "FAIL: mutant escaped" — the inverse of the truth.
**How to avoid:** Known Limitation 3 in the script header: **count occurrences unfiltered**, with
comments left in. Given how heavily commented `src/` is in this repo, this is a near-certainty for
short patterns like `slot = null`.

---

## Code Examples

### Routing `bridgeStatus` through the new `resolveBridge` seam

CONTEXT specifies `resolveBridge` as **internal**, and the export surface grows by exactly two
*values* — neither of which is `resolveBridge`. That creates a real tension: `test/*.test.ts` imports
`../dist/index.js` only, so an unexported `resolveBridge` has no reachable caller in the runtime
suite and its behaviour cannot be observed at the layer the project tests at.

**Recommendation:** put `resolveBridge` in `concierge.ts` as a module-private function and make
`bridgeStatus` — today the *only* `read()` call site (`concierge.ts:222-238`) — call it. Then
`explain()` exercises the seam, the runtime suite reaches it through the public surface, and Phase 6's
`dispatch` becomes its second caller rather than a parallel re-implementation.

```ts
/**
 * The one place a stage becomes a bridge. Phase 6's dispatcher is the second
 * caller; there must never be a third, for the same reason `stage.match` is
 * called from exactly one place (header constraint 3).
 *
 * `read()` is consumer code, so it is guarded exactly as `match` is — a
 * throwing `read()` is not a registration.
 */
function resolveBridge<B extends Bridge>(stage: StageDefinition<B>): B | null {
  const registry: BridgeRegistry<B> | undefined = stage.bridge;
  if (registry === undefined) {
    return null;                        // DX-02: no bridge declared is a supported configuration
  }
  try {
    return registry.read();
  } catch {
    return null;                        // binds nothing, echoes nothing (C7)
  }
}

function bridgeStatus(stage: ConciergeConfig["stages"][number]): StageExplanation["bridge"] {
  const registry = stage.bridge;
  if (registry === undefined) {
    return null;                        // ← the THREE-state distinction survives: "no bridge
  }                                     //   declared" is not "declared but unmounted"
  const live = resolveBridge(stage);
  return { id: registry.id, registered: live !== null };
}
```

**Note the ordering:** `bridgeStatus` must check `stage.bridge === undefined` *before* calling
`resolveBridge`, because `resolveBridge` collapses "not declared" and "declared but unmounted" into
the same `null`. `explain()`'s row distinguishes them and `types.ts:1452` pins that distinction.
Collapsing it would silently change `explain()`'s output for a stage with no bridge from `null` to
`{id: …, registered: false}` — and there is no `id` to put there.

**If the planner prefers to keep `bridgeStatus` untouched**, the alternative is to test the seam
indirectly by asserting `explain().stages[i].bridge.registered` flips with registration state. That
is weaker (it proves `read()` is called, not that the seam exists) and it leaves Phase 6 free to
write a second resolution path. State whichever choice is made in the plan; do not leave it to the
executor.

### The off-page helper

```ts
/**
 * The sentence a handler returns when its stage's bridge is not mounted.
 *
 * Bounded by MESSAGE_MAX_CHARS, NOT sanitized — control-character stripping and
 * whitespace collapsing are SEC-06 and land at the dispatcher boundary in Phase 6.
 * Doing either here would put the same policy in two places, and the dispatcher's
 * is the one that governs every message rather than only this one.
 */
export function offPageResult(what: string, where: string): ActionResult {
  const message: string = `${what} ${where}`;
  return {
    ok: false,
    reason: "no_bridge",
    message: message.length > MESSAGE_MAX_CHARS ? message.slice(0, MESSAGE_MAX_CHARS) : message,
  };
}
```

`reason: "no_bridge"` is already one of the twelve closed `ReasonCode` members (`types.ts:187`).
The `ActionResult` return annotation is required by `isolatedDeclarations` (C4).

### The Shape F criterion-4 test

```ts
it("BRG-05 — a snapshot captured from a proxy-backed store does not move when the store moves", () => {
  const { proxy, backing } = makeReactiveStore();          // Shape F, above
  const bridge = { actions: {}, snapshot: { filters: () => proxy } };
  const registry = createBridge<typeof bridge>("results");
  registry.register(bridge);

  const captured = captureSnapshot(registry.read()!);      // or via the public seam
  expect(captured.filters.q).toBe("shoes");

  backing["q"] = "boots";                                  // the app moves

  expect(captured.filters.q).toBe("shoes");                // ← FAILS under the deep-freeze mutant
  expect(proxy.q).toBe("boots");                           // ← the live store DID move
  expect(Object.isFrozen(proxy)).toBe(false);              // ← and we did not freeze the app
});
```

The third assertion is the one that separates "detached" from "detached by breaking the app". Under
Shape A + a deep freeze, assertions 1–2 pass and assertion 3 is the only detector.

---

## Runtime State Inventory

Phase 5 is not a rename or migration, but it *corrects prose that has already shipped into a build
artifact*, and the runtime suite reads that artifact. Only the categories with something in them are
listed; the rest are stated as empty rather than omitted, so "researched and found nothing" is
distinguishable from "not checked".

| Category | Items found | Action required |
|---|---|---|
| Stored data | **None** — core holds no datastore. Verified: no persistence layer exists in `packages/concierge/src/`. | none |
| Live service config | **None** — no external service. Verified: `scripts/pkg05-zero-runtime-deps.mjs` asserts an empty external module graph. | none |
| OS-registered state | **None.** | none |
| Secrets / env vars | **None** — core reads no environment. `globalThis` is touched in exactly two places (`host.ts:94`, `contract.ts:169`), neither for configuration. | none |
| **Build artifacts** | `dist/index.d.ts:553` and `:1409` ship the false **"defaults to a deep freeze"** claim (sourced from `src/types.ts:666` and `:1609`). `dist/index.d.ts:28` region ships `index.ts:27-36`'s "bridges are declared but not yet constructible". `test/export-surface.test.ts` and `test/artifact.test.ts` read `dist/` and fail on a stale build. | Correct `src/`, then **`pnpm build`**, then confirm by grepping `dist/` — the defect is defined by what *ships*, not by what is in `src/`. This is the same audit shape plan 03-08 ran. |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | test + build | ✅ | v24.14.1 (floor is `>=22.12.0`) | — |
| TypeScript | typecheck + dts | ✅ | 7.0.2 | — |
| Vitest | runtime suite | ✅ | 4.1.10, project `node`, `include: ["packages/*/test/**/*.test.ts"]` | — |
| pnpm | workspace | ✅ | (workspace resolves, 3 of 4 projects) | — |
| `scripts/mutate-and-prove.sh` | mutation battery | ✅ | tracked, executable | — |
| `git` | `mutate-and-prove.sh` pre-flight | ✅ | tree clean at research time | — |
| `timeout` (GNU coreutils) | — | ❌ not present on this macOS shell | — | Not needed; every gate below runs in under 1 s. Noted so a plan does not write `timeout 300 pnpm test` into a task. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `timeout` — unused by any planned gate.

**Measured baseline, this session (must stay green):**

```
pnpm test        →  Test Files 7 passed (7)   Tests 87 passed (87)   Duration 349 ms
pnpm typecheck   →  packages/concierge typecheck: Done               0.79 s wall
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.1.10 (runtime) + `tsc` 7.0.2 (type level) |
| Config file | `vitest.config.ts` (root, single `node` project) · `packages/concierge/tsconfig.test-d.json` |
| Quick run command | `pnpm test -- bridge` (Vitest filters by filename) |
| Full suite command | `pnpm build && pnpm test && pnpm typecheck` |
| Mutation harness | `scripts/mutate-and-prove.sh <file> <literal> <replacement> -- <gate>` |
| Prerequisite | **`pnpm build` before `pnpm test`** — `test/*.test.ts` import `../dist/index.js`, guarded by an `existsSync` check in `beforeAll` |

**Layer definitions used in the tables below.**

- **R** — runtime test against `packages/concierge/dist/index.js`, in `packages/concierge/test/*.test.ts`.
- **T** — type test via `tsc -p packages/concierge/tsconfig.test-d.json`, in `packages/concierge/test-d/*.test-d.ts`.
- **M** — mutation via `scripts/mutate-and-prove.sh`; the named mutant must make the gate exit non-zero **after compiling and running tests** (Known Limitation 2).
- **A** — artifact/prose audit: grep over `dist/index.d.ts` / `dist/index.js`.

### The mutant register

Each mutant is a **literal** substitution. Count occurrences **unfiltered, comments included**
(Known Limitation 3) before writing the pattern; the illustrative patterns below are shapes, and
the plan must verify uniqueness against the actual file it writes.

| ID | Target | Substitution (shape) | What it breaks |
|---|---|---|---|
| **M-05-1** | `src/bridge.ts` | `if (slot?.token === token)` → `if (slot?.bridge === bridge)` | Anti-Pattern 6 — the object-identity guard |
| **M-05-2** | `src/bridge.ts` | `if (slot?.token === token) {\n slot = null;\n }` → `slot = null;` | Unconditional clear |
| **M-05-3** | `src/bridge.ts` | the clone call in the default normalizer → a deep-freeze call | The deep-freeze default (BRG-05) |
| **M-05-4** | `src/bridge.ts` | `seen: WeakMap` lookup line removed / `seen.set` moved after the recursion | Cycle safety + DAG identity |
| **M-05-5** | `src/bridge.ts` | the `Date`/`Map`/`Set` branch → `return v;` | Exotic values stay live |
| **M-05-6** | `src/bridge.ts` | `Object.getPrototypeOf(v) === Object.prototype \|\| proto === null` → drop the `\|\| null` arm | `Object.create(null)` records pass through undetached |
| **M-05-7** | `src/bridge.ts` | `return Object.freeze(registry);` → `return registry;` | Capability object swappable (SEC-03 class) |
| **M-05-8** | `src/bridge.ts` | `assertSingleInstance();` → *(deleted)* | PKG-04's second call site |
| **M-05-9** | `src/bridge.ts` | `normalize(getter())` → `getter()` inside the try | Detachment skipped at capture |
| **M-05-10** | `src/bridge.ts` | the warn-once latch assignment → *(deleted)* | Warns on every register |
| **M-05-11** | `src/bridge.ts` | the refused-unsubscriber early return → add a `warnHost(...)` | Warns on every StrictMode mount |
| **M-05-12** | `src/bridge.ts` | `message.slice(0, MESSAGE_MAX_CHARS)` → `message` | Off-page message unbounded |
| **M-05-13** | `src/concierge.ts` | `return registry.read();` inside `resolveBridge` → `return null;` | Resolution always off-page |
| **M-05-14** | `src/concierge.ts` | `resolveBridge`'s `stage.bridge === undefined` early return removed from `bridgeStatus` | `explain()`'s three-state row collapses to two |
| **P-05-1** | `src/index.ts` | move `createBridge` from the value block into the `export type { … }` block | Export placement — **TS1485 at the shared import line of `exports.test-d.ts`, not TS2344 at the predicate** |
| **P-05-2** | `src/index.ts` | same, for the off-page helper | Export placement |
| **P-05-3** | `src/types.ts` | `read: () => B \| null` → `read: () => B` | Nullability erased — caught by the **existing** `_registryReadIsNullable` (`actions.test-d.ts:436`) |

### Phase requirements → test map

| Req | Behavior proven | Layer | Automated command | Discriminating mutant | File |
|---|---|---|---|---|---|
| **BRG-01** | `register()` returns an unsubscriber that clears the slot **only** when the slot still holds its own registration | R + M | `pnpm test -- bridge` | **M-05-1** (via O2b/O4b/O4c) and **M-05-2** (via O2/O3b/O4/O8) | ❌ Wave 0 — `test/bridge.test.ts` |
| **BRG-01** | `read()` is `() => B \| null`, not `() => B` | T | `pnpm typecheck` | **P-05-3** | ✅ exists — `test-d/actions.test-d.ts:436` |
| **BRG-02** | A handler invoked after the app moved reads new values with no re-registration | R + M | `pnpm test -- bridge` | **M-05-9**; also **M-05-3** in its normalize-at-register spelling | ❌ Wave 0 |
| **BRG-02** | `register()` stores the bridge **as given**; `read()` returns it untouched (`read() === theRegisteredObject`) | R + M | `pnpm test -- bridge` | **M-05-9** | ❌ Wave 0 |
| **BRG-03** | `resolveBridge` yields `null` for a declared-but-unmounted bridge; a throwing `read()` also yields `null` and does not propagate | R + M | `pnpm test -- bridge` | **M-05-13**, **M-05-14** | ❌ Wave 0 |
| **BRG-03** | A handler given `bridge: null` returns `{ok:false, reason:"no_bridge", message}` with a sentence that says what to do and is ≤ 180 chars | R + M | `pnpm test -- bridge` | **M-05-12** | ❌ Wave 0 |
| **BRG-04** | A stale cleanup after a replacement is **refused**, including when the replacement bridge is `===` the original | R + M | `pnpm test -- bridge` | **M-05-1** — *only* O1b/O2b/O4b/O4c discriminate it | ❌ Wave 0 |
| **BRG-05** | A snapshot captured from a proxy-backed store does not move when the store moves; the store is **not** frozen as a side effect | R + M | `pnpm test -- bridge` | **M-05-3** (Shape F fixture), **M-05-5**, **M-05-6** | ❌ Wave 0 |
| **BRG-05** | Cycles and shared references survive: `c.self === c`, `c.l === c.r`, `c.l !== original` | R + M | `pnpm test -- bridge` | **M-05-4** | ❌ Wave 0 |
| **DX-02** | An action whose stage declares **no** `bridge` runs and can succeed; resolution returns `null` without an error | R + M | `pnpm test -- bridge` | **M-05-14** | ❌ Wave 0 |
| **DX-02** | An action whose stage **does** declare a bridge, with nothing registered, still runs — core does not auto-fail | R + M | `pnpm test -- bridge` | **M-05-13** (inverted: an auto-fail mutant makes this red) | ❌ Wave 0 |

### Success criteria → test map

| # | Criterion | Observable signal | Layer | Mutant that must make it fail |
|---|---|---|---|---|
| **1** | A handler invoked after the app's state changed reads the new values, with no re-registration in between (BRG-02) | `bridge.snapshot.visibleCount()` returns the post-change number; `registry.read()` is reference-identical to the object passed to `register()` | R + M | **M-05-9** — if capture-time normalization is moved to `register()`/`read()`, the second read returns the mount-time value |
| **2** | A component that remounts and then unregisters late cannot clear the newer registration (BRG-01, BRG-04) | After O2b (`reg A(u1); reg A(u2); u1()`), `read()` is `A`, not `null`. After O4b, `read()` is `A`. | R + M | **M-05-1** — measured: object-guard returns `null` for O1b/O2b/O4b/O4c. **M-05-2** for the eight naive-discriminating orderings. |
| **3a** | Resolution yields `null` when the stage bridge is not mounted (BRG-03, half one) | `resolveBridge(stage)` — observed through `explain().stages[i].bridge.registered === false` — with `bridge` declared and nothing registered | R + M | **M-05-13**, **M-05-14** |
| **3b** | A handler given `null` returns a sentence, not an exception (BRG-03, half two) | The handler returns `{ok:false, reason:"no_bridge"}`; `message` contains an imperative clause; `message.length <= 180`; **no throw** | R + M | **M-05-12** for the bound. For the "says what to do" half see the note below. |
| **3c** | *End-to-end via a real `dispatch`* | **DEFERRED to Phase 6** by CONTEXT decision 3.3. Not provable in Phase 5. | — | — |
| **4** | A snapshot stored from a proxy-backed store does not move when the store moves — hand-rolled `Proxy`, no adapter (BRG-05) | With the **Shape F** fixture: `captured.filters.q === "shoes"` after `backing.q = "boots"`; **and** `proxy.q === "boots"`; **and** `Object.isFrozen(proxy) === false` | R + M | **M-05-3** — measured against Shape F: the mutant reads `"boots"`, no throw, no collateral. The third assertion is the only detector for the freeze-the-app failure mode. |
| **5** | An action reading router or DOM state runs with **no bridge registered at all** (DX-02) | A stage with `bridge` absent entirely: handler runs, `ctx.bridge === null`, returns `{ok:true}` reading a stubbed router value from `args`/`meta` | R + M | **M-05-14** — an auto-fail or a collapsed three-state row makes this red |

**Note on criterion 3b's "says what to do" half.** A string-content assertion
(`expect(message).toMatch(/open|go to|navigate/i)`) is testable but weak — it pins vocabulary, not
meaning, and it goes red on a legitimate rewording. Two assertions carry real weight and should be
preferred: `message.length <= MESSAGE_MAX_CHARS` (mutant M-05-12) and the negative `expect(() =>
handler(ctx)).not.toThrow()`. The DX-03 what-to-do standard is a **review** obligation on the plan
author, and the plan should say so rather than pretending a regex enforces it. This is the same
honesty `export-surface.test.ts`'s Trap 2 applies to `ReadbackAttestation`: write down the check
that cannot be automated instead of writing an assertion that passes vacuously.

### Non-discriminating tests — write them, do not count them

Per `05-CONTEXT.md` § Specific Ideas ("Each of the five success criteria needs a test that fails
when the guard is removed"), the following are **contract pins, not validation**, and the test file
must label them so:

| Test | Why it is worth writing | Why it proves nothing about the guard |
|---|---|---|
| O1 — StrictMode `reg A(u1); u1(); reg A(u2)` | It is the ordering every reader looks for first; its absence reads as an omission | Measured identical on token / object-guarded / naive |
| O3 — `reg A(u1); u1(); u1(); reg B` | Pins unsubscriber idempotence | Measured identical on all three |
| O5 — `reg A; reg B(u2); u2()` | Pins the ordinary happy path | Identical on all three |
| O6 — never registered → `null` | Pins the initial state | Identical on all three |
| O7 — `reg A(u1); u1()` → `null` | Pins the simple unmount | Identical on all three |

### Sampling rate

- **Per task commit:** `pnpm build && pnpm test -- bridge && pnpm typecheck` (< 2 s combined at
  current suite size).
- **Per wave merge:** `pnpm build && pnpm test && pnpm typecheck` — full 87-test baseline plus the
  new file, plus `git diff --exit-code` at the repo root (the containment `mutate-and-prove.sh`'s
  Known Limitation 1 depends on).
- **Phase gate:** the full suite green, **plus the mutation battery** — every mutant in the register
  above run through `scripts/mutate-and-prove.sh`, each PASS confirmed from the gate's *output* to
  have compiled and actually run tests, **plus** the shipped-prose audit (grep `dist/index.d.ts` and
  `dist/index.js` for `deep freeze` and `not yet constructible`, expecting zero hits), **plus**
  `pnpm check:deps` / `check:artifact` / `check:pack` / `check:node-floor` — before
  `/gsd-verify-work`.

### Wave 0 gaps

- [ ] `packages/concierge/test/bridge.test.ts` — new. Covers BRG-01, BRG-02, BRG-03, BRG-04,
      BRG-05, DX-02. Must open with the "what escapes without this file" header carrying measured
      evidence, per the house convention, and must import `../dist/index.js` behind an `existsSync`
      guard in `beforeAll`. **No Vitest mocking API** — the grep must stay at zero; console capture
      is a plain `globalThis.console` assignment restored in a `finally`
      (`test/concierge.test.ts:1077-1089` is the template).
- [ ] `packages/concierge/test-d/bridge.test-d.ts` — new. `createBridge`'s signature via `Equals`,
      the `BridgeRegistry<B>` conformance, and the off-page helper's return type. Uses the four
      `_assert.ts` aliases; **predicates, never `expectTypeOf`, and `@ts-expect-error` only for
      object-literal freshness**.
- [ ] `packages/concierge/test/export-surface.test.ts` — **edit**. Seven pins move together
      (Q5 table).
- [ ] `packages/concierge/test-d/exports.test-d.ts` — **edit**. Two predicates on the shared import
      line; header sentence "bringing the total to six" → eight.
- [ ] Shared fixture: the **Shape F** reactive-store factory. Recommend it live inline in
      `test/bridge.test.ts` rather than in a `test/fixtures/` module — `test/fixtures/probe.ts` is
      compiled by a *foreign* program (plan 02-09's scratch project) and adding a sibling there
      invites it into that program by accident.
- [ ] Framework install: **none needed.** Vitest 4.1.10, TypeScript 7.0.2 and
      `scripts/mutate-and-prove.sh` are all present and green.

---

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is enabled.

### Applicable ASVS categories

| ASVS category | Applies | Standard control in this phase |
|---|---|---|
| V2 Authentication | no | No principal, no credential. Core runs inside the human's already-authenticated session. |
| V3 Session Management | no | `Session` is Phase 7. |
| V4 Access Control | **yes** | The registry object **is** the capability — holding the reference is the authorization. `PITFALLS.md:234` item 3 ("Bridge ids must be unforgeable… Key the registry on the object identity created by `defineStage`/`createBridge`, held in module scope, not on a string") is satisfied by `createBridge` returning the object and `StageDefinition.bridge` taking the object, not the id. The `id` is a label for `explain()` and must never be a lookup key. |
| V5 Input Validation | partial | Not this phase's surface — Phase 6 (DSP-04) re-validates arguments. Phase 5's analogue is defensive treatment of *consumer* values: a throwing `read()`, a throwing snapshot getter, a throwing exotic clone. All three degrade rather than propagate. |
| V6 Cryptography | no | Nothing hashed here. Phase 8 (CON-04) hashes the *output* of this phase's capture, which is why detachment is a security property and not a hygiene one. |
| V7 Error Handling & Logging | **yes** | Constraint C7: every `catch` binds nothing and echoes nothing. `warnHost` messages name the registry id and the snapshot key — both developer-authored — never a caught message and never a captured value. |
| V8 Data Protection | **yes** | The off-page message and every warn are potential PII channels. The measured leak in §Pattern 2 (a nested throwing getter whose message carries a user email) is a real instance of this class. |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation | Status in Phase 5 |
|---|---|---|---|
| Third-party page script swaps `registry.read` to feed the agent a forged snapshot | **T**ampering | `Object.freeze` on the returned capability object | **Locked by CONTEXT.** Measured: the swap throws `TypeError` in ESM strict mode. Mutant **M-05-7**. |
| Third-party script forges a bridge id and registers against it | **S**poofing | Identity is the object reference, never the string id | **Structural** — there is no id→registry map to attack. `PITFALLS.md:234` item 3. |
| Two core copies split the registry; every handler sees `bridge: null` forever on a page that is definitely open | **D**enial of service (self-inflicted) | `assertSingleInstance()` inside `createBridge`'s body | **Locked by CONTEXT.** Mutant **M-05-8**. CONTEXT calls this "the single most undebuggable failure in the design". |
| A captured snapshot is a live proxy view, so Phase 8's CON-04 drift check compares a value against itself and passes unconditionally — consent gate open, appearing to work | **E**levation of privilege | Structural clone at capture | **The reason BRG-05 is a security requirement.** Mutant **M-05-3**. Note that a *deep freeze* leaves the gate open while every naive test goes green — the exact "failing while appearing to work" shape `types.ts:660-666` names. |
| A caught exception's message — which echoes user input — reaches the model or telemetry | **I**nformation disclosure | Catch binds nothing; messages echo nothing caught | Constraint C7. Measured leak path in §Pattern 2. |
| A `deepFreeze` on a proxy freezes the host app's own reactive store | **D**enial of service (against the consumer) | Never freeze a value we did not construct | Measured. Avoided by cloning; re-introduced by the Pitfall-4 belt-and-braces pass. |
| A snapshot key silently becomes `undefined` and a downstream consent comparison treats it as "unchanged" | **T**ampering | Warn once naming registry id + key | **Locked by CONTEXT.** Mutant **M-05-10**. The warn is the only externally-visible signal; Phase 8 must not treat `undefined` as a value. Flagged forward. |

---

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| `types.ts:666` / `:1609`: "Frameworks without proxy-based reactivity supply a deep freeze" / "defaults to a deep freeze" | Default is a structural **clone** then freeze | This phase | Ships in `dist/index.d.ts:553` and `:1409`. A consumer reading it today gets a false statement about a security-relevant default. |
| `index.ts:27-36`: "bridges are declared but not yet constructible"; "the runtime still to come is `createSession` and `createBridge`" | `createBridge` ships in this phase | This phase | Same shipped-prose class. `createSession` remains correct (Phase 7). |
| `contract.ts:159-163`: the adapter-registration call site "is genuinely still to come" | `createBridge` is that call site | This phase | The sentence needs re-scoping: `createBridge` satisfies it for apps that call `createBridge` directly; a Phase 9 adapter that mounts without ever calling `createBridge` would still need its own. Decide explicitly rather than deleting the sentence. |

**Deprecated / do not restore:**
- `defineStage` — cut in Phase 4; `createBridge` absorbs its only reason to exist (`index.ts:32-36`).
- The `never`-valued `Bridge` defaults — `types.ts:1076-1101` forbids restoring them.
- A thirteenth `ReasonCode` — the union is final at twelve.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| **A1** | Symbol-keyed properties are **not** carried by the clone | Q1, "Symbol keys" | A framework that stores meaningful state on a symbol key would lose it. Judged low: the three target frameworks use symbols for internal markers, which is what we want dropped. **Claude's discretion per CONTEXT, but the plan must state it explicitly.** |
| **A2** | Routing `bridgeStatus` through `resolveBridge` is the right way to give the seam a reachable caller | §Code Examples | If the planner keeps `bridgeStatus` untouched, `resolveBridge` has no observable behaviour at the `dist/index.js` layer and BRG-03's resolution half becomes untestable at the project's normal test layer. **Needs a decision in the plan.** |
| **A3** | The exotic-clone `catch` falls back to pass-through-by-reference rather than to `undefined` | Q1, Pitfall 5 | Pass-through leaves a live proxied `Date` in the snapshot (a BRG-05 hole); `undefined` loses data silently. Neither is clearly right. Pass-through matches CONTEXT's "everything else passed through by reference" rule, which is why it is recommended — but CONTEXT did not contemplate the throwing case. |
| **A4** | A `warnHost` on the exotic-clone fallback is **not** added | Q1 | CONTEXT sanctions warn-once only for the throwing snapshot getter. Adding a second warn channel is discretionary; omitting it means a silent BRG-05 hole. Flagged rather than decided. |
| **A5** | The off-page helper takes two string parameters (`what`, `where`) | §Code Examples | Shape is Claude's discretion per CONTEXT. A single-string or options-object form would change the type-test predicate. Non-load-bearing. |
| **A6** | `test/bridge.test.ts` can reach the capture function through the public surface | Wave 0 | CONTEXT says export the capture function "only if a test cannot reach it otherwise". If it stays internal and no public path exercises it, the export surface grows by 3, not 2, and all seven pins change again. **The plan must resolve this before writing the count.** |
| **A7** | The pending todo *"Correct the over-broad `sideEffects` headline"* stays out of scope | §Adjacent work | It suggests folding into Phase 5 "if it touches `catalog.ts` anyway". Phase 5 reuses `deepFreeze` **without editing `catalog.ts`**, so the trigger does not fire. Leaving it also leaves false prose in `dist/`. Not in CONTEXT's decision list — surfaced for the planner, not assumed. |

---

## Open Questions

1. **The SSR registration leak (ARCHITECTURE.md item H).**
   - *What we know:* a registry created at consumer module scope has a process-global slot. If
     `register()` ever runs on the server, that registration persists into the next request — the
     exact cross-request pollution `concierge.ts:17-35` corrects for the catalog memo. ARCHITECTURE
     suggests a dev warning when `register()` runs with `typeof window === "undefined"`.
   - *What's unclear:* core cannot read `window` — constraint C2 makes it a compile error, and
     `host.ts:46-51` sets the bar for a new seam at "a measured compile error, not a convenience".
     Adding a `hasWindow()` capability to `host.ts` is a real widening of what core assumes about
     its host, and CONTEXT did not decide it.
   - *Recommendation:* **out of scope for Phase 5.** Record it as a Phase 9 obligation — the adapter
     is where "am I on the server" is already known for free (React effects do not run on the
     server; Svelte's `$effect` likewise), so the guard costs nothing there and a new core seam
     costs something here. State the invariant in `createBridge`'s doc comment so it stops being
     "an invariant nobody has written down."

2. **Does `contract.ts:159-163`'s reserved-call-site sentence get deleted or re-scoped?**
   - *What we know:* it says the adapter-registration call site "is genuinely still to come… an
     adapter can be imported and mounted in a module that never builds a catalog, so it needs a call
     of its own." `createBridge` is now a call site that covers apps calling `createBridge` directly.
   - *What's unclear:* whether a Phase 9 adapter can mount without any `createBridge` call in the
     graph. If it can, the sentence stays true and needs only a "and `createBridge` in `./bridge.ts`
     is now the second" clause.
   - *Recommendation:* **re-scope, do not delete.** This comment reaches `dist/index.d.ts:2028`
     verbatim; Phase 4 already had to correct the adjacent `createConcierge` sentence for exactly
     this reason (`contract.ts:147-157`).

3. **Capture-function export: 2 new values or 3?**
   - *What we know:* CONTEXT locks "+2 values" and separately says export the capture function only
     if a test cannot reach it otherwise. The runtime suite reads `dist/index.js` only.
   - *What's unclear:* whether Phase 5 ships any public path that invokes capture. `dispatch` is
     stubbed; `explain()` does not capture; the consent kernel is Phase 8. **On the current design
     there is no public caller**, so the capture function is either exported (+3, contradicting the
     locked count) or untested at the project's normal layer.
   - *Recommendation:* the planner must choose and record it. The honest options are (a) export it
     and correct the count to +3 with the reason written down, or (b) keep it internal and accept
     that BRG-05 is proven through `createBridge` + a normalizer applied at the boundary the test
     can reach. **This is the single highest-value thing to settle before writing plans**, because
     it moves seven export pins.

4. **`ActionResult` shape ratification.**
   - *What we know:* STATE.md records the flat `ActionResult` (option-b) as an **unratified**
     orchestrator decision, with the discriminated-union-on-`ok` alternative free before publish and
     breaking after, and Phase 8 the last free moment.
   - *Impact here:* the off-page helper returns an `ActionResult`. If the union lands later, the
     helper's return type changes but its call sites do not — low blast radius.
   - *Recommendation:* proceed. Note the dependency so Phase 8's decision includes this helper in
     its inventory.

---

## Sources

### Primary (HIGH confidence — executed or read in this session)

- **Empirical measurement, Node v24.14.1** — `Object.freeze` trap sequences across five proxy
  shapes; clone-vs-freeze detachment; `structuredClone` `DataCloneError` on proxies and functions;
  `Date`/`Map`/`Set` detection across plain / proxied / cross-realm (`node:vm`); proxied-`Date`
  extraction across six routes; `Object.freeze` on `Map`/`Set`/`Date` being cosmetic; cycle and DAG
  identity; getter-invocation counts for freeze vs clone; frozen-registry write rejection; thirteen
  mount/unmount orderings × three implementations; `assertSingleInstance` idempotence and cost.
- **TypeScript 7.0.2 compilation** under `lib: ["ES2022"]`, `types: []`, `isolatedDeclarations`,
  `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` — reachability probe (exit 0) and
  `structuredClone` probe (`error TS2304`).
- **`packages/concierge/dist/index.d.ts`** — export-surface parse: 1 block, 62 names, 51 types,
  11 values, with the value list read out.
- **`packages/concierge/src/`** — `types.ts` (`Bridge`, `BridgeRegistry`, `StageDefinition`,
  `ActionHandler`, `SnapshotNormalizer`, `ConciergeConfig.normalizeSnapshot`, `ReasonCode`,
  `FailureReason`, `ActionResult`, `MESSAGE_MAX_CHARS`), `concierge.ts` (`createConcierge`,
  `bridgeStatus`, `explain`, the dispatch stub, `warnHost` usage), `host.ts`, `catalog.ts`
  (`deepFreeze`), `contract.ts`, `index.ts`.
- **`packages/concierge/test/`** — `export-surface.test.ts`, `concierge.test.ts` (console-capture
  convention), `artifact.test.ts`. **`packages/concierge/test-d/`** — `_assert.ts`,
  `exports.test-d.ts`, `actions.test-d.ts`, `concierge.test-d.ts`.
- **`scripts/mutate-and-prove.sh`** — exit-code contract and all three Known Limitations.
- **`vitest.config.ts`**, `tsconfig.base.json`, `tsconfig.test-d.json`, `package.json` ×2.
- **Baseline runs** — `pnpm test` (7 files, 87 tests, 349 ms), `pnpm typecheck` (0.79 s).

### Secondary (HIGH confidence — in-repo research and planning artifacts)

- `.planning/research/ARCHITECTURE.md:279-289` (the closure), `:820-850` (item H, the module-
  singleton SSR hazard), `:950` (Anti-Pattern 6).
- `.planning/research/PITFALLS.md:218-265` (P6 — forgeable bridge ids, in-page registration threat
  model, the seven mitigations).
- `.planning/phases/05-bridge-registry-and-the-no-bridge-path/05-CONTEXT.md` (locked decisions).
- `.planning/ROADMAP.md:199-214` (Phase 5), `:157-197` (Phase 4 outcomes),
  `:216-231` (Phase 6 boundary).
- `.planning/REQUIREMENTS.md:35-39, 103` (BRG-01…05, DX-02 verbatim).
- `.planning/STATE.md` (deferred items — `MESSAGE_MAX_CHARS` placement guard, `ActionResult`
  ratification).
- `.planning/todos/pending/2026-07-31-correct-the-over-broad-sideeffects-headline-*.md`.
- `./CLAUDE.md` (stack constraints).

### Tertiary (LOW confidence — none)

No web search was performed. The ROADMAP directs that the mechanism is settled, and every
JS-semantics question was answered by execution rather than by search. No claim in this document
rests on an unverified external source.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Standard stack | **HIGH** | Zero new packages; every ES2022 API compiled under the repo's exact flags this session; `structuredClone`'s absence measured as TS2304. |
| Default normalizer (clone vs freeze) | **HIGH** | Five proxy shapes × two algorithms executed; three distinct deep-freeze failure modes reproduced with their exact error text and trap sequences. |
| Clone algorithm details | **HIGH** | Detection predicates measured across plain / proxied / cross-realm for arrays, `Date`, `Map`, `Set` and plain objects; cycle and DAG behaviour executed. The proxied-`Date` throw was found by execution, not anticipated. |
| Token guard + ordering matrix | **HIGH** | Thirteen orderings × three implementations executed; the discriminating subsets are measured, not reasoned. |
| `assertSingleInstance` placement | **HIGH** | Idempotence and cost measured; `contract.ts`'s own reserved-call-site comment read directly. |
| Export-surface baseline | **HIGH** | Parsed from the built `dist/index.d.ts` with the test's own regex. |
| `MESSAGE_MAX_CHARS` placement | **HIGH** | Grepped across `src/`, `test/`, `test-d/`; the Phase 1 deferred guard confirmed already closed by `exports.test-d.ts:72`. |
| Validation architecture | **MEDIUM-HIGH** | Mutant *effects* are measured; mutant *literal patterns* are shapes and must be checked for uniqueness against the file the plan actually writes (Known Limitation 3). |
| Open Question 3 (capture export) | **MEDIUM** | A genuine design gap in CONTEXT, not a research failure. Flagged rather than resolved. |

**Research date:** 2026-07-31
**Valid until:** 2026-08-30 — the measurements are of JavaScript language semantics and of this
repository's own tree, neither of which drifts on a package-release cadence. The only expiry risk is
the export-surface baseline (62/51/11), which changes the moment any phase adds an export.
