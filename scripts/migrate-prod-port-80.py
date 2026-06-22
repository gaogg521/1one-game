#!/usr/bin/env python3
"""Fix production port 80: resolve real node binary, setcap, restart, verify."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prod_ssh import connect, deploy_app_port, deploy_repo, print_target, run, site_url


def main() -> int:
    repo = deploy_repo()
    port = deploy_app_port()
    print_target("migrate port 80")
    client = connect()
    steps = [
        f"cd {repo} && (grep -q '^PORT=' .env && sed -i 's|^PORT=.*|PORT={port}|' .env || echo 'PORT={port}' >> .env) && grep '^PORT=' .env",
        "readlink -f $(command -v node)",
        'NODE_REAL=$(readlink -f $(command -v node)) && setcap cap_net_bind_service+ep "$NODE_REAL" && getcap "$NODE_REAL"',
        "systemctl stop nginx 2>/dev/null || true",
        "systemctl restart operone",
        "sleep 5",
        "systemctl is-active operone",
        f"curl -sf http://127.0.0.1:{port}/api/health",
    ]
    for cmd in steps:
        code = run(client, cmd)
        if code != 0 and "curl" in cmd:
            client.close()
            return code
    client.close()
    print(f"\nOK {site_url()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
