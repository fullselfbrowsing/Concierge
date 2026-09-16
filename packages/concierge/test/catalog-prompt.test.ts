import { describe, expect, it } from "vitest";
import { z } from "zod";

import { catalogDerivedPolicy, renderCatalogPrompt } from "../src/catalog-prompt.js";
import { createConcierge } from "../src/concierge.js";
import { defineAction } from "../src/define-action.js";

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
});
