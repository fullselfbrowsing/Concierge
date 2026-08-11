#!/usr/bin/env node

const MODES = new Set(["check", "self-test"]);
const LIMIT = 150;

const ADAPTERS = Object.freeze([
  Object.freeze({
    name: "@fullselfbrowsing/concierge-react",
    root: "packages/concierge-react",
    expected: Object.freeze([
      "packages/concierge-react/src/client.tsx",
      "packages/concierge-react/src/index.ts",
    ]),
  }),
  Object.freeze({
    name: "@fullselfbrowsing/concierge-svelte",
    root: "packages/concierge-svelte",
    expected: Object.freeze([
      "packages/concierge-svelte/src/client.svelte.ts",
      "packages/concierge-svelte/src/index.ts",
    ]),
  }),
]);

class GateError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.name = "GateError";
    this.code = code;
  }
}

function validateSpecification() {
  if (ADAPTERS.length !== 2) {
    throw new GateError("VACUOUS_SPEC", "expected exactly two adapter budgets");
  }

  for (const adapter of ADAPTERS) {
    if (adapter.expected.length !== 2 || LIMIT !== 150) {
      throw new GateError(
        "VACUOUS_SPEC",
        `${adapter.name} must declare exactly two files and an independent 150-line limit`,
      );
    }
  }
}

async function runInventoryAndBudgetGate() {
  validateSpecification();
  throw new GateError(
    "INVENTORY_GATE_UNIMPLEMENTED",
    "exact recursive discovery and lexical line counting are not implemented",
  );
}

async function main() {
  const [mode, ...extra] = process.argv.slice(2);

  if (mode === undefined || !MODES.has(mode) || extra.length !== 0) {
    throw new GateError(
      "CLI_MODE",
      "usage: node scripts/phase-09-adapter-budget.mjs <check|self-test>",
    );
  }

  await runInventoryAndBudgetGate();
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
