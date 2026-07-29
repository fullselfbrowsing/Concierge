# Contributing to Concierge

Thanks for looking. Concierge is pre-alpha — the most valuable contribution right now is **arguing with the design**, not writing code against an API that may still move.

## Before you write code

The [design contract](./README.md#design-contract) in the README is the spec. Six decisions carry the whole library:

1. Enumerated verbs, not generic actuation
2. Every action returns `{ok, message}`
3. Stage-scoped catalogs
4. The bridge pattern with getter snapshots
5. Graded consent that fails closed
6. Transport-agnostic core

If you think one of these is wrong, **open an issue first**. A PR that quietly violates one of them will be closed with a link back here, and that wastes your time more than mine.

## Non-negotiables

These are invariants, not preferences. Each one exists because the alternative broke something real:

- **Core has zero top-level DOM access.** It must construct on the server under Next App Router, Nuxt, and SvelteKit without environment guards. No `window`, `document`, or `navigator` outside a lazily-invoked function.
- **Core has no framework dependency.** React, Vue, and Svelte live in adapter packages. If a piece of logic needs a hook, it belongs in an adapter — or, more often, it needs to be rewritten as a plain function that the adapter calls.
- **`dispatch` is not `async`.** An async wrapper allocates a fresh Promise per invocation, which breaks await-deduplication by reference identity. There is a test asserting `p1 === p2`; do not delete it.
- **Registration returns an identity-guarded unsubscriber.** Only remove the entry if it is still the one you registered. React StrictMode, Vue HMR, and Svelte remounts all produce stale cleanups otherwise.
- **Redaction defaults to `drop`** and is required for any action with a non-empty schema. Telemetry leaks must be opt-in.
- **Validation is enforcement, not decoration.** The JSON Schema handed to a model is a hint. The schema parse before dispatch is the actual boundary, and it runs even when the model "already validated."
- **`concierge-svelte` builds with `svelte-package`, never tsdown.** Runes are compiler-transformed; pre-bundling them produces code that runs and is not reactive. There is no error and no warning — the symptom is "the snapshot doesn't update," which is indistinguishable from a bridge bug and will be debugged as one. `@sveltejs/package` transpiles file-by-file, deliberately does not bundle so consumers can tree-shake and reach their own Svelte compiler, and requires a `svelte` export condition in `exports`. The version pin already exists in `pnpm-workspace.yaml`'s `catalog:`; the package does not exist yet.
- **The build is not centralized.** Root scripts stay `pnpm -r build`, so each package declares its own builder in its own `package.json`. This looks like duplication, and it is the structural guard against the bullet above: the moment a shared build config exists that every package inherits, `concierge-svelte` inherits it in Phase 9 and its runes get pre-bundled with no error anywhere. There is nothing for a new package to be swept into, and that is the feature.

One deliberate asymmetry, so it is not read as an oversight: **the test runner *is* centralized** — one root `vitest.config.ts` and one root `test` script — while the builder is not. One shared runner, per-package builders. The runner has no equivalent hazard: a misconfigured test runner produces a red suite or a suite that visibly runs nothing, both of which are loud. A misconfigured builder produces a green build and a package that silently does not work.

## Adding an action to your own app

Actions are declared once and everything downstream is derived — the name set, the union type, the per-stage catalogs, the emitted JSON Schema, the redaction policy. If you find yourself maintaining two lists in lockstep, that is a bug in Concierge, not in your app. File it.

## Adding a framework adapter

An adapter does exactly two things:

1. Get the Concierge instance into component scope (context, provide/inject, `setContext`, DI token).
2. Register handlers and bridges on mount, unregister on unmount, with the identity guard.

If your adapter is meaningfully longer than ~150 lines, logic has leaked out of core. Push it back down.

## Writing messages

`ActionResult.message` is relayed to a human verbatim. Hold it to that standard:

- One sentence. Complete. Speakable.
- Failures name what went wrong **and** what to do about it: `"I don't see a Marriott in your current results. Want me to clear all filters?"`
- Never a stack trace, never an error code, never "an error occurred."
- Never invent a fact to fill a gap. `"I don't have the cancellation policy on this rate yet"` beats a plausible guess. This is not politeness; a confident wrong number in a booking readback is the worst failure this library can produce.

## Pull requests

- One concern per PR.
- Tests for anything touching dispatch, dedup, consent, or matching. Those four are where correctness bugs hide and where they hurt most.
- Run `pnpm typecheck && pnpm build && pnpm test` before pushing. All three, in that order. `pnpm build` is where `publint` and `attw` run, and `typecheck` goes first because rolldown transpiles without typechecking — a program that does not typecheck still builds green, so `build` passing tells you nothing about types.
- Explain *why* in the description. The what is in the diff.

## Repo machinery

### Changesets and the `ignore` list

`.changeset/config.json` is read with a **strict JSON** parse (`@changesets/config` calls `fs.readJSON`), so it cannot carry a `//` comment. Do not copy `tsconfig.test-d.json`'s JSONC style into it — TypeScript tolerates comments there; changesets will throw. This note is where that file's comments would have gone.

- **`ignore` is deliberately empty (`[]`) and explicit.** A package belongs in it when it is a workspace member that must never be published *and* is not already covered by `private: true`. Keeping the key present with an empty array means the first such package in Phase 9 has an obvious home, instead of the discovery that `changeset version` wants to version something that must not publish.
- **`privatePackages` is `false`, and that is load-bearing rather than tidy.** Omitting it defaults to `{version: true, tag: false}` — changesets versions private packages by default. The workspace contains two private members, `@fullselfbrowsing/concierge-fixture-alpha` and `@fullselfbrowsing/concierge-fixture-beta` under `packages/concierge/test/fixtures/`, which exist to prove the peer-dependency install graph and must never appear in a release plan. Measured on this repo: with the setting, the versionable changed set is `["@fullselfbrowsing/concierge"]`; without it, both fixtures join it.

The first-publish checklist lives in [`RELEASING.md`](./RELEASING.md).

### The pnpm floor and the package floor are different numbers

Contributors need **Node ≥ 22.13**, because pnpm 11 refuses to start below it (`npm view pnpm@11.17.0 engines` reports `{"node":">=22.13"}`). The published package declares **`engines.node: ">=22.12.0"`**, because 22.12 is the exact release where `require(esm)` became unflagged.

These are different numbers for different audiences — one is a contributor requirement about where this repo is developed, the other is a promise to consumers about where the artifact runs — and they **must not be harmonized**. Raising `engines.node` to `>=22.13` to make a red floor job go green abandons the requirement while appearing to fix it. The CI floor job therefore uses npm and node only, with no pnpm anywhere in it.

## Code of conduct

Participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).
