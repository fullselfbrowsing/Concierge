#!/usr/bin/env node

import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

const MODES = new Set(["check", "self-test"]);
const LIMIT = 150;
const SCRATCH_PREFIX = "concierge-adapter-budget-";
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ADAPTERS = Object.freeze([
  Object.freeze({
    name: "@fullselfbrowsing/concierge-react",
    root: "packages/concierge-react",
    expected: Object.freeze([
      "packages/concierge-react/src/client.tsx",
      "packages/concierge-react/src/index.ts",
    ]),
  }),
  Object.freeze({
    name: "@fullselfbrowsing/concierge-svelte",
    root: "packages/concierge-svelte",
    expected: Object.freeze([
      "packages/concierge-svelte/src/client.svelte.ts",
      "packages/concierge-svelte/src/index.ts",
    ]),
  }),
]);

const IGNORED_DIRECTORIES = new Set([
  ".svelte-kit",
  "__tests__",
  "dist",
  "fixture",
  "fixtures",
  "node_modules",
  "test",
  "tests",
]);

const PRODUCTION_SUFFIXES = Object.freeze([
  ".svelte.ts",
  ".tsx",
  ".ts",
  ".svelte",
  ".jsx",
  ".js",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
]);

const LEXICAL_CONTROL_SOURCE = [
  "// createConcierge setTimeout dedupe queue consent transport for while",
  'const slash = "https://example.test/a//b";',
  'const blockText = "/* still string content */";',
  "const templateText = `first // template content",
  "second /* template content */`;",
  "/* comment-only block",
  " * remains excluded */",
  "export { slash, blockText, templateText };",
  "",
].join("\n");

const BASE_FIXTURE_FILES = Object.freeze({
  "packages/concierge-react/src/client.tsx": LEXICAL_CONTROL_SOURCE,
  "packages/concierge-react/src/index.ts": "export type ReactValue = string;\n",
  "packages/concierge-svelte/src/client.svelte.ts":
    "export const snapshot = <T>(value: T): T => value;\n",
  "packages/concierge-svelte/src/index.ts":
    "export type SvelteValue = string;\n",
});

const LOOP_CONTROLS = Object.freeze([
  Object.freeze({
    name: "classic-for",
    kind: "ForStatement",
    source: "for (let index = 0; index < 1; index += 1) void index;\n",
  }),
  Object.freeze({
    name: "for-in",
    kind: "ForInStatement",
    source: "for (const key in { value: 1 }) void key;\n",
  }),
  Object.freeze({
    name: "for-of",
    kind: "ForOfStatement",
    source: "for (const value of [1]) void value;\n",
  }),
  Object.freeze({
    name: "while",
    kind: "WhileStatement",
    source: "let pending = false; while (pending) pending = false;\n",
  }),
  Object.freeze({
    name: "do-while",
    kind: "DoStatement",
    source: "let pending = false; do { pending = false; } while (pending);\n",
  }),
]);

const RESPONSIBILITY_CONTROL = Object.freeze({
  name: "forbidden-createConcierge-call",
  source:
    "declare function createConcierge(value: object): unknown;\n" +
    "export const ownedCore = createConcierge({});\n",
});

class GateError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.name = "GateError";
    this.code = code;
  }
}

function portablePath(path) {
  return path.split(sep).join("/");
}

