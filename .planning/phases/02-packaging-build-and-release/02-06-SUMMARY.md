---
phase: 02-packaging-build-and-release
plan: 06
subsystem: packaging
tags: [pkg-04, pkg-05, contract-version, single-instance, tree-shaking, side-effects, symbol-for, rolldown, isolated-declarations]

# Dependency graph
requires:
  - phase: 02-packaging-build-and-release
    plan: "02-03"
    provides: "tsdown build with attw/publint gates, and the 43-name export-surface baseline"
  - phase: 02-packaging-build-and-release
    plan: "02-05"
    provides: "check:deps, the locked reading (a) of PKG-05, and the 2,961-byte pre-hinge dist/index.js baseline"
provides:
  - "packages/concierge/src/contract.ts — CONTRACT_VERSION and assertSingleInstance, the mechanism behind PKG-04"
  - "The duplicate-instance check on a reachable code path, never at module scope"
  - "Registry key Symbol.for(\"@fullselfbrowsing/concierge.contract\") — exact, load-bearing, hard-coded by 02-07's tests"
  - "Public export surface of 45 names (39 types + 6 values), still one trailing export block"
  - "PKG-05 re-measured green with the package's first runtime code present"
  - "A re-measurement on this tree of the tree-shaking claim the design rests on"
affects:
  - "02-07 — asserts the 45-name surface, hard-codes the registry key, and mutant P6 regresses the module-scope form"
  - "02-08 — the two fixture adapters that prove one shared core instance"
  - "02-09 — the Node-floor import harness calls assertSingleInstance"
  - "02-10 — CI runs typecheck, build, check:artifact and check:deps"
  - "02-12 — compares this SUMMARY's 63/587 pair against 02-07's"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "src/ runtime module convention: file header names the constraints a future edit would break, not just what the file contains"
    - "Registry check inside a function body — a module-scope form does not survive sideEffects: false and would test green while doing nothing"
    - "Every comment in a runtime source file is a standalone // or /** */ line; a trailing comment survives a `grep -v '^[[:space:]]*[/*]'` filter and turns a compliant file red"
    - "Second-source re-export in the barrel: a third export block, not a merge into the ./types.js value block"

key-files:
  created:
    - packages/concierge/src/contract.ts
  modified:
    - packages/concierge/src/index.ts

key-decisions:
  - "CONTRACT_VERSION is unannotated, resolving the 02-PATTERNS ⚠ conflict in favour of types.ts's house style — under isolatedDeclarations the literal `1` reaches the emitted .d.ts either way, verified as `declare const CONTRACT_VERSION = 1;`"
  - "REGISTRY_KEY is annotated `: symbol` rather than left to infer `unique symbol` — the identity that matters is the registry string, not this binding"
  - "ContractRecord.version is `number`, not the literal `1`: typing it as the literal makes the mismatch branch unreachable to the checker"
  - "The thrown message is built by concatenation so it emits as a single line; both mandated regexes match at runtime, not merely in source"
  - "`globalThis` appears on exactly one line of contract.ts, inside the function body — prose elsewhere says 'the global object' so that a naive grep-based guard in 02-07 cannot be tripped by a comment"
  - "PKG-05 reading (a) holds: dist/index.js grew 2,961 -> 9,739 B, all of it core's own code and doc comments, zero of it dependency bytes"

patterns-established:
  - "Defect-adjacent commenting: the constraint is written at the exact line where the tempting edit happens, not in a doc"
  - "Re-measure inherited numbers on the real tree in a mktemp -d outside the repo, and label the re-measurement separately from the canonical pair"

requirements-completed: []

# Metrics
duration: 13min
completed: 2026-07-29
tasks: 2
commits: 2
files_changed: 2
---

# Phase 2 Plan 06: The hinge — CONTRACT_VERSION and assertSingleInstance Summary

**The package's first executable code: a duplicate-instance guard that lives inside a function body
because `sideEffects: false` deletes module-scope registration from every bundled consumer — measured
again here at 0 bytes when uncalled and present verbatim when called — plus a public surface of 45
names and a PKG-05 measurement that stays green with runtime code present.**

