---
phase: 2
slug: packaging-build-and-release
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**This phase has an unusual validation shape in the opposite direction from Phase 1.** Phase 1 had
no test runner and the compiler was the entire apparatus. Phase 2 *introduces* the test runner, so
almost every row below starts as ❌ and Wave 0 is large and real. More importantly: **every gate in
this phase is a structural claim enforced by a shell exit code**, and shell exit codes fail silently
green far more readily than type assertions. A green suite here is not evidence of a working suite.

Derived from `02-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (runtime)** | **Vitest 4.1.10** — `test.projects` with a single `node` project. No `jsdom` project until Phase 9. **`typecheck` mode OFF.** |
| **Framework (type-level)** | **`tsc --noEmit`** via `tsconfig.test-d.json` — Phase 1's apparatus, retained unchanged |
| **Framework (artifact)** | `publint@0.3.22`, `@arethetypeswrong/cli@0.18.5`, plus two bespoke scripts (`pkg05-zero-runtime-deps.mjs`, `pack-install-check.sh`) |
| **Config file** | `vitest.config.ts` (root) — **does not exist yet, Wave 0 creates it** |
| **Test file glob** | `packages/concierge/test/**/*.test.ts` — **does not exist yet** |
| **Type-test glob** | `packages/concierge/test-d/**/*.test-d.ts` — exists, 5 files, exits 0 today `[VERIFIED]` |
| **Quick run command** | `pnpm --filter @fullselfbrowsing/concierge typecheck` (~0.08 s under TS 7) |
| **Full suite command** | `pnpm typecheck && pnpm build && pnpm test` |
| **Distribution suite** | `pnpm run check:deps && pnpm run check:pack && pnpm run check:node-floor` |
| **Estimated runtime** | < 2 s for the full suite after first build; `check:pack` is network-bound, `check:node-floor` is download-bound once |
| **Current state** | `pnpm build` exits **1** (`ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`); `pnpm test` exits **0** as a silent no-op. Both `[VERIFIED 2026-07-28]` |

**Glob collision — verified, and load-bearing.** Vitest 4's default `test.include` does **not** match
`*.test-d.ts`, so the runtime and type suites coexist. But Vitest's `typecheck.include` default
**does** match them. Keep typecheck mode off; if it is ever enabled, `typecheck.include` must first
be narrowed away from `test-d/`.

---

## Sampling Rate

The cost profile is favourable — measured: `tsc --noEmit` ~0.08 s under TS 7, `tsdown` 35 ms,
`publint` ~105 ms, `attw` ~99 ms. There is no cost argument for sampling less than everything.

- **After every task commit:** `pnpm typecheck` (must exit 0) and, once Wave 2 lands, `pnpm test`.
- **After every plan wave:** `pnpm typecheck && pnpm build && pnpm test && pnpm run check:deps`.
- **After every plan wave, Wave 3 onward:** additionally `pnpm run check:pack`.
- **Before `/gsd-verify-work`:** all of —
  1. all of the above green from a clean checkout
  2. `pnpm run check:node-floor` green on a real **v22.12.0** (not the developer's v24.14.1)
  3. the **eleven-mutant battery** below run in full, every mutant producing a non-zero exit from
     its named gate, with `git diff --exit-code` clean after each
  4. `git status --porcelain` empty
  5. the packed tarball's file list reviewed by eye once, against the Wave 1 sourcemap decision
- **Max feedback latency:** < 2 seconds for the inner loop.

---

## Per-Task Verification Map

*Populated by Wave 0. Task IDs do not exist until plans are written; this table is filled in and
`wave_0_complete` flipped to `true` as part of the first plan in the phase.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *pending* | — | — | — | — | — | — | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Test Map (from RESEARCH.md)

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| **PKG-01a** | `publint` reports no errors on the packed artifact | artifact lint | `pnpm --filter @fullselfbrowsing/concierge exec publint --strict` | ❌ Wave 1 |
| **PKG-01b** | `attw` reports no errors under the ESM-only profile | artifact lint | `attw --pack packages/concierge --profile esm-only` | ❌ Wave 1 |
| **PKG-01c** | Both gates fail the **build** when the manifest is wrong | build gate | `pnpm build` with `attw: {level:"error", profile:"esm-only"}` | ❌ Wave 1 |
| **PKG-01d** | A typecheck failure cannot pass the build — `tsc --noEmit` fires while `tsdown` does not | **structural, mutation-only** | `mutate-and-prove.sh … -- pnpm typecheck`, then assert `pnpm build` exits 0 on the same mutant | ❌ Wave 1 |
| **PKG-02** | A scratch project outside the repo installs the tarball, imports it, typechecks against the shipped `.d.ts` with `skipLibCheck: false` | integration (shell) | `pnpm run check:pack` | ❌ Wave 3 |
| **PKG-03a** | The artifact imports and executes on **exactly** Node v22.12.0 | integration (pinned runtime) | `pnpm run check:node-floor` | ❌ Wave 3 |
| **PKG-03b** | The floor job is genuinely pinned, not merely "some Node 22" | assertion inside the job | `node -e "if(process.version!=='v22.12.0') throw …"` | ❌ Wave 3 |
| **PKG-04a** | Two independently-evaluated copies of the built artifact share one registry record | unit (Vitest, against `dist/`) | `pnpm test -- single-instance` | ❌ Wave 2 |
| **PKG-04b** | A contract-version mismatch throws, naming both versions and the fix | unit (Vitest) | same | ❌ Wave 2 |
| **PKG-04c** | Two workspace fixture adapters with core as a peer resolve to one physical copy | integration (install graph) | `pnpm test -- fixtures` | ❌ Wave 2 |
| **PKG-04d** | The package publishes ESM-only | artifact | covered by PKG-01b (`--profile esm-only` + `format: ["esm"]`) | ❌ Wave 1 |
| **PKG-05a** | The built artifact's bundle graph contains no `node_modules` module and no unbundled external import | artifact (module graph) | `pnpm run check:deps` | ❌ Wave 2 |
| **PKG-05b** | Every entry in `dependencies` resolves to a 0-byte ESM runtime entry | manifest + file size | same script, second assertion | ❌ Wave 2 |
| *(deferral)* | `MESSAGE_MAX_CHARS` is exported from `src/index.ts` as a **value** | type (TS1485) | `pnpm --filter … typecheck` | ❌ Wave 4 → `test-d/exports.test-d.ts` |
| *(deferral)* | `snapshotEquality` keeps function-property syntax (M9), with a **named** detector | type (TS2344) | same | ❌ Wave 4 |
| *(artifact)* | The shipped `dist/index.d.ts` export list is exactly 39 types + 4 values and excludes `serverChallengeBrand` / `ConsentAckBase` | unit (parse the artifact) | `pnpm test -- export-surface` | ❌ Wave 2 |
| *(artifact)* | Value exports survive into `dist/index.js` at their expected values | unit (Vitest, against `dist/`) | `pnpm test -- artifact` | ❌ Wave 2 |

---

## Suite Adequacy Requirement

**Every gate in this phase is a structural claim, and a structural claim is only proven by making it
fire.** Phase 1's ten-mutant battery let three of ten through on the first draft.

Each mutant below must be **observed failing** under a deliberate mutation, applied and restored
**inside a single `scripts/mutate-and-prove.sh` invocation**, with `git diff --exit-code` asserted
afterwards. This is not optional and not deferrable — Phase 1 had a near-miss where an interrupted
executor left a mutation applied and uncommitted, one unexamined merge away from shipping an erased
type parameter.

| # | Mutant | Gate that must fire | Measured signature |
|---|---|---|---|
| P1 | `exports["."].types` → nonexistent file | `pnpm build` | `ERROR [publint] … file does not exist` **and** `ERROR [attw]`, exit 1 |
| P2 | `files: []` omits `dist` | `publint --strict` on the packed tarball | 4 errors, exit 1 |
| P3 | `type: "commonjs"` with ESM output | both | publint 2 errors; attw exit 1 |
| P4 | a type error in `src/types.ts` | `pnpm typecheck` **fires**, `pnpm build` **does not** | typecheck non-zero, build 0 — *this pair is the whole of PKG-01d* |
| P5 | add a real runtime dependency and re-export it | `check:deps` | 2 vendored modules + 1 unbundled external, exit 1 |
| P6 | `assertSingleInstance` moved to module scope | `pnpm test -- single-instance` against `dist/` | the registry is absent from the bundle; F1 fails |
| P7 | `CONTRACT_VERSION` bumped in one of two loaded copies | F2 | throws, message matches `/two different copies/` and `/peerDependency/` |
| P8 | `MESSAGE_MAX_CHARS` moved into `index.ts`'s type-export block | `pnpm typecheck` | `TS1485` at the import line of `exports.test-d.ts` |
| P9 | `snapshotEquality` → method syntax | `pnpm typecheck` | `TS2344` naming `_policyNotBivariant` |
| P10 | a source feature newer than the floor (`Promise.try`) | `check:node-floor` | passes on v24.14.1, fails on v22.12.0 |
| P11 | `MESSAGE_MAX_CHARS` dropped from `index.ts`'s export list | `pnpm test -- export-surface` | 42 names instead of 43 |

**P4, P6 and P10 cannot be skipped.** Each proves a claim that is *only* structural, and each is
invisible to every other check in the suite.

---

## Wave 0 Requirements

This phase introduces the test runner, so the gaps are real and large. Nothing in the runtime-test
column exists today.

- [ ] `pnpm add -Dw vitest@4.1.10` — no test runner exists
- [ ] `pnpm add -Dw tsdown@0.22.14 publint@0.3.22 @arethetypeswrong/cli@0.18.5 @changesets/cli@2.31.1`
- [ ] `typescript` `^5.7.0` → `7.0.2` exact (verified non-breaking against both real tsconfigs)
- [ ] `packageManager: "pnpm@11.17.0"` — **separate commit** for lockfile churn
- [ ] `vitest.config.ts` (root) — `test.projects` with one `node` project, typecheck mode off
- [ ] `packages/concierge/tsdown.config.ts` — with `attw`/`publint` `level: "error"` gates
- [ ] `packages/concierge/package.json` — add `build` and `test` scripts
- [ ] `packages/concierge/LICENSE` — listed in `files`, absent from disk
- [ ] `packages/concierge/src/contract.ts` — `CONTRACT_VERSION` + `assertSingleInstance`
- [ ] `packages/concierge/test/single-instance.test.ts` — PKG-04a/b
- [ ] `packages/concierge/test/artifact.test.ts` — value exports + export-surface count
- [ ] `packages/concierge/test/fixtures/adapter-alpha|beta/` — PKG-04c
- [ ] `packages/concierge/test/fixtures/probe.ts` — the PKG-02 scratch probe
- [ ] `packages/concierge/test-d/exports.test-d.ts` — `MESSAGE_MAX_CHARS` guard (imports `../src/index.js`)
- [ ] `scripts/pkg05-zero-runtime-deps.mjs` — PKG-05
- [ ] `scripts/pack-install-check.sh` — PKG-02
- [ ] `scripts/node-floor-check.sh` — PKG-03
- [ ] `scripts/mutate-and-prove.sh` — the defect-first / mutation-hygiene harness
- [ ] `.changeset/config.json` — with an explicit empty `ignore: []`
- [ ] `.github/workflows/ci.yml` and `.github/workflows/release.yml` — **no `.github/` directory exists at all**
- [ ] `pnpm-workspace.yaml` — catalog pins for `svelte` / `@sveltejs/package`
- [ ] A written build-toolchain constraint (tsdown vs `svelte-package`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The OIDC release workflow publishes correctly | PKG-01 (release path) | **Nothing publishes until v0.1 completes**, so the workflow cannot be executed in this phase | Static review against: pnpm ≥ 11.1.3, npm ≥ 11.5.1, Node ≥ 22.14.0, `permissions: { id-token: write }`, no `NPM_TOKEN`, `fetch-depth: 0` |

**Recorded honestly rather than dressed up as automated.** One further trap: a guard asserting
`ReadbackAttestation` is unexported passes **vacuously** — the identifier has 0 occurrences in
`types.ts`. It must not be counted as a passing check.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (Vitest must run with `--run`)
- [ ] Feedback latency < 2s for the inner loop
- [ ] All 11 mutants observed failing, each restored in-call, `git diff --exit-code` clean after each
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
