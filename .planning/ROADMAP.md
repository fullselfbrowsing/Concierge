# Roadmap: Concierge

**Milestone:** v0.1 — the first publishable release.

## Overview

v0.1 is *core + consent + two adapters + packaging*. The journey runs contract-first: finish correcting the public type surface, settle packaging while there is one package instead of eight, then build upward through the dependency graph — action declaration, catalog assembly, bridge registry, dispatcher, session — until there is enough machinery for the consent kernel to intercept. The kernel is the milestone's reason to exist; everything before it is scaffolding that the kernel needs, and the two adapters that close the milestone exist to prove the core stayed honest.

Nothing publishes until the milestone completes. That is load-bearing: it means a type decision made in Phase 1 can still be amended in Phase 8 if the kernel's design forces it, at zero cost. The "no breaking change" property Phase 1 protects is a property of the *published* surface, and there is no published surface until v0.1 ships.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Type surface completion** - Close the six remaining defects in the committed public contract, so no post-publish breaking change is left in it (completed 2026-07-28; **gap closure in progress — 12 code-review findings, plans 01-10–01-15**)
- [x] **Phase 2: Packaging, build, and release** - Make the package buildable, publishable, and installable while there is one package rather than eight (completed 2026-07-29)
- [x] **Phase 3: Action declaration and build-time validation** - One declaration derives everything downstream, and every wrong declaration fails the build naming the action (completed 2026-07-30)
- [x] **Phase 4: Stages, catalog assembly, and explain()** - The agent sees only the actions valid for where the user is, and a developer can find out why one wasn't offered (completed 2026-07-30)
- [x] **Phase 5: Bridge registry and the no-bridge path** - Handlers read live app state through getters, and behave honestly when no component is mounted (completed 2026-07-31)
- [x] **Phase 6: Dispatcher** - A retried, malformed, aborted, or crashing call produces exactly one honest result and never fires an effect twice (completed 2026-08-06; **verification gap closure planned — plans 06-07–06-08**)
- [x] **Phase 7: Session and the transport seam** - Something owns the loop between catalog and transport, driven by a stub with no network (completed 2026-08-10)
- [x] **Phase 8: Consent kernel** - A consequential action runs only when a human, not the agent, confirmed this exact payload (completed 2026-08-10)
- [x] **Phase 9: React and Svelte adapters** - Two opposite reactivity models drive the same core through adapters small enough to prove no logic leaked out (completed 2026-08-12)

## Phase Details

### Phase 1: Type surface completion

**Goal**: Every public type the consent kernel and the adapters will be built against is final — the remaining defects that would become breaking changes after publish are closed.
**Depends on**: Nothing (first phase)
**Requirements**: TRN-01, TRN-05
**Success Criteria** (what must be TRUE):

  1. *Both* delivery hooks can report that a readback was cut off partway — `InvocationMeta.deferUntilDelivered` and `ToolBatch.deferUntilDelivered` each carry a completion outcome, so partial delivery is representable instead of indistinguishable from completion. Applies to any interruption: a dismissed surface, a navigation, a disconnect, a spoken interruption.
  2. A handler returning an arbitrary failure string fails to typecheck; `reason` admits only a fixed set of codes — including the case where a handler returns something that is not a result at all — and the one string that always crosses a vendor boundary has a stated policy and a declared length bound.
  3. An app can hand core a readback it rendered itself and get back a *receipt* — the hash, the algorithm, the canonicalization rule, and the canonical bytes — so the `attested` grade has a producer in the contract and not only a field on the ack, and no downstream verifier has to re-serialize to check it.
  4. A transport is definable end to end — capabilities, batch envelope, response — with no vendor event name anywhere in core, demonstrated by a second transport shape that shares no wire vocabulary with the first. (TRN-01)
  5. A transport declares where its turn identity *comes from*, not merely that it has one, so a transport whose turn identity can be minted by the agent's own output is distinguishable in the type system from one where it cannot. (TRN-05)
  6. The compiler, not a doc comment, enforces that an `attested` ack carries a `readbackHash` — constructing one without it fails to typecheck.
  7. A type-test suite fails when any corrected defect is reintroduced: a `snapshotEquality` degraded to `(a: unknown, b: unknown)`, a `requires` that widens the action's own name union, a delivery hook that drops the completion reason on *either* interface, an arbitrary `reason` string, a readback sink seam that accepts a type argument, or an `attested` ack with no hash. Adequacy is proven by a ten-mutant battery, not by the suite being green — a first-draft suite let three of ten through.

  > *Sub-criterion 7e amended 2026-07-28.* It previously read "a readback sink that **rejects a typed app sink**". Research falsified the premise: **neither** the generic-function form nor the defaulted-alias form accepts a payload-specific app sink, so there is no non-defective contrast state and the criterion was unachievable as written. The real, testable discriminator is that the seam rejects a *type argument* (`ReadbackSink<Booking>` → TS2315). The conclusion the criterion was protecting is unchanged; only the phrasing was wrong.
**Plans**: 15 plans — 9 original + **6 gap-closure plans added 2026-07-28** — **single serial sequence**, waves 1→15, one plan at a time. `config.json` sets `parallelization: true`; that is deliberately overridden for this phase because every plan edits or transiently mutates the same `types.ts`.

Plans:

- [x] 01-01-PLAN.md — Wave 0: `tsconfig.test-d.json`, the four assertion aliases, the repointed `typecheck` script, proof the harness fails when it should, and the per-task expansion of the validation map
- [x] 01-02-PLAN.md — `FailureReason` / `ReasonCode` / `ActionResult.reason` / `MESSAGE_MAX_CHARS` + `results.test-d.ts` (D-01, D-02)
- [x] 01-03-PLAN.md — `ToolBatch` delivery hook + `TurnIdentityProvenance` + `transport.test-d.ts` (D-00a, D-10, TRN-01, TRN-05)
- [x] 01-04-PLAN.md — `Readback` / `ReadbackReceipt` / `ReadbackSink` / `DigestLike` / `ServerChallenge` + `consent.test-d.ts` part 1 (D-03, D-05 first half)
- [x] 01-05-PLAN.md — THE HINGE: `ConsentAck` interface → discriminated union, `challenge?`, preserved generics, in one edit (D-03 + D-05 + D-07)
- [x] 01-06-PLAN.md — Thread `Snapshot`/`AckPayload`, add `readsUntrusted`, land `AnyActionDefinition` erasure — atomic — + `actions.test-d.ts` (D-07, D-04)
- [x] 01-07-PLAN.md — `ConciergeConfig` seams (`presentReadback`, `digest`, `scheduler`) and `Session.stage`/`onStageChange` (D-03, D-08)
- [x] 01-08-PLAN.md — `index.ts` export surface (10 types + `MESSAGE_MAX_CHARS`) and the `README.md:72` correction
- [x] 01-09-PLAN.md — Phase gate: the ten-mutant battery, root typecheck, dist hygiene, README agreement, and the validation sign-off

**Gap closure (added 2026-07-28).** The phase verified `passed` and was signed off; an independent
code review (`01-REVIEW.md`) then wrote 17 new mutations against surface the battery does not cover
and **14 escaped**, two of them critical. All 12 findings are planned below. Every one is a defect
that becomes a breaking change after publish — exactly this phase's stated scope — and this is the
last free moment, because nothing publishes until v0.1 completes.

