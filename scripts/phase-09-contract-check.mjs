#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

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

const MUTATION_IDS = Object.freeze([
  "M-09-R1",
  "M-09-R2",
  "M-09-S1",
  "M-09-SSR1",
  "M-09-B1",
  "M-09-P1",
  "M-09-C1",
]);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PHASE_DIRECTORY = ".planning/phases/09-react-and-svelte-adapters";
const BASELINE_PATH = `${PHASE_DIRECTORY}/09-RED-BASELINE.json`;
const BASELINE_SCHEMA_VERSION = 1;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const FIRST_RELEASE_CORE_PEER = "workspace:^0.0.0 || ^0.1.0";

const REACT_SOURCE_PATHS = Object.freeze([
  "packages/concierge-react/src/index.ts",
  "packages/concierge-react/src/client.tsx",
]);

const SVELTE_SOURCE_PATHS = Object.freeze([
  "packages/concierge-svelte/src/index.ts",
  "packages/concierge-svelte/src/client.svelte.ts",
]);

const FINAL_REQUIRED_PATHS = Object.freeze([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "vitest.config.ts",
  "README.md",
  "RELEASING.md",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  "packages/concierge/package.json",
  "packages/concierge/src/index.ts",
  "packages/concierge/src/bridge.ts",
  "packages/concierge-react/package.json",
  "packages/concierge-react/tsconfig.json",
  "packages/concierge-react/tsdown.config.ts",
  "packages/concierge-react/LICENSE",
  "packages/concierge-react/README.md",
  ...REACT_SOURCE_PATHS,
  "packages/concierge-react/test/lifecycle.test.tsx",
  "packages/concierge-react/test/artifact.test.ts",
  "packages/concierge-react/test-d/public.test-d.ts",
  "packages/concierge-svelte/package.json",
  "packages/concierge-svelte/tsconfig.json",
  "packages/concierge-svelte/svelte.config.js",
  "packages/concierge-svelte/LICENSE",
  "packages/concierge-svelte/README.md",
  ...SVELTE_SOURCE_PATHS,
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
  "scripts/fixtures/phase-09-foreign-consumer/package.json",
  "scripts/fixtures/phase-09-foreign-consumer/package-lock.json",
  BASELINE_PATH,
  `${PHASE_DIRECTORY}/09-MUTATION-REGISTER.json`,
  `${PHASE_DIRECTORY}/09-MUTATION-EVIDENCE.json`,
  `${PHASE_DIRECTORY}/09-RELEASE-EVIDENCE.json`,
  `${PHASE_DIRECTORY}/09-VALIDATION.md`,
  `${PHASE_DIRECTORY}/09-SECURITY.md`,
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function arrayEquals(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function exactObjectKeys(value, expected) {
  return isRecord(value) && arrayEquals(Object.keys(value).sort(), [...expected].sort());
}

function countOccurrences(text, needle) {
  if (needle.length === 0) {
    throw new Error("occurrence needle must not be empty");
  }
  return text.split(needle).length - 1;
}

function stripJsComments(text) {
  let output = "";
  let state = "code";
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (state === "line-comment") {
      if (char === "\n") {
        output += char;
        state = "code";
      } else {
        output += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        output += "  ";
        index += 1;
        state = "code";
      } else {
        output += char === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (state === "single" || state === "double" || state === "template") {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (
        (state === "single" && char === "'") ||
        (state === "double" && char === '"') ||
        (state === "template" && char === "`")
      ) {
        state = "code";
      }
      continue;
    }

    if (char === "/" && next === "/") {
      output += "  ";
      index += 1;
      state = "line-comment";
    } else if (char === "/" && next === "*") {
      output += "  ";
      index += 1;
      state = "block-comment";
    } else {
      output += char;
      if (char === "'") state = "single";
      if (char === '"') state = "double";
      if (char === "`") state = "template";
    }
  }

  return output;
}

function parseInvocation(argv) {
  if (argv.length !== 1) {
    throw new Error(`usage: node scripts/phase-09-contract-check.mjs ${MODES.join("|")}`);
  }
  const mode = argv[0];
  if (!MODES.includes(mode)) {
    throw new Error(`unknown mode ${JSON.stringify(mode)}; expected one of ${MODES.join(", ")}`);
  }
  return mode;
}

function validateIds(ids, expectedCount, label = "contract IDs") {
  if (!Array.isArray(ids) || ids.length !== expectedCount) {
    throw new Error(`${label} cardinality must be ${expectedCount}, observed ${ids?.length ?? "non-array"}`);
  }
  if (ids.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new Error(`${label} must contain only nonempty strings`);
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} contains a duplicate ID`);
  }
}

function resolveInside(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0 || isAbsolute(relativePath)) {
    throw new Error(`invalid relative path ${JSON.stringify(relativePath)}`);
  }
  const absolutePath = resolve(root, relativePath);
  if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) {
    throw new Error(`path escapes fixture root: ${relativePath}`);
  }
  return absolutePath;
}

function describeInputState(relativePath, stat, bytes) {
  if (stat === null) {
    return {
      path: relativePath,
      kind: "missing",
      size: 0,
      sha256: sha256(`missing\0${relativePath}`),
      text: "",
    };
  }
  if (!stat.isFile()) {
    return {
      path: relativePath,
      kind: "non-file",
      size: stat.size,
      sha256: sha256(`non-file\0${relativePath}\0${stat.mode}`),
      text: "",
    };
  }
  return {
    path: relativePath,
    kind: bytes.length === 0 ? "empty" : "file",
    size: bytes.length,
    sha256: sha256(bytes),
    text: bytes.toString("utf8"),
  };
}

function createInspector(root) {
  const inputs = new Map();

  function inspect(relativePath) {
    const cached = inputs.get(relativePath);
    if (cached !== undefined) return cached;

    const absolutePath = resolveInside(root, relativePath);
    let stat = null;
    try {
      stat = lstatSync(absolutePath);
    } catch (error) {
      if (!isRecord(error) || error.code !== "ENOENT") throw error;
    }
    const bytes = stat?.isFile() ? readFileSync(absolutePath) : Buffer.alloc(0);
    const state = describeInputState(relativePath, stat, bytes);
    inputs.set(relativePath, state);
    return state;
  }

  function snapshot() {
    return [...inputs.values()]
      .sort((left, right) => left.path.localeCompare(right.path))
      .map(({ path, kind, size, sha256: digest }) => ({ path, kind, size, sha256: digest }));
  }

  return Object.freeze({ inspect, snapshot });
}

function requireRegularNonempty(root, relativePath) {
  const absolutePath = resolveInside(root, relativePath);
  let stat;
  try {
    stat = lstatSync(absolutePath);
  } catch {
    throw new Error(`${relativePath} must be a regular nonempty file`);
  }
  if (!stat.isFile() || stat.size <= 0) {
    throw new Error(`${relativePath} must be a regular nonempty file`);
  }
  return readFileSync(absolutePath, "utf8");
}

function requirePositiveMatches(label, text, expression) {
  expression.lastIndex = 0;
  const matches = [...text.matchAll(expression)];
  if (matches.length === 0) {
    throw new Error(`${label} produced zero matches`);
  }
  return matches;
}

function createProbe(id, inspector, run) {
  const checks = [];

  function check(condition, name, path, expected, actual) {
    checks.push({
      ok: Boolean(condition),
      name,
      path,
      expected,
      actual: String(actual),
    });
  }

  function text(relativePath) {
    const state = inspector.inspect(relativePath);
    check(
      state.kind === "file" && state.size > 0,
      "regular-nonempty-file",
      relativePath,
      "regular nonempty file",
      `${state.kind}:${state.size}`,
    );
    return state.kind === "file" && state.size > 0 ? state.text : "";
  }

  function json(relativePath) {
    const source = text(relativePath);
    if (source.length === 0) return null;
    try {
      const parsed = JSON.parse(source);
      check(isRecord(parsed), "json-object", relativePath, "JSON object", Array.isArray(parsed) ? "array" : typeof parsed);
      return isRecord(parsed) ? parsed : null;
    } catch {
      check(false, "valid-json", relativePath, "valid JSON", "parse failure");
      return null;
    }
  }

  try {
    run(Object.freeze({ check, text, json }));
  } catch (error) {
    check(false, "probe-execution", "<probe>", "no exception", error instanceof Error ? error.message : "unknown exception");
  }

  if (checks.length === 0) {
    throw new Error(`${id} is vacuous: the probe observed zero assertions`);
  }

  return Object.freeze({ id, passed: checks.every((entry) => entry.ok), checks });
}

function getProjectBlock(source, projectName) {
  const code = stripJsComments(source);
  const marker = new RegExp(`name\\s*:\\s*["']${projectName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}["']`, "u");
  const match = marker.exec(code);
  if (match === null) return "";
  const start = code.lastIndexOf("{", match.index);
  if (start < 0) return "";

  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < code.length; index += 1) {
    const char = code[index];
    if (quote.length > 0) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return code.slice(start, index + 1);
    }
  }
  return "";
}

function extractIncludeValues(projectBlock) {
  const include = /include\s*:\s*\[([\s\S]*?)\]/u.exec(projectBlock)?.[1] ?? "";
  return [...include.matchAll(/["']([^"']+)["']/gu)].map((match) => match[1]);
}

function checkProject(api, source, name, environment, includes) {
  const block = getProjectBlock(source, name);
  api.check(block.length > 0, `${name}-project`, "vitest.config.ts", "named project object", block.length > 0 ? "found" : "absent");
  api.check(
    new RegExp(`environment\\s*:\\s*["']${environment}["']`, "u").test(block),
    `${name}-environment`,
    "vitest.config.ts",
    environment,
    block.length > 0 ? "inspected" : "project absent",
  );
  const observedIncludes = extractIncludeValues(block);
  api.check(
    arrayEquals(observedIncludes, includes),
    `${name}-exact-includes`,
    "vitest.config.ts",
    JSON.stringify(includes),
    JSON.stringify(observedIncludes),
  );
}

function hasOrderedTokens(text, tokens) {
  let cursor = -1;
  for (const token of tokens) {
    const next = text.indexOf(token, cursor + 1);
    if (next < 0) return false;
    cursor = next;
  }
  return true;
}

function evaluateContracts(root) {
  const inspector = createInspector(root);
  const results = [];

  results.push(
    createProbe(INITIAL_IDS[0], inspector, (api) => {
      const vitest = api.text("vitest.config.ts");
      const packageJson = api.json("package.json");
      const code = stripJsComments(vitest);

      checkProject(api, vitest, "node", "node", ["packages/concierge/test/**/*.test.ts"]);
      checkProject(api, vitest, "node-artifact-ssr", "node", [
        "packages/concierge-react/test/artifact.test.ts",
        "packages/concierge-svelte/test/artifact.test.ts",
        "examples/adapter-ssr/test/ssr.test.ts",
      ]);
      checkProject(api, vitest, "react-lifecycle", "jsdom", [
        "packages/concierge-react/test/lifecycle.test.tsx",
      ]);
      checkProject(api, vitest, "svelte-lifecycle", "jsdom", [
        "packages/concierge-svelte/test/lifecycle.test.ts",
      ]);

      for (const [name, expected] of Object.entries({
        vite: "8.1.5",
        "@vitejs/plugin-react": "5.2.0",
        "@sveltejs/vite-plugin-svelte": "7.2.0",
        svelte: "5.56.8",
        jsdom: "29.1.1",
      })) {
        const actual = packageJson?.devDependencies?.[name];
        api.check(actual === expected, `root-pin-${name}`, "package.json", expected, actual ?? "absent");
      }

      api.check(code.includes('from "@vitejs/plugin-react"'), "react-plugin-import", "vitest.config.ts", "live plugin import", "inspected");
      api.check(code.includes('from "@sveltejs/vite-plugin-svelte"'), "svelte-plugin-import", "vitest.config.ts", "live plugin import", "inspected");
      api.check(/plugins\s*:\s*\[\s*react\(\)\s*\]/u.test(code), "react-plugin-call", "vitest.config.ts", "react() project plugin", "inspected");
      api.check(/svelte\(\s*\{\s*hot\s*:\s*false\s*\}\s*\)/u.test(code), "svelte-plugin-call", "vitest.config.ts", "svelte({ hot: false })", "inspected");
      api.check(!code.includes("packages/*/test/**/*.test.ts"), "no-broad-package-glob", "vitest.config.ts", "broad glob absent", code.includes("packages/*/test/**/*.test.ts") ? "present" : "absent");
      api.check(!code.includes("passWithNoTests"), "no-pass-with-no-tests", "vitest.config.ts", "passWithNoTests absent", code.includes("passWithNoTests") ? "present" : "absent");
      for (const name of ["node", "node-artifact-ssr", "react-lifecycle", "svelte-lifecycle"]) {
        api.check(countOccurrences(code, `name: "${name}"`) === 1, `${name}-unique`, "vitest.config.ts", "one live name", countOccurrences(code, `name: "${name}"`));
      }
    }),
  );

  results.push(
    createProbe(INITIAL_IDS[1], inspector, (api) => {
      const manifest = api.json("packages/concierge-react/package.json");
      const tsconfig = stripJsComments(api.text("packages/concierge-react/tsconfig.json"));
      const build = stripJsComments(api.text("packages/concierge-react/tsdown.config.ts"));
      const license = api.text("packages/concierge-react/LICENSE");
      const coreLicense = api.text("packages/concierge/LICENSE");
      const lock = api.text("pnpm-lock.yaml");
      const expectedCorePeer = manifest?.version === "0.0.0"
        ? FIRST_RELEASE_CORE_PEER
        : "workspace:^";

      api.check(manifest?.name === "@fullselfbrowsing/concierge-react", "react-package-name", "packages/concierge-react/package.json", "@fullselfbrowsing/concierge-react", manifest?.name ?? "absent");
      api.check(manifest?.private === false, "react-public-package", "packages/concierge-react/package.json", "private false", manifest?.private ?? "absent");
      api.check(manifest?.type === "module" && manifest?.sideEffects === false, "react-esm-side-effects", "packages/concierge-react/package.json", "ESM and sideEffects false", `${manifest?.type ?? "absent"}/${manifest?.sideEffects ?? "absent"}`);
      api.check(isRecord(manifest?.exports?.["."]) && isRecord(manifest?.exports?.["./client"]), "react-two-exports", "packages/concierge-react/package.json", "root and ./client maps", "inspected");
      api.check(manifest?.peerDependencies?.["@fullselfbrowsing/concierge"] === expectedCorePeer, "react-core-peer", "packages/concierge-react/package.json", expectedCorePeer, manifest?.peerDependencies?.["@fullselfbrowsing/concierge"] ?? "absent");
      api.check(manifest?.devDependencies?.["@fullselfbrowsing/concierge"] === "workspace:*", "react-core-dev-link", "packages/concierge-react/package.json", "workspace:*", manifest?.devDependencies?.["@fullselfbrowsing/concierge"] ?? "absent");
      api.check(manifest?.dependencies?.["@fullselfbrowsing/concierge"] === undefined, "react-no-core-dependency", "packages/concierge-react/package.json", "ordinary dependency absent", manifest?.dependencies?.["@fullselfbrowsing/concierge"] ?? "absent");
      api.check(manifest?.peerDependencies?.react === "^18.2.0 || ^19.0.0" && manifest?.peerDependencies?.["react-dom"] === "^18.2.0 || ^19.0.0", "react-framework-peers", "packages/concierge-react/package.json", "React 18.2/19 peers", "inspected");
      for (const [name, expected] of Object.entries({
        react: "19.2.8",
        "react-dom": "19.2.8",
        "@types/react": "19.2.18",
        "@types/react-dom": "19.2.4",
        "@testing-library/react": "16.3.2",
      })) {
        api.check(manifest?.devDependencies?.[name] === expected, `react-dev-pin-${name}`, "packages/concierge-react/package.json", expected, manifest?.devDependencies?.[name] ?? "absent");
      }
      api.check(arrayEquals(manifest?.files ?? [], ["dist", "src", "README.md", "LICENSE"]), "react-files-list", "packages/concierge-react/package.json", "dist/src/README/LICENSE", JSON.stringify(manifest?.files ?? []));
      api.check(manifest?.scripts?.build === "tsdown" && String(manifest?.scripts?.test ?? "").includes("react-lifecycle"), "react-package-scripts", "packages/concierge-react/package.json", "tsdown and exact lifecycle project", "inspected");
      api.check(tsconfig.includes("src/**/*.tsx") && tsconfig.includes("test-d/**/*.ts"), "react-tsconfig-inputs", "packages/concierge-react/tsconfig.json", "TSX and type-test inputs", "inspected");
      for (const token of ["src/index.ts", "src/client.tsx", "fileName", "use client", "react", "@fullselfbrowsing/concierge"]) {
        api.check(build.includes(token), `react-build-${token}`, "packages/concierge-react/tsdown.config.ts", `live ${token} fingerprint`, build.includes(token) ? "present" : "absent");
      }
      api.check(/platform\s*:\s*["']neutral["']/u.test(build) && /format\s*:\s*["']esm["']/u.test(build), "react-neutral-esm-build", "packages/concierge-react/tsdown.config.ts", "neutral ESM", "inspected");
      api.check(license.length > 0 && license === coreLicense, "react-license-copy", "packages/concierge-react/LICENSE", "byte-identical core license", license === coreLicense ? "equal" : "different");
      api.check(lock.includes("packages/concierge-react:") && lock.includes("@fullselfbrowsing/concierge"), "react-lock-importer", "pnpm-lock.yaml", "React importer and core link", "inspected");
    }),
  );

  results.push(
    createProbe(INITIAL_IDS[2], inspector, (api) => {
      const rootEntry = stripJsComments(api.text(REACT_SOURCE_PATHS[0]));
      const client = stripJsComments(api.text(REACT_SOURCE_PATHS[1]));
      const lifecycle = stripJsComments(api.text("packages/concierge-react/test/lifecycle.test.tsx"));

      api.check(/^\s*["']use client["'];/u.test(client), "react-client-directive", REACT_SOURCE_PATHS[1], "first statement use client", "inspected");
      for (const symbol of ["ConciergeProvider", "useConcierge", "useConciergeValue", "useConciergeBridge"]) {
        api.check(new RegExp(`export\\s+(?:function|const)\\s+${symbol}\\b`, "u").test(client), `react-export-${symbol}`, REACT_SOURCE_PATHS[1], "canonical exported symbol", "inspected");
      }
      for (const token of ["createContext", "useEffect", "useRef", "useCallback", "assertSingleInstance", "CONTRACT_VERSION", "EXPECTED_CONTRACT_VERSION", "registry.register"]) {
        api.check(client.includes(token), `react-runtime-${token}`, REACT_SOURCE_PATHS[1], `live ${token} call/path`, client.includes(token) ? "present" : "absent");
      }
      api.check(/EXPECTED_CONTRACT_VERSION\s*(?::\s*number)?\s*=\s*1\b/u.test(client), "react-literal-contract", REACT_SOURCE_PATHS[1], "adapter-owned literal 1", "inspected");
      api.check(hasOrderedTokens(client, ["useEffect", "assertSingleInstance", "CONTRACT_VERSION", "registry.register"]), "react-guard-register-order", REACT_SOURCE_PATHS[1], "effect then guards then register", "inspected");
      api.check(/return\s+(?:unregister|registry\.register\(bridge\))/u.test(client), "react-exact-cleanup-return", REACT_SOURCE_PATHS[1], "returned registration cleanup", "inspected");
      api.check(!/\b(?:createConcierge|setTimeout|setInterval|window|document|navigator)\b/u.test(client), "react-thin-runtime", REACT_SOURCE_PATHS[1], "no core construction/timers/host globals", "inspected");
      api.check(!rootEntry.includes("use client") && !/useConcierge(?:Bridge|Value)?/u.test(rootEntry), "react-server-safe-root", REACT_SOURCE_PATHS[0], "no client directive/hook re-export", "inspected");
      for (const token of ["StrictMode", "rerender", "unmount", "T01", "R1", "T02", "R2", "expect("]) {
        api.check(lifecycle.includes(token), `react-lifecycle-${token}`, "packages/concierge-react/test/lifecycle.test.tsx", `assertion-observed ${token}`, lifecycle.includes(token) ? "present" : "absent");
      }
    }),
  );

  results.push(
    createProbe(INITIAL_IDS[3], inspector, (api) => {
      const artifact = stripJsComments(api.text("packages/concierge-react/test/artifact.test.ts"));
      const typesSource = api.text("packages/concierge-react/test-d/public.test-d.ts");
      const types = stripJsComments(typesSource);

      for (const token of ["dist/index.js", "dist/client.js", "renderToString", "window", "document", "navigator", "EXPECTED_CONTRACT_VERSION", "registry.register", "expect("]) {
        api.check(artifact.includes(token), `react-artifact-${token}`, "packages/concierge-react/test/artifact.test.ts", `artifact assertion for ${token}`, artifact.includes(token) ? "present" : "absent");
      }
      api.check(hasOrderedTokens(artifact, ["EXPECTED_CONTRACT_VERSION", "registry.register"]), "react-artifact-guard-order", "packages/concierge-react/test/artifact.test.ts", "literal guard before registration", "inspected");
      api.check(types.includes("@fullselfbrowsing/concierge-react/client"), "react-public-type-import", "packages/concierge-react/test-d/public.test-d.ts", "public client import", "inspected");
      api.check(typesSource.includes("@ts-expect-error") && types.includes("ConciergeProvider") && types.includes("useConciergeBridge"), "react-type-contract", "packages/concierge-react/test-d/public.test-d.ts", "positive and negative public API assertions", "inspected");
      api.check(!types.includes("/src/") && !types.includes("/dist/"), "react-no-private-type-import", "packages/concierge-react/test-d/public.test-d.ts", "no private/dist import", "inspected");
    }),
  );

  results.push(
    createProbe(INITIAL_IDS[4], inspector, (api) => {
      const manifest = api.json("packages/concierge-svelte/package.json");
      const tsconfig = stripJsComments(api.text("packages/concierge-svelte/tsconfig.json"));
      const config = stripJsComments(api.text("packages/concierge-svelte/svelte.config.js"));
      const license = api.text("packages/concierge-svelte/LICENSE");
      const coreLicense = api.text("packages/concierge/LICENSE");
      const lock = api.text("pnpm-lock.yaml");
      const expectedCorePeer = manifest?.version === "0.0.0"
        ? FIRST_RELEASE_CORE_PEER
        : "workspace:^";

      api.check(manifest?.name === "@fullselfbrowsing/concierge-svelte", "svelte-package-name", "packages/concierge-svelte/package.json", "@fullselfbrowsing/concierge-svelte", manifest?.name ?? "absent");
      api.check(manifest?.type === "module" && manifest?.sideEffects === false, "svelte-esm-side-effects", "packages/concierge-svelte/package.json", "ESM and sideEffects false", "inspected");
      api.check(isRecord(manifest?.exports?.["."]) && isRecord(manifest?.exports?.["./client.svelte"]), "svelte-two-exports", "packages/concierge-svelte/package.json", "root and ./client.svelte maps", "inspected");
      for (const exportName of [".", "./client.svelte"]) {
        const entry = manifest?.exports?.[exportName];
        api.check(exactObjectKeys(entry, ["types", "svelte", "import", "default"]), `svelte-export-conditions-${exportName}`, "packages/concierge-svelte/package.json", "types/svelte/import/default only", JSON.stringify(Object.keys(entry ?? {})));
      }
      api.check(manifest?.peerDependencies?.["@fullselfbrowsing/concierge"] === expectedCorePeer && manifest?.peerDependencies?.svelte === "^5.0.0", "svelte-peers", "packages/concierge-svelte/package.json", `core ${expectedCorePeer} and Svelte ^5`, "inspected");
      api.check(manifest?.devDependencies?.["@fullselfbrowsing/concierge"] === "workspace:*", "svelte-core-dev-link", "packages/concierge-svelte/package.json", "workspace:*", manifest?.devDependencies?.["@fullselfbrowsing/concierge"] ?? "absent");
      api.check(manifest?.dependencies?.["@fullselfbrowsing/concierge"] === undefined, "svelte-no-core-dependency", "packages/concierge-svelte/package.json", "ordinary dependency absent", manifest?.dependencies?.["@fullselfbrowsing/concierge"] ?? "absent");
      for (const [name, expected] of Object.entries({
        svelte: "5.56.8",
        "@sveltejs/package": "2.5.8",
        "svelte-check": "4.7.5",
        "@testing-library/svelte": "5.4.2",
        "@sveltejs/vite-plugin-svelte": "7.2.0",
        typescript: "6.0.3",
      })) {
        api.check(manifest?.devDependencies?.[name] === expected, `svelte-dev-pin-${name}`, "packages/concierge-svelte/package.json", expected, manifest?.devDependencies?.[name] ?? "absent");
      }
      api.check(manifest?.scripts?.build === "svelte-package" && String(manifest?.scripts?.typecheck ?? "").includes("svelte-check") && String(manifest?.scripts?.test ?? "").includes("svelte-lifecycle"), "svelte-package-scripts", "packages/concierge-svelte/package.json", "svelte-package/check/exact project", "inspected");
      api.check(!JSON.stringify(manifest ?? {}).includes("tsdown"), "svelte-no-tsdown", "packages/concierge-svelte/package.json", "tsdown absent", "inspected");
      api.check(tsconfig.includes("src/**/*.svelte.ts") && tsconfig.includes("test/**/*.svelte"), "svelte-tsconfig-inputs", "packages/concierge-svelte/tsconfig.json", "rune and component inputs", "inspected");
      api.check(config.includes("vitePreprocess"), "svelte-preprocess", "packages/concierge-svelte/svelte.config.js", "vitePreprocess()", "inspected");
      api.check(license.length > 0 && license === coreLicense, "svelte-license-copy", "packages/concierge-svelte/LICENSE", "byte-identical core license", license === coreLicense ? "equal" : "different");
      api.check(lock.includes("packages/concierge-svelte:") && lock.includes("typescript:") && lock.includes("6.0.3"), "svelte-lock-importer", "pnpm-lock.yaml", "Svelte importer and TS6", "inspected");
    }),
  );

  results.push(
    createProbe(INITIAL_IDS[5], inspector, (api) => {
      const rootEntry = stripJsComments(api.text(SVELTE_SOURCE_PATHS[0]));
      const client = stripJsComments(api.text(SVELTE_SOURCE_PATHS[1]));
      const harness = api.text("packages/concierge-svelte/test/Harness.svelte");
      const lifecycle = stripJsComments(api.text("packages/concierge-svelte/test/lifecycle.test.ts"));

      for (const symbol of ["provideConcierge", "useConcierge", "useConciergeBridge", "svelteSnapshotNormalizer"]) {
        api.check(new RegExp(`export\\s+(?:function|const)\\s+${symbol}\\b`, "u").test(client), `svelte-export-${symbol}`, SVELTE_SOURCE_PATHS[1], "canonical exported symbol", "inspected");
      }
      for (const token of ["setContext", "getContext", "$effect", "$state.snapshot", "getRegistry", "getBridge", "assertSingleInstance", "CONTRACT_VERSION", "EXPECTED_CONTRACT_VERSION", "registry.register", "SnapshotNormalizer"]) {
        api.check(client.includes(token), `svelte-runtime-${token}`, SVELTE_SOURCE_PATHS[1], `live ${token} call/path`, client.includes(token) ? "present" : "absent");
      }
      api.check(/EXPECTED_CONTRACT_VERSION\s*(?::\s*number)?\s*=\s*1\b/u.test(client), "svelte-literal-contract", SVELTE_SOURCE_PATHS[1], "adapter-owned literal 1", "inspected");
      api.check(hasOrderedTokens(client, ["$effect", "getRegistry()", "getBridge()", "assertSingleInstance", "CONTRACT_VERSION", "registry.register"]), "svelte-guard-register-order", SVELTE_SOURCE_PATHS[1], "effect getters then guards then register", "inspected");
      api.check(/return\s+(?:unregister|registry\.register\(bridge\))/u.test(client), "svelte-exact-cleanup-return", SVELTE_SOURCE_PATHS[1], "returned registration cleanup", "inspected");
      api.check(/function\s+svelteSnapshotNormalizer\s*<T>\s*\(value\s*:\s*T\)\s*:\s*T/u.test(client) && /function\s+svelteSnapshotNormalizer\s*\(value\s*:\s*unknown\)\s*:\s*unknown/u.test(client), "svelte-normalizer-overload", SVELTE_SOURCE_PATHS[1], "generic plus unknown overload", "inspected");
      api.check(!/\b(?:structuredClone|JSON\.stringify|createContext|createConcierge)\b/u.test(client), "svelte-native-thin-runtime", SVELTE_SOURCE_PATHS[1], "no clone/store/core construction", "inspected");
      api.check(/export\s+type\s*\{/u.test(rootEntry) && /from\s+["']@fullselfbrowsing\/concierge["']/u.test(rootEntry) && !/(?:client\.svelte|\bcreateConcierge\b|\bprovideConcierge\b|\buseConcierge(?:Bridge)?\b|\bsvelteSnapshotNormalizer\b|\bsetContext\b|\bgetContext\b|\$effect)/u.test(rootEntry), "svelte-public-root", SVELTE_SOURCE_PATHS[0], "server-safe public-core type root with client helpers split to ./client.svelte", "inspected");
      api.check(harness.includes("const getRegistry") && harness.includes("const getBridge") && harness.includes("useConciergeBridge(getRegistry, getBridge)") && !harness.includes("state_referenced_locally") && !/window\.|document\.|navigator\./u.test(stripJsComments(harness)), "svelte-real-harness", "packages/concierge-svelte/test/Harness.svelte", "getter-driven component hook without suppressions or host reads", "inspected");
      for (const token of ["mount", "rerender", "unmount", "cleanupCalls", "T03", "S1", "T04", "expect("]) {
        api.check(lifecycle.includes(token), `svelte-lifecycle-${token}`, "packages/concierge-svelte/test/lifecycle.test.ts", `assertion-observed ${token}`, lifecycle.includes(token) ? "present" : "absent");
      }
    }),
  );

  results.push(
    createProbe(INITIAL_IDS[6], inspector, (api) => {
      const artifact = stripJsComments(api.text("packages/concierge-svelte/test/artifact.test.ts"));
      const manifest = api.json("packages/concierge-svelte/package.json");
      for (const token of ["dist/index.js", "dist/client.svelte", "types", "svelte", "import", "default", "window", "document", "navigator", "EXPECTED_CONTRACT_VERSION", "$state", "expect("]) {
        api.check(artifact.includes(token), `svelte-artifact-${token}`, "packages/concierge-svelte/test/artifact.test.ts", `artifact assertion for ${token}`, artifact.includes(token) ? "present" : "absent");
      }
      api.check(exactObjectKeys(manifest?.exports?.["."], ["types", "svelte", "import", "default"]) && exactObjectKeys(manifest?.exports?.["./client.svelte"], ["types", "svelte", "import", "default"]), "svelte-artifact-export-contract", "packages/concierge-svelte/package.json", "framework-aware conditions", "inspected");
      api.check(!artifact.includes("packages/concierge/src/") && /expect\(JSON\.stringify\(manifest\)\)\.not\.toContain\(["']tsdown["']\)/u.test(artifact), "svelte-artifact-boundary", "packages/concierge-svelte/test/artifact.test.ts", "no private core and an asserted tsdown exclusion", "inspected");
    }),
  );

  results.push(
    createProbe(INITIAL_IDS[7], inspector, (api) => {
      const manifest = api.json("examples/adapter-ssr/package.json");
      const config = stripJsComments(api.text("examples/adapter-ssr/astro.config.mjs"));
      const tsconfig = stripJsComments(api.text("examples/adapter-ssr/tsconfig.json"));
      const catalog = stripJsComments(api.text("examples/adapter-ssr/src/shared/catalog.ts"));
      const reactIsland = stripJsComments(api.text("examples/adapter-ssr/src/components/ReactIsland.tsx"));
      const svelteIsland = stripJsComments(api.text("examples/adapter-ssr/src/components/SvelteIsland.svelte"));
      const page = stripJsComments(api.text("examples/adapter-ssr/src/pages/index.astro"));
      const test = stripJsComments(api.text("examples/adapter-ssr/test/ssr.test.ts"));

      api.check(manifest?.name === "@fullselfbrowsing/concierge-adapter-ssr" && manifest?.private === true, "astro-private-package", "examples/adapter-ssr/package.json", "named private package", "inspected");
      for (const [name, expected] of Object.entries({
        astro: "7.2.0",
        "@astrojs/react": "6.0.2",
        "@astrojs/svelte": "9.0.1",
        "@astrojs/check": "0.9.10",
        typescript: "6.0.3",
        "@fullselfbrowsing/concierge": "workspace:*",
        "@fullselfbrowsing/concierge-react": "workspace:*",
        "@fullselfbrowsing/concierge-svelte": "workspace:*",
      })) {
        api.check(manifest?.devDependencies?.[name] === expected, `astro-dev-pin-${name}`, "examples/adapter-ssr/package.json", expected, manifest?.devDependencies?.[name] ?? "absent");
      }
      for (const token of ["@astrojs/react", "@astrojs/svelte", "ADAPTER_SSR_OUT_DIR", 'output: "static"', "react()", "svelte()"]) {
        api.check(config.includes(token), `astro-config-${token}`, "examples/adapter-ssr/astro.config.mjs", `live ${token}`, config.includes(token) ? "present" : "absent");
      }
      api.check(tsconfig.includes("astro/tsconfigs/strict"), "astro-strict-tsconfig", "examples/adapter-ssr/tsconfig.json", "Astro strict config", "inspected");
      api.check(catalog.includes("createRequestHarness") && catalog.includes("createBridge") && catalog.includes("createConcierge") && catalog.includes("svelteSnapshotNormalizer"), "astro-request-factory", "examples/adapter-ssr/src/shared/catalog.ts", "request-local shared harness", "inspected");
      api.check(reactIsland.includes("@fullselfbrowsing/concierge-react/client") && reactIsland.includes("useConciergeBridge"), "astro-react-island", "examples/adapter-ssr/src/components/ReactIsland.tsx", "public injected React client", "inspected");
      api.check(svelteIsland.includes("@fullselfbrowsing/concierge-svelte/client.svelte") && svelteIsland.includes("useConciergeBridge(() => registry, () => bridge)"), "astro-svelte-island", "examples/adapter-ssr/src/components/SvelteIsland.svelte", "public getter-injected Svelte client", "inspected");
      api.check(page.includes("adapter-ssr-evidence") && page.includes("application/json"), "astro-machine-evidence", "examples/adapter-ssr/src/pages/index.astro", "JSON evidence block", "inspected");
      api.check(!/[<]style\b|\bclass=|tailwind|document\.|window\.|navigator\./u.test([catalog, reactIsland, svelteIsland, page].join("\n")), "astro-headless-server-source", "examples/adapter-ssr/src", "no UI styling/host reads", "inspected");
      for (const token of ["mkdtemp", "ADAPTER_SSR_OUT_DIR", "astro", "index.html", "ASTRO_SSR_EVIDENCE", "renders=2", "registries=null", "globals=absent", "SSR1", "T04", "expect("]) {
        api.check(test.includes(token), `astro-test-${token}`, "examples/adapter-ssr/test/ssr.test.ts", `assertion-observed ${token}`, test.includes(token) ? "present" : "absent");
      }
    }),
  );

  results.push(
    createProbe(INITIAL_IDS[8], inspector, (api) => {
      const script = stripJsComments(api.text("scripts/phase-09-package-check.mjs"));
      const secureEnvironment = api.text(
        "scripts/phase-09-secure-environment.mjs",
      );
      const publisher = stripJsComments(
        api.text("scripts/phase-09-publish-archives.mjs"),
      );
      const versioner = stripJsComments(api.text("scripts/phase-09-version.mjs"));
      const workflowChecker = stripJsComments(
        api.text("scripts/phase-09-workflow-check.mjs"),
      );
      const releaseWorkflow = api.text(".github/workflows/release.yml");
      const rootManifest = api.json("package.json");
      const publicManifests = [
        "packages/concierge/package.json",
        "packages/concierge-react/package.json",
        "packages/concierge-svelte/package.json",
      ].map((path) => [path, api.json(path)]);
      const consumerManifest = api.json(
        "scripts/fixtures/phase-09-foreign-consumer/package.json",
      );
      const consumerLock = api.json(
        "scripts/fixtures/phase-09-foreign-consumer/package-lock.json",
      );
      for (const mode of ["artifacts", "svelte-consent", "mismatch", "all", "self-test"]) {
        api.check(script.includes(`"${mode}"`) || script.includes(`'${mode}'`), `package-mode-${mode}`, "scripts/phase-09-package-check.mjs", `declared ${mode} mode`, "inspected");
      }
      for (const token of [
        "mkdtemp",
        "pnpm pack",
        "@fullselfbrowsing/concierge-react",
        "@fullselfbrowsing/concierge-svelte",
        "publint",
        "attw",
        "realpath",
        "skipLibCheck",
        "numTotalTestSuites",
        "numTotalTests",
        "$state",
        "consent_stale",
        "PHASE09_ARCHIVE_EXPORT_DIR",
        "EXPECTED_CONTRACT_VERSION",
        "useSvelteBridge(() => typedRegistry, () => bridge)",
        "useConciergeBridge(() => registry, () => bridge)",
        "--offline",
        "consumerTooling",
        "CONSUMER_TOOLING_LOCK",
        "createSecureChildEnvironment",
        "mergeSecureChildEnvironment",
        "nested secure child environment probe",
      ]) {
        api.check(script.includes(token), `package-check-${token}`, "scripts/phase-09-package-check.mjs", `live ${token} evidence`, script.includes(token) ? "present" : "absent");
      }
      for (const token of [
        "assertCredentialFreeFinalizationEnvironment",
        "runAfterCredentialFreeFinalizationPreflight",
        "createSecureChildEnvironment",
        "mergeSecureChildEnvironment",
        "NPM_CONFIG_USERCONFIG",
        "NPM_CONFIG_GLOBALCONFIG",
        "NPM_CONFIG_REGISTRY",
        "PNPM_CONFIG_STORE_DIR",
        "GIT_CONFIG_NOSYSTEM",
        "GIT_CONFIG_GLOBAL",
        "PHASE09_CREDENTIAL_FREE_ENV",
        ".netrc",
        ".npmrc",
        "github_token",
        "npm_",
        "node_options",
        "ssh_",
      ]) {
        api.check(
          secureEnvironment.includes(token),
          `secure-environment-${token}`,
          "scripts/phase-09-secure-environment.mjs",
          `credential-free child control ${token}`,
          secureEnvironment.includes(token) ? "present" : "absent",
        );
      }
      api.check(
        !/\.\.\.\s*process\.env/u.test(script),
        "package-check-no-ambient-environment-spread",
        "scripts/phase-09-package-check.mjs",
        "no ambient environment spread into package children",
        "inspected",
      );
      api.check(
        consumerManifest.packageManager === "npm@11.11.0" &&
          Object.keys(consumerManifest.dependencies ?? {}).length === 13 &&
          Object.values(consumerManifest.dependencies ?? {}).every((value) =>
            /^\d+\.\d+\.\d+$/u.test(value),
          ),
        "consumer-tooling-manifest",
        "scripts/fixtures/phase-09-foreign-consumer/package.json",
        "exact npm and 13 exact tooling versions",
        "inspected",
      );
      api.check(
        consumerLock.lockfileVersion === 3 &&
          Object.keys(consumerLock.packages ?? {}).length > 1 &&
          stableJson(consumerLock.packages?.[""]?.dependencies) ===
            stableJson(consumerManifest.dependencies),
        "consumer-tooling-lock",
        "scripts/fixtures/phase-09-foreign-consumer/package-lock.json",
        "non-vacuous lockfile v3 matching the tooling manifest",
        "inspected",
      );
      api.check(!script.includes("passWithNoTests") && !script.includes("--pack packages/concierge-react") && !script.includes("state_referenced_locally"), "package-check-no-vacuous-repack", "scripts/phase-09-package-check.mjs", "no zero-test/repack/suppression shortcuts", "inspected");
      for (const token of [
        "phase-09-release-seal.json",
        "RELEASE_AUTHORIZATION",
        "SEAL_BINDING",
        "REGISTRY_INTEGRITY",
        "REGISTRY_PROVENANCE",
        "PUBLISH_AMBIGUOUS",
        "PUBLISH_ENVIRONMENT",
        "https://registry.npmjs.org/",
        "--provenance",
        "--registry=",
        "--userconfig=",
        "--globalconfig=",
        "fetchAttestation",
        "validateProvenanceBundle",
        "runAttempt",
        "sourceRef",
        "workflowPath",
        "dist",
        "attestations",
        "initial-success",
        "core-success-react-failure",
        "exact-safe-rerun",
        "coordinated-archive-manifest-substitution",
        "ordinary-feature-mode",
        "zero-version",
        "archive-version-drift",
        "cross-attempt-seal",
        "hostile-manifest-registry",
        "foreign-provenance-repository",
        "foreign-provenance-commit",
        "foreign-provenance-workflow",
        "foreign-provenance-predicate",
        "foreign-provenance-subject",
        "fabricated-attestation-url",
      ]) {
        api.check(publisher.includes(token), `publisher-${token}`, "scripts/phase-09-publish-archives.mjs", `sealed/resumable publisher control ${token}`, publisher.includes(token) ? "present" : "absent");
      }
      for (const token of [
        "prepare",
        "apply",
        "VERSION_ARTIFACT_BINDING",
        "VERSION_ARTIFACT_SEMANTICS",
        "unprivilegedEnvironment",
        "exact-noop-artifact",
        "manifest-command-injection",
        "token-stripped-from-prepare-children",
        "09-VERSION-RECEIPT.json",
        "runAttempt",
        "malicious-evidence-blob",
        "arbitrary-markdown",
        "lock-dependency-smuggling",
        "consumed-digest-mismatch",
        "artifact-attempt-binding",
        "artifact-missing-attempt",
        "rerun-attempt-artifact-isolation",
      ]) {
        api.check(versioner.includes(token), `versioner-${token}`, "scripts/phase-09-version.mjs", `prepared artifact control ${token}`, versioner.includes(token) ? "present" : "absent");
      }
      for (const token of [
        "appended-publish-command",
        "prepare-token-leak",
        "version-extra-command",
        "sealer-workspace-code",
        "configured-directory-publisher",
        "artifact-missing-run-attempt",
        "validateConfiguredPublishSurface",
        "validateRepositoryPublisherSources",
      ]) {
        api.check(workflowChecker.includes(token), `workflow-checker-${token}`, "scripts/phase-09-workflow-check.mjs", `release boundary detector ${token}`, workflowChecker.includes(token) ? "present" : "absent");
      }
      for (const token of [
        "prepare:",
        "version:",
        "verify:",
        "seal:",
        "publish:",
        "persist-credentials: false",
        "phase09-version-${{ github.run_id }}-${{ github.run_attempt }}-${{ github.sha }}",
        "phase09-untrusted-archives-${{ github.run_id }}-${{ github.run_attempt }}-${{ github.sha }}",
        "phase09-publisher-tools-${{ github.run_id }}-${{ github.run_attempt }}-${{ github.sha }}",
        "phase09-sealed-release-${runAttempt}-${sealId}",
        "09-VERSION-RECEIPT.json",
        "PHASE09_EXPECTED_RUN_ATTEMPT",
        "PHASE09_EXPECTED_SOURCE_REF",
        "PHASE09_EXPECTED_WORKFLOW_PATH",
        "PHASE09_EXPECTED_SEALED_ARTIFACT",
      ]) {
        api.check(releaseWorkflow.includes(token), `release-workflow-${token}`, ".github/workflows/release.yml", `release job/artifact contract ${token}`, releaseWorkflow.includes(token) ? "present" : "absent");
      }
      api.check(
        rootManifest.scripts?.release === "node scripts/phase-09-publish-archives.mjs",
        "root-release-fail-closed",
        "package.json",
        "single exact-archive publisher entry point with required runtime arguments",
        String(rootManifest.scripts?.release),
      );
      for (const [path, manifest] of publicManifests) {
        const directory = path.split("/").at(-2);
        api.check(
          stableJson(manifest?.publishConfig) === stableJson({ access: "public" }) &&
            stableJson(manifest?.repository) === stableJson({
              type: "git",
              url: "git+https://github.com/fullselfbrowsing/concierge.git",
              directory: `packages/${directory}`,
            }),
          `publish-destination-${directory}`,
          path,
          "exact public npm and repository metadata",
          "inspected",
        );
      }
    }),
  );

  results.push(
    createProbe(INITIAL_IDS[9], inspector, (api) => {
      const script = stripJsComments(api.text("scripts/phase-09-adapter-budget.mjs"));
      for (const sourcePath of [...REACT_SOURCE_PATHS, ...SVELTE_SOURCE_PATHS]) {
        api.check(script.includes(sourcePath), `budget-inventory-${sourcePath}`, "scripts/phase-09-adapter-budget.mjs", "exact production inventory entry", script.includes(sourcePath) ? "present" : "absent");
      }
      for (const token of ["check", "self-test", "150", "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoStatement", "createConcierge", "setTimeout", "dedupe", "queue", "consent", "transport", "typescript", "mkdtemp"]) {
        api.check(script.includes(token), `budget-check-${token}`, "scripts/phase-09-adapter-budget.mjs", `live ${token} detector/control`, script.includes(token) ? "present" : "absent");
      }
      api.check(script.includes(".svelte.ts") && script.includes(".tsx") && script.includes(".svelte"), "budget-extension-discovery", "scripts/phase-09-adapter-budget.mjs", "independent production extension discovery", "inspected");
    }),
  );

  results.push(
    createProbe(INITIAL_IDS[10], inspector, (api) => {
      const register = api.json(`${PHASE_DIRECTORY}/09-MUTATION-REGISTER.json`);
      const runner = stripJsComments(api.text("scripts/phase-09-mutation-battery.mjs"));
      const releasing = api.text("RELEASING.md");
      const mutationEvidence = api.text(`${PHASE_DIRECTORY}/09-MUTATION-EVIDENCE.json`);
      const releaseEvidence = api.text(`${PHASE_DIRECTORY}/09-RELEASE-EVIDENCE.json`);
      const validation = api.text(`${PHASE_DIRECTORY}/09-VALIDATION.md`);
      const security = api.text(`${PHASE_DIRECTORY}/09-SECURITY.md`);

      const rows = Array.isArray(register?.rows) ? register.rows : [];
      const ids = rows.map((row) => row?.id);
      api.check(arrayEquals(ids, MUTATION_IDS), "mutation-register-ids", `${PHASE_DIRECTORY}/09-MUTATION-REGISTER.json`, JSON.stringify(MUTATION_IDS), JSON.stringify(ids));
      for (const row of rows) {
        api.check(row?.occurrences === 1 && typeof row?.exactBefore === "string" && typeof row?.exactAfter === "string" && typeof row?.compileCommand === "string" && typeof row?.killerCommand === "string" && typeof row?.assertionFingerprint === "string", `mutation-row-${row?.id ?? "unknown"}`, `${PHASE_DIRECTORY}/09-MUTATION-REGISTER.json`, "one exact compiled semantic row", "inspected");
      }
      for (const token of ["self-test", "preflight", "run", "finalize", "--jobs", "verify", "evidence", "release", "publish", "mode", "versioned", "releaseAuthorization", "runAttempt", "sharedVersion", "consumedChangesets", "versionReceipt", "09-VERSION-RECEIPT.json", "verifyPublishEvidence", "ordinary-mode-publish-rejected", "zero-version-publish-rejected", "removed-changeset-publish-rejected", "missing-evidence-attempt-rejected", "mismatched-evidence-attempt-rejected", "missing-receipt-attempt-rejected", "mismatched-receipt-attempt-rejected", "finalization-environment-preflight-before-child", "finalization-config-preflight-before-child", "secure-child-environment-probe", "pnpm-fetch-before-offline-install", "pnpm-fetch-failure-suppresses-install", "owned-pnpm-store-not-redirectable", "pnpm-owned-store-and-registry", "runAfterCredentialFreeFinalizationPreflight", "createSecureChildEnvironment", "mergeSecureChildEnvironment", "prewarmOwnedPnpmStoreAndInstall", "PNPM_FETCH_ARGUMENTS", "PNPM_OFFLINE_INSTALL_ARGUMENTS", "mkdtemp", "phase-08-mutation-battery.mjs", "09-MUTATION-EVIDENCE.json", "09-RELEASE-EVIDENCE.json"]) {
        api.check(runner.includes(token), `mutation-runner-${token}`, "scripts/phase-09-mutation-battery.mjs", `live ${token} state-machine path`, runner.includes(token) ? "present" : "absent");
      }
      api.check(
        !/\.\.\.\s*process\.env/u.test(runner),
        "mutation-runner-no-ambient-environment-spread",
        "scripts/phase-09-mutation-battery.mjs",
        "no ambient environment spread into finalization children",
        "inspected",
      );
      api.check(
        /const PNPM_FETCH_ARGUMENTS\s*=\s*Object\.freeze\(\[\s*"fetch",\s*"--frozen-lockfile",\s*"--ignore-scripts",?\s*\]\)/u.test(runner) &&
          /const PNPM_OFFLINE_INSTALL_ARGUMENTS\s*=\s*Object\.freeze\(\[\s*"install",\s*"--offline",\s*"--frozen-lockfile",?\s*\]\)/u.test(runner) &&
          runner.includes('prewarmOwnedPnpmStoreAndInstall(baselineRoot, "baseline")') &&
          runner.includes('prewarmOwnedPnpmStoreAndInstall(snapshotRoot, "Phase 8 snapshot")'),
        "owned-pnpm-store-prewarm-order",
        "scripts/phase-09-mutation-battery.mjs",
        "exact frozen fetch before both offline installs",
        "inspected",
      );
      api.check(
        releasing.includes('env -i PATH="$PATH"') &&
          /not an OS network or\s+filesystem sandbox/u.test(releasing) &&
          releasing.includes("owned empty npm user/global and Git global configs") &&
          releasing.includes("pnpm fetch --frozen-lockfile --ignore-scripts") &&
          releasing.includes("fetch may") &&
          releasing.includes("registry.npmjs.org"),
        "versioned-finalization-runbook-boundary",
        "RELEASING.md",
        "credential-free launch plus honest process-isolation boundary",
        "inspected",
      );
      for (const mode of ["inputs", "ledgers"]) {
        api.check(new RegExp(`["']verify["']\\s*,\\s*["']${mode}["']`, "u").test(runner), `mutation-runner-verify-${mode}`, "scripts/phase-09-mutation-battery.mjs", `exact Phase 8 verify ${mode} command`, "inspected");
      }
      for (const id of MUTATION_IDS) {
        api.check(mutationEvidence.includes(id), `mutation-evidence-${id}`, `${PHASE_DIRECTORY}/09-MUTATION-EVIDENCE.json`, "green row evidence", mutationEvidence.includes(id) ? "present" : "absent");
      }
      for (const token of ["@fullselfbrowsing/concierge", "08-consent-kernel", "phase-09-package-check", "phase-09-adapter-budget"]) {
        api.check(releaseEvidence.includes(token), `release-evidence-${token}`, `${PHASE_DIRECTORY}/09-RELEASE-EVIDENCE.json`, "revision-bound release evidence", releaseEvidence.includes(token) ? "present" : "absent");
      }
      for (let index = 1; index <= 13; index += 1) {
        for (let task = 1; task <= 2; task += 1) {
          const taskId = `09-${String(index).padStart(2, "0")}-${String(task).padStart(2, "0")}`;
          api.check(validation.includes(taskId), `validation-${taskId}`, `${PHASE_DIRECTORY}/09-VALIDATION.md`, "exact task traceability", validation.includes(taskId) ? "present" : "absent");
        }
      }
      for (const threat of ["T-09-01", "T-09-02", "T-09-03", "T-09-04", "T-09-05", "T-09-06", "T-09-07", "T-09-08", "T-09-SC"]) {
        api.check(security.includes(threat), `security-${threat}`, `${PHASE_DIRECTORY}/09-SECURITY.md`, "disposed threat evidence", security.includes(threat) ? "present" : "absent");
      }
      api.check(!/MISSING|PENDING|TBD|NOT RUN/u.test(`${mutationEvidence}\n${releaseEvidence}\n${validation}\n${security}`), "terminal-no-placeholders", PHASE_DIRECTORY, "no incomplete marker", "inspected");
    }),
  );

  validateIds(results.map((result) => result.id), INITIAL_IDS.length, "contract definitions");
  for (const result of results) {
    if (!result.passed && result.checks.every((check) => check.ok)) {
      throw new Error(`${result.id} failed without an assertion-observed mismatch`);
    }
  }
  return Object.freeze({ results: Object.freeze(results), inputs: Object.freeze(inspector.snapshot()) });
}

function assertExactMissing(evaluation, expectedIds, label) {
  validateIds(expectedIds, expectedIds.length, `${label} expected IDs`);
  const missing = evaluation.results.filter((result) => !result.passed);
  const ids = missing.map((result) => result.id);
  if (!arrayEquals(ids, expectedIds)) {
    const detail = missing
      .map((result) => {
        const first = result.checks.find((check) => !check.ok);
        return `${result.id}:${first?.name ?? "no-failed-check"}@${first?.path ?? "unknown"}`;
      })
      .join(", ");
    throw new Error(`${label} expected ${JSON.stringify(expectedIds)}, observed ${JSON.stringify(ids)} (${detail})`);
  }
  for (const result of missing) {
    const failures = result.checks.filter((check) => !check.ok);
    if (failures.length === 0) {
      throw new Error(`${result.id} is a vacuous failure with zero failed assertions`);
    }
  }
  return missing;
}

function baselineDigest(ids, inputs) {
  return sha256(stableJson({ ids, inputs }));
}

function createBaselineRecord(evaluation, missing) {
  const inputs = evaluation.inputs.map(({ path, kind, size, sha256: digest }) => ({
    path,
    kind,
    size,
    sha256: digest,
  }));
  return {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    phase: "09-react-and-svelte-adapters",
    recordedAt: new Date().toISOString(),
    ids: [...INITIAL_IDS],
    failures: missing.map((result) => ({
      id: result.id,
      observations: result.checks
        .filter((check) => !check.ok)
        .map(({ name, path, expected, actual }) => ({ name, path, expected, actual })),
    })),
    inputs,
    inputHashes: Object.fromEntries(inputs.map((input) => [input.path, input.sha256])),
    sourceDigest: baselineDigest(INITIAL_IDS, inputs),
  };
}

function validateBaselineRecord(record) {
  if (!isRecord(record) || record.schemaVersion !== BASELINE_SCHEMA_VERSION) {
    throw new Error(`baseline schemaVersion must be ${BASELINE_SCHEMA_VERSION}`);
  }
  if (record.phase !== "09-react-and-svelte-adapters") {
    throw new Error("baseline phase is invalid");
  }
  if (!arrayEquals(record.ids ?? [], INITIAL_IDS)) {
    throw new Error("baseline IDs differ from the exact initial ordered set");
  }
  validateIds(record.ids, INITIAL_IDS.length, "baseline IDs");
  if (!Array.isArray(record.failures) || record.failures.length !== INITIAL_IDS.length) {
    throw new Error(`baseline failure cardinality must be ${INITIAL_IDS.length}`);
  }
  if (!arrayEquals(record.failures.map((failure) => failure?.id), INITIAL_IDS)) {
    throw new Error("baseline failure rows differ from the exact initial ordered set");
  }
  for (const failure of record.failures) {
    if (!Array.isArray(failure?.observations) || failure.observations.length === 0) {
      throw new Error(`baseline ${failure?.id ?? "unknown"} has no assertion-observed failure`);
    }
    for (const observation of failure.observations) {
      if (!isRecord(observation) || typeof observation.name !== "string" || typeof observation.path !== "string" || typeof observation.expected !== "string" || typeof observation.actual !== "string") {
        throw new Error(`baseline ${failure.id} has a malformed observation`);
      }
    }
  }
  if (!Array.isArray(record.inputs) || record.inputs.length === 0) {
    throw new Error("baseline inputs must be a nonempty array");
  }
  const inputPaths = record.inputs.map((input) => input?.path);
  if (inputPaths.some((path) => typeof path !== "string") || new Set(inputPaths).size !== inputPaths.length) {
    throw new Error("baseline input paths must be unique strings");
  }
  if (!arrayEquals(inputPaths, [...inputPaths].sort((left, right) => left.localeCompare(right)))) {
    throw new Error("baseline input paths must be sorted");
  }
  for (const input of record.inputs) {
    if (!isRecord(input) || !["file", "empty", "missing", "non-file"].includes(input.kind) || !Number.isInteger(input.size) || input.size < 0 || !SHA256_PATTERN.test(input.sha256 ?? "")) {
      throw new Error(`baseline input ${input?.path ?? "unknown"} is malformed`);
    }
  }
  const expectedHashes = Object.fromEntries(record.inputs.map((input) => [input.path, input.sha256]));
  if (!isRecord(record.inputHashes) || stableJson(record.inputHashes) !== stableJson(expectedHashes)) {
    throw new Error("baseline inputHashes do not match the persisted input rows");
  }
  const expectedDigest = baselineDigest(record.ids, record.inputs);
  if (record.sourceDigest !== expectedDigest || !SHA256_PATTERN.test(record.sourceDigest ?? "")) {
    throw new Error("baseline sourceDigest does not match its persisted IDs and inputs");
  }
  if (typeof record.recordedAt !== "string" || Number.isNaN(Date.parse(record.recordedAt))) {
    throw new Error("baseline recordedAt is not an ISO timestamp");
  }
  return record;
}

function readBaseline(root) {
  const source = requireRegularNonempty(root, BASELINE_PATH);
  let record;
  try {
    record = JSON.parse(source);
  } catch {
    throw new Error("baseline record is not valid JSON");
  }
  return validateBaselineRecord(record);
}

function writeBaselineAtomic(root, record) {
  const absolutePath = resolveInside(root, BASELINE_PATH);
  mkdirSync(dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(temporaryPath, absolutePath);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}

function requireFinalPaths(root) {
  validateIds(FINAL_REQUIRED_PATHS, FINAL_REQUIRED_PATHS.length, "final required paths");
  for (const relativePath of FINAL_REQUIRED_PATHS) {
    requireRegularNonempty(root, relativePath);
  }
}

function runSelfTest() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "phase-09-contract-self-test-"));
  try {
    const fixturePath = "fixture.txt";
    writeFileSync(resolveInside(fixtureRoot, fixturePath), "one observed assertion\n", "utf8");

    assert.throws(() => parseInvocation(["unknown"]), /unknown mode/u);
    assert.throws(() => parseInvocation([]), /usage/u);
    assert.throws(() => parseInvocation(["final", "extra"]), /usage/u);
    assert.throws(() => validateIds([INITIAL_IDS[0], INITIAL_IDS[0]], 2), /duplicate/u);
    assert.throws(() => validateIds(INITIAL_IDS.slice(0, -1), INITIAL_IDS.length), /cardinality/u);
    assert.doesNotThrow(() => requireRegularNonempty(fixtureRoot, fixturePath));
    assert.throws(() => requireRegularNonempty(fixtureRoot, "missing.file"), /regular nonempty file/u);
    assert.equal(requirePositiveMatches("positive fixture", "assertion marker", /assertion/gu).length, 1);
    assert.throws(() => requirePositiveMatches("vacuous fixture", "assertion marker", /never-matches/gu), /zero matches/u);

    const inspector = createInspector(fixtureRoot);
    assert.throws(
      () => createProbe("SYNTHETIC", inspector, () => {}),
      /vacuous/u,
    );

    const exactEvaluation = {
      results: INITIAL_IDS.map((id) => ({
        id,
        passed: false,
        checks: [{ ok: false, name: "synthetic", path: fixturePath, expected: "pass", actual: "fail" }],
      })),
    };
    assert.equal(assertExactMissing(exactEvaluation, INITIAL_IDS, "synthetic baseline").length, INITIAL_IDS.length);
    assert.throws(
      () =>
        assertExactMissing(
          {
            results: exactEvaluation.results.map((result, index) =>
              index === 0 ? { ...result, checks: [] } : result,
            ),
          },
          INITIAL_IDS,
          "synthetic vacuous baseline",
        ),
      /zero failed assertions/u,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }

  console.log("PASS: Phase 09 contract checker self-test rejected unknown modes, duplicate/cardinality drift, missing paths, and vacuous probes");
}

function run(mode) {
  if (mode === "self-test") {
    runSelfTest();
    return;
  }

  if (mode === "baseline-verify") {
    const record = readBaseline(ROOT);
    console.log(`PASS: Phase 09 immutable RED baseline verified — ${record.ids.length} assertion-observed IDs, digest ${record.sourceDigest}`);
    return;
  }

  if (mode === "final") {
    requireFinalPaths(ROOT);
    readBaseline(ROOT);
    const evaluation = evaluateContracts(ROOT);
    assertExactMissing(evaluation, [], "final contract");
    console.log(`PASS: Phase 09 final contract — 0 missing IDs across ${FINAL_REQUIRED_PATHS.length} required nonempty artifacts`);
    return;
  }

  const evaluation = evaluateContracts(ROOT);

  if (mode === "post-skeleton") {
    assertExactMissing(evaluation, POST_SKELETON_IDS, "post-skeleton contract");
    console.log(`PASS: Phase 09 post-skeleton contract — exact ${POST_SKELETON_IDS.length} missing IDs observed`);
    return;
  }

  const missing = assertExactMissing(evaluation, INITIAL_IDS, "initial RED contract");
  const record = createBaselineRecord(evaluation, missing);

  if (existsSync(resolveInside(ROOT, BASELINE_PATH))) {
    const prior = readBaseline(ROOT);
    if (prior.sourceDigest !== record.sourceDigest) {
      throw new Error("baseline already exists and is immutable; refusing to replace a different sourceDigest");
    }
    console.log(`PASS: Phase 09 RED baseline already recorded — ${prior.ids.length} assertion-observed IDs, digest ${prior.sourceDigest}`);
    return;
  }

  writeBaselineAtomic(ROOT, record);
  console.log(`PASS: Phase 09 RED baseline recorded — ${record.ids.length} assertion-observed IDs, ${record.inputs.length} inspected inputs, digest ${record.sourceDigest}`);
}

try {
  run(parseInvocation(process.argv.slice(2)));
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : "unknown Phase 09 contract-check error"}`);
  process.exitCode = 1;
}
