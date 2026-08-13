# Phase 1: Type surface completion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 1-Type surface completion
**Areas discussed:** ActionResult.reason, Readback sink, Composition & taint metadata, Server consent token
**Mode:** advisor (research-backed comparison tables, calibration tier `standard`)

Four `gsd-advisor-researcher` agents ran in parallel, one per area. Each verified its claims against
the repo's actual `tsconfig.base.json` flags rather than reasoning from documentation.

---

## Gray areas offered

Five were identified; `AskUserQuestion` caps options at four, so the fifth (type-test mechanism) was
presented as a stated recommendation in prose rather than as a choice. The user did not override it.

| Area | Offered | Selected |
|---|---|---|
| ActionResult.reason | ✓ | ✓ |
| Readback sink | ✓ | ✓ |
| Composition & taint metadata | ✓ | ✓ |
| Server consent token | ✓ | ✓ |
| Type-test mechanism | stated, not offered | accepted by silence |

Not offered as gray areas — the roadmap already states the intent and scouting confirmed the defect,
so these were treated as derivable: `Snapshot` threading through the declaration chain, the
`scheduler?` seam, `stage`/`onStageChange` on `Session`, and the TRN-01 second-transport
demonstration.

---

## ActionResult.reason

| Option | Description | Selected |
|--------|-------------|----------|
| Pure closed union | `reason?: ReasonCode \| undefined`, 12 codes, `AbandonReason` folded in as a named subset; `message` unbranded with a documented policy | ✓ |
| Closed union + `` `app.${string}` `` hatch | Apps mint their own codes without a core release; loses exhaustiveness across Phases 6–8 | |
| Closed union + free-form `detail?` | Agent branches on the fixed set, app context lands in `detail`; requires extending SEC-02's redaction rule | |
| Discriminated union on `ok` | Failure-without-a-code becomes unrepresentable; accepts the `onMissing` Pick rewrite and narrowing at every read site | |
| Generic `ActionResult<R>` | *Withdrawn before the question was asked* — verified dead | |

**User's choice:** "you decide" → pure closed union.

**Notes:** The generic option was floated in the gray-area framing and withdrawn on research:
`ActionResult<AppReason>` is not assignable to `Transport.respond(result: ActionResult)` (TS2345),
and making `Transport` generic does not fix it — `R` would have to thread through six more public
types. Reported as a closed question rather than left on the table.

Two verified findings drove the pick over the alternatives: the template-literal hatch permanently
destroys exhaustiveness (the member never narrows away, so `const _n: never = r` fails even with all
core cases handled), and the discriminated union breaks `ConsentPolicy.onMissing` at `types.ts:245`
with TS2344 because `keyof` a union is the key intersection. The `detail?` option was the closest
runner-up and was set aside on the SEC-02 covert-PII-channel risk rather than on ergonomics.

The `| undefined` in `reason?: ReasonCode | undefined` came out of `exactOptionalPropertyTypes`
testing, not from the original framing — a bare `reason?: ReasonCode` rejects the natural
`{reason: computeReason(), ...}` idiom.

---

## Readback sink

| Option | Description | Selected |
|--------|-------------|----------|
| Opaque sink → bare hash string | `<P>(rb: Readback<P>) => Promise<string>`; smallest surface, canonicalization is the app's burden | |
| Receipt-returning sink; core owns JCS, app injects `DigestLike` | Returns `{hash, alg, canonicalization, canonical}`; determinism becomes a core invariant | ✓ |
| Same receipt shape, core bundles a dependency-free SHA-256 | One seam instead of two; synchronous hashing; ~1KB of hand-rolled crypto | |
| Attesting sink — present and observe fused | Returns `{hash, act, observedAtMs}`; makes `attested` unforgeable by construction | |

**User's choice:** Receipt-returning sink with injected `DigestLike`.

**Notes:** The bare-string option was eliminated by a reproduced collision rather than an argument —
`JSON.stringify({amount: 4180, coupon: undefined})` is byte-identical to `{amount: 4180}`, and a
payload-level `toJSON` silently rehashes something other than what was displayed.

I overrode the research on the sync-vs-async point. It argued bundling SHA-256 preserves synchronous
hashing and so protects the "`dispatch` is NOT async" invariant; that does not hold, because arming
happens on delivery through `deferUntilDelivered`, which is already callback-shaped. The research's
own finding that `TextEncoder` is absent under `lib: ["ES2022"]` (so core hand-rolls UTF-8 either
way) further eroded the bundling case.

The attesting-sink option was the most intellectually honest answer to "how does the observed human
act get bound to the hash," and was rejected on a concrete collision with shipped design:
`DeliveryReport.readbackHash` already routes the hash back through `deferUntilDelivered`, not through
a blocking return. Its guarantee is preserved via a separate `ReadbackAttestation` type deferred to
Phase 8.

Non-negotiable detail surfaced during research: the sink must use the generic-function form, not a
defaulted generic alias — a typed app sink fails to assign to `ReadbackSink<Payload = unknown>`
(TS2322). This is the same variance trap the roadmap already flagged for `snapshotEquality`.

---

## Composition & taint metadata

| Option | Description | Selected |
|--------|-------------|----------|
| A. Cut all four | Zero unenforced-safety-field surface; adding the field later is non-breaking | |
| B. `readsUntrusted` only, composed into a build-time gate | Field is enforced, so the honesty question dissolves; adds a requirement to Phase 3 or 4 | ✓ |
| C. `readsUntrusted` only, declared-only in an `advisory` container | Settles the public shape without funding enforcement; container name is the caveat | |
| D. All four as a declared-only `composition?` block | One decision, no revisit | |

