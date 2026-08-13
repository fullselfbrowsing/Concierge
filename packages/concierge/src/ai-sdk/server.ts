import {
  assertSingleInstance,
  CONTRACT_VERSION,
} from "@fullselfbrowsing/concierge";
import type { StageContext } from "@fullselfbrowsing/concierge";

import type {
  ConciergeAISDKAdapter,
  PreparedAISDKStep,
} from "./index.js";
import {
  canonicalizeBytes,
  parseCanonicalJson,
  strictJsonClone,
} from "./canonical.js";
import {
  asciiBytes,
  decodeBase64Url,
  decodePem,
  encodeBase64Url,
  webCryptoBytes,
} from "./encoding.js";
import { exactRecord, validIdentifier } from "./shape.js";
import {
  ConciergeAISDKConfigurationError,
  DEFAULT_MAX_CALLS,
  DEFAULT_MAX_LIFETIME_MS,
  DEFAULT_MAX_PAYLOAD_BYTES,
  DEFAULT_TTL_MS,
  EXPECTED_CORE_CONTRACT_VERSION,
  SIGNED_ENVELOPE_VERSION,
} from "./wire.js";
import type {
  ES256PrivateKeySource,
  ProtectedHeaderV1,
  SignedToolBatchEnvelopeV1,
  ToolBatchClaimsV1,
  WebCryptoSource,
} from "./wire.js";

export type {
  ES256PrivateKeySource,
  SignedToolBatchEnvelopeV1,
  ToolBatchClaimsV1,
  WebCryptoSource,
} from "./wire.js";

export type SignedBatchIssueResult =
  | Readonly<{
      kind: "issued";
      envelope: SignedToolBatchEnvelopeV1;
      claims: ToolBatchClaimsV1;
    }>
  | Readonly<{ kind: "stale-catalog" }>
  | Readonly<{ kind: "aborted" }>;

export interface SignedBatchIssuer {
  issue(input: Readonly<{
    sessionId: string;
    currentContext: StageContext;
    prepared: PreparedAISDKStep;
    signal?: AbortSignal | undefined;
  }>): Promise<SignedBatchIssueResult>;
}

interface PreparedBatchSnapshot {
  readonly responseId: string;
  readonly userTurnId: string;
  readonly calls: ToolBatchClaimsV1["calls"];
}

function invalidPreparedStep(): never {
  throw new ConciergeAISDKConfigurationError(
    "The prepared AI SDK step is invalid or no longer matches its catalog.",
  );
}