function relativePath(root, path) {
  return portablePath(relative(root, path));
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function arraysEqual(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function parseMode(arguments_) {
  const [mode, ...extra] = arguments_;

  if (mode === undefined || !MODES.has(mode) || extra.length !== 0) {
    throw new GateError(
      "CLI_MODE",
      "usage: node scripts/phase-09-adapter-budget.mjs <check|self-test>",
    );
  }

  return mode;
}

function validateSpecification(adapters) {
  if (!Array.isArray(adapters) || adapters.length !== 2) {
    throw new GateError("VACUOUS_SPEC", "expected exactly two adapter budgets");
  }

  const packageNames = new Set();
  const allExpected = new Set();

  for (const adapter of adapters) {
    if (
      typeof adapter.name !== "string" ||
      adapter.name.length === 0 ||
      packageNames.has(adapter.name)
    ) {
      throw new GateError("VACUOUS_SPEC", "adapter package names must be unique");
    }
    packageNames.add(adapter.name);

    if (!Array.isArray(adapter.expected) || adapter.expected.length !== 2) {
      throw new GateError(
        "VACUOUS_SPEC",
        `${adapter.name} must declare exactly two production files`,
      );
    }

    const expected = sorted(adapter.expected);
    if (new Set(expected).size !== expected.length) {
      throw new GateError(
        "VACUOUS_SPEC",
        `${adapter.name} contains duplicate production paths`,
      );
    }

    for (const path of expected) {
      if (
        !path.startsWith(`${adapter.root}/src/`) ||
        path.includes("..") ||
        !isProductionCandidate(path) ||
        allExpected.has(path)
      ) {
        throw new GateError(
          "VACUOUS_SPEC",
          `${adapter.name} has an invalid production path: ${path}`,
        );
      }
      allExpected.add(path);
    }
  }

  if (!Number.isInteger(LIMIT) || LIMIT !== 150) {
    throw new GateError("VACUOUS_SPEC", "the independent line limit must be 150");
  }
}

function isGeneratedFile(name) {
  return (
    name.endsWith(".map") ||
    /[.]d[.](?:ts|mts|cts)$/u.test(name)
  );
}

function isProductionCandidate(path) {
  return (
    !isGeneratedFile(path) &&
    PRODUCTION_SUFFIXES.some((suffix) => path.endsWith(suffix))
  );
}

async function assertExpectedFile(root, expectedPath) {
  const absolute = resolve(root, expectedPath);
  let metadata;

  try {
    metadata = await lstat(absolute);
  } catch {
    throw new GateError(
      "EXPECTED_FILE",
      `${expectedPath} is missing; the production scan cannot be vacuous`,
    );
  }

  if (!metadata.isFile() || metadata.size === 0) {
    throw new GateError(
      "EXPECTED_FILE",
      `${expectedPath} must be a nonempty regular file`,
    );
  }
}

async function discoverProductionFiles(root, directory) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    throw new GateError(
      "SOURCE_PATH",
      `${relativePath(root, directory)} is missing or unreadable`,
    );
  }

  const files = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const absolute = join(directory, entry.name);
    const path = relativePath(root, absolute);

    if (entry.isSymbolicLink()) {
      throw new GateError(
        "SOURCE_SYMLINK",
        `${path} is a symlink; production inventory requires regular files`,
      );
    }

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        files.push(...(await discoverProductionFiles(root, absolute)));
      }
      continue;
    }

    if (entry.isFile() && isProductionCandidate(entry.name)) {
      files.push(path);
    }
  }

  return sorted(files);
}

function countAuthoredLines(source) {
  const lines = source.split(/\r\n?|\n/u);
  let state = "code";
  let escaped = false;
  let count = 0;

  for (const line of lines) {
    let lineHasCode = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      const next = line[index + 1];

      if (state === "line-comment") {
        break;
      }

      if (state === "block-comment") {
        if (character === "*" && next === "/") {
          state = "code";
          index += 1;
        }
        continue;
      }

      if (state !== "code") {
        if (escaped) {
          escaped = false;
          if (!/\s/u.test(character)) lineHasCode = true;
          continue;
        }

        if (character === "\\") {
          escaped = true;
          lineHasCode = true;
          continue;
        }

        if (!/\s/u.test(character)) lineHasCode = true;
        if (
          (state === "single-string" && character === "'") ||
          (state === "double-string" && character === '"') ||
          (state === "template-string" && character === "`")
        ) {
          state = "code";
        }
        continue;
      }

      if (character === "/" && next === "/") {
        state = "line-comment";
        break;
      }

      if (character === "/" && next === "*") {
        state = "block-comment";
        index += 1;
        continue;
      }

      if (character === "'") state = "single-string";
      if (character === '"') state = "double-string";
      if (character === "`") state = "template-string";
      if (!/\s/u.test(character)) lineHasCode = true;
    }

    if (lineHasCode) count += 1;
    if (state === "line-comment") state = "code";
    escaped = false;
  }

  if (state === "block-comment") {
    throw new GateError("LEXICAL_SCAN", "source ends inside a block comment");
  }

  return count;
}

