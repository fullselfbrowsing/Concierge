/**
 * Stateless dispatcher helpers.
 *
 * The Concierge factory owns every mutable latch and cache. This module owns
 * only the boundaries that must behave identically on every call: invocation
 * encoding, Standard Schema validation, the cancellable commit wait, and the
 * final result normalizer. Keeping those boundaries here also keeps their
 * catches narrow — a validator failure cannot be mislabeled as a handler
 * crash, and a hostile result getter cannot escape as a rejected dispatch.
 */

import { sanitizeMessage } from "./message.js";
import {
  hasCatalogEntryOutput,
  validateCatalogEntry,
  validateCatalogEntryOutput,
} from "./catalog.js";
import type { CatalogEntry } from "./catalog.js";
import type {
  AbortSignalLike,
  ActionData,
  ActionResult,
  ReasonCode,
  Scheduler,
} from "./types.js";

export type InvocationValueSnapshot =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false };

/**
 * Resource bounds for arrays supplied across public invocation boundaries.
 *
 * Ten thousand entries is deliberately generous for tool arguments while
 * keeping one hostile `length` trap from allocating or looping
 * without bound. These are entry-count limits, not byte limits; nested values
 * still pass through the same bound independently.
 */
const MAX_INVOCATION_ARRAY_LENGTH = 10_000;

type ArrayLengthSnapshot =
  | Readonly<{ ok: true; value: number }>
  | Readonly<{ ok: false }>;

type OwnArraySlotSnapshot =
  | Readonly<{ ok: true; present: false }>
  | Readonly<{ ok: true; present: true; value: unknown }>
  | Readonly<{ ok: false }>;

/** Read one hostile array length exactly once and validate it before use. */
function snapshotArrayLength(
  value: ReadonlyArray<unknown>,
  maximum: number,
): ArrayLengthSnapshot {
  let length: unknown;
  try {
    length = value.length;
  } catch {
    return { ok: false };
  }

  if (
    typeof length !== "number" ||
    !Number.isFinite(length) ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > maximum
  ) {
    return { ok: false };
  }
  return { ok: true, value: length };
}

/**
 * Read one numeric slot without ever traversing the array's prototype.
 *
 * The own-property probe is guarded because a Proxy may throw. The descriptor
 * is then read separately so deletion between the probe and value read becomes
 * a contained failure instead of an inherited lookup. Accessor slots retain
 * ordinary array access semantics, including their receiver, inside the same
 * closed boundary.
 */
