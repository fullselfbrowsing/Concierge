const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function encodeBase64Url(bytes: Uint8Array): string {
  let output: string = "";
  for (let index: number = 0; index < bytes.length; index += 3) {
    const first: number = bytes[index] as number;
    const second: number | undefined = bytes[index + 1];
    const third: number | undefined = bytes[index + 2];
    const packed: number =
      (first << 16) |
      ((second ?? 0) << 8) |
      (third ?? 0);
    output += BASE64URL_ALPHABET[(packed >>> 18) & 63] as string;
    output += BASE64URL_ALPHABET[(packed >>> 12) & 63] as string;
    if (second !== undefined) {
      output += BASE64URL_ALPHABET[(packed >>> 6) & 63] as string;
    }
    if (third !== undefined) {
      output += BASE64URL_ALPHABET[packed & 63] as string;
    }
  }
  return output;
}

function alphabetValue(character: string): number {
  const index: number = BASE64URL_ALPHABET.indexOf(character);
  if (index < 0) throw new TypeError("Invalid base64url data.");
  return index;
}

export function decodeBase64Url(value: string, maximumBytes: number): Uint8Array {
  if (
    value.length % 4 === 1 ||
    !/^[A-Za-z0-9_-]*$/u.test(value) ||
    Math.floor(value.length * 3 / 4) > maximumBytes
  ) {
    throw new TypeError("Invalid base64url data.");
  }
  const bytes: number[] = [];
  for (let index: number = 0; index < value.length; index += 4) {
    const remaining: number = value.length - index;
    const a: number = alphabetValue(value[index] as string);
    const b: number = alphabetValue(value[index + 1] as string);
    const c: number = remaining > 2
      ? alphabetValue(value[index + 2] as string)
      : 0;
    const d: number = remaining > 3
      ? alphabetValue(value[index + 3] as string)
      : 0;
    const packed: number = (a << 18) | (b << 12) | (c << 6) | d;
    bytes.push((packed >>> 16) & 0xff);
    if (remaining > 2) bytes.push((packed >>> 8) & 0xff);
    if (remaining > 3) bytes.push(packed & 0xff);
  }
  const result: Uint8Array = new Uint8Array(bytes);
  if (encodeBase64Url(result) !== value) {
    throw new TypeError("Invalid base64url data.");
  }
  return result;
}

export function decodePem(
  value: string,
  label: "PRIVATE KEY" | "PUBLIC KEY",
): Uint8Array {
  const begin: string = `-----BEGIN ${label}-----`;
  const end: string = `-----END ${label}-----`;
  if (!value.startsWith(begin) || !value.trimEnd().endsWith(end)) {
    throw new TypeError("Invalid PEM key.");
  }
  const body: string = value
    .slice(begin.length, value.trimEnd().length - end.length)
    .replace(/[\r\n]/gu, "");
  if (
    body.length === 0 ||
    body.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(body)
  ) {
    throw new TypeError("Invalid PEM key.");
  }
  const unpadded: string = body.replace(/=+$/u, "");
  return decodeBase64Url(
    unpadded.replace(/\+/gu, "-").replace(/\//gu, "_"),
    16_384,
  );
}

export function asciiBytes(value: string): Uint8Array {
  const output: Uint8Array = new Uint8Array(value.length);
  for (let index: number = 0; index < value.length; index += 1) {
    const code: number = value.charCodeAt(index);
    if (code > 0x7f) throw new TypeError("Expected ASCII data.");
    output[index] = code;
  }
  return output;
}

/** Copy bytes into an ArrayBuffer-backed view accepted by WebCrypto. */
export function webCryptoBytes(
  value: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const buffer: ArrayBuffer = new ArrayBuffer(value.byteLength);
  const output: Uint8Array<ArrayBuffer> = new Uint8Array(buffer);
  output.set(value);
  return output;
}

export function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference: number = 0;
  for (let index: number = 0; index < left.length; index += 1) {
    difference |= (left[index] as number) ^ (right[index] as number);
  }
  return difference === 0;
}
