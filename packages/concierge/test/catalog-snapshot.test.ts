import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, expect, it } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const CONTRACT_KEY = Symbol.for("@fullselfbrowsing/concierge.contract");

let CatalogValidationError;
let createBridge;
let createConcierge;

beforeAll(async () => {
  if (!existsSync(fileURLToPath(DIST_URL))) {
    throw new Error("Build concierge before testing.");
  }
  ({ CatalogValidationError, createBridge, createConcierge } = await import(
    DIST_URL.href
  ));
});

beforeEach(() => {
  delete globalThis[CONTRACT_KEY];
});

function schema() {
  return {
    "~standard": {
      version: 1,
      vendor: "concierge-snapshot-test",
      validate: (value) => ({ value }),
    },
  };
}

function action(name, extra = {}) {
  return {
    name,
    description: `Run ${name}.`,
    schema: schema(),
    jsonSchema: { type: "object" },
    redact: "drop",
    effects: { readOnly: true },
    handler: () => ({ ok: true, message: "Done." }),
    ...extra,
  };
}

it("errors when a parameterized snapshot slot is registered at catalog build", () => {
  const registry = createBridge("snapshot-arity");
  registry.register({
    actions: {},
    snapshot: {
      getRates: (id) => [{ id }],
    },
  });

  expect(() =>
    createConcierge({
      stages: [
        {
          id: "active",
          match: () => true,
          bridge: registry,
          actions: [action("review")],
        },
      ],
    }),
  ).toThrow(CatalogValidationError);
});

it("errors on a vacuous consent snapshot under a non-none profile", () => {
  const registry = createBridge("snapshot-empty");
  registry.register({
    actions: {},
    snapshot: {},
  });

  try {
    createConcierge({
      stages: [
        {
          id: "active",
          match: () => true,
          bridge: registry,
          actions: [
            action("review"),
            action("confirm", {
              consent: {
                requires: "review",
                bindTo: "response",
              },
            }),
          ],
        },
      ],
      consentProfile: {
        consentGrade: "delivered",
        userTurnIdentity: "agent-forgeable",
      },
    });
    throw new Error("expected vacuous snapshot to fail catalog build");
  } catch (error) {
    expect(error).toBeInstanceOf(CatalogValidationError);
    expect(error.issues.map((issue) => issue.code)).toContain(
      "vacuous_consent_snapshot",
    );
  }
});

it("allows an empty snapshot when the catalog has no consent policy", () => {
  const registry = createBridge("snapshot-readonly");
  registry.register({
    actions: {},
    snapshot: {},
  });

  const concierge = createConcierge({
    stages: [
      {
        id: "active",
        match: () => true,
        bridge: registry,
        actions: [action("lookup")],
      },
    ],
  });

  expect(concierge.explain({}).catalog).toHaveLength(1);
});
