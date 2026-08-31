/**
 * packages/concierge/test/fixtures/probe.ts — PKG-02, the consumer-side type probe.
 *
 * This file is never compiled by this repository. `scripts/pack-install-check.sh`
 * copies it into a `mktemp -d` scratch project outside the repo, where it is
 * compiled by that project's own `typescript@7.0.2` against the **shipped**
 * `dist/index.d.ts` from a real packed tarball, with `skipLibCheck: false`.
 *
 * Two consequences follow, and both are the reason this file looks unlike
 * anything in `test-d/`:
 *
 * 1. It uses plain type annotations rather than `Expect<Equals<…>>`. The
 *    `test-d` helpers live in this repo's program; a foreign program cannot see
 *    them, and installing them would defeat the point of compiling against only
 *    what the tarball ships.
 * 2. It **exports** every binding, unlike every `test-d` file, which export
 *    nothing. Those files are script-shaped on purpose so `isolatedDeclarations`
 *    has nothing to emit for them. This one is a module in a program that has no
 *    `isolatedDeclarations` interaction with this repo at all, so exporting is
 *    free — and it is what stops TS 7 treating the declarations as unused.
 *
 * The scratch project compiles under `lib: ["ES2022"]` with no `@types/node`,
 * the same no-DOM discipline core itself holds. So there is no `console` call
 * anywhere below: `console.log` is `TS2584` under that lib set, and it bit the
 * first draft of this harness. The runtime half of the check is a separate
 * `node --input-type=module -e` in the script, where `console` is available and
 * irrelevant.
 *
 * `MESSAGE_MAX_CHARS`'s literal type is the strongest single assertion available
 * today, because it is the one thing that degrades *silently*: an
 * `isolatedDeclarations` slip widens it to `number`, the build stays green, the
 * repo's own type tests stay green, and only a consumer compiling against the
 * shipped `.d.ts` can see it. That is exactly what this file is.
 *
 * PHASE 3 — THE SAME DEFECT CLASS, ON THE CAT-07 GUARD (T-03-48)
 *
 * The paragraph above described `MESSAGE_MAX_CHARS`. Phase 3 added a guard that
 * fails the same way and matters more. `defineAction`'s `description` parameter
 * is narrowed to `LiteralDescription<N, D>`, which resolves to the literal `D`
 * for a static string and to a long error sentence otherwise — that is CAT-07,
 * the defence against a tool description assembled from i18n, a CMS, or any
 * other attacker-reachable runtime value.
 *
 * Every CAT-07 assertion in this repository lives in `test-d/`, and
 * `tsconfig.test-d.json` compiles `src/**` — so all of them read the SOURCE. No
 * consumer compiles `src/`. If `LiteralDescription` emitted widened, or failed
 * to resolve at all, into `dist/index.d.ts`, **CAT-07 would be dead for every
 * real consumer while every gate in this repository stayed green**:
 * `export-surface.test.ts` reads only the trailing name list,
 * `artifact.test.ts` asserts only `typeof defineAction === "function"`, and
 * `attw` and `publint` were both measured reporting "No problems found" on a
 * build that had LOST an export outright, never mind widened one.
 *
 * So the description slot is pinned below, in this file, because this file is
 * compiled by the only foreign program that reads the shipped declarations.
 * Proved rather than assumed: rewriting the shipped
 * `description: LiteralDescription<N, D>` to `description: string` makes the
 * `descSlotSurvived` annotation `TS2322: Type 'string' is not assignable to
 * type '"Probe description."'`, and changing the annotation's own literal makes
 * it `TS2322` the other way. Both were run; both failed as intended; the
 * unmodified pair passes.
 */

