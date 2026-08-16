# Compatibility

Concierge 0.2 is a supported public preview. The three public packages form one
fixed release set and share runtime contract v2.

## Supported ranges

| Component | Supported range | Release certification |
| --- | --- | --- |
| Node.js | `>=22.12.0` | 22.12 floor consumer and Node 24 CI/publisher |
| `@full-self-browsing/concierge` | `^0.2.0` | Same patch as every adapter |
| React | `^18.2.0 || ^19.0.0` | 18.2 and 19.2 lines |
| React DOM | `^18.2.0 || ^19.0.0` | Matches React |
| Svelte | `^5.0.0` | 5.0 floor and current 5.56.9 |
| AI SDK core (`ai`) | `^6.0.0 || ^7.0.0` | 6.0.0, current 6.x, 7.0.0, current 7.x |
| TypeScript | Declarations target modern strict TypeScript | Package type tests run with `skipLibCheck: false` |
| Module format | ESM only | Node ESM, bundler, SSR, and exact-tarball checks |

The package engine is deliberately higher than AI SDK 6's own Node floor so
the fixed package family has one runtime contract. Node 22.12 is the consumer
floor; contributing with the pinned pnpm requires Node 22.13 or newer. Trusted
npm publishing requires Node 22.14 or newer and uses Node 24.

## AI SDK stacks certified for 0.2.0

| Cell | `ai` | `@ai-sdk/react` | OpenRouter provider | Purpose |
| --- | ---: | ---: | ---: | --- |
| AI 6 adapter floor | 6.0.0 | — | — | Public adapter peer floor |
| AI 6 full-stack floor | 6.0.3 | 3.0.0 | 2.0.0 | First mutually compatible provider stack |
| AI 6 current | 6.0.253 | 3.0.256 | 2.10.0 | Exact-archive Next compatibility |
| AI 7 floor | 7.0.0 | 4.0.0 | 3.0.0 | Public major floor |
| AI 7 current | 7.0.64 | 4.0.67 | 3.0.0 | Canonical example and exact-archive Next build |

OpenRouter is an example dependency, not part of the adapter's public peer
contract. Other AI SDK providers can consume the same `ToolSet`.

## Framework and runtime boundaries

- The package roots for React and Svelte are server-safe. Import client
  lifecycle bindings from `/client` and `/client.svelte` respectively.
- `@full-self-browsing/concierge/ai-sdk/server` is Node/server code and resolves
  to a fail-closed unavailable module under the browser condition.
- `@full-self-browsing/concierge/ai-sdk/browser` needs WebCrypto. Its IndexedDB
  replay store additionally needs a browser IndexedDB implementation.
- The full Next example declares the Node runtime. Edge deployment is not part
  of the 0.2 support matrix.
- CommonJS output and `require()` are not supported. Use ESM imports.

The release gate installs only the packed trio into foreign temporary
consumers. Both framework cells verify that React and Svelte public entries can
be imported during ESM server rendering, typecheck with `skipLibCheck: false`,
and resolve the same physical core from the consumer and each adapter. The
sealed AI 7 example then exercises the signed bridge in Chromium, Firefox, and
WebKit before the OIDC publish job can start.

## Version mixing

Do not mix 0.1 and 0.2 packages. All adapters keep core as a peer dependency,
and every runtime entry checks contract v2 before registration or dispatch.
Upgrade the trio and regenerate the lockfile together:

```sh
pnpm up @full-self-browsing/concierge@^0.2 \
  @full-self-browsing/concierge-react@^0.2 \
  @full-self-browsing/concierge-svelte@^0.2

pnpm why @full-self-browsing/concierge
```

The final command should converge on one physical core version. See the
[0.1-to-0.2 migration guide](./docs/migrations/0.1-to-0.2.md) for API changes.
