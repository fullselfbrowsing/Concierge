---
phase: 03-action-declaration-and-build-time-validation
verified: 2026-07-30T00:52:30Z
status: human_needed
score: 6/6 ROADMAP success criteria verified; 7/8 phase requirements fully delivered
overrides_applied: 0
requirements:
  CAT-01: partial       # per-stage catalogs are Phase 4's `catalogFor` — do NOT close
  CAT-02: satisfied
  CAT-05: satisfied
  CAT-06: satisfied
  CAT-07: satisfied
  SEC-01: satisfied
  SEC-05: satisfied
  DX-03: satisfied_with_documented_exception
  SEC-03: partial       # Phase-3 half (buildCatalog freeze) closed; Phase 4 owns catalogFor re-freeze
  PKG-04: satisfied     # SC-5 production call site now exists
deferred:
  - truth: "CAT-01's `per-stage catalogs` clause — one declaration also deriving the stage-scoped catalog"
    addressed_in: "Phase 4"
    evidence: "Phase 4 SC-1 'An agent on the results page is offered the results actions plus the cross-stage actions' and SC-3 'Two `catalogFor` calls with equivalent context return the identical array reference'. `catalogFor` has no implementation in src/ and is not exported from the barrel."
  - truth: "SEC-03 — the stage-scoped catalog is frozen"
    addressed_in: "Phase 4"
    evidence: "REQUIREMENTS.md:207 maps SEC-03 to Phase 4; Phase 4 SC-5 'the built registry is frozen'. catalog.ts:548-552 hands forward that `frozenArray.filter()` returns an UNFROZEN array."
  - truth: "CAT-03 — consent.requires target existence check"
    addressed_in: "Phase 4"
    evidence: "Phase 4 SC-4 and REQUIREMENTS.md:159."
  - truth: "CAT-04 — consent.minGrade vs transport capability gate"
    addressed_in: "Phase 8"
    evidence: "REQUIREMENTS.md:160 maps CAT-04 to Phase 8 — Consent kernel."
human_verification:
  - test: "Decide whether CAT-01 may be marked Complete in REQUIREMENTS.md, or must stay Pending until Phase 4."
    expected: "Recommendation: keep CAT-01 Pending. Four of its five derived artifacts ship (name set, literal union type, emitted JSON Schema, redaction policy); `per-stage catalogs` does not exist in this phase."
    why_human: "Requirement-row closure is a scope decision, not a code fact. The verifier can measure what exists but cannot decide whether a partially-delivered requirement counts as closed."
  - test: "Read the three build-failure messages emitted by `buildCatalog` and the CAT-07 compile error, and judge whether the prose is actionable to a developer who did not write this library."
    expected: "Each names the offending action and states a fix a developer can act on without reading the source."
    why_human: "DX-03's mechanical half (action named, fix field present, fix non-empty) is verified. Whether the wording is genuinely clear is a human judgment the verifier cannot make."
  - test: "Decide whether to accept the measured DX-03 residual: `buildCatalog([null])` throws a raw `TypeError: Cannot read properties of null (reading 'name')` rather than a structured `CatalogValidationError`."
    expected: "Either accept (a null element has no name to report, so a structured issue is genuinely impossible without inventing a sentinel) or schedule a fix."
    why_human: "DX-03 says `Every` build-time error names the offending action. This one measured exception is documented and deliberately accepted in shipped source (catalog.ts:348-353); whether `Every` tolerates it is a policy call."
  - test: "Decide whether to correct the M-03-11 literal as written in the 03-VALIDATION.md battery table."
    expected: "The table row reads ``Object.create(null)` → `{}``, which occurs TWICE unfiltered in src/catalog.ts (doc comment line 253, code line 845). The literal actually used (03-06-SUMMARY.md:128) is the full unique statement."
    why_human: "The battery result is sound; only the table's abbreviation is ambiguous. Whether to amend a signed-off validation document is the developer's call."
---