import {
  MESSAGE_MAX_CHARS,
  DEFAULT_ACTION_DATA_MAX_BYTES,
  CONTRACT_VERSION,
  CONSENT_GRADE_ORDER,
  USER_CANCELLED,
  USER_DECLINED,
  assertSingleInstance,
  defineAction,
  buildCatalog,
  createConcierge,
  createSession,
} from "@full-self-browsing/concierge";
import type {
  ActionData,
  ActionResult,
  CatalogRevision,
  Concierge,
  ConsentAck,
  ConsentGrade,
  ConsentPolicy,
  ConsentProfile,
  DeliveryReport,
  DigestLike,
  FailureOutcome,
  FailureOutcomeRow,
  OutcomePresentationReport,
  OutcomeSink,
  Readback,
  ReadbackAttestation,
  ReadbackReceipt,
  ReadbackSink,
  ServerChallenge,
  Session,
  SessionConfig,
  SessionDiagnostic,
  SessionDiagnosticCode,
  SnapshotNormalizer,
  StandardSchemaV1,
  Transport,
  TransportStatus,
  TurnIdentityProvenance,
} from "@full-self-browsing/concierge";
import { createOpenAIRealtimeCodec } from "@full-self-browsing/concierge/openai-realtime";
import type { OpenAIRealtimeCodec } from "@full-self-browsing/concierge/openai-realtime";
import {
  getConciergeTelemetryStatus,
  mountConciergeTelemetry,
  onConciergeTelemetryStatusChange,
  setConciergeTelemetryEnabled,
} from "@full-self-browsing/concierge/telemetry";
import type {
  ConciergeTelemetryReason,
  ConciergeTelemetryStatus,
} from "@full-self-browsing/concierge/telemetry";

/**
 * The shipped interface is constructible from a plain object literal under
 * `strict` and `exactOptionalPropertyTypes: true`. `reason` is omitted here
 * deliberately — its declared `| undefined` is what makes omission legal.
 */
export const r: ActionResult = { ok: true, message: "ok" };
export const richData: ActionData = Object.freeze({
  kind: "probe",
  values: Object.freeze([1, true, null]),
});

/**
 * The whole point of the harness, in one line. If the emitted declaration ever
 * widens to `declare const MESSAGE_MAX_CHARS: number`, this is `TS2322`.
 */
export const n: 180 = MESSAGE_MAX_CHARS; // the literal type survived into the shipped .d.ts

/** Same guard for the contract version, which 02-06 left unannotated in source. */
export const v: 3 = CONTRACT_VERSION;
export const maxActionDataBytes: 262144 = DEFAULT_ACTION_DATA_MAX_BYTES;
export const realtimeCodec: OpenAIRealtimeCodec = createOpenAIRealtimeCodec();

/**
 * A value import of the one function the package actually executes. Annotating
 * it pins the shipped signature as zero-argument and `void`-returning, and
 * importing it as a *value* proves the runtime binding survived the build and
 * is not a type-only export.
 */
export const f: () => void = assertSingleInstance;

/**
 * Two type-only imports that are never instantiated. They exist so that
 * `skipLibCheck: false` has to fully resolve the declaration bodies these names
 * reach — `ConsentAck` pulls in the branded server-challenge machinery and
 * `Transport` pulls in the tool/batch surface, so between them a large share of
 * the ~53 kB `index.d.ts` is checked rather than merely parsed.
 */
export type ProbeAck = ConsentAck;
export type ProbeTransport = Transport;
export type ProbeServerChallenge = ServerChallenge;

/** Consent evidence contracts remain constructible from strict foreign code. */
export const foreignConsentGrade: ConsentGrade = "attested";
export const foreignConsentOrder: readonly ConsentGrade[] = CONSENT_GRADE_ORDER;
export const foreignTurnIdentity: TurnIdentityProvenance = "human-attested";
export const foreignConsentProfile: ConsentProfile = Object.freeze({
  consentGrade: foreignConsentGrade,
  userTurnIdentity: foreignTurnIdentity,
});
export const foreignConsentPolicy: ConsentPolicy<{ amount: number }> =
  Object.freeze({
    requires: "reviewPayment",
    bindTo: "userTurn",
    snapshotEquality: (
      left: { amount: number },
      right: { amount: number },
    ) => left.amount === right.amount,
    minGrade: foreignConsentGrade,
    onMissing: Object.freeze({
      reason: "grade_unavailable",
      message: "The available consent evidence is too weak.",
    }),
  });
