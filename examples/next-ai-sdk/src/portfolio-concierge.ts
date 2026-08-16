import {
  createBridge,
  createConcierge,
  defineAction,
  offPageResult,
} from "@full-self-browsing/concierge";
import type {
  ActionDefinition,
  Bridge,
  BridgeRegistry,
  Concierge,
  AbortSignalLike,
  StageContext,
  StandardSchemaV1,
} from "@full-self-browsing/concierge";
import { z } from "zod";

export interface PortfolioContext extends StageContext {
  readonly pathname: "/" | "/portfolio";
  readonly browserOpen: boolean;
  readonly previewScrollable: boolean;
  readonly voiceActive: boolean;
}

export interface PortfolioBridge extends Bridge<
  {
    navigate(pathname: PortfolioContext["pathname"]): void;
    openProject(projectId: string): void;
    closeBrowser(): void;
    scrollPreview(direction: "up" | "down"): void;
    switchToText(): void;
    endCall(): void;
    announce(text: string, signal: AbortSignalLike): Promise<void>;
    stopAnnouncement(): void;
  },
  {
    pathname(): PortfolioContext["pathname"];
    browserOpen(): boolean;
    previewScrollable(): boolean;
    voiceActive(): boolean;
  }
> {}

export interface PortfolioConcierge {
  readonly concierge: Concierge;
  readonly bridge: BridgeRegistry<PortfolioBridge>;
}

export const portfolioContextSchema = z.object({
  pathname: z.enum(["/", "/portfolio"]),
  browserOpen: z.boolean(),
  previewScrollable: z.boolean(),
  voiceActive: z.boolean(),
}).strict();

const EMPTY_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

const PROJECT_SCHEMA = {
  type: "object",
  properties: { projectId: { type: "string", minLength: 1, maxLength: 64 } },
  required: ["projectId"],
  additionalProperties: false,
} as const;
const projectInputSchema = z.object({
  projectId: z.string().min(1).max(64),
}).strict();
type ProjectInput = z.infer<typeof projectInputSchema>;

const PATH_SCHEMA = {
  type: "object",
  properties: { pathname: { enum: ["/", "/portfolio"] } },
  required: ["pathname"],
  additionalProperties: false,
} as const;

const SCROLL_SCHEMA = {
  type: "object",
  properties: { direction: { enum: ["up", "down"] } },
  required: ["direction"],
  additionalProperties: false,
} as const;

function schedule(fn: () => void, delayMs: number): () => void {
  const handle: ReturnType<typeof setTimeout> = setTimeout(fn, delayMs);
  return (): void => clearTimeout(handle);
}

function isTrue(value: unknown): boolean {
  return value === true;
}

function missingBridge(action: string) {
  return offPageResult(action, "portfolio interface");
}

function definePortfolioAction<
  Name extends string,
  Description extends string,
  Schema extends StandardSchemaV1,
>(
  definition: Parameters<
    typeof defineAction<Name, Description, Schema, PortfolioBridge>
  >[0],
): ActionDefinition<Name, Schema, PortfolioBridge> {
  return defineAction<Name, Description, Schema, PortfolioBridge>(definition);
}

