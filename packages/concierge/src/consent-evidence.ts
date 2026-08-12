import type {
  DigestLike,
  Readback,
} from "./types.js";

interface OwnShape {
  readonly descriptors: ReadonlyArray<PropertyDescriptor>;
  readonly keys: ReadonlyArray<PropertyKey>;
  readonly prototype: object | null;
}

interface StrictValue {
  readonly canonical: string;
  readonly value: unknown;
}

export interface PreparedReadback {
  readonly canonical: Readonly<Uint8Array>;
  readonly readback: Readback<unknown>;
}

export interface ReadbackReceiptSnapshot {
  readonly alg: unknown;
  readonly canonical: Readonly<Uint8Array>;
  readonly canonicalization: unknown;
  readonly hash: unknown;
}

export interface VerifiedReadbackEvidence {
  readonly canonical: Readonly<Uint8Array>;
  readonly hash: string;
  readonly receipt: ReadbackReceiptSnapshot;
}

export interface DeliveryEvidenceSnapshot {
  readonly attestation:
    | {
        readonly act: unknown;
        readonly readbackHash: unknown;
        readonly userTurnId: unknown;
      }
    | undefined;
  readonly outcome: unknown;
  readonly readbackHash: unknown;
  readonly responseId: unknown;
}

export type PreparedReadbackResult =
  | { readonly ok: true; readonly value: PreparedReadback }
  | { readonly ok: false };

export type ReadbackReceiptSnapshotResult =
  | { readonly ok: true; readonly value: ReadbackReceiptSnapshot }
  | { readonly ok: false };

export type DeliveryEvidenceSnapshotResult =
  | { readonly ok: true; readonly value: DeliveryEvidenceSnapshot }
  | { readonly ok: false };

const NUMBER_TO_STRING: (radix?: number) => string = Number.prototype.toString;
const TYPED_ARRAY_PROTOTYPE: object | null = Object.getPrototypeOf(
  Uint8Array.prototype,
);
const TYPED_ARRAY_BUFFER_GETTER: (() => unknown) | undefined =
  TYPED_ARRAY_PROTOTYPE === null
    ? undefined
    : Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "buffer")?.get;
const TYPED_ARRAY_LENGTH_GETTER: (() => unknown) | undefined =
  TYPED_ARRAY_PROTOTYPE === null
    ? undefined
    : Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTOTYPE, "length")?.get;
const ARRAY_BUFFER_BYTE_LENGTH_GETTER: (() => unknown) | undefined =
  Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")?.get;

/** Compare two reflection snapshots without consulting the inspected value. */
function descriptorsMatch(
  left: PropertyDescriptor,
  right: PropertyDescriptor,
): boolean {
  const leftIsData: boolean = "value" in left;
  const rightIsData: boolean = "value" in right;
  return leftIsData === rightIsData &&
    left.configurable === right.configurable &&
    left.enumerable === right.enumerable &&
    (leftIsData
      ? left.writable === right.writable && Object.is(left.value, right.value)
      : Object.is(left.get, right.get) && Object.is(left.set, right.set));
}

/** Capture every own key and descriptor while containing all reflective traps. */
function captureOwnShape(value: object): OwnShape | null {
  try {
    const prototype: object | null = Object.getPrototypeOf(value);
    const keys: PropertyKey[] = Reflect.ownKeys(value);
    const descriptors: PropertyDescriptor[] = [];
    for (const key of keys) {
      const descriptor: PropertyDescriptor | undefined =
        Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) {
        return null;
      }
      descriptors.push(descriptor);
    }
    if (Object.getPrototypeOf(value) !== prototype) {
      return null;
    }
    return { descriptors, keys, prototype };
  } catch {
    return null;
  }
}

/** Re-run reflection so a proxy or mutation cannot supply two different shapes. */
function shapesMatch(expected: OwnShape, observed: OwnShape): boolean {
  if (
    observed.prototype !== expected.prototype ||
    observed.keys.length !== expected.keys.length
  ) {
    return false;
  }
  for (let index: number = 0; index < expected.keys.length; index += 1) {
    if (
      observed.keys[index] !== expected.keys[index] ||
      !descriptorsMatch(
        expected.descriptors[index] as PropertyDescriptor,
        observed.descriptors[index] as PropertyDescriptor,
      )
    ) {
      return false;
    }
  }
  return true;
}

function shapeStillMatches(value: object, expected: OwnShape): boolean {
  const observed: OwnShape | null = captureOwnShape(value);
  return observed !== null && shapesMatch(expected, observed);
}

