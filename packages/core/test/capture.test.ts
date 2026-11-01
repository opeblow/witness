import { describe, expect, it } from 'vitest';
import {
  type Anchor,
  type Evidence,
  type Hex,
  ManifestError,
  createCapture,
  decodeEnvelope,
  encodeEnvelope,
  evaluate,
  fingerprint,
  generateKeyPair,
  manifestDigest,
  parseSignedCapture,
  sha256Hex,
  signerAddress,
  verifyCaptureSignature,
} from '../src/index.js';
import { paint, reencode, scene } from './images.js';

const keys = generateKeyPair();
const raster = scene(320, 240, 3);
const file = new Uint8Array(raster.data.length);
file.set(Array.from(raster.data, (v) => Number(v)));

const BLOCK_HASH = `0x${'ab'.repeat(32)}` as Hex;
const GENESIS = `0x${'cd'.repeat(32)}` as Hex;

function capture(overrides: Partial<Parameters<typeof createCapture>[0]> = {}) {
  return createCapture({
    file,
    mime: 'image/jpeg',
    raster,
    keys,
    source: 'camera',
    block: { number: 1000, hash: BLOCK_HASH },
    network: { name: 'portaldot-v3-testnet', genesis: GENESIS },
    capturedAt: 1_793_500_000_000,
    ...overrides,
  });
}

function anchorFor(signed: ReturnType<typeof capture>, blockNumber = 1004): Anchor {
  return {
    contentHash: signed.manifest.content.sha256,
    blockNumber,
    submitter: `0x${'11'.repeat(20)}` as Hex,
    dhash: signed.manifest.fingerprint.dhash,
    manifestDigest: manifestDigest(signed.manifest),
    signer: signed.manifest.signer.key,
  };
}

describe('createCapture', () => {
  it('signs a manifest that verifies', () => {
    const signed = capture();
    expect(verifyCaptureSignature(signed)).toBe(true);
    expect(signed.manifest.content.sha256).toBe(sha256Hex(file));
    expect(signerAddress(signed.manifest.signer.key)).toMatch(/^5/);
  });

  it('omits the preview unless one is supplied', () => {
    expect(capture().manifest.preview).toBeUndefined();
    expect(capture({ preview: Uint8Array.of(1, 2, 3) }).manifest.preview?.mime).toBe('image/jpeg');
  });

  it('fails verification when any signed field changes', () => {
    const signed = capture();
    const tampered = { ...signed, manifest: { ...signed.manifest, note: 'edited later' } };
    expect(verifyCaptureSignature(tampered)).toBe(false);
  });

  it('fails verification under a different key', () => {
    const signed = capture();
    const other = generateKeyPair();
    const swapped = {
      ...signed,
      manifest: {
        ...signed.manifest,
        signer: {
          alg: 'ed25519' as const,
          key: `0x${Buffer.from(other.publicKey).toString('hex')}` as Hex,
        },
      },
    };
    expect(verifyCaptureSignature(swapped)).toBe(false);
  });
});

describe('envelopes', () => {
  it('round-trips through encodeEnvelope and decodeEnvelope', () => {
    const signed = capture({ note: 'Order 4471, unboxing' });
    const decoded = decodeEnvelope(encodeEnvelope(signed));
    expect(decoded).toEqual(signed);
    expect(decoded && verifyCaptureSignature(decoded)).toBe(true);
  });

  it('returns null for bytes that are not an envelope', () => {
    expect(decodeEnvelope(new TextEncoder().encode('hello'))).toBeNull();
    expect(decodeEnvelope(Uint8Array.of(0xff, 0xfe))).toBeNull();
  });

  it('rejects unknown fields and malformed values', () => {
    const signed = capture();
    expect(() =>
      parseSignedCapture({ ...signed, manifest: { ...signed.manifest, extra: 1 } }),
    ).toThrow(ManifestError);
    expect(() => parseSignedCapture({ ...signed, signature: '0x1234' })).toThrow(ManifestError);
    expect(() =>
      parseSignedCapture({
        ...signed,
        manifest: { ...signed.manifest, content: { ...signed.manifest.content, width: 0 } },
      }),
    ).toThrow(ManifestError);
  });
});

describe('evaluate', () => {
  const signed = capture();
  const evidence: Evidence = { anchor: anchorFor(signed), signed, source: 'chain' };

  it('returns authentic/exact for the original file', () => {
    const verdict = evaluate(
      { sha256: signed.manifest.content.sha256, fingerprint: fingerprint(raster) },
      [evidence],
    );
    expect(verdict.status).toBe('authentic');
    expect(verdict.status === 'authentic' && verdict.match).toBe('exact');
  });

  it('returns authentic/visual for a re-encoded copy', () => {
    const verdict = evaluate(
      { sha256: `0x${'00'.repeat(32)}`, fingerprint: fingerprint(reencode(raster)) },
      [evidence],
    );
    expect(verdict.status).toBe('authentic');
    expect(verdict.status === 'authentic' && verdict.match).toBe('visual');
  });

  it('returns altered for an edited copy', () => {
    const edited = paint(raster, { x: 0.4, y: 0.4, w: 0.25, h: 0.25 }, [250, 250, 250]);
    const verdict = evaluate({ sha256: `0x${'00'.repeat(32)}`, fingerprint: fingerprint(edited) }, [
      evidence,
    ]);
    expect(verdict.status).toBe('altered');
  });

  it('returns unverified when no candidate is related', () => {
    const verdict = evaluate(
      { sha256: `0x${'00'.repeat(32)}`, fingerprint: fingerprint(scene(320, 240, 77)) },
      [evidence],
    );
    expect(verdict.status).toBe('unverified');
  });

  it('never calls a capture authentic when the anchor disagrees with it', () => {
    const forged: Evidence = {
      ...evidence,
      anchor: { ...evidence.anchor, manifestDigest: `0x${'99'.repeat(32)}` as Hex },
    };
    const verdict = evaluate(
      { sha256: signed.manifest.content.sha256, fingerprint: fingerprint(raster) },
      [forged],
    );
    expect(verdict.status).toBe('invalid');
  });

  it('rejects a capture anchored long after the block it referenced', () => {
    const late: Evidence = { ...evidence, anchor: anchorFor(signed, 1000 + 500) };
    const verdict = evaluate(
      { sha256: signed.manifest.content.sha256, fingerprint: fingerprint(raster) },
      [late],
    );
    expect(verdict.status).toBe('invalid');
  });

  it('rejects an anchor that precedes the referenced block', () => {
    const early: Evidence = { ...evidence, anchor: anchorFor(signed, 999) };
    const verdict = evaluate(
      { sha256: signed.manifest.content.sha256, fingerprint: fingerprint(raster) },
      [early],
    );
    expect(verdict.status).toBe('invalid');
  });
});
