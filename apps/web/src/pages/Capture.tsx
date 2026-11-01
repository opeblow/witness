import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  type CaptureSource,
  type Hex,
  type SignedCapture,
  fingerprint,
  sha256Hex,
} from '@witness/core';
import type { Certificate, NotaryReceipt } from '@witness/sdk';
import { DropZone, Hash, QrCode, type StepItem, Steps } from '../components/evidence';
import { getApi, getRegistry, isDeployed } from '../lib/chain';
import { NETWORK, NOTARY_URL, blockLink } from '../lib/config';
import { exportDeviceKey, loadDeviceKey } from '../lib/device-key';
import { formatNumber, witnessId } from '../lib/format';
import {
  type LoadedImage,
  captureFrame,
  downloadBytes,
  loadImage,
  makePreview,
} from '../lib/image';
import { useChainClock } from '../lib/use-chain-clock';
import './app.css';

type Phase =
  | { kind: 'start' }
  | { kind: 'camera' }
  | { kind: 'review'; image: LoadedImage; source: CaptureSource; hash: Hex; dhash: string }
  | { kind: 'sealing'; image: LoadedImage; source: CaptureSource; steps: StepItem[] }
  | {
      kind: 'sealed';
      image: LoadedImage;
      signed: SignedCapture;
      receipt: NotaryReceipt;
      certificate: Certificate;
    };

const SEAL_STEPS: StepItem[] = [
  { id: 'block', label: 'Read the latest finalized block', state: 'pending' },
  { id: 'sign', label: 'Fingerprint and sign on this device', state: 'pending' },
  { id: 'submit', label: 'Anchor on Portaldot through the notary', state: 'pending' },
  { id: 'index', label: 'Confirm the registry can see it', state: 'pending' },
];

