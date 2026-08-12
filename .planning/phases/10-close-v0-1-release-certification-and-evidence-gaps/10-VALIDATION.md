---
phase: 10
slug: close-v0-1-release-certification-and-evidence-gaps
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for closing the v0.1 milestone audit on one exact, pre-publication candidate commit.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 across the core Node, built-artifact/SSR, React jsdom, and Svelte jsdom projects; TypeScript 7.0.2 type checks; Phase 9 mutation/release generators; GitHub Actions hosted Ubuntu jobs; GSD validation, verification, and milestone-audit handlers |
| **Config file** | `vitest.config.ts`, root/package `package.json` scripts, `.github/workflows/ci.yml`, `.github/workflows/release.yml` |
| **Quick run command** | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/dispatcher-batch.test.ts packages/concierge/test/session-consent.test.ts packages/concierge/test/session-lifecycle.test.ts packages/concierge/test/catalog.test.ts packages/concierge/test/concierge.test.ts && pnpm --filter @fullselfbrowsing/concierge typecheck` |
| **Full suite command** | `corepack pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm run check:phase09:release` |
| **Estimated runtime** | ~3 minutes focused; ~20 minutes for the local release gate, excluding Phase 9 finalization and hosted CI |

---

## Sampling Rate

- **After every runtime task commit:** Run the quick core build, focused runtime suites, and core typecheck.
- **After every release/evidence task commit:** Run the affected script self-test/static checker plus `node scripts/phase-09-mutation-battery.mjs verify all`; do not finalize versioned evidence until tracked inputs are frozen.
- **After every plan wave:** Run the full clean-checkout-ordered suite: frozen install, build, aggregate typecheck, tests, and Phase 9 release check.
- **Before `$gsd-verify-work`:** Finalize and verify Phase 9 evidence, validate Phase 9 and Phase 10 records, regenerate the milestone audit, and require the full suite to be green.
- **Final candidate gate:** From a clean commit, require an exact-head-SHA successful hosted GitHub Actions run and a matching run-scoped receipt; no tracked file may change afterward.
- **Max focused feedback latency:** 180 seconds. Long mutation, release, audit, and hosted gates run at wave or phase boundaries rather than replacing focused task feedback.

---

## Security Validation Boundaries

| Threat Ref | Threat | Required proof |
|------------|--------|----------------|
| T-10-01 | A terminal result or an earlier row from the same batch reaches the agent | Private terminal outcome is checked before the response loop; the public batch is empty and the session records zero response attempts |
| T-10-02 | A later call or queued occurrence enters work after terminal handler entry | Serial break, admission latch, and existing stop/drain cancellation are covered by success, failure, throw, reject, and queued-work tests plus named mutants |
| T-10-03 | Terminal teardown awaits its own active pump and deadlocks | Stop state begins synchronously after the outcome barrier, but the current pump does not await its cached drain promise; identity and eventual-settlement tests remain green |
| T-10-04 | Ambient pnpm configuration is mistaken for authenticated mutation-child authority | Exact benign `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` is consumed and stripped; wrong values, case-folded duplicates, caller-selected stores, credentials, and unmarked authority remain rejected |
| T-10-05 | Accessor-bearing or mutable schema input crosses the SEC-03 catalog boundary | Current-byte S15a/S15b/S15c probes prove accessors never execute and catalog schemas are detached; stale evidence is corrected without weakening the implementation |
| T-10-06 | Generated `.astro/` state contaminates tracked release inputs or seals | Disposable checkout starts without `.astro/`, pinned check/build regenerates it, Git tracks zero harness-local generated paths, and no generated declaration byte enters the seal |
| T-10-07 | Certification evidence names a different SHA than the hosted workflow executed | Receipt records exact repository, workflow, head SHA, run ID, attempt, conclusion, and job conclusions; no post-run tracked commit is allowed |
| T-10-08 | OIDC authority leaks outside the separately approved publish ceremony | Static workflow checks keep `id-token: write` scoped to the publish job, prohibit long-lived npm tokens and checkout in publish, and Phase 10 performs no registry publication |

---

## Per-Task Verification Map

The task IDs below are the research projection. The planner must either preserve them or update this table before execution so every final task has one automated sampling row. Phase 10 has no newly assigned formal requirement IDs; `Audit 1` through `Audit 9` refer to the numbered closure list in `.planning/v0.1-MILESTONE-AUDIT.md`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | Audit 3 | T-10-01 / T-10-02 / T-10-03 | Handler entry commits terminality; the whole occurrence is response-silent; outcome precedes nonblocking stop | unit + integration + type + mutation | Quick run command plus terminal named mutants | ❌ W0 cases | ⬜ pending |
| 10-02-01 | 02 | 1 | Audit 4 | T-10-05 / — | Null or unreadable declarations enter the aggregate index-addressed actionable diagnostic channel | unit + type + mutation | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/catalog.test.ts && pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ W0 cases | ⬜ pending |
| 10-02-02 | 02 | 1 | Audit 5 | T-10-05 | Explicit and derived schemas are detached and accessors never execute | focused unit + independent evidence | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/concierge.test.ts -t 'S15[abc]'` | ✅ tests; ❌ correction record | ⬜ pending |
| 10-03-01 | 03 | 1 | Audit 1 | T-10-04 | Ordinary pnpm decoration is accepted only at the parent boundary and stripped from ordinary children; hostile authority remains rejected | script self-test + integration + mutation | `pnpm run check:phase09:packages` plus package-check self-tests and the registered negative mutant | ❌ W0 cases | ⬜ pending |
| 10-03-02 | 03 | 1 | Audit 2 | Astro state regenerates from pinned inputs but remains untracked and unsealed | clean-checkout integration | `test ! -e examples/adapter-ssr/.astro && pnpm --filter @fullselfbrowsing/concierge-adapter-ssr check && pnpm --filter @fullselfbrowsing/concierge-adapter-ssr build && test -z "$(git ls-files -- examples/adapter-ssr/.astro)"` | ❌ W0 assertions | ⬜ pending |
| 10-04-01 | 04 | 2 | Audit 9 | T-10-07 / T-10-08 | Clean hosted jobs build before aggregate typecheck and preserve release/OIDC negative controls | static + negative fixture + hosted CI | `node scripts/phase-09-workflow-check.mjs` followed at the phase gate by exact-SHA `gh run` verification | ❌ corrected fixtures/receipt | ⬜ pending |
| 10-05-01 | 05 | 2 | Audit 6 / Audit 7 | T-10-05 / T-10-06 | One generator-owned input model produces canonical Phase 9 validation and independent verification without changing inherited Phase 8 seals | generator verification + phase verification | `node scripts/phase-09-mutation-battery.mjs finalize versioned --jobs 4 && node scripts/phase-09-mutation-battery.mjs verify all && pnpm run check:phase09:release` | ❌ canonical records | ⬜ pending |
| 10-06-01 | 06 | 3 | Audit 8 | — | Historical records receive explicit addenda, missing requirement metadata is backfilled, and registered handlers synchronize ROADMAP/STATE | metadata + static audit | Frontmatter parse, `gsd-sdk query phases.list`, decision/requirement coverage handlers, and milestone audit | ❌ addenda/metadata | ⬜ pending |
| 10-07-01 | 07 | 4 | Audit 9 | T-10-07 / T-10-08 | Final bytes produce Phase 10 validation/verification, 62/62 requirements, 9/9 implementation phases and 10/10 phase directories, 12/12 integrations, 10/10 flows, then one exact-SHA hosted receipt | full E2E + hosted CI + audit | Full suite, Phase 9 verify-all, Phase 9/10 GSD verification, milestone audit, and exact-head-SHA GitHub run/receipt match | ❌ final records/run | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add terminal runtime/type/session tests and named mutation rows for handler-entry commitment, serial break, whole-batch suppression, outcome ordering, stop, and response leakage.
- [ ] Add null-declaration aggregation tests, exact issue-code type assertions, actionability assertions, and a discriminating catalog mutant.
- [ ] Add package-check self-tests and a negative/mutation fixture for ordinary pnpm decoration versus authenticated mutation-child authority.
- [ ] Add clean-baseline `.astro/` absence, pinned regeneration, zero-tracked-path, and no-release-input assertions to the existing Phase 9 evidence generator.
- [ ] Correct CI/release clean-checkout ordering and update exact workflow static assertions and negative fixtures.
- [ ] Make the Phase 9 generator emit canonical `09-VALIDATION.md` metadata/source accounting and create independent `09-VERIFICATION.md` evidence.
- [ ] Create Phase 10 verification and exact-SHA hosted certification receipt checks without committing a post-run receipt.
- [ ] Backfill `02-12-SUMMARY.md` with `PKG-02`, `PKG-03`; backfill `03-08-SUMMARY.md` with `CAT-02`, `CAT-05`, `CAT-06`, `CAT-07`, `SEC-01`, `SEC-05`, `DX-03`; synchronize ROADMAP/STATE through registered handlers.

