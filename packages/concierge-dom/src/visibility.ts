/**
 * One measurement and two named policies.
 *
 * Walking uses `parentElement` and attribute/style facts only. Selector
 * helpers are out of bounds for this package: the catalog-boundary script
 * rejects them in the built artifact. `hasLayout` is reported and is
 * ignored by both shipped policies so jsdom tests exercise the real path.
 */

import { ANCESTOR_WALK_LIMIT } from "./constants.js";
import type {
  HiddenByAttribute,
  HiddenByStyle,
  VisibilityReport,
} from "./types.js";

function hidingAttribute(element: Element): HiddenByAttribute | null {
  if (element.hasAttribute("hidden")) {
    return "hidden";
  }
  if (element.hasAttribute("inert")) {
    return "inert";
  }
  if (element.getAttribute("aria-hidden") === "true") {
    return "aria-hidden";
  }
  return null;
}

function hidingStyle(element: Element): HiddenByStyle | null {
  const style: CSSStyleDeclaration = getComputedStyle(element);
  if (style.display === "none") {
    return "display";
  }
  if (style.visibility === "hidden" || style.visibility === "collapse") {
    return "visibility";
  }
  if (style.getPropertyValue("content-visibility") === "hidden") {
    return "content-visibility";
  }
  return null;
}

function isBusy(element: Element): boolean {
  return element.getAttribute("aria-busy") === "true";
}

/**
 * Walk the element and its ancestors. `getComputedStyle` runs once per
 * visited node. The walk stops at the first hiding attribute or style, and
 * never exceeds {@link ANCESTOR_WALK_LIMIT} hops.
 */
export function measureVisibility(element: HTMLElement): VisibilityReport {
  let hiddenBy: HiddenByAttribute | null = null;
  let styledOutBy: HiddenByStyle | null = null;
  let busy: boolean = false;
  let depth: number = 0;
  let current: Element | null = element;

  while (current !== null) {
    if (hiddenBy === null) {
      hiddenBy = hidingAttribute(current);
    }
    if (styledOutBy === null) {
      styledOutBy = hidingStyle(current);
    }
    if (!busy) {
      busy = isBusy(current);
    }
    if (hiddenBy !== null || styledOutBy !== null) {
      break;
    }
    if (depth >= ANCESTOR_WALK_LIMIT) {
      break;
    }
    const parent: HTMLElement | null = current.parentElement;
    if (parent === null) {
      break;
    }
    current = parent;
    depth += 1;
  }

  return {
    connected: element.isConnected,
    hiddenBy,
    styledOutBy,
    busy,
    hasLayout: element.getClientRects().length > 0,
    depth,
  };
}

/** Connected, no hiding attribute, no hiding style. Ignores busy and layout. */
export function isRendered(report: VisibilityReport): boolean {
  return (
    report.connected && report.hiddenBy === null && report.styledOutBy === null
  );
}

/** {@link isRendered} and not `aria-busy`. The skeleton-readback gate. */
export function isReadable(report: VisibilityReport): boolean {
  return isRendered(report) && !report.busy;
}
