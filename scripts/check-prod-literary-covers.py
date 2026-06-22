#!/usr/bin/env python3
"""Audit novel/comic cover files on production."""
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


def run(client, cmd, timeout=120):
    _, o, e = client.exec_command(cmd, timeout=timeout)
    return (o.read() + e.read()).decode("utf-8", "replace").strip()


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, "root", load_password(), timeout=30, allow_agent=False, look_for_keys=False)

    checks = [
        f"sqlite3 {REPO}/prisma/prod.db \"SELECT COUNT(*) FROM Novel;\"",
        f"sqlite3 {REPO}/prisma/prod.db \"SELECT COUNT(*) FROM Comic;\"",
        f"sqlite3 {REPO}/prisma/prod.db \"SELECT COUNT(*) FROM Novel WHERE coverPath IS NOT NULL AND coverPath != '';\"",
        f"sqlite3 {REPO}/prisma/prod.db \"SELECT COUNT(*) FROM Comic WHERE coverPath IS NOT NULL AND coverPath != '';\"",
        f"ls {REPO}/public/covers 2>/dev/null | wc -l",
        f"du -sh {REPO}/public/covers 2>/dev/null",
        f"sqlite3 {REPO}/prisma/prod.db \"SELECT id, substr(title,1,30), coverPath FROM Novel LIMIT 8;\"",
        f"sqlite3 {REPO}/prisma/prod.db \"SELECT id, substr(title,1,30), coverPath FROM Comic LIMIT 8;\"",
    ]
    for cmd in checks:
        print(">>>", cmd.split("prod.db")[-1][:80])
        print(run(client, cmd))
        print()

    # check file existence for first few novels
    sample = run(
        client,
        f"sqlite3 {REPO}/prisma/prod.db \"SELECT coverPath FROM Novel WHERE coverPath LIKE '/covers/%' LIMIT 5;\"",
    )
    for rel in sample.splitlines():
        rel = rel.strip()
        if not rel:
            continue
        path = f"{REPO}/public{rel}"
        print(path, "=>", run(client, f"test -f {path} && echo OK || echo MISSING"))

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
