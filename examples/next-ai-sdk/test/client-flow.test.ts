import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import {
  applyBrowserBatchReport,
  applyServerCatalogRetry,
} from "../src/client-flow";

const IDENTITY = Object.freeze({
  keyId: "key-1",
  audience: "example.test",
  sessionId: "session-1",
  catalogStage: "portfolio",
  catalogDigest: "digest",
  issuedAt: 1,
  expiresAt: 2,
  nonce: "nonce",
  responseId: "response-1",
  userTurnId: "turn-1",
});

function operations() {
  return {
    addToolOutput: vi.fn(),
    recoverCatalog: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    notice: vi.fn(),
  };
}

describe("signed client control flow", () => {
  it("maps each completed row to its exact AI SDK tool output", async () => {
    const effects = operations();
    await applyBrowserBatchReport({
      kind: "completed",
      identity: IDENTITY,
      rows: [
        {
          callId: "call-1",
          name: "navigate",
          outputIndex: 0,
          result: { ok: true, message: "Navigated." },
        },
        {
          callId: "call-2",
          name: "openProject",
          outputIndex: 1,
          result: { ok: false, reason: "handler_error", message: "Not opened." },
        },
      ],
    }, effects);

    expect(effects.addToolOutput.mock.calls).toEqual([
      [{
        tool: "navigate",
        toolCallId: "call-1",
        output: { ok: true, message: "Navigated." },
      }],
      [{
        tool: "openProject",
        toolCallId: "call-2",
        output: { ok: false, reason: "handler_error", message: "Not opened." },
      }],
    ]);
    expect(effects.stop).not.toHaveBeenCalled();
    expect(effects.recoverCatalog).not.toHaveBeenCalled();
  });

  it("regenerates catalog failures but ends authenticated-authority failures", async () => {
    const stale = operations();
    await applyBrowserBatchReport({
      kind: "rejected",
      code: "catalog_mismatch",
    }, stale);
    expect(stale.recoverCatalog).toHaveBeenCalledOnce();
    expect(stale.stop).not.toHaveBeenCalled();
    expect(stale.addToolOutput).not.toHaveBeenCalled();

    const forged = operations();
    await applyBrowserBatchReport({
      kind: "rejected",
      code: "invalid_signature",
    }, forged);
    expect(forged.stop).toHaveBeenCalledOnce();
    expect(forged.recoverCatalog).not.toHaveBeenCalled();
    expect(forged.addToolOutput).not.toHaveBeenCalled();

    const replay = operations();
    await applyBrowserBatchReport({ kind: "rejected", code: "replayed" }, replay);
    expect(replay.stop).toHaveBeenCalledOnce();
    expect(replay.addToolOutput).not.toHaveBeenCalled();
  });

  it("regenerates a server-side stale-catalog signal without fabricating output", async () => {
    const effects = operations();
    await applyServerCatalogRetry("catalog-stale", effects);

    expect(effects.recoverCatalog).toHaveBeenCalledOnce();
    expect(effects.stop).not.toHaveBeenCalled();
    expect(effects.addToolOutput).not.toHaveBeenCalled();
    expect(effects.notice).toHaveBeenCalledWith(
      "The server catalog changed before signing; regenerating this step.",
    );
  });

  it("stops on terminal control without emitting completed-prefix outputs", async () => {
    const effects = operations();
    await applyBrowserBatchReport({
      kind: "terminal",
      identity: IDENTITY,
      enteredBy: {
        responseId: "response-1",
        callId: "terminal-call",
        name: "endCall",
        outputIndex: 1,
      },
    }, effects);

    expect(effects.stop).toHaveBeenCalledOnce();
    expect(effects.addToolOutput).not.toHaveBeenCalled();
    expect(effects.recoverCatalog).not.toHaveBeenCalled();
    expect(effects.notice).toHaveBeenCalledWith(
      "Terminal action endCall ended this model loop.",
    );
  });

  it("keeps the overlay exclusively driven by onDispatch", async () => {
    const source = await readFile(
      new URL("../src/concierge-demo.tsx", import.meta.url),
      "utf8",
    );
    expect(source.match(/setOverlay\(/gu)).toHaveLength(1);
    expect(source).toMatch(
      /runtime\.concierge\.onDispatch\(\(event\) => \{\s*setOverlay\(eventLabel\(event\)\)/u,
    );
  });
});
