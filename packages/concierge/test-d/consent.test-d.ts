// SC-3 — the readback presentation seam is declarable end to end: a sink takes what
// was shown to the human and returns a receipt carrying the hash, the algorithm, the
// canonicalization rule, and the canonical bytes. SC-7e — that seam is pinned to the
// generic-FUNCTION form by the one assertion pair that actually detects a regression.
//
// **Two halves.** The first covers the readback seam, the injected digest, and the
// server-challenge brand (plan 01-04). The second, below the marker further down,
// covers the consent ack itself (plan 01-05). Nothing in the first half touches
// `ConsentAck`, which is what lets a failure name the half it came from.
//
// A third section closes the second half and is the one place the split is deliberately
// crossed: the read-only guards (plan 01-10) cover the ack *and* the receipt together,
// because they assert one invariant — that a construction-time guarantee survives
// assignment — and separating them by artifact would have hidden that they are the same
// defect. Attribution is carried there by the alias prefix (`_ack…` versus `_receipt…`)
// rather than by position, so a failure still names its artifact.
//
// This file declares nothing to the outside world. The imports below already give it
// module status, which is what keeps `isolatedDeclarations` from treating every
// top-level `const` here as declaration-emitting (TS9010).
//
// Every alias is named after the invariant it guards, and every predicate is written
// on ONE line however long. `tsc` echoes only the line the failing type argument sits
// on, so wrapping `Expect<` onto its own line leaves the alias name on a line the
// diagnostic never prints, and `Type 'false' does not satisfy the constraint 'true'`
// is the whole of the message. That was measured in plan 01-02, where it silently
// disabled four of five assertions. The corresponding examples in `01-RESEARCH.md`
// are wrapped and are wrong on this point. Do not let a formatter wrap these.
//
// Assertions are predicates wherever a predicate can express the invariant, because a
// suppression directive asserts only that *some* error occurred on the next line and
// is therefore satisfied by a typo. Exactly three such directives appear below. The
// first guards the one thing no predicate can express — a type reference that must
// fail to accept a type argument. The second and third are deliberate redundancy next
// to predicates that already cover them, because the concrete line an app author would
// actually write is worth having in the file: a `ServerChallenge` forged from a plain
// string, and a property write that must fail — `mutableAck.grade = "attested"`, which
// is the exact assignment that forged the attested branch before the ack's members
// were made read-only.

import type { Assignable, Equals, Expect, Not } from "./_assert.js";
import type {
  ConsentAck,
  ConsentGrade,
  ConsentProfile,
  DigestLike,
  Readback,
  ReadbackAttestation,
  ReadbackReceipt,
  ReadbackSink,
  ServerChallenge,
  TurnIdentityProvenance,
} from "../src/types.js";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

/** A payload with a consequential field on it. Test fixture only. */
type Booking = { id: string; amount: number };

declare const booking: Booking;

// --------------------------------------------------------------------------
// Consent capability and observed-act evidence
// --------------------------------------------------------------------------

/** The declared ceiling contains no transport behavior or runtime evidence. */
type _consentProfileKeys = Expect<Equals<keyof ConsentProfile, "consentGrade" | "userTurnIdentity">>;

/** Both capability axes are immutable after declaration. */
type _consentProfileIsReadonly = Expect<Equals<ConsentProfile, { readonly consentGrade: ConsentGrade; readonly userTurnIdentity: TurnIdentityProvenance }>>;

/** An observed act is closed to the three outcomes the consent state machine understands. */
type _attestationActIsClosed = Expect<Equals<ReadbackAttestation["act"], "confirmed" | "declined" | "dismissed">>;

/** Attestation binds one immutable act and human turn to one immutable readback hash. */
type _attestationIsExactAndReadonly = Expect<Equals<ReadbackAttestation, { readonly act: "confirmed" | "declined" | "dismissed"; readonly userTurnId: string; readonly readbackHash: string }>>;

