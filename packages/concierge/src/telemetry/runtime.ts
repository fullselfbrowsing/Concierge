import type { Concierge } from "@full-self-browsing/concierge";
import type {
  ConciergeTelemetryReason,
  ConciergeTelemetryStatus,
} from "./index.js";

const EVENTS_ENDPOINT = "https://full-selfbrowsing.com/api/telemetry/events";
const FORGET_ENDPOINT = "https://full-selfbrowsing.com/api/telemetry/forget";
const DATABASE_NAME = "fullselfbrowsing-concierge-telemetry";
const DATABASE_VERSION = 2;
const OPT_OUT_KEY = "fullselfbrowsing.concierge.telemetry.disabled";
const STATUS_CHANNEL = "fullselfbrowsing-concierge-telemetry-status";

const STATE_STORE = "state";
const EVENT_STORE = "events";
const LEASE_STORE = "runtime-leases";
const FORGET_STORE = "deletion-retries";
const IN_FLIGHT_POST_STORE = "in-flight-posts";
const STATE_KEY = "singleton";

const ACTION_TOKENS_IN = 100;
const ACTION_TOKENS_OUT = 200;
const TOKEN_LIMIT = 10_000_000;
const ACTIVE_COUNT_LIMIT = 64;
const QUEUE_LIMIT = 200;
const RETRY_LIMIT = 5;
const TELEMETRY_REQUEST_TIMEOUT_MS = 30 * 1000;
const BATCH_EVENT_LIMIT = 50;
const BATCH_BYTE_LIMIT = 30 * 1024;
const EVENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LEASE_DURATION_MS = 10 * 60 * 1000;
const LEASE_RENEW_MS = 60 * 1000;
const IN_FLIGHT_POST_DURATION_MS = LEASE_DURATION_MS;
const IN_FLIGHT_POST_RENEW_MS = LEASE_RENEW_MS;
const INSTALL_GRACE_MS = 30 * 1000;
const PERIODIC_MS = 5 * 60 * 1000;
const PERIODIC_JITTER_MS = 30 * 1000;
// Keep ownership across an entire periodic window. Releasing it immediately
// would serialize competing tabs without preventing each one from sending its
// own heartbeat a few milliseconds later.
const FLUSH_LEASE_MS = PERIODIC_MS + PERIODIC_JITTER_MS + 60 * 1000;

type StoreName =
  | typeof STATE_STORE
  | typeof EVENT_STORE
  | typeof LEASE_STORE
  | typeof FORGET_STORE
  | typeof IN_FLIGHT_POST_STORE;

interface StateRecord {
  readonly key: typeof STATE_KEY;
  installUuid: string | null;
  installAnnounced: boolean;
  tokensIn: number;
  tokensOut: number;
  flushOwner: string | null;
  flushExpiresAt: number;
  nextQueueOrder: number;
}

interface RuntimeLease {
  readonly runtimeId: string;
  expiresAt: number;
}

interface DeletionRetry {
  readonly installUuid: string;
  attempts: number;
  retryAfter: number;
}

interface InFlightEventPost {
  readonly postId: string;
  readonly installUuid: string;
  expiresAt: number;
}

interface TelemetryEvent {
  readonly event_id: string;
  readonly install_uuid: string;
  readonly ts_minute: number;
  readonly mcp_client: "Concierge";
  readonly model: "unknown";
  readonly tokens_in: number;
  readonly tokens_out: number;
  readonly active_agent_count: number;
  readonly event_type: "install_announce" | "periodic";
  readonly active_count_version: 2;
}

interface QueuedEvent extends TelemetryEvent {
  attempts: number;
  readonly queuedAt: number;
  readonly queueOrder: number;
}

interface MountRecord {
  readonly runtimeId: string;
  readonly concierge: Concierge;
  refs: number;
  unsubscribe: (() => void) | null;
}

interface WireBatch {
  readonly source: readonly QueuedEvent[];
  readonly events: readonly TelemetryEvent[];
}

type StatusListener = (status: ConciergeTelemetryStatus) => void;
type FlushKind = "install" | "periodic";

const mountRecords = new WeakMap<Concierge, MountRecord>();
const activeMounts = new Set<MountRecord>();
const statusListeners = new Set<StatusListener>();

let databasePromise: Promise<IDBDatabase> | null = null;
let openedDatabase: IDBDatabase | null = null;
let storageUnavailable = false;
let stopped = false;
let erasePromise: Promise<boolean> | null = null;
let deletionSweepPromise: Promise<void> | null = null;
let localFlushInProgress = false;
let telemetryRequestTimeoutMs = TELEMETRY_REQUEST_TIMEOUT_MS;
let maintenanceTimer: ReturnType<typeof setInterval> | null = null;
let periodicTimer: ReturnType<typeof setTimeout> | null = null;
let installTimer: ReturnType<typeof setTimeout> | null = null;
let channel: BroadcastChannel | null = null;
let browserListenersInstalled = false;
let tabId: string | null = null;
const inFlightEventPosts = new Set<Promise<boolean>>();
const inFlightPostRenewalTimers = new Map<
  string,
  ReturnType<typeof setInterval>
