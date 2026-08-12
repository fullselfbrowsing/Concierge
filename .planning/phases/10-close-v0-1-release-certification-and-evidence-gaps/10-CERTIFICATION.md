---
phase: 10-close-v0-1-release-certification-and-evidence-gaps
status: ready
created: 2026-08-12
---

# Phase 10 — Exact-SHA Certification Handoff

This run-ID-free runbook separates ordinary GSD closeout from the terminal hosted gate. Stage A creates the last repository bytes. Stage B certifies that exact clean commit and performs no repository write.

## Invariants

- The final Phase 9 versioned seal has release-input digest `797d2739d011b19735e9d30bc035acb9aebbf470ea9c637f2ba48a19c6c2f0f4` and includes `.planning/REQUIREMENTS.md` at SHA-256 `c75244549d68532f13980cc91bdbf67afc498bc3eacbaa265dd899f6561a3035`.
- `09-VERIFICATION.md`, every Phase 10 closeout record, `ROADMAP.md`, `STATE.md`, and the milestone audit are outside the Phase 9 release-input inventory. They may be written during Stage A without invalidating the seal.
- Hosted success cannot be written back into the candidate. A successor commit would be a different, uncertified SHA.
- Certification proves a pre-publication candidate only. It does not publish to npm, inspect registry provenance, create a release tag, or authorize any later release ceremony.

## Stage A — Ordinary GSD Closeout

Complete these steps in order. Every repository write happens here, before hosted execution.

1. Finish Plan 10-07 through the normal execute-plan lifecycle. Create and commit `10-07-SUMMARY.md`, then let the registered ROADMAP/STATE bookkeeping settle. Reassert that REQUIREMENTS retained the sealed Plan 06 bytes:

   ```sh
   test "$(shasum -a 256 .planning/REQUIREMENTS.md | awk '{print $1}')" = c75244549d68532f13980cc91bdbf67afc498bc3eacbaa265dd899f6561a3035
   node scripts/phase-09-mutation-battery.mjs verify all
   ```

2. After all seven Phase 10 SUMMARYs exist, invoke the registered independent Phase 10 verifier. It must create `10-VERIFICATION.md` with supported `status: gaps_found` and exactly one gap ID: `EXT-HOSTED-10`. It must verify every local Phase 10 truth and identify only the absent hosted fact. Do not call `phase.complete`.

3. Only now run the installed completeness check:

   ```sh
   gsd-sdk query verify.phase-completeness 10
   ```

   Require seven PLANs, seven SUMMARYs, no incomplete plans, and no orphan summaries.

4. Run the installed milestone-audit workflow after the Phase 10 verifier. The audit must use supported `status: gaps_found`, contain only `EXT-HOSTED-10`, and report these fields independently:

   - requirements: 62/62;
   - original implementation phases: 9/9;
   - current phase-directory inventory: 10/10;
   - integrations: 12/12;
   - end-to-end flows: 10/10;
   - Nyquist: Phase 09 compliant, with no partial or missing phase.

   One `10/10` occurrence cannot satisfy both directory inventory and flow coverage.

5. Record the exact marker `Awaiting exact-SHA hosted certification` through registered ROADMAP, STATE, progress, and session handlers. ROADMAP must not mark Phase 10 Complete; STATE must remain `executing` with that exact `stopped_at` value. Commit `10-07-SUMMARY.md`, `10-VERIFICATION.md`, the regenerated milestone audit, ROADMAP, STATE, and any registered bookkeeping output.

6. Before leaving Stage A, require the full worktree—including untracked files—to be clean and validate the complete handoff:

   ```sh
   test -z "$(git status --porcelain=v1 --untracked-files=all)"
   node scripts/phase-10-certify-candidate.mjs handoff-check
   ```

If either command fails, remain in Stage A, repair the tracked record through its registered owner, commit, and repeat the checks. Do not start hosted certification from a dirty or incomplete handoff.

## Stage B — External Exact-SHA Gate

From the clean committed Stage A handoff, run exactly:

```sh
node scripts/phase-10-certify-candidate.mjs certify
```

The command performs the complete external transaction:

1. reruns `handoff-check` and snapshots the clean current branch and HEAD;
2. explicitly pushes the current HEAD to its configured remote branch;
3. fetches that remote ref and requires remote SHA = local HEAD before selecting a run;
4. selects one unambiguous exact-SHA CI run, reruns one failed attempt or dispatches CI if necessary, and records the explicit run ID and attempt in memory;
5. waits for that exact attempt and requires the overall run plus `build`, `node-floor`, and `candidate-certification` jobs to complete successfully;
6. downloads the one run-scoped receipt artifact and compares repository, workflow path/name, ref, SHA, run ID, run attempt, overall conclusion, required job conclusions, artifact identity, evidence digests, and receipt content digest;
7. refetches the branch, reasserts remote SHA equality, and proves local HEAD, branch, and full status are unchanged.

Successful output begins with `PHASE10_CANDIDATE_CERTIFIED` and contains the exact external run URL and receipt digest.

The first Stage B attempt, GitHub Actions run `31642179232`, was not authoritative because its `build` job failed before candidate-receipt creation. It exposed a shallow-checkout defect: Phase 9's sealed Version Packages receipt correctly requires its base SHA to be an ancestor, but the CI build checkout did not retain that history. Stage A therefore resumed, pinned `fetch-depth: 0` in the build job and its workflow contract, regenerated the complete versioned seal, and formed a new candidate. The failed run cannot be reused as certification evidence.

## Authoritative External Fact

After Stage B succeeds, the GitHub Actions run plus its run-scoped receipt is the authoritative external fact for the exact candidate SHA. The tracked Phase 10 verifier and milestone audit intentionally remain `gaps_found`: the installed lifecycle has no supported way to rewrite them as passed without creating an uncertified successor SHA.

Stop immediately after success. In particular, do not:

- invoke `phase.complete` or any GSD mutator;
- rerun or rewrite the Phase 10 verifier or milestone audit;
- create a post-run SUMMARY, receipt, note, commit, or tag;
- modify, stage, commit, generate, delete, or add any tracked or untracked repository path;
- publish packages or inspect registry provenance as though publication occurred.

Any later repository write invalidates the receipt’s candidacy and requires a new clean commit and another complete Stage B run. If certification fails before success, no authoritative fact exists; return to Stage A for any necessary repair, commit the repaired handoff, and certify the new exact SHA.
