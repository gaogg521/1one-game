#!/usr/bin/env python3
"""Audit novel/comic cover files on production."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_repo, print_target, run_output


def main() -> int:
    repo = deploy_repo()
    print_target("check literary covers")
    client = connect()

    checks = [
        f"sqlite3 {repo}/prisma/prod.db \"SELECT COUNT(*) FROM Novel;\"",
        f"sqlite3 {repo}/prisma/prod.db \"SELECT COUNT(*) FROM Comic;\"",
        f"sqlite3 {repo}/prisma/prod.db \"SELECT COUNT(*) FROM Novel WHERE coverPath IS NOT NULL AND coverPath != '';\"",
        f"sqlite3 {repo}/prisma/prod.db \"SELECT COUNT(*) FROM Comic WHERE coverPath IS NOT NULL AND coverPath != '';\"",
        f"ls {repo}/public/covers 2>/dev/null | wc -l",
        f"du -sh {repo}/public/covers 2>/dev/null",
        f"sqlite3 {repo}/prisma/prod.db \"SELECT id, substr(title,1,30), coverPath FROM Novel LIMIT 8;\"",
        f"sqlite3 {repo}/prisma/prod.db \"SELECT id, substr(title,1,30), coverPath FROM Comic LIMIT 8;\"",
    ]
    for cmd in checks:
        print(">>>", cmd.split("prod.db")[-1][:80])
        _, out = run_output(client, cmd)
        print(out)
        print()

    _, sample = run_output(
        client,
        f"sqlite3 {repo}/prisma/prod.db \"SELECT coverPath FROM Novel WHERE coverPath LIKE '/covers/%' LIMIT 5;\"",
    )
    for rel in sample.splitlines():
        rel = rel.strip()
        if not rel:
            continue
        path = f"{repo}/public{rel}"
        _, status = run_output(client, f"test -f {path} && echo OK || echo MISSING")
        print(path, "=>", status.splitlines()[-1] if status else "?")

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
