---
phase: 2
slug: packaging-build-and-release
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
signed_off: 2026-07-29
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
| **Config file** | `vitest.config.ts` (root) — created by plan 02-07; one `node` project, typecheck mode off. **Exists** `[VERIFIED 2026-07-29]` |
| **Test file glob** | `packages/concierge/test/**/*.test.ts` — **4 files, 15 tests, exits 0** `[VERIFIED 2026-07-29]` |
| **Type-test glob** | `packages/concierge/test-d/**/*.test-d.ts` — **6 files** since plan 02-11 (was 5 at Wave 0), exits 0 `[VERIFIED 2026-07-29]` |
| **Quick run command** | `pnpm --filter @fullselfbrowsing/concierge typecheck` — measured **0.45 s** wall on the finished phase; bare `tsc -p tsconfig.test-d.json` is **0.11–0.15 s**. The ~0.08 s figure predates 02-11's two extra `test-d` files and excludes pnpm's own startup |
| **Full suite command** | `pnpm typecheck && pnpm build && pnpm test` |
| **Distribution suite** | `pnpm run check:deps && pnpm run check:pack && pnpm run check:node-floor` |
| **Estimated runtime** | Measured on the finished phase: `pnpm typecheck` **0.75 s**, `pnpm build` **1.28 s**, `pnpm test` **0.78 s**, chained **2.71 s** — over the < 2 s estimate, because `pnpm -r` startup is paid three times. The **inner loop** stays at 0.45 s, which is the number the sign-off criterion is about. `check:pack` is network-bound (~3 s warm), `check:node-floor` is download-bound once (~11 s cold, ~2–3 s warm) |
| **Current state at Wave 0** | `pnpm build` exited **1** (`ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`); `pnpm test` exited **0** as a silent no-op. Both `[VERIFIED 2026-07-28]`. **Both closed** — `pnpm build` exits 0 (02-03) and `pnpm test` runs 15 real tests (02-07/02-08) `[VERIFIED 2026-07-29]` |

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

⚠️ **Three defects in this table's own instructions, recorded rather than papered over.**

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

**(3) `02-12-T3`'s `--watch` clause disables its own `--exclude-dir` flags.** The clause reads
`grep -rIh -- '--watch' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.planning .`.
`--` terminates option parsing, so the three `--exclude-dir=` arguments are read as **file operands**,
not options — `grep` prints `No such file or directory` for each and then scans `.` recursively,
`node_modules` included. Measured on the finished phase: the clause as written counts **72**
non-comment matches and can never return 0; with the flags moved **before** the `--` it counts
**0**. The substantive claim is stronger than the criterion asks for — `git grep -i watch --
':!.planning'` returns **nothing at all**, so there is no watch-mode flag on any line, comment or
otherwise, in any script, workflow, config or test file this repository owns. The 02-07 config
comment the criterion was scoped around does not exist; `vitest.config.ts` never spells the token.

**Command form corrected: `pnpm test <name>`, never `pnpm test -- <name>`.** Vitest's cac CLI
discards everything after `--`, so the filter is silently dropped and the **whole** suite runs. This
was measured independently by plans 02-07, 02-08, 02-09, 02-10 and 02-11, and a sixth time at the
phase gate across all four filter names:

| Command | Test files run | Tests run |
|---|---|---|
| `pnpm test single-instance` / `export-surface` / `artifact` / `fixtures` | **1** each | 3 / 4 / 5 / 3 |
| `pnpm test -- <any of those four>` | **4** | **15** |

