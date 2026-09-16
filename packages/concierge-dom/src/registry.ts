/**
 * Anchor registry — the application hands elements over under keys it owns.
 *
 * Mutable state lives in `let` bindings inside the factory, never at module
 * scope: a long-lived server reuses this module across requests, and a
 * module-scope token counter would hand one request's tokens to another
 * registry. `assertSingleInstance` and the contract-version check run on
 * the first registration of a registry's life, never at construction and
 * never at module evaluation (`sideEffects: false` would delete that).
 *
 * The returned object is frozen. The registry is a capability; leaving
 * `resolve` writable lets same-realm script swap it for a function that
 * returns attacker-chosen elements while every check upstream still
 * reports success. Freezing the object does not freeze the closure.
 */

import {
  assertSingleInstance,
  CONTRACT_VERSION,
  sanitizeText,
} from "@full-self-browsing/concierge";
import type { AbortSignalLike, Scheduler } from "@full-self-browsing/concierge";

import {
  EXPECTED_CORE_CONTRACT_VERSION,
  REVEAL_DATASET_KEY,
} from "./constants.js";
import type {
  AnchorAction,
  AnchorOptions,
  AnchorRef,
  AnchorRegistry,
  AnchorRegistryOptions,
  AnchorResolution,
  ReadOptions,
  ReadOutcome,
  ResolveOptions,
  RevealOptions,
  RevealOutcome,
  VisibilityReport,
} from "./types.js";
import { isRendered, measureVisibility } from "./visibility.js";
import { preferredScrollBehavior } from "./viewport.js";

interface Registration {
  readonly token: number;
  readonly element: HTMLElement;
  readonly readable: boolean;
}

interface PendingMark {
  readonly cancel: () => void;
  readonly element: HTMLElement;
}

type FrameWait = "proceed" | "aborted";

const SKIPPED_TAGS: ReadonlySet<string> = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "SVG",
  "IFRAME",
  "OBJECT",
]);

const DEFAULT_MAX_NODES: number = 2000;
const DEFAULT_FRAME_FALLBACK_MS: number = 100;
const RAW_LENGTH_FACTOR: number = 4;

function defaultScheduler(fn: () => void, delayMs: number): () => void {
  const handle: ReturnType<typeof setTimeout> = setTimeout(fn, delayMs);
  return (): void => {
    clearTimeout(handle);
  };
}

function defaultFrame(fn: () => void): () => void {
  const handle: number = requestAnimationFrame((): void => {
    fn();
  });
  return (): void => {
    cancelAnimationFrame(handle);
  };
}

function abortedOutcome(): RevealOutcome {
  return { status: "aborted", element: null, report: null };
}

function emptyRead(status: ReadOutcome["status"], report: VisibilityReport | null): ReadOutcome {
  return {
    status,
    text: "",
    truncated: false,
    visited: 0,
    report,
  };
}

function applyRevealMark(element: HTMLElement): void {
  element.dataset[REVEAL_DATASET_KEY] = "true";
}

function clearRevealMark(element: HTMLElement): void {
  delete element.dataset[REVEAL_DATASET_KEY];
}

function scrollWinner(
  element: HTMLElement,
  block: ScrollLogicalPosition,
  behavior: ScrollBehavior,
  offsetTop: number,
): void {
  if (block === "start" && offsetTop > 0) {
    const top: number =
      element.getBoundingClientRect().top + window.scrollY - offsetTop;
    window.scrollTo({ top, behavior });
    return;
  }
  if (typeof element.scrollIntoView === "function") {
    element.scrollIntoView({ behavior, block });
  }
}

