---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: executing
stopped_at: Completed 09-10-PLAN.md
last_updated: "2026-08-11T04:59:46.747Z"
last_activity: 2026-08-11
progress:
  total_phases: 9
  completed_phases: 8
  total_plans: 86
  completed_plans: 83
  percent: 89
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-10)

**Core value:** An agent can take a consequential action in a real app — and it is structurally guaranteed that a human, not the agent, confirmed this specific payload, or the action does not run.
**Current focus:** Phase 09 — react-and-svelte-adapters

## Current Position

Phase: 09 (react-and-svelte-adapters) — EXECUTING
Plan: 11 of 13
Status: Ready to execute
Last activity: 2026-08-11

Progress: [██████████] 97%

## Performance Metrics

**Velocity:**

- Total plans completed: 31
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 06 | 8 | - | - |
| 7 | 7 | - | - |
| 8 | 8 | 5h 28m | 41m |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 07 P02 | 11m 49s | 2 tasks | 3 files |
| Phase 07 P03 | 31m 40s | 3 tasks | 9 files |
| Phase 07 P04 | 22m 12s | 2 tasks | 2 files |
| Phase 07 P05 | 20m 51s | 2 tasks | 2 files |
| Phase 07 P06 | 1h 28m | 3 tasks | 11 files |
| Phase 07 P07 | 42m 45s | 3 tasks | 8 files |
| Phase 08 P01 | 9m | 2 tasks | 10 files |
| Phase 08 P02 | 17m | 2 tasks | 7 files |
| Phase 08 P08 | 17m | 2 tasks | 2 files |
| Phase 08 P03 | 46m | 2 tasks | 2 files |
| Phase 08 P05 | 32m 12s | 2 tasks | 6 files |
| Phase 08 P04 | 1h 20m | 2 tasks | 4 files |
| Phase 08 P06 | 38m | 2 tasks | 5 files |
| Phase 08 P07 | 1h 29m | 3 tasks | 9 files |
| Phase 09 P01 | 19m | 2 tasks | 5 files |
| Phase 09 P02 | 12m | 2 tasks | 5 files |
| Phase 09 P03 | 9m | 2 tasks | 5 files |
| Phase 09 P04 | 15min | 2 tasks | 6 files |
| Phase 09 P05 | 28min | 2 tasks | 10 files |
| Phase 09 P06 | 20m 15s | 2 tasks | 5 files |
| Phase 09 P09 | 20m 11s | 2 tasks | 1 files |
| Phase 09 P07 | 22m 5s | 2 tasks | 5 files |
| Phase 09 P08 | 29m | 2 tasks | 1 files |
| Phase 09 P10 | 10m | 2 tasks | 4 files |

## Accumulated Context

### Roadmap Evolution

- Phase 1 edited: milestone correction pass 2026-07-27: requirements 57->62 (TRN-05, SEC-05, SEC-06, DSP-09, CON-10)
- Phase 3 edited: milestone correction pass 2026-07-27: requirements 57->62 (TRN-05, SEC-05, SEC-06, DSP-09, CON-10)
- Phase 6 edited: milestone correction pass 2026-07-27: requirements 57->62 (TRN-05, SEC-05, SEC-06, DSP-09, CON-10)
- Phase 8 edited: milestone correction pass 2026-07-27: requirements 57->62 (TRN-05, SEC-05, SEC-06, DSP-09, CON-10)

### Decisions

Full log in PROJECT.md Key Decisions. Affecting current work:

