import { indexedDB as fakeIndexedDB } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { createAISDKAdapter } from "../../dist/ai-sdk/index.js";
import { createSignedBatchIssuer } from "../../dist/ai-sdk/server.js";
import {
  createIndexedDBReplayStore,
  createTestMemoryReplayStore,
  createSignedBrowserBridge,
} from "../../dist/ai-sdk/browser.js";
import {
  emittedTool,
  fakeConcierge,
  resetContract,
  toggleBase64UrlByte,
} from "./helpers.js";

beforeEach(resetContract);

async function keyPair(extractable = false): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    extractable,
    ["sign", "verify"],
  );
}

async function waitUntil(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("The expected asynchronous test checkpoint was not reached.");
}

function base64UrlText(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

async function resignPayload(
  envelope: Readonly<{ protected: string; payload: string; signature: string }>,
  payloadText: string,
  privateKey: CryptoKey,
) {
  const payload = Buffer.from(payloadText, "utf8").toString("base64url");
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(`${envelope.protected}.${payload}`),
  );
  return {
    protected: envelope.protected,
    payload,
    signature: Buffer.from(signature).toString("base64url"),
  };
}

function encodeText(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function pem(label: "PRIVATE KEY" | "PUBLIC KEY", data: ArrayBuffer): string {
  const base64 = Buffer.from(data).toString("base64");
  const lines = base64.match(/.{1,64}/gu) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

async function issuerEnvelope(
  fixture: Awaited<ReturnType<typeof preparedFixture>>,
  keyId: string,
  privateKey: Parameters<typeof createSignedBatchIssuer>[0]["privateKey"],
) {
  const issuer = createSignedBatchIssuer({
    adapter: fixture.adapter,
    audience: "example.test",
    keyId,
    privateKey,
    now: () => fixture.now,
  });
  const issued = await issuer.issue({
    sessionId: "session-1",
    currentContext: {},
    prepared: fixture.prepared,
  });
  if (issued.kind !== "issued") throw new Error("Expected issued.");
  return issued.envelope;
}

async function preparedFixture(options: Readonly<{
  concierge?: Record<string, unknown> | undefined;
  audience?: string | undefined;
  sessionId?: string | undefined;
  now?: number | undefined;
}> = {}) {
  const tool = emittedTool("setTheme");
  const revision = Symbol("catalog");
  const resolution = { stage: "settings", revision, tools: Object.freeze([tool]) };
  const concierge = options.concierge ?? fakeConcierge(() => resolution);
  const adapter = createAISDKAdapter({ concierge });
  const catalog = await adapter.resolveCatalog({ pathname: "/settings" });
  const preparedResult = adapter.prepareStep({
    catalog,
    responseId: "response-1",
    userTurnId: "turn-1",
    toolCalls: [{
      toolCallId: "call-1",
      toolName: "setTheme",
      input: { value: "dark" },
    }],
  });
  if (preparedResult.kind !== "ready") throw new Error("Expected ready.");
  const keys = await keyPair();
  const now = options.now ?? Date.now();
  const issuer = createSignedBatchIssuer({
    adapter,
    audience: options.audience ?? "example.test",
    keyId: "key-1",
    privateKey: { format: "crypto-key", key: keys.privateKey },
    ttlMs: 60_000,
    now: () => now,
  });
  const issued = await issuer.issue({
    sessionId: options.sessionId ?? "session-1",
    currentContext: { pathname: "/settings" },
    prepared: preparedResult.value,
  });
  if (issued.kind !== "issued") throw new Error("Expected issued.");
  return {
    adapter,
    catalog,
    concierge,
    envelope: issued.envelope,
    keys,
    now,
    prepared: preparedResult.value,
    resolution,
  };
}

describe("signed server-to-browser dispatch", () => {
  it("allows security limit options to lower, never raise, the protocol caps", async () => {
    const fixture = await preparedFixture();
    expect(() => createSignedBatchIssuer({
      adapter: fixture.adapter,
      audience: "example.test",
      keyId: "key-1",
      privateKey: { format: "crypto-key", key: fixture.keys.privateKey },
      maxLifetimeMs: 300_001,
    })).toThrow("maxLifetimeMs");
    expect(() => createSignedBatchIssuer({
      adapter: fixture.adapter,
      audience: "example.test",
      keyId: "key-1",
      privateKey: { format: "crypto-key", key: fixture.keys.privateKey },
      maxPayloadBytes: 524_289,
    })).toThrow("maxPayloadBytes");
    const common = {
      concierge: fixture.concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key" as const,
        key: fixture.keys.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" as const }),
    };
    expect(() => createSignedBrowserBridge({
      ...common,
      clockSkewMs: 30_001,
    })).toThrow("clockSkewMs");
    expect(() => createSignedBrowserBridge({
      ...common,
      maxLifetimeMs: 300_001,
    })).toThrow("maxLifetimeMs");
    expect(() => createSignedBrowserBridge({
      ...common,
      maxPayloadBytes: 524_289,
    })).toThrow("maxPayloadBytes");
    expect(() => createSignedBrowserBridge({
      ...common,
      maxCalls: 129,
    })).toThrow("maxCalls");
  });

  it("independently validates prepared steps before signing", async () => {
    const fixture = await preparedFixture();
    const issuer = createSignedBatchIssuer({
      adapter: fixture.adapter,
      audience: "example.test",
      keyId: "key-1",
      privateKey: { format: "crypto-key", key: fixture.keys.privateKey },
      now: () => fixture.now,
    });
    const issue = async (prepared: unknown) => await issuer.issue({
      sessionId: "session-1",
      currentContext: {},
      prepared: prepared as never,
    });
    const call = fixture.prepared.batch.calls[0];
    const correlation = fixture.prepared.correlation[0];
    if (call === undefined || correlation === undefined) {
      throw new Error("Expected one prepared call.");
    }
    const manyCalls = Array.from({ length: 129 }, (_unused, index) => ({
      ...call,
      callId: `call-${index}`,
      outputIndex: index,
    }));
    const manyCorrelation = manyCalls.map((entry) => ({
      toolCallId: entry.callId,
      toolName: entry.name,
      outputIndex: entry.outputIndex,
    }));
    const hostile: unknown[] = [
      {
        ...fixture.prepared,
        batch: { ...fixture.prepared.batch, calls: manyCalls },
        correlation: manyCorrelation,
      },
      {
        ...fixture.prepared,
        batch: {
          ...fixture.prepared.batch,
          calls: [{ ...call, name: "notExposed" }],
        },
      },
      {
        ...fixture.prepared,
        batch: {
          ...fixture.prepared.batch,
          calls: [{ ...call, arguments: "{ \"value\":\"dark\"}" }],
        },
      },
      {
        ...fixture.prepared,
        correlation: [{ ...correlation, toolCallId: "different-call" }],
      },
      {
        ...fixture.prepared,
        batch: {
          ...fixture.prepared.batch,
          calls: [{ ...call, outputIndex: 7 }],
        },
      },
    ];

    for (const prepared of hostile) {
      await expect(issue(prepared)).rejects.toThrow("prepared AI SDK step is invalid");
    }

    let accessorCalls = 0;
    const accessorCallsArray: unknown[] = [];
    Object.defineProperty(accessorCallsArray, "0", {
      configurable: true,
      enumerable: true,
      get: () => {
        accessorCalls += 1;
        return call;
      },
    });
    accessorCallsArray.length = 1;
    await expect(issue({
      ...fixture.prepared,
      batch: { ...fixture.prepared.batch, calls: accessorCallsArray },
    })).rejects.toThrow("prepared AI SDK step is invalid");
    expect(accessorCalls).toBe(0);

    let abortedGetterCalls = 0;
    const hostileSignal = Object.defineProperty({}, "aborted", {
      enumerable: true,
      get: () => {
        abortedGetterCalls += 1;
        return false;
      },
    });
    await expect(issuer.issue({
      sessionId: "session-1",
      currentContext: {},
      prepared: fixture.prepared,
      signal: hostileSignal as never,
    })).rejects.toThrow("prepared AI SDK step is invalid");
    expect(abortedGetterCalls).toBe(0);
  });

  it("returns stale-catalog instead of signing an obsolete prepared snapshot", async () => {
    const fixture = await preparedFixture();
    const issuer = createSignedBatchIssuer({
      adapter: fixture.adapter,
      audience: "example.test",
      keyId: "key-1",
      privateKey: { format: "crypto-key", key: fixture.keys.privateKey },
      now: () => fixture.now,
    });
    const result = await issuer.issue({
      sessionId: "session-1",
      currentContext: {},
      prepared: {
        ...fixture.prepared,
        catalog: {
          ...fixture.prepared.catalog,
          revision: Symbol("obsolete") as never,
        },
      },
    });

    expect(result).toEqual({ kind: "stale-catalog" });
  });

  it("uses raw 64-byte P1363 signatures and imports DER and PEM key formats", async () => {
    const fixture = await preparedFixture();
    const keys = await keyPair(true);
    const [pkcs8, spki] = await Promise.all([
      crypto.subtle.exportKey("pkcs8", keys.privateKey),
      crypto.subtle.exportKey("spki", keys.publicKey),
    ]);
    const derEnvelope = await issuerEnvelope(fixture, "der-key", {
      format: "pkcs8-der",
      data: new Uint8Array(pkcs8),
    });
    const pemEnvelope = await issuerEnvelope(fixture, "pem-key", {
      format: "pkcs8-pem",
      data: pem("PRIVATE KEY", pkcs8),
    });
    expect(Buffer.from(derEnvelope.signature, "base64url")).toHaveLength(64);
    expect(Buffer.from(pemEnvelope.signature, "base64url")).toHaveLength(64);

    const bridge = createSignedBrowserBridge({
      concierge: fixture.concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([
        ["der-key", {
          format: "spki-der",
          data: new Uint8Array(spki),
        }],
        ["pem-key", {
          format: "spki-pem",
          data: pem("PUBLIC KEY", spki),
        }],
      ]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    });
    expect((await bridge.accept(derEnvelope)).kind).toBe("completed");
    expect((await bridge.accept(pemEnvelope)).kind).toBe("completed");
  });

  it("supports a verification-key rotation allowlist and rejects removed keys", async () => {
    let dispatches = 0;
    const revision = Symbol("rotation");
    const tools = Object.freeze([emittedTool("setTheme")]);
    const concierge = fakeConcierge(
      () => ({ stage: "settings", revision, tools }),
      async (_context, batch) => {
        dispatches += 1;
        const call = (batch.calls as Array<Record<string, unknown>>)[0];
        return {
          kind: "completed",
          rows: [{
            dispatchId: `dispatch-${dispatches}`,
            callId: call?.callId,
            name: call?.name,
            outputIndex: call?.outputIndex,
            result: { ok: true, message: "Done." },
          }],
        };
      },
    );
    const fixture = await preparedFixture({ concierge });
    const nextKeys = await keyPair();
    const nextEnvelope = await issuerEnvelope(
      fixture,
      "key-2",
      { format: "crypto-key", key: nextKeys.privateKey },
    );
    const bridge = createSignedBrowserBridge({
      concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([
        ["key-1", { format: "crypto-key", key: fixture.keys.publicKey }],
        ["key-2", { format: "crypto-key", key: nextKeys.publicKey }],
      ]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    });
    expect((await bridge.accept(fixture.envelope)).kind).toBe("completed");
    expect((await bridge.accept(nextEnvelope)).kind).toBe("completed");
    expect(dispatches).toBe(2);

    const afterRotation = createSignedBrowserBridge({
      concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([
        ["key-2", { format: "crypto-key", key: nextKeys.publicKey }],
      ]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    });
    expect(await afterRotation.accept(fixture.envelope)).toEqual({
      kind: "rejected",
      code: "unknown_key",
    });
    expect(dispatches).toBe(2);
  });

  it("verifies, consumes once, dispatches with the local revision, and rejects replay", async () => {
    let observedBatch: Record<string, unknown> | undefined;
    const revision = Symbol("catalog");
    const tools = Object.freeze([emittedTool("setTheme")]);
    const concierge = fakeConcierge(
      () => ({ stage: "settings", revision, tools }),
      async (_context, batch) => {
        observedBatch = batch;
        const call = (batch.calls as Array<Record<string, unknown>>)[0];
        return {
          kind: "completed",
          rows: [{
            dispatchId: "dispatch-1",
            callId: call?.callId,
            name: call?.name,
            outputIndex: call?.outputIndex,
            result: { ok: true, message: "Theme changed." },
          }],
        };
      },
    );
    const fixture = await preparedFixture({ concierge });
    const bridge = createSignedBrowserBridge({
      concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: { pathname: "/settings" },
      now: () => fixture.now,
    });

    const report = await bridge.accept(fixture.envelope);
    expect(report).toMatchObject({ kind: "completed" });
    expect(observedBatch?.catalogRevision).toBe(revision);
    expect(observedBatch?.responseId).toBe("response-1");
    expect(await bridge.accept(fixture.envelope)).toEqual({
      kind: "rejected",
      code: "replayed",
    });
    await bridge.stop();
  });

  it("rejects tampering, audience/session confusion, expiry, and catalog drift", async () => {
    const fixture = await preparedFixture();
    const createBridge = (overrides: Record<string, unknown> = {}) =>
      createSignedBrowserBridge({
        concierge: fixture.concierge,
        audience: "example.test",
        sessionId: "session-1",
        publicKeys: new Map([["key-1", {
          format: "crypto-key",
          key: fixture.keys.publicKey,
        }]]),
        replayStore: createTestMemoryReplayStore(),
        presentOutcome: async () => ({ outcome: "completed" }),
        initialContext: { pathname: "/settings" },
        now: () => fixture.now,
        ...overrides,
      });
    const tampered = {
      ...fixture.envelope,
      signature: toggleBase64UrlByte(fixture.envelope.signature),
    };

    expect(await createBridge().accept(tampered)).toEqual({
      kind: "rejected",
      code: "invalid_signature",
    });
    expect(await createBridge({ audience: "other.test" }).accept(fixture.envelope))
      .toEqual({ kind: "rejected", code: "audience_mismatch" });
    expect(await createBridge({ sessionId: "session-2" }).accept(fixture.envelope))
      .toEqual({ kind: "rejected", code: "session_mismatch" });
    expect(await createBridge({ now: () => fixture.now + 100_000 }).accept(
      fixture.envelope,
    )).toEqual({ kind: "rejected", code: "expired" });

    let changedDispatches = 0;
    const changed = fakeConcierge(
      () => ({
        stage: "settings",
        revision: Symbol("changed"),
        tools: Object.freeze([emittedTool("otherTool")]),
      }),
      async () => {
        changedDispatches += 1;
        return { kind: "completed", rows: [] };
      },
    );
    expect(await createSignedBrowserBridge({
      concierge: changed,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    }).accept(fixture.envelope)).toEqual({
      kind: "rejected",
      code: "catalog_mismatch",
    });
    expect(changedDispatches).toBe(0);
  });

  it("rejects protected-header/payload tampering and a wrong key before dispatch", async () => {
    let dispatches = 0;
    const revision = Symbol("no-rejected-dispatch");
    const tools = Object.freeze([emittedTool("setTheme")]);
    const concierge = fakeConcierge(
      () => ({ stage: "settings", revision, tools }),
      async () => {
        dispatches += 1;
        return { kind: "completed", rows: [] };
      },
    );
    const fixture = await preparedFixture({ concierge });
    const other = await keyPair();
    const bridge = (keys: ReadonlyMap<string, {
      format: "crypto-key";
      key: CryptoKey;
    }>) => createSignedBrowserBridge({
      concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: keys,
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    });
    const allowlist = new Map([
      ["key-1", { format: "crypto-key" as const, key: fixture.keys.publicKey }],
      ["key-2", { format: "crypto-key" as const, key: other.publicKey }],
    ]);
    const tamperedProtected = {
      ...fixture.envelope,
      protected: encodeText(JSON.stringify({
        alg: "ES256",
        kid: "key-2",
        typ: "concierge-tool-batch+jws",
        v: 1,
      })),
    };
    const tamperedPayload = {
      ...fixture.envelope,
      payload: toggleBase64UrlByte(fixture.envelope.payload),
    };

    expect(await bridge(allowlist).accept(tamperedProtected)).toEqual({
      kind: "rejected",
      code: "invalid_signature",
    });
    expect(await bridge(allowlist).accept(tamperedPayload)).toEqual({
      kind: "rejected",
      code: "invalid_signature",
    });
    expect(await bridge(new Map([["key-1", {
      format: "crypto-key",
      key: other.publicKey,
    }]])).accept(fixture.envelope)).toEqual({
      kind: "rejected",
      code: "invalid_signature",
    });
    expect(dispatches).toBe(0);
  });

  it("enforces not-yet-valid, expiry-skew, and five-minute lifetime boundaries", async () => {
    let dispatches = 0;
    const revision = Symbol("clock");
    const tools = Object.freeze([emittedTool("setTheme")]);
    const concierge = fakeConcierge(
      () => ({ stage: "settings", revision, tools }),
      async (_context, batch) => {
        dispatches += 1;
        const call = (batch.calls as Array<Record<string, unknown>>)[0];
        return {
          kind: "completed",
          rows: [{
            dispatchId: `dispatch-${dispatches}`,
            callId: call?.callId,
            name: call?.name,
            outputIndex: call?.outputIndex,
            result: { ok: true, message: "Done." },
          }],
        };
      },
    );
    const fixture = await preparedFixture({ concierge });
    const makeBridge = (time: number) => createSignedBrowserBridge({
      concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => time,
    });

    expect((await makeBridge(fixture.now - 30_000).accept(
      fixture.envelope,
    )).kind).toBe("completed");
    expect((await makeBridge(fixture.now + 90_000).accept(
      fixture.envelope,
    )).kind).toBe("completed");
    expect(await makeBridge(fixture.now - 30_001).accept(fixture.envelope))
      .toEqual({ kind: "rejected", code: "not_yet_valid" });
    expect(await makeBridge(fixture.now + 90_001).accept(fixture.envelope))
      .toEqual({ kind: "rejected", code: "expired" });

    const claims = JSON.parse(base64UrlText(fixture.envelope.payload));
    claims.expiresAt = claims.issuedAt + 300_001;
    const overlong = await resignPayload(
      fixture.envelope,
      JSON.stringify(claims),
      fixture.keys.privateKey,
    );
    expect(await makeBridge(fixture.now).accept(overlong)).toEqual({
      kind: "rejected",
      code: "lifetime_exceeded",
    });
    expect(dispatches).toBe(2);
  });

  it("rejects encoded/decoded payload overflow and 129 signed calls before dispatch", async () => {
    let dispatches = 0;
    const revision = Symbol("limits");
    const tools = Object.freeze([emittedTool("setTheme")]);
    const concierge = fakeConcierge(
      () => ({ stage: "settings", revision, tools }),
      async () => {
        dispatches += 1;
        return { kind: "completed", rows: [] };
      },
    );
    const fixture = await preparedFixture({ concierge });
    const makeBridge = () => createSignedBrowserBridge({
      concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    });
    const encodedOverflow = {
      ...fixture.envelope,
      payload: "A".repeat(Math.ceil(524_288 * 4 / 3) + 5),
    };
    expect(await makeBridge().accept(encodedOverflow)).toEqual({
      kind: "rejected",
      code: "malformed",
    });

    const decodedOverflow = await resignPayload(
      fixture.envelope,
      "a".repeat(524_289),
      fixture.keys.privateKey,
    );
    expect(await makeBridge().accept(decodedOverflow)).toEqual({
      kind: "rejected",
      code: "malformed",
    });

    const claims = JSON.parse(base64UrlText(fixture.envelope.payload));
    claims.calls = Array.from({ length: 129 }, (_unused, index) => ({
      arguments: "{}",
      callId: `call-${index}`,
      name: "setTheme",
      outputIndex: index,
    }));
    const tooManyCalls = await resignPayload(
      fixture.envelope,
      JSON.stringify(claims),
      fixture.keys.privateKey,
    );
    expect(await makeBridge().accept(tooManyCalls)).toEqual({
      kind: "rejected",
      code: "malformed",
    });
    expect(dispatches).toBe(0);
  });

  it("verifies the signature before decoding payload and rejects signed noncanonical JSON", async () => {
    const fixture = await preparedFixture();
    const createBridge = () => createSignedBrowserBridge({
      concierge: fixture.concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    });

    expect(await createBridge().accept({
      ...fixture.envelope,
      payload: "!not-base64url!",
    })).toEqual({ kind: "rejected", code: "invalid_signature" });

    const canonical = base64UrlText(fixture.envelope.payload);
    const signedButNoncanonical = await resignPayload(
      fixture.envelope,
      canonical.replace("{", "{ "),
      fixture.keys.privateKey,
    );
    expect(await createBridge().accept(signedButNoncanonical)).toEqual({
      kind: "rejected",
      code: "malformed",
    });
  });

  it("fails closed for unknown keys and unavailable replay storage", async () => {
    const fixture = await preparedFixture();
    const common = {
      concierge: fixture.concierge,
      audience: "example.test",
      sessionId: "session-1",
      presentOutcome: async () => ({ outcome: "completed" as const }),
      initialContext: {},
      now: () => fixture.now,
    };
    const other = await keyPair();
    expect(await createSignedBrowserBridge({
      ...common,
      publicKeys: new Map([["other-key", {
        format: "crypto-key" as const,
        key: other.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
    }).accept(fixture.envelope)).toEqual({
      kind: "rejected",
      code: "unknown_key",
    });
    expect(await createSignedBrowserBridge({
      ...common,
      publicKeys: new Map([["key-1", {
        format: "crypto-key" as const,
        key: fixture.keys.publicKey,
      }]]),
      replayStore: {
        consume: async () => {
          throw new Error("storage down");
        },
      },
    }).accept(fixture.envelope)).toEqual({
      kind: "rejected",
      code: "storage_unavailable",
    });
  });

  it("rejects hostile accept options without reading accessors or consuming replay", async () => {
    let replayConsumes = 0;
    let dispatches = 0;
    const concierge = fakeConcierge(
      () => ({
        stage: "settings",
        revision: Symbol.for("hostile-options"),
        tools: Object.freeze([emittedTool("setTheme")]),
      }),
      async () => {
        dispatches += 1;
        return { kind: "completed", rows: [] };
      },
    );
    const fixture = await preparedFixture({ concierge });
    const bridge = createSignedBrowserBridge({
      concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      replayStore: {
        consume: async () => {
          replayConsumes += 1;
          return true;
        },
      },
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    });
    let getterCalls = 0;
    const options = Object.defineProperty({}, "signal", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return new AbortController().signal;
      },
    });

    expect(await bridge.accept(fixture.envelope, options as never)).toEqual({
      kind: "rejected",
      code: "malformed",
    });
    expect(getterCalls).toBe(0);
    expect(replayConsumes).toBe(0);
    expect(dispatches).toBe(0);

    const target = {};
    const revoked = Proxy.revocable(target, {});
    revoked.revoke();
    expect(await bridge.accept(fixture.envelope, revoked.proxy as never)).toEqual({
      kind: "rejected",
      code: "malformed",
    });
    expect(replayConsumes).toBe(0);
    expect(dispatches).toBe(0);
  });

  it("atomically consumes memory replay keys under concurrency", async () => {
    const store = createTestMemoryReplayStore();
    const currentTime = 10_000;
    const retainUntil = 70_000;
    const results = await Promise.all([
      store.consume("same-key", retainUntil, currentTime),
      store.consume("same-key", retainUntil, currentTime),
      store.consume("same-key", retainUntil, currentTime),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await store.consume("same-key", retainUntil, retainUntil + 1)).toBe(true);
  });

  it("uses the bridge clock when rejecting a sequential replay", async () => {
    let dispatches = 0;
    const revision = Symbol("logical-clock-replay");
    const tools = Object.freeze([emittedTool("setTheme")]);
    const concierge = fakeConcierge(
      () => ({ stage: "settings", revision, tools }),
      async (_context, batch) => {
        dispatches += 1;
        const call = (batch.calls as Array<Record<string, unknown>>)[0];
        return {
          kind: "completed",
          rows: [{
            dispatchId: "dispatch-1",
            callId: call?.callId,
            name: call?.name,
            outputIndex: call?.outputIndex,
            result: { ok: true, message: "Done." },
          }],
        };
      },
    );
    const fixture = await preparedFixture({ concierge, now: 10_000 });
    const bridge = createSignedBrowserBridge({
      concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    });

    expect((await bridge.accept(fixture.envelope)).kind).toBe("completed");
    expect(await bridge.accept(fixture.envelope)).toEqual({
      kind: "rejected",
      code: "replayed",
    });
    expect(dispatches).toBe(1);
  });

  it("allows only one concurrent accept of the same envelope to dispatch", async () => {
    let dispatches = 0;
    const revision = Symbol("concurrent-replay");
    const tools = Object.freeze([emittedTool("setTheme")]);
    const concierge = fakeConcierge(
      () => ({ stage: "settings", revision, tools }),
      async (_context, batch) => {
        dispatches += 1;
        const call = (batch.calls as Array<Record<string, unknown>>)[0];
        return {
          kind: "completed",
          rows: [{
            dispatchId: "dispatch-1",
            callId: call?.callId,
            name: call?.name,
            outputIndex: call?.outputIndex,
            result: { ok: true, message: "Done." },
          }],
        };
      },
    );
    const fixture = await preparedFixture({ concierge });
    const bridge = createSignedBrowserBridge({
      concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    });
    const reports = await Promise.all([
      bridge.accept(fixture.envelope),
      bridge.accept(fixture.envelope),
      bridge.accept(fixture.envelope),
    ]);
    expect(reports.filter((report) => report.kind === "completed")).toHaveLength(1);
    expect(reports.filter(
      (report) => report.kind === "rejected" && report.code === "replayed",
    )).toHaveLength(2);
    expect(dispatches).toBe(1);
  });

  it("fails closed when IndexedDB is unavailable", async () => {
    const store = createIndexedDBReplayStore({
      indexedDB: undefined,
      databaseName: "unavailable-test",
    });
    await expect(store.consume("key", 11_000, 10_000)).rejects.toThrow(
      "IndexedDB is unavailable",
    );
  });

  it("uses the supplied logical clock for IndexedDB replay expiry", async () => {
    const store = createIndexedDBReplayStore({
      indexedDB: fakeIndexedDB,
      databaseName: `logical-clock-${crypto.randomUUID()}`,
    });

    expect(await store.consume("same-key", 70_000, 10_000)).toBe(true);
    expect(await store.consume("same-key", 70_000, 10_000)).toBe(false);
    expect(await store.consume("same-key", 70_000, 70_001)).toBe(true);
  });

  it("retries IndexedDB open after a transient blocked failure", async () => {
    let opens = 0;
    const indexedDB = {
      open(name: string, version?: number): IDBOpenDBRequest {
        opens += 1;
        if (opens === 1) {
          const request = {
            result: undefined,
            error: null,
            onupgradeneeded: null,
            onsuccess: null,
            onerror: null,
            onblocked: null,
          } as IDBOpenDBRequest;
          queueMicrotask(() => {
            request.onblocked?.call(request, new Event("blocked"));
          });
          return request;
        }
        return fakeIndexedDB.open(name, version);
      },
    } as IDBFactory;
    const store = createIndexedDBReplayStore({
      indexedDB,
      databaseName: `retry-open-${crypto.randomUUID()}`,
    });

    await expect(store.consume("key", 11_000, 10_000)).rejects.toThrow(
      "IndexedDB open was blocked.",
    );
    expect(await store.consume("key", 11_000, 10_000)).toBe(true);
  });

  it("defaults to IndexedDB and fails closed without dispatch when it is absent", async () => {
    let dispatches = 0;
    const revision = Symbol("indexeddb-default");
    const tools = Object.freeze([emittedTool("setTheme")]);
    const concierge = fakeConcierge(
      () => ({ stage: "settings", revision, tools }),
      async () => {
        dispatches += 1;
        return { kind: "completed", rows: [] };
      },
    );
    const fixture = await preparedFixture({ concierge });
    const bridge = createSignedBrowserBridge({
      concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    });
    expect(await bridge.accept(fixture.envelope)).toEqual({
      kind: "rejected",
      code: "storage_unavailable",
    });
    expect(dispatches).toBe(0);
  });

  it("rejects duplicate key ids before dispatch authority is constructed", async () => {
    const fixture = await preparedFixture();
    const duplicateKeys = {
      *[Symbol.iterator]() {
        yield ["key-1", {
          format: "crypto-key" as const,
          key: fixture.keys.publicKey,
        }] as const;
        yield ["key-1", {
          format: "crypto-key" as const,
          key: fixture.keys.publicKey,
        }] as const;
      },
    } as ReadonlyMap<string, { format: "crypto-key"; key: CryptoKey }>;

    expect(() => createSignedBrowserBridge({
      concierge: fixture.concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: duplicateKeys,
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
    })).toThrow("must be unique");
  });

  it("does not release a failed result until app presentation completes", async () => {
    let finishPresentation: (() => void) | undefined;
    const fixture = await preparedFixture({
      concierge: fakeConcierge(
        () => ({
          stage: "settings",
          revision: Symbol.for("failure-revision"),
          tools: Object.freeze([emittedTool("setTheme")]),
        }),
        async (_context, batch) => {
          const call = (batch.calls as Array<Record<string, unknown>>)[0];
          return {
            kind: "completed",
            rows: [{
              dispatchId: "dispatch-1",
              callId: call?.callId,
              name: call?.name,
              outputIndex: call?.outputIndex,
              result: {
                ok: false,
                reason: "handler_error",
                message: "The theme could not be changed.",
              },
            }],
          };
        },
      ),
    });
    const bridge = createSignedBrowserBridge({
      concierge: fixture.concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => {
        await new Promise<void>((resolve) => {
          finishPresentation = resolve;
        });
        return { outcome: "completed" };
      },
      initialContext: {},
      now: () => fixture.now,
    });
    let settled = false;
    const accepted = bridge.accept(fixture.envelope).then((value) => {
      settled = true;
      return value;
    });
    await waitUntil(() => finishPresentation !== undefined);
    expect(settled).toBe(false);
    finishPresentation();
    expect((await accepted).kind).toBe("completed");
  });

  it("returns terminal control without releasing completed-prefix rows", async () => {
    const fixture = await preparedFixture({
      concierge: fakeConcierge(
        () => ({
          stage: "settings",
          revision: Symbol.for("terminal-revision"),
          tools: Object.freeze([emittedTool("setTheme")]),
        }),
        async (_context, batch) => {
          const call = (batch.calls as Array<Record<string, unknown>>)[0];
          return {
            kind: "terminal",
            rows: [{
              dispatchId: "dispatch-prefix",
              callId: call?.callId,
              name: call?.name,
              outputIndex: call?.outputIndex,
              result: { ok: true, message: "Completed before terminal entry." },
            }],
            enteredBy: {
              dispatchId: "dispatch-terminal",
              callId: call?.callId,
              name: call?.name,
              outputIndex: call?.outputIndex,
              lineage: { parentDispatchId: null, rootDispatchId: "dispatch-terminal", depth: 0 },
            },
          };
        },
      ),
    });
    const bridge = createSignedBrowserBridge({
      concierge: fixture.concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    });

    const report = await bridge.accept(fixture.envelope);
    expect(report).toEqual({
      kind: "terminal",
      identity: expect.objectContaining({ responseId: "response-1" }),
      enteredBy: {
        responseId: "response-1",
        callId: "call-1",
        name: "setTheme",
        outputIndex: 0,
      },
    });
    expect(report).not.toHaveProperty("rows");
    expect(await bridge.accept(fixture.envelope)).toEqual({
      kind: "rejected",
      code: "stopped",
    });
  });

  it("same-catalog context updates do not abort their own in-flight batch", async () => {
    let dispatchSignal: AbortSignal | undefined;
    let finishDispatch: (() => void) | undefined;
    const revision = Symbol("stable");
    const tools = Object.freeze([emittedTool("setTheme")]);
    const concierge = fakeConcierge(
      () => ({ stage: "settings", revision, tools }),
      async (_context, batch) => {
        dispatchSignal = batch.signal as AbortSignal;
        await new Promise<void>((resolve) => {
          finishDispatch = resolve;
        });
        const call = (batch.calls as Array<Record<string, unknown>>)[0];
        return {
          kind: "completed",
          rows: [{
            dispatchId: "dispatch-1",
            callId: call?.callId,
            name: call?.name,
            outputIndex: call?.outputIndex,
            result: { ok: true, message: "Done." },
          }],
        };
      },
    );
    const fixture = await preparedFixture({ concierge });
    const bridge = createSignedBrowserBridge({
      concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: { pathname: "/settings", render: 1 },
      now: () => fixture.now,
    });
    const accepted = bridge.accept(fixture.envelope);
    await waitUntil(() => finishDispatch !== undefined);
    await bridge.setContext({ pathname: "/settings", render: 2 });
    expect(dispatchSignal?.aborted).toBe(false);
    finishDispatch();
    expect((await accepted).kind).toBe("completed");
  });

  it("keeps a completed batch when the catalog changes after handlers finish", async () => {
    let finishDispatch: (() => void) | undefined;
    let tools = Object.freeze([emittedTool("setTheme")]);
    let revision = Symbol("first");
    const concierge = fakeConcierge(
      () => ({ stage: "settings", revision, tools }),
      async (_context, batch) => {
        await new Promise<void>((resolve) => {
          finishDispatch = resolve;
        });
        const call = (batch.calls as Array<Record<string, unknown>>)[0];
        return {
          kind: "completed",
          rows: [{
            dispatchId: "dispatch-1",
            callId: call?.callId,
            name: call?.name,
            outputIndex: call?.outputIndex,
            result: { ok: true, message: "Done." },
          }],
        };
      },
    );
    const fixture = await preparedFixture({ concierge });
    const bridge = createSignedBrowserBridge({
      concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    });
    const accepted = bridge.accept(fixture.envelope);
    await waitUntil(() => finishDispatch !== undefined);
    tools = Object.freeze([emittedTool("otherTool")]);
    revision = Symbol("second");
    await bridge.setContext({ changed: true });
    finishDispatch?.();
    expect((await accepted).kind).toBe("completed");
  });

  it("aborts the old epoch when effective tool availability changes", async () => {
    let dispatchStarted = false;
    let tools = Object.freeze([emittedTool("setTheme")]);
    let revision = Symbol("first");
    const concierge = fakeConcierge(
      () => ({ stage: "settings", revision, tools }),
      async (_context, batch) => {
        const signal = batch.signal as AbortSignal;
        dispatchStarted = true;
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        });
        throw new Error("unreachable");
      },
    );
    const fixture = await preparedFixture({ concierge });
    const bridge = createSignedBrowserBridge({
      concierge,
      audience: "example.test",
      sessionId: "session-1",
      publicKeys: new Map([["key-1", {
        format: "crypto-key",
        key: fixture.keys.publicKey,
      }]]),
      replayStore: createTestMemoryReplayStore(),
      presentOutcome: async () => ({ outcome: "completed" }),
      initialContext: {},
      now: () => fixture.now,
    });
    const accepted = bridge.accept(fixture.envelope);
    await waitUntil(() => dispatchStarted);
    tools = Object.freeze([emittedTool("otherTool")]);
    revision = Symbol("second");
    await bridge.setContext({ changed: true });
    expect(await accepted).toEqual({ kind: "rejected", code: "catalog_changed" });
  });
});
