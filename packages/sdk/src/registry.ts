import { type Anchor, type Hex, dhashFromBigInt, dhashToBigInt } from '@witness/core';
import {
  type PublicClient,
  createPublicClient,
  decodeEventLog,
  defineChain,
  encodeFunctionData,
  getAbiItem,
  http,
} from 'viem';
import type { NetworkConfig } from './network.js';

export const WITNESS_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'anchor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'manifestDigest', type: 'bytes32' },
      { name: 'signer', type: 'bytes32' },
      { name: 'dhash', type: 'uint64' },
    ],
    outputs: [{ name: 'blockNumber', type: 'uint32' }],
  },
  {
    type: 'function',
    name: 'anchorOf',
    stateMutability: 'view',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'submitter', type: 'address' },
          { name: 'blockNumber', type: 'uint32' },
          { name: 'dhash', type: 'uint64' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'isAnchored',
    stateMutability: 'view',
    inputs: [{ name: 'contentHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'anchorCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'Anchored',
    inputs: [
      { name: 'contentHash', type: 'bytes32', indexed: true },
      { name: 'signer', type: 'bytes32', indexed: true },
      { name: 'submitter', type: 'address', indexed: true },
      { name: 'manifestDigest', type: 'bytes32', indexed: false },
      { name: 'dhash', type: 'uint64', indexed: false },
      { name: 'blockNumber', type: 'uint32', indexed: false },
    ],
  },
  {
    type: 'error',
    name: 'AlreadyAnchored',
    inputs: [
      { name: 'contentHash', type: 'bytes32' },
      { name: 'blockNumber', type: 'uint32' },
      { name: 'submitter', type: 'address' },
    ],
  },
  { type: 'error', name: 'ZeroValue', inputs: [] },
  { type: 'error', name: 'BlockNumberOverflow', inputs: [] },
] as const;

const ANCHORED_EVENT = getAbiItem({ abi: WITNESS_REGISTRY_ABI, name: 'Anchored' });

/** Calldata for `WitnessRegistry.anchor`, used inside the native batch extrinsic. */
export function encodeAnchorCall(input: {
  contentHash: Hex;
  manifestDigest: Hex;
  signer: Hex;
  dhash: string;
}): Hex {
  return encodeFunctionData({
    abi: WITNESS_REGISTRY_ABI,
    functionName: 'anchor',
    args: [input.contentHash, input.manifestDigest, input.signer, dhashToBigInt(input.dhash)],
  });
}

export class RegistryNotDeployedError extends Error {
  override readonly name = 'RegistryNotDeployedError';
  constructor() {
    super('WitnessRegistry is not deployed on this network yet. Run `npm run deploy:registry`.');
  }
}

/** Read-only access to WitnessRegistry through Portaldot's Ethereum JSON-RPC endpoint. */
export class RegistryClient {
  readonly address: Hex;
  private readonly client: PublicClient;
  private readonly fromBlock: bigint;

  constructor(network: NetworkConfig, client?: PublicClient) {
    if (!network.registry) throw new RegistryNotDeployedError();
    this.address = network.registry;
    this.fromBlock = BigInt(network.registryDeploymentBlock);
    this.client =
      client ??
      createPublicClient({
        chain: defineChain({
          id: network.evmChainId,
          name: network.name,
          nativeCurrency: { name: 'Portaldot', symbol: network.tokenSymbol, decimals: 18 },
          rpcUrls: { default: { http: [network.evmRpc] } },
        }),
        transport: http(network.evmRpc, { retryCount: 2, timeout: 20_000 }),
      });
  }

  /** The stored anchor of a file, or null if it was never anchored. */
  async anchorOf(contentHash: Hex): Promise<Anchor | null> {
    const result = await this.client.readContract({
      address: this.address,
      abi: WITNESS_REGISTRY_ABI,
      functionName: 'anchorOf',
      args: [contentHash],
    });
    if (result.blockNumber === 0) return null;
    return {
      contentHash: contentHash.toLowerCase() as Hex,
      blockNumber: result.blockNumber,
      submitter: result.submitter.toLowerCase() as Hex,
      dhash: dhashFromBigInt(result.dhash),
    };
  }

  async anchorCount(): Promise<number> {
    const count = await this.client.readContract({
      address: this.address,
      abi: WITNESS_REGISTRY_ABI,
      functionName: 'anchorCount',
    });
    return Number(count);
  }

  /** The anchor including event-only fields (manifest digest, signer, transaction). */
  async anchorWithEvent(contentHash: Hex): Promise<Anchor | null> {
    const stored = await this.anchorOf(contentHash);
    if (!stored) return null;
    const logs = await this.client.getLogs({
      address: this.address,
      event: ANCHORED_EVENT,
      args: { contentHash },
      fromBlock: BigInt(stored.blockNumber),
      toBlock: BigInt(stored.blockNumber),
    });
    const log = logs[0];
    if (!log) return stored;
    return { ...stored, ...this.fromLog(log) };
  }

  /** Recent anchors, newest first. */
  async recent(options: { limit?: number; lookbackBlocks?: number } = {}): Promise<Anchor[]> {
    const limit = options.limit ?? 50;
    const head = await this.client.getBlockNumber();
    const lookback = BigInt(options.lookbackBlocks ?? 100_800);
    const start = head > lookback ? head - lookback : 0n;
    const fromBlock = start > this.fromBlock ? start : this.fromBlock;
    const logs = await this.client.getLogs({
      address: this.address,
      event: ANCHORED_EVENT,
      fromBlock,
      toBlock: 'latest',
    });
    return logs
      .map((log) => this.fromLog(log))
      .sort((a, b) => b.blockNumber - a.blockNumber)
      .slice(0, limit);
  }

  private fromLog(log: {
    data: Hex;
    topics: [Hex, ...Hex[]] | [];
    transactionHash: Hex | null;
  }): Anchor {
    const decoded = decodeEventLog({
      abi: WITNESS_REGISTRY_ABI,
      eventName: 'Anchored',
      data: log.data,
      topics: log.topics,
    });
    const args = decoded.args;
    return {
      contentHash: args.contentHash.toLowerCase() as Hex,
      blockNumber: args.blockNumber,
      submitter: args.submitter.toLowerCase() as Hex,
      dhash: dhashFromBigInt(args.dhash),
      manifestDigest: args.manifestDigest.toLowerCase() as Hex,
      signer: args.signer.toLowerCase() as Hex,
      ...(log.transactionHash ? { transactionHash: log.transactionHash } : {}),
    };
  }
}
