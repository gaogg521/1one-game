#!/usr/bin/env python3
"""Install sqlite, add bgmNotesJson, seed samples on production."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, print_target, run, run_output


def main() -> int:
    repo = deploy_repo()
    port = deploy_app_port()
    print_target("seed samples")
    client = connect()
    steps = [
        "dnf install -y sqlite",
        f"cd {repo} && sqlite3 prisma/prod.db \"ALTER TABLE Project ADD COLUMN bgmNotesJson TEXT;\" 2>/dev/null || true",
        f"cd {repo} && set -a && . ./.env && set +a && npm run seed:samples",
        "systemctl restart operone",
        "sleep 8",
        f"curl -sf http://127.0.0.1:{port}/api/health",
        f"curl -sf http://127.0.0.1:{port}/api/discover",
    ]
    for cmd in steps:
        if "seed:samples" in cmd:
            if run(client, cmd, timeout=900) != 0:
                client.close()
                return 1
        else:
            code, out = run_output(client, cmd, timeout=900)
            if "curl" in cmd and code != 0:
                client.close()
                return code
            if "discover" in cmd and out:
                print(out[:400])
    client.close()
    print("SEED_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
