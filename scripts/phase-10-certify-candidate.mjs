#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const PHASE_DIRECTORY =
  ".planning/phases/10-close-v0-1-release-certification-and-evidence-gaps";
const WORKFLOW_NAME = "ci";
const WORKFLOW_PATH = ".github/workflows/ci.yml";
const RECEIPT_CONTEXT_BINDING =
  "github.sha + github.run_id + github.run_attempt";
const REQUIRED_RECEIPT_JOBS = Object.freeze(["build", "node-floor"]);
const REQUIRED_RUN_JOBS = Object.freeze([
  ...REQUIRED_RECEIPT_JOBS,
  "candidate-certification",
]);
const EVIDENCE_PATHS = Object.freeze([
  `${PHASE_DIRECTORY}/10-VERIFICATION.md`,
  ".planning/v0.1-MILESTONE-AUDIT.md",
  `${PHASE_DIRECTORY}/10-VALIDATION.md`,
  `${PHASE_DIRECTORY}/10-CERTIFICATION.md`,
]);

function fail(code, message) {
  throw new Error(`[${code}] ${message}`);
}

function assert(condition, code, message) {
  if (!condition) fail(code, message);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
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

function exactKeys(value, expected, code, label) {
  assert(
    value !== null && typeof value === "object" && !Array.isArray(value),
    code,
    `${label} must be an object`,
  );
  assert(
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...expected].sort()),
    code,
    `${label} keys drifted`,
  );
}

function validateDigestMap(actual, expected, code, label) {
  exactKeys(actual, Object.keys(expected), code, label);
  for (const [path, digest] of Object.entries(expected)) {
    assert(
      /^[0-9a-f]{64}$/u.test(actual[path] ?? "") && actual[path] === digest,
      code,
      `${label} differs for ${path}`,
    );
  }
}

function validateReceipt(receipt, expected) {
  exactKeys(
    receipt,
    [
      "artifact_name",
      "content_digest",
      "evidence_digests",
      "head_sha",
      "job_conclusions",
      "overall_conclusion",
      "ref",
      "repository",
      "run_attempt",
      "run_id",
      "schema_version",
      "workflow_name",
      "workflow_path",
    ],
    "RECEIPT_SCHEMA",
    "candidate receipt",
  );
  assert(
    receipt.schema_version === 1,
    "RECEIPT_SCHEMA",
    "candidate receipt schema version drifted",
  );
  assert(
    receipt.repository === expected.repository,
    "RECEIPT_REPOSITORY",
    "candidate receipt repository differs",
  );
  assert(
    receipt.workflow_name === WORKFLOW_NAME &&
      receipt.workflow_name === (expected.workflowName ?? WORKFLOW_NAME),
    "RECEIPT_WORKFLOW",
    "candidate receipt workflow name differs",
  );
  assert(
    receipt.workflow_path === WORKFLOW_PATH &&
      receipt.workflow_path === (expected.workflowPath ?? WORKFLOW_PATH),
    "RECEIPT_WORKFLOW",
    "candidate receipt workflow path differs",
  );
  assert(
    receipt.ref === expected.ref,
    "RECEIPT_REF",
    "candidate receipt ref differs",
  );
  assert(
    /^[0-9a-f]{40}$/u.test(receipt.head_sha) &&
      receipt.head_sha === expected.headSha,
    "RECEIPT_SHA",
    "candidate receipt head SHA differs",
  );
  assert(
    /^[1-9]\d*$/u.test(receipt.run_id) && receipt.run_id === expected.runId,
    "RECEIPT_RUN_ID",
    "candidate receipt run ID differs",
  );
  assert(
    Number.isSafeInteger(receipt.run_attempt) &&
      receipt.run_attempt > 0 &&
      receipt.run_attempt === expected.runAttempt,
    "RECEIPT_ATTEMPT",
    "candidate receipt run attempt differs",
  );
  assert(
    receipt.artifact_name === expected.artifactName,
    "RECEIPT_ARTIFACT",
    `candidate receipt artifact name differs from ${RECEIPT_CONTEXT_BINDING}`,
  );
  assert(
    receipt.overall_conclusion === "success",
    "RECEIPT_OVERALL",
    "candidate receipt overall conclusion is not success",
  );
  exactKeys(
    receipt.job_conclusions,
    REQUIRED_RECEIPT_JOBS,
    "RECEIPT_JOBS",
    "candidate receipt job conclusions",
  );
  for (const name of REQUIRED_RECEIPT_JOBS) {
    assert(
      receipt.job_conclusions[name] === "success",
      "RECEIPT_JOBS",
      `candidate receipt job ${name} is not successful`,
    );
  }
  validateDigestMap(
    receipt.evidence_digests,
    expected.evidenceDigests,
    "RECEIPT_EVIDENCE",
    "candidate receipt evidence",
  );
  const { content_digest: contentDigest, ...body } = receipt;
  assert(
    /^[0-9a-f]{64}$/u.test(contentDigest) &&
      sha256(stableJson(body)) === contentDigest,
    "RECEIPT_DIGEST",
    "candidate receipt content digest differs",
  );
  return Object.freeze(receipt);
}

