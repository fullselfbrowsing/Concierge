// SC-1 and SC-7c — *both* delivery hooks carry a `DeliveryReport`. SC-5 / TRN-05 —
// a transport declares where its turn identity comes from, and a boolean no longer
// satisfies the field. SC-4 / TRN-01 — two structurally unrelated transports satisfy
// one four-member interface with no vendor vocabulary anywhere in core.
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
  DeliveryReport,
  InvocationMeta,
  ToolBatch,
  Transport,
  TransportCapabilities,
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
  setTools: () => {},
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
  setTools: () => {},
  onToolBatch: () => unsubscribe,
  respond: () => {},
};

/**
 * The mechanical proof that no vendor event name has leaked into core: the interface
 * is exactly four members, so there is nowhere for one to sit. A vendor-shaped member
 * added to `Transport` breaks this line. The other half of TRN-01 is the grep, which
 * covers the places a type-level assertion cannot reach.
 */
type _transportKeys = Expect<Equals<keyof Transport, "capabilities" | "setTools" | "onToolBatch" | "respond">>;