Every gate still *fires* — any failure anywhere makes the run non-zero — so no proof in this phase is
invalidated. What was lost is **specificity**, which is exactly what several rows claim. The
`pnpm test -- <name>` occurrences in rows `02-07-T1`, `02-07-T2`, `02-07-T3` and `02-08-T2`, in the
`PKG-04a` / `PKG-04c` / `*(artifact)` rows of the Requirement → Test Map, and in the `P6` / `P11`
gate cells of the mutant table have been **corrected to the bare form**. This is the one place where
a cell deliberately diverges from its plan's `<verify>` text; the divergence is a one-character
correction, and `.github/workflows/ci.yml` already carries the bare form (0 executable `pnpm test --`
lines under `.github/`, measured by 02-10).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-T1 | 02-01 | 1 | PKG-01 | T-02-01 | Toolchain pinned exactly and the package carries its own LICENSE, so npm pack and pnpm pack inspect one artifact | build gate | `pnpm exec tsc --version \| grep -qx "Version 7.0.2" && pnpm --filter @fullselfbrowsing/concierge typecheck && node -e "process.exit(require('fs').readFileSync('.gitignore','utf8').split('\n').includes('*.tgz')?0:1)" && cmp LICENSE packages/concierge/LICENSE && echo TOOLCHAIN_OK` | ✅ | ✅ `TOOLCHAIN_OK`, exit 0 (phase gate, 2026-07-29) |
| 02-01-T2 | 02-01 | 1 | PKG-01 | T-02-04 | The package-manager bump's lockfile churn stays reviewable in isolation | build gate | `grep -q '"packageManager": "pnpm@11.17.0"' package.json && pnpm --version \| grep -qx "11.17.0" && pnpm install --frozen-lockfile && pnpm --filter @fullselfbrowsing/concierge typecheck && echo PNPM11_OK` | ✅ | ✅ `PNPM11_OK`, exit 0 (phase gate, 2026-07-29) |
| 02-01-T3 | 02-01 | 1 | PKG-01 | — | The validation map names real task IDs and real commands | static review | `grep -q "^wave_0_complete: true" .planning/phases/02-packaging-build-and-release/02-VALIDATION.md && grep -q "^nyquist_compliant: false" .planning/phases/02-packaging-build-and-release/02-VALIDATION.md && test "$(grep -c '^\| 02-0' .planning/phases/02-packaging-build-and-release/02-VALIDATION.md)" -ge 31 && test -z "$(grep -F '*pending*' .planning/phases/02-packaging-build-and-release/02-VALIDATION.md)" && echo VALIDATION_MAP_OK` | ✅ | ⚠️ exit 1 — intent met, command self-defeating: see defects (1) and (2). `^\| 02-0` matches 22 of 31 rows (`^\| 02-` matches 31), the 3 `*pending*` hits are all inside quoted command cells (placeholder-row count is **0**), and `nyquist_compliant` is now `true` by design |
| 02-02-T1 | 02-02 | 1 | PKG-01 | T-02-06 | A mutation is restored by a trap even when the gate under test aborts | static review | `test -x scripts/mutate-and-prove.sh && bash -n scripts/mutate-and-prove.sh && grep -q "MUT_PATTERN" scripts/mutate-and-prove.sh && grep -q "git diff --exit-code" scripts/mutate-and-prove.sh && grep -q "EXIT INT TERM" scripts/mutate-and-prove.sh && echo HARNESS_WRITTEN` | ✅ | ✅ `HARNESS_WRITTEN`, exit 0 (phase gate, 2026-07-29) |
| 02-02-T2 | 02-02 | 1 | PKG-01 | T-02-07 | The harness is observed failing four ways before any gate relies on it | mutation | `bash scripts/mutate-and-prove.sh packages/concierge/src/types.ts 'export const MESSAGE_MAX_CHARS = 180;' 'export const MESSAGE_MAX_CHARS: 181 = 180;' -- pnpm --filter @fullselfbrowsing/concierge typecheck; test $? -eq 0 && git diff --exit-code -- packages/concierge/src/types.ts && echo HARNESS_PROVEN` | ✅ | ✅ `HARNESS_PROVEN`, exit 0 (phase gate, 2026-07-29) |
| 02-03-T1 | 02-03 | 2 | PKG-01, PKG-04d | T-02-10 | Both artifact gates run at level error, so a manifest defect fails the build | build gate | `pnpm build && test -f packages/concierge/dist/index.js && test -f packages/concierge/dist/index.d.ts && test ! -e packages/concierge/dist/index.cjs && node -e "const s=require('fs').readFileSync('packages/concierge/dist/index.d.ts','utf8');const m=[...s.matchAll(/export\s*\{([^}]*)\}/g)];const n=m.flatMap(x=>x[1].split(',')).map(t=>t.trim()).filter(Boolean).length;console.log('EXPORT_NAMES='+n);process.exit(n===43?0:1)"` | ✅ | ⚠️ exit 1 — the build half is green (4 `dist/` files, no `index.cjs`, attw + publint clean) but the `n===43` assertion is **superseded**: `src/contract.ts` (02-06) added `CONTRACT_VERSION` and `assertSingleInstance`, so `EXPORT_NAMES=45`. Row `02-06-T2` asserts 45 and passes |
| 02-03-T2 | 02-03 | 2 | PKG-01 | T-02-13 | The packed file list is enumerated, so no test or script source escapes | artifact lint | `pnpm build && node -e "const p=require('./packages/concierge/package.json');process.exit(p.files.includes('src')&&p.files.includes('dist')?0:1)" && OUT=$(mktemp -d) && (cd packages/concierge && pnpm pack --pack-destination "$OUT" >/dev/null) && tar -tzf "$OUT"/*.tgz \| tee /dev/stderr \| grep -q '^package/src/types.ts$' && ! tar -tzf "$OUT"/*.tgz \| grep -q 'test-d' && rm -rf "$OUT" && echo TARBALL_OK` | ✅ | ✅ `TARBALL_OK`, exit 0 (phase gate, 2026-07-29) |
| 02-03-T3 | 02-03 | 2 | PKG-01 | T-02-14 | The gates run against the packed tarball, where files-omits-dist is visible | artifact lint | `pnpm build && pnpm run check:artifact && echo ARTIFACT_GATES_OK` | ✅ | ✅ `ARTIFACT_GATES_OK`, exit 0 (phase gate, 2026-07-29) |
| 02-04-T1 | 02-04 | 3 | PKG-01 | T-02-17 | A CommonJS-declared package emitting ESM fails both gates independently | mutation | `bash scripts/mutate-and-prove.sh packages/concierge/package.json '  "type": "module",' '  "type": "commonjs",' -- pnpm exec attw --pack packages/concierge --profile esm-only; test $? -eq 0 && git diff --exit-code && echo P3B_PROVEN` | ✅ | ✅ `P3B_PROVEN`, exit 0 (phase gate, 2026-07-29) |
| 02-04-T2 | 02-04 | 3 | PKG-01 | T-02-18 | A type error fires tsc --noEmit while the bundler passes — the gates are structurally separate | mutation | `bash scripts/mutate-and-prove.sh packages/concierge/src/types.ts 'export const MESSAGE_MAX_CHARS = 180;' 'export const MESSAGE_MAX_CHARS: 181 = 180;' -- bash -c 'pnpm build; echo BUILD_EXIT=$?; pnpm typecheck' 2>&1 \| tee /tmp/p4.log; grep -q "BUILD_EXIT=0" /tmp/p4.log && grep -q "PASS: gate fired" /tmp/p4.log && git diff --exit-code -- packages/concierge/src/types.ts && pnpm build && echo P4_PROVEN` | ✅ | ✅ `P4_PROVEN`, exit 0 (phase gate, 2026-07-29) — `BUILD_EXIT=0` with `TS2322` at `src/types.ts(279,14)` |
| 02-05-T1 | 02-05 | 3 | PKG-05 | T-02-22 | Zero runtime bytes is measured on the built artifact, not the manifest | artifact lint | `pnpm build && pnpm run check:deps \| tee /tmp/pkg05-baseline.log && grep -q "core's dependencies contribute zero bytes to a consumer bundle" /tmp/pkg05-baseline.log && echo PKG05_BASELINE_OK` | ✅ | ✅ `PKG05_BASELINE_OK`, exit 0 (phase gate, 2026-07-29) |
| 02-05-T2 | 02-05 | 3 | PKG-05 | T-02-21 | Both halves of the probe are observed failing, so neither reports green untested | mutation | `bash scripts/mutate-and-prove.sh packages/concierge/package.json '"@standard-schema/spec": "^1.0.0"' '"@standard-schema/spec": "^1.0.0", "typescript": "7.0.2"' -- pnpm run check:deps; test $? -eq 0 && git diff --exit-code && pnpm run check:deps && echo P5B_PROVEN` | ✅ | ⚠️ exit 1 — the mutant **fires** (`PASS: gate fired`, Assertion B names `typescript` at **113 bytes**), but the row's own `git diff --exit-code` fails: pnpm 11 auto-installs before running a script when a workspace manifest changed, rewriting `pnpm-lock.yaml` **outside** the harness's trap. `P5B_PROVEN`, exit 0, with the `pnpm --config.verify-deps-before-run=false run check:deps` gate 02-05 actually used |
| 02-06-T1 | 02-06 | 4 | PKG-04 | T-02-25 | The duplicate-instance check lives on a reachable path, not module scope | type | `pnpm --filter @fullselfbrowsing/concierge typecheck && test "$(grep -c '^import' packages/concierge/src/contract.ts)" -eq 0 && grep -q 'Symbol.for("@fullselfbrowsing/concierge.contract")' packages/concierge/src/contract.ts && echo CONTRACT_OK` | ✅ | ✅ `CONTRACT_OK`, exit 0 (phase gate, 2026-07-29) |
| 02-06-T2 | 02-06 | 4 | PKG-04, PKG-05 | T-02-26 | The mismatch message carries version integers and remediation only — no paths, no user data | artifact lint | `pnpm --filter @fullselfbrowsing/concierge typecheck && pnpm build && pnpm run check:artifact && pnpm run check:deps && node -e "const s=require('fs').readFileSync('packages/concierge/dist/index.d.ts','utf8');const m=[...s.matchAll(/export\s*\{([^}]*)\}/g)];const names=m.flatMap(x=>x[1].split(',')).map(t=>t.trim().split(/\s+as\s+/).pop()).filter(Boolean);console.log('EXPORT_NAMES='+names.length);const need=['CONTRACT_VERSION','assertSingleInstance','MESSAGE_MAX_CHARS','USER_CANCELLED','USER_DECLINED','CONSENT_GRADE_ORDER'];const bad=['serverChallengeBrand','ConsentAckBase','ContractRecord','Holder'];process.exit(names.length===45&&need.every(n=>names.includes(n))&&bad.every(n=>!names.includes(n))?0:1)"` | ✅ | ✅ exit 0, `EXPORT_NAMES=45` (phase gate, 2026-07-29) |
| 02-07-T1 | 02-07 | 5 | PKG-04 | T-02-29 | pnpm test can no longer exit 0 with no tests | unit | `pnpm build && pnpm test single-instance && test "$(grep -v '^[[:space:]]*[/*]' packages/concierge/test/single-instance.test.ts \| grep -c '\.\./src/')" -eq 0 && grep -q '"test": "vitest run"' package.json && echo SINGLE_INSTANCE_OK` | ✅ | ✅ `SINGLE_INSTANCE_OK`, exit 0 (phase gate, 2026-07-29) — bare filter form, 1 file / 3 tests |
| 02-07-T2 | 02-07 | 5 | PKG-04 | T-02-32 | The export list is pinned by count and by name, and the vacuous check is recorded not written | unit | `pnpm build && pnpm test artifact && pnpm test export-surface && test "$(cat packages/concierge/test/artifact.test.ts packages/concierge/test/export-surface.test.ts \| grep -v '^[[:space:]]*[/*]' \| grep -c '\.\./src/')" -eq 0 && grep -q "ReadbackAttestation" packages/concierge/test/export-surface.test.ts && echo ARTIFACT_GUARDS_OK` | ✅ | ✅ `ARTIFACT_GUARDS_OK`, exit 0 (phase gate, 2026-07-29) |
| 02-07-T3 | 02-07 | 5 | PKG-04 | T-02-30 | The duplicate-instance guard is observed surviving tree-shaking | mutation | `bash scripts/mutate-and-prove.sh packages/concierge/src/contract.ts 'export const CONTRACT_VERSION = 1;' 'export const CONTRACT_VERSION = 0;' -- bash -c 'pnpm build && pnpm test single-instance'; test $? -eq 0 && git diff --exit-code && pnpm build && pnpm test && echo P7_PROVEN` | ✅ | ✅ `P7_PROVEN`, exit 0 (phase gate, 2026-07-29) — F2 the only failure under the bare filter form |
| 02-08-T1 | 02-08 | 6 | PKG-04 | T-02-37 | Both fixtures are private workspace members declaring core as a peer | integration | `pnpm install && test -e packages/concierge/test/fixtures/adapter-alpha/node_modules/@fullselfbrowsing/concierge && test -e packages/concierge/test/fixtures/adapter-beta/node_modules/@fullselfbrowsing/concierge && pnpm build && pnpm typecheck && pnpm test && node -e "for (const n of ['alpha','beta']) { const p=require('./packages/concierge/test/fixtures/adapter-'+n+'/package.json'); if(p.private!==true) process.exit(1); if(!p.peerDependencies\|\|!p.peerDependencies['@fullselfbrowsing/concierge']) process.exit(1); }" && echo FIXTURES_LINKED` | ✅ | ✅ `FIXTURES_LINKED`, exit 0 (phase gate, 2026-07-29) |
| 02-08-T2 | 02-08 | 6 | PKG-04 | T-02-35 | Two adapters resolve one physical copy and one function object | integration | `pnpm build && pnpm test fixtures && echo FIXTURES_TEST_OK` | ✅ | ✅ `FIXTURES_TEST_OK`, exit 0 (phase gate, 2026-07-29) — bare filter form, 1 file / 3 tests |
| 02-09-T1 | 02-09 | 6 | PKG-02 | T-02-40 | The scratch project installs the tarball, not the workspace copy, and fully checks the shipped .d.ts | integration | `pnpm run check:pack && bash scripts/mutate-and-prove.sh packages/concierge/test/fixtures/probe.ts 'export const n: 180 = MESSAGE_MAX_CHARS;' 'export const n: 181 = MESSAGE_MAX_CHARS;' -- pnpm run check:pack; test $? -eq 0 && git diff --exit-code && pnpm run check:pack && echo PKG02_OK` | ✅ | ✅ `PKG02_OK`, exit 0 (phase gate, 2026-07-29) |
| 02-09-T2 | 02-09 | 6 | PKG-03 | T-02-42 | The floor is verified on an exact pinned v22.12.0, not the developer's runtime | integration | `pnpm run check:node-floor && echo PKG03_OK` | ✅ | ✅ `PKG03_OK`, exit 0 (phase gate, 2026-07-29) — printed `v22.12.0` against the developer's `v24.14.1` |
| 02-09-T3 | 02-09 | 6 | PKG-03 | T-02-43 | The floor job is observed failing, so a green floor means something | integration | `pnpm build && pnpm run check:node-floor && git diff --exit-code && echo P10_BASELINE_GREEN` | ✅ | ✅ `P10_BASELINE_GREEN`, exit 0 (phase gate, 2026-07-29) |
| 02-10-T1 | 02-10 | 7 | PKG-02, PKG-03 | T-02-49 | CI installs frozen and typechecks before building, on two pinned runtimes | static review | `test -f .github/workflows/ci.yml && grep -q "pnpm typecheck" .github/workflows/ci.yml && grep -q "check:pack" .github/workflows/ci.yml && grep -q "frozen-lockfile" .github/workflows/ci.yml && test "$(grep -v '^[[:space:]]*#' .github/workflows/ci.yml \| grep -c 'node-version:')" -eq 2 && grep -v '^[[:space:]]*#' .github/workflows/ci.yml \| grep -q "node-version: 24" && grep -v '^[[:space:]]*#' .github/workflows/ci.yml \| grep -q "node-version: '22.12.0'" && test "$(awk '/node-floor:/,0' .github/workflows/ci.yml \| grep -v '^[[:space:]]*#' \| grep -c pnpm)" -eq 0 && grep -q "scripts/node-floor-check.sh" .github/workflows/ci.yml && echo CI_STATIC_OK` | ✅ | ✅ `CI_STATIC_OK`, exit 0 (phase gate, 2026-07-29) |
| 02-10-T2 | 02-10 | 7 | PKG-01 | T-02-46 | Publishing is OIDC-only with no NPM_TOKEN, so provenance cannot silently degrade | static review | `node -e "JSON.parse(require('fs').readFileSync('.changeset/config.json','utf8'))" && node -e "const c=require('./.changeset/config.json');process.exit(Array.isArray(c.ignore)&&c.ignore.length===0&&c.privatePackages===false?0:1)" && { pnpm exec changeset status > /tmp/changeset-status.log 2>&1 \|\| true; } && ! grep -q 'concierge-fixture-' /tmp/changeset-status.log && grep -q "id-token: write" .github/workflows/release.yml && grep -q "fetch-depth: 0" .github/workflows/release.yml && test "$(grep -rIh 'NPM_TOKEN' .github/ \| grep -v '^[[:space:]]*#' \| grep -cE 'NPM_TOKEN[[:space:]]*[:=]\|secrets\.NPM_TOKEN')" -eq 0 && grep -q 'NPM_TOKEN' .github/workflows/release.yml && test "$(grep -v '^[[:space:]]*#' .github/workflows/release.yml \| grep -cE -- '--provenance\|auth-token-line')" -eq 0 && grep -q "attestation" RELEASING.md && echo RELEASE_STATIC_OK` | ✅ | ✅ `RELEASE_STATIC_OK`, exit 0 (phase gate, 2026-07-29) — **static review only**; the workflow has never executed, see § Manual-Only Verifications |
| 02-10-T3 | 02-10 | 7 | PKG-01 | T-02-SC | The second build toolchain is pinned and the build stays decentralized | static review | `grep -q "svelte-package" CONTRIBUTING.md && grep -q "not centralized" CONTRIBUTING.md && grep -q "pnpm typecheck && pnpm build && pnpm test" CONTRIBUTING.md && grep -q "@sveltejs/package" pnpm-workspace.yaml && grep -q "catalog:" pnpm-workspace.yaml && test ! -d packages/concierge-svelte && pnpm install --frozen-lockfile && pnpm typecheck && pnpm build && pnpm test && echo TOOLCHAIN_DOC_OK` | ✅ | ✅ `TOOLCHAIN_DOC_OK`, exit 0 (phase gate, 2026-07-29) |
| 02-11-T1 | 02-11 | 7 | PKG-01 | T-02-55 | The value-export guard reads the public entrypoint, the module the regression is visible in | type | `pnpm --filter @fullselfbrowsing/concierge typecheck && grep -q 'from "../src/index.js"' packages/concierge/test-d/exports.test-d.ts && test "$(grep -cE '^import .*\.\./src/types\.js' packages/concierge/test-d/exports.test-d.ts)" -eq 0 && grep -q 'results.test-d.ts' packages/concierge/test-d/exports.test-d.ts && test -z "$(grep -l '^[[:space:]]*export' packages/concierge/test-d/exports.test-d.ts)" && echo EXPORTS_GUARD_OK` | ✅ | ✅ `EXPORTS_GUARD_OK`, exit 0 (phase gate, 2026-07-29) |
| 02-11-T2 | 02-11 | 7 | PKG-01 | T-02-57 | The M9 regression gets a named detector, not a lone unused-directive symptom | type | `pnpm --filter @fullselfbrowsing/concierge typecheck && grep -q "_policyNotBivariant" packages/concierge/test-d/consent-variance.test-d.ts && test "$(grep -c '@ts-expect-error' packages/concierge/test-d/actions.test-d.ts)" -eq 2 && test -z "$(grep -F 'single symptom' packages/concierge/test-d/consent.test-d.ts)" && git diff --exit-code packages/concierge/test-d/actions.test-d.ts packages/concierge/src/types.ts && echo M9_DETECTOR_OK` | ✅ | ✅ `M9_DETECTOR_OK`, exit 0 (phase gate, 2026-07-29) |
| 02-11-T3 | 02-11 | 7 | PKG-01 | T-02-56 | Both new guards are observed firing with their measured diagnostics | mutation | `bash scripts/mutate-and-prove.sh packages/concierge/src/types.ts '  snapshotEquality?: (a: Snapshot, b: Snapshot) => boolean;' '  snapshotEquality?(a: Snapshot, b: Snapshot): boolean;' -- pnpm typecheck 2>&1 \| tee /tmp/p9.log; grep -q "PASS: gate fired" /tmp/p9.log && grep -q "TS2344" /tmp/p9.log && grep -q "_policyNotBivariant" /tmp/p9.log && git diff --exit-code && echo P9_PROVEN` | ✅ | ⚠️ exit 1 — the mutant **fires** and both diagnostics reproduce (`TS2344` at `consent-variance.test-d.ts(76,35)`, `TS2578` at `actions.test-d.ts(162,3)`); only the third grep fails, because `tsc` echoes source text solely under `--pretty`, which is off through a pipe and suppressed entirely by pnpm's TTY reporter. Green — including `_policyNotBivariant` echoed — with `--pretty` on the gate. **Any criterion that greps typecheck output for an alias name is renderer-conditioned; grep the `file:line` instead** |
| 02-12-T1 | 02-12 | 8 | PKG-01 … PKG-05 | T-02-60 | The phase is green from a clean checkout with an empty working tree | integration | `rm -rf packages/concierge/dist node_modules packages/concierge/node_modules packages/concierge/test/fixtures/*/node_modules && pnpm install --frozen-lockfile && pnpm typecheck && pnpm build && pnpm test && pnpm run check:artifact && pnpm run check:deps && pnpm run check:pack && pnpm run check:node-floor && test -z "$(git status --porcelain)" && echo PHASE_GATE_GREEN` | ✅ | ✅ `PHASE_GATE_GREEN`, exit 0 (2026-07-29) — eight commands green from a genuinely empty `node_modules`/`dist`, `git status --porcelain` empty |
| 02-12-T2 | 02-12 | 8 | PKG-01 … PKG-05 | T-02-59 | Every gate is re-proven on the finished phase, not only when it was written | mutation | `pnpm build && bash scripts/mutate-and-prove.sh packages/concierge/src/types.ts 'export const MESSAGE_MAX_CHARS = 180;' 'export const MESSAGE_MAX_CHARS: 181 = 180;' -- bash -c 'pnpm build; echo BUILD_EXIT=$?; pnpm typecheck' 2>&1 \| tee /tmp/gate-p4.log; grep -q "BUILD_EXIT=0" /tmp/gate-p4.log && grep -q "PASS: gate fired" /tmp/gate-p4.log && git diff --exit-code && pnpm build && pnpm test && echo P4_REPROVEN` | ✅ | ✅ `P4_REPROVEN`, exit 0 (2026-07-29) |
| 02-12-T3 | 02-12 | 8 | PKG-01 … PKG-05 | T-02-63 | Sign-off records observed exit codes, and the manual-only row stays manual | static review | `grep -q "^nyquist_compliant: true" .planning/phases/02-packaging-build-and-release/02-VALIDATION.md && grep -q "^status: complete" .planning/phases/02-packaging-build-and-release/02-VALIDATION.md && test -z "$(grep -F '⬜ pending' .planning/phases/02-packaging-build-and-release/02-VALIDATION.md)" && test -z "$(grep -F 'Approval:** pending' .planning/phases/02-packaging-build-and-release/02-VALIDATION.md)" && test "$(grep -rIh -- '--watch' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.planning . \| grep -v '^[[:space:]]*[#/*]' \| grep -c -- '--watch')" -eq 0 && git diff --stat --name-only \| grep -qx ".planning/phases/02-packaging-build-and-release/02-VALIDATION.md" && echo SIGNOFF_OK` | ✅ | ⚠️ exit 1 — substance verified clause by clause (`nyquist_compliant: true` ✓, `status: complete` ✓, zero `⬜ pending` **Status cells** ✓, `Approval:` approved ✓, zero `--watch` in any repo-owned file ✓, diff confined to this file ✓); the command cannot self-report green, for defects (2) and (3) above |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Test Map (from RESEARCH.md)