## Performance

- **Duration:** ~13 min
- **Tasks:** 2
- **Files changed:** 2 (1 created, 1 modified)

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Create `src/contract.ts` with the check on a reachable path | `4c8420f` | `packages/concierge/src/contract.ts` |
| 2 | Export the two values, correct the barrel header, reconcile PKG-04 with PKG-05 | `dd2fe7f` | `packages/concierge/src/index.ts` |

Net diff against the wave-3 base (`ca3b4dd`): `A packages/concierge/src/contract.ts`,
`M packages/concierge/src/index.ts`. Nothing else. `pnpm-lock.yaml` is byte-unchanged;
`packages/concierge/package.json` and `src/types.ts` are byte-unchanged.

## What shipped

`packages/concierge/src/contract.ts` — 166 lines, **zero imports**, one exported constant and one
exported function:

```ts
export const CONTRACT_VERSION = 1;
const REGISTRY_KEY: symbol = Symbol.for("@fullselfbrowsing/concierge.contract");
export function assertSingleInstance(): void { … }
```

`ContractRecord` and `Holder` are module-private and are not merely absent from the export list —
rolldown's dts bundler drops them from `dist/index.d.ts` entirely.

Behaviour, exercised against **the built artifact** and not only the source:

| Case | Result |
|---|---|
| no prior record | writes `{ version: 1 }`, returns |
| prior record, same version | returns quietly — **adopts** |
| prior record, different version | throws, naming both versions and the remediation |

```
concierge: two different copies of @fullselfbrowsing/concierge are loaded (contract v99 and v1).
Adapters must resolve the same core instance — check that every @fullselfbrowsing/concierge-*
package has core as a peerDependency and that your lockfile has exactly one entry for it.
Run: pnpm why @fullselfbrowsing/concierge
```

It is **one line** at runtime (the source concatenates for readability), so `/two different copies/`
and `/peerDependency/` both match the emitted string, not just the source text. It interpolates the
two version integers and nothing else — no path, no environment value, no user data.

## The export surface: 43 -> 45, nothing lost

Measured on the rebuilt `dist/index.d.ts`:

| Measure | 02-03 baseline | Now |
|---|---|---|
| `export { … }` blocks in the trailing surface | 1 | **1** — no union needed |
| names | 43 | **45** |
| types | 39 | **39** |
| values | 4 | **6** |

Values are now `CONSENT_GRADE_ORDER`, `CONTRACT_VERSION`, `MESSAGE_MAX_CHARS`, `USER_CANCELLED`,
`USER_DECLINED`, `assertSingleInstance`. All four previous value names and all 39 type names are
still present.

**02-07 needs no union logic.** A second source module was bundled and rolldown still emitted a
single trailing `export { … }` statement. The plan asked for this to be recorded either way; the
answer is one block.

Absent from the export list, as required:

| Name | Declared in `dist/index.d.ts` | In export list |
|---|---|---|
| `serverChallengeBrand` | yes | **no** |
| `ConsentAckBase` | yes | **no** |
| `ContractRecord` | **no** | no |
| `Holder` | **no** | no |

The literal type survived: `dist/index.d.ts:1392` is `declare const CONTRACT_VERSION = 1;`, not
`: number`. That is the whole reason the annotation was omitted rather than written `: 1`.

## PKG-04 / PKG-05 reconciliation — the step worth the explicit line

`pnpm run check:deps` exits **0** with runtime code present. Both assertions verbatim:

```
vendored modules: []
unbundled external imports: []
  Assertion A: PASS
  @standard-schema/spec  0 bytes
  Assertion B: PASS

core's dependencies contribute zero bytes to a consumer bundle
```

| Measure | 02-05 pre-hinge baseline | Now |
|---|---|---|
| modules in graph | 1 | **1** |
| vendored modules | 0 | **0** |
| unbundled external imports | 0 | **0** |
| `@standard-schema/spec` runtime entry | 0 bytes | **0 bytes** |
| `packages/concierge/dist/index.js` | 2,961 B | **9,739 B** |

