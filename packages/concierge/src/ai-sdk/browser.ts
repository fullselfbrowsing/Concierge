import {
  assertSingleInstance,
  CONTRACT_VERSION,
} from "@fullselfbrowsing/concierge";
import type {
  ActionResult,
  BatchDispatchOutcome,
  Concierge,
  DispatchRow,
  FailureOutcome,
  FailureOutcomeRow,
  StageContext,
  ToolBatch,
  ToolCall,
} from "@fullselfbrowsing/concierge";

import { createAISDKAdapter } from "./index.js";
import type {
  AISDKCatalogSnapshot,
  ConciergeAISDKAdapter,
} from "./index.js";
import {
  canonicalizeString,
  parseCanonicalJson,
} from "./canonical.js";
import {
  asciiBytes,
  decodeBase64Url,
  decodePem,
  webCryptoBytes,
} from "./encoding.js";
import {
  exactRecord,
  safeInteger,
  validIdentifier,
} from "./shape.js";
import {
  ConciergeAISDKConfigurationError,
  DEFAULT_CLOCK_SKEW_MS,
  DEFAULT_MAX_CALLS,
  DEFAULT_MAX_LIFETIME_MS,
  DEFAULT_MAX_PAYLOAD_BYTES,
  EXPECTED_CORE_CONTRACT_VERSION,
} from "./wire.js";
import type {
  BrowserBatchReport,
  CompletedBrowserBatchReport,
  ES256PublicKeySource,
  PresentFailureOutcome,
  ProtectedHeaderV1,
  ReplayStore,
  SignedBridgeDiagnostic,
  SignedBridgeRejectionCode,
  SignedToolBatchEnvelopeV1,
  ToolBatchClaimsV1,
  VerifiedEnvelopeIdentity,
  WebCryptoSource,
} from "./wire.js";

export type {
  BrowserBatchReport,
  CompletedBrowserBatchReport,
  ES256PublicKeySource,
  ReplayStore,
  SignedBridgeDiagnostic,
  SignedBridgeRejectionCode,
  SignedToolBatchEnvelopeV1,
  VerifiedEnvelopeIdentity,
  WebCryptoSource,
} from "./wire.js";

interface VerifiedBatch {
  readonly header: ProtectedHeaderV1;
  readonly claims: ToolBatchClaimsV1;
  readonly identity: VerifiedEnvelopeIdentity;
  readonly verifiedAt: number;
}

export interface SignedBrowserBridge {
  /** Resolve and install the latest app context; superseded updates are ignored. */
  setContext(context: StageContext): Promise<void>;
  accept(
    envelope: SignedToolBatchEnvelopeV1,
    options?: Readonly<{ signal?: AbortSignal | undefined }>,
  ): Promise<BrowserBatchReport>;
  stop(): Promise<void>;
}

function assertContract(): void {
  assertSingleInstance();
  const actual: number = CONTRACT_VERSION;
  if (actual !== EXPECTED_CORE_CONTRACT_VERSION) {
    throw new ConciergeAISDKConfigurationError(
      `@fullselfbrowsing/concierge/ai-sdk expected core contract v${EXPECTED_CORE_CONTRACT_VERSION} ` +
        `but found v${actual}; upgrade or reinstall both packages together.`,
    );
  }
}

function cryptoFor(source: WebCryptoSource | undefined): WebCryptoSource {
  const candidate: Crypto | undefined = source ?? globalThis.crypto;
  if (
    candidate === undefined ||
    typeof candidate.subtle?.verify !== "function" ||
    typeof candidate.subtle.importKey !== "function"
  ) {
    throw new ConciergeAISDKConfigurationError(
      "A WebCrypto ES256 implementation is required.",
    );
  }
  return candidate;
}

function validatePublicKey(key: CryptoKey): CryptoKey {
  const algorithm: KeyAlgorithm = key.algorithm;
  const namedCurve: unknown =
    "namedCurve" in algorithm
      ? (algorithm as EcKeyAlgorithm).namedCurve
      : undefined;
  if (
    key.type !== "public" ||
    algorithm.name !== "ECDSA" ||
    namedCurve !== "P-256" ||
    !key.usages.includes("verify")
  ) {
    throw new ConciergeAISDKConfigurationError(
      "A verification key must be a P-256 ECDSA public key with verify usage.",
    );
  }
  return key;
}

