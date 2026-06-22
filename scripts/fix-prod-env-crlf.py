#!/usr/bin/env python3
"""Fix .env CRLF on server and restart operone."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_repo, print_target, run, run_output


def main() -> int:
    repo = deploy_repo()
    print_target("fix .env CRLF")
    client = connect()
    steps = [
        f"sed -i 's/\\r$//' {repo}/.env",
        f"grep '^DATABASE_URL' {repo}/.env",
        "systemctl restart operone",
        "sleep 8",
        "systemctl is-active operone",
        "curl -sf http://127.0.0.1:80/api/health",
    ]
    for cmd in steps:
        code, out = run_output(client, cmd, timeout=60)
        if "curl" in cmd and code != 0:
            run_output(client, "journalctl -u operone -n 40 --no-pager", timeout=30)
            client.close()
            return 1
    client.close()
    print("SERVICE_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
