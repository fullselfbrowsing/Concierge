# Phase 8: Consent Kernel - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 18 new or modified targets
**Analogs found:** 17 / 18

This map treats proposed internal filenames such as `src/consent-evidence.ts` and new consent-focused test files as planner placeholders. The phase decisions lock behavior and public contracts, not those private filenames.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/concierge/src/types.ts` | model | request-response, event-driven | same file's `ConsentAck`, `DeliveryReport`, and session contracts | exact |
| `packages/concierge/src/index.ts` | config / barrel | transform | same file's grouped type/value export blocks | exact |
| `packages/concierge/src/catalog.ts` | service / validation | batch, transform | same file's CAT-01/CAT-03 aggregate validation | exact |
| `packages/concierge/src/concierge.ts` | controller / service | request-response, event-driven | same file's dispatch dedupe pipeline plus `src/bridge.ts` generation guards | exact |
| `packages/concierge/src/consent-evidence.ts` (proposed) | utility | transform | `src/json-schema.ts` hostile-data descriptor walk | role-match |
| `packages/concierge/src/session.ts` | controller | event-driven, batch | same file's `runWork` dispatch-before-respond sequence | exact |
| `packages/concierge/src/dispatch.ts` | utility | batch, transform | same file's exact metadata forwarding and stable row ordering | exact; reuse-first |
| `packages/concierge/src/bridge.ts` | utility | transform, event-driven | same file's capture-local latches and monotonic token ownership | exact; reuse-only |
| `packages/concierge/test/fixtures/stub-transport.ts` | provider / fixture | event-driven | same file's frozen capability profiles and append-only attempt history | exact |
| `packages/concierge/test-d/consent.test-d.ts` | test | compile-time transform | same file's literal, readonly, and discriminated-union pins | exact |
| `packages/concierge/test-d/session.test-d.ts` | test | compile-time transform | same file's exact `SessionConfig` key and negative-property assertions | exact |
| `packages/concierge/test-d/exports.test-d.ts` | test | compile-time transform | same file's public-index export predicates | exact |
| `packages/concierge/test/catalog.test.ts` | test | batch, transform | same file's ordered aggregate issue assertions | exact |
| `packages/concierge/test/consent.test.ts` (proposed) | test | request-response, event-driven | `test/concierge.test.ts` factory-local async dispatch tests | role-match |
| `packages/concierge/test/session-routing.test.ts` | test | event-driven, batch | same file's shared event-history ordering tests | exact |
| `packages/concierge/test/stub-transport.test.ts` | test | event-driven | same file's attempt-before-throw and immutable-history tests | exact |
| `packages/concierge/test/artifact.test.ts`, `test/export-surface.test.ts`, and package checks | test | file-I/O, transform | current built-artifact and declaration-surface checks | exact |
| `packages/concierge/scripts/phase-08-mutation-battery.mjs` plus evidence/config (proposed) | test / config | file-I/O, batch | `scripts/phase-07-mutation-battery.mjs` | exact |
| `README.md` | config / documentation | transform | existing Design Contract and security-roadmap sections | role-match |

## Pattern Assignments

### `packages/concierge/src/types.ts` (model, request-response/event-driven)

**Analog:** Existing consent and delivery contracts in `packages/concierge/src/types.ts`.

**Deep-readonly convention** (`src/types.ts:303-308`):

```typescript
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;
```

Use the same public compile-time immutability style for `ConsentProfile`, `ReadbackAttestation`, and batch-failure outcome rows. Runtime-authored instances must additionally be frozen snapshots.

**Delivery provenance seam** (`src/types.ts:375-409`):

```typescript
export interface DeliveryReport {
  readonly responseId: string;
  readonly outcome: "completed" | "interrupted";
  readonly readbackHash?: string;
}
```

Extend this report with a separate immutable `ReadbackAttestation`; do not infer confirmation from `readbackHash` alone. The attestation should preserve the locked three-way act (`confirmed`, `declined`, `dismissed`), trusted user-turn identity, and exact hash.

**Consent union convention** (`src/types.ts:564-679`):

```typescript
export type ConsentAck =
  | {
      readonly grade: "implicit";
      readonly responseId: string;
      readonly userTurn: TurnIdentity;
    }
  | {
      readonly grade: "explicit";
      readonly responseId: string;
      readonly userTurn: TurnIdentity;
    }
  | {
      readonly grade: "attested";
      readonly responseId: string;
      readonly userTurn: TurnIdentity;
      readonly readbackHash: string;
    };
