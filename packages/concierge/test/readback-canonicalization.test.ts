import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const DIST_URL = new URL("../dist/index.js", import.meta.url);
const DIST_PATH = fileURLToPath(DIST_URL);
const CONTRACT_KEY = Symbol.for("@fullselfbrowsing/concierge.contract");
const ACTIVE_CONTEXT = Object.freeze({ pathname: "/active" });
const ATTESTED_PROFILE = Object.freeze({
  consentGrade: "attested",
  userTurnIdentity: "human-attested",
});

let createConcierge;

beforeAll(async () => {
  if (!existsSync(DIST_PATH)) {
    throw new Error(
      "packages/concierge/dist/index.js is missing. Run `pnpm build` before the readback-canonicalization suite.",
    );
  }
  ({ createConcierge } = await import(DIST_URL.href));
});

beforeEach(() => {
  delete (globalThis as Record<symbol, unknown>)[CONTRACT_KEY];
});

function schema(output) {
  return {
    "~standard": {
      version: 1,
      vendor: "concierge-readback-canonicalization-test",
      validate() {
        return { value: output };
      },
    },
  };
}

function action(name, actionSchema, handler, extra = {}) {
  return {
    name,
    description: `the ${name} action`,
    schema: actionSchema,
    jsonSchema: { type: "object" },
    redact: "drop",
    handler,
    effects: { readOnly: true },
    ...extra,
  };
}