function dataDescriptor(
  shape: OwnShape,
  key: PropertyKey,
  enumerable?: boolean,
): PropertyDescriptor | null {
  const index: number = shape.keys.indexOf(key);
  if (index < 0) {
    return null;
  }
  const descriptor: PropertyDescriptor | undefined = shape.descriptors[index];
  return descriptor !== undefined &&
    "value" in descriptor &&
    (enumerable === undefined || descriptor.enumerable === enumerable)
    ? descriptor
    : null;
}

/** Quote one well-formed ECMAScript string using RFC 8785's minimal escapes. */
function quoteString(value: string): string | null {
  let output: string = '"';
  for (let index: number = 0; index < value.length; index += 1) {
    const codeUnit: number = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const low: number = value.charCodeAt(index + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) {
        return null;
      }
      output += value[index] as string;
      index += 1;
      output += value[index] as string;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return null;
    }
    switch (codeUnit) {
      case 0x08:
        output += "\\b";
        break;
      case 0x09:
        output += "\\t";
        break;
      case 0x0a:
        output += "\\n";
        break;
      case 0x0c:
        output += "\\f";
        break;
      case 0x0d:
        output += "\\r";
        break;
      case 0x22:
        output += '\\"';
        break;
      case 0x5c:
        output += "\\\\";
        break;
      default:
        output += codeUnit <= 0x1f
          ? `\\u${codeUnit.toString(16).padStart(4, "0")}`
          : value[index] as string;
    }
  }
  return `${output}"`;
}

/** RFC 8785 orders names by their raw unsigned UTF-16 code units. */
function compareUtf16(left: string, right: string): number {
  const length: number = Math.min(left.length, right.length);
  for (let index: number = 0; index < length; index += 1) {
    const difference: number = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) {
      return difference;
    }
  }
  return left.length - right.length;
}

function snapshotStrictValue(
  value: unknown,
  seen: WeakSet<object>,
): StrictValue | null {
  if (value === null) {
    return { canonical: "null", value: null };
  }
  switch (typeof value) {
    case "boolean":
      return { canonical: value ? "true" : "false", value };
    case "number":
      if (!Number.isFinite(value)) {
        return null;
      }
      return {
        canonical: Object.is(value, -0)
          ? "0"
          : NUMBER_TO_STRING.call(value),
        value,
      };
    case "string": {
      const canonical: string | null = quoteString(value);
      return canonical === null ? null : { canonical, value };
    }
    case "object":
      break;
    default:
      return null;
  }

  if (seen.has(value)) {
    return null;
  }
  seen.add(value);
  const shape: OwnShape | null = captureOwnShape(value);
  if (shape === null) {
    return null;
  }

  if (Array.isArray(value)) {
    if (shape.prototype !== Array.prototype) {
      return null;
    }
    const lastIndex: number = shape.keys.length - 1;
    const lengthDescriptor: PropertyDescriptor | undefined =
      shape.keys[lastIndex] === "length"
        ? shape.descriptors[lastIndex]
        : undefined;
    const length: unknown = lengthDescriptor?.value;
    if (
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      lengthDescriptor.enumerable !== false ||
      typeof length !== "number" ||
      !Number.isInteger(length) ||
      length < 0 ||
      shape.keys.length !== length + 1
    ) {
      return null;
    }
    const clone: unknown[] = new Array<unknown>(length);
    const canonicalItems: string[] = [];
    for (let index: number = 0; index < length; index += 1) {
      const descriptor: PropertyDescriptor | undefined =
        shape.descriptors[index];
      if (
        shape.keys[index] !== `${index}` ||
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        return null;
      }
      const child: StrictValue | null = snapshotStrictValue(
        descriptor.value,
        seen,
      );
      if (child === null) {
        return null;
      }
      clone[index] = child.value;
      canonicalItems.push(child.canonical);
    }
    if (!Array.isArray(value) || !shapeStillMatches(value, shape)) {
      return null;
    }
    Object.freeze(clone);
    return { canonical: `[${canonicalItems.join(",")}]`, value: clone };
  }

  if (shape.prototype !== Object.prototype && shape.prototype !== null) {
    return null;
  }
  const entries: Array<{
    readonly canonical: string;
    readonly key: string;
    readonly value: unknown;
  }> = [];
  for (let index: number = 0; index < shape.keys.length; index += 1) {
    const key: PropertyKey | undefined = shape.keys[index];
    const descriptor: PropertyDescriptor | undefined = shape.descriptors[index];
    if (
      typeof key !== "string" ||
      key === "toJSON" ||
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true ||
      quoteString(key) === null
    ) {
      return null;
    }
    const child: StrictValue | null = snapshotStrictValue(
      descriptor.value,
      seen,
    );
    if (child === null) {
      return null;
    }
    entries.push({ canonical: child.canonical, key, value: child.value });
  }
  if (Array.isArray(value) || !shapeStillMatches(value, shape)) {
    return null;
  }
  entries.sort((left, right) => compareUtf16(left.key, right.key));
  const clone: Record<string, unknown> = Object.create(shape.prototype);
  const canonicalMembers: string[] = [];
  for (const entry of entries) {
    const quotedKey: string | null = quoteString(entry.key);
    if (quotedKey === null) {
      return null;
    }
    Object.defineProperty(clone, entry.key, {
      configurable: true,
      enumerable: true,
      value: entry.value,
      writable: true,
    });
    canonicalMembers.push(`${quotedKey}:${entry.canonical}`);
  }
  Object.freeze(clone);
  return { canonical: `{${canonicalMembers.join(",")}}`, value: clone };
}