function validateRunMetadata(run, jobResponse, expected) {
  assert(
    run !== null && typeof run === "object" && !Array.isArray(run),
    "RUN_SCHEMA",
    "workflow run metadata is malformed",
  );
  assert(
    run.repository?.full_name === expected.repository,
    "RUN_REPOSITORY",
    "workflow run repository differs",
  );
  assert(
    run.name === WORKFLOW_NAME && run.path === WORKFLOW_PATH,
    "RUN_WORKFLOW",
    "workflow run identity differs",
  );
  assert(
    `refs/heads/${run.head_branch}` === expected.ref,
    "RUN_REF",
    "workflow run ref differs",
  );
  assert(
    run.head_sha === expected.headSha,
    "RUN_SHA",
    "workflow run head SHA differs",
  );
  assert(
    String(run.id) === expected.runId,
    "RUN_ID",
    "workflow run ID differs",
  );
  assert(
    run.run_attempt === expected.runAttempt,
    "RUN_ATTEMPT",
    "workflow run attempt differs",
  );
  assert(
    run.status === "completed" && run.conclusion === "success",
    "RUN_OVERALL",
    "workflow run did not complete successfully",
  );
  assert(
    typeof run.html_url === "string" &&
      /^https:\/\/github\.com\//u.test(run.html_url),
    "RUN_URL",
    "workflow run URL is malformed",
  );
  assert(
    Array.isArray(jobResponse?.jobs),
    "RUN_JOBS",
    "workflow run jobs are malformed",
  );
  const jobs = new Map();
  for (const job of jobResponse.jobs) {
    assert(
      typeof job?.name === "string" && !jobs.has(job.name),
      "RUN_JOBS",
      "workflow run jobs are unnamed or duplicated",
    );
    jobs.set(job.name, job);
  }
  assert(
    JSON.stringify([...jobs.keys()].sort()) ===
      JSON.stringify([...REQUIRED_RUN_JOBS].sort()),
    "RUN_JOBS",
    "workflow run job set differs",
  );
  for (const name of REQUIRED_RUN_JOBS) {
    const job = jobs.get(name);
    assert(
      job.status === "completed" && job.conclusion === "success",
      "RUN_JOBS",
      `workflow run job ${name} did not complete successfully`,
    );
  }
  return Object.freeze({
    jobConclusions: Object.freeze(
      Object.fromEntries(
        REQUIRED_RUN_JOBS.map((name) => [name, jobs.get(name).conclusion]),
      ),
    ),
    overallConclusion: run.conclusion,
    url: run.html_url,
  });
}

function frontmatter(source, code, label) {
  assert(
    typeof source === "string" && source.startsWith("---\n"),
    code,
    `${label} has no frontmatter`,
  );
  const end = source.indexOf("\n---\n", 4);
  assert(end > 4, code, `${label} frontmatter is unterminated`);
  return source.slice(4, end);
}

function uniqueExternalGapIds(source) {
  return [...new Set(source.match(/\bEXT-[A-Z0-9-]+\b/gu) ?? [])].sort();
}

function parseVerification(source) {
  const header = frontmatter(source, "HANDOFF_VERIFICATION", "Phase 10 verification");
  assert(
    /^status:\s*gaps_found\s*$/mu.test(header),
    "HANDOFF_VERIFICATION",
    "Phase 10 verification must use supported gaps_found status",
  );
  assert(
    JSON.stringify(uniqueExternalGapIds(source)) ===
      JSON.stringify(["EXT-HOSTED-10"]),
    "HANDOFF_VERIFICATION",
    "Phase 10 verification must contain only EXT-HOSTED-10",
  );
  return Object.freeze({ gap: "EXT-HOSTED-10", status: "gaps_found" });
}

function parseScore(header, name, expected) {
  const match = new RegExp(`^  ${name}:\\s*(\\d+)/(\\d+)\\s*$`, "mu").exec(header);
  assert(
    match !== null && `${match[1]}/${match[2]}` === expected,
    "HANDOFF_AUDIT",
    `milestone audit ${name} score must be ${expected}`,
  );
  return expected;
}

function parseMilestoneAudit(source) {
  const header = frontmatter(source, "HANDOFF_AUDIT", "milestone audit");
  assert(
    /^status:\s*gaps_found\s*$/mu.test(header),
    "HANDOFF_AUDIT",
    "milestone audit must use supported gaps_found status",
  );
  const scores = Object.freeze({
    requirements: parseScore(header, "requirements", "62/62"),
    phases: parseScore(header, "phases", "9/9"),
    integration: parseScore(header, "integration", "12/12"),
    flows: parseScore(header, "flows", "10/10"),
  });
  const compliant = /^  compliant_phases:\s*\[([^\n]*)\]\s*$/mu.exec(header)?.[1] ?? "";
  const phases = [...compliant.matchAll(/"(\d{2})"/gu)].map((match) => match[1]);
  assert(
    phases.includes("09") &&
      /^  partial_phases:\s*\[\]\s*$/mu.test(header) &&
      /^  missing_phases:\s*\[\]\s*$/mu.test(header) &&
      /^  overall:\s*compliant\s*$/mu.test(header),
    "HANDOFF_AUDIT",
    "milestone audit must report Phase 9 Nyquist compliance",
  );
  const directoryPatterns = [
    /\|\s*Current (?:phase )?director(?:y|ies)\s*\|\s*\*\*10\/10\*\*\s*\|/iu,
    /current (?:phase )?director(?:y|ies)[^\n]{0,80}\b10\/10\b/iu,
    /\b10\/10\b[^\n]{0,80}current (?:phase )?director(?:y|ies)/iu,
  ];
  assert(
    directoryPatterns.some((pattern) => pattern.test(source)),
    "HANDOFF_AUDIT",
    "milestone audit lacks a separate 10/10 current-directory inventory",
  );
  assert(
    JSON.stringify(uniqueExternalGapIds(source)) ===
      JSON.stringify(["EXT-HOSTED-10"]),
    "HANDOFF_AUDIT",
    "milestone audit must contain only EXT-HOSTED-10",
  );
  return Object.freeze({
    currentDirectories: "10/10",
    nyquistPhase09: true,
    scores,
    status: "gaps_found",
  });
}

