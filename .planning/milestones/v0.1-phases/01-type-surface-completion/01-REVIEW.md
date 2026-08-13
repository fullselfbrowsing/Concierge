---
phase: 01-type-surface-completion
reviewed: 2026-07-28T16:54:26Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - packages/concierge/src/types.ts
  - packages/concierge/src/index.ts
  - packages/concierge/test-d/consent.test-d.ts
  - packages/concierge/test-d/actions.test-d.ts
findings:
  critical: 2
  warning: 7
  info: 3
  total: 12
status: findings
---

# Phase 1: Code Review Report

**Reviewed:** 2026-07-28T16:54:26Z
**Depth:** deep (cross-file, plus 17 independently designed mutations executed in an isolated sandbox)
**Files Reviewed:** 4
**Status:** findings

## Summary

The four files were reviewed adversarially rather than confirmed. I did not re-run the phase's own 19-mutation battery — `01-VERIFICATION.md` already re-executed it independently and I take those 19 as settled. Instead I attacked the surface the battery does **not** cover: post-construction mutation, the type parameters nobody instantiated with a real type, `exactOptionalPropertyTypes` on the members that were not the one member the phase fixed, and 17 new mutations aimed at the contracts the suite's assertions are *shaped* to miss.

All probes ran in `/tmp` sandboxes against copies of the real `src/`. The working tree was never modified (`git status --porcelain` empty, `git diff --exit-code` clean, verified after every probe).

Two blockers came out of it, and both are the same class the phase declared it was closing — defects that become breaking changes after publish.

**CR-01 defeats the phase's headline security claim.** Success Criterion 6 is "Compiler, not a doc comment, enforces attested ⇒ readbackHash." It does not. `ConsentAck`'s members are all writable, and writing `grade` through a union-typed value uses the union of the branches' write types, so `ack.grade = "attested"` compiles on any `ConsentAck` with **no cast, no `any`, no suppression, and zero diagnostics**. The compiler then narrows on the forged discriminant and hands the consumer `ack.readbackHash` typed `string` when the property is absent at runtime. The union-of-two-branches construction constrains *construction* only; it never constrained *mutation*, and nothing in the suite looks.

**CR-02 makes the bridge story unusable.** `Bridge`'s default type arguments are `Record<string, never>`, and that default is what `BridgeRegistry<B extends Bridge = Bridge>` and `StageDefinition<B extends Bridge = Bridge>` constrain against. `Record<string, never>` requires every member to be `never`, so **no bridge carrying an actual action or snapshot satisfies its own constraint.** `CLAUDE.md`'s canonical example — a component exposing `applyFilter({key, value})` — does not typecheck. The entire suite passes with a two-line fix applied, which is itself the proof that the bridge type parameters are untested.

Beyond those: consent-critical artifacts (`DeliveryReport.outcome`, `ReadbackReceipt.hash`/`canonical`, `TransportCapabilities`) are all mutable, contradicting the phase's own recorded convention in `01-CONTEXT.md:600` ("`Object.freeze` + `Readonly<>` for anything the agent or app must not mutate"); the `exactOptionalPropertyTypes` fix documented at length on `ActionResult.reason` was applied to that one field and nowhere else, so eight other optional members reject the same computed idiom; and four assertions in the in-scope test files are structurally incapable of detecting the regressions their doc comments claim they guard.

