/** The Witness mark: viewfinder corners around a recording light. */
export function LogoMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="64" height="64" rx="12" fill="var(--ink, #15130F)" />
      <path
        d="M15 27V15h12M37 15h12v12M49 37v12H37M27 49H15V37"
        fill="none"
        stroke="var(--paper, #F4F1EA)"
        strokeWidth="4.5"
        strokeLinecap="square"
      />
      <circle cx="32" cy="32" r="6.5" fill="var(--rec, #D2451E)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <LogoMark size={26} />
      <span className="wordmark-text">Witness</span>
    </span>
  );
}
