import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createConcierge } from "../src/concierge.js";
import { defineAction } from "../src/define-action.js";
import type { DispatchEvent, ObservedMessage, StageContext } from "../src/types.js";

const emptySchema = z.object({});
const CONTEXT: StageContext = Object.freeze({});

async function flush(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

function lastEvent(
  events: ReadonlyArray<DispatchEvent>,
  name: string,
  phase: DispatchEvent["phase"],
): DispatchEvent | undefined {
  return [...events].reverse().find(
    (event) => event.name === name && event.phase === phase,
  );
}

describe("dispatch observability", () => {
  it("builds dispatchId as instanceId-n and times against an injectable clock", async () => {
    let now = 1_000;
    const events: DispatchEvent[] = [];
    const ping = defineAction({
      name: "ping",
      description: "Ping.",
      schema: emptySchema,
      jsonSchema: { type: "object", properties: {} },
      redact: "drop",
      handler: async () => {
        now += 40;
        return { ok: true, message: "Pong." };
      },
    });
    const concierge = createConcierge({
      instanceId: "host-a",
      clock: () => now,
      stages: [{ id: "root", match: () => true, actions: [ping] }],
    });
    concierge.onDispatch((event) => {
      events.push(event);
    });
    const catalog = concierge.resolveCatalog(CONTEXT);
    await concierge.dispatch(CONTEXT, {
      name: "ping",
      input: {},
      catalogRevision: catalog.revision,
    });
    await flush();
    const executing = lastEvent(events, "ping", "executing");
    const succeeded = lastEvent(events, "ping", "succeeded");
    expect(executing?.dispatchId).toBe("host-a-1");
    expect(succeeded?.dispatchId).toBe("host-a-1");
    expect(executing?.timing.elapsedMs).toBe(0);
    expect(executing?.timing.handlerMs).toBe(0);
    expect(succeeded?.timing.elapsedMs).toBe(40);
    expect(succeeded?.timing.handlerMs).toBe(40);
    expect(concierge.instanceId).toBe("host-a");
  });

  it("rejects an invalid instanceId", () => {
    expect(() =>
      createConcierge({
        instanceId: "has space",
        stages: [],
      }),
    ).toThrow(/instanceId/);
  });

  it("drops a result sentence when redactMessage is drop", async () => {
    const events: DispatchEvent[] = [];
    const ping = defineAction({
      name: "ping",
      description: "Ping.",
      schema: emptySchema,
      jsonSchema: { type: "object", properties: {} },
      redact: "drop",
      redactMessage: "drop",
      handler: async () => ({ ok: true, message: "secret-token" }),
    });
    const concierge = createConcierge({
      stages: [{ id: "root", match: () => true, actions: [ping] }],
    });
    concierge.onDispatch((event) => {
      events.push(event);
    });
    const catalog = concierge.resolveCatalog(CONTEXT);
    await concierge.dispatch(CONTEXT, {
      name: "ping",
      input: {},
      catalogRevision: catalog.revision,
    });
    await flush();
    const succeeded = lastEvent(events, "ping", "succeeded");
    expect(
      succeeded && "result" in succeeded ? succeeded.result.message : undefined,
    ).toEqual({ kind: "dropped" } satisfies ObservedMessage);
  });

  it("passthrough includes a sanitized handler message", async () => {
    const events: DispatchEvent[] = [];
    const ping = defineAction({
      name: "ping",
      description: "Ping.",
      schema: emptySchema,
      jsonSchema: { type: "object", properties: {} },
      redact: "drop",
      redactMessage: "passthrough",
      handler: async () => ({ ok: true, message: "Pong.\nNext" }),
    });
    const concierge = createConcierge({
      stages: [{ id: "root", match: () => true, actions: [ping] }],
    });
    concierge.onDispatch((event) => {
      events.push(event);
    });
    const catalog = concierge.resolveCatalog(CONTEXT);
    await concierge.dispatch(CONTEXT, {
      name: "ping",
      input: {},
      catalogRevision: catalog.revision,
    });
    await flush();
    const succeeded = lastEvent(events, "ping", "succeeded");
    expect(
      succeeded && "result" in succeeded ? succeeded.result.message : undefined,
    ).toEqual({
      kind: "included",
      value: "Pong. Next",
    });
  });
});
