# Phase 3: Action declaration and build-time validation - Research

**Researched:** 2026-07-29
**Domain:** TypeScript type-level constraint design; Standard Schema / Standard JSON Schema interop; build-time catalog validation
**Confidence:** HIGH (almost every claim below was measured in this session against the installed toolchain, not recalled)

## Summary

Everything this phase needs is achievable, and the two things most likely to have blocked it do not.
CAT-07 **is** enforceable at the type level against the current `ActionDefinition`, the error **can** name
the offending action and state the fix in terse non-TTY `tsc` output, and it costs nothing measurable
(50 guarded actions typecheck in 0.10 s). The `~standard.jsonSchema` situation Phase 1 recorded is
unchanged on today's published packages: zod 4.4.3 and arktype 2.2.3 implement it, **valibot 1.4.2 does
not**, so the `jsonSchema` escape hatch is still the only working path for one of three target validators.

Three measured results change the shape of the plan rather than merely confirming it.

**First, the obvious CAT-07 guard is wrong.** `string extends D ? reject : accept` — the formulation the
literature reaches for — lets `` `Tenant ${tenant} filter.` `` straight through, because a template literal
expression interpolating a `string` does not widen to `string`; it infers the *pattern type*
`` `Tenant ${string} filter.` ``, and `string extends <pattern>` is false. Per-tenant interpolation is
precisely the vector CAT-07 exists to block, so the naive guard would have shipped with its central case
open. A SIX-branch predicate closes every `${string}` hole position; a residual `${number}`/`${bigint}` gap
is documented below and is not closable with any predicate I could construct.

**Second, `Object.freeze` on the catalog array does not satisfy SEC-03.** Measured: with the array frozen
and the element objects not, `catalog[0].handler = attackerFn` succeeds *silently* in ESM strict mode and
the replacement handler runs. SEC-03's whole claim — "a handler cannot be replaced at runtime by
third-party page script" — requires a recursive freeze.

**Third, `console` is not type-visible under `lib: ["ES2022"]`.** The CONTEXT decision that diagnostics
"additionally warn on the console by default" is a TS2304 as written, the same class of problem as the
deferred `setTimeout`/`Scheduler` item already in STATE.md. A structural `globalThis` read — the pattern
`contract.ts` already uses for its registry — compiles clean and is the fix.

**Primary recommendation:** put the CAT-07 guard on `defineAction` using the conditional-typed
`description` property (measured to produce a TS2322 whose *expected type is the error sentence itself*,
printed verbatim in non-TTY output), keep `ActionDefinition` unamended unless the planner also wants
`buildCatalog` to re-check — that second check is the only thing that forces the Phase 1 amendment, and
the amendment's lowest-churn form is a sixth type parameter `Description extends string = string` in last
position, which leaves all five existing positional usages compiling untouched.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**What "build-time" means**

- **Validation runs inside `buildCatalog()`, a runtime function called at module init.**
  CAT-02, CAT-03, and CAT-04 are all worded "catalog build throws", and `types.ts:874`
  already names `buildCatalog` as the owner. Rejected: a separate CLI step or a bundler
  plugin — both add a toolchain dependency for consumers and neither is implied by the
  requirement wording.

- **CAT-07 (descriptions must be static string literals) is enforced at the type level,
  not at runtime.** This is the one requirement in the phase that runtime *cannot*
  satisfy: a description assembled from i18n or CMS content is byte-identical at runtime
  to one written as a literal. The compiler can tell them apart — a widened `string`
  versus a literal type — and nothing else can. Constrain the `description` position so a
  non-literal is a type error naming the action. Rejected: a lint rule (ships nothing to
  consumers who do not adopt it) and documenting the constraint without enforcing it
  (which is what the requirement explicitly forbids).
  - **Planner note:** verify this is achievable against the *current* `ActionDefinition`,
    whose `description` is declared plainly as `string` (`types.ts:929`). If enforcing it
    requires widening the declared type surface, that is a Phase 1 amendment and must be
    called out, not performed silently. Nothing has published yet, so the amendment is
    free — but it must be visible.

- **Errors aggregate; `buildCatalog` throws once carrying all of them.** A developer
  declaring twenty actions should see twenty problems in one run, not fix-rebuild twenty
  times. Rejected: throw on first failure.

- **A named error class carrying structured issues, not a formatted string.** DX-03
  requires every build-time error to name the offending action *and* state the fix, which
  is two fields plus a code — that wants structure. A formatted-string-only error makes
  the requirement untestable except by substring matching.

**Warnings versus errors**

- **`destructive`-without-consent and `readsUntrusted`-without-consent both report
  through a diagnostics array returned on the built catalog, and additionally warn on the
  console by default.** The roadmap's SC-3 is explicit that these must "report
  themselves" without blocking, because a consent policy can legitimately live a layer up.
  A `console.warn` alone is an annotation nothing reads and nothing can test; a returned
  array is assertable. Rejected: console-only.

- **Severity is configurable through an `onDiagnostic` hook, defaulting to warn.** An app
  that wants `destructive`-without-consent to be fatal can make it fatal in its own build
  without Concierge choosing that for everyone. This is the mechanism that keeps SEC-05's
  taint marker from being "an annotation nothing reads" — the exact failure the Phase 1
  doc comment (`types.ts:977-984`) warns about.

- **Both markers report in the same shape with different codes.** Roadmap SC-3b says
  `readsUntrusted` must report "the same way" as `destructive`. Same shape, distinct code,
  so a consumer can filter one without the other.

- **One diagnostic per offending action, each naming its action.** Rejected: a single
  aggregated summary line, which loses the name DX-03 requires.

**Schema emission**

- **Emission order is: explicit `jsonSchema` escape hatch → `~standard.jsonSchema.input(...)`
  → throw naming the action *and* the vendor.** Locked by the ROADMAP Notes for this phase.
  The vendor must be in the message because the failure is a property of the validator, not
  of the developer's declaration, and without the vendor name the developer cannot tell
  which of those two it is.

- **`.input(...)` specifically, never `.output()`.** A schema carrying a transform or a
  default emits a different schema in each direction, and tool calling needs the side the
  agent must produce. Roadmap-locked.

- **Re-probe the installed validator packages rather than reading the spec site.**
  Standard JSON Schema is implemented by Zod and ArkType but *not* by Valibot as published,
  despite documentation claiming otherwise. Phase 1 verified this empirically
  (`types.ts:931-937`) and the ROADMAP Research note flags that trusting the docs "would
  have deleted the escape hatch that is the only working path for one of three target
  validators."

- **A schema whose emitted root is not `type: "object"` throws, naming the action.**
  Reproduced on current Zod via `z.discriminatedUnion`, so this is a live trap and not a
  hypothetical. Rejected: warn and coerce, which would silently ship a catalog the agent
  cannot call.

**`defineAction`, freezing, and the single-instance call site**

- **`defineAction` is an identity function — inference only, zero runtime validation.**
  Every check lives in `buildCatalog`, so there is exactly one place to audit and one place
  a check can be forgotten. Rejected: validating eagerly at declaration, which splits the
  rules across two functions and makes "did we check X?" a two-file question.

- **`assertSingleInstance` is called on the first line of `buildCatalog`.** This closes
  ROADMAP Phase 3 SC-5, added from `02-VERIFICATION.md` finding W5: Phase 2 shipped the
  guard with no production call site at all. `buildCatalog` is the earliest entry point
  every consumer necessarily reaches. Rejected: calling it from `defineAction` (runs once
  per action, so it would fire N times) and a module-scope call — 02-06 *measured* that a
  module-scope registration is deleted from consumer bundles under `sideEffects: false`,
  so it would test green and do nothing in every real app.

- **The catalog is frozen after build, closing SEC-03 here rather than in Phase 6.**
  SEC-03 is nominally a later requirement, but `buildCatalog` is the only place a freeze
  can happen and it is being written now. Freezing is free today and a breaking change
  after publish. If the planner finds this genuinely conflicts with Phase 4's `catalogFor`
  memoization, defer it and say so — do not silently drop it.

- **`buildCatalog` returns a new frozen catalog rather than mutating its input.** STG-04
  already requires `catalogFor` to return a memoized frozen array, so the phase is
  freeze-shaped already.

### Claude's Discretion

- Internal module layout, file names, and the split between validation rules and the
  catalog assembly they run inside.
- Diagnostic code naming scheme, provided codes are stable strings and distinct per rule.
- Whether validation rules are expressed as a table of small functions or inline — as long
  as adding a rule is a one-place change.

### Deferred Ideas (OUT OF SCOPE)

- **Stage matching, `catalogFor`, and `explain()`** — Phase 4. This phase builds a catalog;
  it does not scope one to a stage or explain why an action was absent.
- **CAT-03 (consent target exists) and CAT-04 (grade ceiling)** — both are catalog-build
  checks but are assigned to later phases in REQUIREMENTS.md. Flagged for the planner to
  resolve ownership rather than silently absorb.
- **T-02-44** — `scripts/node-floor-check.sh` executes a Node runtime downloaded from
  nodejs.org/dist with no checksum verification. Accepted for v0.1; confirmed not invoked
  from CI. Remediation is larger than the "two-line change" originally claimed: the
  `curl | tar` pipe must materialise the `.tar.xz` first, and `SHASUMS256.txt` is itself
  unsigned-checked without `.sig`.
- **The `mutate-and-prove.sh` lockfile hazard** — preventive remedy known and verified;
  the harness itself has not been patched.
