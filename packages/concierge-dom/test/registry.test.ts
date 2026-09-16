import { afterEach, describe, expect, it, vi } from "vitest";

import * as core from "@full-self-browsing/concierge";

import { createAnchorRegistry } from "../src/index.js";
import { mount, registry } from "./harness.js";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("createAnchorRegistry", () => {
  it("constructs a frozen capability without calling assertSingleInstance", () => {
    const spy = vi.spyOn(core, "assertSingleInstance");
    const anchors = createAnchorRegistry({ id: "pipeline" });

    expect(anchors.id).toBe("pipeline");
    expect(Object.isFrozen(anchors)).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    expect(() => {
      (anchors as { resolve: unknown }).resolve = (): void => undefined;
    }).toThrow(TypeError);
  });

  it("calls assertSingleInstance on the first registration only", () => {
    const spy = vi.spyOn(core, "assertSingleInstance");
    const anchors = registry();
    const first: HTMLElement = mount();
    const second: HTMLElement = mount();

    const releaseFirst = anchors.register("deal-1", first);
    expect(spy).toHaveBeenCalledTimes(1);
    anchors.register("deal-2", second);
    expect(spy).toHaveBeenCalledTimes(1);
    releaseFirst();
    anchors.register("deal-1", first);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("holds a set of registrations per key and unregisters only the matching token", () => {
    const anchors = registry();
    const first: HTMLElement = mount("div", "one");
    const second: HTMLElement = mount("div", "two");

    const releaseFirst = anchors.register("deal", first);
    const releaseSecond = anchors.register("deal", second);
    expect(anchors.resolve("deal").registered).toBe(2);
    expect(anchors.resolve("deal").element).toBe(first);

    releaseFirst();
    expect(anchors.resolve("deal").registered).toBe(1);
    expect(anchors.resolve("deal").element).toBe(second);

    releaseFirst();
    expect(anchors.resolve("deal").registered).toBe(1);

    const reregistered = anchors.register("deal", first);
    releaseSecond();
    expect(anchors.resolve("deal").element).toBe(first);
    reregistered();
    expect(anchors.resolve("deal").status).toBe("not-registered");
  });

  it("refuses a stale cleanup when the same element is registered again", () => {
    const anchors = registry();
    const element: HTMLElement = mount();
    const stale = anchors.register("deal", element);
    const live = anchors.register("deal", element);

    stale();
    expect(anchors.resolve("deal").registered).toBe(1);
    expect(anchors.resolve("deal").element).toBe(element);
    live();
    expect(anchors.resolve("deal").status).toBe("not-registered");
  });

  it("returns the same ref callback for a key and overwrites options for later registrations", () => {
    const anchors = registry();
    const first = anchors.ref("notes");
    const second = anchors.ref("notes", { readable: true });
    expect(first).toBe(second);

    const element: HTMLElement = mount("section", "notes");
    first(element);
    expect(anchors.readUntrusted("notes", { maxChars: 80 }).status).toBe("read");

    const other = anchors.ref("panel");
    expect(other).not.toBe(first);
    other(element);
    expect(anchors.readUntrusted("panel", { maxChars: 80 }).status).toBe(
      "not-readable",
    );

    first(null);
    expect(anchors.resolve("notes").status).toBe("not-registered");
  });

  it("action registers on the node and destroy unregisters that token", () => {
    const anchors = registry();
    const node: HTMLElement = mount("li", "line");
    const applied = anchors.action("line:1")(node);
    expect(anchors.resolve("line:1").element).toBe(node);
    applied.destroy();
    expect(anchors.resolve("line:1").status).toBe("not-registered");
  });

  it("keys returns a sorted frozen snapshot of live keys", () => {
    const anchors = registry();
    anchors.register("zeta", mount());
    anchors.register("alpha", mount());
    const keys = anchors.keys();
    expect(keys).toEqual(["alpha", "zeta"]);
    expect(Object.isFrozen(keys)).toBe(true);
  });

  it("clear drops every registration and cancels pending marks", async () => {
    const cancels: string[] = [];
    const anchors = registry({
      scheduler: (fn, _delayMs) => {
        return (): void => {
          cancels.push("mark");
          void fn;
        };
      },
    });
    const element: HTMLElement = mount();
    anchors.register("deal", element);
    await anchors.reveal("deal", { markMs: 50, behavior: "auto" });
    expect(element.dataset.conciergeReveal).toBe("true");

    anchors.clear();
    expect(anchors.keys()).toEqual([]);
    expect(anchors.resolve("deal").status).toBe("not-registered");
    expect(element.dataset.conciergeReveal).toBeUndefined();
    expect(cancels).toEqual(["mark"]);
  });
});
