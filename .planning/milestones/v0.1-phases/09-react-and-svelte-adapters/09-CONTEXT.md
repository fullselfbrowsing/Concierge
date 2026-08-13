# Phase 9: React and Svelte adapters - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** Autonomous advisor discussion; standard calibration; all recommended defaults auto-selected

<domain>
## Phase Boundary

Ship the first two framework packages over the completed core: a React adapter and a Svelte 5 adapter. Each adapter puts an existing `Concierge` instance into framework scope, registers an existing core `BridgeRegistry` only from a client lifecycle, and removes that exact registration during cleanup. The Svelte package also supplies the real `$state.snapshot` normalization seam required by the consent kernel. Prove both packages through their packed artifacts, prove core construction during a real metaframework server render, and close the carried real-adapter half of PKG-04.

This phase owns ADP-01 through ADP-04 and the real-package closure evidence carried for PKG-04. It may add the two adapter packages, framework test/build dependencies, one deliberately small multi-framework example, package-boundary scripts, documentation, and adapter-specific CI gates. It does not move catalog, dispatch, session, consent, scheduling, matching, or transport behavior into a framework package; add UI; add another framework adapter; add a vendor transport; or change the server trust boundary.

</domain>

<decisions>
## Implementation Decisions

### Shared adapter boundary

- **D-09-01 — Adapters receive a constructed core instance and an existing bridge registry.** They do not build catalogs, create actions, own sessions, or mirror core state. Framework context carries the exact `Concierge` object by reference. Registration hands the core registry one ordinary `Bridge` containing application-owned action functions and live snapshot getters.
- **D-09-02 — Registration happens only in client lifecycle effects.** Component render/module evaluation may create framework context values and plain closures, but it may not call `registry.register`, touch DOM globals, allocate timers, or mutate core. Cleanup calls only the unsubscriber returned by that mount's registration. Core's monotonic token remains the sole stale-cleanup authority.
- **D-09-03 — Every user-reachable adapter registration performs the runtime package guards.** Call core's `assertSingleInstance()` and compare an adapter-embedded expected contract-version literal with core's exported `CONTRACT_VERSION`, failing with the adapter package name, expected/found values, and an upgrade instruction. Do not rely on structural TypeScript compatibility or peer resolution alone.
- **D-09-04 — Core is a peer of each adapter, never a bundled or ordinary runtime dependency.** Use a workspace peer for core plus a development link for build/tests. React and Svelte are framework peers with ranges that cover the supported majors. Packed artifacts must contain no bundled core and must converge on the consumer's one installed core.

### React lifecycle and live values

- **D-09-05 — Provide one small React context surface and one registration hook/component surface.** A provider supplies the exact instance; a consumer hook reads it and fails actionably when no provider exists; bridge registration remains a separate effect-owned operation so provider nesting does not implicitly mutate registries. Exact public names are planner discretion, but there must be one canonical path in docs and tests rather than aliases.
- **D-09-06 — The adapter owns React's ref mirroring.** Application code passes plain current snapshot values (and ordinary action functions); adapter code turns them into stable late-reading getters. The public example must not ask an app author to maintain `useRef` mirrors. Preserve the newest committed render across rerenders without registering during render.
- **D-09-07 — Test real StrictMode behavior and adversarial cleanup order.** Under React StrictMode, setup/cleanup/setup leaves the current bridge live, a stale cleanup cannot clear its replacement, same-object re-registration remains safe, rerendered state is read late, final unmount returns `read()` to `null`, and no registration occurs during SSR.
- **D-09-08 — Client directives belong only to React client entry modules.** Core remains free of `"use client"`. Ensure the directive survives the packed adapter artifact at the module that exports client hooks/components; do not mark the core barrel or the metaframework server entry as client-only.

### Svelte reactivity and packaging

- **D-09-09 — Use Svelte 5 native context and effects, not a store-shaped parallel runtime.** The provider/context path carries the exact core instance. Registration is owned by `$effect` (or the framework lifecycle primitive proven equivalent), returns the core unsubscriber, and performs no server-side registration. Do not implement a custom subscription loop or duplicate lifecycle state.
- **D-09-10 — Export the real `$state.snapshot` normalizer from rune-aware source.** The Svelte adapter's canonical creation path supplies that normalizer to `ConciergeConfig.normalizeSnapshot`; it must call Svelte's compiler intrinsic, not emulate it with `structuredClone`, JSON serialization, or core's default copier. Any rune-bearing source uses the `.svelte.ts` convention.
- **D-09-11 — Build Svelte with `@sveltejs/package`, never tsdown or another pre-bundler.** Publish unbundled framework-aware output with `types`, `svelte`, and ordinary ESM import/default resolution as required by current Svelte packaging guidance. Prove the packed tarball retains the framework transform path and actually reacts; a source import or build-only check receives no credit.
- **D-09-12 — The load-bearing Svelte test couples reactivity to consent drift.** Install the packed adapter and core, create a real `$state` proxy, review against a snapshot normalized by the adapter, mutate the state, and prove confirm stays closed because the stored review snapshot did not move. Include a control showing the getter itself sees the new live state.