function snapshotOwnArraySlot(
  value: ReadonlyArray<unknown>,
  index: number,
): OwnArraySlotSnapshot {
  let own: boolean;
  try {
    own = Object.prototype.hasOwnProperty.call(value, index);
  } catch {
    return { ok: false };
  }
  if (!own) {
    return { ok: true, present: false };
  }

  try {
    const descriptor: PropertyDescriptor | undefined =
      Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined) {
      return { ok: false };
    }
    if ("value" in descriptor) {
      return { ok: true, present: true, value: descriptor.value };
    }
    return {
      ok: true,
      present: true,
      value: descriptor.get?.call(value),
    };
  } catch {
    return { ok: false };
  }
}

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
    const lengthSnapshot: ArrayLengthSnapshot = snapshotArrayLength(
      value,
      MAX_INVOCATION_ARRAY_LENGTH,
    );
    if (!lengthSnapshot.ok) {
      throw new TypeError("Invocation arrays exceed the supported bound.");
    }
    const length: number = lengthSnapshot.value;
    const clone: unknown[] = new Array<unknown>(length);
    seen.set(value, clone);
    for (let index: number = 0; index < length; index += 1) {
      const slot: OwnArraySlotSnapshot = snapshotOwnArraySlot(value, index);
      if (!slot.ok) {
        throw new TypeError("Invocation array slots must be readable.");
      }
      if (slot.present) {
        clone[index] = cloneInvocationValue(slot.value, seen);
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
// Structured action-result data
// ---------------------------------------------------------------------------

export type ActionDataSnapshot =
  | { readonly ok: true; readonly value: ActionData }
  | { readonly ok: false };

interface JsonSizeBudget {
  readonly maximum: number;
  used: number;
}

function addJsonBytes(budget: JsonSizeBudget, count: number): void {
  budget.used += count;
  if (!Number.isSafeInteger(budget.used) || budget.used > budget.maximum) {
    throw new TypeError("Action data exceeds the configured size bound.");
  }
}

/** Count UTF-8 bytes without depending on DOM's TextEncoder. */
function utf8ByteLength(value: string): number {
  let bytes: number = 0;
  for (let index: number = 0; index < value.length; index += 1) {
    const code: number = value.charCodeAt(index);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next: number = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function addQuotedJsonString(budget: JsonSizeBudget, value: string): void {
  const encoded: string | undefined = JSON.stringify(value);
  if (encoded === undefined) {
    throw new TypeError("Action data strings must be JSON encodable.");
  }
  addJsonBytes(budget, utf8ByteLength(encoded));
}

/** Clone only dense, unaliased JSON data while accounting for its wire size. */
function cloneActionData(
  value: unknown,
  seen: WeakSet<object>,
  budget: JsonSizeBudget,
): ActionData {
  if (value === null) {
    addJsonBytes(budget, 4);
    return null;
  }
  if (typeof value === "boolean") {
    addJsonBytes(budget, value ? 4 : 5);
    return value;
  }
  if (typeof value === "string") {
    addQuotedJsonString(budget, value);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Action data numbers must be finite.");
    }
    addJsonBytes(budget, String(Object.is(value, -0) ? 0 : value).length);
    return value;
  }
  if (typeof value !== "object") {
    throw new TypeError("Action result data must be JSON-safe data.");
  }
  if (seen.has(value)) {
    throw new TypeError("Action result data cannot contain cycles or aliases.");
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const lengthSnapshot: ArrayLengthSnapshot = snapshotArrayLength(
      value,
      MAX_INVOCATION_ARRAY_LENGTH,
    );
    if (!lengthSnapshot.ok) {
      throw new TypeError("Action data arrays exceed the supported bound.");
    }
    const keys: readonly PropertyKey[] = Reflect.ownKeys(value);
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(?:0|[1-9]\d*)$/u.test(key)) {
        throw new TypeError("Action data arrays cannot carry extra properties.");
      }
      const index: number = Number(key);
      if (!Number.isSafeInteger(index) || index >= lengthSnapshot.value) {
        throw new TypeError("Action data arrays contain an invalid index.");
      }
    }

    addJsonBytes(budget, 2);
    const clone: ActionData[] = [];
    for (let index: number = 0; index < lengthSnapshot.value; index += 1) {
      if (index > 0) addJsonBytes(budget, 1);
      const descriptor: PropertyDescriptor | undefined =
        Object.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new TypeError("Action data arrays must be dense data properties.");
      }
      clone.push(cloneActionData(descriptor.value, seen, budget));
    }
    return clone;
  }

  const prototype: object | null = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) {
    throw new TypeError("Action data objects must be plain objects.");
  }

  const keys: readonly PropertyKey[] = Reflect.ownKeys(value);
  addJsonBytes(budget, 2);
  const clone: Record<string, ActionData> = Object.create(
    prototype === null ? null : Object.prototype,
  ) as Record<string, ActionData>;
  let entryIndex: number = 0;
  for (const key of keys) {
    if (typeof key !== "string") {
      throw new TypeError("Action data cannot contain symbol keys.");
    }
    const descriptor: PropertyDescriptor | undefined =
      Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new TypeError("Action data objects must use enumerable data properties.");
    }
    if (entryIndex > 0) addJsonBytes(budget, 1);
    addQuotedJsonString(budget, key);
    addJsonBytes(budget, 1);
    Object.defineProperty(clone, key, {
      configurable: true,
      enumerable: true,
      value: cloneActionData(descriptor.value, seen, budget),
      writable: true,
    });
    entryIndex += 1;
  }
  return clone;
}

