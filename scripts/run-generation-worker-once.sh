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
# Measured on production 2026-09-07: one game_production job runs design (178s)
# plus code modules in parallel where the slowest single module took ~587s on
# the configured game_text model -- 765s of critical path before QA, repair or
# art. The old 640s ceiling therefore killed EVERY such job at exactly 640s
# while the request handler kept working orphaned in the background, so the job
# could never reach completeGenerationJob no matter how many times it retried:
# three attempts, three identical deaths at the same wall, then permanent
# failure. Local runs never hit this because they call forgeGame directly with
# no worker and no curl.
#
# Independent timer slots consume the queue concurrently; the database caps
# active jobs and excludes another job from the same project. The API gives
# each attempt a unique worker token and renews its lease through every stage.
exec /usr/bin/curl \
  --fail --silent --show-error --connect-timeout 10 --max-time "${GENERATION_WORKER_MAX_SECONDS:-1500}" \
  --request POST "http://127.0.0.1:${PORT}/api/jobs/worker" \
  --header "x-job-worker-secret: ${JOB_WORKER_SECRET}" \
  --header "x-worker-id: systemd-generation-worker"
