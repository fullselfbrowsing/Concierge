/**
 * packages/concierge/test/fixtures/schemas.ts — the real-validator fixtures for
 * the CAT-02 root-type suite and the CAT-06 escape-hatch suite.
 *
 * NO TYPESCRIPT PROGRAM COMPILES THIS FILE.
 *
 * That is the opposite of the statement `./probe.ts` makes about itself, and it
 * is worth being just as explicit about. `probe.ts` is compiled by a *foreign*
 * program (a scratch project outside the repo, against a packed tarball). This
 * file is compiled by nothing at all: `packages/concierge/tsconfig.json`
 * includes only `src/**` and `tsconfig.test-d.json` adds only `test-d/**`, so
 * `test/` sits outside both. `vitest.config.ts:48-80` records why that is
 * accepted rather than overlooked. The consequence for anyone editing this
 * file: **a type error here is invisible to `pnpm typecheck` and surfaces only
 * as a runtime failure under `vitest run`.** Vitest imports this module for its
 * runtime values; the annotations below are documentation that happens to be
 * machine-checkable somewhere else, not a gate.
 *
 * Everything asserted in the tables below was produced by executing the
 * installed packages — zod 4.4.3, arktype 2.2.3, valibot 1.4.2 — at target
 * `"draft-2020-12"`, not by reading their documentation. That distinction is
 * load-bearing here more than anywhere else in the repository, because
 * `standardschema.dev` documents Valibot as implementing Standard JSON Schema
 * and it does not.
 *
 * ---------------------------------------------------------------------------
 * MEASURED — emitted root per schema shape, target "draft-2020-12"
 * ---------------------------------------------------------------------------
 *
 * | Fixture                 | Emitted root keys (in order)                        | Root check |
 * |-------------------------|-----------------------------------------------------|------------|
 * | `zodObject`             | `$schema, type, properties, required`               | passes     |
 * | `zodEmptyObject`        | `$schema, type, properties` (`properties` is `{}`)  | passes     |
 * | `zodWithDefault`        | `$schema, type, properties, required`               | passes     |
 * | `zodRecord`             | `$schema, type, propertyNames, additionalProperties`| passes     |
 * | `arktypeObject`         | `$schema, type, properties, required`               | passes     |
 * | `arktypeEmptyObject`    | `$schema, type` — **no `properties` at all**        | passes     |
 * | `zodDiscriminatedUnion` | `$schema, oneOf` — **no `type`**                    | FAILS      |
 * | `zodStringRoot`         | `$schema, type` where `type` is `"string"`          | FAILS      |
 * | `valibotObject`         | emits nothing — there is no converter               | n/a        |
 *
 * **Divergence from `03-RESEARCH.md:612-635`, recorded rather than reconciled.**
 * That table writes the passing rows as `{type:"object", properties, required}`
 * and shows `$schema` only on the failing rows. Measured, **every** zod and
 * arktype emission at `draft-2020-12` carries `$schema` and carries it *first*.
 * RESEARCH is not wrong about what fails, but a test that asserts on the full
 * key list — or a diagnostic that prints it, as `describeRoot` in
 * `src/json-schema.ts` does — must expect `$schema` on every row. The concrete
 * consequence: `zodStringRoot`'s keys are `["$schema","type"]`, not `["type"]`.
 *
 * ---------------------------------------------------------------------------
 * MEASURED — `~standard` surface per vendor
 * ---------------------------------------------------------------------------
 *
 * | Vendor    | `Object.keys(schema["~standard"])`               | `jsonSchema`? |
 * |-----------|--------------------------------------------------|---------------|
 * | zod       | `validate, vendor, version, jsonSchema`          | yes           |
 * | arktype   | includes `jsonSchema`                            | yes           |
 * | valibot   | `version, vendor, validate` — exactly these three| **NO**        |
 *
 * ---------------------------------------------------------------------------
 * MEASURED — `.input()` is not interchangeable with `.output()`
 * ---------------------------------------------------------------------------
 *
 * On `zodWithDefault`, which is the fixture that exists for exactly this:
 *
 *   .input()  -> required: ["key"]
 *   .output() -> required: ["key","limit"], plus additionalProperties: false
 *
 * And on any schema carrying a transform, `.output()` throws outright:
 * `Error: Transforms cannot be represented in JSON Schema`. Tool calling needs
 * the side the agent must *produce*, which is the input projection.
 *
 * ---------------------------------------------------------------------------
 * MEASURED — options are mandatory and vendors disagree about targets
 * ---------------------------------------------------------------------------
 *
 * | Call                       | zod 4.4.3                     | arktype 2.2.3          |
 * |----------------------------|-------------------------------|------------------------|
 * | `.input()` — no argument   | works, defaults to 2020-12    | `TypeError` (bare)     |
 * | `{target:"draft-2020-12"}` | ok                            | ok                     |
 * | `{target:"draft-07"}`      | ok                            | ok                     |
 * | `{target:"openapi-3.0"}`   | ok, and silently drops `$schema` | `ParseError`        |
 * | `{target:"draft-04"}`      | ok                            | `ParseError`           |
 * | `{target:"nonsense"}`      | ok, and silently drops `$schema` | `ParseError`        |
 *
 * ArkType's bare-`.input()` throw is `TypeError: Cannot read properties of
 * undefined (reading 'target')`. It is why `emitSchema` always passes
 * `{ target }`, and why `probeSchemaThatThrows` exists rather than relying on
 * whichever target ArkType happens to reject in some future version.
 */

