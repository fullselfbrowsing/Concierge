---
phase: 09
slug: react-and-svelte-adapters
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-10
---

# Phase 09 — Validation Strategy

Phase 9 closes only from real framework lifecycles, built package entrypoints, an isolated exact-three-tarball consumer, and revision-bound deliberate-defect evidence. Source-only imports, workspace symlinks, compilation without a behavioral assertion, and generic nonzero exits receive no credit.

## Test Infrastructure

| Property | Planned value |
|----------|---------------|
| **Core/runtime project** | Vitest 4.1.10 project `node`, environment `node`, include only `packages/concierge/test/**/*.test.ts`; no DOM plugins or adapter tests |
| **Artifact/SSR project** | Vitest project `node-artifact-ssr`, environment `node`, include exactly both adapter artifact tests and the Astro SSR test |
| **React lifecycle project** | Vitest project `react-lifecycle`, jsdom, React plugin, include exactly `packages/concierge-react/test/lifecycle.test.tsx` |
| **Svelte lifecycle project** | Vitest project `svelte-lifecycle`, jsdom, Svelte plugin, include exactly `packages/concierge-svelte/test/lifecycle.test.ts` |
| **React toolchain** | React/React DOM 19.2.8, Testing Library 16.3.2, jsdom 29.1.1, tsdown 0.22.14, and TypeScript 7.0.2 |
| **Svelte toolchain** | Svelte 5.56.8, Testing Library 5.4.2, Svelte Vite plugin 7.2.0, `svelte-package` 2.5.8, and package-local TypeScript 6.0.3 |
| **Metaframework** | `examples/adapter-ssr` on Astro 7.2.0 with official React 6.0.2 and Svelte 9.0.1 integrations and package-local TypeScript 6.0.3 |
| **Forward-declaration consumer** | Isolated exact-tarball install using TypeScript 7.0.2 and `skipLibCheck: false` |
| **Mutation runner** | `node scripts/phase-09-mutation-battery.mjs run all --jobs 4` from an immutable disposable snapshot |

Every Vitest command uses the owning named project and the exact test file. JSON-report checks require `success === true`, positive `numTotalTestSuites`, positive `numTotalTests`, and a nonempty `testResults` array. TypeScript 7 is authoritative for core, React, and the foreign declaration consumer. Svelte and Astro checker processes use package-local TypeScript 6.0.3 because their current peer contracts exclude TypeScript 7; no forced or ignored peer hides that boundary.

## Sampling and Latency

- **Task-local:** Run only the exact named test, package-local typecheck/build, checker mode, or static assertion declared in the task. These checks target a sub-30-second feedback loop after installation.
- **Plan close:** Run the completed package's build/typecheck/test and artifact gate. Full install, tarball, or repeated SSR work runs only where that plan's deliverable requires it.
- **Terminal:** Only Plan 09-13 runs the full immutable mutation battery, all inherited release gates, all package/archive gates, and atomic evidence generation.
- **Continuity:** Every one of the 26 implementation tasks has an automated detector; no three-task run defers its first meaningful assertion.

## Canonical Threat Index

| Threat | Canonical meaning | Required detector |
|--------|-------------------|-------------------|
| **T-09-01** | StrictMode or adversarial cleanup removes a live replacement, or unmount leaks a bridge | Real React setup/cleanup/setup, retained stale cleanup, same-object registration, and final-null assertions |
| **T-09-02** | React getters close over render-local values and expose stale application state | Rerender, await committed effects, then read and dispatch through core without an app-maintained ref |
| **T-09-03** | Svelte's reviewed consent snapshot remains live and drift is accepted | Packed real-`$state` consumer proves the getter moved, confirm returns exactly `consent_stale`, and handler-entry count remains zero |
| **T-09-04** | Render or module evaluation registers on the server or leaks request-local state | React and compiled Svelte SSR plus two fresh-process normal Astro builds/renders with absent browser globals and empty registries |
| **T-09-05** | Bundled/duplicate core or contract skew silently splits runtime state | Exact-tarball graph, tar contents, realpath convergence, both public guard paths, and embedded-literal mismatch failure |
| **T-09-06** | Packaging strips React's client directive or bypasses Svelte's compiler/rune transform | Packed-entry inspection, server-safe root imports, `svelte-package` output, real packed rune reactivity, publint, and ATTW |
| **T-09-07** | Size accounting omits a production file or adapter source gains core-like control flow | Exact production inventory, nonblank/non-comment 150-line limit, TypeScript-AST responsibility scan, and independent controls |
| **T-09-08** | A RED, negative, or mutation ledger passes vacuously, against stale inputs, or without compiling the defect | Exact baseline sets, positive test/file counts, immutable register, compilation-before-kill, assertion fingerprint, restoration, and revision-bound evidence |

