#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import {
  ROOT,
  assert,
  exactKeys,
  exactRegularFile,
  integrityFile,
  isReleaseLineVersion,
  loadReleaseLine,
  sha256,
  sha256File,
  stableJson,
} from "./config.mjs";
import {
  exactDirectory,
  validateArchiveDirectory,
} from "./archive.mjs";

const CORE = "@full-self-browsing/concierge";
const AI_MATRIX = Object.freeze(["6.0.0", "6.0.253", "7.0.0", "7.0.64"]);
const FRAMEWORK_MATRIX = Object.freeze([
  Object.freeze({
    label: "minimum",
    react: "18.2.0",
    reactDom: "18.2.0",
    reactTypes: "18.3.27",
    reactDomTypes: "18.3.7",
    svelte: "5.0.0",
    typescript: "5.7.3",
  }),
  Object.freeze({
    label: "current",
    react: "19.2.8",
    reactDom: "19.2.8",
    reactTypes: "19.2.18",
    reactDomTypes: "19.2.4",
    svelte: "5.56.9",
    typescript: "6.0.3",
  }),
]);
const NEXT_MATRIX = Object.freeze([
  Object.freeze({
    label: "ai6-current",
    ai: "6.0.253",
    react: "3.0.256",
    openrouter: "2.10.0",
  }),
  Object.freeze({
    label: "ai7-current",
    ai: "7.0.64",
    react: "4.0.67",
    openrouter: "3.0.0",
  }),
]);
const SHA256 = /^[0-9a-f]{64}$/u;

function cleanEnvironment() {
  const environment = {
    ...process.env,
    CI: "1",
    FORCE_COLOR: "0",
    NO_COLOR: "1",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  for (const name of ["GITHUB_TOKEN", "GH_TOKEN", "NPM_TOKEN", "NODE_AUTH_TOKEN"]) {
    delete environment[name];
  }
  return environment;
}

function run(command, arguments_, label, cwd, timeout = 240_000) {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    env: cleanEnvironment(),
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
  });
  assert(
    result.error === undefined && result.signal === null && result.status === 0,
    "COMPAT_PROCESS",
    `${label} failed: ${result.error?.message ?? `${result.stdout}${result.stderr}`}`,
  );
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function localDependencies(inputs) {
  return Object.fromEntries(
    inputs.archives.map((archive) => [archive.name, `file:${archive.path}`]),
  );
}

function install(directory, label) {
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      "--strict-peer-deps",
    ],
    `${label} install`,
    directory,
  );
}

function runTopologyProbe(directory, packageNames, version, label) {
  const path = join(directory, "verify-topology.mjs");
  writeFileSync(
    path,
    `import { readFileSync, realpathSync } from "node:fs";\n` +
      `import { createRequire } from "node:module";\n` +
      `import { sep } from "node:path";\n` +
      `const require = createRequire(import.meta.url);\n` +
      `const coreName = ${JSON.stringify(CORE)};\n` +
      `const repository = ${JSON.stringify(`${ROOT}${sep}`)};\n` +
      `const expectedVersion = ${JSON.stringify(version)};\n` +
      `const names = ${JSON.stringify(packageNames)};\n` +
      `const corePath = realpathSync(require.resolve(coreName + "/package.json"));\n` +
      `if (corePath.startsWith(repository)) throw new Error("consumer resolved workspace core");\n` +
      `for (const name of names) {\n` +
      `  const manifestPath = realpathSync(require.resolve(name + "/package.json"));\n` +
      `  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));\n` +
      `  if (manifest.version !== expectedVersion) throw new Error(name + " archive version drifted");\n` +
      `  if (name !== coreName) {\n` +
      `    const fromAdapter = realpathSync(createRequire(manifestPath).resolve(coreName + "/package.json"));\n` +
      `    if (fromAdapter !== corePath) throw new Error(name + " resolved a second physical core");\n` +
      `  }\n` +
      `}\n` +
      `const consumer = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));\n` +
      `for (const name of names) {\n` +
      `  const specifier = consumer.dependencies?.[name];\n` +
      `  if (typeof specifier !== "string" || !specifier.startsWith("file:") || specifier.includes("workspace:")) {\n` +
      `    throw new Error(name + " was not installed from an exact archive");\n` +
      `  }\n` +
      `}\n` +
      `process.stdout.write(JSON.stringify({ corePath, packages: names }) + "\\n");\n`,
    "utf8",
  );
  run(process.execPath, [basename(path)], `${label} physical-core topology`, directory);
}

