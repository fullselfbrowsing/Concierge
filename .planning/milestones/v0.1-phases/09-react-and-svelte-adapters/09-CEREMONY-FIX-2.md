# Phase 09 Ceremony Fix 2: Authenticated Nested pnpm Policy

**Recorded at:** 2026-08-11T12:37:24Z

**Starting revision:** `77f7ada3b1a5e81a95fdf236964e7cce15ae90a9`

**Disposition:** fixed and safely verified; production finalization remains pending

## Observation

A second credential-free finalization retry in a disposable versioned clone passed
the owned-store prewarm and killed M-09-R1, M-09-R2, M-09-S1, M-09-SSR1, and
M-09-B1. It then failed closed at M-09-P1 before any ledger write with:

`unrelated nonzero did not contain the registered semantic fingerprint`

A focused disposable reproduction exposed the underlying failure. The package
checker's first `pnpm --filter @fullselfbrowsing/concierge build` attempted automatic
dependency verification/install and stopped with `ERR_PNPM_OUTDATED_LOCKFILE`. The P1
mutant deliberately changes the React adapter's `peerDependencies` key to
`dependencies`, so the expected kill was instead:

`[ADAPTER_MANIFEST] @fullselfbrowsing/concierge-react live manifest must keep core peer+dev only`

The retry remained fail-closed and did not write the Phase 09 ledgers.

## Root Cause

The mutation runner correctly supplied its reviewed internal
`PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` override to mutant compile and killer
processes. The package checker then correctly reconstructed an independent owned
HOME/config/store environment for its own children, but its source allowlist dropped
that one approved marker. Pnpm therefore applied its normal pre-run dependency policy
to the intentionally lock-inconsistent P1 manifest and preempted the registered
semantic detector.

## Fix

- Package check now has a local nested-environment constructor. It still creates the
  existing independent owned HOME, npm/Git configs, temp directories, cache, and pnpm
  store before spawning any child.
- The constructor reads only two source fields for this exception. It retains exactly
  `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` only when the parent also has exactly
  `PHASE09_CREDENTIAL_FREE_ENV=1`.
- A missing policy remains omitted, preserving pnpm's normal behavior for substantive
  package and release gates. A policy without the parent marker, a value other than
  lowercase `false`, or ambiguous case variants fails closed.
- The retained value is constructed as a fixed canonical override. Source
  `NODE_OPTIONS`, mutation capture paths, credentials, npm config, registry changes,
  and pnpm store redirects are not copied; the nested environment's owned paths and
  exact npmjs registry remain authoritative.
- Static contracts pin the producer's exact mutation-only value, the consumer's
  authentication/value checks, the fixed override, missing-policy omission, real
  nested probes, and the P1 regression.
- Release and contributor documentation record the exception and distinguish it from
  the default policy used by normal gates. The future generated security text records
  the same boundary without regenerating current evidence.

## Focused P1 Regression

Running the production versioned finalizer or mutation battery was prohibited, and
the shared source tree intentionally remains at `0.0.0`. The focused self-test
therefore couples two faithful seams in order:

1. A real pnpm child runs inside the authenticated, independently reconstructed
   package environment and reports `verify-deps-before-run=false`.
2. The fixture reads the registered M-09-P1 exact replacement and fingerprint,
   constructs the valid `0.1.0` manifest shape (or accepts the already-versioned
   nonzero shape in the future), applies that exact mutation, and invokes the same
   archive manifest validator used by the substantive package gate.

The fixture reaches the exact registered `ADAPTER_MANIFEST` failure and asserts that
the result does not contain `ERR_PNPM_OUTDATED_LOCKFILE`. This covers the child-policy
handoff and semantic validation order without invoking production finalization or
writing evidence.

## Commits

- `ee470570e16de42690c7b093f1bd263b68110398` — `fix(09): preserve authenticated mutant policy`
- `d62c6f9e062c2b289e4e5e101b62d7244c97651a` — `docs(09): pin authenticated mutant policy`

## Verification

Focused checks from the committed HEAD:

- `git diff --check` and Node syntax checks — passed.
- `node scripts/phase-09-package-check.mjs self-test` — passed, 14 controls under the
  normal entrypoint.
- The same package self-test with exact authenticated parent and pnpm markers —
  passed, 14 controls, exercising the real entrypoint propagation path.
- `node scripts/phase-09-mutation-battery.mjs self-test` — passed, 33 controls.
- `node scripts/phase-09-contract-check.mjs final` — passed, 56 required artifacts
  and 0 missing.
- `node scripts/phase-09-workflow-check.mjs` — passed, 2 workflows, 7 jobs, 16
  controls, 19 CI steps, and 40 release steps.
- `pnpm typecheck` — passed; Svelte reported 0 errors and 0 warnings.
- `pnpm build` — passed for all workspace projects and the Astro example.
- `pnpm test` — passed: 25 files and 439 tests.

No production `prepare`, `apply`, `finalize`, mutation `run all`, release battery,
Changesets version, publish, npm publish, or evidence-regeneration command was run.

## Evidence Accounting

This fix changes no `runReleaseGates` command. The retained release evidence therefore
still has 15 commands; mutation evidence still has 7 rows; and the recorded test
summary remains 5 files / 11 tests / 11 assertions.

The generated artifacts remain byte-identical to the starting revision:

| Artifact | SHA-256 | Embedded content digest |
|---|---|---|
| `09-MUTATION-EVIDENCE.json` | `cf4a003befbd58c0123a76e5fd437f80078373e23677fbc574fbc074cef5b087` | `5339b2bca3e8251b5c47651fbb5c4524eab796bc9b974b0910efdd50214b51cd` |
| `09-RELEASE-EVIDENCE.json` | `d27a444a9529aa3bb845b14e23efebc8ee7369f5fe5456fd29b474e049aec4cd` | `4d5b5551a7517f62adc56e0b8b933bf877b2411331dff101e9afce57ca16a8d4` |
| `09-VALIDATION.md` | `55813181686b0a0ed37906d9cd76f9cb9427cc37242ab7fed5d47020528e84e1` | n/a |
| `09-SECURITY.md` | `ee0fa75177e82f71d88daeee022904bcea5b50699b9a68aa77cc00c4b8867c29` | n/a |

`09-SECURITY-AUDIT.md` is also unchanged at
`9fd0527eb31a04202db952c64a79ed0a70292528db0f7ba85966deaaa166ec66`.

The retained evidence records 125 inputs with aggregate digest
`8dd58a6bea6887579f2cd7499eb7cedb6585fcbf57728217701ad12c458e3175`.
The current tracked release-input set remains 132 paths and now calculates to
`49a28b9755b52633470516f541da8df179dedf8d62caf177d2c1c1129ac5a0e2`.
That expected staleness remains fail-closed until an authorized future finalization;
no ledger was regenerated to bless this remediation.

## Unchanged Release State

- Root, core, React, Svelte, and Astro example package versions remain `0.0.0`.
- `.changeset/bright-guides-connect.md` remains pending and requests minor releases
  for the three public packages.
- The five generated evidence/validation/security/audit files listed above were not
  modified by this task.
- The pre-existing `.planning/config.json` edit and untracked
  `examples/adapter-ssr/.astro/` output were preserved and not staged.
- This report is intentionally left uncommitted for the orchestrator.
