import { canonicalizeString } from "./canonical.js";

export function exactRecord(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Readonly<Record<string, unknown>> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  try {
    if (Array.isArray(value)) return null;
  } catch {
    return null;
  }
  let prototype: object | null;
  let keys: PropertyKey[];
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    return null;
  }
  if (prototype !== Object.prototype && prototype !== null) return null;
  const allowed: Set<string> = new Set<string>([...required, ...optional]);
  if (
    keys.some((key) => typeof key !== "string" || !allowed.has(key)) ||
    required.some((key) => !keys.includes(key))
  ) {
    return null;
  }
  const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    if (typeof key !== "string") return null;
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      return null;
    }
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      return null;
    }
    output[key] = descriptor.value;
  }
  return Object.freeze(output);
}

export function validIdentifier(value: unknown, maximum = 1_024): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    return false;
  }
  try {
    canonicalizeString(value);
    return true;
  } catch {
    return false;
  }
}

export function safeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}
