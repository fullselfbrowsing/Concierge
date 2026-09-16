import { afterEach, describe, expect, it } from "vitest";

import { mount, registry } from "./harness.js";

afterEach(() => {
  document.body.replaceChildren();
});

describe("AnchorRegistry.resolve", () => {
  it("returns not-registered when the key was never live", () => {
    const anchors = registry();
    expect(anchors.resolve("missing")).toEqual({
      status: "not-registered",
      element: null,
      report: null,
      registered: 0,
    });
  });

  it("returns the first isRendered survivor in registration order", () => {
    const anchors = registry();
    const hidden: HTMLElement = mount();
    hidden.style.display = "none";
    const firstVisible: HTMLElement = mount("div", "board");
    const secondVisible: HTMLElement = mount("div", "sheet");

    anchors.register("deal-4417", hidden);
    anchors.register("deal-4417", firstVisible);
    anchors.register("deal-4417", secondVisible);

    const found = anchors.resolve("deal-4417");
    expect(found.status).toBe("rendered");
    expect(found.element).toBe(firstVisible);
    expect(found.registered).toBe(3);
    expect(found.report?.connected).toBe(true);
  });

  it("does not fall back to a hidden candidate", () => {
    const anchors = registry();
    const hidden: HTMLElement = mount();
    hidden.setAttribute("hidden", "");
    anchors.register("deal", hidden);

    const found = anchors.resolve("deal");
    expect(found.status).toBe("not-rendered");
    expect(found.element).toBeNull();
    expect(found.registered).toBe(1);
    expect(found.report?.hiddenBy).toBe("hidden");
  });

  it("prefers the first survivor contained by a connected within element", () => {
    const anchors = registry();
    const list: HTMLElement = mount("div", "list");
    const panel: HTMLElement = mount("div");
    const inPanel: HTMLElement = document.createElement("div");
    inPanel.textContent = "detail";
    panel.appendChild(inPanel);

    anchors.register("deal", list);
    anchors.register("deal", inPanel);

    const unconstrained = anchors.resolve("deal");
    expect(unconstrained.element).toBe(list);

    const constrained = anchors.resolve("deal", { within: panel });
    expect(constrained.element).toBe(inPanel);
    expect(constrained.status).toBe("rendered");
  });

  it("ignores a disconnected within and still returns the first survivor", () => {
    const anchors = registry();
    const visible: HTMLElement = mount();
    const detached: HTMLElement = document.createElement("div");
    anchors.register("deal", visible);

    const found = anchors.resolve("deal", { within: detached });
    expect(found.element).toBe(visible);
  });

  it("falls back to the first survivor when within contains none of them", () => {
    const anchors = registry();
    const visible: HTMLElement = mount();
    const other: HTMLElement = mount();
    anchors.register("deal", visible);

    const found = anchors.resolve("deal", { within: other });
    expect(found.element).toBe(visible);
  });
});
