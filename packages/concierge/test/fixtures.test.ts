// PKG-04c — the packaging half of "a single core instance is shared across
// adapters", asserted against the INSTALL GRAPH rather than against a runtime.
//
// What escapes without this file:
//
// F1a, F1b and F2 in `single-instance.test.ts` are runtime guards, and every
// one of them would still pass if someone moved `@full-self-browsing/concierge`
// from `peerDependencies` to `dependencies` in every adapter. That edit is
// exactly the packaging regression that causes two physical copies to be
// installed — which splits the bridge registry, splits the dedup window, and
// splits the consent kernel, so consent armed on one copy is invisible to the
// other. No runtime assertion can see a manifest. This file is the only thing
// in the repository that can, and it is the one that stays meaningful in
// Phase 9 when real adapters replace these two fixtures.
//
// ---------------------------------------------------------------------------
// The peer range is weaker than CONTEXT.md assumes — measured
// ---------------------------------------------------------------------------
//
// CONTEXT.md records that "a peer range makes a version mismatch a loud
// install-time error". Measured against real tarballs, that holds for exactly
// one of three installers:
//
//   | Installer                        | Behaviour                                   | Exit     |
//   |----------------------------------|---------------------------------------------|----------|
//   | `npm install` (default)          | hard `ERESOLVE`                             | non-zero |
//   | `pnpm add` (default)             | prints `✕ unmet peer …` and installs anyway | 0        |
//   | `npm install --legacy-peer-deps` | silent                                      | 0        |
//
// The conclusion the threat register turns on, stated plainly: THE RUNTIME
// `CONTRACT_VERSION` CHECK IS PKG-04'S PRIMARY ENFORCEMENT, NOT ITS BACKSTOP.
// Two of the three installers above exit 0 while producing precisely the
// duplicate the peer range is imagined to prevent, and only
// `assertSingleInstance` fires under all three.
//
// The peer range is kept regardless, for two reasons. It catches the
// npm-default majority at install time; and, more importantly, it is the
// declaration that decides whether one copy or two are installed in the first
// place. This file guards that second, packaging half — that core is declared
// as a *peer*, and that it resolves to one physical directory — which no
// runtime assertion can observe.
//
// ---------------------------------------------------------------------------
// What this file does NOT prove
// ---------------------------------------------------------------------------
//
// Recorded in the style of `test-d/consent.test-d.ts:150-168`, because a check
// whose limits go unwritten gets read as proving more than it does.
//
//   1. Nothing about a PUBLISHED install graph. All three resolutions below go
//      through pnpm workspace symlinks — `pnpm-lock.yaml` records both fixtures
//      as `link:../../..`, never as a resolved registry tarball. A package that
//      resolves correctly when linked can still be broken once packed. The
//      published-install evidence lives in plan 02-09's pack-and-install
//      harness and plan 02-10's Node-floor CI job, and not here.
//   2. Nothing about peer-RANGE enforcement. Per the table above, this file
//      asserts only that a peer range is DECLARED. It never asserts that any
//      installer acted on one.
//   3. The lockfile is not a second witness. Adding these fixtures produced
//      exactly two new importer entries, and both record only the `workspace:*`
//      devDependency; the peer declaration leaves no distinct lockfile trace at
//      all. A peer-to-dependency move would therefore not show up in
//      `pnpm-lock.yaml` either. Assertion F3a below is the only thing in this
//      repository that catches it.
//
// One inherited limitation, restated so that it is not rediscovered: this file,
// like the three created alongside it, is in NO TypeScript program.
// `tsconfig.json` includes `["src/**/*.ts"]` and `tsconfig.test-d.json`
// includes `["src/**/*.ts", "test-d/**/*.ts"]`; neither covers `test/`. A type
// error here is invisible to `pnpm typecheck` and surfaces only under
// `vitest run`. `vitest.config.ts` records the three concrete reasons that
// `include` was deliberately not extended. Do not extend it here, and do not
// enable Vitest typecheck mode as a substitute.
//
// The structural rule inherited from `single-instance.test.ts` also holds here:
// every assertion runs against the built artifact and the installed graph,
// never against `../src/`. The acceptance check for that rule is scoped to
// non-comment lines, which is precisely why this paragraph may name the thing
// it forbids.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

// The name under test, written once. It is the string a real adapter puts in
// its own manifest, so it is also the string this file must read back.
const CORE_NAME = "@full-self-browsing/concierge";