async function importPublicKey(
  crypto: WebCryptoSource,
  source: ES256PublicKeySource,
): Promise<CryptoKey> {
  if (source.format === "crypto-key") return validatePublicKey(source.key);
  const bytes: Uint8Array = source.format === "spki-pem"
    ? decodePem(source.data, "PUBLIC KEY")
    : new Uint8Array(source.data);
  try {
    const key: CryptoKey = await crypto.subtle.importKey(
      "spki",
      webCryptoBytes(bytes),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    return validatePublicKey(key);
  } catch (error) {
    if (error instanceof ConciergeAISDKConfigurationError) throw error;
    throw new ConciergeAISDKConfigurationError(
      "An SPKI ES256 verification key could not be imported.",
    );
  }
}

function snapshotPublicKeySource(value: unknown): ES256PublicKeySource {
  const record = exactRecord(value, ["format"], ["data", "key"]);
  if (
    record?.format === "crypto-key" &&
    typeof record.key === "object" &&
    record.key !== null &&
    !("data" in record)
  ) {
    return Object.freeze({
      format: "crypto-key",
      key: record.key as CryptoKey,
    });
  }
  if (
    record?.format === "spki-pem" &&
    typeof record.data === "string" &&
    !("key" in record)
  ) {
    return Object.freeze({ format: "spki-pem", data: record.data });
  }
  if (
    record?.format === "spki-der" &&
    record.data instanceof Uint8Array &&
    !("key" in record)
  ) {
    return Object.freeze({
      format: "spki-der",
      data: new Uint8Array(record.data),
    });
  }
  throw new ConciergeAISDKConfigurationError(
    "Every public key must be an exact ES256 CryptoKey, SPKI PEM, or SPKI DER source.",
  );
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
  allowZero: boolean,
  label: string,
): number {
  const resolved: number = value ?? fallback;
  if (
    !Number.isSafeInteger(resolved) ||
    resolved < (allowZero ? 0 : 1) ||
    resolved > maximum
  ) {
    throw new ConciergeAISDKConfigurationError(
      `${label} is outside its supported safe-integer range.`,
    );
  }
  return resolved;
}

function rejection(code: SignedBridgeRejectionCode): BrowserBatchReport {
  return Object.freeze({ kind: "rejected", code });
}

function isAborted(signal: AbortSignal | undefined): boolean {
  if (signal === undefined) return false;
  try {
    const getter: (() => boolean) | undefined =
      Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")?.get;
    return getter !== undefined && Reflect.apply(getter, signal, []) === true;
  } catch {
    return true;
  }
}

function snapshotAcceptSignal(value: unknown): AbortSignal | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null) return null;
  try {
    const getter: (() => boolean) | undefined =
      Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")?.get;
    if (getter === undefined) return null;
    Reflect.apply(getter, value, []);
    return value as AbortSignal;
  } catch {
    return null;
  }
}

function strictHeader(value: unknown): ProtectedHeaderV1 | null {
  const record = exactRecord(value, ["alg", "kid", "typ", "v"]);
  if (
    record === null ||
    record.alg !== "ES256" ||
    !validIdentifier(record.kid, 256) ||
    record.typ !== "concierge-tool-batch+jws" ||
    record.v !== 1
  ) {
    return null;
  }
  return Object.freeze({
    alg: "ES256",
    kid: record.kid,
    typ: "concierge-tool-batch+jws",
    v: 1,
  });
}

function strictCall(value: unknown, index: number): ToolCall | null {
  const record = exactRecord(
    value,
    ["callId", "name", "arguments", "outputIndex"],
  );
  if (
    record === null ||
    !validIdentifier(record.callId) ||
    !validIdentifier(record.name) ||
    typeof record.arguments !== "string" ||
    record.outputIndex !== index
  ) {
    return null;
  }
  try {
    const argumentBytes: Uint8Array = new TextEncoder().encode(record.arguments);
    parseCanonicalJson(argumentBytes);
  } catch {
    return null;
  }
  return Object.freeze({
    callId: record.callId,
    name: record.name,
    arguments: record.arguments,
    outputIndex: index,
  });
}

