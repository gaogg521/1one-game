#!/usr/bin/env python3
"""Pull latest + set PORT=3000 + run --update on production."""
from __future__ import annotations

import re
import sys
from pathlib import Path

import paramiko

HOST = "43.163.105.71"
USER = "root"
REPO = "/opt/operone"


def load_password() -> str:
    import os

    if os.environ.get("OPERONE_DEPLOY_PASSWORD"):
        return os.environ["OPERONE_DEPLOY_PASSWORD"]
    p = Path(__file__).parent / "upload-literary-samples-to-server.py"
    if p.is_file():
        m = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', p.read_text(encoding="utf-8"), re.M)
        if m:
            return m.group(1)
    print("Set OPERONE_DEPLOY_PASSWORD", file=sys.stderr)
    sys.exit(2)


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 3600) -> int:
    print("\n>>>", cmd[:240])
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    combined = (out + err).strip()
    if combined:
        print(combined[-5000:])
    print(f"[exit {code}]")
    return code


def main() -> int:
    pw = load_password()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, USER, pw, timeout=30, allow_agent=False, look_for_keys=False)

    steps = [
        f"cd {REPO} && git fetch origin main",
        f"cd {REPO} && git reset --hard origin/main",
        f"cd {REPO} && (grep -q '^PORT=' .env && sed -i 's|^PORT=.*|PORT=3000|' .env || echo 'PORT=3000' >> .env)",
        f"cd {REPO} && HOME={REPO} NPM_CONFIG_CACHE={REPO}/.npm-cache npm install --no-audit --no-fund --ignore-scripts",
        f"cd {REPO} && HOME={REPO} npx prisma generate",
        (
            "python3 - <<'PY'\n"
            "from pathlib import Path\n"
            f"p = Path('{REPO}') / 'node_modules/@parcel/watcher/index.js'\n"
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
        "systemctl restart operone || true",
        "sleep 5",
        "curl -sf http://127.0.0.1:3000/api/health",
    ]
    for i, cmd in enumerate(steps):
        code = run(client, cmd)
        if code != 0:
            client.close()
            return code if i < len(steps) - 1 else 1

    client.close()
    print("\nDEPLOY_OK @ http://43.163.105.71:3000")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
