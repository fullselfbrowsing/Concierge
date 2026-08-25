import type { Concierge, StageContext } from "../src/index.js";
import type { ToolSet } from "ai";

import {
  createAISDKAdapter,
  toAISDKTools,
} from "../src/ai-sdk/index.js";
import type {
  AISDKCatalogSnapshot,
  PrepareAISDKStepResult,
} from "../src/ai-sdk/index.js";
import { createSignedBatchIssuer } from "../src/ai-sdk/server.js";
import {
  createIndexedDBReplayStore,
  createSignedBrowserBridge,
} from "../src/ai-sdk/browser.js";
import type { BrowserBatchReport, ReplayStore } from "../src/ai-sdk/browser.js";

declare const concierge: Concierge;
declare const catalog: AISDKCatalogSnapshot;
declare const context: StageContext;
declare const privateKey: CryptoKey;
declare const publicKey: CryptoKey;

const adapter = createAISDKAdapter({ concierge });
const tools: ToolSet = toAISDKTools(catalog.emittedTools);
const prepared: PrepareAISDKStepResult = adapter.prepareStep({
  catalog,
  responseId: "response-1",
  userTurnId: "turn-1",
  toolCalls: [{
    toolCallId: "call-1",
    toolName: "setTheme",
    input: { value: "dark" },
  }],
});
const replayStore: ReplayStore = createIndexedDBReplayStore();
replayStore.consume("key", 60_000, 10_000);
// @ts-expect-error — replay expiry must use the bridge's validated clock.
replayStore.consume("key", 60_000);
const bridge = createSignedBrowserBridge({
  concierge,
  audience: "example.test",
  sessionId: "session-1",
  publicKeys: new Map([["key-1", { format: "crypto-key", key: publicKey }]]),
  replayStore,
  presentOutcome: async () => ({ outcome: "completed" }),
});
createSignedBrowserBridge({
  concierge,
  audience: "example.test",
  sessionId: "session-1",
  publicKeys: new Map([["key-1", { format: "crypto-key", key: publicKey }]]),
  presentOutcome: async () => ({ outcome: "completed" }),
});
const contextUpdate: Promise<void> = bridge.setContext(context);
declare const report: BrowserBatchReport;
if (report.kind === "completed") {
  report.rows[0]?.result.message;
} else if (report.kind === "terminal") {
  report.enteredBy.name;
} else {
  report.code;
}

if (prepared.kind === "ready") {
  createSignedBatchIssuer({
    adapter,
    audience: "example.test",
    keyId: "key-1",
    privateKey: { format: "crypto-key", key: privateKey },
  }).issue({
    sessionId: "session-1",
    currentContext: context,
    prepared: prepared.value,
  });
}

void tools;
void contextUpdate;

// @ts-expect-error — turn identity is mandatory in contract v3.
adapter.prepareStep({ catalog, responseId: "r", toolCalls: [] });

adapter.prepareStep({ catalog, responseId: "r", userTurnId: "turn", toolCalls: [{
  toolCallId: "c",
  toolName: "setTheme",
  // @ts-expect-error — raw JSON text is not an accepted AI SDK input shortcut.
  arguments: "{}",
}] });

// @ts-expect-error — the private key source is deliberately server-only.
createSignedBatchIssuer({ adapter, audience: "a", keyId: "k", privateKey: publicKey });
