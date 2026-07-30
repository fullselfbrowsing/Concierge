// PKG-04 — the duplicate-instance guard, asserted against the BUILT artifact.
//
// What escapes without this file:
//
// This package ships `"sideEffects": false`, which licenses a bundler to delete
// a module's evaluation outright. Measured with rolldown 1.2.0: a duplicate
// detector written at module scope is deleted from every bundled consumer EVEN
// WHEN that consumer imports a binding from the same module, because the
// constant is inlined and the module's evaluation is then dropped entirely.
// Such a guard still runs under `node dist/index.js`, so it tests green here
// and does nothing in a real React or Svelte app — which is the only place two
// independently-resolved copies of core can collide, and therefore the only
// place the guard was ever needed.
//
// The consequence for this file is one hard structural rule: every assertion
// below runs against `../dist/index.js`, never against `../src/`. A test
// against `../src/` cannot observe tree-shaking and would pass forever. (Both
// mentions of `../src/` in this file are inside comments; the acceptance check
// for this rule is scoped to non-comment lines precisely so this paragraph can
// name the thing it forbids.)
//
// F1a alone does not close the hole. Research measured that the naive
// module-scope form does survive into `dist/index.js`, so under Node it still
// registers and F1a still passes. What it does not survive is BUNDLING. F1b
// therefore bundles two synthetic consumers with rolldown and asserts on the
// emitted code — it is the only assertion in this repository that can see the
// difference, and mutant P6 exists to prove it fires.
//
// ---------------------------------------------------------------------------
// F4 — the guard now has a PRODUCTION call site, and the three cases above
// cannot see whether it still does
// ---------------------------------------------------------------------------
//
// F1a, F1b and F2 all call `assertSingleInstance()` THEMSELVES. So a
// `buildCatalog` that stopped calling it — an edit that looks like removing a
// redundant line — leaves every one of them green while the guard goes back to
// being armed and never fired. That is not a hypothetical regression: it is the
// state Phase 2 actually shipped in. `02-VERIFICATION.md` finding W5 measured
// that EVERY invocation in the repository was a test, a harness, a fixture
// re-export or CI (`single-instance.test.ts`, `artifact.test.ts`,
// `scripts/node-floor-check.sh`, `.github/workflows/ci.yml`), and
// `src/contract.ts` said so outright: "There is no call site in this phase."
//
// ROADMAP Phase 3 SC-5 carries that finding forward — "`assertSingleInstance`
// is called from the first entry point a consumer actually reaches, not only
// from tests" — and Phase 3 supplies the call site, on `buildCatalog`'s first
// line. F4 below is what makes its removal fail something.
//
// F4 asserts in BOTH directions on purpose. That the registry is EMPTY right
// after the import is a check in its own right, not setup: it proves there is
// no module-scope registration, which 02-06 measured would be deleted outright
// from a bundled consumer under `sideEffects: false` while still running under
// `node dist/index.js`. A guard hoisted to module scope would make the second
// half of F4 pass while doing nothing in every React or Svelte app.
//
// The guard now has TWO production call sites, not one. Phase 4 ships
// `createConcierge`, which records this copy as well, and the last case in this
// file, F5, is what makes ITS removal fail something. F4 cannot: it drives
// `buildCatalog` directly, so a `createConcierge` that stopped reaching the
// guard would leave F4 — and every case above it — green.
//
// **That case does not claim the call is DIRECT, and must not be read as
// claiming it.** It passes whether `createConcierge` invokes
// `assertSingleInstance` itself or reaches it transitively through
// `buildCatalog` on its first line. The latitude is deliberate: either route
// satisfies PKG-04 equally, and Phase 4 took the transitive one, because a
// second direct call is a documented no-op through `src/contract.ts`'s
// same-version adopt path. Recording that here stops a reader inferring a
// direct call which does not exist — and stops someone "restoring" one when
// they go looking for it and cannot find it.

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { rolldown } from "rolldown";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

