<div align="center">

# Concierge

**The safe action layer for agent-ready web apps.**

Give AI agents a small set of typed, app-defined actions so they can operate your product through intent, live state, and explicit consent—not DOM scraping, brittle selectors, or pixel guessing.

![Status](https://img.shields.io/badge/status-pre--alpha-FF6B35?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-first-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![ESM](https://img.shields.io/badge/ESM-only-000000?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-3DA639?style=for-the-badge)

[Why Concierge](#why-concierge) · [How It Works](#how-it-works) · [Status](#status) · [Roadmap](#roadmap)

</div>

---

> [!IMPORTANT]
> **Concierge is a work in progress.** This repository contains a pre-alpha core runtime, but there is no published package or production-supported integration yet. The API may change before v0.1; do not build production integrations against it.

## Why Concierge

Agent-ready apps should not make models guess.

Traditional browser automation asks an agent to inspect a page and manipulate whatever it can find. Concierge lets an app expose only the actions it intends an agent to use:

```text
applyFilter({ key: "brand", value: ["Marriott"] })
reviewBooking()
confirmBooking()
```

The agent sees typed capabilities and current app state—not your DOM.

| Generic browser automation | Concierge |
| --- | --- |
| Clicks selectors or coordinates | Calls app-defined verbs |
| Reconstructs intent from the UI | Receives typed schemas |
| Inherits broad page authority | Sees only the current action catalog |
| Treats confirmation as a boolean | Binds consent to the reviewed payload |

[FSB](https://github.com/fullselfbrowsing/FSB) drives apps that do not cooperate. **Concierge is how an app cooperates.** The two are complementary.

<a id="design-contract"></a>

## How It Works

Concierge is built around six ideas:

- **Typed verbs** — actions are declared once with a name, schema, effects, redaction policy, and handler.
- **Structured results** — every action returns a safe, human-readable outcome instead of leaking exceptions or implementation details.
- **Least authority** — stage-scoped catalogs expose only the actions valid for the current part of the app.
- **Live state** — framework adapters read through getter-based bridges instead of stale captured values.
- **Consent that fails closed** — consequential actions require a fresh human confirmation bound to the exact payload that was reviewed.
- **Portable by default** — the core stays DOM-free, framework-agnostic, vendor-neutral, and transport-agnostic.

The same action catalog is intended to work with a chat sidebar, voice interface, MCP client, WebMCP, command palette, or a custom agent loop.

## Security Boundary: Client Consent Is Not Server Authorization

> [!WARNING]
> All client-originated evidence—including client-side consent state, grades, receipts, attestations, delivery callbacks, `ConsentAck` values, and other client assertions—is untrusted input at the server boundary. Even evidence described as human-attested can be forged, replayed, or rebound by a compromised client.

The consent kernel does not authenticate a principal and does not authorize a server action. It cannot independently permit a protected server effect. A `ConsentAck` can improve client UX and preserve audit context, but it is never server authorization. A relying server must independently establish the caller's identity and decide whether that authenticated principal may perform the exact requested action.

The client may carry an opaque challenge identifier and a consent assertion to the relying server, but neither is proof. `ConsentAck` values remain untrusted and are not authoritative. An issuance-time authorization decision, a challenge field, or any client assertion cannot substitute for current authorization under server policy.

### Illustrative relying-server challenge lifecycle

This example is illustrative, not production-complete. The relying server creates a high-entropy, server-issued challenge and keeps the authoritative record server-stored; the client only receives its opaque identifier.

```typescript
async function issueServerChallenge(request) {
  const authenticatedPrincipal = await authenticatePrincipal(request);
  const exactAction = parseExactAction(request);
  const exactPayload = parseExactPayload(request);
  const challengeId = serverRandomHighEntropyChallenge();

  await challengeStore.insert({
    challengeId,
    principalId: authenticatedPrincipal.id,
    sessionId: authenticatedPrincipal.sessionId,
    exactAction,
    canonicalPayloadDigest: canonicalPayloadDigest(exactPayload),
    expiresAt: serverClock.now().plus(CHALLENGE_TTL),
    used: false,
  });

  return challengeId;
}

async function redeemServerChallenge(request) {
  const authenticatedPrincipal = await authenticatePrincipal(request);
  const challengeId = parseOpaqueChallengeId(request);
  const exactAction = parseExactAction(request);
  const exactPayload = parseExactPayload(request);

  await serverDatabase.serializedTransaction(async (transaction) => {
    const challenge = await transaction.challengeStore.lockAndLoad(challengeId);
    assertSamePrincipalAndSession(challenge, authenticatedPrincipal);
    assertExactAction(challenge.exactAction, exactAction);
    assertCanonicalPayloadDigest(challenge.canonicalPayloadDigest, canonicalPayloadDigest(exactPayload));
    assertFresh(challenge.expiresAt, serverClock.now());
    assertUnused(challenge);
    await authorizeUnderCurrentPolicy(authenticatedPrincipal, exactAction);
    await performGuardedEffect(transaction, authenticatedPrincipal, exactAction, exactPayload);
    await transaction.challengeStore.burn(challenge.challengeId);
    await transaction.commit();
  });
}
```

Each redemption independently authenticates the current principal and locks the server record before comparing the principal and session, exact action, canonical payload digest, expiry, and unused state. A client-invented or unknown challenge must be rejected. A wrong principal or session must be rejected. A changed action or changed payload must be rejected. An expired challenge must be rejected, and a replay of a used challenge must be rejected.

`authorizeUnderCurrentPolicy` must reject rather than return when the authenticated principal cannot perform the exact action. Any authorization denial or error must abort the operation with no effect. Keeping that check immediately beside the guarded effect prevents a cached issuance decision or client value from becoming authority.

Concurrency control must serialize redemption so two requests cannot both pass the unused check. The guarded effect, challenge burn, and commit belong to one atomic server-owned operation, with the effect before the burn. For an effect that cannot participate directly in the transaction, use an equivalent serialized idempotency or transactional-outbox protocol; the effect should be idempotent for crash recovery.

## Status

The repository currently contains:

- The public TypeScript contract for actions, transports, bridges, results, and consent.
- A framework-neutral catalog and stage resolver, live bridge registry, direct dispatcher and batch executor, transport Session loop, and client-side consent kernel.
- Direct consent enforcement that binds one-shot achieved authority to completed review delivery, the reviewed payload, and the captured app snapshot.
- Mandatory Session presentation of app-authored failure outcomes before transport responses are released.
- Runtime, type-level, package-boundary, and mutation tests for the highest-risk parts of the contract and implementation.

It does **not** yet provide a published package, framework adapters, telemetry, or a production support contract. The client-side consent kernel is not server authorization; please do not build production integrations against this pre-alpha runtime yet.

## Roadmap

- **Now** — harden the pre-alpha core runtime, public contract, packaging, and security evidence.
- **v0.1** — publish the first supported core package and add React + Svelte adapters.
- **Later** — server-side consent verification, telemetry, developer tools, and first-party transports.

If you want to help shape the project, design feedback is especially useful right now. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. If you are continuing implementation, start with [HANDOFF.md](./HANDOFF.md).

## License

[MIT](./LICENSE) © Full Self Browsing
