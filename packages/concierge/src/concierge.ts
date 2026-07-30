/**
 * `createConcierge` — catalog assembly, stage resolution, the memoized
 * per-stage projection, `explain`, and the Phase 6 dispatch stub (STG-01,
 * STG-02, STG-03, STG-04, SEC-03, DX-01, CAT-01).
 *
 * A separate module from `./catalog.ts`, deliberately. That file's header
 * states that every catalog rule lives there, so "did we check X?" is a
 * one-file question; stage resolution is not a catalog rule, and folding it in
 * would dilute the one property that claim exists to buy. What lives here is
 * the layer above: many stages become one flat catalog, and that one catalog
 * becomes many per-stage projections of itself.
 *
 * ---------------------------------------------------------------------------
 * Three constraints whose violation is SILENT
 * ---------------------------------------------------------------------------
 *
 * **1. The catalog memo is instance-local and lazily allocated, and the reason
 * is cross-request state pollution under SSR.** Application modules are
 * initialised once when a long-lived server boots, and the same module
 * instances are then reused for every request that process serves.
 * `.planning/research/ARCHITECTURE.md:380-405` quotes Vue's own definition of
 * that failure and cites TanStack Router shipping exactly this bug, where one
 * request's leaked state made every subsequent GET return a 307 until the
 * process was restarted. A module-scope catalog memo would be shared by every
 * `createConcierge` in the process, so two configs in one server would serve
 * each other's catalogs under colliding keys. Both mutable structures in this
 * file are therefore `let`s inside the factory body, `null` until first use;
 * module scope holds two immutable constants and nothing else.
 *
 * An earlier draft justified the same rule on bundler grounds instead — that a
 * module-scope structure is elided from a consumer build. Re-measured under
 * rolldown 1.2.0, it does **not** reproduce: a module-scope `Map` read by an
 * exported function is retained, and behaves identically bundled and
 * unbundled. The rule survived its justification being wrong, which is exactly
 * why the justification is written down rather than assumed.
 *
 * **2. The shallow seal on a projection is complete ONLY because its elements
 * are shared and already deep-frozen, and the two decisions are coupled.** One
 * `EmittedTool` per action is built once during assembly, and every per-stage
 * array holds those same objects by reference. Building fresh elements per
 * projection would turn the cheap seal into `./catalog.ts`'s
 * breach-that-reports-success: `Object.isFrozen(projection)` returns `true`
 * while every element stays mutable. Measured this phase — under the
 * shared-and-already-frozen form all seven tamper vectors throw, and it is
 * 510× cheaper than a recursive walk per projection (0.0074 ms against 3.78 ms
 * for 40 projections), because `deepFreeze` deliberately has no
 * `Object.isFrozen` early-out and re-walks every already-frozen JSON Schema
 * subtree beneath it.
 *
 * **3. `stage.match` is called from exactly one place.** Every additional call
 * site is a second copy of the throw policy, a second copy of the non-boolean
 * policy and a second warn-once latch — and a second opportunity for `explain`
 * and `stageFor` to disagree about the same context.
 *
 * Like `./types.ts`, `./contract.ts`, `./json-schema.ts`, `./host.ts` and
 * `./catalog.ts`, this file has no runtime dependency, no framework reference
 * and no DOM access — it must construct on a server under Next App Router,
 * Nuxt or SvelteKit with no environment guards.
 */

import { buildCatalog, deepFreeze } from "./catalog.js";
import { warnHost } from "./host.js";
import type { Catalog } from "./catalog.js";
import type {
  ActionResult,
  Concierge,
  ConciergeConfig,
  EmittedTool,
  Explanation,
  InvocationMeta,
  StageContext,
  StageExplanation,
} from "./types.js";

// ---------------------------------------------------------------------------
// Module scope — immutable constants only
// ---------------------------------------------------------------------------

// ANCHOR(T2): NO_SKIP is never written, so constraint 1's SSR argument does not reach it; plus the purity annotation and 03-08's dead-bytes finding
const NO_SKIP: ReadonlySet<object> = /* @__PURE__ */ new Set<object>();

// ANCHOR(T2): reason omitted — closed twelve-member union; rejected not_implemented; the Phase 6 hand-off
const DISPATCH_NOT_IMPLEMENTED: ActionResult = /* @__PURE__ */ Object.freeze({
  ok: false,
  message:
    "concierge: dispatch is not implemented in this build, which ships catalog assembly and stage scoping only.",
});