/** Encode well-formed Unicode scalar values without a host TextEncoder. */
function encodeUtf8(value: string): Uint8Array | null {
  const bytes: number[] = [];
  for (let index: number = 0; index < value.length; index += 1) {
    const first: number = value.charCodeAt(index);
    let scalar: number = first;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second: number = value.charCodeAt(index + 1);
      if (!(second >= 0xdc00 && second <= 0xdfff)) {
        return null;
      }
      scalar = 0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00);
      index += 1;
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      return null;
    }

    if (scalar <= 0x7f) {
      bytes.push(scalar);
    } else if (scalar <= 0x7ff) {
      bytes.push(0xc0 | (scalar >> 6), 0x80 | (scalar & 0x3f));
    } else if (scalar <= 0xffff) {
      bytes.push(
        0xe0 | (scalar >> 12),
        0x80 | ((scalar >> 6) & 0x3f),
        0x80 | (scalar & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (scalar >> 18),
        0x80 | ((scalar >> 12) & 0x3f),
        0x80 | ((scalar >> 6) & 0x3f),
        0x80 | (scalar & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

/** Detach, freeze, and canonicalize the exact payload handed to a presenter. */
export function prepareReadback(payload: unknown): PreparedReadbackResult {
  try {
    const strict: StrictValue | null = snapshotStrictValue(
      payload,
      new WeakSet<object>(),
    );
    if (strict === null) {
      return { ok: false };
    }
    const canonical: Uint8Array | null = encodeUtf8(
      `{"payload":${strict.canonical}}`,
    );
    if (canonical === null) {
      return { ok: false };
    }
    const readback: Readback<unknown> = Object.freeze({
      payload: strict.value,
    });
    return {
      ok: true,
      value: Object.freeze({ canonical, readback }),
    };
  } catch {
    return { ok: false };
  }
}

function copyTypedArrayShape(
  shape: OwnShape,
  length: number,
): Uint8Array | null {
  if (shape.keys.length !== length) {
    return null;
  }
  const copy: Uint8Array = new Uint8Array(length);
  for (let index: number = 0; index < length; index += 1) {
    const descriptor: PropertyDescriptor | undefined = shape.descriptors[index];
    const byte: unknown = descriptor?.value;
    if (
      shape.keys[index] !== `${index}` ||
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true ||
      typeof byte !== "number" ||
      !Number.isInteger(byte) ||
      byte < 0 ||
      byte > 0xff
    ) {
      return null;
    }
    copy[index] = byte;
  }
  return copy;
}

function copyCanonicalBytes(value: unknown): Uint8Array | null {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      !ArrayBuffer.isView(value) ||
      Object.getPrototypeOf(value) !== Uint8Array.prototype ||
      TYPED_ARRAY_BUFFER_GETTER === undefined ||
      TYPED_ARRAY_LENGTH_GETTER === undefined ||
      ARRAY_BUFFER_BYTE_LENGTH_GETTER === undefined
    ) {
      return null;
    }
    const shape: OwnShape | null = captureOwnShape(value);
    const length: unknown = Reflect.apply(TYPED_ARRAY_LENGTH_GETTER, value, []);
    const buffer: unknown = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []);
    if (
      shape === null ||
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      typeof buffer !== "object" ||
      buffer === null ||
      Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    ) {
      return null;
    }
    const bufferShape: OwnShape | null = captureOwnShape(buffer);
    if (
      bufferShape === null ||
      bufferShape.keys.length !== 0 ||
      typeof Reflect.apply(ARRAY_BUFFER_BYTE_LENGTH_GETTER, buffer, []) !==
        "number"
    ) {
      return null;
    }
    const first: Uint8Array | null = copyTypedArrayShape(shape, length);
    const repeatedShape: OwnShape | null = captureOwnShape(value);
    if (
      first === null ||
      repeatedShape === null ||
      !shapesMatch(shape, repeatedShape)
    ) {
      return null;
    }
    const second: Uint8Array | null = copyTypedArrayShape(
      repeatedShape,
      length,
    );
    if (second === null || !shapeStillMatches(buffer, bufferShape)) {
      return null;
    }
    return bytesEqual(first, second) ? first : null;
  } catch {
    return null;
  }
}

/** Copy only the receipt's four authority-bearing own data claims. */
export function snapshotReadbackReceipt(
  receipt: unknown,
): ReadbackReceiptSnapshotResult {
  if (typeof receipt !== "object" || receipt === null) {
    return { ok: false };
  }
  const shape: OwnShape | null = captureOwnShape(receipt);
  if (
    shape === null ||
    (shape.prototype !== Object.prototype && shape.prototype !== null)
  ) {
    return { ok: false };
  }
  const alg: PropertyDescriptor | null = dataDescriptor(shape, "alg");
  const canonicalization: PropertyDescriptor | null = dataDescriptor(
    shape,
    "canonicalization",
  );
  const canonical: PropertyDescriptor | null = dataDescriptor(
    shape,
    "canonical",
  );
  const hash: PropertyDescriptor | null = dataDescriptor(shape, "hash");
  if (
    alg === null ||
    canonicalization === null ||
    canonical === null ||
    hash === null
  ) {
    return { ok: false };
  }
  const canonicalCopy: Uint8Array | null = copyCanonicalBytes(canonical.value);
  if (canonicalCopy === null || !shapeStillMatches(receipt, shape)) {
    return { ok: false };
  }
  return {
    ok: true,
    value: Object.freeze({
      alg: alg.value,
      canonical: canonicalCopy,
      canonicalization: canonicalization.value,
      hash: hash.value,
    }),
  };
}

function bytesEqual(
  left: Readonly<Uint8Array>,
  right: Readonly<Uint8Array>,
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index: number = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function isSha256Hex(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 64) {
    return false;
  }
  for (let index: number = 0; index < value.length; index += 1) {
    const code: number = value.charCodeAt(index);
    if (!((code >= 0x30 && code <= 0x39) || (code >= 0x61 && code <= 0x66))) {
      return false;
    }
  }
  return true;
}

function digestHex(value: unknown): string | null {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      Object.getPrototypeOf(value) !== ArrayBuffer.prototype ||
      ARRAY_BUFFER_BYTE_LENGTH_GETTER === undefined
    ) {
      return null;
    }
    const shape: OwnShape | null = captureOwnShape(value);
    const byteLength: unknown = Reflect.apply(
      ARRAY_BUFFER_BYTE_LENGTH_GETTER,
      value,
      [],
    );
    if (shape === null || shape.keys.length !== 0 || byteLength !== 32) {
      return null;
    }
    const bytes: Uint8Array = new Uint8Array(value as ArrayBuffer);
    const repeated: Uint8Array = new Uint8Array(value as ArrayBuffer);
    if (!bytesEqual(bytes, repeated) || !shapeStillMatches(value, shape)) {
      return null;
    }
    let result: string = "";
    for (let index: number = 0; index < bytes.length; index += 1) {
      result += (bytes[index] as number).toString(16).padStart(2, "0");
    }
    return result;
  } catch {
    return null;
  }
}

