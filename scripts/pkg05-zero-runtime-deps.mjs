#!/usr/bin/env node
// scripts/pkg05-zero-runtime-deps.mjs — PKG-05
//
// ============================================================================
// THE CLAIM, LOCKED HERE BEFORE ANY RUNTIME CODE EXISTS
// ============================================================================
//
//   (a) Core's DEPENDENCIES contribute zero runtime bytes to a consumer bundle.
//
// Two readings of PKG-05 are live in the source documents, and they are not the
// same claim:
//
//   (a) Dependencies add zero bytes. REQUIREMENTS.md PKG-05 says core's
//       "runtime dependency footprint is verified to be zero-cost". ROADMAP
//       SC-5 says core's "installed dependency footprint is verified to add
//       zero runtime bytes to a consumer bundle". The word in both is
//       *dependency*.
//   (b) Core itself ships zero bytes. Stated nowhere, but it is how the phrase
//       "zero runtime bytes" reads in isolation, and it is what a reviewer may
//       assume.
//
// (b) IS REJECTED. It becomes unsatisfiable the moment assertSingleInstance()
// lands in plan 02-06, and Phases 3-8 add thousands of bytes of genuine consent
// kernel. A criterion that every subsequent phase violates is a criterion that
// gets quietly dropped — and a dropped criterion is worse than an absent one,
// because the requirement still reads as covered.
//
// The hard fact that settles it: the shipped dist/index.d.ts opens with
//   import { StandardSchemaV1 } from "@standard-schema/spec";
// so the dependency edge is REAL. It stays in `dependencies` and must not be
// "fixed" into `devDependencies` — that would break types resolution for every
// consumer of the published package. What is zero is its *runtime*
// contribution, not its existence.
//
// The success sentence this script prints is the claim, deliberately worded so
// it cannot be misread as "core has no deps":
//   core's dependencies contribute zero bytes to a consumer bundle
//
// ============================================================================
// WHY THIS MEASURES THE ARTIFACT AND NOT THE MANIFEST
// ============================================================================
//
// 02-CONTEXT.md rules a manifest-only check insufficient: "zero runtime bytes"
// is a claim about what lands in a CONSUMER BUNDLE, and a manifest cannot see
// vendor code that a bundler has already inlined. So Assertion A bundles the
// built artifact and inspects the resulting module graph. Assertion B keeps the
// manifest reading as a second, cheaper, far more legible signal — when someone
// adds a dependency, "typescript: 8000000 bytes" is a better error than a
// module-graph diff. Neither is sufficient alone; both must pass.
//
// ============================================================================
// WHY THE ESM CONDITION AND NOT require.resolve()
// ============================================================================
//
// Assertion B resolves each dependency through the ESM ("import") condition,
// not through createRequire().resolve(). Measured on this tree:
//
//   require.resolve("@standard-schema/spec")
//     -> .../dist/index.cjs   754 bytes
//   ESM condition (exports["."].import.default)
//     -> .../dist/index.js      0 bytes
//
// @standard-schema/spec is dual-published, so require.resolve() does not throw
// — it silently resolves the CJS entry and would report 754 bytes on a
// perfectly clean tree. Core is ESM-only (`type: "module"`, no `require`
// condition in its own exports), so no consumer can reach that CJS file
// THROUGH core. The bytes a consumer bundler actually pulls in are the ones
// behind the `import` condition. Measuring the wrong file here would have made
// the clean baseline red, and the tempting "fix" — relaxing the assertion to
// "small enough" — would have destroyed the guard on day one.
//
// `types` is deliberately excluded from the condition set: it resolves to a
// .d.ts, which is not runtime. `require` is excluded for the reason above.
//
// Usage:
//   node scripts/pkg05-zero-runtime-deps.mjs <entry> [manifest]
//
// Exits 0 when both assertions hold, 1 otherwise, naming which one failed.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { rolldown } from "rolldown";

const entry = process.argv[2];

// No default entry, deliberately. The research snippet defaulted to
// "./dist/index.js"; run from the repo root that path does not exist, and
// rolldown's failure would be reported as a finding about the artifact rather
// than as a caller mistake.
if (!entry) {
  console.error("usage: node scripts/pkg05-zero-runtime-deps.mjs <entry> [manifest]");
  console.error("  <entry>     built artifact to bundle, e.g. packages/concierge/dist/index.js");
  console.error("  [manifest]  package.json whose dependencies are sized");
  console.error("              (default: packages/concierge/package.json)");
  process.exit(1);
}

const manifestPath = resolve(process.argv[3] ?? "packages/concierge/package.json");

// Conditions a consumer's ESM bundler would activate, in the order Node's
// exports algorithm considers them: first key present in the set wins.
const ESM_CONDITIONS = new Set(["import", "module", "module-sync", "node", "default"]);
// Only used to annotate the output, never asserted on.
const CJS_CONDITIONS = new Set(["require", "node", "default"]);

function pickTarget(node, conditions) {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) {
    for (const branch of node) {
      const hit = pickTarget(branch, conditions);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === "object") {
    for (const [condition, sub] of Object.entries(node)) {
      if (!conditions.has(condition)) continue;
      const hit = pickTarget(sub, conditions);
      if (hit) return hit;
    }
  }
  return null;
}

// `exports` may be a bare string, a conditions object, or a subpath map. Only a
// subpath map has "."-prefixed keys.
function mainExportNode(exports) {
  if (exports == null) return null;
  if (typeof exports === "string" || Array.isArray(exports)) return exports;
  const keys = Object.keys(exports);
  if (keys.some((key) => key.startsWith("."))) return exports["."] ?? null;
  return exports;
}

