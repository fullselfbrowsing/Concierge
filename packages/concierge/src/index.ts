/**
 * @fullselfbrowsing/concierge
 *
 * Typed, consent-gated actions that let an AI agent operate your web app.
 *
 * Pre-alpha: this package currently exports the design contract only. The
 * runtime (`createConcierge`, `defineAction`, `defineStage`, `createBridge`)
 * is being implemented against these types — see the roadmap in the repository
 * README.
 */

export type {
  // Schema interop
  StandardSchemaV1,
  InferOutput,
  JsonSchemaObject,
  AbortSignalLike,
  // Results
  ActionResult,
  // Invocation
  InvocationMeta,
  ActionHandler,
  // Consent
  ConsentGrade,
  ConsentPolicy,
  ConsentAck,
  // Redaction
  RedactionPolicy,
  // Actions
  ActionDefinition,
  // Bridges
  Bridge,
  BridgeRegistry,
  // Stages
  StageContext,
  StageDefinition,
  // Transport
  Transport,
  TransportCapabilities,
  ToolCall,
  EmittedTool,
  // Dispatcher
  Concierge,
  ConciergeConfig,
} from "./types.js";

export { USER_STOPPED } from "./types.js";
