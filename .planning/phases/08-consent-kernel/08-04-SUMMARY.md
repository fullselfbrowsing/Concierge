---
phase: 08-consent-kernel
plan: 04
subsystem: consent
tags: [consent, rfc-8785, jcs, sha-256, attestation, hostile-data]
requires:
  - phase: 08-03
    provides: generation-owned delivery ledger, fresh boundary checks, and atomic one-shot acknowledgement consumption
  - phase: 08-02
    provides: captured consent profile plus construction-time presenter and digest capability gates
provides:
  - dependency-free strict RFC 8785 canonicalization with manual UTF-8 and hostile graph rejection
  - retained-byte SHA-256 receipt verification through a once-captured receiver-preserving digest capability
  - generation-owned presenter, delivery, and human-attestation evidence conjunction for attested acknowledgements
  - synchronous pre-reflection delivery claim that makes duplicate and reentrant reports inert
affects: [08-06, 08-07, consent-kernel, stub-transport, mutation-verification]
tech-stack:
  added: []
  patterns:
    - caller-owned values are inspected from complete own data descriptors and repeated raw shape snapshots
    - injected async capabilities are followed by generation and response ownership checks before state mutation
    - occurrence evidence derives achieved grade while profile and transport capabilities remain ceilings
key-files:
  created:
    - packages/concierge/src/consent-evidence.ts
    - packages/concierge/test/readback-canonicalization.test.ts
  modified:
    - packages/concierge/src/concierge.ts
    - packages/concierge/test/consent-kernel.test.ts
key-decisions:
  - "SHA-256 evidence uses one stable lowercase 64-character hexadecimal encoding, with exact retained canonical bytes as the authority."
  - "The digest method and receiver are captured once at Concierge construction, preserving SubtleCrypto-compatible receiver semantics without later caller reads."
  - "A delivery callback synchronously claims verifyingDelivery before report reflection; duplicate, reentrant, stale, and late reports are inert."
patterns-established:
  - Strict readback detachment precedes the legacy invocation snapshot only for review keys capable of arming an attested policy.
  - Receipt, report, and attestation contract fields require own data descriptors but need not be enumerable; JCS payload members remain enumerable-only.
  - A failed owned delivery re-digest destroys the generation instead of downgrading cryptographic failure into weaker authority.
requirements-completed: [CON-07, CON-09]
duration: 1h 20m
completed: 2026-08-10
---

# Phase 8 Plan 4: Canonical Readback and Human Attestation Summary

**Strict JCS bytes, freshly verified SHA-256 receipts, and a one-shot generation-owned human attestation now form the only route to an `attested` acknowledgement.**

## Performance

- **Duration:** 1h 20m
- **Started:** 2026-08-10T11:35:38Z
- **Completed:** 2026-08-10T12:54:16Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added a dependency-free RFC 8785 walker that snapshots complete own data descriptors, rejects aliases, cycles, accessors, symbols, exotics, unstable reflection, invalid numbers, sparse arrays, and lone surrogates, then emits UTF-8 scalar bytes without `JSON.stringify` or a platform encoder.
- Bound presentation receipts to a core-retained canonical byte copy and a fresh injected SHA-256 digest, with exact algorithm, canonicalization, byte, and lowercase hash agreement.
- Captured the digest method and receiver once, passed defensive copies to every digest, and inspected typed-array and ArrayBuffer brands through captured intrinsics without invoking shadowed caller accessors.
- Presented one frozen Readback containing the exact frozen validated handler argument, rechecked generation and response ownership after every presenter/digest await, and discarded every stale completion.
- Promoted completed delivery to `attested` only when receipt, report, confirmed attestation, genuine new human turn, response, generation, and fresh re-digest all agree; lower-grade capability labels never manufacture evidence.
- Added a synchronous `verifyingDelivery` claim before report reflection so duplicate, reentrant, superseded, interrupted, declined, dismissed, or late reports cannot race or repeat verification.

## Task Commits

Each task used a discriminating RED/GREEN sequence:

1. **Task 1 RED: Pin strict canonicalization and retained-byte receipt verification** - `1940397` (test)
2. **Task 1 RED hardening: Pin hostile byte brands, one-read digest capture, and structural evidence fields** - `7b49f01` (test)
3. **Task 1 GREEN: Implement strict JCS, manual UTF-8, and verified receipts** - `cd0ec4a` (feat)
4. **Task 2 RED: Pin the complete evidence conjunction and async ownership matrix** - `479c28f` (test)
5. **Task 2 GREEN: Require one claimed, complete human-attestation occurrence** - `4f57d1b` (feat)

## Files Created/Modified

- `packages/concierge/src/consent-evidence.ts` - Strict descriptor-first JSON detachment, RFC 8785 serialization, manual UTF-8, safe byte snapshots, once-captured digest capability, receipt verification, and delivery-evidence snapshots.
- `packages/concierge/src/concierge.ts` - Attested review selection, exact Readback presentation, post-await ownership guards, verified evidence retention, pre-reflection delivery claims, fact-derived grades, and hash/turn-bound acknowledgements.
- `packages/concierge/test/readback-canonicalization.test.ts` - Official-style JCS vectors, hostile values/proxies/accessors, receipt mutation, defensive digest copies, intrinsic-brand accessors, and digest capture tests through the built public flow.
- `packages/concierge/test/consent-kernel.test.ts` - Complete proof-component matrix, presenter failures, exact terminal acts, every async supersession point, duplicate/reentrant delivery, late callbacks, capability ceilings, and one-shot attested release.

## Decisions Made