| Req ID | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| **PKG-01a** | `publint` reports no errors on the packed artifact | artifact lint | `pnpm --filter @fullselfbrowsing/concierge exec publint --strict` | ✅ (Wave 1) |
| **PKG-01b** | `attw` reports no errors under the ESM-only profile | artifact lint | `attw --pack packages/concierge --profile esm-only` | ✅ (Wave 1) |
| **PKG-01c** | Both gates fail the **build** when the manifest is wrong | build gate | `pnpm build` with `attw: {level:"error", profile:"esm-only"}` | ✅ (Wave 1) |
| **PKG-01d** | A typecheck failure cannot pass the build — `tsc --noEmit` fires while `tsdown` does not | **structural, mutation-only** | `mutate-and-prove.sh … -- pnpm typecheck`, then assert `pnpm build` exits 0 on the same mutant | ✅ (Wave 1) |
| **PKG-02** | A scratch project outside the repo installs the tarball, imports it, typechecks against the shipped `.d.ts` with `skipLibCheck: false` | integration (shell) | `pnpm run check:pack` | ✅ (Wave 3) |
| **PKG-03a** | The artifact imports and executes on **exactly** Node v22.12.0 | integration (pinned runtime) | `pnpm run check:node-floor` | ✅ (Wave 3) |
| **PKG-03b** | The floor job is genuinely pinned, not merely "some Node 22" | assertion inside the job | `node -e "if(process.version!=='v22.12.0') throw …"` | ✅ (Wave 3) |
| **PKG-04a** | Two independently-evaluated copies of the built artifact share one registry record | unit (Vitest, against `dist/`) | `pnpm test single-instance` | ✅ (Wave 2) |
| **PKG-04b** | A contract-version mismatch throws, naming both versions and the fix | unit (Vitest) | same | ✅ (Wave 2) |
| **PKG-04c** | Two workspace fixture adapters with core as a peer resolve to one physical copy | integration (install graph) | `pnpm test fixtures` | ✅ (Wave 2) |
| **PKG-04d** | The package publishes ESM-only | artifact | covered by PKG-01b (`--profile esm-only` + `format: ["esm"]`) | ✅ (Wave 1) |
| **PKG-05a** | The built artifact's bundle graph contains no `node_modules` module and no unbundled external import | artifact (module graph) | `pnpm run check:deps` | ✅ (Wave 2) |
| **PKG-05b** | Every entry in `dependencies` resolves to a 0-byte ESM runtime entry | manifest + file size | same script, second assertion | ✅ (Wave 2) |
| *(deferral)* | `MESSAGE_MAX_CHARS` is exported from `src/index.ts` as a **value** | type (TS1485) | `pnpm --filter … typecheck` | ✅ `test-d/exports.test-d.ts` (Wave 7) |
| *(deferral)* | `snapshotEquality` keeps function-property syntax (M9), with a **named** detector | type (TS2344) | same | ✅ `test-d/consent-variance.test-d.ts` (Wave 7) |
| *(artifact)* | The shipped `dist/index.d.ts` export list is exactly **39 types + 6 values = 45 names in 1 export block** and excludes `serverChallengeBrand` / `ConsentAckBase` **from the export list** | unit (parse the artifact) | `pnpm test export-surface` | ✅ (Wave 2) |
| *(artifact)* | Value exports survive into `dist/index.js` at their expected values | unit (Vitest, against `dist/`) | `pnpm test artifact` | ✅ (Wave 2) |

