import { sha256 } from '@noble/hashes/sha2.js';
import { type Hex, concatBytes, fromBase64, fromUtf8, isHex, toHex, utf8 } from './bytes.js';
import { canonicalize } from './canonical.js';
import { FINGERPRINT_ALG, GRID_BYTES } from './fingerprint.js';

export const MANIFEST_VERSION = 1;
export const MANIFEST_TYPE = 'witness.capture';

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];

/** Upper bounds that keep an envelope small enough to store cheaply on chain. */
export const LIMITS = {
  maxPreviewBytes: 48 * 1024,
  maxNoteLength: 280,
  maxEnvelopeBytes: 96 * 1024,
  maxImageBytes: 25 * 1024 * 1024,
  maxDimension: 16_384,
} as const;

/** How the pixels entered Witness. Imports are weaker evidence and are labelled as such. */
export type CaptureSource = 'camera' | 'import';

/**
 * The statement a capturer signs. Every field is covered by the signature.
 * See docs/manifest-spec.md for the normative description.
 */
export interface CaptureManifest {
  readonly v: 1;
  readonly type: typeof MANIFEST_TYPE;
  readonly network: { readonly name: string; readonly genesis: Hex };
  readonly content: {
    readonly sha256: Hex;
    readonly mime: ImageMime;
    readonly bytes: number;
    readonly width: number;
    readonly height: number;
  };
  readonly fingerprint: {
    readonly alg: typeof FINGERPRINT_ALG;
    readonly dhash: string;
    readonly grid: string;
  };
  readonly capture: {
    readonly source: CaptureSource;
    /** Device clock, Unix milliseconds. Informational; the block reference is what counts. */
    readonly at: number;
    /** The most recent finalized block the device saw before signing: proof the signature is not older. */
    readonly block: { readonly number: number; readonly hash: Hex };
  };
  readonly signer: { readonly alg: 'ed25519'; readonly key: Hex };
  /** Optional low-resolution JPEG so verifiers can see the original. Omitted by default for privacy. */
  readonly preview?: { readonly mime: 'image/jpeg'; readonly data: string };
  /** Optional free-text reference, such as an order or claim number. */
  readonly note?: string;
}

export interface SignedCapture {
  readonly manifest: CaptureManifest;
  /** Ed25519 signature over `signingPayload(manifest)`. */
  readonly signature: Hex;
}

/** Envelopes stored on chain start with this marker so they can be recognised cheaply. */
export const ENVELOPE_MAGIC = 'witness:v1\n';
const SIGNING_DOMAIN = utf8('witness/capture/v1\n');

export function encodeManifest(manifest: CaptureManifest): Uint8Array {
  return utf8(canonicalize(manifest));
}

/** SHA-256 of the canonical manifest bytes. Anchored on chain next to the content hash. */
export function manifestDigest(manifest: CaptureManifest): Hex {
  return toHex(sha256(encodeManifest(manifest)));
}

/** The exact bytes a capturer signs: a domain tag followed by the manifest digest. */
export function signingPayload(manifest: CaptureManifest): Uint8Array {
  return concatBytes(SIGNING_DOMAIN, sha256(encodeManifest(manifest)));
}

export function sha256Hex(bytes: Uint8Array): Hex {
  return toHex(sha256(bytes));
}

export function encodeEnvelope(signed: SignedCapture): Uint8Array {
  const bytes = utf8(ENVELOPE_MAGIC + canonicalize(signed));
  if (bytes.length > LIMITS.maxEnvelopeBytes) {
    throw new RangeError(
      `Envelope is ${bytes.length} bytes; the limit is ${LIMITS.maxEnvelopeBytes}`,
    );
  }
  return bytes;
}

/** Parses envelope bytes. Returns null for data that is not a Witness envelope at all. */
export function decodeEnvelope(bytes: Uint8Array): SignedCapture | null {
  let text: string;
  try {
    text = fromUtf8(bytes);
  } catch {
    return null;
  }
  if (!text.startsWith(ENVELOPE_MAGIC)) return null;
  const parsed: unknown = JSON.parse(text.slice(ENVELOPE_MAGIC.length));
  return parseSignedCapture(parsed);
}

export class ManifestError extends Error {
  override readonly name = 'ManifestError';
}

