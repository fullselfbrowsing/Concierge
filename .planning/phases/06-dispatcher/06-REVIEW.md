---
phase: 06-dispatcher
reviewed: 2026-08-07T18:30:58Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - packages/concierge/src/dispatch.ts
  - packages/concierge/src/concierge.ts
  - packages/concierge/src/types.ts
  - packages/concierge/test/dispatcher.test.ts
  - packages/concierge/test/dispatcher-batch.test.ts
  - scripts/phase-06-mutation-battery.mjs
findings:
  critical: 4
  warning: 6
  info: 0
  total: 10
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-08-07T18:30:58Z

**Depth:** standard

**Files Reviewed:** 6

**Status:** issues_found

## Summary

The gap-closure implementation still has four release-blocking correctness or evidence-integrity failures. Malformed batch metadata can reject the entire batch before a row is produced, malformed JSON can reach an action handler through a defaulting validator, prototype pollution can make distinct fallback calls share one cached result, and the advertised ledger gate accepts explicitly failed or pending rows while skipping most release commands. Six warnings cover incomplete metadata validation, unsupported mutation claims, missing alias coverage, incomplete clean-tree scope, unsafe concurrent evidence updates, and incomplete evidence-schema validation.

The runtime and evidence verification commands currently pass, but the reproduced counterexamples below show that those green runs do not establish the claimed contracts.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Malformed batch metadata can reject the entire batch before containment

**Classification:** BLOCKER

**File:** `packages/concierge/src/dispatch.ts:543-575`

**Issue:** Batch fields and every call field are read outside a guarded boundary, and `outputIndex` values are subtracted before `snapshotInvocationMeta` validates them. A two-call batch whose first `outputIndex` is `Symbol("bad")` rejects with `TypeError`; it produces zero rows and prevents the valid second call from running. Throwing getters and a `BigInt` output index have the same whole-batch escape path. This contradicts the gap-closure totality/correlation claim and repeats the class of failure Q17 was intended to close. Q17 only supplies a malformed `callId` with an otherwise sortable call, so it cannot detect this path.

**Fix:** Snapshot the batch and each call inside guarded reads before sorting. Validate the sort key independently, retain original position, and turn each malformed call into one frozen invalid-metadata row. Sort only successfully validated finite indexes; use original order for invalid indexes and document a deterministic sentinel if a throwing `callId` getter makes correlation unobservable. Add mixed two-call regressions for `Symbol`, `BigInt`, non-finite indexes, and throwing getters.

```ts
const snapshots = batch.calls.map((raw, originalIndex) =>
  snapshotToolCall(raw, originalIndex),
);
const ordered = snapshots.sort(compareValidatedIndexThenOriginalPosition);
// A failed snapshot is emitted as one frozen invalid-meta row, not thrown.
```

### CR-02: Malformed JSON can execute an action through a defaulting schema

**Classification:** BLOCKER

**File:** `packages/concierge/src/dispatch.ts:587-602`

**Issue:** A parse failure is converted to `{}` and is then indistinguishable from valid JSON containing an empty object. Standard Schema validators may transform or default values. With a validator that accepts `{}` and returns `{ value: { amount: 100 } }`, the malformed raw string `"{"` entered the handler and produced a successful result. Q04 at `packages/concierge/test/dispatcher-batch.test.ts:296-358` only uses a schema that happens to reject `{}`, so the test does not establish the stated “malformed input never enters a handler” security property.

**Fix:** Preserve parse provenance and make parse failure terminal before handler entry. The simplest safe behavior is to author an `invalid_args` row directly. If the transport contract must expose `{}` to validation, add a validation-only path but prohibit handler entry even if the validator supplies defaults. Update Q04 with both rejecting and defaulting/permissive validators.

```ts
try {
  args = JSON.parse(call.arguments);
} catch {
  result = authoredResult(false, "The action arguments are invalid.", "invalid_args");
  rows.push(Object.freeze({ callId: call.callId, result }));
  continue;
}
```

### CR-03: Inherited `toJSON` hooks collapse distinct fallback deduplication keys

**Classification:** BLOCKER