>();

function failClosedForStorage(): void {
  const changed: boolean = !storageUnavailable || !stopped;
  storageUnavailable = true;
  stopped = true;
  if (maintenanceTimer !== null) clearInterval(maintenanceTimer);
  if (periodicTimer !== null) clearTimeout(periodicTimer);
  if (installTimer !== null) clearTimeout(installTimer);
  for (const timer of inFlightPostRenewalTimers.values()) clearInterval(timer);
  maintenanceTimer = null;
  periodicTimer = null;
  installTimer = null;
  inFlightPostRenewalTimers.clear();
  if (changed) emitStatus();
}

function isBrowser(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof indexedDB !== "undefined" &&
      typeof localStorage !== "undefined" &&
      typeof fetch !== "undefined"
    );
  } catch {
    failClosedForStorage();
    return false;
  }
}

function mintUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex: string = [...bytes]
      .map((value): string => value.toString(16).padStart(2, "0"))
      .join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return "00000000-0000-4000-8000-000000000000";
}

function requireUuid(): string {
  const uuid: string = mintUuid();
  if (uuid === "00000000-0000-4000-8000-000000000000") {
    throw new Error("secure UUID generation is unavailable");
  }
  return uuid;
}

function currentTabId(): string {
  tabId ??= requireUuid();
  return tabId;
}

function globalPrivacyControlEnabled(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { readonly globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}

function readUserOptOut(): boolean | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    failClosedForStorage();
    return null;
  }
}

function currentReason(): ConciergeTelemetryReason {
  const optedOut: boolean | null = readUserOptOut();
  if (optedOut === true) return "user_opt_out";
  if (globalPrivacyControlEnabled()) return "global_privacy_control";
  if (!isBrowser() || optedOut === null || storageUnavailable) {
    return "storage_unavailable";
  }
  return "enabled";
}

function collectionMayRun(): boolean {
  const enabled: boolean = !stopped && currentReason() === "enabled";
  if (!enabled) stopped = true;
  return enabled;
}

