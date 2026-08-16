import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const packageRoot = new URL("../../", import.meta.url);

describe("published artifact boundaries", () => {
  it("publishes neutral, server, browser, and browser-safe server entries", async () => {
    const manifest = JSON.parse(await readFile(
      new URL("package.json", packageRoot),
      "utf8",
    ));

    expect(manifest.version).toMatch(/^0\.2\.\d+$/u);
    expect(manifest.peerDependencies.ai).toBe("^6.0.0 || ^7.0.0");
    expect(manifest.peerDependenciesMeta.ai).toEqual({ optional: true });
    expect(manifest.publishConfig).toEqual({ access: "public", tag: "latest" });
    expect(manifest.exports["./ai-sdk/server"].browser).toBe(
      "./dist/ai-sdk/server-unavailable.js",
    );
    expect(manifest.exports["./ai-sdk/browser"].default).toBe(
      "./dist/ai-sdk/browser.js",
    );
  });

  it("keeps signing authority out of neutral and browser JavaScript", async () => {
    const [root, browser, server] = await Promise.all([
      readFile(new URL("dist/ai-sdk/index.js", packageRoot), "utf8"),
      readFile(new URL("dist/ai-sdk/browser.js", packageRoot), "utf8"),
      readFile(new URL("dist/ai-sdk/server.js", packageRoot), "utf8"),
    ]);

    for (const artifact of [root, browser]) {
      expect(artifact).not.toContain("PRIVATE KEY");
      expect(artifact).not.toContain("privateKey");
      expect(artifact).not.toContain("subtle.sign");
      expect(artifact).not.toContain("createSignedBatchIssuer");
    }
    expect(server).toContain("PRIVATE KEY");
    expect(server).toContain("subtle.sign");
  });

  it("keeps AI SDK optional and out of the core root entry", async () => {
    const [core, adapter, browser, server] = await Promise.all([
      readFile(new URL("dist/index.js", packageRoot), "utf8"),
      readFile(new URL("dist/ai-sdk/index.js", packageRoot), "utf8"),
      readFile(new URL("dist/ai-sdk/browser.js", packageRoot), "utf8"),
      readFile(new URL("dist/ai-sdk/server.js", packageRoot), "utf8"),
    ]);

    expect(core).not.toMatch(/from "ai"/u);
    expect(core).not.toContain("createAISDKAdapter");
    expect(adapter).toMatch(/from "ai"/u);
    expect(adapter).not.toContain("function jsonSchema(");
    expect(browser).not.toMatch(/from "ai"/u);
    expect(server).not.toMatch(/from "ai"/u);
  });

  it("throws deterministically if the server entry reaches a browser bundle", async () => {
    const unavailable = await import("../../dist/ai-sdk/server-unavailable.js");
    expect(() => unavailable.createSignedBatchIssuer()).toThrow(
      "unavailable in browser bundles",
    );
  });

  it("marks the memory replay store test-only in the published declarations", async () => {
    const declarations = await readFile(
      new URL("dist/ai-sdk/browser.d.ts", packageRoot),
      "utf8",
    );
    expect(declarations).toContain("replay storage for tests only");
    expect(declarations).toContain("createTestMemoryReplayStore");
    expect(declarations).not.toContain("createMemoryReplayStore");
  });
});
