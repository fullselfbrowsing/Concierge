#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTER_PATH = join(
  ROOT,
  ".planning/phases/06-dispatcher/06-MUTATION-REGISTER.json",
);
const EVIDENCE_PATH = join(
  ROOT,
  ".planning/phases/06-dispatcher/06-MUTATION-EVIDENCE.json",
);
const VALIDATION_PATH = join(
  ROOT,
  ".planning/phases/06-dispatcher/06-VALIDATION.md",
);
const REQUIREMENTS_PATH = join(ROOT, ".planning/REQUIREMENTS.md");
const HARNESS_PATH = join(ROOT, "scripts/mutate-and-prove.sh");
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
  "phase-06-mutation-battery.lock",
);
const SINGLE_TEST = "packages/concierge/test/dispatcher.test.ts";
const BATCH_TEST = "packages/concierge/test/dispatcher-batch.test.ts";
const BUILD_MARKER = "Build complete";
const MAX_BUFFER = 64 * 1024 * 1024;
const SCHEMA_VERSION = 2;
const REVISION_DIRECTORY_SCOPES = Object.freeze([
  "packages/concierge/src",
  "packages/concierge/test",
  "packages/concierge/test-d",
  "scripts",
]);
const REVISION_REQUIRED_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "vitest.config.ts",
  "packages/concierge/package.json",
  "packages/concierge/tsconfig.json",
  "packages/concierge/tsconfig.test-d.json",
  "packages/concierge/tsdown.config.ts",
]);
const SCOPED_PATHS = Object.freeze([
  ...new Set([
    ...REVISION_DIRECTORY_SCOPES,
    ...REVISION_REQUIRED_PATHS,
    "scripts/phase-06-mutation-battery.mjs",
    "scripts/mutate-and-prove.sh",
  ]),
]);