**The locked reading of PKG-05 is (a) — core's *dependencies* add zero runtime bytes — so this
growth is core's own code and does not violate it.** Reading (b) (*core itself ships zero bytes*)
was rejected in plan 02-05, in writing, in `scripts/pkg05-zero-runtime-deps.mjs`'s header and in its
printed success sentence, **before this code existed** — precisely so that this moment could not be
renegotiated. Nothing in this plan touched that script or that sentence.

### The +6,778 B is 87% doc comments, and that is worth stating plainly

Research predicted "roughly 1.5 kB" for the post-hinge artifact. This tree measures 9,739 B, and the
gap is not runtime code:

| Composition of `dist/index.js` | Bytes |
|---|---|
| comment-only lines (161 of 192) | **8,606** |
| everything else | **1,134** |

tsdown does not minify, and `types.ts`'s JSDoc never appeared in the bundle because it was attached
to declarations that get erased. `contract.ts`'s JSDoc is attached to code that survives, so it ships
verbatim. `assertSingleInstance` itself compiles to ~600 B. Every consumer bundler minifies for
production and strips all of it; the number matters only as the published artifact size.

This is stated rather than fixed. Stripping comments would need a `tsdown.config.ts` change, which is
outside this plan's `files_modified`, and would delete the header that is this plan's primary
deliverable — `src/` also ships in `files`, so the source is what a consumer reads anyway.

## The tree-shaking measurement the design rests on

Recorded in the plan's mandated wording, from the shape-faithful mirror measured in research:

> **63 B uncalled / 587 B called — the registry code itself contributes 0 bytes when uncalled.**

The 63 B is the floor a bundle costs for the constant it does import; the zero being claimed is the
registry code's contribution, not the bundle's total. Plan 02-07 records the identical pair and plan
02-12 compares the two SUMMARYs.

### Re-measured on this tree — corroboration, labelled separately

Because this is the first plan where the real package (not a mirror) can be measured, both consumers
were bundled with rolldown 1.2.0 against the built artifact, in a `mktemp -d` outside the repo, with
a `node_modules/@fullselfbrowsing/concierge` symlink so the **bare specifier** resolves through
`exports` exactly as a consumer's would.

| Consumer | Total chunk | Minus rolldown's `//#region` banner | Registry code present? |
|---|---|---|---|
| imports `CONTRACT_VERSION`, does **not** call | 147 B | **15 B** (`console.log(1);`) | **No** |
| imports both and calls `assertSingleInstance()` | 3,962 B | 3,819 B (**918 B** excluding block comments) | **Yes, verbatim** |

The absolute numbers differ from research's pair — the banner carries a long temp path, the real
package's JSDoc rides along unminified, and three `Object.freeze` calls from `types.ts` are retained
(see below). **The load-bearing fact reproduces exactly**: `REGISTRY_KEY` and `assertSingleInstance`
are entirely absent from the uncalled bundle and present verbatim in the called one. Zero cost when
unused, fully present when used, `sideEffects: false` still honest.

These re-measured numbers are deliberately *not* substituted for 63/587 anywhere, so 02-12's
comparison against 02-07 reads on the same pair.

## Decisions Made

1. **`CONTRACT_VERSION` is unannotated.** This resolves the ⚠ conflict 02-PATTERNS flagged.
   `02-RESEARCH.md:241` prescribes `: 1 = 1` and calls it "the same trick `MESSAGE_MAX_CHARS` uses";
   it is not the same trick, and `MESSAGE_MAX_CHARS`'s own doc comment says it is *deliberately*
   unannotated. Both forms preserve the literal in the `.d.ts` — verified: `declare const
   CONTRACT_VERSION = 1;`. Matching `types.ts` and explaining why in the doc comment leaves the two
   files agreeing on house style. Annotating `: number` is the only form that loses anything.
2. **`REGISTRY_KEY: symbol`, not inferred `unique symbol`.** Nothing wants the nominal identity of
   this binding; the registry *string* is the identity, which is the entire reason `Symbol.for` is
   used instead of `Symbol()`. Documented at the declaration.