- **First CI run and first publish-attestation check** — `ci.yml` and `release.yml` have
  never executed. Phase 2 verification was `human_needed` on exactly this, and the user
  accepted tarball-level evidence for v0.1.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CAT-01** | Declare once; name set, literal union type, per-stage catalogs, emitted JSON Schema and redaction policy all derived | Measured: the literal name union requires a **`const` type parameter** on `buildCatalog`. `readonly ActionDefinition[]` yields `string`; `const A extends readonly AnyActionDefinition[]` yields `"action00" \| … \| "action49"` across 50 actions. See *Pattern 2*. |
| **CAT-02** | Build throws, naming the action, when emitted JSON Schema root is not `type: "object"` | Reproduced on zod 4.4.3: `z.discriminatedUnion` emits `{$schema, oneOf:[…]}` with **no root `type`**. Also `z.union`/arktype `.or`/valibot `v.union` → `anyOf`, `v.variant` → `oneOf`. Non-object roots measured for `z.string()`, `z.array()`, `z.record()`. See *Pitfall 3*. |
| **CAT-05** | Build emits a warning when `effects.destructive` carries no consent policy | Diagnostics array + `onDiagnostic` hook prototyped end-to-end. `console` needs the structural `globalThis` read — see *Pitfall 6*. |
| **CAT-06** | Explicit `jsonSchema` used in preference to derivation | Escape hatch measured as the only working path for valibot 1.4.2. `@valibot/to-json-schema@1.7.1` emits **draft-07**, not draft-2020-12 — see *Open Question 2*. |
| **CAT-07** | Descriptions rejected at build time if not static string literals at module scope | Fully measured. Achievable without amending `types.ts`; error names the action and states the fix; full accept/reject matrix and one residual gap documented in *Pattern 1* and *Pitfall 1*. |
| **SEC-01** | Redaction required for any action with a non-empty schema; unspecified defaults to `drop` | Type already makes `redact` mandatory (`types.ts:939`, no `?`). Runtime half: detect "non-empty" as `Object.keys(params.properties ?? {}).length > 0` — **arktype emits no `properties` key at all** for an empty object, zod emits `properties: {}`. Measured. |
| **SEC-05** | `readsUntrusted` without consent policy is reported at build | Same diagnostic shape as CAT-05, distinct code. Prototyped. |
| **DX-03** | Every build-time error names the offending action and states the fix | Measured for both halves: the runtime `CatalogValidationError` (prototyped, one line per issue, each naming action + fix), and the compile-time CAT-07 error (TS2322 whose expected type *is* the sentence, printed verbatim in terse non-TTY output). |

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md`. The planner must verify compliance; several are
directly load-bearing for this phase.

| Directive | Bearing on Phase 3 |
|-----------|--------------------|
| **Core is dependency-free** (only `@standard-schema/spec`, a 0-byte runtime) | The Standard JSON Schema converter shape must be declared **structurally in core**, not imported. `@standard-schema/spec@1.1.0` *does* export `StandardJSONSchemaV1`, but `StandardSchemaV1` is a sibling, not a supertype — see *Pitfall 4*. |
| **No top-level `window` / `document` / `navigator`; `lib: ["ES2022"]`, no DOM types** | `console` is **not** type-visible. Measured TS2584. See *Pitfall 6*. |
| **No top-level `await`** | `buildCatalog` is synchronous. `~standard.jsonSchema.input()` is synchronous in both zod and arktype (measured). No async path is needed. |
| **ESM-only; exactly one core instance** | `assertSingleInstance()` on the first line of `buildCatalog` (ROADMAP SC-5). Never at module scope — `sideEffects: false` deletes it. |
| **Redaction required for any non-empty schema, defaults to `drop`** | SEC-01. Fail closed. |
| **Handler exceptions never reach model or telemetry** | Not this phase (Phase 6), but note `buildCatalog`'s *build-time* errors are developer-facing and are explicitly exempt from the one-generic-sentence rule (`contract.ts:135-138` states the precedent). |
| **`isolatedDeclarations: true`** | Exported consts holding a `defineAction(...)` result need an explicit annotation or TS9010. Measured — affects test files and consumer DX. |
| **Adapters ~150 LOC; logic leaking out of core is a core bug** | No adapter work here. |
| Global rule: **never add Co-Authored-By / AI attribution to commits** | Applies to every commit this phase makes. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Literal-description enforcement (CAT-07) | **TypeScript compiler (build)** | — | Runtime cannot distinguish an i18n-derived description from a literal; they are byte-identical. Only the type system sees the difference. |
| Action name → literal union derivation (CAT-01) | **TypeScript compiler (build)** | — | Requires a `const` type parameter; no runtime component. |
| Schema emission + root-type check (CAT-02, CAT-06) | **Core, module-init runtime** | — | Depends on the validator instance, which only exists at runtime. |
| Redaction defaulting (SEC-01) | **Core, module-init runtime** | TypeScript compiler | Type makes `redact` mandatory for TS consumers; runtime fails closed for JS consumers. Both halves needed. |
| Warning markers (CAT-05, SEC-05) | **Core, module-init runtime** | Host console (optional) | Structural declaration data; the diagnostics array is the assertable surface, console output is the optional courtesy. |
| Catalog freeze (SEC-03) | **Core, module-init runtime** | — | `Object.freeze` is a runtime operation; `readonly` types are erased. |
| Single-instance guard (PKG-04 call site) | **Core, module-init runtime** | — | Must be inside a function body — module scope is tree-shaken under `sideEffects: false` (02-06 measured). |
| Aggregated error reporting (DX-03) | **Core, module-init runtime** | TypeScript compiler | Two independent error channels: `CatalogValidationError` at runtime and TS2322 at compile time. Both must satisfy DX-03 independently. |

**Nothing in this phase belongs to a browser, server, CDN or database tier.** The whole phase is core
library code plus compiler-level types. That is worth stating because `buildCatalog` is called at
*module init in the consumer's app*, which runs on the server under Next/Nuxt/SvelteKit — so every
constraint about DOM-free construction applies to it in full.

## Standard Stack

### Core

No new runtime dependency. The phase adds source files to `packages/concierge` and nothing else.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@standard-schema/spec` | `1.1.0` (installed) | Type-only schema interop | Already a dependency. `dist/index.js` is 0 bytes. **Exports `StandardJSONSchemaV1`** — see *Pitfall 4* for why it still cannot be used directly here. [VERIFIED: read from `node_modules/.pnpm/@standard-schema+spec@1.1.0/.../dist/index.d.ts` this session] |
| `typescript` | `7.0.2` (installed) | The CAT-07 enforcement mechanism | Every measurement below is against this exact compiler. [VERIFIED: `tsc --version`] |
| `vitest` | `4.1.10` (installed) | Runtime rules (`test/*.test.ts`) | Already wired; 4 files / 15 tests green. [VERIFIED: `pnpm test`] |

### Supporting — test-only, and only if the planner wants real-validator coverage

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `4.4.3` | Prove the `~standard.jsonSchema.input()` path and the CAT-02 `discriminatedUnion` trap against a real validator | **Recommended.** CAT-02's trap is a property of a real emitter; a hand-rolled stub proves only that the check reads a field. |
| `arktype` | `2.2.3` | Prove the second Standard-JSON-Schema vendor, and the `options`-required behaviour | Recommended. ArkType throws where zod tolerates — see *Pitfall 5*. |
| `valibot` | `1.4.2` | Prove the *negative*: a vendor with no `~standard.jsonSchema`, exercising CAT-06 | Recommended. This is the requirement's whole reason to exist. |
| `@valibot/to-json-schema` | `1.7.1` | Produce the escape-hatch schema in the valibot fixture | Optional — a hand-written literal `jsonSchema` object works equally well and adds no dependency. |

**Alternative to all four:** hand-roll `StandardSchemaV1` fixtures (a ~15-line object literal; a working
one is in *Code Examples*). Zero dependencies, zero lockfile churn, but it cannot reproduce
`z.discriminatedUnion`'s missing root `type` — you would be asserting that your check reads a field you
yourself wrote. **Recommendation: hand-roll for `test-d/` (type-level, where the program is typechecked
and a dependency is real risk), install the real validators as `devDependencies` for `test/` (runtime,
which is in no TypeScript program anyway — `vitest.config.ts` documents this).**

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Conditional-typed `description` property (F2d) | Parameter-level intersection brand (F2c) | Also names the action and states the fix (measured), but reports TS2345 at the *whole argument* rather than TS2322 at the `description` property. Less precise caret; equally compliant. |
| Conditional-typed `description` property | Property-level intersection with a named alias (F2b) | **Rejected — measured to print the alias name, not the message.** `Type 'string' is not assignable to type 'string & ErrObj'.` names no action. Fails DX-03. |
| Conditional-typed `description` property | Rest-tuple arity guard (F2e) | **Rejected — measured `TS2554: Expected 2 arguments, but got 1.`** Names nothing. Fails DX-03. |
| Guard on `defineAction` only | Guard on `defineAction` **and** `buildCatalog` | Closes the bypass (declaring a raw object literal without `defineAction`) — measured to work — but **requires the `types.ts` amendment**, because `defineAction`'s current return type widens `description` to `string` and would false-positive on its own output. See *Open Question 1*. |
| `Object.freeze(entries)` | Recursive freeze | **Not an alternative — the shallow form does not satisfy SEC-03.** Measured. |
| `AggregateError` | A custom `CatalogValidationError` carrying `issues` | `AggregateError` is available under `lib: ["ES2022"]` (measured) but its `errors` are `Error` objects, so the structured `{code, action, problem, fix}` shape CONTEXT requires would have to be stuffed into message strings. Custom class recommended. |

**Installation (only if real-validator fixtures are adopted):**

