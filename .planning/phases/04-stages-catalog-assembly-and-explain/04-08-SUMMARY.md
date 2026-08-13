---
phase: 04-stages-catalog-assembly-and-explain
plan: 08
subsystem: validation
tags: [phase-gate, prose-audit, mutation-record, sign-off, CAT-01, SEC-03]

# Dependency graph
requires:
  - plan: 04-01
    provides: "the type contract, and the `[0]!.name` spelling correction this audit re-confirms"
  - plan: 04-02
    provides: "CAT-03's two codes, and the `Hand-forward to Phase 4` correction this audit verifies at 0"
  - plan: 04-03
    provides: "`src/concierge.ts`, the 62/51/11 surface, and the `future work and should be added` correction"
  - plan: 04-04
    provides: "C23…C26 and the CatalogIssueCode pins; also the mislabelled M-04-09 this plan adjudicates"
  - plan: 04-05
    provides: "the S-series, S15's SEC-03 carve-out, and the finding that S13 does not detect the element freeze"
  - plan: 04-06
    provides: "the type pins, and the measured warning that piping `pnpm -r typecheck` swallows the exit code"
  - plan: 04-07
    provides: "the sixteen observed mutant outcomes this plan transcribes into the validation map"
provides:
  - "Seven gates run UNPIPED against the final tree, all exit 0, each code captured immediately"
  - "The eight-literal prose audit measured on the PRE-CORRECTION tree first — 7 of 8 shown able to fire, 1 logged no-coverage"
  - "04-VALIDATION.md's Per-Task Verification Map filled: 17/17 rows observed green"
  - "The Mutant Obligations table carrying 16 observed outcomes, added as columns so the 16-row guard stays exact"
  - "The M-04-09 numbering discrepancy adjudicated with four pieces of evidence"
  - "CAT-01 recorded closed in REQUIREMENTS.md — the phase's one requirement flip"
  - "A DELIBERATELY WITHHELD sign-off, with the single false box named and its remediation written down"
