#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
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
const HARNESS_PATH = join(ROOT, "scripts/mutate-and-prove.sh");
const SCOPED_PATHS = [
  "packages/concierge/src",
  "packages/concierge/test",
  "packages/concierge/test-d",
  "pnpm-lock.yaml",
];
const SINGLE_TEST = "packages/concierge/test/dispatcher.test.ts";
const BATCH_TEST = "packages/concierge/test/dispatcher-batch.test.ts";
const TYPE_TEST = "packages/concierge/test-d/dispatcher.test-d.ts";
const BUILD_MARKER = "Build complete";
const MAX_BUFFER = 64 * 1024 * 1024;
const SCHEMA_VERSION = 2;
const REVISION_CONFIG_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "vitest.config.ts",
  "packages/concierge/package.json",
  "packages/concierge/tsconfig.json",
  "packages/concierge/tsconfig.test-d.json",
  "packages/concierge/tsdown.config.ts",
  "scripts/mutate-and-prove.sh",
  "scripts/phase-06-mutation-battery.mjs",
]);

export const EXPECTED_SINGLE_IDS = Object.freeze(
  Array.from({ length: 34 }, (_, index) =>
    `M-06-S${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_BATCH_IDS = Object.freeze(
  Array.from({ length: 20 }, (_, index) =>
    `M-06-B${String(index + 1).padStart(2, "0")}`,
  ),
);
export const EXPECTED_M06_IDS = Object.freeze([
  ...EXPECTED_SINGLE_IDS,
  ...EXPECTED_BATCH_IDS,
]);

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
      "    if (callId !== undefined) {",
      "      return `id:${callId}`;",
      "    }",
    ),
    replacement: "",
    intendedCaseIds: ["R04"],
  }),
  runtimeMutant({
    id: "M-06-S06",
    group: "single",
    name: "callId and fallback key namespaces collide",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: "      return `id:${callId}`;",
    replacement:
      '      return `args:${authorizationScope === null ? "cross" : String(authorizationScope)}:${callId}`;',
    intendedCaseIds: ["R04"],
  }),
  runtimeMutant({
    id: "M-06-S07",
    group: "single",
    name: "serialization failure catch is removed",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "  try {",
      "    const callId: string | undefined = meta?.callId;",
      "    if (callId !== undefined) {",
      "      return `id:${callId}`;",
      "    }",
      '    const scope: string = authorizationScope === null ? "cross" : String(authorizationScope);',
      "    return `args:${scope}:${name}:${JSON.stringify(args)}`;",
      "  } catch {",
      "    return null;",
      "  }",
    ),
    replacement: lines(
      "  const callId: string | undefined = meta?.callId;",
      "  if (callId !== undefined) {",
      "    return `id:${callId}`;",
      "  }",
      '  const scope: string = authorizationScope === null ? "cross" : String(authorizationScope);',
      "  return `args:${scope}:${name}:${JSON.stringify(args)}`;",
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
      "    const promise: Promise<ActionResult> = runDispatchPipeline(",
      "      index,",
      "      entry,",
      "      name,",
      "      argsSnapshot.value,",
      "      metaSnapshot.value,",
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
      "    const promise: Promise<ActionResult> = runDispatchPipeline(",
      "      index,",
      "      entry,",
      "      name,",
      "      argsSnapshot.value,",
      "      metaSnapshot.value,",
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
      "    // The explicit prototype-name refusal stays ahead of the catalog read even",
      "    // though `byName` has a null prototype. It makes the security boundary",
      "    // independent of a future lookup refactor. Authorization also stays ahead",
      "    // of the cache: a key proves retry identity, never stage authority.",
      "    if (",
      "      name === \"__proto__\" ||",
      "      name === \"constructor\" ||",
      "      !allowedNames.includes(name)",
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
      "test-d/dispatcher.test-d.ts(17,35): error TS2344",
    ],
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
    name: "malformed parse fallback bypasses schema validation",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern: lines(
      "      } catch {",
      "        args = {};",
      "      }",
    ),
    replacement: lines(
      "      } catch {",
      "        rows.push(Object.freeze({",
      "          callId: call.callId,",
      "          result: authoredResult(false, \"The action arguments are invalid.\", \"invalid_args\"),",
      "        }));",
      "        continue;",
      "      }",
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
    literalPattern:
      "    rows.push(Object.freeze({ callId: call.callId, result }));",
    replacement: "",
    intendedCaseIds: ["Q07"],
  }),
  runtimeMutant({
    id: "M-06-B16",
    group: "batch",
    name: "results are positional and omit callId correlation",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern:
      "    rows.push(Object.freeze({ callId: call.callId, result }));",
    replacement: lines(
      "    rows.push(Object.freeze(",
      "      { result } as Readonly<{ callId: string; result: ActionResult }>,",
      "    ));",
    ),
    intendedCaseIds: ["Q07"],
  }),
  runtimeMutant({
    id: "M-06-B17",
    group: "batch",
    name: "correlation rows are mutable",
    target: "packages/concierge/src/dispatch.ts",
    literalPattern:
      "    rows.push(Object.freeze({ callId: call.callId, result }));",
    replacement: "    rows.push({ callId: call.callId, result });",
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
]);

const MUTANT_BY_ID = new Map(MUTANTS.map((mutant) => [mutant.id, mutant]));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function registerDigest(mutants = MUTANTS) {
  return sha256(JSON.stringify(mutants));
}

function atomicWriteJson(path, value) {
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, path);
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

function summarizeVitestReport(reportPath) {
  if (!existsSync(reportPath)) {
    return {
      readable: false,
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0,
      assertions: [],
      suiteErrors: [],
      unhandledErrors: [],
    };
  }

  try {
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
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
      const assertionCount = suite.assertionResults?.length ?? 0;
      if (assertionCount > 0) return [];
      return [suite.message, suite.failureMessage]
        .filter((message) => typeof message === "string" && message.trim() !== "")
        .map((message) => message.trim());
    });
    const unhandledErrors = [...(report.unhandledErrors ?? []), ...(report.errors ?? [])]
      .map((error) =>
        typeof error === "string"
          ? error
          : JSON.stringify(error),
      )
      .filter((error) => error !== "" && error !== undefined);
    return {
      readable: true,
      numTotalTests: report.numTotalTests ?? 0,
      numPassedTests: report.numPassedTests ?? 0,
      numFailedTests: report.numFailedTests ?? 0,
      numPendingTests: report.numPendingTests ?? 0,
      assertions,
      suiteErrors,
      unhandledErrors,
    };
  } catch (error) {
    return {
      readable: false,
      parseError: error instanceof Error ? error.message : String(error),
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0,
      assertions: [],
      suiteErrors: [],
      unhandledErrors: [],
    };
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

function revisionInputPaths(mutant) {
  return [
    ...new Set([
      mutant.target,
      mutant.intendedTestFile,
      ...(mutant.detectorKind === "typecheck" ? [TYPE_TEST] : []),
      ...REVISION_CONFIG_PATHS,
    ]),
  ].sort();
}

function revisionDigest(mutant, transform = (_path, content) => content) {
  const digest = createHash("sha256");
  digest.update(`mutant\0${JSON.stringify(mutant)}\0`);
  for (const path of revisionInputPaths(mutant)) {
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

function runGroup(group) {
  const { evidence } = ensureArtifacts();
  const selected = MUTANTS.filter((mutant) => mutant.group === group);
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
      if (row.status === "pending") {
        if (row.executed !== false || row.testsRan !== 0) {
          throw new Error(`${row.id}: pending row is not explicitly unexecuted`);
        }
      } else {
        assertGreenEvidenceRow(row, mutant);
      }
      continue;
    }
    assertGreenEvidenceRow(row, mutant);
  }

  const green = evidence.rows.filter((row) => row.status === "green").length;
  const pending = evidence.rows.filter((row) => row.status === "pending").length;
  if (mode === "all" && (green !== 54 || pending !== 0)) {
    throw new Error(`verify all requires 54 green and 0 pending; got ${green}/${pending}`);
  }
  if (mode === "single") {
    const singleGreen = evidence.rows.filter(
      (row) => row.group === "single" && row.status === "green",
    ).length;
    if (singleGreen !== 34) {
      throw new Error(`verify single requires 34 green single rows; got ${singleGreen}`);
    }
  }
  console.log(
    `Verified ${mode}: register ${registerDigest()}, ${green} green, ${pending} explicitly pending`,
  );
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

  const expectedDiagnostic =
    "test-d/dispatcher.test-d.ts(17,35): error TS2344";
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
  console.log(
    "Self-test passed: revision invalidation and exact runtime/type fingerprints are enforced",
  );
}

function usage() {
  console.error(
    "Usage: node scripts/phase-06-mutation-battery.mjs init | refresh | self-test | run single|batch | verify single|all",
  );
}

const [operation, argument, gateDirectory] = process.argv.slice(2);
try {
  if (operation === "init" && argument === undefined) {
    init();
  } else if (operation === "refresh" && argument === undefined) {
    refresh();
  } else if (operation === "self-test" && argument === undefined) {
    selfTest();
  } else if (operation === "run" && (argument === "single" || argument === "batch")) {
    runGroup(argument);
  } else if (
    operation === "verify" &&
    (argument === "single" || argument === "all")
  ) {
    verify(argument);
  } else if (operation === "gate" && argument !== undefined && gateDirectory !== undefined) {
    runGate(argument, gateDirectory);
  } else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}