Confirmed sound and explicitly **not** reported as defects: the deliberate `DigestLike` method / `ConsentPolicy.snapshotEquality` function-property asymmetry (both intact — `types.ts:642` and `types.ts:399`, which discharges `01-VERIFICATION.md`'s human-verification item 2); the export surface (42 declared, 42 re-exported, zero dangling, `ConsentAckBase` and `serverChallengeBrand` both emitted module-private and unexported); the `any` erasure in `AnyActionDefinition`; no DOM/Node global, no top-level `await`, no `@ts-ignore`, no debt marker anywhere in scope.

### Mutations run (17 new, none from the phase's battery)

| # | Mutation | Result |
|---|---|---|
| MUT-A | `ConsentAck` promoted to `attested` by assignment (no cast) | **ESCAPED** — CR-01 |
| MUT-B | `ConsentAckBase.snapshot`/`payload`/`userTurnId` overwritten in place | **ESCAPED** — CR-01 |
| MUT-C | `BridgeRegistry<RealBridge>` / `StageDefinition<RealBridge>` declared | **BROKEN TODAY** — CR-02 |
| MUT-D | `Transport.capabilities.userTurnIdentity` upgraded in place | **ESCAPED** — WR-01 |
| MUT-E | `DeliveryReport.outcome` relabelled `"interrupted"` → `"completed"` | **ESCAPED** — WR-01 |
| MUT-F | `ReadbackReceipt.hash` swapped, `canonical[0]` rewritten | **ESCAPED** — WR-01 |
| MUT-G | `ConsentAckBase.userTurnId` → optional | **ESCAPED** — WR-07 |
| MUT-H | `DeliveryReport.outcome` → `string` | **ESCAPED** — WR-07 |
| MUT-I | `ConsentPolicy.bindTo` → `string` | **ESCAPED** — WR-04 |
| MUT-J | `ReadbackReceipt.canonical` → `unknown` | **ESCAPED** — WR-05 |
| MUT-K | `ActionHandler` ctx `bridge: Bridge \| null` → `Bridge` | **ESCAPED** — WR-03 |
| MUT-L | `BridgeRegistry.read: () => B \| null` → `() => B` | **ESCAPED** — WR-03 |
| MUT-M | `ActionResult.ok` → optional | **ESCAPED** — WR-07 |
| MUT-N | `ActionResult.message` → optional | **ESCAPED** — WR-07 |
| MUT-O | Branch A `grade` widened to full `ConsentGrade` | caught (2 errors) |
| MUT-P | `ConsentAckBase.payload` → optional | caught (1 error) |
| MUT-Q | attested `readbackHash` → `unknown` | caught (1 error) |
| MUT-R | `ServerChallenge` brand dropped | caught (2 errors) |
| MUT-S | `ConciergeConfig.presentReadback` → `any` | caught (2 errors) |

Five of the nineteen were caught. Fourteen escaped.

---

## Critical Issues

### CR-01: `attested ⇒ readbackHash` is defeatable by plain assignment — the compiler then vouches for the forgery

**File:** `packages/concierge/src/types.ts:418-505` (`ConsentAckBase` 418-441, `ConsentAck` 472-505)

**Issue:**

Every member of `ConsentAckBase` and of both `ConsentAck` branches is writable. TypeScript computes the *write* type of a property on a union-typed value as the union of the branches' write types, so `grade`'s write type on a bare `ConsentAck` is `("none" | "delivered" | "relayed") | "attested"` — the full `ConsentGrade`. The two-branch split constrains construction only.

Proven against the shipped `src/` under the exact production flags (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `isolatedDeclarations`). This program **compiles with exit 0 and zero diagnostics**:

```ts
import type { ConsentAck } from "../src/types.js";
type Booking = { id: string; amount: number };

// This is exactly the shape `ctx.ack` arrives in, and exactly the shape the
// Phase 8 kernel will hold armed acks in. No control-flow narrowing applies.
export function launder(ack: ConsentAck<Booking, { id: string }>): string {
  ack.grade = "attested";        // (1) no error, no cast, no `any`
  if (ack.grade === "attested") {
    return ack.readbackHash;     // (2) compiler says `string`; runtime value is `undefined`
  }
  return "";
}
```

Line (2) is what makes this critical rather than merely lax. The escape does not just fail to block a forged grade — it causes the compiler to **issue a false type guarantee downstream**. Every consumer that trusts `01-VERIFICATION.md`'s SC-6 row and reads `ack.readbackHash` inside a `grade === "attested"` guard without a fallback (which the suite's own `narrowsThroughTheUnion` at `consent.test-d.ts:281-284` teaches as the correct idiom) will hand `undefined` to a hash comparison.

Three things make this squarely in-scope for a phase whose goal is "the remaining defects that would become breaking changes after publish are closed":

1. Adding `readonly` after publish **is** a breaking change for any consumer that mutates.
2. `types.ts:421` promises "Normalized and structurally frozen at arm time. Never a live reference." — a runtime promise the type does not back, in the one file whose stated thesis (`types.ts:454`) is that "prose has never once stopped one from being built."
3. `01-CONTEXT.md:600` records the project's own Established Pattern: "**`Object.freeze` + `Readonly<>` for anything the agent or app must not mutate.**" `ConsentAck` is the artifact that must not mutate more than anything else in the file, and it carries zero `readonly`.

