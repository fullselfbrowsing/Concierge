import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import {
  BANNED_CLASSES,
  assertCatalogBoundary,
  findBannedIdentifiers,
} from "../../../scripts/pkg-dom-catalog-boundary.mjs";

const JS_PATH = fileURLToPath(new URL("../dist/index.js", import.meta.url));

let artifact: string = "";

beforeAll(() => {
  if (!existsSync(JS_PATH)) {
    throw new Error(
      "packages/concierge-dom/dist/index.js is missing. Build the package first.",
    );
  }
  artifact = readFileSync(JS_PATH, "utf8");
});

describe("the built concierge-dom catalog boundary", () => {
  it("contains no banned host-DOM identifiers", () => {
    expect(findBannedIdentifiers(artifact)).toEqual([]);
    expect(() => assertCatalogBoundary(artifact)).not.toThrow();
  });

  it("goes red for each banned identifier class when that class is injected", () => {
    expect(BANNED_CLASSES.length).toBeGreaterThan(0);
    for (const banned of BANNED_CLASSES) {
      const findings = findBannedIdentifiers(
        `${artifact}\n${banned.representative}\n`,
      );
      expect(
        findings.some((finding) => finding.classId === banned.id),
        `class ${banned.id} stayed green after injecting ${banned.representative}`,
      ).toBe(true);
    }
  });

  it("keeps core as an external import rather than bundling it", () => {
    expect(artifact).toContain("@full-self-browsing/concierge");
  });
});
