#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import {
  ROOT,
  assert,
  exactRegularFile,
  integrityFile,
  loadReleaseLine,
  sha256,
  sha256File,
  stableJson,
} from "./config.mjs";
import {
  exactDirectory,
  readArchiveManifest,
  validateArchiveDirectory,
} from "./archive.mjs";

export const SEAL_FILENAME = "release-seal.json";
const COMMIT = /^[0-9a-f]{40}$/u;
const RUN_ID = /^[1-9]\d*$/u;
const ARTIFACT = /^[A-Za-z0-9_.-]+$/u;

function git(arguments_, label) {
  const result = spawnSync("git", arguments_, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30_000,
  });
  assert(
    result.error === undefined && result.signal === null && result.status === 0,
    "GIT",
    `${label} failed: ${result.error?.message ?? result.stderr}`,
  );
  return result.stdout.trim();
}

function requiredEnvironment(config) {
  const binding = {
    repository: process.env.GITHUB_REPOSITORY,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    commit: process.env.GITHUB_SHA,
    sourceRef: process.env.GITHUB_REF,
    inputArtifact: process.env.RELEASE_INPUT_ARTIFACT,
    outputArtifact: process.env.RELEASE_OUTPUT_ARTIFACT,
  };
  assert(
    binding.repository === config.repository && RUN_ID.test(binding.runId ?? "") &&
      Number.isSafeInteger(binding.runAttempt) && binding.runAttempt > 0 &&
      COMMIT.test(binding.commit ?? "") && binding.sourceRef === config.sourceRef &&
      ARTIFACT.test(binding.inputArtifact ?? "") &&
      ARTIFACT.test(binding.outputArtifact ?? ""),
    "SEAL_BINDING",
    "repository, run, commit, ref, and artifact bindings must be exact",
  );
  assert(
    git(["rev-parse", "HEAD"], "read checkout commit") === binding.commit,
    "SEAL_BINDING",
    "seal checkout does not match the workflow commit",
  );
  assert(
    git(["status", "--porcelain=v1", "--untracked-files=all"], "read checkout status") === "",
    "SEAL_CHECKOUT",
    "seal checkout must be clean before reading tracked policy",
  );
  return Object.freeze(binding);
}

function assertOutsideRepository(directory, label) {
  const relation = relative(ROOT, directory);
  assert(
    relation.startsWith("..") && realpathSync(directory) !== ROOT,
    "SEAL_PATH",
    `${label} must be outside the repository`,
  );
}

function validateNpmArchive(config, configuredPath) {
  const path = exactRegularFile(resolve(configuredPath), "pinned npm archive");
  const expectedFile = `npm-${config.npm.version}.tgz`;
  assert(basename(path) === expectedFile, "SEAL_NPM", `pinned npm archive must be ${expectedFile}`);
  assert(
    integrityFile(path) === config.npm.integrity,
    "SEAL_NPM",
    "pinned npm archive integrity drifted",
  );
  const manifest = readArchiveManifest(path);
  assert(
    manifest.name === "npm" && manifest.version === config.npm.version,
    "SEAL_NPM",
    "pinned npm archive identity drifted",
  );
  return path;
}

export function sealBodyDigest(body) {
  return sha256(stableJson(body));
}

function createSeal(archives, tools, config, binding) {
  const body = {
    schemaVersion: 1,
    releaseAuthorization: true,
    releaseLine: config.releaseLine,
    contractVersion: config.contractVersion,
    version: archives.version,
    distTag: config.distTag,
    registry: config.registry,
    repository: config.repository,
    sourceRef: binding.sourceRef,
    workflowPath: config.workflowPath,
    environment: config.environment,
    commit: binding.commit,
    runId: binding.runId,
    runAttempt: binding.runAttempt,
    inputArtifact: binding.inputArtifact,
    outputArtifact: binding.outputArtifact,
    packageSetSha256: config.sha256,
    packages: config.packages.map((entry) => entry.name),
    archives: archives.archives.map(({ name, file, sha256: digest, integrity }) => ({
      name,
      file,
      sha256: digest,
      integrity,
    })),
    tools,
  };
  return Object.freeze({ ...body, contentDigest: sealBodyDigest(body) });
}

function sealRelease(archiveDirectory, npmArchive, outputDirectory) {
  const config = loadReleaseLine();
  const binding = requiredEnvironment(config);
  const archives = validateArchiveDirectory(config, resolve(archiveDirectory));
  const npmPath = validateNpmArchive(config, npmArchive);
  const output = exactDirectory(resolve(outputDirectory), "sealed output directory", { empty: true });
  assertOutsideRepository(archives.directory, "archive input directory");
  assertOutsideRepository(output, "sealed output directory");

  const toolSources = [
    [join(ROOT, "scripts/release/config.mjs"), "config.mjs"],
    [join(ROOT, "scripts/release/publisher.mjs"), "release-publisher.mjs"],
    [config.path, "release-line.json"],
    [npmPath, basename(npmPath)],
  ];
  const tools = toolSources.map(([source, file]) => {
    exactRegularFile(resolve(source), `publisher tool ${file}`);
    const destination = join(output, file);
    copyFileSync(source, destination, 0);
    return Object.freeze({ file, sha256: sha256File(destination) });
  });
  for (const archive of archives.archives) {
    copyFileSync(archive.path, join(output, archive.file), 0);
  }
  const seal = createSeal(archives, tools, config, binding);
  writeFileSync(join(output, SEAL_FILENAME), `${JSON.stringify(seal, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  const expected = [
    SEAL_FILENAME,
    ...tools.map((entry) => entry.file),
    ...seal.archives.map((entry) => entry.file),
  ].sort();
  assert(
    JSON.stringify(readdirSync(output).sort()) === JSON.stringify(expected),
    "SEAL_OUTPUT",
    "sealed output contains missing or extra files",
  );
  process.stdout.write(
    `${JSON.stringify({
      status: "passed",
      version: seal.version,
      contentDigest: seal.contentDigest,
      outputArtifact: seal.outputArtifact,
      files: expected,
    })}\n`,
  );
}

function selfTest() {
  const config = loadReleaseLine();
  const body = {
    schemaVersion: 1,
    releaseLine: config.releaseLine,
    contractVersion: config.contractVersion,
    version: config.initialVersion,
    distTag: config.distTag,
  };
  const first = sealBodyDigest(body);
  const reordered = sealBodyDigest({ distTag: config.distTag, ...body });
  const changed = sealBodyDigest({ ...body, distTag: "preview" });
  assert(first === reordered && first !== changed, "SELF_TEST", "stable seal digest failed");
  process.stdout.write("release seal self-test passed\n");
}

const command = process.argv[2];
if (command === "seal") {
  assert(process.argv.length === 6, "USAGE", "seal requires archive, npm, and output paths");
  sealRelease(process.argv[3], process.argv[4], process.argv[5]);
} else if (command === "self-test") selfTest();
else throw new Error("usage: node scripts/release/seal.mjs seal <archives> <npm.tgz> <empty-output>|self-test");
