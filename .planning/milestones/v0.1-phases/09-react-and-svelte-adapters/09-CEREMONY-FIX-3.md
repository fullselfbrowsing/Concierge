---
phase: 09-react-and-svelte-adapters
kind: ceremony-remediation
status: implemented
failure_stage: release-workflow-check
failed_revision: 2751383d2f03b304b3304e3907a0c187b0a88503
---

# Phase 09 Ceremony Fix 3

## Failure

The third disposable versioned-finalization attempt safely completed all seven
registered mutants, then stopped before ledger installation when
`phase-09-workflow-check.mjs` ran the versioner's self-test in the legitimate
`0.1.0` baseline. The semantic-manifest control read the live package manifests
as its synthetic `0.0.0` base, so `nextVersion(base.version, "minor")` produced
`0.2.0` and rejected the expected `0.1.0` fixture.

No mutation, release, validation, or security ledger changed. The disposable
version commit and its receipt are invalidated by this remediation and will not
be imported or reused.

## Remediation

`scripts/phase-09-version.mjs` now constructs an explicit synthetic `0.0.0`
manifest triplet for its positive semantic transition and command-injection
negative control. Adapter fixtures also restore the bounded pre-release peer
range before validating the canonical `workspace:^` output. The controls are
therefore independent of whether the checked-out repository is the feature-era
`0.0.0` tree or the receipt-authorized `0.1.0` tree.

`scripts/phase-09-contract-check.mjs` pins the synthetic manifest fixture so a
future refactor cannot silently reintroduce dependence on the live package
version.

## Verification

- Version self-test passed in both the shared `0.0.0` tree and the disposable
  receipt-bound `0.1.0` tree with all 23 controls.
- The workflow checker passed in both trees, including its nested version
  self-test: 2 workflows, 7 jobs, 16 controls, 19 CI steps, and 40 release steps.
- Contract self-test passed; final contract reported 0 missing IDs across 56
  required nonempty artifacts.
- The four sealed ledgers remain byte-identical at SHA-256 prefixes
  `cf4a003b`, `d27a444a`, `55813181`, and `ee0fa751`.
- No publish command was run.
