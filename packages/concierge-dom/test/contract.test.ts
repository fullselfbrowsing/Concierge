import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@full-self-browsing/concierge", async (importOriginal) => {
  const actual: typeof import("@full-self-browsing/concierge") =
    await importOriginal();
  return {
    ...actual,
    CONTRACT_VERSION: 3,
  };
});

import { createAnchorRegistry } from "../src/index.js";

afterEach(() => {
  document.body.replaceChildren();
});

describe("core contract mismatch", () => {
  it("throws on the first registration and stores nothing", () => {
    const anchors = createAnchorRegistry({ id: "mismatch" });
    const element: HTMLElement = document.createElement("div");
    document.body.appendChild(element);

    expect(() => anchors.register("deal", element)).toThrow(
      /@full-self-browsing\/concierge-dom expected core contract v4[\s\S]*found v3[\s\S]*upgrade or reinstall/,
    );
    expect(anchors.resolve("deal").status).toBe("not-registered");
    expect(anchors.keys()).toEqual([]);
  });
});
