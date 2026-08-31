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
  BatchDispatchOutcome,
  FailureOutcome,
  FailureOutcomeRow,
  OutcomeSink,
  ResolvedCatalog,
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
const MAX_ACCEPTED_BATCH_CALLS: number = 10_000;

const DIAGNOSTIC_MESSAGES: Readonly<Record<SessionDiagnosticCode, string>> =
  Object.freeze({
    catalog_publish_failed:
      "The transport rejected a catalog publication, so the session was stopped.",
    batch_dispatch_failed:
      "The dispatcher could not complete an accepted batch; later batches will continue.",
    response_failed: "The transport rejected a result; it was not retried.",
    catalog_listener_failed:
      "A catalog subscriber threw; remaining subscribers will continue.",
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

type FailureCandidateRow = Readonly<{
  callId: string;
  result: ActionResult;
}>;

/** Copy only app-authored failure prose into one detached, frozen batch view. */
function failureOutcomeFor(
  rows: ReadonlyArray<FailureCandidateRow>,
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

interface V2EpochSignal {
  readonly signal: AbortSignalLike;
  readonly abort: () => void;
}

function snapshotAcceptedBatch(batch: ToolBatch): ToolBatch {
  const snapshot = {} as ToolBatch;
  for (const key of [
    "sessionId",
    "responseId",
    "catalogRevision",
    "calls",
    "userTurnId",
    "signal",
    "deferUntilDelivered",
  ] as const) {
    try {
      const descriptor: PropertyDescriptor | undefined =
        Object.getOwnPropertyDescriptor(batch, key);
      if (descriptor === undefined) continue;
      if ("value" in descriptor) {
        let value: unknown = descriptor.value;
        if (key === "calls" && Array.isArray(value)) {
          let length: unknown;
          try {
            const lengthDescriptor: PropertyDescriptor | undefined =
              Object.getOwnPropertyDescriptor(value, "length");
            length = lengthDescriptor !== undefined && "value" in lengthDescriptor
              ? lengthDescriptor.value
              : undefined;
          } catch {
            length = undefined;
          }
          if (
            typeof length !== "number" ||
            !Number.isSafeInteger(length) ||
            length < 0 ||
            length > MAX_ACCEPTED_BATCH_CALLS
          ) {
            Object.defineProperty(snapshot, key, {
              configurable: true,
              enumerable: true,
              get(): never {
                throw new Error("Unreadable batch calls.");
              },
            });
            continue;
          }

          const callsSnapshot: unknown[] = new Array<unknown>(length);
          let callsReadable: boolean = true;
          for (let index: number = 0; index < length; index += 1) {
            let slot: PropertyDescriptor | undefined;
            try {
              slot = Object.getOwnPropertyDescriptor(value, String(index));
            } catch {
              callsReadable = false;
              break;
            }
            if (slot === undefined) continue;
            if (!("value" in slot)) {
              Object.defineProperty(callsSnapshot, index, {
                configurable: true,
                enumerable: true,
                get(): never {
                  throw new Error("Unreadable call occurrence.");
                },
              });
              continue;
            }
            const callValue: unknown = slot.value;
            if (typeof callValue !== "object" || callValue === null) {
              callsSnapshot[index] = callValue;
              continue;
            }
            const callSnapshot: Record<string, unknown> = {};
            for (const callKey of ["callId", "name", "arguments", "outputIndex"]) {
              try {
                const callDescriptor: PropertyDescriptor | undefined =
                  Object.getOwnPropertyDescriptor(callValue, callKey);
                if (callDescriptor === undefined) continue;
                if ("value" in callDescriptor) {
                  Object.defineProperty(callSnapshot, callKey, {
                    value: callDescriptor.value,
                    enumerable: true,
                  });
                } else {
                  Object.defineProperty(callSnapshot, callKey, {
                    configurable: true,
                    enumerable: true,
                    get(): never {
                      throw new Error("Unreadable call metadata.");
                    },
                  });
                }
              } catch {
                Object.defineProperty(callSnapshot, callKey, {
                  configurable: true,
                  enumerable: true,
                  get(): never {
                    throw new Error("Unreadable call metadata.");
                  },
                });
              }
            }
            callsSnapshot[index] = Object.freeze(callSnapshot);
          }
          if (!callsReadable) {
            Object.defineProperty(snapshot, key, {
              configurable: true,
              enumerable: true,
              get(): never {
                throw new Error("Unreadable batch calls.");
              },
            });
            continue;
          }
          value = Object.freeze(callsSnapshot);
        }
        Object.defineProperty(snapshot, key, {
          value,
          enumerable: true,
        });
      } else {
        Object.defineProperty(snapshot, key, {
          configurable: true,
          enumerable: true,
          get(): never {
            throw new Error("Unreadable batch metadata.");
          },
        });
      }
    } catch {
      Object.defineProperty(snapshot, key, {
        configurable: true,
        enumerable: true,
        get(): never {
          throw new Error("Unreadable batch metadata.");
        },
      });
    }
  }
  return Object.freeze(snapshot);
}

function createEpochSignal(): V2EpochSignal {
  let aborted: boolean = false;
  let nextToken: number = 0;
  const listeners: Map<number, () => void> = new Map();
  const signal: AbortSignalLike = Object.freeze({
    get aborted(): boolean {
      return aborted;
    },
    addEventListener(type: "abort", listener: () => void): void {
      if (type === "abort" && !aborted) listeners.set(++nextToken, listener);
    },
    removeEventListener(type: "abort", listener: () => void): void {
      if (type !== "abort") return;
      for (const [token, current] of listeners) {
        if (current === listener) listeners.delete(token);
      }
    },
  });
  return {
    signal,
    abort(): void {
      if (aborted) return;
      aborted = true;
      const snapshot: ReadonlyArray<() => void> = [...listeners.values()];
      listeners.clear();
      for (const listener of snapshot) {
        try {
          listener();
        } catch {
          // Cancellation listeners are app-owned; one cannot block the rest.
        }
      }
    },
  };
}

function linkSignals(
  first: AbortSignalLike | undefined,
  second: AbortSignalLike,
): Readonly<{ signal: AbortSignalLike; dispose: () => void }> {
  const linked: V2EpochSignal = createEpochSignal();
  const listener = (): void => linked.abort();
  const sources: AbortSignalLike[] = [];
  for (const source of first === undefined ? [second] : [first, second]) {
    try {
      if (source.aborted) {
        linked.abort();
      } else {
        source.addEventListener("abort", listener);
        sources.push(source);
      }
    } catch {
      linked.abort();
    }
  }
  return Object.freeze({
    signal: linked.signal,
    dispose(): void {
      for (const source of sources) {
        try {
          source.removeEventListener("abort", listener);
        } catch {
          // Disposal is best effort and cannot change a settled outcome.
        }
      }
    },
  });
}

/** Build the contract-v3 session runtime. */
function createV2Session(
  config: SessionConfig,
  concierge: SessionConfig["concierge"],
  transport: Transport,
  capabilities: TransportCapabilities,
  presentOutcome: OutcomeSink,
  onDiagnostic: SessionConfig["onDiagnostic"],
): Session {
  let active: boolean = true;
  let currentContext: StageContext | null = null;
  let currentCatalog: ResolvedCatalog | null = null;
  let currentEpoch: V2EpochSignal | null = null;
  let generation: number = 0;
  let observedStatus: TransportStatus = "idle";
  let unsubscribeStatus: (() => void) | null = null;
  let unsubscribeBatch: (() => void) | null = null;
  let workTail: Promise<void> = Promise.resolve();
  let stopPromise: Promise<void> | null = null;
  let nextListenerToken: number = 0;
  let notifyingCatalog: boolean = false;
  const pendingCatalogNotifications: ResolvedCatalog[] = [];
  const listeners: Map<number, (catalog: ResolvedCatalog) => void> = new Map();

  const diagnose = (code: SessionDiagnosticCode): void => {
    const diagnostic: SessionDiagnostic = Object.freeze({
      code,
      message: DIAGNOSTIC_MESSAGES[code],
    });
    try {
      if (onDiagnostic !== undefined) onDiagnostic(diagnostic);
      else warnHost(`concierge: [${code}] ${diagnostic.message}`);
    } catch {
      // Diagnostics never participate in lifecycle control flow.
    }
  };

  const notifyCatalog = (resolved: ResolvedCatalog): void => {
    pendingCatalogNotifications.push(resolved);
    if (notifyingCatalog) return;
    notifyingCatalog = true;
    try {
      while (pendingCatalogNotifications.length > 0 && active) {
        const current: ResolvedCatalog | undefined =
          pendingCatalogNotifications.shift();
        if (current === undefined || current !== currentCatalog) continue;
        const listenerSnapshot: ReadonlyArray<(catalog: ResolvedCatalog) => void> =
          [...listeners.values()];
        for (const listener of listenerSnapshot) {
          if (!active || current !== currentCatalog) break;
          try {
            listener(current);
          } catch {
            diagnose("catalog_listener_failed");
          }
        }
      }
    } finally {
      notifyingCatalog = false;
    }
  };

  const publish = (resolved: ResolvedCatalog): void => {
    const method: Transport["setCatalog"] = transport.setCatalog;
    Reflect.apply(method, transport, [resolved]);
  };

  const setContext = (context: StageContext): void => {
    if (!active) throw new Error(STOPPED_ERROR);
    const requested: number = ++generation;
    const resolved: ResolvedCatalog = concierge.resolveCatalog(context);
    if (!active || requested !== generation) return;

    if (currentCatalog?.revision === resolved.revision) {
      currentContext = context;
      return;
    }
    if (
      currentCatalog !== null &&
      capabilities.dynamicCatalog === false
    ) {
      void stop();
      throw new Error(FIXED_CATALOG_ERROR);
    }

    const priorEpoch: V2EpochSignal | null = currentEpoch;
    const epoch: V2EpochSignal = createEpochSignal();
    currentContext = context;
    currentCatalog = resolved;
    currentEpoch = epoch;
    priorEpoch?.abort();
    try {
      publish(resolved);
    } catch {
      if (requested !== generation || !active) return;
      void stop();
      diagnose("catalog_publish_failed");
      throw new Error(PUBLICATION_ERROR);
    }
    if (active && requested === generation) notifyCatalog(resolved);
  };

  const dispatchAcceptedBatch = async (
    batch: ToolBatch,
    context: StageContext,
    epoch: V2EpochSignal,
  ): Promise<BatchDispatchOutcome> => {
    let rawSignal: ToolBatch["signal"];
    try {
      rawSignal = batch.signal;
    } catch {
      rawSignal = undefined;
    }
    const linked = linkSignals(rawSignal, epoch.signal);
    const envelope = {} as ToolBatch;
    for (const key of [
      "sessionId",
      "responseId",
      "catalogRevision",
      "calls",
      "userTurnId",
      "deferUntilDelivered",
    ] as const) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(batch, key);
      } catch {
        descriptor = undefined;
      }
      if (descriptor !== undefined) {
        Object.defineProperty(envelope, key, descriptor);
      }
    }
    Object.defineProperty(envelope, "signal", {
      value: linked.signal,
      enumerable: true,
    });
    Object.freeze(envelope);
    try {
      let outcome: BatchDispatchOutcome;
      try {
        outcome = await concierge.dispatchBatch(context, envelope);
      } catch {
        diagnose("batch_dispatch_failed");
        throw new Error("The accepted batch could not be dispatched.");
      }
      if (outcome.kind === "terminal") void stop();
      const failure: FailureOutcome | null = failureOutcomeFor(outcome.rows);
      if (failure !== null) {
        let report: unknown;
        try {
          report = await presentOutcome(failure);
        } catch {
          diagnose("outcome_presentation_failed");
          throw new Error(
            "The batch outcome was withheld because presentation did not complete.",
          );
        }
        if (!outcomePresentationCompleted(report)) {
          diagnose("outcome_presentation_failed");
          throw new Error(
            "The batch outcome was withheld because presentation did not complete.",
          );
        }
      }
      return outcome;
    } finally {
      linked.dispose();
    }
  };

  const acceptBatch = (batch: ToolBatch): Promise<BatchDispatchOutcome> => {
    const context: StageContext | null = currentContext;
    const epoch: V2EpochSignal | null = currentEpoch;
    if (!active || context === null || epoch === null) {
      if (active) diagnose("batch_without_context");
      return Promise.resolve(Object.freeze({
        kind: "completed",
        rows: Object.freeze([]),
      }));
    }
    const acceptedBatch: ToolBatch = snapshotAcceptedBatch(batch);

    let resolve!: (outcome: BatchDispatchOutcome) => void;
    let reject!: (failure: unknown) => void;
    const result: Promise<BatchDispatchOutcome> =
      new Promise<BatchDispatchOutcome>((done, failed) => {
        resolve = done;
        reject = failed;
      });
    const prior: Promise<void> = workTail;
    const run = async (): Promise<void> => {
      await prior.catch(() => {});
      try {
        resolve(await dispatchAcceptedBatch(acceptedBatch, context, epoch));
      } catch (failure) {
        reject(failure);
      }
    };
    workTail = run();
    return result;
  };

  const handleStatus = (status: TransportStatus): void => {
    if (!active) return;
    const prior: TransportStatus = observedStatus;
    observedStatus = status;
    if (status === "connected" && prior !== "connected" && currentCatalog !== null) {
      try {
        publish(currentCatalog);
      } catch {
        diagnose("catalog_publish_failed");
        void stop();
      }
    }
  };

  const catalog = (): ResolvedCatalog | null => currentCatalog;
  const onCatalogChange = (
    callback: (catalog: ResolvedCatalog) => void,
  ): (() => void) => {
    if (!active) throw new Error(STOPPED_ERROR);
    if (typeof callback !== "function") {
      throw new TypeError("A catalog listener must be callable.");
    }
    const token: number = ++nextListenerToken;
    listeners.set(token, callback);
    return (): void => {
      if (listeners.get(token) === callback) listeners.delete(token);
    };
  };

  function stop(): Promise<void> {
    if (stopPromise !== null) return stopPromise;
    active = false;
    generation += 1;
    currentEpoch?.abort();
    currentEpoch = null;
    listeners.clear();
    pendingCatalogNotifications.length = 0;
    try {
      unsubscribeStatus?.();
    } catch {
      diagnose("transport_unsubscribe_failed");
    }
    try {
      unsubscribeBatch?.();
    } catch {
      diagnose("transport_unsubscribe_failed");
    }
    unsubscribeStatus = null;
    unsubscribeBatch = null;
    stopPromise = workTail.catch(() => {});
    return stopPromise;
  }

  try {
    observedStatus = transport.status;
    const removeStatus: unknown = transport.onStatusChange(handleStatus);
    if (typeof removeStatus !== "function") throw new Error(START_ERROR);
    unsubscribeStatus = removeStatus as () => void;
    const removeBatch: unknown = transport.onToolBatch(acceptBatch);
    if (typeof removeBatch !== "function") throw new Error(START_ERROR);
    unsubscribeBatch = removeBatch as () => void;
    if (config.initialContext !== undefined) setContext(config.initialContext);
  } catch {
    void stop();
    throw new Error(START_ERROR);
  }

  return Object.freeze({ setContext, catalog, onCatalogChange, stop });
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

  return createV2Session(
    config,
    concierge,
    transport,
    actualCapabilities,
    presentOutcome,
    onDiagnostic,
  );
}
