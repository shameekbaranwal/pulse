# pulse — claude code context

## overview

`pulse` is a small bun + typescript service for dynamic personal-site widgets. it exists so the blog can stay static while still showing live-ish data like spotify now playing and github contributions.

## responsibilities

- keep all third-party secrets server-side
- fetch and normalize upstream data from spotify and github
- add time-based caching to avoid hammering upstream apis
- rate limit incoming requests to reduce abuse
- expose simple json endpoints for the blog frontend
- stay ready for future widget sources like duolingo and letterboxd

## non-goals

- do not render html for the blog
- do not couple this service to astro runtime behavior
- do not move blog content or page logic here

## current endpoints

- `GET /health`
- `GET /api/v1/widgets/spotify/now-playing`
- `GET /api/v1/widgets/github/contributions?username=<user>&days=<n>`
- keep legacy aliases working when practical if the blog already depends on them

## response shape guidance

- keep responses small and stable
- wrapped json is preferred for clarity:
- spotify: `{ "data": { "track": ... }, "meta": ... }`
- github: `{ "data": { "graph": ... }, "meta": ... }`
- return `null` payloads on temporary upstream failure when possible, instead of throwing uncaught errors

## caching guidance

- spotify should be short-lived: around `30-60s`
- github contributions can be longer-lived: around `15-60m`
- use cache headers so a reverse proxy/cdn can help absorb traffic
- stale data is preferable to upstream rate-limit failures for these widgets

## rate limiting + abuse handling

- keep lightweight per-ip rate limiting in the service
- assume this may sit behind nginx proxy manager or another reverse proxy, so prefer `x-forwarded-for` when present
- if stronger protection is needed later, add proxy-level limits in front of the service rather than making app logic complex

## environment

required or useful env vars live in `.env.example`.

## local development

```bash
cp .env.example .env
bun install
bun run dev
```

## implementation preferences

- keep this service dependency-light
- prefer straightforward fetch + transform code over abstractions
- keep endpoint logic modular: config, providers, caching, rate limiting, and server wiring should be separate files when that improves clarity
- favor explicit constants for ttl values, route paths, and upstream urls
- return graceful fallbacks instead of brittle failures
- add tests for caching, endpoint behavior, and rate limiting whenever behavior changes

## integration with the blog

- the blog should only know `PUBLIC_STATUS_API_BASE_URL`
- the blog should fetch these endpoints client-side
- the blog should render fallback states if pulse is unavailable
- changes here should not require switching the blog away from static output