The ack is handed by reference into app-authored handler code via `ctx.ack` (`types.ts:305`). This is not a theoretical adversary — it is an ordinary aliasing bug that the type system is currently advertised as preventing.

**Fix:** mark the artifact read-only. Verified: this produces 6 × TS2540 against the exploit above, and the existing four-file suite still passes at exit 0 with zero edits to any test.

```ts
interface ConsentAckBase<Snapshot, Payload> {
  readonly userTurnId: string;
  readonly responseId: string;
  /** Normalized and structurally frozen at arm time. Never a live reference. */
  readonly snapshot: Snapshot;
  /** Captured at review time and replayed verbatim at confirm time. */
  readonly payload: Payload;
  readonly challenge?: ServerChallenge;
}

export type ConsentAck<Snapshot = unknown, Payload = unknown> =
  | (ConsentAckBase<Snapshot, Payload> & {
      readonly grade: Exclude<ConsentGrade, "attested">;
      readonly readbackHash?: string | undefined;
    })
  | (ConsentAckBase<Snapshot, Payload> & {
      readonly grade: "attested";
      readonly readbackHash: string;
    });
```

Then add the regression guard the suite lacks, in `consent.test-d.ts` beside `narrowsThroughTheUnion`:

```ts
// The union constrains construction; only `readonly` constrains mutation.
// Without it, `attested` is reachable by assignment and the narrowing below lies.
declare const mutable: ConsentAck<Booking, { id: string }>;
// @ts-expect-error - grade must not be writable: a written grade forges the attested branch
mutable.grade = "attested";
```

---

### CR-02: no real bridge satisfies `B extends Bridge` — `BridgeRegistry` and `StageDefinition` cannot be instantiated

**File:** `packages/concierge/src/types.ts:841-847` (defaults), `:849`, `:871`, `:1102`

**Issue:**

```ts
export interface Bridge<
  Actions extends Record<string, (...args: never[]) => unknown> = Record<string, never>,
  Snapshot extends Record<string, () => unknown> = Record<string, never>,
> { actions: Actions; snapshot: Snapshot; }
```

The defaults are `Record<string, never>` — the *bottom* of each constraint, not the top. `Record<string, never>` requires every property to be `never`, so a bridge with any real member is not assignable to it. And that default is precisely what `BridgeRegistry<B extends Bridge = Bridge>` (`:849`) and `StageDefinition<B extends Bridge = Bridge>` (`:871`) constrain against.

Measured: `Bridge<{applyFilter: (k: string) => void}, {count: () => number}> extends Bridge` evaluates to **false**.

The consequence is that the library's canonical usage does not compile. This is the example from `CLAUDE.md` — "the app exposes verbs like `applyFilter({key, value})`":

```ts
type ResultsBridge = Bridge<
  { applyFilter: (key: string, value: string) => void },
  { visibleCount: () => number }
>;

declare const registry: BridgeRegistry<ResultsBridge>;
// error TS2344: Type 'ResultsBridge' does not satisfy the constraint
//   'Bridge<Record<string, never>, Record<string, never>>'.
//   Type '(key: string, value: string) => void' is not assignable to type 'never'.

const stage: StageDefinition<ResultsBridge> = { … };   // same TS2344

export const cfg: ConciergeConfig = { stages: [stage] };
// error TS2375: 'StageDefinition<ResultsBridge>' is not assignable to
//   'StageDefinition<Bridge<Record<string, never>, Record<string, never>>>'
```

The third error is a second, independent defect: `ConciergeConfig.stages` (`:1102`) is `ReadonlyArray<StageDefinition>` with `B` at its default. `B` reaches contravariant positions through `AnyActionDefinition<B>`'s handler, so a concrete-bridge stage is not assignable to the defaulted one — the exact variance problem `AnyActionDefinition` (`:819-825`) was created to solve for `Snapshot`/`AckPayload`, solved there with `any` and left unsolved for `Bridge` at the collection site.

The reason this survived the 19-mutation battery is that **nothing in the suite ever instantiates `Bridge` with a member.** `actions.test-d.ts:195` passes `null` for `ActionDefinition`'s (unconstrained, differently-named) `Bridge` parameter, and `_stage` at `:249` uses the default. `types.ts:841-847` therefore has no test coverage of any kind — its two type parameters are exercised only at their defaults, and the defaults are the broken values.

