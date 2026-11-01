import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { type Anchor, type Evidence, type Hex, checkIntegrity, isHex } from '@witness/core';
import { RecordDetails } from '../components/VerdictView';
import { EvidenceImage } from '../components/evidence';
import { getApi, getRegistry } from '../lib/chain';
import { formatNumber, witnessId } from '../lib/format';
import { base64ToObjectUrl } from '../lib/image';
import './app.css';

type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'found'; anchor: Anchor; evidence: Evidence | null };

export function Record() {
  const { id = '' } = useParams();
  const contentHash = id.toLowerCase() as Hex;
  const valid = isHex(contentHash, 32);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!valid) return;
    let live = true;
    void (async () => {
      try {
        const [registry, sdk] = await Promise.all([getRegistry(), import('@witness/sdk')]);
        if (!registry) throw new Error('The registry is not deployed in this build.');
        const found = await sdk.lookupCapture(contentHash, { registry, api: getApi });
        if (!live) return;
        setState(found ? { kind: 'found', ...found } : { kind: 'missing' });
        const preview = found?.evidence?.signed.manifest.preview;
        if (preview) setPreviewUrl(base64ToObjectUrl(preview.data, preview.mime));
      } catch (e) {
        if (live)
          setState({ kind: 'error', message: e instanceof Error ? e.message : 'Lookup failed.' });
      }
    })();
    return () => {
      live = false;
    };
  }, [contentHash, valid]);

  if (!valid) {
    return (
      <div className="app-page page narrow">
        <h1 className="h1">That is not a Witness id.</h1>
        <p className="lede">Record links end in a 64-character content hash.</p>
      </div>
    );
  }

  return (
    <div className="app-page page">
      <header className="app-head">
        <div>
          <p className="label">Public record</p>
          <h1 className="h1 mono-id">{witnessId(contentHash)}</h1>
          <p className="muted mono small break">{contentHash}</p>
        </div>
      </header>

      {state.kind === 'loading' ? <p className="muted">Reading Portaldot...</p> : null}
      {state.kind === 'error' ? <p className="notice notice-bad">{state.message}</p> : null}
      {state.kind === 'missing' ? (
        <div className="stack">
          <p className="pill pill-neutral">No record</p>
          <p className="lede">No capture with this id has been anchored on Portaldot.</p>
        </div>
      ) : null}

      {state.kind === 'found' ? (
        <div className="stack" style={{ ['--stack' as string]: '32px' }}>
          <div className="record-banner">
            <span className="pill pill-ok">Anchored</span>
            <span>
              Sealed in block <strong>{formatNumber(state.anchor.blockNumber)}</strong>. The
              registry keeps the first anchor of a file forever.
            </span>
          </div>
          {previewUrl ? (
            <div className="record-preview">
              <EvidenceImage
                src={previewUrl}
                alt="Published preview of the sealed photo"
                caption="Published low-resolution preview"
              />
            </div>
          ) : (
            <p className="muted small">
              The capturer chose not to publish a preview. Verify a copy to compare it.
            </p>
          )}
          {state.evidence ? (
            <RecordDetails evidence={state.evidence} checks={checkIntegrity(state.evidence)} />
          ) : (
            <p className="notice notice-warn">
              The anchor is permanent, but the signed evidence is past the chain&apos;s storage
              retention. Verify with the capture&apos;s certificate file.
            </p>
          )}
          <div className="actions">
            <Link to="/verify" className="btn">
              Verify a copy against the chain
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
