---
phase: 02-packaging-build-and-release
plan: 05
subsystem: packaging
tags: [pkg-05, rolldown, module-graph, zero-runtime-deps, defect-first-proof, scripts, esm-conditions]

# Dependency graph
requires:
  - phase: 02-packaging-build-and-release
    plan: "02-02"
    provides: "scripts/mutate-and-prove.sh — the harness P5b runs through"
  - phase: 02-packaging-build-and-release
    plan: "02-03"
    provides: "pnpm build — the built artifact Assertion A bundles"
  - phase: 02-packaging-build-and-release
    plan: "02-01"
    provides: "rolldown@1.2.0 as a direct root devDependency, so the bare specifier resolves under pnpm's strict layout"
provides:
  - "scripts/pkg05-zero-runtime-deps.mjs — two independent assertions: rolldown module graph of the built artifact, and ESM runtime entry byte size of every declared dependency"
  - "root `check:deps` — the named command CI and the phase gate call"
  - "The PKG-05 reading locked in writing, in the script header and in the success sentence, BEFORE assertSingleInstance exists"
  - "The pre-hinge baseline: 1 module / 0 vendored / 0 external, 0-byte dependency entry, 2,961-byte dist/index.js"
  - "Both halves of the probe observed failing under deliberate defects"
affects:
  - "02-06 — assertSingleInstance lands against this baseline; the probe must stay green"
  - "02-10 — CI runs `pnpm run check:deps`"
  - "02-04, 02-09, 02-12 — every plan that mutates a manifest and gates with `pnpm run`: see the lockfile hazard below"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "scripts/ convention extended to .mjs: header line naming the requirement ID, entry as process.argv[2], exits 0|1"
    - "Defect-first proof (shared pattern C) — a probe with one untested half is half a guard, so both assertions were proven independently"
    - "Dependency byte accounting resolves through the ESM condition, never require.resolve — a dual-published dep silently resolves its CJS entry"

key-files:
  created:
    - scripts/pkg05-zero-runtime-deps.mjs
  modified:
    - package.json

key-decisions:
  - "Reading (a) locked — core's DEPENDENCIES contribute zero runtime bytes. (b) rejected in writing because it becomes unsatisfiable at 02-06 and every later phase would violate it"
  - "Assertion B resolves the ESM (`import`) condition, not require.resolve: measured, require.resolve picks @standard-schema/spec's 754-byte .cjs and would have made the clean baseline RED"
  - "Package location by node_modules upward walk rather than require.resolve — condition-independent, and correct under pnpm's strict layout where the dep is NOT hoisted to the root"
  - "Assertion A scans every chunk and counts unresolved dynamic-import edges, not just the first chunk's static imports — a dependency reached by dynamic import lands in a second chunk"
  - "Both assertions always run; neither short-circuits the other, so one failure never hides the other's reading"

requirements-completed: [PKG-05]

# Metrics
duration: 11min
completed: 2026-07-28
tasks: 2
commits: 1
files_changed: 2
---

# Phase 2 Plan 05: PKG-05 measured against the artifact — Summary

**`check:deps` bundles the built artifact with rolldown and sizes every dependency's ESM runtime
entry, prints the locked claim `core's dependencies contribute zero bytes to a consumer bundle`,
and has been observed failing in both halves — with the pre-hinge baseline recorded at 1 module /
0 vendored / 0 external before `assertSingleInstance` exists.**

## What Shipped

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Write the PKG-05 probe, lock the claim, record the pre-hinge baseline | `092306c` | `scripts/pkg05-zero-runtime-deps.mjs`, `package.json` |
| 2 | Mutant P5 — prove both halves fail when they should | *no commit* | `packages/concierge/package.json` (transient only) |

Task 2 changed no tracked file — both proofs restore, and one of them never mutates the repository
at all. Its deliverable is the recorded evidence below, committed with this SUMMARY. This follows
the precedent set by 02-02 Task 2.

Net diff against the wave-2 base (`a71f421`): 2 files — one addition, one modified. `pnpm-lock.yaml`
is byte-unchanged.

## The claim, locked

