/**
 * Cause/rendition attribution for DeliveryReport.responseId.
 *
 * A tool-calling transport executes a review inside response N and voices the
 * result in response N+1. The consent kernel arms only when
 * report.responseId equals the REVIEW dispatch's response id, so a report
 * naming N+1 closes the generation. This binder holds the causal link and
 * emits a report naming the cause.
 */

import { encodeDiagnosticSubject, warnHost } from "./host.js";
import type {
  DeliveryReport,
  ReadbackAttestation,
  ToolBatch,
} from "./types.js";

export type RenditionEvidence = "explicit" | "generation-end";

export type RenditionIssueCode =
  | "unbound_rendition"
  | "cause_already_bound"
  | "duplicate_settlement"
  | "effect_threw"
  | "capacity_evicted"
  | "late_deferral";

export interface RenditionIssue {
  readonly code: RenditionIssueCode;
  readonly causeResponseId: string | null;
  readonly renditionResponseId: string | null;
  readonly message: string;
}

export interface RenditionSettlement {
  readonly outcome: DeliveryReport["outcome"];
  readonly readbackHash?: string | undefined;
  readonly attestation?: ReadbackAttestation | undefined;
}

export interface RenditionBinderConfig {
  readonly renditionEvidence?: RenditionEvidence | undefined;
  readonly maxPendingCauses?: number | undefined;
  readonly onIssue?: ((issue: RenditionIssue) => void) | undefined;
}

export interface RenditionBinder {
  deferralsFor(
    causeResponseId: string,
  ): NonNullable<ToolBatch["deferUntilDelivered"]>;
  bindRendition(link: { readonly cause: string; readonly rendition: string }): void;
  renditionStarted(renditionResponseId: string): void;
  generationEnded(renditionResponseId: string): void;
  settle(renditionResponseId: string, settlement: RenditionSettlement): void;
  abandonCause(causeResponseId: string): void;
  abandonUnstarted(): void;
  abandonAll(): void;
  pendingCauses(): ReadonlyArray<string>;
}

type DeliveryEffect = (report: DeliveryReport) => void;

const DEFAULT_MAX_PENDING_CAUSES: number = 32;
const SETTLED_MEMORY: number = 512;

/**
 * A membership set that forgets its oldest entry past a cap.
 *
 * The two settlement memories below are pure diagnostics: they exist so a
 * late deferral or a second `settle` reports the code that names what
 * happened instead of a misleading one. `causes` is already bounded by
 * `maxPendingCauses`, and leaving these two unbounded would make the binder
 * the only thing in a voice session that grows with its length.
 */
function createSettledMemory(): {
  has(id: string): boolean;
  add(id: string): void;
  clear(): void;
} {
  const ids: Set<string> = new Set();
  const order: string[] = [];
  return {
    has(id: string): boolean {
      return ids.has(id);
    },
    add(id: string): void {
      if (ids.has(id)) return;
      ids.add(id);
      order.push(id);
      while (order.length > SETTLED_MEMORY) {
        const oldest: string | undefined = order.shift();
        if (oldest === undefined) break;
        ids.delete(oldest);
      }
    },
    clear(): void {
      ids.clear();
      order.length = 0;
    },
  };
}

function usableId(value: unknown): string | null {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1024
    ? value
    : null;
}

function freezeReport(
  causeResponseId: string,
  settlement: RenditionSettlement,
): DeliveryReport {
  const readbackHash: string | undefined = settlement.readbackHash;
  const attestation: ReadbackAttestation | undefined = settlement.attestation;
  return Object.freeze({
    responseId: causeResponseId,
    outcome: settlement.outcome,
    ...(readbackHash === undefined ? {} : { readbackHash }),
    ...(attestation === undefined ? {} : { attestation }),
  });
}

