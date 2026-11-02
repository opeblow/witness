import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { type Evidence, type IntegrityChecks, type Verdict, signerAddress } from '@witness/core';
import { getApi } from '../lib/chain';
import { blockLink } from '../lib/config';
import { formatDateTime, formatNumber, percent, witnessId } from '../lib/format';
import { base64ToObjectUrl } from '../lib/image';
import { CheckRow, EvidenceImage, Hash } from './evidence';

interface Headline {
  readonly pill: string;
  readonly tone: 'ok' | 'bad' | 'warn' | 'neutral';
  readonly title: string;
  readonly body: string;
}

export function headlineFor(verdict: Verdict): Headline {
  switch (verdict.status) {
    case 'authentic':
      return verdict.match === 'exact'
        ? {
            pill: 'Authentic',
            tone: 'ok',
            title: 'Authentic original.',
            body: `Bit-for-bit identical to the photo sealed in block ${formatNumber(verdict.evidence.anchor.blockNumber)}.`,
          }
        : {
            pill: 'Authentic copy',
            tone: 'ok',
            title: 'Same picture, re-encoded.',
            body: 'The file was compressed or resized since it was sealed, for example by a messaging app. No region of the picture changed.',
          };
    case 'altered': {
      const regions = verdict.comparison.regions.length;
      return {
        pill: 'Altered',
        tone: 'bad',
        title: 'This picture was edited.',
        body: `${regions === 1 ? 'One region differs' : `${regions} regions differ`} from the sealed original, covering ${percent(verdict.comparison.changedRatio)} of the frame.`,
      };
    }
    case 'reframed':
      return {
        pill: 'Cropped',
        tone: 'warn',
        title: 'A cropped copy of a sealed photo.',
        body: 'The content matches part of a sealed original. Anything outside the crop window was removed.',
      };
    case 'invalid':
      return {
        pill: 'Invalid record',
        tone: 'bad',
        title: 'The record does not hold up.',
        body: 'A capture matches this image, but it fails integrity checks, so Witness will not vouch for it.',
      };
    case 'unverified':
      return {
        pill: 'No record',
        tone: 'neutral',
        title: 'Never sealed with Witness.',
        body: 'No capture on Portaldot matches this image. That does not make it fake; it means nobody sealed it.',
      };
  }
}

export function VerdictView({ verdict, imageUrl }: { verdict: Verdict; imageUrl: string }) {
  const head = headlineFor(verdict);
  const evidence = verdict.status === 'unverified' ? null : verdict.evidence;
  const comparison =
    verdict.status === 'altered' || verdict.status === 'reframed' ? verdict.comparison : null;
  const preview = evidence?.signed.manifest.preview;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!preview) return;
    const url = base64ToObjectUrl(preview.data, preview.mime);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  return (
    <section className={`verdict verdict-${head.tone}`} aria-live="polite">
      <header className="verdict-head">
        <span className={`pill pill-${head.tone}`}>{head.pill}</span>
        <h2 className="h1">{head.title}</h2>
        <p className="lede">{head.body}</p>
        {verdict.status === 'invalid' ? (
          <ul className="problems">
            {verdict.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
      </header>

      <div className={`verdict-media${previewUrl ? ' verdict-media-pair' : ''}`}>
        {previewUrl && evidence ? (
          <EvidenceImage
            src={previewUrl}
            alt="Low-resolution preview of the sealed original"
            regions={verdict.status === 'reframed' ? (comparison?.regions ?? []) : []}
            tone="warn"
            caption={`Sealed original, block ${formatNumber(evidence.anchor.blockNumber)}`}
          />
        ) : null}
        <EvidenceImage
          src={imageUrl}
          alt="The image you submitted"
          regions={verdict.status === 'altered' ? verdict.comparison.regions : []}
          heat={verdict.status === 'altered' ? verdict.comparison.heat : undefined}
          showGrid={verdict.status === 'altered'}
          caption="Submitted image"
        />
      </div>

      {evidence ? (
        <RecordDetails
          evidence={evidence}
          checks={verdict.status === 'unverified' ? null : verdict.checks}
        />
      ) : null}
    </section>
  );
}

export function RecordDetails({
  evidence,
  checks,
}: {
  evidence: Evidence;
  checks: IntegrityChecks | null;
}) {
  const { manifest } = evidence.signed;
  const { anchor } = evidence;
  const address = signerAddress(manifest.signer.key);
  const [identity, setIdentity] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([getApi(), import('@witness/sdk')])
      .then(([api, sdk]) => sdk.identityDisplay(api, address))
      .then((name) => {
        if (live) setIdentity(name);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [address]);

  return (
    <div className="record-grid">
      <div>
        <p className="label">Record</p>
        <dl className="facts">
          <dt>Witness id</dt>
          <dd>
            <Link to={`/v/${anchor.contentHash}`} className="mono">
              {witnessId(anchor.contentHash)}
            </Link>
          </dd>
          <dt>Anchored</dt>
          <dd>
            <a
              className="mono"
              href={blockLink(anchor.blockNumber)}
              target="_blank"
              rel="noreferrer"
            >
              Block {formatNumber(anchor.blockNumber)}
            </a>
          </dd>
          <dt>Device clock</dt>
          <dd className="mono">{formatDateTime(manifest.capture.at)}</dd>
          <dt>Source</dt>
          <dd>
            {manifest.capture.source === 'camera' ? 'Camera, captured in Witness' : 'Imported file'}
          </dd>
          <dt>Signed by</dt>
          <dd>
            {identity ? <strong>{identity} </strong> : null}
            <Hash value={address} head={8} tail={6} />
          </dd>
          {manifest.note ? (
            <>
              <dt>Reference</dt>
              <dd>{manifest.note}</dd>
            </>
          ) : null}
          <dt>Content</dt>
          <dd>
            <Hash value={manifest.content.sha256} />
          </dd>
          <dt>Evidence from</dt>
          <dd>
            {evidence.source === 'chain'
              ? 'Portaldot TransactionStorage'
              : 'Certificate file, checked against the chain anchor'}
          </dd>
          {anchor.transactionHash ? (
            <>
              <dt>EVM tx</dt>
              <dd>
                <Hash value={anchor.transactionHash} />
              </dd>
            </>
          ) : null}
        </dl>
      </div>
      {checks ? (
        <div>
          <p className="label">Integrity checks</p>
          <ul className="checks">
            <CheckRow ok={checks.signatureValid} detail="Ed25519 over the canonical manifest">
              Signature is valid
            </CheckRow>
            <CheckRow ok={checks.contentHashMatchesAnchor}>
              Manifest describes the anchored file
            </CheckRow>
            <CheckRow
              ok={checks.digestMatchesAnchor}
              detail="Manifest digest from the Anchored event"
            >
              Manifest is the one anchored on chain
            </CheckRow>
            <CheckRow ok={checks.signerMatchesAnchor}>Signer matches the anchor</CheckRow>
            <CheckRow
              ok={checks.captureWindowValid}
              detail={`${checks.captureWindowBlocks} blocks between the device's block and the anchor (about ${checks.captureWindowBlocks * 6} s)`}
            >
              Captured within the allowed window
            </CheckRow>
            <CheckRow
              ok={manifest.capture.source === 'camera' ? true : null}
              detail={
                manifest.capture.source === 'camera'
                  ? undefined
                  : 'Imported files carry weaker evidence'
              }
            >
              Taken with the Witness camera
            </CheckRow>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
