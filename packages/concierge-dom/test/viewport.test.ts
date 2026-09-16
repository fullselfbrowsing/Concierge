import { afterEach, describe, expect, it, vi } from "vitest";

import {
  preferredScrollBehavior,
  readViewportPosition,
  scrollViewport,
} from "../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function stubViewport(input: {
  readonly scrollY: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
  readonly innerHeight: number;
}): ReturnType<typeof vi.fn> {
  Object.defineProperty(window, "scrollY", {
    value: input.scrollY,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: input.innerHeight,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: input.scrollHeight,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "clientHeight", {
    value: input.clientHeight,
    configurable: true,
  });
  const scrollTo = vi.fn();
  window.scrollTo = scrollTo as typeof window.scrollTo;
  return scrollTo;
}

describe("viewport helpers", () => {
  it("prefers auto when reduced motion is requested", () => {
    const media = (matches: boolean): MediaQueryList =>
      ({
        matches,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: (): void => undefined,
        removeEventListener: (): void => undefined,
        addListener: (): void => undefined,
        removeListener: (): void => undefined,
        dispatchEvent: (): boolean => false,
      }) as MediaQueryList;

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string): MediaQueryList => {
        void query;
        return media(true);
      },
    });
    expect(preferredScrollBehavior()).toBe("auto");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string): MediaQueryList => {
        void query;
        return media(false);
      },
    });
    expect(preferredScrollBehavior()).toBe("smooth");
  });

  it("reads the current position and reports the clamped target, not the settled one", () => {
    const scrollTo = stubViewport({
      scrollY: 100,
      scrollHeight: 2000,
      clientHeight: 800,
      innerHeight: 800,
    });

    const current = readViewportPosition();
    expect(current).toEqual({
      scrollTop: 100,
      maxScrollTop: 1200,
      atTop: false,
      atBottom: false,
    });

    const down = scrollViewport("down", { step: 0.85, behavior: "auto" });
    expect(down.scrollTop).toBe(780);
    expect(scrollTo).toHaveBeenCalledWith({ top: 780, behavior: "auto" });

    const up = scrollViewport("up", { step: 0.85, behavior: "auto" });
    expect(up.scrollTop).toBe(0);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });

    const top = scrollViewport("top", { behavior: "auto" });
    expect(top.atTop).toBe(true);
    expect(top.scrollTop).toBe(0);

    const bottom = scrollViewport("bottom", { behavior: "auto" });
    expect(bottom.atBottom).toBe(true);
    expect(bottom.scrollTop).toBe(1200);
  });
});
