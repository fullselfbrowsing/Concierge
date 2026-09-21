import type {
  AbortSignalLike,
  BatchDispatchOutcome,
  CatalogRevision,
  Concierge,
  ConsentGrade,
  DeliveryReport,
  OutcomeSink,
  ReadbackAttestation,
  ResolvedCatalog,
  Scheduler,
  Session,
  SessionDiagnostic,
  StageContext,
  ToolBatch,
  TurnIdentityProvenance,
} from "@full-self-browsing/concierge";

/** One JSON value as it travels on the provider's wire, in either direction. */
export type RealtimeWireEvent = Readonly<Record<string, unknown>>;

/** A provider-shaped tool descriptor the host owns (server-executed tools). */
export type RealtimeForeignTool = Readonly<Record<string, unknown>>;

export type RealtimeChannelState = "idle" | "opening" | "open" | "closed";

export interface RealtimeChannelFault {
  readonly code:
    | "unreachable"
    | "rejected"
    | "dropped"
    | "closed-by-peer"
    | "malformed-handshake";
  readonly message: string;
}

/**
 * A bidirectional JSON event channel to a live agent. The runtime never
 * inspects media and never learns how the channel is carried.
 */
export interface RealtimeChannel {
  readonly state: RealtimeChannelState;
  /**
   * Establish the channel. Resolves when `state` is `"open"`. Implementations
   * must abandon every resource they created if `signal` aborts mid-handshake.
   */
  open(signal: AbortSignalLike): Promise<void>;
  /** `false` means the event was not handed to the wire; the caller retries. */
  send(event: RealtimeWireEvent): boolean;
  onEvent(cb: (event: unknown) => void): () => void;
  onStateChange(
    cb: (state: RealtimeChannelState, fault?: RealtimeChannelFault) => void,
  ): () => void;
  close(): void;
}

export type RealtimePlaybackEvent =
  | Readonly<{ kind: "started"; responseId: string }>
  /** The rendition drained in full. */
  | Readonly<{ kind: "drained"; responseId: string }>
  /** The rendition was cut off. Whatever was pending is not consent. */
  | Readonly<{ kind: "cleared"; responseId: string }>;

/**
 * What a transport may honestly treat as proof a rendition reached the human.
 *
 * `"buffer-drain"` — a separate playback channel reports drain/clear, and
 * generation completing with no output ever started fails closed.
 * `"generation-complete"` — the surface renders atomically, so there is no
 * output-started edge at all and generation completion IS delivery.
 */
export type RealtimeDeliveryEvidence = "buffer-drain" | "generation-complete";

/** Host-owned playback, for providers that stream raw audio frames. */
export interface RealtimePlaybackSource {
  readonly deliveryEvidence: RealtimeDeliveryEvidence;
  onPlayback(cb: (event: RealtimePlaybackEvent) => void): () => void;
  /** Discard anything still queued for `responseId`. */
  interrupt(responseId: string): void;
}

/** Neutral vocabulary every provider decodes into. */
export type RealtimeSignal =
  | Readonly<{ kind: "ignored" }>
  | Readonly<{ kind: "session.ready" }>
  | Readonly<{ kind: "session.configured"; correlationId: string | null }>
  | Readonly<{
      kind: "session.rejected";
      correlationId: string | null;
      /** `false` tears the session down; `true` keeps it and drops the update. */
      recoverable: boolean;
      message: string;
    }>
  /** The human began producing input. */
  | Readonly<{ kind: "turn.started"; turnId: string }>
  /** The human's input closed. */
  | Readonly<{ kind: "turn.committed"; turnId: string }>
  | Readonly<{ kind: "turn.transcribed"; turnId: string; text: string }>
  | Readonly<{ kind: "turn.transcription_failed"; turnId: string }>
  | Readonly<{ kind: "response.created"; responseId: string }>
  | Readonly<{ kind: "response.transcript"; responseId: string; text: string }>
  /**
   * Generation finished. `raw` is handed verbatim to `extractBatch`; the
   * runtime never parses provider payloads itself.
   */
  | Readonly<{ kind: "response.completed"; responseId: string; raw: unknown }>
  | Readonly<{ kind: "response.aborted"; responseId: string }>
  | Readonly<{ kind: "playback"; event: RealtimePlaybackEvent }>
  | Readonly<{ kind: "error"; recoverable: boolean; message: string }>;

export interface RealtimeCatalogPublication {
  readonly catalog: ResolvedCatalog;
  /**
   * Host tools published alongside the catalog. `null` means "not ready" and
   * suppresses publication entirely — distinct from an empty array, which
   * means "ready, and there are none".
   */
  readonly foreignTools: ReadonlyArray<RealtimeForeignTool> | null;
  /** Echo target for acknowledgement attribution, when the provider echoes. */
  readonly correlationId: string;
}

export interface RealtimeBatchSource {
  readonly raw: unknown;
  readonly sessionId: string;
  readonly userTurnId: string;
  readonly catalogRevision: CatalogRevision;
  readonly signal: AbortSignalLike;
  readonly deferUntilDelivered:
    | ((effect: (report: DeliveryReport) => void) => void)
    | undefined;
}

