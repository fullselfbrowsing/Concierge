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

export function createStubTransport(options: StubTransportOptions): StubTransportHarness {
  const capabilities: TransportCapabilities = Object.freeze(options.capabilities);
  let status: TransportStatus = options.initialStatus ?? "idle";
  let nextSubscriberToken: number = 0;
  const statusSubscribers: Map<number, StatusSubscriber> = new Map();
  const batchSubscribers: Map<number, BatchSubscriber> = new Map();

  function subscribeStatus(callback: StatusSubscriber): () => void {
    const token: number = ++nextSubscriberToken;
    statusSubscribers.set(token, callback);

    return (): void => {
      statusSubscribers.delete(token);
    };
  }

  function subscribeBatch(callback: BatchSubscriber): () => void {
    const token: number = ++nextSubscriberToken;
    batchSubscribers.set(token, callback);

    return (): void => {
      batchSubscribers.delete(token);
    };
  }

  const transport: Transport = {
    capabilities,
    get status(): TransportStatus {
      return status;
    },
    setTools: (_tools: ReadonlyArray<EmittedTool>): void => {},
    onStatusChange: subscribeStatus,
    onToolBatch: subscribeBatch,
    respond: (_callId: string, _result: ActionResult): void => {},
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
      Object.freeze([]),
    responseHistory: (): ReadonlyArray<StubTransportResponseAttempt> =>
      Object.freeze([]),
    subscriberCounts: (): StubTransportSubscriberCounts =>
      Object.freeze({
        status: statusSubscribers.size,
        batch: batchSubscribers.size,
      }),
  };

  return Object.freeze(harness);
}
