import type { ApiPromise } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import type { KeyringPair } from '@polkadot/keyring/types';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { type Hex, type SignedCapture, manifestDigest } from '@witness/core';
import {
  type NetworkConfig,
  type NotaryReceipt,
  RegistryClient,
  blockHashAt,
  buildCaptureExtrinsic,
  connectPortaldot,
  encodeAnchorCall,
  reviveAddressOf,
  submitAndWatch,
} from '@witness/sdk';
import type { ChainPort } from './service.js';

/** Portaldot implementation of the notary's chain port. */
export class PortaldotChain implements ChainPort {
  readonly networkName: string;
  readonly registry: Hex | null;
  readonly sponsorAddress: string;
  readonly sponsorEvmAddress: Hex;
  private queue: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly api: ApiPromise,
    private readonly sponsor: KeyringPair,
    private readonly registryClient: RegistryClient | null,
    network: NetworkConfig,
  ) {
    this.networkName = network.name;
    this.registry = network.registry;
    this.sponsorAddress = sponsor.address;
    this.sponsorEvmAddress = reviveAddressOf(sponsor.publicKey);
  }

  static async connect(network: NetworkConfig, seed: string): Promise<PortaldotChain> {
    await cryptoWaitReady();
    const api = await connectPortaldot(network.substrateRpc);
    const sponsor = new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri(seed);
    const registry = network.registry
      ? new RegistryClient(network, undefined, async () => api)
      : null;
    return new PortaldotChain(api, sponsor, registry, network);
  }

  genesisHash(): Hex {
    return this.api.genesisHash.toHex() as Hex;
  }

  async bestBlockNumber(): Promise<number> {
    const header = await this.api.rpc.chain.getHeader();
    return header.number.toNumber();
  }

  blockHashAt(blockNumber: number): Promise<Hex | null> {
    return blockHashAt(this.api, blockNumber);
  }

  async isAnchored(contentHash: Hex): Promise<boolean> {
    if (!this.registryClient) return false;
    return (await this.registryClient.anchorOf(contentHash)) !== null;
  }

  async sponsorBalance(): Promise<bigint> {
    const account = (await this.api.query['system']?.['account']?.(this.sponsor.address)) as
      { data: { free: { toBigInt(): bigint } } } | undefined;
    return account?.data.free.toBigInt() ?? 0n;
  }

  /** Submissions are serialised so concurrent requests never race on the sponsor's nonce. */
  submit(envelope: Uint8Array, signed: SignedCapture): Promise<NotaryReceipt> {
    const run = this.queue.then(() => this.submitNow(envelope, signed));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async submitNow(envelope: Uint8Array, signed: SignedCapture): Promise<NotaryReceipt> {
    if (!this.registry) throw new Error('registry is not deployed');
    const { manifest } = signed;
    const extrinsic = buildCaptureExtrinsic(this.api, {
      envelope,
      registry: this.registry,
      anchorCalldata: encodeAnchorCall({
        contentHash: manifest.content.sha256,
        manifestDigest: manifestDigest(manifest),
        signer: manifest.signer.key,
        dhash: manifest.fingerprint.dhash,
      }),
    });
    const receipt = await submitAndWatch(this.api, extrinsic, this.sponsor);
    return {
      contentHash: manifest.content.sha256,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      extrinsicHash: receipt.extrinsicHash,
      extrinsicIndex: receipt.extrinsicIndex,
      submitter: this.sponsor.address,
    };
  }

  async disconnect(): Promise<void> {
    await this.api.disconnect();
  }
}
