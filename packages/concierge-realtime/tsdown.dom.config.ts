import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/webrtc/index.ts", "src/websocket/index.ts"],
  format: ["esm"],
  platform: "browser",
  dts: true,
  clean: false,
  outDir: "dist",
  tsconfig: "tsconfig.dom.json",
  deps: {
    neverBundle: ["@full-self-browsing/concierge"],
  },
  publint: { level: "error" },
  attw: { level: "error", profile: "esm-only" },
});
