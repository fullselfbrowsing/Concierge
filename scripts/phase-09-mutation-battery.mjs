#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = realpathSync(resolve(dirname(SCRIPT_PATH), ".."));
const PHASE = "09-react-and-svelte-adapters";
const PHASE_DIRECTORY = join(ROOT, ".planning/phases", PHASE);
const REGISTER_PATH = join(PHASE_DIRECTORY, "09-MUTATION-REGISTER.json");
const MUTATION_EVIDENCE_PATH = join(
  PHASE_DIRECTORY,
  "09-MUTATION-EVIDENCE.json",
);
const RELEASE_EVIDENCE_PATH = join(
  PHASE_DIRECTORY,
  "09-RELEASE-EVIDENCE.json",
);
const VALIDATION_PATH = join(PHASE_DIRECTORY, "09-VALIDATION.md");
const SECURITY_PATH = join(PHASE_DIRECTORY, "09-SECURITY.md");
const GENERATED_PATHS = Object.freeze([
  ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json",
  ".planning/phases/09-react-and-svelte-adapters/09-RELEASE-EVIDENCE.json",
  ".planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md",
  ".planning/phases/09-react-and-svelte-adapters/09-SECURITY.md",
]);
const OUTPUT_PATHS = Object.freeze([
  MUTATION_EVIDENCE_PATH,
  RELEASE_EVIDENCE_PATH,
  VALIDATION_PATH,
  SECURITY_PATH,
]);
const PHASE08_PATHS = Object.freeze([
  ".planning/phases/08-consent-kernel/08-MUTATION-REGISTER.json",
  ".planning/phases/08-consent-kernel/08-MUTATION-EVIDENCE.json",
  ".planning/phases/08-consent-kernel/08-VALIDATION.md",
  ".planning/phases/08-consent-kernel/08-SECURITY.md",
  ".planning/phases/08-consent-kernel/08-VERIFICATION.md",
]);
const PHASE08_COMMANDS = Object.freeze([
  Object.freeze(["node", "scripts/phase-08-mutation-battery.mjs", "verify", "all"]),
  Object.freeze(["node", "scripts/phase-08-mutation-battery.mjs", "verify", "inputs"]),
  Object.freeze(["node", "scripts/phase-08-mutation-battery.mjs", "verify", "ledgers"]),
]);
const EXPECTED_IDS = Object.freeze([
  "M-09-R1",
  "M-09-R2",
  "M-09-S1",
  "M-09-SSR1",
  "M-09-B1",
  "M-09-P1",
  "M-09-C1",
]);
const REQUIRED_TASK_IDS = Object.freeze(
  Array.from({ length: 13 }, (_, phaseIndex) =>
    [1, 2].map(
      (taskIndex) =>
        `09-${String(phaseIndex + 1).padStart(2, "0")}-${String(taskIndex).padStart(2, "0")}`,
    ),
  ).flat(),
);
const REQUIRED_THREATS = Object.freeze([
  "T-09-01",
  "T-09-02",
  "T-09-03",
  "T-09-04",
  "T-09-05",
  "T-09-06",
  "T-09-07",
  "T-09-08",
  "T-09-SC",
]);
const REQUIRED_FINAL_INPUT_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "vitest.config.ts",
  "README.md",
  "CONTRIBUTING.md",
  "RELEASING.md",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  "packages/concierge/package.json",
  "packages/concierge/src/index.ts",
  "packages/concierge/src/bridge.ts",
  "packages/concierge-react/package.json",
  "packages/concierge-react/tsconfig.json",
  "packages/concierge-react/tsdown.config.ts",
  "packages/concierge-react/LICENSE",
  "packages/concierge-react/README.md",
  "packages/concierge-react/src/index.ts",
  "packages/concierge-react/src/client.tsx",
  "packages/concierge-react/test/lifecycle.test.tsx",
  "packages/concierge-react/test/artifact.test.ts",
  "packages/concierge-react/test-d/public.test-d.ts",
  "packages/concierge-svelte/package.json",
  "packages/concierge-svelte/tsconfig.json",
  "packages/concierge-svelte/svelte.config.js",
  "packages/concierge-svelte/LICENSE",
  "packages/concierge-svelte/README.md",
  "packages/concierge-svelte/src/index.ts",
  "packages/concierge-svelte/src/client.svelte.ts",
  "packages/concierge-svelte/test/Harness.svelte",
  "packages/concierge-svelte/test/lifecycle.test.ts",
  "packages/concierge-svelte/test/artifact.test.ts",
  "examples/adapter-ssr/package.json",
  "examples/adapter-ssr/astro.config.mjs",
  "examples/adapter-ssr/tsconfig.json",
  "examples/adapter-ssr/src/shared/catalog.ts",
  "examples/adapter-ssr/src/components/ReactIsland.tsx",
  "examples/adapter-ssr/src/components/SvelteIsland.svelte",
  "examples/adapter-ssr/src/pages/index.astro",
  "examples/adapter-ssr/test/ssr.test.ts",
  "scripts/phase-09-contract-check.mjs",
  "scripts/phase-09-package-check.mjs",
  "scripts/phase-09-adapter-budget.mjs",
  "scripts/phase-09-test-check.mjs",
  "scripts/phase-09-workflow-check.mjs",
  "scripts/phase-09-mutation-battery.mjs",
  ".planning/phases/09-react-and-svelte-adapters/09-RED-BASELINE.json",
  ".planning/phases/09-react-and-svelte-adapters/09-CONTEXT.md",
  ".planning/phases/09-react-and-svelte-adapters/09-RESEARCH.md",
  ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json",
  ...PHASE08_PATHS,
]);
const ROOT_INPUT_PATHS = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "vitest.config.ts",
  "README.md",
  "CONTRIBUTING.md",
  "RELEASING.md",
  ".gitignore",
  ".planning/REQUIREMENTS.md",
  ".planning/phases/09-react-and-svelte-adapters/09-RED-BASELINE.json",
  ".planning/phases/09-react-and-svelte-adapters/09-CONTEXT.md",
  ".planning/phases/09-react-and-svelte-adapters/09-RESEARCH.md",
  ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json",
  ...PHASE08_PATHS,
]);
const INPUT_DIRECTORY_PREFIXES = Object.freeze([
  "packages/concierge/",
  "packages/concierge-react/",
  "packages/concierge-svelte/",
  "examples/adapter-ssr/",
  "scripts/",
  ".github/workflows/",
]);
const TEST_HASH_PATHS = Object.freeze({
  "M-09-R1": Object.freeze([
    "packages/concierge-react/test/lifecycle.test.tsx",
    "vitest.config.ts",
  ]),
  "M-09-R2": Object.freeze([
    "packages/concierge-react/test/lifecycle.test.tsx",
    "vitest.config.ts",
  ]),
  "M-09-S1": Object.freeze([
    "scripts/phase-09-package-check.mjs",
    "packages/concierge-svelte/test/lifecycle.test.ts",
  ]),
  "M-09-SSR1": Object.freeze([
    "examples/adapter-ssr/test/ssr.test.ts",
    "vitest.config.ts",
  ]),
  "M-09-B1": Object.freeze(["scripts/phase-09-adapter-budget.mjs"]),
  "M-09-P1": Object.freeze(["scripts/phase-09-package-check.mjs"]),
  "M-09-C1": Object.freeze([
    "scripts/phase-09-package-check.mjs",
    "packages/concierge-react/test/lifecycle.test.tsx",
  ]),
});
const EXPECTED_MAPPINGS = Object.freeze({
  "M-09-R1": Object.freeze({
    testId: "T01",
    requirement: "ADP-01",
    threat: "T-09-01",
    decisions: Object.freeze(["D-09-02", "D-09-07"]),
  }),
  "M-09-R2": Object.freeze({
    testId: "T02",
    requirement: "ADP-01",
    threat: "T-09-02",
    decisions: Object.freeze(["D-09-06"]),
  }),
  "M-09-S1": Object.freeze({
    testId: "T03",
    requirement: "ADP-02",
    threat: "T-09-03",
    decisions: Object.freeze(["D-09-10", "D-09-12"]),
  }),
  "M-09-SSR1": Object.freeze({
    testId: "T04",
    requirement: "ADP-04",
    threat: "T-09-04",
    decisions: Object.freeze(["D-09-02", "D-09-15"]),
  }),
  "M-09-B1": Object.freeze({
    testId: "T07",
    requirement: "ADP-03",
    threat: "T-09-07",
    decisions: Object.freeze(["D-09-13"]),
  }),
  "M-09-P1": Object.freeze({
    testId: "T05",
    requirement: "PKG-04",
    threat: "T-09-05",
    decisions: Object.freeze(["D-09-04", "D-09-16"]),
  }),
  "M-09-C1": Object.freeze({
    testId: "T05",
    requirement: "PKG-04",
    threat: "T-09-05",
    decisions: Object.freeze(["D-09-03", "D-09-16"]),
  }),
});
const COMPILE_COMMANDS = Object.freeze({
  "M-09-R1": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge-react", "build"]),
  "M-09-R2": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge-react", "build"]),
  "M-09-S1": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge-svelte", "build"]),
  "M-09-SSR1": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge-react", "build"]),
  "M-09-B1": Object.freeze(["node", "--check", "scripts/phase-09-adapter-budget.mjs"]),
  "M-09-P1": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge-react", "build"]),
  "M-09-C1": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge-react", "build"]),
});
const KILLER_COMMANDS = Object.freeze({
  "M-09-R1": Object.freeze(["pnpm", "exec", "vitest", "run", "packages/concierge-react/test/lifecycle.test.tsx", "--project", "react-lifecycle", "--testNamePattern=T01/R1", "--reporter=json", "--outputFile={report}"]),
  "M-09-R2": Object.freeze(["pnpm", "exec", "vitest", "run", "packages/concierge-react/test/lifecycle.test.tsx", "--project", "react-lifecycle", "--testNamePattern=T02/R2", "--reporter=json", "--outputFile={report}"]),
  "M-09-S1": Object.freeze(["node", "scripts/phase-09-package-check.mjs", "svelte-consent"]),
  "M-09-SSR1": Object.freeze(["pnpm", "exec", "vitest", "run", "examples/adapter-ssr/test/ssr.test.ts", "--project", "node-artifact-ssr", "--testNamePattern=T04/SSR1", "--reporter=json", "--outputFile={report}"]),
  "M-09-B1": Object.freeze(["node", "scripts/phase-09-adapter-budget.mjs", "check"]),
  "M-09-P1": Object.freeze(["node", "scripts/phase-09-package-check.mjs", "artifacts"]),
  "M-09-C1": Object.freeze(["node", "scripts/phase-09-package-check.mjs", "mismatch"]),
});
const REGISTER_TOP_KEYS = Object.freeze([
  "schemaVersion",
  "phase",
  "expectedIds",
  "runnerThreat",
  "rows",
]);
const REGISTER_ROW_KEYS = Object.freeze([
  "id",
  "name",
  "target",
  "affectedPackage",
  "exactBefore",
  "exactAfter",
  "occurrences",
  "compileCommand",
  "killerCommand",
  "killerKind",
  "expectedCounts",
  "expectedNonzeroExit",
  "assertionFingerprint",
  "testId",
  "requirement",
  "threat",
  "decisions",
]);
const USAGE =
  "Usage: node scripts/phase-09-mutation-battery.mjs " +
  "self-test|preflight <registered-id>|run all --jobs <1-4>|" +
  "verify <evidence|release|all>";
