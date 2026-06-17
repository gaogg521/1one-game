#!/usr/bin/env python3
"""Fix production port 80: resolve real node binary, setcap, restart, verify."""
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
    import os

    if os.environ.get("OPERONE_DEPLOY_PASSWORD"):
        return os.environ["OPERONE_DEPLOY_PASSWORD"]
    p = Path(__file__).parent / "upload-literary-samples-to-server.py"
    m = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', p.read_text(encoding="utf-8"), re.M)
    if not m:
        sys.exit("no password")
    return m.group(1)


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str]:
    print("\n>>>", cmd)
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    combined = (out + err).strip()
    if combined:
        print(combined[-4000:])
    print(f"[exit {code}]")
    return code, combined


def main() -> int:
    pw = load_password()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, USER, pw, timeout=30, allow_agent=False, look_for_keys=False)

    steps = [
        f"cd {REPO} && (grep -q '^PORT=' .env && sed -i 's|^PORT=.*|PORT={PORT}|' .env || echo 'PORT={PORT}' >> .env) && grep '^PORT=' .env",
        "readlink -f $(command -v node)",
        'NODE_REAL=$(readlink -f $(command -v node)) && setcap cap_net_bind_service+ep "$NODE_REAL" && getcap "$NODE_REAL"',
        "systemctl stop nginx 2>/dev/null || true",
        "systemctl restart operone",
        "sleep 5",
        "systemctl is-active operone",
        "journalctl -u operone -n 25 --no-pager",
        "ss -tln | grep -E ':80 |:6666 |:8080 ' || true",
        f"curl -sf http://127.0.0.1:{PORT}/api/health",
    ]
    for cmd in steps:
        code, _ = run(client, cmd)
        if code != 0 and "curl" in cmd:
            client.close()
            return code

    client.close()
    print("\nOK http://operone.1oneclaw.com/zh-Hans/create")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