---

## Manual-Only Verifications

No in-scope phase behavior is manual-only. Hosted GitHub Actions and its run-scoped receipt are externally executed automated gates and cannot be replaced by local evidence. Actual npm publication, live registry provenance inspection, and release tagging remain outside Phase 10 and require separate approval.

---

## Validation Sign-Off

- [ ] Every final plan task has a matching row with an automated command or explicit Wave 0 dependency.
- [ ] Sampling continuity: no three consecutive tasks lack focused automated verification.
- [ ] All Wave 0 cases, fixtures, mutants, metadata, and verifier files exist.
- [ ] Focused runtime/type feedback completes within 180 seconds on the development machine.
- [ ] Full clean-checkout local release gate is green in build-before-typecheck order.
- [ ] Phase 9 finalization/verification and Phase 9/10 GSD validation/verification are green on final tracked bytes.
- [ ] Milestone audit reports 62/62 requirements, 9/9 original implementation phases and 10/10 current phase directories, 12/12 integrations, 10/10 flows, and Phase 9 Nyquist compliance.
- [ ] One hosted GitHub Actions run succeeds for the exact final candidate SHA and its receipt matches the run ID/attempt/jobs; no tracked change follows.
- [ ] No watch-mode flags are used.
- [ ] `wave_0_complete: true`, `nyquist_compliant: true`, and `status: complete` are set only after all rows are green.

**Approval:** pending
