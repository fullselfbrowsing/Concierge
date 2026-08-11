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
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODES = Object.freeze([
  "artifacts",
  "svelte-consent",
  "mismatch",
  "all",
  "self-test",
]);

const REPOSITORY_ROOT = realpathSync(
  fileURLToPath(new URL("../", import.meta.url)),
);
const SYSTEM_TEMP_ROOT = realpathSync(tmpdir());
const TEMP_PREFIX = "concierge-phase09-pack-";
const OWNERSHIP_MARKER = ".concierge-phase09-owned-root";
const CHILD_TIMEOUT_MS = 180_000;
const CHILD_MAX_BUFFER = 32 * 1024 * 1024;
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const PACK_COMMAND = "pnpm pack";
const CORE_NAME = "@fullselfbrowsing/concierge";
const REACT_NAME = "@fullselfbrowsing/concierge-react";
const SVELTE_NAME = "@fullselfbrowsing/concierge-svelte";
const PACKAGE_SPECS = Object.freeze([
  Object.freeze({
    key: "core",
    name: CORE_NAME,
    directory: join(REPOSITORY_ROOT, "packages/concierge"),
  }),
  Object.freeze({
    key: "react",
    name: REACT_NAME,
    directory: join(REPOSITORY_ROOT, "packages/concierge-react"),
  }),
  Object.freeze({
    key: "svelte",
    name: SVELTE_NAME,
    directory: join(REPOSITORY_ROOT, "packages/concierge-svelte"),
  }),
]);
const PACKAGE_BY_NAME = new Map(PACKAGE_SPECS.map((spec) => [spec.name, spec]));
const CONSUMER_TOOL_VERSIONS = Object.freeze({
  "@sveltejs/vite-plugin-svelte": "7.2.0",
  "@types/react": "19.2.18",
  "@types/react-dom": "19.2.4",
  "@vitejs/plugin-react": "5.2.0",
  jsdom: "29.1.1",
  react: "19.2.8",
  "react-dom": "19.2.8",
  svelte: "5.56.8",
  typescript: "7.0.2",
  vite: "8.1.5",
  vitest: "4.1.10",
});

function fail(code, message) {
  throw new Error(`[${code}] ${message}`);
}

function assert(condition, code, message) {
  if (!condition) {
    fail(code, message);
  }
}

function readMode(argv) {
  if (argv.length !== 1 || !MODES.includes(argv[0])) {
    fail(
      "CLI_MODE",
      `usage: node scripts/phase-09-package-check.mjs ${MODES.join("|")}`,
    );
  }

  return argv[0];
}

function isPathWithin(candidate, parent) {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent === "" ||
    (pathFromParent !== ".." && !pathFromParent.startsWith(`..${sep}`))
  );
}

function assertOutsideRepository(candidate, label) {
  const resolvedCandidate = realpathSync(candidate);
  assert(
    !isPathWithin(resolvedCandidate, REPOSITORY_ROOT),
    "WORKSPACE_REALPATH",
    `${label} resolved inside the repository: ${resolvedCandidate}`,
  );
  return resolvedCandidate;
}

function assertOwnedTempRoot(root) {
  assert(isAbsolute(root), "TEMP_ROOT", "owned root must be absolute");
  assert(root === normalize(resolve(root)), "TEMP_ROOT", "owned root must be normalized");
  assert(
    dirname(root) === SYSTEM_TEMP_ROOT,
    "TEMP_ROOT",
    "owned root must be a direct child of the system temporary directory",
  );
  assert(
    basename(root).startsWith(TEMP_PREFIX) &&
      basename(root).length > TEMP_PREFIX.length,
    "TEMP_ROOT",
    "owned root must retain its nonempty package-check prefix",
  );
  assert(statSync(root).isDirectory(), "TEMP_ROOT", "owned root must be a directory");
  assertOutsideRepository(root, "owned root");
  const marker = join(root, OWNERSHIP_MARKER);
  assert(
    statSync(marker).isFile() && readFileSync(marker, "utf8") === basename(root),
    "TEMP_ROOT",
    "owned root marker is missing or invalid",
  );
}

function createOwnedTempRoot() {
  const root = mkdtempSync(join(SYSTEM_TEMP_ROOT, TEMP_PREFIX));
  writeFileSync(join(root, OWNERSHIP_MARKER), basename(root), {
    encoding: "utf8",
    flag: "wx",
  });
  assertOwnedTempRoot(root);
  return root;
}

