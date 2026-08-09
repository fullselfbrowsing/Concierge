#!/usr/bin/env node

import { spawnSync } from "node:child_process";
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
  ".planning/phases/07-session-and-the-transport-seam",
);
const REGISTER_PATH = join(PHASE_DIRECTORY, "07-MUTATION-REGISTER.json");
const EVIDENCE_PATH = join(PHASE_DIRECTORY, "07-MUTATION-EVIDENCE.json");
const VALIDATION_PATH = join(PHASE_DIRECTORY, "07-VALIDATION.md");
const REQUIREMENTS_PATH = join(ROOT, ".planning/REQUIREMENTS.md");
const CORE_PACKAGE_DIRECTORY = join(ROOT, "packages/concierge");
const BUILD_MARKER = "Build complete";
const MAX_BUFFER = 64 * 1024 * 1024;
const SCHEMA_VERSION = 2;
const USAGE = "Usage: node scripts/phase-07-mutation-battery.mjs verify inputs";

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
  catalog: "packages/concierge/test/session-catalog.test.ts",
  routing: "packages/concierge/test/session-routing.test.ts",
  lifecycle: "packages/concierge/test/session-lifecycle.test.ts",
  diagnostics: "packages/concierge/test/session-lifecycle.test.ts",
  package: "packages/concierge/test/single-instance.test.ts",
});
const SINGLE_INSTANCE_SUITE_TITLE =
  "PKG-04 — one core instance across two independently-resolved copies";
const F7_TEST_NAME_PATTERN =
  "PKG-04\\s+—\\s+one core instance across two independently-resolved copies\\s+F7\\s+—";
const F7_FAILURE_MARKER = "[RED:F7:direct-create-session-guard]";

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
  "packages/concierge/README.md",
  "packages/concierge/LICENSE",
]);
const SCOPED_PATHS = Object.freeze([
  ...new Set([
    ...REVISION_DIRECTORY_SCOPES,
    ...REVISION_REQUIRED_PATHS,
    "scripts/phase-07-mutation-battery.mjs",
    "scripts/mutate-and-prove.sh",
  ]),
]);

const REQUIRED_TASK_IDS = Object.freeze([
  "07-01-01",
  "07-01-02",
  "07-02-01",
  "07-02-02",
  "07-03-01",
  "07-03-02",
  "07-03-03",
  "07-04-01",
  "07-04-02",
  "07-05-01",
  "07-05-02",
  "07-06-01",
  "07-06-02",
  "07-06-03",
  "07-07-01",
  "07-07-02",
  "07-07-03",
]);
const REQUIRED_REQUIREMENT_IDS = Object.freeze([
  "SES-01",
  "SES-02",
  "SES-03",
  "SES-04",
  "TRN-02",
]);
const PHASE_8_HANDOFF =
  "Partial — Phase 7 delivers U01-U08 reusable no-network fixture and Session seam/package proof; Phase 8 must reuse this exact fixture to exercise the consent kernel before TRN-02 can be Complete.";
const MUTATION_DISTRIBUTION_LEDGER =
  "11 catalog / 9 routing / 8 lifecycle / 2 diagnostics / 2 package-guard (`11/9/8/2/2`)";
const MUTATION_OUTCOME_LEDGER =
  "32/32 green; zero pending, zero escaped, zero failed";
const MUTATION_SHARDS_LEDGER =
  "Exactly ten contiguous shards: C01-C03, C04-C07, C08-C11, R01-R04, R05-R08, R09-R09, L01-L04, L05-L08, D01-D02, P01-P02";

function lines(...values) {
  return values.join("\n");
}

function failureMarkerForCase(testFile, caseId) {
  if (caseId === "P01") return "[RED:P01:stub-tarball-exclusion]";
  if (caseId === "F7") return F7_FAILURE_MARKER;
  const generatedRoutingMarkers = Object.freeze({
    J15: "[RED:J15:throwing-responseid-totality]",
    J16: "[RED:J16:throwing-userturnid-totality]",
    J17: "[RED:J17:throwing-calls-totality]",
    J18: "[RED:J18:throwing-delivery-hook-totality]",
  });
  if (generatedRoutingMarkers[caseId] !== undefined) {
    return generatedRoutingMarkers[caseId];
  }
  const source = readFileSync(join(ROOT, testFile), "utf8");
  const escaped = caseId.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const matches = [
    ...source.matchAll(new RegExp(`\\[RED:${escaped}:[^\\]]+\\]`, "gu")),
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
  if (caseId.startsWith("J")) return TEST_FILES.routing;
  if (caseId.startsWith("L")) return TEST_FILES.lifecycle;
  if (caseId === "F7" || caseId === "P01") return TEST_FILES.package;
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
    intendedTestFiles,
    intendedCaseIds: Object.freeze([...intendedCaseIds]),
    expectedFailureFingerprint: Object.freeze(
      intendedCaseIds.map((caseId) =>
        Object.freeze({
          caseId,
          marker: failureMarkerForCase(
            intendedTestFile ?? testFileForCase(caseId),
            caseId,
          ),
        }),
      ),
    ),
  });
}

