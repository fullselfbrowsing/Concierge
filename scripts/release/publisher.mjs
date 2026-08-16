#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { get as httpsGet } from "node:https";
import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, normalize, resolve } from "node:path";
import {
  assert,
  exactKeys,
  exactRegularFile,
  expectedArchiveFilename,
  integrityFile,
  isReleaseLineVersion,
  loadReleaseLine,
  sha256,
  sha256File,
  stableJson,
} from "./config.mjs";

const SEAL_FILENAME = "release-seal.json";
const PROVENANCE_PREDICATE = "https://slsa.dev/provenance/v1";
const GITHUB_BUILD_TYPE =
  "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1";
const GITHUB_BUILDER = "https://github.com/actions/runner/github-hosted";
const SHA256 = /^[0-9a-f]{64}$/u;
const SHA512 = /^sha512-[A-Za-z0-9+/]+={0,2}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const RUN_ID = /^[1-9]\d*$/u;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

function exactDirectory(path, label) {
  assert(isAbsolute(path), "PATH", `${label} must be absolute`);
  assert(path === normalize(resolve(path)), "PATH", `${label} must be normalized`);
  const metadata = lstatSync(path);
  assert(
    metadata.isDirectory() && realpathSync(path) === path,
    "PATH",
    `${label} must be a real directory, not a symlink`,
  );
  return path;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `[JSON] ${label} is invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function run(command, arguments_, label, environment = process.env) {
  const result = spawnSync(command, arguments_, {
    encoding: "utf8",
    env: environment,
    maxBuffer: MAX_RESPONSE_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
  return Object.freeze({
    ...result,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    label,
  });
}

function successful(result) {
  return result.error === undefined && result.signal === null && result.status === 0;
}

function readArchiveManifest(path) {
  const result = run("tar", ["-xOzf", path, "package/package.json"], `read ${basename(path)}`);
  assert(successful(result), "ARCHIVE_MANIFEST", `${result.label} failed: ${result.output}`);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `[ARCHIVE_MANIFEST] ${basename(path)} has invalid package JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function sealBody(seal) {
  const { contentDigest: _contentDigest, ...body } = seal;
  return body;
}

function validateSealShape(seal, config, expected) {
  exactKeys(
    seal,
    [
      "schemaVersion",
      "releaseAuthorization",
      "releaseLine",
      "contractVersion",
      "version",
      "distTag",
      "registry",
      "repository",
      "sourceRef",
      "workflowPath",
      "environment",
      "commit",
      "runId",
      "runAttempt",
      "inputArtifact",
      "outputArtifact",
      "packageSetSha256",
      "packages",
      "archives",
      "tools",
      "contentDigest",
    ],
    "SEAL_SCHEMA",
    "release seal",
  );
  assert(
    seal.schemaVersion === 1 && seal.releaseAuthorization === true &&
      seal.releaseLine === config.releaseLine &&
      seal.contractVersion === config.contractVersion &&
      isReleaseLineVersion(seal.version, config.releaseLine) &&
      seal.distTag === config.distTag && seal.registry === config.registry &&
      seal.repository === config.repository && seal.sourceRef === config.sourceRef &&
      seal.workflowPath === config.workflowPath && seal.environment === config.environment &&
      seal.packageSetSha256 === config.sha256,
    "SEAL_IDENTITY",
    `release seal is not authorization for the configured ${config.releaseLine} ${config.distTag} trio`,
  );
  assert(
    seal.repository === expected.repository && seal.commit === expected.commit &&
      seal.runId === expected.runId && seal.runAttempt <= expected.runAttempt &&
      seal.sourceRef === expected.sourceRef && seal.outputArtifact === expected.outputArtifact,
    "SEAL_BINDING",
    "release seal does not match this repository workflow run",
  );
  assert(
    COMMIT.test(seal.commit) && RUN_ID.test(seal.runId) &&
      Number.isSafeInteger(seal.runAttempt) && seal.runAttempt > 0 &&
      SHA256.test(seal.contentDigest) &&
      seal.contentDigest === sha256(stableJson(sealBody(seal))),
    "SEAL_DIGEST",
    "release seal content digest is invalid",
  );
  assert(
    JSON.stringify(seal.packages) ===
      JSON.stringify(config.packages.map((entry) => entry.name)) &&
      Array.isArray(seal.archives) && seal.archives.length === config.packages.length,
    "SEAL_PACKAGES",
    "release seal package order drifted",
  );
  for (const [index, record] of seal.archives.entries()) {
    exactKeys(
      record,
      ["name", "file", "sha256", "integrity"],
      "SEAL_ARCHIVE",
      `archive record ${index}`,
    );
    const spec = config.packages[index];
    assert(
      record.name === spec.name &&
        record.file === expectedArchiveFilename(spec.name, seal.version) &&
        SHA256.test(record.sha256) && SHA512.test(record.integrity),
      "SEAL_ARCHIVE",
      `${spec.name} sealed archive identity drifted`,
    );
  }
  const expectedTools = [
    "config.mjs",
    "release-publisher.mjs",
    "release-line.json",
    `npm-${config.npm.version}.tgz`,
  ];
  assert(
    Array.isArray(seal.tools) && seal.tools.length === expectedTools.length,
    "SEAL_TOOL",
    "sealed publisher tool set is incomplete",
  );
  for (const [index, record] of seal.tools.entries()) {
    exactKeys(record, ["file", "sha256"], "SEAL_TOOL", `tool record ${index}`);
    assert(
      record.file === expectedTools[index] && SHA256.test(record.sha256),
      "SEAL_TOOL",
      `sealed publisher tool ${index} drifted`,
    );
  }
}

function expectedBindings(config) {
  const expected = {
    repository: process.env.GITHUB_REPOSITORY,
    commit: process.env.GITHUB_SHA,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    sourceRef: process.env.GITHUB_REF,
    outputArtifact: process.env.RELEASE_OUTPUT_ARTIFACT,
  };
  assert(
    expected.repository === config.repository && COMMIT.test(expected.commit ?? "") &&
      RUN_ID.test(expected.runId ?? "") && Number.isSafeInteger(expected.runAttempt) &&
      expected.runAttempt > 0 && expected.sourceRef === config.sourceRef &&
      typeof expected.outputArtifact === "string" && expected.outputArtifact.length > 0,
    "PUBLISH_BINDING",
    "publisher workflow bindings are incomplete or foreign",
  );
  return Object.freeze(expected);
}

function inspectSealedDirectory(configuredDirectory, expectedOverride = null) {
  const directory = exactDirectory(resolve(configuredDirectory), "sealed release directory");
  const config = loadReleaseLine(join(directory, "release-line.json"));
  const seal = readJson(join(directory, SEAL_FILENAME), "release seal");
  const expected = expectedOverride ?? expectedBindings(config);
  validateSealShape(seal, config, expected);
  const expectedFiles = [SEAL_FILENAME];
  const tools = seal.tools.map((record) => {
    const path = exactRegularFile(join(directory, record.file), `publisher tool ${record.file}`);
    assert(sha256File(path) === record.sha256, "SEAL_TOOL", `${record.file} digest drifted`);
    expectedFiles.push(record.file);
    return Object.freeze({ ...record, path });
  });
  assert(
    integrityFile(join(directory, `npm-${config.npm.version}.tgz`)) === config.npm.integrity,
    "SEAL_NPM",
    "sealed npm archive integrity drifted",
  );
  const archives = seal.archives.map((record, index) => {
    const path = exactRegularFile(join(directory, record.file), `${record.name} archive`);
    assert(
      sha256File(path) === record.sha256 && integrityFile(path) === record.integrity,
      "SEAL_ARCHIVE",
      `${record.name} sealed archive bytes drifted`,
    );
    const manifest = readArchiveManifest(path);
    const spec = config.packages[index];
    assert(
      manifest.name === record.name && manifest.version === seal.version &&
        manifest.publishConfig?.access === "public" &&
        manifest.publishConfig?.tag === config.distTag &&
        manifest.repository?.url === config.repositoryUrl &&
        manifest.repository?.directory === spec.path,
      "SEAL_ARCHIVE",
      `${record.name} sealed manifest identity drifted`,
    );
    expectedFiles.push(record.file);
    return Object.freeze({ ...record, path, version: seal.version });
  });
  assert(
    JSON.stringify(readdirSync(directory).sort()) === JSON.stringify(expectedFiles.sort()),
    "SEAL_DIRECTORY",
    "sealed release directory contains missing or extra files",
  );
  return Object.freeze({ directory, config, seal, tools, archives });
}

function assertInputsUnchanged(inputs) {
  const seal = readJson(join(inputs.directory, SEAL_FILENAME), "release seal");
  assert(
    seal.contentDigest === inputs.seal.contentDigest &&
      sha256(stableJson(sealBody(seal))) === inputs.seal.contentDigest,
    "INPUT_MUTATION",
    "release seal changed during publication",
  );
  for (const record of [...inputs.tools, ...inputs.archives]) {
    assert(
      sha256File(record.path) === record.sha256,
      "INPUT_MUTATION",
      `${record.file} changed during publication`,
    );
  }
}

function assertSafeEnvironment(environment) {
  for (const [name, value] of Object.entries(environment)) {
    const normalized = name.toLowerCase();
    const direct = ["npm_token", "node_auth_token", "npm_auth_token", "npm_id_token"]
      .includes(normalized);
    const npmOverride = normalized.startsWith("npm_config_") &&
      /(?:registry|auth|token|userconfig|globalconfig)/u.test(normalized);
    assert(
      value === undefined || value === "" || (!direct && !npmOverride),
      "PUBLISH_ENVIRONMENT",
      `${name} must not inject registry credentials or configuration`,
    );
  }
}

function npmArguments(configFiles, config) {
  return [
    `--registry=${config.registry}`,
    `--userconfig=${configFiles.user}`,
    `--globalconfig=${configFiles.global}`,
  ];
}

function fetchJson(url) {
  return new Promise((resolvePromise, rejectPromise) => {
    const request = httpsGet(
      url,
      { headers: { accept: "application/json", "user-agent": "concierge-release-publisher" } },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          rejectPromise(new Error(`registry endpoint returned ${response.statusCode}`));
          return;
        }
        let source = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          source += chunk;
          if (Buffer.byteLength(source) > MAX_RESPONSE_BYTES) {
            request.destroy(new Error("registry response exceeded the size bound"));
          }
        });
        response.on("end", () => {
          try {
            resolvePromise(JSON.parse(source));
          } catch (error) {
            rejectPromise(error);
          }
        });
      },
    );
    request.setTimeout(30_000, () => request.destroy(new Error("registry request timed out")));
    request.on("error", rejectPromise);
  });
}