export const EXPECTED_SINGLE_IDS = Object.freeze(
  Array.from({ length: 36 }, (_, index) =>
    `M-06-S${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_BATCH_IDS = Object.freeze(
  Array.from({ length: 21 }, (_, index) =>
    `M-06-B${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_M06_IDS = Object.freeze([
  ...EXPECTED_SINGLE_IDS,
  ...EXPECTED_BATCH_IDS,
]);

const REQUIRED_CLOSURE_TASKS = Object.freeze([
  Object.freeze({
    id: "06-07-T1",
    tokens: Object.freeze([
      "r68",
      "q17",
      "malformed-metadata totality",
      "correlation",
    ]),
  }),
  Object.freeze({
    id: "06-07-T2",
    tokens: Object.freeze(["r06", "bigint", "no-dedup"]),
  }),
  Object.freeze({
    id: "06-07-T3",
    tokens: Object.freeze(["q04", "empty-object validation"]),
  }),
  Object.freeze({
    id: "06-08-T1",
    tokens: Object.freeze([
      "57-row register",
      "range self-tests",
      "ledger self-tests",
    ]),
  }),
  Object.freeze({
    id: "06-08-T2",
    tokens: Object.freeze(["57/57", "verify all"]),
  }),
  Object.freeze({
    id: "06-08-T3",
    tokens: Object.freeze(["final release gates", "verify ledgers"]),
  }),
]);

const REQUIRED_TRACEABILITY = Object.freeze([
  Object.freeze({
    id: "DSP-01",
    tokens: Object.freeze([
      "r01",
      "r02",
      "r68",
      "valid string callids",
      "malformed metadata",
      "contain",
    ]),
  }),
  Object.freeze({
    id: "DSP-02",
    tokens: Object.freeze([
      "r05",
      "r06",
      "r06a",
      "bigint",
      "cyclic",
      "aliased",
      "do not deduplicate",
    ]),
  }),
  Object.freeze({
    id: "DSP-06",
    tokens: Object.freeze([
      "q04",
      "malformed json",
      "empty object",
      "validation",
      "later calls continue",
    ]),
  }),
  Object.freeze({
    id: "DSP-07",
    tokens: Object.freeze([
      "q17",
      "one correlated row",
      "q16",
      "immutable nested batch results",
    ]),
  }),
]);

const R68_MARKER = "[RED:R68:malformed-metadata-totality]";
const Q17_MARKER = "[RED:Q17:malformed-callid-correlation]";
const Q16_MARKER = "[RED:Q16:immutable-nested-result]";

function failureMarkerForCase(testFile, caseId) {
  const source = readFileSync(join(ROOT, testFile), "utf8");
  const matches = [
    ...source.matchAll(new RegExp(`\\[RED:${caseId}:[^\\]]+\\]`, "gu")),
  ].map((match) => match[0]);
  const unique = [...new Set(matches)];
  if (unique.length !== 1) {
    throw new Error(
      `${testFile}: expected exactly one RED marker for ${caseId}, found ${JSON.stringify(unique)}`,
    );
  }
  return unique[0];
}

function lines(...values) {
  return values.join("\n");
}

function runtimeMutant({
  id,
  group,
  name,
  target,
  literalPattern,
  replacement,
  intendedCaseIds,
}) {
  const intendedTestFile = group === "single" ? SINGLE_TEST : BATCH_TEST;
  return Object.freeze({
    id,
    group,
    name,
    target,
    literalPattern,
    replacement,
    detectorKind: "vitest",
    intendedTestFile,
    intendedCaseIds: Object.freeze([...intendedCaseIds]),
    expectedFailureFingerprint: Object.freeze(
      intendedCaseIds.map((caseId) =>
        Object.freeze({
          caseId,
          marker: failureMarkerForCase(intendedTestFile, caseId),
        }),
      ),
    ),
    expectedTypeDiagnostics: Object.freeze([]),
  });
}

function typeMutant({
  id,
  name,
  target,
  literalPattern,
  replacement,
  intendedCaseIds,
  expectedTypeDiagnostics,
}) {
  return Object.freeze({
    id,
    group: "single",
    name,
    target,
    literalPattern,
    replacement,
    detectorKind: "typecheck",
    intendedTestFile: SINGLE_TEST,
    intendedCaseIds: Object.freeze([...intendedCaseIds]),
    expectedFailureFingerprint: Object.freeze([]),
    expectedTypeDiagnostics: Object.freeze([...expectedTypeDiagnostics]),
  });
}

const MUTANTS = Object.freeze([
  runtimeMutant({
    id: "M-06-S01",
    group: "single",
    name: "outer dispatch becomes async",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "  function dispatch(",
      "    ctx: StageContext,",
      "    name: string,",
    ),
    replacement: lines(
      "  async function dispatch(",
      "    ctx: StageContext,",
      "    name: string,",
    ),
    intendedCaseIds: ["R01"],
  }),
  runtimeMutant({
    id: "M-06-S02",
    group: "single",
    name: "cache hit is wrapped in a fresh Promise",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "    const hit: Promise<ActionResult> | undefined = dispatchPromises.get(key);",
      "    if (hit !== undefined) {",
      "      return hit;",
      "    }",
    ),
    replacement: lines(
      "    const hit: Promise<ActionResult> | undefined = dispatchPromises.get(key);",
      "    if (hit !== undefined) {",
      "      return hit.then((result) => result);",
      "    }",
    ),
    intendedCaseIds: ["R01"],
  }),
  runtimeMutant({
    id: "M-06-S03",
    group: "single",
    name: "cache insertion is delayed until settlement",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "    dispatchPromises.set(key, promise);",
    replacement:
      "    void promise.then((): void => { dispatchPromises?.set(key, promise); });",
    intendedCaseIds: ["R01"],
  }),
  runtimeMutant({
    id: "M-06-S04",
    group: "single",
    name: "only successful Promises enter the cache",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "    dispatchPromises.set(key, promise);",
    replacement: lines(
      "    void promise.then((result): void => {",
      "      if (result.ok) {",
      "        dispatchPromises?.set(key, promise);",
      "      }",
      "    });",
    ),
    intendedCaseIds: ["R02"],
  }),
  runtimeMutant({
    id: "M-06-S05",
    group: "single",
    name: "callId key selection is removed",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "  if (callId !== undefined) {",
      "    if (typeof callId !== \"string\") {",
      "      return null;",
      "    }",
      "    return `id:${callId}`;",
      "  }",
    ),
    replacement: "",
    intendedCaseIds: ["R04"],
  }),
  runtimeMutant({
    id: "M-06-S06",
    group: "single",
    name: "callId and fallback key namespaces collide",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "    return `id:${callId}`;",
    replacement:
      '    return `args:${JSON.stringify([authorizationScope === null ? "cross" : String(authorizationScope), name, encodeInvocationValue(args)])}`;',
    intendedCaseIds: ["R04"],
  }),
  runtimeMutant({
    id: "M-06-S07",
    group: "single",
    name: "unencodable arguments receive a shared fallback key",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "function encodeInvocationValue(value: unknown): string | null {",
      "  try {",
      "    return JSON.stringify(",
      "      canonicalInvocationValue(value, new WeakSet<object>()),",
      "    );",
      "  } catch {",
      "    return null;",
      "  }",
      "}",
    ),
    replacement: lines(
      "function encodeInvocationValue(value: unknown): string | null {",
      "  try {",
      "    return JSON.stringify(",
      "      canonicalInvocationValue(value, new WeakSet<object>()),",
      "    );",
      "  } catch {",
      '    return "unkeyable";',
      "  }",
      "}",
    ),
    intendedCaseIds: ["R05"],
  }),
  runtimeMutant({
    id: "M-06-S08",
    group: "single",
    name: "dispatch cache is shared across Concierge instances",
    target: "packages/concierge/src/concierge.ts",
    literalPattern:
      "  let dispatchPromises: Map<string, Promise<ActionResult>> | null = null;",
    replacement: lines(
      "  const sharedDispatchState: { __m06DispatchPromises?: Map<string, Promise<ActionResult>> } =",
      "    globalThis as { __m06DispatchPromises?: Map<string, Promise<ActionResult>> };",
      "  sharedDispatchState.__m06DispatchPromises ??= new Map<string, Promise<ActionResult>>();",
      "  let dispatchPromises: Map<string, Promise<ActionResult>> | null =",
      "    sharedDispatchState.__m06DispatchPromises;",
    ),
    intendedCaseIds: ["R07"],
  }),
  runtimeMutant({
    id: "M-06-S09",
    group: "single",
    name: "pending entries expire from their creation time",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "    dispatchSettledAt.delete(key);",
      "    dispatchPending.add(key);",
    ),
    replacement: "    dispatchSettledAt.set(key, Date.now());",
    intendedCaseIds: ["R21"],
  }),
  runtimeMutant({
    id: "M-06-S10",
    group: "single",
    name: "dedupe timestamp starts at creation instead of settlement",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "    const promise: Promise<ActionResult> = Promise.resolve().then(() =>",
      "      runDispatchPipeline(",
      "        index,",
      "        entry,",
      "        name,",
      "        argsSnapshot.value,",
      "        metaSnapshot.value,",
      "      ),",
      "    );",
      "    dispatchPromises.set(key, promise);",
      "    dispatchSettledAt.delete(key);",
      "    dispatchPending.add(key);",
      "",
      "    const observeSettlement = (): void => {",
      "      markDispatchSettled(key, promise);",
      "    };",
    ),
    replacement: lines(
      "    const promise: Promise<ActionResult> = Promise.resolve().then(() =>",
      "      runDispatchPipeline(",
      "        index,",
      "        entry,",
      "        name,",
      "        argsSnapshot.value,",
      "        metaSnapshot.value,",
      "      ),",
      "    );",
      "    dispatchPromises.set(key, promise);",
      "    dispatchSettledAt.set(key, Date.now());",
      "    dispatchPending.add(key);",
      "",
      "    const observeSettlement = (): void => {",
      "      dispatchPending?.delete(key);",
      "    };",
    ),
    intendedCaseIds: ["R22"],
  }),
  runtimeMutant({
    id: "M-06-S11",
    group: "single",
    name: "all-key settled sweep is removed",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "    sweepSettledDispatches(Date.now());",
    replacement: "",
    intendedCaseIds: ["R24"],
  }),
  runtimeMutant({
    id: "M-06-S12",
    group: "single",
    name: "commit-window default changes from 600 ms",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "    config.commitWindowMs ?? 600,",
    replacement: "    config.commitWindowMs ?? 500,",
    intendedCaseIds: ["R20"],
  }),
  runtimeMutant({
    id: "M-06-S13",
    group: "single",
    name: "dedupe-window default changes from 600 ms",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "    config.dedupeWindowMs ?? 600,",
    replacement: "    config.dedupeWindowMs ?? 500,",
    intendedCaseIds: ["R20"],
  }),
  runtimeMutant({
    id: "M-06-S14",
    group: "single",
    name: "stage projection authorization is bypassed",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "    const allowedNames: readonly string[] =",
      "      index === null ? crossNames : (namesByStage[index] ?? crossNames);",
    ),
    replacement:
      "    const allowedNames: readonly string[] = Object.keys(catalog.byName);",
    intendedCaseIds: ["R08"],
  }),
  runtimeMutant({
    id: "M-06-S15",
    group: "single",
    name: "handler lookup regains an Object prototype",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "    // Reserved prototype spellings are ordinary keys in the catalog's frozen",
      "    // null-prototype lookup. Authorization still stays ahead of the cache: a",
      "    // key proves retry identity, never stage authority.",
      "    if (!allowedNames.includes(name)) {",
      "      return Promise.resolve(",
      "        authoredResult(",
      "          false,",
      "          \"This action is not available in the current stage.\",",
      "          \"unknown_action\",",
      "        ),",
      "      );",
      "    }",
      "",
      "    const entry: CatalogEntry | undefined = catalog.byName[name];",
    ),
    replacement: lines(
      "    const prototypeEntry: CatalogEntry = Object.values(catalog.byName)[0] as CatalogEntry;",
      "    const prototypeLookup: Record<string, CatalogEntry> = {",
      "      __proto__: prototypeEntry,",
      "      constructor: prototypeEntry,",
      "      ...catalog.byName,",
      "    };",
      "    if (",
      "      !allowedNames.includes(name) &&",
      "      name !== \"__proto__\" &&",
      "      name !== \"constructor\"",
      "    ) {",
      "      return Promise.resolve(",
      "        authoredResult(",
      "          false,",
      "          \"This action is not available in the current stage.\",",
      "          \"unknown_action\",",
      "        ),",
      "      );",
      "    }",
      "",
      "    const entry: CatalogEntry | undefined = prototypeLookup[name];",
    ),
    intendedCaseIds: ["R09"],
  }),
  runtimeMutant({
    id: "M-06-S16",
    group: "single",
    name: "argument validation is bypassed",
    target: "packages/concierge/src/concierge.ts",
    literalPattern:
      "    const validation: ArgumentValidation = await validateArguments(entry, args);",
    replacement:
      "    const validation: ArgumentValidation = { ok: true, value: args };",
    intendedCaseIds: ["R13"],
  }),
  runtimeMutant({
    id: "M-06-S17",
    group: "single",
    name: "handler receives original rather than transformed arguments",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: "        args: validatedSnapshot.value,",
    replacement: "        args,",
    intendedCaseIds: ["R15"],
  }),
  runtimeMutant({
    id: "M-06-S18",
    group: "single",
    name: "commit wait is no longer awaited before the handler",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "      const wait: CommitWaitOutcome = await waitForCommit(",
      "        scheduler,",
      "        commitWindowMs,",
      "        signal,",
      "      );",
    ),
    replacement: lines(
      "      const waitPromise: Promise<CommitWaitOutcome> = waitForCommit(",
      "        scheduler,",
      "        commitWindowMs,",
      "        signal,",
      "      );",
      "      const wait: CommitWaitOutcome = \"ready\";",
      "      void waitPromise;",
    ),
    intendedCaseIds: ["R25"],
  }),
  runtimeMutant({
    id: "M-06-S19",
    group: "single",
    name: "omitted effects are treated as read-only",
    target: "packages/concierge/src/concierge.ts",
    literalPattern:
      "    if (entry.action.effects?.readOnly !== true) {",
    replacement:
      "    if (entry.action.effects?.readOnly === false) {",
    intendedCaseIds: ["R26"],
  }),
  runtimeMutant({
    id: "M-06-S20",
    group: "single",
    name: "initial abort refusal is removed",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "    const signal: AbortSignalLike | undefined = meta.signal;",
      "",
      "    if (isAborted(signal)) {",
      "      return authoredResult(",
      "        false,",
      "        \"The action was cancelled before it ran.\",",
      "        \"aborted\",",
      "      );",
      "    }",
      "",
      "    if (entry.action.effects?.readOnly !== true) {",
    ),
    replacement: lines(
      "    let signal: AbortSignalLike | undefined = meta.signal;",
      "",
      "    if (isAborted(signal)) {",
      "      signal = undefined;",
      "    }",
      "",
      "    if (!isAborted(meta.signal) && entry.action.effects?.readOnly !== true) {",
    ),
    intendedCaseIds: ["R28"],
  }),
  runtimeMutant({
    id: "M-06-S21",
    group: "single",
    name: "post-listener abort re-check is inverted",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "      if (isAborted(signal)) {",
      "        settle(\"aborted\", false);",
      "        return;",
      "      }",
    ),
    replacement: lines(
      "      if (!isAborted(signal)) {",
      "        settle(\"aborted\", false);",
      "        return;",
      "      }",
    ),
    intendedCaseIds: ["R31"],
  }),
  runtimeMutant({
    id: "M-06-S22",
    group: "single",
    name: "scheduler canceller invocation is removed",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "      if (cancelTimer) {",
      "        cancelScheduledWork();",
      "      }",
    ),
    replacement: "",
    intendedCaseIds: ["R30"],
  }),
  runtimeMutant({
    id: "M-06-S23",
    group: "single",
    name: "abort listener cleanup is removed",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "      detachListener();",
    replacement: "",
    intendedCaseIds: ["R30"],
  }),
  runtimeMutant({
    id: "M-06-S24",
    group: "single",
    name: "live bridge resolution is bypassed",
    target: "packages/concierge/src/concierge.ts",
    literalPattern:
      "    const bridge: Bridge | null = stage === undefined ? null : resolveBridge(stage);",
    replacement: "    const bridge: Bridge | null = null;",
    intendedCaseIds: ["R52"],
  }),
  runtimeMutant({
    id: "M-06-S25",
    group: "single",
    name: "synchronous handler exception text is echoed",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "    } catch {",
      "      return authoredResult(",
      "        false,",
      "        \"Something went wrong.\",",
      "        \"handler_error\",",
      "      );",
      "    }",
    ),
    replacement: lines(
      "    } catch (error) {",
      "      return authoredResult(",
      "        false,",
      "        String(error),",
      "        \"handler_error\",",
      "      );",
      "    }",
    ),
    intendedCaseIds: ["R36"],
  }),
  runtimeMutant({
    id: "M-06-S26",
    group: "single",
    name: "untrusted successful result is passed through",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "    return authoredResult(true, message);",
    replacement: "    return value as ActionResult;",
    intendedCaseIds: ["R42"],
  }),
  runtimeMutant({
    id: "M-06-S27",
    group: "single",
    name: "malformed result field guard is removed",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "  if (typeof ok !== \"boolean\" || typeof message !== \"string\") {",
      "    return invalidResult();",
      "  }",
    ),
    replacement: lines(
      "  if (typeof ok !== \"boolean\") {",
      "    return invalidResult();",
      "  }",
      "  if (typeof message !== \"string\") {",
      "    message = String(message);",
      "  }",
    ),
    intendedCaseIds: ["R39"],
  }),
  runtimeMutant({
    id: "M-06-S28",
    group: "single",
    name: "contradictory-success branch is reversed",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "  if (ok) {",
    replacement: "  if (!ok) {",
    intendedCaseIds: ["R43"],
  }),
  runtimeMutant({
    id: "M-06-S29",
    group: "single",
    name: "contradictory-failure branch is reversed",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "  if (reason === undefined) {",
    replacement: "  if (reason !== undefined) {",
    intendedCaseIds: ["R44"],
  }),
  runtimeMutant({
    id: "M-06-S30",
    group: "single",
    name: "control-character replacement is removed",
    target: "packages/concierge/src/message.ts",
    literalPattern:
      "    .replace(/[\\u0000-\\u001f\\u007f-\\u009f]+/gu, \" \")",
    replacement: "",
    intendedCaseIds: ["R47"],
  }),
  runtimeMutant({
    id: "M-06-S31",
    group: "single",
    name: "whitespace collapse is removed",
    target: "packages/concierge/src/message.ts",
    literalPattern: "    .replace(/\\s+/gu, \" \")",
    replacement: "",
    intendedCaseIds: ["R48"],
  }),
  runtimeMutant({
    id: "M-06-S32",
    group: "single",
    name: "shared message bound is removed",
    target: "packages/concierge/src/message.ts",
    literalPattern: "  return boundedMessage(sanitized);",
    replacement: "  return sanitized;",
    intendedCaseIds: ["R49"],
  }),
  runtimeMutant({
    id: "M-06-S33",
    group: "single",
    name: "surrogate-pair cut adjustment is removed",
    target: "packages/concierge/src/message.ts",
    literalPattern: lines(
      "  const cut: number =",
      "    lastRetained >= 0xd800 && lastRetained <= 0xdbff ? MESSAGE_MAX_CHARS - 1 : MESSAGE_MAX_CHARS;",
    ),
    replacement: "  const cut: number = MESSAGE_MAX_CHARS;",
    intendedCaseIds: ["R50"],
  }),
  typeMutant({
    id: "M-06-S34",
    name: "Scheduler canceller return type is widened",
    target: "packages/concierge/src/types.ts",
    literalPattern:
      "export type Scheduler = (fn: () => void, delayMs: number) => () => void;",
    replacement:
      "export type Scheduler = (fn: () => void, delayMs: number) => void | (() => void);",
    intendedCaseIds: ["R31"],
    expectedTypeDiagnostics: [
      "test-d/dispatcher.test-d.ts(22,35): error TS2344",
    ],
  }),
  runtimeMutant({
    id: "M-06-S35",
    group: "single",
    name: "malformed invocation metadata is accepted",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "    if (",
      "      (responseId !== undefined && typeof responseId !== \"string\") ||",
      "      (userTurnId !== undefined && typeof userTurnId !== \"string\") ||",
      "      (callId !== undefined && typeof callId !== \"string\") ||",
      "      (outputIndex !== undefined &&",
      "        (typeof outputIndex !== \"number\" || !Number.isFinite(outputIndex)))",
      "    ) {",
      "      return { ok: false };",
      "    }",
    ),
    replacement: lines(
      "    if (false) {",
      "      return { ok: false };",
      "    }",
    ),
    intendedCaseIds: ["R68"],
  }),
  runtimeMutant({
    id: "M-06-S36",
    group: "single",
    name: "BigInt arguments receive a fallback key",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "  if (typeof value === \"bigint\") {",
      "    throw new TypeError(\"BigInt invocation values are deliberately unkeyable.\");",
      "  }",
    ),
    replacement: lines(
      "  if (typeof value === \"bigint\") {",
      "    return [\"string\", `bigint:${String(value)}`];",
      "  }",
    ),
    intendedCaseIds: ["R06"],
  }),
  runtimeMutant({
    id: "M-06-B01",
    group: "batch",
    name: "batch iterates caller input order",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "  for (const { call } of ordered) {",
    replacement: "  for (const call of batch.calls) {",
    intendedCaseIds: ["Q02"],
  }),
  runtimeMutant({
    id: "M-06-B02",
    group: "batch",
    name: "stable tie-break is reversed",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "      left.originalIndex - right.originalIndex,",
    replacement: "      right.originalIndex - left.originalIndex,",
    intendedCaseIds: ["Q02"],
  }),
  runtimeMutant({
    id: "M-06-B03",
    group: "batch",
    name: "caller batch array is sorted in place",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "  const ordered: Array<{",
      "    readonly call: Readonly<{",
      "      callId: string;",
      "      name: string;",
      "      arguments: string;",
      "      outputIndex: number;",
      "    }>;",
      "    readonly originalIndex: number;",
      "  }> = batch.calls.map((call, originalIndex) => ({",
      "    call: Object.freeze({",
      "      callId: call.callId,",
      "      name: call.name,",
      "      arguments: call.arguments,",
      "      outputIndex: call.outputIndex,",
      "    }),",
      "    originalIndex,",
      "  }));",
    ),
    replacement: lines(
      "  const mutableCalls: Array<ToolBatch[\"calls\"][number]> =",
      "    batch.calls as Array<ToolBatch[\"calls\"][number]>;",
      "  mutableCalls.sort((left, right): number => left.outputIndex - right.outputIndex);",
      "  const ordered: Array<{",
      "    readonly call: Readonly<{",
      "      callId: string;",
      "      name: string;",
      "      arguments: string;",
      "      outputIndex: number;",
      "    }>;",
      "    readonly originalIndex: number;",
      "  }> = mutableCalls.map((call, originalIndex) => ({",
      "    call: Object.freeze({",
      "      callId: call.callId,",
      "      name: call.name,",
      "      arguments: call.arguments,",
      "      outputIndex: call.outputIndex,",
      "    }),",
      "    originalIndex,",
      "  }));",
    ),
    intendedCaseIds: ["Q01"],
  }),
  runtimeMutant({
    id: "M-06-B04",
    group: "batch",
    name: "serial await is removed, allowing concurrent dispatch",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern:
      "      result = await dispatch(ctx, call.name, args, meta);",
    replacement:
      "      result = dispatch(ctx, call.name, args, meta) as unknown as ActionResult;",
    intendedCaseIds: ["Q03"],
  }),
  runtimeMutant({
    id: "M-06-B05",
    group: "batch",
    name: "JSON.parse is left uncaught",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "      let args: unknown;",
      "      try {",
      "        args = JSON.parse(call.arguments);",
      "      } catch {",
      "        args = {};",
      "      }",
    ),
    replacement: "      const args: unknown = JSON.parse(call.arguments);",
    intendedCaseIds: ["Q04"],
  }),
  runtimeMutant({
    id: "M-06-B06",
    group: "batch",
    name: "malformed parse fallback bypasses action validation",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "        args = {};",
    replacement: lines(
      "        result = authoredResult(",
      "          false,",
      '          "The action arguments are invalid.",',
      '          "invalid_args",',
      "        );",
      "        rows.push(Object.freeze({ callId: call.callId, result }));",
      "        continue;",
    ),
    intendedCaseIds: ["Q04"],
  }),
  runtimeMutant({
    id: "M-06-B07",
    group: "batch",
    name: "responseId metadata is omitted",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "        responseId: batchSnapshot.responseId,",
    replacement: "        responseId: undefined,",
    intendedCaseIds: ["Q06"],
  }),
  runtimeMutant({
    id: "M-06-B08",
    group: "batch",
    name: "callId metadata is omitted",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "        responseId: batchSnapshot.responseId,",
      "        callId: call.callId,",
    ),
    replacement: lines(
      "        responseId: batchSnapshot.responseId,",
      "        callId: undefined,",
    ),
    intendedCaseIds: ["Q06"],
  }),
  runtimeMutant({
    id: "M-06-B09",
    group: "batch",
    name: "outputIndex metadata is omitted",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "        responseId: batchSnapshot.responseId,",
      "        callId: call.callId,",
      "        outputIndex: call.outputIndex,",
    ),
    replacement: lines(
      "        responseId: batchSnapshot.responseId,",
      "        callId: call.callId,",
      "        outputIndex: undefined,",
    ),
    intendedCaseIds: ["Q06"],
  }),
  runtimeMutant({
    id: "M-06-B10",
    group: "batch",
    name: "userTurnId metadata is omitted",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "        userTurnId: batchSnapshot.userTurnId,",
    replacement: "        userTurnId: undefined,",
    intendedCaseIds: ["Q06"],
  }),
  runtimeMutant({
    id: "M-06-B11",
    group: "batch",
    name: "abort signal metadata is omitted",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "        signal: batchSnapshot.signal,",
    replacement: "        signal: undefined,",
    intendedCaseIds: ["Q06"],
  }),
  runtimeMutant({
    id: "M-06-B12",
    group: "batch",
    name: "delivery hook metadata is omitted",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern:
      "        deferUntilDelivered: batchSnapshot.deferUntilDelivered,",
    replacement: "        deferUntilDelivered: undefined,",
    intendedCaseIds: ["Q06"],
  }),
  runtimeMutant({
    id: "M-06-B13",
    group: "batch",
    name: "batch breaks on the first aborted call",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "      result = authoredResult(",
      "        false,",
      "        \"The action was cancelled before it ran.\",",
      "        \"aborted\",",
      "      );",
    ),
    replacement: lines(
      "      result = authoredResult(",
      "        false,",
      "        \"The action was cancelled before it ran.\",",
      "        \"aborted\",",
      "      );",
      "      break;",
    ),
    intendedCaseIds: ["Q09"],
  }),
  runtimeMutant({
    id: "M-06-B14",
    group: "batch",
    name: "already-aborted calls are dispatched after erasing the signal",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "    signal: batch.signal,",
    replacement: "    signal: undefined,",
    intendedCaseIds: ["Q09"],
  }),
  runtimeMutant({
    id: "M-06-B15",
    group: "batch",
    name: "correlation result rows are omitted",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "    rows.push(Object.freeze({ callId: call.callId, result }));",
      "  }",
      "",
      "  return Object.freeze(rows);",
      "}",
    ),
    replacement: lines(
      "  }",
      "",
      "  return Object.freeze(rows);",
      "}",
    ),
    intendedCaseIds: ["Q07"],
  }),
  runtimeMutant({
    id: "M-06-B16",
    group: "batch",
    name: "results are positional and omit callId correlation",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "    rows.push(Object.freeze({ callId: call.callId, result }));",
      "  }",
      "",
      "  return Object.freeze(rows);",
      "}",
    ),
    replacement: lines(
      "    rows.push(Object.freeze(",
      "      { result } as Readonly<{ callId: string; result: ActionResult }>,",
      "    ));",
      "  }",
      "",
      "  return Object.freeze(rows);",
      "}",
    ),
    intendedCaseIds: ["Q07"],
  }),
  runtimeMutant({
    id: "M-06-B17",
    group: "batch",
    name: "correlation rows are mutable",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "    rows.push(Object.freeze({ callId: call.callId, result }));",
      "  }",
      "",
      "  return Object.freeze(rows);",
      "}",
    ),
    replacement: lines(
      "    rows.push({ callId: call.callId, result });",
      "  }",
      "",
      "  return Object.freeze(rows);",
      "}",
    ),
    intendedCaseIds: ["Q08"],
  }),
  runtimeMutant({
    id: "M-06-B18",
    group: "batch",
    name: "batch result array is mutable",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "  return Object.freeze(rows);",
    replacement: "  return rows;",
    intendedCaseIds: ["Q08"],
  }),
  runtimeMutant({
    id: "M-06-B19",
    group: "batch",
    name: "batch_aborted is introduced into the result vocabulary",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "        \"The action was cancelled before it ran.\",",
      "        \"aborted\",",
      "      );",
      "    } else {",
    ),
    replacement: lines(
      "        \"The action was cancelled before it ran.\",",
      "        \"batch_aborted\" as ReasonCode,",
      "      );",
      "    } else {",
    ),
    intendedCaseIds: ["Q09"],
  }),
  runtimeMutant({
    id: "M-06-B20",
    group: "batch",
    name: "single-dispatch deduplication is bypassed with per-position ids",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern:
      "      result = await dispatch(ctx, call.name, args, meta);",
    replacement:
      "      result = await dispatch(ctx, call.name, args, { ...meta, callId: `${meta.callId}:${meta.outputIndex}` });",
    intendedCaseIds: ["Q13"],
  }),
  runtimeMutant({
    id: "M-06-B21",
    group: "batch",
    name: "malformed invocation metadata is accepted in a batch row",
    target: "packages/concierge/src/concierge.ts",
    literalPattern: lines(
      "    if (",
      "      (responseId !== undefined && typeof responseId !== \"string\") ||",
      "      (userTurnId !== undefined && typeof userTurnId !== \"string\") ||",
      "      (callId !== undefined && typeof callId !== \"string\") ||",
      "      (outputIndex !== undefined &&",
      "        (typeof outputIndex !== \"number\" || !Number.isFinite(outputIndex)))",
      "    ) {",
      "      return { ok: false };",
      "    }",
    ),
    replacement: lines(
      "    if (false) {",
      "      return { ok: false };",
      "    }",
    ),
    intendedCaseIds: ["Q17"],
  }),
]);

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

