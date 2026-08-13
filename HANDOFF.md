# Maintainer handoff

## Current state

Concierge 0.2 is a supported-public-preview implementation built around runtime
contract v2. The repository contains:

- a framework-neutral action catalog, atomic catalog revisions, direct and
  batch dispatch, consent, deduplication, cancellation, terminal control,
  compound workflows, lifecycle observation, bridges, and sessions;
- React and Svelte lifecycle adapters that inject the same core instance and do
  no server-side registration;
- an AI SDK 6/7 adapter with provider-neutral tools, strict call preparation,
  result correlation, and an ES256 signed server-to-browser dispatch bridge;
- a full Next App Router/OpenRouter example and the existing dual-framework SSR
  harness;
- a version-neutral three-package release path with exact archives, independent
  sealing, OIDC trusted publishing, provenance verification, safe resumption,
  and the `latest` dist-tag.

The public package set is one fixed trio at a shared `0.2.x` version:

1. `@fullselfbrowsing/concierge`
2. `@fullselfbrowsing/concierge-react`
3. `@fullselfbrowsing/concierge-svelte`

Do not infer registry publication from the repository version. Check npm and
the release workflow. First publication remains externally blocked until the
npm scope/package bootstrap and three trusted-publisher records are complete;
the exact ceremony is in [RELEASING.md](./RELEASING.md).

## Read in this order

1. [README.md](./README.md) — public product and security promise.
2. [COMPATIBILITY.md](./COMPATIBILITY.md) and [SUPPORT.md](./SUPPORT.md) — the
   0.2 support contract.
3. [`packages/concierge/src/types.ts`](./packages/concierge/src/types.ts) — the
   runtime contract as code.
4. [`packages/concierge/src/concierge.ts`](./packages/concierge/src/concierge.ts)
   and [`dispatch.ts`](./packages/concierge/src/dispatch.ts) — atomic catalog,
   object dispatch, compound actions, and events.
5. [`packages/concierge/src/ai-sdk`](./packages/concierge/src/ai-sdk) and the
   [AI SDK guide](./docs/integrations/ai-sdk.md) — signed split-runtime bridge.
6. [`examples/next-ai-sdk`](./examples/next-ai-sdk) — the reference integration.
7. [CONTRIBUTING.md](./CONTRIBUTING.md) — invariants and test expectations.
8. [RELEASING.md](./RELEASING.md) — registry setup and protected release flow.

Use `.planning/` when investigating how v0.1 decisions and evidence were
derived. Its Phase 09 scripts and receipts are historical reproduction inputs,
not the live 0.2 release authority.

## Locked boundaries

- The catalog contains app-defined verbs only. A generic browser or JavaScript
  escape hatch defeats the project.
- The core root entry stays DOM-, framework-, provider-, and transport-neutral;
  optional provider integration is isolated behind explicit subpaths.
- Catalog resolution and its `CatalogRevision` are atomic and instance-local.
  Dispatch requires that exact local capability.
- Core is a peer of every adapter. One physical core owns the safety state.
- `dispatch` is not `async`; same-Promise retry identity is intentional.
- Snapshots are getters and must be detached before consent stores them.
- Terminal batch control is explicit and carries the dispatch occurrence that
  entered terminal execution.
- Compound actions use core workflow controls and bounded lineage.
- Dispatch observers receive redacted, non-controlling events.
- Raw AI SDK calls are display-only. Browser actuation requires the signed
  envelope, replay consumption, and a live-catalog match.
- Client consent, signed results, and client context are not server
  authorization.
- All packages remain ESM-only and contract v2 throughout `0.2.x`.

## Signed bridge invariants

The server signs RFC 8785/JCS-style canonical claims using P-256 ECDSA. The
claims bind contract, audience, session, catalog stage/digest, time bounds,
nonce, response, required turn, and ordered calls. The browser strictly parses
the flattened envelope, verifies ES256 and the selected key, consumes the
replay key, re-resolves live catalog state, serializes dispatch, presents
failure outcomes, and returns correlated rows.

Do not weaken a rejection into a retry through unsigned data. Keep private keys
server-only. `createTestMemoryReplayStore()` is explicitly test-only and never
a production fallback; production examples use IndexedDB or an
application-supplied stronger store.

## Live release authority

- `.release/lines/0.2.json` — strict package set, contract, destination,
  compatibility, Node, and content-addressed npm identity.
- `scripts/release/config.mjs` — strict parser and shared invariants.
- `scripts/release/check.mjs` — source/workflow/fixed-trio gate.
- `scripts/release/version.mjs` — Changesets wrapper and peer normalization.
- `scripts/release/package.mjs` — build-once exact archive export.
- `scripts/release/compatibility.mjs` — AI 6/7, React 18/19, Svelte 5
  minimum/current, strict-type, single-core, ESM SSR, and same-source Next
  foreign consumers.
- `scripts/release/seal.mjs` — clean-checkout independent content seal.
- `scripts/release/publisher.mjs` — OIDC-only, provenance-verifying,
  safely-resumable publisher.
- `.github/workflows/release.yml` — privilege-separated version, verify, seal,
  sealed-archive Chromium/Firefox/WebKit, and protected publish jobs.

The historical `scripts/phase-09-*` files and `.planning` receipts are frozen.
A new release must create new exact-SHA evidence from the final tracked commit;
the v0.1 receipt does not authorize later source.

## Before handing off another release candidate

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm --filter @fullselfbrowsing/concierge-example-next-ai-sdk build

node scripts/release/version.mjs self-test
node scripts/release/package.mjs self-test
node scripts/release/compatibility.mjs self-test
node scripts/release/seal.mjs self-test
node scripts/release/publisher.mjs self-test
node scripts/release/check.mjs all
```

Then confirm the Changesets fixed group is the exact trio, the worktree is
clean, repository URLs preserve `fullselfbrowsing/Concierge` case, and npm's
three trusted-publisher records name `release.yml` plus `npm-production`.

## Known limitations

- 0.2 is public preview, not a commercial-SLA release.
- The signed bridge authenticates server admission of a browser batch; it does
  not authorize protected server effects or repair XSS.
- Edge runtime is not in the 0.2 Next matrix.
- Live model-provider calls are intentionally outside release authorization.
- Only the latest 0.2 patch is maintained under [SUPPORT.md](./SUPPORT.md).
