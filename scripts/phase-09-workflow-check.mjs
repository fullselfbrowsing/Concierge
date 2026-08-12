#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const CI_PATH = ".github/workflows/ci.yml";
const RELEASE_PATH = ".github/workflows/release.yml";
const CHECKOUT = "actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09";
const SETUP_NODE = "actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444";
const SETUP_PNPM = "pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1";
const UPLOAD = "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02";
const DOWNLOAD = "actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093";
const CHANGESETS = "changesets/action@a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d";
const PUBLISHER_SHA256 =
  "f5926fa197e8f31cded9de3d6710649d0151697125c8a227da5ce736c06b24a9";
const NPM_INTEGRITY =
  "sha512-82gRxKrh/eY5UnNorkTFcdBQAGpgjWehkfGVqAGlJjejEtJZGGJUqjo3mbBTNbc5BTnPKGVtGPBZGhElujX5cw==";
const FIRST_RELEASE_CORE_PEER = "workspace:^0.0.0 || ^0.1.0";
const PUBLIC_PACKAGES = Object.freeze([
  "@fullselfbrowsing/concierge",
  "@fullselfbrowsing/concierge-react",
  "@fullselfbrowsing/concierge-svelte",
]);
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
  "version:phase09": "node scripts/phase-09-version.mjs",
  release: "node scripts/phase-09-publish-archives.mjs",
});
const EXACT_PREPARE_COMMAND =
  "node scripts/phase-09-version.mjs prepare\n" +
  '"${{ runner.temp }}/phase09-version-artifact"';
const EXACT_PUBLISH_COMMAND =
  'node "${{ runner.temp }}/phase09-publish-tools/phase-09-publish-archives.mjs" publish\n' +
  '"${{ steps.sealed-inputs.outputs.seal }}"\n' +
  '"${{ steps.sealed-inputs.outputs.core }}"\n' +
  '"${{ steps.sealed-inputs.outputs.react }}"\n' +
  '"${{ steps.sealed-inputs.outputs.svelte }}"';
const VERSION_ARTIFACT_NAME =
  "phase09-version-${{ github.run_id }}-${{ github.run_attempt }}-${{ github.sha }}";
const ARCHIVE_ARTIFACT_NAME =
  "phase09-untrusted-archives-${{ github.run_id }}-${{ github.run_attempt }}-${{ github.sha }}";
const PUBLISHER_ARTIFACT_NAME =
  "phase09-publisher-tools-${{ github.run_id }}-${{ github.run_attempt }}-${{ github.sha }}";
const CANDIDATE_ARTIFACT_NAME =
  "v0.1-candidate-certification-${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}";
const CANDIDATE_RECEIPT_PATH =
  "${{ runner.temp }}/v0.1-candidate-certification/candidate-certification.json";
const CANDIDATE_EVIDENCE_PATHS = Object.freeze([
  ".planning/phases/10-close-v0-1-release-certification-and-evidence-gaps/10-VERIFICATION.md",
  ".planning/v0.1-MILESTONE-AUDIT.md",
  ".planning/phases/10-close-v0-1-release-certification-and-evidence-gaps/10-VALIDATION.md",
  ".planning/phases/10-close-v0-1-release-certification-and-evidence-gaps/10-CERTIFICATION.md",
]);

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

function validateAttemptScopedArtifactName(name, expected) {
  assert(
    name === expected && name.includes("${{ github.run_attempt }}"),
    "ARTIFACT_ATTEMPT",
    `artifact name is not scoped to the exact workflow attempt: ${name}`,
  );
}

function readNonemptyFile(path) {
  const absolute = resolve(ROOT, path);
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

function executableSource(source) {
  return source
    .split(/\r?\n/u)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
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
      if (line.trim().length === 0 || line.trimStart().startsWith("#")) continue;
      const indent = leadingSpaces(line);
      if (
        indent < start.indent ||
        (indent === start.indent && /^(\s*)-\s+(?:name|uses|run):/u.test(line))
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
    const uses = fields.get("uses")?.value
      .replace(/\s+#.*$/u, "")
      .trim() ?? null;
    const run = runField === undefined
      ? null
      : /^[|>][+-]?$/u.test(runField.value)
        ? blockValue(lines, runField.line, runField.indent)
        : runField.value.trim();
    return Object.freeze({
      index: start.index,
      name: fields.get("name")?.value.trim() ?? null,
      uses,
      run,
      raw: lines.slice(start.index, end).join("\n"),
    });
  });
}

function extractJob(source, name, path) {
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === `  ${name}:`);
  assert(start >= 0, "JOB_LAYOUT", `${path} is missing job ${name}`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/u.test(lines[index])) {
      end = index;
      break;
    }
  }
  const jobSource = lines.slice(start, end).join("\n");
  return Object.freeze({
    name,
    source: jobSource,
    executable: executableSource(jobSource),
    steps: parseWorkflowSteps(jobSource, `${path}#${name}`),
    start,
  });
}

function workflowJobNames(source, path) {
  const lines = source.split(/\r?\n/u);
  const jobs = lines.findIndex((line) => line === "jobs:");
  assert(jobs >= 0, "JOB_LAYOUT", `${path} has no jobs block`);
  return lines
    .slice(jobs + 1)
    .map((line) => /^  ([A-Za-z0-9_-]+):\s*$/u.exec(line)?.[1] ?? null)
    .filter(Boolean);
}

function readWorkflow(path) {
  const source = readNonemptyFile(path);
  const workflow = Object.freeze({
    source,
    executable: executableSource(source),
    steps: parseWorkflowSteps(source, path),
  });
  validateBlocking(workflow, path);
  validatePinnedUses(workflow.steps, path);
  return workflow;
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
  return requireOneStep(steps, (step) => step.run?.trim() === command, label);
}

function requireUse(steps, action, label = action) {
  return requireOneStep(steps, (step) => step.uses === action, label);
}

function requireOrder(entries, label, code = "STEP_ORDER") {
  const indexes = entries.map((entry) => entry.index);
  assert(
    indexes.every((value, index) => index === 0 || value > indexes[index - 1]),
    code,
    `${label} order drifted: ${indexes.join(" -> ")}`,
  );
}

function requireBuildBeforeTypecheckChain(steps, { code, label }) {
  const install = requireExactRun(steps, "pnpm install --frozen-lockfile");
  const build = requireExactRun(steps, "pnpm build");
  const typecheck = requireExactRun(steps, "pnpm typecheck");
  const test = requireExactRun(steps, "pnpm test");
  const release = requireExactRun(steps, "pnpm run check:phase09:release");
  requireOrder(
    [install, build, typecheck, test, release],
    `${label} build-before-typecheck chain`,
    code,
  );
  return Object.freeze({ build, install, release, test, typecheck });
}

