import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const COMPLETED_OUTCOME = Object.freeze({ outcome: "completed" });

let createConcierge;
let createSession;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the session consent suite.",
    );
  }

  const artifact = await import(DIST_URL.href);
  createConcierge = artifact.createConcierge;
  createSession = artifact.createSession;
});

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

function completedOutcome() {
  return Promise.resolve(COMPLETED_OUTCOME);
}

function conciergeFor(consentProfile) {
  return createConcierge({ stages: [], consentProfile });
}

function observedTransport(capabilities) {
  const events = [];
  const transport = {
    capabilities,
    get status() {
      events.push("status");
      return "idle";
    },
    setTools() {
      events.push("setTools");
    },
    onStatusChange() {
      events.push("subscribe:status");
      return () => {
        events.push("unsubscribe:status");
      };
    },
    onToolBatch() {
      events.push("subscribe:batch");
      return () => {
        events.push("unsubscribe:batch");
      };
    },
    respond() {
      events.push("respond");
    },
  };
  return { events, transport };
}

function observedAccessorTransport(descriptor) {
  const observed = observedTransport(undefined);
  Object.defineProperty(observed.transport, "capabilities", descriptor);
  return observed;
}

async function attemptStart(config) {
  let message;
  let session;
  try {
    session = createSession(config);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  const constructionEvents = [...config.transportEvents];
  if (session !== undefined) await session.stop();
  return { constructionEvents, message, session };
}

it("[S01] accepts equal, stronger, and absent-declaration capability profiles", async () => {
  const cases = [
    {
      declared: { consentGrade: "relayed", userTurnIdentity: "agent-forgeable" },
      actual: {
        consentGrade: "relayed",
        userTurnIdentity: "agent-forgeable",
        parallelCalls: false,
        dynamicCatalog: true,
      },
    },
    {
      declared: { consentGrade: "delivered", userTurnIdentity: "agent-forgeable" },
      actual: {
        consentGrade: "attested",
        userTurnIdentity: "human-attested",
        parallelCalls: false,
        dynamicCatalog: true,
      },
    },
    {
      declared: undefined,
      actual: {
        consentGrade: "attested",
        userTurnIdentity: "human-attested",
        parallelCalls: false,
        dynamicCatalog: true,
      },
    },
  ];

  const observations = [];
  for (const entry of cases) {
    const { events, transport } = observedTransport(entry.actual);
    const session = createSession({
      concierge: conciergeFor(entry.declared),
      transport,
      presentOutcome: completedOutcome,
    });
    observations.push({ frozen: Object.isFrozen(session), started: events.length > 0 });
    await session.stop();
  }

  expect(observations, "[RED:S01:capability-dominance-positive]").toEqual([
    { frozen: true, started: true },
    { frozen: true, started: true },
    { frozen: true, started: true },
  ]);
});

it("[S02] rejects every weaker capability dimension before transport or app effects", async () => {
  const cases = [
    {
      declared: { consentGrade: "relayed", userTurnIdentity: "agent-forgeable" },
      actual: {
        consentGrade: "delivered",
        userTurnIdentity: "human-attested",
        parallelCalls: false,
        dynamicCatalog: true,
      },
    },
    {
      declared: { consentGrade: "delivered", userTurnIdentity: "human-attested" },
      actual: {
        consentGrade: "attested",
        userTurnIdentity: "agent-forgeable",
        parallelCalls: false,
        dynamicCatalog: true,
      },
    },
    {
      declared: { consentGrade: "attested", userTurnIdentity: "human-attested" },
      actual: {
        consentGrade: "none",
        userTurnIdentity: "none",
        parallelCalls: false,
        dynamicCatalog: true,
      },
    },
  ];

  const observations = [];
  for (const entry of cases) {
    const { events, transport } = observedTransport(entry.actual);
    const observed = await attemptStart({
      concierge: conciergeFor(entry.declared),
      transport,
      transportEvents: events,
      onDiagnostic: () => {
        events.push("diagnostic");
      },
      presentOutcome: async () => {
        events.push("outcome");
        return COMPLETED_OUTCOME;
      },
    });
    observations.push({
      constructionEvents: observed.constructionEvents,
      message: observed.message,
      returnedHandle: observed.session !== undefined,
    });
  }

  expect(observations, "[RED:S02:weaker-profile-pre-effect]").toEqual(
    cases.map(() => ({
      constructionEvents: [],
      message: "The session could not start.",
      returnedHandle: false,
    })),
  );
});

it("[S03] contains malformed, accessor-backed, throwing, and forged capability claims", async () => {
  const sentinel = "PRIVATE-S03-CAPABILITY";
  let topAccessorReads = 0;
  let fieldAccessorReads = 0;
  let nonConsentAccessorReads = 0;
  const accessorProfile = {
    get consentGrade() {
      fieldAccessorReads += 1;
      return "attested";
    },
    userTurnIdentity: "human-attested",
    parallelCalls: false,
    dynamicCatalog: true,
  };
  const throwingProxy = new Proxy({}, {
    getPrototypeOf() {
      throw new Error(sentinel);
    },
  });
  const exoticProfile = Object.assign(Object.create({ inherited: true }), {
    consentGrade: "attested",
    userTurnIdentity: "human-attested",
    parallelCalls: false,
    dynamicCatalog: true,
  });
  const accessorNonConsentCapability = {
    consentGrade: "attested",
    userTurnIdentity: "human-attested",
    get parallelCalls() {
      nonConsentAccessorReads += 1;
      return false;
    },
    dynamicCatalog: true,
  };

  const cases = [
    observedTransport(null),
    observedTransport({
      consentGrade: "invented",
      userTurnIdentity: "human-attested",
      parallelCalls: false,
      dynamicCatalog: true,
    }),
    observedTransport(accessorProfile),
    observedTransport(throwingProxy),
    observedTransport(exoticProfile),
    observedTransport({
      consentGrade: "attested",
      userTurnIdentity: "human-attested",
      dynamicCatalog: true,
    }),
    observedTransport({
      consentGrade: "attested",
      userTurnIdentity: "human-attested",
      parallelCalls: false,
    }),
    observedTransport({
      consentGrade: "attested",
      userTurnIdentity: "human-attested",
      parallelCalls: 0,
      dynamicCatalog: true,
    }),
    observedTransport({
      consentGrade: "attested",
      userTurnIdentity: "human-attested",
      parallelCalls: false,
      dynamicCatalog: "yes",
    }),
    observedTransport(accessorNonConsentCapability),
    observedAccessorTransport({
      enumerable: true,
      configurable: true,
      get() {
        topAccessorReads += 1;
        throw new Error(sentinel);
      },
    }),
  ];

  const observations = [];
  for (const { events, transport } of cases) {
    const observed = await attemptStart({
      concierge: conciergeFor({
        consentGrade: "delivered",
        userTurnIdentity: "human-attested",
      }),
      transport,
      transportEvents: events,
      onDiagnostic: () => {
        events.push("diagnostic");
      },
      presentOutcome: completedOutcome,
    });
    observations.push({
      constructionEvents: observed.constructionEvents,
      leaked: observed.message?.includes(sentinel) ?? false,
      message: observed.message,
      returnedHandle: observed.session !== undefined,
    });
  }

  expect(
    {
      fieldAccessorReads,
      nonConsentAccessorReads,
      observations,
      topAccessorReads,
    },
    "[RED:S03:hostile-capability-containment]",
  ).toEqual({
    fieldAccessorReads: 0,
    nonConsentAccessorReads: 0,
    observations: cases.map(() => ({
      constructionEvents: [],
      leaked: false,
      message: "The session could not start.",
      returnedHandle: false,
    })),
    topAccessorReads: 0,
  });
});

it("[S04] requires and captures one callable outcome sink before session effects", async () => {
  const sentinel = "PRIVATE-S04-OUTCOME-SINK";
  const invalidValues = [undefined, null, "not-a-function"];
  const invalidObservations = [];
  for (const presentOutcome of invalidValues) {
    const { events, transport } = observedTransport({
      consentGrade: "none",
      userTurnIdentity: "none",
      parallelCalls: false,
      dynamicCatalog: true,
    });
    const observed = await attemptStart({
      concierge: conciergeFor(undefined),
      transport,
      transportEvents: events,
      onDiagnostic: () => {
        events.push("diagnostic");
      },
      presentOutcome,
    });
    invalidObservations.push({
      constructionEvents: observed.constructionEvents,
      message: observed.message,
      returnedHandle: observed.session !== undefined,
    });
  }

  let throwingSinkReads = 0;
  const throwingObserved = observedTransport({
    consentGrade: "none",
    userTurnIdentity: "none",
    parallelCalls: false,
    dynamicCatalog: true,
  });
  const throwingConfig = {
    concierge: conciergeFor(undefined),
    transport: throwingObserved.transport,
    transportEvents: throwingObserved.events,
    onDiagnostic: () => {
      throwingObserved.events.push("diagnostic");
    },
    get presentOutcome() {
      throwingSinkReads += 1;
      throw new Error(sentinel);
    },
  };
  const throwingResult = await attemptStart(throwingConfig);

  let sinkReads = 0;
  const { events, transport } = observedTransport({
    consentGrade: "none",
    userTurnIdentity: "none",
    parallelCalls: false,
    dynamicCatalog: true,
  });
  const config = {
    concierge: conciergeFor(undefined),
    transport,
    get presentOutcome() {
      sinkReads += 1;
      return completedOutcome;
    },
  };
  const session = createSession(config);
  const constructionSinkReads = sinkReads;
  await session.stop();

  expect(
    {
      constructionSinkReads,
      invalidObservations,
      throwingSink: {
        constructionEvents: throwingResult.constructionEvents,
        leaked: throwingResult.message?.includes(sentinel) ?? false,
        message: throwingResult.message,
        reads: throwingSinkReads,
        returnedHandle: throwingResult.session !== undefined,
      },
    },
    "[RED:S04:required-captured-outcome-sink]",
  ).toEqual({
    constructionSinkReads: 1,
    invalidObservations: invalidValues.map(() => ({
      constructionEvents: [],
      message: "The session could not start.",
      returnedHandle: false,
    })),
    throwingSink: {
      constructionEvents: [],
      leaked: false,
      message: "The session could not start.",
      reads: 1,
      returnedHandle: false,
    },
  });
  expect(events.length).toBeGreaterThan(0);
});
