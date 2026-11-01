import { describe, expect, it } from 'vitest';
import {
  type Hex,
  type SignedCapture,
  createCapture,
  encodeEnvelope,
  generateKeyPair,
  toBase64,
} from '@witness/core';
import type { NotaryReceipt } from '@witness/sdk';
import { createApp } from '../src/app.js';
import { reviveAddressOf } from '@witness/sdk';
import { RateLimiter } from '../src/rate-limit.js';
import { type ChainPort, NotaryService } from '../src/service.js';

const GENESIS = `0x${'cd'.repeat(32)}` as Hex;
const HEAD = 5_000;
const blockHash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;

class FakeChain implements ChainPort {
  readonly networkName = 'portaldot-v3-testnet';
  readonly registry = `0x${'12'.repeat(20)}` as Hex;
  readonly sponsorAddress = '5FakeSponsor';
  readonly sponsorEvmAddress = `0x${'34'.repeat(20)}` as Hex;
  anchored = new Set<string>();
  submissions: SignedCapture[] = [];
  failNext: Error | null = null;

  genesisHash() {
    return GENESIS;
  }
  async bestBlockNumber() {
    return HEAD;
  }
  async blockHashAt(n: number) {
    return n <= HEAD ? blockHash(n) : null;
  }
  async isAnchored(contentHash: Hex) {
    return this.anchored.has(contentHash);
  }
  async submit(_envelope: Uint8Array, signed: SignedCapture): Promise<NotaryReceipt> {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = null;
      throw error;
    }
    this.submissions.push(signed);
    this.anchored.add(signed.manifest.content.sha256);
    return {
      contentHash: signed.manifest.content.sha256,
      blockNumber: HEAD + 1,
      blockHash: blockHash(HEAD + 1),
      extrinsicHash: `0x${'ef'.repeat(32)}`,
      extrinsicIndex: 2,
      submitter: this.sponsorAddress,
    };
  }
}

let seq = 0;
function makeCapture(
  overrides: {
    block?: number;
    blockHashOverride?: Hex;
    genesis?: Hex;
    keys?: ReturnType<typeof generateKeyPair>;
  } = {},
) {
  seq++;
  const block = overrides.block ?? HEAD - 2;
  return createCapture({
    file: Uint8Array.of(seq, seq >> 8, 7, 7),
    mime: 'image/jpeg',
    raster: { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(seq % 255) },
    keys: overrides.keys ?? generateKeyPair(),
    source: 'camera',
    block: { number: block, hash: overrides.blockHashOverride ?? blockHash(block) },
    network: { name: 'portaldot-v3-testnet', genesis: overrides.genesis ?? GENESIS },
  });
}

