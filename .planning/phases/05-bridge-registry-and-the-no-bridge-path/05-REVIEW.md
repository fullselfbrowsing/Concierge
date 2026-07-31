---
phase: 05-bridge-registry-and-the-no-bridge-path
reviewed: 2026-07-31T23:07:42Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - packages/concierge/src/bridge.ts
  - packages/concierge/src/concierge.ts
  - packages/concierge/src/contract.ts
  - packages/concierge/src/index.ts
  - packages/concierge/src/types.ts
  - packages/concierge/test-d/bridge.test-d.ts
  - packages/concierge/test-d/exports.test-d.ts
  - packages/concierge/test/artifact.test.ts
  - packages/concierge/test/bridge-snapshot.test.ts
  - packages/concierge/test/bridge.test.ts
  - packages/concierge/test/export-surface.test.ts
  - packages/concierge/test/single-instance.test.ts
findings:
  critical: 3
  warning: 6
  info: 5
  total: 14
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-31T23:07:42Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Every finding below was reproduced by execution against `packages/concierge/dist/index.js`
(built 17:57, newer than `src/bridge.ts` at 17:32, and confirmed to carry the reviewed
`const getter = bridge.snapshot[key];` shape). No finding is inferred from reading alone.

The declared phase constraints hold and were checked mechanically:
`grep -c "^let " src/bridge.ts` is **0**; there is no top-level `await`; no `window`,
`document`, `navigator`, `console` or `structuredClone` appears outside prose;
`grep -n "catch ("` returns nothing in `bridge.ts` or `concierge.ts`, so every `catch`
binds nothing; `assertSingleInstance()` is the first statement of `createBridge`'s body;
the registry is frozen; the token guard is on the monotonic token. The memo, cycle
safety, DAG identity (including across a `Map` key and a plain field), and
single-invocation of shared getters all behave as documented — probed and correct.

What the green suite and the 17-mutant battery do not see falls into three groups:

1. **`captureSnapshot` has an unguarded region before its `try`.** The property read that
   *produces* the getter, and the `Object.keys` over the snapshot holder, sit outside the
   `try` that the file's own comment claims closes the covert-PII channel. A consumer
   exception escapes with its message intact. This is pitfall 3 from the test file's
   header, one step further out than where the fix was applied.
2. **The clone's primary pass-through branch reports nothing.** The module states "the
   fallback therefore reports" and `snapshotExoticMessage` describes exactly this case,
   but class instances, cross-realm objects and functions are handed back by reference
   with zero diagnostic. The one documented hole that BRG-05 says must never be invisible
   is invisible for its commonest occupant.
3. **`__proto__` is written through a plain computed assignment** in both the clone and
   the returned record, so an own `__proto__` key — the canonical `JSON.parse` shape —
   is silently dropped and the result's prototype becomes app-controlled data.

Two test-quality defects also matter by this repository's own Trap-2 standard: `B8` and
`B9` are byte-identical programs presented as two distinct orderings, which makes the
file's "13 − 4 = 9" arithmetic rest on twelve programs, not thirteen; and the same file's
header asserts a fact about `src/bridge.ts` that commit `934b53f` already falsified.

---

## Critical Issues

### CR-01: A consumer-authored exception escapes `captureSnapshot` with its message intact

**File:** `packages/concierge/src/bridge.ts:683-729`

**Issue:** The doc comment at `:703-710` claims: *"**Both the invocation and the normalize
call are inside the same `try`.**"* Two operations that run consumer code are **outside**
it:

- `Object.keys(bridge.snapshot)` at `:683` — fires `ownKeys` / `getOwnPropertyDescriptor`
  traps on a proxied snapshot holder, and throws outright when `bridge` is `null` or
  carries no `snapshot`.
- `const getter = bridge.snapshot[key]` at `:684` — fires the `get` trap, or an accessor
  getter, on the snapshot holder itself.