```bash
pnpm --filter @fullselfbrowsing/concierge add -D zod@4.4.3 arktype@2.2.3 valibot@1.4.2
```

> ⚠️ This rewrites `pnpm-lock.yaml`. Any `mutate-and-prove.sh` run whose gate can trigger an install
> must use `pnpm --config.verify-deps-before-run=false <gate>`; the harness restores only its
> `$TARGET` and reports "tree clean" while the lockfile is dirty. `CI=true`/`--frozen-lockfile` is
> **actively wrong** — it produces a vacuously-green PASS. (Verified this session: the remedy leaves
> `git status --porcelain` empty.)

## Package Legitimacy Audit

Run this session with `slopcheck` 0.6.1 plus direct `npm view` registry verification.

| Package | Registry | Latest | Last modified | Source Repo | postinstall | slopcheck | Disposition |
|---------|----------|--------|---------------|-------------|-------------|-----------|-------------|
| `zod` | npm | 4.4.3 | 2026-05-04 | github.com/colinhacks/zod | none | `[OK]` | Approved |
| `valibot` | npm | 1.4.2 | 2026-06-28 | github.com/open-circle/valibot | none | `[OK]` | Approved |
| `arktype` | npm | 2.2.3 | 2026-07-07 | github.com/arktypeio/arktype | none | `[OK]` | Approved |
| `@valibot/to-json-schema` | npm | 1.7.1 | 2026-06-08 | github.com/open-circle/valibot | none | `[OK]` | Approved (optional) |

**Packages removed due to slopcheck `[SLOP]` verdict:** none
**Packages flagged `[SUS]`:** none

All four resolve on npm at the versions the project's own `CLAUDE.md` technology stack already names,
and all four were independently installed and executed in a scratch directory this session — every
behavioural claim in this document was produced by running them, not by reading about them.

> ⚠️ **Do not run `slopcheck install <pkgs>` from the repository root.** It runs a real
> `npm install` in the current working directory. In this session it left the tree clean (verified:
> `git status --porcelain` empty, no `package-lock.json`, no validator in `node_modules/`), but that
> is luck, not design — this is a pnpm workspace and an `npm install` in it is a hazard. Use
> `slopcheck scan` or run it from a scratch directory.

## Architecture Patterns

### System Architecture Diagram

```
        DEVELOPER SOURCE                          COMPILE TIME (tsc)
   ┌──────────────────────────┐             ┌────────────────────────────┐
   │ defineAction({           │             │  LiteralDescription<N, D>  │
   │   name: "applyFilter",   │──inference──▶  IsNotConcrete<D>?         │
   │   description: "...",    │             │    yes → error sentence    │
   │   schema, redact,        │             │          naming N + fix    │
   │   handler, effects,      │◀──TS2322────│    no  → D passes through  │
   │   readsUntrusted,        │             └────────────────────────────┘
   │   consent, jsonSchema?   │                (CAT-07, half of DX-03)
   │ })                       │
   └───────────┬──────────────┘
               │  identity at runtime — zero validation
               ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  buildCatalog(actions)          MODULE INIT, in the consumer app │
   │                                                                   │
   │  0. assertSingleInstance()   ◀── first line. PKG-04 call site.    │
   │                                                                   │
   │  for each action:                                                 │
   │    1. duplicate name?  ──────────────────────────▶ issue          │
   │    2. SCHEMA EMISSION (ordered, locked)                           │
   │         a. action.jsonSchema present? ─── use it ─────┐  CAT-06   │
   │         b. schema["~standard"].jsonSchema?            │           │
   │              .input({target})  ── may THROW ──▶ issue │           │
   │         c. neither ──▶ issue naming action AND vendor │           │
   │                                                       ▼           │
   │    3. root type === "object"?  ── no ──▶ issue        params      │
   │                                          (CAT-02)     │           │
   │    4. properties non-empty && redact absent           │           │
   │              ──▶ redact = "drop"  (SEC-01, closed)    │           │
   │    5. effects.destructive && !consent ──▶ diagnostic  │  CAT-05   │
   │    6. readsUntrusted    && !consent ──▶ diagnostic    │  SEC-05   │
   │                                                       │           │
   │  issues.length > 0 ──▶ throw ONE CatalogValidationError           │
   │                        carrying every issue            (DX-03)    │
   │                                                       │           │
   │  diagnostics ──▶ onDiagnostic?.(d)  ── default: host console.warn │
   │                                                       │           │
   │  deepFreeze({entries, byName, diagnostics})  ◀── SEC-03, recursive│
   └───────────────────────────┬───────────────────────────────────────┘
                               ▼
              frozen Catalog  ──▶  Phase 4 catalogFor / explain()
                              ──▶  Phase 7 session → transport setTools
                              ──▶  Phase 8 consent grade gate
```

### Component Responsibilities

| File (suggested) | Responsibility | Why separate |
|------------------|----------------|--------------|
| `src/define-action.ts` | `defineAction`, `LiteralDescription`, `IsNotConcrete` | The CAT-07 guard is pure type machinery with **zero runtime**; keeping it out of `catalog.ts` means the runtime file contains no dead type exports and the guard's mutants are scoped to one file. |
| `src/json-schema.ts` | Structural converter types, `hasJsonSchemaConverter`, `emitSchemaFor` | The emission order is the one piece with three branches and an exception path; isolating it makes "did we check the escape hatch first?" a one-file question. |
| `src/catalog.ts` | `buildCatalog`, the rule table, `CatalogValidationError`, `deepFreeze` | CONTEXT: "exactly one place to audit and one place a check can be forgotten." |
| `src/index.ts` | New exports | `export-surface.test.ts` pins **45 names / 39 types / 6 values** and `test-d/exports.test-d.ts` pins them again. Both must move in the same commit. |

### Pattern 1: The CAT-07 literal-description guard

**What:** A conditional type in the `description` slot whose *rejection branch is the error sentence
itself*, so `tsc`'s "Type X is not assignable to type Y" prints the message verbatim.

**When to use:** the `defineAction` parameter type. Nowhere else — see the inference trap in
*Pitfall 2*.

```ts
// MEASURED against typescript@7.0.2 with the repo's exact flags
// (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride,
//  verbatimModuleSyntax, isolatedModules, isolatedDeclarations, lib ES2022).

/**
 * True when `D` is the widened `string` OR a template-literal PATTERN carrying a
 * `${…}` hole, rather than one concrete literal.
 *
 * SIX branches, and each catches a hole position the others miss. (An earlier draft of this
 * comment said "five" while listing six; six is correct and the listing below is the authority.)
 * Measured:
 *   string extends D        -> fully widened            (`i18n(k)`, `let`, `as string`)
 *   `~${D}` extends D       -> LEADING hole             (`${tenant} filter.`)
 *   `${D}~` extends D       -> TRAILING hole            (`Filter for ${tenant}`)
 *   `${D}0` extends D       -> trailing numeric-ish hole
 *   `0${D}` extends D       -> leading numeric-ish hole
 *   `${D}${D}` extends D    -> INTERIOR hole            (`Tenant ${tenant} filter.`)
 * A concrete literal fails all six: prefixing, suffixing or doubling a concrete
 * string always yields a longer, therefore unassignable, string. Verified that a
 * description containing "~" or a digit is NOT a false positive.
 */
type HoleProbe<D extends string> =
  string extends D ? true
  : `~${D}` extends D ? true
  : `${D}~` extends D ? true
  : `${D}0` extends D ? true
  : `0${D}` extends D ? true
  : `${D}${D}` extends D ? true
  : false;

/**
 * Distributed so a UNION containing a pattern is rejected while a union of pure
 * literals is accepted. Measured: the undistributed form accepts
 * `` `A${string}` | "plain" ``, which is a hole.
 */
type IsNotConcrete<D extends string> =
  (D extends string ? HoleProbe<D> : never) extends false ? false : true;

type LiteralDescription<N extends string, D extends string> =
  IsNotConcrete<D> extends true
    ? `concierge CAT-07 — action "${N}": description must be a static string literal written at this declaration. Fix: replace the expression with the finished sentence in quotes. A description assembled from i18n, CMS, per-tenant text, or any runtime value is a tool-poisoning vector and is rejected here.`
    : D;

export declare function defineAction<
  N extends string,
  D extends string,
  S extends StandardSchemaV1,
  B = unknown,
  Snap = unknown,
  Ack = unknown,
>(
  def: Omit<ActionDefinition<N, S, B, Snap, Ack>, "description"> & {
    description: LiteralDescription<N, D>;
  },
): ActionDefinition<N, S, B, Snap, Ack>;
```

**Measured diagnostic** (terse, no TTY — exactly what CI sees):

```
probe/f13-integrated.ts(62,5): error TS2322: Type 'string' is not assignable to type
'"concierge CAT-07 — action \"cancelBooking\": description must be a static string literal
written at this declaration. Fix: replace the expression with the finished sentence in quotes.
A description assembled from i18n, CMS, per-tenant text, or any runtime value is a
tool-poisoning vector and is rejected here."'.
```

The caret lands on the `description` property (col 5), not the whole call. Under a forced TTY the
same run additionally prints the related-information line `The expected type comes from property
'description' which is declared here`.

**Measured accept/reject matrix** — 25 cases, all verified this session:

