/**
 * The catalog — one function that validates every declaration, aggregates every
 * problem into a single throw, reports the two non-blocking warning markers, and
 * freezes what it built (CAT-01, CAT-02, CAT-05, CAT-06, SEC-01, SEC-03, SEC-05,
 * DX-03, PKG-04).
 *
 * `defineAction` is an identity function: it infers and validates nothing at
 * runtime. Every rule lives here, so "did we check X?" is a one-file question
 * and there is exactly one place a check can be forgotten. That is the whole
 * design, and splitting a rule out into an eager check at declaration time
 * would undo it.
 *
 * ---------------------------------------------------------------------------
 * Three constraints whose violation is SILENT
 * ---------------------------------------------------------------------------
 *
 * **1. `assertSingleInstance()` is the first statement of {@link buildCatalog}'s
 * body, and must never be hoisted to module scope.** This package ships
 * `"sideEffects": false`, and 02-06 measured that a module-evaluation-time
 * registration is deleted from the consumer bundle outright — while remaining
 * present under `node dist/index.js`. Hoisted, PKG-04 tests green in Node and
 * does nothing in every React or Svelte app, which is the only place two copies
 * of core can collide. See `./contract.ts`'s header, constraint 1.
 *
 * **2. The freeze is recursive, and the shallow form is not a weaker version of
 * it — it is a breach that reports success.** Measured in ESM strict mode: with
 * the entries array frozen and the entries themselves not,
 * `catalog[0].handler = attackerFn` **did not throw** and the replacement
 * handler then ran, while `Object.isFrozen(catalog)` still reported `true`.
 * SEC-03 exists to stop third-party page script swapping a handler at runtime,
 * so the shallow form implements the requirement's letter and none of its
 * purpose. A SEC-03 test that asserts only `Object.isFrozen(catalog)` passes on
 * the breached build.
 *
 * **3. Issues aggregate; they never short-circuit.** A developer declaring
 * twenty actions with twenty problems must see twenty problems in one run.
 * Throwing on the first failure turns one build into twenty fix-and-rebuild
 * cycles and is indistinguishable from the correct behaviour on any catalog
 * with a single fault — which is every catalog a test writes.
 *
 * ---------------------------------------------------------------------------
 * Two channels, and the difference between them is the requirement
 * ---------------------------------------------------------------------------
 *
 * An **issue** ({@link CatalogIssue}) fails the build: the catalog cannot be
 * handed to an agent. A **diagnostic** ({@link CatalogDiagnostic}) reports and
 * continues: ROADMAP SC-3 is explicit that the two consent markers must "report
 * themselves" without blocking, because a consent policy can legitimately live
 * a layer up. A consumer who wants a diagnostic to be fatal in their own build
 * throws from {@link BuildCatalogOptions.onDiagnostic}; that is the supported
 * mechanism, and it is why the sink is not wrapped in `try`/`catch`.
 *
 * Like `./types.ts`, `./contract.ts`, `./json-schema.ts` and `./host.ts`, this
 * file has no runtime dependency, no framework reference and no DOM access — it
 * must construct on a server under Next App Router, Nuxt or SvelteKit without
 * guards.
 */

import { assertSingleInstance } from "./contract.js";
import {
  encodeDiagnosticLine,
  encodeDiagnosticSubject,
  warnHost,
} from "./host.js";
import { JSON_SCHEMA_TARGET, emitSchema, vendorOf } from "./json-schema.js";
import type { JsonSchemaTarget, SchemaEmission } from "./json-schema.js";
import type { AnyActionDefinition, JsonSchemaObject } from "./types.js";

// ---------------------------------------------------------------------------
// Issues — the build-failing channel
// ---------------------------------------------------------------------------

/**
 * Why a declaration cannot become a catalog entry.
 *
 * Stable strings, distinct per rule. A consumer filtering on one of these is
 * doing something reasonable, so these are part of the public contract and are
 * not renamed casually.
 *
 * `not_emittable` and `threw` from {@link SchemaEmission} both map to
 * `schema_not_emittable` deliberately: from the declaring developer's side the
 * two have the *same* fix — supply an explicit `jsonSchema` — and the
 * distinction between "the validator has no converter" and "the validator's
 * converter threw" survives in the issue's `problem` text, where it belongs.
 *
 * **The last two members are CAT-03, and they are two codes rather than one by
 * that same test — applied and answered the other way.** Both describe a
 * `consent.requires` that can never be satisfied, and their *consequence* is
 * identical: a safety gate that is silently permanently closed. But the
 * paragraph above collapses two cases because they share a fix, and these two do
 * not. One says "declare the missing action, or correct the spelling — and note
 * the target may live in any stage"; the other says "point at the review action
 * that should run first, or drop the policy". Collapsing them would force one
 * `fix` sentence to cover both, so the developer who merely mistyped a name
 * would be advised to consider deleting their consent policy — advice that, if
 * taken, removes the gate CAT-03 exists to protect.
 *
 * Adding them is a **widening of an already-exported union**, so it introduces
 * no new name to the package's export surface. `test/export-surface.test.ts`
 * counts names in the barrel's trailing `export { … };` block and is correctly
 * unmoved by this.
 */
export type CatalogIssueCode =
  | "duplicate_action_name"
  | "schema_not_emittable"
  | "schema_root_not_object"
  | "redaction_missing"
  | "consent_target_missing"
  | "consent_self_reference";

/**
 * One build-failing problem, as structured fields.
 *
 * **`action` and `fix` are FIELDS, not substrings of a formatted message, and
 * that is DX-03's actual requirement rather than a convenience.** DX-03 asks
 * that an error name the offending action and state the fix. A
 * formatted-string-only error can satisfy that in appearance while being
 * testable only by substring matching, which passes on a message that happens
 * to contain the word and fails on a legitimate rewording. Structured fields
 * make the requirement mechanically checkable — `issues.map(i => i.action)` is
 * an assertion; `message.includes(name)` is a guess.
 *
 * `vendor` is present only where the failure is a property of the *validator*
 * rather than of the declaration. A developer told only "the schema could not
 * be emitted" cannot tell whether they wrote the declaration wrong or picked a
 * validator that does not implement the feature, and those have completely
 * different fixes.
 *
 * `problem` and `fix` are two members rather than one sentence so a consumer
 * rendering these in their own build output can style or suppress them
 * separately. {@link CatalogValidationError} is what joins them for humans.
 */
export interface CatalogIssue {
  readonly code: CatalogIssueCode;
  readonly action: string;
  readonly vendor?: string | undefined;
  readonly problem: string;
  readonly fix: string;
}