### Budgets, SSR example, and release proof

- **D-09-13 — Enforce a 150-line production-source budget per adapter.** Count checked-in, authored production source only, excluding generated declarations/maps, tests, fixtures, package metadata, blank lines, and comment-only lines. The gate names the package and measured limit. No adapter production source may contain a loop, scheduler, retry/dedupe cache, catalog matcher, consent transition, transport routing, or copied core result logic.
- **D-09-14 — Use one minimal Astro example to exercise both adapters and the same catalog.** Astro is the metaframework because one server-rendered application can host React and Svelte islands without inventing a bespoke renderer. The example is a test harness, not a designed product: one shared core/catalog module, one bridge per framework island, and deterministic text/test ids only where automation needs them.
- **D-09-15 — SSR proof uses a fresh process and real built package entrypoints.** Render the example with browser globals absent and prove core imports and constructs, the shared catalog is identical for both adapter paths, neither registry is populated on the server, and no module-scope mutable application instance leaks across renders. Client lifecycle behavior is covered separately.
- **D-09-16 — Package proofs operate on tarballs and an isolated consumer install graph.** Pack core and both adapters, install those exact archives into a scratch consumer without workspace resolution, run type/runtime/SSR/reactivity probes, inspect tar contents and dependency graphs, and deliberately substitute an incompatible contract version to prove a loud failure. Validate each package with `publint` and `are-the-types-wrong` where applicable.
- **D-09-17 — Preserve prior release gates and close requirements from immutable evidence.** Root typecheck/build/test and existing Phase 8 ledgers remain green. Add adapter-specific named negative cases and mutation or equivalent deliberate-defect discrimination for lifecycle cleanup, React stale snapshot, Svelte missing `$state.snapshot`, SSR registration, budget bypass, bundled/duplicate core, and contract-version bypass.

### Claude's Discretion

- Exact exported provider, hook, component, context-key, bridge-props, and normalizer names, provided there is one documented canonical path per framework and no redundant alias surface.
- Exact React ref-mirroring primitive and effect choice, provided app code owns no ref, SSR performs no registration, and tests prove latest committed values plus StrictMode cleanup.
- Exact Astro route/component layout and automated test runner, provided both real adapters consume one shared catalog and the harness does not become a UI product.
- Exact peer minor pins, test libraries, source-count implementation, and adapter test partitioning, subject to current official framework/tooling compatibility and the locked package boundaries above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase contract
- `.planning/ROADMAP.md` — Phase 9 goal, five success criteria, light-research warning, and explicit no-UI-design note.
- `.planning/REQUIREMENTS.md` — ADP-01..ADP-04 and PKG-04 wording/traceability.
- `.planning/PROJECT.md` — locked decisions to ship React and Svelte together and make core a peer of every adapter.
- `.planning/research/ARCHITECTURE.md` — thin-adapter boundary, React live-ref hazard, Svelte proxy/packaging hazard, SSR constraints, and 150-LOC target.
- `.planning/research/PITFALLS.md` — P11 through P13 on Svelte compilation, React compiler friction, peer ranges, and contract-version mismatch.
- `.planning/research/STACK.md` — framework test/build stack, Vitest projects, Svelte filename/toolchain constraints, and peer strategy; verify its dated version recommendations against current official compatibility before pinning.

### Prior phase contracts and evidence
- `.planning/phases/02-packaging-build-and-release/02-CONTEXT.md` and `02-VERIFICATION.md` — ESM-only package, single-instance, pack/install, Node floor, and carried real-adapter PKG-04 caveat.
- `.planning/phases/05-bridge-registry-and-the-no-bridge-path/05-CONTEXT.md` and `05-VERIFICATION.md` — token-guarded registration, detached snapshots, default normalizer limits, and deferred framework proofs.
- `.planning/phases/08-consent-kernel/08-CONTEXT.md` and `08-VERIFICATION.md` — final snapshot/consent semantics and the immutable Phase 8 release baseline adapters must preserve.

