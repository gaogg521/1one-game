#!/usr/bin/env python3
"""Pull latest + set PORT + build + restart on production."""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import paramiko

HOST = "43.163.105.71"
USER = "root"
REPO = "/opt/operone"
DEFAULT_PORT = os.environ.get("OPERONE_PORT", "6666")


def load_password() -> str:
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
    port = DEFAULT_PORT
    pw = load_password()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, USER, pw, timeout=30, allow_agent=False, look_for_keys=False)

    steps = [
        f"cd {REPO} && git fetch origin && git reset --hard origin/main && git log -1 --oneline",
        # 样品 sprite/bg 已入库 public/，随 git 同步；生产机 sharp 不可用，勿跑 seed:sample-assets
        f"cd {REPO} && (grep -q '^PORT=' .env && sed -i 's|^PORT=.*|PORT={port}|' .env || echo 'PORT={port}' >> .env)",
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
        f"curl -sf http://127.0.0.1:{port}/api/health",
    ]
    for i, cmd in enumerate(steps):
        code = run(client, cmd)
        if code != 0:
            client.close()
            return code if i < len(steps) - 1 else 1

    client.close()
    print(f"\nDEPLOY_OK @ http://{HOST}:{port}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
