import { describe, expect, it } from "vitest";
import { z } from "zod";

import { catalogDerivedPolicy, renderCatalogPrompt } from "../src/catalog-prompt.js";
import { createConcierge } from "../src/concierge.js";
import { defineAction } from "../src/define-action.js";
import type { ResolvedCatalog } from "../src/types.js";

const emptySchema = z.object({});

describe("renderCatalogPrompt and catalogDerivedPolicy", () => {
  it("is stable for the same catalog and changes when an action is added", () => {
    const listTasks = defineAction({
      name: "listTasks",
      description: "List open tasks.",
      schema: emptySchema,
      jsonSchema: { type: "object", properties: {} },
      redact: "drop",
      handler: async () => ({ ok: true, message: "Listed." }),
    });
    const completeTask = defineAction({
      name: "completeTask",
      description: "Complete a task.",
      schema: emptySchema,
      jsonSchema: { type: "object", properties: {} },
      redact: "drop",
      consent: { requires: "reviewTask" },
      handler: async () => ({ ok: true, message: "Done." }),
    });
    const reviewTask = defineAction({
      name: "reviewTask",
      description: "Review a task.",
      schema: emptySchema,
      jsonSchema: { type: "object", properties: {} },
      redact: "drop",
      handler: async () => ({ ok: true, message: "Reviewed." }),
    });
    const concierge = createConcierge({
      stages: [
        {
          id: "tasks",
          match: () => true,
          actions: [listTasks, completeTask, reviewTask],
        },
      ],
      consentProfile: {
        consentGrade: "delivered",
        userTurnIdentity: "none",
      },
    });
    const catalog = concierge.resolveCatalog({});
    const first = renderCatalogPrompt(catalog);
    const second = renderCatalogPrompt(catalog);
    expect(first).toBe(second);
    expect(first).toContain("listTasks");
    expect(first).toContain("completeTask");

    const smaller = createConcierge({
      stages: [
        {
          id: "tasks",
          match: () => true,
          actions: [listTasks],
        },
      ],
    });
    expect(renderCatalogPrompt(smaller.resolveCatalog({}))).not.toContain(
      "completeTask",
    );

    const policy = catalogDerivedPolicy(catalog);
    expect(policy.continuationSensitiveNames).toContain("completeTask");
    expect(policy.continuationSensitiveNames).not.toContain("listTasks");
  });

  it("omits an unavailable action unless includeUnavailable is set", () => {
    const hidden = defineAction({
      name: "hiddenTask",
      description: "Hidden.",
      schema: emptySchema,
      jsonSchema: { type: "object", properties: {} },
      redact: "drop",
      availableWhen: () => false,
      handler: async () => ({ ok: true, message: "Hidden." }),
    });
    const visible = defineAction({
      name: "visibleTask",
      description: "Visible.",
      schema: emptySchema,
      jsonSchema: { type: "object", properties: {} },
      redact: "drop",
      handler: async () => ({ ok: true, message: "Visible." }),
    });
    const concierge = createConcierge({
      stages: [
        {
          id: "tasks",
          match: () => true,
          actions: [hidden, visible],
        },
      ],
    });
    const catalog = concierge.resolveCatalog({});
    expect(renderCatalogPrompt(catalog)).not.toContain("hiddenTask");
    expect(renderCatalogPrompt(catalog, { includeUnavailable: true })).toContain(
      "hiddenTask",
    );
  });

  it("treats every action as sensitive when no projection is remembered", () => {
    // A catalog nothing remembered — built by another core instance, or one
    // whose revision never passed through rememberCatalogProjection. The
    // policy cannot know which actions are consequential, so it must not
    // report that none of them are.
    const foreign = Object.freeze({
      stage: "tasks",
      revision: Symbol("foreign.catalog") as ResolvedCatalog["revision"],
      tools: Object.freeze([
        { name: "listTasks", description: "List.", parameters: { type: "object" as const, properties: {} } },
        { name: "deleteTask", description: "Delete.", parameters: { type: "object" as const, properties: {} } },
      ]),
    }) as unknown as ResolvedCatalog;

    const policy = catalogDerivedPolicy(foreign);
    expect([...policy.continuationSensitiveNames].sort()).toEqual([
      "deleteTask",
      "listTasks",
    ]);
    expect(policy.observerRedaction["deleteTask"]).toBe("drop");
    expect(policy.sideEffects["deleteTask"]).toEqual({});
  });
});
