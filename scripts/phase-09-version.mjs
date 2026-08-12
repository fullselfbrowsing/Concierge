#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
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
} from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_PACKAGES = Object.freeze([
  "@fullselfbrowsing/concierge",
  "@fullselfbrowsing/concierge-react",
  "@fullselfbrowsing/concierge-svelte",
]);
const ADAPTER_MANIFEST_PATHS = Object.freeze([
  "packages/concierge-react/package.json",
  "packages/concierge-svelte/package.json",
]);
const PRIVATE_FIXTURE_MANIFEST_PATHS = Object.freeze([
  "packages/concierge/test/fixtures/adapter-alpha/package.json",
  "packages/concierge/test/fixtures/adapter-beta/package.json",
]);
const VERSION_PATHS = Object.freeze([
  "packages/concierge/package.json",
  "packages/concierge/CHANGELOG.md",
  "packages/concierge-react/package.json",
  "packages/concierge-react/CHANGELOG.md",
  "packages/concierge-svelte/package.json",
  "packages/concierge-svelte/CHANGELOG.md",
]);
const MANIFEST_PATHS = Object.freeze([
  "packages/concierge/package.json",
  ...ADAPTER_MANIFEST_PATHS,
]);
const LOCK_PATH = "pnpm-lock.yaml";
const VERSION_RECEIPT_PATH =
  ".planning/phases/09-react-and-svelte-adapters/09-VERSION-RECEIPT.json";
const PHASE = "09-react-and-svelte-adapters";
const VERSION_ARTIFACT_FILENAME = "phase-09-version-artifact.json";
const VERSION_ARTIFACT_BLOB_DIRECTORY = "blobs";
const VERSION_ARTIFACT_REQUIRED_WRITE_PATHS = VERSION_PATHS;
const VERSION_ARTIFACT_OPTIONAL_WRITE_PATHS = Object.freeze([LOCK_PATH]);
const VERSION_RECEIPT_DIGEST_PATHS = Object.freeze([
  ...MANIFEST_PATHS,
  LOCK_PATH,
]);
const CANONICAL_CORE_PEER = "workspace:^";
const MAX_CHANGESET_BYTES = 16 * 1024;
const MAX_CHANGESET_SUMMARY_BYTES = 1_000;
const EXPECTED_REPOSITORY = "fullselfbrowsing/concierge";
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const RUN_ID = /^[1-9]\d*$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const ARTIFACT_NAME = /^[A-Za-z0-9_.-]+$/u;
const CHANGESET_PATH = /^\.changeset\/[^/]+\.md$/u;

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

function unprivilegedEnvironment() {
  const environment = { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" };
  for (const name of [
    "GITHUB_TOKEN",
    "GH_TOKEN",
    "NODE_AUTH_TOKEN",
    "NPM_TOKEN",
    "NPM_AUTH_TOKEN",
  ]) {
    delete environment[name];
  }
  return environment;
}

function runAt(cwd, command, arguments_, label, timeout = 120_000) {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    env: unprivilegedEnvironment(),
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
  });
  assert(
    result.error === undefined && result.signal === null && result.status === 0,
    "PROCESS",
    `${label} failed: ${result.error?.message ?? `${result.stdout}${result.stderr}`}`,
  );
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return result.stdout;
}

function run(command, arguments_, label, timeout) {
  return runAt(ROOT, command, arguments_, label, timeout);
}

function statusLines() {
  return run(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    "read release checkout status",
  )
    .split(/\r?\n/u)
    .filter(Boolean);
}

function validateVersionStatus(lines) {
  const observed = new Set();
  let consumedChangesets = 0;
  for (const line of lines) {
    const status = line.slice(0, 2);
    const path = line.slice(3).replace(/^"|"$/gu, "");
    assert(
      status[0] !== " " && status[0] !== "?" && status[1] === " ",
      "VERSION_STATUS",
      `version output is not fully staged: ${line}`,
    );
    if (/^\.changeset\/[^/]+\.md$/u.test(path)) {
      assert(status[0] === "D", "VERSION_STATUS", `changeset survived: ${line}`);
      consumedChangesets += 1;
    } else {
      assert(
        VERSION_PATHS.includes(path) || path === LOCK_PATH,
        "VERSION_STATUS",
        `unexpected version output: ${line}`,
      );
    }
    observed.add(path);
  }
  for (const path of VERSION_PATHS) {
    assert(observed.has(path), "VERSION_STATUS", `missing version output: ${path}`);
  }
  assert(consumedChangesets > 0, "VERSION_STATUS", "no changeset was consumed");
}

function readManifest(root, path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function writeManifest(root, path, manifest) {
  writeFileSync(resolve(root, path), `${JSON.stringify(manifest, null, 2)}\n`);
}

function assertSharedVersionAt(root) {
  const manifests = [
    "packages/concierge/package.json",
    ...ADAPTER_MANIFEST_PATHS,
  ].map((path) => readManifest(root, path));
  const versions = manifests.map((manifest) => manifest.version);
  assert(
    manifests.map((manifest) => manifest.name).join("\n") ===
      PUBLIC_PACKAGES.join("\n"),
    "VERSION_TRIPLET",
    "public package identities differ from the release triplet",
  );
  assert(
    versions.every(
      (version) =>
        version === versions[0] &&
        version !== "0.0.0" &&
        /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version),
    ),
    "VERSION_TRIPLET",
    `public versions differ: ${versions.join(", ")}`,
  );
  for (const manifest of manifests.slice(1)) {
    assert(
      manifest.peerDependencies?.[PUBLIC_PACKAGES[0]] === CANONICAL_CORE_PEER,
      "VERSION_PEER",
      `${manifest.name} must retain the fail-closed ${CANONICAL_CORE_PEER} source peer`,
    );
  }
  return versions[0];
}

function analyzeSourcePeer(sourcePeer, currentVersion) {
  if (sourcePeer === CANONICAL_CORE_PEER) {
    return Object.freeze({ sourcePeer, transitionTarget: null });
  }
  const match = /^workspace:\^(\d+\.\d+\.\d+) \|\| \^(\d+\.\d+\.\d+)$/u.exec(
    sourcePeer,
  );
  assert(match !== null, "VERSION_PEER", `adapter source peer is not bounded: ${sourcePeer}`);
  assert(
    match[1] === currentVersion,
    "VERSION_PEER",
    `transition peer does not start at current core ${currentVersion}`,
  );
  assert(
    match[1].split(".")[0] === match[2].split(".")[0] && match[1] !== match[2],
    "VERSION_PEER",
    "transition peer must stay within one major line and name a new target",
  );
  return Object.freeze({ sourcePeer, transitionTarget: match[2] });
}