function extractVisibleText(
  root: HTMLElement,
  maxChars: number,
  maxNodes: number,
): { readonly raw: string; readonly visited: number; readonly stopped: boolean } {
  let raw: string = "";
  let visited: number = 0;
  let stopped: boolean = false;
  const rawLimit: number = maxChars * RAW_LENGTH_FACTOR;

  const visit = (node: Node): boolean => {
    if (visited >= maxNodes) {
      stopped = true;
      return false;
    }
    visited += 1;

    if (node.nodeType === Node.TEXT_NODE) {
      raw += node.nodeValue ?? "";
      if (raw.length > rawLimit) {
        stopped = true;
        return false;
      }
      return true;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return true;
    }

    const element: Element = node as Element;
    if (SKIPPED_TAGS.has(element.tagName.toUpperCase())) {
      return true;
    }

    if (element !== root && !isRendered(measureVisibility(element as HTMLElement))) {
      return true;
    }

    const children: NodeListOf<ChildNode> = element.childNodes;
    for (let index = 0; index < children.length; index += 1) {
      const child: ChildNode | undefined = children[index];
      if (child === undefined) {
        continue;
      }
      if (!visit(child)) {
        return false;
      }
    }
    return true;
  };

  visit(root);
  return { raw, visited, stopped };
}

function resolveFrom(
  entries: readonly Registration[],
  options: ResolveOptions = {},
): AnchorResolution {
  if (entries.length === 0) {
    return {
      status: "not-registered",
      element: null,
      report: null,
      registered: 0,
    };
  }

  const reports: VisibilityReport[] = entries.map(
    (entry): VisibilityReport => measureVisibility(entry.element),
  );
  const survivors: HTMLElement[] = [];
  const survivorReports: VisibilityReport[] = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry: Registration | undefined = entries[index];
    const report: VisibilityReport | undefined = reports[index];
    if (entry === undefined || report === undefined) {
      continue;
    }
    if (isRendered(report)) {
      survivors.push(entry.element);
      survivorReports.push(report);
    }
  }

  if (survivors.length === 0) {
    return {
      status: "not-rendered",
      element: null,
      report: reports[0] ?? null,
      registered: entries.length,
    };
  }

  const within: HTMLElement | null | undefined = options.within;
  let winner: HTMLElement = survivors[0] as HTMLElement;
  let winnerReport: VisibilityReport = survivorReports[0] as VisibilityReport;

  if (within != null && within.isConnected) {
    for (let index = 0; index < survivors.length; index += 1) {
      const candidate: HTMLElement | undefined = survivors[index];
      const report: VisibilityReport | undefined = survivorReports[index];
      if (candidate !== undefined && report !== undefined && within.contains(candidate)) {
        winner = candidate;
        winnerReport = report;
        break;
      }
    }
  }

  return {
    status: "rendered",
    element: winner,
    report: winnerReport,
    registered: entries.length,
  };
}

