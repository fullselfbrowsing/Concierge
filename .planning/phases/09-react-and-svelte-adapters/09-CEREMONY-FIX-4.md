---
phase: 09-react-and-svelte-adapters
kind: ceremony-remediation
status: implemented
failed_revision: eb3182adf5110d68e4f4d5fffff45f8a5ed1551e
failure_stage: prospective-version-receipt-verification
---

# Phase 09 Ceremony Fix 4

## Failure

The fourth disposable versioned-finalization attempt safely killed all seven
registered mutants and completed the release gates. It then stopped before ledger
installation when the prospective verifier ran `git merge-base --is-ancestor` for
the receipt base SHA inside the release-input-only baseline. That baseline had been
initialized as a new one-commit repository, so the real audited base commit was not
present even though the live versioned repository had already passed the same
receipt check.

No mutation, release, validation, or security ledger changed. The disposable
version commit and receipt are invalidated by this remediation and will not be
imported or reused.

## Remediation

For a versioned run only, the finalizer now imports the exact local source commit
history into the already-built baseline after its inputs have been copied,
installed, built, and reverified. It writes a commit from the unchanged snapshot
tree with the exact live version commit as parent, atomically updates the disposable
HEAD, proves the tree stayed identical, proves ancestry, and requires a clean
snapshot. No checkout or remote is introduced, and feature-mode baselines keep the
existing isolated one-commit behavior.

`readVersionReceipt(root)` now reads consumed changeset bytes from the repository
identified by its `root` argument instead of implicitly using the runner's process
root. The mutation self-test constructs a two-commit source and a one-file snapshot,
attaches history, and proves exact input scope, clean state, base ancestry, and the
consumed changeset bytes. The final contract pins that control and its history-only
mechanism.

## Verification

- Mutation self-test passed all 34 controls, including the history-backed version
  receipt snapshot.
- Contract self-test passed; final contract reported 0 missing IDs across 56
  required nonempty artifacts. Workflow checker passed 16 controls.
- Typecheck, build, and all 25 test files / 439 tests passed.
- Feature-mode behavior is unchanged at the call site; only a `versioned` baseline
  requests history attachment.
- The four sealed ledgers remain byte-identical at SHA-256 prefixes
  `cf4a003b`, `d27a444a`, `55813181`, and `ee0fa751`.
- No publish command was run.
