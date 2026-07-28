# Phase 1: Type surface completion - Research

**Researched:** 2026-07-28
**Domain:** TypeScript public API design; compile-time invariant enforcement; type-only test suites
**Confidence:** HIGH — every mechanical claim below was reproduced in this session against the repo's exact `tsconfig.base.json` flags, under **both** the installed TypeScript 5.9.3 and TypeScript 7.0.2, with identical results.

## Summary

The four gray areas were settled during discussion (D-00 … D-11 in CONTEXT.md) and are **not** re-litigated here. What was missing was the *mechanics*: how to build a regression-proof type-test suite whose only signal is `tsc --noEmit`, what order the interlocking edits must land in, and whether the locked shapes actually behave as claimed under `isolatedDeclarations` + `exactOptionalPropertyTypes` + `strict`.

A complete working prototype of the corrected surface (319 lines) plus a three-file type-test suite (272 lines) was built and compiled clean. A **ten-mutant battery** was then run against it, reintroducing each corrected defect one at a time. Seven mutants were caught by the first draft of the suite; **three escaped** (the readback-sink form, the `ToolBatch` hook, and the dropped handler type arguments) and required specifically-designed assertions. That result is the single most useful finding here: the obvious assertions do **not** cover three of the seven Success Criteria, and a plan that assumes they do will ship a suite that passes while the defect is present.

Three verified corrections to the assumptions carried in from discussion. (1) The readback sink's generic-**function** form does *not* accept a payload-specific app sink — **neither form does**; the real, testable difference is that a defaulted generic alias accepts a type argument and a generic function does not. (2) `DigestLike` must use **method** syntax, not function-property syntax — verified against both real `SubtleCrypto` and real Node `webcrypto.subtle`, where property syntax fails. (3) Threading `Snapshot` through `ActionDefinition` (D-07) **breaks `StageDefinition.actions` and `ConciergeConfig.crossStage`** with TS2375; an erased collection type must land in the same edit or the file will not compile.

**Primary recommendation:** Land the whole phase as one serial sequence on `types.ts` (no parallel tasks — it is one 540-line file), pairing each type edit with its type-test in the same commit so `tsc --noEmit` is green at every step. Refactor `ConsentAck` exactly once, folding D-03's doc reference, D-05's `challenge?` + `attested` union, and D-07's generics into a single change. Add `packages/concierge/tsconfig.test-d.json` as a **new** file (never edit `tsconfig.json`) to preserve Phase 1 ∥ Phase 2 disjointness.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `01-CONTEXT.md`. The planner must not propose alternatives to any of these.

**D-00 — Two roadmap claims are wrong; correct them first**
- `ToolBatch.deferUntilDelivered` (`types.ts:436`) still carries the pre-fix signature `(effect: (deliveredResponseId: string) => void) => void`. Fix it to `DeliveryReport`. `ToolBatch` is an interface **consumers implement** — see D-09 — so this is genuinely a would-be breaking change.
- `AbandonReason` (`types.ts:80`) is declared and exported (`index.ts:20`) and consumed by nothing. D-01 resolves it.

**D-01 — `ActionResult.reason` is a pure closed union**
- Field is written **`reason?: ReasonCode | undefined`** where `type ReasonCode = AbandonReason | FailureReason`.
- The explicit `| undefined` is load-bearing, not cosmetic. Under `exactOptionalPropertyTypes: true`, a bare `reason?: ReasonCode` rejects both `{ok: true, reason: undefined, message}` (TS2375) and the natural `{reason: computeReason(), ...}` idiom.
- `AbandonReason` is **reused as a named subset**, not deleted.
- Thirteen codes: `AbandonReason` (human-caused) = `declined`, `cancelled`, `superseded`. `FailureReason` (machine-caused) = `invalid_args`, `invalid_result`, `unknown_action`, `no_bridge`, `handler_error`, `aborted`, `consent_required`, `consent_stale`, `grade_unavailable`.
- `invalid_result` was added 2026-07-27; DSP-09 is the Phase 6 runtime half.
- `batch_aborted` collapses into `aborted` unless Phase 6 needs the distinction. `grade_unavailable` is a *runtime* code for capability degradation after reconnect only.
- **Rejected — do not revive:** generic `ActionResult<R extends string = ReasonCode>`; `` `app.${string}` `` escape hatch; discriminated union on `ok`; a free-form `detail?` sibling.

**D-02 — `message` is unbranded `string` with a stated policy**
- Do **not** brand it. A branded `SafeMessage = string & {…}` rejects `` {ok: true, message: `Filtered to ${x}.`} `` (TS2322).
- Stated policy for the doc comment: **`message` is a best-effort human-facing sentence and is never a consent artifact.**
- **Phase 1** exports `MESSAGE_MAX_CHARS` as a constant alongside `USER_CANCELLED` / `USER_DECLINED`, and states the bound in the `ActionResult.message` doc comment. A constant, not a branded type.
- **Phase 6** implements the sanitizer at the dispatcher boundary (SEC-06).

**D-03 — Readback sink returns a receipt; core owns canonicalization, the app injects the digest**
- The sink returns a **receipt**, not a bare hash string: `{ hash, alg, canonicalization, canonical }`.
- **Canonicalization is JCS (RFC 8785)** over `{payload, presented?}`.
- **Carrying `canonical` alongside `hash` is deliberate** — WebAuthn's reason for making `clientDataJSON` opaque bytes.
- **`DigestLike` goes on `ConciergeConfig`** next to `normalizeSnapshot`. The `AbortSignalLike` precedent applied verbatim.
- **MANDATORY — the variance trap.** The sink must use the generic-**function** form `<P>(rb: Readback<P>) => Promise<ReadbackReceipt>`, following `SnapshotNormalizer`'s shape — **not** a defaulted generic alias `ReadbackSink<Payload = unknown>`.
- **Rejected:** bundling SHA-256 in core; fusing present and observe into one attesting sink.
- **Implementation split:** Phase 1 ships the *types*. The JCS encoder (~40 LOC) and hand-rolled UTF-8 (~15 LOC) land in Phase 8.

**D-04 — Composition/taint metadata: `readsUntrusted` only, and it must be enforced**
- Ship **`readsUntrusted`** and cut `maxPerTurn`, `conflictsWith`, and `impact`.
- **Placement: sibling to `SideEffects`, not a member of it.** `SideEffects` is the MCP-hint mirror; MCP is actively reconsidering `openWorldHint`.
- **Enforcement is required** — SEC-05, Phase 3. **Phase 1 ships the field and the type-test only.**

**D-05 — Server consent token: reserve the *inbound* seam, produce nothing**
- Add **`challenge?: ServerChallenge`** to `ConsentAck` — server-issued, client-echoed, opaque, **typed but never produced in v0.1**.
- **Paired change — make `attested ⇒ readbackHash` compiler-enforced.** Refactor `ConsentAck` so `grade: "attested"` type-*requires* `readbackHash`.
- **Accepted cost:** `ConsentAck` becomes a type alias union rather than an interface. Under `exactOptionalPropertyTypes`, apps must **omit** `challenge` rather than spread `undefined` into it.
- **Rejected:** a transparent claims envelope produced in v0.1; an opaque outbound `serverToken?: ConsentToken`.

**D-06 — Type-test mechanism: `tsc --noEmit` over `*.test-d.ts`**
- Use **`tsc --noEmit` over `*.test-d.ts` files with `@ts-expect-error` assertions**. Zero new dependencies. Vitest's `expectTypeOf` would create a real Phase 1 → Phase 2 dependency the roadmap says does not exist.
- **Phase 1's type tests will run under TS 5 unless Phase 2 lands first.** All verification behind D-01 through D-05 was reproduced under both TS 7.0.2 and TS 5.9.3.
- The suite must assert at minimum: (1) `snapshotEquality` degraded to `(a: unknown, b: unknown)`; (2) a `requires` that widens the action's own name union; (3) a delivery hook that drops the completion reason. Plus: an arbitrary `reason` string is rejected; a typed readback sink assigns to the seam; an `attested` ack without `readbackHash` is rejected; `readsUntrusted` is absent from the kernel's enforced input set.

**D-07 — Thread `Snapshot` through the declaration chain**
- Add a `Snapshot` type parameter to `ActionDefinition` and thread it: `ActionDefinition` → `ActionHandler` → `ConsentAck` → `ConsentPolicy`.
- `ActionHandler` accepts an `AckPayload` type parameter (`types.ts:156`) that `ActionDefinition.handler` (`types.ts:348`) drops. **Fix both together; they are one chain.**
- This interacts with D-05: the `ConsentAck` interface → union refactor happens in this same chain.

**D-08 — Remaining roadmap-named additions, unchanged**
- A `scheduler?` seam.
- `stage` and `onStageChange` on `Session`.
- TRN-01's demonstration is **type-level** — a `.test-d.ts` declaring two structurally unrelated transports against the same `Transport` interface.

**D-09 — The constructed-vs-implemented distinction**
- **Implemented by consumers** — `Transport`, `TransportCapabilities`, `DeliveryReport`, `ToolBatch`, `Bridge`, `BridgeRegistry`. Adding a required member here *is* breaking.
- **Constructed by consumers** — `ActionDefinition`, `ConsentPolicy`, `ActionResult`, `ConciergeConfig`, `StageDefinition`. Adding an *optional* property post-publish is a minor bump.
- Caveat: the later-addition freedom is only real while a field's default stays permissive.

