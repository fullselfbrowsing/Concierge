# Contributing to Concierge

Concierge is a security-sensitive action runtime. A change is complete when its
types, runtime behavior, package boundary, examples, documentation, and
negative tests agree.

## Development setup

Requirements:

- Node 22.13 or newer for the pinned pnpm; public packages retain a Node 22.12
  consumer floor.
- Corepack with the repository's exact `pnpm@11.17.0`.
- Git with a clean worktree for release sealing.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
node scripts/release/check.mjs source
```

Do not commit generated `dist`, `.next`, local credentials, model output, or
release archives.

## Non-negotiable boundaries

- The catalog is least authority. Do not add generic click, selector,
  coordinate, URL-navigation, DOM-query, or arbitrary-JavaScript actions.
- `@full-self-browsing/concierge-dom` never finds an element; it only
  returns one the application registered. `scripts/pkg-dom-catalog-boundary.mjs`
  enforces that on the built artifact. Adding an identifier to that script's
  allow-set, or deleting a banned class, requires a threat model in the same
  pull request.
- Core remains framework-, DOM-, model-provider-, and transport-neutral.
- One physical core owns catalog revisions, bridge identity, consent,
  scheduling, deduplication, dispatch, workflow lineage, and terminal control.
  Adapters inject lifecycle and translate protocols; they do not reimplement
  the runtime.
- Getter-based snapshots stay live until core captures them. Framework reactive
  values must be detached by the appropriate normalizer before consent stores
  them.
- `dispatch` must not be wrapped in `async`; retries depend on returning the
  same Promise by reference.
- Packages remain ESM-only. A dual package can create two safety kernels.
- Client consent and signed browser reports are not server authorization.
- Raw AI SDK tool callbacks never actuate the page. Only a verified signed
  envelope enters the browser dispatcher.
- No unsigned fallback is allowed after a signature, replay, catalog, storage,
  presentation, or dispatch failure.

If a change intentionally alters one of these boundaries, include a threat
model, a contract-version decision, migration documentation, and mutation tests
in the same pull request.

## Declaring actions

Declare each action as its own `const` before placing it in a stage or
`crossStage`; contextual typing of an inline declaration loses its name literal.

Every action needs:

- a static, model-facing description;
- a Standard Schema validator and an emitted JSON Schema;
- explicit side-effect and idempotency declarations;
- a redaction policy suitable for dispatch observers;
- a handler that returns an `ActionResult` and does not leak exceptions;
- availability and consent rules where relevant;
- positive, negative, cancellation, and stale-catalog tests.

Use a compound action and core's `workflow` controls for an application-owned
sequence. Child calls must use stable step IDs. Do not put loops, delays, child
dispatch, or cleanup orchestration in a framework or AI adapter.

## Contract v4 changes

Contract v4 includes handler-proposed consent payloads, `attestReadback`,
catalog acknowledgement with deferred `setContext` promotion, vacuous
snapshot fail-closed, and the widened catalog diagnostic vocabulary.

An additive implementation detail does not require a contract bump. A change
that lets two versions disagree about bridge shape, revision capability,
invocation identity, consent records, batch/terminal semantics, event lineage,
or signed dispatch interpretation does. Contract changes require:

1. a synchronized minor release of all five packages;
2. every adapter's expected-contract guard to change together;
3. mismatch mutations proving failure occurs before registration or dispatch;
4. a migration guide and compatibility update.

Contract v4 is fixed throughout `0.4.x`. Contract v3 remains the 0.3 line.

## Tests and checks

Run the narrow test while iterating, then the repository gates before review:

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm --filter @full-self-browsing/concierge-example-next-ai-sdk build

node scripts/release/version.mjs self-test
node scripts/release/package.mjs self-test
node scripts/release/compatibility.mjs self-test
node scripts/release/seal.mjs self-test
node scripts/release/publisher.mjs self-test
node scripts/release/check.mjs all
```

Tests should prove semantic failures, not only line coverage. High-value
mutations include:

- foreign or stale catalog revisions;
- duplicate IDs and reordered output indices;
- cancellation before commit and during compound work;
- terminal entry after a completed prefix;
- observer input escaping its redaction policy;
- listener errors affecting control flow;
- changed payload/snapshot after consent;
- mixed contract versions or a bundled second core;
- partial, dynamic, invalid, provider-executed, duplicate, or unknown AI calls;
- malformed/cross-session/expired/replayed/stale signed envelopes;
- absent outcome presentation and unavailable replay storage;
- substituted archives, registry/tag drift, and foreign provenance.

Use AI SDK mock models for deterministic tests. Live provider credentials and
network model behavior are not release authorization.

## Packages and Changesets

The public release set is exactly:

1. `@full-self-browsing/concierge`
2. `@full-self-browsing/concierge-react`
3. `@full-self-browsing/concierge-svelte`
4. `@full-self-browsing/concierge-dom`
5. `@full-self-browsing/concierge-realtime`

They belong to one fixed Changesets group and must leave a Version Packages PR
at the same version. A user-visible change adds a changeset naming all five at
the same bump level. Private examples and fixtures are never versioned.

Adapters keep core as `peerDependencies["@full-self-browsing/concierge"] =
"workspace:^"` and `devDependencies = "workspace:*"`; core is never an ordinary
adapter dependency. Core exposes AI SDK support only through explicit subpaths
and keeps `ai` as the optional peer `^6.0.0 || ^7.0.0`.

For a pre-1.0 minor transition only, commit a bounded old/new source range such
as `workspace:^0.3.3 || ^0.4.0`. Never use `>=0.0.0`. The release versioner
validates that the second arm is the actual output and normalizes the Version
Packages PR back to `workspace:^`, which pnpm packs as the new compatible minor.

## Documentation

Update documentation in the same change when an export, discriminant, wire
field, peer range, engine, example, security boundary, or migration path
changes. Public code comments should explain enduring invariants. Do not leave
comments about phases, planning gates, agents, audits, or the pull request that
created the code.

Historical `.planning` evidence and `scripts/phase-09-*` reproduce the v0.1
milestone and must not be rewritten as current release tooling. The live release
contract is `.release/lines/0.4.json`, `scripts/release/`, and
`.github/workflows/release.yml`.

## Pull requests

Keep changes focused and explain why the change is safe. Include:

- user-visible behavior and compatibility impact;
- security-boundary analysis;
- tests and mutations run;
- documentation and changeset updates;
- any deliberate exclusions or follow-up work.

Never include a production credential or run a publishing mutation from a pull
request. See [RELEASING.md](./RELEASING.md) for the protected release ceremony.
