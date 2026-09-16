#!/usr/bin/env node
// scripts/pkg-dom-catalog-boundary.mjs
//
// The catalog-boundary gate for `@full-self-browsing/concierge-dom`.
//
// This package may only hand back elements the application registered. A
// host-DOM query or an actuation primitive in the built artifact would
// reopen the generic-browser door CONTRIBUTING forbids. The check reads
// `packages/concierge-dom/dist/index.js` — a source-only scan would miss a
// bundler rewrite that reintroduced a banned identifier.
//
// The two permitted page mutations are scroll position and the reserved
// reveal dataset key. Adding an identifier to this script's allow-set, or
// deleting a class from BANNED_CLASSES, requires a threat model in the
// same pull request. A false positive is not a reason to weaken the gate.
//
// Usage:
//   node scripts/pkg-dom-catalog-boundary.mjs [artifact]
//   node scripts/pkg-dom-catalog-boundary.mjs self-test
//
// Exits 0 when the artifact is clean (or every self-test mutation is red),
// 1 otherwise.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_ARTIFACT = join(ROOT, "packages/concierge-dom/dist/index.js");

/**
 * Banned identifier classes. Each class has one representative token used
 * by the mutation self-test, and one or more patterns applied to the
 * artifact. `matches` is banned as a *call* so MediaQueryList's boolean
 * `.matches` property (reduced-motion) is not a false positive; Element's
 * selector method is `matches(`.
 */
export const BANNED_CLASSES = Object.freeze([
  Object.freeze({
    id: "query",
    representative: "querySelector",
    patterns: Object.freeze([
      /\bquerySelector\b/u,
      /\bquerySelectorAll\b/u,
    ]),
  }),
  Object.freeze({
    id: "by-id",
    representative: "getElementById",
    patterns: Object.freeze([/\bgetElementById\b/u]),
  }),
  Object.freeze({
    id: "collections",
    representative: "getElementsByTagName",
    patterns: Object.freeze([/\bgetElementsBy[A-Za-z]+\b/u]),
  }),
  Object.freeze({
    id: "selector-walk",
    representative: "closest(",
    patterns: Object.freeze([/\bclosest\b/u, /\bmatches\s*\(/u]),
  }),
  Object.freeze({
    id: "hit-test",
    representative: "elementFromPoint",
    patterns: Object.freeze([
      /\belementFromPoint\b/u,
      /\belementsFromPoint\b/u,
    ]),
  }),
  Object.freeze({
    id: "construct",
    representative: "createElement",
    patterns: Object.freeze([/\bcreateElement\b/u]),
  }),
  Object.freeze({
    id: "events",
    representative: "dispatchEvent",
    patterns: Object.freeze([/\bdispatchEvent\b/u]),
  }),
  Object.freeze({
    id: "actuation",
    representative: ".click(",
    patterns: Object.freeze([
      /\.click\s*\(/u,
      /\.focus\s*\(/u,
      /\.blur\s*\(/u,
      /\.submit\s*\(/u,
    ]),
  }),
  Object.freeze({
    id: "html",
    representative: "innerHTML",
    patterns: Object.freeze([
      /\binnerHTML\b/u,
      /\bouterHTML\b/u,
      /\binsertAdjacent\w*/u,
    ]),
  }),
  Object.freeze({
    id: "attributes",
    representative: "setAttribute",
    patterns: Object.freeze([/\bsetAttribute\b/u, /\bremoveAttribute\b/u]),
  }),
  Object.freeze({
    id: "navigation",
    representative: "location",
    patterns: Object.freeze([/\blocation\b/u, /\bhistory\b/u]),
  }),
  Object.freeze({
    id: "eval",
    representative: "eval(",
    patterns: Object.freeze([/\beval\s*\(/u, /\bFunction\s*\(/u]),
  }),
  Object.freeze({
    id: "exec",
    representative: "execCommand",
    patterns: Object.freeze([/\bexecCommand\b/u]),
  }),
  Object.freeze({
    id: "xpath",
    representative: "evaluate(",
    patterns: Object.freeze([/\bevaluate\s*\(/u]),
  }),
]);

export function findBannedIdentifiers(source) {
  const findings = [];
  for (const banned of BANNED_CLASSES) {
    for (const pattern of banned.patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(source)) {
        findings.push({
          classId: banned.id,
          representative: banned.representative,
          pattern: String(pattern),
        });
        break;
      }
    }
  }
  return findings;
}

export function assertCatalogBoundary(source, label = "artifact") {
  const findings = findBannedIdentifiers(source);
  if (findings.length === 0) {
    return findings;
  }
  const detail = findings
    .map((finding) => `${finding.classId}:${finding.representative}`)
    .join(", ");
  throw new Error(
    `${label} contains banned host-DOM identifiers (${detail}). ` +
      `concierge-dom must not find or actuate elements. Adding an ` +
      `identifier to this gate's allow-set requires a threat model.`,
  );
}

function runCheck(artifactPath) {
  if (!existsSync(artifactPath)) {
    console.error(
      `catalog-boundary: missing ${relative(ROOT, artifactPath)} — build @full-self-browsing/concierge-dom first`,
    );
    process.exit(1);
  }
  const source = readFileSync(artifactPath, "utf8");
  try {
    assertCatalogBoundary(source, relative(ROOT, artifactPath));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  console.log(
    `catalog-boundary: ${relative(ROOT, artifactPath)} contains no banned host-DOM identifiers`,
  );
}

function runSelfTest(artifactPath) {
  if (!existsSync(artifactPath)) {
    console.error(
      `catalog-boundary self-test: missing ${relative(ROOT, artifactPath)} — build first`,
    );
    process.exit(1);
  }
  const clean = readFileSync(artifactPath, "utf8");
  const cleanFindings = findBannedIdentifiers(clean);
  if (cleanFindings.length > 0) {
    console.error(
      `catalog-boundary self-test: clean artifact already fails (${cleanFindings
        .map((finding) => finding.classId)
        .join(", ")})`,
    );
    process.exit(1);
  }

  let failed = false;
  for (const banned of BANNED_CLASSES) {
    const findings = findBannedIdentifiers(`${clean}\n${banned.representative}\n`);
    const hit = findings.some((finding) => finding.classId === banned.id);
    if (!hit) {
      failed = true;
      console.error(
        `catalog-boundary self-test: class ${banned.id} stayed green after injecting ${banned.representative}`,
      );
    }
  }
  if (failed) {
    process.exit(1);
  }
  console.log(
    `catalog-boundary self-test: ${BANNED_CLASSES.length} banned classes go red on injection`,
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly) {
  const command = process.argv[2];
  if (command === "self-test") {
    runSelfTest(DEFAULT_ARTIFACT);
  } else {
    runCheck(command ? resolve(command) : DEFAULT_ARTIFACT);
  }
}
