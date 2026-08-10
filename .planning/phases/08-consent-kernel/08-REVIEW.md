---
phase: 08-consent-kernel
reviewed: 2026-08-10T15:30:45Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - README.md
  - packages/concierge/src/catalog.ts
  - packages/concierge/src/concierge.ts
  - packages/concierge/src/consent-evidence.ts
  - packages/concierge/src/consent-profile.ts
  - packages/concierge/src/index.ts
  - packages/concierge/src/session.ts
  - packages/concierge/src/types.ts
  - packages/concierge/test-d/catalog.test-d.ts
  - packages/concierge/test-d/consent.test-d.ts
  - packages/concierge/test-d/exports.test-d.ts
  - packages/concierge/test-d/session.test-d.ts
  - packages/concierge/test-d/stub-transport.test-d.ts
  - packages/concierge/test-d/transport.test-d.ts
  - packages/concierge/test/artifact.test.ts
  - packages/concierge/test/catalog.test.ts
  - packages/concierge/test/concierge.test.ts
  - packages/concierge/test/consent-kernel.test.ts
  - packages/concierge/test/diagnostic-safety.test.ts
  - packages/concierge/test/export-surface.test.ts
  - packages/concierge/test/fixtures/probe.ts
  - packages/concierge/test/fixtures/stub-transport.ts
  - packages/concierge/test/readback-canonicalization.test.ts
  - packages/concierge/test/readme-security.test.ts
  - packages/concierge/test/session-catalog.test.ts
  - packages/concierge/test/session-consent.test.ts
  - packages/concierge/test/session-lifecycle.test.ts
  - packages/concierge/test/session-routing.test.ts
  - packages/concierge/test/single-instance.test.ts
  - packages/concierge/test/stub-transport.test.ts
  - scripts/pack-install-check.sh
  - scripts/phase-08-mutation-battery.mjs
findings:
  critical: 1
  warning: 2
  info: 0
  total: 3
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-08-10T15:30:45Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found

## Narrative Findings (AI reviewer)

The consent kernel fails closed on many individual proof checks, but contradictory attestation data can still be silently downgraded into usable relayed authority. The mutation harness also overstates its failure-fingerprint proof, and the public source documentation still describes the newly implemented runtime as absent.

## Summary

One BLOCKER finding affects authorization correctness and must be fixed before shipping. Two WARNING findings affect validation reliability and public contract accuracy. The targeted E12 test was executed during review; it passes while demonstrating the contradictory-attestation fail-open described in CR-01.

## Critical Issues

### CR-01 [BLOCKER]: Contradictory attestation is downgraded into usable relayed authority

**File:** `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/packages/concierge/src/concierge.ts:1042-1101`

**Reproduction:** `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/packages/concierge/test/consent-kernel.test.ts:1948-1981`

**Issue:** `observeReviewDelivery` initializes `achievedGrade` to `relayed` before checking the attested tuple. If a delivery contains an attestation/readback claim but that claim has no verified receipt, a mismatched report hash, a mismatched attestation hash, an empty/reused confirming turn, or another failed attested cross-check, the condition merely fails and the occurrence is armed at `relayed`. This violates D-08-12's fail-closed rule for contradictory evidence. The existing E12 test is a concrete public-API reproduction: it submits `confirmedEvidence("claim")` without any presented readback or receipt, then executes the gated handler and receives a relayed ack. The targeted test passes with that behavior. A more serious shared-review variant exists when one sibling action requires `attested` and another requires `relayed`: malformed attested evidence that cannot authorize the first action can still be consumed by the relayed sibling to perform its effect.

Completely absent higher-grade claims may validly produce relayed evidence. The defect is accepting a *present but incomplete or contradictory* higher-grade claim as if it were absent.

**Fix:** Branch explicitly on whether the delivery contains any higher-grade claim. Preserve the relayed path only when both `readbackHash` and `attestation` are absent. When either is present, require the complete verified tuple and close the generation on every mismatch before arming it. For example:

```typescript
const hasAttestedClaim =
  delivery.readbackHash !== undefined || delivery.attestation !== undefined;

if (!hasAttestedClaim) {
  achievedGrade = relayedGradeWithin(capturedConsent.profile.consentGrade);
} else {
  if (!completeAttestedTupleMatches(claimed, delivery, capturedConsent.profile)) {
    closeConsentGeneration(reviewName, claimed.generation);
    return;
  }
  // Re-digest, re-check ownership, then assign the attested fields.
  achievedGrade = "attested";
}
```

Rewrite E12 to use a completed delivery with no higher-grade fields, and add a regression where a review shared by attested and relayed gates receives each malformed hash/turn variant and neither handler is entered.

## Warnings

### WR-01 [WARNING]: Mutation failure fingerprints are manufactured instead of observed

**File:** `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/scripts/phase-08-mutation-battery.mjs:1899-1932`

**Issue:** `runtimeFailureFingerprint` never derives a marker from `failureMessages`. For every failed assertion it unconditionally inserts `failureMarkerForMutant(mutant.id)`, which is the same value the verifier expects. Consequently the advertised marker fingerprint is tautological: any single failure inside the selected named test, including an unrelated assertion failure, is recorded as the intended mutant marker and can receive kill credit. Exact case selection is useful, but it does not prove which behavior in a multi-assertion test failed.

**Fix:** Put a stable per-mutant marker in the detector assertion's actual failure text and parse that marker from `failureMessages`, or compare a normalized failure-message digest/signature recorded in the immutable register. Never synthesize the observed marker from the mutant currently being run. Add a self-test in which the correct named case fails for an unrelated message and verify that the detector rejects it.

### WR-02 [WARNING]: Shipped documentation falsely says the implemented runtime and consent gate do not exist

**File:** `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/packages/concierge/src/index.ts:6-10,52-56`

**Also affected:** `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/packages/concierge/src/types.ts:1798-1806`; `/Users/lakshman/conductor/workspaces/concierge-v1/ljubljana/README.md:20-21,121-135`

**Issue:** The package barrel says Session does not invoke the outcome presenter and dispatch does not enforce consent, the `Concierge` interface says consent gating is not implemented by the handle, and the repository README says there is no runtime. All three statements are false in the reviewed implementation. These comments are part of the shipped declaration/source documentation and materially misstate the security boundary and supported behavior to integrators.

**Fix:** Update the barrel and interface documentation to describe direct consent enforcement and mandatory outcome presentation accurately. Update repository status/roadmap text to list the implemented catalog, dispatcher, bridge, session, and consent runtime while retaining the pre-alpha and no-production-integration warning where appropriate.

---

_Reviewed: 2026-08-10T15:30:45Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
