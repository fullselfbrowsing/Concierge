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
 * `createConcierge` assembles those declarations into one catalog, scopes it to
 * where the user is, and answers why. Given a set of stages it returns
 * `catalogFor(ctx)` — the frozen tool list for the matching stage plus the
 * cross-stage actions, handed back at the *same reference* for any two contexts
 * that resolve to the same stage — along with `stageFor(ctx)` and `explain(ctx)`,
 * which reports the active stage, every stage's matched flag, each stage's
 * bridge status and the live catalog in one pass.
 *
 * Direct context-aware dispatch is now implemented. `dispatch(ctx, name, args,
 * meta?)` checks the supplied stage before handler lookup, revalidates the
 * arguments, holds non-read-only actions behind a cancellable commit window,
 * resolves the stage's live bridge, invokes the handler, and returns a fresh
 * normalized and sanitized result. Retries share the exact final Promise while
 * pending and through the configured settled window.
 *
 * `dispatchBatch(ctx, batch)` adds transport-independent `ToolBatch` parsing
 * and serial execution on top of that same single-call boundary. It copies and
 * stably orders calls by `outputIndex`, returns a frozen array of frozen
 * `{ callId, result }` correlation rows, and includes an `aborted` result for
 * every call that remains after cancellation. An application agent loop can
 * supply its own `StageContext` and `ToolBatch` directly; no `Transport` is
 * required to use either dispatch method.
 *
 * Bridges are constructible — `createBridge` returns a registry that a mounted
 * page component registers itself into, `captureSnapshot` detaches what that
 * component exposes so a captured value cannot drift afterwards, and
 * `offPageResult` is the sentence a handler returns when nothing is registered.
 * Direct dispatch now routes through that one live registry seam and passes
 * `null` honestly when nothing is mounted.
 *
 * `createSession` now owns the hot transport loop. It publishes the initial
 * catalog, reconciles catalog identity on context changes, replays the current
 * catalog after a real reconnect, routes accepted batches through
 * `dispatchBatch`, and returns each result through the transport. Its frozen
 * handle also exposes current-stage observation and an awaitable stop drain.
 *
 * Stated plainly so this is not oversold: Session does not implement consent,
 * telemetry, or framework lifecycle adapters. Consent policy remains a later
 * runtime layer, and React, Vue, and Svelte integrations remain separate
 * adapter packages. `defineStage` is **not planned**: a stage needs no identity
 * mechanism, a plain `StageDefinition` object literal already typechecks, and
 * the unforgeable bridge identity that would have justified it belongs to
 * `createBridge`. See the roadmap in the repository README.
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
  TransportStatus,
  TurnIdentityProvenance,
  ToolCall,
  ToolBatch,
  EmittedTool,
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
