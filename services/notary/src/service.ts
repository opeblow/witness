import {
  type Hex,
  LIMITS,
  type SignedCapture,
  decodeEnvelope,
  fromBase64,
  verifyCaptureSignature,
} from '@witness/core';
import type { NotaryInfo, NotaryReceipt } from '@witness/sdk';
import { ApiError } from './errors.js';

/** What the service needs from the chain. Implemented by `PortaldotChain`, faked in tests. */
export interface ChainPort {
  readonly networkName: string;
  readonly registry: Hex | null;
  readonly sponsorAddress: string;
  readonly sponsorEvmAddress: Hex | null;
  genesisHash(): Hex;
  bestBlockNumber(): Promise<number>;
  blockHashAt(blockNumber: number): Promise<Hex | null>;
  isAnchored(contentHash: Hex): Promise<boolean>;
  submit(envelope: Uint8Array, signed: SignedCapture): Promise<NotaryReceipt>;
}

export interface ServiceOptions {
  readonly maxCaptureWindowBlocks: number;
  readonly version: string;
}

/** Validates captures and anchors the valid ones. Has no HTTP knowledge. */
export class NotaryService {
  constructor(
    private readonly chain: ChainPort,
    private readonly options: ServiceOptions,
  ) {}

  info(): NotaryInfo {
    return {
      network: this.chain.networkName,
      registry: this.chain.registry,
      sponsor: this.chain.sponsorAddress,
      sponsorEvm: this.chain.sponsorEvmAddress,
      maxCaptureWindowBlocks: this.options.maxCaptureWindowBlocks,
      version: this.options.version,
    };
  }

  /** Parses and checks an envelope without touching chain state. */
  parse(envelopeBase64: string): { envelope: Uint8Array; signed: SignedCapture } {
    let envelope: Uint8Array;
    try {
      envelope = fromBase64(envelopeBase64);
    } catch {
      throw new ApiError('invalid_request', 'envelope must be base64');
    }
    if (envelope.length > LIMITS.maxEnvelopeBytes) {
      throw new ApiError('invalid_envelope', `envelope exceeds ${LIMITS.maxEnvelopeBytes} bytes`);
    }
    let signed: SignedCapture | null;
    try {
      signed = decodeEnvelope(envelope);
    } catch (error) {
      throw new ApiError(
        'invalid_envelope',
        error instanceof Error ? error.message : 'invalid envelope',
      );
    }
    if (!signed) throw new ApiError('invalid_envelope', 'not a Witness envelope');
    if (!verifyCaptureSignature(signed))
      throw new ApiError('bad_signature', 'signature does not verify');
    return { envelope, signed };
  }

  async anchor(envelopeBase64: string): Promise<NotaryReceipt> {
    if (!this.chain.registry) throw new ApiError('not_configured', 'registry is not deployed');
    const { envelope, signed } = this.parse(envelopeBase64);
    const { manifest } = signed;

    if (
      manifest.network.name !== this.chain.networkName ||
      manifest.network.genesis !== this.chain.genesisHash()
    ) {
      throw new ApiError('wrong_network', `capture was made for ${manifest.network.name}`);
    }

    const referenced = manifest.capture.block;
    const [head, actualHash] = await Promise.all([
      this.chain.bestBlockNumber(),
      this.chain.blockHashAt(referenced.number),
    ]);
    if (!actualHash || actualHash.toLowerCase() !== referenced.hash) {
      throw new ApiError(
        'unknown_block',
        `block ${referenced.number} does not have hash ${referenced.hash}`,
      );
    }
    const age = head - referenced.number;
    if (age > this.options.maxCaptureWindowBlocks) {
      throw new ApiError(
        'stale_block',
        `capture references a block ${age} blocks old; the limit is ${this.options.maxCaptureWindowBlocks}`,
      );
    }

    if (await this.chain.isAnchored(manifest.content.sha256)) {
      throw new ApiError('already_anchored', 'this file has already been anchored');
    }

    try {
      return await this.chain.submit(envelope, signed);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'submission_failed',
        error instanceof Error ? error.message : 'submission failed',
      );
    }
  }
}
