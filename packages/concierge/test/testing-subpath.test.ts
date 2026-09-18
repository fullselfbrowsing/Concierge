import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineAction } from "../src/define-action.js";
import {
  createCompletedDelivery,
  createTestClock,
  createTestConcierge,
  createTestDigest,
  createTestReadbackSink,
  createTestScheduler,
  createStubTransport,
} from "../src/testing/index.js";

const emptySchema = z.object({});

describe("./testing helpers", () => {
  it("advances a clock and scheduler together", () => {
    const clock = createTestClock(100);
    const scheduler = createTestScheduler();
    let fired = false;
    scheduler(() => {
      fired = true;
    }, 25);
    expect(clock.now()).toBe(100);
    clock.advance(25);
    scheduler.advance(25);
    expect(clock.now()).toBe(125);
    expect(fired).toBe(true);
  });

  it("builds a concierge that can dispatch against the test clock", async () => {
    const clock = createTestClock(0);
    const ping = defineAction({
      name: "ping",
      description: "Ping.",
      schema: emptySchema,
      jsonSchema: { type: "object", properties: {} },
      redact: "drop",
      handler: async () => ({ ok: true, message: "Pong." }),
    });
    const concierge = createTestConcierge({
      clock: clock.now,
      stages: [{ id: "root", match: () => true, actions: [ping] }],
    });
    const catalog = concierge.resolveCatalog({});
    await expect(
      concierge.dispatch(
        {},
        {
          name: "ping",
          input: {},
          catalogRevision: catalog.revision,
        },
      ),
    ).resolves.toMatchObject({ ok: true });
  });

  it("produces a completed delivery report and a digest", async () => {
    const digest = createTestDigest();
    const hash = await digest.digest("SHA-256", new Uint8Array([1, 2, 3]));
    expect(hash.byteLength).toBe(32);
    expect(createCompletedDelivery("r1").outcome).toBe("completed");
    const sink = createTestReadbackSink();
    expect(typeof sink.present).toBe("function");
    const stub = createStubTransport({ acknowledgesCatalog: true });
    expect(stub.transport.capabilities.acknowledgesCatalog).toBe(true);
  });
});