/** Capture one callable digest method together with its required receiver. */
export function captureDigestCapability(value: unknown): DigestLike | undefined {
  if (
    (typeof value !== "object" && typeof value !== "function") ||
    value === null
  ) {
    return undefined;
  }
  let method: unknown;
  try {
    method = (value as { readonly digest?: unknown }).digest;
  } catch {
    return undefined;
  }
  if (typeof method !== "function") {
    return undefined;
  }
  const receiver: object = value;
  return Object.freeze({
    digest(
      algorithm: "SHA-256",
      data: ArrayBuffer | ArrayBufferView,
    ): Promise<ArrayBuffer> {
      return Reflect.apply(method, receiver, [algorithm, data]) as Promise<ArrayBuffer>;
    },
  });
}

/** Hash a defensive byte copy through the injected SHA-256 capability. */
export async function digestReadback(
  digest: DigestLike | undefined,
  canonical: Readonly<Uint8Array>,
): Promise<string | null> {
  if (digest === undefined) {
    return null;
  }
  try {
    const result: ArrayBuffer = await digest.digest(
      "SHA-256",
      new Uint8Array(canonical),
    );
    return digestHex(result);
  } catch {
    return null;
  }
}

/** Cross-check caller claims against retained bytes and a fresh digest. */
export function verifyReadbackReceipt(
  prepared: PreparedReadback,
  receipt: ReadbackReceiptSnapshot,
  freshHash: string | null,
): VerifiedReadbackEvidence | null {
  if (
    receipt.alg !== "SHA-256" ||
    receipt.canonicalization !== "JCS" ||
    !isSha256Hex(receipt.hash) ||
    freshHash !== receipt.hash ||
    !bytesEqual(prepared.canonical, receipt.canonical)
  ) {
    return null;
  }
  const retainedReceipt: ReadbackReceiptSnapshot = Object.freeze({
    alg: receipt.alg,
    canonical: new Uint8Array(receipt.canonical),
    canonicalization: receipt.canonicalization,
    hash: receipt.hash,
  });
  return Object.freeze({
    canonical: new Uint8Array(prepared.canonical),
    hash: receipt.hash,
    receipt: retainedReceipt,
  });
}