function sourcePeerState(snapshot) {
  const core = readManifest(snapshot, "packages/concierge/package.json");
  const peers = [];
  for (const path of ADAPTER_MANIFEST_PATHS) {
    const manifest = readManifest(snapshot, path);
    assert(
      typeof manifest.peerDependencies?.[PUBLIC_PACKAGES[0]] === "string",
      "VERSION_PEER",
      `${path} core peer is missing`,
    );
    peers.push(manifest.peerDependencies[PUBLIC_PACKAGES[0]]);
  }
  assert(peers[0] === peers[1], "VERSION_PEER", "adapter source peers differ");
  return analyzeSourcePeer(peers[0], core.version);
}

function normalizeSnapshotPeers(snapshot, state) {
  const coreVersion = readManifest(snapshot, "packages/concierge/package.json").version;
  const adapterVersions = [];
  for (const path of ADAPTER_MANIFEST_PATHS) {
    const manifest = readManifest(snapshot, path);
    assert(
      manifest.peerDependencies?.[PUBLIC_PACKAGES[0]] === state.sourcePeer,
      "VERSION_PEER",
      `${path} transition peer changed unexpectedly`,
    );
    adapterVersions.push(manifest.version);
    manifest.peerDependencies[PUBLIC_PACKAGES[0]] = CANONICAL_CORE_PEER;
    writeManifest(snapshot, path, manifest);
  }
  assert(
    adapterVersions.every((version) => version === coreVersion),
    "VERSION_TRIPLET",
    `versioned snapshot differs: ${[coreVersion, ...adapterVersions].join(", ")}`,
  );
  if (state.transitionTarget !== null) {
    assert(
      coreVersion === state.transitionTarget,
      "VERSION_PEER",
      `transition target ${state.transitionTarget} differs from version ${coreVersion}`,
    );
  }
}

function normalizeSnapshotLockPeer(snapshot, state) {
  if (state.sourcePeer === CANONICAL_CORE_PEER) return;
  const path = resolve(snapshot, LOCK_PATH);
  const source = readFileSync(path, "utf8");
  const occurrences = source.split(state.sourcePeer).length - 1;
  if (occurrences === 0) return;
  assert(
    occurrences <= ADAPTER_MANIFEST_PATHS.length,
    "VERSION_LOCK",
    `lock peer normalization occurrence count is unbounded: ${occurrences}`,
  );
  writeFileSync(path, source.split(state.sourcePeer).join(CANONICAL_CORE_PEER));
}

function restorePrivateFixtureFormatting(snapshot, originals) {
  for (const [path, original] of originals) {
    const current = readFileSync(resolve(snapshot, path), "utf8");
    assert(
      JSON.stringify(JSON.parse(current)) === JSON.stringify(JSON.parse(original)),
      "VERSION_SNAPSHOT",
      `Changesets semantically changed private fixture ${path}`,
    );
    writeFileSync(resolve(snapshot, path), original);
  }
}

function digestFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function fingerprintTree(root, directory = root, records = new Map()) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    const path = relative(root, absolute);
    if (path === "node_modules") continue;
    if (entry.isDirectory()) {
      fingerprintTree(root, absolute, records);
    } else if (entry.isFile()) {
      records.set(path, `file:${digestFile(absolute)}`);
    } else if (entry.isSymbolicLink()) {
      records.set(path, `link:${readlinkSync(absolute)}`);
    } else {
      fail("VERSION_SNAPSHOT", `unsupported snapshot entry: ${path}`);
    }
  }
  return records;
}

function changedPaths(before, after) {
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((path) => before.get(path) !== after.get(path))
    .sort();
}

function validateSnapshotDiff(paths) {
  const consumed = paths.filter((path) => /^\.changeset\/[^/]+\.md$/u.test(path));
  const allowed = new Set([...VERSION_PATHS, LOCK_PATH, ...consumed]);
  assert(consumed.length > 0, "VERSION_SNAPSHOT", "no changeset was consumed");
  for (const path of paths) {
    assert(allowed.has(path), "VERSION_SNAPSHOT", `unexpected version output: ${path}`);
  }
  for (const path of VERSION_PATHS) {
    assert(paths.includes(path), "VERSION_SNAPSHOT", `missing version output: ${path}`);
  }
  return consumed;
}

