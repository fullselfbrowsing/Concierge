import { randomUUID } from "node:crypto";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  createAISDKAdapter,
} from "@fullselfbrowsing/concierge/ai-sdk";
import {
  createSignedBatchIssuer,
} from "@fullselfbrowsing/concierge/ai-sdk/server";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
} from "ai";
import type { LanguageModel, UIMessage } from "ai";
import { cookies } from "next/headers";
import { z } from "zod";

import {
  createPortfolioConcierge,
  portfolioContextSchema,
} from "../../../src/portfolio-concierge";
import type { PortfolioContext } from "../../../src/portfolio-concierge";
import {
  CONCIERGE_AUDIENCE,
  SESSION_COOKIE,
} from "../../../src/protocol";
import type { ConciergeUIData } from "../../../src/protocol";
import { createDeterministicModel } from "../../../src/deterministic-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DemoMessage = UIMessage<unknown, ConciergeUIData>;

const requestSchema = z.object({
  messages: z.array(z.unknown()).max(200),
  context: portfolioContextSchema,
  userTurnId: z.string().min(1).max(256),
}).strict();

function configuration(): {
  readonly apiKey: string | undefined;
  readonly model: string;
  readonly privateKeyPem: string;
} {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const privateKeyPem = process.env.CONCIERGE_ES256_PRIVATE_KEY_PEM;
  if (
    privateKeyPem === undefined ||
    (apiKey === undefined && process.env.CONCIERGE_DETERMINISTIC_TEST !== "1")
  ) {
    throw new Error("The server model or signing key is not configured.");
  }
  return {
    apiKey,
    model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini",
    privateKeyPem,
  };
}

function configuredModel(configured: ReturnType<typeof configuration>): LanguageModel {
  if (process.env.CONCIERGE_DETERMINISTIC_TEST === "1") {
    return createDeterministicModel();
  }
  if (configured.apiKey === undefined) {
    throw new Error("OpenRouter is not configured.");
  }
  return createOpenRouter({ apiKey: configured.apiKey })(configured.model);
}

export async function POST(request: Request): Promise<Response> {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (sessionId === undefined) {
    return Response.json({ error: "Bootstrap the Concierge session first." }, { status: 401 });
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "The chat request is invalid." }, { status: 400 });
  }

  let configured: ReturnType<typeof configuration>;
  try {
    configured = configuration();
  } catch {
    return Response.json({ error: "The server is not configured." }, { status: 503 });
  }

  // Both the server and browser construct the same declarations, but only the
  // server chooses what the model sees and only the browser mounts a bridge.
  const runtime = createPortfolioConcierge();
  const adapter = createAISDKAdapter({ concierge: runtime.concierge });
  const context: PortfolioContext = parsed.context;
  const catalog = await adapter.resolveCatalog(context);
  const issuer = createSignedBatchIssuer({
    adapter,
    audience: CONCIERGE_AUDIENCE,
    keyId: "example-es256",
    privateKey: { format: "pkcs8-pem", data: configured.privateKeyPem },
  });
  const model = configuredModel(configured);
  const messages = parsed.messages as DemoMessage[];
  const modelMessages = await convertToModelMessages(messages, {
    tools: catalog.aiTools,
  });

  const stream = createUIMessageStream<DemoMessage>({
    originalMessages: messages,
    execute: ({ writer }) => {
      let stepSequence = 0;
      const result = streamText({
        model,
        system:
          "You operate only through the provided portfolio actions. " +
          "Never claim an action completed until its structured result says so.",
        messages: modelMessages,
        tools: catalog.aiTools,
        stopWhen: stepCountIs(1),
        onStepFinish: async (step) => {
          const prepared = adapter.prepareStep({
            catalog,
            responseId: `${sessionId}:${randomUUID()}:${stepSequence}`,
            userTurnId: parsed.userTurnId,
            toolCalls: step.toolCalls.map((call) => ({
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              input: call.input,
              dynamic: call.dynamic,
              invalid: call.invalid,
              providerExecuted: call.providerExecuted,
            })),
          });
          stepSequence += 1;
          if (prepared.kind !== "ready") return;
          const issued = await issuer.issue({
            sessionId,
            currentContext: context,
            prepared: prepared.value,
          });
          if (issued.kind === "issued") {
            writer.write({
              type: "data-concierge-envelope",
              data: { envelope: issued.envelope },
            });
          } else if (issued.kind === "stale-catalog") {
            // The raw call remains display-only. Tell the browser to discard
            // this unresolved assistant step and regenerate from its prefix.
            writer.write({
              type: "data-concierge-retry",
              data: { reason: "catalog-stale" },
            });
          }
        },
      });
      writer.merge(result.toUIMessageStream());
    },
    onError: () => "The model request failed.",
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "Cache-Control": "no-store" },
  });
}
