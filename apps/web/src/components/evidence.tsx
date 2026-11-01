import QRCode from 'qrcode';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import type { Region } from '@witness/core';
import { GRID } from '@witness/core';
import { shortHash } from '../lib/format';
import './evidence.css';

/** A hash shown in short form with a copy button. */
export function Hash({
  value,
  head = 10,
  tail = 6,
}: {
  value: string;
  head?: number;
  tail?: number;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="hash">
      <code title={value}>{shortHash(value, head, tail)}</code>
      <button
        type="button"
        className="hash-copy"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }}
        aria-label={`Copy ${value}`}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

export type StepState = 'pending' | 'running' | 'done' | 'skipped' | 'failed';

export interface StepItem {
  readonly id: string;
  readonly label: string;
  readonly state: StepState;
  readonly detail?: string | undefined;
}

/** A vertical checklist that shows a multi-step process as it runs. */
export function Steps({ items }: { items: readonly StepItem[] }) {
  return (
    <ol className="steps" aria-live="polite">
      {items.map((item, index) => (
        <li key={item.id} className={`step step-${item.state}`}>
          <span className="step-index" aria-hidden="true">
            {item.state === 'done' ? <Tick /> : String(index + 1).padStart(2, '0')}
          </span>
          <span className="step-body">
            <span className="step-label">{item.label}</span>
            {item.detail ? <span className="step-detail mono">{item.detail}</span> : null}
          </span>
          <span className="visually-hidden">{item.state}</span>
        </li>
      ))}
    </ol>
  );
}

function Tick() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Accepts dropped or chosen files. */
export function DropZone({
  accept,
  onFiles,
  children,
  disabled,
}: {
  accept: string;
  onFiles: (files: File[]) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  return (
    <div
      className={`dropzone cropmarks${over ? ' dropzone-over' : ''}${disabled ? ' dropzone-disabled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        ref={input}
        id={id}
        type="file"
        multiple
        accept={accept}
        className="visually-hidden"
        disabled={disabled}
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <label htmlFor={id} className="dropzone-label">
        {children}
      </label>
    </div>
  );
}

/**
 * An image with Witness overlays: the fingerprint grid, a heat map of per-cell change,
 * and boxes around changed regions or the crop window.
 */
export function EvidenceImage({
  src,
  alt,
  regions = [],
  heat,
  tone = 'bad',
  showGrid = false,
  caption,
}: {
  src: string;
  alt: string;
  regions?: readonly Region[];
  heat?: Float64Array | undefined;
  tone?: 'bad' | 'warn';
  showGrid?: boolean;
  caption?: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    ctx.clearRect(0, 0, GRID, GRID);
    if (!heat) return;
    for (let i = 0; i < heat.length; i++) {
      const v = heat[i] ?? 0;
      if (v < 0.5) continue;
      ctx.fillStyle = `rgba(168, 35, 26, ${Math.min(0.55, (v - 0.5) * 1.1)})`;
      ctx.fillRect(i % GRID, Math.floor(i / GRID), 1, 1);
    }
  }, [heat]);

  return (
    <figure className="evidence-figure">
      <div className="evidence-frame cropmarks">
        <img src={src} alt={alt} className="evidence-img" />
        {heat ? (
          <canvas
            ref={canvas}
            width={GRID}
            height={GRID}
            className="evidence-heat"
            aria-hidden="true"
          />
        ) : null}
        {showGrid ? <div className="evidence-grid" aria-hidden="true" /> : null}
        {regions.map((r, i) => (
          <div
            key={i}
            className={`evidence-region evidence-region-${tone}`}
            style={{
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.width * 100}%`,
              height: `${r.height * 100}%`,
            }}
          >
            {i === 0 ? (
              <span className="evidence-region-tag">
                {tone === 'bad' ? 'Changed' : 'Crop window'}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {caption ? <figcaption className="evidence-caption">{caption}</figcaption> : null}
    </figure>
  );
}

/** A QR code rendered as crisp SVG. */
export function QrCode({ value, size = 132 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let live = true;
    void QRCode.toString(value, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#15130F', light: '#00000000' },
    }).then((markup) => {
      if (live) setSvg(markup);
    });
    return () => {
      live = false;
    };
  }, [value]);
  return (
    <div
      className="qr"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`QR code for ${value}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** A labelled check row with a pass, fail or neutral mark. */
export function CheckRow({
  ok,
  children,
  detail,
}: {
  ok: boolean | null;
  children: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <li
      className={`check-row ${ok === null ? 'check-row-na' : ok ? 'check-row-ok' : 'check-row-bad'}`}
    >
      <span className="check-mark" aria-hidden="true">
        {ok === null ? '-' : ok ? <Tick /> : 'x'}
      </span>
      <span>
        <span className="check-text">{children}</span>
        {detail ? <span className="check-detail">{detail}</span> : null}
      </span>
      <span className="visually-hidden">
        {ok === null ? 'not applicable' : ok ? 'passed' : 'failed'}
      </span>
    </li>
  );
}
