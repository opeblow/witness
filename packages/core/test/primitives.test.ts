import { describe, expect, it } from 'vitest';
import {
  CanonicalJsonError,
  canonicalize,
  decodeAddress,
  encodeAddress,
  fromHex,
  resizeArea,
  toHex,
} from '../src/index.js';

describe('canonicalize', () => {
  it('sorts keys at every depth and drops whitespace', () => {
    expect(canonicalize({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[3,{"y":2,"z":1}]},"b":1}',
    );
  });

  it('is independent of insertion order', () => {
    expect(canonicalize({ x: 1, y: 2 })).toBe(canonicalize({ y: 2, x: 1 }));
  });

  it('escapes strings like JSON', () => {
    expect(canonicalize({ s: 'line\n"quoted"' })).toBe('{"s":"line\\n\\"quoted\\""}');
  });

  it.each([[1.5], [Number.NaN], [Number.POSITIVE_INFINITY], [2 ** 60]])(
    'rejects the number %s',
    (n) => {
      expect(() => canonicalize({ n })).toThrow(CanonicalJsonError);
    },
  );

  it('rejects undefined members and non-plain objects', () => {
    expect(() => canonicalize({ a: undefined })).toThrow(CanonicalJsonError);
    expect(() => canonicalize({ d: new Date(0) })).toThrow(CanonicalJsonError);
    expect(() => canonicalize({ b: 1n })).toThrow(CanonicalJsonError);
  });
});

describe('ss58', () => {
  // Well-known development key "Alice" (sr25519 public key) and its generic-prefix address.
  const alice = fromHex('0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d');
  const aliceAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

  it('encodes the known Alice address', () => {
    expect(encodeAddress(alice)).toBe(aliceAddress);
  });

  it('round-trips through decodeAddress', () => {
    const decoded = decodeAddress(aliceAddress);
    expect(decoded.prefix).toBe(42);
    expect(toHex(decoded.publicKey)).toBe(toHex(alice));
  });

  it('rejects a corrupted checksum', () => {
    expect(() => decodeAddress(`${aliceAddress.slice(0, -1)}R`)).toThrow();
  });
});

describe('hex', () => {
  it('round-trips bytes', () => {
    const bytes = Uint8Array.from([0, 1, 127, 128, 255]);
    expect(toHex(bytes)).toBe('0x00017f80ff');
    expect(fromHex('0x00017F80FF')).toEqual(bytes);
  });

  it('rejects odd-length and non-hex input', () => {
    expect(() => fromHex('0x123')).toThrow();
    expect(() => fromHex('0xzz')).toThrow();
    expect(() => fromHex('1234')).toThrow();
  });
});

describe('resizeArea', () => {
  it('preserves the mean of the plane', () => {
    const data = Float64Array.from({ length: 7 * 5 }, (_, i) => (i * 37) % 255);
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const small = resizeArea({ width: 7, height: 5, data }, 3, 2);
    const smallMean = small.data.reduce((a, b) => a + b, 0) / small.data.length;
    expect(smallMean).toBeCloseTo(mean, 9);
  });

  it('averages exact 2x2 blocks', () => {
    const data = Float64Array.from([0, 4, 8, 12, 2, 6, 10, 14]);
    const small = resizeArea({ width: 4, height: 2, data }, 2, 1);
    expect(Array.from(small.data)).toEqual([3, 11]);
  });
});