- Consent kernel is in v0.1, not deferred — without it v0.1 is a strictly worse CopilotKit
- React and Svelte adapters ship together; Svelte is the only adapter that surfaces the `$state` proxy consent defect
- ESM-only, `engines.node: ">=22.12.0"`, `isolatedDeclarations: true` — all three serve one invariant: exactly one core instance
- Nothing publishes until v0.1 completes, so Phase 1 type decisions remain amendable through Phase 8 at zero cost
- [Phase ?]: Turn identity needs declared provenance (TRN-05, Phase 1) — a recognizer-derived userTurnId can be minted by the agent's own TTS echo, satisfying bindTo:'userTurn' with no human involved; not covered by PITFALLS P2, and TransportCapabilities is consumer-implemented so widening it post-publish is breaking
- [Phase ?]: Milestone corrected 2026-07-27: 57 to 62 v1 requirements — added TRN-05 (Phase 1), SEC-05 (Phase 3), SEC-06 and DSP-09 (Phase 6), CON-10 (Phase 8), from advisor research plus a second prior implementation at portfolio@audit-fsb-ai-control-loop
- [Phase 06-01]: Focused dispatcher RED gates register only selector-matching R-cases because Vitest reports ordinary name-filter exclusions as pending.
- [Phase 06-01]: Dispatcher security tests use direct global replacement restored in finally; no Vitest mocking or telemetry seam was introduced.
- [Phase 06-02]: Each case guards the absent dispatchBatch member and folds capability presence into its single fingerprinted observation. — This prevents incidental TypeErrors from satisfying Wave 0 RED evidence.
- [Phase 06-02]: Batch ordering is tested independently through handler-entry order, correlated row order, and preservation of the caller frozen input order. — The suite distinguishes execution order, output order, and caller-input immutability.
- [Phase 06-02]: Abort coverage uses application-local structural fixtures. — The tests assert complete sorted rows, zero later actuation, one canceller call, and listener cleanup without global timer mocks.
- [Phase 06-03]: Message bounding stays distinct from dispatcher sanitization. — Both use one internal surrogate-safe bound; only the outbound dispatcher boundary removes controls and normalizes whitespace.
- [Phase 06-03]: The host Scheduler fallback requires a complete timer pair and returns an at-most-once canceller. — Paired capability detection, receiver preservation, and an opaque handle keep cancellation honest without DOM or Node timer types.
- [Phase 06-04]: Cache the final dispatch Promise synchronously; pending entries never expire, and timer-free settled windows begin at settlement and sweep on access. — This preserves retry identity even when a handler outlives the nominal dedupe window.
- [Phase 06-04]: Authorize through the active stage name projection before the null-prototype catalog lookup, and keep resolveBridge as the only bridge seam. — Wrong-stage and prototype names cannot reach handlers, and bridge truth remains centralized.
- [Phase 06-04]: A registered action without a callable handler returns the exact reasonless unavailable result and warns once. — No declared ReasonCode truthfully means that a registered handler is missing.
- [Phase 06-05]: Batch execution delegates every live call to the existing cached dispatch function. — This preserves one stage, validation, timing, bridge, handler, normalization, sanitization, and deduplication boundary.
- [Phase 06-05]: Batch ordering decorates a copied call list with original positions. — Sorting by outputIndex and original position makes tie stability explicit without mutating caller input.
- [Phase 06-05]: Only unstarted calls after abort receive synthesized authored aborted results. — The current call remains owned by single dispatch while the batch still returns one immutable correlated row per input.
- [Phase 06-06]: Mutation evidence is credited only for a compiled build, non-zero exact named detector, harness kill, byte-restored target, restored green gates, and clean scoped source.
- [Phase 06-06]: SEC-02 is structural in Phase 6: production defines no telemetry channel; runtime R34-R36 separately prove exception text reaches neither results nor console.
- [Phase 06-06]: SEC-03 remains owned by Phase 4 and pending under its jsonSchema-getter carve-out; Phase 6 closes only the prototype-safe dispatch lookup evidence.
- [Phase 06]: Validate invocation metadata primitives before retry-key derivation and return fixed reasonless authored failures for invalid metadata. — This preserves totality and prevents malformed values or throwing getters from escaping the dispatcher boundary.
- [Phase 06]: Treat BigInt arguments as deliberately unkeyable while retaining tagged fallback-key encoding for supported values. — Unsupported arguments must execute independently without weakening collision resistance for supported inputs.
- [Phase 06]: Route malformed batch JSON through ordinary action validation as an empty object. — A single validation path keeps public failure semantics consistent and preserves batch independence.
- [Phase 06]: All mutation and ledger certification counts derive from the immutable 57-row register; stale hard-coded totals are rejected.
- [Phase 06]: Q16 remains the immutable nested-result proof; malformed batch metadata correlation uses Q17.
- [Phase 06]: Planning-ledger sign-off requires a fresh successful full-suite JSON report with exact file, pass, total, pending, and todo counts.
- [Phase 07-01]: Transport lifecycle stays vendor-neutral through one closed four-state union and a required status subscription. — This gives reconnect-capable runtime plans an exhaustive structural seam without vendor event vocabulary.
- [Phase 07-01]: Session diagnostics expose only immutable code and message fields; optional config inputs explicitly admit undefined. — The narrow shape prevents raw-detail channels and supports computed optionals under exactOptionalPropertyTypes.
- [Phase 07-02]: Subscription registrations use monotonic tokens so duplicate callback identities retain independent cleanup authority. — Token ownership prevents stale cleanup from removing a newer registration of the same callback.
- [Phase 07-02]: Catalog histories preserve the exact caller array reference while history containers and response rows are frozen snapshots. — Reconnect proofs need reference identity without exposing mutable history containers.
- [Phase 07-02]: Failure options are copied and frozen at construction so later caller mutation cannot alter deterministic occurrences. — A reusable fixture must make injected failures repeatable and independent of caller-owned configuration.
- [Phase 07-03]: A successfully published but superseded catalog retains its provisional epoch until the newest context either promotes that exact reference or aborts it before a different publication.
- [Phase 07-03]: Publication failure establishes stopped state and detaches accepted work before diagnostics and cleanup, then drains every accepted occurrence exactly once without responses.
- [Phase 07-03]: The package barrel exposes createSession as one callable value and keeps the reusable stub transport strictly test-only.
- [Phase 07-04]: Session reads only sourceBatch.signal at admission; all four evidence fields remain lazy until Phase 6 reads the dispatch facade.
- [Phase 07-04]: One structural signal composes transport, catalog-epoch, and stop cancellation with at-most-once upstream removal.
- [Phase 07-04]: Direct Phase 6 dispatch is the oracle for hostile envelope row cardinality, order, and authorship.
- [Phase 07]: Validate subscription cleanup values before activation and invalidate publication attempts before outside stop callbacks. — This keeps hot construction transactional and prevents a reentrant setTools return from restoring stopped authority.
- [Phase 07]: Exercise every Session diagnostic through public failures with fresh frozen exact objects and secret-absence assertions. — The operational channel stays useful without allowing caught values, identifiers, context, arguments, results, raw batches, stacks, or classes to escape.
- [Phase 07]: Accessor-superseded publications use current attempt-token ownership for cleanup. — Abort and clear only while the abandoned attempt still owns publication state, preventing stale cleanup from erasing a newer attempt.
- [Phase 07]: Accessor throws after reentrant supersession are inert abandoned attempts. — Once the getter enqueues the winning context, its later throw cannot become a fatal publication failure or restore obsolete authority.
- [Phase 07]: Final authority and failure-recovery closure is independently clean, secured, and verified. — C17-C22 and M-07-C10..C16 bind the repaired Session state machine to 37/37 mutation evidence and the 331-test immutable release.
- [Phase 08]: Default consent snapshot equality is cycle-safe for arrays/plain records/Map/Set, compares Date values by timestamp, and compares unsupported exotic leaves by identity. — This keeps normalized snapshot comparison deterministic while failing closed on values core cannot detach structurally.
- [Phase 08]: Capture actual transport capabilities and the outcome sink once at the first effect-free Session boundary, then use the detached capability snapshot for later catalog decisions.
- [Phase 08]: Treat outcome presentation failure as local to the accepted occurrence so cleanup and genuinely later FIFO work continue without replay.
- [Phase 08]: Accept completion only from a plain or null-prototype report with an own data outcome field equal to completed; never invoke report outcome accessors.
- [Phase 08-04]: Canonical SHA-256 evidence uses lowercase 64-character hex over exact core-retained RFC 8785 bytes.
- [Phase 08-04]: Capture the digest method and receiver once at construction; caller-owned evidence is descriptor-first and never accessor-driven.
- [Phase 08-04]: The first owned delivery callback claims verifyingDelivery before report reflection, making duplicate and reentrant reports inert.
- [Phase 08-06]: Keep every Phase 8 test-driving API on sibling fixture controls so production Transport retains exactly six enumerable keys.
- [Phase 08-06]: Record delivery, outcome, and response attempts in one monotonic event log while retaining separate successful histories.
- [Phase 08-06]: Snapshot delivery reports from own data descriptors for history safety, but pass the raw report to production so hostile accessors remain a real kernel test.
- [Phase 08-07]: Credit mutation evidence only after compile, a nonzero exact named detector and fingerprint, byte-identical snapshot restoration, restored green gates, and current live endpoints all agree.
- [Phase 08-07]: Treat package-only mutations as explicit package preconditions rather than Vitest selectors, and bind all final evidence to one revision after verifier edits settle.
- [Phase 08]: Phase closure is executable: requirements, D-08-01..23, canonical threats, research constraints, source coverage, package boundaries, and the ASVS audit must agree with current mutation and release evidence.
- [Phase 09]: Verify the initial RED state from its persisted hashes after the live tree begins changing. — Keeps later GREEN transitions from rewriting or reinterpreting the eleven-ID baseline.
- [Phase 09]: Translate the locked Svelte hot:false test configuration to vite-plugin-svelte 7.2 compilerOptions.hmr. — Preserves the planned semantics without config diagnostics corrupting Vitest JSON evidence.
- [Phase 09]: Keep core external and declare it as workspace:^ peer plus workspace:* development link, never as a runtime dependency. — This preserves one canonical singleton while still enabling local adapter development.
- [Phase 09]: Apply the use-client directive through tsdown's fileName banner callback only for dist/client.js, leaving the package root server-safe. — The callback makes directive placement explicit without contaminating the inert root entry.
- [Phase 09]: Point bare svelte-package at the planned src production inventory through package-local kit.files.lib configuration.
- [Phase 09]: Keep Svelte packaging and checking on package-local TypeScript 6.0.3 while the root compiler remains TypeScript 7.0.2.
- [Phase 09]: Keep the Svelte adapter capability-thin: callers supply Concierge and BridgeRegistry while one native $effect owns registration and teardown. — Framework lifecycle controls authority without duplicating core construction, subscriptions, or cleanup logic.
- [Phase 09]: Preserve $effect and $state.snapshot rune syntax in svelte-package output. — The downstream Svelte compiler must own rune transformation; generic prebundling or hand cloning would erase the framework contract.
- [Phase 09]: Bind @sveltejs/package@2.5.8 to TypeScript 6.0.3 with a version-exact pnpm package extension. — The published packager omits its dynamic TypeScript dependency, while root TypeScript 7 intentionally exposes no legacy compiler API.
- [Phase 09]: Make root Vitest configuration own @testing-library/svelte and scope svelteTesting() to svelte-lifecycle. — The direct dependency removes undeclared-import warnings while noExternal rune compilation remains isolated from core and React projects.
- [Phase 09]: Restrict ADAPTER_SSR_OUT_DIR to normalized direct mkdtemp-style roots with the concierge-adapter-ssr- prefix. — This gives repeated SSR builds fresh owned roots without allowing repository or arbitrary filesystem writes.
- [Phase 09]: Allow only the esbuild build script required by Astro 7.2.0 while retaining pnpm strictDepBuilds. — The exact direct dependency needs its platform-binary installer; a narrow allowBuilds entry preserves supply-chain enforcement.
- [Phase 09]: Closed recursive discovery must exactly equal the four canonical production files before either independent 150-line budget is accepted. — This prevents file movement or alternate production extensions from hiding authored adapter code.
- [Phase 09]: Use the pinned TypeScript 7 unstable sync and AST exports with explicit TS and TSX ScriptKinds. — The root package no longer exposes the legacy compiler API, while these installed exports parse TSX and rune-aware Svelte TypeScript deterministically.
- [Phase 09]: Scratch mutants only count when their exact GateError code and identifying message are observed. — A generic parser failure cannot impersonate a loop or forbidden-responsibility kill.
- [Phase 09]: Keep only frozen action and stage declarations at module scope; construct every mutable SSR object per request.
- [Phase 09]: Exercise the public React and Svelte client entries without hydration and pass the Svelte snapshot normalizer explicitly.
- [Phase 09]: Use deterministic render IDs and disable the experimental Node navigator only inside fresh proof processes.
- [Phase 09]: Require exactly one nonempty built evidence block per validated temporary output root.
- [Phase 09]: Thread one immutable archive map through every all stage so tar, lint, install, declarations, SSR, consent, and mismatch checks share the same initial SHA-256 identities.
- [Phase 09]: Resolve adapter dependencies from installed adapter manifests and compare physical core realpaths, rather than trusting workspace metadata or npm graph text alone.
- [Phase 09]: Patch and repack only each disposable adapter's unique built expected-version literal, then verify the original core digest before and after the public lifecycle failure.
- [Phase 09]: Compare the exact Svelte adapter error first line because the Svelte runtime appends a component trace to the thrown Error message.
- [Phase 09]: Adapter documentation uses only application-owned createConcierge/createBridge construction and injects those exact objects through canonical client entries. — Keeps framework packages lifecycle-thin and mirrors the tested public surface.
- [Phase 09]: Singleton and contract-literal checks are client compatibility and integrity defenses, never server authorization. — Servers must authenticate and authorize the exact action and payload under current policy.
- [Phase 09]: Phase 8 release proof remains the nested release record verified from five live artifacts in a disposable snapshot; post-09-13 drift invalidates verify-only evidence. — Preserves inherited provenance and terminal ordering.

