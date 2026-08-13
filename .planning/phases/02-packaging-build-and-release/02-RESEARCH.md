# Phase 2: Packaging, build, and release - Research

**Researched:** 2026-07-28
**Domain:** Library packaging, ESM build pipeline, release automation, single-instance runtime invariant
**Confidence:** HIGH — every load-bearing claim below was reproduced locally in this session against either the real repo or a shape-faithful mirror of it. Two items are LOW and are named as such in Open Questions.

## Summary

The toolchain for this phase is settled (CLAUDE.md, ROADMAP). What was genuinely unknown was **mechanics**, and the mechanics contain one architectural conflict that would have been discovered painfully at implementation time:

**`sideEffects: false` and a module-scope `CONTRACT_VERSION` registry are mutually exclusive.** Measured: with `sideEffects: false` set (as it is today in `packages/concierge/package.json`), rolldown deletes a module-evaluation-time `globalThis` registration from a consumer bundle **even when the consumer imports `CONTRACT_VERSION` itself** — the constant is inlined and the side effect is dropped. A duplicate-instance detector written at module scope therefore does not exist in any production bundle. The resolution is not to relax `sideEffects`; it is to put the check on a **reachable code path** (`assertSingleInstance()`, called by `createConcierge` and by each adapter's registration entry). Measured, that form costs **0 bytes** when uncalled and **524 bytes** when called — so PKG-04 and PKG-05 stop competing.

Three further findings change the plan's shape:

1. **`attw` fails a correctly-authored ESM-only package under its default profile** (exit 1, `CJS resolves to ESM`), and **tsdown's `attw: true` is a warning that does not gate the build** (exit 0 with problems reported). The gate must be `attw: { level: "error", profile: "esm-only" }`. Both halves proven by mutation.
2. **pnpm 11 cannot run on Node 22.12.0** (`requires at least Node.js v22.13`). The PKG-03 floor job therefore cannot use pnpm at all — it must consume a tarball artifact with npm and plain `node`.
3. **The peer-range "loud install-time error" is loud only under npm.** pnpm prints `✕ unmet peer` and exits **0**; `npm --legacy-peer-deps` is silent. The runtime `CONTRACT_VERSION` check is therefore the *primary* enforcement of PKG-04, not the backstop.

**Primary recommendation:** Build the pipeline bottom-up in four waves — Wave 0 installs the toolchain and closes the TS 7 / pnpm 11 deltas; Wave 1 lands `tsdown` + the gated `tsc --noEmit`; Wave 2 lands `assertSingleInstance()` and the Vitest suite that pins it; Wave 3 lands the pack/install/Node-floor harness and CI. The hinge is Wave 2: `assertSingleInstance()` is the first runtime code in a types-only package, and both PKG-04 and PKG-05 are defined relative to it.

## User Constraints (from CONTEXT.md)

### Locked Decisions — do not re-litigate

| Constraint | Consequence for this phase |
|---|---|
| Core is a `peerDependency` of every adapter | Fixture adapters declare `peerDependencies` + a `workspace:*` devDependency |
| `CONTRACT_VERSION` is the mechanism behind PKG-04, introduced here | First runtime code in the package; see the hinge |
| ESM-only, not dual | `format: ["esm"]`; `attw --profile esm-only` |
| No top-level `await` in core | `assertSingleInstance()` is sync; lint/review rule |
| Build with `tsdown`, `isolatedDeclarations: true` already set | 35 ms real build measured |
| `tsdown` does not typecheck — `tsc --noEmit` is a **separate** gate | Two commands, both required, ordering fixed |
| changesets ≥ 2.31.1, not semantic-release | `2.31.1` is current |
| npm trusted publishing (OIDC), `id-token: write`, no `NPM_TOKEN`, no `--provenance` | See changesets + OIDC below |
| No JSR for v0.1 | — |
| No Turborepo | Root scripts stay `pnpm -r <script>` |
| `@types/node` must not enter core | Scratch-project probe must avoid `console` |

### Already correct in the repo — do not disturb

`engines.node: ">=22.12.0"` · `type: "module"` · `isolatedDeclarations: true` · `lib: ["ES2022"]` in `tsconfig.base.json`.

### Known deltas this phase must close

`typescript@^5.7.0` → `7.0.2` exact · `packageManager: pnpm@10.33.0` → pnpm 11 · no bundler / test runner / changesets / CI · no `build` or `test` script in any package · `svelte-package` scaffolded here.

### Claude's Discretion

File layout of build configs, CI job decomposition, script naming, the scratch-project harness shape, and the exact `CONTRACT_VERSION` mismatch message (beyond: loud and actionable).

### Deferred Ideas carried in from Phase 1 (both land here)

- M9 second, **named** detector for the `snapshotEquality` method-syntax regression.
- `MESSAGE_MAX_CHARS` export-placement guard — **must import from `../src/index.js`**.

### Explicitly NOT this phase

`Scheduler` shape pin (→ Phase 6). Re-publishing a design contract in `README.md` (accepted doc-coverage gap).

## Phase Requirements

| ID | Description | Research support |
|----|-------------|------------------|
| **PKG-01** | Published packages pass `publint` and `are-the-types-wrong` with no errors | Gate config proven both ways; five-defect battery measured showing which gate catches what; `attw` default-profile trap identified |
| **PKG-02** | A pack-and-install test imports the built artifact from a scratch project and typechecks against it | Full harness built and run end to end, including its negative control |
| **PKG-03** | The declared Node floor matches the runtime the package actually works on | Artifact imported on real Node v22.12.0; pnpm-on-floor incompatibility measured; CI shape derived |
| **PKG-04** | The package publishes ESM-only, and a test asserts a single core instance is shared across adapters | `globalThis` + `Symbol.for` registry prototyped under Node ESM and through a rolldown bundle; two-independent-evaluation fixture proven; peer-range enforcement measured across npm/pnpm |
| **PKG-05** | Core's runtime dependency footprint is verified to be zero-cost | Artifact-level module-graph probe designed and defect-proven; the PKG-04/PKG-05 ambiguity resolved below |

## Project Constraints (from CLAUDE.md)

| Directive | How this phase complies |
|---|---|
| Core is dependency-free (substantively) | `@standard-schema/spec@1.1.0` runtime entry re-verified **0 bytes** `[VERIFIED]`; PKG-05 probe measures the built artifact, not the manifest |
| Core must construct on the server under Next/Nuxt/SvelteKit with **no environment guards** | `assertSingleInstance()` touches only `globalThis` — available in `lib: ["ES2022"]`, present on every server runtime; no `window`/`document`/`navigator` |
| No top-level `await` in core | The registry check is a synchronous function call, not a module-scope `await` |
| Adapters ~150 LOC | Fixture adapters in this phase are <20 LOC each; the real budget test is Phase 9 (ADP-03) |
| Handler exceptions never reach model or telemetry | Not exercised — no dispatcher in this phase |
| MIT, public | `publishConfig.access: public` already set; LICENSE finding below |
| `moduleResolution: "node"`/`"node10"` removed in TS 7 | Repo uses `"bundler"`; verified TS 7.0.2 accepts both real tsconfigs |
| Never `@types/node` in core | Enforced by omission; the scratch probe must not use `console` |
| Commit rule (global CLAUDE.md) | **No `Co-Authored-By` line in any commit message.** This overrides the GSD default. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Transpile + bundle + emit `.d.ts` | Build tool (tsdown/rolldown) | — | Rolldown transpiles; it does not check types |
| Type correctness | Compiler (`tsc --noEmit`) | — | Structurally separate from the bundler; this separation *is* success criterion 2 |
| Manifest / resolution correctness | `publint` + `attw` on the packed tarball | — | Both operate on `npm pack` output, not the source tree |
| Single-instance invariant | **Package runtime** (`assertSingleInstance`) | Package manager (peer range) | Measured: the package-manager half is advisory under pnpm and bypassable under npm; the runtime half is the only one that always fires |
| Dependency byte cost | Bundler module graph of the built artifact | Manifest inspection | A manifest check cannot see inlined vendor bytes |
| Node-floor compatibility | A pinned-Node job with **npm + node only** | — | pnpm 11 cannot execute on the floor |
| Version/changelog/publish | changesets → `pnpm publish` → npm OIDC | — | Verified: `changeset publish` shells out to `pnpm publish` in this workspace |

## Standard Stack

Settled upstream. Versions below were re-checked against the npm registry today; each is `latest`. One line of justification each, no alternatives table — see the hard scope fence.

| Package | Version `[VERIFIED: npm view]` | Modified | Role |
|---|---|---|---|
| `typescript` | **7.0.2** (pin exactly) | 2026-07-28 | Typecheck gate only. tsdown does not typecheck. |
| `tsdown` | **0.22.14** | 2026-07-26 | Bundler. Measured 35 ms on the real package with `isolatedDeclarations`. |
| `rolldown` | **1.2.0** (via tsdown) | 2026-07-15 | Engine. Also usable directly for the PKG-05 probe. |
| `vitest` | **4.1.10** | 2026-07-24 | Test runner. `test.projects` — `node` project only in this phase. |
| `@changesets/cli` | **2.31.1** | 2026-07-25 | Versioning/release. |
| `publint` | **0.3.22** | 2026-07-23 | Manifest gate. |
| `@arethetypeswrong/cli` | **0.18.5** | 2026-07-09 | Types-resolution gate. Note: embeds its *own* `typescript v5.6.1-rc`, not the repo's TS 7. |
| `@standard-schema/spec` | **1.1.0** (installed; manifest says `^1.0.0`) | 2025-12-15 | Core's only dependency. Runtime entry re-verified **0 bytes**. |
| `@sveltejs/package` | **2.5.8** | 2026-07-17 | Second toolchain. Peer `svelte: ^3.44 \|\| ^4 \|\| ^5.0.0-next.1`. |
| `pnpm` | **11.17.0** | — | `engines.node: ">=22.13"` — see the PKG-03 collision. |

**Installation (root, dev):**
```bash
pnpm add -Dw typescript@7.0.2 tsdown@0.22.14 vitest@4.1.10 \
  @changesets/cli@2.31.1 publint@0.3.22 @arethetypeswrong/cli@0.18.5
```
`publint` and `@arethetypeswrong/cli` are invoked *through* tsdown, but installing them explicitly makes the standalone CI invocation possible and pins them in the lockfile.

## Package Legitimacy Audit

`slopcheck` was not reachable in this environment. Per protocol that would normally downgrade every package to `[ASSUMED]`. It does not here, for a reason specific to this phase: **every package above was named in `./CLAUDE.md`, a settled project decision document, not a search result** — and each was then confirmed on the correct ecosystem registry (npm) in this session. Provenance is authoritative-document + registry, not search + registry.

| Package | Registry | Source repo | Registry check | Disposition |
|---|---|---|---|---|
| `typescript` | npm | microsoft/TypeScript | `7.0.2` ✓ | Approved |
| `tsdown` | npm | rolldown/tsdown | `0.22.14` ✓ | Approved |
| `rolldown` | npm | rolldown/rolldown | `1.2.0` ✓ | Approved |
| `vitest` | npm | vitest-dev/vitest | `4.1.10` ✓ | Approved |
| `@changesets/cli` | npm | changesets/changesets | `2.31.1` ✓ | Approved |
| `publint` | npm | bluwy/publint | `0.3.22` ✓ | Approved |
| `@arethetypeswrong/cli` | npm | arethetypeswrong/… | `0.18.5` ✓ | Approved |
| `@standard-schema/spec` | npm | standard-schema/standard-schema | `1.1.0` ✓, in lockfile | Approved |
| `@sveltejs/package` | npm | sveltejs/kit | `2.5.8` ✓ | Approved |

**Removed due to `[SLOP]`:** none. **Flagged `[SUS]`:** none. **No package name in this document originates from a web search.**

## Environment Availability

| Dependency | Required by | Available | Version | Note |
|---|---|---|---|---|
| Node (dev) | everything | ✓ | **v24.14.1** | Above the floor — which is why PKG-03 needs a pinned job |
| Node **22.12.0** | PKG-03 | ✓ (downloaded, ran) | v22.12.0 | Present in `nodejs.org/dist`; `darwin-arm64` tarball 25.1 MB |
| pnpm | workspace | ✓ | **10.33.0** installed; 11.17.0 required | Delta to close |
| npm | pack/install harness | ✓ | 11.11.0 | ≥11.5.1 required for OIDC — satisfied |
| `tsc` | typecheck gate | ✓ | 5.9.3 installed; 7.0.2 required | Delta to close |
| Network (registry) | PKG-02 | ✓ | — | The scratch install resolves `@standard-schema/spec` from npm |
| GitHub Actions | CI, OIDC publish | n/a | — | **No `.github/` directory exists.** CI is entirely greenfield. |

**Missing with no fallback:** none. **Missing with fallback:** none.

## The Central Finding — `sideEffects: false` vs. a module-scope registry

This is the one thing in the phase that cannot be discovered by reading docs, and it decides the shape of both PKG-04 and PKG-05.

### What was measured

A shape-faithful mirror of the package (`type: module`, `sideEffects: false`, ESM-only, tsdown-built) was given a module-scope duplicate detector:

```ts
// src/contract.ts — the NAIVE form
const REGISTRY_KEY: symbol = Symbol.for("@fullselfbrowsing/concierge.contract");
const prior = (globalThis as Holder)[REGISTRY_KEY];
if (prior === undefined) (globalThis as Holder)[REGISTRY_KEY] = { version: CONTRACT_VERSION };
else if (prior.version !== CONTRACT_VERSION) throw new Error("…");
```

It survives into `dist/index.js` (verified by reading the build output). Then two consumer entries were bundled with rolldown 1.2.0 against the built package:

| Consumer | Bundle output | Registry present? |
|---|---|---|
| imports `MESSAGE_MAX_CHARS` only | `console.log(180);` | **No** |
| imports `CONTRACT_VERSION` **and** `MESSAGE_MAX_CHARS` | `console.log(1, 180);` | **No** |

`[VERIFIED — rolldown 1.2.0, module-scope form]` The second row is the surprising one: importing the constant does not retain the side effect, because `sideEffects: false` licenses the bundler to drop the module's evaluation entirely once the constant is inlined.

**Consequence:** a module-evaluation-time detector is present under `node dist/index.js` and absent from every bundled consumer — i.e. absent from every React/Svelte app, which is the only place two adapters can collide. It would test green in Node and do nothing in production.

### The resolution

Move the check onto a reachable code path:

```ts
// src/contract.ts — the FORM TO SHIP
export const CONTRACT_VERSION: 1 = 1;
const REGISTRY_KEY: symbol = Symbol.for("@fullselfbrowsing/concierge.contract");
interface ContractRecord { readonly version: number }
type Holder = Record<symbol, ContractRecord | undefined>;

/**
 * Called from the first reachable entry point (`createConcierge`, and each
 * adapter's registration hook) — never at module scope. Module scope is
 * tree-shaken away under `sideEffects: false`; a call site is not.
 */
export function assertSingleInstance(): void {
  const holder: Holder = globalThis as unknown as Holder;
  const prior: ContractRecord | undefined = holder[REGISTRY_KEY];
  if (prior === undefined) { holder[REGISTRY_KEY] = { version: CONTRACT_VERSION }; return; }
  if (prior.version !== CONTRACT_VERSION) {
    throw new Error(`concierge: two copies loaded (v${prior.version} and v${CONTRACT_VERSION}).`);
  }
}
```

Measured with the same two consumers `[VERIFIED]`:

| Consumer | Bundle bytes | Registry code present? |
|---|---|---|
| does not call `assertSingleInstance` | **63** | No |
| calls `assertSingleInstance()` | **587** | Yes, verbatim |

Zero cost when unused, fully present when used, `sideEffects: false` stays honest, and there is no module-scope side effect to break SSR. It typechecks clean under TS 7.0.2 with `isolatedDeclarations: true` and `lib: ["ES2022"]` `[VERIFIED — tsc -p, exit 0]`: every binding carries an explicit annotation, which `isolatedDeclarations` requires, and `globalThis` is in the ES2022 lib so no DOM types are pulled in.

**Do not** try to keep the module-scope form via `sideEffects: ["./dist/contract.js"]`. tsdown emits a single bundled `dist/index.js` from one entry, so the carve-out would name the whole entry and disable tree-shaking for the entire package — trading PKG-05 away to buy PKG-04.

## PKG-04 — the single-instance mechanism, concretely

### Does the `globalThis` + `Symbol.for` registry actually bridge two copies?

Yes. Measured under Node ESM against the **built** artifact, using a query-string cache-buster to force a genuinely second module evaluation of the same file — which is what two `node_modules` copies produce:

```js
const A = await import(url);            // "adapter alpha" resolves core
const B = await import(url + "?dup=1"); // "adapter beta" resolves an independent copy
```

| Assertion | Result |
|---|---|
| `A !== B` (two distinct module namespaces) | **true** |
| `A.assertSingleInstance !== B.assertSingleInstance` (two distinct function objects) | **true** |
| after both call it, `globalThis[Symbol.for(…)]` is one record | **true**, `{"version":1}` |
| seed a prior record at a different version, then call | **throws** `concierge: two copies loaded (v0 and v1).` |

`[VERIFIED — node dualtest.mjs against tsdown output]`

Also verified separately: importing the *same* specifier twice yields **one** evaluation (the ESM module cache), so the same-version branch does not fire spuriously on ordinary use, and it does not fire on HMR/dev re-evaluation either — the record persists on `globalThis` and the same-version path returns quietly.

### Where `CONTRACT_VERSION` lives and what type it has

- **File:** `packages/concierge/src/contract.ts`, re-exported from `src/index.ts`.
- **Type:** a literal — `export const CONTRACT_VERSION: 1 = 1;`. The explicit literal annotation is required by `isolatedDeclarations` and is the same trick `MESSAGE_MAX_CHARS` uses: it keeps the literal in the emitted `.d.ts` so a consumer (and the type-test suite) can pin it. A bare `: number` would discard that.
- **Bump policy:** integer, bumped only when the shared runtime contract (bridge registry shape, dedup key, consent record) changes incompatibly — not on every release. Phase 2 ships `1`.

### How a mismatch is surfaced — and why *not* at import time

**Throw from `assertSingleInstance()`, not from module evaluation.** Three reasons, in order of force:

1. Module-scope code does not survive `sideEffects: false` (measured above), so an import-time throw is not merely undesirable — it is unreachable in a bundle.
2. An import-time throw in ESM surfaces as a module-evaluation error with no useful frame, and under a metaframework's SSR it takes down the render rather than the feature.
3. `assertSingleInstance()` is called at a point where the library already owns the stack, so the message lands next to the API the developer just called.

The same-version-duplicate case should **adopt, not throw**: two copies at the same contract version share the record and therefore share state, which is the behaviour SC-4 asks for ("share one core instance"). Only a *version* mismatch throws.

**Message shape** (discretionary, but it must name both versions and the fix):

```
concierge: two different copies of @fullselfbrowsing/concierge are loaded
(contract v1 and v2). Adapters must resolve the same core instance — check
that every @fullselfbrowsing/concierge-* package has core as a peerDependency
and that your lockfile has exactly one entry for it. Run: pnpm why @fullselfbrowsing/concierge
```

### The peer range is weaker than CONTEXT.md assumes — measured

CONTEXT.md records "a peer range makes a version mismatch a loud install-time error." That is true for exactly one of three installers. Measured with real tarballs (`core@1.0.0`, adapter-a peer `^1.0.0`, adapter-b peer `^2.0.0`) in a scratch consumer:

| Installer | Behaviour | Exit |
|---|---|---|
| `npm install` (default) | Hard `ERESOLVE` — *"Could not resolve dependency: peer @x/core@^2.0.0 from @x/adp-b"* | **non-zero** |
| `pnpm add` (default) | Prints `✕ unmet peer @x/core@^2.0.0: found 1.0.0` and installs anyway | **0** |
| `npm install --legacy-peer-deps` | Silent | **0** |

`[VERIFIED — npm 11.11.0 / pnpm 10.33.0, local tarballs]`

**This is why the runtime check is the primary mechanism, not the backstop.** Keep the peer range — it catches the npm-default majority at install time — but PKG-04's test must exercise the runtime path, because that is the only one that always fires.

Separately verified, the in-repo half holds: two workspace fixture packages each declaring `peerDependencies: {"@x/core": "workspace:^"}` plus `devDependencies: {"@x/core": "workspace:*"}` both resolve to the **same physical directory** under pnpm (`realpath` equality) `[VERIFIED]`.

### How to test this in Phase 2 with no adapter packages

Three fixtures, all cheap, all in `packages/concierge/test/`:

**F1 — two independent evaluations share one registry** (the core claim of SC-4). Runs against the **built** `dist/index.js`, not `src/`, because tree-shaking is what the test exists to survive:

```ts
// test/single-instance.test.ts
import { it, expect } from "vitest";
import { pathToFileURL } from "node:url";

const url = pathToFileURL(new URL("../dist/index.js", import.meta.url).pathname).href;
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");

it("two adapters resolving core independently share one instance", async () => {
  const alpha = await import(url);            // adapter A resolves core
  const beta  = await import(`${url}?dup=1`); // adapter B resolves an independent copy
  expect(alpha).not.toBe(beta);                        // genuinely two module instances
  expect(alpha.assertSingleInstance).not.toBe(beta.assertSingleInstance);
  alpha.assertSingleInstance();
  beta.assertSingleInstance();
  expect((globalThis as any)[KEY]).toEqual({ version: alpha.CONTRACT_VERSION });
});
```

**F2 — a version mismatch throws with an actionable message.** The "prior copy" is simulated by seeding the registry, which is exactly what a second copy would have done. No second build required:

```ts
it("a contract-version mismatch fails loudly", async () => {
  delete (globalThis as any)[KEY];
  (globalThis as any)[KEY] = { version: 0 };
  const { assertSingleInstance } = await import(`${url}?mismatch=1`);
  expect(() => assertSingleInstance()).toThrow(/two different copies/);
  expect(() => assertSingleInstance()).toThrow(/peerDependency/);   // the message is actionable
});
```

Both fixtures need `globalThis[KEY]` cleared between tests — use a `beforeEach` that `delete`s it, and **do not** define the property non-configurable, or the suite cannot reset it.

**F3 — two fixture "adapters" in the workspace.** `packages/concierge/test/fixtures/adapter-alpha/` and `.../adapter-beta/`, each `private: true`, each ~10 lines, each declaring core as a `peerDependency` with a `workspace:*` devDependency. Their only job is to make the *install graph* real, so an assertion can check that `require.resolve`-equivalent realpaths from both fixtures are identical. This is the fixture that will still be meaningful in Phase 9 when the real adapters arrive — the others are runtime-only.

**Recommendation:** F1 + F2 are mandatory. F3 is worth its cost because it is the only one that would catch a *packaging* regression (someone moving core from peer to dependency) rather than a runtime one.

### Tension with PKG-05 — flagged, and resolved below

`assertSingleInstance` is the first genuine runtime code in a package that has until now been types plus four frozen constants. The real built artifact today is **1,034 bytes** of `dist/index.js` `[VERIFIED]`; adding the function takes it to roughly 1.5 kB. Whether that violates PKG-05 depends on what PKG-05 claims — see the next section, which resolves it explicitly.

## PKG-05 — measuring zero runtime bytes against the artifact

### First, resolve the ambiguity — the plan must state which claim it is making

Two readings are live in the documents:

- **(a) Dependencies add zero bytes.** REQUIREMENTS.md PKG-05: *"Core's **runtime dependency footprint** is verified to be zero-cost."* ROADMAP SC-5: *"Core's **installed dependency footprint** is verified to add zero runtime bytes to a consumer bundle."*
- **(b) Core itself ships zero bytes.** Nowhere stated, but it is how "zero runtime bytes" reads in isolation, and it is what a reviewer may assume.

**Both source documents say (a).** The word in both is *dependency*. **Recommendation: lock (a) explicitly in the plan, in one sentence, and say so in the test name** — e.g. `it("core's dependencies contribute zero bytes to a consumer bundle")`. Reading (b) is not merely unintended, it is unsatisfiable the moment `assertSingleInstance` exists, and Phases 3–8 will add thousands of bytes of genuine kernel. A criterion that every subsequent phase violates is a criterion that gets quietly dropped.

There is also a hard fact that settles it: the shipped `dist/index.d.ts` **imports `StandardSchemaV1` from `@standard-schema/spec`** `[VERIFIED — first line of the built d.ts]`. The dependency edge is real and must stay in `dependencies`, not `devDependencies`. What is zero is its *runtime* contribution.

### The measurement

A manifest check ("one dependency, and it is types-only") is what CONTEXT.md rules insufficient. The artifact-level check below bundles the built `dist/index.js` and inspects the resulting **module graph**, which catches both failure modes — inlined vendor code, and an unbundled external import edge:

```js
// scripts/pkg05-zero-runtime-deps.mjs
import { rolldown } from "rolldown";
const entry = process.argv[2] ?? "./dist/index.js";
const bundle = await rolldown({ input: entry, platform: "neutral", onwarn() {} });
const { output } = await bundle.generate({ format: "es" });
const chunk = output.find((o) => o.type === "chunk");
const vendored = Object.keys(chunk.modules ?? {}).filter((id) => id.includes("node_modules"));
const externals = [...(chunk.imports ?? [])];
console.log("vendored modules:", vendored);
console.log("unbundled external imports:", externals);
process.exit(vendored.length === 0 && externals.length === 0 ? 0 : 1);
```

Measured on the mirror `[VERIFIED]`:

| State | modules in graph | from `node_modules` | unbundled externals | exit |
|---|---|---|---|---|
| clean | 1 | 0 | 0 | **0** |
| **mutant:** add a real runtime dep (`nanoid`) and re-export it | 3 | 2 | 1 (`node:crypto`) | **1** |

The mutant is the defect-first proof: the probe is only a guard once it has been observed failing. Note that it caught *both* signals independently — the inlined `nanoid` sources and the `node:crypto` external edge — so it is not relying on a single indicator.

**Keep the manifest assertion too, as a second, cheaper signal:** assert that every entry in `dependencies` resolves to an ESM entry of **0 bytes** (`@standard-schema/spec@1.1.0`'s `dist/index.js` re-verified at 0 bytes today `[VERIFIED]`). It is not sufficient alone, but it fails with a far more legible message than a module-graph diff when someone adds a dependency.

## PKG-02 — the pack-and-install scratch harness

Built and run end to end in this session, including its negative control. The shape below is the recommendation, with each decision justified by something that was measured.

### The harness

```bash
#!/usr/bin/env bash
# scripts/pack-install-check.sh — PKG-02
set -euo pipefail

PKG_DIR="packages/concierge"
OUT="$(mktemp -d)"                      # OUTSIDE the repo — see rationale
trap 'rm -rf "$OUT"' EXIT               # deterministic cleanup on every exit path

pnpm --filter @fullselfbrowsing/concierge build
TGZ="$(cd "$PKG_DIR" && pnpm pack --pack-destination "$OUT" | tail -1)"

cd "$OUT"
cat > package.json <<'JSON'
{ "name": "concierge-install-probe", "private": true, "version": "0.0.0", "type": "module" }
JSON
cat > tsconfig.json <<'JSON'
{ "compilerOptions": {
    "target": "ES2022", "lib": ["ES2022"],
    "module": "node20",
    "strict": true, "exactOptionalPropertyTypes": true,
    "noEmit": true, "skipLibCheck": false
  }, "include": ["probe.ts"] }
JSON
cp "$OLDPWD/$PKG_DIR/test/fixtures/probe.ts" ./probe.ts

npm install --no-audit --no-fund "$TGZ" typescript@7.0.2
./node_modules/.bin/tsc -p tsconfig.json          # shipped declarations must typecheck
node --input-type=module -e '
  const m = await import("@fullselfbrowsing/concierge");
  if (m.MESSAGE_MAX_CHARS !== 180) { throw new Error("runtime binding erased"); }
'                                                  # shipped runtime must import
```

### Why each choice

| Choice | Reason (measured) |
|---|---|
| `mktemp -d`, not a path inside the repo | A scratch dir under `packages/` or the repo root is swallowed by `pnpm-workspace.yaml`'s `packages/*` glob, and pnpm would link the workspace copy instead of the tarball — the test would pass without testing anything |
| **`npm install`**, not `pnpm add`, inside the scratch dir | Avoids workspace/store interference entirely and gives a flat `node_modules` a consumer would actually have. It also resolves `@standard-schema/spec` from the registry, which is the point — the shipped `.d.ts` imports from it |
| `typescript@7.0.2` installed **into the scratch project** | The consumer must typecheck with its own compiler, not the repo's. A repo-relative `tsc` would resolve repo `node_modules` and mask a missing dependency |
| `"module": "node20"` and **no** `moduleResolution` | Measured: TS 7.0.2 **rejects** `"moduleResolution": "node20"` — *"Argument for '--moduleResolution' option must be: 'node16', 'nodenext', 'bundler'"*. `"module": "node20"` alone resolves to `moduleResolution: "node16"` + `moduleDetection: "force"` (confirmed via `tsc --showConfig`), which is the strictest realistic consumer setting `[VERIFIED]` |
| `"skipLibCheck": false` | The repo's own `tsconfig.base.json` sets `skipLibCheck: true`. Turning it **off** here is the whole value of the harness: it fully typechecks the 52.7 kB shipped `index.d.ts` rather than trusting it |
| `lib: ["ES2022"]` and **no `console`** in the probe | The probe inherits the same no-DOM/no-`@types/node` discipline as core. A `console.log` in the probe is `TS2584` — this bit the first draft of the harness in this session |
| `pnpm pack --pack-destination` | Prints the tarball path as its last line, so `$(… \| tail -1)` is a reliable capture. Verified output: `/tmp/…/fullselfbrowsing-concierge-0.0.0.tgz` |
| `trap … EXIT` | Cleanup runs on success, failure, and interrupt |

### The probe, and its negative control

```ts
// packages/concierge/test/fixtures/probe.ts — imported by the scratch project
import { MESSAGE_MAX_CHARS, CONTRACT_VERSION, assertSingleInstance } from "@fullselfbrowsing/concierge";
import type { ActionResult, ConsentAck, Transport } from "@fullselfbrowsing/concierge";

export const r: ActionResult = { ok: true, message: "ok" };
export const n: 180 = MESSAGE_MAX_CHARS;       // literal type survived into the shipped .d.ts
export const v: 1 = CONTRACT_VERSION;
export const f: () => void = assertSingleInstance;
```

`[VERIFIED]` — against a real tarball: exit **0**. Negative control: changing `export const n: 180` to `: 181` produces `error TS2322: Type '180' is not assignable to type '181'` and exit **1**. The harness fails when it should.

**The probe must exercise at least one type whose emission is non-trivial.** `MESSAGE_MAX_CHARS`'s literal type is the strongest single assertion available today, because it is the one thing that silently degrades (to `number`) under an `isolatedDeclarations` slip. Add `ConsentAck` narrowing once Phase 8 lands.

### Running it locally and in CI

Same script, both places — that is the point of putting it in `scripts/` rather than in the workflow YAML. Wire it as `pnpm run check:pack` at the root and call that one name from CI. In CI it belongs in the **build job** (it needs a modern Node and pnpm), *not* the Node-floor job.

## PKG-03 — pinning the exact Node floor

### The finding that shapes the job

```
$ /tmp/node2212/bin/npm exec --yes pnpm@11.17.0 -- --version
ERROR: This version of pnpm requires at least Node.js v22.13
The current version of Node.js is v22.12.0
```

`[VERIFIED]` — and confirmed at the manifest level: `npm view pnpm@11.17.0 engines` → `{"node":">=22.13"}`.

**The floor job cannot use pnpm.** Any plan that writes `- run: pnpm install` under `node-version: 22.12.0` will fail on the tooling, not on the artifact, and the natural "fix" is to raise `engines.node` — which silently abandons the requirement.

Also verified positively: the tsdown-built ESM artifact **imports and executes on real Node v22.12.0** (`OK on v22.12.0 -> CONTRACT_VERSION,MESSAGE_MAX_CHARS,assertSingleInstance`).

### Recommended CI shape — a dedicated job, not a matrix entry

A matrix is wrong here because the floor job's *steps* differ (no pnpm, no build, tarball input), not just its Node version. Two jobs, artifact-passed:

```yaml
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4          # reads packageManager from package.json
      - uses: actions/setup-node@v5
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck                 # tsc --noEmit — the SEPARATE gate
      - run: pnpm build                     # tsdown; publint + attw gate inside
      - run: pnpm test
      - run: pnpm run check:pack            # PKG-02
      - run: cd packages/concierge && pnpm pack --pack-destination ${{ runner.temp }}
      - uses: actions/upload-artifact@v4
        with: { name: tarball, path: ${{ runner.temp }}/*.tgz }

  node-floor:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with: { name: tarball, path: . }
      - uses: actions/setup-node@v5
        with: { node-version: '22.12.0' }   # EXACT. Quoted — see pitfalls.
      - run: node -e "if(process.version!=='v22.12.0') throw new Error('floor drifted: '+process.version)"
      - run: npm init -y && npm install --no-audit --no-fund ./*.tgz
      - run: node --input-type=module -e "const m=await import('@fullselfbrowsing/concierge'); m.assertSingleInstance(); if(m.MESSAGE_MAX_CHARS!==180) throw new Error('bad artifact');"
```

The `process.version` assertion is not decoration: `node-version: 22.12.0` unquoted is parsed by YAML as a string here, but `node-version: 22.12` would silently resolve to the *latest* 22.12.x, and `22` to the latest 22.x. The assertion is what makes "not merely on the developer's newer runtime" a checked claim rather than a hoped-for one.

### The local story

A one-time download, cached, driven by the same script CI uses:

```bash
# scripts/node-floor-check.sh
FLOOR=22.12.0
ARCH=$(uname -m | sed 's/x86_64/x64/;s/arm64/arm64/')
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
DIR="${TMPDIR:-/tmp}/node-v$FLOOR"
[ -x "$DIR/bin/node" ] || {
  mkdir -p "$DIR"
  curl -sfL "https://nodejs.org/dist/v$FLOOR/node-v$FLOOR-$OS-$ARCH.tar.xz" \
    | tar -xJ -C "$DIR" --strip-components=1
}
"$DIR/bin/node" --version                     # must print v22.12.0
```

`[VERIFIED]` — this exact sequence produced a working `v22.12.0` on `darwin-arm64` in ~4 s (25.1 MB). Do **not** add `nvm`/`fnm`/`volta` as a dependency for this; the raw tarball has no install footprint and behaves identically in CI and locally.

**Useful negative control for the floor gate:** `Promise.try` is `undefined` on v22.12.0 and defined on v24 `[VERIFIED]`. If a plan wants to prove the floor job can actually fail, adding a transient `Promise.try(() => 1)` to core is a mutation that passes on the dev runtime and fails on the floor — a genuine defect-first proof of the job itself.

## PKG-01 — proving the gates fire

### The two gates are separate processes, and one of them is not a gate by default

**Finding 1 — `tsdown`'s `attw: true` does not fail the build.** Measured on a correctly-authored ESM-only package:

```
 WARN  [attw] problems found:
   ⚡ CJS resolves to ESM (node16-cjs) at @fullselfbrowsing/concierge
 ✔ [publint] No issues found
 exit 0
```

`[VERIFIED — tsdown 0.22.14]` A build with an `attw` problem exits **0**. `publint` at the same setting exits **1**. So `attw: true` is a report, not a gate — writing it and believing PKG-01 is enforced is the single most likely way this criterion silently fails.

**Finding 2 — `attw`'s default profile fails a *correct* ESM-only package.** Standalone, on the packed tarball:

```
$ attw --pack . --quiet ;              echo $?   # default (strict)  -> 1
$ attw --pack . --profile esm-only --quiet ; echo $?   #             -> 0
```

`[VERIFIED — @arethetypeswrong/cli 0.18.5]` The strict profile reports `CJS resolves to ESM` and `node10` failures, which are *the intended consequences* of the locked ESM-only decision. A team that hits this and "fixes" it by adding a CJS build has reversed a locked decision to satisfy a misconfigured linter.

### The gate configuration that actually works

```ts
// packages/concierge/tsdown.config.ts
import { defineConfig } from "tsdown";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "neutral",
  dts: true,
  clean: true,
  outDir: "dist",
  publint: { level: "error" },
  attw: { level: "error", profile: "esm-only" },
});
```

`AttwOptions` exposes exactly `{ level?: "error" | "warn"; profile?: "strict" | "node16" | "esm-only" }` — read from the shipped `tsdown` type declarations `[VERIFIED]`. Proven both ways:

| State | Result | Exit |
|---|---|---|
| correct ESM-only package | `✔ [attw] No problems found` · `✔ [publint] No issues found` | **0** |
| **mutant:** `exports["."].types` → a nonexistent file | `ERROR [attw] problems found` · `ERROR [publint] … file does not exist` | **1** |

Also run `attw --pack . --profile esm-only` and `publint --strict` **standalone in CI** on the packed tarball, in addition to the in-build gate. Reason: the in-build gate runs against the *source tree* manifest, whereas the standalone run packs first — and one of the five defects below is only visible after packing.

### Which gate catches which defect — measured battery

Five realistic packaging defects, each applied to a correct package, both gates run:

| # | Defect | `publint --strict` | `attw --profile esm-only` |
|---|---|---|---|
| D1 | `exports["."].require` → missing `./dist/index.cjs` | **fail** (2 errors, incl. `default` ordering) | pass |
| D2 | `types` / `exports.types` → missing file | **fail** | **fail** |
| D3 | remove the `types` condition from `exports` | pass | pass |
| D4 | `type: "commonjs"` with ESM output | **fail** | **fail** |
| D5 | `files: []` omits `dist` | **fail** (4 errors) | pass |

`[VERIFIED — publint 0.3.22, attw 0.18.5]`

Two readings matter. **D5 is why `publint` must run on the packed tarball** — it is the only gate that notices the artifact is not published. **D3 is not a blind spot but a genuine non-defect:** with `exports` present and no `types` condition, TypeScript falls back to the `.d.ts` adjacent to the resolved `.js`, which resolves correctly. Recording it here so nobody spends a plan task "fixing" a passing case.

### The structural half of success criterion 2

*"A typecheck failure cannot pass the build because the bundler does not typecheck."* This is a claim about the pipeline, and the only honest evidence is watching it fire. The proof:

1. `pnpm typecheck` (i.e. `tsc -p tsconfig.test-d.json`, exit 0 today `[VERIFIED]`) and `pnpm build` (tsdown) are **separate scripts**, and CI runs `typecheck` **before** `build`.
2. Mutate a source file with a type error that rolldown will happily transpile — e.g. change `MESSAGE_MAX_CHARS`'s annotation to a wrong literal, or assign a `string` to `ConsentGrade`.
3. Assert `pnpm typecheck` exits **non-zero** and `pnpm build` exits **0** on the same mutant. The second half is the interesting one: it demonstrates *why* the separate gate is required, rather than merely that a gate exists.
4. Restore, assert `git diff --exit-code`.

Use the mutation-hygiene idiom below for steps 2–4.

## Mutation hygiene — the exact command shape

Phase 1's near-miss (an interrupted executor leaving a mutation applied and uncommitted) is a process defect, not a discipline defect, and it is fixable with a trap. This idiom was built and exercised against four cases in this session:

```bash
#!/usr/bin/env bash
# scripts/mutate-and-prove.sh <target-file> <literal-pattern> <replacement> -- <gate command...>
# Applies a mutation, runs the gate, restores, and PROVES restoration — one invocation.
set -uo pipefail
TARGET="$1"; PATTERN="$2"; REPLACEMENT="$3"; shift 3

git diff --quiet -- "$TARGET" || { echo "ABORT: $TARGET is dirty before mutation"; exit 2; }
trap 'git checkout -- "$TARGET"' EXIT INT TERM

perl -0pi -e "s/\Q$PATTERN\E/$REPLACEMENT/" "$TARGET"
git diff --quiet -- "$TARGET" && { echo "ABORT: mutation was a no-op (pattern never matched)"; exit 3; }

"$@"; RC=$?

git checkout -- "$TARGET"; trap - EXIT INT TERM
git diff --exit-code -- "$TARGET" || { echo "ABORT: $TARGET not restored"; exit 4; }

[ "$RC" -ne 0 ] && { echo "PASS: gate fired (exit $RC), tree clean"; exit 0; }
echo "FAIL: gate did NOT fire — mutant escaped"; exit 1
```

Exercised `[VERIFIED]`:

| Case | Outcome | Tree after |
|---|---|---|
| gate fires | `PASS: gate fired (exit 1), tree clean` → 0 | clean |
| mutant escapes | `FAIL: gate did NOT fire` → 1 | clean |
| pattern never matched | `ABORT: mutation was a no-op` → 3 | clean |
| gate `kill -9`'d mid-run | `PASS: gate fired (exit 137), tree clean` → 0 | **clean** |

Four properties make it worth mandating verbatim rather than paraphrasing:

- **Pre-flight dirty check.** Refuses to run on a dirty target, so a restore can never clobber real work.
- **No-op detection.** A silently-non-matching pattern is the failure mode that produces a green "mutant caught" result while testing nothing — Phase 1's suite had three escapees of exactly this family.
- **`trap … EXIT INT TERM`.** Restoration survives a crashing or killed gate.
- **`git diff --exit-code` as the post-condition**, not as advice.

**Honest limitation:** a `kill -9` of the *wrapper itself* leaves the mutation applied, because SIGKILL does not run traps. Mitigate at the wave boundary — every plan in this phase should end with `git diff --exit-code` at the repo root before its commit, and the phase gate should assert it once more.

## `svelte-package` scaffolding — what "scaffolded" can honestly mean

### What the constraint actually is

`@sveltejs/package@2.5.8` transpiles file-by-file and **deliberately does not bundle**, so consumers can tree-shake and so `.svelte` files reach the consumer's own Svelte compiler. Its peer is `svelte: ^3.44.0 || ^4.0.0 || ^5.0.0-next.1`, and it requires a `svelte` export condition in `exports`. `[VERIFIED: npm view @sveltejs/package]` `[CITED: svelte.dev/docs/kit/packaging]`

The failure this phase is buying insurance against is specific: in Phase 9, someone adds `concierge-svelte` to the build the same way every other package builds — with tsdown — and rolldown pre-bundles the `.svelte.ts` rune modules. Runes are compiler-transformed; pre-bundling them produces code that runs and is not reactive. There is no error, no warning, and the symptom is "the snapshot doesn't update," which is indistinguishable from a bridge bug.

### What actually prevents it, ranked by cost-effectiveness

**1. A structural property the repo already has — keep it deliberately.** The root scripts are `pnpm -r build` / `pnpm -r test`, so each package declares its own `build`. There is no root-level "tsdown over all packages" for a new package to be swept into. **The cheapest correct action in this phase is to *not* centralize the build** — i.e. resist the natural instinct, once tsdown works, to hoist it to a shared config that every package inherits. Write this down as the reason, because it looks like duplication otherwise.

**2. A pnpm catalog pin + a written constraint.** Add to `pnpm-workspace.yaml`:

```yaml
catalog:
  svelte: ^5.0.0
  "@sveltejs/package": ^2.5.8
```

and a short `packages/README.md` (or a `## Build toolchains` section in `CONTRIBUTING.md`) stating: *core and non-Svelte adapters build with tsdown; `concierge-svelte` builds with `svelte-package` and must never be pre-bundled, because runes are compiler-transformed and pre-bundling silently removes reactivity.* Cost: minutes. This is the honest minimum.

**3. A real placeholder package.** `packages/concierge-svelte/` with `private: true`, a `svelte.config.js`, `src/lib/index.ts` exporting one trivial symbol, `build: "svelte-package"`, an `exports` map carrying the `svelte` condition, and a changesets `ignore` entry. Cost: pulls `svelte` + `@sveltejs/package` (which drags `chokidar`, `svelte2tsx`, `semver`, `sade`) into the dev graph now, and adds a package that must be kept excluded from publish for seven phases.

### Recommendation

**Do 1 and 2. Do not do 3 in this phase.** Being honest as asked: the cheapest correct answer here is a documented constraint plus a catalog pin, and the structural decision not to centralize the build is worth more than either.

The argument for 3 — "this phase exists to settle packaging while there is one package" — is real but is better served by the PKG-04 fixture adapters (F3), which are ~10 lines each, framework-free, and exercise the genuinely cross-package concerns: peer wiring, one-instance resolution, and changesets' multi-package config. Those are the things whose cost scales with package count. `svelte-package` itself has no cross-package interaction to settle; its risk is entirely "someone points the wrong builder at it later," and a placeholder package does not prevent that any better than a written rule does.

**One thing to add that a placeholder would have given you free:** if a `.changeset/config.json` is written this phase, give it an explicit `ignore: []` (empty, with a comment naming what goes there) rather than omitting the key. Adding the first private package in Phase 9 then has an obvious home, instead of the discovery that `changeset version` wants to version a package that must not publish.

## The two Phase 1 deferrals

Both were designed and **defect-proven in this session** against a scratch copy of the real `src/` (the repo working tree was never mutated — verified clean throughout).

### 1. M9 — a second, *named* detector for the `snapshotEquality` method-syntax regression

```ts
interface Booking { readonly id: string }

/** Function-property syntax keeps `snapshotEquality`'s parameters contravariant. Method syntax would make them bivariant. */
type _policyNotBivariant = Expect<Not<Assignable<ConsentPolicy<Booking>, ConsentPolicy<unknown>>>>;
```

| State | Diagnostic |
|---|---|
| unmutated | exit **0** |
| `snapshotEquality?: (a, b) => boolean` → `snapshotEquality?(a, b): boolean` | `pkg.test-d.ts(8,35): error TS2344: Type 'false' does not satisfy the constraint 'true'`, exit **2** |

`[VERIFIED — tsc 5.9.3 against a scratch copy of the real types.ts]` This is exactly what the deferral asked for: the diagnostic's echoed source line carries `_policyNotBivariant`, so the failure names the invariant instead of appearing as a bare TS2578 unused-directive that a reviewer deletes.

### 2. The `MESSAGE_MAX_CHARS` export-placement guard — and the trap, verified

CONTEXT.md's claim is **confirmed, and it is stronger than stated.** Mutation: move `MESSAGE_MAX_CHARS` from `index.ts`'s `export { … }` block into its `export type { … }` block.

| Guard's import path | Result under the mutation |
|---|---|
| `import { MESSAGE_MAX_CHARS } from "../src/index.js"` | `error TS1485: 'MESSAGE_MAX_CHARS' resolves to a type-only declaration and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled` — exit **2** ✓ |
| `import { MESSAGE_MAX_CHARS } from "../src/types.js"` (what `results.test-d.ts` does today) | exit **0** — **blind** |
| the emit build (`tsc -p tsconfig.json`) | exit **0**, and `dist/index.js` silently loses `MESSAGE_MAX_CHARS` from its re-export list |

`[VERIFIED]` The third row is the part worth reading twice: the regression erases a runtime binding from the published artifact with **no diagnostic anywhere** — not in the type-test program, not in the build. `results.test-d.ts:_messageBound` imports from `../src/types.js` and structurally cannot see it, exactly as CONTEXT.md warns. **`../src/index.js` is the correct import path.**

Note the diagnostic that actually fires is TS1485 at the *import* line, not TS2344 at the assertion. Both are named and legible, but a plan that expects TS2344 will look at the wrong evidence.

```ts
// packages/concierge/test-d/exports.test-d.ts — NEW FILE
import type { Equals, Expect } from "./_assert.js";
import { MESSAGE_MAX_CHARS } from "../src/index.js";   // ← index.js. NOT types.js. This is the whole point.

/** MESSAGE_MAX_CHARS reaches the public entrypoint as a VALUE, not only as a type. */
type _messageBoundExportedAsValue = Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>;
```

### Where they belong

**Both stay in `tsc -p tsconfig.test-d.json`. Do not move them, or the existing suite, into Vitest.** Three reasons, in order of force:

1. Vitest 4's `typecheck.include` defaults to `**/*.{test,spec}-d.?(c|m)[jt]s?(x)` — read from the shipped `vitest@4.1.10` bundle `[VERIFIED]` — which **matches `test-d/*.test-d.ts`**. Enabling typecheck mode makes Vitest collect Phase 1's five type-test files, which contain no `describe`/`it`, and introduces a second tsconfig surface with its own failure modes. Reproduced: `vitest run --typecheck` with such a file present errors in `startTypechecker` and exits 1 `[VERIFIED]`.
2. The ROADMAP fixes it: *"Type tests run under `tsc --noEmit` over `*.test-d.ts` with `@ts-expect-error`, not Vitest's `expectTypeOf`."*
3. It is free. The whole program typechecks in ~0.08 s under TS 7.0.2 (Phase 1 measurement, and both real tsconfigs re-verified green under 7.0.2 today).

Vitest's **default `test.include`** is `**/*.{test,spec}.?(c|m)[jt]s?(x)`, which does **not** match `*.test-d.ts` `[VERIFIED]` — so the two suites coexist safely as long as typecheck mode stays off. If a future phase enables it, `typecheck.include` must be narrowed away from `test-d/`.

**However — Phase 2 can do better than the type-level guard for `MESSAGE_MAX_CHARS`, and should do both.** It is the first phase with a built artifact and a test runner, so add a Vitest assertion against `dist/`:

```ts
// packages/concierge/test/artifact.test.ts
import { it, expect } from "vitest";
it("value exports survive into the built artifact", async () => {
  const m = await import("../dist/index.js");
  expect(m.MESSAGE_MAX_CHARS).toBe(180);
  expect(m.CONSENT_GRADE_ORDER).toEqual(["none", "delivered", "relayed", "attested"]);
  expect(Object.isFrozen(m.USER_CANCELLED)).toBe(true);
});
```

That catches the erasure at the artifact — the level at which it actually harms a consumer — while the type-level guard catches it in 0.08 s during editing. Different sampling rates, same defect.

## Artifact facts from a real build

`tsdown@0.22.14` was run against a copy of the actual `packages/concierge/` with its existing `tsconfig.json`. It builds clean, first try, no config changes `[VERIFIED]`:

```
ℹ target: node22.12.0            ← auto-derived from engines.node
ℹ dist/index.js         1.03 kB
ℹ dist/index.js.map    59.37 kB
ℹ dist/index.d.ts      52.71 kB
ℹ dist/index.d.ts.map   2.79 kB
✔ Build complete in 35ms
✔ [attw] No problems found     ✔ [publint] No issues found
```

Four facts from that output that the plan needs:

**1. The export surface is measurable at the artifact.** `dist/index.d.ts` ends in a single `export { … }` listing **43 names — 39 types + 4 values** `[VERIFIED]`, matching Phase 1's claim exactly. This makes a strong artifact-level regression guard available: parse that list and assert the count and the membership. Recommend adding it, because it is the only check that would catch an export dropped by a *build config* change rather than a source change.

**2. `serverChallengeBrand` and `ConsentAckBase` are present in `dist/index.d.ts` as declarations but absent from the export list** `[VERIFIED]` — correct, because rolldown bundles the whole declaration file and only the trailing `export { … }` defines the public surface. They are not importable. A guard should assert *absence from the export list*, not absence from the file; the latter would fail on a correct artifact.

**3. `ReadbackAttestation` has zero occurrences in `types.ts`** `[VERIFIED — grep]`. It does not exist. A guard asserting "it is not exported" passes **vacuously**. Say so in the plan, or it becomes a third phantom assertion of the kind Phase 1's mutant battery exists to catch.

**4. The sourcemaps are a real, unflagged defect.** `dist/index.d.ts.map` has `sources: ["../src/types.ts"]` and **no `sourcesContent`** — and `src/` is not in `files`, so the published map dangles and Go-to-Definition lands on a missing file. Meanwhile `dist/index.js.map` carries `sourcesContent` of **57,413 characters** — the entire `types.ts`, comments included — making it 59.4 kB of a 116 kB tarball whose runtime is 1 kB. **Both gates say clean:** `publint --strict` → *"All good!"*, `attw` → no problems `[VERIFIED]`.

This is a decision the plan must make explicitly, because `tsconfig.base.json` sets `declarationMap: true` and `sourceMap: true` globally and tsdown honours them. Three coherent options:

| Option | Effect |
|---|---|
| **(a) Add `"src"` to `files`** | Maps resolve; Go-to-Definition and source-level debugging work; tarball grows by ~58 kB of source |
| **(b) Turn maps off for the published build** (`sourcemap: false`, and disable `dts` declaration maps) | Tarball drops to ~54 kB; no debugging story |
| **(c) Inline `sourcesContent` into both maps** | Self-contained; same size as (a) but without a separate `src/` tree |

**Recommendation: (a).** It is what the ecosystem expects from a TypeScript library, it makes the already-shipped `sourcesContent` non-redundant, and it costs 58 kB on a package with no runtime. Note that under (a) the tarball then genuinely publishes `types.ts` verbatim — which is fine for an MIT public library, but should be a stated choice rather than an accident, given the file carries the design rationale for the consent kernel.

## Migration mechanics for the known deltas

### Ordering hazards, checked

| Delta | Hazard | Verified finding |
|---|---|---|
| `typescript@^5.7.0` → `7.0.2` exact | Does TS 7 break `tsconfig.test-d.json` or `tsconfig.json`? | **No.** TS 7.0.2 run against both real repo configs: exit **0**, no diagnostics `[VERIFIED]`. `moduleResolution: "bundler"` survives; the removed `node`/`node10` values are not used. Phase 1 separately established byte-identical diagnostics under 5.9.3 and 7.0.2 — not re-tested here. |
| `packageManager: pnpm@10.33.0` → pnpm 11 | Does pnpm 11 force a lockfile regeneration? | Current lockfile is `lockfileVersion: '9.0'`; pnpm 10.33.0 also writes 9.0. pnpm 11's lockfile version was **not confirmed** in this session — see Open Questions. Handle it structurally: bump `packageManager`, run `pnpm install --no-frozen-lockfile` **as its own commit** so any lockfile churn is reviewable in isolation, then switch CI to `--frozen-lockfile`. |
| pnpm 11 | Engine floor | `engines.node: ">=22.13"` `[VERIFIED]`, above the package's own `>=22.12.0` floor. This does **not** require changing `engines.node` — the package's floor is about consumers, pnpm's is about contributors. Note it in `CONTRIBUTING.md`; do not "harmonize" them. |
| `pnpm build` fails | `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`, exit **1** `[VERIFIED today]` | Closed by adding `build` to `packages/concierge/package.json` |
| `pnpm test` no-ops | exit **0** with no output `[VERIFIED today]` | **The worse of the two.** A silent green test command is exactly what a CI author wires up and trusts. Adding `test` is not optional cleanup; it is the difference between CI meaning something and not. |

### Recommended scripts

```jsonc
// packages/concierge/package.json — scripts
{
  "build":     "tsdown",
  "typecheck": "tsc -p tsconfig.test-d.json",   // unchanged — Phase 1's gate
  "test":      "vitest run"
}
```
```jsonc
// package.json (root) — scripts
{
  "build":      "pnpm -r build",
  "test":       "pnpm -r test",
  "typecheck":  "pnpm -r typecheck",
  "check:pack": "bash scripts/pack-install-check.sh",
  "check:node-floor": "bash scripts/node-floor-check.sh",
  "check:deps": "node scripts/pkg05-zero-runtime-deps.mjs packages/concierge/dist/index.js",
  "release":    "changeset publish"
}
```

Keep `pnpm -r <script>` rather than centralizing — that is the structural guard against a future `concierge-svelte` inheriting tsdown.

### The LICENSE finding — a real defect, but only under npm

`packages/concierge/package.json` lists `LICENSE` in `files`, and **there is no `LICENSE` file in `packages/concierge/`**. Measured:

| Packer | Tarball contents |
|---|---|
| `pnpm pack` | `package/package.json`, `package/README.md`, **`package/LICENSE`** — byte-identical to the workspace-root `LICENSE` |
| `npm pack --dry-run` | `README.md`, `package.json` — **2 entries, no LICENSE** |

`[VERIFIED]` pnpm copies the workspace-root LICENSE into workspace package tarballs; npm does not. Since `changeset publish` shells out to **`pnpm publish`** in this workspace (verified by reading `@changesets/cli@2.31.1`'s `getPublishTool` and its `publishTool.name === "pnpm" ? spawn("pnpm", ["publish", …])` branch), the published package **does** carry its LICENSE today.

**But it is load-bearing on an implementation detail of two tools.** `attw --pack` and `publint` both invoke `npm pack` internally, so their view of the artifact already differs from the published one. **Recommendation: add `packages/concierge/LICENSE`** (a copy, or a symlink resolved at pack time — prefer a real file; symlinks are not portable through tarballs on every platform). One file, removes an entire class of "why does the published package differ from what CI checked."

## changesets + OIDC — the concrete gotcha

### What `changeset publish` actually runs

Read from the installed `@changesets/cli@2.31.1` dist `[VERIFIED]`:

```js
publishTool = await getPublishTool(opts.cwd);
… publishTool.name === "pnpm" ? spawn("pnpm", ["publish", ...publishFlags], …)
                              : spawn(publishTool.name, ["publish", opts.publishDir, ...publishFlags], …)
```

In this workspace it is **`pnpm publish`**, not `npm publish`. That single fact drives everything below, because OIDC support lives in the publishing binary.

### The failure mode, and the exact version that fixes it

`actions/setup-node` with `registry-url` writes `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}` into a project-level `.npmrc`. Under OIDC there is deliberately no `NODE_AUTH_TOKEN`, so the placeholder stays unresolved — and the publishing client concludes auth is already configured and **never performs the OIDC token exchange**. The observed symptom is a **404 on the PUT**, which reads as "package not found / no permission" and sends people to check their trusted-publisher configuration, which is fine.

pnpm shipped the fix in **v11.1.3** (2026-05-18). Release note, verbatim:

> Fixed `pnpm publish` failing with a 404 when authentication relied on OIDC trusted publishing alongside an `.npmrc` written by `actions/setup-node` (`_authToken=${NODE_AUTH_TOKEN}`) without `NODE_AUTH_TOKEN` being set. Unresolved `${VAR}` placeholders in auth values are now treated as empty rather than passed through verbatim…

`[VERIFIED — pnpm GitHub releases API; PR pnpm/pnpm#11526 "fix(config): drop unresolved ${VAR} placeholders from .npmrc auth values", merged 2026-05-15; issue pnpm/pnpm#11513]`

**So: pnpm ≥ 11.1.3 is a hard requirement, not a preference.** 11.17.0 is far past it. A plan that pins pnpm 11.0.x reintroduces the exact bug. There is a matching open report on the npm side for scoped packages (npm/cli#8976) — and this package is scoped — which is why the npm CLI should also be explicitly upgraded rather than trusted at the runner default.

`actions/setup-node`'s proposed `auth-token-line: false` input **does not exist** in the action's current `action.yml` (checked directly `[VERIFIED]`); it was proposed in actions/setup-node#1551 and closed as duplicate. Do not write it into a workflow.

### The workflow

```yaml
name: release
on:
  push: { branches: [main] }
concurrency: ${{ github.workflow }}-${{ github.ref }}

permissions:
  contents: write         # changesets pushes the version commit / tag
  pull-requests: write    # changesets opens the "Version Packages" PR
  id-token: write         # REQUIRED for OIDC. Without it: no token exchange, 404.

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with: { fetch-depth: 0 }        # changesets needs history to diff released versions
      - uses: pnpm/action-setup@v4      # resolves pnpm 11.17.0 from packageManager
      - uses: actions/setup-node@v5
        with:
          node-version: 24              # >= 22.14.0 required for OIDC
          registry-url: 'https://registry.npmjs.org'
          cache: pnpm
      - run: npm install -g npm@latest  # >= 11.5.1; the runner default may be older
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck && pnpm build && pnpm test
      - uses: changesets/action@v1
        with:
          version: pnpm changeset version
          publish: pnpm changeset publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**No `NPM_TOKEN`, and no `--provenance`** — provenance attestations are generated automatically for public repos on GitHub Actions.

**What goes wrong if it is wrong:**

| Mistake | Symptom |
|---|---|
| `id-token: write` omitted | No OIDC token available; publish falls back to token auth and fails `ENEEDAUTH`/404 |
| pnpm pinned < 11.1.3 | **404 on PUT**, with provenance signing appearing to succeed first — the most misleading failure in the set |
| npm CLI < 11.5.1 on the runner | OIDC exchange unsupported |
| `NPM_TOKEN` left in the env | Token auth wins; publish succeeds *without* provenance — a silent downgrade, the worst outcome because it looks fine |
| `fetch-depth` default (1) | changesets cannot determine what was released; version/publish misbehaves |

**Confidence: MEDIUM on the workflow as a whole, HIGH on the pnpm version requirement.** Nothing publishes until v0.1 completes (ROADMAP), so this workflow **cannot be proven end to end in Phase 2**. See Open Questions.

## Implementation Ordering

### The hinge

**`assertSingleInstance()` is the hinge.** It is the first runtime code in a package that has been types-plus-four-constants, and both PKG-04 and PKG-05 are *defined relative to it*: PKG-04 is the test that it works, PKG-05 is the measurement it must not break. Everything before it is toolchain; everything after it consumes it.

Two consequences for plan structure:

1. **The PKG-05 probe must be written and passing *before* `assertSingleInstance` lands**, so its baseline is a package with genuinely zero runtime dependencies. Writing the probe afterwards means the first thing it ever measures is the new code, and there is no clean reading to compare against.
2. **The PKG-04 test must run against `dist/`, not `src/`.** The whole finding is about what survives tree-shaking. A test importing `../src/contract.js` proves nothing and will pass forever.

### Ordered sequence

**Wave 0 — toolchain and deltas.** No behaviour change; every gate must be green before and after.
1. `typescript` → `7.0.2` exact (root devDependency). Verify `pnpm typecheck` still exits 0 — pre-verified today, both configs clean under 7.0.2.
2. `packageManager` → `pnpm@11.17.0`. **Own commit.** Run `pnpm install --no-frozen-lockfile`; review lockfile churn in isolation.
3. Install `tsdown`, `vitest`, `publint`, `@arethetypeswrong/cli`, `@changesets/cli`.
4. Add `packages/concierge/LICENSE`.

**Wave 1 — build + the separated typecheck gate (PKG-01).**
5. `packages/concierge/tsdown.config.ts` with `attw: { level: "error", profile: "esm-only" }`, `publint: { level: "error" }`. Add the `build` script. Root `pnpm build` now exits 0.
6. Decide and apply the sourcemap disposition (recommend: add `"src"` to `files`).
7. Standalone `publint --strict` + `attw --pack --profile esm-only` wired as a script.
8. **Defect-first proof:** the D2 mutant (`exports.types` → missing file) makes the build exit 1; a type-error mutant makes `pnpm typecheck` exit non-zero **while `pnpm build` exits 0**. Restore via `mutate-and-prove.sh`, assert `git diff --exit-code`.

**Wave 2 — THE HINGE: `assertSingleInstance` + the test runner (PKG-04, PKG-05).**
9. `scripts/pkg05-zero-runtime-deps.mjs` + `check:deps`. Run it against the *current* artifact and record the clean baseline. Prove it with the `nanoid` mutant.
10. Vitest config (`test.projects` with a single `node` project; **typecheck mode OFF**) and the `test` scripts. Root `pnpm test` stops being a silent no-op.
11. `src/contract.ts` (`CONTRACT_VERSION`, `assertSingleInstance`), exported from `src/index.ts`.
12. `test/single-instance.test.ts` (F1, F2) against `dist/`, plus `test/artifact.test.ts`.
13. Fixture adapters F3 under `test/fixtures/`, `private: true`, core as `peerDependency` + `workspace:*` devDependency.
14. Re-run `check:deps` — must still be clean. **This is the PKG-04/PKG-05 reconciliation, and it is the step most worth an explicit verification line.**

**Wave 3 — distribution (PKG-02, PKG-03) and release.**
15. `scripts/pack-install-check.sh` + the probe fixture.
16. `scripts/node-floor-check.sh` + the Node 22.12.0 download/cache.
17. `.github/workflows/ci.yml` — `build` job and `node-floor` job, artifact-passed.
18. `.changeset/config.json` (with an explicit empty `ignore: []`) and `.github/workflows/release.yml`.
19. Catalog pins for `svelte` / `@sveltejs/package`, plus the written build-toolchain constraint.

**Wave 4 — the two Phase 1 deferrals.**
20. `test-d/exports.test-d.ts` — the `MESSAGE_MAX_CHARS` guard importing from `../src/index.js`.
21. The M9 `_policyNotBivariant` detector (in `test-d/actions.test-d.ts` or a new `test-d/consent-variance.test-d.ts`).
22. **Defect-first proof for both**, using `mutate-and-prove.sh` — expected diagnostics are TS1485 and TS2344 respectively, both already measured.

These land last deliberately: they change the diagnostic set of the type-test program, and doing that before the build pipeline is stable makes an unrelated failure look like a regression.

### Parallelization

`config.json` sets `parallelization: true`, and unlike Phase 1 this phase genuinely supports it — the files are disjoint. Waves 1 and 2 must stay serial with respect to each other (the hinge), but within Wave 3, steps 15/16 and 18/19 touch nothing in common. Wave 4 is independent of Wave 3 entirely and could run alongside it.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (runtime) | **Vitest 4.1.10** — `test.projects` with a single `node` project. No `jsdom` project until Phase 9. **`typecheck` mode OFF** (see collision below). |
| Framework (type-level) | **`tsc --noEmit`** via `tsconfig.test-d.json` — Phase 1's apparatus, unchanged and retained |
| Framework (artifact) | `publint@0.3.22`, `@arethetypeswrong/cli@0.18.5`, and two bespoke node scripts (`pkg05-zero-runtime-deps.mjs`, `pack-install-check.sh`) |
| Config file | `vitest.config.ts` (root) — **none yet, see Wave 0 Gaps** |
| Test file glob | `packages/concierge/test/**/*.test.ts` — **none yet** |
| Type-test glob | `packages/concierge/test-d/**/*.test-d.ts` — exists, 5 files, exit 0 today `[VERIFIED]` |
| Quick run command | `pnpm --filter @fullselfbrowsing/concierge typecheck` (~0.08 s under TS 7) |
| Full suite command | `pnpm typecheck && pnpm build && pnpm test` |
| Distribution suite | `pnpm run check:deps && pnpm run check:pack && pnpm run check:node-floor` |
| Current state | `pnpm build` exits **1** (`ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`); `pnpm test` exits **0** as a silent no-op. Both `[VERIFIED today]` |

**Glob collision, verified:** Vitest 4's default `test.include` is `**/*.{test,spec}.?(c|m)[jt]s?(x)` and does **not** match `*.test-d.ts`, so the two suites coexist. Vitest's `typecheck.include` default **is** `**/*.{test,spec}-d.?(c|m)[jt]s?(x)` and **does** match them. Keep typecheck mode off; if ever enabled, narrow `typecheck.include` away from `test-d/`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| **PKG-01a** | `publint` reports no errors on the packed artifact | artifact lint | `pnpm --filter @fullselfbrowsing/concierge exec publint --strict` | ❌ Wave 1 |
| **PKG-01b** | `attw` reports no errors on the packed artifact under the ESM-only profile | artifact lint | `attw --pack packages/concierge --profile esm-only` | ❌ Wave 1 |
| **PKG-01c** | Both gates fail the **build** when the manifest is wrong | build gate | `pnpm build` with `attw: {level:"error", profile:"esm-only"}` | ❌ Wave 1 |
| **PKG-01d** | A typecheck failure cannot pass the build — `tsc --noEmit` is a separate gate that fires while `tsdown` does not | **structural, mutation-only** | `mutate-and-prove.sh … -- pnpm typecheck`, then assert `pnpm build` exits 0 on the same mutant | ❌ Wave 1 |
| **PKG-02** | A scratch project outside the repo installs the tarball, imports the package, and typechecks against the shipped `.d.ts` with `skipLibCheck: false` | integration (shell) | `pnpm run check:pack` | ❌ Wave 3 |
| **PKG-03a** | The artifact imports and executes on **exactly** Node v22.12.0 | integration (pinned runtime) | `pnpm run check:node-floor`; in CI the `node-floor` job with `process.version` asserted | ❌ Wave 3 |
| **PKG-03b** | The floor job is genuinely pinned, not merely "some Node 22" | assertion inside the job | `node -e "if(process.version!=='v22.12.0') throw …"` | ❌ Wave 3 |
| **PKG-04a** | Two independently-evaluated copies of the built artifact share one registry record | unit (Vitest, against `dist/`) | `pnpm test -- single-instance` | ❌ Wave 2 |
| **PKG-04b** | A contract-version mismatch throws, and the message names both versions and the fix | unit (Vitest) | same | ❌ Wave 2 |
| **PKG-04c** | Two workspace fixture adapters with core as a peer resolve to one physical copy | integration (install graph) | `pnpm test -- fixtures` | ❌ Wave 2 |
| **PKG-04d** | The package publishes ESM-only | artifact | covered by PKG-01b (`--profile esm-only` + `format: ["esm"]`) | ❌ Wave 1 |
| **PKG-05a** | The built artifact's bundle graph contains **no** module from `node_modules` and **no** unbundled external import | artifact (module graph) | `pnpm run check:deps` | ❌ Wave 2 |
| **PKG-05b** | Every entry in `dependencies` resolves to a 0-byte ESM runtime entry | manifest + file size | same script, second assertion | ❌ Wave 2 |
| *(deferral)* | `MESSAGE_MAX_CHARS` is exported from `src/index.ts` as a **value** | type (TS1485) | `pnpm --filter … typecheck` | ❌ Wave 4 → `test-d/exports.test-d.ts` |
| *(deferral)* | `snapshotEquality` keeps function-property syntax (M9), with a **named** detector | type (TS2344) | same | ❌ Wave 4 |
| *(artifact)* | The shipped `dist/index.d.ts` export list is exactly 39 types + 4 values, and excludes `serverChallengeBrand` / `ConsentAckBase` | unit (parse the artifact) | `pnpm test -- export-surface` | ❌ Wave 2 |
| *(artifact)* | Value exports survive into `dist/index.js` at their expected values, frozen | unit (Vitest, against `dist/`) | `pnpm test -- artifact` | ❌ Wave 2 |

**Manual-only checks:** exactly one — **the OIDC release workflow cannot be executed in this phase**, because nothing publishes until v0.1 completes. Its verification is static review against the version requirements above (pnpm ≥ 11.1.3, npm ≥ 11.5.1, Node ≥ 22.14.0, `id-token: write`, no `NPM_TOKEN`, `fetch-depth: 0`). Recorded honestly rather than dressed up as automated. `ReadbackAttestation`'s non-export is **vacuous** and must not be counted as a passing check.

### Suite Adequacy Requirement

A green suite is not evidence of a working suite. **Every gate in this phase is a structural claim, and a structural claim is only proven by making it fire.** Phase 1's ten-mutant battery let three of ten through on the first draft; this phase's gates are shell exit codes, which fail *silently green* even more readily than type assertions.

Each of the following must be observed failing under a deliberate mutation, applied and restored inside a single `mutate-and-prove.sh` invocation, with `git diff --exit-code` asserted afterwards. Expected signatures below were measured in this session unless marked.

| # | Mutant | Gate that must fire | Measured signature |
|---|---|---|---|
| P1 | `exports["."].types` → nonexistent file | `pnpm build` | `ERROR [publint] … file does not exist` **and** `ERROR [attw]`, exit 1 |
| P2 | `files: []` omits `dist` | `publint --strict` on the packed tarball | 4 errors, exit 1 |
| P3 | `type: "commonjs"` with ESM output | both | publint 2 errors; attw exit 1 |
| P4 | a type error in `src/types.ts` | `pnpm typecheck` **fires**, `pnpm build` **does not** | typecheck non-zero, build 0 — *this pair is the whole of PKG-01d* |
| P5 | add a real runtime dependency and re-export it | `check:deps` | 2 vendored modules + 1 unbundled external, exit 1 |
| P6 | `assertSingleInstance` moved to module scope | `pnpm test -- single-instance` against `dist/` | the registry is absent from the bundle; F1 fails |
| P7 | `CONTRACT_VERSION` bumped in one of two loaded copies | F2 | throws, message matches `/two different copies/` and `/peerDependency/` |
| P8 | `MESSAGE_MAX_CHARS` moved into `index.ts`'s type-export block | `pnpm typecheck` | `TS1485` at the import line of `exports.test-d.ts` |
| P9 | `snapshotEquality` → method syntax | `pnpm typecheck` | `TS2344` naming `_policyNotBivariant` |
| P10 | a source feature newer than the floor (`Promise.try`) | `check:node-floor` | passes on v24.14.1, fails on v22.12.0 (`Promise.try` is `undefined` there) |
| P11 | `MESSAGE_MAX_CHARS` dropped from `index.ts`'s export list | `pnpm test -- export-surface` | 42 names instead of 43 |

P4, P6 and P10 are the ones that cannot be skipped: each proves a claim that is *only* structural, and each is invisible to every other check in the suite.

### Sampling Rate

The cost profile is unusually favourable — measured: `tsc --noEmit` ~0.08 s under TS 7, `tsdown` 35 ms, `publint` ~105 ms, `attw` ~99 ms. The expensive items are network-bound (`check:pack` installs from the registry) or download-bound (`check:node-floor`, once).

- **Per task commit:** `pnpm typecheck` (must exit 0) and, once Wave 2 lands, `pnpm test`. Sub-second; no reason to sample less.
- **Per wave merge:** `pnpm typecheck && pnpm build && pnpm test && pnpm run check:deps`. Still under ~2 s after the first build.
- **Per wave merge, Wave 3 onward:** add `pnpm run check:pack`.
- **Phase gate before `/gsd-verify-work`:** (a) all of the above from a clean checkout; (b) `pnpm run check:node-floor` green on a real v22.12.0; (c) the **eleven-mutant battery** above, every mutant producing a non-zero exit from its named gate and `git diff --exit-code` clean after each; (d) `git status --porcelain` empty; (e) the packed tarball's file list reviewed by eye once, against the sourcemap decision taken in Wave 1.

### Wave 0 Gaps

This phase *introduces* the test runner, so the gaps are real and large. Nothing in the runtime-test column exists.

- [ ] **Framework install:** `pnpm add -Dw vitest@4.1.10` — no test runner exists today
- [ ] **Framework install:** `pnpm add -Dw tsdown@0.22.14 publint@0.3.22 @arethetypeswrong/cli@0.18.5 @changesets/cli@2.31.1`
- [ ] **Compiler bump:** `typescript` `^5.7.0` → `7.0.2` exact (verified non-breaking against both real tsconfigs)
- [ ] **Package manager bump:** `packageManager: "pnpm@11.17.0"` — separate commit for lockfile churn
- [ ] `vitest.config.ts` (root) — `test.projects` with one `node` project, **typecheck mode off**
- [ ] `packages/concierge/tsdown.config.ts` — with the `attw`/`publint` `level: "error"` gates
- [ ] `packages/concierge/package.json` — add `build` and `test` scripts (closes `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT` and the silent no-op)
- [ ] `packages/concierge/LICENSE` — listed in `files`, absent from disk
- [ ] `packages/concierge/src/contract.ts` — `CONTRACT_VERSION` + `assertSingleInstance`
- [ ] `packages/concierge/test/single-instance.test.ts` — PKG-04a/b
- [ ] `packages/concierge/test/artifact.test.ts` — value exports + export-surface count
- [ ] `packages/concierge/test/fixtures/adapter-alpha|beta/` — PKG-04c
- [ ] `packages/concierge/test/fixtures/probe.ts` — the PKG-02 scratch probe
- [ ] `packages/concierge/test-d/exports.test-d.ts` — the `MESSAGE_MAX_CHARS` guard (imports `../src/index.js`)
- [ ] `scripts/pkg05-zero-runtime-deps.mjs` — PKG-05
- [ ] `scripts/pack-install-check.sh` — PKG-02
- [ ] `scripts/node-floor-check.sh` — PKG-03
- [ ] `scripts/mutate-and-prove.sh` — the defect-first / mutation-hygiene harness
- [ ] `.changeset/config.json` — with an explicit empty `ignore: []`
- [ ] `.github/workflows/ci.yml` and `.github/workflows/release.yml` — **no `.github/` directory exists at all**
- [ ] `pnpm-workspace.yaml` — catalog pins for `svelte` / `@sveltejs/package`
- [ ] A written build-toolchain constraint (tsdown vs `svelte-package`)

No shared fixtures beyond those listed; the phase has no `conftest`-equivalent need.

## Common Pitfalls

Each is this-repo-specific and each was either measured here or is a direct consequence of something measured here.

### 1. `attw: true` in `tsdown.config.ts` looks like a gate and is not
Measured: a build with `attw` problems and `publint` clean exits **0**. Writing `attw: true` and reporting PKG-01 satisfied is the single most likely silent failure in this phase. **Detection:** run the P1 mutant; if `pnpm build` exits 0, the gate is not wired. **Fix:** `attw: { level: "error", profile: "esm-only" }`.

### 2. `attw`'s default profile fails a *correct* ESM-only package
`attw --pack .` exits **1** on this package with `CJS resolves to ESM`. The natural "fix" — adding a CJS format — reverses a locked decision. **Always pass `--profile esm-only`,** both in tsdown config and standalone. Note the profile also *ignores* the `node16-cjs` resolution entirely, so a bogus `exports.require` will not be caught by attw; `publint` catches it (measured, D1).

### 3. Writing the Node-floor CI job with pnpm
`pnpm@11.17.0` refuses to start on Node 22.12.0 (`requires at least Node.js v22.13`). The job fails on tooling, and the obvious remedy — raising `engines.node` to `>=22.13` — abandons the requirement while appearing to fix it. **The floor job takes a tarball artifact and uses npm + node only.**

### 4. `node-version: 22.12` or `22` in `setup-node`
Resolves to the newest matching release, which is exactly the "developer's newer runtime" the criterion excludes. Quote the exact version **and** assert `process.version` inside the job.

### 5. A scratch project created inside the repo tree
`pnpm-workspace.yaml` globs `packages/*` and `examples/*`. A scratch dir under either is absorbed into the workspace and pnpm links the local copy instead of installing the tarball — the test passes without testing anything. **Use `mktemp -d`.**

### 6. `moduleResolution: "node20"` in the scratch tsconfig
TS 7.0.2 rejects it: *"Argument for '--moduleResolution' option must be: 'node16', 'nodenext', 'bundler'"*. Set `"module": "node20"` alone; it implies `moduleResolution: "node16"` and `moduleDetection: "force"`.

### 7. `console` in the PKG-02 probe
Core is built under `lib: ["ES2022"]` with no `@types/node`, and the probe must hold the same line or it is not testing what a DOM-free consumer sees. A `console.log` is `TS2584`. Make the probe pure declarations; do the runtime check in a separate `node -e`.

### 8. The `MESSAGE_MAX_CHARS` guard written against `../src/types.js`
Measured: under the regression, the `types.js` form exits **0**, the type-test program is silent, *and the emit build is silent*, while `dist/index.js` loses the runtime binding. The existing `_messageBound` in `results.test-d.ts` has exactly this defect. **The new guard must import from `../src/index.js`.** Do not "consolidate" the two into one file with one import.

### 9. Enabling Vitest typecheck mode
`typecheck.include` defaults to `**/*.{test,spec}-d.?(c|m)[jt]s?(x)`, which matches Phase 1's five `test-d/*.test-d.ts` files — files with no `it`/`describe` and a tsconfig Vitest does not know about. Reproduced: `vitest run --typecheck` errors in `startTypechecker` and exits 1. **Leave it off.**

### 10. Asserting `ReadbackAttestation` is not exported
It does not exist in `types.ts` (0 occurrences). The assertion passes vacuously and reads as coverage. Assert only the two real ones — `serverChallengeBrand`, `ConsentAckBase` — and assert them as *absent from the export list*, not absent from the `.d.ts` file, since rolldown correctly bundles their declarations into it.

### 11. Trusting `changeset publish` to use npm
It uses **`pnpm publish`** here. That is what makes the LICENSE work today (pnpm copies the workspace-root LICENSE; npm does not — measured, 3 entries vs 2) and it is what makes the pnpm-version requirement load-bearing rather than incidental.

### 12. Pinning pnpm 11.0.x
The OIDC/`.npmrc`-placeholder 404 was fixed in **11.1.3**. Below that, `pnpm publish` returns 404 on the PUT after provenance signing appears to succeed — a failure that points at trusted-publisher configuration rather than at the client.

### 13. Leaving `NPM_TOKEN` in the release workflow env
Token auth wins over OIDC and the publish succeeds — **without provenance**. The only outcome in this list that produces a green build and a degraded artifact.

### 14. Centralizing the build once tsdown works
The moment a shared build config exists that every package inherits, `concierge-svelte` inherits it in Phase 9 and its runes get pre-bundled, killing reactivity with no error. Keep `pnpm -r build` with per-package `build` scripts, and write down why.

### 15. Bumping pnpm and the lockfile in the same commit as anything else
Lockfile churn from a major package-manager bump is unreviewable when mixed with real changes. Separate commit; then flip CI to `--frozen-lockfile`.

### 16. Shipping `declarationMap` without `src`
`dist/index.d.ts.map` points at `../src/types.ts` with no `sourcesContent`, and `src` is not in `files`. Both gates report clean. Decide deliberately: add `"src"` to `files`, or turn the maps off.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Manifest/`exports` correctness | A custom package.json linter | `publint --strict` | It knows the resolution rules; the measured battery shows it catching 4 of 5 realistic defects |
| Types-resolution correctness | Manual `tsc` probes per condition | `attw --profile esm-only` | It enumerates node10/node16-cjs/node16-esm/bundler; hand-rolling misses one |
| Duplicate-instance detection | A custom module registry, a build-time dedup plugin, or `import.meta` inspection | `globalThis[Symbol.for(…)]` | The only mechanism that survives two independent module evaluations across realm-sharing contexts; verified working through a bundle |
| Dependency byte accounting | Parsing `dist/` with regexes | `rolldown` programmatically, inspecting `chunk.modules` | Catches inlined vendor code *and* unbundled external edges; a regex sees neither reliably |
| Versioning + changelog | Hand-edited versions, or commit-message parsing | `changesets` | Settled upstream; also the thing that knows how to publish a workspace |
| Node version management for the floor test | `nvm`/`fnm`/`volta` as a repo dependency | The official tarball, cached in `$TMPDIR` | Zero install footprint, identical locally and in CI; measured at ~4 s cold |
| Mutation-and-restore | Ad-hoc `sed` then manual undo | `scripts/mutate-and-prove.sh` with `trap` + `git checkout` + `git diff --exit-code` | Phase 1's near-miss was precisely an unrestored ad-hoc mutation |

**Key insight:** every "gate" in this phase is a shell exit code, and an exit code that is never observed non-zero is indistinguishable from an absent check. The scripts above are cheap; the discipline of proving each one fires is the actual deliverable.

## Security Domain

`security_enforcement` is not `false` in `.planning/config.json`, so this section is required. Phase 2 ships almost no application logic, but it decides the **supply-chain** posture for everything published thereafter.

| ASVS category | Applies | Control in this phase |
|---|---|---|
| V2 Authentication | **yes — CI identity** | npm trusted publishing (OIDC), `id-token: write`, **no long-lived `NPM_TOKEN`**. Verified requirement: npm ≥ 11.5.1, Node ≥ 22.14.0, pnpm ≥ 11.1.3. The failure mode to guard is the *silent downgrade*: a stray `NPM_TOKEN` makes publish succeed without provenance. |
| V3 Session Management | no | No sessions in this phase. |
| V4 Access Control | **partial** | Trusted-publisher configuration binds publish rights to a specific repo+workflow rather than to a transferable secret. `publishConfig.access: public` already set. |
| V5 Input Validation | no | No runtime inputs. `assertSingleInstance` takes no arguments. |
| V6 Cryptography | **yes — by delegation** | Provenance attestations are generated by the platform automatically for public repos; **do not** pass `--provenance` or hand-roll signing. Core still contains no crypto (`crypto`/`TextEncoder` remain `TS2304` under `lib: ["ES2022"]`). |
| V7 Error Handling | **partial** | The `CONTRACT_VERSION` mismatch message is the only externally-visible thrown string added this phase. It must contain version numbers and remediation only — no paths, no environment, no user data. It is a developer-time error, not a dispatcher error, so DSP-03's "generic sentence" rule does not apply to it. |
| V8 Data Protection | **partial — new here** | The published `dist/index.js.map` embeds 57,413 characters of `types.ts` via `sourcesContent`. For an MIT public library this is acceptable, but it means "unexported" ≠ "unpublished": `serverChallengeBrand` and `ConsentAckBase` ship as text. Make it a decision, not an accident. |
| V14 Configuration | **yes** | `pnpm install --frozen-lockfile` in CI; pinned action versions; `packageManager` pinned exactly; `typescript` pinned exactly. |

**Threat patterns relevant to this phase**

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Publish-token exfiltration from CI | Spoofing / Elevation | OIDC; no `NPM_TOKEN` anywhere in the repo or org secrets used by this workflow |
| Dependency substitution at install | Tampering | `--frozen-lockfile`; exactly one runtime dependency, itself 0 bytes; `check:deps` fails if that changes |
| Two-instance consent split (the design's core threat) | Tampering / Repudiation | PKG-04: peer range as first line, `assertSingleInstance` as the enforcing line — the peer range alone was measured to be advisory under pnpm and bypassable under npm |
| Silent provenance downgrade | Repudiation | Treat a successful publish without an attestation as a failed publish; verify on the first real release |
| Malicious `postinstall` in a new dependency | Elevation | Core has one dependency with no install scripts; `check:deps` makes adding a second visible in CI |

## Open Questions (RESOLVED)

Stated honestly rather than resolved by assertion. **All six are now resolved by a locking decision
in a specific plan** — each carries a `RESOLVED:` line naming the decision and the plan that owns
it. The original text is preserved unedited above each resolution, because the reasoning is what
makes the decision reviewable.

**1. pnpm 11's lockfile version — not confirmed.**
The repo is on `lockfileVersion: '9.0'`, which pnpm 10.33.0 writes. Whether pnpm 11.17.0 writes 9.0 or a newer format was **not verified** in this session (pnpm 11 was never installed here; it was only queried on the registry and observed refusing to start on the floor runtime). *Impact if wrong:* a large, unreviewable lockfile diff appearing in an unrelated commit. *Handling:* Wave 0 step 2 isolates the bump in its own commit and runs `--no-frozen-lockfile` explicitly, which makes the answer visible without depending on it. **Confidence: LOW — verify at execution time, cheaply, by running the bump first.**

**RESOLVED:** *observe rather than predict* — plan **02-01 Task 2** isolates the pnpm 11 bump in a commit containing only `package.json` and `pnpm-lock.yaml`, and its acceptance criteria require the SUMMARY to record the **observed** `lockfileVersion` from `pnpm-lock.yaml` line 1 plus the `git diff --stat` line count. The question is answered by measurement at execution time; no plan depends on the answer.

**2. The OIDC release workflow cannot be proven in this phase.**
ROADMAP: nothing publishes until v0.1 completes. So `release.yml` ships unexecuted. The version requirements behind it are HIGH confidence (pnpm ≥ 11.1.3 from a dated release note and a merged PR; npm ≥ 11.5.1 and Node ≥ 22.14.0 from npm docs), but the assembled workflow is MEDIUM. *Handling:* a plan task should record the first-publish checklist somewhere durable (`CONTRIBUTING.md` or a `RELEASING.md`), including "verify the attestation appears on the npm page" — because the silent-downgrade failure is invisible from the workflow's own exit code.

**RESOLVED:** *unexecutable — static review only* — locked in plan **02-10 Task 2**. `release.yml` is verified by inspection against six named properties, an acceptance criterion forbids any SUMMARY statement implying execution, `RELEASING.md` carries the first-publish checklist including the attestation check (and the rule that a publish without an attestation is a **failed** publish), and plan **02-12 Task 3** keeps this as the sole row in § Manual-Only Verifications.

**3. Whether `sourcesContent` should ship at all.**
Recommendation is (a) add `"src"` to `files`, but this is genuinely a taste call with a real trade (58 kB and verbatim publication of the design rationale, vs. a working debugging story). Flagged as a decision the plan must make explicitly rather than inherit from `tsconfig.base.json`'s defaults.

**RESOLVED:** *option (a) — add `"src"` to `files`* — locked in plan **02-03 Task 2**, with the data-protection consequence (`serverChallengeBrand` and `ConsentAckBase` ship as readable source text) stated as a decision in the SUMMARY and registered as accepted threat T-02-12. Plan **02-12 Task 1** re-reviews the packed file list against that record by eye.

**4. Whether the F3 fixture adapters should be real workspace packages or synthesized in a temp dir at test time.**
Real workspace packages give a true install graph but add two entries to `pnpm-workspace.yaml` that must be kept out of publishing for seven phases. Temp-dir synthesis is self-contained but re-runs `pnpm install` inside a test, which is slow and network-dependent. Recommendation is real workspace packages under `test/fixtures/` (the `packages/*` glob does not match them, so they need an explicit workspace entry or to be excluded — check this at implementation time). **Confidence: MEDIUM.**

**RESOLVED:** *real workspace packages* — locked in plan **02-08 Task 1**. `pnpm-workspace.yaml` gains an explicit `packages/concierge/test/fixtures/*` entry (the `packages/*` glob matches one level only), both fixtures are `private: true`, and plan **02-10 Task 2** sets `privatePackages: false` so changesets never offers to version them. Temp-dir synthesis was rejected: it re-runs `pnpm install` inside a test and produces an install graph that is not the one that ships.

**5. Whether `CONTRACT_VERSION` should be a literal integer or a string.**
Recommended integer literal (`1`), because comparison is trivial and the `.d.ts` keeps the literal type. A string like `"1"` or a semver-ish `"0.1"` buys nothing until there is a compatibility *range* to express, which there is not. Low risk either way; noted because it is a one-way door once published.

**RESOLVED:** *integer literal `1`, written unannotated* — locked in plan **02-06 Task 1**. Under `isolatedDeclarations` the literal type `1` survives into the emitted `.d.ts` either way, so the annotation is dropped to match `MESSAGE_MAX_CHARS`'s house style in `types.ts`; the bump policy (integer, bumped only on an incompatible shared-runtime-contract change) is recorded in the doc comment.

**6. Whether `assertSingleInstance` should also be called from a `dist`-level side-effectful subpath for consumers who want the check without calling core's API.**
Not recommended for v0.1 — it reintroduces the `sideEffects` problem through a side door. Noted because it is the obvious follow-up question once someone reads the tree-shaking finding.

**RESOLVED:** *rejected for v0.1* — locked in plan **02-06 Task 1**, which forbids both a side-effectful subpath export and a `sideEffects: ["./dist/contract.js"]` carve-out, with an acceptance criterion asserting `packages/concierge/package.json` is unchanged. tsdown emits a single bundled entry, so the carve-out would name the whole package and trade PKG-05 away to buy PKG-04.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | pnpm 11.17.0 writes `lockfileVersion: 9.0` (or migrates cleanly) | Migration mechanics | Unreviewable lockfile diff; mitigated by isolating the bump |
| A2 | `pnpm/action-setup@v4` resolves pnpm from `packageManager` without extra config | changesets + OIDC | Wrong pnpm version in CI, reintroducing the 11.1.3 bug — assert `pnpm --version` in the job |
| A3 | `actions/setup-node@v5` and `actions/checkout@v5` are the current majors | changesets + OIDC | Workflow fails to resolve the action; trivially visible |
| A4 | The scratch-project install can reach the npm registry in CI | PKG-02 | `check:pack` fails offline; acceptable, but the failure message should say so |
| A5 | `test/fixtures/adapter-*/` are not matched by the `packages/*` workspace glob and need an explicit entry | PKG-04 F3 | Fixtures silently not installed, or unexpectedly published — check at implementation time |
| A6 | `svelte-package` will still be the right second toolchain in Phase 9 | svelte scaffolding | A catalog pin and a paragraph are cheap to revise; this is why the recommendation is *not* a real package |

Everything else in this document is tagged `[VERIFIED]` with the command that produced it, or `[CITED]` with its source.

## Sources

### Primary — reproduced in this session (HIGH confidence)

Against the **real repository**:
- `pnpm build` → `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`, exit 1; `pnpm test` → exit 0, no output
- `tsc -p packages/concierge/tsconfig.test-d.json` → exit 0 (TS 5.9.3 and TS 7.0.2); `tsconfig.json` → exit 0 under TS 7.0.2
- `pnpm pack` vs `npm pack --dry-run` on `packages/concierge` — 3 entries incl. LICENSE vs 2 entries without
- `tsdown@0.22.14` against a copy of the real package: 35 ms, `dist/index.js` 1,034 B, `index.d.ts` 52,714 B, `index.js.map` 59,371 B, attw+publint clean
- The shipped `dist/index.d.ts` export list: 43 names = 39 types + 4 values; `serverChallengeBrand`/`ConsentAckBase` present as declarations, absent from the export list; `ReadbackAttestation` 0 occurrences in `types.ts`
- Sourcemap inspection: `d.ts.map` `sources: ["../src/types.ts"]`, no `sourcesContent`; `js.map` `sourcesContent` 57,413 chars
- Mutation battery on a **scratch copy** of `src/` (working tree never modified; `git diff --exit-code` clean throughout): M9 → TS2344 on `_policyNotBivariant`; `MESSAGE_MAX_CHARS` moved to the type-export block → TS1485 via `index.js`, exit 0 via `types.js`, and emit build exit 0 with the binding erased from `dist/index.js`

Against a **shape-faithful mirror** (`type: module`, `sideEffects: false`, ESM-only, tsdown-built):
- Module-scope registry tree-shaken out of both consumer bundles; function-scoped form 63 B unused / 587 B used
- Two independent module evaluations sharing one `globalThis[Symbol.for(…)]` record; mismatch throws
- tsdown `attw: true` → exit 0 with problems; `attw: { level: "error", profile: "esm-only" }` → exit 0 clean / exit 1 on the D2 mutant
- Standalone `attw --pack .` exit 1 (strict) vs exit 0 (`--profile esm-only`)
- Five-defect battery across `publint --strict` and `attw --profile esm-only`
- PKG-05 module-graph probe: clean 1/0/0 exit 0; `nanoid` mutant 3/2/1 exit 1
- Full pack-and-install harness incl. negative control (`180` vs `181` → TS2322, exit 1)
- `tsc --showConfig`: `"module": "node20"` ⇒ `moduleResolution: "node16"`, `moduleDetection: "force"`; `"moduleResolution": "node20"` rejected
- Vitest 4.1.10 `typecheck.include` default read from the shipped bundle; `test.include` default confirmed non-matching for `*.test-d.ts`; `vitest run --typecheck` reproduced erroring
- `mutate-and-prove.sh` exercised across four cases incl. `kill -9` of the gate

Against **real runtimes and registries**:
- Node v22.12.0 downloaded from `nodejs.org/dist` and used to import the built artifact successfully; `Promise.try` undefined there
- `pnpm@11.17.0` refusing to start on Node v22.12.0; `npm view pnpm@11.17.0 engines` → `{"node":">=22.13"}`
- `npm view` for all nine stack packages (versions and `time.modified`)
- `@standard-schema/spec@1.1.0` `dist/index.js` = 0 bytes, from the installed tree
- Peer-conflict behaviour across `npm install` (ERESOLVE, non-zero), `pnpm add` (`✕ unmet peer`, exit 0), `npm install --legacy-peer-deps` (silent, exit 0)
- pnpm workspace peer fixtures resolving to one physical directory (`realpath` equality)
- `@changesets/cli@2.31.1` dist read directly: `getPublishTool` and the `pnpm publish` branch

### Secondary — repository documents, read directly (HIGH)

`./CLAUDE.md` · `.planning/phases/02-packaging-build-and-release/02-CONTEXT.md` · `.planning/ROADMAP.md` (Phase 2) · `.planning/REQUIREMENTS.md` · `.planning/STATE.md` · `.planning/phases/01-type-surface-completion/01-RESEARCH.md` (Validation Architecture) · `packages/concierge/{package.json,tsconfig.json,tsconfig.test-d.json,src/index.ts,test-d/_assert.ts,test-d/results.test-d.ts}` · root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`

### Tertiary — external, cited (MEDIUM–HIGH)

- pnpm releases API — **v11.1.3** release note quoting the OIDC/`.npmrc` `${VAR}` fix (HIGH: dated release note, matching merged PR pnpm/pnpm#11526, matching issue pnpm/pnpm#11513)
- `actions/setup-node` `action.yml` on `main` — confirms `auth-token-line` does **not** exist (HIGH: read the file)
- actions/setup-node#1551 — `registry-url` writing `_authToken=${NODE_AUTH_TOKEN}` breaking OIDC (MEDIUM: closed as duplicate)
- npm/cli#8976 — E404 publishing **scoped** packages via OIDC from `changesets/action` (MEDIUM: open, no stated root cause)
- npm docs, trusted publishing — npm ≥ 11.5.1, Node ≥ 22.14.0, automatic provenance (HIGH)
- `svelte.dev/docs/kit/packaging` — `svelte-package` does not pre-bundle; required `exports`/`svelte` condition (HIGH)

### Carried from CLAUDE.md — NOT re-verified in this session

The six settled decisions (tsdown, ESM-only, pnpm-without-Turborepo, changesets, Vitest `test.projects`, `@standard-schema/spec`), the `isolatedDeclarations` 1064 ms → 25 ms dts timing, Node 20 EOL 2026-04-30, the Standard JSON Schema adoption probe across zod/valibot/arktype, and Phase 1's finding that the type-level suite produces byte-identical diagnostics under TS 5.9.3 and 7.0.2. These are inputs, per the scope fence.

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| PKG-04 mechanism (`assertSingleInstance`, tree-shaking, registry) | **HIGH** | Prototyped, bundled, and run; both the naive and correct forms measured |
| PKG-05 measurement | **HIGH** | Probe written and defect-proven with a real dependency mutant |
| PKG-01 gate configuration | **HIGH** | Proven green and red; five-defect battery measured |
| PKG-02 harness | **HIGH** | Built and run end to end incl. negative control |
| PKG-03 CI shape | **HIGH** | Artifact imported on real v22.12.0; pnpm incompatibility measured, not inferred |
| The two Phase 1 deferrals | **HIGH** | Both defect-proven against the real `src/`, with exact diagnostic codes |
| Migration mechanics | **MEDIUM-HIGH** | TS 7 verified non-breaking; pnpm 11 lockfile version unverified (Open Question 1) |
| changesets + OIDC | **MEDIUM** | Version requirement HIGH (dated release note + merged PR); assembled workflow unexecutable this phase |
| `svelte-package` scaffolding | **MEDIUM** | Constraint is documented fact; the recommendation is a judgement call, stated as such |

**Research date:** 2026-07-28
**Valid until:** ~2026-08-27 for the stack versions (tsdown, vitest, and rolldown all shipped within the last two weeks — re-check `npm view` at execution time if more than a week passes). The mechanical findings — tree-shaking behaviour, attw profiles, pnpm's Node floor, the two mutation signatures — are properties of the tools and the repo, and do not expire on that schedule.