function snapshotPreparedBatch(
  value: unknown,
  current: Awaited<ReturnType<ConciergeAISDKAdapter["resolveCatalog"]>>,
): PreparedBatchSnapshot | "stale" {
  try {
    if (
      (current.stage !== null && !validIdentifier(current.stage)) ||
      typeof current.revision !== "symbol" ||
      typeof current.digest !== "string" ||
      decodeBase64Url(current.digest, 32).length !== 32 ||
      !Array.isArray(current.emittedTools)
    ) {
      invalidPreparedStep();
    }
  } catch {
    invalidPreparedStep();
  }
  const prepared = exactRecord(value, ["catalog", "batch", "correlation"]);
  const catalog = exactRecord(
    prepared?.catalog,
    ["stage", "revision", "digest", "emittedTools", "aiTools"],
  );
  const batch = exactRecord(
    prepared?.batch,
    ["responseId", "userTurnId", "calls"],
  );
  if (
    prepared === null ||
    catalog === null ||
    batch === null ||
    !validIdentifier(batch.responseId) ||
    !validIdentifier(batch.userTurnId)
  ) {
    invalidPreparedStep();
  }
  if (
    catalog.stage !== current.stage ||
    catalog.revision !== current.revision ||
    catalog.digest !== current.digest
  ) {
    return "stale";
  }

  let callsValue: unknown;
  let correlationValue: unknown;
  try {
    callsValue = strictJsonClone(batch.calls);
    correlationValue = strictJsonClone(prepared.correlation);
  } catch {
    invalidPreparedStep();
  }
  if (
    !Array.isArray(callsValue) ||
    callsValue.length === 0 ||
    callsValue.length > DEFAULT_MAX_CALLS ||
    !Array.isArray(correlationValue) ||
    correlationValue.length !== callsValue.length
  ) {
    invalidPreparedStep();
  }

  const knownNames: Set<string> = new Set<string>();
  try {
    for (const emitted of current.emittedTools) {
      const record = exactRecord(
        emitted,
        ["type", "name", "description", "parameters"],
      );
      if (
        record === null ||
        record.type !== "function" ||
        !validIdentifier(record.name) ||
        knownNames.has(record.name)
      ) {
        invalidPreparedStep();
      }
      knownNames.add(record.name);
    }
  } catch {
    invalidPreparedStep();
  }

  const identifiers: Set<string> = new Set<string>();
  const calls: ToolBatchClaimsV1["calls"][number][] = [];
  for (let index = 0; index < callsValue.length; index += 1) {
    const call = exactRecord(
      callsValue[index],
      ["callId", "name", "arguments", "outputIndex"],
    );
    const correlation = exactRecord(
      correlationValue[index],
      ["toolCallId", "toolName", "outputIndex"],
    );
    if (
      call === null ||
      correlation === null ||
      !validIdentifier(call.callId) ||
      !validIdentifier(call.name) ||
      !knownNames.has(call.name) ||
      identifiers.has(call.callId) ||
      typeof call.arguments !== "string" ||
      call.outputIndex !== index ||
      correlation.toolCallId !== call.callId ||
      correlation.toolName !== call.name ||
      correlation.outputIndex !== index
    ) {
      invalidPreparedStep();
    }
    try {
      parseCanonicalJson(new TextEncoder().encode(call.arguments));
    } catch {
      invalidPreparedStep();
    }
    identifiers.add(call.callId);
    calls.push(Object.freeze({
      callId: call.callId,
      name: call.name,
      arguments: call.arguments,
      outputIndex: index,
    }));
  }

  return Object.freeze({
    responseId: batch.responseId,
    userTurnId: batch.userTurnId,
    calls: Object.freeze(calls),
  });
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
    typeof candidate.getRandomValues !== "function" ||
    typeof candidate.subtle?.importKey !== "function" ||
    typeof candidate.subtle.sign !== "function"
  ) {
    throw new ConciergeAISDKConfigurationError(
      "A WebCrypto ES256 implementation is required.",
    );
  }
  return candidate;
}

function validatePrivateKey(key: CryptoKey): CryptoKey {
  const algorithm: KeyAlgorithm = key.algorithm;
  const namedCurve: unknown =
    "namedCurve" in algorithm
      ? (algorithm as EcKeyAlgorithm).namedCurve
      : undefined;
  if (
    key.type !== "private" ||
    algorithm.name !== "ECDSA" ||
    namedCurve !== "P-256" ||
    !key.usages.includes("sign")
  ) {
    throw new ConciergeAISDKConfigurationError(
      "The signing key must be a P-256 ECDSA private key with sign usage.",
    );
  }
  return key;
}

async function importPrivateKey(
  crypto: WebCryptoSource,
  source: ES256PrivateKeySource,
): Promise<CryptoKey> {
  if (source.format === "crypto-key") return validatePrivateKey(source.key);
  const bytes: Uint8Array = source.format === "pkcs8-pem"
    ? decodePem(source.data, "PRIVATE KEY")
    : new Uint8Array(source.data);
  try {
    const key: CryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      webCryptoBytes(bytes),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    return validatePrivateKey(key);
  } catch (error) {
    if (error instanceof ConciergeAISDKConfigurationError) throw error;
    throw new ConciergeAISDKConfigurationError(
      "The PKCS #8 ES256 signing key could not be imported.",
    );
  }
}

