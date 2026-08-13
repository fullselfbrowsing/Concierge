# Phase 2: Packaging, build, and release - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — grey-area discussion skipped per autonomous smart-discuss rule)

<domain>
## Phase Boundary

The package that will carry the kernel can be built, published, and installed correctly — settled at **one package**, because the cost of settling it later scales with package count.

This phase owns build config, release tooling, and CI. It does **not** touch `packages/concierge/src/types.ts` — that is Phase 1's artifact and is complete and verified. Phase 2 was explicitly scoped in the ROADMAP as runnable in parallel with Phase 1 on disjoint files (build config and CI, not `types.ts`).

**Why this is an infrastructure phase and got no grey-area interview:** all five success criteria are mechanically verifiable (a tarball installs and typechecks; `publint`/`attw` exit clean; the artifact imports on the declared Node floor; two adapters resolve one core instance; zero runtime bytes added). None describes user-facing behavior. The ROADMAP also records that every toolchain choice here was *already empirically reproduced locally on 2026-07-27 with recorded commands*, so there is no open question for a discussion to resolve.

</domain>

<decisions>
## Implementation Decisions

### Locked upstream — do not re-litigate

These come from PROJECT.md Key Decisions and the project tech-stack document. They are settled inputs to this phase, not choices to make in it.

- **Core is a `peerDependency` of every adapter.** Resolved 2026-07-28; this phase implements it as PKG-04. Two core instances is a correctness failure, not a performance one — it nulls the bridge registry, splits the dedup window so a retried call double-fires, and hides consent armed on one instance from the other. A peer range makes a version mismatch a loud install-time error; a pinned dependency lets duplicates resolve silently. Diverging from TanStack's pinning is the accepted cost.
- **`CONTRACT_VERSION` is the mechanism behind PKG-04** and is introduced in this phase (ROADMAP Notes).
- **ESM-only.** Not dual ESM+CJS. The dual-package hazard is unusually costly for this design precisely because of the one-instance invariant above.
- **No top-level `await` in core** — a single TLA breaks `require(esm)` for every CJS consumer. Make it a lint/review rule.
- **Build with tsdown** (rolldown), with `isolatedDeclarations: true` already set. Without `isolatedDeclarations`, TS 7 dts generation warns and takes ~1064 ms; with it, ~25 ms and no warning.
- **`tsdown` does not typecheck.** Rolldown transpiles without checking, so `tsc --noEmit` must be a *separate* gate. Success criterion 2 states this directly: a typecheck failure must not be able to pass the build.
- **changesets for versioning/release**, not semantic-release. Use `@changesets/cli` ≥ 2.31.1 — the OIDC publish crash was fixed 2026-07-02.
- **npm trusted publishing (OIDC)** from day one. `permissions: { id-token: write }`, no `NPM_TOKEN`. Provenance attestations are generated automatically for public repos on GitHub Actions — `--provenance` is not needed.
- **No JSR for v0.1.** A second registry means a second manifest and a second release path for a pre-alpha with zero users; npm trusted publishing already supplies provenance.
- **No Turborepo.** tsdown builds a package in ~25 ms; Turborepo's per-task overhead is 50–100 ms. Revisit only if CI wall time passes ~2 minutes.
- **`@types/node` must not enter core.** It pulls DOM-adjacent globals and silently defeats the no-DOM guarantee that `lib: ["ES2022"]` enforces.

### Already correct in the repo — do not disturb

Per ROADMAP Notes:

- `engines.node: ">=22.12.0"`
- `type: "module"`
- `isolatedDeclarations: true`
- `lib: ["ES2022"]` in `tsconfig.base.json`

### Known deltas this phase must close

Per ROADMAP Notes, the repo currently disagrees with the plan in these specific ways:

- Root `package.json` pins `typescript@^5.7.0`; the plan calls for **TS 7.0.2 exactly**.
- Root `package.json` pins `pnpm@10.33.0`; the plan calls for **pnpm 11**.
- There is **no bundler, no test runner, no changesets, and no CI**.
- `packages/concierge/package.json` declares only a `typecheck` script. The root `build` and `test` scripts are `pnpm -r build` / `pnpm -r test`, and **both currently fail or no-op** because no package defines `build` or `test`. Confirmed during Phase 1 verification: `pnpm build` exits non-zero with `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`. Phase 1's own gate used `tsc -p tsconfig.json` directly, which exits 0.
- The second build toolchain — **`svelte-package`** — is scaffolded *here* rather than discovered in Phase 9. It cannot pre-bundle runes without silently killing reactivity, which is exactly the class of failure that is cheap now and expensive at adapter time.

