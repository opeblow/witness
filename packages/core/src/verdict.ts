import type { Hex } from './bytes.js';
import { type Comparison, compareFingerprints } from './compare.js';
import { type Fingerprint, decodeGrid } from './fingerprint.js';
import { type SignedCapture, manifestDigest } from './manifest.js';
import { verifyCaptureSignature } from './signing.js';

/** Longest accepted gap between the block a device saw and the block that anchored it. */
export const MAX_CAPTURE_WINDOW_BLOCKS = 50;

/** What the on-chain registry says about a content hash. */
export interface Anchor {
  readonly contentHash: Hex;
  readonly blockNumber: number;
  readonly submitter: Hex;
  readonly dhash: string;
  /** From the Anchored event. Absent when only contract storage was read. */
  readonly manifestDigest?: Hex;
  readonly signer?: Hex;
  readonly transactionHash?: Hex;
}

/** An anchor together with the signed envelope it points to, if that could be retrieved. */
export interface Evidence {
  readonly anchor: Anchor;
  readonly signed: SignedCapture;
  /** Where the envelope came from: the chain itself, or a certificate file supplied by the user. */
  readonly source: 'chain' | 'certificate';
}

export interface IntegrityChecks {
  readonly signatureValid: boolean;
  readonly contentHashMatchesAnchor: boolean;
  readonly digestMatchesAnchor: boolean | null;
  readonly signerMatchesAnchor: boolean | null;
  /** Blocks between the referenced block and the anchoring block. */
  readonly captureWindowBlocks: number;
  readonly captureWindowValid: boolean;
}

export type Verdict =
  | {
      readonly status: 'authentic';
      readonly match: 'exact' | 'visual';
      readonly evidence: Evidence;
      readonly checks: IntegrityChecks;
      readonly comparison: Comparison | null;
    }
  | {
      readonly status: 'altered' | 'reframed';
      readonly evidence: Evidence;
      readonly checks: IntegrityChecks;
      readonly comparison: Comparison;
    }
  | {
      readonly status: 'invalid';
      readonly evidence: Evidence;
      readonly checks: IntegrityChecks;
      readonly problems: readonly string[];
    }
  | { readonly status: 'unverified' };

export function checkIntegrity(evidence: Evidence): IntegrityChecks {
  const { anchor, signed } = evidence;
  const window = anchor.blockNumber - signed.manifest.capture.block.number;
  return {
    signatureValid: verifyCaptureSignature(signed),
    contentHashMatchesAnchor: signed.manifest.content.sha256 === anchor.contentHash.toLowerCase(),
    digestMatchesAnchor:
      anchor.manifestDigest === undefined
        ? null
        : manifestDigest(signed.manifest) === anchor.manifestDigest.toLowerCase(),
    signerMatchesAnchor:
      anchor.signer === undefined
        ? null
        : signed.manifest.signer.key === anchor.signer.toLowerCase(),
    captureWindowBlocks: window,
    captureWindowValid: window >= 0 && window <= MAX_CAPTURE_WINDOW_BLOCKS,
  };
}

export function integrityProblems(checks: IntegrityChecks): string[] {
  const problems: string[] = [];
  if (!checks.signatureValid) problems.push('The signature does not match the signed manifest.');
  if (!checks.contentHashMatchesAnchor)
    problems.push('The manifest describes a different file than the anchor.');
  if (checks.digestMatchesAnchor === false)
    problems.push('The manifest differs from the one anchored on chain.');
  if (checks.signerMatchesAnchor === false)
    problems.push('The signer differs from the one anchored on chain.');
  if (!checks.captureWindowValid) {
    problems.push(
      `The capture referenced a block ${checks.captureWindowBlocks} blocks before anchoring.`,
    );
  }
  return problems;
}

export interface Suspect {
  readonly sha256: Hex;
  readonly fingerprint: Fingerprint;
}

/**
 * Decides what a suspect image is, given the captures that might be its original.
 *
 * Order of precedence:
 * 1. An intact capture with the same SHA-256 is an exact, bit-for-bit match.
 * 2. Otherwise the visually closest intact capture decides between authentic
 *    (no visible change), altered, and reframed.
 * 3. A capture that matches but fails integrity checks is reported as invalid,
 *    never as authentic.
 */
export function evaluate(suspect: Suspect, candidates: readonly Evidence[]): Verdict {
  const assessed = candidates.map((evidence) => {
    const checks = checkIntegrity(evidence);
    return { evidence, checks, problems: integrityProblems(checks) };
  });

  const exact = assessed.find(
    (c) => c.evidence.signed.manifest.content.sha256 === suspect.sha256.toLowerCase(),
  );
  if (exact) {
    return exact.problems.length > 0
      ? {
          status: 'invalid',
          evidence: exact.evidence,
          checks: exact.checks,
          problems: exact.problems,
        }
      : {
          status: 'authentic',
          match: 'exact',
          evidence: exact.evidence,
          checks: exact.checks,
          comparison: null,
        };
  }

  const ranked = assessed
    .map((c) => ({
      ...c,
      comparison: compareFingerprints(toFingerprint(c.evidence.signed), suspect.fingerprint),
    }))
    .filter((c) => c.comparison.classification !== 'unrelated')
    .sort((a, b) => rank(a.comparison) - rank(b.comparison));

  const best = ranked[0];
  if (!best) return { status: 'unverified' };
  if (best.problems.length > 0) {
    return {
      status: 'invalid',
      evidence: best.evidence,
      checks: best.checks,
      problems: best.problems,
    };
  }
  const { comparison } = best;
  if (comparison.classification === 'consistent') {
    return {
      status: 'authentic',
      match: 'visual',
      evidence: best.evidence,
      checks: best.checks,
      comparison,
    };
  }
  return {
    status: comparison.classification === 'reframed' ? 'reframed' : 'altered',
    evidence: best.evidence,
    checks: best.checks,
    comparison,
  };
}

function rank(c: Comparison): number {
  return c.dhashDistance + c.changedRatio * 64 + (c.classification === 'reframed' ? 32 : 0);
}

export function toFingerprint(signed: SignedCapture): Fingerprint {
  const { fingerprint, content } = signed.manifest;
  return {
    dhash: fingerprint.dhash,
    grid: decodeGrid(fingerprint.grid),
    width: content.width,
    height: content.height,
  };
}
