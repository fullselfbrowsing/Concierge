/**
 * @fullselfbrowsing/concierge
 *
 * Typed, consent-gated actions that let an AI agent operate your web app.
 *
 * Pre-alpha: this package currently exports the design contract only. The
 * runtime (`createConcierge`, `createSession`, `defineAction`, `defineStage`,
 * `createBridge`) is being implemented against these types — see the roadmap
 * in the repository README.
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
