---
phase: 3
slug: action-declaration-and-build-time-validation
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-29
planned: 2026-07-29
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled at planning time; signed off by plan 03-08 Task 3.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Runtime framework** | Vitest 4.1.10 — `packages/*/test/**/*.test.ts`, `environment: node`, one shared project |
| **Type-level framework** | `tsc -p packages/concierge/tsconfig.test-d.json` over `src/**/*.ts` + `test-d/**/*.ts`. **Not** Vitest typecheck mode, which `vitest.config.ts:19-24` records as exiting 1 |
| **Config files** | `vitest.config.ts` (root), `packages/concierge/tsconfig.test-d.json` |
| **Quick run command** | `pnpm test <fragment>` — **BARE, no `--`** |
| **Type-level command** | `pnpm typecheck` |
| **Full suite command** | `pnpm build && pnpm typecheck && pnpm test` |
| **Phase gate command** | the above plus `pnpm check:artifact`, `check:deps`, `check:pack`, `check:node-floor` |
| **Estimated runtime** | typecheck ~0.1 s (TS 7, `isolatedDeclarations`); full runtime suite < 3 s |

### Two command traps that will otherwise waste executor time

1. **`pnpm test -- <name>` does NOT filter.** Vitest's cac CLI discards everything after `--`, so
   the whole suite runs and a "targeted" run silently means something else. Reproduced six times
   across Phases 2 and 3. Every command in this document uses the bare form.
2. **`pnpm build` must precede `pnpm test`.** `artifact.test.ts`, `export-surface.test.ts`,
   `single-instance.test.ts` and this phase's two new runtime suites all read
   `packages/concierge/dist/` from disk. On a clean checkout, or after any source change, `pnpm test`
   alone reads a stale or absent artifact.

### A third trap that applies only to mutation runs

`dist/` is **gitignored**. `scripts/mutate-and-prove.sh` restores only `$TARGET` and then prints
"tree clean" — and `git status --porcelain` agrees — while `dist/` still holds the build made from
the mutated source. Every mutant whose gate rebuilds must be followed by an explicit `pnpm build`.
Every mutant gate must also use `pnpm --config.verify-deps-before-run=false`; `CI=true` and
`--frozen-lockfile` are actively wrong here because they produce a vacuously-green PASS.

`scripts/mutate-and-prove.sh:32` claims `tsc` exits **2** on diagnostics. Under TypeScript 7.0.2 it
exits **1**. Every expectation below says 1; the prose in the harness is stale, not the practice.

---

## Sampling Rate

- **After every task commit:** `pnpm typecheck` (0.1 s) plus the one `pnpm test <fragment>` the task
  touches.
