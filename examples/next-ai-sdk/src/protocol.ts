import type { SignedToolBatchEnvelopeV1 } from "@full-self-browsing/concierge/ai-sdk";

export const CONCIERGE_AUDIENCE = "concierge-next-ai-sdk-example";
export const SESSION_COOKIE = "concierge_example_session";

export interface BootstrapResponse {
  readonly audience: typeof CONCIERGE_AUDIENCE;
  readonly sessionId: string;
  readonly publicKeyPem: string;
}

export interface ConciergeEnvelopeData {
  readonly envelope: SignedToolBatchEnvelopeV1;
}

export interface ConciergeRetryData {
  readonly reason: "catalog-stale";
}

export type ConciergeUIData = {
  "concierge-envelope": ConciergeEnvelopeData;
  "concierge-retry": ConciergeRetryData;
};