**File:** `packages/concierge/src/dispatch.ts:188-197,230-231`

**Issue:** The new tagged representation is injective only before it is passed to `JSON.stringify`. Its nodes and the outer key tuple are arrays, so `JSON.stringify` invokes inherited `Array.prototype.toJSON` or `Object.prototype.toJSON` hooks. With `Array.prototype.toJSON` temporarily returning a constant, calls with `{ x: 1 }` and `{ x: 2 }` returned the same Promise and invoked the handler once. Any same-realm prototype pollution can therefore suppress an authorized call or return another call's result, despite the encoder's stated collision-resistance goal.

**Fix:** Serialize the tagged tree with a dedicated length-prefixed encoder that never performs dynamic `toJSON` lookup. Do not rely on a captured `JSON.stringify`, because it still consults the value's current prototype. Add regressions with polluted `Array.prototype.toJSON` and `Object.prototype.toJSON`, restoring the descriptors in `finally` blocks.

```ts
function encodeString(value: string): string {
  return `${value.length}:${value}`;
}

// Recursively emit fixed tags and length-prefixed payloads without JSON.stringify.
return encodeCanonical(canonicalInvocationValue(value, new WeakSet()));
```

### CR-04: The ledger release gate accepts false green claims and skips required gates

**Classification:** BLOCKER

**File:** `scripts/phase-06-mutation-battery.mjs:2173-2199,2244-2275,2281-2352`

**Issue:** `validateLedgerSnapshot` parses the `pnpm test` totals but never checks that the row's Result cell is green. It also searches requirement rows for token fragments without validating their Phase or Status cells, and it does not validate the semantic columns of closure-task rows. Reproduced against the live snapshot, changing the `pnpm test` result from `✅` to `❌` returned no errors; changing DSP-01 to `Phase 9 — Wrong | Pending —` while retaining the required words also returned no errors. The current validation ledger already demonstrates the ignored-column problem by linking 06-07 tasks to T-06-G05/G06/G07, although those IDs belong to 06-08. Finally, `verify ledgers` runs only the build and full Vitest after checking stored mutation evidence; it does not run the advertised typecheck, telemetry, artifact, dependency, pack, or Node-floor release gates. The command can therefore certify a ledger whose explicit status is failed and whose claimed release gates were never executed.

**Fix:** Parse every required table by exact columns and assert command, phase, status, threat reference, file-exists, and result values. Add negative self-test fixtures for `❌`, `Pending`, wrong phase, wrong threat, and tokens moved to the wrong columns. Either execute the exact declared release command plus telemetry audit inside `verifyLedgers`, or narrow the ledger claim so it names only the gates actually run.

```js
const [gate, headline, result] = tableCells(testRow);
if (gate !== "`pnpm test`" || result !== "✅") {
  errors.push("pnpm test row is not explicitly green");
}
```

## Warnings

### WR-01: Metadata validation accepts invalid containers and capabilities

**Classification:** WARNING

**File:** `packages/concierge/src/concierge.ts:125-165`

**Issue:** `snapshotInvocationMeta` validates four scalar fields but never verifies that `meta` is a non-null object, that `signal` is structurally usable, or that `deferUntilDelivered` is a function. Numbers, strings, booleans, and symbols are accepted as empty metadata because property access boxes them. A read-only action also ran with `signal: 42` and `deferUntilDelivered: "not a function"`, exposing malformed metadata to application code. R68 at `packages/concierge/test/dispatcher.test.ts:2402-2483` covers bad scalar fields and one throwing getter, but not these accepted shapes.

**Fix:** Reject non-object metadata, validate an optional delivery hook with `typeof value === "function"`, and validate or normalize the structural signal before handler entry. Keep all reads guarded and extend R68 with primitive containers, malformed signals, and malformed hooks.

### WR-02: Q16 and Q17 mutation claims do not discriminate their advertised contracts

**Classification:** WARNING

**File:** `scripts/phase-06-mutation-battery.mjs:1121-1143,2203-2242`

