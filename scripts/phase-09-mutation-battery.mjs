#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
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
import {
  createSecureChildEnvironment,
  mergeSecureChildEnvironment,
  PHASE09_PUBLIC_NPM_REGISTRY,
  runAfterCredentialFreeFinalizationPreflight,
} from "./phase-09-secure-environment.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = realpathSync(resolve(dirname(SCRIPT_PATH), ".."));
const PHASE = "09-react-and-svelte-adapters";
const PHASE_DIRECTORY = join(ROOT, ".planning/phases", PHASE);
const REGISTER_PATH = join(PHASE_DIRECTORY, "09-MUTATION-REGISTER.json");
const MUTATION_EVIDENCE_PATH = join(
  PHASE_DIRECTORY,
  "09-MUTATION-EVIDENCE.json",
);
const RELEASE_EVIDENCE_PATH = join(
  PHASE_DIRECTORY,
  "09-RELEASE-EVIDENCE.json",
);
const VALIDATION_PATH = join(PHASE_DIRECTORY, "09-VALIDATION.md");
const SECURITY_PATH = join(PHASE_DIRECTORY, "09-SECURITY.md");
const VERSION_RECEIPT_RELATIVE_PATH =
  ".planning/phases/09-react-and-svelte-adapters/09-VERSION-RECEIPT.json";
const CONSUMER_TOOLING_LOCK_PATH =
  "scripts/fixtures/phase-09-foreign-consumer/package-lock.json";
const CONSUMER_TOOLING_MANIFEST_PATH =
  "scripts/fixtures/phase-09-foreign-consumer/package.json";
const ASTRO_GENERATED_DIRECTORY = "examples/adapter-ssr/.astro";
const ASTRO_HARNESS_PACKAGE =
  "@fullselfbrowsing/concierge-adapter-ssr";
const ASTRO_PREREQUISITE_BUILD_PACKAGES = Object.freeze([
  "@fullselfbrowsing/concierge",
  "@fullselfbrowsing/concierge-react",
  "@fullselfbrowsing/concierge-svelte",
]);
const GENERATED_PATHS = Object.freeze([
  ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json",
  ".planning/phases/09-react-and-svelte-adapters/09-RELEASE-EVIDENCE.json",
  ".planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md",
  ".planning/phases/09-react-and-svelte-adapters/09-SECURITY.md",
]);
const OUTPUT_PATHS = Object.freeze([
  MUTATION_EVIDENCE_PATH,
  RELEASE_EVIDENCE_PATH,
  VALIDATION_PATH,
  SECURITY_PATH,
]);
const PHASE08_PATHS = Object.freeze([
  ".planning/phases/08-consent-kernel/08-MUTATION-REGISTER.json",
  ".planning/phases/08-consent-kernel/08-MUTATION-EVIDENCE.json",
  ".planning/phases/08-consent-kernel/08-VALIDATION.md",
  ".planning/phases/08-consent-kernel/08-SECURITY.md",
  ".planning/phases/08-consent-kernel/08-VERIFICATION.md",
]);
const PHASE08_COMMANDS = Object.freeze([
  Object.freeze(["node", "scripts/phase-08-mutation-battery.mjs", "verify", "all"]),
  Object.freeze(["node", "scripts/phase-08-mutation-battery.mjs", "verify", "inputs"]),
  Object.freeze(["node", "scripts/phase-08-mutation-battery.mjs", "verify", "ledgers"]),
]);
const EXPECTED_IDS = Object.freeze([
  "M-09-R1",
  "M-09-R2",
  "M-09-S1",
  "M-09-SSR1",
  "M-09-B1",
  "M-09-P1",
  "M-09-C1",
  "M-10-T01",
  "M-10-T02",
  "M-10-T03",
  "M-10-T04",
  "M-10-T05",
  "M-10-T06",
  "M-10-C01",
  "M-10-E01",
  "M-10-G01",
  "M-10-W01",
]);
const REQUIRED_TASK_IDS = Object.freeze(
  Array.from({ length: 13 }, (_, phaseIndex) =>
    [1, 2].map(
      (taskIndex) =>
        `09-${String(phaseIndex + 1).padStart(2, "0")}-${String(taskIndex).padStart(2, "0")}`,
    ),
  ).flat(),
);
const REQUIRED_THREATS = Object.freeze([
  "T-09-01",
  "T-09-02",
  "T-09-03",
  "T-09-04",
  "T-09-05",
  "T-09-06",
  "T-09-07",
  "T-09-08",
  "T-09-SC",
]);
const SUPPLEMENTAL_PHASE10_THREATS = Object.freeze([
  "T-10-01",
  "T-10-02",
  "T-10-03",
  "T-10-04",
  "T-10-05",
  "T-10-06",
  "T-10-07",
  "T-10-08",
]);
const EXPECTED_PHASE09_TEST_FILES = Object.freeze([
  "examples/adapter-ssr/test/ssr.test.ts",
  "packages/concierge-react/test/artifact.test.ts",
  "packages/concierge-react/test/lifecycle.test.tsx",
  "packages/concierge-svelte/test/artifact.test.ts",
  "packages/concierge-svelte/test/lifecycle.test.ts",
]);
const PUBLIC_PACKAGES = Object.freeze([
  "@fullselfbrowsing/concierge",
  "@fullselfbrowsing/concierge-react",
  "@fullselfbrowsing/concierge-svelte",
]);
const VERSION_RECEIPT_DIGEST_PATHS = Object.freeze([
  "packages/concierge/package.json",
  "packages/concierge-react/package.json",
  "packages/concierge-svelte/package.json",
  "pnpm-lock.yaml",
]);
const REQUIRED_FINAL_INPUT_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "vitest.config.ts",
  "README.md",
  "CONTRIBUTING.md",
  "RELEASING.md",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  "packages/concierge/package.json",
  "packages/concierge/src/index.ts",
  "packages/concierge/src/bridge.ts",
  "packages/concierge/src/concierge.ts",
  "packages/concierge/src/dispatch.ts",
  "packages/concierge/src/session.ts",
  "packages/concierge/src/catalog.ts",
  "packages/concierge/test/dispatcher-batch.test.ts",
  "packages/concierge/test/session-consent.test.ts",
  "packages/concierge/test/session-lifecycle.test.ts",
  "packages/concierge/test/catalog.test.ts",
  "packages/concierge-react/package.json",
  "packages/concierge-react/tsconfig.json",
  "packages/concierge-react/tsdown.config.ts",
  "packages/concierge-react/LICENSE",
  "packages/concierge-react/README.md",
  "packages/concierge-react/src/index.ts",
  "packages/concierge-react/src/client.tsx",
  "packages/concierge-react/test/lifecycle.test.tsx",
  "packages/concierge-react/test/artifact.test.ts",
  "packages/concierge-react/test-d/public.test-d.ts",
  "packages/concierge-svelte/package.json",
  "packages/concierge-svelte/tsconfig.json",
  "packages/concierge-svelte/svelte.config.js",
  "packages/concierge-svelte/LICENSE",
  "packages/concierge-svelte/README.md",
  "packages/concierge-svelte/src/index.ts",
  "packages/concierge-svelte/src/client.svelte.ts",
  "packages/concierge-svelte/test/Harness.svelte",
  "packages/concierge-svelte/test/lifecycle.test.ts",
  "packages/concierge-svelte/test/artifact.test.ts",
  "examples/adapter-ssr/package.json",
  "examples/adapter-ssr/astro.config.mjs",
  "examples/adapter-ssr/tsconfig.json",
  "examples/adapter-ssr/src/shared/catalog.ts",
  "examples/adapter-ssr/src/components/ReactIsland.tsx",
  "examples/adapter-ssr/src/components/SvelteIsland.svelte",
  "examples/adapter-ssr/src/pages/index.astro",
  "examples/adapter-ssr/test/ssr.test.ts",
  "scripts/phase-09-contract-check.mjs",
  "scripts/phase-09-package-check.mjs",
  "scripts/phase-09-adapter-budget.mjs",
  "scripts/phase-09-test-check.mjs",
  "scripts/phase-09-workflow-check.mjs",
  "scripts/phase-09-mutation-battery.mjs",
  "scripts/phase-09-secure-environment.mjs",
  "scripts/phase-09-publish-archives.mjs",
  "scripts/phase-09-version.mjs",
  "scripts/phase-10-certify-candidate.mjs",
  ".changeset/config.json",
  CONSUMER_TOOLING_MANIFEST_PATH,
  CONSUMER_TOOLING_LOCK_PATH,
  ".planning/phases/09-react-and-svelte-adapters/09-RED-BASELINE.json",
  ".planning/phases/09-react-and-svelte-adapters/09-CONTEXT.md",
  ".planning/phases/09-react-and-svelte-adapters/09-RESEARCH.md",
  ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json",
  ...PHASE08_PATHS,
]);
const ROOT_INPUT_PATHS = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "vitest.config.ts",
  "README.md",
  "CONTRIBUTING.md",
  "RELEASING.md",
  ".gitignore",
  ".planning/REQUIREMENTS.md",
  ".planning/phases/09-react-and-svelte-adapters/09-RED-BASELINE.json",
  ".planning/phases/09-react-and-svelte-adapters/09-CONTEXT.md",
  ".planning/phases/09-react-and-svelte-adapters/09-RESEARCH.md",
  ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json",
  VERSION_RECEIPT_RELATIVE_PATH,
  ...PHASE08_PATHS,
]);
const INPUT_DIRECTORY_PREFIXES = Object.freeze([
  "packages/concierge/",
  "packages/concierge-react/",
  "packages/concierge-svelte/",
  "examples/adapter-ssr/",
  "scripts/",
  ".changeset/",
  ".github/workflows/",
]);
const TEST_HASH_PATHS = Object.freeze({
  "M-09-R1": Object.freeze([
    "packages/concierge-react/test/lifecycle.test.tsx",
    "vitest.config.ts",
  ]),
  "M-09-R2": Object.freeze([
    "packages/concierge-react/test/lifecycle.test.tsx",
    "vitest.config.ts",
  ]),
  "M-09-S1": Object.freeze([
    "scripts/phase-09-package-check.mjs",
    CONSUMER_TOOLING_MANIFEST_PATH,
    CONSUMER_TOOLING_LOCK_PATH,
    "packages/concierge-svelte/test/lifecycle.test.ts",
  ]),
  "M-09-SSR1": Object.freeze([
    "examples/adapter-ssr/test/ssr.test.ts",
    "vitest.config.ts",
  ]),
  "M-09-B1": Object.freeze(["scripts/phase-09-adapter-budget.mjs"]),
  "M-09-P1": Object.freeze([
    "scripts/phase-09-package-check.mjs",
    CONSUMER_TOOLING_MANIFEST_PATH,
    CONSUMER_TOOLING_LOCK_PATH,
  ]),
  "M-09-C1": Object.freeze([
    "scripts/phase-09-package-check.mjs",
    CONSUMER_TOOLING_MANIFEST_PATH,
    CONSUMER_TOOLING_LOCK_PATH,
    "packages/concierge-react/test/lifecycle.test.tsx",
  ]),
  "M-10-T01": Object.freeze([
    "packages/concierge/test/dispatcher-batch.test.ts",
    "vitest.config.ts",
  ]),
  "M-10-T02": Object.freeze([
    "packages/concierge/test/dispatcher-batch.test.ts",
    "vitest.config.ts",
  ]),
  "M-10-T03": Object.freeze([
    "packages/concierge/test/dispatcher-batch.test.ts",
    "vitest.config.ts",
  ]),
  "M-10-T04": Object.freeze([
    "packages/concierge/test/session-consent.test.ts",
    "vitest.config.ts",
  ]),
  "M-10-T05": Object.freeze([
    "packages/concierge/test/session-lifecycle.test.ts",
    "vitest.config.ts",
  ]),
  "M-10-T06": Object.freeze([
    "packages/concierge/test/session-consent.test.ts",
    "vitest.config.ts",
  ]),
  "M-10-C01": Object.freeze([
    "packages/concierge/test/catalog.test.ts",
    "vitest.config.ts",
  ]),
  "M-10-E01": Object.freeze([
    "scripts/phase-09-package-check.mjs",
    "scripts/phase-09-secure-environment.mjs",
  ]),
  "M-10-G01": Object.freeze([
    "scripts/phase-09-contract-check.mjs",
  ]),
  "M-10-W01": Object.freeze([
    "scripts/phase-09-contract-check.mjs",
    "scripts/phase-09-workflow-check.mjs",
  ]),
});
const EXPECTED_MAPPINGS = Object.freeze({
  "M-09-R1": Object.freeze({
    testId: "T01",
    requirement: "ADP-01",
    threat: "T-09-01",
    decisions: Object.freeze(["D-09-02", "D-09-07"]),
  }),
  "M-09-R2": Object.freeze({
    testId: "T02",
    requirement: "ADP-01",
    threat: "T-09-02",
    decisions: Object.freeze(["D-09-06"]),
  }),
  "M-09-S1": Object.freeze({
    testId: "T03",
    requirement: "ADP-02",
    threat: "T-09-03",
    decisions: Object.freeze(["D-09-10", "D-09-12"]),
  }),
  "M-09-SSR1": Object.freeze({
    testId: "T04",
    requirement: "ADP-04",
    threat: "T-09-04",
    decisions: Object.freeze(["D-09-02", "D-09-15"]),
  }),
  "M-09-B1": Object.freeze({
    testId: "T07",
    requirement: "ADP-03",
    threat: "T-09-07",
    decisions: Object.freeze(["D-09-13"]),
  }),
  "M-09-P1": Object.freeze({
    testId: "T05",
    requirement: "PKG-04",
    threat: "T-09-05",
    decisions: Object.freeze(["D-09-04", "D-09-16"]),
  }),
  "M-09-C1": Object.freeze({
    testId: "T05",
    requirement: "PKG-04",
    threat: "T-09-05",
    decisions: Object.freeze(["D-09-03", "D-09-16"]),
  }),
  "M-10-T01": Object.freeze({
    testId: "Q22",
    requirement: "Audit-3",
    threat: "T-10-02",
    decisions: Object.freeze(["D-10-01", "D-10-02"]),
  }),
  "M-10-T02": Object.freeze({
    testId: "Q20",
    requirement: "DSP-07",
    threat: "T-10-02",
    decisions: Object.freeze(["D-10-03"]),
  }),
  "M-10-T03": Object.freeze({
    testId: "Q21",
    requirement: "SES-02",
    threat: "T-10-01",
    decisions: Object.freeze(["D-10-03"]),
  }),
  "M-10-T04": Object.freeze({
    testId: "S09",
    requirement: "CON-10",
    threat: "T-10-03",
    decisions: Object.freeze(["D-10-04"]),
  }),
  "M-10-T05": Object.freeze({
    testId: "L06",
    requirement: "SES-04",
    threat: "T-10-03",
    decisions: Object.freeze(["D-10-02", "D-10-04"]),
  }),
  "M-10-T06": Object.freeze({
    testId: "S08",
    requirement: "SES-02",
    threat: "T-10-01",
    decisions: Object.freeze(["D-10-03", "D-10-04"]),
  }),
  "M-10-C01": Object.freeze({
    testId: "C34",
    requirement: "DX-03",
    threat: "T-10-05",
    decisions: Object.freeze(["D-10-13", "D-10-14"]),
  }),
  "M-10-E01": Object.freeze({
    testId: "E01",
    requirement: "PKG-04",
    threat: "T-10-04",
    decisions: Object.freeze(["D-10-09"]),
  }),
  "M-10-G01": Object.freeze({
    testId: "G01",
    requirement: "ADP-04",
    threat: "T-10-06",
    decisions: Object.freeze(["D-10-05", "D-10-06", "D-10-07", "D-10-08"]),
  }),
  "M-10-W01": Object.freeze({
    testId: "W01",
    requirement: "PKG-04",
    threat: "T-10-07",
    decisions: Object.freeze(["D-10-09"]),
  }),
});
const COMPILE_COMMANDS = Object.freeze({
  "M-09-R1": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge-react", "build"]),
  "M-09-R2": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge-react", "build"]),
  "M-09-S1": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge-svelte", "build"]),
  "M-09-SSR1": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge-react", "build"]),
  "M-09-B1": Object.freeze(["node", "--check", "scripts/phase-09-adapter-budget.mjs"]),
  "M-09-P1": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge-react", "build"]),
  "M-09-C1": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge-react", "build"]),
  "M-10-T01": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge", "build"]),
  "M-10-T02": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge", "build"]),
  "M-10-T03": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge", "build"]),
  "M-10-T04": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge", "build"]),
  "M-10-T05": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge", "build"]),
  "M-10-T06": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge", "build"]),
  "M-10-C01": Object.freeze(["pnpm", "--filter", "@fullselfbrowsing/concierge", "build"]),
  "M-10-E01": Object.freeze(["node", "--check", "scripts/phase-09-package-check.mjs"]),
  "M-10-G01": Object.freeze(["node", "--check", "scripts/phase-09-mutation-battery.mjs"]),
  "M-10-W01": Object.freeze(["node", "--check", "scripts/phase-09-mutation-battery.mjs"]),
});
const KILLER_COMMANDS = Object.freeze({
  "M-09-R1": Object.freeze(["pnpm", "exec", "vitest", "run", "packages/concierge-react/test/lifecycle.test.tsx", "--project", "react-lifecycle", "--testNamePattern=T01/R1", "--reporter=json", "--outputFile={report}"]),
  "M-09-R2": Object.freeze(["pnpm", "exec", "vitest", "run", "packages/concierge-react/test/lifecycle.test.tsx", "--project", "react-lifecycle", "--testNamePattern=T02/R2", "--reporter=json", "--outputFile={report}"]),
  "M-09-S1": Object.freeze(["node", "scripts/phase-09-package-check.mjs", "svelte-consent"]),
  "M-09-SSR1": Object.freeze(["pnpm", "exec", "vitest", "run", "examples/adapter-ssr/test/ssr.test.ts", "--project", "node-artifact-ssr", "--testNamePattern=T04/SSR1", "--reporter=json", "--outputFile={report}"]),
  "M-09-B1": Object.freeze(["node", "scripts/phase-09-adapter-budget.mjs", "check"]),
  "M-09-P1": Object.freeze(["node", "scripts/phase-09-package-check.mjs", "artifacts"]),
  "M-09-C1": Object.freeze(["node", "scripts/phase-09-package-check.mjs", "mismatch"]),
  "M-10-T01": Object.freeze(["pnpm", "exec", "vitest", "run", "packages/concierge/test/dispatcher-batch.test.ts", "--project", "node", "--testNamePattern=Q22", "--reporter=json", "--outputFile={report}"]),
  "M-10-T02": Object.freeze(["pnpm", "exec", "vitest", "run", "packages/concierge/test/dispatcher-batch.test.ts", "--project", "node", "--testNamePattern=Q20 terminal", "--reporter=json", "--outputFile={report}"]),
  "M-10-T03": Object.freeze(["pnpm", "exec", "vitest", "run", "packages/concierge/test/dispatcher-batch.test.ts", "--project", "node", "--testNamePattern=Q21", "--reporter=json", "--outputFile={report}"]),
  "M-10-T04": Object.freeze(["pnpm", "exec", "vitest", "run", "packages/concierge/test/session-consent.test.ts", "--project", "node", "--testNamePattern=S09", "--reporter=json", "--outputFile={report}"]),
  "M-10-T05": Object.freeze(["pnpm", "exec", "vitest", "run", "packages/concierge/test/session-lifecycle.test.ts", "--project", "node", "--testNamePattern=L06 terminal", "--reporter=json", "--outputFile={report}"]),
  "M-10-T06": Object.freeze(["pnpm", "exec", "vitest", "run", "packages/concierge/test/session-consent.test.ts", "--project", "node", "--testNamePattern=S08", "--reporter=json", "--outputFile={report}"]),
  "M-10-C01": Object.freeze(["pnpm", "exec", "vitest", "run", "packages/concierge/test/catalog.test.ts", "--project", "node", "--testNamePattern=C34", "--reporter=json", "--outputFile={report}"]),
  "M-10-E01": Object.freeze(["node", "scripts/phase-09-package-check.mjs", "self-test"]),
  "M-10-G01": Object.freeze(["node", "scripts/phase-09-contract-check.mjs", "phase10-static"]),
  "M-10-W01": Object.freeze(["node", "scripts/phase-09-contract-check.mjs", "phase10-static"]),
});
const MUTANT_EXECUTION_ENV = Object.freeze({
  PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: "false",
});
const REGISTER_TOP_KEYS = Object.freeze([
  "schemaVersion",
  "phase",
  "expectedIds",
  "runnerThreat",
  "rows",
]);
const REGISTER_ROW_KEYS = Object.freeze([
  "id",
  "name",
  "target",
  "affectedPackage",
  "exactBefore",
  "exactAfter",
  "occurrences",
  "compileCommand",
  "killerCommand",
  "killerKind",
  "expectedCounts",
  "expectedNonzeroExit",
  "assertionFingerprint",
  "testId",
  "requirement",
  "threat",
  "decisions",
]);
const USAGE =
  "Usage: node scripts/phase-09-mutation-battery.mjs " +
  "self-test|preflight <registered-id>|run all --jobs <1-4>|" +
  "preflight versioned --jobs <1-4>|" +
  "finalize versioned --jobs <1-4>|" +
  "verify <evidence|release|all|astro-regeneration>|" +
  "verify publish <archive-dir>";
