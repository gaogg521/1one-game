#!/usr/bin/env python3
"""Test production login API (credentials via env only).

Set before run:
  OPERONE_TEST_ACCOUNT
  OPERONE_TEST_PASSWORD
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, run_output


def main() -> int:
    account = os.environ.get("OPERONE_TEST_ACCOUNT", "").strip()
    password = os.environ.get("OPERONE_TEST_PASSWORD", "").strip()
    if not account or not password:
        print("Set OPERONE_TEST_ACCOUNT and OPERONE_TEST_PASSWORD", file=sys.stderr)
        return 1

    repo = deploy_repo()
    port = deploy_app_port()
    client = connect()
    cmds = [
        f"sqlite3 {repo}/prisma/prod.db \"SELECT id, username, role FROM User LIMIT 10;\"",
        (
            f"curl -sS -m 20 -w '\\nHTTP:%{{http_code}}\\n' -X POST http://127.0.0.1:{port}/api/auth/login "
            f"-H 'Content-Type: application/json' "
            f"-d '{{\"account\":\"{account}\",\"password\":\"{password}\"}}'"
        ),
    ]
    for cmd in cmds:
        print(">>>", cmd[:100])
        _, out = run_output(client, cmd)
        print(out[:2000])
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