- **After every plan wave:** `pnpm build && pnpm typecheck && pnpm test`.
- **Before `/gsd-verify-work`:** the full phase gate — all seven scripts green on a clean tree.
- **Max feedback latency:** < 3 s for the typecheck path; < 10 s including a rebuild.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | CAT-07, DX-03 | T-03-01 / T-03-03 | A non-literal description cannot compile; the rejection branch IS the error sentence | type | `pnpm typecheck` | ❌ W0 → `src/define-action.ts` | ⬜ pending |
| 3-01-02 | 01 | 1 | CAT-07 | T-03-01 / T-03-02 | Every `${string}` hole position rejected; the `${number}` gap pinned as accepted | type + mutation | `pnpm typecheck` · M-03-1 · M-03-2 | ❌ W0 → `test-d/description-literal.test-d.ts` | ⬜ pending |
| 3-01-03 | 01 | 1 | CAT-07, DX-03, SEC-01 | T-03-03 / T-03-04 | The compile error names the action and states the fix in terse non-TTY output; `redact` stays required | type + mutation | `pnpm typecheck` · DX-03 message proof · `redact?` mutant | ✅ `test-d/actions.test-d.ts` | ⬜ pending |
| 3-02-01 | 02 | 1 | CAT-02, CAT-06 | T-03-06 / T-03-08 / T-03-10 | Emission order locked; own-key iteration only; `.output()` absent | type | `pnpm typecheck` | ❌ W0 → `src/json-schema.ts` | ⬜ pending |
| 3-02-02 | 02 | 1 | CAT-02, CAT-06 | T-03-SC | Three exact-pinned, registry-verified validators; PKG-05 byte count unmoved | unit + CLI | `pnpm build && pnpm test && pnpm check:deps && pnpm check:artifact` | ❌ W0 → `test/fixtures/schemas.ts` | ⬜ pending |
| 3-02-03 | 02 | 1 | CAT-06 | T-03-10 | The default target's literal survives into the emitted `.d.ts` | type + mutation | `pnpm typecheck` · annotation mutant | ❌ W0 → `test-d/json-schema.test-d.ts` | ⬜ pending |
| 3-03-01 | 03 | 2 | CAT-05, SEC-05, DX-03 | T-03-19 | `{action, fix}` are structured fields; the host reach is a named seam, not an ad-hoc cast | type | `pnpm typecheck` | ❌ W0 → `src/host.ts`, `src/catalog.ts` | ⬜ pending |
| 3-03-02 | 03 | 2 | CAT-01, CAT-02, CAT-05, CAT-06, SEC-01, SEC-03, SEC-05, DX-03, PKG-04 | T-03-11..T-03-18 | Aggregate throw; both diagnostics; SEC-01 fails closed both ways; recursive freeze; guard armed on the first line | type + build | `pnpm typecheck && pnpm build && pnpm test && pnpm check:deps` | ❌ W0 → `src/catalog.ts` | ⬜ pending |
| 3-03-03 | 03 | 2 | PKG-04 | T-03-18 | The shipped doc comment names the real call site | build | `pnpm typecheck && pnpm build && pnpm test` | ✅ `src/contract.ts` | ⬜ pending |
| 3-04-01 | 04 | 3 | CAT-01, CAT-06, CAT-07 | T-03-20 / T-03-21 | Every new value is a real runtime binding; internals stay internal | unit + CLI | `pnpm build && pnpm check:artifact` + dynamic-import probe | ✅ `src/index.ts` | ⬜ pending |
| 3-04-02 | 04 | 3 | CAT-01, CAT-07, DX-03 | T-03-20 / T-03-22 / T-03-23 / T-03-48 | The pin equals the measured surface in all four places, incl. the third count-bearing `it` title; P8-equivalent proved; the SHIPPED `defineAction` description slot is pinned by the one foreign program that compiles `dist/index.d.ts` | unit + type + mutation | `pnpm build && pnpm typecheck && pnpm test && pnpm check:pack` · P8-equivalent mutant · probe negative control | ✅ four guard files (incl. `test/fixtures/probe.ts`) | ⬜ pending |
| 3-05-01 | 05 | 3 | CAT-01, CAT-07, SEC-01 | T-03-24 / T-03-25 / T-03-26 | One declaration yields the literal name union; the lookup is keyed by it | type + mutation | `pnpm typecheck` · M-03-3 | ❌ W0 → `test-d/catalog.test-d.ts` | ⬜ pending |
| 3-06-01 | 06 | 4 | CAT-01, CAT-02, CAT-05, SEC-01, SEC-03, SEC-05, DX-03 | T-03-27..T-03-30 / T-03-49 | Errors aggregate and name their actions; both markers report without blocking; the default sink actually reaches the host; a record-shaped schema with no `redact` FAILS rather than defaulting; the tamper attempt leaves the handler unchanged | unit | `pnpm build && pnpm test catalog` | ❌ W0 → `test/catalog.test.ts` | ⬜ pending |
| 3-06-02 | 06 | 4 | PKG-04 | T-03-31 | Registry empty after import, populated after `buildCatalog([])` | unit | `pnpm build && pnpm test single-instance` | ✅ `test/single-instance.test.ts` | ⬜ pending |
| 3-06-03 | 06 | 4 | CAT-05, SEC-01, SEC-03, DX-03, PKG-04 | T-03-32 / T-03-33 / T-03-49 | Six catalog rules each proved to fire; artifact rebuilt from clean source | mutation | M-03-7 · M-03-8 · M-03-9 · M-03-11 · M-03-12 · M-03-13 | ✅ (created 3-06-01/02) | ⬜ pending |
| 3-07-01 | 07 | 4 | CAT-02, CAT-06, DX-03 | T-03-34..T-03-38 | Both failure shapes read differently; the escape hatch is proved to win; the INPUT projection ships | unit | `pnpm build && pnpm test emission` | ❌ W0 → `test/emission.test.ts` | ⬜ pending |
| 3-07-02 | 07 | 4 | CAT-02, CAT-06, DX-03 | T-03-39 / T-03-40 | Four emission rules each proved to fire | mutation | M-03-4 · M-03-5 · M-03-6 · M-03-10 | ✅ (created 3-07-01) | ⬜ pending |
| 3-08-01 | 08 | 5 | CAT-05, SEC-01, SEC-05 | T-03-41..T-03-44 | No false prose ships; the third `Object.isFrozen` assertion lands FIRST so the safety net covers all three annotated sites; the annotations do not drop a live freeze | unit + CLI | `pnpm build && pnpm typecheck && pnpm test && pnpm check:deps && pnpm check:artifact` | ✅ `src/types.ts`, `test/artifact.test.ts` | ⬜ pending |
| 3-08-02 | 08 | 5 | all eight | T-03-45 | Sixteen mutants observed firing against the FINAL tree | mutation | the thirteen-row numbered battery plus three guard mutants | ✅ | ⬜ pending |
| 3-08-03 | 08 | 5 | all eight | T-03-46 / T-03-47 | Every gate green on a clean tree; the sign-off is honest | CLI | `pnpm build && typecheck && test && check:artifact && check:deps && check:pack && check:node-floor` | ✅ this file | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Sampling continuity check:** no three consecutive task rows lack an `<automated>` command. Every
row above carries one. `nyquist_compliant: true` is asserted on that basis at planning time and is
re-asserted honestly by 3-08-03.

