import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, isAbsolute, join, normalize, resolve } from "node:path";
import {
  assert,
  exactKeys,
  exactRegularFile,
  expectedArchiveFilename,
  integrityFile,
  isReleaseLineVersion,
  sha256File,
} from "./config.mjs";

export const ARCHIVE_MANIFEST_FILENAME = "release-archives.json";
const SHA256 = /^[0-9a-f]{64}$/u;
const SHA512 = /^sha512-[A-Za-z0-9+/]+={0,2}$/u;

function tar(arguments_, label) {
  const result = spawnSync("tar", arguments_, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30_000,
  });
  assert(
    result.error === undefined && result.signal === null && result.status === 0,
    "ARCHIVE_TAR",
    `${label} failed: ${result.error?.message ?? result.stderr}`,
  );
  return result.stdout;
}

export function exactDirectory(path, label, { empty = false } = {}) {
  assert(isAbsolute(path), "PATH", `${label} must be absolute`);
  assert(path === normalize(resolve(path)), "PATH", `${label} must be normalized`);
  const metadata = lstatSync(path);
  assert(
    metadata.isDirectory() && realpathSync(path) === path,
    "PATH",
    `${label} must be a real directory, not a symlink`,
  );
  if (empty) assert(readdirSync(path).length === 0, "PATH", `${label} must be empty`);
  return path;
}