async function analyzeProductionResponsibilities(root, paths) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new GateError(
      "VACUOUS_AST",
      "TypeScript responsibility analysis requires at least one source file",
    );
  }

  throw new GateError(
    "AST_GATE_UNIMPLEMENTED",
    `TypeScript AST responsibility analysis is missing for ${relativePath(root, resolve(root, paths[0]))}`,
  );
}

async function runInventoryAndBudgetGate(root, adapters = ADAPTERS) {
  validateSpecification(adapters);
  const reports = [];

  for (const adapter of adapters) {
    const expected = sorted(adapter.expected);
    for (const expectedPath of expected) {
      await assertExpectedFile(root, expectedPath);
    }

    const sourceRoot = resolve(root, adapter.root, "src");
    const discovered = await discoverProductionFiles(root, sourceRoot);
    if (!arraysEqual(discovered, expected)) {
      const expectedSet = new Set(expected);
      const discoveredSet = new Set(discovered);
      const missing = expected.filter((path) => !discoveredSet.has(path));
      const unexpected = discovered.filter((path) => !expectedSet.has(path));
      throw new GateError(
        "INVENTORY_MISMATCH",
        `${adapter.name} production inventory differs; ` +
          `missing=${JSON.stringify(missing)} ` +
          `unexpected=${JSON.stringify(unexpected)}`,
      );
    }

    const files = [];
    let total = 0;
    for (const path of expected) {
      const source = await readFile(resolve(root, path), "utf8");
      const lines = countAuthoredLines(source);
      files.push(Object.freeze({ path, lines }));
      total += lines;
    }

    if (!Number.isInteger(total) || total <= 0) {
      throw new GateError(
        "VACUOUS_COUNT",
        `${adapter.name} measured a non-positive production total`,
      );
    }

    if (total > LIMIT) {
      throw new GateError(
        "LINE_BUDGET",
        `${adapter.name} measured ${total} authored lines; limit=${LIMIT}`,
      );
    }

    reports.push(
      Object.freeze({
        package: adapter.name,
        files: Object.freeze(files),
        total,
        limit: LIMIT,
      }),
    );
  }

  await analyzeProductionResponsibilities(
    root,
    reports.flatMap((report) => report.files.map((file) => file.path)),
  );

  return Object.freeze(reports);
}

function printReports(reports) {
  for (const report of reports) {
    process.stdout.write(
      `ADAPTER_BUDGET package=${report.package} total=${report.total} ` +
        `limit=${report.limit} files=${report.files.length}\n`,
    );
    for (const file of report.files) {
      process.stdout.write(`  ${file.path}: ${file.lines}\n`);
    }
  }
  const fileCount = reports.reduce(
    (total, report) => total + report.files.length,
    0,
  );
  process.stdout.write(
    `ADAPTER_BUDGET_OK packages=${reports.length} files=${fileCount}\n`,
  );
}

async function expectFailure(name, operation, expectedCode, messageFragment) {
  let observed;
  try {
    await operation();
  } catch (error) {
    observed = error;
  }

  if (!(observed instanceof GateError)) {
    throw new GateError(
      "SELF_TEST",
      `${name} did not fail with a budget-gate diagnostic`,
    );
  }
  if (
    observed.code !== expectedCode ||
    !observed.message.includes(messageFragment)
  ) {
    throw new GateError(
      "SELF_TEST",
      `${name} produced ${observed.message}; expected ` +
        `[${expectedCode}] containing ${JSON.stringify(messageFragment)}`,
    );
  }

  process.stdout.write(`SELF_TEST_OK ${name} ${expectedCode}\n`);
}

async function createBaseFixture(root) {
  for (const [path, source] of Object.entries(BASE_FIXTURE_FILES)) {
    const absolute = resolve(root, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, source, "utf8");
  }

  const ignored = {
    "packages/concierge-react/README.md": "metadata does not count\n",
    "packages/concierge-react/package.json": '{"private":true}\n',
    "packages/concierge-react/dist/generated.js":
      "export const generated = true;\n".repeat(LIMIT + 10),
    "packages/concierge-react/src/generated.d.ts":
      "export declare const generated: true;\n".repeat(LIMIT + 10),
    "packages/concierge-react/src/generated.ts.map": "{}\n",
    "packages/concierge-react/src/fixtures/ignored.ts":
      "export const fixture = true;\n".repeat(LIMIT + 10),
    "packages/concierge-react/test/ignored.ts":
      "export const testOnly = true;\n".repeat(LIMIT + 10),
  };

  for (const [path, source] of Object.entries(ignored)) {
    const absolute = resolve(root, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, source, "utf8");
  }
}

