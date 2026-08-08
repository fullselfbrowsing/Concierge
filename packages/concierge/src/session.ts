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
 * server and deliberately contains no DOM, timer, network, consent, or vendor
 * vocabulary.
 */

import { assertSingleInstance } from "./contract.js";
import { warnHost } from "./host.js";
import type {
  AbortSignalLike,
  EmittedTool,
  Session,
  SessionConfig,
  SessionDiagnostic,
  SessionDiagnosticCode,
  StageContext,
  ToolBatch,
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

interface CatalogEpoch {
  readonly catalog: ReadonlyArray<EmittedTool>;
  readonly work: Set<WorkRecord>;
  aborted: boolean;
}

interface CancellationScope {
  readonly signal: AbortSignalLike;
  readonly abort: () => void;
  readonly dispose: () => void;
}

interface WorkRecord {
  readonly context: StageContext;
  readonly sourceBatch: ToolBatch;
  readonly epoch: CatalogEpoch;
  readonly cancellation: CancellationScope;
}

/**
 * Create one hot Session and synchronously publish its initial catalog.
 *
 * The direct guard call is intentionally the first statement. Moving it to
 * module scope would let a consumer bundler erase the registration because the
 * package declares itself side-effect-free.
 */
export function createSession(config: SessionConfig): Session {
  assertSingleInstance();

  const concierge: SessionConfig["concierge"] = config.concierge;
  const transport: SessionConfig["transport"] = config.transport;
  const onDiagnostic: SessionConfig["onDiagnostic"] = config.onDiagnostic;

  let lifecycle: Lifecycle = "starting";
  let requestedContext: StageContext | null = null;
  let requestedGeneration: number = 0;
  let transitionDraining: boolean = false;
  const transitionQueue: Transition[] = [];

  let confirmedContext: StageContext | null = null;
  let confirmedCatalog: ReadonlyArray<EmittedTool> | null = null;
  let confirmedEpoch: CatalogEpoch | null = null;
  let currentStage: string | null = null;

  let publicationPending: boolean = false;
  let publishingCatalog: ReadonlyArray<EmittedTool> | null = null;
  let publishingContext: StageContext | null = null;
  let publishingEpoch: CatalogEpoch | null = null;

  let publishedCatalog: ReadonlyArray<EmittedTool> | null = null;
  let publishedEpoch: CatalogEpoch | null = null;
  const epochs: Set<CatalogEpoch> = new Set();

  const workQueue: WorkRecord[] = [];
  let activeWork: WorkRecord | null = null;
  let workPumpRunning: boolean = false;
  let workPumpPromise: Promise<void> | null = null;

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
  const detachedWork: WorkRecord[] = [];

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
  function createCancellationScope(sourceBatch: ToolBatch): CancellationScope {
    let aborted: boolean = false;
    let disposed: boolean = false;
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

    const scope: CancellationScope = Object.freeze({ signal, abort, dispose });

    let candidateValue: unknown;
    try {
      candidateValue = sourceBatch.signal;
    } catch {
      diagnose("abort_signal_failed");
      abort();
      return scope;
    }
    if (candidateValue === undefined) return scope;
    if (typeof candidateValue !== "object" || candidateValue === null) {
      diagnose("abort_signal_failed");
      abort();
      return scope;
    }

    const candidate: AbortSignalLike = candidateValue as AbortSignalLike;
    let candidateAborted: unknown;
    try {
      candidateAborted = candidate.aborted;
    } catch {
      diagnose("abort_signal_failed");
      abort();
      return scope;
    }

    let addValue: unknown;
    try {
      addValue = candidate.addEventListener;
    } catch {
      diagnose("abort_signal_failed");
      abort();
      return scope;
    }

    let removeValue: unknown;
    try {
      removeValue = candidate.removeEventListener;
    } catch {
      diagnose("abort_signal_failed");
      abort();
      return scope;
    }

    if (
      typeof candidateAborted !== "boolean" ||
      typeof addValue !== "function" ||
      typeof removeValue !== "function"
    ) {
      diagnose("abort_signal_failed");
      abort();
      return scope;
    }
    if (candidateAborted) {
      abort();
      return scope;
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
      return scope;
    }

    let raceClosedAborted: unknown;
    try {
      raceClosedAborted = candidate.aborted;
    } catch {
      diagnose("abort_signal_failed");
      abort();
      return scope;
    }
    if (typeof raceClosedAborted !== "boolean") {
      diagnose("abort_signal_failed");
      abort();
      return scope;
    }
    if (raceClosedAborted) abort();
    return scope;
  }

  function createEpoch(catalog: ReadonlyArray<EmittedTool>): CatalogEpoch {
    const epoch: CatalogEpoch = {
      catalog,
      work: new Set<WorkRecord>(),
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

  function clearPublication(epoch: CatalogEpoch | null): void {
    if (publishingEpoch !== epoch) return;
    publicationPending = false;
    publishingCatalog = null;
    publishingContext = null;
    publishingEpoch = null;
  }

  /** Preserve every original envelope member and replace only its signal. */
  function envelopeFor(work: WorkRecord): ToolBatch {
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

  /** Dispatch one accepted occurrence exactly once and finalize its link. */
  async function runWork(work: WorkRecord, allowResponses: boolean): Promise<void> {
    try {
      const rows = await concierge.dispatchBatch(work.context, envelopeFor(work));
      for (const row of rows) {
        if (!allowResponses || lifecycle !== "active") break;
        try {
          transport.respond(row.callId, row.result);
        } catch {
          diagnose("response_failed");
        }
      }
    } catch {
      diagnose("batch_dispatch_failed");
    } finally {
      work.cancellation.dispose();
      work.epoch.work.delete(work);
      if (work.epoch.aborted && work.epoch.work.size === 0) {
        epochs.delete(work.epoch);
      }
    }
  }

  async function runLivePump(): Promise<void> {
    while (
      lifecycle === "active" &&
      !publicationPending &&
      !transitionDraining &&
      transitionQueue.length === 0
    ) {
      const work: WorkRecord | undefined = workQueue.shift();
      if (work === undefined) return;
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
      workQueue.length === 0
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

  /** Record a transport occurrence without inspecting its envelope fields. */
  function acceptBatch(batch: ToolBatch): void {
    if (lifecycle === "stopped") return;

    let context: StageContext | null;
    let epoch: CatalogEpoch | null;
    if (publicationPending) {
      context = publishingContext;
      epoch = publishingEpoch;
    } else if (lifecycle === "active") {
      context = confirmedContext;
      epoch = confirmedEpoch;
    } else {
      return;
    }

    if (context === null || epoch === null) {
      if (lifecycle === "active") diagnose("batch_without_context");
      return;
    }

    const cancellation: CancellationScope = createCancellationScope(batch);
    if (hasStopped()) {
      cancellation.abort();
      cancellation.dispose();
      return;
    }
    if (epoch.aborted) cancellation.abort();
    const work: WorkRecord = {
      context,
      sourceBatch: batch,
      epoch,
      cancellation,
    };
    epoch.work.add(work);
    workQueue.push(work);
    maybeStartPump();
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
    transitionQueue.splice(0);
    publicationPending = false;
    publishingCatalog = null;
    publishingContext = null;
    publishingEpoch = null;
    stageNotifications.splice(0);
    stageListeners.clear();
    detachedWork.push(...workQueue.splice(0));
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
    if (stopDrainStarted) return;
    stopDrainStarted = true;
    const activePump: Promise<void> | null = workPumpPromise;
    const records: ReadonlyArray<WorkRecord> = detachedWork.splice(0);

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
    confirmedCatalog = resolved.catalog;
    confirmedEpoch = epoch;
    currentStage = resolved.stage;

    if (
      lifecycle === "active" &&
      isCurrent(record) &&
      resolved.stage !== priorStage
    ) {
      notifyStage(resolved.stage);
    }
  }

  function processContext(record: ContextTransition): void {
    if (!isCurrent(record)) return;

    const resolved: ResolvedContext =
      record.resolved ?? {
        catalog: concierge.catalogFor(record.context as StageContext),
        stage: concierge.stageFor(record.context as StageContext),
      };
    if (!isCurrent(record)) return;

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

    if (
      publishedCatalog !== null &&
      transport.capabilities.dynamicCatalog === false
    ) {
      currentStage = resolved.stage;
      stopNow();
      throw new Error(FIXED_CATALOG_ERROR);
    }

    const epoch: CatalogEpoch | null =
      record.context === null ? null : createEpoch(resolved.catalog);
    publicationPending = true;
    publishingCatalog = resolved.catalog;
    publishingContext = record.context;
    publishingEpoch = epoch;
    abortEpochsExcept(epoch);

    if (!isCurrent(record)) {
      if (epoch !== null) abortEpoch(epoch);
      clearPublication(epoch);
      return;
    }

    try {
      transport.setTools(resolved.catalog);
    } catch {
      if (lifecycle === "starting") throw new Error(START_ERROR);
      failPublication(resolved.stage);
    }

    publishedCatalog = resolved.catalog;
    publishedEpoch = epoch;
    if (lifecycle === "stopped") return;

    if (!isCurrent(record)) {
      clearPublication(epoch);
      return;
    }

    clearPublication(epoch);
    confirmContext(record, resolved, epoch);
  }

  function processConnected(): void {
    if (lifecycle !== "active" || confirmedCatalog === null) return;
    const catalog: ReadonlyArray<EmittedTool> = confirmedCatalog;
    const context: StageContext | null = confirmedContext;
    const epoch: CatalogEpoch | null = confirmedEpoch;
    publicationPending = true;
    publishingCatalog = catalog;
    publishingContext = context;
    publishingEpoch = epoch;

    try {
      transport.setTools(catalog);
    } catch {
      failPublication(currentStage);
    }

    publishedCatalog = catalog;
    publishedEpoch = epoch;
    clearPublication(epoch);
  }

  /** Drain context and connected controls in one synchronous outermost loop. */
  function drainTransitions(): void {
    if (transitionDraining || lifecycle === "stopped") return;
    transitionDraining = true;
    try {
      while (!hasStopped()) {
        const transition: Transition | undefined = transitionQueue.shift();
        if (transition === undefined) break;
        if (transition.kind === "context") processContext(transition);
        else processConnected();
      }
    } finally {
      transitionDraining = false;
      maybeStartPump();
    }
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
    requestedContext = context;
    const generation: number = ++requestedGeneration;
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
    unsubscribeStatus = transport.onStatusChange(handleStatus);
    unsubscribeBatch = transport.onToolBatch(acceptBatch);

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
