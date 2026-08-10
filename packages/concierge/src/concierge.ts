/**
 * `createConcierge` — catalog assembly, stage resolution, the memoized
 * per-stage projection, `explain`, and context-aware direct dispatch (STG-01,
 * STG-02, STG-03, STG-04, SEC-03, DX-01, CAT-01, DSP-01–05, DSP-08–09).
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
import { captureSnapshot } from "./bridge.js";
import {
  attachConsentProfile,
  consentGradeRank,
  snapshotConsentProfile,
} from "./consent-profile.js";
import {
  captureDigestCapability,
  digestReadback,
  prepareReadback,
  snapshotDeliveryEvidence,
  snapshotReadbackReceipt,
  verifyReadbackReceipt,
} from "./consent-evidence.js";
import {
  authoredResult,
  deriveDispatchKey,
  executeDispatchBatch,
  isAbortSignalLike,
  isAborted,
  normalizeActionResult,
  snapshotInvocationValue,
  validateArguments,
  waitForCommit,
} from "./dispatch.js";
import {
  encodeDiagnosticSubject,
  readHostScheduler,
  warnHost,
} from "./host.js";
import { USER_CANCELLED, USER_DECLINED } from "./types.js";
import type { ArgumentValidation, CommitWaitOutcome } from "./dispatch.js";
import type { InvocationValueSnapshot } from "./dispatch.js";
import type { Catalog, CatalogEntry } from "./catalog.js";
import type {
  DeliveryEvidenceSnapshot,
  PreparedReadback,
  PreparedReadbackResult,
  ReadbackReceiptSnapshotResult,
  VerifiedReadbackEvidence,
} from "./consent-evidence.js";
import type {
  ActionResult,
  AbortSignalLike,
  AnyActionDefinition,
  Bridge,
  Concierge,
  ConciergeConfig,
  ConsentAck,
  ConsentGrade,
  ConsentPolicy,
  ConsentProfile,
  DeliveryReport,
  EmittedTool,
  Explanation,
  InvocationMeta,
  Scheduler,
  StageContext,
  StageExplanation,
  ToolBatch,
} from "./types.js";

// ---------------------------------------------------------------------------
// Module scope — immutable constants only
// ---------------------------------------------------------------------------

/**
 * The `skip` set `explain()` hands to `deepFreeze`. Empty, because the object
 * `explain` returns contains no validator instances — only stage ids,
 * booleans, bridge ids and action names, all of them developer-authored
 * strings that are already in the config.
 *
 * **This sits at module scope and constraint 1 above does not reach it**, and
 * the distinction is worth stating because the two cases look alike from a
 * diff. Constraint 1 forbids module-scope *mutable* state: a memo is written,
 * so one shared across every request a server process handles is a real defect.
 * This set is never written by anything, so one copy shared by every instance
 * in the process is not a compromise — it is what should happen.
 *
 * The purity annotation on the constructor follows 03-08's finding that an
 * unannotated module-scope call retains dead bytes in every consumer bundle
 * even where nothing reads the result. It widens nothing: it is a hint to the
 * bundler about a call with no observable effect, not a claim about behaviour.
 */
const NO_SKIP: ReadonlySet<object> = /* @__PURE__ */ new Set<object>();

type InvocationMetaSnapshot =
  | { readonly ok: true; readonly value: InvocationMeta }
  | { readonly ok: false };

interface CapturedConsentConfiguration {
  readonly profile: ConsentProfile;
  readonly presentReadback: ConciergeConfig["presentReadback"];
  readonly digest: ConciergeConfig["digest"];
  readonly normalizeSnapshot: ConciergeConfig["normalizeSnapshot"];
}

interface ConsentGenerationBase {
  readonly confirmationUserTurnId: string | null;
  readonly generation: bigint;
  readonly payload: unknown;
  readonly preparedReadback: PreparedReadback | null;
  readonly readbackHash: string | null;
  readonly responseId: string;
  readonly snapshot: Readonly<Record<string, unknown>>;
  readonly userTurnId: string;
  readonly verifiedReadback: VerifiedReadbackEvidence | null;
}

type ConsentGeneration =
  | (ConsentGenerationBase & { readonly status: "reviewing" })
  | (ConsentGenerationBase & { readonly status: "pendingDelivery" })
  | (ConsentGenerationBase & {
      readonly achievedGrade: Exclude<ConsentGrade, "none">;
      readonly status: "armed";
    })
  | (ConsentGenerationBase & {
      readonly status: "declined" | "dismissed" | "gradeUnavailable";
    });

/** A consent grade represents measured evidence only when it is not `none`. */
function isMeasuredConsentGrade(
  achievedGrade: ConsentGrade,
): achievedGrade is Exclude<ConsentGrade, "none"> {
  return achievedGrade !== "none";
}

/** Delivery can prove at most relayed evidence, clipped by the captured ceiling. */
function relayedGradeWithin(ceiling: ConsentGrade): ConsentGrade {
  return consentGradeRank(ceiling) >= consentGradeRank("relayed")
    ? "relayed"
    : ceiling;
}

/** Clamp every runtime policy to the inherent delivered evidence floor. */
function effectiveConsentMinimum(requested: ConsentGrade | undefined): ConsentGrade {
  const declared: ConsentGrade = requested ?? "delivered";
  return consentGradeRank(declared) < consentGradeRank("delivered")
    ? "delivered"
    : declared;
}

/** Whether confirm belongs to a real boundary after the stored review. */
function hasFreshConsentBoundary(
  policy: ConsentPolicy<unknown>,
  review: ConsentGenerationBase,
  confirm: InvocationMeta,
  profile: ConsentProfile,
): boolean {
  const confirmTurnId: string = confirm.userTurnId ?? "";
  if (
    review.confirmationUserTurnId !== null &&
    (profile.userTurnIdentity !== "human-attested" ||
      confirmTurnId !== review.confirmationUserTurnId)
  ) {
    return false;
  }

  if (policy.bindTo === "userTurn") {
    return profile.userTurnIdentity === "human-attested" &&
      review.userTurnId.length > 0 &&
      confirmTurnId.length > 0 &&
      review.userTurnId !== confirmTurnId;
  }

  if (policy.bindTo !== "response") {
    return false;
  }

  const confirmResponseId: string = confirm.responseId ?? "";
  return review.responseId.length > 0 &&
    confirmResponseId.length > 0 &&
    review.responseId !== confirmResponseId;
}

/**
 * Strict graph comparison for values produced by snapshot normalization.
 * Unsupported exotic leaves compare only by identity through the Object.is arm.
 */
function strictSnapshotEquality(left: unknown, right: unknown): boolean {
  return compareSnapshotValues(
    left,
    right,
    new WeakMap<object, object>(),
    new WeakMap<object, object>(),
  );
}

function compareSnapshotValues(
  left: unknown,
  right: unknown,
  leftToRight: WeakMap<object, object>,
  rightToLeft: WeakMap<object, object>,
): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return false;
  }

  if (leftToRight.has(left) || rightToLeft.has(right)) {
    return leftToRight.get(left) === right && rightToLeft.get(right) === left;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    leftToRight.set(left, right);
    rightToLeft.set(right, left);
    for (let index = 0; index < left.length; index += 1) {
      if ((index in left) !== (index in right)) {
        return false;
      }
      if (
        index in left &&
        !compareSnapshotValues(
          left[index],
          right[index],
          leftToRight,
          rightToLeft,
        )
      ) {
        return false;
      }
    }
    return true;
  }

  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date &&
      right instanceof Date &&
      Object.is(left.getTime(), right.getTime());
  }

  if (left instanceof Map || right instanceof Map) {
    if (!(left instanceof Map) || !(right instanceof Map) || left.size !== right.size) {
      return false;
    }
    leftToRight.set(left, right);
    rightToLeft.set(right, left);
    const rightEntries = right.entries();
    for (const [leftKey, leftValue] of left) {
      const rightEntry = rightEntries.next();
      if (
        rightEntry.done ||
        !compareSnapshotValues(
          leftKey,
          rightEntry.value[0],
          leftToRight,
          rightToLeft,
        ) ||
        !compareSnapshotValues(
          leftValue,
          rightEntry.value[1],
          leftToRight,
          rightToLeft,
        )
      ) {
        return false;
      }
    }
    return rightEntries.next().done === true;
  }

  if (left instanceof Set || right instanceof Set) {
    if (!(left instanceof Set) || !(right instanceof Set) || left.size !== right.size) {
      return false;
    }
    leftToRight.set(left, right);
    rightToLeft.set(right, left);
    const rightValues = right.values();
    for (const leftValue of left) {
      const rightValue = rightValues.next();
      if (
        rightValue.done ||
        !compareSnapshotValues(
          leftValue,
          rightValue.value,
          leftToRight,
          rightToLeft,
        )
      ) {
        return false;
      }
    }
    return rightValues.next().done === true;
  }

  const leftPrototype: object | null = Object.getPrototypeOf(left);
  const rightPrototype: object | null = Object.getPrototypeOf(right);
  const leftIsRecord: boolean =
    leftPrototype === null || leftPrototype === Object.prototype;
  const rightIsRecord: boolean =
    rightPrototype === null || rightPrototype === Object.prototype;
  if (!leftIsRecord || !rightIsRecord || leftPrototype !== rightPrototype) {
    return false;
  }

  const leftKeys: readonly string[] = Object.keys(left);
  const rightKeys: readonly string[] = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  leftToRight.set(left, right);
  rightToLeft.set(right, left);
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  for (const key of leftKeys) {
    if (
      !Object.hasOwn(rightRecord, key) ||
      !compareSnapshotValues(
        leftRecord[key],
        rightRecord[key],
        leftToRight,
        rightToLeft,
      )
    ) {
      return false;
    }
  }
  return true;
}

