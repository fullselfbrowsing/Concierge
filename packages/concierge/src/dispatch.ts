/**
 * Stateless dispatcher helpers.
 *
 * The Concierge factory owns every mutable latch and cache. This module owns
 * only the boundaries that must behave identically on every call: key
 * derivation, Standard Schema validation, the cancellable commit wait, and the
 * final result normalizer. Keeping those boundaries here also keeps their
 * catches narrow — a validator failure cannot be mislabeled as a handler
 * crash, and a hostile result getter cannot escape as a rejected dispatch.
 */

import { sanitizeMessage } from "./message.js";
import { validateCatalogEntry } from "./catalog.js";
import type { CatalogEntry } from "./catalog.js";
import type {
  AbortSignalLike,
  ActionResult,
  InvocationMeta,
  ReasonCode,
  Scheduler,
  StageContext,
  ToolBatch,
} from "./types.js";

export type InvocationValueSnapshot =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false };

/** Clone the plain-data invocation boundary without retaining caller aliases. */
function cloneInvocationValue(
  value: unknown,
  seen: WeakMap<object, unknown>,
): unknown {
  if (value === null || typeof value !== "object") {
    if (typeof value === "function" || typeof value === "symbol") {
      throw new TypeError("Invocation values must be data.");
    }
    return value;
  }

  const existing: unknown = seen.get(value);
  if (existing !== undefined) {
    return existing;
  }

  if (Array.isArray(value)) {
    const clone: unknown[] = new Array<unknown>(value.length);
    seen.set(value, clone);
    for (let index: number = 0; index < value.length; index += 1) {
      if (Object.prototype.hasOwnProperty.call(value, index)) {
        clone[index] = cloneInvocationValue(value[index], seen);
      }
    }
    return clone;
  }

  const prototype: object | null = Object.getPrototypeOf(value);
  if (prototype !== null && Object.getPrototypeOf(prototype) !== null) {
    throw new TypeError("Invocation values must use plain objects.");
  }

  const clone: Record<string, unknown> = Object.create(
    prototype === null ? null : Object.prototype,
  ) as Record<string, unknown>;
  seen.set(value, clone);
  for (const key of Object.keys(value)) {
    Object.defineProperty(clone, key, {
      configurable: true,
      enumerable: true,
      value: cloneInvocationValue((value as Record<string, unknown>)[key], seen),
      writable: true,
    });
  }
  return clone;
}

/** Recursively freeze only objects produced by {@link cloneInvocationValue}. */
function freezeInvocationValue(value: unknown, seen: WeakSet<object>): void {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return;
  }
  seen.add(value);
  for (const key of Object.keys(value)) {
    freezeInvocationValue((value as Record<string, unknown>)[key], seen);
  }
  Object.freeze(value);
}

/** Detach an invocation value, returning a closed failure instead of throwing. */
export function snapshotInvocationValue(
  value: unknown,
  freeze: boolean = false,
): InvocationValueSnapshot {
  try {
    const detached: unknown = cloneInvocationValue(
      value,
      new WeakMap<object, unknown>(),
    );
    if (freeze) {
      freezeInvocationValue(detached, new WeakSet<object>());
    }
    return { ok: true, value: detached };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Deduplication keys
// ---------------------------------------------------------------------------

type CanonicalValue =
  | readonly ["undefined"]
  | readonly ["null"]
  | readonly ["boolean", boolean]
  | readonly ["string", string]
  | readonly ["number", string]
  | readonly ["array", ReadonlyArray<CanonicalValue | readonly ["hole"]>]
  | readonly [
      "object",
      "plain" | "null-prototype",
      ReadonlyArray<readonly [string, CanonicalValue]>,
    ];

/** Build an injective tagged tree for every keyable invocation-data value. */
function canonicalInvocationValue(
  value: unknown,
  seen: WeakSet<object>,
): CanonicalValue {
  if (value === undefined) return ["undefined"];
  if (value === null) return ["null"];
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "string") return ["string", value];
  if (typeof value === "bigint") {
    throw new TypeError("BigInt invocation values are deliberately unkeyable.");
  }
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
    return ["number", encoded];
  }
  if (typeof value !== "object") {
    throw new TypeError("Invocation values must be data.");
  }

  // A repeated reference is observable by a validator or handler. Encoding it
  // as a second structural copy would collide with two genuinely distinct
  // objects, so cyclic and aliased graphs deliberately disable fallback dedupe.
  if (seen.has(value)) {
    throw new TypeError("Aliased invocation graphs cannot be keyed injectively.");
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const slots: Array<CanonicalValue | readonly ["hole"]> = [];
    for (let index: number = 0; index < value.length; index += 1) {
      slots.push(
        Object.prototype.hasOwnProperty.call(value, index)
          ? canonicalInvocationValue(value[index], seen)
          : ["hole"],
      );
    }
    return ["array", slots];
  }

  const prototype: object | null = Object.getPrototypeOf(value);
  const entries: Array<readonly [string, CanonicalValue]> = [];
  for (const key of Object.keys(value)) {
    entries.push([
      key,
      canonicalInvocationValue((value as Record<string, unknown>)[key], seen),
    ]);
  }
  return [
    "object",
    prototype === null ? "null-prototype" : "plain",
    entries,
  ];
}

