#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tryLock, unlock } from "fs-native-extensions";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT_PATH), "..");
const PHASE_DIRECTORY = join(
  ROOT,
  ".planning/phases/08-consent-kernel",
);
const REGISTER_PATH = join(PHASE_DIRECTORY, "08-MUTATION-REGISTER.json");
const EVIDENCE_PATH = join(PHASE_DIRECTORY, "08-MUTATION-EVIDENCE.json");
const VALIDATION_PATH = join(PHASE_DIRECTORY, "08-VALIDATION.md");
const SECURITY_PATH = join(PHASE_DIRECTORY, "08-SECURITY.md");
const REQUIREMENTS_PATH = join(ROOT, ".planning/REQUIREMENTS.md");
const CORE_PACKAGE_DIRECTORY = join(ROOT, "packages/concierge");
const BUILD_MARKER = "Build complete";
const PACKAGE_FAILURE_MARKER = "[RED:P01:stub-tarball-exclusion]";
const MAX_BUFFER = 64 * 1024 * 1024;
const SCHEMA_VERSION = 3;
const USAGE = "Usage: node scripts/phase-08-mutation-battery.mjs self-test|refresh|preflight <id>|run range <first> <last>|run all --jobs <1-4>|verify <generation|evidence|capability|outcome|package|all|inputs|ledgers>";

const RELEASE_COMMAND_KEYS = Object.freeze([
  "build",
  "typecheck",
  "test",
  "check:artifact",
  "check:deps",
  "check:pack",
  "check:node-floor",
]);
const RELEASE_KEYS = Object.freeze([
  "revisionDigest",
  "executedAt",
  "commandExits",
  "tests",
  "artifactSurface",
  "dependencyFootprint",
  "packageConsumer",
  "nodeFloor",
]);
const RELEASE_TEST_KEYS = Object.freeze([
  "exitCode",
  "numTestFiles",
  "numPassedTests",
  "numTotalTests",
  "numFailedTests",
  "numPendingTests",
  "numTodoTests",
]);
const RELEASE_ARTIFACT_KEYS = Object.freeze([
  "publicNames",
  "publicTypes",
  "publicValues",
]);
const RELEASE_DEPENDENCY_KEYS = Object.freeze([
  "runtimeBytes",
  "moduleGraphClean",
]);
const RELEASE_PACKAGE_KEYS = Object.freeze([
  "tarEntryCount",
  "tarEntryDigest",
  "forbiddenEntriesAbsent",
  "foreignTypecheck",
  "foreignRuntime",
]);
const RELEASE_NODE_FLOOR_KEYS = Object.freeze([
  "version",
  "artifactImported",
]);
const EVIDENCE_KEYS = Object.freeze([
  "schemaVersion",
  "phase",
  "registerDigest",
  "expectedIds",
  "inputHashes",
  "release",
  "updatedAt",
  "rows",
]);

const TEST_FILES = Object.freeze({
  catalog: "packages/concierge/test/catalog.test.ts",
  kernel: "packages/concierge/test/consent-kernel.test.ts",
  jcs: "packages/concierge/test/readback-canonicalization.test.ts",
  session: "packages/concierge/test/session-consent.test.ts",
  routing: "packages/concierge/test/session-routing.test.ts",
  stub: "packages/concierge/test/stub-transport.test.ts",
  readme: "packages/concierge/test/readme-security.test.ts",
});

const CANONICAL_THREATS = Object.freeze([
  "T-08-01",
  "T-08-02",
  "T-08-03",
  "T-08-04",
  "T-08-05",
  "T-08-06",
  "T-08-07",
  "T-08-08",
  "T-08-09",
  "T-08-10",
  "T-08-SC",
]);
const ALLOWED_THREATS_BY_GROUP = Object.freeze({
  generation: Object.freeze([
    "T-08-01",
    "T-08-02",
    "T-08-03",
    "T-08-04",
    "T-08-07",
    "T-08-10",
  ]),
  evidence: Object.freeze(["T-08-04", "T-08-05", "T-08-06", "T-08-10"]),
  capability: Object.freeze(["T-08-01", "T-08-04", "T-08-10"]),
  outcome: Object.freeze(["T-08-08", "T-08-10"]),
  package: Object.freeze(["T-08-09", "T-08-SC"]),
});

const INPUT_PATHS = Object.freeze([
  "package.json",
  "packages/concierge/package.json",
  "pnpm-lock.yaml",
]);

const REVISION_DIRECTORY_SCOPES = Object.freeze([
  "packages/concierge/src",
  "packages/concierge/test",
  "packages/concierge/test-d",
  "scripts",
]);
const REVISION_REQUIRED_PATHS = Object.freeze([
  "package.json",
  "packages/concierge/package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "vitest.config.ts",
  "packages/concierge/tsconfig.json",
  "packages/concierge/tsconfig.test-d.json",
  "packages/concierge/tsdown.config.ts",
  "README.md",
  "packages/concierge/README.md",
  "packages/concierge/LICENSE",
]);
const SCOPED_PATHS = Object.freeze([
  ...new Set([
    ...REVISION_DIRECTORY_SCOPES,
    ...REVISION_REQUIRED_PATHS,
    "scripts/phase-08-mutation-battery.mjs",
    "scripts/mutate-and-prove.sh",
  ]),
]);
const TASK_2_WIP_PATHS = Object.freeze([
  "packages/concierge/test/consent-kernel.test.ts",
  "packages/concierge/test/fixtures/probe.ts",
  "scripts/pack-install-check.sh",
  "scripts/phase-08-mutation-battery.mjs",
]);

const REQUIRED_TASK_IDS = Object.freeze([
  "08-01-01", "08-01-02", "08-02-01", "08-02-02", "08-03-01",
  "08-03-02", "08-04-01", "08-04-02", "08-05-01", "08-05-02",
  "08-06-01", "08-06-02", "08-07-01", "08-07-02", "08-08-01",
  "08-08-02",
]);
const REQUIRED_REQUIREMENT_IDS = Object.freeze([
  "CON-01", "CON-02", "CON-03", "CON-04", "CON-05", "CON-06",
  "CON-07", "CON-08", "CON-09", "CON-10", "CAT-04",
  "TRN-02",
  "TRN-03",
  "TRN-05",
  "SEC-04",
]);
const REQUIRED_DECISION_IDS = Object.freeze(
  Array.from({ length: 23 }, (_, index) =>
    `D-08-${String(index + 1).padStart(2, "0")}`,
  ),
);
const CANONICAL_THREAT_MEANINGS = Object.freeze({
  "T-08-01": "The agent self-approves in the review response or a forgeable turn",
  "T-08-02": "Review return or partial delivery arms authority",
  "T-08-03": "Reviewed payload or app state drifts before confirm",
  "T-08-04": "Capability declaration is mistaken for achieved proof",
  "T-08-05": "Receipt/hash is forged or canonicalization collides",
  "T-08-06": "A delivery hash is mistaken for a human act",
  "T-08-07": "Retry or reentrancy arms/consumes more than once",
  "T-08-08": "The model rewrites app failure prose",
  "T-08-09": "Client assertion is treated as server authorization",
  "T-08-10": "Hostile callbacks/objects leak secrets or escape",
});
const REQUIRED_RESEARCH_CONSTRAINTS = Object.freeze([
  "lazy-factory-ledger",
  "strict-jcs-utf8",
  "retained-canonical-bytes",
  "profile-capability-ceilings",
  "actual-transport-dominance",
  "immutable-outcome-barrier",
  "exact-phase7-fixture",
  "dependency-and-package-boundary",
]);
const REQUIRED_SOURCE_CLASSES = Object.freeze(["GOAL", "REQ", "RESEARCH", "CONTEXT"]);
const MUTATION_DISTRIBUTION_LEDGER =
  "15 generation / 15 evidence / 7 capability / 7 outcome / 4 package (`15/15/7/7/4`)";
const MUTATION_OUTCOME_LEDGER =
  "48/48 green; zero pending, zero escaped, zero failed";
const MUTATION_SHARDS_LEDGER =
  "Bounded to at most four concurrent disposable mutation workers";

function lines(...values) {
  return values.join("\n");
}

function failureMarkerForMutant(id) {
  return `[RED:${id}]`;
}

function failureMarkerForCase(testFile, caseId) {
  const source = readFileSync(join(ROOT, testFile), "utf8");
  const escapedCaseId = caseId.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const matches = [
    ...source.matchAll(
      new RegExp(`\\[RED:${escapedCaseId}:[^\\]]+\\]`, "gu"),
    ),
  ].map((match) => match[0]);
  const unique = [...new Set(matches)];
  if (unique.length !== 1) {
    throw new Error(
      `${testFile}: expected exactly one RED marker for ${caseId}, found ${JSON.stringify(unique)}`,
    );
  }
  return unique[0];
}

function testFileForCase(caseId) {
  if (caseId.startsWith("C")) return TEST_FILES.catalog;
  if (caseId.startsWith("K") || caseId.startsWith("N") || caseId.startsWith("E")) {
    return TEST_FILES.kernel;
  }
  if (caseId.startsWith("J")) return TEST_FILES.jcs;
  if (caseId.startsWith("S")) return TEST_FILES.session;
  if (caseId.startsWith("U")) return TEST_FILES.stub;
  if (caseId === "P03" || caseId === "P04") return TEST_FILES.readme;
  throw new Error(`cannot resolve test file for case ${caseId}`);
}

function runtimeMutant({
  id,
  group,
  name,
  target = "packages/concierge/src/session.ts",
  literalPattern,
  replacement,
  intendedCaseIds,
  intendedTestFile = undefined,
  detectorKind = "vitest",
  threats,
  decisions,
}) {
  const intendedTestFiles = Object.freeze([
    ...new Set(
      intendedCaseIds.map((caseId) => intendedTestFile ?? testFileForCase(caseId)),
    ),
  ]);
  return Object.freeze({
    id,
    group,
    name,
    target,
    literalPattern,
    replacement,
    detectorKind,
    threats: Object.freeze([...threats]),
    decisions: Object.freeze([...decisions]),
    intendedTestFiles,
    intendedCaseIds: Object.freeze([...intendedCaseIds]),
    expectedFailureFingerprint: Object.freeze(
      intendedCaseIds.map((caseId, index) =>
        Object.freeze({
          caseId,
          marker: detectorKind === "vitest"
            ? failureMarkerForCase(
                intendedTestFiles[Math.min(index, intendedTestFiles.length - 1)],
                caseId,
              )
            : PACKAGE_FAILURE_MARKER,
        }),
      ),
    ),
  });
}

