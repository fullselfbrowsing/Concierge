---
phase: 09-react-and-svelte-adapters
fixed_at: 2026-08-11T11:38:04Z
audit_path: .planning/phases/09-react-and-svelte-adapters/09-SECURITY-AUDIT.md
finding: SEC09-B01
findings_in_scope: 1
fixed: 1
skipped: 0
status: remediated
---

# Phase 09 Security Fix Report

**Fixed at:** 2026-08-11T11:38:04Z
**Source audit:** `.planning/phases/09-react-and-svelte-adapters/09-SECURITY-AUDIT.md`
**Finding:** `SEC09-B01` — Versioned finalization forwards ambient credentials to dependency-controlled processes

## Remediation

- Added `scripts/phase-09-secure-environment.mjs` as the shared finalization child-environment policy.
- `finalize versioned` now runs a case-insensitive ambient-authority preflight before creating the mutation lock, temporary root, child process, or evidence output. It rejects repository/npm credentials and known CI-token aliases; Git, GitHub CLI, npm, pnpm, Yarn, Corepack, SSH, proxy, trust, Node preload, and temporary-root overrides; and ambient user/repository credential or tool-config paths such as `.netrc`, `.npmrc`, `.gitconfig`, `.git-credentials`, `.ssh`, GitHub CLI config, and pnpm config.
- Every mutation-battery child now receives an explicit environment assembled from a small platform/runtime allowlist. No mutation/package finalization child spreads `process.env`.
- Each child tree receives an isolated `HOME`, `USERPROFILE`, XDG config/cache/data, temporary directory, GitHub CLI config, GnuPG home, and npm cache; owned empty npm user/global configs; an owned empty Git global config; disabled system Git config, credential helpers, extra HTTP headers, and prompting; and the exact `https://registry.npmjs.org/` registry.
- Internal child overrides are restricted to the five reviewed mutation/package variables. Ambient `NODE_OPTIONS` is no longer composed into mutation or package-check children.
- `phase-09-package-check.mjs` independently creates a new owned secure environment under its own temporary root before launching any nested pnpm, npm, tar, TypeScript, or Vitest child.
- Mutation self-tests now prove case-varied repository/npm credentials, hostile npm/pnpm/Git/GitHub CLI overrides, a hostile temporary root, and an ambient `.npmrc` all abort before the child callback. A real child probe proves sentinel values are absent and owned empty configs are active.
- Package self-tests now prove the nested policy reconstructs the environment from an allowlist and that an actual nested child cannot observe repository/npm sentinels or a hostile registry.
- The Phase 09 static contract requires the policy module, preflight/probe controls, absence of ambient environment spreading, and the documented operational boundary. The runbook now uses an `env -i` launch and states the isolation limits explicitly.

## Commits

- `b48fea4258ef12f882c7f927b5c28e6d427d211c` — `fix(09): SEC09-B01 isolate finalization child environments`
- `f29d0a236e0868c707eb1e37f8be4b2c05bab856` — `docs(09): pin credential-free finalization boundary`

## Verification

- `git diff --check` — passed.
- `node --check` for the secure-environment module, mutation battery, package checker, and contract checker — passed.
- `node scripts/phase-09-mutation-battery.mjs self-test` — passed, 29 controls.
- `node scripts/phase-09-package-check.mjs self-test` — passed, 9 controls.
- `node scripts/phase-09-contract-check.mjs final` — passed, 0 missing IDs across 56 required nonempty artifacts.
- `node scripts/phase-09-workflow-check.mjs` — passed, 2 workflows, 7 jobs, 16 controls, 19 CI steps, and 40 release steps.
- `pnpm typecheck` — passed across the workspace.
- `pnpm build` — passed across the workspace.
- `pnpm test` — passed, 25 files and 439 tests.

No production `prepare`, `apply`, `finalize versioned`, terminal mutation `run all`, release battery, live publish, npm publication, or evidence regeneration command was executed. The audited `09-SECURITY-AUDIT.md` and the four sealed Phase 09 evidence/ledger outputs were not modified.

## Release State and Residual Boundary

- The root and all three public package versions remain `0.0.0`.
- `.changeset/bright-guides-connect.md` remains pending with the three intended minor releases.
- The checked-in feature-era evidence remains stale by design until the separately reviewed, receipt-bound human versioned-finalization ceremony is authorized and run.
- This remediation isolates process environments and tool configuration; it is not an OS network or filesystem sandbox. Exact dependency acquisition may still reach the public npmjs registry, and dependency code retains the operator account's host filesystem permissions. The runbook recommends a reviewed ephemeral VM/container with restricted network access or a prewarmed offline cache when stronger isolation is required.
- The unrelated pre-existing `.planning/config.json` modification and untracked `examples/adapter-ssr/.astro/` directory were preserved and excluded from both commits.

---

_Fixed: 2026-08-11T11:38:04Z_
_Fixer: the agent (gsd-code-fixer)_
