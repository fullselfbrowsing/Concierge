---
phase: 02-packaging-build-and-release
verified: 2026-07-29T15:13:55Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
verified_at_commit: b8eced6
human_verification:
  - test: "Push to GitHub and observe the first real run of `.github/workflows/ci.yml` — both jobs, `build` and `node-floor`."
    expected: "All six action references resolve (actions/checkout@v5, pnpm/action-setup@v4, actions/setup-node@v5, actions/upload-artifact@v4, actions/download-artifact@v4); the `Assert pnpm is 11.x` step prints an 11.x version; the node-floor job's `process.version` assertion prints v22.12.0; check:pack and check:node-floor behave on ubuntu-latest as they do on darwin/arm64."
    why_human: "The workflow has never executed. Action-version resolution is 02-RESEARCH assumption A3, not a measurement, and ci.yml:16-19 says so in its own header. No GitHub Actions run exists (gh returned no runs). Every gate in this phase was verified on darwin/arm64 only."
  - test: "At the first real publish, follow RELEASING.md and inspect the npm package page for a provenance attestation."
    expected: "`@fullselfbrowsing/concierge` is published over OIDC trusted publishing and the npm page shows a provenance attestation. A publish that succeeds WITHOUT an attestation is a FAILED publish."
    why_human: "release.yml:3 states 'THIS WORKFLOW HAS NEVER BEEN EXECUTED' and its verification to date is static review only. The failure mode is invisible from the exit code: if token auth ever wins over OIDC, the publish succeeds green and silently drops the attestation (threats T-02-46, T-02-47). External-service integration that cannot be exercised without publishing."
  - test: "Confirm that the phase goal's 'published' clause is accepted as covered by tarball-level evidence for now."
    expected: "Stakeholder agrees that publint/attw on the packed artifact + a foreign-project install + a floor-runtime install is sufficient evidence of 'publishable' at v0.1, with the actual publish deferred to milestone close."
    why_human: "The goal says 'built, published, and installed'. Built and installed are measured. Published is proven only up to the tarball; no artifact has left the machine."
