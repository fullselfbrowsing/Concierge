# Stack Research

**Domain:** Framework-agnostic TypeScript SDK family (dependency-free core + framework adapters + Fetch-standard server handlers), published to npm
**Researched:** 2026-07-27
**Confidence:** HIGH on build/publish/test tooling (empirically verified in a scratch repo). MEDIUM on component-testing strategy (ecosystem genuinely unsettled). HIGH on Standard Schema (probed the real packages).

> Findings marked **[VERIFIED]** were reproduced locally on this machine on 2026-07-27, not recalled from training data. Commands and outputs are in [Appendix: Empirical Verification](#appendix-empirical-verification).

---

## Executive summary — the six decisions

| Question | Answer | Confidence |
|---|---|---|
| Build/bundle | **tsdown** (rolldown) + `isolatedDeclarations: true` | HIGH |
| Module format | **ESM-only** for core + adapters. Not dual. | MEDIUM-HIGH |
| Monorepo | **pnpm 11 workspaces + catalogs, no Turborepo** | HIGH |
| Release | **changesets** | HIGH |
| Testing | **Vitest 4 `test.projects`**: `node` for core, `jsdom` for adapters | HIGH / MEDIUM |
| Schema | **Depend on `@standard-schema/spec@1.1.0`**; read `~standard.jsonSchema`; keep the manual escape hatch | HIGH |
| Publishing | **npm trusted publishing (OIDC)**, attw + publint gated. **No JSR for v0.1.** | HIGH |

Three findings change the roadmap and are called out inline:
1. **Standard JSON Schema exists and Zod/ArkType already implement it** — this obsoletes the planned `@fullselfbrowsing/concierge-zod` bridge package.
2. **Node 20 reached EOL 2026-04-30** — the repo's `engines.node: ">=20"` targets a dead runtime.
3. **TypeScript 7.0 ships no compiler API** — which silently degrades dts generation unless `isolatedDeclarations` is on.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **TypeScript** | `7.0.2` | Compiler + typecheck | GA'd 2026-07-08; native Go port, 8–12x faster typecheck. `types.ts` already compiles clean under it **[VERIFIED]**. Pin exactly — see [TS 7 caveats](#typescript-7-the-api-gap). |
| **tsdown** | `0.22.14` | Library bundler | Official Rolldown-org bundler, the de-facto successor to tsup. Built-in `attw`/`publint` gating, `exports` generation, `platform: "neutral"`. Emits correct `.d.ts`/`.d.cts` **[VERIFIED]**. |
| **rolldown** | `1.2.0` (via tsdown) | Bundling engine | Rust. Now the engine under **Vite 8** (`vite@8.1.5` depends on `rolldown ~1.1.5` **[VERIFIED]**), so build + dev + test converge on one engine. |
| **pnpm** | `11.17.0` | Package manager / workspaces | Strict node_modules is the only PM that reliably surfaces missing peer deps — exactly the class of bug an adapter package ships by accident. Catalogs (stable since 10.12.1) solve multi-version peer testing. |
| **Vitest** | `4.1.10` | Test runner | `test.projects` runs DOM-less `node` and `jsdom` suites in one command with one config. Requires Vite ≥6 and Node ≥20. |
| **changesets** | `2.31.1` | Versioning + release | Monorepo-native, intent-declared. See [Release tooling](#release-tooling-changesets-not-semantic-release). |
| **@standard-schema/spec** | `1.1.0` | Schema interop types | **Types-only: `dist/index.js` is literally 0 bytes and it has zero dependencies [VERIFIED]**. Satisfies "core is dependency-free" in substance. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@arethetypeswrong/cli` | `0.18.5` | Types-resolution validation | CI gate on every package. Invoke via tsdown's `attw: true`. |
| `publint` | `0.3.22` | package.json lint | CI gate. Via tsdown's `publint: true`. |
| `jsdom` | `^29.1.1` | DOM for adapter tests | **Pin `^29`** — `30.0.0` shipped 2026-07-27 (today) and is unproven **[VERIFIED]**. |
| `happy-dom` | `20.11.1` | Faster DOM alternative | Swap in only if adapter suite runtime becomes a problem. Lower fidelity than jsdom. |
| `@testing-library/react` | `16.3.2` | React adapter tests | Peer: `react ^18 \|\| ^19` **[VERIFIED]** — matches our target peer range exactly. |
| `@testing-library/vue` | `8.1.0` | Vue adapter tests | Note: last published 2025-12-13. Stable but slow-moving. |
| `@testing-library/svelte` | `5.4.2` | Svelte adapter tests | Peer accepts `^3 \|\| ^4 \|\| ^5`. See [the Svelte 5 rune constraint](#the-svelte-5-rune-constraint). |
| `@vitest/coverage-v8` | `4.1.10` | Coverage | Rewritten AST-based in v4; accurate enough to gate on. |
| `@vitest/browser-playwright` | `4.1.10` | Real-browser tests | **Only if** a jsdom gap appears. Not the default — see [Testing](#testing-strategy). |
| `oxlint` | `1.76.0` | Linting | Same org as rolldown/tsdown. Zero-config, ~50x faster than ESLint. |
| `prettier` | `3.9.6` | Formatting | Still the contributor-expected default (125M weekly downloads). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm **catalogs** | Multi-version peer testing | Named catalogs (`catalogs.react18`, `catalogs.react19`) let one workspace hold two React majors simultaneously. This is the mechanism for the peer matrix. |
| GitHub Actions **OIDC** | Publishing | `permissions: { id-token: write }`. No `NPM_TOKEN`. Requires npm CLI ≥11.5.1, Node ≥22.14.0. |
| `tsc --noEmit` | Typecheck gate | Separate from build. tsdown does not typecheck — rolldown transpiles without checking. **This is a real trap: a broken build passes `tsdown` and fails only in CI's typecheck step.** |

---

## Installation

```bash
# Root dev dependencies (monorepo)
pnpm add -Dw typescript@7.0.2 tsdown@^0.22.14 vitest@^4.1.10 \
  @vitest/coverage-v8@^4.1.10 @changesets/cli@^2.31.1 \
  @changesets/changelog-github@^0.7.0 oxlint@^1.76.0 prettier@^3.9.6 \
  publint@^0.3.22 @arethetypeswrong/cli@^0.18.5

# Core package — runtime dependency, but zero bytes of runtime
pnpm --filter @fullselfbrowsing/concierge add @standard-schema/spec@^1.1.0

# Adapter dev dependencies (peers stay peers)
pnpm --filter @fullselfbrowsing/concierge-react add -D \
  react@^19 react-dom@^19 @testing-library/react@^16.3.2 \
  @vitejs/plugin-react@^6.0.4 jsdom@^29.1.1

pnpm --filter @fullselfbrowsing/concierge-vue add -D \
  vue@^3.5.40 @testing-library/vue@^8.1.0 @vitejs/plugin-vue@^6.0.8 jsdom@^29.1.1

pnpm --filter @fullselfbrowsing/concierge-svelte add -D \
  svelte@^5.56.8 @testing-library/svelte@^5.4.2 \
  @sveltejs/vite-plugin-svelte@^7.2.0 jsdom@^29.1.1
```

---

## Build: tsdown, and why not the others

### The decision

**Use `tsdown` with `isolatedDeclarations: true`.**

### Why not tsup

tsup is the incumbent (7.3M weekly downloads vs tsdown's 3.2M **[VERIFIED]**) but **its last release was 2025-11-12 — over eight months ago [VERIFIED]**. Its maintainer list includes `sxzz`, who is also a core Rolldown/tsdown maintainer; upstream has effectively moved. tsdown ships a `tsdown migrate` codemod precisely because it expects tsup users to migrate.

Adopting an unmaintained bundler for a greenfield 2026 project is a slow-motion migration you have already scheduled.

### Why not the rest

| Tool | Downloads/wk | Verdict |
|---|---|---|
| **unbuild** | 253k | Nuxt-ecosystem-flavoured, thin docs outside it. No reason to pick it over tsdown. |
| **tshy** | 190k | Genuinely correct — it drives plain `tsc` twice and produces textbook dual output. But it *doesn't bundle*, has no attw/publint integration, and its whole value proposition (correct dual ESM+CJS) is moot once you go ESM-only. |
| **rolldown** directly | 82M (mostly via Vite) | Too low-level. tsdown *is* the library-authoring preset over rolldown. |
| **plain `tsc`** | — | Viable for core, and it's the zero-risk option. But you get no `exports` generation, no bundling of internal modules, and no attw/publint gate. Keep `tsc` for typechecking only. |

### The TS 7 interaction — this is the load-bearing detail

TypeScript 7.0 **does not ship a compiler API** (deferred to 7.1). Declaration generators that call the TS API therefore degrade. Running tsdown against TS 7 *without* `isolatedDeclarations` prints:

```
WARN  TypeScript 7.0 does not yet have a stable API and is experimental. Some options will be unavailable.
```

**[VERIFIED]** It still emitted types, but on an explicitly experimental path.

With `isolatedDeclarations: true`, tsdown routes dts generation through **oxc-transform**, which never touches the TS API. Measured on the same scratch package **[VERIFIED]**:

| Config | dts warning | Build time |
|---|---|---|
| TS 7, no isolatedDeclarations | ⚠️ experimental-API warning | **1064 ms** |
| TS 7, `isolatedDeclarations: true` | none | **25 ms** |

That is a 42x speedup *and* it removes the dependency on an API that does not exist yet.

**`packages/concierge/src/types.ts` already satisfies `isolatedDeclarations` under TS 7 with the repo's full strict settings — it compiles clean, unmodified [VERIFIED].** The constraint is nearly free here because the core is a hand-written type surface. It costs explicit return-type annotations on exported functions, which a public API surface should have regardless.

`isolatedDeclarations` also happens to satisfy JSR's "no slow types" rule — see [JSR](#jsr-not-for-v01).

### Recommended `tsdown.config.ts` (core)

```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],          // ESM-only — see below
  platform: "neutral",      // no node/browser globals injected into core
  dts: true,                // → oxc path, given isolatedDeclarations
  exports: true,            // generates the exports map
  clean: true,
  publint: true,            // built-in gate
  attw: { profile: "esmOnly" },
});
```

`platform: "neutral"` matters for core: it stops rolldown from assuming Node or browser globals, reinforcing the no-DOM guarantee at the bundler layer.

> ⚠️ **CJS forces `platform: "node"`.** tsdown's docs are explicit that the CJS format ignores any other platform setting. If you ever add CJS output, `platform: "neutral"` is silently discarded for that half of the build.

---

## Module format: ship ESM-only

This is the recommendation most likely to be argued with, so here is the full reasoning.

### The compatibility argument is now settled

- `require(esm)` is **stable and unflagged on every supported Node line** (20.19+, 22.12+, 24, 26).
- **Node 20 reached EOL on 2026-04-30 [VERIFIED against nodejs/Release schedule.json]**. Every living Node LTS can `require()` an ESM-only package.
- Concierge's declared server targets — Next, Nuxt, SvelteKit, Remix, Hono, Bun, Deno, Workers — are all ESM-native.

So the usual reason to ship CJS (reach) has largely evaporated.

### The correctness argument is Concierge-specific and decisive

Dual-format packages create the **dual-package hazard**: a consumer whose graph reaches core through both `require` and `import` loads *two separate module instances* with two separate copies of module-level state.

For a typical utility library that's a wasted few KB. For Concierge it is a **silent correctness failure in exactly the mechanisms the design contract is built on**:

- **Bridge registry** — a component registers into instance A; a handler reads instance B; `bridge` is `null` forever. The failure surfaces as `"Open the results page first."` on a page that is definitely open. This is close to undebuggable from the outside.
- **Dedup by Promise reference identity** — two dispatchers means two dedup windows, so a retried call double-fires. That is precisely the double-payment the design exists to prevent.
- **Consent kernel** — consent armed on instance A is invisible to instance B; either consent fails closed everywhere (unusable) or the review/confirm pair splits across instances.

A library whose core value is "the human structurally consented, or it doesn't run" should not ship a packaging configuration that can silently duplicate the consent kernel.

### The direction of travel is one-way

Going **ESM-only → dual is a non-breaking, additive change**. Going **dual → ESM-only is a breaking change**. Start narrow; widen on real demand, with real bug reports naming a real consumer.

### Caveats, stated honestly

- ESM-only requires **no top-level `await`** in core for `require(esm)` to work. Trivial to hold, but make it a lint/review rule since a single TLA breaks every CJS consumer.
- Jest-based consumers on default config still struggle with ESM. Vitest-based ones do not. Accept this and document it.
- **Confidence: MEDIUM-HIGH.** The compat data is HIGH confidence; the judgment call on going narrow first is mine, driven by the dual-package hazard being unusually costly for this specific design.

---

## Types resolution: what `attw` actually says

Empirically built a dual-format, multi-subpath package with tsdown and ran `attw --pack` **[VERIFIED]**:

```
┌───────────────────┬────────────┬──────────────────────┬─────────────────────────┐
│                   │ "dualtest" │ "dualtest/sub"       │ "dualtest/package.json" │
├───────────────────┼────────────┼──────────────────────┼─────────────────────────┤
│ node10            │ 🟢         │ 💀 Resolution failed │ 🟢 (JSON)               │
│ node16 (from CJS) │ 🟢 (CJS)   │ 🟢 (CJS)             │ 🟢 (JSON)               │
│ node16 (from ESM) │ 🟢 (ESM)   │ 🟢 (ESM)             │ 🟢 (JSON)               │
│ bundler           │ 🟢         │ 🟢                   │ 🟢 (JSON)               │
└───────────────────┴────────────┴──────────────────────┴─────────────────────────┘
```

Three concrete lessons:

1. **tsdown's generated `exports` omits explicit `"types"` conditions** and relies on the sibling-file convention (`./dist/index.js` → `./dist/index.d.ts`). This is correct and attw-clean under `node16` and `bundler`. Don't "fix" it by hand-adding `types` conditions — you'll only risk mis-ordering them.
2. **`node10` fails on any subpath export.** This is inherent, not a tsdown bug — `moduleResolution: node10` predates the `exports` field. Since Concierge requires TS ≥5 and `node10` resolution *was removed entirely in TypeScript 7*, this is a non-issue. Configure the gate to ignore it:
   ```bash
   attw --pack . --ignore-rules no-resolution   # or tsdown: attw: { profile: "esmOnly" }
   ```
3. Going ESM-only collapses this matrix and removes the whole `.d.cts`/`.d.ts` divergence class of bug.

### tsconfig guidance

Keep the existing `tsconfig.base.json` and add three things:

```jsonc
{
  "compilerOptions": {
    "moduleResolution": "bundler",   // keep for authoring
    "isolatedDeclarations": true,    // NEW — unlocks the oxc dts path
    "lib": ["ES2022"],               // keep — this is what enforces no-DOM
    "erasableSyntaxOnly": true       // NEW — bans enums/namespaces/param properties
  }
}
```

Then add a **separate `tsconfig.node20.json` that typechecks the published output** under `"module": "node20"` (new in TS 5.9+, models `require(esm)`). Authoring under `bundler` while consumers resolve under `node20`/`nodenext` is the single most common source of "works in the repo, broken on install." Checking both is cheap insurance.

---

## The "zero deps, zero DOM types" constraint

This is a stated hard constraint, so it was tested directly rather than assumed.

### No-DOM is enforceable by tsconfig alone — no lint rule needed

With `"lib": ["ES2022"]` (no `"DOM"`), referencing `document` fails to compile **[VERIFIED]**:

```
src/leak.ts(1,35): error TS2584: Cannot find name 'document'.
  Do you need to change your target library? Try changing the 'lib' compiler option to include 'dom'.
