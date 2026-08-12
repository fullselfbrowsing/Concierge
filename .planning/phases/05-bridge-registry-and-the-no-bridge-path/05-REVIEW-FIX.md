---
phase: 05-bridge-registry-and-the-no-bridge-path
fixed_at: 2026-07-31T20:05:00Z
review_path: .planning/phases/05-bridge-registry-and-the-no-bridge-path/05-REVIEW.md
iteration: 2
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
iterations:
  - iteration: 1
    fixed_at: 2026-07-31T19:38:00Z
    source: "05-REVIEW.md (pass 1)"
    findings_in_scope: 9
    fixed: 9
    skipped: 0
  - iteration: 2
    fixed_at: 2026-07-31T20:05:00Z
    source: "05-REVIEW.md (pass 2, re-review, commit de46ce5)"
    findings_in_scope: 1
    fixed: 1
    skipped: 0
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-07-31
**Source review:** `.planning/phases/05-bridge-registry-and-the-no-bridge-path/05-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope (Critical + Warning): **9**
- Fixed: **9**
- Skipped: **0**
- Info findings (out of scope): 5 — one of them, **IN-05**, was subsumed by CR-01's fix and is
  recorded below; the other four are untouched.

Every finding was **reproduced by execution against `packages/concierge/dist/index.js` before being
fixed, and the reproduction was re-run against the rebuilt artifact afterwards.** The full before /
after transcript is inlined per finding. No fix here was applied on the strength of reading the
review alone.

**Gate, measured after the last commit:**

| Gate | Result |
|---|---|
| `pnpm build` | exit 0 — `attw` **No problems found**, `publint --strict` **No issues found** |
| `pnpm test` | **`Test Files 9 passed (9)` / `Tests 144 passed (144)`** (baseline was 133) |
| `pnpm typecheck` | exit 0 |
| `pnpm check:deps` | exit 0 — Assertion A and B both PASS |
| `pnpm check:artifact` | exit 0 |
| `pnpm check:pack` | exit 0 — foreign project installed the tarball, typechecked the shipped `.d.ts` with `skipLibCheck: false`, imported the runtime |
| `pnpm check:node-floor` | exit 0 — installed and imported on a pinned v22.12.0 |
| `git status --porcelain` | empty |
| Mutation battery | **twelve of twelve `src/bridge.ts` mutants re-run, twelve caught, zero escapes** |
| `grep -c "concierge: \[" ` over suite output | **0** — every new case that provokes a diagnostic captures it |

**Constraints, re-checked mechanically after the last commit:**

`grep -c "^let " src/bridge.ts` = **0** · `grep -c "catch (" src/bridge.ts` = **0** (every `catch`
still binds nothing) · `makeDefaultNormalizer(` occurs exactly **2** (declaration + one live call
site, so M-05-3 still mutates live code) · zero `structuredClone` / `globalThis` / `window` /
`document` in `bridge.ts` · no top-level `await` · `ReasonCode` still **12** members (3 abandon +
9 failure) · `assertSingleInstance()` still the first statement of `createBridge`'s body · the guard
still on the monotonic token · the default normalizer still clone-then-freeze · the registry object
still frozen · `concierge.ts`, `catalog.ts` and `host.ts` **byte-unchanged**.

---

## Fixed Issues

### CR-01: A consumer-authored exception escapes `captureSnapshot` with its message intact

**Files modified:** `packages/concierge/src/bridge.ts`, `packages/concierge/test/bridge-snapshot.test.ts`
**Commit:** `8f0e5e7`

**Reproduced (pre-fix, against `dist/index.js`):**

```
E1 proxy get trap throws     : threw=Error: SECRET-FROM-THE-APP user@example.com | warns=0
E2 accessor getter throws    : threw=Error: SECRET-2 pii@example.com             | warns=0
E3 ownKeys trap throws       : threw=Error: SECRET-3 keys                        | warns=0
E4 bridge null (read())      : threw=TypeError: Cannot read properties of null (reading 'snapshot')
E5 bridge.snapshot undefined : threw=TypeError: Cannot convert undefined or null to object
```

**Re-run after the fix:**

```
E1 proxy get trap throws     : threw=null | warns=1
E2 accessor getter throws    : threw=null | warns=1
E3 ownKeys trap throws       : threw=null | warns=1
E4 bridge null (read())      : threw=null | out={}
E5 bridge.snapshot undefined : threw=null | out={}
```

**Applied fix:** the holder read and its enumeration now share one `try`; the per-key
`snapshot[key]` read moved inside the per-key `try`. The doc comment moved with the code — it now
names all three escape routes (`holder[key]`, `getter()`, `normalizeValue(…)`) instead of two.

**Two decisions this required, both written into the source:**

1. **A `null` bridge captures to `{}` SILENTLY.** `captureSnapshot(registry.read(), id)` is the
   idiom, and `read()` returning `null` is DX-02's *supported* state — core never auto-fails an
   action because a declared bridge is unmounted. A warning there would fire on every capture taken
   while a component simply is not on screen, which is the same "a channel that cries wolf on
   correct behaviour is a channel developers filter out" hazard `B20` answers the same way for the
   refused unsubscriber, and `D16` answers the same way for a throwing `read()`. A bridge carrying
   no `snapshot` at all degrades identically.
2. **A holder-level throw warns once, under the EXISTING `[snapshot_threw]` code, not a third one.**
   A new module-private builder `snapshotHolderThrewMessage(id)` names the registry alone, because
   there are no keys to name. It reuses the code deliberately: `snapshotExoticMessage`'s stated
   reason for keeping the two codes apart is that "one code covering both would send a developer
   looking at a getter that is working perfectly", and that argument runs the *other* way here — the
   remedy for a throwing `ownKeys` trap is exactly the remedy `snapshotThrewMessage` already prints.

**Regression cases, each observed red against the pre-fix artifact:**

| Case | Pre-fix failure |
|---|---|
| `D22` — holder `get` trap throws | `expected [Function] to not throw … 'Error: SECRET-FROM-THE-APP user@example.com'` |
| `D23` — holder `ownKeys` trap throws | `expected [Function] to not throw … 'Error: SECRET-3 keys'` |
| `D24` — `captureSnapshot(registry.read(), id)` with nothing registered | `expected [Function] to not throw … 'TypeError: Cannot read properties of null (reading 'snapshot')'` |

All three assert `.not.toThrow()` **and** that no fragment of the consumer's message reaches the
diagnostic.

**IN-05 was subsumed here.** The `captureSnapshot` doc comment now records that only own enumerable
string keys are captured, and that the consequence is a prototype-bearing holder capturing as `{}`
with no warning — which is IN-05's requested fix verbatim. Own-keys-only remains the rule; only the
silence is now documented rather than discovered.

---

### CR-02: The clone's pass-through branch never calls `onExotic`, so the documented hole is invisible

**Files modified:** `packages/concierge/src/bridge.ts`, `packages/concierge/test/bridge-snapshot.test.ts`
**Commit:** `65bf078`

**Reproduced (pre-fix) → after:**

```
                                pre-fix                        after
A: class instance    byRef=true, warnings=0        byRef=true, warnings=1 [snapshot_exotic]
B: nested function   byRef=true, warnings=0        byRef=true, warnings=1
C: cross-realm       byRef=true, warnings=0        byRef=true, warnings=1
B2: top-level fn     byRef=true, warnings=0        byRef=true, warnings=1
```

**Applied fix:** `cloneDetached`'s final pass-through branch now calls `onExotic()` before returning
by reference, and **functions are tested before the primitive guard** and reported. The second half
matters as much as the first: `typeof v !== "object"` is true for a function, so a single guard gave
a closure over live app state the same silence a number earns — and the two are opposites. A number
is already detached; a closure is the *most* undetachable value the walk can meet.

The value is still handed back by reference in every case. Nothing about the documented limit
changed — only its visibility.

**Regression cases, each observed red (`expected [] to have a length of 1 but got +0`):**

- `D8` extended with `toContain("[snapshot_exotic]")` and the rendered subject — it previously
  asserted the by-reference behaviour and said nothing about warnings, which is the gap the review
  named.
- `D25` — a function, top-level and nested three levels down, proving `onExotic` is threaded through
  the recursion rather than fired only at the root.
- `D26` — `Object.create({})` and a genuine second realm via `node:vm`. That import is new to the
  file and is justified in a comment: the cross-realm miss cannot be constructed in-realm, so the
  claim is either executed against a real realm boundary or it is prose.

---

### CR-03: `__proto__` is written through a plain computed assignment

**Files modified:** `packages/concierge/src/bridge.ts`, `packages/concierge/test/bridge-snapshot.test.ts`
**Commit:** `5916f14`

**Reproduced (pre-fix) on the canonical `JSON.parse` shape:**

```
D: source own keys = [ '__proto__', 'total' ]
D: clone own keys  = [ 'total' ]
D: clone prototype = { injected: true }
D: JSON of clone   = {"total":4180}
D: clone.injected  = true          (proto is Object.prototype: false)
D2: null-proto clone keys = [ 'total' ]
F2: returned own keys = [ 'ok' ] | proto = { evil: 1 } | res.evil = 1
F2b: catch-arm own keys = [] | "__proto__" in out = false
```

**Re-run after the fix:**

```
D: clone own keys  = [ '__proto__', 'total' ]
D: clone prototype = {}
D: JSON of clone   = {"__proto__":{"injected":true},"total":4180}   (identical to the source)
D: clone.injected  = undefined     (proto is Object.prototype: true)
D2: null-proto clone keys = [ '__proto__', 'total' ]
F2: returned own keys = [ '__proto__', 'ok' ] | proto = {} | res.evil = undefined
F2b: catch-arm own keys = [ '__proto__' ] | "__proto__" in out = true
```

**Applied fix:** a module-private `defineField(target, key, value)` writing through
`Object.defineProperty` with `{writable, enumerable, configurable}` all true — the exact shape a
plain assignment produces for every other key, so the clone's per-node `Object.freeze` still clears
`writable` and `configurable` as before. All **three** sites now use it: `cloneDetached`'s plain-object
branch, and `captureSnapshot`'s success **and `catch`** arms.

**The `catch` arm is the half that is easy to miss.** `out[key] = undefined` for a key named
`__proto__` is a silent no-op, so a failed key was absent from the record rather than present at
`undefined` — defeating the contract that lets a reader tell a key that *failed* from a key the
component never declared.

**Regression cases:**

| Case | Pre-fix failure |
|---|---|
| `D27` — the clone, plain and null-prototype sources | `expected [ 'total' ] to deeply equal [ '__proto__', 'total' ]` |
| `D28` — the returned record, success and `catch` arms | `expected [ 'ok' ] to deeply equal [ '__proto__', 'ok' ]` |

`D27` asserts its own fixture first (`Object.keys(payload)` is `["__proto__","total"]`), so a case
whose `JSON.parse` shape quietly stopped carrying an own `__proto__` cannot go green while proving
nothing. `D28` uses `Object.defineProperty` rather than an object literal for the same reason —
`{ __proto__: fn }` in a literal *sets the prototype* and creates no own key.

---

### WR-01: An exotic warn suppresses the throwing-getter warn for the same key

**Files modified:** `packages/concierge/src/bridge.ts`, `packages/concierge/test/bridge-snapshot.test.ts`
**Commit:** `ed22976`

**Reproduced → after:**

```
pre-fix : G2: threw=null | out.mixed=undefined | warns=1 | codes=[ '[snapshot_exotic] …' ]
after   : G2: threw=null | out.mixed=undefined | warns=2 | codes=[ '[snapshot_exotic] …', '[snapshot_threw] …' ]
```

**Applied fix:** one `Set` per code (`warnedThrew`, `warnedExotic`) instead of one shared by both.
Each is still per key, so a value carrying twenty undetachable members still prints one line — the
fix is not "drop the latch".

The single shared latch read as restraint; what it did was let the *first* code seen suppress the
second, and the exotic path always runs first because it fires from inside the clone while the throw
is only observed after the clone returns. The actionable code was the one suppressed.

**Regression:** `D29`, observed red at `expected [ Array(1) ] to have a length of 2 but got 1`. It
has two halves — both codes for one key, **and** repeats still collapsing to one line per code per
key, which is what stops "drop the latch" passing as the fix. The fixture's key order is
load-bearing and says so: reversing `when` and `boom` makes the case green on the pre-fix build.

---

### WR-02: Snapshot getters are invoked with the receiver detached

**Files modified:** `packages/concierge/src/bridge.ts`, `packages/concierge/test/bridge-snapshot.test.ts`
**Commit:** `008ce6f`

**Reproduced → after:**

```
pre-fix : F3: count = undefined | warns = [ '[snapshot_threw] snapshot "results.count": the getter threw…' ]
after   : F3: count = 7         | warns = []
```

**Applied fix:** `(getter as () => unknown).call(holder)`. Arrow members ignore the receiver, so
every existing snapshot in the suite behaves identically — asserted directly in the case rather than
left to inference.

The pre-fix diagnostic was accurate about *what* happened and wrong about *why*: its remediation
text ("make the getter total — it must not assume any part of the component's state has loaded yet")
sends the developer looking for a load-order bug that does not exist.

**Regression:** `D30`, observed red at `expected undefined to be 7`. It asserts the captured value
**and** zero warnings, so it cannot be satisfied by something else quietly succeeding.

---

### WR-03: `offPageResult`'s truncation can emit a lone surrogate

**Files modified:** `packages/concierge/src/bridge.ts`, `packages/concierge/test/bridge-snapshot.test.ts`
**Commit:** `c62d997`

**Reproduced → after:**

```
pre-fix : G1: LONE HIGH SURROGATE at n = 179 | len = 180 | tail = "AAA\ud83d" | wellFormed = false
after   : G1: no lone surrogate found        (swept n = 150…220)
```

**Applied fix:** a module-private `boundedMessage(message)` that trims back one code unit when the
last retained one is a high surrogate (`0xd800`–`0xdbff`), tested with `charCodeAt` and a numeric
range — ES5, so nothing here needs a lib beyond `ES2022`.

**This is bounding, not sanitizing,** and the source says so: it removes no character the consumer
wrote, it declines to emit half of one. SEC-06 (stripping C0/C1, collapsing whitespace) is still
Phase 6's and is still not done in this file. `offPageResult`'s doc gained a sentence placing the
code-point trim inside the shared contract with SEC-06 rather than inside SEC-06 itself.

**Regression:** `D31`, observed red at `expected false to be true`. It sweeps every offset in a
window rather than one lucky one, pins the exact measured boundary (`MESSAGE_MAX_CHARS - 1`, pair
dropped whole rather than half-emitted or replaced by U+FFFD), and asserts a non-overshooting message
comes back whole — which is what stops the fix being "always drop the last character".

**⚠️ This moved mutation anchor M-05-12.** See § *Mutation register* below.

---

### WR-04: `Map` / `Set` / `Date` subclasses are silently downgraded

**Files modified:** `packages/concierge/src/bridge.ts`, `packages/concierge/test/bridge-snapshot.test.ts`
**Commit:** `a810846`

**Reproduced → after:**

```
pre-fix : F4: clone ctor = Map | lost .tag = undefined | lost subclass = true | warns = 0
after   : F4: clone ctor = Map | lost .tag = undefined | lost subclass = true | warns = 1
```

**Applied fix — and this is a judgement call between the review's two options.** The review offered
"restrict the branches to exact instances and let subclasses fall through to the reported
pass-through" **or** "keep cloning and call `onExotic()` when the prototype is not the base". I took
the second, because the first would send a **cross-realm** `Date` or `Map` down the pass-through
path — and the union-of-predicates test (`instanceof` OR the `toString` tag) exists precisely to
catch those, since a cross-realm instance fails `instanceof` and passes the tag. Detachment is worth
more there than prototype fidelity, so the clone stays and only the loss becomes visible.

Each report is gated on `instanceof` **as well as** the prototype test, and that conjunct is
load-bearing rather than belt-and-braces: a cross-realm instance also fails the prototype test — its
prototype is the other realm's — so a bare prototype test would report every cross-realm collection,
where nothing carrying app data is actually lost. **The remaining miss is a cross-realm subclass,
which stays silent**; that is recorded in the source comment rather than chased.

**Regression:** `D32`, observed red at `expected [] to have a length of 1 but got +0`. It runs over
`Map`, `Set` **and** `Date` subclasses, asserts the content still clones (so a build that silently
switched to pass-through cannot pass it), and carries a control proving base instances stay silent
(so "always warn on this branch" cannot pass it either).

---

### WR-05: `B8` and `B9` are byte-identical programs presented as two distinct orderings

**Files modified:** `packages/concierge/test/bridge.test.ts`
**Commit:** `26dba96`

**Reproduced:** with comments stripped, the two case bodies were string-equal — verified
programmatically by brace-matching the two `it` bodies and normalising whitespace.

**Root cause, found by going back to the taxonomy.** `05-RESEARCH.md:725` describes O8 as
*"three components, middle unmounts late"* and then transcribes it as
`reg A(u1); reg B(u2); reg A(u3); u2()` — which is **two** components, and which is `O4` exactly.
The description was right and the program was wrong.

**Applied fix — the second judgement call.** The review offered "make `B9` genuinely different" or
"delete `B9` and correct every count to twelve". I corrected the **program**, because doing so makes
the taxonomy match its own description *and* leaves every derived number in every document true.
Re-measured from scratch, all three registry implementations run over all thirteen orderings:

```
O8: token = C | object-guarded = C | naive = 🔴 null
object guard agrees on 9 of 13, differing on exactly O1b, O2b, O4b, O4c
naive clear  agrees on 5 of 13, differing on O1b, O2, O2b, O3b, O4, O4b, O4c, O8
```

So `13 − 4 = 9` survives, `src/bridge.ts:245`'s "nine of thirteen" survives, and O8's membership of
the eight that discriminate the unconditional clear survives. Deleting `B9` would have forced
"eight of twelve" through the source comment, `05-VALIDATION.md`, `05-04-PLAN.md` and
`05-RESEARCH.md` for no gain in truth.

**Confirmed by mutation:** M-05-2 still reddens `B9` (`B6, B7, B8, B9, B10–B13, B20`), so the
register's M-05-2 row loses nothing.

---

### WR-06: `test/bridge.test.ts` asserts a fact about the source that is already false

**Files modified:** `packages/concierge/test/bridge.test.ts`
**Commit:** `2df9583`

**Reproduced:** `git log --oneline -1 934b53f` → `fix(05): correct the object-guard ordering count
from ten to nine`, and `src/bridge.ts:245` reads *"nine of thirteen"*. The header paragraph still
instructed a reader that the source comment "is one plan away from being corrected".

**Applied fix:** the paragraph now states the settled fact — both say nine, the earlier "ten" came
from `05-04-PLAN.md` and was corrected in the source by `934b53f`, and the figure is `13 − 4 = 9` on
exactly O1b/O2b/O4b/O4c. It also records *why* it was replaced rather than amended, and notes that
the figure is contingent on the thirteen orderings being thirteen distinct programs — pointing at
`B9`, where that contingency was measured.

---

## Mutation register — two anchors moved, whole battery re-run

`05-VALIDATION.md` was updated in commit **`9f064ec`**. The register table was corrected **in place**
(a stale literal there is a live contract that aborts at exit 3 on its next use); the phase-gate
battery section is left as the historical measurement it is, with a pointer to the re-run.

| Mutant | Old literal | New literal |
|---|---|---|
| M-05-9 | `normalizeValue(getter())` | `normalizeValue((getter as () => unknown).call(holder))` |
| M-05-12 | `message.slice(0, MESSAGE_MAX_CHARS)` | `message.slice(0, cut)` |

All **twelve** `src/bridge.ts` mutants were re-run against the fixed tree with build and test output
captured separately, so Known Limitation 2 is satisfied — every PASS is confirmed to have **compiled
and run tests**, not to have failed at the build step. **Twelve caught, zero escapes**, `git status
--porcelain` empty before the first probe and after the last. The five `concierge.ts` / `index.ts` /
`types.ts` mutants were **not** re-run: those three files are byte-unchanged.

**One phase-gate finding is now obsolete, and it is the only detector this work removed.** Battery
finding 4 recorded that disabling the `Date` arm reddens D7 *and D12*, because the proxied `Date`
then "falls straight through to pass-by-reference, so it is carried live **without a warning**, which
is precisely the invisible hole the exotic-warn signal path exists to close." **CR-02 closed that
hole.** The fall-through now reports, so D12's two claims (by reference, one exotic warn) both still
hold and D12 no longer detects M-05-5's Date arm. It is not a coverage loss — D7 still reddens on
all three arms and D32 now reddens on the Date arm too — but a reader comparing the two tables would
otherwise see a detector silently disappear.

---

## Not fixed — Info findings, out of scope

These were outside `fix_scope` and are left for a later decision. None is a correctness defect.

| ID | File | Summary |
|---|---|---|
| IN-01 | `src/types.ts:1653`, `src/concierge.ts` | `ConciergeConfig.normalizeSnapshot` is wired to nothing; the field should say it is a Phase 8 seam and that `captureSnapshot`'s third parameter is the only live route today |
| IN-02 | `src/bridge.ts` | The warn builders claim `id` and `key` are "developer-authored"; `key` can come from data and neither is escaped. **Note:** the new `snapshotHolderThrewMessage` added by CR-01 does *not* repeat the over-strong claim — its doc says only that the caught value is not in scope |
| IN-03 | `src/bridge.ts:221-241` | `register(null)` is accepted and occupies the slot invisibly; TypeScript rejects it, a JavaScript consumer is unprotected |
| IN-04 | `src/bridge.ts` | A spoofed `Symbol.toStringTag` diverts a cloneable plain object into a collection branch. It warns, so it is visible; the comment should record that the tag half is app-controllable |
| IN-05 | `src/bridge.ts` | **SUBSUMED by CR-01** — the `captureSnapshot` doc comment now records that a prototype-bearing holder captures as `{}` with no diagnostic |

---

## Three judgement calls worth a human's ratification

Each is written into the source with its reasoning, and each could be reversed without re-deriving it.

1. **A `null` bridge captures to `{}` silently** (CR-01). The alternative is warning, which would
   fire on every capture taken while a component is legitimately not on screen. Reversible in one
   line.
2. **Clone-and-report for collection subclasses, not restrict-to-exact-instances** (WR-04). The
   alternative sends cross-realm `Date`/`Map`/`Set` down the pass-through path, losing the
   detachment the union predicate exists to provide. The accepted residual miss is a *cross-realm
   subclass*, which stays silent.
3. **O8's program was corrected rather than the ordering count** (WR-05). The alternative — deleting
   `B9` and renumbering to twelve — propagates through the source comment and three planning
   documents, and contradicts O8's own written description.

---

_Fixed: 2026-07-31_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

---
---

# Iteration 2 — fixes for the re-review (pass 2)

**Source:** the re-review section appended to `05-REVIEW.md` in commit `de46ce5`
**Fixed at:** 2026-07-31
**Iteration:** 2

Pass 2 verified 8 of 9 iteration-1 fixes fully closed, and verified them the honest way — the
reviewer rebuilt the pre-fix artifact from `271a198` in a scratch mirror and ran the *current* tests
against it rather than trusting the "observed red" claim. All eleven `D22`–`D32` regression cases
were confirmed genuine detectors (12 failures against the pre-fix artifact, none vacuous).

**Summary:**

- Findings in scope: **1** (`RR-01`, Warning)
- Fixed: **1**
- Skipped: **0**
- Plus one Info item the coordinator asked for by name: **IN-02**'s "soften the claim" branch.

**Commits:**

| Hash | What |
|---|---|
| `2551771` | `RR-01` — the `Array` subclass downgrade now reports |
| `ff311c3` | `IN-02` — the four warn builders' provenance claim softened to what holds |
| `7c7fc31` | register `M-05-15`, record the re-measurement in `05-VALIDATION.md` |

**Gate, measured after the last commit:**

| Gate | Result |
|---|---|
| `pnpm build` | exit 0 — `attw` **No problems found**, `publint --strict` **No issues found** |
| `pnpm test` | **`Test Files 9 passed (9)` / `Tests 144 passed (144)`** — unchanged, because `D32` was *extended* rather than supplemented |
| `pnpm typecheck` | exit 0 |
| `check:deps` / `check:artifact` / `check:pack` / `check:node-floor` | all exit 0 |
| `git status --porcelain` | empty |
| Mutation | **eleven mutants re-run against the RR-01 tree, eleven caught, zero escapes** — including one **new** mutant |
| `grep -c "concierge: \["` over suite output | **0** |

**Constraints re-checked:** `^let ` = **0** · `catch (` = **0** · `makeDefaultNormalizer(` = **2** ·
`structuredClone`/`globalThis` in `bridge.ts` = **0** · no top-level `await` · `ReasonCode` = **12** ·
`concierge.ts` / `catalog.ts` / `host.ts` **byte-unchanged since `de46ce5`** (`git diff --stat`
returns nothing) · `isolatedDeclarations` / `exactOptionalPropertyTypes` / `noUncheckedIndexedAccess`
all on and `tsc` exit 0.

---

## Fixed — RR-01: WR-04's fix skipped the `Array` branch

**Files modified:** `packages/concierge/src/bridge.ts`, `packages/concierge/test/bridge-snapshot.test.ts`
**Commit:** `2551771`

**Reproduced against the post-iteration-1 artifact:**

```
Array subclass        -> warns = 0 | ctor = Array | currency LOST = undefined | instanceof Basket = false | content kept = {"sku":"a"}
Map   subclass        -> warns = 1
Set   subclass        -> warns = 1
Date  subclass        -> warns = 1
nested Array subclass -> warns = 0
```

**Re-run after the fix:**

```
Array subclass        -> warns = 1 | ctor = Array | currency LOST = undefined | instanceof Basket = false | content kept = {"sku":"a"}
Map/Set/Date subclass -> warns = 1
nested Array subclass -> warns = 1
--- must stay silent ---
base array            -> warns = 0
nested base array     -> warns = 0
cross-realm array     -> warns = 0 | cloned = true | isArray = true
proxy over array      -> warns = 0
sparse array          -> warns = 0
```

**Applied fix**, exactly the gate the reviewer specified:

```ts
if (Object.getPrototypeOf(obj) !== Array.prototype && obj instanceof Array) {
  onExotic();
}
```

**Why `instanceof Array` appears one screen below a comment forbidding it.** The detection predicate
four lines above is `Array.isArray`, and its comment says "never `instanceof Array`" — correctly, for
detection, which needs realm-*transparency*. The report gate needs the opposite: realm-*blindness*,
so that a cross-realm array — whose prototype is the other realm's and therefore never
`=== Array.prototype` — is not reported for a downgrade it did not suffer. On this arm the same
conjunct additionally silences a `Proxy` over an array, which is what Vue's `reactive([])` hands core
on the hottest path in the file. Both lines now state which property they want, so neither gets
"harmonized" onto the other.

### The prose half of RR-01 — three claims corrected, not one

The reviewer's second point was that the comment introduced with WR-04 *claimed* what the code did
not do. Fixing that surfaced a third overclaim in the same paragraph.

| Claim as it shipped | Status | Correction |
|---|---|---|
| *"EACH BRANCH REPORTS ITS OWN DOWNGRADE"* | **false** for the array arm | The shared rule moved **above** the array branch and now covers all four arms, rather than claiming "each branch" from a position after one of them |
| *"The remaining miss is a cross-realm SUBCLASS"* | **understated** | A **same-realm** base-prototype instance carrying own properties (`const a = []; a.total = 3`, `const m = new Map(); m.tag = 1`) is also silent. Both residuals are now written out |
| *"…and these are the only lossy clones in the file"* | **false**, found while fixing the other two | The plain-object branch clones an `Object.create(null)` record into a `{}`, so the result inherits `Object.prototype` where the source inherited nothing. **Verified by execution: 0 warns.** Named in the comment and explicitly *not* grouped with the two residuals — it adds inherited members rather than losing anything the app put there, `Object.keys` agrees on both sides so the payload Phase 8 hashes is unaffected, and since `defineField` landed an own `__proto__` key survives it intact. `D6` and `D27` both pin the resulting prototype |

**Not chased, and recorded rather than absorbed:** an own-property test that would catch residual 2
has to be spelled four different ways (array indices vs. `Map`/`Set` entries vs. `Date` internal
slots) for a shape rarer than the subclass it would sit beside, and it carries real false-positive
risk on the array arm. The residual is stated instead.

### Regression

`D32` **extended, not supplemented** — a fourth loop iteration (`class Basket extends Array`) and a
retitle from "a Date/Map/Set SUBCLASS" to "an Array/Date/Map/Set SUBCLASS". Observed red against the
pre-fix source at `expected [] to have a length of 1 but got +0`.

Extending rather than adding is deliberate and is written into the case: RR-01 happened *because* a
case scoped one arm narrower than the claim it backed sat next to a comment making the wider claim.
Keeping all four arms in one loop is what stops the loop and the claim drifting apart again.

**The negative control grew from three shapes to seven**, and the four additions are the substance:

| Shape | Asserted | Why it would otherwise fire |
|---|---|---|
| `[1, 2]` | silent | base case |
| `new Proxy([1, 2], {})` | silent | Vue's `reactive([])` — the hottest path in the file |
| sparse array | silent | `new Array(3)` |
| cross-realm array | silent | its prototype is the other realm's, so never `=== Array.prototype` |

The array arm is the one where a report gated on the prototype **alone** would fire on values a
framework produces constantly, so the control is doing more work here than on the other three.

---

## Also fixed — IN-02's "soften the claim" branch

**Files modified:** `packages/concierge/src/bridge.ts` (comment-only)
**Commit:** `ff311c3`

The re-review's status line was *"IN-02 — still accurate, and now broader"*: the
`snapshotHolderThrewMessage` builder added by CR-01 repeated the "interpolates `id` and nothing else"
phrasing for a **third** message without the validation that phrasing implies. My iteration-1 fix
made an Info finding worse, which is the right thing to be told about.

Two of the four builders claimed `id` and `key` are *"developer-authored strings already in the app's
own source"*. That is stronger than the code enforces: `key` comes from `Object.keys(bridge.snapshot)`,
which an app may build from data (`Object.fromEntries(fields.map(f => [f.name, …]))` is an ordinary
thing to write), and `id` is a free-form string a consumer passes to `createBridge`. Neither is
validated, and both reach `warnHost` unescaped.

The claim is now stated once in full on `bridgeOverwriteMessage` and cited from the other three. What
it asserts is **provenance, not safety**: `id` and `key` originate in the consumer's application
rather than in a caught exception or a snapshot value, so neither can carry the user input a
handler's `Error` message would — and **core does not validate or sanitize either**.

`snapshotHolderThrewMessage` additionally records *why* the caveat is repeated on it rather than only
cited: it was added after the others, and an addition that reuses a sibling's phrasing without its
caveats is how a claim quietly widens — which is exactly what happened.

**Comment-only, and verified so.** No message text changed: `bridge_overwrite` still renders at
**340 characters**, so `B19`'s exact-text pin against `05-01-SUMMARY.md` holds. The one remaining
occurrence of "developer-authored" in the file is the quoted-and-retracted claim inside the
correction itself.

**IN-02 is now half-closed.** The "soften the claim" branch its own Fix section offered is done; the
"strip C0/C1 before interpolation" branch remains **deferred to SEC-06**, which lands at the
dispatcher boundary in Phase 6 and covers every result rather than the ones these four helpers build.
Doing half of it here would put one policy in two places.

---

## Mutation — one mutant added, eleven re-run

**No registered anchor moved.** All ten pre-existing `src/bridge.ts` literals still count exactly 1,
taken unfiltered per Known Limitation 3.

**`M-05-15` was ADDED to the register**, because the RR-01 fix created code no mutant covered — and
because RR-01 *was* precisely a gate that shipped with no detector. It is the register's first mutant
on any of the four report gates.

| ID | Literal → replacement | Count | Exit | Build | Tests ran | Cases red |
|---|---|---|---|---|---|---|
| **M-05-15** | `if (Object.getPrototypeOf(obj) !== Array.prototype && obj instanceof Array) {` → `if (false) {` | 1 | **0 PASS** | ✔ | 53 | **D32** |

Eleven mutants re-run against the RR-01 tree with build and test output captured separately, so
Known Limitation 2 is satisfied — every PASS is confirmed to have compiled and run tests.
**Eleven caught, zero escapes**; `git status --porcelain` empty before the first probe and after the
last.

`M-05-2` and `M-05-11` were **not** re-run this round: both target `createBridge`'s unsubscriber,
which is byte-unchanged since the iteration-1 re-measurement recorded them PASS.

`05-VALIDATION.md` updated in `7c7fc31` — register count 17 → **18**, plus a
§ *Second re-measurement — after re-review RR-01* section carrying the tables above.

---

## Still not fixed — the four remaining Info findings

Unchanged from iteration 1 and confirmed still accurate by the re-review. None is a correctness
defect.

| ID | Status |
|---|---|
| IN-01 | `ConciergeConfig.normalizeSnapshot` is wired to nothing. Verified by the reviewer: `createConcierge({ stages: [], normalizeSnapshot })` accepts the field and never invokes it. `concierge.ts` byte-unchanged |
| IN-02 | **Half-closed this round.** "Soften the claim" done; "strip C0/C1" deferred to SEC-06 |
| IN-03 | `register(null)` still occupies the slot and the next genuine registration still emits a spurious `bridge_overwrite` |
| IN-04 | A `Symbol.toStringTag` spoof still diverts a cloneable plain object into a collection branch. It emits exactly one warning, so it stays visible, and the reviewer confirmed the new subclass report does not double-fire on it — the `instanceof` conjunct correctly excludes it |
| IN-05 | **CLOSED** in iteration 1, confirmed by the re-review |

---

_Fixed: 2026-07-31_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