export function Capture() {
  const [phase, setPhase] = useState<Phase>({ kind: 'start' });
  const [error, setError] = useState<string | null>(null);
  const [includePreview, setIncludePreview] = useState(false);
  const [note, setNote] = useState('');
  const clock = useChainClock();
  const device = loadDeviceKey();

  const review = useCallback(async (blob: Blob, source: CaptureSource) => {
    setError(null);
    try {
      const image = await loadImage(blob);
      const fp = fingerprint(image.raster);
      setPhase({ kind: 'review', image, source, hash: sha256Hex(image.bytes), dhash: fp.dhash });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    }
  }, []);

  const seal = useCallback(
    async (image: LoadedImage, source: CaptureSource) => {
      setError(null);
      let steps = SEAL_STEPS.map((s) => ({ ...s }));
      const update = (id: string, patch: Partial<StepItem>) => {
        steps = steps.map((s) => (s.id === id ? { ...s, ...patch } : s));
        setPhase({ kind: 'sealing', image, source, steps });
      };
      try {
        if (!NOTARY_URL)
          throw new Error('This deployment has no notary configured, so it cannot seal captures.');
        const sdk = await import('@witness/sdk');
        const core = await import('@witness/core');

        update('block', { state: 'running' });
        const api = await getApi();
        const block = await sdk.latestFinalizedBlock(api);
        update('block', { state: 'done', detail: `Block ${formatNumber(block.number)}` });

        update('sign', { state: 'running' });
        const preview = includePreview ? await makePreview(image.url) : undefined;
        const signed = core.createCapture({
          file: image.bytes,
          mime: image.mime,
          raster: image.raster,
          keys: device,
          source,
          block,
          network: { name: NETWORK.name, genesis: sdk.genesisHash(api) },
          ...(preview ? { preview } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        update('sign', { state: 'done', detail: `ed25519 ${signed.signature.slice(0, 18)}...` });

        update('submit', { state: 'running' });
        const receipt = await new sdk.NotaryClient(NOTARY_URL).submit(signed);
        update('submit', {
          state: 'done',
          detail: `Block ${formatNumber(receipt.blockNumber)}, extrinsic ${receipt.extrinsicIndex}`,
        });

        update('index', { state: 'running' });
        const registry = await getRegistry();
        for (let attempt = 0; registry && attempt < 15; attempt++) {
          if (await registry.anchorOf(signed.manifest.content.sha256)) break;
          await new Promise((r) => setTimeout(r, 2000));
        }
        update('index', { state: 'done', detail: 'Visible to every verifier' });

        const certificate: Certificate = {
          format: 'witness.certificate',
          version: 1,
          network: NETWORK.name,
          registry: NETWORK.registry as Hex,
          anchor: {
            blockNumber: receipt.blockNumber,
            blockHash: receipt.blockHash,
            extrinsicIndex: receipt.extrinsicIndex,
          },
          capture: signed,
        };
        setPhase({ kind: 'sealed', image, signed, receipt, certificate });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Sealing failed.';
        steps = steps.map((s) =>
          s.state === 'running' ? { ...s, state: 'failed', detail: message } : s,
        );
        setPhase({ kind: 'sealing', image, source, steps });
        setError(message);
      }
    },
    [device, includePreview, note],
  );

  return (
    <div className="app-page page">
      <header className="app-head">
        <div>
          <p className="label">Capture</p>
          <h1 className="h1">Seal a photograph.</h1>
          <p className="lede">
            The picture is fingerprinted and signed in this browser, then anchored on Portaldot. You
            keep the file and a certificate; the chain keeps the proof.
          </p>
        </div>
        <ChainClockBadge block={clock.block} error={clock.error} />
      </header>

      {!isDeployed() ? <NotDeployed /> : null}
      {error ? (
        <p role="alert" className="notice notice-bad">
          {error}
        </p>
      ) : null}

      {phase.kind === 'start' ? (
        <div className="capture-start">
          <button
            type="button"
            className="capture-option cropmarks"
            onClick={() => setPhase({ kind: 'camera' })}
          >
            <span className="label">Recommended</span>
            <span className="h2">Use the camera</span>
            <span className="muted">
              Strongest evidence. The frame goes straight from the camera to the signature, with no
              gallery in between.
            </span>
          </button>
          <DropZone
            accept="image/jpeg,image/png,image/webp"
            onFiles={(files) => files[0] && void review(files[0], 'import')}
          >
            <span className="label">Or import a file</span>
            <span className="h3">Drop an image or choose one</span>
            <span className="muted small">
              Imports are marked as imports. Witness then vouches for who and when, not for the
              camera.
            </span>
          </DropZone>
        </div>
      ) : null}

      {phase.kind === 'camera' ? (
        <CameraView
          onCancel={() => setPhase({ kind: 'start' })}
          onShot={(blob) => void review(blob, 'camera')}
          onError={(message) => {
            setError(message);
            setPhase({ kind: 'start' });
          }}
        />
      ) : null}

      {phase.kind === 'review' ? (
        <div className="split">
          <figure className="split-media cropmarks">
            <img src={phase.image.url} alt="The photo about to be sealed" />
          </figure>
          <div className="split-side stack" style={{ ['--stack' as string]: '20px' }}>
            <div>
              <p className="label">Ready to seal</p>
              <h2 className="h2">{witnessId(phase.hash)}</h2>
            </div>
            <dl className="facts">
              <dt>Source</dt>
              <dd>{phase.source === 'camera' ? 'Camera, captured in Witness' : 'Imported file'}</dd>
              <dt>Size</dt>
              <dd className="mono">
                {phase.image.raster.width} x {phase.image.raster.height} &middot;{' '}
                {formatNumber(phase.image.bytes.length)} bytes
              </dd>
              <dt>SHA-256</dt>
              <dd>
                <Hash value={phase.hash} />
              </dd>
              <dt>dHash</dt>
              <dd className="mono">{phase.dhash}</dd>
              <dt>Device</dt>
              <dd>
                <Hash value={device.address} head={8} tail={6} />
              </dd>
            </dl>
            <label className="field">
              <span className="label">Reference (optional, public)</span>
              <input
                className="input"
                maxLength={280}
                value={note}
                placeholder="Order 4471, unboxing"
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={includePreview}
                onChange={(e) => setIncludePreview(e.target.checked)}
              />
              <span>
                <strong>Publish a low-resolution preview.</strong>{' '}
                <span className="muted">
                  Lets verifiers see the original next to a suspect copy. Off by default.
                </span>
              </span>
            </label>
            <div className="actions">
              <button
                type="button"
                className="btn"
                disabled={!isDeployed()}
                onClick={() => void seal(phase.image, phase.source)}
              >
                Seal on Portaldot
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPhase({ kind: 'start' })}
              >
                Retake
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase.kind === 'sealing' ? (
        <div className="split">
          <figure className="split-media cropmarks">
            <img src={phase.image.url} alt="The photo being sealed" />
          </figure>
          <div className="split-side">
            <p className="label">Sealing</p>
            <Steps items={phase.steps} />
            {phase.steps.some((s) => s.state === 'failed') ? (
              <div className="actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => void seal(phase.image, phase.source)}
                >
                  Try again
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPhase({ kind: 'start' })}
                >
                  Start over
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase.kind === 'sealed' ? (
        <Sealed phase={phase} onAnother={() => setPhase({ kind: 'start' })} />
      ) : null}

      <details className="device-panel">
        <summary className="label">This device&apos;s capture key</summary>
        <div className="device-body">
          <p className="muted small">
            Captures from this browser are signed by <code>{device.address}</code>.{' '}
            {device.persistent
              ? 'The key is stored in this browser only.'
              : 'Storage is unavailable, so this key lasts for this session only.'}
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              downloadBytes(exportDeviceKey(device), 'witness-device-key.json', 'application/json')
            }
          >
            Back up key
          </button>
        </div>
      </details>
    </div>
  );
}

function Sealed({
  phase,
  onAnother,
}: {
  phase: Extract<Phase, { kind: 'sealed' }>;
  onAnother: () => void;
}) {
  const { signed, receipt, image, certificate } = phase;
  const id = signed.manifest.content.sha256;
  const recordUrl = `${window.location.origin}${import.meta.env.BASE_URL}v/${id}`;
  const ext = signed.manifest.content.mime.split('/')[1] ?? 'jpg';
  const window_ = receipt.blockNumber - signed.manifest.capture.block.number;
  return (
    <div className="certificate">
      <div className="certificate-head">
        <span className="pill pill-ok">Sealed</span>
        <span className="label">Witness certificate</span>
      </div>
      <div className="certificate-body">
        <figure className="certificate-media cropmarks">
          <img src={image.url} alt="The sealed photo" />
        </figure>
        <div className="certificate-main">
          <p className="label">Witness id</p>
          <p className="certificate-id">{witnessId(id)}</p>
          <dl className="facts">
            <dt>Anchored</dt>
            <dd>
              <a
                href={blockLink(receipt.blockHash)}
                target="_blank"
                rel="noreferrer"
                className="mono"
              >
                Block {formatNumber(receipt.blockNumber)}
              </a>
            </dd>
            <dt>Window</dt>
            <dd className="mono">
              {window_} blocks after block {formatNumber(signed.manifest.capture.block.number)}{' '}
              (about {window_ * 6} s)
            </dd>
            <dt>Extrinsic</dt>
            <dd>
              <Hash value={receipt.extrinsicHash} />
            </dd>
            <dt>Content</dt>
            <dd>
              <Hash value={id} />
            </dd>
            <dt>Signed by</dt>
            <dd>
              <Hash value={signed.manifest.signer.key} />
            </dd>
          </dl>
        </div>
        <div className="certificate-qr">
          <QrCode value={recordUrl} />
          <span className="label">Scan to verify</span>
        </div>
      </div>
      <div className="certificate-actions">
        <button
          type="button"
          className="btn"
          onClick={() =>
            downloadBytes(
              image.bytes,
              `witness-${id.slice(2, 14)}.${ext}`,
              signed.manifest.content.mime,
            )
          }
        >
          Download sealed photo
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            const { encodeCertificate } = await import('@witness/sdk');
            downloadBytes(
              encodeCertificate(certificate),
              `witness-${id.slice(2, 14)}.witness.json`,
              'application/json',
            );
          }}
        >
          Download certificate
        </button>
        <Link to={`/v/${id}`} className="btn btn-secondary">
          Open public record
        </Link>
        <button type="button" className="btn btn-quiet" onClick={onAnother}>
          Seal another
        </button>
      </div>
      <p className="muted small">
        Keep the downloaded photo: it is the bit-for-bit original. Copies sent through messaging
        apps still verify visually, and any edit is located.
      </p>
    </div>
  );
}

function CameraView({
  onShot,
  onCancel,
  onError,
}: {
  onShot: (blob: Blob) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  // Held in a ref so parent re-renders (the chain clock ticks every block) never restart the camera.
  const reportError = useRef(onError);
  useEffect(() => {
    reportError.current = onError;
  }, [onError]);

  useEffect(() => {
    const onError = (message: string) => reportError.current(message);
    let stream: MediaStream | null = null;
    let live = true;
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((s) => {
        if (!live) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().then(() => setReady(true));
        }
      })
      .catch(() =>
        onError('Camera access was blocked. Allow the camera, or import a file instead.'),
      );
    if (!navigator.mediaDevices)
      onError('This browser has no camera access. Import a file instead.');
    return () => {
      live = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="camera">
      <div className="viewfinder">
        <video ref={video} playsInline muted className="viewfinder-video" />
        <span className="viewfinder-corner tl" aria-hidden="true" />
        <span className="viewfinder-corner tr" aria-hidden="true" />
        <span className="viewfinder-corner bl" aria-hidden="true" />
        <span className="viewfinder-corner br" aria-hidden="true" />
        <span className="viewfinder-rec label" aria-hidden="true">
          <span className="rec-dot" /> Witness
        </span>
      </div>
      <div className="camera-bar">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="shutter"
          disabled={!ready}
          aria-label="Take photo"
          onClick={() => {
            if (video.current) void captureFrame(video.current).then(onShot);
          }}
        />
        <span className="camera-hint muted small">
          {ready ? 'Frame the subject, then press' : 'Starting camera'}
        </span>
      </div>
    </div>
  );
}

export function ChainClockBadge({ block, error }: { block: number | null; error: string | null }) {
  return (
    <div className="clock" aria-live="off">
      <span className="label">Chain clock</span>
      <span className="clock-value mono">
        {error ? 'offline' : block === null ? 'connecting' : `#${formatNumber(block)}`}
      </span>
      <span className="label clock-sub">finalized, Portaldot V3</span>
    </div>
  );
}

export function NotDeployed() {
  return (
    <p className="notice notice-warn">
      The Witness registry is not deployed in this build yet. Verification and sealing turn on after{' '}
      <code>npm run deploy:registry</code>.
    </p>
  );
}
