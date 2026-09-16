import { afterEach, describe, expect, it } from "vitest";

import {
  ANCESTOR_WALK_LIMIT,
  isReadable,
  isRendered,
  measureVisibility,
} from "../src/index.js";
import { mount } from "./harness.js";

afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
});

describe("measureVisibility", () => {
  it("reports a connected unstyled element as rendered and readable", () => {
    const element: HTMLElement = mount("div", "item");
    const report = measureVisibility(element);

    expect(report.connected).toBe(true);
    expect(report.hiddenBy).toBeNull();
    expect(report.styledOutBy).toBeNull();
    expect(report.busy).toBe(false);
    expect(report.hasLayout).toBe(false);
    expect(report.depth).toBe(2);
    expect(isRendered(report)).toBe(true);
    expect(isReadable(report)).toBe(true);
  });

  it("treats a detached element as not rendered", () => {
    const element: HTMLElement = document.createElement("div");
    const report = measureVisibility(element);

    expect(report.connected).toBe(false);
    expect(isRendered(report)).toBe(false);
    expect(isReadable(report)).toBe(false);
  });

  it("names the nearest hiding attribute in hidden / inert / aria-hidden order", () => {
    const hidden: HTMLElement = mount();
    hidden.setAttribute("hidden", "");
    expect(measureVisibility(hidden).hiddenBy).toBe("hidden");

    const inert: HTMLElement = mount();
    inert.setAttribute("inert", "");
    expect(measureVisibility(inert).hiddenBy).toBe("inert");

    const aria: HTMLElement = mount();
    aria.setAttribute("aria-hidden", "true");
    expect(measureVisibility(aria).hiddenBy).toBe("aria-hidden");

    const notAria: HTMLElement = mount();
    notAria.setAttribute("aria-hidden", "false");
    expect(measureVisibility(notAria).hiddenBy).toBeNull();
    expect(isRendered(measureVisibility(notAria))).toBe(true);
  });

  it("walks ancestors for attributes, style, and aria-busy", () => {
    const parent: HTMLElement = mount();
    parent.setAttribute("hidden", "");
    parent.setAttribute("aria-busy", "true");
    const child: HTMLElement = document.createElement("div");
    parent.appendChild(child);

    const report = measureVisibility(child);
    expect(report.hiddenBy).toBe("hidden");
    expect(report.busy).toBe(true);
    expect(report.depth).toBe(1);
    expect(isRendered(report)).toBe(false);
  });

  it("reports display, visibility, and content-visibility as styledOutBy", () => {
    const display: HTMLElement = mount();
    display.style.display = "none";
    expect(measureVisibility(display).styledOutBy).toBe("display");

    const visibility: HTMLElement = mount();
    visibility.style.visibility = "hidden";
    expect(measureVisibility(visibility).styledOutBy).toBe("visibility");

    const collapse: HTMLElement = mount();
    collapse.style.visibility = "collapse";
    expect(measureVisibility(collapse).styledOutBy).toBe("visibility");

    const content: HTMLElement = mount();
    content.style.setProperty("content-visibility", "hidden");
    expect(measureVisibility(content).styledOutBy).toBe("content-visibility");
  });

  it("stops at the nearest hiding cause and does not name a farther ancestor", () => {
    const outer: HTMLElement = mount();
    outer.style.display = "none";
    const inner: HTMLElement = document.createElement("div");
    inner.setAttribute("hidden", "");
    outer.appendChild(inner);

    const report = measureVisibility(inner);
    expect(report.hiddenBy).toBe("hidden");
    expect(report.depth).toBe(0);
  });

  it("ignores busy and hasLayout in isRendered, and requires not-busy for isReadable", () => {
    const element: HTMLElement = mount();
    element.setAttribute("aria-busy", "true");
    const report = measureVisibility(element);

    expect(report.busy).toBe(true);
    expect(report.hasLayout).toBe(false);
    expect(isRendered(report)).toBe(true);
    expect(isReadable(report)).toBe(false);

    expect(
      isRendered({
        connected: true,
        hiddenBy: null,
        styledOutBy: null,
        busy: true,
        hasLayout: true,
        depth: 0,
      }),
    ).toBe(true);
    expect(
      isReadable({
        connected: true,
        hiddenBy: null,
        styledOutBy: null,
        busy: false,
        hasLayout: true,
        depth: 0,
      }),
    ).toBe(true);
    expect(
      isReadable({
        connected: true,
        hiddenBy: null,
        styledOutBy: null,
        busy: true,
        hasLayout: true,
        depth: 0,
      }),
    ).toBe(false);
  });

  it("caps ancestor hops at ANCESTOR_WALK_LIMIT", () => {
    expect(ANCESTOR_WALK_LIMIT).toBe(512);

    let current: HTMLElement = document.createElement("div");
    const leaf: HTMLElement = current;
    for (let hop = 0; hop < ANCESTOR_WALK_LIMIT + 8; hop += 1) {
      const parent: HTMLElement = document.createElement("div");
      parent.appendChild(current);
      current = parent;
    }
    current.setAttribute("hidden", "");
    document.body.appendChild(current);

    const report = measureVisibility(leaf);
    expect(report.depth).toBe(ANCESTOR_WALK_LIMIT);
    expect(report.hiddenBy).toBeNull();
    expect(isRendered(report)).toBe(true);
  });
});
