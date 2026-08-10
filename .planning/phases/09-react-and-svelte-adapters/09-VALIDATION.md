---
phase: 09
slug: react-and-svelte-adapters
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-10
---

# Phase 09 — Validation Strategy

Phase 9 closes only from real framework lifecycles, published artifacts, an isolated three-tarball consumer, and immutable deliberate-defect evidence. Source-only imports, workspace symlinks, successful compilation without a behavioral assertion, and generic nonzero exits receive no credit.

## Test Infrastructure

| Property | Planned value |
|----------|---------------|
| **Core/runtime framework** | Vitest 4.1.10 against built ESM artifacts; existing Node project remains DOM-free |
| **React framework** | React/React DOM 19.2.8, Testing Library 16.3.2, jsdom 29.1.1, and a dedicated Vitest project |
| **Svelte framework** | Svelte 5.56.8, Testing Library 5.4.2, Svelte Vite plugin 7.2.0, `svelte-package` 2.5.8, and package-local TypeScript 6.0.3 |
| **Metaframework** | Astro 7.2.0 with official React 6.0.2 and Svelte 9.0.1 integrations; package-local TypeScript 6.0.3 |
| **Forward declaration consumer** | Isolated exact-tarball install using TypeScript 7.0.2 and `skipLibCheck: false` |
| **Quick run commands** | Package-scoped build/typecheck/test or one exact named case; each task supplies its concrete command |
| **Full suite commands** | `pnpm build`, `pnpm typecheck`, `pnpm test`, existing release gates, adapter artifact/package/SSR gates, and Phase 9 ledger verification |
| **Mutation runner** | `node scripts/phase-09-mutation-battery.mjs run all --jobs 4` from an immutable disposable snapshot |
| **Expected quick latency** | Under 30 seconds after dependencies are installed |

TypeScript 7 remains authoritative for core, React, and the foreign declaration consumer. Svelte/Astro checker processes use package-local TypeScript 6.0.3 because their current peer contracts exclude TypeScript 7; this boundary must not be hidden with forced or ignored peers.

## Sampling Rate

- **After every task:** Run the task's exact package-scoped typecheck/build/test or named detector.
- **After every plan:** Run root `pnpm build`, `pnpm typecheck`, and `pnpm test`, plus every completed package gate.
- **After package-boundary work:** Pack the affected package and run its artifact checks; workspace-only evidence is insufficient.
- **After mutation-runner work:** Preflight one exact mutant, then run the bounded full battery and terminal ledger verifier.
- **Before independent verification:** Run all existing release gates, adapter artifact gates, Astro SSR, the three-tarball consumer, source budget, the full mutation battery, and ledger verification from one immutable revision.
- **Maximum feedback latency:** 30 seconds for task-local code; heavyweight pack/install and mutation gates are plan-close checks.

## Security Threat Index

| Threat | Failure mode | Required detector |
|--------|--------------|-------------------|
| **T-09-01** | StrictMode or adversarial cleanup removes the live replacement, or unmount leaks a bridge | Real React `StrictMode` setup/cleanup/setup, retained stale cleanup, same-object registration, and final-null assertions |
| **T-09-02** | React getters close over render-local values and handlers observe stale application state | Rerender, await committed effects, then read/dispatch through core without any app-maintained ref |
| **T-09-03** | Svelte's reviewed consent snapshot remains a live proxy and drift is accepted | Packed real-`$state` consumer proves the getter moves, confirm returns `consent_stale`, and the consequential handler is not entered |
| **T-09-04** | Render or module evaluation registers on the server or leaks request-local state | React and compiled Svelte SSR plus two fresh Astro renders with absent browser globals and empty registries |
| **T-09-05** | A bundled/duplicate core or version-skewed adapter silently splits runtime state | Exact-tarball dependency graph, tar content, realpath convergence, reachable single-instance guard, and embedded-literal mismatch failure |
| **T-09-06** | Packaging strips React's client directive or bypasses Svelte's compiler/rune transform | Packed-entry inspection, server-safe root imports, `svelte-package` output checks, and real tarball reactivity |
| **T-09-07** | Adapter size accounting omits a file or adapter code grows core-like control flow | Explicit production-source enumeration, 150-line limit, forbidden-responsibility scan, and over-limit/unlisted-file negative control |
| **T-09-08** | A named negative or mutation ledger passes vacuously, against stale inputs, or without compiling the defect | Immutable register, exact source replacement, successful mutant build, assertion-observed fingerprint, restoration proof, and revision-bound release evidence |

