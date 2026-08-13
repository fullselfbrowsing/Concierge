import { ConciergeAISDKConfigurationError } from "./wire.js";

export function createSignedBatchIssuer(): never {
  throw new ConciergeAISDKConfigurationError(
    "@fullselfbrowsing/concierge/ai-sdk/server is unavailable in browser bundles.",
  );
}