// ---------------------------------------------------------------------------
// Diagnostics — the reporting, non-blocking channel
// ---------------------------------------------------------------------------

/**
 * Which non-blocking marker fired.
 *
 * **Two codes for one shape, and the split is load-bearing.** ROADMAP SC-3b
 * says `readsUntrusted` must report "the same way" as `effects.destructive` —
 * same shape, so a consumer handles both with one branch. A distinct *code* is
 * what then lets them filter one without the other, which they will want to:
 * `destructive` is a property of what the action does, `readsUntrusted` is a
 * property of what the action reads, and a team may reasonably treat one as
 * fatal and the other as advisory.
 */
export type CatalogDiagnosticCode =
  | "destructive_without_consent"
  | "reads_untrusted_without_consent";

/**
 * One non-blocking report, in {@link CatalogIssue}'s shape minus `vendor`.
 *
 * No `vendor`, because neither marker is a property of the validator.
 *
 * **One diagnostic per offending action, each naming its action.** An
 * aggregated summary line ("3 destructive actions carry no consent policy")
 * loses exactly the name DX-03 requires and forces the developer back into the
 * source to find which three.
 */
export interface CatalogDiagnostic {
  readonly code: CatalogDiagnosticCode;
  readonly action: string;
  readonly problem: string;
  readonly fix: string;
}

interface CatalogIssueDisplay {
  readonly problem: string;
  readonly fix: string;
}

/** Display-only encodings never overwrite the raw structured issue fields. */
const displayByIssue: WeakMap<CatalogIssue, CatalogIssueDisplay> = new WeakMap<
  CatalogIssue,
  CatalogIssueDisplay
>();

// ---------------------------------------------------------------------------
// The aggregate error
// ---------------------------------------------------------------------------

/**
 * Render every issue into the one message a developer reads.
 *
 * Module-private and placed here rather than inside the class because the
 * message has to exist before `super(...)` runs.
 *
 * The shape follows `contract.ts:158-165`, the only other `throw new Error` in
 * `src/`: a `concierge: ` prefix, the *what* and the *fix* both present, and
 * one line per problem so the list survives a terminal that does not wrap.
 */
function formatIssues(issues: readonly CatalogIssue[]): string {
  const lines: string[] = [
    encodeDiagnosticLine(
      `concierge: ${issues.length} problem(s) in the action catalog.`,
    ),
  ];
  for (const issue of issues) {
    const display: CatalogIssueDisplay = displayByIssue.get(issue) ?? issue;
    lines.push(
      encodeDiagnosticLine(
        `  [${issue.code}] action ${encodeDiagnosticSubject(issue.action)}: ${display.problem} ` +
          `Fix: ${display.fix}`,
      ),
    );
  }
  return lines.join("\n");
}

/**
 * Every build-failing problem in one catalog, thrown once.
 *
 * **The package's first class**, and the justification is that `issues` has to
 * survive the throw as structured data — see {@link CatalogIssue}. A plain
 * `Error` with a formatted message would make DX-03 testable only by substring
 * matching.
 *
 * **`AggregateError` was available and was rejected.** It is type-visible under
 * `lib: ["ES2022"]` (measured), but its `errors` member holds `Error` objects,
 * so every `{code, action, vendor, problem, fix}` would have to be flattened
 * back into a string and re-parsed by anyone who wanted the structure. That is
 * the opposite of the point.
 *
 * **The message carries names, codes, vendors and fixed remedial prose, and
 * nothing else** — no argument values, no environment, no file paths.
 * `contract.ts:135-138` is the stated precedent: a build-time error is
 * developer-facing rather than a dispatcher result, so the project's rule that
 * a crash is one generic sentence does not govern it. What does govern it is
 * that it must never become a channel for anything but its own diagnostics.
 *
 * `this.name` is assigned explicitly. Subclassing `Error` does not set it — the
 * instance would inherit `"Error"` from the prototype, and every log line, test
 * snapshot and CI annotation would say `Error` instead of naming the failure.
 */
export class CatalogValidationError extends Error {
  readonly issues: readonly CatalogIssue[];

  constructor(issues: readonly CatalogIssue[]) {
    super(formatIssues(issues));
    this.name = "CatalogValidationError";
    this.issues = issues;
  }
}

// ---------------------------------------------------------------------------
// The built catalog
// ---------------------------------------------------------------------------

/**
 * One validated action, paired with the JSON Schema an agent will be shown.
 *
 * `action` is a *normalized copy* of the declaration, not the declaration
 * itself: {@link buildCatalog} resolves the redaction policy onto it and
 * freezes the result. Mutating the original declaration object after the build
 * therefore cannot reach the catalog.
 */
export interface CatalogEntry {
  readonly action: AnyActionDefinition;
  readonly parameters: JsonSchemaObject;
}

type CatalogValidator = (value: unknown) => unknown;

/** Captured validator capabilities stay private even though CatalogEntry is public. */
const validatorByEntry: WeakMap<CatalogEntry, CatalogValidator> = new WeakMap<
  CatalogEntry,
  CatalogValidator
>();

function unusableValidator(): never {
  throw new TypeError("The catalog entry has no captured validator.");
}

/** Read and bind the consumer-owned Standard Schema capability exactly once. */
function captureValidator(action: AnyActionDefinition): CatalogValidator {
  try {
    const schema: unknown = action.schema;
    if ((typeof schema !== "object" && typeof schema !== "function") || schema === null) {
      return unusableValidator;
    }
    const standard: unknown = (schema as PropertyBag)["~standard"];
    if (typeof standard !== "object" || standard === null) {
      return unusableValidator;
    }
    const validate: unknown = (standard as PropertyBag)["validate"];
    if (typeof validate !== "function") {
      return unusableValidator;
    }
    return (value: unknown): unknown => validate.call(standard, value);
  } catch {
    return unusableValidator;
  }
}

/** Invoke only the capability captured while the catalog entry was built. */
export function validateCatalogEntry(
  entry: CatalogEntry,
  value: unknown,
): unknown {
  return (validatorByEntry.get(entry) ?? unusableValidator)(value);
}

