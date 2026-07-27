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

Two open decisions in PROJECT.md need an owner before the phases that depend on them:

- **How `attested` is achieved on a voice-only transport** (blocks part of Phase 8). Options: an app-rendered out-of-band readback surface, or app-side TTS of the exact string bypassing the model. Voice-only may be capped at `relayed`. This is a product decision, not a research question.
- **Core as `peerDependency` of adapters** (blocks Phase 2 packaging wiring). Structurally forces a single core instance; diverges from the dominant ecosystem pattern; expensive to reverse after publish.

Two PROJECT.md Key Decisions rows are now stale and should be corrected at the next transition:

- "Standard Schema v1, **inlined**" — the repo already takes `@standard-schema/spec` as a real dependency, which research recommended (types-only, 0-byte runtime).
- The same row promises a `concierge-zod` bridge package, which REQUIREMENTS.md Out of Scope deletes.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-07-27
Stopped at: ROADMAP.md and STATE.md written; REQUIREMENTS.md traceability filled
Resume file: None
