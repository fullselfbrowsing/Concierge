/**
 * Hot Session ownership for transport publication, batch routing, and teardown.
 *
 * A Session has three distinct views of catalog state: what the application
 * most recently confirmed, what a reentrant publication is attempting, and
 * what the transport most recently accepted. Keeping those references
 * separate is what lets a nested context reconcile against transport reality
 * without ever confirming the superseded context that published it.
 *
 * All mutable state is factory-local. The module remains safe to evaluate on a
 * server and deliberately contains no DOM, timer, network, or vendor vocabulary.
 * Its narrow consent role is the session trust boundary: validate the actual
 * transport capability and capture the app-owned outcome presenter. Consent
 * authority and occurrence evidence remain owned by Concierge.
 */

import { assertSingleInstance } from "./contract.js";
import {
  consentProfileOf,
  profileDominates,
  snapshotConsentProfile,
} from "./consent-profile.js";
import { warnHost } from "./host.js";
import type {
  ActionResult,
  AbortSignalLike,
  EmittedTool,
  FailureOutcome,
  FailureOutcomeRow,
  OutcomeSink,
  Session,
  SessionConfig,
  SessionDiagnostic,
  SessionDiagnosticCode,
  StageContext,
  ToolBatch,
  Transport,
  TransportCapabilities,
  TransportStatus,
} from "./types.js";

// ---------------------------------------------------------------------------
// Module scope — immutable declarations only
// ---------------------------------------------------------------------------

const START_ERROR: string = "The session could not start.";
const FIXED_CATALOG_ERROR: string =
  "This transport does not support catalog changes.";
const PUBLICATION_ERROR: string =
  "The session could not publish the current catalog.";
const STOPPED_ERROR: string = "This session has stopped.";

const EMPTY_CATALOG: ReadonlyArray<EmittedTool> = Object.freeze([]);

const DIAGNOSTIC_MESSAGES: Readonly<Record<SessionDiagnosticCode, string>> =
  Object.freeze({
    catalog_publish_failed:
      "The transport rejected a catalog publication, so the session was stopped.",
    batch_dispatch_failed:
      "The dispatcher could not complete an accepted batch; later batches will continue.",
    response_failed: "The transport rejected a result; it was not retried.",
    stage_listener_failed:
      "A stage subscriber threw; remaining subscribers will continue.",
    transport_subscribe_failed:
      "The transport could not register a session subscription; construction was rolled back.",
    transport_unsubscribe_failed:
      "The transport could not remove a session subscription; remaining cleanup continued.",
    catalog_clear_failed:
      "The transport could not clear its catalog; remaining cleanup continued.",
    abort_signal_failed:
      "A batch cancellation signal failed; the batch was treated as cancelled.",
    batch_without_context:
      "A batch arrived before session context was set and was ignored.",
    outcome_presentation_failed:
      "The application could not present the failed outcome; no result was released.",
  });

type Lifecycle = "starting" | "active" | "stopped";

interface ResolvedContext {
  readonly catalog: ReadonlyArray<EmittedTool>;
  readonly stage: string | null;
}

interface ContextTransition {
  readonly kind: "context";
  readonly generation: number;
  readonly context: StageContext | null;
  readonly resolved: ResolvedContext | null;
}

interface ConnectedTransition {
  readonly kind: "connected";
}

type Transition = ContextTransition | ConnectedTransition;

interface RequestedContextAuthority {
  readonly generation: number;
  readonly context: StageContext;
}

interface CatalogEpoch {
  readonly catalog: ReadonlyArray<EmittedTool>;
  readonly work: Set<QueuedOccurrence>;
  aborted: boolean;
}

interface CancellationScope {
  readonly signal: AbortSignalLike;
  readonly abort: () => void;
  readonly dispose: () => void;
  readonly connect: (sourceBatch: ToolBatch) => void;
}

interface OccurrenceBinding {
  readonly context: StageContext;
  readonly epoch: CatalogEpoch | null;
}

type ArrivalAuthority =
  | "confirmed"
  | "confirmed-replay"
  | "requested-transition"
  | "unpublished-attempt";

interface QueuedOccurrence {
  readonly sequence: number;
  readonly sourceBatch: ToolBatch;
  readonly cancellation: CancellationScope;
  readonly arrivalAuthority: ArrivalAuthority;
  readonly arrivalContext: StageContext;
  readonly arrivalGeneration: number;
  binding: OccurrenceBinding | null;
  linkedEpoch: CatalogEpoch | null;
  pendingAttemptToken: number | null;
}

function ownDataValue(value: object, key: keyof TransportCapabilities): unknown {
  const descriptor: PropertyDescriptor | undefined =
    Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(START_ERROR);
  }
  return descriptor.value;
}

/** Snapshot all four required capability fields without invoking accessors. */
function snapshotTransportCapabilities(value: unknown): TransportCapabilities {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(START_ERROR);
  }

  const prototype: object | null = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(START_ERROR);
  }

  const profile = snapshotConsentProfile(value);
  const parallelCalls: unknown = ownDataValue(value, "parallelCalls");
  const dynamicCatalog: unknown = ownDataValue(value, "dynamicCatalog");
  if (typeof parallelCalls !== "boolean" || typeof dynamicCatalog !== "boolean") {
    throw new TypeError(START_ERROR);
  }

  return Object.freeze({
    consentGrade: profile.consentGrade,
    userTurnIdentity: profile.userTurnIdentity,
    parallelCalls,
    dynamicCatalog,
  });
}