const MUTANTS = Object.freeze([
  runtimeMutant({
    id: "M-07-C01",
    group: "catalog",
    name: "initial catalog publication is omitted",
    literalPattern:
      "      Reflect.apply(setTools, transport, [resolved.catalog]);",
    replacement:
      "      if (lifecycle !== \"starting\") Reflect.apply(setTools, transport, [resolved.catalog]);",
    intendedCaseIds: ["C01"],
  }),
  runtimeMutant({
    id: "M-07-C02",
    group: "catalog",
    name: "connected transition no longer replays the catalog",
    literalPattern: "      Reflect.apply(setTools, transport, [catalog]);",
    replacement: "      void catalog;",
    intendedCaseIds: ["C04"],
  }),
  runtimeMutant({
    id: "M-07-C03",
    group: "catalog",
    name: "catalog reuse compares stage value instead of reference identity",
    literalPattern: "    if (resolved.catalog === publishedCatalog) {",
    replacement: "    if (resolved.stage === currentStage) {",
    intendedCaseIds: ["C03"],
  }),
  runtimeMutant({
    id: "M-07-C04",
    group: "catalog",
    name: "fixed-catalog cleanup reaches outside code before stopped state",
    literalPattern: lines(
      "        currentStage = resolved.stage;",
      "        stopNow();",
      "        throw new Error(FIXED_CATALOG_ERROR);",
    ),
    replacement: lines(
      "        currentStage = resolved.stage;",
      "        performCleanup();",
      "        throw new Error(FIXED_CATALOG_ERROR);",
    ),
    intendedCaseIds: ["C06"],
  }),
  runtimeMutant({
    id: "M-07-C05",
    group: "catalog",
    name: "queued reconciliation trusts confirmed instead of published catalog",
    literalPattern: "    if (resolved.catalog === publishedCatalog) {",
    replacement: "    if (resolved.catalog === confirmedCatalog) {",
    intendedCaseIds: ["C16"],
  }),
  runtimeMutant({
    id: "M-07-C06",
    group: "catalog",
    name: "same published catalog is aborted and republished",
    literalPattern: "    if (resolved.catalog === publishedCatalog) {",
    replacement:
      "    if (false && resolved.catalog === publishedCatalog) {",
    intendedCaseIds: ["C15"],
  }),
  runtimeMutant({
    id: "M-07-C07",
    group: "catalog",
    name: "nested transitions drain reentrantly",
    literalPattern:
      "    if (transitionDraining || lifecycle === \"stopped\") return;",
    replacement: "    if (lifecycle === \"stopped\") return;",
    intendedCaseIds: ["C10", "C11", "C15", "C16"],
  }),
  runtimeMutant({
    id: "M-07-C08",
    group: "catalog",
    name: "latest-generation checks are removed after reentrant callbacks",
    literalPattern: lines(
      "  function isCurrent(record: ContextTransition): boolean {",
      "    return (",
      "      lifecycle !== \"stopped\" &&",
      "      record.generation === requestedGeneration &&",
      "      record.context === requestedContext",
      "    );",
      "  }",
    ),
    replacement: lines(
      "  function isCurrent(_record: ContextTransition): boolean {",
      "    return lifecycle !== \"stopped\";",
      "  }",
    ),
    intendedCaseIds: ["C10", "C11", "C15", "C16"],
  }),
  runtimeMutant({
    id: "M-07-C09",
    group: "catalog",
    name: "batch pump ignores publication and transition admission gates",
    literalPattern: lines(
      "  async function runLivePump(): Promise<void> {",
      "    while (",
      "      lifecycle === \"active\" &&",
      "      !publicationPending &&",
      "      !transitionDraining &&",
      "      transitionQueue.length === 0",
      "    ) {",
      "      const work: WorkRecord | undefined = workQueue.shift();",
      "      if (work === undefined) return;",
      "      activeWork = work;",
      "      await runWork(work, true);",
      "      activeWork = null;",
      "    }",
      "  }",
      "",
      "  /** Start the single FIFO worker with its observable Promise installed first. */",
      "  function maybeStartPump(): void {",
      "    if (",
      "      lifecycle !== \"active\" ||",
      "      publicationPending ||",
      "      transitionDraining ||",
      "      transitionQueue.length !== 0 ||",
      "      workPumpRunning ||",
      "      acceptingBatchCount !== 0 ||",
      "      workQueue.length === 0",
    ),
    replacement: lines(
      "  async function runLivePump(): Promise<void> {",
      "    while (lifecycle === \"active\") {",
      "      const work: WorkRecord | undefined = workQueue.shift();",
      "      if (work === undefined) return;",
      "      activeWork = work;",
      "      await runWork(work, true);",
      "      activeWork = null;",
      "    }",
      "  }",
      "",
      "  /** Start the single FIFO worker with its observable Promise installed first. */",
      "  function maybeStartPump(): void {",
      "    if (",
      "      lifecycle !== \"active\" ||",
      "      workPumpRunning ||",
      "      workQueue.length === 0",
    ),
    intendedCaseIds: ["C11", "C12", "C13", "C14", "C15", "C16"],
  }),
  runtimeMutant({
    id: "M-07-C10",
    group: "catalog",
    name: "superseded accessor-time occurrence is not aborted",
    literalPattern: lines(
      "    if (!publicationIsCurrent(attemptToken)) return true;",
      "    if (isCurrent(record)) return false;",
      "    if (epoch !== null) abortEpoch(epoch);",
      "    clearPublication(epoch, attemptToken);",
      "    return true;",
    ),
    replacement: lines(
      "    if (!publicationIsCurrent(attemptToken)) return true;",
      "    if (isCurrent(record)) return false;",
      "    void epoch;",
      "    clearPublication(epoch, attemptToken);",
      "    return true;",
    ),
    intendedCaseIds: ["C17"],
  }),
  runtimeMutant({
    id: "M-07-C11",
    group: "catalog",
    name: "superseded unpublished accessor attempt is not cleared",
    literalPattern: lines(
      "    if (!publicationIsCurrent(attemptToken)) return true;",
      "    if (isCurrent(record)) return false;",
      "    if (epoch !== null) abortEpoch(epoch);",
      "    clearPublication(epoch, attemptToken);",
      "    return true;",
    ),
    replacement: lines(
      "    if (!publicationIsCurrent(attemptToken)) return true;",
      "    if (isCurrent(record)) return false;",
      "    if (epoch !== null) abortEpoch(epoch);",
      "    void attemptToken;",
      "    return true;",
    ),
    intendedCaseIds: ["C17"],
  }),

  runtimeMutant({
    id: "M-07-R01",
    group: "routing",
    name: "a second batch pump may start",
    literalPattern: "      workPumpRunning ||",
    replacement: "      false ||",
    intendedCaseIds: ["J01"],
  }),
  runtimeMutant({
    id: "M-07-R02",
    group: "routing",
    name: "dispatch reads context at execution rather than arrival",
    literalPattern:
      "      const rows = await concierge.dispatchBatch(work.context, envelopeFor(work));",
    replacement:
      "      const rows = await concierge.dispatchBatch(confirmedContext as StageContext, envelopeFor(work));",
    intendedCaseIds: ["J07"],
  }),
  runtimeMutant({
    id: "M-07-R03",
    group: "routing",
    name: "active old-epoch work is not aborted",
    literalPattern:
      "    for (const work of [...epoch.work]) work.cancellation.abort();",
    replacement: lines(
      "    for (const work of [...epoch.work]) {",
      "      if (work !== activeWork) work.cancellation.abort();",
      "    }",
    ),
    intendedCaseIds: ["J09"],
  }),
  runtimeMutant({
    id: "M-07-R04",
    group: "routing",
    name: "queued and held old-epoch work is not aborted",
    literalPattern:
      "    for (const work of [...epoch.work]) work.cancellation.abort();",
    replacement: lines(
      "    for (const work of [...epoch.work]) {",
      "      if (work === activeWork) work.cancellation.abort();",
      "    }",
    ),
    intendedCaseIds: ["J10", "C11"],
  }),
  runtimeMutant({
    id: "M-07-R05",
    group: "routing",
    name: "envelope forwards only the transport cancellation signal",
    literalPattern: lines(
      "      signal: {",
      "        enumerable: true,",
      "        get(): AbortSignalLike {",
      "          return work.cancellation.signal;",
      "        },",
      "      },",
    ),
    replacement: lines(
      "      signal: {",
      "        enumerable: true,",
      "        get(): AbortSignalLike {",
      "          return work.sourceBatch.signal ?? work.cancellation.signal;",
      "        },",
      "      },",
    ),
    intendedCaseIds: ["J11", "J12"],
  }),
  runtimeMutant({
    id: "M-07-R06",
    group: "routing",
    name: "one accepted aborted queued occurrence bypasses dispatch",
    literalPattern: lines(
      "  async function runWork(work: WorkRecord, allowResponses: boolean): Promise<void> {",
      "    try {",
      "      const rows = await concierge.dispatchBatch(work.context, envelopeFor(work));",
    ),
    replacement: lines(
      "  async function runWork(work: WorkRecord, allowResponses: boolean): Promise<void> {",
      "    try {",
      "      const firstCall = work.sourceBatch.calls[0];",
      "      if (work.epoch.aborted && firstCall !== undefined) {",
      "        transport.respond(firstCall.callId, Object.freeze({",
      "          ok: false,",
      "          reason: \"aborted\",",
      "          message: \"The action was cancelled before it ran.\",",
      "        }));",
      "        return;",
      "      }",
      "      const rows = await concierge.dispatchBatch(work.context, envelopeFor(work));",
    ),
    intendedCaseIds: ["J10"],
  }),
  runtimeMutant({
    id: "M-07-R07",
    group: "routing",
    name: "one accepted occurrence is dispatched twice",
    literalPattern: "      await runWork(work, true);",
    replacement: lines(
      "      await runWork(work, true);",
      "      await runWork(work, true);",
    ),
    intendedCaseIds: ["J02"],
  }),
  runtimeMutant({
    id: "M-07-R08",
    group: "routing",
    name: "a failed response is retried",
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
  }),
  runtimeMutant({
    id: "M-07-R09",
    group: "routing",
    name: "descriptor-backed envelope is replaced by an eager spread",
    literalPattern: lines(
      "  /** Preserve every original envelope member and replace only its signal. */",
      "  function envelopeFor(work: WorkRecord): ToolBatch {",
      "    const envelope: ToolBatch = Object.create(null) as ToolBatch;",
      "    Object.defineProperties(envelope, {",
      "      responseId: {",
      "        enumerable: true,",
      "        get(): string {",
      "          return work.sourceBatch.responseId;",
      "        },",
      "      },",
      "      userTurnId: {",
      "        enumerable: true,",
      "        get(): string | undefined {",
      "          return work.sourceBatch.userTurnId;",
      "        },",
      "      },",
      "      calls: {",
      "        enumerable: true,",
      "        get(): ToolBatch[\"calls\"] {",
      "          return work.sourceBatch.calls;",
      "        },",
      "      },",
      "      signal: {",
      "        enumerable: true,",
      "        get(): AbortSignalLike {",
      "          return work.cancellation.signal;",
      "        },",
      "      },",
      "      deferUntilDelivered: {",
      "        enumerable: true,",
      "        get(): ToolBatch[\"deferUntilDelivered\"] {",
      "          return work.sourceBatch.deferUntilDelivered;",
      "        },",
      "      },",
      "    });",
      "    return Object.freeze(envelope);",
      "  }",
    ),
    replacement: lines(
      "  /** Preserve every original envelope member and replace only its signal. */",
      "  function envelopeFor(work: WorkRecord): ToolBatch {",
      "    return Object.freeze({",
      "      ...work.sourceBatch,",
      "      signal: work.cancellation.signal,",
      "    });",
      "  }",
    ),
    intendedCaseIds: ["J15", "J16", "J17", "J18"],
  }),

  runtimeMutant({
    id: "M-07-L01",
    group: "lifecycle",
    name: "repeated stop allocates a fresh Promise",
    literalPattern: "    if (stopPromise !== null) return stopPromise;",
    replacement:
      "    if (stopPromise !== null) return stopPromise.then(() => undefined);",
    intendedCaseIds: ["L01"],
  }),
  runtimeMutant({
    id: "M-07-L02",
    group: "lifecycle",
    name: "stopped and token invalidation occur after outside cleanup",
    literalPattern: lines(
      "    stopPromise = promise;",
      "    resolveStopPromise = resolve;",
      "    lifecycle = \"stopped\";",
    ),
    replacement: lines(
      "    stopPromise = promise;",
      "    resolveStopPromise = resolve;",
      "    performCleanup();",
      "    lifecycle = \"stopped\";",
    ),
    intendedCaseIds: ["L01", "L05", "C08", "C09", "C13", "C14"],
  }),
  runtimeMutant({
    id: "M-07-L03",
    group: "lifecycle",
    name: "response rows continue after stop",
    literalPattern: lines(
      "          const result = row.result;",
      "          if (!allowResponses || lifecycle !== \"active\") break;",
      "          Reflect.apply(respond, transport, [callId, result]);",
    ),
    replacement: lines(
      "          const result = row.result;",
      "          if (!allowResponses) break;",
      "          Reflect.apply(respond, transport, [callId, result]);",
    ),
    intendedCaseIds: ["L17", "L18"],
  }),
  runtimeMutant({
    id: "M-07-L04",
    group: "lifecycle",
    name: "cleanup resurrects the session for recursive output",
    literalPattern: lines(
      "    try {",
      "      transport.setTools(EMPTY_CATALOG);",
      "    } catch {",
      "      diagnose(\"catalog_clear_failed\");",
      "    }",
      "  }",
    ),
    replacement: lines(
      "    try {",
      "      transport.setTools(EMPTY_CATALOG);",
      "    } catch {",
      "      diagnose(\"catalog_clear_failed\");",
      "    }",
      "    lifecycle = \"active\";",
      "  }",
    ),
    intendedCaseIds: ["L05", "L08", "L13"],
  }),
  runtimeMutant({
    id: "M-07-L05",
    group: "lifecycle",
    name: "nested stage notification recurses instead of queueing",
    literalPattern: lines(
      "    transitionQueue.push({",
      "      kind: \"context\",",
      "      generation,",
      "      context,",
      "      resolved: null,",
      "    });",
      "    drainTransitions();",
    ),
    replacement: lines(
      "    const transition: ContextTransition = {",
      "      kind: \"context\",",
      "      generation,",
      "      context,",
      "      resolved: null,",
      "    };",
      "    if (stageNotifying) {",
      "      stageNotifying = false;",
      "      processContext(transition);",
      "      return;",
      "    }",
      "    transitionQueue.push(transition);",
      "    drainTransitions();",
    ),
    intendedCaseIds: ["L11"],
  }),
  runtimeMutant({
    id: "M-07-L06",
    group: "lifecycle",
    name: "stage unsubscription is keyed by callback identity",
    literalPattern: lines(
      "    return (): void => {",
      "      if (stageListeners.get(token) === callback) stageListeners.delete(token);",
      "    };",
    ),
    replacement: lines(
      "    return (): void => {",
      "      for (const [candidate, listener] of stageListeners) {",
      "        if (listener === callback) stageListeners.delete(candidate);",
      "      }",
      "    };",
    ),
    intendedCaseIds: ["L09"],
  }),
  runtimeMutant({
    id: "M-07-L07",
    group: "lifecycle",
    name: "accepted detached work is discarded instead of drained",
    literalPattern: "    detachedWork.push(...workQueue.splice(0));",
    replacement: "    workQueue.splice(0);",
    intendedCaseIds: ["L04", "C13", "C14"],
  }),
  runtimeMutant({
    id: "M-07-L08",
    group: "lifecycle",
    name: "stage notification iterates the live listener collection",
    literalPattern: lines(
      "        const snapshot: ReadonlyArray<(stage: string | null) => void> = [",
      "          ...stageListeners.values(),",
      "        ];",
    ),
    replacement: lines(
      "        const snapshot: Iterable<(stage: string | null) => void> =",
      "          stageListeners.values();",
    ),
    intendedCaseIds: ["L10"],
  }),

  runtimeMutant({
    id: "M-07-D01",
    group: "diagnostics",
    name: "caught dispatch detail is interpolated into a diagnostic",
    literalPattern: lines(
      "    } catch {",
      "      diagnose(\"batch_dispatch_failed\");",
      "    } finally {",
    ),
    replacement: lines(
      "    } catch (error) {",
      "      const unsafeDiagnostic: SessionDiagnostic = Object.freeze({",
      "        code: \"batch_dispatch_failed\",",
      "        message: String(error),",
      "      });",
      "      if (onDiagnostic !== undefined) {",
      "        try { onDiagnostic(unsafeDiagnostic); } catch {}",
      "      } else {",
      "        try { warnHost(`concierge: [batch_dispatch_failed] ${String(error)}`); } catch {}",
      "      }",
      "    } finally {",
    ),
    intendedCaseIds: ["L14"],
  }),
  runtimeMutant({
    id: "M-07-D02",
    group: "diagnostics",
    name: "replacement diagnostic hook may escape response routing",
    literalPattern: lines(
      "    if (onDiagnostic !== undefined) {",
      "      try {",
      "        onDiagnostic(diagnostic);",
      "      } catch {",
      "        // A diagnostic replacement is contained and is never echoed elsewhere.",
      "      }",
      "      return;",
      "    }",
    ),
    replacement: lines(
      "    if (onDiagnostic !== undefined) {",
      "      if (code === \"response_failed\") {",
      "        onDiagnostic(diagnostic);",
      "        return;",
      "      }",
      "      try {",
      "        onDiagnostic(diagnostic);",
      "      } catch {",
      "        // A diagnostic replacement is contained and is never echoed elsewhere.",
      "      }",
      "      return;",
      "    }",
    ),
    intendedCaseIds: ["L15"],
  }),

  runtimeMutant({
    id: "M-07-P01",
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
    intendedCaseIds: ["P01"],
    intendedTestFile: TEST_FILES.package,
    detectorKind: "package",
  }),
  runtimeMutant({
    id: "M-07-P02",
    group: "package",
    name: "createSession direct single-instance guard is removed",
    literalPattern: "  assertSingleInstance();",
    replacement: "  void assertSingleInstance;",
    intendedCaseIds: ["F7"],
    intendedTestFile: TEST_FILES.package,
  }),
]);