function runAdapterCell(root, inputs, aiVersion) {
  const directory = join(root, `adapter-ai-${aiVersion.replaceAll(".", "-")}`);
  mkdirSync(directory);
  const archives = localDependencies(inputs);
  writeJson(join(directory, "package.json"), {
    name: `concierge-ai-${aiVersion}-foreign-consumer`,
    private: true,
    type: "module",
    dependencies: {
      [CORE]: archives[CORE],
      ai: aiVersion,
      zod: "4.4.3",
    },
  });
  writeFileSync(
    join(directory, "smoke.mjs"),
    `import { CONTRACT_VERSION } from "@full-self-browsing/concierge";\n` +
      `import { EXPECTED_CORE_CONTRACT_VERSION, SIGNED_ENVELOPE_VERSION, toAISDKTools } from "@full-self-browsing/concierge/ai-sdk";\n` +
      `const server = await import("@full-self-browsing/concierge/ai-sdk/server");\n` +
      `const browser = await import("@full-self-browsing/concierge/ai-sdk/browser");\n` +
      `const telemetry = await import("@full-self-browsing/concierge/telemetry");\n` +
      `if (CONTRACT_VERSION !== 2 || EXPECTED_CORE_CONTRACT_VERSION !== 2 || SIGNED_ENVELOPE_VERSION !== 1) throw new Error("contract drift");\n` +
      `if (typeof server.createSignedBatchIssuer !== "function" || typeof browser.createSignedBrowserBridge !== "function") throw new Error("subpath export drift");\n` +
      `if (JSON.stringify(Object.keys(telemetry).sort()) !== JSON.stringify(["getConciergeTelemetryStatus","mountConciergeTelemetry","onConciergeTelemetryStatusChange","setConciergeTelemetryEnabled"])) throw new Error("telemetry subpath export drift");\n` +
      `const tools = toAISDKTools([{ type: "function", name: "probe", description: "Probe", parameters: { type: "object", properties: { value: { type: "string" } }, required: ["value"], additionalProperties: false } }]);\n` +
      `if (!Object.isFrozen(tools) || typeof tools.probe !== "object" || tools.probe === null || !("inputSchema" in tools.probe) || "execute" in tools.probe) throw new Error("tool conversion drift");\n` +
      `process.stdout.write(JSON.stringify({ ai: ${JSON.stringify(aiVersion)}, contract: CONTRACT_VERSION, tools: Object.keys(tools) }) + "\\n");\n`,
    "utf8",
  );
  install(directory, `AI SDK ${aiVersion}`);
  runTopologyProbe(
    directory,
    [CORE],
    inputs.version,
    `AI SDK ${aiVersion}`,
  );
  run(process.execPath, ["smoke.mjs"], `AI SDK ${aiVersion} ESM smoke`, directory);
}

