#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = realpathSync(
  resolve(dirname(fileURLToPath(import.meta.url)), ".."),
);
const CI_PATH = ".github/workflows/ci.yml";
const RELEASE_PATH = ".github/workflows/release.yml";
const PACKAGE_PATH = "package.json";
const PACKAGE_MANIFESTS = Object.freeze([
  Object.freeze({
    path: "packages/concierge/package.json",
    name: "@fullselfbrowsing/concierge",
  }),
  Object.freeze({
    path: "packages/concierge-react/package.json",
    name: "@fullselfbrowsing/concierge-react",
  }),
  Object.freeze({
    path: "packages/concierge-svelte/package.json",
    name: "@fullselfbrowsing/concierge-svelte",
  }),
]);
const ARCHIVE_DIRECTORY_EXPRESSION =
  "${{ runner.temp }}/phase09-archives";
const EXACT_ROOT_SCRIPTS = Object.freeze({
  build: "pnpm -r build",
  test: "vitest run",
  typecheck: "pnpm -r typecheck",
  "check:artifact":
    "pnpm --filter @fullselfbrowsing/concierge exec publint --strict && pnpm exec attw --pack packages/concierge --profile esm-only",
  "check:deps":
    "node scripts/pkg05-zero-runtime-deps.mjs packages/concierge/dist/index.js",
  "check:pack": "bash scripts/pack-install-check.sh",
  "check:node-floor": "bash scripts/node-floor-check.sh",
  "test:phase09": "node scripts/phase-09-test-check.mjs",
  "check:phase09:packages": "node scripts/phase-09-package-check.mjs all",
  "check:phase09:budget": "node scripts/phase-09-adapter-budget.mjs check",
  "check:phase09:static": "node scripts/phase-09-contract-check.mjs final",
  "check:phase09:evidence":
    "node scripts/phase-09-mutation-battery.mjs verify all",
  "check:phase09":
    "pnpm run test:phase09 && pnpm --filter @fullselfbrowsing/concierge-adapter-ssr check && pnpm --filter @fullselfbrowsing/concierge-adapter-ssr build && pnpm run check:phase09:packages && pnpm run check:phase09:budget && pnpm run check:phase09:static && pnpm run check:phase09:evidence",
  "check:phase09:release":
    "pnpm run check:phase09 && node scripts/phase-09-workflow-check.mjs",
  release: "changeset publish",
});

function fail(code, message) {
  throw new Error(`[${code}] ${message}`);
}

function assert(condition, code, message) {
  if (!condition) fail(code, message);
}

function countOccurrences(source, token) {
  assert(token.length > 0, "CHECKER", "count token must be nonempty");
  return source.split(token).length - 1;
}

