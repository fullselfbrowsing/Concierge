// CAT-02 and CAT-06 — schema emission, asserted against three REAL published
// validators rather than against hand-rolled fixtures.
//
// What escapes without this file:
//
// Every claim in this area is a claim about someone else's package, and the
// documentation is measurably wrong about one of them. `standardschema.dev`
// documents Valibot as implementing Standard JSON Schema; measured against
// valibot 1.4.2, `Object.keys(schema["~standard"])` is exactly
// `["version","vendor","validate"]` — there is no converter at all. That has
// now been measured twice, in Phase 1 and again in this phase. CAT-06's escape
// hatch is therefore not a convenience: it is the ONLY working path for one of
// the three validators this project targets, and a reviewer who deleted it on
// the strength of the docs would break a third of the supported surface with
// nothing in the type system noticing.
//
// CAT-02 is the same shape of problem pointed the other way. `z.discriminatedUnion`
// emits `{$schema, oneOf:[…]}` with NO root `type`. A transport then rejects
// the entire session update, so the agent silently loses every action in that
// stage — `types.ts:22-28` records the downstream symptom. A hand-written
// fixture asserting `{oneOf: […]}` would prove only that our check reads a
// field we ourselves wrote; it cannot reproduce the emitter that actually
// produces the shape, and it would keep passing after a zod upgrade changed it.
//
// So: real zod, real arktype, real valibot, driven through the real
// `buildCatalog`.
//
// ---------------------------------------------------------------------------
// The dist-only rule, inherited from the three sibling suites
// ---------------------------------------------------------------------------
//
// Every assertion below runs against `../dist/index.js`, never against the
// source tree. `single-instance.test.ts` records the reason in full — this
// package ships `"sideEffects": false` and a source-level assertion cannot
// observe what a bundler does to the shipped artifact. The `beforeAll` guard
// below fails loudly on a missing build rather than letting the suite report an
// opaque resolution error. (The one mention of `../src/` in this file is on
// this comment line; the acceptance check for that rule is scoped to
// non-comment lines, which is precisely why this paragraph may name it.)
//
// Like its three siblings, this file is in NO TypeScript program.
// `vitest.config.ts:48-80` records why `tsconfig.test-d.json` was deliberately
// not extended to cover `test/`. The practical consequence is used on purpose
// in one place below: case 8 hands `buildCatalog` a `jsonSchema` whose root is
// `type: "string"`, which the declared `JsonSchemaObject` would reject. No cast
// ceremony is needed, because no checker is looking — and the population that
// rule exists for is JavaScript consumers, who have no checker either.
//
// ---------------------------------------------------------------------------
// MEASURED — emitted root per schema shape, target "draft-2020-12"
// ---------------------------------------------------------------------------
//
// Re-measured in this session against the installed packages, through the real
// `emitSchema`, not read from documentation:
//
//   | Fixture                 | Emitted root keys (in order)                        | Root check |
//   |-------------------------|-----------------------------------------------------|------------|
//   | `zodObject`             | `$schema, type, properties, required`               | passes     |
//   | `zodEmptyObject`        | `$schema, type, properties` (`properties` is `{}`)  | passes     |
//   | `zodWithDefault`        | `$schema, type, properties, required`               | passes     |
//   | `zodRecord`             | `$schema, type, propertyNames, additionalProperties`| passes     |
//   | `arktypeObject`         | `$schema, type, properties, required`               | passes     |
//   | `arktypeEmptyObject`    | `$schema, type` — no `properties` at all            | passes     |
//   | `zodDiscriminatedUnion` | `$schema, oneOf` — NO `type`                        | FAILS      |
//   | `zodStringRoot`         | `$schema, type` where `type` is `"string"`          | FAILS      |
//   | `valibotObject`         | emits nothing — there is no converter               | n/a        |
//
// `$schema` is on EVERY row and it is the FIRST key. `03-RESEARCH.md:612-635`
// shows it only on the failing rows; that is incomplete, and the incompleteness
// is load-bearing rather than cosmetic, because `describeRoot` prints
// `Object.keys(emitted)` into the developer-facing diagnostic. `z.string()`
// therefore reports `keys: $schema, type`, not `keys: type` — which is exactly
// what case 1 asserts on. 03-02 corrected the in-source table against this
// measurement rather than adjusting the assertion to match the table.
//
// `zodRecord` is deliberately NOT imported here. Its root PASSES CAT-02, which
// is what makes it a redaction problem rather than an emission one; it belongs
// to SEC-01 and to `catalog.test.ts` (plan 03-06). It appears in the table only
// so that "passes CAT-02 while carrying no `properties`" is visible next to
// `arktypeEmptyObject`, which reaches the same place by a different route.
//
// ---------------------------------------------------------------------------
// MEASURED — target support, and why only two targets are covered
// ---------------------------------------------------------------------------
//
//   | Call                       | zod 4.4.3                        | arktype 2.2.3       |
//   |----------------------------|----------------------------------|---------------------|
//   | `.input()` — no argument   | works, defaults to 2020-12       | `TypeError` (bare)  |
//   | `{target:"draft-2020-12"}` | ok                               | ok                  |
//   | `{target:"draft-07"}`      | ok                               | ok                  |
//   | `{target:"openapi-3.0"}`   | ok, and silently drops `$schema` | `ParseError`        |
//   | `{target:"draft-04"}`      | ok                               | `ParseError`        |
//   | `{target:"nonsense"}`      | ok, and silently drops `$schema` | `ParseError`        |
//
// THE DELIBERATE NON-COVERAGE, written down rather than written as a test.
// Recorded in the style of `export-surface.test.ts:31-46`: a guard whose limits
// go unwritten gets read as proving more than it does.
//
// `openapi-3.0`, `draft-04` and every other target are NOT covered below, and
// that is a decision rather than an omission. The two emitting vendors disagree
// outside `{draft-2020-12, draft-07}`: zod silently emits for a target it does
// not understand — including a target that is simply a typo — while arktype
// throws `ParseError`. So the intersection both vendors support is exactly
// those two dialects, and a test asserting cross-vendor behaviour outside it
// would encode ONE vendor's tolerance as if it were Concierge's contract. The
// first arktype user to pass that target would then find a documented,
// test-covered option throwing at them. Cases 12 and 13 cover the intersection;
// nothing here covers the outside of it, on purpose.
//
// The practical trap this leaves in place, stated so it is not rediscovered: a
// typo'd `jsonSchemaTarget` is accepted by zod and produces a `$schema`-less
// object, so the divergence surfaces only on an arktype action.
//
// ---------------------------------------------------------------------------
// MUTATION PROOFS — which case is holding which rule down
// ---------------------------------------------------------------------------
//
// Each of the four mutants below was applied to `json-schema.ts` through
// `scripts/mutate-and-prove.sh`, gated on
// `pnpm build && pnpm test emission`, and observed to turn the listed cases
// RED. All four reported `PASS: gate fired (exit 1), tree clean`. This table is
// here rather than only in a summary because it is the answer to "can I relax
// this assertion?" — and the person asking that question is reading this file.
//
//   | Mutant   | What it changes in `json-schema.ts`         | Cases turned RED |
//   |----------|---------------------------------------------|------------------|
//   | M-03-4   | the hatch is consulted only when the         | 7, 8             |
//   |          | validator cannot derive (order reversed)     |                  |
//   | M-03-5   | `.input(` -> `.output(`                      | 9 ONLY           |
//   | M-03-6   | the root-`type` check always returns true    | 1, 2, 8, 11      |
//   | M-03-10  | `vendor` blanked on the not-emittable issue  | 4, 5, 11         |
//
// Two entries in that table are findings rather than bookkeeping.
//
// M-03-5 turns exactly ONE case red. Measured: `zodObject` and `arktypeObject`
// emit an identical root under both projections apart from
// `additionalProperties`, so case 3's positive control stays green while the
// wrong projection ships to every agent. If case 9 is ever deleted or loosened,
// nothing in this repository notices `.output(`.
//
// M-03-4 leaves case 6 GREEN, and that is correct rather than a gap. A reversed
// order still falls through to the hatch for a validator that cannot derive, so
// valibot keeps working — which is exactly why case 7 has to use a hatch that
// is DISTINGUISHABLE from the derivation. Case 6 alone cannot see the order.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import {
  buildCatalog,
  CatalogValidationError,
  JSON_SCHEMA_TARGET,
} from "../dist/index.js";
import {
  arktypeObject,
  probeSchema,
  probeSchemaThatThrows,
  valibotEscapeHatchSchema,
  valibotObject,
  zodDiscriminatedUnion,
  zodObject,
  zodStringRoot,
  zodWithDefault,
} from "./fixtures/schemas.js";

