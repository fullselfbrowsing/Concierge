#!/usr/bin/env node

import { lstatSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_PATHS = Object.freeze([
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
]);

if (process.argv.length !== 2) {
  throw new Error("phase-09-workflow-check accepts no arguments");
}

for (const path of WORKFLOW_PATHS) {
  const absolute = resolve(REPOSITORY_ROOT, path);
  const metadata = lstatSync(absolute);
  const source = readFileSync(absolute, "utf8");
  if (!metadata.isFile() || metadata.size <= 0 || source.trim().length === 0) {
    throw new Error(`${path} must be a nonempty regular file`);
  }
}

throw new Error("[RED:09-11-02:WORKFLOW_INVARIANTS_UNIMPLEMENTED]");
