export function shortHash(hash: string, head = 10, tail = 6): string {
  return hash.length <= head + tail + 3 ? hash : `${hash.slice(0, head)}...${hash.slice(-tail)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatDateTime(ms: number): string {
  return (
    new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(ms)) + ' UTC'
  );
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86_400)} days`;
}

export function percent(ratio: number): string {
  return `${(ratio * 100).toFixed(ratio < 0.1 ? 1 : 0)}%`;
}

/** Witness ids are SHA-256 content hashes; this is the human-friendly short form. */
export function witnessId(contentHash: string): string {
  const hex = contentHash.replace(/^0x/, '').toUpperCase();
  return `W-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}