```

Keep grade-specific evidence as a discriminated union. The consumed ack must be authored from verified evidence, not from requested `minGrade`, and attested evidence continues to require a hash.

**Exact receipt literals** (`src/types.ts:739-769`):

```typescript
export interface ReadbackReceipt {
  readonly alg: "SHA-256";
  readonly canonicalization: "RFC8785";
  readonly hash: string;
  readonly canonicalBytes: Readonly<Uint8Array>;
}
```

Preserve these exact literals. Treat the injected digest as untrusted: core recomputes/validates the relationship among canonical bytes, hash, and literals before evidence can achieve `attested`.

**Configuration pattern** (`src/types.ts:1553-1757`, `1884-1889`):

```typescript
export interface ConciergeConfig {
  // ...existing hooks...
  readonly normalizeSnapshot?: SnapshotNormalizer;
  readonly presentReadback?: ReadbackSink;
  readonly digest?: DigestLike;
}

export interface SessionConfig {
  readonly concierge: Concierge;
  readonly transport: Transport;
  readonly initialContext?: unknown;
  readonly onDiagnostic?: SessionDiagnosticSink;
}
```

Add the frozen minimal consent profile to `ConciergeConfig`, and add the mandatory app-owned batch-failure outcome sink to `SessionConfig`. Update exact-key tests at the same time. Preserve optional hook property style; avoid module-global registries.

**Required corrections while extending this file:** Existing `Readback` fields at `src/types.ts:712-716` are not readonly and should be brought into the phase's immutable evidence contract. A `Readonly<Uint8Array>` type does not freeze the backing bytes at runtime, so retain a private copy and expose defensive copies/views wherever post-return mutation could alter verification.

---

### `packages/concierge/src/index.ts` (public barrel, transform)

**Analog:** Grouped exports in `packages/concierge/src/index.ts:61-156`.

```typescript
export type {
  Action,
  ActionHandler,
  Concierge,
  ConciergeConfig,
  ConsentAck,
  ConsentGrade,
  DeliveryReport,
  DigestLike,
  Readback,
  ReadbackReceipt,
  SessionConfig,
} from "./types.js";

export { buildCatalog } from "./catalog.js";
export { createConcierge } from "./concierge.js";
export { createSession } from "./session.js";
```

Add every new public type to the existing type-only block, alphabetically within the established grouping. Export no private canonicalization helper. Update the header at `src/index.ts:46-54`, which currently describes session/consent as future work.

---

### `packages/concierge/src/catalog.ts` (validation service, batch/transform)

**Analog:** Existing one-pass aggregate catalog validation.

**Issue shape and single aggregate error** (`src/catalog.ts:103-139`, `245-253`):

```typescript
export type CatalogIssueCode =
  | "CAT-01"
  | "CAT-02"
  | "CAT-03";

export interface CatalogIssue {
  readonly code: CatalogIssueCode;
  readonly actionName?: string;
  readonly path: string;
  readonly message: string;
}

export class CatalogValidationError extends Error {
  readonly issues: readonly CatalogIssue[];
}
```

Extend the code union for CAT-04/TRN-03 without inventing a parallel error type.

**Hostile object access** (`src/catalog.ts:391-517`):

```typescript
if (!Object.hasOwn(value, "consent")) {
  return undefined;
}

try {
  consent = value.consent;
} catch {
  pushIssue(/* fixed catalog issue */);
  return undefined;
}
```

Read profile and action requirements behind the same own-property/try-catch boundary. Getter throws become deterministic issues, not raw exceptions.

**One flat aggregate build** (`src/catalog.ts:881-1129`):

```typescript
const issues: CatalogIssue[] = [];
const actions: Action[] = [];

