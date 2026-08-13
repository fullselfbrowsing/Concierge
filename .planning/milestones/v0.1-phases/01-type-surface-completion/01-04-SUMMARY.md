---
phase: 01-type-surface-completion
plan: 04
subsystem: types
tags: [typescript, consent, readback, canonicalization, branded-types, variance, type-testing, webauthn]

# Dependency graph
requires:
  - phase: 01-01
    provides: "tsconfig.test-d.json (the src + test-d program) and test-d/_assert.ts (Expect / Equals / Assignable / Not)"
  - phase: 01-02
    provides: "the measured one-line-predicate rule, without which every assertion here would have failed anonymously"
  - phase: 01-03
    provides: "the check-the-diagnostic-COUNT-not-just-the-exit-code discipline, and the prove-the-assertions-the-plan-does-not-name precedent"
provides:
  - "Readback<Payload> — { payload, presented? }, the sink's input; JCS runs over both so neither can drift from the other"
  - "ReadbackReceipt — { hash, alg: \"SHA-256\", canonicalization: \"JCS\", canonical: Uint8Array }, self-describing and carrying the bytes"
  - "ReadbackSink — the generic-FUNCTION seam <P>(readback: Readback<P>) => Promise<ReadbackReceipt>"
  - "DigestLike — structural SubtleCrypto stand-in, METHOD syntax, the deliberate opposite of snapshotEquality"
  - "ServerChallenge — branded string over a module-private unique symbol; inbound-only, unmintable without a cast"
  - "DeliveryReport.readbackHash doc now names ReadbackSink/ReadbackReceipt as its producer, closing the dead end"
  - "test-d/consent.test-d.ts part 1 — six named predicates, two directives, three sink fixtures, exports nothing"
  - "Four-mutant defect-first proof; M5 observed firing BOTH members of the escapee-1 pair"
