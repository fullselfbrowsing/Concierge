// Public Session and SessionConfig contracts. These predicates keep the handle narrow,
// make stop observably awaitable, and exercise computed optional values under
// exactOptionalPropertyTypes. Diagnostic aliases are pinned after the source names exist.

import type { Assignable, Equals, Expect } from "./_assert.js";
import type { Session, SessionConfig, StageContext } from "../src/types.js";

type ExpectedSessionDiagnosticCode =
  | "catalog_publish_failed"
  | "batch_dispatch_failed"
  | "response_failed"
  | "stage_listener_failed"
  | "transport_subscribe_failed"
  | "transport_unsubscribe_failed"
  | "catalog_clear_failed"
  | "abort_signal_failed"
  | "batch_without_context";

interface ExpectedSessionDiagnostic {
  readonly code: ExpectedSessionDiagnosticCode;
  readonly message: string;
}

type _sessionKeys = Expect<Equals<keyof Session, "setContext" | "stage" | "onStageChange" | "stop">>;
type _sessionStop = Expect<Equals<Session["stop"], () => Promise<void>>>;
type _sessionConfigKeys = Expect<Equals<keyof SessionConfig, "concierge" | "transport" | "initialContext" | "onDiagnostic">>;
type _sessionConfigRequiredMembers = Expect<Equals<Pick<SessionConfig, "concierge" | "transport">, { concierge: SessionConfig["concierge"]; transport: SessionConfig["transport"] }>>;
type _sessionConfigInitialContext = Expect<Equals<SessionConfig["initialContext"], StageContext | undefined>>;
type _sessionConfigOnDiagnostic = Expect<Equals<SessionConfig["onDiagnostic"], ((diagnostic: ExpectedSessionDiagnostic) => void) | undefined>>;
type _sessionConfigMinimumIsUsable = Expect<Assignable<{ concierge: SessionConfig["concierge"]; transport: SessionConfig["transport"] }, SessionConfig>>;

declare const concierge: SessionConfig["concierge"];
declare const transport: SessionConfig["transport"];
declare const maybeInitialContext: StageContext | undefined;
declare const maybeDiagnosticHook: ((diagnostic: ExpectedSessionDiagnostic) => void) | undefined;

const _configFromComputedInitialContext: SessionConfig = {
  concierge,
  transport,
  initialContext: maybeInitialContext,
};

const _configFromComputedDiagnosticHook: SessionConfig = {
  concierge,
  transport,
  onDiagnostic: maybeDiagnosticHook,
};

const _configRejectsExtraField: SessionConfig = {
  concierge,
  transport,
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

void _configFromComputedInitialContext;
void _configFromComputedDiagnosticHook;
void _configRejectsExtraField;
void _sessionRejectsVoidStop;