/** Arbitrary observations cannot be mistaken for a supported human act. */
type _attestationRejectsArbitraryAct = Expect<Not<Assignable<{ readonly act: "approved"; readonly userTurnId: string; readonly readbackHash: string }, ReadbackAttestation>>>;

/** The rendered payload itself is immutable through the evidence reference. */
type _readbackPayloadIsReadonly = Expect<Equals<Pick<Readback<Booking>, "payload">, { readonly payload: Booking }>>;

/** The optional presented text is immutable and accepts a computed absent value under EOPT. */
type _readbackPresentedIsReadonly = Expect<Equals<Pick<Readback<Booking>, "presented">, { readonly presented?: string | undefined }>>;

declare const maybePresented: string | undefined;

const _readbackFromComputedPresented: Readback<Booking> = {
  payload: booking,
  presented: maybePresented,
};

void _readbackFromComputedPresented;

/**
 * SC-3's declarability half: all four receipt fields, with both literals satisfied.
 *
 * `canonical` is the UTF-8 of `"test"` and `hash` is that string's real SHA-256, so
 * the fixture is at least internally honest rather than four unrelated placeholders.
 */
const receipt: ReadbackReceipt = {
  hash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  alg: "SHA-256",
  canonicalization: "JCS",
  canonical: new Uint8Array([116, 101, 115, 116]),
};

// The fixture above pins which fields exist — remove one and the literal stops
// compiling — but it says nothing about whether the fields still hold the types
// they are declared with, because a value assigns just as happily to a widened
// type: `"SHA-256"` fits a widened `string`, and every value in the fixture fits
// `unknown`. A fixture detects *removal*; only a predicate detects *widening*.
// The four lines below are what make the declared types load-bearing rather than
// decorative, and there are four of them because the coverage is now complete
// across all four fields. It was not: `alg` and `canonicalization` had predicates
// and `hash` and `canonical` were left on the fixture alone, which is how
// `canonical: Readonly<Uint8Array>` → `canonical: unknown` came to be a silent
// edit. Extend all four together if a fifth field is ever added.

/** Widening this to `string` would let two different algorithms share one receipt shape. */
type _receiptAlgIsLiteral = Expect<Equals<ReadbackReceipt["alg"], "SHA-256">>;

/** The canonicalization rule belongs to core, so there is exactly one legal answer. */
type _receiptCanonicalizationIsLiteral = Expect<Equals<ReadbackReceipt["canonicalization"], "JCS">>;

/** The value that feeds `DeliveryReport.readbackHash` and, through it, the attested branch's `readbackHash` — the sole route to an `attested` grade. Widened, whatever a sink hands back becomes the hash. */
type _receiptHashIsString = Expect<Equals<ReadbackReceipt["hash"], string>>;

// `canonical` is the one field where a widening is worse than a lost guarantee.
// Its entire justification is WebAuthn's rule that intermediaries must not
// parse-and-reserialize — which is why `clientDataJSON` is an opaque byte array
// rather than a string. Widened to `unknown`, a sink can hand back a re-serialized
// *string* in the field whose name promises these are the exact bytes that were
// hashed, and nothing in this repository would notice. The pin names
// `Readonly<Uint8Array>` because that is the type plan 01-10 landed, element
// modifier included; if the declaration and this line ever disagree, this line is
// the one that is wrong.

/** The bytes themselves, not merely a reference to them. `unknown` here reopens exactly the hazard the field exists to close. */
type _receiptCanonicalIsBytes = Expect<Equals<ReadbackReceipt["canonical"], Readonly<Uint8Array>>>;

// --------------------------------------------------------------------------
// SC-3 — the sink shapes an app will actually write
// --------------------------------------------------------------------------

/**
 * The ergonomic path, and the one that matters most: contextually typed, with no
 * parameter annotation anywhere. If this stops compiling the seam is unusable in
 * practice regardless of what the assertions below say about its shape.
 */
