import type { Clock } from "./types";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly clock: Clock = { now: () => Date.now() }) {}

  get(key: string): { found: false } | { found: true; value: T } {
    const entry = this.entries.get(key);
    if (!entry) return { found: false };

    if (entry.expiresAt <= this.clock.now()) {
      this.entries.delete(key);
      return { found: false };
    }

    return { found: true, value: entry.value };
  }

  set(key: string, value: T, ttlMs: number): T {
    this.entries.set(key, {
      value,
      expiresAt: this.clock.now() + ttlMs,
    });

    return value;
  }
}