**Fix:** default each parameter to the top of its own constraint, and erase `Bridge` at the collection site the way `Snapshot` already is. Verified: with these two edits a two-bridge app assembles at exit 0, and the existing four-file suite still passes at exit 0.

```ts
export interface Bridge<
  Actions extends Record<string, (...args: never[]) => unknown> =
    Record<string, (...args: never[]) => unknown>,
  Snapshot extends Record<string, () => unknown> =
    Record<string, () => unknown>,
> {
  actions: Actions;
  snapshot: Snapshot;
}
```

```ts
export interface ConciergeConfig {
  // Bridge is erased here for the same reason Snapshot is erased in
  // AnyActionDefinition: B reaches contravariant positions through the
  // handler, so heterogeneous stages cannot be collected at a concrete B.
  stages: ReadonlyArray<StageDefinition<any>>;
  …
}
```

Add the coverage that would have caught it, in `actions.test-d.ts`:

```ts
type ResultsBridge = Bridge<{ applyFilter: (k: string, v: string) => void }, { visibleCount: () => number }>;
type CartBridge    = Bridge<{ removeItem: (id: string) => void },            { total: () => number }>;

/** A bridge with real members must satisfy its own constraint. */
type _realBridgeSatisfiesConstraint = Expect<Assignable<ResultsBridge, Bridge>>;

/** …and two unrelated concrete-bridge stages must still collect into one config. */
declare const rReg: BridgeRegistry<ResultsBridge>;
declare const cReg: BridgeRegistry<CartBridge>;
const _rStage: StageDefinition<ResultsBridge> = { id: "results", match: () => true, actions: [], bridge: rReg };
const _cStage: StageDefinition<CartBridge>    = { id: "cart",    match: () => true, actions: [], bridge: cReg };
const _multiBridgeConfig: ConciergeConfig = { stages: [_rStage, _cStage] };
```

---

## Warnings

### WR-01: every consent-critical artifact besides `ConsentAck` is also mutable, and `readonly capabilities` is shallow enough to be misleading

**File:** `packages/concierge/src/types.ts:256-273`, `:561-576`, `:983-1003`, `:1010`

**Issue:** the same class as CR-01, on four more surfaces. All three of these compile at exit 0 with no cast:

```ts
export function upgrade(t: Transport): void {
  t.capabilities.userTurnIdentity = "human-attested";  // agent-forgeable -> evidence
  t.capabilities.consentGrade     = "attested";
}
export function relabel(r: DeliveryReport): void {
  r.outcome = "completed";        // a truncated readback becomes a complete one
}
export function tamper(rc: ReadbackReceipt): void {
  rc.hash = "0".repeat(64);       // the receipt's binding to the bytes is severed
  rc.canonical[0] = 0;            // …and the bytes themselves are rewritten
}
```

`Transport.capabilities` (`:1010`) is `readonly`, which reads as protection and is not — the `readonly` stops rebinding the reference and does nothing about the members. `TurnIdentityProvenance` exists specifically so the kernel can tell a forgeable id from an attested one (`:962-981`); a value that can be upgraded in place after declaration does not carry that distinction. `DeliveryReport.outcome` carries the note "Anything but `completed` means consent must not arm" (`:258`) and is writable. `ReadbackReceipt.canonical`'s own doc cites WebAuthn's `clientDataJSON` as the reason the bytes are carried rather than re-derived (`:568-574`) — WebAuthn's bytes are not writable either.

Fixing any of these after publish is breaking.

**Fix:** `readonly` on all members of `DeliveryReport`, `ReadbackReceipt`, and `TransportCapabilities`. For `canonical`, `readonly canonical: Uint8Array` prevents rebinding but not element writes — if element immutability matters, type it `readonly canonical: Readonly<Uint8Array>` or document explicitly that the byte array is by-convention-frozen and freeze it at the producer.

### WR-02: the `exactOptionalPropertyTypes` fix documented at length on `ActionResult.reason` was applied to that one field and nowhere else

**File:** `packages/concierge/src/types.ts:229`, `:231`, `:233`, `:242`, `:272`, `:305`, `:912`, `:934`

