#!/usr/bin/env node

import { lstatSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS = Object.freeze([
  "react-lifecycle",
  "svelte-lifecycle",
  "node-artifact-ssr",
]);
const EXPECTED_TEST_FILES = Object.freeze([
  "packages/concierge-react/test/lifecycle.test.tsx",
  "packages/concierge-svelte/test/lifecycle.test.ts",
  "packages/concierge-react/test/artifact.test.ts",
  "packages/concierge-svelte/test/artifact.test.ts",
  "examples/adapter-ssr/test/ssr.test.ts",
]);

if (process.argv.length !== 2) {
  throw new Error("phase-09-test-check accepts no arguments");
}

for (const path of EXPECTED_TEST_FILES) {
  const metadata = lstatSync(resolve(REPOSITORY_ROOT, path));
  if (!metadata.isFile() || metadata.size <= 0) {
    throw new Error(`${path} must be a nonempty regular file`);
  }
}

throw new Error(
  `[RED:09-11-01:EXACT_VITEST_ORCHESTRATOR_UNIMPLEMENTED] ` +
    `projects=${PROJECTS.join(",")} files=${EXPECTED_TEST_FILES.length}`,
);
