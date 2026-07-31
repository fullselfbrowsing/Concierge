---
created: 2026-07-31T03:29:23.318Z
title: Correct the over-broad `sideEffects` headline inherited from Phases 2-3
area: docs
files:
  - packages/concierge/src/catalog.ts:764
  - packages/concierge/src/contract.ts:111
  - packages/concierge/src/contract.ts:125
  - packages/concierge/dist/index.d.ts:1889
  - packages/concierge/dist/index.d.ts:2014
  - packages/concierge/dist/index.d.ts:2028
  - packages/concierge/src/contract.ts:9-18
  - packages/concierge/src/catalog.ts:17-23
---

## Problem

`dist/index.d.ts:1889` — sourced from `packages/concierge/src/catalog.ts:764`, and
also present at `src/contract.ts:111` and `:125` — ships the headline claim
**"Module scope does not survive `"sideEffects": false`"**.

Phase 4's verification re-ran the rolldown 1.2.0 probe and measured that module
scope **does** survive when an exported function that reads it is retained. The
original Phase 2 measurement was correctly scoped — a constant-only import lets
the whole module be dropped, because the constant is inlined and the module's
evaluation is then elided — but the headline generalises it wrongly.

The precise, correct form already exists at `src/contract.ts:9-18`, corrected
during Phase 4. The *decisions* these comments justify are all still right —
never hoist `assertSingleInstance` to module scope, throw from the function body
rather than from module evaluation — because the elision case is real. Only the
stated reason is over-broad.

This is the same false-shipped-prose class that plan 03-08 spent an entire plan
removing from `dist/index.d.ts`.

### Not fixed in Phase 4

Three reasons, all recorded in `04-VERIFICATION.md` W2 (severity: info):

1. It is **inherited Phase 2/3 prose**, not prose Phase 4 introduced.
2. Editing `src/` after sign-off would have invalidated a just-granted
   validation sign-off.
3. Phase 4's own prose audit (04-08) correctly scoped itself to the memo
   justification it introduced, and explicitly classified the 24 surviving
   `sideEffects` hits as MUST-STAY GUARD for PKG-04. It did not claim to
   re-audit PKG-04 prose.

### Sites, re-measured against the tree at commit `565f93e`

| Source | Ships at | Wording | Verdict |
|---|---|---|---|
| `src/catalog.ts:764` | `dist/index.d.ts:1889` | **"Module scope does not survive `"sideEffects": false`."** (bolded headline, list item 1) | over-broad |
| `src/contract.ts:111` | `dist/index.d.ts:2014` | "module scope does not survive `"sideEffects": false`" (mid-sentence) | over-broad |
| `src/contract.ts:125` | `dist/index.d.ts:2028` | "Module-scope code does not survive `"sideEffects": false`" (list item 1) | over-broad |
| `src/contract.ts:9-18` | `dist/index.d.ts:1959-1970` | states the measured case with its scope intact | **correct — this is the model to copy** |

`04-VERIFICATION.md` cites the middle site as `dist/index.d.ts:2013`; re-measured
here it is `2014`. Cite the re-measurement, not the report.

**One adjacent site to check while fixing, flagged rather than asserted:**
`src/catalog.ts:17-23` (ships at `dist/index.js:476`) says a module-evaluation-time
registration "is deleted from the consumer bundle outright". That is a report of
what 02-06 actually measured rather than a general rule, so it is probably fine —
but it carries no scope qualifier either, and a reader who has just been told the
headline is wrong will reasonably ask about it. Decide it explicitly rather than
leaving it unmentioned.

## Solution

Rewrite the three over-broad sites to the shape `src/contract.ts:9-18` already
uses: state the *measured* case (constant-only import → whole module evaluation
dropped) rather than the general rule, and keep the decision unchanged.

Do not weaken the guidance while correcting the reason. "Never hoist
`assertSingleInstance` to module scope" must stay categorical — the elision case
is real and is the only case that matters for PKG-04, because a consumer that
imports only `CONTRACT_VERSION` is exactly the consumer whose guard silently
disappears.

Rebuild and confirm `dist/index.d.ts` and `dist/index.js` carry the corrected
text, since the defect is defined by what *ships*, not by what is in `src/`.

**Suggested owner:** a docs-correction pass, or fold into Phase 5 if it touches
`catalog.ts` anyway.
