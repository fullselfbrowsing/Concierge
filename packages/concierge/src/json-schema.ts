/**
 * JSON Schema emission — how an action's validator becomes the agent-facing
 * argument contract (CAT-02, CAT-06).
 *
 * Like `./types.ts` and `./contract.ts`, this file has no runtime dependency,
 * no framework import and no DOM access — it must construct on a server under
 * Next App Router, Nuxt or SvelteKit without guards. Its single import is
 * type-only, so it contributes nothing to the module graph the PKG-05 probe
 * measures.
 *
 * ---------------------------------------------------------------------------
 * The emission order is locked, and the `source` discriminator is what proves it
 * ---------------------------------------------------------------------------
 *
 * {@link emitSchema} tries, in this order: the developer's explicit
 * `jsonSchema`, then the validator's own `~standard.jsonSchema.input(...)`, then
 * it fails naming the vendor. The order is not an implementation detail — it is
 * the CAT-06 contract, and a reversed order is invisible to any assertion that
 * only compares the *resulting* schema, because for a zod action the escape
 * hatch and the derived schema usually agree. {@link SchemaEmission} therefore
 * reports `source: "explicit" | "derived"`, so a test can prove the hatch
 * actually won rather than coincidentally matched.
 *
 * ---------------------------------------------------------------------------
 * Why the escape hatch is not deletable, measured rather than assumed
 * ---------------------------------------------------------------------------
 *
 * `standardschema.dev` documents Valibot as implementing Standard JSON Schema.
 * Measured against valibot 1.4.2, `Object.keys(schema["~standard"])` is exactly
 * `["version", "vendor", "validate"]` — there is no `jsonSchema` at all. Zod
 * 4.4.3 and ArkType 2.2.3 do implement it. Removing `ActionDefinition.jsonSchema`
 * on the strength of the docs would delete the only working path for one of the
 * three validators this project targets.
 */

import type {
  AnyActionDefinition,
  JsonSchemaObject,
  StandardSchemaV1,
} from "./types.js";

// ---------------------------------------------------------------------------
// The converter shape, declared structurally
// ---------------------------------------------------------------------------

/**
 * A JSON Schema dialect a validator can be asked to emit.
 *
 * The `(string & {})` member is deliberate: it keeps the three named dialects
 * available to editor completion while still admitting a target core does not
 * enumerate, because the set of dialects is the validator's to decide, not
 * ours.
 *
 * **Only `"draft-2020-12"` and `"draft-07"` are supported by both emitting
 * vendors** — see the target table on {@link emitSchema}. The others are
 * reachable, and one of them will throw on ArkType.
 */
export type JsonSchemaTarget =
  | "draft-2020-12"
  | "draft-07"
  | "openapi-3.0"
  | (string & {});

/**
 * What a converter is handed.
 *
 * `target` is **required**, matching the Standard Schema spec, which does not
 * make it optional. That is not pedantry: ArkType 2.2.3 dereferences
 * `options.target` unconditionally and throws a bare
 * `TypeError: Cannot read properties of undefined (reading 'target')` on a
 * no-argument call. A `?` here would make that crash spellable.
 *
 * `libraryOptions` carries the explicit `| undefined` this repo's
 * `exactOptionalPropertyTypes` requires — without it, building this object from
 * a possibly-absent value is TS2375 at every call site.
 */
export interface JsonSchemaConverterOptions {
  readonly target: JsonSchemaTarget;
  readonly libraryOptions?: Record<string, unknown> | undefined;
}

/**
 * Structural stand-in for the Standard Schema JSON Schema converter.
 *
 * Declared locally rather than imported, for the same reason
 * `AbortSignalLike` in `./types.ts` is declared locally — and here there is a
 * second, harder reason. `@standard-schema/spec` does export a sibling type for
 * this, but the two are *siblings*: both extend the spec's common base and
 * neither is a subtype of the other. The validator interface this package
 * accepts declares `validate` and no converter; the converter interface
 * declares the converter and no `validate`. A real Zod schema satisfies both,
 * but the *declared* parameter type gives no access to the converter, so the
 * intersection has to be written by hand regardless. Importing the sibling buys
 * nothing and couples core's public surface to a second spec type.
 *
 * `output` is declared because the spec declares it. **Nothing in this package
 * calls it** — see {@link emitSchema}.
 */
