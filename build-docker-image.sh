#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_TAG="${1:-pulse:latest}"

cd "$SCRIPT_DIR"

docker build -t "$IMAGE_TAG" .

printf 'built image %s\n' "$IMAGE_TAG"
