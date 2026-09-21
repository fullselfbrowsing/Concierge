import {
  assertSingleInstance,
  CONSENT_GRADE_ORDER,
  CONTRACT_VERSION,
  createSession,
} from "@full-self-browsing/concierge";
import type {
  BatchDispatchOutcome,
  CatalogAcknowledgement,
  CatalogRevision,
  ConsentGrade,
  ResolvedCatalog,
  Session,
  SessionDiagnostic,
  ToolBatch,
  Transport,
  TransportCapabilities,
  TransportStatus,
} from "@full-self-browsing/concierge";
import {
  createRealtimeDeliveryLedger,
  type RealtimeDeliveryLedgerInternal,
} from "./delivery-ledger.js";
import {
  createDiagnostic,
  createLocalAbortController,
  invokeHost,
  isAbortLike,
  notifyDiagnostic,
  resolveScheduler,
  validIdentifier,
} from "./host.js";
import { createRealtimeTurnLedger } from "./turn-ledger.js";
import type {
  RealtimeChannelState,
  RealtimeDiagnostic,
  RealtimeForeignTool,
  RealtimePlaybackEvent,
  RealtimeRuntimeStatus,
  RealtimeSessionHandle,
  RealtimeSessionOptions,
  RealtimeSignal,
  RealtimeTranscriptEvent,
  RealtimeWireEvent,
} from "./types.js";

const EXPECTED_CORE_CONTRACT_VERSION: number = 4;

const START_ERROR: string = "The realtime session could not start.";
const EXPLICIT_TURN_ERROR: string =
  "beginTurn is only available when turnSource is \"explicit\".";
const DEFAULT_ACK_TIMEOUT_MS: number = 10_000;

function clampGrade(
  requested: ConsentGrade,
  ceiling: ConsentGrade,
): ConsentGrade {
  const requestedRank: number = CONSENT_GRADE_ORDER.indexOf(requested);
  const ceilingRank: number = CONSENT_GRADE_ORDER.indexOf(ceiling);
  if (requestedRank <= ceilingRank) return requested;
  return ceiling;
}

function channelStatus(state: RealtimeChannelState): TransportStatus {
  if (state === "open") return "connected";
  if (state === "opening") return "connecting";
  if (state === "closed") return "closed";
  return "idle";
}

interface InFlightPublication {
  readonly revision: CatalogRevision;
  readonly correlationId: string;
  cancelTimeout: (() => void) | undefined;
}

interface PendingAgentTranscript {
  readonly responseId: string;
  turnId: string | null;
  text: string;
  resolved: boolean;
}

function createHandle(
  session: Session,
  statusOf: () => RealtimeRuntimeStatus,
  catalogSettled: () => boolean,
  beginTurn: (turnId: string) => void,
  sendUserText: (text: string) => boolean,
  interrupt: () => void,
  resolveTranscript: (
    responseId: string,
    decision: "retain" | "discard",
  ) => void,
  attachReadbackHash: (originResponseId: string, readbackHash: string) => void,
  attest: RealtimeSessionHandle["attest"],
  stop: () => Promise<void>,
): RealtimeSessionHandle {
  return Object.freeze({
    session,
    status: statusOf,
    catalogSettled,
    beginTurn,
    sendUserText,
    interrupt,
    resolveTranscript,
    attachReadbackHash,
    attest,
    stop,
  });
}

/**
 * Open a live agent session against one Concierge instance.
 *
 * Constructs a `Transport` over `channel` + `provider`, hands it to core's
 * `createSession`, and owns connection lifecycle, the provider event
 * taxonomy, turn identity, delivery evidence, interruption, and result
 * emission.
 */
