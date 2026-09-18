/**
 * Public types for `@full-self-browsing/concierge-dom`.
 *
 * This package never finds an element. Every element that can come back out
 * was supplied by the application at registration. Types therefore carry
 * keys, reports, and statuses — not selectors, predicates, or coordinates.
 */

import type { AbortSignalLike, Scheduler } from "@full-self-browsing/concierge";

/** The nearest self-or-ancestor attribute that removes an element from the UI. */
export type HiddenByAttribute = "hidden" | "inert" | "aria-hidden";

/** The nearest self-or-ancestor computed style that removes it. */
export type HiddenByStyle = "display" | "visibility" | "content-visibility";

/**
 * A structured, policy-free report. Callers apply {@link isRendered} /
 * {@link isReadable}, or their own rule. `hasLayout` is reported and is
 * consulted by neither shipped policy.
 */
export interface VisibilityReport {
  readonly connected: boolean;
  readonly hiddenBy: HiddenByAttribute | null;
  readonly styledOutBy: HiddenByStyle | null;
  /** `aria-busy="true"` on the element or any ancestor. */
  readonly busy: boolean;
  /** Environment-dependent. Always `false` under jsdom. */
  readonly hasLayout: boolean;
  /** How many ancestors were walked. Bounded by {@link ANCESTOR_WALK_LIMIT}. */
  readonly depth: number;
}

export interface AnchorOptions {
  /**
   * Permit text extraction of this element's subtree. Default false.
   * Readability is declared at render time; it is never inferred from markup.
   */
  readonly readable?: boolean | undefined;
}

/**
 * A ref callback that registers an element and hands back the cleanup for
 * *that* element.
 *
 * Returning the cleanup is what makes a key holding several simultaneously
 * mounted nodes exact: React 19 calls the returned function on unmount and
 * never calls back with `null`, so each site releases the node it attached.
 * React 18 ignores the return value and calls `ref(null)` instead, naming no
 * element — see `createAnchorRegistry` for what that path can and cannot
 * recover. The union keeps this assignable to React 18's `void`-returning
 * `Ref<T>` and to React 19's `RefCallback<T>` alike.
 */
export type AnchorRef = (
  element: HTMLElement | null,
) => (() => void) | void;

/** A Svelte `use:` action. Same registration, different calling convention. */
export type AnchorAction = (node: HTMLElement) => { destroy: () => void };

export interface ResolveOptions {
  /**
   * Prefer a registration contained by this element. The application passes
   * an element it already registered (an open dialog, a sheet). No selector.
   */
  readonly within?: HTMLElement | null | undefined;
}

export type ResolveStatus =
  | "rendered"
  | "not-rendered"
  | "not-registered";

export interface AnchorResolution {
  readonly status: ResolveStatus;
  readonly element: HTMLElement | null;
  readonly report: VisibilityReport | null;
  readonly registered: number;
}

export interface RevealOptions extends ResolveOptions {
  readonly defer?: "none" | "frame" | undefined;
  readonly block?: "start" | "center" | "end" | "nearest" | undefined;
  readonly offsetTop?: number | undefined;
  readonly behavior?: "auto" | "smooth" | undefined;
  readonly markMs?: number | undefined;
  readonly signal?: AbortSignalLike | undefined;
}

export type RevealStatus = ResolveStatus | "revealed" | "aborted";

export interface RevealOutcome {
  readonly status: RevealStatus;
  readonly element: HTMLElement | null;
  readonly report: VisibilityReport | null;
}

export interface ReadOptions extends ResolveOptions {
  readonly maxChars: number;
  readonly refuseWhileBusy?: boolean | undefined;
  readonly maxNodes?: number | undefined;
}

export type ReadStatus =
  | "read"
  | "not-registered"
  | "not-readable"
  | "not-rendered"
  | "busy"
  | "empty";

/**
 * Extracted application-rendered prose. `text` is untrusted: a CMS editor,
 * supplier feed, or review author can put anything in the tree, including
 * prompt-injection. An action that returns it must declare `readsUntrusted`.
 * This value is not a consent artifact and does not prove a human saw it.
 */
export interface ReadOutcome {
  readonly status: ReadStatus;
  readonly text: string;
  readonly truncated: boolean;
  readonly visited: number;
  readonly report: VisibilityReport | null;
}

export interface AnchorRegistryOptions {
  readonly id?: string | undefined;
  readonly scheduler?: Scheduler | undefined;
  readonly frame?: ((fn: () => void) => () => void) | undefined;
  readonly frameFallbackMs?: number | undefined;
}

export interface AnchorRegistry {
  readonly id: string;
  ref: (key: string, options?: AnchorOptions) => AnchorRef;
  action: (key: string, options?: AnchorOptions) => AnchorAction;
  register: (
    key: string,
    element: HTMLElement,
    options?: AnchorOptions,
  ) => () => void;
  resolve: (key: string, options?: ResolveOptions) => AnchorResolution;
  reveal: (key: string, options?: RevealOptions) => Promise<RevealOutcome>;
  readUntrusted: (key: string, options: ReadOptions) => ReadOutcome;
  keys: () => readonly string[];
  clear: () => void;
}

export type ViewportDirection = "up" | "down" | "top" | "bottom";

export interface ViewportScrollOptions {
  readonly step?: number | undefined;
  readonly behavior?: "auto" | "smooth" | undefined;
}

export interface ViewportPosition {
  readonly scrollTop: number;
  readonly maxScrollTop: number;
  readonly atTop: boolean;
  readonly atBottom: boolean;
}