function snapshotAttestation(
  value: unknown,
): DeliveryEvidenceSnapshot["attestation"] | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const shape: OwnShape | null = captureOwnShape(value);
  if (
    shape === null ||
    (shape.prototype !== Object.prototype && shape.prototype !== null)
  ) {
    return null;
  }
  const act: PropertyDescriptor | null = dataDescriptor(shape, "act");
  const userTurnId: PropertyDescriptor | null = dataDescriptor(
    shape,
    "userTurnId",
  );
  const readbackHash: PropertyDescriptor | null = dataDescriptor(
    shape,
    "readbackHash",
  );
  if (
    act === null ||
    userTurnId === null ||
    readbackHash === null ||
    !shapeStillMatches(value, shape)
  ) {
    return null;
  }
  return Object.freeze({
    act: act.value,
    readbackHash: readbackHash.value,
    userTurnId: userTurnId.value,
  });
}

/** Snapshot delivery claims synchronously before any digest await. */
export function snapshotDeliveryEvidence(
  report: unknown,
): DeliveryEvidenceSnapshotResult {
  if (typeof report !== "object" || report === null) {
    return { ok: false };
  }
  const shape: OwnShape | null = captureOwnShape(report);
  if (
    shape === null ||
    (shape.prototype !== Object.prototype && shape.prototype !== null)
  ) {
    return { ok: false };
  }
  const responseId: PropertyDescriptor | null = dataDescriptor(
    shape,
    "responseId",
  );
  const outcome: PropertyDescriptor | null = dataDescriptor(
    shape,
    "outcome",
  );
  const hasReadbackHash: boolean = shape.keys.includes("readbackHash");
  const readbackHash: PropertyDescriptor | null = dataDescriptor(
    shape,
    "readbackHash",
  );
  const hasAttestation: boolean = shape.keys.includes("attestation");
  const attestationDescriptor: PropertyDescriptor | null = dataDescriptor(
    shape,
    "attestation",
  );
  if (
    responseId === null ||
    outcome === null ||
    (hasReadbackHash && readbackHash === null) ||
    (hasAttestation && attestationDescriptor === null)
  ) {
    return { ok: false };
  }
  let attestation: DeliveryEvidenceSnapshot["attestation"];
  if (attestationDescriptor === null || attestationDescriptor.value === undefined) {
    attestation = undefined;
  } else {
    const observedAttestation = snapshotAttestation(
      attestationDescriptor.value,
    );
    if (observedAttestation === null) {
      return { ok: false };
    }
    attestation = observedAttestation;
  }
  if (!shapeStillMatches(report, shape)) {
    return { ok: false };
  }
  return {
    ok: true,
    value: Object.freeze({
      attestation,
      outcome: outcome.value,
      readbackHash: readbackHash?.value,
      responseId: responseId.value,
    }),
  };
}
