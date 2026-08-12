# Phase 10: Close v0.1 release certification and evidence gaps - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the completed v0.1 implementation into one independently certifiable, pre-publication release candidate by closing the exact gaps recorded in `.planning/v0.1-MILESTONE-AUDIT.md`. This phase repairs the ordinary pnpm package-gate path, excludes Astro-owned generated state from release inputs, implements the already-public terminal-action promise across dispatcher and session, closes or re-verifies the SEC-03 schema-detachment evidence, repairs Phase 9 validation and verification records, backfills missing requirement metadata, synchronizes planning state, and reruns the complete release and milestone audit chain on final bytes.

The phase ends only when one clean Git commit passes hosted GitHub Actions and the milestone audit reports 62/62 requirements, 9/9 verified phases, 12/12 integrations, 10/10 end-to-end flows, and Phase 9 Nyquist compliance with no partial, orphaned, or broken rows. It certifies that the exact candidate is publishable; it does not publish to npm, add a new product capability, add another adapter or transport, redesign the public consent model, or broaden v0.1 beyond the audit's closure list.

</domain>

<decisions>
## Implementation Decisions

### Terminal action contract

- **D-10-01 — Keep and implement `ActionDefinition.terminal`.** The field and its documented promise remain in the v0.1 public surface. Removing or documenting around the dead behavior is not acceptable.
- **D-10-02 — Handler entry commits the terminal boundary.** Once a terminal handler is entered, the occurrence is terminal regardless of whether the handler ultimately succeeds or fails. Let the handler settle, then stop; do not keep the session alive because the terminal effect's final external state may be uncertain.
- **D-10-03 — A terminal occurrence makes its entire batch response-silent.** Calls that completed earlier retain their application effects, but no result envelope from that batch reaches the agent. The terminal call emits no result, and no later call in the batch enters its handler.
- **D-10-04 — Preserve the app-authored failure boundary before teardown.** If the terminal handler returns a failure, await the existing immutable app-authored outcome presentation and then stop. Never expose the terminal result to the agent and never let agent-authored narration replace the application outcome.

### Astro generated declarations and release inputs

- **D-10-05 — `.astro` declarations are generated state, not release inputs.** Untrack the two declarations introduced by the milestone-audit commit and regenerate them from committed source and pinned tooling when Astro runs. Do not place their bytes in Phase 9 release manifests or seals.
- **D-10-06 — Scope the exclusion to the existing harness.** Ignore and prohibit tracked files anywhere under `examples/adapter-ssr/.astro/`; do not introduce a repository-wide `.astro/` rule for hypothetical future projects.
- **D-10-07 — Certification starts without generated-state assumptions.** Run the authoritative proof in a disposable clean checkout/snapshot with no preexisting `.astro/`. A developer's ignored local `.astro/` cache is irrelevant and must neither satisfy nor block certification.
- **D-10-08 — Prove regeneration behavior, not generated-byte identity.** Require pinned-tool regeneration, successful Astro check/build, and zero tracked paths under the harness-local `.astro/` directory. Do not hash or compare the generated declarations across runs.

### Release-candidate certification threshold

- **D-10-09 — Hosted CI is a release gate.** The exact candidate commit must pass the real GitHub Actions workflow, including its Ubuntu jobs and the same package/release command chain used for certification. Local CI-equivalent execution alone cannot complete this phase.
- **D-10-10 — Certification precedes registry publication.** Phase 10 proves exact tarballs, hosted workflow execution, OIDC/trusted-publishing configuration, permissions, and release wiring. Actual npm publication and provenance inspection require a later, explicit release approval and are not performed by this phase.
- **D-10-11 — Bind certification to one exact clean commit.** Generate every seal, validation record, verifier report, and audit result only after source, tests, workflows, documentation, and bookkeeping are final. Run hosted CI on that SHA. Any later tracked release-input change invalidates the certification and requires regeneration.
- **D-10-12 — No gap waivers.** Completion requires 62/62 requirements, 9/9 phase verification, 12/12 integration links, 10/10 flows, and a Nyquist-compliant Phase 9. Evidence-only partials, documented technical exceptions, or owner overrides cannot substitute for those scores.

### Legacy human checks and evidence debt

- **D-10-13 — Repair null declarations structurally.** `buildCatalog([null])` must enter the normal aggregate build-diagnostic path rather than escape as a raw `TypeError`. Since there is no action name to report, identify the offending declaration by array index and provide an actionable fix without inventing a name.
- **D-10-14 — Automated actionability evidence is sufficient.** Developer-facing build diagnostics and `explain()` output do not require a separate subjective human prose-approval checkpoint. Mechanically require action or declaration-index identification, stable distinct codes, nonempty actionable fixes, and the expected structured explanation fields.
- **D-10-15 — Close the Phase 4 dispatch-stub note as superseded.** Cite the real Phase 6 dispatcher's result-normalization tests and mutation evidence. Do not recreate or add tests for an obsolete Phase 4 stub solely to close its historical verifier note.
- **D-10-16 — Correct live prose without rewriting history.** Fix inaccurate or ambiguous comments that ship in package artifacts. Preserve historical validation and verification records as records of what happened, adding explicit correction notes or addenda rather than silently rewriting their original claims.