```

**The `lib` array is the enforcement mechanism.** Do not add `@types/node` or any DOM-typed dependency to the core package — a single transitive `@types/*` that pulls `lib.dom.d.ts` re-admits `document`/`window` globally and silently deletes this guarantee. Guard it with a CI typecheck of core in isolation.

### The `AbortSignalLike` workaround is sound

`types.ts` declares a structural stand-in rather than importing DOM types. Confirmed that a real DOM `AbortSignal` is assignable to it from a DOM-enabled consumer **[VERIFIED]** — so consumers pass `AbortController.signal` with no cast, and core still never sees `lib.dom`. This pattern is correct; keep it and apply the same technique to any future platform type.

### "Zero dependencies" vs `@standard-schema/spec`

`@standard-schema/spec@1.1.0` is **types-only: `dist/index.js` is 0 bytes, and it declares no dependencies [VERIFIED]**. Adding it as a real `dependency` adds zero bytes to any consumer bundle and zero transitive install surface.

**Recommendation: take the dependency.** Rationale — the inlined copy in `types.ts` **has already drifted** from the real spec in three ways:

| Real spec (1.1.0) | Concierge's inlined copy | Consequence |
|---|---|---|
| `validate: (value, options?: Options)` | `validate: (value)` | Cannot forward `libraryOptions`. Assignability still holds (optional params), so this is latent, not breaking. |
| `Issue { message, path? }` | `Issue { message }` | Issue paths are unavailable — you can't tell the model *which field* failed. |
| Ships `StandardJSONSchemaV1` | absent | **Misses the entire JSON Schema interop story** — see below. |
| `types?: Types \| undefined` | `types?: Types` | ⚠️ With the repo's `exactOptionalPropertyTypes: true`, a library that sets `types: undefined` explicitly would be **rejected**. Real interop risk. |

If the zero-dependency constraint is treated as absolute, the fallback is `devDependency` + inline — but then add a test that structurally asserts the inlined types still match the real package, or this drift recurs. Inlining a spec you don't test against is how you end up with a subtly wrong interop surface.

---

## Standard Schema: the finding that changes the roadmap

### Spec shape (authoritative, read from the published `.d.ts`)

Version 1.1.0 restructured the spec into three interfaces sharing a `StandardTypedV1` base:

```ts
interface StandardTypedV1<Input, Output> {          // base
  readonly "~standard": { version: 1; vendor: string; types?: Types<Input, Output> };
}

interface StandardSchemaV1<Input, Output> {          // validation
  readonly "~standard": StandardTypedV1.Props & {
    readonly validate: (value: unknown, options?: Options) =>
      Result<Output> | Promise<Result<Output>>;
  };
}

interface StandardJSONSchemaV1<Input, Output> {      // ← NEW in 1.1.0
  readonly "~standard": StandardTypedV1.Props & {
    readonly jsonSchema: {
      readonly input:  (options: { target: Target; libraryOptions?: ... }) => Record<string, unknown>;
      readonly output: (options: { target: Target; libraryOptions?: ... }) => Record<string, unknown>;
    };
  };
}

type Target = "draft-2020-12" | "draft-07" | "openapi-3.0" | ({} & string);
```

### Adoption — measured, not claimed

Probed the actual published packages **[VERIFIED]**:

| Library | Version tested | `~standard` | `~standard.jsonSchema` |
|---|---|---|---|
| **Zod** | 4.4.3 | ✅ `vendor=zod` | ✅ **yes** |
| **ArkType** | 2.2.3 | ✅ `vendor=arktype` | ✅ **yes** |
| **Valibot** | 1.4.2 | ✅ `vendor=valibot` | ❌ **NO** — keys are only `['version','vendor','validate']` |

⚠️ **standardschema.dev's docs claim Valibot v1.2+ implements Standard JSON Schema. That is not true of the published `valibot@1.4.2`.** Valibot still requires the separate `@valibot/to-json-schema@1.7.1` package, which emits **draft-07** by default, not draft-2020-12. Flagging this explicitly because the docs would have led to a wrong design if trusted.

### What this means for the roadmap

**The planned `@fullselfbrowsing/concierge-zod` bridge package should be dropped.** The Key Decisions table in `PROJECT.md` commits to shipping one "for JSON Schema emission." Standard JSON Schema makes it unnecessary for Zod and ArkType, and it wouldn't have helped Valibot anyway. Correct design:

```ts
function emitJsonSchema(action: ActionDefinition): JsonSchemaObject {
  if (action.jsonSchema) return action.jsonSchema;            // 1. explicit escape hatch wins

  const std = (action.schema as any)["~standard"];
  if (std?.jsonSchema) {                                       // 2. Zod 4.2+, ArkType 2.1.28+
    const emitted = std.jsonSchema.input({ target: "draft-2020-12" });
    assertRootIsObject(emitted, action.name);                  // 3. throws, naming the action
    return emitted as JsonSchemaObject;
  }

  throw new Error(
    `Action "${action.name}" uses a schema from "${std?.vendor ?? "unknown"}" that cannot emit ` +
    `JSON Schema. Pass an explicit \`jsonSchema\` to defineAction().`
  );
}
```

**The existing optional `jsonSchema?: JsonSchemaObject` field in `types.ts` is exactly right and should stay** — it is the Valibot path and the arbitrary-vendor path. This is a case where the existing design already anticipated the gap.

### The root-`type: "object"` pitfall reproduces on current Zod

The README's headline hard-won lesson was tested against `zod@4.4.3` **[VERIFIED]**:

```
discriminatedUnion root => {"$schema":"...","oneOf":[{"type":"object",...
root type is 'object'? => false
```

**Still true, still silent.** `z.discriminatedUnion` emits `oneOf` with no root `type`. The build-time validation in `buildCatalog` is justified and should be written against this exact reproduction as a regression test.

Also note: both Zod and ArkType inject a **`$schema` key** into the emitted object. OpenAI Realtime's `parameters` field may reject unknown root keys — strip `$schema` before emitting to a transport, and cover it with a test.

---

## Monorepo tooling: pnpm alone, no Turborepo

**Recommendation: pnpm 11 workspaces alone. Do not add Turborepo or Nx for v0.1.**

The usual case for Turborepo is task caching and parallelism. Run the numbers for *this* repo:

- tsdown builds a package in **25 ms** with `isolatedDeclarations` **[VERIFIED]**.
- Turborepo's per-task overhead (hash, cache lookup, restore) is on the order of 50–100 ms.

**For 8 packages of ~150–1500 LOC, Turborepo would plausibly make the build slower** while adding a config file, a daemon, and a telemetry prompt. `pnpm -r build` already runs in topological order — the dependency ordering Turbo's `dependsOn` provides is native pnpm behaviour.

Adopt Turborepo when a real signal appears: a docs site or example apps with multi-second builds, or CI wall time becoming a bottleneck. Nx is the wrong shape entirely here — it's an application-platform tool, and its generators/plugins/graph are heavy overhead for a library family.

### Use pnpm catalogs for shared versions

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "examples/*"
  - "test/matrix/*"

catalog:                    # default catalog — one version, workspace-wide
  typescript: "7.0.2"
  vitest: "^4.1.10"
  jsdom: "^29.1.1"

catalogs:                   # named catalogs — the peer-matrix mechanism
  react18: { react: "^18.3.1", react-dom: "^18.3.1" }
  react19: { react: "^19.2.8", react-dom: "^19.2.8" }
```

Referenced as `"react": "catalog:react19"`. Catalogs landed in pnpm 10.12.1 and are standard workspace functionality in 11.x.

### Fix `packageManager` and `engines`

```jsonc
{
  "packageManager": "pnpm@11.17.0",   // was 10.33.0
  "engines": { "node": ">=22.12.0" }  // was ">=20" — Node 20 is EOL as of 2026-04-30
}
```

`>=22.12.0` is the precise floor at which `require(esm)` is unflagged, which is the guarantee ESM-only publishing depends on.

---

## Release tooling: changesets, not semantic-release

**Recommendation: `@changesets/cli@2.31.1` + `@changesets/changelog-github@0.7.0`.**

| | changesets | semantic-release |
|---|---|---|
| Monorepo | Native — designed for it; handles linked/fixed package groups | Needs `semantic-release-monorepo` plugins; fights multi-package repos |
| Version source | Explicit `.changeset/*.md` intent files | Inferred from commit messages |
| Independent versioning | Built-in | Awkward |
| Weekly downloads | 3.8M **[VERIFIED]** | 2.9M **[VERIFIED]** |

Beyond monorepo fit, there's a domain-specific reason: **Concierge's public surface includes security semantics** (consent grades, redaction defaults, transport capability gates). Whether a change is breaking is a *judgment about the safety contract*, not something reliably inferable from whether someone typed `fix:` or `feat:`. changesets forces that judgment to be written down in prose in the PR, and that prose becomes the changelog. semantic-release would let a `fix:` commit silently loosen a consent gate at patch level.

### ⚠️ Gotcha: changesets + OIDC trusted publishing

`changesets/changesets#2099` — *"changeset publish crashes on already-published packages under npm trusted publishing (OIDC)"* — is real and was only **closed 2026-07-02 [VERIFIED via GitHub API]**. Root cause: under OIDC there is no `_authToken`, so the pre-publish `npm info` check 404s for every package, changesets concludes nothing is published, tries to publish everything, gets `E403`, and crashes on an undefined read instead of skipping.

`@changesets/cli@2.31.1` (published 2026-07-15) postdates the fix. **Use ≥2.31.1 and smoke-test the release workflow against a throwaway scope before the first real publish.** Confidence MEDIUM — the fix date ordering is verified, the specific changelog entry was not read.

Note `@changesets/cli@3.0.0-next.10` is in active prerelease. Stay on 2.x for v0.1.

---

## Testing strategy

### Vitest 4 `test.projects` — one config, two environments

Vitest 4 **removed `vitest.workspace.ts`** in favour of `test.projects` inside the main config.

```ts
// vitest.config.ts (root)
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  test: {
    projects: [
      {
        // CORE — must prove it runs with no DOM whatsoever
        test: {
          name: "core",
          root: "packages/concierge",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "react",
          root: "packages/concierge-react",
          environment: "jsdom",
        },
      },
      {
        plugins: [vue()],
        test: {
          name: "vue",
          root: "packages/concierge-vue",
          environment: "jsdom",
        },
      },
      {
        plugins: [svelte()],
        test: {
          name: "svelte",
          root: "packages/concierge-svelte",
          environment: "jsdom",
          // runes require the .svelte.* filename convention
          include: ["src/**/*.svelte.test.ts", "src/**/*.test.ts"],
        },
      },
    ],
  },
});
```

### The core project must actively prove the no-DOM guarantee

`environment: "node"` is necessary but not sufficient — it removes `document` from the *runtime*, but a `lib: ["DOM"]` leak is a *compile-time* regression that tests won't catch. Use both gates:

1. **Compile-time:** CI runs `tsc --noEmit` on core with `lib: ["ES2022"]` **[VERIFIED to reject `document`]**.
2. **Runtime:** a test in the `node` project asserting the module constructs when `globalThis.document === undefined`. This is the actual SSR scenario for Next App Router / Nuxt / SvelteKit.

```ts
it("constructs with no DOM globals present", () => {
  expect(typeof globalThis.document).toBe("undefined"); // guards the environment itself
  expect(() => createConcierge({ stages: {} })).not.toThrow();
});
```

### jsdom, not browser mode — and why this is the unsettled one

**Recommendation: `jsdom` for adapter tests. Confidence: MEDIUM. This is the genuinely contested area.**

The ecosystem is mid-migration toward Vitest browser mode + Playwright (`vitest-browser-react@2.2.0`, `vitest-browser-vue@2.1.0`, `vitest-browser-svelte@3.0.0`). For Svelte in particular, prominent community guides push hard for it.

I recommend against it for v0.1 because **of what these adapters actually do**. They are ~150 LOC that (a) get an instance into component scope and (b) register/unregister with cleanup. The tests that matter are lifecycle-identity tests:

- React StrictMode double-mount producing a stale unsubscriber
- Vue HMR remount
- Svelte remount
- Getter-based snapshots reading through *after* re-render

**None of these need a real browser.** They need a component lifecycle, which jsdom provides. Browser mode would add Playwright browser downloads to CI, multi-second startup, and cross-browser flake for zero additional signal on the assertions that matter.

Add `@vitest/browser-playwright` narrowly *if* a specific gap appears — the likely candidate is the `-realtime` transport package (WebRTC, `getUserMedia`, audio playback), which jsdom genuinely cannot do. Scope browser mode to that package when you get there, not to the adapters.

Svelte's own official docs still recommend jsdom + `@testing-library/svelte`; the browser-mode push is community-led. Reasonable people disagree — hence MEDIUM.

### The Svelte 5 rune constraint

Two non-obvious requirements that will cost a debugging session if missed:

1. **Files using runes must be named `*.svelte.ts` / `*.svelte.test.ts`.** The `.svelte` infix is what triggers the Svelte compiler to process runes in a non-component file. A rune in a plain `.ts` file is not compiled and fails at runtime. **This constrains how the Svelte adapter itself is authored**, not just its tests — if the adapter uses `$state`/`$derived` internally, its source files need the `.svelte.ts` extension, and the tsdown/rolldown config must run them through the Svelte plugin.
2. **`$effect` requires `$effect.root()` + `flushSync()` in tests** to run synchronously rather than waiting on a microtask queue.

---

## Peer dependency strategy

### Ranges

| Package | peerDependencies | Rationale |
|---|---|---|
| `concierge-react` | `{ "react": "^18.2.0 \|\| ^19.0.0" }` | Matches `@tanstack/react-query`'s `^18 \|\| ^19` and `@testing-library/react`'s peer range exactly **[VERIFIED]**. React 18 still has large installed base. |
| `concierge-vue` | `{ "vue": "^3.5.0" }` | Vue 2 is EOL (Dec 2023). Do **not** adopt `vue-demi` for Vue 2 support — TanStack still carries it and it's pure legacy tax. ⚠️ Vue 3.6 is at `rc.2` **[VERIFIED]** — widen to `^3.5.0 \|\| ^3.6.0` once it ships. |
| `concierge-svelte` | `{ "svelte": "^5.0.0" }` | Runes are Svelte 5-only; the bridge getter contract depends on them. |
| `concierge-server` | none | Fetch-standard — no framework peer at all. That's the whole point. |

### Core-to-adapter linkage — the important one

**Recommendation: make core a `peerDependency` of each adapter, plus a `devDependency` for tests.**

```jsonc
{
  "peerDependencies": {
    "@fullselfbrowsing/concierge": "workspace:^",
    "react": "^18.2.0 || ^19.0.0"
  },
  "devDependencies": {
    "@fullselfbrowsing/concierge": "workspace:^"
  }
}
```

pnpm rewrites `workspace:^` to `^<version>` at publish time.

This diverges from TanStack, which makes `@tanstack/query-core` a regular `dependency` pinned to an **exact** version **[VERIFIED]**. Both work, but for Concierge the peer approach is safer for the same reason ESM-only is: **the consumer's package manager is then structurally required to resolve exactly one copy of core.** With a regular dependency — especially an exact pin — installing `concierge-react@0.1.0` and `concierge-vue@0.1.1` yields *two* cores, two bridge registries, and two dedup windows. In a codebase where module-level identity is the correctness mechanism, that's a silent failure.

The cost is one extra line in install docs (`pnpm add @fullselfbrowsing/concierge @fullselfbrowsing/concierge-react`), which is the familiar `react` + `react-dom` shape.

**Confidence: MEDIUM** — a defensible judgment call, not an ecosystem consensus. Worth an explicit decision entry.

### Testing across peer majors

Use pnpm named catalogs + thin fixture packages, driven by a CI matrix:

```
test/matrix/react18/package.json   → { "react": "catalog:react18", ... }
test/matrix/react19/package.json   → { "react": "catalog:react19", ... }
```

Each fixture depends on `@fullselfbrowsing/concierge-react` via `workspace:*` and re-runs the adapter suite. This gives real side-by-side installs in one lockfile — no `pnpm.overrides` mutation, no reinstall between matrix legs, and the lockfile stays deterministic.

**Avoid** the common alternative of rewriting root `pnpm.overrides` per CI leg: it invalidates the lockfile, forces a full reinstall per matrix entry, and can't run two majors in one job.

---

## Publishing

### npm trusted publishing (OIDC) — adopt from day one

Classic npm tokens began revocation 2025-12-09; write-enabled granular tokens now expire in **7 days by default (90 max)**. Long-lived `NPM_TOKEN` secrets are no longer a viable release strategy.

Requirements **[VERIFIED against docs.npmjs.com]**:

- npm CLI **≥ 11.5.1**, Node **≥ 22.14.0** (CI-side only)
- GitHub Actions, GitLab CI, or CircleCI — on their hosted runners
- `permissions: { id-token: write }`
- **No `NPM_TOKEN`**
- **Provenance attestations are generated automatically** for public repos on GH Actions/GitLab — `--provenance` is not needed. (Not supported on CircleCI.)

```yaml
permissions:
  contents: write
  pull-requests: write
  id-token: write          # ← required for OIDC + provenance