- [x] 01-10-PLAN.md — The `readonly` class: `ConsentAck`, `DeliveryReport`, `ReadbackReceipt`, `TransportCapabilities` (CR-01, WR-01)
- [x] 01-11-PLAN.md — The generic-parameter class: `Bridge`'s defaults, `B` erased at the collection site, the shadowing rename, and the nullable-bridge pins (CR-02, IN-02, WR-03)
- [x] 01-12-PLAN.md — The `exactOptionalPropertyTypes` class: explicit `| undefined` across the invocation and consent path (WR-02)
- [x] 01-13-PLAN.md — **CHECKPOINT** — the `ActionResult` shape decision, then the frozen constants' literal types (WR-06, IN-03)
- [x] 01-14-PLAN.md — The unguarded contracts: `ConsentPolicy` members, the receipt's remaining two fields, four required/closed pins, and the redaction doc (WR-04, WR-05, WR-07, IN-01)
- [x] 01-15-PLAN.md — Gap-closure gate: both batteries re-run against the final surface, Phase 2's pinned-pattern recheck, and the validation-map append

**Research**: ✅ **Done in two passes.** (1) 2026-07-27, during discussion — four gray areas researched in parallel, findings verified against this repo's exact `tsconfig.base.json` flags. (2) 2026-07-28, `01-RESEARCH.md` — a full phase research pass that built a working 319-line prototype and ran a ten-mutant battery against a first-draft type-test suite. **That second pass was nearly skipped and would have been a mistake:** three of ten mutants escaped, and it falsified two claims the discussion had recorded as settled — the readback-sink variance justification, and `@ts-expect-error` as the assertion mechanism. Both are corrected in `01-CONTEXT.md` with callouts. The lesson generalizes: verified-by-reasoning is not verified-by-mutation.
**Notes**: Scope is the verified remainder, not all sixteen defects SUMMARY listed. Ten are already fixed in the committed `types.ts` — the `ToolBatch` envelope, the regraded `ConsentGrade`, `respond(ActionResult)`, ordered stage array, `SnapshotNormalizer`, `Session`, the deleted `registerHandler`, the `jsonSchema?` escape hatch, the object-rooted `JsonSchemaObject`, and the memoized-`catalogFor` contract. One more was closed after this roadmap was drafted: `ConsentPolicy` no longer threads the action's own `Name` (it was inferring as a union of the action and its `requires` target and corrupting the name-union derivation) — it takes `string` and CAT-03 checks it at build time, where the catalog actually exists.

⚠️ **Corrected 2026-07-27.** This paragraph previously claimed `deferUntilDelivered` "now passes a `DeliveryReport` with an explicit `outcome`" and counted it as closed. **That is true on `InvocationMeta` (`types.ts:130`) and false on `ToolBatch` (`types.ts:436`)**, which still carries the pre-fix `(effect: (deliveredResponseId: string) => void) => void`. `ToolBatch` is the transport-side hook — the one Success Criterion 1 is actually about — and it is an interface consumers *implement*, so leaving it is a genuine post-publish breaking change. It is back in scope. A second orphan surfaced in the same scout: `AbandonReason` is declared and exported and consumed by nothing, because `reason` is still open `string`.

The remainder, as resolved during the Phase 1 discussion (see `phases/01-type-surface-completion/01-CONTEXT.md` for the full rationale and the rejected alternatives):

- **(a) `ActionResult.reason` is still open `string`.** Resolved as a pure closed union — `reason?: ReasonCode | undefined`, **twelve** codes (3 `AbandonReason` + 9 `FailureReason`), with `AbandonReason` reused as a named subset rather than deleted. The explicit `| undefined` is required by this repo's `exactOptionalPropertyTypes`. `message` stays unbranded but gains a declared length bound and a documented never-a-consent-artifact policy.
- **(b) No readback sink type, so `readbackHash` has no producer.** Resolved as a receipt-returning sink — `{hash, alg, canonicalization, canonical}` — with JCS (RFC 8785) canonicalization owned by core and the digest injected via a `DigestLike` structural stand-in, following the `AbortSignalLike` precedent. Core cannot hash natively: `crypto`, `TextEncoder`, and `btoa` are all absent under `lib: ["ES2022"]`. The sink must use the generic-*function* form or a typed app sink fails to assign.
- **(c) No server consent-token shape.** Resolved as the *inbound* seam, not an outbound token: `challenge?: ServerChallenge` on `ConsentAck`, server-issued and client-echoed, **typed but never produced in v0.1** so nothing emitted can be mistaken for proof. An outbound client-minted token would be structurally decorative in a threat model where every third-party script has identical authority (PITFALLS P6), and a transparent claims envelope would be the exact shape of the WebAuthn client-supplied-challenge advisory.
- **(d) No composition or taint metadata.** Narrowed from four fields to one. **`readsUntrusted` ships** as a sibling to `SideEffects` (not a member — `SideEffects` is the MCP-hint mirror, and MCP is actively reconsidering `openWorldHint` for conflating ingress with egress). **`maxPerTurn`, `conflictsWith`, and `impact` are cut**: `maxPerTurn` is runner-level in every framework checked and belongs on `ConciergeConfig` if it ever ships; `impact` duplicates the already-enforced `consent.minGrade`; `conflictsWith` has no prior art and is covered by stage scoping plus `requires` plus serial batch order. `readsUntrusted` is enforced, not declared-only — SEC-05 in Phase 3 is the gate, because a safety field nothing reads, sitting beside a redaction policy that genuinely fails closed, is the overstatement this milestone exists to avoid.

**TRN-05 was added to this phase on 2026-07-27** after a second prior implementation was located and read (`portfolio` repository, branch `audit-fsb-ai-control-loop`, 2026-07-16 — a shipped in-app AI control loop). It contains an echo-suppression routine that exists because the microphone picks up the assistant's own TTS and the recognizer transcribes it as user speech. On a voice transport `userTurnId` is recognizer-derived, so **the agent's own output can mint a new user turn** — which is precisely what `bindTo: "userTurn"` accepts as proof that a human acted. This is not PITFALLS P2: P2 is a human barging in, and its prescribed mitigation is turn classification, which would not catch this because an echoed readback transcribes as affirmative content rather than as "stop"/"wait"/"no". `TransportCapabilities.userTurnIdentity: boolean` cannot express the difference between turn identity from a button press and turn identity from a recognizer, and `TransportCapabilities` is implemented by consumers — so widening it later is breaking. That is why it lands here rather than in Phase 8.

Cheap additions belonging here: a `Snapshot` type parameter on `ActionDefinition` threaded through `ActionHandler` → `ConsentAck` → `ConsentPolicy` (without it `snapshotEquality` degrades to `unknown` exactly where correctness matters — confirmed present in the committed file, along with an `AckPayload` parameter that `ActionDefinition.handler` silently drops), a `scheduler?` seam, and `stage`/`onStageChange` on `Session`. `CONTRACT_VERSION` is deliberately *not* here — it is purely additive and lands in Phase 2 where the test that needs it lives.

**Type tests run under `tsc --noEmit` over `*.test-d.ts` with `@ts-expect-error`**, not Vitest's `expectTypeOf`, which would create a Phase 1 → Phase 2 dependency the Parallelization section says does not exist.

### Phase 2: Packaging, build, and release