**The `39 types + 4 values` this row used to read was correct when 02-03 measured it and stale from
Wave 4 onward.** `src/contract.ts` (plan 02-06) added `CONTRACT_VERSION` and `assertSingleInstance`,
both values. Re-measured on the finished phase by parsing the built `dist/index.d.ts`: **1** trailing
`export { … }` block, **45** names, **39** type-prefixed, **6** plain — `CONSENT_GRADE_ORDER`,
`CONTRACT_VERSION`, `MESSAGE_MAX_CHARS`, `USER_CANCELLED`, `USER_DECLINED`, `assertSingleInstance`.
Independently measured at 45 by plans 02-06, 02-07 and 02-11.

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
| P6 | `assertSingleInstance` moved to module scope | `pnpm test single-instance` against `dist/` | the registry is absent from the bundle; F1 fails |
| P7 | `CONTRACT_VERSION` bumped in one of two loaded copies | F2 | throws, message matches `/two different copies/` and `/peerDependency/` |
| P8 | `MESSAGE_MAX_CHARS` moved into `index.ts`'s type-export block | `pnpm typecheck` | `TS1485` at the import line of `exports.test-d.ts` |
| P9 | `snapshotEquality` → method syntax | `pnpm typecheck` | `TS2344` naming `_policyNotBivariant` |
| P10 | a source feature newer than the floor (`Promise.try`) | `check:node-floor` | passes on v24.14.1, fails on v22.12.0 |
| P11 | `MESSAGE_MAX_CHARS` dropped from `index.ts`'s export list | `pnpm test export-surface` | 42 names instead of 43 *(finished phase: **44 against 45** — `src/contract.ts` added `CONTRACT_VERSION` and `assertSingleInstance` to the surface after this signature was measured. The invariant proven is the identical −1 delta)* |