/**
 * The frozen result of a successful build.
 *
 * `Name` is derived from the declaration array through {@link buildCatalog}'s
 * `const` type parameter, which is CAT-01's entire mechanism — see the note
 * there.
 *
 * ---------------------------------------------------------------------------
 * `byName` is a frozen null-prototype record, NOT a `Map`, and both halves of
 * that decision are load-bearing
 * ---------------------------------------------------------------------------
 *
 * **1. A frozen `Map` is not frozen.** `Object.freeze` seals a `Map`'s own
 * properties and does nothing whatsoever to its internal `[[MapData]]` slot, so
 * `frozenMap.set(name, evilEntry)` succeeds. Third-party page script could
 * therefore replace an entry *through the lookup* with the entries array itself
 * correctly frozen — SEC-03 breached by the one structure that was supposed to
 * be safe. A plain object's properties are exactly what `Object.freeze` does
 * seal, so the record form is the one that can satisfy the requirement at all.
 *
 * **2. `Object.create(null)` removes the prototype chain**, which is the same
 * protection ROADMAP Phase 6 seeks when it says handler lookup must not be a
 * bare object literal because `dispatch("__proto__")` and
 * `dispatch("constructor")` are test cases. With no prototype there is nothing
 * for either name to resolve to, so a null-prototype frozen record satisfies
 * both constraints where a `Map` satisfies only the second.
 *
 * **This is agreed with Phase 6, not a divergence from it.** The ROADMAP note
 * has been amended to carry this finding. A `Map` remains correct for Phase 6's
 * own **mutable** per-dispatch state — the dedup map, the timer map, the
 * consent map, all allocated lazily on first dispatch — and is wrong for
 * anything that must be frozen. **This record is the frozen one.** If Phase 6's
 * handler lookup reads `catalog.byName` it already has both properties and must
 * **not** be converted to a `Map`; if Phase 6 keeps a separate mutable lookup
 * of its own, that one may be a `Map`, because it is neither frozen nor part of
 * the catalog.
 */
export interface Catalog<Name extends string = string> {
  readonly entries: readonly CatalogEntry[];
  readonly names: readonly Name[];
  readonly byName: Readonly<Record<Name, CatalogEntry>>;
  readonly diagnostics: readonly CatalogDiagnostic[];
}

/**
 * The two knobs on a build.
 *
 * `jsonSchemaTarget` overrides {@link JSON_SCHEMA_TARGET}. Only
 * `"draft-2020-12"` and `"draft-07"` are supported by both emitting vendors;
 * ArkType throws on anything else and Zod silently emits, so a typo'd target
 * surfaces only on an ArkType action.
 *
 * `onDiagnostic` replaces the default sink. **Throwing from it is the supported
 * way to make a diagnostic fatal in your own build** — an app that wants
 * `destructive`-without-consent to fail CI can have that without Concierge
 * choosing it for everyone. The throw propagates by design; see
 * {@link buildCatalog}.
 *
 * Both carry the explicit `| undefined` this repo's `exactOptionalPropertyTypes`
 * requires — without it, building this object from a possibly-absent value is
 * TS2375 at every call site.
 */
export interface BuildCatalogOptions {
  readonly jsonSchemaTarget?: JsonSchemaTarget | undefined;
  readonly onDiagnostic?: ((diagnostic: CatalogDiagnostic) => void) | undefined;
}

// ---------------------------------------------------------------------------
// Validation rules — module-private, one concern each
// ---------------------------------------------------------------------------

/**
 * A value core did not author, viewed as an untyped bag of own properties.
 *
 * Mirrors `PropertyBag` in `./json-schema.ts` for the same reason: the declared
 * types describe what a *TypeScript* consumer can express, and every rule below
 * has to survive a JavaScript consumer who expressed something else.
 */
type PropertyBag = Record<string, unknown>;

/**
 * Is this declaration's `schema` actually a Standard Schema validator?
 *
 * **This closes the DX-03 gap plan 03-02 handed forward.** `vendorOf` is the
 * plain documented read, `schema["~standard"].vendor`, and `emitSchema` calls it
 * on its first line. An action whose `schema` is missing, `null`, or a plain
 * object therefore produces a raw `TypeError` with no action name and no fix —
 * exactly the failure DX-03 exists to prevent, and the one shape a JavaScript
 * consumer hits most easily (passing the *inferred type* instead of the
 * validator, or forgetting the field entirely). 03-02's threat model covers the
 * `jsonSchema` escape hatch rather than `schema`, so it correctly declined to
 * harden out of scope and named `buildCatalog` as the owner. This is that.
 *
 * The test mirrors `hasJsonSchemaConverter`: `typeof` checks on each hop rather
 * than `"~standard" in schema`, because `in` walks the prototype chain of an
 * object this function did not author.
 *
 * **`typeof schema === "function"` is admitted, and leaving it out is a
 * catastrophic false positive rather than a small gap.** Measured this phase: an
 * **arktype** validator instance is a `function` — `type({id: "string"})` returns
 * a callable carrying `~standard` as a property — while zod and valibot
 * instances are plain objects. A guard written as `typeof schema !== "object"`
 * compiles, typechecks, and rejects **every arktype action in existence** with a
 * confident message saying their validator is not a Standard Schema validator.
 * `hasJsonSchemaConverter` in `./json-schema.ts` never hit this because it reads
 * `schema["~standard"]` without testing `schema` itself; this guard exists
 * precisely to make that read safe, so it is the one place the distinction
 * matters. The bug was caught by running a real arktype action through
 * `buildCatalog` before shipping, not by the checker.
 *
 * A useful consequence downstream: because {@link deepFreeze} returns early on
 * anything that is not `typeof "object"`, an arktype validator is skipped from
 * the freeze walk automatically and never needs to enter the `skip` set at all.
 * Only the object-shaped validators do.
 *
 * **Residual, deliberately not closed here — and narrower than first recorded.**
 * An `actions` array containing `null` or `undefined` throws a raw `TypeError` on
 * the `action.name` read before any rule runs. A structured issue needs an action
 * *name* to report, and that shape has none; inventing a sentinel would pollute
 * the `action` field that DX-03 tests assert on.
 *
 * This paragraph previously also claimed a **string** element throws. Measured at
 * phase close: it does not. `"x".name` is `undefined` rather than a throw, so a
 * string — and a number — reach the rules and produce a proper structured error.
 * Only `null` and `undefined` escape as a raw `TypeError`. The correction narrows
 * the documented exception to DX-03's "every build-time error names the action";
 * it does not widen it.
 */
function hasStandardSchema(action: AnyActionDefinition): boolean {
  const schema: unknown = action.schema;
  if ((typeof schema !== "object" && typeof schema !== "function") || schema === null) {
    return false;
  }
  const std: unknown = (schema as PropertyBag)["~standard"];
  if (typeof std !== "object" || std === null) {
    return false;
  }
  return typeof (std as PropertyBag)["vendor"] === "string";
}

