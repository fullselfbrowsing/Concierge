/**
 * Concierge construction, atomic catalog resolution, dispatch, workflow, and
 * lifecycle observation.
 *
 * All mutable registries are factory-local. Catalog snapshots reuse an
 * instance-local revision only while stage and dynamic availability are
 * identical. Stage matchers and availability predicates fail closed, and this
 * module remains framework- and DOM-independent for server evaluation.
 */

import { buildCatalog, deepFreeze } from "./catalog.js";
import { captureSnapshot } from "./bridge.js";
import {
  attachConsentProfile,
  consentGradeRank,
  snapshotConsentProfile,
} from "./consent-profile.js";
import {
  captureDigestCapability,
  digestReadback,
  prepareReadback,
  snapshotDeliveryEvidence,
  snapshotReadbackReceipt,
  verifyReadbackReceipt,
} from "./consent-evidence.js";
import {
  authoredResult,
  encodeInvocationValue,
  isAbortSignalLike,
  isAborted,
  normalizeActionResult,
  snapshotActionData,
  snapshotInvocationValue,
  validateArguments,
  waitForCommit,
} from "./dispatch.js";
import {
  encodeDiagnosticSubject,
  readHostScheduler,
  warnHost,
} from "./host.js";
import {
  DEFAULT_ACTION_DATA_MAX_BYTES,
  USER_CANCELLED,
  USER_DECLINED,
} from "./types.js";
import type { ArgumentValidation, CommitWaitOutcome } from "./dispatch.js";
import type { ActionDataSnapshot, InvocationValueSnapshot } from "./dispatch.js";
import type { Catalog, CatalogEntry } from "./catalog.js";
import type {
  DeliveryEvidenceSnapshot,
  PreparedReadback,
  PreparedReadbackResult,
  ReadbackReceiptSnapshotResult,
  VerifiedReadbackEvidence,
} from "./consent-evidence.js";
import type {
  ActionResult,
  ActionExplanation,
  AbortSignalLike,
  AnyActionDefinition,
  BatchDispatchOutcome,
  Bridge,
  BridgeRegistry,
  CatalogRevision,
  ChildActionRequest,
  Concierge,
  ConciergeConfig,
  ConsentAck,
  ConsentGrade,
  ConsentPolicy,
  ConsentProfile,
  DeliveryReport,
  DispatchEvent,
  DispatchLineage,
  DispatchListener,
  DispatchRef,
  DispatchRequest,
  DispatchRow,
  EmittedTool,
  Explanation,
  InvocationIdentity,
  InvocationMeta,
  ObservedInput,
  ObservedActionResult,
  ObservedResultData,
  ResolvedCatalog,
  Scheduler,
  StageContext,
  StageExplanation,
  ToolBatch,
  WorkflowControls,
} from "./types.js";

// ---------------------------------------------------------------------------
// Module scope — one private weak association and immutable constants
// ---------------------------------------------------------------------------

const EMPTY_DISPATCH_ROWS: ReadonlyArray<DispatchRow> = Object.freeze([]);
const MAX_V2_BATCH_CALLS = 10_000;

/**
 * The `skip` set `explain()` hands to `deepFreeze`. Empty, because the object
 * `explain` returns contains no validator instances — only stage ids,
 * booleans, bridge ids and action names, all of them developer-authored
 * strings that are already in the config.
 *
 * **This sits at module scope and constraint 1 above does not reach it**, and
 * the distinction is worth stating because the two cases look alike from a
 * diff. Constraint 1 forbids module-scope *mutable* state: a memo is written,
 * so one shared across every request a server process handles is a real defect.
 * This set is never written by anything, so one copy shared by every instance
 * in the process is not a compromise — it is what should happen.
 *
 * The purity annotation on the constructor follows 03-08's finding that an
 * unannotated module-scope call retains dead bytes in every consumer bundle
 * even where nothing reads the result. It widens nothing: it is a hint to the
 * bundler about a call with no observable effect, not a claim about behaviour.
 */
const NO_SKIP: ReadonlySet<object> = /* @__PURE__ */ new Set<object>();

const NEVER_ABORTED_SIGNAL: AbortSignalLike = /* @__PURE__ */ Object.freeze({
  aborted: false,
  addEventListener(): void {},
  removeEventListener(): void {},
});

const DROPPED_INPUT: ObservedInput = /* @__PURE__ */ Object.freeze({
  kind: "dropped" as const,
});
const ABSENT_RESULT_DATA: ObservedResultData = /* @__PURE__ */ Object.freeze({
  kind: "absent" as const,
});
const DROPPED_RESULT_DATA: ObservedResultData = /* @__PURE__ */ Object.freeze({
  kind: "dropped" as const,
});

interface DispatchExecutionState {
  terminalEntered: boolean;
  terminalRef?: DispatchRef | undefined;
  rootDispatchId?: string | undefined;
}

interface AtomicCatalogResolution {
  readonly index: number | null;
  readonly names: readonly string[];
  readonly resolved: ResolvedCatalog;
}

interface V2DedupeDescriptor {
  readonly revision: CatalogRevision;
  readonly name: string;
  readonly input: string;
  readonly outputIndex: number;
  readonly userTurnId: string;
}

interface GuardedValue {
  readonly ok: boolean;
  readonly value: unknown;
}

interface V2CallSnapshot {
  readonly valid: boolean;
  readonly callIdValid: boolean;
  readonly callId: string;
  readonly rawCallId: unknown;
  readonly callIdReadable: boolean;
  readonly nameValid: boolean;
  readonly name: string;
  readonly rawName: unknown;
  readonly nameReadable: boolean;
  readonly argumentsText: string | null;
  readonly rawArguments: unknown;
  readonly argumentsReadable: boolean;
  readonly outputIndexValid: boolean;
  readonly outputIndex: number;
  readonly rawOutputIndex: unknown;
  readonly outputIndexReadable: boolean;
  readonly source: object | null;
  readonly sortIndex: number | null;
  readonly originalIndex: number;
}

interface V2CallsSnapshot {
  readonly ok: boolean;
  readonly calls: ReadonlyArray<V2CallSnapshot>;
}

function guardedValue(read: () => unknown): GuardedValue {
  try {
    return { ok: true, value: read() };
  } catch {
    return { ok: false, value: undefined };
  }
}

function fallbackCallId(index: number): string {
  return `[concierge:unobservable-call-id:${index}]`;
}

function fallbackActionName(index: number): string {
  return `[concierge:unobservable-action-name:${index}]`;
}

function fallbackOutputIndex(index: number): number {
  return Number.MAX_SAFE_INTEGER - index;
}

/** Snapshot every observable batch occurrence without dropping malformed rows. */
function snapshotV2Calls(value: unknown): V2CallsSnapshot {
  let isArray: boolean;
  try {
    isArray = Array.isArray(value);
  } catch {
    return { ok: false, calls: Object.freeze([]) };
  }
  if (!isArray) return { ok: false, calls: Object.freeze([]) };

  const calls = value as ReadonlyArray<unknown>;
  const lengthRead: GuardedValue = guardedValue(() => calls.length);
  if (
    !lengthRead.ok ||
    typeof lengthRead.value !== "number" ||
    !Number.isSafeInteger(lengthRead.value) ||
    lengthRead.value < 0 ||
    lengthRead.value > MAX_V2_BATCH_CALLS
  ) {
    return { ok: false, calls: Object.freeze([]) };
  }

  const snapshots: V2CallSnapshot[] = [];
  for (let originalIndex = 0; originalIndex < lengthRead.value; originalIndex += 1) {
    const ownRead: GuardedValue = guardedValue(
      () => Object.prototype.hasOwnProperty.call(calls, originalIndex),
    );
    const rawRead: GuardedValue = ownRead.ok && ownRead.value === true
      ? guardedValue(() => calls[originalIndex])
      : { ok: false, value: undefined };
    const raw: unknown = rawRead.value;
    const objectLike: boolean =
      rawRead.ok && typeof raw === "object" && raw !== null;
    const record = objectLike ? raw as Record<string, unknown> : null;
    const callIdRead: GuardedValue = record === null
      ? { ok: false, value: undefined }
      : guardedValue(() => record["callId"]);
    const nameRead: GuardedValue = record === null
      ? { ok: false, value: undefined }
      : guardedValue(() => record["name"]);
    const argumentsRead: GuardedValue = record === null
      ? { ok: false, value: undefined }
      : guardedValue(() => record["arguments"]);
    const outputIndexRead: GuardedValue = record === null
      ? { ok: false, value: undefined }
      : guardedValue(() => record["outputIndex"]);

    const callIdValid: boolean = callIdRead.ok &&
      isSafeIdentifier(callIdRead.value);
    const nameValid: boolean = nameRead.ok && isSafeIdentifier(nameRead.value);
    const callId: string = callIdValid
      ? callIdRead.value as string
      : fallbackCallId(originalIndex);
    const name: string = nameValid
      ? nameRead.value as string
      : fallbackActionName(originalIndex);
    const validOutputIndex: boolean = outputIndexRead.ok &&
      typeof outputIndexRead.value === "number" &&
      Number.isSafeInteger(outputIndexRead.value) &&
      outputIndexRead.value >= 0;
    const outputIndex: number = validOutputIndex
      ? outputIndexRead.value as number
      : fallbackOutputIndex(originalIndex);
    const argumentsText: string | null =
      argumentsRead.ok && typeof argumentsRead.value === "string"
        ? argumentsRead.value
        : null;

    snapshots.push(Object.freeze({
      valid: objectLike &&
        callIdValid &&
        nameValid &&
        argumentsText !== null &&
        validOutputIndex,
      callIdValid,
      callId,
      rawCallId: callIdRead.value,
      callIdReadable: callIdRead.ok,
      nameValid,
      name,
      rawName: nameRead.value,
      nameReadable: nameRead.ok,
      argumentsText,
      rawArguments: argumentsRead.value,
      argumentsReadable: argumentsRead.ok,
      outputIndexValid: validOutputIndex,
      outputIndex,
      rawOutputIndex: outputIndexRead.value,
      outputIndexReadable: outputIndexRead.ok,
      source: record,
      sortIndex: validOutputIndex ? outputIndex : null,
      originalIndex,
    }));
  }

  snapshots.sort((left, right): number => {
    if (left.sortIndex === null) {
      return right.sortIndex === null
        ? left.originalIndex - right.originalIndex
        : 1;
    }
    if (right.sortIndex === null) return -1;
    return left.sortIndex === right.sortIndex
      ? left.originalIndex - right.originalIndex
      : left.sortIndex - right.sortIndex;
  });
  return { ok: true, calls: Object.freeze(snapshots) };
}

interface V2DedupeRecord {
  readonly descriptor: V2DedupeDescriptor;
  readonly promise: Promise<ActionResult>;
  pending: boolean;
  settledAt: number | null;
}

interface WorkflowRootState {
  readonly rootDispatchId: string;
  readonly signal: AbortSignalLike;
  readonly executionState: DispatchExecutionState;
  steps: number;
  failure: ActionResult | null;
  terminalResult: ActionResult | null;
  terminalRef: DispatchRef | null;
}

interface V2Occurrence {
  readonly context: StageContext;
  readonly dispatchId: string;
  readonly identity: Readonly<InvocationIdentity> | null;
  readonly lineage: DispatchLineage;
  readonly meta: InvocationMeta;
  readonly resolution: AtomicCatalogResolution;
  readonly root: WorkflowRootState;
}

interface QueuedDispatchEvent {
  readonly event: DispatchEvent;
  readonly listeners: ReadonlyArray<DispatchListener>;
}

interface WorkflowRuntime {
  readonly controls: WorkflowControls;
  readonly seal: () => void;
  readonly drain: () => Promise<void>;
  readonly unwind: () => Promise<void>;
}

interface PipelineObservation {
  accepted: boolean;
  input: ObservedInput;
}

type InvocationMetaSnapshot =
  | { readonly ok: true; readonly value: InvocationMeta }
  | { readonly ok: false };

type DispatchRequestSnapshot =
  | {
      readonly ok: true;
      readonly name: string;
      readonly input: unknown;
      readonly revision: CatalogRevision;
      readonly identity: Readonly<InvocationIdentity> | null;
      readonly meta: InvocationMeta;
    }
  | { readonly ok: false; readonly reason: "invalid_args" | "invalid_invocation" };

type DispatchEnvelopeSnapshot =
  | {
      readonly ok: true;
      readonly name: string;
      readonly rawInput: unknown;
      readonly inputReadable: boolean;
      readonly source: object;
      readonly revision: CatalogRevision;
      readonly identity: Readonly<InvocationIdentity> | null;
      readonly meta: InvocationMeta;
    }
  | { readonly ok: false };

interface CapturedConsentConfiguration {
  readonly profile: ConsentProfile;
  readonly presentReadback: ConciergeConfig["presentReadback"];
  readonly digest: ConciergeConfig["digest"];
  readonly normalizeSnapshot: ConciergeConfig["normalizeSnapshot"];
}

interface ConsentGenerationBase {
  readonly confirmationUserTurnId: string | null;
  readonly generation: bigint;
  readonly payload: unknown;
  readonly preparedReadback: PreparedReadback | null;
  readonly readbackHash: string | null;
  readonly responseId: string;
  readonly sessionId: string | null;
  readonly snapshot: Readonly<Record<string, unknown>>;
  readonly snapshotBridgeId: string;
  readonly snapshotBridgeRegistry: BridgeRegistry | undefined;
  readonly userTurnId: string;
  readonly verifiedReadback: VerifiedReadbackEvidence | null;
}

type ConsentGeneration =
  | (ConsentGenerationBase & { readonly status: "reviewing" })
  | (ConsentGenerationBase & { readonly status: "pendingDelivery" })
  | (ConsentGenerationBase & { readonly status: "verifyingDelivery" })
  | (ConsentGenerationBase & {
      readonly achievedGrade: Exclude<ConsentGrade, "none">;
      readonly status: "armed";
    })
  | (ConsentGenerationBase & {
      readonly status: "declined" | "dismissed" | "gradeUnavailable";
    });

/** A consent grade represents measured evidence only when it is not `none`. */
function isMeasuredConsentGrade(
  achievedGrade: ConsentGrade,
): achievedGrade is Exclude<ConsentGrade, "none"> {
  return achievedGrade !== "none";
}

/** Delivery can prove at most relayed evidence, clipped by the captured ceiling. */
function relayedGradeWithin(ceiling: ConsentGrade): ConsentGrade {
  return consentGradeRank(ceiling) >= consentGradeRank("relayed")
    ? "relayed"
    : ceiling;
}

/** Clamp every runtime policy to the inherent delivered evidence floor. */
function effectiveConsentMinimum(requested: ConsentGrade | undefined): ConsentGrade {
  const declared: ConsentGrade = requested ?? "delivered";
  return consentGradeRank(declared) < consentGradeRank("delivered")
    ? "delivered"
    : declared;
}

/** Whether confirm belongs to a real boundary after the stored review. */
function hasFreshConsentBoundary(
  policy: ConsentPolicy<unknown>,
  review: ConsentGenerationBase,
  confirm: InvocationMeta,
  profile: ConsentProfile,
): boolean {
  const confirmTurnId: string = confirm.userTurnId ?? "";
  if (
    review.confirmationUserTurnId !== null &&
    (profile.userTurnIdentity !== "human-attested" ||
      confirmTurnId !== review.confirmationUserTurnId)
  ) {
    return false;
  }

  if (policy.bindTo === "userTurn") {
    return profile.userTurnIdentity === "human-attested" &&
      review.userTurnId.length > 0 &&
      confirmTurnId.length > 0 &&
      review.userTurnId !== confirmTurnId;
  }

  if (policy.bindTo !== "response") {
    return false;
  }

  const confirmResponseId: string = confirm.responseId ?? "";
  return review.responseId.length > 0 &&
    confirmResponseId.length > 0 &&
    review.responseId !== confirmResponseId;
}

/**
 * Strict graph comparison for values produced by snapshot normalization.
 * Unsupported exotic leaves compare only by identity through the Object.is arm.
 */
function strictSnapshotEquality(left: unknown, right: unknown): boolean {
  return compareSnapshotValues(
    left,
    right,
    new WeakMap<object, object>(),
    new WeakMap<object, object>(),
  );
}

