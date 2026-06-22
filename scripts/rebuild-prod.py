#!/usr/bin/env python3
"""Regenerate Prisma client and rebuild on production."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_repo, print_target, run


def main() -> int:
    repo = deploy_repo()
    print_target("prisma generate + build")
    client = connect()
    inner = (
        "export PATH=/usr/local/bin:/usr/bin:/bin; "
        "export HOME=/opt/operone NPM_CONFIG_CACHE=/opt/operone/.npm-cache; "
        f"cd {repo} && npx prisma generate && npm run build"
    )
    steps = [
        f"runuser -u www-data -- bash -lc {inner!r}",
        "systemctl restart operone",
        "sleep 10",
        "curl -sf http://127.0.0.1:80/api/health",
    ]
    for cmd in steps:
        if run(client, cmd, timeout=7200) != 0:
            run(client, "journalctl -u operone -n 25 --no-pager", timeout=30)
            client.close()
            return 1
    client.close()
    print("REBUILD_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
