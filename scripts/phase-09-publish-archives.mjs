#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { get as httpsGet } from "node:https";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  normalize,
  resolve,
} from "node:path";

const NPM_VERSION = "11.11.0";
const NPM_REGISTRY = "https://registry.npmjs.org/";
const SOURCE_REF = "refs/heads/main";
const WORKFLOW_PATH = ".github/workflows/release.yml";
const REPOSITORY_URL = "https://github.com/fullselfbrowsing/concierge";
const REPOSITORY_GIT_URL = "git+https://github.com/fullselfbrowsing/concierge.git";
const GITHUB_BUILD_TYPE =
  "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1";
const GITHUB_BUILDER = "https://github.com/actions/runner/github-hosted";
const PACKAGE_ORDER = Object.freeze([
  "@fullselfbrowsing/concierge",
  "@fullselfbrowsing/concierge-react",
  "@fullselfbrowsing/concierge-svelte",
]);
const SEAL_FILENAME = "phase-09-release-seal.json";
const SHA256 = /^[0-9a-f]{64}$/u;
const SHA512_INTEGRITY = /^sha512-[A-Za-z0-9+/]+={0,2}$/u;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const RUN_ID = /^[1-9]\d*$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const CHANGESET_PATH = /^\.changeset\/[^/]+\.md$/u;
const ARTIFACT_NAME = /^[A-Za-z0-9_.-]+$/u;
const PROVENANCE_PREDICATE = "https://slsa.dev/provenance/v1";
const TEMP_PREFIX = "concierge-phase09-publisher-";
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

function fail(code, message) {
  throw new Error(`[${code}] ${message}`);
}