**Issue:** `types.ts:72-77` explains, correctly and in detail, that a bare `reason?: ReasonCode` rejects the natural `{ reason: computeReason(), … }` idiom under `exactOptionalPropertyTypes` "which is every real mapper," and adds `| undefined`. Eight other optional members on the same consent path have the identical problem and did not get the identical fix. Every line below is TS2375 against the shipped types:

```ts
declare const maybeStr: string | undefined;
declare const maybeAck: ConsentAck | undefined;
declare const maybeHook: ((e: (r: DeliveryReport) => void) => void) | undefined;

const m1: InvocationMeta = { userTurnId: maybeStr };                     // TS2375  :229
const m2: InvocationMeta = { callId: maybeStr, outputIndex: maybeNum };  // TS2375  :231,:233
const m3: InvocationMeta = { deferUntilDelivered: maybeHook };           // TS2375  :242
const d1: DeliveryReport = { responseId: "r", outcome: "completed",
                             readbackHash: maybeStr };                   // TS2375  :272
const b1: ToolBatch = { responseId: "r", calls: [], userTurnId: maybeStr };        // TS2375  :912
const b2: ToolBatch = { responseId: "r", calls: [], deferUntilDelivered: maybeHook }; // TS2375  :934
const ctx: HandlerCtx = { args, bridge, meta, ack: maybeAck };           // TS2375  :305
```

Each of these is the code a transport author or the Phase 6 dispatcher will actually write. `DeliveryReport.readbackHash` is the worst of them: its own doc (`:266-271`) instructs the author to "take the value from the receipt," and `receipt?.hash` is `string | undefined`. `ack: maybeAck` at `:305` is the dispatcher's own handler-context construction.

This is not breaking to fix later (adding `| undefined` widens the write type and leaves the read type unchanged under EOPT), which is the only reason it is a warning rather than a blocker.

`ConsentAckBase.challenge` (`:440`) is the deliberate exception — `:435-438` explicitly requires omission — and is correctly left alone.

**Fix:** add `| undefined` to each of the eight, matching `ActionResult.reason`. Example:

```ts
readbackHash?: string | undefined;
deferUntilDelivered?: ((effect: (report: DeliveryReport) => void) => void) | undefined;
ack?: ConsentAck<Snapshot, AckPayload> | undefined;
```

### WR-03: `_handlerBridge` picks the one type argument that makes it blind to the contract it documents

**File:** `packages/concierge/test-d/actions.test-d.ts:195`, `:204`

**Issue:**

```ts
type Ctx = Parameters<ActionDefinition<"x", typeof schema, null, Booking, AckShape>["handler"]>[0];
…
/** And `Bridge` still reaches `bridge`, nullable because the component may be unmounted. */
type _handlerBridge = Expect<Equals<Ctx["bridge"], null>>;
```

`Bridge` is instantiated as `null`, so `Bridge | null` collapses to `null` and the assertion cannot observe the `| null` at all. The doc comment claims it does ("nullable because the component may be unmounted"). Measured — both mutations exit 0 against the full four-file suite:

- `types.ts:302` `bridge: Bridge | null` → `bridge: Bridge` — **ESCAPED**
- `types.ts:852` `read: () => B | null` → `read: () => B` — **ESCAPED**

That contract is load-bearing: `types.ts:301` says "Always check it," `types.ts:851` says "`null` when no component has registered," and `FailureReason` carries `no_bridge` (`:148`) as the code for exactly this state. Nothing in the suite pins it.

**Fix:** instantiate `Bridge` with a type that is not itself `null`, so `| null` is observable. Verified: baseline stays exit 0, and the `bridge: Bridge` mutation now fires TS2344 on `_handlerBridge`.

```ts
type ResultsBridge = { actions: { applyFilter: (k: string) => void }; snapshot: { count: () => number } };
type Ctx = Parameters<ActionDefinition<"x", typeof schema, ResultsBridge, Booking, AckShape>["handler"]>[0];

/** And `Bridge` still reaches `bridge`, nullable because the component may be unmounted. */
type _handlerBridge = Expect<Equals<Ctx["bridge"], ResultsBridge | null>>;
```

Add the registry half too, since `BridgeRegistry.read` has no assertion anywhere:

