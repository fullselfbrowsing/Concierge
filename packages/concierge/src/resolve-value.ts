/**
 * Resolve a spoken or typed string onto a member of a caller-supplied list.
 *
 * Safety: an ok match is Object.is-equal to some input item. The function
 * never constructs a stand-in. Ties at the winning score are ambiguous.
 */

export type ResolveValueRefusal = "no-match" | "ambiguous" | "rejected";

export type ResolveValueResult<T> =
  | { readonly ok: true; readonly match: T }
  | {
      readonly ok: false;
      readonly reason: ResolveValueRefusal;
      readonly candidates?: readonly T[];
    };

export interface ResolveValueConfig<T> {
  readonly getLabel: (item: T) => string;
  readonly getIdentity?: ((item: T) => string) | undefined;
  readonly normalize?: ((label: string) => string) | undefined;
  readonly allowed?: ((raw: string) => boolean) | undefined;
  readonly maxRawLength?: number | undefined;
  readonly minRawLength?: number | undefined;
  readonly maxDistance?: number | ((normalizedLength: number) => number);
  readonly maxAmbiguous?: number | undefined;
}

function defaultNormalize(label: string): string {
  return label.trim().replace(/\s+/gu, " ").toLowerCase();
}

function defaultMaxDistance(normalizedLength: number): number {
  return Math.min(2, Math.max(1, Math.floor(normalizedLength / 4)));
}

function levenshtein(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }
  const previous: number[] = [];
  const current: number[] = [];
  for (let j: number = 0; j <= right.length; j += 1) {
    previous[j] = j;
  }
  for (let i: number = 1; i <= left.length; i += 1) {
    current[0] = i;
    const leftChar: string = left.charAt(i - 1);
    for (let j: number = 1; j <= right.length; j += 1) {
      const substitution: number =
        leftChar === right.charAt(j - 1) ? 0 : 1;
      const deletion: number = (current[j - 1] ?? 0) + 1;
      const insertion: number = (previous[j] ?? 0) + 1;
      const swap: number = (previous[j - 1] ?? 0) + substitution;
      current[j] = Math.min(deletion, insertion, swap);
    }
    for (let j: number = 0; j <= right.length; j += 1) {
      previous[j] = current[j] ?? 0;
    }
  }
  return previous[right.length] ?? Math.max(left.length, right.length);
}

function refuse<T>(
  reason: ResolveValueRefusal,
  candidates?: readonly T[],
): ResolveValueResult<T> {
  return candidates === undefined
    ? { ok: false, reason }
    : { ok: false, reason, candidates };
}

export function resolveValue<T>(
  raw: string,
  candidates: readonly T[],
  config: ResolveValueConfig<T>,
): ResolveValueResult<T> {
  const maxRawLength: number = config.maxRawLength ?? 128;
  const minRawLength: number = config.minRawLength ?? 2;
  if (
    typeof raw !== "string" ||
    raw.length < minRawLength ||
    raw.length > maxRawLength
  ) {
    return refuse("rejected");
  }
  if (config.allowed !== undefined) {
    try {
      if (config.allowed(raw) !== true) {
        return refuse("rejected");
      }
    } catch {
      return refuse("rejected");
    }
  }

  const normalize: (label: string) => string = config.normalize ??
    defaultNormalize;
  let query: string;
  try {
    query = normalize(raw);
  } catch {
    return refuse("no-match");
  }
  if (query.length === 0) {
    return refuse("no-match");
  }

  const getIdentity: (item: T) => string = config.getIdentity ??
    config.getLabel;
  const maxAmbiguous: number = Math.max(2, config.maxAmbiguous ?? 2);
  const threshold: number = typeof config.maxDistance === "function"
    ? config.maxDistance(query.length)
    : config.maxDistance === undefined
      ? defaultMaxDistance(query.length)
      : config.maxDistance;

  interface Prepared {
    readonly item: T;
    readonly label: string;
    readonly identity: string;
  }

  const prepared: Prepared[] = [];
  for (const item of candidates) {
    let label: string;
    try {
      label = normalize(config.getLabel(item));
    } catch {
      continue;
    }
    let identity: string;
    try {
      identity = getIdentity(item);
    } catch {
      continue;
    }
    if (typeof label !== "string" || typeof identity !== "string") {
      continue;
    }
    prepared.push({ item, label, identity });
  }

  if (prepared.length === 0) {
    return refuse("no-match");
  }

  const exactIdentity: Prepared[] = prepared.filter(
    (row) => row.label === query,
  );
  if (exactIdentity.length === 1) {
    const only: Prepared = exactIdentity[0]!;
    const sameLabelDifferentId: boolean = prepared.some(
      (row) =>
        row.label === query &&
        row.identity !== only.identity &&
        !Object.is(row.item, only.item),
    );
    if (sameLabelDifferentId) {
      const tied: T[] = exactIdentity
        .filter((row, index, rows) =>
          rows.findIndex((other) => other.identity === row.identity) === index
        )
        .map((row) => row.item)
        .slice(0, maxAmbiguous);
      if (tied.length >= 2) {
        return refuse("ambiguous", Object.freeze(tied));
      }
    }
    return { ok: true, match: only.item };
  }
  if (exactIdentity.length > 1) {
    const identities: Set<string> = new Set(
      exactIdentity.map((row) => row.identity),
    );
    if (identities.size === 1) {
      return { ok: true, match: exactIdentity[0]!.item };
    }
    return refuse(
      "ambiguous",
      Object.freeze(exactIdentity.map((row) => row.item).slice(0, maxAmbiguous)),
    );
  }

  const uniqueSubstring: Prepared[] = prepared.filter(
    (row) => row.label.includes(query) || query.includes(row.label),
  );
  if (uniqueSubstring.length === 1) {
    return { ok: true, match: uniqueSubstring[0]!.item };
  }
  if (uniqueSubstring.length > 1) {
    return refuse(
      "ambiguous",
      Object.freeze(
        uniqueSubstring.map((row) => row.item).slice(0, maxAmbiguous),
      ),
    );
  }

  if (threshold <= 0) {
    return refuse("no-match");
  }

  let bestDistance: number = threshold + 1;
  const distanceHits: Prepared[] = [];
  for (const row of prepared) {
    const distance: number = levenshtein(query, row.label);
    if (distance > threshold) {
      continue;
    }
    if (distance < bestDistance) {
      bestDistance = distance;
      distanceHits.length = 0;
      distanceHits.push(row);
      continue;
    }
    if (distance === bestDistance) {
      distanceHits.push(row);
    }
  }
  if (distanceHits.length === 1) {
    return { ok: true, match: distanceHits[0]!.item };
  }
  if (distanceHits.length > 1) {
    return refuse(
      "ambiguous",
      Object.freeze(distanceHits.map((row) => row.item).slice(0, maxAmbiguous)),
    );
  }
  return refuse("no-match");
}
