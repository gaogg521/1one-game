#!/usr/bin/env python3
"""Quick prod asset inventory."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_repo, print_target, run_output


def main() -> int:
    repo = deploy_repo()
    print_target("check assets")
    client = connect()
    checks = [
        f"ls {repo}/public/game-sprites 2>/dev/null | grep -c '^sample-' || echo 0",
        f"ls {repo}/public/game-bg/sample-*.png 2>/dev/null | wc -l",
        f"ls {repo}/public/samples 2>/dev/null | wc -l",
        f"du -sh {repo}/public/game-sprites {repo}/public/game-bg {repo}/public/covers 2>/dev/null",
        f"sqlite3 {repo}/prisma/prod.db \"SELECT COUNT(*) FROM Project WHERE id LIKE 'sample-%';\"",
        f"sqlite3 {repo}/prisma/prod.db \"SELECT COUNT(*) FROM Project WHERE coverPath LIKE '/covers/%';\"",
        f"sqlite3 {repo}/prisma/prod.db \"SELECT COUNT(*) FROM Project;\"",
    ]
    for cmd in checks:
        _, out = run_output(client, cmd)
        print(out)
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