import { z } from "zod";
import * as ark from "arktype";
import * as v from "valibot";

import type { JsonSchemaObject, StandardSchemaV1 } from "../../src/types.js";

// ---------------------------------------------------------------------------
// zod 4.4.3 — the vendor that emits, and the vendor that produces the traps
// ---------------------------------------------------------------------------

/** The ordinary happy path: an object root with named string members. */
export const zodObject = z.object({ key: z.string(), value: z.string() });

/**
 * CAT-02's live trap, and the reason this file installs a real validator rather
 * than hand-rolling one.
 *
 * Emits `{$schema, oneOf:[…]}` with **no root `type`**. A hand-written fixture
 * asserting this would only prove that the check reads a field we ourselves
 * wrote; this one proves the check survives contact with the emitter that
 * actually produces the shape.
 */
export const zodDiscriminatedUnion = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("a"), a: z.string() }),
  z.object({ kind: z.literal("b"), b: z.string() }),
]);

/**
 * The *other* CAT-02 failure shape: a root that is typed, and typed wrong.
 *
 * Emits `{$schema, type:"string"}`. The diagnostic for this must read
 * differently from `zodDiscriminatedUnion`'s — here there is a root `type` to
 * name, there it is absent entirely, and the two need different fixes.
 */
export const zodStringRoot = z.string();

/** Emits `properties: {}` — an empty object that is still a well-formed root. */
export const zodEmptyObject = z.object({});

/**
 * The fixture that makes mutant M-03-5 (`.input(` → `.output(`) catchable.
 *
 * `limit` carries `.default(10)`, which is the one construct measured to move a
 * member between the two projections: `.input()` gives `required: ["key"]`,
 * `.output()` gives `required: ["key","limit"]`. Without a `.default()`
 * anywhere in the fixture set the two projections agree on every schema here
 * and the mutant escapes green.
 */
export const zodWithDefault = z.object({
  key: z.string(),
  limit: z.number().default(10),
});

/**
 * SEC-01's emptiness trap, and the twelfth fixture.
 *
 * Emits `{$schema, type:"object", propertyNames, additionalProperties}` — a
 * root that **passes** CAT-02 while carrying **no `properties` key at all**.
 *
 * This is why a downstream emptiness test cannot be
 * `Object.keys(properties ?? {}).length > 0`. A schema accepting arbitrary
 * caller-supplied keys *and* arbitrary values is the most redaction-sensitive
 * shape a declaration can have, and that naive test classifies it as EMPTY —
 * so redaction silently defaults instead of making the author choose. Plan
 * 03-03 owns the corrected test and plan 03-06 owns the case; this fixture is
 * what makes either of them provable rather than asserted.
 */
