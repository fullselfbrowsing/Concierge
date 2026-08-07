---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: executing
stopped_at: Completed 06-07-PLAN.md
last_updated: "2026-08-07T17:42:45.821Z"
last_activity: 2026-08-07
progress:
  total_phases: 9
  completed_phases: 5
  total_plans: 58
  completed_plans: 57
  percent: 56
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-27)

**Core value:** An agent can take a consequential action in a real app — and it is structurally guaranteed that a human, not the agent, confirmed this specific payload, or the action does not run.
**Current focus:** Phase 06 — dispatcher

## Current Position

Phase: 06 (dispatcher) — EXECUTING
Plan: 8 of 8
Status: Ready to execute
Last activity: 2026-08-07

Progress: [██████████] 98%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 06 P01 | 24min | 3 tasks | 2 files |
| Phase 06 P02 | 13min | 2 tasks | 1 files |
| Phase 06 P03 | 9min | 2 tasks | 3 files |
| Phase 06 P04 | 24min | 2 tasks | 6 files |
| Phase 06 P05 | 6min | 2 tasks | 4 files |
| Phase 06 P06 | 35min | 3 tasks | 6 files |
| Phase 06 P07 | 11m 23s | 3 tasks | 5 files |

## Accumulated Context

### Roadmap Evolution

- Phase 1 edited: milestone correction pass 2026-07-27: requirements 57->62 (TRN-05, SEC-05, SEC-06, DSP-09, CON-10)
- Phase 3 edited: milestone correction pass 2026-07-27: requirements 57->62 (TRN-05, SEC-05, SEC-06, DSP-09, CON-10)
- Phase 6 edited: milestone correction pass 2026-07-27: requirements 57->62 (TRN-05, SEC-05, SEC-06, DSP-09, CON-10)
- Phase 8 edited: milestone correction pass 2026-07-27: requirements 57->62 (TRN-05, SEC-05, SEC-06, DSP-09, CON-10)

### Decisions

Full log in PROJECT.md Key Decisions. Affecting current work:

- Consent kernel is in v0.1, not deferred — without it v0.1 is a strictly worse CopilotKit
- React and Svelte adapters ship together; Svelte is the only adapter that surfaces the `$state` proxy consent defect
- ESM-only, `engines.node: ">=22.12.0"`, `isolatedDeclarations: true` — all three serve one invariant: exactly one core instance
- Nothing publishes until v0.1 completes, so Phase 1 type decisions remain amendable through Phase 8 at zero cost
- [Phase ?]: Turn identity needs declared provenance (TRN-05, Phase 1) — a recognizer-derived userTurnId can be minted by the agent's own TTS echo, satisfying bindTo:'userTurn' with no human involved; not covered by PITFALLS P2, and TransportCapabilities is consumer-implemented so widening it post-publish is breaking
- [Phase ?]: Milestone corrected 2026-07-27: 57 to 62 v1 requirements — added TRN-05 (Phase 1), SEC-05 (Phase 3), SEC-06 and DSP-09 (Phase 6), CON-10 (Phase 8), from advisor research plus a second prior implementation at portfolio@audit-fsb-ai-control-loop
- [Phase 06-01]: Focused dispatcher RED gates register only selector-matching R-cases because Vitest reports ordinary name-filter exclusions as pending.
- [Phase 06-01]: Dispatcher security tests use direct global replacement restored in finally; no Vitest mocking or telemetry seam was introduced.
- [Phase 06-02]: Each case guards the absent dispatchBatch member and folds capability presence into its single fingerprinted observation. — This prevents incidental TypeErrors from satisfying Wave 0 RED evidence.
- [Phase 06-02]: Batch ordering is tested independently through handler-entry order, correlated row order, and preservation of the caller frozen input order. — The suite distinguishes execution order, output order, and caller-input immutability.
- [Phase 06-02]: Abort coverage uses application-local structural fixtures. — The tests assert complete sorted rows, zero later actuation, one canceller call, and listener cleanup without global timer mocks.
- [Phase 06-03]: Message bounding stays distinct from dispatcher sanitization. — Both use one internal surrogate-safe bound; only the outbound dispatcher boundary removes controls and normalizes whitespace.
- [Phase 06-03]: The host Scheduler fallback requires a complete timer pair and returns an at-most-once canceller. — Paired capability detection, receiver preservation, and an opaque handle keep cancellation honest without DOM or Node timer types.
- [Phase 06-04]: Cache the final dispatch Promise synchronously; pending entries never expire, and timer-free settled windows begin at settlement and sweep on access. — This preserves retry identity even when a handler outlives the nominal dedupe window.
- [Phase 06-04]: Authorize through the active stage name projection before the null-prototype catalog lookup, and keep resolveBridge as the only bridge seam. — Wrong-stage and prototype names cannot reach handlers, and bridge truth remains centralized.
- [Phase 06-04]: A registered action without a callable handler returns the exact reasonless unavailable result and warns once. — No declared ReasonCode truthfully means that a registered handler is missing.
- [Phase 06-05]: Batch execution delegates every live call to the existing cached dispatch function. — This preserves one stage, validation, timing, bridge, handler, normalization, sanitization, and deduplication boundary.
- [Phase 06-05]: Batch ordering decorates a copied call list with original positions. — Sorting by outputIndex and original position makes tie stability explicit without mutating caller input.
- [Phase 06-05]: Only unstarted calls after abort receive synthesized authored aborted results. — The current call remains owned by single dispatch while the batch still returns one immutable correlated row per input.
- [Phase 06-06]: Mutation evidence is credited only for a compiled build, non-zero exact named detector, harness kill, byte-restored target, restored green gates, and clean scoped source.
- [Phase 06-06]: SEC-02 is structural in Phase 6: production defines no telemetry channel; runtime R34-R36 separately prove exception text reaches neither results nor console.
- [Phase 06-06]: SEC-03 remains owned by Phase 4 and pending under its jsonSchema-getter carve-out; Phase 6 closes only the prototype-safe dispatch lookup evidence.
- [Phase 06]: Validate invocation metadata primitives before retry-key derivation and return fixed reasonless authored failures for invalid metadata. — This preserves totality and prevents malformed values or throwing getters from escaping the dispatcher boundary.
- [Phase 06]: Treat BigInt arguments as deliberately unkeyable while retaining tagged fallback-key encoding for supported values. — Unsupported arguments must execute independently without weakening collision resistance for supported inputs.
- [Phase 06]: Route malformed batch JSON through ordinary action validation as an empty object. — A single validation path keeps public failure semantics consistent and preserves batch independence.