const genericSink: ReadbackSink = async (rb) => {
  void rb.payload;
  void rb.presented;
  return receipt;
};

/** The explicit path, for an app that wants to name the payload type parameter. */
const explicitGenericSink: ReadbackSink = async <P,>(rb: Readback<P>): Promise<ReadbackReceipt> => {
  void rb.payload;
  return receipt;
};

void genericSink;
void explicitGenericSink;

declare const sink: ReadbackSink;

/**
 * The call site compiles with a concrete payload and yields a receipt.
 *
 * A positive, not a guard, and the distinction matters more here than anywhere else
 * in this file. `P` infers as `Booking` under the generic-function form, but the
 * return type is `Promise<ReadbackReceipt>` under both forms, so this line stays
 * green through a defaulted-alias regression. Type preservation is observable only
 * *inside* a sink body, never at the call site — which is exactly why the pair below
 * asserts something else entirely.
 */
const _sinkCallYieldsReceipt: Promise<ReadbackReceipt> = sink({ payload: booking });

void _sinkCallYieldsReceipt;

// --------------------------------------------------------------------------
// SC-7e — escapee 1: the pair that detects a defaulted-alias regression
// --------------------------------------------------------------------------

// The obvious assertion — "a payload-specific app sink is rejected" — proves nothing
// here, and believing otherwise is how this mutant escaped a reasonable first-draft
// suite. Neither the generic-function form nor a defaulted alias accepts
// `(rb: Readback<Booking>) => …`: the parameter position is contravariant and the
// seam is called with `Readback<X>` for every X the app reviews, so a narrowed sink
// is genuinely unsound in both. There is no contrast state to test. What actually
// differs is whether the seam accepts a *type argument*. Both lines below fire on
// regression; neither alone is sufficient, and if only one of them fires under the
// mutation then the pair is wrong and must be fixed before it is trusted.

/** The structural pin: the seam is a generic function, not an alias generic over the payload. */
type _sinkShape = Expect<Equals<ReadbackSink, <P>(readback: Readback<P>) => Promise<ReadbackReceipt>>>;

// The behavioural half. Under the correct generic-function form the line below is
// TS2315, `Type 'ReadbackSink' is not generic`, and the directive consumes it. Under
// a defaulted alias it compiles clean, the directive goes unused, and TS2578 fires.
// @ts-expect-error - ReadbackSink takes no type arguments; it is a generic function, not an alias generic over the payload
type _sinkTakesNoTypeArgs = ReadbackSink<Booking>;

// --------------------------------------------------------------------------
// SC-3 — the injected digest, and the precise limits of what this proves
// --------------------------------------------------------------------------

