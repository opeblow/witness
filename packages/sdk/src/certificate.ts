import {
  type Anchor,
  type Hex,
  type SignedCapture,
  canonicalize,
  parseSignedCapture,
} from '@witness/core';

export const CERTIFICATE_FORMAT = 'witness.certificate';

/**
 * A portable proof the capturer keeps. It contains the signed envelope and where it was
 * anchored, so a capture stays verifiable even after the chain's storage retention period.
 */
export interface Certificate {
  readonly format: typeof CERTIFICATE_FORMAT;
  readonly version: 1;
  readonly network: string;
  readonly registry: Hex;
  readonly anchor: {
    readonly blockNumber: number;
    readonly blockHash: Hex;
    readonly extrinsicIndex?: number;
  };
  readonly capture: SignedCapture;
}

export function encodeCertificate(certificate: Certificate): string {
  return `${JSON.stringify(JSON.parse(canonicalize(certificate)), null, 2)}\n`;
}

export function parseCertificate(text: string): Certificate {
  const value = JSON.parse(text) as Record<string, unknown>;
  if (value['format'] !== CERTIFICATE_FORMAT || value['version'] !== 1) {
    throw new Error('Not a Witness certificate');
  }
  const anchor = value['anchor'] as Certificate['anchor'] | undefined;
  if (!anchor || typeof anchor.blockNumber !== 'number' || typeof anchor.blockHash !== 'string') {
    throw new Error('Certificate is missing its anchor');
  }
  return {
    format: CERTIFICATE_FORMAT,
    version: 1,
    network: String(value['network']),
    registry: String(value['registry']) as Hex,
    anchor,
    capture: parseSignedCapture(value['capture']),
  };
}

/** Certificates assert where a capture was anchored; the registry has the final word. */
export function certificateMatchesAnchor(certificate: Certificate, anchor: Anchor): boolean {
  return (
    certificate.capture.manifest.content.sha256 === anchor.contentHash &&
    certificate.anchor.blockNumber === anchor.blockNumber
  );
}