function archiveIntegrityHex(archive) {
  const bytes = Buffer.from(archive.integrity.slice("sha512-".length), "base64");
  assert(bytes.length === 64, "REGISTRY_PROVENANCE", "sealed SHA-512 is malformed");
  return bytes.toString("hex");
}

function attestationUrl(archive, record, config) {
  const expected = `${config.registry}-/npm/v1/attestations/${archive.name.replace("/", "%2f")}@${archive.version}`;
  assert(
    record.dist?.attestations?.url === expected &&
      record.dist?.attestations?.provenance?.predicateType === PROVENANCE_PREDICATE,
    "REGISTRY_PROVENANCE",
    `${archive.name} npm provenance metadata drifted`,
  );
  return expected;
}

function validateProvenance(archive, response, inputs) {
  exactKeys(response, ["attestations"], "REGISTRY_PROVENANCE", "attestation response");
  const candidates = response.attestations?.filter(
    (entry) => entry?.predicateType === PROVENANCE_PREDICATE,
  );
  assert(
    Array.isArray(candidates) && candidates.length === 1,
    "REGISTRY_PROVENANCE",
    `${archive.name} must have exactly one SLSA provenance attestation`,
  );
  const envelope = candidates[0]?.bundle?.dsseEnvelope;
  assert(
    envelope?.payloadType === "application/vnd.in-toto+json" &&
      typeof envelope.payload === "string" && Array.isArray(envelope.signatures) &&
      envelope.signatures.length > 0,
    "REGISTRY_PROVENANCE",
    `${archive.name} provenance DSSE envelope is malformed`,
  );
  let statement;
  try {
    statement = JSON.parse(Buffer.from(envelope.payload, "base64").toString("utf8"));
  } catch (error) {
    throw new Error(
      `[REGISTRY_PROVENANCE] ${archive.name} provenance payload is invalid: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  assert(
    statement._type === "https://in-toto.io/Statement/v1" &&
      statement.predicateType === PROVENANCE_PREDICATE &&
      Array.isArray(statement.subject) && statement.subject.length === 1,
    "REGISTRY_PROVENANCE",
    `${archive.name} provenance statement identity drifted`,
  );
  const purlName = archive.name.startsWith("@")
    ? `%40${archive.name.slice(1)}`
    : archive.name;
  assert(
    statement.subject[0]?.name === `pkg:npm/${purlName}@${archive.version}` &&
      statement.subject[0]?.digest?.sha512 === archiveIntegrityHex(archive),
    "REGISTRY_PROVENANCE",
    `${archive.name} provenance subject differs from sealed bytes`,
  );
  const definition = statement.predicate?.buildDefinition;
  const workflow = definition?.externalParameters?.workflow;
  const dependency = definition?.resolvedDependencies?.[0];
  const invocationId = statement.predicate?.runDetails?.metadata?.invocationId;
  let invocation;
  try {
    invocation = new URL(invocationId);
  } catch {
    throw new Error(`[REGISTRY_PROVENANCE] ${archive.name} provenance invocation is invalid`);
  }
  const escapedRepository = inputs.seal.repository.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const invocationPath = new RegExp(
    `^/${escapedRepository}/actions/runs/[1-9]\\d*/attempts/[1-9]\\d*$`,
    "u",
  );
  assert(
    definition?.buildType === GITHUB_BUILD_TYPE &&
      workflow?.repository === inputs.config.repositoryWebUrl &&
      workflow?.ref === inputs.seal.sourceRef &&
      workflow?.path === inputs.seal.workflowPath &&
      definition?.resolvedDependencies?.length === 1 &&
      dependency?.uri ===
        `git+https://github.com/${inputs.seal.repository}@${inputs.seal.sourceRef}` &&
      dependency?.digest?.gitCommit === inputs.seal.commit &&
      statement.predicate?.runDetails?.builder?.id === GITHUB_BUILDER &&
      invocation.protocol === "https:" && invocation.origin === "https://github.com" &&
      invocation.username === "" && invocation.password === "" && invocation.port === "" &&
      invocation.search === "" && invocation.hash === "" &&
      invocationPath.test(invocation.pathname),
    "REGISTRY_PROVENANCE",
    `${archive.name} provenance repository, workflow, commit, or run drifted`,
  );
}

function createRegistry(inputs, npmCli, environment, configFiles) {
  const npmConfig = npmArguments(configFiles, inputs.config);
  return Object.freeze({
    query(archive) {
      const result = run(
        process.execPath,
        [npmCli, "view", `${archive.name}@${archive.version}`, "name", "version", "dist", "--json", ...npmConfig],
        `query ${archive.name}@${archive.version}`,
        environment,
      );
      if (successful(result)) {
        try {
          return Object.freeze({ kind: "present", record: JSON.parse(result.stdout) });
        } catch (error) {
          throw new Error(`[REGISTRY_QUERY] ${archive.name} returned invalid JSON: ${String(error)}`);
        }
      }
      if (result.error === undefined && /(?:\bE404\b|\b404 Not Found\b)/u.test(result.output)) {
        return Object.freeze({ kind: "missing" });
      }
      throw new Error(`[REGISTRY_QUERY] ${archive.name} registry state is ambiguous: ${result.output}`);
    },
    tags(archive) {
      const result = run(
        process.execPath,
        [npmCli, "view", archive.name, "dist-tags", "--json", ...npmConfig],
        `query ${archive.name} dist-tags`,
        environment,
      );
      assert(successful(result), "REGISTRY_TAG", `${result.label} failed: ${result.output}`);
      try {
        return JSON.parse(result.stdout);
      } catch (error) {
        throw new Error(`[REGISTRY_TAG] ${archive.name} returned invalid dist-tags JSON: ${String(error)}`);
      }
    },
    publish(archive) {
      return run(
        process.execPath,
        [
          npmCli,
          "publish",
          archive.path,
          "--access",
          "public",
          "--tag",
          inputs.config.distTag,
          "--provenance",
          ...npmConfig,
        ],
        `publish ${archive.name}`,
        environment,
      );
    },
    fetchAttestation(url) {
      return fetchJson(url);
    },
  });
}

async function validateRegistryRecord(archive, record, registry, inputs) {
  assert(
    record?.name === archive.name && record?.version === archive.version &&
      record?.dist?.integrity === archive.integrity,
    "REGISTRY_INTEGRITY",
    `${archive.name}@${archive.version} registry bytes differ from the seal`,
  );
  const url = attestationUrl(archive, record, inputs.config);
  validateProvenance(archive, await registry.fetchAttestation(url), inputs);
  const tags = registry.tags(archive);
  assert(
    tags?.[inputs.config.distTag] === archive.version,
    "REGISTRY_TAG",
    `${archive.name}@${archive.version} exists but ${inputs.config.distTag} points elsewhere; repair requires a separate approved maintainer operation`,
  );
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function validateAfterPublish(archive, registry, inputs) {
  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const state = registry.query(archive);
      if (state.kind === "present") {
        await validateRegistryRecord(archive, state.record, registry, inputs);
        return;
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt < 5) await wait(1_500);
  }
  throw new Error(
    `[PUBLISH_AMBIGUOUS] ${archive.name}@${archive.version} could not be verified after publish: ${String(lastError ?? "not visible")}`,
  );
}

function publisherEnvironment(config) {
  assertSafeEnvironment(process.env);
  const npmCli = exactRegularFile(resolve(process.env.RELEASE_NPM_CLI ?? ""), "pinned npm CLI");
  const [major, minor] = process.versions.node.split(".").slice(0, 2).map(Number);
  assert(
    major > 22 || (major === 22 && minor >= 14),
    "PUBLISH_NODE",
    `publisher Node ${process.version} is below ${config.node.publisherMinimum}`,
  );
  const configRoot = mkdtempSync(join(realpathSync(tmpdir()), "concierge-npm-publisher-"));
  const configFiles = {
    user: join(configRoot, "user.npmrc"),
    global: join(configRoot, "global.npmrc"),
  };
  writeFileSync(configFiles.user, "", { encoding: "utf8", flag: "wx", mode: 0o600 });
  writeFileSync(configFiles.global, "", { encoding: "utf8", flag: "wx", mode: 0o600 });
  const environment = { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" };
  for (const name of Object.keys(environment)) {
    const normalized = name.toLowerCase();
    if (
      ["npm_token", "node_auth_token", "npm_auth_token", "npm_id_token"].includes(normalized) ||
      (normalized.startsWith("npm_config_") &&
        /(?:registry|auth|token|userconfig|globalconfig)/u.test(normalized))
    ) delete environment[name];
  }
  environment.npm_config_registry = config.registry;
  environment.npm_config_userconfig = configFiles.user;
  environment.npm_config_globalconfig = configFiles.global;
  const version = run(
    process.execPath,
    [npmCli, "--version", ...npmArguments(configFiles, config)],
    "read pinned npm version",
    environment,
  );
  assert(
    successful(version) && version.stdout.trim() === config.npm.version,
    "PUBLISH_NPM",
    `publisher must use npm ${config.npm.version}`,
  );
  return Object.freeze({ npmCli, environment, configFiles, configRoot });
}

async function publish(configuredDirectory) {
  const inputs = inspectSealedDirectory(configuredDirectory);
  const publisher = publisherEnvironment(inputs.config);
  try {
    const registry = createRegistry(inputs, publisher.npmCli, publisher.environment, publisher.configFiles);
    let published = 0;
    let skipped = 0;
    for (const archive of inputs.archives) {
      assertInputsUnchanged(inputs);
      const before = registry.query(archive);
      if (before.kind === "present") {
        await validateRegistryRecord(archive, before.record, registry, inputs);
        skipped += 1;
        continue;
      }
      const result = registry.publish(archive);
      assertInputsUnchanged(inputs);
      if (!successful(result)) {
        throw new Error(
          `[PUBLISH_AMBIGUOUS] ${archive.name}@${archive.version} publish returned an error; rerun this exact sealed release to determine registry state`,
        );
      }
      await validateAfterPublish(archive, registry, inputs);
      published += 1;
    }
    assertInputsUnchanged(inputs);
    process.stdout.write(
      `${JSON.stringify({
        status: "published",
        version: inputs.seal.version,
        distTag: inputs.config.distTag,
        published,
        skipped,
      })}\n`,
    );
  } finally {
    rmSync(publisher.configRoot, { recursive: true, force: true });
  }
}

function selfTest() {
  const config = loadReleaseLine();
  const expected = {
    repository: config.repository,
    commit: "a".repeat(40),
    runId: "12345",
    runAttempt: 1,
    sourceRef: config.sourceRef,
    outputArtifact: `release-sealed-12345-1-${"a".repeat(40)}`,
  };
  const body = {
    schemaVersion: 1,
    releaseAuthorization: true,
    releaseLine: config.releaseLine,
    contractVersion: config.contractVersion,
    version: config.initialVersion,
    distTag: config.distTag,
    registry: config.registry,
    repository: config.repository,
    sourceRef: config.sourceRef,
    workflowPath: config.workflowPath,
    environment: config.environment,
    commit: expected.commit,
    runId: expected.runId,
    runAttempt: expected.runAttempt,
    inputArtifact: `release-input-12345-1-${"a".repeat(40)}`,
    outputArtifact: expected.outputArtifact,
    packageSetSha256: config.sha256,
    packages: config.packages.map((entry) => entry.name),
    archives: config.packages.map((entry) => ({
      name: entry.name,
      file: expectedArchiveFilename(entry.name, config.initialVersion),
      sha256: "b".repeat(64),
      integrity: `sha512-${Buffer.alloc(64).toString("base64")}`,
    })),
    tools: ["config.mjs", "release-publisher.mjs", "release-line.json", "npm-11.19.0.tgz"]
      .map((file) => ({ file, sha256: "c".repeat(64) })),
  };
  const seal = { ...body, contentDigest: sha256(stableJson(body)) };
  validateSealShape(seal, config, expected);
  let tagRejected = false;
  try {
    const changedBody = { ...body, distTag: "preview" };
    validateSealShape(
      { ...changedBody, contentDigest: sha256(stableJson(changedBody)) },
      config,
      expected,
    );
  } catch (error) {
    tagRejected = String(error).includes("[SEAL_IDENTITY]");
  }
  assert(tagRejected, "SELF_TEST", "foreign dist-tag was accepted");
  let tokenRejected = false;
  try {
    assertSafeEnvironment({ NPM_TOKEN: "secret" });
  } catch (error) {
    tokenRejected = String(error).includes("[PUBLISH_ENVIRONMENT]");
  }
  assert(tokenRejected, "SELF_TEST", "long-lived npm token was accepted");
  process.stdout.write("release publisher self-test passed\n");
}

const command = process.argv[2];
if (command === "publish") {
  assert(process.argv.length === 4, "USAGE", "publish requires the sealed directory");
  await publish(process.argv[3]);
} else if (command === "self-test") selfTest();
else throw new Error("usage: node release-publisher.mjs publish <sealed-directory>|self-test");