export const foreignSnapshotNormalizer: SnapshotNormalizer = <T>(value: T): T =>
  value;
export const foreignReadback: Readback<{ amount: number }> = Object.freeze({
  payload: Object.freeze({ amount: 4_180 }),
  presented: "$41.80",
});
export const foreignReadbackReceipt: ReadbackReceipt = Object.freeze({
  hash: "sha256-probe",
  alg: "SHA-256",
  canonicalization: "JCS",
  canonical: new Uint8Array([1, 2, 3]),
});
export const foreignReadbackSink: ReadbackSink = <P>(
  _readback: Readback<P>,
): Promise<ReadbackReceipt> => Promise.resolve(foreignReadbackReceipt);
export const foreignDigest: DigestLike = {
  digest(_algorithm, data) {
    return Promise.resolve(new ArrayBuffer(data.byteLength));
  },
};
export const foreignReadbackAttestation: ReadbackAttestation = Object.freeze({
  act: "confirmed",
  userTurnId: "turn-human",
  readbackHash: "hash",
});
export const foreignDeliveryReport: DeliveryReport = Object.freeze({
  responseId: "response-probe",
  outcome: "completed",
  readbackHash: foreignReadbackReceipt.hash,
  attestation: foreignReadbackAttestation,
});
export const foreignFailureOutcomeRow: FailureOutcomeRow = Object.freeze({
  callId: "call-failed",
  reason: undefined,
  message: "The application could not complete the action.",
});
export const foreignFailureOutcome: FailureOutcome = Object.freeze({
  failures: Object.freeze([foreignFailureOutcomeRow]),
});
export const foreignOutcomePresentation: OutcomePresentationReport =
  Object.freeze({ outcome: "completed" });
export const foreignOutcomeSink: OutcomeSink = (_outcome) =>
  Promise.resolve(foreignOutcomePresentation);
export const foreignCancelled: ActionResult = USER_CANCELLED;
export const foreignDeclined: ActionResult = USER_DECLINED;

/**
 * A structural stand-in for a validator. `StandardSchemaV1` is already a
 * published type export, so this costs nothing and pulls no dependency into the
 * scratch project — which has zod, arktype and valibot nowhere, by design.
 */
declare const probeSchema: StandardSchemaV1;

/**
 * CAT-07, read out of the shipped declarations.
 *
 * `Parameters<typeof f<A, B, C>>` is an instantiation expression in a type
 * query. TS 7.0.2 accepts it in this position — measured, not assumed, because
 * the fallback (`type FirstArg<F> = F extends (a: infer A, ...rest: never[]) =>
 * unknown ? A : never`) would have been needed if it did not. The parameter
 * shipped as `Omit<ActionDefinition<…>, "description"> & { description: … }`,
 * and `["description"]` indexes straight through that intersection: `Omit`
 * removed the key, so the intersection contributes the only member there is.
 */
type DescSlot = Parameters<typeof defineAction<"probeAction", "Probe description.", typeof probeSchema>>[0]["description"];

/**
 * The assertion. `DescSlot` must resolve — through the shipped declarations
 * alone — to the literal `"Probe description."`. The moment the emitted slot
 * widens to `string`, or `LiteralDescription` fails to resolve in a foreign
 * program, this line is `TS2322` and CAT-07 is reported dead before it ships
 * rather than after.
 *
 * Do NOT "fix" a red here by relaxing the annotation to `string`. A red here IS
 * the finding.
 */
export const descSlotSurvived: "Probe description." = null as unknown as DescSlot;

/**
 * `buildCatalog` imported as a VALUE and annotated — the same thing the `f`
 * binding above does for `assertSingleInstance`, for the same reason. It proves the runtime
 * binding survived the build and is not a type-only export, which `attw` and
 * `publint` were both measured unable to detect.
 *
 * The annotation is deliberately loose. Pinning `buildCatalog`'s real generic
 * signature here would restate what `test-d/` already covers against the
 * source; what this file uniquely proves is that a consumer can reach the
 * binding at all.
 */
export const bc: (a: readonly never[]) => unknown = buildCatalog;
export const conciergeFactory: typeof createConcierge = createConcierge;