**D-10 — `TransportCapabilities` declares turn-identity *provenance*, not just presence (TRN-05)**
- `TransportCapabilities.userTurnIdentity: boolean` (`types.ts:443`) cannot record *where* identity comes from.
- **Shape (provisional):** replace or supplement the boolean with a provenance value distinguishing at minimum an identity the agent cannot forge (an explicit human act — button, click, keypress) from one it can influence (recognizer-derived, or any channel the agent's own output feeds back into).
- **The planner should resist over-enumerating modalities; grades are modality-free and this must stay so. The axis is *forgeable by the agent's own output* versus *not*, not *voice* versus *text*.**
- Phase 1 makes provenance representable and type-tests it. Phase 8 implements the runtime gate.

**D-11 — Note only: CON-10 was minted from this discussion.** Not Phase 1 work. Phase 1 ships no type for it.

### Claude's Discretion

- **D-01/D-02 (`ActionResult.reason` and the `message` policy)** — user answered "you decide". The exact `FailureReason` membership is the part most likely to need adjustment once Phase 6's dispatcher enumerates its real failure paths, and adding a member later is additive-safe (see D-09).
- Naming throughout (`ReasonCode`, `FailureReason`, `ReadbackReceipt`, `DigestLike`, `ServerChallenge`, `ReadbackAttestation`) is provisional — chosen to read consistently with the existing `AbortSignalLike` / `SnapshotNormalizer` conventions. **The planner may rename; the shapes are what is locked.**

### Deferred Ideas (OUT OF SCOPE)

- `readsUntrusted` build-time gate → SEC-05, Phase 3.
- `invalid_result` runtime half → DSP-09, Phase 6.
- Message sanitizer → SEC-06, Phase 6. Phase 1 exports `MESSAGE_MAX_CHARS` only.
- Agent may not narrate a failure → CON-10, Phase 8.
- TRN-05 runtime gate → Phase 8. Phase 1 makes provenance representable only.
- `maxPerTurn` on `ConciergeConfig` — not scheduled.
- JCS encoder + hand-rolled UTF-8 in core (~55 LOC) → Phase 8.
- `ReadbackAttestation` → Phase 8. **Phase 1 may declare the type**; Phase 8 makes the kernel require it.
- Server-side verification of `ServerChallenge` → v2.
- `CONTRACT_VERSION` → Phase 2.
- Bumping `typescript@^5.7.0` → `7.0.2` and `pnpm@10.33.0` → 11 → Phase 2.
- Correcting the two stale PROJECT.md Key Decisions rows → next `/gsd-transition`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **TRN-01** | A transport is defined entirely by an interface with no vendor event names in core | Verified: `keyof Transport` is exactly `"capabilities" \| "setTools" \| "onToolBatch" \| "respond"` and is assertable as a type-level equality. Two structurally unrelated transports (a WebRTC-shaped one and a command-palette-shaped one) were declared against the same `Transport` interface and both compiled — see [Code Examples § TRN-01](#trn-01--two-unrelated-transports-one-interface). No new types are needed for TRN-01; it is satisfied by the *existing* `Transport` shape plus D-10's `TransportCapabilities` change, and demonstrated at type level per D-08. |
| **TRN-05** | A transport declares the *provenance* of its turn identity, not merely whether it has one, and a transport whose turn identity can be minted by the agent's own output cannot satisfy the strongest user-turn binding | Verified: replacing `userTurnIdentity: boolean` with a three-member string union compiles clean, and `Expect<Not<Assignable<true, TransportCapabilities["userTurnIdentity"]>>>` is a working guard that fires the moment the field regresses to `boolean` (mutant M6 caught, five distinct diagnostics). The runtime gate is Phase 8; Phase 1's obligation is representability plus the type-test. Member naming is discretion — the *axis* (forgeable vs not) is locked by D-10. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md`. These carry the same authority as locked decisions.

| Directive | Phase 1 consequence |
|---|---|
| **Core is dependency-free** | Phase 1 installs **zero** packages. The type-test mechanism must use no assertion library. `@standard-schema/spec@1.1.0` is the sole existing dependency (types-only, 0-byte runtime) and is unchanged. |
| **ESM-only, Node ≥22.12** | Test-d files import with explicit `.js` specifiers (`from "../src/types.js"`) — required by `moduleResolution: "bundler"` + `verbatimModuleSyntax` conventions already in use in `index.ts`. |
| **Core must construct on the server with no environment guards — no top-level `window`/`document`/`navigator`** | Reconfirmed mechanically: `lib: ["ES2022"]` makes `crypto`, `TextEncoder`, and `btoa` all **TS2304** under TS 5.9.3 *and* TS 7.0.2. This is why `DigestLike` is injected rather than used. |
| **Redaction required for non-empty schema, defaults to `drop`** | `RedactionPolicy` is unchanged by this phase. Do not weaken `redact` to optional while editing `ActionDefinition`. |
| **Handler exceptions never reach the model or telemetry** | Phase 6 concern. Phase 1 must not add any field that could carry a thrown message — this is why D-01 rejected a free-form `detail?` sibling. |
| **Adapters ~150 LOC; larger means logic leaked out of core** | Not exercised in Phase 1, but the erasure decision (below) affects how much casting adapters will need in Phase 9. Prefer the erasure that keeps adapter code cast-free. |
| **`dispatch` is not `async`** (CONTRIBUTING non-negotiable) | `Concierge.dispatch` returns `Promise<ActionResult>` and must stay a non-`async` signature in the type. Do not "tidy" it. |
| **Commit messages: never add Co-Authored-By or AI self-attribution** (global CLAUDE.md) | Applies to every commit this phase produces. |
| **GSD workflow enforcement** | All edits go through the GSD execute path, not ad-hoc. |

## Architectural Responsibility Map

Phase 1 ships no runtime, so the "tiers" here are the layers of the *contract* rather than deployment tiers. This map exists so the planner can sanity-check that no capability is declared in the wrong layer.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Failure-code vocabulary (`ReasonCode`) | Core type surface | — | Must be closed and shared by dispatcher (Phase 6) and kernel (Phase 8); a per-app extension point would destroy exhaustiveness (D-01). |
| Human-facing sentence bound (`MESSAGE_MAX_CHARS`) | Core type surface (constant) | Dispatcher boundary (Phase 6 enforces) | The type system cannot express a length constraint; the constant is the shared contract, the sanitizer is runtime (D-02). |
| Canonicalization rule (JCS) | Core runtime (Phase 8) | Core type surface (declares `canonicalization: "JCS"`) | Core owns it so the app cannot make it an app bug (D-03). Phase 1 declares only the literal. |
| Digest computation | **App / platform** (injected) | Core type surface (declares `DigestLike`) | `crypto` is absent under `lib: ["ES2022"]` — verified TS2304. Core must not own unaudited crypto (D-03). |
| Readback presentation | **App** (renders) | Core type surface (declares `Readback` / `ReadbackSink`) | The app is the only thing with a surface; core is DOM-free. |
| Turn-identity provenance | **Transport** (declares) | Core kernel (Phase 8 enforces) | Only the transport knows where its `userTurnId` comes from (D-10). |
| Consent-token minting | **Server** (v2) | Core type surface (declares inbound `challenge?` only) | Page JavaScript has no minting authority worth trusting (D-05). |
| Snapshot detachment | **Framework adapter** (Phase 9) | Core type surface (`SnapshotNormalizer`) | Unchanged this phase; cited as the shape precedent for `ReadbackSink`. |
| Heterogeneous action storage | Core type surface | — | `StageDefinition.actions` must hold actions with differing `Snapshot` types; requires an erased view type (see [the variance landmine](#pitfall-1-threading-snapshot-breaks-stagedefinitionactions-tsc-refuses-to-compile-typests)). |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typescript` | **5.9.3 installed** (`^5.7.0` pinned in root `package.json`) | The entire Phase 1 toolchain — compiler *is* the test runner | Already installed and working: `tsc --noEmit -p packages/concierge/tsconfig.json` exits 0 clean today. `[VERIFIED: local tsc --version + exit code]` |
| `@standard-schema/spec` | **1.1.0** | Schema interop types consumed by `InferOutput` / `ActionDefinition` | Already a dependency; types-only, published 2025-12-15, repo `github.com/standard-schema/standard-schema`. Unchanged by this phase. `[VERIFIED: npm view + local resolution]` |

**No new packages. Phase 1's dependency delta is zero.**

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | Nothing. The type-test suite uses four hand-written type aliases (`Expect`, `Equals`, `Assignable`, `Not`) totalling 6 lines. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written `Expect`/`Equals` | `expect-type` (npm) | Better diagnostics, but adds a devDependency and Phase 1's whole premise is zero-dependency disjointness from Phase 2. Rejected. |
| Hand-written `Expect`/`Equals` | `tsd` (npm) | Runs its own compiler copy and its own assertion syntax; would fight `isolatedDeclarations`. Rejected. |
| `tsc --noEmit` | Vitest `expectTypeOf` | **Explicitly rejected by D-06** — creates the Phase 1 → Phase 2 dependency the roadmap says does not exist. |
| `@ts-expect-error` for every negative | Type-level `Expect<Not<Assignable<…>>>` predicates | **Prefer the predicate.** See [the `@ts-expect-error` trap](#pitfall-3-ts-expect-error-suppresses-the-wrong-error-and-the-test-still-passes). Predicates name the invariant in the echoed source line and cannot be satisfied by an unrelated error. Reserve `@ts-expect-error` for excess-property freshness, which predicates cannot model (verified). |

**Installation:**
```bash
# Nothing to install. Dependencies are already present:
pnpm install --frozen-lockfile   # already succeeds
```

**Version verification** (run 2026-07-28):
```
$ ./node_modules/.bin/tsc --version   -> Version 5.9.3
$ node --version                      -> v24.14.1
$ pnpm --version                      -> 10.33.0
$ npm view typescript dist-tags       -> latest = 7.0.2, next = 7.1.0-dev.20260727.1
$ npm view @standard-schema/spec version time.modified
                                      -> 1.1.0, 2025-12-15T20:49:46.860Z
```

## Package Legitimacy Audit

Phase 1 installs **no external packages**. The audit is therefore over the existing dependency only, retained for the record.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@standard-schema/spec` | npm | 1.1.0 published 2025-12-15 (~7 months) | n/a — already vendored in `pnpm-lock.yaml` | github.com/standard-schema/standard-schema | not run (no install) | Unchanged — pre-existing, resolved from the committed lockfile |
| `typescript` | npm | 5.9.3 (installed); 7.0.2 is `latest` | n/a — already installed | github.com/microsoft/TypeScript | not run (no install) | Unchanged — Phase 2 owns the bump |

**Packages removed due to slopcheck [SLOP] verdict:** none — no packages considered.
**Packages flagged as suspicious [SUS]:** none.

`slopcheck` is available on this machine but was not invoked, because Phase 1 adds no dependency edge. If the planner introduces one (it should not), run the Package Legitimacy Gate before approving it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| TypeScript compiler | The entire phase — types **and** tests | ✓ | 5.9.3 | — |
| Node.js | running `tsc` | ✓ | 24.14.1 | — |
| pnpm | workspace resolution | ✓ | 10.33.0 | — |
| `@standard-schema/spec` | `types.ts` imports | ✓ | 1.1.0 (symlinked via pnpm store) | — |
| Test runner (Vitest) | **not required** | ✗ | — | **`tsc --noEmit` is the whole signal.** Phase 2 owns the runner. |
| Bundler (tsdown) | **not required** | ✗ | — | Phase 1 never emits. Phase 2 owns it. |
| CI | **not required** | ✗ | — | Local `pnpm typecheck` is the gate until Phase 2. |
| `@types/node` | **not required in the repo** | ✗ | — | Deliberately absent — CLAUDE.md forbids it in core ("pulls DOM-adjacent globals and silently defeats the no-DOM guarantee"). It was installed in an isolated `/tmp` sandbox purely to probe `webcrypto.subtle` assignability; **do not add it to the repo.** |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** test runner, bundler, CI — all Phase 2, all correctly absent, and Phase 1's design (D-06) is specifically built to not need them.

## Runtime State Inventory

Phase 1 ships no runtime and touches no deployed system. Each category is answered explicitly rather than left blank.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — verified: no database, no datastore, no persistence layer exists in the repo. `packages/concierge/src/` contains exactly two files (`types.ts`, `index.ts`), neither with runtime state. | none |
| Live service config | **None** — verified: no `.github/workflows`, no CI, no deployed service, no external SaaS configured. `ls -la` of repo root shows no CI or infra directories. | none |
| OS-registered state | **None** — verified: no scheduled tasks, no daemons, no process managers referenced anywhere in the repo. | none |
| Secrets/env vars | **None** — verified: `.gitignore` reserves `.env*` but no `.env` file exists and no code reads one. | none |
| Build artifacts | **`packages/concierge/dist/` does not exist** (never built; `dist/` is gitignored). `node_modules/` is present and current after `pnpm install --frozen-lockfile`. No stale artifact can carry an old type shape because nothing has ever been emitted. | none |

**The one non-code surface that *does* need updating:** `README.md` line 72 renders the old contract inline —

```
  reason?: string;   // stable machine-readable failure code
```

This is the **only** documentation reference to any type this phase changes. `grep -n "userTurnIdentity\|deferUntilDelivered\|readbackHash\|ConsentAck\|reason?:\|TransportCapabilities\|snapshotEquality" README.md` returns exactly that one line. `[VERIFIED: grep]` It sits inside README § "Design contract" item 2, which CONTEXT lists under "Public-facing statements these types must not contradict." **Add it to the plan as an explicit task** — it is a one-line edit that is easy to forget and would leave the published README contradicting the shipped type.

## Architecture Patterns

### System Architecture Diagram

Phase 1 has no runtime, so the diagram traces **how a type change propagates** — the dependency flow the planner must respect when ordering edits.

```
                              ┌──────────────────────────┐
   ENTRY: locked decisions    │  01-CONTEXT.md D-00..D-11 │
                              └────────────┬─────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
        ╔═══════════════════╗  ╔═══════════════════╗  ╔═══════════════════╗
        ║  INDEPENDENT      ║  ║   THE HINGE       ║  ║  INDEPENDENT      ║
        ║  (any order)      ║  ║   (ONE edit)      ║  ║  (any order)      ║
        ╠═══════════════════╣  ╠═══════════════════╣  ╠═══════════════════╣
        ║ D-00a ToolBatch   ║  ║  ConsentAck       ║  ║ D-10 Transport-   ║
        ║   .deferUntil-    ║  ║   ├ D-03 readback ║  ║   Capabilities    ║
        ║   Delivered       ║  ║   │   Hash doc    ║  ║   .userTurn-      ║
        ║                   ║  ║   ├ D-05 challenge║  ║   Identity        ║
        ║ D-01 ReasonCode   ║  ║   │   + attested  ║  ║                   ║
        ║   FailureReason   ║  ║   │     union     ║  ║ D-08 Scheduler    ║
        ║                   ║  ║   └ D-07 <Snap,   ║  ║   Session.stage   ║
        ║ D-02 MESSAGE_     ║  ║       Payload>    ║  ║   onStageChange   ║
        ║   MAX_CHARS       ║  ╚═════════╤═════════╝  ╚═══════════════════╝
        ║                   ║            │
        ║ D-03 Readback     ║            │ Snapshot / AckPayload must
        ║   ReadbackReceipt ║            │ reach the declaration
        ║   ReadbackSink    ║            ▼
        ║   DigestLike      ║  ╔═══════════════════════════════════╗
        ║                   ║  ║  ActionHandler<Args, Bridge,      ║
        ║ D-05 Server-      ║  ║      Snapshot, AckPayload>        ║
        ║   Challenge       ║  ╚═════════════════╤═════════════════╝
        ╚═════════╤═════════╝                    ▼
                  │          ╔═══════════════════════════════════╗
                  │          ║  ActionDefinition<N, S, B,        ║
                  │          ║      Snapshot, AckPayload>        ║
                  │          ║   + handler retyped               ║
                  │          ║   + consent?: ConsentPolicy<Snap> ║
                  │          ║   + D-04 readsUntrusted?          ║
                  │          ╚═════════════════╤═════════════════╝
                  │                            │
                  │             ⚠ BREAKS unless the erased view
                  │               lands in the SAME edit
                  │                            ▼
                  │          ╔═══════════════════════════════════╗
                  │          ║  AnyActionDefinition<B>           ║
                  │          ║   → StageDefinition.actions       ║
                  │          ║   → ConciergeConfig.crossStage    ║
                  │          ╚═════════════════╤═════════════════╝
                  └──────────┬─────────────────┘
                             ▼
                  ╔═══════════════════════════════════╗
                  ║  ConciergeConfig                  ║
                  ║   + presentReadback?: ReadbackSink║
                  ║   + digest?: DigestLike           ║
                  ║   + scheduler?: Scheduler         ║
                  ╚═════════════════╤═════════════════╝
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
     ╔═════════════════════════╗        ╔═════════════════════════╗
     ║  src/index.ts           ║        ║  test-d/*.test-d.ts     ║
     ║  export type { … }      ║        ║  (7 invariant groups)   ║
     ║  export { MESSAGE_… }   ║        ╚════════════╤════════════╝
     ╚════════════╤════════════╝                    │
                  └────────────┬────────────────────┘
                               ▼
                  ╔═══════════════════════════════════╗
                  ║  tsc -p tsconfig.test-d.json      ║ ← THE ONLY SIGNAL
                  ║  exit 0  ⇔  phase is green        ║   (~0.2 s)
                  ╚═════════════════╤═════════════════╝
                                    ▼
                        README.md:72 doc correction
                        (EXIT: contract and docs agree)
```

### Recommended Project Structure

Phase 1 adds **two** paths and edits **three** existing files. Nothing else moves.

```
packages/concierge/
├── src/
│   ├── types.ts              # EDIT — the entire type deliverable
│   └── index.ts              # EDIT — export surface (11 type + 1 value additions)
├── test-d/                   # NEW directory — never emitted
│   ├── results.test-d.ts     # D-01, D-02
│   ├── consent.test-d.ts     # D-03, D-05, D-07  (the hinge's tests)
│   ├── actions.test-d.ts     # D-04, D-07 threading, erasure
│   └── transport.test-d.ts   # D-00, D-10 (TRN-05), TRN-01 demonstration
├── tsconfig.json             # UNTOUCHED — preserves Phase 1 ∥ Phase 2 disjointness
├── tsconfig.test-d.json      # NEW — noEmit, rootDir override, covers both trees
└── package.json              # EDIT — one script line (see disjointness note below)
```

**Why `test-d/` and not `src/__type-tests__/`:** verified — a `*.test-d.ts` file inside the build tsconfig's `include` **is emitted to `dist/`**, producing `suite.test-d.js`, `suite.test-d.d.ts`, and both source maps. Keeping the tests out of `src/` means `tsconfig.json`'s `include: ["src/**/*.ts"]` needs **no `exclude` clause** — which is exactly what keeps this phase from touching a file Phase 2 also edits.

### Pattern 1: Two tsconfigs, one program each

**What:** `tsconfig.json` (build, unchanged) plus a new `tsconfig.test-d.json` (typecheck-only, covering `src` + `test-d`).
**When to use:** whenever a type-test suite must run under the exact production flags without polluting build output.

```jsonc
// packages/concierge/tsconfig.test-d.json   — NEW FILE
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "."          // ← REQUIRED. Without it: TS6059.
  },
  "include": ["src/**/*.ts", "test-d/**/*.ts"]
}
```

Verified behaviours:
- `declaration: true` (inherited) + `noEmit: true` **do not conflict** — no TS5053. `[VERIFIED: tsc 5.9.3 and 7.0.2]`
- Omitting the `rootDir` override produces `error TS6059: File '…/test-d/gaps.test-d.ts' is not under 'rootDir' '…/src'. 'rootDir' is expected to contain all source files.` `[VERIFIED]`
- Running the *build* config afterwards emits only `types.js`, `types.d.ts` and their maps — no test artifact. `[VERIFIED: ls dist/]`

**The one shared-file touch.** `packages/concierge/package.json` currently has `"typecheck": "tsc --noEmit"`, which uses `./tsconfig.json` and therefore would **not** see `test-d/`. Recommended: repoint that single script to `"tsc -p tsconfig.test-d.json"`. The test-d config includes `src/**/*.ts` too, so one command covers everything and `pnpm -r typecheck` from the root keeps working unchanged. This is a one-line edit to a file Phase 2 will also restructure — flag it in the plan as the phase's only expected merge point.

### Pattern 2: Predicate assertions, not bare `@ts-expect-error`

**What:** four type aliases. Zero runtime, zero dependencies, six lines.
**When to use:** every negative assertion that can be phrased as an assignability question — which is all of them except excess-property freshness.

```ts
export type Expect<T extends true> = T;
export type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends (<G>() => G extends B ? 1 : 2) ? true : false;
export type Assignable<From, To> = [From] extends [To] ? true : false;
export type Not<T extends boolean> = T extends true ? false : true;
```

Why this beats `@ts-expect-error` for negatives — all rows verified:

| Property | `@ts-expect-error` | `Expect<Not<Assignable<…>>>` |
|---|---|---|
| Fails when the invariant regresses | ✓ (TS2578 "Unused '@ts-expect-error' directive") | ✓ (TS2344 "Type 'false' does not satisfy the constraint 'true'") |
| Can be satisfied by an **unrelated** error (a typo, a misspelled property) | ✗ **yes — silently passes** | ✓ no |
| Can be scoped to an error code | ✗ **no** — `// @ts-expect-error TS2322` treats the code as free text, and a directive tagged `TS9999` still suppresses a `TS2322` | n/a |
| Names the invariant in the diagnostic | only in the comment, which `tsc` does not print | ✓ the alias name sits on the echoed source line |
| Models `exactOptionalPropertyTypes` | ✓ | ✓ **yes** — `{…, challenge: undefined}` fails the predicate |
| Models object-literal **freshness** (excess properties) | ✓ | ✗ **no** — `Assignable<{ok:true; message:"x"; extra:1}, ActionResult>` evaluates to `true` |

**Rule for the planner:** use the predicate everywhere; drop to `@ts-expect-error` **only** for excess-property tests, and when you do, place the directive on the line the error is actually reported on (see Pitfall 4).

### Anti-Patterns to Avoid

- **Splitting the `ConsentAck` change across three tasks.** D-03's doc reference, D-05's `challenge?` + `attested` union, and D-07's generics all rewrite the same declaration, and D-05 changes its *kind* (interface → type alias). Three tasks produce three conflicting versions and two intermediate red states. One task.
- **Adding `readsUntrusted` inside `SideEffects`.** D-04 forbids it (MCP's `openWorldHint` conflates ingress with egress). Verified detectable: mutant M7 was caught by `Equals<ActionDefinition["readsUntrusted"], boolean | undefined>` firing TS2339, plus an unused directive on the companion negative.
- **Switching `snapshotEquality` to method syntax while "tidying".** Method parameters are bivariant, so `ConsentPolicy<unknown>` would accept a `(a: Booking, b: Booking)` comparator and **silently un-break the exact defect Success Criterion 7 tests**. Mutant M9 confirmed the only symptom is a passing file with one unused `@ts-expect-error`. Keep function-property syntax here. (`DigestLike` is the deliberate opposite — see the mechanics section.)
- **Editing `packages/concierge/tsconfig.json`.** Adding a sibling config keeps Phase 1 and Phase 2 genuinely disjoint, which is the property D-06 exists to preserve.
- **Reordering `types.ts` "for readability" while editing.** Type declarations hoist; `AbandonReason` may stay below `ActionResult` even though `ReasonCode` references it. A reorder inflates the diff and buries the semantic changes.
- **Reinstating any of D-04's three cut fields** (`maxPerTurn`, `conflictsWith`, `impact`) as "cheap while we're in here." CONTEXT § Specific Ideas names this explicitly.

## Implementation Ordering

The edits interact. This is the verified dependency order.

### The hinge

`ConsentAck` is written **once**, folding three decisions:

| Decision | What it contributes to `ConsentAck` |
|---|---|
| D-03 | `readbackHash`'s doc comment now names `ReadbackSink` / `ReadbackReceipt` as its producer |
| D-05 | `challenge?: ServerChallenge`, **and** the interface → discriminated-union refactor making `grade: "attested"` require `readbackHash: string` |
| D-07 | `<Snapshot, Payload>` type parameters, preserved across that refactor |

Any two done separately force a rewrite of the third.

### Ordered task sequence

Numbers are dependency order, not necessarily task count. **Every step must leave `tsc -p tsconfig.test-d.json` at exit 0** — pair each type edit with its type-test in the same commit.

| # | Edit | Depends on | Why this position | Blocks |
|---|---|---|---|---|
| **0** | Create `test-d/` + `tsconfig.test-d.json` + the four assertion aliases; repoint the `typecheck` script | nothing | Wave 0. Without it there is no way to run a type test at all. | all |
| **1** | `FailureReason` + `ReasonCode`; `ActionResult.reason?: ReasonCode \| undefined`; `MESSAGE_MAX_CHARS`; `message` doc policy (D-01, D-02) | `AbandonReason` (present) | Self-contained. Verified not to disturb `USER_CANCELLED`, `USER_DECLINED`, or `ConsentPolicy.onMissing`. | 10, 11 |
| **2** | `ToolBatch.deferUntilDelivered` → `(effect: (report: DeliveryReport) => void) => void` (D-00a) | `DeliveryReport` (present) | Fully independent. The **only** edit in the phase that closes a genuine post-publish breaking change on a consumer-*implemented* interface — do it early so it cannot be dropped. | — |
| **3** | `Readback`, `ReadbackReceipt`, `ReadbackSink`, `DigestLike` (D-03) | nothing | Must precede the hinge's doc comment and step 7's `ConciergeConfig` seams. | 5, 7 |
| **4** | `ServerChallenge` (D-05, first half) | nothing | Must precede the hinge. | 5 |
| **5** | **THE HINGE** — `ConsentAck` interface → union, `challenge?`, `<Snapshot, Payload>` (D-03 + D-05 + D-07) | 3, 4 | One edit, per above. | 6 |
| **6** | `ActionHandler<Args, Bridge, Snapshot, AckPayload>`; then `ActionDefinition<Name, Schema, Bridge, Snapshot, AckPayload>` with `handler` retyped, `consent?: ConsentPolicy<Snapshot>`, `readsUntrusted?` (D-07 + D-04); **and in the same edit** the erased collection view applied to `StageDefinition.actions` and `ConciergeConfig.crossStage` | 5 | ⚠ `ActionHandler` must gain `Snapshot` **before** `ActionDefinition.handler` is retyped — one chain. ⚠ The erasure must land here or `types.ts` will not compile (Pitfall 1). | 7, 10 |
| **7** | `ConciergeConfig` gains `presentReadback?`, `digest?`, `scheduler?`, plus the `Scheduler` type (D-03, D-08) | 3, 6 | `crossStage` already erased by step 6; this step only adds seams. | 10 |
| **8** | `TurnIdentityProvenance`; `TransportCapabilities.userTurnIdentity` retyped (D-10 / TRN-05) | nothing | Independent of the hinge; can run at any point. Placed late only because its *naming* is the most review-sensitive item in the phase. | 10 |
| **9** | `Session.stage` + `Session.onStageChange` (D-08) | nothing | Independent. | 10 |
| **10** | `src/index.ts` — 11 type + 1 value export additions | 1–9 | Every new type must exist first. | 11 |
| **11** | `README.md:72` — `reason?: string` → the closed union | 1 | Doc/contract agreement. | — |

**Serial, not parallel.** `.planning/config.json` sets `parallelization: true`, but steps 1–9 all edit the same 540-line file and would conflict on nearly every hunk. Plan Phase 1 as a single serial wave. (Phase 2 remains genuinely parallel with it — it touches build config and CI, not `types.ts`.)

**Where the tests go.** Steps 1, 2, 5, 6, 8 each map to an invariant in Success Criterion 7. Land the matching test in the same commit as the step, so mutation resistance is established incrementally rather than in one large final task that is hard to review — and so no commit is ever red.

## Concrete Type-Level Mechanics

Everything in this section was compiled in a sandbox mirroring `packages/concierge` exactly (same `tsconfig.base.json`, same resolved `@standard-schema/spec@1.1.0`), under TypeScript 5.9.3 and 7.0.2. Where a claim carried in from discussion turned out to be imprecise, the correction is stated plainly.

### 1. The readback sink: what the two forms actually differ on

CONTEXT D-03 states the generic-**function** form is mandatory because "a typed app sink `(rb: Readback<Booking>) => …` fails to assign to the defaulted alias (TS2322)." **The first half is confirmed; the implication is not.** Verified assignability matrix:

| App sink shape | → `type Sink<P = unknown> = (rb: Readback<P>) => …` | → `type Sink = <P>(rb: Readback<P>) => …` |
|---|---|---|
| `(rb: Readback<Booking>) => …` (payload-specific) | **TS2322** | **TS2322 — also fails** |
| `<P>(rb: Readback<P>) => …` (generic) | ✓ | ✓ |
| `(rb: Readback<unknown>) => …` | ✓ | ✓ |
| `(rb: Readback<any>) => …` | ✓ | ✓ |
| `async (rb) => …` (contextually typed — the ergonomic path) | ✓ | ✓ |

`[VERIFIED: tsc 5.9.3 + 7.0.2]`

**Why a payload-specific sink fails under both forms.** The sink parameter is contravariant. The seam is called with `Readback<X>` for every payload type the app ever reviews, so a sink accepting only `Readback<Booking>` is genuinely unsound there. This is inherent to the position, not a consequence of the alias form. The diagnostic under the generic-function form:

```
Type '(rb: Readback<Booking>) => Promise<ReadbackReceipt>' is not assignable to type 'ReadbackSink'.
  Types of parameters 'rb' and 'rb' are incompatible.
    Type 'Readback<P>' is not assignable to type 'Readback<Booking>'.
      Type 'P' is not assignable to type 'Booking'.
```

**The decision still stands, for a different and testable reason.** The observable difference is *type preservation across the call*: with a defaulted alias, `ConciergeConfig.presentReadback?: ReadbackSink` instantiates `P` to `unknown` at the field, so core loses the payload type at every call site. With the generic function, `sink({ payload: booking })` infers `P = Booking`. That is exactly the `SnapshotNormalizer` precedent.

**Consequence for the suite — this was one of the three mutants that escaped.** Swapping the generic function for a defaulted alias produced **zero** diagnostics from a suite built around app-sink assignability, because every app-sink form behaves identically under both. Two assertions do catch it:

```ts
// structural: the seam must be a generic function
type _sinkShape = Expect<
  Equals<ReadbackSink, <P>(readback: Readback<P>) => Promise<ReadbackReceipt>>
>;

// behavioural: a generic function accepts no type argument; a generic alias does
// @ts-expect-error - ReadbackSink takes no type arguments; it is a generic function
type _sinkTakesNoTypeArgs = ReadbackSink<Booking>;
```

Under the correct form the second line is `TS2315: Type 'ReadbackSink' is not generic`, suppressed by the directive. Under the alias it compiles, so the directive goes unused → `TS2578`. Both fire on regression. `[VERIFIED: mutant M5, before and after]`

**Doc-comment obligation.** Because a payload-specific sink is rejected with a confusing contravariance message, the `ReadbackSink` doc comment must say, in one sentence: *write your sink generically — it is called with every payload type your app reviews.* Otherwise this becomes a support burden identical to the `snapshotEquality` trap the file already documents.

### 2. `DigestLike`: method syntax is load-bearing (and is the opposite of `snapshotEquality`)

Probed against the real `SubtleCrypto` from `lib.dom.d.ts` and the real `webcrypto.subtle` from current `@types/node`, both in an isolated `/tmp` sandbox — **`@types/node` was not added to this repo.**

| `DigestLike.digest` declared as | accepts browser `crypto.subtle` | accepts Node `webcrypto.subtle` |
|---|---|---|
| **method**, `(algorithm: "SHA-256", data: ArrayBuffer \| ArrayBufferView)` | ✓ | ✓ |
| **method**, `(algorithm: "SHA-256", data: ArrayBufferView<ArrayBuffer> \| ArrayBuffer)` | ✓ | ✓ |
| **function property**, `(algorithm: "SHA-256", data: ArrayBuffer \| ArrayBufferView) => …` | ✗ TS2322 | ✗ TS2322 |
| **function property**, `(algorithm: "SHA-256", data: ArrayBufferView<ArrayBuffer> \| ArrayBuffer) => …` | ✓ | ✗ TS2322 |
| **function property**, `(algorithm: string, data: ArrayBufferView<ArrayBuffer> \| ArrayBuffer) => …` | ✓ | ✗ TS2322 |

`[VERIFIED]` The two platforms define `BufferSource` differently — the DOM lib as `ArrayBufferView<ArrayBuffer> | ArrayBuffer`, `@types/node` as a union of concrete typed-array types (its `AlgorithmIdentifier` has also grown `CShakeParams`, `TurboShakeParams`, `KangarooTwelveParams`). **Only method-parameter bivariance bridges both.** Recommended declaration:

```ts
/**
 * Structural stand-in for the platform `SubtleCrypto`.
 *
 * Declared as a METHOD, not a function-valued property. Method parameters are
 * bivariant, and that is the only way one declaration accepts both the
 * browser's `crypto.subtle` and Node's `webcrypto.subtle` — their `BufferSource`
 * definitions differ, and a contravariant property signature rejects one or
 * both. Verified, not assumed.
 */
export interface DigestLike {
  digest(
    algorithm: "SHA-256",
    data: ArrayBuffer | ArrayBufferView,
  ): Promise<ArrayBuffer>;
}
```

Note the deliberate asymmetry: **`DigestLike` wants bivariance; `snapshotEquality` must not have it.** Both are correct for opposite reasons — one is a platform adapter that must accept a wider real implementation, the other is a guard whose entire purpose is to reject a widened comparator. A reviewer who "normalizes" the two styles breaks one of them. Say so in both doc comments.

Also verified under `lib: ["ES2022"]` with no DOM lib: `ArrayBuffer`, `ArrayBufferView`, `ArrayBufferView<ArrayBuffer>`, `Uint8Array<ArrayBuffer>`, `ArrayBufferLike` and `SharedArrayBuffer` **all resolve**; `crypto`, `TextEncoder` and `btoa` are **all TS2304**. Identical on 5.9.3 and 7.0.2 — this is the standing justification for D-03's injection design, reconfirmed on the installed compiler.

### 3. `ConsentAck`: interface → discriminated union

The verified working shape under `isolatedDeclarations` + `exactOptionalPropertyTypes` + `strict`:

```ts
interface ConsentAckBase<Snapshot, Payload> {
  userTurnId: string;
  responseId: string;
  snapshot: Snapshot;
  payload: Payload;
  /**
   * Server-issued, client-echoed, opaque. Never produced in v0.1.
   * OMIT it when absent — under exactOptionalPropertyTypes, spreading
   * `challenge: undefined` is rejected (TS2375).
   */
  challenge?: ServerChallenge;
}

export type ConsentAck<Snapshot = unknown, Payload = unknown> =
  | (ConsentAckBase<Snapshot, Payload> & {
      grade: Exclude<ConsentGrade, "attested">;
      readbackHash?: string | undefined;
    })
  | (ConsentAckBase<Snapshot, Payload> & {
      grade: "attested";
      readbackHash: string;
    });
```

Verified properties:

| Property | Result |
|---|---|
| Compiles under `isolatedDeclarations` | ✓ — a generic union type alias carries no explicit-annotation tax |
| `ack.grade === "attested"` narrows `readbackHash` to `string` | ✓ — discriminant narrowing works through the intersections; `return ack.readbackHash;` typechecks inside the guard |
| `ack.readbackHash` **without** narrowing | `string \| undefined` — usable via `?? ""` |
| Common members (`snapshot`, `payload`, `userTurnId`) readable without narrowing | ✓ — `Equals<typeof ack["snapshot"], Booking>` holds |
| Constructing `{ grade: "attested" }` with no hash | **rejected** — catchable by predicate, no `@ts-expect-error` needed |
| Constructing `{ …, challenge: undefined }` | **rejected** (TS2375) — also catchable by predicate |
| `CONSENT_GRADE_ORDER: readonly ConsentGrade[]` | ✓ unaffected |
| `.d.ts` emit | ✓ clean, including a **non-exported** `declare const … : unique symbol` backing `ServerChallenge` |

`[VERIFIED: prototype clean on 5.9.3 and 7.0.2; mutant M4 — flattening back to one interface — caught by two diagnostics]`

**`ServerChallenge` shape.** A branded string is recommended. Naming and shape are discretion per CONTEXT, but this particular form carries a security property worth having:

```ts
declare const serverChallengeBrand: unique symbol;
/** Opaque. Issued by a server, echoed by the client, never minted here. */
export type ServerChallenge = string & { readonly [serverChallengeBrand]: true };
```

Verified: `const forged: ServerChallenge = "i-made-this-up";` is **TS2322**. An app cannot construct one without an explicit cast, which *mechanically* enforces D-05's "typed but never produced in v0.1" rather than merely documenting it. Echoing a value received from a server assigns fine. The brand symbol need not be exported; `isolatedDeclarations` emits it correctly as a module-private `declare const`.

### 4. Threading `Snapshot` and `AckPayload`

```ts
export type ActionHandler<
  Args, Bridge, Snapshot = unknown, AckPayload = unknown,
> = (ctx: {
  args: Args;
  bridge: Bridge | null;
  meta: InvocationMeta;
  ack?: ConsentAck<Snapshot, AckPayload>;
}) => ActionResult | Promise<ActionResult>;

export interface ActionDefinition<
  Name extends string = string,
  Schema extends StandardSchemaV1 = StandardSchemaV1,
  Bridge = unknown,
  Snapshot = unknown,
  AckPayload = unknown,
> {
  // …
  handler: ActionHandler<InferOutput<Schema>, Bridge, Snapshot, AckPayload>;
  consent?: ConsentPolicy<Snapshot>;
}
```

Verified inference behaviour, via a `defineAction<N, S, B, Sn, Ak>` stand-in (Phase 3 owns the real one):

- Action **with** `consent.snapshotEquality: (a: Booking, b: Booking) => boolean` → `Snapshot` infers as `Booking`; `Equals<NonNullable<typeof action["consent"]>, ConsentPolicy<Booking>>` holds.
- Action **without** a consent policy → `Snapshot` and `AckPayload` both infer `unknown`; the definition equals `ActionDefinition<"filter", typeof schema, unknown, unknown, unknown>`.
- `Name` does **not** widen: `Equals<typeof action["name"], "confirmBooking">` holds even with `consent.requires: "reviewBooking"` present. The existing `requires: string` fix is preserved, and `Equals<ConsentPolicy<Booking>["requires"], string>` is the guard that catches a regression to a name union.

`[VERIFIED; mutant M10 caught]`

**Adding two type parameters is backward-compatible for existing references** — `ActionDefinition<string, StandardSchemaV1, B>` still resolves, defaults filling positions 4 and 5. That is not the problem. See Pitfall 1.

**The `ack` assertion is the one that catches a dropped forward.** Mutant M8 (reverting `handler` to `ActionHandler<InferOutput<Schema>, Bridge>`) escaped every obvious assertion, because `consent?: ConsentPolicy<Snapshot>` still infers `Snapshot` correctly on its own. The assertion that bites:

```ts
type Ctx = Parameters<ActionDefinition<"x", Sch, null, Booking, Ack>["handler"]>[0];
type _handlerAck    = Expect<Equals<Ctx["ack"],    ConsentAck<Booking, Ack> | undefined>>;
type _handlerArgs   = Expect<Equals<Ctx["args"],   { q: string }>>;
type _handlerBridge = Expect<Equals<Ctx["bridge"], null>>;
```

### 5. `Pick<ActionResult, "reason" | "message">` survives — and the rejected alternative genuinely does not

`ConsentPolicy.onMissing` uses `Pick<ActionResult, "reason" | "message">` (`types.ts:245`). Verified after D-01:

- `{ reason: "consent_required", message: "Review first." }` assigns ✓
- `{ reason: "nope", message: "x" }` is rejected ✓ — the closed union propagates through `Pick`
- The **rejected** `ok`-discriminated-union alternative really does break it: `Pick<{ok:true; message:string} | {ok:false; reason:"declined"; message:string}, "reason" | "message">` errors, because `keyof` a union is the key *intersection*. `[VERIFIED]` D-01's rejection rationale holds mechanically, so a future reviewer proposing it can be answered with a compile error.

### 6. `MESSAGE_MAX_CHARS` keeps its literal type

`export const MESSAGE_MAX_CHARS = 180;` emits as `export declare const MESSAGE_MAX_CHARS = 180;` — the literal survives `isolatedDeclarations` with no explicit annotation. `[VERIFIED: read from the emitted .d.ts]` So `Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>` is a valid guard against someone widening it to `number` or changing the bound silently.

## Export Surface Impact

Every new exported type must be added to `packages/concierge/src/index.ts`. The current file exports 29 types and 3 values. **Additions: 11 types + 1 value.** The complete replacement export block was compiled against the prototype under `verbatimModuleSyntax` (types via `export type { … }`, the constant via `export { … }`) and is clean on both compilers.

| # | Name | Kind | Decision | Notes |
|---|---|---|---|---|
| 1 | `FailureReason` | type | D-01 | Machine-caused subset. Export it so Phase 6 can narrow on it directly. |
| 2 | `ReasonCode` | type | D-01 | `AbandonReason \| FailureReason` — the union `ActionResult.reason` uses. |
| 3 | `Readback` | interface | D-03 | `{ payload, presented? }` — the sink's input. |
| 4 | `ReadbackReceipt` | interface | D-03 | `{ hash, alg, canonicalization, canonical }`. |
| 5 | `ReadbackSink` | type | D-03 | The generic-function seam. |
| 6 | `DigestLike` | interface | D-03 | Method syntax. Joins `AbortSignalLike` as the second structural stand-in. |
| 7 | `ServerChallenge` | type | D-05 | Opaque branded string. The brand `unique symbol` is **not** exported. |
| 8 | `TurnIdentityProvenance` | type | D-10 / TRN-05 | Consumers implementing `TransportCapabilities` need the union by name. |
| 9 | `Scheduler` | type | D-08 | The type behind `ConciergeConfig.scheduler?`. |
| 10 | `AnyActionDefinition` | type | mechanics (Pitfall 1) | The erased collection view. **Must be exported** — `StageDefinition.actions` and `ConciergeConfig.crossStage` reference it in the public surface, so it cannot stay module-private. |
| 11 | `ReadbackAttestation` | type | deferred → Phase 8 | **Optional for Phase 1.** See Open Questions #1. |
| 12 | `MESSAGE_MAX_CHARS` | **value** | D-02 | Joins `USER_CANCELLED`, `USER_DECLINED`, `CONSENT_GRADE_ORDER` in the value export. |

**No exports are removed.** `AbandonReason` stays exported — D-01 reuses it as a named subset, which closes the orphan defect rather than deleting the symbol.

**These change shape but keep their names,** so they need no `index.ts` edit beyond what is already listed: `ActionResult`, `ConsentAck`, `ConsentPolicy`, `ActionDefinition`, `ActionHandler`, `TransportCapabilities`, `ToolBatch`, `Session`, `ConciergeConfig`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Type-level equality assertion | A bespoke deep-equality conditional type | The conditional-identity trick: `(<G>() => G extends A ? 1 : 2) extends (<G>() => G extends B ? 1 : 2)` | It is the only known formulation that is *invariant* (distinguishes `any` from `unknown`, `{a?: x}` from `{a: x \| undefined}`). Naive `A extends B ? B extends A ? true : false : false` silently passes on those cases — exactly the cases `exactOptionalPropertyTypes` makes load-bearing here. Verified working. |
| Hashing / canonicalization in core | SHA-256, UTF-8 encoding, base64 | Inject `DigestLike`; defer JCS to Phase 8 | `crypto`, `TextEncoder`, `btoa` are all TS2304 under `lib: ["ES2022"]` (re-verified). D-03 already rejected bundling. |
| Excluding tests from the published artifact | A `.npmignore`, or an `exclude` in the build tsconfig | A sibling `test-d/` directory outside `src/` | `package.json` already has `"files": ["dist", …]`, and the build config already has `include: ["src/**/*.ts"]`. Putting tests outside `src/` means neither has to change — which is what preserves Phase 1 ∥ Phase 2 disjointness. |
| Making a type "unconstructable by apps" | Runtime guards, naming conventions, doc comments alone | A `unique symbol` brand | Verified: `const forged: ServerChallenge = "…"` is TS2322. The compiler enforces D-05's produce-nothing rule; a comment does not. |
| A structural stand-in for a platform type | Importing `DOM` or `@types/node` | The `AbortSignalLike` pattern, with **method** syntax where a real platform type must assign | Verified both directions. Importing either lib defeats the no-DOM guarantee that `lib: ["ES2022"]` enforces mechanically. |

**Key insight:** in this phase the compiler is simultaneously the specification, the implementation, and the test runner. Anything expressible as a type constraint should be one, because that is the only artifact that survives into Phases 3–9 without a human remembering it. Anything *not* expressible — message length, canonicalization correctness, `readsUntrusted` enforcement — must be explicitly handed to a later phase with a requirement ID, which CONTEXT has already done (SEC-05, SEC-06, DSP-09, CON-10).

## Common Pitfalls

### Pitfall 1: Threading `Snapshot` breaks `StageDefinition.actions` — `types.ts` will not compile

**What goes wrong:** D-07 adds `Snapshot` to `ActionDefinition`. The moment an action is declared with a concrete `Snapshot`, it stops being assignable to the collection types that hold it.

```
error TS2375: Type 'ActionDefinition<"confirmBooking", StandardSchemaV1<unknown, unknown>,
  unknown, Booking, { id: string; }>' is not assignable to type
  'ActionDefinition<string, StandardSchemaV1<unknown, unknown>, unknown, unknown, unknown>'
  with 'exactOptionalPropertyTypes: true'.
    Type 'unknown' is not assignable to type 'Booking'.
```

**Why it happens:** `snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean` puts `Snapshot` in a contravariant position, and the handler's `ctx.ack?: ConsentAck<Snapshot, …>` puts it in a second one. `ConsentPolicy<Booking>` is therefore **not** assignable to `ConsentPolicy<unknown>` — verified independently, same TS2375. Both `StageDefinition.actions` (`types.ts:406`) and `ConciergeConfig.crossStage` (`types.ts:488`) are declared with the erased-to-`unknown` form today.

**How to avoid:** introduce an erased view type and apply it to both collection sites **in the same edit as D-07**. Two erasures were verified to work:

| Erasure | Accepts heterogeneous actions | Downstream cost |
|---|---|---|
| `ActionDefinition<string, StandardSchemaV1, B, any, any>` | ✓ | `snapshotEquality` is callable from Phases 4/6/8 with no cast, but `any` enters the public surface |
| `ActionDefinition<string, StandardSchemaV1, B, never, never>` | ✓ | No `any`, but `snapshotEquality` types as `(a: never, b: never) => boolean` and the kernel needs a cast to invoke it |

Recommended: the `any` form, exported as a named `AnyActionDefinition<Bridge = unknown>` with a doc comment stating that the erasure is deliberate and that the concrete `Snapshot` lives on the individual declaration. The kernel is the one place that must call `snapshotEquality`, and forcing a cast there is worse than one documented `any` in a collection type. **Either way the planner must choose explicitly — omitting the erasure is not an option, the file does not compile.**

**Warning signs:** TS2375 mentioning `is not assignable to type 'ActionDefinition<…, unknown, unknown>'` while editing step 6.

### Pitfall 2: The three assertions that look sufficient and are not

Seven of ten mutants were caught by a first-draft suite. Three escaped, and each needed a purpose-built assertion. A plan that lists "write type tests for the seven criteria" without naming these will produce a green suite over a broken contract.

| Escaped mutant | Why the obvious assertion missed it | The assertion that catches it |
|---|---|---|
| **M5** — `ReadbackSink` reverted to a defaulted generic alias | Every app-sink form assigns identically under both shapes (see mechanics §1) | `Equals<ReadbackSink, <P>(rb: Readback<P>) => Promise<ReadbackReceipt>>` **and** `// @ts-expect-error` on `ReadbackSink<Booking>` |
| **M8** — `ActionDefinition.handler` reverted to `ActionHandler<Args, Bridge>` | `consent?: ConsentPolicy<Snapshot>` still infers `Snapshot` correctly on its own, so every consent assertion still passes | `Equals<Parameters<ActionDefinition<…, Booking, Ack>["handler"]>[0]["ack"], ConsentAck<Booking, Ack> \| undefined>` |
| **M2** — `ToolBatch.deferUntilDelivered` reverted to `(id: string) => void` | Nothing in a consent-shaped suite reads `ToolBatch` | `Equals<NonNullable<ToolBatch["deferUntilDelivered"]>, (effect: (report: DeliveryReport) => void) => void>` plus `Not<Assignable<(effect: (id: string) => void) => void, …>>` — and the same pair against `InvocationMeta`, since Success Criterion 1 says *both* hooks |

**Warning sign:** a type-test task that completes without the developer ever having seen it fail. Every assertion in this suite should be authored by first breaking the type, watching the diagnostic, then fixing it.

### Pitfall 3: `@ts-expect-error` suppresses the *wrong* error and the test still passes

**What goes wrong:**

```ts
// @ts-expect-error - intended to test that an arbitrary reason is rejected
const d: ActionResult = { ok: false, resaon: "declined", messag: "x" };
//                                   ^^^^^^              ^^^^^^  typos
```

This compiles clean. The directive is "used" — by two typos — so the intended invariant is never exercised. `[VERIFIED]`

**Why it happens:** `@ts-expect-error` asserts *that some error occurred on the next line*, not *which*. TypeScript has no error-code scoping: `// @ts-expect-error TS2322` treats the code as free-form description text, and a directive tagged with a nonexistent `TS9999` still suppresses a real `TS2322`. `[VERIFIED on 5.9.3 and 7.0.2]`

**How to avoid:** prefer `Expect<Not<Assignable<Bad, Target>>>`, which asserts a *specific relationship* and cannot be satisfied by a typo. Verified: the predicate correctly models `exactOptionalPropertyTypes` (so `challenge: undefined` and `attested`-without-hash are both catchable without any directive). Reserve `@ts-expect-error` for object-literal freshness, which the predicate cannot model — `Assignable<{ok:true; message:"x"; extra:1}, ActionResult>` evaluates to `true` while the fresh literal is correctly rejected.

**Warning signs:** any `@ts-expect-error` whose next line contains more than one thing that could be wrong.

### Pitfall 4: `@ts-expect-error` covers the next *line*, not the next *expression*

```ts
// @ts-expect-error
const c: ActionResult = {
  ok: false,
  reason: "whoops",   // ← the error is reported HERE, line 4
  message: "x",
};
```

Produces **two** errors: `TS2578: Unused '@ts-expect-error' directive` on the directive's line, and the real `TS2322` on the property line. `[VERIFIED]`

Whether this bites depends on the error kind: a *missing required property* is reported on the declaration line (so a multi-line `attested`-without-hash literal works), while an *excess or mistyped property* is reported on the property line. Do not rely on the distinction — either write negative literals on a single line, or put the directive immediately above the property.

### Pitfall 5: `isolatedDeclarations` punishes a test file that is not a module

**What goes wrong:** a `.test-d.ts` with no `import` and no `export` is a global script, and `isolatedDeclarations` then treats every top-level declaration as declaration-emitting:

```
error TS9010: Variable must have an explicit type annotation with --isolatedDeclarations.
```

`[VERIFIED]` — this makes ordinary assignability tests (`const x = defineAction({…})`) impossible to write without annotating the very thing under test.

**How to avoid:** every test-d file must be a module. A single `import type { … } from "../src/types.js"` is sufficient — verified, even though `verbatimModuleSyntax` erases it at emit. A shared assertion-helper file with no imports needs an explicit `export {}`. Non-exported locals inside a module have **no** annotation requirement; *exported* ones do.

Related, and helpful: `noUnusedLocals` is **not** set in `tsconfig.base.json`, so unused `const _x: T = y;` assertions need no `void _x;` guard. `[VERIFIED]`

### Pitfall 6: The build tsconfig will happily ship your tests

With `include: ["src/**/*.ts"]` and `rootDir: "./src"`, a `src/foo.test-d.ts` emits `dist/foo.test-d.js`, `dist/foo.test-d.d.ts`, and both maps. `[VERIFIED: ls dist/]` The emitted JS contains real executable statements (`const _badReason = { ok: false, reason: "whoops", message: "x" };`), so this is not merely untidy — it publishes dead code and an inaccurate declaration surface.

`package.json`'s `"files": ["dist", …]` does not save you, because the pollution is *inside* `dist`. Keep test files out of `src/`.

### Pitfall 7: Method syntax on `snapshotEquality` silently un-breaks the defect under test

Changing `snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean` to `snapshotEquality?(a: Snapshot, b: Snapshot): boolean` makes the parameters bivariant, so a `(a: Booking, b: Booking)` comparator assigns to `ConsentPolicy<unknown>` and the Success-Criterion-7 guard stops guarding. The **only** symptom is a single `TS2578: Unused '@ts-expect-error' directive` — easy to "fix" by deleting the test. `[VERIFIED: mutant M9]`

Add a comment on the declaration saying the function-property syntax is deliberate. This is genuinely counter-intuitive next to `DigestLike`, which requires the opposite.

### Pitfall 8: `tsconfig.test-d.json` without a `rootDir` override

```
error TS6059: File '…/test-d/gaps.test-d.ts' is not under 'rootDir' '…/src'.
  'rootDir' is expected to contain all source files.
```

`[VERIFIED]` `rootDir` is inherited from the extended config and is not relaxed by `noEmit`. Set `"rootDir": "."` in the test-d config.

### Pitfall 9: CONTEXT D-06 cites a stale success-criterion number

D-06 refers to "Success Criterion 5" for the type-test suite and its three named regressions. The current ROADMAP numbers that criterion **7** — criteria 5 (TRN-05 provenance) and 6 (compiler-enforced `attested ⇒ readbackHash`) were inserted after D-06 was written. The *content* is unchanged; only the numbering moved. The planner should map against ROADMAP's seven criteria, not CONTEXT's numbering.

## Code Examples

Verified patterns. Every snippet below compiled clean in the sandbox under both TypeScript 5.9.3 and 7.0.2 with the repo's exact flags.

### The assertion helpers

```ts
// packages/concierge/test-d/_assert.ts
export {};   // required: this file has no imports, so it needs to be a module

export type Expect<T extends true> = T;
export type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends (<G>() => G extends B ? 1 : 2) ? true : false;
export type Assignable<From, To> = [From] extends [To] ? true : false;
export type Not<T extends boolean> = T extends true ? false : true;
```

### SC-2 — `reason` is a closed union, and exhaustiveness still compiles

```ts
type _reasonClosed = Expect<
  Not<Assignable<{ ok: false; reason: "whoops"; message: "x" }, ActionResult>>
>;
type _reasonAdmitsAbandon       = Expect<Assignable<{ ok: false; reason: "declined";       message: "x" }, ActionResult>>;
type _reasonAdmitsInvalidResult = Expect<Assignable<{ ok: false; reason: "invalid_result"; message: "x" }, ActionResult>>;
// exactOptionalPropertyTypes: an explicit undefined must still be accepted (D-01)
type _reasonAdmitsUndefined     = Expect<Assignable<{ ok: true;  reason: undefined;        message: "x" }, ActionResult>>;

// object-literal freshness needs the directive — the predicate cannot model it
// @ts-expect-error - arbitrary reason strings do not typecheck
const _badReason: ActionResult = { ok: false, reason: "whoops", message: "x" };

// a code added in Phase 6 or 8 forces every mapper to update
declare const r: ActionResult;
function exhaust(): string {
  switch (r.reason) {
    case "declined": case "cancelled": case "superseded":
    case "invalid_args": case "invalid_result": case "unknown_action":
    case "no_bridge": case "handler_error": case "aborted":
    case "consent_required": case "consent_stale": case "grade_unavailable":
      return r.reason;
    case undefined:
      return "";
    default: {
      const _never: never = r.reason;   // ← breaks when a code is added
      return _never;
    }
  }
}

// the computed-reason idiom D-01's `| undefined` exists to permit
declare function computeReason(): ActionResult["reason"];
const _computed: ActionResult = { ok: false, reason: computeReason(), message: "x" };

// D-02's bound is a literal, not `number`
type _messageBound = Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>;
```

### SC-7a — `snapshotEquality` must not degrade to `unknown`

```ts
const eq = (a: Booking, b: Booking): boolean => a.amount === b.amount;

const _policyTyped: ConsentPolicy<Booking> = {
  requires: "review", bindTo: "userTurn", snapshotEquality: eq,
};

// @ts-expect-error - a Booking comparator must NOT fit ConsentPolicy<unknown>
const _policyDegraded: ConsentPolicy = {
  requires: "review", bindTo: "userTurn", snapshotEquality: eq,
};

// and `requires` must stay `string`, not the action's own name union
type _requiresIsString = Expect<Equals<ConsentPolicy<Booking>["requires"], string>>;

// declaring an action with a `requires` target must not widen `Name`
const confirm = defineAction({
  name: "confirmBooking",
  description: "Confirm the booking.",
  schema, redact: "drop",
  handler: () => ({ ok: true, message: "Done." }),
  consent: { requires: "reviewBooking", bindTo: "userTurn", snapshotEquality: eq },
});
type _nameNotWidened   = Expect<Equals<(typeof confirm)["name"], "confirmBooking">>;
type _snapshotInferred = Expect<Equals<NonNullable<(typeof confirm)["consent"]>, ConsentPolicy<Booking>>>;
```

### SC-1 — *both* delivery hooks carry the completion outcome

```ts
type _metaHook = Expect<Equals<
  NonNullable<InvocationMeta["deferUntilDelivered"]>,
  (effect: (report: DeliveryReport) => void) => void
>>;
type _batchHook = Expect<Equals<
  NonNullable<ToolBatch["deferUntilDelivered"]>,
  (effect: (report: DeliveryReport) => void) => void
>>;
// a hook that drops the outcome must not fit
type _batchRejectsBareId = Expect<Not<Assignable<
  (effect: (id: string) => void) => void,
  NonNullable<ToolBatch["deferUntilDelivered"]>
>>>;
```

### SC-6 — `attested ⇒ readbackHash`, enforced by the compiler

```ts
const _attestedOk: ConsentAck<Booking, { id: string }> = {
  userTurnId: "t1", responseId: "r1", snapshot: booking, payload: { id: "a" },
  grade: "attested", readbackHash: "abc",
};

// predicate form — no directive needed, and it names the invariant on failure
type _attestedNeedsHash = Expect<Not<Assignable<
  { userTurnId: string; responseId: string; snapshot: Booking; payload: null; grade: "attested" },
  ConsentAck<Booking, null>
>>>;

// D-05's omit-don't-spread caveat, also a predicate
type _challengeMustBeOmitted = Expect<Not<Assignable<
  { userTurnId: string; responseId: string; snapshot: Booking; payload: null;
    grade: "relayed"; challenge: undefined },
  ConsentAck<Booking, null>
>>>;

// narrowing still works through the union-of-intersections
declare const ack: ConsentAck<Booking, { id: string }>;
function narrows(): string {
  if (ack.grade === "attested") return ack.readbackHash;   // string
  return ack.readbackHash ?? "";                            // string | undefined
}
type _commonSnapshot = Expect<Equals<(typeof ack)["snapshot"], Booking>>;

// D-05's produce-nothing rule, mechanically enforced
// @ts-expect-error - a ServerChallenge cannot be constructed from a plain string
const _forged: ServerChallenge = "i-made-this-up";
```

### SC-3 — the readback sink accepts a real app sink

```ts
// the ergonomic path: contextually typed, no annotations
const genericSink: ReadbackSink = async (rb) => {
  void JSON.stringify(rb.payload);
  return receipt;
};
// the explicit path
const explicitGeneric: ReadbackSink = async <P,>(rb: Readback<P>): Promise<ReadbackReceipt> => {
  void rb.payload;
  return receipt;
};
// core keeps the payload type across the call
declare const sink: ReadbackSink;
const _call: Promise<ReadbackReceipt> = sink({ payload: booking });

// the two assertions that actually detect a defaulted-alias regression
type _sinkShape = Expect<Equals<
  ReadbackSink, <P>(readback: Readback<P>) => Promise<ReadbackReceipt>
>>;
// @ts-expect-error - ReadbackSink takes no type arguments; it is a generic function
type _sinkTakesNoTypeArgs = ReadbackSink<Booking>;

// DigestLike accepts a SubtleCrypto-shaped object without importing DOM
declare const subtleish: {
  digest(algorithm: string | { name: string }, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
};
const _digest: DigestLike = subtleish;
```

### SC-7 (D-04) — `readsUntrusted` is on the declaration, not inside `SideEffects`

```ts
type _readsUntrustedOnDefinition = Expect<
  Equals<ActionDefinition["readsUntrusted"], boolean | undefined>
>;
// @ts-expect-error - readsUntrusted must NOT be a SideEffects member (D-04)
type _notInSideEffects = NonNullable<ActionDefinition["effects"]>["readsUntrusted"];
```

### SC-5 (TRN-05) — turn-identity provenance

```ts
// the boolean must be gone
type _provenanceNotBoolean = Expect<Not<Assignable<true, TransportCapabilities["userTurnIdentity"]>>>;

// a recognizer-derived transport and a click-derived transport are distinguishable
const _voiceCaps: TransportCapabilities = {
  consentGrade: "relayed",  userTurnIdentity: "agent-forgeable",
  parallelCalls: false, dynamicCatalog: true,
};
const _paletteCaps: TransportCapabilities = {
  consentGrade: "attested", userTurnIdentity: "human-attested",
  parallelCalls: false, dynamicCatalog: true,
};
```

Member names are discretion. The locked property is the *axis*: forgeable by the agent's own output versus not — never voice versus text.

### TRN-01 — two unrelated transports, one interface

```ts
declare const noop: () => void;

// shaped like a realtime/WebRTC session
const webrtcish: Transport = {
  capabilities: { consentGrade: "relayed", userTurnIdentity: "agent-forgeable",
                  parallelCalls: true, dynamicCatalog: true },
  setTools: () => {}, onToolBatch: () => noop, respond: () => {},
};

// shaped like a synchronous command palette — shares no wire vocabulary
const paletteish: Transport = {
  capabilities: { consentGrade: "attested", userTurnIdentity: "human-attested",
                  parallelCalls: false, dynamicCatalog: false },
  setTools: () => {}, onToolBatch: () => noop, respond: () => {},
};

// and no vendor vocabulary leaked into core
type _transportKeys = Expect<Equals<
  keyof Transport, "capabilities" | "setTools" | "onToolBatch" | "respond"
>>;
```

### What a regression actually looks like to a developer

Reverting `consent?: ConsentPolicy<Snapshot>` to `consent?: ConsentPolicy`:

```
packages/concierge/test-d/actions.test-d.ts:104:61 - error TS2322: Type
  '(a: Booking, b: Booking) => boolean' is not assignable to type
  '(a: unknown, b: unknown) => boolean'.
  Types of parameters 'a' and 'a' are incompatible.
    Type 'unknown' is not assignable to type 'Booking'.

104   consent: { requires: "reviewBooking", bindTo: "userTurn", snapshotEquality: eq },
                                                               ~~~~~~~~~~~~~~~~

packages/concierge/test-d/actions.test-d.ts:107:33 - error TS2344: Type 'false'
  does not satisfy the constraint 'true'.

107 type _snapshotInferred = Expect<Equals<NonNullable<(typeof confirm)["consent"]>, ConsentPolicy<Booking>>>;
                                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Found 2 errors in the same file, starting at: packages/concierge/test-d/actions.test-d.ts:104
```

**`Type 'false' does not satisfy the constraint 'true'` carries no information by itself.** The signal comes entirely from `tsc` echoing the offending source line, which is why **every assertion alias must be named after the invariant it guards** (`_snapshotInferred`, `_attestedNeedsHash`, `_batchRejectsBareId`, `_provenanceNotBoolean`). A suite of `type _1`, `type _2` would be unreadable on failure. Make the naming convention an explicit instruction in the plan.

## Validation Architecture

Phase 1 has an unusual validation shape: **there is no test runner, and there will not be one until Phase 2.** The compiler is the entire verification apparatus. `tsc --noEmit` exiting 0 is the only signal, and every Success Criterion must be reduced to something that makes it exit non-zero.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **`tsc --noEmit`** — TypeScript **5.9.3** (installed; root `package.json` pins `^5.7.0`) |
| Assertion library | **none** — 4 hand-written type aliases (`Expect`, `Equals`, `Assignable`, `Not`), 6 lines total, zero dependencies |
| Config file | `packages/concierge/tsconfig.test-d.json` — **none yet, see Wave 0** |
| Test file glob | `packages/concierge/test-d/**/*.test-d.ts` — **none yet, see Wave 0** |
| Quick run command | `pnpm --filter @fullselfbrowsing/concierge typecheck` |
| Full suite command | `pnpm --filter @fullselfbrowsing/concierge typecheck` — *identical; there is only one program* |
| Workspace-wide command | `pnpm typecheck` (root, runs `pnpm -r typecheck`) |
| Current state | Exits **0 clean** today against `src/` only. `[VERIFIED]` |

Verified compiler-version independence: **every** experiment behind this document was re-run under TypeScript **7.0.2** (npm `latest`) and produced byte-identical diagnostics. D-06's claim that no Phase 1 decision depends on which compiler is installed is confirmed, so Phase 2's bump cannot invalidate this suite.

### Phase Requirements → Test Map

The phase has two mapped requirement IDs (TRN-01, TRN-05) and seven ROADMAP Success Criteria. All nine are reducible to compiler assertions; **none is manual-only.**

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **TRN-01** | A transport is definable end to end with no vendor event name in core, demonstrated by a second transport sharing no wire vocabulary with the first | type (structural) | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ Wave 0 → `test-d/transport.test-d.ts` |
| **TRN-05** | `TransportCapabilities` declares turn-identity *provenance*; a boolean no longer satisfies the field | type (negative + positive) | same | ❌ Wave 0 → `test-d/transport.test-d.ts` |
| **SC-1** | *Both* `InvocationMeta.deferUntilDelivered` and `ToolBatch.deferUntilDelivered` carry a `DeliveryReport`; a bare-id hook is rejected | type (equality + negative) | same | ❌ Wave 0 → `test-d/transport.test-d.ts` |
| **SC-2** | An arbitrary `reason` string fails to typecheck; the 13 codes are exhaustively switchable; `MESSAGE_MAX_CHARS` is a literal | type (negative + exhaustiveness + equality) | same | ❌ Wave 0 → `test-d/results.test-d.ts` |
| **SC-3** | A readback sink returning `{hash, alg, canonicalization, canonical}` is declarable and the seam is a generic *function* | type (equality + `@ts-expect-error` on a type argument) | same | ❌ Wave 0 → `test-d/consent.test-d.ts` |
| **SC-4** | = TRN-01 (two structurally unrelated transports; `keyof Transport` is exactly four members) | type (structural) | same | ❌ Wave 0 → `test-d/transport.test-d.ts` |
| **SC-5** | = TRN-05 | type | same | ❌ Wave 0 → `test-d/transport.test-d.ts` |
| **SC-6** | Constructing an `attested` ack without `readbackHash` fails; narrowing on `grade` yields `string` | type (predicate + narrowing) | same | ❌ Wave 0 → `test-d/consent.test-d.ts` |
| **SC-7a** | `snapshotEquality` degraded to `(a: unknown, b: unknown)` is caught | type (`@ts-expect-error`) | same | ❌ Wave 0 → `test-d/actions.test-d.ts` |
| **SC-7b** | A `requires` that widens the action's own name union is caught | type (equality on `Name` + on `requires`) | same | ❌ Wave 0 → `test-d/actions.test-d.ts` |
| **SC-7c** | A delivery hook dropping the completion reason is caught on *either* interface | type | same | ❌ Wave 0 → `test-d/transport.test-d.ts` |
| **SC-7d** | An arbitrary `reason` string is rejected | type | same | ❌ Wave 0 → `test-d/results.test-d.ts` |
| **SC-7e** | A readback sink that rejects a typed app sink is caught | type — **see Pitfall 2; the naive assertion does not work** | same | ❌ Wave 0 → `test-d/consent.test-d.ts` |
| **SC-7f** | An `attested` ack with no hash is rejected | type (predicate) | same | ❌ Wave 0 → `test-d/consent.test-d.ts` |
| **SC-7g** | `readsUntrusted` is on the declaration and absent from `SideEffects` | type (equality + `@ts-expect-error`) | same | ❌ Wave 0 → `test-d/actions.test-d.ts` |
| *(mechanics)* | `ActionDefinition.handler` forwards `Snapshot` **and** `AckPayload` to `ctx.ack` | type — **see Pitfall 2; escapes every consent assertion** | same | ❌ Wave 0 → `test-d/actions.test-d.ts` |
| *(mechanics)* | Heterogeneous actions still assemble into `StageDefinition.actions` and `ConciergeConfig.crossStage` | type (positive) | same | ❌ Wave 0 → `test-d/actions.test-d.ts` |

**No manual-only checks.** The one item not expressible as a type assertion — the `README.md:72` doc correction — is verified by inspection during code review, not by the compiler.

### Suite Adequacy Requirement

A green suite is not evidence of a working suite. **Each assertion must be authored by first reintroducing the defect, observing the diagnostic, then fixing it.** This is the empirically-grounded requirement, not a stylistic preference: a ten-mutant battery against a first-draft suite let **three** mutants through (see Pitfall 2). Recommend the plan carry an explicit verification step per test task worded as:

> Temporarily revert the corresponding type edit, confirm `pnpm --filter @fullselfbrowsing/concierge typecheck` exits **non-zero** and names the intended assertion alias, then restore.

The ten mutants worth running as a final phase-gate check, with their verified catch signatures:

| Mutant | Reintroduced defect | Expected diagnostics |
|---|---|---|
| M1 | `reason` back to open `string` | 5 errors incl. TS2578, TS2322 on the `never` exhaustiveness arm, TS2375 on the computed idiom |
| M2 | `ToolBatch` hook drops the outcome | 2 × TS2344 (`_batchHook`, `_batchRejectsBareId`) |
| M3 | `ActionDefinition` drops the `ConsentPolicy` type argument | TS2322 + TS2344 (`_snapshotInferred`) |
| M4 | `ConsentAck` flattened back to one interface | TS2578 + TS2322 in the narrowing function |
| M5 | `ReadbackSink` as a defaulted generic alias | TS2344 (`_sinkShape`) + TS2578 (`_sinkTakesNoTypeArgs`) |
| M6 | `userTurnIdentity` back to `boolean` | 5 errors incl. TS2344 (`_provenanceNotBoolean`) |
| M7 | `readsUntrusted` moved into `SideEffects` | TS2339 + TS2578 |
| M8 | `handler` drops `Snapshot`/`AckPayload` | TS2344 (`_handlerAck`) |
| M9 | `snapshotEquality` switched to method syntax | TS2578 on `_policyDegraded` |
| M10 | `requires` typed as the action's name union | TS2344 (`_requiresIsString`) |

### Sampling Rate

The full program — `types.ts` + `index.ts` + all `test-d/` files — typechecks in **~0.2 s** on TypeScript 5.9.3 and **~0.08 s** on 7.0.2 (measured, three runs each; ~0.4 s wall-clock through `pnpm`'s wrapper). There is no cost argument for sampling less than everything, every time.

- **Per task commit:** `pnpm --filter @fullselfbrowsing/concierge typecheck` — must exit 0. No commit in this phase may be red; every type edit lands with its assertion in the same commit.
- **Per wave merge:** identical command. Phase 1 is a single serial wave (all edits touch `types.ts`), so this collapses into the per-commit gate.
- **Phase gate before `/gsd-verify-work`:** (a) `pnpm typecheck` from the repo root exits 0; (b) the ten-mutant battery above has been run and every mutant produced a non-zero exit; (c) `ls packages/concierge/dist` after a build attempt shows no `*.test-d.*` artifact; (d) `README.md:72` matches the shipped `ActionResult`.

### Wave 0 Gaps

Nothing exists yet. Wave 0 must create all of it before any type edit can be validated.

- [ ] `packages/concierge/tsconfig.test-d.json` — `extends: "./tsconfig.json"`, `noEmit: true`, **`rootDir: "."`** (omitting it is TS6059), `include: ["src/**/*.ts", "test-d/**/*.ts"]`
- [ ] `packages/concierge/test-d/_assert.ts` — the four aliases plus `export {}` (it has no imports, and without module-hood `isolatedDeclarations` fires TS9010)
- [ ] `packages/concierge/test-d/results.test-d.ts` — covers SC-2, SC-7d
- [ ] `packages/concierge/test-d/consent.test-d.ts` — covers SC-3, SC-6, SC-7e, SC-7f
- [ ] `packages/concierge/test-d/actions.test-d.ts` — covers SC-7a, SC-7b, SC-7g, the handler-forwarding assertion, the erasure assertion
- [ ] `packages/concierge/test-d/transport.test-d.ts` — covers SC-1, SC-4/TRN-01, SC-5/TRN-05, SC-7c
- [ ] `packages/concierge/package.json` — repoint `"typecheck"` to `"tsc -p tsconfig.test-d.json"` so one command covers `src` **and** `test-d` (the phase's only shared-file touch with Phase 2)
- [ ] Framework install: **none required** — TypeScript 5.9.3 is already installed and working

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section is required. Phase 1 ships **no runtime**, so most controls are structurally out of reach — but two ASVS categories are genuinely exercised, because this phase decides what the consent contract can and cannot express.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No credentials, sessions, or identity handling in a type file. Consent ≠ authentication; PROJECT.md's core value is deliberately narrower. |
| V3 Session Management | **partial** | `ConsentAck` binds `{userTurnId, responseId, snapshot, payload, grade, readbackHash?}` — the type-level half of one-shot consent. Enforcement (CON-01…CON-08) is Phase 8. Phase 1's control: make `attested ⇒ readbackHash` **unconstructable otherwise**, so the strongest grade cannot exist without its binding evidence. |
| V4 Access Control | **partial** | `TransportCapabilities.userTurnIdentity` provenance (TRN-05) is an access-control predicate in type form: it is what lets Phase 8 refuse `bindTo: "userTurn"` on a transport whose turn identity the agent can mint. Phase 1's control: make the distinction *representable*; a boolean cannot express it. |
| V5 Input Validation | **partial** | `RedactionPolicy<Args>` (unchanged, defaults `drop`) and the closed `ReasonCode` union. The closed union is the control: an open `string` lets a handler smuggle arbitrary text into a field the agent reads. `MESSAGE_MAX_CHARS` declares the bound that SEC-06 enforces in Phase 6. |
| V6 Cryptography | **yes — by delegation** | `DigestLike` is injected, never implemented. Core hand-rolls no crypto: `crypto`, `TextEncoder`, `btoa` are all TS2304 under `lib: ["ES2022"]` (re-verified). JCS canonicalization (RFC 8785) is declared in Phase 1 as a literal and implemented in Phase 8. **Never hand-roll SHA-256 in core** — D-03 already rejected it. |
| V7 Error Handling / Logging | **partial** | D-01's rejection of a free-form `detail?` sibling is a V7 control: a field that could carry a thrown message would become the covert PII channel SEC-02 exists to close. Do not reintroduce it. |
| V8 Data Protection | no | No storage, no transport of PII by this phase. |
| V13 API / Web Service | **partial** | `Transport`'s four-member surface with no vendor vocabulary (TRN-01) is the boundary definition. `ServerChallenge` reserves the inbound seam without producing anything (D-05). |

### Known Threat Patterns for a Consent-Gating Type Contract

| Pattern | STRIDE | Standard Mitigation | Phase 1's share |
|---------|--------|---------------------|-----------------|
| Agent mints its own user turn via TTS echo picked up by the recognizer | **Spoofing** | Transport declares turn-identity provenance; kernel refuses `bindTo: "userTurn"` on a forgeable source | Make provenance representable and type-tested (TRN-05). Runtime gate is Phase 8. |
| Agent reauthors the readback before the human sees it (OWASP ASI09) | **Tampering** | Grade ladder; `attested` routes around `message` entirely via a hash over app-rendered bytes | Make `attested ⇒ readbackHash` a compile error to violate (SC-6). |
| Canonicalization collision — `JSON.stringify({a:1, b:undefined})` is byte-identical to `JSON.stringify({a:1})` | **Tampering** | JCS (RFC 8785) owned by core, not by the app | Declare `canonicalization: "JCS"` and carry `canonical` bytes in the receipt so verifiers never re-serialize. Encoder is Phase 8. |
| Client-supplied challenge accepted as proof (GHSA-gjjc-pcwp-c74m) | **Spoofing / Repudiation** | Server-generated **and server-stored** challenge | Type the seam **inbound only**, and brand it so an app cannot mint one without a cast (D-05, verified TS2322). |
| Untrusted ingress into model context (the lethal-trifecta variable leg) | **Elevation of Privilege** | Declare it, then gate it at build time | Ship `readsUntrusted` and the type-test. **The gate is SEC-05, Phase 3** — an unenforced marker beside a redaction policy that genuinely fails closed is this project's named failure mode. |
| Handler exception text reaching the model or telemetry | **Information Disclosure** | Generic sentence only; class names in telemetry | Refuse any type that could carry it (no `detail?`). Enforcement is DSP-03 / SEC-02, Phase 6. |
| Unbounded / control-character-laden `message` rendered or spoken | **Tampering** | Strip C0/C1, collapse whitespace, truncate | Export `MESSAGE_MAX_CHARS` and state the policy. Sanitizer is SEC-06, Phase 6. |
| Handler returns a value that is not an `ActionResult` | **Tampering** | Normalize at the dispatcher boundary | Ship the `invalid_result` code. Runtime half is DSP-09, Phase 6. |

**The honest limit, restated:** every control above is a *client-side* assertion. SEC-04 (documentation-only in v0.1) exists because that limit must be stated rather than papered over — and PROJECT.md records the 2026-07-27 narrowing of the core-value wording for the same reason. Phase 1 must not add any type whose name implies server-verified proof.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Approve a tool call **by reference** (`callId`) — AI SDK 6 `needsApproval`, OpenAI Agents JS `RunState.approve()`, CopilotKit `renderAndWaitForResponse`, MCP 2026-07-28 RC | Bind approval to **the bytes the human saw** | No framework has done this; the MCP RC frames itself as traceability, explicitly not content integrity | Concierge's `readbackHash` + `ReadbackReceipt` has no agent-framework prior art. The only real prior art is browser-platform: WebAuthn / Secure Payment Confirmation. `[CITED: 01-CONTEXT.md D-03 — carried forward, not re-verified this session]` |
| Declaration-level approval metadata (`needsApproval` on the tool) | Call-site approval (`toolApproval`) | Vercel **deprecated** declaration-level `needsApproval` in AI SDK 6 | Direct evidence that policy-shaped metadata drifts off the declaration — the argument that cut `maxPerTurn` in D-04. `[CITED: 01-CONTEXT.md D-04]` |
| `userTurnIdentity: boolean` | Turn-identity **provenance** | 2026-07-27, from a second shipped implementation's `looksLikeCurrentSpeechEcho` | The gate the design rests on could be satisfied by the agent talking to itself. `TransportCapabilities` is consumer-implemented, so this could not wait. `[CITED: PROJECT.md Key Decisions, ROADMAP Phase 1 notes]` |
| Opaque generic failure text to the model (`"Tool execution was not approved."` with `status: 'completed'`) | Closed machine-readable failure code + untrusted human-facing message | OpenAI Agents JS has an open issue attributing model hallucinations to the missing code | Where the ecosystem is converging; D-01's thirteen-code union is the local expression of it. `[CITED: 01-CONTEXT.md D-02]` |
| `tsup` for library builds | `tsdown` (rolldown) | tsup unmaintained since 2025-11-12 | **Phase 2, not Phase 1.** Noted only so the planner does not import build concerns into this phase. `[CITED: CLAUDE.md § What NOT to Use]` |
| TypeScript 5.x | TypeScript **7.0.2** is npm `latest` (`next` = `7.1.0-dev.20260727.1`) | GA 2026-07-08 | Phase 1 runs on the installed 5.9.3. Verified irrelevant: every experiment produced identical results on both. **Phase 2 owns the bump.** `[VERIFIED: npm view typescript dist-tags]` |

**Deprecated/outdated in this repo right now:**
- Root `package.json` pins `typescript@^5.7.0`, which caps below 6 and resolves to 5.9.3. Correct for Phase 1; Phase 2's file.
- `packages/concierge/package.json` `"typecheck": "tsc --noEmit"` sees only `src/` — insufficient once `test-d/` exists.
- `README.md:72` renders `reason?: string`, which this phase makes false.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `TurnIdentityProvenance` member names `"none" \| "agent-forgeable" \| "human-attested"` | Mechanics, Code Examples | **Low.** CONTEXT explicitly grants naming discretion and locks only the axis. The *shape* (a closed union, not a boolean) is verified. Names are mine and should be reviewed for the modality-free constraint — `"agent-forgeable"` deliberately avoids "voice". |
| A2 | `ServerChallenge` as a branded string rather than an interface | Mechanics §3 | **Low.** Both compile. The brand adds a verified property (unconstructable without a cast) that an interface does not. Discretionary. |
| A3 | `Scheduler = (fn: () => void, delayMs: number) => () => void` (returns a cancel) | Prototype | **Medium.** D-08 says only "a `scheduler?` seam" with no shape. The cancel-returning form is what `commitWindowMs` (DSP-08) and `dedupeWindowMs` will need, but Phase 6 owns those and may want a different signature. Cheap to change — nothing publishes until v0.1. |
| A4 | `Readback = { payload, presented? }` field names | Mechanics §1 | **Low.** D-03 locks JCS over `{payload, presented?}` explicitly, so this is close to cited; only the exact TypeScript spelling is mine. |
| A5 | `ReadbackReceipt.alg` typed as the literal `"SHA-256"` and `canonicalization` as `"JCS"` | Prototype | **Low-Medium.** D-03 locks the four fields but not whether they are literals or open strings. Literals make the receipt self-describing and let a type test assert them; widening later is additive. |
| A6 | `presentReadback` as the `ConciergeConfig` field name for the sink | Prototype, Export table | **Low.** D-03 says the sink goes on `ConciergeConfig` next to `normalizeSnapshot`; the name is mine. |
| A7 | `AnyActionDefinition` using `any` rather than `never` for the erased positions | Pitfall 1 | **Medium.** Both verified to work. The tradeoff is real and lands in Phases 4/6/8 (callability of `snapshotEquality` without a cast), so the planner should decide deliberately rather than inherit my preference. |
| A8 | The four-file `test-d/` split (`results` / `consent` / `actions` / `transport`) | Project Structure | **Low.** One `tsc` program covers any arrangement; this is organisational only. |
| A9 | Repointing `packages/concierge/package.json`'s `typecheck` script rather than adding a second script | Pattern 1, Wave 0 | **Low-Medium.** Adding `"test:types"` alongside is equally valid and touches the same file. Repointing gives the "one command is the whole signal" property the phase wants. |
| A10 | The "no agent framework binds approval to the bytes the human saw" claim | State of the Art | **Not re-verified this session.** Carried from CONTEXT/discussion research. It informs doc copy, not a type shape, so a wrong claim costs a README sentence rather than a contract. |

**Everything else in this document was compiled.** Every table row marked `[VERIFIED]` was produced by running `tsc` against a sandbox mirroring `packages/concierge` — same `tsconfig.base.json`, same resolved `@standard-schema/spec@1.1.0` — under both TypeScript 5.9.3 and 7.0.2.

## Open Questions

1. **Does Phase 1 declare `ReadbackAttestation`, or leave it entirely to Phase 8?**
   - *What we know:* CONTEXT's Deferred list says "Phase 1 **may** declare the type; Phase 8 makes the kernel require it." D-03 wants presentation and observation kept as distinct types.
   - *What's unclear:* whether declaring an unused type now helps or is dead weight. Note the D-09 wrinkle: `ConsentAck` is now a **union alias**, so adding a required `attestation` to its `attested` branch later *is* a breaking change in the general case — but nothing publishes until v0.1 completes, so it is free through Phase 8.
   - *Recommendation:* **defer it.** Phase 8 designs the kernel that consumes it and will know the right shape. Declaring it now risks shipping a type Phase 8 immediately reshapes, and D-09's cost argument does not apply pre-publish. If the planner disagrees, the export table already reserves slot 11.

2. **`any`-erasure or `never`-erasure for `AnyActionDefinition`?**
   - *What we know:* both compile and both accept heterogeneous actions. `any` keeps `snapshotEquality` callable in Phases 4/6/8 without a cast; `never` keeps `any` out of the public surface but forces a cast at the one place that must invoke the comparator.
   - *What's unclear:* how much casting the kernel will actually need — that is Phase 8's shape, not visible yet.
   - *Recommendation:* `any`, exported as a named alias with a doc comment explaining the erasure. Revisit in Phase 8 if the cast burden turns out to be trivial; changing it is a one-line edit pre-publish.

3. **Does `TransportCapabilities.userTurnIdentity` get *replaced* or *supplemented*?**
   - *What we know:* D-10 says "replace or supplement". Replacement was prototyped and is clean; the type test `Not<Assignable<true, …>>` only works under replacement.
   - *What's unclear:* nothing blocking — no consumer exists.
   - *Recommendation:* **replace.** Two fields would be two sources of truth for one fact, and the boolean is the weaker one. Nothing is published, so the "breaking" framing costs zero here.

4. **Should the `FailureReason` membership be frozen now, or explicitly marked provisional?**
   - *What we know:* CONTEXT places this under Claude's Discretion and notes Phase 6's dispatcher is the thing that will enumerate real failure paths. Adding a member later is additive-safe (D-09) but *does* break every exhaustive `switch`, by design.
   - *Recommendation:* ship the thirteen and add a doc comment saying additions are expected in Phase 6 and will intentionally break exhaustive mappers. The exhaustiveness test in `results.test-d.ts` is what makes that break visible rather than silent.

5. **Is `packages/concierge/package.json` genuinely disjoint from Phase 2?**
   - *What we know:* the ROADMAP's disjointness claim is about "build config and CI, not `types.ts`". Phase 2 will restructure `exports`, `files`, and scripts in this file; Phase 1 needs one script line.
   - *Recommendation:* proceed, and note it in the plan as the single expected merge point. If the two phases genuinely run concurrently, land Phase 1's script change first and early — it is one line and Phase 2 can absorb it.

## Sources

### Primary (HIGH confidence — reproduced in this session)

- **Local `tsc` 5.9.3** (`./node_modules/.bin/tsc`) and **`tsc` 7.0.2** (installed to an isolated `/tmp` sandbox) — all assignability, variance, narrowing, `isolatedDeclarations`, `@ts-expect-error`, emit, and layout experiments. Every result cross-checked on both compilers.
- **`tsconfig.base.json`** — the exact flag set every experiment ran under (`lib: ["ES2022"]`, `strict`, `isolatedDeclarations`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`).
- **`packages/concierge/src/types.ts`** (540 lines) and **`src/index.ts`** — the current committed contract; all defect claims from CONTEXT confirmed present at the cited lines.
- **`node_modules/typescript/lib/lib.dom.d.ts`** — real `SubtleCrypto.digest`, `BufferSource`, `AlgorithmIdentifier` definitions.
- **`@types/node`** (isolated `/tmp` install) — real `webcrypto.subtle` typing, for the `DigestLike` bivariance finding.
- **npm registry** — `typescript` dist-tags (`latest` = 7.0.2), `@standard-schema/spec` version and publish date.

### Secondary (HIGH — repository documents, read directly)

- `.planning/phases/01-type-surface-completion/01-CONTEXT.md` — D-00 … D-11, the locked decisions.
- `.planning/ROADMAP.md` § Phase 1 (goal, 7 success criteria, corrected notes), § Parallelization.
- `.planning/REQUIREMENTS.md` — TRN-01, TRN-05, and the traceability table.
- `.planning/STATE.md` — accumulated decisions, the two stale PROJECT.md rows.
- `.planning/PROJECT.md` § Constraints, § Key Decisions.
- `./CLAUDE.md` — project constraints and the technology-stack decisions.
- `CONTRIBUTING.md` § Non-negotiables; `README.md` § Design contract.

### Tertiary (carried from prior research — NOT re-verified in this session)

- The claim that no agent framework binds approval to presented bytes (AI SDK 6, OpenAI Agents JS, CopilotKit, MCP 2026-07-28 RC) — from CONTEXT/discussion research.
- Vercel's deprecation of declaration-level `needsApproval` — from CONTEXT D-04.
- RFC 8785 (JCS), WebAuthn L3 / Secure Payment Confirmation, GHSA-gjjc-pcwp-c74m, MCP SEPs 1913/1984 — cited by CONTEXT as the external basis for D-03 and D-05; used here only as rationale, never as a type shape.

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Type-test mechanism and layout | **HIGH** | Built, compiled, and mutation-tested end to end on both compilers. Three concrete traps found empirically (module-hood, `rootDir`, dist pollution). |
| Implementation ordering | **HIGH** | The dependency edges are compiler-enforced, not judgement calls — the `ConsentAck` hinge and the erasure requirement both come from real TS2375s. |
| `ConsentAck` union mechanics | **HIGH** | Full prototype: narrowing, EOPT behaviour, `.d.ts` emit, and the flatten-back mutant all verified. |
| `DigestLike` shape | **HIGH** | Probed against both real platform typings; the method-vs-property result is unambiguous and was initially surprising. |
| Readback sink form | **HIGH** for the mechanics, **MEDIUM** for the naming | The assignability matrix corrects a claim carried in from discussion. The decision stands; the justification changes. Field names are A4/A5/A6. |
| Export surface enumeration | **HIGH** | Complete `index.ts` compiled against the prototype under `verbatimModuleSyntax`. |
| Provenance union member names | **MEDIUM** | Shape verified; names are A1 and explicitly discretionary. |
| Security domain mapping | **MEDIUM** | ASVS category applicability is my judgement over a runtime-free phase; the underlying threat list is CONTEXT's and is well-sourced. |

**Research date:** 2026-07-28
**Valid until:** ~2026-08-27 (30 days). The findings are compiler-behaviour facts, not ecosystem facts, so they are unusually stable — the only thing that could invalidate them is Phase 2's TypeScript bump, which was pre-tested here against 7.0.2 with identical results.