| Expression | `D` infers to | Verdict | Correct? |
|---|---|---|---|
| `"Inline literal."` | `"Inline literal."` | **accept** | ✓ |
| `CONST_DESC` where `const CONST_DESC = "…"` | literal | **accept** | ✓ |
| `"…" as const` | literal | **accept** | ✓ |
| `` `Backtick, no interpolation.` `` | literal | **accept** | ✓ |
| `` const T = `…`; T `` | literal | **accept** | ✓ |
| `IMPORTED_LITERAL` from `export const X = "…"` | literal | **accept** | ✓ (still statically reviewable) |
| `OBJ.desc` where `const OBJ = {…} as const` | literal | **accept** | ✓ |
| `flag ? "Branch A." : "Branch B."` | `"Branch A." \| "Branch B."` | **accept** | ✓ (finite, reviewable) |
| `` `Filter by ${PART}.` `` where `const PART = "facet"` | one concrete literal | **accept** | ✓ |
| `"Approximately ~10 results."` | literal | **accept** | ✓ (sentinel is not a false positive) |
| `i18n("k")` | `string` | **reject** | ✓ |
| `cms.copy` | `string` | **reject** | ✓ |
| `letDesc` where `let letDesc = "…"` | `string` | **reject** | ✓ |
| `annotated` where `const annotated: string = "…"` | `string` | **reject** | ✓ |
| `"…" as string` | `string` | **reject** | ✓ |
| `"Half " + "and half."` | `string` | **reject** | ✓ |
| `OBJ.desc` where `const OBJ = { desc: "…" }` (mutable) | `string` | **reject** | ✓ (property widens) |
| `IMPORTED_WIDE` from `export const X: string = "…"` | `string` | **reject** | ✓ |
| `` `Tenant ${tenant} filter.` `` (`tenant: string`) | `` `Tenant ${string} filter.` `` | **reject** | ✓ |
| `` `${tenant} filter.` `` | `` `${string} filter.` `` | **reject** | ✓ |
| `` `Filter for ${tenant}` `` | `` `Tenant ${string}` `` | **reject** | ✓ |
| `` `${a} and ${b}` `` (both `string`) | multi-hole pattern | **reject** | ✓ |
| `String("Converted.")` | `string` | **reject** | ✓ |
| `""` | `""` | **reject** | ✓ (empty description is invalid anyway) |
| `` `Show ${count} results.` `` (`count: number`) | `` `Show ${number} results.` `` | **ACCEPT** | ✗ **KNOWN GAP** |
| `` `Show ${big} results.` `` (`big: bigint`) | `` `Show ${bigint} results.` `` | **ACCEPT** | ✗ **KNOWN GAP** |
| `` `Show ${flag} results.` `` (`flag: boolean`) | `"Show false results." \| "Show true results."` | **accept** | ✓ (finite union) |

**The `${number}`/`${bigint}` gap is real and I could not close it.** Six candidate predicates were
measured against it — the five hole probes plus a recursive per-character walk — and every one
classifies `` `Show ${number} results.` `` as concrete. A targeted
`` D extends `${infer A}${number}${infer B}` `` decomposition does not match at all (measured: returns
`"nomatch"` for both the pattern *and* a concrete `"Show 10 results."`). The residual risk is narrow:
a numeric hole cannot carry prose, so it is not a tool-poisoning vector in the sense CAT-07 names —
but it should be **written down in the doc comment**, not discovered later.

**Rejected alternative — the recursive character walk.** It catches identical `${string}` cases and
nothing more, and it hits `TS2589: Type instantiation is excessively deep` at a 1000-character
description (measured: 800 chars OK, 1000 fails). TS2589 names no action and would violate DX-03 on a
long description. The O(1) probe form has no such limit.

**Cost:** 50 guarded actions plus the real `types.ts` typecheck in **0.10–0.11 s** wall (three runs).
The guard is free.

### Pattern 2: Literal name-union derivation (CAT-01)

```ts
// MEASURED: the `const` modifier is REQUIRED.
declare function buildCatalog<const A extends readonly AnyActionDefinition[]>(
  actions: A,
): Catalog<A[number]["name"]>;

// with `const`:    names -> "action00" | "action01" | … | "action49"
// without `const`
// (plain readonly ActionDefinition[] parameter):   names -> string
```

Measured across 50 actions. `AnyActionDefinition` works as the element constraint — its `any`-erasure
of `Snapshot`/`AckPayload` (documented at `types.ts:997-1011`) admits heterogeneous declarations, and
the `const` inference still recovers each element's concrete `name`.

> Note for any test asserting on this: `tsc` truncates large unions in diagnostics — the 50-name union
> printed as `"action00" | … | "action13" | ... 35 more ... | "action49"`.

### Pattern 3: Schema emission with narrowing

`StandardSchemaV1` does **not** declare `jsonSchema`. Reading `schema["~standard"].jsonSchema` is a
type error. The narrowing predicate below compiles clean under every repo flag with no `any`:

```ts
// MEASURED clean under isolatedDeclarations + exactOptionalPropertyTypes +
// noUncheckedIndexedAccess + strict, with lib: ["ES2022"] and no DOM.

export type JsonSchemaTarget =
  | "draft-2020-12" | "draft-07" | "openapi-3.0" | (string & {});

export interface JsonSchemaConverterOptions {
  readonly target: JsonSchemaTarget;
  readonly libraryOptions?: Record<string, unknown> | undefined;
}

export interface JsonSchemaConverter {
  readonly input: (options: JsonSchemaConverterOptions) => Record<string, unknown>;
  readonly output: (options: JsonSchemaConverterOptions) => Record<string, unknown>;
}

export function hasJsonSchemaConverter(
  schema: StandardSchemaV1,
): schema is StandardSchemaV1 & {
  readonly "~standard": { readonly jsonSchema: JsonSchemaConverter };
} {
  const std: unknown = schema["~standard"];
  if (typeof std !== "object" || std === null) return false;
  const converter: unknown = (std as Record<string, unknown>)["jsonSchema"];
  if (typeof converter !== "object" || converter === null) return false;
  return typeof (converter as Record<string, unknown>)["input"] === "function";
}
```

`vendorOf(schema)` is just `schema["~standard"].vendor` — reachable without narrowing, which matters
because the vendor must appear in the *failure* message (CONTEXT lock).

### Anti-Patterns to Avoid

- **`string extends D ? reject : accept` on its own.** Measured to accept every interpolated template.
  This is the formulation that looks right and has an open centre.
- **A named type alias in the rejection branch.** `type ErrObj = {...}` prints as `ErrObj`, not as its
  contents. The message must be an inline template literal type or DX-03 fails.
- **Inferring `D` from more than one position.** `types.ts:478-487` records this exact defect being hit
  in Phase 1: typing `ConsentPolicy.requires` as the action's own `Name` made `Name` infer from *two*
  sites and widened it to a union, "silently corrupting the name-union derivation the whole catalog
  depends on". `D` must appear only in `description`.
- **`Object.freeze(entries)` alone for SEC-03.** Measured to leave `entries[0].handler` writable.
- **`@ts-expect-error` as the CAT-07 assertion.** `test-d/_assert.ts` states the house rule: a directive
  suppresses *any* error on the following line and can pass green for the wrong reason. Reserved for
  object-literal freshness. Use `Expect<Equals<…>>` predicates — a working set is in *Code Examples*.
- **Calling `.output()` anywhere.** Measured to **throw** on any schema carrying a transform.
- **Calling `.input()` with no argument.** Measured: arktype throws a bare
  `TypeError: Cannot read properties of undefined (reading 'target')`.

## Runtime State Inventory

Not applicable — this phase is greenfield source addition, not a rename, refactor or migration. No
stored data, live service config, OS-registered state, secrets, or build artifacts carry any string
this phase changes.

One adjacent item, verified explicitly because it *looks* like build-artifact state: `packages/concierge/dist/`
is read at test time by `artifact.test.ts` and `export-surface.test.ts`, and both will go red until
`pnpm build` is re-run after new exports land. That is an ordering obligation in the plan
(`build` before `test`), not a migration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema generation from a validator | A per-vendor bridge (`concierge-zod`) | `~standard.jsonSchema.input({target})` + the `jsonSchema` escape hatch | Explicitly out of scope in REQUIREMENTS.md. Measured: two of three target validators emit natively; the third needs the hatch that already exists on the type. |
| Detecting "is this a string literal type" | A regex over the source, or a lint rule | The `IsNotConcrete<D>` predicate in *Pattern 1* | A lint rule ships nothing to consumers who do not adopt it (CONTEXT rejects it explicitly). A source regex cannot see through an import. |
| Deep object immutability | A `Proxy`-based frozen wrapper | Recursive `Object.freeze` skipping accessors | A Proxy changes identity, breaks `===` memoization that STG-04 requires, and adds a per-property trap on the dispatcher's hot path. |
| Multi-error reporting | Manual string concatenation at each throw site | One `CatalogValidationError` carrying `readonly CatalogIssue[]` | DX-03 needs `{action, fix}` as *fields*, not substrings, or the requirement is only testable by substring matching. |
| Reaching the host console from core | `import { console } from "node:console"` or `@types/node` | Structural `globalThis` read (*Pitfall 6*) | `@types/node` "pulls DOM-adjacent globals and silently defeats the no-DOM guarantee" — CLAUDE.md, What NOT to Use. |
| Validating that a value is a `JsonSchemaObject` | A JSON Schema meta-validator | `value.type === "object"` | CAT-02 asks exactly one question. A meta-validator is a dependency and a new failure mode. |

**Key insight:** every hand-rolled alternative in this phase trades a *measured, one-line* mechanism
for a dependency or a second source of truth. The phase's entire premise — "one declaration derives
everything" — is destroyed by any second registry, including a lint config.

## Common Pitfalls

### Pitfall 1: The naive literal guard has an open centre