3. **`ContractRecord.version` is `number`.** The record being read may have been written by a
   different version of this file — the case the guard exists to detect. The literal type would make
   the mismatch branch unreachable to the checker and the comparison a compile error.
4. **The message is concatenated, not a multi-line template.** A multi-line template literal embeds
   newlines and could split `two different copies` across a line break, silently failing 02-07's F2
   regex. Verified at runtime: one line, both regexes true.
5. **`globalThis` appears on exactly one line of the file** — `contract.ts:146`, inside
   `assertSingleInstance`'s body. Prose elsewhere says "the global object". The acceptance criterion
   is about statements, but 02-07's mutant P6 guard may well be grep-shaped, and a comment mentioning
   the token would trip it. Costless here, and the prose is no worse for it.
6. **REQUIREMENTS.md was not marked.** See *Requirements status* below.

## Requirements status

`requirements-completed` is deliberately **empty**, and `.planning/REQUIREMENTS.md` was not touched.

- **PKG-04** reads *"The package publishes ESM-only, **and a test asserts a single core instance is
  shared across adapters**"*. This plan ships the mechanism. The test half is 02-07 (F1/F2) and the
  fixture-adapter half is 02-08. Marking it complete now would be false.
- **PKG-05** was delivered and measured by 02-05, which also left REQUIREMENTS.md untouched
  (its rows still read `[ ]` / `Pending`). This plan re-verifies it with runtime code present rather
  than completing it. Following 02-05's precedent keeps the two consistent for whoever closes them.

Both rows are ready to close after 02-07/02-08; flagged here so 02-12 does not read the empty field
as an oversight.

## Verification

Both `<verify><automated>` blocks were run verbatim.

| Block | Result |
|---|---|
| Task 1 — `typecheck && grep -c '^import' == 0 && grep -q 'Symbol.for(…)'` | **`CONTRACT_OK`**, exit 0 |
| Task 2 — `typecheck && build && check:artifact && check:deps && EXPORT_NAMES===45` | exit **0**, `EXPORT_NAMES=45` |

Plan-level `<verification>` block, re-run on the final tree:

| Check | Result |
|---|---|
| `pnpm --filter @fullselfbrowsing/concierge typecheck` | **0** |
| `pnpm build` (attw + publint both clean) | **0** |
| `pnpm run check:artifact` (publint --strict, attw --profile esm-only) | **0** |
| `pnpm run check:deps` | **0** |
| trailing export list = 45 names, 1 block | **yes** |
| `ContractRecord` / `Holder` / `serverChallengeBrand` / `ConsentAckBase` absent from the list | **yes** |
| `contract.ts` `grep -c '^import'` | **0** |
| `contract.ts` non-comment `await` (`grep -v '^[[:space:]]*[/*]' \| grep -c await`) | **0** |
| `globalThis` occurrences | **1**, line 146, inside the function body (fn opens 145) |
| trailing inline comments on code lines | **none** |
| `git diff ca3b4dd..HEAD -- packages/concierge/package.json src/types.ts` | **0** |
| `git diff ca3b4dd..HEAD -- pnpm-lock.yaml` | **0** |
| `"sideEffects"` in the manifest | still `false`, not an array |

Behavioural verification was run twice — once against the TypeScript source via Node's type
stripping, and once against the built `dist/index.js`. Both agree on all three branches, and the
built module exports exactly six runtime names.

## Tree hygiene

`git status --porcelain` immediately before writing this SUMMARY is **empty**. The tree-shaking
measurement and the `Object.freeze` probe both ran entirely inside a `mktemp -d` — outside the repo,
and deliberately outside `packages/`, which `pnpm-workspace.yaml`'s `packages/*` glob would swallow —
and were `rm -rf`'d in the same Bash call that created them. No repo file was mutated for a
measurement. No `git clean`, `git reset --hard`, `git stash`, or blanket checkout was run at any
point. The one install was `CI=true pnpm install --frozen-lockfile --prefer-offline` to bootstrap the
fresh worktree, asserted lockfile-clean afterwards.