```ts
type _registryReadIsNullable = Expect<Equals<BridgeRegistry<ResultsBridge>["read"], () => ResultsBridge | null>>;
```

### WR-04: `_snapshotInferred` is self-referential, so `ConsentPolicy`'s member types are entirely unguarded — `bindTo` can be widened to `string` silently

**File:** `packages/concierge/test-d/actions.test-d.ts:180`; `packages/concierge/src/types.ts:374`, `:405`, `:406`

**Issue:**

```ts
type _snapshotInferred = Expect<Equals<NonNullable<(typeof confirm)["consent"]>, ConsentPolicy<Booking>>>;
```

Both sides of the `Equals` are expressed in terms of `ConsentPolicy`, so any change *inside* `ConsentPolicy` changes both sides identically and the assertion stays true. It pins the `Snapshot` type argument and nothing else. Measured: `types.ts:374` `bindTo: "userTurn" | "response"` → `bindTo: string` exits 0 against the full suite.

`bindTo` is the selector between the strong gate and the weak one. Widened to `string`, `bindTo: "usreTurn"` typechecks, and whether the Phase 8 runtime then falls back to `"response"` or to no gate at all, the compiler said nothing. `minGrade` (`:405`) and `onMissing` (`:406`) are unguarded for the same reason. Note that `Transport` is the only interface in the whole suite carrying a `keyof` pin (`transport.test-d.ts:137`); `ConsentPolicy` — the consent gate's own declaration — has none.

**Fix:** pin `ConsentPolicy`'s members against literal spellings rather than against itself, in `actions.test-d.ts`:

```ts
/** The gate selector is a closed pair. Widened to `string`, a typo silently picks no gate. */
type _bindToIsClosed = Expect<Equals<ConsentPolicy["bindTo"], "userTurn" | "response">>;

/** The member set is closed, so a new dial cannot appear beside `minGrade` unnoticed (D-04). */
type _policyKeys = Expect<Equals<keyof ConsentPolicy, "requires" | "bindTo" | "snapshotEquality" | "minGrade" | "onMissing">>;

type _minGradeIsGrade = Expect<Equals<ConsentPolicy["minGrade"], ConsentGrade | undefined>>;
```

### WR-05: `ReadbackReceipt`'s four fields are pinned two ways, and the two that are not pinned by predicate can be widened silently

**File:** `packages/concierge/test-d/consent.test-d.ts:56-72`; `packages/concierge/src/types.ts:563`, `:575`

**Issue:** the file correctly explains at `:63-66` why the object fixture alone is insufficient — `"SHA-256"` assigns happily to a widened `string` — and then adds `Equals` predicates for `alg` and `canonicalization` only. `hash` and `canonical` are left on the fixture, which detects *removal* (TS2353 excess-property) but not *widening*, since any value assigns to a widened type.

Measured: `types.ts:575` `canonical: Uint8Array` → `canonical: unknown` exits 0 against the full suite.

That is not a cosmetic widening. `canonical: unknown` lets a sink return a re-serialized string in the field whose entire justification (`:568-574`) is WebAuthn's rule that intermediaries must not parse-and-reserialize — reopening the exact hazard the field exists to close, with no diagnostic.

**Fix:** extend the same treatment the file already applies to the other two:

```ts
/** The hash is a string, not `unknown` — a widened field accepts a re-derived value. */
type _receiptHashIsString = Expect<Equals<ReadbackReceipt["hash"], string>>;

/** The canonical bytes are bytes. Widened to `unknown`, a sink can hand back a re-serialized string. */
type _receiptCanonicalIsBytes = Expect<Equals<ReadbackReceipt["canonical"], Uint8Array>>;
```

### WR-06: `ActionResult` admits contradictory states — `{ ok: true, reason: "handler_error" }` typechecks

**File:** `packages/concierge/src/types.ts:64-97`

**Issue:** `ok: boolean` and `reason?: ReasonCode | undefined` are independent, so both of these are legal:

```ts
const contradictory: ActionResult = { ok: true, reason: "handler_error", message: "Done." };
const alsoBad:       ActionResult = { ok: false, message: "Failed." };   // failure, no reason
```

`ReasonCode`'s doc (`:168-179`) is emphatic that the closed union exists to preserve "the exhaustiveness every dispatcher and consent mapper depends on." A success carrying a failure code runs that exhaustive mapper on a result that did not fail, and a failure carrying no code is the state the closed union was supposed to make impossible to under-report. Both are handed to the model via `Transport.respond` (`:1019`).