function validateBlocking(workflow, path) {
  assert(
    !/(?:^|\n)\s*continue-on-error\s*:/u.test(workflow.executable) &&
      !/(?:^|\n)\s*if\s*:\s*.*\balways\s*\(/u.test(workflow.executable),
    "IGNORED_FAILURE",
    `${path} contains a nonblocking gate`,
  );
  for (const step of workflow.steps) {
    if (step.run === null) continue;
    assert(
      !/\bset\s+\+e\b|\|\|\s*(?:true\b|:\s*(?:$|[;\n]))|(?:^|[;\n])\s*exit\s+0\b/u.test(
        step.run,
      ),
      "IGNORED_FAILURE",
      `${path} step ${step.name ?? step.index} ignores failure`,
    );
  }
}

function validatePinnedUses(steps, path) {
  for (const step of steps.filter((candidate) => candidate.uses !== null)) {
    assert(
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/u.test(step.uses),
      "ACTION_PINS",
      `${path} action is not pinned to a full commit: ${step.uses}`,
    );
  }
}

function requireExactUseSequence(steps, expected, path) {
  const actual = steps.filter((step) => step.uses !== null).map((step) => step.uses);
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    "ACTION_PINS",
    `${path} action sequence drifted; expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
  );
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

function validateExactUpload(step, expected) {
  const actual = extractLiteralBlock(step.raw, "path");
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    "UPLOAD_PATHS",
    `artifact upload paths drifted: ${JSON.stringify(actual)}`,
  );
  assert(
    actual.every((path) => !/[?*\[]/u.test(path)),
    "ARCHIVE_GLOB",
    "release artifact upload contains a glob",
  );
}

function validateNoArtifactRepack(steps, verification) {
  const laterRuns = steps
    .filter((step) => step.index > verification.index)
    .map((step) => step.run ?? "")
    .join("\n");
  assert(
    !/\b(?:npm|pnpm)\s+pack\b|\bcheck:pack\b|phase-09-package-check\.mjs/u.test(
      laterRuns,
    ),
    "REPACK_AFTER_VERIFY",
    "release repacks package artifacts after same-revision verification",
  );
}

function validateNoChangesetsPublish(executable) {
  const pattern = new RegExp(["\\bchangesets?", "\\s+", "publish\\b"].join(""), "u");
  assert(
    !pattern.test(executable),
    "CHANGESETS_PUBLISH",
    "release delegates publication to Changesets instead of exact archives",
  );
}

function validateCheckoutIsolation(job, { fetchDepth }) {
  const checkout = requireUse(job.steps, CHECKOUT, `${job.name} checkout`);
  assert(
    checkout.raw.includes("persist-credentials: false") &&
      checkout.raw.includes("ref: ${{ github.sha }}") &&
      checkout.raw.includes(`fetch-depth: ${fetchDepth}`),
    "CHECKOUT_ISOLATION",
    `${job.name} checkout must use exact github.sha without persisted credentials`,
  );
  return checkout;
}

function validateCredentialFreePreparation(job) {
  validateCheckoutIsolation(job, { fetchDepth: 0 });
  assert(
    !/(?:^|\n)\s+(?:GITHUB_TOKEN|GH_TOKEN|NODE_AUTH_TOKEN|NPM_TOKEN):/u.test(
      job.executable,
    ) &&
      countOccurrences(job.executable, 'test ! -e "$HOME/.netrc"') === 2 &&
      countOccurrences(job.executable, 'test -z "${GITHUB_TOKEN:-}"') === 2 &&
      countOccurrences(job.executable, 'test -z "${NODE_AUTH_TOKEN:-}"') === 2 &&
      countOccurrences(job.executable, 'test -z "${NPM_TOKEN:-}"') === 2,
    "PREPARE_CREDENTIALS",
    "version preparation can receive a write/registry token or netrc",
  );
}

function validateMinimalVersionJob(job) {
  validateCheckoutIsolation(job, { fetchDepth: 0 });
  assert(
    job.executable.includes("needs: prepare") &&
      job.steps.length === 3 &&
      job.steps.every((step) => step.run === null),
    "VERSION_AUTHORITY",
    "PR-writing job must contain only checkout, artifact download, and Changesets action",
  );
  const forbidden = /\b(?:pnpm|npm)\b|\b(?:install|build|test|typecheck|pack|mutation)\b/u;
  const customVersion = requireUse(job.steps, CHANGESETS);
  assert(
    !forbidden.test(
      customVersion.raw
        .replace("node scripts/phase-09-version.mjs apply", "")
        .replace("phase09-version-artifact", ""),
    ) &&
      customVersion.raw.includes("version: >-") &&
      customVersion.raw.includes("node scripts/phase-09-version.mjs apply") &&
      customVersion.raw.includes('"${{ runner.temp }}/phase09-version-artifact"') &&
      !/(?:^|\n)\s*publish\s*:/u.test(customVersion.raw),
    "VERSION_AUTHORITY",
    "Changesets custom version path is not the stdlib-only prepared artifact apply command",
  );
}

function validateExactPublishCommand(command) {
  assert(
    command === EXACT_PUBLISH_COMMAND &&
      !/[;&|`]\s*(?:npm|pnpm|node|changeset|gh|git)\b/u.test(command),
    "EXACT_PUBLISH",
    "final folded publish command differs from the single allowlisted invocation",
  );
}

function validateConfiguredPublishSurface(rootManifest, workflows) {
  const directoryPublish = new RegExp(
    ["\\b(?:npm|pnpm)", "\\s+", "publish\\b"].join(""),
    "u",
  );
  const changesetPublish = new RegExp(
    ["\\bchangesets?", "\\s+", "publish\\b"].join(""),
    "u",
  );
  for (const [name, command] of Object.entries(rootManifest.scripts ?? {})) {
    assert(
      !directoryPublish.test(command) && !changesetPublish.test(command),
      "CONFIGURED_PUBLISH",
      `root script ${name} configures a package-directory publisher`,
    );
  }
  const tracked = spawnSync("git", ["ls-files", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: 10_000,
  });
  assert(
    tracked.error === undefined && tracked.signal === null && tracked.status === 0,
    "CONFIGURED_PUBLISH",
    "could not enumerate configured publish surfaces",
  );
  for (const path of tracked.stdout.split("\0").filter((entry) => entry.endsWith("package.json"))) {
    const manifest = JSON.parse(readNonemptyFile(path));
    for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
      assert(
        !directoryPublish.test(command) && !changesetPublish.test(command),
        "CONFIGURED_PUBLISH",
        `${path} script ${name} configures a package-directory publisher`,
      );
    }
  }
  assert(
    rootManifest.scripts?.release === EXACT_ROOT_SCRIPTS.release,
    "CONFIGURED_PUBLISH",
    "root release must fail closed through the exact archive publisher",
  );
  for (const workflow of workflows) {
    for (const step of workflow.steps) {
      if (step.run === null) continue;
      assert(
        !directoryPublish.test(step.run) && !changesetPublish.test(step.run),
        "CONFIGURED_PUBLISH",
        `workflow contains a package-directory publish command: ${step.name ?? step.index}`,
      );
    }
  }
}

