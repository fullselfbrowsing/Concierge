#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import {
  ROOT,
  assert,
  expectedArchiveFilename,
  integrityFile,
  loadReleaseLine,
  sha256File,
} from "./config.mjs";
import {
  ARCHIVE_MANIFEST_FILENAME,
  exactDirectory,
  readArchiveManifest,
  validateArchiveDirectory,
} from "./archive.mjs";

function run(command, arguments_, label, cwd = ROOT) {
  const environment = { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" };
  for (const name of ["GITHUB_TOKEN", "GH_TOKEN", "NPM_TOKEN", "NODE_AUTH_TOKEN"]) {
    delete environment[name];
  }
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    env: environment,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 240_000,
  });
  assert(
    result.error === undefined && result.signal === null && result.status === 0,
    "PROCESS",
    `${label} failed: ${result.error?.message ?? `${result.stdout}${result.stderr}`}`,
  );
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
}

function exportDirectory(configured) {
  const directory = exactDirectory(resolve(configured), "archive export directory", { empty: true });
  const relation = relative(ROOT, directory);
  assert(
    relation.startsWith("..") && realpathSync(directory) !== ROOT,
    "EXPORT_PATH",
    "archive export directory must be outside the repository",
  );
  return directory;
}

function enumeratePacked(config, directory, version) {
  const files = readdirSync(directory).filter((entry) => entry.endsWith(".tgz"));
  assert(
    files.length === config.packages.length,
    "PACK_COUNT",
    `packing produced ${files.length} archives instead of four`,
  );
  return config.packages.map((spec) => {
    const expected = expectedArchiveFilename(spec.name, version);
    assert(files.includes(expected), "PACK_IDENTITY", `packing did not produce ${expected}`);
    const path = join(directory, expected);
    const manifest = readArchiveManifest(path);
    assert(
      manifest.name === spec.name && manifest.version === version,
      "PACK_IDENTITY",
      `${expected} contains a foreign package identity`,
    );
    return Object.freeze({
      name: spec.name,
      file: expected,
      path,
      sha256: sha256File(path),
      integrity: integrityFile(path),
    });
  });
}

function packageRelease(configuredExport) {
  const config = loadReleaseLine();
  const destination = exportDirectory(configuredExport);
  run(process.execPath, ["scripts/release/check.mjs", "release"], "release source check");
  const version = JSON.parse(
    readFileSync(join(ROOT, config.packages[0].path, "package.json"), "utf8"),
  ).version;
  const scratch = mkdtempSync(join(realpathSync(tmpdir()), "concierge-release-pack-"));
  const packed = join(scratch, "archives");
  mkdirSync(packed);
  try {
    for (const spec of config.packages) {
      run("pnpm", ["--filter", spec.name, "build"], `build ${spec.name}`);
    }
    run(
      process.execPath,
      [
        "scripts/pkg05-zero-runtime-deps.mjs",
        "packages/concierge/dist/index.js",
        "packages/concierge/package.json",
      ],
      "verify core dependency bytes",
    );
    for (const spec of config.packages) {
      run(
        "pnpm",
        ["pack", "--pack-destination", packed],
        `pack ${spec.name}`,
        join(ROOT, spec.path),
      );
    }
    const archives = enumeratePacked(config, packed, version);
    for (const archive of archives) {
      run(
        "pnpm",
        ["exec", "publint", "run", archive.path, "--strict"],
        `publint ${archive.name}`,
      );
      run(
        "pnpm",
        ["exec", "attw", archive.path, "--profile", "esm-only"],
        `ATTW ${archive.name}`,
      );
      copyFileSync(archive.path, join(destination, archive.file), 0);
    }
    const index = {
      schemaVersion: 1,
      releaseLine: config.releaseLine,
      contractVersion: config.contractVersion,
      version,
      distTag: config.distTag,
      packageSetSha256: config.sha256,
      archives: archives.map(({ name, file, sha256, integrity }) => ({
        name,
        file,
        sha256,
        integrity,
      })),
    };
    writeFileSync(
      join(destination, ARCHIVE_MANIFEST_FILENAME),
      `${JSON.stringify(index, null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    const verified = validateArchiveDirectory(config, destination);
    process.stdout.write(
      `${JSON.stringify({
        status: "passed",
        version: verified.version,
        contractVersion: config.contractVersion,
        distTag: config.distTag,
        archives: verified.archives.map(({ name, file, sha256, integrity }) => ({
          name,
          file,
          sha256,
          integrity,
        })),
      })}\n`,
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function selfTest() {
  const config = loadReleaseLine();
  const names = config.packages.map((entry) =>
    expectedArchiveFilename(entry.name, config.initialVersion));
  assert(new Set(names).size === 3, "SELF_TEST", "archive names are not unique");
  assert(
    names[2] === expectedArchiveFilename(
      "@fullselfbrowsing/concierge-svelte",
      config.initialVersion,
    ),
    "SELF_TEST",
    "release archive identity drifted",
  );
  process.stdout.write("release package self-test passed\n");
}

const command = process.argv[2];
if (command === "export") {
  assert(process.argv.length === 4, "USAGE", "export requires one directory");
  packageRelease(process.argv[3]);
} else if (command === "self-test") selfTest();
else throw new Error("usage: node scripts/release/package.mjs export <empty-absolute-directory>|self-test");