### Claude's Discretion

Everything not fixed above — file layout of build configs, CI job decomposition, script naming, how the scratch-project install test is harnessed, and the specific shape of the `CONTRACT_VERSION` mismatch error message (beyond the requirement that it be loud and actionable).

</decisions>

<code_context>
## Existing Code Insights

### Current package layout

- `packages/concierge/` — the single package. Contains `src/`, `test-d/`, `package.json`, `tsconfig.json`, `tsconfig.test-d.json`, and a `README.md`.
- `packages/concierge/package.json` scripts: **only** `typecheck: "tsc -p tsconfig.test-d.json"`.
- Root `package.json` scripts: `build: "pnpm -r build"`, `test: "pnpm -r test"`, `typecheck: "pnpm -r typecheck"`.
- `tsconfig.json` (build program) and `tsconfig.test-d.json` (src + test-d program) are separate. Phase 1 verified a cold `tsc -p tsconfig.json` emits 8 files into a gitignored `dist/` with **zero** test artifacts.

### Reusable assets

- The export surface is complete and verified as of Phase 1 plan 01-08: `src/index.ts` exports 39 types and 4 values. Nothing previously exported was dropped. `serverChallengeBrand`, `ConsentAckBase`, and `ReadbackAttestation` are deliberately **not** exported and must stay unexported through packaging.
- `@standard-schema/spec` is core's only dependency, and it is types-only — its ESM runtime entry is verified 0 bytes with zero dependencies. This is what makes PKG-05 (zero runtime bytes) achievable rather than aspirational, and it is the thing the PKG-05 check must actually measure.

### Integration points

- `MESSAGE_MAX_CHARS` is the one *value* export among mostly types. Phase 1 measured that `verbatimModuleSyntax` enforcement is **one-directional**: a type in the value block is TS1205, but a value misplaced into the type block **escapes at exit 0** while silently erasing the runtime binding from `dist/index.js`. Today it is correct — `node` resolves it to `180` from the built output. A regression guard is deferred to this phase (see below).

</code_context>

<specifics>
## Specific Ideas

- **The PKG-05 check must measure the built artifact, not the manifest.** "Zero runtime bytes" is a claim about what lands in a consumer bundle. `@standard-schema/spec` shipping a 0-byte ESM entry is the reason it holds; a check that only asserts "one dependency, and it's types-only" would pass even if that stopped being true.
- **Success criterion 3 is deliberately stricter than it looks.** "Imports successfully on the exact Node version the package declares as its floor, **not merely on the developer's newer runtime**" — this needs a pinned Node 22.12.0 in CI, not just whatever the runner defaults to.
- **Success criterion 2 has two halves and the second is the easy one to skip.** `publint` + `attw` clean is the visible half. "A typecheck failure cannot pass the build because the bundler does not typecheck" is a structural claim about the pipeline, and the only way to demonstrate it is to prove the gate fires — introduce a type error, watch the build fail, restore. Phase 1 established defect-first proof as this project's standard for exactly this reason.

</specifics>

<deferred>
## Deferred Ideas

Carried in from Phase 1 (recorded in STATE.md Deferred Items), both landing in this phase because it is the one that brings the test runner:

- **M9 second, *named* detector** for the `snapshotEquality` method-syntax regression. Its only current symptom is a lone TS2578 unused-directive — the failure mode a reviewer silently deletes. A `Not<Assignable<ConsentPolicy<Booking>, ConsentPolicy<unknown>>>` predicate was designed and measured as viable in Phase 1 but deliberately not added, because it would have changed the diagnostic set that Phase 1's own gate battery pinned. That constraint is gone once Phase 1 is signed off. Verified non-blocking: SC-7a as roadmap-worded is already caught by 3× TS2322.
- **`MESSAGE_MAX_CHARS` export-placement guard.** One line, but **it must import from `../src/index.js`** — `results.test-d.ts`'s existing `_messageBound` imports from `../src/types.js` and therefore cannot see this regression. Someone working from Phase 1's note alone could close this item wrongly.

Explicitly **not** this phase:

- `Scheduler`'s shape pin → Phase 6, which is expected to refine the signature (a pin now would fire on a sanctioned edit).
- Re-publishing a design contract in `README.md`. The README was rewritten as a positioning page and now documents no type contract; validation row 01-08-T2 passes vacuously as a result. Accepted as a doc-coverage gap, not a Phase 2 deliverable.

</deferred>
