import type { AbortSignalLike, Scheduler } from "@full-self-browsing/concierge";
import type { RealtimeDiagnostic, RealtimeDiagnosticCode } from "./types.js";

const DIAGNOSTIC_MESSAGES: Readonly<Record<RealtimeDiagnosticCode, string>> =
  Object.freeze({
    channel_send_failed: "A realtime channel could not send an event.",
    channel_fault: "The realtime channel failed and the session stopped.",
    catalog_rejected:
      "The agent rejected a catalog publication; the last acknowledged catalog still stands.",
    catalog_unacknowledged:
      "A catalog publication was not acknowledged before the timeout.",
    batch_extract_failed:
      "The provider could not extract a tool batch from a completed response.",
    delivery_revoked: "A pending delivery was revoked before it reached the human.",
    delivery_unbound:
      "A delivery group ended without being bound to a voicing response.",
    provider_decode_failed: "The provider could not decode one channel event.",
    playback_source_missing:
      "A host-signalled provider requires a playback source; consent was clamped to none.",
    follow_up_failed:
      "A tool-result or follow-up event was not sent; remaining events were withheld.",
  });

interface TimerHost {
  setTimeout?(fn: () => void, delayMs: number): unknown;
  clearTimeout?(handle: unknown): void;
}

export function readHostScheduler(): Scheduler | undefined {
  const host: TimerHost = globalThis as TimerHost;
  const schedule: TimerHost["setTimeout"] = host.setTimeout;
  const clear: TimerHost["clearTimeout"] = host.clearTimeout;
  if (schedule === undefined || clear === undefined) {
    return undefined;
  }
  return (fn: () => void, delayMs: number): (() => void) => {
    const handle: unknown = schedule.call(host, fn, delayMs);
    let cancelled: boolean = false;
    return (): void => {
      if (cancelled) return;
      cancelled = true;
      try {
        clear.call(host, handle);
      } catch {
        // Cancellation reaches the host timer at most once.
      }
    };
  };
}

export function resolveScheduler(
  scheduler: Scheduler | undefined,
): Scheduler | undefined {
  return scheduler ?? readHostScheduler();
}

export function createDiagnostic(
  code: RealtimeDiagnosticCode,
  responseId?: string,
): RealtimeDiagnostic {
  return Object.freeze(
    responseId === undefined
      ? { code, message: DIAGNOSTIC_MESSAGES[code] }
      : { code, message: DIAGNOSTIC_MESSAGES[code], responseId },
  );
}

export function invokeHost(fn: () => void): void {
  try {
    fn();
  } catch {
    // Host callbacks cannot affect control flow.
  }
}

export function notifyDiagnostic(
  onDiagnostic: ((diagnostic: RealtimeDiagnostic) => void) | undefined,
  diagnostic: RealtimeDiagnostic,
): void {
  if (onDiagnostic === undefined) return;
  invokeHost(() => {
    onDiagnostic(diagnostic);
  });
}

export interface LocalAbortController {
  readonly signal: AbortSignalLike;
  abort(): void;
}

export function createLocalAbortController(): LocalAbortController {
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
      for (const listener of snapshot) invokeHost(listener);
    },
  };
}

export function isAbortLike(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  try {
    const name: unknown = (error as { name?: unknown }).name;
    return name === "AbortError";
  } catch {
    return false;
  }
}

export function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1_024;
}

export function asRecord(value: unknown): object | null {
  if (typeof value !== "object" || value === null) return null;
  try {
    if (Array.isArray(value)) return null;
    const prototype: object | null = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
  } catch {
    return null;
  }
  return value;
}

/**
 * An insertion-ordered string map that forgets its oldest entry past a cap.
 *
 * A realtime session is long-lived by construction — that is the whole point
 * of the package — so every per-response map inside one has to have a ceiling
 * or it is a leak measured in session length rather than in a bug. The shape
 * is the one `createRealtimeTurnLedger` already used for `byResponse`, lifted
 * here so the ledgers cannot drift onto different eviction rules.
 */
export interface BoundedStore<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  clear(): void;
  readonly size: number;
}

export function createBoundedStore<V>(
  maxEntries: number,
  fallback: number,
): BoundedStore<V> {
  const cap: number =
    Number.isSafeInteger(maxEntries) && maxEntries > 0 ? maxEntries : fallback;
  const entries: Map<string, V> = new Map();
  const order: string[] = [];

  return {
    get(key: string): V | undefined {
      return entries.get(key);
    },
    set(key: string, value: V): void {
      if (!entries.has(key)) order.push(key);
      entries.set(key, value);
      while (order.length > cap) {
        const oldest: string | undefined = order.shift();
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    clear(): void {
      entries.clear();
      order.length = 0;
    },
    get size(): number {
      return entries.size;
    },
  };
}

export function ownData(record: object, key: string): unknown {
  try {
    const descriptor: PropertyDescriptor | undefined =
      Object.getOwnPropertyDescriptor(record, key);
    if (descriptor === undefined || !("value" in descriptor)) return undefined;
    return descriptor.value;
  } catch {
    return undefined;
  }
}
