import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const HOSTILE_SUBJECT =
  `quote"\\newline\nreturn\ransi\u001b\u009bline\u2028paragraph\u2029bidi\u202e` +
  "x".repeat(300);

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
    concierge.stageFor({});
  });

  expect(duplicateWarnings).toHaveLength(1);
  expectEncodedSubject(duplicateWarnings[0], "duplicate_stage_id");
  expect(matcherWarnings).toHaveLength(1);
  expectEncodedSubject(matcherWarnings[0], "stage_match");
});

it("encodes runtime action subjects", async () => {
  const missing = action(HOSTILE_SUBJECT, () => ({ ok: true, message: "unused" }));
  delete missing.handler;
  const missingWarnings = await withCapturedWarnings(async () => {
    const concierge = createConcierge({
      stages: [{ id: "active", match: () => true, actions: [missing] }],
    });
    await concierge.dispatch({}, HOSTILE_SUBJECT, {});
  });
  const resultWarnings = await withCapturedWarnings(async () => {
    const concierge = createConcierge({
      stages: [
        {
          id: "active",
          match: () => true,
          actions: [
            action(HOSTILE_SUBJECT, () => ({
              ok: true,
              reason: "declined",
              message: "normalized",
            })),
          ],
        },
      ],
    });
    await concierge.dispatch({}, HOSTILE_SUBJECT, {});
  });

  expect(missingWarnings).toHaveLength(1);
  expectEncodedSubject(missingWarnings[0], "handler_missing");
  expect(resultWarnings).toHaveLength(1);
  expectEncodedSubject(resultWarnings[0], "invalid_result");
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
    buildCatalog([
      action("confirm", () => ({ ok: true, message: "unused" }), {
        consent: { requires: HOSTILE_SUBJECT },
      }),
    ]);
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
