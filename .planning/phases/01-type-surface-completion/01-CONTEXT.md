# Phase 1: Type surface completion - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase finalizes the **public type surface** in `packages/concierge/src/types.ts` and its
export list in `packages/concierge/src/index.ts`. It ships **no runtime** — the deliverable is
types plus a type-test suite that fails when a corrected defect is reintroduced.

In scope: the four verified remaining defects from ROADMAP Phase 1 notes — `ActionResult.reason`
open `string` (a), no readback sink so `readbackHash` has no producer (b), no server consent-token
shape (c), no composition/taint metadata (d) — plus the cheap additions the roadmap names
(`Snapshot` type parameter on `ActionDefinition`, a `scheduler?` seam, `stage`/`onStageChange` on
`Session`), plus TRN-01's demonstration that a transport is definable end to end with no vendor
event name in core.

Out of scope: any runtime implementation. `buildCatalog`, the consent kernel, the dispatcher, and
the readback/hash mechanisms belong to Phases 3–8. Also out of scope: `CONTRACT_VERSION`, which is
purely additive and lands in Phase 2 where the test that needs it lives.

**The property that relaxes every decision here:** nothing publishes until the whole v0.1 milestone
completes, so a Phase 1 type decision remains amendable through Phase 8 at zero cost. Where a
decision below chose the smaller commitment, this is why.

</domain>

<decisions>
## Implementation Decisions

### D-00 — Two roadmap claims are wrong; correct them first

The ROADMAP Phase 1 notes state that `deferUntilDelivered` "now passes a `DeliveryReport` with an
explicit `outcome`, making partial delivery representable." **Verified false on one of the two
sites.** Codebase scout found:

- `InvocationMeta.deferUntilDelivered` (`packages/concierge/src/types.ts:130`) — fixed, takes
  `(effect: (report: DeliveryReport) => void) => void`.
- `ToolBatch.deferUntilDelivered` (`packages/concierge/src/types.ts:436`) — **still carries the
  pre-fix signature** `(effect: (deliveredResponseId: string) => void) => void`.

`ToolBatch` is the transport-side hook, which is the one Success Criterion 1 is actually about. Fix
it to `DeliveryReport`. Note `ToolBatch` is an interface **consumers implement** — see D-09 — so this
is genuinely a would-be breaking change, unlike most of this phase.

Second correction: `AbandonReason` (`types.ts:80`) is declared and exported (`index.ts:20`) and
consumed by nothing. D-01 resolves it.

### D-01 — `ActionResult.reason` is a pure closed union

Field is written **`reason?: ReasonCode | undefined`** where
`type ReasonCode = AbandonReason | FailureReason`.

The explicit `| undefined` is load-bearing, not cosmetic. Under this repo's
`exactOptionalPropertyTypes: true`, a bare `reason?: ReasonCode` rejects both
`{ok: true, reason: undefined, message}` (TS2375) and the natural
`{reason: computeReason(), ...}` idiom where the computed value is `ReasonCode | undefined`. Adding
`| undefined` fixes both while still rejecting arbitrary strings, so Success Criterion 2 costs
nothing in ergonomics.