Reading **(a)** — *core's **dependencies** contribute zero runtime bytes to a consumer bundle* — is
written into the script header and printed verbatim as the success sentence. Reading **(b)**
(*core itself ships zero bytes*) is rejected in the header, with the reason recorded: it becomes
unsatisfiable the moment `assertSingleInstance()` lands in 02-06, and Phases 3–8 add thousands of
bytes of genuine consent kernel. A criterion every subsequent phase violates is a criterion that
gets quietly dropped, and a dropped criterion is worse than an absent one because the requirement
still reads as covered.

The hard fact that settles it is recorded too, and re-verified on this tree rather than taken from
research — `packages/concierge/dist/index.d.ts` line 1, verbatim:

```
import { StandardSchemaV1 } from "@standard-schema/spec";
```

The dependency edge is real. It stays in `dependencies` and must not be "fixed" into
`devDependencies`; what is zero is its *runtime* contribution.

The success sentence is deliberately not `has no deps`:

```
core's dependencies contribute zero bytes to a consumer bundle
```

## The pre-hinge baseline — this plan's most important output

Measured on the committed tree after `pnpm build`, **before any runtime code exists**. 02-06
compares against these five numbers.

| Measure | This tree | Research measured | Note |
|---|---|---|---|
| modules in graph | **1** | 1 | matches |
| vendored (`node_modules`) modules | **0** | 0 | matches |
| unbundled external imports | **0** | 0 | matches |
| `@standard-schema/spec` runtime entry | **0 bytes** | 0 bytes | matches |
| `packages/concierge/dist/index.js` | **2,961 bytes** | 1,034 bytes | differs — see below |

Resolved dependency entry path:
`packages/concierge/node_modules/@standard-schema/spec/dist/index.js` — via `exports["."]`,
**no fallback was needed**.