function strictClaims(
  value: unknown,
  maximumCalls: number,
): ToolBatchClaimsV1 | "unsupported" | null {
  const record = exactRecord(
    value,
    [
      "contractVersion",
      "audience",
      "sessionId",
      "catalogStage",
      "catalogDigest",
      "issuedAt",
      "expiresAt",
      "nonce",
      "responseId",
      "userTurnId",
      "calls",
    ],
  );
  if (
    record === null
  ) {
    return null;
  }
  if (record.contractVersion !== EXPECTED_CORE_CONTRACT_VERSION) {
    return "unsupported";
  }
  if (
    !validIdentifier(record.audience) ||
    !validIdentifier(record.sessionId) ||
    (record.catalogStage !== null && !validIdentifier(record.catalogStage)) ||
    typeof record.catalogDigest !== "string" ||
    !safeInteger(record.issuedAt) ||
    record.issuedAt < 0 ||
    !safeInteger(record.expiresAt) ||
    record.expiresAt < 0 ||
    !validIdentifier(record.responseId) ||
    !validIdentifier(record.userTurnId) ||
    !Array.isArray(record.calls) ||
    record.calls.length === 0 ||
    record.calls.length > maximumCalls
  ) {
    return null;
  }
  try {
    if (decodeBase64Url(record.catalogDigest, 32).length !== 32) return null;
    if (
      typeof record.nonce !== "string" ||
      decodeBase64Url(record.nonce, 16).length !== 16
    ) {
      return null;
    }
  } catch {
    return null;
  }
  const calls: ToolCall[] = [];
  const ids: Set<string> = new Set<string>();
  for (let index: number = 0; index < record.calls.length; index += 1) {
    const call: ToolCall | null = strictCall(record.calls[index], index);
    if (call === null || ids.has(call.callId)) return null;
    ids.add(call.callId);
    calls.push(call);
  }
  const base = {
    contractVersion: EXPECTED_CORE_CONTRACT_VERSION,
    audience: record.audience,
    sessionId: record.sessionId,
    catalogStage: record.catalogStage,
    catalogDigest: record.catalogDigest,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    nonce: record.nonce as string,
    responseId: record.responseId,
    userTurnId: record.userTurnId,
    calls: Object.freeze(calls),
  } as const;
  return Object.freeze(base);
}

function identityFor(
  header: ProtectedHeaderV1,
  claims: ToolBatchClaimsV1,
): VerifiedEnvelopeIdentity {
  const base = {
    keyId: header.kid,
    audience: claims.audience,
    sessionId: claims.sessionId,
    catalogStage: claims.catalogStage,
    catalogDigest: claims.catalogDigest,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
    nonce: claims.nonce,
    responseId: claims.responseId,
    userTurnId: claims.userTurnId,
  } as const;
  return Object.freeze(base);
}

function failureOutcomeFor(
  rows: ReadonlyArray<DispatchRow>,
): FailureOutcome | null {
  const failures: FailureOutcomeRow[] = [];
  for (const row of rows) {
    if (row.result.ok) continue;
    failures.push(Object.freeze({
      callId: row.callId,
      reason: row.result.reason,
      message: row.result.message,
    }));
  }
  return failures.length === 0
    ? null
    : Object.freeze({ failures: Object.freeze(failures) });
}

function composeSignal(
  first: AbortSignal | undefined,
  second: AbortSignal,
): Readonly<{ signal: AbortSignal; dispose: () => void }> {
  const controller: AbortController = new AbortController();
  const abort = (): void => controller.abort();
  if (first?.aborted === true || second.aborted) controller.abort();
  first?.addEventListener("abort", abort, { once: true });
  second.addEventListener("abort", abort, { once: true });
  return Object.freeze({
    signal: controller.signal,
    dispose: (): void => {
      first?.removeEventListener("abort", abort);
      second.removeEventListener("abort", abort);
    },
  });
}

