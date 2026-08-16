import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

const ROOT_README_URL = new URL("../../../README.md", import.meta.url);
const ROOT_README_PATH = fileURLToPath(ROOT_README_URL);
const PACKAGE_README_URL = new URL("../README.md", import.meta.url);
const SECURITY_HEADING = "Security model";
const SERVER_EXAMPLE_HEADING =
  "### Illustrative relying-server challenge lifecycle";
const REAUTHORIZE_LINE =
  "await authorizeUnderCurrentPolicy(authenticatedPrincipal, exactAction);";
const EFFECT_LINE =
  "await performGuardedEffect(transaction, authenticatedPrincipal, exactAction, exactPayload);";

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

function extractServerExample(section: string): string {
  const headingStart = section.indexOf(SERVER_EXAMPLE_HEADING);
  expect(
    headingStart,
    `security section is missing \"${SERVER_EXAMPLE_HEADING}\"`,
  ).toBeGreaterThanOrEqual(0);

  const afterHeading = section.slice(headingStart + SERVER_EXAMPLE_HEADING.length);
  const codeBlock = afterHeading.match(/```(?:ts|typescript)\r?\n([\s\S]*?)\r?\n```/);
  expect(codeBlock, "security section is missing its TypeScript server pseudocode").not.toBeNull();
  return codeBlock?.[1] ?? "";
}

function validateRedemptionOrder(example: string): void {
  const redemptionStart = example.indexOf("async function redeemServerChallenge");
  if (redemptionStart < 0) throw new Error("missing challenge redemption function");

  const lines = example
    .slice(redemptionStart)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("//"));

  const requiredLines = [
    "const authenticatedPrincipal = await authenticatePrincipal(request);",
    "await serverDatabase.serializedTransaction(async (transaction) => {",
    "const challenge = await transaction.challengeStore.lockAndLoad(challengeId);",
    "assertSamePrincipalAndSession(challenge, authenticatedPrincipal);",
    "assertExactAction(challenge.exactAction, exactAction);",
    "assertCanonicalPayloadDigest(challenge.canonicalPayloadDigest, canonicalPayloadDigest(exactPayload));",
    "assertFresh(challenge.expiresAt, serverClock.now());",
    "assertUnused(challenge);",
    REAUTHORIZE_LINE,
    EFFECT_LINE,
    "await transaction.challengeStore.burn(challenge.challengeId);",
    "await transaction.commit();",
  ];

  let previousIndex = -1;
  for (const requiredLine of requiredLines) {
    const index = lines.indexOf(requiredLine);
    const label = requiredLine === REAUTHORIZE_LINE
      ? "current-policy reauthorization of the authenticated principal and exact action"
      : requiredLine;
    if (index < 0) throw new Error(`missing ${label}`);
    if (index <= previousIndex) throw new Error(`server lifecycle is out of order at ${label}`);
    previousIndex = index;
  }

  const reauthorizationIndex = lines.indexOf(REAUTHORIZE_LINE);
  if (lines[reauthorizationIndex + 1] !== EFFECT_LINE) {
    throw new Error("current-policy reauthorization must immediately precede the guarded effect");
  }
}

it("states that client consent evidence is untrusted and grants no server authority", () => {
  const marker = "[RED:P03:client-consent-is-not-server-authority]";
  expect(ROOT_README_PATH.endsWith("/README.md")).toBe(true);
  expect(ROOT_README_PATH.includes("/packages/concierge/README.md")).toBe(false);

  const readme = readFileSync(ROOT_README_URL, "utf8");
  const section = normalizeWhitespace(extractSecuritySection(readme));

  expect(section).toMatch(/client consent record/i);
  expect(section).toMatch(/model output trustworthy/i);

  expect(section, marker).toMatch(/not server authorization/i);
  expect(section).toMatch(/server[^.]*independently authenticate/i);
  expect(section).toMatch(/authorize the exact action and payload/i);
});

it("guards the package's documented server-owned enforcement boundary", () => {
  const rootReadme = readFileSync(ROOT_README_URL, "utf8");
  const section = normalizeWhitespace(extractSecuritySection(rootReadme));
  expect(section).toMatch(/authenticate the current principal/i);
  expect(section).toMatch(/authorize the exact action and payload/i);
  expect(section).toMatch(/reject replay/i);
  expect(section).toMatch(/idempotent or transactional/i);

  const packageReadme = readFileSync(PACKAGE_README_URL, "utf8");
  expect(packageReadme).toContain("## Atomic catalog admission");
  expect(packageReadme).not.toContain("redeemServerChallenge");
});

it("keeps catalog minimization distinct from authentication and authorization", () => {
  const section = normalizeWhitespace(
    extractSecuritySection(readFileSync(ROOT_README_URL, "utf8")),
  );
  expect(section).toMatch(/least-authority boundary, not an authentication system/i);
  expect(section).toMatch(/does not authenticate a user/i);
});