/** Frame one string without consulting any value or prototype serializer. */
function encodeString(value: string): string {
  return `${value.length}:${value}`;
}

/** Encode the tagged tree with fixed tags and length-prefixed payloads. */
function encodeCanonicalValue(value: CanonicalValue): string {
  switch (value[0]) {
    case "undefined":
      return "u";
    case "null":
      return "z";
    case "boolean":
      return value[1] ? "b1" : "b0";
    case "string":
      return `s${encodeString(value[1])}`;
    case "number":
      return `n${encodeString(value[1])}`;
    case "array": {
      let payload: string = "";
      for (let index: number = 0; index < value[1].length; index += 1) {
        const item: CanonicalValue | readonly ["hole"] | undefined =
          value[1][index];
        if (item === undefined) {
          throw new TypeError("Canonical arrays must be dense.");
        }
        payload +=
          item[0] === "hole"
            ? "h"
            : `v${encodeString(encodeCanonicalValue(item))}`;
      }
      return `a${encodeString(payload)}`;
    }
    case "object": {
      let payload: string = value[1] === "plain" ? "p" : "n";
      for (let index: number = 0; index < value[2].length; index += 1) {
        const entry: readonly [string, CanonicalValue] | undefined =
          value[2][index];
        if (entry === undefined) {
          throw new TypeError("Canonical object entries must be dense.");
        }
        payload += `k${encodeString(entry[0])}v${encodeString(
          encodeCanonicalValue(entry[1]),
        )}`;
      }
      return `o${encodeString(payload)}`;
    }
  }
}

/** Serialize a detached invocation tree without dynamic JSON/toJSON lookup. */
function encodeInvocationValue(value: unknown): string | null {
  try {
    return encodeCanonicalValue(
      canonicalInvocationValue(value, new WeakSet<object>()),
    );
  } catch {
    return null;
  }
}

/**
 * Derive the namespaced key for one call without ever throwing.
 *
 * `callId` is authoritative when present. Otherwise the action name and the
 * tagged argument tree form the retry key. The tags retain distinctions plain
 * JSON erases (`undefined`, holes, non-finite numbers, and negative zero).
 * BigInt values and cyclic or aliased graphs deliberately run without fallback
 * deduplication rather than sharing the wrong Promise.
 */
export function deriveDispatchKey(
  name: string,
  args: unknown,
  meta: InvocationMeta | undefined,
  authorizationScope: number | null,
): string | null {
  let callId: unknown;
  try {
    callId = meta?.callId;
  } catch {
    return null;
  }
  if (callId !== undefined) {
    if (typeof callId !== "string") {
      return null;
    }
    return `id:${callId}`;
  }
  const encodedArgs: string | null = encodeInvocationValue(args);
  if (encodedArgs === null) {
    return null;
  }
  const scope: string = authorizationScope === null ? "cross" : String(authorizationScope);
  return `args:${encodeString(scope)}${encodeString(name)}${encodeString(encodedArgs)}`;
}

// ---------------------------------------------------------------------------
// Standard Schema validation
// ---------------------------------------------------------------------------

export type ArgumentValidation =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false };

/**
 * Validate unknown arguments and retain the validator's output value.
 *
 * Standard Schema permits both synchronous and asynchronous validators. A
 * success may transform or default the input, so the handler must receive
 * `value`, never the original `args`. Every malformed result, thrown getter,
 * synchronous exception, and rejected validator Promise fails closed as
 * `invalid_args` at the caller.
 */