function validatePlanningHandoff(roadmap, state) {
  assert(
    roadmap.includes(
      "**Certification status:** Awaiting exact-SHA hosted certification.",
    ),
    "HANDOFF_STATUS",
    "ROADMAP does not contain the exact awaiting-certification status",
  );
  const phaseRow = roadmap
    .split(/\r?\n/u)
    .find((line) => /^\| 10\./u.test(line));
  assert(
    phaseRow === undefined || !/\|\s*Complete\s*\|/u.test(phaseRow),
    "HANDOFF_STATUS",
    "ROADMAP marks the Phase 10 goal complete before hosted certification",
  );
  assert(
    /^status:\s*executing\s*$/mu.test(state) &&
      /^stopped_at:\s*["']?Awaiting exact-SHA hosted certification["']?\s*$/mu.test(
        state,
      ),
    "HANDOFF_STATUS",
    "STATE must remain executing at the exact hosted-certification marker",
  );
  return true;
}

function validateCertificationOrder(events) {
  const expected = [
    "handoff-check",
    "snapshot",
    "push",
    "remote-fetch-before",
    "remote-equal-before",
    "run-trigger-or-selection",
    "select-explicit-run",
    "wait",
    "verify-receipt",
    "remote-fetch-after",
    "remote-equal-after",
    "unchanged",
  ];
  assert(
    JSON.stringify(events) === JSON.stringify(expected),
    "CERTIFICATION_ORDER",
    `certification order drifted: ${events.join(" -> ")}`,
  );
  return true;
}

function assertOwnedWritePath(root, path) {
  assert(
    isAbsolute(root) &&
      isAbsolute(path) &&
      relative(root, path) !== ".." &&
      !relative(root, path).startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
      relative(root, path) !== "",
    "OWNED_WRITE",
    `write path escapes the owned temporary root: ${path}`,
  );
}

function runCommand(command, arguments_, label, { timeout = 60_000 } = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout,
  });
  assert(
    result.error === undefined,
    "COMMAND",
    `${label} could not start: ${result.error?.message ?? "unknown error"}`,
  );
  assert(
    result.signal === null,
    "COMMAND",
    `${label} ended by signal ${result.signal}`,
  );
  assert(
    result.status === 0,
    "COMMAND",
    `${label} exited ${result.status}: ${(result.stderr || result.stdout).trim().slice(0, 4_000)}`,
  );
  return result.stdout;
}

function runGit(arguments_, label = `git ${arguments_.join(" ")}`) {
  return runCommand("git", arguments_, label);
}

function runGh(arguments_, label = `gh ${arguments_[0] ?? "command"}`, options) {
  return runCommand("gh", arguments_, label, options);
}

