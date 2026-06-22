#!/usr/bin/env python3
"""Check prod DB for super admin and test login API."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, run_output


def main() -> int:
    repo = deploy_repo()
    port = deploy_app_port()
    client = connect()
    cmds = [
        f"sqlite3 {repo}/prisma/prod.db \"SELECT id, username, email, role, length(passwordHash) as ph FROM User WHERE role='super_admin' LIMIT 5;\"",
        f"sqlite3 {repo}/prisma/prod.db \"SELECT COUNT(*) FROM User;\"",
        (
            f"curl -sS -m 15 -w '\\nHTTP_CODE:%{{http_code}}\\n' -X POST http://127.0.0.1:{port}/api/auth/login "
            "-H 'Content-Type: application/json' -d '{\"identifier\":\"test\",\"password\":\"wrong-password-test\"}'"
        ),
        "journalctl -u operone -n 30 --no-pager 2>/dev/null | tail -20",
    ]
    for cmd in cmds:
        print(">>>", cmd[:120])
        code, out = run_output(client, cmd, timeout=60)
        if out:
            print(out[:8000])
        print(f"[exit {code}]\n")
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