// Node's own package-location walk. Used instead of require.resolve because it
// is condition-independent — it finds the directory, not an entry — and because
// it works under pnpm's strict node_modules layout, where the dependency is
// symlinked into packages/concierge/node_modules and is NOT hoisted to the root.
function findPackageDir(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const list = (values) => (values.length === 0 ? "[]" : values.join(", "));

// ---------------------------------------------------------------------------
// Assertion A (PKG-05a) — the module graph of the built artifact
// ---------------------------------------------------------------------------
async function assertModuleGraph(entryPath) {
  console.log("Assertion A (PKG-05a) — module graph of the built artifact");

  if (!existsSync(entryPath)) {
    console.log(`  entry does not exist: ${entryPath} (has the package been built?)`);
    console.log("vendored modules: <not measured>");
    console.log("unbundled external imports: <not measured>");
    return false;
  }

  let output;
  try {
    const bundle = await rolldown({ input: entryPath, platform: "neutral", onwarn() {} });
    ({ output } = await bundle.generate({ format: "es" }));
    await bundle.close();
  } catch (error) {
    console.log(`  rolldown could not bundle the entry: ${String(error.message).split("\n")[0]}`);
    console.log("vendored modules: <not measured>");
    console.log("unbundled external imports: <not measured>");
    return false;
  }

  const chunks = output.filter((item) => item.type === "chunk");
  if (chunks.length === 0) {
    console.log("  rolldown produced no chunk");
    console.log("vendored modules: <not measured>");
    console.log("unbundled external imports: <not measured>");
    return false;
  }

  // Every chunk, not just the first. A dependency reached through a dynamic
  // import lands in a SECOND chunk, and a first-chunk-only reading would call
  // that clean.
  const emitted = new Set(output.map((item) => item.fileName));
  const modules = chunks.flatMap((chunk) => Object.keys(chunk.modules ?? {}));
  const vendored = modules.filter((id) => id.includes("node_modules"));
  const externals = [
    ...new Set(
      chunks.flatMap((chunk) => [
        ...(chunk.imports ?? []),
        // A dynamic import of an internal module names an emitted chunk file;
        // anything else is a real external edge.
        ...(chunk.dynamicImports ?? []).filter((id) => !emitted.has(id)),
      ]),
    ),
  ];

  console.log(`  chunks: ${chunks.length}`);
  console.log(`  modules in graph: ${modules.length}`);
  for (const id of modules) console.log(`    ${id}`);
  console.log("vendored modules:", list(vendored));
  console.log("unbundled external imports:", list(externals));

  return vendored.length === 0 && externals.length === 0;
}

// ---------------------------------------------------------------------------
// Assertion B (PKG-05b) — byte size of each dependency's ESM runtime entry
// ---------------------------------------------------------------------------
function assertDependencyBytes(manifestFile) {
  console.log("Assertion B (PKG-05b) — ESM runtime entry byte size of each dependency");

  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  const dependencies = Object.keys(manifest.dependencies ?? {});

  if (dependencies.length === 0) {
    console.log("  dependencies: none declared");
    return true;
  }

  let ok = true;
  for (const name of dependencies) {
    const packageDir = findPackageDir(name, dirname(manifestFile));
    if (!packageDir) {
      console.log(`  ${name}  NOT INSTALLED — no node_modules/${name} above ${dirname(manifestFile)}`);
      ok = false;
      continue;
    }

    const own = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
    const fromExports = pickTarget(mainExportNode(own.exports), ESM_CONDITIONS);
    const target = fromExports ?? own.module ?? own.main ?? "./index.js";
    const source = fromExports
      ? 'exports["."]'
      : own.module
        ? "module"
        : own.main
          ? "main"
          : "implicit ./index.js";

    const entryFile = resolve(packageDir, target);
    if (!existsSync(entryFile)) {
      console.log(`  ${name}  ENTRY MISSING — ${source} points at ${target}, which does not exist`);
      ok = false;
      continue;
    }

    const bytes = statSync(entryFile).size;
    console.log(`  ${name}  ${bytes} bytes`);
    console.log(`    resolved via ${source} -> ${relative(process.cwd(), entryFile)}`);

    // Annotation only. Recorded so nobody later finds a non-zero CJS sibling and
    // concludes the check is lying: core is ESM-only, so that file is
    // unreachable through core.
    const cjsTarget = pickTarget(mainExportNode(own.exports), CJS_CONDITIONS);
    if (cjsTarget && cjsTarget !== target) {
      const cjsFile = resolve(packageDir, cjsTarget);
      const cjsBytes = existsSync(cjsFile) ? statSync(cjsFile).size : "missing";
      console.log(
        `    note: its \`require\` entry is ${cjsBytes} bytes and is unreachable through core, which is ESM-only`,
      );
    }

    if (bytes !== 0) ok = false;
  }

  return ok;
}

console.log("PKG-05 — core's runtime dependency footprint");
console.log(`  entry:    ${entry}`);
console.log(`  manifest: ${relative(process.cwd(), manifestPath)}`);
console.log("");

const graphOk = await assertModuleGraph(entry);
console.log(`  Assertion A: ${graphOk ? "PASS" : "FAIL"}`);
console.log("");

const bytesOk = assertDependencyBytes(manifestPath);
console.log(`  Assertion B: ${bytesOk ? "PASS" : "FAIL"}`);
console.log("");

// Both assertions always run, so one failure never hides the other's reading.
const failures = [];
if (!graphOk) failures.push("Assertion A (PKG-05a, module graph) — the artifact carries runtime bytes");
if (!bytesOk) failures.push("Assertion B (PKG-05b, dependency byte size) — a dependency is not zero-byte");

if (failures.length > 0) {
  for (const failure of failures) console.log(`FAIL: ${failure}`);
  process.exit(1);
}

console.log("core's dependencies contribute zero bytes to a consumer bundle");
process.exit(0);
