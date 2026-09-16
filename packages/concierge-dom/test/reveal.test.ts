import { afterEach, describe, expect, it, vi } from "vitest";

import { REVEAL_ATTRIBUTE } from "../src/index.js";
import { mount, registry } from "./harness.js";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function installScrollSpies(): {
  readonly intoView: ReturnType<typeof vi.fn>;
  readonly scrollTo: ReturnType<typeof vi.fn>;
} {
  const intoView = vi.fn();
  const scrollTo = vi.fn();
  Element.prototype.scrollIntoView = intoView;
  window.scrollTo = scrollTo as typeof window.scrollTo;
  return { intoView, scrollTo };
}

describe("AnchorRegistry.reveal", () => {
  it("exposes the reserved reveal attribute name", () => {
    expect(REVEAL_ATTRIBUTE).toBe("data-concierge-reveal");
  });

  it("scrolls the winner with scrollIntoView and default block center", async () => {
    const { intoView, scrollTo } = installScrollSpies();
    const anchors = registry();
    const element: HTMLElement = mount();
    anchors.register("deal", element);

    const outcome = await anchors.reveal("deal", { behavior: "auto" });
    expect(outcome.status).toBe("revealed");
    expect(outcome.element).toBe(element);
    expect(intoView).toHaveBeenCalledTimes(1);
    expect(intoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("uses window.scrollTo when block is start and offsetTop is positive", async () => {
    const { intoView, scrollTo } = installScrollSpies();
    const anchors = registry();
    const element: HTMLElement = mount();
    element.getBoundingClientRect = (): DOMRect =>
      ({
        top: 120,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 120,
        toJSON: (): object => ({}),
      }) as DOMRect;
    Object.defineProperty(window, "scrollY", { value: 40, configurable: true });
    anchors.register("deal", element);

    const outcome = await anchors.reveal("deal", {
      block: "start",
      offsetTop: 64,
      behavior: "auto",
    });
    expect(outcome.status).toBe("revealed");
    expect(scrollTo).toHaveBeenCalledWith({ top: 96, behavior: "auto" });
    expect(intoView).not.toHaveBeenCalled();
  });

  it("warns once per registry when offsetTop is used with a non-start block", async () => {
    installScrollSpies();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const anchors = registry();
    const element: HTMLElement = mount();
    anchors.register("deal", element);

    await anchors.reveal("deal", {
      block: "center",
      offsetTop: 64,
      behavior: "auto",
    });
    await anchors.reveal("deal", {
      block: "end",
      offsetTop: 32,
      behavior: "auto",
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("offsetTop");
  });

  it("re-resolves with within before scrolling", async () => {
    const { intoView } = installScrollSpies();
    const anchors = registry();
    const list: HTMLElement = mount("div", "list");
    const panel: HTMLElement = mount("div");
    const inPanel: HTMLElement = document.createElement("div");
    panel.appendChild(inPanel);
    anchors.register("item", list);
    anchors.register("item", inPanel);

    const outcome = await anchors.reveal("item", {
      within: panel,
      behavior: "auto",
    });
    expect(outcome.status).toBe("revealed");
    expect(outcome.element).toBe(inPanel);
    expect(intoView).toHaveBeenCalledTimes(1);
    expect(intoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  });

  it("returns the resolve status without scrolling when nothing is rendered", async () => {
    const { intoView, scrollTo } = installScrollSpies();
    const anchors = registry();
    const hidden: HTMLElement = mount();
    hidden.style.display = "none";
    anchors.register("deal", hidden);

    const missing = await anchors.reveal("missing");
    expect(missing.status).toBe("not-registered");
    const hiddenOutcome = await anchors.reveal("deal");
    expect(hiddenOutcome.status).toBe("not-rendered");
    expect(intoView).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("defers one frame, then re-resolves before scrolling", async () => {
    const { intoView } = installScrollSpies();
    const frames: Array<() => void> = [];
    const anchors = registry({
      frame: (fn) => {
        frames.push(fn);
        return (): void => {
          const index = frames.indexOf(fn);
          if (index >= 0) {
            frames.splice(index, 1);
          }
        };
      },
      scheduler: () => (): void => undefined,
    });
    const element: HTMLElement = mount();
    const release = anchors.register("deal", element);

    const pending = anchors.reveal("deal", { defer: "frame", behavior: "auto" });
    expect(intoView).not.toHaveBeenCalled();
    void release;
    element.remove();
    const frame = frames[0];
    expect(frame).toBeTypeOf("function");
    frame?.();
    const outcome = await pending;
    expect(outcome.status).toBe("not-rendered");
    expect(intoView).not.toHaveBeenCalled();
  });

  it("settles a deferred reveal from the scheduler fallback when no frame arrives", async () => {
    const { intoView } = installScrollSpies();
    const timers: Array<() => void> = [];
    const anchors = registry({
      frame: () => (): void => undefined,
      scheduler: (fn) => {
        timers.push(fn);
        return (): void => undefined;
      },
      frameFallbackMs: 100,
    });
    const element: HTMLElement = mount();
    anchors.register("deal", element);

    const pending = anchors.reveal("deal", { defer: "frame", behavior: "auto" });
    expect(intoView).not.toHaveBeenCalled();
    timers[0]?.();
    const outcome = await pending;
    expect(outcome.status).toBe("revealed");
    expect(intoView).toHaveBeenCalledTimes(1);
  });

  it("supersedes a pending frame and mark for the same key", async () => {
    const { intoView } = installScrollSpies();
    const frames: Array<() => void> = [];
    const anchors = registry({
      frame: (fn) => {
        frames.push(fn);
        return (): void => {
          const index = frames.indexOf(fn);
          if (index >= 0) {
            frames.splice(index, 1);
          }
        };
      },
      scheduler: () => (): void => undefined,
    });
    const first: HTMLElement = mount();
    const second: HTMLElement = mount();
    anchors.register("deal", first);
    anchors.register("deal", second);
    first.style.display = "none";

    const firstReveal = anchors.reveal("deal", { defer: "frame", behavior: "auto" });
    expect(frames).toHaveLength(1);
    const secondReveal = anchors.reveal("deal", { behavior: "auto", markMs: 25 });
    const firstOutcome = await firstReveal;
    const secondOutcome = await secondReveal;
    expect(firstOutcome.status).toBe("aborted");
    expect(secondOutcome.status).toBe("revealed");
    expect(secondOutcome.element).toBe(second);
    expect(intoView).toHaveBeenCalledTimes(1);
    expect(second.dataset.conciergeReveal).toBe("true");

    const third = await anchors.reveal("deal", { markMs: 25 });
    expect(third.status).toBe("revealed");
    expect(second.dataset.conciergeReveal).toBe("true");
  });

  it("returns aborted without scrolling when the signal is already aborted", async () => {
    const { intoView } = installScrollSpies();
    const anchors = registry();
    const element: HTMLElement = mount();
    anchors.register("deal", element);
    const controller = new AbortController();
    controller.abort();

    const outcome = await anchors.reveal("deal", { signal: controller.signal });
    expect(outcome).toEqual({
      status: "aborted",
      element: null,
      report: null,
    });
    expect(intoView).not.toHaveBeenCalled();
  });

  it("aborts a pending deferred frame and never scrolls", async () => {
    const { intoView } = installScrollSpies();
    const frames: Array<() => void> = [];
    const anchors = registry({
      frame: (fn) => {
        frames.push(fn);
        return (): void => {
          const index = frames.indexOf(fn);
          if (index >= 0) {
            frames.splice(index, 1);
          }
        };
      },
      scheduler: () => (): void => undefined,
    });
    const element: HTMLElement = mount();
    anchors.register("deal", element);
    const controller = new AbortController();

    const pending = anchors.reveal("deal", {
      defer: "frame",
      signal: controller.signal,
    });
    controller.abort();
    const outcome = await pending;
    expect(outcome.status).toBe("aborted");
    expect(intoView).not.toHaveBeenCalled();
    frames[0]?.();
    expect(intoView).not.toHaveBeenCalled();
  });

  it("returns an outcome when the injected frame fires synchronously", async () => {
    installScrollSpies();
    const anchors = registry({
      frame: (fn) => {
        fn();
        return (): void => undefined;
      },
      scheduler: (fn, delayMs) => {
        if (delayMs <= 0) {
          fn();
        }
        return (): void => undefined;
      },
    });
    const element: HTMLElement = mount();
    anchors.register("deal", element);

    const outcome = await anchors.reveal("deal", {
      defer: "frame",
      behavior: "auto",
    });
    expect(outcome.status).toBe("revealed");
    expect(outcome.element).toBe(element);
  });

  it("returns an outcome when the fallback scheduler fires synchronously", async () => {
    installScrollSpies();
    const anchors = registry({
      frameFallbackMs: 0,
      frame: () => (): void => undefined,
      scheduler: (fn, delayMs) => {
        if (delayMs <= 0) {
          fn();
        }
        return (): void => undefined;
      },
    });
    const element: HTMLElement = mount();
    anchors.register("deal", element);

    const outcome = await anchors.reveal("deal", {
      defer: "frame",
      behavior: "auto",
    });
    expect(outcome.status).toBe("revealed");
  });

  it("sets the reserved reveal mark and removes it when the scheduler fires", async () => {
    installScrollSpies();
    let expire: (() => void) | undefined;
    const anchors = registry({
      scheduler: (fn) => {
        expire = fn;
        return (): void => undefined;
      },
    });
    const element: HTMLElement = mount();
    anchors.register("deal", element);

    await anchors.reveal("deal", { markMs: 40, behavior: "auto" });
    expect(element.dataset.conciergeReveal).toBe("true");
    expect(element.getAttribute(REVEAL_ATTRIBUTE)).toBe("true");
    expire?.();
    expect(element.dataset.conciergeReveal).toBeUndefined();
  });
});
