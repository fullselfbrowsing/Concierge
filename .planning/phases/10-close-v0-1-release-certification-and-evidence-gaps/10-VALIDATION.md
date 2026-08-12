---
phase: 10
slug: close-v0-1-release-certification-and-evidence-gaps
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for closing the v0.1 audit on one exact pre-publication candidate without inventing unsupported terminal-plan semantics.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 across core Node, built-artifact/SSR, React jsdom, and Svelte jsdom projects; TypeScript 7.0.2; Phase 9 mutation/release generators; hosted GitHub Actions; installed GSD verifier/audit workflows |
| **Config file** | `vitest.config.ts`, root/package `package.json` scripts, `.github/workflows/ci.yml`, `.github/workflows/release.yml` |
| **Quick run command** | `pnpm --filter @fullselfbrowsing/concierge build && pnpm exec vitest run packages/concierge/test/dispatcher-batch.test.ts packages/concierge/test/session-consent.test.ts packages/concierge/test/session-lifecycle.test.ts packages/concierge/test/catalog.test.ts packages/concierge/test/concierge.test.ts && pnpm --filter @fullselfbrowsing/concierge typecheck` |
| **Full suite command** | `corepack pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test && pnpm run check:phase09:release` |

## Sampling Rate

- **Runtime task:** build core, run the named focused cases, then core typecheck.
- **Release/evidence task:** run syntax/self/static checks before mutation, clean-clone, release, or hosted gates.
- **Final seal:** run only after Plan 06's last `.planning/REQUIREMENTS.md` write; then invoke the registered independent Phase 9 verifier.
- **Normal GSD closeout:** all seven plans create normal SUMMARYs; execute-phase then creates the independent Phase 10 verifier.
- **External terminal gate:** only after verifier/audit/bookkeeping bytes are committed, run `node scripts/phase-10-certify-candidate.mjs certify`; it pushes and certifies the exact SHA without a repository write.

## Plan Waves and Dependencies

| Wave | Plans | Dependencies | Same-wave file overlap |
|------|-------|--------------|------------------------|
| 1 | 10-01, 10-02, 10-03 | none | none |
| 2 | 10-04 | 10-03 | n/a |
| 3 | 10-05 | 10-01, 10-02, 10-03, 10-04 | n/a |
| 4 | 10-06 | 10-05 | n/a |
| 5 | 10-07 | 10-06 | n/a |

## Threat Model Summary

| Threat ID | Failure | Required evidence |
|-----------|---------|-------------------|
| T-10-01 | Terminal result or earlier row reaches the agent | Private outcome, exact empty public batch, zero responses, leakage mutants |
| T-10-02 | Later call/occurrence enters after terminal handler entry | Entry marker, serial break, queue/stop cases, named mutants |
| T-10-03 | Terminal stop self-awaits and deadlocks | Outcome-before-stop order, cached identity, bounded settlement |
| T-10-04 | Ambient pnpm config becomes mutation authority | Exact false parent consumption, child stripping, hostile negative fixtures |
| T-10-05 | Hostile declaration/schema crosses catalog boundary | Pre-property guard, S15 accessor/detachment proof, C23/C24/C34 fields |
| T-10-06 | `.astro` contaminates tracking or seal | Post-commit clean clone, pinned regeneration, zero tracked/sealed paths |
| T-10-07 | Seal/run/receipt identifies different bytes | Final-input ordering, explicit push, local/remote SHA equality, overall/job/evidence receipt comparison |
| T-10-08 | Publish/OIDC authority leaks into certification | Static permission/publication negatives; CI only, no registry/tag/provenance action |

## Per-Task Verification Map

Exactly fourteen ordinary task IDs exist. The hosted ceremony is intentionally not a PLAN task because execute-plan requires a SUMMARY and execute-phase performs verifier/bookkeeping writes after every PLAN.