function validateRepositoryPublisherSources() {
  const directoryPublish = new RegExp(
    ["\\b(?:npm|pnpm)", "\\s+", "publish\\b"].join(""),
    "u",
  );
  const changesetPublish = new RegExp(
    ["\\bchangesets?", "\\s+", "publish\\b"].join(""),
    "u",
  );
  const tracked = spawnSync("git", ["ls-files", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: 10_000,
  });
  assert(
    tracked.error === undefined && tracked.signal === null && tracked.status === 0,
    "CONFIGURED_PUBLISH",
    "could not enumerate executable publisher sources",
  );
  const paths = tracked.stdout
    .split("\0")
    .filter(Boolean)
    .filter(
      (path) =>
        /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(path) ||
        /^scripts\/[^/]+\.(?:mjs|js|sh)$/u.test(path),
    )
    .filter(
      (path) =>
        ![
          "scripts/phase-09-publish-archives.mjs",
          "scripts/phase-09-workflow-check.mjs",
        ].includes(path),
    );
  for (const path of paths) {
    const source = executableSource(readNonemptyFile(path));
    assert(
      !directoryPublish.test(source) && !changesetPublish.test(source),
      "CONFIGURED_PUBLISH",
      `${path} contains a publisher outside the single allowlisted implementation`,
    );
  }
}

function validateOidcIsolation(job) {
  const forbiddenAction = job.steps.some((step) =>
    [CHECKOUT, SETUP_NODE, SETUP_PNPM, CHANGESETS].includes(step.uses),
  );
  const runs = job.steps.map((step) => step.run ?? "").join("\n");
  assert(
    !forbiddenAction &&
      !/\b(?:npm|pnpm)\s+(?:ci|install|pack)\b|\bpnpm\b.*\b(?:build|test|typecheck)\b/u.test(
        runs,
      ),
    "OIDC_ISOLATION",
    "OIDC publisher job can checkout, install, build, test, or pack",
  );
}

function validateExactOidcSteps(job) {
  const expected = [
    "Download the independently sealed release artifact",
    "Download the content-addressed publisher toolchain",
    "Verify and unpack the content-addressed npm CLI",
    "Resolve the exact sealed release inputs",
    "Publish the exact independently sealed archive triplet",
  ];
  assert(
    JSON.stringify(job.steps.map((step) => step.name)) === JSON.stringify(expected) &&
      !job.steps.some((step) => /\b(?:curl|wget|git|gh)\b/u.test(step.run ?? "")),
    "OIDC_STEP_SET",
    "OIDC publisher contains an unreviewed step or network/VCS command",
  );
}

function validateSealIsolation(job) {
  validateCheckoutIsolation(job, { fetchDepth: 0 });
  const executableRuns = job.steps.map((step) => step.run ?? "").join("\n");
  assert(
    job.executable.includes("needs: verify") &&
      job.executable.includes("if: ${{ needs.verify.result == 'success' }}") &&
      !/\b(?:pnpm|npm)\s+(?:ci|install|run|exec|pack|test|publish)\b|scripts\/[A-Za-z0-9_.-]+\.(?:mjs|js|sh)\b/u.test(
        executableRuns,
      ),
    "SEAL_ISOLATION",
    "independent sealer can install dependencies or execute workspace code",
  );
  const sealer = requireOneStep(
    job.steps,
    (step) => step.name === "Independently seal tracked release evidence and archive bytes",
    "independent sealer",
  );
  for (const token of [
    "git\", [\"rev-parse\", \"HEAD\"]",
    "process.env.PHASE09_COMMIT",
    "process.env.PHASE09_REPOSITORY",
    "process.env.PHASE09_RUN_ID",
    "process.env.PHASE09_RUN_ATTEMPT",
    "process.env.PHASE09_SOURCE_REF",
    "process.env.PHASE09_WORKFLOW_PATH",
    "process.env.PHASE09_INPUT_ARTIFACT",
    "09-VERSION-RECEIPT.json",
    '"merge-base", "--is-ancestor", receipt.baseSha, "HEAD"',
    "evidence.versionReceipt",
    "evidence.runAttempt !== receipt.runAttempt",
    'evidence.mode !== "versioned"',
    "evidence.releaseAuthorization !== true",
    'evidence.sharedVersion === "0.0.0"',
    "stableJson(localManifest.archives) !== stableJson(evidence.archives)",
    'hash("sha256", bytes) !== record.sha256',
    'integrity: `sha512-${hash("sha512", bytes, "base64")}`',
    "phase09-sealed-release-${runAttempt}-${sealId}",
  ]) {
    assert(
      sealer.run?.includes(token) === true,
      "SEAL_BINDING",
      `independent sealer is missing ${token}`,
    );
  }
  assert(
    sealer.raw.includes("PHASE09_REPOSITORY: ${{ github.repository }}") &&
      sealer.raw.includes("PHASE09_RUN_ID: ${{ github.run_id }}") &&
      sealer.raw.includes("PHASE09_RUN_ATTEMPT: ${{ github.run_attempt }}") &&
      sealer.raw.includes("PHASE09_COMMIT: ${{ github.sha }}") &&
      sealer.raw.includes("PHASE09_SOURCE_REF: refs/heads/main") &&
      sealer.raw.includes("PHASE09_WORKFLOW_PATH: .github/workflows/release.yml") &&
      sealer.raw.includes(
        `PHASE09_INPUT_ARTIFACT: ${ARCHIVE_ARTIFACT_NAME}`,
      ),
    "SEAL_BINDING",
    "sealer environment does not bind exact repository/run/commit/input artifact identity",
  );
}

function validateEmbeddedNodePrograms(workflow, expectedCount) {
  let count = 0;
  for (const step of workflow.steps) {
    if (step.run === null) continue;
    const pattern = /<<'NODE'\n([\s\S]*?)\n\s*NODE(?:\n|$)/gu;
    for (const match of step.run.matchAll(pattern)) {
      count += 1;
      const result = spawnSync(process.execPath, ["--input-type=module", "--check"], {
        cwd: ROOT,
        encoding: "utf8",
        input: match[1],
        maxBuffer: 1024 * 1024,
        timeout: 10_000,
      });
      assert(
        result.error === undefined && result.signal === null && result.status === 0,
        "WORKFLOW_SYNTAX",
        `embedded Node syntax failed: ${result.stderr}`,
      );
    }
  }
  assert(
    count === expectedCount,
    "WORKFLOW_SYNTAX",
    `expected ${expectedCount} embedded Node programs, found ${count}`,
  );
}

