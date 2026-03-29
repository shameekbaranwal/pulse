import { beforeEach, describe, expect, it } from "bun:test";
import { loadConfig } from "./config";
import { createPulseServer } from "./server";
import type { ContributionGraph, NowPlayingTrack } from "./types";

class FixedClock {
  constructor(private current: number) {}

  now() {
    return this.current;
  }
}

describe("createPulseServer", () => {
  let clock: FixedClock;

  beforeEach(() => {
    clock = new FixedClock(Date.parse("2026-03-29T00:00:00Z"));
  });

  it("serves spotify payloads and caches them", async () => {
    let calls = 0;
    const track: NowPlayingTrack = {
      isPlaying: true,
      title: "track",
      artist: "artist",
      album: "album",
      url: "https://spotify.test/track",
    };

    const server = createPulseServer({
      config: loadConfig({ ALLOWED_ORIGINS: "https://blog.shmk.dev,https://stage-blog.shmk.dev" }),
      clock,
      spotify: {
        async getNowPlaying() {
          calls += 1;
          return track;
        },
      },
      github: {
        async getContributions() {
          return null;
        },
      },
    });

    const first = await server.fetch(new Request("https://pulse.test/api/v1/widgets/spotify/now-playing", {
      headers: { Origin: "https://stage-blog.shmk.dev" },
    }));
    const firstPayload = await first.json() as any;

    expect(first.status).toBe(200);
    expect(firstPayload.data.track).toEqual(track);
    expect(firstPayload.meta.cached).toBe(false);
    expect(first.headers.get("Access-Control-Allow-Origin")).toBe("https://stage-blog.shmk.dev");

    const second = await server.fetch(new Request("https://pulse.test/api/v1/widgets/spotify/now-playing"));
    const secondPayload = await second.json() as any;

    expect(secondPayload.meta.cached).toBe(true);
    expect(calls).toBe(1);
  });

  it("serves github payloads with bounded days", async () => {
    const graph: ContributionGraph = {
      totalContributions: 42,
      weeks: [
        {
          contributionDays: [
            {
              date: "2026-03-29",
              contributionCount: 2,
              contributionLevel: "SECOND_QUARTILE",
            },
          ],
        },
      ],
    };

    const server = createPulseServer({
      config: loadConfig(),
      clock,
      spotify: {
        async getNowPlaying() {
          return null;
        },
      },
      github: {
        async getContributions(username, days) {
          expect(username).toBe("shameekbaranwal");
          expect(days).toBe(365);
          return graph;
        },
      },
    });

    const response = await server.fetch(new Request("https://pulse.test/api/v1/widgets/github/contributions?username=shameekbaranwal&days=9999"));
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data.graph).toEqual(graph);
    expect(payload.data.days).toBe(365);
  });

  it("enforces rate limits", async () => {
    const server = createPulseServer({
      config: loadConfig({ RATE_LIMIT_MAX: "1", RATE_LIMIT_WINDOW_MS: "60000" }),
      clock,
      spotify: {
        async getNowPlaying() {
          return null;
        },
      },
      github: {
        async getContributions() {
          return null;
        },
      },
    });

    const request = new Request("https://pulse.test/health", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    const first = await server.fetch(request);
    const second = await server.fetch(request);

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });

  it("handles cors preflight", async () => {
    const server = createPulseServer({
      config: loadConfig({ ALLOWED_ORIGINS: "https://blog.shmk.dev,https://stage-blog.shmk.dev" }),
      clock,
      spotify: {
        async getNowPlaying() {
          return null;
        },
      },
      github: {
        async getContributions() {
          return null;
        },
      },
    });

    const response = await server.fetch(new Request("https://pulse.test/api/v1/widgets/spotify/now-playing", {
      method: "OPTIONS",
      headers: { Origin: "https://blog.shmk.dev" },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://blog.shmk.dev");
  });
});