async function validateScratchRoot(root) {
  const temporaryRoot = await realpath(tmpdir());
  const resolved = resolve(root);
  const actual = await realpath(root);
  const name = basename(actual);

  if (
    resolved !== actual ||
    dirname(actual) !== temporaryRoot ||
    !name.startsWith(SCRATCH_PREFIX) ||
    name.length === SCRATCH_PREFIX.length
  ) {
    throw new GateError(
      "SCRATCH_PATH",
      `${root} is not an owned direct temporary child`,
    );
  }
}

async function runSelfTest() {
  await expectFailure(
    "missing-mode",
    async () => parseMode([]),
    "CLI_MODE",
    "<check|self-test>",
  );
  await expectFailure(
    "unknown-mode",
    async () => parseMode(["unknown"]),
    "CLI_MODE",
    "<check|self-test>",
  );
  await expectFailure(
    "extra-mode-argument",
    async () => parseMode(["check", "unexpected"]),
    "CLI_MODE",
    "<check|self-test>",
  );

  const temporaryRoot = await realpath(tmpdir());
  const root = await mkdtemp(join(temporaryRoot, SCRATCH_PREFIX));
  await validateScratchRoot(root);

  try {
    await createBaseFixture(root);

    const lexicalCount = countAuthoredLines(LEXICAL_CONTROL_SOURCE);
    if (lexicalCount !== 5) {
      throw new GateError(
        "SELF_TEST",
        `lexical-control measured ${lexicalCount}; expected 5`,
      );
    }

    const baseline = await runInventoryAndBudgetGate(root);
    if (
      baseline.length !== 2 ||
      baseline[0]?.total !== 6 ||
      baseline[1]?.total !== 2
    ) {
      throw new GateError(
        "SELF_TEST",
        `valid-control produced unexpected totals: ${JSON.stringify(baseline)}`,
      );
    }
    process.stdout.write("SELF_TEST_OK valid-lexical-control PASS\n");

    await expectFailure(
      "vacuous-adapter-list",
      async () => runInventoryAndBudgetGate(root, []),
      "VACUOUS_SPEC",
      "exactly two adapter budgets",
    );

    const missingPath = "packages/concierge-react/src/index.ts";
    await unlink(resolve(root, missingPath));
    await expectFailure(
      "missing-expected-file",
      async () => runInventoryAndBudgetGate(root),
      "EXPECTED_FILE",
      missingPath,
    );
    await writeFile(
      resolve(root, missingPath),
      BASE_FIXTURE_FILES[missingPath],
      "utf8",
    );

    const unlistedPath = "packages/concierge-react/src/hidden.ts";
    await writeFile(resolve(root, unlistedPath), "export const hidden = true;\n");
    await expectFailure(
      "unlisted-production-file",
      async () => runInventoryAndBudgetGate(root),
      "INVENTORY_MISMATCH",
      unlistedPath,
    );
    await unlink(resolve(root, unlistedPath));

    const overLimitPath = "packages/concierge-react/src/client.tsx";
    await writeFile(
      resolve(root, overLimitPath),
      Array.from(
        { length: LIMIT + 1 },
        (_, index) => `export const line${index} = ${index};`,
      ).join("\n"),
      "utf8",
    );
    await expectFailure(
      "independent-over-limit",
      async () => runInventoryAndBudgetGate(root),
      "LINE_BUDGET",
      "@fullselfbrowsing/concierge-react measured 152",
    );
    await writeFile(
      resolve(root, overLimitPath),
      BASE_FIXTURE_FILES[overLimitPath],
      "utf8",
    );

    await runInventoryAndBudgetGate(root);
    process.stdout.write("SELF_TEST_OK restored-valid-tree PASS\n");
  } finally {
    await validateScratchRoot(root);
    await rm(root, { recursive: true, force: true });
  }

  process.stdout.write("ADAPTER_BUDGET_SELF_TEST_OK\n");
}

async function main() {
  const mode = parseMode(process.argv.slice(2));
  if (mode === "check") {
    printReports(await runInventoryAndBudgetGate(REPOSITORY_ROOT));
    return;
  }

  await runSelfTest();
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