export async function createRealtimeSession(
  options: RealtimeSessionOptions,
): Promise<RealtimeSessionHandle> {
  assertSingleInstance();
  if (CONTRACT_VERSION !== EXPECTED_CORE_CONTRACT_VERSION) {
    throw new Error(
      `@full-self-browsing/concierge-realtime expected core contract v${EXPECTED_CORE_CONTRACT_VERSION} ` +
        `but found v${CONTRACT_VERSION}; upgrade or reinstall ` +
        `@full-self-browsing/concierge-realtime and @full-self-browsing/concierge together.`,
    );
  }

  const provider = options.provider;
  const channel = options.channel;
  const turnSource = options.turnSource;
  const revokeOn = options.bargeIn?.revokeOn ?? "turn-start";
  const abortWork = options.bargeIn?.abortWork !== false;
  const stopRendition = options.bargeIn?.stopRendition !== false;
  const acknowledgementTimeoutMs =
    options.acknowledgementTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS;
  const scheduler = resolveScheduler(options.scheduler);
  const playbackSource = options.playbackSource;
  const diagnose = (
    diagnostic: RealtimeDiagnostic | SessionDiagnostic,
  ): void => {
    if (options.onDiagnostic === undefined) return;
    invokeHost(() => {
      options.onDiagnostic?.(diagnostic);
    });
  };
  const emitRealtime = (
    code: RealtimeDiagnostic["code"],
    responseId?: string,
  ): void => {
    diagnose(createDiagnostic(code, responseId));
  };

  let consentGrade: ConsentGrade = options.consentGrade ?? "relayed";
  if (provider.playback === "host-signalled" && playbackSource === undefined) {
    if (consentGrade !== "none") emitRealtime("playback_source_missing");
    consentGrade = "none";
  }
  if (options.attestationWindowMs === undefined) {
    consentGrade = clampGrade(consentGrade, "relayed");
  }
  if (revokeOn === "playback-cleared") {
    consentGrade = clampGrade(consentGrade, "delivered");
  }

  const capabilities: TransportCapabilities = Object.freeze({
    consentGrade,
    userTurnIdentity:
      turnSource === "explicit" ? "human-attested" : "agent-forgeable",
    parallelCalls: true,
    dynamicCatalog: true,
    acknowledgesCatalog: true,
  });

  const deliveryEvidence =
    provider.playback === "host-signalled"
      ? (playbackSource?.deliveryEvidence ?? "buffer-drain")
      : "buffer-drain";
  const deliveryLedger = createRealtimeDeliveryLedger({
    deliveryEvidence,
    attestationWindowMs: options.attestationWindowMs,
    scheduler: options.scheduler,
    onDiagnostic: (diagnostic) => diagnose(diagnostic),
  }) as RealtimeDeliveryLedgerInternal;
  const turnLedger = createRealtimeTurnLedger({
    provenance: capabilities.userTurnIdentity,
  });

  const connection = createLocalAbortController();
  let generation: number = 1;
  const attempt: number = generation;
  let active: boolean = true;
  let failed: boolean = false;
  let runtimeStatus: RealtimeRuntimeStatus = "connecting";
  let stopPromise: Promise<void> | null = null;
  let coreSession: Session | null = null;
  let acceptBatch:
    | ((batch: ToolBatch) => Promise<BatchDispatchOutcome>)
    | null = null;
  let emitAck: ((ack: CatalogAcknowledgement) => void) | null = null;
  let inFlight: InFlightPublication | null = null;
  let pendingCatalog: ResolvedCatalog | null = null;
  let nextCorrelation: number = 0;
  let firstAccepted: boolean = false;
  let resolveFirstAck: (() => void) | null = null;
  let rejectFirstAck: ((error: Error) => void) | null = null;
  const inFlightWork: Map<string, () => void> = new Map();
  const pendingTranscripts: Map<string, PendingAgentTranscript> = new Map();
  const statusListeners: Array<(status: TransportStatus) => void> = [];

  const setRuntimeStatus = (next: RealtimeRuntimeStatus): void => {
    if (runtimeStatus === next) return;
    runtimeStatus = next;
    if (options.onStatusChange !== undefined) {
      invokeHost(() => {
        options.onStatusChange?.(next);
      });
    }
  };

  const emitTranscript = (event: RealtimeTranscriptEvent): void => {
    if (options.onTranscript === undefined) return;
    invokeHost(() => {
      options.onTranscript?.(event);
    });
  };

  const emitTransportStatus = (status: TransportStatus): void => {
    for (const listener of [...statusListeners]) {
      invokeHost(() => {
        listener(status);
      });
    }
  };

  const readForeignTools = (): ReadonlyArray<RealtimeForeignTool> | null => {
    if (options.foreignTools === undefined) return [];
    try {
      return options.foreignTools();
    } catch {
      return null;
    }
  };

  const sendEvent = (event: RealtimeWireEvent): boolean => {
    try {
      return channel.send(event);
    } catch {
      return false;
    }
  };

  const acknowledge = (revision: CatalogRevision, accepted: boolean): void => {
    if (emitAck === null) return;
    invokeHost(() => {
      emitAck?.(Object.freeze({ revision, accepted }));
    });
    if (accepted && !firstAccepted) {
      firstAccepted = true;
      resolveFirstAck?.();
      resolveFirstAck = null;
      rejectFirstAck = null;
    }
  };

  const publishCatalog = (catalog: ResolvedCatalog): void => {
    if (!active || inFlight !== null) {
      pendingCatalog = catalog;
      return;
    }
    const foreignTools: ReadonlyArray<RealtimeForeignTool> | null =
      readForeignTools();
    if (foreignTools === null) {
      pendingCatalog = catalog;
      return;
    }
    nextCorrelation += 1;
    const correlationId: string = `concierge-su-${nextCorrelation}`;
    let encoded: RealtimeWireEvent;
    try {
      encoded = provider.encodeCatalog(
        Object.freeze({ catalog, foreignTools, correlationId }),
      );
    } catch {
      pendingCatalog = catalog;
      return;
    }
    if (!sendEvent(encoded)) {
      emitRealtime("channel_send_failed");
      pendingCatalog = catalog;
      return;
    }
    pendingCatalog = null;
    let cancelTimeout: (() => void) | undefined;
    if (scheduler !== undefined) {
      cancelTimeout = scheduler(() => {
        if (inFlight === null || inFlight.revision !== catalog.revision) return;
        inFlight = null;
        emitRealtime("catalog_unacknowledged");
        acknowledge(catalog.revision, false);
        if (pendingCatalog !== null) publishCatalog(pendingCatalog);
      }, acknowledgementTimeoutMs);
    }
    inFlight = { revision: catalog.revision, correlationId, cancelTimeout };
  };

  const settleInFlight = (accepted: boolean, rejected?: boolean): void => {
    const current: InFlightPublication | null = inFlight;
    if (current === null) return;
    current.cancelTimeout?.();
    inFlight = null;
    if (rejected === true) emitRealtime("catalog_rejected");
    acknowledge(current.revision, accepted);
    if (pendingCatalog !== null) publishCatalog(pendingCatalog);
  };

  const matchesPublication = (correlationId: string | null): boolean => {
    if (inFlight === null) return false;
    if (provider.echoesCorrelationId) {
      return correlationId === inFlight.correlationId;
    }
    return true;
  };

  const discardTranscript = (responseId: string): void => {
    const pending: PendingAgentTranscript | undefined =
      pendingTranscripts.get(responseId);
    if (pending === undefined || pending.resolved) return;
    pending.resolved = true;
    pendingTranscripts.delete(responseId);
    emitTranscript(
      Object.freeze({
        turnId: pending.turnId ?? pending.responseId,
        responseId: pending.responseId,
        role: "agent",
        text: pending.text,
        status: "discarded",
      }),
    );
  };

  const finalizeTranscript = (responseId: string): void => {
    const pending: PendingAgentTranscript | undefined =
      pendingTranscripts.get(responseId);
    if (pending === undefined || pending.resolved) return;
    pending.resolved = true;
    pendingTranscripts.delete(responseId);
    emitTranscript(
      Object.freeze({
        turnId: pending.turnId ?? pending.responseId,
        responseId: pending.responseId,
        role: "agent",
        text: pending.text,
        status: "final",
      }),
    );
  };

  const applyPlayback = (event: RealtimePlaybackEvent): void => {
    if (event.kind === "started") {
      deliveryLedger.playbackStarted(event.responseId);
      return;
    }
    if (event.kind === "drained") {
      deliveryLedger.playbackDrained(event.responseId);
      finalizeTranscript(event.responseId);
      return;
    }
    deliveryLedger.playbackCleared(event.responseId);
    discardTranscript(event.responseId);
  };

  const abortInFlightWork = (): void => {
    const aborts: ReadonlyArray<() => void> = [...inFlightWork.values()];
    inFlightWork.clear();
    for (const abort of aborts) invokeHost(abort);
  };

  const interruptNow = (): void => {
    if (stopRendition) {
      let encoded: RealtimeWireEvent | null;
      try {
        encoded = provider.encodeInterrupt();
      } catch {
        encoded = null;
      }
      if (encoded !== null && !sendEvent(encoded)) {
        emitRealtime("channel_send_failed");
      }
      if (playbackSource !== undefined) {
        for (const responseId of pendingTranscripts.keys()) {
          invokeHost(() => {
            playbackSource.interrupt(responseId);
          });
        }
      }
    }
    if (abortWork) abortInFlightWork();
    deliveryLedger.revokeAll(
      Object.freeze({ retainPlaying: revokeOn === "playback-cleared" }),
    );
  };

  const emitResults = (outcome: BatchDispatchOutcome): void => {
    if (!active) return;
    if (outcome.kind === "terminal") return;
    let encoded: ReadonlyArray<RealtimeWireEvent>;
    try {
      encoded = provider.encodeToolResults(outcome);
    } catch {
      emitRealtime("follow_up_failed");
      return;
    }
    for (const event of encoded) {
      if (!sendEvent(event)) {
        emitRealtime("follow_up_failed");
        return;
      }
    }
    let followUp: RealtimeWireEvent | null;
    try {
      followUp = provider.encodeFollowUp();
    } catch {
      emitRealtime("follow_up_failed");
      return;
    }
    if (followUp !== null && !sendEvent(followUp)) {
      emitRealtime("follow_up_failed");
    }
  };

  const handleCompletedResponse = (
    responseId: string,
    raw: unknown,
  ): void => {
    const catalog: ResolvedCatalog | null = coreSession?.catalog() ?? null;
    const userTurnId: string | null =
      turnLedger.turnOf(responseId) ?? turnLedger.currentTurnId();
    if (catalog === null || userTurnId === null) {
      emitRealtime("batch_extract_failed", responseId);
      deliveryLedger.generationCompleted(responseId);
      setRuntimeStatus("listening");
      return;
    }
    deliveryLedger.rememberOriginTurn(responseId, userTurnId);
    const work = createLocalAbortController();
    inFlightWork.set(responseId, () => work.abort());
    let batch: ToolBatch | null;
    try {
      batch = provider.extractBatch(
        Object.freeze({
          raw,
          sessionId: options.sessionId,
          userTurnId,
          catalogRevision: catalog.revision,
          signal: work.signal,
          deferUntilDelivered: deliveryLedger.deferFor(responseId),
        }),
      );
    } catch {
      batch = null;
      emitRealtime("batch_extract_failed", responseId);
    }
    deliveryLedger.generationCompleted(responseId);
    if (batch === null) {
      inFlightWork.delete(responseId);
      setRuntimeStatus("listening");
      return;
    }
    const accept: typeof acceptBatch = acceptBatch;
    if (accept === null) {
      inFlightWork.delete(responseId);
      setRuntimeStatus("listening");
      return;
    }
    setRuntimeStatus("working");
    void accept(batch)
      .then((outcome) => {
        inFlightWork.delete(responseId);
        emitResults(outcome);
        if (active && runtimeStatus === "working") setRuntimeStatus("listening");
      })
      .catch(() => {
        inFlightWork.delete(responseId);
        if (active && runtimeStatus === "working") setRuntimeStatus("listening");
      });
  };

  const handleSignal = (signal: RealtimeSignal): void => {
    switch (signal.kind) {
      case "ignored":
        return;
      case "session.ready":
        if (pendingCatalog !== null && inFlight === null) {
          publishCatalog(pendingCatalog);
        }
        return;
      case "session.configured":
        if (!matchesPublication(signal.correlationId)) return;
        settleInFlight(true);
        return;
      case "session.rejected":
        if (!matchesPublication(signal.correlationId)) return;
        if (signal.recoverable) {
          settleInFlight(false, true);
          return;
        }
        failed = true;
        void stopHandle();
        return;
      case "turn.started":
        turnLedger.openTurn(signal.turnId);
        interruptNow();
        return;
      case "turn.committed":
        turnLedger.openTurn(signal.turnId);
        return;
      case "turn.transcribed":
        turnLedger.openTurn(signal.turnId);
        emitTranscript(
          Object.freeze({
            turnId: signal.turnId,
            responseId: null,
            role: "human",
            text: signal.text,
            status: "final",
          }),
        );
        if (options.stopIntent?.(signal.text) === true) interruptNow();
        return;
      case "turn.transcription_failed":
        turnLedger.openTurn(signal.turnId);
        return;
      case "response.created": {
        const boundTurn: string | null = turnLedger.bindResponse(signal.responseId);
        deliveryLedger.bindResponse(signal.responseId);
        if (boundTurn !== null) {
          const pending: PendingAgentTranscript | undefined =
            pendingTranscripts.get(signal.responseId);
          if (pending !== undefined) pending.turnId = boundTurn;
        }
        setRuntimeStatus("responding");
        return;
      }
      case "response.transcript": {
        const turnId: string | null = turnLedger.turnOf(signal.responseId);
        const pending: PendingAgentTranscript = {
          responseId: signal.responseId,
          turnId,
          text: signal.text,
          resolved: false,
        };
        pendingTranscripts.set(signal.responseId, pending);
        emitTranscript(
          Object.freeze({
            turnId: turnId ?? signal.responseId,
            responseId: signal.responseId,
            role: "agent",
            text: signal.text,
            status: "pending",
          }),
        );
        return;
      }
      case "response.completed":
        handleCompletedResponse(signal.responseId, signal.raw);
        return;
      case "response.aborted":
        inFlightWork.get(signal.responseId)?.();
        inFlightWork.delete(signal.responseId);
        deliveryLedger.playbackCleared(signal.responseId);
        discardTranscript(signal.responseId);
        if (runtimeStatus === "responding" || runtimeStatus === "working") {
          setRuntimeStatus("listening");
        }
        return;
      case "playback":
        applyPlayback(signal.event);
        return;
      case "error":
        diagnose(
          Object.freeze({
            code: "channel_fault" as const,
            message: createDiagnostic("channel_fault").message,
          }),
        );
        if (!signal.recoverable) {
          failed = true;
          void stopHandle();
        }
        return;
      default:
        return;
    }
  };

  const onChannelEvent = (event: unknown): void => {
    if (!active) return;
    let decoded: RealtimeSignal;
    try {
      decoded = provider.decode(event);
    } catch {
      emitRealtime("provider_decode_failed");
      return;
    }
    handleSignal(decoded);
  };

  const onChannelState = (state: RealtimeChannelState): void => {
    emitTransportStatus(channelStatus(state));
    if (state === "open" && pendingCatalog !== null && inFlight === null) {
      publishCatalog(pendingCatalog);
    }
    if (state === "closed" && active) {
      failed = true;
      emitRealtime("channel_fault");
      void stopHandle();
    }
  };

  let unsubscribeEvents: () => void = () => {};
  let unsubscribeState: () => void = () => {};
  let unsubscribePlayback: () => void = () => {};

  function stopHandle(): Promise<void> {
    if (stopPromise !== null) return stopPromise;
    active = false;
    generation += 1;
    connection.abort();
    inFlight?.cancelTimeout?.();
    inFlight = null;
    pendingCatalog = null;
    abortInFlightWork();
    invokeHost(unsubscribeEvents);
    invokeHost(unsubscribeState);
    invokeHost(unsubscribePlayback);
    deliveryLedger.reset();
    turnLedger.reset();
    for (const responseId of [...pendingTranscripts.keys()]) {
      discardTranscript(responseId);
    }
    try {
      channel.close();
    } catch {
      // Channel close is best effort during teardown.
    }
    const sessionStop: Promise<void> =
      coreSession?.stop() ?? Promise.resolve();
    stopPromise = sessionStop.then(() => {
      setRuntimeStatus(failed ? "failed" : "closed");
    });
    return stopPromise;
  }

  try {
    unsubscribeEvents = channel.onEvent(onChannelEvent);
    unsubscribeState = channel.onStateChange((state, fault) => {
      if (fault !== undefined && active) {
        failed = true;
        emitRealtime("channel_fault");
        void stopHandle();
        return;
      }
      onChannelState(state);
    });
    if (playbackSource !== undefined) {
      unsubscribePlayback = playbackSource.onPlayback((event) => {
        if (!active) return;
        invokeHost(() => {
          applyPlayback(event);
        });
      });
    }

    await channel.open(connection.signal);
    if (attempt !== generation || connection.signal.aborted) {
      channel.close();
      throw new Error(START_ERROR);
    }

    const transport: Transport = {
      capabilities,
      get status(): TransportStatus {
        return channelStatus(channel.state);
      },
      setCatalog(catalog: ResolvedCatalog): void {
        publishCatalog(catalog);
      },
      onStatusChange(cb: (status: TransportStatus) => void): () => void {
        statusListeners.push(cb);
        return (): void => {
          const index: number = statusListeners.indexOf(cb);
          if (index >= 0) statusListeners.splice(index, 1);
        };
      },
      onToolBatch(cb: (batch: ToolBatch) => Promise<BatchDispatchOutcome>): () => void {
        acceptBatch = cb;
        return (): void => {
          if (acceptBatch === cb) acceptBatch = null;
        };
      },
      onCatalogAcknowledged(
        cb: (ack: CatalogAcknowledgement) => void,
      ): () => void {
        emitAck = cb;
        return (): void => {
          if (emitAck === cb) emitAck = null;
        };
      },
    };

    coreSession = createSession({
      concierge: options.concierge,
      transport,
      presentOutcome: options.presentOutcome,
      initialContext: options.initialContext,
      onDiagnostic: (diagnostic) => diagnose(diagnostic),
    });

    if (attempt !== generation) {
      await stopHandle();
      throw new Error(START_ERROR);
    }

    if (!firstAccepted) {
      const firstAck: Promise<void> = new Promise<void>((resolve, reject) => {
        resolveFirstAck = resolve;
        rejectFirstAck = reject;
      });
      let cancelWait: (() => void) | undefined;
      if (scheduler !== undefined) {
        cancelWait = scheduler(() => {
          emitRealtime("catalog_unacknowledged");
          rejectFirstAck?.(new Error(START_ERROR));
        }, acknowledgementTimeoutMs);
      }
      try {
        await firstAck;
      } catch (error) {
        cancelWait?.();
        await stopHandle();
        throw error instanceof Error ? error : new Error(START_ERROR);
      }
      cancelWait?.();
    }

    if (attempt !== generation) {
      await stopHandle();
      throw new Error(START_ERROR);
    }

    setRuntimeStatus("listening");
    return createHandle(
      coreSession,
      () => runtimeStatus,
      () => inFlight === null && pendingCatalog === null,
      (turnId: string): void => {
        if (turnSource !== "explicit") throw new Error(EXPLICIT_TURN_ERROR);
        if (!validIdentifier(turnId)) return;
        turnLedger.openTurn(turnId);
      },
      (text: string): boolean => {
        if (!active) return false;
        let events: ReadonlyArray<RealtimeWireEvent>;
        try {
          events = provider.encodeUserText(text);
        } catch {
          return false;
        }
        for (const event of events) {
          if (!sendEvent(event)) {
            emitRealtime("channel_send_failed");
            return false;
          }
        }
        return true;
      },
      (): void => {
        if (active) interruptNow();
      },
      (responseId: string, decision: "retain" | "discard"): void => {
        if (decision === "discard") discardTranscript(responseId);
        else finalizeTranscript(responseId);
      },
      (originResponseId: string, readbackHash: string): void => {
        deliveryLedger.attachReadbackHash(originResponseId, readbackHash);
      },
      (attestation) => {
        deliveryLedger.observeAttestation(attestation);
      },
      stopHandle,
    );
  } catch (error) {
    if (isAbortLike(error) || attempt !== generation) {
      await stopHandle();
      throw new Error(START_ERROR);
    }
    await stopHandle();
    throw error instanceof Error && error.message === START_ERROR
      ? error
      : new Error(START_ERROR);
  }
}
