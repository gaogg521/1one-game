#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, run_output


def main() -> None:
    repo = deploy_repo()
    port = deploy_app_port()
    client = connect()
    for cmd in [
        f"cd {repo} && git log -1 --oneline",
        f"curl -sf http://127.0.0.1:{port}/api/health",
    ]:
        _, out = run_output(client, cmd)
        print(out)
    client.close()


if __name__ == "__main__":
    main()
