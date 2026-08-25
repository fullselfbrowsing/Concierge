/**
 * Build config for the ESM-only, runtime-neutral package root. Optional AI SDK
 * subpaths are emitted by dedicated builds; the final telemetry build then
 * validates the complete package with Publint and ATTW.
 *
 * This file is package-local **deliberately**, not by omission. The root script
 * stays `pnpm -r build` so that every package declares its own builder. That is
 * the structural guard against a future `concierge-svelte` being swept into
 * tsdown and having its runes pre-bundled: pre-bundled runes produce code that
 * runs and is not reactive, with no error and no warning at build or at runtime.
 * Hoisting this config to the repo root looks like removing duplication and is
 * the bug — the adapter needs `svelte-package`, not this.
 */
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/openai-realtime/index.ts"],
  // ESM only, not dual. The dual-package hazard is unusually expensive for this
  // design: two core instances null the bridge registry, split the dedup window
  // so a retried call double-fires, and hide consent armed on one instance from
  // the other. Locked decision — see 02-CONTEXT.md "Locked upstream".
  format: ["esm"],
  // Core must construct on the server under Next / Nuxt / SvelteKit with no
  // environment guards, so the bundle may assume neither Node nor DOM globals.
  platform: "neutral",
  dts: true,
  clean: true,
  outDir: "dist",
  // The optional-subpath build runs these gates after every export target
  // exists. Running them here would inspect a deliberately incomplete package.
  publint: false,
  attw: false,
});