function utf8(text) {
  return new Uint8Array(Buffer.from(text, "utf8"));
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function digestBuffer(bytes) {
  const digest = createHash("sha256").update(bytes).digest();
  return digest.buffer.slice(
    digest.byteOffset,
    digest.byteOffset + digest.byteLength,
  );
}

function viewOf(data) {
  return data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function receiptFor(canonical, overrides = {}) {
  return {
    alg: "SHA-256",
    canonicalization: "JCS",
    canonical,
    hash: hashBytes(canonical),
    ...overrides,
  };
}

function createDigest({ mutateInput = false, transform } = {}) {
  const calls = [];
  return {
    calls,
    digest: {
      async digest(algorithm, data) {
        const supplied = viewOf(data);
        const captured = new Uint8Array(supplied);
        calls.push({ algorithm, bytes: captured });
        if (mutateInput) supplied.fill(0);
        const result = digestBuffer(captured);
        return transform === undefined ? result : transform(result);
      },
    },
  };
}

function createFlow({
  digest = createDigest(),
  output,
  presentReadback,
} = {}) {
  const deliveryCallbacks = [];
  const gateEntries = [];
  const reviewEntries = [];
  const concierge = createConcierge({
    stages: [
      {
        id: "active",
        match: (ctx) => ctx.pathname === ACTIVE_CONTEXT.pathname,
        actions: [
          action("review", schema(output), (ctx) => {
            reviewEntries.push(ctx);
            return { ok: true, message: "Reviewed." };
          }),
          action(
            "confirm",
            schema({}),
            (ctx) => {
              gateEntries.push(ctx);
              return { ok: true, message: "Confirmed." };
            },
            {
              consent: {
                requires: "review",
                bindTo: "response",
                minGrade: "attested",
              },
            },
          ),
        ],
      },
    ],
    consentProfile: ATTESTED_PROFILE,
    presentReadback,
    digest: digest.digest,
  });

  return {
    concierge,
    deliveryCallbacks,
    digest,
    gateEntries,
    reviewEntries,
    async review() {
      return concierge.dispatch(ACTIVE_CONTEXT, "review", {}, {
        callId: "review-call",
        responseId: "review-response",
        userTurnId: "review-turn",
        deferUntilDelivered(effect) {
          deliveryCallbacks.push(effect);
        },
      });
    },
    async confirm(callId = "confirm-call") {
      return concierge.dispatch(ACTIVE_CONTEXT, "confirm", {}, {
        callId,
        responseId: "confirm-response",
        userTurnId: "confirm-turn",
      });
    },
  };
}

async function flushMicrotasks() {
  for (let index = 0; index < 12; index += 1) {
    await Promise.resolve();
  }
}

async function completeAttestedDelivery(flow, hash, marker) {
  expect(flow.deliveryCallbacks, marker).toHaveLength(1);
  flow.deliveryCallbacks[0]({
    responseId: "review-response",
    outcome: "completed",
    readbackHash: hash,
    attestation: {
      act: "confirmed",
      userTurnId: "confirm-turn",
      readbackHash: hash,
    },
  });
  await flushMicrotasks();
}

async function expectCanonicalRelease(payload, canonicalText, marker) {
  const canonical = utf8(canonicalText);
  const readbacks = [];
  const flow = createFlow({
    output: payload,
    presentReadback: async (readback) => {
      readbacks.push(readback);
      return receiptFor(canonical);
    },
  });

  expect(await flow.review(), marker).toMatchObject({ ok: true });
  await completeAttestedDelivery(flow, hashBytes(canonical), marker);
  expect(await flow.confirm(), marker).toMatchObject({ ok: true });
  expect(flow.gateEntries, marker).toHaveLength(1);
  expect(flow.gateEntries[0].ack).toMatchObject({
    grade: "attested",
    readbackHash: hashBytes(canonical),
  });
  expect(readbacks).toHaveLength(1);
  expect(flow.digest.calls).toHaveLength(2);
  for (const call of flow.digest.calls) {
    expect(call.algorithm).toBe("SHA-256");
    expect(call.bytes).toEqual(canonical);
  }
  return { flow, readback: readbacks[0] };
}

describe("RFC 8785 JCS and hand-written UTF-8 through the public consent flow", () => {
  it("J01 — canonicalizes the RFC primitive sample with recursive key ordering", async () => {
    const payload = {
      numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 1e-27],
      string: "€$\u000f\nA'B\"\\\"/",
      literals: [null, true, false],
    };
    const expected =
      "{\"payload\":{\"literals\":[null,true,false],\"numbers\":[333333333.3333333,1e+30,4.5,0.002,1e-27],\"string\":\"€$\\u000f\\nA'B\\\"\\\\\\\"/\"}}";

    await expectCanonicalRelease(payload, expected);
  });

  it("J02 — sorts the RFC property vector by unsigned UTF-16 code units", async () => {
    const marker = "[RED:J02:utf16-property-order]";
    const payload = {
      "€": "Euro Sign",
      "\r": "Carriage Return",
      "דּ": "Hebrew Letter Dalet With Dagesh",
      "1": "One",
      "😀": "Emoji: Grinning Face",
      "": "Control",
      "ö": "Latin Small Letter O With Diaeresis",
    };
    const expected =
      "{\"payload\":{\"\\r\":\"Carriage Return\",\"1\":\"One\",\"\":\"Control\",\"ö\":\"Latin Small Letter O With Diaeresis\",\"€\":\"Euro Sign\",\"😀\":\"Emoji: Grinning Face\",\"דּ\":\"Hebrew Letter Dalet With Dagesh\"}}";

    await expectCanonicalRelease(payload, expected, marker);
  });

  it("J03 — uses ECMAScript finite-number spellings across RFC edge vectors", async () => {
    const marker = "[RED:J03:negative-zero-number-spelling]";
    const payload = {
      values: [
        0,
        -0,
        5e-324,
        -5e-324,
        1.7976931348623157e308,
        -1.7976931348623157e308,
        9007199254740992,
        -9007199254740992,
        295147905179352830000,
        9.999999999999997e22,
        1e23,
        1.0000000000000001e23,
        999999999999999700000,
        999999999999999900000,
        1e21,
        9.999999999999997e-7,
        0.000001,
        333333333.3333332,
        333333333.33333325,
        333333333.3333333,
        333333333.3333334,
        333333333.33333343,
        -0.0000033333333333333333,
        1424953923781206.2,
      ],
    };
    const expected =
      "{\"payload\":{\"values\":[0,0,5e-324,-5e-324,1.7976931348623157e+308,-1.7976931348623157e+308,9007199254740992,-9007199254740992,295147905179352830000,9.999999999999997e+22,1e+23,1.0000000000000001e+23,999999999999999700000,999999999999999900000,1e+21,9.999999999999997e-7,0.000001,333333333.3333332,333333333.33333325,333333333.3333333,333333333.3333334,333333333.33333343,-0.0000033333333333333333,1424953923781206.2]}}";

    await expectCanonicalRelease(payload, expected, marker);
  });

  it("J04 — minimally escapes strings and hand-encodes one-to-four-byte scalars", async () => {
    const marker = "[RED:J04:four-byte-utf8-scalar]";
    const text =
      "\u0000\b\t\n\f\r\"\\/\u007f\u0080\u07ff\u0800\uffff\u{1f600}\u{10ffff}";
    const expected =
      "{\"payload\":{\"text\":\"\\u0000\\b\\t\\n\\f\\r\\\"\\\\/\u007f\u0080\u07ff\u0800\uffff\u{1f600}\u{10ffff}\"}}";

    await expectCanonicalRelease({ text }, expected, marker);
  });

  it("J05 — accepts dense arrays plus ordinary and null-prototype records", async () => {
    for (const [payload, canonical] of [
      [null, "{\"payload\":null}"],
      [true, "{\"payload\":true}"],
      [4.5, "{\"payload\":4.5}"],
      ["plain", "{\"payload\":\"plain\"}"],
      [[1, false], "{\"payload\":[1,false]}"],
    ]) {
      await expectCanonicalRelease(payload, canonical);
    }

    const record = Object.create(null);
    Object.defineProperties(record, {
      a: { enumerable: true, value: [1, { ok: true }] },
      z: { enumerable: true, value: null },
    });

    await expectCanonicalRelease(
      record,
      "{\"payload\":{\"a\":[1,{\"ok\":true}],\"z\":null}}",
    );
  });
});

describe("strict JSON-domain rejection contains executable and ambiguous values", () => {
  it("J06 — rejects unsupported primitive values, non-finite numbers, and sparse arrays", async () => {
    const marker = "[RED:J06:non-finite-and-non-json-rejection]";
    const sparse = new Array(2);
    sparse[1] = "present";
    const cases = [
      undefined,
      1n,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      () => "not JSON",
      Symbol("not JSON"),
      sparse,
      { nested: undefined },
      { nested: 1n },
      { nested: () => "not JSON" },
      { nested: Symbol("not JSON") },
    ];

    for (const [index, output] of cases.entries()) {
      const presenter = { calls: 0 };
      const flow = createFlow({
        output,
        presentReadback: async () => {
          presenter.calls += 1;
          return receiptFor(utf8("unreachable"));
        },
      });
      const result = await flow.review();

      expect(result, `${marker}:case-${index}`).toMatchObject({
        ok: false,
        reason: "invalid_args",
      });
      expect(presenter.calls, `case ${index}`).toBe(0);
      expect(flow.reviewEntries, `case ${index}`).toHaveLength(0);
    }
  });

  it("J07 — rejects aliases, cycles, symbols, non-enumerables, and own toJSON", async () => {
    const marker = "[RED:J07:alias-and-cycle-rejection]";
    const shared = { value: 1 };
    const cycle = { value: 1 };
    cycle.self = cycle;
    const symbolKey = { visible: 1 };
    symbolKey[Symbol("hidden")] = 2;
    const nonEnumerable = { visible: 1 };
    Object.defineProperty(nonEnumerable, "hidden", { value: 2 });
    let toJSONCalls = 0;
    const withToJSON = {
      value: 1,
      toJSON() {
        toJSONCalls += 1;
        return { value: 2 };
      },
    };
    const cases = [
      { left: shared, right: shared },
      cycle,
      symbolKey,
      nonEnumerable,
      withToJSON,
    ];

    for (const [index, output] of cases.entries()) {
      const flow = createFlow({
        output,
        presentReadback: async () => receiptFor(utf8("unreachable")),
      });
      expect(await flow.review(), `${marker}:case-${index}`).toMatchObject({
        ok: false,
        reason: "invalid_args",
      });
      expect(flow.reviewEntries, `case ${index}`).toHaveLength(0);
    }
    expect(toJSONCalls).toBe(0);
  });

  it("J08 — rejects accessors without invoking them and rejects exotic instances", async () => {
    const marker = "[RED:J08:accessor-and-exotic-rejection]";
    let getterCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, "secret", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("GETTER_SECRET_MUST_NOT_ESCAPE");
      },
    });

    for (const output of [accessor, new Date(0), new Map(), new Set()]) {
      const flow = createFlow({
        output,
        presentReadback: async () => receiptFor(utf8("unreachable")),
      });
      const result = await flow.review();
      expect(result, marker).toMatchObject({ ok: false, reason: "invalid_args" });
      expect(JSON.stringify(result)).not.toContain("GETTER_SECRET");
      expect(flow.reviewEntries).toHaveLength(0);
    }
    expect(getterCalls, marker).toBe(0);
  });

  it("J09 — rejects lone surrogates in values and property names", async () => {
    const marker = "[RED:J09:lone-surrogate-rejection]";
    for (const output of [
      { text: "high-\ud800" },
      { text: "low-\udc00" },
      { ["key-\ud800"]: "value" },
      { ["key-\udc00"]: "value" },
    ]) {
      const flow = createFlow({
        output,
        presentReadback: async () => receiptFor(utf8("unreachable")),
      });
      expect(await flow.review(), marker).toMatchObject({
        ok: false,
        reason: "invalid_args",
      });
      expect(flow.reviewEntries).toHaveLength(0);
    }
  });

  it("J10 — contains throwing and reflectively unstable Proxy shapes", async () => {
    const secret = "PROXY_SECRET_MUST_NOT_ESCAPE";
    const throwing = new Proxy({}, {
      ownKeys() {
        throw new Error(secret);
      },
    });
    let ownKeyReads = 0;
    const unstableTarget = { a: 1, b: 2 };
    const unstable = new Proxy(unstableTarget, {
      ownKeys() {
        ownKeyReads += 1;
        return ownKeyReads % 2 === 1 ? ["a", "b"] : ["b", "a"];
      },
    });

    for (const output of [throwing, unstable]) {
      const flow = createFlow({
        output,
        presentReadback: async () => receiptFor(utf8("unreachable")),
      });
      const result = await flow.review();
      expect(result).toMatchObject({ ok: false, reason: "invalid_args" });
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(flow.reviewEntries).toHaveLength(0);
    }
  });
});