### Live implementation seams
- `packages/concierge/src/types.ts` — `Bridge`, `BridgeRegistry`, `SnapshotNormalizer`, `ConciergeConfig`, and `Concierge` contracts.
- `packages/concierge/src/bridge.ts` — exact registration/unsubscriber and snapshot-capture semantics; adapters must delegate here.
- `packages/concierge/src/contract.ts` — `CONTRACT_VERSION` and `assertSingleInstance` runtime guards.
- `packages/concierge/src/concierge.ts` — constructed core handle and consent snapshot consumer.
- `packages/concierge/package.json`, `pnpm-workspace.yaml`, `vitest.config.ts`, `CONTRIBUTING.md` — current package/build/test conventions and the predeclared Svelte toolchain constraint.

### External primary references to refresh during research
- React official docs for `StrictMode`, effects, refs, context, server rendering, and client directives as applicable.
- Svelte official docs for `$state.snapshot`, `$effect`, context, rune-aware module filenames, and package publishing.
- Astro official docs for React/Svelte integrations and server rendering.
- pnpm/npm package metadata and official publint/ATTW/build-tool documentation for packed peer resolution.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createBridge` already owns last-registration-wins behavior, monotonic registration tokens, stale-cleanup refusal, and the frozen registry capability. Adapters need only invoke `register` in the correct lifecycle and return its unsubscriber.
- `Bridge` already separates imperative `actions` from getter-based `snapshot`; no framework-specific bridge type is needed in core.
- `ConciergeConfig.normalizeSnapshot` and the Phase 8 consent kernel already consume a caller-supplied normalizer at review/confirm boundaries. Svelte must fill that seam rather than add another snapshot path.
- `createConcierge` and `createBridge` already call `assertSingleInstance`; Phase 9 adds the first adapter-reachable calls and a literal contract-version assertion.
- Root build is deliberately `pnpm -r build`; each package owns its build tool. The workspace catalog already pins `svelte` and `@sveltejs/package` without installing them.
- Phase 2 already has synthetic peer-resolution fixtures, pack/install scripts, artifact checks, and a Node-floor probe that can be extended rather than replaced.

### Established Patterns
- Public packages are ESM-only, strict TypeScript, isolated declarations where bundled, and independently validated from packed artifacts.
- Source imports use `.js` specifiers; public objects are readonly/frozen where they are capabilities; runtime diagnostics are fixed and actionable.
- Core is DOM-free and server-constructible. Framework effects are the only legal registration boundary; top-level host reads are forbidden.
- Runtime adequacy is proven with named negative cases and deliberate defect discrimination, not happy-path counts.

### Integration Points
- Add `packages/concierge-react` with its own tsdown config and client-entry directive strategy.
- Add `packages/concierge-svelte` with its own `svelte-package` config and rune-aware normalizer source.
- Extend root Vitest projects only as needed for real framework compilation/lifecycle tests; do not move core tests into a DOM environment.
- Add `examples/adapter-ssr` (or an equally explicit planner-selected name) as the single Astro proof using a shared catalog module.
- Extend release/package scripts so packed core plus packed adapters are installed and exercised together in a fresh scratch consumer.

</code_context>

<specifics>
## Specific Ideas

- The primary React regression sequence is StrictMode setup → cleanup → setup, followed by a retained stale cleanup, a state rerender, and a direct core handler read that must observe the new committed value.
- The primary Svelte regression is review a rune-backed value → mutate the proxy → prove the getter moved but the stored consent snapshot did not → confirm returns `consent_stale` and enters no consequential handler.
- The mismatch probe should patch only the adapter's embedded expected contract literal in a disposable packed copy, preserving the installed core, so the failure proves the adapter guard rather than package-manager behavior.
- The SSR example should assert empty registries after multiple server renders, making cross-request leakage observable rather than merely checking that `document` is absent.

</specifics>

<deferred>
## Deferred Ideas

- Vue, Angular, Solid, and web-component adapters remain later work; no spike ships from Phase 9.
- Devtools/read-side React subscriptions, UI components, chat surfaces, and generative UI remain out of scope.
- Framework-specific transports, server authorization handlers, hydration protocols, and persistence remain later milestones.
- Browser-mode/Playwright testing is deferred unless research identifies a concrete lifecycle or compiler behavior that jsdom plus real build/SSR probes cannot exercise.

</deferred>

---

*Phase: 9-react-and-svelte-adapters*
*Context gathered: 2026-08-10*
