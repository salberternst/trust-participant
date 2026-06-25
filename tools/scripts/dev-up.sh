#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

if [[ -z "${ENV_FILE:-}" ]]; then
  if [[ -f .env ]]; then
    ENV_FILE=.env
  else
    ENV_FILE=.env.example
  fi
fi

export DEV_ONBOARDING_AUTO_SUBMIT="${DEV_ONBOARDING_AUTO_SUBMIT:-false}"

docker compose \
  --env-file "${ENV_FILE}" \
  -f compose.yaml \
  -f dev/compose.hot-reload.yaml \
  up -d "$@"

cat <<MSG

Trust participant dev stack is starting.

Hot-reload portal gate: http://localhost:${PORTAL_GATEWAY_VITE_HOST_PORT:-5174}
Internal gateway:        http://localhost:${INTERNAL_HTTP_HOST_PORT:-8081}
Gateway API:             http://localhost:${PORTAL_GATEWAY_API_HOST_PORT:-3000}

Use DEV_ONBOARDING_AUTO_SUBMIT=true when a dataspace-admin API is reachable.
MSG