function permissionEntries(job) {
  const lines = job.source.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === "    permissions:");
  assert(start >= 0, "JOB_PERMISSIONS", `${job.name} has no permissions block`);
  const entries = {};
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].trim().length === 0) continue;
    if (leadingSpaces(lines[index]) <= 4) break;
    const match = /^      ([a-z-]+):\s*([a-z]+)\s*$/u.exec(lines[index]);
    assert(match !== null, "JOB_PERMISSIONS", `${job.name} permissions are malformed`);
    entries[match[1]] = match[2];
  }
  return entries;
}

function assertPermissions(job, expected) {
  assert(
    JSON.stringify(permissionEntries(job)) === JSON.stringify(expected),
    "JOB_PERMISSIONS",
    `${job.name} permissions drifted`,
  );
}

function validateCiAuthority(workflow) {
  assert(
    !/(?:^|\n)\s*id-token\s*:/u.test(workflow.executable) &&
      !/\b(?:npm|pnpm)\s+publish\b|\bgit\s+tag\b|--provenance\b|\bnpm\s+(?:access|dist-tag)\b/u.test(
        workflow.executable,
      ) &&
      !/(?:^|\n)\s+(?:GITHUB_TOKEN|GH_TOKEN|NODE_AUTH_TOKEN|NPM_TOKEN):|secrets\./u.test(
        workflow.executable,
      ),
    "CI_AUTHORITY",
    "CI contains OIDC, publication, tagging, provenance, or secret authority",
  );
}

function validateCandidateReceiptProgram(step) {
  assert(step.run !== null, "CANDIDATE_RECEIPT", "candidate receipt program is missing");
  for (const token of [
    'schema_version: 1',
    'workflow_path: ".github/workflows/ci.yml"',
    'head.stdout.trim() !== headSha',
    '["ls-files", "--error-unmatch", "--", ...evidencePaths]',
    'artifactName !== expectedArtifact',
    'content_digest: sha256(stableJson(body))',
    'writeFileSync(',
    '"candidate-certification.json"',
    ...CANDIDATE_EVIDENCE_PATHS.map((path) => `"${path}"`),
  ]) {
    assert(
      step.run.includes(token),
      "CANDIDATE_RECEIPT",
      `candidate receipt program is missing ${token}`,
    );
  }
  const conclusions = [...step.run.matchAll(/overall_conclusion:\s*"([^"]+)"/gu)];
  assert(
    conclusions.length === 1 && conclusions[0][1] === "success",
    "CANDIDATE_OVERALL",
    "candidate receipt must state exactly one truthful success conclusion",
  );
  assert(
    !/\b(?:npm|pnpm|gh|curl|wget)\b|\bgit\s+(?:push|tag)\b/u.test(step.run),
    "CANDIDATE_AUTHORITY",
    "candidate receipt program contains network, package, push, or tag authority",
  );
}

function validateCandidateReceiptJob(job) {
  assertPermissions(job, { contents: "read" });
  assert(
    job.executable.includes("needs: [build, node-floor]"),
    "CANDIDATE_DEPENDENCIES",
    "candidate receipt job must depend on every CI prerequisite",
  );
  requireExactUseSequence(
    job.steps,
    [CHECKOUT, UPLOAD],
    `${CI_PATH}#candidate-certification`,
  );
  const checkout = requireUse(job.steps, CHECKOUT, "candidate receipt checkout");
  assert(
    checkout.raw.includes("fetch-depth: 1") &&
      checkout.raw.includes("persist-credentials: false") &&
      checkout.raw.includes("ref: ${{ github.sha }}"),
    "CANDIDATE_CHECKOUT",
    "candidate receipt checkout is not bound read-only to github.sha",
  );
  const receipt = requireOneStep(
    job.steps,
    (step) => step.name === "Create the exact candidate certification receipt",
    "candidate receipt creation",
  );
  validateCandidateReceiptProgram(receipt);
  for (const token of [
    `CANDIDATE_ARTIFACT_NAME: ${CANDIDATE_ARTIFACT_NAME}`,
    "CANDIDATE_BUILD_CONCLUSION: ${{ needs.build.result }}",
    "CANDIDATE_NODE_FLOOR_CONCLUSION: ${{ needs['node-floor'].result }}",
    "CANDIDATE_HEAD_SHA: ${{ github.sha }}",
    "CANDIDATE_REF: ${{ github.ref }}",
    "CANDIDATE_REPOSITORY: ${{ github.repository }}",
    "CANDIDATE_RUN_ID: ${{ github.run_id }}",
    "CANDIDATE_RUN_ATTEMPT: ${{ github.run_attempt }}",
    "CANDIDATE_WORKFLOW_NAME: ${{ github.workflow }}",
  ]) {
    assert(
      receipt.raw.includes(token),
      "CANDIDATE_IDENTITY",
      `candidate receipt environment is missing ${token}`,
    );
  }
  const upload = requireUse(job.steps, UPLOAD, "candidate receipt upload");
  assert(
    upload.raw.includes(`name: ${CANDIDATE_ARTIFACT_NAME}`) &&
      upload.raw.includes(`path: ${CANDIDATE_RECEIPT_PATH}`) &&
      upload.raw.includes("if-no-files-found: error") &&
      upload.raw.includes("retention-days: 90"),
    "CANDIDATE_ARTIFACT",
    "candidate receipt upload is not exact and attempt-scoped",
  );
}

function validateCertificationScript() {
  const source = readNonemptyFile("scripts/phase-10-certify-candidate.mjs");
  for (const token of [
    '"self-test"',
    '"handoff-check"',
    '"certify"',
    '"verify-run"',
    '["push", "--porcelain", candidate.remote, `HEAD:${candidate.ref}`]',
    '"remote-equal-before"',
    '"run-trigger-or-selection"',
    '"select-explicit-run"',
    '"verify-receipt"',
    '"remote-equal-after"',
    '"--untracked-files=all"',
    'rmSync(temporaryRoot, { recursive: true })',
  ]) {
    assert(
      source.includes(token),
      "CERTIFICATION_SCRIPT",
      `certification script is missing ${token}`,
    );
  }
  assert(
    !/\b(?:npm|pnpm)\s+publish\b|\bgit\s+tag\b|--provenance\b|phase\.complete|gsd-tools|phase-09-mutation-battery/u.test(
      executableSource(source),
    ),
    "CERTIFICATION_SCRIPT",
    "certification script contains publication, tag, GSD mutation, or evidence-regeneration authority",
  );
}

