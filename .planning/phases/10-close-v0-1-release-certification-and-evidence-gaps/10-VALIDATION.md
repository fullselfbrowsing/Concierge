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

Every final task has one automated sampling row. Phase 10 has no newly assigned formal requirement IDs; `Audit 1` through `Audit 9` refer to the numbered closure list in `.planning/v0.1-MILESTONE-AUDIT.md`. The terminal Plan 08 checkpoint consumes an external hosted receipt and intentionally creates no tracked summary after certification.

| Task ID | Plan | Wave | Requirement / gap | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | Audit 3; DSP-07, SES-02, SES-04, CON-10 | T-10-01 / T-10-02 / T-10-03 | Handler entry commits terminality; the whole occurrence is response-silent; outcome precedes nonblocking stop | unit + integration + type | Focused terminal RED matrix, then the quick run command | ❌ W0 cases | ⬜ pending |
| 10-01-02 | 01 | 1 | Audit 3; DSP-07, SES-02, SES-04, CON-10 | T-10-01 / T-10-02 / T-10-03 | Private terminal state stops later dispatch and queued occurrence admission without self-await | unit + integration + type | Quick run command | ✅ implementation; ❌ corrected cases | ⬜ pending |
| 10-02-01 | 02 | 1 | Audit 4; CAT-02, CAT-06, DX-03 | T-10-05 | Null or unreadable declarations enter the aggregate index-addressed actionable diagnostic channel | unit + type | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/catalog.test.ts && pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ W0 cases | ⬜ pending |
| 10-02-02 | 02 | 1 | Audit 5; SEC-03 | T-10-05 | Explicit and derived schemas are detached and accessors never execute; stale evidence is corrected | focused unit + evidence | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/concierge.test.ts -t 'S15[abc]'` | ✅ tests; ❌ correction record | ⬜ pending |
| 10-03-01 | 03 | 1 | Audit 1; PKG-04 | T-10-04 | Ordinary pnpm decoration is accepted only at the parent boundary and stripped from ordinary children; hostile authority remains rejected | script self-test + mutation | Package-check self-tests plus registered negative mutant | ❌ W0 cases | ⬜ pending |
| 10-03-02 | 03 | 1 | Audit 2 | T-10-06 | Astro state regenerates from pinned inputs but remains untracked and unsealed | clean-checkout integration | Disposable-checkout absence, `check`, `build`, tracked-path, and seal-input assertions | ❌ W0 assertions | ⬜ pending |
| 10-04-01 | 04 | 2 | Audit 9 | T-10-07 / T-10-08 | Clean hosted jobs build before aggregate typecheck and preserve release/OIDC negative controls | static + negative fixture | `node scripts/phase-09-workflow-check.mjs` | ❌ corrected fixtures | ⬜ pending |
| 10-04-02 | 04 | 2 | Audit 9 | T-10-07 | Certification binds repository, workflow, exact head SHA, run ID, attempt, conclusion, jobs, and immutable receipt without a repository write | script self-test | `node scripts/phase-10-certify-candidate.mjs self-test && node scripts/phase-09-workflow-check.mjs` | ❌ script/receipt contract | ⬜ pending |
| 10-05-01 | 05 | 3 | Audit 3–5 | T-10-01–T-10-06 | Named mutants discriminate terminal, catalog, package, and Astro claims | mutation | `node scripts/phase-09-mutation-battery.mjs run named --jobs 4` for every M-10 mutant listed by Plan 05 | ❌ mutation rows | ⬜ pending |
| 10-05-02 | 05 | 3 | Audit 6 / Audit 7 | T-10-05 / T-10-06 | One generator-owned input model produces canonical Phase 9 validation and independent verification without changing inherited Phase 8 seals | generator verification + phase verification | `node scripts/phase-09-mutation-battery.mjs finalize versioned --jobs 4 && node scripts/phase-09-mutation-battery.mjs verify all && pnpm run check:phase09:release` | ❌ canonical records | ⬜ pending |
| 10-06-01 | 06 | 4 | Audit 8; PKG-02–03, CAT-02, CAT-05–07, SEC-01, SEC-05, DX-03 | — | Historical records receive explicit addenda and exact requirement metadata while historical verifier records stay append-only | metadata + static audit | Plan 06 frontmatter/addendum assertions | ❌ addenda/metadata | ⬜ pending |
| 10-06-02 | 06 | 4 | Audit 8 | — | Registered handlers synchronize ROADMAP, STATE, and requirement coverage | GSD handler integration | `gsd-sdk query phases.list`, requirement coverage, roadmap analyze, and state load checks | ❌ synchronized metadata | ⬜ pending |
| 10-07-01 | 07 | 5 | Audit 1–9 | T-10-01–T-10-08 | Final tracked records prove every decision, source, threat, test, and exact release criterion | full local E2E + audit | Full suite, Phase 9 verify-all, Phase 9/10 GSD verification, and milestone audit | ❌ final records | ⬜ pending |
| 10-07-02 | 07 | 5 | Audit 9 | T-10-07 / T-10-08 | A clean clone proves the final tracked candidate and freezes all tracked bookkeeping before hosted execution | clean-clone E2E | Plan 07 clean-clone and status/SHA assertions | ❌ frozen candidate | ⬜ pending |
| 10-08-01 | 08 | 6 | Audit 9 | T-10-07 / T-10-08 | One exact candidate commit already present on the configured remote is certified by the matching hosted Ubuntu run without any tracked write | hosted E2E | `node scripts/phase-10-certify-candidate.mjs certify` | ❌ hosted run/receipt | ⬜ pending |
| 10-08-02 | 08 | 6 | Audit 9 | T-10-07 / T-10-08 | External receipt is revalidated and the repository remains byte-identical to the certified SHA | terminal external checkpoint | `node scripts/phase-10-certify-candidate.mjs verify-run <sha> <run-id> <attempt> && test "$(git rev-parse HEAD)" = "<sha>" && test -z "$(git status --porcelain=v1 --untracked-files=all)"` | ❌ external receipt | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add terminal runtime/type/session tests for handler-entry commitment, serial break, whole-batch suppression, outcome ordering, stop, and response leakage.
- [ ] Add null-declaration aggregation tests, exact issue-code type assertions, actionability assertions, and a discriminating catalog mutant.
- [ ] Add package-check self-tests and a negative/mutation fixture for ordinary pnpm decoration versus authenticated mutation-child authority.
- [ ] Add clean-baseline `.astro/` absence, pinned regeneration, zero-tracked-path, and no-release-input assertions to the existing Phase 9 evidence generator.
- [ ] Correct CI/release clean-checkout ordering and add exact workflow static assertions and negative fixtures.
- [ ] Add the dependency-free exact-SHA certification/receipt verifier with `self-test`, `certify`, and `verify-run` modes.
- [ ] Register every named M-10 mutant and make the Phase 9 generator emit canonical `09-VALIDATION.md` metadata plus independent `09-VERIFICATION.md` evidence.
- [ ] Backfill summary requirement metadata/addenda and synchronize ROADMAP/STATE through registered handlers.
- [ ] Create Phase 10 verification/audit records on final tracked bytes, prove a clean clone, and freeze the candidate before hosted certification.

---

## Manual-Only Verifications

No implementation behavior is manual-only. Plan 08 ends at a blocking terminal checkpoint because D-10-11 forbids any normal executor SUMMARY/verifier/audit/bookkeeping write after the hosted run certifies the exact SHA. The human checks the already automated external receipt result and ends execution; actual npm publication, registry provenance inspection, and release tagging remain outside Phase 10.

---

## Validation Sign-Off

- [ ] All 16 final task IDs have a matching automated sampling row.
- [ ] Sampling continuity: no three consecutive tasks lack focused automated verification.
- [ ] All Wave 0 cases, fixtures, mutants, metadata, scripts, and verifier files exist.
- [ ] Focused runtime/type feedback completes within 180 seconds on the development machine.
- [ ] Full clean-checkout local release gate is green in build-before-typecheck order.
- [ ] Phase 9 finalization/verification and Phase 9/10 GSD validation/verification are green on final tracked bytes.
- [ ] Milestone audit reports 62/62 requirements, 9/9 original implementation phases and 10/10 current phase directories, 12/12 integrations, 10/10 flows, and Phase 9 Nyquist compliance.
- [ ] The candidate is committed and pushed with an empty worktree before hosted execution.
- [ ] One hosted GitHub Actions run succeeds for that exact SHA and the run-scoped receipt matches repository, workflow, run ID, attempt, conclusion, and required jobs.
- [ ] No tracked or untracked repository write follows certification; Plan 08 emits no tracked SUMMARY.
- [ ] No watch-mode flags are used.
- [ ] The tracked validation record reaches `candidate_ready`; terminal external receipt completion is not written back into the candidate commit.

**Approval:** pending
