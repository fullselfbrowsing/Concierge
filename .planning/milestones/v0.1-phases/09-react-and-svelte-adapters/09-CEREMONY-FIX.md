# Phase 09 Ceremony Fix: Isolated pnpm Store Prewarm

**Recorded at:** 2026-08-11T12:05:55Z

**Starting revision:** `9c406d9281ae1f41768390137801927eb4c6a7d8`

**Disposition:** fixed and safely verified; production finalization remains pending

## Observation

A real credential-free finalization in a disposable clean clone reached the valid
`0.1.0` apply state, then failed closed during inherited Phase 8 setup before any
ledger write. The frozen offline install reported
`ERR_PNPM_NO_OFFLINE_TARBALL` for
`@arethetypeswrong/cli-0.18.5.tgz`.

The disposable clone remained clean, and the four generated Phase 09 artifacts
(`09-MUTATION-EVIDENCE.json`, `09-RELEASE-EVIDENCE.json`, `09-VALIDATION.md`, and
`09-SECURITY.md`) were byte-unchanged.

## Root Cause

Finalization correctly created isolated HOME, XDG, npm, and Git configuration state,
but that isolation also gave pnpm a fresh empty store. The mutation battery attempted
the inherited Phase 8 and Phase 9 baseline installs with `--offline` before acquiring
the exact tarballs named by each frozen lockfile. The ambient host store was
deliberately unavailable, so the first missing tarball stopped the ceremony.

## Fix

- The secure child environment now creates an owned private `pnpm-store` beside its
  owned HOME and fixes `PNPM_CONFIG_STORE_DIR` to that absolute path. The store cannot
  be redirected through child overrides and remains outside the repository.
- A shared helper runs exactly
  `pnpm fetch --frozen-lockfile --ignore-scripts` in the relevant snapshot before
  running exactly `pnpm install --offline --frozen-lockfile`.
- Both the inherited Phase 8 snapshot and Phase 9 baseline use that helper.
- Fetch spawn errors, non-zero exits, timeouts, and bounded-output overflow abort
  before the offline install and before evidence installation.
- Fetch receives the credential-free allowlisted environment and exact public
  `https://registry.npmjs.org/` registry. It may access that registry, but it receives
  no ambient npm/repository credentials or config and runs no dependency lifecycle
  scripts.
- Synthetic and static controls pin the command order, exact flags, both call sites,
  owned-store visibility, registry selection, failure suppression, and resistance to
  store redirection.

## Commits

- `0bf6254bc4142b15553816902fbd6ce05e673910` — `fix(09): prewarm isolated pnpm stores`
- `d1d230cad34b9b4b9d6e0cf313deb7c4714ec715` — `docs(09): pin ceremony store prewarm`

## Verification

Safe focused checks:

- `git diff --check` — passed.
- Node syntax checks for the secure-environment, mutation-battery, package-check, and
  contract-check scripts — passed.
- `pnpm fetch --frozen-lockfile --ignore-scripts --help` — pnpm 11.17.0 accepted the
  exact flag combination without performing a fetch.
- `node scripts/phase-09-mutation-battery.mjs self-test` — passed, 33 controls.
- `node scripts/phase-09-package-check.mjs self-test` — passed, 9 controls.
- `node scripts/phase-09-contract-check.mjs final` — passed, 56 contracts and 0
  missing.
- `node scripts/phase-09-workflow-check.mjs` — passed, 2 workflows, 7 jobs, 16
  controls, 19 CI steps, and 40 release steps.
- The live pnpm configuration probe observed the owned store path and exact npmjs
  registry from the isolated child environment.

Safe repository checks:

- `pnpm typecheck` — passed; Svelte reported 0 errors and 0 warnings.
- `pnpm build` — passed for all workspace projects and the Astro example.
- `pnpm test` — passed: 25 files and 439 tests.

No production `prepare`, `apply`, `finalize`, mutation `run all`, release battery,
Changesets version, publish, or evidence-regeneration command was run.

## Evidence Accounting

The prewarm operations are snapshot setup, before `runReleaseGates`; they do not add
rows to `09-RELEASE-EVIDENCE.json.commands`. The recorded command count therefore
remains 15. Mutation evidence remains 7 rows, and the recorded test summary remains
5 files / 11 tests / 11 assertions.

No generated evidence or ledger was rewritten. Current byte hashes are:

| Artifact | SHA-256 | Embedded content digest |
|---|---|---|
| `09-MUTATION-EVIDENCE.json` | `cf4a003befbd58c0123a76e5fd437f80078373e23677fbc574fbc074cef5b087` | `5339b2bca3e8251b5c47651fbb5c4524eab796bc9b974b0910efdd50214b51cd` |
| `09-RELEASE-EVIDENCE.json` | `d27a444a9529aa3bb845b14e23efebc8ee7369f5fe5456fd29b474e049aec4cd` | `4d5b5551a7517f62adc56e0b8b933bf877b2411331dff101e9afce57ca16a8d4` |
| `09-VALIDATION.md` | `55813181686b0a0ed37906d9cd76f9cb9427cc37242ab7fed5d47020528e84e1` | n/a |
| `09-SECURITY.md` | `ee0fa75177e82f71d88daeee022904bcea5b50699b9a68aa77cc00c4b8867c29` | n/a |

The retained evidence records 125 release inputs with aggregate digest
`8dd58a6bea6887579f2cd7499eb7cedb6585fcbf57728217701ad12c458e3175`.
After the already-committed security remediation and this fix, the current tracked
release-input set is 132 paths with calculated aggregate digest
`c8615d53b3edc0d79c34ccebe8562688bf9cca88b9ca3d457ba94b9bcd5b0fb7`.
That expected staleness remains fail-closed and will be replaced only by a future
authorized finalization; no evidence was regenerated merely to bless this code change.

## Unchanged Release State

- Root, core, React, Svelte, and Astro example package versions remain `0.0.0`.
- `.changeset/bright-guides-connect.md` remains pending and requests the three public
  packages' minor release.
- The Phase 09 generated evidence, validation, security, and security-audit files were
  not modified by this task.
- The pre-existing `.planning/config.json` edit and untracked
  `examples/adapter-ssr/.astro/` output were preserved and not staged.
- This report is intentionally left uncommitted for the orchestrator.