export const EXPECTED_CATALOG_IDS = Object.freeze(
  Array.from({ length: 11 }, (_, index) =>
    `M-07-C${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_ROUTING_IDS = Object.freeze(
  Array.from({ length: 9 }, (_, index) =>
    `M-07-R${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_LIFECYCLE_IDS = Object.freeze(
  Array.from({ length: 8 }, (_, index) =>
    `M-07-L${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_DIAGNOSTIC_IDS = Object.freeze(
  Array.from({ length: 2 }, (_, index) =>
    `M-07-D${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_PACKAGE_IDS = Object.freeze(
  Array.from({ length: 2 }, (_, index) =>
    `M-07-P${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_M07_IDS = Object.freeze([
  ...EXPECTED_CATALOG_IDS,
  ...EXPECTED_ROUTING_IDS,
  ...EXPECTED_LIFECYCLE_IDS,
  ...EXPECTED_DIAGNOSTIC_IDS,
  ...EXPECTED_PACKAGE_IDS,
]);

const EXPECTED_IDS_BY_GROUP = Object.freeze({
  catalog: EXPECTED_CATALOG_IDS,
  routing: EXPECTED_ROUTING_IDS,
  lifecycle: EXPECTED_LIFECYCLE_IDS,
  diagnostics: EXPECTED_DIAGNOSTIC_IDS,
  package: EXPECTED_PACKAGE_IDS,
});
const MUTANT_BY_ID = new Map(MUTANTS.map((mutant) => [mutant.id, mutant]));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function registerDigest(mutants = MUTANTS) {
  return sha256(JSON.stringify(mutants));
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

function withExclusivePathLock(lockPath, operation, run) {
  let descriptor;
  let locked = false;
  try {
    descriptor = openSync(lockPath, "a+");
    locked = tryLock(descriptor);
    if (!locked) {
      throw new Error(`${operation}: mutation battery is already running`);
    }
    return run();
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
    "phase-07-mutation-battery.lock",
  );
}

function withMutationBatteryLock(operation, run) {
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

function validateRequiredMappings(mutants) {
  const byId = new Map(mutants.map((mutant) => [mutant.id, mutant]));
  const exactMappings = Object.freeze({
    "M-07-C01": ["C01"],
    "M-07-C02": ["C04"],
    "M-07-C03": ["C03"],
    "M-07-C04": ["C06"],
    "M-07-C05": ["C16"],
    "M-07-C06": ["C15"],
    "M-07-C07": ["C10", "C11", "C15", "C16"],
    "M-07-C08": ["C10", "C11", "C15", "C16"],
    "M-07-C09": ["C11", "C12", "C13", "C14", "C15", "C16"],
    "M-07-C10": ["C17"],
    "M-07-C11": ["C17"],
    "M-07-R01": ["J01"],
    "M-07-R02": ["J07"],
    "M-07-R03": ["J09"],
    "M-07-R04": ["J10", "C11"],
    "M-07-R05": ["J11", "J12"],
    "M-07-R06": ["J10"],
    "M-07-R07": ["J02"],
    "M-07-R08": ["J04"],
    "M-07-R09": ["J15", "J16", "J17", "J18"],
    "M-07-L01": ["L01"],
    "M-07-L02": ["L01", "L05", "C08", "C09", "C13", "C14"],
    "M-07-L03": ["L17", "L18"],
    "M-07-L04": ["L05", "L08", "L13"],
    "M-07-L05": ["L11"],
    "M-07-L06": ["L09"],
    "M-07-L07": ["L04", "C13", "C14"],
    "M-07-L08": ["L10"],
    "M-07-D01": ["L14"],
    "M-07-D02": ["L15"],
    "M-07-P01": ["P01"],
    "M-07-P02": ["F7"],
  });

  for (const [id, intendedCaseIds] of Object.entries(exactMappings)) {
    const mutant = byId.get(id);
    if (
      mutant === undefined ||
      JSON.stringify(mutant.intendedCaseIds) !== JSON.stringify(intendedCaseIds)
    ) {
      throw new Error(
        `${id}: intendedCaseIds must equal ${JSON.stringify(intendedCaseIds)}`,
      );
    }
  }

  const c05 = byId.get("M-07-C05");
  const c06 = byId.get("M-07-C06");
  const c10 = byId.get("M-07-C10");
  const c11 = byId.get("M-07-C11");
  const l02 = byId.get("M-07-L02");
  const l05 = byId.get("M-07-L05");
  if (
    c05?.replacement !== "    if (resolved.catalog === confirmedCatalog) {" ||
    !c05.literalPattern.includes("publishedCatalog")
  ) {
    throw new Error("M-07-C05 must compare queued reconciliation against confirmedCatalog");
  }
  if (
    !c06?.literalPattern.includes("publishedCatalog") ||
    !c06?.replacement.includes("false && resolved.catalog === publishedCatalog")
  ) {
    throw new Error("M-07-C06 must force republish of the already-published catalog");
  }
  if (
    !c10?.literalPattern.includes("if (epoch !== null) abortEpoch(epoch);") ||
    !c10.literalPattern.includes("clearPublication(epoch, attemptToken);") ||
    c10.replacement.includes("abortEpoch(epoch)") ||
    !c10.replacement.includes("clearPublication(epoch, attemptToken)")
  ) {
    throw new Error(
      "M-07-C10 must omit only the superseded attempt abort",
    );
  }
  if (
    !c11?.literalPattern.includes("if (epoch !== null) abortEpoch(epoch);") ||
    !c11.literalPattern.includes("clearPublication(epoch, attemptToken);") ||
    !c11.replacement.includes("abortEpoch(epoch)") ||
    c11.replacement.includes("clearPublication(epoch, attemptToken)")
  ) {
    throw new Error(
      "M-07-C11 must omit only the superseded attempt clear",
    );
  }
  for (const displacedCase of ["C08", "C09", "C13", "C14"]) {
    if (!l02?.intendedCaseIds.includes(displacedCase)) {
      throw new Error(`M-07-L02 must retain displaced stop-order detector ${displacedCase}`);
    }
  }
  if (
    !l05?.literalPattern.includes("transitionQueue.push({") ||
    !l05.literalPattern.includes("drainTransitions();") ||
    !l05.replacement.includes("if (stageNotifying) {") ||
    !l05.replacement.includes("processContext(transition);") ||
    l05.replacement.includes("transitionDraining =")
  ) {
    throw new Error(
      "M-07-L05 must recurse only at the nested setContext enqueue/drain seam",
    );
  }
  const forbiddenStopTarget = "failPublication(resolved.stage)";
  if (
    c05?.literalPattern.includes(forbiddenStopTarget) ||
    c06?.literalPattern.includes(forbiddenStopTarget)
  ) {
    throw new Error("M-07-C05/C06 must target actual-published reconciliation, not late stop");
  }

  const independentIds = [
    "M-07-C05",
    "M-07-C06",
    "M-07-C07",
    "M-07-C08",
    "M-07-C09",
    "M-07-C10",
    "M-07-C11",
    "M-07-R09",
  ];
  const identities = independentIds.map((id) => {
    const mutant = byId.get(id);
    return `${mutant?.literalPattern}\0${mutant?.replacement}`;
  });
  if (new Set(identities).size !== independentIds.length) {
    throw new Error("replacement-identity/reentrancy/admission/lazy-read mutants must be independent");
  }
}

function validateMutantList(
  mutants,
  {
    expectedIds = EXPECTED_M07_IDS,
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

  const expectedCounts = { catalog: 11, routing: 9, lifecycle: 8, diagnostics: 2, package: 2 };
  for (const [group, count] of Object.entries(expectedCounts)) {
    if (mutants.filter((mutant) => mutant.group === group).length !== count) {
      throw new Error(`${group}: mutant count must equal ${count}`);
    }
  }

  for (const mutant of mutants) {
    if (!targetExists(mutant.target)) {
      throw new Error(`${mutant.id}: target does not exist: ${mutant.target}`);
    }
    if (!targetTracked(mutant.target)) {
      throw new Error(`${mutant.id}: target is not tracked: ${mutant.target}`);
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
  return {
    schemaVersion: SCHEMA_VERSION,
    phase: "07-session-and-the-transport-seam",
    expectedCatalogIds: EXPECTED_CATALOG_IDS,
    expectedRoutingIds: EXPECTED_ROUTING_IDS,
    expectedLifecycleIds: EXPECTED_LIFECYCLE_IDS,
    expectedDiagnosticIds: EXPECTED_DIAGNOSTIC_IDS,
    expectedPackageIds: EXPECTED_PACKAGE_IDS,
    expectedIds: EXPECTED_M07_IDS,
    registerDigest: registerDigest(),
    mutants: MUTANTS,
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
    scopedTreeClean: false,
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
    phase: "07-session-and-the-transport-seam",
    registerDigest: registerDigest(),
    expectedIds: EXPECTED_M07_IDS,
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
}

function validateEvidenceShape(
  evidence,
  { requireRelease = false, expectedReleaseRevision = undefined } = {},
) {
  validateExactObjectKeys(evidence, EVIDENCE_KEYS, "evidence");
  if (evidence.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`evidence schemaVersion must equal ${SCHEMA_VERSION}`);
  }
  if (evidence.phase !== "07-session-and-the-transport-seam") {
    throw new Error("evidence phase is invalid");
  }
  if (evidence.registerDigest !== registerDigest()) {
    throw new Error("evidence registerDigest is stale");
  }
  if (JSON.stringify(evidence.expectedIds) !== JSON.stringify(EXPECTED_M07_IDS)) {
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
  if (JSON.stringify(rowIds) !== JSON.stringify(EXPECTED_M07_IDS)) {
    throw new Error("evidence rows are missing, duplicated, reordered, or extra");
  }
  for (const [index, mutant] of MUTANTS.entries()) {
    const row = evidence.rows[index];
    if (
      row.group !== mutant.group ||
      row.target !== mutant.target ||
      row.detectorKind !== mutant.detectorKind ||
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
  if (!existsSync(path)) {
    throw new InputEvidenceMalformed("evidence file is missing");
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
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
  const evidence = makeInitialEvidence();
  atomicWriteJson(REGISTER_PATH, register);
  atomicWriteJson(EVIDENCE_PATH, evidence);
  console.log(
    `PASS: refreshed ${EXPECTED_M07_IDS.length} pending Phase 7 mutation rows — register ${register.registerDigest}`,
  );
}

function ensureArtifacts() {
  validateDefinitions();
  if (!existsSync(REGISTER_PATH) || !existsSync(EVIDENCE_PATH)) {
    throw new Error("mutation artifacts are missing; run refresh first");
  }
  const register = JSON.parse(readFileSync(REGISTER_PATH, "utf8"));
  const evidence = JSON.parse(readFileSync(EVIDENCE_PATH, "utf8"));
  validateRegister(register);
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
  return `^(?:${caseIds
    .map((caseId) =>
      caseId === "F7" ? F7_TEST_NAME_PATTERN : `\\[${caseId}\\]`,
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
  const bracketed = /^\[([CJL]\d{2})\]/u.exec(title);
  if (bracketed !== null) return bracketed[1];
  return /^F7\s+—/u.test(title) ? "F7" : null;
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
  const observed = report.assertions
    .map((assertion) => assertion.caseId)
    .filter((caseId) => caseId !== null)
    .sort();
  return (
    report.readable &&
    report.numTotalTests > 0 &&
    report.numPendingTests === 0 &&
    JSON.stringify(observed) === JSON.stringify(intended) &&
    report.assertions.every((assertion) => assertion.status === expectedStatus)
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
    const markers = messages.flatMap((message) => [
      ...message.matchAll(/\[RED:(?:[CJL]\d{2}|F7):[^\]]+\]/gu),
    ].map((match) => match[0]));
    if (messages.length !== 1) {
      errors.push(`${assertion.caseId ?? assertion.title}: failureMessages=${messages.length}`);
    }
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
  const marker = "[RED:P01:stub-tarball-exclusion]";
  const markerCount = detector.output.split(marker).length - 1;
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
      ? [{ caseId: "P01", marker }]
      : [],
    infrastructureErrors: [],
    detectorSatisfied,
  };
  writeGateResult(directory, gate);
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
  gate.testsRan = vitest.report.numTotalTests;
  gate.vitestOutput = shortOutput(vitest.output);
  gate.observedFailureFingerprint = fingerprint.observed;
  gate.infrastructureErrors = fingerprint.infrastructureErrors;
  gate.detectorSatisfied =
    vitest.exitCode !== 0 && vitest.signal === null && fingerprint.satisfied;
  writeGateResult(directory, gate);
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

function scopedStatus() {
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
  return result.stdout.trim();
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

function revisionInputPaths() {
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
  assertNoUntrackedRevisionInputs(
    [...new Set(untracked.stdout.split("\0").filter(Boolean))]
      .filter((path) => !isInstalledDependencyPath(path))
      .sort(),
  );
  const paths = [...new Set(tracked.stdout.split("\0").filter(Boolean))].sort();
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
  digest.update("phase-07-release\0");
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

function executeMutant(mutant) {
  const beforeStatus = scopedStatus();
  if (beforeStatus !== "") {
    throw new Error(
      `${mutant.id}: scoped source/test/type/lockfile tree is dirty before mutation:\n${beforeStatus}`,
    );
  }
  const paths = revisionInputPaths();
  const liveSource = readFileSync(join(ROOT, mutant.target), "utf8");
  const sourceBytes = Buffer.from(liveSource);
  const occurrenceCount = liveSource.split(mutant.literalPattern).length - 1;
  const tracked =
    command("git", ["ls-files", "--error-unmatch", mutant.target]).exitCode === 0;
  const measuredRevisionDigest = revisionDigest(mutant, ROOT, paths);
  const directory = mkdtempSync(join(tmpdir(), "phase-07-mutation-"));

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
          join(snapshot.root, "scripts/phase-07-mutation-battery.mjs"),
          "gate",
          mutant.id,
          directory,
        ],
        {
          cwd: snapshot.root,
          env: { ...process.env, PHASE_07_SNAPSHOT_GATE: "1" },
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
    const afterStatus = scopedStatus();
    const afterPaths = revisionInputPaths();
    const liveRevisionStable =
      JSON.stringify(afterPaths) === JSON.stringify(paths) &&
      revisionDigest(mutant, ROOT, afterPaths) === measuredRevisionDigest;
    const scopedTreeClean =
      beforeStatus === "" && afterStatus === "" && liveRevisionStable;
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
      killed && targetRestored && restored.green && scopedTreeClean
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
      scopedTreeClean,
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
            scopedTreeClean,
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
  const firstIndex = EXPECTED_M07_IDS.indexOf(firstId);
  const lastIndex = EXPECTED_M07_IDS.indexOf(lastId);
  if (firstIndex === -1 || lastIndex === -1) {
    throw new Error(`unknown mutation range endpoint: ${firstId}..${lastId}`);
  }
  if (firstIndex > lastIndex) {
    throw new Error(`mutation range is reversed: ${firstId}..${lastId}`);
  }
  const selected = EXPECTED_M07_IDS.slice(firstIndex, lastIndex + 1).map((id) =>
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
    "scopedTreeClean",
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
  const ids = group === "all" ? EXPECTED_M07_IDS : EXPECTED_IDS_BY_GROUP[group];
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
    "stub-transport|test/fixtures",
    "[RED:P01:stub-tarball-exclusion]",
  ]) {
    if (!packScript.includes(token)) {
      throw new Error(`package exclusion detector drifted: missing ${token}`);
    }
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
    `\\*\\*Approval:\\*\\* approved \\d{4}-\\d{2}-\\d{2} — register ${registerDigestValue}; 32/32 green; release gate green`,
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
      "Each target was restored, the restored gate passed, the scoped worktree was clean, and no infrastructure error was recorded",
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

function validateFinalLedgers(validationText, requirementsText, evidence) {
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
  for (const requirementId of ["SES-01", "SES-02", "SES-03", "SES-04"]) {
    if (!new RegExp(`- \\[x\\] \\*\\*${requirementId}\\*\\*`, "u").test(requirementsText)) {
      throw new Error(`${requirementId}: requirement checkbox is not complete`);
    }
    const traceRow = requirementsText
      .split(/\r?\n/u)
      .find((line) => line.startsWith(`| ${requirementId} |`));
    if (traceRow === undefined || !traceRow.includes("Complete")) {
      throw new Error(`${requirementId}: traceability row is not complete`);
    }
  }
  if (!/- \[ \] \*\*TRN-02\*\*/u.test(requirementsText)) {
    throw new Error("TRN-02 must remain unchecked");
  }
  const transportTrace = requirementsText
    .split(/\r?\n/u)
    .find((line) => line.startsWith("| TRN-02 |"));
  if (
    transportTrace === undefined ||
    !transportTrace.includes(PHASE_8_HANDOFF) ||
    /\|\s*Complete(?:\s|\|)/u.test(transportTrace)
  ) {
    throw new Error("TRN-02 must retain the exact pending Phase 8 consent-kernel handoff");
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
        `Exit ${commandExits["check:artifact"]}; callable artifact and exact public declaration surface of 69 names / 54 types / 15 values`,
      ],
      [
        "Direct guard",
        "F7 passed and P02 killed exactly the direct `createSession` single-instance guard",
      ],
      [
        "`pnpm check:deps`",
        `Exit ${commandExits["check:deps"]}; dependency contribution is zero bytes`,
      ],
      [
        "`pnpm check:pack`",
        `Exit ${commandExits["check:pack"]}; foreign tarball install, typecheck with \`exactOptionalPropertyTypes\`, and runtime import of \`createSession\`/public types passed; the test-only stub fixture is absent from the tarball`,
      ],
      [
        "`pnpm check:node-floor`",
        `Exit ${commandExits["check:node-floor"]} under Node v22.12.0`,
      ],
    ]),
    "Measured Release Evidence",
  );
}

function verifyNamedCasesAndWaveFiles({
  pathExists = (path) => existsSync(join(ROOT, path)),
  readSource = (path) => readFileSync(join(ROOT, path), "utf8"),
} = {}) {
  const expectedFiles = [
    "packages/concierge/test-d/session.test-d.ts",
    "packages/concierge/test-d/transport.test-d.ts",
    "packages/concierge/test/fixtures/stub-transport.ts",
    "packages/concierge/test-d/stub-transport.test-d.ts",
    "packages/concierge/test/session-catalog.test.ts",
    "packages/concierge/test/session-routing.test.ts",
    "packages/concierge/test/session-lifecycle.test.ts",
    "packages/concierge/test/stub-transport.test.ts",
    "packages/concierge/test/artifact.test.ts",
    "packages/concierge/test/export-surface.test.ts",
    "packages/concierge/test/single-instance.test.ts",
    "packages/concierge/test/fixtures/probe.ts",
    "scripts/pack-install-check.sh",
    "scripts/phase-07-mutation-battery.mjs",
  ];
  for (const path of expectedFiles) {
    if (!pathExists(path)) throw new Error(`Wave 0 file is missing: ${path}`);
  }
  const markerFiles = [
    [TEST_FILES.catalog, Array.from({ length: 17 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`)],
    [TEST_FILES.routing, Array.from({ length: 18 }, (_, index) => `J${String(index + 1).padStart(2, "0")}`)],
    [TEST_FILES.lifecycle, Array.from({ length: 18 }, (_, index) => `L${String(index + 1).padStart(2, "0")}`)],
    ["packages/concierge/test/stub-transport.test.ts", Array.from({ length: 8 }, (_, index) => `U${String(index + 1).padStart(2, "0")}`)],
  ];
  for (const [path, ids] of markerFiles) {
    const source = readSource(path);
    for (const id of ids) {
      const generatedRoutingCase = /^J(15|16|17|18)$/u.exec(id);
      const present =
        source.includes(`[RED:${id}:`) ||
        (generatedRoutingCase !== null &&
          source.includes(`registerHostileParityTest("${generatedRoutingCase[1]}"`));
      if (!present) {
        throw new Error(`${path}: missing named RED marker ${id}`);
      }
    }
  }
  const singleInstance = readSource(TEST_FILES.package);
  if (!singleInstance.includes("F7 — createSession records this copy through its own direct guard call")) {
    throw new Error("single-instance suite is missing F7");
  }
  if (!singleInstance.includes(F7_FAILURE_MARKER)) {
    throw new Error("single-instance suite is missing the exact F7 RED marker");
  }
}

function runReleaseGates(directory) {
  const commandExits = {};
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

  for (const commandName of [
    "check:artifact",
    "check:deps",
    "check:pack",
    "check:node-floor",
  ]) {
    const result = runAgainstReleaseSnapshot(snapshot, (root) =>
      command("pnpm", [commandName], { cwd: root }),
    );
    commandExits[commandName] = result.exitCode;
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

  const directory = mkdtempSync(join(tmpdir(), "phase-07-ledger-"));
  try {
    const release = runReleaseGates(directory);
    recordReleaseEvidence(evidence, release);
    const validation = readFileSync(VALIDATION_PATH, "utf8");
    const requirements = readFileSync(REQUIREMENTS_PATH, "utf8");
    validateFinalLedgers(validation, requirements, evidence);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  console.log("PASS: Phase 7 mutation, input, release, task, and requirement ledgers agree");
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
    scopedTreeClean: true,
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
      numTestFiles: 15,
      numPassedTests: 296,
      numTotalTests: 296,
      numFailedTests: 0,
      numPendingTests: 0,
      numTodoTests: 0,
    },
  };
}

function selfTestInputVerifier() {
  const directory = mkdtempSync(join(tmpdir(), "phase-07-input-self-test-"));
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
  const directory = mkdtempSync(join(tmpdir(), "phase-07-release-self-test-"));
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
  const directory = mkdtempSync(join(tmpdir(), "phase-07-mutation-self-test-"));
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
    assert(
      new Set(directReads).size === 2,
      "A-to-B-to-A control must expose mixed live target bytes",
    );
    assert(
      new Set(snapshotGateReads).size === 1 &&
        snapshotGateReads[0] === mutatedTarget,
      "mutation gate reads must remain pinned to one isolated mutant revision",
    );
    assert(
      revisionDigest(mutant, sourceRoot, paths) === baselineDigest,
      "restored live bytes may match only their own measured revision",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function selfTestReleaseSnapshotBuild() {
  const directory = mkdtempSync(join(tmpdir(), "phase-07-release-build-self-test-"));
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

function simulateResponseCutoff(caseId, enforceLifecycleCheck) {
  let lifecycle = "active";
  let responseInvocations = 0;
  const transport = {
    get respond() {
      if (caseId === "L18") lifecycle = "stopped";
      return () => {
        responseInvocations += 1;
      };
    },
  };
  const row = {
    get callId() {
      if (caseId === "L17") lifecycle = "stopped";
      return "late";
    },
    result: Object.freeze({ ok: true, message: "late" }),
  };

  const respond = transport.respond;
  const callId = row.callId;
  const result = row.result;
  if (enforceLifecycleCheck && lifecycle !== "active") return responseInvocations;
  Reflect.apply(respond, transport, [callId, result]);
  return responseInvocations;
}

function selfTestResponseCutoffSensitivity() {
  const mutant = MUTANT_BY_ID.get("M-07-L03");
  assert(mutant !== undefined, "M-07-L03 must exist");
  assert(
    JSON.stringify(mutant.intendedCaseIds) === JSON.stringify(["L17", "L18"]),
    "M-07-L03 must select only the getter-stop response cases",
  );
  assert(
    mutant.literalPattern.includes('lifecycle !== "active"') &&
      !mutant.replacement.includes('lifecycle !== "active"'),
    "M-07-L03 must remove the final lifecycle check exercised by its cases",
  );
  for (const caseId of mutant.intendedCaseIds) {
    assert(
      simulateResponseCutoff(caseId, true) === 0 &&
        simulateResponseCutoff(caseId, false) === 1,
      `M-07-L03 selected case ${caseId} is not behaviorally sensitive to its current replacement`,
    );
  }
}

function selfTest() {
  validateDefinitions();
  validateRegister(makeRegister());
  const initialEvidence = makeInitialEvidence();
  validateEvidenceShape(initialEvidence);
  assert(
    initialEvidence.rows.length === 32 &&
      initialEvidence.rows.every((row) => row.status === "pending"),
    "refresh fixture must contain exactly 32 pending rows",
  );
  const expectedMutationRows = expectedMutationLedgerRows(
    initialEvidence.registerDigest,
  );
  for (const [key, staleValue, label] of [
    [
      "Distribution",
      "10 catalog / 9 routing / 8 lifecycle / 2 diagnostics / 2 package-guard (`10/9/8/2/2`)",
      "stale 31-row mutation distribution",
    ],
    [
      "Outcome",
      "31/31 green; zero pending, zero escaped, zero failed",
      "stale 31-row mutation outcome",
    ],
    [
      "Bounded execution",
      "Exactly ten contiguous shards: C01-C03, C04-C06, C07-C10, R01-R04, R05-R08, R09-R09, L01-L04, L05-L08, D01-D02, P01-P02",
      "stale 31-row catalog shard",
    ],
  ]) {
    const staleRows = new Map(expectedMutationRows);
    staleRows.set(key, staleValue);
    assertThrows(
      () =>
        requireExactRows(
          staleRows,
          expectedMutationRows,
          "Measured Mutation Evidence",
        ),
      new RegExp(`row ${key} differs`, "u"),
      label,
    );
  }
  const approvalFixture = `**Approval:** approved 2026-08-09 — register ${initialEvidence.registerDigest}; 32/32 green; release gate green`;
  validateApproval(approvalFixture, initialEvidence.registerDigest);
  assertThrows(
    () =>
      validateApproval(
        approvalFixture.replace("32/32 green", "31/31 green"),
        initialEvidence.registerDigest,
      ),
    /approval date\/digest is missing or invalid/u,
    "stale 31-row approval",
  );

  const syntheticRelease = syntheticReleaseEvidence();
  const releasedEvidence = clone(initialEvidence);
  releasedEvidence.release = clone(syntheticRelease);
  validateEvidenceShape(releasedEvidence, {
    requireRelease: true,
    expectedReleaseRevision: syntheticRelease.revisionDigest,
  });
  const missingRelease = clone(releasedEvidence);
  delete missingRelease.release;
  assertThrows(
    () => validateEvidenceShape(missingRelease, { requireRelease: true }),
    /evidence keys/u,
    "missing release object",
  );
  const nullRelease = clone(releasedEvidence);
  nullRelease.release = null;
  assertThrows(
    () => validateEvidenceShape(nullRelease, { requireRelease: true }),
    /release evidence is required/u,
    "null release object",
  );
  for (const commandName of RELEASE_COMMAND_KEYS) {
    const missingCommand = clone(syntheticRelease);
    delete missingCommand.commandExits[commandName];
    assertThrows(
      () => validateReleaseEvidenceShape(missingCommand, { required: true }),
      /commandExits keys/u,
      `missing release command exit ${commandName}`,
    );

    const failedCommand = clone(syntheticRelease);
    failedCommand.commandExits[commandName] = 1;
    if (commandName === "test") failedCommand.tests.exitCode = 1;
    assertThrows(
      () => validateReleaseEvidenceShape(failedCommand, { required: true }),
      /exit must be zero/u,
      `nonzero release command exit ${commandName}`,
    );
  }
  for (const [countName, value] of [
    ["numTestFiles", 0],
    ["numPassedTests", 295],
    ["numTotalTests", 297],
    ["numFailedTests", 1],
    ["numPendingTests", 1],
    ["numTodoTests", 1],
  ]) {
    const alteredCounts = clone(syntheticRelease);
    alteredCounts.tests[countName] = value;
    assertThrows(
      () => validateReleaseEvidenceShape(alteredCounts, { required: true }),
      /counts must|fully green/u,
      `altered release test count ${countName}`,
    );
  }
  assertNoUntrackedRevisionInputs([]);
  assert(
    isInstalledDependencyPath(
      "packages/concierge/test/fixtures/adapter-alpha/node_modules/@fullselfbrowsing/concierge",
    ) &&
      !isInstalledDependencyPath(
        "packages/concierge/test/untracked-release-input.test.ts",
      ),
    "only installed node_modules paths may be excluded from untracked release inputs",
  );
  assertThrows(
    () =>
      assertNoUntrackedRevisionInputs([
        "packages/concierge/src/untracked-release-input.ts",
        "packages/concierge/test/untracked-release-input.test.ts",
      ]),
    /untracked scoped inputs/u,
    "untracked source and test inside release scopes",
  );
  assertThrows(
    () =>
      assertStableReleaseRevision(
        { paths: ["packages/concierge/src/session.ts"], digest: "0".repeat(64) },
        { paths: ["packages/concierge/src/session.ts"], digest: "1".repeat(64) },
      ),
    /changed while gates were running/u,
    "pre/post release digest mismatch",
  );

  assertThrows(
    () => validateRegister({ ...makeRegister(), registerDigest: "0".repeat(64) }),
    /registerDigest/u,
    "stale register digest",
  );
  assertThrows(
    () => validateEvidenceShape({ ...initialEvidence, registerDigest: "0".repeat(64) }),
    /registerDigest/u,
    "stale evidence digest",
  );

  for (const id of [
    "M-07-C05",
    "M-07-C06",
    "M-07-C07",
    "M-07-C08",
    "M-07-C09",
    "M-07-C10",
    "M-07-C11",
    "M-07-R09",
    "M-07-L05",
  ]) {
    assertThrows(
      () =>
        validateRegister(
          changedRegister((register) => {
            register.mutants = register.mutants.filter((mutant) => mutant.id !== id);
            register.expectedIds = register.expectedIds.filter((candidate) => candidate !== id);
          }),
        ),
      /differs|missing|reordered/u,
      `removed register row ${id}`,
    );
    assertThrows(
      () =>
        validateRegister(
          changedRegister((register) => {
            const index = register.mutants.findIndex((mutant) => mutant.id === id);
            const [mutant] = register.mutants.splice(index, 1);
            register.mutants.splice(Math.max(0, index - 1), 0, mutant);
          }),
        ),
      /differs/u,
      `reordered register row ${id}`,
    );
  }

  const duplicated = clone(MUTANTS);
  duplicated[1].id = duplicated[0].id;
  assertThrows(
    () => validateMutantList(duplicated),
    /missing|duplicated|reordered/u,
    "duplicate mutant id",
  );
  const duplicatedC10 = clone(MUTANTS);
  const c10Index = duplicatedC10.findIndex((mutant) => mutant.id === "M-07-C10");
  assert(c10Index > 0, "M-07-C10 must have a preceding catalog mutant");
  duplicatedC10[c10Index - 1].id = "M-07-C10";
  assertThrows(
    () => validateMutantList(duplicatedC10),
    /missing|duplicated|reordered/u,
    "duplicate M-07-C10 id",
  );
  assertThrows(
    () => validateMutantList(clone(MUTANTS).slice(0, -1)),
    /missing|reordered/u,
    "missing mutant id",
  );
  const reordered = clone(MUTANTS);
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assertThrows(
    () => validateMutantList(reordered),
    /reordered/u,
    "reordered mutant ids",
  );

  for (const cleanupId of ["M-07-C10", "M-07-C11"]) {
    const noOp = clone(MUTANTS);
    const noOpCleanup = noOp.find((mutant) => mutant.id === cleanupId);
    assert(noOpCleanup !== undefined, `${cleanupId} must exist for no-op self-test`);
    noOpCleanup.replacement = noOpCleanup.literalPattern;
    assertThrows(
      () => validateMutantList(noOp),
      /no-op/u,
      `no-op ${cleanupId} cleanup mutant`,
    );
    const multiOccurrence = clone(MUTANTS);
    const doubled = multiOccurrence.find((mutant) => mutant.id === cleanupId);
    assert(doubled !== undefined, `${cleanupId} must exist for occurrence self-test`);
    assertThrows(
      () =>
        validateMutantList(multiOccurrence, {
          readTarget: (target) => {
            const source = readFileSync(join(ROOT, target), "utf8");
            return target === doubled.target
              ? `${source}\n${doubled.literalPattern}`
              : source;
          },
        }),
      /occurrence count is 2/u,
      `multi-occurrence ${cleanupId} cleanup mutant`,
    );
  }

  const greenRows = MUTANTS.map(syntheticGreenRow);
  validateSyntheticGreenRows(greenRows);
  const compileOnly = clone(greenRows);
  compileOnly[0].detectorSatisfied = false;
  assertThrows(
    () => validateSyntheticGreenRows(compileOnly),
    /detectorSatisfied/u,
    "compile-only credit",
  );
  const zeroTests = clone(greenRows);
  zeroTests[0].testsRan = 0;
  assertThrows(
    () => validateSyntheticGreenRows(zeroTests),
    /zero detector/u,
    "zero tests credit",
  );
  const unrestored = clone(greenRows);
  unrestored[0].targetRestored = false;
  assertThrows(
    () => validateSyntheticGreenRows(unrestored),
    /targetRestored/u,
    "unrestored source credit",
  );
  const dirty = clone(greenRows);
  dirty[0].scopedStatusAfter = " M packages/concierge/src/session.ts";
  assertThrows(
    () => validateSyntheticGreenRows(dirty),
    /dirty/u,
    "dirty scoped tree credit",
  );
  const sharedDigest = clone(greenRows);
  sharedDigest[1].revisionDigest = sharedDigest[0].revisionDigest;
  assertThrows(
    () => validateSyntheticGreenRows(sharedDigest),
    /revision digest/u,
    "shared revision digest",
  );
  const reorderedFailureSet = clone(greenRows);
  const multiCaseRow = reorderedFailureSet.find(
    (row) => row.id === "M-07-R04",
  );
  multiCaseRow.intendedFailingCaseIds.reverse();
  validateSyntheticGreenRows(reorderedFailureSet);
  const incompleteFailureSet = clone(greenRows);
  const incompleteMultiCaseRow = incompleteFailureSet.find(
    (row) => row.id === "M-07-R04",
  );
  incompleteMultiCaseRow.intendedFailingCaseIds.pop();
  assertThrows(
    () => validateSyntheticGreenRows(incompleteFailureSet),
    /exact intended case set/u,
    "incomplete intended failure set",
  );

  for (const caseId of [
    "C10",
    "C11",
    "C12",
    "C13",
    "C14",
    "C15",
    "C16",
    "C17",
    "J15",
    "J16",
    "J17",
    "J18",
  ]) {
    const index = MUTANTS.findIndex((mutant) => mutant.intendedCaseIds.includes(caseId));
    const wrongMarkerRows = clone(greenRows);
    const fingerprintIndex = wrongMarkerRows[index].observedFailureFingerprint.findIndex(
      (entry) => entry.caseId === caseId,
    );
    wrongMarkerRows[index].observedFailureFingerprint[fingerprintIndex].marker =
      caseId.startsWith("C")
        ? failureMarkerForCase(
            TEST_FILES.catalog,
            caseId === "C17"
              ? "C16"
              : caseId === "C16"
                ? "C15"
                : `C${String(Number(caseId.slice(1)) + 1).padStart(2, "0")}`,
          )
        : failureMarkerForCase(TEST_FILES.routing, caseId === "J18" ? "J17" : `J${String(Number(caseId.slice(1)) + 1).padStart(2, "0")}`);
    assertThrows(
      () => validateSyntheticGreenRows(wrongMarkerRows),
      /wrong detector marker/u,
      `neighboring detector substitution ${caseId}`,
    );
  }
  verifyNamedCasesAndWaveFiles();
  assertThrows(
    () =>
      verifyNamedCasesAndWaveFiles({
        readSource: (path) => {
          const source = readFileSync(join(ROOT, path), "utf8");
          return path === TEST_FILES.catalog
            ? source.replace(
                "[RED:C17:abandoned-publication-cleanup]",
                "[REMOVED:C17:abandoned-publication-cleanup]",
              )
            : source;
        },
      }),
    /missing named RED marker C17/u,
    "missing C17 marker",
  );

  const c17FactoryFailure = {
    readable: true,
    numTotalTests: 1,
    numPendingTests: 0,
    assertions: [
      {
        caseId: "C17",
        title: "[C17] clears a publication abandoned by setTools accessor reentry",
        status: "failed",
        failureMessages: [
          "AssertionError: [SMOKE:C17:create-session-factory]",
        ],
      },
    ],
    suiteErrors: [],
    unhandledErrors: [],
  };
  const c17ExportFailure = {
    readable: true,
    numTotalTests: 0,
    numPendingTests: 0,
    assertions: [],
    suiteErrors: ["createSession export is missing"],
    unhandledErrors: [],
  };
  for (const cleanupId of ["M-07-C10", "M-07-C11"]) {
    const cleanupMutant = MUTANT_BY_ID.get(cleanupId);
    assert(
      cleanupMutant !== undefined &&
        !exactRuntimeFailureSet(c17FactoryFailure, cleanupMutant).satisfied &&
        !exactRuntimeFailureSet(c17ExportFailure, cleanupMutant).satisfied,
      `${cleanupId} must reject C17 factory and export failures`,
    );
  }

  assertThrows(
    () => selectMutantRange("M-07-C01", "M-07-C05"),
    /one to four/u,
    "five-mutant range",
  );
  assertThrows(
    () => selectMutantRange("M-07-C03", "M-07-C01"),
    /reversed/u,
    "reversed range",
  );
  assertThrows(
    () => selectMutantRange("M-07-C11", "M-07-R01"),
    /crosses groups/u,
    "cross-group range",
  );

  const f7Pattern = new RegExp(casePattern(["F7"]));
  assert(
    f7Pattern.test(`${SINGLE_INSTANCE_SUITE_TITLE} F7 — direct guard`),
    "nested F7 selector must match the PKG-04 full test name",
  );
  for (const neighboringCase of ["F6", "F8"]) {
    assert(
      !f7Pattern.test(
        `${SINGLE_INSTANCE_SUITE_TITLE} ${neighboringCase} — neighboring guard`,
      ),
      `nested F7 selector must not match ${neighboringCase}`,
    );
  }
  const ordinaryPattern = new RegExp(casePattern(["C01", "J01"]));
  assert(
    ordinaryPattern.test("[C01] catalog detector") &&
      ordinaryPattern.test("[J01] routing detector") &&
      !ordinaryPattern.test("[C02] neighboring detector"),
    "ordinary bracketed case selectors must remain exact",
  );

  const f7Mutant = MUTANT_BY_ID.get("M-07-P02");
  const f7FailureReport = {
    readable: true,
    numTotalTests: 1,
    numPendingTests: 0,
    assertions: [
      {
        caseId: "F7",
        title: "F7 — createSession records this copy through its own direct guard call",
        status: "failed",
        failureMessages: [`AssertionError: ${F7_FAILURE_MARKER}`],
      },
    ],
    suiteErrors: [],
    unhandledErrors: [],
  };
  assert(
    exactRuntimeFailureSet(f7FailureReport, f7Mutant).satisfied,
    "F7 detector must accept its exact direct-guard marker",
  );
  const neighboringF7Failure = clone(f7FailureReport);
  neighboringF7Failure.assertions[0].failureMessages = [
    "AssertionError: neighboring F7 construction assertion failed",
  ];
  assert(
    !exactRuntimeFailureSet(neighboringF7Failure, f7Mutant).satisfied,
    "F7 detector must reject a neighboring assertion failure",
  );

  const ledgerFixture = [
    "## Test Infrastructure",
    "",
    "| Property | Value |",
    "|----------|-------|",
    `| **Measured final runtime** | ${runtimeLedgerValue(syntheticRelease)} |`,
    "",
    "## Per-Task Verification Map",
    ...REQUIRED_TASK_IDS.map((id) => `| ${id} | fixture |`),
    ...REQUIRED_REQUIREMENT_IDS,
  ].join("\n");
  validateLedgerSkeleton(ledgerFixture, syntheticRelease);
  assertThrows(
    () =>
      validateLedgerSkeleton(
        ledgerFixture.replace("| 07-07-02 | fixture |", ""),
        syntheticRelease,
      ),
    /07-07-02/u,
    "missing Phase 07-07 task row",
  );
  assertThrows(
    () =>
      validateLedgerSkeleton(
        ledgerFixture.replace("SES-03", "MISSING"),
        syntheticRelease,
      ),
    /SES-03/u,
    "missing requirement mapping",
  );
  assertThrows(
    () =>
      validateLedgerSkeleton(
        ledgerFixture.replace("296 total", "295 total"),
        syntheticRelease,
      ),
    /runtime totals/u,
    "stale runtime totals",
  );
  for (const mutateRelease of [
    (release) => {
      release.tests.numTestFiles += 1;
    },
    (release) => {
      release.tests.numPassedTests += 1;
      release.tests.numTotalTests += 1;
    },
  ]) {
    const alteredCounts = clone(syntheticRelease);
    mutateRelease(alteredCounts);
    validateReleaseEvidenceShape(alteredCounts, { required: true });
    assertThrows(
      () => validateLedgerSkeleton(ledgerFixture, alteredCounts),
      /runtime totals/u,
      "plausible altered release test counts",
    );
  }

  validatePackageBoundary();
  assertThrows(
    () =>
      validatePackageBoundary({
        packageManifest: { files: ["dist", "src", "README.md", "LICENSE"] },
        indexSource: "export { createStubTransport } from './stub-transport.js';",
        sourceFiles: { exitCode: 1, output: "" },
        packScript: "tar -tzf stub-transport|test/fixtures [RED:P01:stub-tarball-exclusion]",
      }),
    /production barrel/u,
    "stub presence drift",
  );
  assertThrows(
    () =>
      validatePackageBoundary({
        packageManifest: { files: ["dist", "src", "README.md", "LICENSE"] },
        indexSource: "",
        sourceFiles: { exitCode: 1, output: "" },
        packScript: "tar -tzf",
      }),
    /package exclusion detector/u,
    "package exclusion drift",
  );
  for (const exitCode of [2, 255]) {
    assertThrows(
      () =>
        validatePackageBoundary({
          packageManifest: { files: ["dist", "src", "README.md", "LICENSE"] },
          indexSource: "",
          sourceFiles: { exitCode, output: "" },
          packScript:
            "tar -tzf archive.tgz | grep 'stub-transport|test/fixtures' [RED:P01:stub-tarball-exclusion]",
        }),
      new RegExp(`production source scan failed with exit ${exitCode}`, "u"),
      `production source scanner exit ${exitCode}`,
    );
  }

  selfTestInputVerifier();
  selfTestMutationSnapshot();
  selfTestReleaseSnapshot();
  selfTestReleaseSnapshotBuild();
  selfTestResponseCutoffSensitivity();
  assertThrows(
    () => parseInvocation(["verify", "unknown"]),
    /usage/u,
    "unknown verify target",
  );
  assertThrows(
    () => parseInvocation(["verify", "inputs", "extra"]),
    /usage/u,
    "extra verify argument",
  );
  console.log("PASS: Phase 7 mutation battery self-test rejected every negative control");
}

class UsageError extends Error {
  constructor() {
    super("usage");
  }
}

function parseInvocation(args) {
  if (args.length === 1 && args[0] === "self-test") return { kind: "self-test" };
  if (args.length === 1 && args[0] === "refresh") return { kind: "refresh" };
  if (args.length === 4 && args[0] === "run" && args[1] === "range") {
    return { kind: "run", firstId: args[2], lastId: args[3] };
  }
  if (args.length === 3 && args[0] === "gate") {
    return { kind: "gate", mutantId: args[1], directory: args[2] };
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
    ["catalog", "routing", "lifecycle", "diagnostics", "package", "all"].includes(args[1])
  ) {
    return { kind: "verify-group", group: args[1] };
  }
  throw new UsageError();
}

function main(args) {
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
  if (invocation.kind === "self-test") {
    selfTest();
    return 0;
  }
  if (invocation.kind === "refresh") {
    withMutationBatteryLock("refresh", refreshArtifacts);
    return 0;
  }
  if (invocation.kind === "run") {
    const selected = selectMutantRange(invocation.firstId, invocation.lastId);
    withMutationBatteryLock("run range", () => runSelected(selected));
    return 0;
  }
  if (invocation.kind === "verify-group") {
    verifyGroup(invocation.group);
    return 0;
  }
  if (invocation.kind === "verify-ledgers") {
    withMutationBatteryLock("verify ledgers", verifyLedgers);
    return 0;
  }
  throw new UsageError();
}

if (
  process.env.PHASE_07_SNAPSHOT_GATE === "1" ||
  (process.argv[1] !== undefined && resolve(process.argv[1]) === SCRIPT_PATH)
) {
  try {
    const exitCode = main(process.argv.slice(2));
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
