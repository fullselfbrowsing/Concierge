# Phase 9: React and Svelte Adapters - Pattern Map

**Mapped:** 2026-08-10
**Scope:** 44 recommended new/modified files
**Live analog coverage:** 38 / 44
**Primary evidence:** current source, tests, package metadata, and scripts in this checkout

## Evidence Precedence

Use evidence in this order:

1. The locked decisions in 09-CONTEXT.md, especially D-09-01 through D-09-17.
2. Live source, tests, package metadata, and scripts cited below.
3. Verified Phase 5 and Phase 8 behavior.
4. Phase 2/5/8 PATTERNS, PLAN, and VALIDATION prose only as historical rationale.
5. 09-RESEARCH.md for current React, Svelte, Astro, and packaging APIs.

09-DISCUSSION-LOG.md is audit history and is not planning evidence. Several older planning documents contain superseded export counts, dependency versions, and proposed paths. Do not copy those values over the live repository.

There is no implemented React, Svelte, or Astro package in this checkout. Framework-only mechanics therefore have no live analog. This map identifies the core boundary and local engineering conventions; the planner must combine it with 09-RESEARCH.md rather than inventing framework APIs from historical prose.

## Recommended File Map

Exact public symbol names remain planner discretion under D-09-05. The paths below are the smallest concrete topology that exposes one canonical path per framework and keeps authored adapter production code measurable.

### File Classification

| New/Modified File | Change | Role | Data Flow | Closest Live Analog | Match |
|---|---:|---|---|---|---|
| packages/concierge-react/package.json | NEW | config/package | package-resolution | packages/concierge/package.json; test/fixtures/adapter-alpha/package.json | exact |
| packages/concierge-react/tsconfig.json | NEW | config | transform | packages/concierge/tsconfig.json | exact |
| packages/concierge-react/tsconfig.test-d.json | NEW | config | transform | packages/concierge/tsconfig.test-d.json | exact |
| packages/concierge-react/tsdown.config.ts | NEW | config | transform | packages/concierge/tsdown.config.ts | role-match |
| packages/concierge-react/src/index.ts | NEW | server-safe barrel/types | transform | packages/concierge/src/index.ts | exact |
| packages/concierge-react/src/client.tsx | NEW | provider/hook | event-driven lifecycle | core contract.ts, bridge.ts, and types.ts | partial |
| packages/concierge-react/test/adapter.test.tsx | NEW | test | event-driven lifecycle | packages/concierge/test/bridge.test.ts | role-match |
| packages/concierge-react/test/artifact.test.ts | NEW | test | package I/O | packages/concierge/test/artifact.test.ts | exact |
| packages/concierge-react/test-d/exports.test-d.ts | NEW | test | transform | packages/concierge/test-d/bridge.test-d.ts | exact |
| packages/concierge-react/README.md | NEW | docs | request-response | packages/concierge/README.md | exact |
| packages/concierge-react/LICENSE | NEW | config | file-I/O | packages/concierge/LICENSE | exact |
| packages/concierge-svelte/package.json | NEW | config/package | package-resolution | packages/concierge/package.json; fixture adapter manifests | role-match |
| packages/concierge-svelte/svelte.config.js | NEW | config | transform | none in live tree | none |
| packages/concierge-svelte/tsconfig.json | NEW | config | transform | packages/concierge/tsconfig.json | role-match |
| packages/concierge-svelte/tsconfig.test-d.json | NEW | config | transform | packages/concierge/tsconfig.test-d.json | role-match |
| packages/concierge-svelte/src/index.ts | NEW | package barrel | transform | packages/concierge/src/index.ts | exact |
| packages/concierge-svelte/src/context.ts | NEW | provider/context | request-response | core types.ts and index.ts | partial |
| packages/concierge-svelte/src/client.svelte.ts | NEW | hook/utility | event-driven lifecycle + transform | core contract.ts, bridge.ts, concierge.ts | partial |
| packages/concierge-svelte/test/adapter.test.ts | NEW | test | event-driven lifecycle | packages/concierge/test/bridge.test.ts | role-match |
| packages/concierge-svelte/test/fixtures/Harness.svelte | NEW | test fixture | event-driven lifecycle | none in live tree | none |
| packages/concierge-svelte/test/artifact.test.ts | NEW | test | package I/O | packages/concierge/test/artifact.test.ts | exact |
| packages/concierge-svelte/test-d/exports.test-d.ts | NEW | test | transform | packages/concierge/test-d/bridge.test-d.ts | exact |
| packages/concierge-svelte/README.md | NEW | docs | request-response | packages/concierge/README.md | exact |
| packages/concierge-svelte/LICENSE | NEW | config | file-I/O | packages/concierge/LICENSE | exact |
| examples/adapter-ssr/package.json | NEW | config/fixture | package-resolution | packages/concierge/test/fixtures/adapter-alpha/package.json | role-match |
| examples/adapter-ssr/astro.config.mjs | NEW | config | SSR transform | none in live tree | none |
| examples/adapter-ssr/tsconfig.json | NEW | config | transform | root tsconfig.base.json | role-match |
| examples/adapter-ssr/src/shared/catalog.ts | NEW | service/fixture | request-response | packages/concierge test catalog fixtures | partial |
| examples/adapter-ssr/src/components/ReactIsland.tsx | NEW | component | event-driven lifecycle | none in live tree | none |
| examples/adapter-ssr/src/components/SvelteIsland.svelte | NEW | component | event-driven lifecycle | none in live tree | none |
| examples/adapter-ssr/src/pages/index.astro | NEW | component/route | SSR request-response | none in live tree | none |
| examples/adapter-ssr/test/ssr.test.ts | NEW | test | subprocess + SSR | packages/concierge/test/single-instance.test.ts | role-match |
| scripts/phase-09-package-check.mjs | NEW | utility/test harness | package I/O + subprocess | scripts/pack-install-check.sh | exact |
| scripts/phase-09-mutation-battery.mjs | NEW | utility/test harness | batch + file-I/O | scripts/phase-08-mutation-battery.mjs | exact |
| .planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json | NEW | test evidence | batch | Phase 8 mutation register | exact |
| .planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json | NEW | test evidence | batch | Phase 8 mutation evidence | exact |
| .planning/phases/09-react-and-svelte-adapters/09-RELEASE-EVIDENCE.json | NEW | release evidence | batch | Phase 8 release evidence | exact |
| package.json | MOD | config | orchestration | current package.json scripts | exact |
| pnpm-workspace.yaml | MOD | config | package-resolution | current catalog and workspace globs | exact |
| pnpm-lock.yaml | MOD | config | package-resolution | current lockfile | exact |
| vitest.config.ts | MOD | config/test | transform + test routing | current node project | role-match |
| README.md | MOD | docs | request-response | current status/roadmap sections | exact |
| .github/workflows/ci.yml | MOD | config | batch | current ordered CI gates | exact |
| .github/workflows/release.yml | MOD | config | batch | current release verification step | role-match |

