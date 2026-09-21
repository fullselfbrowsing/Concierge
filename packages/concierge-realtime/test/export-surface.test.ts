import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const EXPORT_BLOCK = /^export\s*\{([^}]*)\}\s*;?\s*$/gm;

interface Surface {
  readonly names: readonly string[];
  readonly values: readonly string[];
  readonly types: readonly string[];
}

function readSurface(relative: string): Surface {
  const url = new URL(relative, import.meta.url);
  const path = fileURLToPath(url);
  if (!existsSync(path)) {
    throw new Error(
      `${path} is missing. This guard reads the BUILT declaration file. Run \`pnpm build\` first.`,
    );
  }
  const source = readFileSync(path, "utf8");
  const blocks = [...source.matchAll(EXPORT_BLOCK)];
  if (blocks.length === 0) {
    throw new Error(
      `no trailing \`export { … };\` statement found in ${relative}`,
    );
  }
  const entries = blocks
    .flatMap((block) => (block[1] ?? "").split(","))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.replace(/\s+as\s+\w+$/u, ""));
  return {
    names: entries.map((entry) => entry.replace(/^type\s+/, "")),
    values: entries.filter((entry) => !/^type\s/.test(entry)),
    types: entries
      .filter((entry) => /^type\s/.test(entry))
      .map((entry) => entry.replace(/^type\s+/, "")),
  };
}

const ROOT_VALUES = [
  "createRealtimeDeliveryLedger",
  "createRealtimeTurnLedger",
  "createStopIntentClassifier",
  "createRealtimeSession",
] as const;

const ROOT_TYPES = [
  "RealtimeBatchSource",
  "RealtimeBargeInPolicy",
  "RealtimeCatalogPublication",
  "RealtimeChannel",
  "RealtimeChannelFault",
  "RealtimeChannelState",
  "RealtimeDeliveryEvidence",
  "RealtimeDeliveryLedger",
  "RealtimeDeliveryLedgerConfig",
  "RealtimeDiagnostic",
  "RealtimeDiagnosticCode",
  "RealtimeForeignTool",
  "RealtimePlaybackEvent",
  "RealtimePlaybackSource",
  "RealtimeProvider",
  "RealtimeRuntimeStatus",
  "RealtimeSessionHandle",
  "RealtimeSessionOptions",
  "RealtimeSignal",
  "RealtimeStopIntentClassifier",
  "RealtimeTranscriptEvent",
  "RealtimeTurnLedger",
  "RealtimeTurnLedgerConfig",
  "RealtimeWireEvent",
  "StopIntentOptions",
] as const;

beforeAll(() => {
  for (const relative of [
    "../dist/index.d.ts",
    "../dist/openai/index.d.ts",
    "../dist/webrtc/index.d.ts",
    "../dist/websocket/index.d.ts",
  ]) {
    if (!existsSync(fileURLToPath(new URL(relative, import.meta.url)))) {
      throw new Error(
        `packages/concierge-realtime/${relative.slice(3)} is missing. Run \`pnpm build\` first.`,
      );
    }
  }
});

describe("the published export surface of concierge-realtime", () => {
  it("pins the vendor-neutral root at 29 names — 25 types and 4 values", () => {
    const surface = readSurface("../dist/index.d.ts");
    expect(surface.names).toHaveLength(29);
    expect(surface.types).toHaveLength(25);
    expect(surface.values).toHaveLength(4);
    for (const name of ROOT_VALUES) expect(surface.values).toContain(name);
    for (const name of ROOT_TYPES) expect(surface.types).toContain(name);
  });

  it("pins ./openai at createOpenAIRealtimeProvider and OpenAIRealtimeProviderOptions", () => {
    const surface = readSurface("../dist/openai/index.d.ts");
    expect(surface.names).toHaveLength(2);
    expect(surface.names).toEqual(
      expect.arrayContaining([
        "createOpenAIRealtimeProvider",
        "OpenAIRealtimeProviderOptions",
      ]),
    );
    expect(surface.values).toContain("createOpenAIRealtimeProvider");
  });

  it("pins ./webrtc at the channel factory and five negotiation types", () => {
    const surface = readSurface("../dist/webrtc/index.d.ts");
    expect(surface.names).toHaveLength(6);
    expect(surface.names).toEqual(
      expect.arrayContaining([
        "createWebRTCRealtimeChannel",
        "WebRTCNegotiationRequest",
        "WebRTCNegotiationAnswer",
        "WebRTCRealtimeChannelOptions",
        "WebRTCMediaControls",
        "WebRTCRealtimeChannel",
      ]),
    );
    expect(surface.values).toContain("createWebRTCRealtimeChannel");
  });

  it("pins ./websocket at createWebSocketRealtimeChannel and its options type", () => {
    const surface = readSurface("../dist/websocket/index.d.ts");
    expect(surface.names).toHaveLength(2);
    expect(surface.names).toEqual(
      expect.arrayContaining([
        "createWebSocketRealtimeChannel",
        "WebSocketRealtimeChannelOptions",
      ]),
    );
    expect(surface.values).toContain("createWebSocketRealtimeChannel");
  });
});