export async function validateArguments(
  entry: CatalogEntry,
  args: unknown,
): Promise<ArgumentValidation> {
  try {
    const result: unknown = await validateCatalogEntry(entry, args);
    if (typeof result !== "object" || result === null) {
      return { ok: false };
    }
    if ("issues" in result || !("value" in result)) {
      return { ok: false };
    }
    return {
      ok: true,
      value: (result as { readonly value: unknown }).value,
    };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Commit-window cancellation
// ---------------------------------------------------------------------------

export type CommitWaitOutcome = "ready" | "aborted" | "unavailable";

/**
 * Read an abort signal defensively.
 *
 * A real AbortSignal has an inert boolean getter. The interface is structural,
 * though, and a JavaScript consumer can supply a throwing getter. Treat that as
 * aborted: running a side effect when cancellation state cannot be established
 * would fail open.
 */
export function isAborted(signal: AbortSignalLike | undefined): boolean {
  if (signal === undefined) {
    return false;
  }
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}

/** Validate the structural cancellation capability without invoking it. */
export function isAbortSignalLike(value: unknown): value is AbortSignalLike {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  try {
    const signal = value as Record<string, unknown>;
    return (
      typeof signal["aborted"] === "boolean" &&
      typeof signal["addEventListener"] === "function" &&
      typeof signal["removeEventListener"] === "function"
    );
  } catch {
    return false;
  }
}

/**
 * Wait until a non-read-only handler may enter.
 *
 * Listener removal and scheduler cancellation are idempotent. The bookkeeping
 * also covers a scheduler that calls `fn` synchronously before returning its
 * canceller, and one that aborts the supplied signal during registration. A
 * missing, throwing, or runtime-malformed scheduler reports `unavailable`; the
 * factory owns the corresponding warn-once policy and then proceeds
 * immediately as the locked fallback requires.
 */
export function waitForCommit(
  scheduler: Scheduler | undefined,
  delayMs: number,
  signal: AbortSignalLike | undefined,
): Promise<CommitWaitOutcome> {
  if (isAborted(signal)) {
    return Promise.resolve("aborted");
  }
  if (scheduler === undefined) {
    return Promise.resolve("unavailable");
  }

  return new Promise<CommitWaitOutcome>((resolve) => {
    let settled: boolean = false;
    let listenerAttached: boolean = false;
    let cancel: (() => void) | null = null;
    let cancelWhenAvailable: boolean = false;

    function detachListener(): void {
      if (!listenerAttached || signal === undefined) {
        return;
      }
      listenerAttached = false;
      try {
        signal.removeEventListener("abort", onAbort);
      } catch {
        // A hostile structural signal cannot reopen an already-settled wait.
      }
    }

    function cancelScheduledWork(): void {
      if (cancel === null) {
        cancelWhenAvailable = true;
        return;
      }
      const current: () => void = cancel;
      cancel = null;
      try {
        current();
      } catch {
        // Cancellation remains final even when the host canceller throws.
      }
    }

    function settle(outcome: CommitWaitOutcome, cancelTimer: boolean): void {
      if (settled) {
        return;
      }
      settled = true;
      detachListener();
      if (cancelTimer) {
        cancelScheduledWork();
      }
      resolve(outcome);
    }

    function onAbort(): void {
      settle("aborted", true);
    }

    if (signal !== undefined) {
      try {
        signal.addEventListener("abort", onAbort);
        listenerAttached = true;
      } catch {
        settle("aborted", false);
        return;
      }

      // Close the race between the first read and listener registration.
      if (isAborted(signal)) {
        settle("aborted", false);
        return;
      }
    }

    try {
      const scheduledCancel: unknown = scheduler(
        (): void => {
          settle("ready", false);
        },
        delayMs,
      );

      if (typeof scheduledCancel !== "function") {
        settle("unavailable", false);
        return;
      }

      cancel = scheduledCancel as () => void;
      if (cancelWhenAvailable) {
        cancelScheduledWork();
      }
    } catch {
      settle("unavailable", false);
    }
  });
}

// ---------------------------------------------------------------------------
// Result normalization and sanitization
// ---------------------------------------------------------------------------

/** Warn-once callbacks owned by one Concierge instance. */
export interface ResultWarnings {
  readonly successReason: () => void;
  readonly reasonlessFailure: () => void;
}

/** Runtime membership check for the closed twelve-code vocabulary. */
export function isReasonCode(value: unknown): value is ReasonCode {
  switch (value) {
    case "declined":
    case "cancelled":
    case "superseded":
    case "invalid_args":
    case "invalid_result":
    case "unknown_action":
    case "no_bridge":
    case "handler_error":
    case "aborted":
    case "consent_required":
    case "consent_stale":
    case "grade_unavailable":
      return true;
    default:
      return false;
  }
}

/** Build a fresh, sanitized result authored by core. */
export function authoredResult(
  ok: boolean,
  message: string,
  reason?: ReasonCode | undefined,
): ActionResult {
  const sanitized: string = sanitizeMessage(message);
  return Object.freeze(
    reason === undefined
      ? { ok, message: sanitized }
      : { ok, reason, message: sanitized },
  );
}

/** The one fixed result for a malformed handler return. */
function invalidResult(): ActionResult {
  return authoredResult(
    false,
    "The action returned an invalid result.",
    "invalid_result",
  );
}

/** Invoke a diagnostic callback without allowing the convenience channel to fail a call. */
function notify(warn: () => void): void {
  try {
    warn();
  } catch {
    // Result integrity does not depend on a host warning channel being healthy.
  }
}

/**
 * Normalize an untrusted handler return into one fresh ActionResult.
 *
 * Only `ok`, `reason`, and `message` are read, each inside the same guarded
 * property boundary. Extra fields never cross into the returned object. A
 * valid reason on a success is stripped because the effect may already have
 * landed; a reasonless failure is preserved because inventing a cause would be
 * dishonest. Both contradictions warn through instance-owned latches.
 */
export function normalizeActionResult(
  value: unknown,
  warnings: ResultWarnings,
): ActionResult {
  if (typeof value !== "object" || value === null) {
    return invalidResult();
  }

  let ok: unknown;
  let reason: unknown;
  let message: unknown;
  try {
    const result = value as Record<string, unknown>;
    ok = result["ok"];
    reason = result["reason"];
    message = result["message"];
  } catch {
    return invalidResult();
  }

  if (typeof ok !== "boolean" || typeof message !== "string") {
    return invalidResult();
  }
  if (reason !== undefined && !isReasonCode(reason)) {
    return invalidResult();
  }

  if (ok) {
    if (reason !== undefined) {
      notify(warnings.successReason);
    }
    return authoredResult(true, message);
  }

  if (reason === undefined) {
    notify(warnings.reasonlessFailure);
    return authoredResult(false, message);
  }

  return authoredResult(false, message, reason);
}

// ---------------------------------------------------------------------------
// Batch execution
// ---------------------------------------------------------------------------

const UNOBSERVABLE_CALL_ID_PREFIX =
  "[concierge:unobservable-call-id:";

type BatchMetadataSnapshot =
  | Readonly<{
      ok: true;
      responseId: string;
      userTurnId: string | undefined;
      signal: AbortSignalLike | undefined;
      deferUntilDelivered: InvocationMeta["deferUntilDelivered"];
    }>
  | Readonly<{ ok: false }>;

type ToolCallSnapshot =
  | Readonly<{
      ok: true;
      callId: string;
      name: string;
      arguments: string;
      outputIndex: number;
      sortIndex: number;
      originalIndex: number;
    }>
  | Readonly<{
      ok: false;
      callId: unknown;
      sortIndex: number | null;
      originalIndex: number;
    }>;

type RuntimeBatchRow = Readonly<{
  callId: unknown;
  result: ActionResult;
}>;

type PropertyRead =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{ ok: false }>;

type UntrustedBatch = Readonly<{
  calls?: unknown;
  responseId?: unknown;
  userTurnId?: unknown;
  signal?: unknown;
  deferUntilDelivered?: unknown;
}>;

type UntrustedToolCall = Readonly<{
  callId?: unknown;
  name?: unknown;
  arguments?: unknown;
  outputIndex?: unknown;
}>;

/** Evaluate one statically named untrusted field without letting its getter escape. */
function guardedRead(read: () => unknown): PropertyRead {
  try {
    return { ok: true, value: read() };
  } catch {
    return { ok: false };
  }
}

/**
 * Correlation fallback for a call whose callId getter cannot be observed.
 *
 * The original array position keeps multiple unreadable calls distinct and
 * deterministic within the batch. Observable malformed values (for example a
 * Symbol callId) are preserved verbatim instead of being replaced by this
 * sentinel.
 */
function unobservableCallId(originalIndex: number): string {
  return `${UNOBSERVABLE_CALL_ID_PREFIX}${originalIndex}]`;
}

/** Narrow the optional delivery capability after its guarded metadata read. */
function isDeliveryHook(
  value: unknown,
): value is NonNullable<InvocationMeta["deferUntilDelivered"]> {
  return typeof value === "function";
}

/** Snapshot batch metadata before any ordering or asynchronous work begins. */
function snapshotBatchMetadata(batch: unknown): BatchMetadataSnapshot {
  if (typeof batch !== "object" || batch === null) {
    return Object.freeze({ ok: false });
  }

  const candidate: UntrustedBatch = batch;
  const responseIdRead: PropertyRead = guardedRead(
    (): unknown => candidate.responseId,
  );
  const userTurnIdRead: PropertyRead = guardedRead(
    (): unknown => candidate.userTurnId,
  );
  const signalRead: PropertyRead = guardedRead(
    (): unknown => candidate.signal,
  );
  const deliveryRead: PropertyRead = guardedRead(
    (): unknown => candidate.deferUntilDelivered,
  );
  if (
    !responseIdRead.ok ||
    !userTurnIdRead.ok ||
    !signalRead.ok ||
    !deliveryRead.ok
  ) {
    return Object.freeze({ ok: false });
  }

  const responseId: unknown = responseIdRead.value;
  const userTurnId: unknown = userTurnIdRead.value;
  const signal: unknown = signalRead.value;
  const deferUntilDelivered: unknown = deliveryRead.value;
  if (
    typeof responseId !== "string" ||
    (userTurnId !== undefined && typeof userTurnId !== "string") ||
    (signal !== undefined && !isAbortSignalLike(signal)) ||
    (deferUntilDelivered !== undefined &&
      !isDeliveryHook(deferUntilDelivered))
  ) {
    return Object.freeze({ ok: false });
  }

  return Object.freeze({
    ok: true,
    responseId,
    userTurnId,
    signal,
    deferUntilDelivered,
  });
}

/** Snapshot one call, preserving observable correlation even when invalid. */
function snapshotToolCall(
  raw: unknown,
  originalIndex: number,
): ToolCallSnapshot {
  if (typeof raw !== "object" || raw === null) {
    return Object.freeze({
      ok: false,
      callId: unobservableCallId(originalIndex),
      sortIndex: null,
      originalIndex,
    });
  }

  const candidate: UntrustedToolCall = raw;
  const callIdRead: PropertyRead = guardedRead(
    (): unknown => candidate.callId,
  );
  const nameRead: PropertyRead = guardedRead((): unknown => candidate.name);
  const argumentsRead: PropertyRead = guardedRead(
    (): unknown => candidate.arguments,
  );
  const outputIndexRead: PropertyRead = guardedRead(
    (): unknown => candidate.outputIndex,
  );
  const callId: unknown = callIdRead.ok
    ? callIdRead.value
    : unobservableCallId(originalIndex);
  const outputIndex: unknown = outputIndexRead.ok
    ? outputIndexRead.value
    : undefined;
  const sortIndex: number | null =
    typeof outputIndex === "number" && Number.isFinite(outputIndex)
      ? outputIndex
      : null;

  if (
    !callIdRead.ok ||
    !nameRead.ok ||
    !argumentsRead.ok ||
    !outputIndexRead.ok ||
    typeof callId !== "string" ||
    typeof nameRead.value !== "string" ||
    typeof argumentsRead.value !== "string" ||
    sortIndex === null
  ) {
    return Object.freeze({
      ok: false,
      callId,
      sortIndex,
      originalIndex,
    });
  }

  return Object.freeze({
    ok: true,
    callId,
    name: nameRead.value,
    arguments: argumentsRead.value,
    outputIndex: sortIndex,
    sortIndex,
    originalIndex,
  });
}

/** Snapshot the observable calls collection; an unreadable collection is empty. */
function snapshotToolCalls(batch: unknown): ReadonlyArray<ToolCallSnapshot> {
  if (typeof batch !== "object" || batch === null) {
    return Object.freeze([]);
  }

  const candidate: UntrustedBatch = batch;
  const callsRead: PropertyRead = guardedRead(
    (): unknown => candidate.calls,
  );
  if (!callsRead.ok) {
    return Object.freeze([]);
  }

  let isArray: boolean;
  try {
    isArray = Array.isArray(callsRead.value);
  } catch {
    return Object.freeze([]);
  }
  if (!isArray) {
    return Object.freeze([]);
  }

  const rawCalls = callsRead.value as ReadonlyArray<unknown>;
  let length: number;
  try {
    length = rawCalls.length;
  } catch {
    return Object.freeze([]);
  }

  const snapshots: ToolCallSnapshot[] = [];
  for (let originalIndex: number = 0; originalIndex < length; originalIndex += 1) {
    let raw: unknown;
    try {
      raw = rawCalls[originalIndex];
    } catch {
      snapshots.push(snapshotToolCall(undefined, originalIndex));
      continue;
    }
    snapshots.push(snapshotToolCall(raw, originalIndex));
  }
  return Object.freeze(snapshots);
}

/** Sort finite indexes stably, then retain original order for invalid indexes. */
function orderToolCallSnapshots(
  snapshots: ReadonlyArray<ToolCallSnapshot>,
): ReadonlyArray<ToolCallSnapshot> {
  const indexed: ToolCallSnapshot[] = [];
  const unindexed: ToolCallSnapshot[] = [];
  for (const snapshot of snapshots) {
    (snapshot.sortIndex === null ? unindexed : indexed).push(snapshot);
  }
  indexed.sort((left, right): number => {
    const leftIndex: number = left.sortIndex ?? 0;
    const rightIndex: number = right.sortIndex ?? 0;
    if (leftIndex < rightIndex) return -1;
    if (leftIndex > rightIndex) return 1;
    return left.originalIndex - right.originalIndex;
  });
  return Object.freeze([...indexed, ...unindexed]);
}

/** Build one immutable runtime row without coercing its correlation value. */
function batchRow(callId: unknown, result: ActionResult): RuntimeBatchRow {
  return Object.freeze({ callId, result });
}

/**
 * Execute one transport-independent batch through an existing single-call
 * dispatcher.
 *
 * The decorated copy makes the tie-break explicit instead of relying on the
 * host sort implementation, and the serial loop keeps the current call as the
 * only call that may enter application code. Calls that have not started when
 * the batch aborts still receive correlated rows, but never reach `dispatch`.
 */
export async function executeDispatchBatch(
  ctx: StageContext,
  batch: ToolBatch,
  dispatch: (
    ctx: StageContext,
    name: string,
    args: unknown,
    meta?: InvocationMeta,
    argumentsMalformed?: boolean,
  ) => Promise<ActionResult>,
): Promise<ReadonlyArray<Readonly<{ callId: string; result: ActionResult }>>> {
  const batchSnapshot: BatchMetadataSnapshot = snapshotBatchMetadata(batch);
  const ordered: ReadonlyArray<ToolCallSnapshot> = orderToolCallSnapshots(
    snapshotToolCalls(batch),
  );

  const rows: RuntimeBatchRow[] = [];
  for (const call of ordered) {
    let result: ActionResult;
    if (!batchSnapshot.ok || !call.ok) {
      result = authoredResult(false, "The invocation metadata is invalid.");
    } else if (isAborted(batchSnapshot.signal)) {
      result = authoredResult(
        false,
        "The action was cancelled before it ran.",
        "aborted",
      );
    } else {
      let args: unknown;
      let argumentsMalformed: boolean = false;
      try {
        args = JSON.parse(call.arguments);
      } catch {
        args = {};
        argumentsMalformed = true;
      }

      const meta: InvocationMeta = {
        responseId: batchSnapshot.responseId,
        callId: call.callId,
        outputIndex: call.outputIndex,
        userTurnId: batchSnapshot.userTurnId,
        signal: batchSnapshot.signal,
        deferUntilDelivered: batchSnapshot.deferUntilDelivered,
      };
      result = await dispatch(
        ctx,
        call.name,
        args,
        meta,
        argumentsMalformed,
      );
    }

    rows.push(batchRow(call.callId, result));
  }

  // Runtime-malformed callers may supply an observable non-string callId, or
  // make it unreadable and receive the documented positional sentinel. The
  // public string contract remains unchanged for every typed ToolBatch.
  return Object.freeze(rows) as ReadonlyArray<
    Readonly<{ callId: string; result: ActionResult }>
  >;
}