export function createRenditionBinder(
  config: RenditionBinderConfig = {},
): RenditionBinder {
  const evidence: RenditionEvidence =
    config.renditionEvidence === "generation-end"
      ? "generation-end"
      : "explicit";
  const maxPendingCauses: number =
    config.maxPendingCauses === undefined ||
    !Number.isSafeInteger(config.maxPendingCauses) ||
    config.maxPendingCauses < 1
      ? DEFAULT_MAX_PENDING_CAUSES
      : config.maxPendingCauses;
  const onIssue: ((issue: RenditionIssue) => void) | undefined = config.onIssue;

  const causes: Map<string, DeliveryEffect[]> = new Map();
  const causeToRendition: Map<string, string> = new Map();
  const renditionToCauses: Map<string, string[]> = new Map();
  const started: Set<string> = new Set();
  const settledCauses = createSettledMemory();
  const settledRenditions = createSettledMemory();

  function reportIssue(issue: RenditionIssue): void {
    if (onIssue !== undefined) {
      try {
        onIssue(issue);
      } catch {
        // A diagnostic sink cannot become control flow.
      }
      return;
    }
    warnHost(
      `concierge: [rendition_${issue.code}] ${issue.message}`,
    );
  }

  function invokeEffects(
    causeResponseId: string,
    effects: readonly DeliveryEffect[],
    report: DeliveryReport,
  ): void {
    for (const effect of effects) {
      try {
        effect(report);
      } catch {
        reportIssue({
          code: "effect_threw",
          causeResponseId,
          renditionResponseId: causeToRendition.get(causeResponseId) ?? null,
          message:
            `an effect for cause ${encodeDiagnosticSubject(causeResponseId)} threw; remaining effects still ran.`,
        });
      }
    }
  }

  function settleCause(
    causeResponseId: string,
    settlement: RenditionSettlement,
  ): void {
    const effects: DeliveryEffect[] = causes.get(causeResponseId) ?? [];
    const rendition: string | undefined = causeToRendition.get(causeResponseId);
    causes.delete(causeResponseId);
    causeToRendition.delete(causeResponseId);
    if (rendition !== undefined) {
      const siblings: string[] = (renditionToCauses.get(rendition) ?? [])
        .filter((id) => id !== causeResponseId);
      if (siblings.length === 0) {
        renditionToCauses.delete(rendition);
        started.delete(rendition);
      } else {
        renditionToCauses.set(rendition, siblings);
      }
    }
    settledCauses.add(causeResponseId);
    invokeEffects(
      causeResponseId,
      effects,
      freezeReport(causeResponseId, settlement),
    );
  }

  function evictIfNeeded(): void {
    while (causes.size > maxPendingCauses) {
      const oldest: string | undefined = causes.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      reportIssue({
        code: "capacity_evicted",
        causeResponseId: oldest,
        renditionResponseId: causeToRendition.get(oldest) ?? null,
        message:
          `the oldest pending cause ${encodeDiagnosticSubject(oldest)} was settled interrupted to stay bounded.`,
      });
      settleCause(oldest, { outcome: "interrupted" });
    }
  }

  const binder: RenditionBinder = {
    deferralsFor(causeResponseId: string): NonNullable<
      ToolBatch["deferUntilDelivered"]
    > {
      const cause: string | null = usableId(causeResponseId);
      return (effect: DeliveryEffect): void => {
        if (cause === null) {
          effect(freezeReport("", { outcome: "interrupted" }));
          return;
        }
        if (settledCauses.has(cause)) {
          reportIssue({
            code: "late_deferral",
            causeResponseId: cause,
            renditionResponseId: null,
            message:
              `a deferral for already-settled cause ${encodeDiagnosticSubject(cause)} ran immediately as interrupted.`,
          });
          effect(freezeReport(cause, { outcome: "interrupted" }));
          return;
        }
        let bucket: DeliveryEffect[] | undefined = causes.get(cause);
        if (bucket === undefined) {
          bucket = [];
          causes.set(cause, bucket);
          evictIfNeeded();
          if (!causes.has(cause)) {
            reportIssue({
              code: "late_deferral",
              causeResponseId: cause,
              renditionResponseId: null,
              message:
                `a deferral for already-settled cause ${encodeDiagnosticSubject(cause)} ran immediately as interrupted.`,
            });
            effect(freezeReport(cause, { outcome: "interrupted" }));
            return;
          }
        }
        bucket.push(effect);
      };
    },

    bindRendition(link: {
      readonly cause: string;
      readonly rendition: string;
    }): void {
      const cause: string | null = usableId(link.cause);
      const rendition: string | null = usableId(link.rendition);
      if (cause === null || rendition === null) {
        return;
      }
      if (!causes.has(cause)) {
        return;
      }
      const existing: string | undefined = causeToRendition.get(cause);
      if (existing !== undefined) {
        reportIssue({
          code: "cause_already_bound",
          causeResponseId: cause,
          renditionResponseId: rendition,
          message:
            `cause ${encodeDiagnosticSubject(cause)} already holds deferrals bound to ${encodeDiagnosticSubject(existing)}.`,
        });
        return;
      }
      causeToRendition.set(cause, rendition);
      const group: string[] = renditionToCauses.get(rendition) ?? [];
      group.push(cause);
      renditionToCauses.set(rendition, group);
    },

    renditionStarted(renditionResponseId: string): void {
      const id: string | null = usableId(renditionResponseId);
      if (id === null) {
        return;
      }
      started.add(id);
    },

    generationEnded(renditionResponseId: string): void {
      const id: string | null = usableId(renditionResponseId);
      if (id === null) {
        return;
      }
      if (evidence === "generation-end") {
        binder.settle(id, { outcome: "completed" });
        return;
      }
      if (!started.has(id)) {
        binder.settle(id, { outcome: "interrupted" });
      }
    },

    settle(renditionResponseId: string, settlement: RenditionSettlement): void {
      const id: string | null = usableId(renditionResponseId);
      if (id === null) {
        return;
      }
      const bound: string[] | undefined = renditionToCauses.get(id);
      if (bound === undefined) {
        // **Two different situations, two different codes.** The first
        // settlement deletes the rendition's bindings, so a second one looked
        // identical to a settlement for a rendition that never had a cause —
        // and reported `unbound_rendition`, sending a reader after a binding
        // bug that does not exist. `duplicate_settlement` was declared for
        // exactly this and had no producer.
        reportIssue(
          settledRenditions.has(id)
            ? {
                code: "duplicate_settlement",
                causeResponseId: null,
                renditionResponseId: id,
                message:
                  `rendition ${encodeDiagnosticSubject(id)} was already settled; the second settlement was ignored.`,
              }
            : {
                code: "unbound_rendition",
                causeResponseId: null,
                renditionResponseId: id,
                message:
                  `settlement named rendition ${encodeDiagnosticSubject(id)} with no bound cause.`,
              },
        );
        return;
      }
      const causesToSettle: string[] = [...bound];
      renditionToCauses.delete(id);
      started.delete(id);
      settledRenditions.add(id);
      for (const cause of causesToSettle) {
        causeToRendition.delete(cause);
        const effects: DeliveryEffect[] = causes.get(cause) ?? [];
        causes.delete(cause);
        settledCauses.add(cause);
        invokeEffects(cause, effects, freezeReport(cause, settlement));
      }
    },

    abandonCause(causeResponseId: string): void {
      const cause: string | null = usableId(causeResponseId);
      if (cause === null || !causes.has(cause)) {
        return;
      }
      settleCause(cause, { outcome: "interrupted" });
    },

    abandonUnstarted(): void {
      const unbound: string[] = [];
      for (const cause of causes.keys()) {
        if (!causeToRendition.has(cause)) {
          unbound.push(cause);
        }
      }
      for (const cause of unbound) {
        settleCause(cause, { outcome: "interrupted" });
      }
      const unstartedRenditions: string[] = [];
      for (const rendition of renditionToCauses.keys()) {
        if (!started.has(rendition)) {
          unstartedRenditions.push(rendition);
        }
      }
      for (const rendition of unstartedRenditions) {
        binder.settle(rendition, { outcome: "interrupted" });
      }
    },

    abandonAll(): void {
      const pending: string[] = [...causes.keys()];
      for (const cause of pending) {
        settleCause(cause, { outcome: "interrupted" });
      }
      causes.clear();
      causeToRendition.clear();
      renditionToCauses.clear();
      started.clear();
      settledCauses.clear();
      settledRenditions.clear();
    },

    pendingCauses(): ReadonlyArray<string> {
      return Object.freeze([...causes.keys()]);
    },
  };

  return Object.freeze(binder);
}
