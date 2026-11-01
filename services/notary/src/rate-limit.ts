/**
 * In-memory token bucket. Good enough for a single notary instance; a horizontally
 * scaled deployment would move this to a shared store (see docs/architecture.md).
 */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; updated: number }>();

  constructor(
    private readonly capacity: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Takes one token for `key`. Returns the milliseconds to wait, or 0 if allowed. */
  take(key: string): number {
    const now = this.now();
    const rate = this.capacity / this.windowMs;
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updated: now };
    bucket.tokens = Math.min(this.capacity, bucket.tokens + (now - bucket.updated) * rate);
    bucket.updated = now;
    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket);
      return Math.ceil((1 - bucket.tokens) / rate);
    }
    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    if (this.buckets.size > 50_000) this.prune(now);
    return 0;
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updated > this.windowMs) this.buckets.delete(key);
    }
  }
}
