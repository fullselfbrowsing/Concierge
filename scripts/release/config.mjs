import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const DEFAULT_RELEASE_LINE_PATH = join(ROOT, ".release/lines/0.2.json");

const PACKAGE_NAMES = Object.freeze([
  "@fullselfbrowsing/concierge",
  "@fullselfbrowsing/concierge-react",
  "@fullselfbrowsing/concierge-svelte",
]);
const PACKAGE_ROLES = Object.freeze(["core", "react", "svelte"]);
const SHA512_INTEGRITY = /^sha512-[A-Za-z0-9+/]+={0,2}$/u;

export function fail(code, message) {
  throw new Error(`[${code}] ${message}`);
}

export function assert(condition, code, message) {
  if (!condition) fail(code, message);
}

export function exactKeys(value, expected, code, label) {
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

export function stableJson(value) {
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

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256File(path) {
  return sha256(readFileSync(path));
}

export function integrityFile(path) {
  return `sha512-${createHash("sha512")
    .update(readFileSync(path))
    .digest("base64")}`;
}

export function exactRegularFile(path, label) {
  assert(isAbsolute(path), "PATH", `${label} must be absolute`);
  assert(path === normalize(resolve(path)), "PATH", `${label} must be normalized`);
  const metadata = lstatSync(path);
  assert(
    metadata.isFile() && metadata.size > 0 && realpathSync(path) === path,
    "PATH",
    `${label} must be a nonempty regular file, not a symlink`,
  );
  return path;
}

export function pathInsideRoot(relativePath, label) {
  assert(
    typeof relativePath === "string" && relativePath.length > 0 &&
      !isAbsolute(relativePath) && normalize(relativePath) === relativePath,
    "CONFIG_PATH",
    `${label} must be a normalized repository-relative path`,
  );
  const absolute = resolve(ROOT, relativePath);
  assert(
    relative(ROOT, absolute) !== "" && !relative(ROOT, absolute).startsWith(".."),
    "CONFIG_PATH",
    `${label} escapes the repository`,
  );
  return absolute;
}

export function expectedArchiveFilename(name, version) {
  return `${name.replace(/^@/u, "").replace("/", "-")}-${version}.tgz`;
}

export function isStableVersion(value) {
  return typeof value === "string" &&
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(value);
}

export function isReleaseLineVersion(value, releaseLine) {
  return isStableVersion(value) &&
    value.split(".").slice(0, 2).join(".") === releaseLine;
}

function validateReleaseLine(config, source, path) {
  exactKeys(
    config,
    [
      "schemaVersion",
      "releaseLine",
      "contractVersion",
      "initialVersion",
      "distTag",
      "registry",
      "repository",
      "repositoryUrl",
      "repositoryWebUrl",
      "sourceRef",
      "workflowPath",
      "environment",
      "node",
      "npm",
      "compatibility",
      "packages",
    ],
    "CONFIG_SCHEMA",
    "release-line configuration",
  );
  exactKeys(
    config.node,
    ["consumerEngine", "ci", "publisherMinimum"],
    "CONFIG_SCHEMA",
    "node configuration",
  );
  exactKeys(
    config.npm,
    ["version", "integrity"],
    "CONFIG_SCHEMA",
    "npm configuration",
  );
  exactKeys(
    config.compatibility,
    ["ai", "react", "reactDom", "svelte"],
    "CONFIG_SCHEMA",
    "compatibility configuration",
  );
  assert(
    config.schemaVersion === 1 && config.releaseLine === "0.2" &&
      config.contractVersion === 2 && config.initialVersion === "0.2.0",
    "CONFIG_IDENTITY",
    "the live release line must be Concierge 0.2 with contract v2",
  );
  assert(
    config.distTag === "latest" &&
      config.registry === "https://registry.npmjs.org/" &&
      config.repository === "fullselfbrowsing/Concierge" &&
      config.repositoryUrl ===
        "git+https://github.com/fullselfbrowsing/Concierge.git" &&
      config.repositoryWebUrl ===
        "https://github.com/fullselfbrowsing/Concierge" &&
      config.sourceRef === "refs/heads/main" &&
      config.workflowPath === ".github/workflows/release.yml" &&
      config.environment === "npm-production",
    "CONFIG_DESTINATION",
    "registry, repository, workflow, environment, or latest tag drifted",
  );
  assert(
    config.node.consumerEngine === ">=22.12.0" && config.node.ci === "24" &&
      config.node.publisherMinimum === "22.14.0",
    "CONFIG_NODE",
    "reviewed Node floors drifted",
  );
  assert(
    config.npm.version === "11.19.0" &&
      SHA512_INTEGRITY.test(config.npm.integrity),
    "CONFIG_NPM",
    "reviewed publisher npm identity drifted",
  );
  assert(
    config.compatibility.ai === "^6.0.0 || ^7.0.0" &&
      config.compatibility.react === "^18.2.0 || ^19.0.0" &&
      config.compatibility.reactDom === "^18.2.0 || ^19.0.0" &&
      config.compatibility.svelte === "^5.0.0",
    "CONFIG_COMPATIBILITY",
    "reviewed peer compatibility ranges drifted",
  );
  assert(
    Array.isArray(config.packages) && config.packages.length === PACKAGE_NAMES.length,
    "CONFIG_PACKAGES",
    "release package set must contain exactly three packages",
  );
  for (const [index, entry] of config.packages.entries()) {
    exactKeys(
      entry,
      ["name", "path", "role", "requiresCore"],
      "CONFIG_SCHEMA",
      `package record ${index}`,
    );
    assert(
      entry.name === PACKAGE_NAMES[index] && entry.role === PACKAGE_ROLES[index] &&
        entry.requiresCore === (index !== 0),
      "CONFIG_PACKAGES",
      `package record ${index} identity or publish order drifted`,
    );
    const directory = pathInsideRoot(entry.path, `${entry.name} path`);
    assert(
      directory === join(ROOT, "packages", entry.name.split("/").at(-1)),
      "CONFIG_PACKAGES",
      `${entry.name} path is not canonical`,
    );
  }
  return Object.freeze({
    ...config,
    packages: Object.freeze(config.packages.map((entry) => Object.freeze({ ...entry }))),
    path,
    source,
    sha256: sha256(source),
  });
}

export function loadReleaseLine(configuredPath = DEFAULT_RELEASE_LINE_PATH) {
  const path = exactRegularFile(resolve(configuredPath), "release-line configuration");
  let source;
  let config;
  try {
    source = readFileSync(path, "utf8");
    config = JSON.parse(source);
  } catch (error) {
    fail(
      "CONFIG_JSON",
      `release-line configuration is not strict JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return validateReleaseLine(config, source, path);
}

export const PUBLIC_PACKAGE_NAMES = PACKAGE_NAMES;
