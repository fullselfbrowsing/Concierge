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

/**
 * Derive the namespaced key for one call without ever throwing.
 *
 * `callId` is authoritative when present. Otherwise the action name and the
 * serialized arguments form the retry key. `JSON.stringify` is application
 * code in practice — cycles, BigInts, and a throwing `toJSON` can all reject
 * the operation — so failure deliberately means "run without deduplication",
 * not "reject the dispatch".
 */
export function deriveDispatchKey(
  name: string,
  args: unknown,
  meta: InvocationMeta | undefined,
  authorizationScope: number | null,
): string | null {
  try {
    const callId: string | undefined = meta?.callId;
    if (callId !== undefined) {
      return `id:${callId}`;
    }
    const scope: string = authorizationScope === null ? "cross" : String(authorizationScope);
    return `args:${scope}:${name}:${JSON.stringify(args)}`;
  } catch {
    return null;
  }
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
    const result = await entry.action.schema["~standard"].validate(args);
    if (result.issues !== undefined) {
      return { ok: false };
    }
    return { ok: true, value: result.value };
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
  return reason === undefined
    ? { ok, message: sanitized }
    : { ok, reason, message: sanitized };
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
  ) => Promise<ActionResult>,
): Promise<ReadonlyArray<Readonly<{ callId: string; result: ActionResult }>>> {
  const batchSnapshot: Readonly<{
    responseId: string;
    userTurnId: string | undefined;
    signal: AbortSignalLike | undefined;
    deferUntilDelivered: InvocationMeta["deferUntilDelivered"];
  }> = Object.freeze({
    responseId: batch.responseId,
    userTurnId: batch.userTurnId,
    signal: batch.signal,
    deferUntilDelivered: batch.deferUntilDelivered,
  });
  const ordered: Array<{
    readonly call: Readonly<{
      callId: string;
      name: string;
      arguments: string;
      outputIndex: number;
    }>;
    readonly originalIndex: number;
  }> = batch.calls.map((call, originalIndex) => ({
    call: Object.freeze({
      callId: call.callId,
      name: call.name,
      arguments: call.arguments,
      outputIndex: call.outputIndex,
    }),
    originalIndex,
  }));
  ordered.sort(
    (left, right): number =>
      left.call.outputIndex - right.call.outputIndex ||
      left.originalIndex - right.originalIndex,
  );

  const rows: Array<Readonly<{ callId: string; result: ActionResult }>> = [];
  for (const { call } of ordered) {
    let result: ActionResult;
    if (isAborted(batchSnapshot.signal)) {
      result = authoredResult(
        false,
        "The action was cancelled before it ran.",
        "aborted",
      );
    } else {
      let args: unknown;
      try {
        args = JSON.parse(call.arguments);
      } catch {
        args = {};
      }

      const meta: InvocationMeta = {
        responseId: batchSnapshot.responseId,
        callId: call.callId,
        outputIndex: call.outputIndex,
        userTurnId: batchSnapshot.userTurnId,
        signal: batchSnapshot.signal,
        deferUntilDelivered: batchSnapshot.deferUntilDelivered,
      };
      result = await dispatch(ctx, call.name, args, meta);
    }

    rows.push(Object.freeze({ callId: call.callId, result }));
  }

  return Object.freeze(rows);
}