affects: [05-bridges, 06-dispatch, 07-session-and-transport, 08-consent-kernel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Measure every audit literal on the pre-correction tree before trusting it — a grep that cannot fire has audited nothing"
    - "Build the phase merge base in a temp directory to get a pre-correction `dist/`, rather than mutating the worktree"
    - "Never route a gate's exit code through a pipe; redirect to a file and read `$?` immediately"
    - "Prose describing a criterion must not contain the literal the criterion counts"

key-files:
  created:
    - .planning/phases/04-stages-catalog-assembly-and-explain/04-08-SUMMARY.md
  modified:
    - .planning/phases/04-stages-catalog-assembly-and-explain/04-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Sign-off WITHHELD on one measurably false box, rather than signed over it — `nyquist_compliant` stays false"
  - "`wave_0_complete: true` set independently of the withheld sign-off, because it is a separate, observably true claim"
  - "M-04-09 = `!seenNames.has(requires)` → `false`; `04-04-SUMMARY.md:248`'s label is wrong and is left as its own historical record rather than rewritten"
  - "Mutant outcomes added as three COLUMNS on the existing sixteen rows, not as a second table, because a second table would double the `^| M-04-` guard"
  - "The `explain()` gap — it cannot distinguish a thrown matcher from a false one — is recorded as a design boundary, not fixed; a fourth `Explanation` field is a Rule 4 decision"

requirements-completed: [CAT-01]

# Metrics
duration: ~45min
completed: 2026-07-30
---

# Phase 4 Plan 08: The Phase Gate and Sign-Off Summary

**Seven gates green against the final tree, an eight-literal prose audit whose every literal was
first measured on the pre-correction tree, CAT-01 closed — and a sign-off deliberately withheld on
the one checklist box that measurement showed to be false.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2
- **Files modified:** 2 (`04-VALIDATION.md`, `.planning/REQUIREMENTS.md`) — exactly the plan's `files_modified`
- **Source files touched:** 0. No `packages/` file was read-modified; the prose audit found nothing to fix.

## Task Commits

| # | Task | Commit | Type |
|---|---|---|---|
| 1 | Seven gates, prose audit, tree and lockfile | `f1da262` | docs (`--allow-empty`, see Deviation 1) |
| 2 | Fill and adjudicate the validation map; close CAT-01; withhold sign-off | `425b698` | docs |

---

## The headline: sign-off is WITHHELD, and the phase is otherwise complete

These are two different facts and this summary keeps them apart.

**Complete:** all seven gates exit 0; 17/17 map rows carry an observed status; 16/16 mutants have
recorded outcomes with zero vacuous PASSes; CAT-01 is closed; the SEC-03 carve-out and the DSP-09
hand-off are intact; the lockfile is byte-identical.

**Withheld:** exactly one Validation Sign-Off box is false. It asserts that *"every acceptance-criteria
grep in every plan carries a measured pre-edit count, and none of them already sat at its PASS value
before the edit it checks."* Measured across all eight plans:

| Plan | `pre-edit` mentions | `must-stay guard` labels | `DISCRIMINATING` labels |
|---|---|---|---|
| 04-01 | **0** | **0** | **0** |
| 04-02 | 5 | 0 | 0 |
| 04-03 | 10 | 3 | 0 |
| 04-04 | **0** | **0** | **0** |
| 04-05 | **0** | **0** | 1 |
| 04-06 | **0** | **0** | **0** |
| 04-07 | **0** | **0** | **0** |
| 04-08 | 16 | 8 | 9 |

The concrete counter-example, so this is not an argument from aggregates: **`04-04-PLAN.md:176`**
reads *"No Vitest mocking API. `grep -rn 'vi\.' packages/concierge/test/` **must still return 0**."*
That criterion measured **0 before the task and 0 after**, carries no pre-edit count in the plan and
no guard label. `04-04-SUMMARY.md` labelled it a regression guard *retroactively* — the right handling
by that executor — but the box asserts a property of the **plans**.

A second, structural observation recorded in the document: the box's second clause is **unsatisfiable
as literally worded** by any plan that uses guards, including `04-08-PLAN.md`, whose eight must-stay
guards sit at their PASS value by design and correctly.

**To close it:** reword the box to its evident intent — *"every criterion sitting at its PASS value is
labelled a guard and is never counted as progress"* — then back-fill labels in the five plans above.
That is a documentation pass over closed plans and invalidates none of the evidence recorded here.

Signing off over this box would have been the exact defect this phase spent seven plans removing: a
check reported as passing because nobody measured it. `nyquist_compliant: false` and
`^status: signed-off$` at **0** are therefore correct outcomes, not failures — and the plan's own
acceptance criterion sanctions this branch explicitly ("**OR** both return 0, with the summary naming
the box that is false and why").

`wave_0_complete: true` **is** set, deliberately decoupled: all nine Wave 0 files were verified
present by `[ -f ]` plus a line count. Wave 0 completeness is a claim about files existing and is
independent of the criteria-provenance defect.

---

## Task 1 — the seven gates

Each run **unpiped**, output redirected to a file, exit code read immediately. This matters twice
over in this phase: 04-06 measured that piping `pnpm -r typecheck` reports the pipe's status rather
than `tsc`'s, and 04-07 observed the mirror failure — a `${PIPESTATUS[0]}` read after an intervening
command printing `FAIL: mutant escaped` directly beneath the diagnostics proving it had not.

| Gate | Exit | Salient output |
|------|------|----------------|
| `pnpm typecheck` | **0** | `tsc -p tsconfig.test-d.json` → `Done` |
| `pnpm build` | **0** | `Build complete in 54ms`; attw + publint clean |
| `pnpm test` | **0** | **7 files / 86 tests / 304 ms** |
| `pnpm check:artifact` | **0** | node16-from-ESM 🟢, bundler 🟢 |
| `pnpm check:deps` | **0** | A: 1 module, no unbundled externals. B: `@standard-schema/spec` **0 bytes** |
| `pnpm check:pack` | **0** | foreign project installed the 228 823 B tarball, typechecked the shipped `.d.ts` with `skipLibCheck: false`, imported the runtime |
| `pnpm check:node-floor` | **0** | installed with npm and imported on a pinned **v22.12.0** |

**Against the 6 files / 55 tests / 328 ms baseline: +1 file, +31 tests, −24 ms.** The count reconciles
exactly: 55 + 1 (04-03 T3 `artifact.test.ts`) + 4 (04-04 C23…C26) + 25 (04-05, the seventh file) +
1 (04-06 F5) = **86**.

**`check:deps` byte count: 0 bytes. Delta across the phase: zero.**

### Export surface, re-derived independently

Not the test agreeing with itself — `export-surface.test.ts`'s own regex re-run over
`dist/index.d.ts` in a standalone script:

```
blocks 1 names 62 values 11 types 51
values: CONSENT_GRADE_ORDER, CONTRACT_VERSION, CatalogValidationError, JSON_SCHEMA_TARGET,
        MESSAGE_MAX_CHARS, USER_CANCELLED, USER_DECLINED, assertSingleInstance, buildCatalog,
        createConcierge, defineAction
createConcierge in values: true
Explanation in types: true | StageExplanation in types: true
```

**62 names / 51 types / 11 values**, as required.

---

## The prose audit — eight literals, six files, pre-correction counts first

**Method.** The pre-correction tree is the phase merge base `fd8c295` for source files, and a build
of that base for `dist/`. Rather than mutate the worktree, the base was extracted with `git archive`
into `/tmp`, its `node_modules` symlinked, and `tsdown` run there — producing an untouched
`dist/index.d.ts` (110 264 B) and `dist/index.js` (55 115 B) to grep. The worktree was never dirtied.

**Two measurement traps worth recording.** The shell is **zsh**, which does not word-split unquoted
parameters, so a `for f in $FILES` loop silently passes the whole list as one filename; every
measurement here was taken under `bash -c`. And `grep` on this machine is **ugrep**, whose `-c`
counts matching *lines*; occurrence counts were taken with `grep -F -o … | wc -l`, which is the
repository's own convention.

### Per-file counts — every one reproduced the plan's stated value

| Literal | `dist/index.d.ts` | `dist/index.js` | `src/index.ts` | `src/contract.ts` | `src/catalog.ts` | `src/concierge.ts` | TOTAL |
|---|---|---|---|---|---|---|---|
| `sideEffects` (-i) pre | 11 | 6 | 1 | 4 | 2 | — | 24 |
| `sideEffects` (-i) **post** | 11 | 6 | 1 | 4 | 2 | **0** | 24 |
| `tree-shak` (-i) pre | 1 | 1 | 0 | 1 | 0 | — | 3 |
| `tree-shak` (-i) **post** | 1 | 1 | 0 | 1 | 0 | **0** | 3 |
| `future work and should be added` pre | 1 | 1 | 0 | 1 | 0 | — | 3 |
| `future work and should be added` **post** | 0 | 0 | 0 | **0** | 0 | 0 | **0** |
| `remain future work` pre | 0 | 0 | 0 | 0 | 0 | — | **0** |
| `remain future work` **post** | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `Hand-forward to Phase 4` pre | 0 | 1 | 0 | 0 | 1 | — | 2 |
| `Hand-forward to Phase 4` **post** | 0 | **0** | 0 | 0 | **0** | 0 | **0** |
| `defineStage` pre | 0 | 0 | 1 | 0 | 0 | — | 1 |
| `defineStage` **post** | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| `is still being implemented` pre | 0 | 0 | 1 | 0 | 0 | — | 1 |
| `is still being implemented` **post** | 0 | 0 | **0** | 0 | 0 | 0 | **0** |
| `SEC-03` pre | 1 | 6 | 0 | 0 | 8 | — | 15 |
| `SEC-03` **post** | 1 | 7 | 0 | 0 | 8 | 2 | 18 |

The plan's table gives `sideEffects` as "src **13**" where the three named source files sum to 7.
Resolved rather than glossed: the plan's "src" column is the **whole `src/` directory** —
measured 13 across seven files (`catalog.ts` 2, `contract.ts` 4, `host.ts` 1, `index.ts` 1,
`types.ts` 5). `SEC-03`'s "src 8" coincides with `catalog.ts`'s 8 because all eight live there.
Under that reading **every one of the eight pre-phase counts reproduces the plan exactly**.

### Coverage verdict — 7 of 8 literals fire, 1 is no-coverage

| Literal | Fires pre-correction? | Verdict |
|---|---|---|
| `sideEffects` | YES (24) | **MUST-STAY GUARD**, held |
| `tree-shak` | YES (3) | **MUST-STAY GUARD**, held |
| `future work and should be added` | YES (3) | **DISCRIMINATING** — corrected 3 → 0 |
| `remain future work` | **NO (0)** | **NO-COVERAGE, struck.** Never a pass |
| `Hand-forward to Phase 4` | YES (2) | **DISCRIMINATING** — corrected 2 → 0 |
| `defineStage` | YES (1) | **DISCRIMINATING** on its second clause |
| `is still being implemented` | YES (1) | **DISCRIMINATING** — corrected 1 → 0 |
| `SEC-03` | YES (15) | **MUST-STAY GUARD**, held |

`remain future work` measures **0 before and 0 after** because the phrase wraps across
`contract.ts:146`/`:147` and was never greppable. It is recorded as having audited nothing. It is
**not** reinstated.

### Every surviving hit, read

- **`sideEffects` (24).** `src/index.ts:65` is the token `SideEffects,` in an export list — a type
  name, not the bundler flag. `contract.ts:9,20,111,125` are the single-instance registry's argument
  about module-scope survival. `catalog.ts:19,764` are the same argument for `deepFreeze`.
  `types.ts:95,853,967,988,989` are the unrelated **`SideEffects` MCP tool-hint interface**.
  `host.ts:33` is the host seam. **All pre-existing; this phase added zero.**
- **`tree-shak` (3).** One source hit, `contract.ts:23`, arguing that a
  `sideEffects: ["./dist/contract.js"]` carve-out *"disables tree-shaking for the entire package —
  trading PKG-05 away to buy PKG-04"*. Plus its two emitted copies. **Not** the memo's justification.
- **`defineStage` (1).** `src/index.ts:32` now reads *"`defineStage` is **not planned**: a stage needs
  no identity mechanism, a plain `StageDefinition` object literal already typechecks, and the
  unforgeable bridge identity that would have justified it belongs to `createBridge`."* The
  pre-correction text at the same site was *"The rest of the runtime (`createConcierge`,
  `createSession`, `defineStage`, `createBridge`) is still being implemented"* — which is precisely
  why `is still being implemented` fell 1 → 0: it listed `createConcierge`, which now ships.
- **`SEC-03` (18).** Ten source hits, all read: `concierge.ts:4` and `catalog.ts:4` are
  requirement-scope lists in file headers; `concierge.ts:684` says *"SEC-03 names the action
  registry"*, explaining why the returned `Concierge` object is deliberately not frozen;
  `catalog.ts:30,32,268,595` describe what SEC-03 exists to stop and why a shallow-freeze test passes
  on a breached build; `catalog.ts:601,624` are scoping statements (*"SEC-03 names the handler, not
  the validator"*); `catalog.ts:966` is the accessor discussion, which states outright that
  `Object.freeze` does not stop an accessor returning a different value on each read.
  A negative check over all six files for closure language in any SEC-03 neighbourhood (±4 lines)
  returned **no matches in any file**.

### The three claims the audit exists to make, stated explicitly

1. **No surviving hit justifies the memo with tree-shaking.** Both literals measure **0 in
   `src/concierge.ts`**. The memo is justified on SSR cross-request pollution (`concierge.ts:18`), and
   the bundler justification is explicitly retracted at `:30-35` — *"Re-measured under rolldown 1.2.0,
   it does **not** reproduce … The rule survived its justification being wrong, which is exactly why
   the justification is written down rather than assumed"* — without using the retracted vocabulary,
   which is how the retraction and the 0-count criterion coexist.
2. **Nothing describes Phase 4 as future work, and nothing lists `defineStage` as pending.**
3. **Nothing claims SEC-03 is closed**, with or without the carve-out.

---

## Tree, lockfile and residue

| Check | Result |
|---|---|
| `git status --porcelain` | empty at every task boundary |
| `git diff --stat -- pnpm-lock.yaml` | empty |
| `git diff --stat fd8c295..HEAD -- pnpm-lock.yaml` | **empty — byte-identical across the whole phase** |
| `grep -rn 'vi\.' packages/concierge/test/` | **no matches** |
| non-comment `../src/` per runtime test file | **0** in all seven |
| probe residue in `src/` | none (`_typecheckReachProbe`, `prefixNames` etc. all absent) |
| `shasum -a 256 src/concierge.ts` | `56c24f88…438deb` — matches 04-05 and 04-07 |
| `shasum -a 256 src/catalog.ts` | `0cd4a768…d67298` — matches 04-07 |
| `shasum -a 256 src/types.ts` | `a134478e…31e03d` — matches 04-07 |

`pnpm install` was required first (fresh worktree, no `node_modules`), run without
`--frozen-lockfile` and without `CI=true`; the lockfile came back untouched. The three checksums are
what prove every mutation and sensitivity probe run across the phase was restored exactly.

---

## The two manual-only verifications — judgments, not checkmarks

### 1. Does `explain()` answer "why didn't my action fire"? (DX-01)

**Yes for the case it exists for; no for one adjacent case, and that limit is a design boundary
rather than a defect.**

For a **shadowed-stage** config, `explain({pathname:"/shop/cart"})` returns `stage: "broad"` with
**both** rows reporting `matched: true` and `catalog` listing only the first stage's actions. A
developer asking why `checkout` did not fire reads the answer off the object: two stages matched, the
earlier one won. The next step — reorder, or narrow the broad matcher — follows without opening the
source. A short-circuiting implementation would have reported `specific: false` and sent the
developer to debug their matcher instead of their ordering, which is the wrong direction entirely.

For a **no-bridge** config, `bridge: {id:"results-bridge", registered:false}` is legibly different
from `bridge: null`, and the two imply different fixes — mount the component, versus add a `bridge`
to the stage definition. Also derivable without the source.

**The honest limit, measured rather than assumed:** `explain()` does **not** distinguish a matcher
that *threw* from one that returned `false`. Probed directly — a throwing matcher and a plain
`() => false` matcher produce identical rows (`matched: false`, `bridge: null`). The reason travels
on a separate channel: a one-time `console.warn` naming the stage and stating the fix
(*"its `match(ctx)` threw, so the stage was skipped … Fix: make `match` total"*). A developer reading
only the returned object does not learn that their matcher threw.

Recorded, **not** fixed. `match` is arbitrary consumer code `explain` cannot introspect; 04-01
deliberately chose three fields over more under D-04; and `_explanationHasExactlyThreeFields` pins
the shape precisely so that a fourth field is a decision rather than a drive-by. Adding one is a
Rule 4 architectural change, not this plan's to make. Phase 5's planner should meet the gap knowingly.

### 2. Do the two new CAT-03 messages state an actionable fix? (CAT-03, DX-03)

**Yes, both — and their `fix` sentences are genuinely different, which is the whole argument for two
codes rather than one reuse.** Read off the built artifact, not transcribed from source:

- **`consent_target_missing`** names the **referrer** in the structured `action` field
  (`confirmBooking`) and the **missing target** interpolated into `problem` (`reveiw`). Two different
  channels, which is what stops a reworded message from silently passing. The `fix` gives two
  concrete moves — *"declare an action named `reveiw`, or correct the spelling in `consent.requires`"*
  — plus the scope rule, *"The target may live in any stage, or in `crossStage`."* That last clause is
  load-bearing: without it, a developer whose target lives in another stage would "fix" the error by
  duplicating the action and trip `duplicate_action_name` instead.
- **`consent_self_reference`** names the referrer and the target — the same string — and the
  `problem` says so explicitly (*"which is the action itself — arming the gate would mean running the
  very action the gate blocks"*), without which the sentence would read as a tautology. The `fix`
  states the corrective move and the legitimate alternative: *"point `consent.requires` at the review
  action that should run first, or remove the `consent` policy if this action needs no gate."*

Collapsing the two codes would force one `fix` to cover both, and a developer who merely mistyped a
name would be advised to consider deleting their consent policy — advice that, if taken, removes the
gate CAT-03 exists to protect.

---

## Task 2 — the validation map

### Every acceptance criterion, pre-edit and post-edit

Every pre-edit count was re-measured on the untouched documents before any edit, and **every one
reproduced the plan's stated value exactly**.

| Criterion | Register | Pre | Post | Verdict |
|---|---|---|---|---|
| `grep -c '⬜ pending'` | DISCRIMINATING | 18 | **1** | PASS — the legend line only |
| `grep -c '^- \[x\]'` | DISCRIMINATING | 0 | **19** | PASS (floor 11) |
| `grep -c '^\| 04-0'` | must-stay guard | 17 | 17 | held |
| `grep -c '^\| M-04-'` | must-stay guard | 16 | 16 | held |
| `grep -cE 'exit 0\|exit 1'` | DISCRIMINATING | 4 | **36** | PASS (floor 20) |
| `grep -c 'CAT-01'` (VALIDATION) | must-stay guard | 5 | 8 | held |
| `grep -c 'SEC-03 is not fully closed'` | must-stay guard | 1 | 1 | held |
| `grep -c 'DSP-09'` | must-stay guard | 4 | 6 | held |
| `Partial — 4/5 derived artifacts ship` (REQUIREMENTS) | DISCRIMINATING | 1 | **0** | PASS |
| `closed by Phase 4` (REQUIREMENTS) | DISCRIMINATING | 0 | **1** | PASS |
| `^nyquist_compliant: true$` | DISCRIMINATING | 0 | **0** | **withheld — box named** |
| `^status: signed-off$` | DISCRIMINATING | 0 | **0** | **withheld — box named** |
| `nyquist_compliant: true` *unanchored* | (the trap) | **1** | 3 | trap confirmed live |

Per-requirement guard counts inside map rows — none fell: CAT-03 **8**, STG-01 **5**, STG-02 **5**,
STG-03 **7**, STG-04 **5**, SEC-03 **10**, DX-01 **9**, CAT-01 **2**.

The unanchored `nyquist_compliant: true` trap is real and was verified: it measures **1 on the
completely untouched document**, matching the checklist line that *quotes* the key while frontmatter
line 6 reads `false`. Only the line-anchored form is load-bearing.

### 17 of 17 rows observed green

Every Status value was taken from a plan summary that names the command which produced it, then
cross-checked against this plan's own gate run. **No row was marked green on the strength of a plan
saying it would be.** The four rows that read `❌ Wave 0` / `❌ depends on` at plan time now read `✅`
with the file and its line count.

### 16 of 16 mutant outcomes recorded

The outcomes were added as **three new columns on the existing sixteen rows**, not as a second table
— a second table would have doubled the `^| M-04-` guard from 16 to 32. Each row now carries its
harness exit, the named case(s) that went red, and the anti-vacuous-PASS confirmation read out of the
gate's own output.

**All sixteen literals were re-measured unfiltered on the tree being gated**, not inherited from
04-07: every one printed exactly **1**. Every trap literal printed its documented non-unique count —
`Object.freeze(` **4** in `concierge.ts` but **1** in `catalog.ts`, `return warnStage(` **2**,
`warnHost(` **2**, and `duplicate_action_name` / `action.consent` / `consent_target_missing` /
`consent_self_reference` / `deepFreeze(` **2** each in `catalog.ts`.

Sixteen PASSes, zero vacuous. Twelve rows ran all 25 cases, two ran all 26, M-04-11 ran all 86, and
M-04-14 is typecheck-gated with both expected diagnostics emitted.

### The M-04-09 discrepancy — adjudicated, with evidence

`04-04-SUMMARY.md:248` labels `declared.push(action);` as **M-04-09**. `04-VALIDATION.md:207`,
`04-07-PLAN.md:230` and 04-07's execution all assign M-04-09 to `!seenNames.has(requires)` → `false`.

**Verdict: the validation map and 04-07 are correct. `04-04-SUMMARY.md:248` is mislabelled.**

1. **M-04-11's own Notes cell only parses under this assignment.** It reads *"The **only** mutant
   proving the check reads the COMPLETE name set. **M-04-9 does not.**"* That contrast is meaningful
   only if M-04-9 mutates the *same* expression to a constant. Against `declared.push(action);` the
   sentence is incoherent — deleting the push does not test the name set, it empties the set read.
2. **`declared.push(action);` appears in ZERO rows of the Mutant Obligations table.** Measured on the
   untouched document: `grep -c 'declared.push' 04-VALIDATION.md` → **0**. It was never seeded.
3. **04-07 executed M-04-09 as `!seenNames.has(requires)` → `false` and observed C23 + C26 red with
   26 tests run.** That matches the seeded *Expected red* ("the CAT-03 typo case" = C23). The row has
   an observed outcome; the alternative reading has none.
4. **The error's origin is traceable and benign.** `04-02-SUMMARY.md:106` heads a three-row table
   *"Mutant Literals (for 04-07: M-04-09, M-04-10, M-04-11)"* listing `!seenNames.has(requires)`,
   `requires === action.name` and `declared.push(action);` — three literals under three IDs with **no
   stated one-to-one mapping**. 04-04 read it as a mapping; two IDs were already taken by the first
   two literals, so the leftover landed on the third.

**The count is sixteen either way**, exactly as 04-07 said. `declared.push(action);` still measures
**1** and remains available as a future target, but the rule it would test — that the post-pass
iterates the declared set at all — is already covered from the other side by M-04-9 and M-04-11. The
adjudication is written into `04-VALIDATION.md`; `04-04-SUMMARY.md` is **left unedited** as the
historical record of what that executor observed.

---

## Phase-close statement — for the next phase's planner

**CAT-01 is CLOSED.** Its fifth derived artifact, per-stage catalogs, now ships via
`createConcierge().catalogFor`; evidence 04-05 S1 and S2, plan 04-03. `REQUIREMENTS.md:157` was
rewritten from `Partial — 4/5 derived artifacts ship` to `Complete`, with the Phase column naming
Phase 4 as the closer, and the CAT-01 checklist box at `REQUIREMENTS.md:13` ticked. The five
pre-existing CAT-01 references inside `04-VALIDATION.md` were **confirmed, not authored** here —
`:144` already named `createConcierge().catalogFor` and already cited 04-05 S1/S2.

**SEC-03 is NOT fully closed.** Two halves close in this phase: handler replacement (the built
registry is frozen — C17/C18) and the tool array handed to the agent (S11/S12/S13/S14, plus the
type-level half where `catalogFor(ctx)[0]!.name = "evil"` no longer typechecks). **The
consumer-supplied `jsonSchema` getter channel is measured open and is not this phase's to fix:**
`deepFreeze` deliberately skips accessors so that walking the catalog never invokes application code,
and for `emission.source === "explicit"` the `parameters` object *is* the consumer's own object by
reference. Re-freezing the projection changes nothing. **No plan, summary or record may write
"SEC-03 closed" without that carve-out.** `REQUIREMENTS.md`'s SEC-03 row is deliberately left
`Pending`; flipping it would assert something measurement contradicts.

**DSP-09 hand-off, confirmed rather than authored.** The Phase 4 `dispatch` stub returns
`{ok: false, message}` with `reason` **deliberately omitted**. Verified against the source
(`src/concierge.ts:118-124`) and against the runtime: `Object.keys(result)` is exactly
`['ok','message']` and `"reason" in result` is **false** — the key is absent, not
present-and-undefined, which is the distinction the whole hand-off rests on. **DSP-09's normalizer
must REPLACE this shape, not normalize it.** It is not a contradictory `ActionResult` to be repaired;
it is a placeholder to be deleted, together with the function that returns it.

**Also not closed by this phase:** CAT-04 (needs a transport — Phase 7, then Phase 8); a non-string
or missing `consent.requires` (recorded as a residual, revisit with Phase 8's kernel); the
inline-`defineAction` contextual widening (documented not fixed, D-12.2 —
`_inlineDefineActionLosesTheUnion` stays red-as-pinned, and if it flips green, delete it rather than
relax it); `defineStage` and `createBridge` (Phase 5, and `defineStage` is now recorded as **not
shipping at all**).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Task 1 produces no tracked-file change, so it has no ordinary commit**

- **Found during:** Task 1 close.
- **Issue:** Task 1's `<files>` names `04-VALIDATION.md`, but its action only edits when the audit
  finds a surviving false claim — and it found none. All three correctable literals were already at
  0, corrected by 04-02 and 04-03. `git commit` with nothing staged fails, and skipping the commit
  would erase the task boundary from history.
- **Fix:** committed `--allow-empty` with all seven gate exit codes, the full eight-literal
  pre/post table and the tree/lockfile evidence in the message body, exactly as 04-07 Task 1 did one
  wave earlier. The evidence is in git, not only in this summary.
- **Files:** none · **Commit:** `f1da262`

**2. [Rule 1 — Bug] My own row text broke the criterion it was reporting**

- **Found during:** Task 2(a), verifying the map guards after filling the Status column.
- **Issue:** The cell I wrote for row 04-08-T2 contained the literal `⬜ pending` while describing
  that count falling to 1. `grep -c '⬜ pending'` therefore returned **2**, not 1 — the criterion
  failed because of the prose asserting it passed. Precisely the self-defeating-literal class this
  phase documents.
- **Fix:** the cell now says *"the pending marker falls 18→1"* and states in-line that it
  deliberately does not spell the marker. Count back to **1**. The criterion was fixed by correcting
  the prose, never by loosening the grep.
- **Files:** `04-VALIDATION.md` · **Commit:** `425b698`

### Recorded, not fixed

**3. The plan's `sideEffects` "src 13" resolves to the whole `src/` directory.** The three named
source files sum to **7**. Measured across all seven files in `src/`: **13**. Not a defect in either
the plan or the tree — the plan's "src" column is directory-wide. Recorded so the next reader does
not chase a phantom 6-occurrence discrepancy.

**4. Sign-off withheld on one false box** — see the headline section. This is the plan's own
sanctioned branch, not a deviation from it, but it is the single most consequential outcome here and
is called out in both the document and this summary.

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug), 2 recorded. No architectural change, no
dependency, no package install, no source change, no assertion weakened.

---

## Issues Encountered

- **Worktree base correction at startup.** `git merge-base HEAD 4cf4c62` returned `e4e353f`, which
  *was* HEAD — the worktree was checked out **behind** the expected wave-5 base rather than diverged
  from it. Reset to `4cf4c62` per the startup protocol; the reset discarded nothing, since HEAD was
  an ancestor. **This is the sixth consecutive plan in this phase to record the same shape** (04-01,
  04-03, 04-05, 04-06 and 04-07 all did). It is a property of how these worktrees are created, not an
  accident, and it is now unambiguous enough to be worth fixing upstream.
- **`pnpm install` required first** — fresh worktree, no `node_modules`. Run without
  `--frozen-lockfile` and without `CI=true`; `pnpm-lock.yaml` came back byte-identical.
- **zsh does not word-split unquoted parameters.** A `for f in $FILES` loop passed the entire
  file list as a single filename, and ugrep reported "No such file or directory" for the
  concatenation while the loop reported zeroes. Every measurement in this plan was retaken under
  `bash -c`. A measurement harness that silently returns 0 for every literal is indistinguishable
  from "the audit passed" — worth knowing before trusting any grep table written in this repo.
- **`grep` here is ugrep**, whose `-c` counts matching lines rather than occurrences. Occurrence
  counts use `grep -F -o … | wc -l`, the repository's own convention, and the two genuinely differ
  for multi-hit lines.
- **Building the pre-correction `dist/` needs an out-of-tree build.** `git archive` into `/tmp` plus
  symlinked `node_modules` and a direct `tsdown` invocation produced it without ever dirtying the
  worktree — which matters, because T-04-26 is precisely the threat of a probe leaking into the gate.

## Known Stubs

None introduced. The only stub in this phase's surface remains 04-03's deliberate `dispatch`,
unchanged, documented in the source and in `src/index.ts`'s module doc comment, and owned by Phase 6.
This plan adds no runtime code and no test.

## Threat Flags

None. This plan opens no network endpoint, no auth path and no file access pattern, and changes no
schema at a trust boundary. Every `mitigate` disposition in its register was discharged:

| Threat | Verification |
|---|---|
| T-04-19 (false prose in the shipped declarations) | Eight literals across six files, each measured on the pre-correction tree first; every hit read; 7 of 8 shown able to fire and the eighth logged no-coverage. Three corrections confirmed at 0 |
| T-04-07 (a getter inside a consumer-supplied `jsonSchema`) | **accept** — recorded as measured-open in the phase-close statement, in `04-VALIDATION.md`'s carve-out (guard held at 1) and in `test/concierge.test.ts` S15 |
| T-04-26 (an unrestored mutation probe reaching the artifact) | `git status --porcelain` empty; `git diff -- packages/concierge/src/` empty; all three source checksums identical to the values 04-05 and 04-07 recorded independently; the pre-correction build was done in `/tmp`, never in the worktree |
| T-04-SC (supply chain) | `pnpm-lock.yaml` byte-identical against the phase merge base; `pnpm check:deps` exit 0 with `@standard-schema/spec` at **0 bytes**; nothing installed |
| T-04-20 (a validation map with predicted rather than observed statuses) | All 17 rows sourced from a summary naming the command that produced them; the one box that could not be verified true is left unticked and sign-off is withheld |

## User Setup Required

None.

## Next Phase Readiness

**Ready, with one piece of housekeeping that is not a blocker.**

Phase 5 (bridges) can proceed: the type contract is stable, `_stageExplanationBridgeShape` pins
`{readonly id: string; readonly registered: boolean} | null` with `Equals` so a change goes red at
`concierge.test-d.ts:141` rather than passing quietly, and 04-01 chose that shape specifically so
Phase 5 would not have to change it.

Three things the next planner should carry:

1. **The withheld sign-off is a documentation debt, not a correctness one.** Reword the
   acceptance-criteria-provenance box to its intent and back-fill guard labels in 04-01, 04-04,
   04-05, 04-06 and 04-07. Nothing in this phase's evidence depends on it.
2. **`explain()` cannot distinguish a thrown matcher from a false one.** If Phase 5 or 6 wants that,
   it is a fourth `Explanation` field and a deliberate decision — `_explanationHasExactlyThreeFields`
   will go red, which is the point. Move the pin; do not relax it to `Assignable`.
3. **SEC-03's getter channel stays open.** Any statement that SEC-03 is closed must carry the
   carve-out, and `REQUIREMENTS.md` keeps SEC-03 `Pending` on purpose.

## Self-Check: PASSED

- `.planning/phases/04-stages-catalog-assembly-and-explain/04-VALIDATION.md` — FOUND (modified)
- `.planning/REQUIREMENTS.md` — FOUND (modified)
- `.planning/phases/04-stages-catalog-assembly-and-explain/04-08-SUMMARY.md` — FOUND (this file)
- Commit `f1da262` — FOUND in `git log`
- Commit `425b698` — FOUND in `git log`
- `git diff --name-only 4cf4c62..HEAD` — exactly the two files above, plus this summary
- Neither commit deleted a tracked file (`git diff --diff-filter=D` empty on both)
- `pnpm-lock.yaml` — byte-identical to the phase merge base
- `.planning/STATE.md`, `.planning/ROADMAP.md` — **NOT** modified (the orchestrator owns them)
- Seven gates re-run at close: all exit 0, 7 files / 86 tests

---
*Phase: 04-stages-catalog-assembly-and-explain*
*Completed: 2026-07-30*
