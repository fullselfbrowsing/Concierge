#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
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
const GENERATED_EVIDENCE_PATHS = Object.freeze([
  ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json",
  ".planning/phases/09-react-and-svelte-adapters/09-RELEASE-EVIDENCE.json",
  ".planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md",
  ".planning/phases/09-react-and-svelte-adapters/09-SECURITY.md",
]);
const CANONICAL_CORE_PEER = "workspace:^";
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

function fail(code, message) {
  throw new Error(`[${code}] ${message}`);
}

function assert(condition, code, message) {
  if (!condition) fail(code, message);
}

function runAt(cwd, command, arguments_, label, timeout = 120_000) {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" },
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

function validateVersionStatus(lines, { includeEvidence = false } = {}) {
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
        VERSION_PATHS.includes(path) ||
          path === "pnpm-lock.yaml" ||
          (includeEvidence && GENERATED_EVIDENCE_PATHS.includes(path)),
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
  if (includeEvidence) {
    for (const path of GENERATED_EVIDENCE_PATHS) {
      assert(observed.has(path), "VERSION_STATUS", `missing fresh evidence: ${path}`);
    }
  }
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
  const allowed = new Set([...VERSION_PATHS, "pnpm-lock.yaml", ...consumed]);
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
    const version = assertSharedVersionAt(snapshot);
    const after = fingerprintTree(snapshot);
    const outputs = changedPaths(before, after);
    const consumedChangesets = validateSnapshotDiff(outputs);
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
  expectFailure(
    "unstaged-version-output",
    () => validateVersionStatus(valid.with(0, " M packages/concierge/package.json")),
    "VERSION_STATUS",
  );
  expectFailure(
    "unexpected-version-output",
    () => validateVersionStatus([...valid, "M  packages/concierge/src/index.ts"]),
    "VERSION_STATUS",
  );
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
  expectFailure(
    "open-ended-transition-peer",
    () => analyzeSourcePeer("workspace:>=0.0.0", "0.0.0"),
    "VERSION_PEER",
  );
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
  expectFailure(
    "missing-changeset",
    () => validateSnapshotDiff([...VERSION_PATHS]),
    "VERSION_SNAPSHOT",
  );
  process.stdout.write("PHASE09_VERSION_SELF_TEST_OK controls=7\n");
}

function simulateVersion() {
  const result = createVersionSnapshot();
  process.stdout.write(
    `PHASE09_VERSION_SIMULATION_OK version=${result.version} ` +
      `sourcePeer=${JSON.stringify(result.sourcePeer)} finalPeer=${CANONICAL_CORE_PEER} ` +
      `consumed=${result.consumedChangesets.length}\n`,
  );
}

function versionPackages() {
  assert(
    statusLines().length === 0,
    "VERSION_STATUS",
    "version command requires a clean checkout",
  );
  const result = createVersionSnapshot();
  applySnapshot(result);
  validateVersionStatus(statusLines());
  const version = assertSharedVersionAt(ROOT);
  assert(version === result.version, "VERSION_TRIPLET", "copied version drifted");
  run(
    "node",
    ["scripts/phase-09-mutation-battery.mjs", "run", "versioned", "--jobs", "2"],
    "fresh versioned Phase 09 evidence",
    2 * 60 * 60 * 1000,
  );
  run(
    "git",
    ["add", "--all", "--", ...GENERATED_EVIDENCE_PATHS],
    "stage fresh Phase 09 evidence",
  );
  validateVersionStatus(statusLines(), { includeEvidence: true });
  process.stdout.write(`PHASE09_VERSION_OK version=${version}\n`);
}

const arguments_ = process.argv.slice(2);
if (arguments_.length === 1 && arguments_[0] === "self-test") {
  runSelfTest();
} else if (arguments_.length === 1 && arguments_[0] === "simulate") {
  simulateVersion();
} else if (arguments_.length === 0) {
  versionPackages();
} else {
  fail("CLI", "phase-09-version accepts no arguments, self-test, or simulate");
}
