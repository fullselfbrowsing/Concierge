// Public Session and SessionConfig contracts. These predicates keep the handle narrow,
// make stop observably awaitable, and exercise computed optional values under
// exactOptionalPropertyTypes while diagnostics stay closed and immutable.

import type { Assignable, Equals, Expect, Not } from "./_assert.js";
import { createSession } from "../src/index.js";
import type { Session, SessionConfig, SessionDiagnostic, SessionDiagnosticCode, StageContext, Transport, TransportStatus } from "../src/index.js";
import type { FailureOutcome, FailureOutcomeRow, OutcomePresentationReport, OutcomeSink, ReasonCode } from "../src/types.js";

type _createSessionSignature = Expect<Equals<typeof createSession, (config: SessionConfig) => Session>>;
type _sessionKeys = Expect<Equals<keyof Session, "setContext" | "stage" | "onStageChange" | "stop">>;
type _sessionStop = Expect<Equals<Session["stop"], () => Promise<void>>>;
type _failureOutcomeRowKeys = Expect<Equals<keyof FailureOutcomeRow, "callId" | "reason" | "message">>;
type _failureOutcomeRowIsReadonly = Expect<Equals<FailureOutcomeRow, { readonly callId: string; readonly reason: ReasonCode | undefined; readonly message: string }>>;
type _failureOutcomeReasonIsRequired = Expect<Not<Assignable<{ readonly callId: string; readonly message: string }, FailureOutcomeRow>>>;
type _failureOutcomeIsDeeplyReadonly = Expect<Equals<FailureOutcome, { readonly failures: ReadonlyArray<FailureOutcomeRow> }>>;
type _outcomePresentationReportIsExact = Expect<Equals<OutcomePresentationReport, { readonly outcome: "completed" | "interrupted" }>>;
type _outcomeSinkIsExact = Expect<Equals<OutcomeSink, (outcome: FailureOutcome) => Promise<OutcomePresentationReport>>>;
type _sessionConfigKeys = Expect<Equals<keyof SessionConfig, "concierge" | "transport" | "presentOutcome" | "initialContext" | "onDiagnostic">>;
type _sessionConfigRequiredMembers = Expect<Equals<Pick<SessionConfig, "concierge" | "transport" | "presentOutcome">, { concierge: SessionConfig["concierge"]; transport: SessionConfig["transport"]; readonly presentOutcome: OutcomeSink }>>;
type _sessionConfigInitialContext = Expect<Equals<SessionConfig["initialContext"], StageContext | undefined>>;
type _sessionConfigOnDiagnostic = Expect<Equals<SessionConfig["onDiagnostic"], ((diagnostic: SessionDiagnostic) => void) | undefined>>;
type _sessionConfigMinimumIsUsable = Expect<Assignable<{ concierge: SessionConfig["concierge"]; transport: SessionConfig["transport"]; presentOutcome: OutcomeSink }, SessionConfig>>;
type _sessionConfigRejectsMissingOutcomeSink = Expect<Not<Assignable<{ concierge: SessionConfig["concierge"]; transport: SessionConfig["transport"] }, SessionConfig>>>;
type _sessionDiagnosticCodes = Expect<Equals<SessionDiagnosticCode, "catalog_publish_failed" | "batch_dispatch_failed" | "response_failed" | "stage_listener_failed" | "transport_subscribe_failed" | "transport_unsubscribe_failed" | "catalog_clear_failed" | "abort_signal_failed" | "batch_without_context" | "outcome_presentation_failed">>;
type _sessionDiagnosticKeys = Expect<Equals<keyof SessionDiagnostic, "code" | "message">>;
type _sessionDiagnosticIsReadonly = Expect<Equals<SessionDiagnostic, { readonly code: SessionDiagnosticCode; readonly message: string }>>;
type _knownDiagnosticCodeIsUsable = Expect<Assignable<"response_failed", SessionDiagnosticCode>>;
type _transportStatus = Expect<Equals<TransportStatus, "idle" | "connecting" | "connected" | "closed">>;
type _transportStatusCallback = Expect<Equals<Transport["onStatusChange"], (cb: (status: TransportStatus) => void) => () => void>>;

declare const concierge: SessionConfig["concierge"];
declare const transport: SessionConfig["transport"];
declare const presentOutcome: OutcomeSink;
declare const maybeInitialContext: StageContext | undefined;
declare const maybeDiagnosticHook: ((diagnostic: SessionDiagnostic) => void) | undefined;

const _configFromComputedInitialContext: SessionConfig = {
  concierge,
  transport,
  presentOutcome,
  initialContext: maybeInitialContext,
};

const _configFromComputedDiagnosticHook: SessionConfig = {
  concierge,
  transport,
  presentOutcome,
  onDiagnostic: maybeDiagnosticHook,
};

const _configRejectsExtraField: SessionConfig = {
  concierge,
  transport,
  presentOutcome,
  // @ts-expect-error SessionConfig has no raw-detail or fixture-control channel.
  detail: "not public",
};

const _sessionRejectsVoidStop: Session = {
  setContext: () => {},
  stage: () => null,
  onStageChange: () => () => {},
  // @ts-expect-error stop must expose the asynchronous drain boundary.
  stop: () => {},
};

const _diagnosticRejectsArbitraryCode: SessionDiagnostic = {
  // @ts-expect-error Diagnostics use only the closed operational vocabulary.
  code: "arbitrary_failure",
  message: "The operation failed.",
};

const _diagnosticRejectsExtraField: SessionDiagnostic = {
  code: "response_failed",
  message: "The transport rejected a result; it was not retried.",
  // @ts-expect-error Diagnostics cannot expose caught values or raw detail.
  detail: "not public",
};

const _readonlyDiagnostic: SessionDiagnostic = {
  code: "batch_without_context",
  message: "A batch arrived before session context was set and was ignored.",
};

// @ts-expect-error Diagnostic codes are immutable after authorship.
_readonlyDiagnostic.code = "response_failed";
// @ts-expect-error Diagnostic messages are immutable after authorship.
_readonlyDiagnostic.message = "changed";

void _configFromComputedInitialContext;
void _configFromComputedDiagnosticHook;
void _configRejectsExtraField;
void _sessionRejectsVoidStop;
void _diagnosticRejectsArbitraryCode;
void _diagnosticRejectsExtraField;
void _readonlyDiagnostic;
