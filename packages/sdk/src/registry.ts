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
import type { ApiPromise } from '@polkadot/api';
import type { NetworkConfig } from './network.js';

/** Returns a connected Portaldot API, used to read registry events from native blocks. */
export type NativeApi = () => Promise<ApiPromise>;

/** Blocks per `state_queryStorage` request when scanning native events. */
const NATIVE_SCAN_CHUNK = 1000;

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
  private readonly native: NativeApi | undefined;

  /**
   * `native` is optional but recommended: Portaldot's Ethereum RPC only indexes logs of
   * Ethereum-style transactions, so `Anchored` events emitted by native `revive.call`
   * extrinsics (how Witness anchors) are only visible through the native chain.
   */
  constructor(network: NetworkConfig, client?: PublicClient, native?: NativeApi) {
    if (!network.registry) throw new RegistryNotDeployedError();
    this.address = network.registry;
    this.native = native;
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
    if (log) return { ...stored, ...this.fromLog(log) };
    const native = await this.nativeAnchors(stored.blockNumber, stored.blockNumber).catch(() => []);
    const match = native.find((a) => a.contentHash === stored.contentHash);
    return match ? { ...stored, ...match } : stored;
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
    let anchors = logs.map((log) => this.fromLog(log));
    if (anchors.length === 0 && this.native) {
      anchors = await this.nativeAnchors(Number(fromBlock), Number(head));
    }
    return anchors.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, limit);
  }

  /** `Anchored` events of this registry found in native blocks `from..to` (inclusive). */
  async nativeAnchors(from: number, to: number): Promise<Anchor[]> {
    if (!this.native) return [];
    const api = await this.native();
    const head = (await api.rpc.chain.getHeader()).number.toNumber();
    const last = Math.min(to, head);
    const key = api.query['system']?.['events']?.key();
    if (!key || from > last) return [];
    const ranges: [number, number][] = [];
    for (let start = from; start <= last; start += NATIVE_SCAN_CHUNK) {
      ranges.push([start, Math.min(start + NATIVE_SCAN_CHUNK - 1, last)]);
    }
    const found: Anchor[] = [];
    const scan = async ([a, b]: [number, number]) => {
      const [fromHash, toHash] = await Promise.all([
        api.rpc.chain.getBlockHash(a),
        api.rpc.chain.getBlockHash(b),
      ]);
      // @polkadot/api returns one [blockHash, values] pair per block whose events changed,
      // with values aligned to the requested keys (here only System.Events).
      const sets = (await api.rpc.state.queryStorage([key], fromHash, toHash)) as unknown as [
        unknown,
        { isNone: boolean; unwrap(): Uint8Array }[],
      ][];
      for (const [, values] of sets) {
        for (const data of values) {
          if (!data || data.isNone) continue;
          const records = api.createType('Vec<FrameSystemEventRecord>', data.unwrap());
          for (const { event } of records as unknown as Iterable<{
            event: { section: string; method: string; data: { toJSON(): unknown } };
          }>) {
            if (event.section !== 'revive' || event.method !== 'ContractEmitted') continue;
            const [contract, payload, topics] = event.data.toJSON() as [string, Hex, Hex[]];
            if (contract.toLowerCase() !== this.address.toLowerCase()) continue;
            try {
              found.push(
                this.fromLog({
                  data: payload,
                  topics: topics as [Hex, ...Hex[]],
                  transactionHash: null,
                }),
              );
            } catch {
              // Not an Anchored event.
            }
          }
        }
      }
    };
    for (let i = 0; i < ranges.length; i += 4) await Promise.all(ranges.slice(i, i + 4).map(scan));
    return found;
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