**What goes wrong:** `string extends D ? Error : D` accepts `` `Tenant ${tenant} filter.` ``.
**Why it happens:** a template literal *expression* interpolating a `string`-typed value, contextually
typed by a parameter constrained to `string`, infers the **pattern type** `` `Tenant ${string} filter.` ``
— not `string`. `string extends <pattern>` is `false`, so the guard's condition never fires.
**Measured evidence:** `capture(\`Tenant ${tenant} filter.\`)` produced
`` Type '`Tenant ${string} filter.`' is not assignable to type '1'. ``
**How to avoid:** the six-branch `HoleProbe` in *Pattern 1*.
**Warning signs:** a CAT-07 test suite whose only negative case is `i18n(k)`. That case passes with the
broken guard.

### Pitfall 2: Inferring `D` from two positions corrupts the name union

**What goes wrong:** a type parameter that appears in more than one property widens to the union of
what each site supplies.
**Why it happens:** TypeScript collects candidates from every inference site and unions them.
**Measured evidence:** this is not hypothetical — `types.ts:478-487` documents the identical defect
being hit in Phase 1 with `Name`, and records the fix (drop the cross-reference, check at build).
**How to avoid:** `D` appears only in `description`. Do not "reuse" it for a `title`, an `id`, or a
message template argument.
**Warning signs:** `catalog.names` losing literal precision; a `Name` that resolves to a two-member
union when only one action was declared.

### Pitfall 3: The CAT-02 trap is not only `discriminatedUnion`

**Measured on the installed packages, target `draft-2020-12`:**

| Schema | Emitted root | Passes CAT-02? |
|---|---|---|
| `z.object({...})` | `{type:"object", properties, required}` | yes |
| `type({...})` (arktype) | `{type:"object", properties, required}` | yes |
| `z.discriminatedUnion(...)` | `{$schema, oneOf:[…]}` — **no `type`** | **no** |
| `z.union([...])` | `{$schema, anyOf:[…]}` — **no `type`** | **no** |
| arktype `.or(...)` | `{$schema, anyOf:[…]}` — **no `type`** | **no** |
| valibot `v.union` → hatch | `{anyOf:[…]}` | **no** |
| valibot `v.variant` → hatch | `{oneOf:[…]}` | **no** |
| `z.string()` | `{type:"string"}` | **no** |
| `z.array(...)` | `{type:"array", items}` | **no** |
| `z.record(k,v)` | `{type:"object", propertyNames, additionalProperties}` | yes |

**How to avoid:** the check is `emitted.type === "object"`, and the message must distinguish the two
failure shapes — "not typed at all (keys: `$schema`, `oneOf`)" versus `"string"`. A developer reading
`root is not "object"` on a `discriminatedUnion` will not know what to change; a message naming
`oneOf` tells them immediately.
**Warning signs:** an agent that silently loses every action in a stage. `types.ts:22-28` records the
downstream symptom: OpenAI Realtime rejects the *entire* session update.

### Pitfall 4: `@standard-schema/spec` exports `StandardJSONSchemaV1` — and it is still unusable here

**What goes wrong:** the obvious move is to import `StandardJSONSchemaV1` and narrow to it.
**Why it fails:** `StandardSchemaV1` and `StandardJSONSchemaV1` are **siblings**, both extending
`StandardTypedV1` — neither is a subtype of the other. `StandardSchemaV1.Props` has `validate` and no
`jsonSchema`; `StandardJSONSchemaV1.Props` has `jsonSchema` and no `validate`. A real zod schema
satisfies both, but the *declared* parameter type `Schema extends StandardSchemaV1` gives no access to
`jsonSchema` and the intersection has to be written by hand anyway.
**Measured evidence:** read from the installed
`node_modules/.pnpm/@standard-schema+spec@1.1.0/.../dist/index.d.ts` this session; the naive read
compiles to a type error (asserted in the probe).
**How to avoid:** declare the converter shape structurally in core (*Pattern 3*). Same policy
`AbortSignalLike` already follows.
**Also note:** `StandardJSONSchemaV1.Options.target` is **required**, not optional. The spec itself
forbids the no-argument call.

### Pitfall 5: `.input(options)` — options are mandatory, and vendors disagree about targets

**Measured:**

| Call | zod 4.4.3 | arktype 2.2.3 |
|---|---|---|
| `.input()` — no argument | works, defaults to draft-2020-12 | **throws `TypeError: Cannot read properties of undefined (reading 'target')`** |
| `{target:"draft-2020-12"}` | ✓ | ✓ |
| `{target:"draft-07"}` | ✓ | ✓ |
| `{target:"openapi-3.0"}` | ✓ (emits, no `$schema`) | **throws `ParseError`** |
| `{target:"draft-04"}` | ✓ | **throws `ParseError`** |
| `{target:"nonsense"}` | ✓ (silently emits!) | **throws `ParseError`** |

**How to avoid:** always pass `{ target }`; the only two targets both vendors support are
`"draft-2020-12"` and `"draft-07"`. Wrap the call in `try/catch` — the spec says the converter "may
throw", and arktype does. The catch must produce an issue naming the action **and** the vendor, which
is exactly what CONTEXT locks.
**Warning signs:** zod accepting a typo'd target and emitting a `$schema`-less object is a silent
divergence you will only notice on the arktype fixture.

### Pitfall 6: `console` does not exist under `lib: ["ES2022"]`

**What goes wrong:** CONTEXT decides diagnostics "additionally warn on the console by default".
Written directly, `console.warn(...)` in core is a compile error.
**Measured evidence:** an `@ts-expect-error` on `const _console = console;` did **not** report
TS2578 — meaning the error is real. Same for `structuredClone`.
**How to avoid** (measured clean):

```ts
interface ConsoleLike { warn: (...args: readonly unknown[]) => void }

function warnHost(message: string): void {
  const host: { console?: ConsoleLike } = globalThis as { console?: ConsoleLike };
  host.console?.warn(message);
}
```

This is the same structural-global pattern `contract.ts:146` already uses. `AggregateError`,
`Error(msg, {cause})`, `Object.hasOwn`, `Reflect.ownKeys` and `Reflect.getOwnPropertyDescriptor`
**are** all type-visible (measured).
**Related, already in STATE.md:** the identical problem was recorded for `setTimeout` and deferred to
Phase 6. If the planner wants a single seam for "host capabilities core reaches structurally", this is
the second instance and the moment to name the pattern.

### Pitfall 7: `Object.freeze` on the array is not SEC-03

**Measured, in ESM strict mode:**

```
1. array frozen                : true
2. element frozen (shallow?)   : false
3. handler after tamper attempt: REPLACED (SEC-03 BREACHED)
```

The assignment `catalog[0].handler = attackerFn` **did not throw** and the replacement handler ran.
Nested objects (`action.effects`, `action.consent`) are mutable even after the action itself is frozen.
**How to avoid:** recursive freeze. **Skip accessor properties** — walking through a getter would run
application code during catalog build, which is both a performance and a security surprise:

```ts
function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) {
    const d = Reflect.getOwnPropertyDescriptor(value, key);
    if (d === undefined) continue;
    if (!("value" in d)) continue;   // never read through a getter
    deepFreeze(d.value);
  }
  return value;
}
```

**Warning signs:** a SEC-03 test that only asserts `Object.isFrozen(catalog)`. That passes on the
breached form.

### Pitfall 8: `pnpm test -- <name>` does not filter (sixth reproduction)

Measured again this session:

| Command | Result |
|---|---|
| `pnpm test -- export-surface` | **4 files / 15 tests** — the whole suite |
| `pnpm test export-surface` | 1 file / 4 tests |

Use the bare form in every plan, verification block, and CI step.

### Pitfall 9: `tsc` exits **1**, not 2 — the harness comment is stale

Measured under typescript 7.0.2:

| Condition | Exit code |
|---|---|
| type error | **1** |
| clean | 0 |
| missing tsconfig | 1 |

`scripts/mutate-and-prove.sh:32` states "tsc exits 2 on diagnostics", and `02-02-PLAN.md:212` repeats
it. Every Phase 2 *measurement* recorded `exit 1` (`02-VERIFICATION.md` rows P4a, P8a, P9, P11), so the
prose is stale rather than the practice. Phase 3 mutant expectations must say `exit 1`.

### Pitfall 10: what terse `tsc` output does and does not carry

The trap as stated ("terse output carries `file:line` only") is *narrower* than it sounds, and getting
the distinction wrong costs a verification criterion either way. Measured:

| Assertion target | Present in terse (non-TTY) output? |
|---|---|
| `file(line,col): error TSxxxx:` | **yes** |
| The full "Type X is not assignable to type Y" text, including a template-literal type printed verbatim | **yes** — this is how CAT-07's message survives |
| The echoed source line and `~~~~` caret | **no** — TTY only |
| The `The expected type comes from property '…'` related-information line | **no** — TTY only |
| A type **alias name** for a failing `Expect<…>` predicate | **no** — TS2344 prints only `Type 'false' does not satisfy the constraint 'true'.` |

So: **grepping for the CAT-07 message text works**; grepping for a predicate's alias name never
matches. Assert predicates on exit code + `file:line`, or force a TTY with `script -q /dev/null`.

### Pitfall 11: `isolatedDeclarations` bites at the `defineAction` call site

**Measured:** `export const a = defineAction({...})` produces
`TS9010: Variable must have an explicit type annotation with --isolatedDeclarations`.
Affects this repo's own test files immediately, and any consumer who enables the flag. The annotation
is writable — `ActionDefinition<"applyFilter", typeof filterSchema>` — but it is verbose, and it is
worth a line in the README rather than a surprise. Non-exported consts are unaffected.

## Code Examples

