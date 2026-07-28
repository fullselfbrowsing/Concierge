---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: planning
stopped_at: Phase 1 context gathered
last_updated: "2026-07-28T04:17:49.886Z"
last_activity: 2026-07-27 — Roadmap created; 57 v1 requirements mapped across 9 phases
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-27)

**Core value:** An agent can take a consequential action in a real app — and it is structurally guaranteed that a human, not the agent, confirmed this specific payload, or the action does not run.
**Current focus:** Phase 1 — Type surface completion

## Current Position

Phase: 1 of 9 (Type surface completion)
Plan: none yet
Status: Ready to plan
Last activity: 2026-07-27 — Roadmap created; 57 v1 requirements mapped across 9 phases

Progress: [░░░░░░░░░░] 0%

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

### Decisions

Full log in PROJECT.md Key Decisions. Affecting current work:

- Consent kernel is in v0.1, not deferred — without it v0.1 is a strictly worse CopilotKit
- React and Svelte adapters ship together; Svelte is the only adapter that surfaces the `$state` proxy consent defect
- ESM-only, `engines.node: ">=22.12.0"`, `isolatedDeclarations: true` — all three serve one invariant: exactly one core instance
- Nothing publishes until v0.1 completes, so Phase 1 type decisions remain amendable through Phase 8 at zero cost

### Pending Todos

None yet.

### Blockers/Concerns

One open decision in PROJECT.md needs an owner before the phase that depends on it:

- **Core as `peerDependency` of adapters** (blocks Phase 2 packaging wiring). Structurally forces a single core instance; diverges from the dominant ecosystem pattern; expensive to reverse after publish.

**Resolved 2026-07-27** — "how `attested` is achieved on a voice-only transport" was the wrong question and is closed. It smuggled modality back into a contract that had already rejected it. Grades turn on content provenance (agent paraphrase vs app-rendered payload) and confirmation provenance (inferred vs a human act bound to that payload's hash). `attested` needs an app-rendered raw-payload surface and an observed act on it; whether the app also speaks is irrelevant, and no product class is capped below `attested`.

Two PROJECT.md Key Decisions rows are now stale and should be corrected at the next transition:

- "Standard Schema v1, **inlined**" — the repo already takes `@standard-schema/spec` as a real dependency, which research recommended (types-only, 0-byte runtime).
- The same row promises a `concierge-zod` bridge package, which REQUIREMENTS.md Out of Scope deletes.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-28T04:17:49.882Z
Stopped at: Phase 1 context gathered
Resume file: .planning/phases/01-type-surface-completion/01-CONTEXT.md