## Exact RED State Contract

The initial persisted RED baseline contains exactly these eleven failures:

1. `C09-01-VITEST-ROUTING`
2. `C09-02-REACT-SKELETON`
3. `C09-03-REACT-RUNTIME`
4. `C09-04-REACT-ARTIFACT`
5. `C09-05-SVELTE-SKELETON`
6. `C09-06-SVELTE-RUNTIME`
7. `C09-07-SVELTE-ARTIFACT`
8. `C09-08-ASTRO-SSR`
9. `C09-09-EXACT-TARBALL`
10. `C09-10-ADAPTER-BUDGET`
11. `C09-11-MUTATION-CLOSURE`

After both adapter skeletons and Vitest routing exist, `post-skeleton` must report exactly eight failures: `C09-03-REACT-RUNTIME`, `C09-04-REACT-ARTIFACT`, `C09-06-SVELTE-RUNTIME`, `C09-07-SVELTE-ARTIFACT`, `C09-08-ASTRO-SSR`, `C09-09-EXACT-TARBALL`, `C09-10-ADAPTER-BUDGET`, and `C09-11-MUTATION-CLOSURE`. The contract checker exposes only `baseline-record`, `baseline-verify`, `post-skeleton`, `final`, and `self-test`.

## Per-Task Verification Map

| Task ID | Wave | Requirement | Threat | Automated evidence |
|---------|------|-------------|--------|--------------------|
| 09-01-01 | 1 | Phase infrastructure | T-09-08 | Contract-check `baseline-record`, `baseline-verify`, and `self-test`; exact eleven-ID JSON |
| 09-01-02 | 1 | Phase infrastructure | T-09-04, T-09-06, T-09-08 | Positive-count core test plus static four-project routing assertion |
| 09-02-01 | 2 | ADP-01, PKG-04 | T-09-05, T-09-06 | React manifest, exports, exact peer/dev-link, callback banner, and license assertions |
| 09-02-02 | 2 | ADP-01, PKG-04 | T-09-05, T-09-08 | Baseline preservation and React lock-importer assertion |
| 09-03-01 | 3 | ADP-02, PKG-04 | T-09-03, T-09-05, T-09-06 | Svelte manifest, local TS6, `svelte-package`, rune-aware config, and license assertions |
| 09-03-02 | 3 | ADP-02, PKG-04 | T-09-06, T-09-08 | Baseline preservation, exact eight-ID `post-skeleton`, and Svelte lock assertion |
| 09-04-01 | 4 | ADP-01 | T-09-01, T-09-02, T-09-05 | Positive-count React lifecycle/StrictMode suite and package typecheck |
| 09-04-02 | 4 | ADP-01, PKG-04 | T-09-04, T-09-05, T-09-06 | React build/typecheck and positive-count artifact/SSR/type-contract suite |
| 09-05-01 | 4 | ADP-02 | T-09-03, T-09-04, T-09-05 | Svelte typecheck and positive-count native context/effect lifecycle suite |
| 09-05-02 | 4 | ADP-02, PKG-04 | T-09-04, T-09-06 | Svelte build/typecheck and positive-count artifact/server-import suite |
| 09-06-01 | 5 | ADP-04 | T-09-04, T-09-06 | Static private Astro manifest, integrations, TS6, and output-directory assertions |
| 09-06-02 | 5 | ADP-04 | T-09-06, T-09-08 | Exact Astro CLI version and lock-importer assertions; no source/build work |
| 09-07-01 | 6 | ADP-04 | T-09-04 | Astro check/build and static shared-catalog, deterministic-content, and no-UI-scope assertions |
| 09-07-02 | 6 | ADP-04 | T-09-04, T-09-08 | Positive-count exact SSR test plus normal check/build repeated in two fresh processes |
| 09-08-01 | 7 | PKG-04 | T-09-04, T-09-05, T-09-06, T-09-08 | Package-check syntax/self-test/artifacts modes over the same three archives |
| 09-08-02 | 7 | ADP-02, PKG-04 | T-09-03, T-09-05 | Packed real-rune `svelte-consent` and literal-only `mismatch` modes |
| 09-09-01 | 5 | ADP-03 | T-09-07 | Budget `check` plus script syntax validation against exact production inventories |
| 09-09-02 | 5 | ADP-03 | T-09-07, T-09-08 | Budget `self-test` and `check`, including all five loop statements and responsibility controls |
| 09-10-01 | 8 | ADP-01, ADP-02 | T-09-03, T-09-05, T-09-06 | Static canonical package README API/security assertions |
| 09-10-02 | 8 | ADP-01, ADP-02, ADP-03, ADP-04, PKG-04 | T-09-08 | Root README and immutable Phase 8/Phase 9 release-command assertions |
| 09-11-01 | 9 | ADP-01, ADP-02, ADP-03, ADP-04, PKG-04 | T-09-04, T-09-08 | Positive-count five-file phase test checker and exact root script assertions |
| 09-11-02 | 9 | ADP-01, ADP-02, ADP-03, ADP-04, PKG-04 | T-09-05, T-09-06, T-09-08 | Workflow checker and blocking CI/release ordering assertions |
| 09-12-01 | 8 | ADP-01, ADP-02, ADP-03, ADP-04, PKG-04 | T-09-01, T-09-02, T-09-03, T-09-04, T-09-05, T-09-07 | Exact seven-row mutation register, unique literals, compile commands, killers, and fingerprints |
| 09-12-02 | 8 | ADP-01, ADP-02, ADP-03, ADP-04, PKG-04 | T-09-08 | Mutation-runner syntax, `self-test`, one R1 preflight, and proof that no terminal evidence is emitted early |
| 09-13-01 | 10 | ADP-01, ADP-02, ADP-03, ADP-04, PKG-04 | T-09-01..T-09-08 | Full immutable `run all --jobs 4` then `verify all`; atomic terminal evidence generation |
| 09-13-02 | 10 | ADP-01, ADP-02, ADP-03, ADP-04, PKG-04 | T-09-08 | Read-only evidence/release/all verification, final contract/workflow checks, and disposable drift rejection |