function completedReport(
  identity: VerifiedEnvelopeIdentity,
  claims: ToolBatchClaimsV1,
  rows: ReadonlyArray<DispatchRow>,
): CompletedBrowserBatchReport | null {
  if (rows.length !== claims.calls.length) return null;
  const output = [] as Array<Readonly<{
    callId: string;
    name: string;
    outputIndex: number;
    result: Readonly<ActionResult>;
  }>>;
  for (let index: number = 0; index < rows.length; index += 1) {
    const row: DispatchRow | undefined = rows[index];
    const call: ToolCall | undefined = claims.calls[index];
    if (
      row === undefined ||
      call === undefined ||
      row.callId !== call.callId ||
      row.name !== call.name ||
      row.outputIndex !== call.outputIndex
    ) {
      return null;
    }
    output.push(Object.freeze({
      callId: row.callId,
      name: row.name,
      outputIndex: row.outputIndex,
      result: row.result,
    }));
  }
  return Object.freeze({
    kind: "completed",
    identity,
    rows: Object.freeze(output),
  });
}

function validReplayArguments(
  key: string,
  retainUntil: number,
  currentTime: number,
): boolean {
  return validIdentifier(key, 4_096) &&
    Number.isSafeInteger(retainUntil) &&
    retainUntil >= 0 &&
    Number.isSafeInteger(currentTime) &&
    currentTime >= 0;
}

/**
 * Process-local replay storage for tests only.
 * It does not survive reloads and cannot coordinate multiple tabs or workers.
 *
 * Use createIndexedDBReplayStore() in an application.
 */
export function createTestMemoryReplayStore(): ReplayStore {
  const entries: Map<string, number> = new Map<string, number>();
  return Object.freeze({
    async consume(
      key: string,
      retainUntil: number,
      currentTime: number,
    ): Promise<boolean> {
      if (!validReplayArguments(key, retainUntil, currentTime)) {
        throw new TypeError("Replay keys and retention times must be valid.");
      }
      for (const [candidate, expiry] of entries) {
        if (expiry < currentTime) entries.delete(candidate);
      }
      if (entries.has(key)) return false;
      entries.set(key, retainUntil);
      return true;
    },
  });
}

export function createIndexedDBReplayStore(options: Readonly<{
  databaseName?: string | undefined;
  indexedDB?: IDBFactory | undefined;
}> = {}): ReplayStore {
  const factory: IDBFactory | undefined = options.indexedDB ?? globalThis.indexedDB;
  const databaseName: string =
    options.databaseName ?? "fullselfbrowsing-concierge-replay-v1";
  if (!validIdentifier(databaseName)) {
    throw new ConciergeAISDKConfigurationError(
      "The replay database name must be a non-empty JSON string.",
    );
  }
  let databasePromise: Promise<IDBDatabase> | null = null;

  function database(): Promise<IDBDatabase> {
    if (factory === undefined) {
      return Promise.reject(new Error("IndexedDB is unavailable."));
    }
    databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request: IDBOpenDBRequest = factory.open(databaseName, 1);
      request.onupgradeneeded = (): void => {
        const db: IDBDatabase = request.result;
        if (!db.objectStoreNames.contains("nonces")) {
          db.createObjectStore("nonces", { keyPath: "key" });
        }
      };
      request.onsuccess = (): void => resolve(request.result);
      request.onerror = (): void => reject(
        request.error ?? new Error("IndexedDB open failed."),
      );
      request.onblocked = (): void => reject(
        new Error("IndexedDB open was blocked."),
      );
    });
    return databasePromise;
  }

  return Object.freeze({
    async consume(
      key: string,
      retainUntil: number,
      currentTime: number,
    ): Promise<boolean> {
      if (!validReplayArguments(key, retainUntil, currentTime)) {
        throw new TypeError("Replay keys and retention times must be valid.");
      }
      const db: IDBDatabase = await database();
      return await new Promise<boolean>((resolve, reject) => {
        let accepted: boolean = false;
        const transaction: IDBTransaction = db.transaction(
          "nonces",
          "readwrite",
        );
        const store: IDBObjectStore = transaction.objectStore("nonces");
        const getRequest: IDBRequest<unknown> = store.get(key);
        getRequest.onsuccess = (): void => {
          const existing = exactRecord(getRequest.result, ["key", "retainUntil"]);
          if (
            existing !== null &&
            typeof existing.retainUntil === "number" &&
            existing.retainUntil >= currentTime
          ) {
            accepted = false;
            return;
          }
          store.put({ key, retainUntil });
          accepted = true;
          const cursorRequest: IDBRequest<IDBCursorWithValue | null> =
            store.openCursor();
          cursorRequest.onsuccess = (): void => {
            const cursor: IDBCursorWithValue | null = cursorRequest.result;
            if (cursor === null) return;
            const record = exactRecord(cursor.value, ["key", "retainUntil"]);
            if (
              record !== null &&
              typeof record.retainUntil === "number" &&
              record.retainUntil < currentTime
            ) {
              cursor.delete();
            }
            cursor.continue();
          };
        };
        transaction.oncomplete = (): void => resolve(accepted);
        transaction.onerror = (): void => reject(
          transaction.error ?? new Error("IndexedDB transaction failed."),
        );
        transaction.onabort = (): void => reject(
          transaction.error ?? new Error("IndexedDB transaction aborted."),
        );
      });
    },
  });
}