- Canonical SHA-256 strings use lowercase 64-character hexadecimal; exact retained bytes remain authoritative and every digest string is derived from a fresh 32-byte result.
- Digest capability capture preserves both the method and its original receiver once at construction, then exposes only a frozen core-owned wrapper to catalog and runtime code.
- Receipt, report, and attestation authority fields accept non-enumerable own data descriptors because the public contracts are structural; accessor-backed or otherwise invalid present fields fail closed, while strict JCS data remains enumerable-only.
- Delivery verification is a ledger state, not only an async operation: the first owned callback claims `verifyingDelivery` before caller reflection, and only that claim may complete or close the generation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Captured the digest callable with its receiver exactly once**
- **Found during:** Task 1 GREEN security review
- **Issue:** Reading `digest.digest` on every verification allowed a caller getter to change or throw after construction and could lose a SubtleCrypto-style receiver.
- **Fix:** Captured a callable and receiver once at the factory boundary, wrapped invocation with `Reflect.apply`, and pinned one getter read across both verification digests.
- **Files modified:** `packages/concierge/src/consent-evidence.ts`, `packages/concierge/src/concierge.ts`, `packages/concierge/test/readback-canonicalization.test.ts`
- **Commit:** `cd0ec4a`

**2. [Rule 1 - Security Bug] Removed executable byte-brand and optional-evidence reads**
- **Found during:** Task 1 GREEN security review
- **Issue:** Direct `.buffer`/`.byteLength` reads could invoke shadowed getters, and optional report accessors were conflated with absent evidence.
- **Fix:** Used captured intrinsic internal-slot getters plus repeated own-shape copies; distinguished absent optional fields from invalid present descriptors; accepted contract data fields independent of enumerability.
- **Files modified:** `packages/concierge/src/consent-evidence.ts`, `packages/concierge/test/readback-canonicalization.test.ts`
- **Commit:** `cd0ec4a`

**3. [Rule 1 - Performance Bug] Replaced quadratic dense-array and byte traversal**
- **Found during:** Task 1 final diff review
- **Issue:** Per-index `indexOf` searches made ordinary dense payload and canonical-byte walks O(n²), creating a CPU denial-of-service path.
- **Fix:** Consumed the specified numeric own-key and descriptor order directly in one pass while retaining a second raw-order shape comparison.
- **Files modified:** `packages/concierge/src/consent-evidence.ts`
- **Commit:** `cd0ec4a`

**4. [Rule 1 - Concurrency Bug] Claimed delivery before reflection and destroyed failed re-digests**
- **Found during:** Task 2 RED/final review
- **Issue:** `pendingDelivery` remained live across the digest await, so duplicate or reflection-reentrant reports could race a second digest or terminal act; a failed delivery re-digest downgraded to relayed instead of closing.
- **Fix:** Installed `verifyingDelivery` synchronously before report inspection, made all duplicate/late callbacks inert, retained post-await generation/response ownership checks, and closed the claim on digest mismatch or failure.
- **Files modified:** `packages/concierge/src/concierge.ts`, `packages/concierge/test/consent-kernel.test.ts`
- **Commit:** `4f57d1b`

---

**Total deviations:** 4 auto-fixed (1 missing critical functionality, 3 bugs)
**Impact on plan:** All corrections directly strengthened required correctness, security, or performance properties; no public API, dependency, or feature scope was added.

## TDD Gate Compliance

- Task 1 began with 14/14 named canonicalization and receipt cases failing on the absent strict evidence boundary; supplemental RED cases then isolated shadowed byte accessors, digest-method rereads, and non-enumerable structural claims before the GREEN commit.
- Task 1 GREEN made all 17 canonicalization cases pass and preserved the existing consent suite.
- Task 2 RED retained 42 consent cases green while E08 and E09 failed specifically on delivery-digest downgrade and duplicate async verification.
- Task 2 GREEN made the final focused consent and canonical suites pass at 61/61; every RED commit precedes its corresponding GREEN commit.

## Verification

- Package build passed with attw and publint clean.
- Focused consent and canonicalization suites passed: 2 files, 61 tests.
- Full runtime suite passed: 20 files, 420 tests.
- Workspace typecheck passed under `tsconfig.test-d.json`.
- `git diff --check` passed; no tracked file was deleted by any task commit.
- `pnpm-lock.yaml` remained byte-identical at SHA-256 `0e29065f823200f9bdb2284bdef721003f525f68fa60a2810046b1a7f720e0d4`; no dependency or manifest changed.
- Source scans confirmed no public barrel export, `JSON.stringify` authority, platform encoder, bundled crypto, placeholder, or unplanned network/auth/file/schema surface.

## Known Stubs

None. Nullable ledger fields and empty test observation collections are intentional closed-state/fixture representations, not unwired runtime data.

## Issues Encountered

- Central RED/GREEN review repeatedly strengthened discriminating tests before commits, exposing executable platform-property shadows, one-read capability capture, an O(n²) hostile-data path, and the async duplicate-delivery race before closeout.
- Conductor's linked-checkout branch guard correctly prevented local executor commits; the orchestrator reviewed and committed each exact scoped file set centrally without staging the intentional auto-chain config change.

## User Setup Required

None - no external service, secret, package, or environment configuration is required.

## Next Phase Readiness

- Plan 08-06 can extend the exact Phase 7 stub with delivery and attestation controls against a complete cryptographically bound kernel.
- Plan 08-07 can mutate JCS rejection, retained-byte verification, presenter/digest ownership guards, evidence conjunction, and the pre-reflection delivery claim with named public-flow detectors.
- No blockers remain.

## Self-Check: PASSED

- Summary, implementation, and both focused test files exist.
- All five RED/hardening/GREEN task commits exist in repository history.
- ROADMAP marks 08-04 complete, STATE advances to plan 6 with the metric and decisions recorded, and the three owned validation rows are green.
- No tracked file was deleted by the task commits.

---
*Phase: 08-consent-kernel*
*Completed: 2026-08-10*
