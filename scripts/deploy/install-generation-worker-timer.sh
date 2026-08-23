#!/usr/bin/env bash
# Install an idempotent, one-job-at-a-time consumer for GenerationJob.
# It deliberately calls loopback only; the worker credential never crosses the
# public reverse proxy or appears in unit files/journal output.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT}/.env"
APP_USER="${OPERONE_USER:-www-data}"

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
TimeoutStartSec=650
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
systemctl start operone-generation-worker.service || true
systemctl is-active --quiet operone-generation-worker.timer
echo "[generation-worker] timer active"