**Goal**: The package that will carry the kernel can be built, published, and installed correctly — settled at one package, because the cost of settling it later scales with package count.
**Depends on**: Nothing — runs in parallel with Phase 1 (disjoint files: build config and CI, not `types.ts`)
**Requirements**: PKG-01, PKG-02, PKG-03, PKG-04, PKG-05
**Success Criteria** (what must be TRUE):

  1. A scratch project outside the repo installs the packed tarball, imports `@fullselfbrowsing/concierge`, and typechecks against its shipped declarations. (PKG-02)
  2. `publint` and `are-the-types-wrong` report no errors on the packed artifact, and a typecheck failure cannot pass the build because the bundler does not typecheck. (PKG-01)
  3. The artifact imports successfully on the exact Node version the package declares as its floor, not merely on the developer's newer runtime. (PKG-03)
  4. Two adapters resolving core independently share one core instance, and a version mismatch fails loudly with an actionable message rather than silently splitting the bridge registry, the dedup window, and the consent kernel. (PKG-04)
  5. Core's installed dependency footprint is verified to add zero runtime bytes to a consumer bundle. (PKG-05)

**Plans**: 12 plans across **8 waves**. Unlike Phase 1 this phase genuinely parallelizes — waves 1, 3, 6 and 7 each run two plans on disjoint files, and every wave was checked for `files_modified` overlap. The hinge is `assertSingleInstance()` (plan 02-06): the PKG-05 probe must be written and baselined *before* it lands, and the PKG-04 tests must run against `dist/`, not `src/`.

Plans:

- [x] 02-01-PLAN.md — Wave 1: TS 7.0.2 exact, pnpm 11.17.0 (its own commit), the six dev tools, `packages/concierge/LICENSE`, a `*.tgz` gitignore line, and the per-task validation map
- [x] 02-02-PLAN.md — Wave 1: `scripts/mutate-and-prove.sh` and proof it fails four ways, including the slash-in-pattern case the research body cannot handle
- [x] 02-03-PLAN.md — Wave 2: tsdown build, `publint`/`attw` as build-failing gates at the `esm-only` profile, the sourcemap decision (`src` into `files`), and `check:artifact`
- [x] 02-04-PLAN.md — Wave 3: PKG-01 defect-first battery — P1, P2, P3a/b, and P4, the pair where `pnpm typecheck` fires while `pnpm build` exits 0
- [x] 02-05-PLAN.md — Wave 3: `scripts/pkg05-zero-runtime-deps.mjs`, `check:deps`, the pre-hinge baseline, and P5 proven in both halves
- [x] 02-06-PLAN.md — Wave 4: **THE HINGE** — `src/contract.ts`, `assertSingleInstance` on a reachable path, export surface 43 → 45, PKG-04 / PKG-05 reconciled
- [x] 02-07-PLAN.md — Wave 5: Vitest, the single-instance / artifact / export-surface suites, and mutants P6, P7, P11
- [x] 02-08-PLAN.md — Wave 6: F3 workspace fixture adapters, the extended workspace glob, and the one-physical-copy proof
- [x] 02-09-PLAN.md — Wave 6: the PKG-02 pack-and-install harness and the PKG-03 Node-floor harness, plus mutant P10
- [x] 02-10-PLAN.md — Wave 7: `ci.yml`, changesets + the OIDC `release.yml`, `RELEASING.md`, catalog pins, and the two build-toolchain non-negotiables
- [x] 02-11-PLAN.md — Wave 7: the two Phase 1 deferrals — `exports.test-d.ts` (P8) and `_policyNotBivariant` (P9) (completed 2026-07-28)
- [x] 02-12-PLAN.md — Wave 8: phase gate — clean-checkout suite, the eleven-mutant battery re-run, tarball review, and validation sign-off

**Research**: Completed 2026-07-28 — `02-RESEARCH.md`. *Supersedes this entry's original "None".* Tool **selection** was indeed settled on 2026-07-27 and was deliberately not re-litigated; research was fenced to implementation mechanics only. It nonetheless falsified three things this entry had treated as settled: (1) `tsdown`'s `attw: true` reports problems and **exits 0** — it is not a gate, and the correct form is `attw: { level: "error", profile: "esm-only" }`; (2) `attw`'s **default profile fails a correctly-authored ESM-only package**, and its natural "fix" would reverse a locked decision; (3) the core-as-`peerDependency` range is **advisory under pnpm** (`unmet peer`, exit 0) and hard-errors only under npm, so PKG-04's runtime check is its primary enforcement rather than its backstop. A fourth finding reshaped the phase: `sideEffects: false` and a module-scope registry are mutually exclusive, which is why `assertSingleInstance()` must sit on a reachable path.
**Notes**: Concrete deltas from the current repo state: root `package.json` pins `typescript@^5.7.0` and `pnpm@10.33.0` against a plan that calls for TS 7.0.2 exactly and pnpm 11; there is no bundler, no test runner, no changesets, and no CI. Already correct and not to be disturbed: `engines.node: ">=22.12.0"`, `type: "module"`, `isolatedDeclarations: true`, and `lib: ["ES2022"]` in `tsconfig.base.json`. The second build toolchain (`svelte-package`, which cannot pre-bundle runes without silently killing reactivity) is scaffolded here rather than discovered in Phase 9. `CONTRACT_VERSION` is introduced here as the mechanism behind PKG-04.

### Phase 3: Action declaration and build-time validation

**Goal**: A developer declares an action once and everything downstream is derived — and every way to declare one wrongly is caught at build with a message naming the action and stating the fix.
**Depends on**: Phase 1 (declares against the corrected surface); Phase 2 for the test runner
**Requirements**: CAT-01, CAT-02, CAT-05, CAT-06, CAT-07, SEC-01, SEC-05, DX-03
**Success Criteria** (what must be TRUE):

  1. One declaration yields the action's literal name type, its emitted JSON Schema, and its redaction policy, with no second registry to keep in step. (CAT-01)
  2. A wrong declaration fails the build with a message naming the offending action and the fix — a schema whose root is not `type: "object"`, a description assembled at runtime from i18n or CMS content, or a non-empty schema with no redaction policy. (CAT-02, CAT-07, SEC-01, DX-03)
  3. An action declaring `destructive` with no consent policy still builds but reports itself, so the omission is visible without blocking a policy that legitimately lives a layer up. (CAT-05)
  3b. An action declaring `readsUntrusted` with no consent policy reports itself the same way, so the taint marker is a gate rather than an annotation nothing reads. (SEC-05)

  4. A validator that does not implement Standard JSON Schema still emits a correct schema, because an explicit `jsonSchema` is used in preference to derivation — and an unspecified redaction policy drops arguments rather than passing them through. (CAT-06, SEC-01)
  5. `assertSingleInstance` is called from the first entry point a consumer actually reaches, not only from tests. Phase 2 shipped the guard with **no production call site** — every invocation is a test, a harness, or CI, and `src/contract.ts:140` admits it. A guard that is armed and never fired does not prevent the split bridge registry, the doubled dedup window, or the invisible consent state it exists to prevent. (PKG-04; carried from 02-VERIFICATION.md finding W5)

**Plans**: 8 plans across **5 waves**. Waves 1, 3 and 4 each run two or three plans on disjoint files; every wave was checked for `files_modified` overlap. The hinge is `src/catalog.ts` (plan 03-03): it is the only place a freeze can happen, the only place a check can be forgotten, and the first production call site `assertSingleInstance` has ever had.

Plans:

- [x] 03-01-PLAN.md — Wave 1: the CAT-07 six-branch literal-description guard, `defineAction`, both assertion families, and the `actions.test-d.ts` placeholder swap (CAT-07, DX-03, SEC-01 type half)
- [x] 03-02-PLAN.md — Wave 1: the structural converter types, the narrowing predicate, the locked emission order, three exact-pinned validators, and twelve schema fixtures (CAT-02, CAT-06)
- [x] 03-03-PLAN.md — Wave 2: **THE HINGE** — `src/host.ts`, `buildCatalog`, the rule table, `CatalogValidationError`, the recursive freeze, and `assertSingleInstance` on the first line (CAT-01/02/05/06, SEC-01/03/05, DX-03, PKG-04 SC-5)
- [x] 03-04-PLAN.md — Wave 3: the barrel, the export-surface pin moved in lockstep across its four sites (45 names to an expected 59), and the consumer-side pin in `test/fixtures/probe.ts` — the only file any foreign program compiles against the shipped `dist/index.d.ts`, and therefore the only place a widened `LiteralDescription` is visible
- [x] 03-05-PLAN.md — Wave 3: `test-d/catalog.test-d.ts` — CAT-01's derived literal name union, and mutant M-03-3
- [x] 03-06-PLAN.md — Wave 4: `test/catalog.test.ts`, the SC-5 registry case, and five catalog mutants (CAT-01/02/05, SEC-01/03/05, DX-03, PKG-04)
- [x] 03-07-PLAN.md — Wave 4: `test/emission.test.ts` against three real published validators, and four emission mutants (CAT-02, CAT-06, DX-03)
- [x] 03-08-PLAN.md — Wave 5: phase gate — the four `types.ts` prose corrections, three `/* @__PURE__ */` annotations (plus the third `Object.isFrozen` assertion that makes their safety net cover all three sites), the sixteen-mutant battery re-run, all seven gate scripts, and the validation sign-off

**Research**: ✅ **Done 2026-07-29** — `03-RESEARCH.md`, 20 compiled probes against the installed TS 7.0.2 plus all four candidate validators installed and executed. The re-probe this entry asked for was done and confirms the finding: **valibot 1.4.2 still does not implement Standard JSON Schema**, so the `jsonSchema` escape hatch remains the only working path for one of three target validators. Research also corrected three decisions `03-CONTEXT.md` had recorded as settled: (1) "warn on the console by default" does not compile — `console` is not type-visible under `lib: ["ES2022"]`, and the working form is the structural `globalThis` reach `contract.ts:92-99` already established; (2) a shallow `Object.freeze` does **not** satisfy SEC-03 — measured, `catalog[0].handler = attackerFn` succeeds *silently* and the replacement handler runs, so a recursive freeze is required; (3) the obvious CAT-07 guard `string extends D` **accepts** an interpolated template literal, which is precisely the per-tenant content vector CAT-07 exists to block, so a six-branch predicate ships instead. One residual gap is **accepted explicitly** rather than discovered later: `${number}` and `${bigint}` description holes defeated all six candidate predicates, and the acceptance, its reasoning and its residual risk are recorded in `src/define-action.ts`'s shipped doc comment with a pin that fires if a future compiler closes it.
**Notes**: The schema-emission order is escape hatch → `~standard.jsonSchema.input(...)` → throw naming the action *and* the vendor. The `input` projection specifically: a schema with a transform or a default emits a different schema in each direction, and tool calling needs the input side.

### Phase 4: Stages, catalog assembly, and explain()

**Goal**: The agent is offered exactly the actions valid for where the user currently is, and a developer who expected an action to fire can find out why it didn't without reaching for a debugger.
**Depends on**: Phase 3
**Requirements**: CAT-03, STG-01, STG-02, STG-03, STG-04, SEC-03, DX-01 — **plus CAT-01**, which `REQUIREMENTS.md:157` records as *Partial* against Phase 3 because its fifth derived artifact, per-stage catalogs, was left to this phase. `createConcierge().catalogFor` is that artifact; 04-08 records the closure.
**Success Criteria** (what must be TRUE):

  1. An agent on the results page is offered the results actions plus the cross-stage actions, and the checkout actions are *absent from the catalog* rather than rejected when called. (STG-01)
  2. Stage matching runs in declaration order with first match winning, decides on arbitrary app context rather than pathname alone, and does not change behavior when a stage is renamed. (STG-02, STG-03)
  3. Two `catalogFor` calls with equivalent context return the identical array reference, so a subscriber cannot be driven into an infinite re-render. (STG-04)
  4. A consent policy naming an action that does not exist fails the build, naming both the referring action and the missing target — the typo that would otherwise silently disable a safety gate. (CAT-03)
  5. `explain()` answers "why didn't my action fire" by reporting the active stage, which bridges are registered, and the live catalog; and the built registry is frozen, so page script cannot swap a handler after build. (DX-01, SEC-03)