### A dependency-free `StandardSchemaV1` fixture (for `test-d/`)

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";

export interface FilterArgs { key: string; value: string }

export const filterSchema: StandardSchemaV1<FilterArgs, FilterArgs> = {
  "~standard": {
    version: 1,
    vendor: "probe",
    validate: (value: unknown): StandardSchemaV1.Result<FilterArgs> => ({
      value: value as FilterArgs,
    }),
  },
};
```

### CAT-07 asserted in the house predicate style, with proven mutant sensitivity

`test-d/_assert.ts` forbids `@ts-expect-error` for this. Two assertion families are needed: the first
proves the guard *type* is right, the second proves `defineAction` actually *wires* it. A mutant that
deletes the guard from the parameter leaves the first family green.

```ts
import type { Expect, Equals, Assignable, Not } from "./_assert.js";

type Cat07Message<N extends string> =
  `concierge CAT-07 — action "${N}": description must be a static string literal…`;

// --- family 1: the guard type is correct -----------------------------------
type _cat07_widened_string_becomes_the_error_message =
  Expect<Equals<LiteralDescription<"applyFilter", string>, Cat07Message<"applyFilter">>>;
type _cat07_interior_hole_becomes_the_error_message =
  Expect<Equals<LiteralDescription<"applyFilter", `Tenant ${string} filter.`>,
                Cat07Message<"applyFilter">>>;
type _cat07_concrete_literal_passes_through =
  Expect<Equals<LiteralDescription<"applyFilter", "Real text.">, "Real text.">>;
type _cat07_error_message_names_the_offending_action =
  Expect<Assignable<Cat07Message<"cancelBooking">, `${string}"cancelBooking"${string}`>>;

// --- family 2: defineAction WIRES it (an instantiation expression pins it) --
type DescriptionSlot<N extends string, D extends string> =
  Parameters<typeof defineAction<N, D, typeof filterSchema>>[0]["description"];

type _cat07_wired_rejects_widened_string =
  Expect<Not<Assignable<string, DescriptionSlot<"applyFilter", string>>>>;
type _cat07_wired_accepts_a_concrete_literal =
  Expect<Assignable<"Real text.", DescriptionSlot<"applyFilter", "Real text.">>>;
type _cat07_wired_rejects_an_interpolated_template =
  Expect<Not<Assignable<`Tenant ${string} filter.`,
                        DescriptionSlot<"applyFilter", `Tenant ${string} filter.`>>>>;
```

**Mutation-proved this session.** Replacing `description: LiteralDescription<N, D>` with
`description: D` in `defineAction`'s parameter turned exactly the two family-2 rejection predicates
red (`TS2344` at their two lines) and left family 1 green — which is the point of splitting them.

### The emission order, compiling clean under every repo flag

```ts
export const JSON_SCHEMA_TARGET: JsonSchemaTarget = "draft-2020-12";

function emitParameters(
  action: AnyActionDefinition,
  issues: CatalogIssue[],
): JsonSchemaObject | undefined {
  // 1. escape hatch wins — CAT-06
  if (action.jsonSchema !== undefined) return action.jsonSchema;

  const vendor = action.schema["~standard"].vendor;

  // 2. Standard JSON Schema, INPUT projection only
  if (hasJsonSchemaConverter(action.schema)) {
    let emitted: Record<string, unknown>;
    try {
      emitted = action.schema["~standard"].jsonSchema.input({
        target: JSON_SCHEMA_TARGET,
      });
    } catch (cause) {
      issues.push({
        code: "schema_not_emittable", action: action.name, vendor,
        problem: `its validator "${vendor}" threw while emitting JSON Schema for ` +
                 `target "${JSON_SCHEMA_TARGET}" (${String(cause)}).`,
        fix: "supply an explicit `jsonSchema` on the action, or remove the " +
             "transform from the schema.",
      });
      return undefined;
    }
    return emitted as JsonSchemaObject;   // root check happens in the caller
  }

  // 3. neither — name the action AND the vendor
  issues.push({
    code: "schema_not_emittable", action: action.name, vendor,
    problem: `its validator "${vendor}" does not implement Standard JSON Schema.`,
    fix: "supply an explicit `jsonSchema` on the action.",
  });
  return undefined;
}
```

### Measured `CatalogValidationError` output from the end-to-end prototype

Run against real zod / valibot / arktype instances this session:

```
CatalogValidationError:
concierge: 4 problems in the action catalog.
  [schema_root_not_object] action "duUnion": its emitted JSON Schema root is not typed at all
    (keys: $schema, oneOf), not "object". Fix: wrap the schema in an object, or move the union
    inside a property. A discriminated union at the root has no root type and the transport
    rejects the whole session.
  [schema_not_emittable] action "valibotNoHatch": its validator "valibot" does not implement
    Standard JSON Schema. Fix: supply an explicit `jsonSchema` on the action.
  [schema_root_not_object] action "stringRoot": its emitted JSON Schema root is "string", not
    "object". Fix: wrap the schema in an object, or move the union inside a property. …
  [duplicate_action_name] action "dupe": two actions share this name. Fix: rename one of them.

issues[].action: ["duUnion","valibotNoHatch","stringRoot","dupe"]
```

And the diagnostics half, non-blocking:

```
[destructive_without_consent] action "destructiveNoConsent": it declares effects.destructive but
  carries no consent policy. Fix: add a `consent` policy, or set effects.destructive to false if
  the action is reversible.
[reads_untrusted_without_consent] action "untrustedNoConsent": it declares readsUntrusted but
  carries no consent policy. Fix: add a `consent` policy so a human confirms before
  attacker-controllable content can steer this action.