/** Validates untrusted input into a SignedCapture, or throws ManifestError. */
export function parseSignedCapture(input: unknown): SignedCapture {
  const obj = record(input, 'capture');
  const signature = obj['signature'];
  if (!isHex(signature, 64)) throw new ManifestError('signature must be 64 bytes of hex');
  const manifest = parseManifest(obj['manifest']);
  return { manifest, signature };
}

export function parseManifest(input: unknown): CaptureManifest {
  const m = record(input, 'manifest');
  if (m['v'] !== MANIFEST_VERSION)
    throw new ManifestError(`unsupported manifest version ${String(m['v'])}`);
  if (m['type'] !== MANIFEST_TYPE) throw new ManifestError('type must be witness.capture');

  const network = record(m['network'], 'network');
  const content = record(m['content'], 'content');
  const fp = record(m['fingerprint'], 'fingerprint');
  const capture = record(m['capture'], 'capture');
  const block = record(capture['block'], 'capture.block');
  const signer = record(m['signer'], 'signer');

  const name = network['name'];
  if (typeof name !== 'string' || name.length === 0 || name.length > 64) {
    throw new ManifestError('network.name must be a short string');
  }
  hex(network['genesis'], 32, 'network.genesis');
  hex(content['sha256'], 32, 'content.sha256');
  if (!IMAGE_MIME_TYPES.includes(content['mime'] as ImageMime)) {
    throw new ManifestError('content.mime must be image/jpeg, image/png or image/webp');
  }
  int(content['bytes'], 1, LIMITS.maxImageBytes, 'content.bytes');
  int(content['width'], 1, LIMITS.maxDimension, 'content.width');
  int(content['height'], 1, LIMITS.maxDimension, 'content.height');

  if (fp['alg'] !== FINGERPRINT_ALG)
    throw new ManifestError(`fingerprint.alg must be ${FINGERPRINT_ALG}`);
  if (typeof fp['dhash'] !== 'string' || !/^[0-9a-f]{16}$/.test(fp['dhash'])) {
    throw new ManifestError('fingerprint.dhash must be 16 lowercase hex characters');
  }
  if (typeof fp['grid'] !== 'string' || safeBase64Length(fp['grid']) !== GRID_BYTES) {
    throw new ManifestError(`fingerprint.grid must be ${GRID_BYTES} bytes of base64`);
  }

  if (capture['source'] !== 'camera' && capture['source'] !== 'import') {
    throw new ManifestError('capture.source must be camera or import');
  }
  int(capture['at'], 0, Number.MAX_SAFE_INTEGER, 'capture.at');
  int(block['number'], 0, 2 ** 32 - 1, 'capture.block.number');
  hex(block['hash'], 32, 'capture.block.hash');

  if (signer['alg'] !== 'ed25519') throw new ManifestError('signer.alg must be ed25519');
  hex(signer['key'], 32, 'signer.key');

  if (m['preview'] !== undefined) {
    const preview = record(m['preview'], 'preview');
    if (preview['mime'] !== 'image/jpeg')
      throw new ManifestError('preview.mime must be image/jpeg');
    const size = typeof preview['data'] === 'string' ? safeBase64Length(preview['data']) : -1;
    if (size < 1 || size > LIMITS.maxPreviewBytes) {
      throw new ManifestError(
        `preview.data must be 1 to ${LIMITS.maxPreviewBytes} bytes of base64`,
      );
    }
  }
  if (m['note'] !== undefined) {
    if (typeof m['note'] !== 'string' || m['note'].length > LIMITS.maxNoteLength) {
      throw new ManifestError(`note must be at most ${LIMITS.maxNoteLength} characters`);
    }
  }

  const allowed = new Set([
    'v',
    'type',
    'network',
    'content',
    'fingerprint',
    'capture',
    'signer',
    'preview',
    'note',
  ]);
  for (const key of Object.keys(m)) {
    if (!allowed.has(key)) throw new ManifestError(`unknown manifest field ${key}`);
  }
  return m as unknown as CaptureManifest;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ManifestError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function hex(value: unknown, bytes: number, path: string): void {
  if (!isHex(value, bytes) || value !== value.toLowerCase()) {
    throw new ManifestError(`${path} must be ${bytes} bytes of lowercase 0x hex`);
  }
}

function int(value: unknown, min: number, max: number, path: string): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new ManifestError(`${path} must be an integer between ${min} and ${max}`);
  }
}

function safeBase64Length(text: string): number {
  try {
    return fromBase64(text).length;
  } catch {
    return -1;
  }
}
