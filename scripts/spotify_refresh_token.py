#!/usr/bin/env python3

import argparse
import base64
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path


AUTHORIZE_URL = "https://accounts.spotify.com/authorize"
TOKEN_URL = "https://accounts.spotify.com/api/token"
DEFAULT_SCOPE = "user-read-currently-playing user-read-recently-played"
DEFAULT_ENV_PATH = ".env"
DEFAULT_REDIRECT_URI = "http://127.0.0.1:8898/callback"


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        raise FileNotFoundError(f"env file not found: {path}")

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

    return values


def update_env(path: Path, key: str, value: str) -> None:
    lines = path.read_text().splitlines()
    updated = False
    output: list[str] = []

    for line in lines:
        if line.startswith(f"{key}="):
            output.append(f"{key}={value}")
            updated = True
        else:
            output.append(line)

    if not updated:
        output.append(f"{key}={value}")

    path.write_text("\n".join(output) + "\n")


def build_authorize_url(client_id: str, redirect_uri: str, scope: str) -> str:
    query = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": scope,
        }
    )
    return f"{AUTHORIZE_URL}?{query}"


def exchange_code(
    client_id: str, client_secret: str, redirect_uri: str, code: str
) -> dict:
    auth = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode(
        "utf-8"
    )
    payload = urllib.parse.urlencode(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        TOKEN_URL,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )

    with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="generate or exchange spotify oauth codes using values from a .env file",
    )
    parser.add_argument(
        "--env-file", default=DEFAULT_ENV_PATH, help="path to .env file"
    )
    parser.add_argument("--code", help="authorization code returned by spotify")
    parser.add_argument("--scope", default=DEFAULT_SCOPE, help="spotify oauth scopes")
    parser.add_argument(
        "--write-env",
        action="store_true",
        help="write the returned refresh token back to SPOTIFY_REFRESH_TOKEN in the env file",
    )
    args = parser.parse_args()

    env_path = Path(args.env_file)

    try:
        env = load_env(env_path)
    except FileNotFoundError as error:
        print(str(error), file=sys.stderr)
        return 1

    client_id = env.get("SPOTIFY_CLIENT_ID", "")
    client_secret = env.get("SPOTIFY_CLIENT_SECRET", "")
    redirect_uri = env.get("SPOTIFY_REDIRECT_URI", DEFAULT_REDIRECT_URI)

    if not client_id or not client_secret:
        print(
            "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in the env file",
            file=sys.stderr,
        )
        return 1

    if not args.code:
        url = build_authorize_url(client_id, redirect_uri, args.scope)
        print(
            "open this url in your browser, approve the app, then rerun with --code=<spotify_code>\n"
        )
        print(url)
        return 0

    try:
        payload = exchange_code(client_id, client_secret, redirect_uri, args.code)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(
            f"spotify token exchange failed: {error.code} {error.reason}",
            file=sys.stderr,
        )
        print(body, file=sys.stderr)
        return 1

    refresh_token = payload.get("refresh_token")
    access_token = payload.get("access_token")

    print(json.dumps(payload, indent=2))

    if refresh_token:
        print("\nrefresh token acquired successfully.")
        if args.write_env:
            update_env(env_path, "SPOTIFY_REFRESH_TOKEN", refresh_token)
            print(f"wrote SPOTIFY_REFRESH_TOKEN to {env_path}")
    else:
        print(
            "\nno refresh token returned. generate a fresh auth code and try again.",
            file=sys.stderr,
        )
        return 1

    if access_token:
        os.environ["SPOTIFY_ACCESS_TOKEN"] = access_token

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
