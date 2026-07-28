---
phase: 2
slug: packaging-build-and-release
status: draft
nyquist_compliant: false
wave_0_complete: true
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

Populated by plan 02-01 Task 3. **31 rows, one per task**, inventoried with
`grep -n '^  <name>Task' .planning/phases/02-packaging-build-and-release/02-*-PLAN.md` across all
twelve plans. Each Automated Command is copied verbatim from that task's `<verify><automated>`
block, with `|` escaped as `\|` so the pipeline survives the table syntax.

⚠️ **Two defects in this table's own instructions, recorded rather than papered over.**

**(1) The row-count proxy cannot reach its own threshold.** 02-01 Task 3's own verify asserts
`grep -c '^| 02-0' … -ge 31`. That pattern cannot reach 31: it matches plans 02-01…02-09 only, and
those hold **22** of the 31 tasks — `02-10-T1` and its siblings start `| 02-1`. The pattern that
matches all 31 is `^| 02-`. The rationale given for `^| 02-0` — that the phase-gate plan counts
rows this way — is also not what 02-12 does; its sign-off verify greps `nyquist_compliant`,
`status: complete`, `⬜ pending` and `Approval:** pending`, and never counts rows. The rows below
use correct task IDs; the proxy is wrong, not the data.

**(2) Two rows are self-referential: their commands grep the file the command now lives in.**
"Copy the command verbatim" and "grep this file for a literal" cannot both hold once the command
*contains* that literal. Rows `02-01-T3` and `02-12-T3` each do:

| Row | Literal its own command greps for | Consequence |
|---|---|---|
| `02-01-T3` | `*pending*` | Its clause `test -z "$(grep -F '*pending*' …)"` can never pass — the string is in its own command cell |
| `02-12-T3` | `⬜ pending`, `Approval:** pending` | 02-12's sign-off can never go quiet by flipping statuses alone |

