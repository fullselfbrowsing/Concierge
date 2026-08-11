// @ts-expect-error Node types stay outside the browser-facing package program.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
// @ts-expect-error Node types stay outside the browser-facing package program.
import { resolve } from "node:path";
// @ts-expect-error Node types stay outside the browser-facing package program.
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

type ExportConditions = {
  readonly types: string;
  readonly svelte: string;
  readonly import: string;
  readonly default: string;
};

type PackageManifest = {
  readonly main: string;
  readonly types: string;
  readonly svelte: string;
  readonly scripts: { readonly build: string };
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly exports: {
    readonly ".": ExportConditions;
    readonly "./client.svelte": ExportConditions;
    readonly "./package.json": string;
  };
};

const PACKAGE_DIR = fileURLToPath(new URL("../", import.meta.url));
const DIST_DIR = resolve(PACKAGE_DIR, "dist");
const PACKAGE_PATH = resolve(PACKAGE_DIR, "package.json");
const ROOT_PATH = resolve(DIST_DIR, "index.js");
const ROOT_TYPES_PATH = resolve(DIST_DIR, "index.d.ts");
const CLIENT_PATH = resolve(DIST_DIR, "client.svelte.js");
const CLIENT_TYPES_PATH = resolve(DIST_DIR, "client.svelte.d.ts");
const ADAPTER_SOURCE_PATH = resolve(PACKAGE_DIR, "src/client.svelte.ts");
const BROWSER_GLOBALS = ["window", "document", "navigator"] as const;

function requireArtifact(path: string): string {
  if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size <= 0) {
    throw new Error(
      `${path} is missing or empty. This suite requires a successful ` +
        `@fullselfbrowsing/concierge-svelte svelte-package build.`,
    );
  }

  return readFileSync(path, "utf8");
}

function readManifest(): PackageManifest {
  return JSON.parse(requireArtifact(PACKAGE_PATH)) as PackageManifest;
}

function conditionTargets(conditions: ExportConditions): readonly string[] {
  return [
    conditions.types,
    conditions.svelte,
    conditions.import,
    conditions.default,
  ];
}

function assertOrderedTokens(source: string, tokens: readonly string[]): void {
  let previousIndex = -1;

  for (const token of tokens) {
    const index = source.indexOf(token);
    expect(index, `built client is missing ${token}`).toBeGreaterThan(
      previousIndex,
    );
    previousIndex = index;
  }
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

describe("the built @fullselfbrowsing/concierge-svelte entries", () => {
  it("maps every public condition to a nonempty svelte-package artifact", () => {
    const manifest = readManifest();
    const rootConditions = manifest.exports["."];
    const clientConditions = manifest.exports["./client.svelte"];

    expect(manifest.scripts.build).toBe("svelte-package");
    expect(JSON.stringify(manifest)).not.toContain("tsdown");
    expect(manifest.dependencies?.["@fullselfbrowsing/concierge"]).toBeUndefined();
    expect(manifest.peerDependencies["@fullselfbrowsing/concierge"]).toBe(
      "workspace:^",
    );
    expect(Object.keys(rootConditions)).toEqual([
      "types",
      "svelte",
      "import",
      "default",
    ]);
    expect(Object.keys(clientConditions)).toEqual([
      "types",
      "svelte",
      "import",
      "default",
    ]);

    const targets = new Set([
      manifest.main,
      manifest.types,
      manifest.svelte,
      ...conditionTargets(rootConditions),
      ...conditionTargets(clientConditions),
      manifest.exports["./package.json"],
    ]);

    for (const target of targets) {
      requireArtifact(resolve(PACKAGE_DIR, target));
    }
  });

  it("retains declarations, maps, guard order, and the compilable rune snapshot path", () => {
    const rootSource = requireArtifact(ROOT_PATH);
    const rootTypes = requireArtifact(ROOT_TYPES_PATH);
    const clientSource = requireArtifact(CLIENT_PATH);
    const clientTypes = requireArtifact(CLIENT_TYPES_PATH);
    const adapterSource = requireArtifact(ADAPTER_SOURCE_PATH);
    const rootTypesMap = requireArtifact(`${ROOT_TYPES_PATH}.map`);
    const clientTypesMap = requireArtifact(`${CLIENT_TYPES_PATH}.map`);

    expect(readdirSync(DIST_DIR).sort()).toEqual([
      "client.svelte.d.ts",
      "client.svelte.d.ts.map",
      "client.svelte.js",
      "index.d.ts",
      "index.d.ts.map",
      "index.js",
    ]);
    expect(rootSource).not.toContain("createConcierge");
    expect(clientSource).toContain('from "@fullselfbrowsing/concierge"');
    expect(clientSource).not.toContain("concierge.contract.global");
    expect(rootTypes).toContain("SnapshotNormalizer");
    expect(clientTypes).toContain("provideConcierge");
    expect(clientTypes).toContain("useConcierge");
    expect(clientTypes).toContain("useConciergeBridge");
    expect(clientTypes).toContain("svelteSnapshotNormalizer");

    for (const [mapSource, sourceName] of [
      [rootTypesMap, "index.ts"],
      [clientTypesMap, "client.svelte.ts"],
    ] as const) {
      expect(JSON.parse(mapSource).sources).toContain(`../src/${sourceName}`);
    }

    assertOrderedTokens(clientSource, [
      "assertSingleInstance()",
      "CONTRACT_VERSION !== EXPECTED_CONTRACT_VERSION",
      "@fullselfbrowsing/concierge-svelte expected core contract v",
      "but found v",
      "upgrade or reinstall",
      "registry.register(bridge)",
    ]);
    expect(clientSource).toMatch(/EXPECTED_CONTRACT_VERSION\s*=\s*1\b/u);

    expect(adapterSource).toContain("return $state.snapshot(value);");
    expect(adapterSource).not.toMatch(/\b(?:as|any)\b/u);
    expect(clientSource).toContain("return $state.snapshot(value);");
    expect(clientSource).not.toContain("svelte/internal/client");
    expect(clientSource).not.toMatch(
      /structuredClone|JSON\.(?:parse|stringify)|return\s+value\s*;/u,
    );

    const privateOutput = readdirSync(DIST_DIR).filter((name: string) =>
      /(?:test|spec|Harness)/u.test(name),
    );
    expect(privateOutput).toEqual([]);
  });

  it("imports both built entries under Node without registering a bridge", async () => {
    let registrations = 0;
    const spyRegistry = {
      id: "svelte-artifact-ssr",
      read: () => null,
      register: () => {
        registrations += 1;
        return (): void => undefined;
      },
    };

    await withoutBrowserGlobals(async () => {
      const [root, client] = await Promise.all([
        import(`${new URL("../dist/index.js", import.meta.url).href}?server-root`),
        import(
          `${new URL("../dist/client.svelte.js", import.meta.url).href}?server-client`
        ),
      ]);

      expect(Object.keys(root)).toEqual([]);
      expect(Object.keys(client).sort()).toEqual([
        "provideConcierge",
        "svelteSnapshotNormalizer",
        "useConcierge",
        "useConciergeBridge",
      ]);
      expect(spyRegistry.read()).toBeNull();
      expect(registrations).toBe(0);
    });
  });
});