function compareSnapshotValues(
  left: unknown,
  right: unknown,
  leftToRight: WeakMap<object, object>,
  rightToLeft: WeakMap<object, object>,
): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return false;
  }

  if (leftToRight.has(left) || rightToLeft.has(right)) {
    return leftToRight.get(left) === right && rightToLeft.get(right) === left;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    leftToRight.set(left, right);
    rightToLeft.set(right, left);
    for (let index = 0; index < left.length; index += 1) {
      if ((index in left) !== (index in right)) {
        return false;
      }
      if (
        index in left &&
        !compareSnapshotValues(
          left[index],
          right[index],
          leftToRight,
          rightToLeft,
        )
      ) {
        return false;
      }
    }
    return true;
  }

  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date &&
      right instanceof Date &&
      Object.is(left.getTime(), right.getTime());
  }

  if (left instanceof Map || right instanceof Map) {
    if (!(left instanceof Map) || !(right instanceof Map) || left.size !== right.size) {
      return false;
    }
    leftToRight.set(left, right);
    rightToLeft.set(right, left);
    const rightEntries = right.entries();
    for (const [leftKey, leftValue] of left) {
      const rightEntry = rightEntries.next();
      if (
        rightEntry.done ||
        !compareSnapshotValues(
          leftKey,
          rightEntry.value[0],
          leftToRight,
          rightToLeft,
        ) ||
        !compareSnapshotValues(
          leftValue,
          rightEntry.value[1],
          leftToRight,
          rightToLeft,
        )
      ) {
        return false;
      }
    }
    return rightEntries.next().done === true;
  }

  if (left instanceof Set || right instanceof Set) {
    if (!(left instanceof Set) || !(right instanceof Set) || left.size !== right.size) {
      return false;
    }
    leftToRight.set(left, right);
    rightToLeft.set(right, left);
    const rightValues = right.values();
    for (const leftValue of left) {
      const rightValue = rightValues.next();
      if (
        rightValue.done ||
        !compareSnapshotValues(
          leftValue,
          rightValue.value,
          leftToRight,
          rightToLeft,
        )
      ) {
        return false;
      }
    }
    return rightValues.next().done === true;
  }

  const leftPrototype: object | null = Object.getPrototypeOf(left);
  const rightPrototype: object | null = Object.getPrototypeOf(right);
  const leftIsRecord: boolean =
    leftPrototype === null || leftPrototype === Object.prototype;
  const rightIsRecord: boolean =
    rightPrototype === null || rightPrototype === Object.prototype;
  if (!leftIsRecord || !rightIsRecord || leftPrototype !== rightPrototype) {
    return false;
  }

  const leftKeys: readonly string[] = Object.keys(left);
  const rightKeys: readonly string[] = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  leftToRight.set(left, right);
  rightToLeft.set(right, left);
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  for (const key of leftKeys) {
    if (
      !Object.hasOwn(rightRecord, key) ||
      !compareSnapshotValues(
        leftRecord[key],
        rightRecord[key],
        leftToRight,
        rightToLeft,
      )
    ) {
      return false;
    }
  }
  return true;
}

/** Read every consent-related config seam once at the factory boundary. */
function captureConsentConfiguration(
  config: ConciergeConfig,
): CapturedConsentConfiguration {
  let rawProfile: unknown;
  try {
    rawProfile = config.consentProfile;
  } catch {
    rawProfile = null;
  }

  const profile: ConsentProfile = snapshotConsentProfile(rawProfile);
  try {
    const presentReadback: ConciergeConfig["presentReadback"] =
      config.presentReadback;
    const digest: ConciergeConfig["digest"] = captureDigestCapability(
      config.digest,
    );
    const normalizeSnapshot: ConciergeConfig["normalizeSnapshot"] =
      config.normalizeSnapshot;
    return Object.freeze({
      profile,
      presentReadback,
      digest,
      normalizeSnapshot,
    });
  } catch {
    throw new TypeError(
      "Invalid Concierge configuration: consent evidence capabilities could not be read.",
    );
  }
}

/** Copy every public metadata field once, before any asynchronous work begins. */
function snapshotInvocationMeta(
  meta: InvocationMeta | undefined,
): InvocationMetaSnapshot {
  if (meta === undefined) {
    return { ok: true, value: Object.freeze({}) };
  }
  if (typeof meta !== "object" || meta === null) {
    return { ok: false };
  }

  try {
    const responseId: unknown = meta.responseId;
    const userTurnId: unknown = meta.userTurnId;
    const callId: unknown = meta.callId;
    const outputIndex: unknown = meta.outputIndex;
    const signal: InvocationMeta["signal"] = meta.signal;
    const deferUntilDelivered: InvocationMeta["deferUntilDelivered"] =
      meta.deferUntilDelivered;

    if (
      (responseId !== undefined && typeof responseId !== "string") ||
      (userTurnId !== undefined && typeof userTurnId !== "string") ||
      (callId !== undefined && typeof callId !== "string") ||
      (outputIndex !== undefined &&
        (typeof outputIndex !== "number" || !Number.isFinite(outputIndex))) ||
      (signal !== undefined && !isAbortSignalLike(signal)) ||
      (deferUntilDelivered !== undefined &&
        typeof deferUntilDelivered !== "function")
    ) {
      return { ok: false };
    }

    return {
      ok: true,
      value: Object.freeze({
        responseId,
        userTurnId,
        callId,
        outputIndex,
        signal,
        deferUntilDelivered,
      }),
    };
  } catch {
    return { ok: false };
  }
}

function isSafeIdentifier(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 1024) {
    return false;
  }
  for (let index: number = 0; index < value.length; index += 1) {
    const code: number = value.charCodeAt(index);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return false;
  }
  return true;
}

/** Snapshot identity and control metadata before reading untrusted input data. */
function snapshotDispatchEnvelope(request: unknown): DispatchEnvelopeSnapshot {
  if (typeof request !== "object" || request === null) {
    return { ok: false };
  }

  const source = request as Record<string, unknown>;
  const nameRead: GuardedValue = guardedValue(() => source["name"]);
  const revisionRead: GuardedValue = guardedValue(
    () => source["catalogRevision"],
  );
  const identityRead: GuardedValue = guardedValue(() => source["identity"]);
  const signalRead: GuardedValue = guardedValue(() => source["signal"]);
  const deliveryRead: GuardedValue = guardedValue(
    () => source["deferUntilDelivered"],
  );
  const inputRead: GuardedValue = guardedValue(() => source["input"]);
  const name: unknown = nameRead.value;
  const revision: unknown = revisionRead.value;
  const identityValue: unknown = identityRead.value;
  const signal: unknown = signalRead.value;
  const deferUntilDelivered: unknown = deliveryRead.value;

  if (
    !nameRead.ok ||
    !revisionRead.ok ||
    !identityRead.ok ||
    !signalRead.ok ||
    !deliveryRead.ok ||
    !isSafeIdentifier(name) ||
    typeof revision !== "symbol" ||
    (signal !== undefined && !isAbortSignalLike(signal)) ||
    (deferUntilDelivered !== undefined &&
      typeof deferUntilDelivered !== "function")
  ) {
    return { ok: false };
  }

  let identity: Readonly<InvocationIdentity> | null = null;
  if (identityValue !== undefined) {
    if (typeof identityValue !== "object" || identityValue === null) {
      return { ok: false };
    }
    const raw = identityValue as Record<string, unknown>;
    const sessionIdRead: GuardedValue = guardedValue(() => raw["sessionId"]);
    const responseIdRead: GuardedValue = guardedValue(() => raw["responseId"]);
    const callIdRead: GuardedValue = guardedValue(() => raw["callId"]);
    const userTurnIdRead: GuardedValue = guardedValue(() => raw["userTurnId"]);
    const outputIndexRead: GuardedValue = guardedValue(() => raw["outputIndex"]);
    const sessionId: unknown = sessionIdRead.value;
    const responseId: unknown = responseIdRead.value;
    const callId: unknown = callIdRead.value;
    const userTurnId: unknown = userTurnIdRead.value;
    const outputIndex: unknown = outputIndexRead.value;
    if (
      !sessionIdRead.ok ||
      !responseIdRead.ok ||
      !callIdRead.ok ||
      !userTurnIdRead.ok ||
      !outputIndexRead.ok ||
      !isSafeIdentifier(sessionId) ||
      !isSafeIdentifier(responseId) ||
      !isSafeIdentifier(callId) ||
      !isSafeIdentifier(userTurnId) ||
      typeof outputIndex !== "number" ||
      !Number.isSafeInteger(outputIndex) ||
      outputIndex < 0
    ) {
      return { ok: false };
    }
    identity = Object.freeze({
      sessionId,
      responseId,
      callId,
      userTurnId,
      outputIndex,
    });
  }

  const meta: InvocationMeta = Object.freeze({
    responseId: identity?.responseId,
    userTurnId: identity?.userTurnId,
    callId: identity?.callId,
    outputIndex: identity?.outputIndex,
    signal: signal as AbortSignalLike | undefined,
    deferUntilDelivered:
      deferUntilDelivered as InvocationMeta["deferUntilDelivered"],
  });

  return {
    ok: true,
    name,
    rawInput: inputRead.value,
    inputReadable: inputRead.ok,
    source: request,
    revision: revision as CatalogRevision,
    identity,
    meta,
  };
}

/** Detach and validate input after identity and control metadata are stable. */
function snapshotDispatchEnvelopeInput(
  envelope: Extract<DispatchEnvelopeSnapshot, { readonly ok: true }>,
): DispatchRequestSnapshot {
  if (!envelope.inputReadable) {
    return { ok: false, reason: "invalid_args" };
  }
  const detached: InvocationValueSnapshot = snapshotInvocationValue(
    envelope.rawInput,
  );
  if (!detached.ok || encodeInvocationValue(detached.value) === null) {
    return { ok: false, reason: "invalid_args" };
  }
  return {
    ok: true,
    name: envelope.name,
    input: detached.value,
    revision: envelope.revision,
    identity: envelope.identity,
    meta: envelope.meta,
  };
}

/** Snapshot the complete dispatch request before asynchronous work begins. */
function snapshotDispatchRequest(request: unknown): DispatchRequestSnapshot {
  const envelope: DispatchEnvelopeSnapshot = snapshotDispatchEnvelope(request);
  return envelope.ok
    ? snapshotDispatchEnvelopeInput(envelope)
    : { ok: false, reason: "invalid_invocation" };
}

/** Convert a consent declaration and its authored fallback into fixed data. */
function snapshotConsentPolicy(
  policy: NonNullable<AnyActionDefinition["consent"]>,
): NonNullable<AnyActionDefinition["consent"]> {
  const snapshotEquality = policy.snapshotEquality;
  const minGrade: ConsentGrade | undefined = policy.minGrade;
  const declaredMissing = policy.onMissing;
  const onMissing = declaredMissing === undefined
    ? undefined
    : Object.freeze(
        declaredMissing.reason === undefined
          ? { message: declaredMissing.message }
          : {
              message: declaredMissing.message,
              reason: declaredMissing.reason,
            },
      );

  return Object.freeze({
    requires: policy.requires,
    bindTo: policy.bindTo,
    ...(snapshotEquality === undefined ? {} : { snapshotEquality }),
    ...(minGrade === undefined ? {} : { minGrade }),
    ...(onMissing === undefined ? {} : { onMissing }),
  });
}

/** Convert mutable effect hints and action accessors into fixed data properties. */
function snapshotAction(action: AnyActionDefinition): AnyActionDefinition {
  try {
    let snapshot: AnyActionDefinition = { ...action };
    if (snapshot.effects !== undefined) {
      snapshot = {
        ...snapshot,
        effects: Object.freeze({
          readOnly: snapshot.effects.readOnly === true,
          destructive: snapshot.effects.destructive === true,
          idempotent: snapshot.effects.idempotent === true,
        }),
      };
    }
    if (snapshot.consent !== undefined) {
      snapshot = {
        ...snapshot,
        consent: snapshotConsentPolicy(snapshot.consent),
      };
    }
    if (snapshot.output !== undefined) {
      snapshot = {
        ...snapshot,
        output: Object.freeze({
          schema: snapshot.output.schema,
          redact: snapshot.output.redact,
        }),
      };
    }
    return snapshot;
  } catch {
    throw new TypeError(
      "Invalid Concierge configuration: an action's effects could not be read.",
    );
  }
}

/** Reject timer values whose host coercion would silently change gate semantics. */
function validateWindowMs(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(
      `Invalid Concierge configuration: ${field} must be a finite, non-negative number.`,
    );
  }
  return value;
}