affects: [01-05, 01-06, 01-07, 01-08, 01-09, phase-08-consent-kernel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Receipt over bare value at a hashing seam: return the rule and the bytes, not just the digest, so no verifier re-serializes"
    - "Branded string over a module-private `unique symbol` to make a produce-nothing rule compiler-enforced rather than documented"
    - "Deliberate variance asymmetry between adjacent seams, with each doc comment naming the other as the opposite"
    - "Honest labelling of positives: a test that cannot fail under the regression it appears to cover says so in a comment"
    - "Type-test predicates written on ONE line so tsc echoes the alias name rather than the predicate body"

key-files:
  created:
    - packages/concierge/test-d/consent.test-d.ts
  modified:
    - packages/concierge/src/types.ts

key-decisions:
  - "ReadbackSink is a generic function for the reason that is actually testable — it rejects a type argument (TS2315) — not the assignability difference D-03 originally claimed, which a prototype disproved"
  - "_sinkShape and _sinkTakesNoTypeArgs are a PAIR; M5 was verified to fire both, since a pair where only one member fires is not a pair"
  - "DigestLike uses METHOD syntax and snapshotEquality stays function-property; both doc comments name the other as the deliberate opposite and record that only snapshotEquality's syntax has a mutant"
  - "The DigestLike positive is documented in the suite as a constructibility proof and explicitly NOT a syntax guard — it stays green under the wrong syntax"
  - "ReadbackReceipt.canonical typed Uint8Array — the bytes that were hashed, following WebAuthn's clientDataJSON being opaque bytes rather than a string"
  - "Readback.presented left as `presented?: string` without an explicit `| undefined`, matching every optional in the file except the one D-01 singled out"
  - "ReadbackAttestation NOT declared — D-12 item 1 defers it to Phase 8, which designs the kernel that consumes it"
  - "ConsentAck untouched — verified byte-identical against base; it is plan 01-05's hinge"
  - "index.ts left untouched; the export surface is plan 01-08's deliverable"

patterns-established:
  - "Defect-first by mutation, extended past the plan's mandate: four mutants for six predicates and two directives"
  - "Restore from git and assert `git diff --exit-code` after every mutant, so no broken state can be committed"
  - "Never write a forbidden token in prose — a doc comment quoting the rejected form breaks the acceptance grep that guards it"

requirements-completed: [SC-3, SC-7e]

# Metrics
duration: 41min
completed: 2026-07-28
---

# Phase 01 Plan 04: Readback Seam, Injected Digest, and Server-Challenge Brand Summary

**`readbackHash` finally has a producer: a sink that returns a receipt carrying the algorithm, the canonicalization rule, and the exact bytes that were hashed — pinned to the generic-function form by the one assertion pair that actually detects the regression, rather than the one that looks like it does.**

## Performance

- **Duration:** ~41 min
- **Started:** 2026-07-28T09:12:00Z
- **Completed:** 2026-07-28T09:53:00Z
- **Tasks:** 2/2
- **Files modified:** 2 (1 created, 1 modified) — `+374 / -2`

## Accomplishments

- **Defect (b) is closed.** `DeliveryReport.readbackHash` pointed at `ConsentAck.readbackHash` and nothing pointed at *it*. The chain now runs `ReadbackSink → ReadbackReceipt.hash → DeliveryReport.readbackHash → ConsentAck.readbackHash`, and the doc comment names each link.
- **Escapee 1 is caught by a pair that was watched firing together.** The obvious assertion — "a payload-specific app sink is rejected" — is green under *both* shapes, because neither accepts one. M5 produced exactly two diagnostics, `TS2344` on `_sinkShape` and `TS2578` on `_sinkTakesNoTypeArgs`, matching VALIDATION's battery row exactly.
- **The one seam that cannot be tested is documented as such rather than mistaken for a guarded one.** `DigestLike`'s method syntax has no mutant and cannot get one. Both the declaration and the test file say so in as many words, and this SUMMARY records it as a review-only risk.
- **Two unguarded invariants were found and closed.** `ReadbackReceipt.alg` and `.canonicalization` were declared as literals with nothing asserting they stayed literals — `"SHA-256"` assigns happily to a widened `string`, so the fixture alone proved nothing. Two predicates now pin them; both were proven to fire.
- **A direction error in the design contract was caught before it shipped.** See Deviation 1.

## Task Commits

1. **Task 1: Declare the readback seam, the injected digest, and the server-challenge brand (D-03, D-05 first half)** — `bb05a40` (feat)
2. **Task 2: Author consent.test-d.ts part 1 defect-first — including escapee 1 (SC-3, SC-7e)** — `cd75773` (test)

## Files Created/Modified

- `packages/concierge/src/types.ts` (modified) — `+177 / -2`. The two removed lines are exactly the two doc-comment lines replaced on `DeliveryReport.readbackHash`. Three hunks only: the `DeliveryReport` doc, the `ConsentPolicy.snapshotEquality` doc, and the new block after `SnapshotNormalizer`.
- `packages/concierge/test-d/consent.test-d.ts` (created) — 199 lines, exports nothing, two directives.

## What was declared

| Name | Line | Shape |
|---|---|---|
| `Readback<Payload = unknown>` | 432 | `{ payload: Payload; presented?: string }` |
| `ReadbackReceipt` | 459 | `{ hash: string; alg: "SHA-256"; canonicalization: "JCS"; canonical: Uint8Array }` |
| `ReadbackSink` | 503 | `<P>(readback: Readback<P>) => Promise<ReadbackReceipt>` |
| `DigestLike` | 539 | one member, `digest(...)` in **method** syntax |
| `ServerChallenge` | 565 | `string & { readonly [serverChallengeBrand]: true }` |

`serverChallengeBrand` is declared at line 543 and is **not** exported.

**`canonical` is `Uint8Array`** — the bytes that were hashed, not a string. D-03 does not fix the field's type; this follows the reason D-03 gives for carrying it at all, which is WebAuthn making `clientDataJSON` an opaque byte array rather than a `DOMString` so intermediaries cannot parse-and-reserialize. A `string` would invite exactly that. `ArrayBuffer` and `ArrayBufferView` both resolve under `lib: ["ES2022"]` (re-confirmed by this build), so no platform typing was needed.

## The escapee, and why the obvious test is worthless here

The naive assertion is "a typed app sink fails to assign to `ReadbackSink`". It is **valid but vacuous**: RESEARCH's assignability matrix shows a payload-specific sink `(rb: Readback<Booking>) => …` fails under the generic function *and* under a defaulted alias, because the parameter position is contravariant and the seam is called with `Readback<X>` for every `X`. There is no contrast state, so that assertion is green on a broken contract.

Both real discriminators are in the file, and the comment above them states the reasoning so a future reader does not "simplify" them away:

- `_sinkShape` — `Equals<ReadbackSink, <P>(readback: Readback<P>) => Promise<ReadbackReceipt>>`, the structural pin.
- `_sinkTakesNoTypeArgs` — `ReadbackSink<Booking>` under a suppression directive. Correct form → TS2315, directive consumed. Defaulted alias → compiles, directive unused, TS2578.

The type-preservation *call site* (`sink({ payload: booking })`) is in the file as a positive and is labelled as one: `P` infers as `Booking` under the correct form, but the return type is `Promise<ReadbackReceipt>` under both, so that line **stays green** through the regression. Type preservation is observable only inside a sink body, never at the call site.

## Defect-First Proof — four mutants, all observed

Each mutation was applied to `packages/concierge/src/types.ts`, typechecked with `--pretty`, then restored with `git checkout --` and confirmed byte-identical by `git diff --exit-code` before the next. `test-d/consent.test-d.ts` was never mutated and no broken state was committed. Colour escapes stripped.

### M5 (mandatory) — `ReadbackSink` as a defaulted generic alias

Mutation: `export type ReadbackSink<Payload = unknown> = (readback: Readback<Payload>) => Promise<ReadbackReceipt>;`

**Exit code 2. Exactly 2 errors — matching VALIDATION's battery row `TS2344 (_sinkShape) + TS2578 (_sinkTakesNoTypeArgs)`. Both members of the pair fired.**

```
test-d/consent.test-d.ts:127:26 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
127 type _sinkShape = Expect<Equals<ReadbackSink, <P>(readback: Readback<P>) => Promise<ReadbackReceipt>>>;

test-d/consent.test-d.ts:132:1 - error TS2578: Unused '@ts-expect-error' directive.
132 // @ts-expect-error - ReadbackSink takes no type arguments; it is a generic function, not an alias generic over the payload

Found 2 errors in the same file, starting at: test-d/consent.test-d.ts:127
```

Run twice — once on the file as first written, and again after the two receipt predicates were added, to confirm the count stayed at 2 rather than drifting off the battery. It did.

### M-a (extra) — `ServerChallenge` unbranded

Mutation: `export type ServerChallenge = string;`. **Exit code 2, 2 errors.** D-05's produce-nothing rule is genuinely compiler-enforced, and the predicate and the directive both carry it:

```
test-d/consent.test-d.ts:182:47 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
182 type _challengeNotMintableFromString = Expect<Not<Assignable<string, ServerChallenge>>>;

test-d/consent.test-d.ts:190:1 - error TS2578: Unused '@ts-expect-error' directive.
190 // @ts-expect-error - a ServerChallenge cannot be constructed from a plain string
```

### M-b (extra) — `ReadbackReceipt.alg` widened to `string`

**Exit code 2, 1 error.** Before the predicate existed, this mutation produced **zero** diagnostics.

```
test-d/consent.test-d.ts:67:36 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
67 type _receiptAlgIsLiteral = Expect<Equals<ReadbackReceipt["alg"], "SHA-256">>;
```

### M-c (extra) — `ReadbackReceipt.canonicalization` widened to `string`

**Exit code 2, 1 error.**

```
test-d/consent.test-d.ts:70:49 - error TS2344: Type 'false' does not satisfy the constraint 'true'.
70 type _receiptCanonicalizationIsLiteral = Expect<Equals<ReadbackReceipt["canonicalization"], "JCS">>;
```

### The mutant that does not exist

**There is no mutant for `DigestLike`'s method syntax, and none was invented.** The plan is explicit that inventing one would be worse than having none, and it is right: no in-repo edit can make a wrong `DigestLike` fail. The discriminator is that the DOM lib defines `BufferSource` as `ArrayBufferView<ArrayBuffer> | ArrayBuffer` while `@types/node` defines it as a union of concrete typed-array types, and **neither typing may be installed here** — `@types/node` in particular pulls DOM-adjacent globals and defeats the no-DOM guarantee `lib: ["ES2022"]` enforces.

`_digestAccepted` is a **constructibility positive only**. A mock whose `algorithm` parameter is `string | { name: string }` assigns under method syntax *and* under function-property syntax, because contravariance accepts the wider parameter either way, so it stays green through the regression. Its guards are:

1. the method-syntax grep — `grep -v '^[[:space:]]*[*/]' src/types.ts | grep -c "digest("` returns **1**, and `grep -c 'digest:'` returns **0**;
2. the doc comment on the declaration, written as the last line of defence;
3. code review.

## The deliberate asymmetry, and its asymmetric enforcement

| Seam | Required syntax | Why | Guarded by a mutant? |
|---|---|---|---|
| `DigestLike.digest` | **method** | Method parameters are bivariant, and bivariance is the only thing that accepts both browser `crypto.subtle` and Node `webcrypto.subtle` | **No — and cannot be.** Grep + doc comment + review only |
| `ConsentPolicy.snapshotEquality` | **function-property** | Under method syntax bivariance lets a `(a: Booking, b: Booking)` comparator assign to `ConsentPolicy<unknown>`, and the guard stops guarding | **Yes** — mutant **M9**, whose single symptom is **TS2578 on `_policyDegraded`** in `actions.test-d.ts` (plan 01-06) |

Both doc comments state that their syntax is deliberate, name the other as the deliberate opposite, warn that a reviewer who normalizes the two breaks one of them, and record which of the two the suite actually protects. `snapshotEquality` was not otherwise touched: it is still `snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean;` at line 375.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The `ReadbackSink` doc comment described the seam in the wrong direction**

- **Found during:** Task 2 prep, while working out what a sink fixture should actually do.
- **Issue:** the first sentence read *"Hands core what the app rendered, and returns a `ReadbackReceipt`"* — which says core implements the sink and the app calls it. That contradicts the rest of the same comment (*"write **your** sink generically — **it is called** with every payload type"*, which only makes sense for an app-supplied, core-called seam) and contradicts plan 01-07, which adds `ConciergeConfig.presentReadback?: ReadbackSink` as *"the app-supplied sink core calls"*. A field-position seam is app-supplied by construction — that is the entire reason the contravariance trap exists and needs its ergonomics sentence. Shipping a contradiction in the file that is explicitly "the design contract" would have handed 01-07 an inconsistency to resolve at the worst moment.
- **Fix:** the opener now states the direction explicitly — core calls it with the payload under review, the app renders that payload itself and returns a receipt binding the bytes it showed — and ties it to why this is the only route to `attested`. Two consequential edits followed: `Readback.presented` lost its past-tense *"the app put on screen"* framing (under core-calls-app, `presented` is the literal string to show, not a record of one already shown), and `ReadbackReceipt`'s canonicalization paragraph was reworded from "owned by core, never by the app" — which reads as false once the app's sink returns the receipt — to the accurate claim: the rule belongs to core, the literal admits exactly one answer, and Phase 8 ships the encoder so a sink never has to reach for `JSON.stringify`.
- **Files modified:** `packages/concierge/src/types.ts`
- **Verification:** typecheck exit 0; `ConsentAck` re-confirmed byte-identical.
- **Committed in:** `bb05a40` (amended into the Task 1 commit — the wrong text was never left in a reachable commit)

**2. [Rule 2 - Missing Critical] `ReadbackReceipt`'s two literal fields were declared but unguarded**

- **Found during:** Task 2, deciding which extra mutants to run.
- **Issue:** the plan requires `alg: "SHA-256"` and `canonicalization: "JCS"` as literals, and RESEARCH A5's stated justification for literals is that *"a type test can assert them"* — but nothing did. The `receipt` fixture pins which fields **exist** (drop one and the fresh literal fails) and says nothing about whether they are still **literals**, because `"SHA-256"` assigns to a widened `string`. Mutants M-b and M-c both produced **zero** diagnostics before the fix. A self-describing receipt that can silently stop describing itself is the same "gate failing while appearing to work" class this plan exists to close.
- **Fix:** added `_receiptAlgIsLiteral` and `_receiptCanonicalizationIsLiteral`, one line each. Both proven to fire.
- **Files modified:** `packages/concierge/test-d/consent.test-d.ts`
- **Verification:** M-b and M-c above; M5 re-run afterwards to confirm its count stayed at exactly 2 and did not drift off VALIDATION's battery.
- **Committed in:** `cd75773` (Task 2 commit)

**3. [Rule 1 - Bug] Two doc comments quoted the forms they exist to forbid, breaking the greps that guard them**

- **Found during:** Task 1, running the acceptance criteria.
- **Issue:** the same class 01-02 logged as its Deviation 2. The `snapshotEquality` warning quoted the method form verbatim, so `grep -c 'snapshotEquality?('` returned **1** on a correct file; the `ReadbackSink` warning quoted `ReadbackSink<Payload = unknown>`, so a grep for the rejected alias returned **1** too. The second is the more dangerous of the two: **plan 01-09 restores from mutant M5, whose mutation is exactly that string** — a reviewer greping to confirm the restore would have seen a hit and concluded the mutant was still applied.
- **Fix:** both warnings now describe the rejected form instead of reproducing it ("do not move the parameter list onto the member name and turn the arrow into a return-type colon"; "an alias that itself takes the payload as a `<Payload = unknown>` parameter"). Unfiltered counts for both tokens are now **0**, so the greps work with or without a comment filter.
- **Files modified:** `packages/concierge/src/types.ts`
- **Verification:** `grep -c 'ReadbackSink<Payload'` = 0, `grep -c 'snapshotEquality?('` = 0, typecheck exit 0.
- **Committed in:** `bb05a40`

The same discipline was applied pre-emptively to `consent.test-d.ts`: no literal directive token appears in its prose, so `grep -c '@ts-expect-error'` returns exactly **2** — the count plan 01-05 asserts.

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** all three were found by the defect-first procedure the plan mandates, on artifacts this plan ships. No scope creep: no file outside `files_modified` was touched, no dependency added, no `ConciergeConfig` seam wired (that is 01-07).

### Environment

`node_modules` was absent from this worktree, as in every Phase 1 worktree so far. `pnpm install --frozen-lockfile` restored the two already-pinned packages in 205 ms; `git diff --exit-code pnpm-lock.yaml` exits 0. No package was installed, so the Package Legitimacy Gate did not trigger. Fourth consecutive occurrence — expect it in 01-05 onward.

### Not Done, Deliberately

- **`ReadbackAttestation` was not declared.** D-12 item 1 defers it to Phase 8, which designs the kernel that consumes it. `grep -c ReadbackAttestation src/types.ts` returns 0. Presentation and observation stay distinct types, and the type that represents *observation* does not exist yet — so nothing in this plan can be read as granting `attested`.
- **`ConsentAck` was not touched.** Verified byte-identical to base by extracting the declaration from `HEAD` and from the working tree and diffing. It is 01-05's hinge, and the two `{@link ConsentAck.readbackHash}` references added here are in *other* declarations' doc comments.
- **`ConciergeConfig` gained no seams.** `presentReadback?`, `digest?`, and `scheduler?` are plan 01-07's Task 1. Declaring them here would have collided.
- **`src/index.ts` was not edited.** The export debt now stands at eight symbols: `FailureReason`, `ReasonCode`, `MESSAGE_MAX_CHARS` (01-02), `TurnIdentityProvenance` (01-03), and `Readback`, `ReadbackReceipt`, `ReadbackSink`, `DigestLike`, `ServerChallenge` (this plan) — nine, counting the constant separately. Plan 01-08 owns it.
- **`Readback.presented` was left as `presented?: string`,** without the explicit `| undefined` D-01 added to `ActionResult.reason`. Considered and rejected: `reason` got it because D-01 documents a specific computed idiom, and every *other* optional in the file (`responseId`, `userTurnId`, `callId`, `readbackHash`, `minGrade`, …) is a bare `?`. Adding it to one new field would have invented a convention divergence rather than followed one. If a real consumer hits `exactOptionalPropertyTypes` here, widening is additive and non-breaking.
- **`STATE.md` and `ROADMAP.md` untouched**, per the orchestrator's instruction. `git diff --name-only 48c8a40..HEAD` lists exactly two files.

## Issues Encountered

**The planning documents disagree about who calls the sink**, and the disagreement is not resolved by this plan. This plan's objective says *"a sink the app calls with what it rendered"*; 01-07 says *"the app-supplied sink core calls"*; D-03 says core owns canonicalization while the app injects only the digest. All three cannot be simultaneously literal. The reading adopted here — app-supplied, core-called, with core's canonicalizer available to the sink from Phase 8 — is the only one consistent with the seam living at a field position, with the mandated *"write your sink generically"* sentence, and with `attested` being defined as the app rendering the raw payload itself. **Phase 8 should confirm it explicitly**; nothing in Phase 1 forces the question, because Phase 1 ships only the types.

## Verification Results

| Check | Result |
|---|---|
| `pnpm --filter @fullselfbrowsing/concierge typecheck` | exit **0** |
| `pnpm typecheck` (repo root) | exit **0** |
| `consent.test-d.ts` present in the program (`tsc --listFiles`) | **yes** |
| M5 observed non-zero with TS2344 (`_sinkShape`) **and** TS2578 (`_sinkTakesNoTypeArgs`) | **yes** — exactly 2 errors, both members |
| M5 count still exactly 2 after the two added predicates | **yes** — re-run |
| M-a / M-b / M-c observed non-zero | **yes**, all three |
| `types.ts` restored byte-identical after every mutant (`git diff --exit-code`) | **yes**, 4/4 |
| Every mutant diagnostic carried its alias name on the echoed line | **yes**, 4/4 |
| `export interface Readback`, `ReadbackReceipt`, `export type ReadbackSink`, `export interface DigestLike`, `export type ServerChallenge` | all present |
| `ReadbackSink` written as `<P>(readback: Readback<P>) => Promise<ReadbackReceipt>` | line **503** |
| `alg: "SHA-256"` and `canonicalization: "JCS"` as literals | lines **462**, **463** |
| `grep -v '^[[:space:]]*[*/]' src/types.ts \| grep -c "digest("` | **1** |
| `grep -c 'digest:'` (function-property form) | **0** |
| `snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean;` still present, not a method | line **375** |
| Both doc comments state the syntax is deliberate and name the other as the opposite | **yes** |
| `DigestLike` doc records it has no mutant and is guarded by grep + review | **yes** |
| `serverChallengeBrand` declared (543) and **not** exported | **yes** |
| `grep -v '^[[:space:]]*[*/]' src/types.ts \| grep -c "ReadbackAttestation\|function jcs\|sha256\|TextEncoder\|btoa"` | **0** |
| `ConsentAck` declaration byte-identical to base | **yes** — extracted and diffed |
| `grep -c 'ReadbackSink<Payload'` / `grep -c 'snapshotEquality?('` (unfiltered) | **0** / **0** |
| `_sinkShape`, `_sinkTakesNoTypeArgs`, `_digestAccepted` in the suite | all present |
| Contextually-typed sink with no parameter annotation | line **81**, compiles |
| Single-line `_forged` challenge test | line **191** |
| `@ts-expect-error` count in `consent.test-d.ts` | **2** (the count 01-05 asserts) |
| Imports in `consent.test-d.ts` | exactly `./_assert.js` and `../src/types.js` |
| `lib.dom` / `@types/node` referenced in the suite | **0** |
| `ConsentAck` token anywhere in `consent.test-d.ts` | **0** |
| `test -z "$(grep -l '^[[:space:]]*export' test-d/*.test-d.ts)"` | exit **0** |
| `consent.test-d.ts` line count | **199** (min_lines 40) |
| `git diff --exit-code pnpm-lock.yaml` | exit **0** |
| `test -z "$(grep -n '@types/node' packages/concierge/package.json package.json)"` | exit **0** |
| File deletions across both commits | **none** |
| Untracked files left behind | **none** |
| `.planning/STATE.md`, `.planning/ROADMAP.md` | untouched |

## Threat Model Compliance

| Threat ID | Disposition | Status |
|---|---|---|
| T-01-10 | mitigate | **Phase 1's half closed.** The rule is core's and is declared as the literal `"JCS"`, pinned by `_receiptCanonicalizationIsLiteral`; `canonical` carries the bytes so no verifier re-serializes. **The encoder does not exist** — Phase 8 owns it. Until then nothing actually canonicalizes anything; see Known Stubs. |
| T-01-11 | mitigate | Closed. `DigestLike` is injected and never implemented. The comment-filtered grep for `sha256` / `TextEncoder` / `btoa` / `function jcs` returns **0**, and core imports no platform typing — the only import in `types.ts` remains `@standard-schema/spec`. |
| T-01-12 | mitigate | **Phase 1's half closed.** `ServerChallenge` is branded over a module-private `unique symbol`; `const _forged: ServerChallenge = "i-made-this-up"` is TS2322, proven by M-a firing both the predicate and the directive. Nothing in v0.1 produces one, and `ConsentAck` does not carry it yet (01-05). |
| T-01-13 | **mitigate (partial — asymmetric)** | As designed, and the asymmetry is recorded rather than smoothed over. `snapshotEquality` is genuinely guarded by M9 (TS2578 on `_policyDegraded`, plan 01-06). `DigestLike` is **not guarded by any mutant** and cannot be; its defences are the method-syntax grep, both doc comments, and review. **Treat a normalizing edit to `DigestLike` as a review-only risk.** |
| T-01-SC | accept | No packages installed. `pnpm-lock.yaml` unchanged; `pnpm install --frozen-lockfile` was restoration only. `@types/node` is absent from both manifests and was never added. |

**No new threat surface.** This plan adds no runtime code path — type declarations, doc comments, and one non-emitting test file. `test-d/` is outside `src/` and outside the emit program.

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or trust-boundary schema change. `Readback`, `ReadbackReceipt`, and `ServerChallenge` *describe* trust boundaries already in the register (T-01-10, T-01-12) rather than introducing new ones, and none of them can be constructed by anything that runs today.

## Known Stubs

None in this plan's artifacts — every declaration is a complete type and no placeholder value or empty literal was introduced.

Three **deliberate** gaps the verifier should not mistake for completion, all of them inherited from the phase's Phase-1-ships-types-only fence:

1. **Nothing canonicalizes and nothing hashes.** `canonicalization: "JCS"` is a literal with no encoder behind it and `alg: "SHA-256"` names an algorithm core never invokes. The JCS canonicalizer (~40 LOC) and the hand-rolled UTF-8 encoder (~15 LOC) land in Phase 8. Until then a `ReadbackReceipt` can only be constructed by hand, which is precisely what the type test does.
2. **`DigestLike` has no consumer.** It is not yet reachable from `ConciergeConfig` — plan 01-07 adds `digest?: DigestLike`. Nothing calls `digest` anywhere.
3. **`ServerChallenge` has no consumer either, and that is the entire point.** It is not on `ConsentAck` yet (01-05), and even once it is, D-05's rule is that v0.1 emits none. The security value today is that minting one is a compile error, not that any replay protection exists.

## Next Phase Readiness

Plan 01-05 has everything its hinge needs: `ServerChallenge` exists to be added to `ConsentAck`, `ReadbackReceipt` exists for the `readbackHash` producer reference its Task 1 requires, and `consent.test-d.ts` is structured with a marker at the foot for its part-2 block. The `Booking` fixture 01-05 says it will reuse is declared at line 44.

Three things worth carrying forward:

1. **Check the diagnostic count against VALIDATION's battery after adding any assertion, not just the exit code.** Two predicates were added to this file after M5 had already been proven; M5 was re-run to confirm it still produced exactly 2. It did, but the check is what makes that a fact rather than a hope.
2. **Never write a forbidden token in prose.** Three separate greps in this plan would have failed against a correct file. 01-02 hit this once; this plan hit it twice more, and one instance would have misled 01-09's restore check for M5 specifically.
3. **`_policyDegraded` is 01-06's, and M9 is its only detector.** Both `DigestLike`'s and `snapshotEquality`'s doc comments now point at it. If 01-06 does not create that alias, `snapshotEquality`'s syntax joins `DigestLike`'s as unguarded, and two doc comments will be making a claim that is no longer true.

## Self-Check: PASSED

- `packages/concierge/src/types.ts` — FOUND
- `packages/concierge/test-d/consent.test-d.ts` — FOUND
- `.planning/phases/01-type-surface-completion/01-04-SUMMARY.md` — FOUND
- Commit `bb05a40` (Task 1) — FOUND in git log
- Commit `cd75773` (Task 2) — FOUND in git log
- `pnpm --filter @fullselfbrowsing/concierge typecheck` — exit 0
- `pnpm typecheck` (root) — exit 0
- `.planning/STATE.md` and `.planning/ROADMAP.md` absent from the diff against base `48c8a40`

---
*Phase: 01-type-surface-completion*
*Completed: 2026-07-28*
