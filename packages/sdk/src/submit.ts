import type { ApiPromise } from '@polkadot/api';
import type { AddressOrPair, SignerOptions, SubmittableExtrinsic } from '@polkadot/api/types';
import type { DispatchError, EventRecord } from '@polkadot/types/interfaces';
import type { Hex } from '@witness/core';
import { keccak256 } from 'viem';

export interface InclusionReceipt {
  readonly blockHash: Hex;
  readonly blockNumber: number;
  readonly extrinsicHash: Hex;
  readonly extrinsicIndex: number;
  readonly events: readonly EventRecord[];
}

export class ExtrinsicFailedError extends Error {
  override readonly name = 'ExtrinsicFailedError';
}

/**
 * Signs, submits and waits for inclusion in a block.
 * Rejects with a decoded module error (for example `revive.ContractReverted`)
 * if the extrinsic is included but fails, or if the pool drops it.
 */
export function submitAndWatch(
  api: ApiPromise,
  extrinsic: SubmittableExtrinsic<'promise'>,
  account: AddressOrPair,
  options: Partial<SignerOptions> = {},
): Promise<InclusionReceipt> {
  return new Promise<InclusionReceipt>((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      unsubscribe?.();
      fn();
    };

    extrinsic
      .signAndSend(account, { nonce: -1, ...options }, (result) => {
        if (result.dispatchError) {
          const message = describeDispatchError(api, result.dispatchError as DispatchError);
          finish(() => reject(new ExtrinsicFailedError(message)));
          return;
        }
        const status = result.status;
        if (status.isDropped || status.isInvalid || status.isUsurped) {
          finish(() =>
            reject(new ExtrinsicFailedError(`Transaction ${status.type.toLowerCase()}`)),
          );
          return;
        }
        if (status.isInBlock) {
          const blockHash = status.asInBlock.toHex() as Hex;
          const phase = result.events.find((e) => e.phase.isApplyExtrinsic)?.phase;
          api.rpc.chain
            .getHeader(blockHash)
            .then((header) =>
              finish(() =>
                resolve({
                  blockHash,
                  blockNumber: header.number.toNumber(),
                  extrinsicHash: extrinsic.hash.toHex() as Hex,
                  extrinsicIndex: phase ? phase.asApplyExtrinsic.toNumber() : -1,
                  events: result.events,
                }),
              ),
            )
            .catch((error: unknown) => finish(() => reject(error)));
        }
      })
      .then((unsub) => {
        unsubscribe = unsub;
        if (settled) unsub();
      })
      .catch((error: unknown) =>
        finish(() => reject(error instanceof Error ? error : new Error(String(error)))),
      );
  });
}

export function describeDispatchError(api: ApiPromise, error: DispatchError): string {
  if (error.isModule) {
    try {
      const meta = api.registry.findMetaError(error.asModule);
      return `${meta.section}.${meta.name}${meta.docs.length ? `: ${meta.docs.join(' ')}` : ''}`;
    } catch {
      return error.toString();
    }
  }
  return error.toString();
}

/**
 * The H160 pallet-revive assigns to a native (non-Ethereum) account: the last
 * 20 bytes of keccak256(AccountId32). This is `msg.sender` inside contracts when
 * a native account calls `revive.call`.
 */
export function reviveAddressOf(accountId: Uint8Array): Hex {
  return `0x${keccak256(accountId).slice(-40)}` as Hex;
}
