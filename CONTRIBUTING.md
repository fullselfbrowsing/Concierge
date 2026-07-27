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
- Run `pnpm typecheck && pnpm test` before pushing.
- Explain *why* in the description. The what is in the diff.

## Code of conduct

Participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).
