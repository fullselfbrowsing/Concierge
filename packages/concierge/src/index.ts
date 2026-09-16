/**
 * @full-self-browsing/concierge contract v4.
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
  ActionData,
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
  OutputRedactionPolicy,
  Clock,
  DispatchTiming,
  ObservedMessage,
  MessageRedactionPolicy,
  MessageRedactionContext,
  // Actions
  ActionOutputDefinition,
  ActionDefinition,
  AnyActionDefinition,
  // Bridges
  Bridge,
  BridgeRegistry,
  BridgeRegistrationEvent,
  BridgeRegistrationListener,
  ObservableBridgeRegistry,
  RegistrationWaitOptions,
  RegistrationWait,
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
  ObservedResultData,
  ObservedActionResult,
  DispatchLineage,
  DispatchEvent,
  DispatchListener,
  // Concierge
  Scheduler,
  Concierge,
  ConciergeConfig,
  Explanation,
  ActionExplanation,
  StageExplanation,
  Session,
  SessionConfig,
  SessionDiagnosticCode,
  SessionDiagnostic,
  CatalogAcknowledgement,
  ReviewPresentation,
  ReviewRefusalCode,
  ReviewOutcome,
  RetainedReview,
  ReviewControls,
  AttestationOutcome,
} from "./types.js";

export type {
  // Schema emission
  JsonSchemaTarget,
  JsonSchemaConverterOptions,
  JsonSchemaConverter,
} from "./json-schema.js";

export type {
  SanitizeTextOptions,
} from "./message.js";

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
  DEFAULT_ACTION_DATA_MAX_BYTES,
} from "./types.js";

export { CONTRACT_VERSION, assertSingleInstance } from "./contract.js";

export { JSON_SCHEMA_TARGET } from "./json-schema.js";

export { isReasonCode } from "./dispatch.js";

export { sanitizeText } from "./message.js";

export { makeReadbackReceipt } from "./consent-evidence.js";

export { buildCatalog, CatalogValidationError } from "./catalog.js";

export { defineAction } from "./define-action.js";

export { createConcierge } from "./concierge.js";

export { createSession } from "./session.js";

export {
  createBridge,
  captureSnapshot,
  offPageResult,
  awaitRegistration,
} from "./bridge.js";

export type {
  RecordedTurn,
  TurnLedgerConfig,
  TurnLedger,
} from "./turn-ledger.js";
export { createTurnLedger } from "./turn-ledger.js";

export type {
  RenditionEvidence,
  RenditionIssueCode,
  RenditionIssue,
  RenditionSettlement,
  RenditionBinderConfig,
  RenditionBinder,
} from "./rendition.js";
export { createRenditionBinder } from "./rendition.js";

export type {
  ResolveValueRefusal,
  ResolveValueResult,
  ResolveValueConfig,
} from "./resolve-value.js";
export { resolveValue } from "./resolve-value.js";

export type {
  CatalogPromptFormat,
  RenderCatalogPromptOptions,
  CatalogDerivedPolicy,
} from "./catalog-prompt.js";
export { renderCatalogPrompt, catalogDerivedPolicy } from "./catalog-prompt.js";
