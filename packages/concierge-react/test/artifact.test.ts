import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

const ROOT_URL = new URL("../dist/index.js", import.meta.url);
const CLIENT_URL = new URL("../dist/client.js", import.meta.url);
const CORE_URL = new URL("../../concierge/dist/index.js", import.meta.url);
const ROOT_PATH = fileURLToPath(ROOT_URL);
const CLIENT_PATH = fileURLToPath(CLIENT_URL);
const CORE_PATH = fileURLToPath(CORE_URL);
const BROWSER_GLOBALS = ["window", "document", "navigator"] as const;

function requireArtifact(path: string): string {
  if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size <= 0) {
    throw new Error(
      `${path} is missing or empty. This suite requires a successful ` +
        `@full-self-browsing/concierge-react package build.`,
    );
  }

  return readFileSync(path, "utf8");
}

function directiveCount(source: string, directive: string): number {
  const pattern = new RegExp(
    `(?:^|\\n)\\s*["']${directive}["'];`,
    "gu",
  );
  return source.match(pattern)?.length ?? 0;
}

function firstDirective(source: string): string | null {
  const match = /^\s*(["'])([^"']+)\1;/u.exec(source);
  return match?.[2] ?? null;
}

async function withoutBrowserGlobals<T>(run: () => Promise<T>): Promise<T> {
  const descriptors = new Map<string, PropertyDescriptor>();

  for (const name of BROWSER_GLOBALS) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    if (descriptor !== undefined) {
      descriptors.set(name, descriptor);
    }
    if (!Reflect.deleteProperty(globalThis, name)) {
      throw new Error(`could not remove browser global ${name}`);
    }
  }

  try {
    for (const name of BROWSER_GLOBALS) {
      expect(name in globalThis).toBe(false);
    }
    return await run();
  } finally {
    for (const [name, descriptor] of descriptors) {
      Object.defineProperty(globalThis, name, descriptor);
    }
  }
}

describe("the built @full-self-browsing/concierge-react entries", () => {
  it("preserves one client directive, guard order, and zero-registration server rendering", async () => {
    const rootSource = requireArtifact(ROOT_PATH);
    const clientSource = requireArtifact(CLIENT_PATH);
    const coreSource = requireArtifact(CORE_PATH);

    expect(firstDirective(clientSource)).toBe("use client");
    expect(directiveCount(clientSource, "use client")).toBe(1);
    expect(directiveCount(rootSource, "use client")).toBe(0);
    expect(directiveCount(coreSource, "use client")).toBe(0);

    const guardSequence = [
      "assertSingleInstance()",
      "CONTRACT_VERSION !== EXPECTED_CONTRACT_VERSION",
      "@full-self-browsing/concierge-react expected core contract v",
      "but found v",
      "upgrade or reinstall",
      "registry.register(bridge)",
    ] as const;
    let previousIndex = -1;
    for (const token of guardSequence) {
      const index = clientSource.indexOf(token);
      expect(index, `built client is missing ${token}`).toBeGreaterThan(
        previousIndex,
      );
      previousIndex = index;
    }
    expect(clientSource).toMatch(/EXPECTED_CONTRACT_VERSION\s*=\s*2\b/u);

    await withoutBrowserGlobals(async () => {
      const [root, client, core] = await Promise.all([
        import(`${ROOT_URL.href}?server-safe-root`),
        import(`${CLIENT_URL.href}?server-safe-client`),
        import(CORE_URL.href),
      ]);

      expect(Object.keys(root)).toEqual([]);
      expect(typeof client.ConciergeActivityOverlay).toBe("function");
      expect(typeof client.ConciergeProvider).toBe("function");
      expect(typeof client.useConciergeActivity).toBe("function");
      expect(typeof client.useConciergeBridge).toBe("function");
      expect(typeof core.createBridge).toBe("function");

      const liveRegistry = core.createBridge("react-artifact-ssr");
      let registrations = 0;
      const registry = {
        id: liveRegistry.id,
        read: liveRegistry.read,
        register(bridge: unknown) {
          registrations += 1;
          return liveRegistry.register(bridge);
        },
      };
      const bridge = {
        actions: {},
        snapshot: { server: () => true },
      };
      const concierge = {
        dispatch: async () => ({ ok: true, message: "Done." }),
        dispatchBatch: async () => ({ kind: "completed", rows: [] }),
        resolveCatalog: () => ({
          stage: null,
          tools: [],
          revision: Symbol("artifact-catalog"),
        }),
        onDispatch: () => () => undefined,
        explain: () => ({ stage: null, stages: [], catalog: [] }),
      };

      function ServerConsumer() {
        client.useConciergeBridge(registry, bridge);
        const readValue = client.useConciergeValue({ server: true });
        const exact = client.useConcierge() === concierge;
        return createElement(
          "span",
          null,
          exact && readValue().server ? "exact-server-value" : "wrong-value",
        );
      }

      const markup = renderToString(
        createElement(
          client.ConciergeProvider,
          { concierge },
          createElement(
            "div",
            null,
            createElement(client.ConciergeActivityOverlay, {
              poweredByFSB: true,
            }),
            createElement(ServerConsumer),
          ),
        ),
      );

      expect(markup).toContain("exact-server-value");
      expect(markup).not.toContain("Powered by FSB");
      expect(registrations).toBe(0);
      expect(registry.read()).toBeNull();
    });
  });
});