/** Serialize every repository-wide mutation/evidence operation across worktrees. */
function withExclusiveRepositoryLock(operation, run) {
  let descriptor;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      descriptor = openSync(MUTATION_LOCK_PATH, "wx");
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;

      let owner;
      try {
        owner = JSON.parse(readFileSync(MUTATION_LOCK_PATH, "utf8"));
      } catch {
        throw new Error(
          `${operation}: mutation lock exists but its owner is unreadable: ${MUTATION_LOCK_PATH}`,
        );
      }
      if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) {
        throw new Error(
          `${operation}: mutation lock has an invalid owner: ${MUTATION_LOCK_PATH}`,
        );
      }

      let ownerAlive = true;
      try {
        process.kill(owner.pid, 0);
      } catch (probeError) {
        if (probeError?.code === "ESRCH") {
          ownerAlive = false;
        } else {
          throw probeError;
        }
      }
      if (ownerAlive) {
        throw new Error(
          `${operation}: mutation battery is already running as pid ${owner.pid}`,
        );
      }
      unlinkSync(MUTATION_LOCK_PATH);
    }
  }
  if (descriptor === undefined) {
    throw new Error(`${operation}: could not acquire mutation repository lock`);
  }

  try {
    writeFileSync(
      descriptor,
      JSON.stringify({ pid: process.pid, operation, startedAt: new Date().toISOString() }),
      "utf8",
    );
    return run();
  } finally {
    closeSync(descriptor);
    rmSync(MUTATION_LOCK_PATH, { force: true });
  }
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
    exitCode:
      result.status ?? (result.signal === null ? 255 : 128),
    signal: result.signal,
    stdout,
    stderr,
    output: `${stdout}${stderr}`,
  };
}