for (const candidate of candidates) {
  // Push every issue for this action; do not fail fast.
}

// Cross-entry complete-name checks happen after the per-action pass.

if (issues.length > 0) {
  throw new CatalogValidationError(issues);
}
```

Pass the captured consent profile into this one `buildCatalog` call. Add CAT-04 and TRN-03 once per offending action in deterministic input order. Do not pre-filter unsupported actions, perform a second catalog build, or stop after the first consent issue.

**Authored immutability** (`src/catalog.ts:729-754`):

```typescript
function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(Reflect.get(value, key));
  }
  return value as DeepReadonly<T>;
}
```

Snapshot/freeze the profile before validation and freeze all authored issue collections. Do not reuse this generic freezer on attacker-controlled accessors; snapshot those through descriptor-aware code first.

---

### `packages/concierge/src/concierge.ts` (controller/service, request-response/event-driven)

**Analogs:** Existing factory-local dispatch pipeline in `src/concierge.ts` and ownership tokens in `src/bridge.ts`.

**Capture at factory boundary** (`src/concierge.ts:121-194`, `424-471`):

```typescript
function snapshotInvocationMeta(meta: InvocationMeta): InvocationMeta {
  return Object.freeze({
    responseId: meta.responseId,
    userTurn: snapshotTurnIdentity(meta.userTurn),
    signal: meta.signal,
    onDeliveryReport: meta.onDeliveryReport,
  });
}

const catalog = buildCatalog({
  handlers: config.handlers,
  staticActions: config.staticActions,
  dynamicActions: config.dynamicActions,
});
```

Capture/freeze the consent profile at construction and pass it into this same catalog build. Extend the action snapshot to retain the exact validated consent policy and `captureSnapshot` function needed by the ledger.

**Factory-local mutable state** (`src/concierge.ts:550-576`):

```typescript
const inFlight = new Map<string, Promise<DispatchResult>>();
let sequence = 0;

function nextSequence(): number {
  sequence += 1;
  return sequence;
}
```

Put the review-name-keyed ledger, monotonic generation counter, pending evidence owner, and dispatch serialization tail inside `createConcierge`. Never place consent authority in module scope. A fresh validated review replaces prior authority for that name.

**Generation ownership** (`src/bridge.ts:201-269`):

```typescript
let nextToken = 0;
let activeToken: number | undefined;

function activate(): number {
  nextToken += 1;
  activeToken = nextToken;
  return nextToken;
}

function ownsActiveToken(token: number): boolean {
  return activeToken === token;
}
```

Use the same monotonically increasing ownership idea for delivery callbacks. Install pending state before invoking delivery/report hooks, and have every late callback compare generation plus response ownership before mutating. Replacement, refusal, dismissal, interruption, missing hooks, and stale callbacks must never resurrect an older grant.

**Non-async exact dedupe** (`src/concierge.ts:958-1071`):

```typescript
function dispatch(invocation: Invocation): Promise<DispatchResult> {
  const existing = inFlight.get(invocation.callId);
  if (existing !== undefined) {
    return existing;
  }

  const pending = runDispatchPipeline(invocation);
  inFlight.set(invocation.callId, pending);
  return pending;
}
```

Keep `dispatch` non-`async`, because an `async` wrapper changes Promise identity. Serialize every ledger mutation behind one deduped dispatch Promise/tail while preserving the exact same Promise for repeated call IDs.

**Consume-before-handler seam** (`src/concierge.ts:795-956`):

```typescript
const normalizedInvocation = validateInvocation(invocation);
await waitForCommit(normalizedInvocation.meta.signal);