---

## Requirement → Test Map

| Req | Behaviour | Type | Automated command | Owning task |
|-----|-----------|------|-------------------|-------------|
| CAT-01 | one declaration yields the literal name union | type | `pnpm typecheck` | 3-05-01 |
| CAT-01 | one declaration yields the emitted schema and the redaction policy, no second registry | unit | `pnpm test catalog` | 3-06-01 |
| CAT-02 | a non-object root throws, naming the action | unit | `pnpm test catalog` | 3-06-01 |
| CAT-02 | `z.discriminatedUnion` specifically is caught, and the message names `oneOf` | unit | `pnpm test emission` | 3-07-01 |
| CAT-05 | `destructive` without consent yields a diagnostic and does NOT throw | unit | `pnpm test catalog` | 3-06-01 |
| CAT-06 | an explicit `jsonSchema` beats derivation | unit | `pnpm test emission` | 3-07-01 |
| CAT-06 | a vendor with no converter throws, naming action AND vendor | unit | `pnpm test emission` | 3-07-01 |
| CAT-07 | widened `string` rejected; the message names the action and states the fix | type | `pnpm typecheck` + message proof | 3-01-02, 3-01-03 |
| CAT-07 | every `${string}` hole position rejected | type | `pnpm typecheck` | 3-01-02 |
| CAT-07 | every accept case in the measured matrix compiles | type | `pnpm typecheck` | 3-01-02 |
| CAT-07 | the description slot survives `.d.ts` emission as a LITERAL, seen by a program that compiles only the shipped declarations | type (consumer-side) | `pnpm check:pack` + the probe negative control | 3-04-02 |
| CAT-05 | the default diagnostic sink actually reaches the host — deleting the call fails a test | unit | `pnpm test catalog` · M-03-13 | 3-06-01, 3-06-03 |
| SEC-01 | `redact` is non-optional at the type level | type | `pnpm typecheck` | 3-01-03 |
| SEC-01 | a non-empty schema with no `redact` throws, naming the action | unit | `pnpm test catalog` | 3-06-01 |
| SEC-01 | an empty schema with no `redact` resolves to `"drop"` | unit | `pnpm test catalog` | 3-06-01 |
| SEC-01 | a RECORD-shaped schema (no `properties`, but `propertyNames`) with no `redact` FAILS rather than defaulting | unit | `pnpm test catalog` · M-03-12 | 3-06-01 |
| SEC-03 | a built handler cannot be replaced, and neither can the `byName` lookup | unit | `pnpm test catalog` | 3-06-01 |
| SEC-05 | `readsUntrusted` without consent yields a diagnostic under a DISTINCT code | unit | `pnpm test catalog` | 3-06-01 |
| DX-03 | every issue carries `{action, fix}` as fields, not substrings | unit | `pnpm test catalog` | 3-06-01 |
| DX-03 | errors aggregate — N bad actions yield N issues in one throw | unit | `pnpm test catalog` | 3-06-01 |
| DX-03 | the compile-time error names the action in terse non-TTY `tsc` output | type | message proof over captured `tsc` output | 3-01-03 |
| PKG-04 (SC-5) | `assertSingleInstance` is called from `buildCatalog` | unit | `pnpm test single-instance` | 3-06-02 |
| — | the export surface moves in step across all four sites, including the third count-bearing `it` title whose assertion carries no number | unit + type | `pnpm build && pnpm typecheck && pnpm test export-surface` | 3-04-02 |