# Phase 3: Action declaration and build-time validation — Verification Report

**Phase Goal:** A developer declares an action once and everything downstream is derived — and every way to declare one wrongly is caught at build with a message naming the action and stating the fix.
**Verified:** 2026-07-30T00:52:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

Every claim below was re-measured by the verifier against the working tree. No SUMMARY.md
assertion was accepted as evidence. Tree confirmed byte-identical to `HEAD` (`git status
--porcelain` empty) before and after every experiment.

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | One declaration yields the literal name type, emitted JSON Schema, and redaction policy, with no second registry (CAT-01) | VERIFIED | Ran against shipped `dist/index.js`: `names` = `["applyFilter","clearFilters"]`; `byName` is a **null-prototype** record (`Object.getPrototypeOf === null`); `parameters.type === "object"` with derived `properties.key`; `redact` resolved on the entry. `names.length === entries.length === Object.keys(byName).length` — one source, no second registry. Type level: `test-d/catalog.test-d.ts:210-222` pins `readonly ("openItem"\|"clearFilters")[]` and `keyof byName`. |
| SC-2 | A wrong declaration fails the build naming the action and the fix — non-object schema root, runtime-assembled description, non-empty schema with no redaction (CAT-02, CAT-07, SEC-01, DX-03) | VERIFIED | All three measured. (a) `z.discriminatedUnion` → `schema_root_not_object`, `action="badRoot"`, `fix="wrap the schema in an object, or move the union inside a property."` (b) `description: i18n("filter.desc")` → `TS2322` printing `action "applyFilter"` + the fix verbatim; `` `Tenant ${tenant} filter.` `` → `TS2322` printing `action "tenantFilter"` — the per-tenant vector a naive `string extends D` guard would pass; the plain literal compiled clean. (c) `z.object({q})` with no `redact` → `redaction_missing`, `action="noRedact"`. |
| SC-3 | `destructive` with no consent policy still BUILDS but reports itself (CAT-05) | VERIFIED | Build returned a catalog (no throw); `catalog.diagnostics[0].code === "destructive_without_consent"`, `.action === "deleteAll"`; the `onDiagnostic` sink received exactly 1 diagnostic. |
| SC-3b | `readsUntrusted` with no consent policy reports the same way under a distinct code (SEC-05) | VERIFIED | Builds; `diagnostics[0].code === "reads_untrusted_without_consent"`, measured `!==` CAT-05's code. Same shape, distinct code — one branch handles both, a filter separates them. |
| SC-4 | Explicit `jsonSchema` used in preference to derivation; unspecified redaction DROPS rather than passes through (CAT-06, SEC-01) | VERIFIED | Hatch `{properties:{onlyMine}}` supplied alongside a zod schema declaring `derivedWouldBeThis`; emitted `parameters` carried `onlyMine` and **not** `derivedWouldBeThis` — the hatch won, not a coincidental match. Empty-schema action with no `redact` built and resolved to `redact === "drop"`; never `"passthrough"` on either branch. |
| SC-5 | `assertSingleInstance` is called from the first entry point a consumer actually reaches, not only from tests (PKG-04) | VERIFIED | `src/catalog.ts:716` — the **first statement** of `buildCatalog`'s body, not module scope (which `"sideEffects": false` would delete). Independently mutation-proved: see M-03-8 below. |