function removeOwnedTempRoot(root) {
  assertOwnedTempRoot(root);
  rmSync(root, { recursive: true, force: false });
  assert(!existsSync(root), "TEMP_CLEANUP", "owned root survived cleanup");
}

function boundedExcerpt(value) {
  const text = value ?? "";
  return text.length <= 4_000 ? text : text.slice(text.length - 4_000);
}

function runChild(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPOSITORY_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      FORCE_COLOR: "0",
      NO_COLOR: "1",
      ...options.env,
    },
    maxBuffer: CHILD_MAX_BUFFER,
    timeout: options.timeout ?? CHILD_TIMEOUT_MS,
  });
  const label = options.label ?? [command, ...args].join(" ");

  assert(
    result.error === undefined,
    "CHILD_PROCESS",
    `${label} process error: ${result.error?.message ?? "unknown"}`,
  );
  assert(
    result.signal === null,
    "CHILD_PROCESS",
    `${label} exceeded its bounded runtime or received ${String(result.signal)}`,
  );
  assert(
    result.status === 0,
    "CHILD_PROCESS",
    `${label} exited ${String(result.status)}\nstdout:\n${boundedExcerpt(result.stdout)}\nstderr:\n${boundedExcerpt(result.stderr)}`,
  );
  assert(
    result.stdout.length <= CHILD_MAX_BUFFER &&
      result.stderr.length <= CHILD_MAX_BUFFER,
    "CHILD_OUTPUT",
    `${label} exceeded the output bound`,
  );

  return Object.freeze({ stdout: result.stdout, stderr: result.stderr });
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readArchiveText(archivePath, entry) {
  return runChild("tar", ["-xOzf", archivePath, entry], {
    label: `tar read ${basename(archivePath)} ${entry}`,
  }).stdout;
}