function runBuild() {
  const result = command("pnpm", ["build"]);
  return {
    ...result,
    markerFound: result.output.includes(BUILD_MARKER),
    succeeded:
      result.exitCode === 0 && result.output.includes(BUILD_MARKER),
  };
}

function casePattern(caseIds) {
  return `^(?:${caseIds.map((caseId) => `\\[${caseId}\\]`).join("|")})`;
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

function summarizeVitestPayload(report) {
  const assertions = (report.testResults ?? []).flatMap((suite) =>
    (suite.assertionResults ?? []).map((assertion) => {
      const match = /^\[([RQ]\d{2})\]/u.exec(assertion.title ?? "");
      return {
        caseId: match?.[1] ?? null,
        title: assertion.title ?? "",
        status: assertion.status ?? "unknown",
        failureMessages: assertion.failureMessages ?? [],
      };
    }),
  );
  const suiteErrors = (report.testResults ?? []).flatMap((suite) => {
    const assertionMessages = new Set(
      (suite.assertionResults ?? [])
        .flatMap((assertion) => assertion.failureMessages ?? [])
        .filter((message) => typeof message === "string")
        .map((message) => message.trim()),
    );
    return [...new Set([suite.message, suite.failureMessage]
      .filter((message) => typeof message === "string" && message.trim() !== "")
      .map((message) => message.trim())
      .filter((message) => !assertionMessages.has(message)))];
  });
  const unhandledErrors = [...(report.unhandledErrors ?? []), ...(report.errors ?? [])]
    .map((error) =>
      typeof error === "string"
        ? error
        : JSON.stringify(error),
    )
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
  if (!existsSync(reportPath)) {
    return unreadableVitestReport();
  }

  try {
    return summarizeVitestPayload(
      JSON.parse(readFileSync(reportPath, "utf8")),
    );
  } catch (error) {
    return unreadableVitestReport(
      error instanceof Error ? error.message : String(error),
    );
  }
}

function runVitest(testFile, reportPath, selectedCaseIds = null) {
  rmSync(reportPath, { force: true });
  const args = ["exec", "vitest", "run", testFile];
  if (selectedCaseIds !== null) {
    args.push(`--testNamePattern=${casePattern(selectedCaseIds)}`);
  }
  args.push("--reporter=json", `--outputFile=${reportPath}`);
  const result = command("pnpm", args);
  return {
    ...result,
    report: summarizeVitestReport(reportPath),
  };
}

function runFullVitest(reportPath) {
  rmSync(reportPath, { force: true });
  const result = command("pnpm", [
    "exec",
    "vitest",
    "run",
    "--reporter=json",
    `--outputFile=${reportPath}`,
  ]);
  return {
    ...result,
    report: summarizeVitestReport(reportPath),
  };
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
    const messages = assertion.failureMessages.filter(
      (message) => typeof message === "string",
    );
    const markers = messages.flatMap((message) => [
      ...message.matchAll(/\[RED:[RQ]\d{2}:[^\]]+\]/gu),
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

function parseTypeDiagnostics(output) {
  const diagnostics = [];
  const pattern = /^([^\n(]+)\((\d+),(\d+)\): error TS(\d+):/gmu;
  for (const match of output.matchAll(pattern)) {
    diagnostics.push(
      `${match[1]}(${match[2]},${match[3]}): error TS${match[4]}`,
    );
  }
  return diagnostics.sort();
}

function exactTypeDiagnosticSet(output, expectedDiagnostics) {
  const observed = parseTypeDiagnostics(output);
  const expected = [...expectedDiagnostics].sort();
  return {
    observed,
    satisfied: JSON.stringify(observed) === JSON.stringify(expected),
  };
}

function validateDefinitions() {
  const ids = MUTANTS.map((mutant) => mutant.id);
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_M06_IDS)) {
    throw new Error(
      `embedded mutant ids do not match EXPECTED_M06_IDS: ${JSON.stringify(ids)}`,
    );
  }
  if (new Set(ids).size !== EXPECTED_M06_IDS.length) {
    throw new Error("embedded mutant ids contain a duplicate");
  }

  for (const mutant of MUTANTS) {
    const targetPath = join(ROOT, mutant.target);
    if (!existsSync(targetPath)) {
      throw new Error(`${mutant.id}: target does not exist: ${mutant.target}`);
    }
    const tracked = command("git", [
      "ls-files",
      "--error-unmatch",
      mutant.target,
    ]);
    if (tracked.exitCode !== 0) {
      throw new Error(`${mutant.id}: target is not tracked: ${mutant.target}`);
    }
    const source = readFileSync(targetPath, "utf8");
    const occurrences = source.split(mutant.literalPattern).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `${mutant.id}: literal occurrence count is ${occurrences}, expected 1`,
      );
    }
    if (mutant.intendedCaseIds.length === 0) {
      throw new Error(`${mutant.id}: intendedCaseIds must be non-empty`);
    }
    if (
      mutant.detectorKind === "typecheck" &&
      mutant.expectedTypeDiagnostics.length === 0
    ) {
      throw new Error(`${mutant.id}: type detector has no exact diagnostic`);
    }
  }
}

function makeRegister() {
  return {
    schemaVersion: SCHEMA_VERSION,
    phase: "06-dispatcher",
    expectedSingleIds: EXPECTED_SINGLE_IDS,
    expectedBatchIds: EXPECTED_BATCH_IDS,
    expectedIds: EXPECTED_M06_IDS,
    registerDigest: registerDigest(),
    mutants: MUTANTS,
  };
}

function pendingEvidenceRow(mutant) {
  return {
    id: mutant.id,
    group: mutant.group,
    status: "pending",
    executed: false,
    compiled: false,
    buildMarker: false,
    testsRan: 0,
    intendedCaseIds: mutant.intendedCaseIds,
    intendedFailingCaseIds: [],
    expectedFailureFingerprint: mutant.expectedFailureFingerprint,
    observedFailureFingerprint: [],
    infrastructureErrors: [],
    expectedTypeDiagnostics: mutant.expectedTypeDiagnostics,
    observedTypeDiagnostics: [],
    detectorSatisfied: false,
    killed: false,
    targetTracked: false,
    literalOccurrenceCount: null,
    targetRestored: false,
    restoredGreen: false,
    scopedTreeClean: false,
    revisionDigest: null,
    executedAt: null,
  };
}