warnings:
  - id: W1
    item: "Three stale M9 prose claims (carry-forward item C)"
    measured: "packages/concierge/test-d/actions.test-d.ts:147 still reads \"mutant M9's **sole detector**\"; :153-155 still reads \"a lone TS2578 is then the *only* symptom\"; packages/concierge/src/types.ts:505-506 still reads \"Its only symptom is one unused suppression directive\". All three are false: mutant P9 run at verification produced TWO diagnostics — TS2344 at consent-variance.test-d.ts(76,35) and TS2578 at actions.test-d.ts(162,3)."
    impact: "src/types.ts ships inside dist/index.d.ts (77 kB), so a consumer reads the false claim. Documentation accuracy only — the guard itself works."
    owner_recorded: "02-12-SUMMARY.md:512-523 — 'a Phase 3+ plan that legitimately opens both files'. No later ROADMAP phase names it in a goal or success criterion."
  - id: W2
    item: "Three Object.freeze initializers lack /* @__PURE__ */ (carry-forward item E)"
    measured: "grep found 3 Object.freeze calls in src/types.ts (lines 243, 265, 467) and 0 @__PURE__ annotations anywhere in src/. Bundling dist/index.js with rolldown 1.2.0 at verification time: 3 Object.freeze occurrences retained in the calling consumer bundle (3,933 B) AND 3 retained in the uncalled bundle (852 B, 293 B non-comment)."
    impact: "Dead bytes in every consumer bundle. Does NOT falsify SC-5, which is scoped to core's DEPENDENCY footprint (@standard-schema/spec, measured 0 bytes) — the probe's own header at scripts/pkg05-zero-runtime-deps.mjs:8-33 explicitly rejects the 'core itself ships zero bytes' reading."
    owner_recorded: "02-12-SUMMARY.md:525-532 — same Phase 3+ plan as W1. No ROADMAP anchor."
  - id: W3
    item: "scripts/mutate-and-prove.sh reports 'tree clean' while the repo is dirty (carry-forward item D)"
    measured: "REPRODUCED at verification. Running P5b (inject typescript@7.0.2 into packages/concierge/package.json dependencies, gate `pnpm run check:deps`) printed `PASS: gate fired (exit 1), tree clean` while `git status --porcelain` immediately after showed ` M pnpm-lock.yaml`. The documented preventive remedy `pnpm --config.verify-deps-before-run=false run check:deps` was re-run and left the tree clean."
    impact: "The harness's PASS line is not a trustworthy tree-clean assertion for manifest-mutating mutants. Verification compensated by asserting `git status --porcelain` independently after every mutant it ran."
    owner_recorded: "02-12-SUMMARY.md:534-562 — 'a Phase 3+ plan that opens scripts/, or a hardening plan'. No ROADMAP anchor. 02-08's detective half (capture porcelain before, compare after) is recorded as 'not implemented'."
  - id: W4
    item: "scripts/node-floor-check.sh downloads and executes a Node runtime with no checksum verification (T-02-44, carry-forward item F)"
    measured: "CONFIRMED. grep for shasum|sha256|checksum|SHASUMS|gpg|verify in scripts/node-floor-check.sh returns nothing; the script streams `curl -sfL https://nodejs.org/dist/... | tar -xJ` (lines 47-48), so the tarball is never on disk to be checked. 02-10's measurement that it is invoked by nothing under .github/ STILL HOLDS: all four grep matches in .github/ (ci.yml:98, 149, 150, 158) are comment lines."
    impact: "Not a CI-time exposure. Local/phase-gate only. Dispositioned 'accept for v0.1'."
    owner_recorded: "02-12-SUMMARY.md:564-578 — 'a post-v0.1 hardening plan'. ci.yml:162-166 carries a standalone comment naming the gap."
  - id: W5
    item: "assertSingleInstance has no production call site — NEW finding, not in any carry-forward list"
    measured: "Every invocation of assertSingleInstance() in the repository is a test, a harness, or a fixture: single-instance.test.ts:117,118,130,164,165; artifact.test.ts:78; scripts/node-floor-check.sh:137; .github/workflows/ci.yml:171. The fixture adapters only RE-EXPORT it (adapter-alpha/index.js:2, adapter-beta/index.js:2). No library code path calls it. src/contract.ts:140-143 states this explicitly: 'There is no call site in this phase — createConcierge does not exist yet.'"
    impact: "SC-4's 'a version mismatch fails loudly' is armed but not live. In a real app a duplicate-copy mismatch fails loudly only once something calls the guard. PKG-04's literal requirement text ('a test asserts a single core instance is shared across adapters') IS satisfied, and createConcierge cannot exist yet by roadmap design — so this is carry-forward, not incompleteness."
    risk: "No test in this repository asserts that a call site exists, because there is nothing to call it from. If Phases 3-9 forget to wire createConcierge and the adapter registration hooks to assertSingleInstance(), nothing here will notice. Checked: neither Phase 3's nor Phase 9's ROADMAP success criteria mention it."
---

# Phase 2: Packaging, build, and release — Verification Report

**Phase Goal:** The package that will carry the kernel can be built, published, and installed correctly — settled at one package, because the cost of settling it later scales with package count.
**Verified:** 2026-07-29T15:13:55Z at commit `b8eced6`
**Status:** human_needed (5/5 must-haves verified; two never-executed workflows carry the "published" half of the goal)
**Re-verification:** No — initial verification