**Score: 6/6 ROADMAP success criteria verified.**

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| CAT-01 | name set, literal union type, **per-stage catalogs**, JSON Schema, redaction all derived from one declaration | **PARTIAL — do not close** | 4 of 5 derived artifacts ship and are measured. **`per-stage catalogs` does not exist here**: `catalogFor` appears only as a *type member* (`types.ts:1509`) and a Phase-4 hand-forward note (`catalog.ts:550`) — no implementation, **not exported from the barrel**. Deferred to Phase 4 (SC-1/SC-3). |
| CAT-02 | build throws, naming the action, when the emitted root is not `type:"object"` | SATISFIED | Measured on `z.discriminatedUnion` (derived path) and on a non-object explicit hatch (`json-schema.ts:357-367`). Mutant M-03-6 kills the root check. |
| CAT-05 | warning when `effects.destructive` declared without consent | SATISFIED | Diagnostic channel, non-blocking, one per action, each named. |
| CAT-06 | explicit `jsonSchema` for validators lacking Standard JSON Schema, used in preference to derivation | SATISFIED | Emission order `explicit → ~standard.jsonSchema.input(...) → fail naming vendor` (`json-schema.ts:354-414`). `source: "explicit"\|"derived"` discriminator makes the ordering provable rather than coincidental. valibot 1.4.2 re-confirmed to lack a converter. |
| CAT-07 | descriptions rejected at build if not static string literals at module scope | SATISFIED | Six-branch `HoleProbe` intact (`define-action.ts:106-113`); both attack shapes rejected with action-naming messages. `${number}`/`${bigint}` residual explicitly ACCEPTED and pinned. |
| SEC-01 | redaction required for non-empty schema; unspecified policy defaults to dropping | SATISFIED — **both clauses** | Branch A (non-empty + absent → build failure) and Branch B (empty + absent → `"drop"`) both measured. The two-clause reading is documented at `catalog.ts:664-692`. Record-shaped schemas (`z.record`: no `properties`, but `propertyNames`) correctly classified NON-empty — the case a naive `Object.keys(properties).length` test silently defaults. |
| SEC-05 | taint marker declared, and build reports one carrying no consent policy | SATISFIED | Distinct diagnostic code; `types.ts:996-1015` prose corrected to state that the field **is now read**, and honestly that it reports rather than blocks. |
| DX-03 | **Every** build-time error names the offending action and states the fix | SATISFIED **with one documented exception** | `action` and `fix` are structured FIELDS, not substrings — `issues.map(i => i.action)` returned `["b1","b2","b3"]` on a 3-fault build. Exception: `buildCatalog([null])` throws a raw `TypeError`. Documented and accepted at `catalog.ts:348-353`. Surfaced for a human decision. |
| SEC-03 *(Phase 4-owned)* | registry frozen after build so a handler cannot be replaced | **PARTIAL — as planned** | Phase-3 half closed: handler replacement threw, original handler still installed, replacement through `byName` threw, nested `effects` immutable. Phase 4 owns `catalogFor` re-freeze. |
| PKG-04 *(carried SC-5)* | single core instance shared across adapters | SATISFIED | First production call site now exists. |

**No orphaned requirements** — all 8 requirements REQUIREMENTS.md maps to Phase 3 are claimed by plans; plans additionally claim PKG-04 and SEC-03.

### Deferred Items

