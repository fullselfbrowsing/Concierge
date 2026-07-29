/**
 * @fullselfbrowsing/concierge
 *
 * Typed, consent-gated actions that let an AI agent operate your web app.
 *
 * Pre-alpha. What ships today is the design contract; the single-instance
 * contract guard (`CONTRACT_VERSION`, `assertSingleInstance`) that stops two
 * independently-resolved copies of core from splitting the bridge registry, the
 * dedup window, and the consent kernel; and the declaration half of the
 * runtime. `defineAction` narrows an action's description to a static string
 * literal written at the declaration, so a sentence assembled from i18n, a CMS,
 * or any other runtime value fails to compile rather than reaching a model.
 * `buildCatalog` validates a set of declarations at application start, reports
 * every problem in one throw, and returns a recursively frozen catalog.
 *
 * Stated plainly so this is not oversold: `buildCatalog` *builds* a catalog and
 * nothing here dispatches from it yet. There is no session, no transport and no
 * consent prompt in this package today. What you get is a validated, frozen
 * description of what an agent would be permitted to do — not the thing that
 * lets it do so.
 *
 * The rest of the runtime (`createConcierge`, `createSession`, `defineStage`,
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