export interface JsonSchemaConverter {
  readonly input: (options: JsonSchemaConverterOptions) => Record<string, unknown>;
  readonly output: (options: JsonSchemaConverterOptions) => Record<string, unknown>;
}

/**
 * The dialect core asks for by default.
 *
 * Deliberately unannotated, matching {@link MESSAGE_MAX_CHARS} in `./types.ts`:
 * under `isolatedDeclarations` the literal type `"draft-2020-12"` survives into
 * the emitted `.d.ts`, so a consumer — and this package's own type tests — can
 * guard against the default silently changing. Annotating it
 * `: JsonSchemaTarget` is the form that loses something, and it loses more than
 * the `: number` case that rule was written for: the alias contains
 * `(string & {})`, so the annotation widens the emitted declaration all the way
 * to `string` and nothing pins the default at all.
 *
 * `"draft-2020-12"` and not `"draft-07"` because it is the dialect OpenAI's
 * function-calling surface expects, and it is one of the only two both emitting
 * vendors accept.
 */
export const JSON_SCHEMA_TARGET = "draft-2020-12";

// ---------------------------------------------------------------------------
// Reaching the converter without `any`
// ---------------------------------------------------------------------------

/**
 * A validator viewed as nothing but an untyped bag of properties.
 *
 * Module-private and deliberately minimal, following `Holder` in
 * `./contract.ts` — widening it toward the real spec types is exactly the move
 * the {@link JsonSchemaConverter} doc comment explains does not work.
 */
type PropertyBag = Record<string, unknown>;

/**
 * Does this validator carry a Standard JSON Schema converter?
 *
 * This is the package's first user-defined type predicate. It exists because
 * the validator interface core accepts does **not** declare `jsonSchema`, so
 * reading `schema["~standard"].jsonSchema` is a type error and the only ways
 * through are this predicate or an `any`. There is no `any` here; every local
 * is annotated, as in `./contract.ts`.
 *
 * The runtime test is `typeof converter.input === "function"` and not a
 * `"jsonSchema" in schema["~standard"]` check, because `in` walks the prototype
 * chain — see the note on {@link emitSchema} about `Object.keys`.
 */
export function hasJsonSchemaConverter(
  schema: StandardSchemaV1,
): schema is StandardSchemaV1 & {
  readonly "~standard": { readonly jsonSchema: JsonSchemaConverter };
} {
  const std: unknown = schema["~standard"];
  if (typeof std !== "object" || std === null) {
    return false;
  }
  const converter: unknown = (std as PropertyBag)["jsonSchema"];
  if (typeof converter !== "object" || converter === null) {
    return false;
  }
  return typeof (converter as PropertyBag)["input"] === "function";
}

/**
 * Which library authored this schema.
 *
 * Reachable without narrowing, and that is the point: the vendor name has to
 * appear in the *failure* message. A developer told only "the schema could not
 * be emitted" cannot tell whether they wrote the declaration wrong or picked a
 * validator that does not implement the feature — and those two have completely
 * different fixes. Naming `"valibot"` answers it in one word.
 */
export function vendorOf(schema: StandardSchemaV1): string {
  return schema["~standard"].vendor;
}

// ---------------------------------------------------------------------------
// The root-`type` contract
// ---------------------------------------------------------------------------

/**
 * Does this emitted schema have the root shape the agent contract requires?
 *
 * A predicate rather than an inline comparison plus a cast: it is the one form
 * that gets from an untyped emission to {@link JsonSchemaObject} with no
 * assertion anywhere in this file.
 *
 * `types.ts:22-28` already records *why* the root must be `type: "object"` and
 * what happens downstream when it is not; that is not restated here.
 */
function hasObjectRoot(emitted: PropertyBag): emitted is JsonSchemaObject {
  return emitted["type"] === "object";
}

