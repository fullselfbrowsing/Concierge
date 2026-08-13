#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT,
  assert,
  exactKeys,
  isReleaseLineVersion,
  isStableVersion,
  loadReleaseLine,
  pathInsideRoot,
  sha256File,
} from "./config.mjs";

const MODES = Object.freeze(["config", "source", "release", "workflow", "all"]);
const CORE = "@fullselfbrowsing/concierge";

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `[JSON] ${label} is not strict JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function assertPackageManifest(config, spec, manifest, mode) {
  assert(manifest.name === spec.name, "PACKAGE_NAME", `${spec.path} has the wrong name`);
  assert(
    isStableVersion(manifest.version),
    "PACKAGE_VERSION",
    `${spec.name} must have a stable semantic version`,
  );
  if (mode === "release") {
    assert(
      isReleaseLineVersion(manifest.version, config.releaseLine),
      "PACKAGE_VERSION",
      `${spec.name} must be on the stable ${config.releaseLine} release line`,
    );
  }
  assert(
    manifest.private !== true && manifest.type === "module" && manifest.sideEffects === false,
    "PACKAGE_FORMAT",
    `${spec.name} must remain public, ESM-only, and side-effect-free`,
  );
  assert(
    manifest.engines?.node === config.node.consumerEngine,
    "PACKAGE_ENGINE",
    `${spec.name} Node engine drifted`,
  );
  exactKeys(
    manifest.publishConfig,
    ["access", "tag"],
    "PACKAGE_DESTINATION",
    `${spec.name} publishConfig`,
  );
  assert(
    manifest.publishConfig.access === "public" &&
      manifest.publishConfig.tag === config.distTag,
    "PACKAGE_DESTINATION",
    `${spec.name} must publish publicly on ${config.distTag}`,
  );
  exactKeys(
    manifest.repository,
    ["type", "url", "directory"],
    "PACKAGE_REPOSITORY",
    `${spec.name} repository`,
  );
  assert(
    manifest.repository.type === "git" &&
      manifest.repository.url === config.repositoryUrl &&
      manifest.repository.directory === spec.path,
    "PACKAGE_REPOSITORY",
    `${spec.name} repository identity must exactly match the OIDC repository`,
  );
  assert(
    manifest.exports?.["./package.json"] === "./package.json",
    "PACKAGE_EXPORTS",
    `${spec.name} must export its package manifest`,
  );

  if (spec.requiresCore) {
    const corePeer = manifest.peerDependencies?.[CORE];
    const canonical = corePeer === "workspace:^";
    const transitionMatch = /^workspace:\^(\d+\.\d+\.\d+) \|\| \^(\d+\.\d+\.\d+)$/u.exec(
      corePeer ?? "",
    );
    const transition = transitionMatch !== null &&
      isReleaseLineVersion(transitionMatch[2], config.releaseLine);
    assert(
      canonical || (mode !== "release" && transition),
      "PACKAGE_CORE_PEER",
      `${spec.name} must use canonical workspace:^ or a bounded ${config.releaseLine} transition`,
    );
    assert(
      manifest.devDependencies?.[CORE] === "workspace:*" &&
        manifest.dependencies?.[CORE] === undefined,
      "PACKAGE_CORE_PEER",
      `${spec.name} must keep core as peer plus development dependency only`,
    );
  }

  if (spec.role === "core") {
    assert(
      manifest.peerDependencies?.ai === config.compatibility.ai &&
        manifest.peerDependenciesMeta?.ai?.optional === true &&
        manifest.dependencies?.ai === undefined,
      "PACKAGE_AI_PEER",
      "Core must expose AI SDK support through an optional peer",
    );
    const expectedExports = [
      ".",
      "./ai-sdk",
      "./ai-sdk/server",
      "./ai-sdk/browser",
      "./package.json",
    ];
    assert(
      JSON.stringify(Object.keys(manifest.exports ?? {})) ===
        JSON.stringify(expectedExports),
      "PACKAGE_EXPORTS",
      "Core and AI SDK subpath exports drifted",
    );
    assert(
      manifest.exports["./ai-sdk/server"]?.browser ===
        "./dist/ai-sdk/server-unavailable.js",
      "PACKAGE_EXPORTS",
      "AI SDK server export must fail closed in browser resolution",
    );
  } else if (spec.role === "react") {
    assert(
      manifest.peerDependencies?.react === config.compatibility.react &&
        manifest.peerDependencies?.["react-dom"] === config.compatibility.reactDom,
      "PACKAGE_FRAMEWORK_PEER",
      "React peer ranges drifted",
    );
  } else if (spec.role === "svelte") {
    assert(
      manifest.peerDependencies?.svelte === config.compatibility.svelte,
      "PACKAGE_FRAMEWORK_PEER",
      "Svelte peer range drifted",
    );
  }
}

function checkChangesets(config) {
  const changesets = readJson(join(ROOT, ".changeset/config.json"), "Changesets config");
  assert(
    Array.isArray(changesets.fixed) && changesets.fixed.length === 1 &&
      JSON.stringify(changesets.fixed[0]) ===
        JSON.stringify(config.packages.map((entry) => entry.name)),
    "CHANGESETS_FIXED",
    "Changesets must contain the exact ordered release set in one fixed group",
  );
  assert(
    changesets.access === "public" && changesets.ignore?.length === 0 &&
      changesets.privatePackages === false &&
      changesets.updateInternalDependencies === "patch" &&
      changesets.___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH
        ?.onlyUpdatePeerDependentsWhenOutOfRange === true,
    "CHANGESETS_POLICY",
    "Changesets public/fixed peer policy drifted",
  );
}

function checkContractV2() {
  const core = readFileSync(join(ROOT, "packages/concierge/src/contract.ts"), "utf8");
  assert(
    /export const CONTRACT_VERSION = 2;/u.test(core),
    "CONTRACT_VERSION",
    "core must publish contract v2",
  );
  for (const relativePath of [
    "packages/concierge-react/src/client.tsx",
    "packages/concierge-svelte/src/client.svelte.ts",
  ]) {
    const source = readFileSync(join(ROOT, relativePath), "utf8");
    assert(
      /EXPECTED_CONTRACT_VERSION(?:\s*:\s*number)?\s*=\s*2/u.test(source),
      "CONTRACT_VERSION",
      `${relativePath} must reject non-v2 core before registration`,
    );
  }
}

function checkSource(config, mode) {
  const manifests = [];
  for (const spec of config.packages) {
    const directory = pathInsideRoot(spec.path, `${spec.name} package path`);
    const manifest = readJson(join(directory, "package.json"), `${spec.name} manifest`);
    assertPackageManifest(config, spec, manifest, mode);
    manifests.push(manifest);
  }
  assert(
    manifests.every((manifest) => manifest.version === manifests[0].version),
    "PACKAGE_VERSION",
    `fixed package versions differ: ${manifests
      .map((manifest) => `${manifest.name}@${manifest.version}`)
      .join(", ")}`,
  );
  checkChangesets(config);
  checkContractV2();
  return manifests[0].version;
}

function checkWorkflow(config) {
  const workflow = readFileSync(join(ROOT, config.workflowPath), "utf8");
  for (const required of [
    "environment: npm-production",
    "id-token: write",
    "scripts/release/version.mjs apply",
    "scripts/release/package.mjs export",
    "scripts/release/seal.mjs",
    "prepare-sealed-example",
    "CONCIERGE_RELEASE_BROWSERS: \"1\"",
    "chromium firefox webkit",
    "release-publisher.mjs",
  ]) {
    assert(
      workflow.includes(required),
      "WORKFLOW_SURFACE",
      `release workflow is missing ${required}`,
    );
  }
  assert(
    !workflow.includes("phase-09") && !workflow.includes("NPM_TOKEN") &&
      !workflow.includes("NODE_AUTH_TOKEN") && !workflow.includes("PLACEHOLDER"),
    "WORKFLOW_SURFACE",
    "live release workflow must not use historical tooling, npm tokens, or digest placeholders",
  );
  for (const [file, sealedName] of [
    ["scripts/release/config.mjs", "config.mjs"],
    ["scripts/release/publisher.mjs", "release-publisher.mjs"],
    [".release/lines/0.2.json", "release-line.json"],
  ]) {
    const digest = sha256File(join(ROOT, file));
    assert(
      workflow.includes(`${JSON.stringify(sealedName)}: ${JSON.stringify(digest)}`),
      "WORKFLOW_DIGEST",
      `${sealedName} workflow digest is absent or stale`,
    );
  }
  const browserStart = workflow.indexOf("\n  browser_e2e:");
  const publishStart = workflow.indexOf("\n  publish:");
  assert(
    browserStart >= 0 && publishStart > browserStart &&
      workflow.slice(publishStart).includes("needs: [seal, browser_e2e]"),
    "WORKFLOW_SURFACE",
    "sealed archive browser certification must gate publish",
  );
  const publishJob = workflow.slice(publishStart);
  assert(
    !publishJob.includes("actions/checkout") &&
      !/\bpnpm\s+(?:install|build|test)\b/u.test(publishJob) &&
      !/\bnpm\s+(?:install|ci)\b/u.test(publishJob),
    "WORKFLOW_PRIVILEGE",
    "OIDC publish job must not checkout, install, build, or test repository code",
  );
}

function run(mode) {
  assert(MODES.includes(mode), "USAGE", `mode must be ${MODES.join("|")}`);
  const config = loadReleaseLine();
  let version = null;
  if (["source", "release", "all"].includes(mode)) {
    version = checkSource(config, mode === "release" || mode === "all" ? "release" : "source");
  }
  if (["workflow", "all"].includes(mode)) checkWorkflow(config);
  process.stdout.write(
    `${JSON.stringify({
      status: "passed",
      mode,
      releaseLine: config.releaseLine,
      contractVersion: config.contractVersion,
      distTag: config.distTag,
      packageSetSha256: config.sha256,
      version,
      packages: config.packages.map((entry) => entry.name),
    })}\n`,
  );
}

run(process.argv[2] ?? "all");
