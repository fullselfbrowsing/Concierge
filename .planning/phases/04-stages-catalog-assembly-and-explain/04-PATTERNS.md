# Phase 4: Stages, catalog assembly, and explain() - Pattern Map

**Mapped:** 2026-07-30
**Files analyzed:** 13 (3 new, 10 modified — 1 of the modified is inferred rather than named by RESEARCH)
**Analogs found:** 13 / 13 have a usable in-repo analog for their *file shape*; **4 distinct mechanisms
inside `src/concierge.ts` have NO analog anywhere in `src/`** (see *No Analog Found*)

> **Read this first — two things.**
>
> **1. Where CONTEXT and RESEARCH disagree, CONTEXT wins.** `04-CONTEXT.md:58-85` carries an
> annotated in-place correction dated *after* `04-RESEARCH.md` was written, and RESEARCH's own
> prose still shows the pre-correction form in two places. The differences are load-bearing and
> are listed in *Corrections Carried Into This Phase* below. An executor who copies RESEARCH's
> `projectFor(id: string | null)` sketch verbatim ships the STG-01 defect RESEARCH itself
> measured in *Pitfall 7*.
>
> **2. `src/` has never held mutable state.** Verified by grep this session: `src/` contains
> **zero `Map`s**, **zero `??=`**, **zero instance-local closure state**, and **zero functions
> that return a function or an object of functions**. Every export in `src/` today is a pure
> function (`defineAction`, `buildCatalog`, `emitSchema`, `warnHost`, `assertSingleInstance`), a
> frozen constant, a class, or a type. `createConcierge` is the package's first factory and its
> first memo. Treat `catalog.ts` as the analog for *how a runtime module in this package is
> written* — header, imports, annotation discipline, message prose, freeze idiom — and do **not**
> stretch it into an analog for closures over mutable state or for guarded calls into consumer
> code that must not echo the caught error. *No Analog Found* says which is which.

## Corrections Carried Into This Phase

These are decided. They are listed here because an executor reading RESEARCH linearly will meet
the superseded form first.

| Claim | Superseded form (where it still appears) | Governing form | Consequence if the wrong one is copied |
|---|---|---|---|
| Memo key | `Map<string \| null, …>` keyed by resolved **stage id** — `04-RESEARCH.md:27`, `:48`, the Pattern 1 sketch at `:305-321`, the architecture diagram at `:192`, and mutant **M-04-7** | Keyed by the resolved stage's **array index**, `Map<number \| null, …>` — `04-CONTEXT.md:51-71` | Two stages sharing an `id` silently serve each other's catalogs. RESEARCH measured it (`Pitfall 7`, `:745-758`) and it is a direct STG-01 failure. |
| Duplicate stage id | *Open Question 4*, unresolved, three ranked remedies — `04-RESEARCH.md:1098-1105` | Index-keying **plus** a single `warnHost` warning at `createConcierge` time — `04-CONTEXT.md:66-71` | Both halves are required. Index-keying alone leaves the ambiguity invisible in `stageFor`/`explain`; the warning alone leaves the correctness bug. |
| Reason the memo is instance-local | "`sideEffects: false` deletes module-scope evaluation" — `04-RESEARCH.md:27` restates CONTEXT's original wording before correcting it at `:760-791` | **SSR cross-request state pollution.** The doc comment must state this and must not state the tree-shaking claim — `04-CONTEXT.md:72-85`, `04-RESEARCH.md:789-791` | The tree-shaking sentence does not reproduce under rolldown 1.2.0 and ships into `dist/index.d.ts`. That is the exact defect class 03-08 spent a plan removing. |
| Export surface baseline | "10 value exports, 42 type exports" — `04-CONTEXT.md:254` before its own annotation | **59 names / 49 types / 10 values.** Re-verified this session by running `export-surface.test.ts`'s own regex over `dist/index.d.ts`: `blocks 1 names 59 values 10 types 49` | Planning against 42 fails `pnpm test export-surface` on the first run. |
| `dispatch` stub | *Open Question 1*, escalate — `04-RESEARCH.md:1078-1083` | `{ ok: false, message }` with **`reason` omitted** — `04-CONTEXT.md:152-161` | Settled. Do not add `not_implemented` to `ReasonCode`. |
| `EmittedTool` mutability | *Open Question 5*, escalate — `04-RESEARCH.md:1107-1112` | Fields become `readonly`, in the same commit as `Concierge.explain` — `04-CONTEXT.md:163-170` | Settled. |

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW** `packages/concierge/src/concierge.ts` | core module (factory over instance-local state) | transform + memoized projection | `src/catalog.ts` (module discipline) + `src/define-action.ts` (size, return annotation) + `src/json-schema.ts:384-398` (guarded consumer call) | role-match; **4 mechanisms new** |
| **MOD** `packages/concierge/src/catalog.ts` | core module (validation service) | batch (N declarations → 1 aggregated throw) | itself (`:733-843`) | **exact (self)** |
| **MOD** `packages/concierge/src/types.ts` | type contract | n/a | itself (`:1294-1328`, `:1497-1511`) | **exact (self)** |
| **MOD** `packages/concierge/src/index.ts` | barrel / config | re-export | itself (`:27-111`) | **exact (self)** |
| **MOD** `packages/concierge/src/contract.ts` | core module (doc comment only) | n/a | itself (`:140-147`) | **exact (self)** |
| **NEW** `packages/concierge/test/concierge.test.ts` | test (runtime, Vitest) | request-response + batch | `packages/concierge/test/catalog.test.ts` | **exact** |
| **NEW** `packages/concierge/test-d/concierge.test-d.ts` | test (type-level) | compile-time predicate | `test-d/catalog.test-d.ts` + `test-d/consent-variance.test-d.ts` | **exact** |
| **MOD** `packages/concierge/test/catalog.test.ts` | test (runtime) | batch | itself (`:224-307`) | **exact (self)** |
| **MOD** `packages/concierge/test/export-surface.test.ts` | test (runtime) | file-I/O | itself (`:106-149`) | **exact (self)** |
| **MOD** `packages/concierge/test/single-instance.test.ts` | test (runtime) | dynamic import | itself (`:195-221`) | **exact (self)** |
| **MOD** `packages/concierge/test-d/catalog.test-d.ts` | test (type-level) | compile-time predicate | itself (`:284`, `:297-301`) | **exact (self)** |
| **MOD** `packages/concierge/test-d/exports.test-d.ts` | test (type-level) | compile-time predicate | itself (`:51-94`) | **exact (self)** |
| **MOD** `packages/concierge/test/artifact.test.ts` *(inferred — not in RESEARCH's test map; planner should confirm or record why not)* | test (runtime) | dynamic import | itself (`:107-127`) | **exact (self)** |

---

## Pattern Assignments — `src/`

### `packages/concierge/src/concierge.ts` (core module, transform + memoized projection) — NEW

**Analog:** `packages/concierge/src/catalog.ts` for module discipline; `src/define-action.ts` for the
size and the `isolatedDeclarations` return annotation; `src/json-schema.ts:384-398` for the guarded
call into code core did not author; `src/host.ts:93-96` for the warning seam.

RESEARCH recommends this as a new file rather than folding into `catalog.ts`, on one measured
ground: `catalog.ts` is 865 lines and its own header states *"Every rule lives here, so 'did we
check X?' is a one-file question"* (`catalog.ts:7-9`). Stage resolution is not a catalog rule.
CONTEXT grants the layout as discretion; RESEARCH's recommendation is the one to take.

**File-header convention** (`catalog.ts:1-57`). Every `src/` file opens with a block comment that
states *the constraints whose violation is silent*, numbered, each with the measurement behind it —
then closes with the standing no-DOM paragraph. Copy the shape, not the words:

```typescript
// packages/concierge/src/catalog.ts:1-11, :13-33, :53-57 (abridged, three separate regions)
/**
 * The catalog — one function that validates every declaration, aggregates every
 * problem into a single throw, reports the two non-blocking warning markers, and
 * freezes what it built (CAT-01, CAT-02, CAT-05, CAT-06, SEC-01, SEC-03, SEC-05,
 * DX-03, PKG-04).
 *
 * ---------------------------------------------------------------------------
 * Three constraints whose violation is SILENT
 * ---------------------------------------------------------------------------
 *
 * **2. The freeze is recursive, and the shallow form is not a weaker version of
 * it — it is a breach that reports success.** Measured in ESM strict mode: with
 * the entries array frozen and the entries themselves not,
 * `catalog[0].handler = attackerFn` **did not throw** and the replacement
 * handler then ran, while `Object.isFrozen(catalog)` still reported `true`.
 *
 * Like `./types.ts`, `./contract.ts`, `./json-schema.ts` and `./host.ts`, this
 * file has no runtime dependency, no framework reference and no DOM access — it
 * must construct on a server under Next App Router, Nuxt or SvelteKit without
 * guards.
 */
```

The three constraints worth putting in that slot for `concierge.ts`, all named by CONTEXT/RESEARCH:

1. **The memo is instance-local and lazily allocated, and the reason is SSR cross-request pollution
   — not tree-shaking.** `04-RESEARCH.md:760-791` measured the tree-shaking claim and it does not
   reproduce. `.planning/research/ARCHITECTURE.md:380-405` is the citation that is true.
2. **The shallow `Object.freeze` on a projection is complete only because the elements are shared
   and already deep-frozen.** Building fresh `EmittedTool` objects per projection turns the shallow
   freeze into `catalog.ts:513-521`'s breach-that-reports-success. The two decisions are coupled.
3. **`stage.match` is called from exactly one place.** Each additional call site is a second copy
   of the throw policy, the non-boolean policy and the warn-once latch, and a second place for
   `explain` and `stageFor` to disagree.

**Section-divider convention** (`catalog.ts:65-67`, `:118-120`, `:154-156`, `:216-218`, `:300-302`,
`:593-595`) — identical rule in `contract.ts:101-103`, `host.ts:59-61`, `define-action.ts:39-41`:

```typescript
// ---------------------------------------------------------------------------
// Issues — the build-failing channel
// ---------------------------------------------------------------------------
```

**Import discipline** (`catalog.ts:59-63`). Value imports first, then `import type`, all with the
`.js` extension on a `.ts` source path. `verbatimModuleSyntax` is on, so a type-only import must say
`import type`:

```typescript
// packages/concierge/src/catalog.ts:59-63
import { assertSingleInstance } from "./contract.js";
import { warnHost } from "./host.js";
import { JSON_SCHEMA_TARGET, emitSchema, vendorOf } from "./json-schema.js";
import type { JsonSchemaTarget, SchemaEmission } from "./json-schema.js";
import type { AnyActionDefinition, JsonSchemaObject } from "./types.js";
```

`concierge.ts` needs: `import { buildCatalog, deepFreeze } from "./catalog.js";`,
`import { warnHost } from "./host.js";`, and `import type { … } from "./types.js";`. It must **not**
import `assertSingleInstance` — see the *doc-comment correction* note under `src/contract.ts` below.

**Explicit local annotations on every `const`** (`catalog.ts:724-731`). This is not optional style;
`isolatedDeclarations` is on and the house rule is that every local gets an annotation even where
inference would do (stated at `03-PATTERNS.md` and visible everywhere in `src/`):

```typescript
// packages/concierge/src/catalog.ts:724-731
  const target: JsonSchemaTarget = options?.jsonSchemaTarget ?? JSON_SCHEMA_TARGET;

  const issues: CatalogIssue[] = [];
  const diagnostics: CatalogDiagnostic[] = [];
  const seenNames: Set<string> = new Set<string>();
  const entries: CatalogEntry[] = [];
  const names: string[] = [];
  const validators: Set<object> = new Set<object>();
```

**The `isolatedDeclarations` return annotation** (`define-action.ts:220-233`). `createConcierge`
needs an explicit `: Concierge`; an unannotated `export const createConcierge = (config) => …` is
TS9010:

```typescript
// packages/concierge/src/define-action.ts:220-233
export function defineAction<
  N extends string,
  D extends string,
  S extends StandardSchemaV1,
  B = unknown,
  Snap = unknown,
  Ack = unknown,
>(
  def: Omit<ActionDefinition<N, S, B, Snap, Ack>, "description"> & {
    description: LiteralDescription<N, D>;
  },
): ActionDefinition<N, S, B, Snap, Ack> {
  return def as ActionDefinition<N, S, B, Snap, Ack>;
}
```

The same rule reaches `explain`'s return type: it must be a **named exported interface in
`types.ts`** (`Explanation`), never an inline anonymous object on the `Concierge` member.

**The guarded call into code core did not author** (`json-schema.ts:384-398`) — the closest thing in
the repo to `runMatch`, and the shape to copy for the `try`:

```typescript
// packages/concierge/src/json-schema.ts:384-398
  let derived: PropertyBag;
  try {
    derived = schema["~standard"].jsonSchema.input({ target });
  } catch (cause) {
    return {
      ok: false,
      reason: "threw",
      vendor,
      detail:
        `action "${action.name}": its validator "${vendor}" threw while ` +
        `emitting JSON Schema for target "${target}" ` +
        `(${describeCause(cause)}). Supply an explicit \`jsonSchema\` on the ` +
        `action, or remove the transform from the schema.`,
    };
  }
