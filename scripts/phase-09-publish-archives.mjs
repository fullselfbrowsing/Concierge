#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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

function spawn(command, arguments_, label) {
  const result = spawnSync(command, arguments_, {
    encoding: "utf8",
    maxBuffer: MAX_OUTPUT_BYTES,
    timeout: 120_000,
  });
  return Object.freeze({
    ...result,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    label,
  });
}

function run(command, arguments_, label) {
  const result = spawn(command, arguments_, label);
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
    commit: seal.commit,
    inputArtifact: seal.inputArtifact,
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
      "commit",
      "inputArtifact",
      "outputArtifact",
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
      COMMIT.test(seal.commit) &&
      ARTIFACT_NAME.test(seal.inputArtifact) &&
      ARTIFACT_NAME.test(seal.outputArtifact) &&
      SHA256.test(seal.releaseEvidenceSha256),
    "SEAL_BINDING",
    "release seal binding fields are malformed",
  );
  assert(
    seal.repository === expected.repository &&
      seal.runId === expected.runId &&
      seal.commit === expected.commit &&
      seal.inputArtifact === expected.inputArtifact &&
      seal.outputArtifact === expected.outputArtifact,
    "SEAL_BINDING",
    "release seal does not match this repository, run, commit, and artifact pair",
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
    seal.outputArtifact === `phase09-sealed-release-${seal.sealId}`,
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
    assert(
      manifest.name === name &&
        manifest.version === seal.sharedVersion &&
        manifest.private !== true &&
        basename(path) === record.file,
      "ARCHIVE_IDENTITY",
      `${basename(path)} does not contain the sealed publishable package identity`,
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

function hasTrustedProvenance(record) {
  return (
    typeof record.dist?.attestations?.url === "string" &&
    record.dist.attestations.url.startsWith(
      "https://registry.npmjs.org/-/npm/v1/attestations/",
    ) &&
    record.dist.attestations.provenance?.predicateType ===
      PROVENANCE_PREDICATE
  );
}

function validateRegistryRecord(archive, record) {
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
  assert(
    hasTrustedProvenance(record),
    "REGISTRY_PROVENANCE",
    `${archive.name}@${archive.version} is missing trusted provenance metadata`,
  );
}

function productionRegistryClient(npmCli) {
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
        ],
        `query ${archive.name}@${archive.version}`,
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
        ],
        `publish ${archive.name}`,
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
  });
}

function productionPublisher() {
  for (const name of [
    "NPM_TOKEN",
    "NODE_AUTH_TOKEN",
    "NPM_AUTH_TOKEN",
    "npm_config__auth",
    "npm_config__authToken",
  ]) {
    assert(
      process.env[name] === undefined || process.env[name] === "",
      "TOKEN_LEAK",
      `${name} must not be present in the OIDC publisher`,
    );
  }
  const npmCli = process.env.PHASE09_NPM_CLI;
  assert(
    typeof npmCli === "string" && npmCli.length > 0,
    "NPM_CLI",
    "PHASE09_NPM_CLI is required",
  );
  exactRegularFile(npmCli, "pinned npm CLI");
  const version = run(
    process.execPath,
    [npmCli, "--version"],
    "read pinned npm version",
  ).trim();
  assert(
    version === NPM_VERSION,
    "NPM_VERSION",
    `expected npm ${NPM_VERSION}, received ${version}`,
  );
  return productionRegistryClient(npmCli);
}

function expectedBindingsFromEnvironment() {
  const expected = {
    repository: process.env.PHASE09_EXPECTED_REPOSITORY,
    runId: process.env.PHASE09_EXPECTED_RUN_ID,
    commit: process.env.PHASE09_EXPECTED_COMMIT,
    inputArtifact: process.env.PHASE09_EXPECTED_INPUT_ARTIFACT,
    outputArtifact: process.env.PHASE09_EXPECTED_SEALED_ARTIFACT,
  };
  assert(
    Object.values(expected).every(
      (value) => typeof value === "string" && value.length > 0,
    ),
    "SEAL_BINDING",
    "all expected repository/run/commit/artifact bindings are required",
  );
  return Object.freeze(expected);
}

