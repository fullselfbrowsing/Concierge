/**
 * Test-only helpers for Concierge. Not a production runtime.
 *
 * Import from `@full-self-browsing/concierge/testing`. Do not import this
 * module from `packages/concierge/src/**` production files.
 */

import {
  createConcierge,
  makeReadbackReceipt,
} from "@full-self-browsing/concierge";
import type {
  CatalogAcknowledgement,
  Clock,
  Concierge,
  ConciergeConfig,
  DeliveryReport,
  DigestLike,
  Readback,
  ReadbackReceipt,
  ResolvedCatalog,
  Scheduler,
  Transport,
  TransportStatus,
} from "@full-self-browsing/concierge";

export function createTestClock(startMs: number = 0): {
  readonly now: Clock;
  advance(ms: number): void;
} {
  let current: number = startMs;
  return Object.freeze({
    now: (): number => current,
    advance(ms: number): void {
      if (!Number.isFinite(ms) || ms < 0) {
        return;
      }
      current += ms;
    },
  });
}

export type TestScheduler = Scheduler & {
  readonly advance: (ms: number) => void;
};

export function createTestScheduler(): TestScheduler {
  const timers: Array<{
    readonly at: number;
    readonly fn: () => void;
    cancelled: boolean;
  }> = [];
  let now: number = 0;
  function advance(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      return;
    }
    now += ms;
    for (const timer of timers) {
      if (!timer.cancelled && timer.at <= now) {
        timer.cancelled = true;
        timer.fn();
      }
    }
  }
  const schedule: Scheduler = (fn: () => void, delayMs: number): (() => void) => {
    if (delayMs <= 0) {
      fn();
      return (): void => {};
    }
    const timer = { at: now + delayMs, fn, cancelled: false };
    timers.push(timer);
    return (): void => {
      timer.cancelled = true;
    };
  };
  return Object.assign(schedule, { advance });
}

export function createTestDigest(): DigestLike {
  return {
    async digest(
      _algorithm: "SHA-256",
      data: ArrayBuffer | ArrayBufferView,
    ): Promise<ArrayBuffer> {
      const bytes: Uint8Array = data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const out: Uint8Array = new Uint8Array(32);
      let hash: number = 0;
      for (let i: number = 0; i < bytes.length; i += 1) {
        hash = (hash * 33 + (bytes[i] ?? 0)) >>> 0;
        out[i % 32] = (out[i % 32] ?? 0) ^ (bytes[i] ?? 0);
      }
      out[0] = hash & 0xff;
      out[1] = (hash >>> 8) & 0xff;
      out[2] = (hash >>> 16) & 0xff;
      out[3] = (hash >>> 24) & 0xff;
      const copy: ArrayBuffer = new ArrayBuffer(out.byteLength);
      new Uint8Array(copy).set(out);
      return copy;
    },
  };
}

export function createStubTransport(options?: {
  readonly acknowledgesCatalog?: boolean;
}): {
  readonly transport: Transport;
  readonly published: ReadonlyArray<unknown>;
  ack(revision: symbol, accepted: boolean): void;
} {
  const published: unknown[] = [];
  const acknowledgesCatalog: boolean = options?.acknowledgesCatalog === true;
  let status: TransportStatus = "idle";
  const statusListeners: Set<(next: TransportStatus) => void> = new Set();
  const batchListeners: Set<(batch: never) => Promise<unknown>> = new Set();
  const ackListeners: Set<(ack: CatalogAcknowledgement) => void> = new Set();
  const transport: Transport = {
    capabilities: Object.freeze({
      consentGrade: "relayed",
      userTurnIdentity: "agent-forgeable",
      parallelCalls: true,
      dynamicCatalog: true,
      acknowledgesCatalog,
    }),
    get status(): TransportStatus {
      return status;
    },
    setCatalog: (catalog: ResolvedCatalog): void => {
      published.push(catalog);
    },
    onStatusChange: (cb): (() => void) => {
      statusListeners.add(cb);
      return (): void => {
        statusListeners.delete(cb);
      };
    },
    onToolBatch: (cb): (() => void) => {
      batchListeners.add(cb as (batch: never) => Promise<unknown>);
      return (): void => {
        batchListeners.delete(cb as (batch: never) => Promise<unknown>);
      };
    },
    ...(acknowledgesCatalog
      ? {
          onCatalogAcknowledged: (
            cb: (ack: CatalogAcknowledgement) => void,
          ): (() => void) => {
            ackListeners.add(cb);
            return (): void => {
              ackListeners.delete(cb);
            };
          },
        }
      : {}),
  };
  return {
    transport,
    get published(): ReadonlyArray<unknown> {
      return published;
    },
    ack(revision: symbol, accepted: boolean): void {
      const acknowledgement: CatalogAcknowledgement = {
        revision: revision as CatalogAcknowledgement["revision"],
        accepted,
      };
      for (const listener of ackListeners) {
        listener(acknowledgement);
      }
    },
  };
}

export interface TestConciergeOptions extends ConciergeConfig {
  readonly clock?: Clock;
}

export function createTestConcierge(options: TestConciergeOptions): Concierge {
  const clock = options.clock ?? createTestClock().now;
  return createConcierge({
    ...options,
    clock,
    digest: options.digest ?? createTestDigest(),
    commitWindowMs: options.commitWindowMs ?? 0,
  });
}

export function createTestReadbackSink(): {
  present: NonNullable<ConciergeConfig["presentReadback"]>;
  receipts: ReadonlyArray<ReadbackReceipt>;
} {
  const receipts: ReadbackReceipt[] = [];
  const digest: DigestLike = createTestDigest();
  return {
    present: async <P>(readback: Readback<P>): Promise<ReadbackReceipt> => {
      const receipt: ReadbackReceipt = await makeReadbackReceipt(
        readback,
        digest,
      );
      receipts.push(receipt);
      return receipt;
    },
    get receipts(): ReadonlyArray<ReadbackReceipt> {
      return receipts;
    },
  };
}

export function createCompletedDelivery(
  responseId: string,
  extras?: Partial<DeliveryReport>,
): DeliveryReport {
  return Object.freeze({
    responseId,
    outcome: extras?.outcome ?? "completed",
    ...(extras?.readbackHash === undefined
      ? {}
      : { readbackHash: extras.readbackHash }),
    ...(extras?.attestation === undefined
      ? {}
      : { attestation: extras.attestation }),
  });
}

export function createTestMemoryReplayStore(): {
  consume(
    key: string,
    retainUntil: number,
    currentTime: number,
  ): Promise<boolean>;
} {
  const entries: Map<string, number> = new Map();
  return Object.freeze({
    async consume(
      key: string,
      retainUntil: number,
      currentTime: number,
    ): Promise<boolean> {
      for (const [candidate, expiry] of entries) {
        if (expiry < currentTime) {
          entries.delete(candidate);
        }
      }
      if (entries.has(key)) {
        return false;
      }
      entries.set(key, retainUntil);
      return true;
    },
  });
}
