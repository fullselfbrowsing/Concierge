# Phase 9: React and Svelte adapters - Research

**Researched:** 2026-08-10
**Scope:** ADP-01 through ADP-04, plus the real-adapter closure half of PKG-04
**Confidence:** High for framework lifecycle/package contracts; medium for the smallest test harness topology until the first packed spike runs

## Executive Summary

Phase 9 should add two deliberately small lifecycle adapters over the already-complete public core. React needs context, effect-owned bridge registration, and an adapter-owned live-value getter so applications never maintain refs. Svelte needs context, `$effect`-owned registration, and one rune-aware export that delegates directly to `$state.snapshot`. Neither adapter should construct a second runtime layer or reproduce catalog, dispatch, session, consent, snapshot-comparison, scheduling, or cleanup logic.

The release proof must operate at three levels: real framework lifecycle tests, built-package artifact tests, and an isolated consumer that installs exact tarballs. Workspace tests cannot prove peer convergence, Svelte's published compiler path, directive preservation, or the contract-version failure. The isolated consumer is therefore authoritative for real `$state` detachment, one physical core, and deliberate version mismatch.

One current toolchain incompatibility must be designed rather than ignored. Core remains on TypeScript 7.0.2, and tsdown 0.22.14 accepts TypeScript 7. Current `svelte-check`, `@astrojs/check`, and `@astrojs/svelte` declare TypeScript 5/6 peers. Give Svelte/Astro tooling package-local TypeScript 6.0.3 while retaining TypeScript 7 for core, React, and a foreign tarball-consumer declaration test with `skipLibCheck: false`. Do not downgrade the root compiler or force an invalid peer graph.

## Current Official Stack

Registry metadata was refreshed on 2026-08-10. Pin development tools exactly where this repository already favors reproducibility; keep public framework peers broad enough to express the supported contract.

| Concern | Recommended version/range | Reason |
|---|---|---|
| React development runtime | `react` / `react-dom` `19.2.8` | Current matching pair; exercise the modern runtime while keeping the published adapter compatible with React 18.2 and 19. |
| React peer range | `^18.2.0 || ^19.0.0` | `@testing-library/react@16.3.2` accepts both; use `<Context.Provider>` so the adapter does not require React 19's shorthand. |
| React types | `@types/react@19.2.18`, `@types/react-dom@19.2.4` | Current React 19 declarations for development. |
| React lifecycle test | `@testing-library/react@16.3.2` | Current package and accepts React 18/19. |
| DOM test environment | `jsdom@29.1.1` | Retain the researched stable major rather than newly released 30; test tooling may run on a newer CI Node than the published runtime floor. |
| React compiler plugin | `@vitejs/plugin-react@5.2.0` | Supports Vite 4 through 8 and Node `>=22.12`; latest 6 is Vite-8-only and is unnecessary here. |
| Svelte development runtime | `svelte@5.56.8` | Current Svelte 5; contains the required snapshot/compiler behavior. |
| Svelte public peer | `^5.0.0` | Use `setContext`/`getContext`, not `createContext` (added in 5.40), so the range stays honest. |
| Svelte packager | `@sveltejs/package@2.5.8` | Current release and already workspace-cataloged; transpiles/generates declarations without bundling. |
| Svelte Vite plugin | `@sveltejs/vite-plugin-svelte@7.2.0` | Proven Vite 8/Svelte 5 line. |
| Svelte lifecycle test | `@testing-library/svelte@5.4.2` | Current package and accepts Svelte 5/Vitest. |
| Svelte checking | `svelte-check@4.7.5` + local `typescript@6.0.3` | Current checker accepts TS5/6, not TS7. |
| Astro example | `astro@7.2.0`, `@astrojs/react@6.0.2`, `@astrojs/svelte@9.0.1` | Current official integrations; Node floors match `>=22.12`. |
| Astro checking | `@astrojs/check@0.9.10` + local `typescript@6.0.3` | Current check package and Svelte integration both declare TS5/6 peers. |
| Library builder | existing `tsdown@0.22.14` | Its peer range includes TypeScript 7. Use only for React, never Svelte. |
| Package validation | existing ATTW `0.18.5`, publint `0.3.22` | Preserve the established release baseline; a tooling upgrade is unrelated. |

