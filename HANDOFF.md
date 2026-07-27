# Handoff

For whoever — human or agent — picks this up next.

## Where things stand

**Nothing is implemented.** The repo contains a design contract, a compiling type surface, and a fully planned v0.1 milestone. There is no runtime, no test suite, no build, and no published package. `packages/concierge/src/` is types only; `index.ts` exports no values beyond three frozen constants.

That is deliberate. The planning is unusually complete for a repo with no code because four parallel research agents ran against the design *before* implementation, and what they found changed it substantially. Reading their output is much cheaper than rediscovering it.

## Read in this order

| # | File | Why |
|---|---|---|
| 1 | `README.md` | The six-point design contract. This is the public promise. |
| 2 | `packages/concierge/src/types.ts` | The contract as code. Comments explain *why* each shape is what it is, including several that record a defect that was fixed — do not "clean up" those comments; they are the reason the shape is correct. |
| 3 | `.planning/research/SUMMARY.md` | Synthesis of all four research dimensions, with conflicts resolved and sources cited. |
| 4 | `.planning/ROADMAP.md` | Nine phases, 57/57 requirement coverage, verified mechanically. |
| 5 | `.planning/STATE.md` | Current position and open blockers. |
| 6 | `CONTRIBUTING.md` | The non-negotiables, stated as rules. |

`.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md` are the full dimension reports — roughly 240KB. Go there when a phase needs depth, not on first read.

## What is locked

Do not relitigate these without new evidence. Each cost real research to establish, and the rationale is recorded at the point of use.

- **The catalog of actions is the security boundary.** No generic actuation primitive — no `click`, no `execute_js`, no coordinate tools — may be added. A single generic escape hatch destroys the property the entire library exists to provide.
- **Core has no DOM, no framework, and no vendor.** Enforced mechanically: `lib: ["ES2022"]` makes `document` a compile error.
- **Snapshots are getter functions, `() => T`.** Convergently correct — TanStack's Svelte adapter independently exports the identical `Accessor<T>`. Do not "simplify" to values.
- **`dispatch` is not `async`.** An async wrapper allocates a fresh Promise per call and breaks dedup by reference identity.
- **ESM-only.** The dual-package hazard splits the bridge registry, the dedup window, and the consent kernel — a split dedup window double-fires a retried call, the precise failure this library exists to prevent.
- **Consent grades are modality-free.** Speech versus text is not an axis. Content provenance and confirmation provenance are.
- **Svelte is the first non-React adapter and ships with React, not after.** It is the only target that surfaces the `$state`-proxy consent defect, and that defect is invisible in a React-only test suite.

## What is genuinely open

One blocker, in `.planning/STATE.md`:

- **Core as `peerDependency` of adapters.** Structurally forces a single core instance, which matters here because a split instance splits the safety kernel. Diverges from the dominant ecosystem pattern (TanStack does the opposite). Expensive to reverse after publish, so it blocks Phase 2.

Lower-stakes open items are listed in `.planning/PROJECT.md` under Key Decisions, marked ⚠️.

## Start here

```
/gsd-discuss-phase 1
```

`auto_advance` is off, so nothing proceeds on its own. Phases 1 and 2 are disjoint (types versus build config) and can run in parallel.

Phase 8 — the consent kernel — is flagged **research before planning**. It is the milestone's reason to exist and has no prior art in any shipping competitor or spec.

## Traps

Findings that will cost a day each if rediscovered:

- **A `z.discriminatedUnion` at a schema root emits `{oneOf: []}` with no root `type`.** OpenAI Realtime then rejects the *entire* session update, and the agent silently loses every action in that stage while apologizing that it cannot do that here. Flat object plus `superRefine` instead. CAT-02 makes this a build-time throw.
- **Validator documentation lies.** standardschema.dev claims Valibot v1.2+ implements `~standard.jsonSchema`; valibot@1.4.2 as published does not. Probe the installed package, never the docs site. This is why the `jsonSchema?` escape hatch exists.
- **Svelte `$state` returns a Proxy.** A consent snapshot stored at review time would be a *live view* that mutates with the app, turning "any drift destroys consent" into "there is never any drift" — a gate that passes unconditionally while appearing to work. `structuredClone` is not a fix; it throws `DataCloneError` on proxies. Hence `SnapshotNormalizer`.
- **`registerHandler` is same-origin and live.** Any analytics tag or transitive dependency can overwrite a destructive action. SEC-03 freezes the registry after build.
- **Client-side consent is an assertion, not proof.** There is no token scoping an in-page action, so every call carries the human's full ambient session authority. The server must re-verify. Server verification is v2, so v0.1 documents the limit rather than overstating what it proves.
- **Adapters that grow past their budget mean logic leaked out of core.** Better Auth ships adapters at 17–65 LOC. Zag.js runs ~600 because each adapter re-runs the state machine interpreter. If an adapter contains a loop, a scheduler, or a state transition, push it down.

## Do not

- Add a chat UI, an agent loop, or generative-UI `render` props on actions. All three are recorded as out of scope with reasons in `.planning/REQUIREMENTS.md`.
- Compete with [WebMCP](https://github.com/webmachinelearning/webmcp). It is standardizing tool registration into the browser and is treated here as a *transport*.
- Reintroduce voice as an organizing concept. It is one transport among several, and the contract has been corrected twice for drifting back toward it.
- Claim `@copilotkit/core` is not SSR-safe. It is plausible but untested — do not publish that comparison without an actual import test.

## Provenance

The design is extracted from a shipped production system: 28 actions across 6 stages, with its own drift between planning record and implementation documented. Concierge is the generic portion — the concurrency, cancellation, dedup, and consent semantics.

Two claims in early planning were later proven false by research and are recorded in `.planning/PROJECT.md` rather than deleted, because both flattered this project: Vercel AI SDK does have client actuation and a consent story (`needsApproval`, optional `execute`), and OpenAI Agents JS is closer to this design than assumed. **We are hardening a known failure mode, not discovering one.**