**P4, P6 and P10 cannot be skipped.** Each proves a claim that is *only* structural, and each is
invisible to every other check in the suite.

### Phase-gate re-run — 2026-07-29

**All eleven mutants were re-run consecutively on the finished phase, in ascending order across
thirteen invocations (P1, P2, P3a, P3b, P4, P5a, P5b, P6, P7, P8, P9, P10, P11); every one produced a
non-zero exit from its named gate, no invocation aborted with exit 2 or 3, and `git diff --exit-code`
at the repo root was asserted clean after each — not only at the end.** `P4`, `P6` and `P10` were each
run and each fired; none was skipped. Signatures observed at the gate:

| # | Harness | Signature reproduced |
|---|---|---|
| P1 | `PASS: gate fired (exit 1), tree clean` | `ERROR [publint] pkg.exports["."].types is ./dist/nope.d.ts but the file does not exist.` **and** `ERROR [attw] problems found` |
| P2 | `PASS`, exit 0 | publint on the **packed tarball**: **2** errors, exit 1 — see the note below |
| P3a | `PASS`, exit 0 | publint **exactly 2** errors, exit 1 (`pkg.main` and `pkg.exports["."].default` ESM-in-CJS) |
| P3b | `PASS`, exit 0 | attw exit 1, `🚭 Unexpected module syntax` on `node16 (from ESM)` |
| **P4** | `PASS`, exit 0 | **`BUILD_EXIT=0`** with attw and publint both clean, `TS2322` at `src/types.ts(279,14)` |
| P5a | gate exit **1**, repo never mutated | 1 vendored module under `node_modules` + `node:url` external; **Assertion A** named |
| P5b | `PASS`, exit 0 | **Assertion B** names `typescript`, resolved path, **113 bytes** > 0 |
| **P6** | `PASS`, exit 0 | 1 file / 3 tests; **F1b** fails (`expected … not to contain '@fullselfbrowsing/concierge.contract'`) **with F2 alongside it**, F1a passes |
| P7 | `PASS`, exit 0 | **F2** the sole failure: `expected [Function] to throw an error` |
| P8 | `PASS`, exit 0 | `BUILD_EXIT=0` (`dist/index.js` 9.74 → 9.14 kB, attw + publint silent), `ARTIFACT_EXIT=1`, `TS1485` at `exports.test-d.ts(52,10)`, `results.test-d.ts` named **0** times |
| P9 | `PASS`, exit 0 | `TS2344` at `consent-variance.test-d.ts(76,35)` **and** `TS2578` at `actions.test-d.ts(162,3)`, `Found 2 errors in 2 files` |
| **P10** | `PASS`, exit 0 | **`DEV_EXIT=0`** on v24.14.1, floor job exit 1: `TypeError: Promise.try is not a function` at `assertSingleInstance`, footer `Node.js v22.12.0` |
| P11 | `PASS`, exit 0 | **44 names against an expected 45**, plus the 39/6 split going 39/5 and the by-name guard |

