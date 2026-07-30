// Value exports survive into the built artifact.
//
// What escapes without this file:
//
// `verbatimModuleSyntax` is one-directional. It stops a type from being
// imported as a value, but it does not stop a VALUE from being moved into
// `index.ts`'s `export type { … }` block — and that edit looks like tidying.
// Measured under exactly that regression: the emit build exits 0, the
// `tsc -p tsconfig.test-d.json` program is silent, and both gates stay green,
// while `dist/index.js` quietly loses the runtime binding. A consumer's
// `import { MESSAGE_MAX_CHARS }` then resolves to `undefined` at runtime with
// no diagnostic anywhere in this repository.
//
// The type-level guard that catches this during editing (plan 02-11's
// `exports.test-d.ts`, which must import from `../src/index.js` and not from
// `../src/types.js`) costs ~0.08 s and fires on every keystroke-adjacent
// typecheck. This file catches the same defect at the level where it actually
// harms a consumer: the shipped artifact. Different sampling rates, same
// defect — neither replaces the other.
//
// Like every test in this directory, this one imports `../dist/index.js` and
// never `../src/`. The source cannot tell you what was emitted. (That mention
// of `../src/` is inside a comment; the acceptance check for this rule is
// scoped to non-comment lines.)

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);

beforeAll(() => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      `packages/concierge/dist/index.js is missing. These tests run against the ` +
        `BUILT artifact, not the source. Run \`pnpm build\` first.`,
    );
  }
});

describe("the built artifact still carries every value export", () => {
  it("MESSAGE_MAX_CHARS reaches dist/index.js as a value, at 180", async () => {
    const m = await import(DIST_URL.href);
    expect(m.MESSAGE_MAX_CHARS).toBe(180);
  });

  it("CONSENT_GRADE_ORDER reaches dist/index.js in ascending grade order", async () => {
    const m = await import(DIST_URL.href);
    expect(m.CONSENT_GRADE_ORDER).toEqual([
      "none",
      "delivered",
      "relayed",
      "attested",
    ]);
  });

  it("all three frozen constants are frozen in the artifact, not merely typed readonly", async () => {
    const m = await import(DIST_URL.href);

    // `Readonly<…>` is erased at emit. Only `Object.freeze` survives, and only
    // the frozen form actually stops a consumer mutating a shared constant.
    expect(Object.isFrozen(m.USER_CANCELLED)).toBe(true);
    expect(Object.isFrozen(m.USER_DECLINED)).toBe(true);

    // `CONSENT_GRADE_ORDER` is the third `Object.freeze` initializer in
    // `src/types.ts`, and until plan 03-08 it was the only one with no
    // frozenness assertion anywhere. The case above it asserts its VALUE with
    // `toEqual`, which passes whether or not the array is frozen — so a
    // `/* @__PURE__ */` annotation that wrongly dropped this particular freeze
    // would have left every suite in this repository green.
    //
    // The three `/* @__PURE__ */` annotations on those initializers are what
    // this line is the safety net for: the annotation tells a bundler the call
    // is side-effect-free and therefore droppable when its RESULT is unused. It
    // must never drop a freeze whose result IS used. If this goes red, the
    // annotation is wrong for this site — revert the annotation, do not weaken
    // this assertion.
    expect(Object.isFrozen(m.CONSENT_GRADE_ORDER)).toBe(true);
  });

  it("CONTRACT_VERSION reaches dist/index.js as the integer 1", async () => {
    const m = await import(DIST_URL.href);
    expect(m.CONTRACT_VERSION).toBe(1);
  });

  it("assertSingleInstance reaches dist/index.js as a callable function", async () => {
    const m = await import(DIST_URL.href);

    // A guard exported as `undefined` is the failure mode PKG-04 cannot
    // tolerate: every call site would be a silent no-op rather than an error.
    expect(typeof m.assertSingleInstance).toBe("function");
  });

  it("defineAction reaches dist/index.js as a callable function", async () => {
    const m = await import(DIST_URL.href);

    // `defineAction` is identity at runtime, so an `undefined` export is not a
    // crash a consumer can read — `defineAction({…})` throws
    // `TypeError: defineAction is not a function` only at the declaration site,
    // which in most apps is module scope. It reads as "the package is broken",
    // not "one export moved into the type block", which is what it is.
    expect(typeof m.defineAction).toBe("function");
  });

  it("buildCatalog reaches dist/index.js as a callable function", async () => {
    const m = await import(DIST_URL.href);

    // The entire build-time validation surface is behind this one binding. Lost
    // to the `export type { … }` block, every rule in `catalog.ts` — SEC-01's
    // redaction requirement, CAT-02's root-object check, the duplicate-name
    // check — stops running, and the only symptom is a call that never happens.
    expect(typeof m.buildCatalog).toBe("function");
  });

  it("CatalogValidationError reaches dist/index.js as a constructible class", async () => {
    const m = await import(DIST_URL.href);

    // A class is a value AND a type, which is exactly what makes it the easiest
    // of the four to move into the type block by accident: the `export type`
    // form compiles, and `catch (e) { if (e instanceof CatalogValidationError) }`
    // in consumer code then becomes `instanceof undefined` — a TypeError raised
    // while handling the real error, so the developer sees the wrong failure.
    expect(typeof m.CatalogValidationError).toBe("function");
    expect(Object.getPrototypeOf(m.CatalogValidationError)).toBe(Error);
  });

  it("JSON_SCHEMA_TARGET reaches dist/index.js as the draft-2020-12 string", async () => {
    const m = await import(DIST_URL.href);

    // Unlike the three functions above, this one degrades quietly: `undefined`
    // flows into `options?.jsonSchemaTarget ?? JSON_SCHEMA_TARGET` at a consumer
    // call site and reaches the vendor's converter as an undefined target, where
    // zod silently emits without `$schema` and arktype throws `ParseError`.
    expect(m.JSON_SCHEMA_TARGET).toBe("draft-2020-12");
  });
});