Reshaping `ActionResult` into a discriminated union after publish is breaking, which puts it inside this phase's stated scope. I am flagging it as a warning rather than a blocker because the flat shape may have been chosen deliberately for `Transport.respond` serialization — but I found no record of that trade in `01-CONTEXT.md`, `01-VALIDATION.md`, or the file's own comments, which discuss only the rejected generic-over-reason variant and the rejected `` `app.${string}` `` escape hatch. If it was deliberate, the reasoning belongs in the doc comment beside the other rejected alternatives.

**Fix (if the constraint is to be enforced):**

```ts
export type ActionResult =
  | { ok: true;  message: string }
  | { ok: false; reason: ReasonCode; message: string };
```

**Fix (if the flat shape is deliberate):** record why in `ActionResult`'s doc comment, in the same form as the two rejections already documented on `ReasonCode`, so the next reviewer does not re-litigate it.

### WR-07: three more required/closed contracts have no assertion anywhere in the suite

**File:** `packages/concierge/src/types.ts:419`, `:259`, `:65`, `:96`

**Issue:** four mutations, all exit 0 against the full four-file suite:

| Mutation | Why it matters |
|---|---|
| `ConsentAckBase.userTurnId: string` → optional (`:419`) | `userTurnId` is the value `bindTo: "userTurn"` compares. Optional, an ack can arm with no turn identity and the strongest binding has nothing to check. |
| `DeliveryReport.outcome` → `string` (`:259`) | `01-VERIFICATION.md` cites this literal union as the evidence for SC-1 ("Both delivery hooks carry a completion outcome"). Battery mutant M2 tests the hook's *parameter*, not the union. Widened, `outcome === "completed"` still compiles and every other value silently passes an exhaustive check. |
| `ActionResult.ok` → optional (`:65`) | The success flag every dispatcher branches on. |
| `ActionResult.message` → optional (`:96`) | The field `MESSAGE_MAX_CHARS` and the whole ConsentGrade ladder are written about. |

`DeliveryReport.outcome`'s natural home is `transport.test-d.ts` (out of this review's file scope) but the contract it guards is declared in `types.ts`, which is in scope, and `01-VERIFICATION.md` records it as verified.

**Fix:** in `consent.test-d.ts` (ack and delivery) and `results.test-d.ts` (result):

```ts
type _ackCarriesTurnIdentity = Expect<Equals<ConsentAck<Booking, null>["userTurnId"], string>>;
type _deliveryOutcomeIsClosed = Expect<Equals<DeliveryReport["outcome"], "completed" | "interrupted">>;
type _resultOkRequired      = Expect<Equals<ActionResult["ok"], boolean>>;
type _resultMessageRequired = Expect<Equals<ActionResult["message"], string>>;
```

---

## Info

### IN-01: `RedactionPolicy`'s doc claims a default that the type cannot have

**File:** `packages/concierge/src/types.ts:697-704`, `:736`

**Issue:** the comment reads "Required for any action with a non-empty schema. Defaults to `"drop"`", but `ActionDefinition.redact` (`:736`) is a **required** member with no optionality, so nothing ever defaults — every action must state a policy explicitly. Being stricter than documented is the safe direction, but the prose is wrong and will be read as "I can omit this."

**Fix:** reword to match the shipped type — "Required on every action; there is no implicit default. `"drop"` is the value to choose when in doubt, because telemetry leaks must be opt-in."

### IN-02: the interface `Bridge` is shadowed by a type parameter named `Bridge` in three declarations

**File:** `packages/concierge/src/types.ts:294-298` (`ActionHandler`), `:710-716` (`ActionDefinition`), `:819-825` (`AnyActionDefinition`)

**Issue:** `ActionHandler<Args, Bridge, …>` and `ActionDefinition<Name, Schema, Bridge = unknown, …>` bind a type parameter named `Bridge`, shadowing the exported interface of the same name inside those declarations. Meanwhile `BridgeRegistry<B extends Bridge>` and `StageDefinition<B extends Bridge>` use `B` and refer to the real interface. Two spellings for two different things in one file.