**P6's second failure is expected, not an anomaly.** Under the module-scope mutant the registration
runs during *module evaluation*, so the dynamic import rejects before `expect(() => …).toThrow()` can
execute; F2 therefore fails alongside F1b. F1a passes, which is the whole reason F1b exists — the
module-scope form still registers under Node, so F1a is structurally blind to the regression.

**P2's count is 2, not the 4 recorded above, and this is a correction rather than drift.** Plan 02-04
measured 2 and escalated it; the phase gate reproduces 2 (`pkg.types` and `pkg.exports["."].types`
both "not published"). The measured signature in the table is left as first recorded; the finished-phase
number is 2.

**Two harness caveats, both measured at the gate and both left as findings rather than silently
worked around:**

1. `scripts/mutate-and-prove.sh` prints `tree clean` while the repository is dirty whenever the gate
   command triggers a `pnpm install`. Its `trap` restores **its target file** and verifies that one
   file; pnpm 11 auto-installs before running a script when a workspace manifest changed, so the
   lockfile is rewritten **outside** that scope. Reproduced at the gate by P5b, which rewrote
   `pnpm-lock.yaml` (`+3` lines, `typescript: 7.0.2`) behind a `PASS` line. Restored file-scoped with
   `git checkout -- pnpm-lock.yaml`, never a blanket reset, clean or stash. **Plan 02-05 found this in
   Wave 3, not 02-08 in Wave 6** — 02-05's `affects` names "02-04, 02-09, 02-12 — every plan that
   mutates a manifest and gates with `pnpm run`", and it also found the *preventive* remedy:
   `pnpm --config.verify-deps-before-run=false run <script>` as the gate, which the gate re-verified
   here (lockfile byte-identical, `P5B_PROVEN`). 02-08's remedy — capture `git status --porcelain`
   before the mutation and compare after the restore — is the *detective* half. Both are wanted; the
   published five-code exit table is a contract, so this is a precondition change, not a sixth code.
