import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createRealtimeSession } from "../src/session.js";
import {
  action,
  createFakeChannel,
  createTestProvider,
  presentOutcome,
  resetContract,
} from "./fixtures.js";

const CORE_URL = new URL("../../concierge/dist/index.js", import.meta.url);
const ACTIVE = Object.freeze({ page: "active" });

let createConcierge;

beforeAll(async () => {
  if (!existsSync(fileURLToPath(CORE_URL))) {
    throw new Error("Build @full-self-browsing/concierge before testing realtime.");
  }
  ({ createConcierge } = await import(CORE_URL.href));
});

beforeEach(() => {
  resetContract();
});

function conciergeFor(handler = () => ({ ok: true, message: "Done." })) {
  return createConcierge({
    stages: [
      {
        id: "active",
        match: (context) => context.page === "active",
        actions: [action("lookup", handler)],
      },
    ],
  });
}

async function openSession(overrides = {}) {
  const fake = createFakeChannel();
  const reports = [];
  const handle = await createRealtimeSession({
    concierge: conciergeFor(({ meta }) => {
      meta.deferUntilDelivered?.((report) => {
        reports.push(report);
      });
      return { ok: true, message: "Looked up." };
    }),
    channel: fake.channel,
    provider: createTestProvider(),
    presentOutcome,
    initialContext: ACTIVE,
    sessionId: "session-1",
    turnSource: "detected",
    ...overrides,
  });
  return { fake, handle, reports };
}