/** Read every consent-related config seam once at the factory boundary. */
function captureConsentConfiguration(
  config: ConciergeConfig,
): CapturedConsentConfiguration {
  let rawProfile: unknown;
  try {
    rawProfile = config.consentProfile;
  } catch {
    rawProfile = null;
  }

  const profile: ConsentProfile = snapshotConsentProfile(rawProfile);
  try {
    const presentReadback: ConciergeConfig["presentReadback"] =
      config.presentReadback;
    const digest: ConciergeConfig["digest"] = captureDigestCapability(
      config.digest,
    );
    const normalizeSnapshot: ConciergeConfig["normalizeSnapshot"] =
      config.normalizeSnapshot;
    return Object.freeze({
      profile,
      presentReadback,
      digest,
      normalizeSnapshot,
    });
  } catch {
    throw new TypeError(
      "Invalid Concierge configuration: consent evidence capabilities could not be read.",
    );
  }
}

/** Copy every public metadata field once, before any asynchronous work begins. */
function snapshotInvocationMeta(
  meta: InvocationMeta | undefined,
): InvocationMetaSnapshot {
  if (meta === undefined) {
    return { ok: true, value: Object.freeze({}) };
  }
  if (typeof meta !== "object" || meta === null) {
    return { ok: false };
  }

  try {
    const responseId: unknown = meta.responseId;
    const userTurnId: unknown = meta.userTurnId;
    const callId: unknown = meta.callId;
    const outputIndex: unknown = meta.outputIndex;
    const signal: InvocationMeta["signal"] = meta.signal;
    const deferUntilDelivered: InvocationMeta["deferUntilDelivered"] =
      meta.deferUntilDelivered;

    if (
      (responseId !== undefined && typeof responseId !== "string") ||
      (userTurnId !== undefined && typeof userTurnId !== "string") ||
      (callId !== undefined && typeof callId !== "string") ||
      (outputIndex !== undefined &&
        (typeof outputIndex !== "number" || !Number.isFinite(outputIndex))) ||
      (signal !== undefined && !isAbortSignalLike(signal)) ||
      (deferUntilDelivered !== undefined &&
        typeof deferUntilDelivered !== "function")
    ) {
      return { ok: false };
    }

    return {
      ok: true,
      value: Object.freeze({
        responseId,
        userTurnId,
        callId,
        outputIndex,
        signal,
        deferUntilDelivered,
      }),
    };
  } catch {
    return { ok: false };
  }
}

/** Convert a consent declaration and its authored fallback into fixed data. */
function snapshotConsentPolicy(
  policy: NonNullable<AnyActionDefinition["consent"]>,
): NonNullable<AnyActionDefinition["consent"]> {
  const snapshotEquality = policy.snapshotEquality;
  const minGrade: ConsentGrade | undefined = policy.minGrade;
  const declaredMissing = policy.onMissing;
  const onMissing = declaredMissing === undefined
    ? undefined
    : Object.freeze(
        declaredMissing.reason === undefined
          ? { message: declaredMissing.message }
          : {
              message: declaredMissing.message,
              reason: declaredMissing.reason,
            },
      );

  return Object.freeze({
    requires: policy.requires,
    bindTo: policy.bindTo,
    ...(snapshotEquality === undefined ? {} : { snapshotEquality }),
    ...(minGrade === undefined ? {} : { minGrade }),
    ...(onMissing === undefined ? {} : { onMissing }),
  });
}

/** Convert mutable effect hints and action accessors into fixed data properties. */
function snapshotAction(action: AnyActionDefinition): AnyActionDefinition {
  try {
    let snapshot: AnyActionDefinition = { ...action };
    if (snapshot.effects !== undefined) {
      snapshot = {
        ...snapshot,
        effects: Object.freeze({
          readOnly: snapshot.effects.readOnly === true,
          destructive: snapshot.effects.destructive === true,
          idempotent: snapshot.effects.idempotent === true,
        }),
      };
    }
    if (snapshot.consent !== undefined) {
      snapshot = {
        ...snapshot,
        consent: snapshotConsentPolicy(snapshot.consent),
      };
    }
    return snapshot;
  } catch {
    throw new TypeError(
      "Invalid Concierge configuration: an action's effects could not be read.",
    );
  }
}