2. `CI=true` / `--frozen-lockfile` is **not** a substitute: the pre-run install would fail before the
   gate ever runs, and the harness would report `PASS: gate fired` on a proof that never executed.
   That is the vacuously-green failure the harness exists to prevent.

### The tree-shaking pair — the one measurement two SUMMARYs both carry

Plans 02-06 and 02-07 were each required to record it in identical wording so that a contradiction
would be visible. **They agree, byte for byte** — one occurrence each, the same blockquote:

> **63 B uncalled / 587 B called — the registry code itself contributes 0 bytes when uncalled.**

`02-06-SUMMARY.md:205` and `02-07-SUMMARY.md:171`. No disagreement to record. The zero being claimed
is the *registry code's* contribution, not the bundle's total; 63 B is the floor a bundle costs for
the constant it does import.

Beside it, the two byte lengths F1b actually emitted on 02-07's tree — labelled separately and **not**
a substitute for the pair: `calls.mjs` **3,942 B** (902 B non-comment, registry key present),
`uncalled.mjs` **852 B** (292 B non-comment, registry key absent). 02-06's own re-measurement through a
bare specifier is a third shape again (15 B / 918 B of code). The three differ because the consumer
shapes differ; the load-bearing fact is identical in all three and is the only thing F1b asserts —
**the registry key is absent from the uncalled bundle and present verbatim in the calling one.**

---

## Wave 0 Requirements

This phase introduces the test runner, so the gaps are real and large. Nothing in the runtime-test
column exists today.

**Fully resolved at the phase gate, 2026-07-29.** Every box below was verified on disk, not from the
plan that promised it. One box is deliberately *not* ticked and carries its reason instead.