function snapshotPrivateKeySource(value: unknown): ES256PrivateKeySource {
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
    record?.format === "pkcs8-pem" &&
    typeof record.data === "string" &&
    !("key" in record)
  ) {
    return Object.freeze({ format: "pkcs8-pem", data: record.data });
  }
  if (
    record?.format === "pkcs8-der" &&
    record.data instanceof Uint8Array &&
    !("key" in record)
  ) {
    return Object.freeze({
      format: "pkcs8-der",
      data: new Uint8Array(record.data),
    });
  }
  throw new ConciergeAISDKConfigurationError(
    "privateKey must be an exact ES256 CryptoKey, PKCS #8 PEM, or PKCS #8 DER source.",
  );
}

function boundedMilliseconds(
  value: number | undefined,
  fallback: number,
  maximum: number,
  label: string,
): number {
  const resolved: number = value ?? fallback;
  if (
    !Number.isSafeInteger(resolved) ||
    resolved <= 0 ||
    resolved > maximum
  ) {
    throw new ConciergeAISDKConfigurationError(
      `${label} must be a positive safe integer no greater than ${maximum}.`,
    );
  }
  return resolved;
}

function nowValue(now: () => number): number {
  const value: number = now();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ConciergeAISDKConfigurationError(
      "The issuer clock must return non-negative epoch milliseconds.",
    );
  }
  return value;
}

const ABORTED_GETTER: (() => boolean) | undefined =
  Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")?.get;

function snapshotSignal(value: unknown): AbortSignal | undefined {
  if (value === undefined) return undefined;
  if (
    typeof value !== "object" ||
    value === null ||
    ABORTED_GETTER === undefined
  ) {
    invalidPreparedStep();
  }
  try {
    Reflect.apply(ABORTED_GETTER, value, []);
  } catch {
    invalidPreparedStep();
  }
  return value as AbortSignal;
}

function isAborted(signal: AbortSignal | undefined): boolean {
  if (signal === undefined) return false;
  try {
    return Reflect.apply(ABORTED_GETTER as () => boolean, signal, []) === true;
  } catch {
    invalidPreparedStep();
  }
}