/** Read only an own data capability value from the transport boundary. */
function captureTransportCapabilities(value: unknown): TransportCapabilities {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(START_ERROR);
  }
  const descriptor: PropertyDescriptor | undefined =
    Object.getOwnPropertyDescriptor(value, "capabilities");
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(START_ERROR);
  }
  return snapshotTransportCapabilities(descriptor.value);
}

type DispatchRow = Readonly<{
  callId: string;
  result: ActionResult;
}>;

/** Copy only app-authored failure prose into one detached, frozen batch view. */
function failureOutcomeFor(
  rows: ReadonlyArray<DispatchRow>,
): FailureOutcome | null {
  const failures: FailureOutcomeRow[] = [];
  for (const row of rows) {
    const result: ActionResult = row.result;
    if (result.ok !== false) continue;
    failures.push(Object.freeze({
      callId: row.callId,
      reason: result.reason,
      message: result.message,
    }));
  }
  if (failures.length === 0) return null;
  return Object.freeze({ failures: Object.freeze(failures) });
}

/** Accept only an own data completion claim without invoking report accessors. */
function outcomePresentationCompleted(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  try {
    const prototype: object | null = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const descriptor: PropertyDescriptor | undefined =
      Object.getOwnPropertyDescriptor(value, "outcome");
    return descriptor !== undefined &&
      "value" in descriptor &&
      descriptor.value === "completed";
  } catch {
    return false;
  }
}

/**
 * Create one hot Session and synchronously publish its initial catalog.
 *
 * The direct guard call is intentionally the first statement. Moving it to
 * module scope would let a consumer bundler erase the registration since the
 * package declares itself side-effect-free.
 */
