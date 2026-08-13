# Phase 10: Close v0.1 release certification and evidence gaps - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 37 planned new/modified repository files
**Analogs found:** 35 / 37
**Primary scope:** core runtime, release/evidence tooling, workflows, and planning records

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/concierge/src/dispatch.ts` | service | batch / request-response | Existing `executeDispatchBatch()` in the same file, lines 1003-1065 | exact |
| `packages/concierge/src/concierge.ts` | service | request-response / dedup | Existing `runDispatchPipeline()` and dispatch promise cache, lines 1290-1324, 1326-1687, 1783-1900 | exact |
| `packages/concierge/src/session.ts` | service | event-driven / FIFO | Existing occurrence pump and stop drain, lines 621-722 and 955-1041 | exact |
| `packages/concierge/src/catalog.ts` | service | transform / aggregate validation | Existing `buildCatalog()` issue collector, lines 1017-1055 and 1332-1334 | exact |
| `packages/concierge/src/contract.ts` | utility / published prose | request-response | Precise module-elision qualification in the same file, lines 8-18 | exact |
| `packages/concierge/test/dispatcher-batch.test.ts` | test | batch | Q03 and Q11-Q13 in the same file, lines 249-294 and 706-859 | exact |
| `packages/concierge/test/session-consent.test.ts` | test | event-driven | S06-S07 outcome ordering and failure isolation, lines 672-929 | exact |
| `packages/concierge/test/session-lifecycle.test.ts` | test | event-driven | L01-L04 stop identity/drain cases, lines 268-560 | exact |
| `packages/concierge/test/catalog.test.ts` | test | transform / aggregate validation | DX-03 aggregate diagnostic case, lines 263-333 | exact |
| `packages/concierge/test-d/actions.test-d.ts` | test | transform / public types | Existing accepted `terminal: true` declaration, lines 374-388 | exact |
| `packages/concierge/test-d/dispatcher.test-d.ts` | test | request-response / public types | Exact `dispatchBatch` and `keyof Concierge` pins, lines 1-25 | exact |
| `packages/concierge/test-d/catalog.test-d.ts` | test | transform / closed union | Exact `CatalogIssueCode` bidirectional union pins, lines 314-340 | exact |
| `scripts/phase-09-package-check.mjs` | utility | child-process / environment transform | Existing environment parser and four self-test cases, lines 222-276 and 1632-1856 | exact |
| `scripts/phase-09-contract-check.mjs` | utility | batch / static analysis | Existing final pins and register/evidence checks, lines 715-830 and 982-1058 | exact |
| `scripts/phase-09-workflow-check.mjs` | utility | batch / static analysis | Existing CI/release validators plus negative controls, lines 715-923 and 1084-1215 | exact |
| `scripts/phase-09-mutation-battery.mjs` | utility | batch / file-I/O | Existing manifest, release gates, renderers, and transactional installer, lines 655-720 and 2684-2958 | exact |
| `.planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json` | config | batch | Existing seven-row register schema, lines 1-149 | exact |
| `.planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json` | generated evidence | batch / file-I/O | Existing generator-owned output in `GENERATED_PATHS`, mutation battery lines 45-75 | exact |
| `.planning/phases/09-react-and-svelte-adapters/09-RELEASE-EVIDENCE.json` | generated evidence | batch / file-I/O | Existing generator-owned output in `GENERATED_PATHS`, mutation battery lines 45-75 | exact |
| `.planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md` | generated evidence | batch / transform | `08-VALIDATION.md`, lines 1-110, plus `makeValidationMarkdown()`, mutation battery lines 2758-2783 | role-match |
| `.planning/phases/09-react-and-svelte-adapters/09-SECURITY.md` | generated evidence | batch / transform | Existing `makeSecurityMarkdown()`, mutation battery lines 2785-2817 | exact |
| `.planning/phases/09-react-and-svelte-adapters/09-VERIFICATION.md` | verification document | batch / independent evidence | `08-VERIFICATION.md`, lines 1-180 | role-match |
| `.planning/phases/10-close-v0-1-release-certification-and-evidence-gaps/10-VALIDATION.md` | validation document | batch / evidence map | `08-VALIDATION.md`, lines 1-184; current Phase 10 map, lines 54-83 | role-match |
| `.planning/phases/10-close-v0-1-release-certification-and-evidence-gaps/10-VERIFICATION.md` | verification document | batch / independent evidence | `08-VERIFICATION.md`, lines 1-180 | role-match |
| `.github/workflows/ci.yml` | config | batch / hosted CI | Existing pinned setup, install, gates, and artifact upload, lines 14-49 | exact |
| `.github/workflows/release.yml` | config | batch / hosted release | Existing verify job, attempt-scoped artifacts, and OIDC-only publish job, lines 116-180 and 620-780 | exact |
| `.gitignore` | config | file-I/O | Existing root-scoped generated-directory entries, lines 1-28 | exact |
| `examples/adapter-ssr/.astro/content.d.ts` (remove) | generated config | file-I/O | None: generated file must leave the tracked set | none |
| `examples/adapter-ssr/.astro/types.d.ts` (remove) | generated config | file-I/O | None: generated file must leave the tracked set | none |
| `.planning/phases/02-packaging-build-and-release/02-12-SUMMARY.md` | metadata document | transform | `09-13-SUMMARY.md` frontmatter, lines 1-40 | role-match |
| `.planning/phases/03-action-declaration-and-build-time-validation/03-08-SUMMARY.md` | metadata document | transform | `09-13-SUMMARY.md` frontmatter, lines 1-40 | role-match |
| `.planning/phases/03-action-declaration-and-build-time-validation/03-VERIFICATION.md` | verification document | append-only transform | Existing report findings and gaps, lines 192-272 | exact |
| `.planning/phases/04-stages-catalog-assembly-and-explain/04-VERIFICATION.md` | verification document | append-only transform | Existing warning/requirement record, lines 130-213 | exact |
| `.planning/REQUIREMENTS.md` | project metadata | transform | Existing checklist plus traceability table, lines 9-107 and 137-213 | exact |
| `.planning/ROADMAP.md` | project metadata | transform | Existing phase detail/progress schema, lines 474-499 | exact |
| `.planning/STATE.md` | project metadata | transform | Existing YAML state plus Current Position, lines 1-35 | exact |
| `.planning/v0.1-MILESTONE-AUDIT.md` | generated audit | batch / transform | Existing audit schema and closure list, lines 1-170 and 391-414 | exact |

The 37-file count excludes verify-only references whose locked outcome is “do not edit unless a focused proof fails”: `packages/concierge/src/types.ts`, `packages/concierge/src/json-schema.ts`, `packages/concierge/test/concierge.test.ts`, `scripts/phase-09-secure-environment.mjs`, `package.json`, `RELEASING.md`, and `09-13-SUMMARY.md`.

## Pattern Assignments

### Terminal runtime cluster

**Apply to:**

- `packages/concierge/src/concierge.ts`
- `packages/concierge/src/dispatch.ts`
- `packages/concierge/src/session.ts`
- `packages/concierge/test/dispatcher-batch.test.ts`
- `packages/concierge/test/session-consent.test.ts`
- `packages/concierge/test/session-lifecycle.test.ts`
- `packages/concierge/test-d/actions.test-d.ts`
- `packages/concierge/test-d/dispatcher.test-d.ts`

#### Handler-entry commitment

**Analog:** `packages/concierge/src/concierge.ts:1326-1687`

The current pipeline performs every validation, consent, and lookup guard before the one handler-entry boundary. The insertion point is immediately before the existing call at lines 1619-1627:

```typescript
let handlerReturn: unknown;
try {
  handlerReturn = handler({
```

Copy the existing per-dispatch state and promise-dedup ownership around lines 1290-1324 and 1783-1892. Add private execution state there, then set its terminal marker immediately before `handler(...)`:

```typescript
if (actionSnapshot.terminal) executionState.terminalEntered = true;
```

Do not mark after return or fulfillment. Synchronous throw, returned failure, rejected thenable, and success all cross the terminal boundary once the handler is entered.

**Promise pattern:** `concierge.ts:1783-1892` stores the exact pipeline Promise in the dedup map and returns it. Preserve that direct identity. Do not make `dispatch()` an `async` wrapper and do not allocate a replacement Promise to carry terminal metadata.

#### Private batch outcome, unchanged public rows

**Analog:** `packages/concierge/src/dispatch.ts:1003-1065`

The current executor is already the correct serial boundary:

- it checks abort before entering a row (`1022-1029`);
- awaits one `concierge.dispatch(...)` before starting the next (`1048-1054`);
- freezes each correlated row (`1057`);
- freezes the returned row array (`1063-1065`).

Extend this internal executor with a frozen internal outcome carrying completed rows plus `terminalEntered` and the terminal failure state. After the terminal dispatch settles, break the serial loop. The public `Concierge.dispatchBatch()` facade at `concierge.ts:1894-1900` must project:

```text
nonterminal internal outcome -> existing frozen correlated rows
terminal-entered outcome     -> one frozen empty public array
```

Do not add `terminal`, `terminalEntered`, or an internal outcome object to `ActionResult`, `ToolBatch`, the public correlated row, `Concierge`, or the barrel. `types.ts:98-130`, `1252-1275`, and `1810-1826` are the compatibility boundary.

#### Outcome-before-stop without self-await

**Analog:** `packages/concierge/src/session.ts:621-722` and `955-1041`

Copy the existing `runWork` order: dispatch the whole batch (`633-636`), derive any application-owned `FailureOutcome` (`637-639`), await `presentOutcome` (`640-653`), and only then consider responses (`654-665`). Add the terminal branch before the response loop:

```typescript
try {
  if (failure !== null) await presentOutcome(failure);
} finally {
  void stopNow();
}
return;
```

The exact call spelling may follow the local variables, but the order is locked: settle handler/batch, await the existing app-authored failure outcome when one exists, synchronously enter stopped state even if presentation throws, and return with zero response attempts.

`startStopDrain()` at `session.ts:1015-1034` captures and awaits the active pump. Therefore code running inside `runWork` must initiate the cached stop but must not await it; the active work must first unwind through its existing `finally` at `666-671`. Preserve `stop()` Promise identity at `1332-1334`.

Latch admission while a terminal failure outcome is pending. Queued work must not begin between terminal handler settlement and stop entry; existing queue detach/abort logic at `769-785` remains the cleanup mechanism.

#### Runtime test patterns

**Batch analogs:** `packages/concierge/test/dispatcher-batch.test.ts`

- Use the existing built-artifact harness and reset style at lines 1-120.
- The local action helper at lines 52-68 already spreads an `extra` object, so terminal fixtures should pass `{ terminal: true }` instead of adding a second helper.
- Copy Q03 (`249-294`) for the one-active-handler serial sentinel.
- Copy Q11/Q12 (`706-817`) for “entered row settles, later handler never enters.”
- Copy Q13 (`819-859`) for duplicate `callId` identity/one-handler behavior.
- Assert both the private behavior and the public compatibility boundary: terminal handler marker observed before invocation, later handler count zero, entire public batch exactly `[]`, direct dispatch/dedup Promise identity unchanged.

**Session consent analog:** `packages/concierge/test/session-consent.test.ts:672-929`

S06 already proves the required barrier. Before its deferred outcome resolves, the event sequence is dispatch then outcome and response count is zero (`724-733`). For a terminal occurrence, retain that pre-resolution assertion and change the post-resolution expectation to zero responses plus stopped state. Copy S07's hostile outcome-sink case to prove presentation rejection still stops the session.

**Lifecycle analog:** `packages/concierge/test/session-lifecycle.test.ts:268-560`

- L01: cached `stop()` Promise identity and synchronous stopped state.
- L03: an entered handler drains before the stop Promise resolves, with response suppression.
- L04: queued FIFO work is canceled/drained with zero responses.

Add terminal success, returned failure, synchronous throw, and asynchronous rejection. Include a deferred failure-outcome case that proves order, a throwing outcome sink, and a queued later occurrence. Every case must prove eventual stop resolution so a self-await deadlock cannot hide behind response assertions.

#### Type-test pattern

**Analogs:**

- `packages/concierge/test-d/actions.test-d.ts:374-388` already proves `terminal: true` is a valid `ActionDefinition` field.
- `packages/concierge/test-d/dispatcher.test-d.ts:1-25` pins the exact `dispatchBatch` signature and exact `keyof Concierge` set.

Extend the latter with exact-key checks showing neither `ActionResult` nor the public batch row acquired terminal metadata. Keep the existing positive action declaration case rather than redefining the public field.

---

### Null/unreadable declaration diagnostic cluster

**Apply to:**

- `packages/concierge/src/catalog.ts`
- `packages/concierge/test/catalog.test.ts`
- `packages/concierge/test-d/catalog.test-d.ts`

#### Aggregate issue construction

**Analog:** `packages/concierge/src/catalog.ts:1017-1055,1332-1334`

`buildCatalog()` already owns one local `issues` array and throws one `CatalogValidationError` only after scanning declarations. Keep that architecture. Change the current element loop beginning at line 1055 to an indexed loop and validate the candidate before the first `.name` read at line 1078:

```typescript
for (let index = 0; index < actions.length; index += 1) {
  const candidate: unknown = actions[index];
  // If unreadable, push one frozen CatalogIssue and continue.
}
```

The new issue must use the existing `CatalogIssue` shape at lines 146-156: stable code, stable index-addressed action label, nonempty `problem`, and nonempty actionable `fix`. Do not throw a raw `TypeError`, abort the scan, invent a name for the malformed value, or create a second error class.

Use the existing formatting and aggregate throw:

- `formatCatalogIssues()`, lines 219-235;
- `CatalogValidationError`, lines 262-270;
- single final throw, lines 1332-1334.

Add one new literal to `CatalogIssueCode` at lines 112-122. Choose the name once and pin it bidirectionally; the phase decisions require stability but do not prescribe the spelling.

#### Runtime/type test pattern

**Analog:** `packages/concierge/test/catalog.test.ts:145-179,263-333`

Reuse `declaration()` and `catchBuild()`. The DX-03 case already asserts:

- the thrown value is `CatalogValidationError`;
- `.issues` contains exact ordered codes/action labels;
- every issue has a nonempty `action` and `fix`;
- formatted error text includes the fix.

Add a mixed input containing `null` plus at least one independent ordinary declaration fault so aggregation—not merely conversion from `TypeError`—is proven. Assert the malformed action label addresses the array index deterministically.

**Closed-union analog:** `packages/concierge/test-d/catalog.test-d.ts:314-340`

Update both directions of the exact `CatalogIssueCode` equality. Preserve the opposite-direction assertion at line 336; a one-way `extends` check would allow an accidental extra code.

---

### SEC-03 evidence correction and published prose

**Apply to:**

- `packages/concierge/src/catalog.ts`
- `packages/concierge/src/contract.ts`
- `.planning/phases/03-action-declaration-and-build-time-validation/03-VERIFICATION.md`
- `.planning/phases/04-stages-catalog-assembly-and-explain/04-VERIFICATION.md`

#### Existing proof to reproduce first

**Analog:** `packages/concierge/test/concierge.test.ts:1044-1085`

S15a rejects a root accessor without invoking it, S15b does the same for a nested accessor, and S15c proves an explicit schema is detached and frozen. Run those exact built-artifact tests before touching `json-schema.ts`. If they pass, record the evidence and leave both `json-schema.ts` and `concierge.test.ts` unchanged.

#### Prose correction pattern

**Analog:** `packages/concierge/src/contract.ts:8-18`

The precise claim is already present: module-evaluation registration can be removed when the imported constant is inlined and no retained runtime reference keeps that evaluation reachable. Replace only the over-broad shorthand at `contract.ts:109-128` and `catalog.ts:958` with that qualified claim. Preserve the still-correct design rule: `assertSingleInstance()` must execute from a retained API path, not as an unreferenced module-side effect.

The null-declaration comment at `catalog.ts:448-459` must also stop presenting the raw `TypeError` as an accepted residual after the new aggregated issue ships.

#### Append-only historical correction pattern

The old verifier reports are evidence of what was observed at the time. Do not rewrite their YAML status, old tables, warning text, timestamps, or conclusion in place.

- Append a dated correction addendum to `03-VERIFICATION.md` after its current verifier footer at lines 269-272. Explicitly link the former DX-03 exception at lines 38-40, 198-200, and 258-262 to the Phase 10 null-declaration proof.
- Append a dated correction addendum to `04-VERIFICATION.md` after lines 209-213. Link the former SEC-03 partial row at `140`, W2 at `179-185`, and the old gaps conclusion at `203-207` to S15a/S15b/S15c and the corrected prose.

Each addendum should state original observation, current corrected bytes, exact command/evidence, and superseded conclusion. It must not imply the original verifier saw future code.

---

### Ordinary pnpm environment boundary

**Apply to:**

- `scripts/phase-09-package-check.mjs`
- `scripts/phase-09-contract-check.mjs`
- `.planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json`

**Primary analog:** `scripts/phase-09-package-check.mjs:222-276,1632-1856`

`sourceEnvironmentValue()` already performs exact case-folded lookup and rejects duplicate spellings. Keep that parser. The current `mutationRunnerPnpmChildOverride()` at lines 243-264 accepts `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` only when `PHASE09_CREDENTIAL_FREE_ENV=1`; split parent acceptance from child authority:

```text
ordinary parent + exact false          -> accept, strip before ordinary child
authenticated mutation child + false  -> retain exact false
wrong value / duplicate case spelling  -> reject
marker missing or wrong                -> no mutation-child authority
```

Construct children through `createPackageChildEnvironment()` (`266-276`) and the allowlisted secure-environment builder, never by spreading ambient `process.env`.

Copy the self-test structure at lines 1698-1856. Invert the current unauthenticated-false expected failure (`1819-1829`) into accepted-at-parent/absent-in-child, preserve authenticated retention (`1770-1817`), and preserve wrong-value and case-duplicate rejection (`1831-1856`). Add an ordinary-subprocess observation, not just a helper return assertion.

**Static/mutation analogs:**

- `scripts/phase-09-contract-check.mjs:715-830` pins the package/security policy tokens.
- `09-MUTATION-REGISTER.json:14-147` shows every row's exact-before/exact-after, compile command, killer command, positive counts, assertion fingerprint, test ID, requirement/threat, and decision links.

Move static pins with the implementation and register a compiling negative mutant whose killer is the ordinary pnpm boundary test. Do not rely on a comment-only token count.

`scripts/phase-09-secure-environment.mjs` is the helper analog, not automatically a modification target. Its lines 121-170 already enforce case-fold duplicates/ambient policy and lines 263-382 already build a narrow owned child environment. Change it only if the focused package-check implementation cannot express the locked boundary without doing so.

---

### Generated Astro state and clean-checkout workflows

**Apply to:**

- `.gitignore`
- remove `examples/adapter-ssr/.astro/content.d.ts`
- remove `examples/adapter-ssr/.astro/types.d.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `scripts/phase-09-workflow-check.mjs`
- `scripts/phase-09-mutation-battery.mjs`

#### Generated-state pattern

Add exactly this repository-root-scoped ignore entry, following `.gitignore:1-28`:

```gitignore
/examples/adapter-ssr/.astro/
```

Remove the two tracked declarations from the index. Do not manually edit or preserve their generated bytes. The gate must prove all three states in order:

1. the directory is absent in a clean baseline;
2. pinned Astro `check` then `build` regenerates it;
3. `git ls-files -- examples/adapter-ssr/.astro` remains empty.

The mutation battery's input discovery at lines 655-705 already starts from `git ls-files -z`; retain that tracked-input model. Add an explicit assertion that `.astro/` contributes no tracked release input and no sealed digest.

#### Workflow order pattern

**CI analog:** `.github/workflows/ci.yml:14-49`

Keep checkout/setup/pinned-tooling/install intact. Reorder the current sequence at lines 32-35 from install → typecheck → build → test to:

```text
install --frozen-lockfile -> build -> aggregate typecheck -> test -> release/static checks
```

**Release analog:** `.github/workflows/release.yml:116-180`

Change the current combined verify command at line 142 (`pnpm typecheck && pnpm build && pnpm test`) to build before typecheck. Preserve exact checkout SHA binding and the existing release checks at lines 153-161.

**Static checker analog:** `scripts/phase-09-workflow-check.mjs`

- `validateCi()`, lines 715-774, already checks exact commands and order.
- `validateRelease()`, lines 776-923, already checks exact job permissions, uses/order, and artifact uploads.
- `control(...)` fixtures, lines 1084-1215, establish the required negative-control style.

Update the positive predicates and add separate wrong-order controls. A check that merely finds all command strings is insufficient; the fixture must contain every command in the wrong order and fail.

#### Exact-SHA hosted receipt

Copy the pinned `actions/upload-artifact` shape from `ci.yml:41-49` and the attempt-scoped artifact names from `release.yml:620-629`. The hosted receipt is a workflow artifact, not a committed post-run file. It must bind repository, workflow, head SHA, ref, `run_id`, `run_attempt`, overall conclusion, and each required job conclusion. The final local verifier must compare it to the exact candidate SHA; “latest successful run” is not sufficient.

Preserve the release workflow's security boundary: top-level permissions remain empty and only the publish job has `id-token: write` (`release.yml:631-639`). Receipt work must not broaden token permissions or add checkout to publish.

---

### Phase 9 generator, mutation register, and sealed evidence

**Apply to:**

- `scripts/phase-09-mutation-battery.mjs`
- `scripts/phase-09-contract-check.mjs`
- `.planning/phases/09-react-and-svelte-adapters/09-MUTATION-REGISTER.json`
- `.planning/phases/09-react-and-svelte-adapters/09-MUTATION-EVIDENCE.json`
- `.planning/phases/09-react-and-svelte-adapters/09-RELEASE-EVIDENCE.json`
- `.planning/phases/09-react-and-svelte-adapters/09-VALIDATION.md`
- `.planning/phases/09-react-and-svelte-adapters/09-SECURITY.md`
- `.planning/phases/09-react-and-svelte-adapters/09-VERIFICATION.md`

#### One generator and one tracked-input model

**Analog:** `scripts/phase-09-mutation-battery.mjs`

- `GENERATED_PATHS`, lines 45-75, is the sole ownership list for the four generator outputs.
- `EXPECTED_IDS`, lines 88-96, and the register verifier at `2229-2347` demand exact order and exact evidence cardinality.
- the input manifest at `655-705` excludes generator outputs and hashes tracked inputs;
- Phase 8 ledger digests are preserved at `708-720`;
- release gates execute at `2684-2756`;
- output installation is transactional at `2823-2856`;
- `runAll()` at `2858-2958` validates, materializes a baseline, runs mutants/gates, prospectively verifies all outputs, atomically installs them, and re-verifies.

Extend these existing structures. Do not add a Phase 10 generator, manually patch a sealed ledger, or install one output before all prospective verification succeeds.

The Phase 10 mutation rows should use the exact schema already present in `09-MUTATION-REGISTER.json:14-147`. At minimum provide discriminating killers for:

- handler-entry marking removed;
- serial terminal break removed;
- public rows restored for a terminal batch;
- outcome-before-stop inverted;
- stop omitted or a response leaked;
- null declaration precheck removed;
- ordinary pnpm decoration leaked/rejected incorrectly;
- workflow order or tracked `.astro/` policy weakened.

Keep every mutant compiling where the registered detector is behavioral, prove tests actually ran with positive counts, and require tree restoration after each row.

#### Canonical generated validation

**Analog:** `.planning/phases/08-consent-kernel/08-VALIDATION.md:1-110`

Copy its canonical frontmatter shape:

```yaml
---
phase: 08
slug: consent-kernel
status: complete
nyquist_compliant: true
wave_0_complete: true
created: ...
completed: ...
---
```

Adapt phase/slug/dates for Phase 9. Then preserve the Phase 8 document's sections for Test Infrastructure, per-task verification, requirement coverage, decision coverage, threat coverage, source/research accounting, measured mutation/release evidence, Wave 0 closure, and sign-off.

Update `makeValidationMarkdown()` at mutation-battery lines 2758-2783 so regeneration produces this structure; do not hand-edit `09-VALIDATION.md` after generation. Update `makeSecurityMarkdown()` (`2785-2817`) and the contract checker's expected tokens (`982-1058`) in the same change.

#### Independent verification documents

**Analog:** `.planning/phases/08-consent-kernel/08-VERIFICATION.md:1-180`

Copy its report structure, not its claims:

- frontmatter with phase, slug, verified timestamp, status, score, overrides, and re-verification state (`1-14`);
- observable truths (`38-59`);
- required artifacts (`61-80`);
- key links/data-flow trace (`82-105`);
- behavioral spot checks (`106-117`);
- probe/mutation/release evidence (`119-138`);
- requirement coverage (`139-159`);
- anti-patterns, human verification, and gaps (`161-180`).

`09-VERIFICATION.md` is independent verifier evidence. Do not add it to `GENERATED_PATHS` or let the generator write its conclusions. It may consume the final sealed outputs only after `verify all` passes.

---

### Historical metadata and final milestone records

**Apply to:**

- `.planning/phases/02-packaging-build-and-release/02-12-SUMMARY.md`
- `.planning/phases/03-action-declaration-and-build-time-validation/03-08-SUMMARY.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/v0.1-MILESTONE-AUDIT.md`
- Phase 10 `10-VALIDATION.md`
- Phase 10 `10-VERIFICATION.md`
- Phase 10 `10-CERTIFICATION.md`

#### Summary frontmatter

**Analog:** `.planning/phases/09-react-and-svelte-adapters/09-13-SUMMARY.md:1-40`

Its frontmatter places `requirements-completed` after decisions and before metrics:

```yaml
requirements-completed: [ADP-01, ADP-02, ADP-03, ADP-04, PKG-04]
metrics:
```

Use that exact scalar-list form. Change only the metadata field:

- `02-12-SUMMARY.md:66`: replace `[]` with `[PKG-02, PKG-03]`.
- `03-08-SUMMARY.md`: insert `[CAT-02, CAT-05, CAT-06, CAT-07, SEC-01, SEC-05, DX-03]` before `metrics:` at line 42.

Do not rewrite the historical body, dates, tasks, or measured claims.

#### Registered project-state synchronization

The live files already expose the fields that must converge:

- `REQUIREMENTS.md:87,207` holds SEC-03's unchecked/partial state; `95-96,212-213` already marks PKG-02/03 complete.
- `ROADMAP.md:479-499` currently reports Phase 9 as 12/13 and Phase 10 as unplanned.
- `STATE.md:1-35` currently mixes Phase 10 frontmatter with a Phase 9 Current Position.
- `v0.1-MILESTONE-AUDIT.md:391-401` is the nine-item closure contract.

Use registered GSD handlers for ROADMAP/STATE/requirement coverage. After all seven ordinary Phase 10 SUMMARYs and the independent Phase 10 verifier exist, re-run the milestone audit as the final tracked pre-certification artifact. Do not make freehand counters disagree with `gsd-sdk query phases.list`.

The audit must be workflow-regenerated from final evidence and use only installed status values. Before hosted certification it truthfully remains `gaps_found` for the exact external gate while reporting 62/62 requirements, 9/9 implementation-phase verification, a separate 10/10 phase-directory inventory, 12/12 integrations, 10/10 flows, and Phase 9 Nyquist compliance. The external receipt is authoritative after success; the audit is not rewritten afterward.

#### Phase 10 validation and verification

`10-VALIDATION.md` maps exactly fourteen tasks across Plans 10-01 through 10-07 and their Wave 0 gaps. Finalize those rows from observed commands; do not replace the map with narrative-only sign-off or add an external pseudo-task.

Allow execute-phase to create `10-VERIFICATION.md` through its registered independent verifier only after all seven SUMMARYs exist. It must connect terminal entry → internal batch outcome → session outcome/stop, tracked-input removal → regenerated Phase 9 seal, and summary metadata → audit totals, then use supported `status: gaps_found` solely because the exact-SHA hosted receipt is still absent. `10-CERTIFICATION.md` owns the subsequent audit/commit/push/run/receipt handoff and prohibits any tracked pass rewrite after success.

## Shared Patterns

### Built-artifact-first runtime tests

**Sources:** `dispatcher-batch.test.ts:1-120`, `catalog.test.ts:86-179`, `concierge.test.ts:1044-1085`

Build core before focused Vitest runs and import public behavior from `dist/index.js`. Tests may use source only for static/type assertions. This prevents a green test against stale or private implementation paths.

### Frozen public outputs, mutable private execution state

**Sources:** `catalog.ts:865-890`, `dispatch.ts:989-992,1063-1065`, `session.ts:187-208`

Public rows, issues, outcomes, and arrays are frozen at construction. Terminal execution state is private and per-call/per-batch; it must never be exposed by weakening those frozen public objects.

### Aggregate diagnostics

**Source:** `catalog.ts:219-270,1017-1055,1332-1334`

Collect every actionable issue, preserve declaration order, and throw one typed error after the scan. Early raw exceptions and cascading property reads are both anti-patterns.

### Error and outcome ordering

**Source:** `session.ts:621-672`

Application-authored failure presentation is an awaited barrier before transport response or teardown. Cleanup belongs in a `finally`-equivalent path; a hostile presentation sink cannot keep the terminal session alive.

### Child-process environment minimization

**Sources:** `phase-09-secure-environment.mjs:121-170,263-382`; `phase-09-package-check.mjs:222-276`

Parse keys case-insensitively, reject duplicate spellings, construct an allowlisted child environment, and distinguish a benign parent-runner decoration from authenticated child authority. Never forward ambient `process.env` wholesale.

### Static checks require negative fixtures

**Sources:** `phase-09-workflow-check.mjs:1084-1215`; `phase-09-contract-check.mjs:715-830,982-1058`

Every new static predicate needs a synthetic fixture that contains the tempting wrong form and proves rejection. Positive token presence alone is not discriminating evidence.

### Transactional evidence publication

**Source:** `phase-09-mutation-battery.mjs:2823-2958`

Generate all prospective outputs in isolation, verify content and input manifests, install all outputs atomically, then verify again. Phase 8 ledgers remain immutable inputs. A failed prospective run publishes nothing.

### Append-only historical corrections

**Sources:** `03-VERIFICATION.md:243-272`; `04-VERIFICATION.md:169-213`

Preserve the original verifier's status and observation. Add a dated correction after the footer with the new proof and current conclusion. Live published source prose is corrected in place because it describes current behavior; historical evidence is not.

## Verify-Only Surfaces and Conditional Edits

| File | Expected handling | Evidence/pattern |
|---|---|---|
| `packages/concierge/src/types.ts` | No edit expected. Keep `ActionDefinition.terminal`; add no result/batch metadata. | `terminal?: boolean` at 1089-1093; public result/batch shapes at 98-130 and 1810-1826. |
| `packages/concierge/src/json-schema.ts` | No edit if S15a/S15b/S15c pass on current bytes. | `concierge.test.ts:1044-1085`. |
| `packages/concierge/test/concierge.test.ts` | Re-run existing S15 tests; edit only if the proof fails. | Same S15 block. |
| `scripts/phase-09-secure-environment.mjs` | Prefer unchanged helper; modify only if package-check cannot strip the ordinary decoration at its own boundary. | Existing case-fold and allowlist logic at 121-170 and 263-382. |
| `package.json` | Keep canonical `check:phase09*` entry points unless an exact command-chain correction is required. | Scripts at 27-35. |
| `RELEASING.md` | Verify final commands/digests remain truthful; no decision requires a rewrite by default. | Phase 9 release runbook is a final input, not generator output. |
| `09-13-SUMMARY.md` | Preserve as historical execution record. | Current frontmatter and body are not the missing Phase 9 verifier. |

## No Analog Found

| File / Artifact | Role | Data Flow | Reason |
|---|---|---|---|
| `examples/adapter-ssr/.astro/content.d.ts` (remove) | generated config | file-I/O | The correct operation is to untrack and regenerate on demand; copying another tracked generated file would repeat the defect. |
| `examples/adapter-ssr/.astro/types.d.ts` (remove) | generated config | file-I/O | Same generated-state boundary. |
| Exact-SHA hosted certification receipt | ephemeral workflow artifact | hosted event / file-I/O | No committed repository file should be created. Use existing artifact-upload conventions, then validate the downloaded receipt against the candidate SHA. |

## Planner Guardrails

1. Keep the seven validation task clusters (`10-01` through `10-07`) or update `10-VALIDATION.md` in the same planning change so every task retains an automated row.
2. Runtime work and the final `.planning/REQUIREMENTS.md` edit precede evidence regeneration. The final tracked-input set must be stable before Phase 9 outputs are sealed.
3. Build precedes aggregate typecheck in clean checkout, CI, release, and recorded release evidence.
4. `09-VERIFICATION.md` and `10-VERIFICATION.md` are registered independent verifier artifacts, not generator- or executor-authored conclusions; Phase 10 remains `gaps_found` until the external fact exists.
5. Do not publish packages or perform registry writes. Phase 10 certifies a candidate; hosted CI may upload run artifacts only.
6. Do not hand-edit generated Phase 9 ledgers after the generator runs.
7. Do not rewrite old verifier conclusions in place; append correction addenda.
8. No terminal PLAN may suppress SUMMARY/bookkeeping. Finish normal GSD closeout, commit the supported pre-certification gap records, then run the no-write external gate.

## Metadata

**Analog search scope:** `packages/concierge/src`, `packages/concierge/test`, `packages/concierge/test-d`, `scripts`, `.github/workflows`, root configuration, and `.planning/phases/02` through `10`

**Strong analogs read:** 24 source/test/tooling files plus Phase 8/9 evidence and Phase 2/3/4 historical records

**Large-file handling:** `concierge.ts` and `phase-09-mutation-battery.mjs` were searched first and read only in non-overlapping targeted ranges; analog search stopped after the existing exact clusters covered all planned roles.

**Pattern extraction date:** 2026-08-11