### Carried-forward release constraints

- Phase 9's exact core/React/Svelte tarball, singleton, SSR, Svelte consent-drift, adapter-budget, workflow, security, and mutation proofs remain load-bearing. Repair and regenerate them; do not weaken or replace them with source-only evidence.
- Phase 8's sealed mutation, release, validation, security, and verification records remain immutable inherited evidence. Phase 10 must preserve their required byte identities while rebuilding Phase 9 and milestone evidence around final inputs.
- The explicit `jsonSchema` escape hatch remains part of the public contract. Current source already attempts to snapshot explicit and derived schemas into stable data-only graphs; planning must reproduce the audit's claimed SEC-03 channel against current bytes, repair it only if still live, and otherwise close the stale verifier/ledger evidence with an independent re-verification.
- Missing `requirements-completed` frontmatter, Phase 9 verifier/validation metadata, ROADMAP/STATE drift, and final audit regeneration are required certification work, not grounds for changing already-delivered product behavior.

### Planner's Discretion

- Internal terminal-control representation, module boundaries, safe diagnostic wording, test identifiers, and mutation layout, provided D-10-01 through D-10-04 and existing cancellation/dedup/outcome invariants are mechanically proven.
- Exact structured issue code and index wording for an unreadable declaration, provided it uses the ordinary aggregate diagnostic channel and supplies an actionable fix.
- Exact separation of Phase 9 retroactive validation/verification steps from Phase 10's final integration verification, provided Phase 9 receives canonical compliant records and the final milestone audit is bound to the exact candidate commit.
- Exact implementation of ordinary-pnpm versus authenticated-mutation-child environment recognition, provided ambient authority remains stripped and every existing hostile-environment control stays discriminating.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Closure contract and milestone truth

- `.planning/v0.1-MILESTONE-AUDIT.md` — Binding gap inventory, current scores, nine required closure steps, and the reason Phase 10 exists.
- `.planning/ROADMAP.md` — Phase ordering, Phase 9 terminal evidence constraint, and the inserted Phase 10 boundary. Its Phase 10 goal is still a placeholder; use the audit plus this context as the concrete contract.
- `.planning/REQUIREMENTS.md` — Literal v0.1 requirements, current evidence ledger, SEC-03 row, and the exact 62-requirement target.
- `.planning/PROJECT.md` — Core value, trust boundary, explicit `jsonSchema` escape hatch, package topology, and already-locked product decisions that gap closure may not relitigate.

### Prior phase decisions and verifier findings

- `.planning/phases/02-packaging-build-and-release/02-VERIFICATION.md` — Hosted-CI, provenance, and tarball-acceptance human checks plus the original package/release proof.
- `.planning/phases/03-action-declaration-and-build-time-validation/03-VERIFICATION.md` — Missing-name/null-declaration exception, diagnostic-actionability check, M-03-11 wording issue, and requirement evidence.
- `.planning/phases/04-stages-catalog-assembly-and-explain/04-VERIFICATION.md` — SEC-03 historical carve-out, obsolete dispatch-stub note, explanation-message check, and shipped-prose warning.
- `.planning/phases/06-dispatcher/06-CONTEXT.md` — Serial batch ordering, correlated rows, dedup identity, abort behavior, and normalized result boundary terminal handling must preserve.
- `.planning/phases/07-session-and-the-transport-seam/07-CONTEXT.md` — FIFO occurrence routing, one response attempt per row, cached drain/stop semantics, diagnostics, and teardown guarantees.
- `.planning/phases/08-consent-kernel/08-CONTEXT.md` — App-authored outcome-before-agent barrier, failure containment, and immutable evidence that terminal failure handling must preserve.
- `.planning/phases/09-react-and-svelte-adapters/09-CONTEXT.md` — Exact adapter/package/SSR/release decisions and the final-byte evidence rule.
- `.planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md` — Current Phase 9 Nyquist record requiring metadata/input-accounting repair and regeneration.
- `.planning/phases/09-react-and-svelte-adapters/09-13-SUMMARY.md` — Terminal Phase 9 evidence task, final execution claims, and the pre-audit generated-output state.

### Live implementation and release seams