function runFrameworkCell(root, inputs, cell) {
  const directory = join(root, `framework-${cell.label}`);
  mkdirSync(directory);
  const archives = localDependencies(inputs);
  writeJson(join(directory, "package.json"), {
    name: `concierge-framework-${cell.label}-foreign-consumer`,
    private: true,
    type: "module",
    dependencies: {
      [CORE]: archives[CORE],
      "@full-self-browsing/concierge-react":
        archives["@full-self-browsing/concierge-react"],
      "@full-self-browsing/concierge-svelte":
        archives["@full-self-browsing/concierge-svelte"],
      react: cell.react,
      "react-dom": cell.reactDom,
      svelte: cell.svelte,
    },
    devDependencies: {
      "@types/node": "24.10.1",
      "@types/react": cell.reactTypes,
      "@types/react-dom": cell.reactDomTypes,
      typescript: cell.typescript,
    },
  });
  writeFileSync(
    join(directory, "smoke.mjs"),
    `import { createElement } from "react";\n` +
      `import { renderToString } from "react-dom/server";\n` +
      `import { CONTRACT_VERSION } from "@full-self-browsing/concierge";\n` +
      `const reactRoot = await import("@full-self-browsing/concierge-react");\n` +
      `const reactClient = await import("@full-self-browsing/concierge-react/client");\n` +
      `const svelteRoot = await import("@full-self-browsing/concierge-svelte");\n` +
      `const svelteClient = await import("@full-self-browsing/concierge-svelte/client.svelte");\n` +
      `const html = renderToString(createElement(reactClient.ConciergeProvider, { concierge: {} }, createElement("span", null, "ssr")));\n` +
      `if (CONTRACT_VERSION !== 2 || html !== "<span>ssr</span>" || typeof reactRoot !== "object" || typeof svelteRoot !== "object" || typeof svelteClient.provideConcierge !== "function") throw new Error("framework ESM SSR import drift");\n` +
      `process.stdout.write(JSON.stringify({ react: ${JSON.stringify(cell.react)}, svelte: ${JSON.stringify(cell.svelte)}, html }) + "\\n");\n`,
    "utf8",
  );
  writeFileSync(
    join(directory, "consumer.ts"),
      `import type { Bridge, BridgeRegistry, Concierge } from "@full-self-browsing/concierge";\n` +
      `import type { ConciergeTelemetryStatus } from "@full-self-browsing/concierge/telemetry";\n` +
      `import { getConciergeTelemetryStatus, mountConciergeTelemetry, onConciergeTelemetryStatusChange, setConciergeTelemetryEnabled } from "@full-self-browsing/concierge/telemetry";\n` +
      `import type { Concierge as ReactConcierge } from "@full-self-browsing/concierge-react";\n` +
      `import { ConciergeProvider, useConcierge as useReactConcierge, useConciergeBridge as useReactBridge } from "@full-self-browsing/concierge-react/client";\n` +
      `import type { Concierge as SvelteConcierge } from "@full-self-browsing/concierge-svelte";\n` +
      `import { provideConcierge, useConcierge as useSvelteConcierge, useConciergeBridge as useSvelteBridge } from "@full-self-browsing/concierge-svelte/client.svelte";\n` +
      `import { createElement } from "react";\n` +
      `import { renderToString } from "react-dom/server";\n` +
      `declare const concierge: Concierge & ReactConcierge & SvelteConcierge;\n` +
      `declare const registry: BridgeRegistry<Bridge>;\n` +
      `declare const bridge: Bridge;\n` +
      `const reactGetter: () => Concierge = useReactConcierge;\n` +
      `const svelteGetter: () => Concierge = useSvelteConcierge;\n` +
      `const element = createElement(ConciergeProvider, { concierge }, "typed");\n` +
      `const html: string = renderToString(element);\n` +
      `if (false) { const release: () => void = mountConciergeTelemetry(concierge); const pending: Promise<ConciergeTelemetryStatus> = getConciergeTelemetryStatus(); const unlisten: () => void = onConciergeTelemetryStatusChange(() => {}); const enabled: Promise<ConciergeTelemetryStatus> = setConciergeTelemetryEnabled(true); release(); unlisten(); void pending; void enabled; provideConcierge(concierge); useReactBridge(registry, bridge); useSvelteBridge(() => registry, () => bridge); }\n` +
      `void reactGetter; void svelteGetter; void html;\n`,
    "utf8",
  );
  writeJson(join(directory, "tsconfig.json"), {
    compilerOptions: {
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      jsx: "react-jsx",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      types: ["node", "react", "react-dom"],
    },
    include: ["consumer.ts"],
  });
  install(directory, `framework ${cell.label}`);
  runTopologyProbe(
    directory,
    [CORE, "@full-self-browsing/concierge-react", "@full-self-browsing/concierge-svelte"],
    inputs.version,
    `framework ${cell.label}`,
  );
  run(process.execPath, ["smoke.mjs"], `framework ${cell.label} ESM SSR smoke`, directory);
  run(
    join(directory, "node_modules/.bin/tsc"),
    ["--project", "tsconfig.json"],
    `framework ${cell.label} declaration smoke`,
    directory,
  );
}

function copyExample(source, destination) {
  cpSync(source, destination, {
    recursive: true,
    filter(path) {
      const name = basename(path);
      return name !== "node_modules" && name !== ".next";
    },
  });
}

