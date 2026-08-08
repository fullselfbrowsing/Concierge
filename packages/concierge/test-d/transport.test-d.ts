// SC-1 and SC-7c — *both* delivery hooks carry a `DeliveryReport`. SC-5 / TRN-05 —
// a transport declares where its turn identity comes from, and a boolean no longer
// satisfies the field. SC-4 / TRN-01 — two structurally unrelated transports satisfy
// one six-member interface with no vendor vocabulary anywhere in core.
//
// This file declares nothing to the outside world. The imports below already give it
// module status, which is what keeps `isolatedDeclarations` from treating every
// top-level `const` here as declaration-emitting (TS9010).
//
// Every alias is named after the invariant it guards, and every predicate is written
// on ONE line however long. `tsc` echoes only the line the failing type argument sits
// on, so wrapping `Expect<` onto its own line leaves the alias name on a line the
// diagnostic never prints — leaving `Type 'false' does not satisfy the constraint
// 'true'` above an anonymous predicate body. That was measured in plan 01-02, where
// it silently disabled four of five assertions. Do not let a formatter wrap these.
//
// No vendor event name appears anywhere below, including in the comments. That half
// of TRN-01 is checked by a recursive grep over `src/` and `test-d/` rather than
// asserted — a vendor name in a comment is how vendor vocabulary starts leaking into
// a seam that is supposed to be neutral.

import type { Assignable, Equals, Expect, Not } from "./_assert.js";
import type {
  AbortSignalLike,
  ConsentGrade,
  DeliveryReport,
  InvocationMeta,
  ToolBatch,
  Transport,
  TransportCapabilities,
  TransportStatus,
  TurnIdentityProvenance,
} from "../src/types.js";

// --------------------------------------------------------------------------
// SC-1 / SC-7c — both hooks, and the one that escapes every other suite
// --------------------------------------------------------------------------

/** The consent-side hook. Already correct before this plan; pinned so it stays so. */
type _metaHook = Expect<Equals<NonNullable<InvocationMeta["deferUntilDelivered"]>, (effect: (report: DeliveryReport) => void) => void>>;

/**
 * The transport-side hook — the one Success Criterion 1 is actually about, and the
 * second of VALIDATION's three escapees. Every consent-shaped assertion in this
 * package reads `InvocationMeta`; nothing anywhere reads `ToolBatch`. Without this
 * line, a regression on the hook a transport author actually implements is
 * completely invisible, which is exactly how it survived to be found by D-00.
 */
type _batchHook = Expect<Equals<NonNullable<ToolBatch["deferUntilDelivered"]>, (effect: (report: DeliveryReport) => void) => void>>;

/**
 * The negative half of the pair. An effect handed a bare id cannot report that a
 * readback was cut off partway, so that shape must not fit the field — otherwise a
 * consumer arms consent on a payload the human only partly received. If only one of
 * this pair fires under mutation, the pair is wrong.
 */
type _batchRejectsBareId = Expect<Not<Assignable<(effect: (id: string) => void) => void, NonNullable<ToolBatch["deferUntilDelivered"]>>>>;

// What the three lines above do *not* cover, stated exactly: all three pin the
// hook's **parameter type**, so battery mutant M2 catches a hook that stops
// carrying a report — and none of them looks inside the report. Widened to
// `string`, `outcome === "completed"` still compiles, every other value silently
// passes an exhaustive check, and a readback the human only partly received arms
// consent. `01-VERIFICATION.md` cites this literal union as the evidence for
// SC-1, so it is a contract the phase has already claimed as verified.
//
// `_deliveryOutcomeIsReadonly` further down sees this widening too, because it
// spells the union out on the value side. The two are still separate invariants
// and both are wanted: strip the modifier alone and only that one fires; widen
// the union alone and only this one is *about* what broke. A guard whose name
// says "readonly" is not where a reader looks for "closed".

/** The union SC-1 rests on. Open it and partial delivery stops being representable at the type level, which was the entire reason `outcome` replaced a bare delivered-id. */
type _deliveryOutcomeIsClosed = Expect<Equals<DeliveryReport["outcome"], "completed" | "interrupted">>;

// --------------------------------------------------------------------------
// SC-5 / TRN-05 — provenance, not presence
// --------------------------------------------------------------------------

/**
 * The guard that fires the moment the field regresses to `boolean`. `true` was a
 * legal value of the old shape and must not be a legal value of the new one. This
 * is also why D-12 item 3 settled on *replacing* the boolean rather than
 * supplementing it: alongside a surviving boolean this assertion is unwritable, and
 * two fields would be two sources of truth for one fact.
 */
type _provenanceNotBoolean = Expect<Not<Assignable<true, TransportCapabilities["userTurnIdentity"]>>>;

