#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
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
const HARNESS_PATH = join(ROOT, "scripts/mutate-and-prove.sh");
const CORE_PACKAGE_DIRECTORY = join(ROOT, "packages/concierge");
const BUILD_MARKER = "Build complete";
const MAX_BUFFER = 64 * 1024 * 1024;
const SCHEMA_VERSION = 1;
const USAGE = "Usage: node scripts/phase-07-mutation-battery.mjs verify inputs";

const TEST_FILES = Object.freeze({
  catalog: "packages/concierge/test/session-catalog.test.ts",
  routing: "packages/concierge/test/session-routing.test.ts",
  lifecycle: "packages/concierge/test/session-lifecycle.test.ts",
  diagnostics: "packages/concierge/test/session-lifecycle.test.ts",
  package: "packages/concierge/test/single-instance.test.ts",
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

const gitCommonDirectoryResult = spawnSync(
  "git",
  ["rev-parse", "--git-common-dir"],
  { cwd: ROOT, encoding: "utf8" },
);
if (gitCommonDirectoryResult.status !== 0) {
  throw new Error(
    `cannot resolve git common directory: ${gitCommonDirectoryResult.stderr ?? ""}`,
  );
}
const MUTATION_LOCK_PATH = resolve(
  ROOT,
  (gitCommonDirectoryResult.stdout ?? "").trim(),
  "phase-07-mutation-battery.lock",
);

function lines(...values) {
  return values.join("\n");
}

function failureMarkerForCase(testFile, caseId) {
  if (caseId === "P01") return "[RED:P01:stub-tarball-exclusion]";
  if (caseId === "F7") {
    return "F7 — createSession records this copy through its own direct guard call";
  }
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
    literalPattern: lines(
      "    try {",
      "      transport.setTools(resolved.catalog);",
      "    } catch {",
    ),
    replacement: lines(
      "    try {",
      "      if (lifecycle !== \"starting\") transport.setTools(resolved.catalog);",
      "    } catch {",
    ),
    intendedCaseIds: ["C01"],
  }),
  runtimeMutant({
    id: "M-07-C02",
    group: "catalog",
    name: "connected transition no longer replays the catalog",
    literalPattern: "      transport.setTools(catalog);",
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
      "      currentStage = resolved.stage;",
      "      stopNow();",
      "      throw new Error(FIXED_CATALOG_ERROR);",
    ),
    replacement: lines(
      "      currentStage = resolved.stage;",
      "      performCleanup();",
      "      throw new Error(FIXED_CATALOG_ERROR);",
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
    literalPattern:
      "        if (!allowResponses || lifecycle !== \"active\") break;",
    replacement: "        if (!allowResponses) break;",
    intendedCaseIds: ["L03", "L05"],
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
      "    stageNotifications.push(nextStage);",
      "    if (stageNotifying) return;",
      "    stageNotifying = true;",
    ),
    replacement: lines(
      "    if (stageNotifying) {",
      "      for (const listener of [...stageListeners.values()]) {",
      "        try {",
      "          listener(nextStage);",
      "        } catch {",
      "          diagnose(\"stage_listener_failed\");",
      "        }",
      "      }",
      "      return;",
      "    }",
      "    stageNotifications.push(nextStage);",
      "    stageNotifying = true;",
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
  Array.from({ length: 9 }, (_, index) =>
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

function withExclusiveRepositoryLock(operation, run) {
  return withExclusivePathLock(MUTATION_LOCK_PATH, operation, run);
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
    "M-07-L03": ["L03", "L05"],
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
  const l02 = byId.get("M-07-L02");
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
  for (const displacedCase of ["C08", "C09", "C13", "C14"]) {
    if (!l02?.intendedCaseIds.includes(displacedCase)) {
      throw new Error(`M-07-L02 must retain displaced stop-order detector ${displacedCase}`);
    }
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

  const expectedCounts = { catalog: 9, routing: 9, lifecycle: 8, diagnostics: 2, package: 2 };
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

function validateEvidenceShape(evidence) {
  if (typeof evidence !== "object" || evidence === null) {
    throw new Error("evidence must be an object");
  }
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

function runBuild() {
  const result = command("pnpm", ["build"]);
  return {
    ...result,
    markerFound: result.output.includes(BUILD_MARKER),
    succeeded: result.exitCode === 0 && result.output.includes(BUILD_MARKER),
  };
}

function casePattern(caseIds) {
  return `^(?:${caseIds
    .map((caseId) =>
      caseId === "F7" ? "F7\\s+—" : `\\[${caseId}\\]`,
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

function runVitest(testFiles, reportPath, selectedCaseIds = null) {
  rmSync(reportPath, { force: true });
  const files = Array.isArray(testFiles) ? testFiles : [testFiles];
  const args = ["exec", "vitest", "run", ...files];
  if (selectedCaseIds !== null) {
    args.push(`--testNamePattern=${casePattern(selectedCaseIds)}`);
  }
  args.push("--reporter=json", `--outputFile=${reportPath}`);
  const result = command("pnpm", args);
  return { ...result, report: summarizeVitestReport(reportPath) };
}

function runFullVitest(reportPath) {
  rmSync(reportPath, { force: true });
  const result = command("pnpm", [
    "test",
    "--reporter=json",
    `--outputFile=${reportPath}`,
  ]);
  return { ...result, report: summarizeVitestReport(reportPath) };
}

function runTypecheck() {
  return command("pnpm", [
    "--filter",
    "@fullselfbrowsing/concierge",
    "typecheck",
  ]);
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
    if (assertion.caseId === "F7") {
      if (assertion.failureMessages.length === 0) {
        errors.push("F7: failureMessages=0");
      }
      fingerprint.push({
        caseId: "F7",
        marker: "F7 — createSession records this copy through its own direct guard call",
      });
      continue;
    }
    const messages = assertion.failureMessages.filter(
      (message) => typeof message === "string",
    );
    const markers = messages.flatMap((message) => [
      ...message.matchAll(/\[RED:[CJL]\d{2}:[^\]]+\]/gu),
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

function runRestoredGates(mutant, directory) {
  const build = runBuild();
  const reportPath = join(directory, "restored-vitest.json");
  const vitest = build.succeeded
    ? runVitest(mutant.intendedTestFiles, reportPath)
    : {
        exitCode: 255,
        output: "restored Vitest skipped because build failed",
        report: summarizeVitestReport(reportPath),
      };
  const typecheck = build.succeeded
    ? runTypecheck()
    : { exitCode: 255, output: "restored typecheck skipped because build failed" };
  const pack =
    build.succeeded && mutant.detectorKind === "package"
      ? command("pnpm", ["check:pack"])
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

function targetHash(mutant) {
  return sha256(readFileSync(join(ROOT, mutant.target)));
}

let revisionInputPathCache;

function revisionInputPaths() {
  if (revisionInputPathCache !== undefined) return revisionInputPathCache;
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
  revisionInputPathCache = Object.freeze(paths);
  return revisionInputPathCache;
}

function revisionDigest(mutant) {
  const digest = createHash("sha256");
  digest.update(`mutant\0${JSON.stringify(mutant)}\0`);
  for (const path of revisionInputPaths()) {
    digest.update(`path\0${path}\0`);
    digest.update(readFileSync(join(ROOT, path)));
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
  const source = readFileSync(join(ROOT, mutant.target), "utf8");
  const occurrenceCount = source.split(mutant.literalPattern).length - 1;
  const tracked =
    command("git", ["ls-files", "--error-unmatch", mutant.target]).exitCode === 0;
  const hashBefore = targetHash(mutant);
  const measuredRevisionDigest = revisionDigest(mutant);
  const directory = mkdtempSync(join(tmpdir(), "phase-07-mutation-"));

  try {
    const harness = command("bash", [
      HARNESS_PATH,
      mutant.target,
      mutant.literalPattern,
      mutant.replacement,
      "--",
      "node",
      SCRIPT_PATH,
      "gate",
      mutant.id,
      directory,
    ]);
    const resultPath = gateResultPath(directory);
    const gate = existsSync(resultPath)
      ? JSON.parse(readFileSync(resultPath, "utf8"))
      : null;
    const hashAfter = targetHash(mutant);
    const targetRestored = hashAfter === hashBefore;
    const restored = runRestoredGates(mutant, directory);
    const afterStatus = scopedStatus();
    const scopedTreeClean = beforeStatus === "" && afterStatus === "";
    const killed =
      harness.exitCode === 0 &&
      harness.output.includes("PASS: gate fired") &&
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
        : harness.exitCode === 1 && harness.output.includes("mutant escaped")
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
      revisionDigest: measuredRevisionDigest,
      harnessExit: harness.exitCode,
      harnessOutput: shortOutput(harness.output),
      mutantGate: gate,
      executedAt: new Date().toISOString(),
    };
    if (status !== "green") {
      return {
        row,
        error: `${mutant.id} did not close green:\n${JSON.stringify(
          {
            status,
            harnessExit: harness.exitCode,
            harnessOutput: shortOutput(harness.output, 2_000),
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
  if (
    JSON.stringify(row.intendedFailingCaseIds) !==
      JSON.stringify(mutant.intendedCaseIds)
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

function validateLedgerSkeleton(validationText, runtimeTotals) {
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
  if (
    runtimeTotals !== undefined &&
    (!validationText.includes(`${runtimeTotals.numTestFiles} runtime files`) ||
      !validationText.includes(`${runtimeTotals.numPassedTests} passed`) ||
      !validationText.includes(`${runtimeTotals.numTotalTests} total`) ||
      !validationText.includes(`${runtimeTotals.numPendingTests} pending`) ||
      !validationText.includes(`${runtimeTotals.numTodoTests} todo`))
  ) {
    throw new Error("validation ledger runtime totals are stale or missing");
  }
}

function validateFinalLedgers(validationText, requirementsText, evidence, runtimeTotals) {
  validateLedgerSkeleton(validationText, runtimeTotals);
  if (!/^status: complete$/mu.test(validationText)) {
    throw new Error("validation frontmatter status must be complete");
  }
  if (!/^nyquist_compliant: true$/mu.test(validationText)) {
    throw new Error("validation frontmatter nyquist_compliant must be true");
  }
  if (!/^wave_0_complete: true$/mu.test(validationText)) {
    throw new Error("validation frontmatter wave_0_complete must be true");
  }
  if (/\*\*Approval:\*\* pending/u.test(validationText)) {
    throw new Error("validation approval is still pending");
  }
  const approvalPattern = new RegExp(
    `\\*\\*Approval:\\*\\* approved \\d{4}-\\d{2}-\\d{2} — register ${evidence.registerDigest}; 30/30 green; release gate green`,
    "u",
  );
  if (!approvalPattern.test(validationText)) {
    throw new Error("validation approval date/digest is missing or invalid");
  }
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
  for (const [path, hash] of Object.entries(evidence.inputHashes)) {
    if (!validationText.includes(path) || !validationText.includes(hash)) {
      throw new Error(`validation ledger omits immutable input hash ${path}`);
    }
  }
  for (const token of ["9/9/8/2/2", "30/30", "69", "54", "15", "F7"]) {
    if (!validationText.includes(token)) {
      throw new Error(`validation ledger omits final evidence token ${token}`);
    }
  }
}

function verifyNamedCasesAndWaveFiles() {
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
    if (!existsSync(join(ROOT, path))) throw new Error(`Wave 0 file is missing: ${path}`);
  }
  const markerFiles = [
    [TEST_FILES.catalog, Array.from({ length: 16 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`)],
    [TEST_FILES.routing, Array.from({ length: 18 }, (_, index) => `J${String(index + 1).padStart(2, "0")}`)],
    [TEST_FILES.lifecycle, Array.from({ length: 16 }, (_, index) => `L${String(index + 1).padStart(2, "0")}`)],
    ["packages/concierge/test/stub-transport.test.ts", Array.from({ length: 8 }, (_, index) => `U${String(index + 1).padStart(2, "0")}`)],
  ];
  for (const [path, ids] of markerFiles) {
    const source = readFileSync(join(ROOT, path), "utf8");
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
  const singleInstance = readFileSync(join(ROOT, TEST_FILES.package), "utf8");
  if (!singleInstance.includes("F7 — createSession records this copy through its own direct guard call")) {
    throw new Error("single-instance suite is missing F7");
  }
}

function runReleaseGates() {
  const gates = [
    ["build", ["build"]],
    ["typecheck", ["typecheck"]],
    ["artifact", ["check:artifact"]],
    ["deps", ["check:deps"]],
    ["pack", ["check:pack"]],
    ["node-floor", ["check:node-floor"]],
  ];
  for (const [name, args] of gates) {
    const result = command("pnpm", args);
    if (result.exitCode !== 0) {
      throw new Error(`release gate ${name} exited ${result.exitCode}:\n${shortOutput(result.output)}`);
    }
    if (name === "build" && !result.output.includes(BUILD_MARKER)) {
      throw new Error("release build omitted its success marker");
    }
  }
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
    const build = runBuild();
    if (!build.succeeded) {
      throw new Error(`fresh ledger build failed:\n${shortOutput(build.output)}`);
    }
    const full = runFullVitest(join(directory, "full-vitest.json"));
    if (
      full.exitCode !== 0 ||
      !full.report.readable ||
      full.report.numTotalTests <= 0 ||
      full.report.numFailedTests !== 0 ||
      full.report.numPendingTests !== 0 ||
      full.report.numTodoTests !== 0
    ) {
      throw new Error(`fresh full Vitest report is not green:\n${shortOutput(full.output)}`);
    }
    runReleaseGates();
    const validation = readFileSync(VALIDATION_PATH, "utf8");
    const requirements = readFileSync(REQUIREMENTS_PATH, "utf8");
    validateFinalLedgers(validation, requirements, evidence, full.report);
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

function selfTest() {
  validateDefinitions();
  validateRegister(makeRegister());
  const initialEvidence = makeInitialEvidence();
  validateEvidenceShape(initialEvidence);
  assert(
    initialEvidence.rows.length === 30 &&
      initialEvidence.rows.every((row) => row.status === "pending"),
    "refresh fixture must contain exactly 30 pending rows",
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
    "M-07-R09",
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

  const noOp = clone(MUTANTS);
  noOp[0].replacement = noOp[0].literalPattern;
  assertThrows(
    () => validateMutantList(noOp),
    /no-op/u,
    "no-op mutant",
  );
  const multiOccurrence = clone(MUTANTS);
  const doubled = multiOccurrence[0];
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
    "multi-occurrence mutant",
  );

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

  for (const caseId of [
    "C10",
    "C11",
    "C12",
    "C13",
    "C14",
    "C15",
    "C16",
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
        ? failureMarkerForCase(TEST_FILES.catalog, caseId === "C16" ? "C15" : `C${String(Number(caseId.slice(1)) + 1).padStart(2, "0")}`)
        : failureMarkerForCase(TEST_FILES.routing, caseId === "J18" ? "J17" : `J${String(Number(caseId.slice(1)) + 1).padStart(2, "0")}`);
    assertThrows(
      () => validateSyntheticGreenRows(wrongMarkerRows),
      /wrong detector marker/u,
      `neighboring detector substitution ${caseId}`,
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
    () => selectMutantRange("M-07-C09", "M-07-R01"),
    /crosses groups/u,
    "cross-group range",
  );

  const totals = {
    numTestFiles: 15,
    numPassedTests: 296,
    numTotalTests: 296,
    numPendingTests: 0,
    numTodoTests: 0,
  };
  const ledgerFixture = [
    ...REQUIRED_TASK_IDS.map((id) => `| ${id} | fixture |`),
    ...REQUIRED_REQUIREMENT_IDS,
    "15 runtime files / 296 passed / 296 total / 0 pending / 0 todo",
  ].join("\n");
  validateLedgerSkeleton(ledgerFixture, totals);
  assertThrows(
    () => validateLedgerSkeleton(ledgerFixture.replace("| 07-03-02 | fixture |", ""), totals),
    /07-03-02/u,
    "missing task row",
  );
  assertThrows(
    () => validateLedgerSkeleton(ledgerFixture.replace("SES-03", "MISSING"), totals),
    /SES-03/u,
    "missing requirement mapping",
  );
  assertThrows(
    () => validateLedgerSkeleton(ledgerFixture.replace("296 total", "295 total"), totals),
    /runtime totals/u,
    "stale runtime totals",
  );

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

  selfTestInputVerifier();
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
    withExclusiveRepositoryLock("refresh", refreshArtifacts);
    return 0;
  }
  if (invocation.kind === "run") {
    const selected = selectMutantRange(invocation.firstId, invocation.lastId);
    withExclusiveRepositoryLock("run range", () => runSelected(selected));
    return 0;
  }
  if (invocation.kind === "verify-group") {
    verifyGroup(invocation.group);
    return 0;
  }
  if (invocation.kind === "verify-ledgers") {
    verifyLedgers();
    return 0;
  }
  throw new UsageError();
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === SCRIPT_PATH) {
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
