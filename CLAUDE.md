<!-- GSD:project-start source:PROJECT.md -->
## Project

**Concierge**

Concierge is an installable TypeScript package family that lets an AI agent operate a web app it has permission to control — through typed, consent-gated actions the app declares, rather than generic DOM automation. The app exposes verbs like `applyFilter({key, value})`; the agent never sees the DOM, only a schema. It is aimed at product engineers who want an agent to actually drive their app, not narrate screenshots of it.

Its sibling is [FSB](https://github.com/fullselfbrowsing/FSB): **FSB drives apps that don't cooperate; Concierge is how an app cooperates.** Same org, same vocabulary, complementary halves.

**Core Value:** An agent can take a consequential action in a real app — and it is structurally guaranteed that **a human, not the agent, confirmed this specific payload**, or the action does not run.

Everything else (framework breadth, transport breadth, DX) is in service of that. A library that makes agent actuation easy but consent optional is worse than nothing, because it will be used.

*Wording note (2026-07-27): this previously read "the human is structurally guaranteed to have consented." Research pushed back, correctly — no library can guarantee a mental state, and the habituation literature says humans rubber-stamp confirmations. What is actually enforceable is the provenance of the confirmation and the identity of what was confirmed. The claim is narrower and true, rather than broader and unfalsifiable.*

### Constraints

- **Tech stack**: TypeScript, pnpm workspace, Node ≥20. Core is dependency-free.
- **Compatibility**: Core must construct on the server under Next App Router, Nuxt, and SvelteKit with no environment guards — no top-level `window`, `document`, or `navigator`.
- **Compatibility**: Framework adapters must stay around ~150 LOC. An adapter meaningfully larger than that means logic has leaked out of core, and is treated as a core bug.
- **Security**: Redaction is required for any action with a non-empty schema and defaults to `drop`. Telemetry leaks must be opt-in.
- **Security**: Handler exceptions never reach the model or telemetry — a generic sentence is the entire externally-visible surface of a crash. Thrown messages echo user input and would become a covert PII channel.
- **Licensing**: MIT, public. Chosen over FSB's BSL 1.1 because BSL on an npm library requires a commercial license for production use, which hard-caps adoption of an SDK.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
## Installation
# Root dev dependencies (monorepo)
# Core package — runtime dependency, but zero bytes of runtime
# Adapter dev dependencies (peers stay peers)
## Build: tsdown, and why not the others
### The decision
### Why not tsup
### Why not the rest
| Tool | Downloads/wk | Verdict |
|---|---|---|
| **unbuild** | 253k | Nuxt-ecosystem-flavoured, thin docs outside it. No reason to pick it over tsdown. |
| **tshy** | 190k | Genuinely correct — it drives plain `tsc` twice and produces textbook dual output. But it *doesn't bundle*, has no attw/publint integration, and its whole value proposition (correct dual ESM+CJS) is moot once you go ESM-only. |
| **rolldown** directly | 82M (mostly via Vite) | Too low-level. tsdown *is* the library-authoring preset over rolldown. |
| **plain `tsc`** | — | Viable for core, and it's the zero-risk option. But you get no `exports` generation, no bundling of internal modules, and no attw/publint gate. Keep `tsc` for typechecking only. |
### The TS 7 interaction — this is the load-bearing detail
| Config | dts warning | Build time |
|---|---|---|
| TS 7, no isolatedDeclarations | ⚠️ experimental-API warning | **1064 ms** |
| TS 7, `isolatedDeclarations: true` | none | **25 ms** |
### Recommended `tsdown.config.ts` (core)
## Module format: ship ESM-only
### The compatibility argument is now settled
- `require(esm)` is **stable and unflagged on every supported Node line** (20.19+, 22.12+, 24, 26).
- **Node 20 reached EOL on 2026-04-30 [VERIFIED against nodejs/Release schedule.json]**. Every living Node LTS can `require()` an ESM-only package.
- Concierge's declared server targets — Next, Nuxt, SvelteKit, Remix, Hono, Bun, Deno, Workers — are all ESM-native.
### The correctness argument is Concierge-specific and decisive
- **Bridge registry** — a component registers into instance A; a handler reads instance B; `bridge` is `null` forever. The failure surfaces as `"Open the results page first."` on a page that is definitely open. This is close to undebuggable from the outside.
- **Dedup by Promise reference identity** — two dispatchers means two dedup windows, so a retried call double-fires. That is precisely the double-payment the design exists to prevent.
- **Consent kernel** — consent armed on instance A is invisible to instance B; either consent fails closed everywhere (unusable) or the review/confirm pair splits across instances.
### The direction of travel is one-way
### Caveats, stated honestly
- ESM-only requires **no top-level `await`** in core for `require(esm)` to work. Trivial to hold, but make it a lint/review rule since a single TLA breaks every CJS consumer.
- Jest-based consumers on default config still struggle with ESM. Vitest-based ones do not. Accept this and document it.
- **Confidence: MEDIUM-HIGH.** The compat data is HIGH confidence; the judgment call on going narrow first is mine, driven by the dual-package hazard being unusually costly for this specific design.
## Types resolution: what `attw` actually says
### tsconfig guidance
## The "zero deps, zero DOM types" constraint
### No-DOM is enforceable by tsconfig alone — no lint rule needed
### The `AbortSignalLike` workaround is sound
### "Zero dependencies" vs `@standard-schema/spec`
| Real spec (1.1.0) | Concierge's inlined copy | Consequence |
|---|---|---|
| `validate: (value, options?: Options)` | `validate: (value)` | Cannot forward `libraryOptions`. Assignability still holds (optional params), so this is latent, not breaking. |
| `Issue { message, path? }` | `Issue { message }` | Issue paths are unavailable — you can't tell the model *which field* failed. |
| Ships `StandardJSONSchemaV1` | absent | **Misses the entire JSON Schema interop story** — see below. |
| `types?: Types \| undefined` | `types?: Types` | ⚠️ With the repo's `exactOptionalPropertyTypes: true`, a library that sets `types: undefined` explicitly would be **rejected**. Real interop risk. |
## Standard Schema: the finding that changes the roadmap
### Spec shape (authoritative, read from the published `.d.ts`)
### Adoption — measured, not claimed
| Library | Version tested | `~standard` | `~standard.jsonSchema` |
|---|---|---|---|
| **Zod** | 4.4.3 | ✅ `vendor=zod` | ✅ **yes** |
| **ArkType** | 2.2.3 | ✅ `vendor=arktype` | ✅ **yes** |
| **Valibot** | 1.4.2 | ✅ `vendor=valibot` | ❌ **NO** — keys are only `['version','vendor','validate']` |
### What this means for the roadmap
### The root-`type: "object"` pitfall reproduces on current Zod
## Monorepo tooling: pnpm alone, no Turborepo
- tsdown builds a package in **25 ms** with `isolatedDeclarations` **[VERIFIED]**.
- Turborepo's per-task overhead (hash, cache lookup, restore) is on the order of 50–100 ms.
### Use pnpm catalogs for shared versions
# pnpm-workspace.yaml
### Fix `packageManager` and `engines`
## Release tooling: changesets, not semantic-release
| | changesets | semantic-release |
|---|---|---|
| Monorepo | Native — designed for it; handles linked/fixed package groups | Needs `semantic-release-monorepo` plugins; fights multi-package repos |
| Version source | Explicit `.changeset/*.md` intent files | Inferred from commit messages |
| Independent versioning | Built-in | Awkward |
| Weekly downloads | 3.8M **[VERIFIED]** | 2.9M **[VERIFIED]** |
### ⚠️ Gotcha: changesets + OIDC trusted publishing
## Testing strategy
### Vitest 4 `test.projects` — one config, two environments
### The core project must actively prove the no-DOM guarantee
### jsdom, not browser mode — and why this is the unsettled one
- React StrictMode double-mount producing a stale unsubscriber
- Vue HMR remount
- Svelte remount
- Getter-based snapshots reading through *after* re-render
### The Svelte 5 rune constraint
## Peer dependency strategy
### Ranges
| Package | peerDependencies | Rationale |
|---|---|---|
| `concierge-react` | `{ "react": "^18.2.0 \|\| ^19.0.0" }` | Matches `@tanstack/react-query`'s `^18 \|\| ^19` and `@testing-library/react`'s peer range exactly **[VERIFIED]**. React 18 still has large installed base. |
| `concierge-vue` | `{ "vue": "^3.5.0" }` | Vue 2 is EOL (Dec 2023). Do **not** adopt `vue-demi` for Vue 2 support — TanStack still carries it and it's pure legacy tax. ⚠️ Vue 3.6 is at `rc.2` **[VERIFIED]** — widen to `^3.5.0 \|\| ^3.6.0` once it ships. |
| `concierge-svelte` | `{ "svelte": "^5.0.0" }` | Runes are Svelte 5-only; the bridge getter contract depends on them. |
| `concierge-server` | none | Fetch-standard — no framework peer at all. That's the whole point. |
### Core-to-adapter linkage — the important one
### Testing across peer majors
## Publishing
### npm trusted publishing (OIDC) — adopt from day one
- npm CLI **≥ 11.5.1**, Node **≥ 22.14.0** (CI-side only)
- GitHub Actions, GitLab CI, or CircleCI — on their hosted runners
- `permissions: { id-token: write }`
- **No `NPM_TOKEN`**
- **Provenance attestations are generated automatically** for public repos on GH Actions/GitLab — `--provenance` is not needed. (Not supported on CircleCI.)
### `publishConfig.access`
### CI gates before publish
### JSR: not for v0.1
- A second registry means a second manifest (`jsr.json`), a second release path in CI, and a second place for version skew — real overhead for a pre-alpha with zero users.
- npm trusted publishing already provides provenance, so JSR's headline security benefit is duplicated.
- The scarce resource at v0.1 is shipping the consent kernel, not distribution breadth.
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
## Stack Patterns by Variant
- Keep the inlined types, but move them to `src/standard-schema.ts` and **add `@standard-schema/spec` as a `devDependency`** with a type-level conformance test (`expectTypeOf`) asserting the inlined interface still accepts real Zod/ArkType/Valibot schemas.
- Without that test the copy drifts — it already has, in four places.
- Add `format: ["esm", "cjs"]` to tsdown, keep `dts: true`. Verified to emit `.d.cts`/`.d.ts` pairs cleanly **[VERIFIED]**.
- ⚠️ CJS forces `platform: "node"`, overriding `platform: "neutral"`.
- Then audit all module-level state in core for dual-package hazard before shipping it.
- That package alone gets `@vitest/browser-playwright` — WebRTC, `getUserMedia`, and audio-playback-completion (the `perceived` consent grade) cannot be tested in jsdom.
- This is also the package where `consentGrade: "perceived"` needs real-browser evidence, so the cost is justified there and only there.
- Revisit Turborepo, and generate adapter test suites from one shared conformance spec so the bridge-getter contract is tested identically across frameworks rather than re-hand-written per adapter.
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
## Open Questions / Genuinely Unsettled
## Sources
- tsdown 0.22.14 dual-format build + `attw --pack` + `publint` matrix
- TS 7.0.2 dts generation with and without `isolatedDeclarations` (timing + warning)
- `packages/concierge/src/types.ts` compiling clean under TS 7 + `isolatedDeclarations` + full repo strict flags
- `lib: ["ES2022"]` rejecting `document`; real `AbortSignal` → `AbortSignalLike` assignability
- `~standard.jsonSchema` probe across zod@4.4.3, valibot@1.4.2, arktype@2.2.3
- `z.discriminatedUnion` root-type reproduction
- `@standard-schema/spec@1.1.0` unpacked: 0-byte ESM runtime, zero deps, attw-clean
- `/rolldown/tsdown` — dual-format config, `publint`/`attw` options, `platform` semantics, CJS platform limitation
- `/vitest-dev/vitest` — `test.projects`, `defineProject`, multi-environment configuration
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ — GA date, no-API caveat, removed options
- https://tsdown.dev/options/dts, /options/package-exports, /guide/ — dts strategy, exports generation
- https://standardschema.dev/ and /json-schema — spec purpose and interface
- https://docs.npmjs.com/trusted-publishers/ — OIDC requirements, automatic provenance
- https://pnpm.io/catalogs — default + named catalogs, `catalog:` protocol
- https://vitest.dev/guide/migration, /guide/browser/ — Vitest 4 breaking changes, browser providers
- https://svelte.dev/docs/svelte/testing — official Svelte testing stance, `.svelte.test` naming, `$effect.root`/`flushSync`
- https://www.typescriptlang.org/tsconfig/#module — `node20`, `nodenext`, `preserve` semantics
- https://raw.githubusercontent.com/nodejs/Release/main/schedule.json — Node 20 EOL 2026-04-30
- Version and last-modified timestamps for all packages cited
- Weekly download counts via `api.npmjs.org/downloads`
- `changesets/changesets#2099`, `#1914` — OIDC publish failures, state and close dates
- `@tanstack/*` peer dependency shapes as prior art
- tsdown-as-tsup-successor positioning; `require(esm)` backport history; JSR adoption estimates; Turborepo threshold guidance. Download counts and maintenance dates were verified directly against npm rather than taken from search results.
## Appendix: Empirical Verification
# 1. tsdown dual-format build → correct .d.ts/.d.cts, attw matrix
#    Result: node16 CJS/ESM/bundler all 🟢; node10 💀 on subpath (expected)
# 2. TS 7 dts path — the isolatedDeclarations difference
#    Without: "WARN TypeScript 7.0 does not yet have a stable API" — 1064ms
#    With:    no warning — 25ms
# 3. Concierge's real type surface under TS 7 + isolatedDeclarations + repo strict flags
#    Result: PASS, unmodified
# 4. no-DOM enforcement
#    Result: error TS2584: Cannot find name 'document'.
# 5. Standard JSON Schema adoption probe
#    zod     : vendor=zod      jsonSchema=true
#    valibot : vendor=valibot  jsonSchema=false   ← contradicts standardschema.dev docs
#    arktype : vendor=arktype  jsonSchema=true
#    discriminatedUnion root type is 'object'? => false   ← README pitfall reproduces
# 6. @standard-schema/spec is genuinely types-only
#    Result: dist/index.js is 0 bytes; "deps: none"
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