export function createAnchorRegistry(
  options: AnchorRegistryOptions = {},
): AnchorRegistry {
  const id: string = options.id ?? "";
  const scheduler: Scheduler = options.scheduler ?? defaultScheduler;
  const frame: (fn: () => void) => () => void = options.frame ?? defaultFrame;
  const frameFallbackMs: number = options.frameFallbackMs ?? DEFAULT_FRAME_FALLBACK_MS;

  const byKey: Map<string, Registration[]> = new Map();
  const refCallbacks: Map<string, AnchorRef> = new Map();
  const refOptions: Map<string, AnchorOptions> = new Map();
  // One release per ELEMENT, not one per key. A key holds a set of
  // registrations, and `ref(key)` returns one shared callback for every JSX
  // site using that key — so a single release slot made the second node
  // silently unregister the first. Kept at factory scope rather than in the
  // callback closure so `clear()` can drop every outstanding release.
  const refReleases: Map<string, Map<HTMLElement, () => void>> = new Map();
  const pendingFrames: Map<string, () => void> = new Map();
  const pendingMarks: Map<string, PendingMark> = new Map();

  let next: number = 0;
  let armed: boolean = false;
  let warnedOffset: boolean = false;

  const arm = (): void => {
    if (armed) {
      return;
    }
    assertSingleInstance();
    if (CONTRACT_VERSION !== EXPECTED_CORE_CONTRACT_VERSION) {
      throw new Error(
        `@full-self-browsing/concierge-dom expected core contract v${EXPECTED_CORE_CONTRACT_VERSION} ` +
          `but found v${CONTRACT_VERSION}; upgrade or reinstall ` +
          `@full-self-browsing/concierge-dom and @full-self-browsing/concierge together.`,
      );
    }
    armed = true;
  };

  const live = (key: string): Registration[] => byKey.get(key) ?? [];

  const cancelFrame = (key: string): void => {
    const cancel: (() => void) | undefined = pendingFrames.get(key);
    if (cancel !== undefined) {
      pendingFrames.delete(key);
      cancel();
    }
  };

  const cancelMark = (key: string): void => {
    const mark: PendingMark | undefined = pendingMarks.get(key);
    if (mark !== undefined) {
      pendingMarks.delete(key);
      mark.cancel();
      clearRevealMark(mark.element);
    }
  };

  const supersede = (key: string): void => {
    cancelFrame(key);
    cancelMark(key);
  };

  const register = (
    key: string,
    element: HTMLElement,
    registerOptions?: AnchorOptions,
  ): (() => void) => {
    arm();
    const token: number = ++next;
    const entry: Registration = {
      token,
      element,
      readable: registerOptions?.readable === true,
    };
    const existing: Registration[] | undefined = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, [entry]);
    } else {
      existing.push(entry);
    }

    return (): void => {
      const bucket: Registration[] | undefined = byKey.get(key);
      if (bucket === undefined) {
        return;
      }
      const index: number = bucket.findIndex(
        (candidate: Registration): boolean => candidate.token === token,
      );
      if (index < 0) {
        return;
      }
      bucket.splice(index, 1);
      if (bucket.length === 0) {
        byKey.delete(key);
      }
    };
  };

  const resolve = (
    key: string,
    resolveOptions: ResolveOptions = {},
  ): AnchorResolution => resolveFrom(live(key), resolveOptions);

  const waitForFrame = (
    key: string,
    signal: AbortSignalLike | undefined,
  ): Promise<FrameWait> =>
    new Promise<FrameWait>((settle: (result: FrameWait) => void): void => {
      let settled: boolean = false;
      // **`let`, not `const`, and called optionally.** `frame` and `scheduler`
      // are injected, and an injected double may invoke its callback
      // synchronously — `createTestScheduler` from
      // `@full-self-browsing/concierge/testing` does exactly that for
      // `delayMs <= 0`. With `const` declarations below `finish`, that
      // synchronous call reached them in the temporal dead zone and the whole
      // `reveal` rejected with a `ReferenceError` instead of returning an
      // outcome. Each handle is instead cancelled at its own call site when
      // the wait has already settled.
      let cancelScheduledFrame: (() => void) | undefined;
      let cancelFallback: (() => void) | undefined;
      let abortListenerAttached: boolean = false;

      const finish = (result: FrameWait): void => {
        if (settled) {
          return;
        }
        settled = true;
        pendingFrames.delete(key);
        cancelScheduledFrame?.();
        cancelScheduledFrame = undefined;
        cancelFallback?.();
        cancelFallback = undefined;
        if (abortListenerAttached && signal !== undefined) {
          abortListenerAttached = false;
          signal.removeEventListener("abort", onAbort);
        }
        settle(result);
      };

      const onAbort = (): void => {
        finish("aborted");
      };

      // Registered and wired BEFORE anything is scheduled, so an already
      // aborted signal never arms a timer it would only have to cancel.
      pendingFrames.set(key, (): void => {
        finish("aborted");
      });

      if (signal !== undefined) {
        if (signal.aborted) {
          finish("aborted");
          return;
        }
        signal.addEventListener("abort", onAbort);
        abortListenerAttached = true;
      }

      const scheduledFrame: () => void = frame((): void => {
        finish("proceed");
      });
      if (settled) {
        scheduledFrame();
        return;
      }
      cancelScheduledFrame = scheduledFrame;

      const scheduledFallback: () => void = scheduler((): void => {
        finish("proceed");
      }, frameFallbackMs);
      if (settled) {
        scheduledFallback();
        return;
      }
      cancelFallback = scheduledFallback;
    });

  const finishReveal = (
    key: string,
    resolution: AnchorResolution,
    revealOptions: RevealOptions,
  ): RevealOutcome => {
    const element: HTMLElement | null = resolution.element;
    const report: VisibilityReport | null = resolution.report;
    if (element === null || report === null) {
      return {
        status: resolution.status,
        element: null,
        report,
      };
    }

    const block: ScrollLogicalPosition = revealOptions.block ?? "center";
    const offsetTop: number = revealOptions.offsetTop ?? 0;
    const behavior: ScrollBehavior =
      revealOptions.behavior ?? preferredScrollBehavior();

    if (offsetTop > 0 && block !== "start" && !warnedOffset) {
      warnedOffset = true;
      console.warn(
        `@full-self-browsing/concierge-dom: offsetTop applies only with block "start"; it was ignored.`,
      );
    }

    scrollWinner(element, block, behavior, offsetTop);

    const markMs: number = revealOptions.markMs ?? 0;
    if (markMs > 0) {
      applyRevealMark(element);
      const cancel: () => void = scheduler((): void => {
        pendingMarks.delete(key);
        clearRevealMark(element);
      }, markMs);
      pendingMarks.set(key, { cancel, element });
    }

    return {
      status: "revealed",
      element,
      report,
    };
  };

  const reveal = async (
    key: string,
    revealOptions: RevealOptions = {},
  ): Promise<RevealOutcome> => {
    supersede(key);

    const signal: AbortSignalLike | undefined = revealOptions.signal;
    if (signal?.aborted === true) {
      return abortedOutcome();
    }

    const initial: AnchorResolution = resolve(key, revealOptions);
    if (initial.status !== "rendered") {
      return {
        status: initial.status,
        element: null,
        report: initial.report,
      };
    }

    if (revealOptions.defer === "frame") {
      const wait: FrameWait = await waitForFrame(key, signal);
      if (wait === "aborted") {
        return abortedOutcome();
      }
      const again: AnchorResolution = resolve(key, revealOptions);
      if (again.status !== "rendered") {
        return {
          status: again.status,
          element: null,
          report: again.report,
        };
      }
      return finishReveal(key, again, revealOptions);
    }

    return finishReveal(key, initial, revealOptions);
  };

  const readUntrusted = (
    key: string,
    readOptions: ReadOptions,
  ): ReadOutcome => {
    const entries: Registration[] = live(key);
    if (entries.length === 0) {
      return emptyRead("not-registered", null);
    }

    const readableEntries: Registration[] = entries.filter(
      (entry: Registration): boolean => entry.readable,
    );
    const first: Registration | undefined = entries[0];
    if (readableEntries.length === 0) {
      return emptyRead(
        "not-readable",
        first === undefined ? null : measureVisibility(first.element),
      );
    }

    const resolution: AnchorResolution = resolveFrom(readableEntries, readOptions);
    if (resolution.status !== "rendered" || resolution.element === null) {
      return emptyRead("not-rendered", resolution.report);
    }

    const refuseWhileBusy: boolean = readOptions.refuseWhileBusy !== false;
    if (refuseWhileBusy && resolution.report !== null && resolution.report.busy) {
      return emptyRead("busy", resolution.report);
    }

    const maxNodes: number = readOptions.maxNodes ?? DEFAULT_MAX_NODES;
    const extracted = extractVisibleText(
      resolution.element,
      readOptions.maxChars,
      maxNodes,
    );
    const uncapped: string = sanitizeText(extracted.raw, {
      maxChars: Number.MAX_SAFE_INTEGER,
    });
    const text: string = sanitizeText(extracted.raw, {
      maxChars: readOptions.maxChars,
      ellipsis: true,
    });
    const truncated: boolean =
      extracted.stopped || uncapped.length > readOptions.maxChars;

    if (text.length === 0) {
      return {
        status: "empty",
        text: "",
        truncated: false,
        visited: extracted.visited,
        report: resolution.report,
      };
    }

    return {
      status: "read",
      text,
      truncated,
      visited: extracted.visited,
      report: resolution.report,
    };
  };

  /**
   * Release one element's registration and forget it.
   *
   * Split out so the cleanup a caller holds and the bare-`null` detach path
   * below cannot drift onto different bookkeeping.
   */
  const releaseRefElement = (
    key: string,
    element: HTMLElement,
    held: Map<HTMLElement, () => void>,
  ): void => {
    const release: (() => void) | undefined = held.get(element);
    if (release === undefined) {
      return;
    }
    held.delete(element);
    if (held.size === 0) {
      refReleases.delete(key);
    }
    release();
  };

  const ref = (key: string, refOpts?: AnchorOptions): AnchorRef => {
    if (refOpts !== undefined) {
      refOptions.set(key, refOpts);
    }
    const existing: AnchorRef | undefined = refCallbacks.get(key);
    if (existing !== undefined) {
      return existing;
    }

    // **One callback identity per key, many live elements under it.** The
    // identity is what makes `ref(key)` safe in JSX without memoisation, and
    // it is also why the callback cannot hold a single release: every JSX
    // site using this key calls the same function, so a lone slot made the
    // second mounted node evict the first.
    const callback: AnchorRef = (
      element: HTMLElement | null,
    ): (() => void) | void => {
      let held: Map<HTMLElement, () => void> | undefined = refReleases.get(key);

      // **Detach with no element is React 18's shape, and it is lossy.** The
      // caller does not say WHICH node left, so prefer the ones the document
      // can no longer reach; a disconnected registration never wins `resolve`
      // anyway, so dropping them is free. Only when none is disconnected does
      // this fall back to newest-first. React 19 callers never reach here —
      // they get the cleanup returned below, which names its own element.
      if (element === null) {
        if (held === undefined || held.size === 0) {
          return undefined;
        }
        const disconnected: HTMLElement[] = [...held.keys()].filter(
          (candidate: HTMLElement): boolean => !candidate.isConnected,
        );
        if (disconnected.length > 0) {
          for (const stale of disconnected) {
            releaseRefElement(key, stale, held);
          }
          return undefined;
        }
        const newest: HTMLElement | undefined = [...held.keys()].at(-1);
        if (newest !== undefined) {
          releaseRefElement(key, newest, held);
        }
        return undefined;
      }

      if (held?.has(element) === true) {
        const settled: Map<HTMLElement, () => void> = held;
        return (): void => {
          releaseRefElement(key, element, settled);
        };
      }

      if (held === undefined) {
        held = new Map<HTMLElement, () => void>();
        refReleases.set(key, held);
      }
      const bound: Map<HTMLElement, () => void> = held;
      bound.set(element, register(key, element, refOptions.get(key)));
      return (): void => {
        releaseRefElement(key, element, bound);
      };
    };
    refCallbacks.set(key, callback);
    return callback;
  };

  const action = (key: string, actionOptions?: AnchorOptions): AnchorAction => {
    return (node: HTMLElement): { destroy: () => void } => {
      const destroy: () => void = register(key, node, actionOptions);
      return { destroy };
    };
  };

  const keys = (): readonly string[] =>
    Object.freeze([...byKey.keys()].sort());

  const clear = (): void => {
    for (const key of [...pendingFrames.keys()]) {
      cancelFrame(key);
    }
    for (const key of [...pendingMarks.keys()]) {
      cancelMark(key);
    }
    byKey.clear();
    // The ref bookkeeping is dropped with the registrations it describes.
    // Left behind it would grow for the registry's lifetime and hand out
    // cleanups closing over releases that can no longer find their bucket.
    refReleases.clear();
    refCallbacks.clear();
    refOptions.clear();
  };

  const registry: AnchorRegistry = {
    id,
    ref,
    action,
    register,
    resolve,
    reveal,
    readUntrusted,
    keys,
    clear,
  };

  return Object.freeze(registry);
}