const DIST_PATH = fileURLToPath(new URL("../dist/index.js", import.meta.url));

// The two `$schema` values, written as literals rather than derived. Deriving
// either one from the artifact under test would make this suite agree with
// whatever the artifact happens to emit, which is the failure mode
// `single-instance.test.ts:44-49` names about the registry key.
const SCHEMA_2020_12 = "https://json-schema.org/draft/2020-12/schema";
const SCHEMA_DRAFT_07 = "http://json-schema.org/draft-07/schema#";

interface ActionExtras {
  readonly jsonSchema?: unknown;
}

// A minimal well-formed declaration around one fixture schema.
//
// `redact: "drop"` is on every action deliberately. SEC-01 makes a missing
// `redact` on a non-empty schema its own build-failing issue, and every fixture
// here except the empty ones has members — so without it, `redaction_missing`
// issues would appear alongside the emission issues and case 11's "exactly two
// issues" would be counting the wrong thing.
function action(
  name: string,
  schema: unknown,
  extras: ActionExtras = {},
): Record<string, unknown> {
  return {
    name,
    description: "A fixture action declared by test/emission.test.ts.",
    schema,
    redact: "drop",
    handler: () => ({ ok: true, message: "done" }),
    ...extras,
  };
}

// Run a build that is expected to fail, and hand back the structured error.
//
// A non-`CatalogValidationError` is re-thrown rather than swallowed: an
// emission failure escaping as the validator's OWN exception is precisely
// T-03-35, and case 10 asserts against it directly.
function failedBuild(
  actions: readonly unknown[],
  options?: unknown,
): InstanceType<typeof CatalogValidationError> {
  try {
    buildCatalog(actions as never, options as never);
  } catch (error) {
    if (error instanceof CatalogValidationError) {
      return error;
    }
    throw error;
  }
  throw new Error(
    "expected buildCatalog to throw CatalogValidationError, but it built successfully",
  );
}

