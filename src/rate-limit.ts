import type { Clock } from "./types";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly clock: Clock = { now: () => Date.now() },
  ) {}

  allow(key: string): boolean {
    const now = this.clock.now();
    const current = this.entries.get(key);

    if (!current || current.resetAt <= now) {
      this.entries.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    if (current.count >= this.max) return false;

    current.count += 1;
    return true;
  }
}
