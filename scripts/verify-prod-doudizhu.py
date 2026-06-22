#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, print_target, run_output


def main() -> int:
    repo = deploy_repo()
    port = deploy_app_port()
    print_target("verify dou-dizhu sample")
    client = connect()
    checks = [
        f"sqlite3 {repo}/prisma/prod.db \"SELECT id, title, coverPath FROM Project WHERE id='sample-dou-dizhu';\"",
        f"test -f {repo}/public/samples/dou-dizhu.jpg && echo cover_ok",
        f"test -d {repo}/public/game-sprites/sample-dou-dizhu && ls {repo}/public/game-sprites/sample-dou-dizhu | wc -l",
        f"test -f {repo}/public/game-bg/sample-dou-dizhu.png && echo bg_ok",
        (
            f"curl -sf http://127.0.0.1:{port}/api/samples | python3 -c "
            "\"import sys,json; d=json.load(sys.stdin); ids=[x.get('id') for x in d.get('samples',[])]; "
            "print('dou-dizhu' in ids, len(ids))\""
        ),
    ]
    for cmd in checks:
        _, out = run_output(client, cmd)
        print(out)
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