const MUTANTS = Object.freeze([
  runtimeMutant({
    id: "M-08-G01",
    group: "generation",
    name: "synchronous delivery runs before pending authority is installed",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "    consentGenerations?.set(name, pendingDelivery);",
      "    try {",
      "      deliveryHook((report: DeliveryReport): void => {",
      "        void observeReviewDelivery(name, pendingDelivery, report);",
      "      });",
    ),
    replacement: lines(
      "    try {",
      "      deliveryHook((report: DeliveryReport): void => {",
      "        void observeReviewDelivery(name, pendingDelivery, report);",
      "      });",
      "      consentGenerations?.set(name, pendingDelivery);",
    ),
    intendedCaseIds: ["K03"],
    threats: ["T-08-02"],
    decisions: ["D-08-01"],
  }),
  runtimeMutant({
    id: "M-08-G02",
    group: "generation",
    name: "interrupted delivery is accepted as completed",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "      delivery.outcome !== \"completed\"",
    replacement: "      false",
    intendedCaseIds: ["K04"],
    threats: ["T-08-02"],
    decisions: ["D-08-02"],
  }),
  runtimeMutant({
    id: "M-08-G03",
    group: "generation",
    name: "delivery callback omits complete current-ledger ownership",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "      current?.generation !== pending.generation ||",
      "      current.status !== \"pendingDelivery\" ||",
      "      current.responseId !== pending.responseId",
    ),
    replacement: lines(
      "      current === undefined ||",
      "      current.status !== \"pendingDelivery\" ||",
      "      false",
    ),
    intendedCaseIds: ["E10"],
    threats: ["T-08-02", "T-08-07"],
    decisions: ["D-08-03"],
  }),
  runtimeMutant({
    id: "M-08-G04",
    group: "generation",
    name: "delivery report omits response ownership",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "      delivery.responseId !== pending.responseId ||",
    replacement: "      false ||",
    intendedCaseIds: ["K07"],
    threats: ["T-08-02", "T-08-07"],
    decisions: ["D-08-03"],
  }),
  runtimeMutant({
    id: "M-08-G05",
    group: "generation",
    name: "duplicate callback may reclaim verifying delivery",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "      current.status !== \"pendingDelivery\" ||",
    replacement: "      false ||",
    intendedCaseIds: ["E09"],
    threats: ["T-08-07"],
    decisions: ["D-08-04"],
  }),
  runtimeMutant({
    id: "M-08-G06",
    group: "generation",
    name: "same human turn satisfies a fresh user-turn boundary",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "      review.userTurnId !== confirmTurnId;",
    replacement: "      review.userTurnId === confirmTurnId;",
    intendedCaseIds: ["K14"],
    threats: ["T-08-01"],
    decisions: ["D-08-05"],
  }),
  runtimeMutant({
    id: "M-08-G07",
    group: "generation",
    name: "fresh validated review does not invalidate older authority",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "      consentGenerations?.delete(name);",
    replacement: "      void name;",
    intendedCaseIds: ["K26"],
    threats: ["T-08-03", "T-08-07"],
    decisions: ["D-08-06"],
  }),
  runtimeMutant({
    id: "M-08-G08",
    group: "generation",
    name: "entry compares the reviewed snapshot to itself instead of live state",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "        const currentSnapshot: Readonly<Record<string, unknown>> =",
      "          captureResolvedSnapshot(index, bridge);",
    ),
    replacement: lines(
      "        const currentSnapshot: Readonly<Record<string, unknown>> =",
      "          owned.snapshot;",
    ),
    intendedCaseIds: ["K17"],
    threats: ["T-08-03"],
    decisions: ["D-08-06"],
  }),
  runtimeMutant({
    id: "M-08-G09",
    group: "generation",
    name: "throwing snapshot comparator is treated as a match",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "      } catch {",
      "        snapshotsMatch = false;",
      "      }",
    ),
    replacement: lines(
      "      } catch {",
      "        snapshotsMatch = true;",
      "      }",
    ),
    intendedCaseIds: ["K18"],
    threats: ["T-08-03", "T-08-10"],
    decisions: ["D-08-07"],
  }),
  runtimeMutant({
    id: "M-08-G10",
    group: "generation",
    name: "snapshot mismatch no longer destroys authority",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "      if (!snapshotsMatch) {",
    replacement: "      if (false && !snapshotsMatch) {",
    intendedCaseIds: ["K20"],
    threats: ["T-08-03"],
    decisions: ["D-08-07"],
  }),
  runtimeMutant({
    id: "M-08-G11",
    group: "generation",
    name: "ack payload is recomputed from confirm arguments",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "      consentAck = Object.freeze(",
      "        owned.achievedGrade === \"attested\"",
      "          ? {",
      "              grade: owned.achievedGrade,",
      "              payload: owned.payload,",
      "              readbackHash: owned.readbackHash as string,",
      "              responseId: owned.responseId,",
      "              snapshot: owned.snapshot,",
      "              userTurnId: owned.userTurnId,",
      "            }",
      "          : {",
      "              grade: owned.achievedGrade,",
      "              payload: owned.payload,",
      "              responseId: owned.responseId,",
      "              snapshot: owned.snapshot,",
      "              userTurnId: owned.userTurnId,",
      "            },",
      "      );",
    ),
    replacement: lines(
      "      consentAck = Object.freeze(",
      "        owned.achievedGrade === \"attested\"",
      "          ? {",
      "              grade: owned.achievedGrade,",
      "              payload: validatedSnapshot.value,",
      "              readbackHash: owned.readbackHash as string,",
      "              responseId: owned.responseId,",
      "              snapshot: owned.snapshot,",
      "              userTurnId: owned.userTurnId,",
      "            }",
      "          : {",
      "              grade: owned.achievedGrade,",
      "              payload: validatedSnapshot.value,",
      "              responseId: owned.responseId,",
      "              snapshot: owned.snapshot,",
      "              userTurnId: owned.userTurnId,",
      "            },",
      "      );",
    ),
    intendedCaseIds: ["K21"],
    threats: ["T-08-03"],
    decisions: ["D-08-08"],
  }),
  runtimeMutant({
    id: "M-08-G12",
    group: "generation",
    name: "authority is not consumed before handler reentry",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "      // Authority is one-shot across every action sharing this review name.",
      "      closeConsentGeneration(reviewName, owned.generation);",
    ),
    replacement: lines(
      "      // Mutant: defer the one-shot consumption past the handler.",
      "      void owned;",
    ),
    intendedCaseIds: ["K22"],
    threats: ["T-08-07"],
    decisions: ["D-08-08"],
  }),
  runtimeMutant({
    id: "M-08-G13",
    group: "generation",
    name: "declined delivery falls through and re-arms",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "    if (observedAct === \"declined\" || observedAct === \"dismissed\") {",
    replacement: "    if (observedAct === \"dismissed\") {",
    intendedCaseIds: ["K24"],
    threats: ["T-08-07"],
    decisions: ["D-08-08"],
  }),
  runtimeMutant({
    id: "M-08-G14",
    group: "generation",
    name: "dismissed delivery falls through and re-arms",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "    if (observedAct === \"declined\" || observedAct === \"dismissed\") {",
    replacement: "    if (observedAct === \"declined\") {",
    intendedCaseIds: ["K24"],
    threats: ["T-08-07"],
    decisions: ["D-08-08"],
  }),
  runtimeMutant({
    id: "M-08-G15",
    group: "generation",
    name: "module-private measured-grade predicate accepts none",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "  return achievedGrade !== \"none\";",
    replacement: "  return true;",
    intendedCaseIds: ["N01", "N02"],
    threats: ["T-08-04"],
    decisions: ["D-08-09"],
  }),

  runtimeMutant({
    id: "M-08-E01",
    group: "evidence",
    name: "receipt algorithm claim is trusted",
    target: "packages/concierge/src/consent-evidence.ts",
    literalPattern: "    receipt.alg !== \"SHA-256\" ||",
    replacement: "    false ||",
    intendedCaseIds: ["J11"],
    threats: ["T-08-05"],
    decisions: ["D-08-12"],
  }),
  runtimeMutant({
    id: "M-08-E02",
    group: "evidence",
    name: "receipt canonical bytes are not compared",
    target: "packages/concierge/src/consent-evidence.ts",
    literalPattern: "    !bytesEqual(prepared.canonical, receipt.canonical)",
    replacement: "    false",
    intendedCaseIds: ["J11"],
    threats: ["T-08-05"],
    decisions: ["D-08-12"],
  }),
  runtimeMutant({
    id: "M-08-E03",
    group: "evidence",
    name: "delivery report readbackHash is not bound to retained evidence",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "      delivery.readbackHash === verified.hash &&",
    replacement: "      typeof delivery.readbackHash === \"string\" &&",
    intendedCaseIds: ["E02"],
    threats: ["T-08-05", "T-08-06"],
    decisions: ["D-08-13"],
  }),
  runtimeMutant({
    id: "M-08-E04",
    group: "evidence",
    name: "attestation readbackHash is not bound to retained evidence",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "      attestation.readbackHash === verified.hash &&",
    replacement: "      typeof attestation.readbackHash === \"string\" &&",
    intendedCaseIds: ["E02"],
    threats: ["T-08-05", "T-08-06"],
    decisions: ["D-08-13"],
  }),
  runtimeMutant({
    id: "M-08-E05",
    group: "evidence",
    name: "unknown attestation act is accepted as confirmed",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "      observedAct === \"confirmed\" &&",
    replacement: "      typeof observedAct === \"string\" &&",
    intendedCaseIds: ["E02"],
    threats: ["T-08-06"],
    decisions: ["D-08-14"],
  }),
  runtimeMutant({
    id: "M-08-E06",
    group: "evidence",
    name: "review turn is accepted as the confirming turn",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "      attestation.userTurnId !== claimed.userTurnId",
    replacement: "      claimed.userTurnId.length >= 0",
    intendedCaseIds: ["E02"],
    threats: ["T-08-06"],
    decisions: ["D-08-14"],
  }),
  runtimeMutant({
    id: "M-08-E07",
    group: "evidence",
    name: "lone high surrogate is accepted",
    target: "packages/concierge/src/consent-evidence.ts",
    literalPattern: lines(
      "      if (!(low >= 0xdc00 && low <= 0xdfff)) {",
      "        return null;",
      "      }",
    ),
    replacement: lines(
      "      if (!(low >= 0xdc00 && low <= 0xdfff)) {",
      "        output += \"\\\\ud800\";",
      "        continue;",
      "      }",
    ),
    intendedCaseIds: ["J09"],
    threats: ["T-08-05"],
    decisions: ["D-08-15"],
  }),
  runtimeMutant({
    id: "M-08-E08",
    group: "evidence",
    name: "non-finite JSON number is accepted",
    target: "packages/concierge/src/consent-evidence.ts",
    literalPattern: lines(
      "      if (!Number.isFinite(value)) {",
      "        return null;",
      "      }",
    ),
    replacement: lines(
      "      if (false && !Number.isFinite(value)) {",
      "        return null;",
      "      }",
    ),
    intendedCaseIds: ["J06"],
    threats: ["T-08-05"],
    decisions: ["D-08-15"],
  }),
  runtimeMutant({
    id: "M-08-E09",
    group: "evidence",
    name: "alias and cycle guard is disabled",
    target: "packages/concierge/src/consent-evidence.ts",
    literalPattern: "  if (seen.has(value)) {",
    replacement: "  if (false && seen.has(value)) {",
    intendedCaseIds: ["J07"],
    threats: ["T-08-05"],
    decisions: ["D-08-15"],
  }),
  runtimeMutant({
    id: "M-08-E10",
    group: "evidence",
    name: "object accessors are invoked while canonicalizing",
    target: "packages/concierge/src/consent-evidence.ts",
    literalPattern: lines(
      "    if (",
      "      typeof key !== \"string\" ||",
      "      key === \"toJSON\" ||",
      "      descriptor === undefined ||",
      "      !(\"value\" in descriptor) ||",
      "      descriptor.enumerable !== true ||",
      "      quoteString(key) === null",
      "    ) {",
      "      return null;",
      "    }",
      "    const child: StrictValue | null = snapshotStrictValue(",
      "      descriptor.value,",
      "      seen,",
      "    );",
      "    if (child === null) {",
      "      return null;",
      "    }",
      "    entries.push({ canonical: child.canonical, key, value: child.value });",
    ),
    replacement: lines(
      "    if (",
      "      typeof key !== \"string\" ||",
      "      key === \"toJSON\" ||",
      "      descriptor === undefined ||",
      "      descriptor.enumerable !== true ||",
      "      quoteString(key) === null",
      "    ) {",
      "      return null;",
      "    }",
      "    const child: StrictValue | null = snapshotStrictValue(",
      "      (value as Record<string, unknown>)[key as string],",
      "      seen,",
      "    );",
      "    if (child === null) {",
      "      return null;",
      "    }",
      "    entries.push({ canonical: child.canonical, key, value: child.value });",
    ),
    intendedCaseIds: ["J08"],
    threats: ["T-08-10"],
    decisions: ["D-08-15"],
  }),
  runtimeMutant({
    id: "M-08-E11",
    group: "evidence",
    name: "exotic object prototypes are accepted",
    target: "packages/concierge/src/consent-evidence.ts",
    literalPattern: lines(
      "  if (shape.prototype !== Object.prototype && shape.prototype !== null) {",
      "    return null;",
      "  }",
      "  const entries: Array<{",
    ),
    replacement: lines(
      "  if (false && shape.prototype !== Object.prototype && shape.prototype !== null) {",
      "    return null;",
      "  }",
      "  const entries: Array<{",
    ),
    intendedCaseIds: ["J08"],
    threats: ["T-08-10"],
    decisions: ["D-08-15"],
  }),
  runtimeMutant({
    id: "M-08-E12",
    group: "evidence",
    name: "four-byte UTF-8 scalar uses a broken lead byte",
    target: "packages/concierge/src/consent-evidence.ts",
    literalPattern: "        0xf0 | (scalar >> 18),",
    replacement: "        0xe0 | (scalar >> 18),",
    intendedCaseIds: ["J04"],
    threats: ["T-08-05"],
    decisions: ["D-08-16"],
  }),
  runtimeMutant({
    id: "M-08-E13",
    group: "evidence",
    name: "JCS object keys sort in reverse UTF-16 order",
    target: "packages/concierge/src/consent-evidence.ts",
    literalPattern: "  entries.sort((left, right) => compareUtf16(left.key, right.key));",
    replacement: "  entries.sort((left, right) => compareUtf16(right.key, left.key));",
    intendedCaseIds: ["J02"],
    threats: ["T-08-05"],
    decisions: ["D-08-17"],
  }),
  runtimeMutant({
    id: "M-08-E14",
    group: "evidence",
    name: "negative zero keeps a non-JCS number spelling",
    target: "packages/concierge/src/consent-evidence.ts",
    literalPattern: lines(
      "        canonical: Object.is(value, -0)",
      "          ? \"0\"",
      "          : NUMBER_TO_STRING.call(value),",
    ),
    replacement: lines(
      "        canonical: Object.is(value, -0)",
      "          ? \"-0\"",
      "          : NUMBER_TO_STRING.call(value),",
    ),
    intendedCaseIds: ["J03"],
    threats: ["T-08-05"],
    decisions: ["D-08-17"],
  }),
  runtimeMutant({
    id: "M-08-E15",
    group: "evidence",
    name: "contradictory attested claim falls through to relayed authority",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "    if (hasAttestedClaim && !completeAttestedClaim) {",
    replacement: "    if (false) {",
    intendedCaseIds: ["E14"],
    threats: ["T-08-04", "T-08-05", "T-08-06"],
    decisions: ["D-08-12"],
  }),

  runtimeMutant({
    id: "M-08-C01",
    group: "capability",
    name: "catalog grade-unavailable issue is omitted",
    target: "packages/concierge/src/catalog.ts",
    literalPattern: "        gradeRank(effectiveMinGrade) > gradeRank(consentEvidence.consentGrade)",
    replacement: "        false",
    intendedCaseIds: ["C27"],
    threats: ["T-08-04"],
    decisions: ["D-08-09"],
  }),
  runtimeMutant({
    id: "M-08-C02",
    group: "capability",
    name: "catalog user-turn provenance issue is omitted",
    target: "packages/concierge/src/catalog.ts",
    literalPattern: "        consentEvidence.userTurnIdentity !== \"human-attested\"",
    replacement: "        false",
    intendedCaseIds: ["C29"],
    threats: ["T-08-01"],
    decisions: ["D-08-10"],
  }),
  runtimeMutant({
    id: "M-08-C03",
    group: "capability",
    name: "captured profile provenance is forged as human-attested",
    target: "packages/concierge/src/catalog.ts",
    literalPattern: lines(
      "      userTurnIdentity: isTurnIdentityProvenance(declaredProvenance)",
      "        ? declaredProvenance",
      "        : \"none\",",
    ),
    replacement: "      userTurnIdentity: \"human-attested\",",
    intendedCaseIds: ["C29"],
    threats: ["T-08-01"],
    decisions: ["D-08-10"],
  }),
  runtimeMutant({
    id: "M-08-C04",
    group: "capability",
    name: "any declared grade is copied upward to attested",
    target: "packages/concierge/src/catalog.ts",
    literalPattern: "      consentGrade: isConsentGrade(declaredGrade) ? declaredGrade : \"none\",",
    replacement: "      consentGrade: isConsentGrade(declaredGrade) ? \"attested\" : \"none\",",
    intendedCaseIds: ["C29"],
    threats: ["T-08-04"],
    decisions: ["D-08-09"],
  }),
  runtimeMutant({
    id: "M-08-C05",
    group: "capability",
    name: "weaker actual transport capability is accepted",
    target: "packages/concierge/src/session.ts",
    literalPattern: "    if (!profileDominates(actualCapabilities, consentProfileOf(concierge))) {",
    replacement: "    if (false && !profileDominates(actualCapabilities, consentProfileOf(concierge))) {",
    intendedCaseIds: ["S02"],
    threats: ["T-08-04"],
    decisions: ["D-08-11"],
  }),
  runtimeMutant({
    id: "M-08-C06",
    group: "capability",
    name: "transport capability validation happens after an observable effect",
    target: "packages/concierge/src/session.ts",
    literalPattern: "    actualCapabilities = captureTransportCapabilities(transport);",
    replacement: lines(
      "    transport.setTools(EMPTY_CATALOG);",
      "    actualCapabilities = captureTransportCapabilities(transport);",
    ),
    intendedCaseIds: ["S02"],
    threats: ["T-08-04", "T-08-10"],
    decisions: ["D-08-11"],
  }),
  runtimeMutant({
    id: "M-08-C07",
    group: "capability",
    name: "inherent delivered floor regresses to permissive requested none",
    target: "packages/concierge/src/catalog.ts",
    literalPattern: lines(
      "    const effectiveMinGrade: ConsentGrade = gradeRank(requested) <",
      "        gradeRank(\"delivered\")",
      "      ? \"delivered\"",
      "      : requested;",
    ),
    replacement: "    const effectiveMinGrade: ConsentGrade = requested;",
    intendedCaseIds: ["C27"],
    threats: ["T-08-04"],
    decisions: ["D-08-09"],
  }),

  runtimeMutant({
    id: "M-08-O01",
    group: "outcome",
    name: "results respond before app outcome completion",
    target: "packages/concierge/src/session.ts",
    literalPattern: "          const report: unknown = await presentOutcome(failureOutcome);",
    replacement: lines(
      "          for (const earlyRow of rows) {",
      "            Reflect.apply(transport.respond, transport, [earlyRow.callId, earlyRow.result]);",
      "          }",
      "          const report: unknown = await presentOutcome(failureOutcome);",
    ),
    intendedCaseIds: ["S06"],
    threats: ["T-08-08"],
    decisions: ["D-08-18"],
  }),
  runtimeMutant({
    id: "M-08-O02",
    group: "outcome",
    name: "outcome discloses complete dispatch row and model arguments",
    target: "packages/concierge/src/session.ts",
    literalPattern: "      message: result.message,",
    replacement: "      message: JSON.stringify(row),",
    intendedCaseIds: ["S06"],
    threats: ["T-08-08"],
    decisions: ["D-08-19"],
  }),
  runtimeMutant({
    id: "M-08-O03",
    group: "outcome",
    name: "failed outcome sink is retried",
    target: "packages/concierge/src/session.ts",
    literalPattern: lines(
      "        } catch {",
      "          completed = false;",
      "        }",
    ),
    replacement: lines(
      "        } catch {",
      "          await presentOutcome(failureOutcome);",
      "          completed = false;",
      "        }",
    ),
    intendedCaseIds: ["S07"],
    threats: ["T-08-08", "T-08-10"],
    decisions: ["D-08-20"],
  }),
  runtimeMutant({
    id: "M-08-O04",
    group: "outcome",
    name: "failed transport response is retried",
    target: "packages/concierge/src/session.ts",
    literalPattern: lines(
      "        } catch {",
      "          diagnose(\"response_failed\");",
      "        }",
    ),
    replacement: lines(
      "        } catch {",
      "          diagnose(\"response_failed\");",
      "          transport.respond(row.callId, row.result);",
      "        }",
    ),
    intendedCaseIds: ["J04"],
    intendedTestFile: TEST_FILES.routing,
    threats: ["T-08-08"],
    decisions: ["D-08-20"],
  }),
  runtimeMutant({
    id: "M-08-O05",
    group: "outcome",
    name: "interrupted outcome still releases results",
    target: "packages/concierge/src/session.ts",
    literalPattern: lines(
      "        if (!completed) {",
      "          diagnose(\"outcome_presentation_failed\");",
      "          return;",
      "        }",
    ),
    replacement: lines(
      "        if (!completed) {",
      "          diagnose(\"outcome_presentation_failed\");",
      "        }",
    ),
    intendedCaseIds: ["S07"],
    threats: ["T-08-08"],
    decisions: ["D-08-18"],
  }),
  runtimeMutant({
    id: "M-08-O06",
    group: "outcome",
    name: "caught outcome error is echoed into a response",
    target: "packages/concierge/src/session.ts",
    literalPattern: lines(
      "        } catch {",
      "          completed = false;",
      "        }",
    ),
    replacement: lines(
      "        } catch (error) {",
      "          const firstRow = rows[0];",
      "          if (firstRow !== undefined) {",
      "            Reflect.apply(transport.respond, transport, [firstRow.callId, Object.freeze({ ok: false, message: String(error) })]);",
      "          }",
      "          completed = false;",
      "        }",
    ),
    intendedCaseIds: ["S07"],
    threats: ["T-08-10"],
    decisions: ["D-08-19"],
  }),
  runtimeMutant({
    id: "M-08-O07",
    group: "outcome",
    name: "all-success occurrence calls the outcome sink",
    target: "packages/concierge/src/session.ts",
    literalPattern: "      const failureOutcome: FailureOutcome | null = failureOutcomeFor(rows);",
    replacement: "      const failureOutcome: FailureOutcome = failureOutcomeFor(rows) ?? Object.freeze({ failures: Object.freeze([]) });",
    intendedCaseIds: ["S05"],
    threats: ["T-08-08"],
    decisions: ["D-08-18"],
  }),

  runtimeMutant({
    id: "M-08-P01",
    group: "package",
    name: "test fixture factory is exported from production source",
    target: "packages/concierge/src/index.ts",
    literalPattern: "export { createBridge, captureSnapshot, offPageResult } from \"./bridge.js\";",
    replacement: lines(
      "export { createBridge, captureSnapshot, offPageResult } from \"./bridge.js\";",
      "export const createStubTransport: undefined = undefined;",
    ),
    intendedCaseIds: ["U08"],
    threats: ["T-08-SC"],
    decisions: ["D-08-21"],
  }),
  runtimeMutant({
    id: "M-08-P02",
    group: "package",
    name: "test fixtures are included in the published package",
    target: "packages/concierge/package.json",
    literalPattern: lines(
      "    \"src\",",
      "    \"README.md\",",
    ),
    replacement: lines(
      "    \"src\",",
      "    \"test/fixtures\",",
      "    \"README.md\",",
    ),
    intendedCaseIds: ["P02"],
    intendedTestFile: TEST_FILES.stub,
    detectorKind: "package",
    threats: ["T-08-SC"],
    decisions: ["D-08-22"],
  }),
  runtimeMutant({
    id: "M-08-P03",
    group: "package",
    name: "root README claims client consent authorizes a server action",
    target: "README.md",
    literalPattern: "The consent kernel does not authenticate a principal and does not authorize a server action.",
    replacement: "The consent kernel authenticates a principal and authorizes a server action.",
    intendedCaseIds: ["P03"],
    threats: ["T-08-09"],
    decisions: ["D-08-23"],
  }),
  runtimeMutant({
    id: "M-08-P04",
    group: "package",
    name: "root README omits immediate current-policy exact-action reauthorization",
    target: "README.md",
    literalPattern: "    await authorizeUnderCurrentPolicy(authenticatedPrincipal, exactAction);",
    replacement: "    // current-policy exact-action authorization omitted",
    intendedCaseIds: ["P04"],
    threats: ["T-08-09"],
    decisions: ["D-08-23"],
  }),
]);

