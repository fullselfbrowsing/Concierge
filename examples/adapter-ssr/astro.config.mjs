import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  normalize,
  resolve,
} from "node:path";

import react from "@astrojs/react";
import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";

const OUTPUT_PREFIX = "concierge-adapter-ssr-";

function selectOutDir(requestedOutDir) {
  if (requestedOutDir === undefined) {
    return "./dist";
  }

  const resolvedOutDir = resolve(requestedOutDir);
  const isOwnedTemporaryRoot =
    requestedOutDir.length > 0 &&
    !requestedOutDir.includes("\0") &&
    isAbsolute(requestedOutDir) &&
    normalize(requestedOutDir) === requestedOutDir &&
    dirname(resolvedOutDir) === resolve(tmpdir()) &&
    basename(resolvedOutDir).startsWith(OUTPUT_PREFIX) &&
    basename(resolvedOutDir).length > OUTPUT_PREFIX.length;

  if (!isOwnedTemporaryRoot) {
    throw new Error(
      "ADAPTER_SSR_OUT_DIR must be an absolute, normalized mkdtemp root created with the concierge-adapter-ssr- prefix.",
    );
  }

  return resolvedOutDir;
}

export default defineConfig({
  output: "static",
  outDir: selectOutDir(process.env.ADAPTER_SSR_OUT_DIR),
  integrations: [react(), svelte()],
});