/**
 * Turn identity derived from a channel the agent's own output feeds back into, so
 * the agent can mint one. Everything else here is identical to the pair below —
 * provenance is the axis, and it is not a modality.
 */
const _agentForgeableCaps: TransportCapabilities = {
  consentGrade: "relayed",
  userTurnIdentity: "agent-forgeable",
  parallelCalls: false,
  dynamicCatalog: true,
};

/** Turn identity derived from an explicit human act. Distinguishable from the above. */
const _humanAttestedCaps: TransportCapabilities = {
  consentGrade: "attested",
  userTurnIdentity: "human-attested",
  parallelCalls: false,
  dynamicCatalog: true,
};

// --------------------------------------------------------------------------
// WR-01 — a declared capability is a declaration, not a starting position
// --------------------------------------------------------------------------

// Everything above this block tests *construction*: what a transport author may write
// down, and what the field refuses to accept. None of it looked at assignment, and all
// four members below were writable — so every guarantee the assertions above establish
// was defeatable one line later, through a reference the kernel hands out itself.
//
// `Transport.capabilities` carries a `readonly` and always did. That modifier stops the
// *reference* being rebound and says nothing about the members it points at, so while
// these were mutable it read as protection while `t.capabilities.consentGrade =
// "attested"` compiled cleanly — worse than no modifier, because a reader stopped
// looking. The two levels must stay in step, and these guards are what keeps them so.
//
// Predicates, not directives: `Equals<Pick<T, K>, { readonly K: V }>` is `false` when
// the member is mutable and `true` when it is read-only, and it names the invariant on
// the line `tsc` echoes. The value side is written as the declared alias rather than
// spelled out, which keeps each guard about the modifier alone — `_provenanceNotBoolean`
// above already owns the question of what values are legal.

/** "Anything but `completed` means consent must not arm" is unenforceable while the field can be relabelled: a truncated readback becomes a complete one by assignment. */
type _deliveryOutcomeIsReadonly = Expect<Equals<Pick<DeliveryReport, "outcome">, { readonly outcome: "completed" | "interrupted" }>>;

/** The only route to an `attested` grade. Writable, the hash the ack inherits can be swapped for one describing a payload the human never saw. */
type _deliveryReadbackHashIsReadonly = Expect<Equals<Pick<DeliveryReport, "readbackHash">, { readonly readbackHash?: string | undefined }>>;

/** `TurnIdentityProvenance` exists so the kernel can tell an id the agent could have minted from one it could not; a value upgradable in place from `agent-forgeable` to `human-attested` after declaration carries none of that distinction, and converts a value the kernel is told not to trust into one it is told to trust. */
type _capsProvenanceIsReadonly = Expect<Equals<Pick<TransportCapabilities, "userTurnIdentity">, { readonly userTurnIdentity: TurnIdentityProvenance }>>;

/** Self-declared and unverifiable by the kernel, so a grade raised after declaration is a capability nothing ever checked — understating costs capability, overstating defeats the gate. */
type _capsGradeIsReadonly = Expect<Equals<Pick<TransportCapabilities, "consentGrade">, { readonly consentGrade: ConsentGrade }>>;

// --------------------------------------------------------------------------
// SC-4 / TRN-01 — two transports sharing no wire vocabulary, one interface
// --------------------------------------------------------------------------

declare const unsubscribe: () => void;

/**
 * Shaped like a long-lived streaming session: one response may carry several calls,
 * the catalog is swapped as the human moves between stages, and the human receives
 * the agent's own rendition of the payload rather than the app's — `relayed`, with a
 * turn identity the agent's own output could mint.
 */
const streamingTransport: Transport = {
  capabilities: {
    consentGrade: "relayed",
    userTurnIdentity: "agent-forgeable",
    parallelCalls: true,
    dynamicCatalog: true,
  },
  status: "connecting",
  setTools: () => {},
  onStatusChange: (cb: (status: TransportStatus) => void) => {
    void cb;
    return unsubscribe;
  },
  onToolBatch: () => unsubscribe,
  respond: () => {},
};

/**
 * Shaped like a synchronous command palette: one call at a time, a catalog fixed for
 * the session, and the app rendering the payload itself and observing the keypress
 * that confirms it — `attested`, with a turn identity nothing the agent emits can
 * produce. It shares no wire vocabulary with the fixture above, yet both satisfy the
 * same interface with no casts. That is the whole of TRN-01's structural half.
 */
const commandPaletteTransport: Transport = {
  capabilities: {
    consentGrade: "attested",
    userTurnIdentity: "human-attested",
    parallelCalls: false,
    dynamicCatalog: false,
  },
  status: "closed",
  setTools: () => {},
  onStatusChange: (cb: (status: TransportStatus) => void) => {
    void cb;
    return unsubscribe;
  },
  onToolBatch: () => unsubscribe,
  respond: () => {},
};

