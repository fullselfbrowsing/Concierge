# Phase 3: Action declaration and build-time validation - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — proposals recorded, not blocked on. The user
instructed "run all phases autonomously — don't stop", so recommended answers were
adopted rather than confirmed per area. Every decision below is annotated with its
rationale and its rejected alternative so a later reader can reverse one without
re-deriving why it was made.

<domain>
## Phase Boundary

A developer declares an action once — name, description, schema, redaction, handler —
and everything downstream is derived from that single declaration. Every way to declare
one wrongly is caught at build with a message naming the action and stating the fix.

**In scope:** `defineAction`, `buildCatalog`, schema emission, the redaction rule, the
description-literal constraint, the two warning markers (`destructive`, `readsUntrusted`),
and the first production call site for `assertSingleInstance`.

**Out of scope:** stage matching and `catalogFor` (Phase 4), `explain()` (Phase 4), the
bridge (Phase 5), dispatch (Phase 6), the consent kernel (Phase 8). This phase builds the
catalog; it does not offer it to anyone or run anything from it.

**The type surface is already locked.** Phase 1 shipped `ActionDefinition`,
`RedactionPolicy`, `SideEffects`, `readsUntrusted`, and the `jsonSchema` escape hatch as
types, with doc comments that name Phase 3 as the enforcement owner (`types.ts:873-878`
says so explicitly for SEC-01). This phase implements runtime against a fixed contract
rather than designing one. A change to `types.ts` here is a deviation, not a task.
</domain>

<decisions>
## Implementation Decisions

### What "build-time" means

- **Validation runs inside `buildCatalog()`, a runtime function called at module init.**
  CAT-02, CAT-03, and CAT-04 are all worded "catalog build throws", and `types.ts:874`
  already names `buildCatalog` as the owner. Rejected: a separate CLI step or a bundler
  plugin — both add a toolchain dependency for consumers and neither is implied by the
  requirement wording.

- **CAT-07 (descriptions must be static string literals) is enforced at the type level,
  not at runtime.** This is the one requirement in the phase that runtime *cannot*
  satisfy: a description assembled from i18n or CMS content is byte-identical at runtime
  to one written as a literal. The compiler can tell them apart — a widened `string`
  versus a literal type — and nothing else can. Constrain the `description` position so a
  non-literal is a type error naming the action. Rejected: a lint rule (ships nothing to
  consumers who do not adopt it) and documenting the constraint without enforcing it
  (which is what the requirement explicitly forbids).
  - **ANSWERED BY RESEARCH (03-RESEARCH.md), across 20 compiled probes.** Achievable, and
    **no `types.ts` amendment is needed** provided the guard lives on `defineAction` only.
    The winning formulation makes the rejection branch *itself* the error sentence, so tsc
    prints it verbatim and it survives terse non-TTY output — which is what satisfies
    DX-03's "names the action and states the fix". Two alternatives were measured to FAIL
    DX-03: a named type alias prints as `ErrObj` (names nothing), and a rest-tuple guard
    prints only `TS2554: Expected 2 arguments, but got 1`.
  - **The obvious guard is wrong, and wrong in the direction that matters.** `string extends D`
    **accepts** `` `Tenant ${tenant} filter.` `` — a template literal interpolating a `string`
    infers the *pattern type*, not `string`. That is exactly the per-tenant content vector
    CAT-07 exists to block, so the naive predicate would have shipped a guard that passes
    its own tests and admits the attack. A six-branch O(1) predicate closes every
    `${string}` hole position; the full 25-case accept/reject matrix is in RESEARCH.md.
    (This bullet originally read "five-probe" while the measured chain in RESEARCH
    *Pattern 1* has always listed SIX branches. Only the word was wrong. Corrected here so
    no reader deletes a branch to reach a count.)
  - **One residual gap, unclosed:** `${number}` / `${bigint}` holes defeated all six
    candidate predicates. The planner must either accept this narrower gap explicitly or
    find a sixth approach — it must not be discovered silently at execution time.
  - **Do NOT have `buildCatalog` re-check descriptions.** Measured: the mapped-type
    re-check works but false-positives on every `defineAction` result, and it is the only
    thing that would force a `types.ts` amendment. Guard on `defineAction` alone.

- **Errors aggregate; `buildCatalog` throws once carrying all of them.** A developer
  declaring twenty actions should see twenty problems in one run, not fix-rebuild twenty
  times. Rejected: throw on first failure.

- **A named error class carrying structured issues, not a formatted string.** DX-03
  requires every build-time error to name the offending action *and* state the fix, which
  is two fields plus a code — that wants structure. A formatted-string-only error makes
  the requirement untestable except by substring matching.

### Warnings versus errors

