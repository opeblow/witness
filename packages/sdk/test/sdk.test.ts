import { describe, expect, it } from 'vitest';
import { decodeFunctionData } from 'viem';
import { type Hex, createCapture, generateKeyPair } from '@witness/core';
import type { ApiPromise } from '@polkadot/api';
import {
  CERTIFICATE_FORMAT,
  PORTALDOT_V3_TESTNET,
  RegistryClient,
  RegistryNotDeployedError,
  WITNESS_REGISTRY_ABI,
  blockUrl,
  buildCaptureExtrinsic,
  encodeAnchorCall,
  encodeCertificate,
  parseCertificate,
  withDeployment,
} from '../src/index.js';

const H = (byte: string) => `0x${byte.repeat(32)}` as Hex;

describe('encodeAnchorCall', () => {
  it('encodes the registry anchor call with the dhash as uint64', () => {
    const data = encodeAnchorCall({
      contentHash: H('aa'),
      manifestDigest: H('bb'),
      signer: H('cc'),
      dhash: 'ffffffffffffffff',
    });
    const decoded = decodeFunctionData({ abi: WITNESS_REGISTRY_ABI, data });
    expect(decoded.functionName).toBe('anchor');
    expect(decoded.args).toEqual([H('aa'), H('bb'), H('cc'), 2n ** 64n - 1n]);
  });

  it('rejects malformed dhash values', () => {
    expect(() =>
      encodeAnchorCall({
        contentHash: H('aa'),
        manifestDigest: H('bb'),
        signer: H('cc'),
        dhash: 'xyz',
      }),
    ).toThrow();
  });
});

describe('network configuration', () => {
  it('refuses to build a registry client before deployment', () => {
    expect(() => new RegistryClient(PORTALDOT_V3_TESTNET)).toThrow(RegistryNotDeployedError);
  });

  it('applies a deployment record', () => {
    const network = withDeployment(PORTALDOT_V3_TESTNET, {
      network: 'portaldot-v3-testnet',
      registry: `0x${'12'.repeat(20)}`,
      deploymentBlock: 1234,
      deploymentExtrinsic: H('ee'),
      deployer: '5Grwva',
      deployedAt: '2026-11-01T00:00:00.000Z',
    });
    expect(network.registry).toBe(`0x${'12'.repeat(20)}`);
    expect(network.registryDeploymentBlock).toBe(1234);
  });

  it('links blocks to the node console', () => {
    expect(blockUrl(PORTALDOT_V3_TESTNET, 42)).toContain('#/explorer/query/42');
  });
});

describe('certificates', () => {
  const raster = { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(200) };
  const capture = createCapture({
    file: Uint8Array.of(1, 2, 3),
    mime: 'image/jpeg',
    raster,
    keys: generateKeyPair(),
    source: 'camera',
    block: { number: 10, hash: H('ab') },
    network: { name: 'portaldot-v3-testnet', genesis: H('cd') },
  });

  it('round-trips', () => {
    const text = encodeCertificate({
      format: CERTIFICATE_FORMAT,
      version: 1,
      network: 'portaldot-v3-testnet',
      registry: `0x${'12'.repeat(20)}`,
      anchor: { blockNumber: 12, blockHash: H('ef'), extrinsicIndex: 2 },
      capture,
    });
    const parsed = parseCertificate(text);
    expect(parsed.capture).toEqual(capture);
    expect(parsed.anchor.blockNumber).toBe(12);
  });

  it('rejects other JSON documents', () => {
    expect(() => parseCertificate('{"hello":"world"}')).toThrow('Not a Witness certificate');
  });
});

describe('buildCaptureExtrinsic', () => {
  it('passes the envelope and calldata as hex, not raw bytes', () => {
    // polkadot.js reads a raw Uint8Array argument as already SCALE-encoded (length-prefixed),
    // which corrupts the payload. Hex strings are encoded with a fresh length prefix.
    const calls: Record<string, unknown[]> = {};
    const record =
      (name: string) =>
      (...args: unknown[]) => {
        calls[name] = args;
        return { name };
      };
    const api = {
      tx: {
        transactionStorage: { store: record('store') },
        revive: { call: record('call') },
        utility: { batchAll: record('batchAll') },
      },
    } as unknown as ApiPromise;

    buildCaptureExtrinsic(api, {
      envelope: new Uint8Array([1, 2, 255]),
      registry: H('aa'),
      anchorCalldata: '0x1ceaa5e5' as Hex,
    });

    expect(calls['store']).toEqual(['0x0102ff']);
    expect(calls['call']?.[0]).toBe(H('aa'));
    expect(calls['call']?.[4]).toBe('0x1ceaa5e5');
    expect(calls['batchAll']).toEqual([[{ name: 'store' }, { name: 'call' }]]);
  });
});
