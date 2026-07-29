// CAT-02 / CAT-06 — the type-level half of JSON Schema emission.
//
// WHAT ESCAPES WITHOUT THIS FILE
//
// Annotating the default target looks like an improvement. Someone reads
//
//   export const JSON_SCHEMA_TARGET = "draft-2020-12";
//
// notices the file already declares a `JsonSchemaTarget` alias, concludes the
// constant should use it, and writes `: JsonSchemaTarget`. That compiles. The
// build stays green, `pnpm test` stays green, and every runtime assertion about
// emission still passes, because the runtime VALUE is unchanged.
//
// What changes is the emitted declaration. `JsonSchemaTarget` contains
// `(string & {})`, so the annotation does not merely widen `"draft-2020-12"` to
// a three-member union — it widens it all the way to `string`. After that edit
// nothing in the repository pins the default dialect, and a later change from
// `"draft-2020-12"` to `"draft-07"` is invisible to every gate here and to every
// consumer compiling against the shipped `.d.ts`. The dialect is the contract
// the agent's tool schema is written in; changing it silently is exactly the
// class of change that must not be silent.
//
// `types.ts:279` records the same rule for `MESSAGE_MAX_CHARS` and
// `contract.ts:44-51` for `CONTRACT_VERSION`. This constant is the third
// instance, and the one where the annotation loses the most, so it gets the
// guard the other two have. Mutation-proved: applying that exact annotation to
// `src/json-schema.ts` turns `_targetDefaultIsTheLiteral` red.
//
// The remaining four predicates pin the converter contract structurally. Core
// declares that shape by hand rather than importing the spec's sibling type
// (see the `JsonSchemaConverter` doc comment), and a hand-written structural
// declaration is precisely the thing that drifts from the interface it mirrors
// with nothing to notice. `target` in particular must stay REQUIRED: ArkType
// 2.2.3 dereferences it unconditionally and throws a bare `TypeError` on a
// no-argument call, so an accidental `?` here makes a runtime crash spellable.
//
// This file declares nothing to the outside world; the imports below give it
// module status, which is what keeps `isolatedDeclarations` from treating these
// aliases as declaration-emitting (TS9010). Each predicate is on ONE line
// however long — `tsc` echoes only the line the failing type argument sits on,
// so the alias name is the entire carrier of meaning. Do not let a formatter
// wrap them.

import type { Assignable, Equals, Expect, Not } from "./_assert.js";
import type { StandardSchemaV1 } from "../src/types.js";
import type {
  JsonSchemaConverter,
  JsonSchemaConverterOptions,
  JsonSchemaTarget,
  SchemaEmission,
} from "../src/json-schema.js";
import { JSON_SCHEMA_TARGET } from "../src/json-schema.js";

// --------------------------------------------------------------------------
// The default target survives as a literal
// --------------------------------------------------------------------------

/** JSON_SCHEMA_TARGET keeps its literal type; an annotation would widen it to `string`. */
type _targetDefaultIsTheLiteral = Expect<Equals<typeof JSON_SCHEMA_TARGET, "draft-2020-12">>;

/** The target alias still admits a dialect core does not enumerate — the `(string & {})` member is load-bearing. */
type _targetTypeAdmitsAnArbitraryString = Expect<Assignable<"draft-04", JsonSchemaTarget>>;

// --------------------------------------------------------------------------
// The converter contract, declared structurally, pinned structurally
// --------------------------------------------------------------------------

/** `target` is REQUIRED, not optional — ArkType throws a bare TypeError on a no-argument `.input()`. */
type _converterOptionsTargetIsRequired = Expect<Equals<{} extends Pick<JsonSchemaConverterOptions, "target"> ? true : false, false>>;

declare const narrowed: StandardSchemaV1 & {
  readonly "~standard": { readonly jsonSchema: JsonSchemaConverter };
};

/** What the narrowing predicate hands back really does carry a callable `input` of the declared shape. */
type _converterInputSignature = Expect<Assignable<(typeof narrowed)["~standard"]["jsonSchema"]["input"], (o: JsonSchemaConverterOptions) => Record<string, unknown>>>;

// --------------------------------------------------------------------------
// Emission is a genuine discriminated union
// --------------------------------------------------------------------------

/** Success and failure are disjoint, so a caller must narrow on `ok` before reading either half. */
type _emissionIsDiscriminated = Expect<Not<Assignable<Extract<SchemaEmission, { ok: true }>, Extract<SchemaEmission, { ok: false }>>>>;
