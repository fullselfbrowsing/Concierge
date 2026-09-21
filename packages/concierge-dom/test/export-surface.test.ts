import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const DTS_URL = new URL("../dist/index.d.ts", import.meta.url);
const DTS_PATH = fileURLToPath(DTS_URL);
const JS_URL = new URL("../dist/index.js", import.meta.url);
const JS_PATH = fileURLToPath(JS_URL);

const EXPORT_BLOCK = /^export\s*\{([^}]*)\}\s*;?\s*$/gm;

interface Surface {
  readonly names: readonly string[];
  readonly values: readonly string[];
  readonly types: readonly string[];
}

function readSurface(): Surface {
  const source = readFileSync(DTS_PATH, "utf8");
  const blocks = [...source.matchAll(EXPORT_BLOCK)];
  if (blocks.length === 0) {
    throw new Error(
      "no trailing `export { … };` statement found in dist/index.d.ts",
    );
  }

  const entries = blocks
    .flatMap((block) => (block[1] ?? "").split(","))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return {
    names: entries.map((entry) => entry.replace(/^type\s+/, "")),
    values: entries.filter((entry) => !/^type\s/.test(entry)),
    types: entries
      .filter((entry) => /^type\s/.test(entry))
      .map((entry) => entry.replace(/^type\s+/, "")),
  };
}

const VALUE_EXPORTS = [
  "ANCESTOR_WALK_LIMIT",
  "EXPECTED_CORE_CONTRACT_VERSION",
  "REVEAL_ATTRIBUTE",
  "createAnchorRegistry",
  "isReadable",
  "isRendered",
  "measureVisibility",
  "preferredScrollBehavior",
  "readViewportPosition",
  "scrollViewport",
] as const;

beforeAll(() => {
  if (!existsSync(DTS_PATH) || !existsSync(JS_PATH)) {
    throw new Error(
      "packages/concierge-dom/dist is missing. This guard reads the BUILT " +
        "declaration file, not the source. Run `pnpm build` first.",
    );
  }
});

describe("the published export surface of dist/index.d.ts", () => {
  it("is exactly 30 names — an export added or dropped by a build-config change lands here", () => {
    const { names } = readSurface();
    expect(names).toHaveLength(30);
  });

  it("splits 20 types to 10 values", () => {
    const { types, values } = readSurface();
    expect(types).toHaveLength(20);
    expect(values).toHaveLength(10);
  });

  it("carries all ten runtime value exports by name", () => {
    const { values } = readSurface();
    for (const name of VALUE_EXPORTS) {
      expect(values).toContain(name);
    }
  });

  it("does not publish PACKAGE, REVEAL_DATASET_KEY, or sanitizeText", () => {
    const { names } = readSurface();
    expect(names).not.toContain("PACKAGE");
    expect(names).not.toContain("REVEAL_DATASET_KEY");
    expect(names).not.toContain("sanitizeText");
  });

  it("pins the contract literal at 4 in the built artifact", () => {
    const source = readFileSync(JS_PATH, "utf8");
    expect(source).toMatch(/EXPECTED_CORE_CONTRACT_VERSION\s*=\s*4\b/u);
    expect(source).toContain("assertSingleInstance()");
    expect(source).toMatch(/CONTRACT_VERSION\s*!==\s*4\b/u);
    expect(source).toContain(
      "@full-self-browsing/concierge-dom expected core contract v4",
    );
  });
});