function ghJson(arguments_, label) {
  const output = runGh(arguments_, label);
  try {
    return JSON.parse(output);
  } catch (error) {
    fail(
      "GH_JSON",
      `${label} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function readNonemptyTrackedFile(path) {
  runGit(["ls-files", "--error-unmatch", "--", path], `track ${path}`);
  const absolute = resolve(ROOT, path);
  let metadata;
  let bytes;
  try {
    metadata = lstatSync(absolute);
    bytes = readFileSync(absolute);
  } catch (error) {
    fail(
      "HANDOFF_FILE",
      `${path} is missing or unreadable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  assert(
    metadata.isFile() && bytes.length > 0,
    "HANDOFF_FILE",
    `${path} must be a nonempty tracked file`,
  );
  return bytes;
}

function evidenceDigests() {
  return Object.freeze(
    Object.fromEntries(
      EVIDENCE_PATHS.map((path) => [path, sha256(readNonemptyTrackedFile(path))]),
    ),
  );
}

function handoffCheck() {
  const directory = resolve(ROOT, PHASE_DIRECTORY);
  const entries = readdirSync(directory);
  const plans = entries.filter((name) => /^10-\d{2}-PLAN\.md$/u.test(name)).sort();
  const summaries = entries
    .filter((name) => /^10-\d{2}-SUMMARY\.md$/u.test(name))
    .sort();
  const expectedPlans = Array.from(
    { length: 7 },
    (_unused, index) => `10-${String(index + 1).padStart(2, "0")}-PLAN.md`,
  );
  const expectedSummaries = expectedPlans.map((name) =>
    name.replace("-PLAN.md", "-SUMMARY.md"),
  );
  assert(
    JSON.stringify(plans) === JSON.stringify(expectedPlans) &&
      JSON.stringify(summaries) === JSON.stringify(expectedSummaries),
    "HANDOFF_PLANS",
    `handoff requires seven PLANs and seven SUMMARYs; plans=${plans.length} summaries=${summaries.length}`,
  );
  for (const name of [...expectedPlans, ...expectedSummaries]) {
    readNonemptyTrackedFile(`${PHASE_DIRECTORY}/${name}`);
  }
  const verification = readNonemptyTrackedFile(
    `${PHASE_DIRECTORY}/10-VERIFICATION.md`,
  ).toString("utf8");
  const audit = readNonemptyTrackedFile(
    ".planning/v0.1-MILESTONE-AUDIT.md",
  ).toString("utf8");
  const roadmap = readNonemptyTrackedFile(".planning/ROADMAP.md").toString("utf8");
  const state = readNonemptyTrackedFile(".planning/STATE.md").toString("utf8");
  const verificationResult = parseVerification(verification);
  const auditResult = parseMilestoneAudit(audit);
  validatePlanningHandoff(roadmap, state);
  return Object.freeze({
    audit: auditResult,
    evidenceDigests: evidenceDigests(),
    plans: plans.length,
    summaries: summaries.length,
    verification: verificationResult,
  });
}

function resolveRepository() {
  const result = ghJson(
    ["repo", "view", "--json", "nameWithOwner"],
    "resolve GitHub repository",
  );
  assert(
    typeof result.nameWithOwner === "string" &&
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(result.nameWithOwner),
    "REPOSITORY",
    "GitHub repository identity is malformed",
  );
  return result.nameWithOwner;
}

function repositoryFromRemoteUrl(url) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?$/u.exec(
    url,
  );
  assert(
    match !== null,
    "LOCAL_REMOTE",
    "configured branch remote is not an exact GitHub repository URL",
  );
  return match[1];
}

function localSnapshot({ requireClean = true } = {}) {
  const headSha = runGit(["rev-parse", "HEAD"], "resolve local HEAD").trim();
  const branch = runGit(
    ["branch", "--show-current"],
    "resolve current branch",
  ).trim();
  const status = runGit(
    ["status", "--porcelain=v1", "--untracked-files=all"],
    "resolve full repository status",
  );
  assert(/^[0-9a-f]{40}$/u.test(headSha), "LOCAL_SHA", "local HEAD is malformed");
  assert(branch.length > 0, "LOCAL_BRANCH", "certification requires a branch checkout");
  runGit(["check-ref-format", "--branch", branch], "validate current branch");
  if (requireClean) {
    assert(status === "", "LOCAL_STATUS", "certification requires an entirely clean worktree");
  }
  const remote = runGit(
    ["config", "--get", `branch.${branch}.remote`],
    "resolve configured branch remote",
  ).trim();
  assert(
    remote.length > 0 && remote !== ".",
    "LOCAL_REMOTE",
    "current branch has no configured remote",
  );
  const remoteUrl = runGit(
    ["remote", "get-url", "--push", remote],
    "resolve configured push URL",
  ).trim();
  const repository = resolveRepository();
  assert(
    repositoryFromRemoteUrl(remoteUrl).toLowerCase() === repository.toLowerCase(),
    "LOCAL_REMOTE",
    "configured push remote differs from the GitHub repository identity",
  );
  return Object.freeze({
    branch,
    headSha,
    ref: `refs/heads/${branch}`,
    remote,
    repository,
    status,
  });
}

function fetchRemoteHead(candidate, label) {
  runGit(
    ["fetch", "--quiet", "--no-tags", candidate.remote, candidate.ref],
    label,
  );
  return runGit(["rev-parse", "FETCH_HEAD"], `${label} resolve SHA`).trim();
}

function assertRemoteEquality(candidate, label) {
  const remoteSha = fetchRemoteHead(candidate, label);
  assert(
    remoteSha === candidate.headSha,
    "REMOTE_SHA",
    `remote SHA ${remoteSha} differs from local HEAD ${candidate.headSha}`,
  );
  return remoteSha;
}

function assertLocalUnchanged(candidate) {
  const headSha = runGit(["rev-parse", "HEAD"], "reassert local HEAD").trim();
  const branch = runGit(
    ["branch", "--show-current"],
    "reassert current branch",
  ).trim();
  const status = runGit(
    ["status", "--porcelain=v1", "--untracked-files=all"],
    "reassert full repository status",
  );
  assert(
    headSha === candidate.headSha && branch === candidate.branch && status === "",
    "LOCAL_CHANGED",
    "candidate HEAD, branch, or full status changed during certification",
  );
}

function artifactName(headSha, runId, runAttempt) {
  return `v0.1-candidate-certification-${headSha}-${runId}-${runAttempt}`;
}

function listCandidateRuns(candidate) {
  const runs = ghJson(
    [
      "run",
      "list",
      "--repo",
      candidate.repository,
      "--workflow",
      "ci.yml",
      "--commit",
      candidate.headSha,
      "--limit",
      "100",
      "--json",
      "databaseId,headSha,status,conclusion,attempt,url,headBranch,workflowName,event",
    ],
    "list exact-SHA CI runs",
  );
  assert(Array.isArray(runs), "RUN_LIST", "workflow run list is malformed");
  return runs.filter(
    (run) =>
      run.headSha === candidate.headSha &&
      run.headBranch === candidate.branch &&
      run.workflowName === WORKFLOW_NAME &&
      ["push", "workflow_dispatch"].includes(run.event),
  );
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function normalizeSelectedRun(selected) {
  assert(
    Number.isSafeInteger(selected.databaseId) &&
      selected.databaseId > 0 &&
      Number.isSafeInteger(selected.attempt) &&
      selected.attempt > 0,
    "RUN_SELECTION",
    "selected exact-SHA workflow run identity is malformed",
  );
  return Object.freeze({
    runAttempt: selected.attempt,
    runId: String(selected.databaseId),
  });
}

async function selectOrDispatchRun(candidate) {
  let observed = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    observed = listCandidateRuns(candidate);
    const selectable = observed.filter(
      (run) => run.status !== "completed" || run.conclusion === "success",
    );
    assert(
      selectable.length <= 1,
      "RUN_AMBIGUOUS",
      `found ${selectable.length} selectable exact-SHA candidate runs`,
    );
    if (selectable.length === 1) return normalizeSelectedRun(selectable[0]);
    await delay(3_000);
  }

  const failed = observed.filter(
    (run) => run.status === "completed" && run.conclusion !== "success",
  );
  assert(
    failed.length <= 1,
    "RUN_AMBIGUOUS",
    `found ${failed.length} failed exact-SHA candidate runs`,
  );
  if (failed.length === 1) {
    const previousAttempt = failed[0].attempt;
    runGh(
      [
        "run",
        "rerun",
        String(failed[0].databaseId),
        "--repo",
        candidate.repository,
      ],
      "rerun every job for exact-SHA CI",
    );
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const rerun = listCandidateRuns(candidate).filter(
        (run) =>
          run.databaseId === failed[0].databaseId &&
          run.attempt > previousAttempt,
      );
      assert(
        rerun.length <= 1,
        "RUN_AMBIGUOUS",
        `rerun exposed ${rerun.length} candidate attempts`,
      );
      if (rerun.length === 1) return normalizeSelectedRun(rerun[0]);
      await delay(3_000);
    }
    fail("RUN_SELECTION", "rerun exact-SHA workflow attempt did not appear");
  }

  const before = new Set(observed.map((run) => String(run.databaseId)));
  runGh(
    [
      "workflow",
      "run",
      "ci.yml",
      "--repo",
      candidate.repository,
      "--ref",
      candidate.branch,
    ],
    "dispatch exact-SHA CI workflow",
  );
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const matches = listCandidateRuns(candidate).filter(
      (run) =>
        run.event === "workflow_dispatch" &&
        !before.has(String(run.databaseId)),
    );
    assert(
      matches.length <= 1,
      "RUN_AMBIGUOUS",
      `dispatch created ${matches.length} candidate runs`,
    );
    if (matches.length === 1) {
      return normalizeSelectedRun(matches[0]);
    }
    await delay(3_000);
  }
  fail("RUN_SELECTION", "dispatched exact-SHA workflow run did not appear");
}

