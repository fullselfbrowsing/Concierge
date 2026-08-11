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
const SHA256 = /^[0-9a-f]{64}$/u;
const TEMP_PREFIX = "concierge-phase09-publisher-";
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

function fail(code, message) {
  throw new Error(`[${code}] ${message}`);
}

function assert(condition, code, message) {
  if (!condition) fail(code, message);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function run(command, arguments_, label) {
  const result = spawnSync(command, arguments_, {
    encoding: "utf8",
    maxBuffer: MAX_OUTPUT_BYTES,
    timeout: 120_000,
  });
  assert(
    result.error === undefined &&
      result.signal === null &&
      result.status === 0,
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

function inspectInputs(paths) {
  assert(paths.length === 4, "CLI", "expected manifest, core, React, and Svelte paths");
  const [manifestPath, ...archivePaths] = paths.map((path, index) =>
    exactRegularFile(path, index === 0 ? "digest manifest" : "archive"),
  );
  const directory = dirname(manifestPath);
  assert(
    archivePaths.every((path) => dirname(path) === directory),
    "PATH",
    "manifest and archives must share one directory",
  );
  assert(
    JSON.stringify(readdirSync(directory).sort()) ===
      JSON.stringify(paths.map((path) => basename(path)).sort()),
    "ARCHIVE_SET",
    "archive directory must contain exactly the manifest and three supplied archives",
  );

  let digestManifest;
  try {
    digestManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(
      "DIGEST_MANIFEST",
      `digest manifest is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  assert(
    digestManifest.schemaVersion === 1 &&
      digestManifest.algorithm === "sha256" &&
      digestManifest.archives !== null &&
      typeof digestManifest.archives === "object" &&
      !Array.isArray(digestManifest.archives) &&
      JSON.stringify(Object.keys(digestManifest.archives).sort()) ===
        JSON.stringify([...PACKAGE_ORDER].sort()),
    "DIGEST_MANIFEST",
    "digest manifest identity or package set is invalid",
  );

  let sharedVersion = null;
  const archives = archivePaths.map((path, index) => {
    const name = PACKAGE_ORDER[index];
    const record = digestManifest.archives[name];
    const manifest = archiveManifest(path);
    assert(
      record !== null &&
        typeof record === "object" &&
        !Array.isArray(record) &&
        JSON.stringify(Object.keys(record).sort()) ===
          JSON.stringify(["file", "sha256"]) &&
        record.file === basename(path) &&
        SHA256.test(record.sha256),
      "DIGEST_MANIFEST",
      `${name} digest record is invalid or mapped to the wrong path`,
    );
    assert(
      manifest.name === name &&
        typeof manifest.version === "string" &&
        /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(manifest.version) &&
        manifest.private !== true &&
        basename(path) === expectedArchiveFilename(name, manifest.version),
      "ARCHIVE_IDENTITY",
      `${basename(path)} does not contain the expected publishable package identity`,
    );
    if (sharedVersion === null) sharedVersion = manifest.version;
    assert(
      manifest.version === sharedVersion,
      "ARCHIVE_VERSION",
      `${name} version ${manifest.version} differs from ${sharedVersion}`,
    );
    assert(
      sha256File(path) === record.sha256,
      "ARCHIVE_DIGEST",
      `${basename(path)} digest differs from the checked manifest`,
    );
    return Object.freeze({ name, path, sha256: record.sha256 });
  });

  return Object.freeze({
    archives: Object.freeze(archives),
    manifestPath,
    manifestSha256: sha256File(manifestPath),
    version: sharedVersion,
  });
}

function assertInputsUnchanged(inputs) {
  assert(
    sha256File(inputs.manifestPath) === inputs.manifestSha256,
    "MANIFEST_DIGEST",
    "digest manifest changed after verification",
  );
  for (const archive of inputs.archives) {
    assert(
      sha256File(archive.path) === archive.sha256,
      "ARCHIVE_DIGEST",
      `${basename(archive.path)} changed after verification`,
    );
  }
}

function productionPublisher() {
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

  return (archive) => {
    run(
      process.execPath,
      [npmCli, "publish", "--access", "public", archive.path],
      `publish ${archive.name}`,
    );
  };
}

function publishCheckedArchives(paths, publish) {
  const inputs = inspectInputs(paths);
  for (const archive of inputs.archives) {
    assertInputsUnchanged(inputs);
    publish(archive);
  }
  assertInputsUnchanged(inputs);
  return inputs;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createSyntheticSet(root) {
  const records = {};
  const paths = [];
  for (const name of PACKAGE_ORDER) {
    const stage = join(root, name.split("/").at(-1));
    const packageDirectory = join(stage, "package");
    mkdirSync(packageDirectory, { recursive: true });
    writeJson(join(packageDirectory, "package.json"), {
      name,
      version: "0.1.0",
    });
    const filename = expectedArchiveFilename(name, "0.1.0");
    const path = join(root, filename);
    run("tar", ["-czf", path, "-C", stage, "package"], `create ${name}`);
    records[name] = { file: filename, sha256: sha256File(path) };
    paths.push(path);
  }
  const manifestPath = join(root, "phase-09-archive-digests.json");
  writeJson(manifestPath, {
    schemaVersion: 1,
    algorithm: "sha256",
    archives: records,
  });
  for (const name of PACKAGE_ORDER) {
    rmSync(join(root, name.split("/").at(-1)), { recursive: true });
  }
  return [manifestPath, ...paths];
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
  const root = mkdtempSync(join(realpathSync(tmpdir()), TEMP_PREFIX));
  try {
    const paths = createSyntheticSet(root);
    const published = [];
    const inputs = publishCheckedArchives(paths, (archive) => {
      published.push(Object.freeze({ name: archive.name, path: archive.path }));
    });
    assert(
      JSON.stringify(published.map((entry) => entry.name)) ===
        JSON.stringify(PACKAGE_ORDER) &&
        published.every((entry, index) => entry.path === paths[index + 1]) &&
        inputs.version === "0.1.0",
      "SELF_TEST",
      "publisher did not preserve exact paths, order, and shared version",
    );
    process.stdout.write("SELF_TEST_OK exact-path-order PASS\n");

    expectFailure("archive-tamper", "ARCHIVE_DIGEST", () => {
      let calls = 0;
      publishCheckedArchives(paths, () => {
        calls += 1;
        if (calls === 1) writeFileSync(paths[3], "tampered", "utf8");
      });
    });
  } finally {
    assert(
      existsSync(root) && dirname(root) === realpathSync(tmpdir()),
      "SELF_TEST",
      "publisher scratch root escaped the system temp directory",
    );
    rmSync(root, { recursive: true, force: false });
  }
  process.stdout.write("PHASE09_PUBLISHER_SELF_TEST_OK controls=2\n");
}

const arguments_ = process.argv.slice(2);
if (arguments_.length === 1 && arguments_[0] === "self-test") {
  runSelfTest();
} else {
  const inputs = publishCheckedArchives(arguments_, productionPublisher());
  process.stdout.write(
    `PHASE09_PUBLISH_OK packages=${inputs.archives.length} version=${inputs.version}\n`,
  );
}