const result = await handler({
  args: normalizedInvocation.args,
  meta: normalizedInvocation.meta,
  ack: undefined,
});
```

Immediately before handler entry: compare the newly captured/normalized snapshot, destroy authority on mismatch or comparator throw with `consent_stale`, then atomically consume the matching entry. Only after consumption construct the frozen ack with exact payload, snapshot, response evidence, and achieved grade. Handler throw/reject must not restore the consumed grant.

**Hostile callback containment** (`src/concierge.ts:578-590`, `897-955`):

```typescript
try {
  config.onDiagnostic?.(diagnostic);
} catch {
  // Observer failures cannot change the dispatch result.
}
```

Catch presenter, digest, delivery, comparator, and diagnostic failures at their explicit boundaries. Convert them to fixed domain outcomes; never allow a hostile thenable/callback to create a caught-error leak or bind authority accidentally.

---

### `packages/concierge/src/consent-evidence.ts` (proposed utility, transform)

**Closest analog:** Descriptor-based hostile-data traversal in `packages/concierge/src/json-schema.ts:255-320`.

```typescript
const prototype = Object.getPrototypeOf(value);
if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) {
  throw new SchemaDataError(path, "value must be plain JSON data");
}

for (const key of Reflect.ownKeys(value)) {
  if (typeof key === "symbol") {
    throw new SchemaDataError(path, "symbol keys are not supported");
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor?.get !== undefined || descriptor?.set !== undefined) {
    throw new SchemaDataError(path, "accessor properties are not supported");
  }
}
```

Copy the descriptor-first traversal discipline, path-aware domain errors, and absence of platform globals. Build strict JSON-domain validation, RFC 8785 serialization, and hand-written UTF-8 encoding in one private module with no ambient DOM/Node dependency.

Do **not** copy two looser behaviors from `cloneSchemaData`: it reuses an earlier clone for repeated aliases and ignores some non-enumerable properties. Consent evidence must reject cycles **and aliases**, accessors, symbol keys, `toJSON`, exotics, non-finite numbers, `undefined`, functions, bigint, and lone surrogates. Reject before invoking `DigestLike`.

Do **not** reuse dispatch dedupe canonicalization (`src/dispatch.ts:210-395`) as JCS. It is an internal equivalence tagger, not an RFC 8785 serializer.

**Closed-result convention** (`src/json-schema.ts:422-505`):

```typescript
try {
  return { ok: true, value: emitSchema(input) };
} catch (error) {
  return {
    ok: false,
    reason: error instanceof SchemaDataError ? error.message : FIXED_REASON,
  };
}
```

Return a closed internal success/failure result so canonicalization and digest failures cannot escape as arbitrary exceptions. Verify a returned receipt against core-owned canonical bytes, the exact `SHA-256`/`RFC8785` literals, and the expected hash before accepting it.

---

### `packages/concierge/src/session.ts` (controller, event-driven/batch)

**Analog:** Existing work-item ordering in `packages/concierge/src/session.ts:500-535`.

```typescript
async function runWork(work: WorkItem): Promise<void> {
  try {
    const rows = await dispatchBatch(config.concierge, work.toolBatch);

    for (const response of rows) {
      await transport.respond(response);
    }
  } catch {
    diagnose(FIXED_SESSION_DIAGNOSTICS.workFailed);
  } finally {
    finishWork(work);
  }
}
```

Insert the mandatory batch-failure outcome sink directly after `dispatchBatch` resolves and before the first `transport.respond`. Snapshot/freeze stable failure rows containing only `callId`, reason, and message. Await the sink. If it throws, rejects, or is interrupted, emit the fixed diagnostic, release no failed result to transport/model text, do not retry, and finish through the existing `finally` path.

**Fixed diagnostics and observer isolation** (`src/session.ts:33-61`, `187-208`):

```typescript
const FIXED_SESSION_DIAGNOSTICS = Object.freeze({
  workFailed: Object.freeze({
    code: "SESSION_WORK_FAILED",
    message: "Session work failed.",
  }),
});