The planner may co-locate a test helper or type assertion, but should not merge React and Svelte production entrypoints or hide either package's authored production lines outside its package. README.md and the package READMEs must document one canonical API path, not aliases.

## Pattern Assignments

### packages/concierge-react/src/index.ts and src/client.tsx

**Role/data flow:** a server-safe root barrel/context surface plus a client-directed registration entry; client lifecycle events flow into a core registry.

**Closest live sources:**

- packages/concierge/src/types.ts:1174-1194 defines the ordinary Bridge and BridgeRegistry boundary.
- packages/concierge/src/contract.ts:62 and 190-211 defines the literal contract version and reachable runtime guard.
- packages/concierge/src/bridge.ts:201-293 defines registration ownership and token-safe cleanup.
- packages/concierge/src/index.ts:157,165,169 proves all adapter imports are public barrel exports.

**Copy the public-boundary shape** (types.ts:1174-1194):

~~~typescript
export interface Bridge<
  Actions extends Record<string, (...args: never[]) => unknown> = Record<
    string,
    (...args: never[]) => unknown
  >,
  Snapshot extends Record<string, () => unknown> = Record<
    string,
    () => unknown
  >,
> {
  actions: Actions;
  snapshot: Snapshot;
}

export interface BridgeRegistry<B extends Bridge = Bridge> {
  readonly id: string;
  read: () => B | null;
  register: (bridge: B) => () => void;
}
~~~

The adapter receives an already-created Concierge and an already-created registry. Import values and types from @fullselfbrowsing/concierge, never packages/concierge/src/*. Do not call createConcierge, createBridge, buildCatalog, session code, consent code, or transport code in the adapter.

Keep src/index.ts server-safe and free of the client directive. It exposes types/context/provider-safe surface and the explicit client subpath without making a metaframework server import client-only. Put effect-owned registration in src/client.tsx, whose first statement is "use client". The manifest and docs must make the split canonical rather than exporting a second alias.

**Reachable guard pattern** (contract.ts:62,190-211 and bridge.ts:201-203):

~~~typescript
export const CONTRACT_VERSION = 1;

export function createBridge(/* ... */) {
  assertSingleInstance();
  // ...
}
~~~

