/**
 * @fullselfbrowsing/concierge contract v2.
 *
 * The framework-neutral core declares typed, consent-gated actions; resolves
 * stage, dynamic availability, tools, and a local catalog revision atomically;
 * and dispatches revision-authorized object requests with complete retry
 * identity. Batch dispatch returns an explicit completed or terminal outcome
 * whose immutable rows retain call, action, output, and dispatch correlation.
 *
 * Handlers receive serial child-action, delay, cancellation, and LIFO cleanup
 * controls. Dispatch lifecycle observation is asynchronous, contained, and
 * governed by each action's redaction policy. `createSession` publishes atomic
 * catalog snapshots, serializes transport batches, aborts superseded catalog
 * epochs, presents failures before releasing outcomes, and stops on terminal
 * execution. The package remains server-safe and framework-independent.
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
  FailureOutcomeRow,
  FailureOutcome,
  OutcomePresentationReport,
  OutcomeSink,
  // Invocation
  InvocationMeta,
  InvocationIdentity,
  DispatchRequest,
  ActionHandler,
  ChildActionRequest,
  WorkflowControls,
  // Consent
  ConsentGrade,
  ConsentProfile,
  ConsentPolicy,
  ConsentAck,
  DeliveryReport,
  ReadbackAttestation,
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
  TransportStatus,
  TurnIdentityProvenance,
  ToolCall,
  ToolBatch,
  EmittedTool,
  CatalogRevision,
  ResolvedCatalog,
  DispatchRow,
  DispatchRef,
  BatchDispatchOutcome,
  ObservedInput,
  DispatchLineage,
  DispatchEvent,
  DispatchListener,
  // Concierge
  Scheduler,
  Concierge,
  ConciergeConfig,
  Explanation,
  StageExplanation,
  Session,
  SessionConfig,
  SessionDiagnosticCode,
  SessionDiagnostic,
} from "./types.js";

export type {
  // Schema emission
  JsonSchemaTarget,
  JsonSchemaConverterOptions,
  JsonSchemaConverter,
} from "./json-schema.js";

export type {
  // Catalog
  Catalog,
  CatalogEntry,
  CatalogIssue,
  CatalogIssueCode,
  CatalogDiagnostic,
  CatalogDiagnosticCode,
  BuildCatalogOptions,
} from "./catalog.js";

export {
  USER_CANCELLED,
  USER_DECLINED,
  CONSENT_GRADE_ORDER,
  MESSAGE_MAX_CHARS,
} from "./types.js";

export { CONTRACT_VERSION, assertSingleInstance } from "./contract.js";

export { JSON_SCHEMA_TARGET } from "./json-schema.js";

export { buildCatalog, CatalogValidationError } from "./catalog.js";

export { defineAction } from "./define-action.js";

export { createConcierge } from "./concierge.js";

export { createSession } from "./session.js";

export { createBridge, captureSnapshot, offPageResult } from "./bridge.js";
