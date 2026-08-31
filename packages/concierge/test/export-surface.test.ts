// The shipped public export surface, pinned by count and by name.
//
// What escapes without this file:
//
// This is the only check in the repository that would catch an export dropped
// or added by a BUILD CONFIG change rather than by a source change. Every
// other guard reads the source: the type-test program compiles `../src/`, and
// a source-level review sees `index.ts`. A different `tsdown` entry, a changed
// `dts` strategy, or a rolldown upgrade that alters how the declaration bundle
// is assembled can move the published surface without touching a single line
// of `../src/`, and nothing else here would notice. (Both mentions of
// `../src/` above are inside comments; the acceptance check for the
// no-source-imports rule is scoped to non-comment lines.)
//
// A separate file from `artifact.test.ts` on purpose: `02-VALIDATION.md` names
// `pnpm test -- export-surface` as this guard's command, and Vitest filters by
// filename.
//
// ---------------------------------------------------------------------------
// Trap 1 — assert absence from the EXPORT LIST, never from the file
// ---------------------------------------------------------------------------
//
// `serverChallengeBrand` and `ConsentAckBase` ARE present in `dist/index.d.ts`
// as declarations. That is correct, not a leak: rolldown bundles the whole
// declaration file, and only the trailing `export { … }` statement defines
// what a consumer can import. A guard that asserted their absence from the
// FILE would fail on a perfectly correct artifact — and the obvious "fix" for
// that red test is to weaken the guard. So the assertions below read the
// parsed export list and nothing else.
//
// ---------------------------------------------------------------------------
// Trap 2 — `ReadbackAttestation` is recorded here and deliberately NOT
// asserted
// ---------------------------------------------------------------------------
//
// `ReadbackAttestation` has ZERO occurrences in `types.ts`. The identifier does
// not exist anywhere in this package. A guard asserting that it is not exported
// therefore passes vacuously, forever, no matter what the artifact contains —
// and it reads in a diff and in a test report exactly like coverage.
// `02-VALIDATION.md` names this explicitly: it must not be counted as a passing
// check.
//
// So it is written down here instead of being written as an assertion. The two
// real names above are asserted; this third one is not, because there is
// nothing for it to prove. If a future phase introduces a type by that name,
// this comment is the place that says why the guard was missing.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const DTS_URL = new URL("../dist/index.d.ts", import.meta.url);
const DTS_PATH = fileURLToPath(DTS_URL);

// Matches a bare trailing `export { … };` statement and deliberately not the
// `export { … } from "…";` re-export form — only the bare statement defines
// the surface of a bundled declaration file.
const EXPORT_BLOCK = /^export\s*\{([^}]*)\}\s*;?\s*$/gm;

interface Surface {
  readonly blocks: number;
  readonly names: readonly string[];
  readonly values: readonly string[];
  readonly types: readonly string[];
}

// Plan 02-06 measured this build emitting exactly ONE trailing block after a
// second source module was added, so no union is needed today. The union is
// written anyway: a future entry or dts-strategy change could split it, and a
// parser that silently read only the first block would under-report the
// surface — which is the same class of silently-passing guard this file exists
// to prevent.
function readSurface(): Surface {
  const source = readFileSync(DTS_PATH, "utf8");
  const blocks = [...source.matchAll(EXPORT_BLOCK)];

  if (blocks.length === 0) {
    throw new Error(
      `no trailing \`export { … };\` statement found in dist/index.d.ts — ` +
        `the parser, not the surface, is what changed. Inspect the artifact ` +
        `before adjusting the expected count.`,
    );
  }

  const entries = blocks
    .flatMap((block) => block[1].split(","))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return {
    blocks: blocks.length,
    names: entries.map((entry) => entry.replace(/^type\s+/, "")),
    values: entries.filter((entry) => !/^type\s/.test(entry)),
    types: entries
      .filter((entry) => /^type\s/.test(entry))
      .map((entry) => entry.replace(/^type\s+/, "")),
  };
}

// The third `it` title below states this list's LENGTH and its assertion is a
// `for…of` loop carrying no number at all. So a reviewer checking "does the
// title match the assertion beneath it" structurally cannot catch a stale
// number there — the only thing it can be checked against is this array. Grow
// one, reread the other.
const VALUE_EXPORTS = [
  "USER_CANCELLED",
  "USER_DECLINED",
  "CONSENT_GRADE_ORDER",
  "MESSAGE_MAX_CHARS",
  "DEFAULT_ACTION_DATA_MAX_BYTES",
  "CONTRACT_VERSION",
  "assertSingleInstance",
  "JSON_SCHEMA_TARGET",
  "defineAction",
  "buildCatalog",
  // A class is both a value and a type. It must appear here, in the VALUE half
  // of the parsed surface, with no `type ` prefix — if it were ever re-exported
  // through the `export type { … }` block the parser would file it under types
  // and `new CatalogValidationError(…)` would be unreachable for a consumer.
  "CatalogValidationError",
  "createConcierge",
  "createSession",
  "createBridge",
  "captureSnapshot",
  "offPageResult",
];

const CONSENT_TYPE_EXPORTS = [
  "ConsentProfile",
  "ReadbackAttestation",
  "FailureOutcomeRow",
  "FailureOutcome",
  "OutcomePresentationReport",
  "OutcomeSink",
];

beforeAll(() => {
  if (!existsSync(DTS_PATH)) {
    throw new Error(
      `packages/concierge/dist/index.d.ts is missing. This guard reads the ` +
        `BUILT declaration file, not the source. Run \`pnpm build\` first.`,
    );
  }
});

describe("the published export surface of dist/index.d.ts", () => {
  it("is exactly 95 names — an export added or dropped by a build-config change lands here", () => {
    const { names } = readSurface();
    expect(names).toHaveLength(95);
  });

  it("splits 79 types to 16 values", () => {
    const { types, values } = readSurface();
    expect(types).toHaveLength(79);
    expect(values).toHaveLength(16);
  });

  it("carries all six consent evidence and outcome types by name", () => {
    const { types } = readSurface();
    for (const name of CONSENT_TYPE_EXPORTS) {
      expect(types).toContain(name);
    }
  });

  it("carries all sixteen runtime value exports by name", () => {
    const { values } = readSurface();
    for (const name of VALUE_EXPORTS) {
      expect(values).toContain(name);
    }
  });

  it("does not publish serverChallengeBrand or ConsentAckBase", () => {
    const { names } = readSurface();

    // Absence from the parsed list, per Trap 1 in this file's header. Both
    // identifiers are present in the artifact as declarations and asserting
    // otherwise would fail on a correct build.
    expect(names).not.toContain("serverChallengeBrand");
    expect(names).not.toContain("ConsentAckBase");
  });
});