`bridge.snapshot` being proxy- or accessor-backed is not an exotic hypothetical: it is the
premise of the whole phase. A Vue app that hands core `reactive({ filters: () => … })`, or
any holder with a computed accessor, reaches both lines. Measured against the artifact:

```
E1 proxy get trap throws     : threw=Error: SECRET-FROM-THE-APP user@example.com | warns=0
E2 accessor getter throws    : threw=Error: SECRET-2 pii@example.com             | warns=0
E3 ownKeys trap throws       : threw=Error: SECRET-3 keys                        | warns=0
E4 bridge null (read())      : threw=TypeError: Cannot read properties of null (reading 'snapshot')
E5 bridge.snapshot undefined : threw=TypeError: Cannot convert undefined or null to object
```

E1/E2/E3 are the covert PII channel CLAUDE.md's rule closes for handler exceptions, one
layer earlier and on a hotter path — the exact failure `D11` exists to prevent, reached
through the one door `D11` does not test. E4 is worse than academic: `captureSnapshot(registry.read(), "results")`
is the literal idiom used at `test/bridge-snapshot.test.ts:278, 516, 567, 613`, and
`read()` returning `null` is DX-02's *supported* configuration.

**Fix:**

```ts
export function captureSnapshot<B extends Bridge>(bridge: B, id: string, normalize?: SnapshotNormalizer): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const warned: Set<string> = new Set<string>();

  // Enumerating the holder is consumer code too — a proxied `snapshot` fires
  // `ownKeys`, and an unmounted bridge is `null`. Neither may reach the caller.
  let keys: readonly string[];
  try {
    keys = Object.keys((bridge as { snapshot?: object } | null)?.snapshot ?? {});
  } catch {
    return out;
  }

  for (const key of keys) {
    const normalizeValue: SnapshotNormalizer = normalize ?? makeDefaultNormalizer(/* … as today … */);

    try {
      // The READ moves inside the try: `bridge.snapshot[key]` runs a get trap.
      const getter: unknown = (bridge.snapshot as Record<string, unknown>)[key];
      if (typeof getter !== "function") {
        continue;
      }
      out[key] = normalizeValue((getter as () => unknown).call(bridge.snapshot));
    } catch {
      out[key] = undefined;
      if (!warned.has(key)) {
        warned.add(key);
        warnHost(snapshotThrewMessage(id, key));
      }
    }
  }

  return out;
}
```

Add a case alongside `D11` whose *holder* is a proxy with a throwing `get` trap, and one
that passes `registry.read()` with nothing registered — both must assert
`.not.toThrow()` and `not.toContain("SECRET-FROM-THE-APP")`.

---

### CR-02: The clone's pass-through branch never calls `onExotic`, so the documented hole is invisible

**File:** `packages/concierge/src/bridge.ts:540-554`

**Issue:** The section note at `:353-360` states the governing invariant:

> A value that cannot be detached is passed through by reference — the documented limit —
> and that hole is accepted. **What is not accepted is the hole being *invisible*** … a
> snapshot value that silently stayed live would turn a security gate into decoration.
> **The fallback therefore reports.**

`cloneDetached`'s own doc at `:387` repeats it: *"`onExotic` is called when a value cannot
be extracted and is handed back by reference."* The final branch at `:554` is `return v;`
with no `onExotic()` call. Only the three *extraction-throw* paths (`:475`, `:489`, `:505`)
report. The `typeof v !== "object"` early return at `:414` also swallows **functions**,
which are closures over live app state.

So the commonest undetachable values report nothing. Measured:

```
A: class instance byRef = true | warnings = 0 []
B: nested function byRef = true | warnings = 0 []
C: cross-realm byRef  = true   | warnings = 0 []
```

`snapshotExoticMessage` (`:623-631`) describes precisely this case — *"a value here could
not be detached and was carried by reference, so it may still change after capture and a
later drift check may not see the change"* — and it is unreachable for it. The consequence
is the one the note names: Phase 8's CON-04 compares a live class instance against itself
and passes unconditionally, with nothing anywhere telling the developer why.

