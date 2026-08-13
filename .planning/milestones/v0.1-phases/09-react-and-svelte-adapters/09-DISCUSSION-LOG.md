# Phase 9: React and Svelte adapters - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `09-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 9-react-and-svelte-adapters
**Mode:** `--auto`, advisor discussion, standard calibration
**Owner framing:** Technical; prior selections approved recommended defaults for the autonomous lifecycle
**Areas discussed:** Adapter API and lifecycle; Svelte normalization and packaging; SSR, package, and budget proof

`[--auto] Selected all gray areas: Adapter API and lifecycle; Svelte normalization and packaging; SSR, package, and budget proof.`

---

## Adapter API and Lifecycle

| Option | Pros | Cons | Complexity | Recommendation | Selected |
|--------|------|------|------------|----------------|----------|
| Existing instance in context + separate effect-owned bridge registration | Preserves core ownership; exact instance identity; lifecycle cleanup delegates to the proven token guard; React can own live-value mirroring without expanding core | Requires a provider/context API plus one registration surface per framework | Small adapter-only surface; lowest logic-leak risk | Recommended for a headless adapter over a complete core | ✓ |
| Adapter constructs/configures Concierge from component props | Fewer imports in a toy example | Rebuilds catalog/config during render; obscures instance lifetime; can leak SSR state or split sessions | High lifecycle and ownership ambiguity | Reject because construction is application scope, not component registration | |
| Global singleton accessor | Minimal component API | Cross-request state leak; breaks nesting/tests/microfrontends; hides which core instance is active | Small code, unacceptable correctness risk | Reject | |

`[auto] [Adapter API and lifecycle] — Q: "How should framework scope and bridge registration compose with the completed core?" → Selected: "Existing instance in context + separate effect-owned bridge registration" (recommended default).`

**Choice:** Carry the exact constructed instance in framework context. Register only in client effects, clean up with the exact returned unsubscriber, and make the React adapter own its live-value ref mirroring. Test actual StrictMode and stale cleanup order.

---

## Svelte Normalization and Packaging

| Option | Pros | Cons | Complexity | Recommendation | Selected |
|--------|------|------|------------|----------------|----------|
| Real `$state.snapshot` normalizer in rune-aware source built by `svelte-package` | Exercises the framework defect Phase 9 exists to expose; consumer compiler retains reactivity; matches official packaging model | Requires a second build toolchain and tarball-level test | Moderate packaging work, narrow runtime code | Recommended and already locked by roadmap/contributor contract | ✓ |
| Reuse core's structural copier | No Svelte-specific code | Does not prove the native proxy boundary and may hide framework-specific values outside the copier's supported domain | Low work, insufficient evidence | Reject | |
| Prebundle Svelte adapter with tsdown | Matches React package tooling | Rune transforms can compile yet become silently non-reactive; removes the required `svelte` path | Superficially simple, high silent-failure risk | Reject | |

`[auto] [Svelte normalization and packaging] — Q: "What should make the Svelte adapter's snapshot guarantee real rather than nominal?" → Selected: "Real $state.snapshot normalizer in rune-aware source built by svelte-package" (recommended default).`

**Choice:** Export a canonical `$state.snapshot` normalizer, build the package unbundled with `svelte-package`, and prove review-time detachment versus live getter movement from an installed tarball.

---

## SSR, Package, and Budget Proof

| Option | Pros | Cons | Complexity | Recommendation | Selected |
|--------|------|------|------------|----------------|----------|
| One minimal Astro app + isolated three-tarball consumer + enforced 150-LOC budgets | One metaframework can render React and Svelte against one catalog; validates real exports/peers/SSR/reactivity/version guards; mechanically prevents logic leakage | Adds an example workspace and pack harness | Broad verification, but directly maps every phase criterion | Recommended | ✓ |
| Framework unit tests only | Fast and focused | Misses exports, tar contents, peer graph, consumer compilation, SSR integration, and Svelte prebundling | Low initial cost, high release risk | Reject | |
| Separate Next and SvelteKit examples | Native framework demos | Duplicates catalog/app scaffolding and cannot directly prove both adapters share one core in one consumer | Highest maintenance surface | Reject for v0.1 | |

`[auto] [SSR, package, and budget proof] — Q: "What is the smallest proof that both real adapters ship over one core and remain server-safe?" → Selected: "One minimal Astro app + isolated three-tarball consumer + enforced 150-LOC budgets" (recommended default).`

**Choice:** Use Astro only as a deterministic multi-framework harness, install real archives into a fresh consumer, verify an intentional contract mismatch fails, and enforce a non-comment source budget plus prohibited-logic checks.

---

## Claude's Discretion

- Exact public API names and framework lifecycle primitives within the selected ownership model.
- Current compatible dependency pins and the smallest test libraries needed for official compilation/lifecycle behavior.
- Exact example filenames, count-script implementation, and mutation/equivalent defect harness structure.

## Deferred Ideas

- Additional framework adapters, devtools/read subscriptions, designed UI, transports, and server authorization.
- Browser-mode testing unless a concrete gap survives real tarball, jsdom lifecycle, and Astro SSR checks.

