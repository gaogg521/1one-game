#!/usr/bin/env python3
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
    _, o, e = client.exec_command(cmd, timeout=60)
    return (o.read() + e.read()).decode("utf-8", "replace").strip()


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, "root", load_password(), timeout=30, allow_agent=False, look_for_keys=False)
    checks = [
        f"sqlite3 {REPO}/prisma/prod.db \"SELECT id, title, coverPath FROM Project WHERE id='sample-dou-dizhu';\"",
        f"test -f {REPO}/public/samples/dou-dizhu.jpg && echo cover_ok",
        f"test -d {REPO}/public/game-sprites/sample-dou-dizhu && ls {REPO}/public/game-sprites/sample-dou-dizhu | wc -l",
        f"test -f {REPO}/public/game-bg/sample-dou-dizhu.png && echo bg_ok",
        "curl -sf http://127.0.0.1:80/api/samples | python3 -c \"import sys,json; d=json.load(sys.stdin); ids=[x.get('id') for x in d.get('samples',[])]; print('dou-dizhu' in ids, len(ids))\"",
    ]
    for cmd in checks:
        print(run(client, cmd))
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
