import type {
  ActionResult,
  DeliveryReport,
  EmittedTool,
  FailureOutcome,
  OutcomePresentationReport,
  OutcomeSink,
  ToolBatch,
  Transport,
  TransportCapabilities,
  TransportStatus,
} from "../../src/types.js";

export interface StubTransportFailures {
  readonly setToolsAt?: ReadonlyArray<number> | undefined;
  readonly respondAt?: ReadonlyArray<number> | undefined;
  readonly respondRejectAt?: ReadonlyArray<number> | undefined;
  readonly subscribeStatus?: boolean | undefined;
  readonly subscribeBatch?: boolean | undefined;
  readonly unsubscribeStatus?: boolean | undefined;
  readonly unsubscribeBatch?: boolean | undefined;
}

export interface StubTransportOptions {
  readonly capabilities: TransportCapabilities;
  readonly initialStatus?: TransportStatus | undefined;
  readonly failures?: StubTransportFailures | undefined;
  readonly outcomeBehaviors?: ReadonlyArray<StubOutcomeBehavior> | undefined;
}

export type StubOutcomeBehavior =
  | "completed"
  | "interrupted"
  | "throw"
  | "reject";

export type StubResponseBehavior = "completed" | "throw" | "reject";

export interface StubTransportResponseAttempt {
  readonly callId: string;
  readonly result: ActionResult;
}

export interface StubTransportDeliveryAttempt {
  readonly sequence: number;
  readonly deliveryIndex: number;
  readonly report: DeliveryReport;
}

export interface StubTransportOutcomeAttempt {
  readonly sequence: number;
  readonly behavior: StubOutcomeBehavior;
  readonly outcome: FailureOutcome;
}

export type StubTransportEvent =
  | Readonly<{
      sequence: number;
      type: "delivery";
      deliveryIndex: number;
      report: DeliveryReport;
    }>
  | Readonly<{
      sequence: number;
      type: "outcome";
      behavior: StubOutcomeBehavior;
      outcome: FailureOutcome;
    }>
  | Readonly<{
      sequence: number;
      type: "response";
      behavior: StubResponseBehavior;
      callId: string;
      result: ActionResult;
    }>;

export interface StubTransportSubscriberCounts {
  readonly status: number;
  readonly batch: number;
}

export interface StubTransportHarness {
  readonly transport: Transport;
  readonly emitStatus: (status: TransportStatus) => void;
  readonly emitBatch: (batch: ToolBatch) => void;
  readonly catalogHistory: () => ReadonlyArray<ReadonlyArray<EmittedTool>>;
  readonly responseHistory: () => ReadonlyArray<StubTransportResponseAttempt>;
  readonly subscriberCounts: () => StubTransportSubscriberCounts;
  readonly deferUntilDelivered: NonNullable<ToolBatch["deferUntilDelivered"]>;
  readonly emitDelivery: (
    deliveryIndex: number,
    report: DeliveryReport,
  ) => void;
  readonly deliveryCallbackCount: () => number;
  readonly deliveryHistory: () => ReadonlyArray<StubTransportDeliveryAttempt>;
  readonly presentOutcome: OutcomeSink;
  readonly outcomeHistory: () => ReadonlyArray<StubTransportOutcomeAttempt>;
  readonly successfulOutcomeHistory: () => ReadonlyArray<FailureOutcome>;
  readonly successfulResponseHistory: () =>
    ReadonlyArray<StubTransportResponseAttempt>;
  readonly eventHistory: () => ReadonlyArray<StubTransportEvent>;
}

export const CONVERSATIONAL_CAPABILITIES: TransportCapabilities = Object.freeze({
  consentGrade: "relayed",
  userTurnIdentity: "agent-forgeable",
  parallelCalls: true,
  dynamicCatalog: true,
});

export const COMMAND_PALETTE_CAPABILITIES: TransportCapabilities = Object.freeze({
  consentGrade: "attested",
  userTurnIdentity: "human-attested",
  parallelCalls: false,
  dynamicCatalog: false,
});

type StatusSubscriber = (status: TransportStatus) => void;
type BatchSubscriber = (batch: ToolBatch) => void;

interface NormalizedStubTransportFailures {
  readonly setToolsAt: ReadonlyArray<number>;
  readonly respondAt: ReadonlyArray<number>;
  readonly respondRejectAt: ReadonlyArray<number>;
  readonly subscribeStatus: boolean;
  readonly subscribeBatch: boolean;
  readonly unsubscribeStatus: boolean;
  readonly unsubscribeBatch: boolean;
}