function readArchiveManifest(archivePath) {
  try {
    return JSON.parse(readArchiveText(archivePath, "package/package.json"));
  } catch (error) {
    fail(
      "ARCHIVE_MANIFEST",
      `${basename(archivePath)} has no parseable package/package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function listArchiveEntries(archivePath) {
  const entries = runChild("tar", ["-tzf", archivePath], {
    label: `tar list ${basename(archivePath)}`,
  }).stdout
    .split(/\r?\n/u)
    .filter(Boolean);
  assert(entries.length > 0, "ARCHIVE_EMPTY", `${basename(archivePath)} is empty`);
  return entries;
}

function enumerateExactArchives(archiveDirectory) {
  const archivePaths = readdirSync(archiveDirectory)
    .filter((entry) => entry.endsWith(".tgz"))
    .map((entry) => join(archiveDirectory, entry))
    .sort();
  assert(
    archivePaths.length === PACKAGE_SPECS.length,
    "ARCHIVE_COUNT",
    `expected exactly three archives, found ${archivePaths.length}`,
  );

  const seenNames = new Set();
  const archives = archivePaths.map((path) => {
    assert(statSync(path).isFile(), "ARCHIVE_FILE", `${path} is not a regular file`);
    assert(statSync(path).size > 0, "ARCHIVE_FILE", `${path} is empty`);
    const manifest = readArchiveManifest(path);
    const spec = PACKAGE_BY_NAME.get(manifest.name);
    assert(spec !== undefined, "ARCHIVE_IDENTITY", `foreign archive identity ${String(manifest.name)}`);
    assert(
      !seenNames.has(manifest.name),
      "ARCHIVE_IDENTITY",
      `duplicate archive identity ${manifest.name}`,
    );
    seenNames.add(manifest.name);
    return Object.freeze({
      key: spec.key,
      name: spec.name,
      path,
      manifest,
      sha256: sha256File(path),
    });
  });

  for (const spec of PACKAGE_SPECS) {
    assert(seenNames.has(spec.name), "ARCHIVE_MISSING", `missing archive for ${spec.name}`);
  }

  return Object.freeze(
    Object.fromEntries(archives.map((archive) => [archive.key, archive])),
  );
}

function buildAndPackTriplet(root) {
  const archiveDirectory = join(root, "archives");
  mkdirSync(archiveDirectory);
  const packCounts = new Map(PACKAGE_SPECS.map((spec) => [spec.name, 0]));

  for (const spec of PACKAGE_SPECS) {
    runChild(PNPM, ["--filter", spec.name, "build"], {
      label: `build ${spec.name}`,
    });
  }

  for (const spec of PACKAGE_SPECS) {
    runChild(PNPM, ["pack", "--pack-destination", archiveDirectory], {
      cwd: spec.directory,
      label: `${PACK_COMMAND} ${spec.name}`,
    });
    packCounts.set(spec.name, (packCounts.get(spec.name) ?? 0) + 1);
  }

  for (const spec of PACKAGE_SPECS) {
    assert(
      packCounts.get(spec.name) === 1,
      "PACK_COUNT",
      `${spec.name} was not packed exactly once`,
    );
  }

  return enumerateExactArchives(archiveDirectory);
}

function collectManifestTargets(manifest) {
  const targets = new Set();
  const visit = (value) => {
    if (typeof value === "string" && value.startsWith("./")) {
      targets.add(`package/${value.slice(2)}`);
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const child of Object.values(value)) {
        visit(child);
      }
    }
  };
  visit(manifest.main);
  visit(manifest.types);
  visit(manifest.svelte);
  visit(manifest.exports);
  return targets;
}

function validateArchiveContents(archive) {
  const entries = listArchiveEntries(archive.path);
  const entrySet = new Set(entries);
  for (const entry of entries) {
    assert(
      entry.startsWith("package/") && !entry.includes("../"),
      "TAR_ENTRY",
      `${archive.name} contains a foreign or traversing entry: ${entry}`,
    );
    assert(
      !/(?:^|\/)(?:__tests__|fixtures|test|tests)(?:\/|$)|\.(?:spec|test)\.[^/]+$|stub-transport/iu.test(
        entry,
      ),
      "TAR_PRIVATE",
      `${archive.name} contains private test material: ${entry}`,
    );
  }

  for (const target of collectManifestTargets(archive.manifest)) {
    assert(
      entrySet.has(target),
      "TAR_TARGET",
      `${archive.name} is missing exported target ${target}`,
    );
  }

  const liveManifest = JSON.parse(
    readFileSync(join(PACKAGE_BY_NAME.get(archive.name).directory, "package.json"), "utf8"),
  );
  assert(
    archive.manifest.version === liveManifest.version,
    "ARCHIVE_VERSION",
    `${archive.name} archive version does not match its live manifest`,
  );

  if (archive.key !== "core") {
    assert(
      liveManifest.peerDependencies?.[CORE_NAME] === "workspace:^" &&
        liveManifest.devDependencies?.[CORE_NAME] === "workspace:*" &&
        liveManifest.dependencies?.[CORE_NAME] === undefined,
      "ADAPTER_MANIFEST",
      `${archive.name} live manifest must keep core peer+dev only`,
    );
    assert(
      typeof archive.manifest.peerDependencies?.[CORE_NAME] === "string" &&
        archive.manifest.dependencies?.[CORE_NAME] === undefined,
      "ADAPTER_MANIFEST",
      `${archive.name} packed manifest must keep core peer-only at runtime`,
    );
    for (const entry of entries) {
      assert(
        !/^package\/(?:node_modules\/)?@fullselfbrowsing\/concierge\//u.test(entry) &&
          !/^package\/src\/(?:bridge|catalog|concierge|consent-evidence|consent-profile|contract|define-action|dispatch|host|json-schema|message|session|types)\.ts$/u.test(
            entry,
          ),
        "BUNDLED_CORE",
        `${archive.name} contains bundled core material: ${entry}`,
      );
    }
  }

  return entries.length;
}

function validateTripletArtifacts(archives) {
  const tarEntryCounts = {};
  for (const spec of PACKAGE_SPECS) {
    const archive = archives[spec.key];
    tarEntryCounts[spec.key] = validateArchiveContents(archive);
    runChild(PNPM, ["exec", "publint", "run", archive.path, "--strict"], {
      label: `publint ${archive.name}`,
    });
    runChild(PNPM, ["exec", "attw", archive.path, "--profile", "esm-only"], {
      label: `attw ${archive.name}`,
    });
  }
  return Object.freeze(tarEntryCounts);
}

function walkForRepositorySymlinks(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      assertOutsideRepository(path, `installed symlink ${path}`);
    } else if (stat.isDirectory()) {
      walkForRepositorySymlinks(path);
    }
  }
}

function assertOnePhysicalCore(coreManifestPaths) {
  const coreRoots = coreManifestPaths.map((path) => realpathSync(dirname(path)));
  assert(
    new Set(coreRoots).size === 1,
    "DUPLICATE_CORE",
    `expected one physical core, found ${[...new Set(coreRoots)].join(", ")}`,
  );
  return coreRoots[0];
}

function inspectInstalledTopology(consumerDirectory) {
  const consumerManifest = join(consumerDirectory, "package.json");
  const consumerRequire = createRequire(pathToFileURL(consumerManifest));
  const coreManifest = consumerRequire.resolve(`${CORE_NAME}/package.json`);
  const reactManifest = consumerRequire.resolve(`${REACT_NAME}/package.json`);
  const svelteManifest = consumerRequire.resolve(`${SVELTE_NAME}/package.json`);
  const reactRequire = createRequire(pathToFileURL(reactManifest));
  const svelteRequire = createRequire(pathToFileURL(svelteManifest));
  const reactCoreManifest = reactRequire.resolve(`${CORE_NAME}/package.json`);
  const svelteCoreManifest = svelteRequire.resolve(`${CORE_NAME}/package.json`);
  const physicalCore = assertOnePhysicalCore([
    coreManifest,
    reactCoreManifest,
    svelteCoreManifest,
  ]);

  for (const path of [coreManifest, reactManifest, svelteManifest, physicalCore]) {
    assertOutsideRepository(path, "installed package realpath");
  }
  for (const manifestPath of [reactManifest, svelteManifest]) {
    const nestedCore = join(
      dirname(manifestPath),
      "node_modules/@fullselfbrowsing/concierge/package.json",
    );
    assert(
      !existsSync(nestedCore),
      "DUPLICATE_CORE",
      `adapter contains a nested core: ${nestedCore}`,
    );
  }

  walkForRepositorySymlinks(join(consumerDirectory, "node_modules"));
  const graphResult = runChild(NPM, ["ls", "--all", "--json"], {
    cwd: consumerDirectory,
    label: "npm dependency graph",
  });
  const graph = JSON.parse(graphResult.stdout);
  assert(
    !Array.isArray(graph.problems) || graph.problems.length === 0,
    "NPM_GRAPH",
    `npm graph reported problems: ${JSON.stringify(graph.problems)}`,
  );
  const graphText = JSON.stringify(graph);
  for (const name of [CORE_NAME, REACT_NAME, SVELTE_NAME]) {
    assert(graphText.includes(name), "NPM_GRAPH", `npm graph omitted ${name}`);
  }

  return Object.freeze({
    coreManifest,
    reactManifest,
    svelteManifest,
    physicalCore,
  });
}

function createConsumer(root, archives, label) {
  const consumerDirectory = join(root, label);
  mkdirSync(consumerDirectory);
  assertOutsideRepository(consumerDirectory, `${label} consumer`);
  const dependencies = {
    [CORE_NAME]: `file:${archives.core.path}`,
    [REACT_NAME]: `file:${archives.react.path}`,
    [SVELTE_NAME]: `file:${archives.svelte.path}`,
    ...CONSUMER_TOOL_VERSIONS,
  };
  writeJson(join(consumerDirectory, "package.json"), {
    name: `concierge-phase09-${label}`,
    version: "0.0.0",
    private: true,
    type: "module",
    dependencies,
  });
  runChild(
    NPM,
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--loglevel=error",
    ],
    { cwd: consumerDirectory, label: `npm install ${label}` },
  );
  const lockPath = join(consumerDirectory, "package-lock.json");
  assert(statSync(lockPath).isFile(), "CONSUMER_LOCK", "npm did not write a lockfile");
  const lockText = readFileSync(lockPath, "utf8");
  assert(
    !lockText.includes("workspace:") &&
      !lockText.includes(REPOSITORY_ROOT) &&
      !/"link"\s*:\s*true/u.test(lockText),
    "WORKSPACE_LINK",
    "consumer lockfile contains workspace or repository linkage",
  );
  const topology = inspectInstalledTopology(consumerDirectory);
  return Object.freeze({ directory: consumerDirectory, topology });
}

function writeDeclarationFixture(consumerDirectory) {
  writeJson(join(consumerDirectory, "tsconfig.json"), {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "node20",
      strict: true,
      exactOptionalPropertyTypes: true,
      noEmit: true,
      skipLibCheck: false,
    },
    include: ["public-entries.ts"],
  });
  writeFileSync(
    join(consumerDirectory, "public-entries.ts"),
    `import { createBridge, createConcierge, defineAction } from "${CORE_NAME}";\n` +
      `import type { Bridge, BridgeRegistry, Concierge, SnapshotNormalizer } from "${CORE_NAME}";\n` +
      `import * as reactRoot from "${REACT_NAME}";\n` +
      `import { ConciergeProvider, useConcierge, useConciergeBridge, useConciergeValue } from "${REACT_NAME}/client";\n` +
      `import * as svelteRoot from "${SVELTE_NAME}";\n` +
      `import { provideConcierge, svelteSnapshotNormalizer, useConcierge as useSvelteConcierge, useConciergeBridge as useSvelteBridge } from "${SVELTE_NAME}/client.svelte";\n` +
      `const concierge: Concierge = createConcierge({ stages: [] });\n` +
      `const registry = createBridge("booking");\n` +
      `const normalizer: SnapshotNormalizer = svelteSnapshotNormalizer;\n` +
      `const bridge: Bridge = { actions: Object.freeze({}), snapshot: Object.freeze({}) };\n` +
      `const typedRegistry: BridgeRegistry = registry;\n` +
      `void [concierge, normalizer, bridge, typedRegistry, defineAction, reactRoot, ConciergeProvider, useConcierge, useConciergeBridge, useConciergeValue, svelteRoot, provideConcierge, useSvelteConcierge, useSvelteBridge];\n`,
    "utf8",
  );
}

function runDeclarationCheck(consumerDirectory) {
  writeDeclarationFixture(consumerDirectory);
  const compiler = join(
    consumerDirectory,
    "node_modules/.bin",
    process.platform === "win32" ? "tsc.cmd" : "tsc",
  );
  const version = runChild(compiler, ["--version"], {
    cwd: consumerDirectory,
    label: "consumer TypeScript version",
  }).stdout.trim();
  assert(
    version === "Version 7.0.2",
    "TYPESCRIPT_VERSION",
    `expected TypeScript 7.0.2, received ${version}`,
  );
  runChild(compiler, ["-p", "tsconfig.json"], {
    cwd: consumerDirectory,
    label: "consumer public declaration typecheck (skipLibCheck false)",
  });
  return version;
}

function writeServerFixtures(consumerDirectory) {
  const serverDirectory = join(consumerDirectory, "server");
  mkdirSync(serverDirectory);
  writeFileSync(
    join(consumerDirectory, "vitest.server.config.mjs"),
    `import { defineConfig } from "vitest/config";\n` +
      `import react from "@vitejs/plugin-react";\n` +
      `import { svelte } from "@sveltejs/vite-plugin-svelte";\n` +
      `export default defineConfig({\n` +
      `  plugins: [react(), svelte({ compilerOptions: { hmr: false } })],\n` +
      `  resolve: { conditions: ["svelte"] },\n` +
      `  test: {\n` +
      `    environment: "node",\n` +
      `    include: ["server/react-ssr.test.tsx", "server/svelte-ssr.test.ts"],\n` +
      `    fileParallelism: false,\n` +
      `    maxWorkers: 1,\n` +
      `  },\n` +
      `});\n`,
    "utf8",
  );
  writeFileSync(
    join(serverDirectory, "react-ssr.test.tsx"),
    `import { createElement } from "react";\n` +
      `import { renderToString } from "react-dom/server";\n` +
      `import { describe, expect, it } from "vitest";\n` +
      `import { createConcierge } from "${CORE_NAME}";\n` +
      `import * as reactRoot from "${REACT_NAME}";\n` +
      `import { ConciergeProvider, useConciergeBridge } from "${REACT_NAME}/client";\n` +
      `describe("packed React public server entry", () => {\n` +
      `  it("imports and renders without browser globals or registration", () => {\n` +
      `    expect([Reflect.has(globalThis, "window"), Reflect.has(globalThis, "document"), Reflect.has(globalThis, "navigator")]).toEqual([false, false, false]);\n` +
      `    let registerCount = 0;\n` +
      `    const registry = { register() { registerCount += 1; return () => {}; }, read() { return null; } };\n` +
      `    const bridge = { actions: Object.freeze({}), snapshot: Object.freeze({}) };\n` +
      `    const concierge = createConcierge({ stages: [] });\n` +
      `    function Probe() { useConciergeBridge(registry, bridge); return createElement("span", null, "react-server"); }\n` +
      `    const html = renderToString(createElement(ConciergeProvider, { concierge }, createElement(Probe)));\n` +
      `    expect(html).toContain("react-server");\n` +
      `    expect(registerCount).toBe(0);\n` +
      `    expect(Object.keys(reactRoot)).toEqual([]);\n` +
      `  });\n` +
      `});\n`,
    "utf8",
  );
  writeFileSync(
    join(serverDirectory, "SvelteProbe.svelte"),
    `<script lang="ts">\n` +
      `  import { provideConcierge, useConciergeBridge } from "${SVELTE_NAME}/client.svelte";\n` +
      `  let { concierge, registry, bridge } = $props();\n` +
      `  provideConcierge(concierge);\n` +
      `  useConciergeBridge(registry, bridge);\n` +
      `</script>\n` +
      `<span>packed-svelte-server</span>\n`,
    "utf8",
  );
  writeFileSync(
    join(serverDirectory, "svelte-ssr.test.ts"),
    `import { render } from "svelte/server";\n` +
      `import { describe, expect, it } from "vitest";\n` +
      `import { createConcierge } from "${CORE_NAME}";\n` +
      `import * as svelteRoot from "${SVELTE_NAME}";\n` +
      `import SvelteProbe from "./SvelteProbe.svelte";\n` +
      `describe("packed Svelte public server entry", () => {\n` +
      `  it("compiler-renders without browser globals or registration", () => {\n` +
      `    expect([Reflect.has(globalThis, "window"), Reflect.has(globalThis, "document"), Reflect.has(globalThis, "navigator")]).toEqual([false, false, false]);\n` +
      `    let registerCount = 0;\n` +
      `    const registry = { register() { registerCount += 1; return () => {}; }, read() { return null; } };\n` +
      `    const bridge = { actions: Object.freeze({}), snapshot: Object.freeze({}) };\n` +
      `    const concierge = createConcierge({ stages: [] });\n` +
      `    const output = render(SvelteProbe, { props: { concierge, registry, bridge } });\n` +
      `    expect(output.body).toContain("packed-svelte-server");\n` +
      `    expect(registerCount).toBe(0);\n` +
      `    expect(Object.keys(svelteRoot)).toEqual([]);\n` +
      `  });\n` +
      `});\n`,
    "utf8",
  );
}

function validatePositiveVitestReport(reportPath, expectedTestFiles) {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  assert(report.success === true, "VITEST_REPORT", "Vitest JSON success was not true");
  assert(
    Number.isInteger(report.numTotalTestSuites) && report.numTotalTestSuites > 0,
    "VITEST_ZERO",
    "Vitest collected zero test suites",
  );
  assert(
    Number.isInteger(report.numTotalTests) && report.numTotalTests > 0,
    "VITEST_ZERO",
    "Vitest collected zero tests",
  );
  assert(
    Array.isArray(report.testResults) && report.testResults.length > 0,
    "VITEST_ZERO",
    "Vitest collected zero test files",
  );
  assert(
    report.numFailedTests === 0 && report.numPassedTests === report.numTotalTests,
    "VITEST_FAILURE",
    "Vitest JSON contains failed or non-passing tests",
  );
  const actualFiles = report.testResults.map((result) => basename(result.name)).sort();
  assert(
    JSON.stringify(actualFiles) === JSON.stringify([...expectedTestFiles].sort()),
    "VITEST_FILES",
    `Vitest ran unexpected files: ${actualFiles.join(", ")}`,
  );
  for (const result of report.testResults) {
    assert(
      Array.isArray(result.assertionResults) && result.assertionResults.length > 0,
      "VITEST_ZERO",
      `${result.name} reported zero assertions`,
    );
    assert(
      result.assertionResults.every((assertion) => assertion.status === "passed"),
      "VITEST_FAILURE",
      `${result.name} contains a non-passing assertion`,
    );
  }
  return Object.freeze({
    files: report.testResults.length,
    suites: report.numTotalTestSuites,
    tests: report.numTotalTests,
  });
}

function runServerTests(consumerDirectory) {
  writeServerFixtures(consumerDirectory);
  const reportPath = join(consumerDirectory, "vitest-server.json");
  const vitest = join(
    consumerDirectory,
    "node_modules/.bin",
    process.platform === "win32" ? "vitest.cmd" : "vitest",
  );
  const nodeOptions = [
    process.env.NODE_OPTIONS,
    "--no-experimental-global-navigator",
  ]
    .filter(Boolean)
    .join(" ");
  runChild(
    vitest,
    [
      "run",
      "--config",
      "vitest.server.config.mjs",
      "--reporter=json",
      `--outputFile=${reportPath}`,
    ],
    {
      cwd: consumerDirectory,
      env: { NODE_OPTIONS: nodeOptions },
      label: "packed public server Vitest",
    },
  );
  return validatePositiveVitestReport(reportPath, [
    "react-ssr.test.tsx",
    "svelte-ssr.test.ts",
  ]);
}

function runArtifactStage(root, archives) {
  const consumer = createConsumer(root, archives, "artifact-consumer");
  const typescript = runDeclarationCheck(consumer.directory);
  const serverTests = runServerTests(consumer.directory);
  return Object.freeze({ consumer, typescript, serverTests });
}

function writeConsentRedFixture(consumerDirectory) {
  const consentDirectory = join(consumerDirectory, "consent");
  mkdirSync(consentDirectory);
  writeFileSync(
    join(consumerDirectory, "vitest.consent.config.mjs"),
    `import { defineConfig } from "vitest/config";\n` +
      `import { svelte } from "@sveltejs/vite-plugin-svelte";\n` +
      `export default defineConfig({\n` +
      `  plugins: [svelte({ compilerOptions: { hmr: false } })],\n` +
      `  resolve: { conditions: ["svelte"] },\n` +
      `  test: { environment: "jsdom", include: ["consent/consent.test.ts"], fileParallelism: false, maxWorkers: 1 },\n` +
      `});\n`,
    "utf8",
  );
  writeFileSync(
    join(consentDirectory, "rune-state.svelte.ts"),
    `export const state = $state({ booking: { amount: 41, seat: "A" } });\n`,
    "utf8",
  );
  writeFileSync(
    join(consentDirectory, "consent.test.ts"),
    `import { describe, expect, it } from "vitest";\n` +
      `import { state } from "./rune-state.svelte";\n` +
      `describe("packed real-$state consent drift", () => {\n` +
      `  it("[T03/S1] closes completed review after nested live mutation", () => {\n` +
      `    expect(state.booking).toEqual({ amount: 41, seat: "A" });\n` +
      `    expect.fail("[RED:09-08-02:CONSENT] public review/completed-delivery/consent_stale flow is not wired");\n` +
      `  });\n` +
      `});\n`,
    "utf8",
  );
}

function runConsentRedFixture(consumerDirectory) {
  writeConsentRedFixture(consumerDirectory);
  const vitest = join(
    consumerDirectory,
    "node_modules/.bin",
    process.platform === "win32" ? "vitest.cmd" : "vitest",
  );
  runChild(
    vitest,
    ["run", "--config", "vitest.consent.config.mjs", "--reporter=verbose"],
    { cwd: consumerDirectory, label: "packed real-$state consent RED" },
  );
}

function validateExportDirectory(mode) {
  const configured = process.env.PHASE09_ARCHIVE_EXPORT_DIR;
  if (configured === undefined || configured === "") {
    return null;
  }
  assert(mode === "all", "ARCHIVE_EXPORT", "archive export is valid only in all mode");
  assert(isAbsolute(configured), "ARCHIVE_EXPORT", "archive export path must be absolute");
  assert(
    configured === normalize(resolve(configured)),
    "ARCHIVE_EXPORT",
    "archive export path must be normalized",
  );
  assert(statSync(configured).isDirectory(), "ARCHIVE_EXPORT", "archive export path must exist");
  const resolved = assertOutsideRepository(configured, "archive export directory");
  assert(
    readdirSync(resolved).length === 0,
    "ARCHIVE_EXPORT",
    "archive export directory must be empty",
  );
  return resolved;
}

function exportArchives(exportDirectory, archives) {
  const digestManifest = {};
  for (const spec of PACKAGE_SPECS) {
    const archive = archives[spec.key];
    const destination = join(exportDirectory, basename(archive.path));
    copyFileSync(archive.path, destination, 0);
    assert(
      sha256File(destination) === archive.sha256,
      "ARCHIVE_EXPORT",
      `${archive.name} export digest changed`,
    );
    digestManifest[archive.name] = Object.freeze({
      file: basename(destination),
      sha256: archive.sha256,
    });
  }
  const manifestPath = join(exportDirectory, "phase-09-archive-digests.json");
  writeJson(manifestPath, {
    schemaVersion: 1,
    algorithm: "sha256",
    archives: digestManifest,
  });
  assert(
    readdirSync(exportDirectory).length === 4,
    "ARCHIVE_EXPORT",
    "archive export must contain exactly three tarballs and one digest manifest",
  );
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
    return;
  }
  fail("SELF_TEST", `${label} unexpectedly passed`);
}

function createSyntheticArchive(directory, name, suffix) {
  const staging = join(directory, `staging-${suffix}`);
  const packageDirectory = join(staging, "package");
  mkdirSync(packageDirectory, { recursive: true });
  writeJson(join(packageDirectory, "package.json"), {
    name,
    version: "0.0.0",
    type: "module",
  });
  const archive = join(directory, `${suffix}.tgz`);
  runChild("tar", ["-czf", archive, "-C", staging, "package"], {
    label: `self-test archive ${suffix}`,
  });
  return archive;
}

function runSelfTests() {
  const root = createOwnedTempRoot();
  let controls = 0;
  try {
    const missing = join(root, "missing");
    mkdirSync(missing);
    createSyntheticArchive(missing, CORE_NAME, "core");
    createSyntheticArchive(missing, REACT_NAME, "react");
    expectFailure("missing archive", "ARCHIVE_COUNT", () =>
      enumerateExactArchives(missing),
    );
    controls += 1;

    const extra = join(root, "extra");
    mkdirSync(extra);
    createSyntheticArchive(extra, CORE_NAME, "core");
    createSyntheticArchive(extra, REACT_NAME, "react");
    createSyntheticArchive(extra, SVELTE_NAME, "svelte");
    createSyntheticArchive(extra, "@foreign/fourth", "fourth");
    expectFailure("fourth archive", "ARCHIVE_COUNT", () =>
      enumerateExactArchives(extra),
    );
    controls += 1;

    const linkedTree = join(root, "workspace-realpath");
    mkdirSync(linkedTree);
    symlinkSync(REPOSITORY_ROOT, join(linkedTree, "repository-link"), "dir");
    expectFailure("workspace realpath", "WORKSPACE_REALPATH", () =>
      walkForRepositorySymlinks(linkedTree),
    );
    controls += 1;

    const firstCore = join(root, "core-a");
    const secondCore = join(root, "core-b");
    mkdirSync(firstCore);
    mkdirSync(secondCore);
    writeJson(join(firstCore, "package.json"), { name: CORE_NAME });
    writeJson(join(secondCore, "package.json"), { name: CORE_NAME });
    expectFailure("duplicate core", "DUPLICATE_CORE", () =>
      assertOnePhysicalCore([
        join(firstCore, "package.json"),
        join(secondCore, "package.json"),
      ]),
    );
    controls += 1;

    const zeroReport = join(root, "zero-tests.json");
    writeJson(zeroReport, {
      success: true,
      numTotalTestSuites: 0,
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      testResults: [],
    });
    expectFailure("zero-test JSON", "VITEST_ZERO", () =>
      validatePositiveVitestReport(zeroReport, []),
    );
    controls += 1;

    expectFailure("failed child", "CHILD_PROCESS", () =>
      runChild(process.execPath, ["-e", "process.exit(23)"], {
        label: "self-test failed child",
      }),
    );
    controls += 1;

    assert(controls === 6, "SELF_TEST", `expected six controls, ran ${controls}`);
    console.log(
      `PHASE09_PACKAGE_SELF_TEST ${JSON.stringify({ controls, status: "passed" })}`,
    );
  } finally {
    removeOwnedTempRoot(root);
  }
}

function archiveDigestSummary(archives) {
  return Object.freeze(
    Object.fromEntries(
      PACKAGE_SPECS.map((spec) => [
        archives[spec.key].name,
        archives[spec.key].sha256,
      ]),
    ),
  );
}

function runSubstantiveMode(mode) {
  const exportDirectory = validateExportDirectory(mode);
  const root = createOwnedTempRoot();
  try {
    const archives = buildAndPackTriplet(root);
    const tarEntryCounts = validateTripletArtifacts(archives);
    const digests = archiveDigestSummary(archives);

    if (mode === "artifacts") {
      const artifacts = runArtifactStage(root, archives);
      console.log(
        `PHASE09_PACKAGE_RESULT ${JSON.stringify({ mode, status: "passed", digests, tarEntryCounts, typescript: artifacts.typescript, serverTests: artifacts.serverTests, physicalCore: artifacts.consumer.topology.physicalCore })}`,
      );
      return;
    }

    if (mode === "svelte-consent") {
      const consumer = createConsumer(root, archives, "svelte-consent-consumer");
      runConsentRedFixture(consumer.directory);
      fail("RED:09-08-02:CONSENT", "real compiler-transformed Svelte consent probe unexpectedly passed");
    }

    if (mode === "mismatch") {
      fail(
        "RED:09-08-02:MISMATCH",
        "literal-only React and Svelte public lifecycle mismatch probes are not implemented",
      );
    }

    const artifacts = runArtifactStage(root, archives);
    void artifacts;
    fail("RED:09-08-02", "all mode awaits consent and mismatch stages");

    if (exportDirectory !== null) {
      exportArchives(exportDirectory, archives);
    }
  } finally {
    removeOwnedTempRoot(root);
  }
}

const mode = readMode(process.argv.slice(2));

if (mode === "self-test") {
  runSelfTests();
} else {
  runSubstantiveMode(mode);
}