export function createSignedBrowserBridge(input: Readonly<{
  concierge: Concierge;
  audience: string;
  sessionId: string;
  publicKeys: ReadonlyMap<string, ES256PublicKeySource>;
  /** Defaults to durable, cross-tab IndexedDB replay storage. */
  replayStore?: ReplayStore | undefined;
  presentOutcome: PresentFailureOutcome;
  initialContext?: StageContext | undefined;
  deliveryFor?: (
    identity: VerifiedEnvelopeIdentity,
  ) => ToolBatch["deferUntilDelivered"] | undefined;
  crypto?: WebCryptoSource | undefined;
  now?: (() => number) | undefined;
  clockSkewMs?: number | undefined;
  maxLifetimeMs?: number | undefined;
  maxPayloadBytes?: number | undefined;
  maxCalls?: number | undefined;
  onDiagnostic?: ((diagnostic: SignedBridgeDiagnostic) => void) | undefined;
}>): SignedBrowserBridge {
  assertContract();
  if (!validIdentifier(input.audience) || !validIdentifier(input.sessionId)) {
    throw new ConciergeAISDKConfigurationError(
      "The bridge audience and session id must be non-empty JSON strings.",
    );
  }
  if (
    typeof input.presentOutcome !== "function"
  ) {
    throw new ConciergeAISDKConfigurationError(
      "The bridge requires an outcome presenter.",
    );
  }
  if (
    input.replayStore !== undefined &&
    typeof input.replayStore.consume !== "function"
  ) {
    throw new ConciergeAISDKConfigurationError(
      "The replay store must provide an atomic consume method.",
    );
  }
  if (input.now !== undefined && typeof input.now !== "function") {
    throw new ConciergeAISDKConfigurationError(
      "The bridge clock must be a function.",
    );
  }
  const clockSkewMs: number = boundedInteger(
    input.clockSkewMs,
    DEFAULT_CLOCK_SKEW_MS,
    DEFAULT_CLOCK_SKEW_MS,
    true,
    "clockSkewMs",
  );
  const maxLifetimeMs: number = boundedInteger(
    input.maxLifetimeMs,
    DEFAULT_MAX_LIFETIME_MS,
    DEFAULT_MAX_LIFETIME_MS,
    false,
    "maxLifetimeMs",
  );
  const maxPayloadBytes: number = boundedInteger(
    input.maxPayloadBytes,
    DEFAULT_MAX_PAYLOAD_BYTES,
    DEFAULT_MAX_PAYLOAD_BYTES,
    false,
    "maxPayloadBytes",
  );
  const maxCalls: number = boundedInteger(
    input.maxCalls,
    DEFAULT_MAX_CALLS,
    DEFAULT_MAX_CALLS,
    false,
    "maxCalls",
  );
  const crypto: WebCryptoSource = cryptoFor(input.crypto);
  const replayStore: ReplayStore =
    input.replayStore ?? createIndexedDBReplayStore();
  const consumeReplayKey: ReplayStore["consume"] =
    replayStore.consume.bind(replayStore);
  const presentOutcome: PresentFailureOutcome = input.presentOutcome;
  const deliveryFor = input.deliveryFor;
  const onDiagnostic = input.onDiagnostic;
  const dispatchBatch = input.concierge.dispatchBatch.bind(input.concierge);
  const adapter: ConciergeAISDKAdapter = createAISDKAdapter({
    concierge: input.concierge,
    crypto,
  });
  const keySources: Map<string, ES256PublicKeySource> = new Map();
  const keyPromises: Map<string, Promise<CryptoKey>> = new Map();
  for (const [keyId, source] of input.publicKeys) {
    if (!validIdentifier(keyId, 256)) {
      throw new ConciergeAISDKConfigurationError(
        "Every verification key id must be a non-empty JSON string.",
      );
    }
    if (keySources.has(keyId)) {
      throw new ConciergeAISDKConfigurationError(
        "Verification key ids must be unique.",
      );
    }
    keySources.set(keyId, snapshotPublicKeySource(source));
  }
  if (keySources.size === 0) {
    throw new ConciergeAISDKConfigurationError(
      "At least one ES256 verification key is required.",
    );
  }

  let currentContext: StageContext | undefined;
  let currentCatalog: AISDKCatalogSnapshot | undefined;
  let epochController: AbortController = new AbortController();
  let stopped: boolean = false;
  let contextSequence: number = 0;
  let contextReady: Promise<void> = Promise.resolve();
  let dispatchTail: Promise<void> = Promise.resolve();
  const now: () => number = input.now ?? Date.now;

  function diagnose(code: SignedBridgeRejectionCode): void {
    try {
      onDiagnostic?.(Object.freeze({ code }));
    } catch {
      // Diagnostics never affect authorization or dispatch.
    }
  }

  function reject(code: SignedBridgeRejectionCode): BrowserBatchReport {
    diagnose(code);
    return rejection(code);
  }

  async function verifyEnvelope(
    envelope: SignedToolBatchEnvelopeV1,
    signal: AbortSignal | undefined,
  ): Promise<VerifiedBatch | BrowserBatchReport> {
    if (isAborted(signal)) return reject("aborted");
    const record = exactRecord(envelope, ["protected", "payload", "signature"]);
    if (
      record === null ||
      typeof record.protected !== "string" ||
      typeof record.payload !== "string" ||
      typeof record.signature !== "string" ||
      record.protected.length > 4_096 ||
      record.payload.length > Math.ceil(maxPayloadBytes * 4 / 3) + 4 ||
      record.signature.length > 128
    ) {
      return reject("malformed");
    }
    let protectedBytes: Uint8Array;
    let protectedValue: unknown;
    let header: ProtectedHeaderV1 | null;
    let signature: Uint8Array;
    try {
      protectedBytes = decodeBase64Url(record.protected, 3_072);
      protectedValue = parseCanonicalJson(protectedBytes);
      header = strictHeader(protectedValue);
      signature = decodeBase64Url(record.signature, 64);
    } catch {
      return reject("malformed");
    }
    if (header === null || signature.length !== 64) return reject("malformed");
    const keySource: ES256PublicKeySource | undefined = keySources.get(header.kid);
    if (keySource === undefined) return reject("unknown_key");
    let keyPromise: Promise<CryptoKey> | undefined = keyPromises.get(header.kid);
    if (keyPromise === undefined) {
      keyPromise = importPublicKey(crypto, keySource);
      keyPromises.set(header.kid, keyPromise);
    }
    let key: CryptoKey;
    try {
      key = await keyPromise;
    } catch {
      return reject("invalid_signature");
    }
    if (isAborted(signal)) return reject("aborted");
    let verified: boolean;
    try {
      verified = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        webCryptoBytes(signature),
        webCryptoBytes(asciiBytes(`${record.protected}.${record.payload}`)),
      );
    } catch {
      verified = false;
    }
    if (!verified) return reject("invalid_signature");
    if (isAborted(signal)) return reject("aborted");
    let payloadBytes: Uint8Array;
    let claims: ToolBatchClaimsV1 | "unsupported" | null;
    try {
      payloadBytes = decodeBase64Url(record.payload, maxPayloadBytes);
      claims = strictClaims(parseCanonicalJson(payloadBytes), maxCalls);
    } catch {
      return reject("malformed");
    }
    if (claims === "unsupported") return reject("unsupported_contract");
    if (claims === null) return reject("malformed");
    if (claims.audience !== input.audience) return reject("audience_mismatch");
    if (claims.sessionId !== input.sessionId) return reject("session_mismatch");
    const time: number = now();
    if (!Number.isSafeInteger(time) || time < 0) return reject("dispatch_failed");
    if (
      claims.expiresAt <= claims.issuedAt ||
      claims.expiresAt - claims.issuedAt > maxLifetimeMs
    ) {
      return reject("lifetime_exceeded");
    }
    if (claims.issuedAt - time > clockSkewMs) return reject("not_yet_valid");
    if (time - claims.expiresAt > clockSkewMs) return reject("expired");
    const identity: VerifiedEnvelopeIdentity = identityFor(header, claims);
    return Object.freeze({ header, claims, identity, verifiedAt: time });
  }

  async function consumeReplay(
    batch: VerifiedBatch,
  ): Promise<BrowserBatchReport | null> {
    const key: string = canonicalizeString([
      batch.identity.audience,
      batch.identity.keyId,
      batch.identity.sessionId,
      batch.identity.nonce,
    ]);
    try {
      const consumed: boolean = await consumeReplayKey(
        key,
        Math.min(
          Number.MAX_SAFE_INTEGER,
          batch.claims.expiresAt + clockSkewMs,
        ),
        batch.verifiedAt,
      );
      return consumed ? null : reject("replayed");
    } catch {
      return reject("storage_unavailable");
    }
  }

  function enqueue<T>(run: () => Promise<T>): Promise<T> {
    const result: Promise<T> = dispatchTail.then(run, run);
    dispatchTail = result.then(
      (): void => undefined,
      (): void => undefined,
    );
    return result;
  }

  async function waitForLatestContext(): Promise<void> {
    while (true) {
      const observed: Promise<void> = contextReady;
      await observed;
      if (observed === contextReady) return;
    }
  }

  async function dispatchVerified(
    batch: VerifiedBatch,
    callerSignal: AbortSignal | undefined,
  ): Promise<BrowserBatchReport> {
    if (stopped) return reject("stopped");
    if (isAborted(callerSignal)) return reject("aborted");
    await waitForLatestContext();
    if (stopped) return reject("stopped");
    if (isAborted(callerSignal)) return reject("aborted");
    const context: StageContext | undefined = currentContext;
    const catalog: AISDKCatalogSnapshot | undefined = currentCatalog;
    if (context === undefined || catalog === undefined) {
      return reject("catalog_mismatch");
    }
    const epochSignal: AbortSignal = epochController.signal;
    if (
      catalog.stage !== batch.claims.catalogStage ||
      catalog.digest !== batch.claims.catalogDigest
    ) {
      return reject("catalog_mismatch");
    }
    const names: Set<string> = new Set<string>(
      catalog.emittedTools.map((entry) => entry.name),
    );
    if (batch.claims.calls.some((call) => !names.has(call.name))) {
      return reject("catalog_mismatch");
    }
    if (epochSignal.aborted || isAborted(callerSignal)) {
      return reject("aborted");
    }
    const composed = composeSignal(callerSignal, epochSignal);
    let delivery: ToolBatch["deferUntilDelivered"];
    try {
      delivery = deliveryFor?.(batch.identity);
    } catch {
      composed.dispose();
      return reject("dispatch_failed");
    }
    const toolBatch: ToolBatch = Object.freeze({
      sessionId: batch.claims.sessionId,
      responseId: batch.claims.responseId,
      catalogRevision: catalog.revision,
      userTurnId: batch.claims.userTurnId,
      calls: batch.claims.calls,
      signal: composed.signal,
      deferUntilDelivered: delivery,
    });
    let outcome: BatchDispatchOutcome;
    try {
      outcome = await dispatchBatch(context, toolBatch);
    } catch {
      composed.dispose();
      return epochSignal.aborted
        ? reject("catalog_changed")
        : reject("dispatch_failed");
    }
    composed.dispose();
    const failureOutcome: FailureOutcome | null = failureOutcomeFor(outcome.rows);
    if (failureOutcome !== null) {
      let presented: boolean = false;
      try {
        const report = await presentOutcome(failureOutcome);
        presented = report.outcome === "completed";
      } catch {
        presented = false;
      }
      if (!presented) {
        if (outcome.kind === "terminal") stopped = true;
        return reject("outcome_not_presented");
      }
    }
    if (outcome.kind === "terminal") {
      stopped = true;
      epochController.abort();
      return Object.freeze({
        kind: "terminal",
        identity: batch.identity,
        enteredBy: Object.freeze({
          responseId: batch.claims.responseId,
          callId: outcome.enteredBy.callId,
          name: outcome.enteredBy.name,
          outputIndex: outcome.enteredBy.outputIndex,
        }),
      });
    }
    if (epochSignal.aborted) return reject("catalog_changed");
    const completed: CompletedBrowserBatchReport | null = completedReport(
      batch.identity,
      batch.claims,
      outcome.rows,
    );
    return completed ?? reject("dispatch_failed");
  }

  async function accept(
    envelope: SignedToolBatchEnvelopeV1,
    options: Readonly<{ signal?: AbortSignal | undefined }> = {},
  ): Promise<BrowserBatchReport> {
    if (stopped) return reject("stopped");
    const optionRecord = exactRecord(options, [], ["signal"]);
    if (optionRecord === null) return reject("malformed");
    const signal = snapshotAcceptSignal(optionRecord.signal);
    if (signal === null) return reject("malformed");
    const verified: VerifiedBatch | BrowserBatchReport = await verifyEnvelope(
      envelope,
      signal,
    );
    if ("kind" in verified) return verified;
    const replayFailure: BrowserBatchReport | null = await consumeReplay(verified);
    if (replayFailure !== null) return replayFailure;
    if (isAborted(signal)) return reject("aborted");
    return await enqueue(
      async (): Promise<BrowserBatchReport> =>
        await dispatchVerified(verified, signal),
    );
  }

  function setContext(context: StageContext): Promise<void> {
    if (stopped) return Promise.resolve();
    const sequence: number = contextSequence + 1;
    contextSequence = sequence;
    const update: Promise<void> = (async (): Promise<void> => {
      let nextCatalog: AISDKCatalogSnapshot;
      try {
        nextCatalog = await adapter.resolveCatalog(context);
      } catch {
        if (!stopped && sequence === contextSequence) {
          currentContext = undefined;
          currentCatalog = undefined;
          const prior: AbortController = epochController;
          epochController = new AbortController();
          prior.abort();
        }
        return;
      }
      if (stopped || sequence !== contextSequence) return;
      const catalogChanged: boolean = currentCatalog !== undefined && (
        currentCatalog.stage !== nextCatalog.stage ||
        currentCatalog.digest !== nextCatalog.digest
      );
      currentContext = context;
      currentCatalog = nextCatalog;
      if (catalogChanged) {
        const prior: AbortController = epochController;
        epochController = new AbortController();
        prior.abort();
      }
    })();
    contextReady = update;
    return update;
  }

  async function stop(): Promise<void> {
    if (!stopped) {
      stopped = true;
      contextSequence += 1;
      epochController.abort();
    }
    await Promise.all([contextReady, dispatchTail]);
  }

  if (input.initialContext !== undefined) {
    void setContext(input.initialContext);
  }

  return Object.freeze({ setContext, accept, stop });
}