export const EXPECTED_GENERATION_IDS = Object.freeze(
  Array.from({ length: 15 }, (_, index) =>
    `M-08-G${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_EVIDENCE_IDS = Object.freeze(
  Array.from({ length: 15 }, (_, index) =>
    `M-08-E${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_CAPABILITY_IDS = Object.freeze(
  Array.from({ length: 7 }, (_, index) =>
    `M-08-C${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_OUTCOME_IDS = Object.freeze(
  Array.from({ length: 7 }, (_, index) =>
    `M-08-O${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_PACKAGE_IDS = Object.freeze(
  Array.from({ length: 4 }, (_, index) =>
    `M-08-P${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_M08_IDS = Object.freeze([
  ...EXPECTED_GENERATION_IDS,
  ...EXPECTED_EVIDENCE_IDS,
  ...EXPECTED_CAPABILITY_IDS,
  ...EXPECTED_OUTCOME_IDS,
  ...EXPECTED_PACKAGE_IDS,
]);

const EXPECTED_IDS_BY_GROUP = Object.freeze({
  generation: EXPECTED_GENERATION_IDS,
  evidence: EXPECTED_EVIDENCE_IDS,
  capability: EXPECTED_CAPABILITY_IDS,
  outcome: EXPECTED_OUTCOME_IDS,
  package: EXPECTED_PACKAGE_IDS,
});
const MUTANT_BY_ID = new Map(MUTANTS.map((mutant) => [mutant.id, mutant]));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function mutantDigestMetadata(mutant, root = ROOT) {
  const source = readFileSync(join(root, mutant.target), "utf8");
  const mutated = replaceExactOnce(
    source,
    mutant.literalPattern,
    mutant.replacement,
    mutant.id,
  );
  return {
    definitionDigest: sha256(
      `${mutant.target}\0${mutant.literalPattern}\0${mutant.replacement}`,
    ),
    originalTargetHash: sha256(source),
    mutantTargetHash: sha256(mutated),
  };
}

function registerRows(mutants = MUTANTS, root = ROOT) {
  return mutants.map((mutant) => ({
    ...mutant,
    ...mutantDigestMetadata(mutant, root),
  }));
}

function registerDigest(mutants = MUTANTS, root = ROOT) {
  const rows = mutants.every((mutant) => mutant.originalTargetHash !== undefined)
    ? mutants
    : registerRows(mutants, root);
  return sha256(JSON.stringify(rows));
}

let atomicWriteSequence = 0;

function atomicWriteJson(path, value) {
  atomicWriteSequence += 1;
  const temporaryPath = `${path}.tmp-${process.pid}-${atomicWriteSequence}`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

async function withExclusivePathLock(lockPath, operation, run) {
  let descriptor;
  let locked = false;
  try {
    descriptor = openSync(lockPath, "a+");
    locked = tryLock(descriptor);
    if (!locked) {
      throw new Error(`${operation}: mutation battery is already running`);
    }
    return await run();
  } finally {
    if (descriptor !== undefined) {
      try {
        if (locked) unlock(descriptor);
      } finally {
        closeSync(descriptor);
      }
    }
  }
}

function mutationLockPath() {
  const result = spawnSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `cannot resolve git common directory: ${result.stderr ?? ""}`,
    );
  }
  return resolve(
    ROOT,
    (result.stdout ?? "").trim(),
    "phase-08-mutation-battery.lock",
  );
}

async function withMutationBatteryLock(operation, run) {
  return withExclusivePathLock(mutationLockPath(), operation, run);
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    ...options,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  return {
    command: [commandName, ...args].join(" "),
    exitCode: result.status ?? (result.signal === null ? 255 : 128),
    signal: result.signal,
    stdout,
    stderr,
    output: `${stdout}${stderr}`,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateExactObjectKeys(value, expectedKeys, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const observed = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new Error(`${label} keys must equal ${expected.join(", ")}`);
  }
}

function assertThrows(operation, pattern, label) {
  let observed = null;
  try {
    operation();
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
  }
  if (observed === null || !pattern.test(observed)) {
    throw new Error(
      `self-test ${label} did not reject as expected; observed ${JSON.stringify(observed)}`,
    );
  }
}

function selectorOccurrences(mutant, readSource = (path) => readFileSync(join(ROOT, path), "utf8")) {
  let total = 0;
  for (const [index, caseId] of mutant.intendedCaseIds.entries()) {
    const path = mutant.intendedTestFiles[Math.min(index, mutant.intendedTestFiles.length - 1)];
    const source = readSource(path);
    if (caseId === "P03") {
      total += source.split('it("states that client consent evidence is untrusted and grants no server authority"').length - 1;
    } else if (caseId === "P04") {
      total += source.split('it("rejects reauthorization removal, bypass, replacement, and reordering"').length - 1;
    } else {
      const escaped = caseId.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      total += [...source.matchAll(new RegExp(`(?:\\[${escaped}\\]|\\b${escaped}\\s+—)`, "gu"))].length;
    }
  }
  return total;
}

function validateRequiredMappings(mutants) {
  const expectedCounts = Object.freeze({
    generation: 15,
    evidence: 15,
    capability: 7,
    outcome: 7,
    package: 4,
  });
  for (const [group, expected] of Object.entries(expectedCounts)) {
    const observed = mutants.filter((mutant) => mutant.group === group).length;
    if (observed !== expected) {
      throw new Error(`${group}: mutant count must equal ${expected}`);
    }
  }

  const coveredThreats = new Set();
  const coveredDecisions = new Set();
  const identities = new Set();
  for (const mutant of mutants) {
    if (!Array.isArray(mutant.threats) || mutant.threats.length === 0) {
      throw new Error(`${mutant.id}: missing threat mapping`);
    }
    const allowed = ALLOWED_THREATS_BY_GROUP[mutant.group];
    if (allowed === undefined) {
      throw new Error(`${mutant.id}: unknown group ${mutant.group}`);
    }
    for (const threat of mutant.threats) {
      if (!CANONICAL_THREATS.includes(threat)) {
        throw new Error(`${mutant.id}: unknown threat mapping ${threat}`);
      }
      if (!allowed.includes(threat)) {
        throw new Error(`${mutant.id}: conflicting canonical mapping ${mutant.group} -> ${threat}`);
      }
      coveredThreats.add(threat);
    }
    if (!Array.isArray(mutant.decisions) || mutant.decisions.length === 0) {
      throw new Error(`${mutant.id}: missing decision mapping`);
    }
    for (const decision of mutant.decisions) {
      if (!/^D-08-(?:0[1-9]|1[0-9]|2[0-3])$/u.test(decision)) {
        throw new Error(`${mutant.id}: unknown decision mapping ${decision}`);
      }
      coveredDecisions.add(decision);
    }
    const identity = `${mutant.target}\0${mutant.literalPattern}\0${mutant.replacement}`;
    if (identities.has(identity)) {
      throw new Error(`${mutant.id}: duplicate mutant revision definition`);
    }
    identities.add(identity);
    if (
      mutant.detectorKind === "vitest" &&
      selectorOccurrences(mutant) < mutant.intendedCaseIds.length
    ) {
      throw new Error(`${mutant.id}: named detector selector is zero or incomplete`);
    }
  }
  for (const threat of CANONICAL_THREATS) {
    if (!coveredThreats.has(threat)) {
      throw new Error(`canonical threat ${threat} is not covered`);
    }
  }
  for (let index = 1; index <= 23; index += 1) {
    const decision = `D-08-${String(index).padStart(2, "0")}`;
    if (!coveredDecisions.has(decision)) {
      throw new Error(`locked decision ${decision} is not covered`);
    }
  }

  const byId = new Map(mutants.map((mutant) => [mutant.id, mutant]));
  const c07 = byId.get("M-08-C07");
  const e10 = byId.get("M-08-E10");
  const g15 = byId.get("M-08-G15");
  const p03 = byId.get("M-08-P03");
  const p04 = byId.get("M-08-P04");
  if (!c07?.literalPattern.includes("effectiveMinGrade") || c07.target !== "packages/concierge/src/catalog.ts") {
    throw new Error("M-08-C07 must target the live catalog effective delivered floor");
  }
  if (g15?.literalPattern !== '  return achievedGrade !== "none";' || JSON.stringify(g15.intendedCaseIds) !== JSON.stringify(["N01", "N02"])) {
    throw new Error("M-08-G15 must target the single measured-grade none predicate with N01/N02");
  }
  if (
    !e10?.literalPattern.includes('!("value" in descriptor)') ||
    !e10.literalPattern.includes("descriptor.value") ||
    e10.replacement.includes('!("value" in descriptor)') ||
    !e10.replacement.includes("(value as Record<string, unknown>)[key as string]") ||
    JSON.stringify(e10.intendedCaseIds) !== JSON.stringify(["J08"])
  ) {
    throw new Error("M-08-E10 must remove only the data-descriptor rejection before invoking the J08 accessor");
  }
  if (p03?.target !== "README.md" || p04?.target !== "README.md") {
    throw new Error("M-08-P03/P04 must target the root README");
  }
  if (!p04.literalPattern.includes("authorizeUnderCurrentPolicy(authenticatedPrincipal, exactAction)")) {
    throw new Error("M-08-P04 must target immediate current-policy exact-action authorization");
  }
}

function validateMutantList(
  mutants,
  {
    expectedIds = EXPECTED_M08_IDS,
    readTarget = (target) => readFileSync(join(ROOT, target), "utf8"),
    targetExists = (target) => existsSync(join(ROOT, target)),
    targetTracked = (target) =>
      command("git", ["ls-files", "--error-unmatch", target]).exitCode === 0,
  } = {},
) {
  const ids = mutants.map((mutant) => mutant.id);
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
    throw new Error("mutant ids are missing, duplicated, reordered, or extra");
  }
  if (new Set(ids).size !== expectedIds.length) {
    throw new Error("mutant ids contain a duplicate");
  }

  for (const mutant of mutants) {
    if (!targetExists(mutant.target)) {
      throw new Error(`${mutant.id}: target does not exist: ${mutant.target}`);
    }
    if (!targetTracked(mutant.target)) {
      throw new Error(`${mutant.id}: target is not tracked: ${mutant.target}`);
    }
    if (/\/test(?:-d)?\//u.test(mutant.target)) {
      throw new Error(`${mutant.id}: test sources must never be mutation targets`);
    }
    const source = readTarget(mutant.target);
    const occurrences = source.split(mutant.literalPattern).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `${mutant.id}: literal occurrence count is ${occurrences}, expected 1`,
      );
    }
    if (mutant.literalPattern === mutant.replacement) {
      throw new Error(`${mutant.id}: replacement is a no-op`);
    }
    if (mutant.intendedCaseIds.length === 0) {
      throw new Error(`${mutant.id}: intendedCaseIds must be non-empty`);
    }
  }
  validateRequiredMappings(mutants);
}

function validateDefinitions() {
  validateMutantList(MUTANTS);
}

function makeRegister() {
  const mutants = registerRows();
  return {
    schemaVersion: SCHEMA_VERSION,
    phase: "08-consent-kernel",
    sourceShapeReconciliation:
      "C07 targets the live rank-comparison/effectiveMinGrade ternary, which is semantically identical to the planned max(delivered, requested) floor. E15 is the post-review D-08-12 control that resurrects contradictory-attestation downgrade into relayed authority.",
    expectedGenerationIds: EXPECTED_GENERATION_IDS,
    expectedEvidenceIds: EXPECTED_EVIDENCE_IDS,
    expectedCapabilityIds: EXPECTED_CAPABILITY_IDS,
    expectedOutcomeIds: EXPECTED_OUTCOME_IDS,
    expectedPackageIds: EXPECTED_PACKAGE_IDS,
    expectedIds: EXPECTED_M08_IDS,
    inputHashes: inputHashes(),
    registerDigest: registerDigest(mutants),
    mutants,
  };
}

function inputHashes(root = ROOT) {
  return Object.fromEntries(
    INPUT_PATHS.map((path) => [path, sha256(readFileSync(join(root, path)))]),
  );
}

function immutableEvidenceMetadata(mutant) {
  return {
    id: mutant.id,
    group: mutant.group,
    target: mutant.target,
    detectorKind: mutant.detectorKind,
    threats: mutant.threats,
    decisions: mutant.decisions,
    ...mutantDigestMetadata(mutant),
    intendedCaseIds: mutant.intendedCaseIds,
    intendedTestFiles: mutant.intendedTestFiles,
    expectedFailureFingerprint: mutant.expectedFailureFingerprint,
  };
}

function pendingEvidenceRow(mutant) {
  return {
    ...immutableEvidenceMetadata(mutant),
    status: "pending",
    executed: false,
    compiled: false,
    buildMarker: false,
    testsRan: 0,
    intendedFailingCaseIds: [],
    observedFailureFingerprint: [],
    infrastructureErrors: [],
    detectorSatisfied: false,
    killed: false,
    packagePreconditionSatisfied: false,
    targetTracked: false,
    literalOccurrenceCount: null,
    targetHashBefore: null,
    targetHashAfter: null,
    targetRestored: false,
    restoredGreen: false,
    scopedStatusBefore: null,
    scopedStatusAfter: null,
    liveScopeEndpointsMatch: false,
    revisionDigest: null,
    harnessExit: null,
    harnessOutput: "",
    mutantGate: null,
    executedAt: null,
  };
}

function makeInitialEvidence(root = ROOT) {
  return {
    schemaVersion: SCHEMA_VERSION,
    phase: "08-consent-kernel",
    registerDigest: registerDigest(),
    expectedIds: EXPECTED_M08_IDS,
    inputHashes: inputHashes(root),
    release: null,
    updatedAt: new Date().toISOString(),
    rows: MUTANTS.map(pendingEvidenceRow),
  };
}

function validateRegister(register) {
  if (typeof register !== "object" || register === null) {
    throw new Error("register must be an object");
  }
  if (register.registerDigest !== registerDigest(register.mutants)) {
    throw new Error("registerDigest does not match serialized mutants");
  }
  const expected = makeRegister();
  if (JSON.stringify(register) !== JSON.stringify(expected)) {
    throw new Error("on-disk register differs from the embedded immutable register");
  }
}

function validateReleaseEvidenceShape(
  release,
  { required = false, expectedRevisionDigest = undefined } = {},
) {
  if (release === null) {
    if (required) throw new Error("release evidence is required");
    return;
  }
  validateExactObjectKeys(release, RELEASE_KEYS, "release evidence");
  if (!/^[0-9a-f]{64}$/u.test(release.revisionDigest)) {
    throw new Error("release revisionDigest must be lowercase SHA-256");
  }
  if (
    expectedRevisionDigest !== undefined &&
    release.revisionDigest !== expectedRevisionDigest
  ) {
    throw new Error("release revisionDigest is stale");
  }
  if (
    typeof release.executedAt !== "string" ||
    Number.isNaN(Date.parse(release.executedAt))
  ) {
    throw new Error("release executedAt must be an ISO timestamp");
  }

  validateExactObjectKeys(
    release.commandExits,
    RELEASE_COMMAND_KEYS,
    "release commandExits",
  );
  for (const commandName of RELEASE_COMMAND_KEYS) {
    const exitCode = release.commandExits[commandName];
    if (!Number.isInteger(exitCode)) {
      throw new Error(`release command ${commandName} exit must be an integer`);
    }
    if (exitCode !== 0) {
      throw new Error(`release command ${commandName} exit must be zero`);
    }
  }

  validateExactObjectKeys(release.tests, RELEASE_TEST_KEYS, "release tests");
  for (const key of RELEASE_TEST_KEYS) {
    if (!Number.isInteger(release.tests[key])) {
      throw new Error(`release tests ${key} must be an integer`);
    }
  }
  if (release.tests.exitCode !== release.commandExits.test) {
    throw new Error("release test exit must equal the recorded test command exit");
  }
  if (release.tests.numTestFiles <= 0 || release.tests.numTotalTests <= 0) {
    throw new Error("release test file and total counts must be positive");
  }
  if (
    release.tests.numPassedTests !== release.tests.numTotalTests ||
    release.tests.numFailedTests !== 0 ||
    release.tests.numPendingTests !== 0 ||
    release.tests.numTodoTests !== 0
  ) {
    throw new Error("release test counts must describe a fully green run");
  }

  validateExactObjectKeys(
    release.artifactSurface,
    RELEASE_ARTIFACT_KEYS,
    "release artifactSurface",
  );
  if (
    release.artifactSurface.publicNames !== 75 ||
    release.artifactSurface.publicTypes !== 60 ||
    release.artifactSurface.publicValues !== 15
  ) {
    throw new Error("release artifact surface must equal 75 names / 60 types / 15 values");
  }

  validateExactObjectKeys(
    release.dependencyFootprint,
    RELEASE_DEPENDENCY_KEYS,
    "release dependencyFootprint",
  );
  if (
    release.dependencyFootprint.runtimeBytes !== 0 ||
    release.dependencyFootprint.moduleGraphClean !== true
  ) {
    throw new Error("release dependency footprint must be a clean graph with zero runtime bytes");
  }

  validateExactObjectKeys(
    release.packageConsumer,
    RELEASE_PACKAGE_KEYS,
    "release packageConsumer",
  );
  if (
    !Number.isInteger(release.packageConsumer.tarEntryCount) ||
    release.packageConsumer.tarEntryCount <= 0 ||
    !/^[0-9a-f]{64}$/u.test(release.packageConsumer.tarEntryDigest) ||
    release.packageConsumer.forbiddenEntriesAbsent !== true ||
    release.packageConsumer.foreignTypecheck !== true ||
    release.packageConsumer.foreignRuntime !== true
  ) {
    throw new Error("release package consumer evidence is incomplete");
  }

  validateExactObjectKeys(
    release.nodeFloor,
    RELEASE_NODE_FLOOR_KEYS,
    "release nodeFloor",
  );
  if (
    release.nodeFloor.version !== "v22.12.0" ||
    release.nodeFloor.artifactImported !== true
  ) {
    throw new Error("release Node floor evidence must prove artifact import on v22.12.0");
  }
}

function validateEvidenceShape(
  evidence,
  { requireRelease = false, expectedReleaseRevision = undefined } = {},
) {
  validateExactObjectKeys(evidence, EVIDENCE_KEYS, "evidence");
  if (evidence.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`evidence schemaVersion must equal ${SCHEMA_VERSION}`);
  }
  if (evidence.phase !== "08-consent-kernel") {
    throw new Error("evidence phase is invalid");
  }
  if (evidence.registerDigest !== registerDigest()) {
    throw new Error("evidence registerDigest is stale");
  }
  if (JSON.stringify(evidence.expectedIds) !== JSON.stringify(EXPECTED_M08_IDS)) {
    throw new Error("evidence expectedIds do not match the immutable register");
  }
  validateInputHashShape(evidence.inputHashes);
  validateReleaseEvidenceShape(evidence.release, {
    required: requireRelease,
    expectedRevisionDigest: expectedReleaseRevision,
  });
  if (
    typeof evidence.updatedAt !== "string" ||
    Number.isNaN(Date.parse(evidence.updatedAt))
  ) {
    throw new Error("evidence updatedAt must be an ISO timestamp");
  }
  const rowIds = evidence.rows?.map((row) => row.id) ?? [];
  if (JSON.stringify(rowIds) !== JSON.stringify(EXPECTED_M08_IDS)) {
    throw new Error("evidence rows are missing, duplicated, reordered, or extra");
  }
  for (const [index, mutant] of MUTANTS.entries()) {
    const row = evidence.rows[index];
    if (
      row.group !== mutant.group ||
      row.target !== mutant.target ||
      row.detectorKind !== mutant.detectorKind ||
      JSON.stringify(row.threats) !== JSON.stringify(mutant.threats) ||
      JSON.stringify(row.decisions) !== JSON.stringify(mutant.decisions) ||
      row.definitionDigest !== mutantDigestMetadata(mutant).definitionDigest ||
      row.originalTargetHash !== mutantDigestMetadata(mutant).originalTargetHash ||
      row.mutantTargetHash !== mutantDigestMetadata(mutant).mutantTargetHash ||
      JSON.stringify(row.intendedCaseIds) !== JSON.stringify(mutant.intendedCaseIds) ||
      JSON.stringify(row.intendedTestFiles) !== JSON.stringify(mutant.intendedTestFiles) ||
      JSON.stringify(row.expectedFailureFingerprint) !==
        JSON.stringify(mutant.expectedFailureFingerprint)
    ) {
      throw new Error(`${mutant.id}: evidence immutable metadata differs from register`);
    }
  }
}

class InputEvidenceMalformed extends Error {}
class InputDrift extends Error {
  constructor(path) {
    super(path);
    this.path = path;
  }
}

function validateInputHashShape(inputHashMap) {
  if (
    typeof inputHashMap !== "object" ||
    inputHashMap === null ||
    Array.isArray(inputHashMap)
  ) {
    throw new InputEvidenceMalformed("inputHashes must be an object");
  }
  const keys = Object.keys(inputHashMap).sort();
  const expected = [...INPUT_PATHS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    throw new InputEvidenceMalformed(
      `inputHashes keys must equal ${expected.join(", ")}`,
    );
  }
  for (const path of INPUT_PATHS) {
    if (!/^[0-9a-f]{64}$/u.test(inputHashMap[path])) {
      throw new InputEvidenceMalformed(`${path} hash must be lowercase SHA-256`);
    }
  }
}

function verifyInputEvidence(evidence, root = ROOT) {
  validateInputHashShape(evidence?.inputHashes);
  for (const path of INPUT_PATHS) {
    const absolutePath = join(root, path);
    if (!existsSync(absolutePath)) throw new InputDrift(path);
    const observed = sha256(readFileSync(absolutePath));
    if (observed !== evidence.inputHashes[path]) throw new InputDrift(path);
  }
  return true;
}

function readInputEvidence(path = EVIDENCE_PATH) {
  const resolvedPath = !existsSync(path) && path === EVIDENCE_PATH
    ? REGISTER_PATH
    : path;
  if (!existsSync(resolvedPath)) {
    throw new InputEvidenceMalformed("evidence file is missing");
  }
  try {
    return JSON.parse(readFileSync(resolvedPath, "utf8"));
  } catch (error) {
    throw new InputEvidenceMalformed(
      `evidence JSON is unreadable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function verifyInputs({ quiet = false, evidencePath = EVIDENCE_PATH, root = ROOT } = {}) {
  try {
    verifyInputEvidence(readInputEvidence(evidencePath), root);
    if (!quiet) {
      process.stdout.write(
        "PASS: inputs unchanged — 3 files, lockfile byte-identical\n",
      );
    }
    return true;
  } catch (error) {
    if (error instanceof InputDrift) {
      if (!quiet) process.stderr.write(`FAIL: input drift — ${error.path}\n`);
      return false;
    }
    const reason = error instanceof Error ? error.message : String(error);
    if (!quiet) process.stderr.write(`FAIL: input evidence malformed — ${reason}\n`);
    return false;
  }
}

function refreshArtifacts() {
  validateDefinitions();
  const register = makeRegister();
  atomicWriteJson(REGISTER_PATH, register);
  console.log(
    `PASS: refreshed ${EXPECTED_M08_IDS.length} pending Phase 8 mutation rows — register ${register.registerDigest}`,
  );
}

function ensureArtifacts() {
  validateDefinitions();
  if (!existsSync(REGISTER_PATH)) {
    throw new Error("mutation artifacts are missing; run refresh first");
  }
  const register = JSON.parse(readFileSync(REGISTER_PATH, "utf8"));
  validateRegister(register);
  if (!existsSync(EVIDENCE_PATH)) {
    atomicWriteJson(EVIDENCE_PATH, makeInitialEvidence());
  }
  const evidence = JSON.parse(readFileSync(EVIDENCE_PATH, "utf8"));
  validateEvidenceShape(evidence);
  return { register, evidence };
}

function runBuild(root = ROOT) {
  const result = command("pnpm", ["build"], { cwd: root });
  return {
    ...result,
    markerFound: result.output.includes(BUILD_MARKER),
    succeeded: result.exitCode === 0 && result.output.includes(BUILD_MARKER),
  };
}

function casePattern(caseIds) {
  const explicit = Object.freeze({
    P03: "states that client consent evidence is untrusted and grants no server authority",
    P04: "rejects reauthorization removal, bypass, replacement, and reordering",
  });
  return `(?:${caseIds
    .map((caseId) =>
      explicit[caseId] === undefined
        ? `(?:\\[${caseId}\\](?:\\s|$)|${caseId}\\s+—)`
        : explicit[caseId].replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
    )
    .join("|")})`;
}

function unreadableVitestReport(parseError = undefined) {
  return {
    readable: false,
    ...(parseError === undefined ? {} : { parseError }),
    numTestFiles: 0,
    numFailedTestSuites: 0,
    numTotalTests: 0,
    numPassedTests: 0,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
    assertions: [],
    suiteErrors: [],
    unhandledErrors: [],
  };
}

function caseIdFromTitle(title) {
  if (title === "states that client consent evidence is untrusted and grants no server authority") {
    return "P03";
  }
  if (title === "rejects reauthorization removal, bypass, replacement, and reordering") {
    return "P04";
  }
  const bracketed = /\[([A-Z]\d{2})\]/u.exec(title);
  if (bracketed !== null) return bracketed[1];
  const named = /\b([A-Z]\d{2})\s+—/u.exec(title);
  return named?.[1] ?? null;
}

function summarizeVitestPayload(report) {
  const assertions = (report.testResults ?? []).flatMap((suite) =>
    (suite.assertionResults ?? []).map((assertion) => ({
      caseId: caseIdFromTitle(assertion.title ?? ""),
      title: assertion.title ?? "",
      status: assertion.status ?? "unknown",
      failureMessages: assertion.failureMessages ?? [],
    })),
  );
  const suiteErrors = (report.testResults ?? []).flatMap((suite) => {
    const assertionMessages = new Set(
      (suite.assertionResults ?? [])
        .flatMap((assertion) => assertion.failureMessages ?? [])
        .filter((message) => typeof message === "string")
        .map((message) => message.trim()),
    );
    return [...new Set(
      [suite.message, suite.failureMessage]
        .filter((message) => typeof message === "string" && message.trim() !== "")
        .map((message) => message.trim())
        .filter((message) => !assertionMessages.has(message)),
    )];
  });
  const unhandledErrors = [...(report.unhandledErrors ?? []), ...(report.errors ?? [])]
    .map((error) => (typeof error === "string" ? error : JSON.stringify(error)))
    .filter((error) => error !== "" && error !== undefined);
  const assertionTodos = assertions.filter(
    (assertion) => assertion.status === "todo",
  ).length;
  return {
    readable: true,
    numTestFiles: (report.testResults ?? []).length,
    numFailedTestSuites: report.numFailedTestSuites ?? 0,
    numTotalTests: report.numTotalTests ?? 0,
    numPassedTests: report.numPassedTests ?? 0,
    numFailedTests: report.numFailedTests ?? 0,
    numPendingTests: report.numPendingTests ?? 0,
    numTodoTests: report.numTodoTests ?? assertionTodos,
    assertions,
    suiteErrors,
    unhandledErrors,
  };
}

function summarizeVitestReport(reportPath) {
  if (!existsSync(reportPath)) return unreadableVitestReport();
  try {
    return summarizeVitestPayload(JSON.parse(readFileSync(reportPath, "utf8")));
  } catch (error) {
    return unreadableVitestReport(
      error instanceof Error ? error.message : String(error),
    );
  }
}

function runVitest(testFiles, reportPath, selectedCaseIds = null, root = ROOT) {
  rmSync(reportPath, { force: true });
  const files = Array.isArray(testFiles) ? testFiles : [testFiles];
  const args = ["exec", "vitest", "run", ...files];
  if (selectedCaseIds !== null) {
    args.push(`--testNamePattern=${casePattern(selectedCaseIds)}`);
  }
  args.push("--reporter=json", `--outputFile=${reportPath}`);
  const result = command("pnpm", args, { cwd: root });
  return { ...result, report: summarizeVitestReport(reportPath) };
}

function runFullVitest(reportPath, root = ROOT) {
  rmSync(reportPath, { force: true });
  const result = command(
    "pnpm",
    ["test", "--reporter=json", `--outputFile=${reportPath}`],
    { cwd: root },
  );
  return { ...result, report: summarizeVitestReport(reportPath) };
}

function runTypecheck(root = ROOT) {
  return command("pnpm", [
    "--filter",
    "@fullselfbrowsing/concierge",
    "typecheck",
  ], { cwd: root });
}

function exactCaseSet(report, intendedCaseIds, expectedStatus) {
  const intended = [...intendedCaseIds].sort();
  const selected = report.assertions.filter(
    (assertion) => !["skipped", "pending", "todo"].includes(assertion.status),
  );
  const observed = selected
    .map((assertion) => assertion.caseId)
    .filter((caseId) => caseId !== null)
    .sort();
  return (
    report.readable &&
    selected.length > 0 &&
    JSON.stringify(observed) === JSON.stringify(intended) &&
    selected.every((assertion) => assertion.status === expectedStatus)
  );
}

function runtimeFailureFingerprint(report) {
  const fingerprint = [];
  const errors = [];
  for (const assertion of report.assertions) {
    if (assertion.status !== "failed") continue;
    const messages = assertion.failureMessages.filter(
      (message) => typeof message === "string",
    );
    if (messages.length !== 1) {
      errors.push(`${assertion.caseId ?? assertion.title}: failureMessages=${messages.length}`);
    }
    const markers = messages.flatMap((message) => [
      ...message.matchAll(/\[RED:[A-Z]\d{2}:[^\]]+\]/gu),
    ].map((match) => match[0]));
    if (markers.length !== 1) {
      errors.push(`${assertion.caseId ?? assertion.title}: RED markers=${markers.length}`);
      continue;
    }
    fingerprint.push({ caseId: assertion.caseId, marker: markers[0] });
  }
  fingerprint.sort((left, right) =>
    `${left.caseId}:${left.marker}`.localeCompare(`${right.caseId}:${right.marker}`),
  );
  return { fingerprint, errors };
}

function exactRuntimeFailureSet(report, mutant) {
  const observed = runtimeFailureFingerprint(report);
  const expected = [...mutant.expectedFailureFingerprint].sort((left, right) =>
    `${left.caseId}:${left.marker}`.localeCompare(`${right.caseId}:${right.marker}`),
  );
  return {
    satisfied:
      exactCaseSet(report, mutant.intendedCaseIds, "failed") &&
      report.suiteErrors.length === 0 &&
      report.unhandledErrors.length === 0 &&
      observed.errors.length === 0 &&
      JSON.stringify(observed.fingerprint) === JSON.stringify(expected),
    observed: observed.fingerprint,
    infrastructureErrors: [
      ...report.suiteErrors,
      ...report.unhandledErrors,
      ...observed.errors,
    ],
  };
}

function shortOutput(output, maxLength = 12_000) {
  return output.length <= maxLength
    ? output
    : `${output.slice(0, maxLength)}\n...[truncated ${output.length - maxLength} chars]`;
}

function gateResultPath(directory) {
  return join(directory, "gate-result.json");
}

function writeGateResult(directory, value) {
  atomicWriteJson(gateResultPath(directory), value);
}

function runPackageGate(mutant, directory, build) {
  const pack = command(
    "pnpm",
    ["pack", "--pack-destination", directory],
    { cwd: CORE_PACKAGE_DIRECTORY },
  );
  const tarballPath = pack.stdout.trim().split(/\r?\n/u).at(-1) ?? "";
  const tarList =
    pack.exitCode === 0 && tarballPath !== "" && existsSync(tarballPath)
      ? command("tar", ["-tzf", tarballPath])
      : { exitCode: 255, signal: null, output: "tarball missing", stdout: "", stderr: "" };
  const forbiddenEntries = tarList.stdout
    .split(/\r?\n/u)
    .filter((entry) => /stub-transport|test\/fixtures/u.test(entry));
  const packagePreconditionSatisfied =
    pack.exitCode === 0 &&
    tarList.exitCode === 0 &&
    forbiddenEntries.length > 0;
  const detector = packagePreconditionSatisfied
    ? command("pnpm", ["check:pack"])
    : {
        exitCode: 255,
        signal: null,
        output: "package detector skipped because forbidden tar precondition failed",
      };
  const markerCount = detector.output.split(PACKAGE_FAILURE_MARKER).length - 1;
  const detectorSatisfied =
    build.succeeded &&
    packagePreconditionSatisfied &&
    detector.exitCode !== 0 &&
    detector.signal === null &&
    markerCount === 1;
  const gate = {
    id: mutant.id,
    buildExit: build.exitCode,
    buildMarker: build.markerFound,
    compiled: build.succeeded,
    buildOutput: shortOutput(build.output),
    testsRan: packagePreconditionSatisfied ? 1 : 0,
    packagePreconditionSatisfied,
    packExit: pack.exitCode,
    packOutput: shortOutput(pack.output),
    forbiddenEntries,
    detectorExit: detector.exitCode,
    detectorOutput: shortOutput(detector.output),
    observedFailureFingerprint: detectorSatisfied
      ? [{ caseId: "P02", marker: PACKAGE_FAILURE_MARKER }]
      : [],
    infrastructureErrors: [],
    detectorSatisfied,
  };
  writeGateResult(directory, gate);
  if (detectorSatisfied) process.stderr.write(`${PACKAGE_FAILURE_MARKER}\n`);
  process.exitCode = detectorSatisfied ? 1 : detector.exitCode === 0 ? 0 : 93;
}

function runGate(mutantId, directory) {
  const mutant = MUTANT_BY_ID.get(mutantId);
  if (mutant === undefined) throw new Error(`unknown gate mutant id: ${mutantId}`);
  const build = runBuild();
  if (mutant.detectorKind === "package") {
    runPackageGate(mutant, directory, build);
    return;
  }

  const gate = {
    id: mutant.id,
    buildExit: build.exitCode,
    buildMarker: build.markerFound,
    compiled: build.succeeded,
    buildOutput: shortOutput(build.output),
    testsRan: 0,
    packagePreconditionSatisfied: false,
    vitestExit: null,
    testReport: null,
    observedFailureFingerprint: [],
    infrastructureErrors: [],
    detectorSatisfied: false,
  };
  if (!build.succeeded) {
    writeGateResult(directory, gate);
    process.exitCode = 91;
    return;
  }

  const reportPath = join(directory, "mutant-vitest.json");
  const vitest = runVitest(
    mutant.intendedTestFiles,
    reportPath,
    mutant.intendedCaseIds,
  );
  const fingerprint = exactRuntimeFailureSet(vitest.report, mutant);
  gate.vitestExit = vitest.exitCode;
  gate.testReport = vitest.report;
  gate.testsRan = vitest.report.assertions.filter(
    (assertion) => !["skipped", "pending", "todo"].includes(assertion.status),
  ).length;
  gate.vitestOutput = shortOutput(vitest.output);
  gate.observedFailureFingerprint = fingerprint.observed;
  gate.infrastructureErrors = fingerprint.infrastructureErrors;
  gate.detectorSatisfied =
    vitest.exitCode !== 0 && vitest.signal === null && fingerprint.satisfied;
  writeGateResult(directory, gate);
  if (gate.detectorSatisfied) {
    process.stderr.write(`${failureMarkerForMutant(mutant.id)}\n`);
  }
  process.exitCode = gate.detectorSatisfied ? 1 : vitest.exitCode === 0 ? 0 : 93;
}

function runRestoredGates(mutant, directory, root = ROOT) {
  const build = runBuild(root);
  const reportPath = join(directory, "restored-vitest.json");
  const vitest = build.succeeded
    ? runVitest(mutant.intendedTestFiles, reportPath, null, root)
    : {
        exitCode: 255,
        output: "restored Vitest skipped because build failed",
        report: summarizeVitestReport(reportPath),
      };
  const typecheck = build.succeeded
    ? runTypecheck(root)
    : { exitCode: 255, output: "restored typecheck skipped because build failed" };
  const pack =
    build.succeeded && mutant.detectorKind === "package"
      ? command("pnpm", ["check:pack"], { cwd: root })
      : { exitCode: mutant.detectorKind === "package" ? 255 : 0, output: "" };
  const green =
    build.succeeded &&
    vitest.exitCode === 0 &&
    vitest.report.readable &&
    vitest.report.numTotalTests > 0 &&
    vitest.report.numFailedTests === 0 &&
    vitest.report.numPendingTests === 0 &&
    typecheck.exitCode === 0 &&
    pack.exitCode === 0;
  return {
    green,
    buildExit: build.exitCode,
    buildMarker: build.markerFound,
    buildOutput: shortOutput(build.output),
    vitestExit: vitest.exitCode,
    testsRan: vitest.report.numTotalTests,
    testsPassed: vitest.report.numPassedTests,
    testsFailed: vitest.report.numFailedTests,
    vitestOutput: shortOutput(vitest.output),
    typecheckExit: typecheck.exitCode,
    typecheckOutput: shortOutput(typecheck.output),
    packExit: pack.exitCode,
    packOutput: shortOutput(pack.output),
  };
}

function scopedStatus({
  allowUntrackedRunner = false,
  allowedDirtyPaths = [],
} = {}) {
  const result = command("git", [
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    ...SCOPED_PATHS,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`scoped git status failed: ${result.output}`);
  }
  const allowed = new Set(allowedDirtyPaths);
  return result.stdout
    .split(/\r?\n/u)
    .filter((line) =>
      line !== "" &&
      !(allowUntrackedRunner && line === "?? scripts/phase-08-mutation-battery.mjs") &&
      !(line.startsWith(" M ") && allowed.has(line.slice(3)))
    )
    .join("\n")
    .trim();
}

function targetHash(mutant, root = ROOT) {
  return sha256(readFileSync(join(root, mutant.target)));
}

function assertNoUntrackedRevisionInputs(paths) {
  if (paths.length === 0) return;
  throw new Error(
    `release manifest contains untracked scoped inputs:\n${paths.join("\n")}`,
  );
}

function isInstalledDependencyPath(path) {
  return path.split("/").includes("node_modules");
}

function revisionInputPaths({ allowUntrackedRunner = false } = {}) {
  const tracked = command("git", [
    "ls-files",
    "-z",
    "--",
    ...REVISION_DIRECTORY_SCOPES,
    ...REVISION_REQUIRED_PATHS,
  ]);
  if (tracked.exitCode !== 0) {
    throw new Error(`revision manifest lookup failed: ${tracked.output}`);
  }
  const untracked = command("git", [
    "ls-files",
    "--others",
    "-z",
    "--",
    ...REVISION_DIRECTORY_SCOPES,
    ...REVISION_REQUIRED_PATHS,
  ]);
  if (untracked.exitCode !== 0) {
    throw new Error(`untracked revision manifest lookup failed: ${untracked.output}`);
  }
  const untrackedPaths = [...new Set(untracked.stdout.split("\0").filter(Boolean))]
    .filter((path) => !isInstalledDependencyPath(path))
    .sort();
  const permittedRunner = "scripts/phase-08-mutation-battery.mjs";
  assertNoUntrackedRevisionInputs(
    untrackedPaths.filter(
      (path) => !(allowUntrackedRunner && path === permittedRunner),
    ),
  );
  const paths = [
    ...new Set([
      ...tracked.stdout.split("\0").filter(Boolean),
      ...(allowUntrackedRunner && untrackedPaths.includes(permittedRunner)
        ? [permittedRunner]
        : []),
    ]),
  ].sort();
  for (const path of REVISION_REQUIRED_PATHS) {
    if (!paths.includes(path)) {
      throw new Error(`revision manifest is missing required path: ${path}`);
    }
  }
  for (const scope of REVISION_DIRECTORY_SCOPES) {
    if (!paths.some((path) => path.startsWith(`${scope}/`))) {
      throw new Error(`revision manifest scope is empty: ${scope}`);
    }
  }
  return Object.freeze(paths);
}

function releaseRevisionDigest(paths = revisionInputPaths(), root = ROOT) {
  const digest = createHash("sha256");
  digest.update("phase-08-release\0");
  for (const path of paths) {
    digest.update(`path\0${path}\0`);
    digest.update(readFileSync(join(root, path)));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function assertStableReleaseRevision(before, after) {
  if (
    JSON.stringify(before.paths) !== JSON.stringify(after.paths) ||
    before.digest !== after.digest
  ) {
    throw new Error("release inputs changed while gates were running");
  }
}

function installReleaseSnapshotDependencies(snapshotRoot) {
  const install = command(
    "pnpm",
    ["install", "--offline", "--frozen-lockfile"],
    {
      cwd: snapshotRoot,
      env: { ...process.env, CI: "true" },
    },
  );
  if (install.exitCode !== 0) {
    throw new Error(
      `release snapshot dependency install failed:\n${shortOutput(install.output)}`,
    );
  }
}

function materializeReleaseSnapshot(
  directory,
  paths,
  { sourceRoot = ROOT, installDependencies = true } = {},
) {
  const snapshotRoot = join(directory, "release-snapshot");
  mkdirSync(snapshotRoot, { recursive: true });
  for (const path of paths) {
    const target = join(snapshotRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(sourceRoot, path), target);
    chmodSync(target, 0o444);
  }
  if (installDependencies) installReleaseSnapshotDependencies(snapshotRoot);
  return Object.freeze({
    root: snapshotRoot,
    revision: Object.freeze({
      paths: Object.freeze([...paths]),
      digest: releaseRevisionDigest(paths, snapshotRoot),
    }),
  });
}

function assertReleaseSnapshotStable(snapshot) {
  assertStableReleaseRevision(snapshot.revision, {
    paths: snapshot.revision.paths,
    digest: releaseRevisionDigest(snapshot.revision.paths, snapshot.root),
  });
}

function runAgainstReleaseSnapshot(snapshot, run) {
  assertReleaseSnapshotStable(snapshot);
  const result = run(snapshot.root);
  assertReleaseSnapshotStable(snapshot);
  return result;
}

function materializeMutationSnapshot(
  directory,
  mutant,
  paths,
  { sourceRoot = ROOT, installDependencies = true } = {},
) {
  const snapshotRoot = join(directory, "mutation-snapshot");
  mkdirSync(snapshotRoot, { recursive: true });
  for (const path of paths) {
    const target = join(snapshotRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(sourceRoot, path), target);
  }
  if (installDependencies) installReleaseSnapshotDependencies(snapshotRoot);
  return Object.freeze({
    root: snapshotRoot,
    revision: Object.freeze({
      paths: Object.freeze([...paths]),
      digest: revisionDigest(mutant, snapshotRoot, paths),
    }),
  });
}

function assertStableMutationRevision(mutant, snapshot) {
  const observed = revisionDigest(
    mutant,
    snapshot.root,
    snapshot.revision.paths,
  );
  if (observed !== snapshot.revision.digest) {
    throw new Error("mutation snapshot was not restored to its measured bytes");
  }
}

function replaceExactOnce(source, pattern, replacement, label) {
  const occurrenceCount = source.split(pattern).length - 1;
  if (occurrenceCount !== 1) {
    throw new Error(
      `${label}: literal occurrence count is ${occurrenceCount}, expected 1`,
    );
  }
  return source.replace(pattern, replacement);
}

function revisionDigest(mutant, root = ROOT, paths = revisionInputPaths()) {
  const digest = createHash("sha256");
  digest.update(`mutant\0${JSON.stringify(mutant)}\0`);
  for (const path of paths) {
    digest.update(`path\0${path}\0`);
    digest.update(readFileSync(join(root, path)));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function executeMutant(
  mutant,
  { allowUntrackedRunner = false, allowedDirtyPaths = [] } = {},
) {
  const beforeStatus = scopedStatus({ allowUntrackedRunner, allowedDirtyPaths });
  if (beforeStatus !== "") {
    throw new Error(
      `${mutant.id}: scoped source/test/type/lockfile tree is dirty before mutation:\n${beforeStatus}`,
    );
  }
  const paths = revisionInputPaths({ allowUntrackedRunner });
  const liveSource = readFileSync(join(ROOT, mutant.target), "utf8");
  const sourceBytes = Buffer.from(liveSource);
  const occurrenceCount = liveSource.split(mutant.literalPattern).length - 1;
  const tracked =
    command("git", ["ls-files", "--error-unmatch", mutant.target]).exitCode === 0;
  const measuredRevisionDigest = revisionDigest(mutant, ROOT, paths);
  const directory = mkdtempSync(join(tmpdir(), "phase-08-mutation-"));

  try {
    const snapshot = materializeMutationSnapshot(directory, mutant, paths);
    if (snapshot.revision.digest !== measuredRevisionDigest) {
      throw new Error(`${mutant.id}: mutation snapshot differs from measured bytes`);
    }
    const snapshotTarget = join(snapshot.root, mutant.target);
    const snapshotSource = readFileSync(snapshotTarget, "utf8");
    const hashBefore = targetHash(mutant, snapshot.root);
    const mutatedSource = replaceExactOnce(
      snapshotSource,
      mutant.literalPattern,
      mutant.replacement,
      mutant.id,
    );
    let gateProcess;
    try {
      writeFileSync(snapshotTarget, mutatedSource, "utf8");
      gateProcess = command(
        "node",
        [
          join(snapshot.root, "scripts/phase-08-mutation-battery.mjs"),
          "gate",
          mutant.id,
          directory,
        ],
        {
          cwd: snapshot.root,
          env: { ...process.env, PHASE_08_SNAPSHOT_GATE: "1" },
        },
      );
    } finally {
      writeFileSync(snapshotTarget, sourceBytes);
    }
    const resultPath = gateResultPath(directory);
    const gate = existsSync(resultPath)
      ? JSON.parse(readFileSync(resultPath, "utf8"))
      : null;
    const hashAfter = targetHash(mutant, snapshot.root);
    const targetRestored = hashAfter === hashBefore;
    assertStableMutationRevision(mutant, snapshot);
    const restored = runRestoredGates(mutant, directory, snapshot.root);
    assertStableMutationRevision(mutant, snapshot);
    const afterStatus = scopedStatus({ allowUntrackedRunner, allowedDirtyPaths });
    const afterPaths = revisionInputPaths({ allowUntrackedRunner });
    const liveRevisionEndpointsMatch =
      JSON.stringify(afterPaths) === JSON.stringify(paths) &&
      revisionDigest(mutant, ROOT, afterPaths) === measuredRevisionDigest;
    const liveScopeEndpointsMatch =
      beforeStatus === "" &&
      afterStatus === "" &&
      liveRevisionEndpointsMatch;
    const harnessExit = gateProcess.exitCode === 0 ? 1 : 0;
    const harnessOutput =
      gateProcess.exitCode === 0
        ? "FAIL: snapshot gate did NOT fire — mutant escaped"
        : `PASS: snapshot gate fired (exit ${gateProcess.exitCode}), snapshot restored`;
    const killed =
      harnessExit === 0 &&
      gate !== null &&
      gate.compiled === true &&
      gate.buildMarker === true &&
      gate.testsRan > 0 &&
      gate.detectorSatisfied === true &&
      (mutant.detectorKind !== "package" ||
        gate.packagePreconditionSatisfied === true);
    const status =
      killed && targetRestored && restored.green && liveScopeEndpointsMatch
        ? "green"
        : harnessExit === 1
          ? "escaped"
          : "failed";
    const row = {
      ...immutableEvidenceMetadata(mutant),
      status,
      executed: true,
      compiled: gate?.compiled === true,
      buildMarker: gate?.buildMarker === true,
      testsRan: gate?.testsRan ?? 0,
      intendedFailingCaseIds:
        gate?.testReport?.assertions
          ?.filter((assertion) => assertion.status === "failed")
          .map((assertion) => assertion.caseId)
          .filter((caseId) => caseId !== null) ??
        (gate?.detectorSatisfied === true ? mutant.intendedCaseIds : []),
      observedFailureFingerprint: gate?.observedFailureFingerprint ?? [],
      infrastructureErrors: gate?.infrastructureErrors ?? [],
      detectorSatisfied: gate?.detectorSatisfied === true,
      killed,
      packagePreconditionSatisfied: gate?.packagePreconditionSatisfied === true,
      targetTracked: tracked,
      literalOccurrenceCount: occurrenceCount,
      targetHashBefore: hashBefore,
      targetHashAfter: hashAfter,
      targetRestored,
      restoredGreen: restored.green,
      restored,
      scopedStatusBefore: beforeStatus,
      scopedStatusAfter: afterStatus,
      liveScopeEndpointsMatch,
      revisionDigest: snapshot.revision.digest,
      harnessExit,
      harnessOutput,
      mutantGate: gate,
      executedAt: new Date().toISOString(),
    };
    if (status !== "green") {
      return {
        row,
        error: `${mutant.id} did not close green:\n${JSON.stringify(
          {
            status,
            gateExit: gateProcess.exitCode,
            gateOutput: shortOutput(gateProcess.output, 2_000),
            harnessExit,
            harnessOutput,
            gate,
            targetRestored,
            restoredGreen: restored.green,
            liveScopeEndpointsMatch,
          },
          null,
          2,
        )}`,
      };
    }
    return { row, error: null };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function updateEvidenceRow(evidence, row) {
  const index = evidence.rows.findIndex((candidate) => candidate.id === row.id);
  if (index === -1) throw new Error(`cannot update missing evidence row ${row.id}`);
  evidence.rows[index] = row;
  evidence.updatedAt = new Date().toISOString();
  atomicWriteJson(EVIDENCE_PATH, evidence);
}

export function selectMutantRange(firstId, lastId) {
  if (
    typeof firstId !== "string" ||
    firstId === "" ||
    typeof lastId !== "string" ||
    lastId === ""
  ) {
    throw new Error("mutation range requires two non-empty endpoint ids");
  }
  const firstIndex = EXPECTED_M08_IDS.indexOf(firstId);
  const lastIndex = EXPECTED_M08_IDS.indexOf(lastId);
  if (firstIndex === -1 || lastIndex === -1) {
    throw new Error(`unknown mutation range endpoint: ${firstId}..${lastId}`);
  }
  if (firstIndex > lastIndex) {
    throw new Error(`mutation range is reversed: ${firstId}..${lastId}`);
  }
  const selected = EXPECTED_M08_IDS.slice(firstIndex, lastIndex + 1).map((id) =>
    MUTANT_BY_ID.get(id),
  );
  const group = selected[0]?.group;
  if (group === undefined || selected.some((mutant) => mutant?.group !== group)) {
    throw new Error(`mutation range crosses groups: ${firstId}..${lastId}`);
  }
  if (selected.length < 1 || selected.length > 4) {
    throw new Error(
      `mutation range must select one to four contiguous ids; got ${selected.length}`,
    );
  }
  return selected;
}

function runSelected(selected) {
  const { evidence } = ensureArtifacts();
  for (const [index, mutant] of selected.entries()) {
    const existing = evidence.rows.find((row) => row.id === mutant.id);
    const currentRevisionDigest = revisionDigest(mutant);
    if (
      existing?.status === "green" &&
      existing.revisionDigest === currentRevisionDigest
    ) {
      console.log(
        `[${index + 1}/${selected.length}] ${mutant.id} already green; preserving evidence`,
      );
      continue;
    }
    console.log(`[${index + 1}/${selected.length}] ${mutant.id} ${mutant.name}`);
    const outcome = executeMutant(mutant);
    updateEvidenceRow(evidence, outcome.row);
    if (outcome.error !== null) throw new Error(outcome.error);
  }
}

function runWorkerProcess(mutant, resultPath) {
  return new Promise((resolveWorker) => {
    const child = spawn(
      process.execPath,
      [SCRIPT_PATH, "worker", mutant.id, resultPath],
      {
        cwd: ROOT,
        env: { ...process.env, PHASE_08_MUTATION_WORKER: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    const append = (chunk) => {
      if (Buffer.byteLength(output) < MAX_BUFFER) output += chunk.toString();
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", (error) => {
      resolveWorker({
        fatal: `${mutant.id}: worker process failed to start: ${error.message}`,
        output,
      });
    });
    child.on("close", (exitCode, signal) => {
      if (!existsSync(resultPath)) {
        resolveWorker({
          fatal: `${mutant.id}: worker exited ${String(exitCode)} (${String(signal)}) without a result`,
          output: shortOutput(output, 4_000),
        });
        return;
      }
      try {
        const result = JSON.parse(readFileSync(resultPath, "utf8"));
        resolveWorker({ ...result, output: shortOutput(output, 4_000) });
      } catch (error) {
        resolveWorker({
          fatal: `${mutant.id}: worker result is unreadable: ${error instanceof Error ? error.message : String(error)}`,
          output: shortOutput(output, 4_000),
        });
      }
    });
  });
}

function executeWorker(mutantId, resultPath) {
  if (process.env.PHASE_08_MUTATION_WORKER !== "1") {
    throw new Error("internal mutation worker invocation is not permitted");
  }
  const mutant = MUTANT_BY_ID.get(mutantId);
  if (mutant === undefined) throw new Error(`unknown worker mutant: ${mutantId}`);
  try {
    const outcome = executeMutant(mutant, {
      allowedDirtyPaths: TASK_2_WIP_PATHS,
    });
    atomicWriteJson(resultPath, { mutantId, ...outcome });
    return outcome.error === null ? 0 : 1;
  } catch (error) {
    atomicWriteJson(resultPath, {
      mutantId,
      fatal: error instanceof Error ? error.message : String(error),
    });
    return 1;
  }
}

async function runAll(jobs) {
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > 4) {
    throw new Error(`run all jobs must be an integer from 1 through 4; got ${String(jobs)}`);
  }
  const baselineStatus = scopedStatus({ allowedDirtyPaths: TASK_2_WIP_PATHS });
  if (baselineStatus !== "") {
    throw new Error(`run all scoped inputs contain unapproved drift:\n${baselineStatus}`);
  }
  if (!verifyInputs({ quiet: true })) {
    throw new Error("immutable manifest/lock input verification failed before mutation run");
  }

  const { evidence } = ensureArtifacts();
  evidence.release = null;
  evidence.updatedAt = new Date().toISOString();
  atomicWriteJson(EVIDENCE_PATH, evidence);
  const selected = MUTANTS.filter((mutant) => {
    const existing = evidence.rows.find((row) => row.id === mutant.id);
    return !(
      existing?.status === "green" &&
      existing.revisionDigest === revisionDigest(mutant)
    );
  });
  const failures = [];
  const directory = mkdtempSync(join(tmpdir(), "phase-08-workers-"));
  let nextIndex = 0;
  let completed = MUTANTS.length - selected.length;

  try {
    async function consume() {
      while (nextIndex < selected.length) {
        const selectedIndex = nextIndex;
        nextIndex += 1;
        const mutant = selected[selectedIndex];
        const resultPath = join(directory, `${mutant.id}.json`);
        console.log(
          `[start ${completed + 1}/${MUTANTS.length}] ${mutant.id} ${mutant.name}`,
        );
        const result = await runWorkerProcess(mutant, resultPath);
        completed += 1;
        if (result.row !== undefined) updateEvidenceRow(evidence, result.row);
        const failure = result.fatal ?? result.error;
        if (failure !== null && failure !== undefined) {
          failures.push(`${mutant.id}: ${failure}\n${result.output ?? ""}`);
          console.error(`[red ${completed}/${MUTANTS.length}] ${mutant.id}`);
        } else {
          console.log(`[green ${completed}/${MUTANTS.length}] ${mutant.id}`);
        }
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(jobs, Math.max(selected.length, 1)) },
        () => consume(),
      ),
    );
    if (failures.length > 0) {
      throw new Error(
        `${failures.length} mutation worker(s) did not close green:\n${failures.join("\n\n")}`,
      );
    }
    verifyEvidenceGroup(evidence, "all");
    const release = runReleaseGates(join(directory, "release"), {
      allowedDirtyPaths: TASK_2_WIP_PATHS,
    });
    recordReleaseEvidence(evidence, release);
    console.log(
      `PASS: 48/48 mutants green with ${jobs} disposable workers; immutable seven-gate release snapshot ${release.revisionDigest}`,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function validateGreenRow(
  row,
  mutant,
  {
    currentRevisionDigest = revisionDigest(mutant),
    currentTargetHash = targetHash(mutant),
  } = {},
) {
  const requiredTrue = [
    "executed",
    "compiled",
    "buildMarker",
    "detectorSatisfied",
    "killed",
    "targetTracked",
    "targetRestored",
    "restoredGreen",
    "liveScopeEndpointsMatch",
  ];
  if (row.status !== "green") throw new Error(`${mutant.id}: status is not green`);
  for (const key of requiredTrue) {
    if (row[key] !== true) throw new Error(`${mutant.id}: ${key} is not true`);
  }
  if (!Number.isInteger(row.testsRan) || row.testsRan <= 0) {
    throw new Error(`${mutant.id}: zero detector tests/package observations ran`);
  }
  if (row.literalOccurrenceCount !== 1) {
    throw new Error(`${mutant.id}: literal occurrence was not exactly one`);
  }
  if (row.scopedStatusBefore !== "" || row.scopedStatusAfter !== "") {
    throw new Error(`${mutant.id}: scoped tree was dirty`);
  }
  if (
    row.targetHashBefore !== currentTargetHash ||
    row.targetHashAfter !== currentTargetHash
  ) {
    throw new Error(`${mutant.id}: target was not byte-identically restored`);
  }
  if (row.revisionDigest !== currentRevisionDigest) {
    throw new Error(`${mutant.id}: revision digest is stale`);
  }
  const recordedFailingCaseIds = [...row.intendedFailingCaseIds].sort();
  const expectedFailingCaseIds = [...mutant.intendedCaseIds].sort();
  if (
    JSON.stringify(recordedFailingCaseIds) !==
      JSON.stringify(expectedFailingCaseIds)
  ) {
    throw new Error(`${mutant.id}: exact intended case set did not fail`);
  }
  const expectedFingerprint = [...mutant.expectedFailureFingerprint].sort((left, right) =>
    `${left.caseId}:${left.marker}`.localeCompare(`${right.caseId}:${right.marker}`),
  );
  const observedFingerprint = [...row.observedFailureFingerprint].sort((left, right) =>
    `${left.caseId}:${left.marker}`.localeCompare(`${right.caseId}:${right.marker}`),
  );
  if (JSON.stringify(observedFingerprint) !== JSON.stringify(expectedFingerprint)) {
    throw new Error(`${mutant.id}: wrong detector marker fingerprint`);
  }
  if (!Array.isArray(row.infrastructureErrors) || row.infrastructureErrors.length !== 0) {
    throw new Error(`${mutant.id}: infrastructure errors are present`);
  }
  if (mutant.detectorKind === "package" && row.packagePreconditionSatisfied !== true) {
    throw new Error(`${mutant.id}: forbidden tarball precondition was not observed`);
  }
}

function verifyEvidenceGroup(evidence, group) {
  validateEvidenceShape(evidence);
  const ids = group === "all" ? EXPECTED_M08_IDS : EXPECTED_IDS_BY_GROUP[group];
  if (ids === undefined) throw new Error(`unknown verification group: ${group}`);
  const seenRevisionDigests = new Set();
  for (const id of ids) {
    const mutant = MUTANT_BY_ID.get(id);
    const row = evidence.rows.find((candidate) => candidate.id === id);
    if (mutant === undefined || row === undefined) {
      throw new Error(`${id}: mutation row is missing`);
    }
    validateGreenRow(row, mutant);
    if (seenRevisionDigests.has(row.revisionDigest)) {
      throw new Error(`${id}: revision digest is shared with another row`);
    }
    seenRevisionDigests.add(row.revisionDigest);
  }
  return ids.length;
}

function verifyGroup(group, { quiet = false } = {}) {
  const { evidence } = ensureArtifacts();
  if (group === "all" && !verifyInputs({ quiet: true })) {
    throw new Error("immutable manifest/lock input verification failed");
  }
  if (group === "all") {
    validateEvidenceShape(evidence, {
      requireRelease: true,
      expectedReleaseRevision: releaseRevisionDigest(),
    });
    validatePackageBoundary();
  }
  const count = verifyEvidenceGroup(evidence, group);
  if (!quiet) {
    console.log(`PASS: ${group} mutation evidence is green — ${count}/${count}`);
  }
  return true;
}

function validatePackageBoundary({
  packageManifest = JSON.parse(readFileSync(join(ROOT, "packages/concierge/package.json"), "utf8")),
  indexSource = readFileSync(join(ROOT, "packages/concierge/src/index.ts"), "utf8"),
  sourceFiles = command("rg", [
    "-n",
    "createStubTransport|stub-transport",
    "packages/concierge/src",
  ]),
  packScript = readFileSync(join(ROOT, "scripts/pack-install-check.sh"), "utf8"),
} = {}) {
  const expectedFiles = ["dist", "src", "README.md", "LICENSE"];
  if (JSON.stringify(packageManifest.files) !== JSON.stringify(expectedFiles)) {
    throw new Error("published package files allow-list drifted");
  }
  if (/createStubTransport|stub-transport/u.test(indexSource)) {
    throw new Error("stub transport reached the production barrel");
  }
  if (sourceFiles.exitCode === 0 && sourceFiles.output.trim() !== "") {
    throw new Error("stub transport reached production source");
  }
  if (sourceFiles.exitCode !== 1) {
    throw new Error(
      `production source scan failed with exit ${sourceFiles.exitCode}`,
    );
  }
  for (const token of [
    "tar -tzf",
    "package/(test|test-d)",
    "TAR_ENTRY_SHA256",
    "PACK_EVIDENCE",
    "[RED:P01:stub-tarball-exclusion]",
  ]) {
    if (!packScript.includes(token)) {
      throw new Error(`package exclusion detector drifted: missing ${token}`);
    }
  }
  const probeSource = readFileSync(
    join(ROOT, "packages/concierge/test/fixtures/probe.ts"),
    "utf8",
  );
  for (const publicType of [
    "ConsentPolicy",
    "DeliveryReport",
    "DigestLike",
    "ReadbackReceipt",
    "ReadbackSink",
    "ServerChallenge",
    "SnapshotNormalizer",
    "TurnIdentityProvenance",
    "OutcomeSink",
  ]) {
    if (!probeSource.includes(publicType)) {
      throw new Error(`foreign declaration probe omits public type ${publicType}`);
    }
  }
  if (!probeSource.includes("presentOutcome: foreignOutcomeSink")) {
    throw new Error("foreign SessionConfig probe omits its required outcome sink");
  }
}

function markdownSection(markdown, heading) {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  if (start === -1) throw new Error(`validation ledger is missing ${heading} section`);
  const bodyStart = start + marker.length;
  const remainder = markdown.slice(bodyStart);
  const nextHeading = remainder.search(/\n##\s/u);
  return nextHeading === -1 ? remainder : remainder.slice(0, nextHeading);
}

function parseTwoColumnRows(markdown, label) {
  const rows = new Map();
  for (const line of markdown.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length !== 2) continue;
    if (cells.every((cell) => /^:?-+:?$/u.test(cell))) continue;
    if (["Property", "Evidence", "Input", "Gate"].includes(cells[0])) continue;
    if (rows.has(cells[0])) {
      throw new Error(`${label} contains duplicate row ${cells[0]}`);
    }
    rows.set(cells[0], cells[1]);
  }
  return rows;
}

function parseCoverageRows(markdown, heading, expectedHeader) {
  const section = markdownSection(markdown, heading);
  const rows = new Map();
  let sawHeader = false;
  for (const line of section.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
    const cells = trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-+:?$/u.test(cell))) continue;
    if (!sawHeader) {
      if (JSON.stringify(cells) !== JSON.stringify(expectedHeader)) {
        throw new Error(`${heading} has an invalid table header`);
      }
      sawHeader = true;
      continue;
    }
    if (cells.length !== expectedHeader.length || cells.some((cell) => cell === "")) {
      throw new Error(`${heading} contains an incomplete row`);
    }
    if (rows.has(cells[0])) throw new Error(`${heading} contains duplicate row ${cells[0]}`);
    rows.set(cells[0], cells.slice(1));
  }
  if (!sawHeader) throw new Error(`${heading} is missing its table`);
  return rows;
}

function requireExactCoverageKeys(rows, expectedKeys, label) {
  if (JSON.stringify([...rows.keys()]) !== JSON.stringify(expectedKeys)) {
    throw new Error(`${label} row keys are missing, reordered, or extra`);
  }
}

function requirementCheckboxAndTrace(requirementsText, requirementId) {
  if (!new RegExp(`^- \\[x\\] \\*\\*${requirementId}\\*\\*:`, "mu").test(requirementsText)) {
    throw new Error(`${requirementId}: requirement checkbox is not complete`);
  }
  const traceRow = requirementsText
    .split(/\r?\n/u)
    .find((line) => line.startsWith(`| ${requirementId} |`));
  if (traceRow === undefined || !/\|\s*Complete(?:\s|—|\|)/u.test(traceRow)) {
    throw new Error(`${requirementId}: traceability row is not complete`);
  }
  return traceRow;
}

function requireExactRows(rows, expectedRows, label) {
  const observedKeys = [...rows.keys()];
  const expectedKeys = [...expectedRows.keys()];
  if (JSON.stringify(observedKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`${label} row keys are missing, reordered, or extra`);
  }
  for (const [key, expected] of expectedRows) {
    const observed = rows.get(key);
    if (observed !== expected) {
      throw new Error(
        `${label} row ${key} differs: expected ${JSON.stringify(expected)}, observed ${JSON.stringify(observed)}`,
      );
    }
  }
}

function runtimeLedgerValue(release) {
  const tests = release.tests;
  return `${tests.numTestFiles} runtime files / ${tests.numPassedTests} passed / ${tests.numTotalTests} total / ${tests.numPendingTests} pending / ${tests.numTodoTests} todo (\`pnpm test\`, exit ${tests.exitCode})`;
}

function validateApproval(validationText, registerDigestValue) {
  if (/\*\*Approval:\*\* pending/u.test(validationText)) {
    throw new Error("validation approval is still pending");
  }
  const approvalPattern = new RegExp(
    `\\*\\*Approval:\\*\\* approved \\d{4}-\\d{2}-\\d{2} — register ${registerDigestValue}; 48/48 green; seven release gates green`,
    "u",
  );
  if (!approvalPattern.test(validationText)) {
    throw new Error("validation approval date/digest is missing or invalid");
  }
}

function expectedMutationLedgerRows(registerDigestValue) {
  return new Map([
    ["Immutable register", `Digest \`${registerDigestValue}\``],
    ["Distribution", MUTATION_DISTRIBUTION_LEDGER],
    ["Outcome", MUTATION_OUTCOME_LEDGER],
    [
      "Non-vacuity",
      "Every row compiled successfully, ran a nonzero named detector set, satisfied its detector, was killed, and matched its one exact source literal before mutation",
    ],
    [
      "Revision binding",
      "Every row records a unique revision digest; all compiled-target hashes changed under mutation and returned to their recorded original values afterward",
    ],
    [
      "Restoration",
      "Each target was mutated and restored only inside its disposable snapshot; the snapshot revision stayed stable and its restored gate passed, while live scoped endpoints matched before and after. This endpoint check does not prove uninterrupted live-history stability; no infrastructure error was recorded",
    ],
    ["Bounded execution", MUTATION_SHARDS_LEDGER],
  ]);
}

function validateLedgerSkeleton(validationText, release = undefined) {
  for (const taskId of REQUIRED_TASK_IDS) {
    if (!validationText.includes(`| ${taskId} |`)) {
      throw new Error(`validation ledger is missing task row ${taskId}`);
    }
  }
  for (const requirementId of REQUIRED_REQUIREMENT_IDS) {
    if (!validationText.includes(requirementId)) {
      throw new Error(`validation ledger is missing requirement mapping ${requirementId}`);
    }
  }
  if (release !== undefined) {
    validateReleaseEvidenceShape(release, { required: true });
    const infrastructure = parseTwoColumnRows(
      markdownSection(validationText, "Test Infrastructure"),
      "Test Infrastructure",
    );
    if (infrastructure.get("**Measured final runtime**") !== runtimeLedgerValue(release)) {
      throw new Error("validation ledger runtime totals are stale or missing");
    }
  }
}

function validateFinalLedgers(validationText, securityText, requirementsText, evidence) {
  validateReleaseEvidenceShape(evidence.release, { required: true });
  const release = evidence.release;
  validateLedgerSkeleton(validationText, release);
  if (!/^status: complete$/mu.test(validationText)) {
    throw new Error("validation frontmatter status must be complete");
  }
  if (!/^nyquist_compliant: true$/mu.test(validationText)) {
    throw new Error("validation frontmatter nyquist_compliant must be true");
  }
  if (!/^wave_0_complete: true$/mu.test(validationText)) {
    throw new Error("validation frontmatter wave_0_complete must be true");
  }
  validateApproval(validationText, evidence.registerDigest);
  for (const taskId of REQUIRED_TASK_IDS) {
    const row = validationText
      .split(/\r?\n/u)
      .find((line) => line.includes(`| ${taskId} |`));
    if (row === undefined || !row.includes("✅ green")) {
      throw new Error(`${taskId}: validation task is not green`);
    }
  }
  const waveSection = validationText.split("## Wave 0 Requirements")[1]?.split("## ")[0] ?? "";
  if (/^- \[ \]/mu.test(waveSection) || /❌/u.test(waveSection)) {
    throw new Error("Wave 0 ledger still contains pending or missing rows");
  }
  const signoffSection = validationText.split("## Validation Sign-Off")[1] ?? "";
  if (/^- \[ \]/mu.test(signoffSection)) {
    throw new Error("validation sign-off still contains pending rows");
  }
  const requirementRows = parseCoverageRows(
    validationText,
    "Requirement Coverage",
    ["Requirement", "Summary", "Detector", "Mutant", "Release fact"],
  );
  requireExactCoverageKeys(requirementRows, REQUIRED_REQUIREMENT_IDS, "Requirement Coverage");
  for (const requirementId of REQUIRED_REQUIREMENT_IDS) {
    requirementCheckboxAndTrace(requirementsText, requirementId);
  }
  const trn02Trace = requirementCheckboxAndTrace(requirementsText, "TRN-02");
  if (!trn02Trace.includes("08-06") || !trn02Trace.includes("M-08-")) {
    throw new Error("TRN-02 traceability must cite current Phase 8 fixture/runtime and mutation proof");
  }
  const trn05Trace = requirementCheckboxAndTrace(requirementsText, "TRN-05");
  if (!trn05Trace.includes("08-05") || !trn05Trace.includes("M-08-")) {
    throw new Error("TRN-05 traceability must cite current Phase 8 runtime and mutation proof");
  }
  if (!validationText.includes(evidence.registerDigest)) {
    throw new Error("validation ledger omits the immutable register digest");
  }

  const mutationSection = markdownSection(validationText, "Measured Mutation Evidence");
  const [mutationTableText, inputTableText = ""] = mutationSection.split(
    "The protected inputs were verified byte-identical before and after the battery:",
  );
  const mutationRows = parseTwoColumnRows(
    mutationTableText,
    "Measured Mutation Evidence",
  );
  requireExactRows(
    mutationRows,
    expectedMutationLedgerRows(evidence.registerDigest),
    "Measured Mutation Evidence",
  );

  const inputRows = parseTwoColumnRows(inputTableText, "protected input evidence");
  const expectedInputRows = new Map(
    INPUT_PATHS.map((path) => [`\`${path}\``, `\`${evidence.inputHashes[path]}\``]),
  );
  requireExactRows(inputRows, expectedInputRows, "protected input evidence");

  for (const [path, hash] of Object.entries(evidence.inputHashes)) {
    if (inputRows.get(`\`${path}\``) !== `\`${hash}\``) {
      throw new Error(`validation ledger omits immutable input hash ${path}`);
    }
  }

  const commandExits = release.commandExits;
  const tests = release.tests;
  const releaseRows = parseTwoColumnRows(
    markdownSection(validationText, "Measured Release Evidence"),
    "Measured Release Evidence",
  );
  requireExactRows(
    releaseRows,
    new Map([
      ["`pnpm build`", `Exit ${commandExits.build}`],
      ["`pnpm typecheck`", `Exit ${commandExits.typecheck}`],
      [
        "`pnpm test`",
        `Exit ${commandExits.test}; ${tests.numTestFiles} runtime files, ${tests.numPassedTests} passed, ${tests.numTotalTests} total, ${tests.numPendingTests} pending, ${tests.numTodoTests} todo`,
      ],
      [
        "`pnpm check:artifact`",
        `Exit ${commandExits["check:artifact"]}; callable artifact and exact public declaration surface of ${release.artifactSurface.publicNames} names / ${release.artifactSurface.publicTypes} types / ${release.artifactSurface.publicValues} values`,
      ],
      [
        "Immutable snapshot",
        `Revision \`${release.revisionDigest}\` remained byte-identical across all seven release gates`,
      ],
      [
        "`pnpm check:deps`",
        `Exit ${commandExits["check:deps"]}; dependency contribution is ${release.dependencyFootprint.runtimeBytes} bytes and the module graph is clean`,
      ],
      [
        "`pnpm check:pack`",
        `Exit ${commandExits["check:pack"]}; ${release.packageConsumer.tarEntryCount} tar entries (digest \`${release.packageConsumer.tarEntryDigest}\`), no test/fixture/stub entry, foreign exact-optional typecheck passed, and consent/readback/outcome runtime bindings passed`,
      ],
      [
        "`pnpm check:node-floor`",
        `Exit ${commandExits["check:node-floor"]}; artifact imported under Node ${release.nodeFloor.version}`,
      ],
    ]),
    "Measured Release Evidence",
  );

  const decisionRows = parseCoverageRows(
    validationText,
    "Decision Coverage",
    ["Decision", "Summary", "Detector", "Mutant", "Release fact"],
  );
  requireExactCoverageKeys(decisionRows, REQUIRED_DECISION_IDS, "Decision Coverage");

  const threatRows = parseCoverageRows(
    validationText,
    "Threat Coverage",
    ["Threat", "Canonical meaning", "Summary", "Detector", "Mutant", "Release fact"],
  );
  requireExactCoverageKeys(threatRows, Object.keys(CANONICAL_THREAT_MEANINGS), "Threat Coverage");
  for (const [threatId, meaning] of Object.entries(CANONICAL_THREAT_MEANINGS)) {
    if (threatRows.get(threatId)?.[0] !== meaning) {
      throw new Error(`${threatId}: validation canonical threat meaning conflicts`);
    }
  }
  if (!threatRows.get("T-08-04")?.join(" ").includes("inherent delivered floor and runtime none guard")) {
    throw new Error("T-08-04: coverage omits the inherent delivered floor and runtime none guard");
  }
  if (!threatRows.get("T-08-09")?.join(" ").includes("current-policy exact-action reauthorization immediately before effect")) {
    throw new Error("T-08-09: coverage omits current-policy exact-action reauthorization immediately before effect");
  }

  const researchRows = parseCoverageRows(
    validationText,
    "Research Constraint Coverage",
    ["Constraint", "Summary", "Detector", "Mutant", "Release fact"],
  );
  requireExactCoverageKeys(researchRows, REQUIRED_RESEARCH_CONSTRAINTS, "Research Constraint Coverage");

  const sourceRows = parseCoverageRows(
    validationText,
    "Source Coverage Audit",
    ["Source", "Planned items", "Evidence", "Unplanned"],
  );
  requireExactCoverageKeys(sourceRows, REQUIRED_SOURCE_CLASSES, "Source Coverage Audit");
  for (const sourceClass of REQUIRED_SOURCE_CLASSES) {
    if (sourceRows.get(sourceClass)?.[2] !== "0") {
      throw new Error(`${sourceClass}: source coverage has unplanned items`);
    }
  }

  if (!/^status: secured$/mu.test(securityText) ||
      !/^standard: OWASP ASVS Level 1$/mu.test(securityText) ||
      !/^block_on: high$/mu.test(securityText) ||
      !/^threats_total: 11$/mu.test(securityText) ||
      !/^threats_mitigated: 11$/mu.test(securityText) ||
      !/^threats_open: 0$/mu.test(securityText)) {
    throw new Error("security audit frontmatter is incomplete or uses the wrong standard");
  }
  if (!securityText.includes(`register_digest: ${evidence.registerDigest}`) ||
      !securityText.includes(`release_revision: ${release.revisionDigest}`)) {
    throw new Error("security audit is stale relative to mutation or release evidence");
  }
  const securityRows = parseCoverageRows(
    securityText,
    "Threat Dispositions",
    ["Threat", "Severity", "Canonical meaning", "Live control", "Negative evidence", "Disposition", "Residual"],
  );
  requireExactCoverageKeys(
    securityRows,
    [...Object.keys(CANONICAL_THREAT_MEANINGS), "T-08-SC"],
    "Threat Dispositions",
  );
  for (const [threatId, meaning] of Object.entries(CANONICAL_THREAT_MEANINGS)) {
    const row = securityRows.get(threatId);
    if (row?.[0] !== "High" || row[1] !== meaning || row[4] !== "Mitigated") {
      throw new Error(`${threatId}: high threat is not independently mapped and mitigated`);
    }
  }
  const supplyChainRow = securityRows.get("T-08-SC");
  if (supplyChainRow?.[0] !== "High" || supplyChainRow[4] !== "Mitigated") {
    throw new Error("T-08-SC: supply-chain threat is not mitigated");
  }

  const byId = new Map(evidence.rows.map((row) => [row.id, row]));
  for (const id of ["M-08-C07", "M-08-G15", "M-08-P02", "M-08-P04"]) {
    const row = byId.get(id);
    if (row?.status !== "green" || row.compiled !== true || row.killed !== true || row.testsRan < 1) {
      throw new Error(`${id}: required closing evidence is absent or red`);
    }
  }
  if (byId.get("M-08-P02")?.packagePreconditionSatisfied !== true) {
    throw new Error("M-08-P02: package-only detector did not satisfy its package precondition");
  }
  for (const id of ["M-08-P03", "M-08-P04"]) {
    if (byId.get(id)?.target !== "README.md") {
      throw new Error(`${id}: SEC-04 mutation must target the root README`);
    }
  }
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  if (!readme.includes("client-side consent state") || !readme.includes("never server authorization")) {
    throw new Error("root README omits the client-assertion authorization warning");
  }
  if (!/await authorizeUnderCurrentPolicy\(authenticatedPrincipal, exactAction\);\n\s*await performGuardedEffect\(transaction, authenticatedPrincipal, exactAction, exactPayload\);/u.test(readme)) {
    throw new Error("root README does not reauthorize the authenticated principal for the exact action immediately before effect");
  }
}

function verifyNamedCasesAndWaveFiles({
  pathExists = (path) => existsSync(join(ROOT, path)),
  readSource = (path) => readFileSync(join(ROOT, path), "utf8"),
} = {}) {
  const expectedFiles = [
    ...new Set([
      ...MUTANTS.flatMap((mutant) => [mutant.target, ...mutant.intendedTestFiles]),
      "packages/concierge/test-d/consent.test-d.ts",
      "packages/concierge/test-d/session.test-d.ts",
      "packages/concierge/test/fixtures/probe.ts",
      "scripts/pack-install-check.sh",
      "scripts/phase-08-mutation-battery.mjs",
    ]),
  ];
  for (const path of expectedFiles) {
    if (!pathExists(path)) throw new Error(`Wave 0 file is missing: ${path}`);
  }
  for (const mutant of MUTANTS) {
    if (mutant.detectorKind === "package") continue;
    if (selectorOccurrences(mutant, readSource) < mutant.intendedCaseIds.length) {
      throw new Error(`${mutant.id}: a registered named detector is missing from its live test file`);
    }
  }
}

function parsePackageConsumerEvidence(output) {
  const match = /PACK_EVIDENCE tar_entries=(\d+) tar_entries_sha256=([0-9a-f]{64}) forbidden_entries=absent foreign_typecheck=passed foreign_runtime=passed/u.exec(output);
  if (match === null) {
    throw new Error("check:pack omitted its machine-readable foreign-consumer evidence");
  }
  return {
    tarEntryCount: Number(match[1]),
    tarEntryDigest: match[2],
    forbiddenEntriesAbsent: true,
    foreignTypecheck: true,
    foreignRuntime: true,
  };
}

function parseDependencyFootprint(output) {
  if (
    !output.includes("Assertion A: PASS") ||
    !output.includes("Assertion B: PASS") ||
    !output.includes("core's dependencies contribute zero bytes to a consumer bundle")
  ) {
    throw new Error("check:deps omitted its two passing zero-byte assertions");
  }
  const runtimeBytes = [...output.matchAll(/^\s+\S+\s+(\d+) bytes$/gmu)]
    .map((match) => Number(match[1]))
    .reduce((sum, value) => sum + value, 0);
  return { runtimeBytes, moduleGraphClean: true };
}

function runReleaseGates(directory, { allowedDirtyPaths = [] } = {}) {
  const commandExits = {};
  const beforeStatus = scopedStatus({ allowedDirtyPaths });
  if (beforeStatus !== "") {
    throw new Error(`release scoped inputs contain unapproved drift:\n${beforeStatus}`);
  }
  const preGatePaths = revisionInputPaths();
  const preGateRevision = Object.freeze({
    paths: preGatePaths,
    digest: releaseRevisionDigest(preGatePaths),
  });
  const snapshot = materializeReleaseSnapshot(directory, preGatePaths);
  assertStableReleaseRevision(preGateRevision, snapshot.revision);
  const postSnapshotPaths = revisionInputPaths();
  assertStableReleaseRevision(preGateRevision, {
    paths: postSnapshotPaths,
    digest: releaseRevisionDigest(postSnapshotPaths),
  });

  const build = runAgainstReleaseSnapshot(snapshot, runBuild);
  commandExits.build = build.exitCode;
  if (!build.succeeded) {
    throw new Error(`release gate build failed:\n${shortOutput(build.output)}`);
  }

  const typecheck = runAgainstReleaseSnapshot(snapshot, (root) =>
    command("pnpm", ["typecheck"], { cwd: root }),
  );
  commandExits.typecheck = typecheck.exitCode;
  if (typecheck.exitCode !== 0) {
    throw new Error(
      `release gate typecheck exited ${typecheck.exitCode}:\n${shortOutput(typecheck.output)}`,
    );
  }

  const test = runAgainstReleaseSnapshot(snapshot, (root) =>
    runFullVitest(join(directory, "full-vitest.json"), root),
  );
  commandExits.test = test.exitCode;
  if (
    test.exitCode !== 0 ||
    !test.report.readable ||
    test.report.numTestFiles <= 0 ||
    test.report.numTotalTests <= 0 ||
    test.report.numPassedTests !== test.report.numTotalTests ||
    test.report.numFailedTests !== 0 ||
    test.report.numPendingTests !== 0 ||
    test.report.numTodoTests !== 0
  ) {
    throw new Error(`release gate test is not green:\n${shortOutput(test.output)}`);
  }

  const remainingResults = {};
  for (const commandName of ["check:artifact", "check:deps", "check:pack", "check:node-floor"]) {
    const result = runAgainstReleaseSnapshot(snapshot, (root) =>
      command("pnpm", [commandName], { cwd: root }),
    );
    commandExits[commandName] = result.exitCode;
    remainingResults[commandName] = result;
    if (result.exitCode !== 0) {
      throw new Error(
        `release gate ${commandName} exited ${result.exitCode}:\n${shortOutput(result.output)}`,
      );
    }
  }

  const postGatePaths = revisionInputPaths();
  assertStableReleaseRevision(preGateRevision, {
    paths: postGatePaths,
    digest: releaseRevisionDigest(postGatePaths),
  });
  assertReleaseSnapshotStable(snapshot);
  const afterStatus = scopedStatus({ allowedDirtyPaths });
  if (afterStatus !== "") {
    throw new Error(`release gates changed live scoped inputs:\n${afterStatus}`);
  }

  const dependencyFootprint = parseDependencyFootprint(
    remainingResults["check:deps"].output,
  );
  const packageConsumer = parsePackageConsumerEvidence(
    remainingResults["check:pack"].output,
  );
  const nodeFloorOutput = remainingResults["check:node-floor"].output;
  if (
    !/(?:^|\s)v22\.12\.0(?:\s|$)/u.test(nodeFloorOutput) ||
    !nodeFloorOutput.includes("PASS: the published artifact installed with npm and imported on a pinned v22.12.0")
  ) {
    throw new Error("check:node-floor omitted the pinned v22.12.0 artifact-import proof");
  }

  const release = {
    revisionDigest: snapshot.revision.digest,
    executedAt: new Date().toISOString(),
    commandExits,
    tests: {
      exitCode: test.exitCode,
      numTestFiles: test.report.numTestFiles,
      numPassedTests: test.report.numPassedTests,
      numTotalTests: test.report.numTotalTests,
      numFailedTests: test.report.numFailedTests,
      numPendingTests: test.report.numPendingTests,
      numTodoTests: test.report.numTodoTests,
    },
    artifactSurface: {
      publicNames: 75,
      publicTypes: 60,
      publicValues: 15,
    },
    dependencyFootprint,
    packageConsumer,
    nodeFloor: {
      version: "v22.12.0",
      artifactImported: true,
    },
  };
  validateReleaseEvidenceShape(release, {
    required: true,
    expectedRevisionDigest: snapshot.revision.digest,
  });
  return release;
}

function recordReleaseEvidence(evidence, release) {
  evidence.release = release;
  evidence.updatedAt = new Date().toISOString();
  validateEvidenceShape(evidence, {
    requireRelease: true,
    expectedReleaseRevision: releaseRevisionDigest(),
  });
  atomicWriteJson(EVIDENCE_PATH, evidence);
}

function verifyLedgers() {
  const { evidence } = ensureArtifacts();
  if (!verifyInputs({ quiet: true })) {
    throw new Error("immutable manifest/lock input verification failed");
  }
  verifyEvidenceGroup(evidence, "all");
  validatePackageBoundary();
  verifyNamedCasesAndWaveFiles();

  const directory = mkdtempSync(join(tmpdir(), "phase-08-ledger-"));
  try {
    const release = runReleaseGates(directory);
    recordReleaseEvidence(evidence, release);
    const validation = readFileSync(VALIDATION_PATH, "utf8");
    const security = readFileSync(SECURITY_PATH, "utf8");
    const requirements = readFileSync(REQUIREMENTS_PATH, "utf8");
    validateFinalLedgers(validation, security, requirements, evidence);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  console.log("PASS: Phase 8 mutation, input, release, task, and requirement ledgers agree");
}

function syntheticGreenRow(mutant, index = 0) {
  const hash = sha256(`target-${index}`);
  const digest = sha256(`revision-${mutant.id}-${index}`);
  return {
    ...pendingEvidenceRow(mutant),
    status: "green",
    executed: true,
    compiled: true,
    buildMarker: true,
    testsRan: 1,
    intendedFailingCaseIds: [...mutant.intendedCaseIds],
    observedFailureFingerprint: clone(mutant.expectedFailureFingerprint),
    infrastructureErrors: [],
    detectorSatisfied: true,
    killed: true,
    packagePreconditionSatisfied: mutant.detectorKind === "package",
    targetTracked: true,
    literalOccurrenceCount: 1,
    targetHashBefore: hash,
    targetHashAfter: hash,
    targetRestored: true,
    restoredGreen: true,
    scopedStatusBefore: "",
    scopedStatusAfter: "",
    liveScopeEndpointsMatch: true,
    revisionDigest: digest,
    harnessExit: 0,
    harnessOutput: "PASS: gate fired (exit 1), tree clean",
    executedAt: "2026-08-08T00:00:00.000Z",
  };
}

function validateSyntheticGreenRows(rows) {
  const digests = new Set();
  for (const [index, mutant] of MUTANTS.entries()) {
    const row = rows[index];
    validateGreenRow(row, mutant, {
      currentRevisionDigest: sha256(`revision-${mutant.id}-${index}`),
      currentTargetHash: sha256(`target-${index}`),
    });
    if (digests.has(row.revisionDigest)) {
      throw new Error(`${mutant.id}: revision digest is shared with another row`);
    }
    digests.add(row.revisionDigest);
  }
}

function changedRegister(mutator) {
  const register = clone(makeRegister());
  mutator(register);
  register.registerDigest = registerDigest(register.mutants);
  return register;
}

function syntheticReleaseEvidence() {
  return {
    revisionDigest: sha256("synthetic-release-revision"),
    executedAt: "2026-08-08T00:00:00.000Z",
    commandExits: Object.fromEntries(
      RELEASE_COMMAND_KEYS.map((commandName) => [commandName, 0]),
    ),
    tests: {
      exitCode: 0,
      numTestFiles: 20,
      numPassedTests: 427,
      numTotalTests: 427,
      numFailedTests: 0,
      numPendingTests: 0,
      numTodoTests: 0,
    },
    artifactSurface: {
      publicNames: 75,
      publicTypes: 60,
      publicValues: 15,
    },
    dependencyFootprint: {
      runtimeBytes: 0,
      moduleGraphClean: true,
    },
    packageConsumer: {
      tarEntryCount: 1,
      tarEntryDigest: sha256("synthetic-tar-entries"),
      forbiddenEntriesAbsent: true,
      foreignTypecheck: true,
      foreignRuntime: true,
    },
    nodeFloor: {
      version: "v22.12.0",
      artifactImported: true,
    },
  };
}

function selfTestInputVerifier() {
  const directory = mkdtempSync(join(tmpdir(), "phase-08-input-self-test-"));
  try {
    mkdirSync(join(directory, "packages/concierge"), { recursive: true });
    for (const [index, path] of INPUT_PATHS.entries()) {
      writeFileSync(join(directory, path), `fixture-${index}\n`, "utf8");
    }
    const evidence = { inputHashes: inputHashes(directory) };
    verifyInputEvidence(evidence, directory);

    for (const mutation of [
      (copy) => { delete copy.inputHashes["package.json"]; },
      (copy) => { copy.inputHashes["extra.json"] = "0".repeat(64); },
      (copy) => {
        copy.inputHashes.rootPackage = copy.inputHashes["package.json"];
        delete copy.inputHashes["package.json"];
      },
    ]) {
      const copy = clone(evidence);
      mutation(copy);
      assertThrows(
        () => verifyInputEvidence(copy, directory),
        /inputHashes/u,
        "input hash row shape drift",
      );
    }

    const swapped = clone(evidence);
    [swapped.inputHashes["package.json"], swapped.inputHashes["pnpm-lock.yaml"]] = [
      swapped.inputHashes["pnpm-lock.yaml"],
      swapped.inputHashes["package.json"],
    ];
    assertThrows(
      () => verifyInputEvidence(swapped, directory),
      /package\.json|pnpm-lock\.yaml/u,
      "swapped input hashes",
    );

    const stale = clone(evidence);
    stale.inputHashes["package.json"] = "0".repeat(64);
    assertThrows(
      () => verifyInputEvidence(stale, directory),
      /package\.json/u,
      "stale input hash",
    );

    rmSync(join(directory, "pnpm-lock.yaml"));
    assertThrows(
      () => verifyInputEvidence(evidence, directory),
      /pnpm-lock\.yaml/u,
      "missing input file",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function selfTestReleaseSnapshot() {
  const directory = mkdtempSync(join(tmpdir(), "phase-08-release-self-test-"));
  const sourceRoot = join(directory, "source");
  const snapshotDirectory = join(directory, "snapshot-container");
  const readmePath = "packages/concierge/README.md";
  const licensePath = "packages/concierge/LICENSE";
  const paths = Object.freeze([readmePath, licensePath]);
  const originalReadme = "release readme A\n";
  try {
    mkdirSync(join(sourceRoot, "packages/concierge"), { recursive: true });
    writeFileSync(join(sourceRoot, readmePath), originalReadme, "utf8");
    writeFileSync(join(sourceRoot, licensePath), "release license\n", "utf8");
    assert(
      REVISION_REQUIRED_PATHS.includes(readmePath) &&
        REVISION_REQUIRED_PATHS.includes(licensePath),
      "every explicitly packed document must be a required release input",
    );

    const baseline = Object.freeze({
      paths,
      digest: releaseRevisionDigest(paths, sourceRoot),
    });
    const snapshot = materializeReleaseSnapshot(snapshotDirectory, paths, {
      sourceRoot,
      installDependencies: false,
    });
    assertStableReleaseRevision(baseline, snapshot.revision);

    const directReads = [readFileSync(join(sourceRoot, readmePath), "utf8")];
    const snapshotReads = [readFileSync(join(snapshot.root, readmePath), "utf8")];
    writeFileSync(join(sourceRoot, readmePath), "release readme B\n", "utf8");
    directReads.push(readFileSync(join(sourceRoot, readmePath), "utf8"));
    snapshotReads.push(readFileSync(join(snapshot.root, readmePath), "utf8"));
    assertThrows(
      () =>
        assertStableReleaseRevision(baseline, {
          paths,
          digest: releaseRevisionDigest(paths, sourceRoot),
        }),
      /changed while gates were running/u,
      "packaged document drift",
    );

    writeFileSync(join(sourceRoot, readmePath), originalReadme, "utf8");
    directReads.push(readFileSync(join(sourceRoot, readmePath), "utf8"));
    snapshotReads.push(readFileSync(join(snapshot.root, readmePath), "utf8"));
    assert(
      new Set(directReads).size === 2,
      "A-to-B-to-A negative control must mix direct repository inputs",
    );
    assert(
      new Set(snapshotReads).size === 1 && snapshotReads[0] === originalReadme,
      "immutable snapshot must keep simulated gates on one input revision",
    );
    assertReleaseSnapshotStable(snapshot);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function selfTestMutationSnapshot() {
  const directory = mkdtempSync(join(tmpdir(), "phase-08-mutation-self-test-"));
  const sourceRoot = join(directory, "source");
  const snapshotDirectory = join(directory, "snapshot-container");
  const targetPath = "src/target.ts";
  const detectorPath = "test/detector.test.ts";
  const paths = Object.freeze([targetPath, detectorPath]);
  const originalTarget = "export const authority = 'A';\n";
  const concurrentTarget = "export const authority = 'B';\n";
  const mutant = Object.freeze({
    id: "M-SELF-TEST",
    target: targetPath,
    literalPattern: "'A'",
    replacement: "'M'",
  });
  try {
    mkdirSync(join(sourceRoot, "src"), { recursive: true });
    mkdirSync(join(sourceRoot, "test"), { recursive: true });
    writeFileSync(join(sourceRoot, targetPath), originalTarget, "utf8");
    writeFileSync(join(sourceRoot, detectorPath), "detector A\n", "utf8");
    const baselineDigest = revisionDigest(mutant, sourceRoot, paths);
    const snapshot = materializeMutationSnapshot(
      snapshotDirectory,
      mutant,
      paths,
      { sourceRoot, installDependencies: false },
    );
    assert(
      snapshot.revision.digest === baselineDigest,
      "mutation snapshot must start from the measured source bytes",
    );

    const snapshotTarget = join(snapshot.root, targetPath);
    const mutatedTarget = replaceExactOnce(
      readFileSync(snapshotTarget, "utf8"),
      mutant.literalPattern,
      mutant.replacement,
      mutant.id,
    );
    writeFileSync(snapshotTarget, mutatedTarget, "utf8");
    const snapshotGateReads = [readFileSync(snapshotTarget, "utf8")];
    const directReads = [readFileSync(join(sourceRoot, targetPath), "utf8")];

    writeFileSync(join(sourceRoot, targetPath), concurrentTarget, "utf8");
    directReads.push(readFileSync(join(sourceRoot, targetPath), "utf8"));
    snapshotGateReads.push(readFileSync(snapshotTarget, "utf8"));
    assert(
      revisionDigest(mutant, sourceRoot, paths) !== baselineDigest,
      "a concurrent source revision must not match the measured mutation digest",
    );

    writeFileSync(snapshotTarget, originalTarget, "utf8");
    assertStableMutationRevision(mutant, snapshot);
    assert(
      readFileSync(join(sourceRoot, targetPath), "utf8") === concurrentTarget,
      "snapshot restoration must not clobber a concurrent target writer",
    );

    writeFileSync(join(sourceRoot, targetPath), originalTarget, "utf8");
    directReads.push(readFileSync(join(sourceRoot, targetPath), "utf8"));
    const liveHistoryChanged = new Set(directReads).size === 2;
    const liveScopeEndpointsMatch =
      revisionDigest(mutant, sourceRoot, paths) === baselineDigest;
    assert(
      liveHistoryChanged,
      "A-to-B-to-A control must expose mixed live target bytes",
    );
    assert(
      new Set(snapshotGateReads).size === 1 &&
        snapshotGateReads[0] === mutatedTarget,
      "mutation gate reads must remain pinned to one isolated mutant revision",
    );
    assert(
      liveScopeEndpointsMatch,
      "live scoped endpoints must match after the A-to-B-to-A control",
    );
    assert(
      liveHistoryChanged && liveScopeEndpointsMatch,
      "endpoint equality must coexist with detected live-history drift and cannot prove uninterrupted live-history stability",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function selfTestReleaseSnapshotBuild() {
  const directory = mkdtempSync(join(tmpdir(), "phase-08-release-build-self-test-"));
  try {
    const paths = revisionInputPaths();
    const sourceRevision = Object.freeze({
      paths,
      digest: releaseRevisionDigest(paths),
    });
    const snapshot = materializeReleaseSnapshot(directory, paths);
    assertStableReleaseRevision(sourceRevision, snapshot.revision);
    const build = runAgainstReleaseSnapshot(snapshot, runBuild);
    assert(
      build.succeeded,
      `release snapshot self-test build failed: ${shortOutput(build.output)}`,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function verifyNamedSelectorsLive() {
  const build = runBuild();
  assert(build.succeeded, `selector pre-build failed: ${shortOutput(build.output, 2_000)}`);
  const directory = mkdtempSync(join(tmpdir(), "phase-08-selector-self-test-"));
  const seen = new Set();
  try {
    for (const mutant of MUTANTS) {
      if (mutant.detectorKind !== "vitest") continue;
      const key = JSON.stringify([mutant.intendedTestFiles, mutant.intendedCaseIds]);
      if (seen.has(key)) continue;
      seen.add(key);
      const reportPath = join(directory, `${mutant.id}.json`);
      const run = runVitest(
        mutant.intendedTestFiles,
        reportPath,
        mutant.intendedCaseIds,
      );
      if (
        run.exitCode !== 0 ||
        !exactCaseSet(run.report, mutant.intendedCaseIds, "passed") ||
        run.report.suiteErrors.length !== 0 ||
        run.report.unhandledErrors.length !== 0
      ) {
        throw new Error(
          `${mutant.id}: named selector did not select an exact nonzero green case set: ${shortOutput(run.output, 2_000)}`,
        );
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function selfTest() {
  validateDefinitions();
  const fingerprintMutant = MUTANT_BY_ID.get("M-08-G01");
  assert(fingerprintMutant !== undefined, "G01 must exist for fingerprint controls");
  const fingerprintMarker = fingerprintMutant.expectedFailureFingerprint[0]?.marker;
  assert(
    typeof fingerprintMarker === "string",
    "G01 must declare one immutable failure marker",
  );
  const markedFailureReport = {
    ...unreadableVitestReport(),
    readable: true,
    numTestFiles: 1,
    numFailedTestSuites: 1,
    numTotalTests: 1,
    numFailedTests: 1,
    assertions: [{
      caseId: "K03",
      title: "K03 — fingerprint self-test",
      status: "failed",
      failureMessages: [`AssertionError: ${fingerprintMarker}: expected false to be true`],
    }],
  };
  assert(
    exactRuntimeFailureSet(markedFailureReport, fingerprintMutant).satisfied,
    "an observed source-owned detector marker must satisfy its immutable fingerprint",
  );
  const unrelatedFailureReport = clone(markedFailureReport);
  unrelatedFailureReport.assertions[0].failureMessages = [
    "AssertionError: unrelated setup expectation failed",
  ];
  const unrelatedFingerprint = exactRuntimeFailureSet(
    unrelatedFailureReport,
    fingerprintMutant,
  );
  assert(
    !unrelatedFingerprint.satisfied &&
      unrelatedFingerprint.observed.length === 0 &&
      unrelatedFingerprint.infrastructureErrors.some((message) =>
        message.includes("RED markers=0")
      ),
    "the correct named case failing for an unrelated message must not receive detector credit",
  );
  const register = makeRegister();
  validateRegister(register);
  const initialEvidence = makeInitialEvidence();
  validateEvidenceShape(initialEvidence);
  assert(
    initialEvidence.rows.length === 48 &&
      initialEvidence.rows.every((row) => row.status === "pending"),
    "refresh fixture must contain exactly 48 pending rows",
  );
  assert(
    JSON.stringify(Object.keys(register.inputHashes).sort()) ===
      JSON.stringify([...INPUT_PATHS].sort()),
    "register must hash both manifests and pnpm-lock.yaml",
  );
  const definitionDigests = register.mutants.map((mutant) => mutant.definitionDigest);
  const mutantHashes = register.mutants.map((mutant) => mutant.mutantTargetHash);
  assert(
    new Set(definitionDigests).size === 48 && new Set(mutantHashes).size === 48,
    "every mutant must have a unique definition and mutant-target digest",
  );
  assert(
    register.mutants.every(
      (mutant) => mutant.originalTargetHash !== mutant.mutantTargetHash,
    ),
    "every mutant digest must differ from its original target digest",
  );

  const exactOnceProbe = clone(MUTANTS);
  const exactMutant = exactOnceProbe.find((mutant) => mutant.id === "M-08-G15");
  assert(exactMutant !== undefined, "G15 must exist for exact-literal controls");
  assertThrows(
    () => validateMutantList(exactOnceProbe, {
      readTarget: (target) => {
        const source = readFileSync(join(ROOT, target), "utf8");
        return target === exactMutant.target
          ? source.replace(exactMutant.literalPattern, "")
          : source;
      },
    }),
    /occurrence count is 0/u,
    "zero live literal",
  );
  assertThrows(
    () => validateMutantList(exactOnceProbe, {
      readTarget: (target) => {
        const source = readFileSync(join(ROOT, target), "utf8");
        return target === exactMutant.target
          ? `${source}\n${exactMutant.literalPattern}`
          : source;
      },
    }),
    /occurrence count is 2/u,
    "duplicate live literal",
  );

  const noOp = clone(MUTANTS);
  noOp[0].replacement = noOp[0].literalPattern;
  assertThrows(() => validateMutantList(noOp), /no-op/u, "no-op replacement");

  const duplicateRevision = clone(MUTANTS);
  duplicateRevision[1].target = duplicateRevision[0].target;
  duplicateRevision[1].literalPattern = duplicateRevision[0].literalPattern;
  duplicateRevision[1].replacement = duplicateRevision[0].replacement;
  assertThrows(
    () => validateRequiredMappings(duplicateRevision),
    /duplicate mutant revision/u,
    "duplicate mutant revision",
  );

  const missingThreat = clone(MUTANTS);
  missingThreat[0].threats = [];
  assertThrows(
    () => validateRequiredMappings(missingThreat),
    /missing threat mapping/u,
    "missing threat mapping",
  );
  const unknownThreat = clone(MUTANTS);
  unknownThreat[0].threats = ["T-08-99"];
  assertThrows(
    () => validateRequiredMappings(unknownThreat),
    /unknown threat mapping/u,
    "unknown threat mapping",
  );
  const conflictingThreat = clone(MUTANTS);
  conflictingThreat[0].threats = ["T-08-09"];
  assertThrows(
    () => validateRequiredMappings(conflictingThreat),
    /conflicting canonical mapping/u,
    "conflicting group-to-threat mapping",
  );

  const zeroSelector = clone(MUTANTS);
  zeroSelector[0].intendedCaseIds = ["Z99"];
  zeroSelector[0].expectedFailureFingerprint = [
    { caseId: "Z99", marker: failureMarkerForMutant(zeroSelector[0].id) },
  ];
  assertThrows(
    () => validateRequiredMappings(zeroSelector),
    /selector is zero|selector.*incomplete/u,
    "zero named selector",
  );

  const testTarget = clone(MUTANTS);
  testTarget[0].target = TEST_FILES.kernel;
  assertThrows(
    () => validateMutantList(testTarget, {
      readTarget: (target) =>
        target === TEST_FILES.kernel
          ? testTarget[0].literalPattern
          : readFileSync(join(ROOT, target), "utf8"),
    }),
    /test sources must never/u,
    "test-source mutation target",
  );

  const staleEvidence = clone(initialEvidence);
  staleEvidence.registerDigest = "0".repeat(64);
  assertThrows(
    () => validateEvidenceShape(staleEvidence),
    /registerDigest is stale/u,
    "stale evidence",
  );

  const greenRows = MUTANTS.map(syntheticGreenRow);
  validateSyntheticGreenRows(greenRows);
  const compileOnly = clone(greenRows);
  compileOnly[0].detectorSatisfied = false;
  assertThrows(
    () => validateSyntheticGreenRows(compileOnly),
    /detectorSatisfied/u,
    "build-only kill credit",
  );
  const buildFailure = clone(greenRows);
  buildFailure[0].compiled = false;
  buildFailure[0].buildMarker = false;
  assertThrows(
    () => validateSyntheticGreenRows(buildFailure),
    /compiled|buildMarker/u,
    "build failure kill credit",
  );
  const wrongFingerprint = clone(greenRows);
  wrongFingerprint[0].observedFailureFingerprint[0].marker = "[RED:M-08-WRONG]";
  assertThrows(
    () => validateSyntheticGreenRows(wrongFingerprint),
    /wrong detector marker/u,
    "wrong fingerprint",
  );
  const dirtyRestore = clone(greenRows);
  dirtyRestore[0].targetRestored = false;
  dirtyRestore[0].scopedStatusAfter = " M packages/concierge/src/concierge.ts";
  assertThrows(
    () => validateSyntheticGreenRows(dirtyRestore),
    /targetRestored|dirty/u,
    "dirty restoration",
  );
  const endpointDrift = clone(greenRows);
  endpointDrift[0].liveScopeEndpointsMatch = false;
  assertThrows(
    () => validateSyntheticGreenRows(endpointDrift),
    /liveScopeEndpointsMatch/u,
    "changed live endpoints",
  );
  const duplicateDigest = clone(greenRows);
  duplicateDigest[1].revisionDigest = duplicateDigest[0].revisionDigest;
  assertThrows(
    () => validateSyntheticGreenRows(duplicateDigest),
    /revision digest/u,
    "duplicate revision digest",
  );

  selfTestInputVerifier();
  selfTestMutationSnapshot();
  selfTestReleaseSnapshot();
  verifyNamedSelectorsLive();

  assertThrows(
    () => parseInvocation(["verify", "unknown"]),
    /usage/u,
    "unknown verify target",
  );
  assert(
    JSON.stringify(parseInvocation(["run", "all", "--jobs", "4"])) ===
      JSON.stringify({ kind: "run-all", jobs: 4 }),
    "run all must admit exactly four bounded disposable workers",
  );
  assertThrows(
    () => parseInvocation(["run", "all", "--jobs", "5"]),
    /usage/u,
    "worker count above four",
  );
  for (const group of ["generation", "evidence", "capability", "outcome", "package", "all"]) {
    assert(
      parseInvocation(["verify", group]).group === group,
      `verify ${group} must remain routable`,
    );
  }
  assertThrows(
    () => parseInvocation(["verify", "lifecycle"]),
    /usage/u,
    "retired verification group",
  );
  console.log(
    "PASS: Phase 8 mutation battery self-test rejected every fail-closed negative control and selected every named detector",
  );
}

class UsageError extends Error {
  constructor() {
    super("usage");
  }
}

function parseInvocation(args) {
  if (args.length === 1 && args[0] === "self-test") return { kind: "self-test" };
  if (args.length === 1 && args[0] === "refresh") return { kind: "refresh" };
  if (args.length === 2 && args[0] === "preflight") {
    return { kind: "preflight", mutantId: args[1] };
  }
  if (args.length === 4 && args[0] === "run" && args[1] === "range") {
    return { kind: "run-range", firstId: args[2], lastId: args[3] };
  }
  if (args.length === 4 && args[0] === "run" && args[1] === "all" && args[2] === "--jobs") {
    const jobs = Number(args[3]);
    if (!Number.isInteger(jobs) || jobs < 1 || jobs > 4) throw new UsageError();
    return { kind: "run-all", jobs };
  }
  if (args.length === 3 && args[0] === "gate") {
    return { kind: "gate", mutantId: args[1], directory: args[2] };
  }
  if (args.length === 3 && args[0] === "worker") {
    return { kind: "worker", mutantId: args[1], resultPath: args[2] };
  }
  if (args.length === 2 && args[0] === "verify" && args[1] === "inputs") {
    return { kind: "verify-inputs" };
  }
  if (args.length === 2 && args[0] === "verify" && args[1] === "ledgers") {
    return { kind: "verify-ledgers" };
  }
  if (
    args.length === 2 &&
    args[0] === "verify" &&
    ["generation", "evidence", "capability", "outcome", "package", "all"].includes(args[1])
  ) {
    return { kind: "verify-group", group: args[1] };
  }
  throw new UsageError();
}

async function main(args) {
  let invocation;
  try {
    invocation = parseInvocation(args);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${USAGE}\n`);
      return 64;
    }
    throw error;
  }

  if (invocation.kind === "verify-inputs") {
    return verifyInputs() ? 0 : 1;
  }
  if (invocation.kind === "gate") {
    runGate(invocation.mutantId, invocation.directory);
    return process.exitCode ?? 0;
  }
  if (invocation.kind === "worker") {
    return executeWorker(invocation.mutantId, invocation.resultPath);
  }
  if (invocation.kind === "self-test") {
    selfTest();
    return 0;
  }
  if (invocation.kind === "refresh") {
    await withMutationBatteryLock("refresh", refreshArtifacts);
    return 0;
  }
  if (invocation.kind === "preflight") {
    validateDefinitions();
    const mutant = MUTANT_BY_ID.get(invocation.mutantId);
    if (mutant === undefined) throw new Error(`unknown preflight mutant: ${invocation.mutantId}`);
    await withMutationBatteryLock("preflight", () => {
      const outcome = executeMutant(mutant, {
        allowUntrackedRunner: true,
        allowedDirtyPaths: TASK_2_WIP_PATHS,
      });
      if (outcome.error !== null) throw new Error(outcome.error);
      console.log(
        `PASS: ${mutant.id} preflight killed by ${outcome.row.testsRan} named detector(s); ` +
          `target ${outcome.row.targetHashBefore} restored ${outcome.row.targetRestored}; ` +
          `revision ${outcome.row.revisionDigest}`,
      );
    });
    return 0;
  }
  if (invocation.kind === "run-range") {
    const selected = selectMutantRange(invocation.firstId, invocation.lastId);
    await withMutationBatteryLock("run range", () => runSelected(selected));
    return 0;
  }
  if (invocation.kind === "run-all") {
    await withMutationBatteryLock("run all", () => runAll(invocation.jobs));
    return 0;
  }
  if (invocation.kind === "verify-group") {
    verifyGroup(invocation.group);
    return 0;
  }
  if (invocation.kind === "verify-ledgers") {
    await withMutationBatteryLock("verify ledgers", verifyLedgers);
    return 0;
  }
  throw new UsageError();
}

if (
  process.env.PHASE_08_SNAPSHOT_GATE === "1" ||
  (process.argv[1] !== undefined && resolve(process.argv[1]) === SCRIPT_PATH)
) {
  try {
    const exitCode = await main(process.argv.slice(2));
    if (process.exitCode === undefined) process.exitCode = exitCode;
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`${USAGE}\n`);
      process.exitCode = 64;
    } else {
      process.stderr.write(
        `FAIL: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    }
  }
}