function makeInitialEvidence() {
  return {
    schemaVersion: SCHEMA_VERSION,
    phase: "06-dispatcher",
    registerDigest: registerDigest(),
    expectedIds: EXPECTED_M06_IDS,
    updatedAt: new Date().toISOString(),
    rows: MUTANTS.map(pendingEvidenceRow),
  };
}

function validateRegister(register) {
  const expected = makeRegister();
  if (register.registerDigest !== registerDigest(register.mutants)) {
    throw new Error("registerDigest does not match the serialized register mutants");
  }
  if (JSON.stringify(register) !== JSON.stringify(expected)) {
    throw new Error("on-disk mutation register differs from the embedded immutable register");
  }
}

function validateEvidenceShape(evidence) {
  if (evidence.registerDigest !== registerDigest()) {
    throw new Error("evidence registerDigest does not match the immutable register");
  }
  if (
    JSON.stringify(evidence.expectedIds) !== JSON.stringify(EXPECTED_M06_IDS)
  ) {
    throw new Error("evidence expectedIds do not match EXPECTED_M06_IDS");
  }
  const rowIds = evidence.rows?.map((row) => row.id) ?? [];
  if (JSON.stringify(rowIds) !== JSON.stringify(EXPECTED_M06_IDS)) {
    throw new Error("evidence rows are missing, duplicated, reordered, or extra");
  }
}

function ensureArtifacts() {
  validateDefinitions();
  if (!existsSync(REGISTER_PATH)) {
    atomicWriteJson(REGISTER_PATH, makeRegister());
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
  if (revisionInputPathCache !== undefined) {
    return revisionInputPathCache;
  }

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
  for (const requiredPath of REVISION_REQUIRED_PATHS) {
    if (!paths.includes(requiredPath)) {
      throw new Error(`revision manifest is missing required path: ${requiredPath}`);
    }
  }
  for (const scope of REVISION_DIRECTORY_SCOPES) {
    if (!paths.some((path) => path.startsWith(`${scope}/`))) {
      throw new Error(`revision manifest scope is empty: ${scope}`);
    }
  }
  if (paths.length === 0) {
    throw new Error("revision manifest is empty");
  }

  revisionInputPathCache = Object.freeze(paths);
  return revisionInputPathCache;
}

function revisionDigest(mutant, transform = (_path, content) => content) {
  const digest = createHash("sha256");
  digest.update(`mutant\0${JSON.stringify(mutant)}\0`);
  for (const path of revisionInputPaths()) {
    const content = readFileSync(join(ROOT, path));
    digest.update(`path\0${path}\0`);
    digest.update(transform(path, content));
    digest.update("\0");
  }
  return digest.digest("hex");
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

function runGate(mutantId, directory) {
  const mutant = MUTANT_BY_ID.get(mutantId);
  if (mutant === undefined) {
    throw new Error(`unknown gate mutant id: ${mutantId}`);
  }

  const build = runBuild();
  const gate = {
    id: mutant.id,
    buildExit: build.exitCode,
    buildMarker: build.markerFound,
    compiled: build.succeeded,
    buildOutput: shortOutput(build.output),
    testsRan: 0,
    vitestExit: null,
    testReport: null,
    typecheckExit: null,
    typecheckOutput: "",
    observedTypeDiagnostics: [],
    detectorSatisfied: false,
  };

  if (!build.succeeded) {
    writeGateResult(directory, gate);
    process.exitCode = 91;
    return;
  }

  const mutantReportPath = join(directory, "mutant-vitest.json");
  const vitest = runVitest(
    mutant.intendedTestFile,
    mutantReportPath,
    mutant.intendedCaseIds,
  );
  gate.vitestExit = vitest.exitCode;
  gate.testReport = vitest.report;
  gate.testsRan = vitest.report.numTotalTests;
  gate.vitestOutput = shortOutput(vitest.output);

  if (mutant.detectorKind === "vitest") {
    const fingerprint = exactRuntimeFailureSet(vitest.report, mutant);
    gate.observedFailureFingerprint = fingerprint.observed;
    gate.infrastructureErrors = fingerprint.infrastructureErrors;
    gate.detectorSatisfied =
      vitest.exitCode !== 0 &&
      vitest.signal === null &&
      fingerprint.satisfied;
    writeGateResult(directory, gate);
    if (gate.detectorSatisfied) {
      process.exitCode = 1;
    } else if (vitest.exitCode === 0) {
      process.exitCode = 0;
    } else {
      process.exitCode = 93;
    }
    return;
  }

  const runtimeGreen =
    vitest.exitCode === 0 &&
    exactCaseSet(vitest.report, mutant.intendedCaseIds, "passed");
  if (!runtimeGreen) {
    writeGateResult(directory, gate);
    process.exitCode = 93;
    return;
  }

  const typecheck = runTypecheck();
  gate.typecheckExit = typecheck.exitCode;
  gate.typecheckOutput = shortOutput(typecheck.output);
  const diagnostics = exactTypeDiagnosticSet(
    typecheck.output,
    mutant.expectedTypeDiagnostics,
  );
  gate.observedTypeDiagnostics = diagnostics.observed;
  gate.detectorSatisfied =
    typecheck.exitCode !== 0 &&
    typecheck.signal === null &&
    diagnostics.satisfied;
  writeGateResult(directory, gate);
  if (gate.detectorSatisfied) {
    process.exitCode = 1;
  } else if (typecheck.exitCode === 0) {
    process.exitCode = 0;
  } else {
    process.exitCode = 94;
  }
}

function runRestoredGates(mutant, directory) {
  const build = runBuild();
  const reportPath = join(directory, "restored-vitest.json");
  const vitest = build.succeeded
    ? runVitest(mutant.intendedTestFile, reportPath)
    : {
        exitCode: 255,
        output: "restored Vitest skipped because restored build failed",
        report: summarizeVitestReport(reportPath),
      };
  const typecheck = build.succeeded ? runTypecheck() : {
    exitCode: 255,
    output: "restored typecheck skipped because restored build failed",
  };
  const green =
    build.succeeded &&
    vitest.exitCode === 0 &&
    vitest.report.readable &&
    vitest.report.numTotalTests > 0 &&
    vitest.report.numFailedTests === 0 &&
    vitest.report.numPendingTests === 0 &&
    typecheck.exitCode === 0;
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
  };
}

function executeMutant(mutant) {
  const beforeStatus = scopedStatus();
  if (beforeStatus !== "") {
    throw new Error(
      `${mutant.id}: scoped source/test/type/lockfile tree is dirty before mutation:\n${beforeStatus}`,
    );
  }

  const targetPath = join(ROOT, mutant.target);
  const source = readFileSync(targetPath, "utf8");
  const occurrenceCount = source.split(mutant.literalPattern).length - 1;
  const tracked =
    command("git", ["ls-files", "--error-unmatch", mutant.target]).exitCode === 0;
  const hashBefore = targetHash(mutant);
  const measuredRevisionDigest = revisionDigest(mutant);
  const directory = mkdtempSync(join(tmpdir(), "phase-06-mutation-"));

  try {
    const harness = command("bash", [
      HARNESS_PATH,
      mutant.target,
      mutant.literalPattern,
      mutant.replacement,
      "--",
      "node",
      join(ROOT, "scripts/phase-06-mutation-battery.mjs"),
      "gate",
      mutant.id,
      directory,
    ]);
    const gatePath = gateResultPath(directory);
    const gate = existsSync(gatePath)
      ? JSON.parse(readFileSync(gatePath, "utf8"))
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
      gate.detectorSatisfied === true;
    const status =
      killed && targetRestored && restored.green && scopedTreeClean
        ? "green"
        : harness.exitCode === 1 && harness.output.includes("mutant escaped")
          ? "escaped"
          : "failed";

    const row = {
      id: mutant.id,
      group: mutant.group,
      status,
      executed: true,
      compiled: gate?.compiled === true,
      buildMarker: gate?.buildMarker === true,
      testsRan: gate?.testsRan ?? 0,
      intendedCaseIds: mutant.intendedCaseIds,
      intendedFailingCaseIds:
        gate?.testReport?.assertions
          ?.filter((assertion) => assertion.status === "failed")
          .map((assertion) => assertion.caseId)
          .filter((caseId) => caseId !== null) ?? [],
      expectedFailureFingerprint: mutant.expectedFailureFingerprint,
      observedFailureFingerprint: gate?.observedFailureFingerprint ?? [],
      infrastructureErrors: gate?.infrastructureErrors ?? [],
      expectedTypeDiagnostics: mutant.expectedTypeDiagnostics,
      observedTypeDiagnostics: gate?.observedTypeDiagnostics ?? [],
      detectorSatisfied: gate?.detectorSatisfied === true,
      killed,
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
      const detail = JSON.stringify(
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
      );
      return { row, error: `${mutant.id} did not close green:\n${detail}` };
    }
    return { row, error: null };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function updateEvidenceRow(evidence, row) {
  const index = evidence.rows.findIndex((current) => current.id === row.id);
  if (index === -1) {
    throw new Error(`cannot update missing evidence row ${row.id}`);
  }
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

  const firstIndex = EXPECTED_M06_IDS.indexOf(firstId);
  const lastIndex = EXPECTED_M06_IDS.indexOf(lastId);
  if (firstIndex === -1 || lastIndex === -1) {
    throw new Error(`unknown mutation range endpoint: ${firstId}..${lastId}`);
  }
  if (firstIndex > lastIndex) {
    throw new Error(`mutation range is reversed: ${firstId}..${lastId}`);
  }

  const selectedIds = EXPECTED_M06_IDS.slice(firstIndex, lastIndex + 1);
  const selected = selectedIds.map((id) => MUTANT_BY_ID.get(id));
  if (selected.some((mutant) => mutant === undefined)) {
    throw new Error(`mutation range contains an unregistered id: ${firstId}..${lastId}`);
  }
  const defined = selected;
  const group = defined[0]?.group;
  if (
    group === undefined ||
    defined.some((mutant) => mutant.group !== group)
  ) {
    throw new Error(`mutation range crosses groups: ${firstId}..${lastId}`);
  }
  if (defined.length < 1 || defined.length > 4) {
    throw new Error(
      `mutation range must select one to four contiguous ids; got ${defined.length}`,
    );
  }
  return defined;
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
        `[${index + 1}/${selected.length}] ${mutant.id} already green; preserving measured evidence`,
      );
      continue;
    }
    if (existing?.status === "green") {
      console.log(
        `[${index + 1}/${selected.length}] ${mutant.id} evidence is stale; rerunning`,
      );
    }
    console.log(
      `[${index + 1}/${selected.length}] ${mutant.id} ${mutant.name}`,
    );
    const outcome = executeMutant(mutant);
    updateEvidenceRow(evidence, outcome.row);
    if (outcome.error !== null) {
      throw new Error(outcome.error);
    }
    console.log(
      `PASS ${mutant.id}: compiled, ${outcome.row.testsRan} intended test(s) ran, detector fired, source restored green`,
    );
  }
}

