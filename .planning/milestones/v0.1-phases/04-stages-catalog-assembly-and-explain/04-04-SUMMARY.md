---
phase: 04-stages-catalog-assembly-and-explain
plan: 04
subsystem: catalog
tags: [CAT-03, consent, tests, type-level, mutation-sensitivity]

# Dependency graph
requires:
  - phase: 04-stages-catalog-assembly-and-explain
    plan: "04-02"
    provides: "the CAT-03 post-pass, `consent_target_missing` / `consent_self_reference`, and the verbatim `problem`/`fix` prose asserted here"
  - phase: 03-action-declaration-and-build-time-validation
    provides: "`test/catalog.test.ts`'s C-series, `catchBuild`, `declare`, the dist guard; `test-d/catalog.test-d.ts`'s four header blocks and `_assert.ts`"
provides:
  - "C23–C26 — CAT-03's runtime evidence, asserted against `dist/index.js`"
  - "`_catalogIssueCodeIsExactlySixMembers` — the `Equals` union pin"
  - "`_catalogIssueCodeIsClosed` — the opposite-direction closedness pin"
  - "MEASURED: reversing the post-pass's two branches is NOT detectable by any test in this repo"
  - "MEASURED: C25 is the only case that distinguishes the post-pass from the in-loop placement"
affects:
  - "04-05 (owns the cross-stage-target clean build; only `createConcierge` produces append-last ordering)"
  - "04-07 (mutant literals in `src/catalog.ts` re-measured undisturbed)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A negative assertion is documented by what it was MEASURED to catch, not by what it looks like it catches"
    - "A clean-build assertion is proved able to go red by breaking the implementation, not only by breaking the fixture"

key-files:
  created: []
  modified:
    - packages/concierge/test/catalog.test.ts
    - packages/concierge/test-d/catalog.test-d.ts

key-decisions:
  - "C26 declares the consent fault FIRST so declaration order and issue order genuinely come apart — otherwise the set-based assertion is accidentally equivalent to a positional one and proves nothing about the post-pass"
  - "C24's negative is documented as expressive rather than discriminating, after the branch-reversal mutation was measured green at 26/26"
  - "C23 gains the symmetric negative, resolving a contradiction between the plan's action text and its own acceptance criterion"

requirements-completed: [CAT-03]

# Metrics
duration: ~10 min
completed: 2026-07-30
---

# Phase 4 Plan 04: Proving CAT-03 Against the Built Artifact Summary

**Four runtime cases and two type-level pins for CAT-03 — including the forward-reference
clean build, which was observed red under a reconstructed in-loop placement before it was
accepted green, and which is the only case in this repository that can tell the two
placements apart.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2
- **Files modified:** 2
- **Commits:** `35dad64` (Task 1), `643c76d` (Task 2)

## The Four Cases, and Their One-Line Claims

| Case | Claim |
|---|---|
| **C23** | A typo'd `consent.requires` throws with one issue whose `.code` is `consent_target_missing`, whose `.action` is the **referrer** (`confirm`), and whose `.problem` carries the missing target (`reveiw`). |
| **C24** | A `requires` naming the action itself reports `consent_self_reference`, and the code list demonstrably does not contain `consent_target_missing`. |
| **C25** | A **forward** reference — target declared *after* its referrer — builds clean, produces `names` in declaration order, and keeps the consent policy on the entry. |
| **C26** | A consent typo alongside three other faults throws **once** carrying **four** issues, asserted as a set of codes and a set of actions, never positionally. |

Type level, in `test-d/catalog.test-d.ts` Block 6:

| Predicate | Claim |
|---|---|
| `_catalogIssueCodeIsExactlySixMembers` | `Equals` against the full six-member literal union. Red on any member added, removed, renamed — and on widening. |
| `_catalogIssueCodeIsClosed` | `Not<Assignable<"consent_missing", CatalogIssueCode>>`. The union is closed, not merely containing the six. |

## Sensitivity Observations — Three Probes, All Restored

Every probe below was restored and the restoration verified: `src/catalog.ts` by
`git status --porcelain` returning empty, `test/catalog.test.ts` by SHA-256
(`9a6c9d62a67d…`, matched byte-for-byte before and after).

### Probe C — C25 red under a reconstructed in-loop placement (the phase-critical one)

The post-pass was mutated to consult a **prefix** name set instead of the complete
`seenNames`, which is exactly the view an in-loop check has of the world:

```
const prefixNames: Set<string> = new Set<string>();
for (const action of declared) {
  prefixNames.add(action.name);         // ← simulates seenNames.add having already run
  …
  } else if (!prefixNames.has(requires)) {
```

