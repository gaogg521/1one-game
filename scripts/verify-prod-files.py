#!/usr/bin/env python3
"""Verify production has expected files from commit."""
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


def run(client, cmd, timeout=60):
    _, o, e = client.exec_command(cmd, timeout=timeout)
    out = (o.read() + e.read()).decode("utf-8", "replace").strip()
    return out, o.channel.recv_exit_status()


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, 22, "root", load_password(), timeout=30, allow_agent=False, look_for_keys=False)

    checks = [
        ("git log -1 --oneline", "commit"),
        ("test -f CONTEXT.md && wc -c < CONTEXT.md || echo MISSING", "CONTEXT.md bytes"),
        ("test -f src/components/CreateQuickStart.tsx && echo OK || echo MISSING", "CreateQuickStart"),
        ("test -f src/app/api/admin/referral-rewards/route.ts && echo OK || echo MISSING", "referral-rewards"),
        ("test -f src/components/admin/ReferralRewardsPanel.tsx && echo OK || echo MISSING", "ReferralRewardsPanel"),
        ("git ls-files public/ 2>/dev/null | wc -l", "tracked public count"),
        ("ls public/game-bgm/*.ogg 2>/dev/null | wc -l", "game-bgm ogg count"),
        ("ls public/samples 2>/dev/null | wc -l", "samples dir count"),
    ]
    print(f"REPO={REPO}\n")
    for cmd, label in checks:
        out, code = run(client, f"cd {REPO} && {cmd}")
        print(f"{label}: {out} [exit {code}]")

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