/** Pure protocol translation for one vendor. Holds no connection state. */
export interface RealtimeProvider {
  readonly id: string;
  /**
   * `"provider-signalled"` — playback edges arrive on the wire and are decoded
   * into `RealtimeSignal`. `"host-signalled"` — a `RealtimePlaybackSource` is
   * required in the session options.
   */
  readonly playback: "provider-signalled" | "host-signalled";
  /** `true` when acknowledgements echo `correlationId`; `false` means FIFO. */
  readonly echoesCorrelationId: boolean;
  decode(event: unknown): RealtimeSignal;
  encodeCatalog(publication: RealtimeCatalogPublication): RealtimeWireEvent;
  /** Delegates to the shipped core codec; `null` on any malformed payload. */
  extractBatch(source: RealtimeBatchSource): ToolBatch | null;
  encodeToolResults(
    outcome: BatchDispatchOutcome,
  ): ReadonlyArray<RealtimeWireEvent>;
  /** One follow-up after every result event. `null` if the vendor auto-continues. */
  encodeFollowUp(): RealtimeWireEvent | null;
  encodeUserText(text: string): ReadonlyArray<RealtimeWireEvent>;
  encodeInterrupt(): RealtimeWireEvent | null;
}

export interface RealtimeDeliveryLedgerConfig {
  readonly deliveryEvidence: RealtimeDeliveryEvidence;
  /** Hold a completed report open for a human act. Omit to report at drain. */
  readonly attestationWindowMs?: number | undefined;
  readonly scheduler?: Scheduler | undefined;
  readonly onDiagnostic?: ((diagnostic: RealtimeDiagnostic) => void) | undefined;
}

/**
 * Binds deferrals registered while dispatching the batch of response N to the
 * playback of the response that voices those results (N+1), and reports them
 * under **N**.
 *
 * The consent kernel arms only when `report.responseId` equals the
 * `meta.responseId` of the dispatch that registered the deferral. Reporting
 * the voicing response's id compiles, runs, and fails every gate forever.
 */
export interface RealtimeDeliveryLedger {
  /** The `deferUntilDelivered` hook to put on the batch from `originResponseId`. */
  deferFor(
    originResponseId: string,
  ): (effect: (report: DeliveryReport) => void) => void;
  /** Attach the `ReadbackSink` receipt hash that this delivery will carry. */
  attachReadbackHash(originResponseId: string, readbackHash: string): void;
  /** A human act the app observed. Settles any report still held for attestation. */
  observeAttestation(attestation: ReadbackAttestation): void;
  /** The next created response voices the oldest queued deferral group. */
  bindResponse(responseId: string): void;
  playbackStarted(responseId: string): void;
  playbackDrained(responseId: string): void;
  playbackCleared(responseId: string): void;
  /** Generation ended. Under `"buffer-drain"` with no output, fails closed. */
  generationCompleted(responseId: string): void;
  /**
   * Revoke everything. `retainPlaying` keeps groups whose rendition is still
   * mid-flight — see `RealtimeBargeInPolicy.revokeOn`, which is what selects it.
   */
  revokeAll(
    options?: Readonly<{ retainPlaying?: boolean | undefined }> | undefined,
  ): void;
  reset(): void;
}

export interface RealtimeTurnLedgerConfig {
  readonly provenance: TurnIdentityProvenance;
  /** Bounded response->turn retention. Default 64. */
  readonly maxTrackedResponses?: number | undefined;
}

/**
 * Latest-wins human turn identity, many responses to one turn.
 *
 * Deliberately not the same machine as the delivery ledger: no FIFO queue, no
 * complete-once, and a binding that outlives the response that created it.
 */
export interface RealtimeTurnLedger {
  readonly provenance: TurnIdentityProvenance;
  openTurn(turnId: string): void;
  currentTurnId(): string | null;
  /** Binds and returns the turn that caused `responseId`, or `null`. */
  bindResponse(responseId: string): string | null;
  turnOf(responseId: string): string | null;
  releaseResponse(responseId: string): void;
  reset(): void;
}

export interface RealtimeBargeInPolicy {
  /**
   * Which observation revokes a pending delivery.
   *
   * `"turn-start"` (default) matches the published fail-closed rule: input
   * detection revokes. `"playback-cleared"` waits for an explicit clear, which
   * avoids revoking on the agent's own rendition re-entering an acoustic input
   * path — and is strictly weaker, so it clamps the declarable grade.
   */
  readonly revokeOn?: "turn-start" | "playback-cleared" | undefined;
  /** Abort in-flight dispatch work on interruption. Default `true`. */
  readonly abortWork?: boolean | undefined;
  /** Ask the provider to stop the agent mid-rendition. Default `true`. */
  readonly stopRendition?: boolean | undefined;
}

export type RealtimeStopIntentClassifier = (transcript: string) => boolean;