const SET_TOOLS_FAILURE_MESSAGE: string =
  "Stub transport injected setTools failure.";
const RESPOND_FAILURE_MESSAGE: string =
  "Stub transport injected respond failure.";
const RESPOND_REJECTION_MESSAGE: string =
  "Stub transport injected respond rejection.";
const OUTCOME_FAILURE_MESSAGE: string =
  "Stub transport injected outcome failure.";
const OUTCOME_REJECTION_MESSAGE: string =
  "Stub transport injected outcome rejection.";
const UNREADABLE_DELIVERY_RESPONSE_ID: string =
  "[stub:unreadable-delivery-report]";
const STATUS_SUBSCRIBE_FAILURE_MESSAGE: string =
  "Stub transport injected status subscription failure.";
const BATCH_SUBSCRIBE_FAILURE_MESSAGE: string =
  "Stub transport injected batch subscription failure.";
const STATUS_UNSUBSCRIBE_FAILURE_MESSAGE: string =
  "Stub transport injected status unsubscription failure.";
const BATCH_UNSUBSCRIBE_FAILURE_MESSAGE: string =
  "Stub transport injected batch unsubscription failure.";

function normalizeFailures(
  failures: StubTransportFailures | undefined,
): NormalizedStubTransportFailures {
  return Object.freeze({
    setToolsAt: Object.freeze([...(failures?.setToolsAt ?? [])]),
    respondAt: Object.freeze([...(failures?.respondAt ?? [])]),
    respondRejectAt: Object.freeze([...(failures?.respondRejectAt ?? [])]),
    subscribeStatus: failures?.subscribeStatus === true,
    subscribeBatch: failures?.subscribeBatch === true,
    unsubscribeStatus: failures?.unsubscribeStatus === true,
    unsubscribeBatch: failures?.unsubscribeBatch === true,
  });
}

function failsAt(
  occurrences: ReadonlyArray<number>,
  occurrence: number,
): boolean {
  return occurrences.includes(occurrence);
}

const COMPLETED_OUTCOME_REPORT: OutcomePresentationReport = Object.freeze({
  outcome: "completed",
});
const INTERRUPTED_OUTCOME_REPORT: OutcomePresentationReport = Object.freeze({
  outcome: "interrupted",
});

function snapshotActionResult(result: ActionResult): ActionResult {
  if (Object.isFrozen(result)) return result;

  const reason: ActionResult["reason"] = result.reason;
  return reason === undefined
    ? Object.freeze({ ok: result.ok, message: result.message })
    : Object.freeze({ ok: result.ok, reason, message: result.message });
}