- `packages/concierge/src/types.ts` — Existing public `terminal` promise and action/session/result contracts.
- `packages/concierge/src/dispatch.ts` — Serial `executeDispatchBatch` implementation and the first integration point for short-circuiting later calls.
- `packages/concierge/src/concierge.ts` — Dispatch pipeline, action snapshotting, catalog handle, and batch facade.
- `packages/concierge/src/session.ts` — Batch occurrence worker, app-authored outcome barrier, response loop, and stop/drain boundary.
- `packages/concierge/src/catalog.ts` — Aggregate declaration validation, catalog detachment/freezing, and SEC-03 boundary.
- `packages/concierge/src/json-schema.ts` — Explicit/derived schema snapshot logic that must be independently tested against the audit's accessor claim.
- `scripts/phase-09-package-check.mjs` — Ordinary pnpm environment defect and authenticated nested mutation-child policy.
- `scripts/phase-09-secure-environment.mjs` — Credential/config stripping and allowlisted child-environment construction that the package-gate repair must preserve.
- `scripts/phase-09-mutation-battery.mjs` — Tracked release-input discovery, final evidence generation, Phase 8 preservation, and release-seal verification.
- `scripts/phase-09-contract-check.mjs` — Static policy pins that must move with any package-check or generated-input correction.
- `package.json` — Canonical Phase 9 aggregate commands and their order.
- `.github/workflows/ci.yml` — Hosted candidate gate required by D-10-09.
- `.github/workflows/release.yml` — Pre-publication release verification, exact archive path, permissions, and OIDC configuration.
- `.gitignore` — Harness-local generated-state exclusion destination.
- `examples/adapter-ssr/package.json` — Pinned Astro check/build commands used to prove regeneration.
- `RELEASING.md` — Post-certification publication and provenance inspection procedure; execution remains separately approved.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `executeDispatchBatch` already owns copied stable ordering, serial handler entry, abort synthesis, and one immutable correlated row per nonterminal call. Terminal short-circuiting belongs at this boundary rather than in adapter or transport code.
- `createSession` already owns occurrence FIFO, the app-authored failure outcome barrier, the one-attempt response loop, and cached asynchronous stop/drain. Those are the existing mechanisms for D-10-03 and D-10-04.
- `snapshotSchemaData` already clones explicit and derived JSON Schema into plain data and rejects accessors/exotic graphs without invoking them. Use focused current-byte probes before assuming the audit's older SEC-03 diagnosis still requires source changes.
- Phase 9 already has exact tarball installation, hosted-workflow static checks, a closed mutation register, secure child environments, tracked-input manifests, and final evidence generators. Extend and regenerate these assets rather than building a second certification framework.
- GSD phase validation, verification, and milestone audit records already define the evidence schemas needed to close Phase 9 and re-score v0.1.

### Established Patterns

- Safety-sensitive runtime boundaries fail closed, use fixed non-echoing diagnostics, snapshot hostile values before use, and prove negative behavior with named mutants rather than happy-path counts.
- Batch, session, and consent state is factory- or occurrence-local; framework packages and transports do not own terminality, dispatch, consent, or teardown policy.
- Release claims bind to built public entries, exact tarballs, isolated consumers, and immutable final-byte evidence. Source imports, workspace-link convergence, and stale verify-only records receive no credit.
- Historical planning evidence is append-only when correcting the record. Live source comments and generated public declarations must be accurate on the candidate commit.

### Integration Points

- Thread terminal recognition from the built catalog/action through `executeDispatchBatch` to `createSession` without changing retry Promise identity, ordinary batch correlation, or nonterminal response behavior.
- Add terminal-specific runtime, session, type, outcome-ordering, cancellation, and mutation cases to the existing core suites and immutable evidence registers.
- Validate declaration elements before reading `.name`, route unreadable/null entries into the existing aggregated `CatalogValidationError`, and update the exact issue-code/type/test pins together.
- Distinguish pnpm's ordinary injected `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN` value from the explicitly authenticated mutation-runner child without allowing case-folded duplicates, ambient overrides, credential/config inheritance, or caller-selected stores.
- Remove tracked `examples/adapter-ssr/.astro/` files, add the scoped ignore, assert a zero tracked generated-path set, then regenerate Phase 9 evidence only after every source/workflow/doc input is final.
- Repair Phase 9 validation frontmatter and input accounting, create `09-VERIFICATION.md`, backfill the nine SUMMARY metadata requirements, synchronize ROADMAP/STATE through registered GSD handlers, and rerun the milestone audit on the candidate SHA.

</code_context>

<specifics>
## Specific Ideas

- The canonical terminal sequence is: earlier calls may complete → terminal handler enters and settles → if it failed, the app-authored immutable outcome completes → no response from the occurrence reaches the agent → queued/later work is prevented or drained under the existing session stop contract.
- The canonical generated-state proof starts from a clean disposable checkout with no `.astro/`, runs pinned Astro check/build, asserts success, and confirms Git tracks nothing beneath `examples/adapter-ssr/.astro/`; the generated bytes themselves are intentionally outside the seal.
- The certification record should name the exact Git SHA and hosted Actions run. Any release-input drift after that SHA means the record is stale rather than "close enough."
- For an invalid declaration with no readable name, a diagnostic such as "declaration at index N" is truthful; inventing a synthetic action name is not.

</specifics>

<deferred>
## Deferred Ideas

- Actual npm publication, registry provenance inspection, and any release tag are a separately approved release ceremony after Phase 10 certifies the candidate.
- Checksum/signature verification for the local Node-floor download remains previously accepted post-v0.1 hardening unless the hosted CI or final audit demonstrates it is now release-blocking.
- New adapters, transports, server handlers, devtools, UI, and v2 consent/server-verification capabilities remain outside this release-closure phase.

</deferred>

---

*Phase: 10-close-v0-1-release-certification-and-evidence-gaps*
*Context gathered: 2026-08-11*