export interface StopIntentOptions {
  /** Anchored phrases. Default is an English set; supply your own per locale. */
  readonly phrases?: ReadonlyArray<string> | undefined;
  /** Leading tokens stripped before matching. Default English fillers. */
  readonly fillers?: ReadonlyArray<string> | undefined;
}

export type RealtimeTranscriptEvent = Readonly<{
  turnId: string;
  /** `null` for a human turn not yet bound to a response. */
  responseId: string | null;
  role: "human" | "agent";
  text: string;
  /**
   * `"pending"` until the app calls `resolveTranscript` for the response, or
   * the response settles. `"discarded"` supersedes a prior `"pending"` and the
   * app must drop what it buffered.
   */
  status: "pending" | "final" | "discarded";
}>;

export type RealtimeRuntimeStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "responding"
  | "working"
  | "closed"
  | "failed";

export type RealtimeDiagnosticCode =
  | "channel_send_failed"
  | "channel_fault"
  | "catalog_rejected"
  | "catalog_unacknowledged"
  | "batch_extract_failed"
  | "delivery_revoked"
  | "delivery_unbound"
  | "provider_decode_failed"
  | "playback_source_missing"
  | "follow_up_failed";

export interface RealtimeDiagnostic {
  readonly code: RealtimeDiagnosticCode;
  readonly message: string;
  /** Never carries provider payloads, transcripts, or action arguments. */
  readonly responseId?: string | undefined;
}

export interface RealtimeSessionOptions {
  readonly concierge: Concierge;
  readonly channel: RealtimeChannel;
  readonly provider: RealtimeProvider;
  /** Core's failure-presentation gate. Forwarded verbatim to `createSession`. */
  readonly presentOutcome: OutcomeSink;
  readonly initialContext: StageContext;
  /** Application session namespace for invocation identity. */
  readonly sessionId: string;
  /**
   * How a human turn begins, and therefore what the transport may declare.
   *
   * `"detected"` -> `userTurnIdentity: "agent-forgeable"`: a recognizer closes
   * turns, so the agent's own rendition can re-enter and mint one.
   * `"explicit"` -> `"human-attested"`: the app calls `beginTurn()` from an act
   * the agent cannot perform. This is the only route by which a streaming
   * transport reaches `bindTo: "userTurn"`, and it is fixed at construction.
   */
  readonly turnSource: "detected" | "explicit";
  /**
   * Ceiling on what this session declares. The runtime lowers it to what the
   * configuration can honestly support and never raises it. Default `"relayed"`.
   */
  readonly consentGrade?: ConsentGrade | undefined;
  readonly bargeIn?: RealtimeBargeInPolicy | undefined;
  /** Required when `provider.playback === "host-signalled"`. */
  readonly playbackSource?: RealtimePlaybackSource | undefined;
  /**
   * Live getter for host-owned tools. Returning `null` suppresses publication
   * until they are ready; an empty array publishes the catalog alone.
   */
  readonly foreignTools?:
    | (() => ReadonlyArray<RealtimeForeignTool> | null)
    | undefined;
  /** Hold a delivered report open for a human act. Omit to disable. */
  readonly attestationWindowMs?: number | undefined;
  /** How long to wait for a catalog acknowledgement. Default 10_000. */
  readonly acknowledgementTimeoutMs?: number | undefined;
  /** Injected clock. Falls back to the structural host timer, then degrades. */
  readonly scheduler?: Scheduler | undefined;
  readonly stopIntent?: RealtimeStopIntentClassifier | undefined;
  readonly onTranscript?:
    | ((event: RealtimeTranscriptEvent) => void)
    | undefined;
  readonly onStatusChange?:
    | ((status: RealtimeRuntimeStatus) => void)
    | undefined;
  readonly onDiagnostic?:
    | ((diagnostic: RealtimeDiagnostic | SessionDiagnostic) => void)
    | undefined;
}

export interface RealtimeSessionHandle {
  /**
   * The core session. Catalog publication, revisions, epochs, batch
   * serialization, dispatch and terminal control live there, not here. Change
   * stage with `handle.session.setContext(ctx)`.
   */
  readonly session: Session;
  status(): RealtimeRuntimeStatus;
  /** `false` while a publication is in flight or queued. */
  catalogSettled(): boolean;
  /**
   * Open an explicit human turn. Required under `turnSource: "explicit"`;
   * throws under `"detected"`, where the recognizer owns turn boundaries.
   */
  beginTurn(turnId: string): void;
  /** Inject a typed human turn. Does not change declared turn provenance. */
  sendUserText(text: string): boolean;
  /** Treat this as a human interruption right now. */
  interrupt(): void;
  /** Keep or drop the buffered transcript for a response. */
  resolveTranscript(responseId: string, decision: "retain" | "discard"): void;
  /** Attach the `ReadbackSink` receipt hash that a later delivery will carry. */
  attachReadbackHash(originResponseId: string, readbackHash: string): void;
  /** Report a human act observed against a rendered readback hash. */
  attest(attestation: ReadbackAttestation): void;
  stop(): Promise<void>;
}

export type { CatalogRevision, ToolBatch };