For the React registration path, preserve that ordering but add the adapter-owned literal check required by D-09-03:

~~~typescript
// Required shape, not an existing source excerpt.
const EXPECTED_CONTRACT_VERSION = 1;

function assertReactContract(): void {
  assertSingleInstance();
  if (CONTRACT_VERSION !== EXPECTED_CONTRACT_VERSION) {
    throw new Error(
      "@fullselfbrowsing/concierge-react expected core contract v" +
        EXPECTED_CONTRACT_VERSION +
        " but found v" +
        CONTRACT_VERSION +
        "; upgrade the adapter and core together.",
    );
  }
}
~~~

The expected value must be a literal embedded in the adapter artifact. Comparing CONTRACT_VERSION to a second import from core is a guard bypass. Call the guard from every public registration route immediately before registry.register. Never call it at import, provider render, or SSR.

**Lifecycle assignment:**

- The provider stores the exact Concierge reference. Do not spread, clone, freeze, or wrap it.
- The consumer hook throws an actionable package-named error outside the provider.
- Provider nesting only changes context lookup; it does not register anything.
- The registration API accepts ordinary action functions and plain current snapshot values.
- Adapter-owned refs mirror those values after a committed render. Snapshot getter functions close over the adapter refs, not render-local values.
- Only a client lifecycle effect may call registry.register.
- That effect returns the exact unsubscriber from that registration. No additional cleanup state is allowed.
- Effect dependencies must not turn every snapshot value change into re-registration; a rerender changes what late getters read.
- The first directive in src/client.tsx and its packed client entry must be "use client"; src/index.ts, core, and Astro server modules do not get that directive.

There is no live React ref/effect analog. Use 09-RESEARCH.md for the exact React primitive and dependency rules. The repository analog starts only at registry.register.

### packages/concierge-svelte/src/index.ts, src/context.ts, and src/client.svelte.ts

**Role/data flow:** a pure package barrel, server-safe context helpers, lifecycle registration, and reactive snapshot normalization.

**Closest live sources:**

- packages/concierge/src/types.ts:712-728 defines SnapshotNormalizer.
- packages/concierge/src/types.ts:1692-1733 exposes ConciergeConfig.normalizeSnapshot.
- packages/concierge/src/concierge.ts:393-423 captures the supplied normalizer once.
- packages/concierge/src/concierge.ts:959-974 passes it into snapshot capture.
- packages/concierge/src/bridge.ts:954-1007 invokes snapshot getters late and applies the chosen normalizer.
- packages/concierge/src/index.ts is the pure-barrel analog for src/index.ts.

**Copy the core extension seam** (types.ts:712-728):

~~~typescript
export type SnapshotNormalizer = <T>(value: T) => T;

// ConciergeConfig
normalizeSnapshot?: SnapshotNormalizer;
~~~

The normalizer must be the real Svelte compiler intrinsic:

~~~typescript
// Required framework shape; exact imports/export syntax comes from 09-RESEARCH.md.
export const normalizeSvelteSnapshot: SnapshotNormalizer = (value) =>
  $state.snapshot(value);
~~~

Keep rune-bearing and effect-owned code in src/client.svelte.ts. Keep src/index.ts as the package barrel and non-rune context helpers in src/context.ts. Do not replace the normalizer with structuredClone, JSON serialization, a hand-written proxy copier, or the core default normalizer. Export the normalizer for the application's canonical core construction call: the application passes it explicitly as `ConciergeConfig.normalizeSnapshot` before handing the constructed instance to Svelte context. The adapter must not wrap or call `createConcierge`, reimplement config capture, or reproduce snapshot comparison.

The context API carries the exact Concierge object by reference. Registration uses native Svelte 5 context/effect mechanics from 09-RESEARCH.md and follows the same guard/register/unsubscriber ordering as React. It must not expose a store-shaped parallel runtime, subscribe loop, scheduler, or module singleton.

**Barrel pattern** (packages/concierge/src/index.ts:157,165,169):

~~~typescript
export { CONTRACT_VERSION, assertSingleInstance } from "./contract.js";
export { createConcierge } from "./concierge.js";
export { createBridge, captureSnapshot, offPageResult } from "./bridge.js";
~~~

Use explicit relative .js specifiers in pure TypeScript barrels when the Svelte packaging guidance permits them. Do not use private core source imports.

There is no live Svelte rune, context, effect, or svelte-package output analog. Those exact mechanics come from 09-RESEARCH.md.

### React and Svelte package manifests

**Analogs:** packages/concierge/package.json:1-59 and the two fixture manifests at packages/concierge/test/fixtures/adapter-{alpha,beta}/package.json:1-7.