function assert(condition, code, message) {
  if (!condition) fail(code, message);
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function integrityFile(path) {
  return `sha512-${createHash("sha512")
    .update(readFileSync(path))
    .digest("base64")}`;
}

function spawn(command, arguments_, label, environment = process.env) {
  const result = spawnSync(command, arguments_, {
    encoding: "utf8",
    env: environment,
    maxBuffer: MAX_OUTPUT_BYTES,
    timeout: 120_000,
  });
  return Object.freeze({
    ...result,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    label,
  });
}

function run(command, arguments_, label, environment = process.env) {
  const result = spawn(command, arguments_, label, environment);
  assert(
    result.error === undefined && result.signal === null && result.status === 0,
    "PROCESS",
    `${label} failed: ${result.error?.message ?? result.stderr}`,
  );
  return result.stdout;
}

function exactRegularFile(path, label) {
  assert(isAbsolute(path), "PATH", `${label} must be absolute`);
  assert(path === normalize(resolve(path)), "PATH", `${label} must be normalized`);
  const metadata = lstatSync(path);
  assert(
    metadata.isFile() && metadata.size > 0 && realpathSync(path) === path,
    "PATH",
    `${label} must be a nonempty regular file`,
  );
  return path;
}

function archiveManifest(path) {
  const source = run(
    "tar",
    ["-xOzf", path, "package/package.json"],
    `read ${basename(path)} manifest`,
  );
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(
      "ARCHIVE_MANIFEST",
      `${basename(path)} manifest is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function expectedArchiveFilename(name, version) {
  return `${name.replace(/^@/u, "").replace("/", "-")}-${version}.tgz`;
}

function sealIdentityBody(seal) {
  return {
    schemaVersion: seal.schemaVersion,
    mode: seal.mode,
    releaseAuthorization: seal.releaseAuthorization,
    repository: seal.repository,
    runId: seal.runId,
    runAttempt: seal.runAttempt,
    commit: seal.commit,
    sourceRef: seal.sourceRef,
    workflowPath: seal.workflowPath,
    inputArtifact: seal.inputArtifact,
    versionReceiptSha256: seal.versionReceiptSha256,
    releaseEvidenceSha256: seal.releaseEvidenceSha256,
    sharedVersion: seal.sharedVersion,
    consumedChangesets: seal.consumedChangesets,
    archives: seal.archives,
  };
}

function validateSeal(seal, expected) {
  exactKeys(
    seal,
    [
      "schemaVersion",
      "mode",
      "releaseAuthorization",
      "repository",
      "runId",
      "runAttempt",
      "commit",
      "sourceRef",
      "workflowPath",
      "inputArtifact",
      "outputArtifact",
      "versionReceiptSha256",
      "releaseEvidenceSha256",
      "sharedVersion",
      "consumedChangesets",
      "archives",
      "sealId",
      "contentDigest",
    ],
    "SEAL_SCHEMA",
    "release seal",
  );
  assert(
    seal.schemaVersion === 1 &&
      seal.mode === "versioned" &&
      seal.releaseAuthorization === true,
    "RELEASE_AUTHORIZATION",
    "release seal is not versioned release authorization",
  );
  assert(
    SEMVER.test(seal.sharedVersion) && seal.sharedVersion !== "0.0.0",
    "RELEASE_VERSION",
    "release seal sharedVersion must be a nonzero semantic version",
  );
  assert(
    REPOSITORY.test(seal.repository) &&
      RUN_ID.test(seal.runId) &&
      Number.isSafeInteger(seal.runAttempt) && seal.runAttempt > 0 &&
      COMMIT.test(seal.commit) &&
      seal.sourceRef === SOURCE_REF &&
      seal.workflowPath === WORKFLOW_PATH &&
      ARTIFACT_NAME.test(seal.inputArtifact) &&
      ARTIFACT_NAME.test(seal.outputArtifact) &&
      SHA256.test(seal.versionReceiptSha256) &&
      SHA256.test(seal.releaseEvidenceSha256),
    "SEAL_BINDING",
    "release seal binding fields are malformed",
  );
  assert(
      seal.repository === expected.repository &&
      seal.runId === expected.runId &&
      seal.runAttempt === expected.runAttempt &&
      seal.commit === expected.commit &&
      seal.sourceRef === expected.sourceRef &&
      seal.workflowPath === expected.workflowPath &&
      seal.inputArtifact === expected.inputArtifact &&
      seal.outputArtifact === expected.outputArtifact,
    "SEAL_BINDING",
    "release seal does not match this repository, run attempt, source, workflow, commit, and artifact pair",
  );
  assert(
    seal.inputArtifact ===
      `phase09-untrusted-archives-${seal.runId}-${seal.runAttempt}-${seal.commit}`,
    "SEAL_BINDING",
    "release seal input artifact does not include the exact run and attempt identity",
  );
  assert(
    Array.isArray(seal.consumedChangesets) &&
      seal.consumedChangesets.length > 0,
    "CHANGESET_BINDING",
    "release seal has no consumed changeset identity",
  );
  const changesetPaths = new Set();
  for (const record of seal.consumedChangesets) {
    exactKeys(record, ["path", "sha256"], "CHANGESET_BINDING", "changeset record");
    assert(
      CHANGESET_PATH.test(record.path) &&
        SHA256.test(record.sha256) &&
        !changesetPaths.has(record.path),
      "CHANGESET_BINDING",
      "release seal changeset identity is malformed or duplicated",
    );
    changesetPaths.add(record.path);
  }
  exactKeys(
    seal.archives,
    PACKAGE_ORDER,
    "SEAL_SCHEMA",
    "release seal archive set",
  );
  for (const name of PACKAGE_ORDER) {
    const record = seal.archives[name];
    exactKeys(
      record,
      ["file", "sha256", "integrity"],
      "SEAL_SCHEMA",
      `${name} archive record`,
    );
    assert(
      record.file === expectedArchiveFilename(name, seal.sharedVersion) &&
        SHA256.test(record.sha256) &&
        SHA512_INTEGRITY.test(record.integrity),
      "SEAL_SCHEMA",
      `${name} sealed archive identity is malformed`,
    );
  }
  const identityDigest = sha256(stableJson(sealIdentityBody(seal)));
  assert(seal.sealId === identityDigest, "SEAL_DIGEST", "release seal ID is stale");
  assert(
    seal.outputArtifact === `phase09-sealed-release-${seal.runAttempt}-${seal.sealId}`,
    "SEAL_BINDING",
    "release seal output artifact is not content-addressed",
  );
  const { contentDigest, ...body } = seal;
  assert(
    SHA256.test(contentDigest) && contentDigest === sha256(stableJson(body)),
    "SEAL_DIGEST",
    "release seal content digest is stale",
  );
}

function inspectInputs(paths, expected) {
  assert(
    paths.length === 4,
    "CLI",
    "expected seal, core, React, and Svelte archive paths",
  );
  const [sealPath, ...archivePaths] = paths.map((path, index) =>
    exactRegularFile(path, index === 0 ? "release seal" : "archive"),
  );
  assert(
    basename(sealPath) === SEAL_FILENAME,
    "PATH",
    `release seal must be named ${SEAL_FILENAME}`,
  );
  const directory = dirname(sealPath);
  assert(
    archivePaths.every((path) => dirname(path) === directory),
    "PATH",
    "release seal and archives must share one directory",
  );
  assert(
    JSON.stringify(readdirSync(directory).sort()) ===
      JSON.stringify(paths.map((path) => basename(path)).sort()),
    "ARCHIVE_SET",
    "sealed archive directory must contain exactly the seal and three supplied archives",
  );

  let seal;
  try {
    seal = JSON.parse(readFileSync(sealPath, "utf8"));
  } catch (error) {
    fail(
      "SEAL_SCHEMA",
      `release seal is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  validateSeal(seal, expected);

  const archives = archivePaths.map((path, index) => {
    const name = PACKAGE_ORDER[index];
    const record = seal.archives[name];
    const manifest = archiveManifest(path);
    const expectedDirectory = `packages/${name.split("/").at(-1)}`;
    exactKeys(
      manifest.publishConfig,
      ["access"],
      "ARCHIVE_MANIFEST",
      `${name} publishConfig`,
    );
    exactKeys(
      manifest.repository,
      ["type", "url", "directory"],
      "ARCHIVE_MANIFEST",
      `${name} repository`,
    );
    assert(
      manifest.name === name &&
        manifest.version === seal.sharedVersion &&
        manifest.private !== true &&
        manifest.publishConfig.access === "public" &&
        manifest.repository.type === "git" &&
        manifest.repository.url === REPOSITORY_GIT_URL &&
        manifest.repository.directory === expectedDirectory &&
        basename(path) === record.file,
      "ARCHIVE_IDENTITY",
      `${basename(path)} does not contain the sealed package/publish/repository identity`,
    );
    assert(
      sha256File(path) === record.sha256 && integrityFile(path) === record.integrity,
      "ARCHIVE_DIGEST",
      `${basename(path)} differs from the independently sealed bytes`,
    );
    return Object.freeze({
      name,
      path,
      version: seal.sharedVersion,
      sha256: record.sha256,
      integrity: record.integrity,
    });
  });

  return Object.freeze({
    archives: Object.freeze(archives),
    seal,
    sealPath,
    sealSha256: sha256File(sealPath),
    version: seal.sharedVersion,
  });
}

function assertInputsUnchanged(inputs) {
  assert(
    sha256File(inputs.sealPath) === inputs.sealSha256,
    "SEAL_DIGEST",
    "release seal changed after verification",
  );
  for (const archive of inputs.archives) {
    assert(
      sha256File(archive.path) === archive.sha256 &&
        integrityFile(archive.path) === archive.integrity,
      "ARCHIVE_DIGEST",
      `${basename(archive.path)} changed after verification`,
    );
  }
}

function attestationUrl(archive, record) {
  exactKeys(
    record.dist?.attestations,
    ["url", "provenance"],
    "REGISTRY_PROVENANCE",
    `${archive.name} attestation metadata`,
  );
  exactKeys(
    record.dist.attestations.provenance,
    ["predicateType"],
    "REGISTRY_PROVENANCE",
    `${archive.name} provenance metadata`,
  );
  const expected =
    `${NPM_REGISTRY}-/npm/v1/attestations/` +
    `${archive.name.replace("/", "%2f")}@${archive.version}`;
  let parsed;
  try {
    parsed = new URL(record.dist.attestations.url);
  } catch {
    fail("REGISTRY_PROVENANCE", `${archive.name} attestation URL is invalid`);
  }
  assert(
    record.dist.attestations.url === expected && parsed.href === expected &&
      parsed.protocol === "https:" && parsed.origin === "https://registry.npmjs.org" &&
      parsed.username === "" && parsed.password === "" && parsed.port === "" &&
      parsed.search === "" && parsed.hash === "" &&
      record.dist.attestations.provenance.predicateType === PROVENANCE_PREDICATE,
    "REGISTRY_PROVENANCE",
    `${archive.name} attestation URL/origin/path/predicate is not exact npmjs metadata`,
  );
  return expected;
}

function archiveIntegrityHex(archive) {
  const encoded = archive.integrity.slice("sha512-".length);
  const bytes = Buffer.from(encoded, "base64");
  assert(
    bytes.length === 64 && bytes.toString("base64") === encoded,
    "REGISTRY_INTEGRITY",
    `${archive.name} sealed SHA-512 integrity is malformed`,
  );
  return bytes.toString("hex");
}

function validateProvenanceBundle(archive, response, seal) {
  exactKeys(response, ["attestations"], "REGISTRY_PROVENANCE", "attestation response");
  assert(Array.isArray(response.attestations), "REGISTRY_PROVENANCE", "attestations must be an array");
  const candidates = response.attestations.filter(
    (attestation) => attestation?.predicateType === PROVENANCE_PREDICATE,
  );
  assert(
    candidates.length === 1,
    "REGISTRY_PROVENANCE",
    `${archive.name} must have exactly one SLSA provenance attestation`,
  );
  const attestation = candidates[0];
  exactKeys(
    attestation,
    ["predicateType", "bundle", "signedAccessSignatureUrl"],
    "REGISTRY_PROVENANCE",
    `${archive.name} provenance attestation`,
  );
  assert(
    attestation.signedAccessSignatureUrl === "" &&
      attestation.bundle !== null && typeof attestation.bundle === "object",
    "REGISTRY_PROVENANCE",
    `${archive.name} provenance bundle is malformed`,
  );
  const envelope = attestation.bundle.dsseEnvelope;
  exactKeys(
    envelope,
    ["payload", "payloadType", "signatures"],
    "REGISTRY_PROVENANCE",
    `${archive.name} DSSE envelope`,
  );
  assert(
    envelope.payloadType === "application/vnd.in-toto+json" &&
      typeof envelope.payload === "string" && envelope.payload.length > 0 &&
      Array.isArray(envelope.signatures) && envelope.signatures.length > 0,
    "REGISTRY_PROVENANCE",
    `${archive.name} DSSE envelope is incomplete`,
  );
  const payload = Buffer.from(envelope.payload, "base64");
  assert(
    payload.length > 0 && payload.toString("base64") === envelope.payload,
    "REGISTRY_PROVENANCE",
    `${archive.name} provenance payload is not canonical base64`,
  );
  let statement;
  try {
    statement = JSON.parse(payload.toString("utf8"));
  } catch (error) {
    fail(
      "REGISTRY_PROVENANCE",
      `${archive.name} provenance statement is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  exactKeys(
    statement,
    ["_type", "subject", "predicateType", "predicate"],
    "REGISTRY_PROVENANCE",
    `${archive.name} provenance statement`,
  );
  assert(
    statement._type === "https://in-toto.io/Statement/v1" &&
      statement.predicateType === PROVENANCE_PREDICATE &&
      Array.isArray(statement.subject) && statement.subject.length === 1,
    "REGISTRY_PROVENANCE",
    `${archive.name} provenance statement type/subject/predicate drifted`,
  );
  const subject = statement.subject[0];
  exactKeys(subject, ["name", "digest"], "REGISTRY_PROVENANCE", `${archive.name} subject`);
  exactKeys(subject.digest, ["sha512"], "REGISTRY_PROVENANCE", `${archive.name} subject digest`);
  const purlName = archive.name.startsWith("@")
    ? `%40${archive.name.slice(1)}`
    : archive.name;
  assert(
    subject.name === `pkg:npm/${purlName}@${archive.version}` &&
      subject.digest.sha512 === archiveIntegrityHex(archive),
    "REGISTRY_PROVENANCE",
    `${archive.name} provenance subject identity/integrity differs from the seal`,
  );

  const definition = statement.predicate?.buildDefinition;
  const workflow = definition?.externalParameters?.workflow;
  const dependencies = definition?.resolvedDependencies;
  assert(
    definition?.buildType === GITHUB_BUILD_TYPE &&
      workflow?.repository === REPOSITORY_URL &&
      workflow?.ref === seal.sourceRef && workflow?.path === seal.workflowPath &&
      Array.isArray(dependencies) && dependencies.length === 1 &&
      dependencies[0]?.uri ===
        `git+https://github.com/${seal.repository}@${seal.sourceRef}` &&
      dependencies[0]?.digest?.gitCommit === seal.commit &&
      statement.predicate?.runDetails?.builder?.id === GITHUB_BUILDER,
    "REGISTRY_PROVENANCE",
    `${archive.name} provenance repository/ref/commit/workflow/builder differs from the seal`,
  );
  const invocationId = statement.predicate?.runDetails?.metadata?.invocationId;
  let invocation;
  try {
    invocation = new URL(invocationId);
  } catch {
    fail("REGISTRY_PROVENANCE", `${archive.name} provenance invocation URL is invalid`);
  }
  const escapedRepository = seal.repository.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const invocationPath = new RegExp(
    `^/${escapedRepository}/actions/runs/[1-9]\\d*/attempts/[1-9]\\d*$`,
    "u",
  );
  assert(
    invocation.protocol === "https:" && invocation.origin === "https://github.com" &&
      invocation.username === "" && invocation.password === "" && invocation.port === "" &&
      invocation.search === "" && invocation.hash === "" &&
      invocationPath.test(invocation.pathname),
    "REGISTRY_PROVENANCE",
    `${archive.name} provenance invocation does not name an exact GitHub workflow run`,
  );
}

async function validateRegistryRecord(archive, record, registry, seal) {
  assert(
    record !== null &&
      typeof record === "object" &&
      !Array.isArray(record) &&
      record.name === archive.name &&
      record.version === archive.version,
    "REGISTRY_IDENTITY",
    `${archive.name}@${archive.version} registry identity drifted`,
  );
  assert(
    record.dist?.integrity === archive.integrity,
    "REGISTRY_INTEGRITY",
    `${archive.name}@${archive.version} already exists with different bytes`,
  );
  const url = attestationUrl(archive, record);
  const response = await registry.fetchAttestation(url);
  validateProvenanceBundle(archive, response, seal);
}

function fetchRegistryJson(url) {
  return new Promise((resolvePromise, rejectPromise) => {
    const request = httpsGet(
      url,
      {
        headers: {
          accept: "application/json",
          "user-agent": "concierge-phase09-publisher",
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          rejectPromise(new Error(`attestation endpoint returned ${response.statusCode}`));
          return;
        }
        let source = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          source += chunk;
          if (Buffer.byteLength(source) > MAX_OUTPUT_BYTES) request.destroy(
            new Error("attestation response exceeded the bounded size"),
          );
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
    request.setTimeout(30_000, () => request.destroy(new Error("attestation fetch timed out")));
    request.on("error", rejectPromise);
  });
}

function npmConfigArguments(config) {
  return [
    `--registry=${NPM_REGISTRY}`,
    `--userconfig=${config.user}`,
    `--globalconfig=${config.global}`,
  ];
}

function productionRegistryClient(npmCli, environment, config) {
  return Object.freeze({
    query(archive) {
      const result = spawn(
        process.execPath,
        [
          npmCli,
          "view",
          `${archive.name}@${archive.version}`,
          "name",
          "version",
          "dist",
          "--json",
          ...npmConfigArguments(config),
        ],
        `query ${archive.name}@${archive.version}`,
        environment,
      );
      if (
        result.error === undefined &&
        result.signal === null &&
        result.status === 0
      ) {
        try {
          return Object.freeze({
            kind: "present",
            record: JSON.parse(result.stdout),
          });
        } catch (error) {
          fail(
            "REGISTRY_QUERY",
            `${archive.name}@${archive.version} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      if (
        result.error === undefined &&
        result.signal === null &&
        /(?:\bE404\b|\b404 Not Found\b)/u.test(result.output)
      ) {
        return Object.freeze({ kind: "missing" });
      }
      fail(
        "REGISTRY_QUERY",
        `${archive.name}@${archive.version} registry state is ambiguous: ${result.error?.message ?? result.output}`,
      );
    },
    publish(archive) {
      const result = spawn(
        process.execPath,
        [
          npmCli,
          "publish",
          archive.path,
          "--access",
          "public",
          "--provenance",
          ...npmConfigArguments(config),
        ],
        `publish ${archive.name}`,
        environment,
      );
      if (
        result.error !== undefined ||
        result.signal !== null ||
        result.status !== 0
      ) {
        throw new Error(
          `${result.label} failed: ${result.error?.message ?? result.output}`,
        );
      }
    },
    async fetchAttestation(url) {
      try {
        return await fetchRegistryJson(url);
      } catch (error) {
        fail(
          "REGISTRY_PROVENANCE",
          `npmjs attestation fetch failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  });
}

function assertSafePublisherEnvironment(environment) {
  const direct = new Set([
    "npm_token",
    "node_auth_token",
    "npm_auth_token",
    "npm_id_token",
  ]);
  for (const [name, value] of Object.entries(environment)) {
    const normalized = name.toLowerCase();
    const sensitiveConfig = normalized.startsWith("npm_config_") &&
      /(?:registry|auth|token|userconfig|globalconfig)/u.test(normalized);
    assert(
      value === undefined || value === "" || (!direct.has(normalized) && !sensitiveConfig),
      "PUBLISH_ENVIRONMENT",
      `${name} must not override npmjs registry, auth, token, or config in the OIDC publisher`,
    );
  }
}

function productionPublisher() {
  assertSafePublisherEnvironment(process.env);
  const npmCli = process.env.PHASE09_NPM_CLI;
  assert(
    typeof npmCli === "string" && npmCli.length > 0,
    "NPM_CLI",
    "PHASE09_NPM_CLI is required",
  );
  exactRegularFile(npmCli, "pinned npm CLI");
  const configRoot = mkdtempSync(join(realpathSync(tmpdir()), TEMP_PREFIX));
  const config = {
    user: join(configRoot, "user.npmrc"),
    global: join(configRoot, "global.npmrc"),
  };
  writeFileSync(config.user, "", { encoding: "utf8", flag: "wx", mode: 0o600 });
  writeFileSync(config.global, "", { encoding: "utf8", flag: "wx", mode: 0o600 });
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    const normalized = name.toLowerCase();
    if (
      ["npm_token", "node_auth_token", "npm_auth_token", "npm_id_token"].includes(normalized) ||
      (normalized.startsWith("npm_config_") &&
        /(?:registry|auth|token|userconfig|globalconfig)/u.test(normalized))
    ) delete environment[name];
  }
  environment.npm_config_registry = NPM_REGISTRY;
  environment.npm_config_userconfig = config.user;
  environment.npm_config_globalconfig = config.global;
  const version = run(
    process.execPath,
    [npmCli, "--version", ...npmConfigArguments(config)],
    "read pinned npm version",
    environment,
  ).trim();
  assert(
    version === NPM_VERSION,
    "NPM_VERSION",
    `expected npm ${NPM_VERSION}, received ${version}`,
  );
  return productionRegistryClient(npmCli, environment, config);
}

function expectedBindingsFromEnvironment() {
  const expected = {
    repository: process.env.PHASE09_EXPECTED_REPOSITORY,
    runId: process.env.PHASE09_EXPECTED_RUN_ID,
    runAttempt: Number(process.env.PHASE09_EXPECTED_RUN_ATTEMPT),
    commit: process.env.PHASE09_EXPECTED_COMMIT,
    sourceRef: process.env.PHASE09_EXPECTED_SOURCE_REF,
    workflowPath: process.env.PHASE09_EXPECTED_WORKFLOW_PATH,
    inputArtifact: process.env.PHASE09_EXPECTED_INPUT_ARTIFACT,
    outputArtifact: process.env.PHASE09_EXPECTED_SEALED_ARTIFACT,
  };
  assert(
    expected.repository === "fullselfbrowsing/concierge" &&
      RUN_ID.test(expected.runId) &&
      Number.isSafeInteger(expected.runAttempt) && expected.runAttempt > 0 &&
      COMMIT.test(expected.commit) && expected.sourceRef === SOURCE_REF &&
      expected.workflowPath === WORKFLOW_PATH &&
      ARTIFACT_NAME.test(expected.inputArtifact) && ARTIFACT_NAME.test(expected.outputArtifact),
    "SEAL_BINDING",
    "all expected repository/run/commit/artifact bindings are required",
  );
  return Object.freeze(expected);
}

async function publishCheckedArchives(paths, registry, expected) {
  const inputs = inspectInputs(paths, expected);
  const summary = { published: 0, skipped: 0 };
  for (const archive of inputs.archives) {
    assertInputsUnchanged(inputs);
    const before = registry.query(archive);
    assert(
      before?.kind === "missing" || before?.kind === "present",
      "REGISTRY_QUERY",
      `${archive.name}@${archive.version} query returned an invalid state`,
    );
    if (before.kind === "present") {
      await validateRegistryRecord(archive, before.record, registry, inputs.seal);
      summary.skipped += 1;
      continue;
    }

    let publishError = null;
    try {
      registry.publish(archive);
    } catch (error) {
      publishError = error;
    }
    assertInputsUnchanged(inputs);
    let after;
    try {
      after = registry.query(archive);
    } catch (error) {
      fail(
        "PUBLISH_AMBIGUOUS",
        `${archive.name}@${archive.version} could not be verified after publish: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (publishError !== null) {
      fail(
        "PUBLISH_AMBIGUOUS",
        `${archive.name}@${archive.version} publish result is ambiguous; rerun the complete workflow to create a new seal before resuming`,
      );
    }
    if (after?.kind === "present") {
      await validateRegistryRecord(archive, after.record, registry, inputs.seal);
      summary.published += 1;
      continue;
    }
    fail(
      "PUBLISH_AMBIGUOUS",
      `${archive.name}@${archive.version} was not visible after publish; rerun the complete workflow to create a new seal before resuming`,
    );
  }
  assertInputsUnchanged(inputs);
  return Object.freeze({ inputs, ...summary });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeSeal(root, records, overrides = {}) {
  const identity = {
    schemaVersion: 1,
    mode: "versioned",
    releaseAuthorization: true,
    repository: "fullselfbrowsing/concierge",
    runId: "123456",
    runAttempt: 1,
    commit: "a".repeat(40),
    sourceRef: SOURCE_REF,
    workflowPath: WORKFLOW_PATH,
    inputArtifact: `phase09-untrusted-archives-123456-1-${"a".repeat(40)}`,
    versionReceiptSha256: "d".repeat(64),
    releaseEvidenceSha256: "b".repeat(64),
    sharedVersion: "0.1.0",
    consumedChangesets: [
      { path: ".changeset/example.md", sha256: "c".repeat(64) },
    ],
    archives: records,
    ...overrides,
  };
  const sealId = sha256(stableJson(identity));
  const body = {
    ...identity,
    outputArtifact: `phase09-sealed-release-${identity.runAttempt}-${sealId}`,
    sealId,
  };
  const seal = { ...body, contentDigest: sha256(stableJson(body)) };
  const path = join(root, SEAL_FILENAME);
  writeJson(path, seal);
  return { path, seal };
}

function createSyntheticSet(root, overrides = {}) {
  const records = {};
  const paths = [];
  for (const name of PACKAGE_ORDER) {
    const stage = join(root, name.split("/").at(-1));
    const packageDirectory = join(stage, "package");
    mkdirSync(packageDirectory, { recursive: true });
    writeJson(join(packageDirectory, "package.json"), {
      name,
      version: overrides.archiveVersion ?? "0.1.0",
      publishConfig: overrides.publishConfig ?? { access: "public" },
      repository: overrides.repository ?? {
        type: "git",
        url: REPOSITORY_GIT_URL,
        directory: `packages/${name.split("/").at(-1)}`,
      },
    });
    const filename = expectedArchiveFilename(
      name,
      overrides.archiveVersion ?? "0.1.0",
    );
    const path = join(root, filename);
    run("tar", ["-czf", path, "-C", stage, "package"], `create ${name}`);
    records[name] = {
      file: filename,
      sha256: sha256File(path),
      integrity: integrityFile(path),
    };
    paths.push(path);
  }
  for (const name of PACKAGE_ORDER) {
    rmSync(join(root, name.split("/").at(-1)), { recursive: true });
  }
  const { path: sealPath, seal } = makeSeal(root, records, overrides.seal);
  return Object.freeze({
    paths: [sealPath, ...paths],
    seal,
    expected: Object.freeze({
      repository: seal.repository,
      runId: seal.runId,
      runAttempt: seal.runAttempt,
      commit: seal.commit,
      sourceRef: seal.sourceRef,
      workflowPath: seal.workflowPath,
      inputArtifact: seal.inputArtifact,
      outputArtifact: seal.outputArtifact,
    }),
  });
}

function registryRecord(archive, overrides = {}) {
  return {
    name: archive.name,
    version: archive.version,
    dist: {
      integrity: archive.integrity,
      attestations: {
        url: `${NPM_REGISTRY}-/npm/v1/attestations/${archive.name.replace("/", "%2f")}@${archive.version}`,
        provenance: { predicateType: PROVENANCE_PREDICATE },
      },
      ...overrides.dist,
    },
    ...overrides.record,
  };
}

function provenanceResponse(archive, seal, options = {}) {
  const statement = {
    _type: "https://in-toto.io/Statement/v1",
    subject: [
      {
        name: `pkg:npm/%40${archive.name.slice(1)}@${archive.version}`,
        digest: { sha512: archiveIntegrityHex(archive) },
      },
    ],
    predicateType: PROVENANCE_PREDICATE,
    predicate: {
      buildDefinition: {
        buildType: GITHUB_BUILD_TYPE,
        externalParameters: {
          workflow: {
            ref: seal.sourceRef,
            repository: REPOSITORY_URL,
            path: seal.workflowPath,
          },
        },
        internalParameters: { github: {} },
        resolvedDependencies: [
          {
            uri: `git+https://github.com/${seal.repository}@${seal.sourceRef}`,
            digest: { gitCommit: seal.commit },
          },
        ],
      },
      runDetails: {
        builder: { id: GITHUB_BUILDER },
        metadata: {
          invocationId:
            `https://github.com/${seal.repository}/actions/runs/999/attempts/1`,
        },
      },
    },
  };
  options.mutateStatement?.(statement);
  return {
    attestations: [
      {
        predicateType:
          options.attestationPredicateType ?? PROVENANCE_PREDICATE,
        bundle: {
          dsseEnvelope: {
            payload: Buffer.from(JSON.stringify(statement), "utf8").toString(
              "base64",
            ),
            payloadType: "application/vnd.in-toto+json",
            signatures: [{ sig: "synthetic-signature" }],
          },
        },
        signedAccessSignatureUrl: "",
      },
    ],
  };
}

function stubRegistry({ failPublish = new Set(), seal } = {}) {
  const records = new Map();
  const bundles = new Map();
  const publishes = [];
  const queries = [];
  const fetches = [];
  const client = {
    records,
    bundles,
    publishes,
    queries,
    fetches,
    failPublish,
    setPresent(archive, options = {}) {
      const record = registryRecord(archive, options.recordOverrides);
      records.set(`${archive.name}@${archive.version}`, record);
      const url = record.dist?.attestations?.url;
      if (typeof url === "string") {
        bundles.set(
          url,
          options.response ?? provenanceResponse(archive, seal, options),
        );
      }
    },
    query(archive) {
      queries.push(archive.name);
      const record = records.get(`${archive.name}@${archive.version}`);
      return record === undefined
        ? { kind: "missing" }
        : { kind: "present", record };
    },
    publish(archive) {
      publishes.push(archive.name);
      if (failPublish.has(archive.name)) {
        throw new Error(`synthetic publish failure for ${archive.name}`);
      }
      client.setPresent(archive);
    },
    async fetchAttestation(url) {
      fetches.push(url);
      assert(
        bundles.has(url),
        "REGISTRY_PROVENANCE",
        `synthetic registry has no attestation response for ${url}`,
      );
      return bundles.get(url);
    },
  };
  return client;
}

function expectFailure(label, expectedCode, operation) {
  try {
    operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(
      message.includes(`[${expectedCode}]`),
      "SELF_TEST",
      `${label} failed for the wrong reason: ${message}`,
    );
    process.stdout.write(`SELF_TEST_OK ${label} ${expectedCode}\n`);
    return;
  }
  fail("SELF_TEST", `${label} unexpectedly passed`);
}

async function expectAsyncFailure(label, expectedCode, operation) {
  try {
    await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(
      message.includes(`[${expectedCode}]`),
      "SELF_TEST",
      `${label} failed for the wrong reason: ${message}`,
    );
    process.stdout.write(`SELF_TEST_OK ${label} ${expectedCode}\n`);
    return;
  }
  fail("SELF_TEST", `${label} unexpectedly passed`);
}

async function runSelfTest() {
  let controls = 0;
  const freshRoot = mkdtempSync(join(realpathSync(tmpdir()), TEMP_PREFIX));
  try {
    const fixture = createSyntheticSet(freshRoot);
    const registry = stubRegistry({ seal: fixture.seal });
    const first = await publishCheckedArchives(
      fixture.paths,
      registry,
      fixture.expected,
    );
    assert(
      first.published === 3 &&
        first.skipped === 0 &&
        JSON.stringify(registry.publishes) === JSON.stringify(PACKAGE_ORDER),
      "SELF_TEST",
      "initial publication did not publish the exact ordered triplet",
    );
    controls += 1;
    process.stdout.write("SELF_TEST_OK initial-success PASS\n");
  } finally {
    rmSync(freshRoot, { recursive: true, force: false });
  }

  const resumeRoot = mkdtempSync(join(realpathSync(tmpdir()), TEMP_PREFIX));
  try {
    const fixture = createSyntheticSet(resumeRoot);
    const registry = stubRegistry({
      failPublish: new Set(["@fullselfbrowsing/concierge-react"]),
      seal: fixture.seal,
    });
    await expectAsyncFailure("core-success-react-failure", "PUBLISH_AMBIGUOUS", () =>
      publishCheckedArchives(fixture.paths, registry, fixture.expected),
    );
    controls += 1;
    registry.failPublish.clear();
    const rerun = await publishCheckedArchives(
      fixture.paths,
      registry,
      fixture.expected,
    );
    assert(
      rerun.skipped === 1 &&
        rerun.published === 2 &&
        JSON.stringify(registry.publishes) ===
          JSON.stringify([
            "@fullselfbrowsing/concierge",
            "@fullselfbrowsing/concierge-react",
            "@fullselfbrowsing/concierge-react",
            "@fullselfbrowsing/concierge-svelte",
          ]),
      "SELF_TEST",
      "safe rerun did not skip exact core and finish both adapters",
    );
    controls += 1;
    process.stdout.write("SELF_TEST_OK exact-safe-rerun PASS\n");

    const inspected = inspectInputs(fixture.paths, fixture.expected);
    const mismatch = stubRegistry({ seal: fixture.seal });
    mismatch.setPresent(inspected.archives[0], {
      recordOverrides: {
        dist: { integrity: `sha512-${Buffer.from("different").toString("base64")}` },
      },
    });
    await expectAsyncFailure("existing-version-byte-mismatch", "REGISTRY_INTEGRITY", () =>
      publishCheckedArchives(fixture.paths, mismatch, fixture.expected),
    );
    controls += 1;

    const noProvenance = stubRegistry({ seal: fixture.seal });
    noProvenance.setPresent(inspected.archives[0], {
      recordOverrides: { dist: { attestations: undefined } },
    });
    await expectAsyncFailure("existing-version-missing-provenance", "REGISTRY_PROVENANCE", () =>
      publishCheckedArchives(fixture.paths, noProvenance, fixture.expected),
    );
    controls += 1;

    const originalSeal = JSON.parse(readFileSync(fixture.paths[0], "utf8"));
    writeFileSync(fixture.paths[1], "coordinated substitute", "utf8");
    originalSeal.archives[PACKAGE_ORDER[0]].sha256 = sha256File(fixture.paths[1]);
    originalSeal.archives[PACKAGE_ORDER[0]].integrity = integrityFile(fixture.paths[1]);
    writeJson(fixture.paths[0], originalSeal);
    await expectAsyncFailure("coordinated-archive-manifest-substitution", "SEAL_DIGEST", () =>
      publishCheckedArchives(
        fixture.paths,
        stubRegistry({ seal: fixture.seal }),
        fixture.expected,
      ),
    );
    controls += 1;
  } finally {
    rmSync(resumeRoot, { recursive: true, force: false });
  }

  for (const [label, overrides, code] of [
    [
      "ordinary-feature-mode",
      { seal: { mode: "feature", releaseAuthorization: false } },
      "RELEASE_AUTHORIZATION",
    ],
    [
      "zero-version",
      { archiveVersion: "0.0.0", seal: { sharedVersion: "0.0.0" } },
      "RELEASE_VERSION",
    ],
    [
      "archive-version-drift",
      { archiveVersion: "0.2.0", seal: { sharedVersion: "0.1.0" } },
      "SEAL_SCHEMA",
    ],
  ]) {
    const root = mkdtempSync(join(realpathSync(tmpdir()), TEMP_PREFIX));
    try {
      const fixture = createSyntheticSet(root, overrides);
      await expectAsyncFailure(label, code, () =>
        publishCheckedArchives(
          fixture.paths,
          stubRegistry({ seal: fixture.seal }),
          fixture.expected,
        ),
      );
      controls += 1;
    } finally {
      rmSync(root, { recursive: true, force: false });
    }
  }

  const hardeningRoot = mkdtempSync(join(realpathSync(tmpdir()), TEMP_PREFIX));
  try {
    const fixture = createSyntheticSet(hardeningRoot);
    const inspected = inspectInputs(fixture.paths, fixture.expected);

    const mismatchedAttempt = { ...fixture.expected, runAttempt: 2 };
    await expectAsyncFailure("cross-attempt-seal", "SEAL_BINDING", () =>
      publishCheckedArchives(
        fixture.paths,
        stubRegistry({ seal: fixture.seal }),
        mismatchedAttempt,
      ),
    );
    controls += 1;

    const provenanceCases = [
      ["foreign-provenance-repository", (statement) => {
        statement.predicate.buildDefinition.externalParameters.workflow.repository =
          "https://github.com/attacker/repository";
      }],
      ["foreign-provenance-commit", (statement) => {
        statement.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit =
          "e".repeat(40);
      }],
      ["foreign-provenance-workflow", (statement) => {
        statement.predicate.buildDefinition.externalParameters.workflow.path =
          ".github/workflows/attacker.yml";
      }],
      ["foreign-provenance-predicate", (statement) => {
        statement.predicateType = "https://example.invalid/provenance";
      }],
      ["foreign-provenance-subject", (statement) => {
        statement.subject[0].digest.sha512 = "0".repeat(128);
      }],
    ];
    for (const [label, mutateStatement] of provenanceCases) {
      const registry = stubRegistry({ seal: fixture.seal });
      registry.setPresent(inspected.archives[0], { mutateStatement });
      await expectAsyncFailure(label, "REGISTRY_PROVENANCE", () =>
        publishCheckedArchives(fixture.paths, registry, fixture.expected),
      );
      controls += 1;
    }

    const fabricatedUrl = stubRegistry({ seal: fixture.seal });
    fabricatedUrl.setPresent(inspected.archives[0], {
      recordOverrides: {
        dist: {
          attestations: {
            url: "https://attacker.invalid/provenance",
            provenance: { predicateType: PROVENANCE_PREDICATE },
          },
        },
      },
    });
    await expectAsyncFailure("fabricated-attestation-url", "REGISTRY_PROVENANCE", () =>
      publishCheckedArchives(fixture.paths, fabricatedUrl, fixture.expected),
    );
    controls += 1;

    for (const environment of [
      { NpM_CoNfIg_ReGiStRy: "https://attacker.invalid/" },
      { NPM_ID_TOKEN: "attacker-controlled-token" },
    ]) {
      expectFailure("hostile-ambient-npm-override", "PUBLISH_ENVIRONMENT", () =>
        assertSafePublisherEnvironment(environment),
      );
      controls += 1;
    }

    assert(
      JSON.stringify(npmConfigArguments({ user: "/owned/user", global: "/owned/global" })) ===
        JSON.stringify([
          "--registry=https://registry.npmjs.org/",
          "--userconfig=/owned/user",
          "--globalconfig=/owned/global",
        ]),
      "SELF_TEST",
      "npm commands are not pinned to npmjs with owned empty config paths",
    );
    controls += 1;
    process.stdout.write("SELF_TEST_OK exact-npmjs-config PASS\n");
  } finally {
    rmSync(hardeningRoot, { recursive: true, force: false });
  }

  const hostileRoot = mkdtempSync(join(realpathSync(tmpdir()), TEMP_PREFIX));
  try {
    const fixture = createSyntheticSet(hostileRoot, {
      publishConfig: {
        access: "public",
        registry: "https://attacker.invalid/",
      },
    });
    const registry = stubRegistry({ seal: fixture.seal });
    await expectAsyncFailure("hostile-manifest-registry", "ARCHIVE_MANIFEST", () =>
      publishCheckedArchives(fixture.paths, registry, fixture.expected),
    );
    assert(
      registry.queries.length === 0 && registry.publishes.length === 0 &&
        registry.fetches.length === 0,
      "SELF_TEST",
      "hostile package metadata reached a registry client",
    );
    controls += 1;
  } finally {
    rmSync(hostileRoot, { recursive: true, force: false });
  }

  assert(controls === 20, "SELF_TEST", `expected 20 controls, ran ${controls}`);
  process.stdout.write(`PHASE09_PUBLISHER_SELF_TEST_OK controls=${controls}\n`);
}

const arguments_ = process.argv.slice(2);
if (arguments_.length === 1 && arguments_[0] === "self-test") {
  await runSelfTest();
} else if (arguments_.length >= 1 && arguments_[0] === "publish") {
  const paths = arguments_.slice(1);
  const result = await publishCheckedArchives(
    paths,
    productionPublisher(),
    expectedBindingsFromEnvironment(),
  );
  process.stdout.write(
      `PHASE09_PUBLISH_OK packages=${result.inputs.archives.length} ` +
      `version=${result.inputs.version} published=${result.published} ` +
      `skipped=${result.skipped}\n`,
  );
} else {
  fail(
    "CLI",
    "phase-09-publish-archives accepts self-test or publish plus the exact seal/core/React/Svelte paths",
  );
}
