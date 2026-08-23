#!/usr/bin/env bash
# Consume one durable creator-generation job through the local Next runtime.
# This is invoked by the systemd timer, never by a browser or public proxy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[generation-worker] missing ${ENV_FILE}" >&2
  exit 1
fi

# Production deploy already requires shell-compatible .env values. Strip CRLF
# here too so a Windows-edited env file cannot silently stop the worker.
set -a
# shellcheck disable=SC1090
source <(sed 's/\r$//' "${ENV_FILE}")
set +a

if [[ -z "${JOB_WORKER_SECRET:-}" ]]; then
  echo "[generation-worker] JOB_WORKER_SECRET is not configured" >&2
  exit 1
fi

PORT="${PORT:-80}"
exec /usr/bin/curl \
  --fail --silent --show-error --connect-timeout 10 --max-time 640 \
  --request POST "http://127.0.0.1:${PORT}/api/jobs/worker" \
  --header "x-job-worker-secret: ${JOB_WORKER_SECRET}" \
  --header "x-worker-id: systemd-generation-worker"
