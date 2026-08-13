import type { LanguageModel } from "ai";
import { MockLanguageModelV3 } from "ai/test";

const USAGE = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: {
    total: 1,
    text: 1,
    reasoning: 0,
  },
  raw: {},
} as const;

/** A network-free model used only by deterministic route and browser tests. */
export function createDeterministicModel(): LanguageModel {
  return new MockLanguageModelV3({
    provider: "concierge-example-test",
    modelId: "deterministic-tool-call",
    doStream: ({ prompt }) => {
      const hasToolResult = prompt.some((message) => message.role === "tool");
      const chunks = hasToolResult
        ? [
            { type: "stream-start" as const, warnings: [] },
            { type: "text-start" as const, id: "answer" },
            {
              type: "text-delta" as const,
              id: "answer",
              delta: "The signed navigation completed.",
            },
            { type: "text-end" as const, id: "answer" },
            {
              type: "finish" as const,
              usage: USAGE,
              finishReason: { unified: "stop" as const, raw: "stop" },
            },
          ]
        : [
            { type: "stream-start" as const, warnings: [] },
            {
              type: "tool-call" as const,
              toolCallId: "deterministic-navigate-1",
              toolName: "navigate",
              input: "{\"pathname\":\"/portfolio\"}",
              providerExecuted: false,
              dynamic: false,
            },
            {
              type: "finish" as const,
              usage: USAGE,
              finishReason: {
                unified: "tool-calls" as const,
                raw: "tool_calls",
              },
            },
          ];

      return Promise.resolve({
        stream: new ReadableStream({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk);
            controller.close();
          },
        }),
      });
    },
  });
}