`AbandonReason` is **reused as a named subset**, not deleted — this closes the orphan defect and
keeps the MCP correspondence its doc comment already claims (`declined`/`cancelled` are exactly MCP
elicitation's explicit-refusal vs dismissal split).

The twelve codes, no padding:

| Source | Codes |
|---|---|
| `AbandonReason` (human-caused) | `declined`, `cancelled`, `superseded` |
| `FailureReason` (machine-caused) | `invalid_args`, `unknown_action`, `no_bridge`, `handler_error`, `aborted`, `consent_required`, `consent_stale`, `grade_unavailable` |

Notes for the planner: `batch_aborted` collapses into `aborted` unless Phase 6 needs the agent to
distinguish "your call was killed" from "the batch was killed". `grade_unavailable` is a *runtime*
code for capability degradation after reconnect only — CAT-04 throws at build time, so it is not a
build-failure code.

Verified consequences (TS 7.0.2, this repo's exact `tsconfig.base.json` flags): a handler returning
`"whoops"` fails with TS2322; exhaustive `switch` works (`const _n: never = r` compiles), so a code
added in Phase 6 or 8 forces every mapper to update; `ConsentPolicy.onMissing`
(`Pick<ActionResult, "reason" | "message">`, `types.ts:245`) and both frozen constants
(`USER_CANCELLED`, `USER_DECLINED`) survive untouched.

**Rejected — do not revive:**
- *Generic `ActionResult<R extends string = ReasonCode>`* — **verifiably dead**, not merely worse.
  `ActionResult<AppReason>` is not assignable to `Transport.respond(result: ActionResult)` (TS2345),
  and making `Transport` generic does not fix it: `R` would have to thread through `ActionHandler`,
  `ActionDefinition`, `ConsentPolicy`, `Concierge`, `Session`, and `SessionConfig`.
- *`` `app.${string}` `` escape hatch* — permanently destroys exhaustiveness; the template member
  never narrows away, so no switch fails to compile when a core code lands.
- *Discriminated union on `ok`* — breaks the committed surface:
  `Pick<ActionResult, "reason"|"message">` errors TS2344 (`keyof` a union is the key *intersection*),
  and every `.reason` read needs an `ok === false` guard, landing friction in the dispatcher and
  kernel.
- *A free-form `detail?` sibling* — viable, but adds a field redaction and telemetry must explicitly
  cover, or it becomes the covert PII channel SEC-02 exists to close.

### D-02 — `message` is unbranded `string` with a stated policy

Do **not** brand it. A branded `SafeMessage = string & {…}` rejects
``{ok: true, message: `Filtered to ${x}.`}`` (TS2322, verified) — the single most-written line in
the library. Length constraints are unexpressible in the type system anyway.

The stated policy, to live in the doc comment: **`message` is a best-effort human-facing sentence
and is never a consent artifact.** Concierge already enforces this structurally where it counts —
the `ConsentGrade` ladder exists *because* the agent reauthors `message` before the human sees it
(OWASP ASI09), and `attested` routes around it entirely via `readbackHash` over app-rendered bytes.

Ecosystem note for the doc: OpenAI Agents JS sends the model only
`"Tool execution was not approved."` with `status: 'completed'`, and has an open issue attributing
model hallucinations to exactly that missing machine-readable code. A closed `reason` plus a
documented-but-untrusted `message` is where the ecosystem is converging.

### D-03 — Readback sink returns a receipt; core owns canonicalization, the app injects the digest

The sink returns a **receipt**, not a bare hash string:
`{ hash, alg, canonicalization, canonical }`.

**Why not a bare `=> Promise<string>`:** canonicalization becomes an app bug with a verified
collision — `JSON.stringify({amount: 4180, coupon: undefined})` is byte-identical to
`JSON.stringify({amount: 4180})`, so two semantically different payloads hash the same. A
payload-level `toJSON` also silently rehashes something other than what was shown. That is the gate
failing while appearing to work, which is the exact failure class this milestone exists to prevent.

**Canonicalization is JCS (RFC 8785)** over `{payload, presented?}` — binding both the payload core
snapshot-compares and the literal string the app put on screen. This follows SPC, which hashes the
*structured values that were displayed*, not pixels.

**Carrying `canonical` alongside `hash` is deliberate.** It is WebAuthn's own reason for making
`clientDataJSON` an opaque byte array rather than a `DOMString`: intermediaries must not
parse-and-reserialize. Phase 8's confirm and any future server verification re-read these bytes
rather than re-deriving them.

**`DigestLike` goes on `ConciergeConfig`** next to `normalizeSnapshot`. This is the `AbortSignalLike`
precedent applied verbatim. Verified under `lib: ["ES2022"]` + `isolatedDeclarations`: `DigestLike`
compiles and accepts both browser `crypto.subtle` and Node `webcrypto.subtle` with zero
modification.

**MANDATORY — the variance trap.** The sink must use the generic-**function** form
`<P>(rb: Readback<P>) => Promise<ReadbackReceipt>`, following `SnapshotNormalizer`'s shape — **not**
a defaulted generic alias `ReadbackSink<Payload = unknown>`. Verified: a typed app sink
`(rb: Readback<Booking>) => …` fails to assign to the defaulted alias under
`exactOptionalPropertyTypes` (TS2322). This is the identical trap the roadmap already flagged for
`snapshotEquality`.

**Rejected — bundling SHA-256 in core.** The argument for it was that it keeps hashing synchronous
and so protects the "`dispatch` is NOT async" invariant. That argument does not hold: **arming
happens on delivery via `deferUntilDelivered`, which is already callback-shaped**, so `dispatch`'s
synchronous Promise-returning shape is untouched by an async digest. And `TextEncoder` is absent
under `lib: ["ES2022"]` too (verified TS2304, as are `crypto` and `btoa`), so core hand-rolls UTF-8
either way. Not worth owning unaudited crypto in the security-critical path for a benefit that
isn't real.

**Rejected — fusing present and observe into one attesting sink.** It would make `attested`
unforgeable by construction, but it collides with the already-shipped design:
`DeliveryReport.readbackHash` routes the hash back through `deferUntilDelivered`, not through a
blocking return. Get the same guarantee via D-05's union plus a separate `ReadbackAttestation` type
that Phase 8 requires before granting `attested` — keeping presentation and observation as distinct
types.

**Implementation split:** Phase 1 ships the *types*. The JCS encoder (~40 LOC) and hand-rolled UTF-8
(~15 LOC) land in Phase 8 with the kernel.

**Research context worth carrying forward:** no agent framework has any equivalent of this. AI SDK 6
`needsApproval`, OpenAI Agents JS `RunState.approve()`, CopilotKit `renderAndWaitForResponse`, and
the MCP 2026-07-28 RC all approve *a tool call by reference*; none binds approval to the bytes the
human saw, and the RC frames itself as traceability, explicitly not content integrity. The only real
prior art is browser-platform (WebAuthn / SPC).

### D-04 — Composition/taint metadata: `readsUntrusted` only, and it must be enforced

Ship **`readsUntrusted`** and cut `maxPerTurn`, `conflictsWith`, and `impact`.

| Field | Verdict | Reason |
|---|---|---|
| `readsUntrusted` | **Ship** | The only non-redundant one. Load-bearing here because two of the three lethal-trifecta legs are *structurally always on*: actions run inside the app the user is logged into, and `ActionResult.message` returns to the model. Untrusted ingress is the single variable leg. |
| `maxPerTurn` | **Cut — wrong location, not merely unenforced** | Runner-level in every framework checked (LangChain `ToolCallLimitMiddleware`, Agno `tool_call_limit`, OpenAI Agents JS `maxTurns`). Concierge already follows that convention with `commitWindowMs`/`dedupeWindowMs` on `ConciergeConfig`, where it is purely additive and exerts zero Phase 1 pressure. Vercel **deprecated** declaration-level `needsApproval` in AI SDK 6 and moved approval to call-site `toolApproval` — direct recent evidence that policy-shaped metadata drifts off the declaration. |
| `impact` | **Cut** | A second severity dial next to `consent.minGrade`, which CAT-04 already enforces at build time — and a weaker, unenforced one that can silently disagree with it. No framework ships a severity enum. |
| `conflictsWith` | **Cut** | Zero prior art as declaration metadata, and overlaps three existing mechanisms: stage scoping (absent from the catalog rather than rejected on call), `consent.requires`, and serial batch execution in `outputIndex` order. |

**Placement: sibling to `SideEffects`, not a member of it.** `SideEffects` is documented as the
MCP-hint mirror and currently maps 3-of-4. The missing fourth is `openWorldHint` — a name MCP is
actively reconsidering for conflating ingress with egress (six SEPs open, none merged; the
experimental successor work puts `untrusted` on *result* `_meta` rather than on the tool
declaration). Do not import a defective name into a block whose entire value is 1:1 fidelity. A
future `concierge-mcp` can still emit `openWorldHint: true` from `readsUntrusted` — a safe
over-approximation, since that hint already defaults to `true`.

**Enforcement is required, and it creates one cross-phase consequence.** A `readsUntrusted: true`
that nothing reads, sitting beside a redaction policy that genuinely fails closed (SEC-01), is the
"overstating what the client half proves" failure mode in miniature — the same failure PROJECT.md
records narrowing the core-value wording to avoid. So the marker must become a gate: **one
build-time predicate in CAT-05's exact shape** (`destructive` without a consent policy already
reports itself at build). See DEFERRED — this is a new requirement against Phase 3 or 4, and a
ROADMAP edit. **Phase 1 ships the field and the type-test only.**

### D-05 — Server consent token: reserve the *inbound* seam, produce nothing

Add **`challenge?: ServerChallenge`** to `ConsentAck` — server-issued, client-echoed, opaque,
**typed but never produced in v0.1**, so nothing emitted can be mistaken for proof.

**Why inbound and not outbound.** Every prior art puts minting authority where page JavaScript
cannot reach: WebAuthn's challenge is server-generated *and server-stored* (an echoed-but-unstored
challenge provides no replay protection at all — GHSA-gjjc-pcwp-c74m); SPC has the *browser* write
`total` and `payeeName` into `clientDataJSON` in UI the merchant cannot style; Stripe binds the
amount at PaymentIntent creation so the client only ever holds a handle; AP2's Cart Mandate is
signed by a hardware-backed device key. A Concierge-minted signed token — produced by the same page
context PITFALLS.md P6 already concedes is shared with every analytics tag and transitive
dependency — would be structurally decorative and would read far stronger than it is.