**Issue:** No mutant names Q16 as an intended detector. The only Q17 mutant removes the general metadata-validation conditional, so it proves rejection of malformed metadata but not Q17's correlation identity, one-row cardinality, or no-coercion behavior. Ledger validation merely requires the markers and Q16 title. The report can consequently claim mutation proof for immutable nested cached results and exact malformed-ID correlation without a mutant that perturbs either boundary.

**Fix:** Add a Q16 mutant that clones or fails to freeze the nested cached result and a Q17 mutant that coerces/replaces the row `callId` (plus, ideally, one that drops/adds a row). Bind each mutant to the exact detector marker and add self-tests asserting the required mutant-to-case mapping.

### WR-03: Aliased-graph no-dedup behavior is claimed without a regression detector

**Classification:** WARNING

**File:** `packages/concierge/test/dispatcher.test.ts:260-349`

**Issue:** R05 tests a cycle, R06 tests `BigInt`, and R06a tests lossy JSON shapes; none constructs an acyclic graph in which the same object is referenced twice. Nevertheless, the traceability validator requires the word `aliased` at `scripts/phase-06-mutation-battery.mjs:125-134` and accepts the resulting claim as complete. A regression that deduplicates aliased graphs can therefore leave the cited R05/R06 evidence green.

**Fix:** Add a named runtime case using `{ left: shared, right: shared }` twice and assert two distinct Promises/two handler entries without a throw. Add a mutant that removes the repeated-reference no-key branch, or remove the unsupported alias claim until discriminating evidence exists.

### WR-04: The clean-tree proof omits paths included in revision freshness

**Classification:** WARNING

**File:** `scripts/phase-06-mutation-battery.mjs:32-59,1532-1543`

**Issue:** Revision digests include `scripts`, root manifests/configuration, and package manifests/configuration, but `scopedStatus()` checks only `src`, runtime/type tests, and `pnpm-lock.yaml`. Evidence rows can therefore record `scopedTreeClean: true` while the mutation harness, battery, package manifest, workspace file, TypeScript/Vitest config, or packaging config is dirty. That makes the restoration/cleanliness claim materially narrower than the inputs whose freshness the plan says it proves.

**Fix:** Build the status scope from `REVISION_DIRECTORY_SCOPES` plus `REVISION_REQUIRED_PATHS` (and the harness path), and check it both before mutation and after restoration.

### WR-05: Concurrent bounded-range runs can lose or corrupt evidence

**Classification:** WARNING

**File:** `scripts/phase-06-mutation-battery.mjs:1156-1160,1853-1860,1903-1933`

**Issue:** Every process loads the entire evidence document once, mutates that stale in-memory copy, and rewrites the whole file after each row. The supposedly atomic writer also gives every process the same `.tmp` path. Two concurrent `run range` commands can overwrite each other's green rows, fail during competing renames, or publish a mixed stale document. Concurrent mutation processes can also interfere with the shared source-restoration harness.

**Fix:** Serialize mutation runs with an exclusive repository lock. If concurrent ranges are required, use isolated worktrees plus per-process evidence fragments, then merge under a lock by rereading the latest file and updating only the selected row. Use a unique temporary path for each writer.

### WR-06: Evidence shape validation is not bound to its declared schema metadata

**Classification:** WARNING

**File:** `scripts/phase-06-mutation-battery.mjs:1501-1514,1944-2001`

**Issue:** `validateEvidenceShape` verifies only the register digest, expected IDs, and row ID order. It does not verify the evidence `schemaVersion`, phase, row group, or immutable case/target metadata. `assertGreenEvidenceRow` checks execution outcomes but likewise trusts several structural fields. A hand-edited or partially migrated evidence document can therefore pass with the wrong schema/phase or internally inconsistent row metadata, undermining the promise that the JSON is an immutable, self-describing record.

**Fix:** Compare top-level schema and phase values to constants and compare every immutable row field (`id`, `group`, target, detector kind, intended cases, and expected fingerprint/diagnostics) to the embedded register before accepting measured fields.

---

_Reviewed: 2026-08-07T18:30:58Z_

_Reviewer: the agent (gsd-code-reviewer)_

_Depth: standard_