All rows are Wave 0 until their named files are implemented. The map is complete: 13 plans × 2 tasks = 26 task-local automated verification points.

## Requirement Coverage Contract

| Requirement | Required positive proof | Required negative/discriminating proof |
|-------------|-------------------------|---------------------------------------|
| **ADP-01** | Real React provider/consumer, effect registration, latest committed values, StrictMode survival, final cleanup, and SSR-null registry | **R1:** remove or replace exact cleanup; **R2:** close over the initial value |
| **ADP-02** | Native Svelte context/effect and packed real-`$state.snapshot` consent drift with a moving live getter | **S1:** replace `$state.snapshot` with identity and prove the stale-consent or handler-entry assertion fails |
| **ADP-03** | Exact authored production inventory and nonblank/non-comment total no greater than 150 lines for each adapter, plus AST responsibility scan | **B1:** make the independent inventory/count control expose an omitted or over-limit production file |
| **ADP-04** | Normal Astro build and repeated fresh-process server render using both built adapters and one shared immutable catalog | **SSR1:** move registration into render/module evaluation and observe server contamination |
| **PKG-04 carry** | Three exact tarballs resolve one physical core; both public registration paths execute guards; mismatch names package, expected/found versions, and upgrade action | **P1:** bundle or move core into an adapter runtime dependency; **C1:** remove or tautologize the embedded literal comparison |

ADP-03 is owned by the exact 150-line budget and B1 control in Plans 09-09, 09-12, and 09-13. ADP-04 is owned by the normal Astro configuration/build/repeated-SSR path and SSR1 control in Plans 09-06, 09-07, 09-12, and 09-13. D-09-15 maps to the fresh-process built-entry SSR proof; D-09-16 maps to the isolated exact-three-tarball install, inspection, publint, ATTW, declaration, runtime, reactivity, and mismatch proof.

## Deliberate-Defect Minimum Register