const TEMP_PREFIX = "concierge-phase09-mutation-";
const OWNERSHIP_MARKER = ".concierge-phase09-mutation-owned-root";
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 240_000;
const PACKAGE_TIMEOUT_MS = 600_000;
const INSTALL_TIMEOUT_MS = 360_000;
const PNPM_FETCH_ARGUMENTS = Object.freeze([
  "fetch",
  "--frozen-lockfile",
  "--ignore-scripts",
]);
const PNPM_OFFLINE_INSTALL_ARGUMENTS = Object.freeze([
  "install",
  "--offline",
  "--frozen-lockfile",
]);
const SYSTEM_TEMP_ROOT = realpathSync(tmpdir());
const SHA256 = /^[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const RUN_ID = /^[1-9]\d*$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const EXPECTED_REPOSITORY = "fullselfbrowsing/concierge";
let activeChildEnvironment = null;

class UsageError extends Error {
  constructor() {
    super(USAGE);
    this.name = "UsageError";
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stableJson(value) {
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function countOccurrences(text, needle) {
  assert(needle.length > 0, "exact replacement needle must be nonempty");
  return text.split(needle).length - 1;
}

function exactKeys(value, expected, label) {
  assert(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  const observed = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(
    JSON.stringify(observed) === JSON.stringify(wanted),
    `${label} keys must equal ${wanted.join(", ")}`,
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function commandText(spec) {
  return spec.join(" ");
}

function boundedExcerpt(value, maximum = 4_000) {
  const text = value ?? "";
  return text.length <= maximum ? text : text.slice(text.length - maximum);
}

function childEnvironment(overrides = {}) {
  assert(
    activeChildEnvironment !== null,
    "secure child environment is not initialized",
  );
  return mergeSecureChildEnvironment(activeChildEnvironment, overrides);
}

async function withChildEnvironment(environment, operation) {
  assert(activeChildEnvironment === null, "secure child environment is already active");
  activeChildEnvironment = environment;
  try {
    return await operation();
  } finally {
    activeChildEnvironment = null;
  }
}

function isWithin(candidate, parent) {
  const fromParent = relative(parent, candidate);
  return (
    fromParent === "" ||
    (fromParent !== ".." && !fromParent.startsWith(`..${sep}`))
  );
}

function parseInvocation(arguments_) {
  if (arguments_.length === 1 && arguments_[0] === "self-test") {
    return Object.freeze({ kind: "self-test" });
  }
  if (
    arguments_.length === 2 &&
    arguments_[0] === "preflight" &&
    EXPECTED_IDS.includes(arguments_[1])
  ) {
    return Object.freeze({ kind: "preflight", id: arguments_[1] });
  }
  if (
    arguments_.length === 4 &&
    arguments_[0] === "preflight" &&
    arguments_[1] === "versioned" &&
    arguments_[2] === "--jobs"
  ) {
    const jobs = Number(arguments_[3]);
    if (Number.isInteger(jobs) && jobs >= 1 && jobs <= 4) {
      return Object.freeze({
        kind: "run-all",
        jobs,
        versioned: true,
        installOutputs: false,
      });
    }
  }
  if (
    arguments_.length === 4 &&
    arguments_[0] === "run" &&
    arguments_[1] === "all" &&
    arguments_[2] === "--jobs"
  ) {
    const jobs = Number(arguments_[3]);
    if (Number.isInteger(jobs) && jobs >= 1 && jobs <= 4) {
      return Object.freeze({
        kind: "run-all",
        jobs,
        versioned: false,
        installOutputs: true,
      });
    }
  }
  if (
    arguments_.length === 4 &&
    arguments_[0] === "finalize" &&
    arguments_[1] === "versioned" &&
    arguments_[2] === "--jobs"
  ) {
    const jobs = Number(arguments_[3]);
    if (Number.isInteger(jobs) && jobs >= 1 && jobs <= 4) {
      return Object.freeze({
        kind: "run-all",
        jobs,
        versioned: true,
        installOutputs: true,
      });
    }
  }
  if (
    arguments_.length === 2 &&
    arguments_[0] === "verify" &&
    ["evidence", "release", "all"].includes(arguments_[1])
  ) {
    return Object.freeze({ kind: `verify-${arguments_[1]}` });
  }
  if (
    arguments_.length === 2 &&
    arguments_[0] === "verify" &&
    arguments_[1] === "astro-regeneration"
  ) {
    return Object.freeze({ kind: "verify-astro-regeneration" });
  }
  if (
    arguments_.length === 3 &&
    arguments_[0] === "verify" &&
    arguments_[1] === "publish"
  ) {
    return Object.freeze({ kind: "verify-publish", archiveDirectory: arguments_[2] });
  }
  throw new UsageError();
}

function runGitSync(arguments_, root = ROOT, options = {}) {
  const result = spawnSync("git", arguments_, {
    cwd: root,
    encoding: options.encoding ?? "utf8",
    env: childEnvironment(),
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  assert(
    result.error === undefined && result.signal === null && result.status === 0,
    `git ${arguments_.join(" ")} failed: ${boundedExcerpt(`${result.stdout ?? ""}${result.stderr ?? ""}`)}`,
  );
  return result.stdout;
}

function readRegister(root = ROOT) {
  return JSON.parse(
    readFileSync(
      join(
        root,
        ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json",
      ),
      "utf8",
    ),
  );
}

function validateRegister(register, root = ROOT, { requireTracked = true } = {}) {
  exactKeys(register, REGISTER_TOP_KEYS, "register");
  assert(register.schemaVersion === 1, "register schemaVersion must equal 1");
  assert(register.phase === PHASE, "register phase is invalid");
  assert(register.runnerThreat === "T-09-08", "runner threat must equal T-09-08");
  assert(
    JSON.stringify(register.expectedIds) === JSON.stringify(EXPECTED_IDS),
    "register expectedIds are missing, duplicated, reordered, or extra",
  );
  assert(Array.isArray(register.rows), "register rows must be an array");
  const ids = register.rows.map((row) => row.id);
  assert(
    JSON.stringify(ids) === JSON.stringify(EXPECTED_IDS),
    "register row ids are missing, duplicated, reordered, or extra",
  );
  assert(new Set(ids).size === EXPECTED_IDS.length, "register has a duplicate ID");

  const identities = new Set();
  const fingerprints = new Set();
  for (const row of register.rows) {
    exactKeys(row, REGISTER_ROW_KEYS, `${row.id} register row`);
    exactKeys(row.expectedCounts, ["files", "tests", "assertions"], `${row.id} expectedCounts`);
    assert(
      row.expectedCounts.files === 1 &&
        row.expectedCounts.tests === 1 &&
        row.expectedCounts.assertions === 1,
      `${row.id}: expected counts must be exactly one file/test/assertion`,
    );
    assert(row.occurrences === 1, `${row.id}: occurrences must equal 1`);
    assert(row.expectedNonzeroExit === true, `${row.id}: expectedNonzeroExit must be true`);
    assert(
      ["vitest", "marker", "package"].includes(row.killerKind),
      `${row.id}: killerKind is invalid`,
    );
    for (const key of [
      "name",
      "target",
      "affectedPackage",
      "exactBefore",
      "exactAfter",
      "compileCommand",
      "killerCommand",
      "assertionFingerprint",
    ]) {
      assert(typeof row[key] === "string" && row[key].length > 0, `${row.id}: ${key} is empty`);
    }
    assert(row.exactBefore !== row.exactAfter, `${row.id}: replacement is a no-op`);
    assert(
      !fingerprints.has(row.assertionFingerprint),
      `${row.id}: assertion fingerprint is duplicated`,
    );
    fingerprints.add(row.assertionFingerprint);
    assert(!/(?:^|\/)test(?:-d)?\//u.test(row.target), `${row.id}: test source is a forbidden mutation target`);
    const identity = `${row.target}\0${row.exactBefore}\0${row.exactAfter}`;
    assert(!identities.has(identity), `${row.id}: duplicate mutation definition`);
    identities.add(identity);

    const expectedMapping = EXPECTED_MAPPINGS[row.id];
    assert(expectedMapping !== undefined, `${row.id}: mapping is unknown`);
    assert(row.testId === expectedMapping.testId, `${row.id}: test mapping drifted`);
    assert(row.requirement === expectedMapping.requirement, `${row.id}: requirement mapping drifted`);
    assert(row.threat === expectedMapping.threat, `${row.id}: threat mapping drifted`);
    assert(
      JSON.stringify(row.decisions) === JSON.stringify(expectedMapping.decisions),
      `${row.id}: decision mapping drifted`,
    );
    assert(
      row.compileCommand === commandText(COMPILE_COMMANDS[row.id]),
      `${row.id}: compile command is not the immutable command`,
    );
    assert(
      row.killerCommand === commandText(KILLER_COMMANDS[row.id]),
      `${row.id}: killer command is not the immutable command`,
    );

    const targetPath = join(root, row.target);
    assert(existsSync(targetPath) && statSync(targetPath).isFile(), `${row.id}: target is missing`);
    if (requireTracked) {
      runGitSync(["ls-files", "--error-unmatch", row.target], root);
    }
    const source = readFileSync(targetPath, "utf8");
    const occurrences = countOccurrences(source, row.exactBefore);
    assert(
      occurrences === row.occurrences,
      `${row.id}: literal occurrence count is ${occurrences}, expected ${row.occurrences}`,
    );
  }
  return register;
}

function registerDigest(root = ROOT) {
  return sha256File(
    join(
      root,
      ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json",
    ),
  );
}

function definitionDigest(row) {
  return sha256(
    stableJson({
      id: row.id,
      target: row.target,
      exactBefore: row.exactBefore,
      exactAfter: row.exactAfter,
      compileCommand: row.compileCommand,
      killerCommand: row.killerCommand,
      assertionFingerprint: row.assertionFingerprint,
    }),
  );
}

function testHashes(row, root = ROOT) {
  return Object.fromEntries(
    TEST_HASH_PATHS[row.id].map((path) => [path, sha256File(join(root, path))]),
  );
}

function isAstroGeneratedPath(path) {
  return (
    path === ASTRO_GENERATED_DIRECTORY ||
    path.startsWith(`${ASTRO_GENERATED_DIRECTORY}/`)
  );
}

function assertNoAstroReleaseAuthority(value, label) {
  assert(
    !stableJson(value).includes(ASTRO_GENERATED_DIRECTORY),
    `${label} contains harness-local Astro generated state`,
  );
}

function isReleaseInputPath(path) {
  if (isAstroGeneratedPath(path)) return false;
  if (GENERATED_PATHS.includes(path)) return false;
  if (ROOT_INPUT_PATHS.has(path)) return true;
  return INPUT_DIRECTORY_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function releaseInputPaths(root = ROOT) {
  const output = runGitSync(["ls-files", "-z"], root);
  const trackedPaths = [...new Set(output.split("\0").filter(Boolean))];
  const trackedAstroPaths = trackedPaths.filter(isAstroGeneratedPath);
  assert(
    trackedAstroPaths.length === 0,
    `tracked Astro generated state is forbidden: ${trackedAstroPaths.join(", ")}`,
  );
  const paths = trackedPaths
    .filter(isReleaseInputPath)
    .sort();
  assert(paths.length > 0, "release input manifest is empty");
  assertNoAstroReleaseAuthority(paths, "release input path set");
  return Object.freeze(paths);
}

function makeInputManifest(root = ROOT, paths = releaseInputPaths(root)) {
  assertNoAstroReleaseAuthority(paths, "release input manifest paths");
  const entries = paths.map((path) => {
    const absolutePath = join(root, path);
    assert(existsSync(absolutePath), `release input is missing: ${path}`);
    return Object.freeze({ path, sha256: sha256File(absolutePath) });
  });
  return Object.freeze({
    entries: Object.freeze(entries),
    digest: sha256(stableJson(entries)),
  });
}

function verifyInputManifest(
  expected,
  root = ROOT,
  { verifyPathSet = true } = {},
) {
  assert(expected !== null && typeof expected === "object", "input manifest is malformed");
  assert(Array.isArray(expected.entries), "input manifest entries are malformed");
  assertNoAstroReleaseAuthority(expected, "release input manifest");
  assert(SHA256.test(expected.digest), "input manifest digest is malformed");
  const expectedPaths = expected.entries.map((entry) => entry.path);
  if (verifyPathSet) {
    assert(
      JSON.stringify(expectedPaths) === JSON.stringify(releaseInputPaths(root)),
      "release input path set is stale",
    );
  }
  const current = makeInputManifest(root, expectedPaths);
  for (const [index, entry] of expected.entries.entries()) {
    assert(
      entry.sha256 === current.entries[index].sha256,
      `release input digest is stale: ${entry.path}`,
    );
  }
  assert(expected.digest === current.digest, "release input aggregate digest is stale");
  return current;
}

function phase08Hashes(root = ROOT) {
  return Object.freeze(
    Object.fromEntries(PHASE08_PATHS.map((path) => [path, sha256File(join(root, path))])),
  );
}

function assertPhase08Hashes(expected, root = ROOT) {
  const current = phase08Hashes(root);
  assert(
    JSON.stringify(current) === JSON.stringify(expected),
    "one or more exact Phase 8 records drifted",
  );
  return current;
}

function scopedStatus(root, paths) {
  const lines = [];
  for (let index = 0; index < paths.length; index += 150) {
    const chunk = paths.slice(index, index + 150);
    const output = runGitSync(
      ["status", "--porcelain=v1", "--untracked-files=no", "--", ...chunk],
      root,
    );
    lines.push(...output.split(/\r?\n/u).filter(Boolean));
  }
  return [...new Set(lines)].sort();
}

function assertCleanReleaseInputs(
  root,
  paths,
  { allowedModifiedPaths = [] } = {},
) {
  const allowed = new Set(allowedModifiedPaths);
  const dirty = scopedStatus(root, paths).filter((line) => {
    const path = line.slice(3).replace(/^"|"$/gu, "");
    return !allowed.has(path);
  });
  assert(
    dirty.length === 0,
    `release input tree is dirty:\n${dirty.join("\n")}`,
  );
}

function versionReceiptBody(value) {
  return {
    schemaVersion: value.schemaVersion,
    phase: value.phase,
    baseSha: value.baseSha,
    repository: value.repository,
    runId: value.runId,
    runAttempt: value.runAttempt,
    artifactName: value.artifactName,
    artifactDigest: value.artifactDigest,
    sharedVersion: value.sharedVersion,
    consumedChangesets: value.consumedChangesets,
    finalDigests: value.finalDigests,
  };
}

function readVersionReceipt(root) {
  const path = join(root, VERSION_RECEIPT_RELATIVE_PATH);
  assert(existsSync(path) && lstatSync(path).isFile(), "version receipt is missing");
  runGitSync(["ls-files", "--error-unmatch", VERSION_RECEIPT_RELATIVE_PATH], root);
  const bytes = readFileSync(path);
  const receipt = JSON.parse(bytes.toString("utf8"));
  exactKeys(
    receipt,
    [
      "schemaVersion",
      "phase",
      "baseSha",
      "repository",
      "runId",
      "runAttempt",
      "artifactName",
      "artifactDigest",
      "sharedVersion",
      "consumedChangesets",
      "finalDigests",
      "contentDigest",
    ],
    "version receipt",
  );
  const expectedArtifactName =
    `phase09-version-${receipt.runId}-${receipt.runAttempt}-${receipt.baseSha}`;
  assert(
    receipt.schemaVersion === 1 && receipt.phase === PHASE &&
      receipt.repository === EXPECTED_REPOSITORY && REPOSITORY.test(receipt.repository) &&
      COMMIT.test(receipt.baseSha) && RUN_ID.test(receipt.runId) &&
      Number.isSafeInteger(receipt.runAttempt) && receipt.runAttempt > 0 &&
      receipt.artifactName === expectedArtifactName &&
      SHA256.test(receipt.artifactDigest) &&
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(receipt.sharedVersion) &&
      receipt.sharedVersion !== "0.0.0" &&
      SHA256.test(receipt.contentDigest) &&
      receipt.contentDigest === sha256(stableJson(versionReceiptBody(receipt))),
    "version receipt identity or digest is malformed",
  );
  runGitSync(["merge-base", "--is-ancestor", receipt.baseSha, "HEAD"], root);
  exactKeys(receipt.finalDigests, VERSION_RECEIPT_DIGEST_PATHS, "version receipt final digests");
  for (const digestPath of VERSION_RECEIPT_DIGEST_PATHS) {
    assert(
      SHA256.test(receipt.finalDigests[digestPath]) &&
        receipt.finalDigests[digestPath] === sha256File(join(root, digestPath)),
      `version receipt final digest is stale: ${digestPath}`,
    );
  }
  assert(
    Array.isArray(receipt.consumedChangesets) &&
      receipt.consumedChangesets.length > 0,
    "version receipt consumed no changeset",
  );
  const paths = new Set();
  for (const record of receipt.consumedChangesets) {
    exactKeys(record, ["path", "sha256"], "version receipt consumed changeset");
    const base = gitShowBuffer(receipt.baseSha, record.path, root);
    assert(
      /^\.changeset\/[^/]+\.md$/u.test(record.path) &&
        SHA256.test(record.sha256) && !paths.has(record.path) &&
        base !== null && sha256(base) === record.sha256 &&
        !existsSync(join(root, record.path)),
      `version receipt consumed changeset is missing, duplicated, stale, or not deleted: ${record.path}`,
    );
    paths.add(record.path);
  }
  const manifests = VERSION_RECEIPT_DIGEST_PATHS.slice(0, 3).map((manifestPath) =>
    JSON.parse(readFileSync(join(root, manifestPath), "utf8"))
  );
  assert(
    manifests.map((manifest) => manifest.name).join("\n") === PUBLIC_PACKAGES.join("\n") &&
      manifests.every((manifest) => manifest.version === receipt.sharedVersion) &&
      manifests.slice(1).every(
        (manifest) => manifest.peerDependencies?.[PUBLIC_PACKAGES[0]] === "workspace:^",
      ),
    "version receipt does not match the canonical versioned package triplet",
  );
  return Object.freeze({ receipt, bytes });
}

function versionReceiptBinding(root, receiptRecord = readVersionReceipt(root)) {
  const { receipt, bytes } = receiptRecord;
  return Object.freeze({
    path: VERSION_RECEIPT_RELATIVE_PATH,
    sha256: sha256(bytes),
    baseSha: receipt.baseSha,
    repository: receipt.repository,
    runId: receipt.runId,
    runAttempt: receipt.runAttempt,
    artifactName: receipt.artifactName,
  });
}

function validateVersionReceiptBinding(value, root) {
  exactKeys(
    value,
    ["path", "sha256", "baseSha", "repository", "runId", "runAttempt", "artifactName"],
    "version receipt binding",
  );
  const expected = versionReceiptBinding(root);
  assert(
    stableJson(value) === stableJson(expected),
    "versioned evidence differs from the tracked apply-derived version receipt",
  );
  return expected;
}

function verifyLiveMutationState(liveState) {
  verifyInputManifest(liveState.inputManifest, ROOT);
  assertCleanReleaseInputs(ROOT, liveState.paths, {
    allowedModifiedPaths: liveState.allowedModifiedPaths,
  });
  if (liveState.versioned) {
    const current = readVersionReceipt(ROOT);
    assert(
      current.receipt.sharedVersion === liveState.authorization.sharedVersion &&
        stableJson(current.receipt.consumedChangesets) ===
          stableJson(liveState.authorization.consumedChangesets),
      "versioned release authorization changed during evidence generation",
    );
    validateVersionReceiptBinding(liveState.authorization.versionReceipt, ROOT);
  }
}

function outputEndpoints() {
  return Object.fromEntries(
    OUTPUT_PATHS.map((path) => [
      path,
      existsSync(path)
        ? Object.freeze({ exists: true, sha256: sha256File(path) })
        : Object.freeze({ exists: false, sha256: null }),
    ]),
  );
}

function assertOutputEndpoints(expected) {
  assert(
    JSON.stringify(outputEndpoints()) === JSON.stringify(expected),
    "a non-generating command changed a Phase 09 output endpoint",
  );
}

function assertOwnedTempRoot(root) {
  assert(isAbsolute(root), "owned temporary root must be absolute");
  assert(root === normalize(resolve(root)), "owned temporary root must be normalized");
  assert(dirname(root) === SYSTEM_TEMP_ROOT, "owned temporary root must be a direct temp child");
  assert(
    basename(root).startsWith(TEMP_PREFIX) && basename(root).length > TEMP_PREFIX.length,
    "owned temporary root has the wrong prefix",
  );
  assert(existsSync(root) && statSync(root).isDirectory(), "owned temporary root is missing");
  assert(!isWithin(realpathSync(root), ROOT), "owned temporary root resolved inside the repository");
  const marker = join(root, OWNERSHIP_MARKER);
  assert(
    existsSync(marker) && statSync(marker).isFile() && readFileSync(marker, "utf8") === basename(root),
    "owned temporary root marker is invalid",
  );
}

function createOwnedTempRoot() {
  const root = mkdtempSync(join(SYSTEM_TEMP_ROOT, TEMP_PREFIX));
  writeFileSync(join(root, OWNERSHIP_MARKER), basename(root), { encoding: "utf8", flag: "wx" });
  assertOwnedTempRoot(root);
  return root;
}

function removeOwnedTempRoot(root) {
  assertOwnedTempRoot(root);
  rmSync(root, { recursive: true, force: false });
  assert(!existsSync(root), "owned temporary root survived cleanup");
}

async function withOwnedChildEnvironment(operation) {
  const root = createOwnedTempRoot();
  try {
    const secure = createSecureChildEnvironment(root, process.env);
    return await withChildEnvironment(secure.environment, () =>
      operation(root, secure),
    );
  } finally {
    removeOwnedTempRoot(root);
  }
}

function assertSnapshotPath(path, snapshotRoot) {
  const normalizedRoot = normalize(resolve(snapshotRoot));
  const normalizedPath = normalize(resolve(path));
  assert(
    normalizedPath !== normalizedRoot && isWithin(normalizedPath, normalizedRoot),
    `live-tree-write attempt rejected: ${normalizedPath}`,
  );
  assert(!isWithin(normalizedPath, ROOT), `live-tree-write attempt rejected: ${normalizedPath}`);
}

function copyTrackedFile(sourceRoot, destinationRoot, path) {
  const source = join(sourceRoot, path);
  const destination = join(destinationRoot, path);
  mkdirSync(dirname(destination), { recursive: true });
  const status = lstatSync(source);
  if (status.isSymbolicLink()) {
    symlinkSync(readlinkSync(source), destination);
  } else {
    copyFileSync(source, destination);
  }
}

function initializeDisposableRepository(root, paths) {
  runGitSync(["init", "--quiet"], root);
  runGitSync(["config", "user.email", "phase09-mutation@example.invalid"], root);
  runGitSync(["config", "user.name", "Phase 09 Mutation Battery"], root);
  for (let index = 0; index < paths.length; index += 150) {
    runGitSync(["add", "--", ...paths.slice(index, index + 150)], root);
  }
  runGitSync(["commit", "--quiet", "-m", "disposable immutable snapshot"], root);
}

function attachSourceHistoryToSnapshot(snapshotRoot, sourceRoot) {
  assertSnapshotPath(snapshotRoot, dirname(snapshotRoot));
  const snapshotHead = runGitSync(["rev-parse", "HEAD"], snapshotRoot).trim();
  const snapshotTree = runGitSync(["rev-parse", "HEAD^{tree}"], snapshotRoot).trim();
  const sourceHead = runGitSync(["rev-parse", "HEAD"], sourceRoot).trim();
  assert(COMMIT.test(snapshotHead) && COMMIT.test(sourceHead), "snapshot history head is malformed");

  runGitSync(
    ["fetch", "--no-tags", "--quiet", sourceRoot, sourceHead],
    snapshotRoot,
  );
  assert(
    runGitSync(["rev-parse", "FETCH_HEAD"], snapshotRoot).trim() === sourceHead,
    "snapshot history fetch resolved a different source revision",
  );
  const historyHead = runGitSync(
    [
      "commit-tree",
      snapshotTree,
      "-p",
      sourceHead,
      "-m",
      "disposable release-input snapshot with receipt ancestry",
    ],
    snapshotRoot,
  ).trim();
  assert(COMMIT.test(historyHead), "snapshot history commit is malformed");
  runGitSync(["update-ref", "HEAD", historyHead, snapshotHead], snapshotRoot);
  assert(
    runGitSync(["rev-parse", "HEAD^{tree}"], snapshotRoot).trim() === snapshotTree,
    "snapshot history binding changed the release-input tree",
  );
  runGitSync(["merge-base", "--is-ancestor", sourceHead, "HEAD"], snapshotRoot);
  assert(
    runGitSync(["status", "--porcelain=v1"], snapshotRoot).trim() === "" &&
      runGitSync(["remote"], snapshotRoot).trim() === "",
    "snapshot history binding dirtied the release-input tree or configured a remote",
  );
  return Object.freeze({ sourceHead, historyHead, snapshotTree });
}

async function runCommand(
  executable,
  arguments_,
  {
    cwd,
    env = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxOutputBytes = MAX_OUTPUT_BYTES,
  } = {},
) {
  return new Promise((resolvePromise) => {
    let settled = false;
    let timedOut = false;
    let outputOverflow = false;
    let stdout = "";
    let stderr = "";
    const child = spawn(executable, arguments_, {
      cwd,
      env: childEnvironment(env),
      stdio: ["ignore", "pipe", "pipe"],
    });

    const finish = (exitCode, signal, spawnError = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(
        Object.freeze({
          command: commandText([executable, ...arguments_]),
          exitCode,
          signal,
          timedOut,
          outputOverflow,
          spawnError,
          stdout,
          stderr,
          output: `${stdout}${stderr}`,
        }),
      );
    };

    const append = (stream, chunk) => {
      const text = chunk.toString("utf8");
      if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) + Buffer.byteLength(text) > maxOutputBytes) {
        outputOverflow = true;
        child.kill("SIGKILL");
        return;
      }
      if (stream === "stdout") stdout += text;
      else stderr += text;
    };

    child.stdout.on("data", (chunk) => append("stdout", chunk));
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    child.on("error", (error) => finish(null, null, error.message));
    child.on("close", (code, signal) => finish(code, signal));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
  });
}

function assertSuccessfulCommand(result, label) {
  assert(result.spawnError === null, `${label}: process error: ${result.spawnError}`);
  assert(!result.timedOut, `${label}: command timed out`);
  assert(!result.outputOverflow, `${label}: command exceeded bounded output`);
  assert(result.signal === null, `${label}: command ended by signal ${result.signal}`);
  assert(
    result.exitCode === 0,
    `${label}: command exited ${result.exitCode}\n${boundedExcerpt(result.output)}`,
  );
}

async function prewarmOwnedPnpmStoreAndInstall(
  cwd,
  label,
  run = runCommand,
) {
  const environment = childEnvironment();
  const store = environment.PNPM_CONFIG_STORE_DIR;
  assert(
    typeof store === "string" &&
      isAbsolute(store) &&
      store === normalize(resolve(store)) &&
      basename(store) === "pnpm-store" &&
      dirname(store) === dirname(environment.HOME) &&
      existsSync(store) &&
      statSync(store).isDirectory() &&
      !isWithin(realpathSync(store), ROOT),
    `${label} pnpm store is not an owned isolated directory`,
  );
  const options = Object.freeze({ cwd, timeoutMs: INSTALL_TIMEOUT_MS });
  const fetch = await run("pnpm", [...PNPM_FETCH_ARGUMENTS], options);
  assertSuccessfulCommand(fetch, `${label} frozen dependency fetch`);
  const install = await run(
    "pnpm",
    [...PNPM_OFFLINE_INSTALL_ARGUMENTS],
    options,
  );
  assertSuccessfulCommand(install, `${label} frozen offline install`);
}

async function buildAstroPrerequisites(
  cwd,
  run = runCommand,
) {
  for (const packageName of ASTRO_PREREQUISITE_BUILD_PACKAGES) {
    const build = await run(
      "pnpm",
      ["--filter", packageName, "build"],
      { cwd, timeoutMs: PACKAGE_TIMEOUT_MS },
    );
    assertSuccessfulCommand(build, `Astro prerequisite build ${packageName}`);
  }
}

function cloneBaseline(source, destination) {
  mkdirSync(destination);
  let result = spawnSync("cp", ["-cR", `${source}/.`, destination], {
    encoding: "utf8",
    env: childEnvironment(),
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  if (result.status !== 0) {
    result = spawnSync("cp", ["-R", `${source}/.`, destination], {
      encoding: "utf8",
      env: childEnvironment(),
      maxBuffer: MAX_OUTPUT_BYTES,
    });
  }
  assert(
    result.error === undefined && result.signal === null && result.status === 0,
    `immutable baseline copy failed: ${boundedExcerpt(`${result.stdout ?? ""}${result.stderr ?? ""}`)}`,
  );
}

async function materializeBaseline(outerRoot, inputManifest, { preserveHistory = false } = {}) {
  const baselineRoot = join(outerRoot, "baseline");
  mkdirSync(baselineRoot);
  for (const { path } of inputManifest.entries) {
    copyTrackedFile(ROOT, baselineRoot, path);
  }
  initializeDisposableRepository(
    baselineRoot,
    inputManifest.entries.map((entry) => entry.path),
  );
  const copied = makeInputManifest(baselineRoot);
  assert(copied.digest === inputManifest.digest, "baseline differs from measured release inputs");

  await prewarmOwnedPnpmStoreAndInstall(baselineRoot, "baseline");
  const build = await runCommand("pnpm", ["build"], {
    cwd: baselineRoot,
    timeoutMs: PACKAGE_TIMEOUT_MS,
  });
  assertSuccessfulCommand(build, "baseline build");
  verifyInputManifest(inputManifest, baselineRoot);
  if (preserveHistory) {
    attachSourceHistoryToSnapshot(baselineRoot, ROOT);
    verifyInputManifest(inputManifest, baselineRoot);
  }
  return Object.freeze({ root: baselineRoot, inputManifest });
}

async function verifyAstroRegeneration(outerRoot) {
  assertOwnedTempRoot(outerRoot);
  const checkoutRoot = join(outerRoot, "astro-regeneration-checkout");
  const sourceHead = runGitSync(["rev-parse", "HEAD"], ROOT).trim();
  assert(COMMIT.test(sourceHead), "Astro regeneration source HEAD is malformed");

  const cloneResult = await runCommand(
    "git",
    [
      "clone",
      "--local",
      "--no-hardlinks",
      "--no-tags",
      "--no-checkout",
      "--quiet",
      ROOT,
      checkoutRoot,
    ],
    { cwd: outerRoot },
  );
  assertSuccessfulCommand(cloneResult, "Astro regeneration clean clone");
  runGitSync(["checkout", "--quiet", "--detach", sourceHead], checkoutRoot);
  runGitSync(["remote", "remove", "origin"], checkoutRoot);
  assert(
    runGitSync(["rev-parse", "HEAD"], checkoutRoot).trim() === sourceHead &&
      runGitSync(["status", "--porcelain=v1"], checkoutRoot).trim() === "",
    "Astro regeneration checkout is not the exact clean committed HEAD",
  );

  const generatedDirectory = join(checkoutRoot, ASTRO_GENERATED_DIRECTORY);
  assert(
    !existsSync(generatedDirectory),
    "clean Astro regeneration checkout already contains generated state",
  );
  assert(
    runGitSync(
      ["ls-files", "--", ASTRO_GENERATED_DIRECTORY],
      checkoutRoot,
    ).trim() === "",
    "clean Astro regeneration checkout tracks generated state",
  );
  runGitSync(
    [
      "check-ignore",
      "--quiet",
      `${ASTRO_GENERATED_DIRECTORY}/types.d.ts`,
    ],
    checkoutRoot,
  );

  const manifest = JSON.parse(
    readFileSync(
      join(checkoutRoot, "examples/adapter-ssr/package.json"),
      "utf8",
    ),
  );
  assert(
    manifest.name === ASTRO_HARNESS_PACKAGE &&
      manifest.scripts?.check === "astro check" &&
      manifest.scripts?.build === "astro build" &&
      manifest.devDependencies?.astro === "7.2.0" &&
      manifest.devDependencies?.["@astrojs/check"] === "0.9.10",
    "Astro regeneration checkout does not retain the pinned package-local commands",
  );

  const inputPathsBefore = releaseInputPaths(checkoutRoot);
  await prewarmOwnedPnpmStoreAndInstall(
    checkoutRoot,
    "Astro regeneration checkout",
  );
  assert(
    !existsSync(generatedDirectory),
    "dependency installation created Astro generated state before the proof",
  );

  await buildAstroPrerequisites(checkoutRoot);
  assert(
    !existsSync(generatedDirectory),
    "prerequisite package builds created Astro generated state before the proof",
  );

  const check = await runCommand(
    "pnpm",
    ["--filter", ASTRO_HARNESS_PACKAGE, "check"],
    { cwd: checkoutRoot, timeoutMs: PACKAGE_TIMEOUT_MS },
  );
  assertSuccessfulCommand(check, "pinned Astro check");
  const build = await runCommand(
    "pnpm",
    ["--filter", ASTRO_HARNESS_PACKAGE, "build"],
    { cwd: checkoutRoot, timeoutMs: PACKAGE_TIMEOUT_MS },
  );
  assertSuccessfulCommand(build, "pinned Astro build");

  assert(
    existsSync(generatedDirectory) &&
      lstatSync(generatedDirectory).isDirectory(),
    "pinned Astro commands did not regenerate the harness-local state directory",
  );
  assert(
    runGitSync(
      ["ls-files", "--", ASTRO_GENERATED_DIRECTORY],
      checkoutRoot,
    ).trim() === "",
    "Astro regeneration introduced tracked generated state",
  );
  const inputPathsAfter = releaseInputPaths(checkoutRoot);
  assert(
    JSON.stringify(inputPathsAfter) === JSON.stringify(inputPathsBefore),
    "Astro regeneration changed the tracked release input path set",
  );
  assertNoAstroReleaseAuthority(
    makeInputManifest(checkoutRoot, inputPathsAfter),
    "regenerated release input manifest",
  );

  console.log(
    `PHASE09_ASTRO_REGENERATION_OK head=${sourceHead} check=passed build=passed tracked=0 sealed=0`,
  );
}

function replaceExactOnce(source, before, after, label) {
  const occurrences = countOccurrences(source, before);
  assert(
    occurrences === 1,
    `${label}: exact replacement occurrence count is ${occurrences}, expected 1`,
  );
  return source.replace(before, after);
}

function parseVitestFailure(reportPath, row) {
  assert(existsSync(reportPath), `${row.id}: Vitest JSON report is missing`);
  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (error) {
    throw new Error(`${row.id}: Vitest JSON report is unreadable: ${error instanceof Error ? error.message : String(error)}`);
  }
  const results = Array.isArray(report.testResults) ? report.testResults : [];
  const assertions = results.flatMap((result) =>
    Array.isArray(result.assertionResults) ? result.assertionResults : [],
  );
  const activeAssertions = assertions.filter(
    (assertion) => !["skipped", "pending", "todo"].includes(assertion.status),
  );
  const failedAssertions = activeAssertions.filter((assertion) => assertion.status === "failed");
  const labels = failedAssertions.map((assertion) =>
    [
      ...(Array.isArray(assertion.ancestorTitles) ? assertion.ancestorTitles : []),
      assertion.title,
      assertion.fullName,
    ]
      .filter((value) => typeof value === "string")
      .join(" "),
  );
  const counts = Object.freeze({
    files: results.length,
    tests: activeAssertions.length,
    assertions: activeAssertions.length,
  });
  assert(report.success === false, `${row.id}: failed-mutant report claimed success`);
  assert(
    counts.files === row.expectedCounts.files &&
      counts.tests === row.expectedCounts.tests &&
      counts.assertions === row.expectedCounts.assertions,
    `${row.id}: detector counts were ${stableJson(counts)}, expected ${stableJson(row.expectedCounts)}`,
  );
  assert(failedAssertions.length === 1, `${row.id}: detector did not report exactly one failed assertion`);
  assert(
    report.numFailedTests === 1,
    `${row.id}: Vitest aggregate did not report exactly one failed named test`,
  );
  assert(
    labels.filter((label) => label.includes(row.assertionFingerprint)).length === 1,
    `${row.id}: unrelated nonzero did not match ${row.assertionFingerprint}`,
  );
  assert(
    !Array.isArray(report.unhandledErrors) || report.unhandledErrors.length === 0,
    `${row.id}: Vitest reported an unhandled infrastructure error`,
  );
  return Object.freeze({ counts, observedFingerprint: row.assertionFingerprint });
}

function validateSemanticVerdict(row, compile, killer, observation) {
  assertSuccessfulCommand(compile, `${row.id} compile`);
  assert(killer.spawnError === null, `${row.id}: killer process error: ${killer.spawnError}`);
  assert(!killer.timedOut, `${row.id}: killer command timed out`);
  assert(!killer.outputOverflow, `${row.id}: killer exceeded bounded output`);
  assert(killer.signal === null, `${row.id}: killer ended by signal ${killer.signal}`);
  assert(killer.exitCode !== 0, `${row.id}: mutant survived with exit 0`);
  assert(
    observation.counts.files > 0 &&
      observation.counts.tests > 0 &&
      observation.counts.assertions > 0,
    `${row.id}: detector reported zero tests/assertions`,
  );
  assert(
    JSON.stringify(observation.counts) === JSON.stringify(row.expectedCounts),
    `${row.id}: semantic detector counts drifted`,
  );
  assert(
    observation.observedFingerprint === row.assertionFingerprint,
    `${row.id}: unrelated nonzero fingerprint`,
  );
}

function packageCaptureHookSource() {
  return `import fs from "node:fs";\n` +
    `import path from "node:path";\n` +
    `import { syncBuiltinESMExports } from "node:module";\n` +
    `const original = fs.rmSync.bind(fs);\n` +
    `const capture = process.env.PHASE09_MUTATION_CAPTURE_DIR;\n` +
    `const wanted = new Set(["vitest-consent.json", "vitest-react-mismatch.json"]);\n` +
    `function scan(root) {\n` +
    `  const stack = [root];\n` +
    `  while (stack.length > 0) {\n` +
    `    const current = stack.pop();\n` +
    `    let entries = [];\n` +
    `    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }\n` +
    `    for (const entry of entries) {\n` +
    `      const item = path.join(current, entry.name);\n` +
    `      if (entry.isFile() && wanted.has(entry.name)) {\n` +
    `        fs.copyFileSync(item, path.join(capture, entry.name));\n` +
    `      } else if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") {\n` +
    `        stack.push(item);\n` +
    `      }\n` +
    `    }\n` +
    `  }\n` +
    `}\n` +
    `fs.rmSync = function patchedRmSync(target, options) {\n` +
    `  if (capture && typeof target === "string" && path.basename(target).startsWith("concierge-phase09-pack-") && fs.existsSync(target)) scan(target);\n` +
    `  return original(target, options);\n` +
    `};\n` +
    `syncBuiltinESMExports();\n`;
}

async function runKiller(row, mutantRoot, outerRoot) {
  const spec = KILLER_COMMANDS[row.id];
  const reportPath = join(mutantRoot, `.phase09-${row.id.toLowerCase()}-report.json`);
  const arguments_ = spec.slice(1).map((argument) =>
    argument.replace("{report}", reportPath),
  );
  const options = {
    cwd: mutantRoot,
    timeoutMs: row.killerKind === "package" || row.id === "M-09-P1"
      ? PACKAGE_TIMEOUT_MS
      : DEFAULT_TIMEOUT_MS,
    env: { ...MUTANT_EXECUTION_ENV },
  };
  let capturePath = null;
  if (row.killerKind === "package") {
    const captureDirectory = join(outerRoot, `capture-${row.id.toLowerCase()}`);
    mkdirSync(captureDirectory);
    const hookPath = join(outerRoot, `capture-hook-${row.id.toLowerCase()}.mjs`);
    writeFileSync(hookPath, packageCaptureHookSource(), "utf8");
    const hookOption = `--import=${pathToFileURL(hookPath).href}`;
    options.env = {
      ...MUTANT_EXECUTION_ENV,
      NODE_OPTIONS: hookOption,
      PHASE09_MUTATION_CAPTURE_DIR: captureDirectory,
    };
    capturePath = join(
      captureDirectory,
      row.id === "M-09-S1" ? "vitest-consent.json" : "vitest-react-mismatch.json",
    );
  }
  const result = await runCommand(spec[0], arguments_, options);
  let observation;
  if (row.killerKind === "vitest") {
    observation = parseVitestFailure(reportPath, row);
  } else if (row.killerKind === "package") {
    observation = parseVitestFailure(capturePath, row);
  } else {
    assert(
      result.output.includes(row.assertionFingerprint),
      `${row.id}: unrelated nonzero did not contain the registered semantic fingerprint`,
    );
    observation = Object.freeze({
      counts: Object.freeze({ ...row.expectedCounts }),
      observedFingerprint: row.assertionFingerprint,
    });
  }
  return Object.freeze({ result, observation });
}

function mutationRowMetadata(row, root) {
  const originalSource = readFileSync(join(root, row.target), "utf8");
  const mutantSource = replaceExactOnce(
    originalSource,
    row.exactBefore,
    row.exactAfter,
    row.id,
  );
  return Object.freeze({
    definitionDigest: definitionDigest(row),
    originalTargetHash: sha256(originalSource),
    mutantTargetHash: sha256(mutantSource),
    testHashes: testHashes(row, root),
  });
}

async function executeMutant(row, baseline, liveState, outerRoot) {
  verifyInputManifest(baseline.inputManifest, baseline.root);
  const mutantRoot = join(outerRoot, `mutant-${row.id.toLowerCase()}`);
  cloneBaseline(baseline.root, mutantRoot);
  const targetPath = join(mutantRoot, row.target);
  assertSnapshotPath(targetPath, mutantRoot);
  const source = readFileSync(targetPath, "utf8");
  const originalTargetHash = sha256(source);
  const mutated = replaceExactOnce(source, row.exactBefore, row.exactAfter, row.id);
  const mutantTargetHash = sha256(mutated);
  assert(originalTargetHash !== mutantTargetHash, `${row.id}: mutant target hash is unchanged`);
  writeFileSync(targetPath, mutated, "utf8");
  assert(sha256File(targetPath) === mutantTargetHash, `${row.id}: mutant write digest changed`);

  let compile;
  let killer;
  let observation;
  try {
    const compileSpec = COMPILE_COMMANDS[row.id];
    compile = await runCommand(compileSpec[0], compileSpec.slice(1), {
      cwd: mutantRoot,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      env: { ...MUTANT_EXECUTION_ENV },
    });
    assertSuccessfulCommand(compile, `${row.id} compile`);
    ({ result: killer, observation } = await runKiller(row, mutantRoot, outerRoot));
    validateSemanticVerdict(row, compile, killer, observation);
  } finally {
    writeFileSync(targetPath, source, "utf8");
  }

  assert(sha256File(targetPath) === originalTargetHash, `${row.id}: disposable target was not restored`);
  verifyInputManifest(baseline.inputManifest, mutantRoot);
  assertCleanReleaseInputs(
    mutantRoot,
    baseline.inputManifest.entries.map((entry) => entry.path),
  );
  verifyInputManifest(baseline.inputManifest, baseline.root);
  verifyLiveMutationState(liveState);
  assertOutputEndpoints(liveState.outputEndpoints);

  const metadata = mutationRowMetadata(row, baseline.root);
  assert(metadata.originalTargetHash === originalTargetHash, `${row.id}: original target digest drifted`);
  assert(metadata.mutantTargetHash === mutantTargetHash, `${row.id}: mutant target digest drifted`);
  const revisionDigest = sha256(
    stableJson({
      id: row.id,
      releaseInputDigest: baseline.inputManifest.digest,
      registerDigest: registerDigest(baseline.root),
      definitionDigest: metadata.definitionDigest,
      originalTargetHash,
      mutantTargetHash,
      testHashes: metadata.testHashes,
    }),
  );
  return Object.freeze({
    id: row.id,
    status: "green",
    target: row.target,
    affectedPackage: row.affectedPackage,
    testId: row.testId,
    requirement: row.requirement,
    threat: row.threat,
    decisions: row.decisions,
    definitionDigest: metadata.definitionDigest,
    originalTargetHash,
    mutantTargetHash,
    testHashes: metadata.testHashes,
    revisionDigest,
    compile: Object.freeze({
      command: row.compileCommand,
      exitCode: compile.exitCode,
      outputDigest: sha256(compile.output),
    }),
    killer: Object.freeze({
      command: row.killerCommand,
      kind: row.killerKind,
      exitCode: killer.exitCode,
      counts: observation.counts,
      assertionFingerprint: observation.observedFingerprint,
      outputDigest: sha256(killer.output),
    }),
    exactReplacementCount: 1,
    compiled: true,
    killed: true,
    targetRestored: true,
    liveTreeUnchanged: true,
    executedAt: new Date().toISOString(),
  });
}

function mutationLiveState({
  allowRunnerModification = false,
  allowVersionedWorktree = false,
} = {}) {
  const trackedPaths = releaseInputPaths(ROOT);
  const versionedState = allowVersionedWorktree
    ? readVersionReceipt(ROOT)
    : null;
  const paths = trackedPaths;
  const allowedModifiedPaths = [
    ...(allowRunnerModification
      ? ["scripts/phase-09-mutation-battery.mjs"]
      : []),
  ];
  assertCleanReleaseInputs(ROOT, paths, { allowedModifiedPaths });
  return Object.freeze({
    paths,
    inputManifest: makeInputManifest(ROOT, paths),
    allowedModifiedPaths,
    versioned: allowVersionedWorktree,
    authorization: Object.freeze(
      allowVersionedWorktree
        ? {
            mode: "versioned",
            releaseAuthorization: true,
            runAttempt: versionedState.receipt.runAttempt,
            sharedVersion: versionedState.receipt.sharedVersion,
            consumedChangesets: versionedState.receipt.consumedChangesets,
            versionReceipt: versionReceiptBinding(ROOT, versionedState),
          }
        : {
            mode: "feature",
            releaseAuthorization: false,
            runAttempt: null,
            sharedVersion: null,
            consumedChangesets: Object.freeze([]),
            versionReceipt: null,
          },
    ),
    outputEndpoints: outputEndpoints(),
  });
}

function mutationLockPath() {
  const common = runGitSync(["rev-parse", "--git-common-dir"], ROOT).trim();
  return resolve(ROOT, common, "phase-09-mutation-battery.lock");
}

async function withMutationLock(operation) {
  const path = mutationLockPath();
  let descriptor;
  try {
    descriptor = openSync(path, "wx");
  } catch (error) {
    throw new Error(`${operation}: mutation battery is already running (${error instanceof Error ? error.message : String(error)})`);
  }
  try {
    return await operation();
  } finally {
    closeSync(descriptor);
    unlinkSync(path);
  }
}

async function runPreflight(id, outerRoot) {
  assertOwnedTempRoot(outerRoot);
  const register = validateRegister(readRegister());
  const row = register.rows.find((candidate) => candidate.id === id);
  assert(row !== undefined, `unknown registered preflight mutant: ${id}`);
  const liveState = mutationLiveState({ allowRunnerModification: true });
  const baseline = await materializeBaseline(outerRoot, liveState.inputManifest);
  const result = await executeMutant(row, baseline, liveState, outerRoot);
  assert(result.status === "green" && result.killed, `${id}: preflight did not close green`);
  console.log(
    `PHASE09_MUTATION_PREFLIGHT_OK id=${id} files=${result.killer.counts.files} tests=${result.killer.counts.tests} assertions=${result.killer.counts.assertions} restored=true liveTreeUnchanged=true`,
  );
  assertOutputEndpoints(liveState.outputEndpoints);
}

function assertThrows(operation, pattern, label) {
  let observed = null;
  try {
    operation();
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
  }
  assert(
    observed !== null && pattern.test(observed),
    `self-test ${label} did not reject as expected; observed ${JSON.stringify(observed)}`,
  );
}

async function assertRejects(operation, pattern, label) {
  let observed = null;
  try {
    await operation();
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
  }
  assert(
    observed !== null && pattern.test(observed),
    `self-test ${label} did not reject as expected; observed ${JSON.stringify(observed)}`,
  );
}

function syntheticCommand(exitCode, overrides = {}) {
  return {
    command: "synthetic",
    exitCode,
    signal: null,
    timedOut: false,
    outputOverflow: false,
    spawnError: null,
    stdout: "",
    stderr: "",
    output: "",
    ...overrides,
  };
}

async function runSelfTest() {
  const endpoints = outputEndpoints();
  const register = validateRegister(readRegister());
  const row = register.rows[0];
  let controls = 0;
  const pass = (name) => {
    controls += 1;
    console.log(`SELF_TEST_OK ${name}`);
  };

  assertThrows(
    () => replaceExactOnce("needle needle", "needle", "mutant", "ambiguous"),
    /occurrence count is 2/u,
    "ambiguous needle",
  );
  pass("ambiguous-needle");
  assertThrows(
    () => replaceExactOnce("source", "needle", "mutant", "missing"),
    /occurrence count is 0/u,
    "missing needle",
  );
  pass("missing-needle");

  const goodObservation = {
    counts: { files: 1, tests: 1, assertions: 1 },
    observedFingerprint: row.assertionFingerprint,
  };
  assertThrows(
    () => validateSemanticVerdict(row, syntheticCommand(2), syntheticCommand(1), goodObservation),
    /compile.*exited 2/u,
    "compile failure",
  );
  pass("compile-failure");
  assertThrows(
    () => validateSemanticVerdict(row, syntheticCommand(0), syntheticCommand(null, { timedOut: true }), goodObservation),
    /timed out/u,
    "timeout verdict",
  );
  pass("timeout");
  assertThrows(
    () => validateSemanticVerdict(row, syntheticCommand(0), syntheticCommand(1), { counts: { files: 0, tests: 0, assertions: 0 }, observedFingerprint: row.assertionFingerprint }),
    /zero tests\/assertions/u,
    "zero tests",
  );
  pass("zero-tests");
  assertThrows(
    () => validateSemanticVerdict(row, syntheticCommand(0), syntheticCommand(1), { ...goodObservation, observedFingerprint: "unrelated" }),
    /unrelated nonzero/u,
    "unrelated failure",
  );
  pass("generic-failure-impersonation");
  assertThrows(
    () => validateSemanticVerdict(row, syntheticCommand(0), syntheticCommand(0), goodObservation),
    /survived/u,
    "survivor",
  );
  pass("survivor");

  const timeoutResult = await runCommand(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], {
    cwd: ROOT,
    timeoutMs: 25,
  });
  assert(timeoutResult.timedOut, "self-test subprocess timeout was not observed");
  pass("bounded-subprocess-timeout");

  const temporaryRoot = createOwnedTempRoot();
  try {
    const fixtureRoot = join(temporaryRoot, "manifest-fixture");
    mkdirSync(fixtureRoot);
    writeFileSync(join(fixtureRoot, "input.txt"), "A\n", "utf8");
    const manifest = makeInputManifest(fixtureRoot, ["input.txt"]);
    writeFileSync(join(fixtureRoot, "input.txt"), "B\n", "utf8");
    assertThrows(
      () => verifyInputManifest(manifest, fixtureRoot, { verifyPathSet: false }),
      /digest is stale/u,
      "stale input digest",
    );
    pass("stale-input-digest");
    assertThrows(
      () => {
        writeFileSync(join(fixtureRoot, "input.txt"), "not-restored\n", "utf8");
        verifyInputManifest(manifest, fixtureRoot, { verifyPathSet: false });
      },
      /digest is stale/u,
      "dirty restoration",
    );
    pass("dirty-restoration");
    assertThrows(
      () => assert(registerDigest() === "0".repeat(64), "register digest is stale"),
      /register digest is stale/u,
      "stale register digest",
    );
    pass("stale-register-digest");
    const hashes = testHashes(row);
    assertThrows(
      () => assert(hashes[Object.keys(hashes)[0]] === "0".repeat(64), "test digest is stale"),
      /test digest is stale/u,
      "stale test digest",
    );
    pass("stale-test-digest");
    assertThrows(
      () => assertSnapshotPath(join(ROOT, row.target), fixtureRoot),
      /live-tree-write attempt/u,
      "live tree write",
    );
    pass("live-tree-write");

    const phase08Fixture = join(temporaryRoot, "phase08-fixture");
    mkdirSync(phase08Fixture);
    for (const path of PHASE08_PATHS) copyTrackedFile(ROOT, phase08Fixture, path);
    const inheritedFixtureHashes = phase08Hashes(phase08Fixture);
    writeFileSync(
      join(phase08Fixture, PHASE08_PATHS[0]),
      "synthetic inherited drift\n",
      "utf8",
    );
    assertThrows(
      () => assertPhase08Hashes(inheritedFixtureHashes, phase08Fixture),
      /Phase 8 records drifted/u,
      "inherited Phase 8 drift",
    );
    pass("inherited-phase08-drift");
  } finally {
    removeOwnedTempRoot(temporaryRoot);
  }

  const historyRoot = createOwnedTempRoot();
  try {
    const sourceRoot = join(historyRoot, "history-source");
    const snapshotRoot = join(historyRoot, "history-snapshot");
    mkdirSync(sourceRoot);
    mkdirSync(join(sourceRoot, ".changeset"));
    writeFileSync(join(sourceRoot, ".changeset/example.md"), "bounded change\n", "utf8");
    writeFileSync(join(sourceRoot, "input.txt"), "before\n", "utf8");
    initializeDisposableRepository(
      sourceRoot,
      [".changeset/example.md", "input.txt"],
    );
    const baseHead = runGitSync(["rev-parse", "HEAD"], sourceRoot).trim();
    const changesetBytes = readFileSync(join(sourceRoot, ".changeset/example.md"));
    rmSync(join(sourceRoot, ".changeset/example.md"));
    writeFileSync(join(sourceRoot, "input.txt"), "after\n", "utf8");
    runGitSync(["add", "--all"], sourceRoot);
    runGitSync(["commit", "--quiet", "-m", "synthetic version commit"], sourceRoot);
    const sourceHead = runGitSync(["rev-parse", "HEAD"], sourceRoot).trim();

    mkdirSync(snapshotRoot);
    copyTrackedFile(sourceRoot, snapshotRoot, "input.txt");
    initializeDisposableRepository(snapshotRoot, ["input.txt"]);
    const binding = attachSourceHistoryToSnapshot(snapshotRoot, sourceRoot);
    runGitSync(["merge-base", "--is-ancestor", baseHead, "HEAD"], snapshotRoot);
    assert(
      binding.sourceHead === sourceHead &&
        gitShowBuffer(baseHead, ".changeset/example.md", snapshotRoot)?.equals(
          changesetBytes,
        ) === true &&
        runGitSync(["ls-files"], snapshotRoot).trim() === "input.txt" &&
        readFileSync(join(snapshotRoot, "input.txt"), "utf8") === "after\n",
      "history-backed snapshot did not preserve exact inputs and receipt ancestry",
    );
    pass("history-backed-version-receipt-snapshot");
  } finally {
    removeOwnedTempRoot(historyRoot);
  }

  const duplicate = clone(register);
  duplicate.rows[1].id = duplicate.rows[0].id;
  assertThrows(
    () => validateRegister(duplicate, ROOT, { requireTracked: false }),
    /duplicate|row ids/u,
    "duplicate ID",
  );
  pass("duplicate-id");
  const missing = clone(register);
  missing.expectedIds.pop();
  missing.rows.pop();
  assertThrows(
    () => validateRegister(missing, ROOT, { requireTracked: false }),
    /expectedIds.*missing|expectedIds.*reordered|expectedIds.*extra/u,
    "missing ID",
  );
  pass("missing-id");
  const extra = clone(register);
  extra.expectedIds.push("M-10-EXTRA");
  extra.rows.push({ ...extra.rows.at(-1), id: "M-10-EXTRA" });
  assertThrows(
    () => validateRegister(extra, ROOT, { requireTracked: false }),
    /expectedIds.*missing|expectedIds.*reordered|expectedIds.*extra/u,
    "extra ID",
  );
  pass("extra-id");
  const reordered = clone(register);
  [reordered.expectedIds[7], reordered.expectedIds[8]] = [
    reordered.expectedIds[8],
    reordered.expectedIds[7],
  ];
  [reordered.rows[7], reordered.rows[8]] = [
    reordered.rows[8],
    reordered.rows[7],
  ];
  assertThrows(
    () => validateRegister(reordered, ROOT, { requireTracked: false }),
    /expectedIds.*missing|expectedIds.*reordered|expectedIds.*extra/u,
    "reordered IDs",
  );
  pass("reordered-ids");
  assertThrows(
    () => parseInvocation(["run", "all", "--jobs", "5"]),
    /Usage/u,
    "unbounded jobs",
  );
  pass("jobs-bound");
  assertThrows(
    () => parseInvocation(["verify", "inputs"]),
    /Usage/u,
    "undeclared CLI",
  );
  pass("exact-cli");
  const astroRegenerationInvocation = parseInvocation([
    "verify",
    "astro-regeneration",
  ]);
  assert(
    astroRegenerationInvocation.kind === "verify-astro-regeneration",
    "Astro regeneration verifier invocation drifted",
  );
  pass("astro-regeneration-cli");
  assert(
    !isReleaseInputPath(
      `${ASTRO_GENERATED_DIRECTORY}/content.d.ts`,
    ),
    "Astro generated declaration was admitted as a release input",
  );
  assertThrows(
    () =>
      assertNoAstroReleaseAuthority(
        {
          digestTable: {
            path: `${ASTRO_GENERATED_DIRECTORY}/content.d.ts`,
            sha256: "a".repeat(64),
          },
        },
        "synthetic release seal",
      ),
    /contains harness-local Astro generated state/u,
    "Astro generated state in release authority",
  );
  pass("astro-release-authority-rejected");
  const versionedInvocation = parseInvocation([
    "finalize",
    "versioned",
    "--jobs",
    "2",
  ]);
  assert(
    versionedInvocation.kind === "run-all" &&
      versionedInvocation.jobs === 2 &&
      versionedInvocation.versioned === true,
    "versioned invocation did not retain its worktree mode",
  );
  pass("versioned-cli");
  const versionedPreflightInvocation = parseInvocation([
    "preflight",
    "versioned",
    "--jobs",
    "4",
  ]);
  assert(
    versionedPreflightInvocation.kind === "run-all" &&
      versionedPreflightInvocation.jobs === 4 &&
      versionedPreflightInvocation.versioned === true &&
      versionedPreflightInvocation.installOutputs === false,
    "versioned preflight invocation can install outputs",
  );
  pass("versioned-preflight-noninstalling-cli");

  const canonicalValidation = makeValidationMarkdown({
    releaseInputDigest: "a".repeat(64),
    registerHash: "b".repeat(64),
    mutationRows: register.rows,
    archiveDigest: "c".repeat(64),
    releaseCommandCount: 15,
    releaseTests: { files: 5, tests: 10, assertions: 10 },
    inheritedHashes: Object.fromEntries(
      PHASE08_PATHS.map((path) => [path, "d".repeat(64)]),
    ),
  });
  const canonicalValidationBody = verifyMarkdownSeal(
    canonicalValidation,
    "synthetic canonical validation",
  );
  validateValidationMetadata(canonicalValidationBody);
  assertThrows(
    () =>
      validateValidationMetadata(
        canonicalValidationBody.replace(
          "nyquist_compliant: true",
          "nyquist_compliant: false",
        ),
      ),
    /validation metadata must be complete/u,
    "malformed validation metadata",
  );
  pass("malformed-validation-metadata");

  let preflightInstallCalls = 0;
  const preflightInstalled = completeGeneratedOutputTransaction(ROOT, {
    installOutputs: false,
    expectedEndpoints: endpoints,
    install: () => {
      preflightInstallCalls += 1;
    },
  });
  assert(
    preflightInstalled === false && preflightInstallCalls === 0,
    "non-installing preflight invoked the output installer",
  );
  pass("accidental-preflight-installation");

  const syntheticHome = join(SYSTEM_TEMP_ROOT, "phase09-finalization-self-test-home");
  for (const hostileEnvironment of [
    {
      PATH: process.env.PATH,
      HOME: syntheticHome,
      gItHuB_ToKeN: "phase09-secret-repository",
    },
    {
      PATH: process.env.PATH,
      HOME: syntheticHome,
      NoDe_AuTh_ToKeN: "phase09-secret-npm",
    },
    {
      PATH: process.env.PATH,
      HOME: syntheticHome,
      nPm_CoNfIg_ReGiStRy: "https://hostile.invalid/",
    },
    {
      PATH: process.env.PATH,
      HOME: syntheticHome,
      pNpM_cOnFiG_rEgIsTrY: "https://hostile.invalid/",
    },
    {
      PATH: process.env.PATH,
      HOME: syntheticHome,
      gIt_CoNfIg_GlObAl: "/tmp/hostile-gitconfig",
    },
    {
      PATH: process.env.PATH,
      HOME: syntheticHome,
      Gh_EnTeRpRiSe_ToKeN: "phase09-secret-gh-alias",
    },
    {
      PATH: process.env.PATH,
      HOME: syntheticHome,
      TmPdIr: ROOT,
    },
  ]) {
    let childCallbacks = 0;
    assertThrows(
      () =>
        runAfterCredentialFreeFinalizationPreflight(
          hostileEnvironment,
          () => {
            childCallbacks += 1;
          },
          { pathPresent: () => false, repositoryRoot: ROOT },
        ),
      /credential-free finalization rejected ambient environment variable/u,
      "credential-bearing finalization environment",
    );
    assert(
      childCallbacks === 0,
      "finalization preflight invoked a child callback after rejecting credentials",
    );
  }
  pass("finalization-environment-preflight-before-child");

  let configChildCallbacks = 0;
  assertThrows(
    () =>
      runAfterCredentialFreeFinalizationPreflight(
        { PATH: process.env.PATH, HOME: syntheticHome },
        () => {
          configChildCallbacks += 1;
        },
        {
          pathPresent: (path) => path === join(syntheticHome, ".npmrc"),
          repositoryRoot: ROOT,
        },
      ),
    /ambient HOME credential\/config path.*\.npmrc/u,
    "ambient npm config path",
  );
  assert(
    configChildCallbacks === 0,
    "finalization preflight invoked a child callback after rejecting npm config",
  );
  pass("finalization-config-preflight-before-child");
  const publishInvocation = parseInvocation([
    "verify",
    "publish",
    "/tmp/phase09-archives",
  ]);
  assert(
    publishInvocation.kind === "verify-publish" &&
      publishInvocation.archiveDirectory === "/tmp/phase09-archives",
    "publish verifier invocation drifted",
  );
  pass("publish-verifier-cli");

  const featureAuthorization = {
    mode: "feature",
    releaseAuthorization: false,
    runAttempt: null,
    sharedVersion: null,
    consumedChangesets: [],
    versionReceipt: null,
  };
  validateReleaseAuthorization(featureAuthorization, "synthetic feature");
  pass("feature-evidence-non-authorizing");
  assertThrows(
    () =>
      validateReleaseAuthorization(featureAuthorization, "synthetic feature", {
        publishing: true,
      }),
    /cannot authorize publication/u,
    "ordinary mode publication",
  );
  pass("ordinary-mode-publish-rejected");
  assertThrows(
    () =>
      validateReleaseAuthorization(
        {
          mode: "versioned",
          releaseAuthorization: true,
          runAttempt: 1,
          sharedVersion: "0.0.0",
          consumedChangesets: [
            { path: ".changeset/example.md", sha256: "a".repeat(64) },
          ],
          versionReceipt: {
            path: VERSION_RECEIPT_RELATIVE_PATH,
            sha256: "b".repeat(64),
            baseSha: "c".repeat(40),
            repository: EXPECTED_REPOSITORY,
            runId: "123456",
            runAttempt: 1,
            artifactName: `phase09-version-123456-1-${"c".repeat(40)}`,
          },
        },
        "synthetic zero version",
        { publishing: true },
      ),
    /nonzero release authorization/u,
    "zero release version",
  );
  pass("zero-version-publish-rejected");
  assertThrows(
    () =>
      validateReleaseAuthorization(
        {
          mode: "versioned",
          releaseAuthorization: true,
          runAttempt: 1,
          sharedVersion: "0.1.0",
          consumedChangesets: [],
          versionReceipt: {
            path: VERSION_RECEIPT_RELATIVE_PATH,
            sha256: "b".repeat(64),
            baseSha: "c".repeat(40),
            repository: EXPECTED_REPOSITORY,
            runId: "123456",
            runAttempt: 1,
            artifactName: `phase09-version-123456-1-${"c".repeat(40)}`,
          },
        },
        "synthetic removed changeset",
        { publishing: true },
      ),
    /nonzero release authorization/u,
    "removed changeset authorization",
  );
  pass("removed-changeset-publish-rejected");
  const versionedAuthorization = {
    mode: "versioned",
    releaseAuthorization: true,
    runAttempt: 1,
    sharedVersion: "0.1.0",
    consumedChangesets: [
      { path: ".changeset/example.md", sha256: "a".repeat(64) },
    ],
    versionReceipt: {
      path: VERSION_RECEIPT_RELATIVE_PATH,
      sha256: "b".repeat(64),
      baseSha: "c".repeat(40),
      repository: EXPECTED_REPOSITORY,
      runId: "123456",
      runAttempt: 1,
      artifactName: `phase09-version-123456-1-${"c".repeat(40)}`,
    },
  };
  const missingEvidenceAttempt = clone(versionedAuthorization);
  delete missingEvidenceAttempt.runAttempt;
  assertThrows(
    () => validateReleaseAuthorization(missingEvidenceAttempt, "synthetic missing evidence attempt"),
    /versioned evidence lacks nonzero release authorization/u,
    "missing evidence attempt",
  );
  pass("missing-evidence-attempt-rejected");
  const mismatchedEvidenceAttempt = clone(versionedAuthorization);
  mismatchedEvidenceAttempt.runAttempt = 2;
  assertThrows(
    () => validateReleaseAuthorization(mismatchedEvidenceAttempt, "synthetic evidence attempt mismatch"),
    /version receipt identity is malformed/u,
    "mismatched evidence attempt",
  );
  pass("mismatched-evidence-attempt-rejected");
  const missingAttemptAuthorization = clone(versionedAuthorization);
  delete missingAttemptAuthorization.versionReceipt.runAttempt;
  assertThrows(
    () => validateReleaseAuthorization(missingAttemptAuthorization, "synthetic missing attempt"),
    /version receipt binding keys/u,
    "missing receipt attempt",
  );
  pass("missing-receipt-attempt-rejected");
  const mismatchedAttemptAuthorization = clone(versionedAuthorization);
  mismatchedAttemptAuthorization.versionReceipt.runAttempt = 2;
  assertThrows(
    () => validateReleaseAuthorization(mismatchedAttemptAuthorization, "synthetic attempt mismatch"),
    /version receipt identity is malformed/u,
    "mismatched receipt attempt",
  );
  pass("mismatched-receipt-attempt-rejected");

  const installSequence = [];
  await prewarmOwnedPnpmStoreAndInstall(
    ROOT,
    "synthetic prewarm",
    async (executable, arguments_, options) => {
      installSequence.push({
        arguments_,
        cwd: options.cwd,
        executable,
        timeoutMs: options.timeoutMs,
      });
      return syntheticCommand(0);
    },
  );
  assert(
    JSON.stringify(installSequence) ===
      JSON.stringify([
        {
          arguments_: ["fetch", "--frozen-lockfile", "--ignore-scripts"],
          cwd: ROOT,
          executable: "pnpm",
          timeoutMs: INSTALL_TIMEOUT_MS,
        },
        {
          arguments_: ["install", "--offline", "--frozen-lockfile"],
          cwd: ROOT,
          executable: "pnpm",
          timeoutMs: INSTALL_TIMEOUT_MS,
        },
      ]),
    "owned-store prewarm must precede the exact frozen offline install",
  );
  pass("pnpm-fetch-before-offline-install");

  for (const fetchFailure of [
    syntheticCommand(null, { spawnError: "synthetic fetch failure" }),
    syntheticCommand(null, { timedOut: true }),
    syntheticCommand(null, { outputOverflow: true }),
    syntheticCommand(23),
  ]) {
    let calls = 0;
    await assertRejects(
      () =>
        prewarmOwnedPnpmStoreAndInstall(
          ROOT,
          "synthetic prewarm",
          async () => {
            calls += 1;
            return fetchFailure;
          },
        ),
      /synthetic prewarm frozen dependency fetch: (?:process error|command timed out|command exceeded bounded output|command exited 23)/u,
      "failed dependency fetch",
    );
    assert(calls === 1, "offline install ran after a failed dependency fetch");
  }
  pass("pnpm-fetch-failure-suppresses-install");

  const astroPrerequisiteSequence = [];
  await buildAstroPrerequisites(
    ROOT,
    async (executable, arguments_, options) => {
      astroPrerequisiteSequence.push({
        arguments_,
        cwd: options.cwd,
        executable,
        timeoutMs: options.timeoutMs,
      });
      return syntheticCommand(0);
    },
  );
  assert(
    JSON.stringify(astroPrerequisiteSequence) ===
      JSON.stringify(
        ASTRO_PREREQUISITE_BUILD_PACKAGES.map((packageName) => ({
          arguments_: ["--filter", packageName, "build"],
          cwd: ROOT,
          executable: "pnpm",
          timeoutMs: PACKAGE_TIMEOUT_MS,
        })),
      ),
    "Astro prerequisite package build order drifted",
  );
  pass("astro-prerequisite-build-order");

  assertThrows(
    () => childEnvironment({ PNPM_CONFIG_STORE_DIR: ROOT }),
    /rejected override PNPM_CONFIG_STORE_DIR/u,
    "pnpm store redirect",
  );
  pass("owned-pnpm-store-not-redirectable");

  const pnpmConfig = await runCommand(
    "pnpm",
    ["config", "get", "verify-deps-before-run"],
    { cwd: ROOT, env: { ...MUTANT_EXECUTION_ENV } },
  );
  assertSuccessfulCommand(pnpmConfig, "self-test pnpm mutant configuration");
  assert(
    pnpmConfig.stdout.trim() === "false",
    "manifest mutants must disable pnpm's pre-run dependency install",
  );
  pass("pnpm-pre-run-install-disabled");

  const pnpmStoreConfig = await runCommand(
    "pnpm",
    ["config", "get", "store-dir"],
    { cwd: ROOT },
  );
  assertSuccessfulCommand(pnpmStoreConfig, "self-test pnpm owned store");
  const pnpmRegistryConfig = await runCommand(
    "pnpm",
    ["config", "get", "registry"],
    { cwd: ROOT },
  );
  assertSuccessfulCommand(pnpmRegistryConfig, "self-test pnpm fixed registry");
  assert(
    pnpmStoreConfig.stdout.trim() ===
      childEnvironment().PNPM_CONFIG_STORE_DIR &&
      pnpmRegistryConfig.stdout.trim() === PHASE09_PUBLIC_NPM_REGISTRY,
    "pnpm did not observe the owned store and exact public registry",
  );
  pass("pnpm-owned-store-and-registry");

  const sentinelEnvironment = Object.freeze({
    GITHUB_TOKEN: "phase09-secret-repository-probe",
    NODE_AUTH_TOKEN: "phase09-secret-npm-probe",
    NPM_CONFIG_REGISTRY: "https://hostile.invalid/",
  });
  const previousEnvironment = Object.fromEntries(
    Object.keys(sentinelEnvironment).map((name) => [name, process.env[name]]),
  );
  let environmentProbe;
  try {
    Object.assign(process.env, sentinelEnvironment);
    environmentProbe = await runCommand(
      process.execPath,
      [
        "-e",
        "process.stdout.write(JSON.stringify({github:process.env.GITHUB_TOKEN??null,nodeAuth:process.env.NODE_AUTH_TOKEN??null,registry:process.env.NPM_CONFIG_REGISTRY??null,userConfig:process.env.NPM_CONFIG_USERCONFIG??null,globalConfig:process.env.NPM_CONFIG_GLOBALCONFIG??null,home:process.env.HOME??null,gitGlobal:process.env.GIT_CONFIG_GLOBAL??null,pnpmStore:process.env.PNPM_CONFIG_STORE_DIR??null,marker:process.env.PHASE09_CREDENTIAL_FREE_ENV??null}))",
      ],
      { cwd: ROOT },
    );
  } finally {
    for (const [name, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
  assertSuccessfulCommand(environmentProbe, "self-test secure child probe");
  const observedEnvironment = JSON.parse(environmentProbe.stdout);
  assert(
    observedEnvironment.github === null &&
      observedEnvironment.nodeAuth === null &&
      observedEnvironment.registry === PHASE09_PUBLIC_NPM_REGISTRY &&
      observedEnvironment.marker === "1" &&
      typeof observedEnvironment.home === "string" &&
      !isWithin(observedEnvironment.home, ROOT) &&
      typeof observedEnvironment.pnpmStore === "string" &&
      !isWithin(observedEnvironment.pnpmStore, ROOT) &&
      statSync(observedEnvironment.pnpmStore).isDirectory() &&
      readFileSync(observedEnvironment.userConfig, "utf8") === "" &&
      readFileSync(observedEnvironment.globalConfig, "utf8") === "" &&
      readFileSync(observedEnvironment.gitGlobal, "utf8") === "" &&
      !environmentProbe.output.includes("phase09-secret-") &&
      !environmentProbe.output.includes("hostile.invalid"),
    "secure child probe observed an ambient credential or non-isolated config",
  );
  pass("secure-child-environment-probe");

  assert(controls === 45, `self-test control count drifted: ${controls}`);
  assertOutputEndpoints(endpoints);
  console.log(`PHASE09_MUTATION_SELF_TEST_OK controls=${controls}`);
}

function sealedObject(value) {
  const body = { ...value };
  return Object.freeze({ ...body, contentDigest: sha256(stableJson(body)) });
}

function verifySeal(value, label) {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${label} is malformed`);
  const { contentDigest, ...body } = value;
  assert(SHA256.test(contentDigest), `${label} contentDigest is malformed`);
  assert(contentDigest === sha256(stableJson(body)), `${label} content digest is stale`);
  return body;
}

function markdownSeal(body) {
  return `${body.trimEnd()}\n\n<!-- content-sha256: ${sha256(body.trimEnd())} -->\n`;
}

function verifyMarkdownSeal(text, label) {
  const match = text.match(/\n\n<!-- content-sha256: ([0-9a-f]{64}) -->\n?$/u);
  assert(match !== null, `${label} content digest is missing`);
  const body = text.slice(0, match.index).trimEnd();
  assert(match[1] === sha256(body), `${label} content digest is stale`);
  return body;
}

function validateGreenEvidenceRow(evidenceRow, registerRow, root = ROOT) {
  assert(evidenceRow.id === registerRow.id, `${registerRow.id}: evidence row identity drifted`);
  assert(evidenceRow.status === "green", `${registerRow.id}: evidence is not green`);
  for (const key of ["compiled", "killed", "targetRestored", "liveTreeUnchanged"]) {
    assert(evidenceRow[key] === true, `${registerRow.id}: ${key} is not true`);
  }
  assert(evidenceRow.exactReplacementCount === 1, `${registerRow.id}: exact replacement count drifted`);
  assert(evidenceRow.definitionDigest === definitionDigest(registerRow), `${registerRow.id}: definition digest is stale`);
  const metadata = mutationRowMetadata(registerRow, root);
  assert(evidenceRow.originalTargetHash === metadata.originalTargetHash, `${registerRow.id}: source digest is stale`);
  assert(evidenceRow.mutantTargetHash === metadata.mutantTargetHash, `${registerRow.id}: mutant digest is stale`);
  assert(JSON.stringify(evidenceRow.testHashes) === JSON.stringify(metadata.testHashes), `${registerRow.id}: test digest is stale`);
  assert(evidenceRow.compile.command === registerRow.compileCommand && evidenceRow.compile.exitCode === 0, `${registerRow.id}: compile evidence is invalid`);
  assert(
    evidenceRow.killer.command === registerRow.killerCommand &&
      evidenceRow.killer.kind === registerRow.killerKind &&
      Number.isInteger(evidenceRow.killer.exitCode) &&
      evidenceRow.killer.exitCode !== 0,
    `${registerRow.id}: killer exit evidence is invalid`,
  );
  assert(
    JSON.stringify(evidenceRow.killer.counts) === JSON.stringify(registerRow.expectedCounts),
    `${registerRow.id}: killer positive counts are stale`,
  );
  assert(
    evidenceRow.killer.assertionFingerprint === registerRow.assertionFingerprint,
    `${registerRow.id}: killer fingerprint is stale`,
  );
  assert(SHA256.test(evidenceRow.revisionDigest), `${registerRow.id}: revision digest is malformed`);
}

function validateReleaseAuthorization(value, label, { publishing = false } = {}) {
  assert(
    ["feature", "versioned"].includes(value.mode),
    `${label} mode must be feature or versioned`,
  );
  assert(
    Array.isArray(value.consumedChangesets),
    `${label} consumedChangesets must be an array`,
  );
  if (value.mode === "feature") {
    assert(
      value.releaseAuthorization === false &&
        value.runAttempt === null &&
        value.sharedVersion === null &&
        value.consumedChangesets.length === 0 &&
        value.versionReceipt === null,
      `${label} feature evidence must be explicitly non-authorizing`,
    );
    assert(!publishing, `${label} feature evidence cannot authorize publication`);
    return Object.freeze({
      mode: value.mode,
      releaseAuthorization: value.releaseAuthorization,
      runAttempt: value.runAttempt,
      sharedVersion: value.sharedVersion,
      consumedChangesets: value.consumedChangesets,
      versionReceipt: value.versionReceipt,
    });
  }
  assert(
    value.releaseAuthorization === true &&
      Number.isSafeInteger(value.runAttempt) && value.runAttempt > 0 &&
      typeof value.sharedVersion === "string" &&
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(value.sharedVersion) &&
      value.sharedVersion !== "0.0.0" &&
      value.consumedChangesets.length > 0 &&
      value.versionReceipt !== null && typeof value.versionReceipt === "object",
    `${label} versioned evidence lacks nonzero release authorization`,
  );
  const paths = new Set();
  for (const record of value.consumedChangesets) {
    exactKeys(record, ["path", "sha256"], `${label} consumed changeset`);
    assert(
      /^\.changeset\/[^/]+\.md$/u.test(record.path) &&
        SHA256.test(record.sha256) && !paths.has(record.path),
      `${label} consumed changeset identity is malformed or duplicated`,
    );
    paths.add(record.path);
  }
  exactKeys(
    value.versionReceipt,
    ["path", "sha256", "baseSha", "repository", "runId", "runAttempt", "artifactName"],
    `${label} version receipt binding`,
  );
  assert(
    value.versionReceipt.path === VERSION_RECEIPT_RELATIVE_PATH &&
      SHA256.test(value.versionReceipt.sha256) && COMMIT.test(value.versionReceipt.baseSha) &&
      value.versionReceipt.repository === EXPECTED_REPOSITORY &&
      RUN_ID.test(value.versionReceipt.runId) &&
      Number.isSafeInteger(value.versionReceipt.runAttempt) &&
      value.versionReceipt.runAttempt > 0 &&
      value.versionReceipt.runAttempt === value.runAttempt &&
      value.versionReceipt.artifactName ===
        `phase09-version-${value.versionReceipt.runId}-${value.versionReceipt.runAttempt}-${value.versionReceipt.baseSha}`,
    `${label} version receipt identity is malformed`,
  );
  return Object.freeze({
    mode: value.mode,
    releaseAuthorization: value.releaseAuthorization,
    runAttempt: value.runAttempt,
    sharedVersion: value.sharedVersion,
    consumedChangesets: value.consumedChangesets,
    versionReceipt: value.versionReceipt,
  });
}

function verifyMutationEvidence(root = ROOT, { quiet = false } = {}) {
  const path = join(root, ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json");
  assert(existsSync(path), "09-MUTATION-EVIDENCE.json is missing");
  const evidence = JSON.parse(readFileSync(path, "utf8"));
  assertNoAstroReleaseAuthority(evidence, "mutation evidence seal");
  verifySeal(evidence, "mutation evidence");
  assert(evidence.schemaVersion === 1 && evidence.phase === PHASE, "mutation evidence identity is invalid");
  const authorization = validateReleaseAuthorization(evidence, "mutation evidence");
  if (authorization.mode === "versioned") {
    validateVersionReceiptBinding(authorization.versionReceipt, root);
  }
  const register = validateRegister(readRegister(root), root);
  assert(evidence.registerDigest === registerDigest(root), "mutation evidence register digest is stale");
  assert(JSON.stringify(evidence.expectedIds) === JSON.stringify(EXPECTED_IDS), "mutation evidence IDs drifted");
  verifyInputManifest(evidence.releaseInputs, root);
  assertPhase08Hashes(evidence.phase08, root);
  assert(Array.isArray(evidence.rows) && evidence.rows.length === EXPECTED_IDS.length, "mutation evidence row count drifted");
  assert(JSON.stringify(evidence.rows.map((row) => row.id)) === JSON.stringify(EXPECTED_IDS), "mutation evidence rows drifted");
  const revisions = new Set();
  for (const [index, registerRow] of register.rows.entries()) {
    const row = evidence.rows[index];
    validateGreenEvidenceRow(row, registerRow, root);
    assert(!revisions.has(row.revisionDigest), `${row.id}: revision digest is duplicated`);
    revisions.add(row.revisionDigest);
  }
  if (!quiet) {
    console.log(
      `PHASE09_MUTATION_EVIDENCE_OK rows=${EXPECTED_IDS.length} green=${EXPECTED_IDS.length}`,
    );
  }
  return evidence;
}

function validateReleaseCommands(commands) {
  const expectedNames = [
    "build",
    "typecheck",
    "test",
    "check:artifact",
    "check:deps",
    "check:pack",
    "check:node-floor",
    "test:phase09",
    "astro-check",
    "astro-build",
    "phase09-vitest-json",
    "phase-09-package-check all",
    "phase-09-adapter-budget check",
    "phase-09-adapter-budget self-test",
    "phase-09-workflow-check",
  ];
  assert(Array.isArray(commands), "release command evidence is malformed");
  assert(
    JSON.stringify(commands.map((command) => command.name)) === JSON.stringify(expectedNames),
    "release command set/count/order drifted",
  );
  for (const command of commands) {
    assert(command.exitCode === 0, `release command ${command.name} is not green`);
    assert(SHA256.test(command.outputDigest), `release command ${command.name} output digest is malformed`);
  }
}

function verifyReleaseEvidence(root = ROOT, { quiet = false, publishing = false } = {}) {
  const path = join(root, ".planning/phases/09-react-and-svelte-adapters/09-RELEASE-EVIDENCE.json");
  assert(existsSync(path), "09-RELEASE-EVIDENCE.json is missing");
  const release = JSON.parse(readFileSync(path, "utf8"));
  assertNoAstroReleaseAuthority(release, "release evidence seal");
  verifySeal(release, "release evidence");
  assert(release.schemaVersion === 1 && release.phase === PHASE, "release evidence identity is invalid");
  const authorization = validateReleaseAuthorization(release, "release evidence", {
    publishing,
  });
  if (authorization.mode === "versioned") {
    validateVersionReceiptBinding(authorization.versionReceipt, root);
  }
  assert(release.registerDigest === registerDigest(root), "release register digest is stale");
  verifyInputManifest(release.releaseInputs, root);
  assertPhase08Hashes(release.phase08.hashes, root);
  assert(Array.isArray(release.phase08.verification) && release.phase08.verification.length === 3, "Phase 8 verification command count drifted");
  for (const [index, record] of release.phase08.verification.entries()) {
    assert(record.command === commandText(PHASE08_COMMANDS[index]), "Phase 8 verification command drifted");
    assert(record.exitCode === 0 && record.fingerprint.includes("PASS"), "Phase 8 verification result is not positive");
  }
  validateReleaseCommands(release.commands);
  assert(
    release.tests.files > 0 && release.tests.tests > 0 && release.tests.assertions > 0,
    "release positive test counts are missing",
  );
  if (authorization.mode === "versioned") {
    const versions = [
      "packages/concierge/package.json",
      "packages/concierge-react/package.json",
      "packages/concierge-svelte/package.json",
    ].map((path) => JSON.parse(readFileSync(join(root, path), "utf8")).version);
    assert(
      versions.every((version) => version === authorization.sharedVersion),
      `release package versions differ from sealed sharedVersion: ${versions.join(", ")}`,
    );
    for (const name of PUBLIC_PACKAGES) {
      const expectedFile = `${name.replace(/^@/u, "").replace("/", "-")}-${authorization.sharedVersion}.tgz`;
      assert(
        release.archives[name]?.file === expectedFile &&
          SHA256.test(release.archives[name]?.sha256),
        `${name} release archive differs from sealed sharedVersion`,
      );
    }
  }
  validateConsumerToolingEvidence(release.consumerTooling, root);
  assert(
    release.archives !== null && typeof release.archives === "object" &&
      Object.keys(release.archives).length === 3,
    "release exact archive triplet is missing",
  );
  assert(
    release.archiveManifestDigest === sha256(stableJson({ archives: release.archives, tarEntryCounts: release.tarEntryCounts })),
    "release exact archive digest is stale",
  );
  const mutationPath = join(root, ".planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json");
  const validationPath = join(root, ".planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md");
  const securityPath = join(root, ".planning/phases/09-react-and-svelte-adapters/09-SECURITY.md");
  assert(release.mutationEvidenceDigest === sha256File(mutationPath), "release mutation evidence digest is stale");
  assert(release.validationDigest === sha256File(validationPath), "release validation digest is stale");
  assert(release.securityDigest === sha256File(securityPath), "release security digest is stale");
  if (!quiet) console.log("PHASE09_RELEASE_EVIDENCE_OK commands=15 archives=3 phase08=5");
  return release;
}

function readPublishArchiveManifest(path) {
  const result = spawnSync("tar", ["-xOzf", path, "package/package.json"], {
    encoding: "utf8",
    env: childEnvironment(),
    maxBuffer: MAX_OUTPUT_BYTES,
    timeout: DEFAULT_TIMEOUT_MS,
  });
  assert(
    result.error === undefined && result.signal === null && result.status === 0,
    `could not read publish archive ${basename(path)}: ${boundedExcerpt(`${result.stdout ?? ""}${result.stderr ?? ""}`)}`,
  );
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `${basename(path)} package manifest is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function verifyPublishEvidence(archiveDirectory, root = ROOT, { quiet = false } = {}) {
  assert(isAbsolute(archiveDirectory), "publish archive directory must be absolute");
  assert(
    archiveDirectory === normalize(resolve(archiveDirectory)),
    "publish archive directory must be normalized",
  );
  const directory = realpathSync(archiveDirectory);
  assert(
    directory === archiveDirectory && lstatSync(directory).isDirectory() &&
      !isWithin(directory, root),
    "publish archive directory must be a real directory outside the repository",
  );
  const release = verifyReleaseEvidence(root, { quiet: true, publishing: true });
  const digestManifestName = "phase-09-archive-digests.json";
  const digestManifestPath = join(directory, digestManifestName);
  assert(
    existsSync(digestManifestPath) && lstatSync(digestManifestPath).isFile() &&
      realpathSync(digestManifestPath) === digestManifestPath,
    "publish archive digest manifest is missing",
  );
  let digestManifest;
  try {
    digestManifest = JSON.parse(readFileSync(digestManifestPath, "utf8"));
  } catch (error) {
    throw new Error(
      `publish archive digest manifest is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  exactKeys(
    digestManifest,
    ["schemaVersion", "algorithm", "archives"],
    "publish archive digest manifest",
  );
  assert(
    digestManifest.schemaVersion === 1 && digestManifest.algorithm === "sha256",
    "publish archive digest manifest identity is invalid",
  );
  exactKeys(digestManifest.archives, PUBLIC_PACKAGES, "publish archive set");
  assert(
    stableJson(digestManifest.archives) === stableJson(release.archives),
    "publish archive manifest differs from tracked versioned release evidence",
  );
  const expectedEntries = [digestManifestName];
  for (const name of PUBLIC_PACKAGES) {
    const record = release.archives[name];
    exactKeys(record, ["file", "sha256"], `${name} publish archive record`);
    assert(
      basename(record.file) === record.file && record.file.endsWith(".tgz") &&
        SHA256.test(record.sha256),
      `${name} publish archive record is malformed`,
    );
    const path = join(directory, record.file);
    assert(
      existsSync(path) && lstatSync(path).isFile() && realpathSync(path) === path &&
        sha256File(path) === record.sha256,
      `${name} publish archive bytes differ from tracked versioned release evidence`,
    );
    const manifest = readPublishArchiveManifest(path);
    assert(
      manifest.name === name && manifest.version === release.sharedVersion &&
        manifest.private !== true,
      `${name} publish archive identity/version differs from tracked release authorization`,
    );
    expectedEntries.push(record.file);
  }
  assert(
    stableJson(readdirSync(directory).sort()) === stableJson(expectedEntries.sort()),
    "publish archive directory is not the exact tracked triplet plus digest manifest",
  );
  if (!quiet) {
    console.log(
      `PHASE09_PUBLISH_EVIDENCE_OK mode=versioned version=${release.sharedVersion} archives=3`,
    );
  }
  return release;
}

function countToken(text, token) {
  return text.split(token).length - 1;
}

function validateValidationMetadata(validation) {
  const exactFrontmatter =
    "---\n" +
    "phase: 09-react-and-svelte-adapters\n" +
    "status: complete\n" +
    "nyquist_compliant: true\n" +
    "wave_0_complete: true\n" +
    "---\n";
  assert(
    validation.startsWith(exactFrontmatter),
    "validation metadata must be complete, Nyquist compliant, and Wave 0 complete",
  );
  assert(
    !/MISSING|PENDING|TBD|NOT RUN/u.test(validation),
    "validation metadata contains an incomplete marker",
  );
  for (const taskId of REQUIRED_TASK_IDS) {
    assert(
      countToken(validation, taskId) === 1,
      `${taskId}: validation task trace count must equal one`,
    );
  }
  for (let index = 1; index <= 17; index += 1) {
    const decision = `D-09-${String(index).padStart(2, "0")}`;
    assert(validation.includes(decision), `${decision}: decision evidence is missing`);
  }
  for (const threat of REQUIRED_THREATS) {
    assert(validation.includes(threat), `${threat}: validation threat accounting is missing`);
  }
  for (const token of [
    "## Requirement Closure",
    "ADP-01",
    "ADP-02",
    "ADP-03",
    "ADP-04",
    "PKG-04",
    "## Source and Research Accounting",
    "09-CONTEXT.md",
    "09-RESEARCH.md",
    "## Measured Evidence",
    "## Wave 0 Closure",
    "## Sign-off",
  ]) {
    assert(validation.includes(token), `canonical validation is missing ${token}`);
  }
  return true;
}

function verifyLedgers(root = ROOT) {
  const validationText = readFileSync(join(root, ".planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md"), "utf8");
  const securityText = readFileSync(join(root, ".planning/phases/09-react-and-svelte-adapters/09-SECURITY.md"), "utf8");
  const validation = verifyMarkdownSeal(validationText, "validation ledger");
  const security = verifyMarkdownSeal(securityText, "security ledger");
  validateValidationMetadata(validation);
  const joined = `${validation}\n${security}`;
  assert(!/MISSING|PENDING|TBD|NOT RUN/u.test(joined), "terminal ledgers contain an incomplete marker");
  for (const taskId of REQUIRED_TASK_IDS) {
    assert(countToken(validation, taskId) === 1, `${taskId}: validation task trace count must equal one`);
  }
  for (let index = 1; index <= 8; index += 1) {
    const testId = `T${String(index).padStart(2, "0")}`;
    assert(validation.includes(testId), `${testId}: canonical validation meaning is missing`);
  }
  for (const threat of [...REQUIRED_THREATS, ...SUPPLEMENTAL_PHASE10_THREATS]) {
    assert(security.includes(threat), `${threat}: security disposition is missing`);
  }
  for (const id of EXPECTED_IDS.slice(7)) {
    assert(joined.includes(id), `${id}: supplemental current-byte evidence is missing`);
  }
  for (const token of [
    "@fullselfbrowsing/concierge",
    "08-consent-kernel",
    "M-09-B1",
    "M-09-SSR1",
    "ADP-03",
    "ADP-04",
    "D-09-15",
    "D-09-16",
  ]) {
    assert(joined.includes(token), `terminal ledgers are missing ${token}`);
  }
  assert(
    !GENERATED_PATHS.some((path) => path.endsWith("09-VERIFICATION.md")),
    "independent Phase 09 verification cannot be generator-owned",
  );
  return true;
}

function verifyAll(root = ROOT, { quiet = false } = {}) {
  verifyMutationEvidence(root, { quiet: true });
  verifyReleaseEvidence(root, { quiet: true });
  verifyLedgers(root);
  if (!quiet) console.log("PHASE09_MUTATION_VERIFY_ALL_OK evidence=green release=green ledgers=green");
  return true;
}

function ensureFinalInputs(root, paths) {
  const pathSet = new Set(paths);
  for (const path of REQUIRED_FINAL_INPUT_PATHS) {
    assert(existsSync(join(root, path)), `run all final release input is missing: ${path}`);
    assert(pathSet.has(path), `run all final release input is not tracked: ${path}`);
  }
}

async function mapLimit(items, limit, operation) {
  const results = new Array(items.length);
  let next = 0;
  async function consume() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await operation(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return results;
}

function gitShowBuffer(commit, path, root = ROOT) {
  const result = spawnSync("git", ["show", `${commit}:${path}`], {
    cwd: root,
    encoding: null,
    env: childEnvironment(),
    maxBuffer: MAX_OUTPUT_BYTES,
  });
  if (result.error !== undefined || result.signal !== null || result.status !== 0) return null;
  return result.stdout;
}

function findPhase08EvidenceRevision(liveHashes) {
  const evidencePath = PHASE08_PATHS[1];
  const evidence = JSON.parse(readFileSync(join(ROOT, evidencePath), "utf8"));
  const commits = runGitSync(["rev-list", "--all", "--", evidencePath], ROOT)
    .split(/\r?\n/u)
    .filter(Boolean);
  for (const commit of commits) {
    const evidenceBytes = gitShowBuffer(commit, evidencePath);
    if (evidenceBytes === null || sha256(evidenceBytes) !== liveHashes[evidencePath]) continue;
    const inputsMatch = Object.entries(evidence.inputHashes).every(([path, digest]) => {
      const bytes = gitShowBuffer(commit, path);
      return bytes !== null && sha256(bytes) === digest;
    });
    if (inputsMatch) return commit;
  }
  throw new Error("cannot find the immutable Phase 8 evidence-producing revision");
}

async function verifyInheritedPhase08(outerRoot, liveHashes) {
  const revision = findPhase08EvidenceRevision(liveHashes);
  const snapshotRoot = join(outerRoot, "phase08-snapshot");
  mkdirSync(snapshotRoot);
  const archivePath = join(outerRoot, "phase08-snapshot.tar");
  const archive = await runCommand("git", ["archive", "--format=tar", `--output=${archivePath}`, revision], {
    cwd: ROOT,
  });
  assertSuccessfulCommand(archive, "Phase 8 snapshot archive");
  const extract = await runCommand("tar", ["-xf", archivePath, "-C", snapshotRoot], { cwd: outerRoot });
  assertSuccessfulCommand(extract, "Phase 8 snapshot extract");
  rmSync(archivePath, { force: true });
  for (const path of PHASE08_PATHS) copyTrackedFile(ROOT, snapshotRoot, path);
  copyTrackedFile(ROOT, snapshotRoot, ".planning/REQUIREMENTS.md");
  const tracked = [];
  const walk = (directory, prefix = "") => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(join(directory, entry.name), path);
      else tracked.push(path);
    }
  };
  walk(snapshotRoot);
  initializeDisposableRepository(snapshotRoot, tracked.sort());
  await prewarmOwnedPnpmStoreAndInstall(snapshotRoot, "Phase 8 snapshot");

  const verification = [];
  for (const spec of PHASE08_COMMANDS) {
    const result = await runCommand(spec[0], spec.slice(1), {
      cwd: snapshotRoot,
      timeoutMs: PACKAGE_TIMEOUT_MS,
      env: { PHASE_08_SNAPSHOT_GATE: "1" },
    });
    assertSuccessfulCommand(result, `inherited ${commandText(spec)}`);
    assert(result.output.includes("PASS"), `${commandText(spec)} omitted its positive fingerprint`);
    verification.push(
      Object.freeze({
        command: commandText(spec),
        exitCode: result.exitCode,
        fingerprint: boundedExcerpt(result.output, 600),
        outputDigest: sha256(result.output),
      }),
    );
  }
  assertPhase08Hashes(liveHashes, ROOT);
  return Object.freeze({ revision, verification: Object.freeze(verification) });
}

function parsePositiveVitestReport(reportPath, root) {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  assert(report.success === true, "Phase 09 Vitest JSON did not report success");
  const results = Array.isArray(report.testResults) ? report.testResults : [];
  const assertions = results.flatMap((result) =>
    Array.isArray(result.assertionResults) ? result.assertionResults : [],
  );
  assert(
    results.length === EXPECTED_PHASE09_TEST_FILES.length &&
      Number.isInteger(report.numTotalTests) &&
      report.numTotalTests > 0 &&
      assertions.length === report.numTotalTests,
    "Phase 09 Vitest JSON has missing files/tests/assertions",
  );
  assert(
    report.numPassedTestSuites === report.numTotalTestSuites &&
      report.numFailedTestSuites === 0 &&
      report.numPendingTestSuites === 0 &&
      report.numPassedTests === report.numTotalTests &&
      report.numFailedTests === 0 &&
      report.numPendingTests === 0 &&
      report.numTodoTests === 0,
    "Phase 09 Vitest JSON aggregate counts are not all passing",
  );
  assert(
    results.every(
      (result) =>
        result.status === "passed" &&
        Array.isArray(result.assertionResults) &&
        result.assertionResults.length > 0 &&
        result.assertionResults.every(
          (assertion) => assertion.status === "passed",
        ),
    ),
    "Phase 09 Vitest JSON contains a skipped or failing file/assertion",
  );
  const actualFiles = results
    .map((result) => {
      const candidate = isAbsolute(result.name)
        ? result.name
        : resolve(root, result.name);
      return relative(root, realpathSync(candidate)).split(sep).join("/");
    })
    .sort();
  assert(
    JSON.stringify(actualFiles) === JSON.stringify(EXPECTED_PHASE09_TEST_FILES),
    "Phase 09 Vitest JSON file set drifted",
  );
  return Object.freeze({
    files: results.length,
    tests: report.numTotalTests,
    assertions: assertions.length,
  });
}

function expectedConsumerTooling(root) {
  const manifest = JSON.parse(
    readFileSync(join(root, CONSUMER_TOOLING_MANIFEST_PATH), "utf8"),
  );
  const npmVersion = /^npm@(?<version>\d+\.\d+\.\d+)$/u.exec(
    manifest.packageManager,
  )?.groups?.version;
  assert(npmVersion !== undefined, "consumer tooling npm version is not pinned");
  return Object.freeze({
    lockFile: CONSUMER_TOOLING_LOCK_PATH,
    lockSha256: sha256File(join(root, CONSUMER_TOOLING_LOCK_PATH)),
    npmVersion,
    offlineCi: true,
  });
}

function validateConsumerToolingEvidence(value, root) {
  const expected = expectedConsumerTooling(root);
  assert(
    JSON.stringify(value) === JSON.stringify(expected),
    "consumer tooling lock/npm/offline evidence is missing or stale",
  );
  return value;
}

function parsePackageResult(output, root) {
  const line = output
    .split(/\r?\n/u)
    .find((candidate) => candidate.startsWith("PHASE09_PACKAGE_RESULT "));
  assert(line !== undefined, "phase-09-package-check all omitted structured result");
  const value = JSON.parse(line.slice("PHASE09_PACKAGE_RESULT ".length));
  assert(value.mode === "all" && value.status === "passed", "package all result is not green");
  assert(value.archives !== null && Object.keys(value.archives).length === 3, "package all did not produce exactly three archives");
  validateConsumerToolingEvidence(value.consumerTooling, root);
  return value;
}

async function runReleaseGates(baseline, outerRoot) {
  const commands = [];
  const run = async (name, executable, arguments_, options = {}) => {
    const result = await runCommand(executable, arguments_, {
      cwd: baseline.root,
      timeoutMs: options.timeoutMs ?? PACKAGE_TIMEOUT_MS,
      env: options.env ?? {},
    });
    assertSuccessfulCommand(result, `release ${name}`);
    commands.push(
      Object.freeze({
        name,
        command: commandText([executable, ...arguments_]),
        exitCode: result.exitCode,
        outputDigest: sha256(result.output),
        fingerprint: boundedExcerpt(result.output, 500),
      }),
    );
    verifyInputManifest(baseline.inputManifest, baseline.root);
    return result;
  };

  await run("build", "pnpm", ["build"]);
  await run("typecheck", "pnpm", ["typecheck"]);
  await run("test", "pnpm", ["test"]);
  await run("check:artifact", "pnpm", ["check:artifact"]);
  await run("check:deps", "pnpm", ["check:deps"]);
  await run("check:pack", "pnpm", ["check:pack"]);
  await run("check:node-floor", "pnpm", ["check:node-floor"]);
  await run("test:phase09", "pnpm", ["test:phase09"]);
  await run("astro-check", "pnpm", ["--filter", "@fullselfbrowsing/concierge-adapter-ssr", "check"]);
  await run("astro-build", "pnpm", ["--filter", "@fullselfbrowsing/concierge-adapter-ssr", "build"]);

  const reportPath = join(outerRoot, "phase09-tests.json");
  await run(
    "phase09-vitest-json",
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "--project",
      "react-lifecycle",
      "--project",
      "svelte-lifecycle",
      "--project",
      "node-artifact-ssr",
      "--reporter=json",
      `--outputFile=${reportPath}`,
    ],
  );
  const tests = parsePositiveVitestReport(reportPath, baseline.root);

  const archiveDirectory = join(outerRoot, "release-archives");
  mkdirSync(archiveDirectory);
  const packageResult = await run(
    "phase-09-package-check all",
    "node",
    ["scripts/phase-09-package-check.mjs", "all"],
    { env: { PHASE09_ARCHIVE_EXPORT_DIR: archiveDirectory } },
  );
  const packageEvidence = parsePackageResult(packageResult.output, baseline.root);
  await run("phase-09-adapter-budget check", "node", ["scripts/phase-09-adapter-budget.mjs", "check"]);
  await run("phase-09-adapter-budget self-test", "node", ["scripts/phase-09-adapter-budget.mjs", "self-test"]);
  await run("phase-09-workflow-check", "node", ["scripts/phase-09-workflow-check.mjs"]);
  assert(commands.length === 15, `release command count drifted: ${commands.length}`);
  return Object.freeze({
    commands: Object.freeze(commands),
    tests,
    packageEvidence,
    archiveDirectory,
  });
}

function makeValidationMarkdown({
  releaseInputDigest,
  registerHash,
  mutationRows,
  archiveDigest,
  releaseCommandCount,
  releaseTests,
  inheritedHashes,
}) {
  const taskRows = REQUIRED_TASK_IDS.map(
    (id) => `| ${id} | passed | ${releaseInputDigest} |`,
  ).join("\n");
  const mutationByTest = Object.fromEntries(mutationRows.map((row) => [row.testId, row.id]));
  const testRows = [
    ["T01", "React StrictMode setup-cleanup-setup, stale-cleanup resistance, and final null", mutationByTest.T01],
    ["T02", "React late reads observe the latest committed plain nested value", mutationByTest.T02],
    ["T03", "Svelte real-rune snapshot closes consent after nested live drift", mutationByTest.T03],
    ["T04", "Normal fresh-process Astro SSR remains registration-silent", mutationByTest.T04],
    ["T05", "One physical core and exact public contract mismatch guards", "M-09-P1, M-09-C1"],
    ["T06", "Exact tarball transforms preserve client directive, rune output, and TypeScript domains", archiveDigest],
    ["T07", "Independent production inventory and adapter budget enforcement", mutationByTest.T07],
    ["T08", "Immutable compile-first mutation evidence and drift rejection", registerHash],
  ].map(([id, meaning, evidence]) => `| ${id} | ${meaning} | ${evidence} |`).join("\n");
  const decisions = Array.from({ length: 17 }, (_, index) => {
    const id = `D-09-${String(index + 1).padStart(2, "0")}`;
    const evidence = id === "D-09-15"
      ? "fresh-process built Astro SSR (T04 / M-09-SSR1)"
      : id === "D-09-16"
        ? "exact three-tarball isolated consumer (T05/T06 / M-09-P1/M-09-C1)"
        : `release revision ${releaseInputDigest}`;
    return `| ${id} | ${evidence} |`;
  }).join("\n");
  const threatRows = REQUIRED_THREATS.map(
    (threat) => `| ${threat} | disposed in 09-SECURITY.md | ${releaseInputDigest} |`,
  ).join("\n");
  const supplementalRows = mutationRows
    .filter((row) => row.id.startsWith("M-10-"))
    .map(
      (row) =>
        `| ${row.id} | ${row.testId} | ${row.requirement} | ${row.threat} | ${row.decisions.join(", ")} |`,
    )
    .join("\n");
  const inheritedRows = Object.entries(inheritedHashes)
    .map(([path, digest]) => `| ${path} | ${digest} |`)
    .join("\n");
  return markdownSeal(`---
phase: 09-react-and-svelte-adapters
status: complete
nyquist_compliant: true
wave_0_complete: true
---

# Phase 09 Validation

Revision-bound validation for @fullselfbrowsing/concierge, its React and Svelte adapters, and the inherited 08-consent-kernel records.

## Task Traceability

| Task | Result | Evidence |
|---|---|---|
${taskRows}

## Canonical Test Meanings

| Test | Locked meaning | Evidence |
|---|---|---|
${testRows}

## Requirement Closure

| Requirement | Evidence |
|---|---|
| ADP-01 | T01/M-09-R1 and T02/M-09-R2 |
| ADP-02 | T03/M-09-S1 |
| ADP-03 | T07/M-09-B1 only |
| ADP-04 | T04/M-09-SSR1 normal Astro SSR |
| PKG-04 | T05/T06 exact archive and contract proof |

The M-10 controls below are supplemental current-byte protection. They retain their Phase 10 audit owners and do not reassign Phase 9 requirements.

## Decision Evidence

| Decision | Evidence |
|---|---|
${decisions}

## Threat Accounting

| Threat | Disposition | Evidence |
|---|---|---|
${threatRows}

## Source and Research Accounting

| Source | Accounting |
|---|---|
| .planning/phases/09-react-and-svelte-adapters/09-CONTEXT.md | all D-09 decisions mapped above |
| .planning/phases/09-react-and-svelte-adapters/09-RESEARCH.md | adapter, packaging, SSR, and release recommendations measured |
| .planning/phases/08-consent-kernel/08-VALIDATION.md | inherited immutable evidence verified in an owned snapshot |

| Inherited Phase 8 record | SHA-256 |
|---|---|
${inheritedRows}

## Supplemental Phase 10 Current-Byte Controls

| Mutant | Detector | Owner | Threat | Decisions |
|---|---|---|---|---|
${supplementalRows}

## Measured Evidence

- Mutation evidence: ${mutationRows.length} ordered green rows with positive exact detector counts.
- Release evidence: ${releaseCommandCount} ordered commands; ${releaseTests.files} files, ${releaseTests.tests} tests, and ${releaseTests.assertions} assertions in the Phase 09 JSON test gate.
- Exact archive manifest digest: ${archiveDigest}
- Mutation register digest: ${registerHash}
- Release input digest: ${releaseInputDigest}

## Wave 0 Closure

All Phase 09 test, mutation, package, adapter-budget, security, and inherited Phase 8 prerequisites are implemented and green. Wave 0 is complete.

## Immutable Bindings

- Release input digest: ${releaseInputDigest}
- Mutation register digest: ${registerHash}
- Exact archive manifest digest: ${archiveDigest}
- Phase 8 evidence source: .planning/phases/08-consent-kernel/08-MUTATION-EVIDENCE.json (nested release member)

## Sign-off

Phase 09 validation is complete, Nyquist compliant, revision-bound, and ready for independent verification.
`);
}

function makeSecurityMarkdown({
  consumerTooling,
  releaseInputDigest,
  mutationRows,
}) {
  const byThreat = new Map();
  for (const row of mutationRows) {
    const rows = byThreat.get(row.threat) ?? [];
    rows.push(row.id);
    byThreat.set(row.threat, rows);
  }
  const descriptions = Object.freeze({
    "T-09-01": "React cleanup tampering",
    "T-09-02": "React stale-value tampering",
    "T-09-03": "Svelte snapshot identity tampering",
    "T-09-04": "SSR registration disclosure",
    "T-09-05": "duplicate-core or contract-skew elevation",
    "T-09-06": "package transform tampering",
    "T-09-07": "budget inventory tampering",
    "T-09-08": "mutation verdict repudiation",
    "T-09-SC": "dependency supply-chain tampering",
    "T-10-01": "terminal response disclosure",
    "T-10-02": "terminal entry or serial-work tampering",
    "T-10-03": "terminal outcome/stop denial of service",
    "T-10-04": "pnpm child authority escalation",
    "T-10-05": "catalog declaration containment tampering",
    "T-10-06": "Astro generated-state release authority",
    "T-10-07": "workflow/evidence order repudiation",
    "T-10-08": "OIDC release authority escalation",
  });
  const rows = REQUIRED_THREATS.map((threat) => {
    const evidence = (byThreat.get(threat) ?? []).join(", ") ||
      (threat === "T-09-06"
        ? "T06 exact archive triplet"
        : threat === "T-09-08"
          ? "T08 compile-first immutable runner"
          : `credential-free preflight plus allowlisted nested child environments with owned empty npm/git configs and an owned pnpm store; pnpm fetch --frozen-lockfile --ignore-scripts before frozen offline installs; only authenticated disposable mutants retain PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false across package-check nesting; committed ${consumerTooling.lockFile} sha256=${consumerTooling.lockSha256}; npm ${consumerTooling.npmVersion}; lock-derived cache plus npm ci --ignore-scripts --offline`);
    return `| ${threat} | ${descriptions[threat]} | mitigated | ${evidence} |`;
  }).join("\n");
  const supplementalRows = SUPPLEMENTAL_PHASE10_THREATS.map((threat) => {
    const evidence = (byThreat.get(threat) ?? []).join(", ") ||
      (threat === "T-10-08"
        ? "read-only candidate receipt job plus existing OIDC publication negatives"
        : "Phase 10 current-byte static control");
    return `| ${threat} | ${descriptions[threat]} | mitigated | ${evidence} |`;
  }).join("\n");
  return markdownSeal(`# Phase 09 Security

Security closure for @fullselfbrowsing/concierge adapter delivery at revision ${releaseInputDigest}.

| Threat | Surface | Disposition | Evidence |
|---|---|---|---|
${rows}

## Supplemental Phase 10 Current-Byte Protection

These controls protect the repaired current bytes without reassigning Phase 9 requirement ownership.

| Threat | Surface | Disposition | Evidence |
|---|---|---|---|
${supplementalRows}

The live Phase 8 records remain byte-identical and their release proof remains the nested release member of 08-consent-kernel/08-MUTATION-EVIDENCE.json.
`);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function installOutputsTransactionally(sourceRoot) {
  const transactionId = randomUUID();
  const operations = GENERATED_PATHS.map((relativePath) => {
    const source = join(sourceRoot, relativePath);
    const destination = join(ROOT, relativePath);
    const temporary = `${destination}.tmp-${transactionId}`;
    const backup = `${destination}.bak-${transactionId}`;
    copyFileSync(source, temporary);
    return { destination, temporary, backup, hadOriginal: existsSync(destination) };
  });
  const installed = [];
  try {
    for (const operation of operations) {
      if (operation.hadOriginal) renameSync(operation.destination, operation.backup);
      renameSync(operation.temporary, operation.destination);
      installed.push(operation);
    }
    for (const operation of operations) rmSync(operation.backup, { force: true });
  } catch (error) {
    for (const operation of installed.reverse()) {
      rmSync(operation.destination, { force: true });
      if (operation.hadOriginal && existsSync(operation.backup)) {
        renameSync(operation.backup, operation.destination);
      }
    }
    for (const operation of operations) {
      rmSync(operation.temporary, { force: true });
      if (operation.hadOriginal && existsSync(operation.backup) && !existsSync(operation.destination)) {
        renameSync(operation.backup, operation.destination);
      }
    }
    throw error;
  }
}

function completeGeneratedOutputTransaction(
  sourceRoot,
  {
    installOutputs,
    expectedEndpoints,
    install = installOutputsTransactionally,
  },
) {
  assert(typeof installOutputs === "boolean", "output installation mode is invalid");
  if (!installOutputs) {
    assertOutputEndpoints(expectedEndpoints);
    return false;
  }
  install(sourceRoot);
  return true;
}

async function runAll(
  jobs,
  { outerRoot, versioned = false, installOutputs = true } = {},
) {
  assertOwnedTempRoot(outerRoot);
  const register = validateRegister(readRegister());
  const liveState = mutationLiveState({ allowVersionedWorktree: versioned });
  ensureFinalInputs(ROOT, liveState.paths);
  const inheritedHashes = phase08Hashes(ROOT);
  const inherited = await verifyInheritedPhase08(outerRoot, inheritedHashes);
  const baseline = await materializeBaseline(outerRoot, liveState.inputManifest, {
    preserveHistory: versioned,
  });
  const rows = await mapLimit(register.rows, jobs, async (row, index) => {
    const result = await executeMutant(row, baseline, liveState, outerRoot);
    console.log(`[green ${index + 1}/${register.rows.length}] ${row.id}`);
    return result;
  });
  const releaseGates = await runReleaseGates(baseline, outerRoot);
  assertPhase08Hashes(inheritedHashes, ROOT);
  verifyLiveMutationState(liveState);

  const mutationEvidence = sealedObject({
    schemaVersion: 1,
    phase: PHASE,
    ...liveState.authorization,
    generatedAt: new Date().toISOString(),
    registerDigest: registerDigest(baseline.root),
    expectedIds: EXPECTED_IDS,
    releaseInputs: baseline.inputManifest,
    phase08: inheritedHashes,
    rows,
  });
  const mutationPath = join(baseline.root, GENERATED_PATHS[0]);
  writeJson(mutationPath, mutationEvidence);

  const archiveManifestDigest = sha256(
    stableJson({
      archives: releaseGates.packageEvidence.archives,
      tarEntryCounts: releaseGates.packageEvidence.tarEntryCounts,
    }),
  );
  const validation = makeValidationMarkdown({
    releaseInputDigest: baseline.inputManifest.digest,
    registerHash: registerDigest(baseline.root),
    mutationRows: rows,
    archiveDigest: archiveManifestDigest,
    releaseCommandCount: releaseGates.commands.length,
    releaseTests: releaseGates.tests,
    inheritedHashes,
  });
  const security = makeSecurityMarkdown({
    consumerTooling: releaseGates.packageEvidence.consumerTooling,
    releaseInputDigest: baseline.inputManifest.digest,
    mutationRows: rows,
  });
  const validationPath = join(baseline.root, GENERATED_PATHS[2]);
  const securityPath = join(baseline.root, GENERATED_PATHS[3]);
  writeFileSync(validationPath, validation, "utf8");
  writeFileSync(securityPath, security, "utf8");

  const releaseEvidence = sealedObject({
    schemaVersion: 1,
    phase: PHASE,
    ...liveState.authorization,
    generatedAt: new Date().toISOString(),
    registerDigest: registerDigest(baseline.root),
    releaseInputs: baseline.inputManifest,
    mutationEvidenceDigest: sha256File(mutationPath),
    validationDigest: sha256File(validationPath),
    securityDigest: sha256File(securityPath),
    phase08: Object.freeze({
      sourceRevision: inherited.revision,
      hashes: inheritedHashes,
      verification: inherited.verification,
    }),
    commands: releaseGates.commands,
    tests: releaseGates.tests,
    consumerTooling: releaseGates.packageEvidence.consumerTooling,
    archives: releaseGates.packageEvidence.archives,
    tarEntryCounts: releaseGates.packageEvidence.tarEntryCounts,
    archiveManifestDigest,
    packageGate: "node scripts/phase-09-package-check.mjs all",
    budgetGate: "node scripts/phase-09-adapter-budget.mjs check",
  });
  writeJson(join(baseline.root, GENERATED_PATHS[1]), releaseEvidence);

  verifyAll(baseline.root, { quiet: true });
  const contract = await runCommand("node", ["scripts/phase-09-contract-check.mjs", "final"], {
    cwd: baseline.root,
  });
  assertSuccessfulCommand(contract, "prospective Phase 09 final contract");
  const prospectiveVerify = await runCommand(
    "node",
    ["scripts/phase-09-mutation-battery.mjs", "verify", "all"],
    { cwd: baseline.root },
  );
  assertSuccessfulCommand(prospectiveVerify, "prospective Phase 09 verify all");

  assertPhase08Hashes(inheritedHashes, ROOT);
  verifyLiveMutationState(liveState);
  const prospectiveDigests = Object.freeze(
    Object.fromEntries(
      GENERATED_PATHS.map((path) => [path, sha256File(join(baseline.root, path))]),
    ),
  );
  const installed = completeGeneratedOutputTransaction(baseline.root, {
    installOutputs,
    expectedEndpoints: liveState.outputEndpoints,
  });
  if (installed) {
    verifyAll(ROOT, { quiet: true });
    console.log(
      `PHASE09_MUTATION_RUN_ALL_OK mutants=${EXPECTED_IDS.length} jobs=${jobs} commands=${releaseGates.commands.length} archives=3 phase08=${PHASE08_PATHS.length}`,
    );
    return;
  }
  assertOutputEndpoints(liveState.outputEndpoints);
  const requirementsInput = baseline.inputManifest.entries.find(
    (entry) => entry.path === ".planning/REQUIREMENTS.md",
  );
  assert(
    requirementsInput !== undefined,
    ".planning/REQUIREMENTS.md is not a tracked release input",
  );
  console.log(
    `PHASE09_MUTATION_PREFLIGHT_VERSIONED_OK mutants=${EXPECTED_IDS.length} jobs=${jobs} commands=${releaseGates.commands.length} archives=3 phase08=${PHASE08_PATHS.length} installed=false requirements=.planning/REQUIREMENTS.md requirementsSha256=${requirementsInput.sha256} outputDigests=${stableJson(prospectiveDigests)}`,
  );
}

async function main(arguments_) {
  const invocation = parseInvocation(arguments_);
  if (invocation.kind === "self-test") {
    await withOwnedChildEnvironment(() => runSelfTest());
    return;
  }
  if (invocation.kind === "preflight") {
    await withOwnedChildEnvironment((outerRoot) =>
      withMutationLock(() => runPreflight(invocation.id, outerRoot)),
    );
    return;
  }
  if (invocation.kind === "run-all") {
    const execute = () =>
      withOwnedChildEnvironment((outerRoot) =>
        withMutationLock(() =>
          runAll(invocation.jobs, {
            outerRoot,
            versioned: invocation.versioned,
            installOutputs: invocation.installOutputs,
          }),
        ),
      );
    if (invocation.versioned) {
      await runAfterCredentialFreeFinalizationPreflight(
        process.env,
        execute,
        { repositoryRoot: ROOT },
      );
    } else {
      await execute();
    }
    return;
  }
  if (invocation.kind === "verify-astro-regeneration") {
    await withOwnedChildEnvironment((outerRoot) =>
      verifyAstroRegeneration(outerRoot),
    );
    return;
  }
  if (invocation.kind === "verify-evidence") {
    await withOwnedChildEnvironment(() => verifyMutationEvidence());
    return;
  }
  if (invocation.kind === "verify-release") {
    await withOwnedChildEnvironment(() => verifyReleaseEvidence());
    return;
  }
  if (invocation.kind === "verify-all") {
    await withOwnedChildEnvironment(() => verifyAll());
    return;
  }
  if (invocation.kind === "verify-publish") {
    await withOwnedChildEnvironment(() =>
      verifyPublishEvidence(invocation.archiveDirectory),
    );
    return;
  }
  throw new UsageError();
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 64;
  } else {
    process.stderr.write(
      `FAIL: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