```

> ⚠️ **Copy the structure, invert one decision.** `emitSchema` *does* echo the caught value, through
> `describeCause` (`json-schema.ts:230-245`). That is legitimate there because it is a **build-time
> developer diagnostic**, and `json-schema.ts:259-261` states the exemption explicitly. `runMatch`
> is the opposite case: it fires at **runtime, on every navigation, in a shipped app**. RESEARCH's
> Security Domain table (`04-RESEARCH.md:1287`) requires the matcher warning to carry **only the
> stage id and fixed prose** — never the caught error's `message`, which would echo whatever the
> app's matcher put in it. So the `catch` binding is `catch {` with no parameter, exactly as
> `describeCause` itself does at `json-schema.ts:242`. Write that reason into the doc comment; a
> later reader comparing the two `try` blocks will otherwise "fix" the inconsistency.

**Reading a value core did not author** (`catalog.ts:304-311`, `:386-389`). Two carried conventions:
the view type is **module-private, not exported**, and the read is `Object.hasOwn`, never `in`:

```typescript
// packages/concierge/src/catalog.ts:304-311
/**
 * A value core did not author, viewed as an untyped bag of own properties.
 *
 * Mirrors `PropertyBag` in `./json-schema.ts` for the same reason: the declared
 * types describe what a *TypeScript* consumer can express, and every rule below
 * has to survive a JavaScript consumer who expressed something else.
 */
type PropertyBag = Record<string, unknown>;
```

```typescript
// packages/concierge/src/catalog.ts:386-389
function declaredRedaction(action: AnyActionDefinition): unknown {
  const view: PropertyBag = action as unknown as PropertyBag;
  return Object.hasOwn(view, "redact") ? view["redact"] : undefined;
}
```

**The warning seam** (`host.ts:93-96`) and its one existing caller (`catalog.ts:506-511`). `console`
is TS2304 under `lib: ["ES2022"]`; `warnHost` is the only sanctioned route:

```typescript
// packages/concierge/src/host.ts:93-96
export function warnHost(message: string): void {
  const host: { console?: ConsoleLike } = globalThis as { console?: ConsoleLike };
  host.console?.warn(message);
}
```

```typescript
// packages/concierge/src/catalog.ts:506-511
function defaultDiagnosticSink(diagnostic: CatalogDiagnostic): void {
  warnHost(
    `concierge: [${diagnostic.code}] action "${diagnostic.action}": ` +
      `${diagnostic.problem} Fix: ${diagnostic.fix}`,
  );
}
```

The `concierge: ` prefix, the quoted identifier, and *what + Fix:* in one string are the house
message shape. Both new warnings in this phase — the throwing/non-boolean matcher, and the duplicate
stage id — take it, substituting the stage id for the action name.

**Warn-once granularity** is settled by precedent, not by preference. `CatalogDiagnostic`'s doc
comment (`catalog.ts:142-146`) is the governing sentence and should be cited rather than
re-derived:

```typescript
// packages/concierge/src/catalog.ts:142-146
 * **One diagnostic per offending action, each naming its action.** An
 * aggregated summary line ("3 destructive actions carry no consent policy")
 * loses exactly the name DX-03 requires and forces the developer back into the
 * source to find which three.
```

Applied here: **once per stage id per `Concierge` instance**, not once per instance. Two broken
matchers produce two warnings. The latch `Set` is instance-local and lazily allocated for the same
SSR reason as the memo.

**The frozen null-prototype record** (`catalog.ts:851-864`) — `toolByName` is the second instance of
this exact structure, and `Catalog.byName`'s doc comment (`catalog.ts:240-268`) is the argument to
cite rather than restate:

```typescript
// packages/concierge/src/catalog.ts:851-864
  const byName: Record<string, CatalogEntry> = Object.create(null);
  for (const entry of entries) {
    byName[entry.action.name] = entry;
  }

  type Name = A[number]["name"];
  const catalog: Catalog<Name> = {
    entries,
    names: names as readonly Name[],
    byName: byName as Readonly<Record<Name, CatalogEntry>>,
    diagnostics,
  };

  return deepFreeze(catalog, validators, new WeakSet<object>());
```

Note the two properties `catalog.ts:245-258` establishes and `test/catalog.test.ts:640-668` (C19,
C20) proves: a frozen `Map` is **not** frozen, and `Object.create(null)` makes `__proto__` and
`constructor` ordinary absent keys. `toolByName` needs both, measured at `04-RESEARCH.md:431-438`.

> **The memo is the exception, and the exception is already documented.** `catalog.ts:260-268`
> states it: *"A `Map` remains correct for Phase 6's own **mutable** per-dispatch state … and is
> wrong for anything that must be frozen."* The memo is never frozen and is not part of the catalog,
> so `Map` is right there — and RESEARCH measured the concrete reason (`04-RESEARCH.md:324-332`):
> a record cannot hold the no-stage key, every sentinel is a legal stage id, and `String(null)`
> collides with a stage literally named `"null"`. Under the index-keyed correction the key is
> `number | null`, which a record cannot hold either. Cite `catalog.ts:260-268`; do not re-argue it.

**The freeze idiom, and the one place this phase departs from it.** `deepFreeze`
(`catalog.ts:566-591`) is what `explain()` uses. The **projection** uses a plain shallow
`Object.freeze`, and `deepFreeze`'s own doc comment carries both halves of why:

```typescript
// packages/concierge/src/catalog.ts:539-546
 * **Do NOT add the `Object.isFrozen(value) → return` early-out** that
 * `03-RESEARCH.md` sketches. Measured this phase: it skips the *children* of an
 * already-frozen object … `seen` is what makes the recursion terminate;
 * frozenness is not a proxy for "already walked".
```

```typescript
// packages/concierge/src/catalog.ts:554-558
 * **Hand-forward to Phase 4:** `frozenArray.filter(...)` returns a **new,
 * unfrozen** array — measured, `Object.isFrozen` is `false` on the result. So
 * `catalogFor`'s stage-scoped result is NOT frozen just because the catalog it
 * filtered was, and it must be re-frozen. This is written here rather than only
 * in a summary because Phase 4 reads this source.
```

The no-early-out is exactly why `deepFreeze` per projection measured 510× slower
(`04-RESEARCH.md:362-369`) — it re-walks every already-frozen JSON Schema subtree every time.

**`deepFreeze` must gain `export`** (`catalog.ts:566`). Module-internal only: it must **not** be
re-exported from `src/index.ts`. `test/export-surface.test.ts:56-59` parses only the trailing bare
`export { … };` block of `dist/index.d.ts`, so a symbol that is exported from `catalog.ts` but not
re-exported from `index.ts` cannot reach the count. RESEARCH's *Open Question 6* settles this in
favour of exporting rather than hand-rolling a six-line freeze, on the same *Don't Hand-Roll*
grounds `deepFreeze`'s own doc comment lists (cycle-safe `WeakSet`, accessor skip that does not
invoke getters, refusal to early-out).

**The doc comment that records a rejected alternative** — the house register, and the shape every
non-obvious decision in this file needs. Three examples at three lengths:

```typescript
// packages/concierge/src/catalog.ts:189-193 — one paragraph, one alternative
 * **`AggregateError` was available and was rejected.** It is type-visible under
 * `lib: ["ES2022"]` (measured), but its `errors` member holds `Error` objects,
 * so every `{code, action, vendor, problem, fix}` would have to be flattened
 * back into a string and re-parsed by anyone who wanted the structure. That is
 * the opposite of the point.
```

```typescript
// packages/concierge/src/catalog.ts:693-698 — a disagreement recorded so it can be had directly
 * A reviewer who reads the scope clause differently — as decoration on a
 * universal requirement, making *every* missing `redact` a build failure — would
 * ship a stricter rule. That reading is defensible; it is rejected only because
 * it makes the "defaults to `drop`" clause dead text. The disagreement is stated
 * here so it can be had directly rather than reverse-engineered from behaviour.
```

```typescript
// packages/concierge/src/define-action.ts:212-218 — a rejected extension, with its measurement
 * **Rejected alternative: guarding `buildCatalog` as well.** It would close the
 * remaining bypass — a raw object literal assembled without this function — but it
 * was measured to false-positive on every `defineAction` result … `defineAction` alone is
 * the decision; the raw-literal path stays reachable and stays unguarded.
```

Non-obvious decisions in `concierge.ts` that each need one of these: the index-keyed memo (rejected:
id-keyed, and *why* — the measured collapse); `Map` over record (rejected: sentinel key); shallow
projection freeze (rejected: `deepFreeze` per projection, with the 510× number); `=== true` over
truthiness (rejected: silent strict check, and permissive truthy check — `04-RESEARCH.md:463-469`);
`explain` running every matcher (rejected: short-circuiting, `04-RESEARCH.md:588`); the `dispatch`
stub omitting `reason` (rejected: `not_implemented` on a closed union); **and the CAT-01 name-union
erasure stopping at the config boundary** (`04-RESEARCH.md:728-743`, *Pitfall 6*) — that one exists
purely so the next reader does not burn a wave re-deriving it, together with the measured note that
`createConcierge<const C extends ConciergeConfig>` *would* recover it and is deliberately not taken
(*Open Question 2*, `04-RESEARCH.md:1085-1089`).

**`explain()`'s doc comment has one mandatory sentence.** RESEARCH states it twice
(`04-RESEARCH.md:34`, `:657`) and CONTEXT locks it (`04-CONTEXT.md:112-115`): the returned object is
**deliberately not identity-stable**, in those words, so nobody wires `explain()` into
`useSyncExternalStore` and reproduces the exact defect STG-04 exists to prevent. `Concierge`'s
existing member doc comment is the register to match:

```typescript
// packages/concierge/src/types.ts:1503-1509
  /**
   * Catalog for the stage matching `ctx`.
   *
   * Returns a memoized frozen array — a fresh array per call makes React's
   * `useSyncExternalStore` loop forever once devtools subscribe.
   */
  catalogFor: (ctx: StageContext) => ReadonlyArray<EmittedTool>;
```

**Mutant-uniqueness constraints this file's *shape* must honour.** RESEARCH's battery
(`04-RESEARCH.md:1239-1254`) assumes single-occurrence literals. Two are already known to conflict
with the recommended implementation and must be designed around, not discovered:

| Mutant | Literal | Problem | Requirement on the source |
|---|---|---|---|
| **M-04-1** | `Object.freeze(` | The recommended shape uses it **three times** (each `EmittedTool`, `toolByName`, each projection). Verified: `src/catalog.ts` has exactly **1** today, so the trap is new to this file. | Use the whole `return`/assignment statement as the literal, not the bare call. |
| **M-04-4** | `for (const stage of stages)` | `stageFor` and `explain` both iterate the stages. Identical spellings make the literal non-unique. | **Distinct loop spellings in `stageFor` and `explain`** — RESEARCH names this as a design constraint the implementation must honour and notes it belongs in the test file. |

Verified unfiltered counts in `src/catalog.ts` this session, for the CAT-03 mutants:
`seenNames.add(action.name);` → **1**; `if (issues.length > 0) {` → **1**; `Object.freeze(` → **1**;
`deepFreeze(` → **2** (definition + call — trap); `duplicate_action_name` → **2** (trap);
`action.consent` → **2** (trap). Re-take every count at implementation time; RESEARCH says so
(`04-RESEARCH.md:1336`) and the file is about to change.

---

### `packages/concierge/src/catalog.ts` (core module, batch) — MODIFIED

**Analog:** itself. Four edits, three of them mechanical.

**1. Two new union members** (`catalog.ts:82-86`). A widening of an already-exported type; it adds
**no** name to the export surface:

```typescript
// packages/concierge/src/catalog.ts:82-86 (current)
export type CatalogIssueCode =
  | "duplicate_action_name"
  | "schema_not_emittable"
  | "schema_root_not_object"
  | "redaction_missing";
```

The doc comment above it (`catalog.ts:69-81`) already states the contract these join — *"Stable
strings, distinct per rule. A consumer filtering on one of these is doing something reasonable, so
these are part of the public contract and are not renamed casually"* — and it also carries the
precedent for *why* `consent_self_reference` is a second code rather than a reuse: it explains that
`not_emittable` and `threw` were deliberately **collapsed** into one code because *"from the
declaring developer's side the two have the same fix"*. CONTEXT's justification for the split
(`04-CONTEXT.md:139-142`) is that same test applied and answered the other way — the `fix` prose is
completely different. Cite the existing comment; do not invent a new argument.

**2. The post-pass placement** (`catalog.ts:733-744` and `:841-843`). The exact insertion points:

```typescript
// packages/concierge/src/catalog.ts:733-744 — the loop head and the name-set builder
  for (const action of actions) {
    // CAT-01 — a duplicate name makes the agent's address space ambiguous.
    if (seenNames.has(action.name)) {
      issues.push({
        code: "duplicate_action_name",
        action: action.name,
        problem: "two actions share this name, so an agent calling it cannot address either one unambiguously.",
        fix: "rename one of them.",
      });
      continue;
    }
    seenNames.add(action.name);          // ← `declared.push(action);` goes immediately after
```

```typescript
// packages/concierge/src/catalog.ts:841-843 — the throw the post-pass must precede
  if (issues.length > 0) {
    throw new CatalogValidationError(issues);
  }
```

RESEARCH measured both placements over seven scenarios (`04-RESEARCH.md:527-543`). Rows 1 and 7 are
the decisive ones and both are **false positives** under the in-loop form: a forward reference and a
`requires` naming a cross-stage action. Since this phase feeds `buildCatalog`
`[...allStageActions, ...crossStage]`, the in-loop form fails *every* build whose consent policy
points at a cross-stage action. Row 4 is quieter: in-loop, `seenNames.add` has already run, so
`seenNames.has(requires)` is `true` for a self-reference and `consent_self_reference` is
unreachable.

**3. The issue-push shape.** Copy `catalog.ts:736-741` (above) or `:779-784` verbatim in structure —
`{code, action, problem, fix}`, `problem` a lowercase fragment continuing *`action "name": `*, `fix`
an imperative sentence:

```typescript
// packages/concierge/src/catalog.ts:779-784
      issues.push({
        code: "redaction_missing",
        action: action.name,
        problem: "its schema accepts arguments but it declares no `redact` policy, so nothing states whether those arguments may reach telemetry.",
        fix: 'add `redact: "drop"` to the declaration, or a projection function if some arguments are safe to record.',
      });
```

Note the register: `problem` states the consequence (*"so nothing states whether…"*), not just the
condition. RESEARCH's drafted prose for both new codes (`04-RESEARCH.md:918-938`) already matches
this and includes the consequence clause (*"so the gate can never arm and the action is permanently
blocked"*). The formatter that consumes these is `formatIssues` (`catalog.ts:168-179`) — it prints
`  [{code}] action "{action}": {problem} Fix: {fix}` — so a `problem` beginning with a capital or
repeating the action name reads doubled. `withoutActionPrefix` (`catalog.ts:469-496`) exists
because that doubling actually shipped once; do not reintroduce it.

**4. Recording the residual, in the established paragraph style.** RESEARCH *Open Question 3*
recommends skipping a non-string `consent.requires` silently and writing the residual into the doc
comment. The exact style precedent is `catalog.ts:348-359`, which is also the model for how a
correction gets annotated rather than rewritten:

```typescript
// packages/concierge/src/catalog.ts:348-359
 * **Residual, deliberately not closed here — and narrower than first recorded.**
 * An `actions` array containing `null` or `undefined` throws a raw `TypeError` on
 * the `action.name` read before any rule runs. A structured issue needs an action
 * *name* to report, and that shape has none; inventing a sentinel would pollute
 * the `action` field that DX-03 tests assert on.
 *
 * This paragraph previously also claimed a **string** element throws. Measured at
 * phase close: it does not. `"x".name` is `undefined` rather than a throw, so a
 * string — and a number — reach the rules and produce a proper structured error.
 * Only `null` and `undefined` escape as a raw `TypeError`. The correction narrows
 * the documented exception to DX-03's "every build-time error names the action";
 * it does not widen it.
```

**5. Two stale-prose sites this phase creates.** Both ship inside `dist/index.d.ts`:

| Site | Current text | Why it goes stale |
|---|---|---|
| `catalog.ts:554-558` | "**Hand-forward to Phase 4:** … it must be re-frozen. This is written here rather than only in a summary because Phase 4 reads this source." | Phase 4 is landing. The measurement stays true and must stay; the *hand-forward framing* becomes false. Rewrite as a statement of what `concierge.ts` now does, keeping the measurement. |
| `catalog.ts:487-491` | "**Phase 4 note.** The structural repair is to split `SchemaEmission` into `{diagnosis, remedy}` … this plan's `files_modified` does not include it." | Phase 4 is here and is deliberately *not* doing it (`04-CONTEXT.md:318` defers it). The note must say which phase now owns it, or it reads as unowned. |

**6. Optional, cheap, recommended** (`04-RESEARCH.md:963-969`, option 2). Enrich
`duplicate_action_name`'s fixed `fix` prose to state that an action name is global across every
stage and across `crossStage`. Zero new surface, still exact-matchable in a test because the string
is a constant, and it converts the one genuinely surprising consequence of this phase — that stage
scoping does **not** namespace the name — from tribal knowledge into the error message. Option 3
(a `stage?` field on `CatalogIssue`) is **rejected for Phase 4** and recorded so a later phase can
adopt it without re-deriving the design.

> ⚠️ If this string changes, check `test/catalog.test.ts` C4 (`:250-255`) — it asserts
> `error.issues.map(i => i.code)` positionally, not the `fix` text, so it is unaffected. Verified:
> none of C4's five declarations carries a `consent` policy, so the CAT-03 post-pass appends nothing
> and the array is unchanged.

---

### `packages/concierge/src/types.ts` (type contract) — MODIFIED

**Analog:** itself. Four edits.

**1. `EmittedTool` fields become `readonly`** (`types.ts:1323-1328`):

```typescript
// packages/concierge/src/types.ts:1323-1328 (current)
export interface EmittedTool {
  type: "function";
  name: string;
  description: string;
  parameters: JsonSchemaObject;
}
```

The argument to cite is three lines above it, and it is directly on point — `Transport.capabilities`
records that a `readonly` which does not go all the way down is **worse than none**:

```typescript
// packages/concierge/src/types.ts:1299-1311
  /**
   * What this transport can honestly promise. See {@link TransportCapabilities}.
   *
   * **This `readonly` is now genuinely protective, and it was not before.** A
   * `readonly` property stops the *reference* being rebound and says nothing about
   * the members it points at, so while `TransportCapabilities` was writable this
   * modifier read as protection while `t.capabilities.consentGrade = "attested"`
   * compiled cleanly — worse than no modifier, because a reader stopped looking.
   * The two levels must stay in step: dropping `readonly` from any member of
   * `TransportCapabilities` restores the misleading state rather than merely
   * loosening this one.
   */
  readonly capabilities: TransportCapabilities;
```

`Transport.setTools(tools: ReadonlyArray<EmittedTool>)` at `types.ts:1313` is the exact parallel:
`ReadonlyArray` protects the array and says nothing about the elements, so
`catalogFor(ctx)[0].name = "evil"` typechecks today (measured, `04-RESEARCH.md:821-823`). Nothing
constructs an `EmittedTool` yet, so tightening is free now and breaking after Phase 7.

**2. `Concierge.explain`** (`types.ts:1497-1511`). The insertion point and the member-comment
register:

```typescript
// packages/concierge/src/types.ts:1497-1511 (current, complete)
export interface Concierge {
  /**
   * NOT `async`. An async wrapper allocates a fresh Promise per invocation,
   * which breaks deduplication by reference identity.
   */
  dispatch: (name: string, args: unknown, meta?: InvocationMeta) => Promise<ActionResult>;
  /**
   * Catalog for the stage matching `ctx`.
   *
   * Returns a memoized frozen array — a fresh array per call makes React's
   * `useSyncExternalStore` loop forever once devtools subscribe.
   */
  catalogFor: (ctx: StageContext) => ReadonlyArray<EmittedTool>;
  stageFor: (ctx: StageContext) => string | null;
}
```

Two constraints on the addition. `isolatedDeclarations` forces `Explanation` to be a **named
exported interface**, not an inline object type. And `Session.stage()` (`types.ts:1534-1536`)
already pins the vocabulary — *"Returns `string | null`, matching {@link Concierge.stageFor}
exactly. … two different spellings of 'no stage' would be a defect waiting to be written."* So
`Explanation.stage` is `string | null` and nothing else.

**3. `Explanation` / `StageExplanation`.** Declared in `types.ts` (RESEARCH's *Export Surface
Impact* table, `04-RESEARCH.md:1009-1014`). Three fields, locked by CONTEXT
(`04-CONTEXT.md:102-110`): `{ stage, stages: [{ id, matched, bridge }], catalog }`. The `bridge`
field's shape is `{ readonly id: string; readonly registered: boolean } | null`, chosen because both
`id` and `read()` are on the declared interface **today**, so Phase 5 changes nothing here:

```typescript
// packages/concierge/src/types.ts:1114-1124 — the seam Phase 4 reads and does not implement
export interface BridgeRegistry<B extends Bridge = Bridge> {
  readonly id: string;
  /** `null` when no component has registered. Handlers treat this as off-page. */
  read: () => B | null;
  /**
   * Returns an identity-guarded unsubscriber: it removes the entry only if the
   * registration is still the one it created. React StrictMode double-mount,
   * Vue HMR, and Svelte remount all produce stale cleanups otherwise.
   */
  register: (bridge: B) => () => void;
}
```

The rejected alternatives are worth recording on the field per house style: `bridge: string | null`
loses `registered` and must widen in Phase 5; a `"unknown"` third state invents a value that stops
being reachable the moment Phase 5 lands and would then be dead prose in a shipped `.d.ts`.

**4. The inline-`defineAction` spelling note** goes on `ConciergeConfig.stages` and `.crossStage`
(`types.ts:1396-1431`). That doc comment is already the longest argument in the file and already
carries the D-07 erasure measurement; the new paragraph is additive. It must show the **required
spelling** — declare each action as its own `const` first, then reference it — because the natural
inline spelling silently loses the `name` literal. `test-d/catalog.test-d.ts:234-284` holds the
measurement and the pinned-red predicate; the doc comment should point at it rather than restate it.

Note that `stages`'s existing first paragraph is also the STG-02 argument and must not be disturbed:

```typescript
// packages/concierge/src/types.ts:1396-1401
  /**
   * Ordered — first match wins.
   *
   * An array rather than a keyed object because object key iteration puts
   * integer-like keys first, which would make match order depend on whether a
   * stage happened to be named `"2"`.
   */
```

RESEARCH's measured key-ordering table (`04-RESEARCH.md:477-483`) is the evidence behind that
sentence and belongs in the **test file's** header, not here — the doc comment is already correct.

**5. `StageContext` is unchanged** (`types.ts:1131-1134`) and STG-03 is already satisfied by it:

```typescript
// packages/concierge/src/types.ts:1130-1134
/** Whatever the app knows about where the user is. Not limited to a URL. */
export interface StageContext {
  pathname?: string;
  [key: string]: unknown;
}
```

---

### `packages/concierge/src/index.ts` (barrel, re-export) — MODIFIED

**Analog:** itself. Three edits, and the export-surface pins move in the same commit.

**Type exports.** `Explanation` and `StageExplanation` are declared in `types.ts`, so they join the
**first** block — not a new one — under the existing `// Concierge` category comment:

```typescript
// packages/concierge/src/index.ts:71-78
  EmittedTool,
  // Concierge
  Scheduler,
  Concierge,
  ConciergeConfig,
  Session,
  SessionConfig,
} from "./types.js";
```

**Value export.** One statement per source module (`index.ts:105-111`), so `concierge.ts` gets its
own line:

```typescript
// packages/concierge/src/index.ts:105-111
export { CONTRACT_VERSION, assertSingleInstance } from "./contract.js";

export { JSON_SCHEMA_TARGET } from "./json-schema.js";

export { buildCatalog, CatalogValidationError } from "./catalog.js";

export { defineAction } from "./define-action.js";
```

**`deepFreeze` must NOT appear here.** It is a module-internal export only.

**The module doc comment** (`index.ts:1-25`). Two paragraphs go false this phase, and CONTEXT names
both (`04-CONTEXT.md:148-150`, `04-RESEARCH.md:1042-1046`):

```typescript
// packages/concierge/src/index.ts:16-24
 * Stated plainly so this is not oversold: `buildCatalog` *builds* a catalog and
 * nothing here dispatches from it yet. There is no session, no transport and no
 * consent prompt in this package today. What you get is a validated, frozen
 * description of what an agent would be permitted to do — not the thing that
 * lets it do so.
 *
 * The rest of the runtime (`createConcierge`, `createSession`, `defineStage`,
 * `createBridge`) is still being implemented against these types — see the
 * roadmap in the repository README.
```

Line 22 lists `createConcierge` as unimplemented — it ships this phase — and lists `defineStage`,
which is now **not going to ship at all** (locked, `04-CONTEXT.md:145-150`); listing it as pending
is a promise the project has decided not to keep. The `:16-20` paragraph is still true about
dispatch/session/transport but now *under*-sells: stage scoping and `explain()` ship. RESEARCH is
explicit that this needs *"an honest rewrite, not a deletion — the 'not oversold' posture is the
point."*

---

### `packages/concierge/src/contract.ts` (doc comment only) — MODIFIED

**Analog:** itself. One paragraph, and it ships — verified at `dist/index.d.ts:1837`:

```typescript
// packages/concierge/src/contract.ts:140-147
 * **`buildCatalog` in `./catalog.ts` is the first production call site**, added
 * in Phase 3, and it calls this on its first line. That is the earliest entry
 * point every consumer necessarily reaches — there is no way to use this package
 * without building a catalog — so it is the one place a single call covers every
 * app. Phase 2 shipped this guard with no production call site at all; the
 * instruction above is therefore satisfied rather than aspirational, though the
 * `createConcierge` and adapter-registration call sites it also names remain
 * future work and should be added when those arrive.
```

`createConcierge` arrives this phase, so *"remain future work"* becomes false. RESEARCH
(`04-RESEARCH.md:1048`) states the choice plainly: `createConcierge` reaches the guard
**transitively** through `buildCatalog` on its first line, and a second direct call is a documented
no-op (the same-version adopt path, `contract.ts:115-120`). **Either add the direct call or correct
the sentence** — doing neither leaves a false claim in the published declarations, which is the exact
defect class 03-08 spent a plan removing. The cheaper and more honest edit is the sentence.

Note the constraint at `contract.ts:109-113` that governs the alternative: *"Call this from the
first reachable entry point … and never at module scope."* A direct call inside `createConcierge`'s
body satisfies it; anything hoisted does not.

---

## Pattern Assignments — `test/` and `test-d/`

### `packages/concierge/test/concierge.test.ts` (runtime test, request-response + batch) — NEW

**Analog:** `packages/concierge/test/catalog.test.ts` — **exact**. It is the newest runtime suite,
it is the one whose subject is a `src/` module's behaviour rather than the artifact's shape, and
every convention this new file needs is already in it.

**Header convention: "What escapes without this file", then numbered defects.** The literal heading
text in `test/` is `What escapes without this file:` (lowercase after the colon-free heading); the
type-level suite uses caps. `catalog.test.ts:1-29` is the model — note it names *how many* defects
and flags the ones that pass a naive test:

```typescript
// packages/concierge/test/catalog.test.ts:1-29 (abridged)
// The catalog's behaviour — CAT-01, CAT-02, CAT-05, SEC-01, SEC-03, SEC-05 and
// DX-03, asserted against the BUILT artifact.
//
// What escapes without this file:
//
// Three defects, and two of them pass a naive test.
//
//   1. A `buildCatalog` that throws on the FIRST issue instead of aggregating.
//      ... It is indistinguishable
//      from the correct behaviour on any catalog with a single fault — which
//      is every catalog a test writes unless one deliberately writes four
//      faults, as the DX-03 block below does.
//   3. A SHALLOW freeze. Measured in ESM strict mode: with the entries array
//      frozen and the entries themselves not, `Object.isFrozen(catalog)` still
//      returns `true` while `catalog.entries[0].action.handler = attacker`
//      succeeds SILENTLY and the replacement handler then runs. A SEC-03 test
//      that asserts only `Object.isFrozen(catalog)` passes on the breach. The
//      tamper cases below therefore assert that the VALUE is unchanged, which
//      is the load-bearing half, and treat the throw as the second half rather
//      than the first.
```

The defects this file's header must name, all measured and all quotable from RESEARCH:

1. **A fresh array per call.** React's `useSyncExternalStore` compares with `Object.is`
   (`ReactFiberHooks.js`, `return !is(prevValue, nextValue)`); Svelte 5's `$derived` compares with
   `value === this.v`. The dev warning is `__DEV__`-only, its `didWarnUncachedGetSnapshot` latch
   fires **once per process**, and the exact string is
   `'The result of getSnapshot should be cached to avoid an infinite loop'` — **not** react.dev's
   abbreviation. So the framework is not a detector; `toBe` is.
2. **An unfrozen projection is a live tool-injection channel.** Measured: `push` onto the
   `.filter()` result succeeded and the agent's list became `['a','injected']`. The injected tool
   has no handler (dispatch resolves through the frozen `byName`), so the payload is the
   **description** — which is CAT-07's compile-time guarantee defeated at runtime. RESEARCH says
   that sentence belongs in this header (`04-RESEARCH.md:429`).
3. **The element-sharing invariant.** The shallow projection freeze is sufficient *because* the
   elements are shared and already deep-frozen. Removing **either** the `toBe` sharing assertion or
   the nested-schema-write assertion leaves the shallow freeze silently insufficient
   (`04-RESEARCH.md:1259`).
4. **A naive rename test passes under a broken implementation.** Renaming the *first* stage proves
   nothing — it is first under array iteration and under object-key iteration alike. Measured:
   array impl `results` → `results`; object impl `results` → `2`.
5. **A two-pass `explain()` can contradict itself** — `stage: "flaky"` alongside
   `stages: [{id: "flaky", matched: false}]`, measured from a matcher with an internal counter.

**Two behaviours have no single-literal mutant, and the house rule is to write that down in the test
file rather than fake one** (`04-CONTEXT.md:240`, `04-RESEARCH.md:1256-1259`): rename-independence
(a property of the data structure, not of a branch — M-04-4 covers the adjacent mutatable property,
first-match-wins) and the element-sharing invariant. `catalog.test.ts:458-469` is the precedent for
writing a *working* mutant into the file when the obvious one does not work:

```typescript
// packages/concierge/test/catalog.test.ts:458-469
    // The mutant that proves this case fires, written down because the obvious
    // spelling of it does NOT work and the failure looks like a pass. Replacing
    // the literal `warnHost(` with `void (` in `src/catalog.ts` turns the call
    // into `void (…,)` — the sink's argument list ends in a trailing comma, and
    // a PARENTHESIZED expression may not, so rolldown fails with a PARSE_ERROR
    // at `catalog.ts:503`. The harness then reports `PASS: gate fired (exit 1)`
    // having never run a single test ... Two forms measured to fire on
    // this case with the build green, either of which is a real proof:
    //
    //     src/catalog.ts   `warnHost(`                    -> `String(`
    //     src/host.ts      `host.console?.warn(message);` -> `void message;`
```

The M-04-4 design constraint belongs here too: **`stageFor` and `explain` must use distinct loop
spellings**, or the mutant literal is not unique. RESEARCH says to note it in the test file.

**The four standing header blocks**, each with its own divider (`catalog.test.ts:31-69`):

```typescript
// packages/concierge/test/catalog.test.ts:31-44
// ---------------------------------------------------------------------------
// dist, not src — the same decision its three siblings state
// ---------------------------------------------------------------------------
//
// Every assertion here runs against `../dist/index.js`, never against the
// source, for two reasons. It is the artifact a consumer actually imports, so
// an export lost to the `export type { … }` block or a rule dropped by a build
// config is visible here and nowhere else at runtime. And `vitest.config.ts`
// (see its third header block) records that `packages/concierge/test/` is in NO
// TypeScript program at all — so a source import would be untypechecked
// anyway, while additionally testing code that never shipped. (Every mention of
// `../src/` in this file is inside a comment; the acceptance check for that
// rule is scoped to non-comment lines, which is precisely why this paragraph
// may name the thing it forbids.)
```

```typescript
// packages/concierge/test/catalog.test.ts:46-57 (abridged)
// ---------------------------------------------------------------------------
// This suite writes the global contract registry, once per test
// ---------------------------------------------------------------------------
//
// `buildCatalog` calls `assertSingleInstance()` on its first line ... EVERY test in this
// file mutates `globalThis[Symbol.for("@fullselfbrowsing/concierge.contract")]`
// as a side effect. Vitest's default isolation gives each test FILE its own
// process, so this cannot leak into `single-instance.test.ts`; it is reset
// below anyway ...
```

Both apply verbatim to `concierge.test.ts` — `createConcierge` reaches `assertSingleInstance`
transitively through `buildCatalog`, so this suite writes the registry on every test too.

**The `vitest.config.ts` fact that removes cast ceremony.** `packages/concierge/test/` is in **no
TypeScript program** (`vitest.config.ts:48-80`, verified this session). `emission.test.ts:41-47` is
the precedent for *using* that deliberately rather than working around it:

```typescript
// packages/concierge/test/emission.test.ts:41-47
// Like its three siblings, this file is in NO TypeScript program.
// `vitest.config.ts:48-80` records why `tsconfig.test-d.json` was deliberately
// not extended to cover `test/`. The practical consequence is used on purpose
// in one place below: case 8 hands `buildCatalog` a `jsonSchema` whose root is
// `type: "string"`, which the declared `JsonSchemaObject` would reject. No cast
// ceremony is needed, because no checker is looking — and the population that
// rule exists for is JavaScript consumers, who have no checker either.
```

Directly relevant here: the throwing matcher, the non-boolean matcher, and the hand-rolled
`BridgeRegistry` are all shapes a TypeScript consumer could not write. No casts.

**Imports, module binding and the two guards** (`catalog.test.ts:71-124`) — copy this block almost
verbatim, substituting `createConcierge` for `buildCatalog`:

```typescript
// packages/concierge/test/catalog.test.ts:71-124
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  arktypeEmptyObject,
  arktypeObject,
  valibotObject,
  zodDiscriminatedUnion,
  zodEmptyObject,
  zodObject,
  zodRecord,
  zodStringRoot,
} from "./fixtures/schemas.js";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);

// Hard-coded, not imported, for the same reason `single-instance.test.ts:44-53`
// hard-codes it: the registry key is a cross-realm contract between two copies
// of this package that share no bindings, so its identity is the STRING and
// nothing else. Importing the symbol from the artifact under test would make
// this suite agree with whatever the artifact happens to say.
const KEY = Symbol.for("@fullselfbrowsing/concierge.contract");

// Bound in `beforeAll` rather than imported statically. A static
// `import { buildCatalog } from "../dist/index.js"` would fail with an opaque
// module-resolution error on a fresh checkout, BEFORE the existence guard below
// could produce the sentence that tells a developer to run `pnpm build`. Left
// unannotated on purpose: a dynamic import yields untyped bindings, and
// annotating them would be a claim this file has no program to check.
let buildCatalog;
let CatalogValidationError;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      `packages/concierge/dist/index.js is missing. These tests run against the ` +
        `BUILT artifact, not the source. Run \`pnpm build\` first.`,
    );
  }

  const artifact = await import(DIST_URL.href);
  buildCatalog = artifact.buildCatalog;
  CatalogValidationError = artifact.CatalogValidationError;
});

// `delete`, not assignment to `undefined` — the same reset, and the same
// reasoning, as `single-instance.test.ts:68-82`. `assertSingleInstance`
// branches on `prior === undefined`, so the slot must be genuinely absent.
beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});
```

No new fixture file is needed — `test/fixtures/schemas.ts` already provides every validator shape
this phase uses (`zodObject`, `arktypeObject`, `zodEmptyObject`, `valibotObject`, `zodRecord`, …).
No new devDependency.

**Declaration helpers** (`catalog.test.ts:126-163`). The `declare(...)` factory and the identifiable
`noopHandler` carry straight over; a `stage(...)` helper in the same register is the natural
addition:

```typescript
// packages/concierge/test/catalog.test.ts:130-148
// A handler that is identifiable by reference. The SEC-03 tamper case compares
// the handler that comes back out of the catalog against the one that went in,
// so an anonymous arrow per declaration would make the assertion unwritable.
function noopHandler() {
  return { ok: true };
}

// `redact` is deliberately NOT defaulted here. Adding one would make every
// declaration in this file well-formed and quietly remove SEC-01's failing
// branch from the suite's reach.
function declare(name: string, schema: unknown, extra: Record<string, unknown> = {}) {
  return {
    name,
    description: `the ${name} action`,
    schema,
    handler: noopHandler,
    ...extra,
  };
}
```

> Note the inverted decision for this file: `concierge.test.ts` builds through `createConcierge`,
> which must **succeed**, so its declarations *do* carry `redact: "drop"`. Say why in a comment —
> the omission-is-the-point reasoning above is `catalog.test.ts`'s, not this file's.

**Titling** (`catalog.test.ts:165`, `:166`, `:224`, `:239`). `describe` states the requirement ID
plus the claim; each `it` is prefixed with its finding ID and states a full proposition:

```typescript
// packages/concierge/test/catalog.test.ts:165-166
describe("CAT-01 — one declaration derives the catalog, and there is no second registry", () => {
  it("C1 — two declarations produce names in order, byName lookups, and the emitted parameters", () => {
```

The ID series in `catalog.test.ts` runs `C1`…`C22`. RESEARCH's Requirements→Test map
(`04-RESEARCH.md:1161-1198`) lists ~20 rows for this file. **Continue the series or start a fresh
one — but pick one and say so in the header**, because C-numbers are cited by ID across
`03-*-SUMMARY.md` and a silent collision is a citation defect. A fresh series is the safer choice
(the two files are separate blast radii, the same argument `consent-variance.test-d.ts:59-62` makes
for re-declaring `Booking` locally).

**The STG-04 identity assertion, and why no React install is needed** (`04-RESEARCH.md:973-995`).
The second context is deliberately a **different object with extra keys** — a test passing the same
`ctx` twice would also pass under the `WeakMap<StageContext, …>` memo `PITFALLS.md:556` exists to
forbid:

```typescript
const a = concierge.catalogFor({ pathname: "/results" });
const b = concierge.catalogFor({ pathname: "/results", scrollY: 900, ts: Date.now() });

expect(a).toBe(b);                       // reference identity — the requirement
expect(Object.is(a, b)).toBe(true);      // spelled out, because `toBe` IS Object.is
```

**The freeze-assertion form — both halves, second one load-bearing** (`catalog.test.ts:609-638`).
This is the shape every SEC-03 case in the new file must take. `Object.isFrozen` alone passes on a
breached build:

```typescript
// packages/concierge/test/catalog.test.ts:609-638
  it("C17 — the catalog, its entries array, each entry and each action are all frozen", () => {
    const catalog = tamperTarget();

    // The FIRST of these four passes on the breached shallow form — measured,
    // `Object.isFrozen(catalog)` returned `true` while the entries beneath it
    // stayed mutable. It is asserted anyway, but only the three beneath it can
    // tell the two builds apart, and only C18 can tell them apart by
    // consequence rather than by report.
    expect(Object.isFrozen(catalog)).toBe(true);
    ...
  });

  it("C18 — replacing a built handler fails, and the original handler is still there", () => {
    const catalog = tamperTarget();
    const attacker = () => ({ ok: false });

    expect(catalog.entries[0].action.handler).toBe(noopHandler);

    // Both halves, and the SECOND is the load-bearing one. The write was
    // measured to be SILENT under a shallow freeze in some modes, so a suite
    // asserting only that it throws can pass while the replacement handler is
    // sitting in the catalog waiting to run.
    expect(() => {
      catalog.entries[0].action.handler = attacker;
    }).toThrow(TypeError);
    expect(catalog.entries[0].action.handler).toBe(noopHandler);
    expect(catalog.entries[0].action.handler).not.toBe(attacker);
  });
```

**Asserting a deliberate negative as a positive claim** (`catalog.test.ts:684-693`). This is the
register for two of this phase's cases — `explain(ctx) !== explain(ctx)`, and C22's still-unfrozen
validator which must stay green:

```typescript
// packages/concierge/test/catalog.test.ts:684-693
  it("C22 — the validator instance is NOT frozen, and still validates and still re-emits", () => {
    const catalog = tamperTarget();
    const schema = catalog.entries[0].action.schema;

    // Pins the deliberate `skip` in `deepFreeze`. SEC-03 names the HANDLER, not
    // the validator, and freezing a third-party library's internals is untested
    // and not obviously safe. Asserted as a positive claim so that "freeze
    // everything" cannot be adopted later as an obvious tightening.
    expect(Object.isFrozen(schema)).toBe(false);
```

CONTEXT flags C22 explicitly (`04-CONTEXT.md:290-292`): it is a **positive** claim, so "freeze
everything" is not available to this phase as an obvious tightening.

**Console capture — the exact sanctioned form** (`catalog.test.ts:433-501`, C12). The matcher-warning
cases and the `explain()`-writes-nothing case both need it. Four notes are load-bearing and are
already written into the file:

```typescript
// packages/concierge/test/catalog.test.ts:439-457
    // Four notes, each load-bearing:
    //
    //   - This is a PLAIN GLOBAL ASSIGNMENT, never the Vitest mocking API
    //     (`spyOn`, `fn`, `mock`). A grep for that API's namespace prefix over
    //     `test/` returns 0 across every file today and must still return 0
    //     afterwards — which is also why this note spells the prefix out in
    //     prose rather than writing it, since the acceptance check for the rule
    //     is not scoped to non-comment lines. The repository's prohibition is
    //     on the mocking API, not on assigning a global.
    //   - The real console is SPREAD rather than replaced wholesale, so an
    //     unrelated `console.error` from Vitest itself does not become
    //     "undefined is not a function" while the stand-in is installed.
    //   - Restoration happens in a `finally`, never after the assertions. A
    //     throwing expectation would otherwise leave a stand-in console
    //     installed for every later case in this file.
    //   - No cast ceremony is needed for the assignment even though `console`
    //     is not type-visible inside core under `lib: ["ES2022"]`: this file is
    //     in NO TypeScript program (see the header, and `vitest.config.ts`).
```

```typescript
// packages/concierge/test/catalog.test.ts:470-492
    const realConsole = globalThis.console;
    const captured: string[] = [];

    globalThis.console = {
      ...realConsole,
      warn: (message: string) => {
        captured.push(String(message));
      },
    };

    try {
      buildCatalog([
        declare("wipe", zodObject, { redact: "drop", effects: { destructive: true } }),
      ]);
    } finally {
      globalThis.console = realConsole;
    }

    // Two expectations, two claims: that the sink FIRED at all, and that what
    // it emitted carried the diagnostic's identity. A sink that fired with an
    // empty string satisfies the first and reports nothing.
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatch(/destructive_without_consent/);
```

Verified this session: `grep -rn 'vi\.' packages/concierge/test/` returns **0**. It must still
return 0.

**Recording a deliberate non-assertion** (`catalog.test.ts:494-500`, and the precedent it cites at
`export-surface.test.ts:31-46`). Directly needed here for the Pitfall-9 residual — a getter inside a
consumer-supplied `jsonSchema` survives the freeze, and **Phase 4 must not claim to close it**:

```typescript
// packages/concierge/test/catalog.test.ts:494-500
    // The deliberate NON-assertion that survives, written down rather than
    // written as a vacuously-passing check (the precedent is Trap 2 in
    // `export-surface.test.ts:31-46`): nothing here asserts what a host DOES
    // with the message, nor that a host with no `console` behaves any
    // particular way. Core reaches `globalThis.console?.warn` structurally and
    // a host with no console is a SUPPORTED host — `host.ts` says so — so
    // there is no behaviour there to pin.
```

**The measured-table-in-a-comment convention** (`emission.test.ts:49-74`). Three of this phase's
measured tables belong in this file rather than only in RESEARCH — the key-ordering table
(`04-RESEARCH.md:477-483`), the rename-sensitivity table (`:487-490`), and the
frozen-array-derivation table (`:352-360`):

```typescript
// packages/concierge/test/emission.test.ts:49-67 (abridged)
// ---------------------------------------------------------------------------
// MEASURED — emitted root per schema shape, target "draft-2020-12"
// ---------------------------------------------------------------------------
//
// Re-measured in this session against the installed packages, through the real
// `emitSchema`, not read from documentation:
//
//   | Fixture                 | Emitted root keys (in order)                        | Root check |
//   |-------------------------|-----------------------------------------------------|------------|
//   | `zodObject`             | `$schema, type, properties, required`               | passes     |
//   | `zodDiscriminatedUnion` | `$schema, oneOf` — NO `type`                        | FAILS      |
```

**Hand-rolled `BridgeRegistry` for the DX-01 bridge cases.** RESEARCH is explicit
(`04-RESEARCH.md:653`) that DX-01's bridge clause is fully testable in Phase 4 with no Phase 5 code:
`{ id: "results", read: () => mounted, register: () => () => {} }` is exactly what the exported
interface admits, and nothing about that test changes when `createBridge` ships.

---

### `packages/concierge/test-d/concierge.test-d.ts` (type-level test, predicate) — NEW

**Analog:** `packages/concierge/test-d/catalog.test-d.ts` for a multi-block file with an argued
header; `packages/concierge/test-d/consent-variance.test-d.ts` for the shortest complete template
(76 lines — read it whole); `test-d/_assert.ts` for the vocabulary.

**Assertion vocabulary — the entire mechanism, four aliases** (`_assert.ts:16-38`):

```typescript
// packages/concierge/test-d/_assert.ts:16-38
export {}; // makes this file's module status unconditional rather than dependent on what it declares

export type Expect<T extends true> = T;

// Conditional-identity formulation. Do NOT "simplify" this to the naive bidirectional
// `A extends B ? (B extends A ? true : false) : false` — that form is distributive, so it
// returns `boolean` rather than a decision whenever an operand is a union or `any` ...
export type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;

export type Assignable<From, To> = [From] extends [To] ? true : false;

export type Not<T extends boolean> = T extends true ? false : true;
```

**The `@ts-expect-error` house rule, verbatim** (`_assert.ts:5-14`) — predicates, always, with the
one reserved exception:

```typescript
// packages/concierge/test-d/_assert.ts:5-14
// Predicates, not `@ts-expect-error`. A directive suppresses ANY error on the line that
// follows it — including an unrelated typo — so a directive written to prove that a bad
// value is rejected can pass green for the wrong reason, and TypeScript offers no way to
// scope a directive to an error code. `Expect<...>` fails with TS2344 and puts the alias
// name on the echoed source line, so a failure says which guarantee broke. Name every
// assertion after the invariant it guards; that name is the only carrier of meaning in
// these diagnostics.
//
// Reserve `@ts-expect-error` for object-literal freshness (excess properties), which
// predicates cannot model: `Assignable<{...; extra: 1}, T>` evaluates to `true`.
```

Verified this session: the directive appears **6 times** across `test-d/`, every one on an
object-literal-freshness or non-modellable claim. `catalog.test-d.ts:82-86` records a file with
**zero** directives and says why — that is the target for this file too.

**Header, in caps, with the four standing blocks** (`catalog.test-d.ts:1-87`). The load-bearing one
is the export-nothing/annotate-nothing rule, because its failure mode lands on the innocent line:

```typescript
// packages/concierge/test-d/catalog.test-d.ts:65-80
// HOUSE RULES THIS FILE INHERITS, AND THE ONE THAT IS LOAD-BEARING HERE
//
// **Nothing below is annotated, and nothing below is exported.** Both halves matter and
// the second exists to protect the first. Every `defineAction` and every `buildCatalog`
// const here is deliberately un-annotated, because its *inferred* type is the entire
// subject of the file — annotating one would hand the test the answer it exists to
// derive ... `actions.test-d.ts:32-53` records what that looks like when it happens: the TS9010
// diagnostic lands on the **innocent** `const` declaration rather than on the export that
// reached for it, so the first fix a developer applies is to annotate the const — which
// is precisely the edit that disables the assertion. Do not export from this file.
//
// Every predicate is on ONE line however long, for the same reason: `tsc` echoes only the
// line the failing type argument sits on. Do not let a formatter wrap them.
```

**The terse-output caveat, which decides how a mutant against this file is asserted**
(`catalog.test-d.ts:55-63`):

```typescript
// packages/concierge/test-d/catalog.test-d.ts:55-63
// THE TERSE-OUTPUT CAVEAT, AND HOW A MUTANT AGAINST THIS FILE MUST BE ASSERTED
//
// Measured non-TTY, which is what CI sees (`03-RESEARCH.md` *Pitfall 10*). A failing
// `Expect<…>` prints exactly `Type 'false' does not satisfy the constraint 'true'.` and
// **no alias name** — the echoed source line and the caret are TTY-only, so the name that
// carries all of the meaning never appears in the output. Assert a mutant against this
// file on its **exit code** (`tsc` exits **1**, not 2, under typescript 7.0.2) plus
// `file:line`. Never grep the output for a predicate's name; it will never match, and a
// grep that never matches reads as a passing check.
```

M-04-14 (`explain: (ctx: StageContext) => Explanation;` deleted from `types.ts`) is asserted this
way: exit code plus `file:line`, never a name grep.

**Imports and zero-cost fixtures** (`catalog.test-d.ts:88-109`) — `declare const` is the fixture
form for a type-level program, and locals are re-declared rather than shared:

```typescript
// packages/concierge/test-d/catalog.test-d.ts:88-99
import type { Assignable, Equals, Expect, Not } from "./_assert.js";
import type { CatalogEntry } from "../src/catalog.js";
import { buildCatalog } from "../src/catalog.js";
import { defineAction } from "../src/define-action.js";
import type { StandardSchemaV1 } from "../src/types.js";

// --------------------------------------------------------------------------
// Fixtures — every one local, none exported, none annotated
// --------------------------------------------------------------------------

/** The canonical example's schema, verbatim in shape from the project's own description. */
declare const filterSchema: StandardSchemaV1<unknown, { key: string; value: string }>;
```

Note: `test-d/` imports `../src/`, never `../dist/`. That is the inverse of `test/` and is correct —
`tsconfig.test-d.json` includes `["src/**/*.ts", "test-d/**/*.ts"]`.

**Predicate spelling** (`catalog.test-d.ts:159-168`, `:297-301`; `consent-variance.test-d.ts:75-76`)
— one line however long, `_lowerCamelInvariantName`, doc-commented with one sentence naming what
breaks:

```typescript
// packages/concierge/test-d/catalog.test-d.ts:164-168
/** What the union actually buys, on the documented path: the lookup is keyed by it, so `declaredCatalog.byName.aplyFilter` is a TS2339 at build time rather than an `undefined` at dispatch time. */
type _declaredByNameIsKeyedByTheUnion = Expect<Equals<keyof (typeof declaredCatalog)["byName"], "applyFilter" | "cancelBooking">>;

/** T-03-25 at the catalog level: the union comes from `name` ALONE ... */
type _declaredNameUnionIgnoresConsentRequires = Expect<Not<Assignable<"reviewFilter", (typeof declaredCatalog)["names"][number]>>>;
```

```typescript
// packages/concierge/test-d/consent-variance.test-d.ts:75-76
/** Function-property syntax keeps `snapshotEquality`'s parameters contravariant. Method syntax would make them bivariant, and a comparator for the wrong snapshot type would satisfy the field. */
type _policyNotBivariant = Expect<Not<Assignable<ConsentPolicy<Booking>, ConsentPolicy<unknown>>>>;
```

**`Equals` vs `Assignable` — the choice is the content of the line**, and both existing files argue
it. For the `EmittedTool`-readonly pin the argument at `catalog.test-d.ts:300-301` is directly
transferable, because it is the same defect one level down:

```typescript
// packages/concierge/test-d/catalog.test-d.ts:300-301
/** The elements, which the line above does not cover. `Equals` and not `Assignable`, and the choice is the whole value of the line: a mutable-shaped `{action, parameters}` object IS assignable to `CatalogEntry` — measured `true` — because readonly property modifiers do not affect assignability, so an `Assignable` spelling here would stay green with both modifiers deleted. `Readonly<CatalogEntry>` being identical to `CatalogEntry` is true today and is false the moment either member loses its `readonly`. */
type _entryMembersAreReadonly = Expect<Equals<CatalogEntry, Readonly<CatalogEntry>>>;
```

So the `EmittedTool` pin is `Expect<Equals<EmittedTool, Readonly<EmittedTool>>>`, **not** an
`Assignable` spelling — an `Assignable` one stays green with every modifier deleted.

The same reasoning governs `ConciergeConfig`'s seam pins, argued at `actions.test-d.ts:469-476`:
*"`Assignable<…>` stays true when the field is widened to `unknown`, to a bare function type, or to
a union that swallows the declared type — which is exactly the silent-widening regression worth
guarding."* Apply it to `Concierge["explain"]`.

**STG-03's type half** — the shapes RESEARCH verified compile under the full repo flag set
(`04-RESEARCH.md:496-503`). These are declarations, not predicates; they go red by failing to
compile, which is the correct mechanism for an admits-this-shape claim:

```typescript
const m1 = (ctx: StageContext): boolean => ctx.pathname === "/results";
const m2 = (ctx: StageContext): boolean => ctx["modal"] === "checkout" && ctx["cartCount"] !== 0;
const m3 = (ctx: StageContext): boolean => ctx.modal === "x";     // dot access on the index signature — compiles
s.match({ pathname: "/x", tenantId: "acme", role: "admin" });     // extra keys — compiles
```

---

### `packages/concierge/test/catalog.test.ts` (runtime test) — MODIFIED

**Analog:** itself. One new `describe` block for CAT-03, five cases, modelled on the DX-03 block.

**The block to copy** (`catalog.test.ts:224-307`). Note the shared fixture *function* returning a
fresh array per call — necessary because `catchBuild` and the `toThrow` assertion each build once:

```typescript
// packages/concierge/test/catalog.test.ts:224-248
describe("DX-03 — every problem in one throw, carried as structured fields", () => {
  // Four distinct faults across five declarations, modelled on the measured
  // prototype output in 03-03-SUMMARY. `applyFilter` is declared twice: the
  // FIRST one is valid and produces no issue, so the duplicate's issue names a
  // fourth distinct action rather than repeating one already reported.
  function fourBadDeclarations() { ... }

  it("C4 — four bad declarations throw ONCE, with four issues, four codes and four distinct names", () => {
    expect(() => buildCatalog(fourBadDeclarations())).toThrow(CatalogValidationError);

    const error = catchBuild(fourBadDeclarations());

    // The number is the requirement. A `buildCatalog` that short-circuits on
    // the first fault throws an error carrying ONE issue and is otherwise
    // indistinguishable from this one — which is why the count is asserted
    // before anything about its contents.
    expect(error.issues).toHaveLength(4);
```

**The two-halves helper** (`catalog.test.ts:150-163`) — already present, reuse it:

```typescript
// packages/concierge/test/catalog.test.ts:150-163
// `expect(...).toThrow(CatalogValidationError)` proves the throw; it cannot
// reach `.issues`. Both halves are needed, so the throw is asserted separately
// and the error is captured here for the structured assertions.
function catchBuild(actions: unknown[], options?: unknown) {
  try {
    buildCatalog(actions, options);
  } catch (error) {
    return error;
  }
  throw new Error(
    "buildCatalog returned instead of throwing — every assertion below this " +
      "point depends on the throw, so a silent pass would be a false green.",
  );
}
```

**The five cases** (`04-RESEARCH.md:1178-1183`): typo'd `requires` → `consent_target_missing` with
the referrer in `.action` and the target in `.problem`; self-reference → `consent_self_reference`
and **not** `consent_target_missing`; a **forward** reference builds clean; a consent typo alongside
three other faults throws once with four issues; plus the `CatalogIssueCode` type assertion, which
lives in `test-d/catalog.test-d.ts`. The cross-stage-target clean build belongs in
`test/concierge.test.ts`, because only `createConcierge` produces the append-last ordering.

**Issue ordering — one constraint on the new cases.** CAT-03 issues append *after* every per-action
issue rather than interleaving in declaration order (`04-RESEARCH.md:555`). Restoring declaration
order would need an origin index on every issue: new structure for cosmetic gain, rejected. **A new
CAT-03 test must not assume interleaving.** C4 is unaffected — verified, none of its five
declarations carries a `consent` policy.

**Mutual exclusivity** (`04-RESEARCH.md:557`): a self-reference implies the target exists, so the two
codes can never both fire for one action. Check self-reference first, `else if` on missing. The
`consent_self_reference` case must therefore assert **both** that the right code fired and that the
wrong one did not — the two-expectations-per-claim rule (`single-instance.test.ts:186-192`).

---

### `packages/concierge/test/export-surface.test.ts` (runtime test, file-I/O) — MODIFIED

**Analog:** itself. **Seven** things move together, and the counts appear in `it` titles as well as
assertions, so a stale title lies in the test report.

Current state, re-verified this session by running the file's own regex over `dist/index.d.ts`:
`blocks 1 names 59 values 10 types 49`.

```typescript
// packages/concierge/test/export-surface.test.ts:132-149
describe("the published export surface of dist/index.d.ts", () => {
  it("is exactly 59 names — an export added or dropped by a build-config change lands here", () => {
    const { names } = readSurface();
    expect(names).toHaveLength(59);
  });

  it("splits 49 types to 10 values", () => {
    const { types, values } = readSurface();
    expect(types).toHaveLength(49);
    expect(values).toHaveLength(10);
  });

  it("carries all ten runtime value exports by name", () => {
    const { values } = readSurface();
    for (const name of VALUE_EXPORTS) {
      expect(values).toContain(name);
    }
  });
```

| Location | From | To |
|---|---|---|
| `:133` — `it` title | `59 names` | **62** |
| `:135` — assertion | `toHaveLength(59)` | **62** |
| `:138` — `it` title | `splits 49 types to 10 values` | **splits 51 types to 11 values** |
| `:140`, `:141` — assertions | `49`, `10` | **51**, **11** |
| `:144` — `it` title | `all ten runtime value exports` | **eleven** |
| `:106-121` — `VALUE_EXPORTS` | 10 entries | **11** — add `"createConcierge"` |

The third title is the one with no assertion to check it against, and the file says so:

```typescript
// packages/concierge/test/export-surface.test.ts:101-121
// The third `it` title below states this list's LENGTH and its assertion is a
// `for…of` loop carrying no number at all. So a reviewer checking "does the
// title match the assertion beneath it" structurally cannot catch a stale
// number there — the only thing it can be checked against is this array. Grow
// one, reread the other.
const VALUE_EXPORTS = [
  "USER_CANCELLED",
  ...
  "buildCatalog",
  // A class is both a value and a type. It must appear here, in the VALUE half
  // of the parsed surface, with no `type ` prefix ...
  "CatalogValidationError",
];
```

**Do not touch the parser** (`:74-99`). Its throw is the guard against "fixing" a red count by
weakening the regex:

```typescript
// packages/concierge/test/export-surface.test.ts:78-84
  if (blocks.length === 0) {
    throw new Error(
      `no trailing \`export { … };\` statement found in dist/index.d.ts — ` +
        `the parser, not the surface, is what changed. Inspect the artifact ` +
        `before adjusting the expected count.`,
    );
  }
```

Because the parser reads only the trailing bare `export { … };` block, a module-internal export such
as `deepFreeze` cannot reach the count — which is what makes exporting it from `catalog.ts` free.

**Ordering obligation.** This file, `artifact.test.ts`, `catalog.test.ts`, `emission.test.ts` and
`single-instance.test.ts` all read `packages/concierge/dist/`. They go red until `pnpm build`
re-runs after new exports land, so every plan touching exports runs `pnpm build` before `pnpm test`.

---

### `packages/concierge/test/single-instance.test.ts` (runtime test) — MODIFIED

**Analog:** itself, F4 (`:195-221`) — **exact**. RESEARCH's map asks for one new case proving
`createConcierge` reaches `assertSingleInstance`. F4 is the same claim about `buildCatalog` and is
the shape to copy, including the both-directions structure:

```typescript
// packages/concierge/test/single-instance.test.ts:195-221
  it("F4 — buildCatalog records this copy in the registry on its first line, so the guard has a production call site", async () => {
    // A fresh query string, the same cache-busting idiom F1a and F2 use. Here
    // it is what makes the "empty after import" half meaningful: a specifier
    // Node has already evaluated would return the cached namespace without
    // re-running module scope, so the absence below would prove nothing.
    const { assertSingleInstance, buildCatalog, CONTRACT_VERSION } = await import(
      `${DIST_HREF}?sc5=1`
    );

    // Half one — EMPTY immediately after evaluation. This is the assertion that
    // catches a guard smuggled up to module scope ... `assertSingleInstance`
    // is destructured above and deliberately not called: importing a binding is
    // not invoking it.
    expect(typeof assertSingleInstance).toBe("function");
    expect(registry[KEY]).toBeUndefined();

    // The production path. An empty catalog is enough — the guard runs before
    // any declaration is looked at, which is the point of it being the first
    // statement rather than a step in the loop.
    buildCatalog([]);

    // Half two — POPULATED afterwards. Read through the same global record F1a
    // asserts on at :122, which is this suite's established observable; no spy
    // is introduced, because one already exists and reports exactly this.
    expect(registry[KEY]).toEqual({ version: CONTRACT_VERSION });
  });
```

**Use a distinct query string** (F4 uses `?sc5=1`) so the new case gets its own module evaluation.
`createConcierge({ stages: [] })` is the minimal production path.

**The header block that must extend** (`:29-54`). It currently argues that F1a/F1b/F2 cannot see
whether `buildCatalog` still calls the guard. The same argument now covers a second call site, and
the transitive reach is the interesting part: **F5 passes whether `createConcierge` calls the guard
directly or reaches it through `buildCatalog`** — which is correct, because either satisfies PKG-04,
and the header should say so rather than let a reader infer a direct call that may not exist.

**No mocking.** The observable is the global registry record; the file says so at `:218-220`. Do not
introduce a spy when one already exists and reports exactly this.

---

### `packages/concierge/test-d/catalog.test-d.ts` (type-level test) — MODIFIED

**Analog:** itself. Two edits, one of them a non-edit.

**1. The `CatalogIssueCode` union assertion.** The file currently imports only `CatalogEntry` as a
type from `../src/catalog.js` (`:89`); add `CatalogIssueCode`. The `Equals`-over-`Assignable` rule
applies: `Expect<Assignable<"consent_target_missing", CatalogIssueCode>>` stays green if the union
is widened to `string`, so pin the whole union with `Equals` — or pin both directions, following the
`_declaredNamesAreALiteralUnion` / `_declaredNamesAreNotWidenedToString` pair at `:158-162` whose
doc comment explains exactly why one line is not enough.

**2. `_inlineDefineActionLosesTheUnion` stays red-as-pinned — do not touch it.** The standing
instruction is in the file and CONTEXT repeats it (`04-CONTEXT.md:190-192`):

```typescript
// packages/concierge/test-d/catalog.test-d.ts:267-284
// **If this predicate ever goes red, the gap has been CLOSED. Delete the predicate and
// this comment — do not relax it.** Same standing instruction as the `${number}` gap
// pinned in `description-literal.test-d.ts`, and for the same reason: a pin on a known
// defect is only useful if it is loud when the defect goes away.

/** Un-annotated, and the inline call is the entire point — hoisting it to a `const` would silently repair the very thing this pins. */
const inlineCatalog = buildCatalog([
  defineAction({ name: "inlineFilter", ... }),
]);

/** The pin. `readonly string[]` is what is measured TODAY and is a defect, not a specification; see the block comment directly above before touching this line. */
type _inlineDefineActionLosesTheUnion = Expect<Equals<(typeof inlineCatalog)["names"], readonly string[]>>;
```

The block comment above it (`:262-265`) already names `StageDefinition.actions` and
`ConciergeConfig.crossStage` as carrying the same mechanism — which is exactly the doc-comment note
this phase adds to `types.ts`. Point the new `types.ts` paragraph at this block rather than
restating the three measurements.

---

### `packages/concierge/test-d/exports.test-d.ts` (type-level test) — MODIFIED

**Analog:** itself. One predicate, one name on the shared import line, one header count.

```typescript
// packages/concierge/test-d/exports.test-d.ts:70-71, :87-94
import type { Assignable, Equals, Expect } from "./_assert.js";
import { MESSAGE_MAX_CHARS, JSON_SCHEMA_TARGET, defineAction, buildCatalog, CatalogValidationError } from "../src/index.js";   // ← index.js. NOT types.js. This is the whole point.

/** defineAction reaches the public entrypoint as a callable VALUE, not only as a type. */
type _defineActionExportedAsValue = Expect<Assignable<typeof defineAction, (...args: never[]) => unknown>>;

/** buildCatalog reaches the public entrypoint as a callable VALUE, not only as a type. */
type _buildCatalogExportedAsValue = Expect<Assignable<typeof buildCatalog, (...args: never[]) => unknown>>;
```

The sixth predicate, in the house shape:

```typescript
/** createConcierge reaches the public entrypoint as a callable VALUE, not only as a type. */
type _createConciergeExportedAsValue = Expect<Assignable<typeof createConcierge, (...args: never[]) => unknown>>;
```

`createConcierge` joins the **shared import line at `:71`**. The header explains the diagnostic and
its count must move from five to six:

```typescript
// packages/concierge/test-d/exports.test-d.ts:51-60
// EVERY PREDICATE BELOW INHERITS THE TS1485-AT-THE-IMPORT-LINE BEHAVIOUR
//
// Phase 3 added four more runtime values to the entrypoint and each one gets a
// predicate here. They all fail the same way the original does ... move `buildCatalog`
// into `index.ts`'s `export type { … }` block and the
// diagnostic is TS1485 on the single shared IMPORT line below, naming
// `buildCatalog` — not TS2344 on the predicate line named after it. The import
// is shared, so the line number is identical whichever of the five regressed.
// Read the NAME in the message, not the line.
```

The deliberate looseness of the `Assignable` signature is also argued and must not be tightened:

```typescript
// packages/concierge/test-d/exports.test-d.ts:62-68
// The two `Assignable` predicates are deliberately loose about the signature:
// `(...args: never[]) => unknown` asserts only "this is a function value", which
// is all the export-PLACEMENT guarantee needs. Signature shape is pinned
// elsewhere ... Tightening these would
// duplicate that and make this file fail for reasons that have nothing to do
// with export placement.
```

So `createConcierge`'s **signature** is pinned in `test-d/concierge.test-d.ts`, not here.

---

### `packages/concierge/test/artifact.test.ts` (runtime test) — MODIFIED *(inferred)*

**Analog:** itself (`:107-127`). Not in RESEARCH's test map, but the established convention is that
**every value export gets an artifact-level case**, and all four of Phase 3's values have one:

```typescript
// packages/concierge/test/artifact.test.ts:107-115
  it("buildCatalog reaches dist/index.js as a callable function", async () => {
    const m = await import(DIST_URL.href);

    // The entire build-time validation surface is behind this one binding. Lost
    // to the `export type { … }` block, every rule in `catalog.ts` — SEC-01's
    // redaction requirement, CAT-02's root-object check, the duplicate-name
    // check — stops running, and the only symptom is a call that never happens.
    expect(typeof m.buildCatalog).toBe("function");
  });
```

The file's header states why this exists alongside `exports.test-d.ts` and why neither replaces the
other (`:14-19`): *"Different sampling rates, same defect."*

**Planner decision:** add a `createConcierge` case, or record in the file why not, per the
`export-surface.test.ts:31-46` "written down instead of asserted" precedent. Adding it is one `it`
and matches the convention; the consequence sentence writes itself — a `createConcierge` lost to
the type block is `TypeError: createConcierge is not a function` at the consumer's module scope,
which reads as "the package is broken" rather than "one export moved".

---

## Shared Patterns

### Doc comments carry the measured why, and the rejected alternative

**Source:** canonically `src/catalog.ts:1-57`, `:240-268`, `:513-564`; `src/define-action.ts:43-104`;
`src/types.ts:1294-1311`
**Apply to:** every new `src/` file, every modified doc comment, every new test file header

This repo's density of explanatory comment is far above normal and it is deliberate. The register:
state what was **measured**, state the **wrong-looking-right alternative**, and state what breaks
**silently**. `define-action.ts:71-94` is the extreme case and is worth reading as calibration — it
records that four of six branches *escaped* their mutants and then argues at length why deleting
them would be the exact move that reopens the guard.

RESEARCH produced a large body of measured findings for this phase (the 510× freeze timing, the
seven tamper vectors, the seven-scenario CAT-03 placement table, the key-ordering table, the
rolldown four-bundle result). **Those belong in doc comments and test headers, not only in
`04-RESEARCH.md`** — that is what every prior phase did, and it is why a reader of `contract.ts` does
not re-derive the tree-shaking finding.

### Corrections are annotated in place, never silently rewritten

**Source:** `src/catalog.ts:348-359` (a residual narrowed by measurement),
`src/catalog.ts:601-612` (an earlier claim in this very comment measured and corrected),
`src/define-action.ts:71-94` (a comment falsifying its own first wording),
`04-CONTEXT.md:58-85` (the phase's own two corrections)
**Apply to:** every claim this phase discovers to be wrong

The house form is a bolded lead — *"and narrower than first recorded"*, *"An earlier version of this
comment said …"*, *"**Do not read those four escapes as permission to delete them.**"* — followed by
the measurement and then by what the correction does and does not widen. Three claims are already
known to need this treatment in Phase 4: `catalog.ts:554-558`'s hand-forward framing,
`catalog.ts:487-491`'s Phase 4 note, and `contract.ts:140-147`'s "remain future work".

### Error and warning messages: `concierge: ` prefix, what + fix

**Source:** `src/contract.ts:165-172`, `src/catalog.ts:168-179`, `:506-511`
**Apply to:** both new `CatalogIssue` codes, both new `warnHost` warnings

```typescript
// packages/concierge/src/contract.ts:165-172
  throw new Error(
    `concierge: two different copies of @fullselfbrowsing/concierge are loaded ` +
      `(contract v${prior.version} and v${CONTRACT_VERSION}). Adapters must ` +
      `resolve the same core instance — check that every ` +
      `@fullselfbrowsing/concierge-* package has core as a peerDependency and ` +
      `that your lockfile has exactly one entry for it. ` +
      `Run: pnpm why @fullselfbrowsing/concierge`,
  );
```

Conventions: the `concierge: ` prefix; template literals concatenated with `+` across lines with a
trailing space inside each segment; the *what* and the *fix* both present; a runnable command last
where one exists. The standing rule from CONTEXT (`04-CONTEXT.md:197-199`): **a message which says
what is wrong without saying what to do fails the requirement.**

### Structural `globalThis` reach for host capabilities

**Source:** `src/host.ts` (whole file — its header states the three conventions any addition must
keep), `src/contract.ts:92-99` + `:145-152`
**Apply to:** the matcher warning, the duplicate-stage-id warning

`console` is TS2304 under `lib: ["ES2022"]`, measured. `warnHost` is the seam; adding a second
ad-hoc cast is what `host.ts:38-44` explicitly asks not to happen. Phase 4 needs no new capability —
no timer, no clock — so nothing is added to `host.ts` this phase.

### Type-level assertions are predicates, never `@ts-expect-error`

**Source:** `test-d/_assert.ts:1-38`
**Apply to:** `concierge.test-d.ts`, `catalog.test-d.ts`, `exports.test-d.ts`

Reserve the directive for object-literal freshness. `catalog.test-d.ts:82-86` documents a file with
zero directives and explains why every claim was expressible as a predicate; that is the target.

### Every test file's header names what escapes without it

**Source:** `test/single-instance.test.ts:1-54`, `test/artifact.test.ts:1-24`,
`test/export-surface.test.ts:1-46`, `test/catalog.test.ts:1-69`, `test/emission.test.ts:1-80`,
`test-d/catalog.test-d.ts:1-87`, `test-d/exports.test-d.ts:7-68`,
`test-d/consent-variance.test-d.ts:1-62`
**Apply to:** both new test files

Literal heading text in `test/` is `What escapes without this file:`; the type-level suite uses
`WHAT ESCAPES WITHOUT THIS FILE` in caps. Match the directory.

### Runtime tests read `dist/`; type tests read `src/`

**Source:** `test/single-instance.test.ts:14-20`, `test/catalog.test.ts:31-44`,
`vitest.config.ts:48-80`
**Apply to:** `test/concierge.test.ts` (dist), `test-d/concierge.test-d.ts` (src)

Two sub-conventions: the `beforeAll` `existsSync` guard whose message says `Run \`pnpm build\`
first`; and mentioning `../src/` **only inside comments**, with the paragraph saying so, because the
acceptance check for that rule is scoped to non-comment lines.

### No Vitest mocking API anywhere in `test/`

**Source:** `test/catalog.test.ts:439-447` (the rule, spelled in prose rather than written),
`test/single-instance.test.ts:218-220` (use the existing observable instead)
**Apply to:** every case in `test/concierge.test.ts`

Verified this session: `grep -rn 'vi\.' packages/concierge/test/` → **0 matches**. Console capture is
a plain global assignment, the real console spread rather than replaced, restored in a `finally`.

### Mutation proofs

**Source:** `scripts/mutate-and-prove.sh:16-50`
**Apply to:** RESEARCH's M-04-1 … M-04-14

```bash
# scripts/mutate-and-prove.sh:16-29
# Usage:
#   scripts/mutate-and-prove.sh <target-file> <literal-pattern> <replacement> -- <gate command...>
#
# The pattern is matched LITERALLY, not as a regex, and exactly one occurrence
# is replaced.
#
#   0  PASS  — the gate exited non-zero (the mutant was caught) and the tree is clean
#   1  FAIL  — the gate exited 0 (the mutant escaped)
#   2  ABORT — the target is unusable: not tracked, already dirty, or not supplied
#   3  ABORT — the substitution was a no-op (the pattern never matched)
#   4  ABORT — the target file was not restored
```

Three harness behaviours the executor must route around, all documented in the script itself and
re-stated by RESEARCH:

1. **Mandatory pre-flight per row:** `grep -F -o -- '<literal>' <file> | wc -l` must print exactly
   `1`, **comments included**. `perl -0pi` slurps the whole file with no `/g`, so a literal occurring
   once in code and earlier in a doc comment mutates the **comment**, the suite stays green, and the
   run is recorded as "FAIL: mutant escaped" — the inverse of the truth.
2. **Known limitation 2:** a mutant that breaks the build exits 1 at the build step and prints
   `PASS: gate fired (exit 1), tree clean` having run **zero** tests. Confirm from the gate's
   **output** that the mutant compiled and the tests ran.
3. `tsc` exits **1**, not 2, on diagnostics under TS 7.0.2. Line 32 of the script is already
   corrected; six plans have now re-derived this.

Two mutants in RESEARCH's battery need adjusting before they are run — see the table under
`src/concierge.ts` (M-04-1's `Object.freeze(` will not be unique; M-04-4 requires distinct loop
spellings) — and **M-04-7** (`id === null ? crossNames`) is written against the superseded
id-keyed memo and must be respelled for the index-keyed one.

### Command forms

**Source:** `04-RESEARCH.md:809-811` (seventh reproduction), `vitest.config.ts`
**Apply to:** every plan step and verification block

| Intent | Correct | Wrong |
|---|---|---|
| Run one suite | `pnpm test concierge` | `pnpm test -- concierge` (vitest's cac CLI discards after `--`; runs the **whole** suite) |
| Full gate | `pnpm build && pnpm typecheck && pnpm test` | `pnpm test` alone (every dist-reading suite goes red) |
| Type-level suite | `pnpm typecheck` → `tsc -p tsconfig.test-d.json` | Vitest typecheck mode (deliberately off) |
| Phase gate | the above plus `pnpm check:artifact`, `check:deps`, `check:pack`, `check:node-floor` | — |

`tsdown` does **not** typecheck. `tsc --noEmit` is a separate, load-bearing gate.

---

## No Analog Found

Verified by grep across `packages/concierge/src`, `test`, and `test-d` this session. The planner
should treat these as new-pattern-establishing work and use RESEARCH's measured prototypes directly.

| Pattern | Needed by | Role | Data Flow | Evidence of absence |
|---|---|---|---|---|
| **A factory returning closures over instance state** — `createConcierge` | STG-01/02/03/04, DX-01 | core module | transform | Every export in `src/` today is a pure function, a frozen constant, a class, or a type. `grep '^export function\|^export const\|^export class'` over `src/` → 9 hits, **none** returns a function or an object of functions. `buildCatalog` returns data; `defineAction` returns its argument. |
| **A memoization cache of any kind** — the `Map<number \| null, …>` memo | STG-04 | instance-local derived state | memoized projection | `grep -rn 'new Map' src/` → **0 matches**. `grep -rn '??=' src/` → **0**. The only `Set`/`WeakSet` in `src/` are build-local scratch inside `buildCatalog` (`catalog.ts:728`, `:731`, `:864`), discarded when it returns. `grep -rni 'memo\|cache' src/` → **1 match**, and it is the `Concierge.catalogFor` doc comment describing the thing that does not exist yet. |
| **A shallow `Object.freeze` justified by an element-sharing invariant** — the projection | SEC-03 | immutability | transform | `src/` has exactly two freeze idioms: shallow-on-a-flat-literal at a declaration site (`types.ts:239`, `:261`, `:467`) and the recursive `deepFreeze` (`catalog.ts:566`). A shallow freeze over a *derived* array whose sufficiency depends on an invariant elsewhere is new — and `catalog.ts:513-521` says the shallow form is normally *a breach that reports success*, so the new case needs its coupling argued explicitly or it reads as the known defect. |
| **A guarded call into consumer code that must NOT echo the caught error** — `runMatch` | STG-02, matcher policy | injection seam | event-driven | `src/` has two `try`/`catch` blocks, both in `json-schema.ts` (`:240`, `:385`), and both **do** echo the caught value — legitimately, because they are build-time developer diagnostics with a stated exemption (`json-schema.ts:259-261`). The runtime, per-navigation, fixed-prose-only policy is new and is the inverse decision. |
| **A callback seam core invokes with a warn-once latch** | matcher policy | injection seam | event-driven | `catalog.ts:845-849` invokes `onDiagnostic`, but deliberately **unguarded** (throwing from it is the supported mechanism) and with no latch. Half an analog: copy the invocation shape, invert the guarding decision, add the latch. |
| **A runtime test asserting referential identity ACROSS two calls** | STG-04, ROADMAP SC-3 | test technique | — | `catalog.test.ts:181-182` asserts identity *within* one build (`byName[x]` `toBe` `entries[0]`). Nothing anywhere asserts that two separate invocations return the same reference. |
| **A runtime test asserting deliberate NON-identity** — `explain(ctx) !== explain(ctx)` | DX-01 | test technique | — | No precedent. The nearest register is C22's positive claim that something is *not* frozen (`catalog.test.ts:684-693`), which is the tone to copy. |
| **A runtime test asserting two instances do not share state** | STG-04 (proves the cache is instance-local) | test technique | — | `single-instance.test.ts` asserts the opposite property — that two module *evaluations* converge on one record. Nothing asserts two instances of one export diverge. |

**Also genuinely new, though lower-risk:** the first `src/` module that imports from another `src/`
runtime module for a *value* other than a seam (`deepFreeze` from `catalog.ts`); and the first
runtime test file whose subject is a factory rather than a pure function, which changes the
per-test setup shape from "call and assert" to "construct, then call and assert".

---

## Metadata

**Analog search scope:** `packages/concierge/src/` (7 files), `packages/concierge/test/` (6 test
files + `fixtures/`), `packages/concierge/test-d/` (10 files), `scripts/mutate-and-prove.sh`,
`vitest.config.ts`, both `package.json`s, `packages/concierge/dist/index.d.ts` (parsed, not read)

**Files read in full:** `src/catalog.ts`, `src/index.ts`, `src/host.ts`, `src/define-action.ts`,
`test/catalog.test.ts`, `test/artifact.test.ts`, `test/export-surface.test.ts`,
`test/single-instance.test.ts`, `test-d/_assert.ts`, `test-d/catalog.test-d.ts`,
`test-d/exports.test-d.ts`, `test-d/consent-variance.test-d.ts`

**Files read in targeted, non-overlapping ranges:** `src/types.ts` — `:96-230` (`ActionResult`,
`AbandonReason`, `FailureReason`, `ReasonCode`), `:1062-1151` (`Bridge`, `BridgeRegistry`,
`StageContext`, `StageDefinition`), `:1290-1334` (`Transport`, `EmittedTool`), `:1334-1569`
(`Scheduler`, `ConciergeConfig`, `Concierge`, `Session`, `SessionConfig`);
`src/contract.ts` — `:100-173`; `src/json-schema.ts` — `:215-274`, `:360-415`;
`test/emission.test.ts` — `:1-80`; `test-d/actions.test-d.ts` — `:355-479`;
`vitest.config.ts` — `:40-100`; `scripts/mutate-and-prove.sh` — `:1-50`.
Structural map of `src/types.ts`'s 60 top-level declarations taken by grep rather than by reading.

**Absence claims verified by grep this session, not assumed:** `new Map` / `new Set` / `new WeakSet`
in `src/`; `??=` in `src/`; `Object.create(null)` in `src/`; `for (const` in `src/` (5 occurrences,
all distinct spellings); `try {` / `} catch` in `src/` (2, both in `json-schema.ts`);
`vi.` in `test/` (0); `@ts-expect-error` in `test-d/` (6, all on non-modellable claims);
`memo`/`cache` in `src/` (1, a doc comment).

**Measurements re-taken this session rather than inherited:** export surface parsed from
`dist/index.d.ts` with `export-surface.test.ts`'s own regex → `blocks 1 names 59 values 10 types 49`;
unfiltered mutant-literal counts in `src/catalog.ts` (`Object.freeze(` → 1, `deepFreeze(` → 2,
`duplicate_action_name` → 2, `action.consent` → 2, `seenNames.add(action.name);` → 1,
`if (issues.length > 0) {` → 1).

**Project skills:** none — neither `.claude/skills/` nor `.agents/skills/` exists (matches
`CLAUDE.md`'s own statement).

**Pattern extraction date:** 2026-07-30
