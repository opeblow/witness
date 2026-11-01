import { useCallback, useState } from 'react';
import type { Certificate, VerifyProgress, VerifyResult, VerifyStep } from '@witness/sdk';
import { DropZone, type StepItem, Steps } from '../components/evidence';
import { VerdictView } from '../components/VerdictView';
import { getApi, getRegistry, isDeployed } from '../lib/chain';
import { type LoadedImage, loadImage } from '../lib/image';
import { NotDeployed } from './Capture';
import './app.css';

const STEP_LABELS: Record<VerifyStep, string> = {
  fingerprint: 'Fingerprint the image in this browser',
  lookup: 'Look up its exact hash in the registry',
  similar: 'Search recent captures for the same picture',
  retrieve: 'Retrieve signed evidence from Portaldot',
  decide: 'Check signatures and compare',
};

const INITIAL_STEPS: StepItem[] = (Object.keys(STEP_LABELS) as VerifyStep[]).map((id) => ({
  id,
  label: STEP_LABELS[id],
  state: 'pending',
}));

type State =
  | { kind: 'idle' }
  | { kind: 'running'; image: LoadedImage; steps: StepItem[] }
  | { kind: 'done'; image: LoadedImage; result: VerifyResult; certificate: Certificate | null };

export function Verify() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (files: File[]) => {
    setError(null);
    const imageFile = files.find((f) => f.type.startsWith('image/'));
    const certificateFile = files.find((f) => f.name.endsWith('.json'));
    if (!imageFile) {
      setError('Add the image to verify. A certificate file is optional.');
      return;
    }
    try {
      const [image, sdk, registry] = await Promise.all([
        loadImage(imageFile),
        import('@witness/sdk'),
        getRegistry(),
      ]);
      if (!registry) throw new Error('The registry is not deployed in this build.');
      const certificate = certificateFile
        ? sdk.parseCertificate(await certificateFile.text())
        : null;
      let steps = INITIAL_STEPS.map((s) => ({ ...s }));
      setState({ kind: 'running', image, steps });
      const onProgress = (p: VerifyProgress) => {
        steps = steps.map((s) =>
          s.id === p.step ? { ...s, state: p.status, detail: p.detail } : s,
        );
        setState({ kind: 'running', image, steps });
      };
      const result = await sdk.verifyImage(
        { file: image.bytes, raster: image.raster },
        { registry, api: getApi, certificate, onProgress },
      );
      setState({ kind: 'done', image, result, certificate });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
      setState({ kind: 'idle' });
    }
  }, []);

  return (
    <div className="app-page page">
      <header className="app-head">
        <div>
          <p className="label">Verify</p>
          <h1 className="h1">Check an image against the chain.</h1>
          <p className="lede">
            Everything runs in your browser: the image never leaves this device. Witness reads
            Portaldot directly and tells you whether the picture is the one that was sealed.
          </p>
        </div>
      </header>

      {!isDeployed() ? <NotDeployed /> : null}
      {error ? (
        <p role="alert" className="notice notice-bad">
          {error}
        </p>
      ) : null}

      {state.kind === 'idle' ? (
        <DropZone
          accept="image/jpeg,image/png,image/webp,application/json,.json"
          onFiles={(f) => void run(f)}
          disabled={!isDeployed()}
        >
          <span className="label">Drop here</span>
          <span className="h2">An image to verify</span>
          <span className="muted small">
            JPEG, PNG or WebP. Add the <code>.witness.json</code> certificate too if the capture is
            older than a week.
          </span>
          <span className="btn btn-secondary btn-sm" aria-hidden="true">
            Choose files
          </span>
        </DropZone>
      ) : null}

      {state.kind === 'running' ? (
        <div className="split">
          <figure className="split-media cropmarks">
            <img src={state.image.url} alt="The image being verified" />
          </figure>
          <div className="split-side">
            <p className="label">Verifying</p>
            <Steps items={state.steps} />
          </div>
        </div>
      ) : null}

      {state.kind === 'done' ? (
        <>
          <VerdictView verdict={state.result.verdict} imageUrl={state.image.url} />
          {state.result.unresolved.length > 0 ? (
            <p className="notice notice-warn">
              {state.result.unresolved.length} matching anchor(s) were found, but their evidence is
              past the chain&apos;s storage retention. Add the capture&apos;s certificate file to
              complete the check.
            </p>
          ) : null}
          <div className="actions">
            <button type="button" className="btn" onClick={() => setState({ kind: 'idle' })}>
              Verify another image
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