### Pending Todos

None yet.

### Blockers/Concerns

**No open blockers.**

**Resolved 2026-07-28** — *Core as `peerDependency` of adapters*, which blocked Phase 2 packaging wiring, is decided: **peer dependency**. Two core instances is a correctness failure, not a performance one — it nulls the bridge registry, splits the dedup window into two (so a retried call double-fires), and hides consent armed on one instance from the other. A peer range turns a version mismatch into a loud install-time error; a pinned dependency lets duplicates resolve silently. Diverging from TanStack's pinning is the accepted cost. Recorded in PROJECT.md Key Decisions; Phase 2 implements it as PKG-04.

**Resolved 2026-07-27** — "how `attested` is achieved on a voice-only transport" was the wrong question and is closed. It smuggled modality back into a contract that had already rejected it. Grades turn on content provenance (agent paraphrase vs app-rendered payload) and confirmation provenance (inferred vs a human act bound to that payload's hash). `attested` needs an app-rendered raw-payload surface and an observed act on it; whether the app also speaks is irrelevant, and no product class is capped below `attested`.

**Closed 2026-07-28** — the two "stale PROJECT.md rows" noted here were re-checked and are already correct. The Key Decisions row reads "Standard Schema v1 as a real dependency… `@standard-schema/spec` is depended on rather than inlined" and explicitly states "No `concierge-zod` bridge". This note was itself the stale artifact.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Test coverage | M9 second, *named* detector for `snapshotEquality` method-syntax regression — its only current symptom is a lone TS2578 unused-directive, the failure mode a reviewer silently deletes. Verifier confirmed non-blocking: SC-7a as roadmap-worded is caught by 3× TS2322. | Deferred → Phase 2 | Phase 1 / plan 01-09 |
| Test coverage | `MESSAGE_MAX_CHARS` export-placement guard. `verbatimModuleSyntax` is one-directional: a value in the type block escapes at exit 0 while erasing the runtime binding. **The guard must import from `../src/index.js`** — `results.test-d.ts`'s existing `_messageBound` imports from `../src/types.js` and cannot see this regression. Current state verified correct today. | Deferred → Phase 2 | Phase 1 / plan 01-09 |
| Test coverage | `Scheduler`'s own shape is pinned by nothing — the three `ConciergeConfig` assertions pin field-to-alias, not alias shape. Deliberately not pinned: RESEARCH A3 marks the signature MEDIUM-risk and expects Phase 6 to refine it, so a pin would fire on a sanctioned edit. | Deferred → Phase 6 | Phase 1 / plan 01-07 |
| Docs | README documents no type contract at all after the rewrite (commit `bc9ca88`). Threat T-01-26 is closed, but validation row 01-08-T2 now passes **vacuously**. Doc-coverage gap, not a correctness gap. | Accepted (override) | Phase 1 / plan 01-08 |
| Runtime | `Scheduler` is optional but there is **no `setTimeout` in scope to default to** — it is TS2304 under `lib: ["ES2022"]`. Phase 6 must either reach a platform timer structurally or make the seam required. | Deferred → Phase 6 | Phase 1 / plan 01-07 |
| Runtime | `ActionResult` admits contradictory states by design; the dispatcher normalizer must reject a success carrying a `reason` and a failure carrying none. Belongs beside `invalid_result` (DSP-09) and the SEC-06 sanitizer. **This is a scheduling obligation, not an assumption** — it arises from an *unratified orchestrator decision* on WR-06 (option-b: keep the flat shape), recorded verbatim in `01-13-SUMMARY.md`; the user has not ratified it. If ratification is withheld the alternative is the discriminated union on `ok`, which is free before publish and breaking after — Phase 8 is the last free moment. | Deferred → Phase 6 | Phase 1 / plan 01-13 |

## Session Continuity

Last session: 2026-08-11T04:59:46.741Z
Stopped at: Completed 09-10-PLAN.md
Resume file: None
