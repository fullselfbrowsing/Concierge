/**
 * @fullselfbrowsing/concierge
 *
 * Typed, consent-gated actions that let an AI agent operate your web app.
 *
 * Pre-alpha: this package exports the design contract, plus the single-instance
 * contract guard (`CONTRACT_VERSION`, `assertSingleInstance`) that stops two
 * independently-resolved copies of core from splitting the bridge registry, the
 * dedup window, and the consent kernel. The rest of the runtime
 * (`createConcierge`, `createSession`, `defineAction`, `defineStage`,
 * `createBridge`) is still being implemented against these types — see the
 * roadmap in the repository README.
 */

export type {
  // Schema interop
  StandardSchemaV1,
  InferOutput,
  JsonSchemaObject,
  AbortSignalLike,
  // Results
  ActionResult,
  AbandonReason,
  FailureReason,
  ReasonCode,
  // Invocation
  InvocationMeta,
  ActionHandler,
  // Consent
  ConsentGrade,
  ConsentPolicy,
  ConsentAck,
  DeliveryReport,
  SnapshotNormalizer,
  Readback,
  ReadbackReceipt,
  ReadbackSink,
  DigestLike,
  ServerChallenge,
  // Side effects
  SideEffects,
  // Redaction
  RedactionPolicy,
  // Actions
  ActionDefinition,
  AnyActionDefinition,
  // Bridges
  Bridge,
  BridgeRegistry,
  // Stages
  StageContext,
  StageDefinition,
  // Transport
  Transport,
  TransportCapabilities,
  TurnIdentityProvenance,
  ToolCall,
  ToolBatch,
  EmittedTool,
  // Concierge
  Scheduler,
  Concierge,
  ConciergeConfig,
  Session,
  SessionConfig,
} from "./types.js";

export {
  USER_CANCELLED,
  USER_DECLINED,
  CONSENT_GRADE_ORDER,
  MESSAGE_MAX_CHARS,
} from "./types.js";

export { CONTRACT_VERSION, assertSingleInstance } from "./contract.js";
