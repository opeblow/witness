import { blake2b } from '@noble/hashes/blake2b.js';
import { base58 } from '@scure/base';
import { concatBytes, utf8 } from './bytes.js';

/** Generic Substrate prefix; Portaldot V3 testnet reports SS58 format 42. */
export const PORTALDOT_SS58_PREFIX = 42;

const SS58_CONTEXT = utf8('SS58PRE');

/**
 * Encodes a 32-byte public key as an SS58 address.
 * Only the simple (single-byte) prefix range 0-63 is supported, which covers Portaldot.
 */
export function encodeAddress(publicKey: Uint8Array, prefix = PORTALDOT_SS58_PREFIX): string {
  if (publicKey.length !== 32) throw new RangeError('SS58 encoding expects a 32-byte public key');
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 63) {
    throw new RangeError('Only SS58 prefixes 0-63 are supported');
  }
  const body = concatBytes(Uint8Array.of(prefix), publicKey);
  const checksum = blake2b(concatBytes(SS58_CONTEXT, body), { dkLen: 64 }).subarray(0, 2);
  return base58.encode(concatBytes(body, checksum));
}

/** Decodes a simple-prefix SS58 address and checks its checksum. */
export function decodeAddress(address: string): { prefix: number; publicKey: Uint8Array } {
  const raw = base58.decode(address);
  if (raw.length !== 35) throw new RangeError('Unsupported SS58 address length');
  const body = raw.subarray(0, 33);
  const expected = blake2b(concatBytes(SS58_CONTEXT, body), { dkLen: 64 }).subarray(0, 2);
  if (raw[33] !== expected[0] || raw[34] !== expected[1]) throw new Error('Invalid SS58 checksum');
  const prefix = body[0] ?? 0;
  if (prefix > 63) throw new RangeError('Only SS58 prefixes 0-63 are supported');
  return { prefix, publicKey: body.slice(1) };
}

/** Shortens an address for display: `5Grwva...utQY`. */
export function shortAddress(address: string, head = 6, tail = 4): string {
  return address.length <= head + tail + 3
    ? address
    : `${address.slice(0, head)}...${address.slice(-tail)}`;
}