// The single emitted schema for a one-action catalog that is expected to build.
function parametersOf(
  actions: readonly unknown[],
  options?: unknown,
): Record<string, unknown> {
  const catalog = buildCatalog(actions as never, options as never);
  return catalog.entries[0].parameters as unknown as Record<string, unknown>;
}

beforeAll(() => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      `packages/concierge/dist/index.js is missing. These tests run against the ` +
        `BUILT artifact, not the source. Run \`pnpm build\` first.`,
    );
  }
});

describe("CAT-02 — a root that is not `type: \"object\"` fails the build", () => {
  it("1 — z.discriminatedUnion fails, and the message names `oneOf` so the developer knows what to change", () => {
    const err = failedBuild([action("duUnion", zodDiscriminatedUnion)]);

    expect(err.issues).toHaveLength(1);
    expect(err.issues[0].code).toBe("schema_root_not_object");
    expect(err.issues[0].action).toBe("duUnion");

    // The second expectation, and it is the one that carries the requirement.
    // A developer reading only `root is not "object"` on a discriminated union
    // has nothing to correct in place — their schema has no root `type` AT ALL,
    // so there is no wrong value to fix. Naming `oneOf` is what tells them
    // immediately that the union has to be wrapped. Asserting only the code
    // would pass on a message that is useless.
    expect(err.issues[0].problem).toMatch(/oneOf/);
    expect(err.issues[0].problem).toMatch(/no root `type` at all/);
  });

  it("2 — z.string() fails with the SAME code but a message that reads differently", () => {
    const err = failedBuild([action("stringRoot", zodStringRoot)]);

    expect(err.issues).toHaveLength(1);
    expect(err.issues[0].code).toBe("schema_root_not_object");
    expect(err.issues[0].action).toBe("stringRoot");

    // Here there IS a root type and it is simply wrong, so the message quotes
    // it. Asserting both halves — that `"string"` is named AND that `oneOf` is
    // absent — is what makes "the two failure shapes read differently" true
    // rather than aspirational. One code, two diagnoses; a check that collapsed
    // them into one sentence would satisfy every assertion in case 1.
    expect(err.issues[0].problem).toMatch(/"string"/);
    expect(err.issues[0].problem).not.toMatch(/oneOf/);
  });

  it("3 — zod and arktype object roots both BUILD (the positive control cases 1 and 2 need)", () => {
    const catalog = buildCatalog([
      action("zodAct", zodObject),
      action("arkAct", arktypeObject),
    ] as never);

    expect(catalog.names).toEqual(["zodAct", "arkAct"]);
    for (const entry of catalog.entries) {
      expect(entry.parameters.type, entry.action.name).toBe("object");
    }

    // Without this control, cases 1 and 2 would both pass on a check that
    // rejected literally every schema — the most likely shape of a broken root
    // check, and the one a mutation of `hasObjectRoot` produces.
    //
    // The second half is a trap worth pinning here rather than only in a
    // summary: AN ARKTYPE VALIDATOR IS A FUNCTION, not an object.
    // `type({key:"string"})` returns a callable carrying `~standard` as a
    // property, while zod and valibot return plain objects. 03-03's first
    // `schema`-shape guard opened `typeof schema !== "object"`, typechecked
    // clean, and rejected every arktype action in existence; it was caught only
    // by running a real arktype action end to end — which is what this case is.
    expect(typeof arktypeObject).toBe("function");
    expect(typeof zodObject).toBe("object");
  });
});