/** Detach, bound, and recursively freeze validated action-result data. */
export function snapshotActionData(
  value: unknown,
  maximumBytes: number,
): ActionDataSnapshot {
  try {
    const detached: ActionData = cloneActionData(
      value,
      new WeakSet<object>(),
      { maximum: maximumBytes, used: 0 },
    );
    freezeInvocationValue(detached, new WeakSet<object>());
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
    const lengthSnapshot: ArrayLengthSnapshot = snapshotArrayLength(
      value,
      MAX_INVOCATION_ARRAY_LENGTH,
    );
    if (!lengthSnapshot.ok) {
      throw new TypeError("Invocation arrays exceed the supported bound.");
    }
    const slots: Array<CanonicalValue | readonly ["hole"]> = [];
    for (
      let index: number = 0;
      index < lengthSnapshot.value;
      index += 1
    ) {
      const slot: OwnArraySlotSnapshot = snapshotOwnArraySlot(value, index);
      if (!slot.ok) {
        throw new TypeError("Invocation array slots must be readable.");
      }
      slots.push(
        slot.present
          ? canonicalInvocationValue(slot.value, seen)
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
export function encodeInvocationValue(value: unknown): string | null {
  try {
    return encodeCanonicalValue(
      canonicalInvocationValue(value, new WeakSet<object>()),
    );
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
    const result: unknown = await validateCatalogEntry(entry, args);
    if (typeof result !== "object" || result === null) {
      return { ok: false };
    }

    // Standard Schema success explicitly permits `issues: undefined`. Read the
    // value rather than treating property presence as failure, then require the
    // success branch's `value` member independently. Every proxy trap and
    // accessor stays inside this boundary.
    const issues: unknown = (
      result as { readonly issues?: unknown }
    ).issues;
    if (issues !== undefined || !("value" in result)) {
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
    let firedDuringRegistration: boolean = false;
    let registrationComplete: boolean = false;

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
          if (!registrationComplete) {
            firedDuringRegistration = true;
            return;
          }
          settle("ready", false);
        },
        delayMs,
      );

      if (typeof scheduledCancel !== "function") {
        settle("unavailable", false);
        return;
      }

      cancel = scheduledCancel as () => void;
      registrationComplete = true;
      if (cancelWhenAvailable) {
        cancelScheduledWork();
      }
      if (firedDuringRegistration && !settled) {
        settle("ready", false);
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

export interface ResultNormalizationOptions extends ResultWarnings {
  readonly entry: CatalogEntry;
  readonly maximumDataBytes: number;
}

/** Runtime membership check for the closed sixteen-code vocabulary. */
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
    case "catalog_stale":
    case "invalid_invocation":
    case "identity_conflict":
    case "precondition_failed":
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
 * Only `ok`, `reason`, `message`, and optional declared `data` are read through
 * guarded own-property boundaries. Other fields never cross into the returned
 * object. A valid reason on a success is stripped because the effect may
 * already have landed; a reasonless failure is preserved because inventing a
 * cause would be dishonest. Both contradictions warn through instance-owned
 * latches.
 */
type OwnResultProperty =
  | Readonly<{ ok: true; present: false }>
  | Readonly<{ ok: true; present: true; value: unknown }>
  | Readonly<{ ok: false }>;

function readOwnResultProperty(
  result: object,
  key: "ok" | "reason" | "message" | "data",
): OwnResultProperty {
  try {
    if (!Object.prototype.hasOwnProperty.call(result, key)) {
      return { ok: true, present: false };
    }
    const descriptor: PropertyDescriptor | undefined =
      Object.getOwnPropertyDescriptor(result, key);
    if (descriptor === undefined) return { ok: false };
    if ("value" in descriptor) {
      return { ok: true, present: true, value: descriptor.value };
    }
    return {
      ok: true,
      present: true,
      value: descriptor.get?.call(result),
    };
  } catch {
    return { ok: false };
  }
}

async function validateResultData(
  entry: CatalogEntry,
  value: unknown,
  maximumBytes: number,
): Promise<ActionDataSnapshot> {
  if (!hasCatalogEntryOutput(entry) || value === undefined) {
    return { ok: false };
  }
  try {
    const validation: unknown = await validateCatalogEntryOutput(entry, value);
    if (typeof validation !== "object" || validation === null) {
      return { ok: false };
    }
    const issues: unknown = (validation as { readonly issues?: unknown }).issues;
    if (issues !== undefined || !("value" in validation)) {
      return { ok: false };
    }
    return snapshotActionData(
      (validation as { readonly value: unknown }).value,
      maximumBytes,
    );
  } catch {
    return { ok: false };
  }
}

export async function normalizeActionResult(
  value: unknown,
  options: ResultNormalizationOptions,
): Promise<ActionResult> {
  if (typeof value !== "object" || value === null) {
    return invalidResult();
  }

  const okProperty: OwnResultProperty = readOwnResultProperty(value, "ok");
  const reasonProperty: OwnResultProperty = readOwnResultProperty(value, "reason");
  const messageProperty: OwnResultProperty = readOwnResultProperty(value, "message");
  const dataProperty: OwnResultProperty = readOwnResultProperty(value, "data");
  if (
    !okProperty.ok || !okProperty.present ||
    !reasonProperty.ok ||
    !messageProperty.ok || !messageProperty.present ||
    !dataProperty.ok
  ) {
    return invalidResult();
  }

  const ok: unknown = okProperty.value;
  const reason: unknown = reasonProperty.present
    ? reasonProperty.value
    : undefined;
  const message: unknown = messageProperty.value;

  if (typeof ok !== "boolean" || typeof message !== "string") {
    return invalidResult();
  }
  if (reason !== undefined && !isReasonCode(reason)) {
    return invalidResult();
  }

  let data: ActionData | undefined;
  if (dataProperty.present) {
    const normalizedData: ActionDataSnapshot = await validateResultData(
      options.entry,
      dataProperty.value,
      options.maximumDataBytes,
    );
    if (!normalizedData.ok) return invalidResult();
    data = normalizedData.value;
  }

  const finish = (
    resultOk: boolean,
    resultMessage: string,
    resultReason?: ReasonCode | undefined,
  ): ActionResult => {
    const status: ActionResult = authoredResult(
      resultOk,
      resultMessage,
      resultReason,
    );
    return data === undefined
      ? status
      : Object.freeze({ ...status, data });
  };

  if (ok) {
    if (reason !== undefined) {
      notify(options.successReason);
    }
    return finish(true, message);
  }

  if (reason === undefined) {
    notify(options.reasonlessFailure);
    return finish(false, message);
  }

  return finish(false, message, reason);
}
