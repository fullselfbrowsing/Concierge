import { describe, expect, it } from "vitest";

import { createPortfolioConcierge } from "../src/portfolio-concierge";
import type { PortfolioBridge, PortfolioContext } from "../src/portfolio-concierge";

const CONTEXT: PortfolioContext = Object.freeze({
  pathname: "/",
  browserOpen: false,
  previewScrollable: false,
  voiceActive: true,
});

describe("the guided-tour workflow", () => {
  it("settles cancellation and runs its application cleanup exactly once", async () => {
    const runtime = createPortfolioConcierge();
    const controller = new AbortController();
    let stopCalls = 0;
    let announceStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      announceStarted = resolve;
    });

    const bridge: PortfolioBridge = {
      actions: {
        navigate() {},
        openProject() {},
        closeBrowser() {},
        scrollPreview() {},
        switchToText() {},
        endCall() {},
        async announce(_text, signal) {
          announceStarted();
          await new Promise<void>((resolve) => {
            if (signal.aborted) {
              resolve();
              return;
            }
            signal.addEventListener("abort", () => resolve(), { once: true });
          });
        },
        stopAnnouncement() {
          stopCalls += 1;
        },
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

    const outcome = runtime.concierge.dispatch(CONTEXT, {
      name: "startTour",
      input: {},
      catalogRevision: catalog.revision,
      identity: {
        sessionId: "tour-session",
        responseId: "tour-response",
        callId: "tour-call",
        userTurnId: "tour-turn",
        outputIndex: 0,
      },
      signal: controller.signal,
    });
    await started;
    controller.abort();

    await expect(Promise.race([
      outcome,
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("guided-tour cancellation did not settle")),
        500,
      )),
    ])).resolves.toMatchObject({ ok: false, reason: "aborted" });
    expect(stopCalls).toBe(1);

    unregister();
  });
});