export function createSession(config: SessionConfig): Session {
  assertSingleInstance();

  let concierge!: SessionConfig["concierge"];
  let transport!: Transport;
  let onDiagnostic!: SessionConfig["onDiagnostic"];
  let presentOutcome!: OutcomeSink;
  let actualCapabilities!: TransportCapabilities;
  try {
    concierge = config.concierge;
    transport = config.transport;
    const outcomeCandidate: unknown = config.presentOutcome;
    if (typeof outcomeCandidate !== "function") {
      throw new TypeError(START_ERROR);
    }
    presentOutcome = outcomeCandidate as OutcomeSink;
    actualCapabilities = captureTransportCapabilities(transport);
    if (!profileDominates(actualCapabilities, consentProfileOf(concierge))) {
      throw new TypeError(START_ERROR);
    }
    onDiagnostic = config.onDiagnostic;
  } catch {
    throw new Error(START_ERROR);
  }

  let lifecycle: Lifecycle = "starting";
  let requestedContext: StageContext | null = null;
  let requestedGeneration: number = 0;
  let transitionDraining: boolean = false;
  const transitionQueue: Transition[] = [];
  let activeRequestedAuthority: RequestedContextAuthority | null = null;

  let confirmedContext: StageContext | null = null;
  let confirmedGeneration: number | null = null;
  let confirmedCatalog: ReadonlyArray<EmittedTool> | null = null;
  let confirmedEpoch: CatalogEpoch | null = null;
  let currentStage: string | null = null;

  let publicationPending: boolean = false;
  let publicationAttemptToken: number = 0;
  let publishingCatalog: ReadonlyArray<EmittedTool> | null = null;
  let publishingGeneration: number | null = null;
  let publishingContext: StageContext | null = null;
  let publishingEpoch: CatalogEpoch | null = null;
  let publicationCallableCaptured: boolean = false;
  let publishingAuthority: "context-attempt" | "confirmed-replay" | null =
    null;

  let publishedCatalog: ReadonlyArray<EmittedTool> | null = null;
  let publishedEpoch: CatalogEpoch | null = null;
  const epochs: Set<CatalogEpoch> = new Set();

  const occurrenceQueue: QueuedOccurrence[] = [];
  let nextOccurrenceSequence: number = 0;
  let activeWork: QueuedOccurrence | null = null;
  let workPumpRunning: boolean = false;
  let workPumpPromise: Promise<void> | null = null;
  let acceptingBatchCount: number = 0;

  let nextStageListenerToken: number = 0;
  const stageListeners: Map<number, (stage: string | null) => void> = new Map();
  const stageNotifications: Array<string | null> = [];
  let stageNotifying: boolean = false;

  let observedStatus: TransportStatus = "idle";
  let unsubscribeStatus: (() => void) | null = null;
  let unsubscribeBatch: (() => void) | null = null;
  let cleanupStarted: boolean = false;

  let stopPromise: Promise<void> | null = null;
  let resolveStopPromise: (() => void) | null = null;
  let stopDrainStarted: boolean = false;
  const detachedWork: QueuedOccurrence[] = [];

  /** Emit one fresh, frozen, fixed diagnostic through the replacement sink. */
  function diagnose(code: SessionDiagnosticCode): void {
    const diagnostic: SessionDiagnostic = Object.freeze({
      code,
      message: DIAGNOSTIC_MESSAGES[code],
    });

    if (onDiagnostic !== undefined) {
      try {
        onDiagnostic(diagnostic);
      } catch {
        // A diagnostic replacement is contained and is never echoed elsewhere.
      }
      return;
    }

    try {
      warnHost(`concierge: [${code}] ${diagnostic.message}`);
    } catch {
      // The convenience channel can never become application control flow.
    }
  }

  /** Create one structural cancellation scope without importing DOM types. */
  function createCancellationScope(): CancellationScope {
    let aborted: boolean = false;
    let disposed: boolean = false;
    let connectionAttempted: boolean = false;
    let nextListenerToken: number = 0;
    const listeners: Map<number, () => void> = new Map();
    let upstreamSignal: AbortSignalLike | null = null;
    let upstreamListener: (() => void) | null = null;
    let upstreamRemove: AbortSignalLike["removeEventListener"] | null = null;
    let upstreamRemovalAttempted: boolean = false;

    const signal: AbortSignalLike = Object.freeze({
      get aborted(): boolean {
        return aborted;
      },
      addEventListener(type: "abort", listener: () => void): void {
        if (type !== "abort" || aborted || disposed) return;
        listeners.set(++nextListenerToken, listener);
      },
      removeEventListener(type: "abort", listener: () => void): void {
        if (type !== "abort") return;
        for (const [token, registered] of listeners) {
          if (registered === listener) listeners.delete(token);
        }
      },
    });

    function abort(): void {
      if (aborted) return;
      aborted = true;
      const snapshot: ReadonlyArray<() => void> = [...listeners.values()];
      listeners.clear();
      for (const listener of snapshot) {
        try {
          listener();
        } catch {
          diagnose("abort_signal_failed");
        }
      }
    }

    function dispose(): void {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      const candidate: AbortSignalLike | null = upstreamSignal;
      const listener: (() => void) | null = upstreamListener;
      const remove: AbortSignalLike["removeEventListener"] | null = upstreamRemove;
      upstreamSignal = null;
      upstreamListener = null;
      upstreamRemove = null;
      if (
        upstreamRemovalAttempted ||
        candidate === null ||
        listener === null ||
        remove === null
      ) {
        return;
      }
      upstreamRemovalAttempted = true;
      try {
        remove.call(candidate, "abort", listener);
      } catch {
        diagnose("abort_signal_failed");
      }
    }

    function connect(sourceBatch: ToolBatch): void {
      if (connectionAttempted || disposed) return;
      connectionAttempted = true;

      let candidateValue: unknown;
      try {
        candidateValue = sourceBatch.signal;
      } catch {
        diagnose("abort_signal_failed");
        abort();
        return;
      }
      if (aborted || disposed || candidateValue === undefined) return;
      if (typeof candidateValue !== "object" || candidateValue === null) {
        diagnose("abort_signal_failed");
        abort();
        return;
      }

      const candidate: AbortSignalLike = candidateValue as AbortSignalLike;
      let candidateAborted: unknown;
      try {
        candidateAborted = candidate.aborted;
      } catch {
        diagnose("abort_signal_failed");
        abort();
        return;
      }

      let addValue: unknown;
      try {
        addValue = candidate.addEventListener;
      } catch {
        diagnose("abort_signal_failed");
        abort();
        return;
      }

      let removeValue: unknown;
      try {
        removeValue = candidate.removeEventListener;
      } catch {
        diagnose("abort_signal_failed");
        abort();
        return;
      }

      if (
        typeof candidateAborted !== "boolean" ||
        typeof addValue !== "function" ||
        typeof removeValue !== "function"
      ) {
        diagnose("abort_signal_failed");
        abort();
        return;
      }
      if (candidateAborted) {
        abort();
        return;
      }

      const add: AbortSignalLike["addEventListener"] =
        addValue as AbortSignalLike["addEventListener"];
      const remove: AbortSignalLike["removeEventListener"] =
        removeValue as AbortSignalLike["removeEventListener"];
      const listener = (): void => {
        abort();
      };
      upstreamSignal = candidate;
      upstreamListener = listener;
      upstreamRemove = remove;
      try {
        add.call(candidate, "abort", listener);
      } catch {
        diagnose("abort_signal_failed");
        abort();
        return;
      }

      let raceClosedAborted: unknown;
      try {
        raceClosedAborted = candidate.aborted;
      } catch {
        diagnose("abort_signal_failed");
        abort();
        return;
      }
      if (typeof raceClosedAborted !== "boolean") {
        diagnose("abort_signal_failed");
        abort();
        return;
      }
      if (raceClosedAborted) abort();
    }

    return Object.freeze({ signal, abort, dispose, connect });
  }

  function createEpoch(catalog: ReadonlyArray<EmittedTool>): CatalogEpoch {
    const epoch: CatalogEpoch = {
      catalog,
      work: new Set<QueuedOccurrence>(),
      aborted: false,
    };
    epochs.add(epoch);
    return epoch;
  }

  /** Abort one catalog epoch before invoking any of its cancellation listeners. */
  function abortEpoch(epoch: CatalogEpoch): void {
    if (epoch.aborted) return;
    epoch.aborted = true;
    for (const work of [...epoch.work]) work.cancellation.abort();
    if (epoch.work.size === 0) epochs.delete(epoch);
  }

  function abortEpochsExcept(kept: CatalogEpoch | null): void {
    for (const epoch of [...epochs]) {
      if (epoch !== kept) abortEpoch(epoch);
    }
  }

  function clearPublication(
    epoch: CatalogEpoch | null,
    attemptToken: number,
  ): void {
    if (
      publishingEpoch !== epoch ||
      publicationAttemptToken !== attemptToken
    ) {
      return;
    }
    for (const occurrence of occurrenceQueue) {
      if (occurrence.pendingAttemptToken === attemptToken) {
        occurrence.pendingAttemptToken = null;
        if (occurrence.binding === null && occurrence.linkedEpoch === epoch) {
          linkOccurrenceToEpoch(occurrence, null);
        }
      }
    }
    if (epoch !== null && epoch.aborted && epoch.work.size === 0) {
      epochs.delete(epoch);
    }
    publicationPending = false;
    publishingCatalog = null;
    publishingGeneration = null;
    publishingContext = null;
    publishingEpoch = null;
    publicationCallableCaptured = false;
    publishingAuthority = null;
  }

  function publicationIsCurrent(attemptToken: number): boolean {
    return (
      lifecycle !== "stopped" &&
      publicationAttemptToken === attemptToken
    );
  }

  /** Preserve every original envelope member and replace only its signal. */
  function envelopeFor(work: QueuedOccurrence): ToolBatch {
    const envelope: ToolBatch = Object.create(null) as ToolBatch;
    Object.defineProperties(envelope, {
      responseId: {
        enumerable: true,
        get(): string {
          return work.sourceBatch.responseId;
        },
      },
      userTurnId: {
        enumerable: true,
        get(): string | undefined {
          return work.sourceBatch.userTurnId;
        },
      },
      calls: {
        enumerable: true,
        get(): ToolBatch["calls"] {
          return work.sourceBatch.calls;
        },
      },
      signal: {
        enumerable: true,
        get(): AbortSignalLike {
          return work.cancellation.signal;
        },
      },
      deferUntilDelivered: {
        enumerable: true,
        get(): ToolBatch["deferUntilDelivered"] {
          return work.sourceBatch.deferUntilDelivered;
        },
      },
    });
    return Object.freeze(envelope);
  }

  function linkOccurrenceToEpoch(
    occurrence: QueuedOccurrence,
    epoch: CatalogEpoch | null,
  ): void {
    const prior: CatalogEpoch | null = occurrence.linkedEpoch;
    if (prior === epoch) return;
    if (prior !== null) {
      prior.work.delete(occurrence);
      if (prior.aborted && prior.work.size === 0) epochs.delete(prior);
    }
    occurrence.linkedEpoch = epoch;
    if (epoch === null) return;
    epoch.work.add(occurrence);
    if (epoch.aborted) occurrence.cancellation.abort();
  }

  function bindOccurrence(
    occurrence: QueuedOccurrence,
    context: StageContext,
    epoch: CatalogEpoch | null,
  ): void {
    occurrence.binding = { context, epoch };
    linkOccurrenceToEpoch(occurrence, epoch);
  }

  /** Dispatch one accepted occurrence exactly once and finalize its link. */
  async function runWork(
    work: QueuedOccurrence,
    allowResponses: boolean,
  ): Promise<void> {
    const binding: OccurrenceBinding | null = work.binding;
    if (binding === null) {
      diagnose("batch_without_context");
      work.cancellation.dispose();
      linkOccurrenceToEpoch(work, null);
      return;
    }
    try {
      const rows = await concierge.dispatchBatch(
        binding.context,
        envelopeFor(work),
      );
      if (!allowResponses || lifecycle !== "active") return;
      const failureOutcome: FailureOutcome | null = failureOutcomeFor(rows);
      if (!allowResponses || lifecycle !== "active") return;
      if (failureOutcome !== null) {
        let completed: boolean = false;
        try {
          const report: unknown = await presentOutcome(failureOutcome);
          completed = outcomePresentationCompleted(report);
        } catch {
          completed = false;
        }
        if (!completed) {
          diagnose("outcome_presentation_failed");
          return;
        }
        if (!allowResponses || lifecycle !== "active") return;
      }
      for (const row of rows) {
        if (!allowResponses || lifecycle !== "active") break;
        try {
          const respond: typeof transport.respond = transport.respond;
          const callId: string = row.callId;
          const result = row.result;
          if (!allowResponses || lifecycle !== "active") break;
          Reflect.apply(respond, transport, [callId, result]);
        } catch {
          diagnose("response_failed");
        }
      }
    } catch {
      diagnose("batch_dispatch_failed");
    } finally {
      work.cancellation.dispose();
      linkOccurrenceToEpoch(work, null);
    }
  }

  async function runLivePump(): Promise<void> {
    while (
      lifecycle === "active" &&
      !publicationPending &&
      !transitionDraining &&
      transitionQueue.length === 0
    ) {
      const head: QueuedOccurrence | undefined = occurrenceQueue[0];
      if (head === undefined || head.binding === null) return;
      const work: QueuedOccurrence = occurrenceQueue.shift() as QueuedOccurrence;
      activeWork = work;
      await runWork(work, true);
      activeWork = null;
    }
  }

  /** Start the single FIFO worker with its observable Promise installed first. */
  function maybeStartPump(): void {
    if (
      lifecycle !== "active" ||
      publicationPending ||
      transitionDraining ||
      transitionQueue.length !== 0 ||
      workPumpRunning ||
      acceptingBatchCount !== 0 ||
      occurrenceQueue.length === 0 ||
      occurrenceQueue[0]?.binding === null
    ) {
      return;
    }

    workPumpRunning = true;
    let settleMarker: (() => void) | null = null;
    const marker: Promise<void> = new Promise<void>((resolve) => {
      settleMarker = resolve;
    });
    workPumpPromise = marker;

    const runner: Promise<void> = runLivePump();
    const finish = (): void => {
      workPumpRunning = false;
      workPumpPromise = null;
      const settle: (() => void) | null = settleMarker;
      settleMarker = null;
      if (settle !== null) settle();
      maybeStartPump();
    };
    void runner.then(finish, finish);
  }

  /** Bind unresolved occurrences in place after the drain chooses authority. */
  function bindQueuedOccurrences(): void {
    if (publicationPending || transitionQueue.length !== 0) return;
    for (let index = 0; index < occurrenceQueue.length; index += 1) {
      const occurrence: QueuedOccurrence = occurrenceQueue[index] as QueuedOccurrence;
      if (occurrence.binding !== null || occurrence.pendingAttemptToken !== null) {
        continue;
      }
      if (occurrence.arrivalAuthority === "requested-transition") {
        if (
          occurrence.arrivalGeneration === confirmedGeneration &&
          occurrence.arrivalContext === confirmedContext &&
          confirmedEpoch !== null
        ) {
          bindOccurrence(
            occurrence,
            occurrence.arrivalContext,
            confirmedEpoch,
          );
        } else {
          occurrence.cancellation.abort();
          bindOccurrence(
            occurrence,
            occurrence.arrivalContext,
            occurrence.linkedEpoch,
          );
        }
        continue;
      }
      if (
        lifecycle === "stopped" ||
        confirmedContext === null ||
        confirmedEpoch === null
      ) {
        if (lifecycle === "active") diagnose("batch_without_context");
        occurrence.cancellation.dispose();
        linkOccurrenceToEpoch(occurrence, null);
        occurrenceQueue.splice(index, 1);
        index -= 1;
        continue;
      }
      bindOccurrence(occurrence, confirmedContext, confirmedEpoch);
    }
  }

  /** Detach every queued occurrence in global arrival order for stop drain. */
  function detachQueuedOccurrences(): void {
    const occurrences: ReadonlyArray<QueuedOccurrence> =
      occurrenceQueue.splice(0);
    for (const occurrence of occurrences) {
      if (occurrence.binding === null) {
        occurrence.pendingAttemptToken = null;
        bindOccurrence(
          occurrence,
          occurrence.arrivalContext,
          occurrence.linkedEpoch,
        );
      }
      occurrence.cancellation.abort();
      detachedWork.push(occurrence);
    }
  }

  function abortSupersededUnlinkedAdmissions(generation: number): void {
    for (const occurrence of occurrenceQueue) {
      if (
        occurrence.binding === null &&
        occurrence.linkedEpoch === null &&
        (occurrence.arrivalAuthority === "unpublished-attempt" ||
          occurrence.arrivalAuthority === "requested-transition") &&
        occurrence.arrivalGeneration !== generation
      ) {
        occurrence.cancellation.abort();
      }
    }
  }

  /** Record a transport occurrence without inspecting its envelope fields. */
  function acceptBatch(batch: ToolBatch): void {
    if (lifecycle === "stopped") return;

    let arrivalAuthority: ArrivalAuthority = "confirmed";
    let arrivalContext: StageContext | null = null;
    let arrivalGeneration: number = requestedGeneration;
    let arrivalEpoch: CatalogEpoch | null = null;
    let binding: OccurrenceBinding | null = null;
    let pendingAttemptToken: number | null = null;

    if (publicationPending) {
      const publicationMatchesRequest: boolean =
        publishingGeneration === requestedGeneration &&
        publishingContext === requestedContext;
      if (
        publishingAuthority === "confirmed-replay" &&
        publicationMatchesRequest
      ) {
        arrivalAuthority = "confirmed-replay";
        arrivalContext = publishingContext;
        arrivalGeneration = publishingGeneration as number;
        arrivalEpoch = publishingEpoch;
        if (arrivalContext !== null && arrivalEpoch !== null) {
          binding = { context: arrivalContext, epoch: arrivalEpoch };
        }
      } else if (publicationCallableCaptured && publicationMatchesRequest) {
        arrivalAuthority = "unpublished-attempt";
        arrivalContext = publishingContext;
        arrivalGeneration = publishingGeneration as number;
        arrivalEpoch = publishingEpoch;
        if (arrivalContext !== null && arrivalEpoch !== null) {
          binding = { context: arrivalContext, epoch: arrivalEpoch };
        }
      } else {
        arrivalAuthority = "unpublished-attempt";
        arrivalContext = publicationMatchesRequest
          ? publishingContext
          : requestedContext;
        arrivalGeneration = publicationMatchesRequest
          ? (publishingGeneration as number)
          : requestedGeneration;
        arrivalEpoch = publicationMatchesRequest ? publishingEpoch : null;
        if (
          publicationMatchesRequest &&
          publishingAuthority === "context-attempt"
        ) {
          pendingAttemptToken = publicationAttemptToken;
        }
      }
    } else if (lifecycle === "active") {
      if (transitionQueue.length !== 0) {
        arrivalAuthority = "requested-transition";
        arrivalContext = requestedContext;
        arrivalGeneration = requestedGeneration;
      } else if (activeRequestedAuthority !== null) {
        arrivalAuthority = "requested-transition";
        arrivalContext = activeRequestedAuthority.context;
        arrivalGeneration = activeRequestedAuthority.generation;
      } else {
        arrivalContext = confirmedContext;
        arrivalEpoch = confirmedEpoch;
        if (arrivalContext !== null && arrivalEpoch !== null) {
          binding = { context: arrivalContext, epoch: arrivalEpoch };
        }
      }
    } else {
      return;
    }

    if (arrivalContext === null || (binding !== null && arrivalEpoch === null)) {
      if (lifecycle === "active") diagnose("batch_without_context");
      return;
    }

    acceptingBatchCount += 1;
    try {
      const cancellation: CancellationScope = createCancellationScope();
      const occurrence: QueuedOccurrence = {
        sequence: ++nextOccurrenceSequence,
        sourceBatch: batch,
        cancellation,
        arrivalAuthority,
        arrivalContext,
        arrivalGeneration,
        binding,
        linkedEpoch: null,
        pendingAttemptToken,
      };
      occurrenceQueue.push(occurrence);
      linkOccurrenceToEpoch(occurrence, arrivalEpoch);
      cancellation.connect(batch);
    } finally {
      acceptingBatchCount -= 1;
      if (acceptingBatchCount === 0) {
        if (hasStopped()) startStopDrain();
        else maybeStartPump();
      }
    }
  }

  /** Deliver stage values serially over identity-guarded subscriptions. */
  function notifyStage(nextStage: string | null): void {
    stageNotifications.push(nextStage);
    if (stageNotifying) return;
    stageNotifying = true;
    try {
      while (stageNotifications.length > 0 && lifecycle === "active") {
        const value: string | null = stageNotifications.shift() ?? null;
        const snapshot: ReadonlyArray<(stage: string | null) => void> = [
          ...stageListeners.values(),
        ];
        for (const listener of snapshot) {
          if (lifecycle !== "active") break;
          try {
            listener(value);
          } catch {
            diagnose("stage_listener_failed");
          }
        }
      }
    } finally {
      stageNotifying = false;
      if (lifecycle !== "active") stageNotifications.splice(0);
    }
  }

  function isCurrent(record: ContextTransition): boolean {
    return (
      lifecycle !== "stopped" &&
      record.generation === requestedGeneration &&
      record.context === requestedContext
    );
  }

  function captureCurrent<T>(
    record: ContextTransition,
    operation: () => T,
  ): { readonly value: T } | null {
    let value!: T;
    try {
      value = operation();
    } finally {
      if (!isCurrent(record)) return null;
    }
    return { value };
  }

  /** Read lifecycle without allowing TypeScript to freeze a stale narrowing. */
  function hasStopped(): boolean {
    return lifecycle === "stopped";
  }

  /** Establish stopped state before every reentrant outside cleanup step. */
  function enterStopped(): Promise<void> {
    if (stopPromise !== null) return stopPromise;

    let resolve!: () => void;
    const promise: Promise<void> = new Promise<void>((done) => {
      resolve = done;
    });
    stopPromise = promise;
    resolveStopPromise = resolve;
    lifecycle = "stopped";
    requestedGeneration += 1;
    activeRequestedAuthority = null;
    publicationAttemptToken += 1;
    transitionQueue.splice(0);
    publicationPending = false;
    publishingCatalog = null;
    publishingGeneration = null;
    publishingContext = null;
    publishingEpoch = null;
    publicationCallableCaptured = false;
    publishingAuthority = null;
    stageNotifications.splice(0);
    stageListeners.clear();
    detachQueuedOccurrences();
    abortEpochsExcept(null);
    return promise;
  }

  /** Attempt each outside cleanup independently after stopped state is visible. */
  function performCleanup(): void {
    if (cleanupStarted) return;
    cleanupStarted = true;

    const removeStatus: (() => void) | null = unsubscribeStatus;
    unsubscribeStatus = null;
    if (removeStatus !== null) {
      try {
        removeStatus();
      } catch {
        diagnose("transport_unsubscribe_failed");
      }
    }

    const removeBatch: (() => void) | null = unsubscribeBatch;
    unsubscribeBatch = null;
    if (removeBatch !== null) {
      try {
        removeBatch();
      } catch {
        diagnose("transport_unsubscribe_failed");
      }
    }

    try {
      transport.setTools(EMPTY_CATALOG);
    } catch {
      diagnose("catalog_clear_failed");
    }
  }

  /** Resolve the cached stop Promise after active and detached work drain. */
  function startStopDrain(): void {
    if (stopDrainStarted || acceptingBatchCount !== 0) return;
    stopDrainStarted = true;
    const activePump: Promise<void> | null = workPumpPromise;
    const records: ReadonlyArray<QueuedOccurrence> = detachedWork.splice(0);

    const drain = async (): Promise<void> => {
      try {
        if (activePump !== null) await activePump;
        for (const work of records) await runWork(work, false);
      } finally {
        activeWork = null;
        const resolve: (() => void) | null = resolveStopPromise;
        resolveStopPromise = null;
        if (resolve !== null) resolve();
      }
    };
    void drain();
  }

  function stopNow(): Promise<void> {
    const promise: Promise<void> = enterStopped();
    performCleanup();
    startStopDrain();
    return promise;
  }

  function failPublication(stage: string | null): never {
    currentStage = stage;
    enterStopped();
    diagnose("catalog_publish_failed");
    performCleanup();
    startStopDrain();
    throw new Error(PUBLICATION_ERROR);
  }

  function confirmContext(
    record: ContextTransition,
    resolved: ResolvedContext,
    epoch: CatalogEpoch | null,
  ): void {
    if (!isCurrent(record)) return;
    const priorStage: string | null = currentStage;
    confirmedContext = record.context;
    confirmedGeneration = record.generation;
    confirmedCatalog = resolved.catalog;
    confirmedEpoch = epoch;
    currentStage = resolved.stage;
    if (
      activeRequestedAuthority?.generation === record.generation &&
      activeRequestedAuthority.context === record.context
    ) {
      activeRequestedAuthority = null;
    }

    if (
      lifecycle === "active" &&
      isCurrent(record) &&
      resolved.stage !== priorStage
    ) {
      notifyStage(resolved.stage);
    }
  }

  function abandonSupersededPublication(
    record: ContextTransition,
    epoch: CatalogEpoch | null,
    attemptToken: number,
  ): boolean {
    if (!publicationIsCurrent(attemptToken)) return true;
    if (isCurrent(record)) return false;
    if (epoch !== null) abortEpoch(epoch);
    clearPublication(epoch, attemptToken);
    return true;
  }

  function processContext(record: ContextTransition): void {
    if (!isCurrent(record)) return;

    let resolved: ResolvedContext | null = record.resolved;
    if (resolved === null) {
      const catalogFor = captureCurrent(
        record,
        (): typeof concierge.catalogFor => concierge.catalogFor,
      );
      if (catalogFor === null) return;
      const catalog = captureCurrent(
        record,
        (): ReadonlyArray<EmittedTool> =>
          Reflect.apply(catalogFor.value, concierge, [
            record.context as StageContext,
          ]),
      );
      if (catalog === null) return;

      const stageFor = captureCurrent(
        record,
        (): typeof concierge.stageFor => concierge.stageFor,
      );
      if (stageFor === null) return;
      const stage = captureCurrent(
        record,
        (): string | null =>
          Reflect.apply(stageFor.value, concierge, [
            record.context as StageContext,
          ]),
      );
      if (stage === null) return;
      resolved = { catalog: catalog.value, stage: stage.value };
    }

    if (resolved.catalog === publishedCatalog) {
      let epoch: CatalogEpoch | null = publishedEpoch;
      if (record.context !== null && (epoch === null || epoch.aborted)) {
        epoch = createEpoch(resolved.catalog);
        publishedEpoch = epoch;
        abortEpochsExcept(epoch);
      }
      confirmContext(record, resolved, epoch);
      return;
    }

    if (publishedCatalog !== null) {
      if (actualCapabilities.dynamicCatalog === false) {
        currentStage = resolved.stage;
        stopNow();
        throw new Error(FIXED_CATALOG_ERROR);
      }
    }

    const epoch: CatalogEpoch | null =
      record.context === null ? null : createEpoch(resolved.catalog);
    const attemptToken: number = ++publicationAttemptToken;
    publicationPending = true;
    publishingCatalog = resolved.catalog;
    publishingGeneration = record.generation;
    publishingContext = record.context;
    publishingEpoch = epoch;
    publicationCallableCaptured = false;
    publishingAuthority = "context-attempt";
    abortEpochsExcept(epoch);

    if (abandonSupersededPublication(record, epoch, attemptToken)) return;

    let setTools: typeof transport.setTools;
    try {
      setTools = transport.setTools;
    } catch {
      if (abandonSupersededPublication(record, epoch, attemptToken)) return;
      if (lifecycle === "starting") throw new Error(START_ERROR);
      failPublication(resolved.stage);
    }
    if (abandonSupersededPublication(record, epoch, attemptToken)) return;
    publicationCallableCaptured = true;

    try {
      Reflect.apply(setTools, transport, [resolved.catalog]);
    } catch {
      if (lifecycle === "starting") throw new Error(START_ERROR);
      failPublication(resolved.stage);
    }

    if (!publicationIsCurrent(attemptToken)) return;
    publishedCatalog = resolved.catalog;
    publishedEpoch = epoch;

    if (!isCurrent(record)) {
      clearPublication(epoch, attemptToken);
      return;
    }

    clearPublication(epoch, attemptToken);
    confirmContext(record, resolved, epoch);
  }

  function processConnected(): void {
    if (lifecycle !== "active" || confirmedCatalog === null) return;
    const catalog: ReadonlyArray<EmittedTool> = confirmedCatalog;
    const context: StageContext | null = confirmedContext;
    const epoch: CatalogEpoch | null = confirmedEpoch;
    const authorityGeneration: number = requestedGeneration;
    const authorityContext: StageContext | null = requestedContext;
    const attemptToken: number = ++publicationAttemptToken;
    publicationPending = true;
    publishingCatalog = catalog;
    publishingGeneration = authorityGeneration;
    publishingContext = context;
    publishingEpoch = epoch;
    publicationCallableCaptured = false;
    publishingAuthority = "confirmed-replay";

    const abandonSupersededReplay = (): boolean => {
      if (!publicationIsCurrent(attemptToken)) return true;
      if (
        requestedGeneration === authorityGeneration &&
        requestedContext === authorityContext
      ) {
        return false;
      }
      clearPublication(epoch, attemptToken);
      return true;
    };

    let setTools: typeof transport.setTools;
    try {
      setTools = transport.setTools;
    } catch {
      if (abandonSupersededReplay()) return;
      failPublication(currentStage);
    }
    if (abandonSupersededReplay()) return;
    publicationCallableCaptured = true;

    try {
      Reflect.apply(setTools, transport, [catalog]);
    } catch {
      failPublication(currentStage);
    }

    if (!publicationIsCurrent(attemptToken)) return;
    publishedCatalog = catalog;
    publishedEpoch = epoch;
    if (abandonSupersededReplay()) return;
    clearPublication(epoch, attemptToken);
  }

  /** Drain context and connected controls in one synchronous outermost loop. */
  function drainTransitions(): void {
    if (transitionDraining || lifecycle === "stopped") return;
    transitionDraining = true;
    let firstFailure: { readonly value: unknown } | null = null;
    try {
      while (!hasStopped()) {
        const transition: Transition | undefined = transitionQueue.shift();
        if (transition === undefined) break;
        try {
          if (transition.kind === "context") {
            if (
              lifecycle === "active" &&
              transition.context !== null &&
              isCurrent(transition)
            ) {
              activeRequestedAuthority = {
                generation: transition.generation,
                context: transition.context,
              };
            }
            processContext(transition);
          } else {
            processConnected();
          }
        } catch (failure) {
          if (
            transition.kind === "context" &&
            activeRequestedAuthority?.generation === transition.generation &&
            activeRequestedAuthority.context === transition.context
          ) {
            activeRequestedAuthority = null;
          }
          if (
            transition.kind === "context" &&
            transition.generation === requestedGeneration &&
            transition.context === requestedContext
          ) {
            requestedContext = confirmedContext;
          }
          if (firstFailure === null) firstFailure = { value: failure };
        }
      }
    } finally {
      transitionDraining = false;
      bindQueuedOccurrences();
      maybeStartPump();
    }
    if (firstFailure !== null) throw firstFailure.value;
  }

  function handleStatus(status: TransportStatus): void {
    if (lifecycle === "stopped") return;
    const prior: TransportStatus = observedStatus;
    observedStatus = status;
    if (lifecycle !== "active") return;
    if (status === "connected" && prior !== "connected") {
      transitionQueue.push({ kind: "connected" });
      drainTransitions();
    }
  }

  function setContext(context: StageContext): void {
    if (lifecycle !== "active") throw new Error(STOPPED_ERROR);
    activeRequestedAuthority = null;
    requestedContext = context;
    const generation: number = ++requestedGeneration;
    abortSupersededUnlinkedAdmissions(generation);
    transitionQueue.push({
      kind: "context",
      generation,
      context,
      resolved: null,
    });
    drainTransitions();
  }

  function stage(): string | null {
    return currentStage;
  }

  function onStageChange(callback: (stage: string | null) => void): () => void {
    if (lifecycle !== "active") throw new Error(STOPPED_ERROR);
    const token: number = ++nextStageListenerToken;
    stageListeners.set(token, callback);
    return (): void => {
      if (stageListeners.get(token) === callback) stageListeners.delete(token);
    };
  }

  function stop(): Promise<void> {
    return stopNow();
  }

  let constructionDiagnostic: SessionDiagnosticCode =
    "catalog_publish_failed";
  try {
    const initialContext: StageContext | undefined = config.initialContext;
    requestedContext = initialContext ?? null;
    const generation: number = ++requestedGeneration;
    const resolved: ResolvedContext =
      initialContext === undefined
        ? { catalog: EMPTY_CATALOG, stage: null }
        : {
            catalog: concierge.catalogFor(initialContext),
            stage: concierge.stageFor(initialContext),
          };
    transitionQueue.push({
      kind: "context",
      generation,
      context: initialContext ?? null,
      resolved,
    });

    observedStatus = transport.status;
    constructionDiagnostic = "transport_subscribe_failed";
    const removeStatus: unknown = transport.onStatusChange(handleStatus);
    if (typeof removeStatus !== "function") throw new Error(START_ERROR);
    unsubscribeStatus = removeStatus as () => void;
    const removeBatch: unknown = transport.onToolBatch(acceptBatch);
    if (typeof removeBatch !== "function") throw new Error(START_ERROR);
    unsubscribeBatch = removeBatch as () => void;

    constructionDiagnostic = "catalog_publish_failed";
    drainTransitions();
    if (hasStopped()) throw new Error(START_ERROR);
    lifecycle = "active";
    maybeStartPump();

    const session: Session = { setContext, stage, onStageChange, stop };
    return Object.freeze(session);
  } catch {
    if (!hasStopped()) enterStopped();
    diagnose(constructionDiagnostic);
    performCleanup();
    startStopDrain();
    throw new Error(START_ERROR);
  }
}
