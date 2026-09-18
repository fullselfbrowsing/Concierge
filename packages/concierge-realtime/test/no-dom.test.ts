import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const DOM_IDENTIFIERS =
  /\b(?:document|window|navigator|RTCPeerConnection|HTMLAudioElement|MediaStream|WebSocket)\b/;

function readSrc(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

describe("DOM-free subpaths", () => {
  it("keeps the vendor-neutral runtime free of DOM and WebRTC identifiers", () => {
    for (const relative of [
      "../src/index.ts",
      "../src/types.ts",
      "../src/host.ts",
      "../src/delivery-ledger.ts",
      "../src/turn-ledger.ts",
      "../src/stop-intent.ts",
      "../src/session.ts",
      "../src/openai/index.ts",
    ]) {
      expect(readSrc(relative), relative).not.toMatch(DOM_IDENTIFIERS);
    }
  });

  it("keeps webrtc free of document queries", () => {
    expect(readSrc("../src/webrtc/index.ts")).not.toMatch(
      /querySelector|getElementById|document\./,
    );
  });
});