describe("CAT-06 — the explicit `jsonSchema` escape hatch", () => {
  it("4 — a valibot action with no hatch fails, and the failure names the VENDOR", () => {
    const err = failedBuild([action("valibotAct", valibotObject)]);

    expect(err.issues).toHaveLength(1);
    expect(err.issues[0].code).toBe("schema_not_emittable");

    // The field. This is the assertion that survives a rewording of the prose,
    // and the one mutant M-03-10 turns red.
    expect(err.issues[0].vendor).toBe("valibot");

    // The composed message. The vendor has to reach a human eye, not only a
    // structured field: the failure is a property of the VALIDATOR, not of the
    // developer's declaration, and without the vendor named the developer
    // cannot tell which of the two is wrong. Those have completely different
    // fixes — rewrite the action, or supply a hatch.
    expect(err.message).toMatch(/valibot/);

    // ...but pinned in the QUOTED form as well, because the bare regex above is
    // much weaker than it looks. See case 5, which measures exactly how weak.
    expect(err.message).toMatch(/its validator "valibot"/);
  });

  it("5 — the bare /valibot/ match is nearly vacuous, and here is the measurement that proves it", () => {
    // A finding, recorded as an executable assertion rather than as a comment,
    // because it changes how case 4 must be read.
    //
    // Every `schema_not_emittable` issue carries the SAME hardcoded `fix`
    // string, and that string names valibot unconditionally: "zod 4.2+ and
    // arktype 2.1.28+ do; valibot 1.4.2 does not". `CatalogValidationError`
    // joins `problem` and `fix` into the message. So `/valibot/` matches on a
    // failure that has nothing to do with valibot at all — measured here on the
    // dependency-free `probe` fixture.
    const err = failedBuild([action("probeAct", probeSchema)]);

    expect(err.issues[0].vendor).toBe("probe");
    expect(err.message).toMatch(/valibot/);

    // Which is why case 4 pins the quoted form. That one is genuinely
    // discriminating: it appears only where `emitSchema` interpolated the
    // vendor it actually read.
    expect(err.message).not.toMatch(/its validator "valibot"/);
    expect(err.message).toMatch(/its validator "probe"/);
  });

  it("6 — the SAME valibot action WITH a hatch builds, and the hatch is what ships", () => {
    const parameters = parametersOf([
      action("valibotAct", valibotObject, {
        jsonSchema: valibotEscapeHatchSchema,
      }),
    ]);

    // CAT-06's core claim: valibot 1.4.2 cannot derive, and the hatch is the
    // only path that gets an agent a schema for it at all.
    expect(parameters).toEqual(valibotEscapeHatchSchema);

    // Deep equality alone would be satisfied by a coincidentally-identical
    // derivation, so the absence of `$schema` is asserted too: EVERY derived
    // emission carries it as its first key, and this hand-written object does
    // not. Nothing derived can produce this value.
    expect(Object.hasOwn(parameters, "$schema")).toBe(false);
  });

  it("7 — THE ORDER: an explicit hatch beats a validator that could have derived", () => {
    // The hatch is deliberately DISTINGUISHABLE from what zod emits for the
    // very same schema. Measured, `zodObject` derives
    // `{$schema, type, properties, required}` with no `additionalProperties`
    // and no `title`. This object carries `title` and omits `$schema`, so the
    // two are told apart by two independent properties.
    //
    // Without that, the case passes under EITHER ordering — for a zod action
    // the hatch and the derivation usually agree, which is the whole reason
    // `SchemaEmission` reports a `source` discriminator at all. A same-valued
    // hatch is the version of this test that proves nothing, and mutant M-03-4
    // is what catches the difference.
    const distinguishable = {
      type: "object",
      properties: { key: { type: "string" }, value: { type: "string" } },
      required: ["key", "value"],
      additionalProperties: false,
      title: "hand-written-escape-hatch",
    };

    const parameters = parametersOf([
      action("ordered", zodObject, { jsonSchema: distinguishable }),
    ]);

    // Present only on the hatch.
    expect(parameters.title).toBe("hand-written-escape-hatch");

    // Present only on the derivation. Asserted in the opposite direction so
    // that a reversed order fails on both halves rather than on neither.
    expect(Object.hasOwn(parameters, "$schema")).toBe(false);
  });

  it("8 — a hatch whose root is not an object still fails CAT-02, and the message says whose fault it is", () => {
    // The hatch bypasses DERIVATION, not VALIDATION. This is the JavaScript
    // consumer's path: `JsonSchemaObject` declares `type: "object"`, so a
    // TypeScript consumer cannot spell this — and this file is in no TypeScript
    // program, so it is written as a plain object with no cast ceremony.
    const err = failedBuild([
      action("badHatch", zodObject, { jsonSchema: { type: "string" } }),
    ]);

    expect(err.issues).toHaveLength(1);
    expect(err.issues[0].code).toBe("schema_root_not_object");

    // The second expectation, and it is a different claim from the first: the
    // message must blame the HATCH, not the emitter. `zodObject` emits a
    // perfectly good object root, so a diagnostic reading "the JSON Schema
    // emitted by zod ..." would send the developer to debug a validator that is
    // working correctly.
    expect(err.issues[0].problem).toMatch(/explicit `jsonSchema` you supplied/);
    expect(err.issues[0].problem).not.toMatch(/emitted by/);
  });
});

