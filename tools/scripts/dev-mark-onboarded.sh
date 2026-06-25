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

docker compose \
  --env-file "${ENV_FILE}" \
  -f compose.yaml \
  -f dev/compose.hot-reload.yaml \
  exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d participant_onboarding -c "INSERT INTO onboarding_state (id,state) VALUES ('"'"'default'"'"','"'"'ONBOARDED'"'"') ON CONFLICT (id) DO UPDATE SET state='"'"'ONBOARDED'"'"', last_error=NULL, updated_at=now();"'

echo "Marked the local participant onboarding state as ONBOARDED."
