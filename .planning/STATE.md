---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: executing
stopped_at: Phase 1 context gathered; milestone correction pass applied (57->62 requirements)
last_updated: "2026-08-05T21:01:28.392Z"
last_activity: 2026-08-05 -- Phase 06 planning complete
progress:
  total_phases: 9
  completed_phases: 5
  total_plans: 56
  completed_plans: 50
  percent: 56
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-27)

**Core value:** An agent can take a consequential action in a real app — and it is structurally guaranteed that a human, not the agent, confirmed this specific payload, or the action does not run.
**Current focus:** Phase 04 — Stages, catalog assembly, and explain()

## Current Position

Phase: 04 — COMPLETE
Plan: 1 of 8
Status: Ready to execute
Last activity: 2026-08-05 -- Phase 06 planning complete

Progress: [█░░░░░░░░░] 11%

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

Last session: 2026-07-28T04:38:59.144Z
Stopped at: Phase 1 context gathered; milestone correction pass applied (57->62 requirements)
Resume file: .planning/phases/01-type-surface-completion/01-CONTEXT.md