- **`destructive`-without-consent and `readsUntrusted`-without-consent both report
  through a diagnostics array returned on the built catalog, and additionally emit a
  default warning.** The roadmap's SC-3 is explicit that these must "report themselves"
  without blocking, because a consent policy can legitimately live a layer up. A console
  warning alone is an annotation nothing reads and nothing can test; a returned array is
  assertable. Rejected: console-only.
  - **CORRECTED BY RESEARCH (03-RESEARCH.md).** This decision originally read "warn on the
    console by default." That does not compile: `console` is **not type-visible** under
    `lib: ["ES2022"]` with no DOM types, which is a hard project constraint. The measured
    working form is a structural `globalThis` read, which compiles clean. The *intent* —
    a default-on warning that a consumer can redirect — is unchanged; only the mechanism
    was wrong. Recorded rather than silently rewritten, because a reader who finds a
    `globalThis` shim here should know it is deliberate and why.

- **Severity is configurable through an `onDiagnostic` hook, defaulting to warn.** An app
  that wants `destructive`-without-consent to be fatal can make it fatal in its own build
  without Concierge choosing that for everyone. This is the mechanism that keeps SEC-05's
  taint marker from being "an annotation nothing reads" — the exact failure the Phase 1
  doc comment (`types.ts:977-984`) warns about.

- **Both markers report in the same shape with different codes.** Roadmap SC-3b says
  `readsUntrusted` must report "the same way" as `destructive`. Same shape, distinct code,
  so a consumer can filter one without the other.

- **One diagnostic per offending action, each naming its action.** Rejected: a single
  aggregated summary line, which loses the name DX-03 requires.

### Schema emission

- **Emission order is: explicit `jsonSchema` escape hatch → `~standard.jsonSchema.input(...)`
  → throw naming the action *and* the vendor.** Locked by the ROADMAP Notes for this phase.
  The vendor must be in the message because the failure is a property of the validator, not
  of the developer's declaration, and without the vendor name the developer cannot tell
  which of those two it is.

- **`.input(...)` specifically, never `.output()`.** A schema carrying a transform or a
  default emits a different schema in each direction, and tool calling needs the side the
  agent must produce. Roadmap-locked.

- **Re-probe the installed validator packages rather than reading the spec site.**
  Standard JSON Schema is implemented by Zod and ArkType but *not* by Valibot as published,
  despite documentation claiming otherwise. Phase 1 verified this empirically
  (`types.ts:931-937`) and the ROADMAP Research note flags that trusting the docs "would
  have deleted the escape hatch that is the only working path for one of three target
  validators."

- **A schema whose emitted root is not `type: "object"` throws, naming the action.**
  Reproduced on current Zod via `z.discriminatedUnion`, so this is a live trap and not a
  hypothetical. Rejected: warn and coerce, which would silently ship a catalog the agent
  cannot call.

### `defineAction`, freezing, and the single-instance call site

- **`defineAction` is an identity function — inference only, zero runtime validation.**
  Every check lives in `buildCatalog`, so there is exactly one place to audit and one place
  a check can be forgotten. Rejected: validating eagerly at declaration, which splits the
  rules across two functions and makes "did we check X?" a two-file question.

- **`assertSingleInstance` is called on the first line of `buildCatalog`.** This closes
  ROADMAP Phase 3 SC-5, added from `02-VERIFICATION.md` finding W5: Phase 2 shipped the
  guard with no production call site at all. `buildCatalog` is the earliest entry point
  every consumer necessarily reaches. Rejected: calling it from `defineAction` (runs once
  per action, so it would fire N times) and a module-scope call — 02-06 *measured* that a
  module-scope registration is deleted from consumer bundles under `sideEffects: false`,
  so it would test green and do nothing in every real app.

- **The catalog is frozen after build, closing SEC-03 here rather than in Phase 6.**
  SEC-03 is nominally a later requirement, but `buildCatalog` is the only place a freeze
  can happen and it is being written now. Freezing is free today and a breaking change
  after publish.
  - **SHARPENED BY RESEARCH (03-RESEARCH.md): a shallow freeze does not satisfy SEC-03.**
    Measured — `Object.freeze(entries)` leaves `catalog[0].handler = attackerFn`
    succeeding *silently*, and the replaced handler then runs. SEC-03 exists precisely to
    stop third-party page script swapping a handler at runtime, so the shallow form
    implements the requirement's letter and none of its purpose. **Recursive freeze is
    required.**
  - Research measured **no conflict** with Phase 4's STG-04 memoization, so the deferral
    escape hatch is not needed. One consequence to hand forward: `.filter()` on a frozen
    array returns an *unfrozen* one, so Phase 4's `catalogFor` must re-freeze its result.

- **`buildCatalog` returns a new frozen catalog rather than mutating its input.** STG-04
  already requires `catalogFor` to return a memoized frozen array, so the phase is
  freeze-shaped already.

### Claude's Discretion

- Internal module layout, file names, and the split between validation rules and the
  catalog assembly they run inside.
- Diagnostic code naming scheme, provided codes are stable strings and distinct per rule.
- Whether validation rules are expressed as a table of small functions or inline — as long
  as adding a rule is a one-place change.
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `packages/concierge/src/types.ts` (76,599 B) — the entire type contract, already final.
  `ActionDefinition` (l.913), `RedactionPolicy` (l.880), `SideEffects` (l.844 area),
  `readsUntrusted` (l.984), `jsonSchema` escape hatch (l.938), `AnyActionDefinition` (l.1022).
