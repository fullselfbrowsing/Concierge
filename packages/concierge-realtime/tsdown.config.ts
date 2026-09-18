import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/openai/index.ts"],
  format: ["esm"],
  platform: "neutral",
  dts: true,
  clean: true,
  outDir: "dist",
  deps: {
    neverBundle: [
      "@full-self-browsing/concierge",
      "@full-self-browsing/concierge/openai-realtime",
    ],
  },
  publint: false,
  attw: false,
});