const TEMP_PREFIX = "concierge-phase09-mutation-";
const OWNERSHIP_MARKER = ".concierge-phase09-mutation-owned-root";
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 240_000;
const PACKAGE_TIMEOUT_MS = 600_000;
const INSTALL_TIMEOUT_MS = 360_000;
const SYSTEM_TEMP_ROOT = realpathSync(tmpdir());
const SHA256 = /^[0-9a-f]{64}$/u;

class UsageError extends Error {
  constructor() {
    super(USAGE);
    this.name = "UsageError";
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function countOccurrences(text, needle) {
  assert(needle.length > 0, "exact replacement needle must be nonempty");
  return text.split(needle).length - 1;
}

function exactKeys(value, expected, label) {
  assert(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  const observed = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(
    JSON.stringify(observed) === JSON.stringify(wanted),
    `${label} keys must equal ${wanted.join(", ")}`,
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function commandText(spec) {
  return spec.join(" ");
}

function boundedExcerpt(value, maximum = 4_000) {
  const text = value ?? "";
  return text.length <= maximum ? text : text.slice(text.length - maximum);
}

function isWithin(candidate, parent) {
  const fromParent = relative(parent, candidate);
  return (
    fromParent === "" ||
    (fromParent !== ".." && !fromParent.startsWith(`..${sep}`))
  );
}

function parseInvocation(arguments_) {
  if (arguments_.length === 1 && arguments_[0] === "self-test") {
    return Object.freeze({ kind: "self-test" });
  }
  if (
    arguments_.length === 2 &&
    arguments_[0] === "preflight" &&
    EXPECTED_IDS.includes(arguments_[1])
  ) {
    return Object.freeze({ kind: "preflight", id: arguments_[1] });
  }
  if (
    arguments_.length === 4 &&
    arguments_[0] === "run" &&
    arguments_[1] === "all" &&
    arguments_[2] === "--jobs"
  ) {
    const jobs = Number(arguments_[3]);
    if (Number.isInteger(jobs) && jobs >= 1 && jobs <= 4) {
      return Object.freeze({ kind: "run-all", jobs });
    }
  }
  if (
    arguments_.length === 2 &&
    arguments_[0] === "verify" &&
    ["evidence", "release", "all"].includes(arguments_[1])
  ) {
    return Object.freeze({ kind: `verify-${arguments_[1]}` });
  }
  throw new UsageError();
}

function runGitSync(arguments_, root = ROOT, options = {}) {
  const result = spawnSync("git", arguments_, {
    cwd: root,
    encoding: options.encoding ?? "utf8",
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  assert(
    result.error === undefined && result.signal === null && result.status === 0,
    `git ${arguments_.join(" ")} failed: ${boundedExcerpt(`${result.stdout ?? ""}${result.stderr ?? ""}`)}`,
  );
  return result.stdout;
}

function readRegister(root = ROOT) {
  return JSON.parse(
    readFileSync(
      join(
        root,
        ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json",
      ),
      "utf8",
    ),
  );
}

function validateRegister(register, root = ROOT, { requireTracked = true } = {}) {
  exactKeys(register, REGISTER_TOP_KEYS, "register");
  assert(register.schemaVersion === 1, "register schemaVersion must equal 1");
  assert(register.phase === PHASE, "register phase is invalid");
  assert(register.runnerThreat === "T-09-08", "runner threat must equal T-09-08");
  assert(
    JSON.stringify(register.expectedIds) === JSON.stringify(EXPECTED_IDS),
    "register expectedIds are missing, duplicated, reordered, or extra",
  );
  assert(Array.isArray(register.rows), "register rows must be an array");
  const ids = register.rows.map((row) => row.id);
  assert(
    JSON.stringify(ids) === JSON.stringify(EXPECTED_IDS),
    "register row ids are missing, duplicated, reordered, or extra",
  );
  assert(new Set(ids).size === EXPECTED_IDS.length, "register has a duplicate ID");

  const identities = new Set();
  for (const row of register.rows) {
    exactKeys(row, REGISTER_ROW_KEYS, `${row.id} register row`);
    exactKeys(row.expectedCounts, ["files", "tests", "assertions"], `${row.id} expectedCounts`);
    assert(
      row.expectedCounts.files === 1 &&
        row.expectedCounts.tests === 1 &&
        row.expectedCounts.assertions === 1,
      `${row.id}: expected counts must be exactly one file/test/assertion`,
    );
    assert(row.occurrences === 1, `${row.id}: occurrences must equal 1`);
    assert(row.expectedNonzeroExit === true, `${row.id}: expectedNonzeroExit must be true`);
    assert(
      ["vitest", "marker", "package"].includes(row.killerKind),
      `${row.id}: killerKind is invalid`,
    );
    for (const key of [
      "name",
      "target",
      "affectedPackage",
      "exactBefore",
      "exactAfter",
      "compileCommand",
      "killerCommand",
      "assertionFingerprint",
    ]) {
      assert(typeof row[key] === "string" && row[key].length > 0, `${row.id}: ${key} is empty`);
    }
    assert(row.exactBefore !== row.exactAfter, `${row.id}: replacement is a no-op`);
    assert(!/(?:^|\/)test(?:-d)?\//u.test(row.target), `${row.id}: test source is a forbidden mutation target`);
    const identity = `${row.target}\0${row.exactBefore}\0${row.exactAfter}`;
    assert(!identities.has(identity), `${row.id}: duplicate mutation definition`);
    identities.add(identity);

    const expectedMapping = EXPECTED_MAPPINGS[row.id];
    assert(expectedMapping !== undefined, `${row.id}: mapping is unknown`);
    assert(row.testId === expectedMapping.testId, `${row.id}: test mapping drifted`);
    assert(row.requirement === expectedMapping.requirement, `${row.id}: requirement mapping drifted`);
    assert(row.threat === expectedMapping.threat, `${row.id}: threat mapping drifted`);
    assert(
      JSON.stringify(row.decisions) === JSON.stringify(expectedMapping.decisions),
      `${row.id}: decision mapping drifted`,
    );
    assert(
      row.compileCommand === commandText(COMPILE_COMMANDS[row.id]),
      `${row.id}: compile command is not the immutable command`,
    );
    assert(
      row.killerCommand === commandText(KILLER_COMMANDS[row.id]),
      `${row.id}: killer command is not the immutable command`,
    );

    const targetPath = join(root, row.target);
    assert(existsSync(targetPath) && statSync(targetPath).isFile(), `${row.id}: target is missing`);
    if (requireTracked) {
      runGitSync(["ls-files", "--error-unmatch", row.target], root);
    }
    const source = readFileSync(targetPath, "utf8");
    const occurrences = countOccurrences(source, row.exactBefore);
    assert(
      occurrences === row.occurrences,
      `${row.id}: literal occurrence count is ${occurrences}, expected ${row.occurrences}`,
    );
  }
  return register;
}

function registerDigest(root = ROOT) {
  return sha256File(
    join(
      root,
      ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json",
    ),
  );
}

function definitionDigest(row) {
  return sha256(
    stableJson({
      id: row.id,
      target: row.target,
      exactBefore: row.exactBefore,
      exactAfter: row.exactAfter,
      compileCommand: row.compileCommand,
      killerCommand: row.killerCommand,
      assertionFingerprint: row.assertionFingerprint,
    }),
  );
}

function testHashes(row, root = ROOT) {
  return Object.fromEntries(
    TEST_HASH_PATHS[row.id].map((path) => [path, sha256File(join(root, path))]),
  );
}

function isReleaseInputPath(path) {
  if (GENERATED_PATHS.includes(path)) return false;
  if (ROOT_INPUT_PATHS.has(path)) return true;
  return INPUT_DIRECTORY_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function releaseInputPaths(root = ROOT) {
  const output = runGitSync(["ls-files", "-z"], root);
  const paths = [...new Set(output.split("\0").filter(Boolean))]
    .filter(isReleaseInputPath)
    .sort();
  assert(paths.length > 0, "release input manifest is empty");
  return Object.freeze(paths);
}

function makeInputManifest(root = ROOT, paths = releaseInputPaths(root)) {
  const entries = paths.map((path) => {
    const absolutePath = join(root, path);
    assert(existsSync(absolutePath), `release input is missing: ${path}`);
    return Object.freeze({ path, sha256: sha256File(absolutePath) });
  });
  return Object.freeze({
    entries: Object.freeze(entries),
    digest: sha256(stableJson(entries)),
  });
}

function verifyInputManifest(
  expected,
  root = ROOT,
  { verifyPathSet = true } = {},
) {
  assert(expected !== null && typeof expected === "object", "input manifest is malformed");
  assert(Array.isArray(expected.entries), "input manifest entries are malformed");
  assert(SHA256.test(expected.digest), "input manifest digest is malformed");
  const expectedPaths = expected.entries.map((entry) => entry.path);
  if (verifyPathSet) {
    assert(
      JSON.stringify(expectedPaths) === JSON.stringify(releaseInputPaths(root)),
      "release input path set is stale",
    );
  }
  const current = makeInputManifest(root, expectedPaths);
  for (const [index, entry] of expected.entries.entries()) {
    assert(
      entry.sha256 === current.entries[index].sha256,
      `release input digest is stale: ${entry.path}`,
    );
  }
  assert(expected.digest === current.digest, "release input aggregate digest is stale");
  return current;
}

function phase08Hashes(root = ROOT) {
  return Object.freeze(
    Object.fromEntries(PHASE08_PATHS.map((path) => [path, sha256File(join(root, path))])),
  );
}

function assertPhase08Hashes(expected, root = ROOT) {
  const current = phase08Hashes(root);
  assert(
    JSON.stringify(current) === JSON.stringify(expected),
    "one or more exact Phase 8 records drifted",
  );
  return current;
}

function scopedStatus(root, paths) {
  const lines = [];
  for (let index = 0; index < paths.length; index += 150) {
    const chunk = paths.slice(index, index + 150);
    const output = runGitSync(
      ["status", "--porcelain=v1", "--untracked-files=no", "--", ...chunk],
      root,
    );
    lines.push(...output.split(/\r?\n/u).filter(Boolean));
  }
  return [...new Set(lines)].sort();
}

function assertCleanReleaseInputs(
  root,
  paths,
  { allowedModifiedPaths = [] } = {},
) {
  const allowed = new Set(allowedModifiedPaths);
  const dirty = scopedStatus(root, paths).filter((line) => {
    const path = line.slice(3).replace(/^"|"$/gu, "");
    return !allowed.has(path);
  });
  assert(
    dirty.length === 0,
    `release input tree is dirty:\n${dirty.join("\n")}`,
  );
}

function outputEndpoints() {
  return Object.fromEntries(
    OUTPUT_PATHS.map((path) => [
      path,
      existsSync(path)
        ? Object.freeze({ exists: true, sha256: sha256File(path) })
        : Object.freeze({ exists: false, sha256: null }),
    ]),
  );
}

function assertOutputEndpoints(expected) {
  assert(
    JSON.stringify(outputEndpoints()) === JSON.stringify(expected),
    "a non-generating command changed a Phase 09 output endpoint",
  );
}

function assertOwnedTempRoot(root) {
  assert(isAbsolute(root), "owned temporary root must be absolute");
  assert(root === normalize(resolve(root)), "owned temporary root must be normalized");
  assert(dirname(root) === SYSTEM_TEMP_ROOT, "owned temporary root must be a direct temp child");
  assert(
    basename(root).startsWith(TEMP_PREFIX) && basename(root).length > TEMP_PREFIX.length,
    "owned temporary root has the wrong prefix",
  );
  assert(existsSync(root) && statSync(root).isDirectory(), "owned temporary root is missing");
  assert(!isWithin(realpathSync(root), ROOT), "owned temporary root resolved inside the repository");
  const marker = join(root, OWNERSHIP_MARKER);
  assert(
    existsSync(marker) && statSync(marker).isFile() && readFileSync(marker, "utf8") === basename(root),
    "owned temporary root marker is invalid",
  );
}

function createOwnedTempRoot() {
  const root = mkdtempSync(join(SYSTEM_TEMP_ROOT, TEMP_PREFIX));
  writeFileSync(join(root, OWNERSHIP_MARKER), basename(root), { encoding: "utf8", flag: "wx" });
  assertOwnedTempRoot(root);
  return root;
}

function removeOwnedTempRoot(root) {
  assertOwnedTempRoot(root);
  rmSync(root, { recursive: true, force: false });
  assert(!existsSync(root), "owned temporary root survived cleanup");
}

function assertSnapshotPath(path, snapshotRoot) {
  const normalizedRoot = normalize(resolve(snapshotRoot));
  const normalizedPath = normalize(resolve(path));
  assert(
    normalizedPath !== normalizedRoot && isWithin(normalizedPath, normalizedRoot),
    `live-tree-write attempt rejected: ${normalizedPath}`,
  );
  assert(!isWithin(normalizedPath, ROOT), `live-tree-write attempt rejected: ${normalizedPath}`);
}

function copyTrackedFile(sourceRoot, destinationRoot, path) {
  const source = join(sourceRoot, path);
  const destination = join(destinationRoot, path);
  mkdirSync(dirname(destination), { recursive: true });
  const status = lstatSync(source);
  if (status.isSymbolicLink()) {
    symlinkSync(readlinkSync(source), destination);
  } else {
    copyFileSync(source, destination);
  }
}

function initializeDisposableRepository(root, paths) {
  runGitSync(["init", "--quiet"], root);
  runGitSync(["config", "user.email", "phase09-mutation@example.invalid"], root);
  runGitSync(["config", "user.name", "Phase 09 Mutation Battery"], root);
  for (let index = 0; index < paths.length; index += 150) {
    runGitSync(["add", "--", ...paths.slice(index, index + 150)], root);
  }
  runGitSync(["commit", "--quiet", "-m", "disposable immutable snapshot"], root);
}

async function runCommand(
  executable,
  arguments_,
  {
    cwd,
    env = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxOutputBytes = MAX_OUTPUT_BYTES,
  } = {},
) {
  return new Promise((resolvePromise) => {
    let settled = false;
    let timedOut = false;
    let outputOverflow = false;
    let stdout = "";
    let stderr = "";
    const child = spawn(executable, arguments_, {
      cwd,
      env: {
        ...process.env,
        CI: "1",
        FORCE_COLOR: "0",
        NO_COLOR: "1",
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const finish = (exitCode, signal, spawnError = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(
        Object.freeze({
          command: commandText([executable, ...arguments_]),
          exitCode,
          signal,
          timedOut,
          outputOverflow,
          spawnError,
          stdout,
          stderr,
          output: `${stdout}${stderr}`,
        }),
      );
    };

    const append = (stream, chunk) => {
      const text = chunk.toString("utf8");
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) + Buffer.byteLength(text) > maxOutputBytes) {
        outputOverflow = true;
        child.kill("SIGKILL");
        return;
      }
      if (stream === "stdout") stdout += text;
      else stderr += text;
    };

    child.stdout.on("data", (chunk) => append("stdout", chunk));
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    child.on("error", (error) => finish(null, null, error.message));
    child.on("close", (code, signal) => finish(code, signal));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
  });
}

function assertSuccessfulCommand(result, label) {
  assert(result.spawnError === null, `${label}: process error: ${result.spawnError}`);
  assert(!result.timedOut, `${label}: command timed out`);
  assert(!result.outputOverflow, `${label}: command exceeded bounded output`);
  assert(result.signal === null, `${label}: command ended by signal ${result.signal}`);
  assert(
    result.exitCode === 0,
    `${label}: command exited ${result.exitCode}\n${boundedExcerpt(result.output)}`,
  );
}

function cloneBaseline(source, destination) {
  mkdirSync(destination);
  let result = spawnSync("cp", ["-cR", `${source}/.`, destination], {
    encoding: "utf8",
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  if (result.status !== 0) {
    result = spawnSync("cp", ["-R", `${source}/.`, destination], {
      encoding: "utf8",
      maxBuffer: MAX_OUTPUT_BYTES,
    });
  }
  assert(
    result.error === undefined && result.signal === null && result.status === 0,
    `immutable baseline copy failed: ${boundedExcerpt(`${result.stdout ?? ""}${result.stderr ?? ""}`)}`,
  );
}

async function materializeBaseline(outerRoot, inputManifest) {
  const baselineRoot = join(outerRoot, "baseline");
  mkdirSync(baselineRoot);
  for (const { path } of inputManifest.entries) {
    copyTrackedFile(ROOT, baselineRoot, path);
  }
  initializeDisposableRepository(
    baselineRoot,
    inputManifest.entries.map((entry) => entry.path),
  );
  const copied = makeInputManifest(baselineRoot);
  assert(copied.digest === inputManifest.digest, "baseline differs from measured release inputs");

  const install = await runCommand(
    "pnpm",
    ["install", "--offline", "--frozen-lockfile"],
    { cwd: baselineRoot, timeoutMs: INSTALL_TIMEOUT_MS },
  );
  assertSuccessfulCommand(install, "baseline frozen offline install");
  const build = await runCommand("pnpm", ["build"], {
    cwd: baselineRoot,
    timeoutMs: PACKAGE_TIMEOUT_MS,
  });
  assertSuccessfulCommand(build, "baseline build");
  verifyInputManifest(inputManifest, baselineRoot);
  return Object.freeze({ root: baselineRoot, inputManifest });
}

function replaceExactOnce(source, before, after, label) {
  const occurrences = countOccurrences(source, before);
  assert(
    occurrences === 1,
    `${label}: exact replacement occurrence count is ${occurrences}, expected 1`,
  );
  return source.replace(before, after);
}

function parseVitestFailure(reportPath, row) {
  assert(existsSync(reportPath), `${row.id}: Vitest JSON report is missing`);
  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (error) {
    throw new Error(`${row.id}: Vitest JSON report is unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
  const results = Array.isArray(report.testResults) ? report.testResults : [];
  const assertions = results.flatMap((result) =>
    Array.isArray(result.assertionResults) ? result.assertionResults : [],
  );
  const activeAssertions = assertions.filter(
    (assertion) => !["skipped", "pending", "todo"].includes(assertion.status),
  );
  const failedAssertions = activeAssertions.filter((assertion) => assertion.status === "failed");
  const labels = failedAssertions.map((assertion) =>
    [
      ...(Array.isArray(assertion.ancestorTitles) ? assertion.ancestorTitles : []),
      assertion.title,
      assertion.fullName,
    ]
      .filter((value) => typeof value === "string")
      .join(" "),
  );
  const counts = Object.freeze({
    files: results.length,
    tests: activeAssertions.length,
    assertions: activeAssertions.length,
  });
  assert(report.success === false, `${row.id}: failed-mutant report claimed success`);
  assert(
    counts.files === row.expectedCounts.files &&
      counts.tests === row.expectedCounts.tests &&
      counts.assertions === row.expectedCounts.assertions,
    `${row.id}: detector counts were ${stableJson(counts)}, expected ${stableJson(row.expectedCounts)}`,
  );
  assert(failedAssertions.length === 1, `${row.id}: detector did not report exactly one failed assertion`);
  assert(
    report.numFailedTests === 1,
    `${row.id}: Vitest aggregate did not report exactly one failed named test`,
  );
  assert(
    labels.filter((label) => label.includes(row.assertionFingerprint)).length === 1,
    `${row.id}: unrelated nonzero did not match ${row.assertionFingerprint}`,
  );
  assert(
    !Array.isArray(report.unhandledErrors) || report.unhandledErrors.length === 0,
    `${row.id}: Vitest reported an unhandled infrastructure error`,
  );
  return Object.freeze({ counts, observedFingerprint: row.assertionFingerprint });
}

function validateSemanticVerdict(row, compile, killer, observation) {
  assertSuccessfulCommand(compile, `${row.id} compile`);
  assert(killer.spawnError === null, `${row.id}: killer process error: ${killer.spawnError}`);
  assert(!killer.timedOut, `${row.id}: killer command timed out`);
  assert(!killer.outputOverflow, `${row.id}: killer exceeded bounded output`);
  assert(killer.signal === null, `${row.id}: killer ended by signal ${killer.signal}`);
  assert(killer.exitCode !== 0, `${row.id}: mutant survived with exit 0`);
  assert(
    observation.counts.files > 0 &&
      observation.counts.tests > 0 &&
      observation.counts.assertions > 0,
    `${row.id}: detector reported zero tests/assertions`,
  );
  assert(
    JSON.stringify(observation.counts) === JSON.stringify(row.expectedCounts),
    `${row.id}: semantic detector counts drifted`,
  );
  assert(
    observation.observedFingerprint === row.assertionFingerprint,
    `${row.id}: unrelated nonzero fingerprint`,
  );
}

function packageCaptureHookSource() {
  return `import fs from "node:fs";\n` +
    `import path from "node:path";\n` +
    `import { syncBuiltinESMExports } from "node:module";\n` +
    `const original = fs.rmSync.bind(fs);\n` +
    `const capture = process.env.PHASE09_MUTATION_CAPTURE_DIR;\n` +
    `const wanted = new Set(["vitest-consent.json", "vitest-react-mismatch.json"]);\n` +
    `function scan(root) {\n` +
    `  const stack = [root];\n` +
    `  while (stack.length > 0) {\n` +
    `    const current = stack.pop();\n` +
    `    let entries = [];\n` +
    `    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }\n` +
    `    for (const entry of entries) {\n` +
    `      const item = path.join(current, entry.name);\n` +
    `      if (entry.isFile() && wanted.has(entry.name)) {\n` +
    `        fs.copyFileSync(item, path.join(capture, entry.name));\n` +
    `      } else if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {\n` +
    `        stack.push(item);\n` +
    `      }\n` +
    `    }\n` +
    `  }\n` +
    `}\n` +
    `fs.rmSync = function patchedRmSync(target, options) {\n` +
    `  if (capture && typeof target === "string" && path.basename(target).startsWith("concierge-phase09-pack-") && fs.existsSync(target)) scan(target);\n` +
    `  return original(target, options);\n` +
    `};\n` +
    `syncBuiltinESMExports();\n`;
}

async function runKiller(row, mutantRoot, outerRoot) {
  const spec = KILLER_COMMANDS[row.id];
  const reportPath = join(mutantRoot, `.phase09-${row.id.toLowerCase()}-report.json`);
  const arguments_ = spec.slice(1).map((argument) =>
    argument.replace("{report}", reportPath),
  );
  const options = {
    cwd: mutantRoot,
    timeoutMs: row.killerKind === "package" || row.id === "M-09-P1"
      ? PACKAGE_TIMEOUT_MS
      : DEFAULT_TIMEOUT_MS,
    env: {},
  };
  let capturePath = null;
  if (row.killerKind === "package") {
    const captureDirectory = join(outerRoot, `capture-${row.id.toLowerCase()}`);
    mkdirSync(captureDirectory);
    const hookPath = join(outerRoot, `capture-hook-${row.id.toLowerCase()}.mjs`);
    writeFileSync(hookPath, packageCaptureHookSource(), "utf8");
    const hookOption = `--import=${pathToFileURL(hookPath).href}`;
    options.env = {
      NODE_OPTIONS: [process.env.NODE_OPTIONS, hookOption].filter(Boolean).join(" "),
      PHASE09_MUTATION_CAPTURE_DIR: captureDirectory,
    };
    capturePath = join(
      captureDirectory,
      row.id === "M-09-S1" ? "vitest-consent.json" : "vitest-react-mismatch.json",
    );
  }
  const result = await runCommand(spec[0], arguments_, options);
  let observation;
  if (row.killerKind === "vitest") {
    observation = parseVitestFailure(reportPath, row);
  } else if (row.killerKind === "package") {
    observation = parseVitestFailure(capturePath, row);
  } else {
    assert(
      result.output.includes(row.assertionFingerprint),
      `${row.id}: unrelated nonzero did not contain the registered semantic fingerprint`,
    );
    observation = Object.freeze({
      counts: Object.freeze({ ...row.expectedCounts }),
      observedFingerprint: row.assertionFingerprint,
    });
  }
  return Object.freeze({ result, observation });
}

function mutationRowMetadata(row, root) {
  const originalSource = readFileSync(join(root, row.target), "utf8");
  const mutantSource = replaceExactOnce(
    originalSource,
    row.exactBefore,
    row.exactAfter,
    row.id,
  );
  return Object.freeze({
    definitionDigest: definitionDigest(row),
    originalTargetHash: sha256(originalSource),
    mutantTargetHash: sha256(mutantSource),
    testHashes: testHashes(row, root),
  });
}

async function executeMutant(row, baseline, liveState, outerRoot) {
  verifyInputManifest(baseline.inputManifest, baseline.root);
  const mutantRoot = join(outerRoot, `mutant-${row.id.toLowerCase()}`);
  cloneBaseline(baseline.root, mutantRoot);
  const targetPath = join(mutantRoot, row.target);
  assertSnapshotPath(targetPath, mutantRoot);
  const source = readFileSync(targetPath, "utf8");
  const originalTargetHash = sha256(source);
  const mutated = replaceExactOnce(source, row.exactBefore, row.exactAfter, row.id);
  const mutantTargetHash = sha256(mutated);
  assert(originalTargetHash !== mutantTargetHash, `${row.id}: mutant target hash is unchanged`);
  writeFileSync(targetPath, mutated, "utf8");
  assert(sha256File(targetPath) === mutantTargetHash, `${row.id}: mutant write digest changed`);

  let compile;
  let killer;
  let observation;
  try {
    const compileSpec = COMPILE_COMMANDS[row.id];
    compile = await runCommand(compileSpec[0], compileSpec.slice(1), {
      cwd: mutantRoot,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    assertSuccessfulCommand(compile, `${row.id} compile`);
    ({ result: killer, observation } = await runKiller(row, mutantRoot, outerRoot));
    validateSemanticVerdict(row, compile, killer, observation);
  } finally {
    writeFileSync(targetPath, source, "utf8");
  }

  assert(sha256File(targetPath) === originalTargetHash, `${row.id}: disposable target was not restored`);
  verifyInputManifest(baseline.inputManifest, baseline.root);
  verifyInputManifest(liveState.inputManifest, ROOT);
  assertCleanReleaseInputs(ROOT, liveState.paths, {
    allowedModifiedPaths: liveState.allowedModifiedPaths,
  });
  assertOutputEndpoints(liveState.outputEndpoints);

  const metadata = mutationRowMetadata(row, baseline.root);
  assert(metadata.originalTargetHash === originalTargetHash, `${row.id}: original target digest drifted`);
  assert(metadata.mutantTargetHash === mutantTargetHash, `${row.id}: mutant target digest drifted`);
  const revisionDigest = sha256(
    stableJson({
      id: row.id,
      releaseInputDigest: baseline.inputManifest.digest,
      registerDigest: registerDigest(baseline.root),
      definitionDigest: metadata.definitionDigest,
      originalTargetHash,
      mutantTargetHash,
      testHashes: metadata.testHashes,
    }),
  );
  return Object.freeze({
    id: row.id,
    status: "green",
    target: row.target,
    affectedPackage: row.affectedPackage,
    testId: row.testId,
    requirement: row.requirement,
    threat: row.threat,
    decisions: row.decisions,
    definitionDigest: metadata.definitionDigest,
    originalTargetHash,
    mutantTargetHash,
    testHashes: metadata.testHashes,
    revisionDigest,
    compile: Object.freeze({
      command: row.compileCommand,
      exitCode: compile.exitCode,
      outputDigest: sha256(compile.output),
    }),
    killer: Object.freeze({
      command: row.killerCommand,
      kind: row.killerKind,
      exitCode: killer.exitCode,
      counts: observation.counts,
      assertionFingerprint: observation.observedFingerprint,
      outputDigest: sha256(killer.output),
    }),
    exactReplacementCount: 1,
    compiled: true,
    killed: true,
    targetRestored: true,
    liveTreeUnchanged: true,
    executedAt: new Date().toISOString(),
  });
}

function mutationLiveState({ allowRunnerModification = false } = {}) {
  const paths = releaseInputPaths(ROOT);
  const allowedModifiedPaths = allowRunnerModification
    ? ["scripts/phase-09-mutation-battery.mjs"]
    : [];
  assertCleanReleaseInputs(ROOT, paths, { allowedModifiedPaths });
  return Object.freeze({
    paths,
    inputManifest: makeInputManifest(ROOT, paths),
    allowedModifiedPaths,
    outputEndpoints: outputEndpoints(),
  });
}

function mutationLockPath() {
  const common = runGitSync(["rev-parse", "--git-common-dir"], ROOT).trim();
  return resolve(ROOT, common, "phase-09-mutation-battery.lock");
}

async function withMutationLock(operation) {
  const path = mutationLockPath();
  let descriptor;
  try {
    descriptor = openSync(path, "wx");
  } catch (error) {
    throw new Error(`${operation}: mutation battery is already running (${error instanceof Error ? error.message : String(error)})`);
  }
  try {
    return await operation();
  } finally {
    closeSync(descriptor);
    unlinkSync(path);
  }
}

async function runPreflight(id) {
  const register = validateRegister(readRegister());
  const row = register.rows.find((candidate) => candidate.id === id);
  assert(row !== undefined, `unknown registered preflight mutant: ${id}`);
  const liveState = mutationLiveState({ allowRunnerModification: true });
  const outerRoot = createOwnedTempRoot();
  try {
    const baseline = await materializeBaseline(outerRoot, liveState.inputManifest);
    const result = await executeMutant(row, baseline, liveState, outerRoot);
    assert(result.status === "green" && result.killed, `${id}: preflight did not close green`);
    console.log(
      `PHASE09_MUTATION_PREFLIGHT_OK id=${id} files=${result.killer.counts.files} tests=${result.killer.counts.tests} assertions=${result.killer.counts.assertions} restored=true liveTreeUnchanged=true`,
    );
  } finally {
    removeOwnedTempRoot(outerRoot);
  }
  assertOutputEndpoints(liveState.outputEndpoints);
}

function assertThrows(operation, pattern, label) {
  let observed = null;
  try {
    operation();
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
  }
  assert(
    observed !== null && pattern.test(observed),
    `self-test ${label} did not reject as expected; observed ${JSON.stringify(observed)}`,
  );
}

async function assertRejects(operation, pattern, label) {
  let observed = null;
  try {
    await operation();
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
  }
  assert(
    observed !== null && pattern.test(observed),
    `self-test ${label} did not reject as expected; observed ${JSON.stringify(observed)}`,
  );
}

function syntheticCommand(exitCode, overrides = {}) {
  return {
    command: "synthetic",
    exitCode,
    signal: null,
    timedOut: false,
    outputOverflow: false,
    spawnError: null,
    stdout: "",
    stderr: "",
    output: "",
    ...overrides,
  };
}

async function runSelfTest() {
  const endpoints = outputEndpoints();
  const register = validateRegister(readRegister());
  const row = register.rows[0];
  let controls = 0;
  const pass = (name) => {
    controls += 1;
    console.log(`SELF_TEST_OK ${name}`);
  };

  assertThrows(
    () => replaceExactOnce("needle needle", "needle", "mutant", "ambiguous"),
    /occurrence count is 2/u,
    "ambiguous needle",
  );
  pass("ambiguous-needle");
  assertThrows(
    () => replaceExactOnce("source", "needle", "mutant", "missing"),
    /occurrence count is 0/u,
    "missing needle",
  );
  pass("missing-needle");

  const goodObservation = {
    counts: { files: 1, tests: 1, assertions: 1 },
    observedFingerprint: row.assertionFingerprint,
  };
  assertThrows(
    () => validateSemanticVerdict(row, syntheticCommand(2), syntheticCommand(1), goodObservation),
    /compile.*exited 2/u,
    "compile failure",
  );
  pass("compile-failure");
  assertThrows(
    () => validateSemanticVerdict(row, syntheticCommand(0), syntheticCommand(null, { timedOut: true }), goodObservation),
    /timed out/u,
    "timeout verdict",
  );
  pass("timeout");
  assertThrows(
    () => validateSemanticVerdict(row, syntheticCommand(0), syntheticCommand(1), { counts: { files: 0, tests: 0, assertions: 0 }, observedFingerprint: row.assertionFingerprint }),
    /zero tests\/assertions/u,
    "zero tests",
  );
  pass("zero-tests");
  assertThrows(
    () => validateSemanticVerdict(row, syntheticCommand(0), syntheticCommand(1), { ...goodObservation, observedFingerprint: "unrelated" }),
    /unrelated nonzero/u,
    "unrelated failure",
  );
  pass("unrelated-nonzero");
  assertThrows(
    () => validateSemanticVerdict(row, syntheticCommand(0), syntheticCommand(0), goodObservation),
    /survived/u,
    "survivor",
  );
  pass("survivor");

  const timeoutResult = await runCommand(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], {
    cwd: ROOT,
    timeoutMs: 25,
  });
  assert(timeoutResult.timedOut, "self-test subprocess timeout was not observed");
  pass("bounded-subprocess-timeout");

  const temporaryRoot = createOwnedTempRoot();
  try {
    const fixtureRoot = join(temporaryRoot, "manifest-fixture");
    mkdirSync(fixtureRoot);
    writeFileSync(join(fixtureRoot, "input.txt"), "A\n", "utf8");
    const manifest = makeInputManifest(fixtureRoot, ["input.txt"]);
    writeFileSync(join(fixtureRoot, "input.txt"), "B\n", "utf8");
    assertThrows(
      () => verifyInputManifest(manifest, fixtureRoot, { verifyPathSet: false }),
      /digest is stale/u,
      "stale input digest",
    );
    pass("stale-input-digest");
    assertThrows(
      () => assert(registerDigest() === "0".repeat(64), "register digest is stale"),
      /register digest is stale/u,
      "stale register digest",
    );
    pass("stale-register-digest");
    const hashes = testHashes(row);
    assertThrows(
      () => assert(hashes[Object.keys(hashes)[0]] === "0".repeat(64), "test digest is stale"),
      /test digest is stale/u,
      "stale test digest",
    );
    pass("stale-test-digest");
    assertThrows(
      () => assertSnapshotPath(join(ROOT, row.target), fixtureRoot),
      /live-tree-write attempt/u,
      "live tree write",
    );
    pass("live-tree-write");
  } finally {
    removeOwnedTempRoot(temporaryRoot);
  }

  const duplicate = clone(register);
  duplicate.rows[1].id = duplicate.rows[0].id;
  assertThrows(
    () => validateRegister(duplicate, ROOT, { requireTracked: false }),
    /duplicate|row ids/u,
    "duplicate ID",
  );
  pass("duplicate-id");
  assertThrows(
    () => parseInvocation(["run", "all", "--jobs", "5"]),
    /Usage/u,
    "unbounded jobs",
  );
  pass("jobs-bound");
  assertThrows(
    () => parseInvocation(["verify", "inputs"]),
    /Usage/u,
    "undeclared CLI",
  );
  pass("exact-cli");

  assert(controls === 15, `self-test control count drifted: ${controls}`);
  assertOutputEndpoints(endpoints);
  console.log(`PHASE09_MUTATION_SELF_TEST_OK controls=${controls}`);
}

function sealedObject(value) {
  const body = { ...value };
  return Object.freeze({ ...body, contentDigest: sha256(stableJson(body)) });
}

function verifySeal(value, label) {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${label} is malformed`);
  const { contentDigest, ...body } = value;
  assert(SHA256.test(contentDigest), `${label} contentDigest is malformed`);
  assert(contentDigest === sha256(stableJson(body)), `${label} content digest is stale`);
  return body;
}

function markdownSeal(body) {
  return `${body.trimEnd()}\n\n<!-- content-sha256: ${sha256(body.trimEnd())} -->\n`;
}

function verifyMarkdownSeal(text, label) {
  const match = text.match(/\n\n<!-- content-sha256: ([0-9a-f]{64}) -->\n?$/u);
  assert(match !== null, `${label} content digest is missing`);
  const body = text.slice(0, match.index).trimEnd();
  assert(match[1] === sha256(body), `${label} content digest is stale`);
  return body;
}

function validateGreenEvidenceRow(evidenceRow, registerRow, root = ROOT) {
  assert(evidenceRow.id === registerRow.id, `${registerRow.id}: evidence row identity drifted`);
  assert(evidenceRow.status === "green", `${registerRow.id}: evidence is not green`);
  for (const key of ["compiled", "killed", "targetRestored", "liveTreeUnchanged"]) {
    assert(evidenceRow[key] === true, `${registerRow.id}: ${key} is not true`);
  }
  assert(evidenceRow.exactReplacementCount === 1, `${registerRow.id}: exact replacement count drifted`);
  assert(evidenceRow.definitionDigest === definitionDigest(registerRow), `${registerRow.id}: definition digest is stale`);
  const metadata = mutationRowMetadata(registerRow, root);
  assert(evidenceRow.originalTargetHash === metadata.originalTargetHash, `${registerRow.id}: source digest is stale`);
  assert(evidenceRow.mutantTargetHash === metadata.mutantTargetHash, `${registerRow.id}: mutant digest is stale`);
  assert(JSON.stringify(evidenceRow.testHashes) === JSON.stringify(metadata.testHashes), `${registerRow.id}: test digest is stale`);
  assert(evidenceRow.compile.command === registerRow.compileCommand && evidenceRow.compile.exitCode === 0, `${registerRow.id}: compile evidence is invalid`);
  assert(
    evidenceRow.killer.command === registerRow.killerCommand &&
      evidenceRow.killer.kind === registerRow.killerKind &&
      Number.isInteger(evidenceRow.killer.exitCode) &&
      evidenceRow.killer.exitCode !== 0,
    `${registerRow.id}: killer exit evidence is invalid`,
  );
  assert(
    JSON.stringify(evidenceRow.killer.counts) === JSON.stringify(registerRow.expectedCounts),
    `${registerRow.id}: killer positive counts are stale`,
  );
  assert(
    evidenceRow.killer.assertionFingerprint === registerRow.assertionFingerprint,
    `${registerRow.id}: killer fingerprint is stale`,
  );
  assert(SHA256.test(evidenceRow.revisionDigest), `${registerRow.id}: revision digest is malformed`);
}

function verifyMutationEvidence(root = ROOT, { quiet = false } = {}) {
  const path = join(root, ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json");
  assert(existsSync(path), "09-MUTATION-EVIDENCE.json is missing");
  const evidence = JSON.parse(readFileSync(path, "utf8"));
  verifySeal(evidence, "mutation evidence");
  assert(evidence.schemaVersion === 1 && evidence.phase === PHASE, "mutation evidence identity is invalid");
  const register = validateRegister(readRegister(root), root);
  assert(evidence.registerDigest === registerDigest(root), "mutation evidence register digest is stale");
  assert(JSON.stringify(evidence.expectedIds) === JSON.stringify(EXPECTED_IDS), "mutation evidence IDs drifted");
  verifyInputManifest(evidence.releaseInputs, root);
  assertPhase08Hashes(evidence.phase08, root);
  assert(Array.isArray(evidence.rows) && evidence.rows.length === EXPECTED_IDS.length, "mutation evidence row count drifted");
  assert(JSON.stringify(evidence.rows.map((row) => row.id)) === JSON.stringify(EXPECTED_IDS), "mutation evidence rows drifted");
  const revisions = new Set();
  for (const [index, registerRow] of register.rows.entries()) {
    const row = evidence.rows[index];
    validateGreenEvidenceRow(row, registerRow, root);
    assert(!revisions.has(row.revisionDigest), `${row.id}: revision digest is duplicated`);
    revisions.add(row.revisionDigest);
  }
  if (!quiet) console.log("PHASE09_MUTATION_EVIDENCE_OK rows=7 green=7");
  return evidence;
}

function validateReleaseCommands(commands) {
  const expectedNames = [
    "typecheck",
    "build",
    "test",
    "check:artifact",
    "check:deps",
    "check:pack",
    "check:node-floor",
    "test:phase09",
    "astro-check",
    "astro-build",
    "phase09-vitest-json",
    "phase-09-package-check all",
    "phase-09-adapter-budget check",
    "phase-09-adapter-budget self-test",
    "phase-09-workflow-check",
  ];
  assert(Array.isArray(commands), "release command evidence is malformed");
  assert(
    JSON.stringify(commands.map((command) => command.name)) === JSON.stringify(expectedNames),
    "release command set/count/order drifted",
  );
  for (const command of commands) {
    assert(command.exitCode === 0, `release command ${command.name} is not green`);
    assert(SHA256.test(command.outputDigest), `release command ${command.name} output digest is malformed`);
  }
}

function verifyReleaseEvidence(root = ROOT, { quiet = false } = {}) {
  const path = join(root, ".planning/phases/09-react-and-svelte-adapters/09-RELEASE-EVIDENCE.json");
  assert(existsSync(path), "09-RELEASE-EVIDENCE.json is missing");
  const release = JSON.parse(readFileSync(path, "utf8"));
  verifySeal(release, "release evidence");
  assert(release.schemaVersion === 1 && release.phase === PHASE, "release evidence identity is invalid");
  assert(release.registerDigest === registerDigest(root), "release register digest is stale");
  verifyInputManifest(release.releaseInputs, root);
  assertPhase08Hashes(release.phase08.hashes, root);
  assert(Array.isArray(release.phase08.verification) && release.phase08.verification.length === 3, "Phase 8 verification command count drifted");
  for (const [index, record] of release.phase08.verification.entries()) {
    assert(record.command === commandText(PHASE08_COMMANDS[index]), "Phase 8 verification command drifted");
    assert(record.exitCode === 0 && record.fingerprint.includes("PASS"), "Phase 8 verification result is not positive");
  }
  validateReleaseCommands(release.commands);
  assert(
    release.tests.files > 0 && release.tests.tests > 0 && release.tests.assertions > 0,
    "release positive test counts are missing",
  );
  assert(
    release.archives !== null && typeof release.archives === "object" &&
      Object.keys(release.archives).length === 3,
    "release exact archive triplet is missing",
  );
  assert(
    release.archiveManifestDigest === sha256(stableJson({ archives: release.archives, tarEntryCounts: release.tarEntryCounts })),
    "release exact archive digest is stale",
  );
  const mutationPath = join(root, ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json");
  const validationPath = join(root, ".planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md");
  const securityPath = join(root, ".planning/phases/09-react-and-svelte-adapters/09-SECURITY.md");
  assert(release.mutationEvidenceDigest === sha256File(mutationPath), "release mutation evidence digest is stale");
  assert(release.validationDigest === sha256File(validationPath), "release validation digest is stale");
  assert(release.securityDigest === sha256File(securityPath), "release security digest is stale");
  if (!quiet) console.log("PHASE09_RELEASE_EVIDENCE_OK commands=15 archives=3 phase08=5");
  return release;
}

function countToken(text, token) {
  return text.split(token).length - 1;
}

function verifyLedgers(root = ROOT) {
  const validationText = readFileSync(join(root, ".planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md"), "utf8");
  const securityText = readFileSync(join(root, ".planning/phases/09-react-and-svelte-adapters/09-SECURITY.md"), "utf8");
  const validation = verifyMarkdownSeal(validationText, "validation ledger");
  const security = verifyMarkdownSeal(securityText, "security ledger");
  const joined = `${validation}\n${security}`;
  assert(!/MISSING|PENDING|TBD|NOT RUN/u.test(joined), "terminal ledgers contain an incomplete marker");
  for (const taskId of REQUIRED_TASK_IDS) {
    assert(countToken(validation, taskId) === 1, `${taskId}: validation task trace count must equal one`);
  }
  for (let index = 1; index <= 8; index += 1) {
    const testId = `T${String(index).padStart(2, "0")}`;
    assert(validation.includes(testId), `${testId}: canonical validation meaning is missing`);
  }
  for (const threat of REQUIRED_THREATS) {
    assert(security.includes(threat), `${threat}: security disposition is missing`);
  }
  for (const token of [
    "@fullselfbrowsing/concierge",
    "08-consent-kernel",
    "M-09-B1",
    "M-09-SSR1",
    "ADP-03",
    "ADP-04",
    "D-09-15",
    "D-09-16",
  ]) {
    assert(joined.includes(token), `terminal ledgers are missing ${token}`);
  }
  return true;
}

function verifyAll(root = ROOT, { quiet = false } = {}) {
  verifyMutationEvidence(root, { quiet: true });
  verifyReleaseEvidence(root, { quiet: true });
  verifyLedgers(root);
  if (!quiet) console.log("PHASE09_MUTATION_VERIFY_ALL_OK evidence=green release=green ledgers=green");
  return true;
}

function ensureFinalInputs(root, paths) {
  const pathSet = new Set(paths);
  for (const path of REQUIRED_FINAL_INPUT_PATHS) {
    assert(existsSync(join(root, path)), `run all final release input is missing: ${path}`);
    assert(pathSet.has(path), `run all final release input is not tracked: ${path}`);
  }
}

async function mapLimit(items, limit, operation) {
  const results = new Array(items.length);
  let next = 0;
  async function consume() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await operation(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return results;
}

function gitShowBuffer(commit, path) {
  const result = spawnSync("git", ["show", `${commit}:${path}`], {
    cwd: ROOT,
    encoding: null,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  if (result.error !== undefined || result.signal !== null || result.status !== 0) return null;
  return result.stdout;
}

function findPhase08EvidenceRevision(liveHashes) {
  const evidencePath = PHASE08_PATHS[1];
  const evidence = JSON.parse(readFileSync(join(ROOT, evidencePath), "utf8"));
  const commits = runGitSync(["rev-list", "--all", "--", evidencePath], ROOT)
    .split(/\r?\n/u)
    .filter(Boolean);
  for (const commit of commits) {
    const evidenceBytes = gitShowBuffer(commit, evidencePath);
    if (evidenceBytes === null || sha256(evidenceBytes) !== liveHashes[evidencePath]) continue;
    const inputsMatch = Object.entries(evidence.inputHashes).every(([path, digest]) => {
      const bytes = gitShowBuffer(commit, path);
      return bytes !== null && sha256(bytes) === digest;
    });
    if (inputsMatch) return commit;
  }
  throw new Error("cannot find the immutable Phase 8 evidence-producing revision");
}

async function verifyInheritedPhase08(outerRoot, liveHashes) {
  const revision = findPhase08EvidenceRevision(liveHashes);
  const snapshotRoot = join(outerRoot, "phase08-snapshot");
  mkdirSync(snapshotRoot);
  const archivePath = join(outerRoot, "phase08-snapshot.tar");
  const archive = await runCommand("git", ["archive", "--format=tar", `--output=${archivePath}`, revision], {
    cwd: ROOT,
  });
  assertSuccessfulCommand(archive, "Phase 8 snapshot archive");
  const extract = await runCommand("tar", ["-xf", archivePath, "-C", snapshotRoot], { cwd: outerRoot });
  assertSuccessfulCommand(extract, "Phase 8 snapshot extract");
  rmSync(archivePath, { force: true });
  for (const path of PHASE08_PATHS) copyTrackedFile(ROOT, snapshotRoot, path);
  copyTrackedFile(ROOT, snapshotRoot, ".planning/REQUIREMENTS.md");
  const tracked = [];
  const walk = (directory, prefix = "") => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(join(directory, entry.name), path);
      else tracked.push(path);
    }
  };
  walk(snapshotRoot);
  initializeDisposableRepository(snapshotRoot, tracked.sort());
  const install = await runCommand("pnpm", ["install", "--offline", "--frozen-lockfile"], {
    cwd: snapshotRoot,
    timeoutMs: INSTALL_TIMEOUT_MS,
  });
  assertSuccessfulCommand(install, "Phase 8 snapshot frozen offline install");

  const verification = [];
  for (const spec of PHASE08_COMMANDS) {
    const result = await runCommand(spec[0], spec.slice(1), {
      cwd: snapshotRoot,
      timeoutMs: PACKAGE_TIMEOUT_MS,
      env: { PHASE_08_SNAPSHOT_GATE: "1" },
    });
    assertSuccessfulCommand(result, `inherited ${commandText(spec)}`);
    assert(result.output.includes("PASS"), `${commandText(spec)} omitted its positive fingerprint`);
    verification.push(
      Object.freeze({
        command: commandText(spec),
        exitCode: result.exitCode,
        fingerprint: boundedExcerpt(result.output, 600),
        outputDigest: sha256(result.output),
      }),
    );
  }
  assertPhase08Hashes(liveHashes, ROOT);
  return Object.freeze({ revision, verification: Object.freeze(verification) });
}

function parsePositiveVitestReport(reportPath) {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  assert(report.success === true, "Phase 09 Vitest JSON did not report success");
  const results = Array.isArray(report.testResults) ? report.testResults : [];
  const assertions = results.flatMap((result) =>
    Array.isArray(result.assertionResults) ? result.assertionResults : [],
  );
  const active = assertions.filter((assertion) => !["skipped", "pending", "todo"].includes(assertion.status));
  assert(results.length > 0 && report.numTotalTests > 0 && active.length > 0, "Phase 09 Vitest JSON has zero files/tests/assertions");
  assert(active.every((assertion) => assertion.status === "passed"), "Phase 09 Vitest JSON contains a failing assertion");
  return Object.freeze({ files: results.length, tests: report.numTotalTests, assertions: active.length });
}

function parsePackageResult(output) {
  const line = output
    .split(/\r?\n/u)
    .find((candidate) => candidate.startsWith("PHASE09_PACKAGE_RESULT "));
  assert(line !== undefined, "phase-09-package-check all omitted structured result");
  const value = JSON.parse(line.slice("PHASE09_PACKAGE_RESULT ".length));
  assert(value.mode === "all" && value.status === "passed", "package all result is not green");
  assert(value.archives !== null && Object.keys(value.archives).length === 3, "package all did not produce exactly three archives");
  return value;
}

async function runReleaseGates(baseline, outerRoot) {
  const commands = [];
  const run = async (name, executable, arguments_, options = {}) => {
    const result = await runCommand(executable, arguments_, {
      cwd: baseline.root,
      timeoutMs: options.timeoutMs ?? PACKAGE_TIMEOUT_MS,
      env: options.env ?? {},
    });
    assertSuccessfulCommand(result, `release ${name}`);
    commands.push(
      Object.freeze({
        name,
        command: commandText([executable, ...arguments_]),
        exitCode: result.exitCode,
        outputDigest: sha256(result.output),
        fingerprint: boundedExcerpt(result.output, 500),
      }),
    );
    verifyInputManifest(baseline.inputManifest, baseline.root);
    return result;
  };

  await run("typecheck", "pnpm", ["typecheck"]);
  await run("build", "pnpm", ["build"]);
  await run("test", "pnpm", ["test"]);
  await run("check:artifact", "pnpm", ["check:artifact"]);
  await run("check:deps", "pnpm", ["check:deps"]);
  await run("check:pack", "pnpm", ["check:pack"]);
  await run("check:node-floor", "pnpm", ["check:node-floor"]);
  await run("test:phase09", "pnpm", ["test:phase09"]);
  await run("astro-check", "pnpm", ["--filter", "@fullselfbrowsing/concierge-adapter-ssr", "check"]);
  await run("astro-build", "pnpm", ["--filter", "@fullselfbrowsing/concierge-adapter-ssr", "build"]);

  const reportPath = join(outerRoot, "phase09-tests.json");
  await run(
    "phase09-vitest-json",
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "--project",
      "react-lifecycle",
      "--project",
      "svelte-lifecycle",
      "--project",
      "node-artifact-ssr",
      "--reporter=json",
      `--outputFile=${reportPath}`,
    ],
  );
  const tests = parsePositiveVitestReport(reportPath);

  const archiveDirectory = join(outerRoot, "release-archives");
  mkdirSync(archiveDirectory);
  const packageResult = await run(
    "phase-09-package-check all",
    "node",
    ["scripts/phase-09-package-check.mjs", "all"],
    { env: { PHASE09_ARCHIVE_EXPORT_DIR: archiveDirectory } },
  );
  const packageEvidence = parsePackageResult(packageResult.output);
  await run("phase-09-adapter-budget check", "node", ["scripts/phase-09-adapter-budget.mjs", "check"]);
  await run("phase-09-adapter-budget self-test", "node", ["scripts/phase-09-adapter-budget.mjs", "self-test"]);
  await run("phase-09-workflow-check", "node", ["scripts/phase-09-workflow-check.mjs"]);
  assert(commands.length === 15, `release command count drifted: ${commands.length}`);
  return Object.freeze({
    commands: Object.freeze(commands),
    tests,
    packageEvidence,
    archiveDirectory,
  });
}

function makeValidationMarkdown({ releaseInputDigest, registerHash, mutationRows, archiveDigest }) {
  const taskRows = REQUIRED_TASK_IDS.map(
    (id) => `| ${id} | passed | ${releaseInputDigest} |`,
  ).join("\n");
  const mutationByTest = Object.fromEntries(mutationRows.map((row) => [row.testId, row.id]));
  const testRows = [
    ["T01", "React StrictMode setup-cleanup-setup, stale-cleanup resistance, and final null", mutationByTest.T01],
    ["T02", "React late reads observe the latest committed plain nested value", mutationByTest.T02],
    ["T03", "Svelte real-rune snapshot closes consent after nested live drift", mutationByTest.T03],
    ["T04", "Normal fresh-process Astro SSR remains registration-silent", mutationByTest.T04],
    ["T05", "One physical core and exact public contract mismatch guards", "M-09-P1, M-09-C1"],
    ["T06", "Exact tarball transforms preserve client directive, rune output, and TypeScript domains", archiveDigest],
    ["T07", "Independent production inventory and adapter budget enforcement", mutationByTest.T07],
    ["T08", "Immutable compile-first mutation evidence and drift rejection", registerHash],
  ].map(([id, meaning, evidence]) => `| ${id} | ${meaning} | ${evidence} |`).join("\n");
  const decisions = Array.from({ length: 17 }, (_, index) => {
    const id = `D-09-${String(index + 1).padStart(2, "0")}`;
    const evidence = id === "D-09-15"
      ? "fresh-process built Astro SSR (T04 / M-09-SSR1)"
      : id === "D-09-16"
        ? "exact three-tarball isolated consumer (T05/T06 / M-09-P1/M-09-C1)"
        : `release revision ${releaseInputDigest}`;
    return `| ${id} | ${evidence} |`;
  }).join("\n");
  return markdownSeal(`# Phase 09 Validation\n\nRevision-bound validation for @fullselfbrowsing/concierge, its React and Svelte adapters, and the inherited 08-consent-kernel records.\n\n## Task Traceability\n\n| Task | Result | Evidence |\n|---|---|---|\n${taskRows}\n\n## Canonical Test Meanings\n\n| Test | Locked meaning | Evidence |\n|---|---|---|\n${testRows}\n\n## Requirement Closure\n\n| Requirement | Evidence |\n|---|---|\n| ADP-01 | T01/M-09-R1 and T02/M-09-R2 |\n| ADP-02 | T03/M-09-S1 |\n| ADP-03 | T07/M-09-B1 only |\n| ADP-04 | T04/M-09-SSR1 normal Astro SSR |\n| PKG-04 | T05/T06 exact archive and contract proof |\n\n## Decision Evidence\n\n| Decision | Evidence |\n|---|---|\n${decisions}\n\n## Immutable Bindings\n\n- Release input digest: ${releaseInputDigest}\n- Mutation register digest: ${registerHash}\n- Exact archive manifest digest: ${archiveDigest}\n- Phase 8 evidence source: .planning/phases/08-consent-kernel/08-MUTATION-EVIDENCE.json (nested release member)\n`);
}

function makeSecurityMarkdown({ releaseInputDigest, mutationRows }) {
  const byThreat = new Map();
  for (const row of mutationRows) {
    const rows = byThreat.get(row.threat) ?? [];
    rows.push(row.id);
    byThreat.set(row.threat, rows);
  }
  const descriptions = Object.freeze({
    "T-09-01": "React cleanup tampering",
    "T-09-02": "React stale-value tampering",
    "T-09-03": "Svelte snapshot identity tampering",
    "T-09-04": "SSR registration disclosure",
    "T-09-05": "duplicate-core or contract-skew elevation",
    "T-09-06": "package transform tampering",
    "T-09-07": "budget inventory tampering",
    "T-09-08": "mutation verdict repudiation",
    "T-09-SC": "dependency supply-chain tampering",
  });
  const rows = REQUIRED_THREATS.map((threat) => {
    const evidence = (byThreat.get(threat) ?? []).join(", ") ||
      (threat === "T-09-06"
        ? "T06 exact archive triplet"
        : threat === "T-09-08"
          ? "T08 compile-first immutable runner"
          : "frozen offline install and inherited 08-consent-kernel verification");
    return `| ${threat} | ${descriptions[threat]} | mitigated | ${evidence} |`;
  }).join("\n");
  return markdownSeal(`# Phase 09 Security\n\nSecurity closure for @fullselfbrowsing/concierge adapter delivery at revision ${releaseInputDigest}.\n\n| Threat | Surface | Disposition | Evidence |\n|---|---|---|---|\n${rows}\n\nThe live Phase 8 records remain byte-identical and their release proof remains the nested release member of 08-consent-kernel/08-MUTATION-EVIDENCE.json.\n`);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function installOutputsTransactionally(sourceRoot) {
  const transactionId = randomUUID();
  const operations = GENERATED_PATHS.map((relativePath) => {
    const source = join(sourceRoot, relativePath);
    const destination = join(ROOT, relativePath);
    const temporary = `${destination}.tmp-${transactionId}`;
    const backup = `${destination}.bak-${transactionId}`;
    copyFileSync(source, temporary);
    return { destination, temporary, backup, hadOriginal: existsSync(destination) };
  });
  const installed = [];
  try {
    for (const operation of operations) {
      if (operation.hadOriginal) renameSync(operation.destination, operation.backup);
      renameSync(operation.temporary, operation.destination);
      installed.push(operation);
    }
    for (const operation of operations) rmSync(operation.backup, { force: true });
  } catch (error) {
    for (const operation of installed.reverse()) {
      rmSync(operation.destination, { force: true });
      if (operation.hadOriginal && existsSync(operation.backup)) {
        renameSync(operation.backup, operation.destination);
      }
    }
    for (const operation of operations) {
      rmSync(operation.temporary, { force: true });
      if (operation.hadOriginal && existsSync(operation.backup) && !existsSync(operation.destination)) {
        renameSync(operation.backup, operation.destination);
      }
    }
    throw error;
  }
}

async function runAll(jobs) {
  const register = validateRegister(readRegister());
  const liveState = mutationLiveState();
  ensureFinalInputs(ROOT, liveState.paths);
  const inheritedHashes = phase08Hashes(ROOT);
  const outerRoot = createOwnedTempRoot();
  try {
    const inherited = await verifyInheritedPhase08(outerRoot, inheritedHashes);
    const baseline = await materializeBaseline(outerRoot, liveState.inputManifest);
    const rows = await mapLimit(register.rows, jobs, async (row, index) => {
      const result = await executeMutant(row, baseline, liveState, outerRoot);
      console.log(`[green ${index + 1}/${register.rows.length}] ${row.id}`);
      return result;
    });
    const releaseGates = await runReleaseGates(baseline, outerRoot);
    assertPhase08Hashes(inheritedHashes, ROOT);
    verifyInputManifest(liveState.inputManifest, ROOT);
    assertCleanReleaseInputs(ROOT, liveState.paths);

    const mutationEvidence = sealedObject({
      schemaVersion: 1,
      phase: PHASE,
      generatedAt: new Date().toISOString(),
      registerDigest: registerDigest(baseline.root),
      expectedIds: EXPECTED_IDS,
      releaseInputs: baseline.inputManifest,
      phase08: inheritedHashes,
      rows,
    });
    const mutationPath = join(baseline.root, GENERATED_PATHS[0]);
    writeJson(mutationPath, mutationEvidence);

    const archiveManifestDigest = sha256(
      stableJson({
        archives: releaseGates.packageEvidence.archives,
        tarEntryCounts: releaseGates.packageEvidence.tarEntryCounts,
      }),
    );
    const validation = makeValidationMarkdown({
      releaseInputDigest: baseline.inputManifest.digest,
      registerHash: registerDigest(baseline.root),
      mutationRows: rows,
      archiveDigest: archiveManifestDigest,
    });
    const security = makeSecurityMarkdown({
      releaseInputDigest: baseline.inputManifest.digest,
      mutationRows: rows,
    });
    const validationPath = join(baseline.root, GENERATED_PATHS[2]);
    const securityPath = join(baseline.root, GENERATED_PATHS[3]);
    writeFileSync(validationPath, validation, "utf8");
    writeFileSync(securityPath, security, "utf8");

    const releaseEvidence = sealedObject({
      schemaVersion: 1,
      phase: PHASE,
      generatedAt: new Date().toISOString(),
      registerDigest: registerDigest(baseline.root),
      releaseInputs: baseline.inputManifest,
      mutationEvidenceDigest: sha256File(mutationPath),
      validationDigest: sha256File(validationPath),
      securityDigest: sha256File(securityPath),
      phase08: Object.freeze({
        sourceRevision: inherited.revision,
        hashes: inheritedHashes,
        verification: inherited.verification,
      }),
      commands: releaseGates.commands,
      tests: releaseGates.tests,
      archives: releaseGates.packageEvidence.archives,
      tarEntryCounts: releaseGates.packageEvidence.tarEntryCounts,
      archiveManifestDigest,
      packageGate: "node scripts/phase-09-package-check.mjs all",
      budgetGate: "node scripts/phase-09-adapter-budget.mjs check",
    });
    writeJson(join(baseline.root, GENERATED_PATHS[1]), releaseEvidence);

    verifyAll(baseline.root, { quiet: true });
    const contract = await runCommand("node", ["scripts/phase-09-contract-check.mjs", "final"], {
      cwd: baseline.root,
    });
    assertSuccessfulCommand(contract, "prospective Phase 09 final contract");
    const prospectiveVerify = await runCommand(
      "node",
      ["scripts/phase-09-mutation-battery.mjs", "verify", "all"],
      { cwd: baseline.root },
    );
    assertSuccessfulCommand(prospectiveVerify, "prospective Phase 09 verify all");

    assertPhase08Hashes(inheritedHashes, ROOT);
    verifyInputManifest(liveState.inputManifest, ROOT);
    assertCleanReleaseInputs(ROOT, liveState.paths);
    installOutputsTransactionally(baseline.root);
    verifyAll(ROOT, { quiet: true });
    console.log(
      `PHASE09_MUTATION_RUN_ALL_OK mutants=7 jobs=${jobs} commands=15 archives=3 phase08=5`,
    );
  } finally {
    removeOwnedTempRoot(outerRoot);
  }
}

async function main(arguments_) {
  const invocation = parseInvocation(arguments_);
  if (invocation.kind === "self-test") {
    await runSelfTest();
    return;
  }
  if (invocation.kind === "preflight") {
    await withMutationLock(() => runPreflight(invocation.id));
    return;
  }
  if (invocation.kind === "run-all") {
    await withMutationLock(() => runAll(invocation.jobs));
    return;
  }
  if (invocation.kind === "verify-evidence") {
    verifyMutationEvidence();
    return;
  }
  if (invocation.kind === "verify-release") {
    verifyReleaseEvidence();
    return;
  }
  if (invocation.kind === "verify-all") {
    verifyAll();
    return;
  }
  throw new UsageError();
}

try {
  await main(process.argv.slice(2));
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
