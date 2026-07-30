// The catalog's behaviour — CAT-01, CAT-02, CAT-03, CAT-05, SEC-01, SEC-03,
// SEC-05 and DX-03, asserted against the BUILT artifact.
//
// What escapes without this file:
//
// Four defects, and three of them pass a naive test.
//
//   1. A `buildCatalog` that throws on the FIRST issue instead of aggregating.
//      A developer with twenty bad declarations then fixes and rebuilds twenty
//      times, and nothing in this repository fails. It is indistinguishable
//      from the correct behaviour on any catalog with a single fault — which
//      is every catalog a test writes unless one deliberately writes four
//      faults, as the DX-03 block below does.
//   2. A `destructive_without_consent` warning that reaches only the console.
//      That is an annotation nothing reads and nothing can assert, so SEC-05's
//      marker would be decorative. Every diagnostic claim below therefore reads
//      `catalog.diagnostics` or the `onDiagnostic` hook — with exactly one
//      deliberate exception, the default-sink case, which exists because the
//      console path ALSO has to fire and, before it was written, deleting the
//      `warnHost(...)` call was invisible to every case, every suite and every
//      gate in this repository.
//   3. A SHALLOW freeze. Measured in ESM strict mode: with the entries array
//      frozen and the entries themselves not, `Object.isFrozen(catalog)` still
//      returns `true` while `catalog.entries[0].action.handler = attacker`
//      succeeds SILENTLY and the replacement handler then runs. A SEC-03 test
//      that asserts only `Object.isFrozen(catalog)` passes on the breach. The
//      tamper cases below therefore assert that the VALUE is unchanged, which
//      is the load-bearing half, and treat the throw as the second half rather
//      than the first.
//   4. A CAT-03 consent check placed INSIDE the per-action loop instead of in a
//      post-pass over the complete name set. It is indistinguishable from the
//      correct rule on every BACKWARD reference — a target declared before its
//      referrer — which is the shape a test writes by default, because it is
//      the order the example in one's head is already in. Measured, not
//      supposed: the two placements were implemented and run over seven
//      scenarios, and the in-loop form produced a FALSE POSITIVE on rows 1
//      (forward reference) and 7 (cross-stage target, which `createConcierge`
//      appends LAST, so every consent policy naming one would fail the build)
//      and MISSED row 4 (self reference) entirely, because `seenNames.add` has
//      already run by the time an in-loop check fires. A rule that rejects
//      every legitimate build is a rule that gets deleted, which leaves CAT-03
//      unenforced by the shortest possible route — so C25 below, the forward
//      reference that must NOT throw, is the case that tells the two
//      placements apart, and it is the only one that can.
//
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
//
// ---------------------------------------------------------------------------
// This suite writes the global contract registry, once per test
// ---------------------------------------------------------------------------
//
// `buildCatalog` calls `assertSingleInstance()` on its first line — that is
// ROADMAP Phase 3 SC-5, and `single-instance.test.ts` owns the case proving it.
// The consequence here is that EVERY test in this file mutates
// `globalThis[Symbol.for("@fullselfbrowsing/concierge.contract")]` as a side
// effect. Vitest's default isolation gives each test FILE its own process, so
// this cannot leak into `single-instance.test.ts`; it is reset below anyway, so
// that a future in-file case which cares about the registry starts from a known
// state rather than from whatever the previous `it` happened to leave.
//
// ---------------------------------------------------------------------------
// Declarations here are plain objects, not `defineAction(...)` calls
// ---------------------------------------------------------------------------
//
// Deliberate, and SEC-01 is why. `ActionDefinition.redact` is NOT optional, so
// `defineAction` cannot express a declaration that omits it — the omission is
// a compile error. But the entire population SEC-01's runtime half exists for
// is JavaScript consumers who omitted the field the type says they cannot
// omit. A suite that could only build well-typed declarations could not reach
// the `redaction_missing` branch at all, so it would test the default and
// report that as coverage of the rule.

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

// ---------------------------------------------------------------------------
// Declaration helpers
// ---------------------------------------------------------------------------

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

