import { TTLCache } from "./cache";
import type { PulseConfig } from "./config";
import { buildCacheHeaders, getClientIp, jsonResponse, optionsResponse } from "./http";
import type { GithubProvider } from "./providers/github";
import type { SpotifyProvider } from "./providers/spotify";
import { InMemoryRateLimiter } from "./rate-limit";
import type { Clock, ContributionGraph, NowPlayingTrack, ResponseMeta } from "./types";

interface CreatePulseServerOptions {
  config: PulseConfig;
  spotify: SpotifyProvider;
  github: GithubProvider;
  clock?: Clock;
}

function createMeta(now: number, ttlMs: number, cached: boolean): ResponseMeta {
  return {
    cached,
    generatedAt: new Date(now).toISOString(),
    ttlSeconds: Math.max(1, Math.floor(ttlMs / 1000)),
  };
}

export function createPulseServer({ config, spotify, github, clock = { now: () => Date.now() } }: CreatePulseServerOptions) {
  const spotifyCache = new TTLCache<NowPlayingTrack | null>(clock);
  const githubCache = new TTLCache<ContributionGraph | null>(clock);
  const rateLimiter = new InMemoryRateLimiter(config.rateLimitMax, config.rateLimitWindowMs, clock);

  async function handleSpotify() {
    const now = clock.now();
    const cacheKey = "spotify:now-playing";
    const cached = spotifyCache.get(cacheKey);

    if (cached.found) {
      return jsonResponse(config, {
        data: { track: cached.value },
        meta: createMeta(now, config.spotifyCacheTTL, true),
      }, { headers: buildCacheHeaders(Math.floor(config.spotifyCacheTTL / 1000)) });
    }

    try {
      const track = await spotify.getNowPlaying();
      spotifyCache.set(cacheKey, track, config.spotifyCacheTTL);
      return jsonResponse(config, {
        data: { track },
        meta: createMeta(now, config.spotifyCacheTTL, false),
      }, { headers: buildCacheHeaders(Math.floor(config.spotifyCacheTTL / 1000)) });
    } catch {
      return jsonResponse(config, {
        data: { track: null },
        meta: createMeta(now, 10_000, false),
      }, { status: 503, headers: buildCacheHeaders(10) });
    }
  }

  async function handleGithub(url: URL) {
    const now = clock.now();
    const username = url.searchParams.get("username") || "shameekbaranwal";
    const requestedDays = Number(url.searchParams.get("days") || 90);
    const days = Math.max(1, Math.min(365, Number.isFinite(requestedDays) ? requestedDays : 90));
    const cacheKey = `github:${username}:${days}`;
    const cached = githubCache.get(cacheKey);

    if (cached.found) {
      return jsonResponse(config, {
        data: { graph: cached.value, username, days },
        meta: createMeta(now, config.githubCacheTTL, true),
      }, { headers: buildCacheHeaders(Math.floor(config.githubCacheTTL / 1000)) });
    }

    try {
      const graph = await github.getContributions(username, days);
      githubCache.set(cacheKey, graph, config.githubCacheTTL);
      return jsonResponse(config, {
        data: { graph, username, days },
        meta: createMeta(now, config.githubCacheTTL, false),
      }, { headers: buildCacheHeaders(Math.floor(config.githubCacheTTL / 1000)) });
    } catch {
      return jsonResponse(config, {
        data: { graph: null, username, days },
        meta: createMeta(now, 60_000, false),
      }, { status: 503, headers: buildCacheHeaders(60) });
    }
  }

  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method === "OPTIONS") {
        return optionsResponse(config);
      }

      const ip = getClientIp(request);
      if (!rateLimiter.allow(ip)) {
        return jsonResponse(config, { error: "rate limit exceeded" }, {
          status: 429,
          headers: buildCacheHeaders(10),
        });
      }

      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return jsonResponse(config, {
          ok: true,
          service: "pulse",
          now: new Date(clock.now()).toISOString(),
        }, { headers: buildCacheHeaders(5) });
      }

      if (request.method !== "GET") {
        return jsonResponse(config, { error: "method not allowed" }, { status: 405 });
      }

      if (url.pathname === "/api/v1/widgets/spotify/now-playing" || url.pathname === "/api/spotify/now-playing") {
        return handleSpotify();
      }

      if (url.pathname === "/api/v1/widgets/github/contributions" || url.pathname === "/api/github/contributions") {
        return handleGithub(url);
      }

      return jsonResponse(config, { error: "not found" }, { status: 404 });
    },
  };
}
