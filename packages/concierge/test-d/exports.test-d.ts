// SC-7d, at the entrypoint — the `MESSAGE_MAX_CHARS` export-placement guard.
// This is the second of the two test-coverage items Phase 1 deferred into
// Phase 2 (`STATE.md` § Deferred Items, deferred at plan 01-09). It landed here
// rather than there because adding it changes the diagnostic set of the
// type-test program, and Phase 1's own gate battery had pinned that set.
//
// WHAT ESCAPES WITHOUT THIS FILE
//
// `verbatimModuleSyntax` enforcement is **one-directional**. A *type* written
// into the value-export block of `../src/index.ts` is TS1205 and nobody can
// miss it. A *value* moved the other way — out of the value block and into the
// `export type { … }` block — is silently legal in both directions that matter:
// `tsc -p tsconfig.test-d.json` exits **0**, the emit build exits **0**, and
// `dist/index.js` quietly loses the runtime binding. A consumer's
// `import { MESSAGE_MAX_CHARS } from "@fullselfbrowsing/concierge"` then
// resolves to `undefined` at runtime with no diagnostic anywhere in this
// repository. Measured against the real `src/`, not assumed — the verified trap
// table is `02-RESEARCH.md:689-701`.
//
// WHY A SEPARATE FILE, AND WHY IT MUST NOT BE CONSOLIDATED
//
// `results.test-d.ts` already pins this constant, and its `_messageBound`
// imports `MESSAGE_MAX_CHARS` from `../src/types.js` — the module where the
// declaration lives and where the regression does not happen. It is therefore
// **structurally blind** to this defect: under the mutation it still exits 0.
// The two guards read different modules on purpose and neither replaces the
// other. `_messageBound` pins the literal type at the *declaration*; the
// predicate below pins the export placement at the *public entrypoint*. Merging
// them into one file with one import deletes exactly one of the two guarantees,
// and it is the one nothing else in the repository has.
//
// THE DIAGNOSTIC IS TS1485, AT THE IMPORT LINE — NOT TS2344 AT THE ASSERTION
//
//   error TS1485: 'MESSAGE_MAX_CHARS' resolves to a type-only declaration and
//   must be imported using a type-only import when 'verbatimModuleSyntax' is
//   enabled
//
// Every other predicate in this directory fails as `Type 'false' does not
// satisfy the constraint 'true'` on the aliased line. This one does not, because
// the program stops resolving the value before the assertion is ever evaluated.
// A reader expecting TS2344 will read the wrong line and conclude the file is
// fine. Mutant P8 observes the real thing.
//
// This file declares nothing to the outside world. The imports below already
// give it module status, which is what keeps `isolatedDeclarations` from
// treating the alias as declaration-emitting (TS9010). The predicate is on ONE
// line however long — `tsc` echoes only the line the failing type argument sits
// on, so the alias name is the entire carrier of meaning. Do not let a formatter
// wrap it.

import type { Equals, Expect } from "./_assert.js";
import { MESSAGE_MAX_CHARS } from "../src/index.js";   // ← index.js. NOT types.js. This is the whole point.

// --------------------------------------------------------------------------
// SC-7d — the bound reaches the public entrypoint as a value, not just a type
// --------------------------------------------------------------------------

/** MESSAGE_MAX_CHARS reaches the public entrypoint as a VALUE, not only as a type. */
type _messageBoundExportedAsValue = Expect<Equals<typeof MESSAGE_MAX_CHARS, 180>>;
