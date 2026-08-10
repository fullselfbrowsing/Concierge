import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

const ROOT_README_URL = new URL("../../../README.md", import.meta.url);
const ROOT_README_PATH = fileURLToPath(ROOT_README_URL);
const SECURITY_HEADING =
  "Security Boundary: Client Consent Is Not Server Authorization";

function extractSecuritySection(readme: string): string {
  const heading = `## ${SECURITY_HEADING}`;
  const start = readme.indexOf(heading);

  expect(start, `root README is missing the named \"${heading}\" section`).toBeGreaterThanOrEqual(0);

  const remainder = readme.slice(start + heading.length);
  const nextSection = remainder.search(/^## /m);
  return nextSection === -1 ? remainder : remainder.slice(0, nextSection);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

it("states that client consent evidence is untrusted and grants no server authority", () => {
  expect(ROOT_README_PATH.endsWith("/README.md")).toBe(true);
  expect(ROOT_README_PATH.includes("/packages/concierge/README.md")).toBe(false);

  const readme = readFileSync(ROOT_README_URL, "utf8");
  const section = normalizeWhitespace(extractSecuritySection(readme));

  expect(section).toMatch(/client-side consent state/i);
  expect(section).toMatch(/grades/i);
  expect(section).toMatch(/receipts/i);
  expect(section).toMatch(/attestations/i);
  expect(section).toMatch(/callbacks/i);
  expect(section).toMatch(/ConsentAck/i);
  expect(section).toMatch(/client assertions?/i);
  expect(section).toMatch(/untrusted/i);

  expect(section).toMatch(/does not authenticate/i);
  expect(section).toMatch(/does not authorize/i);
  expect(section).toMatch(/cannot independently permit[^.]*protected server effect/i);
  expect(section).toMatch(/ConsentAck[^.]*never[^.]*server authorization/i);
});
