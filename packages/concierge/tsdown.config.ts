/**
 * Build config for `@fullselfbrowsing/concierge` — ESM-only output plus two
 * artifact gates that are wired so they can actually fail a build.
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
  entry: ["src/index.ts"],
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
  // publint already exits 1 at tsdown's default level; the level is stated
  // rather than inherited so that a default change upstream cannot quietly
  // downgrade this from a gate to a report — which is exactly what `attw` does
  // below when its level is left alone.
  publint: { level: "error" },
  // REQUIRED, and both halves are load-bearing.
  //
  // `level: "error"` — writing `attw: true` instead makes tsdown print
  // "WARN [attw] problems found" and then exit **0** (measured on tsdown
  // 0.22.14 against a package with a real attw problem). At its default level
  // attw is a report, not a gate. `level: "error"` is the only thing that makes
  // it one, and believing otherwise is this phase's most likely silent failure:
  // CI stays green while a broken artifact reaches consumers.
  //
  // `profile: "esm-only"` — the default (`strict`) profile **fails a correct
  // ESM-only package**, reporting `CJS resolves to ESM` (node16-cjs) and node10
  // resolution failures. Those are the intended consequences of the locked
  // ESM-only decision above, not defects in this package. Deleting this line and
  // "fixing" the resulting red build by adding a CJS format would reverse a
  // locked decision in order to satisfy a misconfigured linter.
  attw: { level: "error", profile: "esm-only" },
});
