import type {
  ActionResult,
  EmittedTool,
  ToolBatch,
  Transport,
  TransportCapabilities,
  TransportStatus,
} from "../../src/types.js";

export interface StubTransportFailures {
  readonly setToolsAt?: ReadonlyArray<number> | undefined;
  readonly respondAt?: ReadonlyArray<number> | undefined;
  readonly subscribeStatus?: boolean | undefined;
  readonly subscribeBatch?: boolean | undefined;
  readonly unsubscribeStatus?: boolean | undefined;
  readonly unsubscribeBatch?: boolean | undefined;
}

export interface StubTransportOptions {
  readonly capabilities: TransportCapabilities;
  readonly initialStatus?: TransportStatus | undefined;
  readonly failures?: StubTransportFailures | undefined;
}

export interface StubTransportResponseAttempt {
  readonly callId: string;
  readonly result: ActionResult;
}

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
  readonly subscribeStatus: boolean;
  readonly subscribeBatch: boolean;
  readonly unsubscribeStatus: boolean;
  readonly unsubscribeBatch: boolean;
}

const SET_TOOLS_FAILURE_MESSAGE: string =
  "Stub transport injected setTools failure.";
const RESPOND_FAILURE_MESSAGE: string =
  "Stub transport injected respond failure.";
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

export function createStubTransport(options: StubTransportOptions): StubTransportHarness {
  const capabilities: TransportCapabilities = Object.freeze(options.capabilities);
  const failures: NormalizedStubTransportFailures = normalizeFailures(options.failures);
  let status: TransportStatus = options.initialStatus ?? "idle";
  let nextSubscriberToken: number = 0;
  const statusSubscribers: Map<number, StatusSubscriber> = new Map();
  const batchSubscribers: Map<number, BatchSubscriber> = new Map();
  const catalogAttempts: Array<ReadonlyArray<EmittedTool>> = [];
  const responseAttempts: Array<StubTransportResponseAttempt> = [];

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
    respond: (callId: string, result: ActionResult): void => {
      const attempt: StubTransportResponseAttempt = Object.freeze({
        callId,
        result,
      });
      responseAttempts.push(attempt);
      if (failsAt(failures.respondAt, responseAttempts.length)) {
        throw new Error(RESPOND_FAILURE_MESSAGE);
      }
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
  };

  return Object.freeze(harness);
}