- `packages/concierge/src/contract.ts` — `CONTRACT_VERSION` and `assertSingleInstance`,
  shipped in Phase 2 with **no production call site**. This phase provides the first one.
- `packages/concierge/src/index.ts` — the public barrel, currently 45 exported names
  (39 types + 6 values) in two blocks. Adding `defineAction` and `buildCatalog` grows the
  value side; `export-surface.test.ts` pins the count and will need updating in step.

### Established Patterns

- **Test suites live at `packages/concierge/test/*.test.ts` (runtime, Vitest) and
  `packages/concierge/test-d/*.test-d.ts` (type-level, `tsc -p tsconfig.test-d.json`).**
  CAT-07 is a type-level requirement and belongs in `test-d/`.
- **Mutation proofs via `scripts/mutate-and-prove.sh`** — this phase's validation rules
  should each have a mutant proving the rule fires. Known harness defect: it reports
  "tree clean" while the repo is dirty when a gate can trigger a pnpm install (lockfile
  rewritten outside its `trap`). Preventive remedy is
  `pnpm --config.verify-deps-before-run=false`; `CI=true`/`--frozen-lockfile` is actively
  wrong because it produces a vacuously-green PASS. Found by 02-05, re-confirmed by 02-12.
- **Gates:** `pnpm typecheck`, `pnpm build`, `pnpm test`, `check:artifact`, `check:deps`,
  `check:pack`, `check:node-floor` — all currently exit 0 and must continue to.
- **`typecheck` is load-bearing and separate from `build`.** Measured under mutant P8:
  `attw` and `publint` both report "No problems found" with exit 0 on a build whose
  `dist/index.js` had *lost* an export. A build passing does not prove the export surface.
- **`pnpm test -- <name>` does NOT filter** — vitest's cac CLI discards everything after
  `--`, so the whole suite runs. Use the bare form. Reproduced five times in Phase 2.

### Integration Points

- `buildCatalog` is consumed by Phase 4 (`catalogFor`, `explain()`), Phase 7 (session
  pushes the stage catalog to the transport) and Phase 8 (the grade gate reads the catalog).
  CAT-03 and CAT-04 — consent target existence and transport grade ceiling — are *listed
  under Phase 4/8 requirements* but are catalog-build checks; the planner should confirm
  which phase owns them rather than assuming this one does.
- `index.ts` export surface is pinned by `export-surface.test.ts` (currently 45 names) and
  by `test-d/exports.test-d.ts`. Both must move together with any new export.
</code_context>

<specifics>
## Specific Ideas

- **The error message is the product here, not an afterthought.** DX-03 makes "names the
  offending action and states the fix" a requirement, and the phase goal repeats it. A
  message that says what is wrong without saying what to do fails the requirement even if
  it throws at the right moment.
- **The vendor name belongs in the schema-emission failure**, because the developer
  otherwise cannot tell whether their declaration is wrong or their validator simply
  cannot emit.
- **Three prose claims are currently false and ship to consumers.**
  `packages/concierge/src/types.ts:505-506` (and `test-d/actions.test-d.ts:147`, `:153-155`)
  claim a lone TS2578 is mutant M9's "only symptom" and that a single detector is its
  "sole" one — both became false when 02-11 added a second, named detector. `types.ts`
  ships inside `dist/index.d.ts`, so **consumers read the false claim**. 02-12 was scoped
  out of fixing them. Exact replacement wording is in `02-11-SUMMARY.md`. If this phase
  touches `types.ts` for any reason, fix these in the same commit.
- **Same file, same trip:** `types.ts` has three `Object.freeze(...)` calls needing
  `/* @__PURE__ */` annotations. Without them ~205 B of dead calls are retained in every
  consumer bundle, because `assertSingleInstance` now keeps the module alive. Measured by
  02-06 and independently by 02-07 and the phase-2 verifier.
</specifics>

<deferred>
## Deferred Ideas

- **Stage matching, `catalogFor`, and `explain()`** — Phase 4. This phase builds a catalog;
  it does not scope one to a stage or explain why an action was absent.
- **CAT-03 (consent target exists) and CAT-04 (grade ceiling)** — both are catalog-build
  checks but are assigned to later phases in REQUIREMENTS.md. Flagged for the planner to
  resolve ownership rather than silently absorb.
- **T-02-44** — `scripts/node-floor-check.sh` executes a Node runtime downloaded from
  nodejs.org/dist with no checksum verification. Accepted for v0.1; confirmed not invoked
  from CI. Remediation is larger than the "two-line change" originally claimed: the
  `curl | tar` pipe must materialise the `.tar.xz` first, and `SHASUMS256.txt` is itself
  unsigned-checked without `.sig`.
- **The `mutate-and-prove.sh` lockfile hazard** — preventive remedy known and verified;
  the harness itself has not been patched.
- **First CI run and first publish-attestation check** — `ci.yml` and `release.yml` have
  never executed. Phase 2 verification was `human_needed` on exactly this, and the user
  accepted tarball-level evidence for v0.1.
</deferred>
