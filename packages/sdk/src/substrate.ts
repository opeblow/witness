import { ApiPromise, WsProvider } from '@polkadot/api';
import type { ProviderInterface } from '@polkadot/rpc-provider/types';
import type { SubmittableExtrinsic, SubmittableExtrinsicFunction } from '@polkadot/api/types';
import { type Hex, type SignedCapture, decodeEnvelope, fromHex } from '@witness/core';

/** Gas and deposit limits for the registry call. Unused weight is refunded by the runtime. */
export interface AnchorCallLimits {
  readonly refTime: bigint;
  readonly proofSize: bigint;
  /** Upper bound on the storage deposit, in plancks (10^-14 tPOT). */
  readonly storageDepositLimit: bigint;
}

export const DEFAULT_ANCHOR_LIMITS: AnchorCallLimits = {
  refTime: 30_000_000_000n,
  proofSize: 1_000_000n,
  storageDepositLimit: 10n * 10n ** 14n,
};

export interface BlockRef {
  readonly number: number;
  readonly hash: Hex;
}

/**
 * Opens a connection to a Portaldot node.
 * The cast is needed because polkadot.js types do not compile under
 * `exactOptionalPropertyTypes`; the runtime object is exactly what ApiPromise expects.
 */
export function connectPortaldot(endpoint: string): Promise<ApiPromise> {
  const provider = new WsProvider(endpoint) as unknown as ProviderInterface;
  return ApiPromise.create({ provider, noInitWarn: true });
}

/** Latest finalized block: what a device embeds as "this capture is no older than". */
export async function latestFinalizedBlock(api: ApiPromise): Promise<BlockRef> {
  const hash = await api.rpc.chain.getFinalizedHead();
  const header = await api.rpc.chain.getHeader(hash);
  return { number: header.number.toNumber(), hash: hash.toHex() as Hex };
}

export async function blockHashAt(api: ApiPromise, blockNumber: number): Promise<Hex | null> {
  const hash = await api.rpc.chain.getBlockHash(blockNumber);
  return hash.isEmpty || /^0x0+$/.test(hash.toHex()) ? null : (hash.toHex() as Hex);
}

export function genesisHash(api: ApiPromise): Hex {
  return api.genesisHash.toHex() as Hex;
}

/**
 * Builds the single atomic extrinsic that records a capture:
 * `utility.batchAll([transactionStorage.store(envelope), revive.call(registry, anchor(...))])`.
 * Either both the evidence and its anchor land, or neither does.
 */
export function buildCaptureExtrinsic(
  api: ApiPromise,
  input: { envelope: Uint8Array; registry: Hex; anchorCalldata: Hex; limits?: AnchorCallLimits },
): SubmittableExtrinsic<'promise'> {
  const limits = input.limits ?? DEFAULT_ANCHOR_LIMITS;
  const store = txOf(api, 'transactionStorage', 'store')(input.envelope);
  const anchor = txOf(api, 'revive', 'call')(
    input.registry,
    0,
    { refTime: limits.refTime, proofSize: limits.proofSize },
    limits.storageDepositLimit,
    fromHex(input.anchorCalldata),
  );
  return txOf(api, 'utility', 'batchAll')([store, anchor]);
}

/**
 * Finds the signed envelope for `contentHash` inside the block that anchored it.
 * Walks batch and proxy calls so it works no matter who submitted the extrinsic.
 */
export async function findEnvelope(
  api: ApiPromise,
  blockNumber: number,
  contentHash: Hex,
): Promise<{ signed: SignedCapture; blockHash: Hex; extrinsicIndex: number } | null> {
  const blockHash = await blockHashAt(api, blockNumber);
  if (!blockHash) return null;
  const block = await api.rpc.chain.getBlock(blockHash);
  const target = contentHash.toLowerCase();
  const extrinsics = block.block.extrinsics;
  for (let index = 0; index < extrinsics.length; index++) {
    const extrinsic = extrinsics[index];
    if (!extrinsic) continue;
    for (const data of storedPayloads(extrinsic.method)) {
      try {
        const signed = decodeEnvelope(data);
        if (signed && signed.manifest.content.sha256 === target) {
          return { signed, blockHash, extrinsicIndex: index };
        }
      } catch {
        // Not a valid envelope; keep looking.
      }
    }
  }
  return null;
}

/** Looks up an extrinsic constructor, failing clearly if the runtime does not expose it. */
export function txOf(
  api: ApiPromise,
  section: string,
  method: string,
): SubmittableExtrinsicFunction<'promise'> {
  const fn = api.tx[section]?.[method];
  if (!fn) throw new Error(`This runtime does not expose ${section}.${method}`);
  return fn;
}

/** The parts of a decoded call that envelope discovery needs. */
interface DecodedCall {
  readonly section: string;
  readonly method: string;
  readonly args: readonly unknown[];
}

function* storedPayloads(call: DecodedCall): Generator<Uint8Array> {
  const { section, method } = call;
  if (section === 'transactionStorage' && method === 'store') {
    yield (call.args[0] as unknown as { toU8a(bare: boolean): Uint8Array }).toU8a(true);
    return;
  }
  if (section === 'utility' && ['batch', 'batchAll', 'forceBatch'].includes(method)) {
    for (const inner of call.args[0] as unknown as DecodedCall[]) yield* storedPayloads(inner);
    return;
  }
  if (section === 'proxy' && method === 'proxy') {
    yield* storedPayloads(call.args[2] as unknown as DecodedCall);
  }
}

/** The display name an account set with the Identity pallet, if any. */
export async function identityDisplay(api: ApiPromise, address: string): Promise<string | null> {
  const identityOf = api.query['identity']?.['identityOf'];
  if (!identityOf) return null;
  const result = await identityOf(address);
  const json = result.toJSON() as unknown;
  const registration = Array.isArray(json) ? json[0] : json;
  const display = (registration as { info?: { display?: { raw?: string } } } | null)?.info?.display
    ?.raw;
  if (!display) return null;
  try {
    return display.startsWith('0x') ? new TextDecoder().decode(fromHex(display)) : display;
  } catch {
    return null;
  }
}