catalog frozen: true | entries frozen: true
```

## State of the Art

| Old approach | Current approach | When changed | Impact on this phase |
|---|---|---|---|
| `zod-to-json-schema` package | `~standard.jsonSchema.input({target})` | Zod 4.2+, ArkType 2.1.28+ | Confirmed present on the installed zod 4.4.3 and arktype 2.2.3. CLAUDE.md already forbids the old package. |
| A per-validator bridge package (`concierge-zod`) | Standard JSON Schema + `jsonSchema?` escape hatch | Standard Schema v1.1.0 | Explicitly out of scope in REQUIREMENTS.md. |
| `string extends T` as *the* literal-type test | Insufficient once template literal types exist | TS 4.1 (template literal types) | The central finding of this research. Widely-cited `IsStringLiteral` implementations (including type-fest's) return `true` for `` `foo${string}` `` — they answer a different question than CAT-07 asks. |
| `tsc` exits 2 on diagnostics | `tsc` exits **1** | TypeScript 7.0 (Go port) | Every Phase 3 mutant expectation must say 1. |

**Deprecated / outdated in this context:**
- The claim on standardschema.dev that Valibot implements Standard JSON Schema. **Measured false**
  against valibot 1.4.2: `Object.keys(schema["~standard"])` is exactly `["version","vendor","validate"]`.
  This is the second independent reproduction (Phase 1 recorded the first at `types.ts:931-937`), and
  it is the reason CAT-06 exists.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `draft-2020-12` is the right default target for LLM tool-calling, rather than `draft-07` | Pattern 3, Open Question 2 | If a target transport (OpenAI Realtime) only tolerates draft-07 constructs, emitted schemas could be rejected. The target is a one-line change and is proposed as configurable. **Unverified against any transport** — no transport exists until Phase 7. |
| A2 | Emitting `$schema` at the root of `EmittedTool.parameters` is harmless | Open Question 3 | Some tool-calling APIs reject unknown root keywords in strict mode. Not testable here — measured only that the key *is* emitted by all three paths. |
| A3 | A `${number}`/`${bigint}` description hole is an acceptable residual CAT-07 gap because a numeric hole cannot carry prose | Pattern 1 | If the threat model includes numeric IDs steering an agent, the gap matters. Judgement call, not a measurement. |
| A4 | A description imported as `export const X = "…"` from another module *should* pass CAT-07 | Pattern 1 matrix | If "available at module scope" is read strictly as *this* module, imports should be rejected — but the type system cannot distinguish a hand-written sibling constant from a build-time-injected one, so rejecting them would block legitimate shared-copy files. |
| A5 | A union of concrete literals (`flag ? "A." : "B."`) *should* pass | Pattern 1 matrix | Both branches are code-reviewable, so this reads as within CAT-07's intent. Not stated in the requirement. |
| A6 | The four candidate validator packages will be added as `devDependencies` rather than vendored fixtures | Standard Stack | If the planner prefers zero lockfile churn, the CAT-02 `discriminatedUnion` reproduction becomes a hand-written fixture and proves less. |

## Open Questions (RESOLVED)

All six were decided at planning time and every recommendation is executed by a named plan:
Q1 → 03-01 (guard on `defineAction` only, no `types.ts` amendment) · Q2 → 03-02 and 03-03
(`draft-2020-12` default, `jsonSchemaTarget` on `BuildCatalogOptions`) · **Q3 → 03-08 Task 3(d)**
(leave `$schema` in, and record the question as a hand-off where Phase 7 will read it) ·
Q4 → 03-08 Task 3(e) (CAT-03 stays in Phase 4, CAT-04 in Phase 8) · Q5 → 03-03 and 03-08 Task 3(e)
(close the `buildCatalog` half of SEC-03 here; the `catalogFor` re-freeze stays open in Phase 4) ·
Q6 → 03-03 Task 2 (`deepFreeze` skips `action.schema`).

1. **Does `buildCatalog` re-check descriptions, and therefore does `types.ts` get amended?**
   - *What we know (measured):* a mapped-type re-check on `buildCatalog`'s `const A` parameter **does**
     catch a raw object literal that bypassed `defineAction`. It also **false-positives on every
     `defineAction` result**, because `defineAction`'s current return type is
     `ActionDefinition<N, S, …>` whose `description` is plain `string`. Adding
     `Description extends string = string` as a **sixth, last** type parameter fixes that and was
     measured to leave all five existing positional usages compiling untouched
     (`test-d/actions.test-d.ts:130-131`, `:274`, and `AnyActionDefinition`).
   - *What's unclear:* whether the bypass is worth an amendment. A developer who skips `defineAction`
     has opted out of inference generally; `buildCatalog`'s parameter could simply require a branded
     `defineAction` return type instead, which closes the hole with a *worse* message ("use
     defineAction()" rather than one naming the action).
   - *Recommendation:* **guard on `defineAction` only, no amendment.** It satisfies CAT-07 as worded
     ("rejected at build time"), keeps the CONTEXT statement that a `types.ts` change is a deviation
     intact, and the bypass is a deliberate act rather than an accident. If the planner disagrees, the
     amendment is measured, free, and reversible — but it must appear as its own visible task.

2. **`draft-2020-12` or `draft-07`, and is the target configurable?**
   - *What we know:* the intersection of what zod and arktype support is exactly these two. ArkType
     throws on anything else; zod silently emits for anything. `@valibot/to-json-schema@1.7.1` emits
     **draft-07** by default, so a catalog mixing a valibot escape hatch with zod/arktype derivation
     carries **two different drafts** — measured.
   - *What's unclear:* whether any target transport cares. None exists until Phase 7.
   - *Recommendation:* default `"draft-2020-12"`, expose it on `BuildCatalogOptions` as
     `jsonSchemaTarget`, and note the mixed-draft consequence in the `jsonSchema` doc comment.

3. **Should `$schema` be stripped from the emitted `parameters`?**
   - *What we know:* all three emission paths include `$schema` at the root.
     `EmittedTool.parameters` is typed `JsonSchemaObject`, whose index signature permits it.
   - *What's unclear:* whether a real transport rejects it. Unverifiable this phase.
   - *Recommendation:* leave it, and record the question where Phase 7 will see it. Stripping is a
     one-line change later; guessing now risks removing something a transport wants.

4. **Who owns CAT-03?**
   - *What we know:* REQUIREMENTS.md assigns CAT-03 to Phase 4. `types.ts:485` says
     "CAT-03 throws at build time instead" and `types.ts:874` names `buildCatalog` as the owner of
     catalog validation generally. `buildCatalog` is written *here*.
   - *Recommendation:* implement the rule-table slot in Phase 3 but leave CAT-03 itself to Phase 4 as
     REQUIREMENTS.md says — the check needs the *whole* catalog including cross-stage actions, which
     is Phase 4's assembly step. CAT-04 genuinely cannot land before Phase 7 (no transport exists to
     declare a grade ceiling). Flag both in the plan rather than absorbing them silently.

5. **SEC-03's phase assignment.**
   - REQUIREMENTS.md assigns SEC-03 to Phase 4; CONTEXT says close it here because `buildCatalog` is
     the only place a freeze can happen. Measured: freezing **does not** conflict with STG-04 —
     a frozen array works as a `Map` value and a `WeakMap` key, and repeated lookups return the
     identical reference. One real consequence: `frozenArray.filter(...)` returns a **new, unfrozen**
     array, so Phase 4's `catalogFor` must re-freeze its filtered result. Say so in the handoff.
   - *Recommendation:* close SEC-03 here as CONTEXT decides, and record the re-freeze obligation.

6. **Should the recursive freeze walk into the developer's `handler` closure or `schema`?**
   - Freezing the validator instance is safe (measured: zod and arktype both keep validating and
     re-emitting after their emitted schema is deep-frozen; both return a *fresh* object per
     `.input()` call, so nothing is shared). But freezing the *schema object itself* freezes a
     third-party library's internals. Untested and not obviously safe.
   - *Recommendation:* freeze the catalog's own structures (entries, the parameters object, the
     diagnostics array) and the action *record*, but do not recurse into `action.schema`. SEC-03
     names the handler, not the validator.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | everything | ✓ | v24.14.1 (floor is `>=22.12.0`) | — |
| pnpm | workspace | ✓ | 11.17.0 (pinned via `packageManager`) | — |
| TypeScript | CAT-07 enforcement | ✓ | 7.0.2 | — |
| Vitest | runtime rules | ✓ | 4.1.10, 4 files / 15 tests green | — |
| `@standard-schema/spec` | schema interop types | ✓ | 1.1.0 | — |
| `zod` | CAT-02 / emission fixtures | ✗ **not installed anywhere in the repo** | — | hand-rolled `StandardSchemaV1` fixture (loses the `discriminatedUnion` reproduction) |
| `arktype` | second SJS vendor fixture | ✗ not installed | — | hand-rolled fixture |
| `valibot` | CAT-06 negative fixture | ✗ not installed | — | hand-rolled fixture with no `jsonSchema` key — this one **is** faithful, since the fixture's whole content is an absence |
| `@valibot/to-json-schema` | escape-hatch fixture | ✗ not installed | — | a literal `jsonSchema` object |
| `slopcheck` | package legitimacy | ✓ | 0.6.1 | — |
| `script(1)` (TTY forcing) | pretty-mode assertions | ✓ | BSD, `script -q /dev/null <cmd>` verified | — |

**Missing with no fallback:** none.
**Missing with fallback:** the three validators. Recommendation in *Standard Stack*: hand-roll for
`test-d/`, install for `test/`.

**Baseline state, verified this session (three times, including after the `slopcheck` run):**
`git status --porcelain` empty · `pnpm typecheck` exit 0 · `pnpm test` 4 files / 15 tests passed.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Runtime framework | Vitest 4.1.10 |
| Runtime config file | `vitest.config.ts` (root, single shared project) |
| Type-level framework | `tsc -p packages/concierge/tsconfig.test-d.json` — **not** Vitest typecheck mode, which `vitest.config.ts` documents as deliberately off |
| Quick run command | `pnpm test <filename-fragment>` — **bare, no `--`** |
| Full suite command | `pnpm build && pnpm typecheck && pnpm test` |
| Type-level command | `pnpm typecheck` |

> `pnpm build` precedes `pnpm test` because `artifact.test.ts` and `export-surface.test.ts` read
> `packages/concierge/dist/index.d.ts` from disk.

### Phase Requirements → Test Map

| Req | Behaviour | Type | Automated command | File exists? |
|---|---|---|---|---|
| CAT-01 | one declaration yields the literal name union | type | `pnpm typecheck` | ❌ Wave 0 — `test-d/catalog.test-d.ts` |
| CAT-01 | one declaration yields the emitted schema + redaction, no second registry | unit | `pnpm test catalog` | ❌ Wave 0 — `test/catalog.test.ts` |
| CAT-02 | non-object root throws naming the action | unit | `pnpm test catalog` | ❌ Wave 0 |
| CAT-02 | `z.discriminatedUnion` specifically is caught | unit | `pnpm test emission` | ❌ Wave 0 — `test/emission.test.ts` (needs zod) |
| CAT-05 | `destructive` without consent yields a diagnostic, does not throw | unit | `pnpm test catalog` | ❌ Wave 0 |
| CAT-06 | explicit `jsonSchema` beats derivation | unit | `pnpm test emission` | ❌ Wave 0 |
| CAT-06 | a vendor with no `~standard.jsonSchema` throws naming action **and** vendor | unit | `pnpm test emission` | ❌ Wave 0 |
| CAT-07 | widened `string` rejected; message names the action and states the fix | type | `pnpm typecheck` | ❌ Wave 0 — `test-d/description-literal.test-d.ts` |
| CAT-07 | interpolated template (`${string}`, all four hole positions) rejected | type | `pnpm typecheck` | ❌ Wave 0 |
| CAT-07 | all ten accept-cases in the *Pattern 1* matrix compile | type | `pnpm typecheck` | ❌ Wave 0 |
| SEC-01 | absent `redact` on a non-empty schema defaults to `"drop"` | unit | `pnpm test catalog` | ❌ Wave 0 |
| SEC-01 | `redact` is non-optional at the type level | type | `pnpm typecheck` | ⚠️ partially — `test-d/actions.test-d.ts` exists; needs a new assertion |
| SEC-03 | a frozen catalog's handler cannot be replaced | unit | `pnpm test catalog` | ❌ Wave 0 |
| SEC-05 | `readsUntrusted` without consent yields a diagnostic with a distinct code | unit | `pnpm test catalog` | ❌ Wave 0 |
| DX-03 | every issue carries `{action, fix}` as fields, not substrings | unit | `pnpm test catalog` | ❌ Wave 0 |
| DX-03 | errors aggregate — N bad actions yield N issues in one throw | unit | `pnpm test catalog` | ❌ Wave 0 |
| PKG-04 (SC-5) | `assertSingleInstance` is called from `buildCatalog` | unit | `pnpm test single-instance` | ⚠️ file exists; needs a new case |
| — | export surface count moves in step | unit | `pnpm build && pnpm test export-surface` | ✅ exists — **expected count changes** |

### Sampling Rate

- **Per task commit:** `pnpm typecheck` (0.1 s under TS 7) plus the one `pnpm test <fragment>` the task
  touches.
- **Per wave merge:** `pnpm build && pnpm typecheck && pnpm test`.
- **Phase gate:** the above plus `pnpm check:artifact`, `check:deps`, `check:pack`, `check:node-floor`
  — all currently exit 0 and must continue to.

### Wave 0 Gaps

- [ ] `packages/concierge/test-d/description-literal.test-d.ts` — CAT-07, both assertion families
- [ ] `packages/concierge/test-d/catalog.test-d.ts` — CAT-01 literal name union
- [ ] `packages/concierge/test/catalog.test.ts` — CAT-01/02/05, SEC-01/03/05, DX-03, PKG-04 call site
- [ ] `packages/concierge/test/emission.test.ts` — CAT-02/06 against real validators
- [ ] `packages/concierge/test/fixtures/schemas.ts` — hand-rolled `StandardSchemaV1` values
- [ ] devDependency install (if adopted): `zod@4.4.3 arktype@2.2.3 valibot@1.4.2`
- [ ] `test/export-surface.test.ts` — update the pinned counts (currently 45 / 39 / 6)
- [ ] `test-d/exports.test-d.ts` — update in the same commit

**Mutant obligations** (`scripts/mutate-and-prove.sh`, gate exit **1** not 2, and always
`pnpm --config.verify-deps-before-run=false <gate>`):

| # | Mutation | Gate | Expected |
|---|---|---|---|
| M-03-1 | delete `LiteralDescription<N, D>` → `D` in `defineAction` | `pnpm typecheck` | two `TS2344` in `description-literal.test-d.ts` |
| M-03-2 | drop the interior-hole probe (`` `${D}${D}` extends D ``) from `HoleProbe` | `pnpm typecheck` | the `${string}`-interior predicate goes red |
| M-03-3 | `const A extends …` → `A extends …` on `buildCatalog` | `pnpm typecheck` | the name-union predicate goes red |
| M-03-4 | reorder emission so derivation precedes the escape hatch | `pnpm test emission` | CAT-06 case fails |
| M-03-5 | `.input(` → `.output(` | `pnpm test emission` | transform fixture throws / default fixture's `required` differs |
| M-03-6 | remove the root-`type` check | `pnpm test emission` | `discriminatedUnion` case fails |
| M-03-7 | `deepFreeze` → `Object.freeze` | `pnpm test catalog` | the handler-replacement case fails |
| M-03-8 | remove `assertSingleInstance()` from `buildCatalog` | `pnpm test single-instance` | the call-site case fails |
| M-03-9 | throw on first issue instead of aggregating | `pnpm test catalog` | the N-issues case fails |
| M-03-10 | drop `vendor` from the not-emittable issue | `pnpm test emission` | the vendor-named case fails |

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this section applies.

### Applicable ASVS categories

| ASVS category | Applies | Standard control here |
|---|---|---|
| V2 Authentication | no | No identity in this phase. |
| V3 Session Management | no | Sessions are Phase 7. |
| V4 Access Control | **yes** | The catalog **is** the access-control surface — an action absent from it cannot be called. SEC-03's freeze is what makes that boundary non-negotiable at runtime. |
| V5 Input Validation | **yes** | Emitted JSON Schema is the agent-facing contract. Root-type enforcement (CAT-02) is what stops a transport silently dropping the entire stage. Re-validation before the handler is DSP-05, Phase 6. |
| V6 Cryptography | no | No crypto in this phase. `DigestLike` is Phase 8. |
| V7 Error Handling & Logging | **yes** | Build-time errors are developer-facing and deliberately verbose; **runtime** result messages are not this phase's concern but the distinction must be preserved (`contract.ts:135-138` sets the precedent). |
| V8 Data Protection | **yes** | SEC-01 redaction defaulting to `"drop"` is a fail-closed data-protection control. |
| V14 Configuration | **yes** | `deepFreeze` is configuration immutability. |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation | Status here |
|---|---|---|---|
| **Tool-description poisoning** — attacker-controlled prose in a tool description steers the model | Tampering / Elevation | Descriptions must be static and code-reviewed | **CAT-07.** Enforced at the type level, matrix measured. Residual `${number}` gap documented in *Assumptions Log* A3. |
| **Handler substitution by third-party page script** — `catalog[0].handler = attackerFn` | Tampering | Deep-freeze the registry after build | **SEC-03.** Measured to be **breached** by the shallow freeze. Recursive freeze required. |
| **Silent capability loss** — a malformed schema makes a transport drop the whole stage | Denial of Service | Fail loudly at build, never coerce | **CAT-02.** CONTEXT explicitly rejects warn-and-coerce. |
| **Telemetry exfiltration of user arguments** | Information Disclosure | Redaction required, default `drop` | **SEC-01.** Type makes it mandatory; runtime fails closed for JS consumers. |
| **Untrusted-ingress escalation** ("lethal trifecta") | Elevation of Privilege | Declare it, and make the declaration have a consequence | **SEC-05.** `types.ts:975-982` names the failure mode — an unenforced marker beside a control that genuinely fails closed. The diagnostic + `onDiagnostic` hook is what makes it a gate. |
| **Slopsquatted dependency** | Tampering | Registry + slopcheck verification before install | Done — see *Package Legitimacy Audit*, all four `[OK]`. |
| **Prototype pollution via a schema-supplied `__proto__` key** | Tampering | Iterate own keys only | Note for the planner: `Reflect.ownKeys` in `deepFreeze` and `Object.keys(properties)` in the SEC-01 emptiness test both read own properties only. Do not switch either to a `for…in`. |

## Sources

### Primary (HIGH confidence — measured in this session)

- `typescript@7.0.2` (`node_modules/typescript`) — 20 compiled probes under the repo's exact
  `tsconfig.base.json` flags: literal inference across five parameter shapes; five rejection
  formulations and their exact diagnostics; a 25-case accept/reject matrix; six pattern-discriminator
  candidates across eleven template-hole shapes; recursion depth limit (TS2589 between 800 and 1000
  chars); terse vs. `--pretty` output; `const`-type-parameter name-union derivation at N=50; the
  `isolatedDeclarations` TS9010 interaction; `lib: ["ES2022"]` global visibility for `AggregateError`,
  `Error.cause`, `Object.hasOwn`, `Reflect.*`, `console`, `structuredClone`; the last-position
  `Description` amendment against all existing positional usages; a mutation proof of the type-test
  suite.
- `zod@4.4.3`, `arktype@2.2.3`, `valibot@1.4.2`, `@valibot/to-json-schema@1.7.1` — installed in a
  scratch directory and executed: `~standard` key inventory; target support and thrown error classes;
  emitted `$schema` per target; `.input()` vs `.output()` divergence for `.default()`, `.transform()`
  and `.coerce`; `discriminatedUnion` / `union` / `variant` root shapes; non-object roots; empty-object
  `properties` behaviour; emitted-object freshness and freeze safety.
- `@standard-schema/spec@1.1.0` — `dist/index.d.ts` read directly from
  `node_modules/.pnpm/@standard-schema+spec@1.1.0/…`.
- Repository sources read this session: `packages/concierge/src/types.ts`, `src/contract.ts`,
  `src/index.ts`, `test-d/_assert.ts`, `test-d/actions.test-d.ts`, `test/export-surface.test.ts`,
  `vitest.config.ts`, `scripts/mutate-and-prove.sh`, `tsconfig.base.json`, `tsconfig.test-d.json`,
  `package.json` (root and package), `pnpm-workspace.yaml`.
- Repository gates run: `pnpm typecheck` (exit 0), `pnpm test` (4 files / 15 tests), the
  `pnpm test -- <name>` filter trap (reproduced), `pnpm --config.verify-deps-before-run=false` (tree
  clean), `tsc` exit codes (1 on diagnostics).
- Planning documents: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`,
  `03-CONTEXT.md`, `02-VERIFICATION.md`, `02-11-SUMMARY.md`, `02-12-SUMMARY.md`.
- `slopcheck@0.6.1` + `npm view` — legitimacy and registry metadata for four packages.

### Secondary (MEDIUM confidence)

- `CLAUDE.md`'s technology-stack section, used to cross-check the validator versions this research
  measured. Every version it names matched what npm serves today.

### Tertiary (LOW confidence — flagged, not relied on)

- The claim that `draft-2020-12` is the right target for LLM tool calling. Not verified against any
  transport; see *Assumptions Log* A1.
- The claim that emitting `$schema` inside `EmittedTool.parameters` is harmless. See A2.

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| CAT-07 mechanism, matrix, error text | **HIGH** | 20 compiled probes, exact diagnostics captured, mutation-proved. The one gap (`${number}`) is stated rather than hidden. |
| Validator behaviour (CAT-02, CAT-06, input/output) | **HIGH** | All four packages installed and executed; every claim is a captured run. |
| Freeze / SEC-03 | **HIGH** | Breach of the shallow form directly demonstrated. |
| Aggregation, diagnostics, error shape | **HIGH** | End-to-end prototype run against real validators; compiles clean under every repo flag. |
| Type-level plumbing (`console`, narrowing, `const` param) | **HIGH** | Each compiled under the exact production flags. |
| Tooling traps (filter, exit codes, TTY, lockfile) | **HIGH** | All reproduced this session. |
| Target-draft choice, `$schema` handling | **LOW** | No transport exists to test against. Both flagged as open questions with a one-line reversal path. |
| CAT-03 / CAT-04 / SEC-03 phase ownership | **MEDIUM** | Documented tension between REQUIREMENTS.md and `types.ts` doc comments. Recommendation given; the decision is the planner's. |

**Research date:** 2026-07-29
**Valid until:** 2026-08-28 for the TypeScript findings (a compiler minor could shift inference; the
`HoleProbe` predicates should be re-run against any TS upgrade). **2026-08-12** for the validator
findings — valibot gaining `~standard.jsonSchema` would change CAT-06's framing, and that is exactly
the claim the docs already make and the package does not yet honour.