`D8` covers the by-reference behaviour and asserts nothing about warnings; `D13` proves
warnings are conditional using only plain values. Nothing in the suite would go red.

**Fix:** report from the fallback, and split functions out of the primitive early-return:

```ts
function cloneDetached(v: unknown, seen: WeakMap<object, unknown>, onExotic: () => void): unknown {
  if (v === null || (typeof v !== "object" && typeof v !== "function")) {
    return v; // primitives are already detached
  }
  if (typeof v === "function") {
    onExotic();
    return v; // a closure over the app's own state
  }
  …
  // EVERYTHING ELSE: by reference, unfrozen, and this is the documented limit.
  onExotic();
  return v;
}
```

Then extend `D8` with `expect(captured[0]).toContain("[snapshot_exotic]")`. If reporting
every class instance is judged too noisy, that is a legitimate decision — but it has to be
written down *and* the two claims above have to be corrected, because they currently ship
a guarantee the code does not make.

---

### CR-03: `__proto__` is written through a plain computed assignment, dropping the key and injecting a prototype

**File:** `packages/concierge/src/bridge.ts:535` (clone) and `packages/concierge/src/bridge.ts:721, 723` (returned record)

**Issue:** `fields[key] = …` and `out[key] = …` are ordinary computed assignments against
objects that inherit `Object.prototype`. When `key` is `"__proto__"` the assignment invokes
the inherited `__proto__` *setter* instead of creating an own property. An own enumerable
`__proto__` key is exactly what `JSON.parse` produces — the canonical shape for
server-returned or user-submitted data reaching a snapshot. Measured:

```
D: source own keys = [ '__proto__', 'total' ]
D: clone own keys  = [ 'total' ]
D: clone prototype = { injected: true }
D: JSON of clone   = {"total":4180}
D: JSON of source  = {"__proto__":{"injected":true},"total":4180}
D: out.injected    = true  (leaked through prototype chain: true)
```

The `Object.create(null)` record the plain-object branch exists to support is affected
identically (`D2`), and `captureSnapshot`'s own container is too — a snapshot key named
`__proto__` disappears from the returned record and its value becomes the record's
prototype:

```
F2: returned own keys = [ 'ok' ] | proto = { evil: 1 } | res.evil = 1
```

Two consequences, both silent:

- **Data loss in the value Phase 8 hashes and drift-checks.** The captured snapshot no
  longer contains a field the app does contain, and both sides of a drift check lose it
  identically — so drift in that field can never be observed.
- **Inherited-property surface on a value documented as a structural clone.** `res.evil`
  reads `1` while `Object.keys(res)` reports nothing, so a reader that enumerates and a
  reader that dereferences disagree about the same object. The `catch` arm's
  `out[key] = undefined` is also a silent no-op for this key, defeating the "key present
  at `undefined`" contract at `:718-719`.

**Fix:** never write a computed key through `[]` on an object with `Object.prototype`.

```ts
// src/bridge.ts:530-538 — plain-object branch
const fields: Record<string, unknown> = {};
seen.set(obj, fields);
for (const key of Object.keys(obj)) {
  Object.defineProperty(fields, key, {
    value: cloneDetached((obj as Record<string, unknown>)[key], seen, onExotic),
    writable: true,
    enumerable: true,
    configurable: true,
  });
}
return Object.freeze(fields);
```

Apply the same `Object.defineProperty` spelling to both `out[key] = …` sites in
`captureSnapshot`. Add a case: a snapshot whose value is `JSON.parse('{"__proto__":{"x":1},"total":1}')`
must produce a clone with `Object.keys` of `["__proto__","total"]` and
`Object.getPrototypeOf(clone) === Object.prototype`.

---

## Warnings

### WR-01: An exotic warn suppresses the throwing-getter warn for the same key, and the key fails silently

**File:** `packages/concierge/src/bridge.ts:681-728`