This is very likely how CR-02 stayed invisible: a reader scanning `ActionDefinition`'s unconstrained `Bridge = unknown` sees a parameter that accepts anything, and does not connect it to `StageDefinition<B extends Bridge = Bridge>` five hundred lines away, where the constraint is the broken one.

**Fix:** rename the type parameter to `B` in all three declarations, matching `BridgeRegistry` and `StageDefinition`. Purely mechanical; no assignability changes.

### IN-03: `USER_CANCELLED` / `USER_DECLINED` discard their literal types, unlike `MESSAGE_MAX_CHARS` which deliberately preserves them

**File:** `packages/concierge/src/types.ts:182-192`

**Issue:** both are annotated `Readonly<ActionResult>`, so `USER_CANCELLED.ok` widens to `boolean` and `.reason` widens to `ReasonCode | undefined`. A consumer cannot narrow on either, and a type test cannot detect the constants' values changing. `MESSAGE_MAX_CHARS` (`:206`) is deliberately left unannotated for exactly the opposite reason, documented at `:194-205`: "the literal type `180` survives into the emitted `.d.ts`, so a consumer — and this package's own type tests — can guard against a silent widening."

`isolatedDeclarations` does require an annotation on a `const` initialized from a call expression (TS9010), so the annotation cannot simply be dropped — but it can be a narrower one that keeps the signal.

**Fix:**

```ts
export const USER_CANCELLED: Readonly<{ ok: false; reason: "cancelled"; message: string }> =
  Object.freeze({ ok: false, reason: "cancelled", message: "Cancelled." });
```

---

## Verified sound — explicitly not reported as defects

Recorded so a future reviewer does not re-open them:

- **`DigestLike` method syntax vs `ConsentPolicy.snapshotEquality` function-property syntax.** Both intact and correct — `types.ts:642` is method form, `types.ts:399` is property form. The asymmetry is deliberate, documented at `:625-639` and `:384-398`, and is not an inconsistency. This discharges `01-VERIFICATION.md`'s human-verification item 2. I additionally confirmed the phase's own claim that the `DigestLike` seam is unguardable in-repo: switching it to a function property leaves the suite at exit 0.
- **Export surface.** 42 symbols declared in `types.ts`, 42 re-exported by `index.ts`, plus the `StandardSchemaV1` pass-through — zero gaps, zero dangling names. `ConsentAckBase` and `serverChallengeBrand` are both absent from `index.ts` and emitted module-private in the `.d.ts` (non-exported `interface` and non-exported `declare const unique symbol` respectively). `MESSAGE_MAX_CHARS = 180` survives declaration emit as a literal. No `ReadbackAttestation` exists anywhere.
- **No-DOM / no-Node / no-TLA.** No `window`, `document`, `navigator`, `globalThis`, `process`, `setTimeout`, `Buffer`, `crypto`, or `TextEncoder` outside doc comments. No top-level `await`. `ArrayBufferView` and `Uint8Array` are both `lib: ["ES2022"]` members. The `AbortSignalLike` / `DigestLike` / `Scheduler` structural stand-ins are consistent and correct.
- **`any` in `AnyActionDefinition`** (`:823-824`) — deliberate, load-bearing, exhaustively documented, and I independently confirmed it does not block realistic actions: an action whose handler reads `ctx.args` and whose `redact` is a function assembles into a `StageDefinition` at exit 0.
- **`ServerChallenge` brand, `ReadbackSink` generic-function form, and the `ConsentAck` construction-side invariant.** Dropping the brand, widening `presentReadback` to `any`, widening branch A's `grade` to the full `ConsentGrade`, making `payload` optional, and widening the attested `readbackHash` to `unknown` are all caught. The construction-side half of SC-6 is genuinely enforced; CR-01 is about the mutation side only.
- **Suppression-directive discipline.** Both in-scope test files claim "exactly two" directives; both have exactly two. No `@ts-ignore`, `@ts-nocheck`, or `eslint-disable` anywhere. No `TODO`/`FIXME`/`HACK`/`XXX` in scope.

---

_Reviewed: 2026-07-28T16:54:26Z_
_Reviewer: Claude (gsd-code-reviewer) — FORCE stance. 17 new mutations executed in isolated `/tmp` sandboxes against copies of the real `src/`; working tree verified unmodified before and after._
_Depth: deep_
