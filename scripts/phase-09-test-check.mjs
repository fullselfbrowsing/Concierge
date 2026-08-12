#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstatSync, realpathSync } from "node:fs";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = realpathSync(
  resolve(dirname(fileURLToPath(import.meta.url)), ".."),
);
const PROJECTS = Object.freeze([
  "react-lifecycle",
  "svelte-lifecycle",
  "node-artifact-ssr",
]);
const EXPECTED_TEST_FILES = Object.freeze([
  "packages/concierge-react/test/lifecycle.test.tsx",
  "packages/concierge-svelte/test/lifecycle.test.ts",
  "packages/concierge-react/test/artifact.test.ts",
  "packages/concierge-svelte/test/artifact.test.ts",
  "examples/adapter-ssr/test/ssr.test.ts",
]);
const CHILD_TIMEOUT_MS = 300_000;
const CHILD_MAX_BUFFER = 32 * 1024 * 1024;
const VITEST = resolve(
  REPOSITORY_ROOT,
  "node_modules/.bin",
  process.platform === "win32" ? "vitest.cmd" : "vitest",
);

function fail(code, message) {
  throw new Error(`[${code}] ${message}`);
}

function isWithinRepository(path) {
  const fromRoot = relative(REPOSITORY_ROOT, path);
  return (
    fromRoot === "" ||
    (fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`))
  );
}

function portablePath(path) {
  return path.split(sep).join("/");
}

function requireExpectedFiles() {
  for (const path of EXPECTED_TEST_FILES) {
    let metadata;
    try {
      metadata = lstatSync(resolve(REPOSITORY_ROOT, path));
    } catch (error) {
      fail(
        "TEST_FILE",
        `${path} is missing or unreadable: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!metadata.isFile() || metadata.size <= 0) {
      fail("TEST_FILE", `${path} must be a nonempty regular file`);
    }
  }
}

