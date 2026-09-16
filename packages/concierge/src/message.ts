/**
 * Internal message safety helpers shared by the bridge and dispatcher.
 *
 * Bounding and sanitizing are deliberately separate operations. Bounding
 * removes no character a consumer wrote unless the message exceeds the shared
 * limit, and it never emits half of a surrogate pair. Sanitizing is the
 * stronger dispatcher-boundary policy: replace C0/C1 controls, normalize
 * whitespace, trim, and then apply that same bound.
 *
 * `sanitizeMessage` stays the dispatcher-bound wrapper so existing tests pin
 * byte-identical output. `sanitizeText` is the public generalization.
 */

import { MESSAGE_MAX_CHARS } from "./types.js";

/** Options for {@link sanitizeText}. */
export interface SanitizeTextOptions {
  readonly maxChars?: number | undefined;
  readonly ellipsis?: boolean | undefined;
}

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
  return boundText(message, MESSAGE_MAX_CHARS, false);
}

/**
 * Sanitize untrusted text: C0/C1 runs become one ASCII space, remaining
 * whitespace collapses, then a surrogate-safe bound is applied.
 */
export function sanitizeText(
  input: string,
  options?: SanitizeTextOptions,
): string {
  const maxChars: number = options?.maxChars ?? MESSAGE_MAX_CHARS;
  const ellipsis: boolean = options?.ellipsis === true;
  const sanitized: string = input
    .replace(/[\u0000-\u001f\u007f-\u009f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return boundText(sanitized, maxChars, ellipsis);
}

/**
 * Sanitize a dispatcher-bound message in one fixed order (SEC-06).
 *
 * C0/C1 runs become one ASCII space first. All remaining whitespace runs then
 * collapse to one ASCII space, leading and trailing whitespace is trimmed, and
 * only then is the surrogate-safe shared bound applied.
 */
export function sanitizeMessage(message: string): string {
  return sanitizeText(message, { maxChars: MESSAGE_MAX_CHARS });
}

/**
 * The largest cut at or below `limit` that does not split a surrogate pair.
 *
 * Both cuts `boundText` makes go through here. The ellipsis cut needs it just
 * as much as the bound does: shortening a well-formed slice by one code unit
 * to make room for `…` strands a high surrogate whenever the slice ended on an
 * astral character, and a lone surrogate is not a well-formed UTF-16 string.
 * `consent-evidence.ts`'s `quoteString` rejects one outright, so a readback
 * assembled from truncated text would refuse with `payload_unsupported`.
 */
function surrogateSafeCut(value: string, limit: number): number {
  if (limit <= 0) {
    return 0;
  }
  const lastRetained: number = value.charCodeAt(limit - 1);
  return lastRetained >= 0xd800 && lastRetained <= 0xdbff ? limit - 1 : limit;
}

function boundText(message: string, maxChars: number, ellipsis: boolean): string {
  if (!Number.isSafeInteger(maxChars) || maxChars < 0) {
    return "";
  }
  if (message.length <= maxChars) {
    return message;
  }

  const sliced: string = message.slice(0, surrogateSafeCut(message, maxChars));
  if (!ellipsis) {
    return sliced;
  }
  if (sliced.length === 0) {
    return "";
  }
  return `${sliced.slice(0, surrogateSafeCut(sliced, sliced.length - 1))}…`;
}