// The two fixture adapters, as directory URLs. Each is a genuine workspace
// member: `pnpm-workspace.yaml` globs `packages/concierge/test/fixtures/*`
// specifically so that pnpm creates the `node_modules` link asserted below.
// Without that glob entry these directories are invisible to pnpm, no link
// exists, and F3b throws ENOENT rather than silently passing.
const ALPHA_DIR = new URL("./fixtures/adapter-alpha/", import.meta.url);
const BETA_DIR = new URL("./fixtures/adapter-beta/", import.meta.url);

// The core package's own directory — the third leg of F3b's equality.
const CORE_DIR = new URL("../", import.meta.url);

// The built artifact. The fixtures re-export from it by bare specifier, so its
// absence is a build-order problem rather than a test failure, and F3c's
// dynamic imports would otherwise fail with an opaque resolution error.
const DIST_PATH = fileURLToPath(new URL("../dist/index.js", import.meta.url));

const FIXTURES = [
  { label: "adapter-alpha", dir: ALPHA_DIR },
  { label: "adapter-beta", dir: BETA_DIR },
] as const;

interface FixtureManifest {
  readonly name?: string;
  readonly private?: boolean;
  readonly dependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

function manifestOf(dir: URL): FixtureManifest {
  const raw = readFileSync(new URL("package.json", dir), "utf8");
  return JSON.parse(raw) as FixtureManifest;
}

// The physical directory a fixture's own `node_modules` entry for core points
// at, with every symlink resolved. `realpathSync` is the whole point: pnpm
// links rather than copies, so the unresolved paths are trivially different
// and only the resolved ones answer "how many copies are installed".
function linkedCorePath(dir: URL): string {
  return realpathSync(fileURLToPath(new URL(`node_modules/${CORE_NAME}`, dir)));
}

beforeAll(() => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      `packages/concierge/dist/index.js is missing. The fixture adapters ` +
        `re-export from ${CORE_NAME}, which resolves through their ` +
        `node_modules link to that file. Run \`pnpm build\` first.`,
    );
  }
});

describe("PKG-04c — two adapters declaring core as a peer resolve to one core", () => {
  it("F3a — both fixtures declare core under peerDependencies and not under dependencies", () => {
    for (const { label, dir } of FIXTURES) {
      const manifest = manifestOf(dir);

      // The declaration that decides whether one copy or two get installed.
      expect(manifest.peerDependencies?.[CORE_NAME], label).toBeDefined();
      expect(manifest.peerDependencies?.[CORE_NAME], label).toMatch(/^workspace:/);

      // The regression this whole file exists to catch. Moving core into
      // `dependencies` installs a second physical copy per adapter, and every
      // runtime guard in this repository stays green while it happens.
      expect(manifest.dependencies ?? {}, label).not.toHaveProperty(CORE_NAME);

      // A fixture that is publishable is a supply-chain hazard rather than a
      // fixture. Asserted here, and not only in the plan's one-shot verify
      // block, so that the guarantee survives the plan that created it.
      expect(manifest.private, label).toBe(true);
    }
  });

  it("F3b — both node_modules links and the package itself are one physical directory", () => {
    const alpha = linkedCorePath(ALPHA_DIR);
    const beta = linkedCorePath(BETA_DIR);
    const core = realpathSync(fileURLToPath(CORE_DIR));

    // Three-way, not pairwise. Two links that agree with each other while
    // resolving somewhere other than the package under test would satisfy
    // `alpha === beta` and prove nothing at all about this repository.
    expect(alpha).toBe(beta);
    expect(alpha).toBe(core);
    expect(beta).toBe(core);
  });

  it("F3c — both fixtures import one function object, not two", async () => {
    const alpha = await import(new URL("index.js", ALPHA_DIR).href);
    const beta = await import(new URL("index.js", BETA_DIR).href);

    // Genuinely two different modules, resolving core independently.
    expect(alpha).not.toBe(beta);

    // ...and one core beneath them both. This is the positive control to F1a's
    // deliberate `?dup=1` negative: F1a forces two module evaluations to prove
    // the same-version branch ADOPTS, and this asserts that ordinary use never
    // produces the second evaluation in the first place, so that branch does
    // not fire spuriously.
    //
    // Identity, not deep equality. Two installed copies of core would produce
    // two structurally identical functions and two equal integers, and
    // `toEqual` cannot tell that apart from one shared instance.
    expect(alpha.assertSingleInstance).toBe(beta.assertSingleInstance);
    expect(alpha.CONTRACT_VERSION).toBe(beta.CONTRACT_VERSION);
  });
});