function normalizeResultName(name) {
  if (typeof name !== "string" || name.length === 0) {
    fail("VITEST_FILES", "Vitest reported an empty or non-string test name");
  }

  let candidate;
  try {
    candidate = name.startsWith("file:")
      ? fileURLToPath(name)
      : isAbsolute(name)
        ? name
        : resolve(REPOSITORY_ROOT, name);
    candidate = realpathSync(candidate);
  } catch (error) {
    fail(
      "VITEST_FILES",
      `Vitest reported an unreadable test path ${JSON.stringify(name)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!isWithinRepository(candidate)) {
    fail("VITEST_FILES", `Vitest reported a test outside the repository: ${name}`);
  }
  return portablePath(relative(REPOSITORY_ROOT, candidate));
}

function parsePositiveReport(stdout) {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch (error) {
    fail(
      "VITEST_JSON",
      `Vitest stdout was not JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (report === null || typeof report !== "object" || Array.isArray(report)) {
    fail("VITEST_JSON", "Vitest JSON must be an object");
  }
  if (report.success !== true) {
    fail("VITEST_FAILURE", "Vitest JSON success was not true");
  }
  if (
    !Number.isInteger(report.numTotalTestSuites) ||
    report.numTotalTestSuites <= 0 ||
    !Number.isInteger(report.numTotalTests) ||
    report.numTotalTests <= 0
  ) {
    fail("VITEST_ZERO", "Vitest reported zero test suites or tests");
  }
  const aggregateCounts = [
    "numPassedTestSuites",
    "numFailedTestSuites",
    "numPendingTestSuites",
    "numPassedTests",
    "numFailedTests",
    "numPendingTests",
    "numTodoTests",
  ];
  for (const field of aggregateCounts) {
    if (!Number.isInteger(report[field]) || report[field] < 0) {
      fail(
        "VITEST_JSON",
        `Vitest ${field} must be a non-negative integer`,
      );
    }
  }
  if (
    report.numPassedTestSuites !== report.numTotalTestSuites ||
    report.numFailedTestSuites !== 0 ||
    report.numPendingTestSuites !== 0 ||
    report.numPassedTests !== report.numTotalTests ||
    report.numFailedTests !== 0 ||
    report.numPendingTests !== 0 ||
    report.numTodoTests !== 0
  ) {
    fail(
      "VITEST_FAILURE",
      "Vitest aggregate counts must report every suite and test as passed",
    );
  }
  if (
    !Array.isArray(report.testResults) ||
    report.testResults.length !== EXPECTED_TEST_FILES.length
  ) {
    fail(
      "VITEST_FILES",
      `expected exactly ${EXPECTED_TEST_FILES.length} test results, found ${Array.isArray(report.testResults) ? report.testResults.length : "non-array"}`,
    );
  }

  let assertionCount = 0;
  for (const result of report.testResults) {
    if (result?.status !== "passed") {
      fail(
        "VITEST_FAILURE",
        `Vitest file ${JSON.stringify(result?.name)} had status ${JSON.stringify(result?.status)}`,
      );
    }
    if (
      !Array.isArray(result.assertionResults) ||
      result.assertionResults.length === 0
    ) {
      fail(
        "VITEST_ZERO",
        `Vitest file ${JSON.stringify(result.name)} reported no assertions`,
      );
    }
    for (const assertion of result.assertionResults) {
      if (assertion?.status !== "passed") {
        fail(
          "VITEST_FAILURE",
          `Vitest file ${JSON.stringify(result.name)} contained assertion status ${JSON.stringify(assertion?.status)}`,
        );
      }
      assertionCount += 1;
    }
  }
  if (assertionCount !== report.numTotalTests) {
    fail(
      "VITEST_JSON",
      `Vitest assertion count ${assertionCount} differed from aggregate total ${report.numTotalTests}`,
    );
  }

  const actualFiles = report.testResults.map((result) =>
    normalizeResultName(result?.name),
  );
  if (new Set(actualFiles).size !== EXPECTED_TEST_FILES.length) {
    fail("VITEST_FILES", `Vitest reported duplicate files: ${actualFiles.join(", ")}`);
  }
  const expectedFiles = [...EXPECTED_TEST_FILES].sort();
  actualFiles.sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    fail(
      "VITEST_FILES",
      `Vitest file set differed; expected=${JSON.stringify(expectedFiles)} actual=${JSON.stringify(actualFiles)}`,
    );
  }

  return Object.freeze({
    files: actualFiles.length,
    suites: report.numTotalTestSuites,
    tests: report.numTotalTests,
  });
}

function syntheticReport(assertionStatusesByFile) {
  const testResults = EXPECTED_TEST_FILES.map((path, index) => {
    const statuses = assertionStatusesByFile[index];
    return {
      assertionResults: statuses.map((status) => ({ status })),
      name: resolve(REPOSITORY_ROOT, path),
      status: statuses.some((status) => status === "passed")
        ? "passed"
        : "skipped",
    };
  });
  const statuses = testResults.flatMap((result) =>
    result.assertionResults.map((assertion) => assertion.status),
  );
  const passedTests = statuses.filter((status) => status === "passed").length;
  const pendingTests = statuses.filter((status) => status === "skipped").length;
  const passedSuites = testResults.filter(
    (result) => result.status === "passed",
  ).length;

  return {
    numTotalTestSuites: testResults.length,
    numPassedTestSuites: passedSuites,
    numFailedTestSuites: 0,
    numPendingTestSuites: testResults.length - passedSuites,
    numTotalTests: statuses.length,
    numPassedTests: passedTests,
    numFailedTests: 0,
    numPendingTests: pendingTests,
    numTodoTests: 0,
    success: true,
    testResults,
  };
}

function expectSyntheticFailure(name, report) {
  try {
    parsePositiveReport(JSON.stringify(report));
  } catch (error) {
    if (error instanceof Error && error.message.includes("[VITEST_FAILURE]")) {
      process.stdout.write(`SELF_TEST_OK ${name} VITEST_FAILURE\n`);
      return;
    }
    throw error;
  }

  fail("SELF_TEST", `${name} unexpectedly passed`);
}

function runParserSelfTests() {
  const passing = EXPECTED_TEST_FILES.map(() => ["passed"]);
  const counts = parsePositiveReport(JSON.stringify(syntheticReport(passing)));
  if (counts.files !== EXPECTED_TEST_FILES.length || counts.tests !== 5) {
    fail("SELF_TEST", "passing synthetic report produced unexpected counts");
  }
  process.stdout.write("SELF_TEST_OK all-passed-report PASS\n");

  const allSkippedFile = syntheticReport([
    ["skipped"],
    ...EXPECTED_TEST_FILES.slice(1).map(() => ["passed"]),
  ]);
  Object.assign(allSkippedFile, {
    numPassedTestSuites: allSkippedFile.numTotalTestSuites,
    numPendingTestSuites: 0,
    numPassedTests: allSkippedFile.numTotalTests,
    numPendingTests: 0,
  });
  expectSyntheticFailure("all-skipped-expected-file", allSkippedFile);
  expectSyntheticFailure(
    "mixed-status-report",
    syntheticReport([
      ["passed", "skipped"],
      ...EXPECTED_TEST_FILES.slice(1).map(() => ["passed"]),
    ]),
  );
}

if (process.argv.length !== 2) {
  fail("CLI_MODE", "phase-09-test-check accepts no arguments");
}

runParserSelfTests();
requireExpectedFiles();

const vitestArguments = [
  "run",
  ...PROJECTS.flatMap((project) => ["--project", project]),
  "--reporter=json",
];
const result = spawnSync(VITEST, vitestArguments, {
  cwd: REPOSITORY_ROOT,
  encoding: "utf8",
  env: { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" },
  maxBuffer: CHILD_MAX_BUFFER,
  timeout: CHILD_TIMEOUT_MS,
});

if (result.error !== undefined) {
  fail(
    "VITEST_PROCESS",
    `Vitest failed to start or timed out: ${result.error.message}`,
  );
}
if (result.signal !== null) {
  fail("VITEST_PROCESS", `Vitest ended by signal ${String(result.signal)}`);
}
if (result.status !== 0) {
  fail(
    "VITEST_PROCESS",
    `Vitest exited ${String(result.status)}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

const counts = parsePositiveReport(result.stdout);
process.stdout.write(
  `PHASE09_TEST_CHECK_OK projects=${PROJECTS.length} ` +
    `files=${counts.files} suites=${counts.suites} tests=${counts.tests}\n`,
);
