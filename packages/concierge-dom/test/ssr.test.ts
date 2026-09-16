import { describe, expect, it } from "vitest";

import {
  EXPECTED_CORE_CONTRACT_VERSION,
  createAnchorRegistry,
  isReadable,
  isRendered,
  scrollViewport,
} from "../src/index.js";

describe("server-safe construction", () => {
  it("constructs a frozen registry without touching a document", () => {
    expect("document" in globalThis).toBe(false);
    expect("window" in globalThis).toBe(false);

    const anchors = createAnchorRegistry({ id: "ssr" });
    expect(anchors.id).toBe("ssr");
    expect(Object.isFrozen(anchors)).toBe(true);
    expect(anchors.keys()).toEqual([]);
    expect(anchors.resolve("missing").status).toBe("not-registered");
    expect(EXPECTED_CORE_CONTRACT_VERSION).toBe(4);
  });

  it("applies visibility policies without a document", () => {
    expect(
      isRendered({
        connected: true,
        hiddenBy: null,
        styledOutBy: null,
        busy: true,
        hasLayout: false,
        depth: 0,
      }),
    ).toBe(true);
    expect(
      isReadable({
        connected: true,
        hiddenBy: null,
        styledOutBy: null,
        busy: true,
        hasLayout: false,
        depth: 0,
      }),
    ).toBe(false);
  });

  it("throws when a viewport helper is invoked without window", () => {
    expect(() => scrollViewport("down")).toThrow(ReferenceError);
  });
});