function readOwnDataProperty(value: unknown, key: string): unknown {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function")
  ) {
    return undefined;
  }

  try {
    const descriptor: PropertyDescriptor | undefined =
      Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function snapshotDeliveryReport(report: DeliveryReport): DeliveryReport {
  const rawResponseId: unknown = readOwnDataProperty(report, "responseId");
  const rawOutcome: unknown = readOwnDataProperty(report, "outcome");
  const rawReadbackHash: unknown = readOwnDataProperty(report, "readbackHash");
  const rawAttestation: unknown = readOwnDataProperty(report, "attestation");
  const responseId: string =
    typeof rawResponseId === "string"
      ? rawResponseId
      : UNREADABLE_DELIVERY_RESPONSE_ID;
  const outcome: DeliveryReport["outcome"] =
    rawOutcome === "completed" ? "completed" : "interrupted";
  const readbackHash: string | undefined =
    typeof rawReadbackHash === "string" ? rawReadbackHash : undefined;
  const rawAct: unknown = readOwnDataProperty(rawAttestation, "act");
  const rawUserTurnId: unknown = readOwnDataProperty(
    rawAttestation,
    "userTurnId",
  );
  const rawAttestationHash: unknown = readOwnDataProperty(
    rawAttestation,
    "readbackHash",
  );
  const frozenAttestation: DeliveryReport["attestation"] =
    (rawAct !== "confirmed" &&
      rawAct !== "declined" &&
      rawAct !== "dismissed") ||
    typeof rawUserTurnId !== "string" ||
    typeof rawAttestationHash !== "string"
      ? undefined
      : Object.freeze({
          act: rawAct,
          userTurnId: rawUserTurnId,
          readbackHash: rawAttestationHash,
        });

  return Object.freeze({
    responseId,
    outcome,
    ...(readbackHash === undefined ? {} : { readbackHash }),
    ...(frozenAttestation === undefined
      ? {}
      : { attestation: frozenAttestation }),
  });
}

function snapshotFailureOutcome(outcome: FailureOutcome): FailureOutcome {
  const failures = Object.freeze(
    outcome.failures.map((failure) =>
      Object.freeze({
        callId: failure.callId,
        reason: failure.reason,
        message: failure.message,
      }),
    ),
  );
  return Object.freeze({ failures });
}

function responseBehaviorAt(
  failures: NormalizedStubTransportFailures,
  occurrence: number,
): StubResponseBehavior {
  if (failsAt(failures.respondAt, occurrence)) return "throw";
  if (failsAt(failures.respondRejectAt, occurrence)) return "reject";
  return "completed";
}

function outcomeBehaviorAt(
  behaviors: ReadonlyArray<StubOutcomeBehavior>,
  occurrence: number,
): StubOutcomeBehavior {
  return behaviors[occurrence - 1] ?? "completed";
}

export function createStubTransport(options: StubTransportOptions): StubTransportHarness {
  const capabilities: TransportCapabilities = Object.freeze(options.capabilities);
  const failures: NormalizedStubTransportFailures = normalizeFailures(options.failures);
  const outcomeBehaviors: ReadonlyArray<StubOutcomeBehavior> = Object.freeze([
    ...(options.outcomeBehaviors ?? []),
  ]);
  let status: TransportStatus = options.initialStatus ?? "idle";
  let nextSubscriberToken: number = 0;
  let nextEventSequence: number = 0;
  const statusSubscribers: Map<number, StatusSubscriber> = new Map();
  const batchSubscribers: Map<number, BatchSubscriber> = new Map();
  const catalogAttempts: Array<ReadonlyArray<EmittedTool>> = [];
  const responseAttempts: Array<StubTransportResponseAttempt> = [];
  const successfulResponseAttempts: Array<StubTransportResponseAttempt> = [];
  const deliveryCallbacks: Array<(report: DeliveryReport) => void> = [];
  const deliveryAttempts: Array<StubTransportDeliveryAttempt> = [];
  const outcomeAttempts: Array<StubTransportOutcomeAttempt> = [];
  const successfulOutcomes: Array<FailureOutcome> = [];
  const events: Array<StubTransportEvent> = [];

  function nextSequence(): number {
    nextEventSequence += 1;
    return nextEventSequence;
  }

  function recordDelivery(
    deliveryIndex: number,
    report: DeliveryReport,
  ): StubTransportDeliveryAttempt {
    const sequence: number = nextSequence();
    const attempt: StubTransportDeliveryAttempt = Object.freeze({
      sequence,
      deliveryIndex,
      report,
    });
    deliveryAttempts.push(attempt);
    events.push(
      Object.freeze({
        sequence,
        type: "delivery",
        deliveryIndex,
        report,
      }),
    );
    return attempt;
  }

  function recordOutcome(
    behavior: StubOutcomeBehavior,
    outcome: FailureOutcome,
  ): StubTransportOutcomeAttempt {
    const sequence: number = nextSequence();
    const attempt: StubTransportOutcomeAttempt = Object.freeze({
      sequence,
      behavior,
      outcome,
    });
    outcomeAttempts.push(attempt);
    events.push(
      Object.freeze({ sequence, type: "outcome", behavior, outcome }),
    );
    return attempt;
  }

  function recordResponse(
    behavior: StubResponseBehavior,
    attempt: StubTransportResponseAttempt,
  ): void {
    const sequence: number = nextSequence();
    events.push(
      Object.freeze({
        sequence,
        type: "response",
        behavior,
        callId: attempt.callId,
        result: attempt.result,
      }),
    );
  }

  function subscribeStatus(callback: StatusSubscriber): () => void {
    if (failures.subscribeStatus) {
      throw new Error(STATUS_SUBSCRIBE_FAILURE_MESSAGE);
    }

    const token: number = ++nextSubscriberToken;
    statusSubscribers.set(token, callback);

    return (): void => {
      if (failures.unsubscribeStatus) {
        throw new Error(STATUS_UNSUBSCRIBE_FAILURE_MESSAGE);
      }
      statusSubscribers.delete(token);
    };
  }

  function subscribeBatch(callback: BatchSubscriber): () => void {
    if (failures.subscribeBatch) {
      throw new Error(BATCH_SUBSCRIBE_FAILURE_MESSAGE);
    }

    const token: number = ++nextSubscriberToken;
    batchSubscribers.set(token, callback);

    return (): void => {
      if (failures.unsubscribeBatch) {
        throw new Error(BATCH_UNSUBSCRIBE_FAILURE_MESSAGE);
      }
      batchSubscribers.delete(token);
    };
  }

  const transport: Transport = {
    capabilities,
    get status(): TransportStatus {
      return status;
    },
    setTools: (tools: ReadonlyArray<EmittedTool>): void => {
      catalogAttempts.push(tools);
      if (failsAt(failures.setToolsAt, catalogAttempts.length)) {
        throw new Error(SET_TOOLS_FAILURE_MESSAGE);
      }
    },
    onStatusChange: subscribeStatus,
    onToolBatch: subscribeBatch,
    respond: (callId: string, result: ActionResult) => {
      const occurrence: number = responseAttempts.length + 1;
      const behavior: StubResponseBehavior = responseBehaviorAt(
        failures,
        occurrence,
      );
      const attempt: StubTransportResponseAttempt = Object.freeze({
        callId,
        result: snapshotActionResult(result),
      });
      responseAttempts.push(attempt);
      recordResponse(behavior, attempt);
      if (behavior === "throw") {
        throw new Error(RESPOND_FAILURE_MESSAGE);
      }
      if (behavior === "reject") {
        return Promise.reject(new Error(RESPOND_REJECTION_MESSAGE));
      }
      successfulResponseAttempts.push(attempt);
    },
  };
  Object.freeze(transport);

  const harness: StubTransportHarness = {
    transport,
    emitStatus: (nextStatus: TransportStatus): void => {
      if (nextStatus === status) return;
      status = nextStatus;

      const snapshot: ReadonlyArray<StatusSubscriber> = [
        ...statusSubscribers.values(),
      ];
      for (const callback of snapshot) callback(nextStatus);
    },
    emitBatch: (batch: ToolBatch): void => {
      const snapshot: ReadonlyArray<BatchSubscriber> = [
        ...batchSubscribers.values(),
      ];
      for (const callback of snapshot) callback(batch);
    },
    catalogHistory: (): ReadonlyArray<ReadonlyArray<EmittedTool>> =>
      Object.freeze([...catalogAttempts]),
    responseHistory: (): ReadonlyArray<StubTransportResponseAttempt> =>
      Object.freeze([...responseAttempts]),
    subscriberCounts: (): StubTransportSubscriberCounts =>
      Object.freeze({
        status: statusSubscribers.size,
        batch: batchSubscribers.size,
      }),
    deferUntilDelivered: (effect: (report: DeliveryReport) => void): void => {
      deliveryCallbacks.push(effect);
    },
    emitDelivery: (
      deliveryIndex: number,
      report: DeliveryReport,
    ): void => {
      const callback: ((report: DeliveryReport) => void) | undefined =
        deliveryCallbacks[deliveryIndex];
      if (callback === undefined) {
        throw new Error("No stub delivery callback exists at that index.");
      }
      const reportSnapshot: DeliveryReport = snapshotDeliveryReport(report);
      recordDelivery(deliveryIndex, reportSnapshot);
      callback(report);
    },
    deliveryCallbackCount: (): number => deliveryCallbacks.length,
    deliveryHistory: (): ReadonlyArray<StubTransportDeliveryAttempt> =>
      Object.freeze([...deliveryAttempts]),
    presentOutcome: (outcome: FailureOutcome): Promise<OutcomePresentationReport> => {
      const occurrence: number = outcomeAttempts.length + 1;
      const behavior: StubOutcomeBehavior = outcomeBehaviorAt(
        outcomeBehaviors,
        occurrence,
      );
      const outcomeSnapshot: FailureOutcome = snapshotFailureOutcome(outcome);
      recordOutcome(behavior, outcomeSnapshot);
      if (behavior === "throw") {
        throw new Error(OUTCOME_FAILURE_MESSAGE);
      }
      if (behavior === "reject") {
        return Promise.reject(new Error(OUTCOME_REJECTION_MESSAGE));
      }
      if (behavior === "interrupted") {
        return Promise.resolve(INTERRUPTED_OUTCOME_REPORT);
      }
      successfulOutcomes.push(outcomeSnapshot);
      return Promise.resolve(COMPLETED_OUTCOME_REPORT);
    },
    outcomeHistory: (): ReadonlyArray<StubTransportOutcomeAttempt> =>
      Object.freeze([...outcomeAttempts]),
    successfulOutcomeHistory: (): ReadonlyArray<FailureOutcome> =>
      Object.freeze([...successfulOutcomes]),
    successfulResponseHistory: ():
      ReadonlyArray<StubTransportResponseAttempt> =>
      Object.freeze([...successfulResponseAttempts]),
    eventHistory: (): ReadonlyArray<StubTransportEvent> =>
      Object.freeze([...events]),
  };

  return Object.freeze(harness);
}