The *intent* of both checks is met: the placeholder row is gone (`grep -cE '^\| \*pending\* \|'`
returns **0**), and every Status cell is a real value. Only the quoted-command copies survive.
Whoever runs these checks should match the **column**, not the bare string — `^| *pending* |` for
the placeholder row, `| ⬜ pending |` for the Status column. Left verbatim rather than paraphrased,
because the acceptance criterion requires each cell to match its task's `<verify>` text.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-T1 | 02-01 | 1 | PKG-01 | T-02-01 | Toolchain pinned exactly and the package carries its own LICENSE, so npm pack and pnpm pack inspect one artifact | build gate | `pnpm exec tsc --version \| grep -qx "Version 7.0.2" && pnpm --filter @fullselfbrowsing/concierge typecheck && node -e "process.exit(require('fs').readFileSync('.gitignore','utf8').split('\n').includes('*.tgz')?0:1)" && cmp LICENSE packages/concierge/LICENSE && echo TOOLCHAIN_OK` | ✅ | ⬜ pending |
| 02-01-T2 | 02-01 | 1 | PKG-01 | T-02-04 | The package-manager bump's lockfile churn stays reviewable in isolation | build gate | `grep -q '"packageManager": "pnpm@11.17.0"' package.json && pnpm --version \| grep -qx "11.17.0" && pnpm install --frozen-lockfile && pnpm --filter @fullselfbrowsing/concierge typecheck && echo PNPM11_OK` | ✅ | ⬜ pending |
| 02-01-T3 | 02-01 | 1 | PKG-01 | — | The validation map names real task IDs and real commands | static review | `grep -q "^wave_0_complete: true" .planning/phases/02-packaging-build-and-release/02-VALIDATION.md && grep -q "^nyquist_compliant: false" .planning/phases/02-packaging-build-and-release/02-VALIDATION.md && test "$(grep -c '^\| 02-0' .planning/phases/02-packaging-build-and-release/02-VALIDATION.md)" -ge 31 && test -z "$(grep -F '*pending*' .planning/phases/02-packaging-build-and-release/02-VALIDATION.md)" && echo VALIDATION_MAP_OK` | ✅ | ⬜ pending |
| 02-02-T1 | 02-02 | 1 | PKG-01 | T-02-06 | A mutation is restored by a trap even when the gate under test aborts | static review | `test -x scripts/mutate-and-prove.sh && bash -n scripts/mutate-and-prove.sh && grep -q "MUT_PATTERN" scripts/mutate-and-prove.sh && grep -q "git diff --exit-code" scripts/mutate-and-prove.sh && grep -q "EXIT INT TERM" scripts/mutate-and-prove.sh && echo HARNESS_WRITTEN` | ❌ W1 | ⬜ pending |
| 02-02-T2 | 02-02 | 1 | PKG-01 | T-02-07 | The harness is observed failing four ways before any gate relies on it | mutation | `bash scripts/mutate-and-prove.sh packages/concierge/src/types.ts 'export const MESSAGE_MAX_CHARS = 180;' 'export const MESSAGE_MAX_CHARS: 181 = 180;' -- pnpm --filter @fullselfbrowsing/concierge typecheck; test $? -eq 0 && git diff --exit-code -- packages/concierge/src/types.ts && echo HARNESS_PROVEN` | ❌ W1 | ⬜ pending |
| 02-03-T1 | 02-03 | 2 | PKG-01, PKG-04d | T-02-10 | Both artifact gates run at level error, so a manifest defect fails the build | build gate | `pnpm build && test -f packages/concierge/dist/index.js && test -f packages/concierge/dist/index.d.ts && test ! -e packages/concierge/dist/index.cjs && node -e "const s=require('fs').readFileSync('packages/concierge/dist/index.d.ts','utf8');const m=[...s.matchAll(/export\s*\{([^}]*)\}/g)];const n=m.flatMap(x=>x[1].split(',')).map(t=>t.trim()).filter(Boolean).length;console.log('EXPORT_NAMES='+n);process.exit(n===43?0:1)"` | ❌ W2 | ⬜ pending |
| 02-03-T2 | 02-03 | 2 | PKG-01 | T-02-13 | The packed file list is enumerated, so no test or script source escapes | artifact lint | `pnpm build && node -e "const p=require('./packages/concierge/package.json');process.exit(p.files.includes('src')&&p.files.includes('dist')?0:1)" && OUT=$(mktemp -d) && (cd packages/concierge && pnpm pack --pack-destination "$OUT" >/dev/null) && tar -tzf "$OUT"/*.tgz \| tee /dev/stderr \| grep -q '^package/src/types.ts$' && ! tar -tzf "$OUT"/*.tgz \| grep -q 'test-d' && rm -rf "$OUT" && echo TARBALL_OK` | ❌ W2 | ⬜ pending |
| 02-03-T3 | 02-03 | 2 | PKG-01 | T-02-14 | The gates run against the packed tarball, where files-omits-dist is visible | artifact lint | `pnpm build && pnpm run check:artifact && echo ARTIFACT_GATES_OK` | ❌ W2 | ⬜ pending |
| 02-04-T1 | 02-04 | 3 | PKG-01 | T-02-17 | A CommonJS-declared package emitting ESM fails both gates independently | mutation | `bash scripts/mutate-and-prove.sh packages/concierge/package.json '  "type": "module",' '  "type": "commonjs",' -- pnpm exec attw --pack packages/concierge --profile esm-only; test $? -eq 0 && git diff --exit-code && echo P3B_PROVEN` | ❌ W3 | ⬜ pending |
| 02-04-T2 | 02-04 | 3 | PKG-01 | T-02-18 | A type error fires tsc --noEmit while the bundler passes — the gates are structurally separate | mutation | `bash scripts/mutate-and-prove.sh packages/concierge/src/types.ts 'export const MESSAGE_MAX_CHARS = 180;' 'export const MESSAGE_MAX_CHARS: 181 = 180;' -- bash -c 'pnpm build; echo BUILD_EXIT=$?; pnpm typecheck' 2>&1 \| tee /tmp/p4.log; grep -q "BUILD_EXIT=0" /tmp/p4.log && grep -q "PASS: gate fired" /tmp/p4.log && git diff --exit-code -- packages/concierge/src/types.ts && pnpm build && echo P4_PROVEN` | ❌ W3 | ⬜ pending |
| 02-05-T1 | 02-05 | 3 | PKG-05 | T-02-22 | Zero runtime bytes is measured on the built artifact, not the manifest | artifact lint | `pnpm build && pnpm run check:deps \| tee /tmp/pkg05-baseline.log && grep -q "core's dependencies contribute zero bytes to a consumer bundle" /tmp/pkg05-baseline.log && echo PKG05_BASELINE_OK` | ❌ W3 | ⬜ pending |
| 02-05-T2 | 02-05 | 3 | PKG-05 | T-02-21 | Both halves of the probe are observed failing, so neither reports green untested | mutation | `bash scripts/mutate-and-prove.sh packages/concierge/package.json '"@standard-schema/spec": "^1.0.0"' '"@standard-schema/spec": "^1.0.0", "typescript": "7.0.2"' -- pnpm run check:deps; test $? -eq 0 && git diff --exit-code && pnpm run check:deps && echo P5B_PROVEN` | ❌ W3 | ⬜ pending |
| 02-06-T1 | 02-06 | 4 | PKG-04 | T-02-25 | The duplicate-instance check lives on a reachable path, not module scope | type | `pnpm --filter @fullselfbrowsing/concierge typecheck && test "$(grep -c '^import' packages/concierge/src/contract.ts)" -eq 0 && grep -q 'Symbol.for("@fullselfbrowsing/concierge.contract")' packages/concierge/src/contract.ts && echo CONTRACT_OK` | ❌ W4 | ⬜ pending |
| 02-06-T2 | 02-06 | 4 | PKG-04, PKG-05 | T-02-26 | The mismatch message carries version integers and remediation only — no paths, no user data | artifact lint | `pnpm --filter @fullselfbrowsing/concierge typecheck && pnpm build && pnpm run check:artifact && pnpm run check:deps && node -e "const s=require('fs').readFileSync('packages/concierge/dist/index.d.ts','utf8');const m=[...s.matchAll(/export\s*\{([^}]*)\}/g)];const names=m.flatMap(x=>x[1].split(',')).map(t=>t.trim().split(/\s+as\s+/).pop()).filter(Boolean);console.log('EXPORT_NAMES='+names.length);const need=['CONTRACT_VERSION','assertSingleInstance','MESSAGE_MAX_CHARS','USER_CANCELLED','USER_DECLINED','CONSENT_GRADE_ORDER'];const bad=['serverChallengeBrand','ConsentAckBase','ContractRecord','Holder'];process.exit(names.length===45&&need.every(n=>names.includes(n))&&bad.every(n=>!names.includes(n))?0:1)"` | ❌ W4 | ⬜ pending |
| 02-07-T1 | 02-07 | 5 | PKG-04 | T-02-29 | pnpm test can no longer exit 0 with no tests | unit | `pnpm build && pnpm test -- single-instance && test "$(grep -v '^[[:space:]]*[/*]' packages/concierge/test/single-instance.test.ts \| grep -c '\.\./src/')" -eq 0 && grep -q '"test": "vitest run"' package.json && echo SINGLE_INSTANCE_OK` | ❌ W5 | ⬜ pending |
| 02-07-T2 | 02-07 | 5 | PKG-04 | T-02-32 | The export list is pinned by count and by name, and the vacuous check is recorded not written | unit | `pnpm build && pnpm test -- artifact && pnpm test -- export-surface && test "$(cat packages/concierge/test/artifact.test.ts packages/concierge/test/export-surface.test.ts \| grep -v '^[[:space:]]*[/*]' \| grep -c '\.\./src/')" -eq 0 && grep -q "ReadbackAttestation" packages/concierge/test/export-surface.test.ts && echo ARTIFACT_GUARDS_OK` | ❌ W5 | ⬜ pending |
| 02-07-T3 | 02-07 | 5 | PKG-04 | T-02-30 | The duplicate-instance guard is observed surviving tree-shaking | mutation | `bash scripts/mutate-and-prove.sh packages/concierge/src/contract.ts 'export const CONTRACT_VERSION = 1;' 'export const CONTRACT_VERSION = 0;' -- bash -c 'pnpm build && pnpm test -- single-instance'; test $? -eq 0 && git diff --exit-code && pnpm build && pnpm test && echo P7_PROVEN` | ❌ W5 | ⬜ pending |
| 02-08-T1 | 02-08 | 6 | PKG-04 | T-02-37 | Both fixtures are private workspace members declaring core as a peer | integration | `pnpm install && test -e packages/concierge/test/fixtures/adapter-alpha/node_modules/@fullselfbrowsing/concierge && test -e packages/concierge/test/fixtures/adapter-beta/node_modules/@fullselfbrowsing/concierge && pnpm build && pnpm typecheck && pnpm test && node -e "for (const n of ['alpha','beta']) { const p=require('./packages/concierge/test/fixtures/adapter-'+n+'/package.json'); if(p.private!==true) process.exit(1); if(!p.peerDependencies\|\|!p.peerDependencies['@fullselfbrowsing/concierge']) process.exit(1); }" && echo FIXTURES_LINKED` | ❌ W6 | ⬜ pending |
| 02-08-T2 | 02-08 | 6 | PKG-04 | T-02-35 | Two adapters resolve one physical copy and one function object | integration | `pnpm build && pnpm test -- fixtures && echo FIXTURES_TEST_OK` | ❌ W6 | ⬜ pending |
| 02-09-T1 | 02-09 | 6 | PKG-02 | T-02-40 | The scratch project installs the tarball, not the workspace copy, and fully checks the shipped .d.ts | integration | `pnpm run check:pack && bash scripts/mutate-and-prove.sh packages/concierge/test/fixtures/probe.ts 'export const n: 180 = MESSAGE_MAX_CHARS;' 'export const n: 181 = MESSAGE_MAX_CHARS;' -- pnpm run check:pack; test $? -eq 0 && git diff --exit-code && pnpm run check:pack && echo PKG02_OK` | ❌ W6 | ⬜ pending |
| 02-09-T2 | 02-09 | 6 | PKG-03 | T-02-42 | The floor is verified on an exact pinned v22.12.0, not the developer's runtime | integration | `pnpm run check:node-floor && echo PKG03_OK` | ❌ W6 | ⬜ pending |
| 02-09-T3 | 02-09 | 6 | PKG-03 | T-02-43 | The floor job is observed failing, so a green floor means something | integration | `pnpm build && pnpm run check:node-floor && git diff --exit-code && echo P10_BASELINE_GREEN` | ❌ W6 | ⬜ pending |
| 02-10-T1 | 02-10 | 7 | PKG-02, PKG-03 | T-02-49 | CI installs frozen and typechecks before building, on two pinned runtimes | static review | `test -f .github/workflows/ci.yml && grep -q "pnpm typecheck" .github/workflows/ci.yml && grep -q "check:pack" .github/workflows/ci.yml && grep -q "frozen-lockfile" .github/workflows/ci.yml && test "$(grep -v '^[[:space:]]*#' .github/workflows/ci.yml \| grep -c 'node-version:')" -eq 2 && grep -v '^[[:space:]]*#' .github/workflows/ci.yml \| grep -q "node-version: 24" && grep -v '^[[:space:]]*#' .github/workflows/ci.yml \| grep -q "node-version: '22.12.0'" && test "$(awk '/node-floor:/,0' .github/workflows/ci.yml \| grep -v '^[[:space:]]*#' \| grep -c pnpm)" -eq 0 && grep -q "scripts/node-floor-check.sh" .github/workflows/ci.yml && echo CI_STATIC_OK` | ❌ W7 | ⬜ pending |
| 02-10-T2 | 02-10 | 7 | PKG-01 | T-02-46 | Publishing is OIDC-only with no NPM_TOKEN, so provenance cannot silently degrade | static review | `node -e "JSON.parse(require('fs').readFileSync('.changeset/config.json','utf8'))" && node -e "const c=require('./.changeset/config.json');process.exit(Array.isArray(c.ignore)&&c.ignore.length===0&&c.privatePackages===false?0:1)" && { pnpm exec changeset status > /tmp/changeset-status.log 2>&1 \|\| true; } && ! grep -q 'concierge-fixture-' /tmp/changeset-status.log && grep -q "id-token: write" .github/workflows/release.yml && grep -q "fetch-depth: 0" .github/workflows/release.yml && test "$(grep -rIh 'NPM_TOKEN' .github/ \| grep -v '^[[:space:]]*#' \| grep -cE 'NPM_TOKEN[[:space:]]*[:=]\|secrets\.NPM_TOKEN')" -eq 0 && grep -q 'NPM_TOKEN' .github/workflows/release.yml && test "$(grep -v '^[[:space:]]*#' .github/workflows/release.yml \| grep -cE -- '--provenance\|auth-token-line')" -eq 0 && grep -q "attestation" RELEASING.md && echo RELEASE_STATIC_OK` | ❌ W7 | ⬜ pending |
| 02-10-T3 | 02-10 | 7 | PKG-01 | T-02-SC | The second build toolchain is pinned and the build stays decentralized | static review | `grep -q "svelte-package" CONTRIBUTING.md && grep -q "not centralized" CONTRIBUTING.md && grep -q "pnpm typecheck && pnpm build && pnpm test" CONTRIBUTING.md && grep -q "@sveltejs/package" pnpm-workspace.yaml && grep -q "catalog:" pnpm-workspace.yaml && test ! -d packages/concierge-svelte && pnpm install --frozen-lockfile && pnpm typecheck && pnpm build && pnpm test && echo TOOLCHAIN_DOC_OK` | ❌ W7 | ⬜ pending |
| 02-11-T1 | 02-11 | 7 | PKG-01 | T-02-55 | The value-export guard reads the public entrypoint, the module the regression is visible in | type | `pnpm --filter @fullselfbrowsing/concierge typecheck && grep -q 'from "../src/index.js"' packages/concierge/test-d/exports.test-d.ts && test "$(grep -cE '^import .*\.\./src/types\.js' packages/concierge/test-d/exports.test-d.ts)" -eq 0 && grep -q 'results.test-d.ts' packages/concierge/test-d/exports.test-d.ts && test -z "$(grep -l '^[[:space:]]*export' packages/concierge/test-d/exports.test-d.ts)" && echo EXPORTS_GUARD_OK` | ❌ W7 | ⬜ pending |
| 02-11-T2 | 02-11 | 7 | PKG-01 | T-02-57 | The M9 regression gets a named detector, not a lone unused-directive symptom | type | `pnpm --filter @fullselfbrowsing/concierge typecheck && grep -q "_policyNotBivariant" packages/concierge/test-d/consent-variance.test-d.ts && test "$(grep -c '@ts-expect-error' packages/concierge/test-d/actions.test-d.ts)" -eq 2 && test -z "$(grep -F 'single symptom' packages/concierge/test-d/consent.test-d.ts)" && git diff --exit-code packages/concierge/test-d/actions.test-d.ts packages/concierge/src/types.ts && echo M9_DETECTOR_OK` | ❌ W7 | ⬜ pending |
| 02-11-T3 | 02-11 | 7 | PKG-01 | T-02-56 | Both new guards are observed firing with their measured diagnostics | mutation | `bash scripts/mutate-and-prove.sh packages/concierge/src/types.ts '  snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean;' '  snapshotEquality?(a: Snapshot, b: Snapshot): boolean;' -- pnpm typecheck 2>&1 \| tee /tmp/p9.log; grep -q "PASS: gate fired" /tmp/p9.log && grep -q "TS2344" /tmp/p9.log && grep -q "_policyNotBivariant" /tmp/p9.log && git diff --exit-code && echo P9_PROVEN` | ❌ W7 | ⬜ pending |
| 02-12-T1 | 02-12 | 8 | PKG-01 … PKG-05 | T-02-60 | The phase is green from a clean checkout with an empty working tree | integration | `rm -rf packages/concierge/dist node_modules packages/concierge/node_modules packages/concierge/test/fixtures/*/node_modules && pnpm install --frozen-lockfile && pnpm typecheck && pnpm build && pnpm test && pnpm run check:artifact && pnpm run check:deps && pnpm run check:pack && pnpm run check:node-floor && test -z "$(git status --porcelain)" && echo PHASE_GATE_GREEN` | ❌ W8 | ⬜ pending |
| 02-12-T2 | 02-12 | 8 | PKG-01 … PKG-05 | T-02-59 | Every gate is re-proven on the finished phase, not only when it was written | mutation | `pnpm build && bash scripts/mutate-and-prove.sh packages/concierge/src/types.ts 'export const MESSAGE_MAX_CHARS = 180;' 'export const MESSAGE_MAX_CHARS: 181 = 180;' -- bash -c 'pnpm build; echo BUILD_EXIT=$?; pnpm typecheck' 2>&1 \| tee /tmp/gate-p4.log; grep -q "BUILD_EXIT=0" /tmp/gate-p4.log && grep -q "PASS: gate fired" /tmp/gate-p4.log && git diff --exit-code && pnpm build && pnpm test && echo P4_REPROVEN` | ❌ W8 | ⬜ pending |
| 02-12-T3 | 02-12 | 8 | PKG-01 … PKG-05 | T-02-63 | Sign-off records observed exit codes, and the manual-only row stays manual | static review | `grep -q "^nyquist_compliant: true" .planning/phases/02-packaging-build-and-release/02-VALIDATION.md && grep -q "^status: complete" .planning/phases/02-packaging-build-and-release/02-VALIDATION.md && test -z "$(grep -F '⬜ pending' .planning/phases/02-packaging-build-and-release/02-VALIDATION.md)" && test -z "$(grep -F 'Approval:** pending' .planning/phases/02-packaging-build-and-release/02-VALIDATION.md)" && test "$(grep -rIh -- '--watch' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.planning . \| grep -v '^[[:space:]]*[#/*]' \| grep -c -- '--watch')" -eq 0 && git diff --stat --name-only \| grep -qx ".planning/phases/02-packaging-build-and-release/02-VALIDATION.md" && echo SIGNOFF_OK` | ❌ W8 | ⬜ pending |

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
