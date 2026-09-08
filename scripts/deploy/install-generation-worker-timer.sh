#!/usr/bin/env bash
# Install an idempotent, one-job-at-a-time consumer for GenerationJob.
# It deliberately calls loopback only; the worker credential never crosses the
# public reverse proxy or appears in unit files/journal output.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/.env"
APP_USER="${OPERONE_USER:-www-data}"
secret_initialized=0

if [[ "${EUID}" -ne 0 ]]; then
  echo "install-generation-worker-timer.sh requires root" >&2
  exit 1
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "missing ${ENV_FILE}" >&2
  exit 1
fi

sed -i 's/\r$//' "${ENV_FILE}"
if ! grep -q '^JOB_WORKER_SECRET=[^[:space:]]' "${ENV_FILE}"; then
  secret="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)"
  printf '\nJOB_WORKER_SECRET=%s\n' "${secret}" >> "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  chown "${APP_USER}:${APP_USER}" "${ENV_FILE}" 2>/dev/null || true
  secret_initialized=1
  echo "[generation-worker] JOB_WORKER_SECRET initialized"
fi

cat > /etc/systemd/system/operone-generation-worker.service <<EOF
[Unit]
Description=Operone durable generation worker (one job)
After=operone.service
Requires=operone.service

[Service]
Type=oneshot
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${ROOT}
ExecStart=/bin/bash ${ROOT}/scripts/run-generation-worker-once.sh
# Must stay above the curl --max-time in run-generation-worker-once.sh
# (default 1500s), or systemd kills the worker before curl can return the
# job's own result. See that script for why 640s was too low.
TimeoutStartSec=1520
NoNewPrivileges=true
PrivateTmp=true
EOF

cat > /etc/systemd/system/operone-generation-worker.timer <<'EOF'
[Unit]
Description=Poll Operone durable generation queue

[Timer]
OnBootSec=20
OnUnitInactiveSec=15
Unit=operone-generation-worker.service
Persistent=true

[Install]
WantedBy=timers.target
EOF

chmod 750 "${ROOT}/scripts/run-generation-worker-once.sh"
chown "${APP_USER}:${APP_USER}" "${ROOT}/scripts/run-generation-worker-once.sh" 2>/dev/null || true
systemctl daemon-reload
systemctl enable --now operone-generation-worker.timer
if [[ "${secret_initialized}" == "1" ]]; then
  # The web runtime read its environment before this first secret existed.
  # Restart it once so the loopback worker and route share the same secret.
  systemctl restart operone
  sleep 3
fi
# Independent slots: a short job can finish and claim again while slot 1 is busy.
# Keep the original unit name for existing health checks. The application also
# enforces the configured global limit and project exclusivity in its DB claim.
for slot in 2 3 4; do
  sed "s/worker (one job)/worker (slot ${slot})/" /etc/systemd/system/operone-generation-worker.service > "/etc/systemd/system/operone-generation-worker-${slot}.service"
  sed "s/operone-generation-worker.service/operone-generation-worker-${slot}.service/" /etc/systemd/system/operone-generation-worker.timer > "/etc/systemd/system/operone-generation-worker-${slot}.timer"
done
concurrency="$(sed -n 's/^GENERATION_WORKER_CONCURRENCY=//p' "${ENV_FILE}" | tail -1 | tr -d '\"\r')"
concurrency="${concurrency:-2}"
if [[ ! "${concurrency}" =~ ^[1-4]$ ]]; then
  echo "GENERATION_WORKER_CONCURRENCY must be 1..4" >&2
  exit 1
fi
systemctl daemon-reload
for slot in 2 3 4; do
  if (( slot <= concurrency )); then
    systemctl enable --now "operone-generation-worker-${slot}.timer"
  else
    systemctl disable --now "operone-generation-worker-${slot}.timer"
  fi
done
systemctl start --no-block operone-generation-worker.service
systemctl is-active --quiet operone-generation-worker.timer
echo "[generation-worker] timer active"