This matches the existing internal recommendation: PITFALLS.md P6 item 5 already calls for a
server-issued token bound to `{userTurnId, payloadHash, readbackHash, expiry}`, single-use.

**Paired change — make `attested ⇒ readbackHash` compiler-enforced.** Refactor `ConsentAck` so
`grade: "attested"` type-*requires* `readbackHash`. This invariant is currently only a doc comment
(`types.ts:257-265`). Verified under this repo's exact flags: it compiles, narrows correctly on
`ctx.ack.grade === "attested"`, and rejects constructing an `attested` ack without a hash.

**Accepted cost:** `ConsentAck` becomes a type alias union rather than an interface, so consumers
lose `extends` and declaration merging. Cheap now; expensive if deferred past Phase 8. Also, under
`exactOptionalPropertyTypes`, apps must **omit** `challenge` rather than spread `undefined` into it.

**Rejected — a transparent claims envelope** (`{claims: {contract, userTurnId, payloadHash,
snapshotHash, grade, readbackHash?, issuedAt, nonce}, proof?}`) produced in v0.1. Every claim would
be client-supplied, making it the precise shape of GHSA-gjjc-pcwp-c74m — it *looks* verifiable while
nothing verifies it. Active liability against this milestone's stated failure mode.

**Rejected — an opaque outbound `serverToken?: ConsentToken`.** Reserves the decorative half; its
security value is nil without a server-issued counterpart, and a name with no binding invites every
app to invent its own interior before v2 arrives.

