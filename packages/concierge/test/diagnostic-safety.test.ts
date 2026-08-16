import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it } from "vitest";

import { dispatchV2 } from "./fixtures/v2-dispatch.js";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const HOSTILE_SUBJECT =
  `quote"\\newline\nreturn\ransi\u001b\u009bline\u2028paragraph\u2029bidi\u202e` +
  "x".repeat(300);
const DELIVERED_PROFILE = {
  consentGrade: "delivered",
  userTurnIdentity: "none",
};

let buildCatalog;
let captureSnapshot;
let createBridge;
let createConcierge;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the diagnostic safety suite.",
    );
  }
  const artifact = await import(DIST_URL.href);
  buildCatalog = artifact.buildCatalog;
  captureSnapshot = artifact.captureSnapshot;
  createBridge = artifact.createBridge;
  createConcierge = artifact.createConcierge;
});

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

function testSchema() {
  return {
    "~standard": {
      version: 1,
      vendor: "diagnostic-safety-test",
      validate: (value) => ({ value }),
    },
  };
}

function action(name, handler, extra = {}) {
  return {
    name,
    description: "diagnostic subject fixture",
    schema: testSchema(),
    jsonSchema: { type: "object" },
    redact: "drop",
    handler,
    effects: { readOnly: true },
    ...extra,
  };
}

async function withCapturedWarnings(run) {
  const realConsole = globalThis.console;
  const captured = [];
  const sink = (message) => captured.push(String(message));
  globalThis.console = { ...realConsole, warn: sink, error: sink, log: sink };
  try {
    await run();
  } finally {
    globalThis.console = realConsole;
  }
  return captured;
}

function expectEncodedSubject(line, code) {
  expect(line).toContain(`[${code}]`);
  expect(line).toContain(
    'quote\\"\\\\newline\\nreturn\\ransi\\u001b\\u009bline\\u2028paragraph\\u2029bidi\\u202e',
  );
  expect(line).not.toMatch(/[\n\r\u001b\u009b\u2028\u2029\u202e]/u);
  expect(line).toContain("…");
  expect(line.length).toBeLessThan(700);
}

it("encodes bridge overwrite subjects", async () => {
  const warnings = await withCapturedWarnings(() => {
    const registry = createBridge(HOSTILE_SUBJECT);
    registry.register({ actions: {}, snapshot: {} });
    registry.register({ actions: {}, snapshot: {} });
  });
  expect(warnings).toHaveLength(1);
  expectEncodedSubject(warnings[0], "bridge_overwrite");
});

it("encodes throwing snapshot-key subjects", async () => {
  const warnings = await withCapturedWarnings(() => {
    captureSnapshot(
      {
        actions: {},
        snapshot: {
          [HOSTILE_SUBJECT]: () => {
            throw new Error("private getter detail");
          },
        },
      },
      "safe",
    );
  });
  expect(warnings).toHaveLength(1);
  expectEncodedSubject(warnings[0], "snapshot_threw");
});

it("encodes throwing snapshot-holder subjects", async () => {
  const warnings = await withCapturedWarnings(() => {
    captureSnapshot(
      {
        actions: {},
        snapshot: new Proxy({}, {
          ownKeys() {
            throw new Error("private holder detail");
          },
        }),
      },
      HOSTILE_SUBJECT,
    );
  });
  expect(warnings).toHaveLength(1);
  expectEncodedSubject(warnings[0], "snapshot_threw");
});

it("encodes exotic snapshot subjects", async () => {
  class Exotic {}
  const warnings = await withCapturedWarnings(() => {
    captureSnapshot(
      { actions: {}, snapshot: { [HOSTILE_SUBJECT]: () => new Exotic() } },
      "safe",
    );
  });
  expect(warnings).toHaveLength(1);
  expectEncodedSubject(warnings[0], "snapshot_exotic");
});