describe("receipt verification retains core-owned bytes and distrusts every claim", () => {
  it("J11 — requires exact literals, canonical bytes, receipt hash, and fresh digest", async () => {
    const marker = "[RED:J11:receipt-claim-verification]";
    const canonical = utf8("{\"payload\":{\"amount\":41}}");
    const correctHash = hashBytes(canonical);
    const cases = [
      { alg: "SHA-512" },
      { canonicalization: "JSON" },
      { canonical: utf8("{\"payload\":{\"amount\":42}}") },
      { hash: "0".repeat(64) },
    ];

    for (const [index, overrides] of cases.entries()) {
      let presenterCalls = 0;
      const flow = createFlow({
        output: { amount: 41 },
        presentReadback: async () => {
          presenterCalls += 1;
          return receiptFor(canonical, overrides);
        },
      });

      expect(await flow.review(), `case ${index}`).toMatchObject({ ok: true });
      expect(presenterCalls, `case ${index}`).toBe(1);
      expect(flow.deliveryCallbacks, `${marker}:case-${index}`).toHaveLength(0);
      expect(await flow.confirm(`mismatch-${index}`), `case ${index}`).toMatchObject({
        ok: false,
        reason: "consent_required",
      });
      expect(flow.gateEntries, `case ${index}`).toHaveLength(0);
    }

    const wrongDigest = createDigest({
      transform() {
        return new Uint8Array(32).buffer;
      },
    });
    const digestFlow = createFlow({
      digest: wrongDigest,
      output: { amount: 41 },
      presentReadback: async () => receiptFor(canonical, { hash: correctHash }),
    });
    expect(await digestFlow.review()).toMatchObject({ ok: true });
    expect(digestFlow.deliveryCallbacks).toHaveLength(0);
    expect(await digestFlow.confirm("wrong-digest")).toMatchObject({
      ok: false,
      reason: "consent_required",
    });
  });

  it("J12 — snapshots every receipt claim before caller mutation", async () => {
    const canonical = utf8("{\"payload\":{\"amount\":41}}");
    const receipt = receiptFor(canonical);
    const retainedHash = receipt.hash;
    const flow = createFlow({
      output: { amount: 41 },
      presentReadback: async () => receipt,
    });

    expect(await flow.review()).toMatchObject({ ok: true });
    canonical.fill(0);
    receipt.hash = "0".repeat(64);
    receipt.alg = "SHA-512";
    receipt.canonicalization = "JSON";
    await completeAttestedDelivery(flow, retainedHash);
    expect(await flow.confirm()).toMatchObject({ ok: true });
    expect(flow.gateEntries).toHaveLength(1);
  });

  it("J13 — passes defensive byte copies to a digest that mutates its input", async () => {
    const canonical = utf8("{\"payload\":{\"amount\":41}}");
    const digest = createDigest({ mutateInput: true });
    const flow = createFlow({
      digest,
      output: { amount: 41 },
      presentReadback: async () => receiptFor(canonical),
    });

    expect(await flow.review()).toMatchObject({ ok: true });
    await completeAttestedDelivery(flow, hashBytes(canonical));
    expect(await flow.confirm()).toMatchObject({ ok: true });
    expect(digest.calls).toHaveLength(2);
    expect(digest.calls[0].bytes).toEqual(canonical);
    expect(digest.calls[1].bytes).toEqual(canonical);
  });

  it("J14 — rejects accessor-backed and exotic receipt claims without execution", async () => {
    const canonical = utf8("{\"payload\":{\"amount\":41}}");
    let getterCalls = 0;
    const accessorReceipt = receiptFor(canonical);
    Object.defineProperty(accessorReceipt, "hash", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("RECEIPT_SECRET_MUST_NOT_ESCAPE");
      },
    });
    const receipts = [
      accessorReceipt,
      Object.assign(new Date(0), receiptFor(canonical)),
    ];

    for (const [index, receipt] of receipts.entries()) {
      const flow = createFlow({
        output: { amount: 41 },
        presentReadback: async () => receipt,
      });
      expect(await flow.review(), `case ${index}`).toMatchObject({ ok: true });
      expect(flow.deliveryCallbacks, `case ${index}`).toHaveLength(0);
      const closed = await flow.confirm(`receipt-${index}`);
      expect(closed).toMatchObject({ ok: false, reason: "consent_required" });
      expect(JSON.stringify(closed)).not.toContain("RECEIPT_SECRET");
    }
    expect(getterCalls).toBe(0);
  });

  it("J15 — rejects shadowed byte-brand accessors without invoking them", async () => {
    const canonical = utf8("{\"payload\":{\"amount\":41}}");
    let bufferGetterCalls = 0;
    const shadowedCanonical = new Uint8Array(canonical);
    Object.defineProperty(shadowedCanonical, "buffer", {
      get() {
        bufferGetterCalls += 1;
        throw new Error("BYTE_BUFFER_SECRET");
      },
    });
    const receiptFlow = createFlow({
      output: { amount: 41 },
      presentReadback: async () => receiptFor(shadowedCanonical, {
        hash: hashBytes(canonical),
      }),
    });

    expect(await receiptFlow.review()).toMatchObject({ ok: true });
    expect(receiptFlow.deliveryCallbacks).toHaveLength(0);
    expect(bufferGetterCalls).toBe(0);

    let byteLengthGetterCalls = 0;
    const hostileDigest = createDigest({
      transform(result) {
        Object.defineProperty(result, "byteLength", {
          get() {
            byteLengthGetterCalls += 1;
            throw new Error("DIGEST_BUFFER_SECRET");
          },
        });
        return result;
      },
    });
    const digestFlow = createFlow({
      digest: hostileDigest,
      output: { amount: 41 },
      presentReadback: async () => receiptFor(canonical),
    });

    expect(await digestFlow.review()).toMatchObject({ ok: true });
    expect(digestFlow.deliveryCallbacks).toHaveLength(0);
    expect(byteLengthGetterCalls).toBe(0);
  });

  it("J16 — captures the digest method once and preserves its receiver", async () => {
    const canonical = utf8("{\"payload\":{\"amount\":41}}");
    const calls = [];
    let methodReads = 0;
    const capability = {};
    const method = async function (algorithm, data) {
      expect(this).toBe(capability);
      const bytes = new Uint8Array(viewOf(data));
      calls.push({ algorithm, bytes });
      return digestBuffer(bytes);
    };
    Object.defineProperty(capability, "digest", {
      get() {
        methodReads += 1;
        if (methodReads > 1) {
          throw new Error("DIGEST_METHOD_REREAD");
        }
        return method;
      },
    });
    const flow = createFlow({
      digest: { calls, digest: capability },
      output: { amount: 41 },
      presentReadback: async () => receiptFor(canonical),
    });

    expect(await flow.review()).toMatchObject({ ok: true });
    await completeAttestedDelivery(flow, hashBytes(canonical));
    expect(await flow.confirm()).toMatchObject({ ok: true });
    expect(methodReads).toBe(1);
    expect(calls).toHaveLength(2);
  });

  it("J17 — accepts non-enumerable data claims but closes on optional accessors", async () => {
    const canonical = utf8("{\"payload\":{\"amount\":41}}");
    const hash = hashBytes(canonical);
    const receipt = {};
    Object.defineProperties(receipt, {
      alg: { value: "SHA-256" },
      canonical: { value: canonical },
      canonicalization: { value: "JCS" },
      hash: { value: hash },
    });
    const flow = createFlow({
      output: { amount: 41 },
      presentReadback: async () => receipt,
    });
    expect(await flow.review()).toMatchObject({ ok: true });
    expect(flow.deliveryCallbacks).toHaveLength(1);
    const attestation = {};
    Object.defineProperties(attestation, {
      act: { value: "confirmed" },
      readbackHash: { value: hash },
      userTurnId: { value: "confirm-turn" },
    });
    const report = {};
    Object.defineProperties(report, {
      attestation: { value: attestation },
      outcome: { value: "completed" },
      readbackHash: { value: hash },
      responseId: { value: "review-response" },
    });
    flow.deliveryCallbacks[0](report);
    await flushMicrotasks();
    expect(await flow.confirm()).toMatchObject({ ok: true });

    for (const authorityField of ["readbackHash", "attestation"]) {
      let getterCalls = 0;
      const hostileFlow = createFlow({
        output: { amount: 41 },
        presentReadback: async () => receiptFor(canonical),
      });
      expect(await hostileFlow.review()).toMatchObject({ ok: true });
      const hostileReport = {
        responseId: "review-response",
        outcome: "completed",
      };
      Object.defineProperty(hostileReport, authorityField, {
        enumerable: true,
        get() {
          getterCalls += 1;
          throw new Error("OPTIONAL_AUTHORITY_SECRET");
        },
      });
      hostileFlow.deliveryCallbacks[0](hostileReport);
      await flushMicrotasks();
      expect(await hostileFlow.confirm(`optional-${authorityField}`)).toMatchObject({
        ok: false,
        reason: "consent_required",
      });
      expect(getterCalls).toBe(0);
    }
  });
});