// ---------------------------------------------------------------------------
// Module-private helpers
// ---------------------------------------------------------------------------

// ANCHOR(T2): the message lives behind a named function so its single call site is one literal; why the scan uses TWO sets rather than one; and that catalog scoping is unaffected because the per-stage catalog is keyed by declaration order rather than by id
function duplicateStageIdMessage(id: string): string {
  return (
    `concierge: [duplicate_stage_id] stage "${id}": two stages declare this id, and ` +
    `\`stageFor()\`, \`Session.stage()\` and \`explain()\` all report it, so the two are ` +
    `indistinguishable to a developer reading any of them. Catalog scoping is unaffected — ` +
    `the per-stage catalog is keyed by declaration order, not by id. ` +
    `Fix: give each stage a distinct id.`
  );
}

// ANCHOR(T2): the three bridge states, why the shape survives Phase 5 unchanged, and the rejected alternative of warning on a throwing read()
function bridgeStatus(
  stage: ConciergeConfig["stages"][number],
): StageExplanation["bridge"] {
  const registry: ConciergeConfig["stages"][number]["bridge"] = stage.bridge;
  if (registry === undefined) {
    return null;
  }

  let live: unknown;
  try {
    live = registry.read();
  } catch {
    live = null;
  }

  return { id: registry.id, registered: live !== null && live !== undefined };
}

// ---------------------------------------------------------------------------
// The factory
// ---------------------------------------------------------------------------