**Also note:** leaving `ConsentAck` unchanged makes the wrong thing easy — `JSON.stringify(ack)` →
server reads `ack.grade === "attested"` is the path of least resistance and is exactly the
anti-pattern SEC-04 must document against. D-05 removes that affordance.

### D-06 — Type-test mechanism: `tsc --noEmit` over `*.test-d.ts`

Success Criterion 5 needs a suite that fails on regression, but Phase 2 owns the test runner and
ROADMAP's Parallelization section says Phases 1 and 2 run concurrently on disjoint files.

Use **`tsc --noEmit` over `*.test-d.ts` files with `@ts-expect-error` assertions**. Zero new
dependencies, and it keeps the two phases genuinely disjoint. Vitest's `expectTypeOf` would create a
real Phase 1 → Phase 2 dependency that the roadmap says does not exist.

Consequence to plan around: `package.json` pins `typescript@^5.7.0` while the stack decision calls
for `7.0.2` exactly. That is Phase 2's file, so Phase 1 stays disjoint — but **Phase 1's type tests
will run under TS 5 unless Phase 2 lands first.** All the verification behind D-01 through D-05 was
reproduced under both TS 7.0.2 and TS 5.9.3 with this repo's exact `tsconfig.base.json` flags, so no
decision here depends on which one runs.

The suite must assert at minimum the three regressions Success Criterion 5 names:
1. `snapshotEquality` degraded to `(a: unknown, b: unknown)` — see D-07.
2. A `requires` that widens the action's own name union — currently correct (`requires: string`); the
   test guards the regression.
3. A delivery hook that drops the completion reason — **currently failing on `ToolBatch`**, see D-00.