```
 × C25 — a FORWARD reference builds clean, so the check reads the COMPLETE name set
AssertionError: expected [Function] to not throw an error but
                'CatalogValidationError: concierge: 1 …' was thrown
 Tests  1 failed | 25 passed (26)
```

**Exactly one case failed, and it was C25.** C23, C24 and C26 all stayed green under the
mutation. That is the discrimination claim in its strongest available form: nothing else in
this repository can tell the post-pass from the in-loop placement. Restored → 26/26 green.

### Probes A and B — C25 red under a genuinely missing target

- **A (backward reference must still pass).** First run failed — but on the `catalog.names`
  assertion (`expected ['review','confirm'] to deeply equal ['confirm','review']`), not on
  the rule: no `CatalogValidationError` was thrown. `names` follows declaration order, so
  reordering the fixture necessarily moves it. Re-run with the expectation reordered to
  match: **26/26 green**. A backward reference is legal, as required.
- **B (target declared nowhere).** `requires: "nowhereDeclared"` → C25 goes **RED** with
  `CatalogValidationError`, 1 failed / 25 passed. Restored → green.

### Probe D — the `Equals` pin red under `CatalogIssueCode = string`

`src/catalog.ts`'s union declaration was replaced with `export type CatalogIssueCode = string;`:

```
test-d/catalog.test-d.ts(323,52): error TS2344: Type 'false' does not satisfy the constraint 'true'.
test-d/catalog.test-d.ts(326,41): error TS2344: Type 'false' does not satisfy the constraint 'true'.
=== tsc EXIT CODE: 1 ===
```

- **Exit code 1**, not 2 — as the file's own terse-output caveat predicts for TS 7.0.2.
- Named `file:line` for **both** predicates: `packages/concierge/test-d/catalog.test-d.ts`
  at **323,52** (the `Equals` pin) and **326,41** (the closedness pin).
- Asserted on exit code plus `file:line` only. Confirmed in passing that the alias names do
  not appear anywhere in the non-TTY output — the diagnostics carry nothing but
  `Type 'false' does not satisfy the constraint 'true'.`, exactly as `:55-63` records.
- The second predicate firing independently is what makes its doc-comment claim measured
  rather than asserted: it really is a second detector of the same widening, from the
  opposite direction.

Restored → `pnpm typecheck` exit 0.

## Probe E — a claim I wrote, then measured, then had to withdraw

The first draft of C24's comment ended: *"Reversing those two branches is a mutation this
line is the detector for."* That was checked rather than trusted. The two branches were
physically swapped in `src/catalog.ts`:

```
if (!seenNames.has(requires))  { … consent_target_missing … }
else if (requires === action.name) { … consent_self_reference … }
```

**Result: 26/26 green. The reversal is not detectable by anything in this repository.**

The reason is the post-pass itself: by the time it runs, a self-referencing action's own
name is always in `seenNames`, so `!seenNames.has(requires)` is `false` for it under either
ordering and both spellings reach the same branch. The `else if` makes the exclusivity
structural, but it is not what *produces* it — running after the loop is.

The comment now records that measurement and states plainly that the line is expressive
rather than discriminating. This matters beyond one comment: a comment asserting a test
catches a mutation it does not catch is worse than no comment, because the next reader
trusts it and stops looking. It is the defect class 03-08 spent a whole plan removing from
this repository, and the correction is annotated in place rather than silently dropped.

## C4 Is Unaffected — Confirmed by Reading Before Running

`test/catalog.test.ts` C4 asserts `error.issues.map(i => i.code)` **positionally**. It is
unaffected by CAT-03's appending post-pass because none of `fourBadDeclarations()`'s five
declarations carries a `consent` policy — measured on the current tree:

```console
$ sed -n '/function fourBadDeclarations/,/^  }$/p' packages/concierge/test/catalog.test.ts | grep -c 'consent'
0
```

The post-pass therefore appends nothing to its issue array and its positional assertion is
unchanged. C4 was green on every one of the eight suite runs in this plan.

## `_inlineDefineActionLosesTheUnion` — Unchanged and Still Red-As-Pinned

- `grep -c '_inlineDefineActionLosesTheUnion'` returns **1**, the same as before the task.
- `git diff -U0` for `test-d/catalog.test-d.ts` touches **0** lines matching
  `inlineDefineActionLosesTheUnion|inlineCatalog|inlineFilter` — the block and its comment
  are untouched.
