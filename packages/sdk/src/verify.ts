import type { ApiPromise } from '@polkadot/api';
import {
  type Anchor,
  type Evidence,
  type Hex,
  type Raster,
  type Suspect,
  type Verdict,
  evaluate,
  fingerprint,
  hammingDistance,
  sha256Hex,
} from '@witness/core';
import { type Certificate, certificateMatchesAnchor } from './certificate.js';
import type { RegistryClient } from './registry.js';
import { findEnvelope } from './substrate.js';

export type VerifyStep = 'fingerprint' | 'lookup' | 'similar' | 'retrieve' | 'decide';

export interface VerifyProgress {
  readonly step: VerifyStep;
  readonly status: 'running' | 'done' | 'skipped';
  readonly detail?: string;
}

export interface VerifyDependencies {
  readonly registry: RegistryClient;
  readonly api: () => Promise<ApiPromise>;
  /** A certificate the user supplied; used when the chain no longer serves the envelope. */
  readonly certificate?: Certificate | null;
  readonly onProgress?: (progress: VerifyProgress) => void;
  /** dHash distance within which a recent capture is considered a candidate original. */
  readonly similarDistance?: number;
  readonly maxCandidates?: number;
}

export interface VerifyResult {
  readonly verdict: Verdict;
  readonly suspect: Suspect;
  readonly candidates: readonly Evidence[];
  /** Anchors found whose envelope could not be retrieved. */
  readonly unresolved: readonly Anchor[];
}

/**
 * Verifies an image end to end:
 * fingerprint it, look up its exact hash, fall back to visually similar captures,
 * retrieve each candidate's signed envelope from the chain, then decide.
 */
export async function verifyImage(
  input: { file: Uint8Array; raster: Raster },
  deps: VerifyDependencies,
): Promise<VerifyResult> {
  const report = deps.onProgress ?? (() => undefined);

  report({ step: 'fingerprint', status: 'running' });
  const suspect: Suspect = {
    sha256: sha256Hex(input.file),
    fingerprint: fingerprint(input.raster),
  };
  report({ step: 'fingerprint', status: 'done', detail: suspect.sha256 });

  report({ step: 'lookup', status: 'running' });
  const exact = await deps.registry.anchorWithEvent(suspect.sha256);
  report({
    step: 'lookup',
    status: 'done',
    detail: exact ? `Anchored in block ${exact.blockNumber}` : 'No exact match',
  });

  let anchors: Anchor[];
  if (exact) {
    anchors = [exact];
    report({ step: 'similar', status: 'skipped' });
  } else {
    report({ step: 'similar', status: 'running' });
    anchors = await similarAnchors(deps, suspect.fingerprint.dhash);
    report({
      step: 'similar',
      status: 'done',
      detail: `${anchors.length} candidate${anchors.length === 1 ? '' : 's'}`,
    });
  }

  const certificate = deps.certificate ?? null;
  if (
    certificate &&
    !anchors.some((a) => a.contentHash === certificate.capture.manifest.content.sha256)
  ) {
    const certified = await deps.registry.anchorWithEvent(
      certificate.capture.manifest.content.sha256,
    );
    if (certified) anchors.push(certified);
  }

  report({ step: 'retrieve', status: 'running' });
  const candidates: Evidence[] = [];
  const unresolved: Anchor[] = [];
  for (const anchor of anchors) {
    const evidence = await resolveEvidence(anchor, deps.api, certificate);
    if (evidence) candidates.push(evidence);
    else unresolved.push(anchor);
  }
  report({
    step: 'retrieve',
    status: 'done',
    detail: `${candidates.length} envelope${candidates.length === 1 ? '' : 's'}`,
  });

  report({ step: 'decide', status: 'running' });
  const verdict = evaluate(suspect, candidates);
  report({ step: 'decide', status: 'done', detail: verdict.status });
  return { verdict, suspect, candidates, unresolved };
}

/** Retrieves the envelope for an anchor, preferring the chain and falling back to a certificate. */
export async function resolveEvidence(
  anchor: Anchor,
  api: () => Promise<ApiPromise>,
  certificate: Certificate | null = null,
): Promise<Evidence | null> {
  const found = await findEnvelope(await api(), anchor.blockNumber, anchor.contentHash).catch(
    () => null,
  );
  if (found) return { anchor, signed: found.signed, source: 'chain' };
  if (certificate && certificateMatchesAnchor(certificate, anchor)) {
    return { anchor, signed: certificate.capture, source: 'certificate' };
  }
  return null;
}

/** Looks up a capture by its id (the content hash) for display. */
export async function lookupCapture(
  contentHash: Hex,
  deps: { registry: RegistryClient; api: () => Promise<ApiPromise> },
): Promise<{ anchor: Anchor; evidence: Evidence | null } | null> {
  const anchor = await deps.registry.anchorWithEvent(contentHash);
  if (!anchor) return null;
  return { anchor, evidence: await resolveEvidence(anchor, deps.api) };
}

async function similarAnchors(deps: VerifyDependencies, dhash: string): Promise<Anchor[]> {
  const limit = deps.similarDistance ?? 20;
  const recent = await deps.registry.recent({ limit: 500 });
  return recent
    .map((anchor) => ({ anchor, distance: hammingDistance(anchor.dhash, dhash) }))
    .filter((c) => c.distance <= limit)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, deps.maxCandidates ?? 3)
    .map((c) => c.anchor);
}
