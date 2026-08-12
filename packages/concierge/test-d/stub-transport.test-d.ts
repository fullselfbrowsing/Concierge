import type { Equals, Expect } from "./_assert.js";
import type {
  DeliveryReport,
  FailureOutcome,
  OutcomeSink,
  ToolBatch,
  Transport,
  TransportCapabilities,
} from "../src/index.js";
import {
  COMMAND_PALETTE_CAPABILITIES,
  CONVERSATIONAL_CAPABILITIES,
  createStubTransport,
  type StubOutcomeBehavior,
  type StubTransportDeliveryAttempt,
  type StubTransportEvent,
  type StubTransportHarness,
  type StubTransportOptions,
  type StubTransportOutcomeAttempt,
  type StubTransportResponseAttempt,
} from "../test/fixtures/stub-transport.js";

const options: StubTransportOptions = {
  capabilities: CONVERSATIONAL_CAPABILITIES,
  initialStatus: "idle",
  outcomeBehaviors: ["completed", "interrupted", "throw", "reject"],
};
const stub = createStubTransport(options);
const _transport: Transport = stub.transport;
const _conversationalProfile: TransportCapabilities = CONVERSATIONAL_CAPABILITIES;
const _commandPaletteProfile: TransportCapabilities = COMMAND_PALETTE_CAPABILITIES;
const _harness: StubTransportHarness = stub;
const _deliveryHook: NonNullable<ToolBatch["deferUntilDelivered"]> =
  stub.deferUntilDelivered;
const _outcomeSink: OutcomeSink = stub.presentOutcome;
const _outcomeBehavior: StubOutcomeBehavior = "reject";

const outcome: FailureOutcome = {
  failures: [{ callId: "failed-call", reason: "declined", message: "Declined." }],
};
const report: DeliveryReport = {
  responseId: "review-response",
  outcome: "completed",
};
stub.deferUntilDelivered(() => {});
stub.emitDelivery(0, report);
void stub.presentOutcome(outcome);

const _deliveryHistory: ReadonlyArray<StubTransportDeliveryAttempt> =
  stub.deliveryHistory();
const _outcomeHistory: ReadonlyArray<StubTransportOutcomeAttempt> =
  stub.outcomeHistory();
const _responseHistory: ReadonlyArray<StubTransportResponseAttempt> =
  stub.responseHistory();
const _events: ReadonlyArray<StubTransportEvent> = stub.eventHistory();
const _successfulOutcomes: ReadonlyArray<FailureOutcome> =
  stub.successfulOutcomeHistory();
const _successfulResponses: ReadonlyArray<StubTransportResponseAttempt> =
  stub.successfulResponseHistory();

type _stubTransportKeys = Expect<Equals<keyof typeof stub.transport, keyof Transport>>;
type _stubHarnessKeys = Expect<
  Equals<
    keyof typeof stub,
    | "transport"
    | "emitStatus"
    | "emitBatch"
    | "catalogHistory"
    | "responseHistory"
    | "subscriberCounts"
    | "deferUntilDelivered"
    | "emitDelivery"
    | "deliveryCallbackCount"
    | "deliveryHistory"
    | "presentOutcome"
    | "outcomeHistory"
    | "successfulOutcomeHistory"
    | "successfulResponseHistory"
    | "eventHistory"
  >
>;

// New test-driving controls remain siblings and cannot expand Transport.
// @ts-expect-error transport keeps the exact public six-key contract
stub.transport.emitDelivery;
// @ts-expect-error the application-owned outcome sink is not a Transport member
stub.transport.presentOutcome;
// @ts-expect-error fixture histories are never exposed through production Transport
stub.transport.eventHistory;

// Every externally visible fixture history is readonly at compile time.
// @ts-expect-error readonly history arrays cannot be extended
_deliveryHistory.push({});
// @ts-expect-error history sequence numbers are immutable
_outcomeHistory[0]!.sequence = 0;
// @ts-expect-error event rows are immutable
_events[0]!.sequence = 0;
// @ts-expect-error successful outcome snapshots are immutable
_successfulOutcomes[0]!.failures = [];
// @ts-expect-error response result snapshots stay readonly through history rows
_responseHistory[0]!.result.message = "rewritten";

void _transport;
void _conversationalProfile;
void _commandPaletteProfile;
void _harness;
void _deliveryHook;
void _outcomeSink;
void _outcomeBehavior;
void _responseHistory;
void _successfulResponses;