**Issue:** The `warned` `Set` is shared by both codes, and the exotic path adds to it
first. When a key's value contains an undetachable value *and* a nested getter that
throws, only `[snapshot_exotic]` is emitted while the key lands at `undefined`. Measured:

```
G2: threw = null | out.mixed = undefined | warns = 1
G2: codes = [ '[snapshot_exotic] …' ]
```

`snapshotExoticMessage` (`:623`) explicitly argues the two codes must stay distinct
because *"one code covering both would send a developer looking at a getter that is
working perfectly."* This is the mirror of that failure: the getter is genuinely broken,
the key is genuinely absent, and the only diagnostic points at detachment. The comment at
`:678-680` records the shared latch as intentional ("keeps one key from emitting both
codes"), but the consequence — the *actionable* code being the one suppressed — is not.

**Fix:** latch per code rather than per key, and let the `catch` arm take precedence:

```ts
const warnedThrew: Set<string> = new Set<string>();
const warnedExotic: Set<string> = new Set<string>();
// … onExotic reads/writes warnedExotic; the catch reads/writes warnedThrew.
```

The failure is terminal for the key, so `[snapshot_threw]` must always be emitted when the
`catch` fires, whether or not an exotic value was seen on the way.

---

### WR-02: Snapshot getters are invoked with the receiver detached

**File:** `packages/concierge/src/bridge.ts:684, 721`

**Issue:** `const getter = bridge.snapshot[key]` followed by `getter()` calls with
`this === undefined`. `Bridge`'s `Snapshot extends Record<string, () => unknown>`
(`types.ts:1112`) accepts method shorthand, so `snapshot: { count() { return this.total; } }`
typechecks and then fails at runtime. Measured — the member reports `undefined` and the
developer is handed advice about a getter that is not the problem:

```
F3: count = undefined | warns: [snapshot_threw] snapshot "results.count": the getter threw…
```

The remediation text (`:610-612`, *"make the getter total — it runs on every capture, so
it must not assume any part of the component's state has loaded yet"*) sends the developer
looking for a load-order bug that does not exist.

**Fix:** preserve the receiver — `(getter as () => unknown).call(bridge.snapshot)`, folded
into CR-01's rewrite. Add a case with a method-shorthand snapshot member asserting the
value is captured rather than reported as a throw.

---

### WR-03: `offPageResult`'s truncation can emit a lone surrogate

**File:** `packages/concierge/src/bridge.ts:345`

**Issue:** `message.slice(0, MESSAGE_MAX_CHARS)` cuts at UTF-16 code units. `what` and
`where` are consumer-supplied prose that in a real product carries emoji or non-BMP
characters, and the boundary can land inside a surrogate pair. Measured:

```
G1: LONE HIGH SURROGATE at n = 179 | len = 180 | tail = "AAA\ud83d" | wellFormed = false
```

The result is an ill-formed string that is spoken or rendered to a human and serialized to
the model. `JSON.stringify` emits `\ud83d`, and `TextEncoder` substitutes U+FFFD — so the
bytes Phase 8 would hash are not the bytes anyone saw. The doc at `:327-331` states this
bound *is* the shared contract with Phase 6's SEC-06 truncation, so the defect propagates
by design if it is not fixed here.

**Fix:** trim back to a whole code point.

```ts
function boundedMessage(message: string): string {
  if (message.length <= MESSAGE_MAX_CHARS) {
    return message;
  }
  const cut: number = message.charCodeAt(MESSAGE_MAX_CHARS - 1) >= 0xd800
    && message.charCodeAt(MESSAGE_MAX_CHARS - 1) <= 0xdbff
    ? MESSAGE_MAX_CHARS - 1
    : MESSAGE_MAX_CHARS;
  return message.slice(0, cut);
}
```

Extend `D19` with `expect(result.message.isWellFormed()).toBe(true)` over a `what` ending
in a non-BMP character.

---

### WR-04: `Map` / `Set` / `Date` subclasses are silently downgraded, with no report

**File:** `packages/concierge/src/bridge.ts:470-513`

**Issue:** The branch tests `obj instanceof Map` and constructs `new Map()`, so a subclass
loses both its prototype and every own property it carries, with no `onExotic` call.
Measured:

```
F4: clone ctor = Map | lost .tag = undefined | lost subclass = true
```

This contradicts the rationale the same file uses at `:540-551` to justify the
pass-through branch: *"a lossy clone that drops a prototype is worse than an honest
reference."* The collection branches do exactly that, and unlike the pass-through branch
they do it without saying so.

**Fix:** either restrict the branches to exact instances and let subclasses fall through to
the reported pass-through, or keep cloning and call `onExotic()` when the prototype is not
the base:

```ts
if (Object.getPrototypeOf(obj) !== Map.prototype) {
  onExotic();
}
```

Add a `class Tagged extends Map` case asserting whichever behaviour is chosen.

---

### WR-05: `B8` and `B9` are byte-identical programs presented as two distinct orderings

**File:** `packages/concierge/test/bridge.test.ts:407-451`

**Issue:** After stripping comments the two case bodies are equal — verified
programmatically:

```
const registry = createBridge("results");
const A = named("A"); const B = named("B");
let u2;
withCapturedWarnings(() => {
  registry.register(A); u2 = registry.register(B); registry.register(A); u2();
});
expect(registry.read()).toBe(A);
```

`B8` labels it `O4` ("replace-then-restore"); `B9` labels it `O8` ("three registrations,
and the MIDDLE one unmounts last") and its narrative describes capturing `u1` and `u3`,
which the code does not do. Capturing an unsubscriber that is never invoked has no
observable effect, so `O4` and `O8` cannot be distinguished by these programs.

This matters by the file's own standard. The header at `:98-114` counts thirteen
orderings, and the arithmetic at `:37-42` (`13 − 4 = 9`) is the basis for the corrected
agreement figure. There are twelve distinct programs, so both the count and the derived
figure are unsupported by the file that asserts them — and a duplicated case "reads in a
diff and in a test report exactly like coverage", which is the Trap-2 failure this file
names.

**Fix:** either make `B9` a genuinely different ordering (e.g. `reg A(u1); reg B(u2); reg A(u3); u3(); u2()`,
which exercises a *live* cleanup followed by a stale one), or delete `B9` and correct every
count in the header to twelve. Do not leave both.

---

### WR-06: `test/bridge.test.ts` asserts a fact about the source that is already false

**File:** `packages/concierge/test/bridge.test.ts:37-42`

**Issue:** The header states:

> Recorded because the number moved: `src/bridge.ts`'s guard comment and `05-04-PLAN.md`
> both say "ten of thirteen". The re-measurement above says NINE … the source comment is
> one plan away from being corrected and this file does not modify source.

`src/bridge.ts:245` reads *"agrees with this one on nine of thirteen mount/unmount
orderings"*. Commit `934b53f` ("fix(05): correct the object-guard ordering count from ten
to nine") landed that correction, and this paragraph was not updated with it. A reader
following the instruction to go correct the source will find nothing to correct and will
reasonably conclude one of the two documents is untrustworthy — in a file whose stated
purpose is that the record and the code cannot drift apart silently.

**Fix:** replace the paragraph with a statement of the settled fact, e.g. *"`src/bridge.ts:245`
and this file both say nine; the earlier 'ten' in `05-04-PLAN.md` was corrected in
`934b53f`."* Note that the figure itself is contingent on WR-05.

---

## Info

### IN-01: `ConciergeConfig.normalizeSnapshot` is wired to nothing

**File:** `packages/concierge/src/types.ts:1653`, `packages/concierge/src/concierge.ts:354-768`

**Issue:** The field carries ~40 lines of doc describing the seam and the default, and no
code reads it. `createConcierge` never threads it into `captureSnapshot`, and
`captureSnapshot` only accepts a normalizer as its own third argument. The only way to
supply one today is to call `captureSnapshot` directly, which is not what the field's doc
describes.

**Fix:** Acceptable as a Phase 8 seam, but say so at the field: one sentence noting that
core reads this from Phase 8 onward and that `captureSnapshot`'s third parameter is the
only live route today. Otherwise a consumer sets it and gets no detachment.

---

### IN-02: The warn builders' "developer-authored" claim is unenforced, and neither value is escaped

**File:** `packages/concierge/src/bridge.ts:605-613, 623-631, 136-144`

**Issue:** `snapshotThrewMessage` states *"Interpolates `id` and `key` and nothing else.
Both are developer-authored strings already in the app's own source."* `key` comes from
`Object.keys(bridge.snapshot)`, which an app may build from data
(`Object.fromEntries(fields.map(f => [f.name, …]))`), and `id` is a free-form string a
consumer passes to `createBridge`. Neither is validated, and both reach `warnHost` →
`console.warn` unescaped, so a newline or ANSI sequence in either forges log lines on an
SSR host. The channel is developer-facing rather than model-facing, which is why this is
Info and not a leak finding — but the claim is stronger than what the code enforces.

**Fix:** soften the claim to what holds ("`id` and `key` originate in the app, not in core;
core does not sanitize them"), or strip C0/C1 from both before interpolation, which is a
two-line change and aligns with SEC-06's eventual rule.

---

### IN-03: `register(null)` is accepted and occupies the slot invisibly

**File:** `packages/concierge/src/bridge.ts:221-241`

**Issue:** `read()` is `slot?.bridge ?? null`, so registering `null` (or `undefined`) leaves
the slot occupied while `read()` reports exactly what an empty registry reports. Measured:
`read()` after `register(null)` is `null`. The next genuine `register()` then sees
`slot !== null` and emits the 340-character `bridge_overwrite` warning for a displacement
that lost nothing. TypeScript rejects the call; a JavaScript consumer — the population the
`redact` doc at `types.ts:884-888` names as the entire reason runtime rules exist — does
not get the same protection.

**Fix:** either ignore a non-object registration (return a no-op unsubscriber) or document
that the slot is unvalidated. A one-line `typeof bridge !== "object" || bridge === null`
guard is enough.

---

### IN-04: `Symbol.toStringTag` diverts a cloneable plain object into a collection branch

**File:** `packages/concierge/src/bridge.ts:468-513`

**Issue:** The `tag === "[object Date]"` / `"[object Map]"` / `"[object Set]"` arms are
reached by any object carrying a matching `Symbol.toStringTag`. Extraction then throws and
the value is handed back by reference. Measured: `{ secret: "live", [Symbol.toStringTag]: "Date" }`
comes back by reference with one `[snapshot_exotic]`. The union-of-predicates comment at
`:447-454` argues the two tests are blind in opposite directions and that the union covers
both; it does not note that the tag half is spoofable and turns a perfectly cloneable
object into a pass-through.

**Fix:** No behavioural change needed — it warns, so it is visible. Add a sentence to the
comment recording that the tag half is app-controllable and that the failure direction is
"pass through and report", which is safe.

---

### IN-05: A prototype-bearing `snapshot` holder captures as `{}` with no diagnostic

**File:** `packages/concierge/src/bridge.ts:683`

**Issue:** `Object.keys` returns own enumerable keys only, so a snapshot holder whose
members live on a class prototype yields zero keys and `captureSnapshot` returns `{}` with
no warning. Measured: `{ actions: {}, snapshot: new SnapHolder() }` captures `[]`.
`Bridge`'s `Snapshot extends Record<string, () => unknown>` admits such a holder.

**Fix:** Own-keys-only is the right rule (`:405-411` argues it for symbol keys, and the same
argument covers inherited framework members). Note the consequence in the doc comment so a
consumer who gets an empty capture has something to search for.

---

_Reviewed: 2026-07-31T23:07:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