## Provisional Per-Task Verification Map

The planner must reconcile task identifiers and commands without weakening these rows. Every implementation task needs an automated detector; no three consecutive tasks may defer their first meaningful assertion to a later plan.

| Task ID | Plan | Wave | Requirement | Threat | Secure behavior | Automated evidence | Exists |
|---------|------|------|-------------|--------|-----------------|--------------------|--------|
| 09-01-01 | 01 | 1 | ADP-01..04, PKG-04 | T-09-01..08 | RED contracts fail for missing adapters, package gates, budget, and deliberate defects | Exact named RED contract suite | ❌ Wave 0 |
| 09-01-02 | 01 | 1 | ADP-01..04 | T-09-06, T-09-07 | Package/test/toolchain skeleton preserves the TS7/TS6 boundary without declaring invalid peers | Workspace install, package-local typecheck, root baseline | ❌ Wave 0 |
| 09-02-01 | 02 | 2 | ADP-01 | T-09-01, T-09-02 | Provider carries exact Concierge; client effect registers and returns the exact unsubscriber | React context, StrictMode, rerender, cleanup, and SSR named cases | ❌ Wave 0 |
| 09-02-02 | 02 | 2 | ADP-01, PKG-04 | T-09-05, T-09-06 | Published React client entry retains its directive and guard; root remains server-safe | React build, type test, artifact inspection, publint, ATTW | ❌ Wave 0 |
| 09-03-01 | 03 | 2 | ADP-02 | T-09-03, T-09-04 | Native Svelte context/effect delegates registration and the exported normalizer calls `$state.snapshot` | Compiled Svelte lifecycle/context/SSR named cases | ❌ Wave 0 |
| 09-03-02 | 03 | 2 | ADP-02, PKG-04 | T-09-03, T-09-05, T-09-06 | `svelte-package` output retains the real rune path and valid declarations | Svelte package/check/build, artifact inspection, publint, ATTW | ❌ Wave 0 |
| 09-04-01 | 04 | 3 | ADP-04 | T-09-04 | One Astro app renders both real adapters against one shared catalog with fresh request-local objects | Astro check/build and repeated SSR probe | ❌ Wave 0 |
| 09-04-02 | 04 | 3 | ADP-04 | T-09-04, T-09-06 | Server imports touch no browser global and registries remain empty across renders | Exact built-entry SSR assertions | ❌ Wave 0 |
| 09-05-01 | 05 | 4 | ADP-02, ADP-04, PKG-04 | T-09-03, T-09-05, T-09-06 | Exact core/React/Svelte archives install outside workspace globs and resolve one physical core | Three-tarball graph, realpath, manifest, tar-content, TS7, and server-import probes | ❌ Wave 0 |
| 09-05-02 | 05 | 4 | ADP-02, PKG-04 | T-09-03, T-09-05 | Real packed `$state` consent drift closes; literal contract mismatch fails actionably | Foreign compiled Svelte consent probe and disposable mismatch probe | ❌ Wave 0 |
| 09-06-01 | 06 | 5 | ADP-03 | T-09-07 | Every authored production file is enumerated, each package is at most 150 lines, and forbidden core logic is absent | Source-budget gate plus unlisted-file/over-limit negative control | ❌ Wave 0 |
| 09-06-02 | 06 | 5 | ADP-01..04, PKG-04 | T-09-01..08 | All seven minimum deliberate defects compile, are killed by named assertions, and restore exactly | Phase 09 mutation battery and terminal ledger verifier | ❌ Wave 0 |
| 09-07-01 | 07 | 6 | ADP-01..04, PKG-04 | T-09-05..08 | CI/release invokes immutable adapter evidence without replacing Phase 8 or root gates | Workflow/static contract tests and release snapshot | ❌ Wave 0 |
| 09-07-02 | 07 | 6 | ADP-01..04 | T-09-08 | Docs use the one canonical API per framework and evidence closes every requirement/decision/threat | README tests, traceability audit, and ledger verification | ❌ Wave 0 |

## Requirement Coverage Contract

