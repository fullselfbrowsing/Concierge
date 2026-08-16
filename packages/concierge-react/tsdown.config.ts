import { defineConfig } from "tsdown";

const CLIENT_DIRECTIVE = '"use client";';

export default defineConfig({
  entry: ["src/index.ts", "src/client.tsx"],
  format: "esm",
  platform: "neutral",
  dts: true,
  clean: true,
  outDir: "dist",
  deps: {
    neverBundle: [
      "@full-self-browsing/concierge",
      "@full-self-browsing/concierge/telemetry",
      "react",
      "react-dom",
    ],
  },
  plugins: [
    {
      name: "strip-source-client-directive",
      transform: (code, id, meta) => {
        if (
          !id.endsWith("/src/client.tsx") ||
          !code.startsWith(CLIENT_DIRECTIVE)
        ) {
          return undefined;
        }

        return {
          code: meta.magicString?.remove(0, CLIENT_DIRECTIVE.length),
        };
      },
    },
  ],
  banner: ({ fileName }) =>
    fileName === "client.js" || fileName.endsWith("/client.js")
      ? CLIENT_DIRECTIVE
      : undefined,
  publint: { level: "error" },
  attw: { level: "error", profile: "esm-only" },
});