function defaultState(): StateRecord {
  return {
    key: STATE_KEY,
    installUuid: null,
    installAnnounced: false,
    tokensIn: 0,
    tokensOut: 0,
    flushOwner: null,
    flushExpiresAt: 0,
    nextQueueOrder: 0,
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject): void => {
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionResult(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject): void => {
    transaction.oncomplete = (): void => resolve();
    transaction.onabort = (): void => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = (): void => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

function forgetDatabase(database: IDBDatabase): void {
  if (openedDatabase === database) {
    openedDatabase = null;
    databasePromise = null;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise !== null) return databasePromise;
  if (!isBrowser()) {
    storageUnavailable = true;
    return Promise.reject(new Error("browser storage is unavailable"));
  }

  databasePromise = new Promise<IDBDatabase>((resolve, reject): void => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = (): void => {
      const database: IDBDatabase = request.result;
      if (!database.objectStoreNames.contains(STATE_STORE)) {
        database.createObjectStore(STATE_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(EVENT_STORE)) {
        database.createObjectStore(EVENT_STORE, { keyPath: "event_id" });
      }
      if (!database.objectStoreNames.contains(LEASE_STORE)) {
        database.createObjectStore(LEASE_STORE, { keyPath: "runtimeId" });
      }
      if (!database.objectStoreNames.contains(FORGET_STORE)) {
        database.createObjectStore(FORGET_STORE, { keyPath: "installUuid" });
      }
      if (!database.objectStoreNames.contains(IN_FLIGHT_POST_STORE)) {
        database.createObjectStore(IN_FLIGHT_POST_STORE, { keyPath: "postId" });
      }
    };
    request.onsuccess = (): void => {
      const database: IDBDatabase = request.result;
      openedDatabase = database;
      database.onversionchange = (): void => {
        database.close();
        forgetDatabase(database);
      };
      database.onclose = (): void => forgetDatabase(database);
      resolve(database);
    };
    request.onerror = (): void => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onblocked = (): void => reject(new Error("IndexedDB upgrade was blocked"));
  }).catch((error: unknown): never => {
    databasePromise = null;
    openedDatabase = null;
    failClosedForStorage();
    throw error;
  });

  return databasePromise;
}

async function withTransaction<T>(
  stores: readonly StoreName[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> {
  let transaction: IDBTransaction | null = null;
  let completion: Promise<void> | null = null;
  try {
    const database: IDBDatabase = await openDatabase();
    transaction = database.transaction([...stores], mode);
    completion = transactionResult(transaction);
    const result: T = await operation(transaction);
    await completion;
    return result;
  } catch (error) {
    if (transaction !== null) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have failed or completed.
      }
    }
    await completion?.catch((): void => undefined);
    failClosedForStorage();
    throw error;
  }
}

async function readState(store: IDBObjectStore): Promise<StateRecord> {
  const state: StateRecord | undefined = await requestResult(
    store.get(STATE_KEY) as IDBRequest<StateRecord | undefined>,
  );
  if (state === undefined) return defaultState();
  if (!Number.isSafeInteger(state.nextQueueOrder) || state.nextQueueOrder < 0) {
    state.nextQueueOrder = 0;
  }
  return state;
}

function writeState(store: IDBObjectStore, state: StateRecord): void {
  store.put(state);
}

function minuteTimestamp(now: number): number {
  return Math.floor(now / 60_000) * 60_000;
}

function projectWireEvent(source: QueuedEvent): TelemetryEvent {
  return {
    event_id: source.event_id,
    install_uuid: source.install_uuid,
    ts_minute: source.ts_minute,
    mcp_client: "Concierge",
    model: "unknown",
    tokens_in: Math.min(TOKEN_LIMIT, Math.max(0, Math.floor(source.tokens_in))),
    tokens_out: Math.min(TOKEN_LIMIT, Math.max(0, Math.floor(source.tokens_out))),
    active_agent_count: Math.min(
      ACTIVE_COUNT_LIMIT,
      Math.max(0, Math.floor(source.active_agent_count)),
    ),
    event_type: source.event_type === "install_announce" ? "install_announce" : "periodic",
    active_count_version: 2,
  };
}

function makeQueuedEvent(
  installUuid: string,
  tokensIn: number,
  tokensOut: number,
  activeCount: number,
  eventType: TelemetryEvent["event_type"],
  now: number,
  queueOrder: number,
): QueuedEvent {
  return {
    event_id: requireUuid(),
    install_uuid: installUuid,
    ts_minute: minuteTimestamp(now),
    mcp_client: "Concierge",
    model: "unknown",
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    active_agent_count: Math.min(ACTIVE_COUNT_LIMIT, activeCount),
    event_type: eventType,
    active_count_version: 2,
    attempts: 0,
    queuedAt: now,
    queueOrder,
  };
}

async function getPendingDeletionCount(): Promise<number> {
  if (storageUnavailable || !isBrowser()) return 0;
  try {
    return await withTransaction(
      [FORGET_STORE],
      "readonly",
      async (transaction): Promise<number> =>
        requestResult(transaction.objectStore(FORGET_STORE).count()),
    );
  } catch {
    return 0;
  }
}

async function statusSnapshot(): Promise<ConciergeTelemetryStatus> {
  if (isBrowser() && !storageUnavailable) {
    try {
      await openDatabase();
    } catch {
      // openDatabase records the fail-closed state.
    }
  }
  const reason: ConciergeTelemetryReason = currentReason();
  return {
    enabled: reason === "enabled" && !stopped,
    reason,
    serverDeletionPending:
      !storageUnavailable && (await getPendingDeletionCount()) > 0,
  };
}

function emitStatus(): void {
  if (statusListeners.size === 0) return;
  void statusSnapshot().then((status): void => {
    for (const listener of statusListeners) {
      try {
        listener(status);
      } catch {
        // UI observers cannot interfere with telemetry or dispatch.
      }
    }
  });
}

function broadcastStatus(): void {
  try {
    channel?.postMessage("changed");
  } catch {
    // localStorage remains the cross-tab source of truth.
  }
  emitStatus();
}

function installBrowserListeners(): void {
  if (!isBrowser() || browserListenersInstalled) return;
  browserListenersInstalled = true;
  window.addEventListener("storage", (event): void => {
    if (event.key !== OPT_OUT_KEY) return;
    stopped = currentReason() !== "enabled";
    void maintainPrivacyState();
    emitStatus();
  });
  window.addEventListener("pagehide", (): void => {
    void removeAllLocalLeases();
    void releaseLocalFlushOwnership();
  });
  window.addEventListener("pageshow", (): void => {
    void maintainPrivacyState();
  });
  if (typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(STATUS_CHANNEL);
      channel.onmessage = (): void => {
        stopped = currentReason() !== "enabled";
        void maintainPrivacyState();
        emitStatus();
      };
    } catch {
      channel = null;
    }
  }
}

async function upsertLocalLeases(): Promise<void> {
  if (!collectionMayRun() || activeMounts.size === 0) return;
  const now: number = Date.now();
  await withTransaction([LEASE_STORE], "readwrite", async (transaction): Promise<void> => {
    const store: IDBObjectStore = transaction.objectStore(LEASE_STORE);
    for (const record of activeMounts) {
      store.put({
        runtimeId: record.runtimeId,
        expiresAt: now + LEASE_DURATION_MS,
      } satisfies RuntimeLease);
    }
  });
}

async function removeLease(runtimeId: string): Promise<void> {
  try {
    await withTransaction([LEASE_STORE], "readwrite", async (transaction): Promise<void> => {
      transaction.objectStore(LEASE_STORE).delete(runtimeId);
    });
  } catch {
    // A failed cleanup expires naturally after ten minutes.
  }
}

async function removeAllLocalLeases(): Promise<void> {
  try {
    await withTransaction([LEASE_STORE], "readwrite", async (transaction): Promise<void> => {
      const store: IDBObjectStore = transaction.objectStore(LEASE_STORE);
      for (const record of activeMounts) store.delete(record.runtimeId);
    });
  } catch {
    // A failed cleanup expires naturally after ten minutes.
  }
}

async function releaseLocalFlushOwnership(): Promise<void> {
  if (tabId === null) return;
  try {
    await withTransaction([STATE_STORE], "readwrite", async (transaction): Promise<void> => {
      const store: IDBObjectStore = transaction.objectStore(STATE_STORE);
      const state: StateRecord = await readState(store);
      if (state.flushOwner === tabId) {
        state.flushOwner = null;
        state.flushExpiresAt = 0;
        writeState(store, state);
      }
    });
  } catch {
    // The bounded lease makes a failed clean handoff self-healing.
  }
}

async function recordAcceptedDispatch(): Promise<void> {
  if (!collectionMayRun()) return;
  try {
    await withTransaction([STATE_STORE], "readwrite", async (transaction): Promise<void> => {
      if (!collectionMayRun()) return;
      const store: IDBObjectStore = transaction.objectStore(STATE_STORE);
      const state: StateRecord = await readState(store);
      if (!collectionMayRun()) return;
      state.installUuid ??= requireUuid();
      state.tokensIn += ACTION_TOKENS_IN;
      state.tokensOut += ACTION_TOKENS_OUT;
      writeState(store, state);
    });
  } catch {
    // Telemetry is strictly best-effort and never changes dispatch behavior.
  }
}

async function acquireFlushLease(): Promise<boolean> {
  if (!collectionMayRun()) return false;
  const now: number = Date.now();
  return withTransaction([STATE_STORE], "readwrite", async (transaction): Promise<boolean> => {
    const store: IDBObjectStore = transaction.objectStore(STATE_STORE);
    const state: StateRecord = await readState(store);
    const owner: string = currentTabId();
    if (
      state.flushOwner !== null &&
      state.flushOwner !== owner &&
      state.flushExpiresAt > now
    ) {
      return false;
    }
    state.flushOwner = owner;
    state.flushExpiresAt = now + FLUSH_LEASE_MS;
    writeState(store, state);
    return true;
  });
}

async function enqueueFlushEvent(kind: FlushKind): Promise<void> {
  const now: number = Date.now();
  await withTransaction(
    [STATE_STORE, EVENT_STORE, LEASE_STORE],
    "readwrite",
    async (transaction): Promise<void> => {
      if (!collectionMayRun()) return;
      const stateStore: IDBObjectStore = transaction.objectStore(STATE_STORE);
      const eventStore: IDBObjectStore = transaction.objectStore(EVENT_STORE);
      const leaseStore: IDBObjectStore = transaction.objectStore(LEASE_STORE);
      const state: StateRecord = await readState(stateStore);
      const leases: RuntimeLease[] = await requestResult(
        leaseStore.getAll() as IDBRequest<RuntimeLease[]>,
      );
      let activeCount = 0;
      for (const lease of leases) {
        if (lease.expiresAt <= now) {
          leaseStore.delete(lease.runtimeId);
        } else {
          activeCount += 1;
        }
      }

      state.installUuid ??= requireUuid();
      if (kind === "install") {
        if (!state.installAnnounced) {
          eventStore.put(
            makeQueuedEvent(
              state.installUuid,
              0,
              0,
              activeCount,
              "install_announce",
              now,
              state.nextQueueOrder,
            ),
          );
          state.nextQueueOrder += 1;
          state.installAnnounced = true;
        }
      } else {
        let remainingIn: number = Math.max(0, Math.floor(state.tokensIn));
        let remainingOut: number = Math.max(0, Math.floor(state.tokensOut));
        do {
          const chunkIn: number = Math.min(TOKEN_LIMIT, remainingIn);
          const chunkOut: number = Math.min(TOKEN_LIMIT, remainingOut);
          eventStore.put(
            makeQueuedEvent(
              state.installUuid,
              chunkIn,
              chunkOut,
              activeCount,
              "periodic",
              now,
              state.nextQueueOrder,
            ),
          );
          state.nextQueueOrder += 1;
          remainingIn -= chunkIn;
          remainingOut -= chunkOut;
        } while (remainingIn > 0 || remainingOut > 0);
        state.tokensIn = 0;
        state.tokensOut = 0;
      }
      writeState(stateStore, state);

      const queued: QueuedEvent[] = await requestResult(
        eventStore.getAll() as IDBRequest<QueuedEvent[]>,
      );
      const sorted: QueuedEvent[] = queued.sort(
        (left, right): number =>
          left.queuedAt - right.queuedAt || left.queueOrder - right.queueOrder,
      );
      const valid: QueuedEvent[] = [];
      for (const event of sorted) {
        if (event.attempts >= RETRY_LIMIT || now - event.queuedAt > EVENT_MAX_AGE_MS) {
          eventStore.delete(event.event_id);
        } else {
          valid.push(event);
        }
      }
      const overflow: number = valid.length - QUEUE_LIMIT;
      for (let index = 0; index < overflow; index += 1) {
        const event: QueuedEvent | undefined = valid[index];
        if (event !== undefined) eventStore.delete(event.event_id);
      }
    },
  );
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

async function selectWireBatch(): Promise<WireBatch> {
  return withTransaction([EVENT_STORE], "readonly", async (transaction): Promise<WireBatch> => {
    const queued: QueuedEvent[] = await requestResult(
      transaction.objectStore(EVENT_STORE).getAll() as IDBRequest<QueuedEvent[]>,
    );
    queued.sort(
      (left, right): number =>
        left.queuedAt - right.queuedAt || left.queueOrder - right.queueOrder,
    );
    const source: QueuedEvent[] = [];
    const events: TelemetryEvent[] = [];
    for (const queuedEvent of queued) {
      if (events.length >= BATCH_EVENT_LIMIT) break;
      const projected: TelemetryEvent = projectWireEvent(queuedEvent);
      const candidate: TelemetryEvent[] = [...events, projected];
      if (utf8Length(JSON.stringify({ events: candidate })) > BATCH_BYTE_LIMIT) break;
      source.push(queuedEvent);
      events.push(projected);
    }
    return { source, events };
  });
}

async function settleBatch(batch: WireBatch, succeeded: boolean): Promise<void> {
  const ids = new Set(batch.source.map((event): string => event.event_id));
  await withTransaction([EVENT_STORE], "readwrite", async (transaction): Promise<void> => {
    const store: IDBObjectStore = transaction.objectStore(EVENT_STORE);
    if (succeeded) {
      for (const id of ids) store.delete(id);
      return;
    }
    const current: QueuedEvent[] = await requestResult(
      store.getAll() as IDBRequest<QueuedEvent[]>,
    );
    for (const event of current) {
      if (ids.has(event.event_id)) {
        event.attempts += 1;
        store.put(event);
      }
    }
  });
}

async function putInFlightEventPost(record: InFlightEventPost): Promise<void> {
  await withTransaction(
    [IN_FLIGHT_POST_STORE],
    "readwrite",
    async (transaction): Promise<void> => {
      transaction.objectStore(IN_FLIGHT_POST_STORE).put(record);
    },
  );
}

async function renewInFlightEventPost(postId: string): Promise<void> {
  try {
    await withTransaction(
      [IN_FLIGHT_POST_STORE],
      "readwrite",
      async (transaction): Promise<void> => {
        const store: IDBObjectStore = transaction.objectStore(IN_FLIGHT_POST_STORE);
        const record: InFlightEventPost | undefined = await requestResult(
          store.get(postId) as IDBRequest<InFlightEventPost | undefined>,
        );
        if (record === undefined) return;
        record.expiresAt = Date.now() + IN_FLIGHT_POST_DURATION_MS;
        store.put(record);
      },
    );
  } catch {
    // Storage failures stop collection; the existing lease expires naturally.
  }
}

async function removeInFlightEventPost(postId: string): Promise<void> {
  try {
    await withTransaction(
      [IN_FLIGHT_POST_STORE],
      "readwrite",
      async (transaction): Promise<void> => {
        transaction.objectStore(IN_FLIGHT_POST_STORE).delete(postId);
      },
    );
  } catch {
    // A failed cleanup remains bounded by the ten-minute post lease.
  }
}

async function pruneAndFindLiveEventPosts(
  store: IDBObjectStore,
  installUuid: string,
  now: number,
): Promise<boolean> {
  const posts: InFlightEventPost[] = await requestResult(
    store.getAll() as IDBRequest<InFlightEventPost[]>,
  );
  let found = false;
  for (const post of posts) {
    if (!Number.isFinite(post.expiresAt) || post.expiresAt <= now) {
      store.delete(post.postId);
    } else if (post.installUuid === installUuid) {
      found = true;
    }
  }
  return found;
}

async function hasLiveEventPosts(
  installUuid: string,
  now: number,
): Promise<boolean> {
  return withTransaction(
    [IN_FLIGHT_POST_STORE],
    "readwrite",
    async (transaction): Promise<boolean> =>
      pruneAndFindLiveEventPosts(
        transaction.objectStore(IN_FLIGHT_POST_STORE),
        installUuid,
        now,
      ),
  );
}

async function postEvents(batch: WireBatch): Promise<boolean> {
  if (batch.events.length === 0 || !collectionMayRun()) return false;
  const firstEvent: TelemetryEvent | undefined = batch.events[0];
  if (firstEvent === undefined) return false;
  const postId: string = requireUuid();
  await putInFlightEventPost({
    postId,
    installUuid: firstEvent.install_uuid,
    expiresAt: Date.now() + IN_FLIGHT_POST_DURATION_MS,
  });
  if (!collectionMayRun()) {
    await removeInFlightEventPost(postId);
    return false;
  }

  const renewalTimer: ReturnType<typeof setInterval> = setInterval((): void => {
    void renewInFlightEventPost(postId);
  }, IN_FLIGHT_POST_RENEW_MS);
  inFlightPostRenewalTimers.set(postId, renewalTimer);

  let request: Promise<boolean> | null = null;
  try {
    request = postTelemetryJson(
      EVENTS_ENDPOINT,
      JSON.stringify({ events: batch.events }),
    );
    inFlightEventPosts.add(request);
    return await request;
  } finally {
    clearInterval(renewalTimer);
    inFlightPostRenewalTimers.delete(postId);
    if (request !== null) inFlightEventPosts.delete(request);
    await removeInFlightEventPost(postId);
    if (stopped || currentReason() !== "enabled") {
      void retryServerDeletions();
    }
  }
}

async function postTelemetryJson(endpoint: string, body: string): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    const controller = new AbortController();
    timeout = setTimeout((): void => {
      controller.abort();
    }, telemetryRequestTimeoutMs);
    const response: Response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: true,
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    if (timeout !== null) clearTimeout(timeout);
  }
}

async function flush(kind: FlushKind): Promise<void> {
  if (!collectionMayRun() || localFlushInProgress) return;
  localFlushInProgress = true;
  try {
    const acquired: boolean = await acquireFlushLease();
    if (!acquired || !collectionMayRun()) return;
    await upsertLocalLeases();
    await enqueueFlushEvent(kind);
    const batch: WireBatch = await selectWireBatch();
    if (batch.events.length === 0) {
      // A tab mounted after this origin announced its installation has no
      // install work. Hand leadership back immediately so its no-op grace
      // timer cannot suppress another tab's five-minute heartbeat.
      await releaseLocalFlushOwnership();
      return;
    }
    if (!collectionMayRun()) return;
    await settleBatch(batch, await postEvents(batch));
  } catch {
    // Storage and network failures are isolated from the host application.
  } finally {
    localFlushInProgress = false;
    emitStatus();
  }
}

async function purgeAndQueueDeletion(): Promise<boolean> {
  try {
    await withTransaction(
      [
        STATE_STORE,
        EVENT_STORE,
        LEASE_STORE,
        FORGET_STORE,
        IN_FLIGHT_POST_STORE,
      ],
      "readwrite",
      async (transaction): Promise<void> => {
        const stateStore: IDBObjectStore = transaction.objectStore(STATE_STORE);
        const state: StateRecord = await readState(stateStore);
        if (state.installUuid !== null) {
          transaction.objectStore(FORGET_STORE).put({
            installUuid: state.installUuid,
            attempts: 0,
            retryAfter: 0,
          } satisfies DeletionRetry);
        }
        stateStore.clear();
        transaction.objectStore(EVENT_STORE).clear();
        transaction.objectStore(LEASE_STORE).clear();
      },
    );
    return true;
  } catch {
    // Failure is reflected as storage_unavailable; dispatch still proceeds.
    storageUnavailable = true;
    stopped = true;
    return false;
  }
}

async function runServerDeletionSweep(): Promise<void> {
  if (!isBrowser()) return;
  let retries: DeletionRetry[];
  try {
    retries = await withTransaction([FORGET_STORE], "readonly", async (transaction): Promise<DeletionRetry[]> =>
      requestResult(
        transaction.objectStore(FORGET_STORE).getAll() as IDBRequest<DeletionRetry[]>,
      ),
    );
  } catch {
    return;
  }
  const now: number = Date.now();
  for (const retry of retries) {
    if (retry.retryAfter > now) continue;
    let livePostExists: boolean;
    try {
      livePostExists = await hasLiveEventPosts(retry.installUuid, now);
    } catch {
      return;
    }
    if (livePostExists) continue;

    const succeeded: boolean = await postTelemetryJson(
      FORGET_ENDPOINT,
      JSON.stringify({ install_uuid: retry.installUuid }),
    );
    try {
      await withTransaction(
        [FORGET_STORE, IN_FLIGHT_POST_STORE],
        "readwrite",
        async (transaction): Promise<void> => {
          const retryStore: IDBObjectStore = transaction.objectStore(FORGET_STORE);
          const livePostAppeared: boolean = await pruneAndFindLiveEventPosts(
            transaction.objectStore(IN_FLIGHT_POST_STORE),
            retry.installUuid,
            Date.now(),
          );
          if (succeeded) {
            if (!livePostAppeared) retryStore.delete(retry.installUuid);
          } else {
            retry.attempts += 1;
            retry.retryAfter = now + Math.min(
              24 * 60 * 60 * 1000,
              60_000 * 2 ** Math.min(10, retry.attempts),
            );
            retryStore.put(retry);
          }
        },
      );
    } catch {
      // Retry metadata remains available unless storage itself failed.
    }
  }
  emitStatus();
}

async function retryServerDeletions(): Promise<void> {
  if (deletionSweepPromise === null) {
    deletionSweepPromise = runServerDeletionSweep().finally((): void => {
      deletionSweepPromise = null;
    });
  }
  return deletionSweepPromise;
}

async function disableAndErase(): Promise<boolean> {
  stopped = true;
  if (installTimer !== null) {
    clearTimeout(installTimer);
    installTimer = null;
  }
  if (periodicTimer !== null) {
    clearTimeout(periodicTimer);
    periodicTimer = null;
  }
  if (erasePromise === null) {
    erasePromise = purgeAndQueueDeletion().finally((): void => {
      erasePromise = null;
    });
  }
  const purged: boolean = await erasePromise;
  // A POST that started before the synchronous shared stop marker may already
  // be on the wire. Wait for local requests to settle before deleting the old
  // server identity so a late completion cannot recreate attributable rows.
  await Promise.allSettled([...inFlightEventPosts]);
  await retryServerDeletions();
  emitStatus();
  return purged;
}

function scheduleInstallAnnouncement(): void {
  if (installTimer !== null || !collectionMayRun() || activeMounts.size === 0) return;
  installTimer = setTimeout((): void => {
    installTimer = null;
    void flush("install");
  }, INSTALL_GRACE_MS);
}

function schedulePeriodicFlush(): void {
  if (
    periodicTimer !== null ||
    activeMounts.size === 0 ||
    !collectionMayRun()
  ) return;
  const delay: number = PERIODIC_MS + Math.floor(Math.random() * (PERIODIC_JITTER_MS + 1));
  periodicTimer = setTimeout((): void => {
    periodicTimer = null;
    void maintainPrivacyState().then((): void => {
      if (collectionMayRun()) void flush("periodic");
      schedulePeriodicFlush();
    });
  }, delay);
}

async function maintainPrivacyState(): Promise<void> {
  const reason: ConciergeTelemetryReason = currentReason();
  if (reason !== "enabled") {
    await disableAndErase();
    return;
  }
  stopped = false;
  try {
    await upsertLocalLeases();
  } catch {
    return;
  }
  scheduleInstallAnnouncement();
  schedulePeriodicFlush();
  await retryServerDeletions();
  emitStatus();
}

function ensureCoordinator(): void {
  if (!isBrowser() || activeMounts.size === 0) return;
  installBrowserListeners();
  if (maintenanceTimer === null) {
    maintenanceTimer = setInterval((): void => {
      void maintainPrivacyState();
    }, LEASE_RENEW_MS);
  }
  void maintainPrivacyState();
}

function stopCoordinatorIfIdle(): void {
  if (activeMounts.size !== 0) return;
  if (maintenanceTimer !== null) clearInterval(maintenanceTimer);
  if (periodicTimer !== null) clearTimeout(periodicTimer);
  if (installTimer !== null) clearTimeout(installTimer);
  maintenanceTimer = null;
  periodicTimer = null;
  installTimer = null;
  void releaseLocalFlushOwnership();
}

/**
 * Count one mounted Concierge runtime and fixed, privacy-safe dispatch estimates.
 * Multiple mounts of the same Concierge object in one document share one lease.
 */
export function mountConciergeTelemetry(concierge: Concierge): () => void {
  if (!isBrowser()) return (): void => undefined;
  let record: MountRecord | undefined = mountRecords.get(concierge);
  if (record === undefined) {
    let runtimeId: string;
    try {
      runtimeId = requireUuid();
    } catch {
      storageUnavailable = true;
      stopped = true;
      emitStatus();
      return (): void => undefined;
    }
    record = {
      runtimeId,
      concierge,
      refs: 0,
      unsubscribe: null,
    };
    mountRecords.set(concierge, record);
  }
  record.refs += 1;
  if (record.refs === 1) {
    record.unsubscribe = concierge.onDispatch((event): void => {
      if (event.phase === "accepted") void recordAcceptedDispatch();
    });
    activeMounts.add(record);
    ensureCoordinator();
  }

  let active = true;
  return (): void => {
    if (!active) return;
    active = false;
    if (record === undefined) return;
    record.refs = Math.max(0, record.refs - 1);
    if (record.refs === 0) {
      record.unsubscribe?.();
      record.unsubscribe = null;
      activeMounts.delete(record);
      void removeLease(record.runtimeId);
      stopCoordinatorIfIdle();
    }
  };
}

/** Return the cross-tab-aware, origin-wide telemetry status. */
export async function getConciergeTelemetryStatus(): Promise<ConciergeTelemetryStatus> {
  return statusSnapshot();
}

/** Persistently enable or stop-and-erase Concierge telemetry for this origin. */
export async function setConciergeTelemetryEnabled(
  enabled: boolean,
): Promise<ConciergeTelemetryStatus> {
  if (!isBrowser()) {
    storageUnavailable = true;
    stopped = true;
    return statusSnapshot();
  }
  installBrowserListeners();
  try {
    if (enabled) {
      const optedOut: boolean | null = readUserOptOut();
      if (optedOut === null) throw new Error("browser storage is unavailable");
      // If a prior page stopped after writing the synchronous marker but before
      // its IndexedDB cleanup completed, finish that cleanup before lifting the
      // marker. This prevents an old identity or disabled-period queue from
      // resurfacing on re-enable.
      if (optedOut) {
        stopped = true;
        if (!(await purgeAndQueueDeletion())) {
          throw new Error("browser storage is unavailable");
        }
      }
      localStorage.removeItem(OPT_OUT_KEY);
      stopped = globalPrivacyControlEnabled();
      if (!stopped) {
        storageUnavailable = false;
        await openDatabase();
        ensureCoordinator();
        await maintainPrivacyState();
      }
    } else {
      stopped = true;
      localStorage.setItem(OPT_OUT_KEY, "1");
      broadcastStatus();
      await disableAndErase();
    }
  } catch {
    failClosedForStorage();
    if (!enabled) await disableAndErase();
  }
  broadcastStatus();
  return statusSnapshot();
}

/** Subscribe to same-tab and cross-tab status changes. */
export function onConciergeTelemetryStatusChange(
  listener: StatusListener,
): () => void {
  statusListeners.add(listener);
  installBrowserListeners();
  void statusSnapshot().then((status): void => {
    if (!statusListeners.has(listener)) return;
    try {
      listener(status);
    } catch {
      // UI observers cannot interfere with telemetry or dispatch.
    }
  });
  return (): void => {
    statusListeners.delete(listener);
  };
}

// Source-only test seams. They are intentionally not re-exported by the
// browser subpath, so packed artifacts expose only the four documented APIs.
export async function __flushConciergeTelemetryForTests(kind: FlushKind): Promise<void> {
  await maintainPrivacyState();
  await flush(kind);
}

export async function __telemetrySnapshotForTests(): Promise<{
  readonly events: readonly QueuedEvent[];
  readonly inFlightPosts: readonly InFlightEventPost[];
  readonly leases: readonly RuntimeLease[];
  readonly state: StateRecord;
}> {
  return withTransaction(
    [STATE_STORE, EVENT_STORE, LEASE_STORE, IN_FLIGHT_POST_STORE],
    "readonly",
    async (transaction) => ({
      events: await requestResult(
        transaction.objectStore(EVENT_STORE).getAll() as IDBRequest<QueuedEvent[]>,
      ),
      inFlightPosts: await requestResult(
        transaction.objectStore(IN_FLIGHT_POST_STORE).getAll() as IDBRequest<
          InFlightEventPost[]
        >,
      ),
      leases: await requestResult(
        transaction.objectStore(LEASE_STORE).getAll() as IDBRequest<RuntimeLease[]>,
      ),
      state: await readState(transaction.objectStore(STATE_STORE)),
    }),
  );
}

export async function __putInFlightEventPostForTests(
  postId: string,
  installUuid: string,
  expiresAt: number,
): Promise<void> {
  await putInFlightEventPost({ postId, installUuid, expiresAt });
}

export async function __removeInFlightEventPostForTests(
  postId: string,
): Promise<void> {
  await removeInFlightEventPost(postId);
}

export async function __renewInFlightEventPostForTests(
  postId: string,
): Promise<void> {
  await renewInFlightEventPost(postId);
}

export async function __retryServerDeletionsForTests(): Promise<void> {
  await retryServerDeletions();
}

export async function __setPendingTokensForTests(
  tokensIn: number,
  tokensOut: number,
): Promise<void> {
  await withTransaction([STATE_STORE], "readwrite", async (transaction): Promise<void> => {
    const store: IDBObjectStore = transaction.objectStore(STATE_STORE);
    const state: StateRecord = await readState(store);
    state.installUuid ??= requireUuid();
    state.tokensIn = tokensIn;
    state.tokensOut = tokensOut;
    writeState(store, state);
  });
}

export async function __putRuntimeLeaseForTests(
  runtimeId: string,
  expiresAt: number,
): Promise<void> {
  await withTransaction([LEASE_STORE], "readwrite", async (transaction): Promise<void> => {
    transaction.objectStore(LEASE_STORE).put({ runtimeId, expiresAt } satisfies RuntimeLease);
  });
}

export async function __setFlushLeaseForTests(
  owner: string,
  expiresAt: number,
): Promise<void> {
  await withTransaction([STATE_STORE], "readwrite", async (transaction): Promise<void> => {
    const store: IDBObjectStore = transaction.objectStore(STATE_STORE);
    const state: StateRecord = await readState(store);
    state.flushOwner = owner;
    state.flushExpiresAt = expiresAt;
    writeState(store, state);
  });
}

export function __setTelemetryRequestTimeoutForTests(timeoutMs: number): void {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0) {
    throw new TypeError("Telemetry request timeout must be a non-negative safe integer.");
  }
  telemetryRequestTimeoutMs = timeoutMs;
}

export async function __resetConciergeTelemetryForTests(): Promise<void> {
  for (const record of activeMounts) {
    record.unsubscribe?.();
    record.unsubscribe = null;
    record.refs = 0;
  }
  activeMounts.clear();
  stopCoordinatorIfIdle();
  stopped = false;
  storageUnavailable = false;
  erasePromise = null;
  deletionSweepPromise = null;
  localFlushInProgress = false;
  telemetryRequestTimeoutMs = TELEMETRY_REQUEST_TIMEOUT_MS;
  inFlightEventPosts.clear();
  for (const timer of inFlightPostRenewalTimers.values()) clearInterval(timer);
  inFlightPostRenewalTimers.clear();
  tabId = null;
  try {
    localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // Test environments without storage remain fail-closed.
  }
  const database: IDBDatabase | null = await databasePromise?.catch(() => null) ?? null;
  database?.close();
  openedDatabase = null;
  databasePromise = null;
  if (typeof indexedDB !== "undefined") {
    await new Promise<void>((resolve): void => {
      const request: IDBOpenDBRequest = indexedDB.deleteDatabase(DATABASE_NAME);
      request.onsuccess = (): void => resolve();
      request.onerror = (): void => resolve();
      request.onblocked = (): void => resolve();
    });
  }
}