/**
 * Read `redact` as the untyped value it actually is at runtime.
 *
 * `ActionDefinition.redact` is **not** optional, so `action.redact === undefined`
 * is TS2367 ("no overlap") and `action.redact ?? "drop"` is TS2869 ("right
 * operand unreachable"). Both errors are the checker correctly describing the
 * TypeScript surface — and both would make SEC-01's runtime half unwritable,
 * because the entire population this rule exists for is JavaScript consumers who
 * omitted the field the type says they cannot omit.
 *
 * `Object.hasOwn`, not `in`: a `redact` inherited from a polluted prototype is
 * not a declared policy and must not be read as one.
 */
function declaredRedaction(action: AnyActionDefinition): unknown {
  const view: PropertyBag = action as unknown as PropertyBag;
  return Object.hasOwn(view, "redact") ? view["redact"] : undefined;
}

/**
 * Read the consent policy's target as the untyped value it actually is at
 * runtime — the read CAT-03's post-pass is built on.
 *
 * Two hops, and **both are `Object.hasOwn` rather than `in`**, for the reason
 * {@link declaredRedaction} gives: `in` walks the prototype chain of an object
 * this function did not author. A polluted `requires` reachable from
 * `Object.prototype` would otherwise make every action in the catalog appear to
 * declare a consent target, and the rule below would then check that phantom
 * target for existence and report on it by name.
 *
 * `ConsentPolicy.requires` is typed `string` and is **required**, so a
 * TypeScript consumer cannot express anything else. A JavaScript one can write
 * `consent: null`, `consent: {}`, or `requires: 42`, and none of those may throw
 * during a build — the population this read exists for is precisely the
 * population the declared type cannot describe.
 *
 * **Residual, deliberately not closed here.** A `consent` policy carrying no
 * `requires`, or a non-string one, is skipped silently: this returns the value
 * as-is and the caller's `typeof` guard drops it without an issue. CAT-03's
 * wording is *"a `consent.requires` target does not exist in the catalog"*, and
 * a `requires` that is absent has no target to check.
 *
 * State the uncomfortable half plainly: this is arguably the *worse* of the two
 * failures, because a consent policy with no target is a gate that silently does
 * not exist at all, which is the same class of defect CAT-03 was written to
 * catch. It is recorded rather than fixed because closing it means a third code
 * with a genuinely different `fix` — "the policy names nothing to wait for" — and
 * no requirement in this phase asks for one. It is scheduled against Phase 8's
 * consent kernel, which is the first code that reads this value at runtime and
 * therefore the first code that can be wrong about it. That correction would
 * widen this rule; it does not change what the two codes below already mean.
 */
function consentRequiresOf(action: AnyActionDefinition): unknown {
  const view: PropertyBag = action as unknown as PropertyBag;
  if (!Object.hasOwn(view, "consent")) {
    return undefined;
  }

  const consent: unknown = view["consent"];
  if (typeof consent !== "object" || consent === null) {
    return undefined;
  }

  const policy: PropertyBag = consent as PropertyBag;
  return Object.hasOwn(policy, "requires") ? policy["requires"] : undefined;
}

/**
 * Does this emitted schema accept any caller-supplied argument at all?
 *
 * **The obvious test is wrong, and the way it is wrong is a silent leak of
 * enforcement rather than a crash.** `Object.keys(parameters.properties ?? {}).length > 0`
 * reads as "does it declare members". Measured against the installed packages at
 * `draft-2020-12`:
 *
 * | Fixture                    | `properties`  | `propertyNames` | `additionalProperties` |
 * |----------------------------|---------------|-----------------|------------------------|
 * | `z.object({key, value})`   | present, 2    | absent          | absent                 |
 * | `z.object({})`             | present, `{}` | absent          | absent                 |
 * | arktype `type({})`         | **absent**    | absent          | absent                 |
 * | `z.record(z.string(), …)`  | **absent**    | **present**     | **present**, an object |
 *
 * So absence of `properties` means two completely different things depending on
 * the vendor and the construct. Under the naive test `z.record` — arbitrary
 * caller-supplied keys *and* values, the most redaction-sensitive shape there is
 * — is classified EMPTY and silently defaulted to `"drop"`. That fails closed
 * against leaks, which is why it is easy to miss, but it leaves SEC-01's
 * "required at declaration time" clause unenforced exactly where it matters
 * most, with the author never asked.
 *
 * A schema is therefore **NON-EMPTY when ANY of these holds**:
 *
 * 1. `properties` is an object with at least one own key;
 * 2. `propertyNames` is present;
 * 3. `patternProperties` is present;
 * 4. `additionalProperties` is present **and is not `false`**.
 *
 * **Condition 4 is `present and not false`, never the shorter
 * `additionalProperties !== false`.** The short form reads an absent key as
 * `undefined`, which is not `false`, which would make `z.object({})` — the
 * genuinely empty case, and the one every test writes — a build failure. The
 * measured table above is what settles it: the key is absent on all three
 * non-record rows.
 *
 * **All four keys are read through a {@link PropertyBag} view, not through
 * `JsonSchemaObject`'s declared members.** `JsonSchemaObject.additionalProperties`
 * is declared `boolean`; the measured `z.record` emission puts a schema *object*
 * there (`{type: "string"}`). The declaration is narrower than reality. The
 * `types.ts` amendment is deliberately NOT made — 03-CONTEXT forbids touching
 * that file this phase — so the divergence is recorded as a Phase 4 note in
 * `03-03-SUMMARY.md`.
 *
 * `Object.keys` and `Object.hasOwn`, never `for...in`: a hostile emitted schema
 * may carry a polluted prototype, and own-key semantics are the whole point.
 * Neither reads through a getter, so nothing here executes application code.
 */
function hasDeclaredParameters(parameters: JsonSchemaObject): boolean {
  const view: PropertyBag = parameters as PropertyBag;

  if (Object.hasOwn(view, "properties")) {
    const properties: unknown = view["properties"];
    if (
      typeof properties === "object" &&
      properties !== null &&
      Object.keys(properties).length > 0
    ) {
      return true;
    }
  }

  if (Object.hasOwn(view, "propertyNames")) {
    return true;
  }

  if (Object.hasOwn(view, "patternProperties")) {
    return true;
  }

  if (Object.hasOwn(view, "additionalProperties")) {
    return view["additionalProperties"] !== false;
  }

  return false;
}

