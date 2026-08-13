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
    neverBundle: ["@fullselfbrowsing/concierge", "ai"],
  },
  publint: { level: "error" },
  attw: { level: "error", profile: "esm-only" },
});
