import { type Hex, toBase64, toHex } from './bytes.js';
import { FINGERPRINT_ALG, encodeGrid, fingerprint } from './fingerprint.js';
import {
  type CaptureManifest,
  type CaptureSource,
  type ImageMime,
  MANIFEST_TYPE,
  type SignedCapture,
  sha256Hex,
} from './manifest.js';
import type { Raster } from './raster.js';
import { type KeyPair, signCapture } from './signing.js';

export interface CaptureInput {
  /** The exact encoded file the capturer will keep and share. Its SHA-256 is the capture id. */
  readonly file: Uint8Array;
  readonly mime: ImageMime;
  /** The decoded pixels of `file`. */
  readonly raster: Raster;
  readonly keys: KeyPair;
  readonly source: CaptureSource;
  readonly block: { readonly number: number; readonly hash: Hex };
  readonly network: { readonly name: string; readonly genesis: Hex };
  readonly capturedAt?: number;
  /** A small JPEG to publish with the evidence. Leave out to keep the picture private. */
  readonly preview?: Uint8Array;
  readonly note?: string;
}

/** Builds and signs the manifest for a capture. Pure apart from reading the clock. */
export function createCapture(input: CaptureInput): SignedCapture {
  const fp = fingerprint(input.raster);
  const note = input.note?.trim();
  const manifest: CaptureManifest = {
    v: 1,
    type: MANIFEST_TYPE,
    network: { name: input.network.name, genesis: lower(input.network.genesis) },
    content: {
      sha256: sha256Hex(input.file),
      mime: input.mime,
      bytes: input.file.length,
      width: input.raster.width,
      height: input.raster.height,
    },
    fingerprint: { alg: FINGERPRINT_ALG, dhash: fp.dhash, grid: encodeGrid(fp.grid) },
    capture: {
      source: input.source,
      at: input.capturedAt ?? Date.now(),
      block: { number: input.block.number, hash: lower(input.block.hash) },
    },
    signer: { alg: 'ed25519', key: toHex(input.keys.publicKey) },
    ...(input.preview
      ? { preview: { mime: 'image/jpeg' as const, data: toBase64(input.preview) } }
      : {}),
    ...(note ? { note } : {}),
  };
  return signCapture(manifest, input.keys);
}

function lower(hex: Hex): Hex {
  return hex.toLowerCase() as Hex;
}