// The built artifact, addressed two ways: as a URL for dynamic import (so a
// query string can force a second module evaluation) and as an absolute
// filesystem path (so a synthetic consumer can import it by a specifier a
// bundler resolves).
const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_HREF = DIST_URL.href;
const DIST_PATH = fileURLToPath(DIST_URL);

// Hard-coded, not imported. The registry key is a cross-realm contract between
// two copies of this package that share no bindings, so its identity is the
// STRING and nothing else. Importing the symbol from the artifact under test
// would make this suite agree with whatever the artifact happens to say.
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");

type Registry = Record<symbol, { version: number } | undefined>;

const registry = globalThis as unknown as Registry;

// Temp directories created by F1b, removed unconditionally after every test so
// that a failing assertion cannot leak one.
let scratchDirs: string[] = [];

beforeAll(() => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      `packages/concierge/dist/index.js is missing. These tests run against the ` +
        `BUILT artifact, not the source. Run \`pnpm build\` first.`,
    );
  }
});

// `delete`, not assignment to `undefined`: `assertSingleInstance` branches on
// `prior === undefined`, and the property must also be genuinely absent for a
// `toEqual` against the whole record to be meaningful. The slot is a plain
// data property for exactly this reason — defining it non-configurable would
// leave the suite unable to reset itself between tests.
beforeEach(() => {
  delete registry[KEY];
});

afterEach(() => {
  for (const dir of scratchDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  scratchDirs = [];
});

// Bundle one synthetic consumer and return the emitted ES module source.
// `platform: "neutral"` matches how a framework app bundles this package, and
// `onwarn` is silenced so an unresolved-warning does not colour the output of
// a test whose entire subject is what the emitted code contains.
async function bundleConsumer(source: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "concierge-treeshake-"));
  scratchDirs.push(dir);

  const entry = join(dir, "consumer.mjs");
  writeFileSync(entry, source, "utf8");

  const bundle = await rolldown({
    input: entry,
    platform: "neutral",
    onwarn() {},
  });
  const { output } = await bundle.generate({ format: "es" });
  await bundle.close();

  return output[0].code;
}

