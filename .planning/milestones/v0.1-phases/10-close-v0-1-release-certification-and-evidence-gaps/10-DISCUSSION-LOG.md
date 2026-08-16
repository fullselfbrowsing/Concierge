# Phase 10: Close v0.1 release certification and evidence gaps - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-11
**Phase:** 10-close-v0-1-release-certification-and-evidence-gaps
**Areas discussed:** Terminal action fate, Astro generated declarations, Certification threshold, Legacy human checks

---

## Terminal action fate

### Keep or remove the public contract

| Option | Description | Selected |
|--------|-------------|----------|
| Implement it | Keep `terminal` and fulfill the documented handler, batch, response, and teardown behavior. | ✓ |
| Remove it before release | Delete the unused field and defer terminal behavior to a later public version. | |
| Planner decides | Choose the lowest-risk path after implementation research. | |

**User's choice:** Implement it.
**Notes:** The field remains part of v0.1; documentation without production behavior is not acceptable.

### Point at which terminality commits

| Option | Description | Selected |
|--------|-------------|----------|
| After any terminal attempt | Once the handler is entered, stop after it settles regardless of success or failure. | ✓ |
| Only after success | A failure returns normally, keeps the session alive, and permits later calls. | |
| Planner decides | Select based on existing cancellation and teardown guarantees. | |

**User's choice:** After any terminal attempt.
**Notes:** Handler entry is the boundary because a failed terminal effect may leave external state uncertain.

### Results from the same batch

| Option | Description | Selected |
|--------|-------------|----------|
| Suppress the whole batch's responses | Preserve earlier application effects, emit no result from the occurrence, and skip all later calls. | ✓ |
| Send earlier results first | Deliver completed nonterminal rows before running the terminal call and stopping. | |
| Require terminal calls to be isolated | Reject or fail closed when a terminal action appears with other calls. | |

**User's choice:** Suppress the whole batch's responses.
**Notes:** The terminal boundary makes the accepted occurrence response-silent; it does not roll back effects that already completed.

### Human-facing terminal failure

| Option | Description | Selected |
|--------|-------------|----------|
| Present failure, then stop | Await the immutable app-authored failure outcome, tear down, and emit no agent result. | ✓ |
| Stop immediately | Suppress both the human-facing failure presentation and all agent-facing responses. | |
| Planner decides | Preserve whichever ordering best matches the consent outcome barrier. | |

**User's choice:** Present failure, then stop.
**Notes:** The existing rule that the agent may not narrate an application failure remains load-bearing even for a terminal occurrence.

---

## Astro generated declarations

### Release-input status

| Option | Description | Selected |
|--------|-------------|----------|
| Generated and excluded | Untrack and ignore `.astro/`; regenerate it from committed source and pinned tooling. | ✓ |
| Tracked and sealed | Keep generated declarations in Git and include their exact bytes in release evidence. | |
| Planner decides | Choose the strongest reproducibility boundary. | |

**User's choice:** Generated and excluded.
**Notes:** The two files were previously kept untracked and were first committed by the milestone-audit commit itself.

### Exclusion scope

| Option | Description | Selected |
|--------|-------------|----------|
| Harness-local `.astro/` | Ignore and prohibit tracking anything under `examples/adapter-ssr/.astro/`. | ✓ |
| Only the two current files | Exclude only `content.d.ts` and `types.d.ts`; revisit each new generated filename. | |
| Every `.astro/` repo-wide | Add one broad rule for current and future Astro projects. | |

**User's choice:** Harness-local `.astro/`.
**Notes:** The rule is complete for the existing generator-owned directory without constraining hypothetical future projects.

### Existing local generated output

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore local cache; prove from a clean snapshot | Certify in a disposable clean checkout with no preexisting `.astro/`; local ignored output is irrelevant. | ✓ |
| Fail when local output exists | Require developers to remove ignored generated output before certification. | |
| Delete it automatically | Have the release check remove the harness-local directory before regenerating it. | |

**User's choice:** Ignore local cache; prove from a clean snapshot.
**Notes:** Authoritative proof cannot depend on or be blocked by a developer's cache state.

### Generated-byte determinism

| Option | Description | Selected |
|--------|-------------|----------|
| No byte seal | Prove pinned regeneration, Astro check/build, and zero tracked generated paths. | ✓ |
| Exact-byte comparison | Generate twice and require identical hashes while keeping files untracked. | |
| Structural check only | Inspect the generated files and key type references without exact hashes. | |

**User's choice:** No byte seal.
**Notes:** Generated declarations are neither shipped package artifacts nor release inputs; successful pinned regeneration is their proof boundary.

---

## Certification threshold