describe("CAT-01 — one declaration derives the catalog, and there is no second registry", () => {
  it("C1 — two declarations produce names in order, byName lookups, and the emitted parameters", () => {
    // The ONLY input is this array. There is no register() call, no decorator
    // and no side-channel: `names`, `byName` and `parameters` below are all
    // derived from these two objects, which is CAT-01's whole claim.
    const catalog = buildCatalog([
      declare("applyFilter", zodObject, { redact: "drop" }),
      declare("openItem", arktypeObject, { redact: "drop" }),
    ]);

    expect(catalog.names).toEqual(["applyFilter", "openItem"]);
    expect(catalog.entries).toHaveLength(2);

    // The lookup resolves to the SAME entry object, by identity. Deep equality
    // would also pass on a lookup holding structurally-identical copies, which
    // is a different data structure with different aliasing.
    expect(catalog.byName["applyFilter"]).toBe(catalog.entries[0]);
    expect(catalog.byName["openItem"]).toBe(catalog.entries[1]);

    // `parameters` carries the schema an agent is shown, derived from the
    // validator rather than restated by the author.
    expect(catalog.entries[0].parameters.type).toBe("object");
    expect(Object.keys(catalog.entries[0].parameters.properties)).toEqual([
      "key",
      "value",
    ]);
  });

  it("C2 — a declared redaction policy reaches the entry unchanged", () => {
    const projection = (args: { key: string }) => ({ key: args.key });
    const catalog = buildCatalog([declare("applyFilter", zodObject, { redact: projection })]);

    // Identity, not shape. SEC-01's default resolution must not touch a policy
    // the author already stated, and a projection FUNCTION is the case where
    // "unchanged" and "equal" come apart.
    expect(catalog.entries[0].action.redact).toBe(projection);
  });

  it("C3 — an arktype validator is a FUNCTION, and it goes through the real path", () => {
    // Measured this phase: `type({key: "string"})` returns a CALLABLE carrying
    // `~standard` as a property, where zod and valibot instances are plain
    // objects. A declaration guard written `typeof schema !== "object"`
    // typechecks, builds, and rejects EVERY arktype action in existence with a
    // confident message saying their validator is not a Standard Schema
    // validator. That bug shipped into 03-03's first draft and was caught only
    // by running a real arktype action through `buildCatalog` — so this case
    // exercises the fixture itself, never a stand-in.
    expect(typeof arktypeObject).toBe("function");

    const catalog = buildCatalog([declare("openItem", arktypeObject, { redact: "drop" })]);

    expect(catalog.entries[0].parameters.type).toBe("object");
    expect(Object.keys(catalog.entries[0].parameters.properties)).toEqual([
      "key",
      "value",
    ]);
  });
});

describe("DX-03 — every problem in one throw, carried as structured fields", () => {
  // Four distinct faults across five declarations, modelled on the measured
  // prototype output in 03-03-SUMMARY. `applyFilter` is declared twice: the
  // FIRST one is valid and produces no issue, so the duplicate's issue names a
  // fourth distinct action rather than repeating one already reported.
  function fourBadDeclarations() {
    return [
      declare("applyFilter", zodObject, { redact: "drop" }),
      declare("duUnion", zodDiscriminatedUnion, { redact: "drop" }),
      declare("noHatch", valibotObject, { redact: "drop" }),
      declare("stringRoot", zodStringRoot, { redact: "drop" }),
      declare("applyFilter", zodObject, { redact: "drop" }),
    ];
  }

  it("C4 — four bad declarations throw ONCE, with four issues, four codes and four distinct names", () => {
    expect(() => buildCatalog(fourBadDeclarations())).toThrow(CatalogValidationError);

    const error = catchBuild(fourBadDeclarations());

    // The number is the requirement. A `buildCatalog` that short-circuits on
    // the first fault throws an error carrying ONE issue and is otherwise
    // indistinguishable from this one — which is why the count is asserted
    // before anything about its contents.
    expect(error.issues).toHaveLength(4);

    expect(error.issues.map((issue) => issue.code)).toEqual([
      "schema_root_not_object",
      "schema_not_emittable",
      "schema_root_not_object",
      "duplicate_action_name",
    ]);

    // Four DISTINCT names, so an aggregated summary line ("3 actions have bad
    // schemas") could not satisfy this.
    expect(error.issues.map((issue) => issue.action)).toEqual([
      "duUnion",
      "noHatch",
      "stringRoot",
      "applyFilter",
    ]);
    expect(new Set(error.issues.map((issue) => issue.action)).size).toBe(4);
  });

  it("C5 — every issue carries `action` and `fix` as FIELDS, and the message is actionable", () => {
    const error = catchBuild(fourBadDeclarations());

    // Fields, not substrings. `message.includes(name)` is a guess that passes
    // on a message which happens to contain the word and fails on a legitimate
    // rewording; `issues.map(i => i.action)` is an assertion.
    for (const issue of error.issues) {
      expect(typeof issue.action).toBe("string");
      expect(issue.action.length).toBeGreaterThan(0);
      expect(typeof issue.fix).toBe("string");
      expect(issue.fix.length).toBeGreaterThan(0);
    }

    // `vendor` is present only where the fault is a property of the VALIDATOR
    // rather than of the declaration — a developer told only "the schema could
    // not be emitted" cannot tell which of the two they got wrong.
    expect(error.issues[1].vendor).toBe("valibot");
    expect(error.issues[3].vendor).toBeUndefined();

    // Two independent regexes over the composed message, and two claims:
    // that the problem is DETECTED (it names the offending action) and that it
    // is ACTIONABLE (it states the fix). A message naming the action and
    // offering no remedy satisfies the first and leaves the developer with
    // nothing to do. `single-instance.test.ts:154-166` is the precedent.
    expect(error.message).toMatch(/action "stringRoot"/);
    expect(error.message).toMatch(/Fix: wrap the schema in an object/);
  });

  it("C6 — the error is a CatalogValidationError and says so in `name`", () => {
    const error = catchBuild(fourBadDeclarations());

    expect(error).toBeInstanceOf(CatalogValidationError);

    // Subclassing `Error` does NOT set `name` — the instance inherits `"Error"`
    // from the prototype. A subclass that forgets the explicit assignment
    // reports as a bare `Error` in every log line, test snapshot and CI
    // annotation, while `instanceof` keeps passing.
    expect(error.name).toBe("CatalogValidationError");
  });
});