**Copy publication metadata and ESM exports** (core manifest:25-46):

~~~json
{
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist", "src", "README.md", "LICENSE"],
  "publishConfig": { "access": "public" },
  "engines": { "node": ">=22.12.0" }
}
~~~

**Copy the peer + development-link topology** (fixture manifests:6-7), changing the package names:

~~~json
{
  "peerDependencies": {
    "@fullselfbrowsing/concierge": "workspace:^"
  },
  "devDependencies": {
    "@fullselfbrowsing/concierge": "workspace:*"
  }
}
~~~

Add React or Svelte as a framework peer and as a pinned/catalog development dependency for builds and tests. Do not put core in dependencies. Do not bundle core. Use the supported framework ranges selected by 09-RESEARCH.md; do not copy 2026-07 historical research pins.

The React manifest needs a server-safe root export and an explicit client export resolving to the directive-bearing module. The Svelte manifest additionally needs the current official types, svelte, import, and default condition shape. Condition ordering and output names are framework guidance, not something the live core manifest can prove.

### packages/concierge-react/tsdown.config.ts

**Analog:** packages/concierge/tsdown.config.ts:1-49.

Copy package-local configuration, neutral platform, ESM-only output, declaration generation, clean output, and publint/ATTW error-level checks. Keep React and @fullselfbrowsing/concierge external. Add an artifact assertion that dist's client entry begins with the client directive; a successful tsdown exit alone does not prove directive survival.

Do not reuse tsdown for Svelte.

### packages/concierge-svelte/svelte.config.js

**Analog:** none.

Follow 09-RESEARCH.md and @sveltejs/package. The locked local constraints are:

- input contains rune-aware .svelte.ts source;
- output remains unbundled/framework-aware;
- generated declarations and maps are excluded from the authored 150-line count;
- the packed package exposes types, svelte, and ordinary ESM import/default resolution;
- a tarball-installed consumer executes real reactivity.

The existing pnpm-workspace.yaml:27-37 comment is a binding local convention: Svelte uses @sveltejs/package, never tsdown.

### Adapter tsconfig and type tests

**Analogs:** tsconfig.base.json:1-21, packages/concierge/tsconfig.json:1-8, packages/concierge/tsconfig.test-d.json:1-13, and packages/concierge/test-d/bridge.test-d.ts:98-178.

Inherit the strict ES2022 base. Keep production emit/build input separate from the no-emit type-test program. Type tests import the adapter's public barrel and core's public barrel; they must not import internal source modules. For React, include the framework JSX setting selected by current guidance. For Svelte, extend the framework-generated config rather than hand-copying compiler options.

Type assertions should prove:

- provider receives the exact generic Concierge type;
- registry and Bridge action/snapshot generics remain inferred;
- snapshot values are plain values at the React call site;
- cleanup is lifecycle-owned and not part of the public return type;
- missing/wrong props fail;
- only the canonical public exports exist.

The isolated tarball consumer is still required. A workspace type test alone cannot prove published declarations resolve.

### packages/concierge-react/test/adapter.test.tsx

**Primary analog:** packages/concierge/test/bridge.test.ts.

Copy these exact behavioral sequences through real React StrictMode:

| Core test analog | Live lines | Adapter assertion |
|---|---:|---|
| B10: register A(u1), u1(), register A(u2), re-fire u1 | 513-533 | setup/cleanup/setup plus retained old cleanup leaves current bridge live |
| B11: same object registered twice, then old cleanup | 535-559 | same-object StrictMode replacement is token-safe |
| B15: same read result reports moved state | 632-659 | rerender updates committed value without registration churn |
| final cleanup cases | 302-320, 797-835 | final unmount makes read() null; repeated stale cleanup is inert |

Use one observable registry created by core, mount a real provider/registration component, and assert registry.read() directly. Do not replace StrictMode with manually calling registry.register twice; the core suite already does that. Retain the old cleanup through an instrumented wrapper or equivalent real lifecycle observation and fire it after replacement.

Required named negatives:

- provider-less consumer hook throws an actionable @fullselfbrowsing/concierge-react message;
- renderToString or equivalent real server render does not call register and does not populate the global contract registry;
- state rerender followed by a direct core handler read returns the newest committed value;
- an effect implementation that closes over the first render is killed;
- an implementation that registers during render/SSR is killed;
- an implementation that ignores the returned unsubscriber is killed.

Reset the contract global between tests using the pattern in single-instance.test.ts:95-180: hard-code Symbol.for("@fullselfbrowsing/concierge.contract"), delete it in setup/teardown, and dynamically import built artifacts after the reset. Do not export the private key from production to make tests convenient.