Every result below was **measured by the verifier in its own process**. No SUMMARY.md claim was accepted as evidence. Where a phase document's number disagreed with the tree, the tree is reported.

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence (measured at verification) |
|---|-------|--------|-------------------------------------|
| 1 | A scratch project outside the repo installs the packed tarball, imports `@fullselfbrowsing/concierge`, and typechecks against its shipped declarations. (PKG-02) | ✓ VERIFIED | `pnpm run check:pack` exit **0**. Tarball **87,915 B** packed to `/var/folders/.../tmp.fLcM2Z5m0M` (outside the repo). `npm install` (not pnpm) of the tarball + `typescript@7.0.2`; `npm ls --depth=0` shows only `@fullselfbrowsing/concierge@0.0.0` and `typescript@7.0.2`. The scratch project's OWN `./node_modules/.bin/tsc` typechecked `probe.ts` with `"skipLibCheck": false` and `"module": "node20"`. Runtime import asserted `MESSAGE_MAX_CHARS === 180`. **Re-run identically inside a fresh `git clone` of HEAD — exit 0.** |
| 2 | `publint` and `are-the-types-wrong` report no errors on the packed artifact, and a typecheck failure cannot pass the build because the bundler does not typecheck. (PKG-01) | ✓ VERIFIED | `pnpm run check:artifact` exit **0** — publint `--strict` on the packed tarball: "All good!"; `attw --pack packages/concierge --profile esm-only`: `node16 (from ESM)` 🟢, `bundler` 🟢, both ignored resolutions annotated. **Second half measured directly under mutant P4**: with `MESSAGE_MAX_CHARS: string = 180` injected, `pnpm build` exited **0** with `✔ [attw]` and `✔ [publint]` both clean, while `pnpm typecheck` exited **1** with `src/types.ts(279,14): error TS2322`. The compensating wiring is present: `ci.yml:75` runs `pnpm typecheck` as its own required step *before* `ci.yml:79`'s `pnpm build`; `release.yml:83` chains `pnpm typecheck && pnpm build && pnpm test`. |
| 3 | The artifact imports successfully on the exact Node version the package declares as its floor, not merely on the developer's newer runtime. (PKG-03) | ✓ VERIFIED | `pnpm run check:node-floor` exit **0**. Developer runtime printed **v24.14.1**; floor runtime **v22.12.0** — genuinely different, not a no-op. The script asserts `process.version !== 'v22.12.0'` throws (line 128) *after* switching PATH, so the pin is a checked claim. Installed with `npm` only (pnpm@11.17.0 cannot start on 22.12.0), imported the artifact, ran `assertSingleInstance()`, asserted `MESSAGE_MAX_CHARS === 180`. `engines.node` is `>=22.12.0` in both manifests. |
| 4 | Two adapters resolving core independently share one core instance, and a version mismatch fails loudly with an actionable message rather than silently splitting the bridge registry, the dedup window, and the consent kernel. (PKG-04) | ✓ VERIFIED | `pnpm test` — **4 files / 15 tests passed**. F1a: two module evaluations (`?dup=1`) produce distinct namespaces and distinct function objects, then converge on ONE registry record. F3b: `realpathSync` three-way equality — both fixture `node_modules/@fullselfbrowsing/concierge` links and the package itself resolve to one physical directory (measured: both are symlinks to `../../../../..`). F3c: `alpha.assertSingleInstance === beta.assertSingleInstance`. F2: mismatch throws matching both `/two different copies/` and `/peerDependency/`. ESM-only confirmed: `format: ["esm"]`, no `dist/index.cjs`, no `require` condition in `exports`, attw esm-only clean. **Non-vacuity proven by verifier-run mutants** — see the mutation table below. |
| 5 | Core's installed dependency footprint is verified to add zero runtime bytes to a consumer bundle. (PKG-05) | ✓ VERIFIED | `pnpm run check:deps` exit **0**. Assertion A (module graph of `dist/index.js` bundled with rolldown): 1 chunk, **1 module**, `vendored modules: []`, `unbundled external imports: []`. Assertion B: `@standard-schema/spec` resolved via `exports["."]` → `dist/index.js` at **0 bytes**, with its 754-byte `require` sibling annotated as unreachable through an ESM-only core. **Non-vacuity proven by verifier-run mutant P5b.** |

**Score: 5/5 truths verified.**

---

### Required Artifacts