/** Shaped like a platform `SubtleCrypto`, declared structurally so no DOM or Node typing enters the program. */
declare const subtleish: {
  digest(algorithm: string | { name: string }, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
};

/**
 * What this proves: the declared shape is **satisfiable by a plausible platform-like
 * object**, so an app can inject a digest and core needs no `crypto` of its own.
 *
 * What it does **not** prove, and must never be recorded as proving: that a real
 * platform digest fits, or that `DigestLike`'s method syntax is intact. A mock whose
 * `algorithm` parameter is `string | { name: string }` assigns under method syntax
 * *and* under function-property syntax, because contravariance accepts the wider
 * parameter either way — this line stays green through a regression to the wrong
 * form. The real discriminator is that the DOM lib and the Node typings define
 * `BufferSource` differently, and neither may be installed in this repo, so that
 * difference cannot be probed here at all.
 *
 * **There is therefore no mutant for `DigestLike`'s method syntax, and one must not
 * be invented.** Its actual guards are the method-syntax grep in plan 01-04 and the
 * doc comment on the declaration itself.
 *
 * Contrast `ConsentPolicy.snapshotEquality`, whose *opposite* syntax genuinely is
 * guarded: mutant M9 reproduces, and since plan 02-11 it has **two** detectors.
 * The first is an unused directive on `_policyDegraded` in `actions.test-d.ts`
 * (plan 01-06) — a bare TS2578, which is the failure mode a reviewer deletes. The
 * second is `_policyNotBivariant` in `consent-variance.test-d.ts`, which fails
 * with TS2344 on a line whose echoed source text names the invariant. Two adjacent
 * seams, two opposite syntaxes, two different levels of enforcement — and only one
 * of them has the suite behind it.
 */
const _digestAccepted: DigestLike = subtleish;

void _digestAccepted;

// --------------------------------------------------------------------------
// D-05 — the produce-nothing rule, compiler-enforced rather than documented
// --------------------------------------------------------------------------

/**
 * The brand bites. A plain string is not a challenge, so an app cannot mint one
 * without an explicit cast a reviewer can see — which is what turns "typed but never
 * produced in v0.1" from a comment into a compile error. Page JavaScript has no
 * minting authority worth trusting: an echoed-but-unstored challenge provides no
 * replay protection at all (GHSA-gjjc-pcwp-c74m).
 */
type _challengeNotMintableFromString = Expect<Not<Assignable<string, ServerChallenge>>>;

/** …but a challenge is still a string, so the inbound echo path costs an app nothing. */
type _challengeIsAString = Expect<Assignable<ServerChallenge, string>>;

// The concrete line an app author would actually write, kept beside the predicate
// above because having the literal in the file is worth one redundant assertion. On
// one line, so the directive and the reported TS2322 land together.
// @ts-expect-error - a ServerChallenge cannot be constructed from a plain string
const _forged: ServerChallenge = "i-made-this-up";

void _forged;

// --------------------------------------------------------------------------
// Part 2 — the consent-ack assertions (SC-6, SC-7f) begin below this line.
// Nothing above asserts anything about `ConsentAck`, and nothing below re-tests
// the readback seam; keeping the two halves disjoint is what lets a failure name
// which half it came from. The only thing they share is the `Booking` fixture.
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// SC-6 — `attested` implies `readbackHash`, enforced by the compiler
// --------------------------------------------------------------------------

/**
 * The shape is constructible: a fully populated attested ack with both type
 * parameters carrying real types rather than falling back to their `unknown`
 * defaults.
 *
 * The hash is the SHA-256 of `"test"` — the same digest part 1's receipt fixture
 * carries, so the file stays internally honest, but written as a literal rather
 * than read off that fixture on purpose. A failure here must not be attributable
 * to anything above the marker.
 */
const _attestedOk: ConsentAck<Booking, { id: string }> = {
  userTurnId: "t1",
  responseId: "r1",
  snapshot: booking,
  payload: { id: "a" },
  grade: "attested",
  readbackHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
};

void _attestedOk;

// --------------------------------------------------------------------------
// SC-7f — the invariant itself, as a predicate rather than a directive
// --------------------------------------------------------------------------

// The choice of a predicate here is not stylistic. A suppression directive asserts
// only that *something* on the following line failed, so a misspelled `userTurnId`
// would satisfy one just as well as the missing hash does — and the invariant this
// file exists for would be untested while looking tested. `Expect<…>` fails with
// TS2344 and puts the alias name on the source line `tsc` echoes, so a failure says
// which guarantee broke. It also models `exactOptionalPropertyTypes` faithfully,
// which the challenge assertion further down depends on entirely.
//
// This pair is mutant M4's primary detector. Flatten `ConsentAck` back into one
// declaration and `readbackHash` becomes optional at every grade, the object below
// starts assigning, and this line goes red.

/** An attested ack with no hash proves only that *a* readback happened — not that it described this payload. */
type _attestedNeedsHash = Expect<Not<Assignable<{ userTurnId: string; responseId: string; snapshot: Booking; payload: null; grade: "attested" }, ConsentAck<Booking, null>>>>;

/** Control, not a guard: the same object *with* a hash does assign, so the line above is about the hash and not about unrelated drift in the object. */
type _attestedWithHashAssigns = Expect<Assignable<{ userTurnId: string; responseId: string; snapshot: Booking; payload: null; grade: "attested"; readbackHash: string }, ConsentAck<Booking, null>>>;

// --------------------------------------------------------------------------
// D-05 — omit the challenge, do not spread an empty one into it
// --------------------------------------------------------------------------

/** Under `exactOptionalPropertyTypes` an absent key and a present-but-empty key are different types, and only the absent one is legal here (TS2375 at a construction site). */
type _challengeMustBeOmitted = Expect<Not<Assignable<{ userTurnId: string; responseId: string; snapshot: Booking; payload: null; grade: "relayed"; challenge: undefined }, ConsentAck<Booking, null>>>>;

/** Control, not a guard: drop the key entirely and the same ack assigns. This is what makes the line above about the challenge rather than about anything else. */
type _challengeAbsentAssigns = Expect<Assignable<{ userTurnId: string; responseId: string; snapshot: Booking; payload: null; grade: "relayed" }, ConsentAck<Booking, null>>>;

// --------------------------------------------------------------------------
// Narrowing survives the union-of-intersections
// --------------------------------------------------------------------------

declare const ack: ConsentAck<Booking, { id: string }>;

/**
 * The ergonomic half of the refactor, and M4's second detector.
 *
 * Discriminant narrowing reaches *through* the intersections, so inside the guard
 * `readbackHash` is a plain `string` and the `return` needs no fallback — that
 * missing `??` is the entire assertion. Outside the guard it may be absent and the
 * fallback is genuinely required. If `ConsentAck` is ever flattened back into one
 * declaration the first `return` stops compiling with TS2322, independently of the
 * predicates above.
 *
 * The declared return type is load-bearing. Drop it and inference widens the
 * function to `string | undefined`, both branches go quiet, and this detector
 * disappears without anything going red.
 */
function narrowsThroughTheUnion(): string {
  if (ack.grade === "attested") return ack.readbackHash;
  return ack.readbackHash ?? "";
}

void narrowsThroughTheUnion;

// --------------------------------------------------------------------------
// CR-01 / WR-01 — the union constrains construction; only `readonly` constrains
// mutation, and without it the narrowing directly above this block lies.
// --------------------------------------------------------------------------

// That sentence is the whole invariant. `narrowsThroughTheUnion` immediately above is
// the reason it is critical rather than merely lax: the *write* type of a property on a
// union-typed value is the union of the branches' write types, so with a writable
// discriminant `ack.grade = "attested"` compiled on any ack — no cast, no `any`, no
// suppression, zero diagnostics — and the very next line of `narrowsThroughTheUnion`
// then returns `ack.readbackHash` as a plain `string` for a property that is absent at
// runtime. The escape did not merely fail to block a forgery; it made the compiler
// issue a false guarantee to whatever compares that hash, at precisely the idiom this
// file teaches as correct. The two must be read together, which is why they are
// adjacent and why `narrowsThroughTheUnion` is named here rather than merely implied.
//
// These are predicates, not directives, and the form is load-bearing:
// `Equals<Pick<T, K>, { readonly K: V }>` evaluates `false` when the member is mutable
// and `true` when it is read-only. Measured: `Pick` preserves the modifier *through*
// the `ConsentAck` union and does not distribute, so `Pick<Ack, "grade">` is the single
// object type `{ readonly grade: ConsentGrade }` rather than a union of two branches.
// Writing the value side as the `ConsentGrade` alias rather than spelling the four
// members out keeps each guard about the modifier alone — spelled out, it would also go
// red when a grade is added, which is a different invariant with its own assertions.

declare const mutableAck: ConsentAck<Booking, { id: string }>;

/** The discriminant. Writable, it forges the attested branch and the narrowing above vouches for the forgery. */
type _ackGradeIsReadonly = Expect<Equals<Pick<ConsentAck<Booking, { id: string }>, "grade">, { readonly grade: ConsentGrade }>>;

/** What the human actually reviewed, captured at review time and replayed verbatim at confirm time. */
type _ackPayloadIsReadonly = Expect<Equals<Pick<ConsentAck<Booking, { id: string }>, "payload">, { readonly payload: { id: string } }>>;

/** The declaration's own prose promised "structurally frozen at arm time"; this is the half of that promise the type can keep. */
type _ackSnapshotIsReadonly = Expect<Equals<Pick<ConsentAck<Booking, { id: string }>, "snapshot">, { readonly snapshot: Booking }>>;

/** The turn the ack is bound to. Rewritable, the binding names a different turn than the one that armed. */
type _ackTurnIdIsReadonly = Expect<Equals<Pick<ConsentAck<Booking, { id: string }>, "userTurnId">, { readonly userTurnId: string }>>;

// The concrete line an app author would actually write, kept beside the predicate above
// for the same reason `_forged` is kept beside `_challengeNotMintableFromString` —
// having the literal in the file is worth one redundant assertion. The ack arrives in
// exactly this shape through `ctx.ack`, handed by reference into handler code the
// library does not control, so this is an ordinary aliasing bug and not a hypothetical
// adversary. On one line, so the directive and the reported TS2540 land together.
// @ts-expect-error - grade must not be writable: a written grade forges the attested branch
mutableAck.grade = "attested";

/** The receipt's binding to the bytes it describes. Severing it is what makes a receipt describe a payload that was never shown. */
type _receiptHashIsReadonly = Expect<Equals<Pick<ReadbackReceipt, "hash">, { readonly hash: string }>>;

// `canonical` needs the element type asserted, not just the modifier, and the two are
// genuinely different mechanisms. A bare `readonly canonical: Uint8Array` stops the
// reference being rebound and was measured to leave `receipt.canonical[0] = 0`
// compiling — the bytes rewritten in place under a field whose name promises they are
// the exact ones that were hashed. This single predicate sees both axes: it goes red
// when the modifier is stripped *and* when the element type is degraded to a bare
// `Uint8Array`, which is why plan 01-10 mutates it twice rather than once.

/** WebAuthn made `clientDataJSON` opaque rather than asking intermediaries not to reserialize it; this is the type-level form of that refusal. */
type _receiptCanonicalIsReadonly = Expect<Equals<Pick<ReadbackReceipt, "canonical">, { readonly canonical: Readonly<Uint8Array> }>>;

// D-07's half of the hinge: both type parameters have to survive the split into
// two branches, and *both* need an assertion. `Snapshot` erased to `unknown` is
// caught by the first line below. `Payload` erased the same way was measured to
// produce **zero** diagnostics before the second line existed — the SC-6 positive
// stays green because any payload assigns to `unknown`, and both negatives stay
// green because they are already negative for other reasons. Plan 01-06 asserts
// that `ActionDefinition.handler` forwards `Snapshot` *and* `AckPayload` through to
// `ctx.ack`; if `Payload` quietly stopped reaching this member, that assertion
// would be measuring a chain with a hole in it and would still pass.
//
// The third line closes the set. Two of the shared members were pinned here and
// the one that carries the *identity* the strongest binding compares was not —
// which is the same shape of gap `_commonPayload` was added to fill.

/** The `Snapshot` parameter reaches the common members with no narrowing at all. */
type _commonSnapshot = Expect<Equals<(typeof ack)["snapshot"], Booking>>;

/** …and so does `Payload`, which is what plan 01-06's handler assertion binds against. */
type _commonPayload = Expect<Equals<(typeof ack)["payload"], { id: string }>>;

/** The value `bindTo: "userTurn"` compares. Optional, an ack arms with no turn identity at all and the strongest binding in the design has nothing to check — while every shape assertion above stays green. */
type _ackCarriesTurnIdentity = Expect<Equals<ConsentAck<Booking, null>["userTurnId"], string>>;