function validateWorkflowLimit(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(
      `Invalid Concierge configuration: ${field} must be a positive safe integer.`,
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Module-private helpers
// ---------------------------------------------------------------------------

/**
 * The warning two stages sharing one id earn, in the house message shape —
 * a `concierge: ` prefix, the code, the quoted subject, the problem, then
 * `Fix: `, exactly as `catalog.ts`'s diagnostics are rendered with the stage id
 * substituted for the action name.
 *
 * **Behind a named function rather than written inline**, so the call site is
 * one short statement a mutation battery can target as a single literal.
 * `warnHost` is reached from two places in this file, and the other one takes a
 * composed template string, so an inline message here would leave neither call
 * site distinctly greppable.
 *
 * **What the warning claims, and what it deliberately does not.** It does not
 * say the catalog is wrong, because it is not: the per-stage catalog is keyed
 * by declaration order, so two stages sharing an id still serve their own
 * actions — measured, on three stages sharing one id, each of which returned
 * exactly its own action list. What *is* genuinely ambiguous is the reporting:
 * resolved catalogs and `explain()` both return the id, so two rows a developer
 * reads are indistinguishable. Claiming more would be a false
 * alarm about scoping; claiming less would leave a real ambiguity unreported.
 *
 * **The scan behind it keeps TWO sets, not one.** `seenStageIds` answers "have
 * I met this id before"; `reportedStageIds` answers "have I already warned
 * about it". With a single set, a third stage sharing the id produces a second
 * warning naming the same id and a fourth produces a third. Two sets are the
 * construction-time analogue of the matcher warn-once latch below, and they
 * hold the granularity `CatalogDiagnostic`'s doc comment settles: one report
 * per offending subject, each naming its subject, never an aggregated summary
 * line that loses the name.
 *
 * Both sets are local to `createConcierge` and are discarded when it returns.
 * They are not instance state, so constraint 1 in this file's header has
 * nothing to say about them.
 */
function duplicateStageIdMessage(id: string): string {
  return (
    `concierge: [duplicate_stage_id] stage ${encodeDiagnosticSubject(id)}: two stages declare this id, and ` +
    `resolved catalogs and \`explain()\` both report it, so the two are ` +
    `indistinguishable to a developer reading any of them. Catalog scoping is unaffected — ` +
    `the per-stage catalog is keyed by declaration order, not by id. ` +
    `Fix: give each stage a distinct id.`
  );
}

/**
 * The ONE place a stage becomes a bridge — the same rule header constraint 3
 * states for `stage.match`, applied to the other consumer-supplied seam a stage
 * carries.
 *
 * `bridgeStatus` and the dispatcher share this seam, and there must not be a
 * second resolution path: the throw policy below and the not-declared
 * policy below it are each written once here, so `explain` and a dispatcher
 * cannot drift into two readers that disagree about the same stage. A second
 * resolution path is not a duplicate function, it is a second answer to "is this
 * bridge mounted" — and the two would be consulted by different callers.
 *
 * **A stage that declares no bridge resolves to `null` without error and without
 * auto-failing anything (DX-02).** Declaring no bridge is a supported
 * configuration rather than a defect: an action that reads router or DOM state
 * must run with nothing registered at all. Core therefore never auto-fails an
 * action because a stage's declared bridge is unmounted, and it certainly does
 * not fail one for a stage that declares nothing. The handler receives `null`
 * and decides.
 *
 * **`read()` is consumer code, so it is guarded exactly as `match` is** — the
 * `catch` takes no binding, so there is no caught value in scope to interpolate
 * and the property is structural rather than a matter of remembering not to
 * echo one. A throwing `read()` is not a registration; it degrades to "not
 * mounted" rather than taking down the one call a developer makes when they are
 * already confused.
 *
 * **The `?? null` coalesce is a decision, not a tidying.** `BridgeRegistry.read`
 * is typed `() => B | null`, but the interface is implemented by consumers, and
 * a JavaScript consumer whose `read()` falls off the end returns `undefined`.
 * That case is exactly why `bridgeStatus` tested both `null` and `undefined`
 * before this seam existed; the arm does not disappear, it MOVES here. Two
 * consequences, and both are why it is written rather than left implicit: the
 * observable is unchanged — such a registry still reports `registered: false` —
 * and the handler contract `ctx.bridge: B | null` becomes structurally true at
 * the one point that produces the value, rather than merely annotated at the
 * point that consumes it.
 *
 * **This deliberately collapses "not declared" and "declared but unmounted" into
 * the same `null`,** because a handler has the same thing to do about both. The
 * distinction is a *reporting* concern, not a resolution one, which is why
 * `bridgeStatus` keeps its own `stage.bridge === undefined` early return ahead of
 * the call rather than reconstructing the distinction from this return value.
 *
 * The parameter preserves the erased heterogeneous bridge collection from
 * `ConciergeConfig.stages`. Because that collection is erased,
 * `registry.read()` yields `any`; the
 * explicit `Bridge | null` return annotation is what stops the erasure
 * propagating to every caller.
 */
function resolveBridge(stage: ConciergeConfig["stages"][number]): Bridge | null {
  const registry: ConciergeConfig["stages"][number]["bridge"] = stage.bridge;
  if (registry === undefined) {
    return null;
  }

  try {
    return registry.read() ?? null;
  } catch {
    return null;
  }
}

/** Select an action-local registry before the owning stage fallback. */
function effectiveBridgeRegistry(
  action: AnyActionDefinition,
  stage: ConciergeConfig["stages"][number] | undefined,
): BridgeRegistry | undefined {
  return action.bridge ?? stage?.bridge;
}

/** Read one already-selected registry, containing consumer failures as null. */
function resolveBridgeRegistry(
  registry: BridgeRegistry | undefined,
): Bridge | null {
  if (registry === undefined) return null;
  try {
    return registry.read() ?? null;
  } catch {
    return null;
  }
}

function actionBridgeStatus(
  action: AnyActionDefinition,
  stage: ConciergeConfig["stages"][number] | undefined,
): ActionExplanation["bridge"] {
  const registry: BridgeRegistry | undefined =
    effectiveBridgeRegistry(action, stage);
  if (registry === undefined) return null;
  let registered: boolean = false;
  try {
    registered = registry.read() != null;
  } catch {
    registered = false;
  }
  return { id: registry.id, registered };
}

/**
 * Everything `explain` can honestly say about one stage's bridge.
 *
 * Three states, and the distinction between the last two is the entire reason
 * this is not a boolean:
 *
 * - `null` — the stage declares no `bridge` at all. Honest, and DX-02's
 *   supported configuration rather than a defect.
 * - `{id, registered: false}` — a registry is declared and its `read()`
 *   returned nothing, so no component is mounted. Once bridges exist this is
 *   the single most common cause of "my action didn't fire", and it is
 *   invisible in every other channel this package has.
 * - `{id, registered: true}` — `read()` returned a bridge.
 *
 * `id` and `read()` come directly from the structural `BridgeRegistry`
 * interface, so built-in and application-owned registries report identically.
 *
 * **`read()` is consumer code, so it is guarded the same way `match` is.** A
 * throwing `read()` is not a registration, and it is not a reason to take down
 * the one call a developer makes when they are already confused.
 *
 * **Rejected: warning on a throwing `read()`.** Unlike a throwing matcher —
 * which fires on every navigation, in a shipped app, where nobody is
 * watching — this runs only inside `explain`, a human-debugging-rate call. A
 * warning there prints during the very activity it would interrupt, and the
 * structured `registered: false` row is already in front of the person who
 * asked for it.
 *
 * The parameter reuses `ConciergeConfig`'s heterogeneous stage element type
 * instead of introducing another bridge erasure here.
 */
function bridgeStatus(
  stage: ConciergeConfig["stages"][number],
): StageExplanation["bridge"] {
  const registry: ConciergeConfig["stages"][number]["bridge"] = stage.bridge;
  // **This early return stays HERE, ahead of the seam, and is not a redundant
  // repeat of the one inside it.** `resolveBridge` collapses "declares no
  // bridge" and "declares one that is unmounted" into the same `null`, which is
  // right for a handler and wrong for a report. Reading the row off that return
  // value alone would turn a stage with no bridge from `null` into
  // `{id, registered: false}` — and there is no `id` to put there. The
  // three-state shape is pinned by `types.ts` and by
  // `test-d/concierge.test-d.ts`'s `_stageExplanationBridgeShape`; do not
  // "simplify" this away.
  if (registry === undefined) {
    return null;
  }

  const live: Bridge | null = resolveBridge(stage);

  return { id: registry.id, registered: live !== null };
}

// ---------------------------------------------------------------------------
// The factory
// ---------------------------------------------------------------------------

/**
 * Build one framework-neutral Concierge from all stage and cross-stage action
 * declarations.
 *
 * Declarations and policy capabilities are captured at construction. One flat
 * validated catalog backs every atomic stage/availability projection, so
 * duplicate names and consent targets are checked across the whole app.
 */
export function createConcierge(config: ConciergeConfig): Concierge {
  const capturedConsent: CapturedConsentConfiguration =
    captureConsentConfiguration(config);
  const stages: ConciergeConfig["stages"] = config.stages.map(
    (stage): ConciergeConfig["stages"][number] => {
      const actions: ConciergeConfig["stages"][number]["actions"] =
        Object.freeze(stage.actions.map(snapshotAction));
      return Object.freeze(
        stage.bridge === undefined
          ? { id: stage.id, match: stage.match, actions }
          : { id: stage.id, match: stage.match, actions, bridge: stage.bridge },
      );
    },
  );
  const crossStage: NonNullable<ConciergeConfig["crossStage"]> = Object.freeze([
    ...(config.crossStage ?? []).map(snapshotAction),
  ]);
  const configuredScheduler: Scheduler | undefined = config.scheduler;
  const commitWindowMs: number = validateWindowMs(
    config.commitWindowMs ?? 600,
    "commitWindowMs",
  );
  const dedupeWindowMs: number = validateWindowMs(
    config.dedupeWindowMs ?? 600,
    "dedupeWindowMs",
  );
  const maxActionDataBytes: number = validateWorkflowLimit(
    config.maxActionDataBytes ?? DEFAULT_ACTION_DATA_MAX_BYTES,
    "maxActionDataBytes",
  );
  const maxWorkflowDepth: number = validateWorkflowLimit(
    config.maxWorkflowDepth ?? 16,
    "maxWorkflowDepth",
  );
  const maxWorkflowSteps: number = validateWorkflowLimit(
    config.maxWorkflowSteps ?? 256,
    "maxWorkflowSteps",
  );

  // ONE flat build over every stage's actions followed by the cross-stage
  // actions — not one build per stage, and the choice is a requirement rather
  // than a convenience.
  //
  // CAT-03 needs the COMPLETE declared-name set to decide whether a consent
  // policy's target exists, and a legitimate flow points a review action on one
  // stage at a confirm action on another. A per-stage build cannot see across
  // that boundary and would reject every cross-stage consent target. A single
  // build also produces a single aggregated `CatalogValidationError`, so a
  // developer with problems in three stages fixes three problems in one cycle
  // rather than three.
  //
  // Everything below is a PROJECTION of this one catalog. No second catalog is
  // ever built, which is what makes it structurally impossible for a per-stage
  // view to disagree with the whole.
  //
  // A duplicate action name across two stages is therefore rejected GLOBALLY,
  // with no new code — measured: `buildCatalog`'s existing
  // `duplicate_action_name` fires on an action declared in two different
  // stages, exactly as it does within one. That is the intended outcome. An
  // action name is the agent's vocabulary, and two behaviours under one name is
  // the ambiguity the design exists to prevent.
  const catalog: Catalog = buildCatalog(
    [...stages.flatMap((stage) => stage.actions), ...crossStage],
    {
      consentProfile: capturedConsent.profile,
      presentReadback: capturedConsent.presentReadback,
      digest: capturedConsent.digest,
    },
  );
  const reviewNames: ReadonlySet<string> = new Set(
    catalog.entries.flatMap((entry) =>
      entry.action.consent === undefined
        ? []
        : [entry.action.consent.requires],
    ),
  );
  const attestedReviewNames: ReadonlySet<string> = new Set(
    catalog.entries.flatMap((entry) =>
      entry.action.consent !== undefined &&
      effectiveConsentMinimum(entry.action.consent.minGrade) === "attested"
        ? [entry.action.consent.requires]
        : [],
    ),
  );

  // One `EmittedTool` per action, built ONCE here and shared by reference into
  // every stage array that contains it. Header constraint 2 is what this
  // implements; the two halves are coupled and neither is safe alone.
  //
  // **`parameters` is assigned BY REFERENCE and is never re-emitted.**
  // `buildCatalog` already emitted it, validated it as a root-object schema and
  // deep-froze it. Re-emitting here would run a vendor converter a second time,
  // produce a different object, destroy element identity across stage arrays,
  // and hand back a subtree nothing has frozen. The null-prototype-plus-freeze
  // pair on the lookup is `Catalog.byName`'s argument applied one level out —
  // read it there rather than restating it here; measured on this record,
  // `tools['__proto__']` and `tools['constructor']` are ordinary absent keys
  // and every write throws.
  //
  // The assembly seal appears THREE times in this file, each spelled as its own
  // single-occurrence statement: the tool, this lookup, and the projection
  // below. That is not stylistic. Each is a distinct target for the mutation
  // battery that proves the corresponding test actually fires, and folding any
  // two of them into one shared helper — or inlining one into a larger
  // expression — collapses two independent proofs into one. Three is the
  // measured number; if a later change makes it different, this sentence must
  // move with it.
  const toolByName: Record<string, EmittedTool> = Object.create(null);
  for (const entry of catalog.entries) {
    const tool: EmittedTool = {
      type: "function",
      name: entry.action.name,
      description: entry.action.description,
      parameters: entry.parameters,
    };
    toolByName[entry.action.name] = Object.freeze(tool);
  }
  Object.freeze(toolByName);

  const crossNames: readonly string[] = crossStage.map((action) => action.name);

  // **`namesByStage` is INDEXED, parallel to `stages`, and is never keyed by
  // the stage id.** This is a correction to an earlier design, annotated in
  // place rather than silently applied.
  //
  // The id-keyed form was measured to COLLAPSE. Two stages sharing an id build
  // cleanly, the lookup resolves to whichever was declared last, and the agent
  // standing on stage A is offered stage B's actions:
  //
  //     buildCatalog is happy:                    [ 'a', 'b' ]
  //     id-keyed projection silently collapses:   {"results":["b"]}
  //     resolved stage is: results    ->  projection would be [ 'b' ]
  //
  // Nothing already in the codebase can see it. `buildCatalog` receives a flat
  // action array and has no concept of a stage; `duplicate_action_name` does
  // not fire because the action *names* differ. It is a direct STG-01 failure
  // reached entirely through legal, type-correct configuration.
  //
  // Keying by declaration index makes the collapse impossible at zero new
  // surface cost. What it does NOT widen: the id is still what resolved
  // catalogs and `explain()` report, so the ambiguity remains visible
  // to a human — which is why the scan below still warns. Both halves are
  // required; either alone leaves a defect.
  //
  // Two remedies were rejected. **Throwing** needs a `CatalogIssue` whose
  // `action` field holds a stage id, which corrupts the `issues.map(i =>
  // i.action)` semantics DX-03 depends on — a consumer reading that array would
  // get a stage id where every other element is an action name. **Warn-only**
  // keeps the id-keyed lookup and therefore leaves a real correctness bug in
  // place, reported.
  const namesByStage: ReadonlyArray<readonly string[]> = stages.map((stage) => [...stage.actions.map((action) => action.name), ...crossNames]);

  const seenStageIds: Set<string> = new Set<string>();
  const reportedStageIds: Set<string> = new Set<string>();
  for (const stage of stages) {
    if (seenStageIds.has(stage.id) && !reportedStageIds.has(stage.id)) {
      reportedStageIds.add(stage.id);
      warnHost(duplicateStageIdMessage(stage.id));
    }
    seenStageIds.add(stage.id);
  }

  // All mutable runtime state is instance-local so server requests cannot
  // share catalog capabilities, retry records, listeners, or consent state.
  let resolvedMemo: Map<string, ResolvedCatalog> | null = null;
  let v2Dispatches: Map<string, V2DedupeRecord> | null = null;
  let dispatchListeners: Map<number, DispatchListener> | null = null;
  let nextDispatchListenerId: number = 0;
  let nextDispatchId: bigint = 0n;
  let nextInvalidInputId: bigint = 0n;
  const invalidInputIds: WeakMap<object, bigint> = new WeakMap<object, bigint>();
  const invalidSymbolIds: Map<symbol, bigint> = new Map<symbol, bigint>();
  const dispatchEventQueue: QueuedDispatchEvent[] = [];
  let dispatchEventScheduled: boolean = false;
  let warnedStages: Set<string> | null = null;
  let dispatchExecutionStates:
    | WeakMap<Promise<ActionResult>, DispatchExecutionState>
    | null = null;
  let warnedDispatch: Set<string> | null = null;
  let consentGenerations: Map<string, ConsentGeneration> | null = null;
  let nextConsentGeneration: bigint = 0n;

  /** Address review authority by both its session namespace and action name. */
  function consentSlotKey(
    sessionId: string | null,
    reviewName: string,
  ): string {
    return JSON.stringify([sessionId, reviewName]);
  }

  /** Delete a generation only while the caller still owns its review slot. */
  function closeConsentGeneration(slotKey: string, generation: bigint): void {
    const current: ConsentGeneration | undefined =
      consentGenerations?.get(slotKey);
    if (current?.generation === generation) {
      consentGenerations?.delete(slotKey);
    }
  }

  /** Return the policy-authored closed result, or core's fixed default. */
  function missingConsentResult(policy: ConsentPolicy<unknown>): ActionResult {
    const declared: ConsentPolicy<unknown>["onMissing"] = policy.onMissing;
    return declared === undefined
      ? authoredResult(
          false,
          "Review this action before confirming it.",
          "consent_required",
        )
      : authoredResult(false, declared.message, declared.reason);
  }

  /** Detach one already-resolved bridge without reading its registry again. */
  function captureResolvedSnapshot(
    bridgeId: string,
    bridge: Bridge | null,
  ): Readonly<Record<string, unknown>> {
    return Object.freeze(
      captureSnapshot(
        bridge as Bridge,
        bridgeId,
        capturedConsent.normalizeSnapshot,
      ),
    );
  }

  /** Arm one owned pending generation from snapshotted delivery evidence. */
  async function observeReviewDelivery(
    slotKey: string,
    pending: ConsentGenerationBase & { readonly status: "pendingDelivery" },
    report: DeliveryReport,
  ): Promise<void> {
    const current: ConsentGeneration | undefined =
      consentGenerations?.get(slotKey);
    if (
      current?.generation !== pending.generation ||
      current.status !== "pendingDelivery" ||
      current.responseId !== pending.responseId
    ) {
      return;
    }

    const claimed = Object.freeze({
      ...pending,
      status: "verifyingDelivery" as const,
    });
    consentGenerations?.set(slotKey, claimed);

    const deliverySnapshot = snapshotDeliveryEvidence(report);
    if (!deliverySnapshot.ok) {
      closeConsentGeneration(slotKey, pending.generation);
      return;
    }
    const delivery: DeliveryEvidenceSnapshot = deliverySnapshot.value;

    if (
      delivery.responseId !== pending.responseId ||
      delivery.outcome !== "completed"
    ) {
      closeConsentGeneration(slotKey, pending.generation);
      return;
    }

    const observedAct: unknown = delivery.attestation?.act;
    if (observedAct === "declined" || observedAct === "dismissed") {
      consentGenerations?.set(
        slotKey,
        Object.freeze({ ...claimed, status: observedAct }),
      );
      return;
    }

    let achievedGrade: ConsentGrade = relayedGradeWithin(
      capturedConsent.profile.consentGrade,
    );
    let confirmationUserTurnId: string | null = null;
    let readbackHash: string | null = null;
    const attestation = delivery.attestation;
    const verified: VerifiedReadbackEvidence | null = claimed.verifiedReadback;
    const hasAttestedClaim: boolean =
      delivery.readbackHash !== undefined || attestation !== undefined;
    const completeAttestedClaim: boolean =
      verified !== null &&
      consentGradeRank(capturedConsent.profile.consentGrade) >=
        consentGradeRank("attested") &&
      capturedConsent.profile.userTurnIdentity === "human-attested" &&
      observedAct === "confirmed" &&
      typeof delivery.readbackHash === "string" &&
      delivery.readbackHash === verified.hash &&
      attestation !== undefined &&
      attestation.readbackHash === verified.hash &&
      typeof attestation.userTurnId === "string" &&
      attestation.userTurnId.length > 0 &&
      attestation.userTurnId !== claimed.userTurnId;
    if (hasAttestedClaim && !completeAttestedClaim) {
      closeConsentGeneration(slotKey, claimed.generation);
      return;
    }
    if (completeAttestedClaim) {
      if (
        verified === null ||
        attestation === undefined ||
        typeof attestation.userTurnId !== "string"
      ) {
        closeConsentGeneration(slotKey, claimed.generation);
        return;
      }
      const freshHash: string | null = await digestReadback(
        capturedConsent.digest,
        verified.canonical,
      );
      const stillOwned: ConsentGeneration | undefined =
        consentGenerations?.get(slotKey);
      if (
        stillOwned?.generation !== claimed.generation ||
        stillOwned.status !== "verifyingDelivery" ||
        stillOwned.responseId !== claimed.responseId
      ) {
        return;
      }
      if (freshHash !== verified.hash) {
        closeConsentGeneration(slotKey, claimed.generation);
        return;
      }
      achievedGrade = "attested";
      confirmationUserTurnId = attestation.userTurnId;
      readbackHash = verified.hash;
    }

    if (!isMeasuredConsentGrade(achievedGrade)) {
      consentGenerations?.set(
        slotKey,
        Object.freeze({ ...claimed, status: "gradeUnavailable" }),
      );
      return;
    }

    consentGenerations?.set(
      slotKey,
      Object.freeze({
        ...claimed,
        achievedGrade,
        confirmationUserTurnId,
        readbackHash,
        status: "armed",
      }),
    );
  }

  /** Report one runtime dispatch problem per subject and Concierge instance. */
  function warnDispatchOnce(key: string, message: string): void {
    warnedDispatch ??= new Set<string>();
    if (warnedDispatch.has(key)) {
      return;
    }
    warnedDispatch.add(key);
    try {
      warnHost(message);
    } catch {
      // A host diagnostic is a convenience channel, never dispatch control flow.
    }
  }

  /**
   * Latch a stage id, warn about it once, and report "did not match".
   *
   * **The return type is the literal `false`, not `boolean`.** That is what
   * lets the warn-and-skip decision be a single `return` statement at both call
   * sites below instead of a warn-then-return pair. It matters beyond
   * tidiness: each call site is then one contiguous statement, which is what
   * makes it a single-literal target for the mutation battery, and a battery
   * that cannot target a decision cannot prove the test covering it fires.
   * Both statements are spelled on one line each for the same reason, and are
   * deliberately worded differently so neither is a substring of the other.
   *
   * Warn-once is per stage id per instance, not per instance. Two broken
   * matchers must produce two warnings — `CatalogDiagnostic`'s doc comment
   * settles that granularity, and an aggregated line loses exactly the name a
   * developer needs.
   */
  function warnStage(id: string, problem: string, fix: string): false {
    warnedStages ??= new Set<string>();
    if (warnedStages.has(id)) {
      return false;
    }
    warnedStages.add(id);
    warnHost(
      `concierge: [stage_match] stage ${encodeDiagnosticSubject(id)}: ${problem} Fix: ${fix}`,
    );
    return false;
  }

  /**
   * The ONLY place `stage.match` is invoked — header constraint 3.
   *
   * catalog resolution and `explain` both reach a matcher through here, so the
   * throw policy, the non-boolean policy and the warn-once latch exist once and
   * cannot drift apart into readers that disagree about the same
   * context.
   */
  function runMatch(stage: ConciergeConfig["stages"][number], ctx: StageContext): boolean {
    let result: unknown;
    // **The `catch` takes NO binding, and the message echoes nothing it
    // caught.** This is the same structure as the two guarded calls in
    // `./json-schema.ts` with one decision deliberately INVERTED, and the
    // reason is written here because a later reader comparing the three will
    // otherwise "fix" the inconsistency.
    //
    // Those two are build-time developer diagnostics and carry the explicit
    // exemption stated at `json-schema.ts:259-261`, so they may render the
    // caught value. This one is the opposite case in all three respects that
    // matter: it fires at runtime, on every navigation, in a shipped app — and
    // the caught message is whatever the consumer's own matcher put in it,
    // which in a real app is assembled from the same user input `ctx` carries.
    // Echoing it would open exactly the covert channel CLAUDE.md's rule closes
    // for handler exceptions, one layer earlier and on a hotter path.
    //
    // With no binding there is no caught value in scope, so the property is
    // structural rather than a matter of remembering not to interpolate it.
    // The warning carries the stage id — a developer-authored string already in
    // the config — and fixed prose, and nothing else.
    try {
      result = stage.match(ctx);
    } catch {
      return warnStage(stage.id, "its `match(ctx)` threw, so the stage was skipped and its actions are absent from the catalog for this context.", "make `match` total — it runs on every navigation, so it must not assume any field of `ctx` is present.");
    }

    // **Strict equality, plus a named warning for everything else.** Neither
    // half is sufficient alone, and the combination is the only one that is
    // both fail-closed and diagnosable.
    //
    // Strict equality fails closed, which is the house rule already visible at
    // `catalog.ts:788` and `:798` (`=== true` on `destructive` and
    // `readsUntrusted`). But failing closed *silently* reproduces P14's exact
    // first-run experience. A JavaScript consumer writes
    // `match: (ctx) => ctx.pathname.startsWith("/results") && ctx.user`, gets a
    // truthy object back, never matches, and reads "the agent says it can't do
    // anything" with nothing anywhere to explain it. Measured:
    //
    //     `"yes" === true` -> false   |   `Boolean("yes")` -> true
    //
    // Both alternatives are defensible and both are worse. A **silent strict
    // check** is the failure above. A **permissive truthy check** matches on
    // the object, which means a matcher that returns a value it never meant as
    // an answer silently scopes the agent's whole catalog — failing open on the
    // decision that decides what an agent may do.
    if (result === true) {
      return true;
    }
    if (result !== false) {
      return warnStage(stage.id, "its `match(ctx)` returned a value that is neither `true` nor `false`, and a non-boolean is treated here as no match at all.", "return a real boolean — a truthy object does not match, deliberately, so compare explicitly rather than returning the value you tested.");
    }
    return false;
  }

  /**
   * Resolve a context to a stage POSITION, first match wins (STG-02).
   *
   * **Not memoized, and that is deliberate.** `ctx` is the caller's arbitrary
   * object — STG-03 requires it to be anything the app knows — so there is no
   * stable key to memoize against without holding a reference to every context
   * the app has ever produced. Matchers are pure and cheap by contract. Only
   * the *projected catalog* is memoized, and it is keyed by the resolution's
   * result rather than by its input, which is what makes the memo's key space
   * finite and equal to the stage count.
   *
   * **Resolution walks an ordered array, not a keyed object, so it is
   * independent of what the stages are named.** `ConciergeConfig.stages`'
   * doc comment already argues this; the measurement behind the argument is
   * that object key iteration hoists integer-like keys to the front:
   *
   *     object key order:  [ '2', '10', 'results', 'checkout', 'home' ]
   *     array order:       [ 'results', 'checkout', '2', 'home', '10' ]
   *
   * Under any keyed implementation, renaming a later stage to `"2"` moves it
   * ahead of everything declared before it, and first-match-wins silently
   * starts meaning something else.
   */
  function resolveIndex(ctx: StageContext): number | null {
    for (const [index, stage] of stages.entries()) {
      if (runMatch(stage, ctx)) {
        return index;
      }
    }
    return null;
  }

  /** Resolve dynamic action availability exactly once for one matched stage. */
  function resolveForIndex(
    index: number | null,
    ctx: StageContext,
  ): AtomicCatalogResolution {
    const candidates: readonly string[] =
      index === null ? crossNames : (namesByStage[index] ?? crossNames);
    const names: string[] = [];
    let bitmap: string = "";

    for (const name of candidates) {
      const entry: CatalogEntry | undefined = catalog.byName[name];
      if (entry === undefined) {
        bitmap += "0";
        continue;
      }

      const predicate: AnyActionDefinition["availableWhen"] =
        entry.action.availableWhen;
      let available: boolean = predicate === undefined;
      if (predicate !== undefined) {
        try {
          const answer: unknown = predicate(ctx);
          available = answer === true;
          if (typeof answer !== "boolean") {
            warnDispatchOnce(
              `availability-non-boolean:${name}`,
              `concierge: [availability_predicate] action ${encodeDiagnosticSubject(name)}: its \`availableWhen(ctx)\` did not return a boolean, so the action is unavailable. Fix: return exactly true or false for every context.`,
            );
          }
        } catch {
          available = false;
          warnDispatchOnce(
            `availability-threw:${name}`,
            `concierge: [availability_predicate] action ${encodeDiagnosticSubject(name)}: its \`availableWhen(ctx)\` threw, so the action is unavailable. Fix: make the predicate total and free of assumptions about context fields.`,
          );
        }
      }

      bitmap += available ? "1" : "0";
      if (available) names.push(name);
    }

    const key: string = `${index === null ? "none" : `stage:${index}`}:${bitmap}`;
    resolvedMemo ??= new Map<string, ResolvedCatalog>();
    let resolved: ResolvedCatalog | undefined = resolvedMemo.get(key);
    if (resolved === undefined) {
      const tools: ReadonlyArray<EmittedTool> = Object.freeze(
        names
          .map((name) => toolByName[name])
          .filter((tool): tool is EmittedTool => tool !== undefined),
      );
      resolved = Object.freeze({
        stage: index === null ? null : (stages[index]?.id ?? null),
        revision: Symbol("concierge.catalog") as CatalogRevision,
        tools,
      });
      resolvedMemo.set(key, resolved);
    }

    return {
      index,
      names: Object.freeze([...names]),
      resolved,
    };
  }

  /** The sole public catalog resolver: stage, availability and revision agree. */
  function resolveCatalog(ctx: StageContext): ResolvedCatalog {
    return resolveForIndex(resolveIndex(ctx), ctx).resolved;
  }

  /** Associate private control state without wrapping or replacing a Promise. */
  function trackDispatchPromise(
    promise: Promise<ActionResult>,
    executionState: DispatchExecutionState,
  ): Promise<ActionResult> {
    dispatchExecutionStates ??=
      new WeakMap<Promise<ActionResult>, DispatchExecutionState>();
    dispatchExecutionStates.set(promise, executionState);
    return promise;
  }

  function allocateDispatchId(): string {
    nextDispatchId += 1n;
    return `dispatch-${nextDispatchId}`;
  }

  function drainDispatchEvents(): void {
    dispatchEventScheduled = false;
    while (dispatchEventQueue.length > 0) {
      const queued: QueuedDispatchEvent | undefined = dispatchEventQueue.shift();
      if (queued === undefined) continue;
      for (const listener of queued.listeners) {
        try {
          const returned: void | Promise<void> = listener(queued.event);
          if (returned !== undefined) {
            void Promise.resolve(returned).catch(() => {
              warnDispatchOnce(
                "dispatch-listener-rejected",
                "concierge: [dispatch_listener_failed] a dispatch listener rejected; dispatch continued.",
              );
            });
          }
        } catch {
          warnDispatchOnce(
            "dispatch-listener-threw",
            "concierge: [dispatch_listener_failed] a dispatch listener threw; dispatch continued.",
          );
        }
      }
    }
  }

  function emitDispatch(event: DispatchEvent): void {
    const frozen: DispatchEvent = deepFreeze(
      event,
      NO_SKIP,
      new WeakSet<object>(),
    );
    dispatchEventQueue.push({
      event: frozen,
      listeners: Object.freeze([...(dispatchListeners?.values() ?? [])]),
    });
    if (!dispatchEventScheduled) {
      dispatchEventScheduled = true;
      void Promise.resolve().then(drainDispatchEvents);
    }
  }

  function onDispatch(listener: DispatchListener): () => void {
    if (typeof listener !== "function") {
      throw new TypeError("A dispatch listener must be callable.");
    }
    dispatchListeners ??= new Map<number, DispatchListener>();
    nextDispatchListenerId += 1;
    const id: number = nextDispatchListenerId;
    dispatchListeners.set(id, listener);
    let active: boolean = true;
    return (): void => {
      if (!active) return;
      active = false;
      if (dispatchListeners?.get(id) === listener) {
        dispatchListeners.delete(id);
      }
    };
  }

  function observedInputFor(
    entry: CatalogEntry,
    validated: unknown,
  ): ObservedInput {
    const policy: AnyActionDefinition["redact"] = entry.action.redact;
    if (policy === "drop") return DROPPED_INPUT;

    let exposed: unknown = validated;
    if (typeof policy === "function") {
      try {
        exposed = policy(validated);
      } catch {
        warnDispatchOnce(
          `redaction-threw:${entry.action.name}`,
          `concierge: [redaction_failed] action ${encodeDiagnosticSubject(entry.action.name)}: its redaction projection threw, so observer input was dropped. Fix: make the projection total and return invocation data.`,
        );
        return DROPPED_INPUT;
      }
    }

    const snapshot: InvocationValueSnapshot = snapshotInvocationValue(exposed, true);
    if (!snapshot.ok || encodeInvocationValue(snapshot.value) === null) {
      warnDispatchOnce(
        `redaction-invalid:${entry.action.name}`,
        `concierge: [redaction_failed] action ${encodeDiagnosticSubject(entry.action.name)}: its observer projection was not safe invocation data, so observer input was dropped. Fix: return acyclic plain data without accessors or exotic objects.`,
      );
      return DROPPED_INPUT;
    }
    return Object.freeze({ kind: "included", value: snapshot.value });
  }

  function observedResultStatus(result: ActionResult): ObservedActionResult {
    return Object.freeze(
      result.reason === undefined
        ? { ok: result.ok, message: result.message }
        : { ok: result.ok, reason: result.reason, message: result.message },
    );
  }

  function observedResultDataFor(
    entry: CatalogEntry | null,
    result: ActionResult,
  ): ObservedResultData {
    if (result.data === undefined) return ABSENT_RESULT_DATA;
    if (entry === null) return DROPPED_RESULT_DATA;
    const output: AnyActionDefinition["output"] = entry.action.output;
    if (output === undefined || output.redact === "drop") {
      return DROPPED_RESULT_DATA;
    }

    let exposed: unknown = result.data;
    if (typeof output.redact === "function") {
      try {
        exposed = output.redact(result.data);
      } catch {
        warnDispatchOnce(
          `output-redaction-threw:${entry.action.name}`,
          `concierge: [output_redaction_failed] action ${encodeDiagnosticSubject(entry.action.name)}: its result projection threw, so observer data was dropped. Fix: make the projection total and return JSON-safe data.`,
        );
        return DROPPED_RESULT_DATA;
      }
    }

    const snapshot: ActionDataSnapshot = snapshotActionData(
      exposed,
      maxActionDataBytes,
    );
    if (!snapshot.ok) {
      warnDispatchOnce(
        `output-redaction-invalid:${entry.action.name}`,
        `concierge: [output_redaction_failed] action ${encodeDiagnosticSubject(entry.action.name)}: its observer result projection was not safe bounded JSON data, so observer data was dropped. Fix: return acyclic plain JSON data without aliases or accessors.`,
      );
      return DROPPED_RESULT_DATA;
    }
    return Object.freeze({ kind: "included", value: snapshot.value });
  }

  function eventTerminalPhase(result: ActionResult): "succeeded" | "failed" | "cancelled" {
    if (result.ok) return "succeeded";
    switch (result.reason) {
      case "aborted":
      case "cancelled":
      case "declined":
      case "superseded":
        return "cancelled";
      default:
        return "failed";
    }
  }

  function latchWorkflowFailure(
    root: WorkflowRootState,
    result: ActionResult,
  ): void {
    if (root.failure === null && !result.ok) root.failure = result;
  }

  function workflowRuntimeFor(occurrence: V2Occurrence): WorkflowRuntime {
    const cleanups: Array<() => void | Promise<void>> = [];
    const childSteps: Map<
      string,
      Readonly<{
        context: unknown;
        name: string;
        input: string;
        promise: Promise<ActionResult>;
      }>
    > = new Map();
    let acceptingWork: boolean = true;
    let acceptingCleanup: boolean = true;
    let localTail: Promise<void> = Promise.resolve();

    const childLineage = (stepId: string): DispatchLineage => Object.freeze({
      rootDispatchId: occurrence.root.rootDispatchId,
      parentDispatchId: occurrence.dispatchId,
      stepId,
      depth: occurrence.lineage.depth + 1,
    });

    const rejectedChild = (
      context: StageContext,
      name: string | null,
      stepId: string,
      result: ActionResult,
    ): Promise<ActionResult> => {
      const resolution: AtomicCatalogResolution = resolveForIndex(
        resolveIndex(context),
        context,
      );
      return rejectedV2Dispatch(
        context,
        resolution,
        name,
        null,
        occurrence.meta,
        result,
        { root: occurrence.root, lineage: childLineage(stepId) },
      );
    };

    const enqueueFailure = (
      context: StageContext,
      name: string | null,
      stepId: string,
      failure: ActionResult,
      latch: boolean = true,
    ): Promise<ActionResult> => {
      let resolveOperation!: (result: ActionResult) => void;
      const operation = new Promise<ActionResult>((resolve) => {
        resolveOperation = resolve;
      });
      const prior: Promise<void> = localTail;
      const run = async (): Promise<void> => {
        await prior;
        if (
          occurrence.root.terminalRef !== null ||
          occurrence.root.terminalResult !== null
        ) {
          const superseded: ActionResult = authoredResult(
            false,
            "The workflow step was skipped after terminal execution began.",
            "superseded",
          );
          resolveOperation(await rejectedChild(
            context,
            name,
            stepId,
            superseded,
          ));
          return;
        }
        if (occurrence.root.failure !== null) {
          const superseded: ActionResult = authoredResult(
            false,
            "The workflow step was skipped after an earlier step failed.",
            "superseded",
          );
          resolveOperation(await rejectedChild(
            context,
            name,
            stepId,
            superseded,
          ));
          return;
        }
        if (latch) latchWorkflowFailure(occurrence.root, failure);
        resolveOperation(await rejectedChild(
          context,
          name,
          stepId,
          failure,
        ));
      };
      localTail = run().catch(() => {
        const contained: ActionResult = authoredResult(
          false,
          "Something went wrong.",
          "handler_error",
        );
        latchWorkflowFailure(occurrence.root, contained);
        void rejectedChild(
          context,
          name,
          stepId,
          contained,
        ).then(resolveOperation);
      });
      return operation;
    };

    const controls: WorkflowControls = Object.freeze({
      signal: occurrence.root.signal,
      run(request: ChildActionRequest): Promise<ActionResult> {
        if (!acceptingWork) {
          warnDispatchOnce(
            "workflow-run-late",
            "concierge: [workflow_lifecycle] a child action was refused after its handler completed.",
          );
          return rejectedChild(
            occurrence.context,
            null,
            "[late]",
            authoredResult(
            false,
            "The workflow step arrived after its parent completed.",
            "superseded",
            ),
          );
        }

        let stepId: unknown;
        let name: unknown;
        let input: unknown;
        let childContext: unknown;
        try {
          stepId = request.stepId;
          name = request.name;
          input = request.input;
          childContext = request.context ?? occurrence.context;
        } catch {
          const failure: ActionResult = authoredResult(
            false,
            "The workflow step is invalid.",
            "invalid_invocation",
          );
          return enqueueFailure(
            occurrence.context,
            null,
            "[unobservable]",
            failure,
          );
        }

        const observableStepId: string = isSafeIdentifier(stepId)
          ? stepId
          : "[invalid]";
        const observableName: string | null = isSafeIdentifier(name)
          ? name
          : null;
        const context: StageContext =
          typeof childContext === "object" && childContext !== null
            ? childContext as StageContext
            : occurrence.context;
        const rawInputKey: string = (() => {
          const snapshot: InvocationValueSnapshot = snapshotInvocationValue(input);
          const encoded: string | null = snapshot.ok
            ? encodeInvocationValue(snapshot.value)
            : null;
          return encoded ?? invalidInputDescriptor(input);
        })();

        if (
          !isSafeIdentifier(stepId) ||
          !isSafeIdentifier(name) ||
          typeof childContext !== "object" ||
          childContext === null
        ) {
          const failure: ActionResult = authoredResult(
            false,
            "The workflow step is invalid.",
            "invalid_invocation",
          );
          if (isSafeIdentifier(stepId)) {
            const existing = childSteps.get(stepId);
            if (existing !== undefined) {
              if (
                existing.context === childContext &&
                existing.name === String(name) &&
                existing.input === rawInputKey
              ) {
                return existing.promise;
              }
              return enqueueFailure(
                context,
                observableName,
                observableStepId,
                authoredResult(
                  false,
                  "The workflow step identity was reused for a different action.",
                  "identity_conflict",
                ),
              );
            }
            const operation: Promise<ActionResult> = enqueueFailure(
              context,
              observableName,
              observableStepId,
              failure,
            );
            childSteps.set(stepId, Object.freeze({
              context: childContext,
              name: String(name),
              input: rawInputKey,
              promise: operation,
            }));
            return operation;
          }
          return enqueueFailure(context, observableName, observableStepId, failure);
        }

        const inputSnapshot: InvocationValueSnapshot = snapshotInvocationValue(input);
        const inputKey: string | null = inputSnapshot.ok
          ? encodeInvocationValue(inputSnapshot.value)
          : null;
        if (!inputSnapshot.ok || inputKey === null) {
          const failure: ActionResult = authoredResult(
            false,
            "The workflow step arguments are invalid.",
            "invalid_args",
          );
          const existing = childSteps.get(stepId);
          if (existing !== undefined) {
            if (
              existing.context === childContext &&
              existing.name === name &&
              existing.input === rawInputKey
            ) {
              return existing.promise;
            }
            return enqueueFailure(
              context,
              name,
              stepId,
              authoredResult(
                false,
                "The workflow step identity was reused for a different action.",
                "identity_conflict",
              ),
            );
          }
          const operation: Promise<ActionResult> = enqueueFailure(
            context,
            name,
            stepId,
            failure,
          );
          childSteps.set(stepId, Object.freeze({
            context: childContext,
            name,
            input: rawInputKey,
            promise: operation,
          }));
          return operation;
        }

        const existing = childSteps.get(stepId);
        if (existing !== undefined) {
          if (
            existing.context === context &&
            existing.name === name &&
            existing.input === inputKey
          ) {
            return existing.promise;
          }
          const conflict: ActionResult = authoredResult(
            false,
            "The workflow step identity was reused for a different action.",
            "identity_conflict",
          );
          return enqueueFailure(context, name, stepId, conflict);
        }

        let resolveOperation!: (result: ActionResult) => void;
        const operation: Promise<ActionResult> = new Promise<ActionResult>((resolve) => {
          resolveOperation = resolve;
        });
        childSteps.set(stepId, Object.freeze({
          context,
          name,
          input: inputKey,
          promise: operation,
        }));

        const prior: Promise<void> = localTail;
        const run = async (): Promise<void> => {
          await prior;
          if (occurrence.root.failure !== null) {
            resolveOperation(await rejectedChild(
              context,
              name,
              stepId,
              authoredResult(
                false,
                "The workflow step was skipped after an earlier step failed.",
                "superseded",
              ),
            ));
            return;
          }
          if (
            occurrence.root.terminalRef !== null ||
            occurrence.root.terminalResult !== null
          ) {
            resolveOperation(await rejectedChild(
              context,
              name,
              stepId,
              authoredResult(
              false,
              "The workflow step was skipped after terminal execution began.",
              "superseded",
              ),
            ));
            return;
          }
          if (
            occurrence.lineage.depth + 1 > maxWorkflowDepth ||
            occurrence.root.steps >= maxWorkflowSteps
          ) {
            const failure: ActionResult = authoredResult(
              false,
              "The workflow exceeded its safety limit.",
              "handler_error",
            );
            latchWorkflowFailure(occurrence.root, failure);
            resolveOperation(await rejectedChild(
              context,
              name,
              stepId,
              failure,
            ));
            return;
          }
          occurrence.root.steps += 1;
          const childIndex: number = occurrence.root.steps;
          const resolution: AtomicCatalogResolution = resolveForIndex(
            resolveIndex(context),
            context,
          );
          const parentIdentity: Readonly<InvocationIdentity> | null =
            occurrence.identity;
          const identity: InvocationIdentity = Object.freeze({
            sessionId: parentIdentity?.sessionId ??
              `workflow-${occurrence.root.rootDispatchId}`,
            responseId: parentIdentity?.responseId ??
              occurrence.root.rootDispatchId,
            callId: `workflow:${occurrence.dispatchId}:${childIndex}`,
            userTurnId: parentIdentity?.userTurnId ??
              occurrence.root.rootDispatchId,
            outputIndex: childIndex,
          });
          const childSnapshot: DispatchRequestSnapshot = snapshotDispatchRequest({
            name,
            input: inputSnapshot.value,
            catalogRevision: resolution.resolved.revision,
            identity,
            signal: occurrence.root.signal,
            deferUntilDelivered: occurrence.meta.deferUntilDelivered,
          });
          if (!childSnapshot.ok) {
            const failure: ActionResult = authoredResult(
              false,
              "The workflow step is invalid.",
              childSnapshot.reason,
            );
            latchWorkflowFailure(occurrence.root, failure);
            resolveOperation(failure);
            return;
          }
          const lineage: DispatchLineage = childLineage(stepId);
          const result: ActionResult = await dispatchV2FromSnapshot(
            context,
            childSnapshot,
            resolution,
            { root: occurrence.root, lineage },
          );
          latchWorkflowFailure(occurrence.root, result);
          resolveOperation(result);
        };
        localTail = run().catch(() => {
          const failure: ActionResult = authoredResult(
            false,
            "Something went wrong.",
            "handler_error",
          );
          latchWorkflowFailure(occurrence.root, failure);
          resolveOperation(failure);
        });
        return operation;
      },
      delay(ms: number): Promise<void> {
        if (!acceptingWork) {
          warnDispatchOnce(
            "workflow-delay-late",
            "concierge: [workflow_lifecycle] a delay was refused after its handler completed.",
          );
          return Promise.reject(new Error("workflow completed"));
        }
        const prior: Promise<void> = localTail;
        const operation = async (): Promise<void> => {
          await prior;
          if (occurrence.root.failure !== null || occurrence.root.terminalRef !== null) {
            throw new Error("workflow stopped");
          }
          if (!Number.isFinite(ms) || ms < 0) {
            const failure: ActionResult = authoredResult(
              false,
              "The workflow delay is invalid.",
              "handler_error",
            );
            latchWorkflowFailure(occurrence.root, failure);
            throw new Error("invalid workflow delay");
          }
          if (occurrence.root.steps >= maxWorkflowSteps) {
            const failure: ActionResult = authoredResult(
              false,
              "The workflow exceeded its safety limit.",
              "handler_error",
            );
            latchWorkflowFailure(occurrence.root, failure);
            throw new Error("workflow limit");
          }
          occurrence.root.steps += 1;

          let scheduler: Scheduler | undefined = configuredScheduler;
          if (scheduler === undefined) {
            try {
              scheduler = readHostScheduler();
            } catch {
              scheduler = undefined;
            }
          }
          const wait: CommitWaitOutcome = await waitForCommit(
            scheduler,
            ms,
            occurrence.root.signal,
          );
          if (wait === "aborted" || isAborted(occurrence.root.signal)) {
            const failure: ActionResult = authoredResult(
              false,
              "The workflow was cancelled.",
              "aborted",
            );
            latchWorkflowFailure(occurrence.root, failure);
            throw new Error("workflow aborted");
          }
          if (wait === "unavailable") {
            const failure: ActionResult = authoredResult(
              false,
              "The workflow timer is unavailable.",
              "handler_error",
            );
            latchWorkflowFailure(occurrence.root, failure);
            throw new Error("workflow timer unavailable");
          }
        };
        const promise: Promise<void> = operation();
        localTail = promise.catch(() => {});
        return promise;
      },
      cleanup(fn: () => void | Promise<void>): () => void {
        if (!acceptingCleanup || typeof fn !== "function") {
          warnDispatchOnce(
            "workflow-cleanup-late",
            "concierge: [workflow_cleanup] cleanup registration was refused after unwinding began.",
          );
          return (): void => {};
        }
        const entry: { active: boolean; fn: () => void | Promise<void> } = {
          active: true,
          fn,
        };
        cleanups.push((): void | Promise<void> => {
          if (!entry.active) return;
          entry.active = false;
          return entry.fn();
        });
        return (): void => {
          entry.active = false;
        };
      },
    });

    return {
      controls,
      seal(): void {
        acceptingWork = false;
        acceptingCleanup = false;
      },
      async drain(): Promise<void> {
        try {
          await localTail;
        } catch {
          // Individual operations already latched their safe result.
        }
      },
      async unwind(): Promise<void> {
        acceptingCleanup = false;
        let cleanupFailed: boolean = false;
        for (let index: number = cleanups.length - 1; index >= 0; index -= 1) {
          const cleanup: (() => void | Promise<void>) | undefined = cleanups[index];
          if (cleanup === undefined) continue;
          try {
            await cleanup();
          } catch {
            cleanupFailed = true;
          }
        }
        if (cleanupFailed) {
          if (occurrence.root.failure === null) {
            occurrence.root.failure = authoredResult(
              false,
              "Something went wrong during cleanup.",
              "handler_error",
            );
          } else {
            warnDispatchOnce(
              "workflow-cleanup-failed",
              "concierge: [workflow_cleanup] a cleanup failed after an earlier workflow failure; the earlier result was preserved.",
            );
          }
        }
      },
    };
  }

  /** Execute one call after the synchronous deduplication boundary. */
  async function runDispatchPipelineCore(
    index: number | null,
    entry: CatalogEntry,
    name: string,
    args: unknown,
    meta: InvocationMeta,
    argumentsMalformed: boolean,
    executionState: DispatchExecutionState,
    workflow: WorkflowControls,
    occurrence: V2Occurrence | null,
    observation: PipelineObservation,
  ): Promise<ActionResult> {
    const handler: unknown = entry.action.handler;
    if (typeof handler !== "function") {
      warnDispatchOnce(
        `handler-missing:${name}`,
        `concierge: [handler_missing] action ${encodeDiagnosticSubject(name)}: no callable handler is registered, so the action did not run. Fix: provide a callable handler in the action declaration.`,
      );
      return authoredResult(
        false,
        "This action is unavailable because no handler is registered.",
      );
    }

    const validation: ArgumentValidation = await validateArguments(entry, args);
    if (!validation.ok || argumentsMalformed) {
      return authoredResult(
        false,
        "The action arguments are invalid.",
        "invalid_args",
      );
    }

    const consentSessionId: string | null =
      occurrence?.identity?.sessionId ?? null;
    const actionConsentSlotKey: string = consentSlotKey(consentSessionId, name);
    const replacesReviewAuthority: boolean = reviewNames.has(name);
    if (replacesReviewAuthority) {
      // Validation is the freshness boundary. Every later failure stays closed.
      consentGenerations?.delete(actionConsentSlotKey);
    }

    let preparedReadback: PreparedReadback | null = null;
    let validatedSnapshot: InvocationValueSnapshot;
    if (attestedReviewNames.has(name)) {
      const prepared: PreparedReadbackResult = prepareReadback(validation.value);
      if (!prepared.ok) {
        return authoredResult(
          false,
          "The action arguments are invalid.",
          "invalid_args",
        );
      }
      preparedReadback = prepared.value;
      validatedSnapshot = {
        ok: true,
        value: preparedReadback.readback.payload,
      };
    } else {
      validatedSnapshot = snapshotInvocationValue(validation.value, true);
    }
    if (
      !validatedSnapshot.ok ||
      (occurrence !== null &&
        encodeInvocationValue(validatedSnapshot.value) === null)
    ) {
      return authoredResult(
        false,
        "The action arguments are invalid.",
        "invalid_args",
      );
    }

    const stage: ConciergeConfig["stages"][number] | undefined =
      index === null ? undefined : stages[index];
    const bridgeRegistry: BridgeRegistry | undefined =
      effectiveBridgeRegistry(entry.action, stage);
    const bridge: Bridge | null = resolveBridgeRegistry(bridgeRegistry);

    let reviewingGeneration:
      | (ConsentGenerationBase & { readonly status: "reviewing" })
      | null = null;
    if (replacesReviewAuthority) {
      const snapshotBridgeId: string =
        bridgeRegistry?.id ?? stage?.id ?? "cross-stage";
      nextConsentGeneration += 1n;
      reviewingGeneration = Object.freeze({
        confirmationUserTurnId: null,
        generation: nextConsentGeneration,
        payload: validatedSnapshot.value,
        preparedReadback,
        readbackHash: null,
        responseId: meta.responseId ?? "",
        sessionId: consentSessionId,
        snapshot: captureResolvedSnapshot(snapshotBridgeId, bridge),
        snapshotBridgeId,
        snapshotBridgeRegistry: bridgeRegistry,
        status: "reviewing",
        userTurnId: meta.userTurnId ?? "",
        verifiedReadback: null,
      });
      consentGenerations ??= new Map<string, ConsentGeneration>();
      consentGenerations.set(actionConsentSlotKey, reviewingGeneration);
    }

    const closeOwnedReview = (): void => {
      if (reviewingGeneration !== null) {
        closeConsentGeneration(
          actionConsentSlotKey,
          reviewingGeneration.generation,
        );
      }
    };

    const signal: AbortSignalLike | undefined = meta.signal;

    if (isAborted(signal)) {
      closeOwnedReview();
      return authoredResult(
        false,
        "The action was cancelled before it ran.",
        "aborted",
      );
    }

    if (occurrence !== null) {
      observation.input = observedInputFor(entry, validatedSnapshot.value);
      observation.accepted = true;
      emitDispatch({
        dispatchId: occurrence.dispatchId,
        name,
        stage: occurrence.resolution.resolved.stage,
        catalogRevision: occurrence.resolution.resolved.revision,
        identity: occurrence.identity,
        lineage: occurrence.lineage,
        input: observation.input,
        terminalAction: entry.action.terminal === true,
        terminalEntered: false,
        phase: "accepted",
      });
    }

    if (entry.action.effects?.readOnly !== true) {
      let scheduler: Scheduler | undefined = configuredScheduler;
      if (scheduler === undefined) {
        try {
          scheduler = readHostScheduler();
        } catch {
          scheduler = undefined;
        }
      }

      if (occurrence !== null && commitWindowMs > 0) {
        emitDispatch({
          dispatchId: occurrence.dispatchId,
          name,
          stage: occurrence.resolution.resolved.stage,
          catalogRevision: occurrence.resolution.resolved.revision,
          identity: occurrence.identity,
          lineage: occurrence.lineage,
          input: observation.input,
          terminalAction: entry.action.terminal === true,
          terminalEntered: false,
          phase: "waiting",
          wait: "commit_window",
        });
      }

      const wait: CommitWaitOutcome = await waitForCommit(
        scheduler,
        commitWindowMs,
        signal,
      );
      if (wait === "aborted") {
        closeOwnedReview();
        return authoredResult(
          false,
          "The action was cancelled before it ran.",
          "aborted",
        );
      }
      if (wait === "unavailable") {
        warnDispatchOnce(
          "commit-window-unavailable",
          "concierge: [commit_window_unavailable] config \"scheduler\": no cancellable timer is available, so the commit window was skipped. Fix: provide `ConciergeConfig.scheduler` in this host.",
        );
      }
    }

    // Close the interval between a ready scheduler callback and this async
    // continuation entering the handler.
    if (isAborted(signal)) {
      closeOwnedReview();
      return authoredResult(
        false,
        "The action was cancelled before it ran.",
        "aborted",
      );
    }

    if (isAborted(signal)) {
      closeOwnedReview();
      return authoredResult(
        false,
        "The action was cancelled before it ran.",
        "aborted",
      );
    }

    let consentAck: ConsentAck<unknown, unknown> | undefined;
    const policy: ConsentPolicy<unknown> | undefined = entry.action.consent;
    if (policy !== undefined) {
      if (occurrence !== null && occurrence.lineage.depth > 0) {
        closeOwnedReview();
        return missingConsentResult(policy);
      }
      const reviewName: string = policy.requires;
      const reviewConsentSlotKey: string = consentSlotKey(
        consentSessionId,
        reviewName,
      );
      const owned: ConsentGeneration | undefined =
        consentGenerations?.get(reviewConsentSlotKey);
      if (owned?.status === "gradeUnavailable") {
        closeConsentGeneration(reviewConsentSlotKey, owned.generation);
        closeOwnedReview();
        return authoredResult(
          false,
          "The available consent evidence is not strong enough for this action.",
          "grade_unavailable",
        );
      }
      if (owned?.status === "declined" || owned?.status === "dismissed") {
        closeConsentGeneration(reviewConsentSlotKey, owned.generation);
        closeOwnedReview();
        return owned.status === "declined" ? USER_DECLINED : USER_CANCELLED;
      }
      if (
        owned?.status !== "armed" ||
        owned.sessionId !== consentSessionId
      ) {
        closeOwnedReview();
        return missingConsentResult(policy);
      }

      if (
        !hasFreshConsentBoundary(
          policy,
          owned,
          meta,
          capturedConsent.profile,
        )
      ) {
        closeOwnedReview();
        return missingConsentResult(policy);
      }

      if (!isMeasuredConsentGrade(owned.achievedGrade)) {
        closeConsentGeneration(reviewConsentSlotKey, owned.generation);
        closeOwnedReview();
        return authoredResult(
          false,
          "The available consent evidence is not strong enough for this action.",
          "grade_unavailable",
        );
      }
      if (
        owned.achievedGrade === "attested" &&
        (owned.readbackHash === null ||
          owned.confirmationUserTurnId === null)
      ) {
        closeConsentGeneration(reviewConsentSlotKey, owned.generation);
        closeOwnedReview();
        return authoredResult(
          false,
          "The available consent evidence is not strong enough for this action.",
          "grade_unavailable",
        );
      }
      const minimumGrade: ConsentGrade = effectiveConsentMinimum(
        policy.minGrade,
      );
      if (
        consentGradeRank(owned.achievedGrade) < consentGradeRank(minimumGrade)
      ) {
        closeConsentGeneration(reviewConsentSlotKey, owned.generation);
        closeOwnedReview();
        return authoredResult(
          false,
          "The available consent evidence is not strong enough for this action.",
          "grade_unavailable",
        );
      }

      let snapshotsMatch: boolean = false;
      try {
        const snapshotBridge: Bridge | null =
          owned.snapshotBridgeRegistry === bridgeRegistry
            ? bridge
            : resolveBridgeRegistry(owned.snapshotBridgeRegistry);
        const currentSnapshot: Readonly<Record<string, unknown>> =
          captureResolvedSnapshot(owned.snapshotBridgeId, snapshotBridge);
        const comparator: ConsentPolicy<unknown>["snapshotEquality"] =
          policy.snapshotEquality;
        snapshotsMatch = comparator === undefined
          ? strictSnapshotEquality(owned.snapshot, currentSnapshot)
          : comparator(owned.snapshot, currentSnapshot) === true;
      } catch {
        snapshotsMatch = false;
      }
      if (!snapshotsMatch) {
        closeConsentGeneration(reviewConsentSlotKey, owned.generation);
        closeOwnedReview();
        return authoredResult(
          false,
          "The reviewed state changed before this action could run.",
          "consent_stale",
        );
      }

      // A consumer comparator may synchronously abort while it evaluates.
      if (isAborted(signal)) {
        closeOwnedReview();
        return authoredResult(
          false,
          "The action was cancelled before it ran.",
          "aborted",
        );
      }

      const stillOwned: ConsentGeneration | undefined =
        consentGenerations?.get(reviewConsentSlotKey);
      if (
        stillOwned?.status !== "armed" ||
        stillOwned.generation !== owned.generation ||
        stillOwned.sessionId !== consentSessionId
      ) {
        closeOwnedReview();
        return missingConsentResult(policy);
      }

      // Authority is one-shot across every action sharing this review name.
      closeConsentGeneration(reviewConsentSlotKey, owned.generation);
      consentAck = Object.freeze(
        owned.achievedGrade === "attested"
          ? {
              grade: owned.achievedGrade,
              payload: owned.payload,
              readbackHash: owned.readbackHash as string,
              responseId: owned.responseId,
              snapshot: owned.snapshot,
              userTurnId: owned.userTurnId,
            }
          : {
              grade: owned.achievedGrade,
              payload: owned.payload,
              responseId: owned.responseId,
              snapshot: owned.snapshot,
              userTurnId: owned.userTurnId,
            },
      );
    }

    let handlerReturn: unknown;
    try {
      if (entry.action.terminal === true) {
        executionState.terminalEntered = true;
        if (occurrence !== null) {
          const enteredBy: DispatchRef = Object.freeze({
            dispatchId: occurrence.dispatchId,
            name,
            callId: occurrence.identity?.callId ?? occurrence.dispatchId,
            outputIndex: occurrence.identity?.outputIndex ?? 0,
            lineage: occurrence.lineage,
          });
          executionState.terminalRef = enteredBy;
          occurrence.root.terminalRef = enteredBy;
        }
      }
      if (occurrence !== null) {
        emitDispatch({
          dispatchId: occurrence.dispatchId,
          name,
          stage: occurrence.resolution.resolved.stage,
          catalogRevision: occurrence.resolution.resolved.revision,
          identity: occurrence.identity,
          lineage: occurrence.lineage,
          input: observation.input,
          terminalAction: entry.action.terminal === true,
          terminalEntered: executionState.terminalEntered,
          phase: "executing",
        });
      }
      handlerReturn = handler({
        args: validatedSnapshot.value,
        bridge,
        meta,
        ack: consentAck,
        workflow,
      });
    } catch {
      closeOwnedReview();
      return authoredResult(
        false,
        "Something went wrong.",
        "handler_error",
      );
    }

    let handlerResult: unknown = handlerReturn;
    if (
      (typeof handlerReturn === "object" && handlerReturn !== null) ||
      typeof handlerReturn === "function"
    ) {
      let then: unknown;
      try {
        then = (handlerReturn as { readonly then?: unknown }).then;
      } catch {
        // A hostile result object is normalized below; probing Promise
        // compatibility must not reclassify it as a handler exception.
        then = undefined;
      }

      if (typeof then === "function") {
        try {
          handlerResult = await new Promise<unknown>((resolve, reject) => {
            then.call(handlerReturn, resolve, reject);
          });
        } catch {
          closeOwnedReview();
          return authoredResult(
            false,
            "Something went wrong.",
            "handler_error",
          );
        }
      }
    }

    const normalizedResult: ActionResult = await normalizeActionResult(handlerResult, {
      entry,
      maximumDataBytes: maxActionDataBytes,
      successReason: (): void => {
        warnDispatchOnce(
          `success-reason:${name}`,
          `concierge: [invalid_result] action ${encodeDiagnosticSubject(name)}: its handler returned a success carrying a failure reason, so the reason was removed. Fix: omit \`reason\` when \`ok\` is true.`,
        );
      },
      reasonlessFailure: (): void => {
        warnDispatchOnce(
          `reasonless-failure:${name}`,
          `concierge: [invalid_result] action ${encodeDiagnosticSubject(name)}: its handler returned a failure without a reason, so the result carries no machine-readable cause. Fix: return one of the declared \`ReasonCode\` values when \`ok\` is false.`,
        );
      },
    });

    if (reviewingGeneration === null) {
      return normalizedResult;
    }
    if (!normalizedResult.ok) {
      closeOwnedReview();
      return normalizedResult;
    }

    const currentReview: ConsentGeneration | undefined =
      consentGenerations?.get(actionConsentSlotKey);
    if (
      currentReview?.generation !== reviewingGeneration.generation ||
      currentReview.status !== "reviewing" ||
      currentReview.responseId !== reviewingGeneration.responseId
    ) {
      return normalizedResult;
    }

    let verifiedReadback: VerifiedReadbackEvidence | null = null;
    if (reviewingGeneration.preparedReadback !== null) {
      const presenter = capturedConsent.presentReadback;
      if (presenter === undefined) {
        closeOwnedReview();
        return normalizedResult;
      }
      let receipt: unknown;
      try {
        receipt = await presenter(reviewingGeneration.preparedReadback.readback);
      } catch {
        closeOwnedReview();
        return normalizedResult;
      }
      const afterPresentation: ConsentGeneration | undefined =
        consentGenerations?.get(actionConsentSlotKey);
      if (
        afterPresentation?.generation !== reviewingGeneration.generation ||
        afterPresentation.status !== "reviewing" ||
        afterPresentation.responseId !== reviewingGeneration.responseId
      ) {
        return normalizedResult;
      }
      const receiptSnapshot: ReadbackReceiptSnapshotResult =
        snapshotReadbackReceipt(receipt);
      if (!receiptSnapshot.ok) {
        closeOwnedReview();
        return normalizedResult;
      }
      const freshHash: string | null = await digestReadback(
        capturedConsent.digest,
        reviewingGeneration.preparedReadback.canonical,
      );
      const afterDigest: ConsentGeneration | undefined =
        consentGenerations?.get(actionConsentSlotKey);
      if (
        afterDigest?.generation !== reviewingGeneration.generation ||
        afterDigest.status !== "reviewing" ||
        afterDigest.responseId !== reviewingGeneration.responseId
      ) {
        return normalizedResult;
      }
      verifiedReadback = verifyReadbackReceipt(
        reviewingGeneration.preparedReadback,
        receiptSnapshot.value,
        freshHash,
      );
      if (verifiedReadback === null) {
        closeOwnedReview();
        return normalizedResult;
      }
    }

    const deliveryHook: InvocationMeta["deferUntilDelivered"] =
      meta.deferUntilDelivered;
    if (
      typeof deliveryHook !== "function" ||
      reviewingGeneration.responseId.length === 0
    ) {
      closeOwnedReview();
      return normalizedResult;
    }

    const pendingDelivery = Object.freeze({
      ...reviewingGeneration,
      status: "pendingDelivery" as const,
      verifiedReadback,
    });
    consentGenerations?.set(actionConsentSlotKey, pendingDelivery);
    try {
      deliveryHook((report: DeliveryReport): void => {
        void observeReviewDelivery(actionConsentSlotKey, pendingDelivery, report);
      });
    } catch {
      closeConsentGeneration(
        actionConsentSlotKey,
        reviewingGeneration.generation,
      );
    }

    return normalizedResult;
  }

  async function runDispatchPipeline(
    index: number | null,
    entry: CatalogEntry,
    name: string,
    args: unknown,
    meta: InvocationMeta,
    argumentsMalformed: boolean,
    executionState: DispatchExecutionState,
    occurrence: V2Occurrence,
  ): Promise<ActionResult> {
    const observation: PipelineObservation = {
      accepted: false,
      input: DROPPED_INPUT,
    };
    const workflow: WorkflowRuntime = workflowRuntimeFor(occurrence);
    let result: ActionResult;
    try {
      result = await runDispatchPipelineCore(
        index,
        entry,
        name,
        args,
        meta,
        argumentsMalformed,
        executionState,
        workflow.controls,
        occurrence,
        observation,
      );
    } catch {
      result = authoredResult(false, "Something went wrong.", "handler_error");
    }

    workflow.seal();
    await workflow.drain();
    latchWorkflowFailure(occurrence.root, result);
    await workflow.unwind();

    if (
      occurrence.root.terminalRef?.dispatchId === occurrence.dispatchId &&
      occurrence.root.terminalResult === null
    ) {
      occurrence.root.terminalResult = occurrence.root.failure ?? result;
    }
    if (occurrence.root.terminalResult !== null) {
      result = occurrence.root.terminalResult;
    } else if (occurrence.root.failure !== null) {
      result = occurrence.root.failure;
    }

    emitDispatch({
      dispatchId: occurrence.dispatchId,
      name,
      stage: occurrence.resolution.resolved.stage,
      catalogRevision: occurrence.resolution.resolved.revision,
      identity: occurrence.identity,
      lineage: occurrence.lineage,
      input: observation.input,
      terminalAction: entry.action.terminal === true,
      phase: eventTerminalPhase(result),
      result: observedResultStatus(result),
      resultData: observedResultDataFor(entry, result),
      terminalEntered: occurrence.root.terminalRef !== null,
    });
    return result;
  }

  function rootOccurrence(
    ctx: StageContext,
    resolution: AtomicCatalogResolution,
    meta: InvocationMeta,
    executionState: DispatchExecutionState,
    identity: Readonly<InvocationIdentity> | null = null,
  ): V2Occurrence {
    const dispatchId: string = allocateDispatchId();
    executionState.rootDispatchId = dispatchId;
    const lineage: DispatchLineage = Object.freeze({
      rootDispatchId: dispatchId,
      depth: 0,
    });
    const root: WorkflowRootState = {
      rootDispatchId: dispatchId,
      signal: meta.signal ?? NEVER_ABORTED_SIGNAL,
      executionState,
      steps: 0,
      failure: null,
      terminalResult: null,
      terminalRef: null,
    };
    return {
      context: ctx,
      dispatchId,
      identity,
      lineage,
      meta,
      resolution,
      root,
    };
  }

  function dedupeDescriptorEquals(
    left: V2DedupeDescriptor,
    right: V2DedupeDescriptor,
  ): boolean {
    return left.revision === right.revision &&
      left.name === right.name &&
      left.input === right.input &&
      left.outputIndex === right.outputIndex &&
      left.userTurnId === right.userTurnId;
  }

  function sweepV2Dispatches(now: number): void {
    if (v2Dispatches === null) return;
    for (const [key, record] of v2Dispatches) {
      if (
        !record.pending &&
        record.settledAt !== null &&
        now - record.settledAt >= dedupeWindowMs
      ) {
        v2Dispatches.delete(key);
      }
    }
  }

  function identityKey(identity: Readonly<InvocationIdentity>): string {
    return JSON.stringify([
      identity.sessionId,
      identity.responseId,
      identity.callId,
    ]);
  }

  function invalidObjectId(value: object): bigint {
    let id: bigint | undefined = invalidInputIds.get(value);
    if (id === undefined) {
      nextInvalidInputId += 1n;
      id = nextInvalidInputId;
      invalidInputIds.set(value, id);
    }
    return id;
  }

  function invalidSymbolId(value: symbol): bigint {
    let id: bigint | undefined = invalidSymbolIds.get(value);
    if (id === undefined) {
      nextInvalidInputId += 1n;
      id = nextInvalidInputId;
      invalidSymbolIds.set(value, id);
    }
    return id;
  }

  function invalidPrimitiveDescriptor(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "boolean") return `boolean:${value ? "1" : "0"}`;
    if (typeof value === "string") return `string:${JSON.stringify(value)}`;
    if (typeof value === "bigint") return `bigint:${value}`;
    if (typeof value === "symbol") return `symbol:${invalidSymbolId(value)}`;
    if (typeof value === "number") {
      const encoded: string = Number.isNaN(value)
        ? "NaN"
        : value === Number.POSITIVE_INFINITY
          ? "+Infinity"
          : value === Number.NEGATIVE_INFINITY
            ? "-Infinity"
            : Object.is(value, -0)
              ? "-0"
              : String(value);
      return `number:${encoded}`;
    }
    return `type:${typeof value}`;
  }

  function invalidInputDescriptor(value: unknown): string {
    const seen: WeakSet<object> = new WeakSet<object>();
    const budget = { remaining: 10_000 };

    const visit = (current: unknown): string => {
      if (
        (typeof current !== "object" || current === null) &&
        typeof current !== "function"
      ) {
        return invalidPrimitiveDescriptor(current);
      }

      const objectValue: object = current as object;
      const id: bigint = invalidObjectId(objectValue);
      if (seen.has(objectValue)) return `ref:${id}`;
      if (budget.remaining <= 0) return `object:${id}:budget`;
      budget.remaining -= 1;
      seen.add(objectValue);

      let prototype: object | null;
      let keys: readonly PropertyKey[];
      try {
        prototype = Object.getPrototypeOf(objectValue) as object | null;
        keys = Reflect.ownKeys(objectValue);
      } catch {
        return `object:${id}:unreadable`;
      }
      if (keys.length > MAX_V2_BATCH_CALLS) {
        return `object:${id}:keys:${keys.length}:over-limit`;
      }

      const prototypeDescriptor: string = prototype === null
        ? "null"
        : `object:${invalidObjectId(prototype)}`;
      const parts: string[] = [];
      for (const key of keys) {
        if (budget.remaining <= 0) {
          parts.push("budget");
          break;
        }
        budget.remaining -= 1;
        const keyDescriptor: string = typeof key === "symbol"
          ? `symbol:${invalidSymbolId(key)}`
          : `string:${JSON.stringify(key)}`;
        let descriptor: PropertyDescriptor | undefined;
        try {
          descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
        } catch {
          parts.push(`${keyDescriptor}=unreadable`);
          continue;
        }
        if (descriptor === undefined) {
          parts.push(`${keyDescriptor}=missing`);
          continue;
        }
        const flags: string = `${descriptor.enumerable === true ? "e" : "-"}${descriptor.configurable === true ? "c" : "-"}`;
        if ("value" in descriptor) {
          parts.push(
            `${keyDescriptor}=data:${flags}${descriptor.writable === true ? "w" : "-"}:${visit(descriptor.value)}`,
          );
        } else {
          const getter: string = descriptor.get === undefined
            ? "none"
            : `object:${invalidObjectId(descriptor.get)}`;
          const setter: string = descriptor.set === undefined
            ? "none"
            : `object:${invalidObjectId(descriptor.set)}`;
          parts.push(`${keyDescriptor}=accessor:${flags}:${getter}:${setter}`);
        }
      }
      return `object:${id}:prototype:${prototypeDescriptor}:{${parts.join(",")}}`;
    };

    return `[concierge:invalid-input:${visit(value)}]`;
  }

  function unreadablePropertyDescriptor(source: object, key: string): string {
    const sourceId: bigint = invalidObjectId(source);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(source, key);
    } catch {
      return `[concierge:unreadable-property:${sourceId}:${key}:unreadable]`;
    }
    if (descriptor === undefined) {
      return `[concierge:unreadable-property:${sourceId}:${key}:inherited]`;
    }
    if ("value" in descriptor) {
      return `[concierge:unreadable-property:${sourceId}:${key}:data:${invalidInputDescriptor(descriptor.value)}]`;
    }
    const getter: string = descriptor.get === undefined
      ? "none"
      : String(invalidObjectId(descriptor.get));
    const setter: string = descriptor.set === undefined
      ? "none"
      : String(invalidObjectId(descriptor.set));
    return `[concierge:unreadable-property:${sourceId}:${key}:accessor:${getter}:${setter}]`;
  }

  function observedPropertyDescriptor(
    source: object | null,
    key: string,
    readable: boolean,
    value: unknown,
  ): string {
    return readable
      ? invalidInputDescriptor(value)
      : source === null
        ? `[concierge:unreadable-property:none:${key}]`
        : unreadablePropertyDescriptor(source, key);
  }

  function rejectedV2Dispatch(
    ctx: StageContext,
    resolution: AtomicCatalogResolution,
    name: string | null,
    identity: Readonly<InvocationIdentity> | null,
    meta: InvocationMeta,
    result: ActionResult,
    inherited?: Readonly<{
      root: WorkflowRootState;
      lineage: DispatchLineage;
    }>,
  ): Promise<ActionResult> {
    const executionState: DispatchExecutionState =
      inherited?.root.executionState ?? { terminalEntered: false };
    const occurrence: V2Occurrence = inherited === undefined
      ? rootOccurrence(ctx, resolution, meta, executionState, identity)
      : {
          context: ctx,
          dispatchId: allocateDispatchId(),
          identity,
          lineage: inherited.lineage,
          meta,
          resolution,
          root: inherited.root,
        };
    emitDispatch({
      dispatchId: occurrence.dispatchId,
      name,
      stage: resolution.resolved.stage,
      catalogRevision: resolution.resolved.revision,
      identity,
      lineage: occurrence.lineage,
      input: DROPPED_INPUT,
      terminalAction: false,
      terminalEntered: inherited?.root.terminalRef !== null &&
        inherited?.root.terminalRef !== undefined,
      phase: eventTerminalPhase(result),
      result: observedResultStatus(result),
      resultData: observedResultDataFor(null, result),
    });
    return trackDispatchPromise(Promise.resolve(result), executionState);
  }

  function rejectedV2DispatchWithIdentity(
    ctx: StageContext,
    resolution: AtomicCatalogResolution,
    name: string,
    identity: Readonly<InvocationIdentity>,
    meta: InvocationMeta,
    revision: CatalogRevision,
    inputDescriptor: string,
    result: ActionResult,
  ): Promise<ActionResult> {
    const key: string = identityKey(identity);
    const descriptor: V2DedupeDescriptor = {
      revision,
      name,
      input: inputDescriptor,
      outputIndex: identity.outputIndex,
      userTurnId: identity.userTurnId,
    };
    v2Dispatches ??= new Map<string, V2DedupeRecord>();
    sweepV2Dispatches(Date.now());
    const existing: V2DedupeRecord | undefined = v2Dispatches.get(key);
    if (existing !== undefined) {
      return dedupeDescriptorEquals(existing.descriptor, descriptor)
        ? existing.promise
        : rejectedV2Dispatch(
            ctx,
            resolution,
            name,
            identity,
            meta,
            authoredResult(
              false,
              "The invocation identity was reused for a different call.",
              "identity_conflict",
            ),
          );
    }
    return cacheV2Dispatch(
      key,
      descriptor,
      rejectedV2Dispatch(ctx, resolution, name, identity, meta, result),
    );
  }

  function cacheV2Dispatch(
    key: string,
    descriptor: V2DedupeDescriptor,
    promise: Promise<ActionResult>,
  ): Promise<ActionResult> {
    v2Dispatches ??= new Map<string, V2DedupeRecord>();
    const record: V2DedupeRecord = {
      descriptor,
      promise,
      pending: true,
      settledAt: null,
    };
    v2Dispatches.set(key, record);
    const settle = (): void => {
      if (v2Dispatches?.get(key) !== record) return;
      record.pending = false;
      record.settledAt = Date.now();
    };
    void promise.then(settle, settle);
    return promise;
  }

  function dispatchV2FromSnapshot(
    ctx: StageContext,
    request: Extract<DispatchRequestSnapshot, { readonly ok: true }>,
    resolution: AtomicCatalogResolution,
    inherited?: Readonly<{
      root: WorkflowRootState;
      lineage: DispatchLineage;
    }>,
  ): Promise<ActionResult> {
    const inputKey: string | null = encodeInvocationValue(request.input);
    if (inputKey === null) {
      const rejected: Promise<ActionResult> = rejectedV2Dispatch(
        ctx,
        resolution,
        request.name,
        request.identity,
        request.meta,
        authoredResult(false, "The action arguments are invalid.", "invalid_args"),
        inherited,
      );
      if (request.identity === null) return rejected;
      return cacheV2Dispatch(
        identityKey(request.identity),
        {
          revision: request.revision,
          name: request.name,
          input: invalidInputDescriptor(request.input),
          outputIndex: request.identity.outputIndex,
          userTurnId: request.identity.userTurnId,
        },
        rejected,
      );
    }

    let key: string | null = null;
    let descriptor: V2DedupeDescriptor | null = null;
    if (request.identity !== null) {
      key = identityKey(request.identity);
      descriptor = {
        revision: request.revision,
        name: request.name,
        input: inputKey,
        outputIndex: request.identity.outputIndex,
        userTurnId: request.identity.userTurnId,
      };
      v2Dispatches ??= new Map<string, V2DedupeRecord>();
      sweepV2Dispatches(Date.now());
      const existing: V2DedupeRecord | undefined = v2Dispatches.get(key);
      if (existing !== undefined) {
        if (dedupeDescriptorEquals(existing.descriptor, descriptor)) {
          return existing.promise;
        }
        return rejectedV2Dispatch(
          ctx,
          resolution,
          request.name,
          request.identity,
          request.meta,
          authoredResult(
            false,
            "The invocation identity was reused for a different call.",
            "identity_conflict",
          ),
          inherited,
        );
      }
    }

    // Retry identity is authoritative before live-catalog admission. An exact
    // retry must retain Promise identity even after the catalog advances, while
    // reusing the same tuple with any changed descriptor is a conflict rather
    // than a stale-catalog result.
    if (request.revision !== resolution.resolved.revision) {
      const rejected: Promise<ActionResult> = rejectedV2Dispatch(
        ctx,
        resolution,
        resolution.names.includes(request.name) ? request.name : null,
        request.identity,
        request.meta,
        authoredResult(
          false,
          "The available actions changed before this call was accepted.",
          "catalog_stale",
        ),
        inherited,
      );
      return key === null || descriptor === null
        ? rejected
        : cacheV2Dispatch(key, descriptor, rejected);
    }

    if (!resolution.names.includes(request.name)) {
      const rejected: Promise<ActionResult> = rejectedV2Dispatch(
        ctx,
        resolution,
        null,
        request.identity,
        request.meta,
        authoredResult(
          false,
          "This action is not available in the current stage.",
          "unknown_action",
        ),
        inherited,
      );
      return key === null || descriptor === null
        ? rejected
        : cacheV2Dispatch(key, descriptor, rejected);
    }
    const entry: CatalogEntry | undefined = catalog.byName[request.name];
    if (entry === undefined) {
      const rejected: Promise<ActionResult> = rejectedV2Dispatch(
        ctx,
        resolution,
        null,
        request.identity,
        request.meta,
        authoredResult(
          false,
          "This action is not available in the current stage.",
          "unknown_action",
        ),
        inherited,
      );
      return key === null || descriptor === null
        ? rejected
        : cacheV2Dispatch(key, descriptor, rejected);
    }

    const executionState: DispatchExecutionState =
      inherited?.root.executionState ?? { terminalEntered: false };
    const occurrence: V2Occurrence = inherited === undefined
      ? rootOccurrence(
          ctx,
          resolution,
          request.meta,
          executionState,
          request.identity,
        )
      : {
          context: ctx,
          dispatchId: allocateDispatchId(),
          identity: request.identity,
          lineage: inherited.lineage,
          meta: request.meta,
          resolution,
          root: inherited.root,
        };
    const promise: Promise<ActionResult> = Promise.resolve().then(() =>
      runDispatchPipeline(
        resolution.index,
        entry,
        request.name,
        request.input,
        request.meta,
        false,
        executionState,
        occurrence,
      ),
    );
    trackDispatchPromise(promise, executionState);

    if (key !== null && descriptor !== null && v2Dispatches !== null) {
      cacheV2Dispatch(key, descriptor, promise);
    }
    return promise;
  }

  /** v2 public dispatch; deliberately not async so retries share a Promise. */
  function dispatchV2(
    ctx: StageContext,
    request: DispatchRequest,
  ): Promise<ActionResult> {
    const resolution: AtomicCatalogResolution = resolveForIndex(
      resolveIndex(ctx),
      ctx,
    );
    const envelope: DispatchEnvelopeSnapshot = snapshotDispatchEnvelope(request);
    if (!envelope.ok) {
      return rejectedV2Dispatch(
        ctx,
        resolution,
        null,
        null,
        Object.freeze({}),
        authoredResult(
          false,
          "The invocation identity is invalid.",
          "invalid_invocation",
        ),
      );
    }

    const detached: InvocationValueSnapshot = envelope.inputReadable
      ? snapshotInvocationValue(envelope.rawInput)
      : { ok: false };
    const encoded: string | null = detached.ok
      ? encodeInvocationValue(detached.value)
      : null;
    const inputDescriptor: string = encoded ?? (
      envelope.inputReadable
        ? invalidInputDescriptor(envelope.rawInput)
        : unreadablePropertyDescriptor(envelope.source, "input")
    );

    // A reused tuple is resolved before input snapshotting. This preserves the
    // exact cached Promise for an exact retry and classifies every changed or
    // unencodable retry descriptor as an identity conflict.
    if (envelope.identity !== null) {
      v2Dispatches ??= new Map<string, V2DedupeRecord>();
      sweepV2Dispatches(Date.now());
      const existing: V2DedupeRecord | undefined = v2Dispatches.get(
        identityKey(envelope.identity),
      );
      if (existing !== undefined) {
        if (
          dedupeDescriptorEquals(existing.descriptor, {
            revision: envelope.revision,
            name: envelope.name,
            input: inputDescriptor,
            outputIndex: envelope.identity.outputIndex,
            userTurnId: envelope.identity.userTurnId,
          })
        ) {
          return existing.promise;
        }
        return rejectedV2Dispatch(
          ctx,
          resolution,
          envelope.name,
          envelope.identity,
          envelope.meta,
          authoredResult(
            false,
            "The invocation identity was reused for a different call.",
            "identity_conflict",
          ),
        );
      }
    }

    if (!detached.ok || encoded === null) {
      const result: ActionResult = authoredResult(
        false,
        "The action arguments are invalid.",
        "invalid_args",
      );
      if (envelope.identity !== null) {
        return rejectedV2DispatchWithIdentity(
          ctx,
          resolution,
          envelope.name,
          envelope.identity,
          envelope.meta,
          envelope.revision,
          inputDescriptor,
          result,
        );
      }
      return rejectedV2Dispatch(
        ctx,
        resolution,
        envelope.name,
        null,
        envelope.meta,
        result,
      );
    }
    return dispatchV2FromSnapshot(ctx, {
      ok: true,
      name: envelope.name,
      input: detached.value,
      revision: envelope.revision,
      identity: envelope.identity,
      meta: envelope.meta,
    }, resolution);
  }

  /** Execute an ordered v2 batch and expose terminal control explicitly. */
  async function dispatchBatchV2(
    ctx: StageContext,
    batch: ToolBatch,
  ): Promise<BatchDispatchOutcome> {
    const resolution: AtomicCatalogResolution = resolveForIndex(
      resolveIndex(ctx),
      ctx,
    );

    const sessionIdRead: GuardedValue = guardedValue(() => batch.sessionId);
    const responseIdRead: GuardedValue = guardedValue(() => batch.responseId);
    const revisionRead: GuardedValue = guardedValue(() => batch.catalogRevision);
    const userTurnIdRead: GuardedValue = guardedValue(() => batch.userTurnId);
    const signalRead: GuardedValue = guardedValue(() => batch.signal);
    const deliveryRead: GuardedValue = guardedValue(
      () => batch.deferUntilDelivered,
    );
    const callsRead: GuardedValue = guardedValue(() => batch.calls);
    const sessionId: unknown = sessionIdRead.value;
    const responseId: unknown = responseIdRead.value;
    const revision: unknown = revisionRead.value;
    const userTurnId: unknown = userTurnIdRead.value;
    const signal: unknown = signalRead.value;
    const deferUntilDelivered: unknown = deliveryRead.value;
    const callsSnapshot: V2CallsSnapshot = snapshotV2Calls(callsRead.value);
    const calls: ReadonlyArray<V2CallSnapshot> = callsSnapshot.calls;

    const duplicateIndexes: Set<number> = new Set<number>();
    for (let index: number = 1; index < calls.length; index += 1) {
      if (
        calls[index]?.sortIndex !== null &&
        calls[index]?.sortIndex === calls[index - 1]?.sortIndex
      ) {
        duplicateIndexes.add(calls[index]?.sortIndex ?? -1);
      }
    }

    const invalidBatchCallDescriptor = (
      call: V2CallSnapshot,
      envelopeInvalid: boolean,
    ): string => JSON.stringify({
      kind: envelopeInvalid ? "invalid-batch-envelope" : "invalid-call",
      callId: observedPropertyDescriptor(
        call.source,
        "callId",
        call.callIdReadable,
        call.rawCallId,
      ),
      name: observedPropertyDescriptor(
        call.source,
        "name",
        call.nameReadable,
        call.rawName,
      ),
      arguments: observedPropertyDescriptor(
        call.source,
        "arguments",
        call.argumentsReadable,
        call.rawArguments,
      ),
      outputIndex: observedPropertyDescriptor(
        call.source,
        "outputIndex",
        call.outputIndexReadable,
        call.rawOutputIndex,
      ),
    });

    const rows: DispatchRow[] = [];
    const invalidEnvelope: boolean =
      !sessionIdRead.ok ||
      !responseIdRead.ok ||
      !revisionRead.ok ||
      !userTurnIdRead.ok ||
      !signalRead.ok ||
      !deliveryRead.ok ||
      !callsRead.ok ||
      !callsSnapshot.ok ||
      !isSafeIdentifier(sessionId) ||
      !isSafeIdentifier(responseId) ||
      typeof revision !== "symbol" ||
      !isSafeIdentifier(userTurnId) ||
      (signal !== undefined && !isAbortSignalLike(signal)) ||
      (deferUntilDelivered !== undefined && typeof deferUntilDelivered !== "function") ||
      duplicateIndexes.size > 0;
    if (invalidEnvelope) {
      if (calls.length === 0) {
        const result: ActionResult = authoredResult(
          false,
          "The invocation metadata is invalid.",
          "invalid_invocation",
        );
        const promise: Promise<ActionResult> = rejectedV2Dispatch(
          ctx,
          resolution,
          null,
          null,
          Object.freeze({}),
          result,
        );
        const correlated: ActionResult = await promise;
        const state: DispatchExecutionState | undefined =
          dispatchExecutionStates?.get(promise);
        return Object.freeze({
          kind: "completed",
          rows: Object.freeze([Object.freeze({
            dispatchId: state?.rootDispatchId ?? allocateDispatchId(),
            callId: fallbackCallId(0),
            name: fallbackActionName(0),
            outputIndex: fallbackOutputIndex(0),
            result: correlated,
          })]),
        });
      }
      for (const call of calls) {
        const result: ActionResult = authoredResult(
          false,
          "The invocation metadata is invalid.",
          "invalid_invocation",
        );
        const canCorrelate: boolean =
          isSafeIdentifier(sessionId) &&
          isSafeIdentifier(responseId) &&
          typeof revision === "symbol" &&
          isSafeIdentifier(userTurnId) &&
          call.callIdValid &&
          call.outputIndexValid;
        const identity: InvocationIdentity | null = canCorrelate
          ? Object.freeze({
              sessionId: sessionId as string,
              responseId: responseId as string,
              callId: call.callId,
              userTurnId: userTurnId as string,
              outputIndex: call.outputIndex,
            })
          : null;
        const meta: InvocationMeta = identity === null
          ? Object.freeze({})
          : Object.freeze({
              responseId,
              userTurnId,
              callId: call.callId,
              outputIndex: call.outputIndex,
            });
        const promise: Promise<ActionResult> = identity === null
          ? rejectedV2Dispatch(
              ctx,
              resolution,
              call.name,
              null,
              meta,
              result,
            )
          : rejectedV2DispatchWithIdentity(
              ctx,
              resolution,
              call.name,
              identity,
              meta,
              revision as CatalogRevision,
              invalidBatchCallDescriptor(call, true),
              result,
            );
        const correlated: ActionResult = await promise;
        const state: DispatchExecutionState | undefined =
          dispatchExecutionStates?.get(promise);
        rows.push(Object.freeze({
          dispatchId: state?.rootDispatchId ?? allocateDispatchId(),
          callId: call.callId,
          name: call.name,
          outputIndex: call.outputIndex,
          result: correlated,
        }));
      }
      return Object.freeze({ kind: "completed", rows: Object.freeze(rows) });
    }

    for (const call of calls) {
      const identity: InvocationIdentity = Object.freeze({
        sessionId: sessionId as string,
        responseId: responseId as string,
        callId: call.callId,
        userTurnId: userTurnId as string,
        outputIndex: call.outputIndex,
      });
      const meta: InvocationMeta = Object.freeze({
        responseId: responseId as string,
        userTurnId: userTurnId as string,
        callId: call.callId,
        outputIndex: call.outputIndex,
        signal: signal as AbortSignalLike | undefined,
        deferUntilDelivered:
          deferUntilDelivered as InvocationMeta["deferUntilDelivered"],
      });
      if (!call.valid || call.argumentsText === null) {
        const invalid: ActionResult = authoredResult(
          false,
          "The invocation metadata is invalid.",
          "invalid_invocation",
        );
        const promise: Promise<ActionResult> =
          call.callIdValid && call.outputIndexValid
            ? rejectedV2DispatchWithIdentity(
                ctx,
                resolution,
                call.name,
                identity,
                meta,
                revision as CatalogRevision,
                invalidBatchCallDescriptor(call, false),
                invalid,
              )
            : rejectedV2Dispatch(
                ctx,
                resolution,
                call.nameValid ? call.name : null,
                null,
                meta,
                invalid,
              );
        const result: ActionResult = await promise;
        const state: DispatchExecutionState | undefined =
          dispatchExecutionStates?.get(promise);
        rows.push(Object.freeze({
          dispatchId: state?.rootDispatchId ?? allocateDispatchId(),
          callId: call.callId,
          name: call.name,
          outputIndex: call.outputIndex,
          result,
        }));
        continue;
      }

      let input: unknown;
      let parseFailed: boolean = false;
      try {
        input = JSON.parse(call.argumentsText);
      } catch {
        input = undefined;
        parseFailed = true;
      }
      const request: DispatchRequest = {
        name: call.name,
        input,
        catalogRevision: revision as CatalogRevision,
        identity,
        signal: signal as AbortSignalLike | undefined,
        deferUntilDelivered:
          deferUntilDelivered as InvocationMeta["deferUntilDelivered"],
      };
      let promise: Promise<ActionResult>;
      if (parseFailed) {
        promise = rejectedV2DispatchWithIdentity(
          ctx,
          resolution,
          call.name,
          identity,
          meta,
          revision as CatalogRevision,
          `[concierge:malformed-json:${call.argumentsText}]`,
          authoredResult(false, "The action arguments are invalid.", "invalid_args"),
        );
      } else {
        const snapshot: DispatchRequestSnapshot = snapshotDispatchRequest(request);
        promise = snapshot.ok
          ? dispatchV2FromSnapshot(ctx, snapshot, resolution)
          : rejectedV2DispatchWithIdentity(
              ctx,
              resolution,
              call.name,
              identity,
              meta,
              revision as CatalogRevision,
              `[concierge:parsed-invalid:${call.argumentsText}]`,
              authoredResult(
                false,
                "The action arguments are invalid.",
                "invalid_args",
              ),
            );
      }
      const result: ActionResult = await promise;
      const state: DispatchExecutionState | undefined =
        dispatchExecutionStates?.get(promise);
      const dispatchId: string = state?.rootDispatchId ?? allocateDispatchId();
      rows.push(Object.freeze({
        dispatchId,
        callId: call.callId,
        name: call.name,
        outputIndex: call.outputIndex,
        result,
      }));
      if (state?.terminalEntered === true) {
        const enteredBy: DispatchRef = state.terminalRef ?? Object.freeze({
          dispatchId,
          name: call.name,
          callId: call.callId,
          outputIndex: call.outputIndex,
          lineage: Object.freeze({ rootDispatchId: dispatchId, depth: 0 }),
        });
        return Object.freeze({
          kind: "terminal",
          rows: Object.freeze(rows),
          enteredBy,
        });
      }
    }
    return Object.freeze({ kind: "completed", rows: Object.freeze(rows) });
  }

  /**
   * DX-01's three questions — which stage is active, which bridges are
   * registered, and what the agent can currently see — answered in one pass.
   *
   * **The returned object is deliberately NOT identity-stable: a fresh object
   * every call, by design.** Do not wire it into `useSyncExternalStore` or any other
   * referential-equality subscription — it would loop forever, which is
   * precisely the defect STG-04's memo exists to prevent. The requirement that
   * motivates this whole phase is one line away from being violated by the
   * phase's own diagnostic, so the non-identity is stated rather than left to
   * be inferred. Memoizing it to make such a call site work would be worse
   * still: it would hand a devtools panel a snapshot that silently stops
   * tracking the app.
   */
  function explain(ctx: StageContext): Explanation {
    // **`stages.map(...)` and not a `for…of`**, because `map` evaluates every
    // matcher exactly once and structurally cannot short-circuit.
    //
    // That is the property DX-01 needs. The single most likely answer to "why
    // didn't my action fire" in a multi-stage app is *an earlier stage shadowed
    // yours* — and a short-circuiting `explain` reports `matched: false` for
    // the shadowed stage, which is not a measurement at all. It is "we never
    // asked", rendered as a negative, at the exact moment the developer is
    // trusting the tool over their own reading of the code. Running every
    // matcher turns the commonest failure into a visible two-`true` row set.
    //
    // The cost is one extra matcher call per stage, on a call that happens at
    // human debugging rate. The accepted consequence, recorded rather than
    // hidden: a matcher with a side effect fires more often under `explain`
    // than under ordinary first-match resolution. Matchers are pure by contract, so this is a
    // consequence of violating the contract rather than of this decision.
    const rows: StageExplanation[] = stages.map(
      (stage): StageExplanation => ({
        id: stage.id,
        matched: runMatch(stage, ctx),
        bridge: bridgeStatus(stage),
      }),
    );

    // **The active position is derived from the recorded rows, never from a
    // second matcher evaluation.** Re-resolving the stage here would re-run
    // matchers, and consumer code is under no obligation to answer the same way
    // twice. Measured, with a matcher carrying an internal counter:
    //
    //     two-pass: {"stage":"flaky","stages":[{"id":"flaky","matched":false}]}
    //     one-pass: {"stage":"flaky","stages":[{"id":"flaky","matched":true}]}
    //
    // The two-pass row set contradicts its own header. A diagnostic that
    // contradicts itself is worse than no diagnostic, because the developer
    // stops debugging their app and starts debugging the tool.
    const firstMatch: number = rows.findIndex((row) => row.matched);
    const activeIndex: number | null = firstMatch === -1 ? null : firstMatch;

    // Availability is evaluated against the already-selected position so the
    // explanation and resolved catalog use the same dynamic filtering rules
    // without a second matcher pass.
    //
    // **`explain` writes nothing to the console.** Structured return only, no
    // warning of its own. (`runMatch` may
    // still warn about a broken matcher during this call — that is the matcher
    // policy firing, not `explain` printing.)
    //
    // The result is deep-frozen through `catalog.ts`'s own walk rather than a
    // hand-written one. Six lines that would have to independently reproduce a
    // cycle-safe `WeakSet`, an accessor skip that does not invoke getters, and
    // a documented refusal to early-out on `Object.isFrozen` is not a saving —
    // those are three properties a re-implementation rediscovers as bug
    // reports.
    const visible: AtomicCatalogResolution = resolveForIndex(activeIndex, ctx);
    const activeStage: ConciergeConfig["stages"][number] | undefined =
      activeIndex === null ? undefined : stages[activeIndex];
    const actionRows: ActionExplanation[] = visible.names.flatMap(
      (name): ActionExplanation[] => {
        const entry: CatalogEntry | undefined = catalog.byName[name];
        return entry === undefined
          ? []
          : [{
              name,
              bridge: actionBridgeStatus(entry.action, activeStage),
            }];
      },
    );
    return deepFreeze(
      {
        stage: activeIndex === null ? null : (stages[activeIndex]?.id ?? null),
        stages: rows,
        actions: actionRows,
        catalog: visible.names,
      },
      NO_SKIP,
      new WeakSet<object>(),
    );
  }

  // **The returned object is deliberately NOT frozen**, and this is recorded so
  // a reviewer does not add the freeze silently as a tidy-up.
  //
  // SEC-03 names the action *registry*, which is frozen — `catalog.byName`, the
  // per-action tool, the lookup and every projection. The `Concierge` object is
  // not part of that registry: it is the handle the consumer's own code holds,
  // and page script that can reach it can already reach the module that made
  // it. `dispatchBatch` and `ServerSafeConcierge` are still scheduled to widen
  // this object's shape, so freezing now would harden a surface that is not
  // final against an attacker who is not constrained by it.
  //
  // Deliberately NOT justified by a count of anything. An earlier draft argued
  // the freeze would disturb a mutation battery that depends on a particular
  // number of seals in this file; that argument was arithmetically wrong, and
  // a wrong reason attached to a right decision is how a right decision gets
  // reversed by the first reader who checks it.
  const concierge: Concierge = {
    dispatch: dispatchV2,
    dispatchBatch: dispatchBatchV2,
    resolveCatalog,
    onDispatch,
    explain,
  };
  const configuredConcierge: Concierge =
    attachConsentProfile(concierge, capturedConsent.profile);
  return configuredConcierge;
}