export function createPortfolioConcierge(): PortfolioConcierge {
  const bridge = createBridge<PortfolioBridge>("portfolio-ui");

  const navigate = definePortfolioAction({
    name: "navigate",
    description: "Navigate to the home or portfolio page.",
    schema: z.object({ pathname: z.enum(["/", "/portfolio"]) }).strict(),
    jsonSchema: PATH_SCHEMA,
    redact: "passthrough",
    effects: { readOnly: false, destructive: false, idempotent: true },
    handler: ({ args, bridge: mounted }) => {
      if (mounted === null) return missingBridge("Navigation");
      mounted.actions.navigate(args.pathname);
      return { ok: true, message: `Navigated to ${args.pathname}.` };
    },
  });

  const openProject = definePortfolioAction({
    name: "openProject",
    description: "Open one portfolio project in the embedded preview.",
    schema: projectInputSchema,
    jsonSchema: PROJECT_SCHEMA,
    redact: ({ projectId }) => ({ projectId }),
    effects: { readOnly: false, destructive: false, idempotent: true },
    availableWhen: (ctx) => ctx.pathname === "/portfolio",
    handler: ({ args, bridge: mounted }) => {
      if (mounted === null) return missingBridge("Project opening");
      mounted.actions.openProject(args.projectId);
      return { ok: true, message: `Opened project ${args.projectId}.` };
    },
  });

  const reviewProjectLaunch = definePortfolioAction({
    name: "reviewProjectLaunch",
    description: "Review the exact portfolio project before opening it.",
    schema: projectInputSchema,
    jsonSchema: PROJECT_SCHEMA,
    redact: ({ projectId }) => ({ projectId }),
    effects: { readOnly: true, destructive: false, idempotent: true },
    availableWhen: (ctx) =>
      ctx.pathname === "/portfolio" && ctx.browserOpen === false,
    handler: ({ args }) => ({
      ok: true,
      message: `Reviewed project ${args.projectId}; opening it still requires consent.`,
    }),
  });

  const launchReviewedProject = defineAction<
    "launchReviewedProject",
    "Open a portfolio project after its review has reached the user.",
    typeof projectInputSchema,
    PortfolioBridge,
    unknown,
    ProjectInput
  >({
    name: "launchReviewedProject",
    description: "Open a portfolio project after its review has reached the user.",
    schema: projectInputSchema,
    jsonSchema: PROJECT_SCHEMA,
    redact: ({ projectId }) => ({ projectId }),
    effects: { readOnly: false, destructive: false, idempotent: true },
    availableWhen: (ctx) =>
      ctx.pathname === "/portfolio" && ctx.browserOpen === false,
    consent: {
      requires: "reviewProjectLaunch",
      bindTo: "response",
      minGrade: "delivered",
    },
    handler: ({ ack, bridge: mounted }) => {
      if (ack === undefined) {
        return {
          ok: false,
          reason: "consent_required",
          message: "Review this project before opening it.",
        };
      }
      if (mounted === null) return missingBridge("Project launch");
      mounted.actions.openProject(ack.payload.projectId);
      return {
        ok: true,
        message: `Opened reviewed project ${ack.payload.projectId}.`,
      };
    },
  });

  const closeBrowser = definePortfolioAction({
    name: "closeBrowser",
    description: "Close the currently open embedded project preview.",
    schema: z.object({}).strict(),
    jsonSchema: EMPTY_SCHEMA,
    redact: "drop",
    effects: { readOnly: false, destructive: false, idempotent: true },
    availableWhen: (ctx) => isTrue(ctx.browserOpen),
    handler: ({ bridge: mounted }) => {
      if (mounted === null) return missingBridge("Preview closing");
      mounted.actions.closeBrowser();
      return { ok: true, message: "Closed the project preview." };
    },
  });

  const scrollProjectPreview = definePortfolioAction({
    name: "scrollProjectPreview",
    description: "Scroll the currently open embedded project preview.",
    schema: z.object({ direction: z.enum(["up", "down"]) }).strict(),
    jsonSchema: SCROLL_SCHEMA,
    redact: "passthrough",
    effects: { readOnly: false, destructive: false, idempotent: false },
    availableWhen: (ctx) =>
      isTrue(ctx.browserOpen) && isTrue(ctx.previewScrollable),
    handler: ({ args, bridge: mounted }) => {
      if (mounted === null) return missingBridge("Preview scrolling");
      mounted.actions.scrollPreview(args.direction);
      return { ok: true, message: `Scrolled the preview ${args.direction}.` };
    },
  });

  const switchToText = definePortfolioAction({
    name: "switchToText",
    description: "End voice mode and continue the conversation in text chat.",
    schema: z.object({}).strict(),
    jsonSchema: EMPTY_SCHEMA,
    redact: "drop",
    effects: { readOnly: false, destructive: false, idempotent: true },
    availableWhen: (ctx) => isTrue(ctx.voiceActive),
    terminal: true,
    handler: ({ bridge: mounted }) => {
      if (mounted === null) return missingBridge("Text mode");
      mounted.actions.switchToText();
      return { ok: true, message: "Switched to text chat." };
    },
  });

  const endCall = definePortfolioAction({
    name: "endCall",
    description: "End the current voice conversation.",
    schema: z.object({}).strict(),
    jsonSchema: EMPTY_SCHEMA,
    redact: "drop",
    effects: { readOnly: false, destructive: false, idempotent: true },
    availableWhen: (ctx) => isTrue(ctx.voiceActive),
    terminal: true,
    handler: ({ bridge: mounted }) => {
      if (mounted === null) return missingBridge("Voice controls");
      mounted.actions.endCall();
      return { ok: true, message: "Ended the voice conversation." };
    },
  });

  const startTour = definePortfolioAction({
    name: "startTour",
    description: "Run the application-owned guided portfolio tour.",
    schema: z.object({}).strict(),
    jsonSchema: EMPTY_SCHEMA,
    redact: "drop",
    effects: { readOnly: false, destructive: false, idempotent: false },
    handler: async ({ bridge: mounted, workflow }) => {
      if (mounted === null) return missingBridge("Guided tour");

      workflow.cleanup(() => mounted.actions.stopAnnouncement());
      await mounted.actions.announce(
        "Let us start with the portfolio overview.",
        workflow.signal,
      );
      await workflow.run({
        stepId: "portfolio-page",
        name: "navigate",
        input: { pathname: "/portfolio" },
      });
      await workflow.delay(350);
      await workflow.run({
        stepId: "featured-project",
        name: "openProject",
        input: { projectId: "featured" },
        context: {
          pathname: "/portfolio",
          browserOpen: false,
          previewScrollable: false,
          voiceActive: true,
        },
      });
      await workflow.delay(350);
      await workflow.run({
        stepId: "preview-scroll",
        name: "scrollProjectPreview",
        input: { direction: "down" },
        context: {
          pathname: "/portfolio",
          browserOpen: true,
          previewScrollable: true,
          voiceActive: true,
        },
      });
      return { ok: true, message: "Completed the guided tour." };
    },
  });

  const concierge = createConcierge({
    stages: [
      { id: "home", match: (ctx) => ctx.pathname === "/", actions: [], bridge },
      {
        id: "portfolio",
        match: (ctx) => ctx.pathname === "/portfolio",
        actions: [
          openProject,
          reviewProjectLaunch,
          launchReviewedProject,
          closeBrowser,
          scrollProjectPreview,
        ],
        bridge,
      },
    ],
    crossStage: [navigate, startTour, switchToText, endCall],
    scheduler: schedule,
    consentProfile: {
      consentGrade: "delivered",
      userTurnIdentity: "agent-forgeable",
    },
    maxWorkflowDepth: 16,
    maxWorkflowSteps: 256,
  });

  return Object.freeze({ concierge, bridge });
}