/**
 * Say what is wrong with a root that failed {@link hasObjectRoot}, precisely
 * enough that the developer knows what to change.
 *
 * The two measured failure shapes need different sentences. A
 * `z.discriminatedUnion` author reading `root is not "object"` has no idea what
 * to do — their schema has no root `type` at all, so there is nothing to
 * correct in place; naming `oneOf` tells them immediately that they must wrap
 * the union. A `z.string()` author has a root type and it is simply the wrong
 * one.
 *
 * Keys come from `Object.keys` — own enumerable properties only. `for...in`
 * would walk the prototype chain of a schema this function did not author, so a
 * `__proto__`-polluted emission could inject arbitrary names into a
 * developer-facing message. The value read is never interpolated raw either:
 * only a `string` root type is quoted back, and anything else is reported as
 * its `typeof`, which cannot throw the way `String()` or `JSON.stringify()` can
 * on a BigInt, a null-prototype object, or a cycle.
 */
function describeRoot(emitted: PropertyBag): string {
  const rootType: unknown = emitted["type"];

  if (rootType === undefined) {
    const keys: readonly string[] = Object.keys(emitted);
    const shown: string = keys.length === 0 ? "none at all" : keys.join(", ");
    return `has no root \`type\` at all (keys: ${shown})`;
  }

  if (typeof rootType === "string") {
    return `has root type "${rootType}", not "object"`;
  }

  return `has a root \`type\` that is not even a string (typeof ${typeof rootType})`;
}

/**
 * Render a caught value as text without becoming a second way to crash.
 *
 * `String(cause)` is the obvious spelling and it throws on a value with a null
 * prototype (`TypeError: Cannot convert object to primitive value`) and on any
 * object whose `toString` throws. A validator that threw such a value would
 * escape the `try` in {@link emitSchema} through the handler meant to contain
 * it, which is the one outcome the wrapping exists to prevent.
 */
function describeCause(cause: unknown): string {
  try {
    return String(cause);
  } catch {
    return "a value that could not be converted to text";
  }
}

// ---------------------------------------------------------------------------
// Emission
// ---------------------------------------------------------------------------

/**
 * The outcome of trying to produce an action's agent-facing JSON Schema.
 *
 * A discriminated union rather than a nullable return, so a caller must narrow
 * on `ok` before reading either half. On success `source` records *which* of
 * the two paths won; on failure `vendor` and `detail` are what the caller turns
 * into a catalog issue. `detail` carries the action name, the vendor name, the
 * target, the emitted root's own keys and the thrown text — and nothing else.
 * These are build-time developer diagnostics, so the project's rule that a
 * crash is one generic sentence does not govern them, but they must never
 * become a channel for anything but their own diagnostics.
 */
export type SchemaEmission =
  | {
      readonly ok: true;
      readonly parameters: JsonSchemaObject;
      readonly source: "explicit" | "derived";
    }
  | {
      readonly ok: false;
      readonly reason: "not_emittable" | "threw" | "root_not_object";
      readonly vendor: string;
      readonly detail: string;
    };