function validateLiveContracts() {
  const rootManifest = JSON.parse(readNonemptyFile("package.json"));
  for (const [name, command] of Object.entries(EXACT_ROOT_SCRIPTS)) {
    assert(
      rootManifest.scripts?.[name] === command,
      "ROOT_SCRIPT",
      `${name} must equal ${command}`,
    );
  }
  const paths = [
    "packages/concierge/package.json",
    "packages/concierge-react/package.json",
    "packages/concierge-svelte/package.json",
  ];
  const manifests = paths.map((path) => JSON.parse(readNonemptyFile(path)));
  for (const [index, manifest] of manifests.entries()) {
    const path = paths[index];
    assert(
      manifest.name === PUBLIC_PACKAGES[index],
      "PACKAGE_IDENTITY",
      `${path} package identity drifted`,
    );
    assert(
      JSON.stringify(manifest.publishConfig) === JSON.stringify({ access: "public" }) &&
        JSON.stringify(manifest.repository) === JSON.stringify({
          type: "git",
          url: "git+https://github.com/fullselfbrowsing/concierge.git",
          directory: `packages/${PUBLIC_PACKAGES[index].split("/").at(-1)}`,
        }),
      "PACKAGE_PUBLISH_DESTINATION",
      `${path} must pin exact public npm and repository metadata`,
    );
    if (index > 0) {
      const expectedPeer = manifests[0].version === "0.0.0"
        ? FIRST_RELEASE_CORE_PEER
        : "workspace:^";
      assert(
        manifest.peerDependencies?.[PUBLIC_PACKAGES[0]] === expectedPeer,
        "PACKAGE_PEER",
        `${path} must keep the fail-closed ${expectedPeer} core peer`,
      );
    }
  }
  assert(
    manifests.every(
      (manifest) =>
        manifest.version === manifests[0].version &&
        /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(manifest.version),
    ),
    "VERSION_DRIFT",
    `public manifest versions differ: ${manifests.map((manifest) => manifest.version).join(", ")}`,
  );
  const config = JSON.parse(readNonemptyFile(".changeset/config.json"));
  assert(
    JSON.stringify(config.fixed) === JSON.stringify([PUBLIC_PACKAGES]) &&
      JSON.stringify(config.linked) === "[]" &&
      config.updateInternalDependencies === "patch" &&
      config.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH
        ?.onlyUpdatePeerDependentsWhenOutOfRange === true,
    "CHANGESET_CONFIG",
    "Changesets must keep the exact fixed triplet and range-aware peer handling",
  );
  const publisherPath = resolve(ROOT, "scripts/phase-09-publish-archives.mjs");
  const publisherDigest = createHash("sha256")
    .update(readFileSync(publisherPath))
    .digest("hex");
  assert(
    publisherDigest === PUBLISHER_SHA256,
    "PUBLISHER_DIGEST",
    `publisher digest drifted: ${publisherDigest}`,
  );
}

function validateCi(workflow) {
  assert(
    JSON.stringify(workflowJobNames(workflow.source, CI_PATH)) ===
      JSON.stringify(["build", "node-floor", "candidate-certification"]),
    "JOB_LAYOUT",
    "CI job set or order drifted",
  );
  requireExactUseSequence(
    workflow.steps,
    [
      CHECKOUT,
      SETUP_PNPM,
      SETUP_NODE,
      UPLOAD,
      DOWNLOAD,
      SETUP_NODE,
      CHECKOUT,
      UPLOAD,
    ],
    CI_PATH,
  );
  assert(
    /(?:^|\n)permissions:\n  contents: read(?:\n|$)/u.test(workflow.executable) &&
      /(?:^|\n)  workflow_dispatch:\s*(?:\n|$)/u.test(workflow.executable),
    "CI_PERMISSIONS",
    "CI must be globally read-only and explicitly dispatchable",
  );
  validateCiAuthority(workflow);
  const buildJob = extractJob(workflow.source, "build", CI_PATH);
  const floor = extractJob(workflow.source, "node-floor", CI_PATH);
  const candidate = extractJob(
    workflow.source,
    "candidate-certification",
    CI_PATH,
  );
  const buildCheckout = requireUse(buildJob.steps, CHECKOUT, "CI build checkout");
  assert(
    buildCheckout.raw.includes("persist-credentials: false") &&
      buildCheckout.raw.includes("ref: ${{ github.sha }}"),
    "CI_CHECKOUT",
    "CI build checkout is not bound read-only to github.sha",
  );
  const tooling = requireOneStep(
    buildJob.steps,
    (step) =>
      step.run?.includes("npm install -g npm@11.11.0") === true &&
      step.run.includes('test "$(npm --version)" = "11.11.0"'),
    "CI pinned npm assertion",
  );
  const chain = requireBuildBeforeTypecheckChain(buildJob.steps, {
    code: "CI_BUILD_BEFORE_TYPECHECK",
    label: "CI",
  });
  const artifact = requireExactRun(buildJob.steps, "pnpm run check:artifact");
  const dependencies = requireExactRun(buildJob.steps, "pnpm run check:deps");
  const pack = requireExactRun(buildJob.steps, "pnpm run check:pack");
  const floorPack = requireExactRun(
    buildJob.steps,
    'pnpm pack --pack-destination "${{ runner.temp }}"',
  );
  const upload = requireUse(buildJob.steps, UPLOAD, "CI floor tarball upload");
  requireOrder(
    [
      tooling,
      chain.install,
      chain.build,
      chain.typecheck,
      chain.test,
      artifact,
      dependencies,
      pack,
      chain.release,
      floorPack,
      upload,
    ],
    "CI gate chain",
  );
  assert(
    !/\bpnpm\b/u.test(floor.executable) &&
      floor.executable.includes("node-version: '22.12.0'") &&
      floor.executable.includes("process.version !== 'v22.12.0'") &&
      floor.executable.includes("npm init -y && npm install --no-audit --no-fund ./*.tgz") &&
      floor.executable.includes('import("@fullselfbrowsing/concierge")'),
    "CI_FLOOR",
    "the separate npm-only Node floor job drifted",
  );
  validateCandidateReceiptJob(candidate);
  validateEmbeddedNodePrograms(workflow, 1);
}

