import type {
  ActionResult,
  FailureOutcome,
  InvocationMeta,
  ToolCall,
} from "@full-self-browsing/concierge";

export const SIGNED_ENVELOPE_VERSION = 1 as const;
export const EXPECTED_CORE_CONTRACT_VERSION = 3 as const;
export const DEFAULT_MAX_CALLS = 128 as const;
export const DEFAULT_MAX_PAYLOAD_BYTES = 524_288 as const;
export const DEFAULT_MAX_LIFETIME_MS = 300_000 as const;
export const DEFAULT_TTL_MS = 60_000 as const;
export const DEFAULT_CLOCK_SKEW_MS = 30_000 as const;

export interface SignedToolBatchEnvelopeV1 {
  readonly protected: string;
  readonly payload: string;
  readonly signature: string;
}

export interface ProtectedHeaderV1 {
  readonly alg: "ES256";
  readonly kid: string;
  readonly typ: "concierge-tool-batch+jws";
  readonly v: 1;
}

export interface ToolBatchClaimsV1 {
  readonly contractVersion: 3;
  readonly audience: string;
  readonly sessionId: string;
  readonly catalogStage: string | null;
  readonly catalogDigest: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
  readonly responseId: string;
  readonly userTurnId: string;
  readonly calls: ReadonlyArray<ToolCall>;
}

export interface VerifiedEnvelopeIdentity {
  readonly keyId: string;
  readonly audience: string;
  readonly sessionId: string;
  readonly catalogStage: string | null;
  readonly catalogDigest: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
  readonly responseId: string;
  readonly userTurnId: string;
}

export interface CompletedBrowserBatchReport {
  readonly kind: "completed";
  readonly identity: VerifiedEnvelopeIdentity;
  readonly rows: ReadonlyArray<Readonly<{
    readonly callId: string;
    readonly name: string;
    readonly outputIndex: number;
    readonly result: Readonly<ActionResult>;
  }>>;
}

export type SignedBridgeRejectionCode =
  | "malformed"
  | "unsupported_contract"
  | "unknown_key"
  | "invalid_signature"
  | "audience_mismatch"
  | "session_mismatch"
  | "not_yet_valid"
  | "expired"
  | "lifetime_exceeded"
  | "replayed"
  | "catalog_mismatch"
  | "catalog_changed"
  | "storage_unavailable"
  | "outcome_not_presented"
  | "aborted"
  | "stopped"
  | "dispatch_failed";

export type BrowserBatchReport =
  | CompletedBrowserBatchReport
  | Readonly<{
      kind: "terminal";
      identity: VerifiedEnvelopeIdentity;
      enteredBy: Readonly<{
        responseId: string;
        callId: string;
        name: string;
        outputIndex: number;
      }>;
    }>
  | Readonly<{
      kind: "rejected";
      code: SignedBridgeRejectionCode;
    }>;

export interface ReplayStore {
  /**
   * Atomically consume a key using the bridge's validated logical clock.
   * `false` means another caller already consumed an unexpired key.
   */
  consume(
    key: string,
    retainUntil: number,
    currentTime: number,
  ): Promise<boolean>;
}

export type ES256PrivateKeySource =
  | Readonly<{ format: "pkcs8-der"; data: Uint8Array }>
  | Readonly<{ format: "pkcs8-pem"; data: string }>
  | Readonly<{ format: "crypto-key"; key: CryptoKey }>;

export type ES256PublicKeySource =
  | Readonly<{ format: "spki-der"; data: Uint8Array }>
  | Readonly<{ format: "spki-pem"; data: string }>
  | Readonly<{ format: "crypto-key"; key: CryptoKey }>;

export type WebCryptoSource = Crypto;

export type DeliveryHook = InvocationMeta["deferUntilDelivered"];

export interface SignedBridgeDiagnostic {
  readonly code: SignedBridgeRejectionCode;
}

export type PresentFailureOutcome = (
  outcome: FailureOutcome,
) => Promise<Readonly<{ outcome: "completed" | "interrupted" }>>;

export class ConciergeAISDKConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConciergeAISDKConfigurationError";
  }
}

export class ConciergeAISDKCorrelationError extends Error {
  constructor() {
    super("Concierge results do not match the prepared AI SDK tool calls.");
    this.name = "ConciergeAISDKCorrelationError";
  }
}