### packages/concierge-svelte/test/adapter.test.ts and test/fixtures/Harness.svelte

**Primary analogs:** bridge.test.ts:513-659, bridge-snapshot.test.ts:271-328, and consent-kernel.test.ts:835-870.

The source-level lifecycle suite mounts a real compiled Svelte component. It proves effect registration, exact cleanup, no registration during SSR, exact context identity, same-object re-registration safety, and live getter behavior.

The load-bearing proof is not this source test. D-09-12 requires a packed consumer with the real framework:

1. Install the exact core and Svelte-adapter tarballs outside the workspace.
2. Create a real $state proxy.
3. Construct Concierge through the adapter's canonical path so normalizeSnapshot is supplied.
4. Register a bridge whose getter returns that proxy.
5. Review and retain the detached captured snapshot.
6. Mutate the proxy.
7. Prove registry.read()!.snapshot getter observes the new value.
8. Confirm and assert an exact failure reason of consent_stale.
9. Prove the guarded handler never entered.

bridge-snapshot.test.ts:271-328 is only an assertion-shape analog. Its hand-built Proxy fixture is explicitly insufficient for Svelte credit. consent-kernel.test.ts:835-870 is the current live consent-drift oracle.

Required named mutants/negatives:

- replace $state.snapshot with identity/default/structuredClone and make the packed proof fail;
- remove the supplied normalizer from the canonical factory;
- move registration out of the effect so SSR populates the registry;
- discard or replace the exact cleanup;
- use a module-level app instance and prove cross-render leakage.

### Adapter artifact tests

**Analog:** packages/concierge/test/artifact.test.ts:31-49,99-105,145-171.

Copy the built-artifact guard:

~~~typescript
const DIST_URL = new URL("../dist/index.js", import.meta.url);

// Fail actionably if dist is missing, then import the built URL.
const runtime = await import(DIST_URL.href);
~~~

Assertions must target dist, never src:

- expected runtime bindings are callable;
- type-only names are absent at runtime;
- React's dist client module retains "use client" as its directive prologue;
- importing either adapter is inert with respect to the core contract global and registries;
- Svelte's emitted/package paths match manifest conditions;
- no emitted adapter file embeds core implementation or a second CONTRACT_VERSION implementation.

Keep exact public export lists in package-local export-surface tests if either package has more than a trivial barrel. Do not modify the core's current 75/60/15 surface assertion unless core itself changes.

### examples/adapter-ssr

**Role/data flow:** one real Astro server-rendering fixture hosting both framework islands.

There is no live Astro analog. Use 09-RESEARCH.md for integrations and render APIs. Apply these local patterns:

- package.json is private, type: module, and uses workspace development links; it is never published.
- src/shared/catalog.ts exports one immutable catalog definition/factory used by both islands.
- Each request/render constructs its own Concierge and registries. No mutable Concierge, registry, or bridge lives at module scope.
- ReactIsland.tsx and SvelteIsland.svelte each register one ordinary Bridge from their own client lifecycle.
- index.astro is a server entry and must not contain "use client".
- The UI is deterministic text/test ids only; no styling or product shell.

examples/adapter-ssr/test/ssr.test.ts should follow the artifact/subprocess pattern in single-instance.test.ts:119-180 and scripts/pack-install-check.sh:112-175: launch a fresh Node process with browser globals absent and consume built/package entrypoints. Assert:

- core and both adapters import;
- core constructs;
- both adapter paths reference the same shared catalog object/factory;
- both registries read null on the server;
- a second render gets fresh app/registry identities;
- stdout exposes one parseable machine evidence line;
- stderr is empty except explicitly accepted tool diagnostics.

### scripts/phase-09-package-check.mjs

**Analog:** scripts/pack-install-check.sh:21-175.

Copy these proof properties:

~~~sh
# Existing analog:
# - create scratch outside repository workspace globs
# - pnpm pack --pack-destination "$OUT"
# - tar -tzf "$TGZ"
# - npm install --no-audit --no-fund exact tarball paths
# - typecheck the scratch consumer with skipLibCheck: false
# - import shipped runtime
# - emit one PACK_EVIDENCE machine line
~~~

Extend the concept without weakening the existing core check:

- build and pack core, React adapter, and Svelte adapter;
- resolve all three exact archive paths before install;
- install them into a scratch consumer that is not under packages/* or examples/*;
- inspect all tar entry lists and manifests;
- run publint and ATTW per publishable package where applicable;
- assert adapter manifests have core only in peerDependencies plus development metadata, never dependencies;
- inspect the installed graph/realpaths and prove both adapters converge on one core;
- prove no adapter tarball contains bundled core source/runtime;
- typecheck with shipped declarations and skipLibCheck false;
- run runtime import, React SSR, Svelte SSR, and real Svelte reactivity/consent probes;
- patch the adapter-embedded expected literal in an isolated artifact and prove a package-named expected/found/upgrade failure.

Do not replace scripts/pack-install-check.sh or reinterpret its PACK_EVIDENCE line. Phase 9 adds a distinct machine evidence record so prior core gates remain stable.

### scripts/phase-09-mutation-battery.mjs and evidence ledgers

**Analog:** scripts/phase-08-mutation-battery.mjs:2312-2514 and 3278-3426.

Copy the immutable-snapshot architecture, not scripts/mutate-and-prove.sh:

- enumerate exact tracked revision inputs;
- reject untracked or dirty scoped inputs;
- hash those inputs;
- copy them to a temporary snapshot;
- install/build only inside that snapshot;
- apply one exact replacement and require exactly one match;
- require build/typecheck/test execution markers, positive test counts, and an assertion-observed detector;
- record pre/post hashes and an immutable fingerprint;
- remove the snapshot;
- run final release gates against one separate immutable snapshot and reject input drift.

The older mutate-and-prove.sh edits the live worktree and has a documented lockfile/tree-clean weakness in Phase 2 verification. It is not the Phase 9 analog.

The Phase 9 register should include at least:

| Mutant | Deliberate defect | Required killer |
|---|---|---|
| M-09-R1 | returned cleanup no longer invokes exact registration unsubscriber | real StrictMode/adversarial cleanup test |
| M-09-R2 | React getter closes over initial render value | rerender + direct core read |
| M-09-S1 | Svelte normalizer becomes identity/default copier | packed real-$state consent_stale proof |
| M-09-SSR1 | registration moves to render/module scope | fresh-process SSR null-registry proof |
| M-09-B1 | authored production line counter skips a source file | independent budget fixture/control |
| M-09-P1 | core moves from peer to dependency or is bundled | tarball manifest/graph/realpath proof |
| M-09-C1 | adapter literal comparison is removed or compares core import to itself | patched incompatible-contract artifact |

Every detector needs a named test and an assertion-specific fingerprint. A build failure alone is not discrimination.

### Root config and workflows

#### package.json

Preserve current script order and semantics at package.json:20-26:

~~~json
{
  "build": "pnpm -r build",
  "test": "vitest run",
  "typecheck": "pnpm -r typecheck",
  "check:artifact": "pnpm --filter @fullselfbrowsing/concierge exec publint --strict && pnpm exec attw --pack packages/concierge --profile esm-only",
  "check:deps": "node scripts/pkg05-zero-runtime-deps.mjs packages/concierge/dist/index.js",
  "check:pack": "bash scripts/pack-install-check.sh",
  "check:node-floor": "bash scripts/node-floor-check.sh"
}
~~~

Add adapter-specific named scripts; do not silently broaden the existing core evidence parsers. Root build/typecheck remain recursive. Current framework/compiler/test dependencies belong in root devDependencies or the owning package, consistent with 09-RESEARCH.md.

#### pnpm-workspace.yaml and pnpm-lock.yaml

packages/* and examples/* already include the new packages/example. Preserve the deep fixture glob. Add current framework/build/test versions to the catalog if shared. The live lines 27-37 already state that Svelte is compiled by @sveltejs/package and list the existing Svelte catalog entries; reconcile versions with current official research rather than historical Phase 2 prose. Regenerate the lockfile normally and include it in immutable evidence.

#### vitest.config.ts

The current project at lines 84-90 is a single Node project:

~~~typescript
projects: [
  {
    test: {
      name: "node",
      environment: "node",
      include: ["packages/*/test/**/*.test.ts"],
    },
  },
]
~~~

Preserve core tests in Node. Add distinct React and Svelte projects/environments/compiler plugins as required by official guidance. Includes must cover .test.tsx and any compiled Svelte test harness; do not make the core suite inherit jsdom or a Svelte transform. Keep built-artifact tests ordered after build via the existing root gate sequence.

#### README.md and package READMEs

README.md:121-137 currently says adapters do not exist and lists them as v0.1 future work. Replace that status only when the real packed proofs pass. Document:

- exact package names;
- one canonical provider/context and registration path per framework;
- exact constructed Concierge and registry ownership;
- plain React snapshot values, with ref mirroring owned by the adapter;
- canonical Svelte creation path with the real snapshot normalizer;
- SSR non-registration;
- core peer compatibility and upgrade-together error;
- client consent is not server authorization.

