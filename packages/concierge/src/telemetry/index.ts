/** Why Concierge telemetry is currently enabled or disabled. */
export type ConciergeTelemetryReason =
  | "enabled"
  | "user_opt_out"
  | "global_privacy_control"
  | "storage_unavailable";

/** Current origin-wide collection state. */
export interface ConciergeTelemetryStatus {
  readonly enabled: boolean;
  readonly reason: ConciergeTelemetryReason;
  /** True while an erased installation identity still needs server deletion. */
  readonly serverDeletionPending: boolean;
}

export {
  getConciergeTelemetryStatus,
  mountConciergeTelemetry,
  onConciergeTelemetryStatusChange,
  setConciergeTelemetryEnabled,
} from "./runtime.js";