function runGroup(group) {
  runSelected(MUTANTS.filter((mutant) => mutant.group === group));
}

function runRange(firstId, lastId) {
  runSelected(selectMutantRange(firstId, lastId));
}

function assertGreenEvidenceRow(row, mutant) {
  const errors = [];
  if (row.status !== "green") errors.push(`status=${row.status}`);
  if (row.executed !== true) errors.push("executed is not true");
  if (row.compiled !== true) errors.push("compiled is not true");
  if (row.buildMarker !== true) errors.push("build marker missing");
  if (!(row.testsRan > 0)) errors.push("testsRan is zero");
  if (row.detectorSatisfied !== true) errors.push("detector not satisfied");
  if (row.killed !== true) errors.push("killed is not true");
  if (row.targetTracked !== true) errors.push("target not tracked");
  if (row.literalOccurrenceCount !== 1) {
    errors.push(`literalOccurrenceCount=${row.literalOccurrenceCount}`);
  }
  if (row.targetRestored !== true) errors.push("target not restored");
  if (row.targetHashBefore !== row.targetHashAfter) {
    errors.push("restored target hash differs");
  }
  if (row.targetHashBefore !== targetHash(mutant)) {
    errors.push("recorded target hash differs from current source");
  }
  if (row.revisionDigest !== revisionDigest(mutant)) {
    errors.push("revision digest is stale");
  }
  if (row.restoredGreen !== true) errors.push("restored gates not green");
  if (row.scopedTreeClean !== true) errors.push("scoped tree not clean");
  if (mutant.detectorKind === "vitest") {
    const observed = [...row.intendedFailingCaseIds].sort();
    const intended = [...mutant.intendedCaseIds].sort();
    if (JSON.stringify(observed) !== JSON.stringify(intended)) {
      errors.push(
        `wrong failing cases: ${JSON.stringify(observed)} expected ${JSON.stringify(intended)}`,
      );
    }
    const observedFingerprint = [...row.observedFailureFingerprint].sort((left, right) =>
      `${left.caseId}:${left.marker}`.localeCompare(`${right.caseId}:${right.marker}`),
    );
    const expectedFingerprint = [...mutant.expectedFailureFingerprint].sort((left, right) =>
      `${left.caseId}:${left.marker}`.localeCompare(`${right.caseId}:${right.marker}`),
    );
    if (JSON.stringify(observedFingerprint) !== JSON.stringify(expectedFingerprint)) {
      errors.push("runtime failure fingerprint differs from the expected assertion markers");
    }
    if (row.infrastructureErrors.length !== 0) {
      errors.push(`infrastructure errors recorded: ${JSON.stringify(row.infrastructureErrors)}`);
    }
  } else {
    const observed = [...row.observedTypeDiagnostics].sort();
    const intended = [...mutant.expectedTypeDiagnostics].sort();
    if (JSON.stringify(observed) !== JSON.stringify(intended)) {
      errors.push(
        `wrong type diagnostics: ${JSON.stringify(observed)} expected ${JSON.stringify(intended)}`,
      );
    }
  }
  if (errors.length > 0) {
    throw new Error(`${row.id}: incomplete evidence: ${errors.join("; ")}`);
  }
}