function diagnose(diagnostic: SessionDiagnostic): void {
  try {
    config.onDiagnostic?.(diagnostic);
  } catch {
    // Diagnostics are observational only.
  }
}
```

Add one fixed diagnostic for outcome-sink failure. Do not include hostile error strings.

**Capability validation placement** (`src/session.ts:1209-1252`): construction currently captures context, reads transport state, subscribes, and publishes the frozen session. Validate real transport capabilities against the concierge's captured profile before subscription, status reads that could trigger application behavior, or any other outside side effect. The transport is authoritative; a weaker runtime capability must fail construction even if configuration claimed otherwise.

To preserve the no-module-state rule, explicitly thread the frozen profile from `createConcierge` to `createSession` through an immutable concierge-owned contract/marker. Do not add a module-level `WeakMap` registry. Keep that marker private if it is not meant to be public API.

---

### `packages/concierge/src/dispatch.ts` and `src/bridge.ts` (utilities, reuse-first)

No new consent state should live in either module.

**Exact hook forwarding** (`src/dispatch.ts:1040-1047`):

```typescript
meta: {
  responseId: batch.responseId,
  userTurn: batch.userTurn,
  signal: batch.signal,
  onDeliveryReport: batch.onDeliveryReport,
},
```

Widen types only as required by the new delivery attestation, preserving exact identity for the response ID, turn provenance, signal, and hook. `executeDispatchBatch` already emits stable input-order rows (`src/dispatch.ts:994-1066`); outcome reporting should consume those rows rather than reorder or re-dispatch them.

**Capture latches** (`src/bridge.ts:874-1017`): `captureSnapshot` already creates per-capture latches, catches hostile holders/normalizers, and returns a detached record. Reuse it as the required snapshot source. A failed capture is non-binding; do not invent a second normalization pipeline.

---

### `packages/concierge/test/fixtures/stub-transport.ts` (fixture provider, event-driven)

**Analog:** The current exact Phase 7 fixture.

**Frozen profiles and copied options** (`test/fixtures/stub-transport.ts:44-94`):

```typescript
const DEFAULT_CAPABILITIES = Object.freeze({
  streaming: false,
  cancellation: true,
});

