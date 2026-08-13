const NUMBER_TO_STRING: (radix?: number) => string =
  Number.prototype.toString;

export class CanonicalizationError extends TypeError {
  constructor() {
    super("The value is not strict RFC 8785 JSON data.");
    this.name = "CanonicalizationError";
  }
}

type CanonicalValue = Readonly<{
  text: string;
  value: unknown;
}>;

interface OwnShape {
  readonly descriptors: ReadonlyArray<PropertyDescriptor>;
  readonly keys: ReadonlyArray<PropertyKey>;
  readonly prototype: object | null;
}

function compareUtf16(left: string, right: string): number {
  const length: number = Math.min(left.length, right.length);
  for (let index: number = 0; index < length; index += 1) {
    const difference: number =
      left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function quoteString(value: string): string {
  let output: string = '"';
  for (let index: number = 0; index < value.length; index += 1) {
    const code: number = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const second: number = value.charCodeAt(index + 1);
      if (!(second >= 0xdc00 && second <= 0xdfff)) {
        throw new CanonicalizationError();
      }
      output += value[index] as string;
      output += value[index + 1] as string;
      index += 1;
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      throw new CanonicalizationError();
    }
    switch (code) {
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
        output += code <= 0x1f
          ? `\\u${code.toString(16).padStart(4, "0")}`
          : value[index] as string;
    }
  }
  return `${output}"`;
}

function captureOwnShape(value: object): OwnShape {
  try {
    const prototype: object | null = Object.getPrototypeOf(value);
    const keys: PropertyKey[] = Reflect.ownKeys(value);
    const descriptors: PropertyDescriptor[] = [];
    for (const key of keys) {
      const descriptor: PropertyDescriptor | undefined =
        Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) throw new CanonicalizationError();
      descriptors.push(descriptor);
    }
    if (Object.getPrototypeOf(value) !== prototype) {
      throw new CanonicalizationError();
    }
    return { descriptors, keys, prototype };
  } catch {
    throw new CanonicalizationError();
  }
}

function descriptorsMatch(
  left: PropertyDescriptor,
  right: PropertyDescriptor,
): boolean {
  const leftData: boolean = "value" in left;
  const rightData: boolean = "value" in right;
  return leftData === rightData &&
    left.configurable === right.configurable &&
    left.enumerable === right.enumerable &&
    (leftData
      ? left.writable === right.writable && Object.is(left.value, right.value)
      : Object.is(left.get, right.get) && Object.is(left.set, right.set));
}

function shapeStillMatches(value: object, expected: OwnShape): boolean {
  let observed: OwnShape;
  try {
    observed = captureOwnShape(value);
  } catch {
    return false;
  }
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

function canonicalValue(value: unknown, seen: WeakSet<object>): CanonicalValue {
  if (value === null) return { text: "null", value: null };
  switch (typeof value) {
    case "boolean":
      return { text: value ? "true" : "false", value };
    case "number":
      if (!Number.isFinite(value)) throw new CanonicalizationError();
      return {
        text: Object.is(value, -0)
          ? "0"
          : Reflect.apply(NUMBER_TO_STRING, value, []),
        value,
      };
    case "string":
      return { text: quoteString(value), value };
    case "object":
      break;
    default:
      throw new CanonicalizationError();
  }

  if (seen.has(value)) throw new CanonicalizationError();
  seen.add(value);

  const shape: OwnShape = captureOwnShape(value);

  if (Array.isArray(value)) {
    if (shape.prototype !== Array.prototype) throw new CanonicalizationError();
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
      !Number.isSafeInteger(length) ||
      length < 0 ||
      shape.keys.length !== length + 1
    ) {
      throw new CanonicalizationError();
    }
    const parts: string[] = [];
    const clone: unknown[] = new Array<unknown>(length);
    for (let index: number = 0; index < length; index += 1) {
      const descriptor: PropertyDescriptor | undefined =
        shape.descriptors[index];
      if (
        shape.keys[index] !== String(index) ||
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        throw new CanonicalizationError();
      }
      const child: CanonicalValue = canonicalValue(descriptor.value, seen);
      parts.push(child.text);
      clone[index] = child.value;
    }
    if (!Array.isArray(value) || !shapeStillMatches(value, shape)) {
      throw new CanonicalizationError();
    }
    seen.delete(value);
    return { text: `[${parts.join(",")}]`, value: Object.freeze(clone) };
  }

  if (shape.prototype !== Object.prototype && shape.prototype !== null) {
    throw new CanonicalizationError();
  }
  const entries: Array<Readonly<{
    key: string;
    text: string;
    value: unknown;
  }>> = [];
  for (let index: number = 0; index < shape.keys.length; index += 1) {
    const key: PropertyKey | undefined = shape.keys[index];
    const descriptor: PropertyDescriptor | undefined = shape.descriptors[index];
    if (
      typeof key !== "string" ||
      key === "toJSON" ||
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      throw new CanonicalizationError();
    }
    quoteString(key);
    const child: CanonicalValue = canonicalValue(descriptor.value, seen);
    entries.push({ key, text: child.text, value: child.value });
  }
  if (Array.isArray(value) || !shapeStillMatches(value, shape)) {
    throw new CanonicalizationError();
  }
  entries.sort((left, right) => compareUtf16(left.key, right.key));
  const clone: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const members: string[] = [];
  for (const entry of entries) {
    Object.defineProperty(clone, entry.key, {
      configurable: false,
      enumerable: true,
      value: entry.value,
      writable: false,
    });
    members.push(`${quoteString(entry.key)}:${entry.text}`);
  }
  seen.delete(value);
  return {
    text: `{${members.join(",")}}`,
    value: Object.freeze(clone),
  };
}

export function canonicalizeString(value: unknown): string {
  return canonicalValue(value, new WeakSet<object>()).text;
}

export function canonicalizeBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalizeString(value));
}

export function strictJsonClone<T>(value: T): T {
  return canonicalValue(value, new WeakSet<object>()).value as T;
}

export function parseCanonicalJson(bytes: Uint8Array): unknown {
  let text: string;
  let parsed: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new CanonicalizationError();
  }
  if (canonicalizeString(parsed) !== text) {
    throw new CanonicalizationError();
  }
  return strictJsonClone(parsed);
}