describe("CAT-05 and SEC-05 — both consent markers report themselves without blocking", () => {
  it("C7 — a destructive action with no consent BUILDS and reports itself in catalog.diagnostics", () => {
    const collected: unknown[] = [];
    const catalog = buildCatalog(
      [
        declare("wipe", zodObject, {
          redact: "drop",
          effects: { destructive: true },
        }),
      ],
      { onDiagnostic: (diagnostic: unknown) => collected.push(diagnostic) },
    );

    // Reports, never blocks. A consent policy can legitimately live a layer up,
    // so this must be a catalog and not a throw.
    expect(catalog.entries).toHaveLength(1);

    expect(catalog.diagnostics).toHaveLength(1);
    expect(catalog.diagnostics[0].code).toBe("destructive_without_consent");
    expect(catalog.diagnostics[0].action).toBe("wipe");
    expect(catalog.diagnostics[0].fix.length).toBeGreaterThan(0);
  });

  it("C8 — readsUntrusted reports under a DIFFERENT code, on a catalog carrying both markers", () => {
    const catalog = buildCatalog(
      [
        declare("wipe", zodObject, {
          redact: "drop",
          effects: { destructive: true },
        }),
        declare("readMail", zodObject, { redact: "drop", readsUntrusted: true }),
      ],
      { onDiagnostic: () => {} },
    );

    expect(catalog.entries).toHaveLength(2);
    expect(catalog.diagnostics).toHaveLength(2);

    // ROADMAP SC-3b says `readsUntrusted` reports "the same way" as
    // `effects.destructive` — same SHAPE, so one consumer branch handles both.
    // A distinct CODE is what then lets a team treat one as fatal and the other
    // as advisory. Asserted on a catalog carrying both, so "the same way"
    // cannot silently become "the same code".
    expect(catalog.diagnostics[0].code).toBe("destructive_without_consent");
    expect(catalog.diagnostics[1].code).toBe("reads_untrusted_without_consent");
    expect(catalog.diagnostics[0].code).not.toBe(catalog.diagnostics[1].code);

    // And the filter that distinction exists to make possible.
    const untrusted = catalog.diagnostics.filter(
      (diagnostic) => diagnostic.code === "reads_untrusted_without_consent",
    );
    expect(untrusted.map((diagnostic) => diagnostic.action)).toEqual(["readMail"]);
  });

  it("C9 — an onDiagnostic hook receives each diagnostic exactly ONCE", () => {
    const seen: { code: string; action: string }[] = [];

    const catalog = buildCatalog(
      [
        declare("wipe", zodObject, {
          redact: "drop",
          effects: { destructive: true },
        }),
        declare("readMail", zodObject, { redact: "drop", readsUntrusted: true }),
      ],
      {
        onDiagnostic: (diagnostic: { code: string; action: string }) => {
          seen.push(diagnostic);
        },
      },
    );

    // Exactly once, not at-least-once. A sink invoked twice per diagnostic
    // would double every line of a consumer's build output and would still
    // satisfy `toContainEqual`.
    expect(seen).toHaveLength(2);
    expect(seen.map((diagnostic) => [diagnostic.code, diagnostic.action])).toEqual([
      ["destructive_without_consent", "wipe"],
      ["reads_untrusted_without_consent", "readMail"],
    ]);

    // The hook REPLACES the default sink; it does not suppress the record.
    expect(catalog.diagnostics).toHaveLength(2);
  });

  it("C10 — a throwing onDiagnostic propagates out of buildCatalog", () => {
    // This is the SUPPORTED mechanism for an app making a diagnostic fatal in
    // its own build, which is why the sink is deliberately not wrapped in
    // `try`/`catch` (T-03-17, disposition ACCEPT). Asserted rather than
    // tolerated: wrapping the sink would silently remove the one lever that
    // keeps SEC-05's marker from being an annotation nothing acts on.
    expect(() =>
      buildCatalog(
        [
          declare("wipe", zodObject, {
            redact: "drop",
            effects: { destructive: true },
          }),
        ],
        {
          onDiagnostic: () => {
            throw new Error("fatal in consumer build");
          },
        },
      ),
    ).toThrow(/fatal in consumer build/);
  });

  it("C11 — with no hook supplied the catalog still builds and diagnostics is still populated", () => {
    // No `onDiagnostic`, so the DEFAULT sink runs and a warning is printed to
    // this test run's own console. That output is expected, not a failure —
    // C12 below is the case that asserts on it.
    const catalog = buildCatalog([
      declare("wipe", zodObject, { redact: "drop", effects: { destructive: true } }),
    ]);

    // The hook is optional, and its absence must not swallow the record. A
    // console-only implementation would satisfy "reports itself" in appearance
    // while leaving nothing for a consumer's CI to read.
    expect(catalog.entries).toHaveLength(1);
    expect(catalog.diagnostics).toHaveLength(1);
    expect(catalog.diagnostics[0].code).toBe("destructive_without_consent");
  });

  it("C12 — the default sink actually reaches the host console", () => {
    // 03-CONTEXT locks "additionally emit a default warning". Before this case,
    // deleting the `warnHost(...)` call from the default sink was invisible to
    // every case in this suite, every other suite, and every gate in the
    // repository — a control the phase CLAIMS to have that does not fire.
    //
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
    //
    // The mutant that proves this case fires, written down because the obvious
    // spelling of it does NOT work and the failure looks like a pass. Replacing
    // the literal `warnHost(` with `void (` in `src/catalog.ts` turns the call
    // into `void (…,)` — the sink's argument list ends in a trailing comma, and
    // a PARENTHESIZED expression may not, so rolldown fails with a PARSE_ERROR
    // at `catalog.ts:503`. The harness then reports `PASS: gate fired (exit 1)`
    // having never run a single test: the mutant proves the BUILD rejects a
    // syntax error, which was never in question. Two forms measured to fire on
    // this case with the build green, either of which is a real proof:
    //
    //     src/catalog.ts   `warnHost(`                    -> `String(`
    //     src/host.ts      `host.console?.warn(message);` -> `void message;`
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

    // The deliberate NON-assertion that survives, written down rather than
    // written as a vacuously-passing check (the precedent is Trap 2 in
    // `export-surface.test.ts:31-46`): nothing here asserts what a host DOES
    // with the message, nor that a host with no `console` behaves any
    // particular way. Core reaches `globalThis.console?.warn` structurally and
    // a host with no console is a SUPPORTED host — `host.ts` says so — so
    // there is no behaviour there to pin.
  });
});