All levels measured: exists → substantive → wired → data flows.

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` (root) | TS 7.0.2 exact, pnpm 11.17.0, six dev tools, the five `check:*` scripts | ✓ VERIFIED | `"typescript": "7.0.2"`, `"packageManager": "pnpm@11.17.0"`, `rolldown 1.2.0`, `tsdown 0.22.14`, `vitest 4.1.10`, `@arethetypeswrong/cli 0.18.5`, `publint 0.3.22`, `@changesets/cli 2.31.1`. All five `check:*` scripts present and all five executed exit 0. |
| `packages/concierge/package.json` | ESM-only manifest whose declaration maps resolve | ✓ VERIFIED | `type: module`, `sideEffects: false`, no `require` condition, `files: [dist, src, README.md, LICENSE]`. Verified `dist/index.d.ts.map` `sources: ['../src/types.ts','../src/contract.ts']` both resolve to files shipped under `files[]`. |
| `packages/concierge/tsdown.config.ts` | ESM-only + dts, publint/attw as build-FAILING gates | ✓ VERIFIED | `format: ["esm"]`, `platform: "neutral"`, `publint: { level: "error" }`, `attw: { level: "error", profile: "esm-only" }`. `level: "error"` is present on both — the research finding that bare `attw: true` exits 0 is correctly applied. |
| `packages/concierge/src/contract.ts` | `CONTRACT_VERSION` + `assertSingleInstance`, registry read INSIDE the function body | ✓ VERIFIED (see W5) | 166 lines. `Symbol.for("@fullselfbrowsing/concierge.contract")` read at line 147, inside `assertSingleInstance`'s body. No module-scope registration. No top-level `await`. Zero imports. |
| `packages/concierge/src/index.ts` | Barrel re-exporting the two contract values | ✓ VERIFIED | Line 75: `export { CONTRACT_VERSION, assertSingleInstance } from "./contract.js";`. Surface measured from source: 39 type names + 6 value names. |
| `packages/concierge/dist/index.d.ts` | Published surface of exactly 45 names | ✓ VERIFIED | Verifier parsed the built file independently: **1 export block, 45 names, 39 type-prefixed, 6 plain** (`CONSENT_GRADE_ORDER, CONTRACT_VERSION, MESSAGE_MAX_CHARS, USER_CANCELLED, USER_DECLINED, assertSingleInstance`). Matches `export-surface.test.ts`'s assertions and 02-VALIDATION.md's reconciled figure. |
| `scripts/mutate-and-prove.sh` | Apply / gate / restore / prove, in one invocation | ⚠️ VERIFIED with defect (W3) | 135 lines. `trap 'git checkout -- "$TARGET"' EXIT INT TERM` at line 89 installed BEFORE the mutation. Pattern travels via `MUT_PATTERN` env var into `perl -0pi` — verified handles slashes (P8's pattern contains `./types.js`). Five-code exit table honoured. **Defect: its "tree clean" claim covers only `$TARGET`** — see W3. |
| `scripts/pkg05-zero-runtime-deps.mjs` | Module-graph probe + manifest byte assertion | ✓ VERIFIED | 299 lines, real rolldown bundle, both assertions always run so one failure cannot hide the other. Resolves through the ESM condition set, not `require.resolve` — the header records the 754 vs 0 byte measurement that makes this necessary. |
| `scripts/pack-install-check.sh` | PKG-02 harness | ✓ VERIFIED | 134 lines. `mktemp -d` outside the repo; `skipLibCheck: false`; scratch-local `tsc`; `npm` not `pnpm add`. Executed, exit 0, twice (working tree + fresh clone). |
| `scripts/node-floor-check.sh` | PKG-03 harness | ⚠️ VERIFIED with accepted risk (W4) | 145 lines. Exact-triple download, cache-staleness assertion, `process.version` assertion after PATH switch, npm-only below the switch. Executed, exit 0. No checksum verification. |
| `vitest.config.ts` | One shared node project, typecheck mode off | ✓ VERIFIED | `projects: [{ test: { name: "node", environment: "node", include: ["packages/*/test/**/*.test.ts"] } }]`. Typecheck mode deliberately absent, with the TS-file-collision reason documented. |
| `packages/concierge/test/*.test.ts` (4 files) | Real assertions against `dist/`, never `src/` | ✓ VERIFIED | 15 tests. Every assertion imports `../dist/index.js` or `../dist/index.d.ts`; the only `../src/` mentions are inside comments. All four proven non-vacuous by verifier-run mutants. |
| `packages/concierge/test/fixtures/adapter-{alpha,beta}` | Private workspace peers | ✓ VERIFIED | Both `private: true`, both declare core under `peerDependencies` (`workspace:^`) and NOT under `dependencies`. Both `node_modules/@fullselfbrowsing/concierge` links exist on disk. |
| `.github/workflows/ci.yml` | typecheck→build→test→checks→pack, plus a pinned floor job | ⚠️ EXISTS, NEVER EXECUTED | 176 lines. Order verified correct. `node-version: '22.12.0'` quoted and exact, with a `process.version` assertion. See human verification item 1. |
| `.github/workflows/release.yml` | changesets + OIDC | ⚠️ EXISTS, NEVER EXECUTED | 110 lines. `id-token: write` present; `fetch-depth: 0` present; **`NPM_TOKEN` appears only in comment lines** (verified: 0 non-comment matches under `.github/`); no `--provenance`. See human verification item 2. |
| `.changeset/config.json` | Strict JSON, explicit empty ignore | ✓ VERIFIED | Parses. `"ignore": []`, `"privatePackages": false`, `"access": "public"`, `"baseBranch": "main"`. |
| `RELEASING.md` / `CONTRIBUTING.md` | Attestation checklist; svelte-package non-negotiable | ✓ VERIFIED | `attestation` × 2 in RELEASING.md; `svelte-package` × 1 in CONTRIBUTING.md; `@sveltejs/package: ^2.5.8` pinned in `pnpm-workspace.yaml` catalog. |
| `packages/concierge/LICENSE` | Real MIT file so npm pack and pnpm pack agree | ✓ VERIFIED | 21 lines, MIT, present in the packed tarball. |
| `.gitignore` | `*.tgz` excluded | ✓ VERIFIED | Present. Confirmed operationally — the tree stayed clean across two `pnpm pack` runs. |

---

### Key Link Verification

| From | To | Via | Status | Details (measured) |
|------|----|-----|--------|--------------------|
| `packages/concierge/package.json` | `tsdown.config.ts` | `"build": "tsdown"` | ✓ WIRED | `pnpm build` exits 0, emits 4 files, runs both gates. |
| `tsdown.config.ts` | `@arethetypeswrong/cli` | `attw: { level: "error" }` | ✓ WIRED | Under mutant P1 (`types` → `./dist/nope.d.ts`) the build fails; at baseline it prints `✔ [attw]`. |
| `packages/concierge/package.json` | `dist/index.d.ts.map` | `files` includes `src` | ✓ WIRED | Both map `sources` resolve to files inside the tarball. |
| `package.json` | `scripts/pkg05-zero-runtime-deps.mjs` | `check:deps` | ✓ WIRED | Executed, exit 0; P5b proves it exits 1 on a real dependency. |
| `package.json` | `scripts/pack-install-check.sh` | `check:pack` | ✓ WIRED | Executed, exit 0, in two independent trees. |
| `package.json` | `scripts/node-floor-check.sh` | `check:node-floor` | ✓ WIRED (local only) | Executed, exit 0. **Not wired into CI by design** — see W4. |
| `src/index.ts` | `src/contract.ts` | value re-export | ✓ WIRED | Line 75; both names present in the built `.d.ts` export list and callable in `dist/index.js`. |
| `src/contract.ts` | `globalThis` | `Symbol.for` inside the function body | ✓ WIRED | Line 147. F1b measures the registry key present in a calling bundle and absent from an uncalled one. |
| `pnpm-workspace.yaml` | `packages/concierge/test/fixtures` | third `packages` glob entry | ✓ WIRED | Glob present; both fixture `node_modules` links exist on disk. |
| `.github/workflows/ci.yml` | `scripts/pack-install-check.sh` | `check:pack` step | ✓ WIRED (unexecuted) | `ci.yml:96`. |
| `.github/workflows/release.yml` | npm trusted publishing | `id-token: write` | ⚠️ WIRED, UNPROVEN | `release.yml:29`. Never executed. |
| `assertSingleInstance` | library runtime | a production call site | ✗ ABSENT (deferred by design) | **W5** — only tests, harnesses and CI invoke it. `createConcierge` does not exist yet. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces Real Data | Status |
|----------|------|--------|--------------------|--------|
| `dist/index.js` | value exports | `src/types.ts`, `src/contract.ts` via tsdown | Yes — `MESSAGE_MAX_CHARS===180`, `CONTRACT_VERSION===1`, `CONSENT_GRADE_ORDER` deep-equal, `USER_CANCELLED`/`USER_DECLINED` `Object.isFrozen`, `assertSingleInstance` typeof function | ✓ FLOWING |
| `dist/index.d.ts` | 45-name export list | rolldown dts bundle | Yes — parsed independently by the verifier: 1 block / 45 / 39 / 6 | ✓ FLOWING |
| `check:deps` Assertion A | module graph | real `rolldown()` call on the built artifact | Yes — 1 real module, not a stubbed count | ✓ FLOWING |
| `check:deps` Assertion B | dependency byte sizes | `statSync` on the ESM-condition entry | Yes — reports 0 for `@standard-schema/spec`, 113 for injected `typescript` | ✓ FLOWING |
| `fixtures.test.ts` F3b | resolved paths | `realpathSync` on real on-disk symlinks | Yes — links verified present | ✓ FLOWING |
| `single-instance.test.ts` F1b | emitted bundle text | real `rolldown()` bundle of two synthetic consumers | Yes — verifier reproduced: 3,933 B calling (key present) / 852 B uncalled (key absent) | ✓ FLOWING |

---

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|-----------|---------|--------|--------|
| Typecheck gate | `pnpm typecheck` | exit 0 | ✓ PASS |
| Build + in-build gates | `pnpm build` | exit 0; `✔ [attw]`, `✔ [publint]` | ✓ PASS |
| Runtime suite | `pnpm test` | exit 0; 4 files / 15 tests | ✓ PASS |
| Packed-artifact gates | `pnpm run check:artifact` | exit 0 | ✓ PASS |
| PKG-05 probe | `pnpm run check:deps` | exit 0 | ✓ PASS |
| PKG-02 harness | `pnpm run check:pack` | exit 0; 87,915 B tarball | ✓ PASS |
| PKG-03 harness | `pnpm run check:node-floor` | exit 0; v22.12.0 vs dev v24.14.1 | ✓ PASS |
| **Clean checkout** | fresh `git clone` of `b8eced6` → `pnpm install --frozen-lockfile` → `typecheck` → `build` → `test` → `check:artifact` → `check:deps` → `check:pack` | **all exit 0**, `git status --porcelain` empty | ✓ PASS |
| Export surface | independent Node parse of `dist/index.d.ts` | 1 block / 45 names / 39 types / 6 values | ✓ PASS |
| Tarball contents | `tar -tzf` on the packed tarball | 10 files: `dist/`×4, `src/`×3, README, LICENSE, package.json. **No fixtures, no tests** | ✓ PASS |
| `changeset status` | `pnpm exec changeset status` | exit **1**, error names no package. Not wired as a gate anywhere. | ℹ INFO — confirms the "vacuous check" characterization |

---

### Probe / Mutation Execution

**The verifier ran these mutants itself through `scripts/mutate-and-prove.sh`.** SUMMARY PASS-marker counts were not accepted. `git status --porcelain` was asserted independently after each.

| Mutant | Mutation | Gate | Verifier-measured result | Status |
|--------|----------|------|--------------------------|--------|
| **P4a** | `MESSAGE_MAX_CHARS: string = 180` in `src/types.ts` | `pnpm typecheck` | `PASS: gate fired (exit 1)`. `src/types.ts(279,14): error TS2322`, plus `exports.test-d.ts(59,44)` and `results.test-d.ts(108,29)` TS2344 | ✓ FIRED |
| **P4b** | same mutation | `pnpm build` | `FAIL: gate did NOT fire` — **exit 0 with `✔ [attw]` and `✔ [publint]` both clean.** This is the intended finding: the bundler does not typecheck | ✓ REPRODUCED |
| **P8a** | `MESSAGE_MAX_CHARS` moved into `index.ts`'s type-export block | `pnpm typecheck` | `PASS: gate fired (exit 1)`. `TS1485 at exports.test-d.ts(52,10)` — **exact documented signature** | ✓ FIRED |
| **P8b** | same mutation | `pnpm build` + `pnpm run check:artifact` | `BUILD_EXIT=0`, `ARTIFACT_EXIT=0` — **attw and publint are BLIND to a moved export, confirmed** | ✓ REPRODUCED |
| **P6-equiv** | module-scope registration added to `src/contract.ts` | `pnpm build && pnpm test single-instance` | `PASS: gate fired (exit 1)`. F1b fails with `AssertionError: expected 'Object.freeze({\n\tok: false,\n\treas…' not to contain '@fullselfbrowsing/concierge.contract'` — byte-identical to the documented signature | ✓ FIRED |
| **P7** | `CONTRACT_VERSION = 1` → `= 0` | same gate | `PASS: gate fired (exit 1)`. F2 the sole failure, 1 failed / 2 passed | ✓ FIRED |
| **P9** | `snapshotEquality` → method syntax | `pnpm typecheck` | `PASS: gate fired (exit 1)`. `TS2344 at consent-variance.test-d.ts(76,35)` **and** `TS2578 at actions.test-d.ts(162,3)` — TWO detectors, which is what falsifies W1's prose | ✓ FIRED |
| **P11** | `MESSAGE_MAX_CHARS` dropped from the value export block | `pnpm build && pnpm test export-surface` | `PASS: gate fired (exit 1)`. `expected [...] to have a length of 45 but got 44` and `to have a length of 6 but got 5` | ✓ FIRED |
| **P5b** | `typescript: 7.0.2` injected into `packages/concierge` `dependencies` | `pnpm run check:deps` | `PASS: gate fired (exit 1)`. Assertion B FAIL naming `typescript` at **113 bytes**. **Also reproduced defect W3**: the harness printed "tree clean" while `pnpm-lock.yaml` was modified | ✓ FIRED (+ W3) |

Nine mutant invocations run by the verifier; all nine produced the documented signature. Working tree restored to `b8eced6` clean after every one.

**Note on `ARTIFACT_EXIT`:** 02-VALIDATION.md:243 records `ARTIFACT_EXIT=1` for P8. That token refers to `pnpm test artifact` (the Vitest suite), not `pnpm run check:artifact`. Cross-read against 02-11-PLAN.md:262 — no contradiction. My independent `check:artifact` measurement of exit 0 is the same finding stated the other way: the packed-artifact gates are blind, and only `typecheck` and the Vitest artifact suite see it.

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| **PKG-01** | 02-01, 02-02, 02-03, 02-04, 02-10, 02-11, 02-12 | Published packages pass `publint` and `are-the-types-wrong` with no errors | ✓ SATISFIED | `check:artifact` exit 0 on the packed tarball; both gates at `level: "error"` inside the build; P1/P2/P3 classes gate the build; P4/P8 establish that `typecheck` is the load-bearing complement and CI runs it first |
| **PKG-02** | 02-09, 02-10, 02-12 | A pack-and-install test imports the built artifact from a scratch project and typechecks against it | ✓ SATISFIED | `check:pack` exit 0 twice (working tree + fresh clone); foreign project, `npm`, own compiler, `skipLibCheck: false` |
| **PKG-03** | 02-09, 02-10, 02-12 | The declared Node floor matches the runtime the package actually works on | ✓ SATISFIED | `check:node-floor` exit 0 on pinned v22.12.0 against dev v24.14.1; `engines.node: ">=22.12.0"` in both manifests; CI has a dedicated pnpm-free floor job |
| **PKG-04** | 02-03, 02-06, 02-07, 02-08, 02-12 | The package publishes ESM-only, and a test asserts a single core instance is shared across adapters | ✓ SATISFIED | ESM-only measured (no `.cjs`, no `require` condition, attw esm-only clean); F1a/F1b/F2/F3a/F3b/F3c all pass and all proven non-vacuous by P6/P7. See W5 for the call-site caveat |
| **PKG-05** | 02-05, 02-06, 02-12 | Core's runtime dependency footprint is verified to be zero-cost | ✓ SATISFIED | `check:deps` exit 0, both assertions; P5b proves exit 1 on a real dependency |

**Orphan check:** `REQUIREMENTS.md` maps exactly PKG-01…PKG-05 to Phase 2. All five appear in plan frontmatter. **No orphaned requirements.**

**Carry-forward item H — REQUIREMENTS.md closeout (commit `b8eced6`) is JUSTIFIED.** All five entries are `[x]` in the Packaging section and `Complete` in the traceability table, and each is backed by a gate the verifier executed independently.

---

### Anti-Patterns Found

Scanned all 30 files touched by this phase.

| Category | Result |
|----------|--------|
| `TBD` / `FIXME` / `XXX` (blocker-class debt markers) | **0 occurrences** |
| `TODO` / `HACK` / `PLACEHOLDER` | **0 occurrences** |
| `coming soon` / `not yet implemented` / `placeholder` / `will be here` | **0 occurrences** |
| Vacuously-green tests | None found. Every test file was proven non-vacuous by a verifier-run mutant, and `export-surface.test.ts:32-46` deliberately records `ReadbackAttestation` as *not asserted* rather than writing a guard that would pass vacuously forever. |
| Silently-green scripts | None. The prior `pnpm -r test` no-op is closed by `vitest.config.ts`. |

**No blocker-class anti-pattern. The debt-marker gate passes.**

---

### Human Verification Required

#### 1. First real CI run on GitHub

**Test:** Push to `github.com/fullselfbrowsing/Concierge` and observe both jobs of `.github/workflows/ci.yml`.
**Expected:** All six action references resolve; `Assert pnpm is 11.x` prints an 11.x version; the `node-floor` job's `process.version` assertion prints `v22.12.0`; `check:pack` and `check:node-floor` behave on `ubuntu-latest` as they do on darwin/arm64.
**Why human:** The workflow has never executed — `ci.yml:16-19` says so itself, and action-version pinning rests on 02-RESEARCH assumption A3, not a measurement. No GitHub Actions run exists. Every gate in this phase was verified on darwin/arm64 only.

#### 2. First real publish — provenance attestation

**Test:** Follow `RELEASING.md` and inspect the npm package page after the first publish.
**Expected:** Published over OIDC trusted publishing, with a provenance attestation visible. **A publish that succeeds without an attestation is a FAILED publish.**
**Why human:** `release.yml:3` states the workflow has never been executed; its verification to date is static review only. The failure mode is invisible from the exit code — if token auth ever wins over OIDC, the publish goes green and silently drops the attestation (T-02-46, T-02-47). External-service integration that cannot be exercised without publishing.

#### 3. Accept tarball-level evidence for the goal's "published" clause

**Test:** Confirm that `publint`/`attw` on the packed artifact + a foreign-project install + a floor-runtime install is accepted as sufficient evidence of "publishable" at v0.1.
**Expected:** Stakeholder agrees, with the actual publish deferred to milestone close.
**Why human:** The goal reads "built, published, and installed". Built and installed are measured end to end. Published is proven only up to the tarball — no artifact has left the machine.

---

### Gaps Summary

**There are no gaps.** All five ROADMAP success criteria were verified by independent measurement, not by reading SUMMARY.md, and each supporting test and script was additionally proven non-vacuous by a mutant the verifier applied and restored itself. The clean-checkout claim holds at `b8eced6` in a fresh clone.

The five warnings above are all **carry-forward, not incompleteness**, and none of them falsifies a success criterion:

- **W1** (stale M9 prose) and **W2** (missing `@__PURE__`) are quality debt in `src/types.ts` and `test-d/actions.test-d.ts`. W2 is explicitly outside SC-5's scope, which the PKG-05 probe's own header settles in writing before any runtime code existed.
- **W3** (harness false "tree clean") is a defect in the verification tooling, which the verifier reproduced and then worked around by asserting `git status --porcelain` independently after each of its nine mutants.
- **W4** (unverified Node download) is an accepted v0.1 risk whose containing measurement — not invoked under `.github/` — was re-confirmed.
- **W5** is a **new** finding not present in any carry-forward list: `assertSingleInstance` has no production call site, so SC-4's "fails loudly" is armed but not live in a consumer application. This is unavoidable in Phase 2 (`createConcierge` is Phase 3+ work) and PKG-04's literal requirement is satisfied — but nothing in this repository will notice if Phases 3-9 forget to wire it, and **neither Phase 3's nor Phase 9's ROADMAP success criteria mention it**. Recommend adding the call-site requirement to a later phase's success criteria rather than leaving it in SUMMARY prose.

None of W1-W5 is anchored to a later phase in ROADMAP.md; their owners exist only as prose in `02-12-SUMMARY.md`. Per conservative deferral matching, they are recorded here as warnings rather than as deferred items.

**Status is `human_needed`, not `passed`, solely because the two GitHub workflow files that carry the goal's "published" clause have never executed and cannot be verified programmatically.** Every automated check in this phase passes.

---

### Where a phase document disagreed with the tree

Checked explicitly, per the skepticism brief:

| Claim | Verdict |
|-------|---------|
| 02-VALIDATION.md's export-surface figures were stale (42/43) versus a measured 45 | **Reconciled correctly.** Line 136 marks the old `n===43` assertion "superseded" and records `EXPORT_NAMES=45`; lines 144, 184, 190, 192 assert 45. Verifier's independent parse: **45**. |
| 02-08's summary misattributed a harness defect; 02-12 corrected it to 02-05 | **Correction stands.** 02-VALIDATION.md:~271 and 02-12-SUMMARY.md:539-547 both attribute the finding to 02-05 Wave 3. |
| `changeset status` alone is a vacuous check | **Confirmed.** It exits 1 here, but its error names no package, and the only place it appears (validation row 02-10-T2) runs it with `|| true` and asserts on a `grep -q` for absence. Not wired as a gate in `package.json` or `.github/`. |
| `attw` and `publint` are blind to a moved export (mutant P8) | **Independently reproduced.** `BUILD_EXIT=0`, `ARTIFACT_EXIT=0`, only `pnpm typecheck` fired (`TS1485`). |
| Item C — three stale prose claims still present | **Confirmed present** at the exact stated lines. |
| Item E — three `Object.freeze` calls lack `@__PURE__` | **Confirmed**, and the retention independently measured in both consumer bundles. |
| Item D — harness reports "tree clean" while dirty | **Reproduced.** |
| Item F — `node-floor-check.sh` invoked by nothing under `.github/` | **Measurement still true** — all four matches are comment lines. |
| Item H — REQUIREMENTS.md closeout | **Justified** by five independently executed gates. |

---

_Verified: 2026-07-29T15:13:55Z at commit b8eced6_
_Verifier: Claude (gsd-verifier) — every result measured in-process; no SUMMARY.md claim accepted as evidence_