describe("createRealtimeSession", () => {
  it("opens the channel, waits for the first catalog ack, and exposes a listening handle", async () => {
    const { fake, handle } = await openSession();
    expect(handle.status()).toBe("listening");
    expect(handle.catalogSettled()).toBe(true);
    expect(handle.session.catalog()).not.toBeNull();
    expect(fake.sent.some((event) => event.type === "session.update")).toBe(true);
    await handle.stop();
    expect(handle.status()).toBe("closed");
    await handle.stop();
  });

  it("throws beginTurn under detected turns and opens a turn under explicit", async () => {
    const detected = await openSession({ turnSource: "detected" });
    expect(() => detected.handle.beginTurn("turn-1")).toThrow(
      "beginTurn is only available when turnSource is \"explicit\"",
    );
    await detected.handle.stop();

    resetContract();
    const explicit = await openSession({ turnSource: "explicit" });
    explicit.handle.beginTurn("turn-explicit");
    expect(explicit.handle.sendUserText("hello")).toBe(true);
    expect(explicit.fake.sent.some((event) => event.type === "user")).toBe(true);
    await explicit.handle.stop();
  });

  it("clamps requested attested down to relayed without an attestation window", async () => {
    const concierge = createConcierge({
      consentProfile: {
        consentGrade: "attested",
        userTurnIdentity: "agent-forgeable",
      },
      stages: [
        {
          id: "active",
          match: () => true,
          actions: [action("lookup", () => ({ ok: true, message: "Done." }))],
        },
      ],
    });
    const fake = createFakeChannel();
    await expect(
      createRealtimeSession({
        concierge,
        channel: fake.channel,
        provider: createTestProvider(),
        presentOutcome,
        initialContext: ACTIVE,
        sessionId: "session-1",
        turnSource: "detected",
        consentGrade: "attested",
      }),
    ).rejects.toThrow("The realtime session could not start.");
  });

  it("clamps relayed to delivered when revokeOn is playback-cleared", async () => {
    const concierge = createConcierge({
      consentProfile: {
        consentGrade: "relayed",
        userTurnIdentity: "agent-forgeable",
      },
      stages: [
        {
          id: "active",
          match: () => true,
          actions: [action("lookup", () => ({ ok: true, message: "Done." }))],
        },
      ],
    });
    const fake = createFakeChannel();
    await expect(
      createRealtimeSession({
        concierge,
        channel: fake.channel,
        provider: createTestProvider(),
        presentOutcome,
        initialContext: ACTIVE,
        sessionId: "session-1",
        turnSource: "detected",
        consentGrade: "relayed",
        bargeIn: { revokeOn: "playback-cleared" },
      }),
    ).rejects.toThrow("The realtime session could not start.");
  });

  it("clamps above none to none when a host-signalled provider has no playback source", async () => {
    const diagnostics = [];
    const { handle } = await openSession({
      provider: createTestProvider({ playback: "host-signalled" }),
      consentGrade: "relayed",
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    expect(diagnostics.map((row) => row.code)).toContain("playback_source_missing");
    await handle.stop();
  });

  it("dispatches a batch through core and reports delivery under origin N, not voicer M", async () => {
    const { fake, handle, reports } = await openSession();
    fake.emit({ kind: "turn.started", turnId: "turn-1" });
    fake.emit({ kind: "response.created", responseId: "response-N" });
    fake.emit({
      kind: "response.completed",
      responseId: "response-N",
      raw: {
        responseId: "response-N",
        calls: [
          {
            callId: "call-1",
            name: "lookup",
            arguments: "{}",
            outputIndex: 0,
          },
        ],
      },
    });
    await vi.waitFor(() => {
      expect(
        fake.sent.some((event) => event.type === "conversation.item.create"),
      ).toBe(true);
      expect(fake.sent.some((event) => event.type === "response.create")).toBe(
        true,
      );
    });

    fake.emit({ kind: "response.created", responseId: "response-M" });
    fake.emit({
      kind: "playback",
      playbackKind: "started",
      responseId: "response-M",
    });
    fake.emit({
      kind: "playback",
      playbackKind: "drained",
      responseId: "response-M",
    });
    expect(reports).toEqual([
      expect.objectContaining({
        responseId: "response-N",
        outcome: "completed",
      }),
    ]);
    expect(reports[0]?.responseId).not.toBe("response-M");
    await handle.stop();
  });

  it("emits pending agent transcripts and discards them when playback is cleared", async () => {
    const transcripts = [];
    const { fake, handle } = await openSession({
      onTranscript: (event) => transcripts.push(event),
    });
    fake.emit({ kind: "turn.started", turnId: "turn-1" });
    fake.emit({
      kind: "turn.transcribed",
      turnId: "turn-1",
      text: "look that up",
    });
    fake.emit({ kind: "response.created", responseId: "r1" });
    fake.emit({
      kind: "response.transcript",
      responseId: "r1",
      text: "Here is the item.",
    });
    expect(transcripts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "human",
          status: "final",
          text: "look that up",
        }),
        expect.objectContaining({
          role: "agent",
          status: "pending",
          responseId: "r1",
        }),
      ]),
    );
    fake.emit({
      kind: "playback",
      playbackKind: "cleared",
      responseId: "r1",
    });
    expect(transcripts.at(-1)).toEqual(
      expect.objectContaining({ status: "discarded", responseId: "r1" }),
    );
    await handle.stop();
  });

  it("runs stop-intent only on a committed transcript and sends an interrupt", async () => {
    const { fake, handle } = await openSession({
      stopIntent: (text) => text.trim().toLowerCase() === "stop",
    });
    fake.emit({ kind: "response.created", responseId: "r1" });
    fake.emit({
      kind: "turn.transcribed",
      turnId: "turn-stop",
      text: "stop",
    });
    expect(fake.sent.some((event) => event.type === "response.cancel")).toBe(true);
    await handle.stop();
  });

  it("contains a throwing decoder and never calls console", async () => {
    const diagnostics = [];
    const baseline = createTestProvider();
    const { fake, handle } = await openSession({
      provider: createTestProvider({
        decode(event) {
          if (
            typeof event === "object" &&
            event !== null &&
            (event as { type?: unknown }).type === "garbage"
          ) {
            throw new Error("malformed-frame");
          }
          return baseline.decode(event);
        },
      }),
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    const warn = console.warn;
    const error = console.error;
    const log = console.log;
    const calls = [];
    console.warn = (...args) => {
      calls.push(args);
    };
    console.error = (...args) => {
      calls.push(args);
    };
    console.log = (...args) => {
      calls.push(args);
    };
    try {
      fake.emit({ type: "garbage" });
    } finally {
      console.warn = warn;
      console.error = error;
      console.log = log;
    }
    expect(calls).toEqual([]);
    expect(diagnostics.map((row) => row.code)).toContain("provider_decode_failed");
    expect(handle.status()).toBe("listening");
    await handle.stop();
  });

  it("keeps the session on a recoverable catalog rejection", async () => {
    const diagnostics = [];
    const concierge = createConcierge({
      stages: [
        {
          id: "active",
          match: () => true,
          actions: [
            {
              ...action("lookup", () => ({ ok: true, message: "Done." })),
              availableWhen: (context) => context.page === "active",
            },
          ],
        },
      ],
    });
    const fake = createFakeChannel();
    const handle = await createRealtimeSession({
      concierge,
      channel: fake.channel,
      provider: createTestProvider(),
      presentOutcome,
      initialContext: ACTIVE,
      sessionId: "session-1",
      turnSource: "detected",
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    fake.setAutoAck(false);
    handle.session.setContext({ page: "next" });
    const update = [...fake.sent]
      .reverse()
      .find((event) => event.type === "session.update");
    fake.emit({
      kind: "session.rejected",
      correlationId:
        typeof update?.event_id === "string" ? update.event_id : null,
      recoverable: true,
    });
    expect(handle.status()).toBe("listening");
    expect(handle.session.catalog()).not.toBeNull();
    expect(diagnostics.map((row) => row.code)).toContain("catalog_rejected");
    await handle.stop();
  });

  it("rejects start when the first catalog acknowledgement never arrives", async () => {
    const fake = createFakeChannel(false);
    await expect(
      createRealtimeSession({
        concierge: conciergeFor(),
        channel: fake.channel,
        provider: createTestProvider(),
        presentOutcome,
        initialContext: ACTIVE,
        sessionId: "session-1",
        turnSource: "detected",
        acknowledgementTimeoutMs: 1,
        scheduler: (fn) => {
          fn();
          return () => {};
        },
      }),
    ).rejects.toThrow("The realtime session could not start.");
  });
});