function normalizeOptions(options: StubTransportOptions): NormalizedOptions {
  return Object.freeze({
    capabilities: Object.freeze({ ...DEFAULT_CAPABILITIES, ...options.capabilities }),
    inbound: Object.freeze([...(options.inbound ?? [])]),
  });
}
```

Extend this fixture in place with consent/readback capability profiles and deterministic attestation/delivery scripting. Preserve all existing keys and defaults.

**Attempt-before-failure history** (`test/fixtures/stub-transport.ts:145-168`):

```typescript
respondAttempts.push(response);
if (shouldFailRespond(response)) {
  throw new Error(FIXED_FAILURE_MESSAGE);
}
responses.push(response);
```

Record delivery/readback/outcome attempts before deterministic throws so interruption paths are inspectable. Return frozen copies of every history (`test/fixtures/stub-transport.ts:171-200`), not the mutable backing arrays.

The fixture remains test-only: do not export it from `src/index.ts` or include it in the packed runtime surface.

---

### Consent, catalog, session, artifact, and type tests (tests, mixed flows)

**Built artifact import pattern** (`test/concierge.test.ts:285-329`, also `test/catalog.test.ts:86-139`):

```typescript
beforeAll(async () => {
  ({ createConcierge } = await import("../dist/index.js"));
});
```

Runtime contract tests must exercise `dist`, not private source modules. Test a private canonicalizer through the public consent flow unless the phase explicitly decides it is public.

**Factory-local identity pattern** (`test/concierge.test.ts:560-630`): construct two concierge factories, interleave calls, and assert no ledger/evidence crosses instances. Add exact Promise identity assertions for duplicate call IDs.

**Aggregate issue pattern** (`test/catalog.test.ts:239-320`, `611-814`): catch one `CatalogValidationError`, assert the complete ordered `issues` array, then prove later valid/invalid entries were still inspected. Add mixed CAT-01/CAT-03/CAT-04/TRN-03 cases rather than isolated one-error tests only.

**Shared ordering history** (`test/session-routing.test.ts:253-324`, `378-415`):

```typescript
const events: string[] = [];
// dispatch pushes first; outcome sink pushes next; transport.respond pushes last.
expect(events).toEqual([
  "dispatch:call-1",
  "outcome:call-1",
  "respond:call-1",
]);
```

Use one shared array to prove `dispatchBatch -> app outcome sink -> respond` ordering. Include mixed success/failure rows, outcome throw/reject/interruption, no retry, no model-text release, and frozen row tamper attempts.

**Flagship lifecycle case:** Begin a review, interrupt delivery, emit a genuinely new user turn, then attempt the sensitive action. Assert the action remains closed, the handler never runs, and a late callback cannot bind or reopen authority.

**Type-contract patterns:**

- `test-d/consent.test-d.ts:67-106`, `255-286`, and `352-408` pin literal receipt fields, grade narrowing, readonly evidence, and exact payload/snapshot types.
- `test-d/session.test-d.ts:9-20` computes the exact `SessionConfig` key set; update it for the mandatory outcome sink and retain negative extra-property checks.
- `test-d/exports.test-d.ts:73-123` imports only the public index and asserts exported names. Add `ConsentProfile`, `ReadbackAttestation`, and outcome types there.
- `test/export-surface.test.ts:1-165` parses generated declaration export blocks; update both count and names deliberately.
- `test/artifact.test.ts:1-208` dynamically imports `dist`, checks runtime values, and probes freezing/tamper resistance. Add no runtime export for type-only contracts.

**Required consent matrix:** cover confirmed/declined/dismissed, completed/interrupted, missing hook, presenter/digest/comparator throws and hostile thenables, stale and duplicate callbacks, same-turn versus genuinely different-turn binding, response ownership mismatch, snapshot mismatch, atomic one-shot consumption, handler failure after consume, replacement by fresh validated review, exact payload capture, all three grades, and invalid JSON/JCS domains including aliases and lone surrogates.

---

### `packages/concierge/scripts/phase-08-mutation-battery.mjs` and release gates (test/config, file-I/O/batch)

**Analog:** `packages/concierge/scripts/phase-07-mutation-battery.mjs`.

**Descriptor-driven mutants** (`phase-07-mutation-battery.mjs:194-280`):

```javascript
const runtimeMutants = [
  {
    id: "...",
    file: "src/...",
    find: "exact source fragment",
    replace: "mutated fragment",
    expected: /exact failing test fingerprint/,
  },
];
```

Create Phase 8 mutants for every closure: pre-handler consume, generation/response guard, interruption non-binding, declined/dismissed non-rearm, snapshot stale destruction, evidence-derived grade, exact receipt verification, transport/profile validation, outcome-before-respond, sink failure suppression, and fixture history integrity.

**Safe mutation lifecycle** (`phase-07-mutation-battery.mjs:2092-2306`): snapshot files and Git status, require exactly one replacement, run the targeted command, match a specific failure fingerprint, restore in `finally`, and verify live-tree cleanliness. Do not broaden mutations beyond explicit files.

**Release-gate convention** (`phase-07-mutation-battery.mjs:2786-2908`): run build, runtime tests, type tests, artifact/dependency/pack/node-floor checks, reject skipped/TODO coverage, and emit machine-readable evidence. Phase 8 should inherit the package's canonical scripts from `packages/concierge/package.json:12-20` rather than invent alternate build commands.

**Pack isolation** (`scripts/pack-install-check.sh:43-64`): retain the tarball check that rejects test fixtures and test paths. The package manifest's `files` list (`packages/concierge/package.json:14-20`) already excludes tests; prove the extended stub remains absent.

---

### `README.md` (documentation/config, transform)

**Analog:** Root Design Contract and roadmap security sections (`README.md:48-75`). Add the SEC-04 server-verification worked example there, beside the architecture contract it explains. The example must show the server issuing its own challenge and independently verifying action, canonical payload/snapshot evidence, user-turn provenance, grade, expiry/replay protection, and digest. State explicitly that a client ack is evidence input, not server authorization by itself.

Keep the example dependency-free and aligned with the public package imports. Update the package README only if the public API usage section needs the new mandatory `SessionConfig` sink; do not duplicate the full security example in two places.

## Shared Patterns

### Factory-local ownership

**Sources:** `src/concierge.ts:550-576`, `src/bridge.ts:201-269`, `src/session.ts:138-208`

All mutable authority, counters, latches, queues, and dedupe maps live inside their factory. Phase 8 consent state must follow the same rule. Never use a module singleton or mutable exported object.

### Snapshot on ingress; freeze authored output

**Sources:** `src/concierge.ts:121-194`, `src/catalog.ts:729-754`, `test/fixtures/stub-transport.ts:83-94`

Copy caller-owned values before retaining them, preserve only intentional opaque identities (signals/hooks), and freeze core-authored records and arrays. Hostile values must be descriptor-validated before recursive reads/freezing.

### Closed hostile-code boundaries

**Sources:** `src/concierge.ts:578-590`, `src/session.ts:187-208`, `src/bridge.ts:874-1017`, `src/dispatch.ts:496-603`

Every user callback, getter, thenable, timer, presenter, digest, comparator, transport method, and diagnostic sink needs one explicit try/catch/normalization boundary. Failures map to stable domain reasons or diagnostics and cannot alter already-decided authority.

### Exact identity is contractual

**Sources:** `src/concierge.ts:958-1071`, `src/dispatch.ts:1040-1047`, `test/session-routing.test.ts:1065-1120`

Preserve Promise identity for duplicate dispatches and object identity for forwarded response/turn/signal/hook metadata where tests already pin it. Consent should compare stable provenance fields and captured ownership, not reconstruct lookalike objects opportunistically.

### Single aggregate catalog boundary

**Source:** `src/catalog.ts:881-1129`

All structural, consent-profile, and transport-compatibility catalog issues are collected in one deterministic pass and thrown once. This is the CAT-04/TRN-03 extension point.

### Built artifacts are the runtime contract

**Sources:** `test/concierge.test.ts:285-329`, `test/artifact.test.ts:1-208`, `test/export-surface.test.ts:1-165`

Build before runtime tests, import `dist`, and separately pin declaration exports. Avoid tests that pass only because they import an unbuilt internal module.

### No sensitive failure text crosses the model boundary

**Sources:** `src/session.ts:33-61`, `500-535`

Use frozen stable app-owned failure rows and fixed diagnostics. Never forward raw exception messages, presenter output, digest errors, or outcome-sink errors as assistant/model-visible text.

## No Analog Found

| File / Concern | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/concierge/src/consent-evidence.ts` strict RFC 8785 + UTF-8 implementation | utility | transform | No existing module performs standards-complete JCS, Unicode validation, alias rejection, or independent receipt verification. Use the hostile-data traversal conventions above and the normative Phase 8 research vectors/specification. |

