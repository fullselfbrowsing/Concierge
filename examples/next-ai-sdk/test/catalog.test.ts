import { describe, expect, it } from "vitest";

import { createPortfolioConcierge } from "../src/portfolio-concierge";
import type { PortfolioContext } from "../src/portfolio-concierge";

function names(context: PortfolioContext): string[] {
  return createPortfolioConcierge()
    .concierge.resolveCatalog(context)
    .tools.map((tool) => tool.name);
}

describe("the portfolio catalog", () => {
  it("derives currently valid actions from viewer and voice state", () => {
    expect(names({
      pathname: "/portfolio",
      browserOpen: false,
      previewScrollable: false,
      voiceActive: true,
    })).toEqual([
      "openProject",
      "reviewProjectLaunch",
      "launchReviewedProject",
      "navigate",
      "startTour",
      "switchToText",
      "endCall",
    ]);

    expect(names({
      pathname: "/portfolio",
      browserOpen: true,
      previewScrollable: true,
      voiceActive: false,
    })).toEqual([
      "openProject",
      "closeBrowser",
      "scrollProjectPreview",
      "navigate",
      "startTour",
    ]);
  });

  it("changes the atomic revision when same-stage availability changes", () => {
    const runtime = createPortfolioConcierge().concierge;
    const closed = runtime.resolveCatalog({
      pathname: "/portfolio",
      browserOpen: false,
      previewScrollable: false,
      voiceActive: true,
    });
    const opened = runtime.resolveCatalog({
      pathname: "/portfolio",
      browserOpen: true,
      previewScrollable: true,
      voiceActive: true,
    });
    const reopened = runtime.resolveCatalog({
      pathname: "/portfolio",
      browserOpen: true,
      previewScrollable: true,
      voiceActive: true,
    });

    expect(opened.revision).not.toBe(closed.revision);
    expect(reopened).toBe(opened);
  });
});