Keep package READMEs short and point to the root security boundary, following packages/concierge/README.md:1-11.

#### CI and release

The current CI order is typecheck, build, test, artifact, dependency, pack, then the separate Node-floor job. Keep that order and add the named Phase 9 package, SSR, budget, and immutable mutation/ledger gates after build. Upload or retain all three exact tarballs/evidence files when artifacts are already being collected.

The release workflow currently runs only typecheck/build/test before changeset publication. Add the package/peer/artifact proof required to prevent publishing an adapter that passed only workspace-linked tests. Do not remove or weaken any Phase 8 ledger verification.

## Shared Patterns

### Imports and boundaries

- Value imports first, then import type, following live core style.
- Relative TypeScript imports use explicit .js specifiers.
- Cross-package imports use public bare package names.
- Adapter production code may depend only on the framework peer and public core API.
- No source import from packages/concierge/src.
- No module-scope constructed app, registry, bridge, timer, DOM access, or contract guard.

### Registration order

Every user-reachable registration path has exactly this order:

1. lifecycle setup begins on the client;
2. assertSingleInstance();
3. compare imported CONTRACT_VERSION against the adapter's embedded literal;
4. create/read the ordinary Bridge closures;
5. call the supplied registry.register(bridge);
6. return that exact unsubscriber as lifecycle cleanup.

Core owns monotonic token allocation, stale-cleanup refusal, warnings, and read(). The adapter must not add a second token, owner stack, cache, retry, dedupe layer, or registry.

### Snapshot ownership

bridge.ts:828-1017 and concierge.ts:959-974 are the only core snapshot pipeline:

- getters are invoked at capture/read time;
- a supplied normalizer is applied;
- detached snapshots are compared later by the consent kernel.

React contributes stable getters over adapter-owned refs. Svelte contributes the real $state.snapshot normalizer. Neither adapter compares snapshots, decides consent_stale, freezes app state, or copies core result logic.

### Error handling

Adapter misuse errors are synchronous and actionable:

- name the adapter package;
- describe the missing provider or incompatible core;
- include expected and found contract versions for mismatch;
- tell the consumer to upgrade adapter and core together.

Do not catch errors from registry.register, createConcierge, or core handlers and reformat them. Core owns its result/error semantics.

### Production line budget

Add one deterministic gate per adapter that counts checked-in authored production files only. Exclude tests, fixtures, metadata, generated declarations/maps, blank lines, and comment-only lines. The output names the package, measured count, and limit 150.

The gate also rejects loops, schedulers, retry/dedupe caches, catalog matching, consent transitions, transport routing, and copied result logic in production source. Test the counter itself with an over-limit or omitted-file fixture so M-09-B1 cannot pass through a naive glob.

### Artifact-first tests

There are three distinct levels:

1. Source lifecycle tests give fast framework feedback.
2. Built dist tests prove exports, directives, and import inertness.
3. Exact-tarball scratch tests prove package resolution, peer convergence, SSR, and real Svelte reactivity.

Do not award package or Svelte-reactivity credit to level 1.

## Required Test and Validation Matrix

| Requirement | Live analog/oracle | Phase 9 proof |
|---|---|---|
| ADP-01 React exact instance + registration | Bridge/Registry types.ts:1174-1194 | provider identity and registry.read() identity |
| ADP-01 React stale cleanup | bridge.test.ts B10/B11 | real StrictMode setup-cleanup-setup and retained cleanup |
| ADP-01 React late reads | bridge.test.ts B15 | rerender, no re-registration, direct core read sees committed value |
| ADP-02 Svelte lifecycle | bridge.test.ts B10/B11 | real compiled component effect and cleanup |
| ADP-02 Svelte detached state | bridge-snapshot D1 + consent K17 | packed real $state, mutate, live getter moved, confirm consent_stale |
| ADP-03 thin adapter | CONTRIBUTING.md:37-44 | 150-line gate plus prohibited-responsibility scan |
| ADP-04 SSR | single-instance F6 import-inert pattern | fresh process, browser globals absent, registry null, no app singleton |
| Contract compatibility | contract.ts:62,190-211 | direct guard on every registration plus incompatible embedded-literal mutant |
| One physical core | fixtures.test.ts:142-193 | three tarballs, manifest/dependency graph and installed realpath equality |
| Publish correctness | artifact.test.ts + pack-install-check.sh | publint/ATTW, tar inspection, foreign type/runtime/SSR/reactivity |
| Prior gates | package.json:20-26 + Phase 8 evidence | unchanged core gates and immutable Phase 9 release snapshot |