function validateRelease(workflow) {
  const prepare = extractJob(workflow.source, "prepare", RELEASE_PATH);
  const version = extractJob(workflow.source, "version", RELEASE_PATH);
  const verify = extractJob(workflow.source, "verify", RELEASE_PATH);
  const seal = extractJob(workflow.source, "seal", RELEASE_PATH);
  const publish = extractJob(workflow.source, "publish", RELEASE_PATH);
  assert(
    prepare.start < version.start && version.start < verify.start &&
      verify.start < seal.start && seal.start < publish.start,
    "JOB_LAYOUT",
    "release job order drifted",
  );
  assert(
    /(?:^|\n)permissions: \{\}(?:\n|$)/u.test(workflow.executable),
    "JOB_PERMISSIONS",
    "release must deny top-level permissions",
  );
  assertPermissions(prepare, { contents: "read" });
  assertPermissions(version, { contents: "write", "pull-requests": "write" });
  assertPermissions(verify, { contents: "read" });
  assertPermissions(seal, { contents: "read" });
  assertPermissions(publish, { "id-token": "write" });
  assert(
    countOccurrences(workflow.executable, "id-token: write") === 1,
    "JOB_PERMISSIONS",
    "OIDC permission must exist only in the publisher job",
  );

  requireExactUseSequence(
    prepare.steps,
    [CHECKOUT, SETUP_PNPM, SETUP_NODE, UPLOAD],
    `${RELEASE_PATH}#prepare`,
  );
  validateCredentialFreePreparation(prepare);
  const prepareInstall = requireExactRun(prepare.steps, "pnpm install --frozen-lockfile");
  const prepareCommand = requireExactRun(
    prepare.steps,
    EXACT_PREPARE_COMMAND,
    "exact version preparation command",
  );
  const prepareUpload = requireUse(prepare.steps, UPLOAD, "version artifact upload");
  validateExactUpload(prepareUpload, [
    "${{ runner.temp }}/phase09-version-artifact/phase-09-version-artifact.json",
    "${{ runner.temp }}/phase09-version-artifact/blobs",
  ]);
  assert(
    prepareUpload.raw.includes(`name: ${VERSION_ARTIFACT_NAME}`) &&
      prepareCommand.raw.includes("PHASE09_BASE_SHA: ${{ github.sha }}") &&
      prepareCommand.raw.includes("PHASE09_REPOSITORY: ${{ github.repository }}") &&
      prepareCommand.raw.includes("PHASE09_RUN_ID: ${{ github.run_id }}") &&
      prepareCommand.raw.includes("PHASE09_RUN_ATTEMPT: ${{ github.run_attempt }}") &&
      prepareCommand.raw.includes(
        `PHASE09_VERSION_ARTIFACT_NAME: ${VERSION_ARTIFACT_NAME}`,
      ),
    "VERSION_ARTIFACT_BINDING",
    "prepared version artifact identity or upload name drifted",
  );
  requireOrder([prepareInstall, prepareCommand, prepareUpload], "version preparation chain");

  requireExactUseSequence(
    version.steps,
    [CHECKOUT, DOWNLOAD, CHANGESETS],
    `${RELEASE_PATH}#version`,
  );
  validateMinimalVersionJob(version);
  const versionDownload = requireUse(version.steps, DOWNLOAD, "version artifact download");
  assert(
    versionDownload.raw.includes(`name: ${VERSION_ARTIFACT_NAME}`),
    "VERSION_ARTIFACT_BINDING",
    "version job can download an artifact from a different workflow attempt",
  );
  const changesets = requireUse(version.steps, CHANGESETS);
  assert(
    version.executable.includes("needs: prepare") &&
    version.executable.includes("hasChangesets: ${{ steps.changesets.outputs.hasChangesets }}") &&
      changesets.raw.includes("id: changesets") &&
      changesets.raw.includes("version: >-") &&
      changesets.raw.includes("node scripts/phase-09-version.mjs apply") &&
      changesets.raw.includes("PHASE09_BASE_SHA: ${{ github.sha }}") &&
      changesets.raw.includes("PHASE09_REPOSITORY: ${{ github.repository }}") &&
      changesets.raw.includes("PHASE09_RUN_ID: ${{ github.run_id }}") &&
      changesets.raw.includes("PHASE09_RUN_ATTEMPT: ${{ github.run_attempt }}") &&
      changesets.raw.includes(
        `PHASE09_VERSION_ARTIFACT_NAME: ${VERSION_ARTIFACT_NAME}`,
      ) &&
      !/(?:^|\n)\s*publish\s*:/u.test(changesets.raw),
    "VERSION_LIFECYCLE",
    "Changesets action is not the minimal prepared-artifact PR gate",
  );

  assert(
    verify.executable.includes("needs: version") &&
      verify.executable.includes("if: ${{ needs.version.outputs.hasChangesets == 'false' }}"),
    "VERSION_LIFECYCLE",
    "verification must run only after Changesets reports no pending changeset",
  );
  requireExactUseSequence(
    verify.steps,
    [CHECKOUT, SETUP_PNPM, SETUP_NODE, UPLOAD, UPLOAD],
    `${RELEASE_PATH}#verify`,
  );
  validateCheckoutIsolation(verify, { fetchDepth: 0 });
  const chain = requireBuildBeforeTypecheckChain(verify.steps, {
    code: "RELEASE_BUILD_BEFORE_TYPECHECK",
    label: "release verify",
  });
  const artifact = requireExactRun(verify.steps, "pnpm run check:artifact");
  const dependencies = requireExactRun(verify.steps, "pnpm run check:deps");
  const pack = requireExactRun(verify.steps, "pnpm run check:pack");
  const floor = requireExactRun(verify.steps, "pnpm run check:node-floor");
  const gate = chain.release;
  const publishEvidence = requireExactRun(
    verify.steps,
    "node scripts/phase-09-mutation-battery.mjs verify publish\n" +
      '"${{ runner.temp }}/phase09-archives"',
    "publish-specific release evidence verifier",
  );
  const resolver = requireOneStep(
    verify.steps,
    (step) => step.name === "Resolve the exact checked Phase 09 archives",
    "verified archive resolver",
  );
  const publisherSelfTest = requireExactRun(
    verify.steps,
    "node scripts/phase-09-publish-archives.mjs self-test",
  );
  const toolPreparation = requireOneStep(
    verify.steps,
    (step) => step.name === "Prepare the content-addressed publisher toolchain",
    "publisher tool preparation",
  );
  const uploads = verify.steps.filter((step) => step.uses === UPLOAD);
  assert(uploads.length === 2, "STEP_COUNT", "verify must upload exactly two artifacts");
  requireOrder(
    [
      chain.install,
      chain.build,
      chain.typecheck,
      chain.test,
      artifact,
      dependencies,
      pack,
      floor,
      gate,
      publishEvidence,
      resolver,
      publisherSelfTest,
      toolPreparation,
      ...uploads,
    ],
    "release verification and upload chain",
  );
  assert(
    gate.raw.includes("PHASE09_ARCHIVE_EXPORT_DIR: ${{ runner.temp }}/phase09-archives"),
    "ARCHIVE_EXPORT_ENV",
    "archive export directory must be local to the verified gate",
  );
  validateExactUpload(uploads[0], [
    "${{ steps.phase09-archives.outputs.core }}",
    "${{ steps.phase09-archives.outputs.react }}",
    "${{ steps.phase09-archives.outputs.svelte }}",
    "${{ steps.phase09-archives.outputs.manifest }}",
  ]);
  assert(
    uploads[0].raw.includes(`name: ${ARCHIVE_ARTIFACT_NAME}`) &&
      uploads[1].raw.includes(`name: ${PUBLISHER_ARTIFACT_NAME}`),
    "ARCHIVE_ARTIFACT_BINDING",
    "archive/tool artifact names are not bound to run ID and commit",
  );
  validateExactUpload(uploads[1], [
    "${{ steps.phase09-tools.outputs.publisher }}",
    "${{ steps.phase09-tools.outputs.npm }}",
  ]);
  validateNoArtifactRepack(verify.steps, gate);
  assert(
    toolPreparation.run?.includes("https://registry.npmjs.org/npm/-/npm-11.11.0.tgz") === true &&
      toolPreparation.run.includes(PUBLISHER_SHA256) &&
      toolPreparation.run.includes(NPM_INTEGRITY),
    "PUBLISHER_TOOLCHAIN",
    "verified tool artifact is not bound to exact publisher/npm content",
  );

  requireExactUseSequence(
    seal.steps,
    [CHECKOUT, DOWNLOAD, UPLOAD],
    `${RELEASE_PATH}#seal`,
  );
  validateSealIsolation(seal);
  const sealDownload = requireUse(seal.steps, DOWNLOAD, "untrusted archive download");
  const sealUpload = requireUse(seal.steps, UPLOAD, "sealed release upload");
  assert(
    sealDownload.raw.includes(`name: ${ARCHIVE_ARTIFACT_NAME}`) &&
      seal.executable.includes(
        "sealedArtifact: ${{ steps.phase09-seal.outputs.artifact }}",
      ) &&
      sealUpload.raw.includes("name: ${{ steps.phase09-seal.outputs.artifact }}"),
    "SEAL_BINDING",
    "sealed artifact name/output does not preserve the content-addressed identity",
  );
  validateExactUpload(sealUpload, [
    "${{ steps.phase09-seal.outputs.seal }}",
    "${{ steps.phase09-seal.outputs.core }}",
    "${{ steps.phase09-seal.outputs.react }}",
    "${{ steps.phase09-seal.outputs.svelte }}",
  ]);

  assert(
    publish.executable.includes("needs: seal") &&
      publish.executable.includes("if: ${{ needs.seal.result == 'success' }}") &&
      publish.executable.includes("timeout-minutes: 10"),
    "VERSION_LIFECYCLE",
    "publisher must depend explicitly on the independent seal with a bounded lifetime",
  );
  requireExactUseSequence(
    publish.steps,
    [DOWNLOAD, DOWNLOAD],
    `${RELEASE_PATH}#publish`,
  );
  validateOidcIsolation(publish);
  validateExactOidcSteps(publish);
  const downloadedResolver = requireOneStep(
    publish.steps,
    (step) => step.name === "Resolve the exact sealed release inputs",
    "sealed archive resolver",
  );
  const publishStep = requireOneStep(
    publish.steps,
    (step) => step.name === "Publish the exact independently sealed archive triplet",
    "exact archive publisher",
  );
  const publishDownloads = publish.steps.filter((step) => step.uses === DOWNLOAD);
  assert(
    publishDownloads[1]?.raw.includes(`name: ${PUBLISHER_ARTIFACT_NAME}`) === true,
    "ARTIFACT_ATTEMPT",
    "publisher tool download can cross workflow attempts",
  );
  requireOrder(
    [
      requireOneStep(
        publish.steps,
        (step) => step.name === "Download the independently sealed release artifact",
        "publisher sealed artifact download",
      ),
      downloadedResolver,
      publishStep,
    ],
    "download, resolve, publish",
  );
  assert(publishStep.raw.includes("run: >-"), "EXACT_PUBLISH", "final publish command must be folded");
  validateExactPublishCommand(publishStep.run);
  for (const token of [
    "PHASE09_EXPECTED_REPOSITORY: ${{ github.repository }}",
    "PHASE09_EXPECTED_RUN_ID: ${{ github.run_id }}",
    "PHASE09_EXPECTED_RUN_ATTEMPT: ${{ github.run_attempt }}",
    "PHASE09_EXPECTED_COMMIT: ${{ github.sha }}",
    "PHASE09_EXPECTED_SOURCE_REF: refs/heads/main",
    "PHASE09_EXPECTED_WORKFLOW_PATH: .github/workflows/release.yml",
    `PHASE09_EXPECTED_INPUT_ARTIFACT: ${ARCHIVE_ARTIFACT_NAME}`,
    "PHASE09_EXPECTED_SEALED_ARTIFACT: ${{ needs.seal.outputs.sealedArtifact }}",
  ]) {
    assert(publishStep.raw.includes(token), "SEAL_BINDING", `publisher is missing ${token}`);
  }
  assert(
    countOccurrences(workflow.executable, PUBLISHER_SHA256) === 2 &&
      countOccurrences(workflow.executable, NPM_INTEGRITY) === 2 &&
      publish.executable.includes("publisher Node is below 22.14.0") &&
      publish.executable.includes("PHASE09_NPM_CLI=${cli}"),
    "PUBLISHER_TOOLCHAIN",
    "OIDC publisher does not reverify the exact publisher/npm toolchain",
  );
  validateNoChangesetsPublish(workflow.executable);
  for (const forbidden of ["NODE_AUTH_TOKEN: ${{", "NPM_TOKEN: ${{", "secrets.NPM"] ) {
    assert(
      !workflow.executable.includes(forbidden),
      "TRUSTED_PUBLISHING",
      `release executable contains forbidden ${forbidden}`,
    );
  }
  validateEmbeddedNodePrograms(workflow, 5);
}