---

## Mutant Obligations

Every gate uses `pnpm --config.verify-deps-before-run=false`. Expected gate exit is **1**, not 2.
Every build-gated mutant is followed by `pnpm build`.

| # | Target | Mutation | Gate | Expected failure | First proved by |
|---|--------|----------|------|------------------|-----------------|
| M-03-1 | `src/define-action.ts` | `description: LiteralDescription<N, D>` → `description: D` | `pnpm typecheck` | the two family-2 predicates go red; family 1 stays green | 3-01-02 |
| M-03-2 | `src/define-action.ts` | drop the interior-hole probe | `pnpm typecheck` | the interior-`${string}` predicate goes red | 3-01-02 |
| M-03-3 | `src/catalog.ts` | `<const A extends` → `<A extends` | `pnpm typecheck` | both name-union predicates go red | 3-05-01 |
| M-03-4 | `src/json-schema.ts` | derivation before the escape hatch | build + `pnpm test emission` | the CAT-06 ordering case fails | 3-07-02 |
| M-03-5 | `src/json-schema.ts` | `.input(` → `.output(` | build + `pnpm test emission` | the default-carrying fixture's projection differs | 3-07-02 |
| M-03-6 | `src/json-schema.ts` | remove the root-`type` check | build + `pnpm test emission` | the `discriminatedUnion` and string-root cases fail | 3-07-02 |
| M-03-7 | `src/catalog.ts` | `deepFreeze(...)` → shallow `Object.freeze(...)` | build + `pnpm test catalog` | the handler-replacement case fails | 3-06-03 |
| M-03-8 | `src/catalog.ts` | remove `assertSingleInstance();` | build + `pnpm test single-instance` | the SC-5 case fails | 3-06-03 |
| M-03-9 | `src/catalog.ts` | `new CatalogValidationError(issues)` → `…(issues.slice(0, 1))`. **NOT** `issues.length > 0` → `> 1`: the throw is after the loop, the harness cannot move a statement, and `4 > 1` leaves the four-issue case passing so that mutant escapes | build + `pnpm test catalog` | the four-issues case fails on `err.issues.length` | 3-06-03 |
| M-03-10 | `src/json-schema.ts` | drop `vendor` from the not-emittable failure | build + `pnpm test emission` | the vendor-named case fails | 3-07-02 |
| M-03-11 | `src/catalog.ts` | `Object.create(null)` → `{}` | build + `pnpm test catalog` | the null-prototype case fails | 3-06-03 |
| M-03-12 | `src/catalog.ts` | delete the `redaction_missing` issue push | build + `pnpm test catalog` | SEC-01's non-empty-schema cases (10 and 11b) fail | 3-06-03 |
| M-03-13 | `src/catalog.ts` | `warnHost(` → `void (` in the default diagnostic sink (fallback: `host.console?.warn(message)` → `void message;` in `src/host.ts`) | build + `pnpm test catalog` | case 9b fails — the default warning CONTEXT locks is otherwise deletable with nothing noticing | 3-06-03 |
| guard A | `src/types.ts` | `redact:` → `redact?:` | `pnpm typecheck` | `_redactIsRequired` goes red | 3-01-03 |
| guard B | `src/json-schema.ts` | annotate `JSON_SCHEMA_TARGET: JsonSchemaTarget` | `pnpm typecheck` | `_targetDefaultIsTheLiteral` goes red | 3-02-03 |
| guard C | `src/index.ts` | move one new value into the `export type` block | `pnpm typecheck` | the P8-equivalent hazard reproduces on this phase's own surface | 3-04-02 |

All **sixteen** — thirteen numbered plus three guards — are re-run against the final tree by task
3-08-02. Task 3-08-02's own list is the same sixteen; if the two ever disagree, this table is the
authority.

---

## Wave 0 Requirements

Six files do not exist at planning time. Each is created by the plan named beside it, and each
plan's own gates cover the tasks that precede it.

- [ ] `packages/concierge/test-d/description-literal.test-d.ts` — CAT-07, both assertion families,
      the accept/reject matrix, the known-gap pin — **created by 03-01 Task 2**
- [ ] `packages/concierge/test-d/json-schema.test-d.ts` — the target literal and converter contract
      — **created by 03-02 Task 3**