function readNonemptyFile(path) {
  const absolute = resolve(REPOSITORY_ROOT, path);
  let metadata;
  let source;
  try {
    metadata = lstatSync(absolute);
    source = readFileSync(absolute, "utf8");
  } catch (error) {
    fail(
      "WORKFLOW_FILE",
      `${path} is missing or unreadable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  assert(
    metadata.isFile() && metadata.size > 0 && source.trim().length > 0,
    "WORKFLOW_FILE",
    `${path} must be a nonempty regular file`,
  );
  return source;
}

function leadingSpaces(line) {
  return /^ */u.exec(line)?.[0].length ?? 0;
}

function blockValue(lines, keyLine, keyIndent) {
  const values = [];
  for (let index = keyLine + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().length > 0 && leadingSpaces(line) <= keyIndent) break;
    values.push(line);
  }
  const populated = values.filter((line) => line.trim().length > 0);
  const indentation = populated.length === 0
    ? keyIndent + 2
    : Math.min(...populated.map(leadingSpaces));
  return values.map((line) => line.slice(indentation)).join("\n").trim();
}

function parseWorkflowSteps(source, path) {
  const lines = source.split(/\r?\n/u);
  const starts = [];
  for (const [index, line] of lines.entries()) {
    const match = /^(\s*)-\s+(name|uses|run):\s*(.*)$/u.exec(line);
    if (match !== null && match[1].length >= 4) {
      starts.push({ index, indent: match[1].length, key: match[2], value: match[3] });
    }
  }
  assert(starts.length > 0, "WORKFLOW_STEPS", `${path} contains no steps`);

  return starts.map((start) => {
    let end = lines.length;
    for (let index = start.index + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim().length === 0 || line.trimStart().startsWith("#")) {
        continue;
      }
      const indent = leadingSpaces(line);
      if (indent < start.indent) {
        end = index;
        break;
      }
      if (
        indent === start.indent &&
        /^(\s*)-\s+(?:name|uses|run):/u.test(line)
      ) {
        end = index;
        break;
      }
    }

    const fields = new Map();
    fields.set(start.key, { line: start.index, indent: start.indent, value: start.value });
    for (let index = start.index + 1; index < end; index += 1) {
      const match = /^(\s*)(name|uses|run):\s*(.*)$/u.exec(lines[index]);
      if (match !== null && match[1].length === start.indent + 2) {
        fields.set(match[2], {
          line: index,
          indent: match[1].length,
          value: match[3],
        });
      }
    }

    const runField = fields.get("run");
    let run = null;
    if (runField !== undefined) {
      run = /^[|>][+-]?$/u.test(runField.value)
        ? blockValue(lines, runField.line, runField.indent)
        : runField.value.trim();
    }
    return Object.freeze({
      index: start.index,
      name: fields.get("name")?.value.trim() ?? null,
      uses: fields.get("uses")?.value.trim() ?? null,
      run,
      raw: lines.slice(start.index, end).join("\n"),
    });
  });
}

function executableSource(source) {
  return source
    .split(/\r?\n/u)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
}

function requireOneStep(steps, predicate, label) {
  const matches = steps.filter(predicate);
  assert(
    matches.length === 1,
    "STEP_COUNT",
    `${label} must occur exactly once; found ${matches.length}`,
  );
  return matches[0];
}

function requireExactRun(steps, command, label = command) {
  return requireOneStep(
    steps,
    (step) => step.run?.trim() === command,
    label,
  );
}

function requireUse(steps, action, label = action) {
  return requireOneStep(steps, (step) => step.uses === action, label);
}

function requireOrder(entries, label) {
  const indexes = entries.map((entry) => entry.index);
  assert(
    indexes.every((value, index) => index === 0 || value > indexes[index - 1]),
    "STEP_ORDER",
    `${label} order drifted: ${indexes.join(" -> ")}`,
  );
}

function requireExactUseSequence(steps, expected, path) {
  const actual = steps
    .filter((step) => step.uses !== null)
    .map((step) => step.uses);
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    "ACTION_PINS",
    `${path} action sequence/pins drifted; expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
  );
}

function validateBlocking(workflow, path) {
  assert(
    !/(?:^|\n)\s*continue-on-error\s*:/u.test(workflow.executable),
    "IGNORED_FAILURE",
    `${path} contains continue-on-error`,
  );
  assert(
    !/(?:^|\n)\s*if\s*:\s*.*\balways\s*\(/u.test(workflow.executable),
    "IGNORED_FAILURE",
    `${path} contains an always() step`,
  );

  for (const step of workflow.steps) {
    if (step.run === null) continue;
    for (const [pattern, description] of [
      [/\bset\s+\+e\b/u, "set +e"],
      [/\|\|\s*(?:true\b|:\s*(?:$|[;\n])|echo\b|printf\b|\{)/u, "ignored || failure"],
      [/(?:^|[;\n])\s*exit\s+0\b/u, "forced exit 0"],
      [/(?:^|[;\n])\s*true\s*(?:$|[;\n])/u, "standalone true"],
    ]) {
      assert(
        !pattern.test(step.run),
        "IGNORED_FAILURE",
        `${path} ${step.name ?? `step at line ${step.index + 1}`} contains ${description}`,
      );
    }
  }
}

function extractLiteralBlock(raw, field) {
  const lines = raw.split(/\r?\n/u);
  const fieldIndex = lines.findIndex((line) =>
    new RegExp(`^\\s*${field}:\\s*[|>]`, "u").test(line),
  );
  assert(fieldIndex >= 0, "UPLOAD_PATHS", `${field} block is missing`);
  const fieldIndent = leadingSpaces(lines[fieldIndex]);
  const values = [];
  for (let index = fieldIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().length > 0 && leadingSpaces(line) <= fieldIndent) break;
    if (line.trim().length > 0) values.push(line.trim());
  }
  return values;
}

function validateExactUploadPaths(step) {
  const expected = [
    "${{ steps.phase09-archives.outputs.core }}",
    "${{ steps.phase09-archives.outputs.react }}",
    "${{ steps.phase09-archives.outputs.svelte }}",
    "${{ steps.phase09-archives.outputs.manifest }}",
  ];
  const actual = extractLiteralBlock(step.raw, "path");
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    "UPLOAD_PATHS",
    `release upload paths must be the exact checked triplet and manifest; actual=${JSON.stringify(actual)}`,
  );
  assert(
    actual.every((path) => !/[?*\[]/u.test(path)),
    "ARCHIVE_GLOB",
    "release upload contains a broad archive glob",
  );
}

function validateNoRepackBetween(steps, verification, upload) {
  const between = steps
    .filter((step) => step.index > verification.index && step.index < upload.index)
    .map((step) => step.run ?? "")
    .join("\n");
  assert(
    !/\b(?:npm|pnpm)\s+pack\b|\bcheck:pack\b|phase-09-package-check\.mjs/u.test(
      between,
    ),
    "REPACK_AFTER_VERIFY",
    "a second package/pack command appears between verification and upload",
  );
}

function validateEmbeddedNodeProgram(step) {
  const match =
    /^node --input-type=module <<'NODE'\n([\s\S]+)\nNODE$/u.exec(step.run ?? "");
  assert(
    match !== null,
    "ARCHIVE_RESOLVER",
    "archive resolver must be one closed Node module heredoc",
  );
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--check"],
    {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      input: match[1],
      maxBuffer: 1024 * 1024,
      timeout: 10_000,
    },
  );
  assert(
    result.error === undefined &&
      result.signal === null &&
      result.status === 0,
    "WORKFLOW_SYNTAX",
    `archive resolver Node syntax failed: ${result.stderr}`,
  );
}

function readWorkflow(path) {
  const source = readNonemptyFile(path);
  const workflow = Object.freeze({
    source,
    executable: executableSource(source),
    steps: parseWorkflowSteps(source, path),
  });
  validateBlocking(workflow, path);
  return workflow;
}

function validateLivePackageContracts() {
  const rootManifest = JSON.parse(readNonemptyFile(PACKAGE_PATH));
  for (const [name, command] of Object.entries(EXACT_ROOT_SCRIPTS)) {
    assert(
      rootManifest.scripts?.[name] === command,
      "ROOT_SCRIPT",
      `${name} must equal ${command}`,
    );
  }

  for (const expected of PACKAGE_MANIFESTS) {
    const manifest = JSON.parse(readNonemptyFile(expected.path));
    assert(
      manifest.name === expected.name &&
        typeof manifest.version === "string" &&
        manifest.version.length > 0,
      "PACKAGE_IDENTITY",
      `${expected.path} does not contain the exact live package name/version`,
    );
  }
}

function validateCi(workflow) {
  const { steps, executable } = workflow;
  requireExactUseSequence(
    steps,
    [
      "actions/checkout@v5",
      "pnpm/action-setup@v4",
      "actions/setup-node@v5",
      "actions/upload-artifact@v4",
      "actions/download-artifact@v4",
      "actions/setup-node@v5",
    ],
    CI_PATH,
  );

  const install = requireExactRun(steps, "pnpm install --frozen-lockfile");
  const typecheck = requireExactRun(steps, "pnpm typecheck");
  const build = requireExactRun(steps, "pnpm build");
  const test = requireExactRun(steps, "pnpm test");
  const artifact = requireExactRun(steps, "pnpm run check:artifact");
  const dependencies = requireExactRun(steps, "pnpm run check:deps");
  const pack = requireExactRun(steps, "pnpm run check:pack");
  const phase09 = requireExactRun(steps, "pnpm run check:phase09");
  const floorPack = requireExactRun(
    steps,
    'pnpm pack --pack-destination "${{ runner.temp }}"',
    "CI floor archive pack",
  );
  const floorUpload = requireUse(steps, "actions/upload-artifact@v4");
  const floorDownload = requireUse(steps, "actions/download-artifact@v4");
  requireOrder(
    [
      install,
      typecheck,
      build,
      test,
      artifact,
      dependencies,
      pack,
      phase09,
      floorPack,
      floorUpload,
      floorDownload,
    ],
    "CI inherited and Phase 09 gates",
  );

  assert(
    countOccurrences(executable, "pnpm run check:phase09") === 1,
    "STEP_COUNT",
    "CI must execute check:phase09 exactly once",
  );
  for (const [token, count] of [
    ["node-version: 24", 1],
    ["node-version: '22.12.0'", 1],
    ["needs: build", 1],
    ["if-no-files-found: error", 1],
  ]) {
    assert(
      countOccurrences(executable, token) === count,
      "CI_FLOOR",
      `${CI_PATH} must contain ${token} exactly ${count} time(s)`,
    );
  }

  const floorStart = executable.indexOf("\n  node-floor:");
  assert(floorStart >= 0, "CI_FLOOR", "the separate node-floor job is missing");
  assert(
    !/\bpnpm\b/u.test(executable.slice(floorStart)),
    "CI_FLOOR",
    "the node-floor job must remain npm/node-only",
  );
  for (const token of [
    "process.version !== 'v22.12.0'",
    "npm init -y && npm install --no-audit --no-fund ./*.tgz",
    'import("@fullselfbrowsing/concierge")',
    "m.assertSingleInstance()",
    "m.MESSAGE_MAX_CHARS !== 180",
  ]) {
    assert(executable.includes(token), "CI_FLOOR", `node-floor is missing ${token}`);
  }
}

function validateRelease(workflow) {
  const { steps, executable } = workflow;
  requireExactUseSequence(
    steps,
    [
      "actions/checkout@v5",
      "pnpm/action-setup@v4",
      "actions/setup-node@v5",
      "actions/upload-artifact@v4",
      "changesets/action@v1",
    ],
    RELEASE_PATH,
  );

  const install = requireExactRun(steps, "pnpm install --frozen-lockfile");
  const inherited = requireExactRun(
    steps,
    "pnpm typecheck && pnpm build && pnpm test",
    "release typecheck/build/test chain",
  );
  const artifact = requireExactRun(steps, "pnpm run check:artifact");
  const dependencies = requireExactRun(steps, "pnpm run check:deps");
  const pack = requireExactRun(steps, "pnpm run check:pack");
  const floor = requireExactRun(steps, "pnpm run check:node-floor");
  const allocate = requireOneStep(
    steps,
    (step) =>
      step.run?.includes(`test ! -e "${ARCHIVE_DIRECTORY_EXPRESSION}"`) === true &&
      step.run.includes(`mkdir "${ARCHIVE_DIRECTORY_EXPRESSION}"`),
    "empty Phase 09 archive allocation",
  );
  const phase09 = requireExactRun(
    steps,
    "pnpm run check:phase09:release",
    "same-revision Phase 09 release gate",
  );
  const resolver = requireOneStep(
    steps,
    (step) => step.name === "Resolve the exact checked Phase 09 archives",
    "exact Phase 09 archive resolver",
  );
  const upload = requireUse(
    steps,
    "actions/upload-artifact@v4",
    "release exact archive upload",
  );
  const publish = requireUse(steps, "changesets/action@v1");
  requireOrder(
    [
      install,
      inherited,
      artifact,
      dependencies,
      pack,
      floor,
      allocate,
      phase09,
      resolver,
      upload,
      publish,
    ],
    "release inherited gates, Phase 09 verification, upload, and publish",
  );

  assert(
    countOccurrences(executable, "pnpm run check:phase09:release") === 1,
    "STEP_COUNT",
    "release must execute check:phase09:release exactly once",
  );
  assert(
    countOccurrences(executable, "PHASE09_ARCHIVE_EXPORT_DIR") === 1 &&
      phase09.raw.includes(
        `PHASE09_ARCHIVE_EXPORT_DIR: ${ARCHIVE_DIRECTORY_EXPRESSION}`,
      ),
    "ARCHIVE_EXPORT_ENV",
    "PHASE09_ARCHIVE_EXPORT_DIR must be step-local to the release gate",
  );
  assert(
    resolver.raw.includes(
      `PHASE09_CHECKED_ARCHIVE_DIR: ${ARCHIVE_DIRECTORY_EXPRESSION}`,
    ),
    "ARCHIVE_RESOLVER",
    "archive resolver must read the same runner-temp export directory",
  );
  for (const token of [
    "phase-09-archive-digests.json",
    "@fullselfbrowsing/concierge",
    "@fullselfbrowsing/concierge-react",
    "@fullselfbrowsing/concierge-svelte",
    'createHash("sha256")',
    "readdirSync(directory).sort()",
    "GITHUB_OUTPUT",
    "outputs.push(`${key}=${archivePath}`)",
  ]) {
    assert(
      resolver.raw.includes(token),
      "ARCHIVE_RESOLVER",
      `archive resolver is missing ${token}`,
    );
  }
  validateEmbeddedNodeProgram(resolver);
  validateExactUploadPaths(upload);
  validateNoRepackBetween(steps, phase09, upload);

  assert(
    !/\b(?:npm|pnpm)\s+pack\b/u.test(
      steps
        .filter((step) => step.index > phase09.index)
        .map((step) => step.run ?? "")
        .join("\n"),
    ),
    "REPACK_AFTER_VERIFY",
    "release contains a pack command after same-revision verification",
  );
  assert(
    !phase09.raw.includes("if:") &&
      !upload.raw.includes("if:") &&
      !publish.raw.includes("if:") &&
      !publish.raw.includes("continue-on-error"),
    "BLOCKING_PUBLISH",
    "verification, upload, and publication must retain default success gating",
  );

  for (const [token, count] of [
    ["contents: write", 1],
    ["pull-requests: write", 1],
    ["id-token: write", 1],
    ["fetch-depth: 0", 1],
    ["node-version: 24", 1],
    ["registry-url: 'https://registry.npmjs.org'", 1],
    ["npm install -g npm@latest", 1],
    ["version: pnpm changeset version", 1],
    ["publish: pnpm changeset publish", 1],
    ["GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}", 1],
  ]) {
    assert(
      countOccurrences(executable, token) === count,
      "RELEASE_INHERITED",
      `${RELEASE_PATH} must contain ${token} exactly ${count} time(s)`,
    );
  }
  for (const forbidden of ["NPM_TOKEN", "--provenance", "auth-token-line"] ) {
    assert(
      !executable.includes(forbidden),
      "TRUSTED_PUBLISHING",
      `${RELEASE_PATH} executable YAML contains forbidden ${forbidden}`,
    );
  }
  for (const forbidden of ["git checkout", "git switch", "git reset", "git pull"] ) {
    assert(
      !steps.some((step) => step.run?.includes(forbidden)),
      "REVISION_DRIFT",
      `release changes revision with ${forbidden}`,
    );
  }
  for (const token of [
    "name: phase09-release-archives",
    "if-no-files-found: error",
  ]) {
    assert(upload.raw.includes(token), "UPLOAD_PATHS", `release upload is missing ${token}`);
  }
}

function expectFailure(label, operation, expectedCode) {
  let observed = null;
  try {
    operation();
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
  }
  assert(
    observed?.includes(`[${expectedCode}]`) === true,
    "CHECKER_SELF_TEST",
    `${label} did not fail with ${expectedCode}; observed=${JSON.stringify(observed)}`,
  );
}

function runDetectorControls() {
  const step = (index, run = null, raw = "") => ({ index, run, raw });
  let controls = 0;
  const control = (label, operation, expectedCode) => {
    expectFailure(label, operation, expectedCode);
    controls += 1;
  };

  control(
    "duplicate-command",
    () => requireOneStep([step(1, "gate"), step(2, "gate")], (item) => item.run === "gate", "gate"),
    "STEP_COUNT",
  );
  control(
    "missing-command",
    () => requireOneStep([], () => true, "missing"),
    "STEP_COUNT",
  );
  control(
    "order-drift",
    () => requireOrder([step(2), step(1)], "synthetic"),
    "STEP_ORDER",
  );
  control(
    "ignored-failure",
    () => validateBlocking({ executable: "steps:", steps: [step(1, "gate || true")] }, "synthetic.yml"),
    "IGNORED_FAILURE",
  );
  control(
    "broad-archive-glob",
    () => validateExactUploadPaths(step(1, null, "path: |\n  /tmp/*.tgz")),
    "UPLOAD_PATHS",
  );
  control(
    "post-verification-repack",
    () => validateNoRepackBetween(
      [step(1), step(2, "pnpm pack"), step(3)],
      step(1),
      step(3),
    ),
    "REPACK_AFTER_VERIFY",
  );
  assert(controls === 6, "CHECKER_SELF_TEST", `expected six controls, ran ${controls}`);
  return controls;
}

if (process.argv.length !== 2) {
  fail("CLI_MODE", "phase-09-workflow-check accepts no arguments");
}

const controls = runDetectorControls();
validateLivePackageContracts();
const ci = readWorkflow(CI_PATH);
const release = readWorkflow(RELEASE_PATH);
validateCi(ci);
validateRelease(release);

process.stdout.write(
  `PHASE09_WORKFLOW_CHECK_OK workflows=2 controls=${controls} ` +
    `ciSteps=${ci.steps.length} releaseSteps=${release.steps.length}\n`,
);
