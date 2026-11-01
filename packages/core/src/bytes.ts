import { base64 } from '@scure/base';

/** A 0x-prefixed, lowercase hexadecimal string. */
export type Hex = `0x${string}`;

const HEX_RE = /^0x([0-9a-fA-F]{2})*$/;

export function isHex(value: unknown, byteLength?: number): value is Hex {
  if (typeof value !== 'string' || !HEX_RE.test(value)) return false;
  return byteLength === undefined || value.length === 2 + byteLength * 2;
}

export function toHex(bytes: Uint8Array): Hex {
  let out = '0x';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out as Hex;
}

export function fromHex(hex: string): Uint8Array {
  if (!HEX_RE.test(hex)) throw new TypeError(`Invalid hex string: ${hex.slice(0, 18)}`);
  const out = new Uint8Array((hex.length - 2) / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(2 + i * 2, 4 + i * 2), 16);
  }
  return out;
}

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function fromUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function toBase64(bytes: Uint8Array): string {
  return base64.encode(bytes);
}

export function fromBase64(text: string): Uint8Array {
  return base64.decode(text);
}
