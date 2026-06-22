#!/usr/bin/env python3
"""Post-deploy: prisma db push + seed samples on production."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, print_target, run


def main() -> int:
    repo = deploy_repo()
    port = deploy_app_port()
    print_target("db push + seed")
    client = connect()
    for cmd in [
        (
            f"cd {repo} && sqlite3 prisma/prod.db "
            "\"ALTER TABLE Project ADD COLUMN bgmNotesJson TEXT;\" 2>/dev/null || true"
        ),
        f"cd {repo} && set -a && . ./.env && set +a && npm run seed:samples",
        f"curl -sf http://127.0.0.1:{port}/api/health",
    ]:
        if run(client, cmd) != 0 and "seed" not in cmd:
            client.close()
            return 1
    client.close()
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