## Deviations from Plan

None. The plan executed exactly as written — two tasks, two files, the prescribed constant style, the
prescribed message shape, the prescribed export block.

Two plan instructions were followed in a stricter form than the letter required, and both are recorded
above rather than as deviations because neither changes an artifact the plan specified: the `globalThis`
token was kept out of comments (decision 5), and the throw message was concatenated rather than written
as a multi-line template (decision 4).

## Issues Encountered

**1. The artifact grew 3.3x, and the cause is comments, not code.** Diagnosed rather than assumed:
161 of 192 lines in `dist/index.js` are comment-only, totalling 8,606 of 9,739 bytes. Recorded in
full above. It does not affect PKG-05 under the locked reading (a), and it does not affect a
minified consumer bundle. No action taken — the fix is a build-config change outside this plan's
scope.

**2. `Object.freeze` from `types.ts` is now retained in consumer bundles that call into core.** New
and worth carrying forward. When a consumer only imported constants, rolldown dropped the whole
module. Now that `assertSingleInstance` keeps the module alive, rolldown also keeps `types.ts`'s
three `Object.freeze(...)` calls as bare side-effecting statements — bindings shaken away, calls
retained — costing ~205 B in every consumer that touches any runtime code, forever.

Confirmed with a self-contained probe (a two-constant module in `mktemp -d`, no repo file involved):

```js
export const A = Object.freeze({ a: 1 });                 // retained as `Object.freeze({ a: 1 });`
export const B = /* @__PURE__ */ Object.freeze({ b: 2 }); // removed entirely
```

The remedy is a `/* @__PURE__ */` annotation on each of `USER_CANCELLED`, `USER_DECLINED` and
`CONSENT_GRADE_ORDER` in `src/types.ts`. **Not applied here** — this plan is forbidden from editing
`types.ts`, and it is out of scope for its `files_modified`. Filed below for a later plan.

## Deferred Items

| Item | Detail | Suggested owner |
|---|---|---|
| `/* @__PURE__ */` on `types.ts`'s three `Object.freeze` initializers | ~205 B of dead calls now ride into every consumer bundle that reaches any runtime code. Mechanism proven, remedy proven, three-line change. `types.ts` is out of scope for this plan. | 02-11 or a Phase 3 plan that already opens `types.ts` |
| Whether `dist/index.js` should ship unminified JSDoc | 8,606 of 9,739 bytes. Harmless after a consumer's minifier, but it is the published artifact size and it will keep growing as the kernel lands. A `tsdown.config.ts` decision, not a source one. | 02-11 / 02-12 review |

## Known Stubs

None. Every branch of `assertSingleInstance` was executed against the built artifact: the write path,
the adopt path, and the throw path. There is no placeholder value, no hardcoded empty return, and no
TODO in either file.

The function has **no call site in this phase** — that is by design and is stated in its doc comment,
not a stub: `createConcierge` does not exist until a later phase. It is exercised by 02-07's tests and
02-09's Node-floor harness.

## Threat Model Outcomes

| Threat | Disposition | Evidence |
|---|---|---|
| T-02-24 two core instances splitting the bridge registry, dedup window and consent kernel | **mitigated** | `assertSingleInstance()` on a reachable path; adopt-on-same-version means two copies genuinely share one record. Verified against the built artifact: after the call, `globalThis[Symbol.for(…)]` is `{"version":1}`, and a second call adopts it. |
| T-02-25 a module-scope registry silently removed by tree-shaking | **mitigated, and re-measured** | The check is inside the function body; `globalThis` occurs on exactly one line, at 146, inside it. Re-measured on this tree: the uncalled consumer bundle is 15 B of code with the registry **absent**; the calling one carries it verbatim. The constraint is written in the file header at the exact line where the tempting edit happens. 02-07's mutant P6 regresses it. |
| T-02-26 the thrown mismatch message as an information-disclosure channel | **mitigated** | Two interpolations only — `prior.version` and `CONTRACT_VERSION`, both integers. No path, no environment value, no user data. Verified on the emitted string, not the source. |
| T-02-27 an import-time throw taking down an SSR render | **mitigated** | Nothing executes at module evaluation. The only module-scope statement is `Symbol.for(…)`, which cannot throw. Same-version duplicates adopt, so ordinary duplicate resolution and HMR re-evaluation never reach the throw. |
| T-02-28 `sideEffects` relaxed to keep a module-scope form | **mitigated** | `packages/concierge/package.json` is byte-unchanged since the wave base; `sideEffects` is still `false` and is not an array. No side-effectful subpath export was added. The reason both are refused is written into `contract.ts`'s header, so the next person to consider it reads the measurement first. |
| T-02-SC npm/pnpm installs | **accepted, and held** | This plan installed nothing and added no dependency edge. `contract.ts` has zero imports; `check:deps` re-run as proof; `pnpm-lock.yaml` byte-unchanged. |

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access, and no schema at a trust
boundary. The one new trust boundary it touches — the `globalThis` registry slot — was already in the
plan's threat register as T-02-24/T-02-25 and is addressed there.

