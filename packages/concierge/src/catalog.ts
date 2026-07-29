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
import { warnHost } from "./host.js";
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
 */
export type CatalogIssueCode =
  | "duplicate_action_name"
  | "schema_not_emittable"
  | "schema_root_not_object"
  | "redaction_missing";

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
    `concierge: ${issues.length} problem(s) in the action catalog.`,
  ];
  for (const issue of issues) {
    lines.push(
      `  [${issue.code}] action "${issue.action}": ${issue.problem} ` +
        `Fix: ${issue.fix}`,
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