it("encodes duplicate and matcher stage subjects", async () => {
  const duplicateWarnings = await withCapturedWarnings(() => {
    createConcierge({
      stages: [
        { id: HOSTILE_SUBJECT, match: () => false, actions: [] },
        { id: HOSTILE_SUBJECT, match: () => false, actions: [] },
      ],
    });
  });
  const matcherWarnings = await withCapturedWarnings(() => {
    const concierge = createConcierge({
      stages: [
        {
          id: HOSTILE_SUBJECT,
          match() {
            throw new Error("private matcher detail");
          },
          actions: [],
        },
      ],
    });
    concierge.resolveCatalog({});
  });

  expect(duplicateWarnings).toHaveLength(1);
  expectEncodedSubject(duplicateWarnings[0], "duplicate_stage_id");
  expect(matcherWarnings).toHaveLength(1);
  expectEncodedSubject(matcherWarnings[0], "stage_match");
});

it("rejects unsafe runtime action identifiers before diagnostics", async () => {
  const missing = action(HOSTILE_SUBJECT, () => ({ ok: true, message: "unused" }));
  delete missing.handler;
  let result;
  const missingWarnings = await withCapturedWarnings(async () => {
    const concierge = createConcierge({
      stages: [{ id: "active", match: () => true, actions: [missing] }],
    });
    result = await dispatchV2(concierge, {}, HOSTILE_SUBJECT, {});
  });

  expect(result).toMatchObject({ ok: false, reason: "invalid_invocation" });
  expect(missingWarnings).toEqual([]);
});

it("encodes catalog diagnostic action subjects", async () => {
  const warnings = await withCapturedWarnings(() => {
    buildCatalog([
      action(HOSTILE_SUBJECT, () => ({ ok: true, message: "unused" }), {
        effects: { destructive: true },
      }),
    ]);
  });
  expect(warnings).toHaveLength(1);
  expectEncodedSubject(warnings[0], "destructive_without_consent");
});

it("encodes catalog build-error action subjects while preserving structured values", () => {
  let error;
  try {
    buildCatalog([
      action(HOSTILE_SUBJECT, () => ({ ok: true, message: "unused" })),
      action(HOSTILE_SUBJECT, () => ({ ok: true, message: "unused" })),
    ]);
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(Error);
  expect(error.issues[0].action).toBe(HOSTILE_SUBJECT);
  const lines = error.message.split("\n");
  expect(lines).toHaveLength(2);
  expectEncodedSubject(lines[1], "duplicate_action_name");
  expect(lines[1].length).toBeLessThan(900);
});

it("encodes consent targets in catalog messages while preserving raw issue text", () => {
  let error;
  try {
    buildCatalog(
      [
        action("confirm", () => ({ ok: true, message: "unused" }), {
          consent: { requires: HOSTILE_SUBJECT },
        }),
      ],
      { consentProfile: DELIVERED_PROFILE },
    );
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(Error);
  expect(error.issues[0].problem).toContain(HOSTILE_SUBJECT);
  expect(error.issues[0].fix).toContain(HOSTILE_SUBJECT);
  const lines = error.message.split("\n");
  expect(lines).toHaveLength(2);
  expectEncodedSubject(lines[1], "consent_target_missing");
  expect(lines[1].length).toBeLessThan(900);
});

it("contains hostile consent-profile accessors and proxy traps behind fixed prose", () => {
  const secret = "PROFILE-DIAGNOSTIC-SECRET-MUST-NOT-ECHO";
  const expected =
    "Invalid Concierge configuration: consentProfile must contain data-only consentGrade and userTurnIdentity fields with supported values.";
  let nestedReads = 0;
  const accessorProfile = {
    get consentGrade() {
      nestedReads += 1;
      throw new Error(secret);
    },
    userTurnIdentity: "none",
  };
  const throwingProxy = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error(secret);
    },
  });

  for (const profile of [accessorProfile, throwingProxy]) {
    let caught;
    try {
      createConcierge({ stages: [], consentProfile: profile });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TypeError);
    expect(caught.message).toBe(expected);
    expect(caught.message).not.toContain(secret);
  }
  expect(nestedReads).toBe(0);

  let outerReads = 0;
  const config = { stages: [] };
  Object.defineProperty(config, "consentProfile", {
    enumerable: true,
    get() {
      outerReads += 1;
      throw new Error(secret);
    },
  });
  let outerError;
  try {
    createConcierge(config);
  } catch (error) {
    outerError = error;
  }
  expect(outerReads).toBe(1);
  expect(outerError).toBeInstanceOf(TypeError);
  expect(outerError.message).toBe(expected);
  expect(outerError.message).not.toContain(secret);
});
