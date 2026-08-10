#!/usr/bin/env node

import assert from "node:assert/strict";

const MODES = Object.freeze([
  "baseline-record",
  "baseline-verify",
  "post-skeleton",
  "final",
  "self-test",
]);

const INITIAL_IDS = Object.freeze([
  "C09-01-VITEST-ROUTING",
  "C09-02-REACT-SKELETON",
  "C09-03-REACT-RUNTIME",
  "C09-04-REACT-ARTIFACT",
  "C09-05-SVELTE-SKELETON",
  "C09-06-SVELTE-RUNTIME",
  "C09-07-SVELTE-ARTIFACT",
  "C09-08-ASTRO-SSR",
  "C09-09-EXACT-TARBALL",
  "C09-10-ADAPTER-BUDGET",
  "C09-11-MUTATION-CLOSURE",
]);

const POST_SKELETON_IDS = Object.freeze([
  "C09-03-REACT-RUNTIME",
  "C09-04-REACT-ARTIFACT",
  "C09-06-SVELTE-RUNTIME",
  "C09-07-SVELTE-ARTIFACT",
  "C09-08-ASTRO-SSR",
  "C09-09-EXACT-TARBALL",
  "C09-10-ADAPTER-BUDGET",
  "C09-11-MUTATION-CLOSURE",
]);

function parseInvocation(argv) {
  return argv[0];
}

function validateIds() {}

function requireRegularNonempty() {}

function requirePositiveMatches() {}

function selfTest() {
  assert.throws(() => parseInvocation(["unknown"]), /unknown mode/);
  assert.throws(() => validateIds([INITIAL_IDS[0], INITIAL_IDS[0]], 2), /duplicate/);
  assert.throws(() => validateIds(INITIAL_IDS.slice(0, -1), 11), /cardinality/);
  assert.throws(() => requireRegularNonempty("missing.file"), /regular nonempty file/);
  assert.throws(() => requirePositiveMatches("fixture", /never-matches/), /zero matches/);
}

const mode = parseInvocation(process.argv.slice(2));

if (mode === "self-test") {
  selfTest();
} else if (MODES.includes(mode)) {
  throw new Error(`${mode} is not implemented`);
}

void POST_SKELETON_IDS;