describe("the INPUT projection is what ships", () => {
  it("9 — a `.default()` member is absent from `required`, which is the input side", () => {
    const parameters = parametersOf([action("withDefault", zodWithDefault)]);

    // MEASURED THIS SESSION on `zodWithDefault` at draft-2020-12, both
    // directions, through the real converter:
    //
    //   .input()  -> required: ["key"]            , NO `additionalProperties`
    //   .output() -> required: ["key","limit"]    , `additionalProperties: false`
    //
    // Both discriminate, and both are asserted, because they fail
    // independently: a converter change could move one without the other.
    expect(parameters.required).toEqual(["key"]);
    expect(Object.hasOwn(parameters, "additionalProperties")).toBe(false);

    // Deliberately NOT asserted, in the style of `export-surface.test.ts:31-46`:
    // `properties.limit.default` is `10` on BOTH projections. An assertion on
    // it would read like coverage of this claim and prove nothing about the
    // direction, which is the entire subject of the case. It is written down
    // here instead.
    //
    // Why the direction matters at all: tool calling needs the shape the agent
    // must PRODUCE. `.output()` is also measured to throw
    // `"Transforms cannot be represented in JSON Schema"` outright on any
    // schema carrying a transform, so the wrong projection is not merely
    // wrong — on some declarations it does not exist.
    //
    // This case is the only thing in the repository that catches mutant M-03-5.
    // Measured: `zodObject` and `arktypeObject` emit an identical root under
    // both projections apart from `additionalProperties`, so case 3's positive
    // control stays green while `.output(` ships.
  });
});