function publishCheckedArchives(paths, registry, expected) {
  const inputs = inspectInputs(paths, expected);
  const summary = { published: 0, skipped: 0, recovered: 0 };
  for (const archive of inputs.archives) {
    assertInputsUnchanged(inputs);
    const before = registry.query(archive);
    assert(
      before?.kind === "missing" || before?.kind === "present",
      "REGISTRY_QUERY",
      `${archive.name}@${archive.version} query returned an invalid state`,
    );
    if (before.kind === "present") {
      validateRegistryRecord(archive, before.record);
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
    if (after?.kind === "present") {
      validateRegistryRecord(archive, after.record);
      if (publishError === null) summary.published += 1;
      else summary.recovered += 1;
      continue;
    }
    if (publishError !== null) {
      fail(
        "PUBLISH_AMBIGUOUS",
        `${archive.name}@${archive.version} publish failed and the exact release is absent: ${publishError instanceof Error ? publishError.message : String(publishError)}`,
      );
    }
    fail(
      "REGISTRY_VERIFY",
      `${archive.name}@${archive.version} was not visible with exact integrity and provenance after publish`,
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
    commit: "a".repeat(40),
    inputArtifact: `phase09-untrusted-archives-123456-${"a".repeat(40)}`,
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
    outputArtifact: `phase09-sealed-release-${sealId}`,
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
      commit: seal.commit,
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
        url: `https://registry.npmjs.org/-/npm/v1/attestations/${encodeURIComponent(archive.name)}@${archive.version}`,
        provenance: { predicateType: PROVENANCE_PREDICATE },
      },
      ...overrides.dist,
    },
    ...overrides.record,
  };
}

function stubRegistry({ failPublish = new Set() } = {}) {
  const records = new Map();
  const publishes = [];
  return {
    records,
    publishes,
    failPublish,
    query(archive) {
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
      records.set(
        `${archive.name}@${archive.version}`,
        registryRecord(archive),
      );
    },
  };
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

function runSelfTest() {
  let controls = 0;
  const freshRoot = mkdtempSync(join(realpathSync(tmpdir()), TEMP_PREFIX));
  try {
    const fixture = createSyntheticSet(freshRoot);
    const registry = stubRegistry();
    const first = publishCheckedArchives(
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
    });
    expectFailure("core-success-react-failure", "PUBLISH_AMBIGUOUS", () =>
      publishCheckedArchives(fixture.paths, registry, fixture.expected),
    );
    controls += 1;
    registry.failPublish.clear();
    const rerun = publishCheckedArchives(
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
    const mismatch = stubRegistry();
    mismatch.records.set(
      `${inspected.archives[0].name}@${inspected.archives[0].version}`,
      registryRecord(inspected.archives[0], {
        dist: { integrity: `sha512-${Buffer.from("different").toString("base64")}` },
      }),
    );
    expectFailure("existing-version-byte-mismatch", "REGISTRY_INTEGRITY", () =>
      publishCheckedArchives(fixture.paths, mismatch, fixture.expected),
    );
    controls += 1;

    const noProvenance = stubRegistry();
    noProvenance.records.set(
      `${inspected.archives[0].name}@${inspected.archives[0].version}`,
      registryRecord(inspected.archives[0], { dist: { attestations: undefined } }),
    );
    expectFailure("existing-version-missing-provenance", "REGISTRY_PROVENANCE", () =>
      publishCheckedArchives(fixture.paths, noProvenance, fixture.expected),
    );
    controls += 1;

    const originalSeal = JSON.parse(readFileSync(fixture.paths[0], "utf8"));
    writeFileSync(fixture.paths[1], "coordinated substitute", "utf8");
    originalSeal.archives[PACKAGE_ORDER[0]].sha256 = sha256File(fixture.paths[1]);
    originalSeal.archives[PACKAGE_ORDER[0]].integrity = integrityFile(fixture.paths[1]);
    writeJson(fixture.paths[0], originalSeal);
    expectFailure("coordinated-archive-manifest-substitution", "SEAL_DIGEST", () =>
      publishCheckedArchives(fixture.paths, stubRegistry(), fixture.expected),
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
      expectFailure(label, code, () =>
        publishCheckedArchives(fixture.paths, stubRegistry(), fixture.expected),
      );
      controls += 1;
    } finally {
      rmSync(root, { recursive: true, force: false });
    }
  }

  assert(controls === 9, "SELF_TEST", `expected nine controls, ran ${controls}`);
  process.stdout.write(`PHASE09_PUBLISHER_SELF_TEST_OK controls=${controls}\n`);
}

const arguments_ = process.argv.slice(2);
if (arguments_.length === 1 && arguments_[0] === "self-test") {
  runSelfTest();
} else if (arguments_.length >= 1 && arguments_[0] === "publish") {
  const paths = arguments_.slice(1);
  const result = publishCheckedArchives(
    paths,
    productionPublisher(),
    expectedBindingsFromEnvironment(),
  );
  process.stdout.write(
    `PHASE09_PUBLISH_OK packages=${result.inputs.archives.length} ` +
      `version=${result.inputs.version} published=${result.published} ` +
      `skipped=${result.skipped} recovered=${result.recovered}\n`,
  );
} else {
  fail(
    "CLI",
    "phase-09-publish-archives accepts self-test or publish plus the exact seal/core/React/Svelte paths",
  );
}
