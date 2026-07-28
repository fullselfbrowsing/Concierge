---
phase: 1
slug: type-surface-completion
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-07-28
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**This phase has an unusual validation shape: there is no test runner, and there will not be one
until Phase 2.** The compiler is the entire verification apparatus. `tsc --noEmit` exiting 0 is the
only signal, and every Success Criterion must be reduced to something that makes it exit non-zero.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `tsc --noEmit` — TypeScript **5.9.3** (installed; root `package.json` pins `^5.7.0`) |
| **Assertion library** | **none** — 4 hand-written type aliases (`Expect`, `Equals`, `Assignable`, `Not`), 6 lines total, zero dependencies |
| **Config file** | `packages/concierge/tsconfig.test-d.json` — **does not exist yet, Wave 0 creates it** |
| **Test file glob** | `packages/concierge/test-d/**/*.test-d.ts` — **does not exist yet, Wave 0 creates it** |
| **Quick run command** | `pnpm --filter @fullselfbrowsing/concierge typecheck` |
| **Full suite command** | `pnpm --filter @fullselfbrowsing/concierge typecheck` — *identical; there is only one program* |
| **Workspace-wide command** | `pnpm typecheck` (root, runs `pnpm -r typecheck`) |
| **Estimated runtime** | ~0.2 s on 5.9.3, ~0.08 s on 7.0.2 (~0.4 s wall-clock through pnpm's wrapper) |
| **Current state** | Exits **0 clean** today against `src/` only `[VERIFIED 2026-07-28]` |

**Compiler-version independence is confirmed.** Every experiment behind this strategy was re-run
under TypeScript 7.0.2 (npm `latest`) alongside the installed 5.9.3 and produced byte-identical
diagnostics. Phase 2's compiler bump cannot invalidate this suite.

---

## Sampling Rate

The full program — `types.ts` + `index.ts` + all `test-d/` files — typechecks in ~0.2 s. **There is
no cost argument for sampling less than everything, every time.**

- **After every task commit:** `pnpm --filter @fullselfbrowsing/concierge typecheck` — must exit 0.
  No commit in this phase may be red; every type edit lands with its assertion in the same commit.
- **After every plan wave:** identical command. Phase 1 is a **single serial wave** (every edit
  touches `types.ts`), so this collapses into the per-commit gate.
- **Before `/gsd-verify-work`:** all four of —
  1. `pnpm typecheck` from the repo root exits 0
  2. the ten-mutant battery below has been run and **every** mutant produced a non-zero exit
  3. `ls packages/concierge/dist` after a build attempt shows no `*.test-d.*` artifact
  4. `README.md:72` matches the shipped `ActionResult`
- **Max feedback latency:** < 1 second

---

## Per-Task Verification Map

One row per task across the nine PLAN.md files — **19 tasks**, inventoried with
`grep -n "<name>Task" .planning/phases/01-type-surface-completion/01-0*-PLAN.md`. All nine mapped
items (2 requirement IDs + 7 success criteria) are reducible to compiler assertions — **none is
manual-only.** A task that ships without an automated check is visible here as a missing row rather
than absorbed into a requirement-level cell.

Task IDs use the literal form `01-{plan}-T{n}`; the phase gate counts rows by matching `^| 01-0`.
Where a task's own `<verify><automated>` block specifies more than the bare typecheck, that command
is copied verbatim — with `|` written `\|` so it does not terminate the table cell.

| Task | Req / SC | Behavior | Threat Ref | Test Type | Automated Command | File Exists |
|---|---|---|---|---|---|---|
| 01-01-T1 | SC-7 (harness) | Typecheck program covers `src` + `test-d`; an assertion under `test-d/` is checked by one command; build config untouched | T-01-02 | infrastructure | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ✅ `tsconfig.test-d.json`, `test-d/_assert.ts` |
| 01-01-T2 | SC-7 (harness) | The harness goes red when it should: missing `rootDir` → TS6059; a false predicate → TS2344 naming the alias; `Equals` shown invariant | T-01-02 | falsification | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ✅ same two files |
| 01-01-T3 | — | Validation strategy names real task IDs, agrees with the corrected 12-code count, and records Wave 0 closed | T-01-33 | bookkeeping (grep) | Four checks — `wave_0_complete: true` present, `## Open Questions (RESOLVED)` present in `01-RESEARCH.md`, `grep -c '^\| 01-0'` ≥ 19, and the reason-code miscount absent — then `echo VALIDATION_MAP_OK`. **Command lives in `01-01-PLAN.md` § Task 3 `<verify>` and is deliberately not inlined here:** its last clause greps for a literal that must not appear in this file, so quoting it verbatim would make the gate fail against itself. | ✅ this file |
| 01-02-T1 | SC-2 | `reason` closed to a **12**-code union (3 `AbandonReason` + 9 `FailureReason`); message policy declared (D-01, D-02) | V5, V7 | type (source edit) | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ → `src/types.ts` |
| 01-02-T2 | SC-2, SC-7d | Arbitrary `reason` fails; **12** codes exhaustively switchable; `MESSAGE_MAX_CHARS` is a literal; an arbitrary `reason` string is rejected | V5, V7 | type (negative + exhaustiveness + equality) | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ W0 → `test-d/results.test-d.ts` |
| 01-03-T1 | SC-1, TRN-05/SC-5 | Transport-side delivery hook corrected to carry a `DeliveryReport`; the turn-identity boolean replaced by *provenance* (D-00a, D-10) | Spoofing / V4 | type (source edit) | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ → `src/types.ts` |
| 01-03-T2 | TRN-01/SC-4, TRN-05/SC-5, SC-1, SC-7c | Transport definable end to end with no vendor event name and `keyof Transport` exactly four members; a boolean no longer satisfies turn identity; *both* hooks carry a `DeliveryReport` and a bare-id hook is rejected; a hook dropping the completion reason is caught on *either* interface — **Escapee 2** | V13, V4 | type (structural + equality + negative) | `pnpm --filter @fullselfbrowsing/concierge typecheck && test -z "$(grep -rniE 'response\.done\|conversation\.item\|session\.update' packages/concierge/src packages/concierge/test-d)" && echo NO_VENDOR_VOCABULARY` | ❌ W0 → `test-d/transport.test-d.ts` |
| 01-04-T1 | SC-3 | Readback seam declared as a generic *function*; injected digest (`DigestLike`, method syntax — deliberate opposite of `snapshotEquality`); server-challenge brand (D-03, D-05 first half) | V6 | type (source edit) | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ → `src/types.ts` |
| 01-04-T2 | SC-3, SC-7e | Readback sink returning `{hash, alg, canonicalization, canonical}` is declarable; the seam **rejects a type argument** (`ReadbackSink<Booking>` → TS2315) — **Escapee 1**, the naive assignability assertion proves nothing | V6 | type (equality + directive on a type argument) | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ W0 → `test-d/consent.test-d.ts` |
| 01-05-T1 | SC-6 | `ConsentAck` rewritten **once** — `challenge?` + `attested` union, interface → type alias, generics preserved (D-03 + D-05 + D-07) | Tampering / ASI09 | type (source edit) | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ → `src/types.ts` |
| 01-05-T2 | SC-6, SC-7f | Constructing an `attested` ack without `readbackHash` fails; an `attested` ack with no hash is rejected; narrowing on `grade` yields `string` | Tampering / ASI09 | type (predicate + narrowing) | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ W0 → `test-d/consent.test-d.ts` (part 2) |
| 01-06-T1 | SC-7a, SC-7b, SC-7g, *mechanics* | `Snapshot` and `AckPayload` threaded through `handler` to `ctx.ack`; `readsUntrusted` added to the declaration and kept **out** of `SideEffects`; `any`-erasure lands; `snapshotEquality` stays function-property syntax | Elevation | type (source edit) | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ → `src/types.ts` |
| 01-06-T2 | SC-7a, SC-7b, SC-7g, *mechanics* | `snapshotEquality` degraded to `(a: unknown, b: unknown)` is caught; a `requires` that widens the action's own name union is caught; `readsUntrusted` absent from `SideEffects`; `handler` forwards `Snapshot` **and** `AckPayload` to `ctx.ack` — **Escapee 3**; TS9010 demonstrated on `const confirm = defineAction({…})`, then removed | Elevation | type (equality + directive + predicate) | `pnpm --filter @fullselfbrowsing/concierge typecheck && test -z "$(grep -l '^[[:space:]]*export' packages/concierge/test-d/*.test-d.ts)" && echo NO_EXPORTS_IN_TEST_D` | ❌ W0 → `test-d/actions.test-d.ts` |
| 01-07-T1 | *mechanics* | `ConciergeConfig` seams, the `Scheduler` type, and the `Session` stage members declared (D-03 config half, D-08) | — | type (source edit) | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ → `src/types.ts` |
| 01-07-T2 | *mechanics* | Heterogeneous actions still assemble into `StageDefinition.actions` and `ConciergeConfig.crossStage` | — | type (positive) | `pnpm --filter @fullselfbrowsing/concierge typecheck && test -z "$(grep -l '^[[:space:]]*export' packages/concierge/test-d/*.test-d.ts)" && echo NO_EXPORTS_IN_TEST_D` | ❌ W0 → `test-d/actions.test-d.ts` (appended) |
| 01-08-T1 | — | The export surface in `index.ts` is complete — every declared public type is re-exported | — | type (source edit) | `pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ → `src/index.ts` |
| 01-08-T2 | SC-2 | `README.md`'s `ActionResult` block matches the shipped closed union — `reason?: ReasonCode`, zero occurrences of `reason?: string` | — | doc consistency (grep) | `grep -n "reason?: ReasonCode" README.md && grep -c "reason?: string" README.md \| grep -qx 0 && echo README_CONSISTENT` | ✅ `README.md` |
| 01-09-T1 | *all* | Ten-mutant battery against the final type surface: **every** mutant produces a non-zero exit, and `types.ts` is restored byte-identical after each | *all* | mutation (falsification) | `git diff --exit-code packages/concierge/src/types.ts && pnpm --filter @fullselfbrowsing/concierge typecheck` | ❌ → all `test-d/*.test-d.ts` |
| 01-09-T2 | *all* | Root typecheck green; a real build emits no `*.test-d.*` or `_assert` artifact into `dist`; validation strategy signed off | T-01-01 | phase gate | `pnpm typecheck && pnpm --filter @fullselfbrowsing/concierge exec tsc -p tsconfig.json && ls -R packages/concierge/dist \| grep -c "test-d\|_assert" \| grep -qx 0 && rm -rf packages/concierge/dist && grep -q "^nyquist_compliant: true" .planning/phases/01-type-surface-completion/01-VALIDATION.md && grep -q "^status: complete" .planning/phases/01-type-surface-completion/01-VALIDATION.md && echo GATE_PASS` | ✅ this file |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Suite Adequacy Requirement — mandatory, not stylistic

**A green suite is not evidence of a working suite.** A ten-mutant battery run against a first-draft
suite let **three mutants through**. Each assertion must be authored by first reintroducing the
defect, observing the diagnostic, then fixing it.

Every test task carries this verification step:

> Temporarily revert the corresponding type edit, confirm
> `pnpm --filter @fullselfbrowsing/concierge typecheck` exits **non-zero** and names the intended
> assertion alias, then restore.

### The three escapees — assertions that must be purpose-built

These escaped a reasonable first-draft suite. Naming them is the difference between a real gate and
a green one over a broken contract.

1. **`ReadbackSink` form.** Neither a generic function nor a defaulted alias accepts a
   payload-specific app sink, so the obvious assignability assertion proves nothing. Assert instead
   that the seam **rejects a type argument** (`ReadbackSink<Booking>` → TS2315).
2. **`ToolBatch` delivery hook.** Consent assertions all run through `InvocationMeta`, so the
   transport-side hook regressing is invisible to them. Needs its own equality assertion.
3. **`ActionDefinition.handler` dropping its type arguments.** Escapes *every* consent assertion,
   because `ctx.ack` still typechecks as `ConsentAck<unknown, unknown>`. Needs a direct assertion
   that `Snapshot` and `AckPayload` both reach `ctx.ack`.

### Ten-mutant battery — final phase gate

| Mutant | Reintroduced defect | Expected diagnostics |
|---|---|---|
| M1 | `reason` back to open `string` | 5 errors incl. TS2578, TS2322 on the `never` arm, TS2375 on the computed idiom |
| M2 | `ToolBatch` hook drops the outcome | 2 × TS2344 (`_batchHook`, `_batchRejectsBareId`) |
| M3 | `ActionDefinition` drops the `ConsentPolicy` type argument | TS2322 + TS2344 (`_snapshotInferred`) |
| M4 | `ConsentAck` flattened back to one interface | **TS2344 on `_attestedNeedsHash`** + TS2322 in the narrowing function. *(Corrected 2026-07-28: previously said TS2578. No directive in `consent.test-d.ts` becomes unused when `ConsentAck` flattens, so TS2578 will not fire — that row was stale relative to D-06's predicates-not-directives correction.)* |
| M5 | `ReadbackSink` as a defaulted generic alias | TS2344 (`_sinkShape`) + TS2578 (`_sinkTakesNoTypeArgs`) |
| M6 | `userTurnIdentity` back to `boolean` | 5 errors incl. TS2344 (`_provenanceNotBoolean`) |
| M7 | `readsUntrusted` moved into `SideEffects` | TS2339 + TS2578 |
| M8 | `handler` drops `Snapshot`/`AckPayload` | TS2344 (`_handlerAck`) |
| M9 | `snapshotEquality` switched to method syntax | TS2578 on `_policyDegraded` |
| M10 | `requires` typed as the action's name union — **exact mutation:** `ConsentPolicy<Snapshot, Name extends string = string>` with `requires: Name`, threaded through `ActionDefinition.consent` | **TS2344 on `_nameNotWidened` + TS2344 on `_snapshotInferred`.** *(Corrected 2026-07-28: previously expected `_requiresIsString`, which stays silent — `ConsentPolicy<Booking>["requires"]` is still `string` once `Name` carries its default. The mutant IS caught, just by different guards. `_requiresIsString` remains a valid static pin; it is simply not M10's detector.)* |

**M9 is the subtle one.** `snapshotEquality` must stay function-property syntax; under method
syntax bivariance silently un-breaks the very defect the test exists to catch. This is the
deliberate opposite of `DigestLike`, which must use method syntax to accept real Node
`webcrypto.subtle`. Two adjacent seams, two opposite syntaxes, both load-bearing — do not
"harmonize" them.

---

## Assertion Mechanism — predicates, not directives

`@ts-expect-error` is **not** the default. It suppresses *any* error on the following line: a
directive written to prove a bad `reason` is rejected was satisfied by two unrelated typos and
passed green. TypeScript has no error-code scoping — `// @ts-expect-error TS9999` still suppresses a
TS2322.

Use `Expect<Not<Assignable<…>>>` predicates. They model `exactOptionalPropertyTypes` correctly and
name the invariant in the echoed source line, so a failure says *which* guarantee broke. Reserve
`@ts-expect-error` for object-literal freshness, which predicates cannot model.

---

## Wave 0 Requirements

Nothing exists yet. Wave 0 must create all of it before any type edit can be validated.

- [ ] `packages/concierge/tsconfig.test-d.json` — `extends: "./tsconfig.json"`, `noEmit: true`, **`rootDir: "."`** (omitting it is TS6059), `include: ["src/**/*.ts", "test-d/**/*.ts"]`
- [ ] `packages/concierge/test-d/_assert.ts` — the four aliases plus `export {}`. Keep `export {}` (harmless, costs nothing), but see the corrected trap table below: **TS9010 cannot fire here.**
- [ ] `packages/concierge/test-d/results.test-d.ts` — SC-2, SC-7d
- [ ] `packages/concierge/test-d/consent.test-d.ts` — SC-3, SC-6, SC-7e, SC-7f
- [ ] `packages/concierge/test-d/actions.test-d.ts` — SC-7a, SC-7b, SC-7g, handler-forwarding, erasure
- [ ] `packages/concierge/test-d/transport.test-d.ts` — SC-1, SC-4/TRN-01, SC-5/TRN-05, SC-7c
- [ ] `packages/concierge/package.json` — repoint `"typecheck"` to `"tsc -p tsconfig.test-d.json"` so one command covers `src` **and** `test-d`. **This is the phase's only shared-file touch with Phase 2** — land it early.
- [ ] Framework install: **none required** — TypeScript 5.9.3 is installed and working

### Traps Wave 0 must avoid

| Trap | Symptom | Fix | Status |
|---|---|---|---|
| Missing `rootDir` | TS6059 (`File 'test-d/_assert.ts' is not under 'rootDir'`) | Set `rootDir: "."` in `tsconfig.test-d.json` | ✅ reproduced |
| `test-d/` reachable from the build | `*.test-d.*` lands in `dist` | Keep `test-d` out of the emit program; assert absence in the phase gate | ✅ real |
| ~~`_assert.ts` has no imports/exports → TS9010~~ | — | — | ❌ **FALSE, see below** |

> ⚠️ **Corrected 2026-07-28 by the plan checker — the TS9010 trap was misplaced.**
> `_assert.ts` contains only *type aliases*. TS9010 is a **variable**-annotation diagnostic and
> cannot fire on a file of pure type aliases in any configuration. All three variants were compiled
> and every one exits 0: with `export {}`, with it removed, and with no `export` at all.
>
> **The trap is real but lives elsewhere.** It fires in `actions.test-d.ts`, on
> `const confirm = defineAction({…})`, the moment any *exported* alias reads `typeof confirm` —
> reproduced as `actions.ts(14,7): error TS9010`.
>
> **Consequences:** keep `export {}` in `_assert.ts` (harmless), do **not** write a Wave-0 breakage
> test for TS9010 there — it can never go non-zero and would stall the phase's first gate — and
> demonstrate TS9010 in the plan that owns `actions.test-d.ts` instead. Practical rule for the
> executor: **export nothing from the `test-d/*.test-d.ts` files**; their `import`s already make
> them modules.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `README.md:72` renders `reason?: string` | SC-2 | Documentation prose; the compiler cannot see it | Confirm the README's `ActionResult` block matches the shipped closed union. Verified by inspection during code review. |

*Everything else has automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 1s
- [ ] Ten-mutant battery run, all ten exit non-zero
- [ ] The three escapees have purpose-built assertions
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
