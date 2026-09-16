/**
 * Catalog-derived prompt fragments and policy tables.
 *
 * Descriptions are the action's model-facing string verbatim. No product
 * sentences are added. Same catalog + same options ⇒ identical string.
 */

import { MESSAGE_MAX_CHARS } from "./types.js";
import type {
  AnyActionDefinition,
  CatalogRevision,
  OutputRedactionPolicy,
  ResolvedCatalog,
  SideEffects,
} from "./types.js";
import { sanitizeText } from "./message.js";

export type CatalogPromptFormat = "markdown-list" | "plain";

export interface RenderCatalogPromptOptions {
  readonly format?: CatalogPromptFormat | undefined;
  readonly includeUnavailable?: boolean | undefined;
  readonly names?: readonly string[] | undefined;
  readonly includeParameters?: boolean | undefined;
}

export interface CatalogDerivedPolicy {
  readonly continuationSensitiveNames: readonly string[];
  readonly observerRedaction: { readonly [name: string]: OutputRedactionPolicy<unknown> };
  readonly sideEffects: { readonly [name: string]: SideEffects };
}

interface RememberedProjection {
  readonly available: ReadonlySet<string>;
  readonly allNames: readonly string[];
  readonly descriptions: Readonly<Record<string, string>>;
  readonly policy: CatalogDerivedPolicy;
}

const remembered: WeakMap<CatalogRevision, RememberedProjection> = new WeakMap();

function isContinuationSensitive(action: AnyActionDefinition): boolean {
  if (action.consent?.requires !== undefined) {
    return true;
  }
  if (action.effects?.destructive === true) {
    return true;
  }
  if (action.effects?.idempotent === false) {
    return true;
  }
  return false;
}

export function rememberCatalogProjection(
  revision: CatalogRevision,
  actions: readonly AnyActionDefinition[],
  availableNames: readonly string[],
): void {
  const available: Set<string> = new Set(availableNames);
  const continuationSensitiveNames: string[] = [];
  const observerRedaction: Record<string, OutputRedactionPolicy<unknown>> =
    Object.create(null);
  const sideEffects: Record<string, SideEffects> = Object.create(null);
  const descriptions: Record<string, string> = Object.create(null);
  const allNames: string[] = [];

  for (const action of actions) {
    allNames.push(action.name);
    descriptions[action.name] = action.description;
    if (isContinuationSensitive(action)) {
      continuationSensitiveNames.push(action.name);
    }
    observerRedaction[action.name] = action.output?.redact ?? "drop";
    sideEffects[action.name] = action.effects === undefined
      ? Object.freeze({})
      : Object.freeze({ ...action.effects });
  }

  remembered.set(
    revision,
    Object.freeze({
      available,
      allNames: Object.freeze([...allNames]),
      descriptions: Object.freeze(descriptions),
      policy: Object.freeze({
        continuationSensitiveNames: Object.freeze(continuationSensitiveNames),
        observerRedaction: Object.freeze(observerRedaction),
        sideEffects: Object.freeze(sideEffects),
      }),
    }),
  );
}

function wantedNames(
  catalog: ResolvedCatalog,
  options: RenderCatalogPromptOptions | undefined,
): readonly string[] {
  const filter: ReadonlySet<string> | null = options?.names === undefined
    ? null
    : new Set(options.names);
  const available: string[] = catalog.tools
    .map((tool) => tool.name)
    .filter((name) => filter === null || filter.has(name));
  return available;
}

function unavailableNames(
  catalog: ResolvedCatalog,
  options: RenderCatalogPromptOptions | undefined,
): readonly string[] {
  if (options?.includeUnavailable !== true) {
    return [];
  }
  const projection: RememberedProjection | undefined = remembered.get(
    catalog.revision,
  );
  const filter: ReadonlySet<string> | null = options.names === undefined
    ? null
    : new Set(options.names);
  if (projection === undefined) {
    return options.names === undefined
      ? []
      : options.names.filter(
          (name) => !catalog.tools.some((tool) => tool.name === name),
        );
  }
  return projection.allNames.filter((name) => {
    if (projection.available.has(name)) {
      return false;
    }
    return filter === null || filter.has(name);
  });
}

function toolLine(
  name: string,
  description: string,
  format: CatalogPromptFormat,
): string {
  const bounded: string = sanitizeText(description, {
    maxChars: MESSAGE_MAX_CHARS,
  });
  return format === "plain" ? `${name}: ${bounded}` : `- \`${name}\`: ${bounded}`;
}

export function renderCatalogPrompt(
  catalog: ResolvedCatalog,
  options?: RenderCatalogPromptOptions,
): string {
  const format: CatalogPromptFormat = options?.format === "plain"
    ? "plain"
    : "markdown-list";
  const projection: RememberedProjection | undefined = remembered.get(
    catalog.revision,
  );
  const lines: string[] = [];
  for (const name of wantedNames(catalog, options)) {
    const tool = catalog.tools.find((entry) => entry.name === name);
    const description: string = tool?.description ??
      projection?.descriptions[name] ??
      "";
    lines.push(toolLine(name, description, format));
  }
  const unavailable: readonly string[] = unavailableNames(catalog, options);
  if (unavailable.length > 0) {
    lines.push(format === "plain" ? "unavailable:" : "## unavailable");
    for (const name of unavailable) {
      const description: string = projection?.descriptions[name] ?? "";
      lines.push(toolLine(name, description, format));
    }
  }
  return lines.join("\n");
}

export function catalogDerivedPolicy(
  catalog: ResolvedCatalog,
): CatalogDerivedPolicy {
  const projection: RememberedProjection | undefined = remembered.get(
    catalog.revision,
  );
  if (projection !== undefined) {
    return projection.policy;
  }
  const observerRedaction: Record<string, OutputRedactionPolicy<unknown>> =
    Object.create(null);
  const sideEffects: Record<string, SideEffects> = Object.create(null);
  for (const tool of catalog.tools) {
    observerRedaction[tool.name] = "drop";
    sideEffects[tool.name] = Object.freeze({});
  }
  return Object.freeze({
    continuationSensitiveNames: Object.freeze([]),
    observerRedaction: Object.freeze(observerRedaction),
    sideEffects: Object.freeze(sideEffects),
  });
}
