#!/usr/bin/env python3
"""Post-deploy: prisma db push + seed samples on production."""
from __future__ import annotations

import re
import sys
from pathlib import Path

import paramiko

HOST = "43.163.105.71"
REPO = "/opt/operone"


def load_password() -> str:
    p = Path(__file__).parent / "upload-literary-samples-to-server.py"
    m = re.search(r'^PASSWORD\s*=\s*"([^"]*)"', p.read_text(encoding="utf-8"), re.M)
    return m.group(1) if m else sys.exit("no password")


def run(client, cmd, timeout=600):
    print("\n>>>", cmd[:200])
    _, o, e = client.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    text = (out + err).strip()
    if text:
        print(text[-4000:])
    print(f"[exit {code}]")
    return code


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, "root", load_password(), timeout=30, allow_agent=False, look_for_keys=False)
    for cmd in [
        (
            f"cd {REPO} && sqlite3 prisma/prod.db "
            "\"ALTER TABLE Project ADD COLUMN bgmNotesJson TEXT;\" 2>/dev/null || true"
        ),
        f"cd {REPO} && set -a && . ./.env && set +a && npm run seed:samples",
        "curl -sf http://127.0.0.1:80/api/health",
    ]:
        if run(client, cmd) != 0 and "seed" not in cmd:
            client.close()
            return 1
    client.close()
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
