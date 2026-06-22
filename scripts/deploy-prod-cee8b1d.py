#!/usr/bin/env python3
"""Deploy origin/main to production with migrate + seed.

After this script, also run from local dev machine (assets are NOT in git):
  python scripts/sync-sample-assets-to-prod.py
  python scripts/sync-literary-covers-to-prod.py
Or use the all-in-one wrapper:
  python scripts/deploy-prod-with-assets.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import paramiko

HOST = "43.163.105.71"
USER = "root"
REPO = "/opt/operone"
PORT = "80"


def load_password() -> str:
    if pw := __import__("os").environ.get("OPERONE_DEPLOY_PASSWORD"):
        return pw
    p = Path(__file__).parent / "upload-literary-samples-to-server.py"
    m = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', p.read_text(encoding="utf-8"), re.M)
    if not m:
        sys.exit("Set OPERONE_DEPLOY_PASSWORD")
    return m.group(1)


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 3600) -> int:
    print("\n>>>", cmd[:240])
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    combined = (out + err).strip()
    if combined:
        print(combined[-8000:])
    print(f"[exit {code}]")
    return code


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, USER, load_password(), timeout=30, allow_agent=False, look_for_keys=False)

    steps = [
        f"cd {REPO} && git fetch origin && git reset --hard origin/main && git log -1 --oneline",
        f"cd {REPO} && (grep -q '^PORT=' .env && sed -i 's|^PORT=.*|PORT={PORT}|' .env || echo 'PORT={PORT}' >> .env)",
        f"cd {REPO} && set -a && . ./.env && set +a && npx prisma migrate deploy",
        f"cd {REPO} && HOME={REPO} NPM_CONFIG_CACHE={REPO}/.npm-cache npm install --no-audit --no-fund",
        f"cd {REPO} && HOME={REPO} npx prisma generate",
        (
            "python3 - <<'PY'\n"
            f"p = __import__('pathlib').Path('{REPO}') / 'node_modules/@parcel/watcher/index.js'\n"
            "if p.is_file():\n"
            "    p.write_text("
            "'\"use strict\";\\nconst noop=async()=>{};\\nconst emptySub=async()=>({unsubscribe:noop});\\n"
            "exports.subscribe=emptySub;\\nexports.unsubscribe=noop;\\n"
            "exports.writeSnapshot=async()=>\"\";\\nexports.getEventsSince=async()=>[];\\n', "
            "encoding='utf-8')\n"
            "    print('stubbed parcel watcher')\n"
            "PY"
        ),
        f"cd {REPO} && HOME={REPO} NODE_OPTIONS='--max-old-space-size=2560' npm run build",
        f"cd {REPO} && set -a && . ./.env && set +a && npm run seed:samples",
        "systemctl restart operone || true",
        "sleep 6",
        f"curl -sf http://127.0.0.1:{PORT}/api/health",
    ]

    for i, cmd in enumerate(steps):
        code = run(client, cmd)
        if code != 0 and i != len(steps) - 1:
            client.close()
            return code

    client.close()
    print(f"\nDEPLOY_OK @ http://operone.1oneclaw.com commit 65dde825+")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