export function readArchiveManifest(path) {
  const source = tar(["-xOzf", path, "package/package.json"], `read ${basename(path)} manifest`);
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(
      `[ARCHIVE_MANIFEST] ${basename(path)} package manifest is invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function archiveEntries(path) {
  return tar(["-tzf", path], `list ${basename(path)}`)
    .split(/\r?\n/u)
    .filter(Boolean);
}

function archiveSource(path, entry) {
  return tar(["-xOzf", path, entry], `read ${basename(path)} ${entry}`);
}

function validateRuntimeExternalization(config, spec, path, entries) {
  const javascriptEntries = entries.filter(
    (entry) => /^package\/dist\/.*\.js$/u.test(entry),
  );
  assert(
    javascriptEntries.length > 0,
    "ARCHIVE_RUNTIME",
    `${spec.name} archive contains no runtime JavaScript`,
  );
  const source = javascriptEntries
    .map((entry) => archiveSource(path, entry))
    .join("\n");
  const importsPeer = (name) =>
    source.includes(`from "${name}"`) || source.includes(`from '${name}'`);

  if (spec.requiresCore) {
    assert(
      importsPeer(config.packages[0].name) &&
        !source.includes('Symbol.for("@fullselfbrowsing/concierge.contract")') &&
        !source.includes("function createConcierge("),
      "ARCHIVE_PEER_BUNDLE",
      `${spec.name} must import core as a peer without bundling a core copy`,
    );
  }
  if (spec.role === "core") {
    assert(
      importsPeer("ai") && !source.includes("function streamText(") &&
        !source.includes("function generateText("),
      "ARCHIVE_PEER_BUNDLE",
      "AI SDK must remain an external optional peer rather than a bundled copy",
    );
  } else if (spec.role === "react") {
    assert(importsPeer("react"), "ARCHIVE_PEER_BUNDLE", "React must remain external");
  } else if (spec.role === "svelte") {
    assert(importsPeer("svelte"), "ARCHIVE_PEER_BUNDLE", "Svelte must remain external");
  }
}

function collectExportTargets(manifest) {
  const targets = new Set();
  const visit = (value) => {
    if (typeof value === "string" && value.startsWith("./")) {
      targets.add(`package/${value.slice(2)}`);
    } else if (value !== null && typeof value === "object") {
      for (const child of Object.values(value)) visit(child);
    }
  };
  for (const field of [manifest.main, manifest.types, manifest.svelte, manifest.exports]) {
    visit(field);
  }
  return targets;
}

function validatePackedManifest(config, spec, manifest, version) {
  assert(
    manifest.name === spec.name && manifest.version === version,
    "ARCHIVE_IDENTITY",
    `${spec.name} archive identity differs from the release set`,
  );
  assert(
    manifest.type === "module" && manifest.sideEffects === false &&
      manifest.engines?.node === config.node.consumerEngine,
    "ARCHIVE_FORMAT",
    `${spec.name} packed format or Node engine drifted`,
  );
  assert(
    manifest.publishConfig?.access === "public" &&
      manifest.publishConfig?.tag === config.distTag &&
      Object.keys(manifest.publishConfig).length === 2,
    "ARCHIVE_DESTINATION",
    `${spec.name} packed publish destination drifted`,
  );
  assert(
    manifest.repository?.type === "git" &&
      manifest.repository?.url === config.repositoryUrl &&
      manifest.repository?.directory === spec.path,
    "ARCHIVE_REPOSITORY",
    `${spec.name} packed repository identity drifted`,
  );
  if (spec.requiresCore) {
    assert(
      manifest.peerDependencies?.[config.packages[0].name] === `^${version}` &&
        manifest.dependencies?.[config.packages[0].name] === undefined,
      "ARCHIVE_CORE_PEER",
      `${spec.name} must pack an exact-line ^${version} core peer`,
    );
  }
  if (spec.role === "core") {
    assert(
      manifest.peerDependencies?.ai === config.compatibility.ai &&
        manifest.peerDependenciesMeta?.ai?.optional === true &&
        manifest.dependencies?.ai === undefined,
      "ARCHIVE_AI_PEER",
      "Core's packed optional AI SDK peer range drifted",
    );
  }
}

function validateArchive(config, spec, record, directory, version) {
  exactKeys(
    record,
    ["name", "file", "sha256", "integrity"],
    "ARCHIVE_INDEX",
    `${spec.name} archive record`,
  );
  const expectedFile = expectedArchiveFilename(spec.name, version);
  assert(
    record.name === spec.name && record.file === expectedFile &&
      SHA256.test(record.sha256) && SHA512.test(record.integrity),
    "ARCHIVE_INDEX",
    `${spec.name} archive record identity drifted`,
  );
  const path = exactRegularFile(join(directory, record.file), `${spec.name} archive`);
  assert(
    sha256File(path) === record.sha256 && integrityFile(path) === record.integrity,
    "ARCHIVE_DIGEST",
    `${spec.name} archive bytes differ from the digest manifest`,
  );
  const manifest = readArchiveManifest(path);
  validatePackedManifest(config, spec, manifest, version);
  const entries = archiveEntries(path);
  const entrySet = new Set(entries.map((entry) => entry.replace(/\/$/u, "")));
  for (const entry of entries) {
    assert(
      entry.startsWith("package/") && !entry.startsWith("/") &&
        !entry.split("/").includes(".."),
      "ARCHIVE_ENTRY",
      `${spec.name} contains an unsafe tar entry: ${entry}`,
    );
    assert(
      !/(?:^|\/)(?:node_modules|__tests__|fixtures|test|tests)(?:\/|$)|\.(?:spec|test)\.[^/]+$/iu.test(
        entry,
      ),
      "ARCHIVE_PRIVATE",
      `${spec.name} contains private or bundled material: ${entry}`,
    );
  }
  for (const target of collectExportTargets(manifest)) {
    assert(
      entrySet.has(target),
      "ARCHIVE_EXPORT",
      `${spec.name} is missing exported target ${target}`,
    );
  }
  validateRuntimeExternalization(config, spec, path, entries);
  return Object.freeze({ ...record, path, manifest, entries: entries.length });
}

export function validateArchiveDirectory(config, configuredDirectory) {
  const directory = exactDirectory(resolve(configuredDirectory), "archive directory");
  const indexPath = exactRegularFile(
    join(directory, ARCHIVE_MANIFEST_FILENAME),
    "archive digest manifest",
  );
  let index;
  try {
    index = JSON.parse(readFileSync(indexPath, "utf8"));
  } catch (error) {
    throw new Error(
      `[ARCHIVE_INDEX] archive digest manifest is invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  exactKeys(
    index,
    [
      "schemaVersion",
      "releaseLine",
      "contractVersion",
      "version",
      "distTag",
      "packageSetSha256",
      "archives",
    ],
    "ARCHIVE_INDEX",
    "archive digest manifest",
  );
  assert(
    index.schemaVersion === 1 && index.releaseLine === config.releaseLine &&
      index.contractVersion === config.contractVersion &&
      isReleaseLineVersion(index.version, config.releaseLine) &&
      index.distTag === config.distTag && index.packageSetSha256 === config.sha256 &&
      Array.isArray(index.archives) && index.archives.length === config.packages.length,
    "ARCHIVE_INDEX",
    `archive digest manifest is not for the configured ${config.releaseLine} trio`,
  );
  const expectedFiles = [ARCHIVE_MANIFEST_FILENAME];
  const archives = config.packages.map((spec, index_) => {
    const record = index.archives[index_];
    const archive = validateArchive(config, spec, record, directory, index.version);
    expectedFiles.push(record.file);
    return archive;
  });
  assert(
    JSON.stringify(readdirSync(directory).sort()) ===
      JSON.stringify(expectedFiles.sort()),
    "ARCHIVE_DIRECTORY",
    "archive directory contains missing or extra files",
  );
  return Object.freeze({
    directory,
    indexPath,
    index: Object.freeze(index),
    version: index.version,
    archives: Object.freeze(archives),
  });
}
