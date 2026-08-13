import { describe, expect, it } from "vitest";

import type { DeliveryReport } from "@fullselfbrowsing/concierge";

import { createPortfolioConcierge } from "../src/portfolio-concierge";
import type { PortfolioBridge, PortfolioContext } from "../src/portfolio-concierge";

const CONTEXT: PortfolioContext = Object.freeze({
  pathname: "/portfolio",
  browserOpen: false,
  previewScrollable: false,
  voiceActive: true,
});

describe("the reviewed-project consent flow", () => {
  it("releases the gated launch only after the review delivery completes", async () => {
    const runtime = createPortfolioConcierge();
    const opened: string[] = [];
    const bridge: PortfolioBridge = {
      actions: {
        navigate() {},
        openProject(projectId) {
          opened.push(projectId);
        },
        closeBrowser() {},
        scrollPreview() {},
        switchToText() {},
        endCall() {},
        announce: async () => undefined,
        stopAnnouncement() {},
      },
      snapshot: {
        pathname: () => CONTEXT.pathname,
        browserOpen: () => CONTEXT.browserOpen,
        previewScrollable: () => CONTEXT.previewScrollable,
        voiceActive: () => CONTEXT.voiceActive,
      },
    };
    const unregister = runtime.bridge.register(bridge);
    const catalog = runtime.concierge.resolveCatalog(CONTEXT);
    let completeDelivery: ((report: DeliveryReport) => void) | undefined;

    const review = await runtime.concierge.dispatch(CONTEXT, {
      name: "reviewProjectLaunch",
      input: { projectId: "featured" },
      catalogRevision: catalog.revision,
      identity: {
        sessionId: "consent-session",
        responseId: "consent-response",
        callId: "review-call",
        userTurnId: "consent-turn",
        outputIndex: 0,
      },
      deferUntilDelivered(effect) {
        completeDelivery = effect;
      },
    });
    expect(review).toMatchObject({ ok: true });

    expect(opened).toEqual([]);

    expect(completeDelivery).toBeTypeOf("function");
    completeDelivery?.({
      responseId: "consent-response",
      outcome: "completed",
    });
    await Promise.resolve();

    const launched = await runtime.concierge.dispatch(CONTEXT, {
      name: "launchReviewedProject",
      input: { projectId: "different-project" },
      catalogRevision: catalog.revision,
      identity: {
        sessionId: "consent-session",
        responseId: "consent-followup-response",
        callId: "launch-after-delivery",
        userTurnId: "consent-turn",
        outputIndex: 1,
      },
    });
    expect(launched, JSON.stringify(launched)).toEqual({
      ok: true,
      message: "Opened reviewed project featured.",
    });
    expect(opened).toEqual(["featured"]);

    unregister();
  });
});