### Pending Todos

None yet.

### Blockers/Concerns

**No open blockers.**

**Resolved 2026-07-28** — *Core as `peerDependency` of adapters*, which blocked Phase 2 packaging wiring, is decided: **peer dependency**. Two core instances is a correctness failure, not a performance one — it nulls the bridge registry, splits the dedup window into two (so a retried call double-fires), and hides consent armed on one instance from the other. A peer range turns a version mismatch into a loud install-time error; a pinned dependency lets duplicates resolve silently. Diverging from TanStack's pinning is the accepted cost. Recorded in PROJECT.md Key Decisions; Phase 2 implements it as PKG-04.

**Resolved 2026-07-27** — "how `attested` is achieved on a voice-only transport" was the wrong question and is closed. It smuggled modality back into a contract that had already rejected it. Grades turn on content provenance (agent paraphrase vs app-rendered payload) and confirmation provenance (inferred vs a human act bound to that payload's hash). `attested` needs an app-rendered raw-payload surface and an observed act on it; whether the app also speaks is irrelevant, and no product class is capped below `attested`.

**Closed 2026-07-28** — the two "stale PROJECT.md rows" noted here were re-checked and are already correct. The Key Decisions row reads "Standard Schema v1 as a real dependency… `@standard-schema/spec` is depended on rather than inlined" and explicitly states "No `concierge-zod` bridge". This note was itself the stale artifact.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Test coverage | M9 second, *named* detector for `snapshotEquality` method-syntax regression — its only current symptom is a lone TS2578 unused-directive, the failure mode a reviewer silently deletes. Verifier confirmed non-blocking: SC-7a as roadmap-worded is caught by 3× TS2322. | Deferred → Phase 2 | Phase 1 / plan 01-09 |
| Test coverage | `MESSAGE_MAX_CHARS` export-placement guard. `verbatimModuleSyntax` is one-directional: a value in the type block escapes at exit 0 while erasing the runtime binding. **The guard must import from `../src/index.js`** — `results.test-d.ts`'s existing `_messageBound` imports from `../src/types.js` and cannot see this regression. Current state verified correct today. | Deferred → Phase 2 | Phase 1 / plan 01-09 |
| Test coverage | `Scheduler`'s own shape is pinned by nothing — the three `ConciergeConfig` assertions pin field-to-alias, not alias shape. Deliberately not pinned: RESEARCH A3 marks the signature MEDIUM-risk and expects Phase 6 to refine it, so a pin would fire on a sanctioned edit. | Deferred → Phase 6 | Phase 1 / plan 01-07 |
| Docs | README documents no type contract at all after the rewrite (commit `bc9ca88`). Threat T-01-26 is closed, but validation row 01-08-T2 now passes **vacuously**. Doc-coverage gap, not a correctness gap. | Accepted (override) | Phase 1 / plan 01-08 |
| Runtime | `Scheduler` is optional but there is **no `setTimeout` in scope to default to** — it is TS2304 under `lib: ["ES2022"]`. Phase 6 must either reach a platform timer structurally or make the seam required. | Deferred → Phase 6 | Phase 1 / plan 01-07 |
| Runtime | `ActionResult` admits contradictory states by design; the dispatcher normalizer must reject a success carrying a `reason` and a failure carrying none. Belongs beside `invalid_result` (DSP-09) and the SEC-06 sanitizer. **This is a scheduling obligation, not an assumption** — it arises from an *unratified orchestrator decision* on WR-06 (option-b: keep the flat shape), recorded verbatim in `01-13-SUMMARY.md`; the user has not ratified it. If ratification is withheld the alternative is the discriminated union on `ok`, which is free before publish and breaking after — Phase 8 is the last free moment. | Deferred → Phase 6 | Phase 1 / plan 01-13 |

## Session Continuity

Last session: 2026-08-07T17:42:45.816Z
Stopped at: Completed 06-07-PLAN.md
Resume file: None