- It still compiles: the pin asserts `names` is `readonly string[]`, which is what is
  measured today, so `pnpm typecheck` exiting 0 *is* the confirmation that the gap remains
  open. Had the gap closed, typecheck would be red at that line.

## Verification

All five gates exit 0 on the final tree:

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS (attw + publint clean) |
| `pnpm test` | PASS — **6 files / 59 tests** (55 + 4) |
| `pnpm check:deps` | PASS |
| `pnpm check:artifact` | PASS |

`pnpm test catalog` alone: **26 tests** (22 + 4).

### Acceptance criteria, re-measured on the final tree

Every "must become N" criterion was measured **before** editing and found at its
non-passing value, so each discriminates rather than sitting pre-satisfied.

| Criterion | Pre-edit | Target | Final |
|---|---|---|---|
| `it("C2[3-6] ` cases | 0 | 4 | **4** |
| `consent_self_reference` in `test/catalog.test.ts` | 0 | ≥2 | **2** |
| `CatalogIssueCode` in `test-d/catalog.test-d.ts` | 0 | ≥3 | **7** |
| long-line (`>200`) `CatalogIssueCode` | 0 | ≥1 | **3** |
| `_inlineDefineActionLosesTheUnion` | 1 | unchanged | **1** |
| `vi\.` across `test/` | 0 | 0 | **0** |
| non-comment `../src/` in `test/catalog.test.ts` | 0 | 0 | **0** |
| `@ts-expect-error` in `test-d/catalog.test-d.ts` | 0 | 0 | **0** |

The last three sat at their PASS value before the task and are therefore **regression
guards, not discriminators** — recorded as such rather than presented as evidence of work
done, per the standing rule that a grep already at its PASS value cannot distinguish "done"
from "never started".

### Boundary checks

```console
$ git diff --name-only 48dbc40..HEAD
packages/concierge/test-d/catalog.test-d.ts
packages/concierge/test/catalog.test.ts
```

- Exactly the plan's two `files_modified`. Nothing else.
- `src/concierge.ts`, `src/index.ts`, `src/contract.ts`, `test/export-surface.test.ts`,
  `test-d/exports.test-d.ts`, `test/artifact.test.ts` — **all untouched** (04-03 owns them).
- `test/export-surface.test.ts` still reads **59 / 49 / 10** and is green in this worktree,
  as expected: the export surface moves in 04-03, not here.
- `git diff --stat 48dbc40..HEAD -- pnpm-lock.yaml` is **empty** — byte-identical.
- STATE.md and ROADMAP.md **not modified** (orchestrator owns them).

### 04-02's literals re-measured, undisturbed

| Literal | Required | Measured in `src/catalog.ts` |
|---|---|---|
| `consent_target_missing` (TRAP) | 2 | **2** |
| `consent_self_reference` (TRAP) | 2 | **2** |
| `!seenNames.has(requires)` (M-04-11) | 1 | **1** |
| `requires === action.name` (M-04-10) | 1 | **1** |
| `declared.push(action);` (M-04-09) | 1 | **1** |

`src/catalog.ts` was mutated three times during this plan and restored via
`git checkout -- <one specific file>` each time; the counts above are the proof that every
restoration was exact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] A comment claimed a detection that measurement contradicted**

- **Found during:** Task 1, checking a claim before committing it rather than after.
- **Issue:** C24's first-draft comment asserted the negative assertion was the detector for
  reversing the rule's two branches. Measured: the reversal leaves the suite green at 26/26,
  because the post-pass always sees the self-referencing action's own name in `seenNames`.
  The claim was false and would have shipped in a file whose whole register is
  "measured, not assumed".
- **Fix:** The comment now records the measurement, names the mechanism, and states plainly
  that the line is expressive rather than discriminating. Probe E above.
- **Files modified:** `packages/concierge/test/catalog.test.ts`
- **Commit:** `35dad64` (fixed before the commit, so the false claim never landed)

**2. [Rule 2 — Missing critical] C26's set assertion was accidentally equivalent to a positional one**

- **Found during:** Task 1, designing the aggregation fixture.
- **Issue:** With the consent fault declared **last**, the post-pass appends its issue last
  — which is also its declaration position. Declaration order and issue order would then
  coincide, and the set-based assertion the plan requires would prove nothing that a
  positional one would not. The case would be green for a reason unrelated to its purpose.
- **Fix:** The consent fault is declared **first**. Its issue is still produced last, so the
  two orderings genuinely come apart and the set assertion is load-bearing. Stated in the
  fixture's comment so the ordering is not "tidied" back later.
