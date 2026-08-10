// Root Vitest configuration — the repository's first runtime test runner.
//
// Before this file, `pnpm test` ran `pnpm -r test` against a workspace whose
// only package declared no `test` script, so pnpm exited **0 with no output**.
// A silently green test command is the signal a CI author wires up and trusts
// most, and it is the easiest one to produce by accident. Wiring this is not
// cleanup; it is the difference between CI meaning something and not.

import { svelte as createSveltePlugin } from "@sveltejs/vite-plugin-svelte";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

function svelte({ hot }: { readonly hot: boolean }) {
  return createSveltePlugin({
    configFile: false,
    compilerOptions: { hmr: hot },
  });
}

// ---------------------------------------------------------------------------
// The line that looks wrong and is right: typecheck mode stays OFF
// ---------------------------------------------------------------------------
//
// This is commented for the same reason `tsconfig.test-d.json` names TS6059 at
// its `rootDir` override — the setting is non-obvious, and the diagnostic that
// fires when you get it wrong is worth writing down once.
//
// Vitest 4's `typecheck.include` defaults to a `-d` suffixed glob
// (`*.{test,spec}-d.?(c|m)[jt]s?(x)` under any directory), which MATCHES all
// four of Phase 1's `test-d/*.test-d.ts` files. Those files contain no
// `describe` and no `it`, and they are compiled by `tsconfig.test-d.json` — a
// program Vitest does not know about. Enabling typecheck mode collects them,
// errors inside `startTypechecker`, and exits 1.
//
// Vitest's default `test.include` does NOT match `*.test-d.ts`, which is
// precisely why the two suites coexist safely as long as this stays off.
//
// The type-level suite therefore stays under `tsc -p tsconfig.test-d.json`,
// where the ROADMAP puts it ("type tests run under `tsc --noEmit` over
// `*.test-d.ts` with `@ts-expect-error`, not Vitest's `expectTypeOf`"), and
// where it costs ~0.08 s for the whole program under TypeScript 7.0.2.

// ---------------------------------------------------------------------------
// A deliberate divergence: the runner is centralized, the builder is not
// ---------------------------------------------------------------------------
//
// `tsdown.config.ts` is package-local and root `build` stays `pnpm -r build`,
// so every package declares its own builder. That is a structural guard, not
// duplication: it is what stops a future `concierge-svelte` from being swept
// into tsdown and having its runes pre-bundled.
//
// The runner has no such hazard — a test runner does not decide what ships —
// so it is centralized here with explicit, non-overlapping projects. One
// runner, per-package builders. The divergence is intentional; do not
// "consolidate" either half toward the other.

// ---------------------------------------------------------------------------
// An accepted, named limitation: `packages/concierge/test/` is in NO
// TypeScript program
// ---------------------------------------------------------------------------
//
// `packages/concierge/tsconfig.json` includes `["src/**/*.ts"]` and
// `tsconfig.test-d.json` includes `["src/**/*.ts", "test-d/**/*.ts"]`. Neither
// covers `test/`. Vitest transpiles without typechecking, so a type error in
// `single-instance.test.ts`, `artifact.test.ts`, `export-surface.test.ts` or
// `fixtures.test.ts` is invisible to `pnpm typecheck` and surfaces only as a
// runtime failure under `vitest run`.
//
// This is accepted, not overlooked. Extending `tsconfig.test-d.json`'s
// `include` to `test/` was considered and rejected for three concrete reasons:
//
//   1. These files use `node:fs`, `node:os` and `node:path`. Typechecking them
//      requires `@types/node` in the package program, which CONTEXT.md locks
//      out — it pulls DOM-adjacent globals and silently defeats the no-DOM
//      guarantee that `lib: ["ES2022"]` enforces.
//   2. They import `../dist/index.js`, a real on-disk path. Including them
//      would make `pnpm typecheck` fail on a clean checkout until `pnpm build`
//      had run — inverting the `typecheck` before `build` order that mutant P4
//      exists to justify and that the CI workflow and the clean-checkout gate
//      both depend on.
//   3. `test/fixtures/probe.ts` imports `@fullselfbrowsing/concierge` by bare
//      specifier and is compiled by a FOREIGN program (the scratch project in
//      plan 02-09). Keeping `test/fixtures/` out of this repo's own program is
//      a feature, not an omission.
//
// Do not enable Vitest typecheck mode as a substitute — the comment above
// records why that breaks on `test-d/`. The residual is stated plainly:
// `vitest run` is the only thing that exercises these four files, and it runs
// in CI.

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["packages/concierge/test/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "node-artifact-ssr",
          environment: "node",
          include: [
            "packages/concierge-react/test/artifact.test.ts",
            "packages/concierge-svelte/test/artifact.test.ts",
            "examples/adapter-ssr/test/ssr.test.ts",
          ],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "react-lifecycle",
          environment: "jsdom",
          include: ["packages/concierge-react/test/lifecycle.test.tsx"],
        },
      },
      {
        plugins: [svelte({ hot: false })],
        test: {
          name: "svelte-lifecycle",
          environment: "jsdom",
          include: ["packages/concierge-svelte/test/lifecycle.test.ts"],
        },
      },
    ],
  },
});