function createVersionSnapshot() {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "concierge-phase09-version-"));
  const snapshot = join(temporaryRoot, "snapshot");
  const archive = join(temporaryRoot, "source.tar");
  mkdirSync(snapshot);
  try {
    run("git", ["archive", "--format=tar", `--output=${archive}`, "HEAD"], "archive release HEAD");
    runAt(temporaryRoot, "tar", ["-xf", archive, "-C", snapshot], "extract release HEAD");
    const before = fingerprintTree(snapshot);
    const peerState = sourcePeerState(snapshot);
    const fixtureOriginals = new Map(
      PRIVATE_FIXTURE_MANIFEST_PATHS.map((path) => [
        path,
        readFileSync(resolve(snapshot, path), "utf8"),
      ]),
    );
    const installedModules = resolve(ROOT, "node_modules");
    assert(
      lstatSync(installedModules).isDirectory(),
      "VERSION_SNAPSHOT",
      "root node_modules must be installed before versioning",
    );
    symlinkSync(installedModules, join(snapshot, "node_modules"), "dir");
    runAt(
      snapshot,
      process.execPath,
      [resolve(installedModules, "@changesets/cli/bin.js"), "version"],
      "changeset version in private snapshot",
    );
    restorePrivateFixtureFormatting(snapshot, fixtureOriginals);
    normalizeSnapshotPeers(snapshot, peerState);
    normalizeSnapshotLockPeer(snapshot, peerState);
    const version = assertSharedVersionAt(snapshot);
    const after = fingerprintTree(snapshot);
    const outputs = changedPaths(before, after);
    const consumedChangesets = validateSnapshotDiff(outputs);
    const consumedChangesetRecords = consumedChangesets.map((path) => {
      const fingerprint = before.get(path);
      assert(
        typeof fingerprint === "string" && /^file:[0-9a-f]{64}$/u.test(fingerprint),
        "VERSION_SNAPSHOT",
        `consumed changeset digest is unavailable: ${path}`,
      );
      return Object.freeze({ path, sha256: fingerprint.slice("file:".length) });
    });
    const files = new Map();
    for (const path of outputs) {
      if (!consumedChangesets.includes(path)) {
        files.set(path, readFileSync(resolve(snapshot, path)));
      }
    }
    return Object.freeze({
      version,
      sourcePeer: peerState.sourcePeer,
      outputs,
      consumedChangesets,
      consumedChangesetRecords: Object.freeze(consumedChangesetRecords),
      files,
    });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function applySnapshot(result) {
  for (const [path, contents] of result.files) {
    writeFileSync(resolve(ROOT, path), contents);
  }
  for (const path of result.consumedChangesets) {
    rmSync(resolve(ROOT, path));
  }
  const stagedPaths = [...result.files.keys(), ...result.consumedChangesets];
  run(
    "git",
    ["add", "--all", "--", ...stagedPaths],
    "stage exact private-snapshot version outputs",
  );
}

function isWithin(candidate, parent) {
  const path = relative(parent, candidate);
  return path === "" || (path !== ".." && !path.startsWith("../"));
}

function versionArtifactIdentity() {
  const runAttempt = Number(process.env.PHASE09_RUN_ATTEMPT);
  const identity = Object.freeze({
    baseSha: process.env.PHASE09_BASE_SHA,
    repository: process.env.PHASE09_REPOSITORY,
    runId: process.env.PHASE09_RUN_ID,
    runAttempt,
    artifactName: process.env.PHASE09_VERSION_ARTIFACT_NAME,
  });
  const expectedArtifactName =
    `phase09-version-${identity.runId}-${identity.runAttempt}-${identity.baseSha}`;
  assert(
    typeof identity.baseSha === "string" && COMMIT.test(identity.baseSha) &&
      identity.repository === EXPECTED_REPOSITORY && REPOSITORY.test(identity.repository) &&
      typeof identity.runId === "string" && RUN_ID.test(identity.runId) &&
      Number.isSafeInteger(identity.runAttempt) && identity.runAttempt > 0 &&
      typeof identity.artifactName === "string" && ARTIFACT_NAME.test(identity.artifactName) &&
      identity.artifactName === expectedArtifactName,
    "VERSION_ARTIFACT_BINDING",
    "base SHA, exact repository, run ID/attempt, and exact version artifact name are required",
  );
  return identity;
}

function validateArtifactDirectory(path, { empty = false } = {}) {
  assert(isAbsolute(path), "VERSION_ARTIFACT_PATH", "artifact directory must be absolute");
  assert(
    path === normalize(resolve(path)),
    "VERSION_ARTIFACT_PATH",
    "artifact directory must be normalized",
  );
  const directory = realpathSync(path);
  assert(
    directory === path && lstatSync(directory).isDirectory() && !isWithin(directory, ROOT),
    "VERSION_ARTIFACT_PATH",
    "artifact directory must be a real directory outside the repository",
  );
  if (empty) {
    assert(
      readdirSync(directory).length === 0,
      "VERSION_ARTIFACT_PATH",
      "artifact output directory must be empty",
    );
  }
  return directory;
}

function readHeadBuffer(path) {
  const result = spawnSync("git", ["show", `HEAD:${path}`], {
    cwd: ROOT,
    encoding: null,
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  if (result.error === undefined && result.signal === null && result.status === 0) {
    return result.stdout;
  }
  const exists = spawnSync("git", ["cat-file", "-e", `HEAD:${path}`], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  assert(
    exists.error === undefined && exists.signal === null && exists.status !== 0,
    "VERSION_ARTIFACT_BASE",
    `could not read base path ${path}`,
  );
  return null;
}

function readRootBuffer(path) {
  const absolute = resolve(ROOT, path);
  assert(
    absolute !== ROOT && isWithin(absolute, ROOT),
    "VERSION_ARTIFACT_PATH",
    `artifact path escaped the repository: ${path}`,
  );
  if (!existsSync(absolute)) return null;
  const metadata = lstatSync(absolute);
  assert(
    metadata.isFile() && realpathSync(absolute) === absolute,
    "VERSION_ARTIFACT_PATH",
    `artifact target is not a regular file: ${path}`,
  );
  return readFileSync(absolute);
}

function artifactBody(value) {
  return {
    schemaVersion: value.schemaVersion,
    kind: value.kind,
    baseSha: value.baseSha,
    repository: value.repository,
    runId: value.runId,
    runAttempt: value.runAttempt,
    artifactName: value.artifactName,
    sharedVersion: value.sharedVersion,
    consumedChangesets: value.consumedChangesets,
    operations: value.operations,
  };
}

function nextVersion(version, releaseType) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  assert(
    match !== null,
    "VERSION_ARTIFACT_SEMANTICS",
    `base version is not a stable semantic version: ${version}`,
  );
  const [major, minor, patch] = match.slice(1).map(Number);
  if (releaseType === "major") return `${major + 1}.0.0`;
  if (releaseType === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function parseChangeset(path, bytes) {
  assert(
    bytes !== null && bytes.length > 0 && bytes.length <= MAX_CHANGESET_BYTES,
    "VERSION_ARTIFACT_CHANGESET",
    `${path} changeset bytes are missing or unbounded`,
  );
  const text = bytes.toString("utf8");
  assert(
    !text.includes("\r") && Buffer.byteLength(text) === bytes.length,
    "VERSION_ARTIFACT_CHANGESET",
    `${path} changeset encoding is not canonical UTF-8/LF`,
  );
  const match = /^---\n((?:"[^"\n]+": (?:patch|minor|major)\n)+)---\n\n([^\n]+)\n?$/u.exec(
    text,
  );
  assert(
    match !== null && Buffer.byteLength(match[2]) <= MAX_CHANGESET_SUMMARY_BYTES,
    "VERSION_ARTIFACT_CHANGESET",
    `${path} must contain one bounded plain-text release summary`,
  );
  const releases = new Map();
  for (const line of match[1].trimEnd().split("\n")) {
    const entry = /^"([^"]+)": (patch|minor|major)$/u.exec(line);
    assert(entry !== null, "VERSION_ARTIFACT_CHANGESET", `${path} release row is malformed`);
    assert(
      PUBLIC_PACKAGES.includes(entry[1]) && !releases.has(entry[1]),
      "VERSION_ARTIFACT_CHANGESET",
      `${path} package set is malformed or duplicated`,
    );
    releases.set(entry[1], entry[2]);
  }
  assert(
    stableJson([...releases.keys()].sort()) === stableJson([...PUBLIC_PACKAGES].sort()) &&
      new Set(releases.values()).size === 1,
    "VERSION_ARTIFACT_CHANGESET",
    `${path} must version the exact fixed package triplet at one release type`,
  );
  return Object.freeze({
    path,
    releaseType: releases.values().next().value,
    summary: match[2],
  });
}

function validateManifestTransition(
  path,
  baseBytes,
  outputBytes,
  sharedVersion,
  releaseType,
) {
  let base;
  let output;
  try {
    base = JSON.parse(baseBytes.toString("utf8"));
    output = JSON.parse(outputBytes.toString("utf8"));
  } catch (error) {
    fail(
      "VERSION_ARTIFACT_SEMANTICS",
      `${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const expectedName = PUBLIC_PACKAGES[
    ["packages/concierge/package.json", ...ADAPTER_MANIFEST_PATHS].indexOf(path)
  ];
  assert(
    base.name === expectedName && output.name === expectedName &&
      output.version === sharedVersion &&
      nextVersion(base.version, releaseType) === sharedVersion,
    "VERSION_ARTIFACT_SEMANTICS",
    `${path} package identity/version drifted`,
  );
  const baseComparable = structuredClone(base);
  const outputComparable = structuredClone(output);
  delete baseComparable.version;
  delete outputComparable.version;
  if (ADAPTER_MANIFEST_PATHS.includes(path)) {
    const peerState = analyzeSourcePeer(
      baseComparable.peerDependencies?.[PUBLIC_PACKAGES[0]],
      base.version,
    );
    assert(
      outputComparable.peerDependencies?.[PUBLIC_PACKAGES[0]] ===
        CANONICAL_CORE_PEER &&
        (peerState.transitionTarget === null ||
          peerState.transitionTarget === sharedVersion),
      "VERSION_ARTIFACT_SEMANTICS",
      `${path} peer transition is not the reviewed bounded transition`,
    );
    baseComparable.peerDependencies[PUBLIC_PACKAGES[0]] = CANONICAL_CORE_PEER;
  }
  assert(
    stableJson(baseComparable) === stableJson(outputComparable),
    "VERSION_ARTIFACT_SEMANTICS",
    `${path} contains a non-version manifest change`,
  );
}

function expectedChangelogTransition(
  path,
  baseBytes,
  sharedVersion,
  changesets,
  releaseType,
) {
  const packageName = PUBLIC_PACKAGES[VERSION_PATHS.indexOf(path) >> 1];
  const header = `# ${packageName}\n`;
  const base = baseBytes === null ? header : baseBytes.toString("utf8");
  assert(
    !base.includes("\r") && base.startsWith(header) &&
      (base === header || base.slice(header.length).startsWith("\n## ")),
    "VERSION_ARTIFACT_SEMANTICS",
    `${path} base changelog shape is not bounded`,
  );
  const title = `${releaseType[0].toUpperCase()}${releaseType.slice(1)} Changes`;
  const bullets = changesets.map((changeset) => `- ${changeset.summary}`).join("\n");
  const expected =
    `${header}\n## ${sharedVersion}\n\n### ${title}\n\n${bullets}\n` +
    base.slice(header.length);
  return Buffer.from(expected);
}

function validateChangelogTransition(
  path,
  baseBytes,
  outputBytes,
  sharedVersion,
  changesets,
  releaseType,
) {
  const expected = expectedChangelogTransition(
    path,
    baseBytes,
    sharedVersion,
    changesets,
    releaseType,
  );
  assert(
    outputBytes.length <= (baseBytes?.length ?? 0) +
      changesets.reduce((total, item) => total + Buffer.byteLength(item.summary), 0) +
      512 && outputBytes.equals(expected),
    "VERSION_ARTIFACT_SEMANTICS",
    `${path} contains an arbitrary or incorrectly derived changelog delta`,
  );
}

function validateLockTransition(baseBytes, outputBytes, sourcePeer) {
  const base = baseBytes.toString("utf8");
  const occurrences = base.split(sourcePeer).length - 1;
  assert(
    sourcePeer !== CANONICAL_CORE_PEER && occurrences > 0 &&
      occurrences <= ADAPTER_MANIFEST_PATHS.length,
    "VERSION_ARTIFACT_SEMANTICS",
    "pnpm lock has no narrowly bounded peer-spec normalization",
  );
  const expected = base.split(sourcePeer).join(CANONICAL_CORE_PEER);
  assert(
    outputBytes.equals(Buffer.from(expected)),
    "VERSION_ARTIFACT_SEMANTICS",
    "pnpm lock contains a dependency or non-peer-spec change",
  );
}

function validateArtifactWritePath(path) {
  assert(
    [
      ...VERSION_ARTIFACT_REQUIRED_WRITE_PATHS,
      ...VERSION_ARTIFACT_OPTIONAL_WRITE_PATHS,
    ].includes(path),
    "VERSION_ARTIFACT_OPERATION",
    `write operation is outside the semantic-only allowlist: ${path}`,
  );
}

function validateConsumedDeletion(operation, consumedRecord, base) {
  assert(
    CHANGESET_PATH.test(operation.path) && consumedRecord !== undefined &&
      operation.sha256 === null && operation.blob === null && base !== null &&
      consumedRecord.sha256 === operation.baseSha256,
    "VERSION_ARTIFACT_OPERATION",
    `delete operation is not the exact digest-bound consumed changeset: ${operation.path}`,
  );
}

function validateVersionArtifact(
  artifactDirectory,
  expectedIdentity,
  readBase,
) {
  const directory = validateArtifactDirectory(artifactDirectory);
  const manifestPath = join(directory, VERSION_ARTIFACT_FILENAME);
  assert(
    existsSync(manifestPath) && lstatSync(manifestPath).isFile() &&
      realpathSync(manifestPath) === manifestPath,
    "VERSION_ARTIFACT_PATH",
    "version artifact manifest is missing",
  );
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(
      "VERSION_ARTIFACT_SCHEMA",
      `version artifact manifest is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  exactKeys(
    artifact,
    [
      "schemaVersion",
      "kind",
      "baseSha",
      "repository",
      "runId",
      "runAttempt",
      "artifactName",
      "sharedVersion",
      "consumedChangesets",
      "operations",
      "contentDigest",
    ],
    "VERSION_ARTIFACT_SCHEMA",
    "version artifact",
  );
  assert(
    artifact.schemaVersion === 1 && ["noop", "versioned"].includes(artifact.kind),
    "VERSION_ARTIFACT_SCHEMA",
    "version artifact identity is invalid",
  );
  assert(
    artifact.baseSha === expectedIdentity.baseSha &&
      artifact.repository === expectedIdentity.repository &&
      artifact.runId === expectedIdentity.runId &&
      artifact.runAttempt === expectedIdentity.runAttempt &&
      artifact.artifactName === expectedIdentity.artifactName,
    "VERSION_ARTIFACT_BINDING",
    "version artifact does not match this base/repository/run/attempt/name",
  );
  assert(
    SHA256.test(artifact.contentDigest) &&
      artifact.contentDigest ===
        createHash("sha256").update(stableJson(artifactBody(artifact))).digest("hex"),
    "VERSION_ARTIFACT_DIGEST",
    "version artifact manifest digest is stale",
  );
  assert(
    Array.isArray(artifact.consumedChangesets) && Array.isArray(artifact.operations),
    "VERSION_ARTIFACT_SCHEMA",
    "version artifact changesets/operations are malformed",
  );

  if (artifact.kind === "noop") {
    assert(
      artifact.sharedVersion === null &&
        artifact.consumedChangesets.length === 0 &&
        artifact.operations.length === 0 &&
        JSON.stringify(readdirSync(directory).sort()) ===
          JSON.stringify([VERSION_ARTIFACT_FILENAME]),
      "VERSION_ARTIFACT_NOOP",
      "no-op version artifact must contain only an empty manifest",
    );
    return Object.freeze({ artifact, directory, manifestPath });
  }

  assert(
    typeof artifact.sharedVersion === "string" &&
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(artifact.sharedVersion) &&
      artifact.sharedVersion !== "0.0.0",
    "VERSION_ARTIFACT_VERSION",
    "versioned artifact sharedVersion must be nonzero semantic version",
  );
  const changesetPaths = new Set();
  const changesets = [];
  for (const record of artifact.consumedChangesets) {
    exactKeys(
      record,
      ["path", "sha256"],
      "VERSION_ARTIFACT_CHANGESET",
      "consumed changeset",
    );
    assert(
      CHANGESET_PATH.test(record.path) && SHA256.test(record.sha256) &&
        !changesetPaths.has(record.path),
      "VERSION_ARTIFACT_CHANGESET",
      "consumed changeset identity is malformed or duplicated",
    );
    changesetPaths.add(record.path);
    const base = readBase(record.path);
    assert(
      base !== null && digestFileBuffer(base) === record.sha256,
      "VERSION_ARTIFACT_CHANGESET",
      `${record.path} consumed digest differs from its verified base bytes`,
    );
    changesets.push(parseChangeset(record.path, base));
  }
  assert(
    changesetPaths.size > 0,
    "VERSION_ARTIFACT_CHANGESET",
    "versioned artifact consumed no changeset",
  );
  const releaseTypes = new Set(changesets.map((changeset) => changeset.releaseType));
  assert(
    releaseTypes.size === 1,
    "VERSION_ARTIFACT_CHANGESET",
    "consumed changesets disagree on the fixed-triplet release type",
  );
  const releaseType = changesets[0].releaseType;
  const adapterBase = readBase(ADAPTER_MANIFEST_PATHS[0]);
  assert(
    adapterBase !== null,
    "VERSION_ARTIFACT_BASE",
    "adapter manifest base is missing",
  );
  const adapterBaseManifest = JSON.parse(adapterBase.toString("utf8"));
  const sourcePeer = adapterBaseManifest.peerDependencies?.[PUBLIC_PACKAGES[0]];
  analyzeSourcePeer(sourcePeer, adapterBaseManifest.version);

  const blobDirectory = join(directory, VERSION_ARTIFACT_BLOB_DIRECTORY);
  assert(
    existsSync(blobDirectory) && lstatSync(blobDirectory).isDirectory() &&
      realpathSync(blobDirectory) === blobDirectory &&
      JSON.stringify(readdirSync(directory).sort()) ===
        JSON.stringify([VERSION_ARTIFACT_BLOB_DIRECTORY, VERSION_ARTIFACT_FILENAME]),
    "VERSION_ARTIFACT_PATH",
    "versioned artifact top-level file set is not exact",
  );
  const operationPaths = new Set();
  const referencedBlobs = new Set();
  const writePaths = new Set();
  const deletePaths = new Set();
  for (const operation of artifact.operations) {
    exactKeys(
      operation,
      ["path", "action", "baseSha256", "sha256", "blob"],
      "VERSION_ARTIFACT_OPERATION",
      "version operation",
    );
    assert(
      typeof operation.path === "string" && !operationPaths.has(operation.path),
      "VERSION_ARTIFACT_OPERATION",
      "version operation path is missing or duplicated",
    );
    operationPaths.add(operation.path);
    const base = readBase(operation.path);
    assert(
      (base === null && operation.baseSha256 === null) ||
        (base !== null && SHA256.test(operation.baseSha256) &&
          digestFileBuffer(base) === operation.baseSha256),
      "VERSION_ARTIFACT_BASE",
      `base bytes drifted for ${operation.path}`,
    );
    if (operation.action === "delete") {
      validateConsumedDeletion(
        operation,
        artifact.consumedChangesets.find((record) => record.path === operation.path),
        base,
      );
      deletePaths.add(operation.path);
      continue;
    }
    validateArtifactWritePath(operation.path);
    assert(
      operation.action === "write" &&
        SHA256.test(operation.sha256) && operation.blob === operation.sha256,
      "VERSION_ARTIFACT_OPERATION",
      `write operation is outside the exact allowlist: ${operation.path}`,
    );
    const blobPath = join(blobDirectory, operation.blob);
    assert(
      existsSync(blobPath) && lstatSync(blobPath).isFile() &&
        realpathSync(blobPath) === blobPath && digestFile(blobPath) === operation.sha256,
      "VERSION_ARTIFACT_DIGEST",
      `version artifact blob is stale: ${operation.path}`,
    );
    referencedBlobs.add(operation.blob);
    writePaths.add(operation.path);
    const output = readFileSync(blobPath);
    if (MANIFEST_PATHS.includes(operation.path)) {
      assert(base !== null, "VERSION_ARTIFACT_BASE", `${operation.path} base is missing`);
      validateManifestTransition(
        operation.path,
        base,
        output,
        artifact.sharedVersion,
        releaseType,
      );
    } else if (operation.path.endsWith("/CHANGELOG.md")) {
      validateChangelogTransition(
        operation.path,
        base,
        output,
        artifact.sharedVersion,
        changesets,
        releaseType,
      );
    } else {
      assert(base !== null, "VERSION_ARTIFACT_BASE", `${LOCK_PATH} base is missing`);
      validateLockTransition(base, output, sourcePeer);
    }
  }
  assert(
    VERSION_ARTIFACT_REQUIRED_WRITE_PATHS.every((path) => writePaths.has(path)) &&
      [...writePaths].every((path) =>
        VERSION_ARTIFACT_REQUIRED_WRITE_PATHS.includes(path) ||
          VERSION_ARTIFACT_OPTIONAL_WRITE_PATHS.includes(path)) &&
      stableJson([...deletePaths].sort()) === stableJson([...changesetPaths].sort()),
    "VERSION_ARTIFACT_OPERATION",
    "version artifact does not contain the exact write/delete path set",
  );
  assert(
    stableJson(readdirSync(blobDirectory).sort()) ===
      stableJson([...referencedBlobs].sort()),
    "VERSION_ARTIFACT_PATH",
    "version artifact blob set contains an unreferenced or missing file",
  );
  return Object.freeze({ artifact, directory, manifestPath });
}

function digestFileBuffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function versionReceiptBody(value) {
  return {
    schemaVersion: value.schemaVersion,
    phase: value.phase,
    baseSha: value.baseSha,
    repository: value.repository,
    runId: value.runId,
    runAttempt: value.runAttempt,
    artifactName: value.artifactName,
    artifactDigest: value.artifactDigest,
    sharedVersion: value.sharedVersion,
    consumedChangesets: value.consumedChangesets,
    finalDigests: value.finalDigests,
  };
}

function validateVersionReceipt(receipt, prepared) {
  exactKeys(
    receipt,
    [
      "schemaVersion",
      "phase",
      "baseSha",
      "repository",
      "runId",
      "runAttempt",
      "artifactName",
      "artifactDigest",
      "sharedVersion",
      "consumedChangesets",
      "finalDigests",
      "contentDigest",
    ],
    "VERSION_RECEIPT_SCHEMA",
    "version receipt",
  );
  const artifact = prepared.artifact;
  assert(
    receipt.schemaVersion === 1 && receipt.phase === PHASE &&
      receipt.baseSha === artifact.baseSha &&
      receipt.repository === artifact.repository &&
      receipt.runId === artifact.runId &&
      receipt.runAttempt === artifact.runAttempt &&
      receipt.artifactName === artifact.artifactName &&
      receipt.artifactDigest === artifact.contentDigest &&
      receipt.sharedVersion === artifact.sharedVersion &&
      stableJson(receipt.consumedChangesets) ===
        stableJson(artifact.consumedChangesets),
    "VERSION_RECEIPT_BINDING",
    "version receipt differs from the verified semantic artifact",
  );
  exactKeys(
    receipt.finalDigests,
    VERSION_RECEIPT_DIGEST_PATHS,
    "VERSION_RECEIPT_SCHEMA",
    "version receipt final digest set",
  );
  for (const path of VERSION_RECEIPT_DIGEST_PATHS) {
    assert(
      SHA256.test(receipt.finalDigests[path]) &&
        receipt.finalDigests[path] === digestFile(resolve(ROOT, path)),
      "VERSION_RECEIPT_DIGEST",
      `version receipt final digest is stale: ${path}`,
    );
  }
  assert(
    SHA256.test(receipt.contentDigest) &&
      receipt.contentDigest === digestFileBuffer(Buffer.from(stableJson(versionReceiptBody(receipt)))),
    "VERSION_RECEIPT_DIGEST",
    "version receipt content digest is stale",
  );
}

function writeVersionReceipt(prepared) {
  const destination = resolve(ROOT, VERSION_RECEIPT_PATH);
  if (existsSync(destination)) {
    assert(
      lstatSync(destination).isFile() && realpathSync(destination) === destination,
      "VERSION_RECEIPT_PATH",
      "version receipt destination is not a regular repository file",
    );
  }
  const body = {
    schemaVersion: 1,
    phase: PHASE,
    baseSha: prepared.artifact.baseSha,
    repository: prepared.artifact.repository,
    runId: prepared.artifact.runId,
    runAttempt: prepared.artifact.runAttempt,
    artifactName: prepared.artifact.artifactName,
    artifactDigest: prepared.artifact.contentDigest,
    sharedVersion: prepared.artifact.sharedVersion,
    consumedChangesets: prepared.artifact.consumedChangesets,
    finalDigests: Object.fromEntries(
      VERSION_RECEIPT_DIGEST_PATHS.map((path) => [path, digestFile(resolve(ROOT, path))]),
    ),
  };
  const receipt = {
    ...body,
    contentDigest: digestFileBuffer(Buffer.from(stableJson(body))),
  };
  writeFileSync(destination, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  validateVersionReceipt(
    JSON.parse(readFileSync(destination, "utf8")),
    prepared,
  );
  return receipt;
}

function writeVersionArtifact(artifactDirectory, result, identity) {
  const directory = validateArtifactDirectory(artifactDirectory, { empty: true });
  const status = statusLines();
  const kind = result === null ? "noop" : "versioned";
  if (kind === "noop") {
    assert(status.length === 0, "VERSION_STATUS", "no-op preparation changed the checkout");
  }
  const operations = [];
  const writtenBlobs = new Set();
  if (kind === "versioned") {
    const blobDirectory = join(directory, VERSION_ARTIFACT_BLOB_DIRECTORY);
    mkdirSync(blobDirectory);
    for (const line of status) {
      const path = line.slice(3).replace(/^"|"$/gu, "");
      const base = readHeadBuffer(path);
      const baseSha256 = base === null ? null : digestFileBuffer(base);
      if (line[0] === "D") {
        operations.push({
          path,
          action: "delete",
          baseSha256,
          sha256: null,
          blob: null,
        });
        continue;
      }
      const bytes = readFileSync(resolve(ROOT, path));
      const digest = digestFileBuffer(bytes);
      if (!writtenBlobs.has(digest)) {
        writeFileSync(join(blobDirectory, digest), bytes, { flag: "wx" });
        writtenBlobs.add(digest);
      }
      operations.push({
        path,
        action: "write",
        baseSha256,
        sha256: digest,
        blob: digest,
      });
    }
  }
  operations.sort((left, right) => left.path.localeCompare(right.path));
  const body = {
    schemaVersion: 1,
    kind,
    ...identity,
    sharedVersion: result?.version ?? null,
    consumedChangesets: result?.consumedChangesetRecords ?? [],
    operations,
  };
  const artifact = {
    ...body,
    contentDigest: createHash("sha256").update(stableJson(body)).digest("hex"),
  };
  writeFileSync(
    join(directory, VERSION_ARTIFACT_FILENAME),
    `${JSON.stringify(artifact, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
  validateVersionArtifact(directory, identity, readHeadBuffer);
  return artifact;
}

function trackedChangesets() {
  return run("git", ["ls-files", ".changeset/*.md"], "list tracked changesets")
    .split(/\r?\n/u)
    .filter(Boolean)
    .sort();
}

function prepareVersionArtifact(artifactDirectory) {
  assert(statusLines().length === 0, "VERSION_STATUS", "prepare requires a clean checkout");
  const identity = versionArtifactIdentity();
  const head = run("git", ["rev-parse", "HEAD"], "read preparation HEAD").trim();
  assert(head === identity.baseSha, "VERSION_ARTIFACT_BINDING", "prepare HEAD differs from base SHA");
  const changesets = trackedChangesets();
  if (changesets.length === 0) {
    writeVersionArtifact(artifactDirectory, null, identity);
    process.stdout.write("PHASE09_VERSION_PREPARE_NOOP changesets=0\n");
    return;
  }
  assert(
    changesets.every((path) => CHANGESET_PATH.test(path)),
    "VERSION_ARTIFACT_CHANGESET",
    "tracked changeset path set is malformed",
  );
  const result = createVersionSnapshot();
  applySnapshot(result);
  validateVersionStatus(statusLines());
  const version = assertSharedVersionAt(ROOT);
  assert(version === result.version, "VERSION_TRIPLET", "copied version drifted");
  writeVersionArtifact(artifactDirectory, result, identity);
  process.stdout.write(
    `PHASE09_VERSION_PREPARE_OK version=${version} consumed=${result.consumedChangesets.length}\n`,
  );
}

function applyVersionArtifact(artifactDirectory) {
  const identity = versionArtifactIdentity();
  const prepared = validateVersionArtifact(
    artifactDirectory,
    identity,
    readRootBuffer,
  );
  assert(
    prepared.artifact.kind === "versioned",
    "VERSION_ARTIFACT_NOOP",
    "no-op artifact cannot be applied by the Changesets version command",
  );
  const blobDirectory = join(prepared.directory, VERSION_ARTIFACT_BLOB_DIRECTORY);
  for (const operation of prepared.artifact.operations) {
    const destination = resolve(ROOT, operation.path);
    if (operation.action === "delete") {
      rmSync(destination);
    } else {
      copyFileSync(join(blobDirectory, operation.blob), destination);
    }
  }
  const version = assertSharedVersionAt(ROOT);
  assert(
    version === prepared.artifact.sharedVersion,
    "VERSION_ARTIFACT_VERSION",
    "applied shared version drifted",
  );
  const receipt = writeVersionReceipt(prepared);
  process.stdout.write(
    `PHASE09_VERSION_APPLY_OK version=${version} operations=${prepared.artifact.operations.length} ` +
      `receipt=${VERSION_RECEIPT_PATH} receiptDigest=${receipt.contentDigest}\n`,
  );
}

function expectFailure(label, operation, expectedCode) {
  try {
    operation();
  } catch (error) {
    assert(
      error instanceof Error && error.message.includes(`[${expectedCode}]`),
      "SELF_TEST",
      `${label} failed for the wrong reason`,
    );
    process.stdout.write(`SELF_TEST_OK ${label} ${expectedCode}\n`);
    return;
  }
  fail("SELF_TEST", `${label} unexpectedly passed`);
}

function runSelfTest() {
  let controls = 0;
  const valid = [
    "M  packages/concierge/package.json",
    "A  packages/concierge/CHANGELOG.md",
    "M  packages/concierge-react/package.json",
    "A  packages/concierge-react/CHANGELOG.md",
    "M  packages/concierge-svelte/package.json",
    "A  packages/concierge-svelte/CHANGELOG.md",
    "D  .changeset/example.md",
  ];
  validateVersionStatus(valid);
  process.stdout.write("SELF_TEST_OK exact-version-output PASS\n");
  controls += 1;
  expectFailure(
    "unstaged-version-output",
    () => validateVersionStatus(valid.with(0, " M packages/concierge/package.json")),
    "VERSION_STATUS",
  );
  controls += 1;
  expectFailure(
    "unexpected-version-output",
    () => validateVersionStatus([...valid, "M  packages/concierge/src/index.ts"]),
    "VERSION_STATUS",
  );
  controls += 1;
  const transition = analyzeSourcePeer(
    "workspace:^0.0.0 || ^0.1.0",
    "0.0.0",
  );
  assert(
    transition.transitionTarget === "0.1.0",
    "SELF_TEST",
    "bounded transition target drifted",
  );
  process.stdout.write("SELF_TEST_OK bounded-transition-peer PASS\n");
  controls += 1;
  expectFailure(
    "open-ended-transition-peer",
    () => analyzeSourcePeer("workspace:>=0.0.0", "0.0.0"),
    "VERSION_PEER",
  );
  controls += 1;
  expectFailure(
    "snapshot-source-change",
    () =>
      validateSnapshotDiff([
        ...VERSION_PATHS,
        ".changeset/example.md",
        "packages/concierge/src/index.ts",
      ]),
    "VERSION_SNAPSHOT",
  );
  controls += 1;
  expectFailure(
    "missing-changeset",
    () => validateSnapshotDiff([...VERSION_PATHS]),
    "VERSION_SNAPSHOT",
  );
  controls += 1;

  const syntheticManifestBases = new Map();
  for (const path of ["packages/concierge/package.json", ...ADAPTER_MANIFEST_PATHS]) {
    const live = JSON.parse(readFileSync(resolve(ROOT, path), "utf8"));
    const baseManifest = structuredClone(live);
    baseManifest.version = "0.0.0";
    if (ADAPTER_MANIFEST_PATHS.includes(path)) {
      baseManifest.peerDependencies[PUBLIC_PACKAGES[0]] = transition.sourcePeer;
    }
    const base = Buffer.from(`${JSON.stringify(baseManifest, null, 2)}\n`);
    syntheticManifestBases.set(path, base);
    const output = structuredClone(baseManifest);
    output.version = "0.1.0";
    if (ADAPTER_MANIFEST_PATHS.includes(path)) {
      output.peerDependencies[PUBLIC_PACKAGES[0]] = CANONICAL_CORE_PEER;
    }
    validateManifestTransition(
      path,
      base,
      Buffer.from(`${JSON.stringify(output, null, 2)}\n`),
      "0.1.0",
      "minor",
    );
  }
  process.stdout.write("SELF_TEST_OK semantic-manifest-transition PASS\n");
  controls += 1;

  const corePath = "packages/concierge/package.json";
  const coreBase = syntheticManifestBases.get(corePath);
  assert(coreBase !== undefined, "SELF_TEST", "synthetic core manifest is missing");
  const injected = JSON.parse(coreBase.toString("utf8"));
  injected.version = "0.1.0";
  injected.scripts = { postinstall: "credential-exfiltration" };
  expectFailure(
    "manifest-command-injection",
    () =>
      validateManifestTransition(
        corePath,
        coreBase,
        Buffer.from(`${JSON.stringify(injected, null, 2)}\n`),
        "0.1.0",
        "minor",
      ),
    "VERSION_ARTIFACT_SEMANTICS",
  );
  controls += 1;

  const syntheticChangesetBytes = Buffer.from(
    '---\n"@fullselfbrowsing/concierge": minor\n' +
      '"@fullselfbrowsing/concierge-react": minor\n' +
      '"@fullselfbrowsing/concierge-svelte": minor\n---\n\nBounded release summary.\n',
  );
  const syntheticChangeset = parseChangeset(
    ".changeset/example.md",
    syntheticChangesetBytes,
  );
  const changelogPath = "packages/concierge/CHANGELOG.md";
  const expectedChangelog = expectedChangelogTransition(
    changelogPath,
    null,
    "0.1.0",
    [syntheticChangeset],
    "minor",
  );
  validateChangelogTransition(
    changelogPath,
    null,
    expectedChangelog,
    "0.1.0",
    [syntheticChangeset],
    "minor",
  );
  process.stdout.write("SELF_TEST_OK bounded-changelog PASS\n");
  controls += 1;
  expectFailure(
    "arbitrary-markdown",
    () =>
      validateChangelogTransition(
        changelogPath,
        null,
        Buffer.concat([expectedChangelog, Buffer.from("\n## Injected claim\n")]),
        "0.1.0",
        [syntheticChangeset],
        "minor",
      ),
    "VERSION_ARTIFACT_SEMANTICS",
  );
  controls += 1;
  expectFailure(
    "malicious-evidence-blob",
    () =>
      validateArtifactWritePath(
        ".planning/phases/09-react-and-svelte-adapters/09-RELEASE-EVIDENCE.json",
      ),
    "VERSION_ARTIFACT_OPERATION",
  );
  controls += 1;
  const syntheticLockBase = Buffer.from(
    `peer: ${transition.sourcePeer}\nunchanged: true\n`,
  );
  const syntheticLockOutput = Buffer.from(
    `peer: ${CANONICAL_CORE_PEER}\nunchanged: true\n`,
  );
  validateLockTransition(
    syntheticLockBase,
    syntheticLockOutput,
    transition.sourcePeer,
  );
  process.stdout.write("SELF_TEST_OK exact-lock-peer-normalization PASS\n");
  controls += 1;
  expectFailure(
    "lock-dependency-smuggling",
    () =>
      validateLockTransition(
        syntheticLockBase,
        Buffer.concat([syntheticLockOutput, Buffer.from("attacker: 1.0.0\n")]),
        transition.sourcePeer,
      ),
    "VERSION_ARTIFACT_SEMANTICS",
  );
  controls += 1;
  const syntheticChangesetDigest = digestFileBuffer(syntheticChangesetBytes);
  validateConsumedDeletion(
    {
      path: ".changeset/example.md",
      action: "delete",
      baseSha256: syntheticChangesetDigest,
      sha256: null,
      blob: null,
    },
    { path: ".changeset/example.md", sha256: syntheticChangesetDigest },
    syntheticChangesetBytes,
  );
  process.stdout.write("SELF_TEST_OK digest-bound-changeset-deletion PASS\n");
  controls += 1;
  expectFailure(
    "consumed-digest-mismatch",
    () =>
      validateConsumedDeletion(
        {
          path: ".changeset/example.md",
          action: "delete",
          baseSha256: syntheticChangesetDigest,
          sha256: null,
          blob: null,
        },
        { path: ".changeset/example.md", sha256: "f".repeat(64) },
        syntheticChangesetBytes,
      ),
    "VERSION_ARTIFACT_OPERATION",
  );
  controls += 1;

  const temporaryRoot = mkdtempSync(join(realpathSync(tmpdir()), "concierge-phase09-version-artifact-"));
  try {
    const identity = Object.freeze({
      baseSha: "a".repeat(40),
      repository: "fullselfbrowsing/concierge",
      runId: "123456",
      runAttempt: 1,
      artifactName: `phase09-version-123456-1-${"a".repeat(40)}`,
    });
    const body = {
      schemaVersion: 1,
      kind: "noop",
      ...identity,
      sharedVersion: null,
      consumedChangesets: [],
      operations: [],
    };
    const artifact = {
      ...body,
      contentDigest: createHash("sha256").update(stableJson(body)).digest("hex"),
    };
    writeFileSync(
      join(temporaryRoot, VERSION_ARTIFACT_FILENAME),
      `${JSON.stringify(artifact, null, 2)}\n`,
      "utf8",
    );
    const validated = validateVersionArtifact(temporaryRoot, identity, () => null);
    assert(validated.artifact.kind === "noop", "SELF_TEST", "no-op artifact drifted");
    process.stdout.write("SELF_TEST_OK exact-noop-artifact PASS\n");
    controls += 1;
    expectFailure(
      "artifact-run-binding",
      () =>
        validateVersionArtifact(
          temporaryRoot,
          { ...identity, runId: "654321" },
          () => null,
        ),
      "VERSION_ARTIFACT_BINDING",
    );
    controls += 1;
    expectFailure(
      "artifact-attempt-binding",
      () =>
        validateVersionArtifact(
          temporaryRoot,
          { ...identity, runAttempt: 2 },
          () => null,
        ),
      "VERSION_ARTIFACT_BINDING",
    );
    controls += 1;
    const attemptTwoName =
      `phase09-version-${identity.runId}-2-${identity.baseSha}`;
    assert(
      attemptTwoName !== identity.artifactName,
      "SELF_TEST",
      "rerun attempt artifact names collided",
    );
    process.stdout.write("SELF_TEST_OK rerun-attempt-artifact-isolation PASS\n");
    controls += 1;
    const missingAttempt = { ...artifact };
    delete missingAttempt.runAttempt;
    writeFileSync(
      join(temporaryRoot, VERSION_ARTIFACT_FILENAME),
      `${JSON.stringify(missingAttempt, null, 2)}\n`,
      "utf8",
    );
    expectFailure(
      "artifact-missing-attempt",
      () => validateVersionArtifact(temporaryRoot, identity, () => null),
      "VERSION_ARTIFACT_SCHEMA",
    );
    controls += 1;
    writeFileSync(
      join(temporaryRoot, VERSION_ARTIFACT_FILENAME),
      `${JSON.stringify(artifact, null, 2)}\n`,
      "utf8",
    );
    artifact.contentDigest = "0".repeat(64);
    writeFileSync(
      join(temporaryRoot, VERSION_ARTIFACT_FILENAME),
      `${JSON.stringify(artifact, null, 2)}\n`,
      "utf8",
    );
    expectFailure(
      "artifact-content-tamper",
      () => validateVersionArtifact(temporaryRoot, identity, () => null),
      "VERSION_ARTIFACT_DIGEST",
    );
    controls += 1;
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: false });
  }

  const priorToken = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "synthetic-secret";
  const childEnvironment = unprivilegedEnvironment();
  if (priorToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = priorToken;
  assert(
    childEnvironment.GITHUB_TOKEN === undefined,
    "SELF_TEST",
    "unprivileged child environment retained GITHUB_TOKEN",
  );
  process.stdout.write("SELF_TEST_OK token-stripped-from-prepare-children PASS\n");
  controls += 1;

  assert(controls === 23, "SELF_TEST", `expected twenty-three controls, ran ${controls}`);
  process.stdout.write(`PHASE09_VERSION_SELF_TEST_OK controls=${controls}\n`);
}

function simulateVersion() {
  const result = createVersionSnapshot();
  process.stdout.write(
    `PHASE09_VERSION_SIMULATION_OK version=${result.version} ` +
      `sourcePeer=${JSON.stringify(result.sourcePeer)} finalPeer=${CANONICAL_CORE_PEER} ` +
      `consumed=${result.consumedChangesets.length}\n`,
  );
}

const arguments_ = process.argv.slice(2);
if (arguments_.length === 1 && arguments_[0] === "self-test") {
  runSelfTest();
} else if (arguments_.length === 1 && arguments_[0] === "simulate") {
  simulateVersion();
} else if (arguments_.length === 2 && arguments_[0] === "prepare") {
  prepareVersionArtifact(arguments_[1]);
} else if (arguments_.length === 2 && arguments_[0] === "apply") {
  applyVersionArtifact(arguments_[1]);
} else {
  fail(
    "CLI",
    "phase-09-version accepts self-test, simulate, prepare <artifact-dir>, or apply <artifact-dir>",
  );
}