/**
 * The foreign declaration probe exercises the complete five-member transport
 * seam from a plain object literal. Nothing here imports a test
 * helper, DOM declaration, or source path; every annotation resolves through
 * the packed package's public `dist/index.d.ts`.
 */
export const foreignStatus: TransportStatus = "idle";
export const foreignTransport: Transport = {
  capabilities: Object.freeze({
    consentGrade: "none",
    userTurnIdentity: "none",
    parallelCalls: false,
    dynamicCatalog: true,
  }),
  status: foreignStatus,
  setCatalog: (_catalog) => {},
  onStatusChange: (_callback) => () => {},
  onToolBatch: (_callback) => () => {},
};

/** A fully structural Concierge, again checked only through shipped types. */
export const foreignConcierge: Concierge = {
  dispatch: (_context, _request) =>
    Promise.resolve({ ok: true, message: "ok" }),
  dispatchBatch: (_context, _batch) => Promise.resolve(Object.freeze({
    kind: "completed",
    rows: Object.freeze([]),
  })),
  resolveCatalog: (_context) => Object.freeze({
    stage: null,
    revision: Symbol("probe") as CatalogRevision,
    tools: Object.freeze([]),
  }),
  onDispatch: (_listener) => () => {},
  explain: (_context) =>
    Object.freeze({
      stage: null,
      stages: Object.freeze([]),
      actions: Object.freeze([]),
      catalog: Object.freeze([]),
    }),
};

/** The browser-only telemetry subpath is present and fully typed in the pack. */
export const foreignTelemetryReason: ConciergeTelemetryReason = "enabled";
export const foreignTelemetryStatus: ConciergeTelemetryStatus = Object.freeze({
  enabled: true,
  reason: foreignTelemetryReason,
  serverDeletionPending: false,
});
export const foreignTelemetryMount: (concierge: Concierge) => () => void =
  mountConciergeTelemetry;
export const foreignTelemetryGet: () => Promise<ConciergeTelemetryStatus> =
  getConciergeTelemetryStatus;
export const foreignTelemetrySet: (
  enabled: boolean,
) => Promise<ConciergeTelemetryStatus> = setConciergeTelemetryEnabled;
export const foreignTelemetryListen: (
  listener: (status: ConciergeTelemetryStatus) => void,
) => () => void = onConciergeTelemetryStatusChange;

/** Pin the closed diagnostic vocabulary and immutable public shape. */
export const foreignDiagnosticCode: SessionDiagnosticCode = "response_failed";
export const foreignDiagnostic: SessionDiagnostic = Object.freeze({
  code: foreignDiagnosticCode,
  message: "The transport rejected a result; it was not retried.",
});

/**
 * These values are deliberately computed as possibly undefined and then
 * written explicitly. That is the foreign EOPT proof for both optional config
 * members; dropping either declared `| undefined` makes this object TS2375.
 */
function initialContextFor(
  status: TransportStatus,
): SessionConfig["initialContext"] {
  return status === "connected" ? { pathname: "/probe" } : undefined;
}

function diagnosticHookFor(
  status: TransportStatus,
): SessionConfig["onDiagnostic"] {
  return status === "connected"
    ? (_diagnostic: SessionDiagnostic) => {}
    : undefined;
}

const computedInitialContext: SessionConfig["initialContext"] =
  initialContextFor(foreignTransport.status);
const computedDiagnosticHook: SessionConfig["onDiagnostic"] =
  diagnosticHookFor(foreignTransport.status);

export const foreignSessionConfig: SessionConfig = {
  concierge: foreignConcierge,
  transport: foreignTransport,
  presentOutcome: foreignOutcomeSink,
  initialContext: computedInitialContext,
  onDiagnostic: computedDiagnosticHook,
};

/** Pin the shipped value binding, factory signature, frozen handle, and drain. */
export const sessionFactory: (config: SessionConfig) => Session = createSession;
export const foreignSession: Session = sessionFactory(foreignSessionConfig);
export const foreignStopDrain: Promise<void> = foreignSession.stop();