Tests should name requirement IDs and a stable case marker. Each negative must assert the intended observable, not merely nonzero exit. Capture tool output without relying on terminal color/type-alias rendering; Phase 2 validation found those diagnostics environment-sensitive.

## Integration Points

| Producer | Adapter use | Forbidden shortcut |
|---|---|---|
| public Concierge type/value from @fullselfbrowsing/concierge | context carries exact object | reconstructing or wrapping core |
| BridgeRegistry.register | lifecycle setup registers ordinary Bridge | registration during render/module/SSR |
| returned unsubscriber | exact lifecycle cleanup | adapter token or blanket clear |
| CONTRACT_VERSION + assertSingleInstance | first reachable registration guard | module-scope call or imported-vs-imported comparison |
| ConciergeConfig.normalizeSnapshot | Svelte canonical factory supplies real intrinsic | structuredClone/JSON/core default |
| getter-valued Bridge.snapshot | React refs and Svelte state read late | captured render value |
| core consent kernel | compares detached review/current snapshots | adapter consent or matcher logic |
| packed core tarball | one consumer-owned peer instance | bundled/ordinary dependency copy |

## Hazards and Non-Patterns

1. **Historical prose is stale.** Do not copy old export counts, package versions, or proposed filenames over live files and current 09-RESEARCH.
2. **Import safety is not registration safety.** Core createConcierge/createBridge guards do not cover an adapter that registers an already-existing registry. Each adapter registration path needs its own direct call.
3. **A version comparison can be tautological.** The expected side must remain a literal in the adapter artifact.
4. **React render writes are not committed-state proof.** The ref mirror must represent the newest committed render and registration must remain effect-owned. Exact primitive comes from official research.
5. **Effect dependency churn can hide a stale getter.** Tests must assert a state rerender updates the existing registration rather than merely replacing it.
6. **StrictMode simulation can retest core instead of React.** Mount a real StrictMode tree and retain/fire the old cleanup.
7. **A hand Proxy does not prove Svelte.** Only packed, compiler-transformed real $state plus $state.snapshot earns D-09-12 credit.
8. **svelte-package is not a bundler swap.** Do not route Svelte through tsdown or test only source imports.
9. **Workspace links can conceal duplicate core.** Scratch installs must live outside workspace globs and install exact tarballs.
10. **A green build can strip "use client".** Inspect the packed/exported client module's directive prologue.
11. **SSR can leak through module state without touching window.** Render twice in a fresh process and assert fresh identities plus null registries.
12. **Core tests must stay Node-only.** Do not globally change Vitest to jsdom or add framework transforms to the core project.
13. **The old live-tree mutation shell is not immutable evidence.** Use the Phase 8 snapshot/hashing architecture.
14. **The 150-line gate can be gamed by file movement.** Enumerate package production inputs and mutation-test an omitted file.
15. **Do not broaden adapter responsibility.** Loops, timers, queues, catalog matching, consent state, transports, and core result copies are automatic design failures even below 150 lines.

## No Live Analog

| File/mechanic | Why | Planner source |
|---|---|---|
| React committed ref mirroring and exact effect choice | no React code exists | 09-RESEARCH.md + D-09-06/07 |
| React client directive preservation option | no React build exists | 09-RESEARCH.md + packed artifact assertion |
| Svelte context/effect syntax | no Svelte component/runtime exists | 09-RESEARCH.md + D-09-09 |
| $state.snapshot in .svelte.ts | no rune source exists | 09-RESEARCH.md + D-09-10/12 |
| svelte.config.js/package condition details | no Svelte package exists | 09-RESEARCH.md + D-09-11 |
| Astro integrations and SSR route | no examples directory exists | 09-RESEARCH.md + D-09-14/15 |
| Real framework harness components | no framework test harness exists | 09-RESEARCH.md; behavioral oracle remains core tests |

## Metadata

**Live search scope:** package manifests and root configs; packages/concierge/src; packages/concierge/test and test-d; scripts; examples; .github workflows; Phase 2/5/8 context, patterns, plans, validation, and verification.

**Strong analogs stopped at:** core Bridge/contract/snapshot seams, core package/type/artifact tests, the foreign tarball harness, fixture peer graph, and the Phase 8 immutable mutation battery.

**Not modified by this mapping:** source, tests, configs, lockfile, workflows, or prior planning artifacts.

**Planner handoff:** use this file for repository conventions and integration seams, and 09-RESEARCH.md for framework/API syntax. Where they differ, locked D-09 decisions and current live code win.