### Hosted GitHub Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Hosted CI is required | The exact candidate SHA must pass the real workflow, including Ubuntu and release-gate wiring. | ✓ |
| Clean-checkout parity is sufficient | Local disposable-checkout execution of every workflow command may certify the candidate. | |
| Hosted CI may follow | Complete Phase 10 locally and retain hosted CI only as a pre-publish checkpoint. | |

**User's choice:** Hosted CI is required.
**Notes:** This closes the original Phase 2 human check rather than treating an unexecuted workflow as equivalent evidence.

### First npm publication

| Option | Description | Selected |
|--------|-------------|----------|
| Certify before publishing | Prove tarballs, permissions, OIDC configuration, and hosted CI; publish only after separate approval. | ✓ |
| Publication is part of certification | Keep Phase 10 incomplete until npm shows provenance-bearing packages. | |
| Publish to a staging channel | Require a provenance-bearing prerelease or temporary dist-tag first. | |

**User's choice:** Certify before publishing.
**Notes:** Phase 10 proves "publishable," not "already published," and does not authorize registry mutation.

### Candidate identity

| Option | Description | Selected |
|--------|-------------|----------|
| One exact clean Git commit | Regenerate final evidence, run hosted CI on that SHA, and invalidate on tracked input drift. | ✓ |
| Content digests only | Let sealed file/archive hashes survive later bookkeeping commits. | |
| A signed release tag | Require `v0.1.0` to be signed before certification. | |

**User's choice:** One exact clean Git commit.
**Notes:** The Git SHA, evidence, release-input set, exact archives, hosted run, and audit result must describe the same candidate.

### Final audit score

| Option | Description | Selected |
|--------|-------------|----------|
| Exact zero-gap target | Require 62/62 requirements, 9/9 phases, 12/12 integrations, 10/10 flows, and Phase 9 Nyquist compliance. | ✓ |
| Technical paths only | Permit evidence-only requirement rows to remain partial if integrations and flows pass. | |
| Documented waivers allowed | Allow explicitly accepted audit gaps while declaring the milestone certified. | |

**User's choice:** Exact zero-gap target.
**Notes:** Partial, orphaned, broken, or waived audit rows cannot complete Phase 10.

---

## Legacy human checks

### Null declaration behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Repair it | Route `buildCatalog([null])` through structured aggregate diagnostics, identify its index, and state the fix. | ✓ |
| Accept the documented exception | Preserve the raw `TypeError` and scope it out of DX-03. | |
| Planner decides | Choose based on consistency with the aggregate validation contract. | |

**User's choice:** Repair it.
**Notes:** A truthful array index replaces the impossible action name; no synthetic name should be invented.

### Message actionability evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit human sign-off | Present representative messages and `explain()` output for product-owner approval. | |
| Automated structure is enough | Require identifiers, distinct codes, actionable fixes, and expected explanation fields mechanically. | ✓ |
| Independent verifier judgment | Let a fresh verifier decide clarity without a product-owner checkpoint. | |

**User's choice:** Automated structure is enough.
**Notes:** No subjective wording-review checkpoint is required if the structured contract is fully pinned.

### Obsolete Phase 4 dispatch stub

| Option | Description | Selected |
|--------|-------------|----------|
| Close as superseded | Cite the real Phase 6 dispatcher tests and mutation evidence; do not recreate the stub. | ✓ |
| Add a historical regression test | Reconstruct the old invariant solely to close the original verifier note. | |
| Leave the note open | Retain unresolved debt even though the implementation no longer exists. | |

**User's choice:** Close as superseded.
**Notes:** Current production behavior and current discriminating evidence own the claim.

### Inaccurate or ambiguous prose

| Option | Description | Selected |
|--------|-------------|----------|
| Correct live prose; append historical corrections | Fix shipped comments and add explicit addenda to historical evidence records. | ✓ |
| Rewrite everything in place | Edit live and historical documents as if their original claims had always been correct. | |
| Leave it unchanged | Treat all prose findings as nonblocking debt. | |

**User's choice:** Correct live prose; append historical corrections.
**Notes:** Package artifacts must not ship false claims, while historical audit records remain an honest chronology.

---

## Planner's Discretion

- Internal terminal signaling, safe diagnostics, module boundaries, test names, and mutation identifiers within the locked semantics.
- Exact issue code and wording for an invalid declaration identified by array index.
- Exact retroactive Phase 9 validation/verification sequencing, provided canonical Phase 9 records and the final exact-SHA audit both exist.
- Exact secure implementation of the ordinary-pnpm environment repair, provided existing credential and mutation-child defenses remain intact.

## Deferred Ideas

- Actual npm publication, provenance inspection, and release tagging require separate release approval after certification.
- Node-floor download checksum verification remains post-v0.1 hardening unless final hosted evidence makes it blocking.
- New product features, adapters, transports, UI, server handlers, and v2 trust capabilities remain out of scope.
