#!/usr/bin/env node

const MODES = Object.freeze([
  "artifacts",
  "svelte-consent",
  "mismatch",
  "all",
  "self-test",
]);

function readMode(argv) {
  if (argv.length !== 1 || !MODES.includes(argv[0])) {
    throw new Error(
      `usage: node scripts/phase-09-package-check.mjs ${MODES.join("|")}`,
    );
  }

  return argv[0];
}

const mode = readMode(process.argv.slice(2));

throw new Error(
  `[RED:09-08-01] exact three-archive package harness is not implemented (${mode})`,
);