// ANCHOR(T2): CAT-01's name-union erasure stops at the config boundary and that is correct — measured three ways; the cause is the config's own erasure, not flatMap; nothing downstream consumes the union; the const-type-parameter recovery is measured and deliberately not taken
export function createConcierge(config: ConciergeConfig): Concierge {
  const stages: ConciergeConfig["stages"] = config.stages;
  const crossStage: NonNullable<ConciergeConfig["crossStage"]> = config.crossStage ?? [];

  // ANCHOR(T2): one flat buildCatalog; the per-stage view is a projection of that one catalog; a duplicate action name across two stages is rejected globally with no new code
  const catalog: Catalog = buildCatalog([...stages.flatMap((stage) => stage.actions), ...crossStage]);

  // ANCHOR(T2): parameters is assigned BY REFERENCE and never re-emitted, citing Catalog.byName; and the four-seal uniqueness constraint this file's mutation battery depends on
  const toolByName: Record<string, EmittedTool> = Object.create(null);
  for (const entry of catalog.entries) {
    const tool: EmittedTool = {
      type: "function",
      name: entry.action.name,
      description: entry.action.description,
      parameters: entry.parameters,
    };
    toolByName[entry.action.name] = Object.freeze(tool);
  }
  Object.freeze(toolByName);

  const crossNames: readonly string[] = crossStage.map((action) => action.name);

  // ANCHOR(T2): namesByStage is INDEXED and never keyed by id; the measured collapse; both rejected remedies
  const namesByStage: ReadonlyArray<readonly string[]> = stages.map((stage) => [...stage.actions.map((action) => action.name), ...crossNames]);

  const seenStageIds: Set<string> = new Set<string>();
  const reportedStageIds: Set<string> = new Set<string>();
  for (const stage of stages) {
    if (seenStageIds.has(stage.id) && !reportedStageIds.has(stage.id)) {
      reportedStageIds.add(stage.id);
      warnHost(duplicateStageIdMessage(stage.id));
    }
    seenStageIds.add(stage.id);
  }

  // ANCHOR(T2): a Map rather than a null-prototype record, because the key type is number | null; the String(null) collision; cite catalog.ts:260-268 for why a Map is right precisely because this structure is never frozen
  let memo: Map<number | null, ReadonlyArray<EmittedTool>> | null = null;
  let warnedStages: Set<string> | null = null;

  // ANCHOR(T2): warnStage returns the literal type false, which is what makes the warn-and-skip decision one statement at both call sites and each call site a single-literal mutation target
  function warnStage(id: string, problem: string, fix: string): false {
    warnedStages ??= new Set<string>();
    if (warnedStages.has(id)) {
      return false;
    }
    warnedStages.add(id);
    warnHost(`concierge: [stage_match] stage "${id}": ${problem} Fix: ${fix}`);
    return false;
  }

  function runMatch(stage: ConciergeConfig["stages"][number], ctx: StageContext): boolean {
    let result: unknown;
    // ANCHOR(T2): a bare catch with no binding; the decision inverted relative to json-schema.ts's two build-time catches; the covert-channel reason
    try {
      result = stage.match(ctx);
    } catch {
      return warnStage(stage.id, "its `match(ctx)` threw, so the stage was skipped and its actions are absent from the catalog for this context.", "make `match` total — it runs on every navigation, so it must not assume any field of `ctx` is present.");
    }

    // ANCHOR(T2): strict equality over truthiness; the measured probe; P14's first-run experience; both rejected alternatives
    if (result === true) {
      return true;
    }
    if (result !== false) {
      return warnStage(stage.id, "its `match(ctx)` returned a value that is neither `true` nor `false`, and a non-boolean is treated here as no match at all.", "return a real boolean — a truthy object does not match, deliberately, so compare explicitly rather than returning the value you tested.");
    }
    return false;
  }

  // ANCHOR(T2): stageFor is NOT memoized and why; the ordered array rather than a keyed object; the measured key-ordering result
  function resolveIndex(ctx: StageContext): number | null {
    for (const [index, stage] of stages.entries()) {
      if (runMatch(stage, ctx)) {
        return index;
      }
    }
    return null;
  }

  // ANCHOR(T2): the no-stage branch returns the cross-stage actions rather than an empty array; the rejected fail-closed alternative; and that the situation is not hidden
  function projectFor(index: number | null): ReadonlyArray<EmittedTool> {
    memo ??= new Map<number | null, ReadonlyArray<EmittedTool>>();

    const hit: ReadonlyArray<EmittedTool> | undefined = memo.get(index);
    if (hit !== undefined) {
      return hit;
    }

    const names: readonly string[] = index === null ? crossNames : (namesByStage[index] ?? crossNames);
    const projected: EmittedTool[] = names
      .map((name) => toolByName[name])
      .filter((tool): tool is EmittedTool => tool !== undefined);
    const built: ReadonlyArray<EmittedTool> = Object.freeze(projected);

    memo.set(index, built);
    return built;
  }

  function dispatch(
    _name: string,
    _args: unknown,
    _meta?: InvocationMeta,
  ): Promise<ActionResult> {
    return Promise.resolve(DISPATCH_NOT_IMPLEMENTED);
  }

  function catalogFor(ctx: StageContext): ReadonlyArray<EmittedTool> {
    return projectFor(resolveIndex(ctx));
  }

  function stageFor(ctx: StageContext): string | null {
    const index: number | null = resolveIndex(ctx);
    return index === null ? null : (stages[index]?.id ?? null);
  }

  // ANCHOR(T2): explain()'s deliberate non-identity — a fresh object every call by design, so nobody wires it into useSyncExternalStore and reproduces the exact infinite-render defect STG-04 exists to prevent
  function explain(ctx: StageContext): Explanation {
    // ANCHOR(T2): stages.map(...) and not a for…of — it evaluates every matcher exactly once and structurally cannot short-circuit, which is the property DX-01 needs
    const rows: StageExplanation[] = stages.map(
      (stage): StageExplanation => ({
        id: stage.id,
        matched: runMatch(stage, ctx),
        bridge: bridgeStatus(stage),
      }),
    );

    // ANCHOR(T2): firstMatch is derived from the recorded rows, not from a second matcher evaluation; the measured self-contradiction
    const firstMatch: number = rows.findIndex((row) => row.matched);
    const activeIndex: number | null = firstMatch === -1 ? null : firstMatch;

    // ANCHOR(T2): projectFor(activeIndex) and not catalogFor(ctx), so the reported catalog and the reported stage cannot disagree; and that explain writes nothing to the console
    return deepFreeze(
      {
        stage: activeIndex === null ? null : (stages[activeIndex]?.id ?? null),
        stages: rows,
        catalog: projectFor(activeIndex).map((tool) => tool.name),
      },
      NO_SKIP,
      new WeakSet<object>(),
    );
  }

  // ANCHOR(T2): the returned object is deliberately not frozen, and the reason carries no seal count
  return { dispatch, catalogFor, stageFor, explain };
}
