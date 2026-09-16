/**
 * Fixed literals for `@full-self-browsing/concierge-dom`.
 *
 * The core contract pin is a literal, not a runtime read of core, so a
 * mismatched install fails on the first registration rather than agreeing
 * with whichever core happened to load. This package peers on contract v4.
 *
 * The reveal attribute name is a module constant so no caller-supplied
 * string ever reaches an attribute-name position.
 */

export const EXPECTED_CORE_CONTRACT_VERSION: 4 = 4;

export const ANCESTOR_WALK_LIMIT: 512 = 512;

export const REVEAL_ATTRIBUTE: "data-concierge-reveal" = "data-concierge-reveal";

/** dataset key for {@link REVEAL_ATTRIBUTE}. Not a caller-supplied name. */
export const REVEAL_DATASET_KEY: "conciergeReveal" = "conciergeReveal";