describe("PKG-04 — one core instance across two independently-resolved copies", () => {
  it("F1a — two adapters resolving core independently converge on one registry record", async () => {
    // Two module evaluations of the same file. The query string is what makes
    // the second one genuine: it defeats Node's ESM module cache and produces
    // exactly the pair of distinct namespaces two `node_modules` copies do.
    const alpha = await import(DIST_HREF);
    const beta = await import(`${DIST_HREF}?dup=1`);

    expect(alpha).not.toBe(beta);
    expect(alpha.assertSingleInstance).not.toBe(beta.assertSingleInstance);

    alpha.assertSingleInstance();
    beta.assertSingleInstance();

    // One record, not two — the same-version path adopts rather than throws,
    // which is what "share one core instance" means operationally.
    expect(registry[KEY]).toEqual({ version: alpha.CONTRACT_VERSION });
  });

  it("F1b — the registry reaches a calling bundle and contributes zero bytes to one that does not call", async () => {
    // The consumer that calls the guard. A bundler may not delete this: the
    // call is reachable from the entry.
    const calls = await bundleConsumer(
      `import { assertSingleInstance } from ${JSON.stringify(DIST_PATH)};\n` +
        `assertSingleInstance();\n`,
    );

    // The consumer that never calls it, re-exporting a constant so that the
    // bundle is not empty for a trivial reason.
    const uncalled = await bundleConsumer(
      `import { MESSAGE_MAX_CHARS } from ${JSON.stringify(DIST_PATH)};\n` +
        `export { MESSAGE_MAX_CHARS };\n`,
    );

    // Asserted in opposite directions, and both directions are load-bearing.
    //
    // Present: the guard survives into a real consumer bundle, which is the
    // whole reason it lives inside a function body instead of at module scope.
    expect(calls).toContain("@fullselfbrowsing/concierge.contract");

    // Absent: the executable form of the measured claim that the registry code
    // itself contributes ZERO bytes when it is not called. The uncalled bundle
    // is not empty — it still carries the constant it imports — but none of
    // those bytes are the registry's. This is `sideEffects: false` being
    // honest in the direction that costs the package nothing.
    expect(uncalled).not.toContain("@fullselfbrowsing/concierge.contract");
  });

  it("F2 — a contract-version mismatch throws a message naming both versions and the remediation", async () => {
    // Exactly what a second, older copy of core would have left behind.
    registry[KEY] = { version: 0 };

    const { assertSingleInstance } = await import(`${DIST_HREF}?mismatch=1`);

    // Two expectations, not one. That the mismatch is DETECTED and that the
    // message is ACTIONABLE are distinct claims, and a message that named the
    // versions but not the fix would satisfy the first while leaving the
    // developer with nothing to do.
    expect(() => assertSingleInstance()).toThrow(/two different copies/);
    expect(() => assertSingleInstance()).toThrow(/peerDependency/);
  });

  it("F4 — buildCatalog records this copy in the registry on its first line, so the guard has a production call site", async () => {
    // A fresh query string, the same cache-busting idiom F1a and F2 use. Here
    // it is what makes the "empty after import" half meaningful: a specifier
    // Node has already evaluated would return the cached namespace without
    // re-running module scope, so the absence below would prove nothing.
    const { assertSingleInstance, buildCatalog, CONTRACT_VERSION } = await import(
      `${DIST_HREF}?sc5=1`
    );

    // Half one — EMPTY immediately after evaluation. This is the assertion that
    // catches a guard smuggled up to module scope, which is the form
    // `sideEffects: false` licenses a bundler to delete. `assertSingleInstance`
    // is destructured above and deliberately not called: importing a binding is
    // not invoking it.
    expect(typeof assertSingleInstance).toBe("function");
    expect(registry[KEY]).toBeUndefined();

    // The production path. An empty catalog is enough — the guard runs before
    // any declaration is looked at, which is the point of it being the first
    // statement rather than a step in the loop.
    buildCatalog([]);

    // Half two — POPULATED afterwards. Read through the same global record F1a
    // asserts on at :122, which is this suite's established observable; no spy
    // is introduced, because one already exists and reports exactly this.
    expect(registry[KEY]).toEqual({ version: CONTRACT_VERSION });
  });

  it("F5 — createConcierge records this copy too, so the guard's second production call site is asserted", async () => {
    // Its own query string, unique to this case. Every case that needs a fresh
    // module evaluation must use one nothing else in this file uses: two cases
    // sharing a specifier share Node's cached namespace, so the second would
    // skip module scope entirely and its "empty after import" half would be
    // asserting against state the first case left behind. Same cache-busting
    // reason F4 states one case above.
    const { assertSingleInstance, createConcierge, CONTRACT_VERSION } = await import(
      `${DIST_HREF}?sc6=1`
    );

    // Half one — EMPTY immediately after evaluation, and this half is a check in
    // its own right rather than setup: it is what catches a guard smuggled up to
    // module scope, the form `sideEffects: false` licenses a bundler to delete.
    // `assertSingleInstance` is destructured above and deliberately NOT called —
    // importing a binding is not invoking it, and calling it here would populate
    // the registry itself and make half two pass no matter what the factory does.
    expect(typeof createConcierge).toBe("function");
    expect(registry[KEY]).toBeUndefined();

    // The production path, at its minimum. `stages` is a REQUIRED member of
    // `ConciergeConfig`, so an empty array is the smallest legal config; a config
    // with no stages and no `crossStage` builds an empty catalog, which is enough
    // because the guard runs before any declaration is looked at.
    createConcierge({ stages: [] });

    // Half two — POPULATED afterwards, through the same global record F1a and F4
    // assert on. No spy: the observable already exists and reports exactly this.
    expect(registry[KEY]).toEqual({ version: CONTRACT_VERSION });
  });
});