function fetchRunAndJobs(repository, runId, runAttempt) {
  const run = ghJson(
    [
      "api",
      `repos/${repository}/actions/runs/${runId}/attempts/${runAttempt}`,
    ],
    "fetch explicit workflow run attempt",
  );
  const jobs = ghJson(
    [
      "api",
      `repos/${repository}/actions/runs/${runId}/attempts/${runAttempt}/jobs?per_page=100`,
    ],
    "fetch explicit workflow attempt jobs",
  );
  return Object.freeze({ jobs, run });
}

function findReceiptArtifact(repository, runId, expectedName) {
  const response = ghJson(
    [
      "api",
      `repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`,
    ],
    "list explicit workflow run artifacts",
  );
  assert(Array.isArray(response?.artifacts), "ARTIFACT_LIST", "artifact list is malformed");
  const matches = response.artifacts.filter(
    (artifact) => artifact.name === expectedName && artifact.expired === false,
  );
  assert(
    matches.length === 1 &&
      Number.isSafeInteger(matches[0].id) &&
      matches[0].id > 0 &&
      Number.isSafeInteger(matches[0].size_in_bytes) &&
      matches[0].size_in_bytes > 0,
    "ARTIFACT_AMBIGUOUS",
    `expected one live receipt artifact ${expectedName}; found ${matches.length}`,
  );
  return matches[0];
}

function isOwnedNonemptyRegularFile(root, path) {
  const metadata = lstatSync(path);
  return (
    metadata.isFile() &&
    metadata.size > 0 &&
    dirname(realpathSync(path)) === realpathSync(root)
  );
}