| Task ID | Plan | Wave | Requirement / gap | Threat Ref | Automated sampling command | Fast preflight before long gate | Status |
|---------|------|------|-------------------|------------|----------------------------|---------------------------------|--------|
| 10-01-01 | 01 | 1 | Audit 3; DSP-07/SES-02/SES-04/CON-10 | T-10-01/02/03 | Focused Q20-Q26/S08-S10/L06-L09 RED plus core typecheck | build/typecheck | ⬜ pending |
| 10-01-02 | 01 | 1 | Audit 3 | T-10-01/02/03 | Focused terminal/session suites and existing nonterminal regression suites | core build | ⬜ pending |
| 10-02-01 | 02 | 1 | Audit 4; CAT-02/CAT-03/CAT-06/DX-03 | T-10-05 | `pnpm --filter @fullselfbrowsing/concierge build && node_modules/.bin/vitest run packages/concierge/test/catalog.test.ts && pnpm --filter @fullselfbrowsing/concierge typecheck` | core build | ⬜ pending |
| 10-02-02 | 02 | 1 | Audit 5; SEC-03/DX-01/CAT-03 | T-10-05 | Built S15a-c, S16-S20, C23/C24/C34 plus append-only addendum checks | core build | ⬜ pending |
| 10-03-01 | 03 | 1 | Audit 1; PKG-04 | T-10-04 | package-check self-test, contract final, public `pnpm run check:phase09:packages` | script self-test | ⬜ pending |
| 10-03-02 | 03 | 1 | Audit 2 | T-10-06 | working-tree deletion/ignore checks plus mutation-battery syntax/self-test | path/syntax checks | ⬜ pending |
| 10-04-01 | 04 | 2 | Audit 2/9 | T-10-06/07/08 | workflow checker and post-commit `verify astro-regeneration` clean clone | zero tracked `.astro` + static checker | ⬜ pending |
| 10-04-02 | 04 | 2 | Audit 9; D-10-09–11 | T-10-07/08 | certification self-test and workflow receipt/static checker | script self-test | ⬜ pending |
| 10-05-01 | 05 | 3 | Audit 3–6 | T-10-01–08 | mutation-battery syntax/self-test, contract final, exact register order | syntax/self/static | ⬜ pending |
| 10-05-02 | 05 | 3 | Audit 3–6 | T-10-01–08 | non-installing `preflight versioned --jobs 4` | syntax/self/static | ⬜ pending |
| 10-06-01 | 06 | 4 | Audit 8; metadata/SEC-03/adapter forward link | T-10-05/07 | exact SUMMARY frontmatter and 62-row REQUIREMENTS parser | Node metadata parser | ⬜ pending |
| 10-06-02 | 06 | 4 | Audit 8 | T-10-07 | `phases.list`, roadmap progress handlers, state progress/session checks | phase inventory | ⬜ pending |
| 10-07-01 | 07 | 5 | Audit 6/7; final Phase 9 seal | T-10-01–08 | final `finalize versioned`, `verify all`, release gate, registered independent Phase 9 verifier | syntax/self/contract | ⬜ pending |
| 10-07-02 | 07 | 5 | Audit 1–9; post-GSD handoff | T-10-01–08 | certification self-test, exact 14-row parser, then disposable full clean-clone chain | self/static/verify-all | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

## Post-GSD External Gate — Not a Task Row

1. Normal execution creates all seven SUMMARYs and updates ROADMAP/STATE while `.planning/REQUIREMENTS.md` remains byte-identical to the Plan 06 version sealed by Plan 07.
2. The installed Phase 10 verifier runs after all summaries and truthfully emits supported `status: gaps_found` with only `EXT-HOSTED-10`; `phase.complete` is not called.
3. The installed milestone audit runs after that verifier and emits supported `status: gaps_found`, with separately parsed 62/62 requirements, 9/9 original phases, 10/10 current directories, 12/12 integrations, 10/10 flows, and Phase 9 Nyquist compliance.
4. Those tracked records/bookkeeping are committed and full Git status is clean.
5. `certify` explicitly pushes the final branch, checks remote SHA = local HEAD, obtains one exact run/attempt, compares API overall/job conclusions and receipt fields/digests, and reasserts unchanged HEAD/status.
6. The external run-scoped receipt is authoritative after success. No tracked file is updated and GSD remains pending because a tracked pass update would invalidate the certified SHA.

## Wave 0 Requirements

- [ ] Terminal entry/silence/outcome/stop tests and exact mutants.
- [ ] Invalid-declaration C34 plus exact CAT-03 code/subject/fix and explain S16-S20 assertions.
- [ ] Ordinary-pnpm parent/child authority tests and mutant.
- [ ] Scoped Astro removal plus honest post-commit clean-regeneration proof.
- [ ] Build-before-typecheck workflow checks and wrong-order fixtures.
- [ ] Receipt `overall_conclusion`, exact job map, push/remote ordering, and mismatch fixtures.
- [ ] Canonical Phase 9 validation renderer, final seal after REQUIREMENTS, and registered independent verifier.
- [ ] Summary/requirement metadata and registered planning-state synchronization.
- [ ] Supported two-stage GSD-closeout/external-certification runbook.

## Manual-Only Verifications

None. Hosted certification is externally stateful but automated by the terminal script. Authentication failures become runtime auth gates; they are not preplanned human work. Publication, provenance inspection, and tagging remain deferred.

## Validation Sign-Off

- [ ] All 14 task IDs have one automated row and correct waves/dependencies.
- [ ] Fast preflights precede every long mutation, clean-clone, release, or hosted gate.
- [ ] Phase 9 finalization occurs after the last REQUIREMENTS write and no later release input changes.
- [ ] Phase 9 independent verification is `passed`; Phase 9 Nyquist is compliant.
- [ ] Full clean-clone release chain is green in build-before-typecheck order.
- [ ] Tracked Phase 10 verifier/audit use only supported statuses and make no premature success claim.
- [ ] Audit fields are parsed separately; one `10/10` occurrence cannot satisfy both directory and flow scores.
- [ ] External gate explicitly pushes and verifies exact SHA/run/attempt/overall/jobs/receipt/evidence.
- [ ] No repository write, phase completion mutation, publication, provenance inspection, or tag follows hosted success.

**Approval:** pending