| ID | Protected invariant | Mutation shape | Canonical threat | Assertion-observed kill marker |
|----|---------------------|----------------|------------------|--------------------------------|
| **R1** | Exact React cleanup and live replacement | Drop or substitute the returned registration unsubscriber | T-09-01 | StrictMode/adversarial cleanup leaves the wrong registry state |
| **R2** | React late reads use the latest committed value | Replace the adapter-owned ref getter with an initial-render closure | T-09-02 | Direct core read/dispatch observes the stale sentinel |
| **S1** | Svelte review snapshot is detached | Replace `$state.snapshot(value)` with identity | T-09-03 | Packed confirm no longer returns exact `consent_stale` or handler-entry count changes from zero |
| **SSR1** | Registration is client-lifecycle-only | Register from render/module evaluation | T-09-04 | React/Svelte/Astro server registry becomes populated |
| **B1** | Budget enumerates every production source file and rejects core-like control flow | Omit or add an over-limit/loop-bearing production file | T-09-07 | Independent inventory/count/AST control disagrees and fails |
| **P1** | Both adapters share the consumer's core | Move core into a runtime dependency or bundle it | T-09-05 | Manifest, graph, realpath, or tar-content assertion fails |
| **C1** | Contract mismatch cannot pass silently | Remove the literal guard or compare the imported value to itself | T-09-05 | Disposable incompatible adapter stops producing the required package-named error |

Every register row identifies one exact source literal occurring once, compiles successfully after replacement, runs a nonempty named detector set, records the assertion fingerprint that killed it, and proves the disposable tree returned to its original digest. An unmatched replacement, failed mutant build, missing dependency, or generic nonzero result is infrastructure failure rather than a kill.

## Decision Traceability

| Decisions | Planned enforcement |
|-----------|---------------------|
| D-09-01..D-09-04 | Exact injected core/registry, lifecycle-only registration, every public-path guard, peer-only core topology |
| D-09-05..D-09-08 | One canonical React surface, adapter-owned latest-value ref, StrictMode/adversarial cleanup, client directive only on client entry |
| D-09-09..D-09-12 | Native Svelte context/effect, real rune snapshot normalizer, `svelte-package`, packed completed-delivery consent drift |
| D-09-13 | Exact production inventory, independent nonblank/non-comment 150-line totals, all five loop-statement kinds, forbidden responsibilities |
| D-09-14..D-09-16 | One minimal dual-framework Astro harness, fresh-process built-entry SSR, isolated exact-three-tarball package proof |
| D-09-17 | Existing root and Phase 8 gates retained; seven deliberate defects and revision-bound Phase 9 closure |

## Wave 0 Requirements

- [ ] Exact RED contract checker and persisted eleven-ID baseline.
- [ ] Four non-overlapping Vitest projects with positive-suite/test/file-count enforcement.
- [ ] React and Svelte package skeletons, framework lifecycle suites, type contracts, builds, and artifact suites.
- [ ] Astro config/dependency/lock step before its source, normal build, and repeated fresh-process SSR probe.
- [ ] One exact-three-tarball package/consumer gate with tar inspection, publint, ATTW, TypeScript 7, SSR, real `$state`, and mismatch modes.
- [ ] Source-budget/forbidden-responsibility gate with independent inventory, count, and all-five-loop controls.
- [ ] Immutable mutation register and runner with no early terminal evidence generation.
- [ ] CI/release and documentation contract detectors that preserve root and actual Phase 8 gates.
- [ ] Terminal evidence generated atomically only after all source, docs, config, workflow, package, and mutation inputs are final.

## Manual-Only Verifications

All phase behaviors are automated. The Astro example is a deterministic SSR harness, not a designed interface; Phase 9 intentionally has no visual or manual QA gate.

## Validation Sign-Off

- [x] All 26 planned tasks have exact automated verification targets.
- [x] Requirement, decision, threat, mutation, and terminal-evidence coverage is mapped without semantic ID drift.
- [x] Task-local feedback is separated from heavyweight plan-close and terminal gates.
- [x] Wave 0 enumerates every currently missing harness and artifact proof.
- [x] No watch mode, source-only proof, workspace-link-only proof, generic-nonzero proof, or human-only proof receives credit.
- [ ] Wave 0 files exist and every named detector is green.
- [ ] Final immutable release snapshot and all seven minimum deliberate defects are green.

**Approval:** pending implementation and independent verification
