/**
 * Page-level viewport helpers.
 *
 * These are the only exports with no registry gate: they reach no element
 * and read no subtree back. They do throw if invoked where `window` and
 * `document` do not exist — that is the documented failure, not a silent
 * no-op. On a page with scroll-triggered loading, scrolling causes the
 * application to fetch; that is the application's own gesture.
 */

import type {
  ViewportDirection,
  ViewportPosition,
  ViewportScrollOptions,
} from "./types.js";

const DEFAULT_STEP: number = 0.85;
const REDUCE_MOTION_QUERY: string = "(prefers-reduced-motion: reduce)";

/**
 * Re-read per call: the preference can change mid-session.
 *
 * **Unknown resolves to `"auto"`, not `"smooth"`.** This is the default for
 * every `reveal()` and `scrollViewport()` that omits `behavior`, so a host
 * that cannot report the reduced-motion preference — no `matchMedia`, or one
 * that throws — must not be animated on the assumption that it is fine. The
 * preference is only honoured in the affirmative.
 */
export function preferredScrollBehavior(): "auto" | "smooth" {
  const matchMedia: typeof globalThis.matchMedia | undefined =
    globalThis.matchMedia;
  if (typeof matchMedia !== "function") {
    return "auto";
  }
  try {
    return matchMedia(REDUCE_MOTION_QUERY).matches ? "auto" : "smooth";
  } catch {
    return "auto";
  }
}

export function readViewportPosition(): ViewportPosition {
  const root: HTMLElement = document.documentElement;
  const scrollTop: number = window.scrollY;
  const maxScrollTop: number = Math.max(0, root.scrollHeight - root.clientHeight);
  return {
    scrollTop,
    maxScrollTop,
    atTop: scrollTop <= 0,
    atBottom: scrollTop >= maxScrollTop,
  };
}

/**
 * Page-level scroll. Returns the clamped target position, not the settled
 * position — a smooth scroll has not finished when this returns.
 */
export function scrollViewport(
  direction: ViewportDirection,
  options: ViewportScrollOptions = {},
): ViewportPosition {
  const current: ViewportPosition = readViewportPosition();
  const step: number = options.step ?? DEFAULT_STEP;
  const behavior: ScrollBehavior = options.behavior ?? preferredScrollBehavior();
  const page: number =
    (window.innerHeight || document.documentElement.clientHeight) * step;

  let target: number = current.scrollTop;
  switch (direction) {
    case "up":
      target = current.scrollTop - page;
      break;
    case "down":
      target = current.scrollTop + page;
      break;
    case "top":
      target = 0;
      break;
    case "bottom":
      target = current.maxScrollTop;
      break;
  }

  const scrollTop: number = Math.min(
    current.maxScrollTop,
    Math.max(0, target),
  );
  window.scrollTo({ top: scrollTop, behavior });
  return {
    scrollTop,
    maxScrollTop: current.maxScrollTop,
    atTop: scrollTop <= 0,
    atBottom: scrollTop >= current.maxScrollTop,
  };
}
