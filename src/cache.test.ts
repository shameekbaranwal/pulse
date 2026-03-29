import { describe, expect, it } from "bun:test";
import { TTLCache } from "./cache";

describe("TTLCache", () => {
  it("returns cached values before expiry", () => {
    let now = 1_000;
    const cache = new TTLCache<string>({ now: () => now });

    cache.set("greeting", "hello", 500);
    expect(cache.get("greeting")).toEqual({ found: true, value: "hello" });

    now = 1_499;
    expect(cache.get("greeting")).toEqual({ found: true, value: "hello" });
  });

  it("evicts expired values", () => {
    let now = 1_000;
    const cache = new TTLCache<string>({ now: () => now });

    cache.set("greeting", "hello", 500);
    now = 1_500;

    expect(cache.get("greeting")).toEqual({ found: false });
  });
});