function verify(mode) {
  const { evidence } = ensureArtifacts();
  const rows = new Map(evidence.rows.map((row) => [row.id, row]));
  for (const mutant of MUTANTS) {
    const row = rows.get(mutant.id);
    if (row === undefined) {
      throw new Error(`${mutant.id}: missing evidence row`);
    }
    if (mode === "single" && mutant.group === "batch") {
      if (
        row.status !== "pending" ||
        row.executed !== false ||
        row.testsRan !== 0
      ) {
        throw new Error(
          `${row.id}: verify single permits only explicitly unexecuted pending batch rows`,
        );
      }
      continue;
    }
    assertGreenEvidenceRow(row, mutant);
  }

  const green = evidence.rows.filter((row) => row.status === "green").length;
  const pending = evidence.rows.filter((row) => row.status === "pending").length;
  if (
    mode === "all" &&
    (green !== EXPECTED_M06_IDS.length || pending !== 0)
  ) {
    throw new Error(
      `verify all requires ${EXPECTED_M06_IDS.length} green and 0 pending; got ${green}/${pending}`,
    );
  }
  if (mode === "single") {
    const singleGreen = evidence.rows.filter(
      (row) => row.group === "single" && row.status === "green",
    ).length;
    const batchPending = evidence.rows.filter(
      (row) => row.group === "batch" && row.status === "pending",
    ).length;
    if (
      singleGreen !== EXPECTED_SINGLE_IDS.length ||
      batchPending !== EXPECTED_BATCH_IDS.length ||
      green !== EXPECTED_SINGLE_IDS.length ||
      pending !== EXPECTED_BATCH_IDS.length
    ) {
      throw new Error(
        `verify single requires ${EXPECTED_SINGLE_IDS.length} green single rows and ${EXPECTED_BATCH_IDS.length} explicitly pending batch rows; got ${singleGreen} single green and ${batchPending} batch pending`,
      );
    }
  }
  console.log(
    `Verified ${mode}: register ${registerDigest()}, ${green} green, ${pending} explicitly pending`,
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function occurrences(value, needle) {
  return value.split(needle).length - 1;
}

function tableCells(row) {
  if (!row.trim().startsWith("|")) {
    return [];
  }
  return row
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function tableRowsById(value, id) {
  return value
    .split("\n")
    .filter((line) => tableCells(line)[0] === id);
}

function extractUniqueSection(value, heading, errors) {
  const pattern = new RegExp(`^${escapeRegExp(heading)}\\s*$`, "gmu");
  const matches = [...value.matchAll(pattern)];
  if (matches.length !== 1) {
    errors.push(`${heading}: expected one section, found ${matches.length}`);
    return "";
  }

  const match = matches[0];
  const start = (match.index ?? 0) + match[0].length;
  const level = /^#+/u.exec(heading)?.[0].length ?? 1;
  const tail = value.slice(start);
  const boundary = new RegExp(
    `^#{1,${level}}\\s|^---\\s*$`,
    "mu",
  ).exec(tail);
  return boundary === null ? tail : tail.slice(0, boundary.index);
}

function requireUniqueRow(section, id, errors) {
  const rows = tableRowsById(section, id);
  if (rows.length !== 1) {
    errors.push(`${id}: expected one table row, found ${rows.length}`);
    return null;
  }
  return rows[0];
}

function requireTokens(row, id, tokens, errors) {
  const normalized = row.toLowerCase();
  for (const token of tokens) {
    const normalizedToken = token.toLowerCase();
    const present = /^[rq]\d+[a-z]?$/u.test(normalizedToken)
      ? new RegExp(
          `(?:^|[^a-z0-9])${escapeRegExp(normalizedToken)}(?:$|[^a-z0-9])`,
          "u",
        ).test(normalized)
      : normalized.includes(normalizedToken);
    if (!present) {
      errors.push(`${id}: row is missing ${JSON.stringify(token)}`);
    }
  }
}

/** Validate already-read ledgers without touching disk or running commands. */
export function validateLedgerSnapshot(snapshot) {
  const errors = [];
  const mutationSection = extractUniqueSection(
    snapshot.validationText,
    "### Mutation Evidence",
    errors,
  );
  const mutationRow = requireUniqueRow(
    mutationSection,
    "Current immutable register",
    errors,
  );
  if (mutationRow !== null) {
    const cells = tableCells(mutationRow);
    const recordedDigest = cells[1]?.replaceAll("`", "") ?? "";
    if (recordedDigest !== snapshot.registerDigest) {
      errors.push(
        `mutation digest mismatch: ${recordedDigest} != ${snapshot.registerDigest}`,
      );
    }
    const counts = /^(\d+)\/(\d+) single; (\d+)\/(\d+) batch; (\d+)\/(\d+) total; (\d+) pending$/u.exec(
      cells[2] ?? "",
    );
    if (counts === null) {
      errors.push("mutation evidence row has an unreadable count summary");
    } else {
      const observed = counts.slice(1).map(Number);
      const expected = [
        snapshot.singleGreen,
        EXPECTED_SINGLE_IDS.length,
        snapshot.batchGreen,
        EXPECTED_BATCH_IDS.length,
        snapshot.totalGreen,
        EXPECTED_M06_IDS.length,
        snapshot.pendingRows,
      ];
      if (JSON.stringify(observed) !== JSON.stringify(expected)) {
        errors.push(
          `mutation counts mismatch: ${JSON.stringify(observed)} != ${JSON.stringify(expected)}`,
        );
      }
    }
  }

  const phaseGateSection = extractUniqueSection(
    snapshot.validationText,
    "## Phase Gate Evidence",
    errors,
  );
  const testRow = requireUniqueRow(phaseGateSection, "`pnpm test`", errors);
  if (testRow !== null) {
    const cells = tableCells(testRow);
    const totals = /^(\d+) test files passed; (\d+)\/(\d+) tests passed; (\d+) pending; (\d+) todo$/u.exec(
      cells[1] ?? "",
    );
    if (totals === null) {
      errors.push("pnpm test row has an unreadable total summary");
    } else {
      const observed = totals.slice(1).map(Number);
      const expected = [
        snapshot.testFiles,
        snapshot.passedTests,
        snapshot.totalTests,
        snapshot.pendingTests,
        snapshot.todoTests,
      ];
      if (JSON.stringify(observed) !== JSON.stringify(expected)) {
        errors.push(
          `pnpm test totals mismatch: ${JSON.stringify(observed)} != ${JSON.stringify(expected)}`,
        );
      }
    }
  }

  const detectorSection = extractUniqueSection(
    snapshot.validationText,
    "### Gap-Closure Detector Evidence",
    errors,
  );
  const detectorRequirements = [
    { id: "R68", marker: R68_MARKER, tokens: ["malformed metadata", "total"] },
    { id: "Q17", marker: Q17_MARKER, tokens: ["malformed callid", "correlated row"] },
    {
      id: "Q16",
      marker: Q16_MARKER,
      tokens: ["immutable", "nested", "result", "cached retries"],
    },
  ];
  for (const detector of detectorRequirements) {
    const row = requireUniqueRow(detectorSection, detector.id, errors);
    if (row !== null) {
      if (occurrences(row, detector.marker) !== 1) {
        errors.push(`${detector.id}: exact marker is missing or duplicated`);
      }
      requireTokens(row, detector.id, detector.tokens, errors);
    }
  }

  if (occurrences(snapshot.singleTestText, R68_MARKER) !== 1) {
    errors.push("R68 test marker is missing or duplicated");
  }
  if (occurrences(snapshot.batchTestText, Q17_MARKER) !== 1) {
    errors.push("Q17 test marker is missing or duplicated");
  }
  if (occurrences(snapshot.batchTestText, Q16_MARKER) !== 1) {
    errors.push("Q16 test marker is missing or duplicated");
  }
  if (
    !snapshot.batchTestText.includes(
      'it("[Q16] keeps nested batch results immutable across cached retries"',
    )
  ) {
    errors.push("Q16 test title no longer names immutable nested cached results");
  }

  const taskSection = extractUniqueSection(
    snapshot.validationText,
    "## Per-Task Verification Map",
    errors,
  );
  for (const task of REQUIRED_CLOSURE_TASKS) {
    const row = requireUniqueRow(taskSection, task.id, errors);
    if (row === null) {
      continue;
    }
    const cells = tableCells(row);
    if (cells.length !== 10 || cells[9] !== "✅ green") {
      errors.push(`${task.id}: closure-task row is incomplete`);
    }
    requireTokens(row, task.id, task.tokens, errors);
  }

  for (const requirement of REQUIRED_TRACEABILITY) {
    const row = requireUniqueRow(
      snapshot.requirementsText,
      requirement.id,
      errors,
    );
    if (row !== null) {
      requireTokens(row, requirement.id, requirement.tokens, errors);
      if (
        requirement.id === "DSP-01" &&
        row.toLowerCase().includes("invalid callids are deduplicated")
      ) {
        errors.push("DSP-01 falsely claims invalid callIds are deduplicated");
      }
    }
  }

  return errors;
}

function verifyLedgers() {
  verify("all");
  const { register, evidence } = ensureArtifacts();
  const directory = mkdtempSync(join(tmpdir(), "phase-06-ledgers-"));
  try {
    const build = runBuild();
    if (!build.succeeded) {
      throw new Error(`ledger verification build failed:\n${shortOutput(build.output)}`);
    }

    const reportPath = join(directory, "full-vitest.json");
    const vitest = runFullVitest(reportPath);
    const report = vitest.report;
    if (
      vitest.exitCode !== 0 ||
      vitest.signal !== null ||
      !report.readable ||
      report.numTestFiles === 0 ||
      report.numTotalTests === 0 ||
      report.numPassedTests !== report.numTotalTests ||
      report.numFailedTests !== 0 ||
      report.numPendingTests !== 0 ||
      report.numTodoTests !== 0 ||
      report.numFailedTestSuites !== 0 ||
      report.suiteErrors.length !== 0 ||
      report.unhandledErrors.length !== 0
    ) {
      throw new Error(
        `live Vitest report is not a complete successful run:\n${JSON.stringify({
          exitCode: vitest.exitCode,
          signal: vitest.signal,
          report,
        }, null, 2)}`,
      );
    }

    const singleGreen = evidence.rows.filter(
      (row) => row.group === "single" && row.status === "green",
    ).length;
    const batchGreen = evidence.rows.filter(
      (row) => row.group === "batch" && row.status === "green",
    ).length;
    const totalGreen = evidence.rows.filter(
      (row) => row.status === "green",
    ).length;
    const pendingRows = evidence.rows.filter(
      (row) => row.status === "pending",
    ).length;
    const snapshot = {
      validationText: readFileSync(VALIDATION_PATH, "utf8"),
      requirementsText: readFileSync(REQUIREMENTS_PATH, "utf8"),
      singleTestText: readFileSync(join(ROOT, SINGLE_TEST), "utf8"),
      batchTestText: readFileSync(join(ROOT, BATCH_TEST), "utf8"),
      registerDigest: register.registerDigest,
      singleGreen,
      batchGreen,
      totalGreen,
      pendingRows,
      testFiles: report.numTestFiles,
      passedTests: report.numPassedTests,
      totalTests: report.numTotalTests,
      pendingTests: report.numPendingTests,
      todoTests: report.numTodoTests,
    };
    const errors = validateLedgerSnapshot(snapshot);
    if (errors.length !== 0) {
      throw new Error(`ledger snapshot is stale or incomplete:\n- ${errors.join("\n- ")}`);
    }

    console.log(
      `Verified ledgers: register ${register.registerDigest}, ${singleGreen}/${batchGreen}/${totalGreen} green, ${report.numTestFiles} files and ${report.numPassedTests}/${report.numTotalTests} tests`,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function init() {
  const { register, evidence } = ensureArtifacts();
  console.log(
    `Initialized immutable ${register.mutants.length}-row register ${register.registerDigest}; ${evidence.rows.filter((row) => row.status === "pending").length} rows pending`,
  );
}

function refresh() {
  validateDefinitions();
  const register = makeRegister();
  const evidence = makeInitialEvidence();
  atomicWriteJson(REGISTER_PATH, register);
  atomicWriteJson(EVIDENCE_PATH, evidence);
  console.log(
    `Refreshed immutable ${register.mutants.length}-row register ${register.registerDigest}; all evidence rows reset to pending`,
  );
}

function removeTableRow(value, id) {
  return value
    .split("\n")
    .filter((line) => tableCells(line)[0] !== id)
    .join("\n");
}

function selfTestLedgerSnapshot() {
  const digest = "a".repeat(64);
  const closureRows = REQUIRED_CLOSURE_TASKS.map((task) => {
    const evidence = {
      "06-07-T1": "R68 + Q17 malformed-metadata totality and correlation",
      "06-07-T2": "R06 BigInt no-dedup",
      "06-07-T3": "Q04 empty-object validation",
      "06-08-T1": "57-row register with range self-tests and ledger self-tests",
      "06-08-T2": "57/57 plus verify all",
      "06-08-T3": "final release gates plus verify ledgers",
    }[task.id];
    return `| ${task.id} | plan | wave | requirement | threat | ${evidence} | test | command | ✅ | ✅ green |`;
  }).join("\n");
  const validationText = `
## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|---|---|---|---|
${closureRows}

### Mutation Evidence

| Register | Digest | Counts | Result |
|---|---|---|---|
| Current immutable register | \`${digest}\` | 36/36 single; 21/21 batch; 57/57 total; 0 pending | ✅ |

### Gap-Closure Detector Evidence

| Detector | Marker | Contract |
|---|---|---|
| R68 | ${R68_MARKER} | malformed metadata is total |
| Q17 | ${Q17_MARKER} | malformed callId retains one correlated row |
| Q16 | ${Q16_MARKER} | immutable nested result across cached retries |

## Phase Gate Evidence

| Gate | Headline evidence | Result |
|---|---|---|
| \`pnpm test\` | 12 test files passed; 242/242 tests passed; 0 pending; 0 todo | ✅ |
`;
  const requirementsText = `
| REQ-ID | Phase | Status |
|---|---|---|
| DSP-01 | Phase 6 | Complete — R01/R02 prove valid string callIds retain identity; R68 proves malformed metadata containment. |
| DSP-02 | Phase 6 | Complete — R05/R06 prove BigInt, cyclic, and aliased inputs do not deduplicate; R06a proves keyable values remain injective. |
| DSP-06 | Phase 6 | Complete — Q04 proves malformed JSON becomes an empty object, reaches validation, and later calls continue. |
| DSP-07 | Phase 6 | Complete — Q17 proves one correlated row; Q16 proves immutable nested batch results across cached retries. |
`;
  return {
    validationText,
    requirementsText,
    singleTestText: `expect(value, "${R68_MARKER}")`,
    batchTestText: `it("[Q16] keeps nested batch results immutable across cached retries", () => {}); expect(value, "${Q16_MARKER}"); expect(value, "${Q17_MARKER}")`,
    registerDigest: digest,
    singleGreen: EXPECTED_SINGLE_IDS.length,
    batchGreen: EXPECTED_BATCH_IDS.length,
    totalGreen: EXPECTED_M06_IDS.length,
    pendingRows: 0,
    testFiles: 12,
    passedTests: 242,
    totalTests: 242,
    pendingTests: 0,
    todoTests: 0,
  };
}

function assertLedgerCounterexampleRejected(name, baseline, transform) {
  const candidate = transform(structuredClone(baseline));
  const errors = validateLedgerSnapshot(candidate);
  if (errors.length === 0) {
    throw new Error(`ledger counterexample was accepted: ${name}`);
  }
}

function selfTest() {
  const mutant = MUTANTS.find(
    (candidate) => candidate.detectorKind === "vitest",
  );
  if (mutant === undefined) {
    throw new Error("self-test requires a runtime mutant");
  }
  const expected = mutant.expectedFailureFingerprint[0];
  if (expected === undefined) {
    throw new Error("self-test runtime mutant has no expected fingerprint");
  }
  const report = {
    readable: true,
    numTotalTests: 1,
    numPassedTests: 0,
    numFailedTests: 1,
    numPendingTests: 0,
    assertions: [
      {
        caseId: expected.caseId,
        title: `[${expected.caseId}] self-test`,
        status: "failed",
        failureMessages: [`AssertionError: ${expected.marker}`],
      },
    ],
    suiteErrors: [],
    unhandledErrors: [],
  };
  if (!exactRuntimeFailureSet(report, mutant).satisfied) {
    throw new Error("exact runtime fingerprint rejected its expected marker");
  }
  const unrelatedFailure = structuredClone(report);
  unrelatedFailure.assertions[0].failureMessages = [
    "TypeError: unrelated setup failure",
  ];
  if (exactRuntimeFailureSet(unrelatedFailure, mutant).satisfied) {
    throw new Error("unrelated runtime failure satisfied the detector");
  }
  const infrastructureFailure = structuredClone(report);
  infrastructureFailure.unhandledErrors = ["unhandled rejection"];
  if (exactRuntimeFailureSet(infrastructureFailure, mutant).satisfied) {
    throw new Error("unhandled runtime error satisfied the detector");
  }
  const assertionMessage = `AssertionError: ${expected.marker}`;
  const assertionOnlyPayload = summarizeVitestPayload({
    numTotalTests: 1,
    numPassedTests: 0,
    numFailedTests: 1,
    numPendingTests: 0,
    testResults: [
      {
        assertionResults: [
          {
            title: `[${expected.caseId}] self-test`,
            status: "failed",
            failureMessages: [assertionMessage],
          },
        ],
        message: assertionMessage,
      },
    ],
  });
  if (!exactRuntimeFailureSet(assertionOnlyPayload, mutant).satisfied) {
    throw new Error("suite summary duplicated an assertion-level failure");
  }
  const hookFailurePayload = summarizeVitestPayload({
    numTotalTests: 1,
    numPassedTests: 0,
    numFailedTests: 1,
    numPendingTests: 0,
    testResults: [
      {
        assertionResults: [
          {
            title: `[${expected.caseId}] self-test`,
            status: "failed",
            failureMessages: [assertionMessage],
          },
        ],
        message: "Error: synthetic afterAll hook failure",
      },
    ],
  });
  if (
    hookFailurePayload.suiteErrors.length !== 1 ||
    exactRuntimeFailureSet(hookFailurePayload, mutant).satisfied
  ) {
    throw new Error("suite hook failure was discarded beside an assertion failure");
  }

  const typeMutantDefinition = MUTANTS.find(
    (candidate) => candidate.detectorKind === "typecheck",
  );
  const expectedDiagnostic = typeMutantDefinition?.expectedTypeDiagnostics[0];
  if (expectedDiagnostic === undefined) {
    throw new Error("self-test requires an exact type diagnostic");
  }
  const exactTypeOutput = `${expectedDiagnostic}: Type assertion failed.\n`;
  if (!exactTypeDiagnosticSet(exactTypeOutput, [expectedDiagnostic]).satisfied) {
    throw new Error("exact type diagnostic rejected its expected fingerprint");
  }
  const extraTypeOutput = `${exactTypeOutput}src/types.ts(1,1): error TS9999: extra\n`;
  if (exactTypeDiagnosticSet(extraTypeOutput, [expectedDiagnostic]).satisfied) {
    throw new Error("extra type diagnostic satisfied the detector");
  }

  const currentDigest = revisionDigest(mutant);
  const changedTestDigest = revisionDigest(mutant, (path, content) =>
    path === mutant.intendedTestFile
      ? Buffer.concat([content, Buffer.from("\nself-test revision change")])
      : content,
  );
  if (currentDigest === changedTestDigest) {
    throw new Error("intended test changes do not invalidate the revision digest");
  }
  const changedHarnessDigest = revisionDigest(mutant, (path, content) =>
    path === "scripts/phase-06-mutation-battery.mjs"
      ? Buffer.concat([content, Buffer.from("\nself-test harness change")])
      : content,
  );
  if (currentDigest === changedHarnessDigest) {
    throw new Error("harness changes do not invalidate the revision digest");
  }

  const transitiveSourcePath = revisionInputPaths().find(
    (path) =>
      path.startsWith("packages/concierge/src/") && path !== mutant.target,
  );
  if (transitiveSourcePath === undefined) {
    throw new Error("self-test requires a non-target transitive source");
  }
  const changedSourceDigest = revisionDigest(mutant, (path, content) =>
    path === transitiveSourcePath
      ? Buffer.concat([
          content,
          Buffer.from("\nself-test transitive source change"),
        ])
      : content,
  );
  if (currentDigest === changedSourceDigest) {
    throw new Error(
      "transitive source changes do not invalidate the revision digest",
    );
  }

  const transitiveFixturePath = revisionInputPaths().find(
    (path) =>
      path.startsWith("packages/concierge/test/fixtures/") &&
      path !== mutant.intendedTestFile,
  );
  if (transitiveFixturePath === undefined) {
    throw new Error("self-test requires a non-intended test fixture");
  }
  const changedFixtureDigest = revisionDigest(mutant, (path, content) =>
    path === transitiveFixturePath
      ? Buffer.concat([content, Buffer.from("\nself-test fixture change")])
      : content,
  );
  if (currentDigest === changedFixtureDigest) {
    throw new Error(
      "non-intended fixture changes do not invalidate the revision digest",
    );
  }

  for (const [firstId, lastId, expectedLength] of [
    ["M-06-S01", "M-06-S01", 1],
    ["M-06-S01", "M-06-S04", 4],
    ["M-06-S33", "M-06-S36", 4],
    ["M-06-B21", "M-06-B21", 1],
  ]) {
    const selected = selectMutantRange(firstId, lastId);
    if (selected.length !== expectedLength) {
      throw new Error(
        `range selector returned ${selected.length} rows for ${firstId}..${lastId}`,
      );
    }
  }
  for (const [name, firstId, lastId] of [
    ["empty", "", "M-06-S01"],
    ["unknown", "M-06-S00", "M-06-S01"],
    ["reversed", "M-06-S04", "M-06-S01"],
    ["cross-group", "M-06-S36", "M-06-B01"],
    ["five-mutant", "M-06-S01", "M-06-S05"],
  ]) {
    let rejected = false;
    try {
      selectMutantRange(firstId, lastId);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error(`range selector accepted ${name} counterexample`);
    }
  }

  const ledger = selfTestLedgerSnapshot();
  const baselineErrors = validateLedgerSnapshot(ledger);
  if (baselineErrors.length !== 0) {
    throw new Error(
      `ledger validator rejected its valid baseline:\n- ${baselineErrors.join("\n- ")}`,
    );
  }
  const ledgerCounterexamples = [
    ["wrong mutation digest", (value) => {
      value.validationText = value.validationText.replace(
        value.registerDigest,
        "b".repeat(64),
      );
      return value;
    }],
    ["off-by-one test total", (value) => {
      value.validationText = value.validationText.replace(
        "242/242 tests passed",
        "242/243 tests passed",
      );
      return value;
    }],
    ["stale detector count", (value) => {
      value.validationText = value.validationText.replace(
        "36/36 single",
        "35/36 single",
      );
      return value;
    }],
    ["missing R68 detector evidence", (value) => {
      value.validationText = removeTableRow(value.validationText, "R68");
      return value;
    }],
    ["missing Q17 detector evidence", (value) => {
      value.validationText = removeTableRow(value.validationText, "Q17");
      return value;
    }],
    ["Q17 replaced by colliding Q16 id", (value) => {
      value.validationText = value.validationText.replace(
        `| Q17 | ${Q17_MARKER}`,
        `| Q16 | ${Q17_MARKER}`,
      );
      return value;
    }],
    ["missing DSP-01/R68 citation", (value) => {
      value.requirementsText = value.requirementsText.replace("R68", "RXX");
      return value;
    }],
    ["missing DSP-02/R06 citation", (value) => {
      value.requirementsText = value.requirementsText.replace("R06 prove", "RXX prove");
      return value;
    }],
    ["missing DSP-06/Q04 citation", (value) => {
      value.requirementsText = value.requirementsText.replace("Q04 proves", "QXX proves");
      return value;
    }],
    ["missing DSP-07/Q17 citation", (value) => {
      value.requirementsText = value.requirementsText.replace("Q17 proves", "QXX proves");
      return value;
    }],
  ];
  for (const [name, transform] of ledgerCounterexamples) {
    assertLedgerCounterexampleRejected(name, ledger, transform);
  }
  for (const task of REQUIRED_CLOSURE_TASKS) {
    assertLedgerCounterexampleRejected(
      `missing ${task.id} closure row`,
      ledger,
      (value) => {
        value.validationText = removeTableRow(value.validationText, task.id);
        return value;
      },
    );
  }
  console.log(
    "Self-test passed: full-tree invalidation, exact detectors, bounded ranges, and ledger counterexamples are enforced",
  );
}

function usage() {
  console.error(
    "Usage: node scripts/phase-06-mutation-battery.mjs init | refresh | self-test | run single|batch | run range <first-id> <last-id> | verify single|all|ledgers",
  );
}

const [operation, argument, thirdArgument, fourthArgument] = process.argv.slice(2);
try {
  if (operation === "init" && argument === undefined) {
    withExclusiveRepositoryLock("init", init);
  } else if (operation === "refresh" && argument === undefined) {
    withExclusiveRepositoryLock("refresh", refresh);
  } else if (operation === "self-test" && argument === undefined) {
    withExclusiveRepositoryLock("self-test", selfTest);
  } else if (operation === "run" && (argument === "single" || argument === "batch")) {
    withExclusiveRepositoryLock(`run ${argument}`, () => runGroup(argument));
  } else if (
    operation === "run" &&
    argument === "range" &&
    thirdArgument !== undefined &&
    fourthArgument !== undefined
  ) {
    withExclusiveRepositoryLock(
      `run range ${thirdArgument} ${fourthArgument}`,
      () => runRange(thirdArgument, fourthArgument),
    );
  } else if (
    operation === "verify" &&
    (argument === "single" || argument === "all")
  ) {
    withExclusiveRepositoryLock(`verify ${argument}`, () => verify(argument));
  } else if (operation === "verify" && argument === "ledgers") {
    withExclusiveRepositoryLock("verify ledgers", verifyLedgers);
  } else if (operation === "gate" && argument !== undefined && thirdArgument !== undefined) {
    runGate(argument, thirdArgument);
  } else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}