**Plans**: 8 plans across **5 waves**. Waves 1, 2 and 3 each run two plans on disjoint files; every wave was checked for `files_modified` overlap. The hinge is `src/concierge.ts` (plan 04-03) — the package's first factory, its first memo, and its first guarded call into consumer code that must not echo what it caught.

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Wave 1: `types.ts` — `Explanation` / `StageExplanation`, `Concierge.explain`, `EmittedTool`'s four fields become `readonly`, and the inline-`defineAction` spelling note on `stages`/`crossStage` (SEC-03, DX-01, STG-03, STG-04)
- [x] 04-02-PLAN.md — Wave 1: `catalog.ts` — CAT-03 as a **post-pass** over the complete declared-name set, the two new issue codes, `export` on `deepFreeze`, and three stale-prose corrections (CAT-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-03-PLAN.md — Wave 2: **THE HINGE** — `src/concierge.ts` (`createConcierge`, one flat `buildCatalog`, the **index-keyed** instance-local memo, the shallow projection freeze over shared deep-frozen elements, one guarded `runMatch`, one-pass `explain`, the `reason`-omitting `dispatch` stub) written in Task 1, its nineteen anchors expanded into doc comments plus the `contract.ts` correction in Task 2, the barrel and the export surface moved 59/49/10 → 62/51/11 with both its pins in Task 3. **Closes CAT-01** — the fifth derived artifact, per-stage catalogs, ships as `catalogFor` (STG-01/02/03/04, SEC-03, DX-01, CAT-03, CAT-01)
- [x] 04-04-PLAN.md — Wave 2: `test/catalog.test.ts` C23–C26 and the `CatalogIssueCode` closed-union pin — typo, self-reference, the **forward reference that must build clean**, and aggregation (CAT-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-05-PLAN.md — Wave 3: `test/concierge.test.ts` — the behavioural suite, S1–S26, whose header names the five defects that pass a naive test (STG-01/02/03/04, SEC-03, DX-01, CAT-03)
- [x] 04-06-PLAN.md — Wave 3: `test-d/concierge.test-d.ts` — the `Equals`-spelled readonly and signature pins the runtime suite structurally cannot see — plus `single-instance.test.ts` F5 (SEC-03, DX-01, STG-03)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-07-PLAN.md — Wave 4: the sixteen-mutant battery, with M-04-1 and M-04-4 **repaired** and M-04-7 and M-04-12 **respelled** against the corrected implementation, each PASS confirmed to have compiled and run tests

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 04-08-PLAN.md — Wave 5: phase gate — all seven gate scripts, the shipped-prose audit across `dist/index.d.ts`, `dist/index.js` and three source files (every literal shown able to fire on the pre-correction tree), CAT-01's closure recorded in `REQUIREMENTS.md`, a byte-identical `pnpm-lock.yaml`, and the validation sign-off

**Research**: ✅ **Done 2026-07-30** — `04-RESEARCH.md`, every load-bearing claim executed against the built `dist/`, the installed rolldown 1.2.0 / TypeScript 7.0.2, or the React and Svelte sources. Three measurements inverted what the phase expected. (1) **CAT-03 cannot live inside `buildCatalog`'s existing loop** — measured over seven scenarios, the in-loop form false-positives on every forward reference, and since this phase appends cross-stage actions last it would fail every build whose consent policy names a cross-stage action; it must be a post-pass over `seenNames`. (2) **The re-freeze is not a re-freeze** — one `EmittedTool` per action built at assembly time and shared by reference makes a *shallow* `Object.freeze` on each projection complete, blocking all seven tamper vectors at 510× less cost than `deepFreeze` per projection; the two decisions are coupled and building fresh elements per projection turns the shallow freeze into a breach that reports success. (3) **The recorded tree-shaking justification for the instance-local memo does not reproduce** under rolldown 1.2.0 — a module-scope `Map` read by an exported function is retained; the reason that is true is SSR cross-request state pollution, and the doc comment must say so. Research also measured that **two stages sharing an `id` silently serve each other's catalogs** under the originally-locked id-keyed memo, which is a direct STG-01 failure; the memo is now keyed by declaration index, with a `warnHost` for the ambiguity the id still creates in `stageFor` / `Session.stage()` / `explain`.
**Notes**: CAT-03 sits here rather than in Phase 3 because it is the first check that needs the assembled name union; `defineAction` cannot know it at declaration time, so the runtime check in `buildCatalog` is the one that has to exist. This phase deliberately touches no transport — the catalog must not read a bridge or a transport, which is why the transport-capability gate (CAT-04) is in Phase 8 instead.

### Phase 5: Bridge registry and the no-bridge path

**Goal**: A handler reads live state from a page component that may or may not be mounted, without prop-drilling and without re-rendering the app — and behaves honestly when nothing is mounted.
**Depends on**: Phase 1 (the registry is independent of the catalog and may run in parallel with Phases 3-4)
**Requirements**: BRG-01, BRG-02, BRG-03, BRG-04, BRG-05, DX-02
**Success Criteria** (what must be TRUE):

  1. A handler invoked after the app's state has changed reads the new values, with no re-registration in between. (BRG-02)
  2. A component that remounts and then unregisters late cannot clear the newer registration that replaced it — the stale cleanup is refused. (BRG-01, BRG-04)
  3. A handler whose stage bridge is not mounted receives `bridge: null` and returns a sentence telling the human what to do, not an exception. (BRG-03)
  4. A snapshot stored from a proxy-backed store does not move when the underlying store moves — demonstrated against a hand-rolled Proxy in core, before any framework adapter exists. (BRG-05)
  5. An action reading router or DOM state runs with no bridge registered at all, so the first useful action costs no instrumentation. (DX-02)

**Plans**: 7 plans across **4 waves**. Waves 1 and 3 each run plans on disjoint files; every wave was checked for `files_modified` overlap. The hinge is plan 05-03 — the barrel plus **all eleven export pins**, which must move in one change or the first `pnpm test` after the export line lands is red for every plan behind it. The export surface moves 62/51/11 → **65/51/14**: CONTEXT's "Settled after research" section exports the capture function too, superseding RESEARCH § Q5's +2/64/51/13, and the live baseline was re-measured against the built artifact before planning.

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Wave 1: `src/bridge.ts` (NEW) — the monotonic-token registry closure, the frozen capability return, `offPageResult`, then the structural clone (`cloneDetached`) and the capture loop whose `try` wraps the **normalizer**, not just the getter. Deliberately left unbarrelled so the suite stays green (BRG-01, BRG-03, BRG-04, BRG-05)
- [x] 05-02-PLAN.md — Wave 1: `src/concierge.ts`'s module-private `resolveBridge` seam with `bridgeStatus` routed through it, plus the three shipped doc-comment corrections in `types.ts` (×2, both reaching `dist/index.d.ts`) and `contract.ts` (re-scoped, not deleted) (BRG-03, BRG-05, DX-02)

**Wave 2** *(blocked on Wave 1)*

- [x] 05-03-PLAN.md — Wave 2: **THE HINGE** — `src/index.ts`'s value export line and stale-prose correction, then all eleven export pins moved together across `test/export-surface.test.ts` (7), `test-d/exports.test-d.ts` (3, including three separate numbers inside one header sentence) and `test/artifact.test.ts` (1) (BRG-01, BRG-03, BRG-05)

**Wave 3** *(blocked on Wave 2 — runtime suites import `../dist/index.js`, so they cannot precede the barrel)*

- [x] 05-04-PLAN.md — Wave 3: `test/bridge.test.ts` (NEW) — the thirteen mount/unmount orderings with the **five non-discriminating ones labelled as contract pins**, BRG-02 liveness and reference identity, the frozen-capability cases, and both warn policies (BRG-01, BRG-02, BRG-04)
- [x] 05-05-PLAN.md — Wave 3: `test/bridge-snapshot.test.ts` (NEW) — criterion 4 against the inline **Shape F** accessor-backed proxy (the only shape under which the deep-freeze mutant fails visibly and without throwing), every measured clone property, both capture warns, and BRG-03/DX-02 proved as separate halves with `dispatch` untouched (BRG-03, BRG-05, DX-02)
- [x] 05-06-PLAN.md — Wave 3: `test-d/bridge.test-d.ts` (NEW) signature pins from the barrel, plus `test/single-instance.test.ts` **F6** — the guard's third production call site and its first *direct* one, and the only home anywhere in the repo for mutant M-05-8 (BRG-01, BRG-03, BRG-05)

**Wave 4** *(blocked on Wave 3)*

- [x] 05-07-PLAN.md — Wave 4: phase gate — the seventeen-mutant battery with every PASS confirmed from the gate's *output* to have compiled and run tests, the shipped-prose audit, the four packaging gates, a byte-identical lockfile, and the `05-VALIDATION.md` sign-off (BRG-01…05, DX-02)

**Research**: None — the source system solved this and supplies the test list. Planning re-measured three things the upstream artifacts got wrong: the export growth is **+3 values, not +2** (CONTEXT supersedes RESEARCH); **eleven pins move, not seven** (`test/artifact.test.ts` and `test/single-instance.test.ts` were missing from both upstream file lists); and `src/index.ts`'s module header **does not reach `dist/`** (0 hits for `not yet constructible` in both built artifacts today), so that audit greps `src/`, not `dist/` — a `dist/` grep would pass vacuously.
**Notes**: The identity guard is keyed on a monotonic token, not the bridge object: a component re-registering an object that is `===` its previous one (a memoized literal, a reused `$state` object) would otherwise let the stale cleanup match the live registration. Criterion 4 is the core-level half of the Svelte proxy defect; Phase 9 supplies the real-framework half. Guarding it twice is deliberate — it is a security defect that is invisible in a React-only suite.

### Phase 6: Dispatcher

**Goal**: A retried, malformed, aborted, or crashing call produces exactly one honest result, and no effect ever fires twice.
**Depends on**: Phase 3 (actions to dispatch), Phase 5 (bridge to pass into the handler)
**Requirements**: DSP-01, DSP-02, DSP-03, DSP-04, DSP-05, DSP-06, DSP-07, DSP-08, DSP-09, SEC-02, SEC-06, TRN-04
**Success Criteria** (what must be TRUE):

  1. Two calls sharing a `callId` inside the window yield the same Promise object — `p1 === p2` holds — and with no `callId` a name-and-arguments key is used, degrading to a no-dedup path rather than throwing when that key cannot be serialized. (DSP-01, DSP-02)
  2. A handler that throws returns one generic sentence; neither the agent nor telemetry receives the thrown message, only the error class name. A handler that *returns* something which is not a result at all is caught by the same boundary rather than propagating a malformed value to the agent, and every message leaving the dispatcher is sanitized — control characters stripped, whitespace collapsed, length capped. (DSP-03, DSP-09, SEC-02, SEC-06)
  3. Arguments are re-validated before the handler runs regardless of what the agent claims to have validated, malformed JSON degrades to `{}` and is then rejected by that validation, and an action with no registered handler returns an honest result instead of throwing. (DSP-04, DSP-05, DSP-06)
  4. A batch runs serially in `output_index` order, and every call in an aborted batch still produces a result, so the agent is never left waiting on a response that will not come. (DSP-07)
  5. A non-read-only effect does not land until the commit window has elapsed and an abort inside that window cancels it — all of it drivable from an application's own agent loop with no transport present. (DSP-08, TRN-04)

**Plans**: 8 plans across 7 waves

Plans:

**Wave 1**

- [x] 06-01-PLAN.md — Pin final dispatch contracts and create the single-call Wave 0 suite
- [x] 06-02-PLAN.md — Create the ToolBatch parse, ordering, abort, and direct-loop Wave 0 suite

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-03-PLAN.md — Extract the shared message sanitizer and add the structural host Scheduler fallback

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06-04-PLAN.md — Replace the stub with the context-aware single-call dispatcher

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 06-05-PLAN.md — Add transport-independent serial ToolBatch execution

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 06-06-PLAN.md — Prove mutation coverage, run phase gates, and record requirement evidence

**Gap closure — Wave 6** *(blocked on completed Wave 5 evidence)*

- [x] 06-07-PLAN.md — Restore malformed-call totality, locked BigInt degradation, and validator-mediated malformed JSON

**Gap closure — Wave 7** *(blocked on Wave 6 runtime repairs)*

- [x] 06-08-PLAN.md — Regenerate mutation proof and enforce live validation/requirements ledger consistency

**Research**: None — the source system solved this; the failure list is already enumerated.
**Notes**: `dispatch` must not be `async`: an async wrapper allocates a fresh Promise per invocation and breaks dedup by identity, which is the mechanism criterion 1 tests. Handler lookup must not be a bare object literal — `dispatch("__proto__")` and `dispatch("constructor")` are test cases. **Amended after Phase 3:** a frozen `Map` still accepts `.set()`, so a `Map` cannot satisfy SEC-03. Phase 3 ships `catalog.byName` as a frozen `Object.create(null)` record, which removes the prototype chain *and* is freezable — it satisfies both constraints where a `Map` satisfies only the first. If Phase 6's handler lookup reads `catalog.byName`, it already has both properties and must **not** be converted to a `Map`. If Phase 6 keeps a separate, mutable lookup of its own, a `Map` is still correct there, because that structure is neither frozen nor part of the catalog. Phase 6's plan must state which of the two its lookup is. All mutable state (dedup map, timers, consent map) is allocated lazily on first dispatch and never during module evaluation, or a module-scoped instance bleeds across requests and tenants in production while looking fine in development.

### Phase 7: Session and the transport seam

**Goal**: Something owns the loop between the catalog and the transport, so a stage change or a reconnect never leaves the agent holding a stale catalog — provable with no network.
**Depends on**: Phase 4 (catalogFor), Phase 6 (dispatch)
**Requirements**: SES-01, SES-02, SES-03, SES-04, TRN-02
**Success Criteria** (what must be TRUE):

  1. The agent's tool list changes when the user changes page, and the same list is re-pushed after a reconnect, with the app doing nothing. (SES-01)
  2. A tool batch arriving from the transport produces exactly one result per call, returned on the transport. (SES-02)
  3. Turn identity and the delivery hook travel from the transport envelope through to the handler intact — so the data consent needs is already flowing before consent exists. (SES-03)
  4. Stopping a session unregisters cleanly and cancels in-flight work, leaving no timer, listener, or pending promise behind. (SES-04)
  5. A stub transport with configurable capabilities drives all of the above with no network, no WebRTC, and no vendor SDK. (TRN-02)

**Plans**: 7 plans across 6 waves. Plans 07-01 and 07-02 run in parallel on disjoint contract and fixture files; the five shared Session/evidence deliverables then run serially, including one verifier-driven gap-closure plan.

Plans:

**Wave 1**

- [x] 07-01-PLAN.md — Exact neutral Transport lifecycle, awaitable Session, EOPT config, and safe diagnostic contracts
- [x] 07-02-PLAN.md — Reusable deterministic no-I/O stub transport with frozen profiles, controls, failures, and histories

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-03-PLAN.md — Serialized latest-wins catalog/reconnect transitions, actual-published-reference reconciliation, publication-gated admission, public factory/export surface, and direct single-instance proof

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 07-04-PLAN.md — Cross-batch FIFO routing, one-attempt responses, arrival epochs, lazy hostile-envelope forwarding, and exact signal composition

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 07-05-PLAN.md — Cached stop drain, transactional cleanup, tokenized reentrant subscribers, and safe runtime diagnostics

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 07-06-PLAN.md — Mutation, foreign/tarball, release, lockfile, live-ledger, SES closure, and TRN-02 Phase 8 handoff

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 07-07-PLAN.md — Clear accessor-abandoned publication authority, add C17/M-07-C10, regenerate 31-row evidence, and re-open security for independent audit

**Research**: Completed 2026-08-08 — `07-RESEARCH.md`; closest implementation analogs and file ownership are mapped in `07-PATTERNS.md`.
**Notes**: The catalog/status loop uses one serialized transition drain with latest-generation confirmation and keeps publication-in-progress, last-successfully-published transport catalog, and confirmed application authority separate. Reentrant queued contexts reconcile against what the transport actually holds: a context sharing published B promotes B's epoch without republishing, while a context returning to previously confirmed A republishes A after successful B. Transport callbacks may emit batches synchronously, so the batch pump remains paused until reconciliation confirms the newest authority. Session stores hostile ToolBatch envelopes by reference and forwards their evidence fields through lazy descriptors so Phase 6 retains ownership of guarded snapshot totality. The stub transport built here is the instrument Phase 8 uses to prove the build-time grade gate. Criterion 3 is the seam that makes Phase 8 possible at all: an earlier draft of `Transport` delivered a bare `ToolCall[]`, and the gate the whole design rests on had no data to read. Phase 7 delivers and validates only the reusable stub/session-seam portion of literal requirement TRN-02. Its REQUIREMENTS checkbox and traceability status remain unchecked/Partial after this phase; Phase 8 must reuse this exact fixture against the full consent kernel before TRN-02 can become Complete.

### Phase 8: Consent kernel

**Goal**: A consequential action runs only when a human — not the agent — confirmed this exact payload, or it does not run.
**Depends on**: Phase 7 (turn envelope and delivery hook flowing through the session), Phase 4 (buildCatalog, for the grade gate)
**Requirements**: CON-01, CON-02, CON-03, CON-04, CON-05, CON-06, CON-07, CON-08, CON-09, CON-10, CAT-04, TRN-03, SEC-04; carried closure/runtime evidence: TRN-02, TRN-05
**Success Criteria** (what must be TRUE):

  1. A gated action with no prior review fails closed, and a review and a confirm inside the same user turn fails — so an agent generating its own follow-up cannot approve itself. (CON-01, CON-02)
  2. Consent arms when the review reached the human, never when the review handler returned; a partial delivery does not arm it. An interruption partway through a readback leaves the gate closed *even though it minted a genuinely new user turn* — the case that defeats receipt and satisfies turn-freshness in one gesture. (CON-03, CON-06)
  3. Any compared field differing between review and confirm destroys the consent; a successful confirm destroys it; and the confirm handler receives the payload captured at review time, not one recomputed at confirm time. (CON-04, CON-05, CON-08)
  4. An action requiring a grade its configured transport cannot promise refuses to build, naming the action and the grade; and a transport that cannot derive turn identity cannot be used with `bindTo: "userTurn"`. (CAT-04, CON-07, TRN-03)
  5. An explicit refusal is distinguishable from a dismissal, so the agent knows whether re-offering is appropriate — and the documentation shows, with a worked example, that all of this is a client-side assertion the server must independently re-verify. (CON-09, SEC-04)
  6. When an action fails, the human is told what the app said, not what the agent decided to say about it — the agent cannot substitute its own narration for a failure. (CON-10)

**Plans**: 8 plans across 6 waves. The public contracts land first; catalog/profile gates and the independent SEC-04 documentation track follow in Wave 2; the runtime kernel and Session barrier converge through the reusable stub before one mutation/security/release closure.

Plans:

**Wave 1**

- [x] 08-01-PLAN.md — Immutable consent profile, readback attestation, app-outcome, diagnostic, export, and strict-consumer contracts

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-02-PLAN.md — Frozen profile capture, inherent non-none consent floor, aggregated CAT-04/TRN-03 gates, and attested seam validation
- [x] 08-08-PLAN.md — Root README client-assertion warning and ordered server challenge, reauthorization, effect, burn, and commit example

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 08-03-PLAN.md — Delivery-armed factory-local generation ledger, turn binding, late drift check, runtime none guard, and atomic one-shot ack
- [x] 08-05-PLAN.md — Pre-effect Session capability dominance and app-owned failed-batch outcome barrier before agent release

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 08-04-PLAN.md — Strict JCS/UTF-8 receipt verification, retained bytes, presenter ownership checks, and separate human attestation

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 08-06-PLAN.md — Exact Phase 7 stub extension and full no-network consent/outcome matrix, including interrupted delivery followed by a genuine new turn

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 08-07-PLAN.md — Non-vacuous mutation battery, ASVS audit, package/foreign/release gates, live ledgers, and requirement closure

**Research**: Completed 2026-08-10 — `08-RESEARCH.md`; implementation analogs are mapped in `08-PATTERNS.md`, and `08-VALIDATION.md` defines the Nyquist/security contract.
**Notes**: This is the milestone's reason to exist. Criterion 2 is the single most important test in the project — the interrupt-partway case defeats receipt and satisfies turn-freshness simultaneously, and it is not modality-specific: a dismissed surface, a navigation away, and a disconnect all produce it. Criterion 5's second half is a deliberate statement of the kernel's honest limit; SEC-04 is documentation because server verification is v2, and overstating what the client half proves is the failure mode this milestone is built to avoid. The `attested` open decision that previously blocked part of this phase is resolved: grades are modality-free, and `attested` requires an app-rendered raw-payload surface plus an observed act bound to its hash.

**Added 2026-07-27 from the Phase 1 discussion.** Three implementation items now land here rather than being discovered here:

- **The JCS (RFC 8785) canonicalizer and a hand-rolled UTF-8 encoder, ~55 LOC.** Phase 1 ships the readback-receipt *types*; core cannot hash or encode natively because `crypto`, `TextEncoder`, and `btoa` are all absent under `lib: ["ES2022"]`. The encoder must fail closed — throw on non-JSON values, where `JSON.stringify` silently drops them. Without canonicalization the gate is defeatable by a verified collision: `JSON.stringify({amount: 4180, coupon: undefined})` is byte-identical to `JSON.stringify({amount: 4180})`.
- **`ReadbackAttestation` — binding the observed human act to the hash.** Phase 1 may declare the type; this phase makes the kernel require it before granting `attested`, so there is no code path that yields an `attested` ack without both an app-rendered payload and an observed act on it. Phase 1 already makes `attested ⇒ readbackHash` compiler-enforced; this closes the other half.
- **The TRN-05 runtime gate.** Phase 1 makes turn-identity provenance *representable*; this phase refuses `bindTo: "userTurn"` on a transport whose turn identity is agent-forgeable. See Phase 1's notes for why the recognizer-echo case is not covered by PITFALLS P2.

CON-10's mechanism sits at the Phase 7 session seam — the session owns `onToolBatch → dispatch → respond` and is therefore the only place that can compose the human-facing outcome before the agent gets to reauthor it. It is filed under CON-* rather than SES-* because the property it protects is a consent property, and Phase 8 depends on Phase 7 regardless.

### Phase 9: React and Svelte adapters

**Goal**: Two frameworks with opposite reactivity models drive the same core, through adapters small enough to prove that no load-bearing logic leaked out of it.
**Depends on**: Phase 5 (bridge registration), Phase 8 (a real kernel for the Svelte snapshot normalizer to be load-bearing against)
**Requirements**: ADP-01, ADP-02, ADP-03, ADP-04
**Success Criteria** (what must be TRUE):

  1. A React component registers actions and a bridge and survives StrictMode's double-mount with its registration intact, without app code ever maintaining a ref itself. (ADP-01)
  2. A Svelte component registers a `$state`-backed bridge, and a consent snapshot taken at review does not move when the store moves — the defect that a React-only suite cannot see, now demonstrated through the published tarball rather than in source. (ADP-02)
  3. Each adapter's source stays within its stated budget and a test fails when it grows past it, so logic leaking out of core is caught rather than argued about. (ADP-03)
  4. Core imports and constructs during a server render under a metaframework with no DOM global touched at module scope, demonstrated by one example app that exercises both adapters against the same catalog. (ADP-04)
  5. Two adapters resolving core independently are proven to share one instance **through the published tarball**, and a deliberate version mismatch fails loudly rather than silently splitting the bridge registry, the dedup window, and the consent kernel. Phase 2 proved this with two synthetic workspace fixtures; this is the first phase where the collision is real, and the first where `assertSingleInstance` runs on a path a user reaches. (PKG-04; carried from 02-VERIFICATION.md finding W5)

**Plans**: 13 plans across **10 waves**. Root RED/routing and the two package skeletons land serially; React and Svelte implementation then proceed in parallel. Astro configuration precedes normal SSR, budget enforcement runs beside it, and exact-tarball, documentation, workflow, mutation-infrastructure, and terminal immutable-evidence waves close the phase in dependency order.

Plans:

**Wave 1**

- [x] 09-01-PLAN.md — Reproducible eleven-failure RED baseline plus exact root test routing

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-02-PLAN.md — Bounded React package, peer, build, type, and artifact skeleton

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-03-PLAN.md — Bounded Svelte package/toolchain skeleton and exact eleven-to-eight RED transition

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 09-04-PLAN.md — Thin React context/client adapter with StrictMode, late-value, cleanup, SSR, and artifact proof
- [x] 09-05-PLAN.md — Thin native Svelte context/effect adapter with real `$state.snapshot` and artifact proof

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 09-06-PLAN.md — Astro manifest, integrations, TypeScript domain, and lockfile before example source
- [x] 09-09-PLAN.md — Exact adapter source discovery, 150-line budgets, AST responsibility checks, and all loop negatives

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 09-07-PLAN.md — Normal Astro SSR harness using both adapters and one shared catalog across fresh renders

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 09-08-PLAN.md — Exact three-tarball declarations, singleton, server, Svelte consent-drift, and mismatch proof

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 09-10-PLAN.md — Canonical adapter APIs, ownership/security boundaries, Astro proof, and release documentation
- [x] 09-12-PLAN.md — Immutable compiled mutation register and runner without premature final evidence

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 09-11-PLAN.md — Positive-count adapter gates wired into existing CI and release workflows

**Wave 10** *(blocked on Wave 9 completion)*

- [x] 09-13-PLAN.md — Terminal mutation, release, validation, security, and Phase 8-preservation evidence

**Cross-cutting constraints:**

- Adapters receive an existing `Concierge` and `BridgeRegistry`; catalog, dispatch, session, consent, transport, scheduling, matching, and retry logic remain in core.
- Framework and singleton claims are proven through built entries and exact tarballs; source-only imports and workspace-link convergence receive no credit.
- Phase 9 evidence is generated only after every release input is stable and must preserve the sealed Phase 8 register, evidence, validation, security, and verification bytes.

**Research**: Completed 2026-08-10 — `09-RESEARCH.md`; framework/compiler choices and formerly open directive, normalizer, test-routing, and loop-audit questions are resolved, closest live analogs are mapped in `09-PATTERNS.md`, and `09-VALIDATION.md` defines the Nyquist/security contract.
**Notes**: Both adapters ship in the same phase, never React first. Building React-first and porting later produces a hooks-shaped core, and by the time the second adapter arrives, fixing core is a breaking change. Svelte specifically, because it is the only choice that surfaces the `$state` proxy consent defect. The React adapter owns its ref-mirroring rather than telling apps to maintain refs — React is the sole framework where a syntactically identical getter is semantically wrong. No UI-design pass is warranted here despite the React/Svelte/component keywords: these are headless framework bindings and a throwaway example harness, with no interface being designed.

## Notes on Departures from the Researched Structure

SUMMARY.md proposed nine phases, of which 1-6 were v0.1. This roadmap keeps its ordering and its reasoning, and departs in four places:

1. **Its Phase 3 (catalog + schema + explain) is split into Phases 3 and 4.** It carried fourteen requirements and two unrelated demonstrations — a build that throws by name, and an agent seeing a stage-scoped list. The split is per-action validation versus whole-catalog assembly.
2. **Its Phase 4 (bridge + dispatcher + session) is split into Phases 5, 6, and 7.** Seventeen requirements across three separable components with three separate demonstrations; the dispatcher alone carries the trickiest concurrency semantics in the project and eight requirements of its own.
3. **The build-time grade gate (CAT-04) moved from the catalog phase to the consent phase.** SUMMARY mentions it in both. It needs a transport to check against, and the stub transport arrives with the session — and keeping the catalog phase transport-free preserves the rule that the catalog must never read a bridge or a transport.
4. **Phase 1 is much narrower than SUMMARY's**, because ten of its sixteen blocking defects are already fixed in the committed `types.ts`. The verified remainder is enumerated in Phase 1's notes.

Its Phases 7-9 — server handlers, devtools overlay, and the Realtime/WebMCP/MCP transports — map to this project's v2 section in REQUIREMENTS.md and are deliberately absent here.

## Parallelization

`parallelization: true`. Independent tracks:

- **Phases 1 and 2** touch disjoint files (the type surface versus build config and CI) and can run concurrently.
- **Phase 5** depends only on Phase 1 and can run alongside Phases 3-4.
- Everything from Phase 6 onward is serial: dispatcher needs actions and a bridge, session needs dispatch and a catalog, consent needs the session, adapters need the kernel.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Type surface completion | 15/15 | Complete   | 2026-07-28 |
| 2. Packaging, build, and release | 12/12 | Complete   | 2026-07-29 |
| 3. Action declaration and build-time validation | 8/8 | Complete   | 2026-07-30 |
| 4. Stages, catalog assembly, and explain() | 8/8 | Complete   | 2026-07-30 |
| 5. Bridge registry and the no-bridge path | 7/7 | Complete   | 2026-07-31 |
| 6. Dispatcher | 8/8 | Complete   | 2026-08-07 |
| 7. Session and the transport seam | 7/7 | Complete    | 2026-08-10 |
| 8. Consent kernel | 8/8 | Complete | 2026-08-10 |
| 9. React and Svelte adapters | 13/13 | Complete   | 2026-08-12 |
| 10. Close v0.1 release certification and evidence gaps | 6/7 | In Progress|  |

### Phase 10: Close v0.1 release certification and evidence gaps

**Goal:** One exact clean commit is independently certifiable as the pre-publication candidate: all nine audit gaps closed, 62/62 requirements, 9/9 original implementation phases and 10/10 current phase directories verified, 12/12 integrations, 10/10 flows, Phase 9 Nyquist compliant, and a matching exact-SHA hosted Ubuntu receipt, with no later tracked write or publication.
**Requirements**: No new requirement IDs — closes Audit 1–9 and repairs evidence for SEC-03, ADP-01–04, PKG-04, CAT-02, CAT-03, CAT-05–07, SEC-01, SEC-05, PKG-02–03, DX-01, DX-03.
**Depends on:** Phase 9
**Plans:** 6/7 plans executed
**Certification status:** Awaiting implementation, ordinary GSD closeout, and the post-GSD exact-SHA hosted receipt.

Plans:
**Wave 1**

- [x] 10-01-PLAN.md — Commit terminality at handler entry, suppress the whole batch, and stop safely after app-owned outcome capture.
- [x] 10-02-PLAN.md — Aggregate invalid declarations structurally and correct SEC-03 evidence against current built bytes.
- [x] 10-03-PLAN.md — Separate benign pnpm decoration from authenticated child authority, remove tracked Astro state, and wire the committed-snapshot proof.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10-04-PLAN.md — Prove clean Astro regeneration, repair hosted build ordering, and create push-bound exact-SHA receipt tooling.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 10-05-PLAN.md — Register every discriminating mutant and prove the canonical Phase 9 transaction prospectively without installing a stale seal.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 10-06-PLAN.md — Backfill summary/requirement metadata before the final release-input seal and synchronize registered roadmap/state accounting.

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 10-07-PLAN.md — Install the final Phase 9 seal, invoke its independent verifier, prove the clean local candidate, and write the supported post-GSD handoff.

**Post-GSD terminal gate (not a PLAN):** After all seven normal SUMMARYs, the independent Phase 10 verifier, registered ROADMAP/STATE bookkeeping, and a supported `gaps_found` milestone audit are committed, `10-CERTIFICATION.md` runs the external `certify` command. That command explicitly pushes the final clean commit, confirms the remote SHA, obtains and validates the exact hosted run/receipt, and makes no repository write afterward. The external run-scoped receipt is authoritative; tracked GSD status remains pending because marking it passed would create an uncertified successor commit.