/**
 * The mechanical proof that no vendor event name has leaked into core: the interface
 * is exactly six members, so there is nowhere for one to sit. A vendor-shaped member
 * added to `Transport` breaks this line. The other half of TRN-01 is the grep, which
 * covers the places a type-level assertion cannot reach.
 */
type _transportStatus = Expect<Equals<TransportStatus, "idle" | "connecting" | "connected" | "closed">>;
type _transportStatusCallback = Expect<Equals<Transport["onStatusChange"], (cb: (status: TransportStatus) => void) => () => void>>;
type _transportKeys = Expect<Equals<keyof Transport, "capabilities" | "status" | "setTools" | "onStatusChange" | "onToolBatch" | "respond">>;
type _transportStatusIsReadonly = Expect<Equals<Pick<Transport, "status">, { readonly status: TransportStatus }>>;

// --------------------------------------------------------------------------
// WR-02 — the computed idiom, on every optional member a transport builds
// --------------------------------------------------------------------------

// Positives, not predicates, and the distinction is forced rather than stylistic. The
// invariant here is "this object literal compiles", which no `Expect<…>` can phrase,
// because a predicate reads the type and both spellings of an optional member read
// *identically*: `Equals<{x?: T}, {x?: T | undefined}>` is `true` under
// `exactOptionalPropertyTypes` — measured in plan 01-12, not assumed. Every read-shaped
// assertion in this suite therefore stays green when the widening is removed, including
// `_deliveryReadbackHashIsReadonly` twenty lines above. Only a construction site moves.
//
// That asymmetry is the entire finding. `ActionResult.reason` documents it at length and
// `results.test-d.ts`'s `_computedReasonAssigns` was the suite's only detector for it,
// which is precisely how the same defect on eleven other members survived unseen. Each
// constant below is TS2375 the moment its member loses `| undefined`, and nothing else in
// the repository would say a word. Do not "simplify" one by giving its fixture a
// non-optional type: that deletes the guard and leaves it green, which is the failure
// mode these exist to end.
//
// TS2375 is reported on the constant's *declaration* line, so the constant name is the
// only carrier of meaning in the diagnostic — the same role an alias name plays for a
// predicate. Named accordingly.

/** Stands for whatever the transport could not derive: a turn id it has no source for, a receipt's `hash` when there is no receipt. */
declare const maybeStr: string | undefined;
declare const maybeNum: number | undefined;
declare const maybeSig: AbortSignalLike | undefined;
declare const maybeHook: ((e: (r: DeliveryReport) => void) => void) | undefined;

/**
 * Five members in one literal, because they fail and pass together. A transport that
 * cannot derive turn identity generally cannot derive a call id or an index either, and
 * it writes the whole of this object as a single expression rather than five guarded
 * assignments — which is the shape the widening exists to permit.
 */
const _metaFromOptionalSources: InvocationMeta = {
  responseId: maybeStr,
  userTurnId: maybeStr,
  callId: maybeStr,
  outputIndex: maybeNum,
  signal: maybeSig,
};

/**
 * The hook, deliberately separate from the five above: the parenthesisation is its own
 * failure mode. Written unparenthesised, `| undefined` binds inside the *return*
 * position — a different type, which still compiles, and which would leave this constant
 * green while the member stopped meaning what `_metaHook` asserts it means.
 */
const _metaHookFromOptionalSource: InvocationMeta = { deferUntilDelivered: maybeHook };

/**
 * The exact line `DeliveryReport.readbackHash`'s own doc comment instructs the author to
 * write. `maybeStr` stands for `receipt?.hash` — the receipt is a `ReadbackReceipt` the
 * app may not have, so its `hash` reaches this field as `string | undefined`.
 *
 * While the field was bare this was TS2375: the type rejected the idiom the prose beside
 * it prescribed. The shortest way past that is to hash the payload locally instead, which
 * reintroduces exactly the canonicalization collision the receipt exists to prevent — on
 * the one field that is the sole route to an `attested` grade.
 */
const _deliveryFromReceipt: DeliveryReport = {
  responseId: "r",
  outcome: "completed",
  readbackHash: maybeStr,
};

/**
 * The transport-side envelope, assembled the way a real transport assembles it. The
 * dispatcher then forwards `userTurnId`, `signal`, and `deferUntilDelivered` straight into
 * an `InvocationMeta`, and every one of the three is optional on both sides — so either
 * both accept the same possibly-absent value or the forward needs a cast at the boundary
 * the consent gate reads.
 */
const _batchFromOptionalSources: ToolBatch = {
  responseId: "r",
  calls: [],
  userTurnId: maybeStr,
  signal: maybeSig,
  deferUntilDelivered: maybeHook,
};

void _metaFromOptionalSources;
void _metaHookFromOptionalSource;
void _deliveryFromReceipt;
void _batchFromOptionalSources;
