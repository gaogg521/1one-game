#!/usr/bin/env python3
"""Re-run literary sample import on production."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, run_output


def main() -> int:
    repo = deploy_repo()
    port = deploy_app_port()
    bundle = f"{repo}/data/literary-samples-bundle"
    client = connect()
    cmds = [
        f"cd {repo} && python3 scripts/import-literary-samples.py --in {bundle}",
        f"chown -R www-data:www-data {repo}/public {repo}/data",
        f"curl -sf 'http://127.0.0.1:{port}/api/novel?limit=2'",
        f"curl -sf 'http://127.0.0.1:{port}/api/comic?limit=2'",
    ]
    for cmd in cmds:
        print(">>>", cmd)
        code, out = run_output(client, cmd, timeout=120)
        if out:
            print(out)
        print(f"[exit {code}]")
        if code != 0 and "import-literary" in cmd:
            client.close()
            return code
    client.close()
    print("DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