describe("SEC-01 — redaction fails closed, in both branches", () => {
  it("C13 — a NON-EMPTY schema with no redact throws redaction_missing naming the action", () => {
    expect(() => buildCatalog([declare("applyFilter", zodObject)])).toThrow(
      CatalogValidationError,
    );

    const error = catchBuild([declare("applyFilter", zodObject)]);

    expect(error.issues).toHaveLength(1);
    expect(error.issues[0].code).toBe("redaction_missing");
    expect(error.issues[0].action).toBe("applyFilter");
  });

  it("C14 — both EMPTY shapes resolve to drop, and the two vendors spell emptiness differently", () => {
    const catalog = buildCatalog([
      declare("emptyZod", zodEmptyObject),
      declare("emptyArk", arktypeEmptyObject),
    ]);

    // No issue, no diagnostic: there are no arguments to leak, so failing the
    // build would be pure noise on the commonest declaration there is.
    expect(catalog.diagnostics).toHaveLength(0);
    expect(catalog.entries[0].action.redact).toBe("drop");
    expect(catalog.entries[1].action.redact).toBe("drop");

    // MEASURED, and the reason "absent `properties`" means nothing on its own:
    // zod spells "no members" as `properties: {}` while arktype omits the key
    // entirely. Both are perfectly valid object roots.
    expect(Object.hasOwn(catalog.entries[0].parameters, "properties")).toBe(true);
    expect(Object.keys(catalog.entries[0].parameters.properties)).toHaveLength(0);
    expect(Object.hasOwn(catalog.entries[1].parameters, "properties")).toBe(false);

    // MEASURED: `additionalProperties` is ABSENT on both. This is what settles
    // 03-03's condition 4 as "present AND not false" rather than the shorter
    // `additionalProperties !== false` — the short form reads an absent key as
    // `undefined`, which is not `false`, and would turn both of these into
    // build failures.
    expect(Object.hasOwn(catalog.entries[0].parameters, "additionalProperties")).toBe(false);
    expect(Object.hasOwn(catalog.entries[1].parameters, "additionalProperties")).toBe(false);
  });

  it("C15 — a RECORD-shaped schema with no redact FAILS rather than defaulting to drop", () => {
    // The case the obvious emptiness test gets wrong. `z.record(z.string(),
    // z.string())` emits `{$schema, type:"object", propertyNames,
    // additionalProperties}` with NO `properties` key — so under a naive
    // `Object.keys(properties ?? {}).length > 0` test it is classified EMPTY
    // and silently resolved to `"drop"`. That fails closed against leaks, which
    // is exactly why it is easy to miss, but it leaves SEC-01's "required at
    // declaration time" clause unenforced on the single most redaction-
    // sensitive shape there is: one accepting arbitrary caller-supplied KEYS
    // and arbitrary VALUES, with the author never asked. This case is that
    // rule's only detector.
    expect(() => buildCatalog([declare("recordish", zodRecord)])).toThrow(
      CatalogValidationError,
    );

    const error = catchBuild([declare("recordish", zodRecord)]);
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0].code).toBe("redaction_missing");
    expect(error.issues[0].action).toBe("recordish");

    // And the measured reason it fires, so that the rule cannot degenerate into
    // "everything is non-empty" without this assertion noticing. Built with a
    // policy this time, purely to get at the emitted shape.
    const catalog = buildCatalog([declare("recordish", zodRecord, { redact: "drop" })]);
    const parameters = catalog.entries[0].parameters;

    expect(Object.hasOwn(parameters, "properties")).toBe(false);
    expect(Object.hasOwn(parameters, "propertyNames")).toBe(true);
    expect(Object.hasOwn(parameters, "additionalProperties")).toBe(true);

    // MEASURED: an OBJECT, not a boolean. `JsonSchemaObject.additionalProperties`
    // is declared `boolean` in the source types, so the declaration is narrower
    // than reality and `catalog.ts` reads all four keys through an untyped view.
    // Recorded here because a future reader tightening that read would
    // otherwise have only the declaration to go on.
    expect(typeof parameters.additionalProperties).toBe("object");
  });

  it("C16 — a declared \"passthrough\" survives untouched", () => {
    const catalog = buildCatalog([
      declare("applyFilter", zodObject, { redact: "passthrough" }),
    ]);

    // The default is fail-closed; it is not a rewrite of what the author chose.
    // A resolution step that clamped every policy to `"drop"` would satisfy
    // ROADMAP SC-4 and silently break every action whose arguments are
    // deliberately recorded.
    expect(catalog.entries[0].action.redact).toBe("passthrough");
  });
});

