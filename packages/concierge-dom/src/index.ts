/**
 * `@full-self-browsing/concierge-dom` — framework-neutral visible-element
 * resolve, reveal, and untrusted readback.
 *
 * The catalog-boundary rule, stated once: this package never finds an
 * element. It only hands back an element the application registered. There
 * is no selector, predicate, XPath, coordinate, tag filter, or attribute
 * filter in any public signature. The reachable set is exactly the set the
 * application's own render tree passed in.
 *
 * Nothing here is an ActionDefinition and nothing calls `defineAction`.
 * The model's reachable verb set is unchanged by adopting this package.
 *
 * Construction of a registry touches no global, so it is safe at a module
 * scope a server evaluates. Every other runtime export touches a document
 * or window capability when invoked, and none does when imported.
 */

export {
  ANCESTOR_WALK_LIMIT,
  EXPECTED_CORE_CONTRACT_VERSION,
  REVEAL_ATTRIBUTE,
} from "./constants.js";

export { isReadable, isRendered, measureVisibility } from "./visibility.js";

export {
  preferredScrollBehavior,
  readViewportPosition,
  scrollViewport,
} from "./viewport.js";

export { createAnchorRegistry } from "./registry.js";

export type {
  AnchorAction,
  AnchorOptions,
  AnchorRef,
  AnchorRegistry,
  AnchorRegistryOptions,
  AnchorResolution,
  HiddenByAttribute,
  HiddenByStyle,
  ReadOptions,
  ReadOutcome,
  ReadStatus,
  ResolveOptions,
  ResolveStatus,
  RevealOptions,
  RevealOutcome,
  RevealStatus,
  ViewportDirection,
  ViewportPosition,
  ViewportScrollOptions,
  VisibilityReport,
} from "./types.js";
