# Phase 6: Dispatcher - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous). Grey area tables were generated and presented; the acceptance
prompt could not be surfaced because this session is non-interactive, so every recommended answer
below was **auto-accepted**. Each carries its rationale so any can be reversed without re-deriving
it. Three are flagged inline as consequential: **1.1 (the WR-06 ratification)**, **1.2/1.3 (a
deliberate softening of a recorded obligation)**, and **2.3 (dedup eviction without a timer)**.

<domain>
## Phase Boundary

A retried, malformed, aborted, or crashing call produces exactly one honest result, and no effect
ever fires twice.

**In scope:** the real `dispatch` (replacing Phase 4's stub wholesale), dedup by Promise reference
identity, argument re-validation, the handler-error boundary, the DSP-09 result normalizer, the
SEC-06 message sanitizer, serial batch execution, the commit window, and settling the `Scheduler`
seam.

**Out of scope — Phase 7:** the transport, the session loop, and any telemetry channel.
**Out of scope — Phase 8:** the consent gate itself. Phase 6 only builds the single handler-context
shape that carries `ack` through for gated and non-gated actions alike.
**Out of scope — Phase 9:** the adapters.

</domain>

<decisions>
## Implementation Decisions

### Result shape and normalization (DSP-09, SEC-06)

- ⚠️ **WR-06 is ratified as option-b: the flat `ActionResult` shape stands.** Phase 1's
  execute-phase orchestrator selected it and recorded plainly that *the user did not*; the decision
  has been pending ratification since, with Phase 8 as the last free moment. Ratifying it here, with
  the reasoning stated so it can still be reversed:
  - The discriminated union on `ok` costs **six measured errors**, breaks
    `ConsentPolicy.onMissing: Pick<ActionResult, "reason" | "message">` with TS2344 — because
    `keyof` a union is the *intersection* of branch keys, collapsing `keyof ActionResult` to
    `"ok" | "message"` — and needs five edits to `test-d/results.test-d.ts`.
  - It also requires **superseding a standing "Rejected — do not revive" entry** in
    `01-CONTEXT.md`, authority no orchestrator has and which nothing new has come along to justify.
  - The mitigation for the flat shape is a **runtime normalizer at the dispatcher boundary**, which
    this phase builds anyway for DSP-09. Marginal cost of the mitigation is therefore ≈ zero.
  - A type that admits contradictions plus a runtime that rejects them is this project's own
    "enforced over declared" pattern applied correctly, not a compromise of it.
  **This remains an orchestrator ratification, not a user one.** It is surfaced for the user; if
  withheld, Phase 8 is still free and the union is still available at the cost above.
- ⚠️ **A handler returning `{ok: true, reason: …}` has its `reason` stripped and keeps `ok: true`,
  with a warn-once.** STATE.md's deferred row says the normalizer "must reject" this. That is
  deliberately softened, and the reason is the phase goal itself: by the time the dispatcher sees a
  return value **the handler has already run and its effect has already landed.** Converting to
  `invalid_result` would report "it didn't work" about an action that may well have worked — a
  dishonest result, which is the one thing this phase exists to prevent. The developer still learns
  their handler is malformed, through the warn.
- ⚠️ **A handler returning `{ok: false}` with no `reason` passes through unchanged, with a
  warn-once.** Same softening, opposite direction. The `ReasonCode` union is closed at twelve and
  has no "unspecified" member, so the dispatcher cannot supply one without inventing a claim. Phase
  4's own stub omits `reason` precisely because every available code would have been a lie
  (`concierge.ts:104-117`). A failure that says only *that* it failed is honest; a failure carrying
  a fabricated cause is not.
- **A handler return that is not a result at all** — `undefined`, a string, a promise resolving to a
  number, anything from a JavaScript consumer — is `invalid_result` (DSP-09). That is the case the
  code exists for, and it is distinct from the two above: nothing here can be salvaged.
- **The SEC-06 sanitizer extends `bridge.ts`'s `boundedMessage` rather than duplicating it.**
  Extract it to a shared internal module both `bridge.ts` and the dispatcher import, then add C0/C1
  stripping (U+0000–U+001F, U+007F–U+009F) and whitespace collapse. Two things must not regress:
  its **surrogate-pair-safe cut** (`charCodeAt(MESSAGE_MAX_CHARS - 1)` in `0xD800..0xDBFF` → cut one
  earlier), and the fact that it **shares `MESSAGE_MAX_CHARS`** rather than re-spelling `180`.
  Note the line `boundedMessage`'s doc draws: bounding removes no character the consumer wrote;
  sanitizing does. Phase 6 is where that second half finally happens, so the doc comment moves too.
- **Every message leaving the dispatcher is sanitized**, including `USER_CANCELLED` /
  `USER_DECLINED` and the handler's own. One boundary, no exceptions — an exception list is how a
  sanitizer stops being one.

### Dedup (DSP-01, DSP-02)

- **`dispatch` is not `async`.** An async wrapper allocates a fresh Promise per invocation and
  breaks dedup by identity, which is the mechanism criterion 1 tests. It returns a Promise; it is
  not declared `async`.
- **Key: `callId` when present, else `name` + `JSON.stringify(args)`.** When `JSON.stringify`
  throws — a cycle, a `BigInt` — the call **degrades to a no-dedup path** and runs normally
  (DSP-02). It never throws out of key derivation.
- **Storage is a `Map<string, Promise<ActionResult>>`, `let`-declared inside the `createConcierge`
  closure and `??=`-allocated on first dispatch.** A `Map` is correct *here* — this structure is
  mutable and is not part of the catalog, which is exactly the distinction `catalog.ts:252-288`
  draws. Module scope is forbidden: a module-scoped instance bleeds across requests and tenants in
  production while looking fine in development.
- ⚠️ **Eviction is by timestamp checked on access, not by timer.** Each entry stores its creation
  time; a lookup older than `dedupeWindowMs` is treated as absent and replaced. **This removes the
  scheduler dependency from dedup entirely**, leaving the commit window as its only consumer —
  which matters because the scheduler seam is the least settled thing in this phase. It also means
  no timer leaks a reference to a settled Promise.
- **Failures are cached like successes.** DSP-01 is a claim about Promise *identity* for a retried
  call inside the window; the outcome is irrelevant to it. Caching only successes would let a
  retried failing call re-run its handler, which is the double-fire the requirement forbids.

### Batch, commit window, handler lookup (DSP-07, DSP-08, TRN-04, SEC-03)

- **A batch runs serially in `outputIndex` order**, and **every call in an aborted batch still
  produces a result** — `aborted` — so the agent is never left waiting on a response that will not
  come.
- **`batch_aborted` stays collapsed into `aborted`.** `types.ts:159-171` sanctions splitting it only
  if Phase 6 *finds* it needs the distinction. It does not.
- **The commit window elapses *before* the handler runs**, not after. DSP-08 requires that the
  effect not *land* until the window has passed; running the handler first and then delaying the
  result means the effect already landed and the window guarded nothing. An abort inside the window
  cancels the call and returns `aborted` without ever invoking the handler.
- **Read-only actions bypass the window entirely** — gated on `effects.readOnly === true`, so an
  action that omits `effects` is treated as non-read-only and waits. Fail-safe direction.
- **Handler lookup reads `catalog.byName`** — the ROADMAP requires this phase's plan to state which
  of the two lookups it uses, and this is the answer. It is already a **frozen
  `Object.create(null)`** record, so it satisfies SEC-03 *and* the `dispatch("__proto__")` /
  `dispatch("constructor")` cases in one structure. **It must not be converted to a `Map`** — a
  frozen `Map` still accepts `.set()`.
- **Stage scoping comes from `namesByStage`, not from `byName`.** `createConcierge` builds one flat
  catalog across all stages plus `crossStage`, so `byName` is global. An action present in the
  catalog but absent from the *current* stage must return `unknown_action`, and only the per-stage
  projection can tell the difference.
- **Bridge resolution calls the existing module-private `resolveBridge`.** Its doc names the
  dispatcher as its **second and final** caller and says there must never be a third, because a
  second resolution path is not a duplicate function but a second answer to "is this bridge
  mounted". Do not add one.
- **Core still never auto-fails on a null bridge** (Phase 5 decision 3.1, DX-02). The dispatcher
  passes `bridge: null` and the handler decides — `no_bridge` is a code the *handler* returns via
  `offPageResult`, not one the dispatcher synthesizes.
- **One handler-context shape for gated and non-gated actions alike** — `{ args, bridge, meta, ack }`
  with `ack` explicitly `undefined` when absent. `types.ts:405-411` states the alternatives are two
  divergent context shapes or a cast, "on the consent path, which is the one place in this library a
  cast must never be the path of least resistance."

### The `Scheduler` seam — closes two Phase 1 deferrals

- **`scheduler` stays optional, and an omitted one falls back to a structural `setTimeout` read in
  `host.ts`.** That file already reserves this exact landing site and warns the deferral "should not
  quietly acquire a second unnamed instance." The fallback obeys `host.ts`'s three conventions:
  a module-private minimal view type, the cast **inside a function body** and never at module scope,
  and the capability optional at the type level.
- **When neither a scheduler nor a host timer exists, the commit window is skipped — effects land
  immediately — and that is warned once, not silent.** A library that quietly drops a safety window
  is worse than one that says it is dropping it. Dedup is unaffected, per decision 2.4.
- **The `Scheduler` signature is kept as `(fn: () => void, delayMs: number) => () => void`.** There
  is no measured need to refine it. The returned canceller is load-bearing — a scheduler returning
  `void` cannot express cancellation — and returning a plain function rather than a platform handle
  keeps core free of a timer-id type whose spelling differs between DOM (`number`) and Node
  (`Timeout`).
- **`Scheduler`'s shape is now pinned in `test-d/`.** Phase 1 declined this pin only because the
  signature was expected to move and a pin would have fired on a sanctioned edit
  (`01-09-SUMMARY.md:187-197`). Settling the signature here makes the pin free rather than
  pre-emptive, which is the condition that deferral named. Closes STATE.md deferred row 1.

### SEC-02 — recorded as structural, not implemented

- **There is no telemetry seam in the codebase.** `telemetry` / `onError` / `onTelemetry` appear only
  in doc prose. SEC-02 ("telemetry never carries thrown error messages, only error class names") is
  therefore satisfied **structurally — nothing is emitted at all** — and Phase 6 does not invent a
  channel to constrain. Inventing one would be scope creep, and Phase 7's transport is its natural
  home. **Record this in REQUIREMENTS.md as satisfied-structurally with the reason**, rather than
  claiming a channel is being constrained. The adjacent shapes to model it on when it does arrive
  are `RedactionPolicy` and `BuildCatalogOptions.onDiagnostic`.

### Claude's Discretion

- Internal module layout (`src/dispatch.ts` vs a split), all internal names, and the division of
  tests across files.
- The exact wording of every new warn message, subject to the house shape
  `concierge: [code] subject "x": problem Fix: fix` and the DX-03 standard (say what is wrong *and*
  what to do).
- Whether the shared sanitizer module is exported or internal — export only if a runtime test
  cannot otherwise reach it, given the "fewer exports" rule and that runtime suites read
  `dist/index.js`.

</decisions>

<code_context>
## Existing Code Insights

### The stub being replaced

`DISPATCH_NOT_IMPLEMENTED` (`concierge.ts:130-134`) and `dispatch` (`concierge.ts:648-654`). Its doc
comment instructs: **the DSP-09 normalizer must REPLACE this shape, not normalize it** — the constant
is not a handler return at all but the dispatcher's stand-in for a dispatcher that does not exist, so
routing it through the normalizer would produce a well-formed report about a call that never
happened. **Delete the constant and the function together.**

Three things move with that deletion:
- `test/concierge.test.ts:1274-1341` (`S27`) pins the stub. Its own header says to **delete** the
  case rather than update it — re-pointing it at the real dispatcher "would quietly convert a Phase 4
  honesty check into a Phase 6 behavioural claim it was never designed to make."
- `concierge.ts:3` — the module header names "the Phase 6 dispatch stub".
- `concierge.ts:396-403` — the **four-seal count** claim. Deleting the constant makes it three. That
  doc comment says explicitly: "Four is the number; if a later change makes it a different number,
  this sentence is what has to be corrected with it."

### Reusable assets

- `catalog.byName` (`catalog.ts:1060-1073`) — frozen `Object.create(null)`, transitively frozen by
  `deepFreeze`. `CatalogEntry` gives `action.handler`, `action.schema`, `action.effects`,
  `action.consent`, and `parameters` from one lookup.
- `resolveBridge` (`concierge.ts:236`), `bridgeStatus` (`:288`), `resolveIndex` (`:596`),
  `namesByStage` (`:447`), `runMatch` (`:518`), `projectFor` (`:630`).
- `boundedMessage` (`bridge.ts:393`) — the surrogate-safe truncator SEC-06 extends.
  `offPageResult` (`bridge.ts:405`), `captureSnapshot` (`bridge.ts:948`).
- `warnHost` (`host.ts:93-96`) and the reserved timer landing site (`host.ts:38-44`).
- `USER_CANCELLED` / `USER_DECLINED` (`types.ts:239`, `:261`) — frozen, narrowly annotated.
- `MESSAGE_MAX_CHARS = 180` (`types.ts:279`), deliberately unannotated so the literal survives into
  the emitted `.d.ts`.

### Established patterns

- **Factory closure, no classes.** Immutable derived state computed in the body, mutable state as
  `let`s `??=`-allocated on first use, inner named functions, `return { … }`. The returned object is
  deliberately **not** frozen — `concierge.ts:751-767` says so *because* Phase 6 replaces `dispatch`
  wholesale.
- **Consumer callbacks wrapped in `try {} catch {}` with no binding**, message echoing nothing
  caught. `runMatch` (`concierge.ts:520-538`) states the reason in terms that apply verbatim to the
  handler boundary: the caught message is assembled from the same user input, so echoing it opens
  exactly the covert channel CLAUDE.md's rule closes.
- **Two error channels** — blocking `CatalogValidationError` at build time, non-blocking `warnHost`
  at runtime, warn-once latched per subject, one report per offending subject and never an
  aggregated summary line.
- `lib: ["ES2022"]` means `setTimeout`, `console` and `crypto` are compile errors. `host.ts` is the
  only sanctioned escape. `isolatedDeclarations`, `exactOptionalPropertyTypes` (optional members need
  explicit `| undefined`; `types.ts` says "do not tidy them away"), `noUncheckedIndexedAccess`.

### Test conventions

- Runtime suites import `../dist/index.js` behind an `existsSync` guard; `../src/` may appear only
  inside comments. `describe` title = requirement id + claim; `it` titles carry a case id.
- **No Vitest mocking API in `test/`** — the grep must stay at zero. Console capture is a plain
  global assignment with the real console spread rather than replaced, restored in a `finally`.
- Type tests use only the four `_assert.ts` aliases, never `expectTypeOf`; `@ts-expect-error` is
  reserved for object-literal freshness. Each predicate is one line, named after its invariant,
  because `tsc` echoes only the failing line.
- `packages/concierge/test/` is in **no TypeScript program** — a type error there surfaces only as a
  runtime failure.
- Harness facts: `pnpm test -- <name>` does **not** filter; `pnpm exec vitest run <name>` does.
  `mutate-and-prove.sh` restores `src/` but not `dist/`, so rebuild after every probe, and a `src/`
  mutant must be gated on a command that rebuilds. Never pipe a gate command.

### Export surface baseline

**65 names / 51 types / 14 values.** If Phase 6 exports anything, four places move together:
`src/index.ts`, the three numbers *and* the `VALUE_EXPORTS` array in `test/export-surface.test.ts`,
a predicate in `test-d/exports.test-d.ts`, and an `it` in `test/artifact.test.ts`. The last two are
the ones prior phases' research repeatedly forgot. Nothing may be added to `test/fixtures/` as a
sibling module — `scripts/pack-install-check.sh` copies that directory into a foreign scratch
project.

</code_context>

<specifics>
## Specific Ideas

- `dispatch("__proto__")` and `dispatch("constructor")` are named test cases, not hypotheticals.
- Criterion 1's mechanism is `p1 === p2` — Promise reference identity, not deep equality of results.
- The Phase 5 hand-forward completes here: `resolveBridge → null → offPageResult` end-to-end through
  a real `dispatch` is BRG-03's remaining half, and its Status cell in REQUIREMENTS.md carries that
  deferral openly.
- `_explanationHasExactlyThreeFields` (`04-06-SUMMARY.md:363`) goes red on any fourth `Explanation`
  field. If the dispatcher needs to surface something through `explain()`, that pin is the tripwire.
- `batch.signal → meta.signal`, `batch.userTurnId → meta.userTurnId` and
  `batch.deferUntilDelivered → meta.deferUntilDelivered` all forward **without a cast**
  (`01-12-SUMMARY.md:225-226`).
- The enforcement standard applies as always: a normalizer that *looks* like it rejects contradictory
  results without a test proving each rejection fires would be rejected. Every one of the twelve
  reason codes the dispatcher can emit needs a test that fails when its branch is removed.

</specifics>

<deferred>
## Deferred Ideas

- **A telemetry seam** → Phase 7, alongside the transport. SEC-02 is recorded as structurally
  satisfied here, with the reason, rather than claimed against a channel that does not exist.
- **The consent gate** (arming, drift detection, `consent_required` / `consent_stale` emission) →
  Phase 8. Phase 6 builds only the context shape that carries `ack`.
- **The WR-06 reversal window** stays open through Phase 8. If the user declines to ratify the flat
  shape, the discriminated union costs six errors and five test edits and is still free before
  publish.
- **`ConciergeConfig.normalizeSnapshot` is read by nothing in `src/`** (Phase 5 review IN-01). The
  path Phase 5 shipped is `captureSnapshot(bridge, id, normalize?)`. Wiring the config member is
  Phase 8's, where consent snapshots are actually captured.
- **Splitting `batch_aborted` out of `aborted`** — sanctioned only if a later phase finds it needs
  the distinction.
- **`ServerSafeConcierge`** and freezing the `createConcierge` return → Phase 9.

</deferred>