describe("CAT-03 — a consent policy naming an action that does not exist fails the build", () => {
  // ISSUE ORDERING, and it is a constraint on every case below rather than a
  // note. CAT-03's issues are produced by a POST-PASS that runs after the
  // per-action loop has finished, so they append AFTER every per-action issue
  // rather than interleaving in declaration order. Restoring declaration order
  // would mean carrying an origin index on every issue — new structure for
  // cosmetic gain, and rejected. So C26 asserts a SET of codes and never a
  // position, and a case added here later must not assume interleaving either.
  //
  // The post-pass is also why C25 exists at all: see defect 4 in this file's
  // header. Nothing else in this repository can tell the two placements apart.

  it("C23 — a typo'd `requires` throws, and the issue names the referrer AND the target", () => {
    // `review` exists; `reveiw` does not. That one transposition is the whole
    // input, and it is the realistic shape of this defect — a consent gate that
    // silently can never arm, on an action whose declaration looks correct.
    function typoDeclarations() {
      return [
        declare("review", zodObject, { redact: "drop" }),
        declare("confirm", zodObject, {
          redact: "drop",
          consent: { requires: "reveiw" },
        }),
      ];
    }

    expect(() => buildCatalog(typoDeclarations())).toThrow(CatalogValidationError);

    const error = catchBuild(typoDeclarations());

    expect(error.issues).toHaveLength(1);
    expect(error.issues[0].code).toBe("consent_target_missing");

    // Two separate assertions, and both are required by ROADMAP SC-4: the
    // message must name the referring action AND the missing target. They are
    // separate because they live in different channels — the referrer is a
    // structured FIELD, the target is interpolated into `problem` — and because
    // `issues.map(i => i.action)` is an assertion while `message.includes(name)`
    // is a guess that passes on a message which happens to contain the word and
    // fails on a legitimate rewording.
    //
    // `.action` is the REFERRER, not the target. That direction is the claim: an
    // implementation reporting the missing name in `.action` would send the
    // developer to grep for an action that by definition does not exist.
    expect(error.issues[0].action).toBe("confirm");
    expect(error.issues[0].problem).toContain("reveiw");

    // The mirror of C24's negative, and the pair is the mutual-exclusivity
    // claim written where each half of it can be read: a missing target is not
    // a self-reference, and a self-reference is not a missing target. Stated as
    // a claim rather than left implied by the length assertion above, so that a
    // reader of this case alone knows the two codes are designed never to
    // co-fire for one action — 04-02 chose two codes over one reuse precisely
    // because their `fix` sentences differ, and a later "simplification" back to
    // one code is the mutation the pair exists to make loud.
    expect(error.issues.map((issue) => issue.code)).not.toContain(
      "consent_self_reference",
    );
  });

  it("C24 — a self-reference reports its OWN code, and demonstrably not the other one", () => {
    function selfReferentialDeclaration() {
      return [
        declare("confirm", zodObject, {
          redact: "drop",
          consent: { requires: "confirm" },
        }),
      ];
    }

    expect(() => buildCatalog(selfReferentialDeclaration())).toThrow(
      CatalogValidationError,
    );

    const error = catchBuild(selfReferentialDeclaration());

    expect(error.issues).toHaveLength(1);
    expect(error.issues[0].code).toBe("consent_self_reference");

    // The deliberate negative, asserted as a positive claim — the same register
    // C22 uses.
    //
    // **What this line does and does not detect, MEASURED rather than assumed.**
    // The source tests self-reference first and `else if`s on missing, and the
    // obvious guess is that this line is that ordering's detector. It is not:
    // the two branches were physically swapped in `src/catalog.ts`, rebuilt, and
    // the whole catalog suite stayed green at 26/26. The reason is the post-pass
    // itself — by the time it runs, a self-referencing action's own name is
    // always in the name set, so `!seenNames.has(requires)` is false for it
    // under either ordering and both spellings reach the same branch. The
    // `else if` makes the exclusivity structural, but it is not what produces
    // it; running after the loop is.
    //
    // So this line is expressive rather than discriminating: the length
    // assertion above already rules out both codes firing, and the positive
    // above already rules out the wrong one firing alone. It is kept because the
    // exclusivity is a designed property and a designed property should be
    // stated where it can be read, not inferred from a count — and because it
    // outlives any later relaxation of that count. Recorded plainly instead of
    // claimed loudly, because a comment that overclaims what a test catches is
    // the defect this repository has already spent a plan removing.
    expect(error.issues.map((issue) => issue.code)).not.toContain(
      "consent_target_missing",
    );
  });

  it("C25 — a FORWARD reference builds clean, so the check reads the COMPLETE name set", () => {
    // Declaration order is the entire input: the referrer comes FIRST and its
    // target SECOND. Under an in-loop check `review` has not been added to the
    // name set when `confirm` is examined, so this legitimate catalog fails the
    // build with `consent_target_missing` — measured, and the reason the rule is
    // a post-pass. See defect 4 in this file's header.
    //
    // This is also the general case of the cross-stage one: `createConcierge`
    // assembles its argument as stage actions followed by cross-stage actions,
    // so EVERY consent policy pointing at a cross-stage action is a forward
    // reference. That half belongs in `test/concierge.test.ts` rather than here,
    // because only `createConcierge` produces the append-last ordering; this
    // case is the same property at the level `buildCatalog` can be asked about.
    function forwardReferenceDeclarations() {
      return [
        declare("confirm", zodObject, {
          redact: "drop",
          consent: { requires: "review" },
        }),
        declare("review", zodObject, { redact: "drop" }),
      ];
    }

    expect(() => buildCatalog(forwardReferenceDeclarations())).not.toThrow();

    // And something POSITIVE about the result. "Did not throw" is satisfied by a
    // `buildCatalog` that was never called, by one that returned early, and by
    // one whose rule was deleted outright; asserting the derived names in
    // declaration order means the build actually ran and produced this catalog.
    const catalog = buildCatalog(forwardReferenceDeclarations());
    expect(catalog.names).toEqual(["confirm", "review"]);
    expect(catalog.entries).toHaveLength(2);

    // The consent policy survives onto the entry unchanged, which is what makes
    // "clean" mean "accepted" rather than "quietly stripped". A build that
    // deleted the policy would also not throw.
    expect(catalog.byName["confirm"].action.consent.requires).toBe("review");
  });

  it("C26 — a consent typo alongside three other faults throws ONCE, with four issues", () => {
    // Four distinct faults across four declarations, modelled on the DX-03
    // block's `fourBadDeclarations` — a fixture FUNCTION returning a fresh array
    // per call, because the `toThrow` assertion and `catchBuild` each build once
    // and a shared array would be handed to `buildCatalog` twice.
    //
    // The consent fault is declared FIRST on purpose. Its issue is produced last
    // regardless, by the post-pass, so declaration order and issue order come
    // apart here — which is what makes the set-based assertion below load-
    // bearing instead of accidentally equivalent to a positional one.
    function fourFaultsIncludingAConsentTypo() {
      return [
        declare("confirm", zodObject, {
          redact: "drop",
          consent: { requires: "reveiw" },
        }),
        declare("stringRoot", zodStringRoot, { redact: "drop" }),
        declare("noHatch", valibotObject, { redact: "drop" }),
        declare("unredacted", zodObject),
      ];
    }

    expect(() => buildCatalog(fourFaultsIncludingAConsentTypo())).toThrow(
      CatalogValidationError,
    );

    const error = catchBuild(fourFaultsIncludingAConsentTypo());

    // The number is the requirement, and it is asserted before anything about
    // contents for the reason C4 states: a `buildCatalog` that short-circuits on
    // the first fault throws an error carrying ONE issue and is otherwise
    // indistinguishable from this one. The CAT-03 addition makes that assertion
    // say something new — the post-pass runs between the loop and the throw, so
    // an implementation that threw as soon as the loop produced its first issue
    // would never reach the consent rule at all.
    expect(error.issues).toHaveLength(4);

    // A SET, not a sequence. CAT-03's issue appends after every per-action issue
    // rather than interleaving in declaration order, so a positional assertion
    // here would encode an ordering the post-pass deliberately does not produce
    // — and would have to be rewritten by whoever next changes where the pass
    // sits, for no gain.
    expect(new Set(error.issues.map((issue) => issue.code))).toEqual(
      new Set([
        "consent_target_missing",
        "schema_root_not_object",
        "schema_not_emittable",
        "redaction_missing",
      ]),
    );

    // Four DISTINCT names, so an aggregated summary line ("3 actions have
    // problems") could not satisfy this.
    expect(new Set(error.issues.map((issue) => issue.action))).toEqual(
      new Set(["confirm", "stringRoot", "noHatch", "unredacted"]),
    );
    expect(new Set(error.issues.map((issue) => issue.action)).size).toBe(4);
  });
});