- **Files modified:** `packages/concierge/test/catalog.test.ts`
- **Commit:** `35dad64`

### Plan Contradictions Resolved

**3. The `consent_self_reference >= 2` criterion contradicted the plan's own action text**

The plan's action text specifies exactly two assertions for C24 — positive on
`consent_self_reference`, negative on `consent_target_missing` — under which the literal
occurs **once**. Its acceptance criterion asks for **≥2**, glossed as "the positive
assertion in C24 and the negative one".

Resolved in the direction that adds a real claim rather than a second mention: **C23 gains
the symmetric negative** (a missing target is not reported as a self-reference). The
exclusivity is now stated where each half of it can be read, the criterion passes at 2, and
the comment is honest that — like C24's — the line is expressive, since the length assertion
already rules out both codes firing.

**4. The `C23 |C24 |C25 |C26 ` grep returns 7, not the plan's expected 4**

Not a defect and not padding. Three of the seven are deliberate in-file cross-references:

```
 42: … so C25 below, the forward
617: … So C26 asserts a SET of codes and never a
620: The post-pass is also why C25 exists at all: see defect 4 in this file's
623/671/717/756: the four `it(` titles
```

The plan's grep counts **lines mentioning** the case IDs; the intent is **four cases exist**.
Those come apart the moment the file cross-references itself, which this file does
throughout. The stronger measurement is reported instead and is what was verified:

```console
$ grep -c 'it("C2[3-6] ' packages/concierge/test/catalog.test.ts
4
```

That form cannot be satisfied by prose, so it is a strictly tighter check than the one it
replaces. The looser count is recorded here so the number is auditable rather than
surprising.

---

**Total deviations:** 2 auto-fixed, 2 plan contradictions resolved.
**Impact on scope:** None. Two files touched, both named in `files_modified`. No new
dependency, no new fixture, no package install, no source change.

## Known Stubs

None. Both tasks landed complete assertions; nothing is placeholdered or deferred.

## Threat Flags

None. This plan adds no network endpoint, auth path, file access pattern, or schema change
at a trust boundary. The register's four `mitigate` dispositions were each discharged:

| Threat | Discharge |
|---|---|
| T-04-16 (consent gate silently closed or never armed) | C23 and C24 are CAT-03's executable evidence. C25 is the evidence the rule is not so eager it fails legitimate builds — the failure mode that would get it deleted. |
| T-04-20 (a CAT-03 test that cannot go red) | C25 observed red under **two independent** breakages: a genuinely missing target (Probe B) and a reconstructed in-loop implementation (Probe C). The type pin observed red under `= string` (Probe D). |
| T-04-14 (information disclosure via issue contents) | Assertions read `.code`, `.action`, and one substring of `.problem` — all developer-authored identifiers. Nothing asserted could carry an argument value. |
| T-04-SC (supply chain) | Nothing installed, no fixture file added; `test/fixtures/schemas.ts` already provided every validator shape. `pnpm-lock.yaml` byte-identical. |

## Notes for Later Plans

- **04-05** owns the cross-stage-target clean build. C25 is its general case at the
  `buildCatalog` level; only `createConcierge` produces the append-last ordering that makes
  every cross-stage consent target a forward reference, so that half cannot live here. C25's
  comment already points at `test/concierge.test.ts`.
- **04-03** — the export surface is untouched by this plan and still reads 59/49/10 in this
  worktree. This plan contributes **+0**.
- **04-07** — all five of 04-02's literals in `src/catalog.ts` are undisturbed at their
  recorded counts (table above). Additionally measured and worth knowing before designing a
  mutant: **swapping the post-pass's two branches is green**, so it is not a viable mutation
  target. `!seenNames.has(requires)` → a prefix set **is** viable and kills exactly C25.

## Self-Check: PASSED

- `packages/concierge/test/catalog.test.ts` — FOUND (modified, +223/−3)
- `packages/concierge/test-d/catalog.test-d.ts` — FOUND (modified, +26/−1)
- `.planning/phases/04-stages-catalog-assembly-and-explain/04-04-SUMMARY.md` — FOUND
- Commit `35dad64` — FOUND in `git log`
- Commit `643c76d` — FOUND in `git log`
- `git status --porcelain` — empty before this summary was written
- `git diff --stat 48dbc40..HEAD -- pnpm-lock.yaml` — empty
- STATE.md / ROADMAP.md — NOT modified (orchestrator owns them)
- Files owned by 04-03 — NOT modified

---
*Phase: 04-stages-catalog-assembly-and-explain*
*Completed: 2026-07-30*
