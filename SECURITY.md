# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for
[`fullselfbrowsing/Concierge`](https://github.com/fullselfbrowsing/Concierge/security/advisories/new).
Do not open a public issue with an exploit, private key, access token, user
payload, or unredacted application state.

Include the affected package and version, impact, prerequisites, a minimal
reproduction, and any proposed mitigation. Maintainers will coordinate
disclosure and credit through the private advisory. This public-preview project
does not promise a response-time SLA.

## Security boundary

Concierge constrains browser actuation to an app-authored catalog. It does not:

- authenticate a principal;
- authorize a protected server operation;
- make client consent or client state trustworthy at a server boundary;
- protect a page already compromised by XSS;
- make model output, provider metadata, or a transport turn identifier trusted;
- replace rate limits, idempotency, audit logging, or transactional controls.

Every protected server effect must authenticate the current caller and
authorize the exact action and canonical payload under current policy at the
moment of execution. Treat client `ConsentAck`, challenge identifiers,
catalog/context values, signed-batch results, and delivery assertions as
untrusted inputs to that decision.

## Signed AI bridge

The AI SDK adapter's split-runtime bridge uses canonical JSON and ES256 to bind
a complete tool batch to contract version, audience, session, catalog stage and
digest, issue and expiry times, nonce, response, required user turn, and ordered
calls. The browser verifies the signature and live catalog and atomically
consumes the replay key before dispatch.

Operators must:

- keep the PKCS #8 private key on the server and publish only SPKI public keys;
- use a distinct audience and an unpredictable server-issued session ID;
- use short expiries and account for only bounded clock skew;
- retain old public keys only for their maximum envelope lifetime during
  rotation;
- use `createIndexedDBReplayStore`, or a stronger application store, in
  production; `createTestMemoryReplayStore()` is process-local, explicitly
  test-only, and is never a production fallback;
- ignore raw AI SDK `onToolCall` data for actuation;
- validate request context on the server and rely on the browser's live catalog
  comparison as a second fail-closed check;
- present every app-authored failure outcome before returning its tool result;
- apply a strict CSP and normal XSS defenses.

Rejection codes are safe operational categories, not authorization proof. A
rejected envelope must never fall back to unsigned dispatch.

## Package and release integrity

Official releases are one fixed quartet, built and checked without publish
credentials, independently sealed, then published from the protected
`npm-production` GitHub environment through npm trusted publishing. The OIDC
job receives only `id-token: write`; it does not checkout source, install
dependencies, build, or repack. It publishes the sealed bytes with provenance
and verifies their integrity, source workflow, commit, run, and `latest` tag.

Before installing, verify that package provenance points to
`fullselfbrowsing/Concierge/.github/workflows/release.yml` and that all four
packages resolve to the same `0.2.x` version.

## Supported versions

Security fixes follow the maintenance window in [SUPPORT.md](./SUPPORT.md).
When a fix cannot be backported without changing the runtime contract,
maintainers will publish a synchronized minor and migration guidance.