describe("failure containment and aggregation", () => {
  it("10 — a validator that throws produces an ISSUE, not an unhandled crash", () => {
    // T-03-35. `~standard.jsonSchema.input()` is third-party code that core
    // calls while a module is still evaluating. The spec says a converter "may
    // throw" and one of the two implementers does. Unhandled, it takes down a
    // whole SSR render rather than one action.
    expect(() => buildCatalog([action("throws", probeSchemaThatThrows)] as never)).toThrow(
      CatalogValidationError,
    );

    const err = failedBuild([action("throws", probeSchemaThatThrows)]);

    expect(err.issues[0].code).toBe("schema_not_emittable");
    expect(err.issues[0].vendor).toBe("probe-throws");

    // The thrown text survives into the diagnostic. Without it the developer is
    // told a validator failed and not why, and the one party who knows is the
    // validator that just said so.
    expect(err.issues[0].problem).toMatch(/probe: refusing to emit/);
  });

  it("11 — a zod failure, a valibot failure and an arktype success throw ONCE with two issues", () => {
    const err = failedBuild([
      action("duUnion", zodDiscriminatedUnion),
      action("valibotAct", valibotObject),
      action("arkAct", arktypeObject),
    ]);

    // Aggregation, not short-circuit: a developer with three faults must see
    // three in one run, not fix-and-rebuild three times.
    expect(err.issues.map((issue) => issue.action)).toEqual([
      "duUnion",
      "valibotAct",
    ]);

    // Two distinct codes and two distinct vendors from one throw — the failing
    // actions are told apart by vendor as well as by name.
    expect(err.issues.map((issue) => issue.vendor)).toEqual(["zod", "valibot"]);

    // And the healthy action is named nowhere. An aggregator that reported
    // every action rather than every failing action would satisfy both
    // assertions above.
    expect(err.message).not.toMatch(/arkAct/);
  });
});

describe("the JSON Schema target", () => {
  it("12 — `draft-07` is observable in the emitted `$schema`, not merely accepted", () => {
    const draft07 = parametersOf([action("zodAct", zodObject)], {
      jsonSchemaTarget: "draft-07",
    });
    const default2020 = parametersOf([action("zodAct", zodObject)]);

    // Asserting only that the option is ACCEPTED would pass on an
    // implementation that ignored it entirely — which is what a dropped
    // `target` argument looks like, and zod defaults to 2020-12 on a bare
    // `.input()` call, so the ignored form emits a perfectly plausible schema.
    //
    // MEASURED: the two dialects differ in the `$schema` value and in nothing
    // else on this fixture, so `$schema` is the whole observable difference and
    // is what gets pinned.
    expect(draft07.$schema).toBe(SCHEMA_DRAFT_07);
    expect(default2020.$schema).toBe(SCHEMA_2020_12);
  });

  it("13 — an option-less build uses the exported JSON_SCHEMA_TARGET", () => {
    // The literal is pinned at the type level in `test-d/json-schema.test-d.ts`
    // and by name in `export-surface.test.ts`. Neither can see whether
    // `buildCatalog` actually USES it — a default silently changed in
    // `buildCatalog`'s own body would leave both green while every consumer got
    // a different dialect than the exported constant advertises.
    expect(JSON_SCHEMA_TARGET).toBe("draft-2020-12");

    const parameters = parametersOf([action("arkAct", arktypeObject)]);
    expect(parameters.$schema).toBe(SCHEMA_2020_12);
  });
});