## User Setup Required

None.

## Next Phase Readiness

1. **02-07 is unblocked and has three concrete numbers to write against:** the export surface is
   **45** in **one** trailing `export { … }` block (no union logic needed), the registry key is
   `Symbol.for("@fullselfbrowsing/concierge.contract")` exactly, and the thrown message satisfies
   `/two different copies/` and `/peerDependency/` on the **emitted single-line string**.
2. **02-07's mutant P6 has a precise target.** The regression to introduce is hoisting the registry
   read out of `assertSingleInstance`'s body to module scope. The guard must be scoped to
   non-comment lines or it will trip on `contract.ts`'s header, which is *mandated* to discuss the
   constraint.
3. **02-07 records the same tree-shaking pair** — *63 B uncalled / 587 B called — the registry code
   itself contributes 0 bytes when uncalled.* This SUMMARY's own re-measurement (15 B / 918 B of
   code, banner and comments excluded) is labelled separately and is not a substitute for it.
4. **02-09's Node-floor harness** can call `assertSingleInstance()` directly against
   `dist/index.js`; it is exported, synchronous, zero-argument, and safe to call repeatedly.
5. **Do not add a `sideEffects` array or a side-effectful subpath export** to buy anything back. The
   reason is measured and is written into `contract.ts`'s header.
6. **`dist/index.js` is now 9,739 B.** Any later plan reporting artifact growth should compare
   against this, not against 02-05's 2,961 or research's 1,034, and should note the comment share
   before treating a delta as runtime code.

## Self-Check: PASSED

Files claimed created/modified, verified present on disk:

- `packages/concierge/src/contract.ts` — FOUND, 166 lines; `export const CONTRACT_VERSION = 1;` at
  line 62; `export function assertSingleInstance(): void` at line 145; `globalThis` at line 146 only;
  zero lines matching `^import`
- `packages/concierge/src/index.ts` — FOUND, 75 lines;
  `export { CONTRACT_VERSION, assertSingleInstance } from "./contract.js";` at line 75, in a value
  block; header no longer contains "design contract only"
- `.planning/phases/02-packaging-build-and-release/02-06-SUMMARY.md` — FOUND

Commits claimed, verified in `git log`:

- `4c8420f` — FOUND (`feat(02-06): CONTRACT_VERSION and assertSingleInstance on a reachable path`)
- `dd2fe7f` — FOUND (`feat(02-06): export CONTRACT_VERSION and assertSingleInstance from the barrel`)

`git diff --name-status ca3b4dd..HEAD` lists **exactly two** files before this SUMMARY commit —
`A packages/concierge/src/contract.ts`, `M packages/concierge/src/index.ts` — both inside this plan's
declared scope. No `package.json`, `types.ts`, `pnpm-lock.yaml`, `STATE.md`, `ROADMAP.md` or
`REQUIREMENTS.md` appears. No commit in this plan contains a deletion
(`git diff --diff-filter=D` empty on both).

---
*Phase: 02-packaging-build-and-release*
*Completed: 2026-07-29*