/**
 * Drop the `action "name": ` opener {@link SchemaEmission.detail} carries.
 *
 * `./json-schema.ts` authors each `detail` as a **complete standalone
 * sentence**, from a time when it was the whole message. Embedded into a
 * {@link CatalogIssue} — which already has an `action` field, and whose
 * formatter already prints `action "name": ` — that opener is printed twice:
 * `[schema_not_emittable] action "noHatch": action "noHatch": its validator …`.
 * Measured, before this existed.
 *
 * The prefix is reconstructed from `name` and compared exactly, so this cannot
 * strip anything it did not put together itself. If `json-schema.ts` ever stops
 * emitting the opener, nothing matches and nothing is removed — the failure mode
 * is a no-op, never a truncated diagnosis. Nothing else is stripped for exactly
 * that reason: the *remedy* `detail` also carries has no reliable boundary, and
 * a heuristic that guessed wrong would silently delete the vendor-specific
 * diagnosis, which is the part only `json-schema.ts` can produce.
 *
 * **The structural repair, and who owns it now.** Splitting `SchemaEmission`
 * into `{diagnosis, remedy}` would let a caller place each half itself and make
 * this function unnecessary. Phase 4 considered it and deliberately declined:
 * it is a `json-schema.ts` contract change that needs its own decision, not a
 * side effect of a phase whose subject is stage scoping. It is deferred with
 * that reasoning recorded rather than left unowned.
 *
 * The observable consequence of deferring is unchanged and is measured, so it
 * cannot rot silently: every `schema_not_emittable` issue carries a hardcoded
 * `fix` naming valibot unconditionally, whatever the actual vendor was.
 * `test/emission.test.ts` case 5 is what pins that. Until the split lands, the
 * `fix` field is written to *add* to the detail's own closing remedy rather than
 * restate it.
 */
function withoutActionPrefix(detail: string, name: string): string {
  const prefix = `action "${name}": `;
  return detail.startsWith(prefix) ? detail.slice(prefix.length) : detail;
}

/**
 * Where a diagnostic goes when the consumer supplied no `onDiagnostic`.
 *
 * The warning is the convenience channel; `catalog.diagnostics` is the
 * assertable one. A console warning alone would be an annotation nothing reads
 * and nothing can test, which is the failure `types.ts:975-984` names for
 * `readsUntrusted` specifically.
 */
function defaultDiagnosticSink(diagnostic: CatalogDiagnostic): void {
  warnHost(
    `concierge: [${diagnostic.code}] action ${encodeDiagnosticSubject(diagnostic.action)}: ` +
      `${diagnostic.problem} Fix: ${diagnostic.fix}`,
  );
}

/**
 * Freeze a value and everything reachable from it by data property.
 *
 * **The shallow form is not a cheaper version of this — it is a breach that
 * reports success.** Re-measured in ESM strict mode this phase: with the entries
 * array frozen and the entries themselves not,
 * `catalog[0].action.handler = attackerFn` did **not** throw, the replacement
 * handler ran, and `Object.isFrozen(catalog)` still returned `true`. Any SEC-03
 * test that asserts only `Object.isFrozen` passes on the breached build.
 *
 * **`skip` holds every `action.schema`.** Freezing a validator's internals is
 * untested and not obviously safe — zod and arktype were measured to keep
 * validating after their *emitted* schema is frozen, but that is a different
 * object. SEC-03 names the handler, not the validator, so the validator is left
 * alone.
 *
 * **`seen` is a `WeakSet` and carries cycles.** A declaration graph may contain
 * one; the recursion has to terminate on it without a depth cap that would
 * silently stop freezing partway down.
 *
 * **Accessors are skipped, and the check is `"value" in descriptor`.** Reading
 * `descriptor.value` on an accessor would be `undefined`, harmless; reading
 * `target[key]` instead would *invoke the getter*, executing application code
 * during catalog build. Measured: `Reflect.getOwnPropertyDescriptor` on an
 * accessor returns a descriptor with no `value` key and does not run the getter,
 * so the descriptor read itself is safe and the `in` test is exact.
 *
 * **Do NOT add the `Object.isFrozen(value) → return` early-out** that
 * `03-RESEARCH.md` sketches. Measured this phase: it skips the *children* of an
 * already-frozen object, and the `jsonSchema` escape hatch a consumer supplies
 * may well be frozen at the top with mutable children — the probe froze such an
 * object, ran the early-out form, and then successfully replaced
 * `hatch.properties.a`. `seen` is what makes the recursion terminate; frozenness
 * is not a proxy for "already walked".
 *
 * Functions fall out at the `typeof !== "object"` guard and are never frozen.
 * That is deliberate: SEC-03 asserts that a handler cannot be *replaced*, and
 * the frozen record is what stops replacement. Freezing the function object
 * itself would additionally stop a consumer decorating their own handler's
 * properties, which is not asked for and not ours to prevent.
 *
 * **Why a stage-scoped projection has to seal its own array — and it is not
 * `filter` that makes it so.** `frozenArray.filter(...)` returns a **new,
 * unfrozen** array — measured, `Object.isFrozen` is `false` on the result. So a
 * per-stage catalog is NOT frozen merely because the catalog it was projected
 * from was, and whatever builds that projection has to freeze what it returns.
 *
 * Re-measured this phase, and wider than first recorded: `map`, `slice`, spread,
 * `concat`, `flat`, `toReversed` and `Array.from` all return `false` from
 * `Object.isFrozen` on their result too. This is a property of every
 * array-producing method rather than anything specific to `filter`, so choosing
 * a different projection method is not a way around the obligation. The
 * correction widens what was documented; it does not narrow it.
 *
 * What a projection does **not** need is a second walk through this function.
 * Measured against a deep-frozen source: the projected elements are shared by
 * reference with the original and are still frozen through the projection, so
 * the only unfrozen object a projection introduces is its own array — and a
 * plain `Object.freeze` on that array is therefore sufficient. Calling
 * `deepFreeze` per projection is correct, 510× slower, and hides the coupling
 * that makes the cheap form safe.
 *
 * One accepted consequence: when the emission `source` is `"explicit"`, the
 * `parameters` object *is* the consumer's own `jsonSchema` by reference (03-02
 * measured the identity), so building a catalog freezes it. That is the right
 * outcome — it has become the agent-facing contract — but it is a visible effect
 * on an object the consumer still holds, so it is stated rather than discovered.
 *
 * **Exported, and yet deliberately not public.** The `export` keyword exists for
 * `src/concierge.ts`'s `explain()`, which returns a deep-frozen structure and
 * needs exactly this walk; it is there for that and for nothing else. It is
 * **not** re-exported from `src/index.ts`, so it stays off the package's public
 * surface — and that is mechanical rather than a matter of discipline:
 * `test/export-surface.test.ts` parses only the trailing bare `export { … };`
 * block of `dist/index.d.ts`, so a symbol exported from a module but never
 * re-exported from the barrel cannot reach the count.
 *
 * Rejected: a hand-written six-line freeze in the calling module instead. It
 * would have to independently reproduce a cycle-safe `WeakSet`, an accessor skip
 * that does not invoke getters, and the documented refusal to early-out on
 * `Object.isFrozen` above — three properties a re-implementation does not
 * rediscover by reasoning about them. It rediscovers them as bug reports.
 */
