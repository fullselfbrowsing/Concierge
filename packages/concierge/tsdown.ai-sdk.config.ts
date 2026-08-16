import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/ai-sdk/index.ts",
    "src/ai-sdk/server.ts",
    "src/ai-sdk/browser.ts",
    "src/ai-sdk/server-unavailable.ts",
  ],
  format: ["esm"],
  platform: "neutral",
  dts: true,
  clean: false,
  outDir: "dist/ai-sdk",
  tsconfig: "tsconfig.ai-sdk.json",
  deps: {
    neverBundle: ["@full-self-browsing/concierge", "ai"],
  },
  // The telemetry build runs these gates after every package export exists.
  publint: false,
  attw: false,
});