**User's choice:** B — `readsUntrusted` only, enforced, with the gate filed as a new Phase 3/4
requirement.

**Notes:** Option D collapsed on placement rather than on principle: `maxPerTurn` is runner-level in
every framework checked, `impact` duplicates the already-enforced `consent.minGrade` axis, and
`conflictsWith` has no prior art as declaration metadata. Vercel's deprecation of declaration-level
`needsApproval` in AI SDK 6 (moved to call-site `toolApproval`) was cited as direct recent evidence
that policy-shaped metadata drifts off the declaration.

Option A was genuinely competitive, not a straw man, because of the constructed-vs-implemented
finding — `ActionDefinition` is constructed by consumers, so an optional field is additive-safe
post-publish, which means Phase 1's whole urgency premise does not apply to this defect. That
reduced the real question to "is funding the gate worth it now." B won on the project's own
character: an unenforced safety field beside a redaction policy that genuinely fails closed is the
failure mode PROJECT.md records narrowing the core-value wording to avoid.

The user accepted the cross-phase consequence explicitly — the option text named it as a new Phase
3/4 requirement.

---

## Server consent token

| Option | Description | Selected |
|--------|-------------|----------|
| A. Commit nothing in Phase 1 | Nothing publishes until v0.1 completes, so Phase 8 can add it | |
| B. Opaque branded outbound token | `serverToken?: ConsentToken` on `ConsentAck`, always `undefined` in v0.1 | |
| C. Transparent claims envelope | `{claims: {...}, proof?}` with claims produced in v0.1 | |
| D. Inbound challenge seam + type-enforced evidence | `challenge?: ServerChallenge` (never produced in v0.1) + `attested ⇒ readbackHash` union | ✓ |

**User's choice:** D.

**Notes:** C was rejected as an active liability rather than merely over-committed — every claim
would be client-supplied, which is the exact shape of GHSA-gjjc-pcwp-c74m, where a server accepts a
client-supplied challenge in place of a server-stored value. It looks verifiable while nothing
verifies it, which is this milestone's named failure mode.

B reserves the decorative half: an outbound token minted by page JavaScript, in a threat model
(PITFALLS.md P6) that already concedes every third-party script has identical authority, has no
security value without a server-issued counterpart.

A was argued honestly and nearly won — the roadmap's stated reason for putting this in Phase 1
("cannot wait, it's a public type") is weakened by the no-publish-until-v0.1 property. It lost
because leaving `ConsentAck` unchanged makes `JSON.stringify(ack)` → server trusts `ack.grade` the
path of least resistance, which is precisely the anti-pattern SEC-04 must document against.

The `attested ⇒ readbackHash` union came out of research as a bonus rather than from the original
framing, and turned out to be the most Phase-1-shaped deliverable in the whole discussion: an
invariant currently living in a doc comment, made compiler-checkable, provable by a type-test suite,
in a phase that ships no runtime.

---

## Type-test mechanism (stated, not offered)

Recommended `tsc --noEmit` over `*.test-d.ts` with `@ts-expect-error`, over Vitest's `expectTypeOf`.
Rationale: `expectTypeOf` would create a real Phase 1 → Phase 2 dependency that ROADMAP's
Parallelization section says does not exist. Not overridden.

---

## Claude's Discretion

- **ActionResult.reason and the `message` policy** — user answered "you decide". Recorded as D-01
  and D-02 with the researched shape. The exact `FailureReason` membership is flagged in CONTEXT.md
  as the part most likely to shift once Phase 6 enumerates its real dispatcher failure paths.
- **Naming** — `ReasonCode`, `FailureReason`, `ReadbackReceipt`, `DigestLike`, `ServerChallenge`,
  `ReadbackAttestation` are provisional, chosen to read consistently with existing `AbortSignalLike`
  / `SnapshotNormalizer` conventions. Shapes are locked; names are not.
- **Type-test mechanism** — recommended rather than asked, and accepted without comment.

---

## Findings from codebase scout (not gray areas — defects)

Surfaced before the discussion and folded into CONTEXT.md as D-00 and D-07:

- `ToolBatch.deferUntilDelivered` (`types.ts:436`) still carries the pre-fix
  `(deliveredResponseId: string)` signature, while `InvocationMeta.deferUntilDelivered`
  (`types.ts:130`) was fixed to `DeliveryReport`. The ROADMAP Phase 1 notes claim this defect is
  closed; it is closed on one of two sites, and the unfixed one is the transport-side hook that
  Success Criterion 1 is actually about.
- `AbandonReason` is declared and exported and consumed by nothing.
- `ActionDefinition.consent?: ConsentPolicy` carries no type argument, so `snapshotEquality` really
  does degrade to `(a: unknown, b: unknown)` — the exact regression Success Criterion 5 names.
- `ActionHandler` accepts an `AckPayload` parameter that `ActionDefinition.handler` drops.

## Deferred Ideas

Recorded in full in CONTEXT.md `<deferred>`. Summary:

- `readsUntrusted` build-time gate → new requirement against Phase 3 or 4; needs a ROADMAP edit.
- `maxPerTurn` → `ConciergeConfig` if it ever ships; not scheduled.
- JCS encoder + hand-rolled UTF-8 (~55 LOC) → Phase 8.
- `ReadbackAttestation` binding the observed human act → Phase 8.
- Server-side verification of `ServerChallenge` → v2, already scheduled.
- `CONTRACT_VERSION`, and the `typescript`/`pnpm` version bumps → Phase 2.
- Two stale PROJECT.md Key Decisions rows → next `/gsd-transition`.

No scope creep was attempted during this discussion; every deferred item above came from research
findings or scouting, not from the user proposing new capabilities.
