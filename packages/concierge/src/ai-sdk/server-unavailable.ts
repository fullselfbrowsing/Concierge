import { ConciergeAISDKConfigurationError } from "./wire.js";

export function createSignedBatchIssuer(): never {
  throw new ConciergeAISDKConfigurationError(
    "@full-self-browsing/concierge/ai-sdk/server is unavailable in browser bundles.",
  );
}