## Planner-Critical Constraints

1. Install review pending state before invoking any delivery callback, and require both ledger generation and response ownership on every callback transition.
2. A grant binds only on a genuinely different human-attested user turn (or different nonempty response under the locked rule); same-turn reports do not arm it.
3. Missing, interrupted, declined, dismissed, thrown, rejected, malformed, stale, and late evidence is non-binding. Decline/dismiss must remain terminal for that review generation.
4. Snapshot comparison is late, immediately before handler entry. Mismatch or comparator throw destroys the entry and returns `consent_stale`.
5. Consume atomically before handler invocation. Never restore consent after handler failure.
6. Achieved grade comes only from verified evidence. `minGrade` is a threshold, never an assertion of what happened.
7. Attested consent requires completed delivery, an independently verified receipt, and a matching confirmed attestation. Construction fails when attested requirements exist without both `presentReadback` and `digest`.
8. The session validates actual transport capability before external side effects and awaits the app outcome sink before any response release.
9. Preserve the exact Phase 7 fixture surface while extending it; package/release checks must continue proving it is absent from the tarball.
10. The new canonicalizer stays internal unless an explicit public-API decision says otherwise.

## Metadata

**Analog search scope:** `packages/concierge/src`, `packages/concierge/test`, `packages/concierge/test-d`, `packages/concierge/scripts`, package manifests, and root/package READMEs

**Primary analog files read:** 15

**Pattern extraction date:** 2026-08-10

