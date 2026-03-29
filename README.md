# pulse

small bun + typescript service for dynamic homepage widgets used by `blog.shmk.dev`.

it keeps the blog static while serving live-ish data for spotify, github, and future widgets like duolingo or letterboxd.

## endpoints

- `GET /health`
- `GET /api/v1/widgets/spotify/now-playing`
- `GET /api/v1/widgets/github/contributions?username=shameekbaranwal&days=90`

legacy aliases are still supported:

- `GET /api/spotify/now-playing`
- `GET /api/github/contributions?username=shameekbaranwal&days=90`

## behavior

- keeps secrets server-side only
- adds cors for the blog origin
- caches spotify for 30s
- caches github contributions for 15m
- rate limits by ip to reduce abuse
- returns stable `data` + `meta` payloads

## code layout

- `src/index.ts` - service entrypoint
- `src/config.ts` - env parsing and defaults
- `src/server.ts` - route wiring, caching, and response handling
- `src/providers/spotify.ts` - spotify api integration
- `src/providers/github.ts` - github graphql integration
- `src/cache.ts` - in-memory ttl cache
- `src/rate-limit.ts` - in-memory rate limiting
- `src/*.test.ts` - endpoint and cache tests

## local development

```bash
cp .env.example .env
bun install
bun run dev
```

## docker

run with docker compose:

```bash
cp .env.example .env
docker compose up --build
```

service will be available at `http://localhost:4010`.

## tests + checks

```bash
bun test
bun run check
```

## setup

```bash
cp .env.example .env
bun install
bun run dev
```

## env vars

- `PORT` - service port, default `4010`
- `ALLOWED_ORIGIN` - blog origin allowed by cors
- `GITHUB_TOKEN` - github personal access token
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI` - used by the helper script for oauth, defaults to `http://127.0.0.1:8898/callback`
- `SPOTIFY_REFRESH_TOKEN`

## creating tokens

### github token

`pulse` uses the github graphql api for contribution data.

1. go to github -> settings -> developer settings -> personal access tokens.
2. create either:
   - a fine-grained token with access to your own account data, or
   - a classic token if you prefer the older flow.
3. for a classic token, `read:user` is the main scope to start with.
4. copy the token into `GITHUB_TOKEN` in `.env`.

after setting it, test with:

```bash
curl "http://localhost:4010/api/v1/widgets/github/contributions?username=shameekbaranwal&days=90"
```

### spotify credentials + refresh token

`pulse` uses spotify's oauth refresh-token flow.

1. go to the spotify developer dashboard: `https://developer.spotify.com/dashboard`.
2. create an app.
3. copy the app's client id and client secret into:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
4. add a redirect uri in the spotify app settings. for local use, something like `http://127.0.0.1:8898/callback` is fine.
5. easiest path: use the helper script.

```bash
python3 scripts/spotify_refresh_token.py
```

that prints the exact authorization url using your `.env` values.

6. open that url in your browser and approve the app.
7. after spotify redirects, copy the `code=...` value from the callback url and run:

```bash
python3 scripts/spotify_refresh_token.py --code '<spotify_code>' --write-env
```

this exchanges the code and writes `SPOTIFY_REFRESH_TOKEN` back into `.env`.

8. manual flow if you want it instead of the script:

```text
https://accounts.spotify.com/authorize?client_id=<client_id>&response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A8898%2Fcallback&scope=user-read-currently-playing%20user-read-recently-played
```

9. after approving, spotify redirects to your callback uri with `?code=...` in the url.
10. exchange that code for refresh/access tokens:

```bash
curl -X POST "https://accounts.spotify.com/api/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(printf "%s:%s" "$SPOTIFY_CLIENT_ID" "$SPOTIFY_CLIENT_SECRET" | base64)" \
  -d "grant_type=authorization_code" \
  -d "code=<authorization_code>" \
  -d "redirect_uri=http://127.0.0.1:8898/callback"
```

11. put the returned `refresh_token` into `SPOTIFY_REFRESH_TOKEN` in `.env` if you did not use `--write-env`.

after that, test with:

```bash
curl "http://localhost:4010/api/v1/widgets/spotify/now-playing"
```

notes:

- the refresh token is the important long-lived secret; the access token returned by spotify expires quickly.
- if spotify does not return a refresh token, create a fresh auth grant instead of reusing an already-approved one.

## response shapes

spotify:

```json
{
  "data": {
    "track": {
      "isPlaying": true,
      "title": "song",
      "artist": "artist",
      "album": "album",
      "url": "https://open.spotify.com/..."
    }
  },
  "meta": {
    "cached": false,
    "generatedAt": "2026-03-29T00:00:00.000Z",
    "ttlSeconds": 30
  }
}
```

github:

```json
{
  "data": {
    "graph": {
      "weeks": [],
      "totalContributions": 42
    },
    "username": "shameekbaranwal",
    "days": 90
  },
  "meta": {
    "cached": true,
    "generatedAt": "2026-03-29T00:00:00.000Z",
    "ttlSeconds": 900
  }
}
```

## frontend wiring

set `PUBLIC_STATUS_API_BASE_URL` in the blog repo to this service url, for example:

```bash
PUBLIC_STATUS_API_BASE_URL=https://pulse.shmk.dev
```

the blog currently calls the versioned widget endpoints and keeps a reusable client-side widget loader so future widgets can plug into the same pattern.