```

Since 2026-02-18, `npm trust` configures trusted publishing across multiple packages at once — useful for 8 packages.

### `publishConfig.access`

**Required** for scoped packages — without it, `npm publish` of `@fullselfbrowsing/*` fails as a private-package request. The existing `packages/concierge/package.json` already has it correctly:

```jsonc
"publishConfig": { "access": "public" }
```

**Every new package must repeat it.** This is the single most common first-publish failure. Add a CI check asserting it exists in all publishable manifests.

### CI gates before publish

```jsonc
"scripts": {
  "build": "tsdown",
  "typecheck": "tsc --noEmit && tsc -p tsconfig.node20.json --noEmit",
  "lint:pkg": "publint && attw --pack . --profile esm-only"
}
```

`publint` will also flag missing `engines.node` and missing `sideEffects` **[VERIFIED — both fired on the scratch package]**. `"sideEffects": false` is already set in the core manifest; keep it on every package, since it's what lets consumers tree-shake unused adapters.

### JSR: not for v0.1

**Recommendation: npm only for v0.1. Revisit at v0.3+.**

Arguments for JSR are real — automatic Sigstore provenance, TS-native distribution, ~40k packages, real traction in Deno/Hono/edge ecosystems, which overlaps Concierge's server-handler targets. And there's a genuine synergy: **JSR's "no slow types" rule is essentially `isolatedDeclarations`, which is already being enabled** — so the usual main cost of JSR publishing is pre-paid.

Against, for now:
- A second registry means a second manifest (`jsr.json`), a second release path in CI, and a second place for version skew — real overhead for a pre-alpha with zero users.
- npm trusted publishing already provides provenance, so JSR's headline security benefit is duplicated.
- The scarce resource at v0.1 is shipping the consent kernel, not distribution breadth.

Revisit when there is evidence of Deno/Workers demand. The cost of adding JSR later is low and it is not a breaking change.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| tsdown | tshy | If you want zero bundling and pure `tsc` semantics, and are willing to lose attw/publint integration. Genuinely correct, just less capable. |
| tsdown | plain `tsc` | If tsdown/rolldown proves unstable. Core is dependency-free so `tsc` alone can build it — you'd hand-write `exports` and run attw separately. |
| ESM-only | Dual ESM+CJS | If a named, important consumer reports a hard CJS blocker. Additive, non-breaking — so wait for the report. |
| pnpm alone | Turborepo | Once docs/example apps push CI wall time past ~2 minutes. |
| changesets | release-it | Single-package repos wanting manual control. Not applicable here. |
| jsdom | Vitest browser mode + Playwright | For `-realtime` (WebRTC/audio) where jsdom has no implementation. Scope it to that package. |
| oxlint + Prettier | Biome | If you prefer one binary for lint+format. Biome 2.5 is credible; mainly a taste call. |
| oxlint + Prettier | ESLint + typescript-eslint | If you need type-aware custom rules. ESLint still dominates at 149M/wk **[VERIFIED]**. |
| core as peer dep | core as exact-pinned dep | TanStack's approach. Simpler install docs; risks duplicate core instances. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **tsup** | **Unmaintained — no release since 2025-11-12 [VERIFIED]**. Upstream maintainers moved to tsdown, which ships a migration codemod for it. | tsdown |
| **`moduleResolution: "node"` / `"node10"`** | **Removed entirely in TypeScript 7.** Cannot resolve `exports` or subpaths. | `"bundler"` for authoring, verify under `"node20"` |
| **`engines.node: ">=20"`** | **Node 20 reached EOL 2026-04-30 [VERIFIED]**. Advertises support for a runtime receiving no security patches. | `">=22.12.0"` |
| **`@types/node` in core** | Pulls DOM-adjacent globals and silently defeats the no-DOM guarantee that `lib: ["ES2022"]` enforces. | Structural stand-ins, as `AbortSignalLike` already does |
| **A `concierge-zod` bridge package** | Obsoleted by Standard JSON Schema — Zod 4.2+ and ArkType 2.1.28+ emit it natively **[VERIFIED]**. | Read `~standard.jsonSchema`; keep the `jsonSchema?` escape hatch for Valibot |
| **`zod-to-json-schema`** | Superseded — Zod 4 has native `z.toJSONSchema()` *and* Standard JSON Schema. The standalone package is legacy for Zod 3. | `~standard.jsonSchema.input()` |
| **`vue-demi` / Vue 2 support** | Vue 2 EOL since Dec 2023. Pure maintenance tax on a greenfield adapter. | `vue: "^3.5.0"` peer |
| **jsdom `30.0.0`** | Released **2026-07-27 — today [VERIFIED]**. Unproven; a major bump. | Pin `^29.1.1` |
| **Nx** | Application-platform tooling (generators, plugins, project graph). Overwhelming for 8 small library packages. | pnpm workspaces |
| **`shamefully-hoist=true`** | Hides missing peer/direct dependencies — precisely the bug class that ships broken adapter packages. | pnpm default strict layout |
| **Long-lived `NPM_TOKEN`** | Classic tokens being revoked; granular write tokens expire in 7 days by default. | Trusted publishing (OIDC) |
| **TypeScript compiler API in build tooling** | **TS 7.0 ships no API** (deferred to 7.1). Anything calling it degrades or breaks. | `isolatedDeclarations` → oxc dts path |

---

## Stack Patterns by Variant

**If the zero-dependency constraint is treated as absolute (no `@standard-schema/spec` dependency):**
- Keep the inlined types, but move them to `src/standard-schema.ts` and **add `@standard-schema/spec` as a `devDependency`** with a type-level conformance test (`expectTypeOf`) asserting the inlined interface still accepts real Zod/ArkType/Valibot schemas.
- Without that test the copy drifts — it already has, in four places.

**If a consumer reports a hard CJS blocker:**
- Add `format: ["esm", "cjs"]` to tsdown, keep `dts: true`. Verified to emit `.d.cts`/`.d.ts` pairs cleanly **[VERIFIED]**.
- ⚠️ CJS forces `platform: "node"`, overriding `platform: "neutral"`.
- Then audit all module-level state in core for dual-package hazard before shipping it.

**If the Realtime transport lands (v0.4):**
- That package alone gets `@vitest/browser-playwright` — WebRTC, `getUserMedia`, and audio-playback-completion (the `perceived` consent grade) cannot be tested in jsdom.
- This is also the package where `consentGrade: "perceived"` needs real-browser evidence, so the cost is justified there and only there.

**If adapter count grows beyond ~4 frameworks:**
- Revisit Turborepo, and generate adapter test suites from one shared conformance spec so the bridge-getter contract is tested identically across frameworks rather than re-hand-written per adapter.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `typescript@7.0.2` | `tsdown@0.22.14` | ✅ Works, but **warns and uses an experimental path unless `isolatedDeclarations: true` [VERIFIED]** |
| `typescript@7.0.2` | any tool using the TS compiler API | ❌ **No API in 7.0.** Use `@typescript/typescript6` shim, or avoid |
| `vitest@4.1.10` | `vite@^6 \|\| ^7 \|\| ^8` | **[VERIFIED]** from peerDependencies |
| `vitest@4.1.10` | Node `>=20`, `@types/node ^20 \|\| ^22 \|\| >=24` | **[VERIFIED]** |
| `vite@8.1.5` | `rolldown ~1.1.5` | **[VERIFIED]** Vite 8 is rolldown-powered |
| `tsdown@0.22.14` | `rolldown ~1.2.0` | ⚠️ **Minor skew vs Vite 8's `~1.1.5`** — two rolldown copies will install. Harmless (build-time only) but expect it in the lockfile |
| `@testing-library/react@16.3.2` | `react ^18 \|\| ^19` | **[VERIFIED]** — aligns with our proposed peer range |
| `@testing-library/svelte@5.4.2` | `svelte ^3 \|\| ^4 \|\| ^5` | **[VERIFIED]** — wider than our `^5` peer, which is fine |
| `zod@4.4.3` / `arktype@2.2.3` | Standard JSON Schema | ✅ **[VERIFIED]** both emit `~standard.jsonSchema` |
| `valibot@1.4.2` | Standard JSON Schema | ❌ **[VERIFIED] not implemented** — needs `@valibot/to-json-schema@1.7.1` (draft-07 default) |
| `@changesets/cli` | npm trusted publishing | ⚠️ Use **≥2.31.1**; OIDC crash fixed 2026-07-02 |
| npm trusted publishing | npm CLI ≥11.5.1, Node ≥22.14.0 | **[VERIFIED]** CI-side requirement only |

---

## Open Questions / Genuinely Unsettled

1. **jsdom vs browser mode for adapter tests.** The ecosystem is mid-migration. My recommendation (jsdom) is cost-driven and specific to the fact that these adapters test lifecycle, not rendering. Revisit if adapter tests start needing layout, focus, or real event semantics. **MEDIUM.**
2. **Core as peer dependency vs regular dependency of adapters.** No ecosystem consensus; TanStack does the opposite of my recommendation. My reasoning is Concierge-specific (module-identity-sensitive state). Worth an explicit Key Decision entry. **MEDIUM.**
3. **ESM-only.** Compat data is solid; the judgment to start narrow is mine. Easy to reverse in the safe direction. **MEDIUM-HIGH.**
4. **changesets 3.0** is in active prerelease (`3.0.0-next.10`). Unknown timeline and unknown breaking changes. Stay on 2.x, monitor. **LOW** visibility.
5. **TypeScript 7.1's compiler API** hasn't shipped. If any future need arises for programmatic TS (custom dts transforms, API Extractor-style reports), it's blocked or needs the `@typescript/typescript6` shim. **Not currently on Concierge's path**, but it constrains options. **MEDIUM.**
6. **Vue 3.6** is at `rc.2`. Peer range will need widening shortly after v0.1. **HIGH** confidence it's coming, **LOW** on timing.

---

## Sources

**Empirically verified locally (highest confidence)** — scratch builds at `/tmp/dualtest`, `/tmp/ts7test`, `/tmp/conctest`, `/tmp/sstest` on 2026-07-27:
- tsdown 0.22.14 dual-format build + `attw --pack` + `publint` matrix
- TS 7.0.2 dts generation with and without `isolatedDeclarations` (timing + warning)
- `packages/concierge/src/types.ts` compiling clean under TS 7 + `isolatedDeclarations` + full repo strict flags
- `lib: ["ES2022"]` rejecting `document`; real `AbortSignal` → `AbortSignalLike` assignability
- `~standard.jsonSchema` probe across zod@4.4.3, valibot@1.4.2, arktype@2.2.3
- `z.discriminatedUnion` root-type reproduction
- `@standard-schema/spec@1.1.0` unpacked: 0-byte ESM runtime, zero deps, attw-clean

**Context7:**
- `/rolldown/tsdown` — dual-format config, `publint`/`attw` options, `platform` semantics, CJS platform limitation
- `/vitest-dev/vitest` — `test.projects`, `defineProject`, multi-environment configuration

**Official documentation:**
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ — GA date, no-API caveat, removed options
- https://tsdown.dev/options/dts, /options/package-exports, /guide/ — dts strategy, exports generation
- https://standardschema.dev/ and /json-schema — spec purpose and interface
- https://docs.npmjs.com/trusted-publishers/ — OIDC requirements, automatic provenance
- https://pnpm.io/catalogs — default + named catalogs, `catalog:` protocol
- https://vitest.dev/guide/migration, /guide/browser/ — Vitest 4 breaking changes, browser providers
- https://svelte.dev/docs/svelte/testing — official Svelte testing stance, `.svelte.test` naming, `$effect.root`/`flushSync`
- https://www.typescriptlang.org/tsconfig/#module — `node20`, `nodenext`, `preserve` semantics
- https://raw.githubusercontent.com/nodejs/Release/main/schedule.json — Node 20 EOL 2026-04-30

**Registry / repository data (npm + GitHub API, queried 2026-07-27):**
- Version and last-modified timestamps for all packages cited
- Weekly download counts via `api.npmjs.org/downloads`
- `changesets/changesets#2099`, `#1914` — OIDC publish failures, state and close dates
- `@tanstack/*` peer dependency shapes as prior art

**WebSearch (MEDIUM — corroborated where load-bearing):**
- tsdown-as-tsup-successor positioning; `require(esm)` backport history; JSR adoption estimates; Turborepo threshold guidance. Download counts and maintenance dates were verified directly against npm rather than taken from search results.

---
*Stack research for: framework-agnostic TypeScript SDK family (dependency-free core + framework adapters + Fetch-standard server handlers)*
*Researched: 2026-07-27*

---

## Appendix: Empirical Verification

Reproduction commands for the **[VERIFIED]** claims.

```bash
# 1. tsdown dual-format build → correct .d.ts/.d.cts, attw matrix
#    Result: node16 CJS/ESM/bundler all 🟢; node10 💀 on subpath (expected)
npx tsdown && npx @arethetypeswrong/cli --pack . && npx publint

# 2. TS 7 dts path — the isolatedDeclarations difference
#    Without: "WARN TypeScript 7.0 does not yet have a stable API" — 1064ms
#    With:    no warning — 25ms
npm install typescript@7 && npx tsdown

# 3. Concierge's real type surface under TS 7 + isolatedDeclarations + repo strict flags
#    Result: PASS, unmodified
npx tsc --noEmit

# 4. no-DOM enforcement
#    Result: error TS2584: Cannot find name 'document'.
echo 'export const bad = (): unknown => document.title;' > src/leak.ts && npx tsc --noEmit

# 5. Standard JSON Schema adoption probe
#    zod     : vendor=zod      jsonSchema=true
#    valibot : vendor=valibot  jsonSchema=false   ← contradicts standardschema.dev docs
#    arktype : vendor=arktype  jsonSchema=true
#    discriminatedUnion root type is 'object'? => false   ← README pitfall reproduces
node probe.mjs

# 6. @standard-schema/spec is genuinely types-only
#    Result: dist/index.js is 0 bytes; "deps: none"
npm pack @standard-schema/spec && wc -c package/dist/index.js
```
