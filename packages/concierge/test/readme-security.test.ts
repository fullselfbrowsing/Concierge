import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

const ROOT_README_URL = new URL("../../../README.md", import.meta.url);
const ROOT_README_PATH = fileURLToPath(ROOT_README_URL);
const PACKAGE_README_URL = new URL("../README.md", import.meta.url);
const SECURITY_HEADING =
  "Security Boundary: Client Consent Is Not Server Authorization";
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

it("guards the ordered server-owned challenge lifecycle", () => {
  const rootReadme = readFileSync(ROOT_README_URL, "utf8");
  const rawSection = extractSecuritySection(rootReadme);
  const section = normalizeWhitespace(rawSection);
  const example = extractServerExample(rawSection);

  expect(section).toMatch(/server-issued/i);
  expect(section).toMatch(/server-stored/i);
  expect(section).toMatch(/high-entropy/i);
  expect(section).toMatch(/client-invented[^.]*reject/i);
  expect(section).toMatch(/wrong principal[^.]*reject/i);
  expect(section).toMatch(/changed payload[^.]*reject/i);
  expect(section).toMatch(/expired[^.]*reject/i);
  expect(section).toMatch(/replay[^.]*reject/i);
  expect(section).toMatch(/issuance-time[^.]*cannot[^.]*current authorization/i);
  expect(section).toMatch(/ConsentAck[^.]*untrusted[^.]*not authoritative/i);
  expect(section).toMatch(/denial[^.]*abort[^.]*no effect/i);
  expect(section).toMatch(/concurren[^.]*serializ/i);
  expect(section).toMatch(/atomic/i);
  expect(section).toMatch(/idempotent[^.]*crash recovery/i);
  expect(section).toMatch(/illustrative[^.]*not production-complete/i);

  expect(example).toMatch(/serverRandomHighEntropyChallenge\(\)/);
  expect(example).toMatch(/challengeStore\.insert\(\{/);
  expect(example).toMatch(/principalId: authenticatedPrincipal\.id/);
  expect(example).toMatch(/sessionId: authenticatedPrincipal\.sessionId/);
  expect(example).toMatch(/exactAction/);
  expect(example).toMatch(/canonicalPayloadDigest: canonicalPayloadDigest\(exactPayload\)/);
  expect(example).toMatch(/expiresAt:/);
  expect(example).toMatch(/used: false/);
  validateRedemptionOrder(example);

  const packageReadme = readFileSync(PACKAGE_README_URL, "utf8");
  expect(packageReadme).not.toContain(SECURITY_HEADING);
  expect(packageReadme).not.toContain("redeemServerChallenge");
  expect(packageReadme).not.toContain("authorizeUnderCurrentPolicy");
});

it("rejects reauthorization removal, bypass, replacement, and reordering", () => {
  const rootReadme = readFileSync(ROOT_README_URL, "utf8");
  const example = extractServerExample(extractSecuritySection(rootReadme));

  expect(() => validateRedemptionOrder(example.replace(REAUTHORIZE_LINE, "")))
    .toThrow(/current-policy reauthorization/);
  expect(() => validateRedemptionOrder(
    example.replace(REAUTHORIZE_LINE, `if (false) ${REAUTHORIZE_LINE}`),
  )).toThrow(/current-policy reauthorization/);
  expect(() => validateRedemptionOrder(
    example.replace(REAUTHORIZE_LINE, "await trustConsentAckAuthorization(request.consentAck);"),
  )).toThrow(/current-policy reauthorization/);
  expect(() => validateRedemptionOrder(
    example.replace(`${REAUTHORIZE_LINE}\n    ${EFFECT_LINE}`, `${EFFECT_LINE}\n    ${REAUTHORIZE_LINE}`),
  )).toThrow(/server lifecycle is out of order|immediately precede/);
});