**The `dist/index.js` delta is not a regression.** Research measured 1,034 bytes on 2026-07-27;
`types.ts` grew through the rest of Phase 1 to 1,537 lines / 76,599 bytes. 02-03 recorded the same
delta independently (2.96 kB built, against research's 1.03 kB). Recorded here so 02-06 compares
against **2,961**, not against research's 1,034, when it reports what `assertSingleInstance` costs.

Clean run, verbatim:

```
PKG-05 — core's runtime dependency footprint
  entry:    packages/concierge/dist/index.js
  manifest: packages/concierge/package.json

Assertion A (PKG-05a) — module graph of the built artifact
  chunks: 1
  modules in graph: 1
    /…/packages/concierge/dist/index.js
vendored modules: []
unbundled external imports: []
  Assertion A: PASS

Assertion B (PKG-05b) — ESM runtime entry byte size of each dependency
  @standard-schema/spec  0 bytes
    resolved via exports["."] -> packages/concierge/node_modules/@standard-schema/spec/dist/index.js
    note: its `require` entry is 754 bytes and is unreachable through core, which is ESM-only
  Assertion B: PASS

core's dependencies contribute zero bytes to a consumer bundle
```

## Defect-first proofs — both halves observed failing

### P5a — the module-graph half. Exit **1**.

Run against a synthesized entry in `mktemp -d`, outside the repo. Verbatim, the load-bearing lines:

```
Assertion A (PKG-05a) — module graph of the built artifact
  chunks: 1
  modules in graph: 2
    /private/var/folders/…/tmp.vkL0pF0jTf/node_modules/probe-vendor/index.js
    /private/var/folders/…/tmp.vkL0pF0jTf/entry.mjs
vendored modules: /private/var/folders/…/tmp.vkL0pF0jTf/node_modules/probe-vendor/index.js
unbundled external imports: node:url
  Assertion A: FAIL

Assertion B (PKG-05b) — ESM runtime entry byte size of each dependency
  @standard-schema/spec  0 bytes
  Assertion B: PASS

FAIL: Assertion A (PKG-05a, module graph) — the artifact carries runtime bytes
```

`P5A_EXIT=1`. Both signals fired independently, and **Assertion B correctly stayed PASS** — one
failure does not mask the other's reading.

| Measure | P5a observed | Research's `nanoid` mutant |
|---|---|---|
| modules in graph | **2** | 3 |
| vendored | **1** | 2 |
| unbundled externals | **1** (`node:url`) | 1 (`node:crypto`) |
| exit | **1** | 1 |

The counts differ because the scratch vendor is a single file with no transitive dependency, where
`nanoid` pulls in two modules. The two *signals* are identical, which is what the assertion tests.

**Why P5a does not use `mutate-and-prove.sh`:** it mutates no tracked file, so there is nothing to
restore and the harness would abort. The whole mutant lives in a `mktemp -d` outside the repo —
outside `packages/` deliberately, because a scratch directory under `packages/` is swallowed by
`pnpm-workspace.yaml`'s `packages/*` glob. `git diff --exit-code` exited 0 and `git status
--porcelain` was **empty** immediately afterwards; the scratch directory was `rm -rf`'d in the same
Bash call.

### P5b — the manifest half. Harness **PASS**, exit **0**.

Through `scripts/mutate-and-prove.sh`, applied and restored in one invocation. The pattern
`"@standard-schema/spec": "^1.0.0"` occurs exactly **once** in the target (verified before the run),
and it contains a `/` — so this mutant re-exercises 02-02's slash fix. Verbatim:

```
$ node scripts/pkg05-zero-runtime-deps.mjs packages/concierge/dist/index.js
PKG-05 — core's runtime dependency footprint
  entry:    packages/concierge/dist/index.js
  manifest: packages/concierge/package.json

Assertion A (PKG-05a) — module graph of the built artifact
  chunks: 1
  modules in graph: 1
    /…/packages/concierge/dist/index.js
vendored modules: []
unbundled external imports: []
  Assertion A: PASS

Assertion B (PKG-05b) — ESM runtime entry byte size of each dependency
  @standard-schema/spec  0 bytes
    resolved via exports["."] -> packages/concierge/node_modules/@standard-schema/spec/dist/index.js
    note: its `require` entry is 754 bytes and is unreachable through core, which is ESM-only
  typescript  113 bytes
    resolved via exports["."] -> packages/concierge/node_modules/typescript/lib/version.cjs
  Assertion B: FAIL

FAIL: Assertion B (PKG-05b, dependency byte size) — a dependency is not zero-byte
[ELIFECYCLE] Command failed with exit code 1.
PASS: gate fired (exit 1), tree clean
```

`typescript` is named, its resolved path is printed, its byte size is **113 > 0**, and Assertion B
is named as the failing one while Assertion A correctly stays PASS.

**113 bytes is smaller than expected and worth recording**: TypeScript 7.0.2's `exports["."]` is
`./lib/version.cjs`, a three-line version stub, not the multi-megabyte compiler. The mutant is still
valid — the assertion is `!== 0`, not "under some threshold" — but a future plan reaching for a
"large" dependency should not assume `typescript` provides one.

After the invocation: `git diff --exit-code -- packages/concierge/package.json` exit 0,
`git diff --exit-code` (whole tree) exit 0, `pnpm-lock.yaml` **byte-identical**
(`332c8a58d953…` before and after), `git status --porcelain` empty.

## The lockfile hazard — a finding every later mutation plan needs

**`pnpm run <script>` performs a pre-run install, and against a mutated manifest that install writes
`pnpm-lock.yaml` — outside the harness's restore scope.** The harness restores only its declared
target, so the collateral write survives the invocation that made it. Observed verbatim on the first
P5b run:

```
Scope: all 2 workspace projects
✓ Lockfile passes supply-chain policies (verified 30m ago)
Progress: resolved 313, reused 236, downloaded 0, added 0, done
Done in 765ms using pnpm v11.17.0
$ node scripts/pkg05-zero-runtime-deps.mjs packages/concierge/dist/index.js
```

and the resulting diff, after the harness had already reported `PASS … tree clean`:

```
 diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
+      typescript:
+        specifier: 7.0.2
+        version: 7.0.2
```

This is exactly the class of defect the phase's mutation discipline exists to prevent, and the
harness cannot see it: its post-condition is scoped to `$TARGET`. It self-heals only if a later
`pnpm run` happens to fire against the restored manifest — which is luck, not a guarantee.

**Isolated, not assumed.** With a gate that invokes `node` directly and never touches `pnpm`, the
lockfile stayed byte-identical and `git status --porcelain` was empty. `pnpm` is the writer.

**The fix, and the two forms that do *not* work:**

| Form | Effect |
|---|---|
| `npm_config_verify_deps_before_run=false pnpm run …` | ❌ **No effect.** The variable *is* visible inside the gate (`[false]` printed from within), and pnpm writes the lockfile anyway. `pnpm config get verify-deps-before-run` returns `undefined` with the variable set — pnpm does not read this setting from the npm-style env var. |
| `CI=true` / `--frozen-lockfile` | ❌ **Rejected.** The pre-run install would *fail* rather than write, making `pnpm run` exit non-zero before the probe runs. The harness would report `PASS: gate fired` on a proof that never executed — the vacuously-green failure 02-02 exists to prevent. |
| `pnpm --config.verify-deps-before-run=false run check:deps` | ✅ **Works.** Probe ran (`rc=1`, full output present), lockfile byte-identical. |

**Carry-forward for 02-04, 02-09 and 02-12 — any plan mutating a manifest with a `pnpm run` gate:**
use `pnpm --config.verify-deps-before-run=false run <script>` as the gate, and assert
`git diff --exit-code` on the **whole tree**, not just on the harness target. A bare
`git diff --exit-code -- <target>` passes while the lockfile is dirty.

This was worked around inside this plan's scope rather than fixed centrally: `scripts/mutate-and-prove.sh`
is 02-02's file and this plan ran in parallel with 02-04, so editing a shared script mid-wave was
declined in favour of recording the incantation. **A one-line `export
npm_config_…`-equivalent inside the harness is not available** (see the table above); the correct
central fix, if a later plan wants one, is for the harness to append
`--config.verify-deps-before-run=false` when the gate's first token is `pnpm`, or for the phase to
add `verify-deps-before-run=false` to a repo `.npmrc` (there is none today).

## Verification

Both `<verify><automated>` blocks were run:

| Block | Result |
|---|---|
| Task 1 — `pnpm build && pnpm run check:deps \| tee … && grep -q "core's dependencies contribute zero bytes to a consumer bundle"` | **`PKG05_BASELINE_OK`**, exit 0 |
| Task 2 — harness, then `git diff --exit-code`, then `pnpm run check:deps` | **`P5B_PROVEN`**, exit 0 (gate carries `--config.verify-deps-before-run=false`; see above) |

Acceptance criteria, all checked:

- `pnpm run check:deps` exits **0** and prints the locked sentence — yes, both piped and unpiped
  (piping through `tee` was checked explicitly: the last line survives, so `process.exit` does not
  truncate this output)
- `vendored modules:` and `unbundled external imports:` both list `[]` on a clean tree — yes
- `@standard-schema/spec` listed with a resolved path and byte size `0` — yes
- Header states reading **(a)** is locked, why (b) is rejected, and names the `dist/index.d.ts`
  import of `StandardSchemaV1` — lines 8, 22, 29
- `import { rolldown } from "rolldown"` at line 82; `node_modules/.pnpm` appears **0** times
- `node scripts/pkg05-zero-runtime-deps.mjs` with no argument → usage message on stderr, exit **1**
- The script names which assertion failed — proven in both P5a (Assertion A) and P5b (Assertion B)
- Root `scripts["check:deps"]` → `node scripts/pkg05-zero-runtime-deps.mjs packages/concierge/dist/index.js`
- `git diff --exit-code packages/concierge/package.json` → **0**, the package manifest was not
  permanently touched

Phase-level state at exit: `pnpm typecheck` **0**, `pnpm build` **0**, `pnpm run check:deps` **0**.

`rolldown` resolution was confirmed before the script was written, as the plan required:
`node -e "import('rolldown')"` resolved from the repo root to
`node_modules/.pnpm/rolldown@1.2.0/node_modules/rolldown/dist/index.mjs`. No relative path into
`node_modules/.pnpm` was used.

## Tree hygiene (hard constraint 4)

`git status --porcelain` immediately before writing this SUMMARY — **verbatim, the output is
empty, zero lines**:

```
```

Also asserted: `git diff --exit-code a71f421..HEAD -- README.md packages/concierge/README.md
.planning/STATE.md .planning/ROADMAP.md` exits **0** — none of the four was touched.
`git diff --exit-code a71f421..HEAD -- pnpm-lock.yaml` exits **0** — this plan installed nothing;
the only install was `CI=true pnpm install --frozen-lockfile --prefer-offline` to bootstrap the
fresh worktree, asserted lockfile-clean immediately afterwards.

Every mutation in this plan was applied and restored inside a single Bash call. The one diagnostic
that dirtied `pnpm-lock.yaml` was restored with `git checkout -- pnpm-lock.yaml` in that same call,
with `git diff --exit-code` asserted after. No mutation crossed a tool-call boundary, and no
`git clean`, `git reset --hard`, or `git stash` was run at any point.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `require.resolve` measures the CJS entry, and would have made the clean
baseline RED**

- **Found during:** Task 1, before the script was written
- **Issue:** The plan prescribes resolving each dependency's runtime entry with
  `createRequire(pathToFileURL(resolve(manifestPath)))` then `require.resolve(name)`, and
  anticipates only one failure mode — `require.resolve` *throwing* for an ESM-only dependency.
  `@standard-schema/spec@1.1.0` is **dual-published**: its `exports["."]` carries both an `import`
  and a `require` condition. So `require.resolve` does not throw. It silently returns the CJS entry:

  ```
  require.resolve("@standard-schema/spec")
    -> …/@standard-schema/spec/dist/index.cjs   754 bytes
  ```

  Assertion B would therefore have failed on a perfectly clean tree, on day one. The prescribed
  fallback chain (`exports["."].default` → `module` → `main`) never triggers, because it is gated on
  the throw that does not happen. The dangerous part is the obvious "fix": relax the assertion from
  `=== 0` to "small enough", which destroys the guard permanently.
- **Fix:** Resolve through the **ESM condition set** (`import`, `module`, `module-sync`, `node`,
  `default`), which yields `dist/index.js` at **0 bytes**. `types` is excluded — it resolves to a
  `.d.ts`, which is not runtime. `require` is excluded because core is ESM-only (`type: "module"`,
  no `require` condition in its own `exports`), so no consumer can reach that CJS file *through
  core*. Package location uses Node's own upward `node_modules` walk rather than `require.resolve`:
  it is condition-independent, and it is correct under pnpm's strict layout, where
  `@standard-schema/spec` lives in `packages/concierge/node_modules/` and is **not** hoisted to the
  repo root. `require.resolve(name + "/package.json")` was also tried and throws
  `ERR_PACKAGE_PATH_NOT_EXPORTED` — this package's `exports` map has no `./package.json` entry.
- **Files modified:** `scripts/pkg05-zero-runtime-deps.mjs`
- **Verification:** Both entries measured directly (0 bytes ESM / 754 bytes CJS); clean baseline
  green; P5b confirms the same code path reports 113 bytes for `typescript` and fails.
- **Committed in:** `092306c`

**2. [Rule 2 - Missing Critical] The non-zero CJS sibling is printed as an annotation**

- **Found during:** Task 1
- **Issue:** A reader who checks the dependency by hand finds a 754-byte `.cjs` next to the 0-byte
  `.js` and concludes the probe is lying or measuring the wrong file — and the "correction" would be
  to switch to `require.resolve`, reintroducing deviation 1.
- **Fix:** When a dependency's `require` condition resolves to a different file, the probe prints
  `note: its \`require\` entry is N bytes and is unreachable through core, which is ESM-only`. It is
  annotation only and is never asserted on. The reasoning is also written into the script header.
- **Files modified:** `scripts/pkg05-zero-runtime-deps.mjs`
- **Committed in:** `092306c`

**3. [Rule 2 - Missing Critical] Assertion A scans every chunk and unresolved dynamic imports**

- **Found during:** Task 1
- **Issue:** The research snippet takes `output.find(o => o.type === "chunk")` — the *first* chunk —
  and reads only its `modules` and `imports`. A dependency reached through `import("pkg")` lands in
  a **second** chunk, so a first-chunk-only reading calls that tree clean. This matters more after
  02-06, not less: lazy-loading is a plausible future pattern in a package that currently has no
  runtime code at all, and the plan requires the probe to still be meaningful then.
- **Fix:** `vendored` is computed across **every** chunk in the output; `externals` is the union of
  every chunk's `imports` plus every `dynamicImports` entry that is *not* an emitted chunk filename
  (an internal split names an emitted file; anything else is a real external edge). On a clean
  single-chunk tree this is byte-identical to the prescribed reading — the baseline is still
  1 / 0 / 0 — so it is a strict superset, not a behaviour change. The two labelled output lines the
  acceptance criteria name are unchanged.
- **Files modified:** `scripts/pkg05-zero-runtime-deps.mjs`
- **Committed in:** `092306c`

**4. [Rule 3 - Blocking] The P5b gate needed `--config.verify-deps-before-run=false`**

- **Found during:** Task 2
- **Issue:** `pnpm run check:deps` against the mutated manifest wrote `pnpm-lock.yaml`, leaving a
  mutation live outside the harness's restore scope. Full analysis, the isolation that proves pnpm
  is the writer, and the two forms that do **not** work are in *The lockfile hazard* above.
- **Fix:** The P5b gate is `pnpm --config.verify-deps-before-run=false run check:deps`. The gated
  script is still the named root `check:deps` — the flag disables an unrelated pnpm side effect and
  changes nothing the probe does. The root `package.json` was **not** changed for this: the plan and
  the parallel-wave instruction both require the root manifest edit to stay minimal.
- **Files modified:** none (invocation-level)
- **Verification:** lockfile byte-identical (`332c8a58d953…`) before and after; probe output present
  in full, so the gate was not vacuously green.

### Deviations that were considered and declined

- **Editing `scripts/mutate-and-prove.sh` to neutralize the hazard centrally.** Declined: it is
  02-02's file, this plan ran in parallel with 02-04 in the same wave, and the executor brief
  required keeping shared-file edits minimal for a clean merge. Recorded as a carry-forward instead.
- **Adding a repo `.npmrc` with `verify-deps-before-run=false`.** Declined: outside this plan's
  `files_modified`, and it would change behaviour for every command in the repo, including CI, to
  fix a mutation-testing-only problem.

---

**Total deviations:** 4 auto-fixed (1 bug in the prescribed measurement, 2 missing-critical
hardenings, 1 blocking invocation fix). **Impact on plan:** no scope creep — deviations 1–3 are all
inside `scripts/pkg05-zero-runtime-deps.mjs`, the plan's own artifact; deviation 4 changed no file.
Deviation 1 is load-bearing: as prescribed, the clean baseline would have been red and the natural
repair would have removed the guard.

## Issues Encountered

- **`pnpm config get verify-deps-before-run` returns `undefined` even when
  `npm_config_verify_deps_before_run` is exported and visible to the gate process.** pnpm 11.17.0
  does not read this setting from the npm-style environment variable. `--config.<key>=<value>` on
  the CLI does work. Recorded because the env-var form *appears* to work on an already-in-sync tree
  (no install banner is printed) and only reveals itself as a no-op once a manifest is genuinely out
  of sync — which is precisely the mutation-testing case.
- **TypeScript 7.0.2's `exports["."]` is `./lib/version.cjs`, 113 bytes** — a version stub, not the
  compiler. Fine for a `!== 0` assertion, misleading if a later plan wants a "large" dependency.

## Known Stubs

None. Every branch of the probe was executed at least once: clean (both PASS), P5a (A FAIL / B PASS),
P5b (A PASS / B FAIL), and the missing-argument usage path.

Two defensive branches were **not** exercised, and are named rather than claimed: the
`ENTRY MISSING` path (a dependency whose `exports` target does not exist on disk) and the
`NOT INSTALLED` path (a declared dependency with no `node_modules` directory above the manifest).
Both fail closed — they set `ok = false` — so an unexercised branch cannot produce a false green.

## Threat Model Outcomes

| Threat | Disposition | Evidence |
|---|---|---|
| T-02-20 dependency substitution or addition at install time | **mitigated, and observed** | P5b: adding one dependency to the manifest turns `check:deps` red, naming the package, its resolved path and its byte size. Visible in CI, not only in a lockfile diff. |
| T-02-21 a probe that has never been observed failing | **mitigated** | Both halves proven independently — P5a exit 1 on the module graph with Assertion B still PASS, P5b exit 1 on the manifest with Assertion A still PASS. Neither half was assumed. |
| T-02-22 inlined vendor code carrying transitive surface into consumer bundles | **mitigated, and strengthened** | Assertion A fails on any module id containing `node_modules`, across **all** chunks, plus unresolved dynamic-import edges (deviation 3). P5a observed it firing on a genuinely vendored module. |
| T-02-23 an ambiguous requirement quietly reinterpreted after the fact | **mitigated** | Reading (a) is in the script header and is the printed success sentence, fixed on disk in commit `092306c` before `assertSingleInstance` exists. It cannot be renegotiated in 02-06 without a visible diff to this file. |
| T-02-SC npm/pnpm installs | **accepted, and held** | This plan installed nothing. `pnpm-lock.yaml` is byte-identical to the wave-2 base. The one transient lockfile write was caused by pnpm's pre-run install, was detected, isolated, and prevented — see *The lockfile hazard*. |

## Threat Flags

None. This plan introduces no network endpoint, auth path, file-access pattern, or schema at a trust
boundary. The one new file is a read-only measurement: it bundles an already-built artifact
in-memory, `statSync`s files inside `node_modules`, and writes nothing.

## User Setup Required

None.

## Next Phase Readiness

1. **02-06 (the hinge) is unblocked.** The probe exists, is green, and its baseline is recorded
   *before* any runtime code — which was the entire reason for this plan's position in the ordering.
   When `assertSingleInstance` lands, `pnpm run check:deps` must stay green: the claim is about
   dependencies, and core's own bytes are explicitly out of scope by the locked reading. State the
   new `dist/index.js` byte size against **2,961**, not against research's 1,034.
2. **02-06 must not move `@standard-schema/spec` to `devDependencies`.** `dist/index.d.ts` line 1
   imports from it; the edge is real and the script header says so.
3. **02-10 (CI):** run `pnpm run check:deps` after `pnpm build`. It requires a built artifact — the
   entry is `packages/concierge/dist/index.js` and the probe fails loudly (naming Assertion A) if it
   is absent, rather than reporting a clean graph.
4. **02-04, 02-09, 02-12 and any later manifest mutant:** the `pnpm run` lockfile hazard above is
   the important carry-forward. Gate with
   `pnpm --config.verify-deps-before-run=false run <script>` and assert `git diff --exit-code` on the
   whole tree.
5. If a second dependency is ever added to core, the probe already sizes it — no change needed. If
   that dependency is CJS-only, Assertion B falls back to `module`/`main` and prints which source it
   used, so the fallback is visible rather than silent.

## Self-Check: PASSED

Files claimed created/modified, verified present on disk:

- `scripts/pkg05-zero-runtime-deps.mjs` — FOUND, 298 lines; `import { rolldown } from "rolldown"` at
  line 82; `node_modules` referenced; `process.argv[2]` as the entry
- `package.json` — FOUND; `scripts["check:deps"]` =
  `node scripts/pkg05-zero-runtime-deps.mjs packages/concierge/dist/index.js`; `build` still
  `pnpm -r build`; `check:artifact` unchanged; no other script added or removed
- `.planning/phases/02-packaging-build-and-release/02-05-SUMMARY.md` — FOUND

Commits claimed, verified in `git log`:

- `092306c` — FOUND (`chore(02-05): PKG-05 probe measuring the artifact, with the claim locked`)

`git diff --name-status a71f421..HEAD` lists **exactly two** files before this SUMMARY commit —
`M package.json`, `A scripts/pkg05-zero-runtime-deps.mjs` — both inside this plan's declared scope.
No source file, `README.md`, `pnpm-lock.yaml`, `STATE.md` or `ROADMAP.md` appears. No commit in this
plan contains a deletion (`git diff --diff-filter=D` empty).

---
*Phase: 02-packaging-build-and-release*
*Completed: 2026-07-28*
