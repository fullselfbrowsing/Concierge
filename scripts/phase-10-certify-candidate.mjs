#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
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

function validateReceipt() {
  fail("NOT_IMPLEMENTED", "receipt validation is not implemented");
}

function validateRunMetadata() {
  fail("NOT_IMPLEMENTED", "run validation is not implemented");
}

function parseVerification() {
  fail("NOT_IMPLEMENTED", "verification parsing is not implemented");
}

function parseMilestoneAudit() {
  fail("NOT_IMPLEMENTED", "milestone audit parsing is not implemented");
}

function validatePlanningHandoff() {
  fail("NOT_IMPLEMENTED", "planning handoff validation is not implemented");
}

function validateCertificationOrder() {
  fail("NOT_IMPLEMENTED", "certification ordering is not implemented");
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
  const runId = "31513847865";
  const runAttempt = 2;
  const repository = "fullselfbrowsing/Concierge";
  const ref = "refs/heads/main";
  const artifactName =
    `v0.1-candidate-certification-${headSha}-${runId}-${runAttempt}`;
  const evidenceDigests = Object.fromEntries(
    EVIDENCE_PATHS.map((path, index) => [path, String(index + 1).repeat(64)]),
  );
  const body = {
    schemaVersion: 1,
    repository,
    workflowName: WORKFLOW_NAME,
    workflowPath: WORKFLOW_PATH,
    ref,
    headSha,
    runId,
    runAttempt,
    artifactName,
    overallConclusion: "success",
    jobConclusions: {
      build: "success",
      "node-floor": "success",
    },
    evidenceDigests,
  };
  const receipt = {
    ...body,
    contentDigest: sha256(stableJson(body)),
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
  control("receipt-workflow-name", receiptMutation((value) => { value.workflowName = "release"; }), "RECEIPT_WORKFLOW");
  control("receipt-workflow-path", receiptMutation((value) => { value.workflowPath = ".github/workflows/release.yml"; }), "RECEIPT_WORKFLOW");
  control("receipt-ref", receiptMutation((value) => { value.ref = "refs/heads/other"; }), "RECEIPT_REF");
  control("receipt-head", receiptMutation((value) => { value.headSha = "b".repeat(40); }), "RECEIPT_SHA");
  control("receipt-run-id", receiptMutation((value) => { value.runId = "42"; }), "RECEIPT_RUN_ID");
  control("receipt-attempt", receiptMutation((value) => { value.runAttempt = 3; }), "RECEIPT_ATTEMPT");
  control("receipt-artifact", receiptMutation((value) => { value.artifactName = "latest"; }), "RECEIPT_ARTIFACT");
  control("receipt-overall", receiptMutation((value) => { value.overallConclusion = "failure"; }), "RECEIPT_OVERALL");
  control("receipt-missing-job", receiptMutation((value) => { delete value.jobConclusions["node-floor"]; }), "RECEIPT_JOBS");
  control("receipt-failed-job", receiptMutation((value) => { value.jobConclusions.build = "failure"; }), "RECEIPT_JOBS");
  control("receipt-evidence", receiptMutation((value) => { value.evidenceDigests[EVIDENCE_PATHS[0]] = "f".repeat(64); }), "RECEIPT_EVIDENCE");
  control("receipt-content-digest", receiptMutation((value) => { value.contentDigest = "0".repeat(64); }), "RECEIPT_DIGEST");

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
    "dispatch",
    "select-explicit-run",
    "wait",
    "verify-receipt",
    "remote-fetch-after",
    "remote-equal-after",
    "unchanged",
  ];
  validateCertificationOrder(order);
  control("dispatch-before-push", () => validateCertificationOrder([order[5], ...order.slice(0, 5), ...order.slice(6)]), "CERTIFICATION_ORDER");
  control("selection-before-push", () => validateCertificationOrder([order[6], ...order.slice(0, 6), ...order.slice(7)]), "CERTIFICATION_ORDER");
  control("missing-remote-equality", () => validateCertificationOrder(order.filter((event) => event !== "remote-equal-before")), "CERTIFICATION_ORDER");

  const ownedRoot = mkdtempSync(join(tmpdir(), "concierge-phase10-certify-self-test-"));
  try {
    const inside = join(ownedRoot, "probe.txt");
    assertOwnedWritePath(ownedRoot, inside);
    writeFileSync(inside, "fixture\n", { flag: "wx" });
    assert(existsSync(inside), "SELF_TEST", "owned fixture write failed");
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

const arguments_ = process.argv.slice(2);
try {
  if (arguments_.length === 1 && arguments_[0] === "self-test") {
    runSelfTest();
  } else {
    usage();
  }
} catch (error) {
  process.stderr.write(`FAIL: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