- [x] `vitest@4.1.10` — root `devDependencies`, exact
- [x] `tsdown@0.22.14`, `publint@0.3.22`, `@arethetypeswrong/cli@0.18.5`, `@changesets/cli@2.31.1` — all four exact
- [x] `typescript` `^5.7.0` → `7.0.2` exact
- [x] `packageManager: "pnpm@11.17.0"` — landed as its own commit for the lockfile churn
- [x] `vitest.config.ts` (root) — `test.projects` with one `node` project, typecheck mode off (the token appears on 8 lines, all comments)
- [x] `packages/concierge/tsdown.config.ts` — `publint: { level: "error" }` and `attw: { level: "error", profile: "esm-only" }`
- [x] `packages/concierge/package.json` — `build` script added. **`test` script deliberately NOT added**, and this is the one box that is annotated rather than ticked: Vitest resolves its config from the working directory and does **not** search upward, so a `vitest run` executed inside `packages/concierge` would never find the root config. The root script is `vitest run`; `packages/concierge/package.json` is byte-unchanged on this point (plan 02-07)
- [x] `packages/concierge/LICENSE` — present, byte-identical to the root `LICENSE`
- [x] `packages/concierge/src/contract.ts` — `CONTRACT_VERSION` + `assertSingleInstance`, zero imports
- [x] `packages/concierge/test/single-instance.test.ts` — PKG-04a/b (F1a, F1b, F2)
- [x] `packages/concierge/test/artifact.test.ts` — value exports. The export-surface count landed in its own file, `packages/concierge/test/export-surface.test.ts`, which is why P8 (a *moved* export) and P11 (a *dropped* one) are separable
- [x] `packages/concierge/test/fixtures/adapter-alpha|beta/` — PKG-04c, both `private: true`, both real workspace members
- [x] `packages/concierge/test/fixtures/probe.ts` — the PKG-02 scratch probe
- [x] `packages/concierge/test-d/exports.test-d.ts` — `MESSAGE_MAX_CHARS` guard, importing `../src/index.js`
- [x] `packages/concierge/test-d/consent-variance.test-d.ts` — added beyond this list: M9's second, *named* detector
- [x] `scripts/pkg05-zero-runtime-deps.mjs` — PKG-05
- [x] `scripts/pack-install-check.sh` — PKG-02
- [x] `scripts/node-floor-check.sh` — PKG-03
- [x] `scripts/mutate-and-prove.sh` — the defect-first / mutation-hygiene harness, executable
- [x] `.changeset/config.json` — strict JSON, explicit empty `ignore: []`, `privatePackages: false`
- [x] `.github/workflows/ci.yml` and `.github/workflows/release.yml` — both exist; `release.yml` **ships unexecuted**
- [x] `pnpm-workspace.yaml` — `catalog:` pins `svelte: ^5.0.0` and `@sveltejs/package: ^2.5.8`
- [x] A written build-toolchain constraint (tsdown vs `svelte-package`) — `CONTRIBUTING.md § Non-negotiables`
- [x] **No placeholder `packages/concierge-svelte/` was created, deliberately.** The written constraint
  and the catalog pin *are* the scaffolding (research's options 1 and 2, explicitly not option 3). An
  empty package would be a fourth workspace member with no manifest anyone had reason to keep correct.
  Verified absent: `test ! -d packages/concierge-svelte` exits 0

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The OIDC release workflow publishes correctly | PKG-01 (release path) | **Nothing publishes until v0.1 completes**, so the workflow cannot be executed in this phase | Static review against: pnpm ≥ 11.1.3, npm ≥ 11.5.1, Node ≥ 22.14.0, `permissions: { id-token: write }`, no `NPM_TOKEN`, `fetch-depth: 0` |

**The table above still has exactly one row, and it still says the workflow cannot be executed in
this phase.** Nothing was promoted out of it, and its status was not changed to anything that reads as
executed.

### Static-review outcome (this is not a second manual-only row)

Plan 02-10 performed the static review of the six named properties. **Every one of the six is an
inspection or a `grep`. None of them is a run.** The workflow's first real execution on GitHub will be
its first genuine test.

| # | Property | Outcome (plan 02-10, re-run at the phase gate) |
|---|---|---|
| S1 | `permissions.id-token: write` present | **1 line** in `release.yml` |
| S2 | no `NPM_TOKEN` assigned or referenced under `.github/` | **0** on any non-comment line; `grep -q 'NPM_TOKEN' release.yml` still succeeds against **2 comment lines** that record the prohibition |
| S3 | no `--provenance` on an executable line | **0** — attestations are automatic for public repos on GitHub Actions |
| S4 | no `auth-token-line` on an executable line | **0** |
| S5 | `fetch-depth: 0` present | **2 lines** (one executable, one in the comment explaining it) |
| S6 | `node-version: 24` on the release job | **1 line** |

Version floors verified by inspection, not by running: pnpm ≥ **11.1.3** (below it, `pnpm publish`
returns a 404 on the PUT under OIDC because `actions/setup-node` writes an unresolved
`${NODE_AUTH_TOKEN}` placeholder into `.npmrc` — *after* provenance signing appears to succeed),
npm ≥ **11.5.1**, Node ≥ **22.14.0**. The first-publish checklist, the provenance of each floor, the
npm-side trusted-publisher binding, and the rule that **a successful publish without an attestation
is a FAILED publish** are in **`RELEASING.md`**, which also links `CONTRIBUTING.md § Changesets and
the ignore list`. Registered as accepted threat **T-02-53**.

### Two vacuous assertions — named, and counted nowhere

**Recorded honestly rather than dressed up as automated.** Neither of the following is counted
anywhere in this document as a passing check.

1. **`ReadbackAttestation` is unexported — vacuous.** The identifier has **0** occurrences in
   `src/types.ts` and **0** in `dist/index.d.ts`. It does not exist. A guard asserting it is not
   exported would pass while testing nothing, which is why plan 02-07 documented it in
   `export-surface.test.ts`'s header and **deliberately did not write it**: `grep -c
   "expect(.*ReadbackAttestation"` returns **0**, against 2 comment mentions.
2. **`serverChallengeBrand` and `ConsentAckBase` must be asserted absent from the trailing export
   list only — never from the file.** Both are **present** in `dist/index.d.ts` as declarations,
   because rolldown bundles the whole declaration file and only the trailing `export { … }` defines
   the public surface. Measured at the phase gate: each is `declared in file = true`, `in export list
   = false`. **A file-absence assertion would fail on a correct artifact** — the opposite failure mode
   from (1), and the more dangerous one, because it would look like a real regression.
   `export-surface.test.ts` asserts against the parsed export list, which is correct.
   (`ContractRecord` and `Holder` are a third case again: rolldown drops them from the `.d.ts`
   entirely, so both readings agree.)

### The third honest limit — `assertSingleInstance` has no production call site

**PKG-04's runtime enforcement is proven by test, not active in product.** `assertSingleInstance` is
called by nothing outside the test suite in this phase. Plan 02-06 records the intended call sites —
`createConcierge`, and each adapter's registration hook — **in a doc comment only**; the runtime that
would call them lands in Phases 3–8.

Stated plainly, because this is exactly the overclaim class this phase's standard exists to prevent:
**two copies of core in a real application today would *not* fail loudly, because nothing calls the
check.** SC-4's "fails loudly" is demonstrated by fixture **F2** and mutant **P7** exercising
`assertSingleInstance` directly against the built artifact — not by the guard firing on its own in a
consumer. What the evidence covers is that the mechanism is correct, reachable, survives
tree-shaking (F1b), and is shared across two peer-declaring workspace adapters (F3a/F3b/F3c). What it
does not cover is that anything invokes it. This belongs beside the OIDC row rather than being
discovered in Phase 3.

---

## Validation Sign-Off

- [x] **All tasks have `<automated>` verify or Wave 0 dependencies** — all **31** tasks carry an
  `<automated>` block; every one was extracted from this table and executed at the phase gate. 26
  exited 0; the 5 that did not are ⚠️ with the reason in their Status cell, and in every one of those
  5 the *substance* was verified by a corrected form of the same command.
- [x] **Sampling continuity: no 3 consecutive tasks without automated verify** — the longest run
  without one is **0**. Every task in every wave has an automated command.
- [x] **Wave 0 covers all MISSING references** — the § Wave 0 Requirements checklist is fully
  resolved above, verified on disk item by item. The single unticked box (`test` script in
  `packages/concierge/package.json`) carries its reason and is a deliberate omission, not a gap.
- [x] **No watch-mode flags (Vitest must run with `--run`)** — root `scripts.test` is exactly
  `vitest run`. `git grep -i watch -- ':!.planning'` returns **nothing at all**: no `--watch`, no
  `watchOptions`, no watch token of any kind on any line — comment or executable — in any script,
  workflow, config or test file this repository owns. See defect (3) above for why the criterion's own
  command counts 72 instead of 0.
- [x] **Feedback latency < 2 s for the inner loop** — measured on the finished phase:
  `pnpm --filter @fullselfbrowsing/concierge typecheck` **0.45 s** wall (bare `tsc -p
  tsconfig.test-d.json` **0.11–0.15 s**), against a 2 s budget. Recorded honestly: the *full* chained
  suite `pnpm typecheck && pnpm build && pnpm test` is **2.71 s**, over the < 2 s estimate in the Test
  Infrastructure table, because `pnpm -r` startup is paid three times. The criterion is about the inner
  loop and the inner loop passes; the full-suite estimate has been corrected rather than defended.
- [x] **All 11 mutants observed failing, each restored in-call, `git diff --exit-code` clean after
  each** — thirteen invocations on 2026-07-29, every one non-zero from its named gate, no exit 2 and no
  exit 3, tree asserted clean after **each** invocation rather than only at the end. P4, P6 and P10
  each run and each fired. Full table in § Suite Adequacy Requirement.
- [x] **`nyquist_compliant: true` set in frontmatter** — set, alongside `status: complete`.

**What this sign-off does not claim.** Three things, each recorded above rather than here:
`.github/workflows/release.yml` has **never executed** and its verification is six static checks; two
assertions are **vacuous** and are counted nowhere; and `assertSingleInstance` has **no production
call site**, so PKG-04's runtime enforcement is proven by test and is not yet active in product.

**Approval:** approved — 2026-07-29, at the phase gate, on the evidence recorded in this document and
in `02-12-SUMMARY.md`.
