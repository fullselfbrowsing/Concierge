import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "neutral",
  dts: true,
  clean: true,
  outDir: "dist",
  deps: {
    neverBundle: ["@full-self-browsing/concierge"],
  },
  publint: { level: "error" },
  attw: { level: "error", profile: "esm-only" },
});