export function createSignedBatchIssuer(input: Readonly<{
  adapter: ConciergeAISDKAdapter;
  audience: string;
  keyId: string;
  privateKey: ES256PrivateKeySource;
  ttlMs?: number | undefined;
  maxLifetimeMs?: number | undefined;
  maxPayloadBytes?: number | undefined;
  crypto?: WebCryptoSource | undefined;
  now?: (() => number) | undefined;
}>): SignedBatchIssuer {
  assertContract();
  if (!validIdentifier(input.audience) || !validIdentifier(input.keyId, 256)) {
    throw new ConciergeAISDKConfigurationError(
      "The issuer audience and key id must be non-empty JSON strings.",
    );
  }
  if (input.now !== undefined && typeof input.now !== "function") {
    throw new ConciergeAISDKConfigurationError(
      "The issuer clock must be a function.",
    );
  }
  const maxLifetimeMs: number = boundedMilliseconds(
    input.maxLifetimeMs,
    DEFAULT_MAX_LIFETIME_MS,
    DEFAULT_MAX_LIFETIME_MS,
    "maxLifetimeMs",
  );
  const ttlMs: number = boundedMilliseconds(
    input.ttlMs,
    DEFAULT_TTL_MS,
    maxLifetimeMs,
    "ttlMs",
  );
  const maxPayloadBytes: number = boundedMilliseconds(
    input.maxPayloadBytes,
    DEFAULT_MAX_PAYLOAD_BYTES,
    DEFAULT_MAX_PAYLOAD_BYTES,
    "maxPayloadBytes",
  );
  const crypto: WebCryptoSource = cryptoFor(input.crypto);
  const now: () => number = input.now ?? Date.now;
  const resolveCatalog = input.adapter.resolveCatalog.bind(input.adapter);
  const privateKey: ES256PrivateKeySource = snapshotPrivateKeySource(
    input.privateKey,
  );
  let keyPromise: Promise<CryptoKey> | undefined;
  const signingKey = (): Promise<CryptoKey> => {
    keyPromise ??= importPrivateKey(crypto, privateKey);
    return keyPromise;
  };
  const protectedHeader: ProtectedHeaderV1 = Object.freeze({
    alg: "ES256",
    kid: input.keyId,
    typ: "concierge-tool-batch+jws",
    v: SIGNED_ENVELOPE_VERSION,
  });
  const protectedPart: string = encodeBase64Url(
    canonicalizeBytes(protectedHeader),
  );

  async function issue(value: Readonly<{
    sessionId: string;
    currentContext: StageContext;
    prepared: PreparedAISDKStep;
    signal?: AbortSignal | undefined;
  }>): Promise<SignedBatchIssueResult> {
    const request = exactRecord(
      value,
      ["sessionId", "currentContext", "prepared"],
      ["signal"],
    );
    if (request === null) invalidPreparedStep();
    const signal: AbortSignal | undefined = snapshotSignal(request.signal);
    if (isAborted(signal)) {
      return Object.freeze({ kind: "aborted" });
    }
    if (!validIdentifier(request.sessionId)) {
      throw new ConciergeAISDKConfigurationError(
        "The session id must be a non-empty JSON string.",
      );
    }
    const current = await resolveCatalog(request.currentContext as StageContext);
    if (isAborted(signal)) {
      return Object.freeze({ kind: "aborted" });
    }
    const prepared = snapshotPreparedBatch(request.prepared, current);
    if (prepared === "stale") {
      return Object.freeze({ kind: "stale-catalog" });
    }
    const issuedAt: number = nowValue(now);
    const expiresAt: number = issuedAt + ttlMs;
    if (!Number.isSafeInteger(expiresAt)) {
      throw new ConciergeAISDKConfigurationError(
        "The envelope expiry is outside the safe integer range.",
      );
    }
    const nonceBytes: Uint8Array<ArrayBuffer> = new Uint8Array(
      new ArrayBuffer(16),
    );
    crypto.getRandomValues(nonceBytes);
    const baseClaims = {
      contractVersion: EXPECTED_CORE_CONTRACT_VERSION,
      audience: input.audience,
      sessionId: request.sessionId,
      catalogStage: current.stage,
      catalogDigest: current.digest,
      issuedAt,
      expiresAt,
      nonce: encodeBase64Url(nonceBytes),
      responseId: prepared.responseId,
      userTurnId: prepared.userTurnId,
      calls: prepared.calls,
    } as const;
    const claims: ToolBatchClaimsV1 = Object.freeze(baseClaims);
    const payloadBytes: Uint8Array = canonicalizeBytes(claims);
    if (payloadBytes.length > maxPayloadBytes) {
      throw new ConciergeAISDKConfigurationError(
        "The signed tool batch exceeds maxPayloadBytes.",
      );
    }
    const payloadPart: string = encodeBase64Url(payloadBytes);
    const signingInput: Uint8Array = asciiBytes(
      `${protectedPart}.${payloadPart}`,
    );
    if (isAborted(signal)) {
      return Object.freeze({ kind: "aborted" });
    }
    const key: CryptoKey = await signingKey();
    let signatureBuffer: ArrayBuffer;
    try {
      signatureBuffer = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        webCryptoBytes(signingInput),
      );
    } catch {
      throw new ConciergeAISDKConfigurationError(
        "WebCrypto could not sign the tool batch.",
      );
    }
    if (isAborted(signal)) {
      return Object.freeze({ kind: "aborted" });
    }
    const signature: Uint8Array = new Uint8Array(signatureBuffer);
    if (signature.length !== 64) {
      throw new ConciergeAISDKConfigurationError(
        "WebCrypto returned a non-P1363 ES256 signature.",
      );
    }
    return Object.freeze({
      kind: "issued",
      claims,
      envelope: Object.freeze({
        protected: protectedPart,
        payload: payloadPart,
        signature: encodeBase64Url(signature),
      }),
    });
  }

  return Object.freeze({ issue });
}