export const zodRecord = z.record(z.string(), z.string());

// ---------------------------------------------------------------------------
// arktype 2.2.3 — the second emitting vendor, and the stricter one
// ---------------------------------------------------------------------------

/** The second Standard-JSON-Schema vendor on the happy path. */
export const arktypeObject = ark.type({ key: "string", value: "string" });

/**
 * Measured to emit `{$schema, type:"object"}` — **no `properties` key at all**,
 * where zod's `z.object({})` emits `properties: {}`.
 *
 * The two emitting vendors disagree about how to spell "no members", so any
 * consumer reading `properties` has to tolerate its absence on a root that is
 * otherwise perfectly valid. Same lesson as `zodRecord`, reached by a different
 * route.
 */
export const arktypeEmptyObject = ark.type({});

// ---------------------------------------------------------------------------
// valibot 1.4.2 — the negative case, which is CAT-06's whole reason to exist
// ---------------------------------------------------------------------------

/**
 * A validator with **no** `~standard.jsonSchema`.
 *
 * `Object.keys(valibotObject["~standard"])` is exactly
 * `["version","vendor","validate"]`, measured against valibot 1.4.2 — despite
 * `standardschema.dev` documenting Valibot as implementing Standard JSON
 * Schema. Deleting `ActionDefinition.jsonSchema` on the strength of that
 * documentation would remove the only working path for one of the three
 * validators this project targets, and nothing in the type system would notice.
 */
export const valibotObject = v.object({ key: v.string() });

/**
 * The hand-written schema a valibot action supplies through the escape hatch.
 *
 * Deliberately a literal rather than `@valibot/to-json-schema`: it proves the
 * same thing — that an explicit `jsonSchema` is used in preference to
 * derivation — and adds no dependency to do it. It is also the only fixture
 * whose `source` must come back `"explicit"`.
 */
export const valibotEscapeHatchSchema: JsonSchemaObject = {
  type: "object",
  properties: { key: { type: "string" } },
  required: ["key"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Dependency-free fixtures — for the shapes no published validator produces
// ---------------------------------------------------------------------------

/**
 * A minimal, dependency-free `StandardSchemaV1`.
 *
 * `vendor: "probe"` so that a failure message quoting the vendor is
 * unmistakably reading *this* fixture and not a real library. Like
 * `valibotObject` it has no `jsonSchema`, but unlike it this one is ours, so a
 * test can use it without pinning behaviour to a third party's release.
 */
export const probeSchema: StandardSchemaV1<
  { key: string; value: string },
  { key: string; value: string }
> = {
  "~standard": {
    version: 1,
    vendor: "probe",
    validate: (value: unknown) => ({
      value: value as { key: string; value: string },
    }),
  },
};

/**
 * A schema whose converter throws, so the `reason: "threw"` branch is reachable
 * deterministically.
 *
 * The alternative — calling ArkType with `{target:"draft-04"}`, which does
 * throw today — pins a test to which targets a third party currently rejects.
 * That is a fact about arktype 2.2.3, not about the code under test, and it
 * would turn a dependency bump into a red suite for no reason. This fixture
 * throws because we made it throw, which is the only property the branch cares
 * about.
 *
 * `vendor: "probe-throws"` keeps it distinguishable from `probeSchema` in a
 * message.
 */
export const probeSchemaThatThrows: StandardSchemaV1<
  { key: string },
  { key: string }
> = {
  "~standard": {
    version: 1,
    vendor: "probe-throws",
    validate: (value: unknown) => ({ value: value as { key: string } }),
    jsonSchema: {
      input: () => {
        throw new Error("probe: refusing to emit");
      },
      output: () => {
        throw new Error("probe: refusing to emit");
      },
    },
  } as StandardSchemaV1<{ key: string }, { key: string }>["~standard"],
};