function runScriptSelfTest(path, marker) {
  const result = spawnSync(process.execPath, [resolve(ROOT, path), "self-test"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30_000,
  });
  assert(
    result.error === undefined &&
      result.signal === null &&
      result.status === 0 &&
      result.stdout.includes(marker),
    "SCRIPT_SELF_TEST",
    `${path} self-test failed: ${result.stdout}${result.stderr}`,
  );
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
  const step = (index, { uses = null, run = null, raw = "", name = null } = {}) =>
    ({ index, uses, run, raw, name });
  const candidateFixture = extractJob(
    readNonemptyFile(CI_PATH),
    "candidate-certification",
    CI_PATH,
  );
  const receiptFixture = requireOneStep(
    candidateFixture.steps,
    (candidate) => candidate.name === "Create the exact candidate certification receipt",
    "candidate receipt fixture",
  );
  let controls = 0;
  const control = (label, operation, code) => {
    expectFailure(label, operation, code);
    controls += 1;
  };
  control(
    "artifact-missing-run-attempt",
    () =>
      validateAttemptScopedArtifactName(
        "phase09-version-${{ github.run_id }}-${{ github.sha }}",
        VERSION_ARTIFACT_NAME,
      ),
    "ARTIFACT_ATTEMPT",
  );
  control(
    "unpinned-action",
    () => validatePinnedUses([step(1, { uses: "actions/checkout@v5" })], "synthetic"),
    "ACTION_PINS",
  );
  control(
    "duplicate-command",
    () => requireOneStep([step(1, { run: "gate" }), step(2, { run: "gate" })], (item) => item.run === "gate", "gate"),
    "STEP_COUNT",
  );
  control(
    "order-drift",
    () => requireOrder([step(2), step(1)], "synthetic"),
    "STEP_ORDER",
  );
  control(
    "ci-build-before-typecheck",
    () =>
      requireBuildBeforeTypecheckChain(
        [
          step(1, { run: "pnpm install --frozen-lockfile" }),
          step(2, { run: "pnpm typecheck" }),
          step(3, { run: "pnpm build" }),
          step(4, { run: "pnpm test" }),
          step(5, { run: "pnpm run check:phase09:release" }),
        ],
        { code: "CI_BUILD_BEFORE_TYPECHECK", label: "CI" },
      ),
    "CI_BUILD_BEFORE_TYPECHECK",
  );
  control(
    "release-build-before-typecheck",
    () =>
      requireBuildBeforeTypecheckChain(
        [
          step(11, { run: "pnpm install --frozen-lockfile" }),
          step(12, { run: "pnpm typecheck" }),
          step(13, { run: "pnpm build" }),
          step(14, { run: "pnpm test" }),
          step(15, { run: "pnpm run check:phase09:release" }),
        ],
        {
          code: "RELEASE_BUILD_BEFORE_TYPECHECK",
          label: "release verify",
        },
      ),
    "RELEASE_BUILD_BEFORE_TYPECHECK",
  );
  control(
    "candidate-overall-omitted",
    () =>
      validateCandidateReceiptProgram({
        ...receiptFixture,
        run: receiptFixture.run.replace('overall_conclusion: "success",', ""),
      }),
    "CANDIDATE_OVERALL",
  );
  control(
    "candidate-overall-misreported",
    () =>
      validateCandidateReceiptProgram({
        ...receiptFixture,
        run: receiptFixture.run.replace(
          'overall_conclusion: "success"',
          'overall_conclusion: "failure"',
        ),
      }),
    "CANDIDATE_OVERALL",
  );
  control(
    "ci-oidc-broadened",
    () => validateCiAuthority({ executable: "permissions:\n  id-token: write" }),
    "CI_AUTHORITY",
  );
  control(
    "ci-publication-command",
    () => validateCiAuthority({ executable: "run: npm publish ./package" }),
    "CI_AUTHORITY",
  );
  control(
    "ignored-failure",
    () => validateBlocking({ executable: "steps:", steps: [step(1, { run: "gate || true" })] }, "synthetic"),
    "IGNORED_FAILURE",
  );
  control(
    "broad-upload",
    () => validateExactUpload(step(1, { raw: "path: |\n  /tmp/*.tgz" }), ["/tmp/core.tgz"]),
    "UPLOAD_PATHS",
  );
  control(
    "post-gate-repack",
    () => validateNoArtifactRepack([step(1), step(2, { run: "pnpm pack" })], step(1)),
    "REPACK_AFTER_VERIFY",
  );
  control(
    "changesets-publish",
    () => validateNoChangesetsPublish("with:\n  publish: pnpm changeset publish"),
    "CHANGESETS_PUBLISH",
  );
  control(
    "release-publish-checkout",
    () => validateOidcIsolation({ steps: [step(1, { uses: CHECKOUT })] }),
    "OIDC_ISOLATION",
  );
  control(
    "oidc-install",
    () => validateOidcIsolation({ steps: [step(1, { run: "npm install" })] }),
    "OIDC_ISOLATION",
  );
  control(
    "oidc-extra-step",
    () => validateExactOidcSteps({ steps: [step(1, { name: "unreviewed" })] }),
    "OIDC_STEP_SET",
  );
  control(
    "appended-publish-command",
    () => validateExactPublishCommand(`${EXACT_PUBLISH_COMMAND}\n&& npm publish /tmp/unchecked-package`),
    "EXACT_PUBLISH",
  );
  control(
    "prepare-token-leak",
    () =>
      validateCredentialFreePreparation({
        name: "prepare",
        executable: "env:\n  GITHUB_TOKEN: synthetic",
        steps: [
          step(1, {
            uses: CHECKOUT,
            raw: "fetch-depth: 0\npersist-credentials: false\nref: ${{ github.sha }}",
          }),
        ],
      }),
    "PREPARE_CREDENTIALS",
  );
  control(
    "version-extra-command",
    () =>
      validateMinimalVersionJob({
        name: "version",
        executable: "needs: prepare",
        steps: [
          step(1, {
            uses: CHECKOUT,
            raw: "fetch-depth: 0\npersist-credentials: false\nref: ${{ github.sha }}",
          }),
          step(2, { uses: DOWNLOAD }),
          step(3, { uses: CHANGESETS, raw: "version: node scripts/phase-09-version.mjs apply" }),
          step(4, { run: "pnpm test" }),
        ],
      }),
    "VERSION_AUTHORITY",
  );
  control(
    "sealer-workspace-code",
    () =>
      validateSealIsolation({
        name: "seal",
        executable: "needs: verify\nif: ${{ needs.verify.result == 'success' }}",
        steps: [
          step(1, {
            uses: CHECKOUT,
            raw: "fetch-depth: 0\npersist-credentials: false\nref: ${{ github.sha }}",
          }),
          step(2, { run: "pnpm test" }),
        ],
      }),
    "SEAL_ISOLATION",
  );
  control(
    "configured-directory-publisher",
    () =>
      validateConfiguredPublishSurface(
        { scripts: { release: ["npm", " publish", " ./packages/core"].join("") } },
        [],
      ),
    "CONFIGURED_PUBLISH",
  );
  assert(controls === 22, "CHECKER_SELF_TEST", `expected 22 controls, ran ${controls}`);
  return controls;
}

if (process.argv.length !== 2) {
  fail("CLI_MODE", "phase-09-workflow-check accepts no arguments");
}

const controls = runDetectorControls();
validateLiveContracts();
const ci = readWorkflow(CI_PATH);
const release = readWorkflow(RELEASE_PATH);
validateConfiguredPublishSurface(
  JSON.parse(readNonemptyFile("package.json")),
  [ci, release],
);
validateRepositoryPublisherSources();
validateCertificationScript();
validateCi(ci);
validateRelease(release);
runScriptSelfTest(
  "scripts/phase-09-version.mjs",
  "PHASE09_VERSION_SELF_TEST_OK controls=24",
);
runScriptSelfTest(
  "scripts/phase-09-publish-archives.mjs",
  "PHASE09_PUBLISHER_SELF_TEST_OK controls=20",
);
runScriptSelfTest(
  "scripts/phase-10-certify-candidate.mjs",
  "PHASE10_CERTIFY_SELF_TEST_OK controls=29",
);

process.stdout.write(
  `PHASE09_WORKFLOW_CHECK_OK workflows=2 jobs=8 controls=${controls} ` +
    `ciSteps=${ci.steps.length} releaseSteps=${release.steps.length}\n`,
);