export function deepFreeze<T>(value: T, skip: ReadonlySet<object>, seen: WeakSet<object>): T {
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const target: object = value as object;
  if (skip.has(target) || seen.has(target)) {
    return value;
  }
  seen.add(target);
  Object.freeze(target);

  for (const key of Reflect.ownKeys(target)) {
    const descriptor: PropertyDescriptor | undefined =
      Reflect.getOwnPropertyDescriptor(target, key);
    if (descriptor === undefined) {
      continue;
    }
    if (!("value" in descriptor)) {
      continue;
    }
    deepFreeze(descriptor.value, skip, seen);
  }

  return value;
}

// ---------------------------------------------------------------------------
// The build
// ---------------------------------------------------------------------------

/**
 * Validate every declaration, aggregate every problem into one throw, report the
 * two non-blocking markers, and return a frozen catalog.
 *
 * ---------------------------------------------------------------------------
 * CAT-01 has TWO mechanisms, and the `const` modifier is only one of them
 * ---------------------------------------------------------------------------
 *
 * An earlier version of this comment said the `const` type parameter was
 * "CAT-01's entire mechanism". Plan 03-05 measured that claim and it is true
 * only for **raw object literals**. Both mechanisms are load-bearing, and each
 * covers a call-site shape the other does not:
 *
 * 1. The `const` modifier on the type parameter carries the union on the
 *    **raw-literal** path — `buildCatalog([{name: "rawOne", …}, …])`. Measured
 *    across 50 actions: with the modifier `catalog.names` derives
 *    `"action00" | "action01" | … | "action49"`; with a plain
 *    `readonly AnyActionDefinition[]` parameter it derives `string`, and every
 *    downstream literal — stage scoping, `dispatch` name checking, the emitted
 *    tool list — loses its precision with no error anywhere.
 * 2. The **return type** carries it on every path, including the documented one.
 *    Where each element was produced by `defineAction`, its `N` parameter has
 *    already fixed the literal before this function is reached, so `A` is
 *    inferred from values that cannot widen — and dropping the `const` modifier
 *    changes nothing at all. Widening the return annotation to `Catalog<string>`
 *    destroys CAT-01 on exactly the path the documentation addresses, and the
 *    raw-literal predicates cannot see it.
 *
 * `test-d/catalog.test-d.ts` therefore keeps two assertion blocks over the same
 * shapes. They are not duplicates: the raw-literal block is the only detector
 * for mechanism 1 and the `defineAction` block is the only detector for
 * mechanism 2. Consolidating them leaves a live mutation undetected.
 *
 * `AnyActionDefinition` works as the element constraint: its `any`-erasure of
 * `Snapshot`/`AckPayload` (`types.ts:997-1011`) admits heterogeneous
 * declarations while `const` inference still recovers each element's concrete
 * `name`.
 *
 * **A known DX defect, measured and not yet fixed.** Calling `defineAction`
 * *inline* in this function's argument — the most natural spelling there is —
 * loses the name union: the contextual `AnyActionDefinition` has `name: string`,
 * and it binds `defineAction`'s own name parameter to `string` before the `name`
 * property is consulted. `as const` on the array does not help. Declare each
 * action as its own `const` first, or supply `defineAction`'s type arguments
 * explicitly. `_inlineDefineActionLosesTheUnion` in `test-d/catalog.test-d.ts`
 * pins the defect; if it goes red the gap has closed and the pin should be
 * deleted rather than relaxed.
 *
 * A test asserting on the derived union must not expect the full text: `tsc`
 * truncates large unions in diagnostics, and the 50-name union printed as
 * `"action00" | … | "action13" | ... 35 more ... | "action49"`.
 *
 * ---------------------------------------------------------------------------
 * `assertSingleInstance()` is the first statement, and both halves matter
 * ---------------------------------------------------------------------------
 *
 * **This is the first production call site the PKG-04 guard has ever had.**
 * Phase 2 shipped it with none; ROADMAP Phase 3 SC-5 exists because
 * `02-VERIFICATION.md` finding W5 noticed.
 *
 * Here rather than anywhere else, for three reasons in order of force:
 *
 * 1. **Module scope does not survive `"sideEffects": false`.** 02-06 measured a
 *    module-evaluation-time registration deleted from the consumer bundle while
 *    remaining present under `node dist/index.js` — it would test green in Node
 *    and do nothing in every React or Svelte app, which is the only place two
 *    copies of core can collide.
 * 2. **`defineAction` would fire it once per action.** It is an identity
 *    function called N times per app; the guard is a once-per-process assertion.
 * 3. **`buildCatalog` is the earliest entry point every consumer necessarily
 *    reaches.** There is no way to use this package without a catalog.
 *
 * ---------------------------------------------------------------------------
 * SEC-01's two branches, and the reading of the requirement that produces them
 * ---------------------------------------------------------------------------
 *
 * SEC-01 reads: *"Redaction is required for any action with a non-empty schema
 * and defaults to `drop`."* Two clauses that appear to contradict — a hard
 * requirement and a default cannot both govern the same declaration, because
 * whichever applies makes the other unreachable.
 *
 * The reading taken here is that the **scope clause reconciles them**: the
 * requirement is scoped to non-empty schemas, and the default covers everything
 * outside that scope. So:
 *
 * - **non-empty schema, no `redact`** → a build-failing `redaction_missing`
 *   issue naming the action. There are arguments, so the author is the only one
 *   who can know whether they are safe to record, and SEC-01's "required at
 *   declaration time" clause is what makes them answer.
 * - **empty schema, no `redact`** → resolves to `"drop"`, with no issue and no
 *   diagnostic. There are no arguments to leak, so failing the build would be
 *   pure noise on the commonest possible declaration.
 *
 * Neither branch ever resolves to `"passthrough"`. ROADMAP SC-4's "an
 * unspecified redaction policy drops arguments rather than passing them through"
 * holds in both, which is the property that actually matters.
 *
 * A reviewer who reads the scope clause differently — as decoration on a
 * universal requirement, making *every* missing `redact` a build failure — would
 * ship a stricter rule. That reading is defensible; it is rejected only because
 * it makes the "defaults to `drop`" clause dead text. The disagreement is stated
 * here so it can be had directly rather than reverse-engineered from behaviour.
 *
 * ---------------------------------------------------------------------------
 * Issues aggregate; the diagnostic sink is deliberately unguarded
 * ---------------------------------------------------------------------------
 *
 * Every issue is collected and thrown once, together. A developer declaring
 * twenty actions with twenty problems sees twenty problems in one run rather
 * than twenty fix-and-rebuild cycles.
 *
 * Diagnostics dispatch *after* the throw check, so a failing build reports its
 * failures and nothing else. The sink is **not** wrapped in `try`/`catch`: a
 * consumer hook that throws is the supported mechanism for making a diagnostic
 * fatal in their own build (T-03-17, disposition **accept**), and catching it
 * would silently defeat the one lever that keeps SEC-05's marker from being an
 * annotation nothing reads.
 *
 * @throws {CatalogValidationError} when any declaration fails a rule. The error
 * carries every issue as structured `{code, action, vendor?, problem, fix}`.
 */