Not gaps. Each is explicitly addressed by a later milestone phase.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | CAT-01's `per-stage catalogs` clause | Phase 4 | Phase 4 SC-1 and SC-3 (`catalogFor` identity-reference contract) |
| 2 | SEC-03 for stage-scoped catalogs | Phase 4 | REQUIREMENTS.md:207; Phase 4 SC-5; hand-forward at `catalog.ts:548-552` |
| 3 | CAT-03 consent-target existence | Phase 4 | Phase 4 SC-4 |
| 4 | CAT-04 transport capability gate | Phase 8 | REQUIREMENTS.md:160 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/define-action.ts` | defineAction + CAT-07 guard (≥120 ln) | VERIFIED | 233 lines. All 6 `HoleProbe` branches present; rejection branch is an INLINE template literal (verified in real `tsc` output, so DX-03 survives). |
| `src/json-schema.ts` | converter types, predicate, ordered emission (≥130 ln) | VERIFIED | 415 lines. Ordered emission confirmed; `.input(` (not `.output(`) at line 386. |
| `src/catalog.ts` | buildCatalog, rule table, error, deepFreeze (≥260 ln) | VERIFIED | 859 lines. All 4 issue codes + 2 diagnostic codes implemented and each measured firing. |
| `src/host.ts` | structural `globalThis` reach | VERIFIED | 96 lines; zero module specifiers; `warnHost` optional-chained. |
| `src/index.ts` | barrel, +10 types / +4 values | VERIFIED | 111 lines; 59-name surface parsed from the built `.d.ts`. |
| `src/types.ts` | corrected prose + 3 `@__PURE__` | VERIFIED | Exactly 3 annotations on exactly the 3 `Object.freeze` **initializers** (243, 265, 467). `deepFreeze`'s runtime `Object.freeze` correctly NOT annotated. |
| `test/catalog.test.ts` | behavioural suite (≥220 ln) | VERIFIED | 701 lines, 22 cases. |
| `test/emission.test.ts` | 3 real validators (≥180 ln) | VERIFIED | 531 lines, 13 cases. |
| `test-d/catalog.test-d.ts` | CAT-01 name union (≥70 ln) | VERIFIED | 301 lines; both mechanism blocks retained (raw-literal + defineAction). |
| `test-d/description-literal.test-d.ts` | CAT-07 matrix (≥120 ln) | VERIFIED | 210 lines. |
| `test/fixtures/schemas.ts` | real zod/arktype/valibot (≥60 ln) | VERIFIED | 267 lines. |
| `test/fixtures/probe.ts` | consumer-side pin on shipped `.d.ts` | VERIFIED | 155 lines; imports `@fullselfbrowsing/concierge`; exercised by `check:pack`. |
| `03-VALIDATION.md` | signed-off verification map | VERIFIED | Present; one table abbreviation flagged below. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `catalog.ts` | `contract.ts` | `assertSingleInstance()` first line | WIRED | Line 716, first statement. M-03-8 proves it. |
| `catalog.ts` | `json-schema.ts` | `emitSchema` per action | WIRED | Line 752. |
| `catalog.ts` | `host.ts` | default diagnostic sink | WIRED | `warnHost` at 501; M-03-13 proves deleting it fails C12. |
| `test-d/actions.test-d.ts` | `src/define-action.ts` | value import replacing Phase-1 placeholder | WIRED | Line 87 real import; **0** `declare function defineAction` remain. |
| `index.ts` | `catalog.ts` | value re-export | WIRED | Line 109 `buildCatalog, CatalogValidationError`. |
| `test/fixtures/probe.ts` | `dist/index.d.ts` | `pack-install-check.sh` | WIRED | `check:pack` PASS — foreign project installed the tarball, typechecked shipped declarations with `skipLibCheck:false`, imported the runtime. |
| `types.ts` | `dist/index.d.ts` | prose ships to consumers | WIRED | Corrected prose confirmed present in the built `.d.ts` (see below). |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real Data | Status |
|---|---|---|---|---|
| `catalog.entries[].parameters` | JSON Schema | `emitSchema` → real zod/arktype converter | Yes — `{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{...}}` | FLOWING |
| `catalog.names` / `byName` | derived name set | the declaration array | Yes — real names, null-prototype record | FLOWING |
| `catalog.diagnostics` | CAT-05/SEC-05 reports | the rule table | Yes — populated + delivered to sink | FLOWING |
| `entry.action.redact` | resolved policy | SEC-01 normalization | Yes — `"drop"` materialized when absent | FLOWING |
| shipped `dist/index.d.ts` prose | corrected doc comments | `types.ts` / `catalog.ts` | Yes — 5 of 5 corrections present in the built artifact | FLOWING |

### Behavioral Spot-Checks

Run by the verifier against the **shipped `dist/index.js`**, not the test suite.

| Behavior | Result | Status |
|---|---|---|
| 25-assertion end-to-end probe of SC-1…SC-4 + SEC-03 + DX-03 | `25 passed, 0 failed` | PASS |
| CAT-07 rejection via real `tsc` (i18n + interpolated template + literal control) | 2 rejected naming their actions; literal compiled | PASS |
| arktype instance shape (concern 6) | `typeof === "function"`, `~standard.vendor === "arktype"`; a `typeof !== "object"` guard **would reject it** — shipped guard correctly admits functions (`catalog.ts:357`) | PASS |
| `buildCatalog([null])` residual | raw `TypeError`, not `CatalogValidationError` | **EXCEPTION** (documented) |
| `buildCatalog(["a string"])` / `([42])` | proper structured `CatalogValidationError` | PASS |

### Probe / Gate Execution

All seven gates run by the verifier from a clean tree. Independently reproduced, not taken from SUMMARY.

| Gate | Result |
|---|---|
| `pnpm build` (tsdown + attw + publint) | PASS — `Build complete`, `[attw] No problems found`, `[publint] No issues found` |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — **6 files / 55 tests** |
| `pnpm check:deps` | PASS — `@standard-schema/spec` 0 bytes |
| `pnpm check:artifact` | PASS |
| `pnpm check:pack` | PASS |
| `pnpm check:node-floor` | PASS — imported on pinned v22.12.0 |

### Mutation Battery — Independently Re-Run

The orchestrator flagged that `mutate-and-prove.sh` cannot distinguish a compile failure from a
failing assertion, so a build-breaking mutant yields a **vacuously-green PASS**. The verifier wrote
an independent strict wrapper requiring **both** `Build complete` **and** a vitest `Tests N` summary
line, validated it on the clean tree (`COMPILED` + `Tests 22 passed`), and re-ran six rows.

| Mutant | Compiled? | Tests ran? | Cases killed | Verdict |
|---|---|---|---|---|
| **M-03-8** — remove `assertSingleInstance();` | YES | YES (4) | `F4 — buildCatalog records this copy in the registry on its first line` | **SC-5 genuinely proved** |
| **M-03-7** — `deepFreeze(...)` → shallow `Object.freeze(catalog)` | YES | YES (22) | C17, C18, C19, C21 | matches record exactly |
| **M-03-13** — `warnHost(` → `String(` | YES | YES (22) | C12 only | matches record exactly |
| **M-03-12** — delete the `redaction_missing` push | YES | YES (22) | C13, C15 | matches record exactly |
| **M-03-3** — `<const A extends` → `<A extends` | n/a (typecheck) | YES | 5 × **TS2344** in `catalog.test-d.ts` (real assertion failures, not syntax errors) | matches record exactly |
| **Guard C** — move a VALUE into the `export type` block | YES | YES | see below | see below |

**Control — the vacuous-PASS failure mode reproduces exactly as documented.** Running the *broken*
M-03-13 form (`warnHost(` → `void (`):

- through the raw harness: `PASS: gate fired (exit 1), tree clean` — **having run zero tests**;
- through the strict wrapper: `VACUOUS: mutant did NOT compile` + `[PARSE_ERROR] Parenthesized expressions may not have a trailing comma.`

The harness defect is real, is documented in the shipped script (Known limitation 2, lines 44-54),
and 03-08's claim to have driven the battery through a compile-and-tests-ran wrapper is
**corroborated** — the corrected literals do compile and do run tests.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | `TBD` / `FIXME` / `XXX` | — | **NONE** across `src/`, `test/`, `test-d/` |
| — | — | `TODO` / `HACK` / `PLACEHOLDER` | — | **NONE** |
| `03-VALIDATION.md` | 169 | M-03-11 row abbreviates its literal as `Object.create(null)`, which occurs **twice** unfiltered (doc comment L253, code L845). Perl replaces the FIRST match with no `/g` → would mutate the comment and record `FAIL: mutant escaped`. | WARNING | Battery result is sound — `03-06-SUMMARY.md:128` records the actual literal as the full unique statement. Only the table's rendering is ambiguous. Correction #3's "all sixteen patterns verified at exactly one occurrence" holds for the literals used, not for the table's abbreviation. |
| `src/catalog.ts` | 348-353 | Residual over-states itself: says a non-object element "(`null`, a string)" throws raw. Measured: a **string** and a **number** produce proper structured errors; only `null`/`undefined` throw raw. | INFO | Errs in the safe direction (claims a wider gap than exists), but ships inside the published `src/`. |

### Findings on the Orchestrator's Six Skeptical Points

1. **Vacuous PASS** — CONFIRMED and reproduced both ways (above). 03-08's remediation claim holds.
2. **`.input(` occurrence count** — CONFIRMED: **4** occurrences, only 1 executable (L386); 3 in doc comments. 03-02's "exactly 1" was comment-filtered. Now corrected in the harness header and VALIDATION correction #3.
3. **attw/publint blind to a moved export** — CONFIRMED, and **stronger than claimed**. Measured with `JSON_SCHEMA_TARGET` moved into the `export type` block: build **rc=0** with `[attw] No problems found` and `[publint] No issues found`. But the orchestrator's "**only** typecheck catches it" is now **FALSE** — `test/export-surface.test.ts` also caught it (2 of 4 cases failed) alongside `typecheck` (`TS1485`). Two independent gates now cover this hazard.
4. **59-total blind to a value→type move** — CONFIRMED blind (a move conserves the total), and correctly closed by the **49/10 split** and the **by-name** checks. Exactly 2 of 4 cases failed under Guard C, consistent with the total-59 and the `serverChallengeBrand` cases being unaffected.
5. **CAT-07 six-branch chain** — all six branches present and intact (`define-action.ts:106-113`). The corrected rationale IS in shipped source (lines 74-94), including the per-branch escape table and the explicit warning not to read escapes as permission to delete. No branch dropped.
6. **arktype is a `function`** — CONFIRMED by direct measurement. `hasStandardSchema` correctly admits `typeof schema === "function"` (`catalog.ts:357`).

### The `@__PURE__` Measurement Claim — Independently Reproduced

The surprising direction is **correct**.

| Measurement | 03-08 claim | Verifier measured | Verdict |
|---|---|---|---|
| `dist/index.js` delta | **+48 B** | **+48 B** (53,793 vs 53,745; two copies diffed to prove they differ *only* in the annotations) | CONFIRMED exactly |
| Consumer bundle, minified | **−194 B** | **−194 B** | CONFIRMED exactly |
| Consumer bundle, raw | −2,230 B | **−2,354 B** | Direction and magnitude confirmed; exact figure differs by 124 B (likely a different consumer entry) |
| Mechanism | library cannot tree-shake its own public exports | `Object.freeze` occurrences in the minified consumer bundle: **3 without** the annotations, **0 with** | CONFIRMED |

All three `Object.isFrozen` assertions are present (`artifact.test.ts:64, 65, 80`), so the safety net
covers all three annotated sites including `CONSENT_GRADE_ORDER`.

### Prose Corrections — Verified in the Shipped Artifact

| Correction | In source | In `dist/index.d.ts` |
|---|---|---|
| `readsUntrusted` — "SEC-05 shipped in Phase 3, and this field is now read" + "It reports; it does not block" | `types.ts:996-1015` | YES |
| `<const A>` scope — "CAT-01 has TWO mechanisms" | `catalog.ts:596-637` | YES |
| CAT-07 "Accepted residual gap" (`${number}`/`${bigint}`) | `define-action.ts:179-201` | YES |
| Known DX defect handed to Phase 4 | `catalog.ts:629-637` | YES |
| Phase-4 re-freeze hand-forward (`.filter()` returns unfrozen) | `catalog.ts:548-552` | Not in `.d.ts` — `deepFreeze` is module-private. Ships via `files: ["src"]`, which is what the comment itself relies on. Correct, not a gap. |

### Known-Open Items — Confirmed Handed Forward, Not Dropped

| Item | Status |
|---|---|
| SEC-03 half-closed | CONFIRMED. Phase-3 freeze measured working; REQUIREMENTS.md:207 and Phase 4 SC-5 still own the rest; `catalog.ts:548-552` states the `.filter()` hazard in source Phase 4 will read. |
| CAT-03 / CAT-04 | CONFIRMED mapped to Phases 4 / 8. |
| Inline-`defineAction` DX defect | CONFIRMED documented in shipped source (`catalog.ts:629-637`) **and** pinned by `_inlineDefineActionLosesTheUnion` (`test-d/catalog.test-d.ts:284`) asserting `readonly string[]`. Handed to Phase 4 prominently. |
| `/valibot/` assertion near-vacuous | **Better than reported.** Not merely noted — `test/emission.test.ts:327` is a dedicated case ("the bare /valibot/ match is nearly vacuous, and here is the measurement that proves it") that drives a non-valibot failure and asserts `not.toMatch(/its validator "valibot"/)`. The load-bearing assertions are the structured `issues[0].vendor === "valibot"` and the specific `/its validator "valibot"/` form. |

## Gaps Summary

**No blocking gaps.** The phase goal is achieved and was verified behaviorally against the shipped
artifact rather than through the test suite: a developer declares an action once, and the name set,
literal name union, emitted JSON Schema, and redaction policy are all derived from that one
declaration with no second registry. Each of the three wrong-declaration forms the ROADMAP
enumerates fails the build with a message naming the offending action and stating the fix, and the
two non-blocking markers report themselves without blocking. `assertSingleInstance` has its first
production call site.

Four items require a human decision rather than more verification:

1. **CAT-01 must not be rounded up.** Four of its five derived artifacts ship; `per-stage catalogs`
   is Phase 4's `catalogFor`, which has no implementation and is not exported. Recommendation: leave
   CAT-01 **Pending**.
2. **DX-03's `Every`** has one measured exception (`buildCatalog([null])` → raw `TypeError`),
   documented and deliberately accepted in shipped source.
3. **Error-message clarity** is mechanically verified but is a human judgment.
4. **One VALIDATION.md table abbreviation** (M-03-11) would mislead a future re-run driven from the
   table alone. The battery itself is sound.

The two harness defects the phase discovered are real, reproduce exactly, and are documented in the
shipped script. The three corrections claimed by 03-08 all landed in the shipped artifact, and the
`@__PURE__` measurement — the most surprising claim in the phase — reproduces to the byte on its two
headline figures.

---

_Verified: 2026-07-30T00:52:30Z_
_Verifier: Claude (gsd-verifier)_

## Phase 10 correction addendum — 2026-08-12

- **Original observation.** The verifier found that `buildCatalog([null])`
  escaped as a raw `TypeError` before the catalog could produce a named,
  actionable issue. It therefore left one explicit DX-03 exception and treated
  the absence of an action name as the reason a structured issue could not be
  emitted.
- **Current command.** Task 10-02-01 ran
  `CI=true pnpm --filter @fullselfbrowsing/concierge build && node_modules/.bin/vitest run packages/concierge/test/catalog.test.ts && CI=true pnpm --filter @fullselfbrowsing/concierge typecheck`;
  Task 10-02-02 then re-ran C23, C24, and C34 against the newly built artifact.
- **Current evidence.** C34 proves that `null` at index 0 yields an exact
  `invalid_declaration` issue with subject `declaration at index 0`, the
  specified nonempty problem and actionable fix, and no raw `TypeError`; an
  independent `schema_root_not_object` fault at index 1 remains present after it
  in aggregate order. C35 proves that `undefined`, primitives, and a hostile
  callable declaration all take the same indexed diagnostic path before any
  property read; the callable getter count remains zero. The type-level equality
  check pins `CatalogIssueCode` as an exact closed eleven-member union.
- **Superseded conclusion.** The prior DX-03 null-declaration exception is
  closed. D-10-13 supplies a truthful index when no action name exists, and
  D-10-14 makes the stable code, index subject, nonempty problem, and actionable
  fix sufficient mechanical evidence without inventing a name. The original
  observation remains above as historical evidence; this append-only correction
  follows D-10-16.
