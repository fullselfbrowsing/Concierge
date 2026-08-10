import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/client.tsx"],
  format: "esm",
  platform: "neutral",
  dts: true,
  clean: true,
  outDir: "dist",
  external: ["@fullselfbrowsing/concierge", "react", "react-dom"],
  banner: ({ fileName }) =>
    fileName === "client.js" || fileName.endsWith("/client.js")
      ? '"use client";'
      : undefined,
  publint: { level: "error" },
  attw: { level: "error", profile: "esm-only" },
});
