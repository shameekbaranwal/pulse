export interface PulseConfig {
  port: number;
  allowedOrigin: string;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  spotifyCacheTTL: number;
  githubCacheTTL: number;
  githubToken?: string;
  spotifyClientId?: string;
  spotifyClientSecret?: string;
  spotifyRefreshToken?: string;
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env: Record<string, string | undefined> = Bun.env): PulseConfig {
  return {
    port: readNumber(env.PORT, 4010),
    allowedOrigin: env.ALLOWED_ORIGIN || "*",
    rateLimitMax: readNumber(env.RATE_LIMIT_MAX, 120),
    rateLimitWindowMs: readNumber(env.RATE_LIMIT_WINDOW_MS, 60_000),
    spotifyCacheTTL: readNumber(env.SPOTIFY_CACHE_TTL_MS, 30_000),
    githubCacheTTL: readNumber(env.GITHUB_CACHE_TTL_MS, 15 * 60_000),
    githubToken: env.GITHUB_TOKEN,
    spotifyClientId: env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: env.SPOTIFY_CLIENT_SECRET,
    spotifyRefreshToken: env.SPOTIFY_REFRESH_TOKEN,
  };
}