function downloadAndValidateReceipt(candidate, expected) {
  findReceiptArtifact(candidate.repository, expected.runId, expected.artifactName);
  const temporaryRoot = mkdtempSync(
    join(tmpdir(), "concierge-phase10-candidate-receipt-"),
  );
  try {
    assertOwnedWritePath(temporaryRoot, join(temporaryRoot, "candidate-certification.json"));
    runGh(
      [
        "run",
        "download",
        expected.runId,
        "--repo",
        candidate.repository,
        "--name",
        expected.artifactName,
        "--dir",
        temporaryRoot,
      ],
      "download exact candidate receipt",
    );
    const entries = readdirSync(temporaryRoot).sort();
    assert(
      JSON.stringify(entries) === JSON.stringify(["candidate-certification.json"]),
      "RECEIPT_FILES",
      `receipt artifact file set differs: ${entries.join(", ")}`,
    );
    const path = join(temporaryRoot, entries[0]);
    assert(
      isOwnedNonemptyRegularFile(temporaryRoot, path),
      "RECEIPT_FILES",
      "downloaded receipt is not one owned nonempty regular file",
    );
    const bytes = readFileSync(path);
    let receipt;
    try {
      receipt = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      fail(
        "RECEIPT_JSON",
        `candidate receipt is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    validateReceipt(receipt, expected);
    return Object.freeze({ receipt, receiptSha256: sha256(bytes) });
  } finally {
    rmSync(temporaryRoot, { recursive: true });
  }
}

function verifyHostedRun(candidate, runId, runAttempt) {
  assert(/^[1-9]\d*$/u.test(runId), "RUN_ID", "explicit run ID is malformed");
  assert(
    Number.isSafeInteger(runAttempt) && runAttempt > 0,
    "RUN_ATTEMPT",
    "explicit run attempt is malformed",
  );
  const expected = Object.freeze({
    artifactName: artifactName(candidate.headSha, runId, runAttempt),
    evidenceDigests: evidenceDigests(),
    headSha: candidate.headSha,
    ref: candidate.ref,
    repository: candidate.repository,
    runAttempt,
    runId,
    workflowName: WORKFLOW_NAME,
    workflowPath: WORKFLOW_PATH,
  });
  const { jobs, run } = fetchRunAndJobs(candidate.repository, runId, runAttempt);
  const runResult = validateRunMetadata(run, jobs, expected);
  const receiptResult = downloadAndValidateReceipt(candidate, expected);
  assert(
    receiptResult.receipt.overall_conclusion === runResult.overallConclusion &&
      REQUIRED_RECEIPT_JOBS.every(
        (name) =>
          receiptResult.receipt.job_conclusions[name] ===
          runResult.jobConclusions[name],
      ),
    "RECEIPT_RUN_MISMATCH",
    "candidate receipt conclusions differ from the selected run attempt",
  );
  return Object.freeze({
    artifactName: expected.artifactName,
    candidateSha: candidate.headSha,
    jobConclusions: runResult.jobConclusions,
    overallConclusion: runResult.overallConclusion,
    receiptDigest: receiptResult.receiptSha256,
    runAttempt,
    runId,
    url: runResult.url,
  });
}

function printHostedResult(marker, result) {
  process.stdout.write(`${marker} ${JSON.stringify(result)}\n`);
}

async function certifyCandidate() {
  const events = ["handoff-check"];
  handoffCheck();
  const candidate = localSnapshot();
  events.push("snapshot");
  runGit(
    ["push", "--porcelain", candidate.remote, `HEAD:${candidate.ref}`],
    "push exact candidate branch",
  );
  events.push("push");
  assertRemoteEquality(candidate, "refetch pushed candidate branch");
  events.push("remote-fetch-before", "remote-equal-before");
  events.push("run-trigger-or-selection");
  const selected = await selectOrDispatchRun(candidate);
  events.push("select-explicit-run");
  runGh(
    [
      "run",
      "watch",
      selected.runId,
      "--repo",
      candidate.repository,
      "--exit-status",
      "--interval",
      "5",
    ],
    "wait for explicit candidate run",
    { timeout: 2 * 60 * 60 * 1_000 },
  );
  events.push("wait");
  const result = verifyHostedRun(
    candidate,
    selected.runId,
    selected.runAttempt,
  );
  events.push("verify-receipt");
  assertRemoteEquality(candidate, "refetch certified candidate branch");
  events.push("remote-fetch-after", "remote-equal-after");
  assertLocalUnchanged(candidate);
  events.push("unchanged");
  validateCertificationOrder(events);
  printHostedResult("PHASE10_CANDIDATE_CERTIFIED", result);
}

function verifyExplicitRun(headSha, runId, runAttempt) {
  assert(/^[0-9a-f]{40}$/u.test(headSha), "CLI_MODE", "explicit candidate SHA is malformed");
  const candidate = localSnapshot();
  assert(
    candidate.headSha === headSha,
    "LOCAL_SHA",
    "explicit candidate SHA differs from local HEAD",
  );
  assertRemoteEquality(candidate, "refetch explicit candidate branch");
  const result = verifyHostedRun(candidate, runId, runAttempt);
  assertRemoteEquality(candidate, "refetch verified candidate branch");
  assertLocalUnchanged(candidate);
  printHostedResult("PHASE10_CANDIDATE_RUN_VERIFIED", result);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectFailure(label, operation, code) {
  let observed = null;
  try {
    operation();
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
  }
  assert(
    observed?.includes(`[${code}]`) === true,
    "SELF_TEST",
    `${label} did not fail with ${code}; observed=${JSON.stringify(observed)}`,
  );
}

function repositorySnapshot() {
  const runGit = (arguments_) => {
    const result = spawnSync("git", arguments_, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: 10_000,
    });
    assert(
      result.error === undefined && result.signal === null && result.status === 0,
      "SELF_TEST",
      `repository snapshot failed: ${result.stderr}`,
    );
    return result.stdout;
  };
  return Object.freeze({
    head: runGit(["rev-parse", "HEAD"]).trim(),
    status: runGit(["status", "--porcelain=v1", "--untracked-files=all"]),
  });
}

function matchingFixture() {
  const headSha = "a".repeat(40);
  const runId = "123456789";
  const runAttempt = 2;
  const repository = "fullselfbrowsing/Concierge";
  const ref = "refs/heads/main";
  const artifactName =
    `v0.1-candidate-certification-${headSha}-${runId}-${runAttempt}`;
  const evidenceDigests = Object.fromEntries(
    EVIDENCE_PATHS.map((path, index) => [path, String(index + 1).repeat(64)]),
  );
  const body = {
    schema_version: 1,
    repository,
    workflow_name: WORKFLOW_NAME,
    workflow_path: WORKFLOW_PATH,
    ref,
    head_sha: headSha,
    run_id: runId,
    run_attempt: runAttempt,
    artifact_name: artifactName,
    overall_conclusion: "success",
    job_conclusions: {
      build: "success",
      "node-floor": "success",
    },
    evidence_digests: evidenceDigests,
  };
  const receipt = {
    ...body,
    content_digest: sha256(stableJson(body)),
  };
  const run = {
    id: Number(runId),
    run_attempt: runAttempt,
    status: "completed",
    conclusion: "success",
    head_sha: headSha,
    head_branch: "main",
    path: WORKFLOW_PATH,
    name: WORKFLOW_NAME,
    html_url: `https://github.com/${repository}/actions/runs/${runId}`,
    repository: { full_name: repository },
  };
  const jobs = {
    jobs: REQUIRED_RUN_JOBS.map((name, index) => ({
      id: index + 1,
      name,
      status: "completed",
      conclusion: "success",
    })),
  };
  const expected = {
    artifactName,
    evidenceDigests,
    headSha,
    ref,
    repository,
    runAttempt,
    runId,
  };
  return { expected, jobs, receipt, run };
}

function runSelfTest() {
  const before = repositorySnapshot();
  const fixture = matchingFixture();
  let controls = 0;
  const control = (label, operation, code) => {
    expectFailure(label, operation, code);
    controls += 1;
  };
  const receiptMutation = (mutate) => {
    const receipt = clone(fixture.receipt);
    mutate(receipt);
    return () => validateReceipt(receipt, fixture.expected);
  };

  control("receipt-repository", receiptMutation((value) => { value.repository = "other/repo"; }), "RECEIPT_REPOSITORY");
  control("receipt-workflow-name", receiptMutation((value) => { value.workflow_name = "release"; }), "RECEIPT_WORKFLOW");
  control("receipt-workflow-path", receiptMutation((value) => { value.workflow_path = ".github/workflows/release.yml"; }), "RECEIPT_WORKFLOW");
  control("receipt-ref", receiptMutation((value) => { value.ref = "refs/heads/other"; }), "RECEIPT_REF");
  control("receipt-head", receiptMutation((value) => { value.head_sha = "b".repeat(40); }), "RECEIPT_SHA");
  control("receipt-run-id", receiptMutation((value) => { value.run_id = "42"; }), "RECEIPT_RUN_ID");
  control("receipt-attempt", receiptMutation((value) => { value.run_attempt = 3; }), "RECEIPT_ATTEMPT");
  control("receipt-artifact", receiptMutation((value) => { value.artifact_name = "latest"; }), "RECEIPT_ARTIFACT");
  control("receipt-overall", receiptMutation((value) => { value.overall_conclusion = "failure"; }), "RECEIPT_OVERALL");
  control("receipt-missing-job", receiptMutation((value) => { delete value.job_conclusions["node-floor"]; }), "RECEIPT_JOBS");
  control("receipt-failed-job", receiptMutation((value) => { value.job_conclusions.build = "failure"; }), "RECEIPT_JOBS");
  control("receipt-evidence", receiptMutation((value) => { value.evidence_digests[EVIDENCE_PATHS[0]] = "f".repeat(64); }), "RECEIPT_EVIDENCE");
  control("receipt-content-digest", receiptMutation((value) => { value.content_digest = "0".repeat(64); }), "RECEIPT_DIGEST");

  const runMutation = (mutate) => {
    const run = clone(fixture.run);
    const jobs = clone(fixture.jobs);
    mutate(run, jobs);
    return () => validateRunMetadata(run, jobs, fixture.expected);
  };
  control("run-overall", runMutation((run) => { run.conclusion = "failure"; }), "RUN_OVERALL");
  control("run-missing-job", runMutation((_run, jobs) => { jobs.jobs.pop(); }), "RUN_JOBS");
  control("run-failed-job", runMutation((_run, jobs) => { jobs.jobs[0].conclusion = "failure"; }), "RUN_JOBS");
  control("run-attempt", runMutation((run) => { run.run_attempt = 3; }), "RUN_ATTEMPT");

  const verification = `---\nphase: 10\nstatus: gaps_found\n---\n# Verification\n\nGap: EXT-HOSTED-10\n`;
  const audit = `---\nmilestone: v0.1\nstatus: gaps_found\nscores:\n  requirements: 62/62\n  phases: 9/9\n  integration: 12/12\n  flows: 10/10\nnyquist:\n  compliant_phases: ["01", "02", "03", "04", "05", "06", "07", "08", "09"]\n  partial_phases: []\n  missing_phases: []\n  overall: compliant\n---\n# Audit\n\n| Current phase directories | **10/10** |\n\nOnly blocker: EXT-HOSTED-10\n`;
  parseVerification(verification);
  parseMilestoneAudit(audit);
  control("verification-passed", () => parseVerification(verification.replace("gaps_found", "passed")), "HANDOFF_VERIFICATION");
  control("verification-extra-gap", () => parseVerification(`${verification}\nEXT-OTHER-10\n`), "HANDOFF_VERIFICATION");
  control("audit-passed", () => parseMilestoneAudit(audit.replace("status: gaps_found", "status: passed")), "HANDOFF_AUDIT");
  control("audit-requirements", () => parseMilestoneAudit(audit.replace("requirements: 62/62", "requirements: 61/62")), "HANDOFF_AUDIT");
  control("audit-directories", () => parseMilestoneAudit(audit.replace("| Current phase directories | **10/10** |", "")), "HANDOFF_AUDIT");
  control("audit-nyquist", () => parseMilestoneAudit(audit.replace('"09"', '"10"')), "HANDOFF_AUDIT");

  const roadmap = "**Certification status:** Awaiting exact-SHA hosted certification.\n| 10. Close | 7/7 | In Progress | |\n";
  const state = "status: executing\nstopped_at: Awaiting exact-SHA hosted certification\n";
  validatePlanningHandoff(roadmap, state);
  control("roadmap-complete", () => validatePlanningHandoff(roadmap.replace("In Progress", "Complete"), state), "HANDOFF_STATUS");
  control("state-success", () => validatePlanningHandoff(roadmap, state.replace("Awaiting exact-SHA hosted certification", "Hosted certification success")), "HANDOFF_STATUS");

  const order = [
    "handoff-check",
    "snapshot",
    "push",
    "remote-fetch-before",
    "remote-equal-before",
    "run-trigger-or-selection",
    "select-explicit-run",
    "wait",
    "verify-receipt",
    "remote-fetch-after",
    "remote-equal-after",
    "unchanged",
  ];
  validateCertificationOrder(order);
  control("run-trigger-before-push", () => validateCertificationOrder([order[5], ...order.slice(0, 5), ...order.slice(6)]), "CERTIFICATION_ORDER");
  control("selection-before-push", () => validateCertificationOrder([order[6], ...order.slice(0, 6), ...order.slice(7)]), "CERTIFICATION_ORDER");
  control("missing-remote-equality", () => validateCertificationOrder(order.filter((event) => event !== "remote-equal-before")), "CERTIFICATION_ORDER");

  const ownedRoot = mkdtempSync(join(tmpdir(), "concierge-phase10-certify-self-test-"));
  try {
    const inside = join(ownedRoot, "probe.txt");
    assertOwnedWritePath(ownedRoot, inside);
    writeFileSync(inside, "fixture\n", { flag: "wx" });
    assert(
      existsSync(inside) && isOwnedNonemptyRegularFile(ownedRoot, inside),
      "SELF_TEST",
      "owned fixture write or canonical-root validation failed",
    );
    control("outside-owned-root", () => assertOwnedWritePath(ownedRoot, resolve(ownedRoot, "..", "escape.txt")), "OWNED_WRITE");
  } finally {
    rmSync(ownedRoot, { recursive: true });
  }

  validateReceipt(fixture.receipt, fixture.expected);
  validateRunMetadata(fixture.run, fixture.jobs, fixture.expected);
  assert(controls === 29, "SELF_TEST", `expected 29 controls, ran ${controls}`);
  const after = repositorySnapshot();
  assert(
    after.head === before.head && after.status === before.status,
    "SELF_TEST",
    "self-test changed repository HEAD or status",
  );
  process.stdout.write(`PHASE10_CERTIFY_SELF_TEST_OK controls=${controls}\n`);
}

function usage() {
  fail(
    "CLI_MODE",
    "Usage: node scripts/phase-10-certify-candidate.mjs self-test|handoff-check|certify|verify-run <sha> <run-id> <attempt>",
  );
}

async function main(arguments_) {
  if (arguments_.length === 1 && arguments_[0] === "self-test") {
    runSelfTest();
    return;
  }
  if (arguments_.length === 1 && arguments_[0] === "handoff-check") {
    const result = handoffCheck();
    process.stdout.write(
      `PHASE10_HANDOFF_OK plans=${result.plans} summaries=${result.summaries} ` +
        `requirements=${result.audit.scores.requirements} phases=${result.audit.scores.phases} ` +
        `directories=${result.audit.currentDirectories} integration=${result.audit.scores.integration} ` +
        `flows=${result.audit.scores.flows} nyquist09=compliant gap=${result.verification.gap}\n`,
    );
    return;
  }
  if (arguments_.length === 1 && arguments_[0] === "certify") {
    await certifyCandidate();
    return;
  }
  if (arguments_.length === 4 && arguments_[0] === "verify-run") {
    const runAttempt = Number(arguments_[3]);
    assert(
      /^[1-9]\d*$/u.test(arguments_[3]) && Number.isSafeInteger(runAttempt),
      "CLI_MODE",
      "verify-run attempt must be a positive safe integer",
    );
    verifyExplicitRun(arguments_[1], arguments_[2], runAttempt);
    return;
  }
  usage();
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
