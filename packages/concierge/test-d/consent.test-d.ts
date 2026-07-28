// SC-3 — the readback presentation seam is declarable end to end: a sink takes what
// was shown to the human and returns a receipt carrying the hash, the algorithm, the
// canonicalization rule, and the canonical bytes. SC-7e — that seam is pinned to the
// generic-FUNCTION form by the one assertion pair that actually detects a regression.
//
// **Part 1 of 2.** This half covers the readback seam, the injected digest, and the
// server-challenge brand. The consent-ack half is appended below the marker at the
// foot of this file by plan 01-05; nothing above that marker touches it.
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
// is therefore satisfied by a typo. Exactly two such directives appear below. The
// first guards the one thing no predicate can express — a type reference that must
// fail to accept a type argument. The second is deliberate redundancy next to a
// predicate that already covers it, because the concrete line an app author would
// actually write is worth having in the file.

import type { Assignable, Equals, Expect, Not } from "./_assert.js";
import type {
  DigestLike,
  Readback,
  ReadbackReceipt,
  ReadbackSink,
  ServerChallenge,
} from "../src/types.js";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

/** A payload with a consequential field on it. Test fixture only. */
type Booking = { id: string; amount: number };

declare const booking: Booking;

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
// compiling — but it says nothing about whether the two self-describing fields are
// still literals, because `"SHA-256"` assigns happily to a widened `string`. These
// two lines are what make the literals load-bearing rather than decorative.

/** Widening this to `string` would let two different algorithms share one receipt shape. */
type _receiptAlgIsLiteral = Expect<Equals<ReadbackReceipt["alg"], "SHA-256">>;

/** The canonicalization rule belongs to core, so there is exactly one legal answer. */
type _receiptCanonicalizationIsLiteral = Expect<Equals<ReadbackReceipt["canonicalization"], "JCS">>;

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
 * guarded: mutant M9 reproduces, and its single symptom is an unused directive on
 * `_policyDegraded` in `actions.test-d.ts` (plan 01-06). Two adjacent seams, two
 * opposite syntaxes, two different levels of enforcement — and only one of them has
 * the suite behind it.
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
// Part 2 — the consent-ack assertions (SC-6, SC-7f) are appended below this line
// by plan 01-05. Nothing above asserts anything about that type; keeping the two
// halves disjoint is what lets a failure name which half it came from.
// --------------------------------------------------------------------------