function setup(limits: { perMinute?: number; perHour?: number } = {}) {
  const chain = new FakeChain();
  const service = new NotaryService(chain, { maxCaptureWindowBlocks: 30, version: 'test' });
  const app = createApp(service, {
    allowedOrigins: ['*'],
    rateLimitPerMinute: limits.perMinute ?? 100,
    signerLimitPerHour: limits.perHour ?? 100,
    log: () => undefined,
  });
  const post = (body: unknown, ip = '203.0.113.7') =>
    app.request('/v1/captures', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  return { chain, app, post };
}

const envelopeOf = (signed: SignedCapture) => ({ envelope: toBase64(encodeEnvelope(signed)) });

async function errorCode(response: Response) {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

describe('POST /v1/captures', () => {
  it('anchors a valid capture and returns a receipt', async () => {
    const { chain, post } = setup();
    const signed = makeCapture();
    const response = await post(envelopeOf(signed));
    expect(response.status).toBe(201);
    const receipt = (await response.json()) as NotaryReceipt;
    expect(receipt.contentHash).toBe(signed.manifest.content.sha256);
    expect(receipt.blockNumber).toBe(HEAD + 1);
    expect(chain.submissions).toHaveLength(1);
  });

  it('rejects a capture whose signature was tampered with', async () => {
    const { chain, post } = setup();
    const signed = makeCapture();
    const forged = { ...signed, manifest: { ...signed.manifest, note: 'changed after signing' } };
    const response = await post(envelopeOf(forged));
    expect(response.status).toBe(422);
    expect(await errorCode(response)).toBe('bad_signature');
    expect(chain.submissions).toHaveLength(0);
  });

  it('rejects a capture for another network', async () => {
    const { post } = setup();
    const response = await post(
      envelopeOf(makeCapture({ genesis: `0x${'00'.repeat(32)}` as Hex })),
    );
    expect(await errorCode(response)).toBe('wrong_network');
  });

  it('rejects a block reference that does not exist on chain', async () => {
    const { post } = setup();
    const response = await post(
      envelopeOf(makeCapture({ blockHashOverride: `0x${'99'.repeat(32)}` as Hex })),
    );
    expect(await errorCode(response)).toBe('unknown_block');
  });

  it('rejects a capture that references an old block', async () => {
    const { post } = setup();
    const response = await post(envelopeOf(makeCapture({ block: HEAD - 31 })));
    expect(response.status).toBe(422);
    expect(await errorCode(response)).toBe('stale_block');
  });

  it('refuses to anchor the same file twice', async () => {
    const { post } = setup();
    const signed = makeCapture();
    expect((await post(envelopeOf(signed))).status).toBe(201);
    const again = await post(envelopeOf(signed));
    expect(again.status).toBe(409);
    expect(await errorCode(again)).toBe('already_anchored');
  });

  it('rejects malformed requests', async () => {
    const { post } = setup();
    expect(await errorCode(await post('not json'))).toBe('invalid_request');
    expect(await errorCode(await post({ envelope: '%%%' }))).toBe('invalid_request');
    expect(
      await errorCode(await post({ envelope: toBase64(new TextEncoder().encode('hello')) })),
    ).toBe('invalid_envelope');
    expect(await errorCode(await post({ envelope: 'aGk=', extra: true }))).toBe('invalid_request');
  });

  it('rate limits by client address', async () => {
    const { post } = setup({ perMinute: 2 });
    expect((await post(envelopeOf(makeCapture()))).status).toBe(201);
    expect((await post(envelopeOf(makeCapture()))).status).toBe(201);
    const limited = await post(envelopeOf(makeCapture()));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).not.toBeNull();
    expect((await post(envelopeOf(makeCapture()), '198.51.100.1')).status).toBe(201);
  });

  it('rate limits by signing device', async () => {
    const { post } = setup({ perHour: 1 });
    const keys = generateKeyPair();
    expect((await post(envelopeOf(makeCapture({ keys })), '192.0.2.1')).status).toBe(201);
    expect((await post(envelopeOf(makeCapture({ keys })), '192.0.2.2')).status).toBe(429);
  });

  it('maps chain failures to a 502 without leaking internals', async () => {
    const { chain, post } = setup();
    chain.failNext = new Error('revive.ContractReverted');
    const response = await post(envelopeOf(makeCapture()));
    expect(response.status).toBe(502);
    expect(await errorCode(response)).toBe('submission_failed');
  });
});

describe('GET endpoints', () => {
  it('reports health and configuration', async () => {
    const { app } = setup();
    expect((await app.request('/healthz')).status).toBe(200);
    const info = (await (await app.request('/v1/info')).json()) as {
      registry: string;
      maxCaptureWindowBlocks: number;
    };
    expect(info.registry).toBe(`0x${'12'.repeat(20)}`);
    expect(info.maxCaptureWindowBlocks).toBe(30);
  });

  it('returns JSON 404s', async () => {
    const { app } = setup();
    const response = await app.request('/nope');
    expect(response.status).toBe(404);
    expect(await errorCode(response)).toBe('not_found');
  });

  it('sets security headers', async () => {
    const { app } = setup();
    const response = await app.request('/healthz');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('RateLimiter', () => {
  it('refills over time', () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.take('a')).toBe(0);
    expect(limiter.take('a')).toBe(0);
    expect(limiter.take('a')).toBeGreaterThan(0);
    now = 600;
    expect(limiter.take('a')).toBe(0);
  });
});

describe('reviveAddressOf', () => {
  it('derives a 20-byte address', () => {
    expect(reviveAddressOf(new Uint8Array(32))).toMatch(/^0x[0-9a-f]{40}$/);
  });
});