Plus, from this discussion: an arbitrary `reason` string is rejected (D-01); a typed readback sink
assigns to the seam (D-03's variance trap); an `attested` ack without `readbackHash` is rejected
(D-05); `readsUntrusted` is absent from the kernel's enforced input set until the Phase 3/4 gate
exists (D-04).

### D-07 — Thread `Snapshot` through the declaration chain

Confirmed by scout, not assumed. `ActionDefinition.consent?: ConsentPolicy` (`types.ts:350`) carries
no type argument, so `ConsentPolicy<Snapshot = unknown>` defaults and `snapshotEquality` really does
degrade to `(a: unknown, b: unknown)` — exactly where correctness matters.

Add a `Snapshot` type parameter to `ActionDefinition` and thread it:
`ActionDefinition` → `ActionHandler` → `ConsentAck` → `ConsentPolicy`.

Related defect in the same chain: `ActionHandler` accepts an `AckPayload` type parameter
(`types.ts:156`), but `ActionDefinition.handler` is typed `ActionHandler<InferOutput<Schema>, Bridge>`
(`types.ts:348`), dropping it — so `ack` is always `ConsentAck<unknown, unknown>`. Fix both together;
they are one chain.

This interacts with D-05: the `ConsentAck` interface → union refactor happens in this same chain.

### D-08 — Remaining roadmap-named additions, unchanged

Carry these in as stated in ROADMAP Phase 1 notes; no discussion needed:
- A `scheduler?` seam.
- `stage` and `onStageChange` on `Session`.
- TRN-01's demonstration: a second transport shape sharing no wire vocabulary with the first,
  proving a transport is definable end to end with no vendor event name in core. Phase 7 owns the
  *stub* transport, so Phase 1's demonstration is **type-level** — a `.test-d.ts` declaring two
  structurally unrelated transports against the same `Transport` interface.

### D-09 — The constructed-vs-implemented distinction (applies to every future scope call here)

Phase 1's premise is "a missing field becomes a breaking change after publish." **That premise only
holds for interfaces consumers *implement*.**

- **Implemented by consumers** — `Transport`, `TransportCapabilities`, `DeliveryReport`, `ToolBatch`,
  `Bridge`, `BridgeRegistry`. Adding a required member here *is* breaking. This is where Phase 1
  urgency is real (and why D-00's `ToolBatch` fix matters).
- **Constructed by consumers** — `ActionDefinition`, `ConsentPolicy`, `ActionResult`,
  `ConciergeConfig`, `StageDefinition`. Adding an *optional* property post-publish is a minor bump,
  not breaking.

D-04 leans on this: `readsUntrusted` on `ActionDefinition` is non-breaking to add later, which is why
"cut all four" was a legitimate answer rather than a punt, and why the real question was whether to
fund the gate. Apply the same test to any addition the planner is tempted to make.

Caveat: the later-addition freedom is only real while a field's default stays permissive. A future
version that makes such a field load-bearing, or flips its default, **is** breaking.

### Claude's Discretion

- **D-01/D-02 (`ActionResult.reason` and the `message` policy)** — user answered "you decide". The
  shape above is the recommendation as researched; the exact `FailureReason` membership is the part
  most likely to need adjustment once Phase 6's dispatcher enumerates its real failure paths, and
  adding a member later is additive-safe (see D-09).
- Naming throughout (`ReasonCode`, `FailureReason`, `ReadbackReceipt`, `DigestLike`,
  `ServerChallenge`, `ReadbackAttestation`) is provisional — chosen to read consistently with the
  existing `AbortSignalLike` / `SnapshotNormalizer` conventions. The planner may rename; the shapes
  are what is locked.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The contract being amended
- `packages/concierge/src/types.ts` — the design contract itself. Every decision above edits this
  file. Line references in this document are against the state at 2026-07-27.
- `packages/concierge/src/index.ts` — the export surface. New exported types must be added here;
  `AbandonReason` is already exported at line 20.
- `tsconfig.base.json` — `lib: ["ES2022"]`, `isolatedDeclarations: true`,
  `exactOptionalPropertyTypes: true`, `strict`. All verification behind D-01 to D-05 was run under
  these exact flags. `exactOptionalPropertyTypes` in particular drives D-01's `| undefined` and
  D-05's omit-don't-spread caveat.

### Project decisions that constrain this phase
- `.planning/PROJECT.md` — Core Value, Constraints, and Key Decisions. Note especially the
  2026-07-27 wording note on narrowing an unfalsifiable claim; D-04's enforcement requirement and
  D-05's produce-nothing stance both follow from it.
- `.planning/ROADMAP.md` §"Phase 1: Type surface completion" — goal, five success criteria, and the
  notes enumerating the verified remainder. **D-00 corrects one claim in those notes.**
- `.planning/ROADMAP.md` §Parallelization — the Phase 1 ∥ Phase 2 disjointness that D-06 preserves.
- `.planning/REQUIREMENTS.md` — TRN-01 (this phase's only mapped requirement); SEC-01 to SEC-04 and
  CON-01 to CON-09 for what these types must eventually carry; the v2 section for why the server
  token mechanism is out of scope.
- `.planning/STATE.md` — accumulated decisions; note the two stale PROJECT.md rows flagged there.

### Research that produced the constraints
- `.planning/research/PITFALLS.md` §P6 — MCP attack classes on a same-origin catalog. **Item 5 is
  the direct source for D-05**: a server-issued token bound to
  `{userTurnId, payloadHash, readbackHash, expiry}`, single-use. Also the "every third-party script
  has identical authority" threat model that kills the outbound-token option.
- `.planning/research/STACK.md` — TS 7.0.2 + `isolatedDeclarations`, the no-DOM enforcement
  mechanism, and the `@standard-schema/spec` dependency posture.
- `.planning/research/ARCHITECTURE.md`, `.planning/research/SUMMARY.md`,
  `.planning/research/FEATURES.md` — the sixteen-defect list this phase's remainder was extracted
  from.

### Public-facing statements these types must not contradict
- `README.md` §"Design contract" — six numbered points. Point 2 ("Every action returns
  `{ok, message}`") governs D-01/D-02; point 5 ("Consent is graded, and it fails closed") governs
  D-03 and D-05.
- `CONTRIBUTING.md` — the non-negotiables list.

### External specs the decisions cite
No files in-repo; these are the load-bearing external references, recorded so the planner does not
re-derive them:
- RFC 8785 (JSON Canonicalization Scheme) — D-03's canonicalization rule.
- W3C Secure Payment Confirmation + WebAuthn Level 3 — D-03's receipt shape (opaque
  `clientDataJSON` bytes) and D-05's server-stored-challenge requirement.
- GHSA-gjjc-pcwp-c74m — client-supplied challenge accepted in place of a server-stored value; the
  concrete failure D-05 avoids.
- MCP tool-annotation SEPs 1913 / 1984 and `experimental-ext-tool-annotations` — D-04's reason for
  not placing `readsUntrusted` inside the MCP-mirroring `SideEffects` block.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AbortSignalLike` (`types.ts:45`)** — the established pattern for declaring a structural
  stand-in for a platform type without pulling in the DOM lib. **D-03's `DigestLike` is this pattern
  applied verbatim**, and it is verified to accept both browser `crypto.subtle` and Node
  `webcrypto.subtle` unmodified.
- **`SnapshotNormalizer` (`types.ts:280`)** — `<T>(value: T) => T`, the generic-**function** form.
  **D-03's readback sink must copy this shape exactly**; the defaulted-generic-alias alternative
  fails to accept a typed app sink (TS2322).
- **`AbandonReason` (`types.ts:80`)** — currently orphaned; D-01 reuses it as a named subset of
  `ReasonCode` rather than deleting it.
- **`CONSENT_GRADE_ORDER` (`types.ts:205`)** — the frozen ordered grade array. D-05's union refactor
  must keep it assignable.

### Established Patterns
- **No-DOM is mechanically enforced, not reviewed.** `lib: ["ES2022"]` makes `document` a compile
  error (TS2584). Verified absent for the same reason: `crypto`, `TextEncoder`, `btoa` (all TS2304).
  This directly shapes D-03 — core cannot hash or UTF-8-encode without either injection or
  hand-rolled code.
- **Doc comments carry the *why*, including rejected alternatives.** `ConsentPolicy.requires`
  (`types.ts:212-226`) is the model: it explains the name-union corruption that made the typed
  version wrong. New types from D-03 to D-05 should match this density — the file is the design
  contract, not just declarations.
- **Frozen constants for the human-caused results** — `USER_CANCELLED`, `USER_DECLINED`
  (`types.ts:88`, `:94`). Both are verified to survive D-01 untouched.
- **`Object.freeze` + `Readonly<>` for anything the agent or app must not mutate.**

### Integration Points
- **`ConsentAck` is the hinge.** D-03 (readback receipt → `readbackHash`), D-05 (`challenge?` and
  the `attested` union), and D-07 (`Snapshot` threading) all land on it. Sequence them as one
  change, not three.
- **`ConciergeConfig` gains two seams** — `digest?: DigestLike` and the readback sink — joining the
  existing `normalizeSnapshot`. Same injection convention.
- **`ToolBatch` ↔ `InvocationMeta`** — the two `deferUntilDelivered` sites that D-00 must bring back
  into agreement.
- **`ActionDefinition` → `ActionHandler` → `ConsentAck` → `ConsentPolicy`** — one type-parameter
  chain, currently broken in two places (D-07).

</code_context>

<specifics>
## Specific Ideas

- **"No agent framework has any equivalent."** Verified across AI SDK 6 (`needsApproval`), OpenAI
  Agents JS (`RunState.approve()`), CopilotKit (`renderAndWaitForResponse`), and the MCP 2026-07-28
  RC: all approve *a tool call by reference*, none binds approval to the bytes the human saw. The RC
  frames itself as traceability, explicitly not content integrity. This is the sentence the readback
  sink exists to make false about Concierge — worth stating in the docs when D-03 ships.
- **Prefer fewer, better-justified fields.** D-04 cut three of four proposed fields; the planner
  should not reinstate them as "cheap while we're in here."
- **Where a decision could be smaller, it was made smaller** — because nothing publishes until v0.1
  completes. D-05 produces nothing; D-04 ships one field, not four; D-03 injects rather than bundles.

</specifics>

<deferred>
## Deferred Ideas

- **`readsUntrusted` build-time gate → new requirement against Phase 3 or 4.** D-04 requires the
  marker be enforced, not declared-only. The check is one predicate in CAT-05's exact shape
  (`destructive` without a consent policy already reports itself at build). **This needs a ROADMAP
  edit via `/gsd-phase` before Phase 3 planning.** Open sub-questions for that requirement: error vs
  warn, and whether `readOnly: true` combined with `readsUntrusted: true` also gates — ingress into
  model context is itself the injection vector, so "read-only" is not automatically safe.
- **`maxPerTurn` on `ConciergeConfig`, not `ActionDefinition`** — if it ever ships. Purely additive
  alongside `commitWindowMs`/`dedupeWindowMs`; exerts no Phase 1 pressure. Not scheduled.
- **JCS encoder + hand-rolled UTF-8 in core (~55 LOC)** → Phase 8, with the consent kernel. Phase 1
  ships only the types they satisfy. Must fail closed (throw) on non-JSON values, where
  `JSON.stringify` silently drops them.
- **`ReadbackAttestation` — binding the observed human act to the hash** → Phase 8. Keeps
  presentation and observation as distinct types while making an `attested` ack unconstructable
  without both. Phase 1 may declare the type; Phase 8 makes the kernel require it.
- **Server-side verification of `ServerChallenge`** → v2, as already scheduled in REQUIREMENTS.md.
  SEC-04 in v0.1 remains documentation-only.
- **`CONTRACT_VERSION`** → Phase 2, as the roadmap already states. Not re-opened.
- **Bumping `typescript@^5.7.0` → `7.0.2` and `pnpm@10.33.0` → 11** → Phase 2. Noted here only
  because D-06's type tests run under whichever is installed; no decision above depends on it.
- **Correcting the two stale PROJECT.md Key Decisions rows** (Standard Schema "inlined" — it is a
  real dependency; and the promised `concierge-zod` bridge — REQUIREMENTS.md Out of Scope deletes
  it) → next `/gsd-transition`. Already flagged in STATE.md.

</deferred>

---

*Phase: 1-Type surface completion*
*Context gathered: 2026-07-27*