/** Reject timer values whose host coercion would silently change gate semantics. */
function validateWindowMs(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(
      `Invalid Concierge configuration: ${field} must be a finite, non-negative number.`,
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Module-private helpers
// ---------------------------------------------------------------------------

/**
 * The warning two stages sharing one id earn, in the house message shape —
 * a `concierge: ` prefix, the code, the quoted subject, the problem, then
 * `Fix: `, exactly as `catalog.ts`'s diagnostics are rendered with the stage id
 * substituted for the action name.
 *
 * **Behind a named function rather than written inline**, so the call site is
 * one short statement a mutation battery can target as a single literal.
 * `warnHost` is reached from two places in this file, and the other one takes a
 * composed template string, so an inline message here would leave neither call
 * site distinctly greppable.
 *
 * **What the warning claims, and what it deliberately does not.** It does not
 * say the catalog is wrong, because it is not: the per-stage catalog is keyed
 * by declaration order, so two stages sharing an id still serve their own
 * actions — measured, on three stages sharing one id, each of which returned
 * exactly its own action list. What *is* genuinely ambiguous is the reporting:
 * `stageFor()`, `Session.stage()` and `explain()` all return the id, so two
 * rows a developer reads are indistinguishable. Claiming more would be a false
 * alarm about scoping; claiming less would leave a real ambiguity unreported.
 *
 * **The scan behind it keeps TWO sets, not one.** `seenStageIds` answers "have
 * I met this id before"; `reportedStageIds` answers "have I already warned
 * about it". With a single set, a third stage sharing the id produces a second
 * warning naming the same id and a fourth produces a third. Two sets are the
 * construction-time analogue of the matcher warn-once latch below, and they
 * hold the granularity `CatalogDiagnostic`'s doc comment settles: one report
 * per offending subject, each naming its subject, never an aggregated summary
 * line that loses the name.
 *
 * Both sets are local to `createConcierge` and are discarded when it returns.
 * They are not instance state, so constraint 1 in this file's header has
 * nothing to say about them.
 */
function duplicateStageIdMessage(id: string): string {
  return (
    `concierge: [duplicate_stage_id] stage ${encodeDiagnosticSubject(id)}: two stages declare this id, and ` +
    `\`stageFor()\`, \`Session.stage()\` and \`explain()\` all report it, so the two are ` +
    `indistinguishable to a developer reading any of them. Catalog scoping is unaffected — ` +
    `the per-stage catalog is keyed by declaration order, not by id. ` +
    `Fix: give each stage a distinct id.`
  );
}

/**
 * The ONE place a stage becomes a bridge — the same rule header constraint 3
 * states for `stage.match`, applied to the other consumer-supplied seam a stage
 * carries.
 *
 * `bridgeStatus` is its only caller today. Phase 6's dispatcher is the second,
 * and there must never be a third: the throw policy below and the not-declared
 * policy below it are each written once here, so `explain` and a dispatcher
 * cannot drift into two readers that disagree about the same stage. A second
 * resolution path is not a duplicate function, it is a second answer to "is this
 * bridge mounted" — and the two would be consulted by different callers.
 *
 * **A stage that declares no bridge resolves to `null` without error and without
 * auto-failing anything (DX-02).** Declaring no bridge is a supported
 * configuration rather than a defect: an action that reads router or DOM state
 * must run with nothing registered at all. Core therefore never auto-fails an
 * action because a stage's declared bridge is unmounted, and it certainly does
 * not fail one for a stage that declares nothing. The handler receives `null`
 * and decides.
 *
 * **`read()` is consumer code, so it is guarded exactly as `match` is** — the
 * `catch` takes no binding, so there is no caught value in scope to interpolate
 * and the property is structural rather than a matter of remembering not to
 * echo one. A throwing `read()` is not a registration; it degrades to "not
 * mounted" rather than taking down the one call a developer makes when they are
 * already confused.
 *
 * **The `?? null` coalesce is a decision, not a tidying.** `BridgeRegistry.read`
 * is typed `() => B | null`, but the interface is implemented by consumers, and
 * a JavaScript consumer whose `read()` falls off the end returns `undefined`.
 * That case is exactly why `bridgeStatus` tested both `null` and `undefined`
 * before this seam existed; the arm does not disappear, it MOVES here. Two
 * consequences, and both are why it is written rather than left implicit: the
 * observable is unchanged — such a registry still reports `registered: false` —
 * and the handler contract `ctx.bridge: B | null` becomes structurally true at
 * the one point that produces the value, rather than merely annotated at the
 * point that consumes it.
 *
 * **This deliberately collapses "not declared" and "declared but unmounted" into
 * the same `null`,** because a handler has the same thing to do about both. The
 * distinction is a *reporting* concern, not a resolution one, which is why
 * `bridgeStatus` keeps its own `stage.bridge === undefined` early return ahead of
 * the call rather than reconstructing the distinction from this return value.
 *
 * The parameter is spelled `ConciergeConfig["stages"][number]` for the reason
 * already recorded on `bridgeStatus` below: the `any` lives in `types.ts`, where
 * D-07's measured contravariance reason justifies it, and re-spelling it here
 * would be a second, unargued occurrence of an erasure that was argued once.
 * Because that collection is erased, `registry.read()` yields `any`; the
 * explicit `Bridge | null` return annotation is what stops the erasure
 * propagating to every caller.
 */
function resolveBridge(stage: ConciergeConfig["stages"][number]): Bridge | null {
  const registry: ConciergeConfig["stages"][number]["bridge"] = stage.bridge;
  if (registry === undefined) {
    return null;
  }

  try {
    return registry.read() ?? null;
  } catch {
    return null;
  }
}

/**
 * Everything `explain` can honestly say about one stage's bridge.
 *
 * Three states, and the distinction between the last two is the entire reason
 * this is not a boolean:
 *
 * - `null` — the stage declares no `bridge` at all. Honest, and DX-02's
 *   supported configuration rather than a defect.
 * - `{id, registered: false}` — a registry is declared and its `read()`
 *   returned nothing, so no component is mounted. Once bridges exist this is
 *   the single most common cause of "my action didn't fire", and it is
 *   invisible in every other channel this package has.
 * - `{id, registered: true}` — `read()` returned a bridge.
 *
 * **The shape survives Phase 5 unchanged, which is why it was chosen.** `id`
 * and `read()` are both on the declared `BridgeRegistry` interface *today*, so
 * `createBridge` arriving later produces a conforming object and changes
 * nothing here. That is also what makes DX-01's bridge clause fully testable in
 * this phase with no Phase 5 code: a hand-rolled
 * `{id, read: () => mounted, register: () => () => {}}` is exactly what the
 * exported interface admits, and nothing about such a test changes when the
 * real registry ships.
 *
 * **`read()` is consumer code, so it is guarded the same way `match` is.** A
 * throwing `read()` is not a registration, and it is not a reason to take down
 * the one call a developer makes when they are already confused.
 *
 * **Rejected: warning on a throwing `read()`.** Unlike a throwing matcher —
 * which fires on every navigation, in a shipped app, where nobody is
 * watching — this runs only inside `explain`, a human-debugging-rate call. A
 * warning there prints during the very activity it would interrupt, and the
 * structured `registered: false` row is already in front of the person who
 * asked for it.
 *
 * The parameter is spelled `ConciergeConfig["stages"][number]` rather than
 * `StageDefinition<any>`. The `any` already lives in `types.ts`, where D-07's
 * measured contravariance reason justifies it; re-spelling it here would be a
 * second, unargued occurrence of an erasure that was argued once.
 */
function bridgeStatus(
  stage: ConciergeConfig["stages"][number],
): StageExplanation["bridge"] {
  const registry: ConciergeConfig["stages"][number]["bridge"] = stage.bridge;
  // **This early return stays HERE, ahead of the seam, and is not a redundant
  // repeat of the one inside it.** `resolveBridge` collapses "declares no
  // bridge" and "declares one that is unmounted" into the same `null`, which is
  // right for a handler and wrong for a report. Reading the row off that return
  // value alone would turn a stage with no bridge from `null` into
  // `{id, registered: false}` — and there is no `id` to put there. The
  // three-state shape is pinned by `types.ts` and by
  // `test-d/concierge.test-d.ts`'s `_stageExplanationBridgeShape`; do not
  // "simplify" this away.
  if (registry === undefined) {
    return null;
  }

  const live: Bridge | null = resolveBridge(stage);

  return { id: registry.id, registered: live !== null };
}

// ---------------------------------------------------------------------------
// The factory
// ---------------------------------------------------------------------------

/**
 * Assemble one catalog from every declared stage, then serve a stage-scoped,
 * reference-stable, sealed view of it.
 *
 * ---------------------------------------------------------------------------
 * CAT-01's name union stops at the config boundary, and that is correct
 * ---------------------------------------------------------------------------
 *
 * `buildCatalog`'s `const` type parameter carries the literal name union — that
 * is CAT-01's mechanism and it is real. It does not survive this function, and
 * a reader who assumes it should will burn a wave trying to preserve it.
 * Measured three ways under this repo's exact flags:
 *
 * | Assembly path | Derived `names[number]` |
 * |---|---|
 * | `buildCatalog([alpha, beta])` — the documented path | `"alpha" \| "beta"` |
 * | `buildCatalog([...stage.actions])`, `stage satisfies StageDefinition` | `"alpha"` |
 * | the flat assembly this function performs | **`string`** |
 *
 * **The cause is not `flatMap`.** It is `ConciergeConfig.stages:
 * ReadonlyArray<StageDefinition<any>>` — D-07's deliberate erasure, taken for a
 * measured contravariance reason (`StageDefinition<ResultsBridge>` is not
 * assignable to `StageDefinition<Bridge>`, TS2375). Reading the actions back
 * out of an erased collection cannot recover what the collection erased.
 *
 * **Nothing downstream wants the union today**, which is why no requirement is
 * unmet: `Concierge.dispatch(name: string, …)`, `EmittedTool.name: string` and
 * `Session.stage(): string | null` all take the open type.
 *
 * **Measured and deliberately not taken:**
 * `createConcierge<const C extends ConciergeConfig>(config: C)` **does** recover
 * the union inside a config literal. It is not taken because the union has
 * nowhere to go — `Concierge` is not generic, and making it generic ripples
 * into `Session`, `SessionConfig` and every adapter — and because the inline
 * `defineAction` widening documented on `ConciergeConfig.stages` sits upstream
 * of it, so the recovery would work at some call sites and silently not at
 * others. A partially-recovered union is worse than an honestly open one, for
 * the same reason a `readonly` that does not go all the way down is worse than
 * none.
 */
export function createConcierge(config: ConciergeConfig): Concierge {
  const capturedConsent: CapturedConsentConfiguration =
    captureConsentConfiguration(config);
  const stages: ConciergeConfig["stages"] = config.stages.map(
    (stage): ConciergeConfig["stages"][number] => {
      const actions: ConciergeConfig["stages"][number]["actions"] =
        Object.freeze(stage.actions.map(snapshotAction));
      return Object.freeze(
        stage.bridge === undefined
          ? { id: stage.id, match: stage.match, actions }
          : { id: stage.id, match: stage.match, actions, bridge: stage.bridge },
      );
    },
  );
  const crossStage: NonNullable<ConciergeConfig["crossStage"]> = Object.freeze([
    ...(config.crossStage ?? []).map(snapshotAction),
  ]);
  const configuredScheduler: Scheduler | undefined = config.scheduler;
  const commitWindowMs: number = validateWindowMs(
    config.commitWindowMs ?? 600,
    "commitWindowMs",
  );
  const dedupeWindowMs: number = validateWindowMs(
    config.dedupeWindowMs ?? 600,
    "dedupeWindowMs",
  );

  // ONE flat build over every stage's actions followed by the cross-stage
  // actions — not one build per stage, and the choice is a requirement rather
  // than a convenience.
  //
  // CAT-03 needs the COMPLETE declared-name set to decide whether a consent
  // policy's target exists, and a legitimate flow points a review action on one
  // stage at a confirm action on another. A per-stage build cannot see across
  // that boundary and would reject every cross-stage consent target. A single
  // build also produces a single aggregated `CatalogValidationError`, so a
  // developer with problems in three stages fixes three problems in one cycle
  // rather than three.
  //
  // Everything below is a PROJECTION of this one catalog. No second catalog is
  // ever built, which is what makes it structurally impossible for a per-stage
  // view to disagree with the whole.
  //
  // A duplicate action name across two stages is therefore rejected GLOBALLY,
  // with no new code — measured: `buildCatalog`'s existing
  // `duplicate_action_name` fires on an action declared in two different
  // stages, exactly as it does within one. That is the intended outcome. An
  // action name is the agent's vocabulary, and two behaviours under one name is
  // the ambiguity the design exists to prevent.
  const catalog: Catalog = buildCatalog(
    [...stages.flatMap((stage) => stage.actions), ...crossStage],
    {
      consentProfile: capturedConsent.profile,
      presentReadback: capturedConsent.presentReadback,
      digest: capturedConsent.digest,
    },
  );
  const reviewNames: ReadonlySet<string> = new Set(
    catalog.entries.flatMap((entry) =>
      entry.action.consent === undefined
        ? []
        : [entry.action.consent.requires],
    ),
  );
  const attestedReviewNames: ReadonlySet<string> = new Set(
    catalog.entries.flatMap((entry) =>
      entry.action.consent !== undefined &&
      effectiveConsentMinimum(entry.action.consent.minGrade) === "attested"
        ? [entry.action.consent.requires]
        : [],
    ),
  );

  // One `EmittedTool` per action, built ONCE here and shared by reference into
  // every stage array that contains it. Header constraint 2 is what this
  // implements; the two halves are coupled and neither is safe alone.
  //
  // **`parameters` is assigned BY REFERENCE and is never re-emitted.**
  // `buildCatalog` already emitted it, validated it as a root-object schema and
  // deep-froze it. Re-emitting here would run a vendor converter a second time,
  // produce a different object, destroy element identity across stage arrays,
  // and hand back a subtree nothing has frozen. The null-prototype-plus-freeze
  // pair on the lookup is `Catalog.byName`'s argument applied one level out —
  // read it there rather than restating it here; measured on this record,
  // `tools['__proto__']` and `tools['constructor']` are ordinary absent keys
  // and every write throws.
  //
  // The assembly seal appears THREE times in this file, each spelled as its own
  // single-occurrence statement: the tool, this lookup, and the projection
  // below. That is not stylistic. Each is a distinct target for the mutation
  // battery that proves the corresponding test actually fires, and folding any
  // two of them into one shared helper — or inlining one into a larger
  // expression — collapses two independent proofs into one. Three is the
  // measured number; if a later change makes it different, this sentence must
  // move with it.
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

  // **`namesByStage` is INDEXED, parallel to `stages`, and is never keyed by
  // the stage id.** This is a correction to an earlier design, annotated in
  // place rather than silently applied.
  //
  // The id-keyed form was measured to COLLAPSE. Two stages sharing an id build
  // cleanly, the lookup resolves to whichever was declared last, and the agent
  // standing on stage A is offered stage B's actions:
  //
  //     buildCatalog is happy:                    [ 'a', 'b' ]
  //     id-keyed projection silently collapses:   {"results":["b"]}
  //     stageFor resolves to: results  ->  projection would be [ 'b' ]
  //
  // Nothing already in the codebase can see it. `buildCatalog` receives a flat
  // action array and has no concept of a stage; `duplicate_action_name` does
  // not fire because the action *names* differ. It is a direct STG-01 failure
  // reached entirely through legal, type-correct configuration.
  //
  // Keying by declaration index makes the collapse impossible at zero new
  // surface cost. What it does NOT widen: the id is still what `stageFor`,
  // `Session.stage()` and `explain()` report, so the ambiguity remains visible
  // to a human — which is why the scan below still warns. Both halves are
  // required; either alone leaves a defect.
  //
  // Two remedies were rejected. **Throwing** needs a `CatalogIssue` whose
  // `action` field holds a stage id, which corrupts the `issues.map(i =>
  // i.action)` semantics DX-03 depends on — a consumer reading that array would
  // get a stage id where every other element is an action name. **Warn-only**
  // keeps the id-keyed lookup and therefore leaves a real correctness bug in
  // place, reported.
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

  // Instance-local mutable state. Every structure is `null` until its first
  // use, per header constraint 1 — a server process reuses this module across
  // every request it serves, and any one of these at module scope would carry
  // one config's answers, retries, or warnings into another's.
  //
  // **A `Map` and not a null-prototype record, because the key type is
  // `number | null`.** That is a measurement, not a preference. A record cannot
  // hold a `null` key, so it needs a sentinel — and every sentinel string is a
  // legal stage id. It cannot hold a number key without stringifying it, and
  // `String(null)` collides with a stage whose id is literally `"null"`. All
  // three failure shapes were reproduced:
  //
  //     Map handles a null key natively:            [ 'cross' ]
  //     record + sentinel, stage id === sentinel:   [ 'FROM THE STAGE NAMED THE SENTINEL' ]
  //     record + String(null) key, stage id 'null': [ "a stage whose id is literally 'null'" ]
  //
  // `catalog.ts:260-268` is the reason this does not contradict `Catalog.byName`
  // being a record: "a frozen `Map` is not frozen" governs anything that must be
  // frozen, and settles that a `Map` remains correct for mutable state. This
  // memo is never frozen and is never part of the catalog, so it is the case
  // that sentence carves out rather than the case it rules against.
  let memo: Map<number | null, ReadonlyArray<EmittedTool>> | null = null;
  let warnedStages: Set<string> | null = null;
  let dispatchPromises: Map<string, Promise<ActionResult>> | null = null;
  let dispatchSettledAt: Map<string, number> | null = null;
  let dispatchPending: Set<string> | null = null;
  let warnedDispatch: Set<string> | null = null;
  let consentGenerations: Map<string, ConsentGeneration> | null = null;
  let nextConsentGeneration: bigint = 0n;

  /** Delete a generation only while the caller still owns its review slot. */
  function closeConsentGeneration(reviewName: string, generation: bigint): void {
    const current: ConsentGeneration | undefined =
      consentGenerations?.get(reviewName);
    if (current?.generation === generation) {
      consentGenerations?.delete(reviewName);
    }
  }

  /** Return the policy-authored closed result, or core's fixed default. */
  function missingConsentResult(policy: ConsentPolicy<unknown>): ActionResult {
    const declared: ConsentPolicy<unknown>["onMissing"] = policy.onMissing;
    return declared === undefined
      ? authoredResult(
          false,
          "Review this action before confirming it.",
          "consent_required",
        )
      : authoredResult(false, declared.message, declared.reason);
  }

  /** Detach one already-resolved bridge without reading its registry again. */
  function captureResolvedSnapshot(
    index: number | null,
    bridge: Bridge | null,
  ): Readonly<Record<string, unknown>> {
    const stage: ConciergeConfig["stages"][number] | undefined =
      index === null ? undefined : stages[index];
    const bridgeId: string = stage?.bridge?.id ?? stage?.id ?? "cross-stage";
    return Object.freeze(
      captureSnapshot(
        bridge as Bridge,
        bridgeId,
        capturedConsent.normalizeSnapshot,
      ),
    );
  }

  /** Capture the active bridge early without replacing its later live resolve. */
  function captureReviewSnapshot(
    index: number | null,
  ): Readonly<Record<string, unknown>> {
    const stage: ConciergeConfig["stages"][number] | undefined =
      index === null ? undefined : stages[index];
    const bridge: Bridge | null = stage === undefined ? null : resolveBridge(stage);
    return captureResolvedSnapshot(index, bridge);
  }

  /** Arm one owned pending generation from snapshotted delivery evidence. */
  async function observeReviewDelivery(
    reviewName: string,
    pending: ConsentGenerationBase & { readonly status: "pendingDelivery" },
    report: DeliveryReport,
  ): Promise<void> {
    const current: ConsentGeneration | undefined =
      consentGenerations?.get(reviewName);
    if (
      current?.generation !== pending.generation ||
      current.status !== "pendingDelivery" ||
      current.responseId !== pending.responseId
    ) {
      return;
    }

    const deliverySnapshot = snapshotDeliveryEvidence(report);
    if (!deliverySnapshot.ok) {
      closeConsentGeneration(reviewName, pending.generation);
      return;
    }
    const delivery: DeliveryEvidenceSnapshot = deliverySnapshot.value;

    if (
      delivery.responseId !== pending.responseId ||
      delivery.outcome !== "completed"
    ) {
      closeConsentGeneration(reviewName, pending.generation);
      return;
    }

    const observedAct: unknown = delivery.attestation?.act;
    if (
      observedAct !== undefined &&
      observedAct !== "confirmed" &&
      observedAct !== "declined" &&
      observedAct !== "dismissed"
    ) {
      closeConsentGeneration(reviewName, pending.generation);
      return;
    }

    if (observedAct === "declined" || observedAct === "dismissed") {
      consentGenerations?.set(
        reviewName,
        Object.freeze({ ...pending, status: observedAct }),
      );
      return;
    }

    let achievedGrade: ConsentGrade = relayedGradeWithin(
      capturedConsent.profile.consentGrade,
    );
    let confirmationUserTurnId: string | null = null;
    let readbackHash: string | null = null;
    const attestation = delivery.attestation;
    const verified: VerifiedReadbackEvidence | null = pending.verifiedReadback;
    if (
      verified !== null &&
      consentGradeRank(capturedConsent.profile.consentGrade) >=
        consentGradeRank("attested") &&
      capturedConsent.profile.userTurnIdentity === "human-attested" &&
      observedAct === "confirmed" &&
      typeof delivery.readbackHash === "string" &&
      delivery.readbackHash === verified.hash &&
      attestation !== undefined &&
      attestation.readbackHash === verified.hash &&
      typeof attestation.userTurnId === "string" &&
      attestation.userTurnId.length > 0 &&
      attestation.userTurnId !== pending.userTurnId
    ) {
      const freshHash: string | null = await digestReadback(
        capturedConsent.digest,
        verified.canonical,
      );
      const stillOwned: ConsentGeneration | undefined =
        consentGenerations?.get(reviewName);
      if (
        stillOwned?.generation !== pending.generation ||
        stillOwned.status !== "pendingDelivery" ||
        stillOwned.responseId !== pending.responseId
      ) {
        return;
      }
      if (freshHash === verified.hash) {
        achievedGrade = "attested";
        confirmationUserTurnId = attestation.userTurnId;
        readbackHash = verified.hash;
      }
    }

    if (!isMeasuredConsentGrade(achievedGrade)) {
      consentGenerations?.set(
        reviewName,
        Object.freeze({ ...pending, status: "gradeUnavailable" }),
      );
      return;
    }

    consentGenerations?.set(
      reviewName,
      Object.freeze({
        ...pending,
        achievedGrade,
        confirmationUserTurnId,
        readbackHash,
        status: "armed",
      }),
    );
  }

  /** Report one runtime dispatch problem per subject and Concierge instance. */
  function warnDispatchOnce(key: string, message: string): void {
    warnedDispatch ??= new Set<string>();
    if (warnedDispatch.has(key)) {
      return;
    }
    warnedDispatch.add(key);
    try {
      warnHost(message);
    } catch {
      // A host diagnostic is a convenience channel, never dispatch control flow.
    }
  }

  /**
   * Latch a stage id, warn about it once, and report "did not match".
   *
   * **The return type is the literal `false`, not `boolean`.** That is what
   * lets the warn-and-skip decision be a single `return` statement at both call
   * sites below instead of a warn-then-return pair. It matters beyond
   * tidiness: each call site is then one contiguous statement, which is what
   * makes it a single-literal target for the mutation battery, and a battery
   * that cannot target a decision cannot prove the test covering it fires.
   * Both statements are spelled on one line each for the same reason, and are
   * deliberately worded differently so neither is a substring of the other.
   *
   * Warn-once is per stage id per instance, not per instance. Two broken
   * matchers must produce two warnings — `CatalogDiagnostic`'s doc comment
   * settles that granularity, and an aggregated line loses exactly the name a
   * developer needs.
   */
  function warnStage(id: string, problem: string, fix: string): false {
    warnedStages ??= new Set<string>();
    if (warnedStages.has(id)) {
      return false;
    }
    warnedStages.add(id);
    warnHost(
      `concierge: [stage_match] stage ${encodeDiagnosticSubject(id)}: ${problem} Fix: ${fix}`,
    );
    return false;
  }

  /**
   * The ONLY place `stage.match` is invoked — header constraint 3.
   *
   * `catalogFor`, `stageFor` and `explain` all reach a matcher through here, so
   * the throw policy, the non-boolean policy and the warn-once latch exist once
   * and cannot drift apart into three readers that disagree about the same
   * context.
   */
  function runMatch(stage: ConciergeConfig["stages"][number], ctx: StageContext): boolean {
    let result: unknown;
    // **The `catch` takes NO binding, and the message echoes nothing it
    // caught.** This is the same structure as the two guarded calls in
    // `./json-schema.ts` with one decision deliberately INVERTED, and the
    // reason is written here because a later reader comparing the three will
    // otherwise "fix" the inconsistency.
    //
    // Those two are build-time developer diagnostics and carry the explicit
    // exemption stated at `json-schema.ts:259-261`, so they may render the
    // caught value. This one is the opposite case in all three respects that
    // matter: it fires at runtime, on every navigation, in a shipped app — and
    // the caught message is whatever the consumer's own matcher put in it,
    // which in a real app is assembled from the same user input `ctx` carries.
    // Echoing it would open exactly the covert channel CLAUDE.md's rule closes
    // for handler exceptions, one layer earlier and on a hotter path.
    //
    // With no binding there is no caught value in scope, so the property is
    // structural rather than a matter of remembering not to interpolate it.
    // The warning carries the stage id — a developer-authored string already in
    // the config — and fixed prose, and nothing else.
    try {
      result = stage.match(ctx);
    } catch {
      return warnStage(stage.id, "its `match(ctx)` threw, so the stage was skipped and its actions are absent from the catalog for this context.", "make `match` total — it runs on every navigation, so it must not assume any field of `ctx` is present.");
    }

    // **Strict equality, plus a named warning for everything else.** Neither
    // half is sufficient alone, and the combination is the only one that is
    // both fail-closed and diagnosable.
    //
    // Strict equality fails closed, which is the house rule already visible at
    // `catalog.ts:788` and `:798` (`=== true` on `destructive` and
    // `readsUntrusted`). But failing closed *silently* reproduces P14's exact
    // first-run experience. A JavaScript consumer writes
    // `match: (ctx) => ctx.pathname.startsWith("/results") && ctx.user`, gets a
    // truthy object back, never matches, and reads "the agent says it can't do
    // anything" with nothing anywhere to explain it. Measured:
    //
    //     `"yes" === true` -> false   |   `Boolean("yes")` -> true
    //
    // Both alternatives are defensible and both are worse. A **silent strict
    // check** is the failure above. A **permissive truthy check** matches on
    // the object, which means a matcher that returns a value it never meant as
    // an answer silently scopes the agent's whole catalog — failing open on the
    // decision that decides what an agent may do.
    if (result === true) {
      return true;
    }
    if (result !== false) {
      return warnStage(stage.id, "its `match(ctx)` returned a value that is neither `true` nor `false`, and a non-boolean is treated here as no match at all.", "return a real boolean — a truthy object does not match, deliberately, so compare explicitly rather than returning the value you tested.");
    }
    return false;
  }

  /**
   * Resolve a context to a stage POSITION, first match wins (STG-02).
   *
   * **Not memoized, and that is deliberate.** `ctx` is the caller's arbitrary
   * object — STG-03 requires it to be anything the app knows — so there is no
   * stable key to memoize against without holding a reference to every context
   * the app has ever produced. Matchers are pure and cheap by contract. Only
   * the *projected catalog* is memoized, and it is keyed by the resolution's
   * result rather than by its input, which is what makes the memo's key space
   * finite and equal to the stage count.
   *
   * **Resolution walks an ordered array, not a keyed object, so it is
   * independent of what the stages are named.** `ConciergeConfig.stages`'
   * doc comment already argues this; the measurement behind the argument is
   * that object key iteration hoists integer-like keys to the front:
   *
   *     object key order:  [ '2', '10', 'results', 'checkout', 'home' ]
   *     array order:       [ 'results', 'checkout', '2', 'home', '10' ]
   *
   * Under any keyed implementation, renaming a later stage to `"2"` moves it
   * ahead of everything declared before it, and first-match-wins silently
   * starts meaning something else.
   */
  function resolveIndex(ctx: StageContext): number | null {
    for (const [index, stage] of stages.entries()) {
      if (runMatch(stage, ctx)) {
        return index;
      }
    }
    return null;
  }

  /**
   * The memoized per-stage projection — STG-04's referential identity.
   *
   * **This function never sees a `ctx`.** That is what makes "memoize by
   * resolved stage, not by context identity" mechanical rather than a
   * discipline someone has to remember: there is no context in scope to key on
   * even by accident. Two distinct context objects that resolve to the same
   * stage get the identical array, measured — React's `useSyncExternalStore`
   * compares snapshots with `Object.is` and Svelte 5's `$derived` with `===`,
   * so a fresh-but-equal array is an infinite render, not a slow one.
   *
   * **The no-stage branch returns the CROSS-STAGE actions, not an empty
   * array.** `ConciergeConfig.crossStage` is declared "available in every
   * stage"; an unrouted page is still a page, and silently stripping actions
   * the developer explicitly marked global would contradict the declaration
   * they wrote.
   *
   * Rejected: an empty frozen array. "Fail closed" is the right instinct for
   * *consent*, and it is the wrong one here — it would silently disable
   * `signOut`-shaped actions on any page no stage happens to match, which is
   * every 404 and every route a developer has not added a stage for yet. The
   * situation is not hidden either way: `stageFor` returns `null` and `explain`
   * reports every stage's `matched: false`, so the diagnosis is one call away
   * rather than absent.
   */
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

  /** Remove every settled retry whose full post-settlement window elapsed. */
  function sweepSettledDispatches(now: number): void {
    if (
      dispatchPromises === null ||
      dispatchSettledAt === null ||
      dispatchPending === null
    ) {
      return;
    }

    for (const [key, settledAt] of dispatchSettledAt) {
      if (dispatchPending.has(key)) {
        continue;
      }
      if (now - settledAt >= dedupeWindowMs) {
        dispatchSettledAt.delete(key);
        dispatchPromises.delete(key);
      }
    }
  }

  /** Begin the settled access window without replacing the cached Promise. */
  function markDispatchSettled(key: string, promise: Promise<ActionResult>): void {
    if (
      dispatchPromises === null ||
      dispatchSettledAt === null ||
      dispatchPending === null ||
      dispatchPromises.get(key) !== promise
    ) {
      return;
    }

    dispatchPending.delete(key);
    dispatchSettledAt.set(key, Date.now());
  }

  /** Execute one call after the synchronous deduplication boundary. */
  async function runDispatchPipeline(
    index: number | null,
    entry: CatalogEntry,
    name: string,
    args: unknown,
    meta: InvocationMeta,
    argumentsMalformed: boolean,
  ): Promise<ActionResult> {
    const handler: unknown = entry.action.handler;
    if (typeof handler !== "function") {
      warnDispatchOnce(
        `handler-missing:${name}`,
        `concierge: [handler_missing] action ${encodeDiagnosticSubject(name)}: no callable handler is registered, so the action did not run. Fix: provide a callable handler in the action declaration.`,
      );
      return authoredResult(
        false,
        "This action is unavailable because no handler is registered.",
      );
    }

    const validation: ArgumentValidation = await validateArguments(entry, args);
    if (!validation.ok || argumentsMalformed) {
      return authoredResult(
        false,
        "The action arguments are invalid.",
        "invalid_args",
      );
    }

    const replacesReviewAuthority: boolean = reviewNames.has(name);
    if (replacesReviewAuthority) {
      // Validation is the freshness boundary. Every later failure stays closed.
      consentGenerations?.delete(name);
    }

    let preparedReadback: PreparedReadback | null = null;
    let validatedSnapshot: InvocationValueSnapshot;
    if (attestedReviewNames.has(name)) {
      const prepared: PreparedReadbackResult = prepareReadback(validation.value);
      if (!prepared.ok) {
        return authoredResult(
          false,
          "The action arguments are invalid.",
          "invalid_args",
        );
      }
      preparedReadback = prepared.value;
      validatedSnapshot = {
        ok: true,
        value: preparedReadback.readback.payload,
      };
    } else {
      validatedSnapshot = snapshotInvocationValue(validation.value, true);
    }
    if (!validatedSnapshot.ok) {
      return authoredResult(
        false,
        "The action arguments are invalid.",
        "invalid_args",
      );
    }

    let reviewingGeneration:
      | (ConsentGenerationBase & { readonly status: "reviewing" })
      | null = null;
    if (replacesReviewAuthority) {
      nextConsentGeneration += 1n;
      reviewingGeneration = Object.freeze({
        confirmationUserTurnId: null,
        generation: nextConsentGeneration,
        payload: validatedSnapshot.value,
        preparedReadback,
        readbackHash: null,
        responseId: meta.responseId ?? "",
        snapshot: captureReviewSnapshot(index),
        status: "reviewing",
        userTurnId: meta.userTurnId ?? "",
        verifiedReadback: null,
      });
      consentGenerations ??= new Map<string, ConsentGeneration>();
      consentGenerations.set(name, reviewingGeneration);
    }

    const closeOwnedReview = (): void => {
      if (reviewingGeneration !== null) {
        closeConsentGeneration(name, reviewingGeneration.generation);
      }
    };

    const signal: AbortSignalLike | undefined = meta.signal;

    if (isAborted(signal)) {
      closeOwnedReview();
      return authoredResult(
        false,
        "The action was cancelled before it ran.",
        "aborted",
      );
    }

    if (entry.action.effects?.readOnly !== true) {
      let scheduler: Scheduler | undefined = configuredScheduler;
      if (scheduler === undefined) {
        try {
          scheduler = readHostScheduler();
        } catch {
          scheduler = undefined;
        }
      }

      const wait: CommitWaitOutcome = await waitForCommit(
        scheduler,
        commitWindowMs,
        signal,
      );
      if (wait === "aborted") {
        closeOwnedReview();
        return authoredResult(
          false,
          "The action was cancelled before it ran.",
          "aborted",
        );
      }
      if (wait === "unavailable") {
        warnDispatchOnce(
          "commit-window-unavailable",
          "concierge: [commit_window_unavailable] config \"scheduler\": no cancellable timer is available, so the commit window was skipped. Fix: provide `ConciergeConfig.scheduler` in this host.",
        );
      }
    }

    // Close the interval between a ready scheduler callback and this async
    // continuation entering the handler.
    if (isAborted(signal)) {
      closeOwnedReview();
      return authoredResult(
        false,
        "The action was cancelled before it ran.",
        "aborted",
      );
    }

    const stage: ConciergeConfig["stages"][number] | undefined =
      index === null ? undefined : stages[index];
    const bridge: Bridge | null = stage === undefined ? null : resolveBridge(stage);
    if (isAborted(signal)) {
      closeOwnedReview();
      return authoredResult(
        false,
        "The action was cancelled before it ran.",
        "aborted",
      );
    }

    let consentAck: ConsentAck<unknown, unknown> | undefined;
    const policy: ConsentPolicy<unknown> | undefined = entry.action.consent;
    if (policy !== undefined) {
      const reviewName: string = policy.requires;
      const owned: ConsentGeneration | undefined =
        consentGenerations?.get(reviewName);
      if (owned?.status === "gradeUnavailable") {
        closeConsentGeneration(reviewName, owned.generation);
        closeOwnedReview();
        return authoredResult(
          false,
          "The available consent evidence is not strong enough for this action.",
          "grade_unavailable",
        );
      }
      if (owned?.status === "declined" || owned?.status === "dismissed") {
        closeConsentGeneration(reviewName, owned.generation);
        closeOwnedReview();
        return owned.status === "declined" ? USER_DECLINED : USER_CANCELLED;
      }
      if (owned?.status !== "armed") {
        closeOwnedReview();
        return missingConsentResult(policy);
      }

      if (
        !hasFreshConsentBoundary(
          policy,
          owned,
          meta,
          capturedConsent.profile,
        )
      ) {
        closeOwnedReview();
        return missingConsentResult(policy);
      }

      if (!isMeasuredConsentGrade(owned.achievedGrade)) {
        closeConsentGeneration(reviewName, owned.generation);
        closeOwnedReview();
        return authoredResult(
          false,
          "The available consent evidence is not strong enough for this action.",
          "grade_unavailable",
        );
      }
      if (
        owned.achievedGrade === "attested" &&
        (owned.readbackHash === null ||
          owned.confirmationUserTurnId === null)
      ) {
        closeConsentGeneration(reviewName, owned.generation);
        closeOwnedReview();
        return authoredResult(
          false,
          "The available consent evidence is not strong enough for this action.",
          "grade_unavailable",
        );
      }
      const minimumGrade: ConsentGrade = effectiveConsentMinimum(
        policy.minGrade,
      );
      if (
        consentGradeRank(owned.achievedGrade) < consentGradeRank(minimumGrade)
      ) {
        closeConsentGeneration(reviewName, owned.generation);
        closeOwnedReview();
        return authoredResult(
          false,
          "The available consent evidence is not strong enough for this action.",
          "grade_unavailable",
        );
      }

      let snapshotsMatch: boolean = false;
      try {
        const currentSnapshot: Readonly<Record<string, unknown>> =
          captureResolvedSnapshot(index, bridge);
        const comparator: ConsentPolicy<unknown>["snapshotEquality"] =
          policy.snapshotEquality;
        snapshotsMatch = comparator === undefined
          ? strictSnapshotEquality(owned.snapshot, currentSnapshot)
          : comparator(owned.snapshot, currentSnapshot) === true;
      } catch {
        snapshotsMatch = false;
      }
      if (!snapshotsMatch) {
        closeConsentGeneration(reviewName, owned.generation);
        closeOwnedReview();
        return authoredResult(
          false,
          "The reviewed state changed before this action could run.",
          "consent_stale",
        );
      }

      // A consumer comparator may synchronously abort while it evaluates.
      if (isAborted(signal)) {
        closeOwnedReview();
        return authoredResult(
          false,
          "The action was cancelled before it ran.",
          "aborted",
        );
      }

      const stillOwned: ConsentGeneration | undefined =
        consentGenerations?.get(reviewName);
      if (
        stillOwned?.status !== "armed" ||
        stillOwned.generation !== owned.generation
      ) {
        closeOwnedReview();
        return missingConsentResult(policy);
      }

      // Authority is one-shot across every action sharing this review name.
      closeConsentGeneration(reviewName, owned.generation);
      consentAck = Object.freeze(
        owned.achievedGrade === "attested"
          ? {
              grade: owned.achievedGrade,
              payload: owned.payload,
              readbackHash: owned.readbackHash as string,
              responseId: owned.responseId,
              snapshot: owned.snapshot,
              userTurnId: owned.userTurnId,
            }
          : {
              grade: owned.achievedGrade,
              payload: owned.payload,
              responseId: owned.responseId,
              snapshot: owned.snapshot,
              userTurnId: owned.userTurnId,
            },
      );
    }

    let handlerReturn: unknown;
    try {
      handlerReturn = handler({
        args: validatedSnapshot.value,
        bridge,
        meta,
        ack: consentAck,
      });
    } catch {
      closeOwnedReview();
      return authoredResult(
        false,
        "Something went wrong.",
        "handler_error",
      );
    }

    let handlerResult: unknown = handlerReturn;
    if (
      (typeof handlerReturn === "object" && handlerReturn !== null) ||
      typeof handlerReturn === "function"
    ) {
      let then: unknown;
      try {
        then = (handlerReturn as { readonly then?: unknown }).then;
      } catch {
        // A hostile result object is normalized below; probing Promise
        // compatibility must not reclassify it as a handler exception.
        then = undefined;
      }

      if (typeof then === "function") {
        try {
          handlerResult = await new Promise<unknown>((resolve, reject) => {
            then.call(handlerReturn, resolve, reject);
          });
        } catch {
          closeOwnedReview();
          return authoredResult(
            false,
            "Something went wrong.",
            "handler_error",
          );
        }
      }
    }

    const normalizedResult: ActionResult = normalizeActionResult(handlerResult, {
      successReason: (): void => {
        warnDispatchOnce(
          `success-reason:${name}`,
          `concierge: [invalid_result] action ${encodeDiagnosticSubject(name)}: its handler returned a success carrying a failure reason, so the reason was removed. Fix: omit \`reason\` when \`ok\` is true.`,
        );
      },
      reasonlessFailure: (): void => {
        warnDispatchOnce(
          `reasonless-failure:${name}`,
          `concierge: [invalid_result] action ${encodeDiagnosticSubject(name)}: its handler returned a failure without a reason, so the result carries no machine-readable cause. Fix: return one of the declared \`ReasonCode\` values when \`ok\` is false.`,
        );
      },
    });

    if (reviewingGeneration === null) {
      return normalizedResult;
    }
    if (!normalizedResult.ok) {
      closeOwnedReview();
      return normalizedResult;
    }

    const currentReview: ConsentGeneration | undefined =
      consentGenerations?.get(name);
    if (
      currentReview?.generation !== reviewingGeneration.generation ||
      currentReview.status !== "reviewing" ||
      currentReview.responseId !== reviewingGeneration.responseId
    ) {
      return normalizedResult;
    }

    let verifiedReadback: VerifiedReadbackEvidence | null = null;
    if (reviewingGeneration.preparedReadback !== null) {
      const presenter = capturedConsent.presentReadback;
      if (presenter === undefined) {
        closeOwnedReview();
        return normalizedResult;
      }
      let receipt: unknown;
      try {
        receipt = await presenter(reviewingGeneration.preparedReadback.readback);
      } catch {
        closeOwnedReview();
        return normalizedResult;
      }
      const afterPresentation: ConsentGeneration | undefined =
        consentGenerations?.get(name);
      if (
        afterPresentation?.generation !== reviewingGeneration.generation ||
        afterPresentation.status !== "reviewing" ||
        afterPresentation.responseId !== reviewingGeneration.responseId
      ) {
        return normalizedResult;
      }
      const receiptSnapshot: ReadbackReceiptSnapshotResult =
        snapshotReadbackReceipt(receipt);
      if (!receiptSnapshot.ok) {
        closeOwnedReview();
        return normalizedResult;
      }
      const freshHash: string | null = await digestReadback(
        capturedConsent.digest,
        reviewingGeneration.preparedReadback.canonical,
      );
      const afterDigest: ConsentGeneration | undefined =
        consentGenerations?.get(name);
      if (
        afterDigest?.generation !== reviewingGeneration.generation ||
        afterDigest.status !== "reviewing" ||
        afterDigest.responseId !== reviewingGeneration.responseId
      ) {
        return normalizedResult;
      }
      verifiedReadback = verifyReadbackReceipt(
        reviewingGeneration.preparedReadback,
        receiptSnapshot.value,
        freshHash,
      );
      if (verifiedReadback === null) {
        closeOwnedReview();
        return normalizedResult;
      }
    }

    const deliveryHook: InvocationMeta["deferUntilDelivered"] =
      meta.deferUntilDelivered;
    if (
      typeof deliveryHook !== "function" ||
      reviewingGeneration.responseId.length === 0
    ) {
      closeOwnedReview();
      return normalizedResult;
    }

    const pendingDelivery = Object.freeze({
      ...reviewingGeneration,
      status: "pendingDelivery" as const,
      verifiedReadback,
    });
    consentGenerations?.set(name, pendingDelivery);
    try {
      deliveryHook((report: DeliveryReport): void => {
        void observeReviewDelivery(name, pendingDelivery, report);
      });
    } catch {
      closeConsentGeneration(name, reviewingGeneration.generation);
    }

    return normalizedResult;
  }

  /**
   * Dispatch is deliberately not async. The final pipeline Promise is stored
   * synchronously and cache hits return that exact object by reference.
   */
  function dispatch(
    ctx: StageContext,
    name: string,
    args: unknown,
    meta?: InvocationMeta,
    argumentsMalformed: boolean = false,
  ): Promise<ActionResult> {
    const index: number | null = resolveIndex(ctx);
    const allowedNames: readonly string[] =
      index === null ? crossNames : (namesByStage[index] ?? crossNames);

    // Reserved prototype spellings are ordinary keys in the catalog's frozen
    // null-prototype lookup. Authorization still stays ahead of the cache: a
    // key proves retry identity, never stage authority.
    if (!allowedNames.includes(name)) {
      return Promise.resolve(
        authoredResult(
          false,
          "This action is not available in the current stage.",
          "unknown_action",
        ),
      );
    }

    const entry: CatalogEntry | undefined = catalog.byName[name];
    if (entry === undefined) {
      return Promise.resolve(
        authoredResult(
          false,
          "This action is not available in the current stage.",
          "unknown_action",
        ),
      );
    }

    const argsSnapshot: InvocationValueSnapshot = snapshotInvocationValue(args);
    if (!argsSnapshot.ok) {
      return Promise.resolve(
        authoredResult(
          false,
          "The action arguments are invalid.",
          "invalid_args",
        ),
      );
    }

    const metaSnapshot: InvocationMetaSnapshot = snapshotInvocationMeta(meta);
    if (!metaSnapshot.ok) {
      return Promise.resolve(
        authoredResult(
          false,
          "The invocation metadata is invalid.",
        ),
      );
    }

    const derivedKey: string | null = deriveDispatchKey(
      name,
      argsSnapshot.value,
      metaSnapshot.value,
      index,
    );
    const key: string | null =
      derivedKey === null
        ? null
        : argumentsMalformed
          ? `malformed:${derivedKey}`
          : derivedKey;
    if (key === null) {
      return runDispatchPipeline(
        index,
        entry,
        name,
        argsSnapshot.value,
        metaSnapshot.value,
        argumentsMalformed,
      );
    }

    dispatchPromises ??= new Map<string, Promise<ActionResult>>();
    dispatchSettledAt ??= new Map<string, number>();
    dispatchPending ??= new Set<string>();

    sweepSettledDispatches(Date.now());
    const hit: Promise<ActionResult> | undefined = dispatchPromises.get(key);
    if (hit !== undefined) {
      return hit;
    }

    const promise: Promise<ActionResult> = Promise.resolve().then(() =>
      runDispatchPipeline(
        index,
        entry,
        name,
        argsSnapshot.value,
        metaSnapshot.value,
        argumentsMalformed,
      ),
    );
    dispatchPromises.set(key, promise);
    dispatchSettledAt.delete(key);
    dispatchPending.add(key);

    const observeSettlement = (): void => {
      markDispatchSettled(key, promise);
    };
    void promise.then(observeSettlement, observeSettlement);

    return promise;
  }

  /** Execute a copied, stably ordered ToolBatch through the same dispatch cache. */
  async function dispatchBatch(
    ctx: StageContext,
    batch: ToolBatch,
  ): Promise<ReadonlyArray<Readonly<{ callId: string; result: ActionResult }>>> {
    return executeDispatchBatch(ctx, batch, dispatch);
  }

  function catalogFor(ctx: StageContext): ReadonlyArray<EmittedTool> {
    return projectFor(resolveIndex(ctx));
  }

  function stageFor(ctx: StageContext): string | null {
    const index: number | null = resolveIndex(ctx);
    return index === null ? null : (stages[index]?.id ?? null);
  }

  /**
   * DX-01's three questions — which stage is active, which bridges are
   * registered, and what the agent can currently see — answered in one pass.
   *
   * **The returned object is deliberately NOT identity-stable: a fresh object
   * every call, by design.** This is the one member of `Concierge` that must
   * never be memoized, and it is the exact inverse of `catalogFor`'s rule three
   * functions up. Do not wire it into `useSyncExternalStore` or any other
   * referential-equality subscription — it would loop forever, which is
   * precisely the defect STG-04's memo exists to prevent. The requirement that
   * motivates this whole phase is one line away from being violated by the
   * phase's own diagnostic, so the non-identity is stated rather than left to
   * be inferred. Memoizing it to make such a call site work would be worse
   * still: it would hand a devtools panel a snapshot that silently stops
   * tracking the app.
   */
  function explain(ctx: StageContext): Explanation {
    // **`stages.map(...)` and not a `for…of`**, because `map` evaluates every
    // matcher exactly once and structurally cannot short-circuit.
    //
    // That is the property DX-01 needs. The single most likely answer to "why
    // didn't my action fire" in a multi-stage app is *an earlier stage shadowed
    // yours* — and a short-circuiting `explain` reports `matched: false` for
    // the shadowed stage, which is not a measurement at all. It is "we never
    // asked", rendered as a negative, at the exact moment the developer is
    // trusting the tool over their own reading of the code. Running every
    // matcher turns the commonest failure into a visible two-`true` row set.
    //
    // The cost is one extra matcher call per stage, on a call that happens at
    // human debugging rate. The accepted consequence, recorded rather than
    // hidden: a matcher with a side effect fires more often under `explain`
    // than under `stageFor`. Matchers are pure by contract, so this is a
    // consequence of violating the contract rather than of this decision.
    const rows: StageExplanation[] = stages.map(
      (stage): StageExplanation => ({
        id: stage.id,
        matched: runMatch(stage, ctx),
        bridge: bridgeStatus(stage),
      }),
    );

    // **The active position is derived from the recorded rows, never from a
    // second matcher evaluation.** Calling `stageFor` here would re-run every
    // matcher, and consumer code is under no obligation to answer the same way
    // twice. Measured, with a matcher carrying an internal counter:
    //
    //     two-pass: {"stage":"flaky","stages":[{"id":"flaky","matched":false}]}
    //     one-pass: {"stage":"flaky","stages":[{"id":"flaky","matched":true}]}
    //
    // The two-pass row set contradicts its own header. A diagnostic that
    // contradicts itself is worse than no diagnostic, because the developer
    // stops debugging their app and starts debugging the tool.
    const firstMatch: number = rows.findIndex((row) => row.matched);
    const activeIndex: number | null = firstMatch === -1 ? null : firstMatch;

    // **`projectFor(activeIndex)`, not `catalogFor(ctx)`.** Reading the memo
    // directly is what guarantees `explain().catalog` and `explain().stage`
    // cannot disagree; `catalogFor` would re-resolve, and under a
    // non-deterministic matcher it could land on a different stage than the
    // rows above recorded — reintroducing the two-pass contradiction through a
    // different door.
    //
    // **`explain` writes nothing to the console.** Structured return only, no
    // warning of its own. Phase 3's precedent is that the structured value is
    // the assertable channel and console output is the convenience one, and a
    // convenience with no test is a surface with no guarantee. (`runMatch` may
    // still warn about a broken matcher during this call — that is the matcher
    // policy firing, not `explain` printing.)
    //
    // The result is deep-frozen through `catalog.ts`'s own walk rather than a
    // hand-written one. Six lines that would have to independently reproduce a
    // cycle-safe `WeakSet`, an accessor skip that does not invoke getters, and
    // a documented refusal to early-out on `Object.isFrozen` is not a saving —
    // those are three properties a re-implementation rediscovers as bug
    // reports.
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

  // **The returned object is deliberately NOT frozen**, and this is recorded so
  // a reviewer does not add the freeze silently as a tidy-up.
  //
  // SEC-03 names the action *registry*, which is frozen — `catalog.byName`, the
  // per-action tool, the lookup and every projection. The `Concierge` object is
  // not part of that registry: it is the handle the consumer's own code holds,
  // and page script that can reach it can already reach the module that made
  // it. `dispatchBatch` and `ServerSafeConcierge` are still scheduled to widen
  // this object's shape, so freezing now would harden a surface that is not
  // final against an attacker who is not constrained by it.
  //
  // Deliberately NOT justified by a count of anything. An earlier draft argued
  // the freeze would disturb a mutation battery that depends on a particular
  // number of seals in this file; that argument was arithmetically wrong, and
  // a wrong reason attached to a right decision is how a right decision gets
  // reversed by the first reader who checks it.
  const concierge: Concierge = {
    dispatch,
    dispatchBatch,
    catalogFor,
    stageFor,
    explain,
  };
  return attachConsentProfile(concierge, capturedConsent.profile);
}
