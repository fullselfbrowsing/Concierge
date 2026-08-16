#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROOT,
  assert,
  isReleaseLineVersion,
  loadReleaseLine,
} from "./config.mjs";

const CORE = "@full-self-browsing/concierge";

function run(command, arguments_, label) {
  const result = spawnSync(command, arguments_, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" },
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 180_000,
  });
  assert(
    result.error === undefined && result.signal === null && result.status === 0,
    "PROCESS",
    `${label} failed: ${result.error?.message ?? `${result.stdout}${result.stderr}`}`,
  );
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
}

function readManifest(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeManifest(path, manifest) {
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function analyzeSourceCorePeer(peer, currentVersion, releaseLine) {
  if (peer === "workspace:^") return Object.freeze({ canonical: true, target: null });
  const match = /^workspace:\^(\d+\.\d+\.\d+) \|\| \^(\d+\.\d+\.\d+)$/u.exec(
    peer ?? "",
  );
  assert(match !== null, "VERSION_PEER", `source core peer is not bounded: ${peer}`);
  assert(
    match[1] === currentVersion && isReleaseLineVersion(match[2], releaseLine),
    "VERSION_PEER",
    `transition must start at ${currentVersion} and target the ${releaseLine} line`,
  );
  return Object.freeze({ canonical: false, target: match[2] });
}

function applyVersion() {
  const config = loadReleaseLine();
  const corePath = join(ROOT, config.packages[0].path, "package.json");
  const beforeCore = readManifest(corePath);
  const peerStates = new Map();
  for (const spec of config.packages.filter((entry) => entry.requiresCore)) {
    const path = join(ROOT, spec.path, "package.json");
    const manifest = readManifest(path);
    peerStates.set(spec.name, analyzeSourceCorePeer(
      manifest.peerDependencies?.[CORE],
      beforeCore.version,
      config.releaseLine,
    ));
  }

  run("pnpm", ["exec", "changeset", "version"], "Changesets version calculation");

  const manifests = config.packages.map((spec) => ({
    spec,
    path: join(ROOT, spec.path, "package.json"),
    manifest: readManifest(join(ROOT, spec.path, "package.json")),
  }));
  const version = manifests[0].manifest.version;
  assert(
    isReleaseLineVersion(version, config.releaseLine) &&
      manifests.every((entry) => entry.manifest.version === version),
    "VERSION_SET",
    `Changesets did not produce one stable ${config.releaseLine} trio: ${manifests
      .map((entry) => `${entry.manifest.name}@${entry.manifest.version}`)
      .join(", ")}`,
  );

  let normalized = false;
  for (const entry of manifests.filter(({ spec }) => spec.requiresCore)) {
    const state = peerStates.get(entry.spec.name);
    if (!state.canonical) {
      assert(
        state.target === version,
        "VERSION_PEER",
        `${entry.spec.name} transition targeted ${state.target}, not ${version}`,
      );
    }
    if (entry.manifest.peerDependencies?.[CORE] !== "workspace:^") {
      entry.manifest.peerDependencies[CORE] = "workspace:^";
      writeManifest(entry.path, entry.manifest);
      normalized = true;
    }
  }
  if (normalized) {
    run(
      "pnpm",
      ["install", "--lockfile-only", "--ignore-scripts"],
      "normalize workspace peers in the lockfile",
    );
  }
  run(
    process.execPath,
    ["scripts/release/check.mjs", "release"],
    "validate versioned trio",
  );
}

function selfTest() {
  const config = loadReleaseLine();
  assert(
    analyzeSourceCorePeer("workspace:^", config.initialVersion, config.releaseLine).canonical,
    "SELF_TEST",
    "canonical peer failed",
  );
  const transition = analyzeSourceCorePeer(
    "workspace:^0.1.0 || ^0.2.0",
    "0.1.0",
    config.releaseLine,
  );
  assert(
    transition.canonical === false && transition.target === "0.2.0",
    "SELF_TEST",
    "bounded peer transition failed",
  );
  let rejected = false;
  try {
    analyzeSourceCorePeer("workspace:>=0.0.0", "0.1.0", config.releaseLine);
  } catch (error) {
    rejected = String(error).includes("[VERSION_PEER]");
  }
  assert(rejected, "SELF_TEST", "broad peer transition was accepted");
  process.stdout.write("release version self-test passed\n");
}

const command = process.argv[2];
if (command === "apply") applyVersion();
else if (command === "self-test") selfTest();
else throw new Error("usage: node scripts/release/version.mjs apply|self-test");