| Requirement | Required positive proof | Required negative/discriminating proof |
|-------------|-------------------------|---------------------------------------|
| **ADP-01** | Real React provider/consumer, effect registration, latest committed values, StrictMode survival, final cleanup, and SSR-null registry | **R1:** remove/replace exact cleanup; **R2:** close over initial value |
| **ADP-02** | Native Svelte context/effect and packed real-`$state.snapshot` consent drift with a moving live getter | **S1:** replace `$state.snapshot` with identity and prove stale consent or handler-entry failure |
| **ADP-03** | Explicit nonblank/non-comment authored production LOC count no greater than 150 for each adapter, plus forbidden-responsibility scan | **B1:** add or omit a production file/line so an independent control catches the budget bypass |
| **ADP-04** | Normal Astro build and repeated server render using both built adapters and one shared catalog; no browser globals or populated registry | **SSR1:** move registration into render/module evaluation and observe server contamination |
| **PKG-04 carry** | Three exact tarballs resolve one physical core; both user-reachable registration paths execute guards; mismatch says package, expected/found, and upgrade action | **P1:** bundle/move core into an adapter dependency; **C1:** remove or tautologize the embedded literal comparison |

## Deliberate-Defect Minimum Register

| ID | Protected invariant | Mutation shape | Assertion-observed kill marker |
|----|---------------------|----------------|--------------------------------|
| **R1** | Exact React cleanup and live replacement | Drop or substitute the returned registration unsubscriber | StrictMode/adversarial cleanup leaves wrong registry state |
| **R2** | React late reads latest committed value | Replace adapter-owned ref getter with initial render closure | Direct core read/dispatch observes the stale sentinel |
| **S1** | Svelte review snapshot is detached | Replace `$state.snapshot(value)` with identity | Packed consent probe fails `consent_stale` or enters handler |
| **SSR1** | Registration is client-lifecycle-only | Register from render/module evaluation | React/Svelte/Astro server registry becomes populated |
| **B1** | Budget enumerates every production source file | Omit or add an over-limit production file | Independent enumerator/count control disagrees and fails |
| **P1** | Both adapters share the consumer's core | Move core into dependency/bundle it | Manifest, graph, realpath, or tar-content assertion fails |
| **C1** | Contract mismatch cannot pass silently | Remove literal guard or compare imported value to itself | Disposable incompatible adapter stops producing the required package-named error |

Each register row must identify one exact source literal, compile successfully after replacement, run a nonempty named detector set, record the assertion fingerprint that killed it, and prove the disposable tree returned to its original digest. A generic build failure, missing dependency, or unmatched replacement is infrastructure failure, not a killed mutant.

## Wave 0 Requirements

- [ ] React package, dedicated DOM test project, context/lifecycle suite, type tests, and packed-artifact suite.
- [ ] Svelte package, package-local TypeScript 6 toolchain, real component fixture, lifecycle/SSR suite, type tests, and packed-artifact suite.
- [ ] Minimal Astro example with one shared catalog and a repeated-render SSR probe.
- [ ] Exact three-tarball package/consumer gate, including TypeScript 7 declarations, realpaths, real `$state`, and version mismatch.
- [ ] Source-budget/forbidden-responsibility gate with an independent negative control.
- [ ] Phase 09 immutable mutation register, battery, evidence, release evidence, and terminal ledger verification.
- [ ] CI/release and documentation contract detectors that preserve all existing core and Phase 8 gates.

## Manual-Only Verifications

All phase behaviors are automated. The example is a deterministic SSR harness, not a designed interface; Phase 9 intentionally has no visual or manual QA gate.

## Validation Sign-Off

- [x] Every provisional implementation task has an automated verification target or explicit Wave 0 dependency.
- [x] Sampling continuity forbids three consecutive tasks without automated evidence.
- [x] Wave 0 enumerates every currently missing harness and artifact proof.
- [x] No watch-mode, source-only, workspace-link-only, generic-nonzero, or human-only proof receives credit.
- [x] Requirement, decision, threat, mutation, and release evidence are revision-bound by design.
- [ ] Planner has reconciled exact task identifiers and commands without coverage loss.
- [ ] Wave 0 files exist and every named detector is green.
- [ ] Final immutable release snapshot and all seven minimum deliberate defects are green.

**Approval:** pending implementation and independent verification
