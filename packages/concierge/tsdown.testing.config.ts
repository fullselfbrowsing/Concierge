import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/testing/index.ts"],
  format: ["esm"],
  platform: "neutral",
  dts: true,
  clean: false,
  outDir: "dist/testing",
  tsconfig: "tsconfig.testing.json",
  deps: {
    neverBundle: ["@full-self-browsing/concierge"],
  },
  publint: false,
  attw: false,
});