- [ ] `packages/concierge/test/fixtures/schemas.ts` — twelve schema fixtures across three real
      validators plus two hand-rolled, `zodRecord` among them (the only one that exercises SEC-01's
      emptiness heuristic) — **created by 03-02 Task 2**
- [ ] `packages/concierge/test-d/catalog.test-d.ts` — CAT-01's derived name union —
      **created by 03-05 Task 1**
- [ ] `packages/concierge/test/catalog.test.ts` — CAT-01/02/05, SEC-01/03/05, DX-03 —
      **created by 03-06 Task 1**
- [ ] `packages/concierge/test/emission.test.ts` — CAT-02/06 against real validators —
      **created by 03-07 Task 1**

Two source-authoring tasks (3-03-01, 3-03-02) have `pnpm typecheck && pnpm build` as their automated
verify because their behavioural suites land one wave later, in 03-06 and 03-07. This is stated
plainly rather than papered over: the compile-and-bundle gate is real but is not a behaviour gate,
and the behaviour gate arrives with full mutation proofs in wave 4.

`wave_0_complete` flips to `true` when all six files exist and are green. Set by 3-08-03.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The CAT-07 `${number}` / `${bigint}` residual gap | CAT-07 | **Not manual — ACCEPTED.** Six candidate predicates were measured against it and every one classifies `` `Show ${number} results.` `` as concrete; a targeted `${infer A}${number}${infer B}` decomposition does not match at all. Accepted because a numeric hole can carry only digits, `-`, `.`, `e`, `+`, `Infinity` and `NaN` — it cannot carry prose, and CAT-07's threat is prose-borne agent steering. Residual risk stated honestly: an attacker controlling a numeric value can still shift stated numbers such as a limit. | The acceptance is recorded in `src/define-action.ts`'s doc comment (which ships inside `dist/index.d.ts`) and pinned by a known-gap predicate in `test-d/description-literal.test-d.ts`. If a future compiler closes the gap, that predicate goes red and the doc comment is updated. Review at any TypeScript upgrade. |
| First CI run and first publish attestation | — | `ci.yml` and `release.yml` have still never executed. Carried unchanged from Phase 2's `human_needed` verification; the user accepted tarball-level evidence for v0.1. Not touched by this phase. | Out of scope here. Recorded so it is not read as a new gap. |
| `scripts/node-floor-check.sh` downloading Node without checksum verification (T-02-44) | — | Accepted for v0.1; confirmed not invoked from CI. Remediation is larger than the "two-line change" originally claimed. | Out of scope here. Recorded so it is not read as a new gap. |

All phase-requirement behaviours have automated verification.

---

## Deliberate Non-Assertions

Written down rather than asserted, following the precedent at
`packages/concierge/test/export-surface.test.ts:31-46` — a vacuously-passing guard reads in a diff
and a test report exactly like coverage, and must not be counted as one.

1. **What a host WITHOUT a `console` does is not asserted** — and that is now the whole of the
   non-assertion. An earlier draft of this document declined to assert the console path at all,
   which left the default warning CONTEXT locks deletable with nothing in the repository noticing.
   `test/catalog.test.ts` case 9b closes that: it installs a capturing stand-in on
   `globalThis.console` (a plain assignment — the repo bans `vi.`, not global assignment), restores
   it in a `finally`, and asserts both that the sink fired and that what it emitted carried the
   diagnostic code. M-03-13 proves the case. What remains unasserted is only the host-absent branch:
   core reaches `globalThis.console?.warn` structurally and a host may legitimately have none.
   `catalog.diagnostics` and the `onDiagnostic` hook remain the primary assertable surface and are
   both asserted independently.
2. **Targets outside `{draft-2020-12, draft-07}` are NOT asserted cross-vendor.** Measured: zod
   silently emits for a nonsense target while arktype throws `ParseError`. Asserting outside the
   intersection would encode one vendor's tolerance as a contract.
3. **`action.schema` is deliberately NOT frozen**, and the suite asserts that it is not. Freezing a
   third-party validator's internals is untested and not obviously safe; SEC-03 names the handler,
   not the validator.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a named Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3 s on the typecheck path
- [ ] All sixteen mutants observed firing against the FINAL tree
- [ ] All seven gate scripts green on a clean tree
- [ ] `nyquist_compliant: true` is honest
- [ ] `wave_0_complete: true` set

**Approval:** pending — ticked by plan 03-08 Task 3.
