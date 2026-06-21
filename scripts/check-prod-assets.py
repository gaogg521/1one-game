#!/usr/bin/env python3
"""Quick prod asset inventory."""
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


def run(client, cmd):
    _, o, e = client.exec_command(cmd, timeout=120)
    return (o.read() + e.read()).decode("utf-8", "replace").strip()


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, "root", load_password(), timeout=30, allow_agent=False, look_for_keys=False)

    checks = [
        f"ls {REPO}/public/game-sprites 2>/dev/null | grep -c '^sample-' || echo 0",
        f"ls {REPO}/public/game-bg/sample-*.png 2>/dev/null | wc -l",
        f"ls {REPO}/public/samples 2>/dev/null | wc -l",
        f"du -sh {REPO}/public/game-sprites {REPO}/public/game-bg {REPO}/public/covers 2>/dev/null",
        f"sqlite3 {REPO}/prisma/prod.db \"SELECT COUNT(*) FROM Project WHERE id LIKE 'sample-%';\"",
        f"sqlite3 {REPO}/prisma/prod.db \"SELECT COUNT(*) FROM Project WHERE coverPath LIKE '/covers/%';\"",
        f"sqlite3 {REPO}/prisma/prod.db \"SELECT COUNT(*) FROM Project;\"",
    ]
    for cmd in checks:
        print(run(client, cmd))

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