function configureNextExample(directory, inputs, cell, buildOnly) {
  const manifestPath = join(directory, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const archives = localDependencies(inputs);
  manifest.name = `concierge-next-${cell.label}-foreign-consumer`;
  if (buildOnly) manifest.scripts = { build: "next build" };
  manifest.dependencies = {
    ...manifest.dependencies,
    "@ai-sdk/react": cell.react,
    [CORE]: archives[CORE],
    "@full-self-browsing/concierge-react":
      archives["@full-self-browsing/concierge-react"],
    "@full-self-browsing/concierge-svelte":
      archives["@full-self-browsing/concierge-svelte"],
    "@openrouter/ai-sdk-provider": cell.openrouter,
    ai: cell.ai,
    svelte: FRAMEWORK_MATRIX.at(-1).svelte,
  };
  writeJson(manifestPath, manifest);
}

function installNextExample(directory, inputs, cell, buildOnly) {
  configureNextExample(directory, inputs, cell, buildOnly);
  install(directory, `Next ${cell.label}`);
  runTopologyProbe(
    directory,
    inputs.archives.map((archive) => archive.name),
    inputs.version,
    `Next ${cell.label}`,
  );
  run("npm", ["run", "build"], `Next ${cell.label} build`, directory, 360_000);
}

function runNextCell(root, inputs, cell) {
  const directory = join(root, `next-${cell.label}`);
  copyExample(join(ROOT, "examples/next-ai-sdk"), directory);
  installNextExample(directory, inputs, cell, true);
}

function assertExternalNewDirectory(configuredDirectory, label) {
  const directory = resolve(configuredDirectory);
  const relation = relative(ROOT, directory);
  assert(
    (relation === ".." || relation.startsWith(`..${sep}`)) && !existsSync(directory),
    "COMPAT_PATH",
    `${label} must be a new path outside the repository`,
  );
  return directory;
}

function prepareExample(inputs, configuredDirectory) {
  const directory = assertExternalNewDirectory(configuredDirectory, "example output");
  copyExample(join(ROOT, "examples/next-ai-sdk"), directory);
  installNextExample(directory, inputs, NEXT_MATRIX.at(-1), false);
  process.stdout.write(
    `${JSON.stringify({
      status: "prepared",
      version: inputs.version,
      directory,
      packages: inputs.archives.map((archive) => archive.name),
    })}\n`,
  );
}

function validateSealedArchiveSet(configuredDirectory) {
  const config = loadReleaseLine();
  const directory = exactDirectory(resolve(configuredDirectory), "sealed release directory");
  const sealPath = exactRegularFile(join(directory, "release-seal.json"), "release seal");
  let seal;
  try {
    seal = JSON.parse(readFileSync(sealPath, "utf8"));
  } catch (error) {
    throw new Error(
      `[COMPAT_SEAL] release seal is invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
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
    "COMPAT_SEAL",
    "release seal",
  );
  const { contentDigest, ...body } = seal;
  assert(
    SHA256.test(contentDigest) && sha256(stableJson(body)) === contentDigest &&
      seal.schemaVersion === 1 && seal.releaseAuthorization === true &&
      seal.releaseLine === config.releaseLine &&
      seal.contractVersion === config.contractVersion &&
      isReleaseLineVersion(seal.version, config.releaseLine) && seal.distTag === config.distTag &&
      seal.registry === config.registry && seal.repository === config.repository &&
      seal.sourceRef === config.sourceRef && seal.workflowPath === config.workflowPath &&
      seal.environment === config.environment &&
      seal.packageSetSha256 === config.sha256 &&
      JSON.stringify(seal.packages) ===
        JSON.stringify(config.packages.map((entry) => entry.name)),
    "COMPAT_SEAL",
    "release seal policy or content digest drifted",
  );
  if (process.env.GITHUB_ACTIONS === "true") {
    assert(
      seal.repository === process.env.GITHUB_REPOSITORY &&
        seal.commit === process.env.GITHUB_SHA && seal.sourceRef === process.env.GITHUB_REF,
      "COMPAT_SEAL",
      "release seal does not match this workflow checkout",
    );
  }
  assert(
    Array.isArray(seal.archives) && seal.archives.length === config.packages.length &&
      Array.isArray(seal.tools),
    "COMPAT_SEAL",
    "release seal file lists drifted",
  );
  const expectedFiles = ["release-seal.json"];
  for (const record of [...seal.tools, ...seal.archives]) {
    exactKeys(
      record,
      record.name === undefined
        ? ["file", "sha256"]
        : ["name", "file", "sha256", "integrity"],
      "COMPAT_SEAL",
      `sealed ${record.file}`,
    );
    assert(
      typeof record.file === "string" && basename(record.file) === record.file &&
        SHA256.test(record.sha256),
      "COMPAT_SEAL",
      "sealed file identity drifted",
    );
    const path = exactRegularFile(join(directory, record.file), `sealed ${record.file}`);
    assert(sha256File(path) === record.sha256, "COMPAT_SEAL", `${record.file} digest drifted`);
    if (record.name !== undefined) {
      assert(
        typeof record.integrity === "string" && integrityFile(path) === record.integrity,
        "COMPAT_SEAL",
        `${record.file} integrity drifted`,
      );
    }
    expectedFiles.push(record.file);
  }
  assert(
    JSON.stringify(readdirSync(directory).sort()) === JSON.stringify(expectedFiles.sort()),
    "COMPAT_SEAL",
    "sealed release directory contains missing or extra files",
  );

  const staging = mkdtempSync(join(realpathSync(tmpdir()), "concierge-sealed-archives-"));
  try {
    for (const record of seal.archives) {
      copyFileSync(join(directory, record.file), join(staging, record.file));
    }
    writeJson(join(staging, "release-archives.json"), {
      schemaVersion: 1,
      releaseLine: seal.releaseLine,
      contractVersion: seal.contractVersion,
      version: seal.version,
      distTag: seal.distTag,
      packageSetSha256: seal.packageSetSha256,
      archives: seal.archives,
    });
    const validated = validateArchiveDirectory(config, staging);
    return Object.freeze({
      ...validated,
      directory,
      archives: Object.freeze(validated.archives.map((archive) => Object.freeze({
        ...archive,
        path: join(directory, archive.file),
      }))),
    });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function certify(configuredDirectory) {
  const config = loadReleaseLine();
  const inputs = validateArchiveDirectory(config, resolve(configuredDirectory));
  const root = mkdtempSync(join(realpathSync(tmpdir()), "concierge-compat-"));
  try {
    for (const aiVersion of AI_MATRIX) runAdapterCell(root, inputs, aiVersion);
    for (const cell of FRAMEWORK_MATRIX) runFrameworkCell(root, inputs, cell);
    for (const cell of NEXT_MATRIX) runNextCell(root, inputs, cell);
    process.stdout.write(
      `${JSON.stringify({
        status: "passed",
        version: inputs.version,
        adapterMatrix: AI_MATRIX,
        frameworkMatrix: FRAMEWORK_MATRIX,
        nextMatrix: NEXT_MATRIX,
      })}\n`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function selfTest() {
  const config = loadReleaseLine();
  assert(
    config.compatibility.ai === "^6.0.0 || ^7.0.0" &&
      config.compatibility.react === "^18.2.0 || ^19.0.0" &&
      config.compatibility.svelte === "^5.0.0" &&
      AI_MATRIX[0] === "6.0.0" && AI_MATRIX.at(-1) === "7.0.64" &&
      FRAMEWORK_MATRIX[0].react === "18.2.0" &&
      FRAMEWORK_MATRIX.at(-1).react.startsWith("19.") &&
      FRAMEWORK_MATRIX[0].svelte === "5.0.0" &&
      NEXT_MATRIX.map((entry) => entry.ai[0]).join("") === "67",
    "SELF_TEST",
    "release compatibility matrix drifted",
  );
  process.stdout.write("release compatibility self-test passed\n");
}

const command = process.argv[2];
if (command === "self-test" && process.argv.length === 3) selfTest();
else if (command === "prepare-example" && process.argv.length === 5) {
  const config = loadReleaseLine();
  prepareExample(validateArchiveDirectory(config, resolve(process.argv[3])), process.argv[4]);
} else if (command === "prepare-sealed-example" && process.argv.length === 5) {
  prepareExample(validateSealedArchiveSet(process.argv[3]), process.argv[4]);
} else if (command !== undefined && process.argv.length === 3) certify(command);
else {
  throw new Error(
    "usage: node scripts/release/compatibility.mjs <archive-directory>|self-test|" +
      "prepare-example <archive-directory> <new-output>|" +
      "prepare-sealed-example <sealed-directory> <new-output>",
  );
}
