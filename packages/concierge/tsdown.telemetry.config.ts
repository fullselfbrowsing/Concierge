import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/telemetry/index.ts"],
  format: ["esm"],
  platform: "browser",
  dts: true,
  clean: false,
  outDir: "dist/telemetry",
  tsconfig: "tsconfig.telemetry.json",
  deps: {
    neverBundle: ["@full-self-browsing/concierge"],
  },
  publint: { level: "error" },
  attw: { level: "error", profile: "esm-only" },
});