describe("SEC-03 — the built catalog cannot be tampered with", () => {
  // One catalog, built per test through `beforeEach`-clean state, carrying a
  // nested `effects` object and a handler whose identity is checkable.
  function tamperTarget() {
    return buildCatalog([
      declare("applyFilter", zodObject, {
        redact: "drop",
        effects: { destructive: false },
      }),
      declare("openItem", zodObject, { redact: "drop" }),
    ]);
  }

  it("C17 — the catalog, its entries array, each entry and each action are all frozen", () => {
    const catalog = tamperTarget();

    // The FIRST of these four passes on the breached shallow form — measured,
    // `Object.isFrozen(catalog)` returned `true` while the entries beneath it
    // stayed mutable. It is asserted anyway, but only the three beneath it can
    // tell the two builds apart, and only C18 can tell them apart by
    // consequence rather than by report.
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.entries)).toBe(true);
    expect(Object.isFrozen(catalog.entries[0])).toBe(true);
    expect(Object.isFrozen(catalog.entries[0].action)).toBe(true);
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

  it("C19 — replacing an entry through byName fails, and the lookup still resolves to the original", () => {
    const catalog = tamperTarget();
    const original = catalog.byName["applyFilter"];
    const evilEntry = { action: declare("applyFilter", zodObject), parameters: {} };

    // This is the case a `Map`-based lookup would FAIL. `Object.freeze` seals a
    // Map's own properties and does nothing whatsoever to its internal
    // `[[MapData]]` slot, so `frozenMap.set(name, evilEntry)` succeeds — page
    // script could replace an entry THROUGH the lookup with the entries array
    // itself correctly frozen. A plain record's properties are exactly what
    // `Object.freeze` does seal.
    expect(() => {
      catalog.byName["applyFilter"] = evilEntry;
    }).toThrow(TypeError);
    expect(catalog.byName["applyFilter"]).toBe(original);
    expect(catalog.byName["applyFilter"]).not.toBe(evilEntry);
  });

  it("C20 — byName has a null prototype, so __proto__ and constructor are ordinary absent keys", () => {
    const catalog = tamperTarget();

    // The same protection ROADMAP Phase 6 reaches for when it says handler
    // lookup must not be a bare object literal because `dispatch("__proto__")`
    // and `dispatch("constructor")` are test cases. With no prototype chain
    // there is nothing for either name to resolve to.
    expect(Object.getPrototypeOf(catalog.byName)).toBe(null);
    expect(catalog.byName["__proto__"]).toBeUndefined();
    expect(catalog.byName["constructor"]).toBeUndefined();
  });

  it("C21 — a nested effects object cannot be mutated", () => {
    const catalog = tamperTarget();

    // The freeze is RECURSIVE, so it reaches objects the spread copied by
    // reference rather than flattened. `effects.destructive` flipping to
    // `false` after the build would silence the CAT-05 diagnostic for every
    // consumer reading the catalog rather than the declaration.
    expect(Object.isFrozen(catalog.entries[0].action.effects)).toBe(true);
    expect(() => {
      catalog.entries[0].action.effects.destructive = true;
    }).toThrow(TypeError);
    expect(catalog.entries[0].action.effects.destructive).toBe(false);
  });

  it("C22 — the validator instance is NOT frozen, and still validates and still re-emits", () => {
    const catalog = tamperTarget();
    const schema = catalog.entries[0].action.schema;

    // Pins the deliberate `skip` in `deepFreeze`. SEC-03 names the HANDLER, not
    // the validator, and freezing a third-party library's internals is untested
    // and not obviously safe. Asserted as a positive claim so that "freeze
    // everything" cannot be adopted later as an obvious tightening.
    expect(Object.isFrozen(schema)).toBe(false);

    // ...and the two things that would break if it were frozen anyway.
    expect(schema.safeParse({ key: "a", value: "b" }).success).toBe(true);
    const reEmitted = schema["~standard"].jsonSchema.input({
      target: "draft-2020-12",
    });
    expect(reEmitted.type).toBe("object");
  });
});