export function buildCatalog<const A extends readonly AnyActionDefinition[]>(
  actions: A,
  options?: BuildCatalogOptions,
): Catalog<A[number]["name"]> {
  assertSingleInstance();

  const target: JsonSchemaTarget = options?.jsonSchemaTarget ?? JSON_SCHEMA_TARGET;

  const issues: CatalogIssue[] = [];
  const diagnostics: CatalogDiagnostic[] = [];
  const seenNames: Set<string> = new Set<string>();
  const entries: CatalogEntry[] = [];
  const names: string[] = [];
  const validators: Set<object> = new Set<object>();

  // What CAT-03's post-pass iterates: one entry per DISTINCT declared name,
  // whatever else went wrong with that declaration. Neither array already in
  // scope can play this role, and both alternatives were measured before this
  // one was added.
  //
  // `actions` DOUBLE-reports: two same-named actions carrying the same consent
  // typo produce two identical issues, and one of the two is advice about a
  // declaration the developer is about to delete anyway.
  //
  // `entries` UNDER-reports: an action that failed its schema rule `continue`s
  // and never reaches `entries`, so its consent typo stays invisible until the
  // schema is fixed and the build re-run. That is a second fix-and-rebuild
  // cycle, which is the exact failure the aggregation rule documented above
  // exists to prevent.
  //
  // Accepted consequence: the second occurrence of a duplicate name never
  // enters this array, so its consent policy is never examined. That is correct
  // — a duplicate is already a build failure, and analysing the copy that is
  // about to be renamed produces advice about a declaration that will not exist.
  const declared: AnyActionDefinition[] = [];

  for (const action of actions) {
    // CAT-01 — a duplicate name makes the agent's address space ambiguous.
    //
    // The `fix` states the SCOPE as well as the remedy, because scope is the one
    // genuinely surprising part: stage scoping does **not** namespace an action
    // name. Two stages may each declare `applyFilter` and that is a build
    // failure, which surprises people who reasonably expect a stage to behave
    // like a module. Measured, unmodified: an action declared in both a stage
    // and in `crossStage` produces this same issue today with no new code — the
    // correct outcome, since `crossStage` already means "available in every
    // stage", so re-declaring it inside one is redundant rather than additive.
    //
    // This function cannot do better than say so in words. `CatalogIssue` is
    // `{code, action, vendor?, problem, fix}` and `buildCatalog` receives a flat
    // action array with no concept of a stage, so it cannot name the two stages
    // involved. Rejected for Phase 4: adding `stage?` to `CatalogIssue` plus an
    // `origins?` parallel array to `BuildCatalogOptions`. That would enrich
    // every code rather than this one — `redaction_missing` in stage "checkout"
    // is genuinely more useful in a 40-stage app — but it is two new public
    // fields and a new parallel-array invariant that no requirement in this
    // phase asks for. Recorded so a later phase can adopt it without
    // re-deriving the design. The developer's fallback meanwhile is one grep for
    // the name, which returns exactly the two hits that are the answer.
    if (seenNames.has(action.name)) {
      issues.push({
        code: "duplicate_action_name",
        action: action.name,
        problem: "two actions share this name, so an agent calling it cannot address either one unambiguously.",
        fix: "rename one of them. An action name is global across every stage and across `crossStage` — the same name may not be declared twice even in different stages.",
      });
      continue;
    }
    seenNames.add(action.name);
    declared.push(action);

    // DX-03 — reach `vendorOf` only once the read is known to be safe.
    if (!hasStandardSchema(action)) {
      issues.push({
        code: "schema_not_emittable",
        action: action.name,
        problem: "its `schema` is not a Standard Schema validator — it has no `~standard` property carrying a `vendor`, so no schema can be derived and no vendor can be named.",
        fix: "set `schema` to a validator instance from zod, arktype, valibot or another Standard Schema library — not to an inferred type, a plain object, or a JSON Schema.",
      });
      continue;
    }

    // CAT-02 / CAT-06 — the emission order is `./json-schema.ts`'s contract.
    const emission: SchemaEmission = emitSchema(action, target);
    if (!emission.ok) {
      const rootFailure: boolean = emission.reason === "root_not_object";
      issues.push({
        code: rootFailure ? "schema_root_not_object" : "schema_not_emittable",
        action: action.name,
        vendor: emission.vendor,
        problem: withoutActionPrefix(emission.detail, action.name),
        fix: rootFailure
          ? "wrap the schema in an object, or move the union inside a property."
          : "supply an explicit `jsonSchema` on the action, or switch to a validator that implements Standard JSON Schema — zod 4.2+ and arktype 2.1.28+ do; valibot 1.4.2 does not.",
      });
      continue;
    }

    const parameters: JsonSchemaObject = emission.parameters;

    // SEC-01 — see the two-branch reading above.
    const redaction: unknown = declaredRedaction(action);
    const redactionMissing: boolean = redaction === undefined;
    if (redactionMissing && hasDeclaredParameters(parameters)) {
      issues.push({
        code: "redaction_missing",
        action: action.name,
        problem: "its schema accepts arguments but it declares no `redact` policy, so nothing states whether those arguments may reach telemetry.",
        fix: 'add `redact: "drop"` to the declaration, or a projection function if some arguments are safe to record.',
      });
    }

    // CAT-05 — reports, never blocks. One diagnostic per action, each named.
    if (action.effects?.destructive === true && action.consent === undefined) {
      diagnostics.push({
        code: "destructive_without_consent",
        action: action.name,
        problem: "it declares `effects.destructive` but carries no `consent` policy, so an agent can take an irreversible action with no human having confirmed this specific payload.",
        fix: "add a `consent` policy, or set `effects.destructive` to false if the action is reversible.",
      });
    }

    // SEC-05 — same shape, distinct code, so a consumer can filter one alone.
    if (action.readsUntrusted === true && action.consent === undefined) {
      diagnostics.push({
        code: "reads_untrusted_without_consent",
        action: action.name,
        problem: "it declares `readsUntrusted` but carries no `consent` policy, so attacker-controllable content can steer it with no human in the loop.",
        fix: "add a `consent` policy, so a human confirms this specific payload before attacker-controllable content can steer the action.",
      });
    }

    // A shallow copy with the redaction resolved. `buildCatalog` returns a NEW
    // frozen catalog rather than mutating its input, so page script mutating the
    // original declaration after the build cannot reach the catalog. `{...action}`
    // copies own enumerable properties only, so a `__proto__` key on the input
    // cannot pollute the copy.
    //
    // **The spread reads through accessors, and that is load-bearing rather than
    // an oversight.** Measured: a declaration carrying a getter has that getter
    // INVOKED here, once, during the copy — `deepFreeze` is not the only reader.
    // The alternative (`Object.getOwnPropertyDescriptors` + `defineProperties`)
    // would preserve the accessor instead of invoking it, and that is strictly
    // worse for SEC-03: `Object.freeze` does not stop an accessor returning a
    // different value on each read, so a getter-backed `handler` would still be
    // swappable on a fully frozen catalog. The spread is what converts every
    // accessor into a fixed data property, which is the thing the freeze can
    // then actually hold down. `deepFreeze`'s accessor skip covers what the
    // spread does not flatten: `effects`, `consent`, `parameters`, and anything
    // nested below them.
    const normalized: AnyActionDefinition = redactionMissing
      ? { ...action, redact: "drop" }
      : { ...action };

    // The `deepFreeze` skip set. Only object-shaped validators need an entry:
    // an arktype instance is a `function` and is skipped by the walk's own
    // `typeof !== "object"` guard. See `hasStandardSchema`.
    const validator: unknown = normalized.schema;
    if (typeof validator === "object" && validator !== null) {
      validators.add(validator);
    }

    const entry: CatalogEntry = { action: normalized, parameters };
    validatorByEntry.set(entry, captureValidator(normalized));
    entries.push(entry);
    names.push(action.name);
  }

  // CAT-03 — a consent policy whose target does not exist, or which points at
  // the referring action itself.
  //
  // **This is a POST-PASS over the complete declared-name set, and the placement
  // IS the rule.** Both placements were implemented and run over seven scenarios
  // before this one was chosen; the choice is measured, not argued.
  //
  // Inside the loop above, the check produces a **false positive** on every
  // forward reference — a target declared later has simply not been added to the
  // name set yet when the check fires. `createConcierge` assembles its argument
  // as stage actions followed by cross-stage actions, so under the in-loop form
  // *every* consent policy naming a cross-stage action fails the build. A rule
  // that rejects every legitimate build is a rule that gets deleted, which
  // leaves CAT-03 unenforced by the shortest possible route.
  //
  // The in-loop form also misses self-reference entirely: `seenNames.add` has
  // already run by the time the check would fire, so the action's own name is
  // always found and the self-reference branch is unreachable.
  //
  // **The set CHECKED is `seenNames`, not `entries`.** `seenNames` holds every
  // distinct *declared* name, including names belonging to actions that later
  // failed their own schema rule and `continue`d. That is the right set: an
  // action pointing at a target which exists but has a broken schema should see
  // the broken schema reported once, not additionally be told its target does
  // not exist. Reporting both is a cascade — one fault rendered as two, with the
  // second one false.
  //
  // **Ordering consequence, and a test must not assume otherwise.** These issues
  // append after every per-action issue rather than interleaving in declaration
  // order. Restoring declaration order would mean carrying an origin index on
  // every issue: new structure for cosmetic gain, rejected. Aggregation itself
  // is untouched — a consent typo alongside three other faults still throws
  // exactly once, carrying four issues.
  //
  // Self-reference is tested FIRST, and the two branches are one `else if`
  // rather than two `if`s. A self-reference implies the target exists, so the
  // two can never both fire for one action; writing it this way makes that
  // mutual exclusivity structural rather than incidental.
  for (const action of declared) {
    const requires: unknown = consentRequiresOf(action);
    if (typeof requires !== "string") {
      continue;
    }

    if (requires === action.name) {
      const issue: CatalogIssue = {
        code: "consent_self_reference",
        action: action.name,
        problem: `its consent policy requires "${requires}", which is the action itself — arming the gate would mean running the very action the gate blocks, so it can never be satisfied.`,
        fix: "point `consent.requires` at the review action that should run first, or remove the `consent` policy if this action needs no gate.",
      };
      displayByIssue.set(issue, {
        problem: `its consent policy requires ${encodeDiagnosticSubject(requires)}, which is the action itself — arming the gate would mean running the very action the gate blocks, so it can never be satisfied.`,
        fix: issue.fix,
      });
      issues.push(issue);
    } else if (!seenNames.has(requires)) {
      const issue: CatalogIssue = {
        code: "consent_target_missing",
        action: action.name,
        problem: `its consent policy requires "${requires}", and no action by that name is declared in this catalog — so the gate can never arm and the action is permanently blocked.`,
        fix: `declare an action named "${requires}", or correct the spelling in \`consent.requires\`. The target may live in any stage, or in \`crossStage\`.`,
      };
      const displayRequires: string = encodeDiagnosticSubject(requires);
      displayByIssue.set(issue, {
        problem: `its consent policy requires ${displayRequires}, and no action by that name is declared in this catalog — so the gate can never arm and the action is permanently blocked.`,
        fix: `declare an action named ${displayRequires}, or correct the spelling in \`consent.requires\`. The target may live in any stage, or in \`crossStage\`.`,
      });
      issues.push(issue);
    }
  }

  if (issues.length > 0) {
    throw new CatalogValidationError(issues);
  }

  const sink: (diagnostic: CatalogDiagnostic) => void =
    options?.onDiagnostic ?? defaultDiagnosticSink;
  for (const diagnostic of diagnostics) {
    sink(diagnostic);
  }

  const byName: Record<string, CatalogEntry> = Object.create(null);
  for (const entry of entries) {
    byName[entry.action.name] = entry;
  }

  type Name = A[number]["name"];
  const catalog: Catalog<Name> = {
    entries,
    names: names as readonly Name[],
    byName: byName as Readonly<Record<Name, CatalogEntry>>,
    diagnostics,
  };

  return deepFreeze(catalog, validators, new WeakSet<object>());
}
