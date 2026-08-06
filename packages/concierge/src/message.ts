/**
 * Internal message safety helpers shared by the bridge and dispatcher.
 *
 * Bounding and sanitizing are deliberately separate operations. Bounding
 * removes no character a consumer wrote unless the message exceeds the shared
 * limit, and it never emits half of a surrogate pair. Sanitizing is the
 * stronger dispatcher-boundary policy: replace C0/C1 controls, normalize
 * whitespace, trim, and then apply that same bound.
 *
 * Neither helper is part of the public barrel. They share
 * {@link MESSAGE_MAX_CHARS} so the bridge and dispatcher cannot silently drift
 * onto different limits.
 */

import { MESSAGE_MAX_CHARS } from "./types.js";

/**
 * Cut a message to {@link MESSAGE_MAX_CHARS} without splitting a surrogate
 * pair.
 *
 * `String.prototype.slice` cuts at UTF-16 code units. When the last retained
 * code unit is a high surrogate, the matching low surrogate would fall beyond
 * the bound, so the cut moves back by one and drops the pair whole. A low
 * surrogate at that position cannot be orphaned because its high half is
 * retained with it.
 */
export function boundedMessage(message: string): string {
  if (message.length <= MESSAGE_MAX_CHARS) {
    return message;
  }

  const lastRetained: number = message.charCodeAt(MESSAGE_MAX_CHARS - 1);
  const cut: number =
    lastRetained >= 0xd800 && lastRetained <= 0xdbff ? MESSAGE_MAX_CHARS - 1 : MESSAGE_MAX_CHARS;

  return message.slice(0, cut);
}

/**
 * Sanitize a dispatcher-bound message in one fixed order (SEC-06).
 *
 * C0/C1 runs become one ASCII space first. All remaining whitespace runs then
 * collapse to one ASCII space, leading and trailing whitespace is trimmed, and
 * only then is the surrogate-safe shared bound applied.
 */
export function sanitizeMessage(message: string): string {
  const sanitized: string = message
    .replace(/[\u0000-\u001f\u007f-\u009f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return boundedMessage(sanitized);
}
