import { type Hex, type SignedCapture, encodeEnvelope, toBase64 } from '@witness/core';

export interface NotaryReceipt {
  readonly contentHash: Hex;
  readonly blockNumber: number;
  readonly blockHash: Hex;
  readonly extrinsicHash: Hex;
  readonly extrinsicIndex: number;
  readonly submitter: string;
}

export interface NotaryInfo {
  readonly network: string;
  readonly registry: Hex | null;
  readonly sponsor: string;
  readonly sponsorEvm: Hex | null;
  readonly maxCaptureWindowBlocks: number;
  readonly version: string;
}

export class NotaryError extends Error {
  override readonly name = 'NotaryError';
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

/** Client for the Witness notary HTTP API (see docs/api.md). */
export class NotaryClient {
  constructor(private readonly baseUrl: string) {}

  async info(signal?: AbortSignal): Promise<NotaryInfo> {
    return this.request<NotaryInfo>('/v1/info', { method: 'GET', ...(signal ? { signal } : {}) });
  }

  async submit(signed: SignedCapture, signal?: AbortSignal): Promise<NotaryReceipt> {
    return this.request<NotaryReceipt>('/v1/captures', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ envelope: toBase64(encodeEnvelope(signed)) }),
      ...(signal ? { signal } : {}),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), init);
    const body = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    if (!response.ok) {
      throw new NotaryError(
        body.error?.message ?? `Notary returned HTTP ${response.status}`,
        response.status,
        body.error?.code ?? 'unknown',
      );
    }
    return body as T;
  }
}