/**
 * Produce the JSON Schema an agent will be shown for this action.
 *
 * **The order is the contract:** explicit `jsonSchema`, then
 * `~standard.jsonSchema.input({ target })`, then failure. The root check runs on
 * whichever of the first two produced a value, including the explicit one — the
 * declared type constrains `JsonSchemaObject.type`, but a JavaScript consumer
 * can hand this anything, and on that path the escape-hatch value *is* the
 * emitted schema.
 *
 * **The INPUT projection, always.** `.output()` is never called anywhere in this
 * package: it is measured to throw `"Transforms cannot be represented in JSON
 * Schema"` on any schema carrying a transform, and even where it succeeds it is
 * the wrong side — tool calling needs the shape the agent must *produce*, and
 * `.default()` moves a member out of `required` between the two projections.
 *
 * **Options are always passed.** Measured, target `draft-2020-12`:
 *
 * | Call                       | zod 4.4.3                | arktype 2.2.3            |
 * |----------------------------|--------------------------|--------------------------|
 * | `.input()` — no argument   | works, defaults 2020-12  | throws bare `TypeError`  |
 * | `{target:"draft-2020-12"}` | ok                       | ok                       |
 * | `{target:"draft-07"}`      | ok                       | ok                       |
 * | `{target:"openapi-3.0"}`   | ok (emits, no `$schema`) | throws `ParseError`      |
 * | `{target:"draft-04"}`      | ok                       | throws `ParseError`      |
 * | `{target:"nonsense"}`      | ok — **silently emits!** | throws `ParseError`      |
 *
 * The last row is the trap: a typo'd target is accepted by zod and produces a
 * `$schema`-less object, so the divergence only ever surfaces on an ArkType
 * action. Hence the `try`/`catch` — the spec says a converter "may throw", and
 * one of the two implementers does.
 *
 * **The root shapes this check actually sees.** Measured on the installed
 * packages at target `draft-2020-12`:
 *
 * | Schema                      | Emitted root                                | Root check |
 * |-----------------------------|---------------------------------------------|------------|
 * | `z.object({...})`           | `{type:"object", properties, required}`     | passes     |
 * | arktype `type({...})`       | `{type:"object", properties, required}`     | passes     |
 * | `z.record(k, v)`            | `{type:"object", propertyNames, …}`         | passes     |
 * | `z.discriminatedUnion(...)` | `{$schema, oneOf:[…]}` — no `type`          | FAILS      |
 * | `z.union([...])`            | `{$schema, anyOf:[…]}` — no `type`          | FAILS      |
 * | arktype `.or(...)`          | `{$schema, anyOf:[…]}` — no `type`          | FAILS      |
 * | valibot `v.union` → hatch   | `{anyOf:[…]}` — no `type`                   | FAILS      |
 * | valibot `v.variant` → hatch | `{oneOf:[…]}` — no `type`                   | FAILS      |
 * | `z.string()`                | `{type:"string"}`                           | FAILS      |
 * | `z.array(...)`              | `{type:"array", items}`                     | FAILS      |
 *
 * Note the `z.record` row: it passes the root check while carrying **no
 * `properties` key at all**. Any downstream "is this schema empty?" test that
 * reads `properties` has to account for that, or it classifies the most
 * redaction-sensitive shape there is — arbitrary caller-supplied keys *and*
 * values — as empty.
 *
 * This function never throws. Every failure is a returned value, because a
 * throw here happens while a module is still evaluating and takes down a whole
 * SSR render rather than one action.
 */
export function emitSchema(
  action: AnyActionDefinition,
  target: JsonSchemaTarget,
): SchemaEmission {
  const schema: StandardSchemaV1 = action.schema;
  const vendor: string = vendorOf(schema);

  // 1. The developer's explicit schema wins — CAT-06.
  const explicit: JsonSchemaObject | undefined = action.jsonSchema;
  if (explicit !== undefined) {
    if (!hasObjectRoot(explicit)) {
      return {
        ok: false,
        reason: "root_not_object",
        vendor,
        detail:
          `action "${action.name}": the explicit \`jsonSchema\` you supplied ` +
          `${describeRoot(explicit)}. The root handed to an agent must be ` +
          `\`type: "object"\`; wrap it in an object schema.`,
      };
    }
    return { ok: true, parameters: explicit, source: "explicit" };
  }

  // 2. Standard JSON Schema, INPUT projection only.
  if (!hasJsonSchemaConverter(schema)) {
    return {
      ok: false,
      reason: "not_emittable",
      vendor,
      detail:
        `action "${action.name}": its validator "${vendor}" does not implement ` +
        `Standard JSON Schema, so no schema can be derived. Supply an explicit ` +
        `\`jsonSchema\` on the action.`,
    };
  }

  let derived: PropertyBag;
  try {
    derived = schema["~standard"].jsonSchema.input({ target });
  } catch (cause) {
    return {
      ok: false,
      reason: "threw",
      vendor,
      detail:
        `action "${action.name}": its validator "${vendor}" threw while ` +
        `emitting JSON Schema for target "${target}" ` +
        `(${describeCause(cause)}). Supply an explicit \`jsonSchema\` on the ` +
        `action, or remove the transform from the schema.`,
    };
  }

  // 3. The root check applies to the derived schema too — CAT-02.
  if (!hasObjectRoot(derived)) {
    return {
      ok: false,
      reason: "root_not_object",
      vendor,
      detail:
        `action "${action.name}": the JSON Schema emitted by "${vendor}" ` +
        `${describeRoot(derived)}. The root handed to an agent must be ` +
        `\`type: "object"\`; wrap the schema in an object, or supply an ` +
        `explicit \`jsonSchema\` on the action.`,
    };
  }

  return { ok: true, parameters: derived, source: "derived" };
}