Primary references: [React StrictMode](https://react.dev/reference/react/StrictMode), [React effects](https://react.dev/reference/react/useEffect), [React refs](https://react.dev/reference/react/useRef), [React context](https://react.dev/reference/react/createContext), [Next.js `use client`](https://nextjs.org/docs/app/api-reference/directives/use-client), [Svelte `$state.snapshot`](https://svelte.dev/docs/svelte/%24state#%24state.snapshot), [Svelte `$effect`](https://svelte.dev/docs/svelte/%24effect), [Svelte context](https://svelte.dev/docs/svelte/context), [Svelte package publishing](https://svelte.dev/docs/kit/packaging), [Astro React](https://docs.astro.build/en/guides/integrations-guide/react/), [Astro Svelte](https://docs.astro.build/en/guides/integrations-guide/svelte/), and [Astro renderers](https://docs.astro.build/en/reference/integrations-reference/).

## React Adapter Design

### Public boundary

Use one client subpath as the canonical runtime surface, for example `@fullselfbrowsing/concierge-react/client`. Its module begins with the exact directive prologue `"use client";` before imports. The root entry remains server-importable and may export types/inert metadata, but it must not re-export hooks so the root itself becomes a client boundary.

The smallest coherent client API has four responsibilities:

1. A provider receives an already-constructed `Concierge` and supplies that exact reference through a context whose default is `null`.
2. A consumer hook reads the nearest instance and throws a fixed package-named remediation message when the provider is absent.
3. A live-value hook accepts a plain current value and returns a stable late-reading getter backed by an adapter-owned ref; examples contain no app-maintained `useRef` mirror.
4. A registration hook accepts an existing `BridgeRegistry` and ordinary `Bridge`; it performs package guards, calls `registry.register` only in an effect, and returns that exact unsubscriber from cleanup.

Use `<Context.Provider value={concierge}>` rather than React 19's shorthand so the public peer range remains honest for React 18. React also documents that duplicate modules can break context because provider and reader must share the same context object, reinforcing the physical-single-core/package proof.

### Lifecycle semantics

StrictMode re-runs Effects with an extra setup/cleanup cycle in development. Treat that as the primary integration sequence, not noise to mock away. A real `<StrictMode>` test must show the registry remains populated after the second setup, a retained stale cleanup cannot remove it, and final unmount returns `read()` to `null`.

Use a stable ref initialized from the first value and update it from adapter-owned post-commit effect logic; return a stable callback that reads `ref.current`. This keeps ref plumbing out of application code and avoids a getter that closes over a render-local binding. Declare mirror logic before registration. The named test rerenders, awaits committed effects, then dispatches/reads through core and observes the new value.

Registration belongs in `useEffect`, not render, `useMemo`, a callback ref, or module scope. React server rendering does not execute passive Effects, so `renderToString` is an inexpensive negative proof that registration stays absent during SSR. The adapter performs no `window`/`document` branch; framework lifecycle semantics supply the boundary.

Do not add a second token, ref-count, retry, or cleanup guard. Core's returned unsubscriber already owns monotonic-token protection and is the only authority that can reject stale cleanup safely.

## Svelte Adapter Design

### Public boundary

Use native context with a package-private immutable key plus typed `provideConcierge` / `useConcierge` wrappers around `setContext` and `getContext`. Do not use `createContext` while advertising `svelte: ^5.0.0`; official docs state that helper arrived in Svelte 5.40. Context carries the exact object and introduces no store.

Use a rune-aware module such as `src/lib/client.svelte.ts` for:

- a `SnapshotNormalizer` delegating directly to `$state.snapshot(value)`; and
- effect-owned bridge registration that runs package guards, calls `registry.register`, and returns the exact unsubscriber as `$effect` teardown.

Svelte documents that `$effect` runs only in the browser after mount and its teardown runs before re-execution and on component destruction. The helper must be invoked during component initialization so the rune belongs to a component effect tree.

### Normalizer ownership

Export the normalizer; do not wrap or call `createConcierge`. Canonical app setup stays explicit:

```ts
const concierge = createConcierge({
  ...config,
  normalizeSnapshot: svelteSnapshotNormalizer,
});
```

This satisfies both locked constraints: core captures configuration once at construction, while adapters receive a constructed instance for context/registration. A wrapper factory would hide catalog construction in the adapter and violate the thin boundary.

`$state` makes arrays/simple objects deeply reactive proxies; `$state.snapshot` produces a static non-proxy value for external APIs. Do not replace it with `structuredClone`, JSON serialization, or the core default. The tarball test proves both halves: the live getter sees mutation, but the review-time consent snapshot does not move and confirm returns `consent_stale` without entering the handler.

### Package output

Run `svelte-package` over `src/lib`; never prebundle with tsdown. The official packager copies/preprocesses library files, transpiles TypeScript, generates adjacent declarations, validates the manifest, and requires fully specified ESM relative imports. Expose `types`, `svelte`, `import`, and `default` conditions to unbundled output. Publish dist/source required by declaration maps, README, and LICENSE; exclude tests/specs.

Use package-local TypeScript 6.0.3 for `svelte-check` and Svelte tooling. A separate scratch consumer installs packed output with TypeScript 7.0.2 and `skipLibCheck: false`, proving declarations remain valid for the repository's forward compiler without misdeclaring checker peers.

## Packaging and Contract-Version Proof

Both manifests make core a `peerDependency` using `workspace:^` and a `devDependency` using `workspace:*`. React/Svelte are framework peers plus development pins. Core never appears in adapter `dependencies`, and builders externalize it.

Every registration route runs this order inside client lifecycle:

1. `assertSingleInstance()` from public core;
2. compare imported `CONTRACT_VERSION` with an adapter-embedded expected literal;
3. throw an actionable package/expected/found/upgrade error on mismatch;
4. call the supplied registry's `register`;
5. return its exact unsubscriber.

The expected version cannot be another import or computed alias of core; that makes the comparison tautological. The mismatch probe alters only the embedded adapter literal in a disposable snapshot, leaves core unchanged, and asserts the package-named failure. A peer-install error does not substitute for this runtime guard.

Pack core and both adapters, then install the exact archives into a scratch consumer outside workspace globs. Prove:

- manifests contain core only as a peer;
- tarballs contain no private tests or bundled core implementation;
- installed resolution/realpaths converge on one physical core;
- React's client entry retains its directive while core/root server entries do not acquire it;
- TypeScript 7 with `skipLibCheck: false` consumes all declarations;
- Node imports server-safe entries;
- React SSR and compiled Svelte SSR leave registries empty;
- a compiled real `$state` consumer demonstrates live reactivity and consent drift;
- deliberate contract mismatch fails loudly.

Run publint/ATTW against each packed package with an appropriate ESM profile. Preserve the existing core pack/install, dependency, Node-floor, Phase 8 ledger, and release gates independently; Phase 9 adds evidence rather than redefining old evidence formats.

## Astro SSR Example

Astro is the smallest metaframework with official React and Svelte renderers in one app. Create a private `examples/adapter-ssr` workspace with both integrations. One shared module defines the immutable action/stage configuration or factory used by both components. Each render constructs request-local Concierge/registry objects; no mutable instance, bridge, or registry lives at module scope.

This is a deterministic harness, not UI. It needs only enough text/test ids to prove both components use the same catalog definition. `astro build` succeeds without browser globals. SSR leaves both registries empty because React `useEffect` and Svelte `$effect` do not run on the server. Render/build twice or emit a machine probe proving identities are fresh and no registration leaked.

Do not use Astro's experimental Container API as the primary gate. A normal build with official integrations is stable evidence; a container helper is optional only if it does not replace the build.

## Source Budget

Enforce at most 150 authored nonblank, non-comment production lines per adapter. Explicitly enumerate production source; exclude generated dist/declarations/maps, tests, fixtures, config, metadata, docs, blanks, and comment-only lines. Emit package, measured lines/files, and limit.

Also reject loops, timers/schedulers, retry/dedupe caches, queues, stage/catalog matching, consent transitions, transport routing, or copied result sanitation. Test the counter itself with an added production file/over-limit negative control; otherwise moving logic to an uncounted file defeats ADP-03.

Treat the limit as a design boundary, not permission to compress unreadable logic. If an adapter needs more, identify which responsibility belongs in core.

## Validation Architecture

| Layer | Purpose | Authoritative for |
|---|---|---|
| React source lifecycle | real StrictMode/context/effects/latest value | ADP-01 |
| Svelte source lifecycle | compiled context/effect/cleanup | ADP-02 registration |
| Existing core Node regression | no DOM compiler/runtime regression | ADP-04 and prior requirements |
| Built artifacts | exports, directive, inert import, manifest/output paths | package shape |
| Astro SSR | one metaframework with both renderers | ADP-04 SSR |
| Three-tarball consumer | TS7 declarations, one core, real rune path, mismatch | ADP-02/04 and PKG-04 |
| Budget gate | count and forbidden responsibilities | ADP-03 |
| Immutable deliberate defects | prove negative gates load-bearing | phase confidence |

Required named negatives:

1. **R1 cleanup:** remove/replace exact cleanup; current registration disappears/leaks and React fails.
2. **R2 stale getter:** close over initial value; rerender/direct core read fails with an assertion marker.
3. **S1 native snapshot:** replace `$state.snapshot` with identity; packed consent drift loses `consent_stale` or reaches handler.
4. **SSR1 timing:** register during render/module evaluation; server render sees a populated registry.
5. **B1 budget omission:** omit an added production file; independent control detects disagreement.
6. **P1 duplicate core:** move core to dependency/bundle; manifest/graph/realpath/content gate fails.
7. **C1 version bypass:** remove literal comparison or compare import to itself; incompatible artifact no longer throws.

Use Phase 8's immutable snapshot, exact replacement, compilation, assertion-observed fingerprint, restoration, and revision-bound release architecture. Do not mutate the live tree or credit a generic nonzero exit. Persist register, evidence, and one release evidence artifact; ledger verification rejects stale inputs, duplicate ids, missing markers, uncompiled mutants, restored-red targets, and release drift.

Sampling:

- Per task: package-scoped typecheck/build/test or one named case, under 30 seconds absent installation.
- Per wave: root typecheck/build/test plus completed package gates.
- Package/mutation work: one preflight per new mutant, then full battery/final release snapshot.
- Close: Phase 8 ledger, root release gates, adapter artifact gates, Astro SSR, three-tarball consumer, budget, mutation ledger, requirement/security closure.

All behaviors are automatable. No visual QA, external account, or human-only check is required.

## Suggested Plan Decomposition

1. Contracts/RED gates and package/config skeletons.
2. React adapter, StrictMode/latest-value/SSR, and artifact proof.
3. Svelte adapter, local TS6 toolchain, lifecycle/native normalizer, and artifact proof.
4. Astro example with shared catalog and normal SSR evidence.
5. Three-tarball consumer with TS7, one core, real `$state`, and mismatch.
6. Budget plus seven immutable deliberate defects and release evidence.
7. CI/release/docs/requirements/security closure.

React and Svelte land in the same phase after shared RED contracts, never as separate phases. Tarball/final evidence depends on both.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| App-level React ref plumbing or stale closure | adapter-owned live getter; committed rerender test |
| StrictMode test merely retests core | mount a real StrictMode tree |
| Svelte compiles but loses reactivity | `svelte-package` plus exact-tarball `$state` proof |
| Svelte peer range lies | use set/get context, not 5.40-only createContext |
| TS7 violates framework peers | local TS6 for Svelte/Astro; TS7 foreign consumer |
| Workspace links hide two cores | external install plus peer/realpath/content proof |
| Version comparison is tautological | adapter literal plus mismatch mutant |
| SSR checks only missing DOM | render twice; fresh identities and null registries |
| Budget is gamed by file movement | explicit enumeration plus counter mutant |
| Example becomes product UI | deterministic harness only; no UI-SPEC/visual review |

## Open Questions

No user decision is required. Resolve these with small RED spikes inside plans:

- whether tsdown preserves a hand-written client directive for two React entries without a banner;
- the generic spelling assigning `$state.snapshot` to `SnapshotNormalizer` without an unsafe cast;
- whether Svelte source tests are most reliable in root Vitest projects or an owning-package Vite config.

Each is deterministic and does not alter scope.

---

*Phase: 09-react-and-svelte-adapters*
*Research complete: 2026-08-10*
